// TESA-BIOME (2026-10-24, bible/03-World/Tamriel-Biomes.md) - the fauna past the Bay: each biome's three encounter
// tables, made from its lore roster, on DFU's encounter-table door. AUDIT TESA-BIOME (bible/01-Overview/audits/
// Audit-Tesa-Biome.md): no aquatic creature on land, the repeat window, the levels as the game loaded them, every table
// held to DFU's own band through the real roll, a classic look-alike only where it reads true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ROSTERS, TOWN_ROSTERS, DEX_LEVELS, RARITY, SLOTS, SLOT_REACH, CLASS_FROM, BIOME_TABLE_BASE, BIOME_BANDS, FAUNA_SELECTOR,
  WINDOW_SLOTS, WINDOW_MAX, faunaTable, faunaLevel, faunaLevelIn, faunaRoster, biomeTable, faunaBandAt, installTamrielFauna,
  isDexId, isAquatic,
} from '../../src/systems/tamrielFauna.js';
import { dexClassicRow } from '../../src/systems/enemyExpansion/dexInstall.js';
import { BIOMES } from '../../src/world/tamriel/tamrielBiomes.js';
import { PROVINCES, CITIES } from '../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay } from '../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { ENEMY_BASICS, VANILLA_ENEMY_BASICS, isClassEnemyId } from '../../src/characters/enemy/enemyBasics.js';
import { ENCOUNTER_TABLES } from '../../src/characters/encounterTables.js';
import { encounterTable, encounterTableChoices, _resetEncounterTableSelectors, hasEncounterTableSelector, encounterTableGeneration } from '../../src/characters/encounterTableDoor.js';
import { resolveEncounterTableIndex, chooseRandomEnemy } from '../../src/systems/encounters.js';
import { grantSpecies, grantSpeciesOf, createGrantHost, grantDiceRefusal } from '../../src/scenes/grantHost.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const csv = (p) => read(p).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split(','));
const DEX_MONSTERS = new Map(csv('vendor/daggerfall-enemy-expansion/MonsterBase.mdb.csv').slice(1).map((r) => [Number(r[0]), { name: r[1], level: Number(r[3]) }]));
const DEX_CLASSES = new Map(csv('vendor/daggerfall-enemy-expansion/ClassBase.mdb.csv').slice(1).map((r) => [Number(r[0]), { name: r[1] }]));
const isClassic = (id) => (id >= 0 && id <= 42) || (id >= 128 && id <= 145);
const allEntries = () => [...Object.values(ROSTERS).flatMap((r) => [...r.day, ...r.night]), ...Object.values(TOWN_ROSTERS).flat()];
const pixelOf = (name) => pictureToBay(...CITIES.find((c) => c.name === name).at).map(Math.floor);
const tablesOf = (key, dex) => BIOME_BANDS.get(key).map((i) => biomeTable(i, dex));
/** The odds a player of `level` meets each id of `table` - the real chooseRandomEnemy over its two dice, enumerated. */
function oddsOf(table, level) {
  const out = new Map();
  for (let face = 1; face <= 100; face++) {
    for (let s = 0; s < 20; s++) {
      let k = 0;
      const d = [(face - 0.5) / 100, (s + 0.5) / 20];
      const id = chooseRandomEnemy({ table, climateIndex: 231, isDay: true, inLocationRect: false, playerLevel: level }, () => d[k++] ?? 0.5);
      out.set(id, (out.get(id) ?? 0) + 1 / 2000);
    }
  }
  return out;
}

