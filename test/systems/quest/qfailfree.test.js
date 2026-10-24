// QFAIL-FREE (2026-10-02, Mac: "Soften failure cost"): online a quest that ends unfinished costs its faction nothing -
// TIME3 put the countdowns on the character's clock, so journeys and rests spend them, and DFU's propagated -2 bled
// every standing a player held. Offline DFU's -2 stands; a success's +5 is DFU's on both lanes.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quest } from '../../../src/systems/quest/quest.js';

function ended({ online, success }) {
  const reps = [];
  const q = new Quest({ hooks: { sharedClock: () => online, changeReputation: (f, a, p) => reps.push([f, a, p]) } });
  q.factionId = 42;
  q.questSuccess = success;
  q.endQuest();
  return reps;
}

test('offline a failed quest costs DFU\'s -2, propagated', () => {
  assert.deepEqual(ended({ online: false, success: false }), [[42, -2, true]]);
});

test('online a failed quest costs its faction nothing', () => {
  assert.deepEqual(ended({ online: true, success: false }), []);
});

test('a success pays DFU\'s +5 on both lanes', () => {
  assert.deepEqual(ended({ online: false, success: true }), [[42, 5, true]]);
  assert.deepEqual(ended({ online: true, success: true }), [[42, 5, true]]);
});
