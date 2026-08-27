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
import { restartHeldEnchantments } from './enchantments.js';   // E2: the held bundles' restore half
import { snapshotWeather, restoreWeather } from './weatherSim.js';   // W1: playerPosition.weather (SerializablePlayer.cs:225) - one value, every host
import { snapshotRegionConditions, restoreRegionConditions } from './regionConditions.js';   // S42: the CONDITION half of RegionDataRecord
import { goldStack } from './inventory.js';   // AUDIT 17f
import { snapshotDiscovery, restoreDiscovery } from './discovery.js';   // T4
import { snapshotAutomap, restoreAutomap } from './automap.js';   // A1: dictAutomapDungeonsDiscoveryState rides SaveData_v1
import { createSceneCache, snapshotSceneCache, restoreSceneCache } from './sceneCache.js';   // P1
import { seedCustomSpellIndex } from './spellMaker.js';   // S1: made spells carry their own record
import { seedBundleSeq } from './effects.js';   // X10: the live-bundle counter's restore half
import { SOCIAL_GROUPS } from '../formats/factionFile.js';   // AUDIT 24
import { travelMapSaveData, restoreTravelMapSaveData } from './travelMapState.js';   // U41: TravelMapSaveData
import { resetMagicRoundMarker } from './worldTick.js';   // EntityEffectBroker.InitMagicRoundTimer, on the LOAD arm (:230-233)
import { isMembershipStore } from './guilds.js';   // V2e: the two-book membership store rides the save whole

/** One membership book, rows copied (GuildMembership_v1's shape). */
const copyMembershipBook = (book) => Object.fromEntries(
  Object.entries(book ?? {}).map(([k, m]) => [k, { ...m }]));

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
  // AUDIT 26 F219/F100: the coven's daedra-of-the-day. DFU persists
  // DaedraSummonDay and DaedraSummonIndex one for one
  // (SerializablePlayer.cs:164-165, restored :332-333);
  // daedraForSummoner mutates both onto the entity and nothing saved
  // them, so a reload from a fresh boot re-rolled the prince - a
  // save-scum until the one you want answers - and a backward load
  // kept the post-save roll instead of the saved one.
  'daedraSummonDay', 'daedraSummonIndex',
  // U39: the tavern's hunger clock (SerializablePlayer.cs:147, :316).
  // DoFoodAndDrink's gate is a DIFFERENCE against it, so a save that
  // dropped it would let a player eat every four in-game hours OR
  // every reload, whichever came first.
  'lastTimePlayerAteOrDrankAtTavern',
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
export const copyEffectEntry = (a) => {
  const c = { ...a };
  if (a.effect) c.effect = { ...a.effect };
  if (a.statMods) c.statMods = { ...a.statMods };
  if (a.skillMods) c.skillMods = { ...a.skillMods };   // V2a: the racial override's second map

  // AUDIT 24 (wave 31): the continuous-damage entries carry their CASTER
  // (IEntityEffect.Caster - HandleAttackFromSource needs it to break the
  // caster's normal-power concealment). It is a live scene reference, not
  // state: DFU does not serialize it either - SerializablePlayer writes
  // the bundle settings and RestoreInstancedBundleSaveData re-resolves the
  // caster on load, so a restored effect whose caster is gone simply has
  // none, and HandleAttackFromSource(null) is DFU's own no-op case.
  // Leaving it in would put the whole player entity - and, through the
  // foes, the scene - inside the save envelope.
  delete c.caster;
  return c;
};

