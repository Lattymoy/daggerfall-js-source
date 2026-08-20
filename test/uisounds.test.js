// The UI one-shots. The windows were entirely silent - zero playOneShot
// calls in all of src/ui - while DFU's windows click, roll and clink.
// These pins spy on the audio singleton (headless: _ensureCtx disables
// itself without a window, so the real playOneShot is a no-op anyway)
// and pin the two headline sounds plus the enum values, so a renumber
// or an unwired regression fails loudly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { messageBoxHit } from '../src/ui/messageBox.js';
import { ChargenFlow } from '../src/ui/chargen.js';

function capturePlays(fn) {
  const played = [];
  const orig = audio.playOneShot;
  audio.playOneShot = (i) => { played.push(i); return 0.1; };
  try { fn(); } finally { audio.playOneShot = orig; }
  return played;
}

test('UI sounds: the SoundClips values are DFU verbatim', () => {
  // SoundClips.cs - enum values = DAGGER.SND record indices.
  assert.equal(SOUND.Ignite, 16);
  assert.equal(SOUND.LevelUp, 96);
  assert.equal(SOUND.DiceRoll, 300);
  assert.equal(SOUND.ButtonClick, 360);
  assert.equal(SOUND.GoldPieces, 361);
  assert.equal(SOUND.PageTurn, 362);
  assert.equal(SOUND.ParchmentScratching, 363);
  assert.equal(SOUND.SelectClassDrums, 374);
  assert.equal(SOUND.OpenBook, 384);
});

test('UI sounds: a message-box button hit clicks; a miss stays silent', () => {
  // DaggerfallMessageBox.ButtonClickHandler (:487) plays ButtonClick
  // for EVERY popup button - messageBoxHit is the one funnel here.
  const box = { buttons: [{ button: 3, rect: [0, 0, 32, 16] }] };
  const played = capturePlays(() => {
    assert.equal(messageBoxHit(box, 5, 5), 3);
    assert.equal(messageBoxHit(box, 100, 100), null);
  });
  assert.deepEqual(played, [SOUND.ButtonClick]);
});

test('UI sounds: the chargen stats roll rides DiceRoll, and the memo restore stays silent', () => {
  // StatsRollout.Reroll (:180) - the entry roll and the Reroll button
  // both roll the dice; a push that restores a memoized roll does not.
  const career = { hitPointsPerLevel: 8, primarySkills: [], majorSkills: [], minorSkills: [] };
  const flow = new ChargenFlow([{ name: 'Warrior', career }], () => 0);
  flow.classIndex = 0;   // career is a getter over the pick
  const played = capturePlays(() => {
    flow._enterStats();          // first entry rolls
    flow._enterStats();          // memoized: no roll, no dice
    flow._enterStats(true);      // the Reroll button rolls again
  });
  assert.deepEqual(played, [SOUND.DiceRoll, SOUND.DiceRoll]);
});
