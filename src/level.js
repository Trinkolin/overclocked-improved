// Kinepolis Antwerp on two floors, both rotated 90° like the plans (the bottom of a plan is
// on the left): the cinema level (Devoxx rooms 3–10 and their corridor) on top, and below it
// the ground floor (main entrance, reception, BOF rooms, exhibition hall). The two floors sit
// one above the other in the same world; the staircases link them.
// Everything is aligned to the 10-unit nav grid. 1 unit ≈ 7 cm.

// The ground floor is drawn at the same scale as the cinema level, from the Kinepolis plan: it is taller than one screen, so
// downstairs the view scrolls with your robot (see render.js)
export const W = 1600, FLOOR_H = 840, GROUND_H = 1230, H = FLOOR_H + GROUND_H, CELL = 10;
export const floorH = f => (f ? FLOOR_H : GROUND_H); // 1: cinema level, 0: ground floor
export const GW = W / CELL, GH = H / CELL;
export const GROUND = FLOOR_H; // y offset of the ground floor
export const floorOf = y => (y >= GROUND ? 0 : 1); // 1: cinema level, 0: ground floor
const G = ([x, y, w, h]) => [x, y + GROUND, w, h]; // a rect on the ground floor

// Destination hues (agents are tinted by where they are heading).
export const ROOM_HUES = { 3: '#ff6b6b', 4: '#4dd2e0', 5: '#ffb020', 6: '#b98cff', 7: '#7bdc6b', 8: '#ff8a3d', 9: '#5b8cff', 10: '#ff6bd0' };

// Room sizes measured on the Kinepolis plan (scaled so that its corridor is as wide as the game's): where each room starts
// and ends along the corridor, and how deep it goes. Rooms 5 and 8, the deepest, are a little shorter than on the plan so
// that the floor still fits on one screen; the others are at their real depth.
const SPANS = { 6: [100, 300], 5: [310, 565], 4: [580, 775], 3: [790, 950], 7: [100, 300], 8: [310, 565], 9: [580, 770], 10: [785, 950] };
const DEPTH = { 6: 290, 5: 310, 4: 290, 3: 230, 7: 290, 8: 320, 9: 290, 10: 230 };
// One door per room onto the corridor, as at Kinepolis, at one end of its wall: the doors of 8 and 9 side by side, 7's at the far
// end, 10's by the stairwell; the rooms across the corridor mirror them (6 like 7, 5 like 8, 4 like 9, 3 like 10)
const DOOR_AT_RIGHT = { 5: true, 8: true, 6: true, 7: true }; // 6 and 7: by room 5 and 8, past the stairs (Kinepolis plan)

