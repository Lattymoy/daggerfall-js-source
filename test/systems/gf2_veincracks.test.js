// GATHER-FEEL II - VEIN-CRACKS (2026-10-13, Mac: "Do the not done" - GATHER-FEEL's open "the vein's crack decals and shed
// chunks (5.2) are still unbuilt"; bible/06-Systems/Professions-Arc.md 5.2's Mining row and section 45): A WORKED VEIN
// CRACKS AND SHEDS ITS CHUNKS. The batch's field and the crack's law on the shader's own code (test/glsl.mjs - whole at
// nought, only ever opening, the heart first, a seam's shade); both billboard programs composing it and the renderer
// sending it a batch at a time; the chunks' law (the struck face, the arc, the floor, the lie and the sink, the box); and
// the host over the real kinds (scenes/gatherHost.js) - the worked vein's flats a batch of their own, cracked to the share
// worked as each blow lands, closed by Escape and a refusal, gone with the vein; its chunks a dynamic batch of its own
// picture on the pixel's list, moved every frame and freed; the breaking blow's the most; a dungeon's vein through the
// dungeon's own doors.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glslFunctions } from '../glsl.mjs';
import { FLAT_CRACK_GLSL, VEIN_CRACK_CELL, VEIN_CRACK_SHADE, VEIN_CRACK_ORDER, setBatchCrack, crackSeedOf } from '../../src/systems/veinCrack.js';
import { VEIN_CHUNKS, chunksFor, shedChunks, stepChunk, chunkSink, chunkBox } from '../../src/systems/gatherBlow.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { EL_LANE, EL_BB_FS } from '../../src/render/enhancedLighting.js';
import { perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';
import { mineFlats, mineRecord, mineWash, ORE_DYE, ORE_FLAT_ARCHIVE, standDungeonVeins } from '../../src/scenes/mineHost.js';
import { MINE_ACT } from '../../src/net/professionLaw.js';
import { utcDayOfMs } from '../../src/net/nodeLaw.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { PX, WOODS, GLENUMBRA, NOON, DEEP_DUNGEON, rig, arrive, lands, sfxOf, tick, dice } from '../gatherRig.mjs';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

test('GF2-VEINCRACKS V1: the batch\'s field - a share worked and its seed, written in place; nought or none whole; past one held at one; a node\'s seed its own, the same every blow (mutants: a share past one kept, the field reallocated a blow)', () => {
  const b = {};
  setBatchCrack(b, 0.25, 0.4);
  assert.deepEqual(b.crack, [0.25, 0.4]);
  const field = b.crack;
  setBatchCrack(b, 0.5, 1.4);
  assert.equal(b.crack, field, 'in place');
  assert.deepEqual(b.crack, [0.5, 0.3999999999999999], 'the seed its fraction');
  setBatchCrack(b, 3, 0.4);
  assert.equal(b.crack[0], 1, 'held at one');
  for (const s of [0, -1, NaN, undefined]) { setBatchCrack(b, 0.5, 0.1); setBatchCrack(b, s); assert.equal(b.crack, null, `${s}: whole`); }
  setBatchCrack(null, 0.5);   // no batch, nothing
  const k = 'vein:405:150:20500:3';
  assert.equal(crackSeedOf(k), crackSeedOf(k));
  assert.ok(crackSeedOf(k) >= 0 && crackSeedOf(k) < 1);
  assert.notEqual(crackSeedOf(k), crackSeedOf('vein:405:150:20500:4'), 'two veins, two patterns');
});

/** The crack's own GLSL, run (test/glsl.mjs) over a 32x24 picture's texel centres at `share` and `seed`: each texel's shade. */
function crackField(share, seed, { w = 32, h = 24 } = {}) {
  const f = glslFunctions(`uniform sampler2D uTex;\nuniform vec2 uCrack;\n${FLAT_CRACK_GLSL}`, { uCrack: [share, seed], textureSize: () => [w, h] }, { fp32: true });
  const out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push({ x, y, u: (x + 0.5) / w, v: (y + 0.5) / h, k: f.veinCrackShade([(x + 0.5) / w, (y + 0.5) / h]) });
  return out;
}

test('GF2-VEINCRACKS V2: the crack\'s law, on the shader\'s own code - whole at nought; it only ever opens as the share grows; the heart first (no seam opens farther from the middle than the share reaches); a seam takes the texel down to its shade and no further; a vein a blow from breaking broken into fragments, never all seam; the seed its own pattern (mutants: the heart\'s weight, the cell, the shade, the seam\'s width, the early out)', () => {
  const shade = Math.fround(VEIN_CRACK_SHADE);
  const whole = crackField(0, 0.3);
  assert.ok(whole.every((t) => t.k === 1), 'whole at nought');
  const shares = [0.15, 0.25, 0.5, 0.75, 1];
  for (const seed of [0.13, 0.61, 0.87]) {
    const fields = shares.map((s) => crackField(s, seed));
    for (const f of fields) assert.ok(f.every((t) => t.k === 1 || t.k === shade), 'a seam is its shade, the rest whole');
    for (let i = 1; i < fields.length; i++) {
      for (let j = 0; j < fields[i].length; j++) if (fields[i - 1][j].k === shade) assert.equal(fields[i][j].k, shade, `seed ${seed}: open at ${shares[i - 1]}, open at ${shares[i]}`);
    }
    // the heart first: a seam opens at a share no smaller than its distance from the middle's weight
    for (let i = 0; i < shares.length; i++) {
      const reach = shares[i] / (VEIN_CRACK_ORDER.heart * 1.6);
      for (const t of fields[i]) if (t.k === shade) assert.ok(Math.hypot(t.u - 0.5, t.v - 0.5) <= reach + 1e-6, `seed ${seed} at ${shares[i]}: (${t.x}, ${t.y}) past the heart's reach`);
    }
    const open = (f) => f.filter((t) => t.k === shade).length / f.length;
    assert.ok(open(fields[1]) > 0 && open(fields[1]) < 0.06, `seed ${seed}: the first blow's crack a star at the middle (${open(fields[1])})`);
    assert.ok(open(fields[3]) > 0.1 && open(fields[3]) < 0.4, `seed ${seed}: a blow from breaking, in fragments (${open(fields[3])})`);
  }
  const a = crackField(0.75, 0.13).map((t) => t.k).join(''), b = crackField(0.75, 0.61).map((t) => t.k).join('');
  assert.notEqual(a, b, 'two seeds, two patterns');
  // a seam is narrow: even crazed through at one, most of the face is the ore's own (fragments, never a wash of seams)
  for (const seed of [0.13, 0.61, 0.87, 0.4]) {
    const f = crackField(1, seed);
    const share = f.filter((t) => t.k === shade).length / f.length;
    assert.ok(share > 0.15 && share < 0.45, `seed ${seed}: crazed through, in fragments (${share})`);
  }
  assert.equal(VEIN_CRACK_CELL, 7);
  assert.match(FLAT_CRACK_GLSL, /if \(uCrack\.x <= 0\.0\) return 1\.0;/, 'a whole flat pays nothing past one compare');
});

const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 1.6, 0.1, 400));
const VIEW = lookAt([0, 1.7, 9], [0, 1.2, -4], [0, 1, 0]);
const R = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
/** A fake GL that keeps a driver's uniforms a program and snapshots, at every draw, the bound program's uCrack and the
 *  texture on unit 0 (test/render/la_cost.test.js stateGl's shape). */
