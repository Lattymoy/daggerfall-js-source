// EG-ZE (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7, 16.2, 16.4, 16.5,
// 27.3 and 27.5): THE STAIR, THE DOOR AND THE LIGHTS. The law (world/eliteGates/egLights.js): each step's look - the full fall into a
// band's first hall, the veil elsewhere, the cut under reduced motion - with its band, its hall and the band's chime, on a
// clock never slower than the veil it replaced; the door's beam and the closing's ring through the closing, the door on
// the compass; the Redoubt's beacon from 1.5 s into its sequence, flaring as a recall lands, and the recall's blue pillar;
// the pings' pillars and glyphs from the floor their pinger stood on; the witness's sight - the dormant Lurkers, the
// alcoves, the next hall's twist - every state folded from the relay's own words through the wire. The screen: the
// veil's three stair themes (ui/gate/gateVeil.js) at the stair's pace with the band's chime and the hall held centred; the
// stair's shader (render/eliteGates/egStairPass.js) and the lights' (render/eliteGates/egLightPass.js) evaluated through test/glsl.mjs; the
// lights' pass and the look's seam (scenes/eliteGates/egLookDraw.js) over a recording GL; and the breach client (scenes/eliteGates/egClient.js)
// played - the pull, the swap and the step in under the stair, the compass's door, a ping's chime and its pillar drawn,
// the witness's ping and sight.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from '../../glsl.mjs';
import {
  egStairStep, egStairChime, egStairLabel, egSpireLights, egFloorUnder, egDoorCompass, egWitnessTwist,
  EG_STAIR_VEIL, EG_STAIR_THEME, EG_LIGHT_KIND, EG_GLYPH, EG_LIGHT_BLUE, EG_DOOR_BEAM, EG_CLOSING_RING, EG_BEACON, EG_RECALL_PILLAR, EG_PING, EG_SIGHT, EG_LIGHTS_MAX, EG_LIGHTS_TEXT, EG_FLOOR_NEAR_UP,
} from '../../../src/world/eliteGates/egLights.js';
import { EG_STAIR_FS, EG_STAIR_MODE, EG_STAIR_LOOK, egStairFallen } from '../../../src/render/eliteGates/egStairPass.js';
import { EG_LIGHT_FS, EG_LIGHT_FLOATS, EG_RING_SIDES, EG_LIGHT_VERTS_MAX, EgLightPass, egLightVertices } from '../../../src/render/eliteGates/egLightPass.js';
import { createGateVeil, VEIL_THEMES, VEIL_EG_MODE, VEIL_EG_SCALE, VEIL_EG_HOLD_S, VEIL_EG_CUES, VEIL_OPEN_WAIT_TICKS } from '../../../src/ui/gate/gateVeil.js';
import { VEIL_CLOSE_S, VEIL_OPEN_S } from '../../../src/render/gate/gateVeil.js';
import { createEgLookDraw } from '../../../src/scenes/eliteGates/egLookDraw.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { EG_STAIR, EG_SKIES, EG_FOG_FLOOR, egStairOf } from '../../../src/world/eliteGates/egLook.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { egHallOf, egStartHall, egBandOfHall, EG_BRINK_HALLS, EG_DOOR_REACH_M, EG_SEALED_MS, EG_TWIST_LINES } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStateOf, egStageWord, egWord, EG_RD_RECALL_MS } from '../../../src/net/eliteGates/egBrain.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { EG_ROLE, EG_FL } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND } from '../../../src/net/eliteGates/egLegion.js';
import { validEgOut } from '../../../src/net/wire.js';
import { realmToDungeon, dungeonToRealm } from '../../../src/net/superDungeon/sdBrain.js';
import { EG_DANGER_PALETTES } from '../../../src/ui/eliteGates/egAccess.js';
import { EG_BEAT_SOUNDS } from '../../../src/ui/eliteGates/egBeats.js';
import { EG_SCORE_BAND_MOTIFS } from '../../../src/systems/eliteGates/egScore.js';
import { midiNote } from '../../../src/systems/gate/gateScore.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(77, [1, 2, 6]);
  egGive8(2, [1]);
  egGive8(1, [2, 5]);
});

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const ME = 'acct-0';
const B = '0123456789abcdef';
const json = (w) => JSON.parse(JSON.stringify(w));
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