// The seats (drawn in render.js): raked rows 14 apart, from 40 in front of the screen back to the projection room, with a cross
// aisle halfway (row `cross`, at crossY). The entrances pass under the back rows: people come out onto the cross aisle
const crossRow = depth => Math.round(Math.floor((depth - 70) / 14) / 2);
// a room counted seat by seat (Jessica, from the Kinepolis virtual tour): its number of rows (the cross aisle counts as one), the
// cross aisle's place and the seat width; the rows are then spaced to fill the room
const SEATING = { 3: { rows: 17, cross: 5, seatW: 6 }, 4: { rows: 18, cross: 6, seatW: 7.2 }, 5: { rows: 21, cross: 12, seatW: 7 }, 8: { rows: 25, cross: 12, seatW: 7 }, 6: { rows: 18, cross: 5, seatW: 6.6 }, 9: { rows: 18, cross: 6, seatW: 6 }, 7: { rows: 18, cross: 5, seatW: 6.6 }, 10: { rows: 13, cross: null, seatW: 7.8 } }; // Zaal 3: 16 rows, the cross aisle after the 5th; Zaal 4: 17 rows, the cross aisle after the 6th; Zaal 5: 12 rows, the cross aisle, 8 more; Zaal 8: 12 and 12; Zaal 6: 5 and 12; Zaal 9: 6 and 11; Zaal 7: 17 rows, its cross aisle placed as in 6 (across the corridor); Zaal 10: 13 rows, no cross aisle
export const rooms = Object.entries(SPANS).map(([n, [x0, x1]]) => {
  n = +n;
  const top = [3, 4, 5, 6].includes(n), depth = DEPTH[n];
  const [y0, y1] = top ? [320 - depth, 320] : [510, 510 + depth];
  const S = SEATING[n], rows = S ? S.rows : Math.floor((depth - 34) / 14), pitch = S ? (depth - 40 - 32) / (S.rows - 1) : 14, seatW = S ? S.seatW : 9;
  const cx = Math.round((x0 + x1) / 20) * 10, cross = S ? S.cross : crossRow(depth), crossAt = cross ?? Math.round(rows / 2), crossY = top ? y0 + 40 + crossAt * pitch : y1 - 40 - crossAt * pitch; // no cross aisle (null): people still show from halfway up
  return {
    n, top, x0, x1, y0, y1, cx, depth, cross, crossY, rows, pitch, seatW,
    // the door onto the corridor: double doors, wide enough for Biggy
    doors: [{ x: DOOR_AT_RIGHT[n] ? x1 - 50 : x0 + 10, y: top ? 320 : 500, w: 40, h: 10 }],
    // where people sit down: the front tier, between the flat floor in front of the screen and the cross aisle
    seats: top ? { x: x0 + 10, y: y0 + 32, w: x1 - x0 - 20, h: crossY - 6 - (y0 + 32) } : { x: x0 + 10, y: crossY + 6, w: x1 - x0 - 20, h: y1 - 32 - (crossY + 6) },
    label: `${n}`,
  };
});
export const roomByN = Object.fromEntries(rooms.map(r => [r.n, r]));

const walkable = [
  [110, 330, 1190, 170],  // the corridor, from its far end (the stairs, between rooms 6 and 7) past the Kinepolis rooms 2|11 and 1|12
  [1300, 290, 250, 250],  // the lounge at the end of the corridor, and the way on to the cinema entrance
  // ---- ground floor
  // (at the scale of the Kinepolis plan, its pillar grid matching the cinema level's: one pillar every ~118 units, 8.3 m)
  G([65, 295, 405, 590]),   // reception, behind the main entrance
  G([470, 300, 20, 340]),   // the glass doors from reception into the hall
  G([490, 60, 1010, 820]),  // the exhibition hall (its rounded corner is cut out in buildStatic)
  G([490, 880, 290, 120]),  // …and its bottom-left corner, beside the polo pickup (the Kinepolis "stock bar")
  G([65, 895, 145, 310]),   // BOF room 1 (the Kinepolis seminar centre)
  G([220, 895, 135, 310]),  // BOF room 2
  G([40, 300, 25, 585]),    // the main entrance: glass doors along the whole front
  G([380, 905, 75, 300]),   // toilets next to the BOF rooms ("Toilets >" on the plan)
  G([1510, 50, 105, 245]),  // toilets off the top corner of the hall…
  G([1260, 15, 355, 35]),   // …reached by the passage behind the hall's top wall ("< Toilet entrance" on the plan)
];

// Service doors onto staff-only areas (see closeService). With the rooms at their real depth, as on the Kinepolis plan, there
// is no service corridor behind them any more: everyone goes by the main corridor.
export const serviceDoorDefs = [];