test('TESA-BIOME fauna: every biome a roster by day and by night, every province a town - every creature one the game can stand', () => {
  assert.deepEqual(Object.keys(ROSTERS).sort(), BIOMES.map((b) => b.key).sort());
  assert.deepEqual(Object.keys(TOWN_ROSTERS).sort(), PROVINCES.map((p) => p.key).sort());
  for (const [id, r] of allEntries()) {
    assert.ok(Object.hasOwn(RARITY, r), `${id}: a rarity`);
    if (isClassic(id)) assert.ok(isClassEnemyId(id) || ENEMY_BASICS[id], `${id}: DFU's`);
    else assert.ok(DEX_MONSTERS.has(id) || DEX_CLASSES.has(id), `${id}: Daggerfall Enemy Expansion's`);
    assert.notEqual(id, 39, 'no horse: not a foe');
    // AUDIT TESA-BIOME F1/L1: a swimmer never stands on a land table - on dry ground its motor never moves it
    assert.ok(!isAquatic(id), `${id}: no aquatic creature on a land roster (DFU keeps them to its underwater table, 19)`);
  }
  assert.ok(isAquatic(41) && isAquatic(42) && !isAquatic(279), 'the Dreugh and the Lamia swim; DEX\'s Land Dreugh walks');
  // the Dragonling is the Bay's and Wrothgar's own (Daggerfall stands it; UESP Lore:Dragonling), the great dragon none
  assert.ok(ROSTERS.highRockWrothgar.day.some(([id]) => id === 34), 'Wrothgar\'s dragonlings');
});

test('TESA-BIOME fauna: DEX_LEVELS are the vendored MonsterBase.mdb.csv\'s levels', () => {
  for (const [id, lv] of Object.entries(DEX_LEVELS)) assert.equal(DEX_MONSTERS.get(Number(id))?.level, lv, `${id} ${DEX_MONSTERS.get(Number(id))?.name}`);
  for (const [id] of allEntries()) if (isDexId(id) && !isClassEnemyId(id)) assert.ok(Object.hasOwn(DEX_LEVELS, id), `${id}: its level held`);
});

test('TESA-BIOME fauna: a table is twenty slots in the order of their levels - a monster within SLOT_REACH of its slot where any reaches it, the people from CLASS_FROM, a V once, no creature more than WINDOW_MAX times in WINDOW_SLOTS', () => {
  assert.deepEqual([SLOTS, SLOT_REACH, CLASS_FROM, BIOME_TABLE_BASE, WINDOW_SLOTS, WINDOW_MAX], [20, 4, 3, 100, 6, 2]);
  assert.deepEqual(RARITY, { C: 4, U: 2, R: 1, V: 0.5 });
  for (const b of BIOMES) {
    for (const dex of [true, false]) {
      const levelOf = (id) => faunaLevelIn(id, dex);
      const [town, day, night] = tablesOf(b.key, dex);
      for (const [t, entries] of [[day, ROSTERS[b.key].day], [night, ROSTERS[b.key].night], [town, TOWN_ROSTERS[b.province]]]) {
        const roster = faunaRoster(entries, dex);
        const ids = new Set(roster.map(([id]) => id));
        assert.equal(t.length, SLOTS);
        t.forEach((id, i) => {
          assert.ok(ids.has(id), `${b.key}: slot ${i}'s ${id} is its roster's`);
          const lv = levelOf(id);
          if (lv == null) assert.ok(i >= CLASS_FROM, `${b.key}: a person at slot ${i}`);
          // AUDIT TESA-BIOME F8: out of reach only where no monster of the roster reaches the slot
          else if (Math.abs(lv - (i + 1)) > SLOT_REACH) {
            // out of reach only from the fallback: every creature the slot's draw could take was barred there - a used V,
            // one the window holds, a person below CLASS_FROM
            const barred = (q, r) => (r === 'V' && t.slice(0, i).includes(q)) || t.slice(Math.max(0, i - WINDOW_SLOTS + 1), i).filter((x) => x === q).length >= WINDOW_MAX;
            for (const [q, r] of roster) {
              const ql = levelOf(q);
              const drawable = ql == null ? i >= CLASS_FROM : Math.abs(ql - (i + 1)) <= SLOT_REACH;
              assert.ok(!drawable || barred(q, r), `${b.key}: ${id} out of reach at slot ${i} while ${q} could stand`);
            }
          }
          const run = t.slice(Math.max(0, i - WINDOW_SLOTS + 1), i + 1);
          assert.ok(run.filter((x) => x === id).length <= WINDOW_MAX, `${b.key}: ${id} at most ${WINDOW_MAX} in ${WINDOW_SLOTS} (slot ${i})`);
        });
        for (const [id, r] of roster) if (r === 'V') assert.ok(t.filter((x) => x === id).length <= 1, `${b.key}: ${id} once at most`);
        if (!dex) assert.ok(t.every((id) => !isDexId(id)), `${b.key}: the classic table stands no DEX creature`);
        assert.ok(t.every((id) => !isAquatic(id)), `${b.key}: no swimmer`);
      }
    }
  }
});

