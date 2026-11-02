// AUDIT TESA III E1-4, the Eltheric half (2026-10-26, bible/01-Overview/audits/Audit-Tesa-III-E1.md; routed to the terrain
// stream - stream G): the isles' Deep Waters bake blends each isle's place with the isle's OWN outline, the one its clone's
// streamed build stands (TOWN-SHAPES TS2, seeded by the isle's map id), where it read the template's rect alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setLocationTiles, locationShapeField, locationOutlineBasis, outlineOfBasis, WORLD_MAP_TILE_DIM } from '../../src/world/terrain/terrainTiles.js';
import { etherPlaceRects, etherRectAt } from '../../src/world/etherWatersBake.js';
import { etherTemplateOf, etherPlaceId, synthesizeEtherLocation } from '../../src/world/etherPlaces.js';
import { veilhaven, islesNear } from '../../src/world/ethericSea.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A block of the game's shape as the outline and the stamp read it: ground tiles (16 x 16, records under the limit), its
 *  town-map bytes (a house where `house` says), no models or flats. */
const block = (name, house) => {
  const auto = new Uint8Array(64 * 64);
  for (let r = 0; r < 64; r++) for (let c = 0; c < 64; c++) if (house(r, c)) auto[r * 64 + c] = 5;
  const groundTiles = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2 })));
  return { name, rmbBlock: { fldHeader: { groundData: { groundTiles }, autoMapData: auto }, misc3dObjectRecords: [], miscFlatObjectRecords: [] } };
};
const BLOCKS = [block('A.RMB', (r, c) => r > 18 && r < 46 && c > 10 && c < 30), block('B.RMB', (r, c) => (r - 32) * (r - 32) + (c - 40) * (c - 40) < 160)];
const blocksFile = { checkName: (n) => n, getBlockIndex: (n) => BLOCKS.findIndex((b) => b.name === n), getBlock: (i) => BLOCKS[i] ?? null };
const mapsFile = { getRmbBlockName: (loc, bx, by) => loc.exterior.exteriorData.blockNames[by * loc.exterior.exteriorData.width + bx] };
/** A template as the game's rows give one: a hamlet of two blocks, or a one-block dungeon. */
const template = (mapId, names, w, h) => ({
  name: `t${mapId}`, regionIndex: 17, locationIndex: mapId, climate: 231, politic: 0,
  mapTableData: { mapId, locationType: 6, longitude: 0, latitude: 0 },
  exterior: { buildings: [], exteriorData: { width: w, height: h, blockNames: names, mapId, locationId: mapId } },
});
const TEMPLATES = { towns: [template(901, ['A.RMB', 'B.RMB'], 2, 1), template(902, ['B.RMB', 'A.RMB'], 2, 1)], havens: [template(903, ['A.RMB', 'B.RMB', 'B.RMB', 'A.RMB'], 2, 2)], ruins: [template(904, ['B.RMB'], 1, 1)] };
const rectOf = (loc) => setLocationTiles(loc, mapsFile, blocksFile, new Uint8Array(WORLD_MAP_TILE_DIM * WORLD_MAP_TILE_DIM));

test('AUDIT TESA III E1-4 THE OUTLINE\'S BASIS: locationShapeField is its basis drawn under the location\'s own map id - the basis rides on the outline unenumerated (never a field a copy or a post carries), and another id draws another outline off the same grid (mutant: the basis drawn under a fixed seed)', () => {
  const loc = TEMPLATES.towns[0], rmbOf = (bx, by) => BLOCKS[blocksFile.getBlockIndex(loc.exterior.exteriorData.blockNames[by * 2 + bx])].rmbBlock;
  const shape = locationShapeField(loc, rmbOf);
  assert.ok(shape && shape.some(Boolean), 'an outline');
  const basis = locationOutlineBasis(loc, rmbOf);
  assert.deepEqual([...outlineOfBasis(basis, 901)], [...shape], 'its own id: the outline itself');
  assert.deepEqual({ ...shape.basis, padded: [...shape.basis.padded] }, { ...basis, padded: [...basis.padded] }, 'the basis on it');
  assert.ok(!Object.keys(shape).includes('basis'), 'unenumerated');
  const other = outlineOfBasis(basis, etherPlaceId({ cy: 3, cx: 7 }));
  assert.ok(other.some((v, i) => v !== shape[i]), 'another id, another outline');
  assert.equal(locationOutlineBasis({ ...loc, capital: {} }, rmbOf), null, 'a capital stands none, as its outline');
});

