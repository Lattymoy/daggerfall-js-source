import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SPAWN_CHANCE, SALT_MAX, WORLD_SALT, hash32, spawnsDungeon, spawnedMapId, pickTemplate, synthesizeDungeonLocation, spawnTemplates } from '../src/world/spawnedDungeons.js';
import { isWorldRoom } from '../src/net/wire.js';
import { getMapPixelID, longitudeLatitudeToMapPixel } from '../src/formats/mapsFile.js';

test('SPAWNED-DUNGEONS: the roll is a pure function of (salt, pixel) and lands near the chance', () => {
  assert.equal(SPAWN_CHANCE, 0.10);
  assert.equal(spawnsDungeon(7, 100, 200), spawnsDungeon(7, 100, 200), 'the same pixel answers the same, load after load');
  let hits = 0, n = 0;
  for (let x = 0; x < 200; x++) for (let y = 0; y < 100; y++) { n++; if (spawnsDungeon(1234, x, y)) hits++; }
  assert.ok(Math.abs(hits / n - SPAWN_CHANCE) < 0.02, `~${SPAWN_CHANCE * 100}% of ${n} pixels, got ${(hits / n).toFixed(3)}`);
  assert.equal(spawnsDungeon(5, 1, 1, 0), false);
  assert.equal(spawnsDungeon(5, 1, 1, 1), true);
  assert.ok(hash32(1, 2, 3) !== hash32(1, 3, 2), 'order matters');
  assert.ok(Number.isInteger(WORLD_SALT) && WORLD_SALT >= 1 && WORLD_SALT <= SALT_MAX, 'the world salt is a legal id salt');
});

test('SPAWNED-DUNGEONS: the id carries the pixel id in its low 20 bits, the salt above, and is a room the relay admits', () => {
  for (const [salt, x, y] of [[1, 0, 0], [4095, 999, 499], [77, 109, 158]]) {
    const id = spawnedMapId(salt, x, y);
    assert.equal(id & 0xfffff, getMapPixelID(x, y), 'MapId & 0xfffff is the pixel, as DFU has it');
    assert.equal(id >>> 20, salt);
    assert.ok(id >= 2 ** 20 && id <= 0xffffffff);
    assert.ok(isWorldRoom(`dungeon:m${id}`), `the relay keeps a world for ${id}`);
  }
  assert.notEqual(spawnedMapId(1, 5, 5), spawnedMapId(2, 5, 5), 'another salt, another id');
  assert.throws(() => spawnedMapId(0, 1, 1), RangeError);
  assert.throws(() => spawnedMapId(1, 1000, 1), RangeError);
  assert.throws(() => spawnedMapId(1, 1, 500), RangeError);
  assert.throws(() => spawnedMapId(1, -1, 1), RangeError);
});

test('SPAWNED-DUNGEONS: the clone stands on its pixel under its own id, and the template is never touched', () => {
  const template = {
    name: 'Old Ruin', regionIndex: 3, regionName: 'Daggerfall Bluffs', politic: 131, locationIndex: 12, hasDungeon: true, climate: { climateType: 1 },
    mapTableData: { mapId: 999, longitude: 1, latitude: 2, dungeonType: 4 },
    exterior: { exteriorData: { width: 1, height: 1, locationId: 55, blockNames: ['A.RMB'] } },
    dungeon: { recordElement: { header: { locationId: 55 } }, blocks: [{ blockName: 'B1.RDB' }] },
  };
  const before = JSON.stringify(template);
  const where = { regionIndex: 9, regionName: 'Isle', politic: 137, climate: { climateType: 2 } };
  const c = synthesizeDungeonLocation(template, { salt: 42, px: 300, py: 120, where });
  assert.equal(JSON.stringify(template), before, 'non-mutating');
  const id = spawnedMapId(42, 300, 120);
  assert.equal(c.mapTableData.mapId, id);
  assert.deepEqual(longitudeLatitudeToMapPixel(c.mapTableData.longitude, c.mapTableData.latitude), { x: 300, y: 120 }, 'what dungeonHome() reads for the save lands on the pixel');
  assert.equal(c.mapTableData.dungeonType, 4, 'the rest of the row is the template\'s');
  assert.equal(c.exterior.exteriorData.locationId, id);
  assert.equal(c.dungeon.recordElement.header.locationId, id, 'the room\'s `dungeon:<id>` key and the save\'s');
  assert.equal(c.exterior.exteriorData.blockNames, template.exterior.exteriorData.blockNames, 'the layout is shared, not copied');
  assert.equal(c.dungeon.blocks, template.dungeon.blocks);
  assert.equal(c.name, 'Old Ruin (300,120)');
  assert.notEqual(c.name, synthesizeDungeonLocation(template, { salt: 42, px: 301, py: 120 }).name, 'two spawns of a template never share an automap key');
  assert.equal(c.regionIndex, 9); assert.equal(c.climate, where.climate); assert.equal(c.politic, 137);
  assert.equal(c.locationIndex, -1, 'no real table row');
  assert.equal(c.hasDungeon, true); assert.equal(c.spawned, true);
  assert.equal(synthesizeDungeonLocation(template, { salt: 42, px: 300, py: 120 }).regionIndex, 3, 'no `where`: the template\'s');
});

