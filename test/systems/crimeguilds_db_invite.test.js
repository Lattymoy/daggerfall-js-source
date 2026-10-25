// A failed startQuestByName must never consume the Dark Brotherhood's one-time invitation.
// The Thieves Guild branch is intentionally unchanged in this fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleStartingCrimeGuildQuests,
  setCrimeGuildQuestHost,
  INVITE_SENT,
  THIEVES_GUILD_INITIATION_QUEST,
  DARK_BROTHERHOOD_INITIATION_QUEST,
  DARK_BROTHERHOOD_FACTION_ID,
} from '../../src/systems/crimeGuilds.js';

const NOW = 100000;
const due = () => ({
  darkBrotherhoodRequirementTally: 15,
  timeForDarkBrotherhoodLetter: NOW,
});
const tick = (entity) => handleStartingCrimeGuildQuests(entity, {
  nowClassicMinutes: NOW + 1,
  inside: false,
});

test('Dark Brotherhood: null quest parse keeps the invitation pending until a successful start', () => {
  const entity = due();
  const attempts = [];
  const previous = setCrimeGuildQuestHost({
    startQuest: (name, factionId) => {
      attempts.push([name, factionId]);
      return null;
    },
  });
  try {
    assert.deepEqual(tick(entity), []);
    assert.deepEqual(attempts, [[DARK_BROTHERHOOD_INITIATION_QUEST, DARK_BROTHERHOOD_FACTION_ID]]);
    assert.equal(entity.darkBrotherhoodRequirementTally, 15);
    assert.equal(entity.timeForDarkBrotherhoodLetter, NOW);

    setCrimeGuildQuestHost({ startQuest: (name) => ({ questName: name }) });
    assert.deepEqual(tick(entity), [DARK_BROTHERHOOD_INITIATION_QUEST]);
    assert.equal(entity.darkBrotherhoodRequirementTally, INVITE_SENT);
    assert.equal(entity.timeForDarkBrotherhoodLetter, 0);
    assert.deepEqual(tick(entity), [], 'a successful start is never repeated');
  } finally {
    setCrimeGuildQuestHost(previous);
  }
});

test('Dark Brotherhood: an exception also keeps the invitation pending', () => {
  const entity = due();
  const previous = setCrimeGuildQuestHost({
    startQuest: () => { throw new Error('Remote site lookup failed'); },
  });
  try {
    assert.deepEqual(tick(entity), []);
    assert.equal(entity.darkBrotherhoodRequirementTally, 15);
    assert.equal(entity.timeForDarkBrotherhoodLetter, NOW);

    setCrimeGuildQuestHost({ startQuest: () => ({ questName: DARK_BROTHERHOOD_INITIATION_QUEST }) });
    assert.deepEqual(tick(entity), [DARK_BROTHERHOOD_INITIATION_QUEST]);
    assert.equal(entity.darkBrotherhoodRequirementTally, INVITE_SENT);
  } finally {
    setCrimeGuildQuestHost(previous);
  }
});

test('Thieves Guild: valid invitations still start when a Dark Brotherhood parse fails', () => {
  const entity = {
    ...due(),
    thievesGuildRequirementTally: 10,
    timeForThievesGuildLetter: NOW,
  };
  const previous = setCrimeGuildQuestHost({
    startQuest: (name) => name === THIEVES_GUILD_INITIATION_QUEST ? { questName: name } : null,
  });
  try {
    assert.deepEqual(tick(entity), [THIEVES_GUILD_INITIATION_QUEST]);
    assert.equal(entity.thievesGuildRequirementTally, INVITE_SENT);
    assert.equal(entity.timeForThievesGuildLetter, 0);
    assert.equal(entity.darkBrotherhoodRequirementTally, 15);
    assert.equal(entity.timeForDarkBrotherhoodLetter, NOW);
  } finally {
    setCrimeGuildQuestHost(previous);
  }
});
