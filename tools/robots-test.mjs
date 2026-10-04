// Scripted checks of every robot verb in Overclocked.
import { Game } from '../src/game.js';
import { GROUND, floorOf, toilets, serviceDoorDefs, roomByN, tables, exitSpots } from '../src/level.js';
import { solidAt, blockedCircle } from '../src/physics.js';
import { SPECS } from '../src/robots.js';
import { seed } from './rng.mjs';
seed(5);
const g = new Game({ toast() {}, roundOver() {} });
g.start();
const input = { x: 0, y: 0, hold: false, consumeHold() { this.hold = false; } };
const step = n => { for (let i = 0; i < n; i++) g.update(1 / 60, input); };
const drive = (rb, tx, ty, secs) => { g.active = rb.kind; for (let i = 0; i < secs * 60; i++) { const dx = tx - rb.x, dy = ty - rb.y, l = Math.hypot(dx, dy); input.x = l > 5 ? dx / l : 0; input.y = l > 5 ? dy / l : 0; g.update(1 / 60, input); } input.x = input.y = 0; };
const { voxxy: v, droid: d, biggy: b } = g.robots;
const check = (name, ok) => { console.log(ok ? 'PASS' : 'FAIL', name); if (!ok) process.exitCode = 1; }; // npm test fails when a check does

// Voxxy, the technician, fixes a projector
g.breakProjector(4); const pan = g.panelOf(4); v.x = pan.x; v.y = pan.y - 30; g.active = 'voxxy'; // inside the room, a few rows from the projection room
const fixed0 = g.stats.fixed; // (the day may break Room 4 again right after: count the repair instead)
drive(v, pan.x, pan.y - 8, 3); input.hold = true; step(60 * 5.5); input.hold = false; // up to 5 s (a stubborn Wi-Fi)
check('Voxxy fixes Room 4 projector', g.stats.fixed > fixed0);

// Droid, the guide: a lost attendee follows it
d.vx = d.vy = 0; // Droid was on its rounds: it stops by them
const lo = g.crowd.spawn(d.x + d.r + 5, d.y, 'lost', { state: 'idle', room: 5, dest: 'room:5', final: 'room:5' });
g.active = 'droid'; step(20);
check('a lost attendee follows Droid', lo.state === 'follow');

// a selfie fan goes for Droid, Droid's calm drops; Biggy (security) turns up and the fan gives up
b.x = 60; b.y = 420; // Biggy out of the way first
const k = g.spawnPest('selfie', 'droid'); k.x = d.x + 20; k.y = d.y; k.acts = -99; g.active = 'droid';
const p0 = d.patience; step(120);
check(`a selfie fan drains Droid (${p0.toFixed(0)} → ${d.patience.toFixed(0)})`, d.patience < p0);
for (let i = 0; i < 150 && !k.leaving; i++) { b.x = k.x + 18; b.y = k.y + 18; b.vx = b.vy = 0; step(1); }
check('the selfie fan gives up when Biggy turns up', k.leaving === true);
k.x = 60; k.y = 420; // out of the way for the next checks

// Voxxy wears out; Droid stays with it until it is back
v.patience = -1; step(1); // drained (a heal this frame must not save it)
check('Voxxy is worn out at zero energy', v.rogue);
check('control switches away from a worn-out robot', g.active !== 'voxxy');
for (let i = 0; i < 600 && v.rogue; i++) { d.x = v.x - 18; d.y = v.y; g.active = 'droid'; input.hold = true; g.update(1 / 60, input); }
input.hold = false;
check('Droid stays with the worn-out Voxxy until it is back', !v.rogue);

// a friend staying next to a tired robot gives it energy back before it wears out
g.crowd.list.length = 0; g.crowd.rebuild(); v.patience = 40; v.x = 1200; v.y = 470; v.vx = v.vy = 0; d.x = v.x - 20; d.y = v.y; d.vx = d.vy = 0; g.active = 'droid'; input.hold = true;
const s0 = v.patience; step(60); input.hold = false; // Voxxy (AI) leaves its rounds for a moment while Droid stays with it
const vMoved = Math.hypot(v.x - 1200, v.y - 470);
check(`Droid stays with a tired Voxxy: it stops and gets energy back (energy ${s0.toFixed(0)} → ${v.patience.toFixed(0)}, moved ${vMoved.toFixed(1)})`, v.patience > s0 + 12 && !v.rogue && vMoved < 4);

// Biggy gets to the charging base in the lounge: drive it from the corridor to the sofas at the top
g.crowd.list.length = 0; g.crowd.rebuild(); b.x = 1250; b.y = 440; b.vx = b.vy = 0; b.patience = 100;
for (const o of [v, d]) { o.x = 300; o.y = 415 + (o === v ? 20 : -20); } // out of the doorway (they do their rounds on AI)
drive(b, 1410, 350, 8);
check(`Biggy reaches the charging base in the lounge (x ${b.x.toFixed(0)})`, g.inLounge(b));

// a projector left broken: someone says so out loud, and it costs satisfaction, but nobody chases Voxxy about it
g.crowd.list.length = 0; g.crowd.rebuild(); for (const n in g.projectors) g.projectors[n].broken = false; g.floaters.length = 0;
v.x = 300; v.y = 415; g.active = 'voxxy'; g.breakProjector(9); const sat0 = g.satisfaction;
for (let i = 0; i < 60 * 14; i++) { v.x = 300; v.y = 415; g.update(1 / 60, input); }
check('a breakdown left too long makes someone say so out loud', g.floaters.some(f => f.text.startsWith('😠')) && g.satisfaction < sat0);
check('…but nobody follows Voxxy around to complain', !g.crowd.list.some(a => a.problem));
g.projectors[9].broken = false; step(2);

