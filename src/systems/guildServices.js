// GUILD SERVICES - what a guild lets you DO, and at what rank. 1:1
// from Daggerfall Unity's Services.cs and the Benefits/Training
// regions of Guild.cs and its six subclasses (MIT, Daggerfall
// Workshop / Hazelnut).
//
// G1 and G2 built membership and rank. This is what rank BUYS. The
// windows that spend it are their own slice; everything here is law.
//
// ── the service NPC table ─────────────────────────────────────────
// A guild service is offered by a specific NPC, identified by faction
// id, and DFU maps 61 of them by hand. Its own comment says why:
//   "Note this duplicates data from faction.txt mainly because guild
//    flags are not consistent, and also for readability."
// So this table is DELIBERATELY not derived from FACTION.TXT, and the
// port copies it rather than reading the file.
//
// It is copied from DFU's SWITCH, not inferred from the enum names,
// and that matters in exactly three places: MG_BuySpells maps to
// BuySpellsMages (not BuySpells), KO_Smith to ReceiveArmor and
// KO_Seneschal to ReceiveHouse. A name-derived table would have got
// all three wrong; the pins check the whole set against DFU's switch.
//
// ── -1 IN THE TEMPLE TABLE DOES NOT MEAN "NEVER" ──────────────────
// CanAccessService tests `serviceRank <= rank`, so a -1 column passes
// at every rank. It reads as "never offered" only because the temple
// has no NPC for that service, so the question is never asked - the
// rank gate and the OFFER are two different things. The same -1 in
// GetPromotionMsgId never matches, since ranks run 0..9.
//
// ── the fixed-point money formulas ────────────────────────────────
// AlterReward and the reduced-cost pair are C# integer arithmetic:
//     (((10 + rank) << 8) / 10 * reward) >> 8
// The `/ 10` truncates BEFORE the multiply, so this is not the same
// as reward * (10 + rank) / 10. Ported with Math.trunc and the same
// >> 8, which is JS int32 arithmetic and matches for any value that
// fits - the same range C# int holds.
import { SKILLS } from './skills.js';
import { isMember } from './guilds.js';

/** Services.GuildServices - the service kinds. */
export const GUILD_SERVICES = Object.freeze([
  'Training', 'Quests', 'Repair', 'Identify', 'Donate', 'CureDisease',
  'BuyPotions', 'MakePotions', 'BuySpells', 'BuySpellsMages', 'MakeSpells',
  'BuyMagicItems', 'MakeMagicItems', 'SellMagicItems', 'Teleport',
  'DaedraSummoning', 'Spymaster', 'BuySoulgems', 'ReceiveArmor', 'ReceiveHouse',
]);

/** Services.GuildNpcServices -> GuildServices, from DFU's GetService
 *  switch. Key is the NPC's FACTION ID. */