test('TESA-BIOME fauna: every table within DFU\'s own band through the real roll - no one creature past 42% of a level\'s meetings, a level-1 player\'s monsters of level 9 and up at most 30%, a level-20 player\'s of level 8 and under at most 5% (AUDIT TESA-BIOME F3/F4)', () => {
  // DFU's worst wild tables: a creature's 40% (#21's sabre cat at level 1), 29% hard at level 1 (#37), 2% trivial at 20 (#28)
  for (const dex of [false, true]) {
    const levelOf = (id) => faunaLevelIn(id, dex);
    for (const b of BIOMES) {
      for (const t of tablesOf(b.key, dex).slice(1)) {
        for (const L of [1, 5, 10, 15, 20, 25]) {
          const odds = oddsOf(t, L);
          for (const [id, p] of odds) assert.ok(p <= 0.42, `${b.key} ${dex ? 'DEX' : 'classic'} L${L}: ${id} ${(p * 100).toFixed(0)}%`);
          if (L === 1) {
            let hard = 0; for (const [id, p] of odds) if (!isClassEnemyId(id) && levelOf(id) >= 9) hard += p;
            assert.ok(hard <= 0.30, `${b.key} ${dex ? 'DEX' : 'classic'}: level 1 meets level 9+ ${(hard * 100).toFixed(0)}%`);
          }
          if (L === 20) {
            let trivial = 0; for (const [id, p] of odds) if (!isClassEnemyId(id) && levelOf(id) <= 8) trivial += p;
            assert.ok(trivial <= 0.05, `${b.key} ${dex ? 'DEX' : 'classic'}: level 20 meets level 8- ${(trivial * 100).toFixed(0)}%`);
          }
        }
      }
    }
  }
});

test('TESA-BIOME fauna: a creature\'s level is the game\'s as it loaded - off the frozen vanilla table and the mod\'s own read, the same before an install and after it (AUDIT TESA-BIOME F5); our meaner monsters beside DEX move no level, so the provinces\' tables are DEX\'s with them on (OWN-WORK2)', () => {
  assert.equal(faunaLevelIn(41, false), VANILLA_ENEMY_BASICS[41].level);
  for (const id of [16, 19, 41, 42]) {
    assert.equal(faunaLevelIn(id, true), dexClassicRow(id, VANILLA_ENEMY_BASICS[id]).level ?? VANILLA_ENEMY_BASICS[id].level, `${id} DEX`);
    assert.equal(faunaLevelIn(id, true), dexClassicRow(id, VANILLA_ENEMY_BASICS[id], { meaner: true }).level ?? VANILLA_ENEMY_BASICS[id].level, `${id} DEX and ours: one level`);
  }
  assert.equal(faunaLevelIn(262, true), DEX_LEVELS[262]);
  assert.equal(faunaLevelIn(143, true), null, 'a person: the player\'s own level');
  assert.equal(faunaLevel(19), VANILLA_ENEMY_BASICS[19].level);
  // the cache keys DEX's switch: two variants, each its own
  const i = BIOME_BANDS.get('skyrimFrozenCoast')[1];
  const want = (dex) => faunaTable(faunaRoster(ROSTERS.skyrimFrozenCoast.day, dex), 'skyrimFrozenCoast/1', (id) => faunaLevelIn(id, dex));
  assert.deepEqual(biomeTable(i, false), want(false));
  assert.deepEqual(biomeTable(i, true), want(true));
  assert.notDeepEqual(want(true), want(false), 'the two variants differ, so a shared key would be seen');
  assert.match(read('src/systems/tamrielFauna.js'), /const key = `\$\{index\}:\$\{dex \? 1 : 0\}`;/);
});

