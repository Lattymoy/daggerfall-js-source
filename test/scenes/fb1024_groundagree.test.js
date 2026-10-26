// FIELD BUGS 2026-10-24 (bible/01-Overview/bugs/Field-Bugs-2026-10-24b.md) - "players seeing other players underneath the
// ground", and the foes those players spawn out of reach, mostly at world events outside the breach portals with a crowd
// about. A pose and a foe record carry a height on their sender's own ground, so two clients that build one pixel on two
// grounds see each other sunk or floating. Two of a client's own beliefs moved the ground on the same build:
//   GROUND-AGREE - a spawned dungeon levels its whole pixel (DFU's BlendLocationTerrain), and whether one stands is each
//     client's clocks at the moment it built the pixel; the ground now follows the roll alone (world/spawnGroundPlace.js);
//   GATE-AGREE - a clearing (the gate's, every Elite Breach arch this client believes, each fallen star) refused a World of
//     Daggerfall site at its pick, and the pick is what levels the ground; a clearing now holds the site's objects alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WoodsFile, MAP_WIDTH, MAP_HEIGHT } from '../../src/formats/woodsFile.js';
import { generatePixelTerrain } from '../../src/world/terrain/terrainGen.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../src/world/terrain/terrainSampler.js';
import { locationFootprintRect } from '../../src/world/terrain/terrainTiles.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { LocationSession, pickLocations } from '../../src/world/worldOfDaggerfall/wodLocationLoader.js';
import { gateClearFor, gateSiteTest, GATE_CLEAR_M } from '../../src/world/gate/gateClearance.js';
import { wodSiteClear } from '../../src/world/road/roadClearance.js';
import { createSpawnGroundPlace } from '../../src/world/spawnGroundPlace.js';
import { spawnsDungeon, WORLD_SALT } from '../../src/world/spawnedDungeons.js';
import { ETHER_BOX } from '../../src/world/ethericSea.js';
import { wildMaskOf, wildInside, WILD_REGION } from '../../src/systems/wild/wildZone.js';
import { syntheticWoodsBytes } from '../landformWorld.mjs';
import { hostText } from '../hostText.mjs';

const woods = new WoodsFile();
woods.load(syntheticWoodsBytes());
const METRES = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
const climates = new Uint8Array(MAP_WIDTH * MAP_HEIGHT).fill(CLIMATES.Mountain);
/** The most two grounds part anywhere in the pixel, metres. */
const most = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]) * METRES); return m; };
const ground = (px, py, job = {}) => generatePixelTerrain({ woods, px, py, stride: 1, tilemap: new Uint8Array(128 * 128), climateType: CLIMATES.Mountain, climates, landform: true, ...job }).samples;

/** The first pixel at or after (x0, y) whose spawn roll stands a dungeon, or misses one when `wanted` is false. */
function rolledPixel(x0, y, wanted = true) {
  for (let x = x0; ; x++) if (spawnsDungeon(WORLD_SALT, x, y) === wanted) return [x, y];
}

/**
 * The law over a fake world: every pixel land with a dry plateau, no road network yet, and no open zone - unless the
 * case says otherwise. `asked` records each clone the law asks for.
 */
function makeLaw(overrides = {}) {
  const asked = [];
  const handles = {
    maps: { getClimateIndex: () => CLIMATES.Woodlands },
    online: true,
    etherSea: true,
    plateauDry: () => true,
    terrainGen: { roads: () => null },
    cloneAt: (px, py) => {
      asked.push([px, py]);
      return { name: `Spawn ${px},${py}` };
    },
    spawnGone: () => false,
    ...overrides,
  };
  return { law: createSpawnGroundPlace(handles), asked };
}

