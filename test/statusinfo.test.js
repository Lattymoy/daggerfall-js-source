// ST1 - THE RECORD-22 STATUS BOX (DaggerfallUI.DisplayStatusInfo,
// :1615-1628). The FIRST box of the Status chain: TEXT.RSC record 22
// ("You are in %cn. / It is %tim on %dat. / In the eyes of the law
// of %crn, / you are %ltn." - Internal_RSC.csv, verbatim), expanded
// through the quest arc's ONE macro table, then chained into BS1's
// health box by AddNextMessageBox.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { statusInfoRows, STATUS_INFO_ID, healthStatusRows } from '../src/systems/healthStatus.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { QuestMachine } from '../src/systems/quest/machine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

// the record's four lines, as townTalk.lines(22) hands them over
const RECORD_22 = [
  'You are in %cn.',
  'It is %tim on %dat.',
  'In the eyes of the law of %crn,',
  'you are %ltn.',
];
const rows = (id) => (id === STATUS_INFO_ID ? [...RECORD_22] : [`[${id}]`]);

const WORLD = {
  currentLocation: () => ({ loaded: true, name: 'Daggerfall' }),
  maps: { getRegion: () => ({ name: 'Betony' }) },
  currentRegionIndex: () => 17,
  legalRepNow: () => 0,
};

test('ST1: record 22 expands through the ONE macro table - all five producers land', () => {
  assert.equal(STATUS_INFO_ID, 22, 'SetTextTokens(22) (:1620)');
  // the machine's own quest-shaped context, off real deps
  const machine = new QuestMachine({
    world: WORLD,
    nowSeconds: () => 1 * 3600 + 5 * 60,   // 01:05 on day one of the calendar
    playerName: () => 'Wobbles',
  });
  const out = statusInfoRows(rows, machine.macroContext());
  assert.equal(out[0], 'You are in Daggerfall.', '%cn is the loaded location');
  assert.match(out[1], /^It is 01:05 on .+/, '%tim is MinTimeString; %dat the date law');
  assert.equal(out[2], 'In the eyes of the law of Betony,', '%crn is the current region');
  assert.equal(out[3], 'you are a common citizen.', '%ltn at rep 0');
  assert.equal(out.some((l) => l.includes('%')), false, 'no macro survives the pass');
});

test('ST1: %cn falls to the region when no location is loaded; %ltn follows the rep bands', () => {
  const ctx = (rep) => ({
    nowSeconds: () => 0,
    hooks: {
      nowSeconds: () => 0,
      world: { ...WORLD, currentLocation: () => ({ loaded: false }), legalRepNow: () => rep },
    },
  });
  assert.equal(statusInfoRows(rows, ctx(0))[0], 'You are in Betony.', 'CityName\'s wilderness arm');
  assert.equal(statusInfoRows(rows, ctx(81))[3], 'you are revered.');
  assert.equal(statusInfoRows(rows, ctx(-81))[3], 'you are hated.');
});

test('ST1: a null context leaves bracketed placeholders - the null-MCP posture, never a throw', () => {
  const out = statusInfoRows(rows, null);
  assert.match(out[0], /%cn\[nullMCP\]/);
  assert.equal(out.length, 4);
});

test('ST1: AddNextMessageBox - dismissing the status box shows the health box, the LAST dismissal closes', () => {
  const box = new ActionTextBox(['status']).addNext(['health']);
  assert.deepEqual(box.lines, ['status']);
  assert.equal(box.done, false);
  box.input();
  assert.deepEqual(box.lines, ['health'], 'the next box takes the screen (:1623-1626)');
  assert.equal(box.done, false, 'not closed yet');
  box.input();
  assert.equal(box.done, true, 'the chain\'s last dismissal closes');
  // a chainless box keeps its one-click close
  const plain = new ActionTextBox(['x']);
  plain.input();
  assert.equal(plain.done, true);
});

test('ST1: all four hosts open the CHAIN - record 22 first, the health box next', () => {
  for (const h of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    const s = src(h);
    assert.match(s, /new ActionTextBox\(statusInfoRows\((?:rows|rscLines), /, `${h} leads with record 22`);
    assert.match(s, /\.addNext\(healthStatusRows\(playerEntity, (?:rows|rscLines)\)\)/, `${h} chains the health box`);
  }
  // the three machine-bearing hosts pass the live context; the dev
  // exterior has none and says so with an explicit null
  for (const h of ['scenes/world.js', 'scenes/worldModes.js']) {
    assert.match(src(h), /questBridge\?\.machine\?\.macroContext\?\.\(\) \?\? null/, `${h} hands the machine's context`);
  }
  assert.match(src('scenes/dungeonContext.js'), /opts\.questBridge\?\.machine\?\.macroContext\?\.\(\) \?\? null/);
  assert.match(src('scenes/exterior.js'), /statusInfoRows\(rows, null\)/);
});
