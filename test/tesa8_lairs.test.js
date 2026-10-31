// TESA8 (2026-10-12, the owner: "Populating the world with its own dungeons"; bible/03-World/Arena-Provinces.md TESA8) -
// THE LAIRS PAST THE BAY, pinned. One dungeon an 8 x 8 cell at most, on the cell's one site, at the Bay's own rate (world/
// tamrielDungeons.js); a plan of its own laid of its dungeon type's blocks; a name of its type's frame; its own id (the
// cell's index in the lairs' lane), index and automap; the world host asks it after Arena and the countryside.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LAIR_SALT, LAIR_TYPES, LAIR_CELL, LAIR_COLS, LAIR_ROWS, LAIR_INDEX_BASE, lairCellOf, lairSite, lairPlaceId, lairLocationIndex,
  lairTemplates, lairPools, lairPick, lairLayout, LAIR_NAME_FRAMES, KEEP_FRAMES, lairName, lairNameSeed, synthesizeLairLocation,
  lairStandsAt, lairBlockCount,
} from '../src/world/tamrielDungeons.js';
import { COUNTRY_GRID, LAIR_LANE, COUNTRY_LANE, COUNTRY_LANES, isCountryPlaceId, countryPlaceId, countryOrdinal, COUNTRY_INDEX_BASE, countryRates } from '../src/world/tamrielCountry.js';
import { hash32, spawnTemplates } from '../src/world/spawnedDungeons.js';
import { automapKeyOf, automapDungeonKey } from '../src/systems/automap/automap.js';
import { LOCATION_TYPES, DUNGEON_TYPES, mapPixelToLongitudeLatitude } from '../src/formats/mapsFile.js';
import { BANK_TYPES, monsterName } from '../src/characters/nameHelper.js';
import { srand, rand, getSeed } from '../src/formats/dfRandom.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = LOCATION_TYPES, D = DUNGEON_TYPES;

// ── THE CELL AND THE ID ─────────────────────────────────────────

test('TESA8 the cell: 8 x 8 pixels of the countryside\'s grid, 2^19 of them; one site a cell inside it off the cell\'s hash; the id the cell\'s index in the lairs\' one lane with 0x80000 - one a cell, its low 20 unique, never a country place\'s; the index past the countryside\'s', () => {
  assert.equal(LAIR_CELL, 8);
  assert.equal(LAIR_COLS * LAIR_ROWS, 1 << 19, 'nineteen bits');
  assert.equal(LAIR_LANE, COUNTRY_LANE + COUNTRY_LANES);
  assert.equal(lairCellOf(-COUNTRY_GRID.x0, -COUNTRY_GRID.y0), 0);
  assert.equal(lairCellOf(-COUNTRY_GRID.x0 + 7, -COUNTRY_GRID.y0 + 7), 0, 'the same cell to its last pixel');
  assert.equal(lairCellOf(-COUNTRY_GRID.x0 + 8, -COUNTRY_GRID.y0), 1, 'the next cell east');
  assert.equal(lairCellOf(-COUNTRY_GRID.x0, -COUNTRY_GRID.y0 + 8), LAIR_COLS, 'the next row');
  for (const [x, y] of [[-COUNTRY_GRID.x0 - 1, 0], [0, -COUNTRY_GRID.y0 - 1], [LAIR_COLS * 8 - COUNTRY_GRID.x0, 0], [0, LAIR_ROWS * 8 - COUNTRY_GRID.y0], [0.5, 0]]) assert.equal(lairCellOf(x, y), -1, `${x},${y}`);
  const lows = new Set();
  for (const c of [0, 1, LAIR_COLS, 12345, (1 << 19) - 1, lairCellOf(2179, -359), lairCellOf(2189, -371)]) {
    const s = lairSite(c);
    assert.equal(lairCellOf(s.px, s.py), c, `cell ${c}'s site is inside it`);
    const cx = c % LAIR_COLS, cy = Math.floor(c / LAIR_COLS), h = hash32(LAIR_SALT, cx, cy, 1);
    assert.deepEqual(s, { px: cx * 8 + (h % 8) - COUNTRY_GRID.x0, py: cy * 8 + ((h >>> 3) % 8) - COUNTRY_GRID.y0 });
    const id = lairPlaceId(c);
    assert.equal(id >>> 20, LAIR_LANE);
    assert.equal(id & 0xfffff, 0x80000 | c, 'its low 20 the cell');
    assert.ok((id & 0xfffff) >= 500000, 'past every Bay pixel id');
    assert.ok(isCountryPlaceId(id), 'a place the countryside made');   // BAY-LEFT-B: its deed (were a house in one) held to its own map id, banking.js deedHeldIn
    assert.equal(lairLocationIndex(c), -(LAIR_INDEX_BASE + c));
    assert.ok(lairLocationIndex(c) < -(COUNTRY_INDEX_BASE + (1 << 25)), 'past the countryside\'s indices');
    lows.add(id & 0xfffff);
  }
  assert.equal(lows.size, 7, 'a dungeon\'s identity (MapId & 0xfffff) one a cell');
  assert.ok(new Set([0, 9, 2 ** 24].map((n) => countryPlaceId(n) >>> 20)).size >= 1 && ![0, 9, 2 ** 24, 2 ** 25 - 1].some((n) => (countryPlaceId(n) >>> 20) === LAIR_LANE), 'no country place in the lairs\' lane');
  assert.equal(isCountryPlaceId((LAIR_LANE + 2) << 20 | 0x80000), false);   // PIN MOVED (TESA10): the capitals' lane, the next, a place the port made too
  assert.ok(countryOrdinal(2179, -359) >= 0);
});