test('GROUND-AGREE the ground\'s place (world/spawnGroundPlace.js): what stands, else online the spawn the roll stands, alive or dead - none offline, past the Veil, in the open zone or where the roll stands none (mutants: the stood ignored; the clocks asked; offline; past the Veil; in the zone; the roll transposed)', () => {
  const [sx, sy] = rolledPixel(300, 250);
  const [nx, ny] = rolledPixel(300, 250, false);
  const town = { name: 'Town' };

  let { law, asked } = makeLaw();
  assert.equal(law.groundLocationAt(sx, sy, town), town, 'what stands is the ground\'s place');
  assert.deepEqual(asked, [], 'and no spawn is asked of a pixel where something stands');
  assert.deepEqual(law.groundLocationAt(sx, sy, null), { name: `Spawn ${sx},${sy}` }, 'a pixel nothing stands on: the roll\'s spawn');
  assert.deepEqual(asked, [[sx, sy]], 'cloned for its own pixel');
  assert.equal(law.groundLocationAt(nx, ny, undefined), null, 'a pixel the roll stands no spawn on shapes no place');
  if (!spawnsDungeon(WORLD_SALT, sy, sx)) assert.equal(law.groundLocationAt(sy, sx, null), null, 'nor the spawn pixel\'s mirror');

  ({ law } = makeLaw({ spawnGone: () => true }));
  assert.deepEqual(law.groundLocationAt(sx, sy, null), { name: `Spawn ${sx},${sy}` }, 'a spawn whose clocks have run out still shapes the ground - every client\'s the same');
  assert.equal(law.spawnAt(sx, sy), null, 'while the Overworld, which asks the clocks, marks none there');

  ({ law } = makeLaw({ online: false }));
  assert.equal(law.groundLocationAt(sx, sy, null), null, 'offline no spawn stands, so none shapes the ground');

  const [ex, ey] = rolledPixel(ETHER_BOX.x0 + 10, ETHER_BOX.y0 + 10);
  ({ law } = makeLaw());
  assert.equal(law.groundLocationAt(ex, ey, null), null, 'past the Veil the isles stand their own places');
  ({ law } = makeLaw({ etherSea: false }));
  assert.deepEqual(law.groundLocationAt(ex, ey, null), { name: `Spawn ${ex},${ey}` }, 'with no Eltheric Ocean that box is no isle\'s');

  // the whole fake map is the zone's region; the zone is the cut of it the mask keeps
  const zoneMaps = { getClimateIndex: () => CLIMATES.Woodlands, getRegionIndexAt: () => WILD_REGION };
  const mask = wildMaskOf(zoneMaps);
  let zoned = null;
  for (let y = 0; y < 500 && !zoned; y++) for (let x = 0; x < 1000 && !zoned; x++) if (wildInside(mask, x, y) && spawnsDungeon(WORLD_SALT, x, y)) zoned = [x, y];
  assert.ok(zoned, 'a spawn pixel in the open zone');
  ({ law } = makeLaw({ maps: zoneMaps }));
  assert.equal(law.groundLocationAt(zoned[0], zoned[1], null), null, 'in the open zone only a hall stands, and a hall is `stood`');
});

test('GROUND-AGREE the spawn the roll stands (world/spawnGroundPlace.js spawnAt): the sea, a wet plateau and a path across the pixel stand none; before the road network lands a spawn stands provisionally (mutants: the clocks asked anyway)', () => {
  const [sx, sy] = rolledPixel(300, 250);
  const spawn = { name: `Spawn ${sx},${sy}` };
  assert.deepEqual(makeLaw().law.spawnAt(sx, sy), spawn, 'land, dry, no network yet: the spawn');
  assert.equal(makeLaw({ maps: { getClimateIndex: () => CLIMATES.Ocean } }).law.spawnAt(sx, sy), null, 'the sea');
  assert.equal(makeLaw({ plateauDry: () => false }).law.spawnAt(sx, sy), null, 'a wet plateau (SPAWN-SHORE)');
  const crossed = { roads: new Uint8Array(1000 * 500).fill(1), tracks: new Uint8Array(1000 * 500) };
  assert.equal(makeLaw({ terrainGen: { roads: () => crossed } }).law.spawnAt(sx, sy), null, 'a path across the pixel (SPAWN-ROADS)');
  const clear = { roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500) };
  assert.deepEqual(makeLaw({ terrainGen: { roads: () => clear } }).law.spawnAt(sx, sy), spawn, 'a network with no path here: the spawn');
  const gone = makeLaw({ spawnGone: () => true }).law;
  assert.equal(gone.spawnAt(sx, sy), null, 'its clocks run out: none');
  assert.deepEqual(gone.spawnAt(sx, sy, { clocks: false }), spawn, 'the clocks not asked: the spawn, alive or dead');
});