/** A plain-object snapshot of the player + scene extras. */
export function snapshotPlayer(entity, { position = null, pose = null, classicMinutes = 0, readiedSpellIndex = null, world = null, locationKey = null, quest = null, talk = null } = {}) {
  // Q4-v: `quest` is the bridge's whole envelope (machine + notebook +
  // the one-time list) - opaque here, exactly like `world`.
  // TK-i: `talk` is TalkManager's SaveDataConversation (the rumor
  // mill's halves for now; TK-ii/TK-iv grow it) - the same shape of
  // slot.
  // AUDIT 26 F222/F223/F101: the POSE - SerializablePlayer saves
  // weaponDrawn (:175, restored `Sheathed = !weaponDrawn` :420-421)
  // and PlayerPositionData_v1 carries yaw, pitch and isCrouching
  // (:212-214). The port had all of it live and saved none, so every
  // load came back sheathed, facing the motor default and standing up
  // - including a save made crouched in a 0.9 crawlspace. The hosts
  // own the live objects, so the envelope takes an opaque
  // { yaw, pitch, crouching, weaponDrawn } bag.
  const snap = { v: SAVE_VERSION, position, pose, classicMinutes, readiedSpellIndex, world, locationKey, quest, talk };
  // W1: DFU persists exactly ONE weather value (playerPosition.weather)
  // and re-rolls the six-zone array on the next date change - the sim
  // is a module singleton, so the envelope reads it here and every
  // host's save carries it without a host edit.
  snap.weather = snapshotWeather();
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
  // R1: PlayerEntity.OtherItems - the in-repair collection
  // (SerializablePlayer.cs:132/:300; each item's repairData rides the
  // plain spread, present only while a job runs).
  snap.otherItems = (entity.otherItems ?? []).map((it) => ({ ...it }));
  // P1: the scene cache and its permanent set (SaveData_v1's
  // sceneCache + permanentScenes). Without it, everything an interior
  // remembers is forgotten by a reload even though it survives a walk
  // outside - which is a worse bug than not remembering at all.
  snap.sceneCache = entity.sceneCache ? snapshotSceneCache(entity.sceneCache) : null;
  // B1: the per-region bank accounts and house deeds
  // (SerializablePlayer/BankRecordData_v1). One record per region, all
  // plain data - gold, the loan and its due date, the defaulted flag.
  // Without these a quicksave/load cleared every account and every
  // outstanding loan, which is a rather generous bug.
  snap.bankAccounts = (entity.bankAccounts ?? []).map((a) => ({ ...a }));
  snap.houses = (entity.houses ?? []).map((h) => ({ ...h }));
  snap.ownedShip = entity.ownedShip ?? -1;
  // U39: PlayerEntity.RentedRooms (SerializablePlayer.cs:169, :336).
  // Each record is plain data - name, mapId, buildingKey, bed index,
  // expiry - so a shallow copy per room is the whole envelope.
  snap.rentedRooms = (entity.rentedRooms ?? []).map((r) => ({ ...r }));
  // TP-slice: the Recall anchor (PlayerEntity.AnchorPosition - the
  // Teleport effect stores it on the entity, Teleport.cs:35).
  snap.anchorPosition = entity.anchorPosition ? { ...entity.anchorPosition } : null;
  // V1: the turn's marker. The infection itself rides activeEffects
  // like any disease, but the moment it DEPLOYS the disease ends and
  // the only record left is this - so a save between the turn and V2's
  // racial override would otherwise come back human, and catchable.
  snap.racialOverridePending = entity.racialOverridePending ? { ...entity.racialOverridePending } : null;
  // S1: a STOCK spell travels as its SPELLS.STD index (the compact
  // shape every pre-S1 save carries); a MADE spell has no file index,
  // so its whole record rides instead. The restore tells them apart
  // by type - number = look it up, object = it IS the spell.
  snap.spells = (entity.spells ?? []).map((sp) => (sp?.custom ? JSON.parse(JSON.stringify(sp)) : sp.index));
  // E2: ITEM-PINNED entries (held enchantments) are NOT serialized -
  // the pin is a live item reference and the snapshot's items are
  // fresh copies, so a saved pin could never re-link. DFU serializes
  // the bundle with its item's UID and discards one that cannot
  // resolve (:2240/:2312); the port re-instantiates from the worn set
  // at restore (restartHeldEnchantments), the same outcome.
  snap.activeEffects = (entity.activeEffects ?? []).filter((a) => !a.heldItem).map(copyEffectEntry);
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
  // V2e: the field is the TWO-BOOK store now (mortal + vampire, both
  // serialized - GetMembershipData(bool vampire), GuildManager
  // :313-320); a legacy plain object still snaps as the mortal book
  // it means.
  snap.guildMemberships = entity.guildMemberships
    ? (isMembershipStore(entity.guildMemberships)
      ? { mortal: copyMembershipBook(entity.guildMemberships.mortal), vampire: copyMembershipBook(entity.guildMemberships.vampire) }
      : copyMembershipBook(entity.guildMemberships))
    : null;
  // T4: the building-discovery store (PlayerGPS discoveredLocations -
  // DFU serialises it in SaveData_v1). Module-level world state, so
  // the snapshot reads the store, not the entity.
  snap.discovery = snapshotDiscovery();
  // A1: the automap dungeon-discovery dictionary (Automap.GetState -
  // DFU serialises it in SaveData_v1's sceneCache). Module-level
  // world state beside the discovery store; the snapshot itself runs
  // DFU's save-time laws (live-dungeon stamp, LRU prune, the N=0
  // outside-forget), so it takes the clock.
  snap.automap = snapshotAutomap(snap.classicMinutes);
  // AUDIT 23 (items lane): RegionData.PriceAdjustment rides DFU's save
  // (SerializablePlayer.cs:168); without it every load rerolled the
  // 750..1250 band and shifted all shop prices mid-session.
  snap.regionPrices = entity.regionPrices ? { ...entity.regionPrices } : null;
  snap.regionConditions = snapshotRegionConditions(entity.regionConditions);   // S42
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
  entity.otherItems = (snap.otherItems ?? []).map((it) => ({ ...it }));   // R1: the in-repair collection (pre-R1 saves restore empty)
  entity.rentedRooms = (snap.rentedRooms ?? []).map((r) => ({ ...r }));   // U39: the rented rooms (pre-U39 saves restore empty)
  entity.bankAccounts = (snap.bankAccounts ?? []).map((a) => ({ ...a }));   // B1 (pre-B1 saves restore empty)
  entity.sceneCache = restoreSceneCache(createSceneCache(), snap.sceneCache);   // P1
  entity.houses = (snap.houses ?? []).map((h) => ({ ...h }));
  entity.ownedShip = snap.ownedShip ?? -1;
  entity.anchorPosition = snap.anchorPosition ? { ...snap.anchorPosition } : null;   // TP-slice
  entity.racialOverridePending = snap.racialOverridePending ? { ...snap.racialOverridePending } : null;   // V1
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
  entity.activeEffects = (snap.activeEffects ?? []).filter((a) => !a.heldItem).map(copyEffectEntry);   // E2: a stale pin in an old snapshot cannot re-link - drop it (DFU :2312)
  // V2a: the racial override MARKER is a live reference into the list
  // just restored - rebuilt here, never serialized on its own, so the
  // marker and the entry can never disagree (the gates - a second
  // infection, the disease immunity - read the marker).
  entity.racialOverride = entity.activeEffects.find((a) => a.kind === 'racialOverride' && !a.ended) ?? null;
  // X10: bundleId is a MODULE-scope monotonic counter, not saved
  // state - DFU has no counter to collide because its bundles are
  // object references re-instanced on load. A fresh process starts
  // ours at 0, so the first cast after "start the app, load a save"
  // would hand out an id the restored entries already carry: the HUD
  // merges the two casts into one icon row and Dispel Magic on it
  // strips both. Lift the counter past the save's high water mark
  // before anything can cast - restartHeldEnchantments below does.
  seedBundleSeq((snap.activeEffects ?? []).reduce((m, a) => Math.max(m, a.bundleId ?? 0), 0));
  // E2: re-instantiate the held enchantments from the worn set the
  // equip table just rebuilt - a recast, so no durability is billed.
  restartHeldEnchantments(entity);
  // W1: the restored weather, which S41 made self-suppressing -
  // restoreWeather now stamps the array rolled and the pending-apply
  // flag DOWN (startedFromLoadedSaveGame's else arm, WeatherManager.cs
  // :540-542) rather than taking a day stamp from here. A pre-W1 save
  // carries no weather - the current sky stands.
  restoreWeather(snap.weather ?? null);
  // Missing on a pre-17h save: leave whatever the entity carries (a
  // fresh entity starts every group at zero, which is classic's own
  // starting state), the additive-field shape DFU's serializer gives.
  // AUDIT 24 systems: GetSaveData writes ALL ELEVEN social-group
  // reputations (SerializablePlayer.cs:158 included
  // reputationSupernaturalBeings), but RestoreSaveData assigns
  // 0,1,2,3,4,5,7,8,9,10 and never index 6 (:321-330) - the saved
  // SupernaturalBeings value is written to disk and silently dropped
  // on load. talk.js reads sGroupReputations[sgroup] on every
  // greeting, so a supernatural NPC's reaction really does reset over
  // a reload in DFU. A bug of DFU's, reproduced rather than fixed.
  const SUPERNATURAL_BEINGS = SOCIAL_GROUPS.SupernaturalBeings;
  for (const k of REP_ARRAYS) {
    if (!snap[k]) continue;
    const kept = entity[k]?.[SUPERNATURAL_BEINGS];
    entity[k] = [...snap[k]];
    if (k === 'sGroupReputations') entity[k][SUPERNATURAL_BEINGS] = kept ?? 0;
  }
  // AUDIT 18 F3. A snapshot older than this field carries no member,
  // which C#'s deserializer would leave at the type default - 0/false,
  // NOT undefined (SerializablePlayer.cs:317-318 then assigns it).
  // RegionData restores under DFU's own guard (:344-347): present ->
  // take it, absent -> InitializeRegionData, i.e. every region at 0.
  entity.crimeCommitted = snap.crimeCommitted ?? 0;
  entity.haveShownSurrenderDialogue = snap.haveShownSurrenderDialogue ?? false;
  entity.legalRep = snap.legalRep ? { ...snap.legalRep } : {};
  // AUDIT 23 (C4/guilds-4): DFU clamps every region's LegalRep right
  // after restoring it (SerializablePlayer -> ClampLegalReputations) -
  // a save carrying a beyond-band value loads back into the band.
  // AUDIT 24 systems: and AFTER, not before. SaveLoadManager.cs:1545
  // is the last line of RestoreSaveData, long past
  // SerializablePlayer.cs:343-347's RegionData write - so the clamp
  // pins the RESTORED values. Standing above the assignment it clamped
  // the pre-load map and then had it overwritten, unclamped.
  clampLegalReputations(entity);
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
  // V2e: both books restore; a pre-V2e snap is a plain object and
  // stays one - activeMemberships reads it as the mortal book.
  entity.guildMemberships = snap.guildMemberships
    ? (isMembershipStore(snap.guildMemberships)
      ? { mortal: copyMembershipBook(snap.guildMemberships.mortal), vampire: copyMembershipBook(snap.guildMemberships.vampire) }
      : copyMembershipBook(snap.guildMemberships))
    : {};
  // S1: made spells restore from their own carried record (and re-seed
  // the index mint below the lowest one, so a spell made after this
  // load cannot collide with one the save brought). Stock spells
  // resolve against SPELLS.STD exactly as before; a spellless host
  // (no table loaded) still restores the made ones.
  entity.spells = (snap.spells ?? []).map((s) => (
    typeof s === 'object' && s !== null ? s : (spellsByIndex ? spellsByIndex.get(s) : null))).filter(Boolean);
  seedCustomSpellIndex(entity.spells);
  // T4: a load replaces the discovery store; a pre-T4 save carries no
  // field and restores an empty one (nothing was discoverable then).
  restoreDiscovery(snap.discovery);
  // A1: a load replaces the automap store too; a pre-A1 save carries
  // no field and restores an empty one (nothing was revealed then).
  // A dungeon context re-fetches its live record after this runs.
  restoreAutomap(snap.automap ?? null);
  // AUDIT 23: the sticky per-region price band (see snapshot side); a
  // pre-fix save re-mints lazily, exactly as an unvisited region does.
  entity.regionPrices = snap.regionPrices ? { ...snap.regionPrices } : {};
  // S42: the CONDITION half of DFU's RegionDataRecord. A pre-S42 save
  // carries none and restores a blank store, which is what
  // InitializeRegionData mints at a new game anyway.
  entity.regionConditions = restoreRegionConditions(snap.regionConditions);
  // S41 - SerializablePlayer.cs:338-339, "Set time tracked in player
  // entity": the entity's OWN clock marker is re-anchored to the
  // restored world time. It is not in the envelope for exactly this
  // reason, and worldTick.js has cited this line as the reason since
  // AUDIT 23 - while the line itself was never ported, so the marker
  // simply carried over from whatever the session was doing before
  // the load. A load FORWARD then left a stale marker behind a jumped
  // clock, and the next tick read the gap as elapsed time: harmless
  // enough when the only reader was the reputation-normalise loop,
  // and not harmless once S41 hung the DAY BLOCK off the same gap - a
  // load would have run a spurious multi-day price drift and re-run a
  // loan check over a window the saved game had already lived.
  entity.lastGameMinutes = Math.floor(snap.classicMinutes ?? 0);
  // EntityEffectBroker.SaveLoadManager_OnLoad (:230-233) -> the
  // InitMagicRoundTimer at :817-822, whose own comment is "Called when
  // game starts or loaded, after world time has been set/restored":
  // the BROKER's lastGameMinute re-anchors to the restored clock, so a
  // load fires ZERO catch-up magic rounds. The entity marker above is
  // SerializablePlayer's and is a different member; the broker's has
  // its own home in worldTick.js and its own restore, here. Without
  // it a load FORWARD of the session clock left the marker behind and
  // the next tick claimed the gap - up to MAX_CATCHUP_ROUNDS (2880) -
  // expiring restored buffs on the spot and bursting a restored
  // continuous-damage effect over a window the saved game never lived.
  resetMagicRoundMarker(Math.floor(snap.classicMinutes ?? 0));
  return { position: snap.position, pose: snap.pose ?? null, classicMinutes: snap.classicMinutes, readiedSpellIndex: snap.readiedSpellIndex, world: snap.world ?? null, locationKey: snap.locationKey ?? null, quest: snap.quest ?? null, talk: snap.talk ?? null };
}

