// THE VARIANT-KEYED GUILDS - Temple (eight divines) and KnightlyOrder
// (ten orders). 1:1 from Daggerfall Unity's Temple.cs and
// KnightlyOrder.cs (MIT, Daggerfall Workshop / Hazelnut).
//
// G1 carried the four guilds that are ONE guild each. These two are
// not: joining "the Temple" means joining Akatosh's or Arkay's, and
// each divine has its own guild skills, its own welcome and promotion
// messages, and its own service ranks. Same for the ten knightly
// orders, which differ by faction and messages but SHARE one skill
// list. Both produce a guild record shaped exactly like G1's, so the
// rank law consumes them without knowing they are variants.
//
// ── the enum value IS the faction id ──────────────────────────────
// Temple.Divines and KnightlyOrder.Orders both encode their faction
// ids as the enum values (Temple.cs :49-59 says so in a comment). All
// eighteen are checked against the real FACTION.TXT by the pins: every
// divine is type God with exactly one child - its templar order - and
// every order is ggroup 9.
//
// ── GetDivine takes the hall OR the order ─────────────────────────
// Temple.GetDivine (:306-321) accepts either a divine's own faction id
// or a TEMPLAR ORDER's, resolving the latter through its parent. So
// walking into the Order of Arkay resolves to Arkay's temple. DFU
// THROWS on anything else; the port returns null and lets the caller
// decide, because a throw here would take a scene host down over a
// mis-clicked building.
import { SKILLS } from './skills.js';
import { GUILD_GROUPS } from '../formats/factionFile.js';

/** Temple.Divines (:49-59) - value = factionId. */
export const DIVINES = Object.freeze({
  Akatosh: 26, Arkay: 21, Dibella: 29, Julianos: 27,
  Kynareth: 35, Mara: 24, Stendarr: 33, Zenithar: 22,
});

/** KnightlyOrder.Orders (:49-61) - value = factionId. */
export const ORDERS = Object.freeze({
  Horn: 411, Dragon: 368, Flame: 410, Hawk: 417, Owl: 413,
  Rose: 409, Wheel: 415, Candle: 408, Raven: 414, Scarab: 416,
});

/** Temple guildSkills (:144-231), per divine. These are the RANK
 *  law's input; the (longer) training lists are a services concern. */
const TEMPLE_SKILLS = Object.freeze({
  Akatosh: [SKILLS.Alteration, SKILLS.Daedric, SKILLS.Destruction, SKILLS.Dragonish,
    SKILLS.LongBlade, SKILLS.Running, SKILLS.Stealth],
  Arkay: [SKILLS.Axe, SKILLS.Backstabbing, SKILLS.Daedric, SKILLS.Destruction,
    SKILLS.Medical, SKILLS.Restoration, SKILLS.ShortBlade],
  Dibella: [SKILLS.Daedric, SKILLS.Etiquette, SKILLS.Illusion, SKILLS.Lockpicking,
    SKILLS.LongBlade, SKILLS.Nymph, SKILLS.Orcish, SKILLS.Restoration],
  Julianos: [SKILLS.Alteration, SKILLS.Daedric, SKILLS.Impish, SKILLS.Lockpicking,
    SKILLS.Mysticism, SKILLS.ShortBlade, SKILLS.Thaumaturgy],
  Kynareth: [SKILLS.Archery, SKILLS.Climbing, SKILLS.Daedric, SKILLS.Destruction,
    SKILLS.Dodging, SKILLS.Dragonish, SKILLS.Harpy, SKILLS.Illusion,
    SKILLS.Jumping, SKILLS.Running, SKILLS.Stealth],
  Mara: [SKILLS.Archery, SKILLS.CriticalStrike, SKILLS.Daedric, SKILLS.Etiquette,
    SKILLS.Harpy, SKILLS.Illusion, SKILLS.Medical, SKILLS.Nymph,
    SKILLS.Restoration, SKILLS.Streetwise],
  Stendarr: [SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.CriticalStrike, SKILLS.Daedric,
    SKILLS.Dodging, SKILLS.Medical, SKILLS.Restoration],
  Zenithar: [SKILLS.BluntWeapon, SKILLS.Centaurian, SKILLS.Daedric, SKILLS.Etiquette,
    SKILLS.Giantish, SKILLS.Harpy, SKILLS.Mercantile, SKILLS.Orcish,
    SKILLS.Pickpocket, SKILLS.Spriggan, SKILLS.Streetwise, SKILLS.Thaumaturgy],
});

