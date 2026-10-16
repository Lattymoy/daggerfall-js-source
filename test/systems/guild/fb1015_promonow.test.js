// PROMO-NOW (FIELD BUGS 2026-10-15, a Discord report: "have traveled back and forth from daggerfall passed 200 days still
// no promotion i meet the requirements i checked on uesp is this a bug"; Mac: "We need to change the way promotions
// behave online", asked, "No wait"). Online a promotion does not wait DFU's 28 days - the hall's review promotes the
// moment the member qualifies - while a demotion, a probation and an expulsion still wait them. And online the hall's
// popup says what the next rank asks that the member does not have.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUILDS, updateRank, joinGuild, rankNeeds, daySinceZero, DAYS_BETWEEN_RANK_CHANGES } from '../../../src/systems/guild/guilds.js';
import { createFactionRep, setReputation } from '../../../src/systems/faction/factionRep.js';
import { onPushEffects, rankNeedsLines } from '../../../src/systems/guild/guildServiceFlow.js';
import { PORT_SPECS } from '../../../src/ui/enhanced/enhancedPorts.js';
import { GuildServiceWindow } from '../../../src/ui/guildServiceWindow.js';
import { SKILLS } from '../../../src/systems/skills.js';

const storeWith = (guild, rep) => {
  const dict = new Map([[guild.factionId, { id: guild.factionId, parent: 0, rep: 0, flags: 0, power: 50,
    ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: 0, ggroup: 0 }]]);
  const store = createFactionRep(dict);
  setReputation(store, guild.factionId, rep);
  return store;
};
const withSkills = (guild, v, over = {}) => ({ name: 'Tester', skills: { ...Object.fromEntries(guild.skills.map((s) => [s, v])), ...over } });
const day = (n) => ({ year: 405, dayOfYear: n });
const ONLINE = { promoteWhenEarned: true };

test('PROMO-NOW: online, a member who qualifies is promoted at the hall the day they qualify - offline DFU\'s 28 days still stand (mutant: the wait kept online)', () => {
  const g = GUILDS.FightersGuild;
  const store = storeWith(g, 10);
  const entity = withSkills(g, 30);
  const online = {}, offline = {};
  joinGuild(online, g, day(1));
  joinGuild(offline, g, day(1));
  assert.equal(updateRank(offline, g, entity, store, day(5)), null, 'offline: four days in, the review waits');
  const moved = updateRank(online, g, entity, store, day(5), ONLINE);
  assert.deepEqual([moved.outcome, moved.rank, online[g.guildGroup].rank], ['promotion', 1, 1]);
  assert.equal(online[g.guildGroup].lastRankChange, daySinceZero(day(5)), 'the promotion restarts the clock a demotion reads');
  setReputation(store, g.factionId, 20);
  assert.equal(updateRank(online, g, withSkills(g, 40), store, day(6), ONLINE).rank, 2, 'and the next the day after, earned');
});

test('PROMO-NOW: online, inside the 28 days a demotion, a probation and an expulsion wait as DFU\'s do (mutant: every review run without the wait)', () => {
  const g = GUILDS.MagesGuild;
  const store = storeWith(g, 25);
  const memberships = {};
  const m = joinGuild(memberships, g, day(0));
  m.rank = 3;
  const entity = withSkills(g, 60);
  assert.equal(updateRank(memberships, g, entity, store, day(10), ONLINE), null, 'rank 2\'s reputation: no demotion inside the wait');
  setReputation(store, g.factionId, -20);
  assert.equal(updateRank(memberships, g, entity, store, day(10), ONLINE), null, 'below zero: no probation inside the wait');
  assert.deepEqual([m.rank, !!m.probation], [3, false]);
  assert.equal(updateRank(memberships, g, entity, store, day(DAYS_BETWEEN_RANK_CHANGES), ONLINE).outcome, 'probation', 'the 28th day reviews it all');
});

test('PROMO-NOW: online the Roll\'s ceiling holds inside the wait - a member at 7 whom DFU would make 9 is not announced, one at 5 is made 7', () => {
  const g = GUILDS.MagesGuild;
  const store = storeWith(g, 95);
  const memberships = {};
  const m = joinGuild(memberships, g, day(0));
  m.rank = 7;
  assert.equal(updateRank(memberships, g, withSkills(g, 100), store, day(3), { ...ONLINE, rankCeiling: 7 }), null);
  m.rank = 5;
  assert.equal(updateRank(memberships, g, withSkills(g, 100), store, day(4), { ...ONLINE, rankCeiling: 7 }).rank, 7);
});

test('PROMO-NOW: the hall\'s push carries the online flag to the review - its box is the promotion\'s (mutant: the flag never threaded)', () => {
  const g = GUILDS.FightersGuild;
  const store = storeWith(g, 10);
  const memberships = {};
  joinGuild(memberships, g, day(1));
  const steps = onPushEffects(withSkills(g, 30), g, memberships, store, day(2), { promoteWhenEarned: true });
  assert.deepEqual([steps[0]?.rankChange?.outcome, steps[0]?.textId], ['promotion', 686]);
});