test('TESA-BIOME fauna: a table golden - the Nibenay Valley\'s wild by day, as the game builds it in either variant (AUDIT TESA-BIOME P7: the weights, the hash, the window and the cover fixed together)', () => {
  const i = BIOME_BANDS.get('cyrodiilNibenayValley')[1];
  assert.deepEqual([...biomeTable(i, false, false)], [0, 1, 0, 145, 4, 138, 145, 144, 144, 145, 136, 138, 130, 130, 136, 141, 138, 144, 130, 138]);
  assert.deepEqual([...biomeTable(i, true, true)], [281, 1, 0, 145, 262, 278, 390, 144, 144, 145, 272, 138, 130, 390, 136, 141, 138, 145, 130, 138]);
  // the classic stand-ins as the tables wear them (P8): Skyrim's wolf its sabre cat and its troll a giant; Cyrodiil's no giant
  const classic = (key) => new Set(tablesOf(key, false).flat());
  assert.ok(classic('skyrimTundra').has(5) && classic('skyrimPeaks').has(16), 'Skyrim\'s sabre cats and giants');
  for (const key of ['cyrodiilNibenay', 'cyrodiilColovia', 'cyrodiilJerall', 'cyrodiilNibenayValley']) assert.ok(!classic(key).has(16), `${key}: no giant for a troll, an ogre or a minotaur`);
  for (const key of ['highRockRivenspire', 'highRockWrothgar']) assert.ok(!classic(key).has(5), `${key}: no sabre cat for a wolf`);
});

test('TESA-BIOME fauna: the classic roster - a DEX creature as its own stand-in or STANDIN\'s, none where none reads true; the one creature at the commonest rarity it is named with', () => {
  assert.deepEqual(faunaRoster([[262, 'C', 5], [5, 'R']], false), [[5, 'C']], 'Skyrim\'s wolf as its sabre cat: common');
  assert.deepEqual(faunaRoster([[5, 'R'], [262, 'C', 5]], false), [[5, 'C']]);
  assert.deepEqual(faunaRoster([[262, 'C', 5], [5, 'R']], true), [[262, 'C'], [5, 'R']], 'DEX loaded: each its own');
  // AUDIT TESA-BIOME L23/L10/F1: no sabre cat for a High Rock wolf, no giant for a Cyrodiil minotaur, no rat for a crab, no
  // aquatic Dreugh for the walking Land Dreugh
  for (const id of [262, 263, 269, 272, 282, 281, 278, 267, 256, 279, 258]) assert.deepEqual(faunaRoster([[id, 'C'], [0, 'U']], false), [[0, 'U']], `${id}: left out`);
  assert.deepEqual(faunaRoster([[280, 'C']], false), [[5, 'C']], 'the mountain lion a big cat still');
  assert.deepEqual(faunaRoster([[272, 'U', 16]], false), [[16, 'U']], 'Skyrim\'s troll as its giant');
});

