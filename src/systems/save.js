// Save/load (Systems S11). DFU's own save system is a JSON
// serialization of live state (SerializablePlayer et al.) - the
// faithful port shape. This slice: THE PLAYER snapshot - entity
// (stats, skills, uses, health/magicka, level sums, career by
// index + data), items, known spells (by SPELLS.STD index),
// active effects, the crime + per-region legal reputation, the
// classic clock, and position. WORLD state SHIPPED at S12: the
// envelope takes {world, locationKey} and the dungeon host snapshots
// foes, piles, dropped loot, action states and door locks (AUDIT 23
// retired the stale 'pends its slice' flag). Still open: the
// mid-flight Move-door tween fields (Ledger C) and cross-location
// travel-on-load. Versioned envelope; a mismatch refuses loudly.

import { clampLegalReputations } from './court.js';   // AUDIT 23 (C4)
import { rebuildEquipState } from './equip.js';   // AUDIT 17e C1
import { goldStack } from './inventory.js';   // AUDIT 17f
import { snapshotDiscovery, restoreDiscovery } from './discovery.js';   // T4

export const SAVE_VERSION = 1;
export const QUICKSAVE_KEY = 'dagger.quicksave';

const ENTITY_FIELDS = [
  'name', 'gender', 'race', 'raceId', 'faceIndex',   // S3c/U9: the identity rides the save
  'careerIndex', 'level', 'reflexes',
  'health', 'maxHealth', 'magicka', 'maxMagicka', 'fatigue',
  'currentBreath',   // P12 (SerializablePlayer carries it; missing = 0/surfaced on old saves)
  'startingLevelUpSkillSum', 'currentLevelUpSkillSum',
  'readyToLevelUp', 'pendingLevel', 'chargenDone',
  // AUDIT 17h F1: the six BIOGRAPHY modifiers, which DFU persists
  // one-for-one (SerializablePlayer.cs:136-141, :305-310). Without
  // them a load reset every biography answer's lasting effect.
  'biographyResistDiseaseMod', 'biographyResistMagicMod', 'biographyAvoidHitMod',
  'biographyResistPoisonMod', 'biographyFatigueMod', 'biographyReactionMod',
  // AUDIT 22 F8: the guild TRAINING cooldown. DFU persists it one for
  // one (SerializablePlayer.cs:126, :294) and the gate is a DIFFERENCE
  // against it, so a save that dropped it reset the clock to 0 and a
  // player could train every skill to its cap by saving and loading
  // between sessions. Twelve hours of a law, undone by a reload.
  'timeOfLastSkillTraining',
  // AUDIT 23 (save-load + entity-laws lanes): timeOfLastSkillIncreaseCheck,
  // persisted one-for-one by DFU (SerializablePlayer.cs:124, :293). Without
  // it a backward load left a FUTURE marker that froze all skill-raise
  // checks until the clock re-passed it.
  'lastSkillCheckTime',
];

/** AUDIT 17h F1: the ELEVEN social-group reputations DFU writes out
 *  field by field (SerializablePlayer.cs:152-162) and the matching
 *  reaction modifiers. Nothing persisted these, so a quicksave/load
 *  reset the player's standing with every social group to zero -
 *  which getReactionToPlayer reads on EVERY greeting, and which the
 *  biography, the T3f tone tallies and the G2 court sentences all
 *  write to. The port has never carried them; the biography made the
 *  gap load-bearing from the first minute of a new character. */
const REP_ARRAYS = ['sGroupReputations', 'reactionMods'];

/** Deep-copy one activeEffects entry: permanent drain entries carry
 *  no effect record (S15); disease entries carry the accumulating
 *  per-stat statMods map (S18) - both nested objects must detach or
 *  the snapshot mutates with the live entity. */
const copyEffectEntry = (a) => {
  const c = { ...a };
  if (a.effect) c.effect = { ...a.effect };
  if (a.statMods) c.statMods = { ...a.statMods };
  return c;
};

