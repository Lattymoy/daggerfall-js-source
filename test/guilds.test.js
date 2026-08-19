// The guild foundation: the rank law and the 28-day gate, against
// DFU's Guild.cs. Rank is RECOMPUTED from reputation + skills rather
// than stored, so almost every pin here is a table-walk boundary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  GUILDS, RANK_REQ_REPUTATION, RANK_REQ_SKILL_HIGH, RANK_REQ_SKILL_LOW,
  DAYS_PER_YEAR, DAYS_BETWEEN_RANK_CHANGES, DEMOTION_TEXT_ID, EXPULSION_TEXT_ID,
  DEFAULT_TRAINING_MAX, MEMBER_TRAINING_COST, NON_MEMBER_TRAINING_COST,
  daySinceZero, numHighLowSkills, calculateNewRank, updateRank, isMember, guildOfFaction,
  joinGuild, leaveGuild, hasJoined, membershipOf, isEligibleToJoin,
  hasJoinedGroup, getTitle, NON_MEMBER_TITLE, joinedGuildOfGroup, promotionTextId,
  guildGroupOfFaction, MERCHANTS_FACTION_ID,
} from '../src/systems/guilds.js';
import { createFactionRep, setReputation } from '../src/systems/factionRep.js';
import { FactionFile, GUILD_GROUPS } from '../src/formats/factionFile.js';
import { SKILLS } from '../src/systems/skills.js';
import { templeOf, orderOf, resolveVariantGuild, DIVINES } from '../src/systems/guildVariants.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

// A store with one faction per guild, so the rank law can be driven
// without the corpus. The real ids are pinned separately, on the corpus.
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
/** An entity whose guild skills are all `v`, with named overrides. */
const withSkills = (guild, v, over = {}) => {
  const skills = {};
  for (const s of guild.skills) skills[s] = v;
  return { name: 'Tester', skills: Object.assign(skills, over) };
};

