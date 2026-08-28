// TN1 - THE TALK-NEWS GETTERS (2026-08-28). Seven seams the machine
// and the macro table declared and nothing production-side answered:
// the four npcData faction names (TK-iv computed them in every arm of
// getGreetingIndex and recorded "the names nobody reads" - stale: the
// TalkManager getters at :1795-1824 read all four and MacroHelper.cs
// :965-995 routes %fa/%fae/%fe/%fea/%fnpc/%fpc through them),
// GetFactionName's HolyOrder deity arm, GetLordNameForFaction
// (MacroHelper.cs:310-331) and GetOldLeaderFateString. Every one of
// those macros expanded to the charter's null; the world mounts them
// now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { lordNameForFaction, FACTION_RACE_KEYS } from '../src/systems/talk.js';
import { GENDERS, getNameBank, fullName } from '../src/characters/nameHelper.js';
import { srand } from '../src/formats/dfRandom.js';
import { getContextValue } from '../src/systems/quest/questMacros.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';

const read = (p) => readFileSync(p, 'utf8');

// ── GetLordNameForFaction (MacroHelper.cs:310-331) ───────────────

const dict = (rows) => new Map(rows.map((r) => [r.id, r]));

test('TN1 lord: a first child who is an Individual IS the ruler and answers by name', () => {
  const d = dict([
    { id: 100, ruler: 3, race: 3, rulerNameSeed: 0xABCD1234, children: [7, 8] },
    { id: 7, type: FACTION_TYPES.Individual, name: 'Gothryd' },
    { id: 8, type: FACTION_TYPES.Individual, name: 'Aubk-i' },
  ]);
  assert.equal(lordNameForFaction(d, 100), 'Gothryd', 'the FIRST child, nobody else');
  // a first child that is NOT an Individual falls through to the generate arm
  const d2 = dict([
    { id: 100, ruler: 3, race: 3, rulerNameSeed: 0xABCD1234, children: [7] },
    { id: 7, type: FACTION_TYPES.Group, name: 'The Court' },
  ]);
  assert.notEqual(lordNameForFaction(d2, 100), 'The Court');
});

test('TN1 lord: the generate arm - parity gender, race bank, the SEEDED classic stream', () => {
  // the strongest pin: the expected name computed by seeding the same
  // stream by hand - kills a swapped seed half, a flipped parity, a
  // wrong bank, each exactly
  const fd = { id: 100, ruler: 3, race: 2, rulerNameSeed: 0xABCD1234, children: null };
  const d = dict([fd]);
  srand(0xABCD1234 & 0xffff);
  const expectNew = fullName(getNameBank('Redguard'), GENDERS.Male);   // ruler 3 is odd -> Male
  assert.equal(lordNameForFaction(d, 100), expectNew);
  srand(0xABCD1234 >>> 16);
  const expectOld = fullName(getNameBank('Redguard'), GENDERS.Male);
  assert.equal(lordNameForFaction(d, 100, true), expectOld, 'the OLD ruler reads the HIGH half');
  // "used to retain the same old and new ruler name for each region":
  // reseeding makes the call DETERMINISTIC, however much the shared
  // stream moved in between
  srand(9999);
  assert.equal(lordNameForFaction(d, 100), expectNew, 'seeded per call - classic\'s own retention trick');

  // parity: an EVEN ruler entry is female (the C# comment's own words).
  // The expectation is computed BEFORE the call - the call re-seeds
  // and advances the one shared stream, so evaluation order matters.
  const dEven = dict([{ id: 100, ruler: 2, race: 3, rulerNameSeed: 0x1234, children: null }]);
  srand(0x1234);
  const expectEven = fullName(getNameBank('Breton'), GENDERS.Female);
  assert.equal(lordNameForFaction(dEven, 100), expectEven);
});