/** A breach as the relay keeps one (net/eliteGates/egBrain.js), its company Mac and Ann, standing at hall `h` in stage `sg`. */
function breach({ h = 2, sg = 'trial', seed = 77, clock = T0 + EG_SEALED_MS + 60_000 } = {}) {
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const Br = egBreachNew({ b: B, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  Br.h = h; Br.sg = sg; Br.wk = clock - 1000; Br.cnt = { left: 1_500_000, at: clock - 1000 }; Br.sa = clock - 1000; Br.su = clock + 20_000;
  return Br;
}
/** The client's state from the relay's own words, each through the wire's projection (net/wire.js validEgOut) and the
 *  link's fold (net/eliteGates/egLink.js foldEg) - the shape the producer mints, never a literal. */
function heard(words, now) {
  let s = EG_STATE_EMPTY;
  for (const w of words) { const v = validEgOut(json(w)); assert.ok(v, `the wire refuses ${w.k}`); s = foldEg(s, v, now); }
  return s;
}

test('EG-ZE THE STAIR\'S LAW (section 7): the full fall into a band\'s first hall and each Brink, the veil at every other step, the cut under reduced motion - each the veil\'s theme, the band it falls into, the hall held centred and the band\'s chime on its motif\'s first note; the same circle built again never falls; the stair\'s clock the dither 0.8 s each way and the fall\'s least hold, never slower than the Hour\'s veil it replaced (mutants: the fall every hall; the chime off its band; the hold past the Hour\'s veil; the rebuild falling)', () => {
  for (const h of [1, ...EG_BRINK_HALLS]) assert.deepEqual([egStairStep(h).kind, egStairStep(h).look], ['fall', 'egFall'], `hall ${h}: the full fall`);
  for (const h of [2, 5, 6, 27, 50, 77]) assert.deepEqual([egStairStep(h).kind, egStairStep(h).look], ['veil', 'egVeil'], `hall ${h}: the veil`);
  for (const h of [1, 2, 26]) assert.deepEqual([egStairStep(h, true).kind, egStairStep(h, true).look], ['cut', 'egCut'], `hall ${h}: reduced motion cuts`);
  assert.deepEqual([egStairStep(26, false, true).kind, egStairStep(26, true, true).kind], ['veil', 'cut'], 'the circle standing built again: never the fall');
  for (const h of [1, 2, 26, 51, 77, 140]) assert.equal(egStairStep(h).kind, egStairOf(h), 'egStairOf is the law');
  assert.deepEqual(EG_STAIR_THEME, { fall: 'egFall', veil: 'egVeil', cut: 'egCut' });
  assert.ok(Object.values(EG_STAIR_THEME).every((t) => VEIL_THEMES[t] > 5), 'each a veil theme of its own');
  // the band, the hall held, the chime
  for (const h of [1, 25, 26, 50, 51, 76, 200]) {
    const s = egStairStep(h);
    assert.equal(s.opts.band, egBandOfHall(h), `hall ${h} falls into its band`);
    assert.equal(s.opts.label, `Hall ${h}`);
    assert.equal(s.opts.chime, egStairChime(egBandOfHall(h)));
  }
  assert.equal(egStairLabel(13), 'Hall 13');
  const pitch = (n) => 0.7 * 2 ** ((midiNote(n) - midiNote('C5')) / 12);
  assert.deepEqual([0, 1, 2, 3].map(egStairChime), EG_SCORE_BAND_MOTIFS.map((m) => Math.max(0.3, pitch(m[0][0]))), 'each band\'s motif\'s first note');
  assert.ok(near(egStairChime(0), pitch('E4')) && near(egStairChime(1), pitch('B4')) && near(egStairChime(2), pitch('E5')), 'the Galleries\' E, the Cairn\'s B, the Shade\'s high E');
  assert.equal(egStairChime(3), 0.3, 'the Wellhead\'s low E held at the floor');
  // the stair into the breach's own first hall: Hall 1 and a Brink start fall, a start at Redoubt 1 veils
  assert.equal(egStairStep(egStartHall(0)).kind, 'fall');
  assert.equal(egStairStep(egStartHall(5)).kind, 'fall', 'Redoubt 5\'s start falls into the Soul Cairn');
  assert.equal(egStairStep(egStartHall(1)).kind, 'veil');
  // the clock: the dither each way, never slower than the Hour's veil it replaced
  assert.deepEqual([EG_STAIR_VEIL.close, EG_STAIR_VEIL.open], [EG_STAIR.dither, EG_STAIR.dither]);
  assert.equal(EG_STAIR.dither, 0.8);
  assert.ok(EG_STAIR_VEIL.close + EG_STAIR_VEIL.fallHold + EG_STAIR_VEIL.open < VEIL_CLOSE_S + VEIL_OPEN_S, 'the fall itself inside the veil it replaced');
  assert.ok(EG_STAIR_VEIL.close < VEIL_CLOSE_S, 'the swap\'s close sooner than the Hour\'s');
  assert.ok(EG_STAIR_VEIL.fallHold >= 1, 'long enough to see the underside fall away');
});

/** A page with a canvas, a label's node, a frame clock and a recording GL - the veil's whole world. */
function stairPage({ noStair = false, reduce = false } = {}) {
  const calls = [], sources = new Map(), attached = new Map(), nodes = [];
  const failed = (sh) => noStair && sources.get(sh)?.includes('stairScene');   // EG-ZO (PIN MOVED): the stair's own text - the picture's underside is gone
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, COLOR_BUFFER_BIT: 5, VERTEX_SHADER: 6, FRAGMENT_SHADER: 7 }, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k !== 'string') return undefined;
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'shaderSource') sources.set(a[0], a[1]);
        if (k === 'attachShader') { if (!attached.has(a[0])) attached.set(a[0], []); attached.get(a[0]).push(a[1]); }
        if (k === 'getShaderParameter') return !failed(a[0]);
        if (k === 'getProgramParameter') return !(attached.get(a[0]) ?? []).some(failed);
        if (k === 'getUniformLocation') return a[1];
        return {};
      };
    },
  });
  const canvas = { style: {}, width: 0, height: 0, setAttribute() {}, remove() {}, getContext: () => gl };
  const doc = {
    body: { appendChild: (n) => { if (n !== canvas) nodes.push(n); } },
    createElement: (tag) => (tag === 'canvas' ? canvas : { tag, style: {}, textContent: '', attrs: {}, removed: false, setAttribute(k, v) { this.attrs[k] = v; }, remove() { this.removed = true; } }),
  };
  let frames = [], t = 1000;
  const sounds = [];
  const engine = { soundIndexForId: () => -1, playOneShot: (...a) => sounds.push(a) };
  const step = (ms = 16) => { t += ms; const f = frames; frames = []; for (const g of f) g(); };
  const win = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, matchMedia: (q) => ({ matches: reduce && /reduced-motion/.test(q) }) };
  const u = (name) => calls.filter((c) => /^uniform[12][fi]$/.test(c[0]) && c[1] === name).map((c) => c.slice(2));
  return { doc, raf: (f) => frames.push(f), now: () => t, engine, win, calls, sounds, step, canvas, u, nodes, label: () => nodes[0] ?? null, ms: () => t };
}

test('EG-ZE THE STAIR ON THE VEIL (ui/gate/gateVeil.js): the Spire\'s three themes draw the stair\'s own pass at a third of the pixels, pixelated, in the band it falls into; the veil closes in the stair\'s 0.8 s (the Hour\'s takes 1.2) with the band\'s chime, holds the hall centred while the step lands and opens in 0.8 s; the fall adds the deep wind and holds shut its least however soon the step lands; a pull\'s flash is shut at once on the chime with the hall at full; a stair that will not build has the fire stand in; destroyed, the hall\'s node goes (mutants: the fire\'s clock kept; no chime; the hall never held; the fall\'s hold dropped; the label left standing)', async () => {
  assert.deepEqual(Object.keys(VEIL_EG_MODE).map(Number), [VEIL_THEMES.egFall, VEIL_THEMES.egVeil, VEIL_THEMES.egCut]);
  assert.deepEqual(Object.values(VEIL_EG_MODE), [EG_STAIR_MODE.fall, EG_STAIR_MODE.veil, EG_STAIR_MODE.cut]);
  assert.deepEqual(VEIL_EG_HOLD_S, { [EG_STAIR_MODE.fall]: EG_STAIR_VEIL.fallHold, [EG_STAIR_MODE.veil]: 0, [EG_STAIR_MODE.cut]: 0 });
  // the veil: 0.8 s in, the band's chime, the hall held
  const p = stairPage(), veil = createGateVeil(p), s = egStairStep(52);
  let shut = null;
  veil.cover(s.look, s.opts).then((ok) => { shut = ok; });
  assert.deepEqual(p.sounds, [[VEIL_EG_CUES.chime.clip, VEIL_EG_CUES.chime.volume, egStairChime(2)]], 'the Shade\'s chime as it closes');
  const t0 = p.ms();
  while (veil.phase === 'closing' && p.ms() - t0 < 3000) p.step();
  const took = (p.ms() - t0) / 1000;
  assert.ok(took >= EG_STAIR_VEIL.close - 0.02 && took <= EG_STAIR_VEIL.close + 0.04, `shut in the stair's ${EG_STAIR_VEIL.close} s (${took.toFixed(3)} s)`);
  assert.ok(took < VEIL_CLOSE_S - 0.3, 'sooner than the fire\'s clock');
  assert.deepEqual(p.u('uMode').at(-1), [EG_STAIR_MODE.veil]);
  assert.deepEqual(p.u('uBand').at(-1), [2], 'the band it falls into');
  assert.deepEqual(p.u('uCover').at(-1), [1], 'all of it taken');
  assert.equal(p.canvas.width, Math.round(1280 * VEIL_EG_SCALE));
  assert.equal(p.canvas.style.imageRendering, 'pixelated');
  const L = p.label();
  assert.ok(L, 'the hall\'s node made');
  assert.equal(L.textContent, 'Hall 52');
  assert.deepEqual([L.style.display, L.style.opacity], ['block', '1.00'], 'held centred, whole');
  assert.equal(L.attrs['aria-hidden'], 'true');
  // opens in 0.8 s once the step has landed and drawn
  veil.frameDrawn(); veil.reveal();
  for (let i = 0; i < VEIL_OPEN_WAIT_TICKS + 1; i++) { veil.frameDrawn(); p.step(); }
  assert.equal(veil.phase, 'opening');
  const o0 = p.ms();
  while (veil.phase === 'opening' && p.ms() - o0 < 3000) { veil.frameDrawn(); p.step(); }
  const opened = (p.ms() - o0) / 1000;
  assert.ok(opened <= EG_STAIR_VEIL.open + 0.05 && opened >= EG_STAIR_VEIL.open - 0.1, `open in ${EG_STAIR_VEIL.open} s (${opened.toFixed(3)})`);
  assert.equal(veil.phase, 'idle');
  assert.equal(L.style.display, 'none', 'the hall goes with the veil');
  await null;
  assert.equal(shut, true, 'the step went on once it shut');
  // asked to close again while it opens, it closes from where it stands, at the stair's pace (the fire's law at 0.8 s)
  const r = stairPage(), again = createGateVeil(r), rs = egStairStep(9);
  again.cover(rs.look, rs.opts);
  while (again.phase === 'closing') r.step();
  again.frameDrawn(); again.reveal();
  while (again.phase === 'shut') { again.frameDrawn(); r.step(); }
  const r0 = r.ms();
  while (r.ms() - r0 < 400) { again.frameDrawn(); r.step(); }
  again.cover(rs.look, rs.opts);
  const r1 = r.ms();
  while (again.phase === 'closing' && r.ms() - r1 < 3000) r.step();
  const back = (r.ms() - r1) / 1000;
  assert.ok(back > 0.44 && back < 0.56, `half open, shut again in ${back.toFixed(3)} s`);
  // the fall: the deep wind under the chime, and shut its least however soon the step lands
  const f = stairPage(), fall = createGateVeil(f), fs = egStairStep(26);
  fall.cover(fs.look, fs.opts);
  assert.deepEqual(f.sounds, [[VEIL_EG_CUES.chime.clip, VEIL_EG_CUES.chime.volume, egStairChime(1)], [VEIL_EG_CUES.fall.clip, VEIL_EG_CUES.fall.volume, VEIL_EG_CUES.fall.pitch]]);
  while (fall.phase === 'closing') f.step();
  const shutAt = f.ms();
  fall.frameDrawn(); fall.reveal();
  while (fall.phase === 'shut' && f.ms() - shutAt < 5000) { fall.frameDrawn(); f.step(); }
  const held = (f.ms() - shutAt) / 1000;
  assert.ok(held >= EG_STAIR_VEIL.fallHold && held < EG_STAIR_VEIL.fallHold + 0.1, `the fall held shut ${held.toFixed(3)} s`);
  assert.deepEqual(f.u('uMode').at(-1), [EG_STAIR_MODE.fall]);
  assert.ok(f.u('uTime').at(-1)[0] >= EG_STAIR_VEIL.close + EG_STAIR_VEIL.fallHold - 0.05, 'the fall\'s clock runs on through the hold');
  // the pull's flash: shut at once on the chime, the hall at full; the cut its own mode
  const q = stairPage(), pull = createGateVeil(q), ps = egStairStep(3, true);
  pull.flash(ps.look, ps.opts);
  assert.equal(pull.phase, 'shut');
  assert.deepEqual(q.sounds, [[VEIL_EG_CUES.chime.clip, VEIL_EG_CUES.chime.volume, egStairChime(0)]], 'the veil\'s close is the chime');
  assert.deepEqual(q.u('uMode').at(-1), [EG_STAIR_MODE.cut]);
  assert.deepEqual([q.label().textContent, q.label().style.opacity], ['Hall 3', '1.00']);
  pull.destroy();
  assert.equal(q.label().removed, true, 'destroyed, the hall\'s node goes');
  // a stair that will not build: the fire stands in, no hall held
  const n = stairPage({ noStair: true }), nv = createGateVeil(n), w = console.warn;
  console.warn = () => {};
  try { nv.flash('egVeil', egStairStep(4).opts); } finally { console.warn = w; }
  assert.deepEqual(n.u('uTheme').at(-1), [VEIL_THEMES.egVeil], 'the fire\'s pass draws');
  assert.equal(n.u('uMode').length, 0);
  assert.equal(n.label(), null);
  // the fire's own step keeps the fire's clock
  const g = stairPage(), fire = createGateVeil(g);
  fire.cover('fire');
  const g0 = g.ms();
  while (fire.phase === 'closing' && g.ms() - g0 < 3000) g.step();
  assert.ok((g.ms() - g0) / 1000 >= VEIL_CLOSE_S - 0.02, 'the fire still takes its 1.2 s');
  assert.equal(g.label(), null, 'and holds no hall');
});

