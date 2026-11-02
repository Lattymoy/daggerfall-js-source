// STAR4 (bible/11-Multiplayer/Starfall.md section 3): THE STAR IN THE WORLD - its art painted in code under its own
// pseudo-archive, its crater and stone made on the land's own heights, the sky's pure path (the omen, the streak, the
// clamp about the eye, the ring of shock), its shaders' heads, and its sounds out of DAGGER.SND's own records.
// AUDIT STARFALL (2026-10-20): the rim's stones in its earth (R6), the ring on the land in its shader (R3), the pass's
// clamped beacon, the ring's ground and the fog's focus (R2, R3, R5), a cue its distance late (R7).
// tools/mutants/star4.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  starArt, STAR_ARCHIVE, STAR_ART_SIZE, STAR_RAMPS, STAR_EARTH_RECORD, STAR_RIM_RECORD, STAR_GLASS_RECORD, STAR_THREAD_RECORD,
  STAR_GOLD_RECORD, STAR_DARK_RECORD,
} from '../../../src/world/starfall/starArt.js';
import {
  buildStarModel, starLayout, rimAt, STAR_CRATER_R, STAR_RIM_OUT, STAR_RIM_H, STAR_FLOOR_LIFT, STAR_STONE_H, STAR_STONE_SINK,
  STAR_THREAD_H, STAR_SHARDS, STAR_RIM_STONES, STAR_THREADS, STAR_BARE_R, STAR_FLOOR_REACH,
} from '../../../src/world/starfall/starModel.js';
import {
  streakAt, omenAt, skyClamp, shockRingAt, STAR_SKY_R, STAR_FALL_FROM_M, STAR_FALL_ALT_M, STAR_OMEN_ALT_M, STAR_OMEN_W, STAR_RING_M,
  STAR_RING_MS, STAR_SKY_VS, STAR_SKY_FS, STAR_RING_VS, STAR_RING_FS, STAR_BEACON_COLOR, STAR_HELD_COLOR,
  StarfallPassRenderer, ringStrip, STAR_RING_SEGS, STAR_RING_WIDTH_M, STAR_RING_LIFT_M, STAR_BEACON_BELOW_M, STAR_BEACON_HEIGHT_M,
} from '../../../src/render/starfall/starfallPass.js';
import { BEACON_RADIUS_M } from '../../../src/render/gate/gatePass.js';
import { STAR_SOUNDS, playStarSound, starHeardAfterMs } from '../../../src/systems/starfall/starSounds.js';
import { thunderOf } from '../../../src/systems/distantStorms.js';
import { glslFunctions } from '../../glsl.mjs';
import { SOUND } from '../../../src/systems/soundClips.js';
import { PSEUDO_ARCHIVES, pseudoArchiveCollisions, pseudoArchiveOwner } from '../../../src/world/eliteGates/pseudoArchives.js';
import { STAR_VIOLET_CSS, STAR_GOLD_CSS } from '../../../src/ui/starfall/starMapMark.js';

const N = 493_210, K = 1;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A record's triangles out of a model: `[a, b, c, n]` (n the face's stored normal). */
function trisOf(m, rec) {
  const s = m.subMeshes.find((x) => x.textureRecord === rec);
  if (!s) return [];
  const out = [];
  for (let t = 0; t < s.primitiveCount; t++) {
    const v = (j) => { const i = m.indices[s.startIndex + t * 3 + j]; return [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]; };
    const i0 = m.indices[s.startIndex + t * 3];
    out.push([v(0), v(1), v(2), [m.normals[i0 * 3], m.normals[i0 * 3 + 1], m.normals[i0 * 3 + 2]]]);
  }
  return out;
}
/** Every texel's rgb of a picture. */
const texels = (img) => { const o = []; for (let i = 0; i < img.colors.length; i += 4) o.push([img.colors[i], img.colors[i + 1], img.colors[i + 2]]); return o; };
const lit = (px) => px.filter(([r, g, b]) => r + g + b > 0);