function stateGl() {
  let ids = 0, cur = null, active = 33984;
  const units = new Map(), draws = [];
  const consts = { TEXTURE0: 33984, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866, drawingBufferWidth: 320, drawingBufferHeight: 200 };
  for (let u = 1; u < 32; u++) consts[`TEXTURE${u}`] = 33984 + u;
  const declares = (p, name) => (p?.shaders ?? []).some((s) => new RegExp(`^\\s*uniform\\b[^;]*\\b${name}\\b`, 'm').test(s.src ?? ''));
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      switch (k) {
        case 'getProgramParameter': case 'getShaderParameter': return () => true;
        case 'getAttribLocation': return () => 0;
        case 'getParameter': return () => new Float32Array(4);
        case 'shaderSource': return (sh, s) => { sh.src = s; };
        case 'attachShader': return (p, sh) => { (p.shaders ??= []).push(sh); };
        case 'getUniformLocation': return (p, n) => (declares(p, n) ? n : null);
        case 'useProgram': return (p) => { cur = p; };
        case 'activeTexture': return (u) => { active = u; };
        case 'bindTexture': return (target, t) => { if (!units.has(active)) units.set(active, new Map()); units.get(active).set(target, t); };
        case 'drawElements': case 'drawArrays': return () => draws.push({ crack: cur?.u.get('uCrack') ?? null, tex: units.get(33984)?.get(3553)?.id ?? null });
        default:
          if (typeof k !== 'string') return undefined;
          if (k.startsWith('create')) return () => ({ id: ++ids, u: new Map() });
          if (k.startsWith('uniform')) return (loc, ...args) => { if (loc != null && cur) cur.u.set(loc, JSON.stringify(args)); };
          if (k.toUpperCase() === k) return 1;
          return () => {};
      }
    },
  });
  return { draws, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

test('GF2-VEINCRACKS V3: both billboard programs compose the crack - its uniform declared beside the burn\'s, its block after the burn\'s, the albedo taken down by it before the light - and the renderer sends it a batch at a time: a cracked vein\'s draw reads its share and seed, every other draw whole, on the classic program and the lane\'s; the batch is born with the field (mutants: the send dropped, the reset dropped, the lane\'s hook missed)', () => {
  const r = src('src/render/renderer.js');
  const bb = r.slice(r.indexOf('const BB_FS = `'), r.indexOf('// Dungeon water: one horizontal quad'));
  for (const [name, fs] of [['classic', bb], ['lane', EL_BB_FS]]) assert.match(fs, /uniform vec2 uCrack;/, `${name}: declared`);
  assert.match(bb, /\$\{FLAT_DISSOLVE_GLSL\}\n\$\{FLAT_CRACK_GLSL\}\n/, 'classic: its block after the burn\'s');
  assert.ok(EL_BB_FS.indexOf(FLAT_CRACK_GLSL) > EL_BB_FS.indexOf('float dissolveGrain('), 'the lane: its block after the burn\'s');
  assert.match(bb, /vec3 albedo = max\(tex\.rgb - emission, vec3\(0\.0\)\) \* veinCrackShade\(uv\);/, 'classic: the albedo, before the light');
  // PIN MOVED (AUDIT GATHER-FEEL V4): the shade is of the display's colour - taken there, then decoded into the lane's light
  assert.match(EL_BB_FS, /vec3 albedo = max\(elDecode\(tex\.rgb \* veinCrackShade\(uv\)\) - emission, vec3\(0\.0\)\);/, 'the lane: the same law, in its linear light');
  assert.ok(EL_BB_FS.includes(FLAT_CRACK_GLSL), 'the lane composes the one block');
  for (const lane of [null, EL_LANE]) {
    const { draws, canvas } = stateGl();
    const ren = new Renderer(canvas);
    if (lane) ren.setLightingLane(lane);
    ren.textures.set('254_63', { id: 'iron' });
    ren.textures.set('254_66', { id: 'lode' });
    const worked = ren.createBillboardBatch(254, 63, { w: 1, h: 1 }, [[0, 0, -3]]);
    const whole = ren.createBillboardBatch(254, 66, { w: 1, h: 1 }, [[1, 0, -3]]);
    assert.ok('crack' in worked && worked.crack === undefined, 'born with the field');
    setBatchCrack(worked, 0.5, 0.25);
    ren.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    draws.length = 0;
    ren.drawBillboards([worked, whole], R, UP);
    ren.drawBillboards([whole], R, UP);
    const by = (tex) => draws.filter((d) => d.tex === tex).map((d) => d.crack);
    assert.deepEqual(by('iron'), ['[0.5,0.25]'], `${lane ? 'lane' : 'classic'}: the worked vein's share and seed`);
    assert.deepEqual(by('lode'), ['[0,0]', '[0,0]'], `${lane ? 'lane' : 'classic'}: every other flat whole, the next call too`);
    // a frame that ends on the worked vein leaves its seams in the program: the next frame's first flat is whole all the same
    ren.drawBillboards([worked], R, UP);
    ren.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    draws.length = 0;
    ren.drawBillboards([whole], R, UP);
    assert.deepEqual(draws.map((d) => d.crack), ['[0,0]'], `${lane ? 'lane' : 'classic'}: the frame begins whole`);
    setBatchCrack(worked, 0);
    ren.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    draws.length = 0;
    ren.drawBillboards([worked], R, UP);
    assert.deepEqual(draws.map((d) => d.crack), ['[0,0]'], 'closed: whole again');
  }
});

test('GF2-VEINCRACKS V4: the chunks\' law - a blow sheds three, one on the glint five, the breaking blow seven; out of the struck face toward the striker and up, within its spread; the arc exactly the step\'s own at any frame rate; down on the floor, lying, sinking away and gone; the box holds every place a chunk of the burst can be (mutants: the face away from the striker, gravity unscaled by the step, the floor passed through, the sink never, the box too small)', () => {
  assert.deepEqual([chunksFor(false, false), chunksFor(false, true), chunksFor(true, false), chunksFor(true, true)], [VEIN_CHUNKS.plain, VEIN_CHUNKS.clean, VEIN_CHUNKS.last, VEIN_CHUNKS.last]);
  assert.deepEqual([VEIN_CHUNKS.plain, VEIN_CHUNKS.clean, VEIN_CHUNKS.last], [3, 5, 7]);
  const at = [10, 1, 20], eye = [10, 1.6, 23];   // the striker 3 m along +z
  const C = VEIN_CHUNKS;
  for (const r of [dice(0), dice(0.999), dice(0.1, 0.9, 0.5, 0.3, 0.7, 0.2)]) {
    const cs = shedChunks(at, eye, 5, r);
    assert.equal(cs.length, 5);
    for (const c of cs) {
      assert.ok(c.p[2] - at[2] >= C.face - 1e-9 && c.p[2] - at[2] <= C.face + 1e-9, 'on the face toward the striker');
      assert.ok(Math.abs(c.p[0] - at[0]) <= C.spread + 1e-9 && Math.abs(c.p[1] - at[1]) <= C.spread + 1e-9, 'within its spread');
      assert.ok(c.v[2] >= C.out[0] - 1e-9 && c.v[2] <= C.out[1] + 1e-9, 'toward the striker');
      assert.ok(c.v[1] >= C.up[0] - 1e-9 && c.v[1] <= C.up[1] + 1e-9 && Math.abs(c.v[0]) <= C.side + 1e-9, 'up, and across within its side');
      assert.deepEqual([c.t, c.rest], [0, -1]);
    }
  }
  // the arc at any frame rate: the same place after the same time, in one step or sixty
  // PIN MOVED (AUDIT GATHER-FEEL V3): the ground a chunk comes down on is its own, found as it is shed - handed to shedChunks
  const one = shedChunks(at, eye, 1, dice(0.5), -100)[0], many = shedChunks(at, eye, 1, dice(0.5), -100)[0];
  stepChunk(one, 0.3);
  for (let i = 0; i < 60; i++) stepChunk(many, 0.005);
  for (let k = 0; k < 3; k++) assert.ok(near(one.p[k], many.p[k], 1e-9), `axis ${k}: ${one.p[k]} ${many.p[k]}`);
  const fresh = shedChunks(at, eye, 1, dice(0.5))[0];
  assert.ok(near(one.p[1], fresh.p[1] + fresh.v[1] * 0.3 - 0.5 * C.gravity * 0.09, 1e-9), 'p + v t - g t^2 / 2');
  assert.ok(near(one.p[2], fresh.p[2] + fresh.v[2] * 0.3, 1e-9), 'and across at its own speed');
  // the landing at any frame rate: the same place on the ground in steps of a thirtieth, a two-hundred-fortieth or one hitch
  const landAt = (dt) => { const ch = shedChunks(at, eye, 1, dice(0.3, 0.8, 0.6, 0.9, 0.2), 0)[0]; while (ch.rest < 0) stepChunk(ch, dt); return ch.p; };
  const [a30, a240, hitch] = [landAt(1 / 30), landAt(1 / 240), landAt(0.4)];
  for (let k = 0; k < 3; k++) assert.ok(near(a30[k], a240[k], 1e-9) && near(a30[k], hitch[k], 1e-9), `axis ${k}: ${a30[k]} ${a240[k]} ${hitch[k]}`);
  // down on the floor, lying, sinking, gone
  const floor = 0;
  const c = shedChunks(at, eye, 1, dice(0.5), floor)[0];
  let t = 0;
  while (c.rest < 0 && t < 3) { stepChunk(c, 1 / 60); t += 1 / 60; }
  assert.equal(c.p[1], floor, 'on the floor, never through it');
  assert.ok(t < C.flyMaxS, 'it fell before its time ran out');
  const r0 = c.rest;
  assert.ok(r0 >= 0 && r0 < 1 / 60, 'the rest of its landing step, lain');
  const lay = [c.p[0], c.p[2]];
  for (let i = 0; i < 10; i++) assert.equal(stepChunk(c, (C.restS - r0) / 10), true);
  assert.deepEqual([c.p[0], c.p[2]], lay, 'it lies where it fell');
  assert.equal(chunkSink(c, 0.2), 0, 'not sunk while it rests');
  stepChunk(c, C.sinkS / 2);
  assert.ok(near(chunkSink(c, 0.2), 0.1, 1e-9), 'half sunk half way');
  assert.equal(stepChunk(c, C.sinkS), false, 'gone');
  // the box: every place of every chunk of many bursts, sunk ones too
  const h = 0.2;
  const box = chunkBox(at, floor, h);
  const rolls = [dice(0.999999), dice(0), dice(0.999999, 0.999999, 0.999999, 0, 0.999999)];   // the farthest a chunk can go, each way
  for (let s = 0; s < 40; s++) rolls.push(dice(...Array.from({ length: 7 }, (_, i) => ((s * 7 + i) * 0.6180339887) % 1)));
  let farthest = 0;
  for (let s = 0; s < rolls.length; s++) {
    const r = rolls[s];
    for (const ch of shedChunks(at, [at[0] + Math.sin(s), at[1] + 0.6, at[2] + Math.cos(s)], 7, r, floor)) {
      for (let i = 0; i < 400 && stepChunk(ch, 1 / 120); i++) {
        const y = ch.p[1] - chunkSink(ch, h);
        assert.ok(ch.p[0] >= box[0] && ch.p[0] <= box[3] && ch.p[2] >= box[2] && ch.p[2] <= box[5] && y >= box[1] && y + h <= box[4], `burst ${s}: a chunk outside its box`);
        farthest = Math.max(farthest, Math.hypot(ch.p[0] - at[0], ch.p[2] - at[2]));
      }
    }
  }
  assert.ok(farthest > (box[3] - at[0]) * 0.8, `the box no looser than the farthest chunk needs (${farthest} of ${box[3] - at[0]})`);
});

/** A renderer that keeps every batch it was asked for: its look, its centres, whether it moves (a chunks' batch), its
 *  moves, and whether it was freed. */
function keepingRenderer() {
  const made = [];
  return {
    made,
    createBillboardBatch: (archive, record, size, centers, o) => { const b = { archive, record, size, centers: centers.map((c) => [...c]), dynamic: !!o?.dynamic, destroyed: false, moves: 0, at: null }; made.push(b); return b; },
    destroyBatch: (b) => { b.destroyed = true; },
    moveBillboardBatch: (b, centers) => { b.moves++; b.at = centers.map((c) => [...c]); return true; },
  };
}
const sameCenters = (a, b) => a.length === b.length && a.every((c, i) => c.every((v, k) => near(v, b[i][k], 1e-9)));
/** The live batch that stands exactly a node's flats - its own (worked), or null where it shares one. */
const ownBatch = (list, n) => list.find((b) => !b.dynamic && !b.destroyed && sameCenters(b.centers, mineFlats(n))) ?? null;
/** Press at a vein, then turn the look ten degrees off its face's points: every strike plain (no glint within reach). */
async function workPlain(t, v) {
  await arrive(t, v);
  t.face(v);
  t.host.tick(0.016);
  assert.equal(t.host.press(), true);
  for (let i = 0; i < 4; i++) await tick();   // its pixel stood again: the worked vein apart
  t.view.yaw += 10;
}
/** One strike: its press, its blow landed, and the rest of its swing run out (a press while it swings counts nothing). */
function strike(t) {
  t.input.v = { held: false, attack: true, choice: false };
  t.host.tick(0.001);
  t.input.v = { held: false, attack: false, choice: false };
  t.host.tick(lands + 0.01);
  t.host.tick(MINE_ACT.swingS - lands);
}

test('GF2-VEINCRACKS V5: through the host - a worked vein\'s flats stand apart as its act begins (its twin of the same picture keeps the shared batch), cracked to the share worked as each blow lands and never at the press; the twin stays whole; Escape closes them and the vein stands; worked again it begins whole; the breaking blow takes it down, cracks and all (mutants: the worked vein left in the shared batch, the crack at the press, the share unread, Escape leaving them open)', async () => {
  try {
    const r = keepingRenderer();
    const t = await rig({ renderer: r, ranks: { mining: 10 }, extra: { rand: dice(0.1, 0.9, 0.5, 0.3, 0.7) } });   // Mining 10: a tier-2 lodestone vein's own
    const lode = t.host.nodesOf(PX, 150).filter((n) => n.what === 'vein' && n.material === 'metal:lodestone');
    assert.equal(lode.length, 2, 'two lodestone veins: one picture, one wash');
    const [v, twin] = lode;
    assert.equal(ownBatch(t.entry.batches, v), null, 'before its act, it shares its batch with its twin');
    const shared = t.entry.batches.find((b) => !b.dynamic && b.centers.length === 6 && mineFlats(v).every((c) => b.centers.some((d) => sameCenters([c], [d]))));
    assert.ok(shared, 'the twins\' one batch');
    await workPlain(t, v);
    const own = ownBatch(t.entry.batches, v);
    assert.ok(own, 'its own batch as its act begins');
    assert.ok(!own.crack, 'whole before a blow lands');
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
    t.input.v = { held: false, attack: false, choice: false };
    assert.ok(!ownBatch(t.entry.batches, v).crack, 'not at the press');
    t.host.tick(lands + 0.01);
    assert.ok(!t.audio.shots.some((s) => sfxOf(s.key) === 'pickGlint'), 'every strike plain');
    assert.deepEqual(ownBatch(t.entry.batches, v).crack, [0.25, crackSeedOf(v.key)], 'a quarter worked, its own pattern');
    t.host.tick(MINE_ACT.swingS - lands);   // the swing runs out
    strike(t);
    assert.deepEqual(ownBatch(t.entry.batches, v).crack, [0.5, crackSeedOf(v.key)], 'half');
    const twinBatches = t.entry.batches.filter((b) => !b.dynamic && !b.destroyed && b.centers.some((c) => mineFlats(twin).some((d) => sameCenters([c], [d]))));
    assert.ok(twinBatches.length && twinBatches.every((b) => !b.crack), 'the twin whole');
    // Escape: the cracks close, the vein stands
    const drawn = t.centers();
    assert.equal(t.host.cancel(), true);
    assert.equal(ownBatch(t.entry.batches, v).crack, null, 'closed over');
    assert.equal(t.centers(), drawn, 'standing');
    // worked again: whole until a blow lands, then on from a quarter
    await workPlain(t, v);
    assert.ok(!ownBatch(t.entry.batches, v).crack, 'whole again');
    strike(t); strike(t); strike(t);
    assert.deepEqual(ownBatch(t.entry.batches, v).crack, [0.75, crackSeedOf(v.key)], 'three quarters');
    // the breaking blow: the act ends on its press, the vein goes as it lands
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
    t.input.v = { held: false, attack: false, choice: false };
    assert.equal(t.host.acting(), false, 'worked out on the press');
    t.host.tick(lands + 0.01);
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(ownBatch(t.entry.batches, v), null, 'gone');
    assert.ok(t.entry.batches.every((b) => !b.crack), 'no cracked batch left standing');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('GF2-VEINCRACKS V6: through the host - each landed blow sheds its chunks as a batch of the vein\'s own picture (its ore, its wash and colour, no shadow) on the pixel\'s list, out of the face toward the striker, moved every frame, down to the ground, and freed once they have lain and sunk; nothing at the press or for a blow Escape took; the breaking blow sheds the most; a pixel torn down takes its chunks with it, and the host lets them go at dispose (mutants: the chunks never moved, never freed, the wash dropped, the breaking blow\'s count, a torn-down pixel\'s chunks moved on)', async () => {
  try {
    const r = keepingRenderer();
    const t = await rig({ renderer: r, ranks: { mining: 10 }, extra: { rand: dice(0.1, 0.9, 0.5, 0.3, 0.7) } });   // Mining 10: a tier-2 lodestone vein's own
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.material === 'metal:lodestone');
    await workPlain(t, v);
    const chunks = () => t.entry.batches.filter((b) => b.dynamic);
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
    t.input.v = { held: false, attack: false, choice: false };
    for (let i = 0; i < 2; i++) await tick();
    assert.equal(chunks().length, 0, 'nothing at the press');
    t.host.tick(lands + 0.01);
    for (let i = 0; i < 2; i++) await tick();
    const [b] = chunks();
    assert.ok(b, 'a burst on the pixel\'s list');
    assert.deepEqual([b.archive, b.record, b.centers.length], [ORE_FLAT_ARCHIVE, mineRecord(v), VEIN_CHUNKS.plain], 'the vein\'s own picture, a plain blow\'s three');
    assert.deepEqual([b.tint, b.dye, b.noShadow], [mineWash(v), ORE_DYE, true], 'its wash, its colour, no shadow');
    assert.ok(near(b.size.h, 0.3 * VEIN_CHUNKS.scale) && near(b.size.w, 0.3 * VEIN_CHUNKS.scale), 'small: of the picture\'s own size');
    const mid = [v.local[0], v.local[1] + v.lift, v.local[2]];
    for (const c of b.centers) assert.ok(Math.hypot(c[0] - mid[0], c[2] - mid[2]) <= VEIN_CHUNKS.face + 2 * VEIN_CHUNKS.spread + 1e-9, 'out of the face');
    const start = b.centers.map((c) => Math.hypot(c[0] - t.feet[0], c[2] - t.feet[2]));
    t.host.tick(0.1);
    assert.ok(b.moves > 0, 'moved every frame');
    b.at.forEach((c, i) => assert.ok(Math.hypot(c[0] - t.feet[0], c[2] - t.feet[2]) < start[i], 'toward the striker'));
    for (let i = 0; i < 20; i++) t.host.tick(0.05);
    assert.ok(b.at.every((c) => near(c[1], v.local[1], 1e-9)), 'down on the ground the vein stands on');
    for (let i = 0; i < 40 && !b.destroyed; i++) t.host.tick(0.05);
    assert.equal(b.destroyed, true, 'freed once lain and sunk');
    assert.ok(!t.entry.batches.includes(b), 'off the pixel\'s list');
    // Escape with a blow in the air: nothing sheds
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
    t.input.v = { held: false, attack: false, choice: false };
    t.host.cancel();
    t.host.tick(lands + 0.01);
    for (let i = 0; i < 2; i++) await tick();
    assert.equal(chunks().length, 0, 'a blow Escape took sheds nothing');
    // to its breaking blow: seven
    await workPlain(t, v);
    for (let i = 0; i < 3; i++) strike(t);
    for (let i = 0; i < 2; i++) await tick();
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
    t.input.v = { held: false, attack: false, choice: false };
    t.host.tick(lands + 0.01);
    for (let i = 0; i < 4; i++) await tick();
    assert.ok(chunks().some((c) => c.centers.length === VEIN_CHUNKS.last), 'the breaking blow\'s seven');
    // a pixel torn down: its chunks go with its batches (its teardown frees them), never moved on by the host
    const live = chunks();
    const moves = live.map((c) => c.moves);
    t.host.onDestroyed(t.entry);
    t.host.tick(0.05);
    assert.deepEqual(live.map((c) => c.moves), moves, 'never moved again');
    assert.ok(live.every((c) => !c.destroyed), 'freed by the teardown, not twice');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('GF2-VEINCRACKS V7: a harvest refused before the breaking blow lands - the cracks close, the vein stands, and that blow sheds a blow\'s chunks, not the breaking seven; the host lets every burst go at dispose (mutants: a refusal leaving the cracks open, the breaking count on a vein that stands)', async () => {
  try {
    const r = keepingRenderer();
    const t = await rig({ renderer: r, ranks: { mining: 10 }, extra: { rand: dice(0.1, 0.9, 0.5, 0.3, 0.7) } });   // Mining 10: a tier-2 lodestone vein's own
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.material === 'metal:lodestone');
    await workPlain(t, v);
    for (let i = 0; i < 3; i++) strike(t);
    assert.deepEqual(ownBatch(t.entry.batches, v).crack, [0.75, crackSeedOf(v.key)]);
    t.input.v = { held: false, attack: true, choice: false };
    t.host.tick(0.001);
    t.input.v = { held: false, attack: false, choice: false };
    assert.equal(t.host.acting(), false);
    t.gate.answers.shift()({ ok: false, error: 'prof-cap' });
    for (let i = 0; i < 6; i++) await tick();
    const own = ownBatch(t.entry.batches, v);
    assert.ok(own && !own.crack, 'refused: whole');
    const before = t.entry.batches.filter((b) => b.dynamic).length;
    t.host.tick(lands + 0.01);
    for (let i = 0; i < 4; i++) await tick();
    assert.ok(ownBatch(t.entry.batches, v), 'it stands');
    const last = t.entry.batches.filter((b) => b.dynamic).slice(before);
    assert.deepEqual(last.map((b) => b.centers.length), [VEIN_CHUNKS.plain], 'a blow\'s three, not the breaking seven');
    const all = t.entry.batches.filter((b) => b.dynamic);
    t.host.dispose();
    assert.ok(all.every((b) => b.destroyed), 'let go at dispose');
  } finally { setForagingHost(null); }
});

test('GF2-VEINCRACKS V8: a dungeon\'s vein - already its own batch, cracked as its blows land; its chunks stood through the dungeon\'s own door as a moving batch, to the floor it stands on at its wall\'s foot, and dropped through it; the dungeon left takes them; the dungeon stands it on that floor (MINE-PERKS, PROF_VEIN_UP_M 0 - lifted, its chunks would fall to its foot in the air) (mutants: the dungeon\'s crack unheld, its chunks static, the vein lifted off its floor)', async () => {
  try {
    const r = keepingRenderer();
    let under = false;
    const t = await rig({ renderer: r, ranks: { mining: 25 }, extra: { rand: dice(0.1, 0.9, 0.5, 0.3, 0.7), activeDungeon: () => under } });   // Mining 25: a deep vein is tier 3
    const stood = [], dropped = [];
    const wall = (m, b) => [6 + m * 9, 0, 4 + b];
    t.host.enterDungeon({
      id: DEEP_DUNGEON, climate: WOODS, region: GLENUMBRA, wall,
      stand: async (a, rec, s, c, o) => { const b = r.createBillboardBatch(a, rec, { w: 0.3 * s, h: 0.3 * s }, c, o); stood.push(b); return b; },
      drop: (b) => { dropped.push(b); b.destroyed = true; },
    });
    under = true;
    for (let i = 0; i < 8; i++) await tick();
    const day = utcDayOfMs(NOON * 1000);
    const veins = standDungeonVeins({ dungeon: DEEP_DUNGEON, day, climate: WOODS, confirmed: false, wall });
    assert.ok(veins.length >= 1, 'the dungeon\'s veins');
    const v = veins[0];
    const own = stood.find((b) => !b.dynamic && sameCenters(b.centers, mineFlats(v)));
    assert.ok(own, 'its own batch');
    await arrive(t, v);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true, 'worked underground');
    t.view.yaw += 10;
    strike(t);
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(own.crack?.[0] > 0, true, 'cracked as its blow lands');
    const burst = stood.find((b) => b.dynamic);
    assert.ok(burst, 'its chunks through the dungeon\'s door, a moving batch');
    for (let i = 0; i < 20; i++) t.host.tick(0.05);
    assert.ok(burst.at.every((c) => near(c[1], v.local[1], 1e-9)), 'down to the floor it stands on');
    t.host.tick(0.05);
    for (let i = 0; i < 4; i++) await tick();
    // the dungeon left mid-flight: its chunks dropped through its door
    strike(t);
    for (let i = 0; i < 4; i++) await tick();
    const flying = stood.filter((b) => b.dynamic && !b.destroyed);
    assert.ok(flying.length >= 1);
    t.host.leaveDungeon();
    assert.ok(flying.every((b) => dropped.includes(b)), 'dropped with the dungeon');
    t.host.dispose();
    const dc = src('src/scenes/dungeonContext.js');
    assert.equal(Number(dc.match(/PROF_VEIN_UP_M = ([0-9.]+);/)?.[1]), 0, 'the dungeon stands its vein on its floor - its foot is the floor its chunks fall to');
    assert.match(dc, /async standProfFlats\(archive, record, scale, centers, \{ dynamic = false \} = \{\}\) \{/);
    assert.match(dc, /renderer\.createBillboardBatch\(archive, record, \{ w: base\.w \* scale, h: base\.h \* scale \}, centers, \{ dynamic \}\);/);
    assert.match(src('src/scenes/world.js'), /stand: \(a, r, s, c, o\) => ctx\.standProfFlats\(a, r, s, c, o\)/, 'the world hands the door its options');
    assert.ok(MINE_ACT.swingS > 0);
  } finally { setForagingHost(null); }
});
