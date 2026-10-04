import { Game, DAYS } from './game.js';
import { floorOf } from './level.js';
import { Renderer, reducedMotion } from './render.js';
import { SPECS, drawRobotFront, COLORS, LOW, LOW_BELOW } from './robots.js';
import { audio } from './audio.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const renderer = new Renderer(canvas);
let best = 0; try { best = +(localStorage.getItem('keepcalm.best') || 0); } catch (e) {}
try { localStorage.removeItem('keepcalm.playlogs'); } catch (e) {} // older versions kept the last play logs here, and nothing ever read them

// ------------------------------------------------------------ input
const keys = new Set();
const input = { x: 0, y: 0, hold: false, holdLock: false, consumeHold() { this.holdLock = true; } };
const touch = { x: 0, y: 0, hold: false, on: false }; // the on-screen stick and E button (touch screens)
const KEYMAP = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0], KeyZ: [0, -1], KeyQ: [-1, 0] };
const ROBOT_KEYS = { Digit1: 'voxxy', Digit2: 'droid', Digit3: 'biggy', Numpad1: 'voxxy', Numpad2: 'droid', Numpad3: 'biggy' };
const ORDER = ['voxxy', 'droid', 'biggy'];

let state = 'title', game = null;
// in the menus, Tab moves between the buttons as on any page, and the button you tabbed to answers Enter and Space itself;
// after a click (the focus stays on the clicked button), Enter and Space press the highlighted button, and only that one
let tabbing = false;
addEventListener('pointerdown', () => { tabbing = false; }, true);

addEventListener('keydown', e => {
  audio.init();
  if (state !== 'playing' && e.code === 'Tab') { tabbing = true; return; }
  const f = document.activeElement;
  if (tabbing && state !== 'playing' && (e.code === 'Enter' || e.code === 'Space') && f?.offsetParent && f.closest('.overlay:not(.hidden)')) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat && !KEYMAP[e.code]) return;
  keys.add(e.code);
  if (state === 'playing') {
    if (ROBOT_KEYS[e.code]) select(ROBOT_KEYS[e.code]);
    if (e.code === 'Tab') {
      for (let k = 1; k <= 2; k++) { const n = ORDER[(ORDER.indexOf(game.active) + (e.shiftKey ? 3 - k : k)) % 3]; if (!game.robots[n].rogue) { select(n); break; } }
    }
    if (e.code === 'KeyE' || e.code === 'Space') game.action();
    if (e.code === 'KeyP' || e.code === 'Escape') pause(true);
    if (e.code === 'KeyN') takeNote();
    if (e.code === 'KeyT') cycleSpeed(); // the pace of the day: ×1, ×2
    if (e.code === 'Digit0' || e.code === 'Numpad0') handToAI(); // hand everything back to the AI
    // the view: F toggles floors, Page Up / Page Down pick one (your robot keeps working where it is)
    if (e.code === 'KeyF') game.lookAt(1 - game.viewFloor());
    if (e.code === 'PageUp') { e.preventDefault(); game.lookAt(1); }
    if (e.code === 'PageDown') { e.preventDefault(); game.lookAt(0); }
  } else if (state === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) pause(false); // (also closes the quit question)
  else if (state === 'paused' && e.code === 'KeyR') begin(); // restart the day: only from the pause menu, R is right next to E
  else if (state === 'title' && titleStep === 2 && ROBOT_KEYS[e.code]) choose(ROBOT_KEYS[e.code]);
  else if (state === 'title' && titleStep === 2 && (e.code === 'Digit0' || e.code === 'Numpad0')) choose(AI_ALL);
  else if (state === 'title' && e.code === 'Escape' && titleStep > 1) step(titleStep - 1);
  else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); const b = [...document.querySelectorAll('.overlay:not(.hidden) .primary')].find(el => el.offsetParent && !el.closest('#title .step:not(.on)')); if (b) b.click(); } // only the visible step's button
  if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') $('#mute').textContent = audio.toggleMute() ? '🔇' : '🔊';
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'KeyE' || e.code === 'Space') input.holdLock = false; });
addEventListener('blur', () => keys.clear());

function readInput() {
  let x = 0, y = 0;
  for (const k of keys) if (KEYMAP[k]) { x += KEYMAP[k][0]; y += KEYMAP[k][1]; }
  input.x = Math.sign(x); input.y = Math.sign(y);
  if (touch.x || touch.y) { input.x = touch.x; input.y = touch.y; } // the virtual stick
  input.hold = !input.holdLock && (keys.has('KeyE') || keys.has('Space') || touch.hold);
}

let lastSelectTime = 0;
function select(kind) {
  if (!game) return;
  const now = Date.now();
  if (game.active === kind) {
    if (now - lastSelectTime < 350) {
      const rb = game.robots[kind];
      if (rb) { game.float(rb.x, rb.y - rb.r - 16, '🎯 FOCUSED', '#7bdc6b'); game.shake = Math.max(game.shake, 2.5); audio.tick(); renderer.ping = { kind, t0: performance.now() / 1000 }; }
    }
    lastSelectTime = now;
    return;
  }
  if (game.select(kind)) {
    audio.tick(); updateCards(); logEvent('switch', { to: kind });
    renderer.ping = { kind, t0: performance.now() / 1000 }; // where it is: a ring goes out from it
    lastSelectTime = now;
  }
}