test('SPAWNED-DUNGEONS: the template pick is deterministic and an empty list picks nothing', () => {
  const t = ['a', 'b', 'c', 'd'];
  assert.equal(pickTemplate(t, 9, 10, 20), pickTemplate(t, 9, 10, 20));
  assert.ok(t.includes(pickTemplate(t, 9, 10, 20)));
  assert.equal(pickTemplate([], 9, 10, 20), null);
  assert.equal(pickTemplate(null, 9, 10, 20), null);
  assert.ok(new Set(Array.from({ length: 200 }, (_, i) => pickTemplate(t, 9, i, 0))).size > 1, 'the pixels do not all pick one');
});

test('SPAWNED-DUNGEONS: templates are real non-main-story dungeons, one-block exteriors first', () => {
  const L = (mapId, w, h, over = {}) => ({ hasDungeon: true, mapTableData: { mapId }, exterior: { exteriorData: { width: w, height: h } }, dungeon: { blocks: [{}] }, ...over });
  const big = L(1, 2, 2), one = L(2, 1, 1), main = L(3, 1, 1), town = L(4, 1, 1, { hasDungeon: false }), empty = L(5, 1, 1, { dungeon: { blocks: [] } }), spawned = L(6, 1, 1, { spawned: true });
  assert.deepEqual(spawnTemplates([big, one, main, town, empty, spawned, null], (id) => id === 3), [one]);
  assert.deepEqual(spawnTemplates([big], () => false), [big], 'no one-block exterior: any real dungeon');
  assert.deepEqual(spawnTemplates(null), []);
});

test('SPAWNED-DUNGEONS by source: ONE choke point (buildPixelNow), online-only off the page params, wrapped, never a fresh roll per load', async () => {
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /const dfLocation = locationIndex\.get\(key\) \|\| spawnedDungeonAt\(px, py\) \|\| null;/, 'a real location always wins; only an empty pixel is asked');
  const i = w.indexOf('const spawnedDungeonAt = (px, py) => {');
  const fn = w.slice(i, w.indexOf('\n  };\n', i));
  assert.match(fn, /if \(!params\.has\('online'\)\) return null;/, 'online only - and off params: `onlineOn` is a const declared far below this build');
  assert.match(fn, /spawnsDungeon\(_spawnSalt, px, py\)/, 'the roll is the hash, so a reload of the pixel answers the same');
  assert.match(fn, /CLIMATES\.Ocean\) return null/, 'no dungeon at sea');
  assert.match(fn, /const key = `\$\{px\},\$\{py\}`;/);
  assert.match(fn, /locationIndex\.set\(key, loc\)/, 'stood in the index every reader already asks');
  assert.match(fn, /catch \(e\) \{ console\.warn\('\[spawned dungeons\]'[^\n]*return null; \}/, 'a failure costs one pixel its dungeon, never the stream');
  assert.doesNotMatch(fn, /Math\.random/);
  assert.match(w, /const _spawnSalt = WORLD_SALT;/, 'one salt for every client: everyone sees the same dungeons');
});