// Kinepolis rooms Devoxx doesn't program: closed
export const kinepolisRooms = [
  { n: 2, x0: 965, x1: 1100, y0: 145, y1: 320, top: true },
  { n: 1, x0: 1170, x1: 1300, y0: 135, y1: 320, top: true },
  { n: 11, x0: 965, x1: 1090, y0: 510, y1: 685, top: false },
  { n: 12, x0: 1180, x1: 1300, y0: 510, y1: 685, top: false },
  { n: 13, x0: 1310, x1: 1440, y0: 560, y1: 780, top: false },
  { n: 14, x0: 1450, x1: 1590, y0: 560, y1: 720, top: false },
];
// Past rooms 1|12 the corridor opens onto the Kinepolis lounge: the charging corner along the top,
// the coffee machine along the bottom. The floor carries on to the cinema's own entrance, which Devoxx doesn't use.
export const lounge = [1300, 290, 250, 250];
export const coffeeBar = [1310, 506, 80, 34];
// charging bases ⚡: the pads in the lounge upstairs, and downstairs in a corner of reception, by the main entrance and the
// stairs up, out of everyone's way
export const chargers = [
  { id: 'lounge', rect: [1325, 305, 170, 80] },
  { id: 'reception', rect: G([75, 305, 120, 48]) }, // three pads, like the lounge's
];
export const popcornMachine = [1410, 500, 40, 40]; // a red cinema popcorn cart, next to the coffee
// two sofas in the middle of the lounge, facing the coffee and popcorn machines (solid: nobody walks across them)
export const loungeSofas = [[1330, 400, 60, 10], [1420, 400, 60, 10]];
// the wide stairs down to reception take the whole width of the corridor (stairsWide, drawn); you only go down from the
// middle part (stairs), so that the robots can still slip past along its two edges to the service doors above and below it
export const stairsWide = [120, 385, 60, 115]; // as on the Kinepolis plan: on the room 7 side of the corridor's end
export const stairs = [120, 395, 45, 105];
// Staircases are real flights: you walk up (or down) every step, between two railings, and only at the top do you change floors.
// Upstairs, the two stairwells down to the exhibition hall, against the corridor's walls between rooms 3 and 4 and between
// rooms 9 and 10, beside the doors of 3 and 10: step in, and you are at the top of the hall's flight
export const sideStairs = [[640, 330, 55, 25], [640, 475, 55, 25]]; // where the Kinepolis plan has them, beside rooms 4 and 9
export const hallStairwells = sideStairs;
// the railings around the stairs upstairs (solid): along both sides of the wide stairs from reception, and around each stairwell
// on its corridor side and at its far end (by the door of room 3 or 10), so that you step in at its top end
export const landingRails = [[640, 355, 65, 10], [695, 330, 10, 25], [640, 465, 65, 10], [695, 475, 10, 25]];
// the foyer's dark pillars down the middle of the corridor, under their white fabric sails (the Kinepolis photos), clear of the
// stairwells' sign; each stands on one nav cell
// two per row, as in the Kinepolis virtual tour: a wide lane down the middle between them, a narrower one along each wall
// the foyer's pillars, from the Kinepolis plan: two rows splitting the corridor in three equal lanes, on a regular grid
// along it with a few gaps; the toilet kiosks under rooms 2 and 1 take the place of the upper ones there
const PILLAR_X = { both: [231, 305, 455, 573, 692, 780, 839, 957], lower: [1016, 1104, 1164] };
export const corridorPillars = [
  // (each exactly on one nav cell: one off the grid blocks two, drawn as grey wall round the black)
  ...PILLAR_X.both.flatMap(x => [[Math.floor(x / CELL) * CELL, 380, CELL, CELL], [Math.floor(x / CELL) * CELL, 440, CELL, CELL]]),
  ...PILLAR_X.lower.map(x => [Math.floor(x / CELL) * CELL, 440, CELL, CELL]),
];
// the café corner in front of the closed Kinepolis room 11 (virtual tour): round tables with orange chairs
export const cafeTables = [[965, 475], [1105, 475]]; // the toilet kiosks take the place of the upper ones
// the stairwells between Kinepolis rooms 2|1 and 11|12 (staff, drawn only)
export const stairwells = [[1115, 240, 40, 60], [1115, 530, 40, 60]];
// the long black standing tables with a little plant, where people chat between talks (venue photos):
// a few along the corridor, clear of its middle lane, the room doors and the stairs.
// Each is 30 × 10 units (about 2.1 × 0.7 m), long side along the corridor.
export const TABLE_W = 30, TABLE_H = 10;
// where attendees sit down or stand chatting and block the way: the stairs and the main entrance (security asks them to move)
export const exitSpots = [
  { x: 180, y: 415, where: 'on the stairs to reception' },
  { x: 626, y: 342, where: 'on the stairs to the hall' },
  { x: 626, y: 488, where: 'on the stairs to the hall' },
  { x: 115, y: 565 + GROUND, where: 'at the foot of the stairs' },
  { x: 1280, y: 327 + GROUND, where: 'on the stairs to the rooms' },
  { x: 1280, y: 617 + GROUND, where: 'on the stairs to the rooms' },
  { x: 85, y: 640 + GROUND, where: 'in the main entrance' },
];
// [x, y, length] (length: TABLE_W unless given). Upstairs, between the doors of rooms 6 and 5 and of rooms 7 and 8: longer, and
// closer to the wall, as at Devoxx now (Jessica)
export const tables = [[360, 340, 80], [320, 480, 70], [430, 480, 70], // along the corridor's walls, clear of the doors
  // and downstairs, round the exhibition hall's coffee, between the two stairs
  ...[[1180, 390], [1290, 390], [1180, 555], [1290, 555], [1350, 470]].map(([x, y]) => [x, y + GROUND])];

