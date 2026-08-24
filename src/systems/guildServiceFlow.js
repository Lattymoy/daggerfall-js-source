// U23: THE GUILD SERVICE POPUP'S LAW HALF. 1:1 from Daggerfall
// Unity's DaggerfallGuildServicePopupWindow.cs and the routing block
// of PlayerActivate.StaticNPCClick (MIT, Daggerfall Workshop /
// Hazelnut). Unity plumbing dropped; the window itself is
// ui/guildServiceWindow.js.
//
// The split is the one G3 already made: guildServices.js holds WHICH
// service an NPC offers and WHO may use it; this file holds what
// CLICKING that NPC does - the routing that picks the popup at all,
// the popup's own OnPush side effects, and the refusal a locked
// service answers with. All of it is headless, so the window is only
// geometry and hit rects.
//
// ── the routing (PlayerActivate.cs :1512-1607) ────────────────────
// StaticNPCClick is a five-way branch on the NPC's faction record and
// the BUILDING's, in this order: guild service, merchant social
// group, witches coven, everything else talks. The two bug-numbered
// escape hatches in the guild branch are verbatim and are named in
// DFU's own comments (t=1238 and t=2037): a holy-order NPC standing
// in a building that is not a divine's, and the Thieves Guild
// spymaster standing in a building with no faction at all, both fall
// back to TALK rather than opening a service menu they have no guild
// for.
import { GUILD_GROUPS, SOCIAL_GROUPS, FACTION_TYPES } from '../formats/factionFile.js';
import { hasGuildService, npcServiceKind, canAccessService } from './guildServices.js';
import { isMember, joinedGuildOfGroup, updateRank } from './guilds.js';
import { isDivine } from './guildVariants.js';

/** The four ids the window quotes by name (:29-32), plus the two
 *  OnPush records and the spymaster greeting (:455). */
export const NO_POTION_INGREDIENTS = 34;
export const SORCEROR_MAGICKA_RECHARGE = 465;
export const TEMPLE_RESET_STATS = 403;
export const INSUFFICIENT_RANK_ID = 3100;
export const YOU_ARE_HEALED_ID = 350;          // DaggerfallUI.MessageBox(350)
export const SPYMASTER_GREETING_ID = 402;
/** Internal_Strings "serviceMembersOnly" - the NON-member refusal,
 *  which is a plain string and not a TEXT.RSC record. */
export const SERVICE_MEMBERS_ONLY = 'My services are reserved for members only.';

/** Services.GetServiceLabelText (Services.cs :354-406), from DFU's
 *  Internal_Strings table. The button label is the ONLY text the
 *  popup draws itself - the rest of its art has the words baked in. */
export const SERVICE_LABEL = Object.freeze({
  Training: 'Training',
  Quests: 'Get Quest',
  Repair: 'Repairs',
  Identify: 'Identify',
  Donate: 'Make Donation',
  CureDisease: 'Cure Disease',
  BuyPotions: 'Buy Potions',
  MakePotions: 'Make Potions',
  BuySpells: 'Buy Spells',
  BuySpellsMages: 'Buy Spells',      // the two share one label (:379-381)
  MakeSpells: 'Make Spells',
  BuyMagicItems: 'Buy Magic Items',
  MakeMagicItems: 'Make Magic Items',
  SellMagicItems: 'Sell Magic Items',
  Teleport: 'Teleportation',
  DaedraSummoning: 'Daedra Summoning',
  Spymaster: 'Spymaster',
  BuySoulgems: 'Buy Soulgems',
  ReceiveArmor: 'Receive Armor',
  ReceiveHouse: 'Receive House',
});
export const serviceLabel = (service) => SERVICE_LABEL[service] ?? '?';   // DFU's `default: "?"`

/** GuildNpcServices.TG_Spymaster - the id the t=2037 escape tests. */
export const TG_SPYMASTER_FACTION_ID = 806;   // AUDIT 23 (guilds-3): Services.cs:78 TG_Spymaster = 806 (803 is TG_Training)

/** StaticNPCClick's routing (:1512-1607), as a decision.
 *
 *  `npcFaction` and `buildingFaction` are FACTION.TXT records (or
 *  null). DFU's first act is GetFactionData(npc.Data.factionID) - a
 *  MISS talks, which is why an unknown faction id never reaches the
 *  branch table. A player outside a building, or inside one whose
 *  faction does not resolve, gets ggroup None for the building
 *  exactly as DFU's `buildingFactionData.ggroup = None` does.
 *
 *  Returns { kind, ... }:
 *    guildService  { guildGroup, buildingFactionId }
 *    merchant      { service: 'sell' | 'banking' | 'repair' | 'tavern' }
 *    witchesCoven  {}
 *    talk          { spymaster }   - spymaster is DFU's third
 *                    TalkToStaticNPC argument on the t=2037 path
 */
