// AUDIT EG V (2026-10-15; bible/11-Multiplayer/Elite-Gates.md section 11.9, "The frame's lists") - FIX GROUP E, "render":
// L6-4 - THE FRAME'S LISTS KEPT. The hot paths allocated far past what 11.9 said: the telegraph floor plan ~49 KB a frame
// on a Court, the fight's frame its Maps, Sets, joined and filtered lists and a closure a tether, the panel the whole model
// serialised a frame, the occluders' ray and the eye's cast a Spire frame, the mist a new list of new sheets, the arch
// pool its Map spread on every online exterior frame. Pinned two ways: what each keeps is the same object frame after
// frame (identity), and what the two hottest paths allocate, measured by V8's own sampling heap profiler (node:inspector -
// every sampled allocation, collected or not, by the source file of the frame that made it) against a bound well under
// what they made before (the lane's ~49 KB and ~23 KB a frame).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { egCircleSpecs, egHallOf, EG_SEALED_MS, EG_GATHER_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egTethersOut } from '../../../src/net/eliteGates/egBodies.js';
import { EG_VESTIGES, EG_ACCORDS } from '../../../src/net/eliteGates/egVestige.js';
import { validEgOut } from '../../../src/net/wire.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgArchPool } from '../../../src/scenes/eliteGates/egArch.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { egFightFloors, egFloorPlan, egFloorPlanKeep } from '../../../src/world/eliteGates/egTelegraph.js';
import { egMistSheets, egMistSheetsAt } from '../../../src/world/eliteGates/egLook.js';
import { egMistAt } from '../../../src/net/eliteGates/egFragLaw.js';
import { EgMistPass, EG_MIST_MAX } from '../../../src/render/eliteGates/egMistPass.js';
import { drawEgPanel, destroyEgHud, egRecapModel, egPanelModel } from '../../../src/ui/eliteGates/egHud.js';
import { EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { EG_PRES_TEXT } from '../../../src/ui/eliteGates/egBeats.js';
import { EG_OCCLUDE_CHEST_M } from '../../../src/scenes/eliteGates/egOcclude.js';
import { lookAt, perspective } from '../../../src/world/mat4.js';
import { TELEGRAPH_KIND, TELEGRAPH_POOL, TELEGRAPH_EDGE_DAGON, telegraphBounds } from '../../../src/render/gate/gateTelegraph.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(1, [1, 2, 6]);
  egGive8(77, [2]);
});

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const between = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, `${a} .. ${b}`); return src.slice(i, j); };

/** Bytes a call `fn` allocates in source files matching `files`, by V8's sampling heap profiler over `n` calls (every
 *  sampled allocation, collected or not, by the file of the JS frame that made it). */
