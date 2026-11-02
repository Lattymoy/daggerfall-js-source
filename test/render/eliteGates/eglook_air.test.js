// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md section 5 and
// section 7's motes): THE AIR - render/eliteGates/egMotes.js and its draw (scenes/eliteGates/egLookDraw.js drawAir, scenes/eliteGates/egClient.js drawPass):
// SD14c's motion law made a generator of a layout and its colours, each band's own kinds (the Galleries' embers and ash,
// the Cairn's soul-motes, the Shade's moon-dust, the Wellhead's sparks and heavy ash), 600-1,000 points in one draw, added,
// depth-tested, fogged, under L2 but the hot ones' hottest; whole lives over the period; one field about the eye, anchored
// at its hall; THE TELEGRAPHS KEEP THEIR FLOOR (gone within 3 m of any floor's top, out of every passage); held still under
// reduced motion and never touched by THE QUIET COMPANY; the halos of the lamps and the way's beams (render/superDungeon/sdHalo.js, at
// most 48); the Cairn's mist under every rim and never over a floor; every allocation owned and none a frame. Pinned on
// the code the GPU runs (test/glsl.mjs runs the shaders' own text).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { glslFunctions } from '../../glsl.mjs';
import { EG_MOTE_KINDS, EG_MOTE_COLOURS, EG_MOTE_CELL, EG_MOTE_FLOOR, EG_MOTE_PX, EG_MOTES_VS, EG_MOTES_FS, egMoteLayout, egMoteCount, egMoteFloors, egMoteFloorKeep, EG_HALO, egHalosInto, EG_RIM_MIST, egRimMists, EgMotesPass } from '../../../src/render/eliteGates/egMotes.js';
import { EG_SKY_PERIOD } from '../../../src/render/eliteGates/egSkyMap.js';
import { EG_MIST_FS } from '../../../src/render/eliteGates/egMistPass.js';
import { SD_HALO_GAIN } from '../../../src/render/superDungeon/sdHalo.js';
import { egAtmosOf } from '../../../src/world/eliteGates/egAtmos.js';
import { egCircleLights, egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { EG_LIGHT_KIND } from '../../../src/world/eliteGates/egLights.js';
import { egCircleSpecs, egBandOfCircle } from '../../../src/net/eliteGates/egLaw.js';
import { createEgLookDraw } from '../../../src/scenes/eliteGates/egLookDraw.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** The motes' vertex shader's own law, with the floors of `floors` (egMoteFloors's) bound. */
function law(floors = new Float32Array(EG_MOTE_FLOOR.max * 8), n = 0, eye = [0, 0, 0], anchor = [0, 0, 0], T = 40) {
  const uFloor = [];
  for (let i = 0; i < EG_MOTE_FLOOR.max * 2; i++) uFloor.push([floors[i * 4], floors[i * 4 + 1], floors[i * 4 + 2], floors[i * 4 + 3]]);
  return glslFunctions(EG_MOTES_VS, { uFloor, uFloors: n, uEye: eye, uAnchor: anchor, uTime: T, uPxPerM: 500, uVP: [...I] });
}
const at = (F, s, T) => { const size = { value: 0 }, alpha = { value: 0 }, heat = { value: 0 }; const p = F.moteAt(s, T, size, alpha, heat); return { p, size: size.value, alpha: alpha.value, heat: heat.value }; };