test('AUDIT TESA III E1-4 THE ISLES\' BAKE STANDS EACH ISLE\'S OWN OUTLINE: etherPlaceRects keeps each template\'s basis once (packed a bit a tile), and etherRectAt answers an isle\'s place with the outline its clone\'s streamed build stands - setLocationTiles over synthesizeEtherLocation, the isle\'s own map id - for a haven, a port and a ruin; a template with no outline answers the rect alone (mutants: the shape dropped; the template\'s id seeding it; every basis none; a bit packed wrong)', () => {
  const rects = etherPlaceRects(TEMPLATES, rectOf);
  assert.equal(rects.bases.length, 4, 'four grids, four bases');
  assert.deepEqual(rects.towns.map((r) => r[4]), [0, 1]);
  const dup = etherPlaceRects({ towns: [TEMPLATES.towns[0], TEMPLATES.towns[0]] }, rectOf);
  assert.equal(dup.bases.length, 1, 'a basis kept once however many templates share it');
  const at = etherRectAt(rects), h = veilhaven();
  const isles = [h, ...['port', 'ruin'].map((kind) => islesNear(h.px, h.py, 80).find((i) => i.kind === kind && !i.haven))];
  for (const isle of isles) {
    assert.ok(isle, 'an isle of each kind');
    const t = etherTemplateOf(TEMPLATES, isle), clone = synthesizeEtherLocation(t, isle), streamed = rectOf(clone);
    const got = at(isle.px, isle.py);
    assert.ok(got?.shape, `${isle.kind}: an outline`);
    assert.deepEqual([...got.shape], [...streamed.shape], `${isle.kind}: the clone's own outline, to the tile`);
    assert.deepEqual([got.xMin, got.xMax, got.yMin, got.yMax], [streamed.xMin, streamed.xMax, streamed.yMin, streamed.yMax], `${isle.kind}: its bounds`);
    const own = rectOf(t);
    assert.ok(own.shape.some((v, i) => v !== streamed.shape[i]), `${isle.kind}: the template's own id draws another outline - the one the bake had`);
  }
  // a template with no outline (no block read): the rect alone
  const bare = etherPlaceRects({ towns: [{}], havens: [{}], ruins: [{}] }, () => ({ xMin: 1, xMax: 2, yMin: 3, yMax: 4 }));
  assert.deepEqual(etherRectAt(bare)(h.px, h.py), { xMin: 1, xMax: 2, yMin: 3, yMax: 4 });
});

test('AUDIT TESA III E1-4 the isles\' rects reach both bakes whole (by source): the host hands the template walk to etherPlaceRects, the client posts the rects to the worker as they are and builds this thread\'s bake on them', () => {
  assert.match(src('src/scenes/world.js'), /ether: etherSea \? etherPlaceRects\(_etherTemplates, locationRectReader\(maps, blocks, \{ regionIndex: ETHER_REGION, locationIndex: -1000 \}\)\) : null,/);
  const client = src('src/world/deepWater/deepWatersClient.js');
  assert.match(client, /worker\.postMessage\(\{ t: 'build', woodsBytes: bytes, rects, ether, continent \}, \[bytes\.buffer\]\);/);   // PIN MOVED (TAMRIEL-DEEP): and whether the continent's bake has room
  assert.match(client, /worldBakes\(new DeepWatersBake\(\{ woods, global: record, locationRectAt: rectsLookup\(rects\) \}\), \{\n\s*woods: ether \? etherGround\(woods\) : woods,\n\s*ether,\n\s*continent,\n\s*\}\)/);   // PIN MOVED (TAMRIEL-DEEP)
});
