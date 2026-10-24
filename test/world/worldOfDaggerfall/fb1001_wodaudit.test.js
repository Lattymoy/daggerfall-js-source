// AUDIT 2026-10-01 part five (Mac: "audit this") - WOD-ROCK, over every World of Daggerfall layout on the game's own
// data (1,325 model records, 847 re-mapped: no NaN, no vertex added, positions and indices the model's own):
//   WR1 the unfolding's frame was laid along the reference triangle's first edge - often a quad's diagonal - and an
//       in-plane stretch keeps only that one direction's angle, so the textures with a grain turned on the re-mapped
//       non-rock pieces: a palisade's planks (43001) 54 degrees off the wall, a fort piece's 32, a dock's stone blocks
//       14 - the frame is laid along the texture's own rows now;
//   WR2 one outcrop mixes rock pebbles under and over the 4x threshold (60610 at 3.01 beside 4.69; 60718 at 3.5 beside
//       60714 at 1.9), and touching pieces wore two to three and a half times each other's density - a pebble is
//       unfolded from any real stretch, named by the model id the host hands in;
//   and ROCK-CAP, asked (Mac: "Cap at ~8 m a repeat"): at the pebble's own density the rock read as rock within some
//       10 m, a lattice at 30 to 100 m and flat from 300 m - a rock face now tiles no finer than a repeat per 8 m.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wodRockUvs, WOD_ROCK_MODELS, WOD_ROCK_PEBBLE_MIN, WOD_ROCK_STRETCH_MIN, WOD_ROCK_MAX_REPEATS_PER_M } from '../../../src/world/worldOfDaggerfall/wodRockUv.js';
import { objectMatrix } from '../../../src/world/worldOfDaggerfall/wodLocationObjects.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const ang = (a, b) => Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b))) * 180 / Math.PI;
/** dP/du of a triangle: the direction the texture's rows run. */
const rowsOf = (P, U) => {
  const e1 = sub(P[1], P[0]), e2 = sub(P[2], P[0]), du1 = U[1][0] - U[0][0], dv1 = U[1][1] - U[0][1], du2 = U[2][0] - U[0][0], dv2 = U[2][1] - U[0][1];
  const det = du1 * dv2 - du2 * dv1;
  return e1.map((c, k) => (c * dv2 - e2[k] * dv1) / det);
};

test('AUDIT WR1: a plank wall stretched 8 x 0.67 x 4 keeps its texture\'s rows along its edge - the palisade\'s planks turned 54 degrees (mutant: the frame along the first edge)', () => {
  // one wall face in the model's x-y plane, 1 x 1.6 m, its UVs fitted to it (rows along x); the fan's first triangle
  // starts on the diagonal (0 -> 2), as a DF quad's may
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1.6, 0, 0, 1.6, 0]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 2, 0, 2]);
  const indices = new Uint32Array([0, 2, 3, 0, 1, 2]);
  const cpu = { positions, normals: new Float32Array(12), uvs, indices, subMeshes: [{ textureArchive: 321, textureRecord: 2, startIndex: 0, primitiveCount: 2 }] };
  const M = objectMatrix([0, 0, 0], { x: 0, y: 0.3, z: 0, w: 0.954 }, { x: 8, y: 0.67, z: 4 });
  const out = wodRockUvs(cpu, M, 43001);
  assert.notEqual(out, cpu, 'a stretched palisade is re-mapped');
  const L = (i) => [0, 1, 2].map((k) => M[k] * positions[i * 3] + M[4 + k] * positions[i * 3 + 1] + M[8 + k] * positions[i * 3 + 2]);
  const edge = sub(L(1), L(0));   // the wall's foot, where the rows ran
  for (let t = 0; t < 2; t++) {
    const v = [0, 1, 2].map((j) => indices[t * 3 + j]);
    const P = v.map(L);
    assert.ok(ang(rowsOf(P, v.map((i) => [uvs[i * 2], uvs[i * 2 + 1]])), edge) < 1e-3, 'the model\'s own rows ran along the foot');
    const turn = ang(rowsOf(P, v.map((i) => [out.uvs[i * 2], out.uvs[i * 2 + 1]])), edge);
    assert.ok(turn < 0.1, `triangle ${t}: the planks turned ${turn.toFixed(2)} degrees off the wall's foot`);
  }
});

