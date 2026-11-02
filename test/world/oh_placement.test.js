// OH-B (2026-09-26) - THERE'S A HOLE IN THE BOTTOM OF THE OCEAN 1.1.0, THE
// PURE LAW (src/world/oceanHoles.js) against the assembly
// (vendor/ocean-holes/There's a Hole in the Bottom of the Ocean.dll, read
// back to C#): the hash and its fixed point, the pit pixels' buckets, the
// placement, the floor's fall, the carve's vertex pass, the names and the
// map id, the template the abyss borrows, the water it is flooded to, the
// deep's roster picks, the fixtures it strips, the armour ladder, the
// settings' scaling, the disc and the miasma puff CreateMaterials
// builds, and the miasma's particle system (world/oceanHolesMiasma.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stableHash, isPitPixel, placementFraction, getScaledSliderValue, getMidpointColor, getFloorPitDepth,
  deformSeafloorVertices, heightGridFromPositions, raycastFloorY, findPitOpeningY, buildDungeonName, buildGpsDungeonName,
  getAbyssMapId, isFlameEnemy, isEligibleUnderwaterReplacement, tryPickUnderwaterEnemy, enemyHash, isDungeonLightFixture,
  nextArmorMaterial, tryGetTemplateSavePosition, isSuitableTemplate, tryFindTemplate, cloneDungeon, abyssWaterLevel,
  createDiscMesh, createMiasmaTexture, validateDeterminism, getLocationRect,
  PLACEMENT_SALT, NAME_SALT, TEMPLATE_SALT, ENEMY_SALT, NAME_ADJECTIVES, NAME_NOUNS, NAME_ENDINGS,
  ABYSS_FOG_COLOR, SUITABLE_TEMPLATE_DUNGEON_TYPES, MINIMUM_DEPTH, MINIMUM_EDGE_DISTANCE,
} from '../../src/world/oceanHoles.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { mapPixelToLongitudeLatitude, mapPixelToWorldCoord } from '../../src/formats/mapsFile.js';

const f32 = Math.fround;

/** The C#'s StableHash, restated in BigInt so the pin is not the port's own arithmetic read back. */
function refHash(x, y, salt) {
  const M = 0xffffffffn;
  const i32 = (v) => BigInt.asIntN(32, v);
  const u32 = (v) => BigInt.asUintN(32, v);
  const num = i32(BigInt(x) * 73856093n) ^ i32(BigInt(y) * 19349663n) ^ i32(BigInt(salt));
  const num2 = i32((i32(num) ^ (u32(num) >> 16n)) * 2146121005n);
  const num3 = i32((i32(num2) ^ (u32(num2) >> 15n)) * -2073254261n);
  return Number((u32(num3) ^ (u32(num3) >> 16n)) & M);
}

test('OH-B StableHash: Int32 multiplies, logical shifts (the IL\'s shr.un), the mod\'s own fixed point', () => {
  assert.equal(stableHash(17, 42, PLACEMENT_SALT), 1607323056, 'ValidateDeterminism\'s fixed point');
  for (const [x, y, s] of [[0, 0, 0], [999, 499, PLACEMENT_SALT], [207, 213, NAME_SALT], [-5, 7, TEMPLATE_SALT], [123, 456, ENEMY_SALT], [65535, 1, 0xffffffff]]) {
    assert.equal(stableHash(x, y, s), refHash(x, y, s), `${x},${y},${s}`);
  }
  assert.doesNotThrow(() => validateDeterminism(), 'the mod\'s own self-check passes on the port');
});