test('EG-LOOK THE MOTES\' LAYOUT AND COLOURS (section 5: "the Galleries\' embers rising and ash falling, the Cairn\'s soul-motes rising slow, the Shade\'s moon-dust falling silver, the Wellhead\'s sparks rising thick and heavy ash; 600-1,000 points ... the band\'s colours under L2 except the embers\' and sparks\' hottest (L3, small)"): each band its own kinds, 600 to 1,000 on the desktop and half on the phones\' tier, seeded (the same air on every screen); every colour under L2 but the hot kinds\' hottest, under L3 and small; a mote\'s light at most its colour (mutants: a band\'s count past 1,000; a cool colour lifted past L2; a hot one past L3; the layout reseeded a call)', () => {
  const kinds = [['ember', 'ash'], ['soul'], ['dust'], ['spark', 'cinder']];
  for (let b = 0; b < 4; b++) {
    const n = egMoteCount(b), L = egMoteLayout(b), L2 = egMoteLayout(b);
    assert.deepEqual(egAtmosOf(b).motes.map((m) => m.kind), kinds[b], `band ${b}: its own kinds`);
    assert.ok(n >= 600 && n <= 1000, `band ${b}: ${n} points`);
    assert.equal(L.length, n * 4);
    assert.deepEqual(L, L2, 'seeded');
    assert.equal(egMoteLayout(b, true).length / 4, egMoteCount(b, true));
    assert.ok(egMoteCount(b, true) <= n / 2 + 1, 'the phones\' tier: half');
    const ids = new Set(); for (let i = 0; i < L.length; i += 4) { ids.add(L[i]); for (let k = 1; k < 4; k++) assert.ok(L[i + k] >= 0 && L[i + k] < 1); }
    assert.deepEqual([...ids].sort(), kinds[b].map((k) => EG_MOTE_KINDS[k].id).sort(), `band ${b}: no other band's kind`);
  }
  for (const [name, K] of Object.entries(EG_MOTE_KINDS)) {
    const C = EG_MOTE_COLOURS[K.id];
    assert.equal(egAtmosOf(C.band).motes.find((m) => m.kind === name).hi, C.hi, `${name}: the band's own colours (one home)`);
    assert.ok(luma(C.lo) <= 0.45, `${name}: cool under L2`);
    if (K.hot) assert.ok(luma(C.hi) > 0.45 && luma(C.hi) <= 0.8 && K.size[1] <= 0.16, `${name}: its hottest L3, and small`);
    else assert.ok(luma(C.hi) <= 0.45, `${name}: under L2 (${luma(C.hi).toFixed(3)})`);
    assert.ok(Number.isInteger(K.turns[0]) && Number.isInteger(K.turns[1]) && K.turns[0] >= 1 && Number.isInteger(K.wind), `${name}: whole lives and whole cells of wind`);
  }
  const FS = glslFunctions(EG_MOTES_FS, {});
  let top = 0;
  for (const glow of [0, 1]) for (const px of [2, 3, 8, 20]) for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) top = Math.max(top, FS.moteShape([x / 10, y / 10], glow, px));
  assert.equal(top, 1, 'a mote\'s light at most its colour');
  assert.equal(FS.moteShape([0.9, 0.9], 1, 2), 1, 'a dot of a few pixels one solid pixel-art dot');
  assert.ok(FS.moteShape([0.9, 0.9], 1, 12) < 0.5 && FS.moteShape([0, 0], 1, 12) === 1, 'a near one\'s core and its dimmer rings');
  assert.match(EG_MOTES_FS, /fogFactorAt\(vWorld\)/, 'fogged as the world is');
});

test('EG-LOOK THE MOTION LAW (SD14c\'s, made a generator): every mote a pure function of its draws and the clock, its lives whole over the period - the field at the period\'s end is the field at its start, its wind whole cells; the risers rise and the fallers fall, each born and gone dark; the hot ones cool as they climb (mutants: a life off its whole cycles; the wind off its whole cells; a riser falling; born lit)', () => {
  assert.equal(EG_SKY_PERIOD, 720);
  const F = law();
  for (let b = 0; b < 4; b++) {
    const L = egMoteLayout(b);
    let risen = 0, fell = 0, checked = 0;
    for (let i = 0; i < Math.min(L.length / 4, 160); i++) {
      const s = [L[i * 4], L[i * 4 + 1], L[i * 4 + 2], L[i * 4 + 3]], K = Object.values(EG_MOTE_KINDS).find((k) => k.id === s[0]);
      const a = at(F, s, 0), z = at(F, s, EG_SKY_PERIOD);
      const dx = (z.p[0] - a.p[0]) / EG_MOTE_CELL;
      assert.ok(Math.abs(dx - Math.round(dx)) < 1e-6 && Math.abs(z.p[1] - a.p[1]) < 1e-6 && Math.abs(z.p[2] - a.p[2]) < 1e-6 && Math.abs(z.alpha - a.alpha) < 1e-6, `band ${b} mote ${i}: the period's end its start`);
      // a step within a life: the riser up, the faller down
      const n = Math.floor(K.turns[0] + s[1] * (K.turns[1] - K.turns[0] + 1)), life = EG_SKY_PERIOD / n;
      const T = ((0.5 - s[2]) * life + 10 * life) % EG_SKY_PERIOD;   // half way through one of its lives
      const p0 = at(F, s, T), p1 = at(F, s, T + life * 0.01);
      if (K.rise > 0) { assert.ok(p1.p[1] > p0.p[1], 'a riser rises'); risen++; } else { assert.ok(p1.p[1] < p0.p[1], 'a faller falls'); fell++; }
      const born = at(F, s, ((1 - s[2]) * life + 3 * life) % EG_SKY_PERIOD + 1e-4);
      assert.ok(born.alpha < 0.01, `born dark (${born.alpha})`);
      if (K.hot) assert.ok(at(F, s, T + life * 0.3).heat < p0.heat, 'cooling as it climbs');
      checked++;
    }
    assert.ok(checked > 0 && (b === 1 ? risen > 0 && fell === 0 : true));
    if (b === 2) assert.ok(fell > 0 && risen === 0, 'the Shade\'s dust falls');
  }
});

