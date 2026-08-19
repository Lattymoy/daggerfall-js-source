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
  hasJoinedGroup, joinedGuildOfGroup, promotionTextId, membershipKey, joinDecision,
  guildGroupOfFaction, MERCHANTS_FACTION_ID, INVITATION_ONLY,
  getTitle, questRankFor, guildFactionIdOfGroup,
  newMembershipStore, membershipsFor, clearMembershipData,
} from '../src/systems/guilds.js';
import { createFactionRep, setReputation } from '../src/systems/factionRep.js';
import { FactionFile, GUILD_GROUPS } from '../src/formats/factionFile.js';
import { SKILLS } from '../src/systems/skills.js';
import { templeOf, orderOf, resolveVariantGuild, DIVINES, ORDERS } from '../src/systems/guildVariants.js';

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
// AUDIT 21 F1: THE THIEVES GUILD AND THE DARK BROTHERHOOD NEVER EXPEL.
//
// ThievesGuild.cs:121-131 and DarkBrotherhood.cs:126-136 both override
// CalculateNewRank as AllowGuildExpulsion(player, base.CalculateNewRank(...)),
// which clamps a negative rank to 0. DFU's own comment: the thieves guild
// "never expel members (I assume at some point they 'retire' you instead!)".
//
// The port had ONE calculateNewRank for all six guilds, so a member of either
// with negative reputation was expelled outright - the membership deleted -
// and both are joinable only by an initiation quest, so it could not be
// undone. The clamp has to wrap the WHOLE base call, including its early
// return for negative reputation, which is the branch that actually fires.
// ---------------------------------------------------------------------------

test('AUDIT 21 F1: TG and DB clamp to rank 0 where the others expel', () => {
  const entity = { level: 10, skills: {} };
  const at = (guild, rep) => calculateNewRank(entity, guild,
    { dict: new Map([[guild.factionId, { rep }]]) });

  for (const name of ['ThievesGuild', 'DarkBrotherhood']) {
    const g = GUILDS[name];
    assert.equal(g.neverExpels, true, `${name} must be marked as never expelling`);
    for (const rep of [-1, -30, -100]) {
      assert.equal(at(g, rep), 0, `${name} at rep ${rep} demotes to 0, never below`);
    }
  }
  // Every OTHER guild still expels - the clamp must not leak.
  for (const name of ['FightersGuild', 'MagesGuild']) {
    const g = GUILDS[name];
    assert.notEqual(g.neverExpels, true, `${name} does expel`);
    assert.equal(at(g, -30), -1, `${name} at rep -30 still expels`);
  }
});

test('AUDIT 21 F1: expulsion never REMOVES a TG or DB membership', () => {
  // The end-to-end consequence, through updateRank - which is what deletes
  // the record. A clamp that only fixed the number would still be wrong
  // here if updateRank read the rank a second way.
  const entity = { level: 10, skills: {} };
  for (const name of ['ThievesGuild', 'DarkBrotherhood']) {
    const g = GUILDS[name];
    // Memberships are a plain object keyed by GUILD GROUP, not by name -
    // one HolyOrder slot has to remember which temple.
    const memberships = {};
    joinGuild(memberships, g, 0);
    memberships[membershipKey(g)].rank = 4;
    const store = { dict: new Map([[g.factionId, { rep: -50 }]]) };
    // Far enough past the join that the 28-day rank clock has elapsed.
    const out = updateRank(memberships, g, entity, store, 400 * 24 * 60 * 60 * 1000);
    assert.notEqual(out?.outcome, 'expulsion', `${name} must not be expelled`);
    assert.ok(membershipOf(memberships, g), `${name}'s membership must survive`);
    assert.equal(membershipOf(memberships, g).rank, 0, 'demoted to 0 instead');
  }
});

// ---------------------------------------------------------------------------
// AUDIT 21 F2: THE JOIN GATES, in DFU's order.
//
// JoinButton_OnMouseClick (DaggerfallGuildServicePopupWindow.cs:498-524) runs
// three checks and the port had only the third:
//   1. JoinGuild(group, factionId) RETURNS THE GUILD ALREADY IN THAT SLOT
//   2. if (!guild.IsMember())   <- nothing happens at all when it is
//   3. IsEligibleToJoin
// joinGuild ASSIGNS into the group slot, so without gates 1 and 2 a rank-7
// member could re-join and reset to rank 0, and a Patriarch of Mara could
// trade a lifetime in her temple for rank 0 in Arkay's.
// ---------------------------------------------------------------------------

