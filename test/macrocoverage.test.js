// M-X + E7 - THE MACRO TABLE COMPLETED + THE COVERAGE GATE the
// completion analysis asked for by name: MacroHelper.cs's own table is
// extracted and diffed against the port's, so a macro DFU adds (or one
// this port loses) fails here mechanically instead of by sweep. The
// gate needs the DFU sparse clone and SKIPS without it - the
// ARENA2-gate posture; the behavior pins below it run everywhere.
//
// E7 (2026-09-02) closed the last thirty-seven rows and deleted the
// ELSEWHERE crutch, so the gate now proves the ONE table IS the whole
// dictionary - 217 rows, none missing, none invented, C#'s nulls
// exactly ours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import {
  getContextValue, macroTableCoverage, setIdFactions,
} from '../src/systems/quest/questMacros.js';
import { CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';
import { getRandomNameBank } from '../src/characters/nameHelper.js';
import { dfuFile } from './dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone

const DFU_MACROHELPER = dfuFile('Assets/Scripts/Utility/MacroHelper.cs');

test('E7 GATE: every macro in MacroHelper.cs has a row in the port\'s table', (t) => {
  if (!existsSync(DFU_MACROHELPER)) {
    t.skip('DFU sparse clone absent (tools/parity/prepare.sh) - the gate needs the source tree');
    return;
  }
  const mh = readFileSync(DFU_MACROHELPER, 'utf8');
  // the symbol class is `*`, not `+`: the 217th row is the BARE '%'
  // ({ "%", Percent } - MacroHelper.cs:243), which a `+` sweep walks
  // straight past. M-X's sweep did, and so the port's table was
  // missing it with the gate green.
  const tokens = [...new Set([...mh.matchAll(/\{\s*"(%[a-zA-Z0-9]*)",\s*(\w+)\s*\}/g)].map((m) => [m[1], m[2]]).map(JSON.stringify))].map(JSON.parse);
  assert.equal(tokens.length, 217, 'the extraction found the whole table');
  const { handled, nulls } = macroTableCoverage();
  // E7: THE ELSEWHERE MAP IS GONE. M-X left thirty-seven rows
  // recorded at their consuming windows instead of in the table, with
  // its own note that consolidating them was "the recorded follow-up,
  // not a gap" - and until that landed, a symbol reaching the LADDER
  // from any other context (the talk MCP above all) answered
  // `%xx[undefined]`, the shape DFU reserves for a macro it has never
  // heard of. The per-window VALUE MAPS still answer first through
  // expandMacroValues; the table is what everything else falls to.
  const covered = new Set([...handled, ...nulls]);
  const missing = tokens.filter(([tok]) => !covered.has(tok)).map(([tok]) => tok);
  assert.deepEqual(missing, [], 'every C# row is in the ONE table');
  const extra = handled.filter((tok) => !tokens.some(([t2]) => t2 === tok));
  assert.deepEqual(extra, [], 'and the port invents no row DFU does not carry');
  // the C#-null rows are OUR null rows - a port handler standing
  // where C# has null would be an invention, not a port. (%tcn is no
  // longer the exception it was: the travel window's own
  // `Replace("%tcn", name)` is string surgery on TEXT.RSC 31, not a
  // table row, so C#'s null stands here too.)
  const csNulls = tokens.filter(([, h]) => h === 'null').map(([tok]) => tok);
  assert.deepEqual(csNulls.filter((tok) => handled.includes(tok)), [], 'no handler stands where C# has null');
  assert.deepEqual(nulls.slice().sort(), csNulls.slice().sort(), 'and every C# null row is one of ours');
  // the SHARED ROWS: C# points several symbols at ONE handler, and
  // the port must too - a per-symbol re-implementation is where they
  // drift apart.
  const handlerOf = new Map(tokens);
  for (const group of [['%it', '%wep', '%arm', '%bt'], ['%lev', '%pct'], ['%n', '%nam', '%bn'], ['%rt', '%t'], ['%fn', '%fn2'], ['%mn', '%mn2']]) {
    const names = group.map((tok) => handlerOf.get(tok));
    assert.equal(new Set(names).size, 1, `${group.join('/')} share one C# handler (${names.join(',')})`);
  }
});

// ── the behavior pins (no clone needed) ──────────────────────────

const S = (classicMinutes) => classicMinutes * 60;   // hooks.nowSeconds is SECONDS
// day 1 (0-based), 01:05 - minutes = 1*1440 + 65
const T_MIN = 1 * 1440 + 65;
const dateHooks = { nowSeconds: () => S(T_MIN) };

test('M-X: the date/time block - one-based days and months, the suffix law, MinTimeString\'s padding', () => {
  assert.equal(getContextValue('%hour', null, dateHooks), '1');
  assert.equal(getContextValue('%min', null, dateHooks), '5');
  assert.equal(getContextValue('%tim', null, dateHooks), '01:05', 'MinTimeString is {0:00}:{1:00}');
  assert.equal(getContextValue('%day', null, dateHooks), '2', 'DayOfMonth is Day + 1 (:626)');
  assert.equal(getContextValue('%days', null, dateHooks), '2nd', 'GetSuffix on the ONE-based day');
  assert.equal(getContextValue('%mon', null, dateHooks), '1', 'MonthOfYear is one-based');
  // AUDIT 39 #95: the pin moved from '0'. hooks.nowSeconds is
  // EPOCH-RELATIVE (classic minutes x 60), so nowDate adds
  // CLASSIC_EPOCH_IN_SECONDS back before reading the date - it is
  // exactly 404 x 360-day years, which is why every field above is
  // unmoved and only the year was wrong (%year answered 1 at the
  // classic game start where DFU's WorldTime.Now.Year answers 405).
  assert.equal(getContextValue('%year', null, dateHooks), '404');
  assert.equal(getContextValue('%year', null, { nowSeconds: () => S(CLASSIC_GAME_START_TIME) }), '405',
    'the classic game start is 3E405, MacroHelper %year');
  // the suffix boundaries (GetSuffix :641-651)
  const at = (day0) => getContextValue('%days', null, { nowSeconds: () => S(day0 * 1440) });
  assert.equal(at(0), '1st');
  assert.equal(at(2), '3rd');
  assert.equal(at(3), '4th');
  assert.equal(at(20), '21st');
  assert.equal(at(21), '22nd');
  assert.equal(at(29), '30th');
  // the epoch sanity: the classic start reads a real calendar
  assert.match(getContextValue('%monn', null, { nowSeconds: () => S(CLASSIC_GAME_START_TIME) }), /^[A-Z]/);
  assert.match(getContextValue('%dayn', null, dateHooks), /das$/, 'a Tamriel day name');
  assert.match(getContextValue('%sign', null, dateHooks), /^The /, 'a birth sign');
});

test('M-X: the player globals - vitals, MagicResist, encumbrance, %ski, the signed modifiers, pronouns', () => {
  const entity = {
    magicka: 25, maxMagicka: 40,
    stats: { strength: 60, willpower: 47 },
    skills: { 4: 100, 7: 60 },
    career: { primarySkills: [7, 4, 2] },
    toHitModifier: 2, damageModifier: -3, hitPointsModifier: 0,
  };
  const hooks = { playerEntity: () => entity, playerGender: () => 'female', playerName: () => 'Jane Iron Doe' };
  assert.equal(getContextValue('%spc', null, hooks), '25');
  assert.equal(getContextValue('%spt', null, hooks), '40');
  assert.equal(getContextValue('%enc', null, hooks), '90', 'MaxEncumbrance = floor(str * 1.5)');
  assert.equal(getContextValue('%mad', null, hooks), '4', 'MagicResist = floor(will / 10)');
  assert.equal(getContextValue('%thd', null, hooks), '+2', 'the "+0;-0;0" signed format');
  assert.equal(getContextValue('%dam', null, hooks), '-3');
  assert.equal(getContextValue('%hea', null, hooks), '0', 'zero is bare');
  assert.match(getContextValue('%ski', null, hooks), /^[A-Z]/, 'the first PRIMARY at permanent 100 answers its name');
  entity.skills[4] = 99;
  assert.equal(getContextValue('%ski', null, hooks), 'BLANK', 'no mastered primary: "BLANK", verbatim');
  assert.equal(getContextValue('%pg1', null, hooks), 'she');
  assert.equal(getContextValue('%pg2self', null, hooks), 'herself');
  assert.equal(getContextValue('%pcl', null, hooks), 'Iron', 'GetLastname is parts[1], not the tail');
});

test('M-X: %ltn\'s fourteen bands, %ct\'s switch with the enum-name fallback, %lp', () => {
  const rep = (v) => getContextValue('%ltn', null, { world: { legalRepNow: () => v } });
  assert.equal(rep(81), 'revered');
  assert.equal(rep(61), 'esteemed');
  assert.equal(rep(11), 'respected');
  assert.equal(rep(1), 'dependable');
  assert.equal(rep(0), 'a common citizen');
  assert.equal(rep(-81), 'hated');
  assert.equal(rep(-15), 'a scoundrel');
  assert.equal(rep(-5), 'undependable');
  const ct = (t) => getContextValue('%ct', null, { world: { currentLocationType: () => t } });
  assert.equal(ct(0), 'city');
  assert.equal(ct(8), 'manor', 'HomeWealthy is a manor, HomePoor a shack - the Internal_Strings pair');
  assert.equal(ct(11), 'shack');
  // MacroHelper.cs:617 `return gps.CurrentLocationType.ToString()` - on
  // a DEFINED DFRegion.LocationTypes member C# yields the member NAME.
  assert.equal(ct(12), 'Graveyard', 'the default: is Enum.ToString() - the member NAME');
  assert.equal(ct(4), 'DungeonLabyrinth');
  assert.equal(ct(7), 'DungeonKeep');
  assert.equal(ct(10), 'DungeonRuin');
  assert.equal(ct(13), 'Coven');
  assert.equal(ct(14), 'HomeYourShips');
  assert.equal(ct(0xffff), 'None', 'None is a defined member too');
  assert.equal(ct(99), '99', 'a value the enum does not define stringifies as its number, as C# does');
  assert.equal(getContextValue('%lp', null, { world: { currentRegionRace: () => 1 } }), 'High Rock');
  assert.equal(getContextValue('%lp', null, { world: { currentRegionRace: () => 2 } }), 'Hammerfell');

  // %cn2 - CityName2 (MacroHelper.cs:576-586). The walk finds the
  // region's first OTHER TownCity...
  const cn2 = (mapTable, mapNames, here) => getContextValue('%cn2', null, {
    world: {
      maps: { getRegion: () => ({ mapTable, mapNames }) },
      currentRegionIndex: () => 5, currentLocationIndex: () => here,
    },
  });
  assert.equal(cn2([{ locationType: 3 }, { locationType: 0 }], ['a', 'Wayrest'], -1), 'Wayrest');
  assert.equal(cn2([{ locationType: 0 }, { locationType: 0 }], ['Here', 'Wayrest'], 0), 'Wayrest',
    'never the location the player stands in');
  // ...and when it finds none it is C#'s own "Localizaed fallback in
  // case of error" (:585, GetLocalizedText("daggerfall")), NOT the
  // [nullMCP] sentinel. A region whose only TownCity is the player's
  // own takes this arm.
  assert.equal(cn2([{ locationType: 3 }, { locationType: 4 }], ['a', 'b'], -1), 'Daggerfall');
  assert.equal(cn2([{ locationType: 0 }], ['Here'], 0), 'Daggerfall');
  assert.equal(getContextValue('%cn2', null, {}), '%cn2[nullMCP]', 'no world at all is still the charter\'s null');
});

test('E-fix: %ln is GetRandomNameBank\'s random race, and needs no world', () => {
  // LastName (MacroHelper.cs:1102-1105) is Surname(GetRandomNameBank()),
  // and GetRandomNameBank (:303-308) re-seeds and rolls Races 1..8. It
  // reads NO PlayerGPS - the region-bank form is GetRandomFullName
  // (:333-341), which %ln was wrongly wearing: REGION_RACES only ever
  // yields Breton or Redguard, and Surname(Redguard) is empty
  // (NameHelper.cs:143-166), so a Hammerfell %ln answered "".
  assert.notEqual(getContextValue('%ln', null, {}), '%ln[nullMCP]',
    'the row touches no world state, so it cannot answer the sentinel');
  // The bank must not be selected by the region: with the world hook
  // pinned to a Breton region, 200 draws still span more than the
  // Breton bank - Nord surnames end in the immutable "sen", and the
  // Redguard arm mints the empty string.
  const region17 = { world: { currentRegionIndex: () => 17 } };
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(getContextValue('%ln', null, region17));
  assert.ok([...seen].some((n) => n.endsWith('sen')), 'the Nord bank is reachable from a Breton region');
  assert.ok(seen.has(''), 'and so is the Redguard bank, whose Surname arm is empty');
  // and the direct home answers a BankTypes ordinal in 0..7
  const banks = new Set();
  for (let i = 0; i < 400; i++) banks.add(getRandomNameBank());
  assert.ok(banks.size > 2, 'GetRandomNameBank spans the eight races, not one region');
  for (const b of banks) assert.ok(b >= 0 && b <= 7, 'only the eight playable races\' banks');
});

test('M-X: the error shapes hold - call-throughs, null rows, and the news pair', () => {
  // an mcp call-through with no quest lands the mcp-null arm
  assert.equal(getContextValue('%str', null, {}), '%str[nullMCP]');
  assert.equal(getContextValue('%q7b', null, {}), '%q7b[nullMCP]', 'the whole biography block is call-throughs');
  assert.equal(getContextValue('%1bm', null, {}), '%1bm[nullMCP]', 'the spell-info block too');
  // C#'s null rows render [unhandled], verbatim
  assert.equal(getContextValue('%hol', null, {}), '%hol[unhandled]');
  assert.equal(getContextValue('%wpn', null, {}), '%wpn[unhandled]');
  // the news pair reads SetFactionIdsAndRegionID's outs
  setIdFactions(41, 42);
  const world = { getFactionData: (id) => ({ 41: { name: 'The Fighters Guild', ruler: 3 }, 42: { name: 'The Thieves Guild' } }[id]) };
  assert.equal(getContextValue('%fx1', null, { world }), 'The Fighters Guild');
  assert.equal(getContextValue('%fx2', null, { world }), 'The Thieves Guild');
  assert.equal(getContextValue('%lt1', null, { world }), 'Duke', 'GetRulerTitle over the faction\'s ruler');
  // ...and TitleOfLordOfFaction1 (MacroHelper.cs:1040-1047) DISCARDS
  // GetFactionData's bool: a MISS reads the zero struct, so
  // GetRulerTitle(0) answers its default: arm. The lookup is not the
  // charter's nothing - only the absent world is.
  assert.equal(getContextValue('%lt1', null, { world: { getFactionData: () => null } }), 'Lord',
    'the discarded bool: a missing faction is the ZERO STRUCT, not the sentinel');
  assert.equal(getContextValue('%lt1', null, {}), '%lt1[nullMCP]', 'no world at all IS the charter\'s null');
  setIdFactions(-1, -1);
  assert.equal(getContextValue('%lt1', null, { world }), 'Lord',
    'idFaction1 === -1 misses the dict, and DFU still says Lord');
  assert.equal(getContextValue('%fx1', null, { world }), '%fx1[nullMCP]', 'no news yet: the charter\'s null');
  // C#'s own asymmetry: %fae speaks GetFactionNPCEnemy exactly as %fe
  const talkWorld = { factionNPCEnemy: () => 'the enemies', factionNPCAlly: () => 'the allies' };
  assert.equal(getContextValue('%fae', null, { world: talkWorld }), 'the enemies');
  assert.equal(getContextValue('%fea', null, { world: talkWorld }), 'the allies');
});