test('EG-LOOK ONE FIELD ABOUT THE EYE (section 5: "about the hall the eye stands in"): the field anchored at the hall, every mote drawn in the cell about the eye and gone at its edge (where it wraps), the same mote in the same place for two eyes that both see it (mutants: the field off the anchor; the wrap unfaded)', () => {
  const anchor = [1000, 0, 2000], A = [1020, 5, 2030], B = [1023, 5, 2027];
  const FA = law(undefined, 0, A, anchor), FB = law(undefined, 0, B, anchor), L = egMoteLayout(0);
  let shared = 0;
  for (let i = 0; i < L.length / 4; i++) {
    const s = [L[i * 4], L[i * 4 + 1], L[i * 4 + 2], L[i * 4 + 3]];
    const box = () => ({ value: 0 });
    const sa = box(), aa = box(), ha = box(), sb = box(), ab = box(), hb = box();
    const wa = FA.moteWorld(s, 40, sa, aa, ha), wb = FB.moteWorld(s, 40, sb, ab, hb);
    const ra = Math.max(Math.abs(wa[0] - A[0]), Math.abs(wa[2] - A[2]));
    assert.ok(ra <= EG_MOTE_CELL / 2 + 1e-6, 'in the cell about the eye');
    if (ra >= 0.98 * EG_MOTE_CELL / 2) assert.ok(aa.value < 1e-6, 'gone at the edge, where it wraps');
    const rb = Math.max(Math.abs(wb[0] - B[0]), Math.abs(wb[2] - B[2]));
    if (ra < EG_MOTE_CELL / 2 - 4 && rb < EG_MOTE_CELL / 2 - 4) { shared++; assert.ok(Math.hypot(wa[0] - wb[0], wa[1] - wb[1], wa[2] - wb[2]) < 1e-6, 'one place for both eyes'); }
  }
  assert.ok(shared > 100);
  const plain = at(law(), [0, 0.3, 0.4, 0.5], 40).p, w = law(undefined, 0, [anchor[0] + plain[0], 0, anchor[2] + plain[2]], anchor).moteWorld([0, 0.3, 0.4, 0.5], 40, { value: 0 }, { value: 0 }, { value: 0 });
  assert.ok(Math.abs(w[0] - anchor[0] - plain[0]) < 1e-6 && Math.abs(w[2] - anchor[2] - plain[2]) < 1e-6, 'anchored at the hall');
});

