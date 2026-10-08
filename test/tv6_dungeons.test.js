// TV6 - THE DUNGEONS, DISCOVERED ON APPROACH (bible/06-Systems/Travel-View.md, THE OVERHAUL; Mac 2026-09-28:
// "Discover on approach"). The pure law (systems/travelDungeons.js), the readout's unnamed mark, and the host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TV_DUNGEON_TYPES, TV_DUNGEON_MAX, TV_DUNGEON_FIND_M, NATIVE_PER_M, dungeonFoundText, dungeonRows, spawnedPixels, filedSpawns, nearDungeons, dungeonApproach,
  lastLegStart, dungeonToFind,
} from '../src/systems/travelDungeons.js';
import { LOCATION_TYPES, CLIMATES, getMapPixelID } from '../src/formats/mapsFile.js';
import { TV_FAR_RANGE } from '../src/systems/travelFarPlaces.js';
import { ARRIVAL_BUFFER } from '../src/systems/travelAutopilot.js';
import { spawnedMapId, spawnsDungeon, createSpawnLedger, GENERAL_TTL_MINUTES } from '../src/world/spawnedDungeons.js';
import { planRoute, routeLegs, routeDrawPoints, routeGround, TV_MOUNTAIN_CLIMATE, TV_STEEP_RISE } from '../src/systems/travelRoute.js';

// PIN MOVED (AUDIT OW5 G2): the Overworld's own lines are said through tvSay - held at the scale they are said at
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const loc = (name, locationType) => ({ name, mapTableData: { locationType } });
/** A map row as systems/mapDirectory.js buildMapDict makes it (the key is the pixel id; the MapId carries more bits). */
const mapRow = (x, y, locationType) => ({ id: getMapPixelID(x, y), mapID: (0x100000 | getMapPixelID(x, y)) >>> 0, regionIndex: 17, mapIndex: x, locationType, dungeonType: 0, discovered: false });
/** A map dict of rows, keyed as buildMapDict keys them. */
const dictOf = (rows) => new Map(rows.map((r) => [r.id, r]));
/** A spawned clone as world/spawnedDungeons.js synthesizeDungeonLocation stands it (the fields the list reads). */
const spawnLoc = (x, y, name = `Old Keep (${x},${y})`) => ({ name, spawned: true, mapTableData: { locationType: LOCATION_TYPES.DungeonKeep, mapId: spawnedMapId(1, x, y) } });

test('TV6 law: the dungeons are the travel map\'s own filter (labyrinth, keep, ruin, graveyard, coven) - never a town, a temple or a farm; AUDIT OW3 D3: gathered once off the MAP ROWS, each on its own pixel', () => {
  const L = LOCATION_TYPES;
  assert.deepEqual([...TV_DUNGEON_TYPES].sort((a, b) => a - b), [L.DungeonLabyrinth, L.DungeonKeep, L.DungeonRuin, L.Graveyard, L.Coven].sort((a, b) => a - b));
  const dict = dictOf([mapRow(10, 20, L.DungeonKeep), mapRow(11, 20, L.TownCity), mapRow(12, 20, L.HomeFarms), mapRow(13, 21, L.Graveyard),
    mapRow(999, 499, L.DungeonRuin), mapRow(15, 22, L.ReligionTemple), mapRow(0, 0, L.Coven)]);
  const rows = dungeonRows(dict);
  assert.deepEqual(rows.map((g) => [g.x, g.y, g.row.locationType]), [[10, 20, L.DungeonKeep], [13, 21, L.Graveyard], [999, 499, L.DungeonRuin], [0, 0, L.Coven]],
    'the dungeons\' rows, each at the pixel its id names (the corners too), nothing else');
  assert.equal(rows[0].row, dict.get(getMapPixelID(10, 20)), 'the row itself, carried');
  assert.deepEqual(dungeonRows(null), []);
});

test('TV6 law: the dungeons about the traveller - within the far range\'s circle, nearest first, at most TV_DUNGEON_MAX, each saying whether it is found, keyed by its map id, its place read off the live index', () => {
  const at = { x: 100, y: 100 };
  const rows = [];
  const index = new Map();
  for (let i = 1; i <= 30; i++) { rows.push({ x: 100 + i, y: 100, row: mapRow(100 + i, 100, 7) }); if (i !== 20) index.set(`${100 + i},100`, loc(`D${i}`, 7)); }
  rows.push({ x: 100 + TV_FAR_RANGE, y: 100 + 1, row: mapRow(100 + TV_FAR_RANGE, 101, 7) });   // inside the square, outside the circle
  index.set(`${100 + TV_FAR_RANGE},101`, loc('Past the circle', 7));
  const locAt = (x, y) => index.get(`${x},${y}`);
  const found = new Set(['102,100']);
  const list = nearDungeons({ at, dungeons: rows, locAt, isFound: (x, y) => found.has(`${x},${y}`) });
  assert.equal(TV_DUNGEON_MAX, 12);
  assert.equal(list.length, TV_DUNGEON_MAX);
  assert.deepEqual(list.map((g) => g.loc.name).slice(0, 3), ['D1', 'D2', 'D3'], 'nearest first');
  assert.deepEqual(list.map((g) => g.found).slice(0, 3), [false, true, false]);
  assert.equal(list[0].key, `dng:${mapRow(101, 100, 7).mapID}`, 'a row\'s key is its map id\'s');
  assert.equal(list[0].row.mapID, mapRow(101, 100, 7).mapID);
  assert.ok(list.every((g) => g.d <= TV_FAR_RANGE && g.spawn === false));
  assert.equal(nearDungeons({ at, dungeons: [rows.at(-1)], locAt, isFound: () => false }).length, 0, 'the range is a circle');
  // the index is read at the ask - a place that came (or went) since the rows were gathered is seen
  assert.equal(nearDungeons({ at, dungeons: rows, locAt, isFound: () => false, max: 40 }).length, TV_FAR_RANGE - 1, 'the 20th row has no place yet (and 25-30 lie past the circle)');
  index.set('120,100', loc('Late', 7));
  index.delete('101,100');
  const again = nearDungeons({ at, dungeons: rows, locAt, isFound: () => false, max: 40 });
  assert.equal(again.length, TV_FAR_RANGE - 1, 'one gone, one come');
  assert.deepEqual([again[0].loc.name, again.find((g) => g.x === 120)?.loc.name], ['D2', 'Late']);
});