test('SPAWNED-DUNGEONS2b by source: ONE line per crossing, the CLOSEST spawn, with a compass word', async () => {
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /queue\.push\(\.\.\.r\.load\);\s*\n\s*announceNearbySpawns\(r\.current\.x, r\.current\.y\);/);
  // the whole point of the rewrite: a crossing can find several at once
  // (the search is a 5x5 block), and the old code said a line per hit
  assert.match(w, /for \(const f of found\) _announcedSpawnPixels\.add\(f\.key\);/, 'every hit this crossing is spent, even the ones left unsaid - never re-nags later');
  assert.match(w, /found\.sort\(\(a, b\) => a\.d2 - b\.d2\);/, 'closest first');
  const i = w.indexOf('function announceNearbySpawns(px, py) {');
  const fn = w.slice(i, w.indexOf('\n  }\n', i));
  assert.equal((fn.match(/townTalk\.say\(/g) ?? []).length, 2, 'two spellings, one of them said: on the pixel, or with a direction');
  assert.match(fn, /directionHintString\(nearest\.dx, -nearest\.dy\)/, 'py is south-positive, so north flips the sign');
  assert.match(fn, /You see a Dungeon nearby, in the \$\{_capitalize\(directionHintString/, 'the phrasing');
});

test('SPAWNED-DUNGEONS2b: the compass word - talk.js\'s own eight bands, off the map-pixel delta', async () => {
  const { directionHintString } = await import('../src/systems/talk.js');
  // px east-positive, py south-positive, so the call flips dy:
  assert.equal(directionHintString(1, -0), 'east', 'due east: +dx');
  assert.equal(directionHintString(0, -1), 'south', 'due south: py larger, so -dy is negative');
  assert.equal(directionHintString(-1, -1), 'southwest');
  assert.equal(directionHintString(1, 1), 'northeast', 'py smaller is north');
});

// ── TTL1: THE TWO CLOCKS ──────────────────────────────────────────
//
// The creator's rule, relayed by Mac (2026-09-20): "Spawned Dungeons
// should expire/removed after 2 ingame days when cleared when there is
// no player in it - and after 7 ingame days in general when there is
// no player in it."

test('TTL1: two days cleared, seven days in general, whichever runs out first', async () => {
  const { spawnExpired, CLEARED_TTL_MINUTES, GENERAL_TTL_MINUTES, CLEARED_TTL_DAYS, GENERAL_TTL_DAYS } = await import('../src/world/spawnedDungeons.js');
  const { MINUTES_PER_DAY } = await import('../src/systems/gameDate.js');
  assert.equal(CLEARED_TTL_DAYS, 2); assert.equal(GENERAL_TTL_DAYS, 7);
  assert.equal(CLEARED_TTL_MINUTES, 2 * MINUTES_PER_DAY, 'a day is the clock\'s own, never a second 1440');
  assert.equal(GENERAL_TTL_MINUTES, 7 * MINUTES_PER_DAY);
  const D = (n) => n * MINUTES_PER_DAY;
  // the long clock, never touched
  assert.equal(spawnExpired({ seen: 0 }, D(6)), false, 'day six: still there');
  assert.equal(spawnExpired({ seen: 0 }, D(7) - 1), false);
  assert.equal(spawnExpired({ seen: 0 }, D(7)), true, 'day seven in general');
  // the short clock, started at the clearing
  assert.equal(spawnExpired({ seen: 0, cleared: D(1) }, D(2)), false, 'cleared day one: one day of its two');
  assert.equal(spawnExpired({ seen: 0, cleared: D(1) }, D(3)), true, 'two days after the clearing');
  // clearing NEVER buys more life than the long clock allows
  assert.equal(spawnExpired({ seen: 0, cleared: D(6) }, D(7)), true, 'cleared on day six is still gone on day seven, not day eight');
  // nothing is expired by a clock that has not run
  assert.equal(spawnExpired(null, D(99)), false);
  assert.equal(spawnExpired({}, D(99)), false, 'a row with no `seen` is one this ledger never met');
  assert.equal(spawnExpired({ seen: 0 }, NaN), false);
  // an older save winds the clock BACK; a negative elapsed is never expiry
  assert.equal(spawnExpired({ seen: D(50) }, D(1)), false);
  assert.equal(spawnExpired({ seen: 0, cleared: D(50) }, D(1)), false);
});

test('TTL1: the ledger starts each clock ONCE - a later sight or a second clearing buys nothing', async () => {
  const { createSpawnLedger, GENERAL_TTL_MINUTES, CLEARED_TTL_MINUTES } = await import('../src/world/spawnedDungeons.js');
  const L = createSpawnLedger();
  L.note('5,5', 100);
  L.note('5,5', 100 + GENERAL_TTL_MINUTES - 1);   // walked past it again on day six
  assert.equal(L.expired('5,5', 100 + GENERAL_TTL_MINUTES), true, 'seeing it again did not restart the seven days');
  assert.equal(L.size, 1);
  const M = createSpawnLedger();
  M.note('1,2', 0);
  M.clear('1,2', 10);
  M.clear('1,2', 10 + CLEARED_TTL_MINUTES - 1);   // walked back into a dungeon already emptied
  assert.equal(M.expired('1,2', 10 + CLEARED_TTL_MINUTES), true, 'a second clearing did not buy another two days');
  assert.equal(M.expired('9,9', 10 ** 9), false, 'a pixel this ledger never met is not expired');
  assert.equal(M.clear('7,7', 50).seen, 50, 'clearing something unseen still starts both clocks');
  assert.equal(M.note('', 1), null); assert.equal(M.note('a', NaN), null); assert.equal(M.clear('a', NaN), null);
  assert.equal(M.forget('1,2'), true); assert.equal(M.forget('1,2'), false);
  assert.equal(M.expired('1,2', 10 ** 9), false, 'forgotten is gone for good, not expired forever');
});

test('TTL1: the ledger round-trips through a save', async () => {
  const { createSpawnLedger } = await import('../src/world/spawnedDungeons.js');
  const L = createSpawnLedger();
  L.note('1,1', 10); L.note('2,2', 20); L.clear('2,2', 30);
  assert.deepEqual(L.toJSON(), [['1,1', 10], ['2,2', 20, 30]], 'the cleared time is only written when there is one');
  const M = createSpawnLedger();
  assert.equal(M.load(L.toJSON()), 2);
  assert.deepEqual(M.toJSON(), L.toJSON());
  assert.equal(M.load([['x', 'nope'], [7, 1], []]), 0, 'junk rows are dropped, not loaded');
  assert.equal(M.load(null), 0, 'a save with no ledger loads an empty one');
});

test('TTL1 by source: expiry is checked on the pixel build, and never while the player is in it', async () => {
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const i = w.indexOf('const spawnedDungeonAt = (px, py) => {');
  const fn = w.slice(i, w.indexOf('\n  };\n', i));
  assert.match(fn, /_spawnLedger\.expired\(key, _spawnClock\(\)\) && !_insideSpawn\(key\)/, 'both clocks AND the creator\'s "no player in it"');
  assert.match(fn, /_spawnLedger\.forget\(key\);\s*\n\s*locationIndex\.delete\(key\);\s*\n\s*return null;/, 'expired: the row goes, the location goes, the pixel is empty land');
  assert.match(fn, /_spawnLedger\.note\(key, _spawnClock\(\)\);/, 'first sight starts the long clock');
  // the boot builds the player's OWN pixel through this function before
  // `playerTicker` is declared - a temporal dead zone `?.` cannot save
  assert.match(w, /let _spawnClock = \(\) => NaN;/, 'the clock is ASKED, not read: until the ticker stands every ledger call is a no-op');
  assert.ok(w.indexOf('let _spawnClock = () => NaN;') < w.indexOf('const spawnedDungeonAt = (px, py) => {'), 'declared above its first use');
  assert.match(w, /_spawnClock = \(\) => Math\.floor\(playerTicker\.classicMinutes\);/, 'armed the moment the ticker stands');
  assert.ok(w.indexOf('_spawnClock = () => Math.floor(playerTicker.classicMinutes);') > w.indexOf('const playerTicker = createPlayerTicker('), 'and never before it');
  // the ONE thing that holds a spawn past its time
  const j = w.indexOf('const _insideSpawn = (key) =>');
  const inside = w.slice(j, w.indexOf(';\n', w.indexOf('=== key', j)));
  assert.match(inside, /\(modes\?\.mode \?\? 'exterior'\) === 'dungeon'/, 'outside a dungeon nothing is in one');
  assert.match(inside, /`\$\{playerTravelPixel\(\)\.x\},\$\{playerTravelPixel\(\)\.y\}` === key/, 'a dungeon freezes the pixel at the entrance, which IS the spawn\'s key');
  // the short clock's start, from the mode machine's dungeon
  const k = w.indexOf('const _noteSpawnCleared = () => {');
  const cleared = w.slice(k, w.indexOf('\n  };\n', k));
  assert.match(cleared, /if \(!locationIndex\.get\(key\)\?\.spawned\) return;/, 'a real dungeon being cleared never invents a ledger row');
  assert.match(cleared, /_spawnLedger\.clear\(key, _spawnClock\(\)\)/);
  assert.match(w, /onDungeonCleared: _noteSpawnCleared,/, 'the host answers the context');
  assert.match(w, /onDungeonSpawned: \(\) => \{ const p = playerTravelPixel\(\); _spawnLedger\.note\(`\$\{p\.x\},\$\{p\.y\}`/, 'entering one starts the long clock too - a save loaded straight into a spawn was never built through buildPixelNow this session');
});

test('TTL1 by source: the dungeon context tells the host, on a throttle, ahead of the automap\'s own early return', async () => {
  const { readFileSync } = await import('node:fs');
  const d = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(d, /if \(dfLocation\?\.spawned\) opts\.onDungeonSpawned\?\.\(\);/, 'only a synthesized dungeon, and only once - this is the build');
  const i = d.indexOf('    automapTick(dt, eye, fwd) {');
  const tick = d.slice(i, i + 1400);
  const clearAt = tick.indexOf('opts.onDungeonCleared();');
  const returnAt = tick.indexOf('if (automapScanT < SCAN_INTERVAL_S) return;');
  assert.ok(clearAt > 0 && returnAt > 0 && clearAt < returnAt, 'ahead of the scan\'s early return, so it still runs on the frames the scan skips');
  assert.match(tick, /foes\.every\(\(f\) => f\.dead\) && lootPiles\.every\(\(p\) => p\.items\.length === 0\)/, 'fully cleared: every foe dead, every pile taken');
  assert.match(tick, /if \(!_clearedSent && opts\.onDungeonCleared\)/, 'told once, and nothing at all until a host passes it');
  assert.match(d, /_clearedCheckT >= CLEARED_CHECK_INTERVAL_S/, 'on its own slow throttle, not every frame');
  const w = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(w, /onDungeonSpawned: \(\) => host\.onDungeonSpawned\?\.\(\),/, 'forwarded to the outer host, which owns the ledger and the pixel');
  assert.match(w, /onDungeonCleared: \(\) => host\.onDungeonCleared\?\.\(\),/);
});

test('TTL1: the ledger rides EVERY save - and the quickslots block it sat beside was being dropped', async () => {
  const { snapshotPlayer, composeSessionState, restoreSessionState } = await import('../src/systems/save.js');
  const { createSpawnLedger } = await import('../src/world/spawnedDungeons.js');
  const L = createSpawnLedger();
  L.note('9,9', 4000); L.clear('9,9', 5000);
  const extras = composeSessionState({ spawnLedger: L });
  assert.deepEqual(extras.spawns, [['9,9', 4000, 5000]]);
  assert.equal(composeSessionState({}).spawns, null, 'no ledger (the standalone ?dungeon scene): no block');
  // snapshotPlayer drops any option it does not NAME - which is what
  // had been happening to QS1's quickslots since it landed
  const snap = snapshotPlayer({ name: 'x', stats: {} }, { ...extras, quickslots: { left: 3 } });
  assert.deepEqual(snap.spawns, extras.spawns, 'the block survives the envelope');
  assert.deepEqual(snap.quickslots, { left: 3 }, 'QS1: so does the quickslot diamond, which used to be dropped in silence');
  const M = createSpawnLedger();
  restoreSessionState(snap, { spawnLedger: M });
  assert.deepEqual(M.toJSON(), L.toJSON(), 'both clocks come back where they were');
  M.load([['x', 1]]);
  restoreSessionState({}, { spawnLedger: M });
  assert.equal(M.size, 0, 'a pre-TTL1 save loads an empty ledger - every spawn simply starts its seven days over');
  assert.doesNotThrow(() => restoreSessionState({}, {}), 'no ledger passed: the same no-op every other block takes');
});

test('TTL1 by source: both hosts carry the ledger, so a save made underground keeps the clocks', async () => {
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const d = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  const m = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(w, /composeSessionState\(\{ questBridge, talk: \{[^}]*\}, spawnLedger: _spawnLedger \}\)/);
  assert.match(w, /restoreSessionState\(extras, \{[^\n]*spawnLedger: _spawnLedger \}\)/);
  assert.match(w, /spawnLedger: \(\) => _spawnLedger,/, 'the mode machine\'s dungeon saves through the SAME ledger object, not a copy');
  assert.match(d, /composeSessionState\(\{ questBridge: opts\.questBridge, talk: opts\.talkSave, spawnLedger: opts\.spawnLedger\?\.\(\) \?\? null \}\)/);
  assert.match(d, /restoreSessionState\(extras, \{[^\n]*spawnLedger: opts\.spawnLedger\?\.\(\) \?\? null \}\)/);
  assert.match(m, /spawnLedger: \(\) => host\.spawnLedger\?\.\(\) \?\? null,/);
});