/** A plain-object snapshot of the player + scene extras. */
export function snapshotPlayer(entity, { position = null, classicMinutes = 0, readiedSpellIndex = null, world = null, locationKey = null } = {}) {
  const snap = { v: SAVE_VERSION, position, classicMinutes, readiedSpellIndex, world, locationKey };
  for (const k of ENTITY_FIELDS) snap[k] = entity[k];
  snap.stats = { ...entity.stats };
  // AUDIT 17e: pre-chargen the entity carries a flat NUMBER here
  // (playerEntity's INTERIM skills: 30) - spreading it threw.
  snap.skills = Array.isArray(entity.skills) ? [...entity.skills] : entity.skills;
  snap.skillUses = [...(entity.skillUses ?? [])];
  snap.career = entity.career ? { ...entity.career } : null;   // plain CFG data
  snap.items = (entity.items ?? []).map((it) => ({ ...it }));
  // W-slice: the cart's own 750kg collection (PlayerEntity.WagonItems
  // - SerializablePlayer carries wagonItems beside items).
  snap.wagonItems = (entity.wagonItems ?? []).map((it) => ({ ...it }));
  // TP-slice: the Recall anchor (PlayerEntity.AnchorPosition - the
  // Teleport effect stores it on the entity, Teleport.cs:35).
  snap.anchorPosition = entity.anchorPosition ? { ...entity.anchorPosition } : null;
  snap.spells = (entity.spells ?? []).map((sp) => sp.index);   // resolve against SPELLS.STD on load
  snap.activeEffects = (entity.activeEffects ?? []).map(copyEffectEntry);
  for (const k of REP_ARRAYS) snap[k] = entity[k] ? [...entity[k]] : null;
  // AUDIT 18 F3: the CRIME/LEGAL state DFU writes out one field at a
  // time - crimeCommitted and haveShownSurrenderToGuardsDialogue
  // (SerializablePlayer.cs:149-150) and regionData, whose LegalRep the
  // court reads and writes (PlayerEntity.cs:2291-2311). Nothing
  // persisted any of them, so every reload reset the player's standing
  // to spotless: startCourt's severe-punishment thresholds collapsed
  // to 0, penaltyAmount took the legalRep >= 0 arm and pleaNotGuilty's
  // chanceToGoFree gained the whole missing penalty back.
  snap.crimeCommitted = entity.crimeCommitted ?? 0;
  snap.haveShownSurrenderDialogue = !!entity.haveShownSurrenderDialogue;
  // legalRep is a region-keyed object here, not DFU's 62-entry array;
  // it must be COPIED or the snapshot aliases live state.
  snap.legalRep = entity.legalRep ? { ...entity.legalRep } : null;
  // Any biography deltas still parked (only if FACTION.TXT was missing
  // at creation - S25 drains them at the chargen seam otherwise).
  snap.pendingFactionRep = (entity.pendingFactionRep ?? []).map((r) => ({ ...r }));
  snap.backStory = [...(entity.backStory ?? [])];

  // AUDIT 20: THE THIRD REPUTATION CHANNEL. sGroupReputations and
  // legalRep have ridden the envelope for a while; S25's per-FACTION
  // reputation did not, so every backstory `rf` answer and every
  // crime's People-faction delta was lost on load - and guild rank,
  // which is computed from it, silently reset with it.
  //
  // DEPARTURE from DFU's FactionData_v2, which serialises the whole
  // dictionary: the port re-reads FACTION.TXT to build the store, so
  // only the MUTABLE columns need to travel. Three parallel arrays
  // beside a sorted id list - lossless, and a few KB rather than 366
  // whole records. Same shape of decision as legalRep above.
  // AUDIT 22 F7: THE LIT LIGHT SOURCE. DFU writes lightSourceUID and
  // relinks through Items.GetItem(uid) on load (SerializablePlayer.cs
  // :151, :320). The port's entity carried a live OBJECT REFERENCE
  // into entity.items and the envelope carried nothing, so a lit torch
  // went out on every load - and worse, had the reference survived as
  // a copy it could never have matched again, so UseItem's
  // `LightSource == item` douse test would have been permanently
  // false and the torch unquenchable.
  //
  // DEPARTURE (Ledger A): the port's items have no UID, so the INDEX
  // into the items array travels instead. It is exact rather than
  // approximate - snap.items is written and restored in order - and
  // it is the same shape rebuildEquipState already uses to relink the
  // equip table after a restore.
  snap.lightSourceIndex = entity.lightSource
    ? (entity.items ?? []).indexOf(entity.lightSource) : -1;

  // AUDIT 23 C1 (save-load lane + guilds lane, two finders): a store
  // restored into a store-less entity is STASHED (below), and the
  // stash must survive a re-save - writing null here erased every
  // faction reputation in the file the first time a menu-loaded
  // session pressed F9 before anything attached the store.
  snap.factionRep = entity.factionRep
    ? snapshotFactionRep(entity.factionRep)
    : (entity.savedFactionRep ?? null);
  // GuildMembership_v1, keyed by guild GROUP exactly as DFU keys it.
  snap.guildMemberships = entity.guildMemberships
    ? Object.fromEntries(Object.entries(entity.guildMemberships).map(([k, m]) => [k, { ...m }]))
    : null;
  // T4: the building-discovery store (PlayerGPS discoveredLocations -
  // DFU serialises it in SaveData_v1). Module-level world state, so
  // the snapshot reads the store, not the entity.
  snap.discovery = snapshotDiscovery();
  // AUDIT 23 (items lane): RegionData.PriceAdjustment rides DFU's save
  // (SerializablePlayer.cs:168); without it every load rerolled the
  // 750..1250 band and shifted all shop prices mid-session.
  snap.regionPrices = entity.regionPrices ? { ...entity.regionPrices } : null;
  return snap;
}

