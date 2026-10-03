// ARENA1 (2026-10-02): THE EXTRACTION, RE-RUN ON THE BUNDLE (tools/daggerfallArenaExtract.mjs). Gated on the player's
// ARENA2 (ARENA2_PATH) and on Kamer's bundle (DAGGERFALL_ARENA_DFMOD - "daggerfall arena.dfmod" out of
// daggerfall_arena.rar; it is not committed). The tool is a function of the two: run twice it writes the same bytes,
// and they are the vendored files' bytes. Rebuilt, the model is the bundle's mesh again - every triangle's corners
// (5 mm), uvs (0.02), winding and picture - so nothing of Kamer's is lost and nothing of Daggerfall's is carried.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { daggerfallArenaAssets, PIECE_MODELS } from '../tools/daggerfallArenaExtract.mjs';
import { openScene, decodeMesh, UCLASS } from '../tools/lib/unityScene.mjs';
import { buildArenaModel } from '../src/world/arenaModel.js';
import { HAS_ARENA2, ARENA2, ROOT, classicModels } from './arena1Data.mjs';

const BUNDLE = process.env.DAGGERFALL_ARENA_DFMOD ?? '';
const skip = !(HAS_ARENA2 && BUNDLE && existsSync(BUNDLE)) && 'ARENA2_PATH and DAGGERFALL_ARENA_DFMOD not set';
const text = (b) => (typeof b === 'string' ? Buffer.from(b) : Buffer.from(b));

test('ARENA1 extract: run twice the tool writes the same bytes, and they are the vendored files - no picture among them', { skip }, () => {
  const bytes = new Uint8Array(readFileSync(BUNDLE));
  const a = daggerfallArenaAssets(bytes, ARENA2);
  const b = daggerfallArenaAssets(bytes, ARENA2);
  assert.deepEqual(Object.keys(a.out).sort(), Object.keys(b.out).sort());
  for (const [path, body] of Object.entries(a.out)) {
    assert.ok(text(body).equals(text(b.out[path])), `${path}: the same twice`);
    assert.ok(text(body).equals(readFileSync(join(ROOT, 'vendor/daggerfall-arena', path))), `${path}: the vendored file`);
    assert.doesNotMatch(path, /\.(png|tga|dds|jpe?g|bmp)$/i);
  }
  assert.ok(a.report.some((l) => /texture 0-0 .*not written/.test(l)) && a.report.some((l) => /texture 4-0 .*not written/.test(l)));
  assert.ok(a.report.includes('search: 310 placements of 33 models'));
  assert.equal(PIECE_MODELS.length, 33);
});

test('ARENA1 extract: Kamer\'s half and the pieces rebuilt from ARCH3D are the bundle\'s mesh, triangle for triangle', { skip }, () => {
  const scene = openScene(new Uint8Array(readFileSync(BUNDLE)));
  const d = decodeMesh(scene.ofClass(UCLASS.Mesh)[0].v, (p, o, s) => scene.resource(p, o, s));
  const mats = scene.ofClass(UCLASS.MonoBehaviour)[0].v.Materials.map((m) => `${m.Archive}_${m.Record}`);
  const idx = JSON.parse(readFileSync(join(ROOT, 'vendor/daggerfall-arena/Models/864102.json'), 'utf8'));
  const m = buildArenaModel(idx, new Uint8Array(readFileSync(join(ROOT, 'vendor/daggerfall-arena/Models/864102.bin'))), classicModels());
  const q = (x) => Math.round(x / 0.005);
  // a triangle as its three corners (position and uv) from its lowest corner on - its winding kept - and its picture
  const key = (P, U, v, tex) => {
    const c = v.map((i) => `${q(P[i * 3])},${q(P[i * 3 + 1])},${q(P[i * 3 + 2])}@${Math.round(U[i * 2] * 50)},${Math.round(U[i * 2 + 1] * 50)}`);
    let best = null;
    for (let r = 0; r < 3; r++) { const k = [c[r], c[(r + 1) % 3], c[(r + 2) % 3]].join('|'); if (best === null || k < best) best = k; }
    return `${best}#${tex}`;
  };
  const count = (map, k) => map.set(k, (map.get(k) ?? 0) + 1);
  const A = new Map(), B = new Map();
  d.submeshes.forEach((sm, si) => { for (let j = sm.start; j < sm.start + sm.count; j += 3) count(A, key(d.channels.position.data, d.channels.uv0.data, [0, 1, 2].map((o) => d.indices[j + o] + sm.baseVertex), mats[si])); });
  for (const sm of m.subMeshes) for (let j = sm.startIndex; j < sm.startIndex + sm.primitiveCount * 3; j += 3) count(B, key(m.positions, m.uvs, [0, 1, 2].map((o) => m.indices[j + o]), `${sm.textureArchive}_${sm.textureRecord}`));
  assert.equal(d.indices.length / 3, 5138);
  assert.equal(m.indices.length / 3, 5138);
  const differ = [...A].filter(([k, n]) => B.get(k) !== n).length + [...B].filter(([k, n]) => A.get(k) !== n).length;
  assert.equal(differ, 0, 'every triangle of the bundle stands in the rebuild, and nothing else');
});