// a button presser who pressed them all leaves Voxxy alone, without Biggy
g.crowd.list.length = 0; g.crowd.rebuild(); b.x = 60; b.y = 420; v.x = 900; v.y = 420; v.patience = 100; g.active = 'voxxy';
const day0 = g.day; g.day = { ...day0, crowd: 0 }; // nobody gets carried away this time (that is checked further down)
const sf = g.spawnPest('poker', 'voxxy'); sf.x = v.x + v.r + 7; sf.y = v.y;
for (let i = 0; i < 60 * 8 && !sf.leaving; i++) { v.x = 900; v.y = 395; v.vx = v.vy = 0; step(1); }
g.day = day0;
check(`a button presser leaves once they have pressed them all (${sf.acts} pressed)`, sf.leaving === true && sf.acts === 3);

// the badge printer at reception jams: Voxxy goes down and fixes it
g.crowd.list.length = 0; g.crowd.rebuild(); g.breakProjector('badges'); const bpan = g.panelOf('badges');
v.x = bpan.x + 30; v.y = bpan.y; v.vx = v.vy = 0; g.active = 'voxxy';
const fixedB = g.stats.fixed; // (count the repair: the day may break it again right after)
drive(v, bpan.x + 4, bpan.y, 2); input.hold = true; step(60 * 4); input.hold = false;
check('Voxxy fixes the badge printer at reception (ground floor)', g.stats.fixed > fixedB);

// the coffee machine runs empty: Voxxy refills it
g.crowd.list.length = 0; g.crowd.rebuild(); g.breakProjector('coffee'); const cpan = g.panelOf('coffee');
v.x = cpan.x; v.y = cpan.y + 30; v.vx = v.vy = 0; g.active = 'voxxy';
drive(v, cpan.x, cpan.y + 6, 3); input.hold = true;
for (let i = 0; i < 60 * 3.5 && g.projectors.coffee.broken; i++) { v.x = cpan.x; v.y = cpan.y + 6; v.vx = v.vy = 0; step(1); } input.hold = false; // stay at the machine
check('Voxxy refills the coffee machine', !g.projectors.coffee.broken);

// the stairs link the floors: Voxxy walks onto the stairs and comes out on the ground floor
g.crowd.list.length = 0; g.crowd.rebuild(); v.rogue = false; v.patience = 100; v.x = 140; v.y = 415; v.vx = v.vy = 0;
drive(v, 60, 415, 1.5);
check(`Voxxy takes the stairs down to the ground floor (y ${v.y | 0})`, v.y > GROUND);

// a lost attendee at reception, on the ground floor: Droid (AI) goes down and brings them up
g.crowd.list.length = 0; g.crowd.rebuild(); for (const n in g.projectors) g.projectors[n].broken = false;
const lostDown = g.crowd.spawn(300, 600 + GROUND, 'lost', { state: 'idle', room: 6, dest: 'room:6', final: 'room:6' });
d.x = 400; d.y = 415; d.vx = d.vy = 0; d.rogue = false; d.patience = 100; g.active = 'biggy'; b.x = 60; b.y = 420;
for (let i = 0; i < 60 * 45 && lostDown.state !== 'follow'; i++) { g.update(1 / 60, input); g.crowd.list = g.crowd.list.filter(a => a === lostDown); } // only this one lost attendee
check('Droid goes down to reception and the lost attendee follows it', lostDown.state === 'follow');

// a spill appears, a cleaning robot mops it up
g.crowd.list.length = 0; g.spills.length = 0;
const dropper = g.crowd.spawn(760, 420, 'walker', { vx: 20, vy: 0 }); g.crowd.rebuild(); g.spill();
const sp = g.spills[0];
check('a spill comes from an attendee, at their feet', !!sp && Math.hypot(sp.x - dropper.x, sp.y - dropper.y) < 15);
for (let i = 0; i < 60 * 40 && g.spills.includes(sp); i++) g.update(1 / 60, input);
check('a cleaning robot mops up a spill', !g.spills.includes(sp));

// fleeing onto the charging base works too: the pest waits outside, gets bored and leaves
g.crowd.list.length = 0; g.crowd.rebuild(); g.active = 'voxxy'; v.x = 1410; v.y = 345; v.vx = v.vy = 0; b.x = 400; b.y = 420; d.x = 700; d.y = 420;
const k2 = g.spawnPest('poker', 'voxxy'); k2.x = 1240; k2.y = 415; k2.acts = -99;
step(60 * 6);
check('a button presser gives up while Voxxy recharges in the lounge', k2.leaving === true);

// the room doors are wide enough for Biggy: in through Room 5's door, up to the back of the room
g.crowd.list.length = 0; g.crowd.rebuild(); b.rogue = false; b.x = 535; b.y = 400; b.vx = b.vy = 0; g.active = 'biggy';
drive(b, 535, 290, 3); drive(b, 440, 120, 6);
check(`Biggy fits through a room's door (x ${b.x | 0}, y ${b.y | 0})`, b.y < 160);

// a charging base recharges a robot parked on it, not one driving across it
g.crowd.list.length = 0; g.crowd.rebuild(); g.active = 'voxxy'; v.patience = 60; v.x = 1410; v.y = 345; v.vx = v.vy = 0; step(60); const parked = v.patience - 60;
v.patience = 60; v.x = 1335; v.y = 345; v.vx = v.vy = 0; drive(v, 1490, 345, 1); const across = v.patience - 60;
check(`the charging base recharges Voxxy parked on it (+${parked.toFixed(0)} in 1 s), not driving across it (+${across.toFixed(1)})`, parked > 10 && across < 3);