test('EG-LOOK THE TELEGRAPHS KEEP THEIR FLOOR (section 5: "the motes fade within 3 m of any floor\'s top"; Elite-Gates.md section 25.6): every hall\'s floors handed to the shader - its discs, bands, lanes, ramps, its pieces\' runs and its passages, at most 40 - and over any of them a mote within 3 m of its top is gone, back past 4.5, untouched past its footprint, and none inside a passage; the shader\'s law is the JS law (mutants: the clearance shrunk; a floor kind dropped; the passage\'s height forgotten; the floor count capped short)', () => {
  const F = law();
  let halls = 0;
  for (const seed of [7, 8]) for (const c of [1, 6, 11, 16, 2, 17]) for (const spec of egCircleSpecs(seed, c, 0)) {
    const floors = new Float32Array(EG_MOTE_FLOOR.max * 8), n = egMoteFloors(spec, floors);
    const want = spec.discs.length + spec.bands.length + (spec.lanes ?? []).length + (spec.ramps ?? []).length + (spec.caves ?? []).length + new Set((spec.steps ?? []).map((s) => s.road ?? 0)).size;
    assert.equal(n, Math.min(want, EG_MOTE_FLOOR.max), `circle ${c} hall ${spec.kind}: every floor handed (${want})`);
    const G = law(floors, n);
    const keep = (p) => G.floorFade(p);
    for (const d of spec.discs) {
      const top = egToDungeon(spec, d.x, d.y ?? 0, d.z);
      assert.equal(keep([top[0], top[1] + 2.9, top[2]]), 0, 'over a disc, under 3 m: gone');
      assert.equal(keep([top[0], top[1] + 0.2, top[2]]), 0, 'on its top: gone');
    }
    for (const q of spec.caves ?? []) {
      const mid = egToDungeon(spec, q.x, (q.y ?? 0) + q.height * 0.6, (q.z0 + q.z1) / 2);
      assert.equal(keep(mid), 0, 'none inside a passage');
    }
    // the shader's law and the JS law agree, everywhere about the hall
    let s = 99;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const o = egToDungeon(spec, 0, 0, 0);
    for (let k = 0; k < 60; k++) {
      const p = [o[0] - 30 + r() * 60, o[1] - 8 + r() * 20, o[2] - 10 + r() * (spec.len ?? 80) + 20];
      assert.ok(Math.abs(keep(p) - egMoteFloorKeep(floors, n, p)) < 1e-9, 'one law');
    }
    halls++;
  }
  assert.ok(halls >= 60);
  // the clearance itself, on one disc
  // (that disc alone handed - PIN MOVED, EG-PERFECT: spec law 10's way circles this court at its height, its bridges inside the margin)
  const hall = egCircleSpecs(7, 1, 0)[0], d = hall.discs.find((q) => q.role === 'court');
  const spec = { ...hall, discs: [d], bands: [], lanes: [], ramps: [], caves: [], steps: [] }, floors = new Float32Array(EG_MOTE_FLOOR.max * 8), n = egMoteFloors(spec, floors);
  const c = egToDungeon(spec, d.x, d.y ?? 0, d.z), G = law(floors, n);
  assert.equal(G.floorFade([c[0], c[1] + EG_MOTE_FLOOR.clear - 0.01, c[2]]), 0);
  assert.equal(G.floorFade([c[0], c[1] + EG_MOTE_FLOOR.clear + EG_MOTE_FLOOR.ease + 0.01, c[2]]), 1);
  assert.ok(G.floorFade([c[0], c[1] + EG_MOTE_FLOOR.clear + EG_MOTE_FLOOR.ease / 2, c[2]]) > 0.3);
  assert.equal(G.floorFade([c[0] + d.r + EG_MOTE_FLOOR.margin + 0.5, c[1] + 1, c[2]]), 1, 'past its footprint and its margin: untouched');
  assert.deepEqual({ ...EG_MOTE_FLOOR }, { clear: 3, ease: 1.5, under: 1, margin: 1, max: 40 });
  assert.equal(F.floorFade([0, 0, 0]), 1, 'no floors: nothing faded');
});

/** A WebGL2 that records what is asked of it, every object it makes live until deleted. */
function recordingGl(w = 1280, h = 720) {
  const calls = [], live = new Map();
  let ids = 0, stray = 0;
  const gl = new Proxy({ drawingBufferWidth: w, drawingBufferHeight: h, VERTEX_SHADER: 'VS', FRAGMENT_SHADER: 'FS' }, { get(t, k) {
    if (k in t) return t[k];
    if (typeof k !== 'string') return undefined;
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (p, n) => ({ p, n });
    if (/^create(Buffer|VertexArray|Texture|Program|Framebuffer|Shader)$/.test(k)) return (...a) => { const o = { kind: k.slice(6), id: ++ids }; live.set(o, o.kind); calls.push([k, ...a]); return o; };
    if (/^delete(Buffer|VertexArray|Texture|Program|Shader|Framebuffer)$/.test(k)) return (o) => { if (o && !live.delete(o)) stray++; };
    if (k.toUpperCase() === k) return k;
    return (...a) => { calls.push([k, ...a]); };
  } });
  const count = () => { const c = {}; for (const k of live.values()) c[k] = (c[k] ?? 0) + 1; return c; };
  return { gl, calls, count, stray: () => stray };
}