test('EG-ZE THE STAIR\'S SHADER (render/eliteGates/egStairPass.js, evaluated): the dither takes the screen pixel by pixel - none at nothing, all at the whole, exactly half a 4x4 at half; the fall\'s deep rising, its share the JS law\'s, the band\'s deep lit below (EG-ZO, PIN MOVED: the underside is a model now - test/world/eliteGates/egz_fall.test.js - and its picture here is gone); the veil\'s motes drift where the cut\'s stand still; each band its own void (mutants: the dither inverted; the cut moving)', () => {
  const f = glslFunctions(EG_STAIR_FS, { uRes: [427, 240], uTime: 0, uCover: 0, uMode: 0, uBand: 0, gl_FragCoord: [0, 0, 0, 1], o: [0, 0, 0, 0] });
  const at = (x, y, set) => { Object.assign(f.globals, set); f.globals.gl_FragCoord = [x + 0.5, y + 0.5, 0, 1]; f.main(); return [...f.globals.o]; };
  for (const [cover, want] of [[0, 0], [1, 16], [0.5, 8], [0.25, 4]]) {
    let shown = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const a = at(100 + x, 60 + y, { uCover: cover, uMode: EG_STAIR_MODE.veil })[3]; assert.ok(a === 0 || a === 1, 'all or nothing'); shown += a; }
    assert.equal(shown, want, `cover ${cover}: ${want} of 16`);
  }
  assert.deepEqual(at(5, 5, { uCover: 0 }), [0, 0, 0, 0], 'untaken: the world shows through');
  // THE FALL
  for (const t of [0, 0.4, 1, 2.5, 6]) assert.ok(near(f.fallen(t), egStairFallen(t), 1e-9), `the shader's share the law's at ${t} s`);
  const deep = f.stairScene([0.31, -0.95], 3, 0, EG_STAIR_MODE.fall), D = EG_SKIES[0].deep;
  assert.ok(deep[0] > deep[2] * 3 && deep[0] >= D[0] * 0.9, 'the fire-sea lit below');
  assert.ok(f.stairScene([0.31, -0.95], 3, 0, EG_STAIR_MODE.fall)[0] > f.stairScene([0.31, -0.95], 0, 0, EG_STAIR_MODE.fall)[0], 'rising to meet the faller');
  // the veil drifts, the cut stands still
  let moved = 0;
  for (let i = 0; i < 400; i++) {
    const pt = [((i * 37) % 200) / 100 - 1, ((i * 53) % 180) / 100 - 0.9];
    const c0 = f.stairScene(pt, 0, 0, EG_STAIR_MODE.cut), c1 = f.stairScene(pt, 2.3, 0, EG_STAIR_MODE.cut);
    assert.deepEqual(c0, c1, 'the cut still');
    if (f.stairScene(pt, 0, 0, EG_STAIR_MODE.veil).some((v, j) => !near(v, f.stairScene(pt, 2.3, 0, EG_STAIR_MODE.veil)[j]))) moved++;
  }
  assert.ok(moved > 0, 'the veil\'s motes drift');
  // each band its own void, dim
  const bottom = (b) => f.stairScene([0.2, -0.8], 0, b, EG_STAIR_MODE.cut);
  assert.ok(bottom(0)[0] > bottom(0)[2] * 4, 'the Galleries\' red');
  assert.ok(bottom(1)[2] >= bottom(1)[0], 'the Cairn\'s mist');
  assert.ok(Math.max(...bottom(2)) < 0.05, 'the Shade\'s dark');
  assert.ok(bottom(0)[0] <= EG_SKIES[0].deep[0] * EG_STAIR_LOOK.veilDim + 1e-9, 'dimmed to the veil');
});

