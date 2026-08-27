// G2: the variant-keyed guilds (Temple's eight divines, KnightlyOrder's
// ten orders) and the join decision. The variant tables ARE faction
// ids, so most of these pin against the real FACTION.TXT - a wrong id
// reads reputation 0 forever and every member sits at rank 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIVINES, ORDERS, TEMPLE_DATA, TEMPLE_TEXT, KNIGHTLY_TEXT, TEMPLE_PROMOTION,
  templeOf, orderOf, getDivine, getOrder, templePromotionId,
  TEMPLE_RANK_TITLES, KNIGHTLY_RANK_TITLES,
} from '../src/systems/guildVariants.js';
import {
  GUILDS, INVITATION_ONLY, isJoinableByApplication, joinDecision,
  calculateNewRank, isEligibleToJoin, promotionTextId,
} from '../src/systems/guilds.js';
import { createFactionRep, setReputation } from '../src/systems/factionRep.js';
import { FactionFile, FACTION_TYPES, GUILD_GROUPS } from '../src/formats/factionFile.js';
import { SKILLS } from '../src/systems/skills.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;
const realFactions = () => {
  const ff = new FactionFile();
  ff.load(readFileSync(join(ARENA2, 'FACTION.TXT')));
  return ff.factionDict;
};
const storeFor = (guild, rep) => {
  const dict = new Map([[guild.factionId, { id: guild.factionId, parent: 0, rep: 0, flags: 0,
    power: 50, ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
    children: null, type: 0, ggroup: 0 }]]);
  const store = createFactionRep(dict);
  setReputation(store, guild.factionId, rep);
  return store;
};
const withSkills = (guild, v, over = {}) => {
  const skills = {};
  for (const s of guild.skills) skills[s] = v;
  return { name: 'Tester', skills: Object.assign(skills, over) };
};

test('variants: eight divines and ten orders, and their enum value IS the faction id', () => {
  assert.equal(Object.keys(DIVINES).length, 8);
  assert.equal(Object.keys(ORDERS).length, 10);
  assert.deepEqual(DIVINES, { Akatosh: 26, Arkay: 21, Dibella: 29, Julianos: 27,
    Kynareth: 35, Mara: 24, Stendarr: 33, Zenithar: 22 });
  assert.deepEqual(ORDERS, { Horn: 411, Dragon: 368, Flame: 410, Hawk: 417, Owl: 413,
    Rose: 409, Wheel: 415, Candle: 408, Raven: 414, Scarab: 416 });
  assert.equal(new Set(Object.values(DIVINES)).size, 8, 'no divine shares a faction');
  assert.equal(new Set(Object.values(ORDERS)).size, 10, 'no order shares a faction');
});

test('variants: every divine is a GOD in the real data, with its templar order as its child', { skip: skipReal }, () => {
  // This is also why S25's propagation has a God branch at all: a
  // temple's reputation walks to its divine root and then to Generic
  // Temple.
  const dict = realFactions();
  for (const [name, id] of Object.entries(DIVINES)) {
    const f = dict.get(id);
    assert.ok(f, `${name}: faction ${id} is not in FACTION.TXT`);
    assert.equal(f.type, FACTION_TYPES.God, `${name} (${id}) must be type God`);
    assert.equal((f.children ?? []).length, 1, `${name} has exactly one child - its templar order`);
  }
  // Zenithar's faction NAME is "Zen" in the shipped file - a data
  // quirk, not a lookup failure.
  assert.equal(dict.get(DIVINES.Zenithar).name, 'Zen');
});

test('variants: every knightly order is ggroup KnightlyOrder in the real data', { skip: skipReal }, () => {
  const dict = realFactions();
  for (const [name, id] of Object.entries(ORDERS)) {
    const f = dict.get(id);
    assert.ok(f, `${name}: faction ${id} is not in FACTION.TXT`);
    assert.equal(f.ggroup, GUILD_GROUPS.KnightlyOrder, `${name} (${id}) must be ggroup 9`);
  }
});