test('EG-LOOK ONE DRAW, ADDED, DEPTH-TESTED, NEVER WRITTEN (section 5): the motes\' pass lays a band\'s layout once a band and draws it in one POINTS draw, ONE/ONE onto the frame, the depth tested and handed back written, in the frame\'s fog; destroyed, once, its every object (mutants: the depth written; blended over; the layout laid a frame)', () => {
  const R = recordingGl(), P = new EgMotesPass(/** @type {any} */ (R.gl));
  assert.equal(P.draw(I, I, [0, 0, 0], 10), false, 'no band laid: nothing');
  assert.equal(P.setBand(3), true); assert.equal(P.setBand(3), false, 'once a band');
  P.setHall(egCircleSpecs(7, 16, 0)[0]);
  R.calls.length = 0;
  assert.equal(P.draw(I, I, [0, 1, 0], 1e9 + 0.5, { mode: 2, density: 0.009, range: new Float32Array([0, 1]), camPos: new Float32Array(3) }, 0.6, 720), true);
  const draws = R.calls.filter((c) => c[0] === 'drawArrays');
  assert.deepEqual(draws, [['drawArrays', 'POINTS', 0, egMoteCount(3)]], 'one draw, every point');
  const ix = (k, ...a) => R.calls.findIndex((c) => c[0] === k && a.every((v, i) => c[i + 1] === v)), d = ix('drawArrays');
  for (const [k, ...a] of [['blendFunc', 'ONE', 'ONE'], ['depthMask', false], ['enable', 'DEPTH_TEST'], ['enable', 'BLEND']]) assert.ok(ix(k, ...a) >= 0 && ix(k, ...a) < d, `${k}(${a.join(', ')}) before the draw`);
  assert.ok(ix('depthMask', true) > d && ix('disable', 'BLEND') > d, 'handed back after it');
  assert.ok(!R.calls.some((c) => c[0] === 'bufferData'), 'the layout not laid again a frame');
  const t = R.calls.find((c) => c[0] === 'uniform1f' && c[1]?.n === 'uTime')[2];
  assert.ok(t >= 0 && t < EG_SKY_PERIOD && Math.abs(t - ((1e9 + 0.5) % EG_SKY_PERIOD)) < 1e-6, 'the clock wrapped before it reaches a float');
  assert.equal(R.calls.find((c) => c[0] === 'uniform1f' && c[1]?.n === 'uGain')[2], 0.6);
  P.destroy(); P.destroy();
  assert.deepEqual(R.count(), {}); assert.equal(R.stray(), 0);
});

test('EG-LOOK HELD STILL, NEVER QUIETED (section 5; Elite-Gates.md section 25.7\'s reduced motion and 25.4\'s QUIET COMPANY): under reduced motion the air\'s clock holds where it stood - the motes still - and runs again with it off; the air reads no stage, no quiet company and no ally\'s setting, and the breach client hands it its reduced motion alone; the halos at the lane\'s gain (mutants: the clock running under reduced motion; the air quieted in a trial)', () => {
  const R = recordingGl(), L = createEgLookDraw({ gl: /** @type {any} */ (R.gl), lite: false });
  L.setCircle(7, 1, 0);
  const eye = egToDungeon(egCircleSpecs(7, 1, 0)[0], 0, 1.7, 0);
  const times = () => R.calls.filter((c) => c[0] === 'uniform1f' && c[1]?.n === 'uTime' && R.calls.length).map((c) => c[2]);
  const frame = (ts, still) => { R.calls.length = 0; L.drawAir(I, I, eye, ts, null, true, still, null, 720); return R.calls.filter((c) => c[0] === 'uniform1f' && c[1]?.n === 'uTime').map((c) => c[2])[0]; };
  const a = frame(100, false), b = frame(101, false);
  assert.ok(b > a, 'running');
  const s1 = frame(102, true), s2 = frame(150, true);
  assert.equal(s1, b, 'reduced motion: held where it stood'); assert.equal(s2, b);
  assert.ok(frame(151, false) > b, 'and runs again');
  void times;
  const halo = R.calls.filter((c) => c[0] === 'uniform1f' && c[1]?.n === 'uGain').map((c) => c[2]);
  assert.ok(halo.includes(SD_HALO_GAIN.lane), 'the halos at the lane\'s gain');
  const D = rd('src/scenes/eliteGates/egLookDraw.js'), air = D.slice(D.indexOf('    drawAir('), D.indexOf('    drawOver('));
  assert.ok(!/quiet|egQuietCompany|allyAlpha|auras|stage/i.test(air.replace(/^\s*\/\/.*$/gm, '')), 'the air reads no quiet company');
  assert.ok(!/egQuietCompany|allyEffects/.test(rd('src/render/eliteGates/egMotes.js')), 'nor its pass');
  assert.match(rd('src/scenes/eliteGates/egClient.js'), /L\?\.drawAir\(proj, view, eye, ts, fog, lane, still, shining, vp\?\.\[3\] \?\? 0\)/, 'the client hands it reduced motion, never the stage');
  L.release();
  assert.deepEqual(R.count(), {}, 'released: every pass of the air');
});