test('STAR4 THE ART: six records under the star\'s own pseudo-archive, each a 64-square pair - the floor\'s cracks lit violet, the rim and the thread no light of their own, the glass\'s veins violet, held gold, lost all but dark; made once (mutants: a record\'s glow, the cache)', () => {
  const art = starArt();
  assert.deepEqual(art.map(([r]) => r), [STAR_EARTH_RECORD, STAR_RIM_RECORD, STAR_GLASS_RECORD, STAR_THREAD_RECORD, STAR_GOLD_RECORD, STAR_DARK_RECORD]);
  assert.deepEqual(art.map(([r]) => r), [0, 1, 2, 3, 4, 5]);
  assert.equal(starArt(), art, 'made once');
  for (const [rec, a] of art) {
    for (const img of [a.albedo, a.emission]) {
      assert.equal(img.width, STAR_ART_SIZE, `record ${rec}`);
      assert.equal(img.height, STAR_ART_SIZE);
      assert.equal(img.colors.length, STAR_ART_SIZE * STAR_ART_SIZE * 4);
    }
    assert.ok(texels(a.albedo).every(([r, g, b]) => r + g + b > 0), `record ${rec}: no black hole in what it is`);
  }
  const glow = (rec) => lit(texels(art.find(([r]) => r === rec)[1].emission));
  const earth = glow(STAR_EARTH_RECORD);
  assert.ok(earth.length > 20 && earth.length < STAR_ART_SIZE * STAR_ART_SIZE / 2, 'the floor\'s cracks, and only they, glow');
  assert.ok(earth.every(([r, , b]) => b > r), 'violet');
  assert.equal(glow(STAR_RIM_RECORD).length, 0, 'the rim is earth');
  assert.equal(glow(STAR_THREAD_RECORD).length, 0, 'the thread is black');
  const glass = glow(STAR_GLASS_RECORD), gold = glow(STAR_GOLD_RECORD), dark = glow(STAR_DARK_RECORD);
  assert.ok(glass.length > 20 && glass.every(([r, , b]) => b > r), 'the glass\'s veins violet');
  assert.ok(gold.length > 20 && gold.every(([r, , b]) => r > b), 'held: gold');
  assert.ok(dark.length > 0 && dark.every(([r, g, b]) => Math.max(r, g, b) <= 38), 'lost: its light all but out');
  assert.ok(texels(art.find(([r]) => r === STAR_THREAD_RECORD)[1].albedo).every(([r, g, b]) => Math.max(r, g, b) <= 38), 'the thread black');
  // held to their palettes: every albedo texel one of its ramps' colours
  const pal = new Set([...STAR_RAMPS.glass, ...STAR_RAMPS.vein].map((c) => c.join()));
  assert.ok(texels(art.find(([r]) => r === STAR_GLASS_RECORD)[1].albedo).every((c) => pal.has(c.join())), 'the glass\'s own ramp');
});

test('STAR4 ITS ARCHIVE: 38301 is the star\'s alone in the pseudo-archives\' registry, and none collides (mutants: the number)', () => {
  assert.equal(STAR_ARCHIVE, 38301);
  const row = PSEUDO_ARCHIVES.find((r) => r.from === STAR_ARCHIVE);
  assert.ok(row, 'registered');
  assert.equal(pseudoArchiveOwner(STAR_ARCHIVE), row);
  assert.equal(row.owner, 'world/starfall/starArt.js');
  assert.equal(row.name, 'STAR_ARCHIVE');
  assert.deepEqual(pseudoArchiveCollisions(), []);
});