// ── THE TEMPLATES, THE POOLS ────────────────────────────────────

const blk = (name, x, z, start = false) => ({ blockName: name, x, z, isStartingBlock: start, blockIndex: 4, blockNumber: 1 });
const dun = (mapId, type, dungeonType, blocks, o = {}) => ({ name: `D${mapId}`, hasDungeon: true, mapTableData: { mapId, locationType: type, dungeonType, longitude: 0, latitude: 0 },
  exterior: { exteriorData: { width: 1, height: 1 } }, dungeon: { header: { blockCount: blocks.length }, recordElement: { header: { locationId: mapId } }, blocks }, ...o });

test('TESA8 the templates: a list a kind (labyrinth, keep, ruin, graveyard) in map-id order - an exterior and a dungeon with an interior block; never a main-story place, a spawn\'s, an isle\'s, an Arena place\'s or one the countryside made', () => {
  assert.deepEqual(LAIR_TYPES, [T.DungeonLabyrinth, T.DungeonKeep, T.DungeonRuin, T.Graveyard]);
  const ok = [blk('N1.RDB', 0, 0, true), blk('B1.RDB', 0, -1)];
  const rows = [dun(9, T.DungeonKeep, 2, ok), dun(3, T.DungeonKeep, 2, ok), dun(4, T.DungeonKeep, 2, [blk('B1.RDB', 0, 0)]), dun(5, T.DungeonKeep, 2, ok, { exterior: {} }),
    dun(6, T.DungeonKeep, 2, ok, { spawned: true }), dun(7, T.DungeonKeep, 2, ok, { ether: {} }), dun(8, T.DungeonKeep, 2, ok, { arena: {} }), dun(10, T.DungeonKeep, 2, ok, { country: {} }),
    dun(11, T.DungeonKeep, 2, ok), dun(12, T.DungeonKeep, 2, ok, { hasDungeon: false }), dun(13, T.TownCity, 2, ok), dun(14, T.Graveyard, 18, ok)];
  const t = lairTemplates(rows, (id) => id === 11);
  assert.deepEqual([...t.keys()], LAIR_TYPES);
  assert.deepEqual(t.get(T.DungeonKeep).map((l) => l.mapTableData.mapId), [3, 9]);
  assert.deepEqual(t.get(T.Graveyard).map((l) => l.mapTableData.mapId), [14]);
  assert.equal(t.get(T.DungeonLabyrinth).length, 0);
});