test('OH-B IsPitPixel: 48 buckets of 89478486 - off at 0, the hash\'s one-in-48 at the middle, one in 24 at the top, and nested', () => {
  let half = 0, full = 0, quarter = 0;
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 200; x++) {
      const h = stableHash(x, y, PLACEMENT_SALT);
      assert.equal(isPitPixel(x, y, 0), false);
      assert.equal(isPitPixel(x, y, 0.5), h % 48 === 0, 'the middle is exactly the first bucket');
      const q = isPitPixel(x, y, 0.25), m = isPitPixel(x, y, 0.5), t = isPitPixel(x, y, 1);
      if (q) assert.ok(m, 'a quarter nests in the middle');
      if (m) assert.ok(t, 'the middle nests in the top');
      // the top takes the second bucket too: h % 48 == 1 and nothing of the third
      assert.equal(t, h % 48 === 0 || h % 48 === 1, 'the top is the first two buckets');
      half += m; full += t; quarter += q;
    }
  }
  assert.ok(half > 150 && half < 360, `about one in 48 (${half} of 12000)`);
  assert.ok(full > half && quarter < half);
  // the rate is a float, clamped: above 1 is 1, below 0 is 0
  assert.equal(isPitPixel(3, 4, 7), isPitPixel(3, 4, 1));
  assert.equal(isPitPixel(3, 4, -1), false);
});

test('OH-B PlacementFraction: 0.28 plus 0.44 of the salted hash\'s low sixteen bits, in floats - never nearer an edge than 28%', () => {
  for (let i = 0; i < 400; i++) {
    const x = (i * 37) % 1000, y = (i * 11) % 500;
    for (const salt of [88, 90]) {
      const v = placementFraction(x, y, salt);
      assert.ok(v >= f32(0.28) && v <= f32(0.72) + 1e-6, `${v}`);
      const h = refHash(x, y, (PLACEMENT_SALT ^ salt) >>> 0) & 0xffff;
      assert.equal(v, f32(f32(0.28) + f32(f32(f32(h) / 65535) * f32(0.44))));
    }
  }
  assert.notEqual(placementFraction(10, 10, 88), placementFraction(10, 10, 90), 'x and z have their own salts');
});

test('OH-B GetFloorPitDepth: 14 m inside the black radius, smoothstepped to nothing at the outer, both scaled by the slider', () => {
  assert.equal(getFloorPitDepth(0, 1), 14);
  assert.equal(getFloorPitDepth(9, 1), 14, 'inclusive at the black radius');
  assert.equal(getFloorPitDepth(32, 1), 0, 'nothing at the outer');
  const t = f32(1 - f32(f32(20.5 - 9) / 23));
  assert.equal(getFloorPitDepth(20.5, 1), f32(14 * f32(f32(t * t) * f32(3 - f32(2 * t)))));
  const u = f32(1 - f32(f32(40 - 18) / f32(64 - 18)));
  assert.equal(getFloorPitDepth(40, 2), f32(14 * f32(f32(u * u) * f32(3 - f32(2 * u)))), 'the radii scale, the depth does not');
  assert.equal(getFloorPitDepth(0, 0), 0, 'a zero slider cuts no pit');
  assert.equal(getScaledSliderValue(0.5, 32), 32);
  assert.equal(getScaledSliderValue(1, 20), 40);
  assert.equal(getScaledSliderValue(0, 20), 0);
});

/** A flat 65 x 65 floor at `y` over the pixel, plus two wall vertices. */
function flatFloor(y, slope = 0) {
  const pos = [];
  const step = 819.2 / 64;
  for (let i = 0; i < 65; i++) for (let j = 0; j < 65; j++) pos.push(j * step, f32(y + slope * j * step), i * step);
  pos.push(409.6, y, 409.6, 10, y, 10);   // two walls' vertices after the grid (one at the pixel's centre): the pass walks every vertex
  return Float32Array.from(pos);
}