test('STAR4 THE CRATER\'S SHAPE: the rim rises from its foot to its crest at the crater\'s edge and falls away outside; nothing past it - the grass\'s bare reach is the rim\'s outer foot (mutants: the crest, the foot, the reach)', () => {
  assert.equal(rimAt(0), 0);
  assert.equal(rimAt(STAR_CRATER_R * 0.55), 0, 'nothing inside its foot');
  assert.equal(rimAt(STAR_CRATER_R), STAR_RIM_H, 'its crest at the crater\'s edge');
  assert.equal(rimAt(STAR_CRATER_R + STAR_RIM_OUT), 0);
  assert.equal(rimAt(50), 0);
  let last = 0;
  for (let r = STAR_CRATER_R * 0.55; r <= STAR_CRATER_R; r += 0.25) { assert.ok(rimAt(r) >= last); last = rimAt(r); }
  last = rimAt(STAR_CRATER_R);
  for (let r = STAR_CRATER_R; r <= STAR_CRATER_R + STAR_RIM_OUT; r += 0.25) { assert.ok(rimAt(r) <= last + 1e-12); last = rimAt(r); }
  assert.ok(Math.abs(rimAt(STAR_CRATER_R + STAR_RIM_OUT / 2) - STAR_RIM_H / 4) < 1e-12, 'halfway down its outer slope, a quarter of its crest');
  assert.equal(STAR_BARE_R, STAR_CRATER_R + STAR_RIM_OUT);
});

test('STAR4 THE LAYOUT: the star\'s own rolls - the heart\'s shard upright and tallest, the rest leaning out from it, the stones on the rim, three strands; the same star the same everywhere, another star its own (mutants: a roll, the heart\'s shard)', () => {
  const L = starLayout(N, K);
  assert.equal(L.shards.length, STAR_SHARDS);
  assert.deepEqual(L.shards[0].base, [0, 0]);
  assert.deepEqual(L.shards[0].lean, [0, 0]);
  assert.equal(L.shards[0].h, STAR_STONE_H);
  for (const s of L.shards.slice(1)) {
    assert.ok(s.h < STAR_STONE_H, 'shorter than the heart\'s');
    assert.ok(dot([s.base[0], 0, s.base[1]], [s.lean[0], 0, s.lean[1]]) > 0, 'leaning out from the heart');
  }
  assert.equal(L.stones.length, STAR_RIM_STONES);
  for (const st of L.stones) { const r = Math.hypot(st.x, st.z); assert.ok(r > STAR_CRATER_R - STAR_RIM_OUT && r < STAR_CRATER_R + STAR_RIM_OUT, 'on the rim'); }
  assert.equal(L.threads.length, STAR_THREADS);
  assert.deepEqual(starLayout(N, K), L, 'the same star, the same crater');
  assert.notDeepEqual(starLayout(N, K + 1), L, 'another star, its own');
});