// a moment of peace: stopped where nobody is around (the back of an empty room), a robot gets some energy back
g.crowd.list.length = 0; g.crowd.rebuild(); b.patience = 40; b.x = 500; b.y = 55; b.vx = b.vy = 0; g.active = 'biggy'; step(60); // selected, so it stays and rests
check(`resting away from the crowd gives Biggy some energy back (energy 40 → ${b.patience.toFixed(0)})`, b.patience > 44 && b.patience < 48);

// Biggy's patrols are its job too: walking its rounds (AI), it slowly gets tired, even with nobody around
{ const c = new Game({ toast() {}, roundOver() {} }); c.start(0, 'voxxy'); for (const k in c.next) c.next[k] = 999;
  const cin = { x: 0, y: 0, hold: false, consumeHold() {} }, cb = c.robots.biggy;
  c.crowd.list.length = 0; c.crowd.rebuild(); c.pool.length = 0; cb.x = 700; cb.y = 440; cb.vx = cb.vy = 0; cb.patience = 100;
  let patrolled = 0; for (let i = 0; i < 60 * 10; i++) { c.crowd.list.length = 0; c.crowd.rebuild(); c.update(1 / 60, cin); if (cb.task === 'on patrol' && cb.speed > 5) patrolled++; }
  check(`Biggy on patrol slowly gets tired (energy 100 → ${cb.patience.toFixed(1)} in 10 s, ${(patrolled / 60).toFixed(1)} s of it walking its rounds)`, cb.patience < 99 && cb.patience > 94 && patrolled > 300); }

// worn out: it stops working, trundles to the nearest charging base, and recharges there
g.crowd.list.length = 0; g.crowd.rebuild(); b.patience = 0; g.goRogue(b); b.x = 1100; b.y = 415; g.active = 'droid'; d.x = 250; d.y = 415;
const bx0 = b.x; step(60 * 5);
check(`worn out, Biggy heads for a charging base and doesn't recharge on the way (energy ${b.patience.toFixed(0)} after 5 s, moved ${Math.round(b.x - bx0)})`, b.rogue && b.x > bx0 + 20 && b.patience < 1);
for (let i = 0; i < 60 * 25 && b.rogue; i++) step(1);
check('…and gets back to work once recharged', !b.rogue);
// on a base, a worn-out robot recharges in a couple of seconds
g.crowd.list.length = 0; g.crowd.rebuild(); b.patience = 0; g.goRogue(b); b.x = 1410; b.y = 345; b.vx = b.vy = 0; step(60 * 3);
check(`on a charging base, a worn-out robot is back within 3 s (energy ${b.patience.toFixed(0)})`, !b.rogue);

// selfies and buttons: any of the three robots will do, not one in particular (a worn-out one is left alone)
{ const c = new Game({ toast() {}, roundOver() {} }); c.start(2, 'voxxy');
  const by = { voxxy: 0, droid: 0, biggy: 0 }, types = new Set();
  for (let i = 0; i < 90; i++) { const f = c.spawnPest(); by[f.target]++; types.add(f.pest.label); }
  c.goRogue(c.robots.droid); let onRogue = 0; for (let i = 0; i < 30; i++) if (c.spawnPest().target === 'droid') onRogue++;
  check(`fans go for all three robots (${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(', ')}; ${[...types].join(' and ')}), not a worn-out one (${onRogue})`, Object.values(by).every(n => n >= 15) && types.size === 2 && !onRogue); }

// Biggy (security) turns up by a button presser bothering Voxxy: it gives up, Voxxy gets some calm back
g.crowd.list.length = 0; g.crowd.rebuild(); if (v.rogue) { v.patience = 100; step(1); } v.x = 900; v.y = 395; v.vx = v.vy = 0; v.patience = 50; // in the middle lane, clear of the pillars
const sh = g.spawnPest('poker', 'voxxy'); sh.x = v.x; sh.y = v.y + 20; sh.acts = -99; // a stubborn one: it won't leave on its own before Biggy arrives
b.x = sh.x - 90; b.y = sh.y; b.vx = b.vy = 0;
g.active = 'biggy'; // steer Biggy to wherever the pest is, and stop beside it
for (let i = 0; i < 60 * 5 && !sh.leaving; i++) { v.x = 900; v.y = 395; v.vx = v.vy = 0; const dd = Math.hypot(sh.x - b.x, sh.y - b.y), l = dd || 1; input.x = dd > 30 ? (sh.x - b.x) / l : 0; input.y = dd > 30 ? (sh.y - b.y) / l : 0; g.update(1 / 60, input); }
input.x = input.y = 0; step(10);
check(`Biggy parks by Voxxy and the button presser gives up (${sh.leaving ? 'gone home' : 'still there'})`, sh.leaving === true && g.floaters.some(f => f.text === '😌'));
// …but when the AI drives Biggy, the fan still goes and nobody gets energy out of it: only the robot you steer comforts
g.crowd.list.length = 0; g.crowd.rebuild(); g.floaters.length = 0; g.active = 'droid'; v.patience = 50;
const sh2 = g.spawnPest('poker', 'voxxy'); sh2.acts = -99;
for (let i = 0; i < 60 * 5 && !sh2.leaving; i++) { v.x = 900; v.y = 395; v.vx = v.vy = 0; sh2.x = 900; sh2.y = 415; b.x = 880; b.y = 430; b.vx = b.vy = 0; g.update(1 / 60, input); }
check(`with the AI driving Biggy, the button presser gives up but Voxxy gets no energy from it (energy 50 → ${v.patience.toFixed(0)})`, sh2.leaving === true && v.patience <= 50 && !g.floaters.some(f => f.text === '😌'));