test('AUDIT OW3 D3: FILTERED, THEN CAPPED - a row with no named place in the index, one a spawn stands on, and a FOUND one inside the grid (TV2\'s plate) spend none of the twelve; AUDIT OW5b D1: nor does an unfound one inside the grid (a lair on the ground the view shows)', () => {
  const at = { x: 100, y: 100 };
  const rows = [];
  const index = new Map();
  for (let i = 1; i <= 30; i++) rows.push({ x: 100 + i, y: 100, row: mapRow(100 + i, 100, 7) });
  for (let i = 4; i <= 30; i++) index.set(`${100 + i},100`, loc(`D${i}`, 7));   // 101-103: rows the index has no place for
  index.set('104,100', loc('', 7));   // a nameless one
  index.set('105,100', spawnLoc(105, 100));   // a spawn stands on the row's pixel (a row with no exterior is never indexed)
  const found = new Set(['106,100', '107,100', '110,100']);
  const q = { at, dungeons: rows, locAt: (x, y) => index.get(`${x},${y}`), isFound: (x, y) => found.has(`${x},${y}`), grid: 9 };
  const list = nearDungeons(q);
  assert.equal(list.length, TV_DUNGEON_MAX + 2, 'twelve marked past the grid - none of the unmarkable took a slot - and the two lairs inside it besides');
  assert.deepEqual(list.map((g) => g.loc.name), ['D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'D21'],
    '106 and 107 found inside the grid are TV2\'s; 108 and 109 unfound inside it are lairs, spending none; 110 found past it a plate');
  assert.deepEqual(list.map((g) => g.found).slice(0, 4), [false, false, true, false]);
  assert.ok(!list.some((g) => g.x === 105), 'the spawn\'s pixel is not a row\'s (unsaid, it is nobody\'s)');
  assert.deepEqual(nearDungeons({ ...q, grid: -1 }).map((g) => g.loc.name).slice(0, 3), ['D6', 'D7', 'D8'], 'no grid: every found one is marked here');
  assert.deepEqual(nearDungeons({ ...q, max: 3 }).map((g) => g.loc.name), ['D8', 'D9', 'D10', 'D11', 'D12'], 'the cap is taken of what is marked past the grid');
});

test('AUDIT OW3 D1: THE SPAWNED DUNGEONS - read off the live index, marked only once the spawned feature has told of them, under `spawn:<map id>`, named once filed; within the circle, nearest first among the rows, sharing the twelve', () => {
  const index = new Map([['105,100', spawnLoc(105, 100)], ['110,100', loc('Castle Dread', 7)], ['120,104', spawnLoc(120, 104)], ['1,1', { name: 'Odd', mapTableData: {} }]]);
  const spawns = spawnedPixels(index);
  assert.deepEqual(spawns.map((s) => [s.x, s.y, s.loc.name]), [[105, 100, 'Old Keep (105,100)'], [120, 104, 'Old Keep (120,104)']], 'the spawns alone, at their pixels');
  assert.deepEqual(spawnedPixels(null), []);
  const at = { x: 100, y: 100 };
  const told = new Set(), filed = new Set();
  const q = { at, dungeons: [], locAt: () => null, isFound: () => false, spawns, spawnKnown: (s) => told.has(`${s.x},${s.y}`) || filed.has(`${s.x},${s.y}`),
    spawnFound: (s) => filed.has(`${s.x},${s.y}`) };
  assert.deepEqual(nearDungeons(q), [], 'unsaid: nothing - the feature never says a spawn before its pixel is entered');
  assert.deepEqual(nearDungeons({ ...q, spawnKnown: undefined, spawnFound: undefined }), [], 'and none is told by default');
  told.add('105,100');
  let list = nearDungeons(q);
  assert.equal(list.length, 1);
  assert.deepEqual({ key: list[0].key, spawn: list[0].spawn, found: list[0].found, row: list[0].row, d: list[0].d, name: list[0].loc.name },
    { key: `spawn:${spawnedMapId(1, 105, 100)}`, spawn: true, found: false, row: null, d: 5, name: 'Old Keep (105,100)' }, 'said, not filed: a mark with no name');
  filed.add('105,100');
  assert.equal(nearDungeons(q)[0].found, true, 'filed: named, a journey');
  filed.add('120,104');
  assert.deepEqual(nearDungeons(q).map((g) => g.x), [105, 120]);
  assert.deepEqual(nearDungeons({ ...q, range: 10 }).map((g) => g.x), [105], 'the circle holds the spawns too');
  // never one without a name
  assert.deepEqual(nearDungeons({ ...q, spawns: [{ x: 106, y: 100, loc: spawnLoc(106, 100, '') }, { x: 107, y: 100, loc: null }], spawnKnown: () => true }), []);
  // the rows and the spawns: one order, one cap
  const rows = [], idx = new Map();
  for (let i = 2; i <= 20; i++) { rows.push({ x: 100 + i, y: 100, row: mapRow(100 + i, 100, 7) }); idx.set(`${100 + i},100`, loc(`D${i}`, 7)); }
  list = nearDungeons({ ...q, at, dungeons: rows, locAt: (x, y) => idx.get(`${x},${y}`), spawns: [{ x: 101, y: 100, loc: spawnLoc(101, 100) }], spawnKnown: () => true });
  assert.equal(list.length, TV_DUNGEON_MAX);
  assert.deepEqual(list.map((g) => g.spawn).slice(0, 2), [true, false], 'the spawn at one pixel ahead of the row at two');
  assert.equal(list.at(-1).loc.name, 'D12', 'and it took a slot of the twelve');
});

test('AUDIT OW3 D1: THE FIND never takes a spawn (the feature files its own on its pixel\'s entry; a kilometre reaches next door); A WALK TO ONE ends at its exterior\'s edge on the traveller\'s side, grown by the arrival buffer', () => {
  const m = (x, z) => ({ x, z });
  const list = [{ key: 's', spawn: true, found: false, mid: m(0, 10 * NATIVE_PER_M) }, { key: 'r', spawn: false, found: false, mid: m(0, 900 * NATIVE_PER_M) }];
  assert.equal(dungeonToFind({ feet: m(0, 0), list, mid: (g) => g.mid }).key, 'r', 'the nearer spawn passed over');
  assert.equal(dungeonToFind({ feet: m(0, 0), list: list.slice(0, 1), mid: (g) => g.mid }), null);
  assert.equal(ARRIVAL_BUFFER, 800);
  const rect = { minX: 10000, maxX: 14096, minZ: 20000, maxZ: 24096 };
  assert.deepEqual(dungeonApproach(rect, m(0, 22000)), m(10000 - ARRIVAL_BUFFER, 22000), 'from the west: its west edge, a buffer out, level with the feet');
  assert.deepEqual(dungeonApproach(rect, m(90000, 90000)), m(14096 + ARRIVAL_BUFFER, 24096 + ARRIVAL_BUFFER), 'from the north-east: its corner');
  assert.deepEqual(dungeonApproach(rect, m(12000, 3000)), m(12000, 20000 - ARRIVAL_BUFFER));
  assert.deepEqual(dungeonApproach(rect, m(9500, 21000)), m(9500, 21000), 'already at its door: where the feet are');
  assert.deepEqual(dungeonApproach(rect, m(0, 0), 0), m(10000, 20000), 'the buffer is a parameter');
});

test('TV6 law: THE FIND - the nearest UNDISCOVERED dungeon whose middle is within TV_DUNGEON_FIND_M of the feet; a found one, one too far or one with no middle is never found', () => {
  assert.equal(TV_DUNGEON_FIND_M, 1000);
  assert.equal(NATIVE_PER_M, 40);
  const m = (x, z) => ({ x, z });
  const list = [
    { key: 'a', found: false, mid: m(0, 1001 * NATIVE_PER_M) },   // just past it
    { key: 'c', found: false, mid: m(0, 400 * NATIVE_PER_M) },   // the nearest - ahead of a farther one in the list
    { key: 'b', found: false, mid: m(0, 900 * NATIVE_PER_M) },
    { key: 'd', found: true, mid: m(0, 10 * NATIVE_PER_M) },     // found already
    { key: 'e', found: false, mid: null },
  ];
  const got = dungeonToFind({ feet: m(0, 0), list, mid: (g) => g.mid });
  assert.equal(got.key, 'c');
  assert.equal(dungeonToFind({ feet: m(0, 0), list: list.slice(0, 1), mid: (g) => g.mid }), null, 'a kilometre and a metre: not yet');
  assert.equal(dungeonToFind({ feet: m(0, 0), list: [{ found: false, mid: m(0, 1000 * NATIVE_PER_M) }], mid: (g) => g.mid })?.found, false, 'a kilometre exactly: found');
  assert.equal(dungeonFoundText('Castle Dread'), 'You have found Castle Dread.');
});

test('TV6 readout: an undiscovered dungeon is an unnamed mark - its own look, a "?" and no journey', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const src = rd('src/ui/travelViewHud.js');
  assert.match(src, /return k === 'place' \|\| k === 'far' \|\| k === 'dest' \|\| k === 'target' \|\| k === 'party' \|\| k === 'lair'( \|\| k === 'band')?(?: \|\| k === 'raider')?(?: \|\| k === 'camp')? \? k : 'traveller';/, 'the lair look');
  assert.equal(hud.TRAVEL_VIEW_MARK_COLORS.lair, '#b0443a');
  assert.match(src, /look === 'lair' \? C\.lair/);
});