test('TESA-BIOME fauna: the slot law - a monster in reach is drawn nearer its level, a slot no monster reaches takes the nearest the window allows', () => {
  const t = faunaTable([[0, 'C'], [16, 'C'], [32, 'C']], 'pin');   // a rat (1), a giant (10) and a lich (20)
  assert.equal(t[0], 0, 'slot 0 (level 1): the rat');
  assert.equal(t[9], 16, 'slot 9 (level 10): the giant');
  assert.equal(t[19], 32, 'slot 19 (level 20): the lich');
  assert.ok(t.slice(15).filter((x) => x === 32).length >= 2, 'the lich in its reach');
  assert.ok(t.slice(0, 4).every((x) => x !== 32), 'never the lich at the bottom');
  // the window gives way before a far creature stands: three creatures cannot keep it, and the slot takes the nearest
  t.forEach((id, i) => assert.ok(Math.abs(faunaLevel(id) - (i + 1)) <= 2 * SLOT_REACH || [0, 16, 32].every((q) => Math.abs(faunaLevel(q) - (i + 1)) > 2 * SLOT_REACH), `slot ${i}: ${id}`));
  // AUDIT TESA-BIOME F7: the last fallback stands a person only from CLASS_FROM - a mage and a lich (V, once) never put the
  // mage below slot 3
  const v = faunaTable([[128, 'C'], [32, 'V']], 'pin-v', () => null);
  assert.ok(v.slice(0, CLASS_FROM).every((id) => id !== 128), `no person below slot 3 (${v.slice(0, 4)})`);
  const lv = faunaTable([[128, 'C'], [32, 'V']], 'pin-v');
  assert.ok(lv.slice(0, CLASS_FROM).every((id) => id === 32), 'the lich, used or not, before any person low');
  // a V the draw has used stays used in the fallback too, while anything else is left: a rat (V) and a lich - the rat once,
  // slots 1-4 the lich though the rat is the nearer
  const once = faunaTable([[0, 'V'], [32, 'C']], 'pin');
  assert.deepEqual([once.filter((id) => id === 0).length, once[0], once[1]], [1, 0, 32]);
  // THE COVER seats the commons before the uncommons: twelve beasts at level 10, six of each, nine slots in reach - the
  // ones left out are uncommon (custom levels; ids no table stands)
  const lvOf = new Map([[2000, 1], [2001, 20]]), crowd = [];
  for (let k = 0; k < 12; k++) { crowd.push([1000 + k, k < 6 ? 'C' : 'U']); lvOf.set(1000 + k, 10); }
  crowd.push([2000, 'C'], [2001, 'C']);
  for (let s = 0; s < 8; s++) {
    const t = faunaTable(crowd, `cover-${s}`, (id) => lvOf.get(id) ?? null);
    const out = crowd.filter(([id]) => !t.includes(id));
    assert.ok(out.length && out.every(([, r]) => r === 'U'), `cover-${s}: left out ${out.map(([id, r]) => `${id}${r}`)}`);
  }
});

