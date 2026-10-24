// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 12): THE KETCH'S WORDS ON THIS SCREEN - the stages' names in
// the order a crew takes them, the map card's line counted in days, hours or minutes (a minute begun counts), the relay's
// refusals read back key for key, the Warden's phases, blows and the constructs named by their keys - and every one read
// through the text core WHEN IT IS READ, so a language chosen after the game loaded is the one shown.
// tools/mutants/ketch_words.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KT_WORDS, KT_REFUSE_WORDS, ketchRefusal, ketchStageName, ketchPhaseName, ketchBlowName, ketchKindName, ketchWhen, ketchWhenLine,
  ketchSkyPhase,
} from '../../../src/systems/ketch/ketchWords.js';
import { KT_STAGES, KT_STAGE, KT_TEXT, ketchVoyageOf } from '../../../src/net/ketch/ketchLaw.js';
import { KW_BLOWS, KW_PHASE_AT } from '../../../src/net/ketch/ketchWarden.js';
import { KT_KINDS } from '../../../src/net/ketch/ketchConstructs.js';
import { setLocale, patchLocaleTable, clearLocaleTables } from '../../../src/systems/textManager.js';

const H = 3600 * 1000;

test('KETCH THE STAGES\' NAMES: the Watch, the Gallery, the Engine, the Sailwalk, the Warden, the Cabin - each by its number, nothing past them (mutants: two stages swapped)', () => {
  assert.deepEqual(KT_STAGES.map((k) => ketchStageName(KT_STAGE[k])), ['The Boarding Watch', 'The Gallery of Hammers', 'The Starved Engine', 'The Sailwalk', 'The Tonal Warden', 'The Ketchmaster\'s Cabin']);
  assert.equal(ketchStageName(6), '');
  assert.equal(ketchStageName(-1), '');
});

test('KETCH THE MAP CARD\'S LINE: sighted in, arrives in, over Daggerfall with what is left, weighing anchor - counted in days, hours or minutes, under her phase (mutants: the docked line counting to her end; minutes rounded down)', () => {
  const v = ketchVoyageOf(1);
  assert.equal(ketchWhenLine(ketchVoyageOf(0).sightAt - 2 * 24 * H - 3 * H), 'sighted in 2d 3h');   // PIN MOVED (KETCH-EVERY): days only before her first voyage - after it, ten hours a round, a sighting is never a day off
  assert.equal(ketchWhenLine(v.sightAt + 20 * 60 * 1000), 'arrives in 40m');   // PIN MOVED (KETCH-EVERY): sighted an hour before, no longer two
  assert.equal(ketchWhenLine(v.sightAt - 90 * 60 * 1000), 'sighted in 1h 30m', 'between two voyages');
  assert.equal(ketchWhenLine(v.departAt - 5 * 60 * 1000 + 1), 'over Daggerfall, 5m left');
  assert.equal(ketchWhenLine(v.departAt + 60 * 1000), 'weighing anchor, 19m');
  assert.equal(ketchWhen({ ...v, phase: 'docked' }, v.departAt - 61 * 1000), '2m', 'a minute begun counts');
  assert.deepEqual(['sighted', 'docked', 'departing'].map(ketchSkyPhase), ['Sighted in the east', 'Keeping station over the fields', 'Weighing anchor']);
});

test('KETCH THE DOOR\'S REFUSALS: each the relay says read back in the player\'s words, key for key; a word the page does not know passed as it came (mutants: a refusal unread)', () => {
  for (const [k, en] of Object.entries(KT_TEXT.refuse)) assert.equal(ketchRefusal(en), KT_REFUSE_WORDS[k], k);
  assert.equal(ketchRefusal('kt before hello'), 'kt before hello');
  for (const k of ['busy', 'offline', 'away']) assert.ok(KT_REFUSE_WORDS[k].length > 0, `the page's own ${k}`);
});

test('KETCH THE WARDEN AND THE CONSTRUCTS NAMED BY KEY: three phases (one more than its two turns), every blow it has, every kind the deck stands, and the Warden itself - nothing for an unknown key', () => {
  assert.deepEqual([1, 2, 3].map(ketchPhaseName), ['The Steersman', 'The Discord', 'The Last Note']);
  assert.equal(KW_PHASE_AT.length + 1, 3);
  assert.deepEqual([ketchPhaseName(0), ketchPhaseName(4)], ['', '']);
  for (const B of Object.values(KW_BLOWS)) assert.ok(ketchBlowName(B.key), B.key);
  assert.equal(ketchBlowName('song'), 'The Keel-Song');
  for (const K of Object.values(KT_KINDS)) assert.ok(ketchKindName(K.key), K.key);
  assert.deepEqual([ketchKindName('tonal'), ketchBlowName('toString'), ketchKindName('constructor')], ['The Tonal Warden', '', '']);
});

test('KETCH READ WHEN IT IS READ: a language chosen after the game loaded is the one every line says - the voyage\'s, the door\'s, a stage\'s, the map card\'s (mutants: a word read at import)', () => {
  try {
    patchLocaleTable('xx', 'Port_Strings', [
      ['ketch.name', 'Das Himmelsschiff'], ['ketch.refuse.full', 'Voll.'], ['ketch.stage.engine', 'Die Maschine'],
      ['ketch.left.docked', 'noch {w}'], ['ketch.when.minutes', '{m} Min.'], ['ketch.blow.keel', 'Kielschlag'],
    ]);
    setLocale('xx');
    const v = ketchVoyageOf(1);
    assert.equal(KT_WORDS.name, 'Das Himmelsschiff');
    assert.equal(ketchRefusal(KT_TEXT.refuse.full), 'Voll.');
    assert.equal(ketchStageName(KT_STAGE.engine), 'Die Maschine');
    assert.equal(ketchWhenLine(v.departAt - 5 * 60 * 1000 + 1), 'noch 5 Min.');
    assert.equal(ketchBlowName('keel'), 'Kielschlag');
  } finally { setLocale('en'); clearLocaleTables('xx'); }
  assert.equal(KT_WORDS.name, 'The Sky-Ketch Mzunthar', 'English again');
});