// ---- ground floor
// the flights downstairs: lane (where you walk, from its bottom end up to its top end), top (the top step, where you change floors)
// and rails (the railings and the wall at the top end, solid)
const flight = (lane, top, rails) => ({ lane: G(lane), top: G(top), rails: rails.map(G) });
// "^ Rooms ^": the wide, majestic stairs up from reception (Kinepolis plan), facing the main entrance and climbing away from it
export const receptionFlight = flight([130, 420, 110, 290], [220, 420, 20, 290], [[130, 410, 120, 10], [130, 710, 120, 10], [240, 420, 10, 290]]);
export const receptionStairs = receptionFlight.top;
// the reception desk: the L-shaped counter just past the top of the stairs (solid: people walk round it)
export const receptionDesk = G([270, 400, 100, 100]);
export const receptionCounter = receptionDesk;
// the two "stairs to cinema rooms" in the hall, where the plan has them: a double flight with a landing at its right end, where
// you come in through the doors above and below it; you climb to the left
export const hallFlightDefs = [
  // (walled all round, as on the plan: you come in through the double doors above and below the landing, at the right end)
  ...[300, 590].map(y => flight([1150, y, 230, 55], [1150, y, 20, 55], [[1140, y - 10, 200, 10], [1380, y - 10, 10, 10], [1140, y + 55, 200, 10], [1380, y + 55, 10, 10],
    [1140, y, 10, 55], [1380, y, 10, 55]])),
];
export const hallStairs = hallFlightDefs.map(f => f.top);
export const hallFlights = hallFlightDefs.map(f => f.lane);
// the Devoxx polo pickup: where Kinepolis has its stock bar, a long white counter along the bottom of the hall
export const poloDesk = G([890, 840, 130, 20]); // (the small room the Devoxx plan points to: its counter)
// the white pillars: the plan's grid (columns ~118 apart, a wider bay before the far wall; rows ~118 apart), and three at
// reception; each stands on one nav cell (drawn a little wider, about 1 m). None stands in a booth: the booths sit between
// the rows, the pillars line the aisles
const PILLAR_COLS = [673, 792, 909, 1027, 1145, 1263, 1440], PILLAR_ROWS = [177, 295, 413, 530, 648, 766];
const onCell = (x, y) => G([Math.floor(x / CELL) * CELL, Math.floor(y / CELL) * CELL, CELL, CELL]); // exactly one nav cell (else it blocks two)
const onStairs = (x, y) => x >= 1140 && x <= 1390 && (Math.abs(y - 295) < 10 || Math.abs(y - 648) < 10);
export const hallPillars = [
  ...PILLAR_ROWS.flatMap(y => PILLAR_COLS.filter(x => !onStairs(x, y)).map(x => onCell(x, y))),
  ...[[347, 530], [210, 766], [347, 766]].map(([x, y]) => onCell(x, y)),
];
export const hallCoffee = G([1170, 450, 160, 50]); // the coffee station in the exhibition hall, between the two stairs up
// double doors in the middle of the front wall, either side of the partition (Devoxx plan)
export const bofRooms = [{ n: 1, rect: G([65, 895, 145, 310]), door: 170 }, { n: 2, rect: G([220, 895, 135, 310]), door: 230 }];
// the sponsors' booths: the hall is full of them (the sponsors' photos: three roll-up banners and a pop-up counter each), along
// every wall and in rows between the rows of pillars, but none in front of the stairs; the coffee, with its standing tables,
// is between the two stairs.
// The booths face the aisle in front of them: down in the top half, up in the bottom half (up: true); those against the left
// wall face into the hall (side: 'right'); the right wall is left clear
// (side by side, without gaps, as on the hall floor; each gets a letter, in reading order: A–Z, then AA, AB…)
const row = (y, xs, w = 120) => xs.map(x => ({ rect: G([x, y, w, 60]) }));
const col = (x, ys, side, w, h) => ys.map(y => ({ rect: G([x, y, w, h]), side }));
const ID = i => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + i % 26);
export const booths = [
  ...row(70, [670, 790, 910, 1030, 1150, 1320]),                 // along the top wall (the toilets' door between the last two)
  ...col(580, [140, 215], 'right', 60, 75),                       // the left wall, by the rounded corner
  ...row(205, [720, 840, 960]),                                   // between the 1st and 2nd rows of pillars (none in front of the stairs)
  ...[325, 445, 560, 675].flatMap(y => row(y, [720, 840, 960])),  // the rows in the middle, between the other rows of pillars (an aisle along the steps)
  ...row(810, [1030, 1150, 1270]), ...row(810, [1390], 110),      // along the bottom wall, beside the polo pickup
  ...row(930, [600]), ...row(930, [720], 60),                    // the bottom-left corner
].map((b, i) => ({ ...b, id: ID(i), up: !b.side && b.rect[1] > GROUND + 470 }));
// the bike corner (a sponsor's: exercise bikes on a patch of fake grass), in the open bottom-left of the hall (solid)
export const bikeCorner = G([680, 790, 150, 60]); // a little further from the wheelchair ramp (Jessica)
export const mainEntrance = G([40, 300, 25, 585]);
// the two toilet blocks from the plan, and their doors (reception side / hall side); sides: the women's (F) and the men's (M)
// stalls: how many people each side takes at once, at the scale of the people on the map (a sample of the ~3,000 at Devoxx:
// a few stalls for them are the whole block for everyone; the men's are quicker, with urinals); queue: where its line starts, outside
// the door, and which way it grows (people wait there when every stall is taken): along the wall, clear of the doorway, so
// that people coming out don't walk into it
export const toilets = [
  { id: 'reception', rect: G([380, 905, 75, 300]), door: G([397, 885, 40, 20]), sides: ['F', 'M'], stalls: { F: 2, M: 2 }, // both, side by side
    queue: { F: { x: 392, y: 872 + GROUND, dx: -9, dy: 0 }, M: { x: 442, y: 872 + GROUND, dx: 9, dy: 0 } } },
  // the hall's: the door is in the hall's top wall, between booths K and I ("< Toilet entrance" on the Devoxx plan); a passage
  // behind the wall leads to the block in the corner. The lines wait along the wall, on either side of the door
  { id: 'hall', rect: G([1510, 90, 105, 205]), door: G([1270, 50, 40, 10]), sides: ['F', 'M'], stalls: { F: 2, M: 2 },
    queue: { F: { x: 1262, y: 76 + GROUND, dx: -9, dy: 0 }, M: { x: 1318, y: 76 + GROUND, dx: 9, dy: 0 } } },
  // upstairs: the two rounded toilet kiosks jutting into the corridor under Kinepolis rooms 2 and 1, the men's and the women's
  { id: 'room 2', rect: [1000, 330, 100, 40], door: [1030, 370, 40, 10], kiosk: [990, 330, 120, 50], sides: ['M'], stalls: { M: 2 },
    queue: { M: { x: 1076, y: 388, dx: 9, dy: 0 } } },
  { id: 'room 1', rect: [1150, 330, 100, 40], door: [1180, 370, 40, 10], kiosk: [1140, 330, 120, 50], sides: ['F'], stalls: { F: 2 },
    queue: { F: { x: 1226, y: 388, dx: 9, dy: 0 } } },
];
// the wheelchair ramp between reception and the hall (drawn only: everyone can use it)
export const ramp = G([495, 650, 55, 220]); // right after the steps, along the hall's left wall (♿ on the Devoxx plan)
// the few steps down from reception into the hall, along its left side, behind the glass doors (drawn only)
export const hallSteps = G([495, 300, 80, 340]);
// Staircases link the floors: walk onto one end and you come out at the other.
export const portals = [
  // a: the top step upstairs, b: the top step downstairs; outA / outB: where you come out, just past the top step, on the
  // landing upstairs or on the flight downstairs (then down it)
  { name: 'stairs', a: stairs, b: receptionStairs, outA: [195, 415], outB: [205, 565 + GROUND] },
  { name: 'stairs to the exhibition hall', a: sideStairs[0], b: hallStairs[0], outA: [624, 342], outB: [1184, 327 + GROUND] },
  { name: 'stairs to the exhibition hall', a: sideStairs[1], b: hallStairs[1], outA: [624, 488], outB: [1184, 617 + GROUND] },
];