/** Temple templeData (:132-142), the whole RankData row per divine.
 *  Ported WHOLE rather than half now and half later, which paid off:
 *  G3 found the first ten columns - the SERVICE ranks - reading in TWO
 *  places, CanAccessService and GetPromotionMsgId.
 *
 *  A -1 column does NOT mean "never", which is what this comment said
 *  until G3 read the gate. CanAccessService tests `serviceRank <= rank`,
 *  so -1 passes at every rank; the service simply is not OFFERED,
 *  because the temple has no NPC for it. The rank gate and the offer
 *  are different things. The same -1 never matches GetPromotionMsgId's
 *  `== rank`, since ranks run 0..9.
 *
 *  Note Arkay's blessing id is 0 - verbatim, not a gap. */
export const TEMPLE_DATA = Object.freeze({
  Akatosh: { library: 2, healing: 1, buyPotions: 4, makePotions: 5, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 7, welcome: 5290, promotion: 5245, templeName: 4058, blessing: 709 },
  Arkay: { library: 3, healing: 0, buyPotions: 1, makePotions: 4, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: 4, summoning: 7, welcome: 5287, promotion: 5242, templeName: 4055, blessing: 0 },
  Dibella: { library: 4, healing: 2, buyPotions: 1, makePotions: 5, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 7, welcome: 5290, promotion: 5247, templeName: 4059, blessing: 712 },
  Julianos: { library: 0, healing: 2, buyPotions: -1, makePotions: -1, buyMagic: 3, makeMagic: 5, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 6, welcome: 6610, promotion: 5246, templeName: 4060, blessing: 710 },
  Kynareth: { library: 4, healing: 1, buyPotions: -1, makePotions: -1, buyMagic: -1, makeMagic: -1, buySpells: 3, makeSpells: 6, soulGems: -1, summoning: 7, welcome: 5290, promotion: 5249, templeName: 4062, blessing: 717 },
  Mara: { library: 4, healing: 1, buyPotions: 2, makePotions: 5, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 7, welcome: 5289, promotion: 5244, templeName: 4057, blessing: 707 },
  Stendarr: { library: 4, healing: 0, buyPotions: 2, makePotions: 5, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 7, welcome: 5289, promotion: 5248, templeName: 4061, blessing: 716 },
  Zenithar: { library: 4, healing: 1, buyPotions: 1, makePotions: 6, buyMagic: -1, makeMagic: -1, buySpells: -1, makeSpells: -1, soulGems: -1, summoning: 8, welcome: 5288, promotion: 5243, templeName: 4056, blessing: 705 },
});

/** Temple.cs :27-29 - shared across every divine. */
export const TEMPLE_TEXT = Object.freeze({ ineligibleBadRep: 745, ineligibleLowSkill: 744, eligible: 740 });

/** Temple.cs :31-41 - the promotion record per SERVICE, which is what
 *  makes the service-rank columns load-bearing: RankData.GetPromotionMsgId
 *  asks which service opens AT this rank and announces that one. */
export const TEMPLE_PROMOTION = Object.freeze({
  buyPotions: 6600, library: 6601, makePotions: 6602, soulGems: 6603, summoning: 6604,
  healing: 6605, buySpells: 6606, makeSpells: 6607, buyMagic: 6608, makeMagic: 6609,
  highest: 5241,
});
/** RankData.GetPromotionMsgId, in DFU's own order - rank 9 first, then
 *  the services in declaration order, then the divine's default. */
const TEMPLE_SERVICE_ORDER = ['library', 'healing', 'buyPotions', 'makePotions',
  'buyMagic', 'makeMagic', 'buySpells', 'makeSpells', 'soulGems', 'summoning'];
export function templePromotionId(data, rank) {
  if (rank === 9) return TEMPLE_PROMOTION.highest;
  for (const svc of TEMPLE_SERVICE_ORDER) {
    if (data[svc] === rank) return TEMPLE_PROMOTION[svc];
  }
  return data.promotion;
}