test('PROMO-NOW: the hall\'s line names what the next rank asks - the reputation, the high skill with the best one, the second, and the guild\'s own skills (mutants: a line dropped)', () => {
  const g = GUILDS.FightersGuild;
  const memberships = {};
  joinGuild(memberships, g, day(1)).rank = 1;
  // rank 2 asks 20 reputation, one guild skill at 31 and a second at 9 - PIN MOVED (AUDIT GUILD-WORDS II A-7): the rest
  // at 5, rank 1's own second bar, where 3 was short of rank 0's 4 and the line now warns of the probation that brings
  const skills = 'Archery, Axe, Blunt Weapon, Giantish, Hand-to-Hand, Long Blade, Orcish, Short Blade';
  assert.deepEqual(rankNeedsLines(withSkills(g, 5, { [SKILLS.LongBlade]: 40 }), g, memberships, storeWith(g, 14)),
    ['Next rank: Swordsman', 'Reputation 14 of 20', 'A second guild skill at 9', `Guild skills: ${skills}`]);
  assert.deepEqual(rankNeedsLines(withSkills(g, 5, { [SKILLS.Axe]: 25 }), g, memberships, storeWith(g, 20)),
    ['Next rank: Swordsman', 'A guild skill at 31 - your best, Axe, is 25', 'A second guild skill at 9', `Guild skills: ${skills}`]);
  assert.deepEqual(rankNeedsLines(withSkills(g, 12, { [SKILLS.Axe]: 25 }), g, memberships, storeWith(g, 30)),
    ['Next rank: Swordsman', 'A guild skill at 31 - your best, Axe, is 25', `Guild skills: ${skills}`], 'two at the low bar: the high one alone');
  assert.equal(rankNeedsLines(withSkills(g, 40), g, memberships, storeWith(g, 20)), null, 'nothing short: no line');
});

test('PROMO-NOW: no review\'s line past the highest rank a review gives, nor for a stranger (mutant: the ceiling ignored)', () => {
  const g = GUILDS.MagesGuild;
  const memberships = {};
  const m = joinGuild(memberships, g, day(1));
  m.rank = 7;
  // PIN MOVED (SEAT-LINE, Field-Bugs-2026-10-15g.md): at the ceiling the next rank is a seat, and the line says so
  assert.equal(rankNeeds(memberships, g, withSkills(g, 10), storeWith(g, 0), { rankCeiling: 7 }).seat, true, 'ranks 8 and 9 are seats online');
  assert.equal(rankNeeds(memberships, g, withSkills(g, 10), storeWith(g, 0)).rank, 8, 'offline the review gives 8');
  m.rank = 9;
  assert.equal(rankNeeds(memberships, g, withSkills(g, 10), storeWith(g, 0)), null);
  assert.equal(rankNeedsLines(withSkills(g, 10), g, {}, storeWith(g, 0)), null, 'a stranger');
});

test('PROMO-NOW: the enhanced popup shows a member the line above its buttons; a stranger sees none (mutant: the line not drawn)', () => {
  const hooks = (member) => ({ member: () => member, service: () => 'Training', rows: () => [], steps: () => [],
    rankNeeds: () => ['Next rank: Swordsman', 'Reputation 14 of 20'] });
  const view = PORT_SPECS.guild.view(new GuildServiceWindow(hooks(true)));
  assert.deepEqual(view.blocks[0], { type: 'text', rows: ['Next rank: Swordsman', 'Reputation 14 of 20'], scroll: true });   // PIN MOVED (AUDIT GUILD-WORDS II F-1): in its own scrolling well
  assert.equal(PORT_SPECS.guild.view(new GuildServiceWindow(hooks(false))).blocks.some((b) => b.type === 'text'), false);
});

test('PROMO-NOW: the interior host hands the online flag to the review and the line to the popup - both on the shared clock (mutant: the host offline)', () => {
  const wm = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  // PIN MOVED (ROLL-PACE, FIELD BUGS 2026-10-15f): online AND while the Roll paces it; the line under the book's ceiling, with the pace
  assert.ok(/steps: \(\) => onPushEffects\([\s\S]{0,800}?\n\s+promoteWhenEarned: sharedClockOn\(\) && !!host\.rollPace\?\.\(guild\.factionId\),/.test(wm), 'the review: online, no wait');
  assert.ok(wm.includes('rankNeeds: () => { const pace = sharedClockOn() ? host.rollPace?.(guild.factionId) ?? null : null; return sharedClockOn() ? rankNeedsLines(playerEntity, guild, seated(), store, { rankCeiling: pace?.book ?? null, pace, now: ownDate(), book: memberships }) : null; },'),   // PIN MOVED (SEAT-LINE): read seated, the review's date and book with it
    'the line: online, under the Roll\'s ceiling');
});
