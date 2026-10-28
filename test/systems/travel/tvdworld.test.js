// TVD-WORLD (2026-10-27, bible/06-Systems/Travel-View.md TVD-WORLD; the audit NO SYSTEM LEFT BEHIND IN THE BAY item 29, C4): the
// Overworld's dungeons past the Bay. TV6 stood every dungeon within the far range - a found one a plate and a journey, the
// rest a "?", found on approach - and OW-DUNGEONS its model; its dungeons were MAPS.BSA's rows (dungeonRows), so past the
// Bay no lair (TESA8) was plated, marked, found or drawn, and the found spawns past the stream (filedSpawns) were read on
// the Bay's map alone. The owner: "Every single thing here needs to be addressed. No exceptions." (2026-10-26).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { createTravelLairs, TV_LAIR_READS } from '../../../src/systems/travel/travelLairs.js';
import { lairCellOf, lairSite, lairPlaceId } from '../../../src/world/tamrielDungeons.js';
import { filedSpawns, nearDungeons, dungeonRows } from '../../../src/systems/travel/travelDungeons.js';
import { createTravelViewDungeons } from '../../../src/scenes/travelViewDungeonsHost.js';
import { TV_FAR_RANGE } from '../../../src/systems/travel/travelFarPlaces.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { discoverLocation, restoreDiscovery } from '../../../src/systems/discovery.js';
import { spawnedMapId, WORLD_SALT } from '../../../src/world/spawnedDungeons.js';
import { inBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { hostText } from '../../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A places host whose every cell past the Bay holds a lair on its site (a graveyard where the cell is even), counting
 *  its reads - the shape scenes/tamrielPlacesHost.js provinceQuestPlaces answers. */
function places({ ver = 'v1' } = {}) {
  const P = { reads: 0, calls: 0, clones: 0, ver };
  P.lairAt = (x, y) => {
    P.calls++;
    const c = lairCellOf(x, y);
    if (c < 0 || inBay(x, y)) return null;
    const s = lairSite(c);
    if (s.px !== x || s.py !== y) return null;
    P.reads++;
    return { mapId: lairPlaceId(c), name: `Lair ${c}`, px: x, py: y, type: c % 2 ? LOCATION_TYPES.DungeonRuin : LOCATION_TYPES.Graveyard, dungeonType: 0 };
  };
  P.lairCloneAt = (x, y) => { const r = P.lairAt(x, y); P.clones++; return r ? { name: r.name, regionIndex: 64, locationIndex: -7, country: { dungeon: true }, mapTableData: { mapId: r.mapId }, exterior: { exteriorData: { width: 1, height: 1, blockNames: ['RESIAA00.RMB'] } } } : null; };
  P.regionAt = () => 64;
  P.version = () => P.ver;
  return P;
}
const SKYRIM = { x: 2215, y: -371 };
const sitesWithin = (at, range) => {
  const seen = new Set(), out = [];
  for (let y = at.y - range; y <= at.y + range; y++) for (let x = at.x - range; x <= at.x + range; x++) {
    const c = lairCellOf(x, y);
    if (c < 0 || seen.has(c)) continue;
    seen.add(c);
    const s = lairSite(c);
    if (Math.hypot(s.px - at.x, s.py - at.y) <= range && !inBay(s.px, s.py)) out.push(s);
  }
  return out;
};

test('TVD-WORLD the lairs near (systems/travel/travelLairs.js): every cell\'s lair in the circle past the Bay, nearest first, TV6\'s row shape - read at most TV_LAIR_READS new cells a call, its `gen` moving while any in reach is unread, so the lists fill in over a few frames; kept while the places stand, read again when they move (mutants: the budget gone, the gen unmoved, nearest first, the Bay\'s sites, the stamp)', () => {
  const P = places();
  const L = createTravelLairs({ lairAt: P.lairAt, cloneAt: P.lairCloneAt, regionAt: P.regionAt, version: P.version });
  const all = sitesWithin(SKYRIM, TV_FAR_RANGE);
  assert.ok(all.length > 3 * TV_LAIR_READS, `the far range holds ${all.length} cells`);
  assert.equal(TV_LAIR_READS, 4);
  const first = L.rowsNear(SKYRIM, TV_FAR_RANGE);
  assert.equal(P.reads, TV_LAIR_READS, 'four cells read');
  assert.equal(first.length, TV_LAIR_READS);
  const g1 = L.gen();
  L.rowsNear(SKYRIM, TV_FAR_RANGE);
  assert.ok(L.gen() > g1, 'and more owed: the lists built on it are built again');
  const d = (r) => Math.hypot(r.x - SKYRIM.x, r.y - SKYRIM.y);
  const nearest = [...all].sort((a, b) => Math.hypot(a.px - SKYRIM.x, a.py - SKYRIM.y) - Math.hypot(b.px - SKYRIM.x, b.py - SKYRIM.y)).slice(0, TV_LAIR_READS);
  assert.deepEqual(first.map((r) => [r.x, r.y]).sort(), nearest.map((s) => [s.px, s.py]).sort(), 'the nearest first');
  assert.deepEqual(first[0].row, { mapID: first[0].lair.mapId, regionIndex: 64, locationType: first[0].lair.type }, 'TV6\'s row: its id, its province\'s region, its kind');
  let rows = first, calls = 2;
  while (rows.length < all.length && calls < 50) { rows = L.rowsNear(SKYRIM, TV_FAR_RANGE); calls++; }
  assert.equal(rows.length, all.length, 'every cell in reach, in the end');
  assert.equal(calls, Math.ceil(all.length / TV_LAIR_READS));
  assert.ok(rows.every((r, i) => i === 0 || d(rows[i - 1]) <= d(r)), 'handed back nearest first');
  const g = L.gen(), reads = P.reads;
  assert.equal(L.rowsNear(SKYRIM, TV_FAR_RANGE).length, all.length);
  assert.deepEqual([L.gen(), P.reads], [g, reads], 'all read: nothing owed, nothing read again');
  P.ver = 'v2';
  L.rowsNear(SKYRIM, TV_FAR_RANGE);
  assert.equal(P.reads, reads + TV_LAIR_READS, 'the places moved: read again');
  // the Bay's own cells are MAPS.BSA's: none from here
  const bay = createTravelLairs({ lairAt: P.lairAt, cloneAt: P.lairCloneAt, regionAt: P.regionAt, version: P.version, reads: Infinity });
  const asked = P.calls;
  assert.deepEqual(bay.rowsNear({ x: 500, y: 250 }, TV_FAR_RANGE), [], 'deep in the Bay: none');
  assert.equal(P.calls, asked, 'and none of its cells asked - the Bay\'s are its rows\'');
  const edge = bay.rowsNear({ x: 995, y: 250 }, TV_FAR_RANGE);
  assert.ok(edge.length > 0 && edge.every((r) => !inBay(r.x, r.y)), 'at its edge, those past it');
  assert.equal(P.calls - asked, edge.length, 'only those asked');
  // a pixel's lair laid out, kept
  const s = all[0], clones = P.clones;
  const loc = L.lairPlaceAt(s.px, s.py);
  assert.ok(loc?.country?.dungeon);
  assert.equal(L.lairPlaceAt(s.px, s.py), loc);
  assert.equal(P.clones, clones + 1, 'laid once');
  assert.equal(L.lairPlaceAt(s.px + 1, s.py), null, 'beside its site none');
});

test('TVD-WORLD the found spawns past the stream (systems/travel/travelDungeons.js filedSpawns): read on the world\'s grid - past the Bay and west of its corner too, where they were the Bay\'s map alone (mutants: the Bay\'s bounds)', () => {
  const all = { rolls: () => true, filed: () => true, indexed: () => false, stand: (x, y) => ({ name: `S${x},${y}` }) };
  assert.deepEqual(filedSpawns({ ...all, at: { x: 0, y: 0 }, range: 1 }).map((s) => `${s.x},${s.y}`), ['-1,-1', '0,-1', '1,-1', '-1,0', '0,0', '1,0', '-1,1', '0,1', '1,1'].filter((k) => { const [x, y] = k.split(',').map(Number); return Math.hypot(x, y) <= 1; }));
  assert.deepEqual(filedSpawns({ ...all, at: { x: 2215, y: -371 }, range: 1 }).map((s) => `${s.x},${s.y}`), ['2215,-372', '2214,-371', '2215,-371', '2216,-371', '2215,-370']);
  assert.deepEqual(filedSpawns({ ...all, at: { x: 8191, y: 0 }, range: 1 }).map((s) => `${s.x},${s.y}`), ['8191,-1', '8190,0', '8191,0', '8191,1'], 'the world\'s own edge: nothing off it');
});

/** The TV6 host's dungeons (scenes/travelViewDungeonsHost.js), run over fakes: an index, a map dict of one Bay dungeon. */
function tvd({ at, P = places(), index = new Map(), online = true, summary = () => null } = {}) {
  const host = {
    _announcedSpawnPixels: new Set(), _spawnSalt: WORLD_SALT, etherSea: false, locationIndex: index,
    mapDict: new Map([[250 * 1000 + 500, { id: 250 * 1000 + 500, mapID: 77, locationType: LOCATION_TYPES.DungeonKeep, regionIndex: 17 }]]),
    params: { has: (k) => k === 'online' && online }, playerTravelPixel: () => at, state: { terrainDistance: 3 },
    tvEtherPlace: () => null, tvKnownGen: () => 'g', tvPlaceSummary: summary, tvSpawnAt: () => null, tvSpawnGone: () => false,
    provinceQuestPlaces: P, _locIndexGen: 0, _tvDungeonRows: null, _tvListsReady: true, tvDng: { at: null, list: [] },
  };
  return { host, ...createTravelViewDungeons(host) };
}

test('TVD-WORLD the host: past the Bay the Overworld\'s dungeons are its lairs - an unfound one a "?", a found one a plate with its summary (a journey to it), filled in over the frames; the find\'s own reach read whole; deep in the Bay the list is the map\'s rows as ever (mutants: the lairs unread, their found test, the summary, the list\'s key without the lairs\' gen)', () => {
  restoreDiscovery(null);
  try {
    const t = tvd({ at: SKYRIM });
    let list = t.travelViewDungeons(), frames = 1;
    while (frames < 20) { const next = t.travelViewDungeons(); frames++; if (next === list) break; list = next; }
    assert.ok(frames > 2 && frames < 20, `filled in over ${frames} frames, then kept`);
    assert.ok(list.length > 0 && list.every((g) => g.key.startsWith('dng:') && !g.found && !g.spawn && g.loc?.country?.dungeon), 'its lairs, unfound - each a "?"');
    const g = list[0];
    assert.equal(t.tvDungeonFound(g.px, g.py), false);
    assert.equal(discoverLocation(g.row.mapID, { regionName: 'Skyrim', locationName: g.loc.name }), true);
    assert.equal(t.tvDungeonFound(g.px, g.py), true, 'found, by its own id');
    t.host.tvDng.at = null;
    const plate = t.travelViewDungeons().find((p) => p.key === g.key);
    assert.deepEqual([plate.found, plate.summary?.name, plate.summary?.mapId, plate.summary?.pixel], [true, g.loc.name, g.row.mapID, { x: g.px, y: g.py }], 'a plate, its journey the summary');
    // the find's reach (world.js TV_FIND_REACH, 4): its cells read whole in one call
    const f = tvd({ at: SKYRIM });
    for (const at of [SKYRIM, { x: 2219, y: -366 }, { x: 2900, y: 900 }]) {
      const want = sitesWithin(at, 4).length;
      assert.equal(f.tvDungeonRowsAt(at, 4).filter((r) => r.lair).length, want, `the find's reach in one call (${want} at ${at.x},${at.y})`);
    }
    assert.ok([SKYRIM, { x: 2219, y: -366 }, { x: 2900, y: 900 }].some((at) => sitesWithin(at, 4).length > 0), 'a reach that holds a lair');
    // deep in the Bay: the map's rows alone, the places host never asked
    const P = places();
    const b = tvd({ at: { x: 495, y: 248 }, P, index: new Map([['500,250', { name: 'Old Keep', exterior: { exteriorData: { width: 1, height: 1, blockNames: ['RESIAA00.RMB'] } } }]]) });
    assert.deepEqual(b.tvDungeonRowsAt({ x: 495, y: 248 }), dungeonRows(b.host.mapDict));
    assert.deepEqual(b.travelViewDungeons().map((x) => [x.key, x.found]), [['dng:77', false]]);
    assert.equal(P.reads, 0, 'no lair read on the Bay');
  } finally { restoreDiscovery(null); }
});

test('TVD-WORLD the host: a found spawn past the Bay, its pixel never built, stands on the Overworld (tvFiledSpawns on the world\'s grid, its id the spawn lane\'s)', () => {
  restoreDiscovery(null);
  try {
    const [sx, sy] = [2216, -371];
    const stood = { name: 'Old Crypt (2216,-371)', spawned: true, mapTableData: { mapId: spawnedMapId(WORLD_SALT, sx, sy) } };
    const t = tvd({ at: SKYRIM });
    t.host.tvSpawnAt = (x, y) => (x === sx && y === sy ? stood : null);
    const t2 = createTravelViewDungeons(t.host);
    discoverLocation(spawnedMapId(WORLD_SALT, sx, sy), { regionName: 'Skyrim', locationName: stood.name });
    const filed = t2.tvFiledSpawns(SKYRIM).filter((s) => s.x === sx && s.y === sy);
    assert.equal(filed.length, 1, 'its pixel past the Bay read');
  } finally { restoreDiscovery(null); }
});

test('TVD-WORLD by source: the world host hands the places to the Overworld\'s dungeons; the find reads the lairs\' found test and their gen; the models\' list keys on the gen too', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /createTravelViewDungeons\(\{[^}]*provinceQuestPlaces,/);
  assert.match(w, /locAt: tvDungeonAt, isFound: tvDungeonFound \}\)\.filter\(\(g\) => !g\.found\)/);
  assert.match(w, /const at = playerTravelPixel\(\), dg = tvKnownGen\(\), n = `\$\{_locIndexGen\}:\$\{tvDungeonRowsAt\.gen\(\)\}`;/);
  assert.match(rd('src/scenes/travelViewDungeonModels.js'), /n = `\$\{host\._locIndexGen\}:\$\{tvDungeonRowsAt\.gen\?\.\(\) \?\? 0\}`;/);
});

