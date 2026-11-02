// REP6 (2026-09-29, the reputation overhaul) - PROBATION BEFORE EXPULSION. The shape Mac signed: "Guilds: probation below
// 0, and expulsion only below -10, with a warning first." DFU expels at the first review that finds a member below zero -
// one failed quest's -2 from zero ("i got expelled from the mages... it says i dont have reputation", FIELD BUGS
// 2026-09-21), a timeout's -22 with Roleplay Realism's death squad behind it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUILDS, updateRank, joinGuild, hasJoined, GUILD_EXPEL_BELOW, PROBATION_LINES, EXPULSION_TEXT_ID, DAYS_BETWEEN_RANK_CHANGES, daySinceZero,
} from '../../../src/systems/guild/guilds.js';
import { createFactionRep, setReputation } from '../../../src/systems/faction/factionRep.js';
import { onPushEffects } from '../../../src/systems/guild/guildServiceFlow.js';
import { affiliations } from '../../../src/systems/affiliations.js';

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

test('REP6: below zero at a review - on probation, told so, the rank kept, 28 days more; still in [-10, 0) at the next - probation again, never out; back at zero - the probation ends (mutants: DFU\'s expulsion at the first review; the probation never ending)', () => {
  const g = GUILDS.MagesGuild;
  const store = storeWith(12);
  const memberships = {};
  const m = joinGuild(memberships, g, day(0));
  m.rank = 1;
  setReputation(store, g.factionId, -2);
  const first = updateRank(memberships, g, withSkills(g, 60), store, day(28));
  assert.deepEqual([first.outcome, first.rank, first.textId, first.lines], ['probation', 1, null, PROBATION_LINES]);
  assert.deepEqual([hasJoined(memberships, g), m.rank, m.probation, m.lastRankChange], [true, 1, true, daySinceZero(day(28))],
    'still a member, the rank kept, the next review 28 days on');
  assert.equal(updateRank(memberships, g, withSkills(g, 60), store, day(28 + DAYS_BETWEEN_RANK_CHANGES - 1)), null, 'not before');
  setReputation(store, g.factionId, GUILD_EXPEL_BELOW);
  assert.equal(updateRank(memberships, g, withSkills(g, 60), store, day(56)).outcome, 'probation', 'at -10 exactly: probation, not out');
  setReputation(store, g.factionId, 11);
  updateRank(memberships, g, withSkills(g, 60), store, day(84));
  assert.equal(m.probation, false, 'mended');
});

test('REP6: expelled only at a review that finds a member already on probation AND below -10 - a fall straight to -22 is warned first (mutants: the warning skipped; the -10 line ignored)', () => {
  const g = GUILDS.FightersGuild;
  const store = storeWith(0);
  const memberships = {};
  joinGuild(memberships, g, day(0));
  setReputation(store, g.factionId, -22);   // a timeout's -22 from zero
  assert.equal(updateRank(memberships, g, withSkills(g, 60), store, day(28)).outcome, 'probation', 'warned first');
  const out = updateRank(memberships, g, withSkills(g, 60), store, day(56));
  assert.deepEqual([out.outcome, out.textId, hasJoined(memberships, g)], ['expulsion', EXPULSION_TEXT_ID, false]);
});

test('REP6: the probation box is the popup\'s own box - the three lines, centred - and the Standing page tags the guild (mutant: the box never shown)', () => {
  const g = GUILDS.MagesGuild;
  const store = storeWith(-3);
  const memberships = {};
  joinGuild(memberships, g, day(0));
  const entity = { ...withSkills(g, 60), guildMemberships: memberships, factionRep: store };
  const steps = onPushEffects(entity, g, memberships, store, day(28));
  assert.deepEqual(steps[0].rows, PROBATION_LINES.map((text) => ({ text, center: true })));
  assert.equal(affiliations(entity)[0]?.probation, true);
});
