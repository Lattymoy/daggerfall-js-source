// MACRO1 (2026-09-22, Discord - kurkku: "this prompt doesn't show the
// location name properly", over "Do you wish to access your wagon and
// stay in %cn?").
//
// DFU's message boxes take TEXT.RSC through SetTextTokens, which runs
// MacroHelper over every record, so a %code never reaches the screen.
// The dungeon host's one reader, `rscLines`, handed the raw record on.
// These pins drive THAT reader - lifted off the source, as the relay's
// `_named` is in identitytoken.test.js, so the day it changes this is
// driving the new one - with a fake TEXT.RSC and a real macro walk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expandMacros } from '../src/systems/talkSession.js';

const SRC = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');

function readerFor({ records, dfLocation, playerEntity }) {
  const start = SRC.indexOf('  const rscLines = (id) => {');
  assert.ok(start > 0, 'dungeonContext.js no longer has rscLines - this pin drives nothing');
  const end = SRC.indexOf('\n  };', start) + 5;
  const body = SRC.slice(start, end);
  const textRsc = { plainText: (id) => (records[id] ? [records[id]] : null) };
  return new Function('textRsc', 'expandMacros', 'dfLocation', 'playerEntity', `${body}\nreturn rscLines;`)(textRsc, expandMacros, dfLocation, playerEntity);
}

test('MACRO1: the wagon prompt names the place - %cn is the dungeon\'s own location, as MacroHelper.CityName answers inside one', () => {
  const rscLines = readerFor({
    records: { 38: 'Do you wish to access your wagon\nand stay in %cn?' },
    dfLocation: { name: 'Castle Wayrest', regionName: 'Wayrest' },
    playerEntity: { name: 'Nystul' },
  });
  assert.deepEqual(rscLines(38), ['Do you wish to access your wagon', 'and stay in Castle Wayrest?']);
});

test('MACRO1: off a location the region stands in, the player\'s name expands, and a code with no producer stays verbatim', () => {
  const rscLines = readerFor({
    records: { 1: '%cn', 2: '%pcn and %pcf', 3: 'a %zzz stays' },
    dfLocation: { name: '', regionName: 'Glenumbra Moors' },
    playerEntity: { name: 'Nystul Arcanist' },
  });
  assert.deepEqual(rscLines(1), ['Glenumbra Moors']);
  assert.deepEqual(rscLines(2), ['Nystul Arcanist and Nystul']);
  assert.deepEqual(rscLines(3), ['a %zzz stays'], 'unknown symbols are left for whoever owns them');
  assert.equal(rscLines(99), null, 'a missing record is still null, not an empty box');
});