test('TESA8 the pools: each dungeon type\'s interior blocks, the ones a dungeon starts in (laid as interior too), its border blocks - each once, as first met in map-id order', () => {
  const t = new Map([[T.DungeonKeep, [dun(20, T.DungeonKeep, 5, [blk('N2.RDB', 0, 0, true), blk('N3.RDB', 1, 0), blk('B1.RDB', 0, 1), blk('B2.RDB', 1, 1), blk('N3.RDB', 2, 0)])]],
    [T.DungeonLabyrinth, [dun(10, T.DungeonLabyrinth, 5, [blk('N1.RDB', 0, 0), blk('N2.RDB', 1, 0), blk('N1.RDB', 2, 0, true), blk('B2.RDB', 0, 1), blk('b1.RDB', 1, 1)]), dun(30, T.DungeonLabyrinth, 0, [blk('C1.RDB', 0, 0, true), blk('B1.RDB', 0, 1)])]]]);
  const p = lairPools(t);
  assert.deepEqual([...p.keys()].sort(), [0, 5]);
  const five = p.get(5);
  assert.deepEqual(five.interior.map((b) => b.blockName), ['N1.RDB', 'N2.RDB', 'N3.RDB'], 'map-id order, once each');
  assert.deepEqual(five.start.map((b) => b.blockName), ['N1.RDB', 'N2.RDB']);
  assert.deepEqual(five.border.map((b) => b.blockName), ['B2.RDB', 'b1.RDB', 'B1.RDB'], 'a border block by its B, either case');
  assert.deepEqual(p.get(0).interior.map((b) => b.blockName), ['C1.RDB'], 'a block that only starts is an interior block too');
  assert.equal('seen' in five, false);
});

// ── THE PICK ────────────────────────────────────────────────────

test('TESA8 the pick: the cell\'s chance its site\'s climate\'s rate times 64, at most 1, the kind in proportion, the template off the cell\'s hash; none past the chance, for no climate, off the grid or a kind with no template - and the rates stand', () => {
  const templates = new Map(LAIR_TYPES.map((t) => [t, [dun(100 + t, t, 2, []), dun(200 + t, t, 2, [])]]));
  templates.set(T.Graveyard, []);
  const counts = new Map([[230, new Map([[T.DungeonLabyrinth, 4], [T.DungeonKeep, 2], [T.Graveyard, 2]])], [226, new Map([[T.DungeonKeep, 50]])]]);
  const rates = countryRates(counts, new Map([[230, 1000], [226, 1000]]), LAIR_TYPES);
  assert.deepEqual(rates.get(230).map(([t]) => t), [T.DungeonLabyrinth, T.DungeonKeep, T.Graveyard]);
  let n = 0, lab = 0, keep = 0, grave = 0;
  for (let c = 1000; c < 21000; c++) {
    const cx = c % LAIR_COLS, cy = Math.floor(c / LAIR_COLS), r = hash32(LAIR_SALT, cx, cy, 2) / 4294967296;
    const p = lairPick(rates, templates, 230, c);
    n++;
    const chance = 0.008 * 64;
    if (r >= chance) { assert.equal(p, null); continue; }
    const t = (r / chance) * 0.008;
    if (t < 0.004) { assert.equal(p.type, T.DungeonLabyrinth); lab++; } else if (t < 0.006) { assert.equal(p.type, T.DungeonKeep); keep++; } else { assert.equal(p, null, 'no graveyard template'); grave++; }
    if (p) assert.equal(p.template, templates.get(p.type)[hash32(LAIR_SALT, cx, cy, 3) % 2]);
  }
  assert.ok(Math.abs(lab / n - 0.256) < 0.02 && Math.abs(keep / n - 0.128) < 0.015 && Math.abs(grave / n - 0.128) < 0.015, `${lab} ${keep} ${grave} of ${n}`);
  let all = 0;
  for (let c = 0; c < 2000; c++) if (lairPick(rates, templates, 226, c)) all++;
  assert.equal(all, 2000, 'a chance past 1 is 1: every cell stands one');
  const mixed = countryRates(new Map([[230, new Map([[T.DungeonLabyrinth, 10], [T.DungeonKeep, 40]])]]), new Map([[230, 1000]]), LAIR_TYPES);
  let labs = 0;
  for (let c = 0; c < 4000; c++) if (lairPick(mixed, templates, 230, c).type === T.DungeonLabyrinth) labs++;
  assert.ok(Math.abs(labs / 4000 - 0.2) < 0.03, `a capped cell keeps the mix: ${labs} labyrinths of 4000`);
  assert.equal(lairPick(rates, templates, 231, 5), null);
  assert.equal(lairPick(rates, templates, 230, -1), null);
  assert.equal(lairPick(null, templates, 230, 5), null);
});

