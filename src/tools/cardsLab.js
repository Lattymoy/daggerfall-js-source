// THE CARD TABLE LAB (CARDS3, bible/11-Multiplayer/Tavern-Cards.md section 3). A tavern table with no tavern: the
// tavern's own card table (world/card/cardTableProp.js - AUDIT TAVERN-TABLE L6: the lab drew a box of its own) on a plain
// floor, its seats stood by world/card/cardTables.js, a seeded evening of the table
// (systems/card/cardTableSession.js - the player checking and calling, the patrons by their tempers) played to a pinned
// clock, and the cards and chips drawn by render/cardTableDraw.js through the game's own renderer, with the table's
// panel (ui/card/cardTableHud.js) over it. No game data: the felt and the floor are flat colours, the cards our own paint.
//     cards.html?t=<seconds>&cam=seat|over&seed=<n>&patrons=<n>&nohud     (tools/cardsProbe.mjs pins them)
//     &gold - the tavern's gold table (TAVERN-TABLES, section 30: its red felt)
// CARDS3c: `&squeeze=<0..1>` the front held card squeezed (world/card/cardHand.js squeezeMatrix); `&game=iliac` the cloth an
// Iliac Hand game lays at its last turn instead (world/iliacCloth.js, render/iliacTableDraw.js); `&bench=<frames>` times
// that many frames with the cards and without, into `__cardsBench` (tools/cardsPhoneProbe.mjs - the frame cost); `&chips=0`
// the cards with no chips.
// AUDIT CARDS-6 E15: `&split` - the bench also times each part alone (the held hand; the cloth's cards; the chips; the
// cloth's cards and chips, no hand), `&reps=<n>` the runs alternated (3), medians kept: section 34's "the cost is the
// HELD HAND" was a claim no run of the probe could make, so the probe now reports the parts. The bench's counts are
// what the frame drew (`&chips=0` drew none - its row said 40). AUDIT CARDS-6 E21: the held hand laid as the host lays
// it - at the frame's fit (world/card/cardHand.js heldFit) and, with the panel up, lifted clear of it (heldLift).
// CARDS-PLUS (section 38): the panels wear the Enhanced Plus kit by role, and on the enhanced skin the game's HUD has laid
// the Plus sheet before a table is sat at - the lab lays it as the HUD does (`&skin=classic` the panel lays its own cut
// of the kit); with `&game=iliac` the panel over the cloth is Iliac Hand's own, at that last turn.
// KG4 (bible/11-Multiplayer/Kings-Gambit.md section 17): `&game=gambit` - THE KING'S GAMBIT'S TABLE: a game against a
// regular dealt from `seed` and played `steps` of the law's steps (both sides the innkeeper's play - the player's at the
// tier's own), each `gap` ms apart, its pieces' motion (world/gambitMotion.js) fed the law's events, drawn by
// render/gambitTableDraw.js at `dt` ms after the last step (`dt=-1`: the muster, mid-throw); `&chair=end` the host at the
// table's end (the default; `&chair=long` a long side's); `&cam=lean` the lean (world/gambitCloth.js gambitLean) fitted to the screen the panel leaves clear (the
// panel ui/gambitTableHud.js over it; `&nohud` none); `&select=<n>` a piece chosen; `&phase=army` the army's screen.
import { Renderer } from '../render/renderer.js';
import { perspective, lookAt, mirrorProjectionX } from '../world/mat4.js';
import { cardTableSeats, tableFrame } from '../world/card/cardTables.js';
import { tablePlaces, CardScene } from '../world/card/cardScene.js';
import { CardTableSession } from '../systems/card/cardTableSession.js';
import { createCardTableDraw } from '../render/cardTableDraw.js';
import { createCardTableHud, cardHudModel, eventLine } from '../ui/card/cardTableHud.js';
import { INTERIOR_AMBIENT, INTERIOR_LIGHT_DIR } from '../world/interior/interiorLights.js';
import { cardTablePropModel, paintFelt, paintWood, CARD_TABLE_BOX, CARD_TABLE_ARCHIVE, FELT_RECORD, WOOD_RECORD, GOLD_FELT_RECORD, GOLD_FELT_RGB } from '../world/card/cardTableProp.js';   // AUDIT TAVERN-TABLE L6: the game's table
import { heldMatrices, squeezeMatrix, heldFit, heldLift } from '../world/card/cardHand.js';   // CARDS3b: the player's two held before the eye, as the host draws them; CARDS3c: squeezed; AUDIT CARDS-6 E21: fitted and lifted
import { CARD_W, CARD_L } from '../world/card/cardMotion.js';
import { projectToScreen } from '../player/tapRay.js';
import { newGame, commit as iliacCommit, reveal as iliacReveal, iliacView, ILIAC_TURNS } from '../net/iliac/iliacHand.js';   // CARDS10: an Iliac game's cloth, for the frame's cost
import { STARTER_DECK } from '../net/iliac/iliacCards.js';
import { patronPlays } from '../systems/iliac/iliacPatrons.js';
import { iliacPlaces, iliacPoses } from '../world/iliacCloth.js';
import { createIliacTableDraw } from '../render/iliacTableDraw.js';
import { createIliacTableHud, iliacHudModel } from '../ui/iliacTableHud.js';   // CARDS-PLUS: Iliac Hand's panel over its cloth
import { injectEnhancedStyle } from '../ui/enhanced/enhancedStyle.js';
import { dealRegular, regularStep, GAMBIT_TIERS } from '../systems/gambit/gambitPatrons.js';   // KG4: The King's Gambit's table
import { finishTurn, autoFill, KG_POINT_BUDGET } from '../net/kingsGambit.js';
import { gambitPlaces, gambitLean } from '../world/gambitCloth.js';
import { createGambitMotion } from '../world/gambitMotion.js';
import { createGambitTableDraw } from '../render/gambitTableDraw.js';
import { createGambitTableHud, gambitHudModel } from '../ui/gambitTableHud.js';
import { gambitClear } from '../scenes/gambitTableGame.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';