test('TESA-BIOME fauna: the lore - Black Marsh and Vvardenfell are rid of High Rock\'s woods; Cyrodiil\'s wild is the Imp\'s and the Minotaur\'s; Skyrim\'s the wolf\'s and the troll\'s', () => {
  const all = (key, dex = true) => new Set(tablesOf(key, dex).flat());
  for (const key of ['blackMarshHist', 'blackMarshFens', 'blackMarshMurkmire']) {
    for (const id of [7, 8, 14, 12, 24]) assert.ok(!all(key).has(id), `${key} stands no ${id} (Orc, Centaur, Wereboar)`);
    assert.ok(all(key).has(258), `${key}: Arena's Lizard Men`);
  }
  // Vvardenfell: no bat, bear, big cat, spider, wolf, orc, centaur, harpy or giant (TES III's bestiary); Red Mountain no snow beast
  for (const key of ['morrowindAshlands', 'morrowindBitterCoast', 'morrowindAscadian', 'morrowindRedMountain']) {
    for (const dex of [true, false]) for (const id of [3, 4, 5, 6, 7, 8, 13, 14, 16, 262, 263, 271, 280, 272]) assert.ok(!all(key, dex).has(id), `${key} stands no ${id}`);
  }
  assert.ok(all('morrowindAshlands').has(288), 'the Ashlands\' scamps');
  // the golems are the mages' (Arena's and DEX's constructs), never the wild's; the Dwemer's machines very rare, by ruins alone
  for (const b of BIOMES) for (const dex of [true, false]) for (const id of [284, 286]) assert.ok(!all(b.key, dex).has(id), `${b.key}: no golem`);
  const ruins = new Set(['skyrimReach', 'hammerfellCraglorn', 'morrowindAshlands', 'morrowindRedMountain']);
  for (const [key, r] of Object.entries(ROSTERS)) for (const [id, rar] of [...r.day, ...r.night]) if (id === 289 || id === 290) assert.ok(ruins.has(key) && rar === 'V', `${key}: a Dwemer machine ${rar}`);
  assert.ok(!all('skyrimTundra').has(13), 'no harpy on the tundra');
  const nib = all('cyrodiilNibenay');
  for (const id of [1, 269, 280, 256]) assert.ok(nib.has(id), `the Nibenay: ${id}`);
  for (const id of [13, 20]) assert.ok(!nib.has(id), `the Nibenay: no ${id} (Harpy, Giant Scorpion)`);
  for (const key of ['skyrimTundra', 'skyrimPinewood']) assert.ok(all(key).has(262), `${key}: wolves`);
  assert.ok(all('skyrimPeaks').has(272) && all('skyrimPeaks').has(263), 'the peaks: trolls and snow wolves');
  assert.ok(all('highRockWrothgar').has(34), 'Wrothgar: dragonlings');
  assert.ok(all('cyrodiilNibenayValley').has(1) && !all('cyrodiilNibenayValley').has(269), 'the valley: imps, no minotaur');
  assert.ok(all('hammerfellAlikr').has(20), 'the Alik\'r: its scorpions');
  // DFU's own Swamp/Woodlands family, for the record of what it replaces
  assert.ok(ENCOUNTER_TABLES[33].includes(16) && ENCOUNTER_TABLES[34].includes(14), 'DFU\'s woodlands stand giants and wereboars');
});

test('TESA-BIOME fauna: the band at a pixel - its biome\'s three past the Bay, none on the Bay or at sea; the law reads `fauna` before the climate', () => {
  setTamrielTrace(null);
  assert.equal(faunaBandAt(500, 250), null);
  assert.equal(faunaBandAt(...pictureToBay(10, 10).map(Math.floor)), null);
  const band = faunaBandAt(...pixelOf('Imperial City'));
  assert.deepEqual(band, BIOME_BANDS.get('cyrodiilNibenayValley'));
  const i = BIOMES.findIndex((b) => b.key === 'cyrodiilNibenayValley');
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
    // AUDIT TESA-BIOME P2: the reader's dice law past the Bay - a member's species is its zone's roll, never the climate's
    const gr0 = { k: 'encr', s: 11, m: 12 * 60, l: 8, p: [2475, 824] };
    const zoneAt = () => band, climateAt = () => 226;
    let refused = 0;
    for (let i = 0; i < 6; i++) {
      const t = grantSpecies(gr0, i, 226, false, band);
      assert.equal(grantDiceRefusal(gr0, { t, gr: [1, i] }, climateAt, zoneAt), null, `member ${i}: its zone's species stands`);
      const c = grantSpecies(gr0, i, 226, false);
      if (c !== t && c !== grantSpecies(gr0, i, 226, true, band)) { refused++; assert.equal(grantDiceRefusal(gr0, { t: c, gr: [1, i] }, climateAt, zoneAt), 'dice', `member ${i}: the climate's species refused past the Bay`); }
    }
    assert.ok(refused > 0, 'a climate\'s species met and refused');
    const camp = { k: 'camp', s: 3, m: 12 * 60, l: 8, p: [2475, 824] };
    const onlyZone = [...zone].find((id) => !climate.has(id)), onlyClimate = [...climate].find((id) => !zone.has(id));
    assert.equal(grantDiceRefusal(camp, { t: onlyZone, gr: [1, 0] }, climateAt, zoneAt), null, 'a camp\'s member of the zone\'s set');
    assert.equal(grantDiceRefusal(camp, { t: onlyClimate, gr: [1, 0] }, climateAt, zoneAt), 'dice', 'one of the climate\'s alone refused');
    assert.equal(grantDiceRefusal(camp, { t: onlyClimate, gr: [1, 0] }, climateAt), null, 'on the Bay (no zone) the climate\'s set');
    const host = createGrantHost({ session: () => null, climateAt: () => 226, faunaAt: () => band, fetchKey: async () => null });
    const gr = { k: 'encr', s: 7, m: 12 * 60, l: 8, p: [1, 1] };
    assert.equal(host.speciesOf(gr, 0, false), grantSpecies(gr, 0, 226, false, band));
    assert.ok(wild.has(host.speciesOf(gr, 0, false)));
  } finally { _resetEncounterTableSelectors(); }
});

