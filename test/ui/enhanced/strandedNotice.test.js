// STRANDED on the Online door (bible/06-Systems/Realm-Arc.md): a save this device set aside is said APART from the
// tile's own buttons - one sentence and one button, the tile's notice line (ui/saveTile.js `notice`) - and its button
// asks before anything is copied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  strandedNotice, strandedNoteText, strandedRecoverLabel, strandedAskTitle, strandedAskBody,
} from '../../../src/ui/enhanced/strandedNotice.js';

test('the notice says it, and its one button asks - the copy runs only on the yes', () => {
  const asked = [];
  let recovered = 0;
  const notice = strandedNotice({ name: 'Audra', busy: false, ask: (...question) => asked.push(question), recover: () => { recovered += 1; } });
  assert.equal(notice.say, strandedNoteText());
  assert.equal(notice.actions.length, 1);
  const [button] = notice.actions;
  assert.equal(button.label, strandedRecoverLabel());
  assert.equal(button.disabled, false);
  button.onClick();
  assert.equal(recovered, 0, 'the press asks; it copies nothing itself');
  assert.equal(asked.length, 1);
  const [title, body, yes, onYes] = asked[0];
  assert.deepEqual([title, body, yes], [strandedAskTitle('Audra'), strandedAskBody('Audra'), strandedRecoverLabel()]);
  onYes();
  assert.equal(recovered, 1, 'and the yes recovers it');
  assert.equal(strandedNotice({ name: 'Audra', busy: true, ask: () => {}, recover: () => {} }).actions[0].disabled, true, 'busy, as the tile\'s buttons are');
});

test('the words say what is copied, what it becomes and what does not change - English here', () => {
  assert.equal(strandedNoteText(), 'This device has progress for this character that never reached the realm.');
  assert.equal(strandedRecoverLabel(), 'Recover it');
  assert.equal(strandedAskTitle('Audra'), 'Recover Audra’s unsaved progress?');
  assert.equal(strandedAskBody('Audra'), 'This device kept progress for Audra that never reached the realm. It will be copied as a new offline character. Your online character does not change, and nothing you play on the copy comes back online.');
});