test('EG-ZE THE DOOR (sections 7 and 27.3, world/eliteGates/egLights.js): through the closing a gold beam climbs over the END PLATE in the palette\'s safety and the closing\'s ring lies at the door\'s reach, its arc the closing\'s seconds left; the compass holds the door\'s place; under reduced motion the beam stands whole at once; no door before the closing, none for a witness on the compass, nothing outside the halls (mutants: the ring full the whole closing; the beam never climbing; the door on a witness\'s compass; the beam in the trial)', () => {
  const now = T0 + EG_SEALED_MS + 60_000;
  const Br = breach({ h: 1, sg: 'trial', clock: now });
  const spec = egHallOf(77, 1, 0), door = egToDungeon(spec, spec.end.x, spec.end.y ?? 0, spec.end.z);
  const trial = heard([egStateOf(Br, now)], now);
  assert.deepEqual(egSpireLights(trial, now), [], 'no door in the trial');
  assert.equal(egDoorCompass(trial), null);
  // the door opens: the relay's own stage word
  Br.sg = 'closing'; Br.sa = now; Br.su = now + 20_000;
  const E = heard([egStateOf(Br, now - 1), egStageWord(Br, now)], now);
  assert.equal(E.sg, 'closing');
  const at = (t, o = {}) => egSpireLights(E, t, o);
  const L0 = at(now), beam = L0.find((l) => l.k === EG_LIGHT_KIND.beam), ring = L0.find((l) => l.k === EG_LIGHT_KIND.ring);
  assert.deepEqual([beam.x, beam.y, beam.z], door, 'over the END PLATE');
  assert.equal(beam.h, 0, 'climbing from the plate');
  assert.ok(near(at(now + 300).find((l) => l.k === EG_LIGHT_KIND.beam).h, EG_DOOR_BEAM.h * (300 / 1000 / EG_DOOR_BEAM.rise)), 'half way at 0.3 s');
  assert.equal(at(now + 5000).find((l) => l.k === EG_LIGHT_KIND.beam).h, EG_DOOR_BEAM.h, 'whole');
  assert.equal(at(now, { still: true }).find((l) => l.k === EG_LIGHT_KIND.beam).h, EG_DOOR_BEAM.h, 'reduced motion: whole at once');
  assert.deepEqual([ring.r, ring.x, ring.z], [EG_DOOR_REACH_M, door[0], door[2]], 'at the door\'s reach - where `down` is heard');
  assert.ok(near(ring.y, door[1] + EG_CLOSING_RING.lift));
  assert.equal(ring.f, 1, 'the closing whole');
  assert.ok(near(at(now + 5000).find((l) => l.k === EG_LIGHT_KIND.ring).f, 0.75), 'a quarter spent at 5 s of 20');
  assert.equal(at(now + 25_000).find((l) => l.k === EG_LIGHT_KIND.ring).f, 0, 'spent');
  assert.deepEqual(beam.c, EG_DANGER_PALETTES.standard.safety, 'the way\'s gold');
  assert.deepEqual(at(now, { palette: EG_DANGER_PALETTES.contrast }).find((l) => l.k === EG_LIGHT_KIND.beam).c, EG_DANGER_PALETTES.contrast.safety, 'the palette\'s safety');
  // the compass
  assert.deepEqual(egDoorCompass(E), [door[0], door[2]]);
  assert.equal(egDoorCompass(E, true), null, 'a witness takes no door');
  assert.deepEqual(egSpireLights({ ...E, end: 'wipe' }, now), [], 'the end: nothing');
  assert.deepEqual(egSpireLights(EG_STATE_EMPTY, now), [], 'outside a breach: nothing');
});

test('EG-ZE THE REDOUBT\'S LIGHTS AND THE COMPANY\'S WORD (sections 16.2, 16.4, 16.5 and 27.5): the beacon climbs at the court\'s heart 1.5 s into the Redoubt\'s sequence (where the spoils leave from) and stands through the rest, flaring as a recall lands; the recall\'s blue pillar where the called-back rise, fading; a ping - the relay\'s own word for `lping` - a blue pillar 6 m tall with its kind\'s glyph from the floor its pinger stood on, gone after its seconds; every light the way\'s gold or Battlemage blue (mutants: the beacon at the word; the flare never lit; a ping\'s glyph not its kind; a ping standing for ever)', () => {
  const now = T0 + EG_SEALED_MS + 60_000;
  const Br = breach({ h: 5, sg: 'rest', clock: now });
  const spec = egHallOf(77, 5, 0), f = spec.fight ?? spec.end, heart = egToDungeon(spec, spec.ring.x, f.y ?? 0, spec.ring.z);
  const E = heard([egStateOf(Br, now), { k: 'rd', w: 1, h: 5, at: now, cl: 1_500_000, g: 900_000 }], now);
  assert.ok(E.redoubt && E.redoubt.at === now);
  const beam = (s, o = {}) => egSpireLights(s, now + o.t, o).find((l) => l.k === EG_LIGHT_KIND.beam) ?? null;
  assert.equal(beam(E, { t: 1400 }), null, 'not before 1.5 s');
  const b0 = beam(E, { t: EG_BEACON.at * 1000 });
  assert.deepEqual([b0.x, b0.y, b0.z], heart, 'at the court\'s heart');
  assert.equal(b0.h, 0, 'climbing');
  assert.equal(beam(E, { t: (EG_BEACON.at + EG_BEACON.climb) * 1000 + 50 }).h, EG_BEACON.h, 'whole');
  assert.equal(beam(E, { t: EG_BEACON.at * 1000 + 10, still: true }).h, EG_BEACON.h, 'reduced motion: whole');
  assert.ok(EG_BEACON.at * 1000 < EG_RD_RECALL_MS, 'the beacon before the recalls (the relay\'s sequence)');
  // the recall: the relay's rise word at 4.5 s - a blue pillar, the beacon flaring
  const tr = now + EG_RD_RECALL_MS;
  const R = heard([egStateOf(Br, now), { k: 'rd', w: 1, h: 5, at: now, cl: 1_500_000, g: 900_000 }, { k: 'rise', s: 'acct-1', p: 1, x: spec.fight.x, z: spec.fight.z, h: 5 }], tr);
  const lit = egSpireLights(R, tr + 100), pillar = lit.find((l) => l.k === EG_LIGHT_KIND.pillar), flare = lit.find((l) => l.k === EG_LIGHT_KIND.beam);
  assert.deepEqual(pillar.c, EG_LIGHT_BLUE, 'Battlemage blue');
  const rp = egToDungeon(spec, spec.fight.x, egFloorUnder(spec, spec.fight.x, spec.fight.z), spec.fight.z);
  assert.deepEqual([pillar.x, pillar.y, pillar.z], rp, 'where the called-back rise');
  assert.ok(near(pillar.h, EG_RECALL_PILLAR.h * (0.1 / EG_RECALL_PILLAR.rise)));
  assert.equal(flare.w, EG_BEACON.w * EG_BEACON.flareK, 'the beacon flares as the recall lands');
  assert.equal(flare.a, EG_BEACON.flareK);
  assert.equal(egSpireLights(R, tr + EG_BEACON.flare * 1000 + 50).find((l) => l.k === EG_LIGHT_KIND.beam).w, EG_BEACON.w, 'and settles');
  assert.ok(near(egSpireLights(R, tr + (EG_RECALL_PILLAR.s - 0.3) * 1000).find((l) => l.k === EG_LIGHT_KIND.pillar).a, 0.3 / EG_RECALL_PILLAR.fade), 'fading in its last moments');
  assert.equal(egSpireLights(R, tr + EG_RECALL_PILLAR.s * 1000).filter((l) => l.k === EG_LIGHT_KIND.pillar).length, 0, 'gone');
  assert.equal(egSpireLights({ ...R, sg: 'arrive' }, tr + 100).filter((l) => l.k === EG_LIGHT_KIND.beam).length, 0, 'the beacon only through the rest');
  assert.equal(egSpireLights({ ...R, sg: 'trial', redoubt: null }, tr + 100).filter((l) => l.k === EG_LIGHT_KIND.pillar).length, 1, 'a Memento\'s recall in a trial stands its pillar too');
  // a ping: the relay's own `eping` for Ann's `lping` (danger)
  const T = breach({ h: 2, sg: 'trial', clock: now }), s2 = egHallOf(77, 2, 0);
  const said = egWord(T, 'acct-1', { k: 'lping', x: 0, z: 30, w: 1 }, null, now, () => 0.5);
  const ping = said.find((w) => w.k === 'eping');
  assert.ok(ping && ping.wit === 0, 'the relay says it');
  const P = heard([egStateOf(T, now), ping], now);
  const pl = egSpireLights(P, now + 1000), col = pl.find((l) => l.k === EG_LIGHT_KIND.pillar), glyph = pl.find((l) => l.k === EG_LIGHT_KIND.glyph);
  const pp = egToDungeon(s2, 0, egFloorUnder(s2, 0, 30), 30);
  assert.deepEqual([col.x, col.y, col.z, col.h, col.w], [...pp, EG_PING.h, EG_PING.w], 'a blue pillar 6 m tall on its floor');
  assert.deepEqual([col.c, glyph.c], [EG_LIGHT_BLUE, EG_LIGHT_BLUE]);
  assert.equal(glyph.f, EG_GLYPH.danger, 'its glyph names its kind');
  assert.ok(near(glyph.y, pp[1] + EG_PING.h + EG_PING.glyph * 0.75), 'over the pillar');
  for (const [w, g] of [[0, EG_GLYPH.here], [2, EG_GLYPH.mine]]) assert.equal(egSpireLights(heard([egStateOf(T, now), { ...ping, w }], now), now + 10).find((l) => l.k === EG_LIGHT_KIND.glyph).f, g);
  assert.ok(near(egSpireLights(P, now + (EG_PING.s - 0.5) * 1000).find((l) => l.k === EG_LIGHT_KIND.pillar).a, 0.5 / EG_PING.fade), 'fading');
  assert.deepEqual(egSpireLights(P, now + EG_PING.s * 1000), [], 'gone after its seconds');
  assert.ok(near(egSpireLights(P, now + 100).find((l) => l.k === EG_LIGHT_KIND.pillar).h, EG_PING.h * (0.1 / EG_PING.rise)), 'rising');
  assert.equal(egSpireLights(P, now + 100, { still: true }).find((l) => l.k === EG_LIGHT_KIND.pillar).h, EG_PING.h, 'reduced motion: standing');
  // never a warning's colour
  for (const L of [...lit, ...pl]) assert.ok([EG_LIGHT_BLUE, EG_DANGER_PALETTES.standard.safety].includes(L.c), 'gold or blue');
  // at most EG_LIGHTS_MAX
  const many = { ...P, pings: Array.from({ length: 40 }, (_, i) => ({ s: 'acct-1', x: 0, z: i, w: 1, wit: 0, at: now })) };
  assert.equal(egSpireLights(many, now + 10).length, EG_LIGHTS_MAX);
});