test('EG-LOOK THE HALOS (section 5: "every lamp\'s fixture and the door beam\'s foot, at most 48 a frame, the classic set\'s bloom"): the way\'s beams\' feet first (the door, the beacon), then the circle\'s lamps (world/eliteGates/egHall.js egCircleLights, where they stand) nearest the eye, none past 120 m, at most 48, each at its lamp in its colour; the same kept slots frame after frame (mutants: the cap lifted; the far lamps kept; the beams dropped; the slots made a frame)', () => {
  const lamps = egCircleLights(7, 1, 0), spec = egCircleSpecs(7, 1, 0)[0], eye = egToDungeon(spec, 0, 1.7, 0), order = new Int32Array(lamps.length), out = { length: 0 };
  const beam = { k: EG_LIGHT_KIND.beam, x: eye[0], y: eye[1] - 1.7, z: eye[2] + 60, h: 48, w: 1.4, r: 0, c: [1, 0.78, 0.4], a: 1, f: 0 }, ring = { ...beam, k: EG_LIGHT_KIND.ring, h: 0 };
  egHalosInto(out, lamps, [ring, beam], eye, order);
  assert.ok(out.length > 0 && out.length <= EG_HALO.max);
  assert.deepEqual([...out[0].at], [beam.x, beam.y + EG_HALO.beam.up, beam.z].map(Math.fround), 'the beam\'s foot first');
  const d = (h) => Math.hypot(h.at[0] - eye[0], h.at[1] - eye[1], h.at[2] - eye[2]);
  for (let i = 2; i < out.length; i++) assert.ok(d(out[i]) >= d(out[i - 1]) - 1e-4, 'nearest first');
  for (let i = 1; i < out.length; i++) assert.ok(d(out[i]) <= EG_HALO.far + 1e-3, 'none past the far');
  const near = lamps.filter((l) => Math.hypot(l.x - eye[0], l.y - eye[1], l.z - eye[2]) <= EG_HALO.far);
  assert.equal(out.length, Math.min(EG_HALO.max, 1 + near.length), 'every lamp in reach, under the cap');
  const h1 = out[1];
  assert.deepEqual([...h1.color], near.length ? [...lamps.find((l) => Math.abs(l.x - h1.at[0]) < 1e-3 && Math.abs(l.z - h1.at[2]) < 1e-3).color].map((v) => Math.fround(v * EG_HALO.lamp.k)) : []);
  const slots = Array.from({ length: out.length }, (_, i) => out[i]);
  egHalosInto(out, lamps, [beam], [eye[0] + 1, eye[1], eye[2]], order);
  assert.ok(slots.every((s, i) => out[i] === s), 'the kept slots');
  // a crowd of lamps: the cap
  const many = Array.from({ length: 90 }, (_, i) => ({ x: eye[0] + (i % 10), y: eye[1], z: eye[2] + Math.floor(i / 10), color: [1, 0.78, 0.42] }));
  egHalosInto(out, many, [beam], eye, new Int32Array(many.length));
  assert.equal(out.length, EG_HALO.max, 'at most 48');
  assert.equal(EG_HALO.max, 48);
});