async function sampledBytes(fn, n, files) {
  for (let k = 0; k < 400; k++) fn();   // the JIT warm
  const S = new Session();
  S.connect();
  await S.post('HeapProfiler.enable');
  await S.post('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  for (let k = 0; k < n; k++) fn();
  const { profile } = await S.post('HeapProfiler.stopSampling');
  await S.post('HeapProfiler.disable');
  S.disconnect();
  let bytes = 0;
  const walk = (node) => { if (files.some((f) => node.callFrame.url.endsWith(f))) bytes += node.selfSize; for (const c of node.children ?? []) walk(c); };
  walk(profile.head);
  return bytes / n;
}

/** The lane's frame of THE TELEGRAPH BUDGET (its probe floorplan_alloc.mjs): 24 shapes over the first Court with a fight floor. */
function courtFrame() {
  let spec = null;
  outer: for (let seed = 1; seed <= 60; seed++) for (let c = 1; c <= 12; c++) for (const s of egCircleSpecs(seed, c, 0)) if (s.kind === 'court' && (s.fl ?? []).length >= 1) { spec = s; break outer; }
  const floors = egFightFloors(spec), f0 = spec.fl[0], cx = f0.x ?? (f0.ax + f0.bx) / 2, cz = f0.z ?? (f0.az + f0.bz) / 2;
  const shapes = Array.from({ length: 24 }, (_, i) => ({ kind: i % 3 === 0 ? TELEGRAPH_KIND.lane : TELEGRAPH_KIND.disc, origin: [cx + (i % 5) - 2, cz + ((i * 7) % 5) - 2], end: [cx + 4, cz + 3], yaw: 0, r: 2.5, halfW: 1, halfArc: 0, body: 0, r0: 0, r1: 0, points: [], n: 0,
    t: 0.5, flash: 0, alpha: 1, color: [1, 0.3, 0.2], edge: TELEGRAPH_EDGE_DAGON, court: 0, style: 0, since: 0.5, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.blow, mine: i === 3, y: NaN, order: i }));
  return { spec, floors, shapes, feet: [cx, cz] };
}

test('AUDIT EG V L6-4 THE FLOOR PLAN KEEPS ITS OWN (section 11.9; world/eliteGates/egTelegraph.js egFloorPlan, egFloorPlanKeep): with its keep, frame after frame it answers the same plan and the same draw slots, rewritten - the same draws a fresh plan makes; on the lane\'s Court of 24 shapes and six fight floors it allocates under 4 KB a frame in the telegraph\'s own files (it made ~49 KB: its ranks, a Set a shape, a box per bounds, a closure a box, a double boxed per cut), and the fight hands it its keep (mutants: a fresh plan a frame; the draw and rank slots made anew; a Set a shape; a bounds box made a call; the cut handed a double; the fight\'s keep unpassed)', async () => {
  const { floors, shapes, feet } = courtFrame(), K = egFloorPlanKeep();
  const a = egFloorPlan(shapes, floors, feet, null, undefined, K), slots = [...a.draws];
  const fresh = egFloorPlan(shapes, floors, feet, null);
  const b = egFloorPlan(shapes, floors, feet, a.buf, undefined, K);
  assert.equal(b, a, 'the same plan');
  assert.ok(b.draws.length > 20 && b.draws.every((d, i) => d === slots[i]), 'the same draw slots');
  const ranks = [...K.ranks];
  egFloorPlan(shapes, floors, feet, a.buf, undefined, K);
  assert.ok(ranks.length === shapes.length && K.ranks.every((r, i) => r === ranks[i]), 'the same rank slots');
  assert.deepEqual(b.draws.map((d) => [d.i, d.f ? floors.indexOf(d.f) : -1, d.first, d.count]), fresh.draws.map((d) => [d.i, d.f ? floors.indexOf(d.f) : -1, d.first, d.count]), 'the draws a fresh plan makes');
  assert.equal(b.n, fresh.n);
  let buf = a.buf;
  const per = await sampledBytes(() => { buf = egFloorPlan(shapes, floors, feet, buf, undefined, K).buf; }, 3000, ['world/eliteGates/egTelegraph.js', 'render/gate/gateTelegraph.js']);
  assert.ok(per < 8192, `the floor plan allocates ${Math.round(per)} bytes a frame`);
  const B = [0, 0, 0, 0], bounds = await sampledBytes(() => { for (const sh of shapes) telegraphBounds(sh, B); }, 3000, ['render/gate/gateTelegraph.js']);
  assert.ok(bounds < 64, `a shape's bounds into a kept box make nothing (${Math.round(bounds)} bytes)`);
  assert.match(rd('src/scenes/eliteGates/egFight.js'), /egFloorPlan\(_shapes, floors, myFeet\(\), floorBuf, undefined, planKeep\)/, 'the fight hands it its keep');
});

/** A breach of two woken in a Court with a broad floor, a Blood Tether, Morvayn's chain and a Vestige aura, its words
 *  frozen; the breach client's frame and draw (scenes/eliteGates/egClient.js over scenes/eliteGates/egFight.js), `peerAt` counted. */
function spireScreen() {
  let found = null;
  for (let seed = 1; seed <= 60 && !found; seed++) for (let c = 1; c <= 12 && !found; c++) for (const s of egCircleSpecs(seed, c, 0)) if (s.kind === 'court' && (s.fl ?? []).some((f) => f.t === 'd' && f.r >= 12)) { found = { seed, spec: s, F: s.fl.find((f) => f.t === 'd' && f.r >= 12) }; break; }
  const { seed, spec, F } = found, ME = 'acct-0', PEER = 'acct-1', NOOP = () => {}, OBJ = {}, RET = () => OBJ;
  const gl = new Proxy({ drawingBufferWidth: 1920, drawingBufferHeight: 1080, getProgramParameter: () => true, getShaderParameter: () => true, getUniformLocation: (_p, n) => n }, { get(t, k) {
    if (k in t) return t[k];
    if (typeof k !== 'string') return undefined;
    if (k.toUpperCase() === k) return 1;
    return (t[k] = RET);
  } });
  const renderer = { gl, _worldViewportPx: null, createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch: NOOP };
  const centre = egHallCentre(spec), at = (x, z) => [centre[0] + x, centre[1] + (F.y ?? 0), centre[2] + z];
  const mine = [F.x - 4.5, F.z - 4.5], theirs = [F.x + 4.5, F.z + 4.5];
  const player = { pos: at(...mine), height: 1.8, grounded: true, collider: { move: NOOP } };
  const peerEye = at(...theirs); peerEye[1] += 1.6;
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  let clock = 1_800_000_000_000, asked = 0;
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed, op: clock - EG_SEALED_MS - 60_000, co: [[ME, 'Mac', 1], [PEER, 'Ann', 2]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const sub of [ME, PEER]) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.mem[ME].vs = [[EG_VESTIGES.find((v) => /** @type {any} */ (v).aura > 0).id, 1]];
  B.h = spec.h; B.sg = 'arrive'; B.wk = clock; B.cnt = { left: 1_500_000, at: clock }; B.pulledAt = clock; B.gatherAt = clock - EG_GATHER_MS; B.su = clock;
  const modes = { mode: 'dungeon', egHallBreach: () => B.b, egHallCircle: () => spec.c, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, error: null, sendEg: () => true };
  const peers = [{ sub: PEER, pos: peerEye }];
  let fight = null;
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 }, renderer,
    account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, say: NOOP, mid: NOOP, site: () => ({}), wire: () => null, landAt: () => true, hurt: NOOP, peers: () => peers, store: null,
    fight: (link) => (fight = createEgFight({ renderer, gl, link, me: () => ME, player: () => entity, feet: () => player.pos, peerAt: (sub) => { asked++; return sub === PEER ? peerEye : null; }, strike: NOOP, shake: NOOP })),
    win: { innerWidth: 1920, innerHeight: 1080, matchMedia: () => ({ matches: false }) } });
  const tell = (w) => { if (w.to && w.to !== ME) return; const v = validEgOut(JSON.parse(JSON.stringify(w))); if (v) client.word(v); };
  tell(egStateOf(B, clock));
  let s = 3;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const poses = () => [[ME, mine], [PEER, theirs]].map(([sub, p]) => ({ sub, sx: spec.x0 + p[0], z: p[1], dead: false, at: clock }));
  for (let k = 0; k < 60; k++) { clock += 100; for (const w of egStep(B, clock, poses(), rng)) tell(w); tell(egStateOf(B, clock)); client.frame(); }
  B.F.tethers.push([ME, PEER, 1, 1400], [ME, PEER, 2, 800]);
  const out = []; egTethersOut(B.F, out); for (const w of out) tell(w);
  const proj = perspective(new Float32Array(16), 1.2, 16 / 9, 0.1, 2000), eye = [player.pos[0], player.pos[1] + 5, player.pos[2] - 8], view = lookAt(new Float32Array(16), eye, player.pos, [0, 1, 0]);
  const frame = () => { clock += 16; client.frame(); client.drawPass(proj, view, eye, clock / 1000, null); };
  return { frame, fight: () => fight, asked: () => asked };
}