// a standing table is a pit stop: a robot parked against it gets some calm back
{ const [tx, ty] = tables[0]; // the first corridor table (30 × 10)
  g.active = 'voxxy'; for (const rb of [d, b]) { rb.x = 1000; rb.y = 420; rb.vx = rb.vy = 0; }
  d.patience = 50; let atTable = false;
  for (let i = 0; i < 60; i++) { d.x = tx + 15; d.y = ty + 10 + d.r + 4; d.vx = d.vy = 0; g.update(1 / 60, input); atTable ||= d.atTable; }
  check(`Droid parked at a table leans on it and gets some energy back (50 → ${d.patience.toFixed(0)})`, atTable && d.patience > 50); }

// every breakdown is different: the same kind can be quick one time and stubborn the next
{ const timeFix = what => { g.crowd.list.length = 0; g.crowd.rebuild(); g.breakProjector(3, what); const pn = g.panelOf(3);
    for (const rb of [d, b]) { rb.x = 1000; rb.y = 700; rb.vx = rb.vy = 0; } // no teamwork bonus
    v.rogue = false; v.patience = 100; g.active = 'voxxy'; input.hold = true; let n = 0;
    while (g.projectors[3].broken && n < 60 * 6) { v.x = pn.x; v.y = pn.y + 8; v.vx = v.vy = 0; g.update(1 / 60, input); n++; }
    input.hold = false; return n / 60; };
  const times = Array.from({ length: 20 }, () => timeFix('projector'));
  const lo = Math.min(...times), hi = Math.max(...times);
  check(`the same breakdown takes a different time each time (projector: ${lo.toFixed(1)}–${hi.toFixed(1)} s)`, hi - lo > 0.6 && hi <= 4.1 && g.stats.fixed > 0); }


// an unattended bag: Biggy stands by it and the owner comes back for it
{ g.crowd.list.length = 0; g.crowd.rebuild(); b.rogue = false; b.patience = 100; g.active = 'voxxy';
  g.bags.length = 0; g.bags.push({ x: 700, y: 415, t: 0, checkT: 0, complained: false }); const bag = g.bags[0];
  for (let i = 0; i < 60 * 3 && g.bags.includes(bag); i++) { b.x = 700 - 24; b.y = 415; b.vx = b.vy = 0; step(1); }
  check('Biggy stands by an unattended bag and its owner comes back for it', !g.bags.includes(bag)); }

// people sitting on the stairs: Biggy (AI) goes over, they move, and the check costs Biggy some energy
{ g.over = false; g.t = 20; for (const k in g.next) g.next[k] = 999; g.bags.length = 0; g.exits.length = 0;
  g.crowd.list.length = 0; g.crowd.rebuild(); b.rogue = false; b.patience = 100; b.x = 400; b.y = 415; b.vx = b.vy = 0; g.active = 'voxxy';
  const spot = exitSpots.find(s => s.where === 'on the stairs to the hall');
  g.exits.push({ x: spot.x, y: spot.y, where: spot.where, t: 0, checkT: 0, complained: false, n: 2 }); const ex = g.exits[0];
  let lowB = 100; // the check is work for Biggy (with nobody around, it gets it back as soon as it stands still)
  for (let i = 0; i < 60 * 25 && g.exits.includes(ex); i++) { step(1); lowB = Math.min(lowB, b.patience); }
  check(`Biggy (AI) clears people sitting on the stairs (energy down to ${lowB.toFixed(1)} meanwhile)`, !g.exits.includes(ex) && g.stats.exits > 0 && lowB < 100);
// …and it doesn't chase fans: a selfie fan with Droid is not security's job
  const fan = g.spawnPest('selfie', 'droid'); fan.state = 'pester'; fan.x = d.x + 14; fan.y = d.y; fan.acts = -99;
  b.x = d.x + 300; b.y = d.y; b.vx = b.vy = 0; const gap0 = Math.hypot(b.x - d.x, b.y - d.y); step(60 * 3);
  check('Biggy (AI) does not chase a selfie fan', Math.hypot(b.x - d.x, b.y - d.y) > gap0 - 60 || floorOf(b.y) !== floorOf(d.y)); }

// only you look after the robots: AI robots never comfort each other, and whichever robot you steer can comfort the other two
{ const R = g.robots, ALL = ['voxxy', 'droid', 'biggy'];
  const trial = (active, helper, target, hold) => { // helper stands right next to a stressed target for one second
    g.over = false; g.t = 20; // earlier checks may have run the clock to the end of the day
    for (const k in g.next) g.next[k] = 999; g.spills.length = 0; // no random events during the measurement
    g.crowd.list.length = 0; g.crowd.rebuild(); g.bags.length = 0;
    for (const k of ALL) Object.assign(R[k], { rogue: false, patience: 100, vx: 0, vy: 0 });
    const h = R[helper], t = R[target], other = R[ALL.find(k => k !== helper && k !== target)];
    t.patience = 40; g.active = active; input.hold = hold;
    for (let i = 0; i < 60; i++) {
      h.x = 600; h.y = 415; t.x = 600 + h.r + t.r + 6; t.y = 415; other.x = 1200; other.y = 470;
      for (const k of ALL) { R[k].vx = R[k].vy = 0; }
      g.update(1 / 60, input); input.holdLock = false;
    }
    input.hold = false; return t.patience - 40;
  };
  const extra = (active, helper, target) => trial(active, helper, target, true) - trial(active, helper, target, false);
  const watch = ALL.flatMap(h => ALL.filter(t => t !== h).map(t => extra(null, h, t)));
  check(`watching: AI robots don't comfort each other (extra energy ${Math.max(...watch).toFixed(1)})`, Math.max(...watch) < 1);
  const aiPair = extra('voxxy', 'biggy', 'droid'); // you steer Voxxy, far away: Biggy (AI) next to Droid
  check(`while you steer one robot, the other two don't comfort each other (extra energy ${aiPair.toFixed(1)})`, aiPair < 1);
  for (const h of ALL) for (const t of ALL.filter(k => k !== h)) {
    const gain = extra(h, h, t);
    check(`you steer ${R[h].name}: it can comfort ${R[t].name} (+${gain.toFixed(0)} energy in 1 s)`, gain > 10);
  }
  // staying works all the way up: a friend at 80% fills up to 100%, but next to a breakdown the repair comes first
  const stay = (start, broken, frames = 120) => { // you steer Voxxy next to Droid, holding E (2 s by default)
    const v = R.voxxy, d = R.droid, spot = g.projectors['3'];
    trial('voxxy', 'voxxy', 'droid', false);
    d.patience = start; spot.broken = broken; spot.fix = 0.5; spot.fixT = 0;
    const panel = g.panelOf('3');
    input.hold = true;
    for (let i = 0; i < frames; i++) {
      v.x = broken ? panel.x : 600; v.y = broken ? panel.y : 415; d.x = v.x + v.r + d.r + 6; d.y = v.y;
      v.vx = v.vy = d.vx = d.vy = 0; g.update(1 / 60, input); input.holdLock = false;
    }
    input.hold = false; const r = { droid: d.patience, fixed: !spot.broken }; spot.broken = false; spot.fixT = 0; return r;
  };
  const full = stay(80, false), busy = stay(80, true), low = stay(50, true, 30); // finishing a repair releases E, so at 80% Droid only fills up if staying came first; at 50%, 0.5 s (before it is back at 75%)
  check(`staying with a robot at 80% fills it up to 100% (${full.droid.toFixed(0)}%)`, full.droid > 99.5);
  check(`at 80%, a breakdown next to it comes first (repair ${busy.fixed ? 'done' : 'not done'}, ${busy.droid.toFixed(0)}%); below 75%, the robot does (${low.fixed ? 'repaired' : 'not repaired'}, ${low.droid.toFixed(0)}%)`,
    busy.fixed && busy.droid < 99 && !low.fixed && low.droid > 55); }

