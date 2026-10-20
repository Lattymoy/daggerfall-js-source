// SEAT-LINE (FIELD BUGS 2026-10-15g, a Discord thread: "why did my rank on mages guild fall if i got max reputation";
// "I was Archmage and now I cant seem to ever get back past the Wizard rank... All the other guilds tell me what the
// next rank is and what I need but the Mages Guild does not"; Mac, asked: "Explain the seat"). Online, while the Roll
// holds, ranks 8 and 9 are the chapters' seats (Chapters-Arc 3.5) - the hall's line at 7 said nothing at all. It now
// says the next rank is a seat and what a seat asks, read off the law's own numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUILDS, joinGuild, rankNeeds, membershipKey } from '../../src/systems/guild/guilds.js';
import { createFactionRep, setReputation } from '../../src/systems/faction/factionRep.js';
import { rankNeedsLines } from '../../src/systems/guild/guildServiceFlow.js';
import { seatedBook } from '../../src/net/npcChapterLaw.js';

const storeWith = (guild, rep) => {
  const dict = new Map([[guild.factionId, { id: guild.factionId, parent: 0, rep: 0, flags: 0, power: 50,
    ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: 0, ggroup: 0 }]]);
  const store = createFactionRep(dict);
  setReputation(store, guild.factionId, rep);
  return store;
};
const withSkills = (guild, v) => ({ name: 'Tester', skills: Object.fromEntries(guild.skills.map((s) => [s, v])) });
const day = (n) => ({ year: 405, dayOfYear: n });
const ROLL = { rankCeiling: 7 };
const atRank = (g, rank) => {
  const memberships = {};
  joinGuild(memberships, g, day(1)).rank = rank;
  return memberships;
};

test('SEAT-LINE: a member at the Roll\'s 7 is answered the seat - the next rank, its reputation and rank 8\'s need; below the ceiling and offline the review\'s row (mutants: the seat answered null, at any rank)', () => {
  const g = GUILDS.MagesGuild;
  assert.deepEqual(rankNeeds(atRank(g, 7), g, withSkills(g, 90), storeWith(g, 62), ROLL),
    { rank: 8, seat: true, reputation: 62, reputationNeed: 80 });
  assert.equal(rankNeeds(atRank(g, 6), g, withSkills(g, 90), storeWith(g, 62), ROLL).seat, undefined, 'at 6, rank 7 is the review\'s');
  assert.equal(rankNeeds(atRank(g, 7), g, withSkills(g, 90), storeWith(g, 62)).seat, undefined, 'offline the review gives 8');
  assert.equal(rankNeeds(atRank(g, 9), g, withSkills(g, 90), storeWith(g, 62), ROLL), null, 'past the ceiling: nothing');
});

test('SEAT-LINE: the hall says the seat in words - the seats, the reputation short of 80, and the Turning\'s Merit with its tenure and account age (mutants: a line dropped, a number not the law\'s)', () => {
  const g = GUILDS.MagesGuild;
  const seats = "Ranks 8 and 9 are each chapter's council and Master, won only by Merit";
  // PIN MOVED (AUDIT GUILD-WORDS L3-4, L1-2): the seats' days are real ones; and at 62 a Wizard's own 70 is short, so the
  // review's demotion comes first (the warnings' own pins are fb1015g_guildwords's) - 72 is the seat line alone
  const merit = 'At each Sunday\'s Turning the chairs go to the members with the most Merit over the last 4 weeks, with 14 real days in the guild and accounts 7 real days old';   // PIN MOVED (AUDIT GUILD-WORDS II C-2): ranks 8 and 9 are chairs - "seats" is a town's word
  assert.deepEqual(rankNeedsLines(withSkills(g, 90), g, atRank(g, 7), storeWith(g, 72), ROLL),
    ['Next rank: Master Wizard', seats, 'Reputation 72 of 80', merit]);
  assert.deepEqual(rankNeedsLines(withSkills(g, 90), g, atRank(g, 7), storeWith(g, 100), ROLL),
    ['Next rank: Master Wizard', seats, merit], 'the reputation met: the Turning alone');
  assert.deepEqual(rankNeedsLines(withSkills(GUILDS.FightersGuild, 90), GUILDS.FightersGuild, atRank(GUILDS.FightersGuild, 7),
    storeWith(GUILDS.FightersGuild, 100), ROLL)[0], 'Next rank: Warrior', 'every guild\'s own title');
});

test('SEAT-LINE: a seat\'s holder, its book read seated, is told nothing more (mutant: the line read past a seat)', () => {
  const g = GUILDS.MagesGuild;
  const book = atRank(g, 7);
  for (const seat of [8, 9]) {
    assert.equal(rankNeedsLines(withSkills(g, 90), g, seatedBook(book, membershipKey(g), seat), storeWith(g, 100), ROLL), null, `seated ${seat}`);
  }
});

test('SEAT-LINE: the interior host reads the hall\'s line off the seated book, under the Roll\'s ceiling (mutant: the book unseated)', () => {
  const wm = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.ok(wm.includes('rankNeedsLines(playerEntity, guild, seated(), store, { rankCeiling: pace?.book ?? null, pace, now: ownDate(), book: memberships })'));
});