test('STAR4 THE MODEL: sub-meshes by record (the floor, the rim, the glass, the thread), 32-bit indices, every normal a unit and its face\'s own; the floor faces up and lies on the land\'s own heights a hand over, the rim on it; the heart\'s shard wound outward, sunk into the earth, its tip at its height; the thread runs up into the dark (mutants: a winding, the drape, the lift, the sink, the thread\'s reach)', () => {
  const m = buildStarModel(N, K);
  assert.deepEqual(m.subMeshes.map((s) => s.textureRecord), [STAR_EARTH_RECORD, STAR_RIM_RECORD, STAR_GLASS_RECORD, STAR_THREAD_RECORD]);
  assert.ok(m.subMeshes.every((s) => s.textureArchive === STAR_ARCHIVE));
  assert.ok(m.indices instanceof Uint32Array);
  assert.equal(m.indices.length, m.positions.length / 3);
  assert.equal(m.uvs.length, m.positions.length / 3 * 2);
  let at = 0;
  for (const s of m.subMeshes) { assert.equal(s.startIndex, at); at += s.primitiveCount * 3; }
  assert.equal(at, m.indices.length);
  for (const rec of [0, 1, 2, 3]) {
    for (const [a, b, c, n] of trisOf(m, rec)) {
      assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-5, 'a unit normal');
      const f = cross(sub(b, a), sub(c, a));
      assert.ok(dot(f, n) > 0, 'its face\'s own way');
    }
  }
  // the floor on flat ground: faces up (level inside the rim's foot), a hand over it, the rim's earth over that
  for (const [a, b, c, n] of trisOf(m, STAR_EARTH_RECORD)) {
    assert.ok(n[1] > 0, 'the floor faces up');
    if (Math.max(...[a, b, c].map((v) => Math.hypot(v[0], v[2]))) <= STAR_CRATER_R * 0.55) assert.ok(n[1] > 0.999, 'level inside the rim\'s foot');
    assert.ok(Math.abs(a[1] - (STAR_FLOOR_LIFT + rimAt(Math.hypot(a[0], a[2])))) < 1e-5);
  }
  assert.ok(trisOf(m, STAR_RIM_RECORD).every(([, , , n]) => n[1] > 0), 'the rim faces up and out');
  // the heart's shard: its first faces, each looking away from its own axis; from under the earth to its tip
  const heart = trisOf(m, STAR_GLASS_RECORD).slice(0, 18), centre = [0, (-STAR_STONE_SINK + STAR_STONE_H) / 2, 0];
  for (const [a, b, c, n] of heart) assert.ok(dot(n, sub([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3], centre)) > 0, 'wound outward');
  const ys = heart.flatMap(([a, b, c]) => [a[1], b[1], c[1]]);
  assert.ok(Math.abs(Math.min(...ys) + STAR_STONE_SINK) < 1e-5, 'sunk into the earth');
  assert.ok(Math.abs(Math.max(...ys) - STAR_STONE_H) < 1e-5, 'its tip at its height');
  const thread = trisOf(m, STAR_THREAD_RECORD).flatMap(([a, b, c]) => [a[1], b[1], c[1]]);
  assert.ok(Math.abs(Math.max(...thread) - STAR_THREAD_H) < 1e-5, 'into the dark');
});

test('STAR4 ON THE LAND: the floor rides the highest ground about each point (the rite\'s drape) - on a slope it never dips under the land; a height that answers nothing is the heart\'s own (mutants: the ride, the NaN guard)', () => {
  const slope = (x, z) => 0.2 * x + 0.1 * z;
  const m = buildStarModel(N, K, slope);
  for (const [a, b, c] of trisOf(m, STAR_EARTH_RECORD)) for (const v of [a, b, c]) assert.ok(v[1] >= slope(v[0], v[2]) + STAR_FLOOR_LIFT - 1e-6, 'never under the land');
  // a stone a hand across between the floor's points: the points about it ride over it (each reads the highest ground
  // within STAR_FLOOR_REACH), so the floor never cuts through it; no point stands on it
  const at = [0.2, 3.85], bump = (x, z) => (Math.hypot(x - at[0], z - at[1]) < 0.2 ? 1 : 0);
  const floor = trisOf(buildStarModel(N, K, bump), STAR_EARTH_RECORD).flatMap(([a, b, c]) => [a, b, c]);
  assert.ok(floor.every((v) => bump(v[0], v[2]) === 0), 'no point of the floor on the stone itself');
  const raised = floor.filter((v) => v[1] > 0.9);
  assert.ok(raised.length > 0, 'the points about it ride over it');
  assert.ok(raised.every((v) => Math.hypot(v[0] - at[0], v[2] - at[1]) < STAR_FLOOR_REACH + 0.2 + 1e-9), 'and only those');
  const holed = buildStarModel(N, K, () => NaN);
  assert.ok([...holed.positions].every(Number.isFinite), 'no NaN in the mesh');
  assert.deepEqual([...holed.positions], [...buildStarModel(N, K).positions]);
});