export const NPC_SERVICE = Object.freeze({
  60: 'BuySpellsMages',           // MG_BuySpells
  61: 'Training',                 // MG_Training
  62: 'Teleport',                 // MG_Teleportation
  63: 'Quests',                   // MG_Quests
  64: 'MakeSpells',               // MG_MakeSpells
  65: 'BuyMagicItems',            // MG_BuyMagicItems
  66: 'DaedraSummoning',          // MG_DaedraSummoning
  240: 'Quests',                  // T_Quests
  241: 'Training',                // TAr_Training
  243: 'Training',                // TZe_Training
  245: 'Training',                // TMa_Training
  247: 'Training',                // TAk_Training
  249: 'Training',                // TJu_Training
  250: 'Training',                // TDi_Training
  252: 'Training',                // TSt_Training
  254: 'Training',                // TKy_Training
  453: 'BuyPotions',              // TAr_BuyPotions
  454: 'MakePotions',             // TAr_MakePotions
  455: 'BuySoulgems',             // TAr_BuySoulgems
  456: 'DaedraSummoning',         // TAr_DaedraSummoning
  462: 'BuyPotions',              // TZe_BuyPotions
  463: 'MakePotions',             // TZe_MakePotions
  464: 'DaedraSummoning',         // TZe_DaedraSummoning
  468: 'BuyPotions',              // TMa_BuyPotions
  469: 'MakePotions',             // TMa_MakePotions
  470: 'DaedraSummoning',         // TMa_DaedraSummoning
  473: 'BuyPotions',              // TAk_BuyPotions
  474: 'MakePotions',             // TAk_MakePotions
  475: 'DaedraSummoning',         // TAk_DaedraSummoning
  480: 'BuyMagicItems',           // TJu_BuyMagicItems
  481: 'MakeMagicItems',          // TJu_MakeMagicItems
  482: 'DaedraSummoning',         // TJu_DaedraSummoning
  485: 'BuyPotions',              // TDi_BuyPotions
  487: 'MakePotions',             // TDi_MakePotions
  488: 'DaedraSummoning',         // TDi_DaedraSummoning
  490: 'BuyPotions',              // TSt_BuyPotions
  491: 'MakePotions',             // TSt_MakePotions
  492: 'DaedraSummoning',         // TSt_DaedraSummoning
  496: 'BuySpells',               // TKy_BuySpells
  497: 'MakeSpells',              // TKy_MakeSpells
  498: 'DaedraSummoning',         // TKy_DaedraSummoning
  801: 'Identify',                // MG_Identify
  802: 'MakeMagicItems',          // MG_MakeMagicItems
  803: 'Training',                // TG_Training
  804: 'Quests',                  // TG_Quests
  805: 'SellMagicItems',          // TG_SellMagicItems
  806: 'Spymaster',               // TG_Spymaster
  807: 'Quests',                  // DB_Quests
  810: 'Donate',                  // T_MakeDonation
  813: 'CureDisease',             // T_CureDiseases
  839: 'Training',                // DB_Training
  840: 'MakePotions',             // DB_MakePotions
  841: 'BuyPotions',              // DB_BuyPotions
  842: 'Spymaster',               // DB_Spymaster
  843: 'BuySoulgems',             // DB_BuySoulgems
  845: 'ReceiveArmor',            // KO_Smith
  846: 'Quests',                  // KO_Quests
  848: 'ReceiveHouse',            // KO_Seneschal
  849: 'Training',                // FG_Training
  850: 'Repair',                  // FG_Repair
  851: 'Quests',                  // FG_Quests
});

/** Services.HasGuildService (:277-282), the built-in half: is this NPC
 *  faction a guild service at all? (DFU also consults mod registries,
 *  which the port has no equivalent for.) */
export const hasGuildService = (npcFactionId) => Object.hasOwn(NPC_SERVICE, npcFactionId);
/** Services.GetService. Null for an NPC that offers none. */
export const npcServiceKind = (npcFactionId) => NPC_SERVICE[npcFactionId] ?? null;

// ── training ──────────────────────────────────────────────────────
// Guild.cs :335-346. No guild overrides either method, so the cap is
// flat and the price is the member/non-member split times LEVEL.
export const TRAINING_SKILLS = Object.freeze({
  FightersGuild: [SKILLS.Archery, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.CriticalStrike,
    SKILLS.Giantish, SKILLS.Jumping, SKILLS.LongBlade, SKILLS.Orcish, SKILLS.Running,
    SKILLS.ShortBlade, SKILLS.Swimming],
  MagesGuild: [SKILLS.Alteration, SKILLS.Daedric, SKILLS.Destruction, SKILLS.Dragonish,
    SKILLS.Harpy, SKILLS.Illusion, SKILLS.Impish, SKILLS.Mysticism, SKILLS.Orcish,
    SKILLS.Restoration, SKILLS.Spriggan, SKILLS.Thaumaturgy],
  ThievesGuild: [SKILLS.Backstabbing, SKILLS.BluntWeapon, SKILLS.Climbing, SKILLS.Dodging,
    SKILLS.Jumping, SKILLS.Lockpicking, SKILLS.Pickpocket, SKILLS.ShortBlade,
    SKILLS.Stealth, SKILLS.Streetwise, SKILLS.Swimming],
  DarkBrotherhood: [SKILLS.Archery, SKILLS.Backstabbing, SKILLS.Climbing, SKILLS.CriticalStrike,
    SKILLS.Daedric, SKILLS.Destruction, SKILLS.Dodging, SKILLS.Running, SKILLS.ShortBlade,
    SKILLS.Stealth, SKILLS.Streetwise, SKILLS.Swimming],
});