test('EG-ZE THE FLOOR UNDER AND THE WITNESS\'S SIGHT (section 16.5): a ping stands on the floor its pinger stood on - the highest floor not over its own height, else the highest, else the arrival plate\'s; a witness sees a blue ring and an eye at each dormant Lurker\'s anchor and a ring and a diamond at each alcove, on its own floor, the living neither; the next hall\'s twist said, none past the Court\'s eve (mutants: the Low Road\'s ping on the High Road; the living seeing the Lurkers; the twist of the next circle)', () => {
  const spec = { arrive: { x: 0, y: 1.5, z: 0 }, discs: [{ x: 0, z: 10, r: 4, y: 0 }], bands: [{ x: 0, halfW: 2, z0: 5, z1: 15, y: 6 }], lanes: [{ ax: 10, az: 0, bx: 10, bz: 20, hw: 1, y: -3 }] };
  assert.equal(egFloorUnder(spec, 0, 10), 6, 'the highest');
  assert.equal(egFloorUnder(spec, 0, 10, 0.2), 0, 'the Low Road\'s own');
  assert.equal(egFloorUnder(spec, 0, 10, 6 - EG_FLOOR_NEAR_UP + 0.01), 6, 'a pinger a little under its floor still on it');
  assert.equal(egFloorUnder(spec, 0, 10, -5), 6, 'none under its height: the highest');
  assert.equal(egFloorUnder(spec, 10.5, 12), -3, 'a lane');
  assert.equal(egFloorUnder(spec, 30, 30), 1.5, 'over no floor: the plate\'s');
  // a real hall's stacked floors (seed 2, hall 4 - a bastion under the walkway): Ann's ping from the bastion stands on it
  {
    const now = T0 + EG_SEALED_MS + 60_000, Br = breach({ h: 4, sg: 'trial', seed: 2, clock: now }), s4 = egHallOf(2, 4, 0);
    const lo = s4.discs.find((d) => d.x === -8 && d.z === 40);
    assert.ok(lo && egFloorUnder(s4, -8, 40) > (lo.y ?? 0) + 1, 'two floors stand there');
    const ping = egWord(Br, 'acct-1', { k: 'lping', x: -8, z: 40, w: 0 }, null, now, () => 0.5).find((w) => w.k === 'eping');
    const E = heard([egStateOf(Br, now), ping], now);
    const col = (ys) => egSpireLights(E, now + 500, { ys }).find((l) => l.k === EG_LIGHT_KIND.pillar);
    assert.equal(col(new Map([['acct-1', (lo.y ?? 0) + 0.1]])).y, egToDungeon(s4, -8, lo.y ?? 0, 40)[1], 'on the bastion its pinger stood on');
    assert.equal(col(null).y, egToDungeon(s4, -8, egFloorUnder(s4, -8, 40), 40)[1], 'unknown: the highest');
  }
  // the witness's sight: a dormant Lurker and an alcove (seed 1, hall 7 cuts one)
  const now = T0 + EG_SEALED_MS + 60_000;
  const Br = breach({ h: 7, sg: 'trial', seed: 1, clock: now }), spec7 = egHallOf(1, 7, 0);
  assert.ok(spec7.alcoves.length > 0);
  const al = spec7.alcoves[0];
  const lurker = [9, EG_ROLE.add, EG_KIND.lurker, 0, 2, 40, 100, 100, EG_FL.dormant, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], awake = [10, EG_ROLE.add, EG_KIND.lurker, 0, -2, 40, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];   // PIN MOVED (EG-ZJ): a body's row is seventeen (its feet, its walk's end's height, its state and since when); PIN MOVED (EG-ZQ): eighteen, its size; PIN MOVED (AUDIT EG V, b: nineteen, its facing)
  const E = heard([egStateOf(Br, now), { k: 'efs', h: 7, wk: now, b: [lurker, awake], bl: [], tx: [], mk: [], pg: {} }], now);
  assert.equal(E.fight.bodies.length, 2);
  assert.deepEqual(egSpireLights(E, now), [], 'the living see neither');
  const W = egSpireLights(E, now, { witness: true });
  const rings = W.filter((l) => l.k === EG_LIGHT_KIND.ring), glyphs = W.filter((l) => l.k === EG_LIGHT_KIND.glyph);
  assert.equal(rings.length, 2, 'the dormant Lurker and the alcove - never the woken');
  const lp = egToDungeon(spec7, 2, egFloorUnder(spec7, 2, 40), 40), ap = egToDungeon(spec7, al.x, al.y, al.z);
  assert.deepEqual([rings[0].x, rings[0].z, rings[0].r], [lp[0], lp[2], EG_SIGHT.r]);
  assert.deepEqual([glyphs[0].f, glyphs[1].f], [EG_GLYPH.eye, EG_GLYPH.mine], 'an eye on the Lurker, a diamond on the alcove');
  assert.deepEqual([rings[1].x, rings[1].y, rings[1].z], [ap[0], ap[1] + EG_CLOSING_RING.lift, ap[2]], 'the alcove on its own floor');
  assert.ok(W.every((l) => l.c === EG_LIGHT_BLUE));
  // the next hall's twist (seed 1: hall 22 holds a captive)
  const T = heard([egStateOf(breach({ h: 21, seed: 1, clock: now }), now)], now);
  const want = EG_TWIST_LINES[egHallOf(1, 22, 0).twist];
  assert.ok(want);
  assert.equal(egWitnessTwist(T), want);
  assert.equal(EG_LIGHTS_TEXT.sight(want), `Beyond the door: ${want}`);
  const eve = heard([egStateOf(breach({ h: 5, seed: 1, clock: now }), now)], now);
  assert.equal(egWitnessTwist(eve), '', 'past the Court: the next circle\'s halls are not chosen');
  assert.equal(egWitnessTwist(EG_STATE_EMPTY), '');
});

