// PITS-WORLD (2026-10-27, bible/03-World/World-Wide.md WORLD-LANES; the audit NO SYSTEM LEFT BEHIND IN THE BAY item 35): There's
// a Hole in the Bottom of the Ocean's pits stood on the Bay's map alone - ETHER-DEEP held them there because a pit's drowned
// dungeon was named by its pixel's id's low twenty bits (world/oceanHoles.js GetAbyssMapId), the Bay's 1000 x 500 alone
// apart: past it a pit a thousand pixels from a Bay pit would have shared its abyss. TAMRIEL-DEEP carves the continent's
// sea now, so the key was the only thing in the way. The owner's call taken ("Every single thing here needs to be
// addressed. No exceptions.", 2026-10-26): the abyss past the Bay in a world id lane; and the open PvP zone stands none.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { getAbyssMapId, isAbyssMapId, pitPixelOk, isPitPixel } from '../../src/world/oceanHoles.js';
import { createOceanHoles, openZoneAtNow } from '../../src/scenes/oceanHolesHost.js';
import { worldLaneMapId, worldLanePixel, ABYSS_WORLD_LANE, SPAWN_WORLD_LANE } from '../../src/world/worldWide/worldLanes.js';
import { spawnedMapId, WORLD_SALT } from '../../src/world/spawnedDungeons.js';
import { spawnedHallMapId, isWorldRoom, isHallMapId } from '../../src/net/wire.js';
import { discoveryKeyOf } from '../../src/systems/discovery.js';
import { countryPlaceId } from '../../src/world/tamrielCountry.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { capitalPlaceId } from '../../src/world/tamrielCapitals.js';
import { arenaPlaceId } from '../../src/world/arenaLocations.js';
import { hasDock, nearDock } from '../../src/systems/immersiveTravel.js';
import { hostText } from '../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const SIZE = 819.2;
const OCEAN_LOCAL_Y = 34;

test('PITS-WORLD the abyss\'s id (world/oceanHoles.js getAbyssMapId): the Bay\'s the mod\'s own to the bit on every pixel of its map; past the Bay the world\'s abyss lane - every pit its own abyss, where one a thousand pixels off a Bay pit shared it (mutants: the lane gone, the Bay\'s arm read everywhere)', () => {
  for (let y = 0; y < 500; y++) for (let x = 0; x < 1000; x++) {
    if (getAbyssMapId(x, y) !== ((0x60000000 | (y * 1000 + x)) >>> 0)) assert.fail(`the Bay's ${x},${y}`);
  }
  for (const [x, y] of [[2441, 1500], [1215, 370], [-1, 250], [4000, -5000], [1000, 0], [0, 500], [-8191, 8191]]) {
    const id = getAbyssMapId(x, y);
    assert.deepEqual([id, worldLanePixel(id)], [worldLaneMapId(ABYSS_WORLD_LANE, x, y), [x, y]], `${x},${y}`);
    assert.ok(id >= 0x60000000 && id < 0x80000000 && (id & 0xfffff) >= 500000, 'in the abyss\'s own range, its low bits no Bay pixel\'s');
    assert.equal(discoveryKeyOf(id), id, 'filed by its whole id (TESA II P6)');
    assert.ok(isWorldRoom(`dungeon:m${id}`), 'a world room the relay keeps');
    assert.ok(!hasDock(id) && !nearDock(id), 'no dock of Immersive Travel\'s');
  }
  // the old law: (1215, 370) is pixel id 371,215 - the Bay's (215, 371) - and the two pits shared one abyss
  assert.notEqual(getAbyssMapId(1215, 370), getAbyssMapId(215, 371), 'a pit past the Bay is no Bay pit\'s abyss');
  const ids = new Set();
  for (let y = -2; y <= 2; y++) for (let x = 997; x <= 1002; x++) ids.add(getAbyssMapId(x, y + 499));
  assert.equal(ids.size, 30, 'every pit its own across the Bay\'s edge');
  assert.throws(() => getAbyssMapId(8192, 0), RangeError, 'off the world\'s grid no abyss is named');
});

