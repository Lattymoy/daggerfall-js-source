// RENOWN3 (2026-09-25, Mac: "Whats the solution to this? Like a high level character shouldnt blow through online
// levels" - and, offered a foe read at most three levels above the character's Renown, "Yes"): A FOE PAYS BY YOUR
// RENOWN. A career foe stands at the character's own Daggerfall level and a quest is sized to it, so a character that
// levelled offline fought level-30 foes from its first minute online and took Renown 10 in 19 kills. Both are now read
// no higher than RENOWN_OVER_MAX above the character's Renown (net/renown.js renownCeiling), which rises with every
// level; a character new to Daggerfall fights at or under the ceiling almost from its first kill and earns what it did.
// `06-Systems/Accounts-And-Cloud-Saves-Arc.md` RENOWN3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RENOWN_OVER_MAX, RENOWN_MAX, renownCeiling, renownKillXp, renownQuestXp, renownPartyXp, renownForXp,
} from '../src/net/renown.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Kills to reach Renown `to`, every foe at level `foe`, each kill read against the Renown the character has then. */
const killsTo = (to, foe) => {
  let xp = 0, n = 0;
  while (renownForXp(xp) < to) { xp += renownKillXp(foe, renownForXp(xp)); n++; }
  return n;
};

test('RENOWN3 the ceiling: a foe and a quest are read at most RENOWN_OVER_MAX (3) levels above the character\'s Renown - a Renown not known yet is Renown 1, the strictest; a foe under the ceiling is read as it is; past Renown 27 nothing a foe can be is cut (mutants: the ceiling unread for a kill; unread for a quest; an unknown Renown read as the cap; the ceiling a level off)', () => {
  assert.equal(RENOWN_OVER_MAX, 3);
  assert.deepEqual([renownCeiling(null), renownCeiling(undefined), renownCeiling(1), renownCeiling(10), renownCeiling(RENOWN_MAX), renownCeiling(99), renownCeiling(Number.NaN)], [4, 4, 4, 13, 53, 53, 4]);
  assert.equal(renownKillXp(30, 1), 40, 'a level-30 knight at Renown 1 pays like a level-4 foe - it paid 300');
  assert.equal(renownKillXp(30, null), 40, 'and so before the service has said a level');
  assert.equal(renownKillXp(2, 1), 20, 'a foe under the ceiling is read as it is');
  assert.equal(renownKillXp(13, 10), 130, 'the ceiling itself pays in full');
  assert.equal(renownKillXp(14, 10), 130, 'one level over it pays as the ceiling');
  assert.equal(renownKillXp(30, 27), 300, 'from Renown 27 a level-30 foe is read whole');
  assert.equal(renownQuestXp(30, 1), 100 + 40 * 4, 'a quest sized to Daggerfall level 30, done at Renown 1');
  assert.equal(renownQuestXp(5, 10), 300, 'a quest under the ceiling: as it was');
  assert.equal(renownPartyXp(renownKillXp(30, 1), 4), 52, 'the party\'s bonus rides on top of the ceiling, unchanged');
});

test('RENOWN3 the pace: a Daggerfall level-30 character fighting level-30 foes takes 59 kills to Renown 10 and 398 to Renown 20 (it took 19 and 228); one fighting level-5 foes takes 111 and 1,365 - one kill more than before the ceiling, a level-5 foe being one over it at Renown 1 - the records say these numbers, and they are these (mutants: a ceiling of RENOWN_OVER_MAX + 1)', () => {
  assert.deepEqual([killsTo(10, 30), killsTo(20, 30)], [59, 398]);
  assert.deepEqual([killsTo(10, 5), killsTo(20, 5)], [111, 1365]);
  const uncapped = (to, foe) => { let xp = 0, n = 0; while (renownForXp(xp) < to) { xp += renownKillXp(foe, RENOWN_MAX); n++; } return n; };
  assert.deepEqual([uncapped(10, 30), uncapped(20, 30)], [19, 228], 'what the ceiling took away');
  assert.deepEqual([uncapped(10, 5), uncapped(20, 5)], [111, 1364], 'and from a new character, one kill in 1,365');
  const law = src('src/net/renown.js').replace(/\s*\n \*\s*/g, ' ');
  assert.match(law, /a Daggerfall level-30 character takes 59 kills to Renown 10 and 398 to Renown 20/, 'the law\'s own note says it');
  assert.match(law, /one kill more in 1,365 to Renown 20/);
  assert.match(src('bible/06-Systems/Accounts-And-Cloud-Saves-Arc.md'), /## RENOWN3 — a foe pays by your Renown/);
});