/** A GL that records its calls and runs nothing; `progOf(needle)` the program a shader holding `needle` went into. */
function recordingGl() {
  const calls = [], src = new Map(), att = new Map();
  let id = 0;
  const T = { ARRAY_BUFFER: 1, STATIC_DRAW: 2, DYNAMIC_DRAW: 3, FLOAT: 4, TRIANGLES: 5, COLOR_BUFFER_BIT: 6, VERTEX_SHADER: 7, FRAGMENT_SHADER: 8, DEPTH_TEST: 9, BLEND: 10, CULL_FACE: 11, ONE: 12, ONE_MINUS_SRC_ALPHA: 13, ZERO: 14, LEQUAL: 15, LESS: 16, drawingBufferWidth: 1280, drawingBufferHeight: 720 };
  const gl = new Proxy(T, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k !== 'string') return undefined;
      return (...a) => {
        calls.push([k, ...a]);
        if (k.startsWith('create')) return { id: ++id };
        if (k === 'shaderSource') src.set(a[0], a[1]);
        if (k === 'attachShader') { if (!att.has(a[0])) att.set(a[0], []); att.get(a[0]).push(a[1]); }
        if (k === 'getProgramParameter' || k === 'getShaderParameter') return true;
        if (k === 'getUniformLocation') return a[1];
        return undefined;
      };
    },
  });
  const progOf = (needle) => [...att.entries()].find(([, shs]) => shs.some((sh) => src.get(sh)?.includes(needle)))?.[0] ?? null;
  /** the draws made while the program holding `needle` was bound */
  const drawsOf = (needle) => { const p = progOf(needle); let cur = null; const out = []; for (const c of calls) { if (c[0] === 'useProgram') cur = c[1]; if (c[0] === 'drawArrays' && cur === p && p) out.push(c); } return out; };
  return { gl, calls, progOf, drawsOf };
}

test('EG-ZE THE LIGHTS\' PASS (render/eliteGates/egLightPass.js): a beam or a pillar faces the eye about its upright axis, a ring lies on its radii in 32 sides with its lit arc on every vertex, a glyph faces the screen by the view\'s own axes, the buffer never overrun; the shader - a beam\'s core brightest and fading up, its ripple stilled under reduced motion, a ring lit to its arc and dim past it, each glyph its own shape, THE FOG FLOOR within 30 m and a beam kept hall-wide; drawn additively, depth-tested and unwritten, its state given back (mutants: the column edge-on to the eye; the ring\'s spent arc lit; the beam lost in the haze; the blend left on)', () => {
  const lights = [
    { k: EG_LIGHT_KIND.beam, x: 0, y: 1, z: 0, h: 10, w: 2, r: 0, c: [1, 0.8, 0.4], a: 1, f: 0 },
    { k: EG_LIGHT_KIND.ring, x: 5, y: 0, z: 5, h: 0, w: 0.2, r: 3, c: [1, 0.8, 0.4], a: 1, f: 0.25 },
    { k: EG_LIGHT_KIND.glyph, x: 0, y: 8, z: 0, h: 0, w: 1, r: 0, c: EG_LIGHT_BLUE, a: 0.5, f: EG_GLYPH.danger },
  ];
  const out = new Float32Array(EG_LIGHT_VERTS_MAX * EG_LIGHT_FLOATS);
  const n = egLightVertices(lights, [10, 1.6, 0], [0, 0, -1], [0, 1, 0], out);
  assert.equal(n, 6 + EG_RING_SIDES * 6 + 6);
  const V = (i) => [...out.subarray(i * EG_LIGHT_FLOATS, (i + 1) * EG_LIGHT_FLOATS)];
  // the beam: its side square to the eye's line (the eye along +x), its foot and its top
  const beam = [0, 1, 2, 3, 4, 5].map(V);
  for (const v of beam) assert.ok(near(v[0], 0, 1e-9), 'edge on to nothing - square to the eye');
  assert.deepEqual(beam.map((v) => [v[2], v[1]]), [[-1, 1], [1, 1], [1, 11], [-1, 1], [1, 11], [-1, 11]], 'its width across the eye\'s line, its height up from its foot');
  assert.deepEqual(beam.map((v) => [v[3], v[4], v[5]]), [[-1, 0, 0], [1, 0, 0], [1, 1, 0], [-1, 0, 0], [1, 1, 0], [-1, 1, 0]]);
  assert.deepEqual(beam[0].slice(7), [1, 0.8, 0.4].map(Math.fround), 'its colour at its strength');
  // the ring
  for (let i = 6; i < 6 + EG_RING_SIDES * 6; i++) {
    const v = V(i), d = Math.hypot(v[0] - 5, v[2] - 5);
    assert.ok(near(d, v[3] < 0 ? 2.9 : 3.1, 1e-5), 'on its radii');
    assert.ok(near(v[1], 0) && v[5] === EG_LIGHT_KIND.ring && near(v[6], 0.25));
  }
  // the glyph: by the view's right (-z here) and up
  const g = [0, 1, 2, 3, 4, 5].map((k) => V(6 + EG_RING_SIDES * 6 + k));
  assert.deepEqual(g.map((v) => [v[2], v[1]]), [[0.5, 7.5], [-0.5, 7.5], [-0.5, 8.5], [0.5, 7.5], [-0.5, 8.5], [0.5, 8.5]]);
  assert.ok(near(g[0][7], EG_LIGHT_BLUE[0] * 0.5, 1e-6), 'its strength in its colour');
  assert.equal(egLightVertices(lights, [10, 1.6, 0], [0, 0, -1], [0, 1, 0], new Float32Array(10 * EG_LIGHT_FLOATS)), 6, 'the room kept: the ring would not fit');
  assert.equal(egLightVertices([{ ...lights[0], a: 0 }, { ...lights[0], h: 0 }], [10, 0, 0], [1, 0, 0], [0, 1, 0], out), 0, 'a light at nothing makes nothing');
  // the shader
  const fs = glslFunctions(EG_LIGHT_FS, { vWorld: [0, 0, 5], vUV: [0, 0], vKind: 0, vX: 0, vCol: [1, 1, 1], uTime: 0, uStill: 0, uFogFloor: [EG_FOG_FLOOR.floor, EG_FOG_FLOOR.within, EG_FOG_FLOOR.ease], uBeamFog: EG_DOOR_BEAM.fog, uSpent: EG_CLOSING_RING.spent, uFogMode: 2, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0], o: [0, 0, 0, 0] });
  const px = (set) => { Object.assign(fs.globals, set); fs.main(); return [...fs.globals.o]; };
  const core = px({ vKind: EG_LIGHT_KIND.beam, vUV: [0, 0.1] })[0], edge = px({ vUV: [0.9, 0.1] })[0], high = px({ vUV: [0, 0.8] })[0];
  assert.ok(core > edge * 2 && core > high * 4, 'a beam\'s core brightest, fading up');
  assert.equal(px({ vUV: [0, 0.1] })[3], 0, 'light added, never painted');
  assert.notDeepEqual(px({ vUV: [0, 0.4], uTime: 0 }), px({ vUV: [0, 0.4], uTime: 0.5 }), 'its ripple');
  assert.deepEqual(px({ vUV: [0, 0.4], uTime: 0, uStill: 1 }), px({ vUV: [0, 0.4], uTime: 0.5, uStill: 1 }), 'stilled under reduced motion');
  const lit = px({ uStill: 0, vKind: EG_LIGHT_KIND.ring, vUV: [0, 0.2], vX: 0.25 })[0], spent = px({ vUV: [0, 0.6] })[0];
  assert.ok(near(spent, lit * EG_CLOSING_RING.spent), 'the spent arc dim');
  const ink = (g2, p) => px({ vKind: EG_LIGHT_KIND.glyph, vX: g2, vUV: p })[3];
  assert.ok(ink(EG_GLYPH.here, [0.62, 0]) > 0.5 && ink(EG_GLYPH.here, [0, 0]) === 0, 'here: a ring');
  assert.ok(ink(EG_GLYPH.danger, [0, 0.1]) > 0.5 && ink(EG_GLYPH.danger, [0, -0.36]) > 0.5 && ink(EG_GLYPH.danger, [0.25, -0.3]) === 0, 'danger: its bar and its point');
  assert.ok(ink(EG_GLYPH.mine, [0.72, 0]) > 0.5 && ink(EG_GLYPH.mine, [0, 0]) === 0, 'mine: a diamond');
  assert.ok(ink(EG_GLYPH.eye, [0, 0]) > 0.5 && ink(EG_GLYPH.eye, [0, 0.5]) > 0.5 && ink(EG_GLYPH.eye, [0.9, 0.9]) === 0, 'the eye: its pupil and its lid');
  // the fog: the floor within 30 m, a beam kept past it, a pillar not
  const thick = { uFogDensity: 0.2, vUV: [0, 0.1] };
  const clear = px({ vKind: EG_LIGHT_KIND.pillar, uFogDensity: 0, vUV: [0, 0.1], vWorld: [0, 0, 20] })[0];
  assert.ok(px({ ...thick, vKind: EG_LIGHT_KIND.pillar, vWorld: [0, 0, 20] })[0] >= clear * EG_FOG_FLOOR.floor - 1e-9, 'kept within 30 m');
  assert.ok(px({ ...thick, vKind: EG_LIGHT_KIND.pillar, vWorld: [0, 0, 120] })[0] < clear * 0.01, 'a pillar lost in the haze far off');
  const beamClear = px({ vKind: EG_LIGHT_KIND.beam, uFogDensity: 0, vUV: [0, 0.1], vWorld: [0, 0, 120] })[0];
  assert.ok(near(px({ ...thick, vKind: EG_LIGHT_KIND.beam, vWorld: [0, 0, 120] })[0], beamClear * EG_DOOR_BEAM.fog, 1e-9), 'a beam seen hall-wide');
  // the pass over a recording GL
  const R = recordingGl(), pass = new EgLightPass(R.gl);
  const ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.equal(pass.draw(ident, ident, [0, 0, 0], 1, null, []), false, 'nothing standing: nothing drawn');
  assert.equal(pass.draw(ident, ident, [10, 1.6, 0], 1, null, lights, true), true);
  assert.equal(pass.drawn, n);
  const tail = R.calls.slice(R.calls.findIndex((c) => c[0] === 'drawArrays'));
  assert.deepEqual(tail[0], ['drawArrays', R.gl.TRIANGLES, 0, n]);
  assert.ok(R.calls.some((c) => c[0] === 'blendFuncSeparate' && c[1] === R.gl.ONE && c[2] === R.gl.ONE_MINUS_SRC_ALPHA), 'added');
  assert.ok(R.calls.some((c) => c[0] === 'depthMask' && c[1] === false) && R.calls.some((c) => c[0] === 'uniform1f' && c[1] === 'uStill' && c[2] === 1));
  assert.deepEqual(tail.slice(-3).map((c) => c.slice(0, 2)), [['depthMask', true], ['disable', R.gl.BLEND], ['enable', R.gl.CULL_FACE]], 'its state given back');
  pass.destroy();
  assert.ok(R.calls.some((c) => c[0] === 'deleteProgram'));
});

