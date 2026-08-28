// MH1 - THE ONE MACRO WALK. MacroHelper is one file in DFU; the port
// had grown a third, lawless path beside its two real tables -
// replaceAll chains in talkSession, guildServiceActions and
// arrestFlow, each window rediscovering its two or three symbols.
// expandMacroValues (questMacros.js, the MacroHelper home) is the
// walk they all ride now: maximal-munch %\w+ with EXACT symbol
// lookup in the caller's value map, falling to the CONTEXT HANDLERS
// when a questLike context rides in, else verbatim.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expandMacroValues } from '../src/systems/quest/questMacros.js';
import { expandMacros, expandAnswerRecord } from '../src/systems/talkSession.js';
import { expandGuildMacros } from '../src/systems/guildServiceActions.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

// ---------------------------------------------------------------
// 1. THE WALK'S LAWS
// ---------------------------------------------------------------

test('MH1: exact-symbol expansion, punctuation surviving outside the token', () => {
  assert.equal(expandMacroValues('Hail, %pcn. Welcome to %cn!', { pcn: 'Wobbles', cn: 'Daggerfall' }),
    'Hail, Wobbles. Welcome to Daggerfall!');
  assert.equal(expandMacroValues(null, { pcn: 'x' }), '', 'null text answers empty, never throws');
});

test('MH1: maximal munch retires the %a-inside-%adj corruption the chains carried', () => {
  // the legacy replaceAll('%a', '100') would have produced
  // '100dj shirt for 100 gold' - the walk matches %adj WHOLE, misses
  // the map, and leaves it alone
  assert.equal(expandMacroValues('%adj shirt for %a gold', { a: '100' }),
    '%adj shirt for 100 gold');
  assert.equal(expandMacroValues('%hnt2 then %hnt', { hnt: 'east' }),
    '%hnt2 then east', 'and %hnt2 is not %hnt');
});

test('MH1: a NULL value leaves its token verbatim - the legacy if-guards, kept as a law', () => {
  assert.equal(expandMacroValues('%dwr hours left', { dwr: null }), '%dwr hours left');
  assert.equal(expandMacroValues('%mystery stays', {}), '%mystery stays', 'unknown symbols stay verbatim');
});

test('MH1: a function value is LAZY - called per occurrence, never for an absent symbol', () => {
  let calls = 0;
  const boom = () => { throw new Error('must not run'); };
  assert.equal(expandMacroValues('%gii and %gii', { gii: () => { calls++; return '42'; }, cri: boom }),
    '42 and 42');
  assert.equal(calls, 2);
});

test('MH1: the CONTEXT HANDLERS answer through a questLike context, and the value map SHADOWS them', () => {
  const ctx = { nowSeconds: () => 0, hooks: { nowSeconds: () => 0, world: { legalRepNow: () => 0 } } };
  assert.equal(expandMacroValues('you are %ltn.', {}, ctx), 'you are a common citizen.',
    "the quest table's %ltn resolves at a window with the machine's context");
  assert.equal(expandMacroValues('you are %ltn.', { ltn: 'the boss' }, ctx), 'you are the boss.',
    "the caller's own value wins - its MCP outranks the statics, DFU's GetValue order");
  assert.equal(expandMacroValues('you are %ltn.', {}), 'you are %ltn.',
    'and with no context the token stays verbatim - these windows never printed [undefined]');
});

// ---------------------------------------------------------------
// 2. THE ADAPTERS - same answers, one walk
// ---------------------------------------------------------------

test('MH1: talkSession rides the walk - the greeting and answer sets unchanged', () => {
  assert.equal(expandMacros('%pcf... %pcn of %cn, %oth!', { playerName: 'Wobbles Bag', oath: 'by Ysmir', cityName: 'Wayrest' }),
    'Wobbles... Wobbles Bag of Wayrest, by Ysmir!');
  assert.equal(
    expandAnswerRecord('%hnr, %key is %hnt, %ra.', { hint: 'east of here', key: 'The Rusty Ogre', honorific: "Ma'am", race: 'Dark Elf' }),
    "Ma'am, The Rusty Ogre is east of here, Dark Elf.");
});

test('MH1: expandGuildMacros rides the walk - supplied values land, absent ones stay verbatim', () => {
  assert.equal(
    expandGuildMacros('%god asks %a gold; you carry %gii. %dwr hours, %cpn.', { amount: 200, gold: 150, god: 'Kynareth' }),
    'Kynareth asks 200 gold; you carry 150. %dwr hours, %cpn.');
  assert.equal(expandGuildMacros('Good day, %ra.', { race: 'Nord' }), 'Good day, Nord.');
  // the retired corruption, proven through the REAL adapter
  assert.equal(expandGuildMacros('%adj wares: %a gold', { amount: 9 }), '%adj wares: 9 gold');
});

test('MH1: the leak sites are GONE - no ad-hoc %-replaceAll chain outside the recorded surfaces', () => {
  for (const f of ['systems/talkSession.js', 'systems/guildServiceActions.js', 'scenes/arrestFlow.js']) {
    assert.equal(/replaceAll\('%/.test(src(f)), false, `${f} rides the one walk`);
  }
  assert.match(src('scenes/arrestFlow.js'), /return expandMacroValues\(t, \{/, 'the court records ride it too');
  // what deliberately REMAINS: itemInfo/useItem are the ITEM MCP
  // surface (IM1's recorded design), buildingNames is
  // BuildingNames.cs's OWN expander (not MacroHelper), and townTalk's
  // three are the talk pipeline's lazy side-effect slots.
});