test('variants: GetDivine takes the temple hall OR the templar order', { skip: skipReal }, () => {
  const dict = realFactions();
  for (const [name, id] of Object.entries(DIVINES)) {
    assert.equal(getDivine(dict, id), name, `${name}'s own faction resolves`);
    const child = dict.get(id).children[0];
    assert.equal(getDivine(dict, child), name,
      `${name}'s templar order (${child}, ${dict.get(child).name}) resolves through its parent`);
  }
  assert.equal(getDivine(dict, 999999), null, 'DFU throws here; the port returns null');
  assert.equal(getDivine(dict, GUILDS.FightersGuild.factionId), null, 'a non-temple guild is not a divine');
});

test('variants: GetOrder does NOT walk a parent - only the ten orders resolve', { skip: skipReal }, () => {
  const dict = realFactions();
  for (const [name, id] of Object.entries(ORDERS)) assert.equal(getOrder(id), name);
  // an order's PARENT is a region/court, and must not resolve
  const parent = dict.get(ORDERS.Rose).parent;
  assert.ok(parent, 'the Rose has a parent');
  assert.equal(getOrder(parent), null, 'the parent walk is Temple-only');
  assert.equal(getOrder(999999), null);
});

test('variants: a temple carries its OWN skills and its own welcome, the orders share one list', () => {
  const arkay = templeOf('Arkay');
  const mara = templeOf('Mara');
  assert.notDeepEqual(arkay.skills, mara.skills, 'each divine asks for different skills');
  assert.equal(arkay.text.welcome, TEMPLE_DATA.Arkay.welcome);
  assert.equal(mara.text.welcome, TEMPLE_DATA.Mara.welcome);
  assert.notEqual(arkay.text.welcome, mara.text.welcome);
  assert.equal(arkay.text.ineligibleBadRep, TEMPLE_TEXT.ineligibleBadRep, 'but the refusals are shared');

  const rose = orderOf('Rose');
  const owl = orderOf('Owl');
  assert.deepEqual(rose.skills, owl.skills, 'the ten orders share ONE skill list');
  assert.equal(rose.text.welcome, owl.text.welcome, 'and one message set');
  assert.notEqual(rose.factionId, owl.factionId, 'they differ by faction');

  assert.equal(templeOf('Talos'), null, 'not a divine');
  assert.equal(orderOf('Pigeon'), null, 'not an order');
});

test('variants: TEMPLE_DATA is the whole RankData row, service columns included', () => {
  // Ported whole so the table cannot drift across two slices. The
  // service ranks have no reader yet; -1 means the service never opens.
  for (const [name, d] of Object.entries(TEMPLE_DATA)) {
    for (const k of ['library', 'healing', 'buyPotions', 'makePotions', 'buyMagic',
      'makeMagic', 'buySpells', 'makeSpells', 'soulGems', 'summoning',
      'welcome', 'promotion', 'templeName', 'blessing']) {
      assert.equal(typeof d[k], 'number', `${name}.${k}`);
    }
    assert.ok(d.summoning >= 6 && d.summoning <= 8, `${name}: summoning is the highest-rank service`);
  }
  assert.equal(TEMPLE_DATA.Arkay.blessing, 0, "Arkay's blessing id really is 0 - verbatim");
  assert.equal(TEMPLE_DATA.Julianos.welcome, 6610, 'Julianos alone welcomes on 6610');
  assert.equal(TEMPLE_DATA.Julianos.buyMagic, 3, 'and alone sells magic items');
  assert.equal(TEMPLE_DATA.Kynareth.buySpells, 3, 'Kynareth alone sells spells');
});

test('variants: a temple and an order run the SAME rank law as any guild', () => {
  const t = templeOf('Stendarr');
  assert.equal(calculateNewRank(withSkills(t, 100), t, storeFor(t, 90)), 9);
  assert.equal(calculateNewRank(withSkills(t, 3), t, storeFor(t, 90)), -1);
  const o = orderOf('Candle');
  assert.equal(calculateNewRank(withSkills(o, 100), o, storeFor(o, 40)), 4,
    'reputation 40 clears rows 0-4 and fails row 5');
});