test('EG-ZE THE LOOK\'S SEAM (scenes/eliteGates/egLookDraw.js): the lights drawn after the lines, their pass built the first time a light stands and kept, nothing with no circle, no GL or no light, released with the rest (mutants: the pass rebuilt each frame; drawn with no circle; kept past the release)', () => {
  const none = createEgLookDraw({ gl: null });
  none.setCircle(77, 1, 0);
  assert.equal(none.drawLights([], [], [0, 0, 0], 1, null, [{ k: 0, x: 0, y: 0, z: 0, h: 1, w: 1, c: [1, 1, 1], a: 1 }]), false, 'no GL: nothing');
  const R = recordingGl(), L = createEgLookDraw({ gl: R.gl });
  const ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const beam = [{ k: EG_LIGHT_KIND.beam, x: 0, y: 0, z: 0, h: 10, w: 1, r: 0, c: [1, 1, 1], a: 1, f: 0 }];
  assert.equal(L.drawLights(ident, ident, [5, 0, 0], 1, null, beam), false, 'no circle: nothing');
  L.setCircle(77, 1, 0);
  assert.equal(L.drawLights(ident, ident, [5, 0, 0], 1, null, []), false, 'no light: nothing');
  assert.deepEqual(L.lightState(), { pass: false, drawn: 0 }, 'and no pass built');
  assert.equal(L.drawLights(ident, ident, [5, 0, 0], 1, null, beam), true);
  assert.equal(L.drawLights(ident, ident, [5, 0, 0], 2, null, beam), true);
  assert.deepEqual(L.lightState(), { pass: true, drawn: 6 });
  assert.equal(R.calls.filter((c) => c[0] === 'shaderSource' && c[2].includes('glyphInk')).length, 1, 'built once');
  L.release();
  assert.deepEqual(L.lightState(), { pass: false, drawn: 0 }, 'released');
  const C = rd('src/scenes/eliteGates/egClient.js');
  const body = C.slice(C.indexOf('    drawPass(proj, view, eye, seconds, fog) {'), C.indexOf('    /** EG-G2: THE SPIRE\'S SKY'));
  assert.ok(body.indexOf('L?.drawOver(') < body.indexOf('L?.drawLights(') && body.indexOf('L?.drawLights(') > 0, 'over the lines');
  // PIN MOVED (EG-LOOK, Elite-Gates-Look.md section 5): the frame's lights asked once and handed to the air's halos (the
  // door's beam's foot) and to the lights alike, reduced motion read once with them
  assert.match(body, /still = stillNow\(\), shining = lightsNow\(\);/, 'this frame\'s lights and reduced motion, asked once');
  assert.match(body, /L\?\.drawLights\(proj, view, eye, ts, fog, shining, still\)/, 'this frame\'s lights on the shared clock, reduced motion read');
});

/** The breach client played between the relay's own words (each through the wire) and a mode machine, a veil, a renderer
 *  and a presence of fakes. */