const params = new URLSearchParams(location.search);
const T = Number(params.get('t') ?? 14);
const camKind = params.get('cam') ?? 'seat';
const seed = Number(params.get('seed') ?? 4) >>> 0;
const patronCount = Math.max(1, Math.min(5, Number(params.get('patrons') ?? 3)));
const felt = params.has('gold') ? GOLD_FELT_RECORD : FELT_RECORD;   // TAVERN-TABLES: the gold table's red

const canvas = document.getElementById('c');
canvas.width = window.innerWidth; canvas.height = window.innerHeight;
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
const renderer = new Renderer(canvas);

/** A flat colour as a 4x4 color32. */
const flat = (r, g, b) => ({ width: 4, height: 4, colors: new Uint8ClampedArray(Array.from({ length: 16 }, () => [r, g, b, 255]).flat()) });
renderer.uploadTexture(CARD_TABLE_ARCHIVE, felt, paintFelt(params.has('gold') ? GOLD_FELT_RGB : undefined), { mips: true, opaque: true });   // the table's own, as the interior uploads them
renderer.uploadTexture(CARD_TABLE_ARCHIVE, WOOD_RECORD, paintWood(), { mips: true, opaque: true });
renderer.uploadTexture('cardslab', 'floor', flat(70, 56, 44));

/** A box from `min` to `max` on one texture: `top` its top face's texture, the rest `side`. */
function boxModel(min, max, top, side) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const faces = [
    [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], top],
    [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0], side],
    [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], side],
    [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0], side],
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], side],
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], side],
  ];
  const positions = [], normals = [], uvs = [], indices = [], subMeshes = [];
  for (const tex of [top, side]) {
    const start = indices.length;
    for (const f of faces) {
      if (f[5] !== tex) continue;
      const base = positions.length / 3;
      for (let i = 0; i < 4; i++) { positions.push(...f[i]); normals.push(...f[4]); uvs.push(i === 1 || i === 2 ? 1 : 0, i >= 2 ? 1 : 0); }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    subMeshes.push({ textureArchive: 'cardslab', textureRecord: tex, startIndex: start, primitiveCount: (indices.length - start) / 3 });
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint32Array(indices), subMeshes };
}

// The table: the tavern's own, its stools and all, on a floor - its seats round the table's own box.
const table = { aabb: CARD_TABLE_BOX, box: CARD_TABLE_BOX };
const tableMesh = renderer.createMesh(cardTablePropModel({ felt }));
const floorMesh = renderer.createMesh(boxModel([-6, -0.02, -6], [6, 0, 6], 'floor', 'floor'));
const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

