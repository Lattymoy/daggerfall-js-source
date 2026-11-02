// FIELD BUGS 2026-10-16c (OWED-PACE) - slater.mp3, "Can't gain reputation with the guild": "I did few quests because i
// had - rep there and i get this: ( 21 more i need) and did few quests and its need 36 more!" The hall read "Reputation
// -35 of 10 (21 more to come)". Online the Roll credits a guild at most ROLL_GAIN_DAY_MAX a real day and owes the rest
// (net/npcChapterLaw.js rollCredit): the quests' reputation was EARNED and on its way, and the row's "(21 more to come)"
// read as 21 more needed. Two changes: the row says the owed is earned and the pace it arrives at, and REP6's review -
// on the character's own days, which travel and rest spend faster than the Roll's real ones - never expels a member
// over reputation the Roll still owes them (it renews the probation; it never ends it or buys a rank).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUILDS, updateRank, joinGuild, hasJoined, GUILD_EXPEL_BELOW, DAYS_BETWEEN_RANK_CHANGES,
} from '../../../src/systems/guild/guilds.js';
import { createFactionRep, setReputation, getReputation } from '../../../src/systems/faction/factionRep.js';
import { onPushEffects, rankNeedsLines } from '../../../src/systems/guild/guildServiceFlow.js';
import { setStandingOwed } from '../../../src/systems/standingOwed.js';
import { ROLL_GAIN_DAY_MAX, rollCredit } from '../../../src/net/npcChapterLaw.js';

const storeWith = (rep) => {
  const dict = new Map();
  for (const g of Object.values(GUILDS)) {
    dict.set(g.factionId, { id: g.factionId, parent: 0, rep: 0, flags: 0, power: 50,
      ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: 0, ggroup: 0 });
  }
  const store = createFactionRep(dict);
  for (const g of Object.values(GUILDS)) setReputation(store, g.factionId, rep);
  return store;
};
const withSkills = (guild, v) => ({ name: 'Tester', skills: Object.fromEntries(guild.skills.map((s) => [s, v])) });
const day = (n) => ({ year: 405, dayOfYear: n });
/** A member on probation at -35 - the report's hall - its review due on `day(56)`. */
function onProbation(g) {
  const store = storeWith(-35);
  const memberships = {};
  const m = joinGuild(memberships, g, day(0));
  m.rank = 1;
  assert.equal(updateRank(memberships, g, withSkills(g, 60), store, day(28)).outcome, 'probation');
  return { store, memberships, m };
}

test('OWED-PACE: the report\'s numbers are the Roll\'s pace - three quests\' +5 credited to -35 on one real day, the rest owed (21, then 36 as more were done), not a reputation lost', () => {
  let row = { rep: -50, owed: 0, gainedDay: 20500, gained: 0 };
  const quest = () => { row = { ...row, ...rollCredit(row, 5, 20500) }; };
  for (let i = 0; i < 7; i++) quest();
  assert.deepEqual([row.rep, row.owed], [-35, 20]);
  quest(); quest(); quest();
  assert.deepEqual([row.rep, row.owed], [-35, 35], 'more quests the same day: the owed grows, the standing waits for the day');
});

test('OWED-PACE: a review on probation never expels over what the Roll owes - it renews the probation; owed short of the -10 line still expels (mutants: the owed ignored; the owed counted twice; the owed ending the probation)', () => {
  const g = GUILDS.MagesGuild;
  const kept = onProbation(g);
  const again = updateRank(kept.memberships, g, withSkills(g, 60), kept.store, day(28 + DAYS_BETWEEN_RANK_CHANGES), { owed: 36 });
  assert.deepEqual([again.outcome, hasJoined(kept.memberships, g), kept.m.rank, kept.m.probation], ['probation', true, 1, true],
    '-35 with 36 owed is +1 once paid: still a member, the rank kept, the probation renewed (not ended)');
  assert.equal(getReputation(kept.store, g.factionId), -35, 'the owed is never credited by the review');
  const edge = onProbation(g);
  assert.equal(updateRank(edge.memberships, g, withSkills(g, 60), edge.store, day(56), { owed: 35 + GUILD_EXPEL_BELOW }).outcome, 'probation', 'at -10 with the owed: not out');
  const short = onProbation(g);
  const out = updateRank(short.memberships, g, withSkills(g, 60), short.store, day(56), { owed: 24 });
  assert.deepEqual([out.outcome, hasJoined(short.memberships, g)], ['expulsion', false], '-35 + 24 = -11: below the line, out as before');
  const offline = onProbation(g);
  assert.equal(updateRank(offline.memberships, g, withSkills(g, 60), offline.store, day(56)).outcome, 'expulsion', 'offline (no owed): REP6 as it was');
});

test('OWED-PACE: the hall\'s review reads the Roll\'s owed (onPushEffects - standingOwedOf), and the hall\'s row says the owed is earned and its pace (mutants: the owed not passed; the old words)', () => {
  const g = GUILDS.MagesGuild;
  const { store, memberships, m } = onProbation(g);
  const entity = { ...withSkills(g, 60), guildMemberships: memberships, factionRep: store };
  setStandingOwed({ [g.factionId]: 36 });
  try {
    const steps = onPushEffects(entity, g, memberships, store, day(56));
    assert.deepEqual([steps[0]?.rankChange?.outcome, hasJoined(memberships, g), m.probation], ['probation', true, true]);
    setReputation(store, g.factionId, 4);
    m.probation = false; m.rank = 0;   // the report's own hall: a Member, Journeyman next at 10
    assert.deepEqual(rankNeedsLines(entity, g, memberships, store), ['Next rank: Journeyman',
      `Reputation 4 of 10 (36 more already earned, arriving at most ${ROLL_GAIN_DAY_MAX} a real day)`]);
  } finally { setStandingOwed(null); }
});
