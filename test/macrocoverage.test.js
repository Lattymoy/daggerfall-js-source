// M-X - THE MACRO TABLE COMPLETED + THE COVERAGE GATE the completion
// analysis asked for by name: MacroHelper.cs's own table is extracted
// and diffed against the port's, so a macro DFU adds (or one this
// port loses) fails here mechanically instead of by sweep. The gate
// needs the DFU sparse clone and SKIPS without it - the ARENA2-gate
// posture; the behavior pins below it run everywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import {
  getContextValue, macroTableCoverage, setIdFactions,
} from '../src/systems/quest/questMacros.js';
import { CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';

const DFU_MACROHELPER = new URL('../tools/parity/dfu/Assets/Scripts/Utility/MacroHelper.cs', import.meta.url);

test('M-X GATE: every macro in MacroHelper.cs has a row in the port\'s table', (t) => {
  if (!existsSync(DFU_MACROHELPER)) {
    t.skip('DFU sparse clone absent (tools/parity/prepare.sh) - the gate needs the source tree');
    return;
  }
  const mh = readFileSync(DFU_MACROHELPER, 'utf8');
  const tokens = [...new Set([...mh.matchAll(/\{\s*"(%[a-zA-Z0-9]+)",\s*(\w+)\s*\}/g)].map((m) => [m[1], m[2]]).map(JSON.stringify))].map(JSON.parse);
  assert.ok(tokens.length > 200, `the extraction found the table (${tokens.length} rows)`);
  const { handled, nulls } = macroTableCoverage();
  // DFU has ONE table; the port grew per-window expanders before the
  // table existed, so thirty-seven macros live at their consumers -
  // RECORDED here, each VERIFIED to still be in its named home so the
  // record cannot rot. Consolidating them into the one table is the
  // recorded follow-up, not a gap.
  const ELSEWHERE = {
    '%1com': 'src/scenes/townTalk.js', '%hnt': 'src/scenes/townTalk.js',
    '%key': 'src/scenes/townTalk.js', '%loc': 'src/scenes/townTalk.js',
    '%a': 'src/systems/guildServiceActions.js', '%cpn': 'src/systems/guildServiceActions.js',
    '%dwr': 'src/systems/guildServiceActions.js', '%gii': 'src/systems/guildServiceActions.js',
    '%adj': 'src/systems/itemInfo.js', '%an': 'src/systems/itemInfo.js',
    '%arm': 'src/systems/itemInfo.js', '%ba': 'src/systems/itemInfo.js',
    '%bt': 'src/systems/itemInfo.js', '%hs': 'src/systems/itemInfo.js',
    '%kg': 'src/systems/itemInfo.js', '%mat': 'src/systems/itemInfo.js',
    '%mod': 'src/systems/itemInfo.js', '%po': 'src/systems/itemInfo.js',
    '%pp1': 'src/systems/itemInfo.js', '%pp2': 'src/systems/itemInfo.js',
    '%qua': 'src/systems/itemInfo.js', '%sub': 'src/systems/itemInfo.js',
    '%wdm': 'src/systems/itemInfo.js', '%wep': 'src/systems/itemInfo.js',
    '%wth': 'src/systems/itemInfo.js',
    '%cri': 'src/scenes/arrestFlow.js', '%dip': 'src/scenes/arrestFlow.js',
    '%gtp': 'src/scenes/arrestFlow.js', '%pen': 'src/scenes/arrestFlow.js',
    '%fcn': 'src/systems/talkMacros.js', '%hnt2': 'src/systems/talkMacros.js',
    '%pqn': 'src/systems/talkMacros.js', '%pqp': 'src/systems/talkMacros.js',
    '%hnr': 'src/systems/talkSession.js',
    '%it': 'src/systems/useItem.js',
    '%map': 'src/scenes/world.js',
    '%tcn': 'src/ui/travelMapWindow.js',
  };
  for (const [tok, home] of Object.entries(ELSEWHERE)) {
    assert.ok(readFileSync(new URL(`../${home}`, import.meta.url), 'utf8').includes(`'${tok}'`) || readFileSync(new URL(`../${home}`, import.meta.url), 'utf8').includes(tok),
      `${tok} claims ${home} as its home and is not there`);
  }
  const covered = new Set([...handled, ...nulls, ...Object.keys(ELSEWHERE)]);
  const missing = tokens.filter(([tok]) => !covered.has(tok)).map(([tok]) => tok);
  assert.deepEqual(missing, [], 'every C# row is handled, null-handled, or recorded at its home');
  // and the C#-null rows are OUR null rows - a port handler standing
  // where C# has null would be an invention, not a port. (%tcn is the
  // one recorded exception: C# nulls it, the port's talk arc
  // implemented the town-name read the comment describes.)
  const csNulls = tokens.filter(([, h]) => h === 'null').map(([tok]) => tok);
  const invented = csNulls.filter((tok) => handled.includes(tok) && tok !== '%tcn');
  assert.deepEqual(invented, [], 'no handler stands where C# has null');
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
  assert.equal(getContextValue('%year', null, dateHooks), '0');
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
  assert.equal(ct(12), '12', 'the default: falls to the enum value\'s own string');
  assert.equal(getContextValue('%lp', null, { world: { currentRegionRace: () => 1 } }), 'High Rock');
  assert.equal(getContextValue('%lp', null, { world: { currentRegionRace: () => 2 } }), 'Hammerfell');
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
  setIdFactions(-1, -1);
  assert.equal(getContextValue('%fx1', null, { world }), '%fx1[nullMCP]', 'no news yet: the charter\'s null');
  // C#'s own asymmetry: %fae speaks GetFactionNPCEnemy exactly as %fe
  const talkWorld = { factionNPCEnemy: () => 'the enemies', factionNPCAlly: () => 'the allies' };
  assert.equal(getContextValue('%fae', null, { world: talkWorld }), 'the enemies');
  assert.equal(getContextValue('%fea', null, { world: talkWorld }), 'the allies');
});