// ── THE PLAN ────────────────────────────────────────────────────

const pool = (n, starts = 3, borders = 4) => ({ interior: Array.from({ length: n }, (_, i) => blk(`N${i}.RDB`, 9, 9, i % 2 === 0)), start: Array.from({ length: starts }, (_, i) => blk(`S${i}.RDB`, 9, 9, true)), border: Array.from({ length: borders }, (_, i) => blk(`B${i}.RDB`, 9, 9)) });
const SIDE = [[0, -1], [-1, 0], [1, 0], [0, 1]];

test('TESA8 the plan: its count of interior blocks grown into one shape from the starting block at (0, 0), a block laid once while the pool allows, every open side closed by one border block - the same plan for the same seed, the global stream untouched; none without a pool or a count', () => {
  srand(777);
  const before = getSeed();
  const shapes = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    for (const count of [1, 2, 4, 9]) {
      const plan = lairLayout(pool(12), count, seed);
      const inner = plan.filter((b) => !b.blockName.startsWith('B')), border = plan.filter((b) => b.blockName.startsWith('B'));
      assert.equal(inner.length, count);
      assert.deepEqual([inner[0].x, inner[0].z, inner[0].isStartingBlock], [0, 0, true], 'the first the start, at the origin');
      assert.ok(inner[0].blockName.startsWith('S'), 'from the starting pool');
      assert.equal(plan.filter((b) => b.isStartingBlock).length, 1, 'one start');
      assert.ok(inner.slice(1).every((b) => b.blockName.startsWith('N')), 'the rest from the interior pool');
      assert.equal(new Set(inner.slice(1).map((b) => b.blockName)).size, count - 1, 'none laid twice');
      const at = new Set(plan.map((b) => `${b.x},${b.z}`));
      assert.equal(at.size, plan.length, 'one block a square');
      const cells = new Set(inner.map((b) => `${b.x},${b.z}`));
      const reach = new Set(['0,0']), todo = [[0, 0]];
      while (todo.length) { const [x, z] = todo.pop(); for (const [dx, dz] of SIDE) { const k = `${x + dx},${z + dz}`; if (cells.has(k) && !reach.has(k)) { reach.add(k); todo.push([x + dx, z + dz]); } } }
      assert.equal(reach.size, count, 'one connected shape');
      const open = new Set();
      for (const b of inner) for (const [dx, dz] of SIDE) { const k = `${b.x + dx},${b.z + dz}`; if (!cells.has(k)) open.add(k); }
      assert.deepEqual(new Set(border.map((b) => `${b.x},${b.z}`)), open, 'every open side closed, nothing else');
      assert.ok(plan.every((b) => b.blockIndex === 4 && b.blockNumber === 1), 'each the pool\'s block, re-addressed');
      assert.deepEqual(lairLayout(pool(12), count, seed), plan, 'the same seed, the same plan');
      if (count === 9) shapes.add([...cells].sort().join(' '));
    }
  }
  assert.ok(shapes.size > 40, `plans of their own (${shapes.size} of 60)`);
  const branched = Array.from({ length: 60 }, (_, s) => lairLayout(pool(12), 9, s + 1).slice(0, 9)).some((inner) => inner.some((b, i) => i > 0 && Math.abs(b.x - inner[i - 1].x) + Math.abs(b.z - inner[i - 1].z) !== 1));
  assert.ok(branched, 'a plan grows from any laid block, not a snake from the last');
  assert.equal(getSeed(), before, 'the stream put back');
  const tight = lairLayout(pool(1), 4, 3).filter((b) => b.blockName.startsWith('N'));
  assert.deepEqual(tight.map((b) => b.blockName), ['N0.RDB', 'N0.RDB', 'N0.RDB'], 'a pool of one lays it again');
  for (const bad of [undefined, pool(0), pool(3, 0), pool(3, 2, 0)]) assert.equal(lairLayout(bad, 3, 1), null);
  assert.equal(lairLayout(pool(3), 0, 1), null);
});

// ── THE NAME ────────────────────────────────────────────────────

