import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SMALLER_DUNGEONS_STATE, SMALLER_DUNGEON_THRESHOLD, smallerDungeonsStateNow,
  useSmallerDungeon, generateSmallerDungeon, dungeonLocationFor,
} from '../src/world/smallerDungeons.js';
import { setSeed, randomRange } from '../src/formats/dfRandom.js';
import { SITE_TYPES } from '../src/systems/quest/place.js';
import { Quest } from '../src/systems/quest/quest.js';
import { setValue, resetToDefaults, LIVE } from '../src/systems/settings.js';

// AUDIT 28 - W4: SMALLER DUNGEONS (MapsFile.cs:766-797, :1366-1444;
// Quest.cs:284). Experimental/SmallerDungeons ships False and the port
// carried only the quest save field, at NotSet. A dungeon with more
// than five blocks regenerates as a plus of five - a random interior
// block in the centre (the starting block), four random border blocks
// around it - from its OWN list, DFRandom seeded on the raw MapId.
// Main-story dungeons never shrink; a dungeon a live quest points at
// keeps the size the quest compiled with.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const PRIVATEERS_HOLD = 187853213;
const block = (name) => ({ blockName: name, x: 9, z: 9, isStartingBlock: false });
const loc = (names, mapId = 777) => ({
  name: 'T', hasDungeon: true,
  mapTableData: { mapId },
  dungeon: { blocks: names.map(block) },
});
const BIG = ['N0000000.RDB', 'N0000001.RDB', 'W0000002.RDB', 'B0000003.RDB', 'B0000004.RDB', 'b0000005.RDB', 'B0000006.RDB'];

test('AUDIT 28 W4: the five-block plus - centre interior and starting, four borders, addresses verbatim, source untouched', () => {
  const src = loc(BIG);
  const out = generateSmallerDungeon(src);
  assert.notEqual(out, src, 'a big dungeon answers a clone');
  assert.equal(src.dungeon.blocks.length, BIG.length, 'the cached location is never mutated');
  assert.equal(out.dungeon.blocks.length, 5);
  const [c, n, w, e, s] = out.dungeon.blocks;
  assert.deepEqual([c.x, c.z, c.isStartingBlock], [0, 0, true]);
  assert.deepEqual([n.x, n.z, n.isStartingBlock], [0, -1, false]);
  assert.deepEqual([w.x, w.z], [-1, 0]);
  assert.deepEqual([e.x, e.z], [1, 0]);
  assert.deepEqual([s.x, s.z], [0, 1]);
  // Pools: the centre from the NON-border list, the four from the
  // border list - "starts with B", case-insensitive (:1431).
  assert.ok(!/^b/i.test(c.blockName), `centre ${c.blockName} must be interior`);
  for (const b2 of [n, w, e, s]) assert.ok(/^b/i.test(b2.blockName), `${b2.blockName} must be a border block`);
});

test('AUDIT 28 W4: DFRandom seeded on the raw MapId - the same small dungeon every visit, and exactly DFU\'s draws', () => {
  const a = generateSmallerDungeon(loc(BIG));
  const b = generateSmallerDungeon(loc(BIG));
  assert.deepEqual(a.dungeon.blocks, b.dungeon.blocks, 'deterministic per dungeon');
  // Re-derive by hand with the same stream: five random_range draws
  // over the filtered pools, in layout order (:1389-1397).
  setSeed(777);
  const interior = BIG.filter((x) => !/^b/i.test(x));
  const border = BIG.filter((x) => /^b/i.test(x));
  const expect = [
    interior[randomRange(0, interior.length)],
    border[randomRange(0, border.length)],
    border[randomRange(0, border.length)],
    border[randomRange(0, border.length)],
    border[randomRange(0, border.length)],
  ];
  assert.deepEqual(a.dungeon.blocks.map((x) => x.blockName), expect);
  // A different MapId is a different plus (with this pool, seed 778 differs).
  const c = generateSmallerDungeon(loc(BIG, 778));
  assert.notDeepEqual(c.dungeon.blocks.map((x) => x.blockName), expect);
});

test('AUDIT 28 F-B3: the enum is DFU\'s, in DFU\'s order - NotSet, Disabled, Enabled', () => {
  assert.deepEqual(SMALLER_DUNGEONS_STATE, { NotSet: 0, Disabled: 1, Enabled: 2 });
});