test('AUDIT 21 F2: an existing member is offered NOTHING', () => {
  const day = { year: 405, dayOfYear: 1 };
  const g = GUILDS.FightersGuild;
  const entity = withSkills(g, 100);        // comfortably over every bar
  const store = { dict: new Map([[g.factionId, { rep: 50 }]]) };

  // Eligible and not yet a member: the dialogue is offered.
  assert.equal(joinDecision(entity, g, store, {})?.eligible, true);

  // A member of the same guild - at ANY rank - gets no dialogue at all.
  for (const rank of [0, 3, 7]) {
    const m = {};
    joinGuild(m, g, day);
    membershipOf(m, g).rank = rank;
    assert.equal(joinDecision(entity, g, store, m), null,
      `a rank-${rank} member must not be offered the join dialogue`);
    // And the membership is untouched by asking.
    assert.equal(membershipOf(m, g).rank, rank);
  }
});

test('AUDIT 21 F2: holding one temple blocks joining another', () => {
  // The slot hands back MARA, IsMember is true, and the window closes -
  // so the eligibility of Arkay's temple is never even consulted.
  const day = { year: 405, dayOfYear: 1 };
  const arkay = templeOf('Arkay');
  const mara = templeOf('Mara');
  const entity = withSkills(arkay, 100);
  const store = { dict: new Map([[arkay.factionId, { rep: 90 }], [mara.factionId, { rep: 90 }]]) };

  const m = {};
  joinGuild(m, mara, day);
  assert.equal(joinDecision(entity, arkay, store, m), null,
    'a member of one temple is offered no other');
  assert.equal(joinDecision(entity, mara, store, m), null, 'nor their own again');
  // Mara's membership survives the asking.
  assert.equal(hasJoined(m, mara), true);
  assert.equal(hasJoined(m, arkay), false);

  // The same for the knightly orders, which share the other variant slot.
  const m2 = {};
  joinGuild(m2, orderOf('Rose'), day);
  assert.equal(joinDecision(entity, orderOf('Owl'), store, m2), null);

  // But a DIFFERENT group is unaffected - the gate is per slot, not global.
  assert.notEqual(joinDecision(withSkills(GUILDS.FightersGuild, 100), GUILDS.FightersGuild,
    { dict: new Map([[GUILDS.FightersGuild.factionId, { rep: 50 }]]) }, m), null);
});

test('AUDIT 21 F3: guildOfFaction resolves by GUILD GROUP, over the whole corpus',
  { skip: skipReal }, () => {
    // DFU's GetGuild(factionId) (GuildManager.cs:254-267) calls
    // GetGuildGroup and dispatches on the GROUP. The port matched
    // `g.factionId === factionId` and answered null for everything else -
    // so only the six guilds' OWN faction records resolved, and the ids
    // DFU's building and NPC callers pass in did not.
    //
    // CreateGuildObj's switch (:186-210) implements exactly SIX groups and
    // ends `default: return null`, so a group DFU has no class for must
    // still answer null here. Oblivion is the big one - 209 Daedric
    // factions carry ggroup 2 and DFU has no OblivionGuild.
    const ff = new FactionFile();
    ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
    const dict = ff.factionDict;
    const resolve = resolveVariantGuild(dict);        // curried: ONE argument

    const IMPLEMENTED = new Set([
      GUILD_GROUPS.FightersGuild, GUILD_GROUPS.MagesGuild, GUILD_GROUPS.HolyOrder,
      GUILD_GROUPS.KnightlyOrder, GUILD_GROUPS.GeneralPopulace, GUILD_GROUPS.DarkBrotherHood,
    ]);
    let carrying = 0, shouldResolve = 0;
    const missed = [], overreached = [];
    for (const [id] of dict) {
      const grp = guildGroupOfFaction(dict, id);
      if (grp === GUILD_GROUPS.None) continue;
      carrying++;
      const got = guildOfFaction(id, resolve, dict);
      if (IMPLEMENTED.has(grp)) {
        shouldResolve++;
        if (!got) missed.push([id, grp]);
      } else if (got) {
        overreached.push([id, grp, got.name]);
      }
    }
    assert.equal(carrying, 307, 'the corpus carries this many guild-group factions');
    assert.equal(shouldResolve, 161, 'of which this many are in a group DFU implements');

    // 98 of those resolve to a guild. The other 63 are SUB-factions of a
    // temple or a knightly order - "Apothecaries of Arkay", "Teachers of
    // Mara", "The Royal Guard" - which carry the group but are not one of
    // the eight divines or ten orders. In DFU Temple.GetDivine and
    // KnightlyOrder.GetOrder THROW for those, and GetGuild(factionId)
    // catches it (:263-266, "Catch erroneous faction data entries") and
    // answers not-a-member. So null is the right answer here too, and this
    // pin holds the split rather than pretending everything resolves.
    assert.equal(shouldResolve - missed.length, 98, 'this many actually resolve');
    assert.equal(missed.length, 63, 'and this many are unplaceable sub-factions');
    assert.ok(missed.every(([, grp]) => grp === GUILD_GROUPS.HolyOrder || grp === GUILD_GROUPS.KnightlyOrder),
      'every unplaceable one is in a VARIANT group - a fixed guild must never miss');

    assert.deepEqual(overreached, [],
      'and a group DFU has no class for must still answer null - Oblivion is not a guild');

    // WITHOUT the dict the old id-match behaviour stands, which is what
    // keeps existing callers working - the group path is additive.
    assert.equal(guildOfFaction(GUILDS.FightersGuild.factionId).name, 'FightersGuild');
    assert.equal(guildOfFaction(9999), null);
  });