test('guilds: the three rank tables, verbatim', () => {
  // Guild.cs :36-38. deepEqual against DFU's literals - a spot check
  // on one row would survive a shifted table.
  assert.deepEqual([...RANK_REQ_REPUTATION], [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.deepEqual([...RANK_REQ_SKILL_HIGH], [22, 23, 31, 39, 47, 55, 63, 71, 79, 87]);
  assert.deepEqual([...RANK_REQ_SKILL_LOW], [4, 5, 9, 13, 17, 21, 25, 29, 33, 37]);
  assert.equal(RANK_REQ_REPUTATION.length, 10, 'ten ranks');
  assert.equal(DEFAULT_TRAINING_MAX, 50);
  assert.equal(MEMBER_TRAINING_COST, 100);
  assert.equal(NON_MEMBER_TRAINING_COST, 400);
  assert.equal(DEMOTION_TEXT_ID, 667);
  assert.equal(EXPULSION_TEXT_ID, 668);
  assert.equal(DAYS_BETWEEN_RANK_CHANGES, 28);
});

test('guilds: a NEGATIVE reputation expels before a single skill is read', () => {
  const g = GUILDS.FightersGuild;
  const store = storeWith(-1);
  // skills far above every bar - they must not save the member
  assert.equal(calculateNewRank(withSkills(g, 100), g, store), -1);
});

test('guilds: failing the first row returns -1, not 0 - the `return --r`', () => {
  const g = GUILDS.FightersGuild;
  const store = storeWith(0);
  // rep clears row 0 (needs 0) but the skills do not: row 0 wants one
  // skill at 22 and two at 4.
  assert.equal(calculateNewRank(withSkills(g, 3), g, store), -1,
    'nothing at even the low bar - expelled, not rank 0');
  assert.equal(calculateNewRank(withSkills(g, 22), g, store), 0,
    'clearing row 0 and failing row 1 gives rank 0');
});

test('guilds: a HIGH skill is not also counted low - the else-if', () => {
  const g = GUILDS.FightersGuild;
  // one skill at the high bar, everything else at zero. high=1, low=0,
  // so low+high is 1 and the row FAILS - a single skill cannot rank.
  const one = withSkills(g, 0, { [SKILLS.Archery]: 22 });
  assert.deepEqual(numHighLowSkills(one, g, 0), { high: 1, low: 0 });
  assert.equal(calculateNewRank(one, g, storeWith(0)), -1,
    'one high skill counted twice would have passed this row');

  // add a second skill at the LOW bar and the row passes.
  const two = withSkills(g, 0, { [SKILLS.Archery]: 22, [SKILLS.Axe]: 4 });
  assert.deepEqual(numHighLowSkills(two, g, 0), { high: 1, low: 1 });
  assert.equal(calculateNewRank(two, g, storeWith(0)), 0);
});

test('guilds: rank needs BOTH the reputation row and the skill rows', () => {
  const g = GUILDS.MagesGuild;
  const skilled = withSkills(g, 100);          // every skill maxed
  assert.equal(calculateNewRank(skilled, g, storeWith(0)), 0,
    'reputation 0 caps at rank 0 however good the skills');
  assert.equal(calculateNewRank(skilled, g, storeWith(30)), 3,
    'reputation 30 clears rows 0-3 and fails row 4 (needs 40)');
  assert.equal(calculateNewRank(skilled, g, storeWith(90)), 9,
    'reputation 90 clears every row - the top rank is 9');

  const weak = withSkills(g, 22);              // clears row 0's high bar only
  assert.equal(calculateNewRank(weak, g, storeWith(90)), 0,
    'reputation alone cannot rank a player whose skills stop at row 0');
});

test('guilds: days-since-zero is absolute, so the gate survives a year end', () => {
  assert.equal(daySinceZero({ year: 0, dayOfYear: 0 }), 0);
  assert.equal(daySinceZero({ year: 405, dayOfYear: 0 }), 405 * DAYS_PER_YEAR);
  assert.equal(DAYS_PER_YEAR, 360, "DaggerfallDateTime.DaysPerYear");
  // 3rd of one year and 3rd of the next are 360 apart, not 0
  assert.equal(daySinceZero({ year: 406, dayOfYear: 3 }) - daySinceZero({ year: 405, dayOfYear: 3 }), 360);
});

test('guilds: rank cannot move until 28 days have passed, and a change resets the clock', () => {
  const g = GUILDS.FightersGuild;
  const store = storeWith(90);
  const entity = withSkills(g, 100);
  const day = (n) => ({ year: 405, dayOfYear: n });
  const start = daySinceZero(day(0));

  const memberships = {};
  const m = joinGuild(memberships, g, day(0));
  assert.equal(m.lastRankChange, start);
  assert.equal(updateRank(memberships, g, entity, store, day(27)), null, 'day 27 is too early');
  assert.equal(m.rank, 0, 'and nothing moved');

  const up = updateRank(memberships, g, entity, store, day(28));
  assert.equal(up.outcome, 'promotion');
  assert.equal(up.rank, 9);
  assert.equal(up.textId, g.text.promotion);
  assert.equal(m.lastRankChange, daySinceZero(day(28)), 'the clock reset to the change');

  // already at the right rank - no change, and the clock does not move
  assert.equal(updateRank(memberships, g, entity, store, day(60)), null);
  assert.equal(m.lastRankChange, daySinceZero(day(28)));
  assert.equal(updateRank({}, g, entity, store, day(60)), null, 'a non-member has no rank to move');
});

test('guilds: a lost reputation demotes, and a negative one expels', () => {
  const g = GUILDS.FightersGuild;
  const entity = withSkills(g, 100);
  const day = (n) => ({ year: 405, dayOfYear: n });

  const store = storeWith(90);
  const memberships = {};
  const m = joinGuild(memberships, g, day(0));
  m.rank = 9;
  setReputation(store, g.factionId, 30);
  const down = updateRank(memberships, g, entity, store, day(28));
  assert.equal(down.outcome, 'demotion');
  assert.equal(down.rank, 3);
  assert.equal(down.textId, DEMOTION_TEXT_ID, 'every guild demotes on the shared 667');
  assert.equal(hasJoined(memberships, g), true, 'a demotion keeps the membership');

  setReputation(store, g.factionId, -1);
  const out = updateRank(memberships, g, entity, store, day(56));
  assert.equal(out.outcome, 'expulsion');
  assert.equal(out.rank, -1);
  assert.equal(out.textId, EXPULSION_TEXT_ID, 'and expels on the shared 668');
  // EXPULSION REMOVES THE MEMBERSHIP, right here, as DFU does. Leaving
  // it keyed at rank -1 is a state DFU never holds, and hasJoined -
  // which tests the KEY - would keep answering true for an expelled
  // player. A mutation run is what found that.
  assert.equal(hasJoined(memberships, g), false, 'the membership is gone, not just negative');
  assert.equal(membershipOf(memberships, g), null);
});

test('guilds: membership is rank >= 0', () => {
  assert.equal(isMember({ rank: 0 }), true, 'rank 0 IS a member');
  assert.equal(isMember({ rank: 9 }), true);
  assert.equal(isMember({ rank: -1 }), false);
  assert.equal(isMember(null), false);
  assert.equal(isMember(undefined), false);
});

test('guilds: every guild faction id resolves on the REAL FACTION.TXT', { skip: skipReal }, () => {
  // The ids are the seam to S25: a wrong one reads reputation 0
  // forever and every member silently sits at rank 0.
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  const expected = {
    FightersGuild: 'The Fighters Guild',
    MagesGuild: 'The Mages Guild',
    ThievesGuild: 'The Thieves Guild',
    DarkBrotherhood: 'The Dark Brotherhood',
  };
  for (const [key, guild] of Object.entries(GUILDS)) {
    const f = ff.factionDict.get(guild.factionId);
    assert.ok(f, `${key}: faction ${guild.factionId} is not in FACTION.TXT`);
    assert.equal(f.name, expected[key], `${key}: faction ${guild.factionId} is ${f.name}`);
    assert.equal(guildOfFaction(guild.factionId), guild, 'and resolves back');
  }
  assert.equal(guildOfFaction(9999), null, 'a faction that is not a guild');
});

test('guilds: every guild skill is a real skill id', () => {
  // A typo'd skill name is `undefined`, skillValue reads 0 for it, and
  // that guild's members quietly cap a rank low.
  const ids = new Set(Object.values(SKILLS));
  for (const [key, guild] of Object.entries(GUILDS)) {
    assert.ok(guild.skills.length >= 6, `${key} has its skill list`);
    for (const s of guild.skills) {
      assert.ok(s !== undefined && ids.has(s), `${key}: a guild skill is not a SKILLS member`);
    }
    assert.equal(new Set(guild.skills).size, guild.skills.length, `${key}: no skill listed twice`);
  }
});


test('guilds: joining sets rank 0 and starts the 28-day clock; leaving drops the record', () => {
  const g = GUILDS.ThievesGuild;
  const memberships = {};
  assert.equal(hasJoined(memberships, g), false);
  assert.equal(membershipOf(memberships, g), null);

  const m = joinGuild(memberships, g, { year: 405, dayOfYear: 10 });
  assert.deepEqual(m, { guild: g.name, rank: 0, lastRankChange: daySinceZero({ year: 405, dayOfYear: 10 }) });
  assert.equal(hasJoined(memberships, g), true);
  assert.equal(isMember(membershipOf(memberships, g)), true, 'rank 0 IS a member');

  assert.equal(leaveGuild(memberships, g), true);
  assert.equal(hasJoined(memberships, g), false, 'the KEY is gone, not just the rank');
  assert.equal(leaveGuild(memberships, g), false, 'leaving twice is a no-op');
});

test('guilds: eligibility to join is row 0 exactly', () => {
  const g = GUILDS.FightersGuild;
  assert.equal(isEligibleToJoin(withSkills(g, 100), g, storeWith(-1)), false, 'a negative reputation');
  assert.equal(isEligibleToJoin(withSkills(g, 3), g, storeWith(0)), false, 'nothing at the low bar');
  assert.equal(isEligibleToJoin(withSkills(g, 0, { [SKILLS.Archery]: 22 }), g, storeWith(0)), false,
    'one high skill is not two skills');
  assert.equal(isEligibleToJoin(withSkills(g, 0, { [SKILLS.Archery]: 22, [SKILLS.Axe]: 4 }), g, storeWith(0)), true);
  // and it agrees with the rank walk at r = 0
  for (const v of [0, 3, 4, 22, 50]) {
    const e = withSkills(g, v);
    assert.equal(isEligibleToJoin(e, g, storeWith(0)), calculateNewRank(e, g, storeWith(0)) >= 0,
      `eligibility and rank 0 must agree at skill ${v}`);
  }
});

test('guilds: the guild group comes from FACTION.TXT, and THE MERCHANTS are the exception', { skip: skipReal }, () => {
  // DFU hardcodes factionId 510 to None with the comment "Shops are
  // marked as FG in faction data". They really are: 510 carries ggroup
  // 11 in the shipped file, so without the exception every shop would
  // answer as a Fighters Guild hall.
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  const dict = ff.factionDict;

  assert.equal(dict.get(MERCHANTS_FACTION_ID).ggroup, GUILD_GROUPS.FightersGuild,
    'the data really does mark The Merchants as a Fighters Guild');
  assert.equal(guildGroupOfFaction(dict, MERCHANTS_FACTION_ID), GUILD_GROUPS.None,
    'and the hardcoded exception overrides it');

  assert.equal(guildGroupOfFaction(dict, GUILDS.MagesGuild.factionId), GUILD_GROUPS.MagesGuild);
  assert.equal(guildGroupOfFaction(dict, GUILDS.FightersGuild.factionId), GUILD_GROUPS.FightersGuild);
  assert.equal(guildGroupOfFaction(dict, GUILDS.DarkBrotherhood.factionId), GUILD_GROUPS.DarkBrotherHood);
  // the Thieves Guild is GeneralPopulace, not a group of its own
  assert.equal(guildGroupOfFaction(dict, GUILDS.ThievesGuild.factionId), GUILD_GROUPS.GeneralPopulace);
  assert.equal(guildGroupOfFaction(dict, 999999), GUILD_GROUPS.None, 'an unknown faction');
});


test('guilds: AUDIT 20 - the membership slot is the GUILD GROUP, so one temple at a time', () => {
  // DFU's Memberships is Dictionary<GuildGroups, IGuild> and
  // AddMembership ASSIGNS into it, so joining Mara's temple when you
  // are in Arkay's replaces it. Keyed by guild name, the port let a
  // player hold all eight temples and all ten orders at once.
  const day = { year: 405, dayOfYear: 1 };
  const m = {};
  joinGuild(m, templeOf('Arkay'), day);
  joinGuild(m, templeOf('Mara'), day);
  joinGuild(m, templeOf('Dibella'), day);
  assert.equal(Object.keys(m).length, 1, 'all eight temples share ONE slot');
  assert.equal(hasJoined(m, templeOf('Dibella')), true, 'the last one joined is the one held');
  assert.equal(hasJoined(m, templeOf('Arkay')), false, 'and the earlier ones are gone');
  assert.equal(membershipOf(m, templeOf('Arkay')), null);

  joinGuild(m, orderOf('Rose'), day);
  joinGuild(m, orderOf('Owl'), day);
  assert.equal(Object.keys(m).length, 2, 'the ten orders share a second slot');

  // but the fixed guilds each have their own group and coexist
  joinGuild(m, GUILDS.FightersGuild, day);
  joinGuild(m, GUILDS.MagesGuild, day);
  assert.equal(Object.keys(m).length, 4);
  assert.equal(hasJoined(m, GUILDS.FightersGuild), true);
  assert.equal(hasJoined(m, GUILDS.MagesGuild), true);
});

test('guilds: AUDIT 20 - HasJoined takes a GROUP, the way DFU asks it', () => {
  // HasJoined(HolyOrder) is "am I in A temple", which is the question
  // a temple hall asks at the door. The port had it taking a guild,
  // which answered yes for Arkay's temple while you were in Mara's.
  const m = {};
  joinGuild(m, templeOf('Mara'), { year: 405, dayOfYear: 1 });
  assert.equal(hasJoinedGroup(m, GUILD_GROUPS.HolyOrder), true);
  assert.equal(hasJoinedGroup(m, GUILD_GROUPS.KnightlyOrder), false);
  assert.equal(joinedGuildOfGroup(m, GUILD_GROUPS.HolyOrder).guild, 'Temple:Mara');
  assert.equal(joinedGuildOfGroup(m, GUILD_GROUPS.MagesGuild), null);
});

test('guilds: AUDIT 20 - the promotion message is PER RANK, not per guild', () => {
  // Five of the six guilds switch on the new rank, because the message
  // announces the benefit that rank unlocked. The port returned one
  // flat record, so a member promoted into a benefit was told the
  // generic line instead of what they had earned.
  const mg = GUILDS.MagesGuild;
  assert.equal(promotionTextId(mg, 2), 5230, 'rank 2 opens the library');
  assert.equal(promotionTextId(mg, 3), 5231, 'rank 3 opens magic items');
  assert.equal(promotionTextId(mg, 6), 5233, 'rank 6 opens summoning');
  assert.equal(promotionTextId(mg, 8), 5234, 'rank 8 opens teleport');
  assert.equal(promotionTextId(mg, 5), mg.text.promotion, "and DFU's default in between");
  assert.notEqual(promotionTextId(mg, 2), promotionTextId(mg, 5), 'the two ARE different records');

  assert.equal(promotionTextId(GUILDS.ThievesGuild, 2), 5226, 'the fence');
  assert.equal(promotionTextId(GUILDS.ThievesGuild, 4), 5227, 'the spymaster');
  assert.equal(promotionTextId(GUILDS.DarkBrotherhood, 1), 6611);
  assert.equal(promotionTextId(GUILDS.DarkBrotherhood, 7), 6614);
  // the Fighters Guild really is flat - the one that always was
  for (const r of [0, 2, 5, 9]) assert.equal(promotionTextId(GUILDS.FightersGuild, r), 686);

  // and updateRank reports the per-rank record, not the default
  const store = storeWith(20);
  const memberships = {};
  const mem = joinGuild(memberships, mg, { year: 405, dayOfYear: 0 });
  mem.rank = 1;
  const up = updateRank(memberships, mg, withSkills(mg, 100), store, { year: 405, dayOfYear: 28 });
  assert.equal(up.rank, 2);
  assert.equal(up.textId, 5230, 'promoted to 2, told about the library');
});

test('guilds: AUDIT 20 - guildOfFaction resolves temples and orders too', { skip: skipReal }, () => {
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  const resolve = resolveVariantGuild(ff.factionDict);
  assert.equal(guildOfFaction(GUILDS.FightersGuild.factionId, resolve).name, 'FightersGuild');
  assert.equal(guildOfFaction(21, resolve).name, 'Temple:Arkay', "a divine's own faction");
  assert.equal(guildOfFaction(82, resolve).name, 'Temple:Arkay', 'and its templar order');
  assert.equal(guildOfFaction(409, resolve).name, 'Order:Rose');
  assert.equal(guildOfFaction(999999, resolve), null);
  // without a resolver it still answers for the four fixed guilds only
  assert.equal(guildOfFaction(21), null);
});

test('guilds: AUDIT 20 - a temple faction resolves to a GROUP through its child', { skip: skipReal }, () => {
  // Every divine's OWN ggroup is None in the shipped file; the group
  // lives on its single child, the templar order. Without DFU's
  // "temples nested under deity" branch every temple answered "not a
  // guild".
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  for (const [name, id] of Object.entries(DIVINES)) {
    assert.equal(ff.factionDict.get(id).ggroup, GUILD_GROUPS.None, `${name}'s own ggroup is None`);
    assert.equal(guildGroupOfFaction(ff.factionDict, id), GUILD_GROUPS.HolyOrder,
      `${name} must resolve to HolyOrder through its templar order`);
  }
});

// ---------------------------------------------------------------------------
// U23: the rank titles, recovered from DFU's Internal_Strings.
// ---------------------------------------------------------------------------

test('U23: GetTitle returns the RANK TITLE for a member (Guild.cs :178-181)', () => {
  const bob = { name: 'Bob' };
  // the four lists, verbatim - "Master Wizard", "Master Thief",
  // "Dark Brother" and "Master Assassin" are ONE title each, because
  // GetLocalizedTextList splits the entry on newlines only.
  assert.deepEqual(GUILDS.FightersGuild.rankTitles, ['Apprentice', 'Journeyman', 'Swordsman',
    'Protector', 'Defender', 'Warder', 'Guardian', 'Champion', 'Warrior', 'Master']);
  assert.deepEqual(GUILDS.MagesGuild.rankTitles, ['Apprentice', 'Journeyman', 'Evoker',
    'Conjurer', 'Magician', 'Enchanter', 'Warlock', 'Wizard', 'Master Wizard', 'Archmage']);
  assert.deepEqual(GUILDS.ThievesGuild.rankTitles, ['Apprentice', 'Journeyman', 'Filcher',
    'Crook', 'Robber', 'Bandit', 'Thief', 'Ringleader', 'Mastermind', 'Master Thief']);
  assert.deepEqual(GUILDS.DarkBrotherhood.rankTitles, ['Apprentice', 'Journeyman', 'Operator',
    'Slayer', 'Executioner', 'Punisher', 'Terminator', 'Assassin', 'Dark Brother', 'Master Assassin']);
  for (const g of Object.values(GUILDS)) assert.equal(g.rankTitles.length, 10, g.name);
  assert.equal(getTitle({ guild: 'MagesGuild', rank: 8 }, bob, GUILDS.MagesGuild), 'Master Wizard');
  assert.equal(getTitle({ guild: 'FightersGuild', rank: 0 }, bob, GUILDS.FightersGuild), 'Apprentice');
});

test('U23: a NON-member reads back their own NAME - except in the three overriding guilds', () => {
  const bob = { name: 'Bob' };
  // Guild.GetTitle's own else-branch is PlayerEntity.Name (:180).
  assert.equal(getTitle(null, bob, GUILDS.FightersGuild), 'Bob');
  assert.equal(getTitle(null, bob, GUILDS.MagesGuild), 'Bob');
  assert.equal(getTitle(null, bob, GUILDS.ThievesGuild), 'Bob');
  // DarkBrotherhood.cs :86-92 overrides it with the "nonMember" string.
  assert.equal(getTitle(null, bob, GUILDS.DarkBrotherhood), NON_MEMBER_TITLE);
  assert.equal(NON_MEMBER_TITLE, 'non-member');
  // an EXPELLED member (rank -1) is a non-member here too
  assert.equal(getTitle({ guild: 'FightersGuild', rank: -1 }, bob, GUILDS.FightersGuild), 'Bob');
});