export function staticNpcRoute({
  npcFactionId, npcFaction, buildingFaction = null, buildingType = -1,
  insideBuilding = true, isShop = () => false, isRepairShop = () => false,
  isBank = () => false, isTavern = () => false, hasCustomMerchantService = () => false,
} = {}) {
  if (!npcFaction) return { kind: 'talk', spymaster: false };
  const buildingGroup = (insideBuilding && buildingFaction)
    ? buildingFaction.ggroup : GUILD_GROUPS.None;
  const buildingFactionId = (insideBuilding && buildingFaction) ? buildingFaction.id : 0;

  if (hasGuildService(npcFactionId)) {
    let guildGroup = buildingGroup;
    if (guildGroup === GUILD_GROUPS.None) {
      // "Use NPC guild group if building has none (e.g. Temple
      // buildings of divine faction)"
      guildGroup = npcFaction.ggroup;
      // The two bug-numbered escapes, verbatim.
      if ((guildGroup === GUILD_GROUPS.HolyOrder && !isDivine(buildingFactionId))
        || (npcFactionId === TG_SPYMASTER_FACTION_ID && buildingFactionId === 0)) {
        return { kind: 'talk', spymaster: npcFactionId === TG_SPYMASTER_FACTION_ID };
      }
    }
    return { kind: 'guildService', guildGroup, buildingFactionId };
  }
  if (npcFaction.sgroup === SOCIAL_GROUPS.Merchants) {
    if (hasCustomMerchantService(npcFactionId)) return { kind: 'merchant', service: 'sell' };
    if (isShop(buildingType)) {
      return { kind: 'merchant', service: isRepairShop(buildingType) ? 'repair' : 'sell' };
    }
    if (isBank(buildingType)) return { kind: 'merchant', service: 'banking' };
    if (isTavern(buildingType)) return { kind: 'merchant', service: 'tavern' };
    return { kind: 'talk', spymaster: false };
  }
  if (npcFaction.type === FACTION_TYPES.WitchesCoven) return { kind: 'witchesCoven' };
  return { kind: 'talk', spymaster: false };
}

/** Setup's membership flag (:107-112). It decides ONE thing: which
 *  IMG the popup draws, i.e. whether a Join Guild button exists.
 *  The Dark Brotherhood and the general populace are FORCED member -
 *  "exempt Thieves Guild and Dark Brotherhood since should never find
 *  em until a member", and the Thieves Guild's group IS
 *  GeneralPopulace. Note this reads the GROUP's membership, not this
 *  building's guild: standing in Mara's temple as a member of Arkay's
 *  hides the join button, which is DFU's behaviour. */
export function showsJoinButton(memberships, guildGroup) {
  if (guildGroup === GUILD_GROUPS.DarkBrotherHood || guildGroup === GUILD_GROUPS.GeneralPopulace) return false;
  return !isMember(joinedGuildOfGroup(memberships, guildGroup));
}

/** DoGuildService's access gate (:311-329). A MEMBER of too low a
 *  rank is told 3100 on a click-anywhere box; a non-member gets the
 *  plain "members only" string. The distinction matters: one says
 *  "come back when you are senior", the other "join first". */
export function serviceAccess(guild, membership, service) {
  if (canAccessService(guild, membership, service)) return { allowed: true };
  return isMember(membership)
    ? { allowed: false, textId: INSUFFICIENT_RANK_ID }
    : { allowed: false, text: SERVICE_MEMBERS_ONLY };
}

/** Whether any live effect is holding an attribute DOWN -
 *  EntityEffectManager.HasDamagedAttributes (:1570-1582), over the
 *  port's activeEffects shape (statMods.js's readers): a drain or
 *  transfer entry, or a disease/poison carrying a negative statMods
 *  column. DFU asks each live effect whether AllAttributesHealed;
 *  the port has no per-effect statMods array, so the same question is
 *  asked of the contributions themselves. */
export function hasDamagedAttributes(entity) {
  for (const a of entity?.activeEffects ?? []) {
    if (a.kind === 'drainAttribute' || a.kind === 'transferAttribute') {
      if ((a.magnitude ?? 0) > 0) return true;
      continue;
    }
    if (a.kind === 'disease' || a.kind === 'poison') {
      for (const v of Object.values(a.statMods ?? {})) if (v < 0) return true;
    }
  }
  return false;
}

/** CureAllAttributes (:1548-1557) - ConfirmStatReset's Yes branch.
 *  DFU calls CureAttributeDamage on every live effect, which zeroes
 *  that effect's statMods without ending the effect. The port's
 *  equivalent is to drop the attribute contribution and leave the
 *  entry: a drain becomes magnitude 0, a disease's negative columns
 *  clear. Returns the number of contributions cured. */