test('TV6 host: the dungeons gathered once, listed on a pixel or a find, marked found (a far plate, a journey) or not (the lair); the find on the enhanced interface outdoors, through the port\'s own store, said on the screen', () => {
  const w = rd('src/scenes/world.js');
  // PIN MOVED (AUDIT OW5 J4): and the pixel's own box the approach keeps within
  assert.match(w, /import \{ dungeonRows, spawnedPixels, filedSpawns, nearDungeons, dungeonApproach, pixelBox, lastLegStart, dungeonToFind, dungeonFoundText, NATIVE_PER_M \} from '\.\.\/systems\/travelDungeons\.js';/);
  assert.match(w, /_tvDungeonRows \?\?= dungeonRows\(mapDict\)/, 'AUDIT OW3 D3: gathered once off the map rows');
  assert.doesNotMatch(w, /\?\?= dungeon\w*\(locationIndex\)/, 'AUDIT OW3 D3: never a one-time snapshot of the live index');
  assert.match(w, /if \(tvDng\.at && tvDng\.at\.x === at\.x && tvDng\.at\.y === at\.y && tvDng\.dg === dg && tvDng\.grid === grid && tvDng\.n === n\) return tvDng\.list;/, 'kept between pixels and finds (and while the grid and the index hold)');
  assert.match(w, /if \(g\.found\) \{\n\s*if \(!g\.spawn && `far:\$\{g\.row\.mapID\}` === farEnd\) continue;/, 'a found one past the grid (the list keeps no other): a plate, but the journey\'s own end is its flag');
  assert.match(w, /marks\.push\(\{ key: g\.key, at: tvSceneKept\(g, g\.x, g\.z, TV_PLACE_LIFT\), label: g\.loc\.name, sub: tier \? `\$\{tier\} - \$\{farDistanceText\(km\)\}` : farDistanceText\(km\), kind: 'far dungeon', pick: true, edge: true \}\);/, 'a found one: a far plate, a journey (OW-FILTER: its kind\'s second word the filter\'s Dungeons); PIN MOVED (TIER1): online its tier and size before the distance');
  assert.match(w, /marks\.push\(\{ key: g\.key, at: tvSceneKept\(g, g\.x, g\.z, TV_PLACE_LIFT\), label: '\?', kind: 'lair' \}\);/, 'the rest: an unnamed lair, no journey, never held at the edge');
  assert.match(w, /if \(!isEnhanced\(\) \|\| \(modes\?\.mode \?\? 'exterior'\) !== 'exterior' \|\| !walkMode \|\| !playerSpawned\) return;/, 'the find: the enhanced interface, outdoors');
  assert.match(w, /if \(discoverLocation\(g\.row\.mapID, \{ regionName: maps\.getRegionName\(g\.row\.regionIndex\), locationName: g\.loc\.name \}\)\) tvSay\(dungeonFoundText\(g\.loc\.name\), 5\);/, 'the port\'s own store, and said');
  assert.match(w, /tvFar = \{ at: null, near: -1, list: \[\] \};   \/\/ TV5: nor the far places\n\s*tvDng = \{ at: null, dg: -1, list: \[\] \};   \/\/ TV6: nor the dungeons\n/, 'a load forgets them');
  assert.match(w, /dungeonFindFrame\(performance\.now\(\)\);   \/\/ TV6/, 'the find asked every frame (itself four times a second)');
  assert.match(w, /const plate = tvPlates\.list\.find\(\(p\) => p\.key === key\) \?\? tvFar\.list\.find\(\(p\) => p\.key === key\) \?\? tvDng\.list\.find\(\(p\) => p\.key === key && p\.summary\);/, 'a found dungeon\'s plate is its journey');
});

test('AUDIT OW3 D1 host: the spawns off the live index, told as the spawned feature tells them (its line this session, or the pixel entry\'s filing - the name), the list kept only while the index holds (lifted and run)', async () => {
  const { discoverLocation, hasDiscoveredLocationId } = await import('../src/systems/discovery.js');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const grid = Math\.max\(1, state\.terrainDistance \?\? 3\), n = _locIndexGen;/, 'the grid\'s reach, and the index\'s churn (AUDIT OW4 D5: its generation, not its size)');
  assert.match(w, /const dungeons = \(_tvDungeonRows \?\?= dungeonRows\(mapDict\)\), locAt = \(x, y\) => locationIndex\.get\(`\$\{x\},\$\{y\}`\), isFound = \(x, y\) => !!tvPlaceSummary\(x, y\);/);
  assert.match(w, /const list = nearDungeons\(\{ at, grid, dungeons, locAt, isFound, spawns: \[\.\.\.spawnedPixels\(locationIndex\), \.\.\.tvFiledSpawns\(at\)\], spawnKnown: tvSpawnKnown,\n\s*spawnFound: tvSpawnFound, spawnGone: \(s\) => tvSpawnGone\(s\.x, s\.y\) \}\)\.map\(placed\);/,
    'the rows, the live index, the spawns read afresh (AUDIT OW4 D4: and the found ones past it; D2: none gone) - and the grid handed in, so TV2\'s own spend no slot');
  // the find's own list, uncapped, is travelViewFindList (AUDIT OW5 D1 - test/ow5_audit.test.js mounts it); AUDIT OW5b D1's
  // own, built beside the plates, gave way to it at the merge
  assert.match(w, /tvDng = \{ at, dg, grid, n, list \};/);
  const m = /\n {2}(const tvSpawnFound = [^\n]*;)\n {2}(const tvSpawnKnown = [^\n]*;)\n/.exec(w);
  assert.ok(m, 'the two tests the host hands the list');
  const said = new Set();
  const { tvSpawnFound, tvSpawnKnown } = new Function('hasDiscoveredLocationId', '_announcedSpawnPixels', `${m[1]} ${m[2]} return { tvSpawnFound, tvSpawnKnown };`)(hasDiscoveredLocationId, said);
  const s = { x: 105, y: 100, loc: spawnLoc(105, 100) };
  assert.deepEqual([tvSpawnKnown(s), tvSpawnFound(s)], [false, false], 'unsaid: unknown');
  said.add('105,100');
  assert.deepEqual([tvSpawnKnown(s), tvSpawnFound(s)], [true, false], 'said (announceNearbySpawns\' set): known, no name');
  said.clear();
  discoverLocation(spawnedMapId(1, 105, 100), { regionName: 'Daggerfall', locationName: s.loc.name });   // syncTopics\' pixel-entry filing (a load keeps it)
  assert.deepEqual([tvSpawnKnown(s), tvSpawnFound(s)], [true, true], 'filed: known, and named');
  assert.equal(tvSpawnKnown({ x: 106, y: 100, loc: spawnLoc(106, 100) }), false, 'its neighbour is not');
  // the two sets it reads are the feature's own
  assert.match(w, /if \(!loc\?\.spawned \|\| _announcedSpawnPixels\.has\(key\)\) return;   \/\/ the player's own pixel, once\n\s*_announcedSpawnPixels\.add\(key\);/);
  assert.match(w, /if \(dfLocation\) \{\n\s*discoverLocation\(dfLocation\.mapTableData\.mapId, \{/, 'the pixel entry files whatever the index holds there, a spawn too');
});

test('AUDIT OW3 D1 host: a spawn\'s plate is a walk to its door - TV2\'s spot journey to its exterior\'s edge, asked of the live list (an unnamed or a vanished spawn walks nowhere); the click reaches it before the place plates; AUDIT OW4 D1/D6: walked as a place\'s door (its rect handed on - the edge is aimed once the route is known); D2: asked its clocks at the click (lifted and run)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(key === 'dest'\) \{[^\n]*\n\s*if \(key\.startsWith\('spawn:'\)\) \{ travelViewSpawnWalk\(key\); return; \}[^\n]*\n\s*const plate = /, 'the click');
  const m = /\n {2}(function travelViewSpawnWalk\(key\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  assert.ok(m, 'the walk');
  const rect = { minX: 10000, maxX: 14096, minZ: 20000, maxZ: 24096 };
  const list = [{ key: 'spawn:1', found: true, px: 105, py: 100, x: 12048, z: 22048, rect }, { key: 'spawn:2', found: false, px: 106, py: 100, x: 0, z: 0, rect },
    { key: 'spawn:3', found: true, px: 107, py: 100, x: 0, z: 0, rect }];
  let canGo = true;
  const walks = [], gone = new Set(['107,100']);
  const walk = new Function('d', `const { travelViewDungeons, travelViewCanGo, tvSpawnGone, travelViewWalkTo, tvSceneOf } = d; return ${m[1]};`)({
    travelViewDungeons: () => list, travelViewCanGo: () => canGo, tvSpawnGone: (x, y) => gone.has(`${x},${y}`),
    tvSceneOf: (x, z, lift) => [x, lift, z], travelViewWalkTo: (point, pix, opts) => { walks.push({ point, pix, opts }); return true; },
  });
  assert.equal(walk('spawn:1'), true);
  assert.deepEqual(walks, [{ point: [12048, 0, 22048], pix: { x: 105, y: 100 }, opts: { door: rect } }], 'its own pixel, as a DOOR: the exterior\'s rect (the walk aims its edge)');
  assert.equal(walks[0].opts.door, rect, 'the list\'s own rect');
  assert.equal(walk('spawn:2'), false, 'unnamed: no journey');
  assert.equal(walk('spawn:9'), false, 'gone from the live list: none');
  assert.equal(walk('spawn:3'), false, 'AUDIT OW4 D2: its time ran out since the list was kept - none');
  canGo = false;
  assert.equal(walk('spawn:1'), false, 'the gate every click passes');
  assert.equal(walks.length, 1);
});

test('AUDIT OW3 D2: THE ARRIVAL GUARD - no dungeon is found while the world is being moved (a fast travel, a Recall, a respawn, a load: the feet read mid-arrival lie up to a kilometre from where they land); the bands\' frame stands down the same (the find lifted and run)', () => {
  const w = rd('src/scenes/world.js');
  const m = /\n {2}let _tvFindAt = 0;\n {2}(function dungeonFindFrame\(now\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  assert.ok(m, 'the find');
  let busy = true;
  const filed = [], lines = [];
  const g = { key: 'dng:1', found: false, spawn: false, row: { mapID: 1, regionIndex: 17 }, loc: { name: 'Castle Dread' }, x: 0, z: 500 * NATIVE_PER_M };
  // PIN MOVED (AUDIT OW5 D1/G2): the find asks its own uncapped list and says through tvSay
  const frame = new Function('d', `let _tvFindAt = 0; const { isEnhanced, modes, walkMode, playerSpawned, worldMoveBusy, state, player, dungeonToFind, travelViewFindList, discoverLocation, maps, tvSay, dungeonFoundText } = d; return ${m[1]};`)({
    isEnhanced: () => true, modes: { mode: 'exterior' }, walkMode: true, playerSpawned: true, worldMoveBusy: () => busy,
    state: { worldCoords: () => ({ x: 0, y: 0, z: 0 }) }, player: { pos: [0, 0, 0] }, dungeonToFind, travelViewFindList: () => [g],
    discoverLocation: (id, info) => { filed.push([id, info.locationName]); return true; }, maps: { getRegionName: () => 'Daggerfall' },
    tvSay: (t) => lines.push(t), dungeonFoundText,
  });
  frame(1000);
  assert.deepEqual([filed, lines], [[], []], 'mid-arrival: nothing found, nothing said, nothing saved');
  busy = false;
  frame(1100);
  assert.deepEqual(filed, [], 'and the quarter second holds');
  frame(1300);
  assert.deepEqual(filed, [[1, 'Castle Dread']], 'landed: found');
  assert.deepEqual(lines, ['You have found Castle Dread.']);
  assert.match(w, /function bandFrame\(now, dt\) \{\n\s*if \(worldMoveBusy\(\)\) return;/, 'the bands: the one guard line, first');
  assert.match(w, /function worldMoveBusy\(\) \{\n(\s*\/\/[^\n]*\n)*\s*return _seasonStraightening \|\| _traveling \|\| _teleporting \|\| _recalling \|\| _respawning \|\| _loading/, 'the one question every mover answers');
});

// ═══ AUDIT OW4 (2026-09-28) - the dungeons' lane again: the laws the OW3 fixes left open, behaviourally ═══

test('AUDIT OW4 D7: THE FOUND FIRST - the twelve are taken of the found dungeons first, then of the unfound nearest first (a found plate no longer drops behind nearer "?"s), and handed back nearest first', () => {
  const at = { x: 100, y: 100 };
  const rows = [], index = new Map();
  for (let i = 1; i <= 20; i++) { rows.push({ x: 100 + i, y: 100, row: mapRow(100 + i, 100, 7) }); index.set(`${100 + i},100`, loc(`D${i}`, 7)); }
  const found = new Set(['118,100', '120,100']);
  const q = { at, dungeons: rows, locAt: (x, y) => index.get(`${x},${y}`), isFound: (x, y) => found.has(`${x},${y}`) };
  const list = nearDungeons(q);
  assert.equal(list.length, TV_DUNGEON_MAX);
  assert.deepEqual(list.map((g) => g.loc.name), ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D18', 'D20'],
    'the two found past ten nearer "?"s kept, the eleventh and twelfth "?" give way - and the whole nearest first');
  assert.deepEqual(list.map((g) => g.found).slice(-2), [true, true]);
  assert.deepEqual(nearDungeons({ ...q, max: 1 }).map((g) => g.loc.name), ['D18'], 'one slot: the nearest FOUND');
  assert.deepEqual(nearDungeons({ ...q, isFound: () => true }).map((g) => g.loc.name).at(-1), 'D12', 'all found: the nearest twelve');
  assert.deepEqual(nearDungeons({ ...q, isFound: () => false }).map((g) => g.loc.name).at(-1), 'D12', 'none found: the nearest twelve');
  // a found spawn is found too
  const spawns = [{ x: 100, y: 119, loc: spawnLoc(100, 119) }];
  const withSpawn = nearDungeons({ ...q, spawns, spawnKnown: () => true, spawnFound: () => true });
  assert.deepEqual(withSpawn.map((g) => g.loc.name).slice(-3), ['D18', 'Old Keep (100,119)', 'D20'], 'the filed spawn\'s plate kept over a nearer "?"');
  assert.equal(withSpawn.at(-4).loc.name, 'D9');
});

test('AUDIT OW4 D2: A SPAWN WHOSE TIME HAS RUN OUT IS NEVER LISTED (the ledger\'s test, handed in) - known, filed and near all the same; a map row is never asked it', () => {
  const at = { x: 100, y: 100 };
  const spawns = [{ x: 105, y: 100, loc: spawnLoc(105, 100) }, { x: 106, y: 100, loc: spawnLoc(106, 100) }];
  const q = { at, dungeons: [], locAt: () => null, isFound: () => false, spawns, spawnKnown: () => true, spawnFound: () => true };
  assert.deepEqual(nearDungeons(q).map((g) => g.x), [105, 106], 'none gone by default');
  const asked = [];
  assert.deepEqual(nearDungeons({ ...q, spawnGone: (s) => { asked.push(s.x); return s.x === 105; } }).map((g) => g.x), [106], 'gone: not marked, not walked');
  assert.deepEqual(asked, [105, 106]);
  const rows = [{ x: 102, y: 100, row: mapRow(102, 100, 7) }];
  assert.deepEqual(nearDungeons({ ...q, dungeons: rows, locAt: () => loc('Castle Dread', 7), spawnGone: () => true }).map((g) => g.loc.name), ['Castle Dread'], 'a real dungeon has no clock');
});

test('AUDIT OW4 D4: THE FOUND SPAWNS PAST THE STREAM - every pixel within the circle whose roll holds a spawn and whose id is FILED, that the index does not already speak for, is asked what stands there; on the map alone', () => {
  const at = { x: 100, y: 100 };
  const rolls = new Set(['110,100', '100,124', '117,117', '105,105', '90,90', '101,100']);
  const filed = new Set(['110,100', '100,124', '117,117', '105,105', '101,100', '130,100', '95,95']);
  const indexed = new Set(['105,105']);
  const stood = [];
  const q = { at, rolls: (x, y) => rolls.has(`${x},${y}`), filed: (x, y) => filed.has(`${x},${y}`), indexed: (x, y) => indexed.has(`${x},${y}`),
    stand: (x, y) => { stood.push(`${x},${y}`); return x === 101 ? null : { name: `S${x},${y}` }; } };
  assert.deepEqual(filedSpawns(q).map((s) => [s.x, s.y, s.loc.name]), [[110, 100, 'S110,100'], [100, 124, 'S100,124']],
    'rolled and filed within the circle; (117,117) lies past it, (105,105) is the index\'s, (90,90) unfiled, (95,95) unrolled, (101,100) stands nothing');
  assert.deepEqual(stood, ['101,100', '110,100', '100,124'], 'asked only of a rolled, filed, unindexed pixel within the circle');
  const all = { rolls: () => true, filed: () => true, indexed: () => false, stand: (x, y) => ({ x, y }) };
  assert.deepEqual(filedSpawns({ ...all, at: { x: 0, y: 0 }, range: 2 }).map((s) => `${s.x},${s.y}`), ['0,0', '1,0', '2,0', '0,1', '1,1', '0,2'], 'the map\'s own corner: nothing off it');
  assert.deepEqual(filedSpawns({ ...all, at: { x: 999, y: 499 }, range: 1 }).map((s) => `${s.x},${s.y}`), ['999,498', '998,499', '999,499'], 'and the far one');
  assert.equal(filedSpawns({ ...all, at, rolls: (x, y) => y === 100 && x === 100 + TV_FAR_RANGE }).length, 1, 'the far range by default');
  assert.equal(filedSpawns({ ...all, at, rolls: (x, y) => y === 100 && x === 101 + TV_FAR_RANGE }).length, 0);
});

test('AUDIT OW4 D6: WHERE THE LAST LEG STARTS - the aim of the leg before it (a join its own point, else its pixel\'s middle), or the feet when the journey is one leg; a door\'s edge is faced to it', () => {
  const mid = (p) => [p.x * 100 + 50, p.y * 100 + 50];
  const feet = { x: 1, z: 2 };
  assert.deepEqual(lastLegStart([], feet, mid), feet, 'no legs: the feet');
  assert.deepEqual(lastLegStart(null, feet, mid), feet);
  assert.deepEqual(lastLegStart([{ x: 5, y: 5, kind: 'open' }], feet, mid), feet, 'one leg: walked from the feet');
  assert.deepEqual(lastLegStart([{ x: 3, y: 4, kind: 'road' }, { x: 5, y: 5, kind: 'open' }], feet, mid), { x: 350, z: 450 }, 'the leg before: its pixel\'s middle');
  assert.deepEqual(lastLegStart([{ x: 1, y: 1, kind: 'open', at: { x: 7, z: 8 } }, { x: 5, y: 5 }], feet, mid), { x: 7, z: 8 }, 'a join (OW-ROADSIDE): its own point');
  assert.deepEqual(lastLegStart([{ x: 9, y: 9, at: { x: 1, z: 1 } }, { x: 3, y: 4 }, { x: 5, y: 5 }], feet, mid), { x: 350, z: 450 }, 'the one just before the last, never the first');
  const rect = { minX: 10000, maxX: 14096, minZ: 20000, maxZ: 24096 };
  const bent = [{ x: 1, y: 1 }, { x: 200, y: 220 }, { x: 120, y: 220 }];   // came round, and in from the east
  assert.deepEqual(dungeonApproach(rect, lastLegStart(bent, { x: 0, z: 22000 }, mid)), { x: 14096 + ARRIVAL_BUFFER, z: 22050 }, 'its east edge - the feet in the west would face the far side');
});

/** MOUNTAINS WALKABLE (the owner, the Wrothgarian zone's merge): the host's own ground refuses no step and names no peak
 *  (travelRoute.js routeGround). The door's law is the walk's own, over ANY ground that refuses - driven here by
 *  OW-MOUNTAINS' law as it stood before the merge, a stand-in and never the port's (test/tv2_click_to_move.test.js keeps
 *  the same one for the planner's own machinery). */
const oldPeaksLaw = (climateAt, heightAt, ax, ay, bx, by, leaving = false) => {
  if (leaving) return false;
  if (climateAt(bx, by) === TV_MOUNTAIN_CLIMATE) return true;
  return Math.abs(heightAt(bx, by) - heightAt(ax, ay)) > TV_STEEP_RISE;
};

test('AUDIT OW4 D1/D6 host, then MOUNTAINS WALKABLE (the owner, the Wrothgarian zone\'s merge): over the host\'s own ground a spot among the peaks is walked, straight over the ridge; over a ground that refuses (the old law, a stand-in) a walk to a spawn\'s DOOR is a place\'s - never refused for the peaks, its own pixel\'s step exempt, every other step under the law - while a spot there is refused; its edge faces the route\'s LAST LEG (lifted and run over the real planner)', () => {
  const w = rd('src/scenes/world.js');
  const m = /\n {2}(function travelViewWalkTo\(point, pix, \{ door = null, water = false, roads = false \} = \{\}\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  assert.ok(m, 'the walk, with its one option');
  const P = 32768, mid = (p) => [p.x * P + P / 2, p.y * P + P / 2];   // this test's own native frame
  const doorAt = (px, py) => { const [x, z] = mid({ x: px, y: py }); return { minX: x - 2048, maxX: x + 2048, minZ: z - 2048, maxZ: z + 2048 }; };
  const spot = (px, py) => { const [x, z] = mid({ x: px, y: py }); return [x, 0, z]; };
  let climate = () => 231, height = () => 20, water = () => false, real = null;   // real: the host's own ground (routeGround), else the stand-in
  const said = [], begun = [], plans = [];
  const [fx, fz] = mid({ x: 10, y: 5 });
  const d = {
    state: { worldCoords: (p) => ({ x: p[0], y: p[1], z: p[2] }) }, maps: { getClimateIndex: (x, y) => climate(x, y) }, TV_MOUNTAIN_CLIMATE,
    townTalk: { say: (t) => said.push(t) }, tvSay: (t) => said.push(t), TRAVEL_VIEW_TEXT: { mountains: 'peaks', noWay: 'no way', spot: 'spot' },   // AUDIT OW5 G2: the walk's refusals say through tvSay
    playerTravelPixel: () => ({ x: 10, y: 5 }), terrainGen: { roads: () => null }, planRoute, tvWater: (x, y) => water(x, y),
    tvOpenBlocked: (ax, ay, bx, by) => oldPeaksLaw(climate, height, ax, ay, bx, by),
    tvRouteGround: () => real ?? ({ isWater: (x, y) => water(x, y), peakAt: (x, y) => climate(x, y) === TV_MOUNTAIN_CLIMATE, openBlocked: (ax, ay, bx, by, leaving = false) => oldPeaksLaw(climate, height, ax, ay, bx, by, leaving) }),   // AUDIT OW4 J3: the ground read once
    tvJoinedLegs: (from, plan) => { plans.push(plan); return routeLegs(plan.pixels, plan.kinds); },
    dungeonApproach, pixelBox: () => null, lastLegStart, player: { pos: [fx, 0, fz] }, tvLegMid: mid,   // AUDIT OW5 J4: this map's own frame (its pixels are not the world's): the approach unclamped
    travelOptions: { beginTravelAlongRoute: (plan) => { begun.push(plan); return true; }, route: {} }, tvCautious: () => false, tvQuiet: false,
    partyWalkBegin: () => {}, travelGovernor: { reset: () => {} }, tvTrip: {}, routeDrawPoints, travelTripLine: () => '',
    // THE MERGE (OWS2): no boat on this walk - the planner asked on land, a refusal said as the view says it
    tvSeaMeans: () => null, dryLine: () => true, tvSeaAsk: () => null, tvSeaBegin: () => {}, tvSeaNoWay: () => said.push('no way'), crossesWater: () => false,
    tvMooredDry: () => null,   // AUDIT OW5 S3: no moored boat here
    travelPathUsesRoads: () => true, TRAVEL_PATH_TEXT: { fellBack: 'fell back' },   // OW-PATH: the Roads mode, the default
  };
  const walkTo = new Function('d', `const { ${Object.keys(d).join(', ')} } = d; return ${m[1]};`)(d);
  const reset = () => { said.length = 0; begun.length = 0; plans.length = 0; };
  // D1: the spawn's pixel among the peaks, and a one-pixel ridge on the way
  climate = (x, y) => ((x === 14 && y === 5) || (x === 12 && y >= 3 && y <= 7) ? TV_MOUNTAIN_CLIMATE : 231);
  // MOUNTAINS WALKABLE: over the host's own ground (routeGround over that climate) the spot is walked, the ridge crossed
  real = routeGround((x, y) => climate(x, y), (x, y) => height(x, y), 0);
  assert.equal(walkTo(spot(14, 5), { x: 14, y: 5 }), true, 'MOUNTAINS WALKABLE: a spot among the peaks - walked');
  assert.deepEqual([said, begun[0].point.pixel], [[], { x: 14, y: 5 }], 'nothing said - never "The mountains cannot be crossed on foot."');
  assert.ok(plans[0].pixels.some((p) => p.x === 12 && p.y >= 3 && p.y <= 7), '...straight over the ridge');
  real = null;
  reset();
  // the stand-in: a ground that refuses
  assert.equal(walkTo(spot(14, 5), { x: 14, y: 5 }), false, 'a spot among the peaks: refused');
  assert.deepEqual([said, begun], [['peaks'], []]);
  reset();
  assert.equal(walkTo(spot(14, 5), { x: 14, y: 5 }, { door: doorAt(14, 5) }), true, 'a spawn\'s door there: walked, as a MAPS dungeon on the pixel is');
  assert.deepEqual(begun[0].point.pixel, { x: 14, y: 5 });
  assert.ok(!plans[0].pixels.some((p) => p.x === 12 && p.y >= 3 && p.y <= 7), 'round the ridge on the way - the peaks\' law holds for every other step');
  // D1: a plateau - its pixel 60 over every neighbour
  reset();
  climate = () => 231;
  height = (x, y) => (x === 14 && y === 5 ? 80 : 20);
  assert.equal(walkTo(spot(14, 5), { x: 14, y: 5 }), false, 'a spot on it: no way up (AUDIT OW3 J5)');
  assert.deepEqual(said, ['no way']);
  assert.equal(walkTo(spot(14, 5), { x: 14, y: 5 }, { door: doorAt(14, 5) }), true, 'a door on it: its own pixel\'s step exempt, as a place\'s');
  // D6: straight in from the west - one leg, from the feet: the west edge
  reset();
  height = () => 20;
  const door = doorAt(14, 5);
  assert.equal(walkTo(spot(14, 5), { x: 14, y: 5 }, { door }), true);
  assert.deepEqual({ x: begun[0].point.x, z: begun[0].point.z }, { x: door.minX - ARRIVAL_BUFFER, z: fz }, 'its west edge, level with the feet');
  // D6: the sea wraps its west side - the route comes round and in from the east
  reset();
  const wet = new Set();
  for (let y = 1; y <= 9; y++) wet.add(`13,${y}`);
  for (let x = 13; x <= 15; x++) { wet.add(`${x},1`); wet.add(`${x},9`); }
  water = (x, y) => wet.has(`${x},${y}`);
  assert.equal(walkTo(spot(14, 5), { x: 14, y: 5 }, { door }), true);
  const legs = routeLegs(plans[0].pixels, plans[0].kinds), start = lastLegStart(legs, { x: fx, z: fz }, mid);
  assert.ok(start.x > door.maxX, 'the last leg comes in from the east');
  assert.equal(begun[0].point.x, door.maxX + ARRIVAL_BUFFER, 'so the door is its EAST edge - faced to the feet it was the west, and the last leg crossed the walls');
  assert.deepEqual({ x: begun[0].point.x, z: begun[0].point.z }, dungeonApproach(door, start));
  assert.deepEqual(begun[0].legs.at(-1), { x: 14, y: 5, kind: 'open' }, 'the route ends on its own pixel');
  // PIN MOVED (AUDIT OW5 J4): kept inside the walk's own pixel
  assert.match(w, /if \(door\) n = dungeonApproach\(door, lastLegStart\(legs, state\.worldCoords\(player\.pos\), tvLegMid\), undefined, pixelBox\(pix\.x, pix\.y\)\);   \/\/ AUDIT OW4 D6[^\n]*\n\s*const ok = travelOptions\.beginTravelAlongRoute\(/, 'aimed once the route is known, before the journey takes it');
});

test('AUDIT OW4 D2/D5/D4 host: THE KEPT LIST - rebuilt on ANY change to the index (its generation: a spawn gone and another come in one window), a kept spawn whose time ran out dropped at the next ask, and the found spawns past the stream listed with the rest (lifted and run)', () => {
  const w = rd('src/scenes/world.js');
  const m = /\n {2}(function travelViewDungeons\(\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  assert.ok(m, 'the list');
  const index = new Map([['105,100', spawnLoc(105, 100)]]);
  const gone = new Set(), ghosts = [];
  const env = new Function('d', `let tvDng = { at: null, dg: -1, list: [] }, _tvDungeonRows = null, _locIndexGen = 0;
    const { playerTravelPixel, discoveryGeneration, state, tvSpawnGone, nearDungeons, dungeonRows, mapDict, locationIndex, tvPlaceSummary, spawnedPixels,
      tvFiledSpawns, tvSpawnKnown, tvSpawnFound, locationWorldRect } = d;
    ${m[1]}
    return { list: travelViewDungeons, bump: () => { _locIndexGen += 1; } };`)({
    playerTravelPixel: () => ({ x: 100, y: 100 }), discoveryGeneration: () => 0, state: { terrainDistance: 3 }, tvSpawnGone: (x, y) => gone.has(`${x},${y}`),
    nearDungeons, dungeonRows, mapDict: new Map(), locationIndex: index, tvPlaceSummary: () => null, spawnedPixels, tvFiledSpawns: () => ghosts,
    tvSpawnKnown: () => true, tvSpawnFound: () => true, locationWorldRect: (l, x, y) => ({ minX: x * 10, maxX: x * 10 + 4, minZ: y * 10, maxZ: y * 10 + 4 }),
  });
  const xs = () => env.list().map((g) => g.px);
  const first = env.list();
  assert.deepEqual(first.map((g) => [g.key, g.found, g.spawn, g.x, g.z]), [[`spawn:${spawnedMapId(1, 105, 100)}`, true, true, 1052, 1002]]);
  assert.equal(env.list(), first, 'kept while nothing changes');
  // D5: one spawn expired and another stood in the same window - the size is the same
  index.delete('105,100');
  index.set('106,100', spawnLoc(106, 100));
  assert.equal(env.list(), first, 'the index\'s writers bump its generation; unbumped, the kept list stands');
  env.bump();
  assert.deepEqual(xs(), [106], 'bumped: the list is the index\'s again, though its size never moved');
  // D2: its clock runs out while the traveller stands - nothing rebuilds its pixel
  gone.add('106,100');
  assert.deepEqual(xs(), [], 'gone at the next ask: no plate, no walk');
  // D4: a found spawn past the stream
  ghosts.push({ x: 115, y: 100, loc: spawnLoc(115, 100) });
  env.bump();
  assert.deepEqual(env.list().map((g) => [g.px, g.found, g.spawn, g.rect.minX]), [[115, true, true, 1150]], 'listed with its rect: a plate, and a walk to its door');
  gone.add('115,100');
  assert.deepEqual(xs(), [], 'and its clocks hold for it too');
});

test('AUDIT OW4 D2/D4 host: a spawn is GONE by the feature\'s own test (the ledger\'s clocks, never while the player is in it); what WOULD stand on an unbuilt pixel is the feature\'s own gates and clone, with none of its writes; the found ones past the stream are the filed spawn ids, online (lifted and run)', async () => {
  const { discoverLocation, hasDiscoveredLocationId } = await import('../src/systems/discovery.js');
  const w = rd('src/scenes/world.js');
  // the clocks
  const g = /\n {2}(const tvSpawnGone = [^\n]*;)\n/.exec(w);
  assert.ok(g, 'the test');
  const ledger = createSpawnLedger();
  let clock = 0, inside = false;
  const built = new Map();
  const gone = new Function('_spawnLedger', '_spawnClock', '_insideSpawn', 'built', `${g[1]} return tvSpawnGone;`)(ledger, () => clock, (key) => inside && key === '5,6', built);
  ledger.note('5,6', 0);
  assert.equal(gone(5, 6), false, 'fresh');
  clock = GENERAL_TTL_MINUTES;
  assert.deepEqual([gone(5, 6), gone(5, 7)], [true, false], 'seven days on: gone; a pixel the ledger never met is not');
  inside = true;
  assert.equal(gone(5, 6), false, 'never while the player is in it (TTL1)');
  inside = false;
  built.set('5,6', { location: 'Elite Castle Fenwick' });
  assert.equal(gone(5, 6), false, 'AUDIT OW5b D2: standing on built ground, it stands until that ground is built again');
  built.set('5,6', { location: null });   // FIELD BUGS 29h (SPAWN-PLATE): the ground built again with the clock run out - empty
  assert.equal(gone(5, 6), true, 'built EMPTY is gone - no plate over bare grass, no walk to it');
  built.clear();
  clock = NaN;
  assert.equal(gone(5, 6), false, 'a clock not yet running expires nothing');
  // what would stand
  const a = /\n {2}(function tvSpawnAt\(px, py\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  assert.ok(a, 'the stand');
  let net = {};
  const cloned = [];
  const at = new Function('d', `const { maps, CLIMATES, _spawnGround, tvSpawnGone, terrainGen, pathFreePixel, _spawnCloneAt } = d; return ${a[1]};`)({
    maps: { getClimateIndex: (x) => (x === 1 ? CLIMATES.Ocean : 231) }, CLIMATES, _spawnGround: (x) => x !== 5, tvSpawnGone: (x) => x === 2, terrainGen: { roads: () => net },
    pathFreePixel: (n, x) => x !== 3, _spawnCloneAt: (x, y) => { cloned.push(x); return { name: `S${x},${y}` }; },
  });
  assert.deepEqual([at(1, 0), at(2, 0), at(3, 0), at(5, 0)], [null, null, null, null], 'the sea, a spent clock, a path across the pixel, a shore whose plateau is wet (SPAWN-SHORE): nothing');
  assert.deepEqual(at(4, 0), { name: 'S4,0' }, 'else the feature\'s own clone');
  net = null;
  assert.deepEqual(at(3, 0), { name: 'S3,0' }, 'before the network lands, as the feature stands it (provisional)');
  assert.deepEqual(cloned, [4, 3]);
  assert.match(w, /const loc = _spawnCloneAt\(px, py\);\n\s*if \(!loc\) return null;\n\s*_locIndexGen \+= 1;   \/\/ AUDIT OW4 D5\n\s*locationIndex\.set\(key, loc\);/, 'the feature stands the SAME clone');
  // the filed ids
  const f = /\n {2}(const tvFiledSpawns = \(at\) => [\s\S]*?: \[\]\);)\n/.exec(w);
  assert.ok(f, 'the found spawns past the stream');
  const near = { x: 300, y: 200 }, rolled = [];
  for (let x = 301; x < 330 && rolled.length < 2; x++) if (spawnsDungeon(1, x, 200)) rolled.push(x);
  let dry = 301;
  while (spawnsDungeon(1, dry, 201)) dry++;
  discoverLocation(spawnedMapId(1, rolled[0], 200), { locationName: 'Filed' });
  discoverLocation(spawnedMapId(1, dry, 201), { locationName: 'A pixel with no spawn' });
  assert.equal(hasDiscoveredLocationId(spawnedMapId(1, rolled[1], 200)), false);
  let online = true;
  const idx = new Map();
  const filedNow = new Function('d', `const { params, filedSpawns, spawnsDungeon, _spawnSalt, hasDiscoveredLocationId, spawnedMapId, locationIndex, tvSpawnAt } = d; ${f[1]} return tvFiledSpawns;`)({
    params: { has: (k) => k === 'online' && online }, filedSpawns, spawnsDungeon, _spawnSalt: 1, hasDiscoveredLocationId, spawnedMapId, locationIndex: idx,
    tvSpawnAt: (x, y) => ({ name: `S${x},${y}` }),
  });
  assert.deepEqual(filedNow(near).map((s) => [s.x, s.y]), [[rolled[0], 200]], 'the rolled AND filed pixel alone (its neighbour rolled, unfiled; a filed id no spawn rolls on)');
  idx.set(`${rolled[0]},200`, spawnLoc(rolled[0], 200));
  assert.deepEqual(filedNow(near), [], 'the index speaks for a built one');
  idx.clear();
  online = false;
  assert.deepEqual(filedNow(near), [], 'offline there are no spawns');
});

test('AUDIT OW4 D5/D3 host: every write to the index after the boot\'s fill bumps its generation (a spawn stood, one expired, the roads sweep\'s take-back); a load forgets the spawns the abandoned run was told of (lifted and run)', () => {
  const w = rd('src/scenes/world.js');
  const s = /\n {2}(const spawnedDungeonAt = \(px, py\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(w);
  assert.ok(s, 'the choke point');
  const seen = /\n {2}(function _spawnSeen\(key\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  assert.ok(seen, 'its first-sight door (OW6L)');
  const ledger = createSpawnLedger(), index = new Map(), unroaded = new Set();
  let clock = 0;
  const env = new Function('d', `let _locIndexGen = 0; const { params, spawnsDungeon, _spawnSalt, maps, CLIMATES, _spawnGround, terrainGen, pathFreePixel, _spawnLedger, _spawnClock, _insideSpawn,
    locationIndex, _spawnCloneAt, _spawnUnroaded, owSayRow, wildMaskOf, wildInside, wildHallStand } = d; ${seen[1]} ${s[1]} return { at: spawnedDungeonAt, gen: () => _locIndexGen };`)({
    params: { has: () => true }, spawnsDungeon: () => true, _spawnSalt: 1, maps: { getClimateIndex: () => 231 }, CLIMATES, _spawnGround: () => true, terrainGen: { roads: () => ({}) },
    pathFreePixel: () => true, _spawnLedger: ledger, _spawnClock: () => clock, _insideSpawn: () => false, locationIndex: index,
    _spawnCloneAt: (x, y) => spawnLoc(x, y), _spawnUnroaded: unroaded, owSayRow: () => {},
    wildMaskOf: () => null, wildInside: () => false, wildHallStand: () => null,   // PVPDUNGEONS: no open zone here - the spawner's own pixel
  });
  assert.equal(env.at(7, 8).name, 'Old Keep (7,8)');
  assert.deepEqual([env.gen(), index.has('7,8')], [1, true], 'stood: bumped');
  clock = GENERAL_TTL_MINUTES;
  assert.equal(env.at(7, 8), null);
  assert.deepEqual([env.gen(), index.has('7,8')], [2, false], 'expired: bumped');
  const r = /\n {2}(function _dropRoadedSpawns\(\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  assert.ok(r, 'the sweep');
  const sweepIndex = new Map([['3,4', spawnLoc(3, 4)]]), pending = new Set();
  const sweep = new Function('d', `let _locIndexGen = 0; const { terrainGen, _spawnUnroaded, pathFreePixel, _insideSpawn, locationIndex, _spawnLedger } = d; ${r[1]}
    return { run: _dropRoadedSpawns, gen: () => _locIndexGen };`)({
    terrainGen: { roads: () => ({}) }, _spawnUnroaded: pending, pathFreePixel: () => false, _insideSpawn: () => false, locationIndex: sweepIndex, _spawnLedger: createSpawnLedger(),
  });
  sweep.run();
  assert.equal(sweep.gen(), 0, 'nothing provisional: nothing to take back');
  pending.add('3,4');
  sweep.run();
  assert.deepEqual([sweep.gen(), sweepIndex.has('3,4')], [1, false], 'a road took one back: bumped');
  // D3: the load forgets what the last run was told - AUDIT OW5b D4: every load, a pose or none
  const i = w.indexOf('  function overworldLoadReset() {');
  const body = w.slice(i, w.indexOf('\n  }\n', i));
  assert.match(body, /tvDng = \{ at: null, dg: -1, list: \[\] \};[^\n]*\n\s*tvFind = \{ at: null, dg: -1, n: -1, list: \[\] \};[^\n]*\n[\s\S]*\n\s*_announcedSpawnPixels\.clear\(\);$/, 'with the lists it empties (the find\'s own too, AUDIT OW5 D1), its last act');
  assert.match(w, /function applyPose\(pose\) \{\n\s*overworldLoadReset\(\);[^\n]*\n\s*if \(!pose\) return;/, 'first, before a pose is asked for (AUDIT OW5b D4)');
});

// AUDIT OW5b D1: the find had read the Overworld's twelve, found first - and with twelve found about, no "?" stood and
// no dungeon was found by approach. travelViewDungeons, the find's own list (travelViewFindList - AUDIT OW5 D1's, which
// the merge kept for this audit's own) and dungeonFindFrame lifted out of world.js together and RUN.
test('AUDIT OW5b D1 host run: TWELVE FOUND ABOUT, AND THE KEEP NEXT DOOR IS STILL SEEN AND STILL FOUND - its "?" on the ground the view shows spends none of the twelve, and the find reads its own list, uncapped (a keep two pixels off, past a one-pixel grid, is found at 942 m though no "?" stands for it)', () => {
  const w = rd('src/scenes/world.js');
  const list = /\n {2}(function travelViewDungeons\(\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  const find = /\n {2}let _tvFindAt = 0;\n {2}(function dungeonFindFrame\(now\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  const own = /\n {2}(function travelViewFindList\(\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  const reach = /\n {2}(const TV_FIND_REACH = \d+;)/.exec(w);
  assert.ok(list && find && own && reach, 'the list, the find\'s own list, its reach and the find lifted');
  const run = ({ grid, near, rect }) => {
    const at = { x: 300, y: 200 }, index = new Map(), rows = [], found = new Set();
    for (let i = 0; i < 14; i++) {   // fourteen found keeps past the grid, within the far range
      const x = 305 + i;
      rows.push(mapRow(x, 200, LOCATION_TYPES.DungeonKeep)); index.set(`${x},200`, loc(`Found ${i}`, LOCATION_TYPES.DungeonKeep)); found.add(`${x},200`);
    }
    rows.push(mapRow(near.x, near.y, LOCATION_TYPES.DungeonKeep)); index.set(`${near.x},${near.y}`, loc('Castle Nearby', LOCATION_TYPES.DungeonKeep));   // unfound
    const filed = [], said = [];
    const env = new Function('d', `let tvDng = { at: null, dg: -1, list: [] }, tvFind = { at: null, dg: -1, n: -1, list: [] }, _tvDungeonRows = null, _locIndexGen = 0, _tvFindAt = 0;
      const { playerTravelPixel, discoveryGeneration, state, tvSpawnGone, nearDungeons, dungeonRows, mapDict, locationIndex, tvPlaceSummary, spawnedPixels,
        tvFiledSpawns, tvSpawnKnown, tvSpawnFound, locationWorldRect, isEnhanced, modes, walkMode, playerSpawned, worldMoveBusy, player,
        dungeonToFind, discoverLocation, maps, tvSay, dungeonFoundText } = d;
      ${reach[1]}
      ${list[1]}
      ${own[1]}
      ${find[1]}
      return { list: travelViewDungeons, find: dungeonFindFrame };`)({
      playerTravelPixel: () => at, discoveryGeneration: () => found.size, state: { terrainDistance: grid, worldCoords: () => ({ x: 300.95 * 32768, z: (499 - 200 + 0.5) * 32768 }) },
      tvSpawnGone: () => false, nearDungeons, dungeonRows, mapDict: dictOf(rows), locationIndex: index, tvPlaceSummary: (x, y) => (found.has(`${x},${y}`) ? { name: 'x' } : null),
      spawnedPixels, tvFiledSpawns: () => [], tvSpawnKnown: () => false, tvSpawnFound: () => false,
      locationWorldRect: (l, x, y) => (l.name === 'Castle Nearby' ? rect(x, y) : { minX: (x + 0.4) * 32768, maxX: (x + 0.6) * 32768, minZ: (499 - y + 0.4) * 32768, maxZ: (499 - y + 0.6) * 32768 }),
      isEnhanced: () => true, modes: { mode: 'exterior' }, walkMode: true, playerSpawned: true, worldMoveBusy: () => false, player: { pos: [0, 0, 0] },
      dungeonToFind, discoverLocation: (id, info) => { filed.push(info.locationName); found.add(`${near.x},${near.y}`); return true; }, maps: { getRegionName: () => 'Daggerfall' },
      tvSay: (t) => said.push(t), dungeonFoundText,
    });
    const shown = env.list();
    env.find(1000);
    return { shown, filed, said };
  };
  // the keep in the next pixel south, centred in it, with the view's own grid of three
  const next = run({ grid: 3, near: { x: 300, y: 201 }, rect: (x, y) => ({ minX: (x + 0.4) * 32768, maxX: (x + 0.6) * 32768, minZ: (499 - y + 0.4) * 32768, maxZ: (499 - y + 0.6) * 32768 }) });
  assert.equal(next.shown.filter((g) => g.found).length, TV_DUNGEON_MAX, 'twelve found plates, as ever');
  assert.ok(next.shown.some((g) => !g.found && g.loc.name === 'Castle Nearby'), 'and the "?" next door besides (it spends none of them)');
  assert.deepEqual([next.filed, next.said], [['Castle Nearby'], ['You have found Castle Nearby.']], 'found by approach');
  // two pixels east past a grid of one: its middle at 302.1 px, the feet at 300.95 - 942 m
  const far = run({ grid: 1, near: { x: 302, y: 200 }, rect: (x, y) => ({ minX: x * 32768, maxX: (x + 0.2) * 32768, minZ: (499 - y + 0.4) * 32768, maxZ: (499 - y + 0.6) * 32768 }) });
  assert.ok(!far.shown.some((g) => g.loc.name === 'Castle Nearby'), 'past the grid it yields its mark to the twelve found (AUDIT OW4 D7)');
  assert.deepEqual(far.filed, ['Castle Nearby'], 'and is found all the same - the find is its own');
});