test('OH-B DeformSeafloor: every vertex within the outer radius falls by the pit\'s depth; flattening only when allowed and the floor strays past 5 m', () => {
  const flat = flatFloor(-100);
  const fx = f32(0.5), fz = f32(0.5);
  const cx = f32(fx * 819.2), cz = f32(fz * 819.2);
  const r = deformSeafloorVertices(flat, { fractionX: fx, fractionZ: fz, sizeX: 819.2, sizeZ: 819.2, scale: 1, allowFlatten: true });
  assert.equal(r.flattened, false, 'a flat floor needs no flattening');
  const n = r.positions.length / 3;
  let deepest = Infinity;
  for (let k = 0; k < n; k++) {
    const d = Math.hypot(r.positions[k * 3] - cx, r.positions[k * 3 + 2] - cz);
    const expected = d >= 32 ? -100 : f32(-100 - getFloorPitDepth(f32(Math.sqrt(f32(f32(f32(r.positions[k * 3] - cx) ** 2) + f32(f32(r.positions[k * 3 + 2] - cz) ** 2)))), 1));
    assert.ok(Math.abs(r.positions[k * 3 + 1] - expected) < 1e-4, `vertex ${k} at ${d.toFixed(2)} m`);
    deepest = Math.min(deepest, r.positions[k * 3 + 1]);
  }
  assert.ok(Math.abs(deepest - -114) < 1e-4, 'the black radius is 14 m down');
  assert.ok(Math.abs(r.positions[(n - 2) * 3 + 1] - -114) < 1e-4, 'a wall vertex at the centre falls with the grid (every vertex is walked)');
  assert.equal(r.positions[(n - 1) * 3 + 1], -100, 'a far wall vertex stays');
  assert.equal(flat[1], -100, 'the source mesh is not touched (the C# restores from its clone on a failed commit)');

  const sloped = flatFloor(-100, 0.2);
  const a = deformSeafloorVertices(sloped, { fractionX: fx, fractionZ: fz, sizeX: 819.2, sizeZ: 819.2, scale: 1, allowFlatten: true });
  assert.equal(a.flattened, true, 'a slope of 0.2 strays past 5 m inside 64 m');
  const b = deformSeafloorVertices(sloped, { fractionX: fx, fractionZ: fz, sizeX: 819.2, sizeZ: 819.2, scale: 1, allowFlatten: false });
  assert.equal(b.flattened, false, 'an unverified spot is never flattened');
  // flattened: the ring inside the outer radius sits at the mean before the pit's fall
  const i0 = 32 * 65 + 33;   // the vertex 12.8 m east of the centre
  // every vertex, the walls' too, as the C# means them
  const mean = (() => { let s = 0, c = 0; for (let k = 0; k < sloped.length / 3; k++) { const dx = sloped[k * 3] - cx, dz = sloped[k * 3 + 2] - cz; if (dx * dx + dz * dz <= 1024) { s = f32(s + sloped[k * 3 + 1]); c++; } } return f32(s / c); })();
  const d0 = Math.hypot(sloped[i0 * 3] - cx, sloped[i0 * 3 + 2] - cz);
  assert.ok(Math.abs(a.positions[i0 * 3 + 1] - (mean - getFloorPitDepth(f32(d0), 1))) < 1e-3, 'lerped fully to the mean inside the outer radius, then the pit');
  assert.ok(Math.abs(b.positions[i0 * 3 + 1] - (sloped[i0 * 3 + 1] - getFloorPitDepth(f32(d0), 1))) < 1e-3, 'unflattened: the slope and the pit');
  assert.equal(deformSeafloorVertices(null, { fractionX: 0.5, fractionZ: 0.5, sizeX: 819.2, sizeZ: 819.2, scale: 1 }), null);
});

test('OH-B CommitExternalMeshChanges: the height grid is read back off the first 4225 vertices only', () => {
  const pos = flatFloor(-50);
  pos[1] = -60; pos[4225 * 3 + 1] = -99;
  const grid = new Float32Array(4225);
  heightGridFromPositions(pos, grid);
  assert.equal(grid[0], -60);
  assert.equal(grid[4224], -50);
  const small = new Float32Array(9).fill(-7);
  assert.equal(heightGridFromPositions(small, grid), grid, 'a mesh short of the grid leaves it');
  assert.equal(grid[0], -60, 'untouched');
});