test('AUDIT 28 W4: the threshold and the two verbatim throws', () => {
  assert.equal(SMALLER_DUNGEON_THRESHOLD, 5);
  const small = loc(['N0.RDB', 'B1.RDB', 'B2.RDB', 'B3.RDB', 'B4.RDB']);
  assert.equal(generateSmallerDungeon(small), small, 'five blocks or fewer pass through untouched');
  assert.throws(() => generateSmallerDungeon(loc(BIG, PRIVATEERS_HOLD)), /must not be called on a main story dungeon/);
  assert.throws(() => generateSmallerDungeon(loc(['N0.RDB', 'N1.RDB', 'N2.RDB', 'N3.RDB', 'N4.RDB', 'N5.RDB'])), /failed to find a suitable block/,
    'six interior blocks and no border: GetRandomBlock throws, verbatim');
});

test('AUDIT 28 W4: UseSmallerDungeon - the gate order: dungeon, main story, the quest\'s frozen state, then the setting', () => {
  resetToDefaults();
  const machine = (state) => ({
    getSiteLinks: (siteType, mapId) => (siteType === SITE_TYPES.Dungeon && mapId === 777 ? [{ questUID: 5 }] : []),
    getQuest: (uid) => (uid === 5 ? { smallerDungeonsState: state } : null),
  });
  assert.equal(useSmallerDungeon(loc(BIG), { setting: true }), true);
  assert.equal(useSmallerDungeon(loc(BIG), { setting: false }), false);
  assert.equal(useSmallerDungeon(loc(BIG, PRIVATEERS_HOLD), { setting: true }), false, 'main story never');
  assert.equal(useSmallerDungeon({ ...loc(BIG), hasDungeon: false }, { setting: true }), false);
  // A live quest's frozen state outranks the setting, both ways.
  assert.equal(useSmallerDungeon(loc(BIG), { questMachine: machine(SMALLER_DUNGEONS_STATE.Enabled), setting: false }), true);
  assert.equal(useSmallerDungeon(loc(BIG), { questMachine: machine(SMALLER_DUNGEONS_STATE.Disabled), setting: true }), false);
  // NotSet falls through to the setting (an old save's quest).
  assert.equal(useSmallerDungeon(loc(BIG), { questMachine: machine(SMALLER_DUNGEONS_STATE.NotSet), setting: true }), true);
  // The one door: sized when the law says so.
  const sized = dungeonLocationFor(loc(BIG), { setting: true });
  assert.equal(sized.dungeon.blocks.length, 5);
  assert.equal(dungeonLocationFor(loc(BIG), { setting: false }).dungeon.blocks.length, BIG.length);
  // The setting is the default source, read live.
  setValue('Experimental', 'SmallerDungeons', true);
  assert.equal(useSmallerDungeon(loc(BIG)), true);
  resetToDefaults();
  assert.equal(useSmallerDungeon(loc(BIG)), false, 'ships False');
  assert.equal(LIVE['Experimental/SmallerDungeons'], 'src/world/smallerDungeons.js');
});

test('AUDIT 28 W4: Quest.Start freezes the state (Quest.cs:284), the save carries it, an old envelope restores NotSet', () => {
  resetToDefaults();
  assert.equal(smallerDungeonsStateNow(true), SMALLER_DUNGEONS_STATE.Enabled);
  assert.equal(smallerDungeonsStateNow(false), SMALLER_DUNGEONS_STATE.Disabled);
  const q = new Quest({ nowSeconds: () => 100 });
  assert.equal(q.smallerDungeonsState, SMALLER_DUNGEONS_STATE.NotSet, 'NotSet until Start');
  setValue('Experimental', 'SmallerDungeons', true);
  q.start();
  assert.equal(q.smallerDungeonsState, SMALLER_DUNGEONS_STATE.Enabled);
  setValue('Experimental', 'SmallerDungeons', false);
  assert.equal(q.smallerDungeonsState, SMALLER_DUNGEONS_STATE.Enabled, 'frozen: the flip does not move a started quest');
  assert.equal(q.getSaveData().smallerDungeonsState, SMALLER_DUNGEONS_STATE.Enabled);
  const r = new Quest({});
  r.restoreSaveData({ ...q.getSaveData() });
  assert.equal(r.smallerDungeonsState, SMALLER_DUNGEONS_STATE.Enabled);
  const older = new Quest({});
  const env = q.getSaveData(); delete env.smallerDungeonsState;
  older.restoreSaveData(env);
  assert.equal(older.smallerDungeonsState, SMALLER_DUNGEONS_STATE.NotSet);
  resetToDefaults();
});