test('guilds: the join decision routes bad-rep and low-skill to DIFFERENT records', () => {
  // A player refused for the wrong reason has been told to fix the
  // wrong thing, and the two are different TEXT.RSC records.
  const g = GUILDS.FightersGuild;
  const bad = joinDecision(withSkills(g, 100), g, storeFor(g, -1));
  assert.deepEqual(bad, { eligible: false, reason: 'reputation', textId: g.text.ineligibleBadRep });

  const unskilled = joinDecision(withSkills(g, 3), g, storeFor(g, 0));
  assert.deepEqual(unskilled, { eligible: false, reason: 'skill', textId: g.text.ineligibleLowSkill });
  assert.notEqual(g.text.ineligibleBadRep, g.text.ineligibleLowSkill, 'and they ARE different records');

  const ok = joinDecision(withSkills(g, 100), g, storeFor(g, 0));
  assert.deepEqual(ok, { eligible: true, textId: g.text.eligible });

  // and it agrees with isEligibleToJoin everywhere
  for (const rep of [-5, 0, 50]) {
    for (const v of [0, 4, 22, 100]) {
      const e = withSkills(g, v);
      assert.equal(joinDecision(e, g, storeFor(g, rep)).eligible,
        isEligibleToJoin(e, g, storeFor(g, rep)), `rep ${rep}, skills ${v}`);
    }
  }
});

test('guilds: the Thieves Guild and the Dark Brotherhood cannot be ASKED to join', () => {
  // ThievesGuild.cs :180-187 and DarkBrotherhood.cs :189-196 both throw
  // NotImplementedException from the eligibility messages - both are
  // joined by INVITATION, through a quest. A law, not an omission.
  assert.deepEqual([...INVITATION_ONLY], ['ThievesGuild', 'DarkBrotherhood']);
  for (const name of INVITATION_ONLY) {
    const g = GUILDS[name];
    assert.equal(isJoinableByApplication(g), false, `${name} has no walk-in application`);
    assert.equal(joinDecision(withSkills(g, 100), g, storeFor(g, 90)), null,
      `${name} refuses the question even from a perfect candidate`);
    assert.equal(g.text.eligible, undefined, 'and carries no eligibility record to show');
  }
  for (const name of ['FightersGuild', 'MagesGuild']) {
    assert.equal(isJoinableByApplication(GUILDS[name]), true);
    assert.ok(GUILDS[name].text.eligible, `${name} has an eligibility record`);
  }
  assert.equal(isJoinableByApplication(templeOf('Mara')), true, 'a temple can be asked');
  assert.equal(isJoinableByApplication(orderOf('Hawk')), true, 'so can an order');
});

test('variants: every variant guild skill is a real skill id', () => {
  const ids = new Set(Object.values(SKILLS));
  for (const d of Object.keys(DIVINES)) {
    const t = templeOf(d);
    assert.ok(t.skills.length >= 7, `${d} has its skill list`);
    for (const s of t.skills) assert.ok(s !== undefined && ids.has(s), `${d}: a skill is not a SKILLS member`);
    assert.equal(new Set(t.skills).size, t.skills.length, `${d}: no skill listed twice`);
  }
  const o = orderOf('Horn');
  for (const s of o.skills) assert.ok(s !== undefined && ids.has(s), 'order skill');
  assert.equal(o.skills.length, 7);
});

// ===========================================================================
// AUDIT 21 F11-F15: THE TABLES THEMSELVES.
//
// The lane's finding, in one line: TEMPLE_DATA is 8 rows x 14 columns = 112
// numbers, and the pins checked 4 of them against a literal, range-checked one
// column, and asserted the other 107 were *of type number*. Scrambling Mara's
// library/healing/buyPotions from (4,1,2) to (9,3,8) left the suite at 36
// pass / 0 fail. The same held for every guild skill list (checked for
// validity, never for content) and for the whole Temple promotion mechanism,
// which survived five independent mutations.
//
// The expected literals below were GENERATED FROM Temple.cs and the subclass
// files - decoding RankData's positional constructor through its own field
// assignments (note `makeItems` -> `this.makeMagic`) - and then diffed against
// the port mechanically. They are not a re-transcription of what the port
// already says, which would pin the port to itself.
// ===========================================================================