test('OH-B RaycastFloor and FindPitOpeningY: a ray from 5 m over the sea, 1000 m down; the opening is the highest of the centre and a 12 m ring of sixteen', () => {
  assert.equal(raycastFloorY(-40, 34), -40);
  assert.equal(raycastFloorY(40, 34), null, 'a floor over the ray\'s start is missed');
  assert.equal(raycastFloorY(37, 34), 37, 'the ray starts 5 m over the sea: a floor 3 m over it is met');
  assert.equal(raycastFloorY(f32(39.5), 34), null, 'and one 5.5 m over it is not');
  assert.equal(raycastFloorY(-1000, 34), null, 'past 1000 m is missed');
  assert.equal(raycastFloorY(null, 34), null);
  const seen = [];
  const y = findPitOpeningY((x, z) => { seen.push([x, z]); return x > 100 ? -20 : -30; }, 100, 200, 34, -44, 1);
  assert.equal(seen.length, 16);
  assert.equal(y, -20, 'the ring\'s highest');
  assert.ok(seen.every(([x, z]) => Math.abs(Math.hypot(x - 100, z - 200) - 12) < 1e-3));
  assert.equal(findPitOpeningY(() => null, 0, 0, 34, -44, 1), -44, 'no ring hit keeps the centre');
});

test('OH-B names and ids: "The <Adjective> <Noun> <Ending>" off three bytes of the name hash, the GPS name with its pixel, the abyss map id', () => {
  const h = refHash(207, 213, NAME_SALT);
  assert.equal(buildDungeonName(207, 213), `The ${NAME_ADJECTIVES[h % 8]} ${NAME_NOUNS[(h >>> 8) % 8]} ${NAME_ENDINGS[(h >>> 16) % 8]}`);
  assert.equal(buildDungeonName(207, 213), 'The Drowned Gullet of the Pale Current');
  assert.equal(buildGpsDungeonName('The X', 3, 4), 'The X [3,4]');
  assert.equal(getAbyssMapId(207, 213), (0x60000000 | (213 * 1000 + 207)) >>> 0);
  assert.equal(getAbyssMapId(999, 499) & 0xfffff, 499999 & 0xfffff, 'the pixel id\'s low twenty bits');
});

test('OH-E the roster: flame enemies never; the aquatic arm Aquatic behaviour; the undead arm the Undead team less the two ancients; weights max(1, level - 5)', () => {
  for (const t of [MOBILE_TYPES.FireDaedra, MOBILE_TYPES.FireAtronach, MOBILE_TYPES.Dragonling, MOBILE_TYPES.Dragonling_Alternate]) {
    assert.ok(isFlameEnemy(t));
    assert.equal(isEligibleUnderwaterReplacement(t, false, false), null);
  }
  assert.equal(isFlameEnemy(MOBILE_TYPES.IceAtronach), false);
  assert.ok(isEligibleUnderwaterReplacement(MOBILE_TYPES.Dreugh, false, true), 'the dreugh is aquatic');
  assert.equal(isEligibleUnderwaterReplacement(MOBILE_TYPES.Zombie, false, true), null);
  assert.ok(isEligibleUnderwaterReplacement(MOBILE_TYPES.Zombie, true, false), 'the zombie is undead');
  assert.equal(isEligibleUnderwaterReplacement(MOBILE_TYPES.AncientLich, true, false), null);
  assert.equal(isEligibleUnderwaterReplacement(MOBILE_TYPES.VampireAncient, true, false), null);
  assert.equal(isEligibleUnderwaterReplacement(MOBILE_TYPES.Lamia, true, false), null, 'not undead');
  const rows = { 1: { level: 3, behaviour: 2, team: 'Aquatic' }, 2: { level: 10, behaviour: 2, team: 'Aquatic' }, 3: { level: 20, behaviour: 0, team: 'Undead' } };
  const rowOf = (t) => rows[t] ?? null;
  // weights: 1 -> 1, 2 -> 5, 3 -> 15; total 21
  assert.equal(tryPickUnderwaterEnemy(0, false, false, [1, 2, 3], rowOf), 1);
  assert.equal(tryPickUnderwaterEnemy(1, false, false, [1, 2, 3], rowOf), 2);
  assert.equal(tryPickUnderwaterEnemy(5, false, false, [1, 2, 3], rowOf), 2);
  assert.equal(tryPickUnderwaterEnemy(6, false, false, [1, 2, 3], rowOf), 3);
  assert.equal(tryPickUnderwaterEnemy(21, false, false, [1, 2, 3], rowOf), 1, 'the hash is taken mod the total');
  assert.equal(tryPickUnderwaterEnemy(3, false, true, [1, 2, 3], rowOf), 2, 'the aquatic arm: 1 + 5, the hash 3 lands on the second');
  assert.equal(tryPickUnderwaterEnemy(3, true, false, [1, 2], rowOf), null, 'nothing weighs');
  assert.equal(enemyHash(10, 20, 5), refHash(10 ^ 5, 20 ^ 0, ENEMY_SALT));
  assert.equal(enemyHash(10, 20, 2 ** 40 + 7), refHash(10 ^ 7, 20 ^ 256, ENEMY_SALT), 'the high word is the second coordinate\'s');
});