const seats = cardTableSeats(table, () => true);
const frame = tableFrame(table);
const seatOf = Array.from({ length: patronCount + 1 }, (_, i) => i);
const places = tablePlaces(frame, seats, seatOf);
let x = seed || 1;
const rand32 = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; };
const names = ['Ana Vell', 'Bors Thane', 'Cael Dunmore', 'Dun Arbek', 'Eira Moss'].slice(0, patronCount);
const session = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: names.map((n, i) => ({ id: `patron:${i}`, name: n, temper: ['loose', 'tight', 'bluffer'][i % 3], stack: 400 + 100 * i })), stakes: { sb: 5, bb: 10 }, rand32, now: 0 });
const scene = new CardScene({ places, playerSeat: 0, tableSeed: seed });
const draw = createCardTableDraw(renderer);
const log = [];
const holeOf = (seat, k) => { const v = session.view(); const i = v.handSeats.indexOf(seat); return v.hand && i >= 0 && v.hand.seats[i].hole ? v.hand.seats[i].hole[k] : -1; };
// Play the evening to the pinned clock, 50 ms a step, the player checking and calling.
for (let now = 0; now <= T * 1000; now += 50) {
  session.tick(now);
  const l = session.legal();
  if (l) session.playerAct(l.check ? { type: 'check' } : { type: 'call' }, now);
  for (const e of session.drain()) { scene.onEvent(e, holeOf); const line = eventLine(e, session.seats.map((s) => s.name), session.playerSeat); if (line) log.push(line); }
  scene.poses(now / 1000, session.view());
}

if (isEnhancedPlus()) injectEnhancedStyle();   // CARDS-PLUS: the Plus sheet, as the game's enhanced HUD lays it
const hud = params.has('nohud') || params.get('game') === 'iliac' || params.get('game') === 'gambit' ? null : createCardTableHud({ onPress: () => {} });
hud?.render(cardHudModel({ phase: 'playing', view: session.view(), legal: session.legal(), stakes: { sb: 5, bb: 10 }, log }));
/** AUDIT CARDS-6 E21: the lift that keeps the held hand clear of the panel, read as worldModes cardHeldLift reads it - the
 *  plates' lowest corner over the panel's width against its top. */
function panelLift(mats, proj, view, fit) {
  const box = hud?.root?.getBoundingClientRect?.();
  if (!box || !(box.height > 0)) return 0;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  let bottom = -Infinity;
  for (const m of mats) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * CARD_W / 2, z = sz * CARD_L / 2;
    const s = projectToScreen([m[0] * x + m[8] * z + m[12], m[1] * x + m[9] * z + m[13], m[2] * x + m[10] * z + m[14]], w, h, proj, view, null);
    if (s.front && s.x >= box.left && s.x <= box.right) bottom = Math.max(bottom, s.y);
  }
  return Number.isFinite(bottom) ? heldLift(bottom, box.top, h, proj, fit) : 0;
}
/** AUDIT CARDS-6 E15: which of the cards a bench run draws ('all', or one part alone), and what the last frame drew. */
let parts = 'all';
const drew = { plates: 0, chips: 0 };

/** AUDIT CARDS-2 M10: the frame read back - what the probe can check of the picture itself. */
const readFrame = () => { const px = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };

function frameDraw(withCards = true, asBacks = false) {
  const aspect = canvas.width / canvas.height;
  const proj = mirrorProjectionX(perspective((60 * Math.PI) / 180, aspect, 0.02, 100));
  const s = seats[0];
  // 'near': straight down over the player's own cards and the board's head, close; 'over': the whole table; 'seat': his eye
  const near = places.seats[0].holes[0];
  const eye = camKind === 'over' ? [frame.centre[0] + 0.9, 2.2, frame.centre[2] + 1.4] : camKind === 'near' ? [near[0] - 0.12, 1.15, near[2] + 0.001] : camKind === 'board' ? [frame.centre[0], 1.35, frame.centre[2] + 0.001] : s.eye;
  const at = camKind === 'near' ? [near[0] - 0.12, 0.8, near[2]] : camKind === 'board' ? [frame.centre[0], 0.8, frame.centre[2]] : [frame.centre[0], frame.centre[1], frame.centre[2]];
  let view = lookAt(eye, at, camKind === 'near' ? [-1, 0, 0] : camKind === 'board' ? [0, 0, -1] : [0, 1, 0]);   // 'near' reads as the sitter does: the cards' tops away from him
  if (gambit && camKind === 'lean') { const L = gambitLean(gambit.places, { aspect, fovY: (60 * Math.PI) / 180, clear: gambitLabClear() }); view = lookAt(L.eye, [L.eye[0] + L.fwd[0], L.eye[1] + L.fwd[1], L.eye[2] + L.fwd[2]], [0, 1, 0]); gambit.eye = L.eye; gambit.lean = L; }
  else if (gambit && camKind === 'close') {   // KG4: a close look at the cards standing - from the host's side, low
    const P = gambit.places, c = String(params.get('at') ?? '7,9').split(',').map(Number), o = P.at(c[0], c[1]);
    const e = [o[0] + P.toHost[0] * 0.16, P.top + 0.09, o[2] + P.toHost[1] * 0.16];
    view = lookAt(e, [o[0], P.top + 0.02, o[2]], [0, 1, 0]); gambit.eye = e;
  } else if (gambit) gambit.eye = camKind === 'seat' ? (gambit.seatEye ?? eye) : eye;
  renderer.setLighting(new Float32Array([0.42, 0.40, 0.36]), 0.9, new Float32Array([1, 0.95, 0.85]));
  renderer.setFog('exp2', 0.0001, 0, 0, [0, 0, 0, 1]);
  renderer.setClearColor([0.05, 0.04, 0.03, 1]);
  renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR);
  renderer.drawMesh(floorMesh, IDENT, null);
  renderer.drawMesh(tableMesh, IDENT, null);
  const p = scene.poses(T, session.view());
  // CARDS3b: from the seat, the player's settled two held up (`peek` 0..1 from the page's query), as worldModes cardDrawGame
  let hand = [];
  if (camKind === 'seat') {
    const held = p.cards.filter((c) => c.seat === 0 && c.settled && Math.cos(c.roll) > 0.5).sort((a, b) => (a.id < b.id ? -1 : 1));
    const peek = Number(params.get('peek') ?? 0), fit = heldFit(aspect);   // AUDIT CARDS-6 E21: as worldModes cardDrawGame
    let mats = heldMatrices(view, held.length, peek, 0, fit);
    const lift = panelLift(mats, proj, view, fit);
    if (lift > 1e-4) mats = heldMatrices(view, held.length, peek, lift, fit);
    if (params.has('squeeze') && mats.length > 1) mats[0] = squeezeMatrix(mats[0], Number(params.get('squeeze')));   // CARDS3c: as worldModes cardDrawGame
    hand = held.map((c, i) => ({ card: c.card, matrix: mats[i] }));
    p.cards = p.cards.filter((c) => !held.includes(c));
  }
  if (params.get('chips') === '0') p.chips = [];   // CARDS3c: the plates alone (the bench's split of the cost)
  // AUDIT CARDS-6 E15: a bench run's part alone - the held hand, the cloth's cards, the chips, or the cloth's cards and chips
  if (parts === 'held') { p.cards = []; p.chips = []; }
  if (parts === 'clothcards') { p.chips = []; hand = []; }
  if (parts === 'chips') { p.cards = []; hand = []; }
  if (parts === 'cloth') hand = [];
  p.cards = [...p.cards, ...hand];
  if (withCards && gambit) gambit.draw.draw({ places: gambit.places, look: gambit.look, crowns: [3, 0], poses: gambit.poses, eye: gambit.eye, now: gambit.now });   // KG4: The King's Gambit's board
  else if (withCards && iliac) iliac.draw.draw(iliac.poses);   // CARDS10: the Iliac cloth in the Hold'em one's place
  else if (withCards) draw.draw(asBacks ? { ...p, cards: p.cards.map((c) => ({ ...c, card: -1 })) } : p);
  if (withCards) { drew.plates = gambit ? gambit.poses.pieces.length : iliac ? iliac.cards : p.cards.length; drew.chips = iliac || gambit ? 0 : p.chips.length; }
}
// CARDS10: `game=iliac` - an Iliac Hand game between two tempers played to its last turn on the relay's rules, its cloth
// laid from the player's chair (seat 0) against the one across (seat 2)
const iliac = params.get('game') === 'iliac' ? (() => {
  const st = newGame({ decks: [[...STARTER_DECK], [...STARTER_DECK]], rand32 });
  let u = seed || 1;
  const unit = () => { u = (u * 1664525 + 1013904223) >>> 0; return u / 4294967296; };
  for (let turn = 1; turn < ILIAC_TURNS; turn++) {
    for (const pl of [0, 1]) iliacCommit(st, pl, patronPlays(st, pl, pl ? 'loose' : 'tight', 1, unit));
    iliacReveal(st);
  }
  const v = iliacView(st, 0);
  const at = iliacPlaces(frame, seats[0].feet, seats[2].feet, 0);
  return { view: v, draw: createIliacTableDraw(renderer), poses: iliacPoses(v, at, T, new Map()), cards: v.holdings.reduce((n, hd) => n + 1 + hd.sides[0].length + hd.sides[1].length, 0) };
})() : null;
// CARDS-PLUS: the Iliac game's own panel over its cloth (the Hold'em one stood there)
if (iliac && !params.has('nohud')) createIliacTableHud({ onPress: () => {} }).render(iliacHudModel({ phase: 'playing', view: { ...iliac.view, names: ['You', names[1] ?? 'A regular'] } }));

