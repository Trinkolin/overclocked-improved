// Overclocked: the simulation.
// You play three helper robots. Attendees are little AIs with personalities.
// The work, the crowd and the fans wear down a robot's energy. At zero it is worn out:
// it stops working and heads for a charging base. Not malice, overload.
import { GW, GH, rooms, roomByN, buildStatic, closeService, targetCells, SEATS, coffeeBar, popcornMachine, floorOf, portals, GROUND, targetsDef, booths, hallCoffee, receptionDesk, bofRooms, toilets, tables, TABLE_W, TABLE_H, chargers, exitSpots } from './level.js';
import { FlowField } from './nav.js';
import { Crowd } from './crowd.js';
import { Robot } from './robots.js';
import { collide, solidAt, moveCircle, blockedCircle } from './physics.js';
import { audio } from './audio.js';
import { say } from './lines.js';
import { TALKS } from './talks.js';

const N = GW * GH;
const g0 = ([x, y, w, h]) => [x, y + GROUND, w, h]; // a rect on the ground floor
const FIELD_KEYS = [...rooms.map(r => `room:${r.n}`), 'coffee', 'wc:F', 'wc:M', 'tables', 'steps', 'polo', 'expo', 'hallcoffee', 'down', 'up', 'downReception', 'charger', 'stairsUp', 'stairsDown'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

// Devoxx Belgium runs five days: two Deep Dive days (long sessions, a smaller crowd), then
// three conference days (the opening keynote on Wednesday, and Friday is a half day).
// End times are when the last sessions finish on the Devoxx Belgium 2026 schedule.
// Each day is one round; winning a day unlocks the next. The week follows the real Devoxx one:
// Monday and Tuesday are Deep Dive days (three-hour sessions, so people stay in the rooms and the
// corridors are calm); Wednesday and Thursday are the busy conference days (the Deep Dive crowd plus
// everyone who only comes for the conference); the exhibitors pack up on Thursday afternoon; and
// Friday is a calm half day, with fewer people and the booths downstairs empty.
// crowd: Monday and Tuesday calmer than Wednesday, the busiest day; Thursday a little less, Friday less still
// stay: long sessions: fewer people come and go in the middle of a talk
// newcomers: first-timers, on the first day of the Deep Dive (Monday) and of the conference (Wednesday). They get lost, and
// they want selfies with the robots and press their buttons; the days after, people know the way and the robots are old news
// fans: on top of that; Wednesday's keynote and packed rooms keep the first-timers a little busier (it is the hardest day)
// breaks: [from, to, kind] on the Devoxx Belgium 2026 schedule. People stay in the rooms during the talks and all
// come out at once for the breaks. keynote: the opening keynote in Room 8 (Wednesday until 11:30); closing: from then
// on everyone heads to the closing keynote's room (closingRoom: Room 5 on the schedule; Thursday 18:50); boothsFrom: the exhibition is set up that afternoon
const DEEP_DIVE_BREAKS = [['12:30', '13:30', 'lunch'], ['16:30', '16:50', 'coffee'], ['17:20', '17:35', 'break'], ['18:05', '18:20', 'break'], ['18:50', '19:00', 'break']];
export const DAYS = [
  { name: 'Monday', kind: 'Deep Dive · 3-hour sessions', crowd: 0.55, trouble: 0.55, newcomers: 1, stay: 1.8, end: '20:00', seconds: 188, breaks: DEEP_DIVE_BREAKS, boothsSoon: 'TUESDAY' }, // the exhibition hall opens on Tuesday (Devoxx FAQ)
  { name: 'Tuesday', kind: 'Deep Dive · 3-hour sessions', crowd: 0.65, trouble: 0.65, newcomers: 0.5, stay: 1.8, end: '20:00', seconds: 188, breaks: DEEP_DIVE_BREAKS },
  { name: 'Wednesday', kind: 'Conference · opening keynote', crowd: 1.0, trouble: 0.75, newcomers: 1, fans: 0.8, end: '19:50', seconds: 188, keynote: '11:30',
    breaks: [['11:30', '12:00', 'coffee'], ['12:50', '14:00', 'lunch'], ['14:50', '15:10', 'break'], ['16:00', '16:40', 'coffee'], ['17:30', '17:50', 'break'], ['18:40', '19:50', 'evening']] },
  { name: 'Thursday', kind: 'Conference · closing keynote', crowd: 0.85, trouble: 0.85, newcomers: 0.5, end: '19:50', seconds: 188, boothsLeave: 0.5, closing: '18:50', closingRoom: 5, // exhibitors pack up after lunch
    breaks: [['10:20', '10:40', 'break'], ['11:30', '11:50', 'break'], ['12:40', '13:50', 'lunch'], ['14:40', '15:00', 'break'], ['15:50', '16:30', 'coffee'], ['17:20', '17:40', 'break'], ['18:30', '18:50', 'break']] },
  { name: 'Friday', kind: 'Conference · calm half day', crowd: 0.6, trouble: 0.7, newcomers: 0.45, end: '12:40', seconds: 114, boothsGone: true, // fewer people, no exhibitors
    breaks: [['10:20', '10:40', 'break'], ['11:30', '11:50', 'break']] },
];
export const PESTS = {
  selfie: { emoji: '📸', label: 'Selfie fan', gives: 'gives_selfie', goal: 3, done: 'done_selfie' },
  poker: { emoji: '🔧', label: 'Button presser', gives: 'gives_poker', goal: 3, done: 'done_poker' },
};
export const LOUNGE = chargers[0].rect; // the charging corner at the top of the lounge (pests hang back): drawn where it charges

const HIT = 8;          // calm lost each time a pest does its thing (about every 1.3 s: ~6/s)
const CROWD_FREE = 5, CROWD_DRAIN = 0.9; // beyond 5 people close by, every extra one wears you down
// …depending on the job: a crowd breaks a technician's focus, a guide works among people, and crowds are security's job
const CROWD_BY_JOB = { voxxy: 1.2, droid: 1, biggy: 0.8 };
const NICE_HEAL = 7;    // patience/s next to a nice attendee
const LOUNGE_HEAL = 16; // energy/s on a charging base
const REST_HEAL = 6;    // energy/s for a robot stopped with nobody around (away from the crowd)
// the work itself wears them down, like real staff: Voxxy while it repairs, Droid while it escorts someone
const ALONE_BELOW = 25; // a robot whose energy fell below this, and nobody stayed with it: "nobody noticed"
const REPAIR_STRAIN = 10, ESCORT_STRAIN = 1, PATROL_STRAIN = 0.4; // calm/s (repairs are short but intense; escorts are long and gentle; Biggy's patrols are long and lighter still)
const TABLE_HEAL = 3, TABLE_REACH = 14; // a robot parked against a standing table: a small top-up, and the crowd around it wears it down half as much
const WOMEN = 0.15;    // most people at Devoxx are men: the men's toilets have the line
const TOILET_HEAL = 5; // a toilet break: a robot parked inside a working toilet block gets its energy back a little faster than at a table (the fans wait outside)
const REST_RADIUS = 60, REST_MAX = 2;
const RELIEF = 15;       // calm a robot gets back when Biggy's pest gives up
export const DETER = 1.5; const DETER_R = 26; // a pest standing this close to Biggy for this long gives up
// Fans are kind, but now and then one gets carried away: "just one more!", and they call a friend over.
// That's Biggy's job: it stands by them and they calm down. Left alone, they run out of steam after a while.
// Biggy is security, and it shows: its own fans take one photo less, and a crowd carried away around it calms down twice as fast
const BIGGY_FAN_GOAL = 2;
const CARRIED_CHANCE = 0.3, CARRIED_MAX = 30; // chance (× the day's crowd) that a fan gets carried away; seconds before they stop on their own
const CLINGY_AFTER = 15; // a fan who has followed a busy robot around this long becomes Biggy's job too
const BORED = 4;         // seconds a pest waits outside a charging base before it gives up
const VOXXY_HINT_AFTER = 12; // seconds of play a breakdown waits, while you steer Voxxy, before the game reminds you
const STRESSED = 75;     // below this, staying with a friend (hold E) comes before a repair; above it, after
const COMFORT = 14, COMFORT_BIGGY = 22, COMFORT_SELF = 3; // calm/s from company: big, steady Biggy is the most reassuring
const AMBIENT = 110;    // people walking between talks
const DAY_START = 8 * 60 + 30; // the doors open at 8:30, and people start coming in (Jessica); the talks start at 9:30
const EARLY = 0.2;      // the share of them already in at 8:30: the rest come in by the main entrance until 9:00
const HALLWAY = 0.15;   // the share who skip the next talk and stay out: the booths, a coffee, a standing table
const START_CLEAR = 90;  // when the doors open, nobody is dropped this close to a robot (the crowd drain counts people within 60)

// Spills: coffee, soda and popcorn end up on the floor where people gather. The small cleaning
// robots (the rest of the robot staff, not playable) mop them up on their own.
const SPILL_SPOTS = [[1090, 370, 200, 120], [450, 330, 170, 40], [450, 460, 170, 40], [220, 350, 1060, 130], g0([590, 150, 880, 680])];
const SPILL_DRAIN = 0.05, CLEAN_TIME = 1.5, CLEANER_SPEED = 42;
const CLEANER_ROUNDS = [[[1240, 465], [1100, 415], [700, 415], [300, 415], [700, 415]],       // one cleaner upstairs,
  [[740, 295 + GROUND], [1080, 300 + GROUND], [1100, 540 + GROUND], [850, 640 + GROUND], [560, 780 + GROUND], [350, 600 + GROUND]]]; // one in the exhibition hall, along its aisles

// Attendees are nice, until a problem drags on: then someone says so out loud (nobody follows a robot around)
const COMPLAIN_AFTER = { projector: [12, 35], lost: 18, bag: 16 }; // seconds broken / seconds lost / seconds a bag lies alone
// seconds Biggy stands by a bag; satisfaction lost per second while one lies alone (or while people sit on the stairs);
// the energy Biggy spends per second of a security check (it's work too)
export const BUBBLE_TYPING = 0; // no typing dots: the words show at once (the bubble still pops and shimmers)
export const BAG_CHECK = 1.6; const BAG_UNEASE = 0.07, EXIT_UNEASE = 0.06, SECURITY_STRAIN = 3;

// What can break. In a room: the projector, the Wi-Fi or the mic. In the corridor: the coffee
// machine runs empty (a developer conference's real emergency). Voxxy fixes all of them.
// fix: [quickest, longest] seconds of holding E. Every breakdown is different: a blocked toilet can
// take a plunge or a long fight, a projector can just need its cable pushed back in, or a full reset.
// Most are quick; now and then one is tricky (the time is rolled when it breaks, skewed toward quick).
export const INCIDENTS = {
  projector: { name: 'Projector down', problem: 'Screen broken', tag: '⚠ NO SIGNAL', weight: 5, fix: [0.5, 4], verb: 'reconnect the projector' },
  wifi: { name: 'Wi-Fi down', problem: 'Wi-Fi down', tag: '📶 NO WI-FI', weight: 3, fix: [0.8, 5], verb: 'reboot the Wi-Fi' },
  mic: { name: 'Mic dead', problem: 'Mic broken', tag: '🎤 MIC DEAD', weight: 2, fix: [0.4, 3], verb: 'fix the mic' },
  coffee: { name: 'The coffee machine is empty', problem: 'Coffee empty', tag: '☕ EMPTY', fix: [0.5, 3], verb: 'refill' },
  booth: { name: 'Power cut', problem: 'Blackout', tag: '🔌 NO POWER', fix: [0.6, 4], verb: 'reset the breaker' },
  badges: { name: 'Paper jam', problem: 'Paper jam', tag: '📄 PAPER JAM', fix: [0.4, 3.5], verb: 'clear the jam' },
  toilets: { name: 'Out of order', problem: 'Toilets blocked', tag: '🚽 OUT OF ORDER', fix: [0.4, 6], verb: 'unblock' },
  popcorn: { name: 'Jammed', problem: 'Popcorn jammed', tag: '🍿 JAMMED', fix: [0.5, 3], verb: 'unjam the popcorn machine' },
};
const TRICKY = 2.5; // a fix this long gets announced: "a tricky one!"
const rollFix = what => { const [lo, hi] = INCIDENTS[what]?.fix || [1, 1]; return lo + (hi - lo) * Math.random() ** 3; }; // average about a quarter of the way up
const ROOM_INCIDENTS = ['projector', 'wifi', 'mic'].flatMap(k => Array(INCIDENTS[k].weight).fill(k));
// Everywhere else something can break, on both floors: panel = where Voxxy fixes it, tag = where the sign goes.
// A spot with no `what` breaks like a room (projector, Wi-Fi or mic).
const under = ([x, y, w, h], dy = 12) => [x + w / 2, y + h + dy];
export const SPOTS = {
  popcorn: { place: 'the popcorn machine in the lounge', short: 'the popcorn', what: 'popcorn', panel: [popcornMachine[0] + popcornMachine[2] / 2, popcornMachine[1] - 12], tag: [popcornMachine[0] + popcornMachine[2] / 2 + 60, popcornMachine[1] + 26] },
  coffee: { place: 'the coffee machine in the lounge', short: 'the coffee', what: 'coffee', panel: [coffeeBar[0] + coffeeBar[2] / 2, coffeeBar[1] - 12], tag: [coffeeBar[0] + coffeeBar[2] / 2 + 70, coffeeBar[1] + 20] },
  'coffee:hall': { place: 'the coffee station in the exhibition hall', short: 'the hall coffee', what: 'coffee', panel: under(hallCoffee), tag: [hallCoffee[0] + hallCoffee[2] / 2, hallCoffee[1] - 10] },
  badges: { place: 'the badge printer at reception', short: 'the badge printer', what: 'badges', panel: [315, 518 + GROUND], tag: [315, 392 + GROUND] }, // at the reception desk, past the top of the stairs
  ...Object.fromEntries(bofRooms.map(b => [`bof:${b.n}`, { place: `BOF ${b.n}`, short: `BOF ${b.n}`, panel: [b.rect[0] + b.rect[2] / 2, b.rect[1] + 40], tag: [b.rect[0] + b.rect[2] / 2, b.rect[1] + 54] }])),
  ...Object.fromEntries(toilets.map(t => [`toilets:${t.id}`, { place: `the ${t.sides.length > 1 ? '' : t.sides[0] === 'F' ? "women's " : "men's "}toilets ${t.kiosk ? `by Kinepolis ${t.id}` : t.id === 'hall' ? 'off the exhibition hall' : 'by the BOF rooms'}`, short: 'the toilets', what: 'toilets',
    panel: t.kiosk || t.id === 'hall' ? [t.door[0] + 20, t.door[1] + 22] : [t.door[0] + 20, t.door[1] - 12],
    tag: t.kiosk || t.id === 'hall' ? [t.door[0] + 20, t.door[1] + 38] : [t.door[0] + 20, t.door[1] - 26] }])),
  ...Object.fromEntries(booths.map(b => [`booth:${b.id}`, { place: 'a booth in the hall', short: 'a booth', what: 'booth', panel: b.side === 'right' ? [b.rect[0] + b.rect[2] + 12, b.rect[1] + b.rect[3] / 2] : b.side === 'left' ? [b.rect[0] - 12, b.rect[1] + b.rect[3] / 2] : b.up ? [b.rect[0] + b.rect[2] / 2, b.rect[1] - 12] : under(b.rect), tag: b.side === 'right' ? [b.rect[0] + b.rect[2] + 40, b.rect[1] + b.rect[3] / 2 - 12] : b.side === 'left' ? [b.rect[0] - 40, b.rect[1] + b.rect[3] / 2 - 12] : b.up ? [b.rect[0] + b.rect[2] / 2, b.rect[1] - 26] : [b.rect[0] + b.rect[2] / 2, b.rect[1] + b.rect[3] + 26] }])),
};
const GROUND_SPOTS = Object.keys(SPOTS).filter(n => n !== 'coffee' && !n.startsWith('coffee'));
// Downstairs: some lost attendees are stuck at registration in the exhibition hall. Droid, the
// guide, takes the grand staircase down to fetch them and brings them back up.
const DOWNSTAIRS = 0.5; // share of lost attendees who turn up at reception, on the ground floor

// what each robot does when it has nothing to do: its rounds
const ROUNDS = {
  voxxy: ['checking the projectors', [...rooms.map(r => [r.cx, r.top ? 350 : 480]), [720, 290 + GROUND], [1000, 530 + GROUND]]], // room doors, then the booths
  droid: ['looking out for lost attendees', [[200, 415], [400, 560 + GROUND], [665, 415]]], // the stairs, reception, the stairs to the hall
  biggy: ['on patrol', [[260, 415], [1200, 440], [850, 420 + GROUND], [1200, 440]]], // the corridor, both ends, and the hall
};

// where people can be dropped when the day starts
const OPEN_AREAS = [[130, 390, 1100, 100], [1090, 380, 190, 100], g0([590, 60, 880, 800])]; // corridor, its far end, exhibition hall
const ARRIVALS = [[80, 375, 100, 80], [700, 375, 45, 15], [700, 440, 45, 15], g0([70, 370, 50, 480])]; // top of the stairs from reception, top of the stairs from the hall, main entrance (clear of the charging base)
const RECEPTION = g0([380, 320, 70, 120]); // where lost attendees turn up, by the reception desk (under the stairs)

export class Game {
  constructor(ui) {
    this.ui = ui;
    this.staticGrid = buildStatic();
    this.wallGrid = new Uint8Array(N);
    this.crowdGrid = closeService(this.staticGrid.slice()); // the attendees' walls: no way into the service corridors
    this.cost = new Float32Array(N);
    this.wallHug = new Float32Array(N);  // cells touching a wall: robots are wider than a cell
    this.robotCost = new Float32Array(N);
    this.densEMA = new Float32Array(N);
    this.fields = {};
    for (const k of FIELD_KEYS) this.fields[k] = new FlowField(k, targetCells(k, this.staticGrid));
    this.fieldCursor = 0;
  }

  start(dayIndex = 0, first = 'voxxy') {
    this.dayIndex = dayIndex; this.day = DAYS[dayIndex];
    this.t = 0;
    this.over = false;
    this.shake = 0;
    this.floaters = [];
    this.flashes = [];
    this.satisfaction = 100;
    this.boothsEmpty = !!this.day.boothsFrom || !!this.day.boothsSoon || !!this.day.boothsGone; // Monday: the exhibitors only set up in the afternoon; Friday: none
    this.breaks = (this.day.breaks || []).map(([a, b, kind]) => ({ t0: this.clockT(a), t1: this.clockT(b), from: a, to: b, kind }));
    this.breakNow = null; this.breakWarned = null; this.closingSaid = this.keynoteSaid = false;
    // the real talks of the day (titles from the Devoxx Belgium 2026 schedule), and the rooms that have any
    const mins = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    this.talks = (TALKS[dayIndex] || []).map(([room, from, to, type, title]) => ({ room, from, to, t0: mins(from), t1: mins(to), type, title }));
    this.openRooms = rooms.filter(r => this.talks.some(k => k.room === r.n));
    if (!this.openRooms.length) this.openRooms = rooms;
    this.sessionStarts = this.breaks.length ? [this.clockT('09:30'), ...this.breaks.map(b => b.t1)] : []; this.sessionIdx = 0;
    this.stressHint = this.lostHint = this.projHint = this.spillHint = this.downHint = false;
    this.fanHint = this.bagHint = this.exitHint = this.carriedHint = this.clingyHint = false;
    this.stats = { delivered: 0, fixed: 0, shooed: 0, cleaned: 0, bumps: 0, revolts: 0, reboots: 0, stayed: 0, bags: 0, exits: 0, fans: 0 };
    this.lowest = { voxxy: 100, droid: 100, biggy: 100 }; // each robot's lowest calm of the day
    this.lowestAt = { voxxy: '8:30', droid: '8:30', biggy: '8:30' }; // …and when
    this.stays = []; // each time you stayed with a robot in trouble: who, when, how low it was
    this.dips = []; this.dip = {}; // each time a robot ran down below ALONE_BELOW, and whether someone came
    this.crowd = new Crowd(this);
    // along the corridor, clear of its pillars (a robot dropped on one could stay stuck in it)
    this.robots = { voxxy: new Robot('voxxy', 1150, 415), droid: new Robot('droid', 560, 415), biggy: new Robot('biggy', 315, 415) };
    this.robotList = Object.values(this.robots);
    this.active = first === 'ai' ? null : first; // null: watching, the AI runs all three robots
    this.viewOverride = null; // a floor you chose to look at (F / Page Up / Page Down); null: follow your robot
    this.follow = null;       // a robot the camera follows without you steering it (the 👁 on its card)
    this.projectors = Object.fromEntries([...rooms.map(r => r.n), ...Object.keys(SPOTS)]
      .map(n => [n, { broken: false, fixT: 0, brokenT: 0, complaints: 0, what: SPOTS[n]?.what || 'projector' }]));
    this.pool = [];
    this.wcQueue = {}; this.wcInside = []; // the toilets: who is waiting in line, who is in a stall (off the map meanwhile)
    // one new kind of trouble at a time, starting with the job of the robot you steer
    const firstUp = { voxxy: 'projector', droid: 'lost', biggy: 'exit' }[first] || 'projector';
    this.next = { projector: 24, lost: 34, pest: 45, coffee: 60, spill: 70, [firstUp]: 4 };
    // Monday, the first day a judge plays: your robot's job first, then, before anything else,
    // one of the others struggles, so the heart of the game (looking after them) comes in the first minute
    this.wobble = null;
    if (dayIndex === 0) { for (const k in this.next) if (k !== firstUp) this.next[k] += 16; this.next.wobble = 24; }
    this.spills = [];
    this.bags = []; // unattended bags 🎒
    this.exits = []; // attendees blocking the stairs or the entrance 🚪
    this.cleaners = [[1240, 465], [740, 295 + GROUND]].map(([x, y], i) => ({ x, y, vx: 0, vy: 0, r: 4, heading: 0, spin: i, target: null, cleanT: 0, round: { i: 0 }, route: CLEANER_ROUNDS[i] }));

    this.wallGrid.set(this.staticGrid);
    for (let c = 0; c < N; c++) {
      const cx = c % GW, cy = (c / GW) | 0;
      let hug = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || this.wallGrid[ny * GW + nx]) hug = 1;
      }
      this.wallHug[c] = hug;
    }
    this.densEMA.fill(0);
    this.rebuildCost();
    for (const k of FIELD_KEYS) this.computeField(k);

    const everyone = Math.round(AMBIENT * this.day.crowd), early = Math.round(everyone * EARLY);
    this.arriving = { total: everyone - early, done: 0, until: this.clockT('09:00') }; // the others: see update
    for (let i = 0; i < early; i++) {
      let px, py, tries = 0; // not right on top of a robot: nobody should be half empty before you have done anything
      do { const [x, y, w, h] = pick(OPEN_AREAS); px = rnd(x, x + w); py = rnd(y, y + h); } while (++tries < 30 && (blockedCircle(this.crowdGrid, px, py, 6) || this.robotList.some(r => Math.hypot(r.x - px, r.y - py) < START_CLEAR))); // not inside a booth, a desk or a flight of stairs either
      this.spawnWalker(px, py);
    }
    // a few early arrivals chatting on the wide stairs at reception, before they go up, and a few getting their polo
    for (let i = 0; i < 7; i++) {
      const stop = i < 4 ? 'steps' : 'polo', [x, y, w, h] = targetsDef[stop][i < 4 ? i % 2 : 0], a = this.spawnWalker(rnd(x + 4, x + w - 4), y + h / 2);
      if (a) Object.assign(a, { state: 'wait', stop, dest: 'coffee_hold', timer: rnd(8, 30) });
    }
    // the nice ones: they say thank you to robots
    for (const [x, y] of [[1180, 470], [700, 400], [150, 460], [1280, 470], [880, 360]]) this.crowd.spawn(x, y, 'nice', { state: 'idle' });
  }

  // ------------------------------------------------------------ people
  spawnWalker(x, y) {
    // the opening keynote (Wednesday morning, Room 8) and the closing one (Thursday evening, Room 5 on the schedule): nearly everyone heads there
    const opening = this.day.keynote && this.t < this.clockT(this.day.keynote), closing = this.day.closing && this.t >= this.clockT(this.day.closing), keynote = opening || closing;
    // the hallway track: some skip the talk and stay out, at the booths, a coffee or a standing table (fewer skip a keynote)
    const hallway = Math.random() < (keynote ? HALLWAY / 2 : HALLWAY);
    const final = hallway ? 'hang' : `room:${keynote && Math.random() < 0.8 ? (closing ? this.day.closingRoom : 8) : this.pickRoom().n}`;
    const k = Math.random(); // people coming in downstairs: some stop at the toilets first
    const up = floorOf(y) === 1;
    // where they stop on the way (the rest go straight to their talk): in a break nearly everyone stops somewhere,
    // and about a third go to the toilets first. A chat: at a standing table upstairs, or sitting on the wide stairs at reception
    // (people coming in by the main entrance, and in a break those of rooms 6 and 7, at the top of those stairs)
    const brk = this.breakNow && this.breakNow.kind !== 'evening';
    const [coffee, chat, wc] = brk ? (up ? [0.4, 0.2, 0.3] : [0.4, 0.1, 0.35]) : (up ? [0.25, 0.08, 0.07] : [0.25, 0.08, 0.2]);
    const side = Math.random() < WOMEN ? 'F' : 'M'; // the women's or the men's (nothing on screen tells who is who)
    const loo = !this.toiletsOut(side);
    const sit = !up || (brk && x < 300) ? 'steps' : 'tables';
    const dest = k < coffee ? 'coffee' : k < coffee + chat ? sit : k < coffee + chat + wc && loo ? `wc:${side}` : final;
    return this.crowd.spawn(x, y, 'walker', { dest: dest === 'hang' ? this.hangout(y) : dest, final, skips: this.sessionIdx }); // skips: the next talk to start
  }
  // the hallway track: where someone who skips the talk goes (upstairs a standing table or the lounge's coffee,
  // downstairs the booths, when the exhibitors are there, the polo pickup, the hall's coffee or the steps at reception; some go down to the exhibition)
  hangout(y) {
    const r = Math.random(), expo = this.boothsEmpty ? 'hallcoffee' : 'expo';
    if (floorOf(y) === 1) return r < 0.3 ? 'tables' : r < 0.6 ? 'coffee' : r < 0.75 ? 'steps' : expo;
    return r < 0.4 ? expo : r < 0.55 ? 'hallcoffee' : r < 0.7 ? 'polo' : r < 0.85 ? 'steps' : 'tables';
  }
  // after a while at one spot: on to another, or now and then off to a talk after all
  nextHangout(a) {
    if (Math.random() < 0.25) a.final = `room:${this.pickRoom().n}`;
    return a.final === 'hang' ? this.hangout(a.y) : a.final;
  }

  spawnLost() {
    if (!this.lostHint) {
      this.lostHint = true;
      this.toast(this.active === 'droid' ? 'Lost attendee ❓! Walk Droid up to them.' : 'Lost attendee ❓: Droid is on it.', 'good');
    }
    const room = pick(this.openRooms).n; // looking for a room that has a talk today
    if (this.lostHint === 'shown' && Math.random() < DOWNSTAIRS) {
      const [x, y, w, h] = RECEPTION;
      this.crowd.spawn(rnd(x, x + w), rnd(y, y + h), 'lost', { state: 'idle', room, dest: `room:${room}`, final: `room:${room}` });
      if (!this.downHint) {
        this.downHint = true;
        this.toast(this.active === 'droid' ? 'Lost attendee ❓ at reception, downstairs. Take Droid down!' : 'Lost attendee ❓ at reception, downstairs.', 'good');
      }
      return;
    }
    this.lostHint = 'shown'; // the first one is always upstairs, where you can see it
    const [x, y, w, h] = pick(ARRIVALS);
    this.crowd.spawn(rnd(x, x + w), rnd(y, y + h), 'lost', { state: 'idle', room, dest: `room:${room}`, final: `room:${room}` });
  }

  spawnPest(type, target) {
    const [x, y, w, h] = pick(ARRIVALS);
    // a selfie, a button to press: any of the three robots will do (a worn-out one is left alone)
    const calm = ['voxxy', 'droid', 'biggy'].filter(k => !this.robots[k].rogue);
    if (!calm.length) return null;
    const P = PESTS[type || pick(Object.keys(PESTS))];
    target = target || pick(calm);
    return this.crowd.spawn(rnd(x, x + w), rnd(y, y + h), 'pest', { state: 'pester', pest: P, target, pref: 30 + Math.random() * 8 });
  }

  // "just one more!": a fan gets carried away and calls a friend over. Biggy keeps it friendly
  getCarriedAway(a, rb) {
    a.carried = true; a.carriedT = 0;
    const type = Object.keys(PESTS).find(k => PESTS[k] === a.pest);
    this.float(a.x, a.y - 10, `🤩 ${say(`carried_${type}`, { name: rb.name })}`, '#ffd27a', a.pest.label);
    const f = this.spawnPest(type, rb.kind);
    if (f) { f.x = a.x + rnd(-14, 14); f.y = a.y + rnd(-10, 10); f.carried = true; f.carriedT = 0; f.friend = true; }
    this.toast(this.carriedHint ? `🤩 Fans getting carried away around ${rb.name}!`
      : this.active === 'biggy' ? `🤩 Fans getting carried away around ${rb.name}! Stand Biggy next to them.`
      : `🤩 Fans getting carried away around ${rb.name}! Biggy will keep it friendly.`, 'bad');
    this.carriedHint = true;
  }

  sendHome(a, text) {
    a.leaving = true; a.state = 'walk'; a.dest = a.final = 'down';
    if (text) this.float(a.x, a.y - 8, text, '#9fdcff');
  }

  onArrive(a) {
    if (a.kind === 'lost') {
      this.stats.delivered++;
      this.satisfaction = Math.min(100, this.satisfaction + 5);
      this.float(a.x, a.y - 8, say('found', { room: a.room }), '#7bdc6b');
      audio.chime();
    }
    // after a talk, people come back out for the next one
    if (a.kind === 'walker' && a.final.startsWith('room:')) this.pool.push({ t: this.leaveRoomAt(), room: +a.final.slice(5) });
  }

  // a room with a talk today, the bigger ones more often (on Friday only five rooms are in use)
  pickRoom() {
    const R = this.openRooms, total = R.reduce((t, r) => t + SEATS[r.n], 0);
    let k = Math.random() * total;
    for (const r of R) if ((k -= SEATS[r.n]) < 0) return r;
    return R[0];
  }
  // a room (upstairs, or a BOF room downstairs) with no talk on right now: a break, or no more talks today
  roomIdle(n) {
    const room = roomByN[n] ? +n : n.startsWith('bof:') ? `bof${n.slice(4)}` : null;
    return room !== null && !this.talkIn(room)?.now;
  }
  // the talk in a room right now, or the next one today (null: nothing left there today)
  talkIn(room) {
    const [h, m] = this.clock.text.split(':').map(Number), now = h * 60 + m;
    let next = null;
    for (const k of this.talks) if (k.room === room) { if (k.t0 <= now && now < k.t1) return { ...k, now: true }; if (k.t0 > now && (!next || k.t0 < next.t0)) next = k; }
    return next && { ...next, now: false };
  }
  // when someone who just sat down in a talk comes back out: at the next break, like everyone (a few come and go)
  leaveRoomAt() {
    if (!this.breaks.length) return this.t + rnd(12, 35) * (this.day.stay || 1);
    if (Math.random() < 0.12 / (this.day.stay || 1)) return this.t + rnd(10, 30);
    if (this.day.closing && this.t >= this.clockT(this.day.closing)) return this.day.seconds + 99; // the closing keynote: until the end
    const next = this.breaks.find(b => b.t0 > this.t + 1);
    return next ? next.t0 + rnd(0, 2.5) : this.day.seconds + 99;
  }
  // a time of day ('16:30') in game seconds
  clockT(hhmm) {
    const [h, m] = hhmm.split(':').map(Number), [eh, em] = this.day.end.split(':').map(Number);
    return ((h * 60 + m) - DAY_START) / ((eh * 60 + em) - DAY_START) * this.day.seconds;
  }
  // what the schedule says right now, for the HUD: the current break, or the next one
  get schedule() {
    const icon = { coffee: '☕', lunch: '🍽', break: '☕', evening: '🌙' };
    const name = b => b.kind === 'lunch' ? 'lunch' : b.kind === 'coffee' ? 'coffee' : 'break';
    if (this.breakNow) return this.breakNow.kind === 'evening' ? '🌙 the talks are over' : `${icon[this.breakNow.kind]} ${name(this.breakNow)} until ${this.breakNow.to}`;
    if (this.day.keynote && this.t < this.clockT(this.day.keynote)) return `🎤 keynote until ${this.day.keynote}`;
    if (this.day.closing && this.t >= this.clockT(this.day.closing)) return '🎤 closing keynote';
    const next = this.breaks.find(b => b.t0 > this.t);
    return next && next.kind !== 'evening' ? `next: ${icon[next.kind]} ${name(next)} at ${next.from}` : '';
  }
  hurryToTalks() {
    for (const a of this.crowd.list) {
      // who skipped the last talk usually goes to this one (the others skip this one too); who chose to skip this one stays out
      if (a.kind === 'walker' && a.final === 'hang' && a.skips < this.sessionIdx - 1) {
        if (Math.random() < 0.8) a.final = `room:${this.pickRoom().n}`; else a.skips = this.sessionIdx - 1;
      }
      if (a.kind !== 'walker' || a.leaving || !a.final.startsWith('room:')) continue;
      // the coffee and the chat are cut short; the toilets are not (a break lasts only seconds of game time, and nobody
      // skips the toilets because the talk is starting: they come in a little late), nor a chat sitting on the steps or a polo being handed over
      if (a.state === 'wait') { if (!a.stop?.startsWith('wc:') && a.stop !== 'steps' && a.stop !== 'polo') a.timer = Math.min(a.timer, rnd(0.2, 1)); }
      else if (a.dest === 'coffee' || a.dest === 'tables' || a.dest === 'steps' || a.dest === 'polo') a.dest = a.final;
      if (!a.hurry) { a.hurry = true; a.pref *= 1.35; }
    }
  }
  // the schedule's moments: breaks (everyone comes out), the keynotes, the exhibition setting up
  updateSchedule() {
    const now = this.breaks.find(b => this.t >= b.t0 && this.t < b.t1) || null;
    if (now && now !== this.breakNow) {
      this.toast(now === this.breaks[0] && this.day.keynote ? '🎤 The keynote is over: everyone comes out for coffee!'
        : now.kind === 'lunch' ? '🍽 Lunch! Everyone comes out of the rooms.'
        : now.kind === 'coffee' ? '☕ Coffee break! Everyone comes out of the rooms.'
        : now.kind === 'evening' ? '🌙 The talks are over: people head for the BOFs and the Meet and Greet.'
        : null, 'good');
    }
    this.breakNow = now;
    // the talks start: people cut their coffee short and hurry to their room
    if (this.sessionIdx < this.sessionStarts.length && this.t >= this.sessionStarts[this.sessionIdx]) { this.sessionIdx++; this.hurryToTalks(); }
    // a heads-up before the big ones, so the robots can recharge before the rush
    const soon = this.breaks.find(b => (b.kind === 'lunch' || b.kind === 'coffee') && b.t0 > this.t && b.t0 - this.t < 4);
    if (soon && soon !== this.breakWarned) { this.breakWarned = soon; this.toast(`${soon.kind === 'lunch' ? '🍽 Lunch' : '☕ Coffee break'} at ${soon.from}: the corridors are about to fill up.`, 'bad'); }
    if (this.day.keynote && this.t < 0.5 && !this.keynoteSaid) { this.keynoteSaid = true; this.toast('🎤 Opening keynote at 9:30 in Room 8: the crowd heads there.', 'good'); }
    if (this.day.closing && !this.closingSaid && this.t >= this.clockT(this.day.closing)) { this.closingSaid = true; this.toast(`🎤 Closing keynote at 18:55 in Room ${this.day.closingRoom}: everyone heads there!`, 'good'); }
    if (this.day.boothsFrom && this.boothsEmpty && this.t >= this.clockT(this.day.boothsFrom)) {
      this.boothsEmpty = false;
      this.toast('🔌 The exhibitors arrive and set up their booths in the exhibition hall.', 'good');
    }
  }

  onTouch(rb, a, closing) {
    if (rb.rogue) return; // worn out: it just trundles to a charger, careful not to bump anyone
    if (rb.kind === 'droid' && a.kind === 'lost' && a.state === 'idle') { // Droid knows the building: it guides
      const followers = this.crowd.list.filter(b => b.state === 'follow').length;
      if (followers >= 3) return;
      a.state = 'follow'; a.followIdx = followers;
      const tr = rb.trail; let best = Infinity; a.crumbId = tr.length ? tr[0].id - 1 : 0;
      for (const c of tr) { const d = Math.hypot(c.x - a.x, c.y - a.y); if (d < best) { best = d; a.crumbId = c.id - 1; } }
      this.float(a.x, a.y - 8, say('follow', { room: a.room }), '#ffb050');
      audio.chirp();
    }
    // Biggy never goes for people: a bump is only ever careless driving
    if (rb.kind === 'biggy' && a.kind !== 'pest' && closing > 32 && rb.speed > 32 && a.bumpCD <= 0) this.bump(a, closing);
  }

  // Biggy is security: a pest that has to stand next to Biggy soon gives up and goes home.
  deterPests(dt) {
    const big = this.robots.biggy;
    let calming = false; // keeping order costs Biggy the same for one carried-away fan as for a group of them
    for (const a of this.crowd.list) {
      if (a.kind !== 'pest' || a.leaving) continue;
      // a robot that made it onto a charging base: its pest waits outside, then gets bored
      if (this.inLounge(this.robots[a.target])) {
        if ((a.outsideT = (a.outsideT || 0) + dt) > BORED) { this.stats.shooed++; this.sendHome(a, say('bored')); }
        continue;
      }
      a.outsideT = 0;
      // a fan trailing a busy robot around (it keeps moving for its job, so no photo): after a while, security steps in
      // (Biggy's own fans: nobody to walk them away, they run out of steam)
      if (!a.carried && a.state === 'pester' && a.target !== 'biggy' && (a.chaseT = (a.chaseT || 0) + dt) > CLINGY_AFTER) {
        a.carried = a.clingy = true; a.carriedT = 0;
        const rb = this.robots[a.target];
        if (!this.clingyHint) { this.clingyHint = true; this.toast(`${a.pest.emoji} A fan keeps following ${rb.name} around. ${this.active === 'biggy' ? 'Stand Biggy next to them.' : 'Biggy will step in.'}`, 'bad'); }
      }
      if (a.carried && (a.carriedT += dt) > (a.target === 'biggy' ? CARRIED_MAX / 2 : CARRIED_MAX)) { this.sendHome(a, say(a.clingy ? a.pest.gives : 'carried_done')); continue; } // they run out of steam
      const near = !big.rogue && a.target !== big.kind && Math.hypot(a.x - big.x, a.y - big.y) < big.r + DETER_R;
      a.deterT = near ? (a.deterT || 0) + dt : Math.max(0, (a.deterT || 0) - dt);
      if (near && a.carried) calming = true;
      if (a.deterT < DETER) continue;
      this.stats.shooed++;
      if (a.carried) this.stats.fans++;
      this.satisfaction = Math.min(100, this.satisfaction + 1);
      this.sendHome(a, say(a.carried && !a.clingy ? 'gives_carried' : a.pest.gives));
      const victim = this.robots[a.target];
      // only a robot that was actually being bothered notices (a fan still on its way just turns back); and like any comfort,
      // the relief comes from the robot you steer: when the AI drives Biggy, the fan just goes
      if (big.kind === this.active && !victim.rogue && Math.hypot(a.x - victim.x, a.y - victim.y) < 60) {
        victim.patience = Math.min(100, victim.patience + RELIEF);
        if (this.t > (victim.thanked || 0) + 3) { victim.thanked = this.t; this.float(victim.x, victim.y - victim.r - 10, '😌', '#7bdc6b'); } // once, not per pest
      }
      audio.chirp();
    }
    if (calming) big.patience = Math.max(0, big.patience - SECURITY_STRAIN * dt);
  }

  bump(a, speed) {
    a.state = 'stumble'; a.timer = 1.4; a.bumpCD = 2.5;
    this.stats.bumps++;
    this.satisfaction = Math.max(0, this.satisfaction - 2);
    this.float(a.x, a.y - 6, say('bumped'), '#ff6b6b');
    audio.thud(0.5 + speed / 120);
    this.shake = Math.max(this.shake, 2);
  }

  // on a charging base ⚡ (the lounge's upstairs, or the one at reception)
  inLounge(rb) {
    return chargers.some(({ rect: [x, y, w, h] }) => rb.x > x && rb.x < x + w && rb.y > y && rb.y < y + h);
  }
  // inside a working toilet block (a blocked one is no place for a break)
  inToilets(o) {
    return toilets.some(({ id, rect: [x, y, w, h] }) => o.x > x && o.x < x + w && o.y > y && o.y < y + h && !this.projectors[`toilets:${id}`].broken);
  }
  nearestCharger(rb) {
    const here = chargers.filter(c => floorOf(c.rect[1]) === floorOf(rb.y));
    return (here.length ? here : chargers).map(c => ({ x: c.rect[0] + c.rect[2] / 2, y: c.rect[1] + c.rect[3] / 2 }))
      .sort((a, b) => Math.hypot(a.x - rb.x, a.y - rb.y) - Math.hypot(b.x - rb.x, b.y - rb.y))[0];
  }

  toast(msg, kind, first) { if (msg) this.ui.toast(msg, kind, first); } // first: it jumps the queue of messages
  float(x, y, text, color = '#fff', who) {
    // long enough to read: about 55 ms per character on top of a base, between 1.6 s and 4.5 s
    // someone's words (a robot's or an attendee's) come in a speech bubble that types first (… for half a second), so it
    // gets that half second on top; the game's own notices ("Power is back!") stay plain labels
    const words = /[A-Za-z]/.test(text), speaker = words ? who || this.speakerAt(x, y) : null;
    const bubble = words && speaker !== 'Scene' && !/^Game/.test(speaker);
    // a robot talks in its own colour; people talk in white bubbles, like their 😊 ❓ icons
    const robot = bubble ? (/^(Voxxy|Droid|Biggy)\b/.exec(speaker)?.[1]?.toLowerCase() || (/^Cleaning robot/.test(speaker) ? 'cleaner' : null)) : null;
    this.floaters.push({ x, y, text, color, t: 0, bubble, robot, life: Math.min(4.5, Math.max(1.6, 1.4 + text.length * 0.055)) + (bubble ? BUBBLE_TYPING : 0) });
    if (words) this.ui?.onLine?.(this.t, text, speaker); // words, not just 😣 🔊
  }
  // who is talking: the robot or the attendee standing right under a floating line
  speakerAt(x, y) {
    // an attendee right under the line first (their lines sit exactly above their head), then a robot
    let best = null, bd = 1.5;
    for (const a of this.crowd.list) { const d = Math.abs(a.x - x); if (d < bd && a.y - y >= 0 && a.y - y <= 20) { bd = d; best = a; } }
    if (best) {
      const to = best.target && this.robots[best.target] ? ` → ${this.robots[best.target].name}` : '';
      if (best.kind === 'pest') return `${best.pest.label} ${best.pest.emoji}${to}`;
      if (best.state === 'follow') return 'Lost attendee, following Droid';
      return { lost: 'Lost attendee ❓', nice: 'Friendly attendee 😊', walker: 'Attendee' }[best.kind] || 'Attendee';
    }
    for (const rb of this.robotList) if (Math.abs(rb.x - x) <= rb.r + 8 && y <= rb.y && rb.y - y <= rb.r + 30) return `${rb.name} (robot${rb.kind === this.active ? ', you' : ''})`;
    if (this.cleaners.some(c => Math.hypot(c.x - x, c.y - y) < 20)) return 'Cleaning robot';
    return 'Scene';
  }

  select(kind) {
    this.viewOverride = null; this.follow = null; // switching robot: the view follows the new one
    if (this.robots[kind].rogue) { this.toast(`${this.robots[kind].name} is worn out and recharging. Stay with it to help.`, 'bad'); return false; }
    this.active = kind; return true;
  }

  // ------------------------------------------------------------ mood
  updateMood(dt) {
    for (const rb of this.robotList) {
      if (rb.rogue) continue;
      let delta = 0, pests = 0, around = 0, pester = null, hit = 0;
      rb.hitT = Math.max(0, (rb.hitT || 0) - dt);
      this.crowd.forEachNear(rb.x, rb.y, REST_RADIUS, a => {
        const d = Math.hypot(a.x - rb.x, a.y - rb.y);
        if (d < REST_RADIUS) around++;
        if (a.kind === 'pest' && a.state === 'pester' && a.target === rb.kind && d < rb.r + 16) {
          pests++; pester = a.pest;
          if ((a.actT = (a.actT ?? 0.3) - dt) <= 0) {
            a.actT = rnd(1.1, 1.5); hit += this.pestAct(a, rb);
            // got the photo, pressed the buttons: they leave the robot alone
            if (a.pest.goal && (a.acts = (a.acts || 0) + 1) >= (rb.kind === 'biggy' ? BIGGY_FAN_GOAL : a.pest.goal) && !a.carried) {
              if (!a.friend && Math.random() < CARRIED_CHANCE * this.day.crowd) this.getCarriedAway(a, rb);
              else this.sendHome(a, say(a.pest.done, { name: rb.name }));
            }
          }
        }
        if (a.kind === 'nice' && d < 38) { if (rb.speed < 10) delta += NICE_HEAL; if (Math.random() < dt * 0.25) this.float(a.x, a.y - 12, say(Math.random() < 0.5 ? 'nice' : `nice_${rb.kind}`), '#7bdc6b'); }
      });
      // several fans at once: the first one counts in full, every other one half (a group is tiring, not a free fall)
      if (pests > 1) hit *= (1 + 0.5 * (pests - 1)) / pests;
      rb.pester = pester; // shown on the robot's card
      if (pester && !this.fanHint) { // fans are kind: they get their three selfies (or button presses) and go, but it's tiring
        this.fanHint = true;
        this.toast(`${pester.emoji} ${pester.label} with ${rb.name}. Tiring, but they'll leave soon.`, 'bad');
      }
      if (!rb.rogue && rb.patience < 30 && this.t > (rb.overworkT ?? 0) + 15) { rb.overworkT = this.t; this.float(rb.x, rb.y - rb.r - 16, `😅 ${say(`overwork_${rb.kind}`)}`, '#ffd27a', rb.name); }
      if (!this.stressHint && rb.patience < 60) {
        this.stressHint = true;
        this.toast(`${rb.name} is getting tired: stay with it or give it a break.`, 'bad');
      }
      // a pit stop: parked against a standing table, a robot leans on it and gets its breath back a little
      rb.atTable = !pests && rb.speed < 10 && this.nearTable(rb);
      if (rb.atTable) { delta += TABLE_HEAL; if (rb.patience < 100 && this.t > (rb.breakSaid || 0) + 5) { rb.breakSaid = this.t; this.float(rb.x, rb.y - rb.r - 8, '🔋 a short break', '#9fdcff', rb.name); } }
      // a toilet break: parked inside a working toilet block, it gets its energy back too (it never thinks of it on its own)
      rb.atToilet = !pests && rb.speed < 10 && this.inToilets(rb);
      if (rb.atToilet) { delta += TOILET_HEAL; if (rb.patience < 100 && this.t > (rb.breakSaid || 0) + 5) { rb.breakSaid = this.t; this.float(rb.x, rb.y - rb.r - 8, `🚽 ${say(`toilet_${rb.kind}`)}`, '#9fdcff', rb.name); } }
      if (rb.kind === 'voxxy' && this.t - (rb.workingT ?? -9) < 0.1) delta -= REPAIR_STRAIN;
      if (rb.kind === 'droid' && this.crowd.list.some(a => a.state === 'follow')) delta -= ESCORT_STRAIN;
      if (rb.kind === 'biggy' && rb.task === 'on patrol' && rb.speed > 5) delta -= PATROL_STRAIN; // walking its rounds is its job too
      delta -= Math.max(0, around - CROWD_FREE) * CROWD_DRAIN * CROWD_BY_JOB[rb.kind] * (rb.atTable || rb.atToilet ? 0.5 : 1); // noise and crowding, as each one's job takes it
      if (this.inLounge(rb) && rb.speed < 10) delta += LOUNGE_HEAL; // plugged in: parked on the base, not driving across it
      // a moment of peace away from the crowd
      rb.resting = !pests && around <= REST_MAX && rb.patience < 100 && rb.speed < 10; // resting means stopping, not walking an empty corridor
      if (rb.resting) delta += REST_HEAL;
      rb.crowded = around > CROWD_FREE;
      if ((pests || rb.crowded) && this.t > (rb.stressSaid || 0) + 2.5) { rb.stressSaid = this.t; this.float(rb.x + rnd(-8, 8), rb.y - rb.r - 6, pests ? '😣' : '🔊', '#ff9f9f'); } // a hint, not a shower
      const before = rb.patience;
      rb.patience = Math.max(0, Math.min(100, rb.patience + delta * dt - hit));
      if (before >= 30 && rb.patience < 30 && this.stressHint) this.toast(`${rb.name} is almost out of energy! Stay with it.`, 'bad');
      if (rb.patience <= 0) this.goRogue(rb);
    }
  }

  // each pest does its thing, and the robot visibly takes it
  pestAct(a, rb) {
    const d = Math.hypot(rb.x - a.x, rb.y - a.y) || 1, nx = (rb.x - a.x) / d, ny = (rb.y - a.y) / d;
    if (a.pest === PESTS.selfie) {
      // a camera flash right in its visor
      this.flashes.push({ x: a.x + nx * 4, y: a.y + ny * 4, t: 0 });
      rb.hitT = 0.25;
      this.float(a.x, a.y - 10, '📸 click!', '#fff3c4');
      audio.tick();
    } else {
      // someone pressing its buttons: a startled beep and a twitch
      rb.hitT = 0.3;
      this.float(rb.x, rb.y - rb.r - 4, 'beep!?', '#ffe14a', rb.name);
      audio.chirp(); audio.servo();
    }
    return HIT;
  }

  goRogue(rb) {
    rb.rogue = true; rb.rebootT = 0;
    this.stats.revolts++;
    this.toast(this.active === rb.kind
      ? `${rb.name} is worn out: it heads for a charging base ⚡ and it's yours again once recharged. Take another robot to stay with it.`
      : `${rb.name} is worn out! It stops working and heads for a charging base ⚡`, 'bad', true); // never lost in a pile of breakdowns
    this.float(rb.x, rb.y - 24, '🔋 WORN OUT', '#ff7ad9', rb.name);
    audio.gong();
    // the pests got what they wanted: they flee
    for (const a of this.crowd.list) if (a.kind === 'pest' && a.target === rb.kind && !a.leaving) this.sendHome(a);
    // the robot you steer stays yours: the camera follows it to the charging base, and you get it back once
    // it's recharged (switching you to another robot on your behalf was disorienting). Take another one to help it.
    if (this.active === rb.kind) this.ui.onSwitch?.();
  }

  // the way to the nearest staircase to the other floor
  toStairs(rb) { rb.viaStairs = this.t; return this.fields[floorOf(rb.y) ? 'stairsDown' : 'stairsUp'].sample(rb.x, rb.y, {}); }

  // Staircases link the floors: step onto one end and you come out at the other. A robot is on
  // the stairs for a moment (faded out); the view follows the robot you steer.
  takeStairs(o, dt, trip) {
    if ((o.portalCD = (o.portalCD || 0) - dt) > 0) return false;
    for (const p of portals) for (const [from, to] of [[p.a, p.outB], [p.b, p.outA]]) {
      const [rx, ry, rw, rh] = from;
      if (o.x < rx || o.x > rx + rw || o.y < ry || o.y > ry + rh) continue;
      const fx = o.x, fy = o.y;
      o.x = to[0] + (Math.random() - 0.5) * 8; o.y = to[1] + (Math.random() - 0.5) * 8; o.vx = o.vy = 0;
      o.portalCD = 1.5; if (trip) { o.away = trip; o.climb = { fx, fy, dur: trip, up: floorOf(o.y) === 1 }; } // the stacked map draws the climb
      return true;
    }
    return false;
  }

  // a worn-out robot drives itself, slowly, to the nearest charging base
  rogueInput(rb) {
    const out = {};
    const c = Math.floor(rb.y / 10) * GW + Math.floor(rb.x / 10);
    const base = this.chargerField(rb); // the charging bases, one on each floor
    if (base.isTarget[c] || this.inLounge(rb)) return { x: 0, y: 0 }; // plugged in
    base.sample(rb.x, rb.y, out);
    return out;
  }

  // keep robots off the walls, so they go through the middle of a doorway instead of snagging the jamb
  robotPathCost() {
    for (let c = 0; c < N; c++) this.robotCost[c] = this.cost[c] + this.wallHug[c] * 6;
    return this.robotCost;
  }

  // the charger and stairs fields only steer robots; everything else steers people
  computeField(key) {
    const robotsOnly = key === 'charger' || key.startsWith('stairs'); // clear of the walls
    this.fields[key].compute(robotsOnly ? this.wallGrid : this.crowdGrid, robotsOnly ? this.robotPathCost() : this.cost);
  }

  // where a worn-out robot heads: the charging bases, one on each floor
  chargerField(rb) { return this.fields.charger; }

  // the AI's robots steer round each other (and round the one you drive) instead of pushing through: a robot ahead, close,
  // turns the way to the side, both keeping to their right when they meet head on, and slows a little
  giveWay(rb, v) {
    const m = Math.hypot(v.x, v.y);
    if (!m) return v;
    let dx = v.x / m, dy = v.y / m, sx = 0, sy = 0;
    for (const o of this.robotList) {
      if (o === rb || o.away > 0 || floorOf(o.y) !== floorOf(rb.y)) continue;
      const rx = o.x - rb.x, ry = o.y - rb.y, d = Math.hypot(rx, ry), R = rb.r + o.r + 26;
      if (d >= R || d < 0.01) continue;
      const ahead = (rx * dx + ry * dy) / d; // 1 = straight ahead
      if (ahead < -0.2) continue; // behind: none of its business
      const w = (1 - d / R) * (0.6 + ahead);
      let side = dx * ry - dy * rx >= 0 ? -1 : 1; // pass on the side it is not on…
      if (Math.abs(dx * ry - dy * rx) / d < 0.25) side = 1; // …and keep right when it is dead ahead
      sx += (-dy * side) * w * 1.6 - (rx / d) * w * 0.6; sy += (dx * side) * w * 1.6 - (ry / d) * w * 0.6;
    }
    if (!sx && !sy) return v;
    dx += sx; dy += sy;
    const n = Math.hypot(dx, dy) || 1;
    return { x: dx / n * m, y: dy / n * m };
  }

  // nudge a steering vector away from walls, so a robot centres itself in doorways
  clear(rb, v) {
    if (!v.x && !v.y) return v;
    let px = 0, py = 0;
    for (let a = 0; a < 8; a++) {
      const cx = Math.cos(a * Math.PI / 4), cy = Math.sin(a * Math.PI / 4);
      if (solidAt(this.wallGrid, rb.x + cx * (rb.r + 5), rb.y + cy * (rb.r + 5))) { px -= cx; py -= cy; }
    }
    const x = v.x + px * 0.45, y = v.y + py * 0.45, l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  }

  // path to any point: one private flow field per robot, refreshed when the
  // target moves or every half second (targets like people keep walking)
  pathTo(rb, x, y) {
    if (floorOf(y) !== floorOf(rb.y)) return this.toStairs(rb); // the other floor: the nearest staircase first
    const d = Math.hypot(x - rb.x, y - rb.y);
    if (d < 26) { const l = d || 1; return { x: (x - rb.x) / l, y: (y - rb.y) / l }; }
    const P = rb.path || (rb.path = { field: new FlowField('seek', Int32Array.of(0)), x: -1e9, y: -1e9, t: -1 });
    if (Math.hypot(P.x - x, P.y - y) > 20 || this.t - P.t > 0.5) {
      const cx = Math.max(0, Math.min(GW - 1, Math.floor(x / 10))), cy = Math.max(0, Math.min(GH - 1, Math.floor(y / 10)));
      P.field.setTargets(Int32Array.of(cy * GW + cx));
      P.field.compute(this.wallGrid, this.robotPathCost());
      P.x = x; P.y = y; P.t = this.t;
    }
    const out = {};
    P.field.sample(rb.x, rb.y, out);
    return out;
  }

  // robots you are not steering do their job on their own, but they don't
  // look after themselves: they walk straight into crowds and pests.
  autoInput(rb) {
    const tmp = {};
    const nearest = pred => { let best = null, bd = Infinity; for (const a of this.crowd.list) if (pred(a)) { const d = Math.hypot(a.x - rb.x, a.y - rb.y); if (d < bd) { bd = d; best = a; } } return best; };
    if (rb.kind === 'droid') { // the guide
      const f = this.crowd.list.find(a => a.state === 'follow');
      if (f) { const d = this.roomDoor(f.room, rb); rb.task = `taking someone to Room ${f.room}`; return this.pathTo(rb, d.x, d.y); }
      const lost = nearest(a => a.kind === 'lost' && a.state === 'idle');
      if (lost) { rb.task = 'fetching a lost attendee'; return this.pathTo(rb, lost.x, lost.y); }
    } else if (rb.kind === 'voxxy') { // the technician
      let best = null, bd = Infinity;
      for (const n in this.projectors) if (this.projectors[n].broken) { const p = this.panelOf(n); const d = Math.hypot(p.x - rb.x, p.y - rb.y); if (d < bd) { bd = d; best = n; } }
      if (best) {
        rb.task = `fixing ${this.placeOf(best)}`;
        const p = this.panelOf(best);
        return bd < 8 ? { x: 0, y: 0 } : this.pathTo(rb, p.x, p.y);
      }
    } else if (rb.kind === 'biggy') {
      // security: unattended bags and blocked stairs, the nearest first (the other floor counts as far away).
      // It doesn't chase fans: they're kind and leave on their own (if Biggy walks by, they leave sooner)
      let job = null, bd = Infinity;
      const carried = this.crowd.list.filter(a => a.carried && !a.leaving && a.state === 'pester');
      // bags and blocked stairs first (they worry everyone), fans after that; the other floor counts as far away
      for (const b of [...this.bags, ...this.exits, ...carried]) { const d = Math.hypot(b.x - rb.x, b.y - rb.y) + (floorOf(b.y) === floorOf(rb.y) ? 0 : 800) + (b.carried ? 600 : 0); if (d < bd) { bd = d; job = b; } }
      if (job) {
        rb.task = job.clingy ? `walking a fan away from ${this.robots[job.target].name}` : job.carried ? 'keeping the fans friendly' : job.where ? 'clearing the stairs' : 'checking an unattended bag';
        if (floorOf(job.y) === floorOf(rb.y) && Math.hypot(job.x - rb.x, job.y - rb.y) < rb.r + 12) return { x: 0, y: 0 };
        // a careful pace near people (it never bumps anyone below 32), a brisk one when the way is clear
        let near = 0; this.crowd.forEachNear(rb.x, rb.y, 48, a => { if (Math.hypot(a.x - rb.x, a.y - rb.y) < 48) near++; });
        return rb.speed > (near ? 30 : 55) ? { x: 0, y: 0 } : this.pathTo(rb, job.x, job.y);
      }
    }
    // nothing to do: its rounds, like real staff
    const [task, route] = ROUNDS[rb.kind];
    const r = rb.round = rb.round || { i: 0 }, [wx, wy] = route[r.i % route.length];
    if (Math.hypot(wx - rb.x, wy - rb.y) < 30) r.i++;
    rb.task = task;
    if (rb.kind === 'biggy' && rb.speed > 24) return { x: 0, y: 0 }; // security walks its rounds, it doesn't charge through the crowd
    return this.pathTo(rb, wx, wy);
  }

  // where the robot you steer is needed (drawn as a guide arrow): a friend in trouble first,
  // then some rest if it is itself about to snap, then its own job
  guideTarget(rb) {
    if (rb.rogue) return null;
    const friend = this.robotList.filter(o => o !== rb && (o.rogue || o.patience < 60)).sort((a, b) => (b.rogue - a.rogue) || a.patience - b.patience)[0];
    if (friend) return Math.hypot(friend.x - rb.x, friend.y - rb.y) > friend.r + rb.r + 14 ? this.viaStairs(rb, { x: friend.x, y: friend.y, label: `stay with ${friend.name}`, care: true }) : null;
    if (this.inLounge(rb) && rb.patience < 80) return null; // on a charging base: let it recharge, the work can wait
    if (rb.patience < 35) { const b = this.nearestCharger(rb); return this.viaStairs(rb, { x: b.x, y: b.y, label: 'recharge on a charging base ⚡', care: true }); }
    return this.viaStairs(rb, this.jobTarget(rb));
  }

  // a target on the other floor: point at the nearest staircase instead
  viaStairs(rb, t) {
    if (!t || floorOf(t.y) === floorOf(rb.y)) return t;
    let best = null, bd = Infinity;
    for (const p of portals) for (const r of [p.a, p.b]) {
      if (floorOf(r[1]) !== floorOf(rb.y)) continue;
      const x = r[0] + r[2] / 2, y = r[1] + r[3] / 2, d = Math.hypot(x - rb.x, y - rb.y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best && { ...best, label: `${t.label} · ${floorOf(rb.y) ? '▼ take the stairs down' : '▲ take the stairs up'}`, care: t.care };
  }

  jobTarget(rb) {
    if (rb.rogue) return null;
    let best = null, bd = Infinity;
    const consider = (x, y, label, noLabel) => { const d = Math.hypot(x - rb.x, y - rb.y); if (d < bd) { bd = d; best = { x, y, label, noLabel }; } };
    if (rb.kind === 'voxxy') { // the flashing ⚠ says what is broken: the label only shows on the stairs, from the other floor
      for (const n in this.projectors) if (this.projectors[n].broken) { const p = this.panelOf(n); consider(p.x, p.y, this.problemLabel(n), true); }
    } else if (rb.kind === 'droid') {
      const f = this.crowd.list.find(a => a.state === 'follow');
      if (f) { const d = this.roomDoor(f.room, rb); return { x: d.x, y: d.y, label: `take them to Room ${f.room}` }; }
      for (const a of this.crowd.list) if (a.kind === 'lost' && a.state === 'idle') consider(a.x, a.y, 'lost attendee');
    } else {
      for (const b of this.bags) consider(b.x, b.y, '🎒 stand by the unattended bag');
      for (const e of this.exits) consider(e.x, e.y, '🚪 stand by them: they\'ll move');
      for (const a of this.crowd.list) if (a.carried && !a.leaving && a.state === 'pester') consider(a.x, a.y, a.clingy ? `${a.pest.emoji} a fan following ${this.robots[a.target].name}: stand by them` : '🤩 stand by the fans: keep it friendly');
    }
    return best && bd > 20 ? best : null;
  }

  watchComplaints(dt) {
    for (const n in this.projectors) {
      const p = this.projectors[n];
      if (!p.broken) { p.brokenT = 0; p.complaints = 0; p.voxxyHint = false; continue; }
      if (!this.roomIdle(n)) p.brokenT += dt; // nobody complains in an empty room
      // you steer Voxxy: the AI doesn't fix things for you, so a breakdown left waiting gets a reminder (once each)
      if (this.active === 'voxxy' && !p.voxxyHint && p.brokenT > VOXXY_HINT_AFTER && !this.robots.voxxy.rogue) {
        p.voxxyHint = true;
        const where = floorOf(this.panelOf(n).y) === floorOf(this.robots.voxxy.y) ? '' : (floorOf(this.panelOf(n).y) ? ' (upstairs)' : ' (ground floor)');
        const place = this.placeOf(n);
        this.toast(`🔧 ${place[0].toUpperCase()}${place.slice(1)}${where} still ${p.what === 'toilets' ? 'need' : 'needs'} fixing. You're steering Voxxy: go to the ⚠, or switch robots and Voxxy will handle it.`, 'bad');
      }
      const due = COMPLAIN_AFTER.projector[p.complaints];
      if (due !== undefined && p.brokenT > due) { // a breakdown that drags on: someone says so out loud (nobody chases Voxxy about it)
        p.complaints++;
        const r = roomByN[n], d = r && r.doors[0], pan = this.panelOf(n);
        const [x, y] = r ? [d.x + d.w / 2, r.top ? 340 : 490] : [pan.x, pan.y + 10];
        this.float(x, y - 10, `😠 ${say(`complain_${p.what}`, { room: n, place: this.placeOf(n) })}`, '#ffb4a8', 'Unhappy attendee');
        this.satisfaction = Math.max(0, this.satisfaction - 2); // and word gets around
      }
    }
    for (const a of this.crowd.list.filter(a => a.kind === 'lost' && a.state === 'idle')) {
      // left waiting too long, the lost attendee gets impatient themselves (nobody complains on their behalf)
      if ((a.waitT = (a.waitT || 0) + dt) > COMPLAIN_AFTER.lost && !a.complained) {
        a.complained = true;
        this.float(a.x, a.y - 10, `😟 ${say('lost_waiting', { room: a.room })}`, '#ffd27a');
      }
    }
  }

  // ------------------------------------------------------------ spills and the cleaning robots
  spill() {
    if (this.spills.length >= 6) return false;
    // somebody drops it: an attendee out in an open area (not in a seat, not on the stairs), and the spill lands at their feet
    const inSpot = (x, y) => SPILL_SPOTS.some(([sx, sy, w, h]) => x >= sx && x <= sx + w && y >= sy && y <= sy + h);
    const who = this.crowd.list.filter(a => (a.kind === 'walker' || a.kind === 'nice') && !a.leaving && inSpot(a.x, a.y));
    for (let tries = 0; tries < 12 && who.length; tries++) {
      const a = who.splice((Math.random() * who.length) | 0, 1)[0];
      const sp = Math.hypot(a.vx, a.vy) || 1, px = a.x + (a.vx / sp) * 7, py = a.y + (a.vy / sp) * 7 + 3; // just in front of them
      if ([[0, 0], [12, 0], [-12, 0], [0, 12], [0, -12]].some(([ox, oy]) => solidAt(this.wallGrid, px + ox, py + oy))) continue; // not against a wall: cleaners must reach it
      const r = Math.random(), kind = r < 0.45 ? 'coffee' : r < 0.7 ? 'soda' : 'popcorn'; // soda from the fridges in the venue photos, popcorn from the lounge
      this.spills.push({ x: px, y: py, kind, t: 0 });
      a.vx *= 0.2; a.vy *= 0.2; // they stop short
      this.float(a.x, a.y - a.r - 8, say(`spill_${kind}`), '#ffd27a', 'Attendee (spilled it)');
      if (!this.spillHint) { this.spillHint = true; this.toast(`Spilled ${kind}! The cleaning robots are on it.`, 'good'); }
      return true;
    }
    return false;
  }

  // someone forgets their bag in a corridor or in the hall
  leaveBag() {
    if (this.bags.length >= 1) return; // one at a time
    for (let tries = 0; tries < 12; tries++) {
      const [x, y, w, h] = pick(OPEN_AREAS), px = rnd(x, x + w), py = rnd(y, y + h);
      if ([[0, 0], [14, 0], [-14, 0], [0, 14], [0, -14]].some(([ox, oy]) => solidAt(this.wallGrid, px + ox, py + oy))) continue;
      this.bags.push({ x: px, y: py, t: 0, checkT: 0, complained: false });
      const where = floorOf(py) ? '' : ' (ground floor)';
      this.toast(this.bagHint ? `An unattended bag 🎒${where}!`
        : this.active === 'biggy' ? `Unattended bag 🎒${where}! Stand Biggy next to it.`
        : `Unattended bag 🎒${where}! Biggy will check it.`, 'bad');
      this.bagHint = true;
      return;
    }
  }
  // attendees sit down on the stairs or chat in the entrance, blocking the way: Biggy asks them to move
  blockExit() {
    if (this.exits.length >= 1) return; // one at a time
    const free = exitSpots.filter(s => !this.bags.some(b => Math.hypot(b.x - s.x, b.y - s.y) < 60));
    if (!free.length) return;
    const s = pick(free);
    this.exits.push({ x: s.x, y: s.y, where: s.where, t: 0, checkT: 0, complained: false, n: Math.random() < 0.4 ? 3 : 2 });
    const floor = floorOf(s.y) ? '' : ' (ground floor)';
    this.toast(this.exitHint ? `🚪 People sitting ${s.where}${floor}`
      : this.active === 'biggy' ? `🚪 People sitting ${s.where}${floor}! Stand Biggy next to them.`
      : `🚪 People sitting ${s.where}${floor}! Biggy will ask them to move.`, 'bad');
    this.exitHint = true;
  }
  // Biggy standing by a bag or a blocked stairway: a security check, and it costs Biggy some energy
  securityCheck(b, dt) {
    const big = this.robots.biggy;
    const near = !big.rogue && floorOf(big.y) === floorOf(b.y) && Math.hypot(big.x - b.x, big.y - b.y) < big.r + 26 && big.speed < 45; // walking by at a steady pace counts
    b.checkT = near ? b.checkT + dt : Math.max(0, b.checkT - dt);
    if (near) big.patience = Math.max(0, big.patience - SECURITY_STRAIN * dt);
    return b.checkT >= BAG_CHECK;
  }
  updateExits(dt) {
    for (const e of [...this.exits]) {
      e.t += dt;
      if (e.t > 8) this.satisfaction = Math.max(0, this.satisfaction - EXIT_UNEASE * dt);
      if (e.t > COMPLAIN_AFTER.bag && !e.complained) { e.complained = true; this.float(e.x + 14, e.y - 16, `😟 ${say('complain_exit')}`, '#ffd27a', 'Attendee trying to get past'); }
      if (this.securityCheck(e, dt)) {
        this.exits.splice(this.exits.indexOf(e), 1);
        this.stats.exits++;
        this.satisfaction = Math.min(100, this.satisfaction + 3);
        this.float(e.x, e.y - 14, say('exit_move'), '#7bdc6b', 'Attendee on the stairs');
        audio.chime();
      }
    }
  }
  updateBags(dt) {
    for (const b of [...this.bags]) {
      b.t += dt;
      if (b.t > 10) this.satisfaction = Math.max(0, this.satisfaction - BAG_UNEASE * dt); // after a while, people keep glancing at it
      if (b.t > COMPLAIN_AFTER.bag && !b.complained) { b.complained = true; this.float(b.x + 10, b.y - 16, `😟 ${say('complain_bag')}`, '#ffd27a', 'Attendee near the bag'); } // one remark out loud, nobody chases Biggy about it
      if (this.securityCheck(b, dt)) { // the owner turns up
        this.bags.splice(this.bags.indexOf(b), 1);
        this.stats.bags++;
        this.satisfaction = Math.min(100, this.satisfaction + 3);
        this.float(b.x, b.y - 12, say('bag_owner'), '#7bdc6b', 'Bag owner');
        audio.chime();
      }
    }
  }

  updateSpills(dt) {
    // people who walk through a spill grumble, and now and then slip
    for (const s of this.spills) {
      s.t += dt;
      this.crowd.forEachNear(s.x, s.y, 10, a => {
        if (a.state !== 'walk' || a.bumpCD > 0 || Math.hypot(a.x - s.x, a.y - s.y) > 8) return;
        a.bumpCD = 3;
        if (Math.random() < 0.3) { a.state = 'stumble'; a.timer = 0.8; this.float(a.x, a.y - 8, say('slip'), '#ffd27a'); }
      });
    }
    for (const c of this.cleaners) {
      if (c.target && !this.spills.includes(c.target)) c.target = null;
      if (!c.target) { // the nearest spill no other cleaner is on
        let best = null, bd = Infinity;
        for (const s of this.spills) if (floorOf(s.y) === floorOf(c.y) && !this.cleaners.some(o => o.target === s)) { const d = Math.hypot(s.x - c.x, s.y - c.y); if (d < bd) { bd = d; best = s; } }
        c.target = best; c.cleanT = 0;
      }
      let v = { x: 0, y: 0 };
      if (c.target) {
        const d = Math.hypot(c.target.x - c.x, c.target.y - c.y);
        if (d > 10) v = this.clear(c, this.pathTo(c, c.target.x, c.target.y));
        else if ((c.cleanT += dt) >= CLEAN_TIME) {
          this.spills.splice(this.spills.indexOf(c.target), 1);
          this.stats.cleaned++;
          this.satisfaction = Math.min(100, this.satisfaction + 1);
          this.float(c.x, c.y - 10, '✨ clean', '#9fdcff', 'Cleaning robot');
          c.target = null;
        }
      } else { // nothing to mop: its rounds
        const [wx, wy] = c.route[c.round.i % c.route.length];
        if (Math.hypot(wx - c.x, wy - c.y) < 30) c.round.i++;
        v = this.clear(c, this.pathTo(c, wx, wy));
      }
      const k = Math.min(1, dt * 6);
      c.vx += (v.x * CLEANER_SPEED - c.vx) * k; c.vy += (v.y * CLEANER_SPEED - c.vy) * k;
      moveCircle(this.wallGrid, c, dt);
      if (Math.hypot(c.vx, c.vy) > 3) c.heading = Math.atan2(c.vy, c.vx);
      c.spin += dt * (c.cleanT > 0 ? 18 : 6);
    }
  }

  // ------------------------------------------------------------ toilets
  // at the toilets: into the line outside the door of the nearest women's or men's (a stall frees up now and then). A blocked
  // one is no use: on they go
  toiletFor(a) { // the nearest women's or men's on this floor
    const side = a.dest.slice(3);
    return toilets.filter(t => t.sides.includes(side) && floorOf(t.queue[side].y) === floorOf(a.y))
      .sort((p, q) => Math.hypot(p.queue[side].x - a.x, p.queue[side].y - a.y) - Math.hypot(q.queue[side].x - a.x, q.queue[side].y - a.y))[0];
  }
  toiletLineEnd(a) { // where someone joins the line: its end
    const t = this.toiletFor(a), side = a.dest.slice(3);
    if (!t) return null;
    const Q = t.queue[side], n = this.wcQueue[`${t.id}:${side}`]?.length || 0;
    return { x: Q.x + Q.dx * n, y: Q.y + Q.dy * n };
  }
  toiletArrive(a) {
    const side = a.dest.slice(3), t = this.toiletFor(a);
    a.stop = a.dest;
    if (!t || this.projectors[`toilets:${t.id}`].broken) { this.afterToilet(a); return; }
    (this.wcQueue[`${t.id}:${side}`] ||= []).push(a); a.state = 'queue';
  }
  afterToilet(a) { a.state = 'walk'; a.dest = a.final === 'hang' ? this.nextHangout(a) : a.final; }
  // the lines move up when a stall frees; in a stall, people are off the map (a while longer on the women's side, the men's have
  // urinals), then come back out of the door. The lines take the time they take: the talk starts without them
  updateToilets() {
    let left = false;
    for (let i = this.wcInside.length - 1; i >= 0; i--) {
      const w = this.wcInside[i];
      if (this.t < w.until) continue;
      this.wcInside.splice(i, 1);
      const [dx, dy, dw, dh] = w.t.door;
      Object.assign(w.a, { x: dx + dw / 2, y: dy + dh / 2, vx: 0, vy: 0 }); this.afterToilet(w.a); this.crowd.list.push(w.a);
    }
    for (const t of toilets) for (const side of t.sides) {
      const key = `${t.id}:${side}`, q = this.wcQueue[key], Q = t.queue[side];
      if (!q?.length) continue;
      if (this.projectors[`toilets:${t.id}`].broken) { for (const a of q) this.afterToilet(a); q.length = 0; continue; }
      // first come, first served, among those at the door: someone jostled back doesn't block the line, and neither does someone
      // further back who ended up at the door (in a line against a wall, they could not swap places)
      const k = q.findIndex(a => Math.hypot(a.x - Q.x, a.y - Q.y) < 12);
      if (this.wcInside.filter(w => w.key === key).length < t.stalls[side] && k >= 0) {
        const a = q.splice(k, 1)[0], L = this.crowd.list, i = L.indexOf(a);
        if (i >= 0) { L[i] = L[L.length - 1]; L.pop(); left = true; }
        this.wcInside.push({ a, key, t, until: this.t + (side === 'F' ? rnd(2.5, 4) : rnd(1.5, 2.5)) });
      }
      q.forEach((a, k) => { a.qx = Q.x + Q.dx * k; a.qy = Q.y + Q.dy * k; });
    }
    if (left) this.crowd.rebuild(); // people went into a stall: refresh the spatial index before anyone looks it up
  }

  // ------------------------------------------------------------ rooms and breakdowns
  // just inside the door of a room nearest to the robot: where Droid brings people, who then go in on their own (under the back rows)
  roomDoor(n, rb) {
    const r = roomByN[n], d = r.doors.reduce((a, b) => Math.hypot(b.x + b.w / 2 - rb.x, b.y - rb.y) < Math.hypot(a.x + a.w / 2 - rb.x, a.y - rb.y) ? b : a);
    return { x: d.x + d.w / 2, y: r.top ? r.y1 - 12 : r.y0 + 12 };
  }
  panelOf(n) {
    if (SPOTS[n]) return { x: SPOTS[n].panel[0], y: SPOTS[n].panel[1] };
    const r = roomByN[n]; return { x: r.cx, y: r.top ? r.y1 - 13 : r.y0 + 13 }; // in the projection room, along the back wall
  }
  nearTable(o) { // touching a standing table (distance from the robot's edge to the table's edge)
    if (floorOf(o.y) !== 1) return false;
    return tables.some(([x, y, w = TABLE_W]) => Math.hypot(Math.max(x - o.x, 0, o.x - x - w), Math.max(y - o.y, 0, o.y - y - TABLE_H)) < o.r + TABLE_REACH);
  }
  // Monday's scripted moment: a robot you're not steering gets overwhelmed by the crowd
  firstWobble() {
    const v = this.robots[this.active === 'droid' ? 'voxxy' : 'droid'];
    if (v.rogue) return;
    v.patience = Math.min(v.patience, 45); this.wobble = v; this.stressHint = true;
    this.float(v.x, v.y - v.r - 12, '😓 so much work…', '#ff9f9f', v.name);
    this.toast(this.active
      ? `${v.name} is running low 😓 ${this.showArrow === false ? 'Go and stay with it.' : 'Follow the green arrow.'}`
      : `${v.name} is running low 😓`, 'bad', true); // Monday's lesson: shown at once
  }
  // you stayed with a robot in trouble (counted once per stretch of holding E, not every frame)
  noteStay(o) {
    if (this.t - (o.stayT ?? -99) > 4) {
      this.stats.stayed++; this.stays.push({ kind: o.kind, name: o.name, clock: this.clock.text, calm: Math.round(o.patience), rogue: o.rogue });
      this.float(o.x, o.y - o.r - 14, `😌 ${say('comforted')}`, '#7bdc6b', o.name); // it hadn't noticed how tired it was
    }
    o.stayT = this.t;
    if (this.dip[o.kind]) this.dip[o.kind].helped = true;
  }
  toiletsOut(side) { return toilets.every(t => !t.sides.includes(side) || this.projectors[`toilets:${t.id}`].broken); } // every women's (F) or men's (M) toilets out of order
  placeOf(n) { return SPOTS[n]?.place || `Room ${n}`; }
  // what the arrow and the hold-E hint say: what is wrong, for the guide arrow ("Mic broken, Room 4"); how to fix it, on the
  // spot ("hold E: fix the mic")
  problemLabel(n) { const i = INCIDENTS[this.projectors[n].what], s = SPOTS[n]; return `${i?.problem || 'Broken'}${!s ? `, Room ${n}` : /^(booth|bof):/.test(n) ? `, ${s.short}` : ''}`; }
  fixLabel(n) { const p = this.projectors[n], i = INCIDENTS[p.what]; return `${i?.verb || 'fix'}, ${SPOTS[n]?.short || `Room ${n}`}${p.fixT > 0 && p.fix >= TRICKY ? ' · a tricky one!' : ''}`; }

  breakProjector(n, what) {
    const p = this.projectors[n];
    if (p.broken) return;
    p.broken = true; p.fixT = 0;
    p.what = what || SPOTS[n]?.what || pick(ROOM_INCIDENTS);
    p.fix = rollFix(p.what); // how long this one takes: found out once Voxxy is on it
    const how = this.projHint ? '' : this.active === 'voxxy' ? ' Go to the ⚠.' : ' Voxxy is on it.';
    this.projHint = true; // explain it once, then just say where
    const where = floorOf(this.panelOf(n).y) ? '' : ' (ground floor)', place = this.placeOf(n);
    this.toast(p.what === 'coffee' ? `${place[0].toUpperCase()}${place.slice(1)} is empty! ☕${where}${how}`
      : SPOTS[n] && SPOTS[n].what ? `${INCIDENTS[p.what].name}: ${place}${where}!${how}`
      : `${INCIDENTS[p.what].name} in ${place}${where}!${how}`, 'bad');
    audio.clunk();
  }

  // ------------------------------------------------------------ tick
  update(dt, input) {
    if (this.over) return;
    this.t += dt;

    // the day's director: trouble arrives faster as the day goes on
    const k = this.t / this.day.seconds, tr = this.day.trouble; // later in the day, and later in the week: more trouble
    const fresh = this.day.newcomers ?? 1; // first-timers get lost, and want selfies
    if ((this.next.lost -= dt) <= 0) { this.spawnLost(); this.next.lost = (rnd(9, 14) - k * 4) / (tr * fresh); }
    if ((this.next.pest -= dt) <= 0) { this.spawnPest(); if (k > 0.5 && Math.random() < k - 0.45) this.spawnPest(); this.next.pest = (rnd(9, 13) - k * 3.5) / (tr * fresh * (this.day.fans ?? 1)); }
    if ((this.next.projector -= dt) <= 0) {
      const downstairs = Math.random() < 0.4; // upstairs a Devoxx room; downstairs a booth, a BOF room or the badge printer
      const ok = (downstairs ? GROUND_SPOTS : rooms.map(r => r.n)).filter(n => !this.projectors[n].broken && !(this.boothsEmpty && n.startsWith?.('booth:')));
      if (ok.length) this.breakProjector(pick(ok));
      this.next.projector = (rnd(20, 28) - k * 8) / tr;
    }
    if ((this.next.coffee -= dt) <= 0) { // either coffee machine, upstairs or in the hall
      const dry = ['coffee', 'coffee:hall'].filter(n => !this.projectors[n].broken);
      if (dry.length) this.breakProjector(pick(dry));
      this.next.coffee = (rnd(30, 44) - k * 10) / tr;
    }
    if (this.next.wobble !== undefined && (this.next.wobble -= dt) <= 0) { delete this.next.wobble; this.firstWobble(); }
    if (this.wobble && (this.wobble.rogue || this.wobble.patience >= STRESSED)) {
      if (!this.wobble.rogue) this.toast(this.t - (this.wobble.stayT ?? -99) < 5 ? `${this.wobble.name} has its energy back 💛 That's the game: they do the work, you keep them going.` : `${this.wobble.name} has its energy back.`, 'good');
      this.wobble = null;
    }
    if (this.next.bag === undefined) this.next.bag = rnd(70, 90) / tr; // the first bag comes once the day has settled in
    if ((this.next.bag -= dt) <= 0) { this.leaveBag(); this.next.bag = (rnd(60, 80) - k * 10) / tr; } // rare: every trip Biggy makes to a bag leaves the others without security
    this.updateBags(dt);
    if (this.next.exit === undefined) this.next.exit = rnd(45, 60) / tr;
    if ((this.next.exit -= dt) <= 0) { this.blockExit(); this.next.exit = (rnd(50, 70) - k * 8) / tr; }
    this.updateExits(dt);
    if ((this.next.spill -= dt) <= 0) this.next.spill = this.spill() ? (rnd(12, 18) - k * 4) / tr : 2; // nobody around to drop anything: try again shortly
    // the exhibitors leave (Thursday afternoon, and all of Friday): the booths go dark, nothing left to fix there
    if (!this.boothsEmpty && (this.day.boothsGone || (this.day.boothsLeave && k >= this.day.boothsLeave))) {
      this.boothsEmpty = true;
      for (const b of booths) Object.assign(this.projectors[`booth:${b.id}`], { broken: false, fixT: 0, complaints: 0 });
      if (!this.day.boothsGone) this.toast('The exhibitors are packing up: the booths are empty.', 'good');
    }
    this.updateSchedule();
    this.updateToilets();
    // the morning: people come in by the main entrance, until 9:00
    const A = this.arriving;
    if (A && A.done < A.total) {
      const due = Math.min(A.total, Math.round(A.total * Math.min(1, this.t / A.until)));
      for (; A.done < due; A.done++) { const [x, y, w, h] = ARRIVALS[3]; this.spawnWalker(rnd(x, x + w), rnd(y, y + h)); }
    }
    // people coming back out of talks
    for (let i = this.pool.length - 1; i >= 0; i--) if (this.pool[i].t <= this.t) {
      const s = roomByN[this.pool[i].room].seats;
      this.spawnWalker(rnd(s.x + 6, s.x + s.w - 6), rnd(s.y + 6, s.y + s.h - 6));
      this.pool.splice(i, 1);
    }

    // at the door of their room, the people Droid brought go in on their own
    for (const a of this.crowd.list) if (a.state === 'follow') {
      const r = roomByN[a.room], d = r.doors.find(d => a.x > d.x - 6 && a.x < d.x + d.w + 6 && Math.abs(a.y - (r.top ? r.y1 : r.y0)) < 20);
      if (d) { a.state = 'walk'; a.dest = a.final = `room:${a.room}`; }
    }

    // robots
    for (const rb of this.robotList) {
      let ix = 0, iy = 0;
      // the robot you steer only ever does what you do; the other two are driven by their AI,
      // except while you stay with one (hold E next to it): then it stops, for a moment, and gets its energy back
      const withYou = rb.kind !== this.active && this.t - (rb.stayT ?? -99) < 0.25;
      if (withYou) { if (!rb.rogue) rb.task = 'taking a break with you'; }
      else if (rb.rogue) ({ x: ix, y: iy } = this.clear(rb, this.giveWay(rb, this.rogueInput(rb))));
      else if (rb.kind === this.active) { ix = input.x; iy = input.y; rb.task = 'you'; }
      else ({ x: ix, y: iy } = this.clear(rb, this.giveWay(rb, this.autoInput(rb))));
      if (rb.away > 0) { ix = iy = 0; rb.away -= dt; } // on the stairs for a moment
      rb.update(dt, ix, iy, this.wallGrid, this.fx);
      const meansIt = rb.kind === this.active || rb.viaStairs > this.t - 0.3; // you walked onto them, or the AI is heading for the other floor
      if (meansIt && this.takeStairs(rb, dt, 0.8)) { rb.trail.length = 0; if (rb.kind === this.active) { audio.stairs(rb.climb.up); this.viewOverride = null; } }
    }
    const L = this.robotList;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) collide(this.wallGrid, L[i], L[j], L[i].mass, L[j].mass);

    // worn-out robots come back on a charging base,
    // and much faster with a friend staying next to them (hold E)
    const me = this.robots[this.active];
    this.holdTarget = null;
    for (const o of L) if (o.rogue) {
      let around = 0;
      this.crowd.forEachNear(o.x, o.y, REST_RADIUS, a => { if (Math.hypot(a.x - o.x, a.y - o.y) < REST_RADIUS) around++; });
      o.resting = around <= REST_MAX;
      // it recharges on a charging base, or with you staying next to it (it stops for you); walking there, it only walks
      let heal = this.inLounge(o) ? LOUNGE_HEAL : 0;
      const near = me && me !== o && !me.rogue && Math.hypot(o.x - me.x, o.y - me.y) < o.r + me.r + 14; // someone else has to stay with it
      if (near) {
        this.holdTarget = { kind: 'reassure', rb: o };
        if (input.hold) { heal += me.kind === 'biggy' ? 30 : 20; o.helped = true; this.noteStay(o); } // Biggy is the most reassuring
      }
      o.patience = Math.min(100, o.patience + heal * dt);
      o.rebootT = o.patience / 40;
      if (o.patience >= 40) {
        o.rogue = false; o.rebootT = 0;
        this.stats.reboots++;
        this.float(o.x, o.y - 22, '🔋 40%? Plenty! Back to work!', '#7bdc6b', o.name);
        this.toast(o.kind === this.active ? `${o.name} is recharged: it's yours again.` : o.helped ? `${o.name} is back to work. Thanks!` : `${o.name} recharged and is back to work.`, 'good');
        o.helped = false;
        audio.chime();
      }
    }
    // company helps before it gets that far: stay next to a tired friend (hold E) and it fills up, all the way to 100%
    const comfort = below => {
      if (!me || this.holdTarget || me.rogue) return;
      const friend = L.filter(o => o !== me && !o.rogue && o.patience < below && Math.hypot(o.x - me.x, o.y - me.y) < o.r + me.r + 14)
        .sort((a, b) => a.patience - b.patience)[0];
      if (!friend) return;
      this.holdTarget = { kind: 'reassure', rb: friend };
      if (input.hold) {
        this.noteStay(friend);
        friend.patience = Math.min(100, friend.patience + (me.kind === 'biggy' ? COMFORT_BIGGY : COMFORT) * dt);
        me.patience = Math.min(100, me.patience + COMFORT_SELF * dt); // company works both ways
        if (Math.random() < dt * 1.5) this.float(friend.x + rnd(-6, 6), friend.y - friend.r - 6, '😌', '#7bdc6b');
      }
    };
    comfort(STRESSED); // a stressed friend comes before a repair…
    const tech = this.robots.voxxy; // the fast one fixes the projectors
    if (!tech.rogue && (tech !== me || !this.holdTarget)) {
      const manual = tech === me;
      for (const n in this.projectors) {
        const p = this.projectors[n];
        if (!p.broken) continue;
        const pos = this.panelOf(n);
        if (Math.hypot(pos.x - tech.x, pos.y - tech.y) > 28) continue;
        if (manual) this.holdTarget = { kind: 'fix', room: n, p };
        if (!manual || input.hold) {
          const teamwork = L.some(o => o !== tech && !o.rogue && Math.hypot(o.x - tech.x, o.y - tech.y) < 48);
          if (p.fixT === 0 && p.fix >= TRICKY) this.float(pos.x, pos.y - 24, { toilets: '🚽 this one is stubborn…', wifi: '📶 needs a full reboot…', coffee: '☕ the grinder is stuck too…' }[p.what] || '🔧 a tricky one…', '#ffd27a', 'Voxxy (robot)');
          p.fixT += dt * (teamwork ? 1.35 : 1.0) / (p.fix || 1); // fixT: 0 → 1; teamwork makes fixing 35% faster
          tech.workingT = this.t; // a stubborn repair is tiring
          if (teamwork && Math.random() < dt * 1.5) this.float(pos.x, pos.y - 20, '⚡ Teamwork!', '#7bdc6b');
          if (p.fixT >= 1) {
            p.broken = false; p.fixT = 0; this.stats.fixed++;
            this.satisfaction = Math.min(100, this.satisfaction + 6);
            this.float(pos.x, pos.y - 12, { coffee: 'Coffee is back! ☕', popcorn: 'Popcorn is popping again! 🍿', booth: 'Power is back!', badges: 'Badges are printing again!', toilets: 'Toilets working again! 🚽' }[p.what] || `${this.placeOf(n)} is back on!`, '#7bdc6b', 'Game (repair done)');
            audio.chime(); if (manual) input.consumeHold();
          }
        }
        break;
      }
    }
    comfort(100); // …one that is only a bit low comes after it

    // Coffee machine speed boost: stopping near an operational coffee machine
    for (const rb of L) {
      if (rb.rogue || rb.coffeeBoost > 0) continue;
      const nearCoffee = Object.entries(SPOTS).some(([n, s]) => s.what === 'coffee' && !this.projectors[n].broken && Math.hypot(s.panel[0] - rb.x, s.panel[1] - rb.y) < 26);
      if (nearCoffee && rb.speed < 15) {
        if ((rb.coffeeTimer = (rb.coffeeTimer || 0) + dt) >= 0.8) {
          rb.coffeeBoost = 6.0; rb.coffeeTimer = 0;
          this.float(rb.x, rb.y - rb.r - 12, '☕ Espresso Boost!', '#ffd27a', rb.name);
          audio.chime();
        }
      } else { rb.coffeeTimer = 0; }
    }

    this.crowd.update(dt);
    this.crowd.rebuild(); // arrivals removed people: refresh the spatial index before anyone looks it up
    this.updateSpills(dt);
    this.watchComplaints(dt);
    this.deterPests(dt);
    this.updateMood(dt);

    // the conference suffers from every unsolved problem
    let drain = 0;
    for (const a of this.crowd.list) if (a.kind === 'lost' && a.state === 'idle') drain += 0.055;
    for (const n in this.projectors) if (this.projectors[n].broken) drain += this.roomIdle(n) ? 0.1 : 0.3; // an empty room: it bothers nobody until its next talk
    for (const rb of L) if (rb.rogue) drain += 1.2; // its work isn't being done
    drain += this.spills.length * SPILL_DRAIN;
    this.satisfaction = Math.max(0, this.satisfaction - drain * dt);

    // nav upkeep
    this.rebuildCost();
    if ((this.navTick = (this.navTick || 0) + 1) % 3 === 0) {
      this.computeField(FIELD_KEYS[this.fieldCursor]);
      this.fieldCursor = (this.fieldCursor + 1) % FIELD_KEYS.length;
    }

    this.shake *= Math.exp(-8 * dt);
    this.floaters = this.floaters.filter(f => (f.t += dt / (this.timeScale || 1)) < f.life); // real time: as readable at ×2 as at ×1
    this.flashes = this.flashes.filter(f => (f.t += dt) < 0.25);

    for (const rb of L) {
      const v = rb.rogue ? 0 : rb.patience;
      if (v < this.lowest[rb.kind]) { this.lowest[rb.kind] = v; this.lowestAt[rb.kind] = this.clock.text; }
      const d = this.dip[rb.kind];
      if (v < ALONE_BELOW && !d) this.dips.push(this.dip[rb.kind] = { kind: rb.kind, name: rb.name, clock: this.clock.text, low: Math.round(v), helped: this.t - (rb.stayT ?? -99) < 5 });
      else if (d && v < d.low) d.low = Math.round(v);
      else if (d && v >= ALONE_BELOW + 10) delete this.dip[rb.kind]; // back up: the next dip is a new one
    }
    if (L.every(r => r.rogue)) this.finish('revolt');
    else if (this.satisfaction <= 0) this.finish('chaos');
    else if (this.t >= this.day.seconds) this.finish('day');
  }

  rebuildCost() {
    const dens = this.crowd.density, ema = this.densEMA;
    for (let c = 0; c < N; c++) {
      ema[c] += (dens[c] - ema[c]) * 0.012;
      const p = Math.max(0, ema[c] - 0.8);
      this.cost[c] = 1 + p * 1.2 + p * p * 0.8;
    }
  }

  get fx() {
    return {
      step: rb => {
        // only the robot you steer, each with its own sound (the AI's robots, heard all the time, sounded like a heartbeat)
        if (rb.kind !== this.active || floorOf(rb.y) !== this.viewFloor()) return;
        if (rb.kind === 'biggy' && rb.speed > 12) { audio.stomp(0.3 + rb.speed / 160); this.shake = Math.max(this.shake, rb.speed / 60); }
        else if (rb.kind === 'droid' && rb.speed > 8) audio.servo();
        else if (rb.kind === 'voxxy' && rb.speed > 15) audio.patter();
      },
      wallHit: (rb, imp) => {
        if (rb.kind === 'biggy') { audio.thud(Math.min(1, imp / 60)); this.shake = Math.max(this.shake, imp / 12); }
        else audio.tick();
      },
    };
  }

  // the floor on screen: one you chose (F), else the robot you follow (👁), else the one you steer
  viewFloor() { const k = this.follow || this.active; return this.viewOverride ?? (k ? floorOf(this.robots[k].y) : 1); }
  // look at a floor; looking at your own robot's floor means following it again
  lookAt(floor) { this.viewOverride = this.active && floor === floorOf(this.robots[this.active].y) ? null : floor; }

  action() {
    const rb = this.robots[this.active];
    if (!rb || rb.rogue) return; // watching, or your robot is recharging
    if (rb.kind === 'droid' && !this.holdTarget) { // E next to a friend means "stay with it", not "wait here"
      const f = this.crowd.list.filter(a => a.state === 'follow');
      if (f.length) { f.forEach(a => { a.state = 'idle'; a.homeX = a.x; a.homeY = a.y; }); this.float(rb.x, rb.y - 14, 'wait here!', '#ffb050', rb.name); }
      else { audio.chirp(); this.float(rb.x, rb.y - 14, 'beep-boop!', '#ffb050', rb.name); }
    }
  }

  get clock() {
    const { seconds } = this.day, [eh, em] = this.day.end.split(':').map(Number), end = eh + em / 60;
    const mins = DAY_START + Math.min(1, this.t / seconds) * (end * 60 - DAY_START); // 08:30 → the day's end (20:00 on the Deep Dive days, 12:40 on Friday)
    return { text: `${Math.floor(mins / 60)}:${String(Math.floor(mins % 60)).padStart(2, '0')}`, left: Math.max(0, seconds - this.t) };
  }

  finish(reason) {
    this.over = true;
    const s = Math.round(this.satisfaction); // the figure the results screen shows and ticks
    // one star per objective, each on its own: you made it to closing time, no robot wore out, the attendees are 75% happy
    const stars = reason !== 'day' ? 0 : 1 + (this.stats.revolts ? 0 : 1) + (s >= 75 ? 1 : 0);
    const alone = this.dips.filter(d => !d.helped); // ran down, and nobody came (in the day's log; it costs no star)
    const lowest = Object.fromEntries(Object.entries(this.lowest).map(([k, v]) => [k, Math.round(v)]));
    this.result = { reason, day: this.dayIndex, satisfaction: s, stars, time: this.clock.text, lowest, lowestAt: { ...this.lowestAt }, stays: this.stays, alone, ...this.stats };
    audio.gong();
    this.ui.roundOver(this.result);
  }
}