/** Temple.cs:132-142, through the RankData ctor at :79-97. */
const TEMPLE_DATA_CSHARP = {
  Akatosh: { library: 2, healing: 1, buyPotions: 4, makePotions: 5, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 7, welcome: 5290, promotion: 5245, templeName: 4058, blessing: 709 },
  Arkay: { library: 3, healing: 0, buyPotions: 1, makePotions: 4, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: 4, summoning: 7, welcome: 5287, promotion: 5242, templeName: 4055, blessing: 0 },
  Dibella: { library: 4, healing: 2, buyPotions: 1, makePotions: 5, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 7, welcome: 5290, promotion: 5247, templeName: 4059, blessing: 712 },
  Julianos: { library: 0, healing: 2, buyPotions: -1, makePotions: -1, buyMagic: 3, makeMagic: 5, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 6, welcome: 6610, promotion: 5246, templeName: 4060, blessing: 710 },
  Kynareth: { library: 4, healing: 1, buyPotions: -1, makePotions: -1, buyMagic: -1, makeMagic: -1, buySpells: 3, makeSpells: 6, soulGems: -1, summoning: 7, welcome: 5290, promotion: 5249, templeName: 4062, blessing: 717 },
  Mara: { library: 4, healing: 1, buyPotions: 2, makePotions: 5, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 7, welcome: 5289, promotion: 5244, templeName: 4057, blessing: 707 },
  Stendarr: { library: 4, healing: 0, buyPotions: 2, makePotions: 5, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 7, welcome: 5289, promotion: 5248, templeName: 4061, blessing: 716 },
  Zenithar: { library: 4, healing: 1, buyPotions: 1, makePotions: 6, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 8, welcome: 5288, promotion: 5243, templeName: 4056, blessing: 705 },
};

test('AUDIT 21 F11: all 112 TEMPLE_DATA values, not four of them', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(TEMPLE_DATA).map(([k, v]) => [k, { ...v }])),
    TEMPLE_DATA_CSHARP);
});

/** Temple.cs:144-230 - the per-divine guild skills, in declaration order.
 *  These are the rank law's ONLY skill input, so a wrong entry silently caps
 *  every member of that temple a rank low. */
const TEMPLE_SKILLS_CSHARP = {
  Akatosh: [SKILLS.Alteration, SKILLS.Daedric, SKILLS.Destruction, SKILLS.Dragonish, SKILLS.LongBlade, SKILLS.Running, SKILLS.Stealth],
  Arkay: [SKILLS.Axe, SKILLS.Backstabbing, SKILLS.Daedric, SKILLS.Destruction, SKILLS.Medical, SKILLS.Restoration, SKILLS.ShortBlade],
  Dibella: [SKILLS.Daedric, SKILLS.Etiquette, SKILLS.Illusion, SKILLS.Lockpicking, SKILLS.LongBlade, SKILLS.Nymph, SKILLS.Orcish, SKILLS.Restoration],
  Julianos: [SKILLS.Alteration, SKILLS.Daedric, SKILLS.Impish, SKILLS.Lockpicking, SKILLS.Mysticism, SKILLS.ShortBlade, SKILLS.Thaumaturgy],
  Kynareth: [SKILLS.Archery, SKILLS.Climbing, SKILLS.Daedric, SKILLS.Destruction, SKILLS.Dodging, SKILLS.Dragonish, SKILLS.Harpy, SKILLS.Illusion, SKILLS.Jumping, SKILLS.Running, SKILLS.Stealth],
  Mara: [SKILLS.Archery, SKILLS.CriticalStrike, SKILLS.Daedric, SKILLS.Etiquette, SKILLS.Harpy, SKILLS.Illusion, SKILLS.Medical, SKILLS.Nymph, SKILLS.Restoration, SKILLS.Streetwise],
  Stendarr: [SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.CriticalStrike, SKILLS.Daedric, SKILLS.Dodging, SKILLS.Medical, SKILLS.Restoration],
  Zenithar: [SKILLS.BluntWeapon, SKILLS.Centaurian, SKILLS.Daedric, SKILLS.Etiquette, SKILLS.Giantish, SKILLS.Harpy, SKILLS.Mercantile, SKILLS.Orcish, SKILLS.Pickpocket, SKILLS.Spriggan, SKILLS.Streetwise, SKILLS.Thaumaturgy],
};