/** KnightlyOrder guildSkills (:67-76). ONE list for all ten orders -
 *  unlike the Temple, the orders differ by faction and message, not by
 *  what they ask of you. */
const KNIGHTLY_SKILLS = Object.freeze([
  SKILLS.Archery, SKILLS.CriticalStrike, SKILLS.Dragonish, SKILLS.Etiquette,
  SKILLS.Giantish, SKILLS.LongBlade, SKILLS.Medical,
]);
/** KnightlyOrder.cs :27-31. */
export const KNIGHTLY_TEXT = Object.freeze({
  ineligibleBadRep: 751, ineligibleLowSkill: 750, eligible: 752, welcome: 5291, promotion: 5237,
});

/** A Temple as a guild record - the shape G1's rank law consumes. */
export function templeOf(divine) {
  const factionId = DIVINES[divine];
  if (factionId == null) return null;
  const d = TEMPLE_DATA[divine];
  return {
    name: `Temple:${divine}`,
    // ALL EIGHT temples share the HolyOrder membership slot, so a
    // player belongs to at most one - AUDIT 20.
    guildGroup: GUILD_GROUPS.HolyOrder,
    divine,
    factionId,
    skills: TEMPLE_SKILLS[divine],
    text: { ...TEMPLE_TEXT, welcome: d.welcome, promotion: d.promotion },
    promotionForRank: (rank) => templePromotionId(d, rank),
    services: d,
  };
}

/** A knightly order as a guild record. */
export function orderOf(order) {
  const factionId = ORDERS[order];
  if (factionId == null) return null;
  return {
    name: `Order:${order}`,
    // and all ten orders share the KnightlyOrder slot.
    guildGroup: GUILD_GROUPS.KnightlyOrder,
    order,
    factionId,
    skills: KNIGHTLY_SKILLS,
    text: KNIGHTLY_TEXT,
    // KnightlyOrder.GetPromotionMsgId: free rooms at 4, free ships at
    // 6. Rank 9 is OwnsHouse-gated (5240 house / 5241 no-house) and
    // banking does not exist yet, so it is FLAGGED to the banking
    // slice and rank 9 takes the plain promotion message.
    promotionByRank: { 4: 5238, 6: 5239 },
  };
}

const DIVINE_BY_ID = new Map(Object.entries(DIVINES).map(([k, v]) => [v, k]));
const ORDER_BY_ID = new Map(Object.entries(ORDERS).map(([k, v]) => [v, k]));

/** Temple.GetDivine (:306-321). Accepts a divine's own faction id OR a
 *  TEMPLAR ORDER's, resolving the latter through its parent - so the
 *  Order of Arkay answers Arkay.
 *
 *  DEPARTURE: DFU throws ArgumentOutOfRangeException for anything
 *  else. GuildManager.GetGuild(:262-266) then catches that exact type
 *  with the comment "Catch erroneous faction data entries. (e.g. #91)"
 *  - so a throw here is EXPECTED traffic in DFU, not an error. The
 *  port returns null instead: same control flow, without an exception
 *  on a routine path that a scene host would have to guard. */
export function getDivine(factionDict, factionId) {
  const direct = DIVINE_BY_ID.get(factionId);
  if (direct) return direct;
  const f = factionDict?.get(factionId);
  return (f && DIVINE_BY_ID.get(f.parent)) || null;
}

/** KnightlyOrder.GetOrder (:103-110). No parent walk - the orders are
 *  looked up directly, and DFU throws otherwise. Null here, per the
 *  departure above. */
export const getOrder = (factionId) => ORDER_BY_ID.get(factionId) ?? null;

/** The variant half of GuildManager.GetGuild(factionId): a temple hall,
 *  a TEMPLAR ORDER (which resolves to its divine's temple), or one of
 *  the ten knightly orders. Pass it to guilds.guildOfFaction as
 *  `resolveVariant` - guilds.js cannot import this module without a
 *  cycle, so the resolver travels the other way. */
export const resolveVariantGuild = (factionDict) => (factionId) => {
  const order = getOrder(factionId);
  if (order) return orderOf(order);
  const divine = getDivine(factionDict, factionId);
  return divine ? templeOf(divine) : null;
};