// ------------------------------------------------------------ playtest journal
// Everything the player saw, which robot they steered, calm and satisfaction every few
// seconds, and their own notes (N). Saved as a JSON file from the results screen.
let playlog = null, nextSnap = 0;
function logEvent(type, data) {
  if (!playlog || !game || game.attract) return;
  playlog.events.push({ clock: game.clock.text, t: +game.t.toFixed(1), type, ...data });
}
function snapshot() {
  const robots = Object.fromEntries(game.robotList.map(r => [r.kind, { energy: Math.round(r.patience), wornOut: r.rogue, task: r.task }]));
  logEvent('snapshot', { satisfaction: Math.round(game.satisfaction), active: game.active, robots });
}
function takeNote() {
  pause(true); keys.clear();
  const text = prompt(`Playtest note (${game.clock.text}): what are you seeing or feeling?`);
  if (text) { logEvent('note', { text }); ui.toast(`📝 Noted: ${text}`); }
  pause(false);
}
// Everything anyone said (robots, attendees, the game's messages), to check the lines fit who says them
function saveLines() {
  if (!playlog) return;
  const by = {};
  for (const l of playlog.lines) by[l.who] = (by[l.who] || 0) + 1;
  const txt = [`Overclocked · what everyone said · ${playlog.day} · ${playlog.started}`, '',
    ...playlog.lines.map(l => `[${l.clock}] ${l.who}: ${l.text}`), '', 'Lines per speaker:',
    ...Object.entries(by).sort((a, b) => b[1] - a[1]).map(([w, n]) => `  ${String(n).padStart(4)}  ${w}`)].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
  a.download = `overclocked-lines-${playlog.started.replace(/[:T]/g, '-').slice(0, 16)}.txt`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function savePlaylog() {
  const stamp = playlog.started.replace(/[:T]/g, '-').slice(0, 16);
  const blob = new Blob([JSON.stringify(playlog, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `overclocked-playtest-${stamp}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ------------------------------------------------------------ UI
const ui = {
  toast(msg, kind = '', first = false) { // first: it jumps the queue (it explains what just happened)
    logEvent('toast', { text: msg, kind });
    if (playlog && game && !game.attract) playlog.lines.push({ clock: game.clock.text, t: +game.t.toFixed(1), who: 'Game (message)', text: msg });
    if (toastOn?.msg === msg) return; // already on screen
    const queued = toastQ.findIndex(q => q.msg === msg);
    if (queued >= 0) { if (!first) return; toastQ.splice(queued, 1); } // already waiting: a first one moves to the front
    toastQ[first ? 'unshift' : 'push']({ msg, kind, first });
    while (toastQ.length > 3) { // a pile-up: the oldest good news goes first, then the oldest bad news; never a first one
      let i = toastQ.findIndex(q => !q.first && q.kind !== 'bad');
      if (i < 0) i = toastQ.findIndex(q => !q.first);
      if (i < 0) break;
      toastQ.splice(i, 1);
    }
    if (toastOn && first) { // it explains what just happened: now, and the message it interrupts comes back right after
      if (Date.now() - toastOn.t0 < 1500) toastQ.splice(1, 0, { msg: toastOn.msg, kind: toastOn.kind });
      endToast();
    } else if (toastOn && Date.now() - toastOn.t0 > 2000) endToast(); // others are waiting, and this one has been seen
    showToast();
  },
  onSwitch() { updateCards(); },
  onLine(t, text, who) { if (playlog && game && !game.attract) playlog.lines.push({ clock: game.clock.text, t: +t.toFixed(1), who, text }); },
  roundOver(r) {
    snapshot(); logEvent('result', { result: r });
    window.__playlog = playlog;
    state = 'results'; setTimeout(() => showResults(r), 900);
  },
};

// the game's messages: one at a time, above the robot cards (not over the rooms), the bad news first
const toastQ = []; let toastOn = null;
function showToast() {
  if (toastOn || !toastQ.length) return;
  const i = toastQ.findIndex(q => q.kind === 'bad');
  const { msg, kind } = toastQ.splice(i >= 0 ? i : 0, 1)[0];
  const el = document.createElement('div');
  el.className = `toast ${kind}`; el.textContent = msg;
  const who = /\b(Voxxy|Droid|Biggy)\b/.exec(msg)?.[1]?.toLowerCase(); // a message about a robot: in that robot's colour
  if (who) { el.style.borderColor = COLORS[who]; el.style.boxShadow = `0 0 14px ${COLORS[who]}55`; }
  $('#toasts').appendChild(el);
  const stay = Math.min(7000, Math.max(3000, 2400 + msg.length * 45)); // long messages stay long enough to read
  toastOn = { msg, kind, el, t0: Date.now(), timer: setTimeout(endToast, stay) };
}
function endToast() {
  if (!toastOn) return;
  const { el, timer } = toastOn; clearTimeout(timer); toastOn = null;
  el.classList.add('out'); setTimeout(() => el.remove(), 400);
  setTimeout(showToast, 250);
}
function clearToasts() { toastQ.length = 0; if (toastOn) clearTimeout(toastOn.timer); toastOn = null; $('#toasts').innerHTML = ''; }

let screen = null; // the screen on top of the map, if any; the start and end screens cover it all
const COVERING = ['title', 'results', 'week'];
function show(id) { screen = id; document.querySelectorAll('.overlay').forEach(o => { o.classList.toggle('hidden', o.id !== id); if (o.id === id) o.scrollTop = 0; }); } // every screen opens at its top

// the robots standing, seen from the front, like on their model sheets (in the game they're seen from above)
function portrait(kind, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  drawRobotFront(x, kind, size / 2, size * 0.04, size * 0.92);
  return c;
}

function buildCards() {
  const wrap = $('#cards');
  wrap.innerHTML = '';
  for (const k of ORDER) {
    const s = SPECS[k];
    const el = document.createElement('button');
    el.className = `card ${k}`; el.dataset.kind = k;
    el.innerHTML = `<div class="pic"></div><div class="txt"><b><em class="who"></em>${s.key} · ${s.name} <em class="mood"></em></b><div class="calm"><small>energy</small><div class="pat"><div></div></div></div><i>${s.role} · <u class="task"></u></i></div>`; // what each robot does is on the title screen: no need to repeat it all day
    el.querySelector('.pic').appendChild(portrait(k, 54));
    // 👁 follow this robot with the camera without steering it (a second tap stops following)
    const eye = document.createElement('span'); eye.className = 'follow'; eye.textContent = '👁'; eye.title = 'Follow this robot without steering it';
    eye.onclick = e => { e.stopPropagation(); if (!game) return; game.follow = game.follow === k ? null : k; game.viewOverride = null; updateCards(); };
    el.appendChild(eye);
    el.onclick = () => select(k);
    el.onpointerenter = () => { renderer.hover = k; }; // point at a card: its robot pulses on the map
    el.onpointerleave = () => { if (renderer.hover === k) renderer.hover = null; };
    wrap.appendChild(el);
  }
}
// the guide arrow: a help, on by default, that the player can turn off (remembered)
let arrowOn = true;
try { arrowOn = localStorage.getItem('keepcalm.arrow') !== 'off'; } catch (e) {}
function setArrow(on) {
  arrowOn = on; renderer.showArrow = on; if (game) game.showArrow = on;
  try { localStorage.setItem('keepcalm.arrow', on ? 'on' : 'off'); } catch (e) {}
  $('#t-arrow').checked = on; $('#p-arrow').textContent = `➜ Guide arrow: ${on ? 'on' : 'off'}`;
}
// the pace of the day (T, or the ⏩ button): the same simulation, just more of it per second. Kept for the session.
const SPEEDS = [1, 2]; // it stays where you put it: a faster day is at your own risk
let speed = 1;
function setSpeed(n) {
  speed = n;
  $('#h-speed').textContent = `⏩ ×${speed}`; $('#h-speed').classList.toggle('fast', speed > 1);
  logEvent('speed', { speed });
}
function cycleSpeed() { setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]); audio.tick(); }
// hand all three robots to the AI and just watch (0, or the 🤖 AI button on a phone); tap a robot to take one back
function handToAI() {
  if (!game || !game.active) return;
  game.active = null; updateCards(); logEvent('switch', { to: 'ai' });
  ui.toast(touch.on ? 'The AI runs all three robots. Tap a robot to take one back.' : 'The AI runs all three robots. Press 1 2 3 to take one back.');
}
function updateCards() {
  $('#h-ai').classList.toggle('hidden', !game.active); // nothing to hand over while you're already watching
  $('#h-watch').classList.toggle('hidden', !!game.active); // in its place: how to take a robot back
  $('#h-watch').textContent = touch.on ? '🤖 Watching · tap a robot to take over' : '🤖 Watching · press 1 2 3 to take over';
  $('#touch').classList.toggle('watching', !game.active); // and no stick or E button: nothing to steer
  document.querySelectorAll('.card').forEach(c => {
    c.classList.toggle('active', c.dataset.kind === game.active);
    c.classList.toggle('following', c.dataset.kind === game.follow);
    c.classList.toggle('rogue', game.robots[c.dataset.kind].rogue);
  });
}

// the title, in three steps: welcome, pick your first robot, rules and day
const PICK = {
  // the same shape for all three: two lines of job, then two lines of what wears them down
  voxxy: { job: 'You fix what breaks: projectors, Wi-Fi…<br>Hold E to fix.', hate: 'Light and fast.<br>Tired by long repairs and button pressers 🔧' },
  droid: { job: 'You lead lost attendees ❓ to their room\'s door.<br>Walk up to them: they follow you.', hate: 'Slow and steady.<br>Tired by long escorts and selfie fans 📸' },
  biggy: { job: 'You keep order: bags 🎒, stairs 🚪, fans 🤩.<br>Just stand next to them.', hate: 'Heavy: mind the momentum.<br>Tired by security checks and crowds 🔊' },
};
const AI_ALL = 'ai'; // no robot: the AI runs all three, you watch and can take over any time
let titleStep = 1, firstRobot = 'voxxy';
try { firstRobot = localStorage.getItem('keepcalm.first') || 'voxxy'; } catch (e) {}
function step(n) {
  titleStep = n; $('#title').scrollTop = 0; // each step opens at its top (on a phone, Start sits at the bottom of step 1)
  document.querySelectorAll('#title .step').forEach(s => s.classList.toggle('on', +s.dataset.step === n));
  if (n === 2) buildPick();
  if (n === 3) buildDays();
}
function choose(k) {
  firstRobot = k;
  try { localStorage.setItem('keepcalm.first', k); } catch (e) {}
  document.querySelectorAll('#t-pick button').forEach(b => b.classList.toggle('on', b.dataset.kind === k));
  audio.tick();
}
function buildPick() {
  const wrap = $('#t-pick'); wrap.innerHTML = '';
  ORDER.forEach(k => {
    const s = SPECS[k], b = document.createElement('button');
    b.dataset.kind = k; b.className = k === firstRobot ? 'on' : '';
    b.style.setProperty('--rc', COLORS[k]); // each robot in its own colour, as on the map and its card during the day
    b.appendChild(portrait(k, 96));
    b.insertAdjacentHTML('beforeend', `<b>${s.key} · ${s.name}</b><span class="role">${s.role}</span><span class="job">${PICK[k].job}</span><span class="hate">${PICK[k].hate}</span>`);
    b.onclick = () => choose(k);
    b.ondblclick = () => { choose(k); step(3); };
    wrap.appendChild(b);
  });
  const ai = document.createElement('button');
  ai.dataset.kind = AI_ALL; ai.className = `all-ai ${firstRobot === AI_ALL ? 'on' : ''}`;
  ai.innerHTML = '<b>0 · Let the AI run them all</b><span class="job">Watch the three robots work on their own: they do the jobs, but nobody looks after them, and sooner or later they wear out.<span class="aihow">Take over any one with 1 2 3 (or tap it), hand it back with 0 (or 🤖 AI), switch floors with F.</span></span>';
  ai.onclick = () => choose(AI_ALL);
  ai.ondblclick = () => { choose(AI_ALL); step(3); };
  wrap.appendChild(ai);
}

function attract() {
  if (!game) game = new Game(ui);
  game.ui = { toast() {}, roundOver: r => ui.roundOver(r) };
  game.attract = true; audio.setDemo(true); // a day set up behind the start screens, hidden and paused: nothing has started yet
  game.start(0, 'ai');
  if (!renderer.staticLayer) renderer.buildStatic(game);
  $('#hud').classList.add('hidden');
  const hero = $('#hero');
  hero.innerHTML = '';
  ORDER.forEach(k => hero.appendChild(portrait(k, 110)));
  buildPick(); buildDays(); // all three steps filled from the start: the panel keeps one size
  weekLine();
  step(1);
  show('title'); state = 'title';
}

// the week: which days are unlocked, and which one is picked
let unlocked = 0, dayIdx = 0;
try { unlocked = dayIdx = Math.min(DAYS.length - 1, +(localStorage.getItem('keepcalm.unlocked') || 0)); } catch (e) {}
function dayStars(i) { // the best stars won on that day, if any
  try { const d = JSON.parse(localStorage.getItem('keepcalm.days') || '{}')[i]; return d ? `<em class="dstars">${'★'.repeat(d.stars)}${'☆'.repeat(3 - d.stars)}</em>` : ''; } catch (e) { return ''; }
}
function dayLabel(i) { return `${DAYS[i].name} · ${DAYS[i].kind}`; }
// the whole week: the best stars of each day, and what the robots did on the last day you won
const readKey = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch (e) { return JSON.parse(d); } };
function weekStars() { const d = readKey('keepcalm.days', '{}'); return DAYS.reduce((t, _, i) => t + (d[i]?.stars || 0), 0); }
let resetArmed = null, resetDone = false;
function weekLine() {
  const t = weekStars();
  // the week's total above the days; under the buttons, a small reset link (only when there is something to reset)
  $('#t-week').innerHTML = t ? `Your week: <b>${t}/${DAYS.length * 3} ★</b>` : '';
  $('#t-resetline').innerHTML = resetDone ? 'Progress reset ✓'
    : t ? `<button id="t-reset" class="linkbtn${resetArmed ? ' armed' : ''}">${resetArmed ? 'Reset your week? Click again' : 'Reset progress'}</button>` : '';
  const r = $('#t-reset'); if (r) r.onclick = resetProgress;
  $('#t-best').textContent = t ? `Your week so far: ${t}/${DAYS.length * 3} ★${best ? ` · best day ${best}% satisfaction` : ''}` : '';
}
// two clicks, no browser dialog (some browsers and in-app views block confirm() and answer "no" at once)
function resetProgress() {
  if (!resetArmed) { resetArmed = setTimeout(() => { resetArmed = null; weekLine(); }, 4000); weekLine(); return; }
  clearTimeout(resetArmed); resetArmed = null;
  for (const k of ['keepcalm.unlocked', 'keepcalm.days', 'keepcalm.best', 'keepcalm.week']) { try { localStorage.removeItem(k); } catch (e) {} }
  unlocked = dayIdx = 0; best = 0; resetDone = true;
  buildDays(); audio.tick();
  setTimeout(() => { resetDone = false; weekLine(); }, 2500);
}
function buildDays() {
  $('#t-days').innerHTML = DAYS.map((d, i) => `<button data-i="${i}" class="${i === dayIdx ? 'on' : ''}" ${i > unlocked ? 'disabled title="Win the day before to unlock it"' : ''}><b>${i > unlocked ? '🔒 ' : ''}${d.name}</b><small>${d.kind}</small>${dayStars(i)}</button>`).join('');
  $('#t-days').querySelectorAll('button').forEach(b => b.onclick = () => { dayIdx = +b.dataset.i; buildDays(); });
  $('#t-go').textContent = 'Open the doors ▶'; // the chosen day is the highlighted one above
  weekLine();
}

function begin(d = dayIdx) {
  dayIdx = d;
  game.attract = false; audio.setDemo(false);
  game.ui = ui;
  game.start(dayIdx, firstRobot);
  game.showArrow = arrowOn;
  $('#h-title').textContent = `${DAYS[dayIdx].name} · until ${DAYS[dayIdx].end}`; // when the day ends, always in sight
  playlog = { started: new Date().toISOString(), day: dayLabel(dayIdx), screen: `${innerWidth}x${innerHeight}`, events: [], lines: [] }; nextSnap = 0;
  clearToasts();
  buildCards(); updateCards();
  show(null);
  $('#hud').classList.remove('hidden');
  renderer.resize(); // the cards are in: fit the map above them
  state = 'playing';
  audio.ding();
  ui.toast(firstRobot === AI_ALL
    ? `${DAYS[dayIdx].name}, 08:30. The AI runs the robots. Take one over any time.`
    : `${DAYS[dayIdx].name}, 08:30. You steer ${SPECS[firstRobot].name}. Look after all three!`);
}

function pause(on) { state = on ? 'paused' : 'playing'; show(on ? 'paused' : null); }

function launchConfetti() {
  const overlay = $('#results');
  if (!overlay) return;
  const colors = ['#f28a1c', '#ffd27a', '#7bdc6b', '#9fdcff', '#ff7ad9', '#ffffff'];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = `${Math.random() * 100}%`;
    el.style.top = `-10px`;
    el.style.backgroundColor = colors[(Math.random() * colors.length) | 0];
    el.style.width = `${6 + Math.random() * 8}px`;
    el.style.height = `${8 + Math.random() * 10}px`;
    el.style.animation = `confettiFall ${2 + Math.random() * 2.5}s ease-out forwards`;
    el.style.animationDelay = `${Math.random() * 0.6}s`;
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

function showResults(r) {
  if (r.reason === 'day' && r.satisfaction > best) { best = r.satisfaction; try { localStorage.setItem('keepcalm.best', best); } catch (e) {} }
  $('#r-stars').textContent = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  // a record for this day? (stars first, then satisfaction)
  let days = {}; try { days = JSON.parse(localStorage.getItem('keepcalm.days') || '{}'); } catch (e) {}
  const prev = days[dayIdx], isBest = r.reason === 'day' && (!prev || r.stars > prev.stars || (r.stars === prev.stars && r.satisfaction > prev.sat));
  if (isBest) { days[dayIdx] = { stars: r.stars, sat: r.satisfaction }; try { localStorage.setItem('keepcalm.days', JSON.stringify(days)); } catch (e) {} }
  if (isBest && prev) $('#r-stars').insertAdjacentHTML('beforeend', ' <small class="newbest">New best!</small>');
  const D = DAYS[dayIdx], last = dayIdx === DAYS.length - 1, won = r.reason === 'day';
  if (won && !last && dayIdx + 1 > unlocked) { unlocked = dayIdx + 1; try { localStorage.setItem('keepcalm.unlocked', unlocked); } catch (e) {} }
  $('#r-kicker').textContent = won ? `${D.end} · ${D.name.toUpperCase()} IS OVER` : `${D.name.toUpperCase()} ${r.time} · GAME OVER`;
  $('#r-title').textContent = {
    day: r.stars === 3 ? `A perfect ${D.name}. The robots are still smiling.`
      : r.revolts && r.satisfaction >= 75 ? `The attendees had a good ${D.name}. The robots, not so much.` // not "smiling" when one of them wore out
      : r.stars === 2 ? `Good ${D.name}! A few bumps along the way.` : 'You made it… barely.',
    revolt: 'All three robots are worn out at once. Nobody is left to keep Devoxx running.',
    chaos: 'The attendees gave up. Devoxx descended into chaos.',
  }[r.reason];
  $('#r-moral').textContent = 'Even the best robots need a break.';
  // the stars: one per objective, each ticked or not
  const ok = (met, text) => `<span class="${met ? 'met' : 'miss'}">${met ? '✓' : '✗'} ${text}</span>`;
  $('#r-next').innerHTML = !won
    ? `<span class="tip">${r.reason === 'revolt' ? 'Tip: when a robot\'s energy turns yellow, go and stay with it (hold E) before it runs out.' : 'Tip: every breakdown, lost attendee and worn-out robot costs satisfaction. Keep the robots going, and they keep Devoxx going.'}</span>`
    : `<b>${r.stars === 3 ? 'A perfect day:' : 'One star each:'}</b> ${ok(true, 'closing time')} ${ok(!r.revolts, `nobody worn out${r.revolts ? ` <small>(${r.revolts}×)</small>` : ''}`)} ${ok(r.satisfaction >= 75, `75% satisfaction <small>(${r.satisfaction}%)</small>`)}`;
  // the week: remember what the robots did today, and after Friday, tell the whole story
  const week = readKey('keepcalm.week', '{}');
  if (won) { week[dayIdx] = { stars: r.stars, sat: r.satisfaction, fixed: r.fixed, delivered: r.delivered, bags: r.bags || 0, exits: r.exits || 0, fans: r.fans || 0, stayed: r.stayed || 0 }; try { localStorage.setItem('keepcalm.week', JSON.stringify(week)); } catch (e) {} }
  const weekEnd = won && last; // after Friday, a second screen tells the whole week
  if (weekEnd) weekFinale(week);
  // the moment of the day: a robot you stayed with, or one that struggled and nobody noticed
  const worst = ORDER.map(k => ({ k, v: Math.round(r.lowest[k]) })).sort((a, b) => a.v - b.v)[0];
  const stays = r.stays || [];
  const alone = r.alone || [], aloneKinds = ORDER.filter(k => alone.some(d => d.kind === k)); // ran down, and nobody came (no star lost: it is told)
  const moments = [];
  if (stays.length) { const m = stays.slice().sort((a, b) => a.calm - b.calm)[0]; moments.push(`💛 You stayed with ${m.name} when it was ${m.rogue ? 'worn out' : 'running low'} at ${m.clock}.`); }
  for (const k of aloneKinds) { const d = alone.filter(a => a.kind === k).sort((a, b) => a.low - b.low)[0]; moments.push(`😟 ${d.name} ran down to ${d.low}% energy at ${d.clock}, and nobody noticed.`); }
  if (!moments.length) moments.push(worst.v >= 60 ? '🔋 Nobody ran low today.' : `🙂 ${SPECS[worst.k].name} ran low at ${r.lowestAt[worst.k]}, but kept going.`);
  $('#r-moment').innerHTML = moments.join('<br>');
  // the three robots, each with its lowest calm of the day
  const bars = $('#r-robots'); bars.innerHTML = '';
  for (const k of ORDER) {
    const v = Math.round(r.lowest[k]), col = v > 60 ? '#7bdc6b' : v > 30 ? '#ffe14a' : '#ff6a2a';
    const el = document.createElement('div'); el.className = 'rrob';
    el.appendChild(portrait(k, 44));
    el.insertAdjacentHTML('beforeend', `<div><b>${SPECS[k].name}</b><div class="rbar"><div style="width:${Math.max(3, v)}%;background:${col}"></div></div><small>lowest energy <span style="color:${col}">${v}</span></small></div>`);
    bars.appendChild(el);
  }
  $('#r-rows').innerHTML = [
    ['😊 Attendee satisfaction', `${r.satisfaction}%`],
    ['🤝 Times you stayed with a robot', r.stayed || 0],
    ['⚠ Breakdowns fixed', r.fixed],
    ['❓ Lost attendees guided', r.delivered],
    ['🎒 Bags checked', r.bags || 0],
    ['🚪 Stairs cleared', r.exits || 0],
    ['🤩 Fans calmed down', r.fans || 0],
    ['🔋 Times a robot wore out', r.revolts ? `${r.revolts} (${r.reboots} recharged and back)` : 'none'],
    ...(r.bumps ? [['💥 People bumped by Biggy <small>slow down near people</small>', r.bumps]] : []),
  ].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join(''); // the star scale is on the rules page, and the ★★★ checklist at the top
  const next = won && !last;
  $('#r-retry').textContent = next ? `▶ Next: ${dayLabel(dayIdx + 1)}` : weekEnd ? '▶ Your Devoxx week' : '↻ Play again';
  $('#r-retry').onclick = () => weekEnd ? show('week') : begin(next ? dayIdx + 1 : dayIdx);
  $('#r-again').classList.toggle('hidden', !((next || weekEnd) && r.stars < 3)); // won, but not perfect: have another go
  $('#r-again').onclick = () => begin(dayIdx);
  $('#r-menu').onclick = () => attract();
  $('#hud').classList.add('hidden');
  show('results');
  clearToasts(); // the day is over: no message left over the results
  if (won) { if (!reducedMotion.matches) launchConfetti(); audio.chime(); }
}

// after Friday: the whole week, day by day and robot by robot
function weekFinale(week) {
  const el = $('#w-week');
  const best = readKey('keepcalm.days', '{}');
  const sum = k => DAYS.reduce((t, _, i) => t + (week[i]?.[k] || 0), 0);
  const dayStarsOf = DAYS.map((_, i) => Math.max(best[i]?.stars || 0, week[i]?.stars || 0)), total = dayStarsOf.reduce((a, b) => a + b, 0);
  const days = DAYS.map((d, i) => `<span><b>${d.name.slice(0, 3)}</b>${'★'.repeat(dayStarsOf[i])}${'☆'.repeat(3 - dayStarsOf[i])}</span>`).join('');
  const lines = {
    voxxy: `fixed <b>${sum('fixed')}</b> breakdowns`,
    droid: `guided <b>${sum('delivered')}</b> lost attendees to their room`,
    biggy: `checked <b>${sum('bags')}</b> bags, cleared the stairs <b>${sum('exits')}</b> times and calmed <b>${sum('fans')}</b> fans`,
  };
  const stayed = sum('stayed');
  $('#w-title').textContent = total >= 13 ? 'Five days of Devoxx, and the robots are still smiling. See you next year!'
    : total >= 9 ? 'Five days of Devoxx! A good week, and a few tired robots.'
    : 'Five days of Devoxx! The attendees made it… and so did the robots, just.';
  el.innerHTML = `<h3>Your week · ${total}/${DAYS.length * 3} ★</h3><div class="wdays">${days}</div><div class="wrobs"></div>`
    + `<p class="wend">${stayed ? `You stayed with a robot <b>${stayed}</b> times this week. Nobody else noticed they needed it.` : 'Nobody stayed with them all week. They made it anyway… this time.'}</p>`;
  const robs = el.querySelector('.wrobs');
  for (const k of ORDER) {
    const row = document.createElement('div'); row.className = 'wrob';
    row.appendChild(portrait(k, 36));
    row.insertAdjacentHTML('beforeend', `<span><b>${SPECS[k].name}</b> ${lines[k]}.</span>`);
    robs.appendChild(row);
  }
}

// ------------------------------------------------------------ HUD
let hudIssues = '';
function hud() {
  const c = game.clock;
  $('#h-clock').textContent = c.text;
  // under the clock: the current break or the next one (the end of the day is in the title); the last seconds count down
  const sch = game.schedule;
  $('#h-left').textContent = c.left < 20 || !sch ? `${Math.ceil(c.left)}s left` : sch;
  const s = game.satisfaction;
  $('#h-bar').style.width = `${s}%`;
  $('#h-bar').style.background = s > 60 ? '#7bdc6b' : s > 30 ? '#ffe14a' : '#ff5a4a';
  $('#h-sat').textContent = `😊 Attendee satisfaction ${Math.round(s)}%`;
  let lost = 0, pests = 0;
  for (const a of game.crowd.list) { if (a.kind === 'lost' && a.state === 'idle') lost++; if (a.kind === 'pest' && !a.leaving) pests++; }
  const broken = Object.values(game.projectors).filter(p => p.broken).length;
  const issues = `<span title="Lost attendees">❓ ${lost}</span><span title="Breakdowns">⚠ ${broken}</span><span title="Fans">📸 ${pests}</span><span title="Spills">🧹 ${game.spills.length}</span>`;
  if (issues !== hudIssues) { $('#h-issues').innerHTML = issues; hudIssues = issues; } // rebuilt only when a count changes, not every frame
  document.querySelectorAll('.card').forEach(el => {
    const rb = game.robots[el.dataset.kind];
    const p = rb.patience;
    const bar = el.querySelector('.pat div');
    bar.style.width = `${rb.rogue ? p / 0.4 : p}%`; // worn out: shows the recharge toward 40
    bar.style.background = rb.rogue ? '#ff7ad9' : p < LOW_BELOW ? LOW : COLORS[el.dataset.kind]; // the robot's own colour, like its ring on the map
    el.querySelector('.mood').textContent = rb.rogue ? '🔋 worn out' : rb.pester ? `😣 ${rb.pester.emoji} on me!` : p > 60 ? '🙂' : p > 30 ? '😐' : '😣';
    el.classList.toggle('rogue', rb.rogue);
    el.classList.toggle('danger', !rb.rogue && p < 25);
    el.classList.toggle('active', el.dataset.kind === game.active);
    el.querySelector('.who').textContent = rb.rogue ? (el.dataset.kind === game.active ? 'YOU · RECHARGING' : 'RECHARGING') : el.dataset.kind === game.active ? 'YOU' : 'AI';
    el.querySelector('.task').textContent = (floorOf(rb.y) ? '' : '⬇ ground floor · ') + (rb.rogue ? 'worn out: recharging ⚡' : rb.task === 'you' ? 'you are steering' : el.dataset.kind === game.active && rb.task !== 'idle' ? `selected, AI working: ${rb.task}` : rb.task === 'idle' ? 'AI, waiting' : `AI: ${rb.task}`);
  });
}

// ------------------------------------------------------------ loop
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (state === 'playing') {
    readInput();
    acc += dt * speed;
    game.timeScale = speed; // the floating lines stay up as long, in real time, at any pace
    let n = 0;
    while (acc >= STEP && n++ < 3 * speed) { game.update(STEP, input); acc -= STEP; }
    if (game.t >= nextSnap) { snapshot(); nextSnap = game.t + 5; }
    if (n >= 3 * speed) acc = 0;
    hud();
  } else acc = 0;
  if (game && renderer.staticLayer && !COVERING.includes(screen)) { // nothing to draw behind the start and end screens
    renderer.draw(game, t, {});
    if (state === 'playing' || state === 'paused') stackInfo = renderer.drawStack(stackCv, game, t);
  }
  requestAnimationFrame(frame);
}

addEventListener('resize', () => renderer.resize());
renderer.resize();
attract();
$('#t-go').onclick = () => { audio.init(); begin(); };
$('#t-start').onclick = () => { audio.init(); step(2); };
$('#h-floor').onclick = () => { if (state === 'playing') game.lookAt(1 - game.viewFloor()); };
$('#h-ai').onclick = () => { if (state === 'playing') handToAI(); };
$('#h-speed').onclick = () => { if (state === 'playing') cycleSpeed(); };
$('#t-arrow').onchange = e => setArrow(e.target.checked);
$('#p-arrow').onclick = () => setArrow(!arrowOn);
setArrow(arrowOn);
// tap (or click) a robot on the map to take control of it
canvas.addEventListener('pointerdown', e => {
  if (state !== 'playing' || !renderer.viewW) return;
  const r = canvas.getBoundingClientRect();
  const k = renderer.k || 1, wx = renderer.vx0 + (e.clientX - r.left) * renderer.viewW / r.width / k, wy = renderer.vy0 + (e.clientY - r.top) * renderer.viewH / r.height / k; // (k: the ground floor shown smaller)
  const hit = game.robotList.filter(rb => Math.hypot(rb.x - wx, rb.y - wy) < rb.r + 18).sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy))[0];
  if (hit) select(hit.kind);
});
// Touch screens (a judge on a phone or a tablet): a virtual stick to steer, a button to hold E.
// Switching robots is a tap on their card; the floor button and the stacked map switch floors.
function showTouch() { if (touch.on) return; touch.on = true; $('#touch').classList.remove('hidden'); document.body.classList.add('touch'); renderer.resize(); }
if (matchMedia('(pointer: coarse)').matches) showTouch();
$('#rotate').onclick = () => document.body.classList.add('rotate-ok'); // seen it: don't insist
addEventListener('touchstart', showTouch, { once: true, passive: true });
{
  const stick = $('#stick'), knob = $('#knob'), R = 44; let id = null, cx = 0, cy = 0;
  const move = e => {
    let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const k = Math.hypot(dx, dy) / R; touch.x = k > 0.25 ? dx / R : 0; touch.y = k > 0.25 ? dy / R : 0;
  };
  const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (_) {} }; // keep the finger even if it slides off
  stick.addEventListener('pointerdown', e => { id = e.pointerId; capture(stick, e); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); e.preventDefault(); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  const end = e => { if (e.pointerId !== id) return; id = null; touch.x = touch.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  const be = $('#btn-e'), up = () => { touch.hold = false; input.holdLock = false; };
  be.addEventListener('pointerdown', e => { touch.hold = true; if (state === 'playing') game.action(); capture(be, e); e.preventDefault(); }); // like the E key: press, then hold
  be.addEventListener('pointerup', up); be.addEventListener('pointercancel', up);
  be.addEventListener('contextmenu', e => e.preventDefault());
  $('#btn-pause').onclick = () => { if (state === 'playing') pause(true); };
}
// the stacked building: click the upper slab for the 1st floor, the lower one for the ground floor
const stackCv = $('#h-stack');
let stackInfo = { split: 62 };
stackCv.onclick = e => { if (state === 'playing') game.lookAt(e.offsetY < stackInfo.split ? 1 : 0); };
$('#t-next').onclick = () => step(3);
$('#t-back2').onclick = () => step(1);
$('#t-back3').onclick = () => step(2);
$('#mute').onclick = () => { audio.init(); $('#mute').textContent = audio.toggleMute() ? '🔇' : '🔊'; };
$('#p-resume').onclick = () => pause(false);
$('#p-quit').onclick = () => attract();
// quitting a game in progress: asked first (the day is paused meanwhile), so that a stray click doesn't end it
$('#h-quit').onclick = () => { if (state === 'playing') { state = 'paused'; keys.clear(); show('quitask'); } };
$('#q-no').onclick = () => pause(false);
$('#q-yes').onclick = () => attract();
$('#p-restart').onclick = () => begin();
$('#w-new').onclick = () => begin(0);
$('#w-again').onclick = () => begin(DAYS.length - 1);
$('#w-menu').onclick = () => attract();
$('#r-log').onclick = () => playlog && savePlaylog();
$('#r-lines').onclick = saveLines;
$('#p-lines').onclick = saveLines;
requestAnimationFrame(frame);

// debug/testing handles
window.__game = () => game;
window.__r = renderer;
// step the real input + sim path without requestAnimationFrame (tests, hidden tabs)
window.__step = (n = 1) => { for (let i = 0; i < n && state === 'playing'; i++) { readInput(); game.update(STEP, input); } if (state === 'playing') hud(); renderer.draw(game, performance.now() / 1000, {}); return state; };