test('TESA-BIOME fauna: the world host wires it - the selector stood, the wild\'s roll, the bands, the camps and the road\'s trouble carry the pixel\'s band, the jungle its zones', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /installTamrielFauna\(\);/);
  // PIN MOVED (WORLD-WIDE folded into TESA, #1184): the climate read composed by WW-R's groundMaps (world/tamriel/tamrielGround.js)
  assert.match(w, /groundMaps\(maps\);[^\n]*\n\s+maps\.getFaunaBand = faunaBandAt;/, 'composed beside the climate read, where the land past the Bay streams');
  assert.equal((w.match(/fauna: maps\.getFaunaBand\?\.\(/g) ?? []).length, 3, 'the wild\'s minute roll, a roaming band\'s make, the camps a crossing rolls');
  // AUDIT TESA-BIOME P3: each read the same pixel as its climate's, in its own call - not a count
  assert.match(w, /climateIndex: maps\.getClimateIndex\(playerTravelPixel\(\)\.x, playerTravelPixel\(\)\.y\),\n\s+fauna: maps\.getFaunaBand\?\.\(playerTravelPixel\(\)\.x, playerTravelPixel\(\)\.y\),[^\n]*\n\s+playerLevel: effectiveLevel\(playerEntity\),/, 'the wild\'s minute roll (IntermittentEnemySpawn)');
  assert.match(w, /const hit = rollGroupComposition\(\{ climateIndex: maps\.getClimateIndex\(px, py\), fauna: maps\.getFaunaBand\?\.\(px, py\), playerLevel:/, 'a roaming band\'s make');
  assert.match(w, /const chunkCampHits = rollCampEncountersOnChunkLoad\(\{\n[^\n]*\n\s+climateIndex: maps\.getClimateIndex\(r\.current\.x, r\.current\.y\),\n\s+fauna: maps\.getFaunaBand\?\.\(r\.current\.x, r\.current\.y\),/, 'the camps a crossing rolls');
  assert.match(w, /faunaAt: \(x, y\) => maps\.getFaunaBand\?\.\(x, y\) \?\? null/, 'and the online grants\' species law');
  // PIN MOVED (BAY-LEFT-GROUND, D2): and the living world's road trouble - it handed the law no band, and Black Marsh's
  // caravans met Daggerfall's Orcs and Centaurs (test/systems/livingWorld/bayleftground_trouble.test.js)
  assert.match(w, /foesOf: troubleFoesOf\(\{ faunaAt: \(x, y\) => maps\.getFaunaBand\?\.\(x, y\) \}\),/, 'and the road\'s trouble (the living world)');
  assert.match(w, /zoneAt: tamrielLand \? tamrielBiomeAt : null, version: tamrielLand \? biomeStamp : null \}\) : null;/, 'and the jungle host its zones past the Bay - Cyrodiil\'s jungle, Valenwood\'s and its canopy');
});
