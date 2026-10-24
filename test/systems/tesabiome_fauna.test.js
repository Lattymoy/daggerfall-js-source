// TESA-BIOME (2026-10-24, bible/03-World/Tamriel-Biomes.md) - the fauna past the Bay: each biome's three encounter
// tables, made from its lore roster, on DFU's encounter-table door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ROSTERS, TOWN_ROSTERS, DEX_LEVELS, RARITY, SLOTS, SLOT_REACH, CLASS_FROM, BIOME_TABLE_BASE, BIOME_BANDS, FAUNA_SELECTOR,
  faunaTable, faunaLevel, rosterFor, biomeTable, faunaBandAt, installTamrielFauna, isDexId,
} from '../../src/systems/tamrielFauna.js';
import { BIOMES } from '../../src/world/tamriel/tamrielBiomes.js';
import { PROVINCES, CITIES } from '../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay } from '../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { ENEMY_BASICS, isClassEnemyId } from '../../src/characters/enemy/enemyBasics.js';
import { ENCOUNTER_TABLES } from '../../src/characters/encounterTables.js';
import { encounterTable, encounterTableChoices, _resetEncounterTableSelectors, hasEncounterTableSelector, encounterTableGeneration } from '../../src/characters/encounterTableDoor.js';
import { resolveEncounterTableIndex, chooseRandomEnemy } from '../../src/systems/encounters.js';
import { grantSpecies, grantSpeciesOf, createGrantHost } from '../../src/scenes/grantHost.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const csv = (p) => read(p).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split(','));
const DEX_MONSTERS = new Map(csv('vendor/daggerfall-enemy-expansion/MonsterBase.mdb.csv').slice(1).map((r) => [Number(r[0]), { name: r[1], level: Number(r[3]) }]));
const DEX_CLASSES = new Map(csv('vendor/daggerfall-enemy-expansion/ClassBase.mdb.csv').slice(1).map((r) => [Number(r[0]), { name: r[1] }]));
const isClassic = (id) => (id >= 0 && id <= 42) || (id >= 128 && id <= 145);
const allEntries = () => [...Object.values(ROSTERS).flatMap((r) => [...r.day, ...r.night]), ...Object.values(TOWN_ROSTERS).flat()];
const pixelOf = (name) => pictureToBay(...CITIES.find((c) => c.name === name).at).map(Math.floor);
const tablesOf = (key, dex) => BIOME_BANDS.get(key).map((i) => biomeTable(i, dex));

test('TESA-BIOME fauna: every biome a roster by day and by night, every province a town - every creature one the game can stand', () => {
  assert.deepEqual(Object.keys(ROSTERS).sort(), BIOMES.map((b) => b.key).sort());
  assert.deepEqual(Object.keys(TOWN_ROSTERS).sort(), PROVINCES.map((p) => p.key).sort());
  for (const [id, r] of allEntries()) {
    assert.ok(Object.hasOwn(RARITY, r), `${id}: a rarity`);
    if (isClassic(id)) assert.ok(isClassEnemyId(id) || ENEMY_BASICS[id], `${id}: DFU's`);
    else assert.ok(DEX_MONSTERS.has(id) || DEX_CLASSES.has(id), `${id}: Daggerfall Enemy Expansion's`);
    assert.notEqual(id, 34, 'no dragon: they are gone in this era');
    assert.notEqual(id, 39, 'no horse: not a foe');
  }
});

test('TESA-BIOME fauna: DEX_LEVELS are the vendored MonsterBase.mdb.csv\'s levels', () => {
  for (const [id, lv] of Object.entries(DEX_LEVELS)) assert.equal(DEX_MONSTERS.get(Number(id))?.level, lv, `${id} ${DEX_MONSTERS.get(Number(id))?.name}`);
  for (const [id] of allEntries()) if (isDexId(id) && !isClassEnemyId(id)) assert.ok(Object.hasOwn(DEX_LEVELS, id), `${id}: its level held`);
});

test('TESA-BIOME fauna: a table is twenty slots in the order of their levels - each monster within SLOT_REACH of its slot, the people from CLASS_FROM, a V once', () => {
  assert.deepEqual([SLOTS, SLOT_REACH, CLASS_FROM, BIOME_TABLE_BASE], [20, 4, 3, 100]);
  assert.deepEqual(RARITY, { C: 4, U: 2, R: 1, V: 0.5 });
  for (const b of BIOMES) {
    for (const dex of [true, false]) {
      const [town, day, night] = tablesOf(b.key, dex);
      for (const [t, entries] of [[day, ROSTERS[b.key].day], [night, ROSTERS[b.key].night], [town, TOWN_ROSTERS[b.province]]]) {
        const roster = rosterFor(entries, dex);
        const ids = new Set(roster.map(([id]) => id));
        assert.equal(t.length, SLOTS);
        t.forEach((id, i) => {
          assert.ok(ids.has(id), `${b.key}: slot ${i}'s ${id} is its roster's`);
          const lv = faunaLevel(id);
          if (lv == null) assert.ok(i >= CLASS_FROM, `${b.key}: a person at slot ${i}`);
        });
        for (const [id, r] of roster) if (r === 'V') assert.ok(t.filter((x) => x === id).length <= 1, `${b.key}: ${id} once at most`);
        if (!dex) assert.ok(t.every((id) => !isDexId(id)), `${b.key}: the classic table stands no DEX creature`);
      }
    }
  }
});