function inBreach({ h = 2, sg = 'trial', seed = 77, reduce = false, circle = null, gl = null } = {}) {
  let clock = T0 + EG_SEALED_MS + 60_000;
  const Br = breach({ h, sg, seed, clock });
  const sent = [], said = [], mids = [], played = [], flashes = [], steps = [], swaps = [];
  let standing = circle ?? Math.ceil(h / 5);
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const modes = {
    mode: 'dungeon', egHallBreach: () => Br.b, egHallCircle: () => standing, egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] },
    stepThroughFire: async (go, look, opts) => { steps.push({ look, opts }); return go(); },
    egPrebuild: () => 'ready', egSwapCircle: (r) => { swaps.push(r.c); standing = r.c; return true; },
  };
  const veil = { flash: (look, opts) => flashes.push({ look, opts }) };
  const online = { welcomes: 1, terminal: false, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
  let peers = [];
  const mem = new Map();
  const win = { innerWidth: 1280, innerHeight: 720, matchMedia: (q) => ({ matches: reduce && /reduced-motion/.test(q) }) };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: (t) => said.push(t), mid: (t) => mids.push(t), veil: () => veil, site: () => ({}), wire: () => null, landAt: () => true, hurt: (n) => { entity.health -= n; }, peers: () => peers,
    store: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); } },
    audio: { playOneShot: (rec, vol, pitch) => played.push({ rec, vol, pitch }) }, win, renderer: gl ? { gl } : null });
  const tell = (w) => { const v = validEgOut(json(w)); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  tell(egStateOf(Br, clock));
  const at = (hh) => { const s = egHallOf(seed, hh, 0); player.pos = realmToDungeon(s.x0 + s.arrive.x, 0, s.arrive.z); };
  if (egHallOf(seed, h, 0).arrive) at(h);
  return { client, B: Br, player, sent, said, mids, played, flashes, steps, swaps, tell, at, step: (ms) => { clock += ms; }, now: () => clock, setPeers: (p) => { peers = p; }, standing: () => standing };
}
const settle = () => new Promise((r) => setImmediate(r));

test('EG-ZE THE CLIENT, PLAYED (scenes/eliteGates/egClient.js): the pull to the next hall\'s plate under the stair\'s veil - the band\'s, its hall held - and a cut under reduced motion; the swap into a band\'s first hall the full fall, into any other circle the veil; the step into the breach under the stair of its first hall; the compass\'s gold slot the door\'s through the closing, never the arch\'s in the Spire nor a witness\'s; a ping heard chimes once and its pillar is drawn over the lines; a witness pings where the member it watches stands and hears the next hall\'s twist once (mutants: the pull under the Hour\'s veil; the swap never falling; the compass the arch\'s inside; the ping silent; the witness\'s ping on the plate)', async () => {
  // the pull: Hall 2's arrival, my feet on Hall 1's plate
  const P = inBreach({ h: 2, sg: 'arrive' });
  P.at(1);
  P.client.frame();
  assert.deepEqual(P.flashes, [{ look: 'egVeil', opts: egStairStep(2).opts }], 'the band\'s veil, Hall 2 held');
  const C = inBreach({ h: 2, sg: 'arrive', reduce: true });
  C.at(1);
  C.client.frame();
  assert.equal(C.flashes[0].look, 'egCut', 'reduced motion: the plain cut');
  // the swap: into Hall 26 the full fall, into Hall 6 the veil
  const S = inBreach({ h: 26, sg: 'arrive', circle: 5 });
  S.client.frame(); await settle();
  assert.deepEqual(S.swaps, [6]);
  assert.deepEqual(S.steps, [{ look: 'egFall', opts: egStairStep(26).opts }], 'the full fall into the Soul Cairn');
  assert.equal(S.steps[0].opts.band, 1);
  const V = inBreach({ h: 6, sg: 'arrive', circle: 1 });
  V.client.frame(); await settle();
  assert.deepEqual(V.steps.map((s) => s.look), ['egVeil']);
  assert.equal(V.flashes.length, 0, 'my feet put on the new plate under the swap\'s own veil - no flash over it');
  const E = rd('src/scenes/eliteGates/egClient.js');
  assert.match(E, /const step = egStairStep\(egStartHall\(c\.ew \?\? 0\), stillNow\(\)\);/, 'the step in: the stair of the breach\'s own first hall');
  assert.match(E, /site: site\(\), \.\.\.\(landing \? \{ landing \} : \{\}\) \}\), step\.look, step\.opts\);/);
  assert.ok(!/'hourIn'/.test(E), 'never the Hour\'s veil in the Spire');
  // the compass: the door's through the closing
  const D = inBreach({ h: 1, sg: 'closing' });
  const spec1 = egHallOf(77, 1, 0), door = egToDungeon(spec1, spec1.end.x, spec1.end.y ?? 0, spec1.end.z);
  assert.deepEqual(D.client.archCompass(), [door[0], door[2]]);
  D.B.sg = 'trial'; D.tell(egStateOf(D.B, D.now()));
  assert.equal(D.client.archCompass(), null, 'no door in the trial - and never the arch in the Spire');
  // a ping heard: one chime, its pillar drawn over the lines
  const R = recordingGl();
  const G = inBreach({ h: 2, sg: 'trial', gl: R.gl });
  G.client.frame();
  const chimes = () => G.played.filter((p) => p.rec === EG_BEAT_SOUNDS.chime.rec && p.vol === EG_BEAT_SOUNDS.chime.vol).length;
  const before = chimes();
  const said = egWord(G.B, 'acct-1', { k: 'lping', x: 0, z: 20, w: 0 }, null, G.now(), () => 0.5);
  G.tell(said.find((w) => w.k === 'eping'));
  G.client.frame(); G.client.frame();
  assert.equal(chimes() - before, 1, 'one chime');
  const ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  G.step(500);
  assert.equal(G.client.drawPass(ident, ident, [0, 1.6, 0], 1, null), true);
  const draws = R.drawsOf('glyphInk');
  assert.equal(draws.length, 1, 'the lights drawn');
  assert.equal(draws[0][3], 12, 'a pillar and its glyph');
  const lines = R.calls.findIndex((c) => c[0] === 'useProgram' && c[1] === R.progOf('uGold')), lights = R.calls.findIndex((c) => c[0] === 'useProgram' && c[1] === R.progOf('glyphInk'));
  assert.ok(lines >= 0 && lights > lines, 'after THE EDGE LINE');
  // the witness: its ping at the member it watches, the next hall's twist once
  const W = inBreach({ h: 21, sg: 'trial', seed: 1 });
  const spec21 = egHallOf(1, 21, 0);
  W.setPeers([{ sub: 'acct-1', pos: realmToDungeon(spec21.x0 + 1.5, 0, 33) }]);
  W.B.mem[ME].alive = 0; W.B.mem[ME].wit = 1;
  W.tell({ k: 'fall', s: ME, n: 'Mac', at: W.now(), fin: 0 });
  W.tell(egStateOf(W.B, W.now()));
  W.client.frame(); W.client.frame();
  const line = EG_LIGHTS_TEXT.sight(EG_TWIST_LINES[egHallOf(1, 22, 0).twist]);
  assert.equal(W.said.filter((t) => t === line).length, 1, 'the next hall\'s twist, once');
  W.B.sg = 'closing'; W.B.sa = W.now(); W.B.su = W.now() + 20_000; W.tell(egStateOf(W.B, W.now()));
  assert.equal(W.client.archCompass(), null, 'the door open, but a witness takes none');
  W.client.command('ping danger');
  const ping = W.sent.find((m) => m.k === 'ping');
  assert.ok(ping, 'a witness\'s ping');
  const [sx, , z] = dungeonToRealm(...realmToDungeon(spec21.x0 + 1.5, 0, 33));
  assert.deepEqual([ping.x, ping.z, ping.w], [Math.round((sx - spec21.x0) * 100) / 100, Math.round(z * 100) / 100, 1], 'where the watched member stands');
  const Liv = inBreach({ h: 21, sg: 'trial', seed: 1 });
  Liv.client.frame(); Liv.client.frame();
  assert.ok(!Liv.said.includes(line), 'the living hear no twist ahead');
  // the living's ping from my own feet
  const Lv = inBreach({ h: 2, sg: 'trial' });
  Lv.client.frame();
  Lv.client.command('ping mine');
  const lp = Lv.sent.find((m) => m.k === 'lping'), s2 = egHallOf(77, 2, 0);
  assert.deepEqual([lp.x, lp.z, lp.w], [s2.arrive.x, s2.arrive.z, 2]);
});