export const targetsDef = {
  coffee: [[1305, 460, 100, 40]],
  charger: chargers.map(c => c.rect), // the charging bases: where a worn-out robot heads
  // the attendees' ways down and up, on their own walls (the service corridors are closed to them; the robots' stairs fields
  // below go through them), and their way down to reception (to sit on its steps)
  down: [stairs, ...sideStairs],
  up: [receptionStairs, ...hallStairs],
  downReception: [stairs],
  // the attendees go to the women's or the men's (the robots, to any toilets): the kiosks upstairs, one side of each block downstairs
  // the head of each line outside the women's and the men's doors (see toilets)
  'wc:F': toilets.filter(t => t.sides.includes('F')).map(t => [t.queue.F.x - 5, t.queue.F.y - 5, 10, 10]),
  'wc:M': toilets.filter(t => t.sides.includes('M')).map(t => [t.queue.M.x - 5, t.queue.M.y - 5, 10, 10]),
  tables: tables.map(([x, y, w = TABLE_W]) => [x - 10, y - 10, w + 20, TABLE_H + 20]), // standing around a table
  // the hallway track, downstairs: in front of the booths (the top row faces down, the bottom row up), and around the hall's coffee
  expo: booths.map(({ rect: [x, y, w, h], up, side }) => side === 'right' ? [x + w + 4, y + 8, 14, h - 16] : side === 'left' ? [x - 18, y + 8, 14, h - 16] : !up ? [x + 10, y + h + 4, w - 20, 14] : [x + 10, y - 18, w - 20, 14]),
  // sitting on the wide stairs at reception, on the lower steps along both railings (the middle stays clear for those going up)
  steps: [G([140, 425, 60, 10]), G([140, 695, 60, 10])],
  polo: [G([905, 829, 110, 12])], // at the polo pickup's counter, open from the morning
  hallcoffee: [[hallCoffee[0] - 5, hallCoffee[1] - 14, hallCoffee[2] + 10, 12], [hallCoffee[0] - 5, hallCoffee[1] + hallCoffee[3] + 2, hallCoffee[2] + 10, 14]],
  stairsUp: [receptionStairs, ...hallStairs],  // from the ground floor, the way up
  stairsDown: [stairs, ...sideStairs], // from the cinema level, the way down
};