/** Temple trainingSkills (:232-273), per divine - LONGER than the
 *  guild-skill lists the rank law reads, and a different set. */
export const TEMPLE_TRAINING_SKILLS = Object.freeze({
  Akatosh: [SKILLS.Alteration, SKILLS.Archery, SKILLS.Daedric, SKILLS.Destruction,
    SKILLS.Dragonish, SKILLS.LongBlade, SKILLS.Running, SKILLS.Stealth, SKILLS.Swimming],
  Arkay: [SKILLS.Axe, SKILLS.Backstabbing, SKILLS.Climbing, SKILLS.CriticalStrike,
    SKILLS.Daedric, SKILLS.Destruction, SKILLS.Medical, SKILLS.Restoration, SKILLS.ShortBlade],
  Dibella: [SKILLS.Daedric, SKILLS.Etiquette, SKILLS.Harpy, SKILLS.Illusion, SKILLS.Lockpicking,
    SKILLS.LongBlade, SKILLS.Nymph, SKILLS.Orcish, SKILLS.Restoration, SKILLS.Streetwise],
  Julianos: [SKILLS.Alteration, SKILLS.CriticalStrike, SKILLS.Daedric, SKILLS.Impish,
    SKILLS.Lockpicking, SKILLS.Mercantile, SKILLS.Mysticism, SKILLS.ShortBlade, SKILLS.Thaumaturgy],
  Kynareth: [SKILLS.Archery, SKILLS.Climbing, SKILLS.Daedric, SKILLS.Destruction, SKILLS.Dodging,
    SKILLS.Dragonish, SKILLS.Harpy, SKILLS.Illusion, SKILLS.Jumping, SKILLS.Running, SKILLS.Stealth],
  Mara: [SKILLS.Archery, SKILLS.CriticalStrike, SKILLS.Daedric, SKILLS.Etiquette, SKILLS.Harpy,
    SKILLS.Illusion, SKILLS.Medical, SKILLS.Nymph, SKILLS.Restoration, SKILLS.Streetwise],
  Stendarr: [SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.CriticalStrike, SKILLS.Daedric,
    SKILLS.Dodging, SKILLS.Medical, SKILLS.Orcish, SKILLS.Restoration, SKILLS.Spriggan],
  Zenithar: [SKILLS.BluntWeapon, SKILLS.Centaurian, SKILLS.Daedric, SKILLS.Etiquette,
    SKILLS.Giantish, SKILLS.Harpy, SKILLS.Mercantile, SKILLS.Orcish, SKILLS.Pickpocket,
    SKILLS.Spriggan, SKILLS.Streetwise, SKILLS.Thaumaturgy],
});

/** Which skills a guild will train. NULL for a knightly order, which
 *  trains NOTHING - KnightlyOrder.cs:81 returns null outright, and
 *  that is a law rather than a gap. */
export function trainingSkills(guild) {
  if (guild.divine) return TEMPLE_TRAINING_SKILLS[guild.divine];
  if (guild.order) return null;
  return TRAINING_SKILLS[guild.name] ?? null;
}

/** GetTrainingMax (:335-338): defaultTrainingMax, and no guild
 *  overrides it. Training cannot take a skill past 50. */
export const trainingMax = () => 50;

/** GetTrainingPrice (:340-344): the member/non-member split times the
 *  player's LEVEL - so training scales with the character, not the
 *  skill. */