// the toilets upstairs: two stalls each (at the scale of the people on the map), people in a stall are off the map, and when
// both are taken a line forms outside the door; the women's line takes longer
{ const e = new Game({ toast() {}, roundOver() {} }); e.start(2, 'ai');
  for (const k in e.next) e.next[k] = 999; e.crowd.list.length = 0; e.crowd.rebuild();
  for (const rb of e.robotList) { rb.x = 300; rb.y = 415 + (rb.kind === 'droid' ? 30 : rb.kind === 'biggy' ? -30 : 0); }
  const women = Array.from({ length: 10 }, (_, i) => e.crowd.spawn(1150 + (i % 5) * 12, 458 + (i >> 1) * 6, 'walker', { dest: 'wc:F', final: 'room:3' }));
  const men = Array.from({ length: 10 }, (_, i) => e.crowd.spawn(1000 + (i % 5) * 12, 458 + (i >> 1) * 6, 'walker', { dest: 'wc:M', final: 'room:3' }));
  const inside = key => e.wcInside.filter(w => w.key === key).length, done = g => g.filter(a => a.state === 'walk' && a.dest === 'room:3').length;
  let maxF = 0, maxM = 0, lineF = 0, hidden = true, doneF = 0, doneM = 0;
  for (let i = 0; i < 60 * 45 && done(women) + done(men) < 20; i++) {
    e.update(1 / 60, { x: 0, y: 0, hold: false, consumeHold() {} }); e.crowd.list = e.crowd.list.filter(a => women.includes(a) || men.includes(a));
    maxF = Math.max(maxF, inside('room 1:F')); maxM = Math.max(maxM, inside('room 2:M')); lineF = Math.max(lineF, e.wcQueue['room 1:F']?.length || 0);
    hidden &&= e.wcInside.every(w => !e.crowd.list.includes(w.a));
    if (!doneF && done(women) === 10) doneF = e.t; if (!doneM && done(men) === 10) doneM = e.t;
  }
  check(`the toilets: two at a time on each side upstairs (${maxF} women, ${maxM} men), a line outside when full (${lineF} waiting), off the map in a stall; the women's takes longer (${doneF.toFixed(0)} s vs ${doneM.toFixed(0)} s for all ten)`,
    maxF === 2 && maxM === 2 && lineF >= 3 && hidden && doneF > doneM && doneM > 0); }

// Droid brings a lost attendee to the door of its room and lets them go in on their own (under the back rows): it never
// crosses the seats
{ const e = new Game({ toast() {}, roundOver() {} }); e.start(0, 'ai');
  for (const k in e.next) e.next[k] = 999; e.crowd.list.length = 0; e.crowd.rebuild();
  const ed = e.robots.droid, r5 = roomByN[5]; Object.assign(ed, { x: 300, y: 415, vx: 0, vy: 0 });
  e.crowd.spawn(ed.x + ed.r + 5, ed.y, 'lost', { state: 'idle', room: 5, dest: 'room:5', final: 'room:5' });
  let deepest = 0;
  for (let i = 0; i < 60 * 30 && !e.stats.delivered; i++) {
    e.update(1 / 60, { x: 0, y: 0, hold: false, consumeHold() {} }); e.crowd.list = e.crowd.list.filter(a => a.kind === 'lost');
    if (ed.x > r5.x0 && ed.x < r5.x1 && ed.y < r5.y1) deepest = Math.max(deepest, r5.y1 - ed.y);
  }
  check(`Droid brings a lost attendee to the door of Room 5, and they go in (delivered ${e.stats.delivered}; Droid at most ${deepest.toFixed(0)} into the room)`, e.stats.delivered === 1 && deepest < 30); }