// ---------------------------------------------------------------- grids
export const idx = (cx, cy) => cy * GW + cx;

// what stands on a booth (as drawn in render.js): the row of roll-up banners along its back, and the pop-up counter at its front
export function boothSolids({ rect: [bx, by, bw, bh], up, side }) {
  if (side === 'right') return [[bx + 3, by, 8, bh], [bx + bw - 20, by + bh / 2 - 22, 14, 44]]; // against the left wall: banners on the wall
  if (side === 'left') return [[bx + bw - 11, by, 8, bh], [bx + 6, by + bh / 2 - 22, 14, 44]];
  return up ? [[bx, by + bh - 10, bw, 7], [bx + bw / 2 - 24, by + 6, 48, 14]] : [[bx, by + 3, bw, 6], [bx + bw / 2 - 24, by + bh - 20, 48, 14]];
}
function fillRect(grid, [x, y, w, h], v) { // snapped to the grid: an off-grid rect must never shift its cells
  for (let cy = Math.floor(y / CELL); cy < Math.ceil((y + h) / CELL); cy++)
    for (let cx = Math.max(0, Math.floor(x / CELL)); cx < Math.min(GW, Math.ceil((x + w) / CELL)); cx++) grid[idx(cx, cy)] = v; // (clipped to the map: past its right edge, a cell would wrap round to the left of the next row)
}
export function rectCells([x, y, w, h]) {
  const out = [];
  for (let cy = Math.floor(y / CELL); cy < Math.ceil((y + h) / CELL); cy++)
    for (let cx = Math.floor(x / CELL); cx < Math.ceil((x + w) / CELL); cx++) out.push(idx(cx, cy));
  return out;
}