test('STAR4 ITS LOOKS: held, the thread gone and the glass gold; lost, the glass dark; the stone alone for the collider (mutants: a part\'s switch, the record worn)', () => {
  const held = buildStarModel(N, K, undefined, { thread: false, glass: STAR_GOLD_RECORD });
  assert.deepEqual(held.subMeshes.map((s) => s.textureRecord), [STAR_EARTH_RECORD, STAR_RIM_RECORD, STAR_GOLD_RECORD]);
  const lost = buildStarModel(N, K, undefined, { glass: STAR_DARK_RECORD });
  assert.deepEqual(lost.subMeshes.map((s) => s.textureRecord), [STAR_EARTH_RECORD, STAR_RIM_RECORD, STAR_THREAD_RECORD, STAR_DARK_RECORD]);
  const stone = buildStarModel(N, K, undefined, { ground: false, thread: false });
  assert.deepEqual(stone.subMeshes.map((s) => s.textureRecord), [STAR_GLASS_RECORD]);
  assert.equal(trisOf(stone, STAR_GLASS_RECORD).length, trisOf(buildStarModel(N, K), STAR_GLASS_RECORD).length);
});

test('STAR4 THE SKY\'S PATH: the streak comes down its bearing from far out and high to the site; the omen burns straight up over it, growing; a thing past the far plane is drawn scaled about the eye in the same direction; the ring of shock runs out and fades (mutants: the bearing, the ease, the clamp, the ring)', () => {
  const site = [100, 20, -50], b = Math.PI / 3;
  const s0 = streakAt(site, b, 0), s1 = streakAt(site, b, 1);
  assert.deepEqual(s1.head, site, 'it lands on its site');
  const out = sub(s0.head, site);
  assert.ok(Math.abs(out[0] - Math.sin(b) * STAR_FALL_FROM_M) < 1e-6 && Math.abs(out[1] - STAR_FALL_ALT_M) < 1e-6 && Math.abs(out[2] - Math.cos(b) * STAR_FALL_FROM_M) < 1e-6);
  assert.ok(Math.abs(Math.hypot(...s0.dir) - 1) < 1e-9);
  assert.ok(dot(s0.dir, out) > 0, 'its trail back up its path');
  const mid = streakAt(site, b, 0.5);
  assert.ok(Math.abs(Math.hypot(...sub(mid.head, site)) - 0.75 * Math.hypot(...out)) < 1e-6, 'easing in: three quarters of the way out at half its time');
  assert.deepEqual(streakAt(site, b, 2).head, site, 'clamped');
  assert.deepEqual(omenAt(site, 0), { at: [site[0], site[1] + STAR_OMEN_ALT_M, site[2]], w: STAR_OMEN_W[0] });
  assert.equal(omenAt(site, 1).w, STAR_OMEN_W[1]);
  assert.equal(omenAt(site, 5).w, STAR_OMEN_W[1]);
  assert.ok(omenAt(site, 0.5).w > STAR_OMEN_W[0] && omenAt(site, 0.5).w < STAR_OMEN_W[1]);
  const eye = [10, 5, 10];
  assert.deepEqual(skyClamp(eye, [20, 5, 10]), { at: [20, 5, 10], s: 1 }, 'near: as it is');
  const far = [10, 9005, 10], c = skyClamp(eye, far);
  assert.ok(Math.abs(Math.hypot(...sub(c.at, eye)) - STAR_SKY_R) < 1e-6, 'held inside the far plane');
  assert.ok(Math.abs(c.s - STAR_SKY_R / 9000) < 1e-12);
  assert.ok(Math.abs(c.at[0] - 10) < 1e-9 && Math.abs(c.at[2] - 10) < 1e-9, 'the same direction');
  assert.deepEqual(shockRingAt(-1), { r: 0, fade: 0 });
  assert.deepEqual(shockRingAt(STAR_RING_MS), { r: 0, fade: 0 });
  assert.deepEqual(shockRingAt(NaN), { r: 0, fade: 0 });
  assert.deepEqual(shockRingAt(0), { r: 0, fade: 1 });
  const r1 = shockRingAt(STAR_RING_MS * 0.3), r2 = shockRingAt(STAR_RING_MS * 0.7);
  assert.ok(r2.r > r1.r && r2.r < STAR_RING_M && r2.fade < r1.fade);
});