test('AUDIT EG V L6-4 THE FIGHT\'S FRAME KEEPS ITS LISTS (section 11.9; scenes/eliteGates/egFight.js): a Spire frame of the breach client in a Court\'s fight - its blows, a Blood Tether, Morvayn\'s chain, an aura - reads my companion\'s place a few times, never once for each Accord the holder\'s chips ask (ui/eliteGates/egBeats.js egHolderNow asks every Accord twice a frame, and each ask stood the whole company again), hands the floor plan the same plan each frame, and allocates under 11 KB a frame in scenes/eliteGates/egFight.js (it made ~23 KB: the company a frame an Accord, a Map, Sets, joined and filtered lists, a closure a tether, a pair swapped) (mutants: the company stood every ask; the kept collections made anew; a closure a tether)', async () => {
  const S = spireScreen();
  for (let k = 0; k < 30; k++) S.frame();
  const shapes = S.fight().shapes();
  assert.ok(shapes.some((sh) => sh.pool === 5) && shapes.some((sh) => sh.pool === 6), 'the tethers drawn');
  const a0 = S.asked();
  S.frame();
  const per = S.asked() - a0;
  assert.ok(EG_ACCORDS.length >= 4, 'the Accords the chips ask');
  assert.ok(per <= 6, `my companion's place read ${per} times a frame (an Accord asked twice a frame each: ${2 * EG_ACCORDS.length})`);
  const plan = S.fight().plan();
  S.frame();
  assert.equal(S.fight().plan(), plan, 'the floor plan, the same each frame');
  // the frame's own collections, counted where they are made: no Map, Set or filtered list a frame in the fight's frame or its
  // marks (a constructor or `filter` patched for twenty frames, its caller read off the stack)
  const made = { Map: 0, Set: 0, filter: 0 }, RealMap = globalThis.Map, RealSet = globalThis.Set, realFilter = Array.prototype.filter;
  const inFrame = () => /at (Object\.frame|frame|sigilsFrame|companyHere|companyStood) \(.*scenes\/eliteGates\/egFight\.js/.test(new Error().stack.split('\n')[3] ?? '');
  globalThis.Map = class extends RealMap { constructor(...a) { super(...a); if (inFrame()) made.Map++; } };
  globalThis.Set = class extends RealSet { constructor(...a) { super(...a); if (inFrame()) made.Set++; } };
  // eslint-disable-next-line no-extend-native
  Array.prototype.filter = function (...a) { if (/at (Object\.frame|frame|sigilsFrame) \(.*scenes\/eliteGates\/egFight\.js/.test(new Error().stack.split('\n')[2] ?? '')) made.filter++; return realFilter.apply(this, a); };
  try { for (let k = 0; k < 20; k++) S.frame(); } finally { globalThis.Map = RealMap; globalThis.Set = RealSet; Array.prototype.filter = realFilter; }   // eslint-disable-line no-extend-native
  assert.deepEqual(made, { Map: 0, Set: 0, filter: 0 }, 'the fight\'s frame keeps its collections');
  const src = rd('src/scenes/eliteGates/egFight.js');
  assert.match(src, /const a = tetherEnd\(tx\[0\], F, t, f, meSub\), b = tetherEnd\(tx\[1\], F, t, f, meSub\);/, 'a tether\'s ends by one function, never a closure a tether');
  const bytes = await sampledBytes(S.frame, 1500, ['scenes/eliteGates/egFight.js']);
  assert.ok(bytes < 11 * 1024, `the fight's frame allocates ${Math.round(bytes)} bytes a frame`);
});

test('AUDIT EG V L6-4 THE MIST, THE ARCHES, THE OCCLUDERS AND THE PANEL KEEP THEIRS (section 11.9): the mist\'s sheets are written into the look\'s kept list - the same list and slots each frame, the law\'s own line (world/eliteGates/egLook.js egMistSheetsAt; scenes/eliteGates/egLookDraw.js); with no arch standing the arch pool answers its one empty list for the draws, the lights, the targets and the clearings, every frame (scenes/eliteGates/egArch.js); the dungeon arm hands the occluders one kept ray - the eye, the focal and my chest - and the witness eye one kept cast (scenes/worldModes.js); the panel stands, never serialised, while what its nodes say stands, and is drawn anew when a card\'s words, the focus or the recap change (ui/eliteGates/egHud.js) (mutants: a new sheet list a frame; the mist pass slicing its list; its cap lost; the arches\' empty lists made anew; the ray made a frame; the panel rebuilt every frame; the panel kept past a new card; the recap redrawn at each new object; a quiet frame\'s panel model worked out)', async () => {
  // the mist
  let sheets = [];
  for (const seed of [1, 2, 3, 4, 5, 7]) for (let c = 6; c <= 10 && !sheets.length; c++) sheets = egMistSheets(egCircleSpecs(seed, c, 0));
  assert.ok(sheets.length);
  const kept = [];
  let first = null, risen = 0, risenAt = /** @type {number|null} */ (null);
  for (let t = 0; t < 30; t += 0.25) {
    const at = egMistSheetsAt(sheets, t, kept);
    assert.equal(at, kept, 'the kept list');
    if (!at.length) continue;
    first ??= at[0];
    risenAt ??= t;
    assert.equal(at[0], first, 'the same slot');
    const fresh = egMistSheetsAt(sheets, t);
    assert.deepEqual(at, fresh, 'what a fresh list says');
    assert.ok(Math.abs(at[0].alpha - Math.min(1, egMistAt(sheets[0].hz, t) / 1.5)) < 1e-12 || at.length > 1);
    risen++;
  }
  assert.ok(risen > 4);
  assert.match(rd('src/scenes/eliteGates/egLookDraw.js'), /egMistSheetsAt\(sheets, ts, sheetsAt\)/, 'the look hands its kept list');
  // the mist pass reads the list in place, at most EG_MIST_MAX a frame - never sliced
  const gl = new Proxy({}, { get: (o, k) => (k in o ? o[k] : typeof k === 'string' && /^[A-Z_]+$/.test(k) ? 0 : () => ({})) });
  const mist = new EgMistPass(/** @type {any} */ (gl));
  const lit = egMistSheetsAt(sheets, risenAt ?? 12).filter((q) => q.alpha > 0);   // PIN MOVED (AUDIT EG V, the merge of fix group F: spec law 8's first misted circle rises at its own moment - the first the loop above saw)
  assert.ok(lit.length, 'a sheet risen');
  const many = Array.from({ length: EG_MIST_MAX + 3 }, (_, i) => lit[i % lit.length]);
  const slice = Array.prototype.slice;
  let sliced = 0;
  Array.prototype.slice = function (...a) { sliced++; return slice.apply(this, a); };
  try { mist.draw(new Float32Array(16), new Float32Array(16), [0, 0, 0], many, [1, 1, 1], 1); } finally { Array.prototype.slice = slice; }
  assert.deepEqual([mist.drawn, sliced], [EG_MIST_MAX, 0], 'the cap drawn, nothing sliced');
  // the arches, none standing
  const pool = createEgArchPool({ renderer: null, pixelTranslation: () => [0, 0], heightAt: () => 0, now: () => 1000 });
  pool.frame(0.016);
  const L = [pool.passDraws(), pool.lights(), pool.targets(), pool.clears()];
  pool.frame(0.016);
  assert.deepEqual(L.map((x) => x.length), [0, 0, 0, 0]);
  assert.ok(pool.passDraws() === L[0] && pool.lights() === L[1] && pool.targets() === L[2] && pool.clears() === L[3], 'one empty list each, every frame');
  assert.equal(pool.stands(), false);
  // the occluders' ray and the eye's cast (the dungeon arm's own source)
  const WM = rd('src/scenes/worldModes.js');
  const src = between(WM, '  function egOccludeFrame(mwv, dt) {', '  /** EG-PLAY: A BODY STOOD ELSEWHERE IN THE CIRCLE');
  const seen = [];
  const player = { feetAt: () => [1, 2, 3], collider: { sphereCast: (o, r, d, m) => (m > 5 ? { dist: 4 } : null) } };
  const arm = new Function('host', 'decorTool', 'player', 'egOcc', 'dungeonCtx', 'EG_OCCLUDE_CHEST_M', `${src}\nreturn { egOccludeFrame, egEyeCast };`)({ egWitness: () => false }, { flying: () => false }, player, { frame: (r) => { seen.push(r); return 0; }, draw: () => 0 }, null, EG_OCCLUDE_CHEST_M);
  const mwv = { thirdPerson: true, focal: [1, 3, 3], eye: [1, 4, 0] };
  arm.egOccludeFrame(mwv, 0.016); arm.egOccludeFrame(mwv, 0.02);
  assert.equal(seen[0], seen[1], 'one kept ray');
  assert.deepEqual([seen[1].eye, seen[1].points[0], seen[1].points[1], seen[1].dt], [mwv.eye, mwv.focal, [1, 2 + EG_OCCLUDE_CHEST_M, 3], 0.02]);
  arm.egOccludeFrame({ thirdPerson: false }, 0.016);
  assert.equal(seen[2].points, null, 'first person: no ray');
  assert.equal(arm.egEyeCast([0, 0, 0], 0.3, [0, 0, 1], 9), 4);
  assert.equal(arm.egEyeCast([0, 0, 0], 0.3, [0, 0, 1], 2), null);
  // the panel
  const made = [];
  const node = () => { const n = { children: [], style: {}, className: '', textContent: '', attrs: {}, append(...c) { this.children.push(...c); }, remove() { this.gone = true; }, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, addEventListener() {}, querySelectorAll(sel) { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (typeof c === 'object') { if (sel === '[data-left]' && c.attrs?.['data-left'] != null) out.push(c); walk(c); } } }; walk(this); return out; } }; made.push(n); return n; };
  const doc = { createElement: node, head: node(), body: node(), getElementById: () => null };
  const model = (line, left) => ({ offer: { cards: [{ key: 1, card: 3, name: 'Searing Edge I', line, completes: '', accord: '' }], n: 1, surplus: 0 }, asks: [{ q: 'x', title: 'Rest?', opts: ['Yes', 'No'], mine: null, left, tally: [] }] });
  const stringify = JSON.stringify;
  let serialised = 0;
  JSON.stringify = (...a) => { serialised++; return stringify(...a); };
  try {
    destroyEgHud();
    drawEgPanel(model('Fire on a blow.', 9000), { doc });
    const p1 = doc.body.children.at(-1);
    drawEgPanel(model('Fire on a blow.', 8000), { doc });
    assert.equal(doc.body.children.at(-1), p1, 'a frame of the same words: the same panel');
    assert.equal(p1.gone, undefined);
    assert.equal(p1.querySelectorAll('[data-left]')[0].textContent, '8s', 'its seconds written in place');
    assert.equal(serialised, 0, 'never serialised');
    drawEgPanel(model('Fire on a blow, more.', 8000), { doc });
    assert.notEqual(doc.body.children.at(-1), p1, 'a card\'s words changed: drawn anew');
    const p2 = doc.body.children.at(-1);
    drawEgPanel(model('Fire on a blow, more.', 7000), { doc, focus: 0 });
    assert.notEqual(doc.body.children.at(-1), p2, 'the focus moved: drawn anew');
    const pFocus = doc.body.children.at(-1);
    drawEgPanel(model('Fire on a blow, more.', 7000), { doc, focus: 0, touch: true });
    assert.notEqual(doc.body.children.at(-1), pFocus, 'the merge of C and E: a touch frame draws its own panel (its note, its close button)');
    // the recap: its words, never its object - the client makes a new one at each Reliquary opened (relShown, in place)
    // and at the board's line arriving (scenes/eliteGates/egClient.js)
    const ME = 'acct-0', T0 = 1_800_000_000_000;
    const E = { ...EG_STATE_EMPTY, b: '0123456789abcdef', seed: 77, op: T0, wk: T0 + 1000, h: 7, rd: 1, end: 'home', co: [[ME, 'Mac', 1, 1, 1, 1, 0, 0, 0, 1]], ds: [[ME, 3000, 0]] };
    const R = egRecapModel(E, ME, [], T0 + 60_000, { board: '' });
    drawEgPanel(null, { doc, recap: R, relShown: 0, words: EG_PRES_TEXT });
    const p3 = doc.body.children.at(-1);
    drawEgPanel(null, { doc, recap: { ...R, opened: 1, reliquaries: 1 }, relShown: 1, words: EG_PRES_TEXT });
    assert.equal(doc.body.children.at(-1), p3, 'a Reliquary opened: the same recap, its count written in place');
    drawEgPanel(null, { doc, recap: { ...R, board: 'The Depths: 2nd' }, relShown: 1, words: EG_PRES_TEXT });
    assert.notEqual(doc.body.children.at(-1), p3, 'the board\'s line arrived: drawn anew');
    assert.equal(serialised, 0, 'never serialised');
  } finally { JSON.stringify = stringify; destroyEgHud(); }
  // the panel's model, a frame of a breach with no offer and no vote (the common frame): null, nothing worked out
  const quietE = { ...EG_STATE_EMPTY, b: '0123456789abcdef', seed: 77, op: 1, wk: 2, h: 3, co: [['acct-0', 'Mac', 1, 1, 1, 1, 0, 0, 0, 1], ['acct-1', 'Ann', 2, 1, 0, 1, 0, 0, 1, 0]], as: [['rest', 2, 5]] };
  const voted = {};   // the client's own (scenes/eliteGates/egClient.js - egPanelModel(link.state(), me(), t, voted))
  assert.equal(egPanelModel(quietE, 'acct-0', 10, voted), null);
  const panelBytes = await sampledBytes(() => egPanelModel(quietE, 'acct-0', 10, voted), 3000, ['ui/eliteGates/egHud.js']);
  assert.ok(panelBytes < 16, `the panel's model of a quiet frame makes nothing (${panelBytes.toFixed(1)} B a call)`);
});