test('OH-E IsDungeonLightFixture and NextArmorMaterial: the torch flats and the lights archive\'s 7-13 and 22-27; the armour ladder a step up, daedric stays', () => {
  for (const r of [0, 1, 6, 16, 17, 18, 19, 20, 7, 13, 22, 27]) assert.ok(isDungeonLightFixture(210, r), `210.${r}`);
  for (const r of [2, 3, 4, 5, 14, 15, 21, 28]) assert.equal(isDungeonLightFixture(210, r), false, `210.${r}`);
  assert.equal(isDungeonLightFixture(211, 7), false);
  assert.equal(nextArmorMaterial(0), 256, 'leather to chain');
  assert.equal(nextArmorMaterial(256), 512);
  assert.equal(nextArmorMaterial(259), 512);
  assert.equal(nextArmorMaterial(512), 513);
  assert.equal(nextArmorMaterial(520), 521, 'ebony to daedric');
  assert.equal(nextArmorMaterial(521), 521, 'daedric stays');
  assert.equal(nextArmorMaterial(257), 257);
});

/** A location at (px, py) with a w x h exterior. */
function loc(px, py, { w = 1, h = 1, type = 6, blocks = 3, mapId = px * 7 + py, loaded = true, hasDungeon = true, name = 'X' } = {}) {
  const ll = mapPixelToLongitudeLatitude(px, py);
  return {
    loaded, hasDungeon, name, regionIndex: 0, locationIndex: 0,
    mapTableData: { mapId, longitude: ll.x, latitude: ll.y, dungeonType: type },
    exterior: { exteriorData: { width: w, height: h, blockNames: ['RESIAA00.RMB'] } },
    dungeon: { blocks: Array.from({ length: blocks }, (_, i) => ({ blockName: `B${i}.RDB`, waterLevel: 10000 })) },
  };
}

test('OH-D TryGetTemplateSavePosition: the first of the pixel\'s four corners 4096 clear of the location\'s rect', () => {
  const l = loc(100, 100);
  const origin = mapPixelToWorldCoord(100, 100);
  const rect = getLocationRect(l);
  assert.equal(rect.xMax - rect.xMin, 4096);
  const p = tryGetTemplateSavePosition(l);
  assert.deepEqual(p, { x: origin.x + 64, y: origin.y + 64 }, 'a one-block town leaves the SW corner clear');
  const big = loc(100, 100, { w: 8, h: 8 });
  assert.equal(tryGetTemplateSavePosition(big), null, 'an 8 x 8 exterior plus 4096 covers every corner');
});