export function trainingPrice(membership, level) {
  return (isMember(membership) ? 100 : 400) * level;
}

// ── the rank gates ────────────────────────────────────────────────
/** Guild.CanAccessService (:265-288) - the base every guild but the
 *  Temple uses. Note Quests, Identify, Donate, CureDisease and
 *  BuySpellsMages are open to NON-MEMBERS; Training and Repair are not. */
function baseCanAccessService(membership, service) {
  switch (service) {
    case 'Training': return isMember(membership);
    case 'Quests': return true;
    case 'Repair': return isMember(membership);
    case 'Identify': return true;
    case 'BuySpells': return false;
    case 'BuySpellsMages': return true;
    case 'Donate': return true;
    case 'CureDisease': return true;
    default: return false;
  }
}

/** Temple.CanAccessService (:471-504): its own switch, gated on the
 *  divine's SERVICE-RANK columns. Training and Quests are open to
 *  anyone here - a temple trains non-members, where a guild does not. */
function templeCanAccessService(guild, membership, service) {
  const d = guild.services, rank = membership?.rank ?? -1;
  switch (service) {
    case 'Training': return true;
    case 'Quests': return true;
    case 'Donate': return true;
    case 'CureDisease': return true;
    case 'BuyPotions': return d.buyPotions <= rank;
    case 'MakePotions': return d.makePotions <= rank;
    case 'BuySpells': return d.buySpells <= rank;
    case 'MakeSpells': return d.makeSpells <= rank;
    case 'BuyMagicItems': return d.buyMagic <= rank;
    case 'MakeMagicItems': return d.makeMagic <= rank;
    case 'DaedraSummoning': return d.summoning <= rank;
    case 'BuySoulgems': return d.soulGems <= rank;
    default: return false;
  }
}

/** AUDIT 23 (guilds-1): the four subclass overrides the port had
 *  dropped, each a verbatim switch. Note every one REPLACES the base
 *  switch entirely - DFU's overrides do not fall through to Guild.cs,
 *  so MagesGuild loses the base's Repair/Donate/CureDisease arms and
 *  the Thieves/Brotherhood lose Identify, exactly as here. */
function magesCanAccessService(membership, service) {
  const rank = membership?.rank ?? -1;
  switch (service) {   // MagesGuild.cs:134-161
    case 'Training': return isMember(membership);
    case 'Quests': return true;
    case 'Identify': return true;
    case 'BuySpellsMages': return true;
    case 'MakeSpells': return isMember(membership);
    case 'BuyMagicItems': return rank >= 3;
    case 'MakeMagicItems': return rank >= 5;
    case 'Teleport': return rank >= 8;
    case 'DaedraSummoning': return rank >= 6;
    case 'BuySoulgems': return rank >= 4;
    default: return false;
  }
}
function thievesCanAccessService(membership, service) {
  const rank = membership?.rank ?? -1;
  switch (service) {   // ThievesGuild.cs:146-162
    case 'Training': return isMember(membership);
    case 'Quests': return true;
    case 'SellMagicItems': return rank >= 2;
    case 'Spymaster': return rank >= 4;
    default: return false;
  }
}
function brotherhoodCanAccessService(membership, service) {
  const rank = membership?.rank ?? -1;
  switch (service) {   // DarkBrotherhood.cs:151-171
    case 'Training': return isMember(membership);
    case 'Quests': return true;
    case 'BuyPotions': return rank >= 1;
    case 'MakePotions': return rank >= 3;
    case 'BuySoulgems': return rank >= 5;
    case 'Spymaster': return rank >= 7;
    default: return false;
  }
}
function knightlyCanAccessService(membership, service) {
  switch (service) {   // KnightlyOrder.cs:176-189
    case 'Quests': return true;
    case 'ReceiveArmor': return isMember(membership);
    case 'ReceiveHouse': return true;
    default: return false;
  }
}