test('TESA-BIOME fauna: the classic roster - a DEX creature as its stand-in, the one creature at the commonest rarity it is named with', () => {
  assert.deepEqual(rosterFor([[262, 'C'], [5, 'R']], false), [[5, 'C']], 'the Wolf as the Sabertooth: common');
  assert.deepEqual(rosterFor([[5, 'R'], [262, 'C']], false), [[5, 'C']]);
  assert.deepEqual(rosterFor([[262, 'C'], [5, 'R']], true), [[262, 'C'], [5, 'R']], 'DEX loaded: each its own');
  assert.deepEqual(rosterFor([[258, 'C'], [0, 'U']], false), [[0, 'U']], 'Lizard Men: no fair stand-in, left out');
});

test('TESA-BIOME fauna: the slot law - a monster in reach is drawn nearer its level, and a slot no monster reaches takes the nearest', () => {
  const t = faunaTable([[0, 'C'], [32, 'C']], 'pin');   // a rat (1) and a lich (20): nothing between
  assert.equal(t[0], 0);
  assert.equal(t[19], 32);
  assert.equal(t[9], 0, 'slot 9 (level 10): neither in reach - the rat 9 levels off, the lich 10: the nearer, the rat');
  assert.equal(t[16], 32, 'slot 16 (level 17): the lich in reach');
  assert.equal(t[4], 0, 'slot 4 (level 5): the rat in reach');
});

test('TESA-BIOME fauna: the lore - Black Marsh and Vvardenfell are rid of High Rock\'s woods; Cyrodiil\'s wild is the Imp\'s and the Minotaur\'s; Skyrim\'s the wolf\'s and the troll\'s', () => {
  const all = (key, dex = true) => new Set(tablesOf(key, dex).flat());
  for (const key of ['blackMarshHist', 'blackMarshFens', 'blackMarshMurkmire']) {
    for (const id of [7, 8, 14, 12, 24]) assert.ok(!all(key).has(id), `${key} stands no ${id} (Orc, Centaur, Wereboar)`);
    assert.ok(all(key).has(258), `${key}: Arena's Lizard Men`);
  }
  for (const key of ['morrowindAshlands', 'morrowindBitterCoast']) for (const id of [4, 5, 7, 8, 13, 14, 16]) assert.ok(!all(key).has(id), `${key} stands no ${id}`);
  const nib = all('cyrodiilNibenay');
  for (const id of [1, 269, 280, 256]) assert.ok(nib.has(id), `the Nibenay: ${id}`);
  for (const id of [13, 20]) assert.ok(!nib.has(id), `the Nibenay: no ${id} (Harpy, Giant Scorpion)`);
  for (const key of ['skyrimTundra', 'skyrimPinewood']) assert.ok(all(key).has(262), `${key}: wolves`);
  assert.ok(all('skyrimPeaks').has(272) && all('skyrimPeaks').has(263), 'the peaks: trolls and snow wolves');
  assert.ok(all('hammerfellAlikr').has(20), 'the Alik\'r: its scorpions');
  // DFU's own Swamp/Woodlands family, for the record of what it replaces
  assert.ok(ENCOUNTER_TABLES[33].includes(16) && ENCOUNTER_TABLES[34].includes(14), 'DFU\'s woodlands stand giants and wereboars');
});

test('TESA-BIOME fauna: the band at a pixel - its biome\'s three past the Bay, none on the Bay or at sea; the law reads `fauna` before the climate', () => {
  setTamrielTrace(null);
  assert.equal(faunaBandAt(500, 250), null);
  assert.equal(faunaBandAt(...pictureToBay(10, 10).map(Math.floor)), null);
  const band = faunaBandAt(...pixelOf('Imperial City'));
  assert.deepEqual(band, BIOME_BANDS.get('cyrodiilNibenay'));
  const i = BIOMES.findIndex((b) => b.key === 'cyrodiilNibenay');
  assert.deepEqual(band, [BIOME_TABLE_BASE + 3 * i, BIOME_TABLE_BASE + 3 * i + 1, BIOME_TABLE_BASE + 3 * i + 2]);
  const ctx = { climateIndex: 231, isDay: true, inLocationRect: false };
  assert.equal(resolveEncounterTableIndex(ctx), 33, 'the climate\'s');
  assert.equal(resolveEncounterTableIndex({ ...ctx, fauna: band }), band[1], 'the wild by day');
  assert.equal(resolveEncounterTableIndex({ ...ctx, fauna: band, isDay: false }), band[2]);
  assert.equal(resolveEncounterTableIndex({ ...ctx, fauna: band, isDay: false, inLocationRect: true }), band[0]);
  assert.equal(resolveEncounterTableIndex({ ...ctx, fauna: band, inLocationRect: true }), null, 'a town by day rolls none');
});

