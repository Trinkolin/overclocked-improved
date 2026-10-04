// Drawing: a pre-rendered building layer, dynamic entities, then a cinema
// lightmap (dim, pools of ceiling light, glowing screens) on top.
import { W, H, GW, GH, CELL, rooms, ROOM_HUES, coffeeBar, popcornMachine, lounge, stairs, stairsWide, kinepolisRooms, FLOOR_H, floorH, GROUND, floorOf, receptionDesk, receptionStairs, hallStairs, hallFlights, poloDesk, hallPillars, corridorPillars, cafeTables, hallStairwells, landingRails, loungeSofas, receptionFlight, hallFlightDefs, bofRooms, booths, bikeCorner, mainEntrance, hallCoffee, sideStairs, portals, SEATS, toilets, ramp, hallSteps, stairwells, tables, TABLE_W, TABLE_H, chargers } from './level.js';
import { drawRobot, COLORS, LOW, LOW_BELOW } from './robots.js';
import { SHIRTS, SKINS, skinOf } from './crowd.js';
import { LOUNGE, DETER, BAG_CHECK, INCIDENTS, SPOTS, BUBBLE_TYPING } from './game.js';

// the kinds of talk in the Devoxx schedule's colours (its theme): Deep Dive green, keynotes and Lunch Talks blue, Conference,
// Tools-in-Action and BOF grey; Hands-on Labs take the theme's amber. The colour of a title's card says what kind of talk it is
const DEVOXX = { bg: '#fdfdfe', text: '#0f172a', blue: '#3b82f6', green: '#22bd89', amber: '#f59e0b', grey: '#94a3b8' };
const TYPE_COLORS = { 'Deep Dive': DEVOXX.green, Keynote: DEVOXX.blue, 'Closing Keynote': DEVOXX.blue, 'Lunch Talk': DEVOXX.blue,
  Conference: DEVOXX.grey, 'Tools-in-Action': DEVOXX.grey, BOF: DEVOXX.grey, Documentary: DEVOXX.grey, 'Hands-on Lab': DEVOXX.amber };
const typeColor = type => TYPE_COLORS[type] || DEVOXX.grey;
const TITLE_FONT = '700 10px system-ui';
// a railing around stairs, seen from above: its dark base, a glass panel, posts, and the steel handrail on top
function balustrade(x, [bx, by, bw, bh]) {
  const along = bw >= bh, cx = bx + bw / 2, cy = by + bh / 2;
  x.fillStyle = '#23252c'; x.fillRect(bx, by, bw, bh);
  x.fillStyle = 'rgba(170,210,240,0.35)'; if (along) x.fillRect(bx, cy - 2.5, bw, 5); else x.fillRect(cx - 2.5, by, 5, bh);
  x.fillStyle = '#8f98a6'; for (let t = 2; t < (along ? bw : bh) - 2; t += 9) if (along) x.fillRect(bx + t, cy - 2, 3, 4); else x.fillRect(cx - 2, by + t, 4, 3);
  x.fillStyle = '#e2e7ee'; if (along) x.fillRect(bx, cy - 1, bw, 2); else x.fillRect(cx - 1, by, 2, bh);
}

// a card like one on the Devoxx schedule, on a room's screen: the talk's title (a line or a few), and the colour of its kind of talk
// down its left side (y0: the card's top). The talk on now is lit, white with dark text; the next one is dark, with light text
function card(x, lines, cx, y0, color, now) {
  x.font = TITLE_FONT; x.textAlign = 'center';
  const sw = Math.max(...lines.map(l => x.measureText(l).width)) + 22, x0 = cx - sw / 2, h = 8 + lines.length * 11;
  x.fillStyle = now ? DEVOXX.bg : 'rgba(15,23,42,0.88)'; x.beginPath(); x.roundRect(x0, y0, sw, h, 5); x.fill();
  if (!now) { x.strokeStyle = 'rgba(253,253,254,0.35)'; x.lineWidth = 1; x.stroke(); }
  x.save(); x.clip(); x.fillStyle = color; x.fillRect(x0, y0, 6, h); x.restore();
  x.fillStyle = now ? DEVOXX.text : 'rgba(253,253,254,0.85)';
  lines.forEach((l, i) => x.fillText(l, cx + 3, y0 + 13 + i * 11));
}