// KG4: `game=gambit` - The King's Gambit against a regular, played on the law, its motion fed, its panel over it
const gambit = params.get('game') === 'gambit' ? (() => {
  let gx = seed || 1;
  const grand = () => { gx ^= gx << 13; gx >>>= 0; gx ^= gx >>> 17; gx ^= gx << 5; return gx >>>= 0; };
  const tier = GAMBIT_TIERS[1];
  const state0 = dealRegular({ army: autoFill([], KG_POINT_BUDGET, grand), tier, rand32: grand });
  const along = (/** @type {any} */ st) => Math.abs((st.feet[0] - frame.centre[0]) * Math.sin(frame.axisYaw) + (st.feet[2] - frame.centre[2]) * Math.cos(frame.axisYaw));
  const chair = (params.get('chair') === 'long' ? seats.find((st) => along(st) < 0.6) : seats.find((st) => along(st) > 0.6)) ?? seats[0];
  const places = gambitPlaces(frame, chair.feet);
  const motion = createGambitMotion();
  motion.lay(places.end);
  const gap = Number(params.get('gap') ?? 900), steps = Math.max(0, Number(params.get('steps') ?? 16));
  let state = state0, now = 1000;
  motion.feed([{ t: 'game', at: now }], now, state);
  now += 3000;   // the muster thrown
  for (let k = 0; k < steps && state && !state.over; k++) {
    const out = state.ending ? finishTurn(state, grand) : regularStep(state, state.turn, tier, grand, grand);
    if (!out || 'refused' in out) break;
    state = out.state;
    now += gap;
    motion.feed(out.events.map((e) => ({ ...e, at: now })), now, state);
  }
  const dtq = Number(params.get('dt') ?? 400);
  const at = dtq < 0 ? 1000 + 300 : now + dtq;
  const select = params.has('select') ? state.pieces[Number(params.get('select'))]?.id ?? null : null;
  const look = { layout: state.layout, tiles: state.tiles, hazards: state.hazards, pieces: state.pieces.map((p) => ({ id: p.id, side: p.side, col: p.col, row: p.row, king: p.king, unit: p.unit })), selected: select, lit: [], range: [], targets: [], cursor: null, staged: null };
  return { state, places, motion, look, now: at, poses: motion.poses(state, at), draw: createGambitTableDraw(renderer), eye: null, seatEye: chair.eye, lean: null };
})() : null;
const gambitHud = gambit && !params.has('nohud') ? createGambitTableHud({ onPress: () => {} }) : null;
gambitHud?.render(gambitHudModel({
  phase: params.get('phase') === 'army' ? 'army' : 'battle', regulars: [{ name: names[0], seed: 7, chair: 1, tier: GAMBIT_TIERS[1], nightLeft: 750, forFun: false }], regular: 0, friendly: false, purse: 900, stakeMult: 1, crown: 'daggerfall',
  army: [], pressed: null, said: null,
  game: gambit ? { state: gambit.state, crowns: ['daggerfall', 'wayrest'], name: names[0], stake: 50, over: null, dealt: [0, 1].map((sd) => gambit.state.pieces.filter((p) => p.side === sd).length), nightSpent: false } : null,
  selected: gambit?.look.selected ?? null, staged: null, info: null, why: null, armed: null, guideOpen: false, wordsOpen: false, armiesOpen: false, log: [], touch: window.matchMedia('(pointer: coarse)').matches, more: false,
}));
/** KG4: the screen the panel leaves the board (scenes/gambitTableGame.js gambitClear - the host's own). */
function gambitLabClear() {
  const box = gambitHud?.root?.getBoundingClientRect?.() ?? null;
  return gambitClear(box, { w: canvas.clientWidth, h: canvas.clientHeight }, window.matchMedia('(pointer: coarse)').matches);
}