test('GROUND-AGREE by source: the pixel build shapes its ground - the blend, the tiles, World of Daggerfall\'s pick, the woods\' and the jungle\'s clearings - for the ground\'s place, and stands only what stands; the lift reads the same place (mutants: the build shapes the stood; the rect the stood\'s; the pick the stood\'s)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const dfLocation = _locationToBuild\(px, py\) \|\| null;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*const groundLocation = spawnGroundPlace\.groundLocationAt\(px, py, dfLocation\);/, 'asked once, beside what stands');
  assert.match(w, /if \(groundLocation\) locationRect = setLocationTiles\(groundLocation, maps, blocks, seedTilemap\);/, 'the rect and the tiles');
  assert.equal(w.match(/hasLocation: !!groundLocation/g)?.length, 2, 'World of Daggerfall\'s pick and the kernel\'s blend');
  assert.doesNotMatch(w, /hasLocation: !!dfLocation/, 'nothing shapes ground by what stands alone');
  assert.equal(w.match(/FOREST_HIDDEN_LOCATION_TYPES\.has\(groundLocation\?\.mapTableData\?\.locationType\)/g)?.length, 2, 'the woods\' and the jungle\'s clearings');
  assert.match(w, /location: dfLocation \? dfLocation\.name : null,/, 'what stands is still the clocks\' (tvSpawnGone reads it)');
  assert.match(w, /const spawnGroundPlace = createSpawnGroundPlace\(\{/, 'the host makes the law once');
  assert.match(w, /_livingPatrons, _locationToBuild, spawnGroundPlace, _lptSway,/, 'and hands the build its ground\'s place');
  assert.match(w, /const _liftLocationAt = \(x, y\) => spawnGroundPlace\.groundLocationAt\(x, y, locationIndex\.get\(`\$\{x\},\$\{y\}`\)\);/, 'and the lift reads it for a pixel not built yet');
  assert.match(w, /const tvSpawnAt = spawnGroundPlace\.spawnAt;/, 'and the Overworld\'s far found spawn is the same law, the clocks asked');
});

test('GROUND-AGREE on the real producer: a ruin\'s blend moves its pixel\'s ground by metres - a client that built the pixel with its spawn dead stood every peer there sunk or floating - and the ground is now the same whether it stands or not', () => {
  const ruin = { exterior: { exteriorData: { width: 1, height: 1, blockNames: ['RUIN'] } }, mapTableData: { locationType: 10 } };
  const rect = locationFootprintRect(ruin);
  const bare = ground(350, 230), level = ground(350, 230, { hasLocation: true, locationRect: rect });
  const m = most(bare, level);
  assert.ok(m > 1.7, `the blend moves the ground ${m.toFixed(1)} m on a mountain pixel - past a sword's reach of a foe stood on the other ground`);
  // the build hands the kernel the ground's place alive or dead (above), so both clients' jobs are this one
  assert.deepEqual([...ground(350, 230, { hasLocation: true, locationRect: rect })], [...level], 'one job, one ground');
});

test('GATE-AGREE on the real producer: a clearing holds a whole site\'s objects and keeps its pick, so the ground under it is the same with the clearing or without; the old law - refused at its pick - moved it (mutants: the clearing decides the pick; a held pick stands; held picks off the ground)', () => {
  const camp = { width: 16, height: 16, obj: [{ pos: { x: 0, y: 0, z: 0 } }, { pos: { x: 30, y: 0, z: 0 } }] };
  const session = new LocationSession();
  session.appendRegion(1, {
    count: 1, worldX: [350], worldY: [230], terrainX: [40], terrainY: [64], type: [2], locationID: [1], name: ['a'], prefab: ['WOD_BanditCamp_01'],
  });
  const tile = { mapPixelX: 350, mapPixelY: 230, hasLocation: false, worldHeight: 10 };
  // an arch's clearing over the camp's first object (tile 40, 64 is 256, 409.6 m) - believed by one client, not by another
  const clear = gateClearFor({ day: 1, px: 350, py: 230, spot: [256 + GATE_CLEAR_M / 2, 409.6] });
  const road = (n, pf, r) => wodSiteClear(null, 350, 230, n, pf, r);
  const kernelOf = (picks) => ground(350, 230, { wod: picks.length ? { picks: picks.map((p) => ({ flatten: p.flatten, rect: p.rect, hide: true })) } : null });
  // the host's composition (scenes/pixelBuild.js): the road alone picks; the clearing asks each pick
  const picked = pickLocations(tile, session, () => camp, null, road);
  const believed = { refused: false, reach: [] }, unaware = { refused: false, reach: [] };
  const heldThere = picked.map((p) => !gateSiteTest(clear, 350, 230, believed)(session.prefab[p.index], p.prefab, p.rect));
  const heldHere = picked.map((p) => !gateSiteTest(null, 350, 230, unaware)(session.prefab[p.index], p.prefab, p.rect));
  assert.deepEqual([heldThere, heldHere], [[true], [false]], 'the client that believes the arch holds the camp; the other stands it');
  assert.equal(believed.refused, true, 'and remembers the clearing cost it a site (the sweep stands it again when the arch goes)');
  // both clients hand the kernel every pick, held or not (the host's `wod: wodPicks ?` - test/world/gate/gateclear.test.js),
  // so both stand the ground kernelOf(picked) makes
  // the old law: the clearing refused the camp at its pick, so the client that believed the arch built no flatten
  const oldPicks = pickLocations(tile, session, () => camp, null, (n, pf, r) => road(n, pf, r) && gateSiteTest(clear, 350, 230, { refused: false, reach: [] })(n, pf, r));
  assert.deepEqual(oldPicks, [], 'refused at its pick');
  const m = most(kernelOf(picked), kernelOf(oldPicks));
  assert.ok(m > 1.7, `and the two clients' grounds parted by ${m.toFixed(1)} m in the camp's pixel`);
});