export function cureAllAttributes(entity) {
  let n = 0;
  for (const a of entity?.activeEffects ?? []) {
    if (a.kind === 'drainAttribute' || a.kind === 'transferAttribute') {
      if ((a.magnitude ?? 0) > 0) { a.magnitude = 0; n++; }
      continue;
    }
    if (a.kind === 'disease' || a.kind === 'poison') {
      for (const [k, v] of Object.entries(a.statMods ?? {})) if (v < 0) { a.statMods[k] = 0; n++; }
    }
  }
  return n;
}

/** OnPush (:158-205), as an ORDERED list of what the popup owes the
 *  player the moment it opens. The window renders them as a stack of
 *  message boxes; the SIDE EFFECTS (the rank move, the heal, the
 *  recharge) have already happened when this returns, exactly as
 *  DFU's do - it heals first and shows the box second.
 *
 *  Each step is { textId } for a click-anywhere box, or
 *  { textId, buttons: 'YesNo', onYes } for the stat-reset prompt.
 *
 *  `freeHealing` / `freeMagickaRecharge` are passed in rather than
 *  imported-and-called so the caller keeps guildServices.js's exact
 *  argument list (the magicka one needs the entity's career). */
export function onPushEffects(entity, guild, memberships, store, now, {
  freeHealing = false, freeMagickaRecharge = false, revealLocation = null,
} = {}) {
  const steps = [];
  // Check guild advancement. UpdateRank returns tokens only when the
  // rank actually MOVED; the port's returns the outcome + new rank.
  // G8: revealLocation is the host's DiscoverRandomLocation seam -
  // the TG rank-6/8 map gates and the DB every-promotion reveal.
  const moved = updateRank(memberships, guild, entity, store, now, { revealLocation });
  if (moved) steps.push({ textId: moved.textId, clickAnywhere: true, rankChange: moved });
  if (freeHealing) {
    if ((entity.health ?? 0) < (entity.maxHealth ?? 0)) {
      entity.health = entity.maxHealth;
      steps.push({ textId: YOU_ARE_HEALED_ID, clickAnywhere: true });
    }
    // The stat restoration is a QUESTION, not a gift, and it is asked
    // whether or not the heal above fired.
    if (hasDamagedAttributes(entity)) {
      steps.push({ textId: TEMPLE_RESET_STATS, buttons: 'YesNo', onYes: () => cureAllAttributes(entity) });
    }
  }
  if (freeMagickaRecharge && (entity.magicka ?? 0) < (entity.maxMagicka ?? 0)) {
    steps.push({ textId: SORCEROR_MAGICKA_RECHARGE, clickAnywhere: true });
    entity.magicka = entity.maxMagicka;   // DFU refills AFTER showing the box
  }
  return steps;
}

/** The service the popup's middle button runs, and whether the port
 *  can run it yet. DoGuildService's switch (:334-452) has twenty
 *  arms; the ones whose destination window does not exist are named
 *  here rather than silently doing nothing, so the popup can say
 *  "not yet" the way DFU's own `default:` arm does.
 *
 *  SHIPPED lands in U24 (training, donation, cure disease) and Q4-ii
 *  (Quests -> quest/offerFlow.js's offerGuildQuest, the GetQuest
 *  override's law). Every other arm is FLAGGED with the window it
 *  waits on. */
export const SERVICE_DESTINATION = Object.freeze({
  Training: 'guildServiceTraining',
  Donate: 'guildServiceDonation',
  CureDisease: 'guildServiceCureDisease',
  Quests: 'questOffer',    // Q4-ii: QuestOfferFlow.offerGuildQuest
  Identify: null,          // FLAGGED: DaggerfallTradeWindow Identify mode
  Repair: 'guildServiceRepair',   // R1: the keyed repair flow (FG rank discount rides it)
  BuyPotions: null,        // FLAGGED: trade Buy + CreateRandomPotion
  MakePotions: null,       // FLAGGED: the potion maker
  BuySpells: null,         // FLAGGED: the spellbook's buy mode
  BuySpellsMages: null,    // FLAGGED: the spellbook's buy mode
  MakeSpells: 'guildServiceSpellMaker',   // S1: the keyed spell maker
  BuyMagicItems: null,     // FLAGGED: trade Buy + CreateRandomMagicItem
  MakeMagicItems: null,    // FLAGGED: the item maker
  SellMagicItems: null,    // FLAGGED: trade SellMagic mode
  BuySoulgems: null,       // FLAGGED: trade Buy + the soul-trap stock
  Teleport: null,          // FLAGGED: the travel map's teleport mode
  DaedraSummoning: null,   // FLAGGED: the daedra summoning flow
  Spymaster: null,         // FLAGGED: 402 then the quest offer
  ReceiveArmor: null,      // FLAGGED: the knightly armor gift
  ReceiveHouse: null,      // FLAGGED: banking / house ownership
});
export const serviceDestination = (service) => SERVICE_DESTINATION[service] ?? null;

/** Re-exported so a host wires one import surface (the popup needs
 *  both halves and G3 owns the other one). */
export { hasGuildService, npcServiceKind };