test('AUDIT 21 F12: WHICH skills, not just that they are skills', () => {
  for (const d of Object.keys(DIVINES)) {
    assert.deepEqual([...templeOf(d).skills], TEMPLE_SKILLS_CSHARP[d], `${d} guild skills`);
  }
  // KnightlyOrder.cs:67-75 - one list, shared by all ten orders.
  const knightly = [SKILLS.Archery, SKILLS.CriticalStrike, SKILLS.Dragonish,
    SKILLS.Etiquette, SKILLS.Giantish, SKILLS.LongBlade, SKILLS.Medical];
  for (const o of Object.keys(ORDERS)) {
    assert.deepEqual([...orderOf(o).skills], knightly, `Order:${o} guild skills`);
  }
});

test('AUDIT 21 F13: the Temple promotion mechanism, which had no pin at all', () => {
  // Temple.cs:31-41. Five mutations of this table and its readers all survived.
  assert.deepEqual({ ...TEMPLE_PROMOTION }, {
    buyPotions: 6600, library: 6601, makePotions: 6602, soulGems: 6603, summoning: 6604,
    healing: 6605, buySpells: 6606, makeSpells: 6607, buyMagic: 6608, makeMagic: 6609,
    highest: 5241,
  });

  // RankData.GetPromotionMsgId (Temple.cs:99-125): rank 9 first, then the
  // services in DECLARATION order, then the divine's own default.
  const arkay = TEMPLE_DATA.Arkay;
  assert.equal(templePromotionId(arkay, 9), 5241, 'rank 9 short-circuits before any service');
  assert.equal(templePromotionId(arkay, 0), 6605, 'healing: 0 -> PromotionHealingId');
  assert.equal(templePromotionId(arkay, 1), 6600, 'buyPotions: 1 -> PromotionBuyPotionsId');
  assert.equal(templePromotionId(arkay, 3), 6601, 'library: 3 -> PromotionLibraryId');
  // ARKAY IS THE PRECEDENCE CASE: makePotions and soulGems are BOTH 4, and
  // DFU checks makePotions first. Reordering TEMPLE_SERVICE_ORDER inverts
  // this one answer and nothing else in the table would notice.
  assert.equal(templePromotionId(arkay, 4), 6602, 'makePotions wins over soulGems at rank 4');
  assert.equal(templePromotionId(arkay, 5), 5242, 'no service at 5 -> the divine default');
  assert.equal(templePromotionId(arkay, 7), 6604, 'summoning: 7 -> PromotionSummoningId');

  const jul = TEMPLE_DATA.Julianos;
  assert.equal(templePromotionId(jul, 0), 6601, 'Julianos library: 0');
  assert.equal(templePromotionId(jul, 3), 6608, 'Julianos buyMagic: 3');
  assert.equal(templePromotionId(jul, 5), 6609, 'Julianos makeMagic: 5');
  assert.equal(templePromotionId(jul, 6), 6604, 'Julianos summoning: 6');

  // and the wiring: templeOf -> promotionForRank -> promotionTextId. Deleting
  // either half reduces a temple to one constant message per divine.
  assert.equal(promotionTextId(templeOf('Arkay'), 4), 6602);
  assert.equal(promotionTextId(templeOf('Julianos'), 3), 6608);
  assert.equal(promotionTextId(templeOf('Arkay'), 5), 5242);
});

test('AUDIT 21 F14: the text-record ids are pinned to literals, not to themselves', () => {
  // Every one of these survived a mutation because the pin asked the mutated
  // table what it expected. Temple.cs:27-29 and KnightlyOrder.cs:27-31.
  assert.deepEqual({ ...TEMPLE_TEXT }, { ineligibleBadRep: 745, ineligibleLowSkill: 744, eligible: 740 });
  assert.deepEqual({ ...KNIGHTLY_TEXT }, {
    ineligibleBadRep: 751, ineligibleLowSkill: 750, eligible: 752, welcome: 5291, promotion: 5237,
  });
  // KnightlyOrder.cs:138-148. AUDIT 26 F114 turned the map into
  // GetPromotionMsgId's function: rank 9 consults the host's OwnsHouse
  // (current region), and DFU's ternary is INVERTED as written -
  // owning a house draws PromotionNoHouseId 5241. null falls through
  // to text.promotion (5237), GetPromotionMsgId's own default.
  const pfr = orderOf('Rose').promotionForRank;
  assert.equal(pfr(4), 5238);
  assert.equal(pfr(6), 5239);
  assert.equal(pfr(9, { ownsHouse: () => true }), 5241);
  assert.equal(pfr(9, { ownsHouse: () => false }), 5240);
  assert.equal(pfr(9), 5240, 'no seam in ctx reads as no house');
  assert.equal(pfr(5), null);
});