// ===========================================================================
// AUDIT 21 F4, F7-F10, F12, F14, F15 - the guilds lane's second half.
// ===========================================================================

test('AUDIT 21 F4: IsSatisfyQuestReqByLevel, and the three lines that read it', () => {
  // Guild.cs:51-54 returns false; MagesGuild.cs:67-70 and
  // KnightlyOrder.cs:83-86 override it to true. Exactly two of the six.
  assert.equal(GUILDS.MagesGuild.questReqByLevel, true);
  assert.equal(orderOf('Rose').questReqByLevel, true);
  for (const g of [GUILDS.FightersGuild, GUILDS.ThievesGuild, GUILDS.DarkBrotherhood, templeOf('Mara')]) {
    assert.ok(!g.questReqByLevel, `${g.name} must NOT satisfy quest requirements by level`);
  }

  // DaggerfallGuildServicePopupWindow.cs:564-568 - the only consumer.
  //   int rank = guild.Rank;
  //   if (guild.IsSatisfyQuestReqByLevel() && playerEntity.Level > rank) rank = playerEntity.Level;
  assert.equal(questRankFor(GUILDS.MagesGuild, 2, 12), 12, 'a level-12 rank-2 mage draws level-12 quests');
  assert.equal(questRankFor(GUILDS.FightersGuild, 2, 12), 2, 'but a fighter draws rank-2 quests');
  assert.equal(questRankFor(orderOf('Hawk'), 3, 9), 9);
  // strictly GREATER than - a level equal to the rank does not override.
  // EQUIVALENT MUTANT, recorded so nobody re-hunts it: `>` -> `>=` cannot be
  // killed, because when playerLevel === rank both branches return the same
  // number. The expression is Math.max either way, in DFU too. The mutation
  // that IS observable - making the flag inert - is killed by the two
  // assertions above.
  assert.equal(questRankFor(GUILDS.MagesGuild, 5, 5), 5);
  assert.equal(questRankFor(GUILDS.MagesGuild, 5, 4), 5, 'and a LOW level never demotes the pool');
});

test('AUDIT 21 F7: getTitle answers null where DFU answers a string we do not have', () => {
  const bob = { name: 'Bob' };
  // Guild.cs:178-181 - the base non-member return IS the player's name.
  for (const g of [GUILDS.FightersGuild, GUILDS.MagesGuild, GUILDS.ThievesGuild]) {
    assert.equal(getTitle({ rank: -1 }, bob, g), 'Bob', `${g.name} non-member reads their name`);
  }
  // Temple.cs:389-398, KnightlyOrder.cs:121-127, DarkBrotherhood.cs:86-92 all
  // override it and return GetLocalizedText("nonMember") instead. Returning
  // 'Bob' there was a WRONG KNOWN value, not a withheld unknown one.
  for (const g of [templeOf('Mara'), orderOf('Rose'), GUILDS.DarkBrotherhood]) {
    assert.equal(getTitle({ rank: -1 }, bob, g), null, `${g.name} non-member is not the player's name`);
    assert.equal(g.nonMemberTitle, 'nonMember');
  }
  // A MEMBER's title is RankTitles[rank] in every guild - localization, withheld.
  for (const g of [GUILDS.FightersGuild, templeOf('Mara')]) {
    assert.equal(getTitle({ rank: 4 }, bob, g), null, `${g.name} member title is withheld, not guessed`);
  }
  // The gendered rank slots are STRUCTURE and are recorded even though the
  // strings are not: Temple 9/6, KnightlyOrder 5, DarkBrotherhood 8.
  assert.deepEqual(templeOf('Arkay').femaleTitleRanks, [9, 6]);
  assert.deepEqual(orderOf('Owl').femaleTitleRanks, [5]);
  assert.deepEqual(GUILDS.DarkBrotherhood.femaleTitleRanks, [8]);
  for (const g of [GUILDS.FightersGuild, GUILDS.MagesGuild, GUILDS.ThievesGuild]) {
    assert.equal(g.femaleTitleRanks, undefined, `${g.name} does not override GetTitle`);
  }
});