test('EG-LOOK THE CAIRN\'S MIST SHEETS (section 5: "the band\'s mist under every rim, below the cornice\'s foot ... held still"; the brief: "never over a floor"): the Soul Cairn\'s halls alone, a sheet under each disc (round) and each open band (square), the largest first, at most the mist pass\'s eight; every sheet below the lowest top of every floor its footprint meets by the cornice\'s depth - never over a floor; the mist pass draws a round sheet round (mutants: a sheet over a lower floor; the Galleries misted; the cap lifted)', () => {
  let sheets = 0;
  for (let seed = 1; seed <= 6; seed++) for (let c = 1; c <= 20; c++) for (const spec of egCircleSpecs(seed, c, 0)) {
    const band = egBandOfCircle(c), out = { length: 0 };
    egRimMists(spec, band, out);
    if (band !== 1) { assert.equal(out.length, 0, `band ${band}: no rim mist`); continue; }
    assert.ok(out.length <= EG_RIM_MIST.max && out.length > 0);
    const floors = [...spec.discs.map((d) => [d.x - d.r, d.z - d.r, d.x + d.r, d.z + d.r, d.y ?? 0]), ...spec.bands.map((b) => [b.x - b.halfW, Math.min(b.z0, b.z1), b.x + b.halfW, Math.max(b.z0, b.z1), b.y ?? 0]),
      ...(spec.lanes ?? []).map((l) => [Math.min(l.ax, l.bx) - l.hw, Math.min(l.az, l.bz) - l.hw, Math.max(l.ax, l.bx) + l.hw, Math.max(l.az, l.bz) + l.hw, l.y ?? 0])];
    const o = egToDungeon(spec, 0, 0, 0);
    for (let i = 0; i < out.length; i++) {
      const s = out[i], x0 = s.rect[0] - o[0], z0 = s.rect[1] - o[2], x1 = s.rect[2] - o[0], z1 = s.rect[3] - o[2], y = s.y - o[1];
      // (EG-PERFECT's audit: a footprint that only touches a floor's edge meets none, as egRimMists reads it in the hall's frame - the
      // scene's frame and back put seed 3's hall 32's sheet 1e-12 m onto a disc's edge)
      const E = 1e-6;
      for (const f of floors) if (f[0] < x1 - E && f[2] > x0 + E && f[1] < z1 - E && f[3] > z0 + E) assert.ok(y <= f[4] - EG_RIM_MIST.below + 1e-6, `circle ${c} ${spec.kind}: a sheet at ${y.toFixed(2)} under a floor at ${f[4]}`);
      assert.equal(typeof s.round, 'boolean');
      sheets++;
    }
    const discs = spec.discs.filter((d) => d.r >= EG_RIM_MIST.minR && !(d.role === 'isle' && spec.kind === 'court')).length;
    let round = 0;
    for (let i = 0; i < out.length; i++) if (out[i].round) round++;
    assert.ok(round >= Math.min(1, discs), 'a disc\'s sheet round');
  }
  assert.ok(sheets > 50, `${sheets} sheets`);
  assert.match(EG_MIST_FS, /float rim = uRound > 0\.5 \? 1\.0 - smoothstep\(0\.72, 1\.0, length\(vQ \* 2\.0 - 1\.0\)\)/, 'round under a disc');
  assert.equal(EG_RIM_MIST.max, 8);
});

test('EG-LOOK THE AIR IS DRAWN AS THE GAME DRAWS IT (scenes/eliteGates/egClient.js drawPass; the lab, src/tools/spireLab.js): the sky\'s next quadrant, the mist, THE AIR, the fight, the lines, the lights - in that order, in the client and in the lab alike (mutants: the air after the lines; the lab without the air)', () => {
  const C = rd('src/scenes/eliteGates/egClient.js'), body = C.slice(C.indexOf('    drawPass(proj, view, eye, seconds, fog) {'), C.indexOf('    /** EG-G2: THE SPIRE\'S SKY'));
  const order = ['L?.paintSky(', 'L?.drawUnder(', 'L?.drawAir(', 'fight?.drawPass(', 'L?.drawOver(', 'L?.drawLights('].map((k) => body.indexOf(k));
  assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), `the client's order: ${order.join(', ')}`);
  const L = rd('src/tools/spireLab.js');
  const lab = ['look.drawSky(', 'look.paintSky(', 'look.drawUnder(', 'look.drawAir(', 'telegraph.draw(sh,', 'look.drawOver(', 'look.drawLights('].map((k) => L.indexOf(k));
  assert.ok(lab.every((v, i) => v > 0 && (i === 0 || v > lab[i - 1])), `the lab's order: ${lab.join(', ')}`);
  assert.match(L, /const REDUCED = params\.has\('reduced'\);/);
});

