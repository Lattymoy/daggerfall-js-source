// AUDIT 17h: the parity pass over S3e (biography) and U13 (reflexes +
// backstory). Every pin fails under a one-character mutation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { applyBiographyEffects } from '../src/systems/biography.js';
import { getReactionToPlayer } from '../src/systems/talk.js';
import { enchantmentMagicRound } from '../src/systems/enchantments.js';
import { SOCIAL_GROUP_COUNT } from '../src/formats/factionFile.js';
import { playerEntity } from '../src/characters/playerEntity.js';
import { SKILL_COUNT } from '../src/systems/skills.js';

const read = (f) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', f), 'utf8');

const player = () => ({ stats: {}, skills: new Array(SKILL_COUNT).fill(30), items: [], gender: 'male', race: 'Breton' });

test('17h F1: a save carries the social-group REPUTATIONS', () => {
  // SerializablePlayer.cs:152-162 writes all eleven out field by
  // field. Nothing persisted them, so a quicksave/load reset the
  // player's standing with every social group to ZERO - and
  // getReactionToPlayer reads them on every greeting.
  const e = player();
  applyBiographyEffects(e, ['r0 -5', 'r2 +5', 'r3 +5']);
  e.reactionMods[1] = 7;   // a live-effect mod (applyRepMod / the Masque) - not persisted, AUDIT 65 SL-4
  assert.deepEqual(e.sGroupReputations.slice(0, 4), [-5, 0, 5, 5]);

  const loaded = {};
  const snap = snapshotPlayer(e);
  const extras = restorePlayer(loaded, snap);
  assert.ok(extras, 'the snapshot restores');
  assert.deepEqual(loaded.sGroupReputations, e.sGroupReputations);
  // AUDIT 65 SL-4: and NOT the reaction mods. PlayerEntity.cs:128-129
  // declares them "do not serialize, set by live effects" and
  // SerializablePlayer.cs:152-162 answers only the eleven reputations,
  // so the envelope holds no key and the restore lands no array - the
  // live 7 above is a live-effect mod and stays on the live entity.
  assert.equal('reactionMods' in snap, false, 'the envelope does not carry the mods');
  assert.equal(loaded.reactionMods, undefined, 'and the restore never writes them onto the entity');

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
  assert.equal(snap.reactionMods, undefined, 'AUDIT 65 SL-4: the mods are not in the envelope at all - nothing to detach');
});

test('17h F1: a PRE-17h save leaves the entity\'s own state alone', () => {
  // The additive-field shape DFU's serializer gives missing members:
  // an old snapshot has no reputation keys, and a fresh entity starts
  // every group at zero - classic's own starting state.
  const e = player();
  applyBiographyEffects(e, ['r0 -5']);
  const snap = snapshotPlayer(e);
  delete snap.sGroupReputations;
  delete snap.pendingFactionRep;
  delete snap.backStory;
  const loaded = { sGroupReputations: [1, 2, 3] };
  restorePlayer(loaded, snap);
  assert.deepEqual(loaded.sGroupReputations, [1, 2, 3], 'not wiped by an old save');
});

test('65 SL-4: reactionMods leaves the envelope - a five-wide legacy key never reaches the entity, and the next magic round re-derives the eleven', () => {
  // PlayerEntity.cs:128-129: `const int socialGroupCount = 11; int[]
  // reactionMods = new int[socialGroupCount];  // ... do not serialize,
  // set by live effects` - and no SerializablePlayer member answers it.
  // The port carried it under the REPUTATIONS' cite, and a snapshot
  // minted before AUDIT 63 F6 holds a FIVE-wide array; the restore
  // wrote that width straight back, and ClearReactionMods' fill(0)
  // preserves a length, so the Masque of Clavicus (bounded by
  // mods.length) buffed five groups forever after.
  const legacy = { ...snapshotPlayer(player()), reactionMods: [0, 0, 0, 0, 0] };

  // (1) the live array is left alone - the width never lands. The
  // eleven comes from the REAL producer, not a hand-built literal:
  // ClearReactionMods at the head of every magic round.
  const live = player();
  live.isPlayer = true;
  enchantmentMagicRound(live, 1);
  assert.equal(live.reactionMods.length, SOCIAL_GROUP_COUNT, 'the producer mints DFU\'s width');
  live.reactionMods[7] = 3;
  restorePlayer(live, legacy);
  assert.equal(live.reactionMods.length, SOCIAL_GROUP_COUNT, 'the five-wide envelope value never reaches the live array');
  assert.equal(live.reactionMods[7], 3, 'and the live mods stand, as DFU\'s PlayerEntity.Reset leaves them standing');

  // (2) on an entity that has none, one magic round re-derives them
  // eleven wide - ClearReactionMods at the head of DoMagicRound
  // (PlayerEntity.cs:1567-1570 / enchantments.js:825), off worldTick.
  const fresh = player();
  fresh.isPlayer = true;
  restorePlayer(fresh, legacy);
  assert.equal(fresh.reactionMods, undefined, 'the restore lands no array at all');
  enchantmentMagicRound(fresh, 1);
  assert.deepEqual([...fresh.reactionMods], new Array(SOCIAL_GROUP_COUNT).fill(0), 'the next magic round mints DFU\'s eleven');

  // (3) and with the member out of the envelope, the ABSENT state is
  // reachable after a boot load, so the eleven-wide guarantee comes
  // from the constructor the way DFU's field initializer does
  // (PlayerEntity.cs:128-129; Reset() at :794-819 does not clear it).
  assert.equal(playerEntity.reactionMods.length, SOCIAL_GROUP_COUNT, 'the shared entity is BUILT with the eleven');

  // (4) the source: REP_ARRAYS names the reputations ALONE
  assert.match(read('src/systems/save.js'), /^const REP_ARRAYS = \['sGroupReputations'\];$/m,
    'SerializablePlayer.cs:152-162 is the reputations\' cite and nothing else\'s');
  assert.doesNotMatch(read('src/systems/classicSave.js'), /^\s*reactionMods:/m,
    'and the classic import mints no snapshot key nothing reads');
});