/** AUDIT 25 B4: ONE quest+talk envelope composer, every quicksaving
 *  host calls it. DFU saves quest and conversation state WHEREVER the
 *  player stands - SaveLoadManager.cs:1113 builds
 *  QuestMachine.GetSaveData() and :1119 TalkManager.
 *  GetConversationSaveData() into every save, and :1433-1449 restores
 *  both (conversation after quest, the C# comment's own order). The
 *  port grew the envelope in world.js alone, so a dungeon quicksave
 *  carried neither and a dungeon load handed back an empty quest
 *  machine and rumor mill. `talk` is the trio world.js already
 *  composes: { mill, tree, session } (rumorMill + topicTree +
 *  npcSession = SaveDataConversation whole, TK-i/ii/iv). */
export function composeSessionState({ questBridge = null, talk = null } = {}) {
  return {
    quest: questBridge ? questBridge.snapshot() : null,
    talk: talk ? { ...talk.mill.getSaveData(), ...talk.tree.getSaveData(), ...talk.session.getSaveData() } : null,
    // U41: TravelMapSaveData (SaveLoadManager.cs:871) - DFU saves the
    // travel map's filters and the popup's three choices with the
    // game, off the ONE window it keeps alive. The port's state lives
    // in systems/travelMapState.js, so it rides the same composer
    // both hosts already call rather than a second inline envelope.
    travelMap: travelMapSaveData(),
  };
}