test('AUDIT 21 F8: the two invitation-only guilds have an entrance, not just an exit', () => {
  // ThievesGuild.cs:24 and DarkBrotherhood.cs:24 - the quest names
  // GuildManager.cs:53-68 matches on to grant the membership. These are the
  // ONLY way into either guild, and INVITATION_ONLY named only the refusal.
  assert.equal(GUILDS.ThievesGuild.initiationQuest, 'O0A0AL00');
  assert.equal(GUILDS.DarkBrotherhood.initiationQuest, 'L0A01L00');
  assert.deepEqual([...INVITATION_ONLY].sort(), ['DarkBrotherhood', 'ThievesGuild']);
  // and every guild that cannot be applied to must name its initiation quest
  for (const name of INVITATION_ONLY) {
    assert.ok(GUILDS[name].initiationQuest, `${name} is invitation-only and must say by which quest`);
  }
  for (const g of [GUILDS.FightersGuild, GUILDS.MagesGuild]) {
    assert.equal(g.initiationQuest, undefined, `${g.name} is joined by walking in`);
  }
});

test('AUDIT 21 F9: vampMemberships - the second, parallel membership book', () => {
  // GuildManager.cs:105-112. Every read and write goes through ONE property
  // that swaps the whole dictionary on vampirism.
  const store = newMembershipStore();
  const now = { year: 405, dayOfYear: 100 };
  joinGuild(membershipsFor(store, false), GUILDS.FightersGuild, now);

  assert.ok(hasJoined(membershipsFor(store, false), GUILDS.FightersGuild), 'mortal book holds it');
  assert.equal(hasJoined(membershipsFor(store, true), GUILDS.FightersGuild), false,
    'and a vampire reads an EMPTY book - the membership is suspended, not lost');
  // curing swaps it back, untouched
  assert.ok(hasJoined(membershipsFor(store, false), GUILDS.FightersGuild));

  // a PLAIN object is still a membership dictionary, and means the mortal
  // book - which is what every pre-existing caller intends
  const plain = {};
  joinGuild(plain, GUILDS.MagesGuild, now);
  assert.equal(membershipsFor(plain, false), plain);
  assert.equal(membershipsFor(plain, true), plain);

  // ClearMembershipData() (:298-302) clears BOTH books, not the active one.
  joinGuild(membershipsFor(store, true), GUILDS.MagesGuild, now);
  clearMembershipData(store);
  assert.deepEqual(membershipsFor(store, false), {});
  assert.deepEqual(membershipsFor(store, true), {});
});

test('AUDIT 21 F10: GetGuildFactionId, including the two deliberate zeros', () => {
  // GuildManager.cs:74-101.
  assert.equal(guildFactionIdOfGroup(GUILD_GROUPS.FightersGuild), 41);
  assert.equal(guildFactionIdOfGroup(GUILD_GROUPS.MagesGuild), 40);
  assert.equal(guildFactionIdOfGroup(GUILD_GROUPS.GeneralPopulace), 42);
  assert.equal(guildFactionIdOfGroup(GUILD_GROUPS.DarkBrotherHood), 108);
  // "Returns 0 for HolyOrder and KnightlyOrder since they have variants each
  // with different faction ids" - there is no single faction for "a temple".
  //
  // EQUIVALENT MUTANT, recorded so nobody re-hunts it: DELETING the explicit
  // variant branch cannot be killed. The lookup is derived from GUILDS, which
  // holds only the four fixed guilds, so those two groups miss the map and
  // fall to the same 0. DFU's switch has exactly the same property - its two
  // variant cases return what `default:` returns - and it writes them out
  // anyway, with the XML comment above, because the zero is a STATEMENT, not
  // a fallthrough. What IS killable, and pinned here, is the branch answering
  // any NON-zero id.
  assert.equal(guildFactionIdOfGroup(GUILD_GROUPS.HolyOrder), 0);
  assert.equal(guildFactionIdOfGroup(GUILD_GROUPS.KnightlyOrder), 0);
  assert.equal(guildFactionIdOfGroup(GUILD_GROUPS.None), 0, "default: - a group that is not a guild");
  assert.equal(guildFactionIdOfGroup(undefined), 0);
  // and it is the exact inverse of the records, so the two cannot drift
  for (const g of Object.values(GUILDS)) {
    assert.equal(guildFactionIdOfGroup(g.guildGroup), g.factionId, g.name);
  }
});