// a breakdown costs less in an empty room: Monday 10:00, Room 5 has a Deep Dive on, Room 7 has no talk all day
{ const e = new Game({ toast() {}, roundOver() {} }); e.start(0, 'ai');
  const drop = n => {
    for (const k in e.next) e.next[k] = 999; e.crowd.list.length = 0; e.crowd.rebuild(); e.spills.length = 0; e.bags.length = 0;
    for (const k in e.projectors) Object.assign(e.projectors[k], { broken: false, brokenT: 0, complaints: 0 });
    e.t = e.day.seconds * 60 / 660; e.satisfaction = 50; e.projectors[n].broken = true; // 10:00
    for (let i = 0; i < 120; i++) e.update(1 / 60, { x: 0, y: 0, hold: false, consumeHold() {} });
    return 50 - e.satisfaction;
  };
  const busy = drop('5'), idle = drop('7');
  check(`a breakdown during a talk costs more than in an empty room (${busy.toFixed(2)} vs ${idle.toFixed(2)} in 2 s)`, Math.abs(busy - 0.6) < 0.05 && Math.abs(idle - 0.2) < 0.05); }

// Monday's moment: you stay with the robot that runs low, and the game says why that matters as soon as the comfort is done
{ const toasts = [], ui = { toast: m => toasts.push(m), roundOver() {} };
  const m = new Game(ui); m.start(0, 'voxxy');
  m.robots.droid.x = 700; m.robots.droid.y = 415; m.firstWobble(); m.next.wobble = undefined;
  const mv = m.robots.voxxy, md = m.robots.droid, inp = { x: 0, y: 0, hold: true, consumeHold() {} };
  for (const k in m.next) m.next[k] = 999;
  for (let i = 0; i < 60 * 6 && m.wobble; i++) { mv.x = md.x - md.r - mv.r - 4; mv.y = md.y; mv.vx = mv.vy = md.vx = md.vy = 0; md.x = 700; md.y = 415; m.update(1 / 60, inp); }
  check('Monday: "That\'s the game" comes right after you stay with the tired robot', toasts.some(t => t.includes("That's the game: they do the work, you keep them going.")));
  m.fanHint = m.bagHint = m.exitHint = true; m.start(0, 'voxxy'); // as if the title demo had used them up
  check('the title demo does not use up the first-time hints (reset on start)', !m.fanHint && !m.bagHint && !m.exitHint); }

// the stars: one per objective, each on its own (closing time, nobody worn out, 75% satisfaction); a lost day gets none
{ const res = [], z = new Game({ toast() {}, roundOver: r => res.push(r) });
  const day = (sat, worn, reason) => { z.start(3, 'voxxy'); z.satisfaction = sat; z.stats.revolts = worn; z.finish(reason); return res[res.length - 1].stars; };
  // 74.6% shows as 75% on the results screen, which ticks the objective: the star follows what is shown
  const cases = [[90, 0, 'day', 3], [90, 1, 'day', 2], [60, 0, 'day', 2], [40, 0, 'day', 2], [60, 2, 'day', 1], [74.6, 0, 'day', 3], [74.4, 0, 'day', 2], [80, 0, 'chaos', 0], [80, 0, 'revolt', 0]];
  const got = cases.map(([s, w, r]) => day(s, w, r));
  check(`the stars: one for closing time, one for nobody worn out, one for 75% satisfaction (${cases.map((c, i) => `${c[0]}%/${c[1]} worn out → ${got[i]}`).join(', ')})`, cases.every((c, i) => got[i] === c[3])); }

// a fan who gets carried away ("just one more!") doesn't stop after three selfies, and calls a friend; Biggy (AI) keeps it friendly
{ const c = new Game({ toast() {}, roundOver() {} }); c.start(3, 'voxxy'); for (const k in c.next) c.next[k] = 999;
  const cd = c.robots.droid, cb = c.robots.biggy, cin = { x: 0, y: 0, hold: false, consumeHold() {} };
  cd.x = 700; cd.y = 425; cb.x = 250; cb.y = 1300; cb.patience = 0; c.goRogue(cb); // Biggy worn out downstairs: nobody keeps order yet (Droid in the corridor, clear of the tables)
  const f = c.spawnPest('selfie', 'droid'); f.x = cd.x + 14; f.y = cd.y; f.state = 'pester';
  const cstep = s => { for (let i = 0; i < s * 60; i++) { cd.x = 700; cd.y = 425; cd.vx = cd.vy = 0; cd.patience = 100; c.update(1 / 60, cin); } }; // Droid kept going: we watch the fans
  f.acts = 3; c.getCarriedAway(f, cd); // its third selfie, and "just one more!"
  check(`a fan can get carried away and call a friend (${c.crowd.list.filter(a => a.carried).length} carried away)`, f.carried && c.crowd.list.filter(a => a.carried).length === 2);
  cstep(8);
  check(`…and doesn't stop on its own after three selfies (${f.acts} so far)`, !f.leaving && f.acts > 3);
  cb.rogue = false; cb.patience = 100; cb.x = 520; cb.y = 425; cb.vx = cb.vy = 0; // Biggy is back, upstairs
  let lowB = 100; // calming fans is work for Biggy (it may get it back at once, resting against a table nearby)
  for (let i = 0; i < 60 * 20 && c.crowd.list.some(a => a.carried && !a.leaving); i++) { cd.x = 700; cd.y = 425; cd.vx = cd.vy = 0; cd.patience = 100; c.update(1 / 60, cin); lowB = Math.min(lowB, cb.patience); }
  check(`Biggy (AI) keeps the fans friendly: they calm down and go (fans calmed ${c.stats.fans}, Biggy's energy down to ${lowB.toFixed(0)} meanwhile)`, !c.crowd.list.some(a => a.carried && !a.leaving) && c.stats.fans === 2 && lowB < 100); }

