// AUDIT 17h: the parity pass over S3e (biography) and U13 (reflexes +
// backstory). Every pin fails under a one-character mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { applyBiographyEffects } from '../src/systems/biography.js';
import { getReactionToPlayer } from '../src/systems/talk.js';
import { SKILL_COUNT } from '../src/systems/skills.js';

const player = () => ({ stats: {}, skills: new Array(SKILL_COUNT).fill(30), items: [], gender: 'male', race: 'Breton' });

test('17h F1: a save carries the social-group REPUTATIONS', () => {
  // SerializablePlayer.cs:152-162 writes all eleven out field by
  // field. Nothing persisted them, so a quicksave/load reset the
  // player's standing with every social group to ZERO - and
  // getReactionToPlayer reads them on every greeting.
  const e = player();
  applyBiographyEffects(e, ['r0 -5', 'r2 +5', 'r3 +5']);
  e.reactionMods[1] = 7;   // the T3f tone tally writes here
  assert.deepEqual(e.sGroupReputations.slice(0, 4), [-5, 0, 5, 5]);

  const loaded = {};
  const extras = restorePlayer(loaded, snapshotPlayer(e));
  assert.ok(extras, 'the snapshot restores');
  assert.deepEqual(loaded.sGroupReputations, e.sGroupReputations);
  assert.deepEqual(loaded.reactionMods, e.reactionMods);

  // and the consumer sees the same greeting after a round trip
  const faction = { rep: 0, sgroup: 2 };
  assert.equal(getReactionToPlayer(faction, loaded), getReactionToPlayer(faction, e));
  assert.equal(getReactionToPlayer(faction, loaded), 5, 'a Scholars +5 really is +5 after loading');
});

test('17h F1: a save carries the six BIOGRAPHY modifiers', () => {
  // SerializablePlayer.cs:136-141 / :305-310.
  const e = player();
  applyBiographyEffects(e, ['RP -10', 'FT -5', 'RR -5', 'RD -5', 'MR -5', 'TH -5']);
  const loaded = {};
  restorePlayer(loaded, snapshotPlayer(e));
  for (const f of ['biographyResistPoisonMod', 'biographyFatigueMod', 'biographyReactionMod',
    'biographyResistDiseaseMod', 'biographyResistMagicMod', 'biographyAvoidHitMod']) {
    assert.equal(loaded[f], e[f], f);
  }
  // the reaction modifier reaches the greeting through the load too
  assert.equal(getReactionToPlayer({ rep: 0, sgroup: -1 }, loaded), -5);
});

test('17h F1: the queued faction deltas and the backstory survive', () => {
  const e = player();
  applyBiographyEffects(e, ['rf42 +5', 'rf7 -2']);
  e.backStory = ['line one', 'line two'];
  const loaded = {};
  restorePlayer(loaded, snapshotPlayer(e));
  assert.deepEqual(loaded.pendingFactionRep, [{ id: 42, amount: 5 }, { id: 7, amount: -2 }]);
  assert.deepEqual(loaded.backStory, ['line one', 'line two']);
  // and the SNAPSHOT detaches - the quicksave write happens after
  // snapshotPlayer returns, so a snapshot that shares the entity's
  // objects mutates under the writer (the same law save.js already
  // states for the nested activeEffects entries)
  const snap = snapshotPlayer(e);
  e.pendingFactionRep[0].amount = 999;
  e.backStory.push('line three');
  e.sGroupReputations[0] = 42;
  e.reactionMods[0] = 42;
  assert.equal(snap.pendingFactionRep[0].amount, 5, 'the queued deltas detach');
  assert.equal(snap.backStory.length, 2, 'the backstory detaches');
  assert.notEqual(snap.sGroupReputations[0], 42, 'the reputations detach');
  assert.notEqual(snap.reactionMods[0], 42);
});

test('17h F1: a PRE-17h save leaves the entity\'s own state alone', () => {
  // The additive-field shape DFU's serializer gives missing members:
  // an old snapshot has no reputation keys, and a fresh entity starts
  // every group at zero - classic's own starting state.
  const e = player();
  applyBiographyEffects(e, ['r0 -5']);
  const snap = snapshotPlayer(e);
  delete snap.sGroupReputations;
  delete snap.reactionMods;
  delete snap.pendingFactionRep;
  delete snap.backStory;
  const loaded = { sGroupReputations: [1, 2, 3], reactionMods: [4, 5, 6] };
  restorePlayer(loaded, snap);
  assert.deepEqual(loaded.sGroupReputations, [1, 2, 3], 'not wiped by an old save');
  assert.deepEqual(loaded.reactionMods, [4, 5, 6]);
});