test('TESA8 the name: a labyrinth or a graveyard its dungeon type\'s frame, a keep a castle\'s, a ruin "Ruins of" a country place or a keep - the province\'s stems or the frame\'s monster bank, the same seed the same name, the stream put back', () => {
  srand(4242);
  const before = getSeed();
  const fit = (frame, name) => new RegExp(`^${frame.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%[swm]/g, '.+')}$`).test(name);
  for (const [dt, [, frames]] of Object.entries(LAIR_NAME_FRAMES)) {
    for (let s = 0; s < 12; s++) {
      const name = lairName(T.DungeonLabyrinth, Number(dt), BANK_TYPES.Nord, s);
      assert.ok(name && frames.some((f) => fit(f, name)), `${dt}: ${name}`);
      assert.equal(lairName(T.DungeonLabyrinth, Number(dt), BANK_TYPES.Nord, s), name);
    }
  }
  assert.equal(Object.keys(LAIR_NAME_FRAMES).length, 19, 'every dungeon type');
  assert.ok(Array.from({ length: 20 }, (_, s) => lairName(T.DungeonLabyrinth, D.OrcStronghold, BANK_TYPES.Breton, s)).every((n) => /^[A-Z][a-z']+$/.test(n)), 'an orc hold its one name');
  for (let s = 1; s < 8; s++) {
    const want = (srand(s), rand(), monsterName(rand() & 1 ? 1 : 0, Math.random, BANK_TYPES.Monster1));
    srand(4242);
    assert.equal(lairName(T.DungeonLabyrinth, D.OrcStronghold, BANK_TYPES.Breton, s), want, 'Monster1\'s own name, never a person\'s');
  }
  srand(4242);
  for (let s = 0; s < 30; s++) {
    const keep = lairName(T.DungeonKeep, D.Crypt, BANK_TYPES.Redguard, s);
    assert.ok(KEEP_FRAMES.some((f) => fit(f, keep)), `a keep is a castle whatever its type: ${keep}`);
    const ruin = lairName(T.DungeonRuin, D.SpiderNest, BANK_TYPES.Khajiit, s);
    assert.ok(ruin.startsWith('Ruins of ') && ruin.length > 12 && !/%/.test(ruin), ruin);
    assert.ok(lairName(T.Graveyard, D.Cemetery, BANK_TYPES.DarkElf, s).length > 4);
  }
  assert.equal(new Set(Array.from({ length: 40 }, (_, s) => lairName(T.DungeonLabyrinth, D.Crypt, BANK_TYPES.Breton, s))).size > 30, true, 'they vary');
  assert.equal(lairName(T.DungeonLabyrinth, 99, BANK_TYPES.Breton, 1), '');
  assert.equal(getSeed(), before);
  assert.equal(lairNameSeed(77), hash32(LAIR_SALT, 77 % LAIR_COLS, Math.floor(77 / LAIR_COLS), 4));
});

// ── THE CLONE ───────────────────────────────────────────────────

test('TESA8 the clone: the template untouched; its own id in the row, the exterior, both records\' headers; the pixel\'s longitude and latitude; its name, the host\'s region, its own index, no harbour; its own plan and the header\'s count; `country` with its cell and `dungeon`', () => {
  const template = dun(4242, T.DungeonKeep, 2, [blk('N1.RDB', 0, 0, true), blk('B1.RDB', 0, -1)], { regionIndex: 17, regionName: 'Daggerfall', politic: 145, climate: { worldClimate: 230 } });
  template.exterior = { buildings: [], exteriorData: { mapId: 4242, locationId: 4242, portTownAndUnknown: 1, blockNames: ['CASTAA01.RMB'] }, recordElement: { header: { locationId: 4242 } } };
  const snap = JSON.stringify(template);
  const c = lairCellOf(2179, -359);
  const blocks = lairLayout(pool(5), 3, lairPlaceId(c));
  const loc = synthesizeLairLocation(template, { c, px: 2179, py: -359, type: T.DungeonKeep, name: "Ulrik's Hold", blocks }, { regionIndex: 23, regionName: 'Wrothgarian Mountains', politic: 151, climate: { worldClimate: 226 } });
  assert.equal(JSON.stringify(template), snap, 'non-mutating');
  const id = lairPlaceId(c), ll = mapPixelToLongitudeLatitude(2179, -359);
  assert.equal(loc.name, "Ulrik's Hold");
  assert.deepEqual([loc.mapTableData.mapId, loc.mapTableData.longitude, loc.mapTableData.latitude, loc.mapTableData.dungeonType, loc.mapTableData.locationType], [id, ll.x, ll.y, 2, T.DungeonKeep]);
  assert.deepEqual([loc.exterior.exteriorData.mapId, loc.exterior.exteriorData.locationId, loc.exterior.recordElement.header.locationId, loc.dungeon.recordElement.header.locationId], [id, id, id, id]);
  assert.equal(loc.exterior.exteriorData.portTownAndUnknown, 0);
  assert.equal(loc.exterior.exteriorData.blockNames, template.exterior.exteriorData.blockNames, 'the entrance\'s ground the template\'s');
  assert.equal(loc.dungeon.blocks, blocks, 'its own plan');
  assert.equal(loc.dungeon.header.blockCount, blocks.length);
  assert.equal(loc.locationIndex, lairLocationIndex(c));
  assert.deepEqual([loc.regionIndex, loc.regionName, loc.politic, loc.climate.worldClimate], [23, 'Wrothgarian Mountains', 151, 226]);
  assert.deepEqual(loc.country, { px: 2179, py: -359, type: T.DungeonKeep, template: 4242, cell: c, dungeon: true });
  assert.ok(Object.isFrozen(loc.country));
  const bare = synthesizeLairLocation({ ...template, exterior: { exteriorData: {} }, dungeon: { blocks: [] } }, { c, px: 2179, py: -359, type: T.DungeonKeep, name: 'X', blocks });
  assert.equal(bare.exterior.recordElement, undefined);
  assert.equal(bare.dungeon.header, undefined, 'no header where the template has none');
  assert.equal(bare.regionIndex, 17);
});

test('TESA8 never cloned again and its own map: no spawn clones a lair (spawnTemplates), and its automap is its own - DFU\'s (region, name) for the game\'s places, a lair\'s with its map id after it', () => {
  const real = dun(77, T.DungeonRuin, 2, [blk('N1.RDB', 0, 0, true)]), lair = { ...dun(78, T.DungeonRuin, 2, [blk('N1.RDB', 0, 0, true)]), country: { dungeon: true } };
  real.exterior.exteriorData = lair.exterior.exteriorData = { width: 1, height: 1 };
  assert.deepEqual(spawnTemplates([real, lair]).map((l) => l.mapTableData.mapId), [77]);
  const bay = { regionIndex: 17, name: 'Castle Necromoghan', mapTableData: { mapId: 5 } };
  assert.equal(automapKeyOf(bay), automapDungeonKey(17, 'Castle Necromoghan'), 'the game\'s own, DFU\'s key');
  const a = { regionIndex: 22, name: "Ulrik's Hold", mapTableData: { mapId: lairPlaceId(5) }, country: { dungeon: true } };
  const b = { ...a, mapTableData: { mapId: lairPlaceId(6) } };
  assert.equal(automapKeyOf(a), `${automapDungeonKey(22, "Ulrik's Hold")}#${lairPlaceId(5)}`);
  assert.notEqual(automapKeyOf(a), automapKeyOf(b), 'two lairs of one name, two maps');
  assert.equal(automapKeyOf(bay, 'dungeon:5'), automapDungeonKey(17, 'dungeon:5'), 'the name the caller gives');
  assert.equal(automapKeyOf(null), automapDungeonKey(-1, ''));
  assert.match(read('src/scenes/dungeonContext.js'), /const automapKey = automapKeyOf\(dfLocation, dfLocation\?\.name \?\? _locationKey\);/);
  assert.match(read('src/scenes/worldModes.js'), /automapKeyOf\(hit\.dfLocation\)\)\?\.entranceDiscovered,/);
});

// ── THE HOST ────────────────────────────────────────────────────

const W = hostText('src/scenes/world.js');
const lift = (head) => { const i = W.indexOf(head); assert.ok(i > 0, head); return W.slice(i, W.indexOf('\n  }\n', i) + 4); };

test('TESA8 the host by source: the lairs\' templates, count and pools off the game\'s rows before they go, under the countryside\'s door; their rates over the same Bay land; past the Bay Arena\'s place, else the country\'s, else the lair\'s', () => {
  assert.match(W, /const _lairTemplates = _countryTemplates \? lairTemplates\(_classicRows \?\? _hubRows\.map\(classicRow\)\.filter\(Boolean\), isMainStoryDungeon\) : null;/);
  assert.match(W, /const _lairCounts = _lairTemplates \? countryCounts\(_lairTemplates, \(x, y\) => filedClimate\(x, y, maps\.getClimateIndex\(x, y\)\)\) : null;/);   // PIN MOVED (AUDIT FOUNDATION II L1): the Bay's count off the files as they came
  assert.match(W, /const _lairPools = _lairTemplates \? lairPools\(_lairTemplates\) : null;/);
  assert.ok(W.indexOf('const _lairPools = ') < W.indexOf('  _classicRows = null;   // read, let go'));
  assert.match(W, /const bayLandNow = \(\) => \(_pastBay\.bayLand \?\?= bayLand\(/);
  assert.match(W, /const countryRatesNow = \(\) => \(_pastBay\.countryRates \?\?= countryRates\(_countryCounts, bayLandNow\(\)\)\);/);
  assert.match(W, /const lairRatesNow = \(\) => \(_pastBay\.lairRates \?\?= countryRates\(_lairCounts, bayLandNow\(\), LAIR_TYPES\)\);/);
  // PIN MOVED (WG2-TOWNS): a World 2.0 town asked first past the Bay, before a capital (scenes/settle2Host.js)
  assert.match(W, /return \(locationIndex\.get\(`\$\{px\},\$\{py\}`\)\?\.superTier \? locationIndex\.get\(`\$\{px\},\$\{py\}`\) : null\) \|\| \(params\.has\('online'\) && zoneHalls\.standIn\(cyrodiilMask\(\), px, py\)\) \|\| settle2LocationAt\(px, py\) \|\| host\.capitalLocationAt\(px, py\) \|\| \(_arenaTemplates && host\.arenaLocationAt\(px, py\)\) \|\| host\.countryLocationAt\(px, py\) \|\| host\.lairLocationAt\(px, py\) \|\| spawnPastBayAt\(px, py\);/);   // PIN MOVED (TESA10): a capital first; PIN MOVED (AUDIT TESA II P1): the open zone's hall before them   // PIN MOVED (HOST-SPLIT, SPAWN-WORLD 2026-10-26): _locationToBuild is scenes/spawnStandHost.js's, the places' rolls through `host`   // PIN MOVED (SPAWN-WORLD 2026-10-26): online, the spawner's last - never on a place   // PIN MOVED (WW5, bible/03-World/World-Wide.md WW5): a province's Hollow first, as its lane stands it in the index (scenes/superDungeon/sdLanes.js) - carried into scenes/spawnStandHost.js at the packages' merge (AUDIT BAY-LEFT)
  assert.match(W, /if \(had\?\.country && !had\.country\.dungeon\) \{/, 'the countryside leaves a lair to its own');
});

/** lairLocationAt as the host has it, over stubs - the real pick, plan, name and clone. */
function host({ roads = new Set(), water = new Set() } = {}) {
  const ok = [blk('N1.RDB', 0, 0, true), blk('N2.RDB', 1, 0), blk('B1.RDB', 0, -1)];
  const templates = new Map(LAIR_TYPES.map((t) => [t, [dun(1000 + t, t, 2, ok)]]));
  const d = { index: new Map(), climate: () => 230 };
  const make = new Function('d', 'lairStandsAt', 'lairBlockCount', 'lairName', 'lairNameSeed', 'lairLayout', 'lairPlaceId', 'synthesizeLairLocation', 'templates', 'pools', 'roads', 'water', `
    const _lairTemplates = templates, _lairPools = pools, locationIndex = d.index;
    const lairRatesNow = () => new Map([[230, [[${T.DungeonLabyrinth}, 0.5], [${T.DungeonKeep}, 1]]]]);
    const maps = { getClimateIndex: (x, y) => d.climate(x, y), getRegionIndexAt: () => 23 };
    const woods = { getHeightMapValue: (x, y) => (water.has(x + ',' + y) ? 0 : 40) };
    const _countryGround = () => true;
    // TESA14: the world the roll reads, as the host hands it - no road among it
    const _pastBayAt = { climateAt: (x, y) => maps.getClimateIndex(x, y), heightAt: (x, y) => woods.getHeightMapValue(x, y), ground: (x, y) => _countryGround(x, y) };
    const _pastBay = { lairRoll: null };   // PIN MOVED (HOST-SPLIT, at the merge of main): the place law is scenes/tamrielPlacesHost.js's, its live names through host
    const provinceKeyBeyondBay = () => 'skyrim', provinceNameBank = () => d.bank ?? 2, getNameBankOfRegion = () => 0;   // AUDIT TESA II K5: the province's bank the test's to move
    const REGION_NAMES = { 23: 'Wrothgarian Mountains' }, getWorldClimateSettings = (c) => ({ worldClimate: c });
    const host = { _locIndexGen: 0 };
    ${lift('  function lairRollAt(px, py) {')}
    ${W.slice(W.indexOf('  const lairBlocksOf = '), W.indexOf('\n', W.indexOf('  const lairBlocksOf = ')))}
    ${lift('  function lairLocationAt(px, py) {')}
    ${lift('  function lairCloneOf(at, px, py) {')}
    return { lairLocationAt, gen: () => host._locIndexGen };`);   // PIN MOVED (START2): the clone its own function - the start host weighs a candidate's dungeon before any stands   // PIN MOVED (TESA13): the roll and the plan their own functions, the map's read of them too
  return { d, ...make(d, lairStandsAt, lairBlockCount, lairName, lairNameSeed, lairLayout, lairPlaceId, synthesizeLairLocation, templates, lairPools(templates), roads, water) };
}

test('TESA8 the host\'s ask: a lair on its cell\'s site alone, stood once under its plan and its province\'s name; water none; a moved climate stands it again or none - TESA14: and a road takes no lair\'s pixel', () => {
  const c = lairCellOf(2179, -359), s = lairSite(c);
  const h = host();
  const loc = h.lairLocationAt(s.px, s.py);
  assert.ok(loc?.country?.dungeon, 'every cell stands one under a chance of 64');
  assert.equal(h.d.index.get(`${s.px},${s.py}`), loc);
  assert.equal(loc.mapTableData.mapId, lairPlaceId(c));
  assert.equal(loc.name, lairName(loc.country.type, 2, BANK_TYPES.Nord, lairNameSeed(c)), 'its province\'s people');
  assert.equal(loc.dungeon.blocks.filter((b) => !b.blockName.startsWith('B')).length, 2, 'as many interior blocks as its template');
  assert.deepEqual([loc.regionName, loc.politic], ['Wrothgarian Mountains', 151]);
  assert.equal(h.lairLocationAt(s.px, s.py), loc, 'once');
  assert.equal(h.gen(), 1);
  // AUDIT TESA II K5 (lane K's survivor): the roll renamed under it - its province's people another (the trace landing moves
  // a border) - stands it again under its new name, never the stale one; the same kind, cell and template
  h.d.bank = BANK_TYPES.Khajiit;
  const renamed = h.lairLocationAt(s.px, s.py);
  assert.notEqual(renamed, loc, 'stood again');
  assert.equal(renamed.name, lairName(loc.country.type, 2, BANK_TYPES.Khajiit, lairNameSeed(c)));
  assert.notEqual(renamed.name, loc.name);
  assert.equal(h.d.index.get(`${s.px},${s.py}`), renamed);
  delete h.d.bank;
  h.lairLocationAt(s.px, s.py);
  const other = s.px === lairSite(c).px && lairCellOf(s.px + 1, s.py) === c ? [s.px + 1, s.py] : [s.px - 1, s.py];
  assert.equal(h.lairLocationAt(...other), null, 'any other pixel of the cell none');
  h.d.climate = () => 231;
  assert.equal(h.lairLocationAt(s.px, s.py), null, 'a climate with no lairs: none');
  assert.equal(h.d.index.has(`${s.px},${s.py}`), false, 'out of the index');
  assert.equal(host({ water: new Set([`${s.px},${s.py}`]) }).lairLocationAt(s.px, s.py), null, 'water');
  // PIN MOVED (TESA14): the roads are laid round a lair (world/tamrielRoads.js: a dungeon is no node, a route goes round it)
  assert.doesNotMatch(lift('  function lairRollAt(px, py) {'), /arenaPathsAt/, 'the roll reads no road');
  assert.ok(host({ roads: new Set([`${s.px},${s.py}`]) }).lairLocationAt(s.px, s.py), 'its pixel its own all the same');
});