test('TN1 lord: a missing faction generates over the C# out-param defaults', () => {
  // GetFactionData's out defaults: ruler 0 (even -> Female), race 0
  // (Nord), seed 0. Nord surnames end in the immutable "sen".
  const name = lordNameForFaction(dict([]), 424242);
  srand(0);
  assert.equal(name, fullName(getNameBank('Nord'), GENDERS.Female));
  assert.match(name, /sen$/, 'race 0 is FactionRaces.Nord, not a crash');
});

test('TN1: FACTION_RACE_KEYS is FactionFile.cs:609-622, and the oddballs default', () => {
  assert.deepEqual(FACTION_RACE_KEYS, {
    0: 'Nord', 1: 'Khajiit', 2: 'Redguard', 3: 'Breton',
    4: 'Argonian', 5: 'WoodElf', 6: 'HighElf', 7: 'DarkElf',
  });
  // Skakmat (11) and Orc (17) are unmapped like None: GetRaceFrom-
  // FactionRace answers Races.None and GetNameBank defaults to Breton
  assert.equal(FACTION_RACE_KEYS[11], undefined);
  assert.equal(getNameBank(FACTION_RACE_KEYS[17] ?? null), getNameBank('Breton'));
});

// ── the macros stop expanding empty ──────────────────────────────

test('TN1 macros: the seven handlers answer the world hooks, C#\'s own asymmetries kept', () => {
  const world = {
    factionNPCAlly: () => 'The Kynaran Order',
    factionNPCEnemy: () => 'The Shadow Legion',
    factionNPC: () => 'The Merchants',
    factionPC: () => 'The Fighters Guild',
    factionName: () => 'Arkay',
    oldLeaderFate: (i) => `fate${i}`,
  };
  const hooks = { world };
  assert.equal(getContextValue('%fa', null, hooks), 'The Kynaran Order');
  assert.equal(getContextValue('%fea', null, hooks), 'The Kynaran Order', '%fea reads GetFactionNPCAlly - the C# asymmetry');
  assert.equal(getContextValue('%fe', null, hooks), 'The Shadow Legion');
  assert.equal(getContextValue('%fae', null, hooks), 'The Shadow Legion', '%fae reads GetFactionNPCEnemy');
  assert.equal(getContextValue('%fnpc', null, hooks), 'The Merchants');
  assert.equal(getContextValue('%fpc', null, hooks), 'The Fighters Guild');
  assert.equal(getContextValue('%fpa', null, hooks), 'Arkay', '%fpa is GetFactionName - the HolyOrder deity arm');
  assert.match(getContextValue('%olf', null, hooks), /^fate[0-4]$/, '%olf rolls 0..4 into GetOldLeaderFateString');
});

// ── the world mounts, source-pinned ──────────────────────────────

test('TN1 world: the seven hooks stand on questWorld, wired to their one homes', () => {
  const world = read('src/scenes/world.js');
  for (const field of ['npcFactionName', 'allyFactionName', 'enemyFactionName']) {
    assert.match(world, new RegExp(`npcSession\\.npcData\\?\\.${field} \\?\\? ''`),
      `the ${field} hook reads TK-iv's computed name`);
  }
  assert.ok((world.match(/npcSession\.npcData\?\.pcFactionName \?\? ''/g) ?? []).length >= 2,
    'factionPC and factionName\'s fall-through both read pcFactionName');
  assert.match(world, /GUILD_GROUPS\.HolyOrder[^]{0,200}getDivine\(townTalk\.factionDict, modes\?\.interiorBuilding\?\.factionID \?\? 0\)/,
    'GetFactionName\'s HolyOrder arm answers the temple\'s deity (:1815-1822)');
  assert.match(world, /lordNameForFaction: \(id, old = false\) => lordNameForFaction\(townTalk\.factionDict, id, old\)/,
    'the lord names ride the one home in systems/talk.js');
  assert.match(world, /oldLeaderFate: \(i\) => answerPipeline\.getOldLeaderFateString\(i\)/,
    'the fates ride the pipeline\'s own localized strings');
});