/** Bytes a call `fn` allocates in source files matching `files`, by V8's sampling heap profiler over `n` calls. */
async function sampledBytes(fn, n, files) {
  for (let k = 0; k < 20000; k++) fn();   // the JIT warm (an unoptimized frame boxes every number it touches)
  const S = new Session();
  S.connect();
  await S.post('HeapProfiler.enable');
  await S.post('HeapProfiler.startSampling', { samplingInterval: 128, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  for (let k = 0; k < n; k++) fn();
  const { profile } = await S.post('HeapProfiler.stopSampling');
  await S.post('HeapProfiler.disable');
  S.disconnect();
  let bytes = 0;
  const walk = (node) => { if (files.some((f) => node.callFrame.url.endsWith(f))) bytes += node.selfSize; for (const c of node.children ?? []) walk(c); };
  walk(profile.head);
  return bytes / n;
}

test('EG-LOOK NOTHING A FRAME (Elite-Gates.md section 11.9; AUDIT EG V L6-4): a Spire frame of the look - the sky\'s paint and fetch, the mist and the rims\' sheets, the motes and the halos - makes no list, slot, array or closure in the look, the air, the sky or their passes: what V8\'s sampling heap profiler finds there over 3,000 frames is the few numbers handed to GL (a double passed to a call is boxed, 16 B - the Hour\'s own measure says so), under 160 bytes a frame where a frame\'s halo slots alone would be kilobytes (mutants: the halos\' slots made a frame; the rims\' sheets made a frame; the floors written a frame)', async () => {
  // a WebGL2 of plain fixed answers, one object (a Proxy, or a second GL, would make every call site megamorphic and box
  // every number - the harness's cost, not the look's)
  const OBJ = {}, gl = { drawingBufferWidth: 1280, drawingBufferHeight: 720 };
  for (const k of ['createProgram', 'createShader', 'shaderSource', 'compileShader', 'attachShader', 'linkProgram', 'getProgramInfoLog', 'getShaderInfoLog', 'deleteShader', 'detachShader', 'getUniformLocation', 'createVertexArray', 'bindVertexArray', 'createBuffer', 'bindBuffer', 'bufferData', 'bufferSubData', 'enableVertexAttribArray', 'vertexAttribPointer', 'createTexture', 'bindTexture', 'texImage2D', 'texParameteri', 'createFramebuffer', 'bindFramebuffer', 'framebufferTexture2D', 'viewport', 'useProgram', 'uniform1f', 'uniform1i', 'uniform2fv', 'uniform3f', 'uniform3fv', 'uniform4f', 'uniform4fv', 'uniformMatrix4fv', 'enable', 'disable', 'depthMask', 'depthFunc', 'blendFunc', 'blendFuncSeparate', 'drawArrays', 'activeTexture', 'deleteProgram', 'deleteBuffer', 'deleteVertexArray', 'deleteTexture', 'deleteFramebuffer', 'pixelStorei']) gl[k] = () => OBJ;
  gl.getProgramParameter = () => true; gl.getShaderParameter = () => true;
  for (const k of ['BLEND', 'DEPTH_TEST', 'CULL_FACE', 'ONE', 'ONE_MINUS_SRC_ALPHA', 'ZERO', 'LEQUAL', 'LESS', 'TRIANGLES', 'TRIANGLE_STRIP', 'POINTS', 'ARRAY_BUFFER', 'STATIC_DRAW', 'DYNAMIC_DRAW', 'FLOAT', 'TEXTURE_2D', 'TEXTURE0', 'FRAMEBUFFER', 'COLOR_ATTACHMENT0', 'RGBA8', 'RGBA', 'UNSIGNED_BYTE', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'NEAREST', 'CLAMP_TO_EDGE', 'LINEAR', 'VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS']) gl[k] = 1;
  const L = createEgLookDraw({ gl: /** @type {any} */ (gl), lite: false });
  L.setCircle(7, 6, 0);   // the Cairn: its rim sheets too
  const spec = egCircleSpecs(7, 6, 0)[0], eye = egToDungeon(spec, 0, 1.7, 0), fog = { mode: 2, density: 0.0075, range: new Float32Array([0, 1]), camPos: new Float32Array(3), color: new Float32Array([0.035, 0.0315, 0.049]) };
  const vp = [0, 0, 1280, 720], lights = [{ k: EG_LIGHT_KIND.beam, x: eye[0], y: eye[1], z: eye[2] + 20, h: 48, w: 1.4, r: 0, c: [1, 0.78, 0.4], a: 1, f: 0 }];
  const secs = Array.from({ length: 4000 }, (_, k) => 1000 + k / 60);
  let i = 0;
  const frame = () => { const ts = secs[(i++) % secs.length]; L.drawSky(I, I, ts, fog, 0.35); L.paintSky(vp, true, ts); L.drawUnder(I, I, eye, ts, fog); L.drawAir(I, I, eye, ts, fog, true, false, lights, 720); };
  frame();
  assert.ok(L.airState().rims > 0 && L.airState().halos > 1 && L.airState().drawn > 0, 'the whole air drew');
  const bytes = await sampledBytes(frame, 3000, ['scenes/eliteGates/egLookDraw.js', 'render/eliteGates/egMotes.js', 'render/eliteGates/egSkyMap.js', 'render/eliteGates/egSkyPass.js', 'render/superDungeon/sdHalo.js', 'render/eliteGates/egMistPass.js']);
  assert.ok(bytes < 160, `the look's frame allocates ${bytes.toFixed(1)} bytes`);
});