export function buildStatic() {
  const g = new Uint8Array(GW * GH).fill(1);
  walkable.forEach(r => fillRect(g, r, 0));
  for (const r of rooms) {
    fillRect(g, [r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0], 0);
    r.doors.forEach(d => fillRect(g, [d.x, d.y, d.w, d.h], 0));
    // just inside, the gap between the door and the side wall is filled in: in a crowd, people got pinned in that corner
    r.doors.forEach(d => fillRect(g, [d.x === r.x0 + 10 ? r.x0 : d.x + d.w, r.top ? r.y1 - 10 : r.y0, 10, 10], 1));
  }
  serviceDoorDefs.forEach(d => fillRect(g, [d.x, d.y, d.w, d.h], 0));
  fillRect(g, coffeeBar, 1);
  fillRect(g, popcornMachine, 1);
  tables.forEach(([x, y, w = TABLE_W]) => fillRect(g, [x, y, w, TABLE_H], 1));
  corridorPillars.forEach(r => fillRect(g, r, 1));
  cafeTables.forEach(([x, y]) => fillRect(g, [x - 5, y - 5, 10, 10], 1));
  // ground floor
  for (const b of bofRooms) fillRect(g, [b.door, b.rect[1] - 30, 30, 30], 0); // BOF doors onto reception
  toilets.forEach(t => { if (t.kiosk) { fillRect(g, t.kiosk, 1); fillRect(g, t.rect, 0); } fillRect(g, t.door, 0); });
  [receptionFlight, ...hallFlightDefs].forEach(f => f.rails.forEach(r => fillRect(g, r, 1))); // the flights: only their railings stop you
  landingRails.forEach(r => fillRect(g, r, 1));
  fillRect(g, receptionCounter, 1);
  loungeSofas.forEach(r => fillRect(g, r, 1));
  // the hall's rounded top-left corner (the curved wall on the plan)
  // (an ellipse from x 557 at y 240 to x 667 at y 60, as drawn on the plan)
  for (let cy = Math.floor((GROUND + 60) / CELL); cy < (GROUND + 240) / CELL; cy++)
    for (let cx = 49; cx < 67; cx++) if (((cx * CELL + 5 - 667) / 110) ** 2 + ((cy * CELL + 5 - (GROUND + 240)) / 180) ** 2 > 1) g[idx(cx, cy)] = 1;
  fillRect(g, poloDesk, 1);
  hallPillars.forEach(r => fillRect(g, r, 1));
  fillRect(g, hallCoffee, 1);
  booths.forEach(b => boothSolids(b).forEach(r => fillRect(g, r, 1))); // a booth's carpet is walkable: only its banners and counter are in the way (Jessica)
  fillRect(g, bikeCorner, 1);
  return g;
}

// the attendees' walls: the service doors and fire exits are closed to them, so the service corridors are staff only
export function closeService(grid) {
  serviceDoorDefs.forEach(d => fillRect(grid, [d.x, d.y, d.w, d.h], 1));
  return grid;
}

export function targetCells(key, staticGrid) {
  let rects;
  if (key.startsWith('room:')) { const s = roomByN[+key.slice(5)].seats; rects = [[s.x, s.y, s.w, s.h]]; }
  else rects = targetsDef[key];
  const set = new Set();
  rects.forEach(r => rectCells(r).forEach(c => { if (!staticGrid[c]) set.add(c); }));
  return Int32Array.from(set);
}

// seats per room, from the Kinepolis plan: people pick a talk in proportion
export const SEATS = { 3: 345, 4: 364, 5: 684, 6: 408, 7: 407, 8: 746, 9: 426, 10: 304 };