// The table alone, its cards drawn every one as a back, then as dealt: the pixels the cards and chips change, and the
// pixels a FACE paints (the dealt frame against the all-backs one) - a frame that culls or loses the faces has none of
// those, and the probe fails it
const differ = (a, b, i) => Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) >= 24;
frameDraw(false);
const bare = readFrame();
frameDraw(true, true);
const backs = readFrame();
frameDraw(true);
const shown = readFrame();
let cardPixels = 0, facePixels = 0;
for (let i = 0; i < shown.length; i += 4) { if (differ(shown, bare, i)) cardPixels++; if (differ(shown, backs, i)) facePixels++; }
const poses = scene.poses(T, session.view());
// CARDS3c/CARDS10: THE FRAME'S COST - `bench` frames of the room with its cards and as many without, alternated three
// times and the middle run of each kept (the pipeline drained by a one-pixel read before and after each run): what the
// cards add to a frame, on this page's GL
if (params.has('bench')) {
  const n = Math.max(10, Math.min(600, Number(params.get('bench')) || 120));
  const reps = Math.max(3, Math.min(15, Number(params.get('reps')) || 3));   // AUDIT CARDS-6 E15
  const drain = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  const run = (part) => { parts = part; frameDraw(part !== 'none'); drain(); const t0 = performance.now(); for (let i = 0; i < n; i++) frameDraw(part !== 'none'); drain(); return (performance.now() - t0) / n; };
  // AUDIT CARDS-6 E15: with `split` (from the seat, Hold'em), each part alone too - all alternated, medians kept
  const kinds = params.has('split') && camKind === 'seat' && !iliac ? ['none', 'all', 'held', 'clothcards', 'chips', 'cloth'] : ['none', 'all'];
  const runs = Object.fromEntries(kinds.map((k) => [k, []]));
  for (let r = 0; r < reps; r++) for (const k of kinds) runs[k].push(run(k));
  parts = 'all';
  frameDraw(true);   // what the cards drew, counted (AUDIT CARDS-6 E15: `&chips=0` drew none)
  const med = (x) => x.slice().sort((a, b) => a - b)[Math.floor(x.length / 2)];
  const m = Object.fromEntries(kinds.map((k) => [k, med(runs[k])]));
  const split = kinds.length > 2 ? Object.fromEntries(kinds.filter((k) => k !== 'none').map((k) => [k, m[k] - m.none])) : null;
  window.__cardsBench = { frames: n, reps, width: canvas.width, height: canvas.height, game: gambit ? 'gambit' : iliac ? 'iliac' : 'holdem', plates: drew.plates, chips: drew.chips, bareMs: m.none, cardsMs: m.all, costMs: m.all - m.none, split };
}
/** KG4: what the probe reads of the board - its corners on the screen, the cell's size there - fitted again to the panel
 *  as it stands now (the game fits the lean every frame; the probe calls this once the page's fonts have laid the panel). */
function gambitMeasure() {
  frameDraw(true);
  const aspect = canvas.width / canvas.height;
  const proj = mirrorProjectionX(perspective((60 * Math.PI) / 180, aspect, 0.02, 100));
  const e = gambit.eye ?? seats[0].eye, f = gambit.lean?.fwd ?? [frame.centre[0] - e[0], frame.centre[1] - e[1], frame.centre[2] - e[2]];
  const view = lookAt(e, [e[0] + f[0], e[1] + f[1], e[2] + f[2]], [0, 1, 0]);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const corners = gambit.places.corners.map((c) => projectToScreen(c, w, h, proj, view, null));
  const a = projectToScreen(gambit.places.at(7, 6), w, h, proj, view, null), b = projectToScreen(gambit.places.at(8, 6), w, h, proj, view, null);
  window.__gambitState = { corners, cellPx: Math.hypot(a.x - b.x, a.y - b.y), panel: gambitHud?.root?.getBoundingClientRect?.() ?? null, clear: gambitLabClear(), pieces: gambit.poses.pieces.length, hazards: gambit.state.hazards.length, layout: gambit.state.layout, end: gambit.places.end };
  return window.__gambitState;
}
if (gambit) { gambitMeasure(); window.__gambitRelean = gambitMeasure; }
window.__cardsReady = true;
window.__cardsState = { street: session.view().hand?.street ?? null, cards: poses.cards.length, faceUp: poses.cards.filter((c) => Math.cos(c.roll) > 0.5).length, chips: poses.chips.length, cardPixels, facePixels, log: log.slice(-4), ambient: INTERIOR_AMBIENT };