// Seating as in the Kinepolis rooms: three blocks of seats running to the walls, with the two aisles between them.
// The middle block holds about half a row and the side blocks the rest, so the bigger the room, the more seats on the
// sides (and the back rows, wider, get one more). Drawn only: people can reach any seat.
const AISLE_W = 12, SEAT_W = 9;
const aislesOf = r => { const cx = (r.x0 + r.x1) / 2, half = Math.round((r.x1 - r.x0 - 50) * 0.25 / r.seatW) * r.seatW; return [cx - half - AISLE_W, cx + half]; };
const rowsOf = r => r.rows; // as in the Kinepolis rooms, the rows go all the way to the back wall (level.js)
// rooms whose look we have from the Kinepolis virtual tour: anthracite walls and a plain dark carpet instead of the red walls
// and beige floor; Zaal 3 to 9: in front of the cross aisle the rows run unbroken, with an aisle along each side wall (three blocks
// behind it, as elsewhere); Zaal 3 and 4: one wide middle block, two aisles two seats in from the walls from front to back (LEDs on the steps only); Zaal 10: one aisle only, up its right-hand side behind a low wall, and two wheelchair places in front
const ROOM_CARPET = '#2f2c2b'; // the rooms' carpet: one plain colour, aisles and cross aisle included (Jessica)
const TOUR = { walls: '#2c2f36', floor: ROOM_CARPET, frontAtWalls: true };
const ROOM_LOOK = { 3: { ...TOUR, frontAtWalls: false, doorSeats: 3, doorSeatRows: [[0, 3], [13, 16]] }, 4: { ...TOUR, frontAtWalls: false, sideSeats: 3, doorSeatRows: [[0, 3], [13, 17]] }, 5: { ...TOUR, frontAtWalls: false, sideSeats: 7, doorFew: [13, 17, 4] }, 6: { ...TOUR, frontAtWalls: false, sideSeats: 4, doorSeatRows: [[0, 3], [12, 17]] }, 7: { ...TOUR, frontAtWalls: false, sideSeats: 4, doorSeatRows: [[0, 2], [13, 17]] }, 8: { ...TOUR, frontAtWalls: false, sideSeats: 7, doorFew: [13, 17, 4] }, 9: { ...TOUR, frontAtWalls: false, sideSeats: 4, doorSeatRows: [[0, 3], [13, 17]] }, 10: { walls: '#2c2f36', floor: '#2f2c2b', oneAisle: true, wheelchairs: 2, frontGap: 4, outerSeats: 3, outerRows: 5 } };
const look = r => ROOM_LOOK[r.n] || {};
// the aisles of row i (x of each aisle's left edge): the two between the blocks, or a room's own (ROOM_LOOK)
const aislesAt = (r, i) => {
  const L = look(r), right = r.x1 - 2 - AISLE_W;
  if (L.oneAisle) return [right - (L.outerSeats || 0) * r.seatW]; // Zaal 10: its aisle 3 seats in from the wall
  if (L.doorSeats) { const k = L.doorSeats * r.seatW; return r.doors[0].x < r.cx ? [r.x0 + 2 + k, right] : [r.x0 + 2, right - k]; } // Zaal 3: 19 seats between its two aisles, and 3 more beyond the one on the door's side
  if (L.sideSeats) { const k = L.sideSeats * r.seatW; return [r.x0 + 2 + k, right - k]; } // Zaal 3 and 4: two aisles two seats in from the walls, front to back (virtual tour)
  if (L.frontAtWalls && i < r.cross) return [r.x0 + 2, right];
  if (L.frontSideSeats && i < r.cross) { const k = L.frontSideSeats * r.seatW; return [r.x0 + 2 + k, right - k]; } // Zaal 4: two seats by each wall
  if (L.frontAisleAtDoor && i < r.cross) return [r.doors[0].x < r.cx ? r.x0 + 2 : right]; // Zaal 3: one, on its door's side
  return aislesOf(r);
};
// the projection room: along the back wall, the whole width of the room (Jessica), above the way in; the ⚠ panel shows on it (panelOf in game.js)
const GROUND_SHOWN = [20, 1010]; // the part of the ground floor shown whole on a big screen (world y from its top)
const BOOTH_D = 26, boothOf = r => ({ x0: r.x0 + 2, x1: r.x1 - 2, y: r.top ? r.y1 - BOOTH_D : r.y0 });
// row i (0: the front row): its y, and the centre of every seat in each of its blocks (lined up on the aisles). In the back
// rows, the doorways and the projection room stay clear; the cross aisle is a row with no seats
function rowOf(r, i) {
  const A = aislesAt(r, i), x0 = r.x0 + 2, x1 = r.x1 - 2, SW = r.seatW, h = SW / 2; // the side blocks run right up to the side walls
  const y = r.top ? r.y0 + 40 + i * r.pitch : r.y1 - 40 - i * r.pitch, back = Math.abs(y - (r.top ? r.y1 : r.y0));
  const clear = sx => back >= BOOTH_D + 4 || !r.doors.some(d => sx + h > d.x - 2 && sx - h < d.x + d.w + 2) && !(sx + h > boothOf(r).x0 && sx - h < boothOf(r).x1);
  // the blocks between the aisles: the first lined up on the first aisle (filled leftwards from it), the others on the aisle
  // to their left
  const parts = [];
  for (let k = 0; k <= A.length; k++) {
    const from = k ? A[k - 1] + AISLE_W : x0, to = k < A.length ? A[k] : x1, seats = [];
    if (k === 0) { for (let sx = to - h; sx - h >= from - 0.01; sx -= SW) seats.push(sx); seats.reverse(); }
    else for (let sx = from + h; sx + h <= to + 0.01; sx += SW) seats.push(sx);
    parts.push(seats);
  }
  const L = look(r);
  if (L.doorFew && i >= L.doorFew[0] && i <= L.doorFew[1]) { // Zaal 5 and 8: 5 rows on the door's side with only 4 seats by the aisle (the way in along the wall): right behind the cross aisle
    const left = r.doors[0].x < r.cx, p = parts[left ? 0 : parts.length - 1];
    if (left) p.splice(0, Math.max(0, p.length - L.doorFew[2])); else p.splice(L.doorFew[2]);
  }
  if (L.outerSeats && i < r.rows - L.outerRows) parts[parts.length - 1] = []; // Zaal 10: beyond its aisle, 3 seats in the last 5 rows only
  if (L.frontGap && i === 0) { const p = parts[0]; p.splice(p.length - L.frontGap); } // Zaal 10: the front row, 4 seats short on the aisle side, for the wheelchairs
  if (L.doorSeatRows && !L.doorSeatRows.some(([a, b]) => i >= a && i <= b)) { // Zaal 3 and 4: those 3 seats only in the first 4 rows and the last 4; between, the way in from the door, along the railing
    parts[r.doors[0].x < r.cx ? 0 : parts.length - 1] = [];
  }
  const blocks = [];
  if (i === r.cross) return { y, blocks }; // the cross aisle (level.js), as in the Kinepolis photos
  for (const block of parts) {
    let run = [];
    for (const sx of block) if (clear(sx)) run.push(sx); else if (run.length) { blocks.push(run); run = []; }
    if (run.length) blocks.push(run);
  }
  return { y, blocks };
}
// people going to or from a talk walk under the back rows, from the doors to the cross aisle: they only show on the cross aisle
// and in front of it (fans after a robot stay in sight)
const underSeats = a => { if (a.kind === 'pest') return false; for (const r of rooms) if (a.x > r.x0 && a.x < r.x1 && a.y > r.y0 && a.y < r.y1) return r.top ? a.y > r.crossY + 5 : a.y < r.crossY - 5; return false; };
// the "Room N" screen beside a door: on its left, or on its right when a stairwell is there
const screenX = d => hallStairwells.some(([sx, , sw]) => d.x - 13 < sx + sw && d.x - 3 > sx) ? d.x + d.w + 3 : d.x - 13;
const roomIn = (px, py) => rooms.find(r => px > r.x0 && px < r.x1 && py > r.y0 && py < r.y1);
const roomAt = (px, py) => !!roomIn(px, py);
const SS = 2; // static layer supersampling
// the system setting "reduce motion": no screen shake (read every frame, it can change while the game runs)
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.staticLayer = null;
    this.light = null;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth, vh = window.innerHeight;
    // the map sits between the top bar and the robot cards, never under them (the cards shrink on small screens)
    const cards = document.getElementById('cards'), ch = cards && cards.offsetHeight;
    const TOP = 62, BOTTOM = ch ? ch + 16 : 136;
    document.documentElement.style.setProperty('--cardsH', `${BOTTOM}px`);
    const availH = vh - TOP - BOTTOM;
    const s = Math.min(vw / W, availH / FLOOR_H); // the screen shows one floor at a time
    // a phone (or a small window): the whole floor would be tiny, so the map fills the space and the camera
    // zooms in about twice and follows your robot. On a laptop nothing changes: the whole floor is on screen.
    // (since the robots are at their real size, a phone zooms in further: about one screen pixel per 7 cm)
    this.zoomed = s < 0.5;
    const zs = this.zoomed ? Math.min(1, s * 3.6) : s;
    this.viewW = this.zoomed ? Math.min(W, vw / zs) : W; this.viewH = this.zoomed ? Math.min(FLOOR_H, availH / zs) : FLOOR_H;
    this.cssW = Math.floor(this.viewW * zs); this.cssH = Math.floor(this.viewH * zs);
    this.cv.style.width = this.cssW + 'px'; this.cv.style.height = this.cssH + 'px';
    this.cv.style.left = Math.floor((vw - this.cssW) / 2) + 'px';
    this.cv.style.top = Math.floor(TOP + (vh - TOP - BOTTOM - this.cssH) / 2) + 'px';
    this.cv.width = Math.floor(this.cssW * dpr); this.cv.height = Math.floor(this.cssH * dpr);
    this.scale = this.cv.width / this.viewW;
    this.camX = undefined; // re-centre the camera
  }

  // ---------------------------------------------------------------- static
  buildStatic(game) {
    const c = document.createElement('canvas');
    c.width = W * SS; c.height = H * SS;
    const x = c.getContext('2d');
    x.scale(SS, SS);
    const g = game.staticGrid;

    // outside: the Antwerp night
    x.fillStyle = '#0a0c10';
    x.fillRect(0, 0, W, H);

    // walkable floors
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
      if (g[cy * GW + cx]) continue;
      const px = cx * CELL, py = cy * CELL;
      x.fillStyle = floorColor(px, py, cx, cy);
      x.fillRect(px, py, CELL, CELL);
    }
    // corridor: the Kinepolis navy carpet, speckled (from the venue photos)
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 3200; i++) {
      const px = 200 + rand() * 1100, py = 330 + rand() * 170;
      x.fillStyle = rand() < 0.5 ? 'rgba(90,130,210,0.22)' : 'rgba(10,12,24,0.5)';
      x.fillRect(px, py, 1.2, 1.2);
    }

    // rooms: raked seating facing the screen, as in the Kinepolis photos (house lights up): grey seats, a beige carpet
    // in front of the screen, carpeted aisles with a red LED light on every step, and red walls (see the wall pass below).
    // During a talk the house lights go down: see houseLights().
    for (const r of rooms) {
      const rows = rowsOf(r), screenY = r.top ? r.y0 + 6 : r.y1 - 6;
      x.fillStyle = look(r).floor || '#5b544d'; x.fillRect(r.x0, r.top ? r.y0 : r.y1 - 32, r.x1 - r.x0, 32); // the flat floor in front of the screen
      // (a plain carpet, one colour, as in every Kinepolis room)
      for (let i = 0; i < rows; i++) {
        const { y: ry, blocks } = rowOf(r, i), h = r.seatW / 2;
        for (const seats of blocks) {
          if (!seats.length) continue;
          const bx = seats[0] - h, bw = seats[seats.length - 1] + h - bx;
          x.fillStyle = i % 2 ? '#4e5159' : '#585c65'; // the grey seats
          x.beginPath(); x.roundRect(bx, ry - 4, bw, 8, 3); x.fill();
          x.fillStyle = '#30333a'; x.fillRect(bx + 1, r.top ? ry + 2 : ry - 4, bw - 2, 2); // the backrests, away from the screen
          x.fillStyle = 'rgba(0,0,0,0.35)';
          for (let k = 1; k < seats.length; k++) x.fillRect(seats[k] - h - 0.5, ry - 4, 1, 8); // armrests
        }
      }
      // the aisles, up to the back wall, row by row (a room's front rows may have theirs elsewhere): carpeted steps and a
      // handrail on each side
      const step = i => (r.top ? r.y0 + 33 + i * r.pitch : r.y1 - 33 - i * r.pitch); // the edge of step i, in front of row i
      for (let i = 0; i < rows; i++) {
        const ya = i === 0 ? (r.top ? r.y0 + 30 : r.y1 - 30) : step(i), yb = i === rows - 1 ? (r.top ? r.y1 : r.y0) : step(i + 1);
        const top = Math.min(ya, yb), len = Math.abs(yb - ya);
        for (const ax of aislesAt(r, i)) {
          x.fillStyle = look(r).floor || ROOM_CARPET; x.fillRect(ax, top, AISLE_W, len); // the same plain carpet as the rest of the room
          x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(ax, step(i), AISLE_W, 1);
          for (const wx of [ax - 1.4, ax + AISLE_W - 0.2]) { // a low wall on each side of the aisle (Jessica), with a light top edge
            x.fillStyle = '#4c4f57'; x.fillRect(wx, top, 1.6, len); x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(wx + 0.5, top, 0.6, len);
          }
        }
      }
      if (look(r).doorSeatRows) { // Zaal 3 and 4: behind the cross aisle, on the door's side, the way in with a safety railing along the aisle
        const A0 = aislesAt(r, 0), left = r.doors[0].x < r.cx, ax = left ? A0[0] - 1.5 : A0[A0.length - 1] + AISLE_W + 0.5;
        const R = look(r).doorSeatRows, yb = R[1] ? (r.top ? r.y0 + 40 + (R[1][0] - 0.5) * r.pitch : r.y1 - 40 - (R[1][0] - 0.5) * r.pitch) : (r.top ? r.y1 - 4 : r.y0 + 4); // up to the last rows' seats, or the back wall // up to the last rows' 3 seats
        const y0 = r.top ? r.crossY + 5 : yb, y1 = r.top ? yb : r.crossY - 5;
        x.fillStyle = 'rgba(200,206,214,0.7)'; x.fillRect(ax, y0, 1, y1 - y0); // its barrier
        if (R[1]) balustrade(x, [left ? r.x0 + 2 : ax + 1, yb - 2, left ? ax - r.x0 - 2 : r.x1 - 3 - ax, 4]); // and a railing across, where the back rows' seats start, as on the stairs (Jessica)
      }
      const rowEdge = i => (r.top ? r.y0 + 40 + (i - 0.5) * r.pitch : r.y1 - 40 - (i - 0.5) * r.pitch); // between rows i - 1 and i
      if (look(r).doorFew) { // Zaal 5 and 8: a railing along the 4 seats, between them and the way in by the wall (Jessica)
        const L = look(r), A0 = aislesAt(r, L.doorFew[0]), left = r.doors[0].x < r.cx, k = L.doorFew[2] * r.seatW;
        const bx = left ? A0[0] - k - 4 : A0[A0.length - 1] + AISLE_W + k, ya = rowEdge(L.doorFew[0]), yb = rowEdge(L.doorFew[1] + 1);
        balustrade(x, [bx, Math.min(ya, yb), 4, Math.abs(yb - ya)]);
      }
      if (look(r).outerSeats) { // Zaal 10: a railing across, where its 3 outer seats start (Jessica)
        const ax = aislesAt(r, 0)[0] + AISLE_W + 1, y = rowEdge(r.rows - look(r).outerRows);
        balustrade(x, [ax, y - 2, r.x1 - 3 - ax, 4]);
      }
      if (look(r).landing) { // Zaal 5: the landing where the foyer door comes in, by the wall behind the cross aisle (Jessica's sketch)
        const L = look(r), A0 = aislesAt(r, 0), left = r.doors[0].x < r.cx, sw = r.seatW, k = L.doorFew[2] * sw;
        const lx0 = left ? r.x0 + 2 : A0[A0.length - 1] + AISLE_W + k, lx1 = left ? A0[0] - k : r.x1 - 2;
        const ya = rowOf(r, L.landing[0]).y, yb = rowOf(r, L.landing[1]).y, top = Math.min(ya, yb) - r.pitch / 2, h = Math.abs(yb - ya) + r.pitch;
        x.fillStyle = '#3b3538'; x.fillRect(lx0, top, lx1 - lx0, h);
        x.fillStyle = 'rgba(200,206,214,0.55)'; x.fillRect(left ? lx1 - 1 : lx0, top, 1, h); // its railing along the seats
        x.fillStyle = '#9aa0ad'; for (const [bx, by] of [[lx0 + (lx1 - lx0) * 0.35, top + h * 0.3], [lx0 + (lx1 - lx0) * 0.65, top + h * 0.3]]) { x.beginPath(); x.arc(bx, by, 2.6, 0, 7); x.fill(); } // the Kinepolis bins
      }
      if (look(r).oneAisle) { // the low wall between the seats and the aisle
        const ax = aislesAt(r, 0)[0]; x.fillStyle = '#4a4547'; x.fillRect(ax - 2, r.top ? r.y0 + 30 : r.y0, 2, r.depth - 30);
      }
      for (let k = 0; k < (look(r).wheelchairs || 0); k++) { // the wheelchair places, in front of the first row, on the aisle side
        const wx = aislesAt(r, 0)[0] + 2 - (k + 1) * (look(r).frontGap ? look(r).frontGap * r.seatW / 2 : 22), wy = r.top ? r.y0 + 36 : r.y1 - 44; // in the front row's gap
        x.fillStyle = '#2f5fae'; x.fillRect(wx, wy, 14, 10); x.fillStyle = '#ffffff'; x.font = '700 8px system-ui'; x.textAlign = 'center'; x.fillText('♿', wx + 7, wy + 8);
      }
      // the cross aisle between the two tiers: carpet from wall to wall, and the upper tier's railing
      if (r.cross != null) {
        x.fillStyle = look(r).floor || ROOM_CARPET; x.fillRect(r.x0, r.crossY - 5, r.x1 - r.x0, 10);
        for (const by of [r.crossY - 5.5, r.crossY + 4.5]) { // a barrier along each side of it, open where the aisles cross it
          const gaps = aislesAt(r, r.cross).concat(aislesAt(r, r.cross + 1)), open = px => gaps.some(ax => px > ax - 1 && px < ax + AISLE_W + 1);
          x.fillStyle = 'rgba(200,206,214,0.6)';
          for (let px = r.x0 + 4; px < r.x1 - 4; px += 1) if (!open(px)) x.fillRect(px, by, 1, 1);
        }
      }
      // speakers high on the side walls
      x.fillStyle = '#121216';
      for (let d = 30; d < r.depth - 20; d += 38) { const sy = r.top ? r.y0 + d : r.y1 - d; x.fillRect(r.x0 + 1, sy - 4, 3, 8); x.fillRect(r.x1 - 4, sy - 4, 3, 8); }
      // the projection room along the back wall, where the ⚠ panel shows when something breaks, its windows facing the screen
      const bo = boothOf(r), bw = bo.x1 - bo.x0;
      x.fillStyle = '#1d1f25'; x.fillRect(bo.x0, bo.y, bw, BOOTH_D);
      x.strokeStyle = 'rgba(255,255,255,0.14)'; x.lineWidth = 1; x.strokeRect(bo.x0 + 0.5, bo.y + 0.5, bw - 1, BOOTH_D - 1);
      x.fillStyle = 'rgba(201,214,232,0.55)'; for (let wx = bo.x0 + 10; wx + 6 <= bo.x1 - 8; wx += 22) x.fillRect(wx, r.top ? bo.y : bo.y + BOOTH_D - 2, 6, 2);
      // screen
      x.fillStyle = '#c9d6e8';
      x.fillRect(r.x0 + 24, screenY - 2, r.x1 - r.x0 - 48, 4);
      // (the big room number and its capacity are drawn over everything, each frame: see drawRoomNumbers)
    }

    // the Kinepolis rooms Devoxx doesn't use: dark and closed, numbered like the Kinepolis plan
    for (const r of kinepolisRooms) {
      x.fillStyle = '#0d0e12'; x.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
      for (let i = 0; i < 9; i++) {
        const ry = r.top ? r.y0 + 40 + i * 20 : r.y1 - 40 - i * 20;
        if (ry < r.y0 + 20 || ry > r.y1 - 20) continue;
        x.fillStyle = i % 2 ? '#1a1c22' : '#202329';
        x.beginPath(); x.roundRect(r.x0 + 12, ry - 5, r.x1 - r.x0 - 24, 9, 3); x.fill();
      }
      x.save();
      x.fillStyle = 'rgba(255,255,255,0.07)'; x.font = '800 46px "Segoe UI", system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(r.n, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
      x.font = '600 7px system-ui'; x.fillStyle = 'rgba(255,255,255,0.22)';
      x.fillText(`KINEPOLIS ${r.n} · CLOSED`, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2 + 30);
      x.restore();
    }

    // walls: light edge where they meet a floor
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
      if (!g[cy * GW + cx]) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => {
        const nx = cx + ox, ny = cy + oy;
        return nx >= 0 && ny >= 0 && nx < GW && ny < GH && !g[ny * GW + nx];
      });
      if (!edge) continue;
      const corridorWall = cx * CELL >= 110 && cx * CELL < 1300 && (cy * CELL === 320 || cy * CELL === 500);
      const wallRoom = corridorWall ? null : [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ox, oy]) => roomIn((cx + ox) * CELL + 5, (cy + oy) * CELL + 5)).find(Boolean);
      const roomWall = !!wallRoom; // the Kinepolis red (or a room's own colour, ROOM_LOOK)
      const inHall = (px, py) => py >= GROUND + 60 && py < GROUND + 1000 && px >= 490 && px < 1500, [wx, wy] = [cx * CELL + 5, cy * CELL + 5];
      const hallWall = !corridorWall && !roomWall && !(inHall(wx, wy) && wy < GROUND + 870) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => inHall((cx + ox) * CELL + 5, (cy + oy) * CELL + 5)); // its white walls (not its booths)
      x.fillStyle = corridorWall ? '#5a1116' : roomWall ? look(wallRoom).walls || '#a8231d' : hallWall ? '#b9b3a9' : '#343944';
      x.fillRect(cx * CELL, cy * CELL, CELL, CELL);
      x.fillStyle = 'rgba(255,255,255,0.06)';
      x.fillRect(cx * CELL, cy * CELL, CELL, 2);
    }

    // "Room N" screens on stands beside each door, as in the corridor photos
    for (const r of rooms) for (const d of r.doors) {
      const tx = screenX(d), ty = r.top ? 336 : 488;
      x.fillStyle = '#0b0d12'; x.fillRect(tx, ty, 10, 6);
      x.fillStyle = '#8fb4ff'; x.fillRect(tx + 1, ty + 1, 8, 1.2);
      x.fillStyle = '#6a707b'; x.fillRect(tx + 4.5, r.top ? ty - 2 : ty + 6, 1, 2);
    }
    // closed doors on the Kinepolis rooms along the corridor
    for (const r of kinepolisRooms) if (r.x1 <= 1290) {
      x.fillStyle = '#2a2d34'; x.fillRect((r.x0 + r.x1) / 2 - 15, r.top ? 322 : 502, 30, 6);
    }
    // the lounge at the end of the corridor: the charging corner along the top, the coffee machine at the bottom, and two
    // sofas in between, facing it; the floor carries on to the cinema's own entrance, which Devoxx doesn't use
    { const [lx, ly, lw, lh] = lounge, ex = lx + lw;
      for (const [sx, sy, sw] of loungeSofas) { // seen from above: the backrest along the top, the seat cushions facing down
        x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.roundRect(sx + 1, sy + 2, sw, 13, 4); x.fill();
        x.fillStyle = '#2f4059'; x.beginPath(); x.roundRect(sx, sy, sw, 13, 4); x.fill();
        x.fillStyle = '#4d6690'; for (let i = 0; i < 3; i++) { x.beginPath(); x.roundRect(sx + 3 + i * (sw - 6) / 3, sy + 5, (sw - 6) / 3 - 1, 7, 2); x.fill(); }
      }
      x.fillStyle = '#1c2a38'; x.fillRect(ex - 4, 330, 8, 170); // the cinema's glass entrance doors, far end
      x.fillStyle = 'rgba(170,205,235,0.5)'; for (let py = 330; py < 500; py += 24) x.fillRect(ex - 4, py, 8, 2);
      x.save(); x.textAlign = 'center';
      x.fillStyle = 'rgba(255,255,255,0.2)'; x.font = '700 11px system-ui'; x.fillText('→ KINEPOLIS CINEMA ENTRANCE', 1440, 440);
      x.fillStyle = 'rgba(255,255,255,0.15)'; x.font = '600 9px system-ui'; x.fillText('not used during Devoxx', 1440, 454);
      x.restore(); }

    // grand staircase down to the exhibition hall
    const [sx, sy, sw, sh] = stairsWide;
    const sg = x.createLinearGradient(sx, 0, sx + sw, 0);
    sg.addColorStop(0, '#0b0c10'); sg.addColorStop(1, '#2a2c33');
    x.fillStyle = sg; x.fillRect(sx, sy, sw, sh);
    for (let px = sx; px < sx + sw; px += 5) { x.fillStyle = 'rgba(255,220,160,0.18)'; x.fillRect(px, sy, 1, sh); }
    x.save();
    x.translate(sx + sw / 2 - 2, sy + sh / 2); x.rotate(-Math.PI / 2);
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = '600 11px system-ui'; x.textAlign = 'center';
    x.fillText('▼ STAIRS · GROUND FLOOR', 0, 4);
    x.restore();
    // "< Ground floor >" on the Devoxx plan: the two stairwells down to the exhibition hall, against the walls between rooms 3 and 4
    // and between rooms 9 and 10, beside the doors of 3 and 10: the steps going down from left (light) to right (dark), with a railing
    // around them (and along both sides of the wide stairs from reception)
    for (const [ox, oy, ow, oh] of hallStairwells) {
      const gg = x.createLinearGradient(ox, 0, ox + ow, 0);
      gg.addColorStop(0, '#3a3e48'); gg.addColorStop(1, '#07080b');
      x.fillStyle = gg; x.fillRect(ox, oy, ow, oh);
      x.fillStyle = 'rgba(255,220,160,0.2)'; for (let px = ox + 2; px < ox + ow; px += 4) x.fillRect(px, oy + 2, 1, oh - 4);
    }
    landingRails.forEach(r => balustrade(x, r));
    x.fillStyle = 'rgba(255,255,255,0.5)'; x.font = '700 8px system-ui'; x.textAlign = 'center';
    x.fillText('▲ ▼ GROUND FLOOR · EXHIBITION HALL', sideStairs[0][0] + sideStairs[0][2] / 2, 415 + 3);

    // the popcorn machine: a red cart with a glass box full of popcorn
    { const [px, py, pw, ph] = popcornMachine;
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(px + 2, py + 3, pw, ph);
      x.fillStyle = '#b3202c'; x.beginPath(); x.roundRect(px, py, pw, ph, 4); x.fill();
      x.fillStyle = '#f4f0e6'; for (let i = 0; i < 4; i++) x.fillRect(px + 4 + i * 9, py + 2, 4, ph - 4); // the stripes
      x.fillStyle = 'rgba(200,230,255,0.5)'; x.fillRect(px + 6, py + 6, pw - 12, 16); // the glass box
      x.fillStyle = '#ffe08a'; for (let i = 0; i < 10; i++) { x.beginPath(); x.arc(px + 9 + (i * 7) % (pw - 16), py + 18 - Math.floor(i / 4) * 4, 2.2, 0, 7); x.fill(); }
      x.fillStyle = '#ffd23c'; x.font = '800 7px system-ui'; x.textAlign = 'center'; x.fillText('POPCORN', px + pw / 2, py + ph - 5); }
    // coffee bar
    const [cx0, cy0, cw, ch] = coffeeBar;
    x.fillStyle = '#4a3222'; x.beginPath(); x.roundRect(cx0, cy0, cw, ch, 8); x.fill();
    x.fillStyle = '#7b5537'; x.beginPath(); x.roundRect(cx0 + 5, cy0 + 5, cw - 10, ch - 10, 5); x.fill();
    x.fillStyle = '#f3e6d4'; x.font = '700 12px system-ui'; x.textAlign = 'center'; x.fillText('☕ COFFEE', cx0 + cw / 2, cy0 + ch / 2 + 7);
    for (let i = 0; i < 5; i++) { x.fillStyle = '#eee'; x.beginPath(); x.arc(cx0 + 13 + i * 16, cy0 + 11, 2.2, 0, 7); x.fill(); }

    // the foyer's pillars, two per row with a wide lane between them: plain black squares (the white fabric sails above
    // them are up at the ceiling: not drawn, they hid the crowd)
    x.fillStyle = '#000';
    for (const [px, py, pw, ph] of corridorPillars) x.fillRect(px - 1, py - 1, pw + 2, ph + 2);
    // the café corner: round tables, orange chairs around them
    for (const [tx, ty] of cafeTables) {
      for (const an of [0.3, 1.9, 3.5, 5.0]) {
        const sx = tx + Math.cos(an) * 10, sy = ty + Math.sin(an) * 8;
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.roundRect(sx - 3, sy - 2, 7, 7, 2); x.fill();
        x.fillStyle = '#d98a3a'; x.beginPath(); x.roundRect(sx - 3.5, sy - 3.5, 7, 7, 2); x.fill();
      }
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.arc(tx + 1, ty + 2, 7, 0, 7); x.fill();
      x.fillStyle = '#2a2622'; x.beginPath(); x.arc(tx, ty, 7, 0, 7); x.fill();
      x.strokeStyle = 'rgba(255,230,190,0.35)'; x.lineWidth = 1; x.stroke();
    }
    // standing tables: black top, thin legs, a little plant in a yellow pot
    for (const [tx, ty, tw = TABLE_W] of tables) {
      const cx = tx + tw / 2, cy = ty + TABLE_H / 2;
      x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(tx - 1, ty + 1, tw + 4, TABLE_H + 4);
      x.fillStyle = '#131417'; x.fillRect(tx - 2, ty - 2, tw + 4, TABLE_H + 4);
      x.strokeStyle = 'rgba(255,255,255,0.22)'; x.lineWidth = 1; x.strokeRect(tx - 1.5, ty - 1.5, tw + 3, TABLE_H + 3);
      x.fillStyle = '#e0ad22'; x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill();
      x.fillStyle = '#62b34f'; for (const [ox, oy] of [[-2.5, -2], [2.5, -2], [0, 2.5], [-2.5, 1.5], [2.5, 1.5], [0, -3]]) { x.beginPath(); x.arc(cx + ox, cy + oy, 1.8, 0, 7); x.fill(); }
    }
    // labels
    x.fillStyle = 'rgba(255,255,255,0.3)'; x.font = '600 10px system-ui'; x.textAlign = 'left';
    x.save(); x.font = '600 9px system-ui'; x.fillStyle = 'rgba(255,255,255,0.18)'; x.textAlign = 'center';
    x.restore();
    x.font = '600 10px system-ui'; x.fillStyle = 'rgba(255,255,255,0.35)';
    x.fillText('KINEPOLIS ANTWERP · CINEMA LEVEL (1ST FLOOR)', 1312, 562);

    this.drawGroundStatic(x);
    this.staticLayer = c;
    this.buildLight();
  }

  // the ground floor, from the annotated Devoxx plan: main entrance, reception and the wide
  // stairs up to the rooms, the BOF rooms, and the exhibition hall with its booths and stairs
  drawGroundStatic(x) {
    const F = GROUND;
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.07)'; x.font = '900 34px "Segoe UI", system-ui, sans-serif';
    x.fillText('EXHIBITION HALL', 1150, F + 950); // on the night outside, under the hall
    // the big grey words on the hall's white walls (the drone video), along its top wall
    x.fillStyle = 'rgba(205,210,218,0.22)'; x.font = '800 30px "Segoe UI", system-ui, sans-serif';
    [['exchange', 790], ['share', 960], ['celebrate', 1130]].forEach(([w, wx]) => x.fillText(w, wx, F + 32));
    // the passage from the toilets' door (in the hall's top wall) to the toilet block in the corner
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = '800 9px system-ui'; x.fillText('🚻 TOILETS ▸', 1420, F + 33);
    // the bike corner: fake grass, three exercise bikes
    { const [kx, ky, kw, kh] = bikeCorner;
      x.fillStyle = '#4c8a2f'; x.fillRect(kx, ky, kw, kh);
      x.fillStyle = 'rgba(255,255,255,0.06)'; for (let k = 0; k < kw; k += 6) x.fillRect(kx + k, ky, 2, kh);
      for (let k = 0; k < 3; k++) { const cx0 = kx + 28 + k * 47, cy0 = ky + kh / 2;
        x.strokeStyle = '#1a1c20'; x.lineWidth = 2.5; x.beginPath(); x.arc(cx0 - 9, cy0, 7, 0, 7); x.stroke(); x.beginPath(); x.arc(cx0 + 9, cy0, 7, 0, 7); x.stroke();
        x.strokeStyle = '#c8ccd2'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx0 - 9, cy0); x.lineTo(cx0, cy0 - 4); x.lineTo(cx0 + 9, cy0); x.stroke(); }
      x.fillStyle = 'rgba(255,255,255,0.7)'; x.font = '700 8px system-ui'; x.fillText('🚲 BIKE CHALLENGE', kx + kw / 2, ky - 7); }
    // sponsor booths
    const BOOTH = ['#3d5a80', '#8c2f39', '#4f6b3a', '#c9a227', '#5e3a6e', '#2d6f73'];
    booths.forEach((b, i) => {
      const [bx, by, bw, bh] = b.rect;
      // as at Devoxx (the sponsors' photos): a patch of carpet, three printed roll-up banners side by side at the back, and a
      // small black pop-up counter at the front, facing the aisle, with a laptop on it
      const col = BOOTH[i % BOOTH.length], back = b.up ? by + bh - 9 : by + 3, front = b.up ? by + 6 : by + bh - 20;
      if (b.side) { // against the left (or right) wall, facing into the hall: the banners against the wall, the counter in front
        x.save(); if (b.side === 'left') { x.translate(bx * 2 + bw, 0); x.scale(-1, 1); } // the right wall's: mirrored
        x.fillStyle = '#34363d'; x.fillRect(bx, by, bw, bh);
        const ph = (bh - 12) / 3;
        for (let k = 0; k < 3; k++) { const py = by + 6 + k * ph;
          x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(bx + 5, py + 1, 6, ph - 2);
          x.fillStyle = '#ece8e0'; x.fillRect(bx + 3, py + 1, 6, ph - 2); x.fillStyle = col; x.fillRect(bx + 6, py + 1, 3, ph - 2); }
        x.fillStyle = '#0e0f12'; x.fillRect(bx + bw - 20, by + bh / 2 - 22, 14, 44);
        x.fillStyle = col; x.fillRect(bx + bw - 9, by + bh / 2 - 22, 3, 44);
        x.fillStyle = '#c9ced6'; x.fillRect(bx + bw - 17, by + bh / 2 - 6, 8, 12);
        x.restore();
        x.save(); if (b.side === 'left') { x.translate(bx * 2 + bw, 0); x.scale(-1, 1); }
        x.strokeStyle = 'rgba(220,224,230,0.45)'; x.lineWidth = 0.8; x.beginPath(); // the truss, down its back
        x.moveTo(bx - 1, by); x.lineTo(bx - 1, by + bh); x.moveTo(bx + 3, by); x.lineTo(bx + 3, by + bh);
        for (let k = 0; k < bh; k += 8) { x.moveTo(bx - 1, by + k); x.lineTo(bx + 3, by + k + 4); x.lineTo(bx - 1, by + k + 8); }
        x.stroke(); x.restore(); return;
      }
      x.fillStyle = '#34363d'; x.fillRect(bx, by, bw, bh);
      const pw = (bw - 16) / 3;
      for (let k = 0; k < 3; k++) {
        const px = bx + 8 + k * pw;
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px + 1, back + (b.up ? -2 : 2), pw - 2, 6);
        x.fillStyle = '#ece8e0'; x.fillRect(px + 1, back, pw - 2, 6); // the banner, seen edge-on from above: its printed face
        x.fillStyle = col; x.fillRect(px + 1, b.up ? back : back + 3, pw - 2, 3);
      }
      x.fillStyle = '#0e0f12'; x.fillRect(bx + bw / 2 - 24, front, 48, 14); // the counter
      x.fillStyle = col; x.fillRect(bx + bw / 2 - 24, b.up ? front : front + 11, 48, 3);
      x.fillStyle = '#c9ced6'; x.fillRect(bx + bw / 2 - 7, front + 3, 14, 8); // a laptop
      // (no name on it: Jessica)
      // the lighting truss over it: a light lattice along its back
      const ty = b.up ? by + bh - 3 : by + 1;
      x.strokeStyle = 'rgba(220,224,230,0.45)'; x.lineWidth = 0.8; x.beginPath();
      x.moveTo(bx, ty - 2); x.lineTo(bx + bw, ty - 2); x.moveTo(bx, ty + 2); x.lineTo(bx + bw, ty + 2);
      for (let k = 0; k < bw; k += 8) { x.moveTo(bx + k, ty - 2); x.lineTo(bx + k + 4, ty + 2); x.lineTo(bx + k + 8, ty - 2); }
      x.stroke();
    });
    // the flights: you walk every step, from the bottom (light) to the top (dark), between two railings. The reception desk is
    // under the wide stairs up from reception, as at Kinepolis: it shows through them, and comes out past them on the hall side
    const [rx, ry, rw, rh] = receptionDesk;
    x.fillStyle = '#e8e6e1'; x.fillRect(rx, ry, rw, rh);
    x.fillStyle = '#b9b4ab'; x.fillRect(rx, ry + rh - 6, rw, 6);
    const drawFlight = (f, climbsLeft, alpha = 1) => { // both climb along the floor's length: to the left in the hall, to the right at reception
      const [lx, ly, lw, lh] = f.lane;
      x.save();
      x.globalAlpha = alpha;
      const gg = climbsLeft ? x.createLinearGradient(lx + lw, 0, lx, 0) : x.createLinearGradient(lx, 0, lx + lw, 0);
      gg.addColorStop(0, '#3a3e48'); gg.addColorStop(1, '#0b0c10');
      x.fillStyle = gg; x.fillRect(lx, ly, lw, lh);
      x.fillStyle = 'rgba(255,220,160,0.18)'; for (let px = lx + 3; px < lx + lw; px += 5) x.fillRect(px, ly, 1, lh);
      x.globalAlpha = 1; f.rails.forEach(r => balustrade(x, r)); // the railings, on both sides and across the top
      x.restore();
    };
    drawFlight(receptionFlight, false, 0.78); // facing the main entrance
    hallFlightDefs.forEach(f => drawFlight(f, true)); // stepped on from the right
    hallFlightDefs.forEach(({ lane: [, ly, , lh] }) => { // their double doors, above and below the landing: open, two leaves each
      x.strokeStyle = 'rgba(180,230,170,0.55)'; x.lineWidth = 1;
      for (const [dy, dir] of [[ly - 5, -1], [ly + lh + 5, 1]]) for (const [hx, s] of [[1340, 1], [1380, -1]]) { x.beginPath(); x.moveTo(hx, dy); x.lineTo(hx + s * 14, dy + dir * 12); x.stroke(); }
    });
    const [lx0, , lw0] = receptionFlight.lane, vx0 = lx0 + lw0 + 10; // the desk's part out past the stairs, where its name shows
    x.fillStyle = 'rgba(58,61,70,0.95)'; x.font = '800 8px system-ui'; x.fillText('RECEPTION', (vx0 + rx + rw) / 2, ry + rh / 2 + 3);
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '700 9px system-ui';
    const [fx, fy, fw, fh] = receptionFlight.lane;
    x.fillText('▲ ROOMS', fx + fw / 2, fy - 14);
    x.font = '500 8px system-ui'; x.fillText('stairs up to the cinema level', fx + fw / 2, fy + fh + 11);
    hallFlights.forEach(r => { x.font = '700 9px system-ui'; x.fillText('▲ STAIRS TO THE CINEMA ROOMS', r[0] + r[2] / 2 - 20, r[1] - 14); });
    // the coffee station in the hall
    { const [cx0, cy0, cw, ch] = hallCoffee;
      x.fillStyle = '#4a3222'; x.beginPath(); x.roundRect(cx0, cy0, cw, ch, 8); x.fill();
      x.fillStyle = '#7b5537'; x.beginPath(); x.roundRect(cx0 + 5, cy0 + 5, cw - 10, ch - 10, 5); x.fill();
      x.fillStyle = '#f3e6d4'; x.font = '700 11px system-ui'; x.fillText('☕ COFFEE', cx0 + cw / 2, cy0 + ch / 2 + 1); }
    // Devoxx polo pickup: a white counter at the bottom of the hall, a red light along its foot (the Kinepolis photos)
    const [px0, py0, pw, ph] = poloDesk;
    x.fillStyle = 'rgba(255,60,50,0.35)'; x.fillRect(px0 - 2, py0 - 4, pw + 4, 4);
    x.fillStyle = '#efece6'; x.fillRect(px0, py0, pw, ph);
    x.fillStyle = '#d6d1c8'; x.fillRect(px0, py0, pw, 5);
    x.fillStyle = '#3a3d46'; x.font = '800 9px system-ui'; x.fillText('DEVOXX POLO PICKUP', px0 + pw / 2, py0 + ph / 2 + 2);
    // the hall's white pillars, square (about 1 m, a little wider than their nav cell)
    x.fillStyle = '#e9e5de'; // plain white squares, like the black ones upstairs
    for (const [cx0, cy0, cw0, ch0] of hallPillars) x.fillRect(cx0 - 2, cy0 - 2, cw0 + 4, ch0 + 4);
    // BOF rooms
    for (const b of bofRooms) {
      const [bx, by, bw, bh] = b.rect;
      // rows of tables facing the screen, with a centre aisle down the middle (and chairs behind each table)
      const half = (bw - 24 - 18) / 2;
      for (let ty = by + 44; ty < by + bh - 40; ty += 22) for (const tx of [bx + 12, bx + 12 + half + 18]) {
        x.fillStyle = '#3a3e47'; x.fillRect(tx, ty, half, 7);
        x.fillStyle = '#23262d'; for (let cx2 = tx + 3; cx2 < tx + half - 6; cx2 += 11) x.fillRect(cx2, ty - 6, 7, 5);
      }
      x.fillStyle = '#c9d6e8'; x.fillRect(bx + 20, by + bh - 10, bw - 40, 4); // the screen, at the far end from the door
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.font = '800 12px system-ui'; x.fillText(`BOF ${b.n}`, bx + bw / 2, by + 24);
    }
    { // their front wall onto reception, with a double door each in the middle, either side of the partition
      const [x0, wy] = [bofRooms[0].rect[0], bofRooms[0].rect[1] - 10], x1 = bofRooms[1].rect[0] + bofRooms[1].rect[2];
      x.fillStyle = '#6b7080'; x.fillRect(x0 - 5, wy + 2, x1 - x0 + 10, 7);
      for (const b of bofRooms) {
        x.fillStyle = '#1d1f25'; x.fillRect(b.door, wy, 30, 10); // the opening
        x.strokeStyle = '#9aa0ad'; x.lineWidth = 1.2; // two door leaves, open inwards
        x.beginPath(); x.moveTo(b.door + 1, wy + 9); x.lineTo(b.door + 1, wy + 22); x.moveTo(b.door + 29, wy + 9); x.lineTo(b.door + 29, wy + 22); x.stroke();
        x.beginPath(); x.arc(b.door + 1, wy + 9, 13, 0, Math.PI / 2); x.moveTo(b.door + 29 - 13, wy + 9); x.arc(b.door + 29, wy + 9, 13, Math.PI, Math.PI / 2, true); x.globalAlpha = 0.35; x.stroke(); x.globalAlpha = 1;
      }
    }
    // the toilets: white tiles, a row of cubicles, the sign
    for (const tl of toilets) {
      const [tx, ty, tw, th] = tl.rect, vert = th > tw;
      if (tl.kiosk) { // the rounded kiosk jutting into the corridor
        const [kx, ky, kw, kh] = tl.kiosk;
        x.fillStyle = '#2b2f37'; x.beginPath(); x.roundRect(kx, ky - 4, kw, kh + 4, [0, 0, 26, 26]); x.fill();
      }
      x.fillStyle = '#3a4048'; x.fillRect(tx, ty, tw, th);
      x.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < tw; i += 10) for (let j = (i / 10) % 2 * 10; j < th; j += 20) x.fillRect(tx + i, ty + j, 10, 10);
      x.fillStyle = '#20242a';
      if (vert) { // a block downstairs: the women's on the left, the men's on the right, a partition between them
        for (let j = ty + 50; j < ty + th - 10; j += 24) { x.fillRect(tx, j, 22, 2); x.fillRect(tx + tw - 22, j, 22, 2); }
        x.fillRect(tx + tw / 2 - 1, ty + 40, 2, th - 40);
      } else for (let i = tx + 20; i < tx + tw - 10; i += 24) x.fillRect(i, ty, 2, 16);
      x.fillStyle = '#ffffff'; x.globalAlpha = 0.7;
      const sign = { F: '🚺 WOMEN', M: '🚹 MEN' };
      if (vert) { x.font = '800 8px system-ui'; x.fillText(sign.F, tx + tw / 4, ty + 20); x.fillText(sign.M, tx + tw * 3 / 4, ty + 20); x.font = '800 10px system-ui'; x.fillText('TOILETS', tx + tw / 2, ty + 34); }
      else { x.font = '800 10px system-ui'; x.fillText(sign[tl.sides[0]], tx + tw / 2, ty + th - 20); x.font = '800 8px system-ui'; x.fillText('TOILETS', tx + tw / 2, ty + th - 9); }
      x.globalAlpha = 1;
    }
    // the staff stairwells between the Kinepolis rooms upstairs
    for (const [wx, wy, ww, wh] of stairwells) {
      x.fillStyle = '#15171c'; x.fillRect(wx, wy, ww, wh);
      x.fillStyle = 'rgba(255,220,160,0.14)'; for (let py = wy + 3; py < wy + wh; py += 5) x.fillRect(wx, py, ww, 1);
    }
    // the steps down from reception into the hall, with the glass doors above them
    { const [sx, sy, sw, sh] = hallSteps;
      for (let i = 0; i < 4; i++) { x.fillStyle = `rgba(255,255,255,${0.05 + i * 0.02})`; x.fillRect(sx + i * (sw / 4), sy, 2, sh); }
      x.fillStyle = 'rgba(170,205,235,0.45)'; for (let py = sy; py < sy + sh; py += 30) x.fillRect(488, py + 4, 3, 22); }
    // the wheelchair ramp from reception down into the hall
    { const [ax, ay, aw, ah] = ramp;
      x.fillStyle = 'rgba(120,170,220,0.12)'; x.fillRect(ax, ay, aw, ah);
      x.strokeStyle = 'rgba(160,200,240,0.35)'; x.lineWidth = 1;
      for (let j = ay + 8; j < ay + ah; j += 10) { x.beginPath(); x.moveTo(ax + 6, j); x.lineTo(ax + aw / 2, j - 5); x.lineTo(ax + aw - 6, j); x.stroke(); }
      x.fillStyle = 'rgba(200,225,255,0.75)'; x.font = '700 12px system-ui'; x.fillText('♿', ax + aw / 2, ay + ah / 2);
      x.font = '600 8px system-ui'; x.fillText('RAMP', ax + aw / 2, ay + ah / 2 + 14); }
    // the main entrance: glass doors
    const [ex, ey, , eh] = mainEntrance;
    x.fillStyle = 'rgba(170,205,235,0.55)'; for (let py = ey; py < ey + eh; py += 20) x.fillRect(ex, py, 6, 14);
    x.save(); x.translate(ex + 20, ey + eh / 2); x.rotate(-Math.PI / 2);
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '700 10px system-ui'; x.fillText('MAIN ENTRANCE', 0, 0); x.restore();
    x.fillStyle = 'rgba(255,255,255,0.3)'; x.font = '700 16px system-ui'; x.textAlign = 'left';
    x.fillText('GROUND FLOOR · RECEPTION', 215, F + 330);
    x.restore();
  }

  buildLight() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(2,3,10,0.44)'; x.fillRect(0, 0, W, H); // dim like a cinema, but light enough to read the crowd on a laptop or a projector
    x.globalCompositeOperation = 'destination-out';
    const hole = (px, py, r, a) => {
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    };
    for (let px = 250; px < 1300; px += 90) hole(px, 415, 95, 0.85);
    hole(1410, 345, 110, 0.65); // the charging corner's soft light
    hole(1350, 505, 90, 0.6); // the coffee machine
    for (let px = 540; px < 1500; px += 120) for (let py = GROUND + 100; py < GROUND + 1000; py += 120) hole(px, py, 130, 0.9); // exhibition hall
    for (let py = GROUND + 320; py < GROUND + 880; py += 90) { hole(80, py, 130, 0.9); hole(320, py, 110, 0.7); } // daylight at the entrance
    for (const b of bofRooms) hole(b.rect[0] + b.rect[2] / 2, b.rect[1] + 90, 110, 0.6);
    hole(140, 415, 110, 0.7);
    hole(1190, 415, 110, 0.7); // the far end of the corridor, by the coffee bar
    for (const r of rooms) {
      hole((r.x0 + r.x1) / 2, r.top ? r.y0 + 10 : r.y1 - 10, 110, 0.55);
      r.doors.forEach(d => hole(d.x + d.w / 2, d.y + 5, 30, 0.6));
    }
    this.light = c;
    this.buildGlow();
  }

  // everything that emits light, drawn additively on top of the lightmap
  buildGlow() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const glow = (px, py, r, col, a) => {
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    };
    // soft pools of light along the corridor (the lamps themselves aren't drawn: their rings cluttered the corridor)
    for (let px = 250; px < 1300; px += 90) glow(px, 415, 42, '255,200,140', 0.12);
    const red = (px, py) => { glow(px, py, 3, '255,40,60', 0.5); x.fillStyle = '#ff4a5c'; x.fillRect(px - 0.6, py - 0.6, 1.2, 1.2); };
    for (const r of rooms) {
      // red LED dots on every step of every aisle (not in the projection room, at the back)
      for (let i = 0; i <= rowsOf(r); i++) {
        const ry = r.top ? r.y0 + 33 + i * r.pitch : r.y1 - 33 - i * r.pitch;
        if (Math.abs(ry - (r.top ? r.y1 : r.y0)) < BOOTH_D + 2) continue;
        for (const ax of aislesAt(r, Math.min(i, rowsOf(r) - 1))) for (let k = 0; k < 3; k++) red(ax + 2 + k * 4, ry);
      }
      if (look(r).crossLeds) for (let px = r.x0 + 6; px < r.x1 - 4; px += 5) red(px, r.top ? r.crossY + 5 : r.crossY - 6); // Zaal 3 and 4: a strip of LEDs along the cross aisle's railing, to the foyer door
      for (const d of r.doors) {
        // a dotted red line across each doorway, and the room screen beside it
        for (let px = d.x + 3; px < d.x + d.w; px += 4) red(px, r.top ? d.y - 3 : d.y + d.h + 3);
        glow(screenX(d) + 5, r.top ? 339 : 491, 12, '140,180,255', 0.35);
      }
    }
    this.glow = c;
    // the house lights: the downlights over the seats, shown between talks (see houseLights)
    const hc = document.createElement('canvas');
    hc.width = W; hc.height = FLOOR_H;
    const hx = hc.getContext('2d'), pool = (px, py, rad, a) => { const g = hx.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, `rgba(255,232,205,${a})`); g.addColorStop(1, 'rgba(255,232,205,0)'); hx.fillStyle = g; hx.fillRect(px - rad, py - rad, rad * 2, rad * 2); };
    for (const r of rooms) {
      hx.fillStyle = 'rgba(255,225,200,0.05)'; hx.fillRect(r.x0 - 5, r.y0, r.x1 - r.x0 + 10, r.y1 - r.y0);
      for (let py = r.y0 + 22; py < r.y1 - 8; py += 34) for (let px = r.x0 + 22; px < r.x1 - 8; px += 34) pool(px, py, 24, 0.1);
    }
    this.houseGlow = hc;
  }

  // Two looks for a room, as at Devoxx: the house lights up between talks (red walls, grey seats), and dark while a talk
  // is on, when only the screen and the red LEDs on the steps light it. The lights fade over a second or so.
  houseLights(x, game, t) {
    const dt = Math.min(0.1, Math.max(0, t - (this.houseT ?? t))); this.houseT = t;
    this.lit ||= {};
    for (const r of rooms) {
      const talk = game.talkIn ? game.talkIn(r.n) : null, target = talk && talk.now ? 0 : 1;
      const L = this.lit[r.n] = this.lit[r.n] === undefined ? target : this.lit[r.n] + (target - this.lit[r.n]) * Math.min(1, dt * 1.5);
      if (L < 0.99) { x.fillStyle = `rgba(3,4,12,${0.6 * (1 - L)})`; x.fillRect(r.x0 - 5, r.top ? r.y0 - 5 : r.y0, r.x1 - r.x0 + 10, r.y1 - r.y0 + 5); }
    }
  }

  // ---------------------------------------------------------------- frame
  draw(game, t, opts) {
    const x = this.ctx, s = this.scale;
    const sh = reducedMotion.matches ? 0 : game.shake || 0;
    // the screen shows the floor of the robot you steer
    const floor = game.viewFloor(), oy = floor ? 0 : GROUND;
    // changing floors: the floor you leave falls away below you (going up) or rises past you (going
    // down) while the new one settles into place, with the stair treads sweeping across
    if (floor !== this.floor) {
      if (this.floor !== undefined) {
        this.snap = this.snap || document.createElement('canvas');
        this.snap.width = this.cv.width; this.snap.height = this.cv.height;
        this.snap.getContext('2d').drawImage(this.cv, 0, 0);
        this.trans = { t0: t, up: floor > this.floor };
      }
      this.floor = floor;
    }
    const tp = this.trans ? Math.min(1, (t - this.trans.t0) / 0.6) : 1, te = 1 - (1 - tp) ** 3;
    if (tp >= 1) this.trans = null;
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (this.trans) { x.fillStyle = '#000'; x.fillRect(0, 0, this.cv.width, this.cv.height); }
    x.setTransform(s, 0, 0, s, (Math.random() - 0.5) * sh * s, (Math.random() - 0.5) * sh * s);
    if (this.trans) {
      const z = 1 + (this.trans.up ? 0.12 : -0.12) * (1 - te);
      x.translate((this.viewW || W) / 2, (this.viewH || FLOOR_H) / 2); x.scale(z, z); x.translate(-(this.viewW || W) / 2, -(this.viewH || FLOOR_H) / 2);
    }
    // the camera: the whole floor, or (zoomed, on small screens) a window that follows your robot
    const VW = this.viewW || W, VH = this.viewH || FLOOR_H;
    const FH = floorH(floor); // downstairs the floor is taller than the screen: the view scrolls with your robot
    // on a big screen (not zoomed in), the taller ground floor is shown whole, a little smaller (k < 1): no scrolling
    // (a little bigger than the whole floor, Jessica: the bottom of the BOF rooms and the toilets may go out of sight)
    const fit = !this.zoomed && FH > VH, k = fit ? Math.min(1, VH / (GROUND_SHOWN[1] - GROUND_SHOWN[0])) : 1;
    this.k = k; this.visW = VW / k; this.visH = VH / k; // the visible part of the world, in world units
    let cx = W / 2, cy = oy + (fit ? GROUND_SHOWN[0] + VH / k / 2 : Math.min(FH, VH) / 2);
    if (!fit && (this.zoomed || FH > VH)) {
      const me = game.robots[game.follow || game.active];
      let focus = me && floorOf(me.y) === floor ? me : null;
      if (!focus) { // watching: the robot that needs it most, but don't hop between robots for small differences
        const here = game.robotList.filter(r => floorOf(r.y) === floor), cur = here.find(r => r.kind === this.autoFocus);
        const worst = here.sort((a, b) => a.patience - b.patience)[0];
        focus = cur && (!worst || cur.patience <= worst.patience + 25) ? cur : worst;
        this.autoFocus = focus && focus.kind;
      }
      const tx = focus ? focus.x : cx, ty = focus ? focus.y : cy;
      if (this.camX === undefined || this.camFloor !== floor) { this.camX = tx; this.camY = ty; this.camFloor = floor; }
      this.camX += (tx - this.camX) * 0.12; this.camY += (ty - this.camY) * 0.12;
      cx = Math.max(VW / 2, Math.min(W - VW / 2, this.camX)); cy = Math.max(oy + VH / 2, Math.min(oy + FH - VH / 2, this.camY));
    }
    this.vx0 = cx - this.visW / 2; this.vy0 = cy - this.visH / 2; // the visible part of the world, for the edge markers
    if (fit) { x.fillStyle = '#0a0c10'; x.fillRect(0, 0, VW, VH); x.scale(k, k); } // the night outside, on both sides
    const cam = window.__cam; // debug zoom: window.__cam = { x, y, z }
    if (cam) { x.fillStyle = '#000'; x.fillRect(0, 0, VW, VH); x.translate(VW / 2, VH / 2); x.scale(cam.z, cam.z); x.translate(-cam.x, -cam.y); }
    else x.translate(-this.vx0, -this.vy0);
    x.imageSmoothingEnabled = true;
    x.drawImage(this.staticLayer, 0, oy * SS, W * SS, FH * SS, 0, oy, W, FH);
    if (!floor && game.boothsEmpty) for (const b of booths) { // no exhibitors: not set up yet (Monday morning), or gone (Thursday afternoon, Friday)
      const [bx, by, bw, bh] = b.rect;
      x.fillStyle = '#23252b'; x.fillRect(bx, by, bw, bh);
      x.strokeStyle = 'rgba(255,255,255,0.18)'; x.setLineDash([4, 4]); x.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1); x.setLineDash([]);
      x.fillStyle = '#3a3226'; x.fillRect(bx + 12, by + bh - 22, 22, 14); x.fillRect(bx + 38, by + bh - 18, 16, 10); // a couple of boxes
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.font = '700 9px system-ui'; x.textAlign = 'center';
      if (bw < 100) continue; // a narrow one: nothing written (no booth names: Jessica)
      x.font = '600 8px system-ui';
      x.fillText(game.day.boothsFrom ? `OPENS AT ${game.day.boothsFrom}` : game.day.boothsSoon ? `OPENS ON ${game.day.boothsSoon}` : 'PACKED UP', bx + bw / 2, by + bh / 2 - 4);
    }

    if (floor) this.houseLights(x, game, t); // the rooms: dark during a talk (people, robots and signs stay as they are)
    this.drawLounge(x, game, t);
    this.drawRooms(x, game, t);
    this.drawSpills(x, game, t);
    for (const b of game.bags) { // an unattended bag: a backpack, and a pulsing ring so people (and you) notice it
      const pulse = 0.5 + Math.sin(t * 5) * 0.3;
      x.strokeStyle = `rgba(255,210,122,${pulse})`; x.lineWidth = 1.5; x.beginPath(); x.arc(b.x, b.y, 13, 0, 7); x.stroke();
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.roundRect(b.x - 5, b.y - 5, 12, 13, 3); x.fill();
      x.fillStyle = '#2f4f7a'; x.beginPath(); x.roundRect(b.x - 6, b.y - 7, 12, 13, 3); x.fill();
      x.fillStyle = '#243d60'; x.fillRect(b.x - 4, b.y - 1, 8, 4);
      x.strokeStyle = '#1a2a40'; x.lineWidth = 1.2; x.beginPath(); x.arc(b.x, b.y - 7, 3, Math.PI, 0); x.stroke();
      if (b.checkT > 0) this.ring(x, b.x, b.y, 16, b.checkT / BAG_CHECK, '#9fdcff');
    }
    for (const e of game.exits) { // attendees sitting on the stairs: a little huddle, and a pulsing ring
      const pulse = 0.5 + Math.sin(t * 5) * 0.3;
      x.strokeStyle = `rgba(255,210,122,${pulse})`; x.lineWidth = 1.5; x.beginPath(); x.arc(e.x, e.y, 17, 0, 7); x.stroke();
      const cols = ['#c98b5a', '#6b8fc9', '#9a6bc9'];
      for (let i = 0; i < e.n; i++) {
        const px = e.x + (i - (e.n - 1) / 2) * 9, py = e.y + (i % 2 ? 3 : -2);
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.arc(px + 1, py + 2, 5, 0, 7); x.fill();
        x.fillStyle = cols[i]; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill();
        x.fillStyle = '#f1d3b3'; x.beginPath(); x.arc(px, py - 1, 2.4, 0, 7); x.fill();
      }
      x.font = '12px system-ui'; x.textAlign = 'center'; x.fillText('🚪', e.x, e.y - 14);
      if (e.checkT > 0) this.ring(x, e.x, e.y, 20, e.checkT / BAG_CHECK, '#9fdcff');
    }
    this.drawAgents(x, game, t);
    this.drawCleaners(x, game, t);
    // who is bothering whom: a red tether from each pest to the robot it is after
    x.strokeStyle = 'rgba(255,160,200,0.5)'; x.setLineDash([2, 3]); x.lineWidth = 1;
    for (const a of game.crowd.list) if (a.kind === 'pest' && a.state === 'pester' && !a.leaving) {
      const rb = game.robots[a.target];
      if (!rb.rogue && Math.hypot(rb.x - a.x, rb.y - a.y) < 140) { x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(rb.x, rb.y); x.stroke(); }
    }
    x.setLineDash([]);
    // Biggy going too fast for people: a red warning arc ahead of it
    const big = game.robots.biggy;
    if (!big.rogue && big.speed > 32) {
      x.strokeStyle = 'rgba(255,90,70,0.85)'; x.lineWidth = 2.5;
      x.beginPath(); x.arc(big.x, big.y, big.r + 9, big.heading - 0.7, big.heading + 0.7); x.stroke();
    }
    // pests giving up next to Biggy: a little blue ring fills up
    for (const a of game.crowd.list) if (a.deterT > 0 && !a.leaving) this.ring(x, a.x, a.y, 7, a.deterT / DETER, '#9fdcff');
    // escort line
    const guide = game.robots.droid;
    x.strokeStyle = 'rgba(255,210,122,0.5)'; x.setLineDash([3, 4]); x.lineWidth = 1;
    for (const a of game.crowd.list) if (a.state === 'follow' && !underSeats(a)) { x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(guide.x, guide.y); x.stroke(); }
    x.setLineDash([]);
    for (const rb of [...game.robotList].sort((a, b) => a.y - b.y)) {
      if (rb.away > 0) { // just off the stairs: fading in
        x.globalAlpha = 1 - rb.away / 0.8 * 0.7; drawRobot(x, rb, t, { active: rb.kind === game.active }); x.globalAlpha = 1;
      } else drawRobot(x, rb, t, { active: rb.kind === game.active });
    }

    x.drawImage(this.light, 0, oy, W, FH, 0, oy, W, FH);

    // after the lightmap: things that emit light
    x.globalCompositeOperation = 'lighter';
    x.drawImage(this.glow, 0, oy, W, FH, 0, oy, W, FH);
    if (floor) for (const r of rooms) { // the house lights, in the rooms between talks
      const L = this.lit?.[r.n] ?? 1, [rx, ry, rw, rh] = [r.x0 - 5, r.y0, r.x1 - r.x0 + 10, r.y1 - r.y0];
      if (L > 0.02) { x.globalAlpha = L; x.drawImage(this.houseGlow, rx, ry, rw, rh, rx, ry, rw, rh); x.globalAlpha = 1; }
    }
    for (const f of game.flashes) { // selfie flashes
      const a = 1 - f.t / 0.25, R = 18 + f.t * 120;
      const g = x.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      g.addColorStop(0, `rgba(255,255,255,${a * 0.9})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(f.x - R, f.y - R, R * 2, R * 2);
    }
    for (const rb of game.robotList) {
      const col = rb.rogue ? '255,90,200' : rb.kind === 'voxxy' ? '255,140,40' : rb.kind === 'droid' ? '255,210,130' : '120,150,190';
      const hx = rb.x + Math.cos(rb.heading) * rb.r, hy = rb.y + Math.sin(rb.heading) * rb.r;
      const R = rb.r * (rb.rogue ? 4.5 : 3);
      const g = x.createRadialGradient(hx, hy, 0, hx, hy, R);
      g.addColorStop(0, `rgba(${col},${rb.rogue ? 0.5 : 0.35})`); g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g; x.fillRect(hx - R, hy - R, R * 2, R * 2);
    }
    for (const r of rooms) {
      const broken = game.projectors[r.n].broken;
      const flick = broken ? (Math.random() < 0.3 ? 0.35 : 0.05) : 0.22 + Math.sin(t * 3 + r.n) * 0.04;
      const col = broken ? '255,60,50' : '150,180,255';
      const sy = r.top ? r.y0 + 6 : r.y1 - 6;
      const g = x.createLinearGradient(0, sy, 0, r.top ? sy + 80 : sy - 80);
      g.addColorStop(0, `rgba(${col},${flick})`); g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g; x.fillRect(r.x0 + 20, r.top ? sy : sy - 80, r.x1 - r.x0 - 40, 80);
    }
    x.globalCompositeOperation = 'source-over';

    if (floor) this.drawRoomNumbers(x);
    this.drawTitles(x, game);
    this.drawGuide(x, game, t);
    this.drawBubbles(x, game, t);
    this.drawRobotHUD(x, game, t);
    this.drawOffscreenIndicators(x, game, t);

    // floating text with high-contrast backdrop
    x.textAlign = 'center';
    x.font = '800 13.5px system-ui';
    for (const f of game.floaters) {
      if (f.bubble) { this.drawSpeech(x, f, t); continue; }
      const a = Math.min(1, (f.life - f.t) / 0.5); // fully readable, then a short fade at the end
      const tw = x.measureText(f.text).width;
      const fy = f.y - Math.min(f.t * 14, 24); // drifts up a little, then holds still to be read
      x.fillStyle = `rgba(10,12,18,${a * 0.85})`;
      x.fillRect(f.x - tw / 2 - 4, fy - 12, tw + 8, 16);
      x.strokeStyle = f.color; x.lineWidth = 1; x.strokeRect(f.x - tw / 2 - 4, fy - 12, tw + 8, 16);
      x.globalAlpha = a; x.fillStyle = f.color;
      x.fillText(f.text, f.x, fy);
      x.globalAlpha = 1;
    }
    // screen space from here: vignette (redder as the conference goes wrong), which floor, fade on the stairs
    x.setTransform(s, 0, 0, s, 0, 0);
    const bad = Math.max(0, (50 - game.satisfaction) / 50);
    const vg = x.createRadialGradient(VW / 2, VH / 2, VH * 0.4, VW / 2, VH / 2, Math.max(VW, VH) * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(${Math.round(bad * 120)},0,0,${0.28 + bad * 0.3})`);
    x.fillStyle = vg; x.fillRect(0, 0, VW, VH);
    x.font = '800 14px system-ui'; x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,0.75)';
    x.fillText(floor ? '▲ CINEMA LEVEL · 1ST FLOOR' : this.zoomed ? '▼ GROUND FLOOR' : '▼ GROUND FLOOR · RECEPTION & EXHIBITION HALL', VW - 14, VH - 12);
    x.textAlign = 'left';
    // (watching, the AI running all three, is said in the HUD, where the 🤖 AI button usually is)
    if (game.follow && game.follow !== game.active && game.viewOverride === null) { x.fillStyle = 'rgba(159,220,255,0.9)'; x.fillText(`👁 Following ${game.robots[game.follow].name} · tap 👁 again to stop`, 14, VH - 12); }
    else if (game.active && game.viewOverride !== null) { x.fillStyle = 'rgba(159,220,255,0.9)'; x.fillText(`👁 Viewing the ${floor ? '1st floor' : 'ground floor'} · F to go back to ${game.robots[game.active].name}`, 14, VH - 12); }
    if (this.trans) {
      x.setTransform(1, 0, 0, 1, 0, 0);
      const cw = this.cv.width, ch = this.cv.height, zo = 1 + (this.trans.up ? -0.14 : 0.14) * te;
      x.globalAlpha = 1 - te;
      x.drawImage(this.snap, cw / 2 - cw * zo / 2, ch / 2 - ch * zo / 2, cw * zo, ch * zo);
      // the treads of the staircase sweeping past
      x.globalAlpha = (1 - te) * 0.35; x.fillStyle = '#000';
      const step = ch / 9, off = (this.trans.up ? 1 : -1) * te * step * 4;
      for (let i = -5; i < 14; i++) x.fillRect(0, i * step + off, cw, step * 0.28);
      x.globalAlpha = 1;
      x.setTransform(s, 0, 0, s, 0, 0);
      x.font = '900 34px system-ui'; x.textAlign = 'center'; x.fillStyle = `rgba(255,210,122,${1 - tp})`;
      x.fillText(floor ? '▲ 1ST FLOOR · CINEMA LEVEL' : '▼ GROUND FLOOR', VW / 2, VH / 2 + 12);
    }
  }

  drawLounge(x, game, t) {
    const [lx, ly, lw, lh] = LOUNGE;
    x.fillStyle = 'rgba(123,220,107,0.08)'; x.fillRect(lx, ly, lw, lh);
    x.strokeStyle = 'rgba(123,220,107,0.55)'; x.setLineDash([5, 4]); x.lineWidth = 1.5;
    x.strokeRect(lx + 0.5, ly + 0.5, lw - 1, lh - 1); x.setLineDash([]);
    for (let i = 0; i < 3; i++) { // charging pads
      const px = lx + 40 + i * 50, py = ly + lh - 20;
      x.fillStyle = '#1f2a22'; x.beginPath(); x.arc(px, py, 10, 0, 7); x.fill();
      x.strokeStyle = `rgba(123,220,107,${0.4 + Math.sin(t * 3 + i) * 0.2})`; x.beginPath(); x.arc(px, py, 10, 0, 7); x.stroke();
    }
    x.fillStyle = 'rgba(123,220,107,0.95)'; x.font = '800 12px system-ui'; x.textAlign = 'center';
    x.fillText('⚡ CHARGING', lx + lw / 2, ly + 18);
    x.font = '700 9.5px system-ui'; x.fillStyle = 'rgba(200,240,190,0.85)';
    x.fillText('for any robot running low', lx + lw / 2, ly + 30);
    // the charging base downstairs, in a corner of reception
    const [hx, hy, hw, hh] = chargers[1].rect;
    x.fillStyle = 'rgba(123,220,107,0.08)'; x.fillRect(hx, hy, hw, hh);
    x.strokeStyle = 'rgba(123,220,107,0.55)'; x.setLineDash([5, 4]); x.lineWidth = 1.5; x.strokeRect(hx + 0.5, hy + 0.5, hw - 1, hh - 1); x.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      const px = hx + 25 + i * 40, py = hy + hh - 20;
      x.fillStyle = '#1f2a22'; x.beginPath(); x.arc(px, py, 10, 0, 7); x.fill();
      x.strokeStyle = `rgba(123,220,107,${0.4 + Math.sin(t * 3 + i) * 0.2})`; x.beginPath(); x.arc(px, py, 10, 0, 7); x.stroke();
    }
    x.fillStyle = 'rgba(123,220,107,0.95)'; x.font = '800 10px system-ui'; x.fillText('⚡ CHARGING', hx + hw / 2, hy + 14);
  }

  // inside the rooms: a dot for everyone sitting in the talk, and the speaker pacing in front of the screen
  drawAudience(x, game, t) {
    if (!this.seatSpots) { // every seat on the raked rows (same geometry as the static layer), in a fixed shuffled order
      this.seatSpots = {};
      for (const r of rooms) {
        const spots = [];
        for (let i = 0; i < rowsOf(r); i++) { const { y, blocks } = rowOf(r, i); for (const seats of blocks) for (const sx of seats) spots.push([sx, y]); }
        let s = r.n * 9973; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
        this.seatSpots[r.n] = spots;
      }
    }
    const inside = {};
    for (const p of game.pool) inside[p.room] = (inside[p.room] || 0) + 1;
    for (const r of rooms) {
      // each attendee sitting in a talk stands for about 60 real ones: the people on screen are a sample of the ~3,000 at Devoxx (Jessica)
      // (about 30 each), and in a 3-minute day many of them are still on their way, so the rooms are drawn as full as they would be
      const spots = this.seatSpots[r.n], n = Math.min(spots.length, Math.round((inside[r.n] || 0) * 60 * spots.length / SEATS[r.n]));
      // seen from above, like the people walking: shoulders in their clothes and a head (every skin tone), turned to the screen,
      // with a tiny fidget. Drawn in batches: the shadows in one path, then one path per colour
      const fwd = r.top ? -1 : 1; // towards the screen
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath();
      for (let i = 0; i < n; i++) { const [sx, sy] = spots[i]; x.moveTo(sx + 4, sy + 1); x.ellipse(sx + 0.6, sy + 1, 3.4, 2.4, 0, 0, 7); }
      x.fill();
      for (let c = 0; c < SHIRTS.length; c++) { // shoulders
        x.fillStyle = SHIRTS[c]; x.beginPath();
        for (let i = 0; i < n; i++) if ((i * 7 + r.n) % SHIRTS.length === c) { const [sx, sy] = spots[i]; x.moveTo(sx + 3.3, sy - fwd * 0.8); x.ellipse(sx, sy - fwd * 0.8, 3.3, 2.1, 0, 0, 7); }
        x.fill();
      }
      for (let c = 0; c < SKINS.length; c++) { // heads
        x.fillStyle = SKINS[c]; x.beginPath();
        for (let i = 0; i < n; i++) if ((i * 3 + (i >> 2) + r.n * 5) % SKINS.length === c) { const [sx, sy] = spots[i], wob = Math.sin(t * 1.3 + i * 2.1) * 0.3; x.moveTo(sx + wob + 1.9, sy + fwd * 0.5); x.arc(sx + wob, sy + fwd * 0.5, 1.9, 0, 7); }
        x.fill();
      }
      // the talk's title is on the screen (drawTitles, after the lights)
      const talk = game.talkIn ? game.talkIn(r.n) : null, broken = game.projectors[r.n].broken, cx = (r.x0 + r.x1) / 2, w = (r.x1 - r.x0) / 2 - 40;
      if (!talk?.now) continue; // no talk on: no speaker
      // the speaker: pacing just in front of the screen and its title (stands still, arms up, when the projector is down)
      const px = broken ? cx : cx + Math.sin(t * 0.45 + r.n * 1.7) * w * 0.7, py = r.top ? r.y0 + 31 : r.y1 - 31;
      const g = x.createRadialGradient(px, py, 0, px, py, 16); // a spotlight on the stage
      g.addColorStop(0, 'rgba(255,230,170,0.35)'); g.addColorStop(1, 'rgba(255,230,170,0)');
      x.fillStyle = g; x.fillRect(px - 16, py - 16, 32, 32);
      x.fillStyle = '#1a1a1f'; x.beginPath(); x.arc(px, py, 4.2, 0, 7); x.fill();
      x.fillStyle = broken ? '#ff8a6a' : '#ffb347'; x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill();
      if (broken && Math.sin(t * 6) > 0) { x.fillStyle = '#fff'; x.font = '800 9px system-ui'; x.textAlign = 'center'; x.fillText('?!', px, py - 7); }
    }
  }

  // the talks' titles, on the rooms' screens, like slides: drawn after the lights, so that they stay crisp and white. The first
  // four words (fewer in a small room), or the whole title while the robot you steer is in the room
  // the big room numbers, like the Devoxx plan, and the capacity printed on the Kinepolis plan ("746 seats"): over the crowd
  // and the dimmed house lights, so they read during a talk too
  drawRoomNumbers(x) {
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    for (const r of rooms) {
      const cx = (r.x0 + r.x1) / 2, cy = r.top ? r.y0 + r.depth * 0.45 : r.y1 - r.depth * 0.45;
      x.font = '800 64px "Segoe UI", system-ui, sans-serif'; x.strokeStyle = 'rgba(8,9,12,0.6)'; x.lineWidth = 6;
      x.strokeText(r.label, cx, cy); x.fillStyle = 'rgba(255,255,255,0.62)'; x.fillText(r.label, cx, cy);
      x.font = '700 12px system-ui'; x.lineWidth = 3; x.strokeText(`${SEATS[r.n]} seats`, cx, cy + 38);
      x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillText(`${SEATS[r.n]} seats`, cx, cy + 38);
    }
    x.restore();
  }

  drawTitles(x, game) {
    if (!game.talkIn) return;
    const me = game.robots[game.active], inside = (x0, y0, x1, y1) => me && me.x > x0 && me.x < x1 && me.y > y0 && me.y < y1;
    for (const r of rooms) {
      const talk = game.talkIn(r.n);
      if (!talk || game.projectors[r.n].broken) continue; // no talk, or the projector is down (NO SIGNAL)
      this.titleByScreen(x, talk, (r.x0 + r.x1) / 2, r.x1 - r.x0 - 16, r.top ? r.y0 + 8 : r.y1 - 8, r.top, inside(r.x0, r.y0, r.x1, r.y1));
    }
    for (const b of bofRooms) { // the BOF rooms downstairs: the screen at the far end
      const talk = game.talkIn(`bof${b.n}`), [bx, by, bw, bh] = b.rect;
      if (talk) this.titleByScreen(x, talk, bx + bw / 2, bw - 12, by + bh - 9, false, inside(bx, by, bx + bw, by + bh));
    }
  }
  // edgeY: the card's edge on the screen's side; top: the screen is on the top wall
  titleByScreen(x, talk, cx, w, edgeY, top, full) {
    x.font = TITLE_FONT;
    const lines = full ? this.fullTitle(x, talk.title, w - 22) : [this.shortTitle(x, talk.title, w - 22)], h = 8 + lines.length * 11;
    card(x, lines, cx, top ? edgeY : edgeY - h, typeColor(talk.type), talk.now);
  }
  // the whole title, on three lines at most (then …); cached, like the short one
  fullTitle(x, title, w) {
    const key = `full|${title}|${w}`;
    this.titleCache ||= new Map();
    if (this.titleCache.has(key)) return this.titleCache.get(key);
    const lines = [''];
    for (const wd of title.split(' ')) {
      const cur = lines[lines.length - 1], test = cur ? `${cur} ${wd}` : wd;
      if (!cur || x.measureText(test).width <= w) lines[lines.length - 1] = test; else lines.push(wd);
    }
    const out = lines.slice(0, 3);
    if (lines.length > 3) { let l = out[2]; do l = l.slice(0, -1).trimEnd(); while (l && x.measureText(`${l}…`).width > w); out[2] = `${l}…`; }
    this.titleCache.set(key, out);
    return out;
  }
  // one line: the first four words of a title at most, fewer in a small room, then …; cached, since the titles are drawn every frame
  shortTitle(x, title, w) {
    const key = `${title}|${w}`;
    this.titleCache ||= new Map();
    if (this.titleCache.has(key)) return this.titleCache.get(key);
    const words = title.split(' '), cut = t => `${t.replace(/[\s:,;.!?–-]+$/, '')}…`;
    let n = Math.min(4, words.length), txt;
    for (;;) { txt = words.slice(0, n).join(' '); if (n < words.length) txt = cut(txt); if (n === 1 || x.measureText(txt).width <= w) break; n--; }
    while (x.measureText(txt).width > w && txt.length > 2) txt = cut(txt.slice(0, -2)); // one long word
    this.titleCache.set(key, txt);
    return txt;
  }

  drawRooms(x, game, t) {
    this.drawAudience(x, game, t);
    if (!game.projectors.popcorn.broken) { // the popcorn machine pops away
      const [px, py, pw] = popcornMachine;
      x.fillStyle = '#fff3c4';
      for (let i = 0; i < 4; i++) { const k = (t * 1.3 + i * 0.27) % 1; x.beginPath(); x.arc(px + 10 + i * 7 + Math.sin(i * 3 + t) * 2, py + 18 - k * 14, 1.6, 0, 7); x.fill(); }
    }
    x.textAlign = 'center';
    for (const r of rooms) {
      const hue = ROOM_HUES[r.n];
      const cx = (r.x0 + r.x1) / 2;
      for (const d of r.doors) { x.fillStyle = hue; x.fillRect(d.x + d.w / 2 - 7, r.top ? 333 : 494, 14, 3); }
      const p = game.projectors[r.n];
      if (p.broken) {
        const sy = r.top ? r.y0 + 22 : r.y1 - 16;
        x.fillStyle = Math.sin(t * 8) > 0 ? '#ff5a4a' : '#7a2a24'; x.font = '800 12.5px system-ui';
        x.fillText(INCIDENTS[p.what].tag, cx, sy);
        this.drawPanel(x, game.panelOf(r.n), p, t);
      }
    }
    // the toilets: a light over each stall, red while it is taken (when they all are, a line forms outside the door)
    for (const tl of toilets) for (const side of tl.sides) {
      const n = tl.stalls[side], key = `${tl.id}:${side}`, busy = game.wcInside ? game.wcInside.filter(w => w.key === key).length : 0;
      const [tx, ty, tw, th] = tl.rect, vert = th > tw, span = (vert ? tw / 2 : tw) - 16;
      const cx = vert ? tx + (side === 'F' ? tw / 4 : tw * 3 / 4) : tx + tw / 2, ly = vert ? ty + 44 : ty + 6;
      for (let k = 0; k < n; k++) { x.fillStyle = k < busy ? '#ff5a4a' : '#7bdc6b'; x.beginPath(); x.arc(cx - span / 2 + k * span / Math.max(1, n - 1), ly, 1.8, 0, 7); x.fill(); }
    }
    // everything else that can break, on both floors: a flashing sign and the ⚠ panel
    for (const [n, s] of Object.entries(SPOTS)) {
      const p = game.projectors[n];
      if (!p.broken) continue;
      x.fillStyle = Math.sin(t * 8) > 0 ? '#ff5a4a' : '#7a2a24'; x.font = '800 12px system-ui'; x.textAlign = 'center';
      x.fillText(INCIDENTS[p.what].tag, s.tag[0], s.tag[1]);
      this.drawPanel(x, game.panelOf(n), p, t);
    }
  }

  // a dashed line and an arrow from the robot you steer to where its job is
  drawGuide(x, game, t) {
    const rb = game.robots[game.active];
    if (!rb || this.showArrow === false) return; // watching, or the player turned the arrow off
    const g = game.guideTarget(rb);
    if (!g) return;
    const col = g.care ? '123,220,107' : '255,225,120'; // green: look after someone, yellow: the job
    const dx = g.x - rb.x, dy = g.y - rb.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
    x.strokeStyle = `rgba(${col},0.6)`; x.lineWidth = 1.5; x.setLineDash([5, 6]); x.lineDashOffset = -t * 30;
    x.beginPath(); x.moveTo(rb.x + ux * (rb.r + 10), rb.y + uy * (rb.r + 10)); x.lineTo(g.x, g.y); x.stroke(); x.setLineDash([]);
    const ax = rb.x + ux * (rb.r + 16), ay = rb.y + uy * (rb.r + 16); // arrowhead just ahead of the robot
    x.fillStyle = `rgb(${col})`; x.beginPath();
    x.moveTo(ax + ux * 7, ay + uy * 7); x.lineTo(ax - uy * 5, ay + ux * 5); x.lineTo(ax + uy * 5, ay - ux * 5); x.closePath(); x.fill();
    x.strokeStyle = `rgba(${col},${0.5 + Math.sin(t * 5) * 0.3})`; x.lineWidth = 2;
    x.beginPath(); x.arc(g.x, g.y, 12 + Math.sin(t * 5) * 2, 0, 7); x.stroke();
    if (g.noLabel) return; // a breakdown: its flashing ⚠ says it already
    x.font = '700 10px system-ui'; x.textAlign = 'center';
    x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillText(g.label, g.x + 1, g.y - 17);
    x.fillStyle = `rgb(${col})`; x.fillText(g.label, g.x, g.y - 18);
  }

  drawSpills(x, game, t) {
    for (const s of game.spills) {
      const a = Math.min(1, s.t * 4);
      x.globalAlpha = a;
      if (s.kind === 'coffee') {
        x.fillStyle = 'rgba(92,58,30,0.85)';
        x.beginPath(); x.ellipse(s.x, s.y, 9, 6, 0.4, 0, 7); x.fill();
        x.beginPath(); x.ellipse(s.x + 7, s.y - 4, 4, 3, 0, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.beginPath(); x.ellipse(s.x - 2, s.y - 2, 3, 1.5, 0.4, 0, 7); x.fill();
      } else if (s.kind === 'popcorn') { // a scatter of popcorn
        x.fillStyle = '#f6e7b0';
        for (let i = 0; i < 9; i++) { const an = i * 2.4 + s.x, rr = 2 + (i % 4) * 2; x.beginPath(); x.arc(s.x + Math.cos(an) * rr, s.y + Math.sin(an) * rr, 1.4, 0, 7); x.fill(); }
      } else { // a sticky puddle of cola, and the can
        x.fillStyle = 'rgba(58,24,16,0.85)';
        x.beginPath(); x.ellipse(s.x, s.y, 10, 6, -0.3, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.15)'; x.beginPath(); x.ellipse(s.x - 3, s.y - 2, 3, 1.4, -0.3, 0, 7); x.fill();
        x.save(); x.translate(s.x + 8, s.y + 3); x.rotate(0.9);
        x.fillStyle = '#c8202f'; x.fillRect(-2, -3.5, 4, 7); x.fillStyle = '#d9dde3'; x.fillRect(-2, -3.5, 4, 1.2);
        x.restore();
      }
      x.globalAlpha = 1;
    }
  }

  // the small cleaning robots: round, low, a spinning brush on each side
  drawCleaners(x, game, t) {
    for (const c of game.cleaners) {
      x.save(); x.translate(c.x, c.y); x.rotate(c.heading); x.scale(c.r / 6, c.r / 6); // drawn at Ø 0.85 m, scaled to its real size
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.ellipse(1.5, 2, 7, 6.5, 0, 0, 7); x.fill();
      for (const s of [-1, 1]) {
        x.save(); x.translate(3, s * 5); x.rotate(c.spin * s);
        x.strokeStyle = '#c9d6e8'; x.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) { const an = i * 2.1; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(an) * 3, Math.sin(an) * 3); x.stroke(); }
        x.restore();
      }
      x.fillStyle = '#2f6f73'; x.beginPath(); x.arc(0, 0, 6, 0, 7); x.fill();
      x.strokeStyle = '#18393b'; x.lineWidth = 1; x.stroke();
      x.fillStyle = '#e8eef2'; x.beginPath(); x.arc(-1, 0, 3.3, 0, 7); x.fill();
      x.fillStyle = c.target ? '#9fdcff' : '#7bdc6b'; x.beginPath(); x.arc(3.6, 0, 1.3, 0, 7); x.fill();
      x.restore();
    }
  }

  // the pulsing ⚠ panel Voxxy goes to
  drawPanel(x, pos, p, t) {
    const pulse = 1 + Math.sin(t * 6) * 0.15;
    x.fillStyle = '#2a1414'; x.fillRect(pos.x - 10, pos.y - 8, 20, 16);
    x.strokeStyle = '#ff5a4a'; x.lineWidth = 2; x.strokeRect(pos.x - 10 * pulse, pos.y - 8 * pulse, 20 * pulse, 16 * pulse);
    x.fillStyle = '#ffd23c'; x.font = '800 12px system-ui'; x.fillText('⚠', pos.x, pos.y + 4);
    if (p.fixT > 0) this.ring(x, pos.x, pos.y, 16, p.fixT, '#7bdc6b');
  }

  ring(x, cx, cy, r, v, col, w = 2.5) {
    x.strokeStyle = 'rgba(255,255,255,0.2)'; x.lineWidth = w;
    x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    x.strokeStyle = col;
    x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, v)); x.stroke();
  }

  drawAgents(x, game, t) {
    for (const a of game.crowd.list) {
      if (underSeats(a)) continue;
      const ang = a.state === 'wait' && a.stop === 'steps' ? Math.PI : Math.atan2(a.vy, a.vx); // sitting on the steps, facing the entrance
      x.save();
      x.translate(a.x, a.y);
      x.rotate(ang);
      if (a.state === 'stumble') x.rotate(Math.sin(t * 30) * 0.4);
      x.scale(a.r / 4, a.r / 4); // drawn at Ø 0.55 m, scaled to each person (people come in all sizes)
      x.fillStyle = a.kind === 'pest' ? '#d98a5a' : a.kind === 'nice' ? '#3f8f4a' : a.kind === 'lost' ? '#c9a227' : a.shirt;
      x.beginPath(); x.ellipse(0, 0, 3, 4.6, 0, 0, 7); x.fill();
      x.fillStyle = skinOf(a);
      x.beginPath(); x.arc(0.4, 0, 2.1, 0, 7); x.fill();
      x.restore();
      if (a.state === 'wait') { x.fillStyle = '#f3e6d4'; x.fillRect(a.x + 3, a.y - 5, 2, 3); }
    }
  }

  // someone talking (a robot or an attendee): a speech bubble that pops up, "types" for a moment (three bouncing dots), then shows its words with a
  // light shimmer running across them, like a chat assistant's "working…" bubble
  drawSpeech(x, f, t) {
    const a = Math.min(1, (f.life - f.t) / 0.5), pop = Math.min(1, f.t / 0.22), s = 1 + 2.70158 * (pop - 1) ** 3 + 1.70158 * (pop - 1) ** 2; // pops up, a little past its size and back
    const typing = f.t < BUBBLE_TYPING, by = f.y - 4;
    x.save(); x.globalAlpha = a; x.translate(f.x, by); x.scale(s, s);
    x.font = '800 13.5px system-ui';
    const w = typing ? 40 : x.measureText(f.text).width + 18, h = 22;
    // robots: a dark bubble in the robot's own colour (its ring on the map); people: a white bubble with dark words
    const rc = f.robot ? (COLORS[f.robot] || '#b8c0cc') : null;
    const bg = rc ? 'rgba(14,16,24,0.94)' : 'rgba(248,246,240,0.97)', ink = rc || '#1b1e27', edge = rc || 'rgba(14,16,24,0.55)';
    x.fillStyle = bg; x.strokeStyle = edge; x.lineWidth = rc ? 2 : 1;
    x.beginPath(); x.roundRect(-w / 2, -h, w, h, 11); x.moveTo(-5, 0); x.lineTo(0, 7); x.lineTo(5, 0); x.fill(); x.stroke();
    x.fillStyle = bg; x.fillRect(-4.4, -2, 8.8, 2.9); // the tail joins the bubble without a line across it
    if (rc) { x.fillStyle = rc; x.globalAlpha = a * 0.16; x.beginPath(); x.roundRect(-w / 2, -h, w, h, 11); x.fill(); x.globalAlpha = a; } // a tint of its colour
    const shine = rc ? '#ffffff' : '#8a93a6';
    if (typing) for (let i = 0; i < 3; i++) { // the dots bounce one after the other
      x.fillStyle = ink; x.globalAlpha = a * (0.55 + 0.45 * Math.abs(Math.sin(t * 7 - i * 0.7)));
      x.beginPath(); x.arc(-10 + i * 10, -h / 2 - Math.abs(Math.sin(t * 7 - i * 0.7)) * 3, 2.6, 0, 7); x.fill();
    } else {
      const k = (f.t - BUBBLE_TYPING) / 0.9, tw = w - 18; // the shimmer, once, as the words appear
      if (k < 1) {
        const g = x.createLinearGradient(-tw / 2, 0, tw / 2, 0), p = -0.2 + k * 1.4;
        g.addColorStop(0, ink); g.addColorStop(Math.min(1, Math.max(0, p - 0.15)), ink);
        g.addColorStop(Math.min(1, Math.max(0, p)), shine); g.addColorStop(Math.min(1, Math.max(0, p + 0.15)), ink); g.addColorStop(1, ink);
        x.fillStyle = g;
      } else x.fillStyle = ink;
      x.textAlign = 'center'; x.fillText(f.text, 0, -h / 2 + 5);
    }
    x.restore();
  }

  drawBubbles(x, game, t) {
    x.textAlign = 'center';
    for (const a of game.crowd.list) {
      let icon = null;
      if (a.kind === 'pest' && !a.leaving) icon = a.carried && !a.clingy ? '🤩' : a.pest.emoji;
      else if (a.kind === 'lost' && a.state === 'idle') icon = '❓';
      else if (a.kind === 'nice') icon = '😊';
      if (!icon) continue;
      const by = a.y - 16 + Math.sin(t * 4 + a.wander) * 1.2;
      x.fillStyle = 'rgba(255,255,255,0.96)';
      x.beginPath(); x.arc(a.x, by, 12, 0, 7); x.fill();
      x.beginPath(); x.moveTo(a.x - 3, by + 9); x.lineTo(a.x, by + 14); x.lineTo(a.x + 3, by + 9); x.fill();
      x.font = 'bold 15px system-ui';
      x.fillText(icon, a.x, by + 5);
      if (a.kind === 'lost') {
        const txt = `${a.room}`;
        x.font = '800 10.5px system-ui';
        x.fillStyle = '#0f1118';
        x.fillRect(a.x + 8, by - 12, 18, 13);
        x.strokeStyle = '#ffd27a'; x.lineWidth = 1;
        x.strokeRect(a.x + 8, by - 12, 18, 13);
        x.fillStyle = '#ffd27a';
        x.fillText(txt, a.x + 17, by - 2);
      }
    }
  }

  drawRobotHUD(x, game, t) {
    for (const rb of game.robotList) {
      const col0 = COLORS[rb.kind];
      // who is where: a ring goes out from the robot you just switched to, and pulses on the one whose card you point at
      const ping = this.ping && this.ping.kind === rb.kind ? (t - this.ping.t0) / 1.2 : 1, k = this.hover === rb.kind ? (t * 1.2) % 1 : ping;
      if (k >= 0 && k < 1) { x.strokeStyle = col0; x.globalAlpha = 1 - k; x.lineWidth = 2.5; x.beginPath(); x.arc(rb.x, rb.y, rb.r + 8 + k * 30, 0, 7); x.stroke(); x.globalAlpha = 1; }
      const p = rb.patience / 100;
      const col = rb.rogue ? '#ff2a1a' : rb.patience < LOW_BELOW ? LOW : col0; // its own colour, red when it runs low (the arc shows how much is left)
      if (rb.rogue) {
        const txt = game.inLounge(rb) ? '⚡ RECHARGING' : '🔋 WORN OUT';
        x.font = '900 13px system-ui'; x.textAlign = 'center';
        const tw = x.measureText(txt).width;
        x.fillStyle = 'rgba(10,12,18,0.85)'; x.fillRect(rb.x - tw / 2 - 5, rb.y - rb.r - 28, tw + 10, 18);
        x.strokeStyle = '#ff7ad9'; x.lineWidth = 1; x.strokeRect(rb.x - tw / 2 - 5, rb.y - rb.r - 28, tw + 10, 18);
        x.fillStyle = Math.sin(t * 6) > 0 ? '#ff7ad9' : '#ffffff';
        x.fillText(txt, rb.x, rb.y - rb.r - 14);
        this.ring(x, rb.x, rb.y, rb.r + 7, rb.rebootT, '#7bdc6b');
      } else {
        this.ring(x, rb.x, rb.y, rb.r + 5, p, col, 3);
        if (p < 0.25) { // low energy warning pulse
          const pulse = 1 + Math.sin(t * 10) * 0.25;
          x.strokeStyle = `rgba(255,90,74,${0.6 + Math.sin(t * 10) * 0.3})`;
          x.lineWidth = 2.5;
          x.beginPath(); x.arc(rb.x, rb.y, (rb.r + 9) * pulse, 0, 7); x.stroke();
        }
        if (rb.resting) { // recovering: soft pulse + a calm little face
          x.strokeStyle = `rgba(123,220,107,${0.25 + Math.sin(t * 4) * 0.2})`; x.lineWidth = 2;
          x.beginPath(); x.arc(rb.x, rb.y, rb.r + 11 + Math.sin(t * 4) * 1.5, 0, 7); x.stroke();
          x.font = '16px system-ui'; x.textAlign = 'center'; x.fillText('😌', rb.x + rb.r + 10, rb.y - rb.r - 4);
        }
      }
    }
  }

  // ---------------------------------------------------------------- the building, stacked
  // A small tilted view of both floors, one above the other, joined by their staircases:
  // where every robot is, what is broken, and which floor is on screen. Click a floor to look at it.
  drawStack(cv, game, t) {
    const dpr = window.devicePixelRatio || 1, CW = 200, CH = 142;
    if (cv.width !== CW * dpr) { cv.width = CW * dpr; cv.height = CH * dpr; }
    if (!this.thumbs) this.thumbs = [GROUND, 0].map(oy => { // [ground, 1st floor]
      const c = document.createElement('canvas'); c.width = 400; c.height = 210;
      const cx = c.getContext('2d'); cx.filter = 'brightness(1.9) saturate(1.2)'; // the map is lit, the building is dim
      cx.drawImage(this.staticLayer, 0, oy * SS, W * SS, floorH(oy ? 0 : 1) * SS, 0, 0, 400, 210);
      return c;
    });
    const x = cv.getContext('2d'), view = game.viewFloor();
    const sx = 140 / W, sy = 44 / FLOOR_H, kx = 26 / FLOOR_H, X0 = 24, TOPS = [80, 20]; // [ground, 1st] top edges
    const tf = f => [sx, 0, -kx, sy, X0 + FLOOR_H * kx, TOPS[f]];
    const P = (wx, wy) => { const f = floorOf(wy); const [a, , c, d, e, g] = tf(f); const v = (wy - (f ? 0 : GROUND)) * FLOOR_H / floorH(f); return [a * wx + c * v + e, d * v + g]; }; // each slab squeezed to the same depth
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, CW, CH);
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.roundRect(0, 0, CW, CH, 10); x.fill();
    const link = on => { // the staircases, drawn between the two slabs
      x.lineWidth = 1.2;
      for (const p of portals) {
        const [a0, a1] = P(p.a[0] + p.a[2] / 2, p.a[1] + p.a[3] / 2), [b0, b1] = P(p.b[0] + p.b[2] / 2, p.b[1] + p.b[3] / 2);
        x.strokeStyle = on ? 'rgba(255,210,122,0.9)' : 'rgba(255,210,122,0.35)'; x.setLineDash(on ? [] : [2, 2]);
        x.beginPath(); x.moveTo(a0, a1); x.lineTo(b0, b1); x.stroke();
      }
      x.setLineDash([]);
    };
    for (const f of [0, 1]) { // ground first, the 1st floor sits on top of it
      if (f === 1) link(false);
      x.save(); x.transform(...tf(f));
      x.globalAlpha = f === view ? 1 : 0.55;
      x.drawImage(this.thumbs[f], 0, 0, W, FLOOR_H);
      x.globalAlpha = 1;
      x.strokeStyle = f === view ? '#ff9a3c' : 'rgba(255,255,255,0.25)'; x.lineWidth = (f === view ? 2 : 1) / sy * 0.6;
      x.strokeRect(0, 0, W, FLOOR_H);
      x.restore();
      x.font = '800 9px system-ui'; x.textAlign = 'right';
      x.fillStyle = f === view ? '#ffb46b' : 'rgba(255,255,255,0.5)';
      x.fillText(f ? '1F' : 'GF', X0 + 16, TOPS[f] + 12);
    }
    // what is going on: broken things blink red, robots are coloured dots (yours has a ring)
    const blink = Math.sin(t * 8) > 0;
    if (blink) for (const n in game.projectors) if (game.projectors[n].broken) {
      const pos = game.panelOf(n), [px, py] = P(pos.x, pos.y);
      x.fillStyle = '#ff5a4a'; x.beginPath(); x.arc(px, py, 2.4, 0, 7); x.fill();
    }
    for (const a of game.crowd.list) if (a.kind === 'lost' && a.state === 'idle') {
      const [px, py] = P(a.x, a.y); x.fillStyle = '#ffd27a'; x.fillRect(px - 1, py - 1, 2, 2);
    }
    for (const rb of game.robotList) {
      let [px, py] = P(rb.x, rb.y);
      if (rb.away > 0 && rb.climb) { // on the stairs: somewhere between the two floors
        const [qx, qy] = P(rb.climb.fx, rb.climb.fy), k = Math.max(0, 1 - rb.away / rb.climb.dur);
        px = qx + (px - qx) * k; py = qy + (py - qy) * k;
      }
      x.fillStyle = rb.rogue ? '#ff7ad9' : COLORS[rb.kind];
      x.beginPath(); x.arc(px, py, rb.kind === 'biggy' ? 3.4 : 2.8, 0, 7); x.fill();
      if (rb.kind === game.active) { x.strokeStyle = '#fff'; x.lineWidth = 1.2; x.beginPath(); x.arc(px, py, 5, 0, 7); x.stroke(); }
    }
    x.font = '700 8.5px system-ui'; x.textAlign = 'left'; x.fillStyle = 'rgba(255,255,255,0.55)';
    x.fillText('KINEPOLIS · click a floor', 8, CH - 5);
    return { split: (TOPS[0] + TOPS[1] + 44) / 2 }; // y between the two slabs, for clicks
  }

  drawOffscreenIndicators(x, game, t) {
    const currentFloor = game.viewFloor();
    const vx0 = this.vx0 ?? 0, vy0 = this.vy0 ?? (currentFloor ? 0 : GROUND), VW = this.visW || this.viewW || W, VH = this.visH || this.viewH || FLOOR_H;
    const margin = 24;

    const targets = [];
    for (const n in game.projectors) {
      if (game.projectors[n].broken) {
        const pos = game.panelOf(n);
        targets.push({ x: pos.x, y: pos.y, icon: '⚠', col: '#ff5a4a' });
      }
    }
    for (const rb of game.robotList) {
      if (rb.rogue) targets.push({ x: rb.x, y: rb.y, icon: '🔋', col: '#ff7ad9' });
    }
    for (const a of game.crowd.list) {
      if (a.kind === 'lost' && a.state === 'idle') targets.push({ x: a.x, y: a.y, icon: '❓', col: '#ffd27a' });
    }
    for (const b of game.bags) {
      targets.push({ x: b.x, y: b.y, icon: '🎒', col: '#ffd27a' });
    }
    for (const e of game.exits) targets.push({ x: e.x, y: e.y, icon: '🚪', col: '#ffd27a' });
    for (const a of game.crowd.list) if (a.carried && !a.leaving && !a.friend) targets.push({ x: a.x, y: a.y, icon: a.clingy ? a.pest.emoji : '🤩', col: '#ffd27a' });

    x.save();
    x.textAlign = 'center';
    x.font = '800 13px system-ui';

    for (const tg of targets) {
      const tgFloor = floorOf(tg.y);
      const isOtherFloor = tgFloor !== currentFloor;
      const rx = tg.x, ry = tg.y;
      const isOffscreen = isOtherFloor || rx < vx0 + margin || rx > vx0 + VW - margin || ry < vy0 + margin || ry > vy0 + VH - margin;

      if (!isOffscreen) continue;

      let edgeX = Math.max(vx0 + margin, Math.min(vx0 + VW - margin, rx));
      let edgeY = Math.max(vy0 + margin, Math.min(vy0 + VH - margin, ry));
      if (isOtherFloor) edgeY = tgFloor ? vy0 + margin : vy0 + VH - margin;

      const b = Math.sin(t * 6) * 3;
      x.fillStyle = 'rgba(8,10,16,0.92)';
      x.strokeStyle = tg.col;
      x.lineWidth = 2;
      x.beginPath(); x.arc(edgeX, edgeY + b, 14, 0, 7); x.fill(); x.stroke();

      x.fillStyle = '#ffffff';
      x.fillText(tg.icon, edgeX, edgeY + b + 4.5);
    }
    x.restore();
  }
}

function floorColor(px, py, cx, cy) {
  const n = ((cx * 928371 + cy * 12377) % 7) / 7;
  if (py >= GROUND) { // ground floor: dark grey carpet in the hall, pale stone at reception, dark carpet in the BOF rooms
    if (py >= GROUND + 890 && px < 380) return `rgb(${22 + n * 3},${24 + n * 3},${30 + n * 3})`;
    if (px < 490) return `rgb(${56 + n * 5},${55 + n * 5},${52 + n * 5})`;
    return `rgb(${40 + n * 4},${41 + n * 4},${45 + n * 4})`; // the hall: dark grey carpet (the drone video)
  }
  if (px >= 1300) return `rgb(${26 + n * 3},${30 + n * 3},${38 + n * 3})`; // the lounge: soft carpet
  if (px < 100 && (py < 320 || py >= 510)) return `rgb(${44 + n * 5},${43 + n * 5},${41 + n * 5})`; // service concrete
  if (py >= 330 && py < 500) return `rgb(${27 + n * 3},${34 + n * 3},${60 + n * 5})`;    // corridor: navy carpet
  return ROOM_CARPET;                                                                      // auditorium: one plain carpet, aisles included
}