test('AUDIT 21 F15: guildGroup is pinned by value, on the real corpus', () => {
  // membershipKey(guild) IS guild.guildGroup, so a wrong value silently
  // changes which guilds collide in a membership slot - and the existing
  // "count is 2" pins are satisfied by ANY group value at all.
  assert.equal(GUILD_GROUPS.HolyOrder, 17);
  assert.equal(GUILD_GROUPS.KnightlyOrder, 9);
  for (const d of Object.keys(DIVINES)) {
    assert.equal(templeOf(d).guildGroup, GUILD_GROUPS.HolyOrder, `Temple:${d}`);
  }
  for (const o of Object.keys(ORDERS)) {
    assert.equal(orderOf(o).guildGroup, GUILD_GROUPS.KnightlyOrder, `Order:${o}`);
  }
});

test('U23: the rank-title tables are ten deep and gender-swapped exactly where DFU swaps them', () => {
  // AUDIT 21 F7 could only record WHICH ranks swap - the strings live in
  // Assets/Localization, outside the sparse clone it had. U23 widened the
  // clone and read them, so the structure and the data are pinned together.
  assert.equal(TEMPLE_RANK_TITLES.length, 10);
  assert.equal(KNIGHTLY_RANK_TITLES.length, 10);
  // Temple.cs:389-398 - rank 9 is the top, and the MALE form is the one in
  // the ungendered table (DFU: "Not calling female chars 'Patriarch'!").
  assert.equal(TEMPLE_RANK_TITLES[9], 'Patriarch');
  assert.equal(TEMPLE_RANK_TITLES[6], 'Brother');
  assert.equal(KNIGHTLY_RANK_TITLES[5], 'Knight Brother');
  // and every ungendered slot the swap does NOT cover is shared, so a swap
  // added to the wrong rank shows up as a duplicate string here.
  for (const [tbl, name] of [[TEMPLE_RANK_TITLES, 'Temple'], [KNIGHTLY_RANK_TITLES, 'Order']]) {
    assert.equal(new Set(tbl).size, 10, `${name} rank titles are ten DISTINCT strings`);
    for (const t of tbl) assert.ok(t && t.trim() === t, `${name}: "${t}" is a bare string`);
  }
  // The female overrides are keyed by the same ranks femaleTitleRanks names -
  // a slot named but not filled falls through to the male string in getTitle,
  // which is the silent failure this pins against.
  for (const build of [() => templeOf('Kynareth'), () => orderOf('Candle')]) {
    const g = build();
    for (const r of g.femaleTitleRanks) {
      assert.ok(g.femaleRankTitles[r], `${g.name} rank ${r} is named as swapped and must carry a string`);
      assert.notEqual(g.femaleRankTitles[r], g.rankTitles[r],
        `${g.name} rank ${r} female form differs from the male one`);
    }
    // and nothing is swapped that was not declared.
    assert.deepEqual(Object.keys(g.femaleRankTitles).map(Number).sort(),
      [...g.femaleTitleRanks].sort(), `${g.name} declares exactly the swaps it carries`);
  }
  // ALL EIGHT temples and ALL TEN orders share one table apiece - a per-divine
  // copy would drift.
  for (const d of Object.keys(DIVINES)) assert.equal(templeOf(d).rankTitles, TEMPLE_RANK_TITLES);
  for (const o of Object.keys(ORDERS)) assert.equal(orderOf(o).rankTitles, KNIGHTLY_RANK_TITLES);
});