// a fan trailing a busy robot around (it keeps moving, so no photo): after a while Biggy steps in
{ const c = new Game({ toast() {}, roundOver() {} }); c.start(2, 'voxxy'); for (const k in c.next) c.next[k] = 999;
  const cd = c.robots.droid, cb = c.robots.biggy, cin = { x: 0, y: 0, hold: false, consumeHold() {} };
  cb.x = 250; cb.y = 1300; cb.patience = 0; c.goRogue(cb); // Biggy away (recharging downstairs) at first
  const f = c.spawnPest('selfie', 'droid'); f.x = 300; f.y = 452; f.state = 'pester';
  let t = 0; const walk = s => { for (let i = 0; i < s * 60; i++) { t += 1 / 60; cd.x = 700 + Math.sin(t) * 250; cd.y = 440; cd.vx = cd.vy = 0; cd.patience = 100; c.update(1 / 60, cin); } };
  walk(16);
  check(`a fan still following busy Droid after 15 s becomes Biggy's job (${f.acts || 0} photos so far)`, f.clingy === true && !f.leaving);
  cb.rogue = false; cb.patience = 100; cb.x = 560; cb.y = 452; cb.vx = cb.vy = 0; // Biggy is back, upstairs
  for (let i = 0; i < 60 * 25 && !f.leaving; i++) walk(1 / 60);
  check('Biggy (AI) walks over and the fan leaves Droid alone', f.leaving === true && c.stats.fans >= 1); }

// the sizes the README gives: Voxxy Ø 0.85 m, Droid Ø 0.9 m, Biggy Ø 1.3 m (30% larger than the real ones), attendees Ø 0.55–0.75 m (1 unit ≈ 7 cm)
{ const m = r => r * 2 * 0.07, c = new Game({ toast() {}, roundOver() {} }); c.start(3, 'voxxy');
  const people = c.crowd.list.map(a => m(a.r)), lo = Math.min(...people), hi = Math.max(...people);
  check(`sizes: Voxxy Ø ${m(SPECS.voxxy.r).toFixed(2)} m, Droid Ø ${m(SPECS.droid.r).toFixed(2)} m, Biggy Ø ${m(SPECS.biggy.r).toFixed(2)} m, attendees Ø ${lo.toFixed(2)}–${hi.toFixed(2)} m`,
    Math.abs(m(SPECS.voxxy.r) - 0.85) < 0.01 && Math.abs(m(SPECS.droid.r) - 0.9) < 0.01 && Math.abs(m(SPECS.biggy.r) - 1.3) < 0.01 && lo >= 0.545 && hi <= 0.755 && hi - lo > 0.1); }

// a toilet break: parked inside a working toilet block, a robot gets its energy back (not in a blocked one), and the fans wait outside
{ const c = new Game({ toast() {}, roundOver() {} }); c.start(2, 'droid'); for (const k in c.next) c.next[k] = 999;
  const cd = c.robots.droid, cin = { x: 0, y: 0, hold: false, consumeHold() {} };
  c.robots.voxxy.x = 300; c.robots.voxxy.y = 415; c.robots.biggy.x = 300; c.robots.biggy.y = 455;
  const [tx, ty, tw, th] = toilets.find(t => t.id === 'room 2').rect; // the kiosk under Kinepolis room 2
  const park = s => { for (let i = 0; i < s * 60; i++) { cd.x = tx + tw / 2; cd.y = ty + th / 2; cd.vx = cd.vy = 0; c.update(1 / 60, cin); } };
  const rest = () => { c.crowd.list.length = 0; c.crowd.rebuild(); cd.patience = 50; park(1); return cd.patience - 50; };
  const working = rest(), onBreak = cd.atToilet;
  c.projectors['toilets:room 2'].broken = true; const blocked = rest(); c.projectors['toilets:room 2'].broken = false;
  check(`Droid parked in the toilets takes a break (+${working.toFixed(1)} energy in 1 s, +${blocked.toFixed(1)} when they are out of order)`, onBreak && working > blocked + 4);
  c.crowd.list.length = 0; c.crowd.rebuild(); cd.patience = 50;
  const fan = c.spawnPest('selfie', 'droid'); fan.x = tx + tw / 2; fan.y = ty + th + 40; fan.state = 'pester'; fan.acts = -99;
  park(3);
  check(`…and a selfie fan waits outside meanwhile (${Math.hypot(fan.x - cd.x, fan.y - cd.y).toFixed(0)} units away, no photo)`, cd.atToilet && fan.acts === -99 && Math.hypot(fan.x - cd.x, fan.y - cd.y) > 40);
  // there are several cubicles: the attendees keep using the toilets while a robot takes its break there
  c.crowd.list.length = 0; c.crowd.rebuild(); let rested = true;
  const loo = Array.from({ length: 8 }, (_, i) => c.crowd.spawn(900 + i * 25, 470, 'walker', { dest: 'wc:M', final: 'room:4' })); // the kiosk under room 2 is the men's
  for (let i = 0; i < 60 * 15; i++) { cd.x = tx + tw / 2; cd.y = ty + th / 2; cd.vx = cd.vy = 0; cd.patience = 50; c.update(1 / 60, cin); rested &&= cd.atToilet; }
  const used = loo.filter(a => !a.dest.startsWith('wc:')).length;
  check(`…and the attendees keep using the toilets meanwhile (${used}/8 went in, Droid's break never interrupted)`, used === 8 && rested); }