test('PITS-WORLD isAbyssMapId: the Bay\'s abyss and the world\'s abyss lane alone - never a zone hall\'s (whose id from 0xf0000000 opened the Ocean Holes\' page), an Abyss Dungeon\'s, a spawn\'s (the Bay\'s or the world\'s), a MAPS row\'s, a lair\'s, a capital\'s or Arena\'s (mutants: the Bay\'s bound, the lane read back)', () => {
  for (const [x, y] of [[0, 0], [999, 499], [392, 338], [2441, 1500], [-1, 250], [4000, -5000]]) assert.equal(isAbyssMapId(getAbyssMapId(x, y)), true, `${x},${y}`);
  const others = [0, 1, 0x7283288c, (0x600 << 20) | 500000, ((0x600 << 20) | 0xfffff) >>> 0 & ~0x80000, spawnedMapId(1, 392, 338), spawnedMapId(2049, 0, 0), spawnedMapId(4095, 999, 499),
    spawnedMapId(WORLD_SALT, 2441, 1500), worldLaneMapId(SPAWN_WORLD_LANE, -8191, -8191), spawnedHallMapId(2160, 720), spawnedHallMapId(-8192, -8192),
    lairPlaceId(5), countryPlaceId(1234), capitalPlaceId(3), arenaPlaceId({ provinceIndex: 2, id: 7 }), 0x80000000, 0xffffffff, -1, 2 ** 32, 0.5, null, 'x'];
  for (const id of others) assert.equal(isAbyssMapId(id), false, String(id));
  assert.equal(isHallMapId(spawnedHallMapId(2160, 720)), true);
  assert.ok(spawnedHallMapId(2160, 720) >= 0x60000000, 'a hall\'s id was one the old readers took for an abyss');
});

test('PITS-WORLD the hold (pitPixelOk): IsValidMapPixel\'s, the Bay\'s map, now the world\'s grid - where an abyss has an id (mutants: the hold the Bay\'s)', () => {
  for (const [x, y] of [[0, 0], [999, 499], [1000, 0], [-1, 250], [4000, -5000], [8191, -8191], [-8191, 8191]]) assert.equal(pitPixelOk(x, y), true, `${x},${y}`);
  for (const [x, y] of [[8192, 0], [0, -8192], [1.5, 2], [NaN, 0]]) assert.equal(pitPixelOk(x, y), false, `${x},${y}`);
});

/** The pit host (scenes/oceanHolesHost.js) over a fake Iliac Puddle No More whose floor stands deep at every pixel. */
function rig({ openZoneAt, bake = null } = {}) {
  const built = new Map(), pits = [], floors = new Map(), log = [];
  const deepWaters = {
    bake: bake ?? { loaded: true, mapPixelHasWaterCells: () => true, mapPixelHasLandCells: () => false, isCarvedWater: () => true, sampleEdgeDistanceMeters: () => 1000 },
    oceanLocalY: OCEAN_LOCAL_Y,
    isSeafloorCurrent: (e) => floors.has(e), seafloorBuildVersion: (e) => (floors.has(e) ? 1 : -1), tryGetSeafloor: (e) => floors.get(e) ?? null,
    commitSeafloorChanges(e, positions) { log.push(['commit', e.px, e.py]); floors.get(e).positions = Float32Array.from(positions); for (let i = 0; i < 4225; i++) floors.get(e).vertexLocalY[i] = positions[i * 3 + 1]; return true; },
    refreshLoadedTile() {},
  };
  const oh = createOceanHoles({
    deepWaters, built, pixelTranslation: (px, py) => [px * SIZE, 0, -py * SIZE], hasLocation: () => false, worldClimateOf: () => 223,
    pits: { create: (e, pit) => { pits.push([e.px, e.py, pit]); return {}; }, destroy: () => {} },
    settings: () => ({ surfaceHoleRadius: 20, seafloorHoleScale: 1, pitSpawnRate: 0.5, miasmaParticleCount: 72, miasmaHeight: 300, dungeonVisualIntensity: 0.5, dungeonVisualDarkness: 0.5 }),
    warn: () => {}, ...(openZoneAt ? { openZoneAt } : {}),
  });
  const stand = (px, py, floorY = OCEAN_LOCAL_Y - 150) => {
    const e = { px, py };
    built.set(`${px},${py}`, e);
    const positions = [], vertexLocalY = new Float32Array(65 * 65);
    for (let i = 0; i < 65; i++) for (let j = 0; j < 65; j++) { positions.push(j * SIZE / 64, floorY, i * SIZE / 64); vertexLocalY[i * 65 + j] = floorY; }
    floors.set(e, { positions: Float32Array.from(positions), vertexLocalY, floorQuadWater: null });
    oh.promoted(e); oh.update();
    return oh.stateOf(e).diagnostic;
  };
  return { oh, pits, log, stand };
}
const pitAt = (x0, y) => { for (let x = x0; ; x++) if (isPitPixel(x, y, 0.5)) return [x, y]; };

