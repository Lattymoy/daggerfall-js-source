// @ts-check
// SKYRIM-FLORA playground: biome pixels, mesh helpers, vite entry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIOMES, biomeGroundRgb, buildPreviewMesh, pixelOfBiome } from '../../src/tools/floraPlayground.js';
import { SKYRIM_FLORA_CARDS } from '../../src/world/tamriel/skyrimFlora.js';
import { landKeyAt } from '../../src/world/tamriel/tamrielLands.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('flora playground page and vite entry exist', () => {
  assert.ok(existsSync(join(root, '2d-playground.html')));
  const vite = readFileSync(join(root, 'vite.config.js'), 'utf8');
  assert.match(vite, /floraPlayground:\s*'2d-playground\.html'/);
  assert.match(vite, /floraPlaygroundAlias/);
});

test('flora playground biomes, pixel picker, meshes', () => {
  assert.ok(BIOMES.includes('skyrimPinewood'));
  assert.ok(BIOMES.includes('skyrimReach'));
  const rgb = biomeGroundRgb('skyrimPinewood');
  assert.equal(rgb.length, 3);
  assert.ok(rgb.every((c) => c >= 0 && c <= 1));
  const at = pixelOfBiome('skyrimPinewood');
  assert.ok(at, 'skyrimPinewood pixel');
  assert.equal(landKeyAt(at[0], at[1]), 'skyrimPinewood');
  const ground = buildPreviewMesh(32, 48, false, 1);
  assert.equal(ground.positions.length / 3, SKYRIM_FLORA_CARDS * 12);
  const hang = buildPreviewMesh(24, 42, true);
  assert.equal(hang.positions.length / 3, 24);
});