// the women's and the men's: upstairs, the kiosk under Kinepolis room 1 and the one under room 2; downstairs, one side of each
// block. Nothing on screen tells the attendees apart, and a robot can take its break in any of them
{ const c = new Game({ toast() {}, roundOver() {} }); c.start(2, 'voxxy'); for (const k in c.next) c.next[k] = 999;
  const cin = { x: 0, y: 0, hold: false, consumeHold() {} };
  for (const rb of c.robotList) { rb.x = 300; rb.y = 415 + (rb.kind === 'droid' ? 30 : rb.kind === 'biggy' ? -30 : 0); }
  c.crowd.list.length = 0; c.crowd.rebuild();
  const kiosk = id => toilets.find(t => t.id === id).kiosk;
  const people = Array.from({ length: 12 }, (_, i) => c.crowd.spawn(620 + i * 25, 415, 'walker', { dest: i % 2 ? 'wc:M' : 'wc:F', final: 'room:4' }));
  const went = new Map();
  for (let i = 0; i < 60 * 30 && went.size < 12; i++) { c.update(1 / 60, cin); for (const a of people) if (!went.has(a) && a.state === 'queue') went.set(a, a.x < kiosk('room 1')[0] ? 'room 2' : 'room 1'); }
  const right = people.filter(a => went.get(a) === (a.stop === 'wc:F' ? 'room 1' : 'room 2')).length;
  const anyForRobots = toilets.every(t => c.inToilets({ x: t.rect[0] + t.rect[2] / 2, y: t.rect[1] + t.rect[3] / 2 }));
  check(`the women go to the women's toilets, the men to the men's (${right}/12 at the right kiosk upstairs, ${12 - went.size} still on the way); a robot can use any of them`, right === 12 && anyForRobots); }

// at ×2 (T / ⏩) the floating lines stay up as long, in real time, as at ×1: they are counted in real time
{ const c = new Game({ toast() {}, roundOver() {} }); c.start(0, 'voxxy'); for (const k in c.next) c.next[k] = 999;
  const cin = { x: 0, y: 0, hold: false, consumeHold() {} };
  c.floaters.length = 0; c.float(700, 400, 'a line to read', '#fff'); const f = c.floaters[0];
  c.timeScale = 2; for (let i = 0; i < 120; i++) c.update(1 / 60, cin); // 2 s of game time: 1 s of real time at ×2
  check(`at ×2 a floating line lasts as long in real time (${f.t.toFixed(2)} s of its ${f.life.toFixed(1)} s after 1 s)`, Math.abs(f.t - 1) < 0.05 && c.floaters.includes(f)); }

// attendees going from Room 5 to Room 4 go out by its door and along the main corridor
{ const c = new Game({ toast() {}, roundOver() {} }); c.start(0, 'voxxy'); for (const k in c.next) c.next[k] = 999;
  const cin = { x: 0, y: 0, hold: false, consumeHold() {} };
  c.crowd.list.length = 0; c.crowd.rebuild();
  const walkers = Array.from({ length: 8 }, (_, i) => c.crowd.spawn(330 + i * 28, 95, 'walker', { dest: 'room:4', final: 'room:4' }));
  const arrived = new Set(); let backstage = 0;
  for (let i = 0; i < 60 * 45; i++) {
    c.update(1 / 60, cin);
    for (const a of walkers) if (!c.crowd.list.includes(a)) arrived.add(a); ;
  }
  const exits = serviceDoorDefs.map(d => [d.x + d.w / 2, d.y + d.h / 2]);
  const staff = exits.every(([x, y]) => !solidAt(c.wallGrid, x, y) && solidAt(c.crowdGrid, x, y));
  check(`attendees go from Room 5 to Room 4 by the main corridor (${arrived.size}/8 arrived)`, arrived.size === 8 && staff); }

// the hallway track: during a talk most people are in the rooms, and some skip it and stay out: at a standing table,
// a coffee or the booths (downstairs, only when the exhibitors are there)
{ seed(+(process.env.HALLWAY_SEED || 3)); // its own random draws: the checks before it don't shift what it sees (a statistical check: with a few seeds an afternoon happens to see only one kind of stop; 3 sees four since the day starts at 8:30)
  const c = new Game({ toast() {}, roundOver() {} }); c.start(2, 'ai');
  const cin = { x: 0, y: 0, hold: false, consumeHold() {} };
  // it checks the crowd, not the robots: they are kept going, so the day always gets to the afternoon
  const tick = () => { for (const rb of c.robotList) { rb.patience = 100; rb.rogue = false; } c.satisfaction = 100; c.update(1 / 60, cin); };
  while (c.clock.text !== '14:00' && !c.over) tick(); // Wednesday afternoon, after lunch
  let out = 0, all = 0, f60 = 0; const spots = new Set(); // over the afternoon's talks: the share out, and where they are
  while (c.clock.text !== '17:30' && !c.over) { tick(); if (c.breakNow || ++f60 % 60) continue;
    for (const a of c.crowd.list) if (a.kind === 'walker') { all++; if (a.final === 'hang') { out++; if (a.state === 'wait') spots.add(a.stop); } }
    all += c.pool.length; }
  const share = out / all * 100;
  check(`during a talk, most people are in the rooms and some stay out (${share.toFixed(0)}% of them over the afternoon, at: ${[...spots].sort().join(', ')})`, share > 3 && share < 25 && ['tables', 'coffee', 'expo', 'hallcoffee'].filter(s => spots.has(s)).length >= 2);
  const f = new Game({ toast() {}, roundOver() {} }); f.start(4, 'ai');
  const hall = Array.from({ length: 200 }, () => f.hangout(300 + GROUND));
  check(`…and on Friday, without exhibitors, nobody waits at the booths (${hall.filter(s => s === 'expo').length} of 200 downstairs)`, !hall.includes('expo')); }

// the robots start clear of the walls and of the corridor's pillars (a robot dropped on a pillar could stay stuck in it)
{ const s = new Game({ toast() {}, roundOver() {} }); s.start(0, 'voxxy');
  check(`the robots start clear of the walls and pillars (${s.robotList.map(r => `${r.name} at ${r.x},${r.y}`).join(', ')})`, s.robotList.every(r => !blockedCircle(s.wallGrid, r.x, r.y, r.r))); }