test('TESA-BIOME fauna: the selector on the door answers the biome indices alone, one table a game; a roll draws from it', () => {
  _resetEncounterTableSelectors();
  try {
    assert.equal(encounterTable(BIOME_TABLE_BASE, { local: true }), null, 'without it, nothing');
    const g = encounterTableGeneration();
    installTamrielFauna();
    installTamrielFauna();
    assert.ok(hasEncounterTableSelector(FAUNA_SELECTOR));
    assert.equal(encounterTableGeneration(), g + 1, 'stood once');
    assert.equal(encounterTable(33, { local: true }), ENCOUNTER_TABLES[33], 'DFU\'s own untouched');
    const band = BIOME_BANDS.get('skyrimPeaks');
    assert.deepEqual(encounterTableChoices(band[1]), [biomeTable(band[1])]);
    let k = 0;
    const rolls = () => [0.5, 0.5, 0.3][k++ % 3];
    const id = chooseRandomEnemy({ climateIndex: 226, fauna: band, isDay: true, inLocationRect: false, playerLevel: 8, local: true }, rolls);
    assert.ok(biomeTable(band[1]).includes(id));
  } finally { _resetEncounterTableSelectors(); }
});

test('TESA-BIOME fauna: the online grants read the zone too - an encr member\'s species from its band, the set a grant may stand its band\'s, the host\'s faunaAt asked', () => {
  _resetEncounterTableSelectors();
  try {
    installTamrielFauna();
    const band = BIOME_BANDS.get('skyrimPeaks');
    const wild = new Set(biomeTable(band[1]));
    let off = 0;
    for (let s = 1; s <= 40; s++) {
      assert.ok(wild.has(grantSpecies({ s, m: 12 * 60, l: 8 }, 0, 226, false, band)), `seed ${s}: the peaks' wild by day`);
      if (!wild.has(grantSpecies({ s, m: 12 * 60, l: 8 }, 0, 226, false))) off++;
    }
    assert.ok(off > 0, 'the climate\'s own table is another');
    const climate = grantSpeciesOf(226);
    const zone = grantSpeciesOf(226, band);
    assert.deepEqual([...zone].sort((a, b) => a - b), [...new Set(band.flatMap((i) => biomeTable(i)))].sort((a, b) => a - b), 'its three tables\' species - kept apart from the climate\'s');
    assert.notDeepEqual([...climate].sort(), [...zone].sort());
    const host = createGrantHost({ session: () => null, climateAt: () => 226, faunaAt: () => band, fetchKey: async () => null });
    const gr = { k: 'encr', s: 7, m: 12 * 60, l: 8, p: [1, 1] };
    assert.equal(host.speciesOf(gr, 0, false), grantSpecies(gr, 0, 226, false, band));
    assert.ok(wild.has(host.speciesOf(gr, 0, false)));
  } finally { _resetEncounterTableSelectors(); }
});

test('TESA-BIOME fauna: the world host wires it - the selector stood, the wild\'s roll, the bands and the camps carry the pixel\'s band, the jungle its zones', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /installTamrielFauna\(\);/);
  assert.match(w, /maps\.getClimateIndex = groundClimateIndex\(maps\.getClimateIndex\.bind\(maps\)\);\n\s+maps\.getFaunaBand = faunaBandAt;/, 'composed beside the climate read, where the land past the Bay streams');
  assert.equal((w.match(/fauna: maps\.getFaunaBand\?\.\(/g) ?? []).length, 3, 'the wild\'s minute roll, a roaming band\'s make, the camps a crossing rolls');
  assert.match(w, /faunaAt: \(x, y\) => maps\.getFaunaBand\?\.\(x, y\) \?\? null/, 'and the online grants\' species law');
  assert.match(w, /beyond: tamrielLand \? \(x, y\) => !!tamrielBiomeAt\(x, y\)\?\.jungle : null, version: tamrielLand \? biomeStamp : null \}\) : null;/, 'and the jungle host its zones past the Bay - Cyrodiil\'s');
});