/** The store's mutable columns, id-sorted so the arrays line up. */
export function snapshotFactionRep(store) {
  const ids = [...store.dict.keys()].sort((a, b) => a - b);
  const rep = [], flags = [], power = [];
  for (const id of ids) {
    const f = store.dict.get(id);
    rep.push(f.rep); flags.push(f.flags); power.push(f.power);
  }
  return { ids, rep, flags, power };
}

/** Write a snapshot back into a LIVE store. The store is rebuilt from
 *  FACTION.TXT at creation, so this only restores what play changed;
 *  an id the file no longer has is skipped rather than invented. */
export function restoreFactionRep(store, snap) {
  if (!store || !snap?.ids) return false;
  for (let i = 0; i < snap.ids.length; i++) {
    const f = store.dict.get(snap.ids[i]);
    if (!f) continue;
    f.rep = snap.rep[i]; f.flags = snap.flags[i]; f.power = snap.power[i];
  }
  return true;
}

/** Restore a snapshot onto the live entity. Returns the scene
 *  extras { position, classicMinutes, readiedSpellIndex } or null
 *  on a version mismatch (loud). */
export function restorePlayer(entity, snap, spellsByIndex = null) {
  if (!snap || snap.v !== SAVE_VERSION) {
    console.warn(`[save] version mismatch (got ${snap?.v}, want ${SAVE_VERSION}); refusing`);
    return null;
  }
  for (const k of ENTITY_FIELDS) entity[k] = snap[k];
  // AUDIT 23 (C4/guilds-4): DFU clamps every region's LegalRep right
  // after restoring it (SerializablePlayer -> ClampLegalReputations) -
  // a save carrying a beyond-band value loads back into the band.
  clampLegalReputations(entity);
  entity.stats = { ...snap.stats };
  // Pre-S15 saves carry no fatigue: default to rested (MaxFatigue =
  // (Str + End) x 64) - the additive-field shape DFU's serializer
  // gives missing members, so the envelope version holds at 1.
  if (entity.fatigue == null) entity.fatigue = ((snap.stats?.strength ?? 0) + (snap.stats?.endurance ?? 0)) * 64;
  entity.skills = Array.isArray(snap.skills) ? [...snap.skills] : snap.skills;   // AUDIT 17e: pre-chargen skills is a flat number
  entity.skillUses = [...snap.skillUses];
  entity.career = snap.career ? { ...snap.career } : entity.career;
  entity.items = snap.items.map((it) => ({ ...it }));
  entity.wagonItems = (snap.wagonItems ?? []).map((it) => ({ ...it }));   // W-slice (pre-W saves restore empty)
  entity.anchorPosition = snap.anchorPosition ? { ...snap.anchorPosition } : null;   // TP-slice
  // AUDIT 17f: a Currency stack saved before gold gained its template
  // index carries none, and stacksWith compares templateIndex - a
  // restored save would grow a SECOND gold stack the next time gold
  // was added, and goldAmount only ever finds the first. The
  // additive-field upgrade DFU's serializer gives missing members.
  for (const it of entity.items) {
    if (it.group === 'Currency' && it.templateIndex == null) Object.assign(it, goldStack(it.stackCount ?? 0));
  }
  // AUDIT 17e C1: the equip table + armor values are DERIVED state -
  // rebuild them from the freshly restored items (SerializablePlayer
  // .cs:301, :355-368). Must run AFTER items are replaced, or the
  // table relinks to the discarded objects.
  rebuildEquipState(entity);
  // AUDIT 22 F7: relink the lit light source to the RESTORED record,
  // beside the equip table for the same reason - both are references
  // into an items array that was just replaced. A snapshot older than
  // this field carries none, which reads as "nothing lit".
  const li = snap.lightSourceIndex ?? -1;
  entity.lightSource = li >= 0 ? (entity.items[li] ?? null) : null;
  entity.activeEffects = snap.activeEffects.map(copyEffectEntry);
  // Missing on a pre-17h save: leave whatever the entity carries (a
  // fresh entity starts every group at zero, which is classic's own
  // starting state), the additive-field shape DFU's serializer gives.
  for (const k of REP_ARRAYS) if (snap[k]) entity[k] = [...snap[k]];
  // AUDIT 18 F3. A snapshot older than this field carries no member,
  // which C#'s deserializer would leave at the type default - 0/false,
  // NOT undefined (SerializablePlayer.cs:317-318 then assigns it).
  // RegionData restores under DFU's own guard (:344-347): present ->
  // take it, absent -> InitializeRegionData, i.e. every region at 0.
  entity.crimeCommitted = snap.crimeCommitted ?? 0;
  entity.haveShownSurrenderDialogue = snap.haveShownSurrenderDialogue ?? false;
  entity.legalRep = snap.legalRep ? { ...snap.legalRep } : {};
  if (snap.pendingFactionRep) entity.pendingFactionRep = snap.pendingFactionRep.map((r) => ({ ...r }));
  if (snap.backStory) entity.backStory = [...snap.backStory];
  // AUDIT 20: the faction store is rebuilt from FACTION.TXT at
  // creation, so a load writes the saved columns back INTO it rather
  // than replacing it. A save from before this field simply leaves the
  // freshly-read values standing - the additive-field shape the
  // fatigue default above already uses, so the envelope version holds.
  // AUDIT 23 C1: the menu LOAD GAME path restores into the pre-chargen
  // entity, which has no faction store (only chargen attaches one), and
  // restoreFactionRep silently no-ops on a null store - DFU can never
  // hit this because PlayerEntity is CONSTRUCTED with FactionData.
  // Stash the columns; attachFactionRep replays them when the store is
  // finally built (guild popup, court, chargen - whichever comes first).
  if (snap.factionRep) {
    if (entity.factionRep) restoreFactionRep(entity.factionRep, snap.factionRep);
    else entity.savedFactionRep = snap.factionRep;
  }
  // AUDIT 23 (save-load lane): GuildManager.RestoreMembershipData
  // clears the book UNCONDITIONALLY before applying data (:321-324),
  // so a save from before any guild contact must reset the book -
  // keeping the live one let later-joined memberships survive a
  // backward load.
  entity.guildMemberships = snap.guildMemberships
    ? Object.fromEntries(
      Object.entries(snap.guildMemberships).map(([k, m]) => [k, { ...m }]))
    : {};
  entity.spells = spellsByIndex
    ? snap.spells.map((i) => spellsByIndex.get(i)).filter(Boolean)
    : [];
  // T4: a load replaces the discovery store; a pre-T4 save carries no
  // field and restores an empty one (nothing was discoverable then).
  restoreDiscovery(snap.discovery);
  // AUDIT 23: the sticky per-region price band (see snapshot side); a
  // pre-fix save re-mints lazily, exactly as an unvisited region does.
  entity.regionPrices = snap.regionPrices ? { ...snap.regionPrices } : {};
  return { position: snap.position, classicMinutes: snap.classicMinutes, readiedSpellIndex: snap.readiedSpellIndex, world: snap.world ?? null, locationKey: snap.locationKey ?? null };
}

/** localStorage backend (absent in headless - callers gate).
 *  setItem THROWS on real browsers - QuotaExceededError when storage
 *  is full, or a SecurityError under private-browsing modes that
 *  disable storage. An unguarded throw here propagates through the F9
 *  handler and kills the frame (the same unguarded-browser-API class
 *  as the bare requestPointerLock crash). Return false on failure so
 *  the caller reports "save failed" instead of crashing. */
export function writeQuicksave(snap, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(QUICKSAVE_KEY, JSON.stringify(snap));
    return true;
  } catch (err) {
    console.warn('[save] quicksave write failed:', err?.name ?? err);
    return false;
  }
}
export function readQuicksave(storage = globalThis.localStorage) {
  if (!storage) return null;
  const raw = storage.getItem(QUICKSAVE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { console.warn('[save] corrupt quicksave'); return null; }
}