const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAS = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA')) && existsSync(join(ARENA2, 'ARCH3D.BSA'));
test('TVD-WORLD on the player\'s data: about Windhelm\'s road and Bravil the Overworld stands its lairs - the places host\'s own, every one in reach - where it stood none', { skip: HAS ? false : 'ARENA2_PATH not set' }, async () => {
  const { standWorldPastBay } = await import('../quest/r25World.mjs');
  const w = await standWorldPastBay(ARENA2);
  const P = w.places.provinceQuestPlaces;
  for (const at of [SKYRIM, { x: 2170, y: 485 }]) {
    const t = tvd({ at, P, index: w.locationIndex });
    let list = t.travelViewDungeons();
    for (let i = 0; i < 20; i++) { const next = t.travelViewDungeons(); if (next === list) break; list = next; }
    const rows = P.lairsNear(at.x, at.y, TV_FAR_RANGE);
    const inReach = rows.filter((r) => Math.hypot(r.px - at.x, r.py - at.y) <= TV_FAR_RANGE);
    assert.ok(inReach.length > 0, `lairs about ${at.x},${at.y}`);
    const all = nearDungeons({ at, dungeons: t.tvDungeonRowsAt(at), locAt: t.tvDungeonAt, isFound: t.tvDungeonFound, max: Infinity });
    assert.deepEqual(all.map((g) => g.row.mapID).sort(), inReach.map((r) => r.mapId).sort(), 'every lair in reach, and nothing else');
    const past = list.filter((g) => Math.max(Math.abs(g.px - at.x), Math.abs(g.py - at.y)) > 3);   // the grid's own "?"s spend none (AUDIT OW5b D1)
    assert.ok(list.length > 0 && past.length <= 12, `the twelve nearest of them past the grid on the Overworld (${past.length} of ${list.length})`);
  }
});