/** The restore half. Keeps the port's RECORDED null-arm departure: DFU
 *  calls RestoreConversationData(null) on a save with no conversation
 *  block, which RESETS the mill (TalkManager.cs:2440-2443 mints a
 *  fresh SaveDataConversation); the port leaves the live session
 *  standing on a pre-TK save (world.js quickLoad, recorded there).
 *  Returns whether a quest envelope was present, for the world host's
 *  _questStarted latch. */
export function restoreSessionState(extras, { questBridge = null, talk = null } = {}) {
  // restore(null) is a no-op and the live machine stands (Q4-v law).
  questBridge?.restore(extras?.quest ?? null);
  // U41: SetTravelMapFromSaveData(null) is DFU's own arm for a save
  // with no block (:1344-1345) - it restores the struct's defaults,
  // so a pre-U41 save clears the filters rather than keeping the
  // live session's.
  restoreTravelMapSaveData(extras?.travelMap ?? null);
  if (extras?.talk && talk) {
    talk.mill.restoreSaveData(extras.talk);
    talk.tree.restoreSaveData(extras.talk);   // the orphan sweep + relink + TellMeAbout tail run inside
    talk.session.restoreSaveData(extras.talk);
    // RestoreConversationData's mill-orphan sweep (:2522-2533)
    talk.mill.removeOrphanedQuestRumors((id) => !!questBridge?.machine.getQuest(id));
  }
  return !!extras?.quest;
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
/**
 * IS THERE A GAME THIS BUILD CAN ACTUALLY RESTORE?
 *
 * AUDIT (2026-08-25) F2. Both menus asked `readQuicksave()` and treated
 * any parsed blob as a game - but restorePlayer REFUSES anything whose
 * `v` is not SAVE_VERSION, and it refuses AFTER the world has booted.
 * So an envelope from an older build drew a full Continue card, and
 * pressing it printed "Save version mismatch." into a HUD nobody is
 * looking at yet and came up on the chargen wizard instead: LOAD
 * SILENTLY STARTING A NEW GAME, which is AUDIT 19 F3 exactly, one
 * layer down and past the guard F3 installed.
 *
 * The test is HERE, beside the restorer whose law it is, and both
 * front doors call it. A predicate that lives anywhere else is a
 * predicate that drifts from the thing it predicts.
 */
export function restorableQuicksave(storage = globalThis.localStorage) {
  const snap = readQuicksave(storage);
  return snap && snap.v === SAVE_VERSION ? snap : null;
}

export function readQuicksave(storage = globalThis.localStorage) {
  if (!storage) return null;
  const raw = storage.getItem(QUICKSAVE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { console.warn('[save] corrupt quicksave'); return null; }
}