test('STAR4 THE SHADERS: each a WebGL2 source whose int is highp in both stages (the fragment\'s mediump default would not link `uKind`); the beacon violet, gold held, as the page\'s ink is (mutants: the head)', () => {
  for (const src of [STAR_SKY_VS, STAR_SKY_FS, STAR_RING_VS, STAR_RING_FS]) {
    assert.match(src, /^#version 300 es\nprecision highp float;\nprecision highp int;\n/);
  }
  assert.match(STAR_SKY_VS, /uniform int uKind/);
  assert.match(STAR_SKY_FS, /uniform int uKind/);
  const rgb = (css) => [1, 3, 5].map((i) => parseInt(css.slice(i, i + 2), 16) / 255);
  const violet = ([r, g, b]) => b > r && r > g, gold = ([r, g, b]) => r > g && g > b;
  assert.ok(violet(STAR_BEACON_COLOR) && violet(rgb(STAR_VIOLET_CSS)), 'violet, the beacon and the page');
  assert.ok(gold(STAR_HELD_COLOR) && gold(rgb(STAR_GOLD_CSS)), 'gold once held');
});

test('STAR4 THE SOUNDS: DAGGER.SND\'s own records, pitched - the omen and the fall heard everywhere, the rest at the star by their reach; played through the engine\'s two doors, an unknown cue or a failing engine false (mutants: a reach, a door)', () => {
  const clips = new Set(Object.values(SOUND));
  for (const [k, c] of Object.entries(STAR_SOUNDS)) {
    assert.ok(clips.has(c.clip), `${k}: a clip of the game's own`);
    assert.ok(c.pitch > 0 && c.volume > 0);
  }
  assert.deepEqual(Object.keys(STAR_SOUNDS), ['omen', 'fall', 'impact', 'hum', 'blow', 'master', 'circle', 'held', 'dark']);
  assert.deepEqual(Object.entries(STAR_SOUNDS).filter(([, c]) => !c.maxDistance).map(([k]) => k), ['omen', 'fall'], 'the sky\'s');
  const calls = [];
  const audio = { playOneShot: (...a) => calls.push(['one', ...a]), play3d: (...a) => calls.push(['3d', ...a]) };
  assert.equal(playStarSound(audio, 'omen', [1, 2, 3]), true);
  assert.deepEqual(calls.pop(), ['one', STAR_SOUNDS.omen.clip, STAR_SOUNDS.omen.volume, STAR_SOUNDS.omen.pitch]);
  assert.equal(playStarSound(audio, 'impact', [1, 2, 3], 0.5), true);
  assert.deepEqual(calls.pop(), ['3d', STAR_SOUNDS.impact.clip, [1, 2, 3], STAR_SOUNDS.impact.volume * 0.5, { refDistance: STAR_SOUNDS.impact.refDistance, maxDistance: STAR_SOUNDS.impact.maxDistance, pitch: STAR_SOUNDS.impact.pitch }]);
  assert.equal(playStarSound(audio, 'blow'), true, 'no place: everywhere');
  assert.equal(calls.pop()[0], 'one');
  assert.equal(playStarSound(audio, 'nothing'), false);
  assert.equal(playStarSound(null, 'omen'), false);
  assert.equal(playStarSound({ playOneShot: () => { throw new Error('no context'); } }, 'omen'), false);
  assert.equal(playStarSound({}, 'hum', [0, 0, 0]), false);
});

// ── AUDIT STARFALL (2026-10-20) ──────────────────────────────────────────────────────────────────────────────────────

/** A GL that answers every call (its programs link, its uniforms are their names) and keeps what it was told. */
function fakeGl() {
  const calls = [];
  const answer = { createProgram: () => ({ program: true }), getProgramParameter: () => true, getShaderParameter: () => true, getUniformLocation: (p, n) => ({ n }) };
  return new Proxy({ calls }, {
    get(o, k) {
      if (k in o) return o[k];
      if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return k;
      return (...a) => { calls.push([k, ...a]); return answer[k] ? answer[k](...a) : {}; };
    },
  });
}
/** What the pass set each uniform to, in its order: `[name, ...values]`. */
const uniformsSet = (gl) => gl.calls.filter(([k]) => /^uniform/.test(k)).map(([, loc, ...v]) => [loc?.n, ...v]);

test('AUDIT STARFALL R6 THE RIM\'S STONES SIT IN ITS EARTH: each stone\'s base corners at or under the earth they stand on - the lowest of it, on the rim\'s outer slope and on a slope of the land - its crown over the earth at its middle (mutants: the lowest corner)', () => {
  const corners = (m) => trisOf(m, STAR_RIM_RECORD).flatMap(([a, b, c]) => [a, b, c]);
  for (const ground of [() => 0, (x, z) => 0.3 * x - 0.2 * z]) {
    for (const [n, k] of [[N, K], [N + 7, 0], [N + 31, 2]]) {
      const m = buildStarModel(n, k, ground);
      const L = starLayout(n, k);
      const pts = corners(m);
      for (const s of L.stones) {
        // the stone's own points: within its reach of its middle, off the floor's grid (whose points sit on the earth)
        const own = pts.filter((p) => Math.hypot(p[0] - s.x, p[2] - s.z) <= s.s + 1e-6);
        const base = own.filter((p) => Math.abs(Math.hypot(p[0] - s.x, p[2] - s.z) - s.s) < 1e-6);
        assert.ok(base.length >= 5, 'its base ring');
        for (const p of base) assert.ok(p[1] <= ground(p[0], p[2]) + rimAt(Math.hypot(p[0], p[2])) + 1e-6, `a base corner of ${n}.${k} never over the earth under it`);
        const top = Math.max(...own.map((p) => p[1]));
        assert.ok(top > ground(s.x, s.z) + rimAt(Math.hypot(s.x, s.z)), 'its crown out of the earth');
      }
    }
  }
});

test('AUDIT STARFALL R3 THE RING ON THE LAND, IN ITS SHADER: each bearing\'s inner and outer edge stands on its own ground over the heart (`uGround`) and a hand over it, at the running edge\'s width either side; the strip runs every bearing round to the first (mutants: the ground, the edge)', () => {
  const strip = ringStrip(4);
  assert.equal(strip.length, 4 * 12);
  assert.deepEqual([...strip.slice(0, 12)], [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  assert.deepEqual([...strip.slice(-12, -10)], [3, 0]);
  assert.equal(ringStrip().length, STAR_RING_SEGS * 12);
  const ground = Array.from({ length: STAR_RING_SEGS * 2 }, (_, i) => (i % 7) * 0.5 - 1.25);
  const at = [100, 20, -50], r = 40;
  const f = glslFunctions(STAR_RING_VS, { uAt: at, uR: r, uWidth: STAR_RING_WIDTH_M, uGround: ground, uVP: Array(16).fill(0), aP: [0, 0] });
  for (const i of [0, 3, 8, 17, 31]) {
    const a = (i / STAR_RING_SEGS) * 2 * Math.PI;
    for (const j of [0, 1]) {
      const p = f.ringPoint([i, j]), rr = j ? r + STAR_RING_WIDTH_M : r - STAR_RING_WIDTH_M;
      assert.ok(Math.abs(p[0] - (at[0] + Math.sin(a) * rr)) < 1e-6 && Math.abs(p[2] - (at[2] + Math.cos(a) * rr)) < 1e-6, `bearing ${i}, edge ${j}: its place`);
      assert.ok(Math.abs(p[1] - (at[1] + ground[i * 2 + j] + STAR_RING_LIFT_M)) < 1e-6, `bearing ${i}, edge ${j}: on its own ground`);
    }
  }
  const last = f.ringPoint([STAR_RING_SEGS, 1]), first = f.ringPoint([0, 1]);
  assert.deepEqual(last, first, 'round to the first');
  const start = glslFunctions(STAR_RING_VS, { uAt: at, uR: 2, uWidth: STAR_RING_WIDTH_M, uGround: ground, uVP: Array(16).fill(0), aP: [0, 0] }).ringPoint([0, 0]);
  assert.deepEqual([start[0], start[2]], [at[0], at[2]], 'its inner edge never past the heart');
});

test('AUDIT STARFALL R2 R3 R5 THE PASS: a beacon\'s width, foot and height scaled with its clamp; a ring handed its ground (flat where none is); the sky\'s and the ring\'s fog handed the travel view\'s focus and the jungle\'s haze, as the beacon\'s is (mutants: the scale, the ground, the focus)', () => {
  const gl = fakeGl();
  const pass = new StarfallPassRenderer(gl);
  const programs = gl.calls.filter(([k]) => k === 'getUniformLocation').map(([, , n]) => n);
  for (const n of ['uFocus', 'uJungleHaze']) assert.equal(programs.filter((x) => x === n).length, 3, `${n}: the beacon's, the sky's and the ring's`);
  const I = new Float32Array(16), focus = new Float32Array([1, 2, 3, 1]), haze = new Float32Array(8).fill(0.5);
  const ground = new Float32Array(STAR_RING_SEGS * 2).fill(1.5);
  gl.calls.length = 0;
  const drawn = pass.draw({
    beacons: [{ origin: [0, 0, 0], scale: 0.5, fade: 1, held: false }, { origin: [9, 0, 0], fade: 1, held: true }],
    glows: [{ at: [0, 9000, 0], w: 10, light: 1 }], trails: [],
    rings: [{ at: [0, 0, 0], r: 20, fade: 1, ground }, { at: [5, 0, 0], r: 20, fade: 1 }],
  }, I, I, [0, 2, 0], 1, { mode: 1, density: 0, range: [0, 1], color: [0, 0, 0], camPos: [0, 2, 0], focus, haze });
  assert.equal(drawn, 5);
  const set = uniformsSet(gl);
  const of = (name) => set.filter(([n]) => n === name).map(([, ...v]) => v);
  assert.deepEqual(of('uRadius'), [[BEACON_RADIUS_M * 0.5], [BEACON_RADIUS_M]], 'its width with its clamp, a beacon unclamped as it is');
  assert.deepEqual(of('uBelow'), [[STAR_BEACON_BELOW_M * 0.5], [STAR_BEACON_BELOW_M]]);
  assert.deepEqual(of('uHeight'), [[STAR_BEACON_HEIGHT_M * 0.5], [STAR_BEACON_HEIGHT_M]]);
  assert.equal(of('uFocus').length, 3, 'the focus handed to each program drawn');
  assert.ok(of('uFocus').every(([v]) => v === focus) && of('uJungleHaze').every(([v]) => v === haze));
  const grounds = of('uGround');
  assert.equal(grounds[0][0], ground, 'the ring\'s ground');
  assert.equal(grounds[1][0].length, STAR_RING_SEGS * 2);
  assert.ok([...grounds[1][0]].every((v) => v === 0), 'flat where none is given');
  assert.ok(gl.calls.some(([k, , , n]) => k === 'drawArrays' && n === STAR_RING_SEGS * 6), 'the strip drawn whole');
});

test('AUDIT STARFALL R7 A CUE AT THE STAR IS HEARD ITS DISTANCE LATE: the storms\' own speed of sound (mutants: the delay)', () => {
  assert.equal(starHeardAfterMs(0), 0);
  assert.ok(Math.abs(starHeardAfterMs(686) - 2000) < 1e-9);
  assert.ok(Math.abs(starHeardAfterMs(1500) - thunderOf(1500).delay * 1000) < 1e-9, 'with its thunder');
  assert.equal(starHeardAfterMs(-5), 0);
  assert.equal(starHeardAfterMs(NaN), 0);
});