test('AUDIT 28 W4: the entry seam - the location that gets BUILT is the sized clone, with the bridge\'s machine', () => {
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /const dfLocation = dungeonLocationFor\(hit\.dfLocation, \{ questMachine: questBridge\?\.machine \}\);/,
    'tryEnterDungeon does not size the location');
  const fn = modes.slice(modes.indexOf('async function tryEnterDungeon('));
  assert.ok(fn.indexOf('dungeonLocationFor(') < fn.indexOf('buildDungeonContext('), 'sized BEFORE the context is built');
});

test('AUDIT 28 W4: the save stamps the raw setting, and a load under the other setting warps to the start marker - story dungeons and old envelopes never', () => {
  const ctx = read('src/scenes/dungeonContext.js');
  assert.match(ctx, /smallerDungeonsState: getBool\('Experimental', 'SmallerDungeons'\) \? 2 : 1,/, 'SerializablePlayer.cs:224 - the stamp, in DFU\'s enum order (F-B3)');
  const arm = ctx.slice(ctx.indexOf('const savedSmaller = extras.smallerDungeonsState === 2;'));
  assert.ok(arm.length > 100, 'the warp arm exists');
  assert.match(arm, /extras\.smallerDungeonsState && extras\.locationKey === _locationKey/, 'an old envelope (no field) never warps, and neither does a different dungeon');
  assert.match(arm, /savedSmaller !== getBool\('Experimental', 'SmallerDungeons'\)/, ':463 - the states must DIFFER');
  assert.match(arm, /!isMainStoryDungeon\(dfLocation\?\.mapTableData\?\.mapId\)/, ':466-468 - story dungeons never warp');
  // F-B1: through the entry law (floorLanding over the START marker),
  // not the raw marker position - :470 names StartMarker, and the
  // port's spawn space is the landed one.
  assert.match(arm, /const p = this\.startSpawn\(\{ preferEnterMarker: false \}\);/, 'the start marker under the entry law is the destination');
  // The warp sits AFTER the position restore, so it overrides it.
  const posAt = ctx.indexOf('if (extras.position && extras.locationKey === _locationKey && setPlayerPos) setPlayerPos(extras.position);');
  const warpAt = ctx.indexOf('const savedSmaller = extras.smallerDungeonsState === 2;');
  assert.ok(posAt > 0 && warpAt > posAt, 'restore first, then the warp');
});

test('AUDIT 28 F-B2: the quest layer\'s maps sizes getLocation/getLocationByName - markers are picked from the dungeon that gets built', () => {
  // DFU's law lives INSIDE MapsFile.GetLocation, so quest marker
  // enumeration walks the five-block dungeon when the law says so. The
  // port's quest world wraps the raw maps the same way, late-binding
  // the bridge's machine.
  const world = read('src/scenes/world.js');
  const at = world.indexOf('const questWorld = {');
  assert.ok(at > 0);
  const wrap = world.slice(at, at + 2200);
  assert.match(wrap, /maps: Object\.create\(maps, \{/, 'the quest maps is a wrap over the raw maps');
  assert.match(wrap, /getLocation: \{ value: \(r, l\) => dungeonLocationFor\(maps\.getLocation\(r, l\), \{ questMachine: questBridge\?\.machine \}\) \},/);
  assert.match(wrap, /getLocationByName: \{ value: \(rn, ln\) => dungeonLocationFor\(maps\.getLocationByName\(rn, ln\), \{ questMachine: questBridge\?\.machine \}\) \},/);
  // The prototype delegation keeps every other maps method reachable -
  // the quest layer also calls getClimateIndex, getRegion,
  // getRmbBlockName and readLocationIdFast on this object.
  const proto = { getRegion: () => 'r', getLocation: () => 'full' };
  const wrapped = Object.create(proto, { getLocation: { value: () => 'sized' } });
  assert.equal(wrapped.getLocation(), 'sized');
  assert.equal(wrapped.getRegion(), 'r');
  // And dungeonLocationFor(null) passes null through - getLocation can
  // answer null and the wrap must not throw on it.
  assert.equal(dungeonLocationFor(null, { setting: true }), null);
});