test('PITS-WORLD the host: a pixel the hash picks past the Bay - the continent\'s sea and the Eltheric Ocean\'s - is cut and its pit stood as the Bay\'s; in the open zone none (mutants: the zone\'s gate gone)', () => {
  const r = rig();
  for (const at of [pitAt(2441, 1500), pitAt(4000, -5000), pitAt(-500, 250), pitAt(300, 200)]) assert.equal(r.stand(...at), 'built', `${at}`);
  assert.equal(r.pits.length, 4);
  const zone = new Set();
  const z = rig({ openZoneAt: (x, y) => zone.has(`${x},${y}`) });
  const [lx, ly] = pitAt(2160, 720);
  zone.add(`${lx},${ly}`);
  assert.equal(z.stand(lx, ly), 'rejected:open-zone', 'Lake Rumare\'s water is the zone\'s');
  assert.deepEqual([z.pits.length, z.log.length], [0, 0], 'no pit, no cut');
  assert.equal(z.stand(...pitAt(2441, 1500)), 'built', 'outside it, the pit');
});

test('PITS-WORLD the open zone\'s ask (scenes/oceanHolesHost.js openZoneAtNow): offline there is no zone, whatever the shape says; online none before the trace lands (cyrodiilMask\'s own law) (mutants: the online gate)', () => {
  const was = globalThis.location;
  try {
    globalThis.location = /** @type {any} */ ({ search: '' });
    assert.equal(openZoneAtNow(2160, 720), false, 'offline: no zone');
    globalThis.location = /** @type {any} */ ({ search: '?online=1' });
    assert.equal(openZoneAtNow(2160, 720), false, 'online, no trace: no zone');
  } finally { globalThis.location = was; }
});

test('PITS-WORLD by source: the dungeon host knows the abyss by its own law - a lair\'s home and the tutorial\'s page - and the abyss renames its dungeon by its pit\'s id', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /\|\| isAbyssMapId\(dfLocation\?\.mapTableData\?\.mapId\)\); \}/);
  assert.match(d, /: isAbyssMapId\(dfLocation\?\.mapTableData\?\.mapId\) \? 'ocean-holes'/);
  assert.doesNotMatch(d, />= 0x60000000/, 'no reader takes a range for the abyss');
  assert.match(rd('src/scenes/oceanHolesAbyss.js'), /const abyssMapId = \(\) => getAbyssMapId\(data\.PitMapX, data\.PitMapY\);/);
  assert.match(rd('src/scenes/oceanHolesHost.js'), /if \(openZoneAt\(st\.mapX, st\.mapY\)\) \{\n\s*markTerrainProcessed\(st, v, 'rejected:open-zone'\);\n\s*return;\n\s*\}/);
  assert.doesNotMatch(hostText('src/scenes/world.js'), /openZoneAt/, 'the host hands nothing: the module asks the zone itself');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD'].every((n) => existsSync(join(ARENA2, n)));
test('PITS-WORLD with ARENA2: over the player\'s own picture and the continent\'s carved sea (TAMRIEL-DEEP\'s bake), the pits past the Bay stand where the bake verifies the deep - the Topal Bay\'s open water; online the zone\'s water (Lake Rumare, the Niben) stands none', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundWoods } = await import('../../src/world/tamriel/tamrielGround.js');
  const { TamrielWatersBake } = await import('../../src/world/tamrielWatersBake.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const was = globalThis.location;
  try {
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const real = rig({ bake: new TamrielWatersBake({ woods: groundWoods(woods) }) });   // the continent's own bake, its floors 150 m down
    // the Topal Bay's open water, 24 x 24 pixels: every pit the hash picks there that the bake verifies stands
    const out = { built: 0, rejected: {} };
    for (let y = 1490; y < 1514; y++) for (let x = 2430; x < 2454; x++) {
      if (!isPitPixel(x, y, 0.5)) continue;
      const d = real.stand(x, y);
      if (d === 'built' || d === 'built:flattened') out.built++;
      else out.rejected[d] = (out.rejected[d] ?? 0) + 1;
    }
    assert.ok(out.built >= 5, `pits stand in the Topal Bay (${JSON.stringify(out)})`);
    assert.equal(out.rejected['rejected:off-the-map'], undefined, 'none held off the map');
    // online, the zone's own water stands none (systems/wild/cyrodiilZone.js: the province and the water it encloses)
    globalThis.location = /** @type {any} */ ({ search: '?online=1' });
    const lake = [];
    for (let y = 700; y < 740 && lake.length < 3; y++) for (let x = 2140; x < 2180 && lake.length < 3; x++) if (isPitPixel(x, y, 0.5) && openZoneAtNow(x, y)) lake.push([x, y]);
    assert.ok(lake.length > 0, 'pit pixels in the zone\'s water about the Imperial City');
    for (const [x, y] of lake) assert.equal(real.stand(x, y), 'rejected:open-zone', `${x},${y}`);
    assert.equal(openZoneAtNow(2441, 1500), false, 'the Topal Bay is no zone\'s');
  } finally { globalThis.location = was; setTamrielTrace(null); setTamrielFit(null); }
});