test('AUDIT WR2: a rock pebble under the 4x threshold is unfolded like its outcrop\'s others - by the id the host hands in; a non-rock model is not (mutants: no pebble list; the host hands no id)', () => {
  const quad = () => ({ positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), normals: new Float32Array(12), uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [{ textureArchive: 41, textureRecord: 0, startIndex: 0, primitiveCount: 2 }] });
  const at = (s) => objectMatrix([0, 0, 0], { x: 0, y: 0, z: 0, w: 1 }, { x: s, y: s, z: s });
  assert.ok(WOD_ROCK_MODELS.has(60610) && WOD_ROCK_PEBBLE_MIN < 3.01 && WOD_ROCK_STRETCH_MIN === 4);
  const rock = quad(), out = wodRockUvs(rock, at(3.01), 60610);
  assert.notEqual(out, rock, 'the 3.01 pebble is unfolded');
  assert.ok(Math.abs(out.uvs[2] - out.uvs[0] - 3.01 * WOD_ROCK_MAX_REPEATS_PER_M) < 1e-4, `its 3.01 m foot at the rock's capped density, as the 4.69 beside it (${out.uvs[2] - out.uvs[0]})`);
  assert.equal(wodRockUvs(rock, at(1.0), 60610), rock, 'a pebble at its own size is its own');
  const statue = quad();
  assert.equal(wodRockUvs(statue, at(2.65), 43301), statue, 'the shrine statue at 2.65 is its own');
  assert.match(hostText('src/scenes/world.js'), /const cpu = wodRockUvs\(cpuModels\.get\(m\.modelId\), m\.matrix, m\.modelId\);/, 'the host hands the piece\'s model id');
});

test('ROCK-CAP (Mac: "Cap at ~8 m a repeat"): a rock pebble\'s face tiles no finer than a repeat per 8 m in its finest direction, its grain\'s proportions kept; a palisade keeps its own density; a pebble already coarser keeps its own (mutants: no cap; the cap on every model; the cap by the coarse direction)', () => {
  // a quad 1 x 1 m, its texture 1 repeat a metre across and 3 up (anisotropic on purpose), stretched 400 x 400
  const quad = (ku, kv) => ({ positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), normals: new Float32Array(12), uvs: new Float32Array([0, 0, ku, 0, ku, kv, 0, kv]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [{ textureArchive: 141, textureRecord: 2, startIndex: 0, primitiveCount: 2 }] });
  const M = objectMatrix([0, 0, 0], { x: 0, y: 0, z: 0, w: 1 }, { x: 400, y: 400, z: 400 });
  const rate = (o) => [(o.uvs[2] - o.uvs[0]) / 400, (o.uvs[7] - o.uvs[1]) / 400];   // repeats a metre along the foot, up the side
  assert.equal(WOD_ROCK_MAX_REPEATS_PER_M, 1 / 8, 'Mac: "Cap at ~8 m a repeat"');
  const [ru, rv] = rate(wodRockUvs(quad(1, 3), M, 60716));
  assert.ok(Math.abs(rv - WOD_ROCK_MAX_REPEATS_PER_M) < 1e-6, `the finest direction at the cap: ${rv}`);
  assert.ok(Math.abs(rv / ru - 3) < 1e-6, 'the grain\'s proportions kept (3 to 1)');
  const [pu, pv] = rate(wodRockUvs(quad(1, 3), M, 43001));
  assert.ok(Math.abs(pu - 1) < 1e-6 && Math.abs(pv - 3) < 1e-6, 'a palisade keeps its model\'s density');
  const [cu, cv] = rate(wodRockUvs(quad(0.02, 0.04), M, 60716));
  assert.ok(Math.abs(cu - 0.02) < 1e-6 && Math.abs(cv - 0.04) < 1e-6, 'a pebble already coarser than the cap keeps its own');
});