test('OH-D TryFindTemplate: a region and a location by the template hash, the first unlinked type-6 taken at once, else the first suitable one', () => {
  const regions = [
    [loc(10, 10, { type: 3 }), loc(11, 10, { type: 0, mapId: 111 }), loc(12, 10, { type: 6, blocks: 1 })],
    [loc(20, 20, { type: 6, mapId: 202 }), loc(21, 20, { type: 5 })],
  ];
  const maps = { regionCount: 2, locationCount: (r) => regions[r].length, location: (r, i) => regions[r][i] };
  const px = 5, py = 9;
  const hash = refHash(px, py, TEMPLATE_SALT);
  const r = tryFindTemplate(px, py, maps, () => 0, () => false);
  assert.ok(r, 'found');
  assert.equal(r.template.mapTableData.mapId, 202, 'the only unlinked type-6 wins wherever the walk starts');
  assert.ok(SUITABLE_TEMPLATE_DUNGEON_TYPES.has(0));
  const linked = tryFindTemplate(px, py, maps, (id) => (id === 202 ? 1 : 0), () => false);
  assert.notEqual(linked.template.mapTableData.mapId, 202, 'a quest-linked dungeon is never borrowed');
  assert.ok([111, 21 * 7 + 20].includes(linked.template.mapTableData.mapId), 'the first suitable one the walk met');
  const main = tryFindTemplate(px, py, maps, () => 0, (id) => id === 202);
  assert.notEqual(main.template.mapTableData.mapId, 202, 'never a main-story dungeon');
  assert.equal(isSuitableTemplate(loc(1, 1, { blocks: 1 }), () => false), false, 'two blocks at least');
  assert.equal(isSuitableTemplate(loc(1, 1, { type: 1 }), () => false), false, 'a type it does not borrow');
  assert.equal(isSuitableTemplate(loc(1, 1, { loaded: false }), () => false), false);
  assert.equal(isSuitableTemplate(loc(1, 1, { hasDungeon: false }), () => false), false);
  assert.equal(tryFindTemplate(0, 0, { regionCount: 0 }, () => 0, () => false), null);
  assert.equal(hash >>> 0, hash);
});

test('OH-D CloneDungeon and WaterizeDungeon\'s level: the struct copied and renamed with its own blocks array; the water over the tallest mesh', () => {
  const t = loc(3, 3);
  const c = cloneDungeon(t, 'The Sunken Vault of Black Salt');
  assert.equal(c.name, 'The Sunken Vault of Black Salt');
  assert.equal(t.name, 'X', 'the template keeps its name');
  assert.notEqual(c.dungeon.blocks, t.dungeon.blocks);
  c.dungeon.blocks[0].waterLevel = -500;
  assert.equal(t.dungeon.blocks[0].waterLevel, 10000, 'the clone\'s water is its own');
  // start 10 m up, meshes to 30 m: the water a metre over the tallest, from a dungeon at 0
  assert.equal(abyssWaterLevel(10, 30, 0), Math.round(-31 / 0.025));
  assert.equal(abyssWaterLevel(10, 5, 0), Math.round(-(10 + 3 + 1) / 0.025), 'never under 3 m over the start (+1)');
  assert.equal(abyssWaterLevel(10, 5, 2), Math.round(-(12) / 0.025), 'measured from the dungeon\'s origin');
  assert.equal(abyssWaterLevel(0, 5000, 0), -32767, 'clamped to a short');
});

test('OH-C CreateDiscMesh and CreateMiasmaTexture: 49 vertices, 96 triangles (each wedge both ways), normals up; a 32 x 32 white puff', () => {
  const d = createDiscMesh();
  assert.equal(d.positions.length, 49 * 3);
  assert.equal(d.indices.length, 288);
  assert.deepEqual([...d.indices.slice(0, 6)], [0, 2, 1, 0, 1, 2]);
  assert.deepEqual([...d.indices.slice(282)], [0, 1, 48, 0, 48, 1], 'the last wedge closes on the first rim vertex');
  for (let i = 0; i < 49; i++) assert.equal(d.normals[i * 3 + 1], 1);
  assert.ok(Math.abs(Math.hypot(d.positions[3], d.positions[5]) - 1) < 1e-6, 'a unit disc');
  const tex = createMiasmaTexture();
  assert.equal(tex.pixels.length, 32 * 32 * 4);
  const a = (x, y) => tex.pixels[(y * 32 + x) * 4 + 3];
  assert.ok(a(16, 16) > 200, 'dense at the centre');
  assert.equal(a(0, 0), 0, 'nothing in the corner');
  assert.equal(tex.pixels[0], 255, 'white');
});