test('AUDIT 21 F12/F14/F15: the four fixed guilds pinned to literals', () => {
  // WHICH skills (FightersGuild.cs:32-40, MagesGuild.cs:37-44,
  // ThievesGuild.cs:42-50, DarkBrotherhood.cs:42-52) - the rank law's only
  // skill input, previously checked only for being valid skill ids.
  assert.deepEqual([...GUILDS.FightersGuild.skills], [SKILLS.Archery, SKILLS.Axe,
    SKILLS.BluntWeapon, SKILLS.Giantish, SKILLS.LongBlade, SKILLS.Orcish, SKILLS.ShortBlade]);
  assert.deepEqual([...GUILDS.MagesGuild.skills], [SKILLS.Alteration, SKILLS.Destruction,
    SKILLS.Illusion, SKILLS.Mysticism, SKILLS.Restoration, SKILLS.Thaumaturgy]);
  assert.deepEqual([...GUILDS.ThievesGuild.skills], [SKILLS.Backstabbing, SKILLS.Climbing,
    SKILLS.Lockpicking, SKILLS.Pickpocket, SKILLS.ShortBlade, SKILLS.Stealth, SKILLS.Streetwise]);
  assert.deepEqual([...GUILDS.DarkBrotherhood.skills], [SKILLS.Archery, SKILLS.Backstabbing,
    SKILLS.Climbing, SKILLS.CriticalStrike, SKILLS.Daedric, SKILLS.Destruction,
    SKILLS.ShortBlade, SKILLS.Stealth, SKILLS.Streetwise]);

  // The TEXT.RSC records, as literals. Every pin on these used to read the
  // expected value back out of the table under test.
  assert.deepEqual({ ...GUILDS.FightersGuild.text },
    { ineligibleBadRep: 679, ineligibleLowSkill: 680, eligible: 681, welcome: 684, promotion: 686 });
  assert.deepEqual({ ...GUILDS.MagesGuild.text },
    { ineligibleBadRep: 612, ineligibleLowSkill: 611, eligible: 606, welcome: 5293, promotion: 5236 });
  assert.deepEqual({ ...GUILDS.ThievesGuild.text }, { welcome: 5225, promotion: 5235, bribesJudge: 550 });
  assert.deepEqual({ ...GUILDS.DarkBrotherhood.text }, { welcome: 5292, promotion: 666, bribesJudge: 551 });

  // and the per-rank promotion maps (MagesGuild.cs:92-107,
  // ThievesGuild.cs:92-107, DarkBrotherhood.cs:111-123). MagesGuild's 5232
  // PromotionEnchantId is declared but unreachable in DFU too, so it is
  // correctly absent here.
  assert.deepEqual(GUILDS.MagesGuild.promotionByRank, { 2: 5230, 3: 5231, 6: 5233, 8: 5234 });
  assert.deepEqual(GUILDS.ThievesGuild.promotionByRank, { 2: 5226, 4: 5227 });
  assert.deepEqual(GUILDS.DarkBrotherhood.promotionByRank, { 1: 6611, 3: 6612, 5: 6613, 7: 6614 });

  // F15: the membership key IS this value, so pin it by value.
  assert.equal(GUILDS.FightersGuild.guildGroup, GUILD_GROUPS.FightersGuild);
  assert.equal(GUILDS.MagesGuild.guildGroup, GUILD_GROUPS.MagesGuild);
  assert.equal(GUILDS.ThievesGuild.guildGroup, GUILD_GROUPS.GeneralPopulace);
  assert.equal(GUILDS.DarkBrotherhood.guildGroup, GUILD_GROUPS.DarkBrotherHood);
});

test('AUDIT 21 F15: every guild record agrees with the shipped FACTION.TXT ggroup',
  { skip: skipReal }, () => {
    const ff = new FactionFile();
    ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
    const dict = ff.factionDict;
    for (const g of Object.values(GUILDS)) {
      assert.equal(g.guildGroup, guildGroupOfFaction(dict, g.factionId),
        `${g.name}: the record's guildGroup must be the one the real file carries`);
    }
    for (const o of Object.keys(ORDERS)) {
      const rec = orderOf(o);
      assert.equal(rec.guildGroup, guildGroupOfFaction(dict, rec.factionId), `Order:${o}`);
    }
  });
