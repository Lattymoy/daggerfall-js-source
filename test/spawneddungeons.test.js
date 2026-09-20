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
  assert.match(fn, /locationIndex\.set\(`\$\{px\},\$\{py\}`, loc\)/, 'stood in the index every reader already asks');
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