export function canAccessService(guild, membership, service) {
  if (guild.divine) return templeCanAccessService(guild, membership, service);
  if (guild.order) return knightlyCanAccessService(membership, service);
  switch (guild.name) {
    case 'MagesGuild': return magesCanAccessService(membership, service);
    case 'ThievesGuild': return thievesCanAccessService(membership, service);
    case 'DarkBrotherhood': return brotherhoodCanAccessService(membership, service);
    default: return baseCanAccessService(membership, service);
  }
}

/** Temple.CanAccessLibrary (:466-469) + MagesGuild.CanAccessLibrary
 *  (:129-132, rank >= 2 - AUDIT 23 guilds-6); false everywhere else. */
export function canAccessLibrary(guild, membership) {
  if (guild.name === 'MagesGuild') return (membership?.rank ?? -1) >= 2;
  if (!guild.divine) return false;
  return guild.services.library <= (membership?.rank ?? -1);
}

// ── the benefits ──────────────────────────────────────────────────
// Guild.cs's virtuals default to false / the price unchanged; only the
// guilds listed here override one.

/** The fixed-point scale DFU uses for both directions. `/ 10`
 *  TRUNCATES before the multiply, so this is NOT price * (10-rank)/10. */
const scaleByRank = (n, price) => (Math.trunc((n << 8) / 10) * price) >> 8;

/** FightersGuild.CanRest - members may rest in the hall. */
export const canRest = (guild, m) => guild.name === 'FightersGuild' && isMember(m);

/** HallAccessAnytime: rank 6 for the Fighters and Mages guilds, plain
 *  membership for the Thieves Guild and the Dark Brotherhood - whose
 *  halls are not open to the public at any hour. */
export function hallAccessAnytime(guild, m) {
  switch (guild.name) {
    case 'FightersGuild':
    case 'MagesGuild': return (m?.rank ?? -1) >= 6;
    case 'ThievesGuild':
    case 'DarkBrotherhood': return isMember(m);
    default: return false;
  }
}

/** Temple.FreeHealing - at the divine's own healing rank. */
export const freeHealing = (guild, m) =>
  !!guild.divine && guild.services.healing <= (m?.rank ?? -1);

/** MagesGuild.FreeMagickaRecharge - and note WHO it is for: a member
 *  whose career cannot regenerate spell points at all. The guild's
 *  perk exists for the Sorcerer, and reads the same career flag U20b
 *  writes. */
export const freeMagickaRecharge = (guild, m, entity) =>
  guild.name === 'MagesGuild' && isMember(m) && !!entity?.career?.noRegenSpellPoints;

/** KnightlyOrder.FreeTavernRooms: rank 4, OR anywhere in the order's
 *  OWN REGION at any rank - a knight is a local somebody at home. */
export function freeTavernRooms(guild, m, { regionIndex = null, orderRegion = null } = {}) {
  if (!guild.order) return false;
  if ((m?.rank ?? -1) >= 4) return true;
  return regionIndex != null && orderRegion != null && regionIndex === orderRegion;
}

/** KnightlyOrder.FreeShipTravel - rank 6. */
export const freeShipTravel = (guild, m) => !!guild.order && (m?.rank ?? -1) >= 6;

/** FightersGuild.AlterReward - a member's quest reward GROWS with rank. */
export const alterReward = (guild, m, reward) =>
  (guild.name === 'FightersGuild' ? scaleByRank(10 + (m?.rank ?? 0), reward) : reward);

/** FightersGuild.ReducedRepairCost - and it shrinks the cost. */
export const reducedRepairCost = (guild, m, price) =>
  (guild.name === 'FightersGuild' ? scaleByRank(10 - (m?.rank ?? 0), price) : price);

/** Temple.ReducedCureCost - ARKAY ONLY. The god of burial and the
 *  cycle of life is the one who discounts curing you. */
export const reducedCureCost = (guild, m, price) =>
  (guild.divine === 'Arkay' ? scaleByRank(10 - (m?.rank ?? 0), price) : price);