test('OH-E GetMidpointColor: low to the midpoint over the first half, the midpoint to high over the second', () => {
  const low = [1, 1, 1, 1], mid = [0.5, 0.5, 0.5, 1], high = [0, 0, 0, 1];
  assert.deepEqual(getMidpointColor(0, low, mid, high), low);
  assert.deepEqual(getMidpointColor(0.5, low, mid, high), mid);
  assert.deepEqual(getMidpointColor(1, low, mid, high), high);
  assert.deepEqual(getMidpointColor(0.75, low, mid, high).slice(0, 3), [0.25, 0.25, 0.25]);
  assert.equal(ABYSS_FOG_COLOR[0], f32(0.012));
  assert.equal(MINIMUM_DEPTH, 70);
  assert.equal(MINIMUM_EDGE_DISTANCE, 256);
});

test('OH-C CreateSurfaceMiasma: 2 x count / 72 a second, capped at max(1, count), a 5 s prewarm, 30 s lives, the plume\'s rise and the size curve\'s four keys', async () => {
  const { createMiasma, evaluateSizeCurve, DEFAULT_DURATION } = await import('../../src/world/oceanHolesMiasma.js');
  let seed = 7;
  const roll = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const m = createMiasma({ count: 72, height: 300, radius: 19, roll });
  assert.equal(m.rate, 2);
  assert.equal(m.max, 72);
  assert.equal(DEFAULT_DURATION, 5);
  assert.ok(m.particles.length >= 9 && m.particles.length <= 10, `the prewarm is one 5 s loop at 2 a second (${m.particles.length})`);
  for (const q of m.particles) {
    assert.ok(Math.hypot(q.p[0] - q.v[0] * q.age, q.p[2] - q.v[2] * q.age) <= 19 + 1e-9, 'born inside the circle');
    assert.ok(q.v[0] >= -0.12 && q.v[0] <= 0.12 && q.v[2] >= -0.12 && q.v[2] <= 0.12);
    assert.ok(q.v[1] >= f32(f32(300 / 30) * 0.85) && q.v[1] <= 10, 'the rise is 0.85v..v, v the plume over a life');
    assert.ok(q.size >= 3 && q.size <= 6 && q.rot >= 0 && q.rot <= Math.PI * 2);
  }
  m.step(30);
  assert.ok(m.particles.every((q) => q.age < 30), 'a life is thirty seconds');
  const none = createMiasma({ count: 0, height: 300, radius: 19, roll });
  assert.equal(none.max, 1);
  assert.equal(none.particles.length, 0, 'no rate, no puffs');
  const busy = createMiasma({ count: 2, height: 300, radius: 19, roll });
  busy.step(1000);   // a frame long enough to owe 55 puffs
  assert.equal(busy.particles.length, 2, 'maxParticles caps the emission');
  assert.equal(evaluateSizeCurve(0), 0);
  assert.equal(evaluateSizeCurve(0.02), 1);
  assert.equal(evaluateSizeCurve(0.5), 1);
  assert.equal(evaluateSizeCurve(0.9), 1);
  assert.equal(evaluateSizeCurve(1), 0);
  assert.ok(Math.abs(evaluateSizeCurve(0.01) - 0.5) < 1e-9, 'flat tangents: the span a smoothstep');
  assert.ok(Math.abs(evaluateSizeCurve(0.005) - 0.15625) < 1e-9, 'a quarter in: 0.25^2 x (3 - 0.5), not a quarter');
  assert.ok(Math.abs(evaluateSizeCurve(0.95) - 0.5) < 1e-9);
  assert.equal(m.sizeOf({ size: 4, age: 15, life: 30 }), 4);
});
