// @ts-check
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
import { defineLiveMaxMagicka } from './chargen.js';   // AUDIT 39: the live MaxMagicka accessor, on the LOAD arm too
import { rebuildEquipState, isEquipped, unequipSlot } from './equip.js';   // AUDIT 17e C1   // AUDIT 63 F28: RemoveItem takes an EQUIPPED item off the doll on its way out
import { templateByIndex } from './itemTemplates.js';   // AUDIT 63r F28: `shortName` is SetItem's template read, not an optional override
import { restartHeldEnchantments } from './enchantments.js';   // E2: the held bundles' restore half
import { snapshotWeather, restoreWeather, rollClimateWeathersForDay } from './weatherSim.js';   // W1: playerPosition.weather (SerializablePlayer.cs:225) - one value, every host; AUDIT WORLD5 C4: the shared day's sky over a loaded one
import { snapshotRegionConditions, restoreRegionConditions } from './regionConditions.js';   // S42: the CONDITION half of RegionDataRecord
import { snapshotDiscovery, restoreDiscovery } from './discovery.js';   // T4
import { getWorldVariationSaveData, restoreWorldVariationData, clearWorldDataVariants } from './worldDataVariants.js';   // RR3b: the world-data variants ride the save
import { snapshotAutomap, restoreAutomap } from './automap.js';   // A1: dictAutomapDungeonsDiscoveryState rides SaveData_v1
import { createSceneCache, snapshotSceneCache, restoreSceneCache } from './sceneCache.js';   // P1
import { seedCustomSpellIndex } from './spellMaker.js';   // S1: made spells carry their own record
import { seedBundleSeq } from './effects.js';   // X10: the live-bundle counter's restore half
import { SOCIAL_GROUPS } from '../formats/factionFile.js';   // AUDIT 24
import { travelMapSaveData, restoreTravelMapSaveData } from './travelMapState.js';   // U41: TravelMapSaveData
import { getEscortFacesSaveData, restoreEscortFacesSaveData } from '../ui/hudEscortFaces.js';   // FE1: SaveData_v1.escortingFaces
import { quickslotSaveData, restoreQuickslotSaveData } from './quickslots.js';   // QS1: the quickslot diamond rides the one composer
import { resetMagicRoundMarker, sharedClockOn, worldMinutes, alignEntityClocks } from './worldTick.js';   // EntityEffectBroker.InitMagicRoundTimer, on the LOAD arm (:230-233); AUDIT WORLD5 C4: a load online is an arrival
import { alignSurvival } from './survival/needs.js';   // SURV7: the needs' markers on the load arm
import { isMembershipStore } from './guilds.js';   // V2e: the two-book membership store rides the save whole
import { createBankAccounts, createHouses } from './banking.js';   // JAN1: a save with no accounts restores the full table - an EMPTY one is truthy and the host's `??=` never minted it
import { setItemFields } from './itemTemplates.js';   // JAN1: an item saved before MAC-N1 (no value) is set on the way in, so the trade strip never sums NaN
import { restoreKnightlyOrderFlags } from './knightlyGifts.js';   // D9: KnightlyOrder.RestoreGuildData's armour-bit back-fill
import { GUILD_GROUPS } from '../formats/factionFile.js';   // the membership book's key IS the guild group
import { appStorage } from './appStorage.js';   // DA1: localStorage in a browser, real save files in the desktop shell
import { characterIdOf, adoptLegacyCards, mintCharacterId } from './characterId.js';   // CHARID1: a character is an id, not a name
import { isOnlinePage } from './onlineLane.js';   // ONLINE-DEATH-FIX: the page is online
import { STREAMING_TERRAIN_SCALE } from '../world/terrainSampler.js';   // TERRAIN-SCALE1: the scale every saved exterior height stands on
import { respawnHealth, reviveForPlay } from './deathRespawn.js';   // ONLINE-DEATH-FIX: the SAME half-health an online respawn leaves
import { setLightSource } from './lightSource.js';   // DISC7: the light in hand's one door

/** One membership book, rows copied (GuildMembership_v1's shape). */
const copyMembershipBook = (book) => Object.fromEntries(
  Object.entries(book ?? {}).map(([k, m]) => [k, { ...m }]));

/** D9: the LOAD side is not a plain copy - GuildManager
 *  .RestoreMembershipData rebuilds each guild object and hands it
 *  its row through the guild's OWN RestoreGuildData (:328), and
 *  KnightlyOrder overrides that method to back-fill its per-rank
 *  armour bits (KnightlyOrder.cs:283-295). It is the only override
 *  with a body beyond `flags = data.flags`, so this door is the
 *  whole of the difference between saving a book and restoring one. */
const restoreMembershipBook = (book) => {
  const out = copyMembershipBook(book);
  const knightly = out[GUILD_GROUPS.KnightlyOrder];
  if (knightly) restoreKnightlyOrderFlags(knightly);
  return out;
};

export const SAVE_VERSION = 1;
export const QUICKSAVE_KEY = 'dagger.quicksave';

const ENTITY_FIELDS = [
  'name', 'gender', 'race', 'raceId', 'faceIndex',   // S3c/U9: the identity rides the save
  'characterId',   // CHARID1: and the id that IS the identity - minted at chargen, adopted onto a legacy character at its load
  'careerIndex', 'level', 'reflexes',
  'health', 'maxHealth', 'magicka', 'maxMagicka', 'fatigue',
  'currentBreath',   // P12 (SerializablePlayer carries it; missing = 0/surfaced on old saves)
  'startingLevelUpSkillSum', 'currentLevelUpSkillSum',
  // `pendingBonusPool` rides beside `pendingLevel` for the reason the
  // roll was moved onto the entity at all (AUDIT LV2, reopened): a
  // pool that did not survive the save would be re-rolled by a save
  // and a load, which is the same exploit through a slower door.
  'readyToLevelUp', 'pendingLevel', 'pendingBonusPool', 'chargenDone',
  // ORL1 (2026-09-17): WHICH LEVELING SYSTEM THIS CHARACTER LEVELS BY,
  // and the mod's bar. `levelingSystem` is answered ONCE, at chargen,
  // and is a property of the CHARACTER rather than of the install -
  // which is why it rides here and not in modSettings beside the mod's
  // sliders. The Mods pane switch decides whether a new character is
  // ASKED; this decides what an existing one plays.
  //
  // A SAVE WRITTEN BEFORE THIS SLICE carries none of the three. The
  // reader leaves them undefined, `usesVirtueLeveling` reads undefined
  // as classic, and the two bar fields default to 0 at their only
  // readers - so an old save loads as exactly the character it was.
  // The mod's own save does the same with one value (player.lua:707-716
  // persists `skillPointRollUp` alone and nothing else); the port
  // carries the bar too, because Daggerfall has no engine-side level
  // progress counter for it to live in the way Morrowind does.
  'levelingSystem', 'levelProgress', 'levelRollUp',
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
  'restSimMinutes',   // MAC-LVL1: an online rest's unspent skill-clock credit (spent at the rest's end; a save mid-rest is the only way it is ever non-zero)
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
  // A4: MinMetalToHit (SerializablePlayer.cs:135, restored :304, and
  // DFU assigns it UNCONDITIONALLY - no null arm). The two racial
  // curses write it (VampirismEffect.cs:125, LycanthropyEffect.cs
  // :198-200) and CalculateAttackDamage reads it on the TARGET
  // (FormulaHelper.cs:576) to refuse a weapon of too poor a material.
  // The port had the write and the read and no envelope between them,
  // so a vampire who loaded a save could be cut with steel until the
  // curse's next constant round re-armed the silver requirement. A
  // save older than this field restores undefined, which the damage
  // gate reads exactly as C#'s enum default of Iron does: no
  // requirement at all.
  'minMetalToHit',
];

/** PlayerEntity.skillsRecentlyRaised: TWO 32-bit masks over the 35
 *  skills, and `new uint[2]` is both the constructor's value and the
 *  restore's null arm (SerializablePlayer.cs:292). */
export const newSkillsRecentlyRaised = () => [0, 0];

/** AUDIT 17h F1: the ELEVEN social-group reputations DFU writes out
 *  field by field (SerializablePlayer.cs:152-162). Nothing persisted
 *  them, so a quicksave/load reset the player's standing with every
 *  social group to zero - which getReactionToPlayer reads on EVERY
 *  greeting, and which the biography, the T3f tone tallies and the G2
 *  court sentences all write to. The port had never carried them; the
 *  biography made the gap load-bearing from the first minute of a new
 *  character.
 *
 *  AUDIT 65 SL-4: reactionMods used to ride this array too, under that
 *  same cite - and SerializablePlayer.cs:152-162 writes the eleven
 *  reputations ALONE. DFU is explicit the other way for the mods:
 *  PlayerEntity.cs:128-129 declares `int[] reactionMods = new
 *  int[socialGroupCount]` with "do not serialize, set by live
 *  effects", and no SerializablePlayer field answers it. Carrying it
 *  cost a real defect: a snapshot minted before AUDIT 63 F6 holds a
 *  FIVE-wide array, the restore below wrote that width back verbatim,
 *  and ClearReactionMods' fill(0) preserves a length forever - so the
 *  Masque of Clavicus buffed five social groups instead of eleven for
 *  the life of that character. Dropping the member costs nothing:
 *  enchantmentMagicRound clears the player's array at the head of
 *  every magic round (enchantments.js:842, DFU's ClearReactionMods at
 *  PlayerEntity.cs:1567-1570) and the folds re-apply it in the same
 *  pass, off worldTick.js:332 - so a load lands DFU's own shape, the
 *  live mods left standing until the next DoMagicRound re-derives
 *  them eleven wide. An older snapshot's key is simply ignored (the
 *  restore loop skips what REP_ARRAYS does not name), so the envelope
 *  stays back-compatible and SAVE_VERSION does not move. */
const REP_ARRAYS = ['sGroupReputations'];

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
export function snapshotPlayer(entity, { position = null, pose = null, classicMinutes = 0, readiedSpellIndex = null, world = null, locationKey = null, quest = null, talk = null, interior = null, dungeon = null, travelMap = null, escortingFaces = null, quickslots = null, spawns = null, smallerDungeonsState = 0, modData = null } = {}) {
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
  // IS1 (AUDIT 26 F221): `interior` is the inside-building half of
  // PlayerPositionData_v1 (SerializablePlayer.cs:183-187) - the
  // entered exterior door's identity + the building discovery record
  // - opaque here like `world`; the world host composes and consumes
  // it. Null everywhere but interior mode, and a pre-IS1 save
  // restores null (the additive-field shape, version held at 1).
  // AUDIT 39: travelMap (SaveLoadManager.cs:871), escortingFaces
  // (:869) and smallerDungeonsState (PlayerPositionData_v1 :224) are
  // named here because both hosts already PASS them - composeSessionState
  // spreads the first two in and the dungeon host adds the third - and
  // an unnamed option is dropped in silence. Without them every load
  // took the null arm: the escort portraits of a live quest were
  // cleared, the travel map's filters and popup choices reset to the
  // struct defaults, and the SmallerDungeons start-marker warp could
  // never fire.
  // MAC6 #1: `dungeon` is the inside-dungeon half of DFU's
  // PlayerPositionData_v1 (worldPosX/worldPosZ + insideDungeon,
  // SerializablePlayer.cs:215-217) - the map pixel the dungeon stands
  // on and its map id, so a boot load can respawn there and re-enter
  // before it restores the position (PlayerEnterExit.cs:534-537). Null
  // anywhere but a dungeon; a save from before it was carried reads
  // null and the world host finds the dungeon by its id instead.
  // AUDIT TTL1 (found while adding `spawns`): `quickslots` was NOT
  // among the names above, and this envelope's own comment says what
  // that costs - "an unnamed option is dropped in silence". QS1's
  // composer built the block, every save threw it away, and
  // restoreQuickslotSaveData read undefined and CLEARED the diamond:
  // the quickslots have never survived a load since QS1 landed.
  //
  // TTL1: `spawns` is the spawned-dungeon ledger (world/spawnedDungeons
  // .js createSpawnLedger().toJSON()) - the two clocks are about time
  // passing, so a reload with no memory of them would restart both and
  // nothing would ever expire across a session. Named here rather than
  // in the `world` bag because that bag is written in EXTERIOR mode
  // alone, and the dungeon a spawn's clock is counting is exactly
  // where a player saves.
  // AUDIT HCC H3: `modData` is DFU's per-mod save data (IHasModSaveData - SaveLoadManager writes one record per
  // loaded mod beside the game's own), keyed by the mod's vendor name and opaque here like `world`. It rides EVERY
  // save wherever it is taken: Horse Cart and Cargo's record rode the world half alone, so a dungeon save - the
  // online page's close-the-tab save included - carried no horse, no name and no parked wagon.
  // TERRAIN-SCALE1: every exterior height in this envelope - the player's, the piles', the pools', the anchor's -
  // stands on ground drawn at this terrain scale. A save without the stamp was written on the prefab's 1.5, and the
  // world host re-stands its heights on today's ground as it lands them (world.js restandHeight). Additive: SAVE_VERSION
  // does not move, and an older build ignores the field.
  const snap = { v: SAVE_VERSION, position, pose, classicMinutes, readiedSpellIndex, world, locationKey, quest, talk, interior, dungeon, travelMap, escortingFaces, quickslots, spawns, smallerDungeonsState, modData, terrainScale: STREAMING_TERRAIN_SCALE };
  // W1: DFU persists exactly ONE weather value (playerPosition.weather)
  // and re-rolls the six-zone array on the next date change - the sim
  // is a module singleton, so the envelope reads it here and every
  // host's save carries it without a host edit.
  snap.weather = snapshotWeather();
  characterIdOf(entity);   // CHARID1: a character that reached a save without an id (born before this) gets one here, before the copy
  for (const k of ENTITY_FIELDS) snap[k] = entity[k];
  snap.stats = { ...entity.stats };
  // SURV1: the needs record (survival/needs.js) - its markers are classic
  // minutes and its counters plain numbers; the note throttles are not
  // state and are not carried.
  snap.survival = entity.survival ? { ...entity.survival, notes: undefined } : null;
  // AUDIT 17e: pre-chargen the entity carries a flat NUMBER here
  // (the stand-in entity's flat skills, characters/playerEntity.js:28)
  // - spreading it threw. RECORDED, and no divergence from
  // SerializablePlayer: the line below is the working guard, it
  // round-trips BOTH shapes, and restore reads back whichever it
  // wrote. The stand-in columns themselves are that file's to retire.
  snap.skills = Array.isArray(entity.skills) ? [...entity.skills] : entity.skills;
  snap.skillUses = [...(entity.skillUses ?? [])];
  snap.career = entity.career ? { ...entity.career } : null;   // plain CFG data
  snap.items = (entity.items ?? []).map((it) => ({ ...it }));
  // E4: `data.playerEntity.goldPieces = entity.GoldPieces`
  // (SerializablePlayer.cs:133). Gold left the item list when it
  // became the counter DFU keeps it in, so the envelope carries it
  // beside the collections exactly as DFU's does.
  snap.goldPieces = entity.goldPieces ?? 0;
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
  // TR4: SerializablePlayer.cs:180 - the BOARDING MEMORY is saved
  // beside the deed. Without it a save taken at sea loads with no way
  // back: IsOnShip needs the memory to answer true, so disembarking
  // would board again and overwrite where you actually were.
  snap.boardShipPosition = entity.boardShipPosition ?? null;
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
  // MAC-L4: ...and the entries the last restore could not resolve ride
  // back out UNCHANGED beside them. Without this the holding in
  // `restorePlayer` would only postpone the loss by one save.
  snap.spells = [
    ...(entity.spells ?? []).map((sp) => ((sp?.custom || sp?.rri) ? JSON.parse(JSON.stringify(sp)) : sp.index)),   // AUDIT-RR F9: a mod's spell (RRI's nine, past SPELLS.STD) is serialised whole, as DFU serialises every EffectBundleSettings - an index no file answers would be held forever
    ...(entity.spellsPending ?? []),
  ];
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
  // CG2: the crime-guild tallies and their letter clocks
  // (SerializablePlayer.cs:144-147 writes all four in this same player
  // block). AUDIT 18 F3's lesson applies to them exactly: a tally that
  // does not survive a save is a tally that can never reach ten, since
  // no one steals ten times in one sitting - the Thieves Guild would
  // have been reachable only by a player who never saved.
  snap.thievesGuildRequirementTally = entity.thievesGuildRequirementTally ?? 0;
  snap.darkBrotherhoodRequirementTally = entity.darkBrotherhoodRequirementTally ?? 0;
  snap.timeForThievesGuildLetter = entity.timeForThievesGuildLetter ?? 0;
  snap.timeForDarkBrotherhoodLetter = entity.timeForDarkBrotherhoodLetter ?? 0;
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
  // only the MUTABLE columns need to travel. Parallel arrays beside a
  // sorted id list - a few KB rather than 366 whole records. Same
  // shape of decision as legalRep above. AUDIT 39: "lossless" holds
  // only while the column list holds EVERY field play writes; it said
  // three columns and the region sim had grown nine more. Anything
  // that mutates a faction record belongs in the list below.
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
  // RR3b: WorldDataVariants.GetWorldVariationSaveData (SaveLoadManager.cs:1125) - the variants a quest set
  snap.worldVariation = getWorldVariationSaveData();
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
  // A4 (Road to 1:1) - THE ENVELOPE STRAGGLERS. Three more members
  // PlayerEntityData_v1 writes out one at a time and this envelope did
  // not carry. Each is a COPY or a scalar; each has a live consumer
  // named at its restore arm below.
  //
  // skillsRecentlyRaised (SerializablePlayer.cs:125): the two masks
  // the skill-raise pass sets (PlayerEntity.cs:1387) and the character
  // sheet reads to highlight what went up since it was last opened
  // (TextProvider.cs:492), clearing them as it goes. A mask that does
  // not survive a save is a mask that only ever reports the raises of
  // one sitting.
  snap.skillsRecentlyRaised = entity.skillsRecentlyRaised
    ? [...entity.skillsRecentlyRaised] : null;
  // previousVampireClan (:163): CureVampirism stamps the clan the
  // player USED to belong to (VampirismEffect.cs:309) - the one piece
  // of a cured vampire's identity that outlives the curse. DFU itself
  // reads it nowhere yet (the property has no consumer in the tree);
  // it is carried here because the port already WRITES it
  // (vampirism.js cureVampirism) and a written field that a save
  // drops is a divergence whichever way the reference reads it.
  snap.previousVampireClan = entity.previousVampireClan ?? 0;
  // timeToBecomeVampireOrWerebeast (:146): classic's "three days
  // after infection" stamp, which reaches a DFU character only through
  // AssignCharacter (PlayerEntity.cs:856) - i.e. a classic import.
  // The temple's Cure Disease service counts it as one more disease
  // (DaggerfallGuildServiceCureDisease.cs:58) and zeroes it on a cure
  // (:72, :126), so a save that dropped it charged an imported
  // character 250 gold too little and left them turning anyway.
  snap.timeToBecomeVampireOrWerebeast = entity.timeToBecomeVampireOrWerebeast ?? 0;
  return snap;
}

/** AUDIT 39: rep/flags/power were not the whole mutable set. The
 *  region simulation rewrites the RELATIONS and the RULER too -
 *  start/endFactionAllies and start/endFactionEnemies move ally1-3 and
 *  enemy1-3 (factionRelations.js), setNewRulerData writes
 *  rulerPowerBonus and rulerNameSeed, setRulerType writes ruler - and
 *  bootstrapRegionPower runs the conditions body twelve times at
 *  chargen, so they have already moved before the first save. Dropping
 *  them reset every relation to FACTION.TXT on load while
 *  regionConditions restored, which can leave a war flag lit with no
 *  enemy to end it, and sank every faction's power walk (the shipped
 *  file's rulerPowerBonus is 0 by construction). */
export const FACTION_RELATION_COLUMNS = Object.freeze([
  'ally1', 'ally2', 'ally3', 'enemy1', 'enemy2', 'enemy3',
  'ruler', 'rulerPowerBonus', 'rulerNameSeed',
]);

/** The store's mutable columns, id-sorted so the arrays line up. */
export function snapshotFactionRep(store) {
  const ids = [...store.dict.keys()].sort((a, b) => a - b);
  const rep = [], flags = [], power = [];
  const out = { ids, rep, flags, power };
  for (const k of FACTION_RELATION_COLUMNS) out[k] = [];
  for (const id of ids) {
    const f = store.dict.get(id);
    rep.push(f.rep); flags.push(f.flags); power.push(f.power);
    for (const k of FACTION_RELATION_COLUMNS) out[k].push(f[k]);
  }
  return out;
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
    // AUDIT 39: presence is tested per COLUMN, so a save written before
    // the relations travelled leaves the FACTION.TXT values standing -
    // the additive-field shape the rest of the envelope uses.
    for (const k of FACTION_RELATION_COLUMNS) if (snap[k]) f[k] = snap[k][i];
  }
  return true;
}

/** Restore a snapshot onto the live entity. Returns the scene
 *  extras { position, classicMinutes, readiedSpellIndex } or null
 *  on a version mismatch (loud). */
/**
 * MAC-L4: the held entries, resolved once a table turns up.
 *
 * A host that restored before `SPELLS.STD` landed can call this when it
 * does and the player gets their spellbook back inside the session,
 * rather than on the next load. Returns how many came back.
 *
 * @param {any} entity
 * @param {Map<number, any>|null} spellsByIndex
 * @returns {number}
 */
export function resolvePendingSpells(entity, spellsByIndex) {
  const pending = entity?.spellsPending;
  if (!spellsByIndex || !pending?.length) return 0;
  const still = [];
  let got = 0;
  for (const s of pending) {
    const found = spellsByIndex.get(s);
    if (found) { (entity.spells ??= []).push(found); got++; } else still.push(s);
  }
  entity.spellsPending = still;
  if (got) seedCustomSpellIndex(entity.spells);
  return got;
}

export function restorePlayer(entity, snap, spellsByIndex = null) {
  if (!snap || snap.v !== SAVE_VERSION) {
    console.warn(`[save] version mismatch (got ${snap?.v}, want ${SAVE_VERSION}); refusing`);
    return null;
  }
  // AUDIT 39: MaxMagicka is a getter for the life of the entity
  // (DaggerfallEntity.cs:264) - it cannot be lost on load. The
  // accessor has to exist BEFORE the ENTITY_FIELDS copy, or
  // 'maxMagicka' lands as a plain data property and the load path
  // (which never walks chargen) freezes the ceiling at the saved
  // number, orphaning every maxMagickaModifier producer. Idempotent.
  defineLiveMaxMagicka(entity);
  for (const k of ENTITY_FIELDS) entity[k] = snap[k];
  // CHARID1: A LEGACY SAVE IS ADOPTED HERE. An envelope written before
  // the id existed carries none; its character gets one now, and every
  // card of that name that has none is stamped with it - so the next
  // QuickSave overwrites this character's own slot, as it always did,
  // and a NEW character of the same name never can.
  if (typeof snap.characterId !== 'string' || !snap.characterId) {
    entity.characterId = mintCharacterId();
    adoptLegacyCards(appStorage(), entity.name, entity.characterId);
  }
  // ONLINE-DEATH-FIX: NEVER LOAD DEAD ONLINE. hurtPlayer fires the death only on the alive->0 TRANSITION, so a
  // character restored at 0 HP can never die again and is stuck at 0% (unkillable). Online, a death is a respawn, so a
  // dead save (the exit autosave can write one) comes back at the respawn's own half health. Offline is untouched.
  // DEATHLOOP1: ...and the drains that killed them are ended with it.
  // A save written by the exit autosave carries the poison that did it;
  // restoring the health alone loads the player straight back into the
  // same death, which is the loop from the other end.
  if (isOnlinePage() && !((entity.health ?? 0) > 0)) reviveForPlay(entity);
  entity.stats = { ...snap.stats };
  entity.survival = snap.survival && typeof snap.survival === 'object' ? { ...snap.survival, notes: {} } : null;   // SURV1: a pre-SURV save starts fresh at the host's first tick
  // Pre-S15 saves carry no fatigue: default to rested (MaxFatigue =
  // (Str + End) x 64) - the additive-field shape DFU's serializer
  // gives missing members, so the envelope version holds at 1.
  if (entity.fatigue == null) entity.fatigue = ((snap.stats?.strength ?? 0) + (snap.stats?.endurance ?? 0)) * 64;
  entity.skills = Array.isArray(snap.skills) ? [...snap.skills] : snap.skills;   // AUDIT 17e: pre-chargen skills is a flat number
  entity.skillUses = [...snap.skillUses];
  entity.career = snap.career ? { ...snap.career } : entity.career;
  entity.items = snap.items.map((it) => setItemFields(it));   // JAN1: SetItem's two writes on every item in (a copy, as before)
  entity.wagonItems = (snap.wagonItems ?? []).map((it) => setItemFields(it));   // W-slice (pre-W saves restore empty); JAN1: set on the way in
  entity.otherItems = (snap.otherItems ?? []).map((it) => setItemFields(it));   // R1: the in-repair collection (pre-R1 saves restore empty); JAN1: set on the way in
  entity.rentedRooms = (snap.rentedRooms ?? []).map((r) => ({ ...r }));   // U39: the rented rooms (pre-U39 saves restore empty)
  // JAN1 (2026-09-18, Janome: CRASH `region 17 is outside the 0 bank accounts`, a softlock at the bank): a pre-B1 save
  // restored an EMPTY table, which is truthy, so worldModes' `??= createBankAccounts` never minted one and every bank
  // reader threw by DFU's own ValidateRegion law. No accounts saved is no accounts opened: the full table, as a new game.
  entity.bankAccounts = snap.bankAccounts?.length ? snap.bankAccounts.map((a) => ({ ...a })) : createBankAccounts();   // B1
  entity.sceneCache = restoreSceneCache(createSceneCache(), snap.sceneCache);   // P1
  entity.houses = snap.houses?.length ? snap.houses.map((h) => ({ ...h })) : createHouses(entity.bankAccounts.length);   // JAN1: the same law for the house registry (H1 mints it beside the accounts)
  entity.ownedShip = snap.ownedShip ?? -1;
  entity.boardShipPosition = snap.boardShipPosition ?? null;   // TR4 (:425)
  entity.anchorPosition = snap.anchorPosition ? { ...snap.anchorPosition } : null;   // TP-slice
  // A4: the three stragglers' restore arms (see the snapshot side).
  // SerializablePlayer.cs:292 is the ONLY one of the three DFU guards -
  // `(data...skillsRecentlyRaised != null ? it : new uint[2])` - and a
  // guard is needed because the value is an ARRAY the raise pass
  // indexes into; the two scalars restore straight (:315, :331) onto
  // C#'s own type defaults, 0 and VampireClans.None (which IS 0).
  entity.skillsRecentlyRaised = snap.skillsRecentlyRaised != null
    ? [...snap.skillsRecentlyRaised] : newSkillsRecentlyRaised();
  entity.previousVampireClan = snap.previousVampireClan ?? 0;
  entity.timeToBecomeVampireOrWerebeast = snap.timeToBecomeVampireOrWerebeast ?? 0;
  entity.racialOverridePending = snap.racialOverridePending ? { ...snap.racialOverridePending } : null;   // V1
  // E4: `entity.GoldPieces = data.playerEntity.goldPieces`
  // (SerializablePlayer.cs:302). The pre-E4 MIGRATION that goes with
  // it runs further down, below the two index-keyed relinks - see
  // there for why the order matters.
  entity.goldPieces = snap.goldPieces ?? 0;
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
  setLightSource(entity, li >= 0 ? (entity.items[li] ?? null) : null);   // DISC7: the one door
  // E4 - THE PRE-E4 MIGRATION, and two things about it are load-bearing.
  //
  // WHAT: a save written before gold became a counter carries the
  // purse as a Currency stack inside `items`, where nothing can spend
  // it any more. The restore absorbs every such stack into GoldPieces
  // and drops it - what the transfer door does to a pile that reaches
  // the pack.
  //
  // ONLY FOR SUCH A SAVE. `snap.goldPieces == null` is the test, and
  // it is not a convenience: DFU CAN put a Currency stack in
  // PlayerEntity.Items, through GivePc's notify and silently arms
  // (GivePc.cs:179, :186), which call `Items.AddItem` with no currency
  // check at all. Such a stack is unspendable in DFU too - GetGoldAmount
  // reads `goldPieces`, not the list - and it is a quirk the port
  // INHERITS rather than quietly launders on the next load.
  //
  // WHERE: below both index-keyed relinks. `lightSourceIndex` is an
  // INDEX INTO THE SAVED LIST (the port's recorded stand-in for DFU's
  // item UIDs, Ledger A), so removing a row before the relink would
  // slide every later item one place and light the wrong thing - or
  // nothing.
  //
  // (It also subsumes AUDIT 17f's template-index upgrade, whose whole
  // purpose was to stop a pre-17f stack splitting into two the gold
  // reader could not add up.)
  if (snap.goldPieces == null) {
    for (let i = entity.items.length - 1; i >= 0; i--) {
      const it = entity.items[i];
      if (it.group !== 'Currency') continue;
      entity.goldPieces += it.stackCount ?? 0;
      entity.items.splice(i, 1);
    }
  }
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
  // CG2: the four crime-guild fields, under the SAME older-snapshot
  // rule as the line above - absent means the C# type default, 0, which
  // is exactly "no tally, no letter pending" and is safe to restore
  // onto a character saved before this shipped.
  entity.thievesGuildRequirementTally = snap.thievesGuildRequirementTally ?? 0;
  entity.darkBrotherhoodRequirementTally = snap.darkBrotherhoodRequirementTally ?? 0;
  entity.timeForThievesGuildLetter = snap.timeForThievesGuildLetter ?? 0;
  entity.timeForDarkBrotherhoodLetter = snap.timeForDarkBrotherhoodLetter ?? 0;
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
      ? { mortal: restoreMembershipBook(snap.guildMemberships.mortal), vampire: restoreMembershipBook(snap.guildMemberships.vampire) }
      : restoreMembershipBook(snap.guildMemberships))
    : {};
  // S1: made spells restore from their own carried record (and re-seed
  // the index mint below the lowest one, so a spell made after this
  // load cannot collide with one the save brought). Stock spells
  // resolve against SPELLS.STD exactly as before; a spellless host
  // (no table loaded) still restores the made ones.
  //
  // ═══ MAC-L4: A RESTORE MAY NOT DESTROY WHAT IT CANNOT READ ═════
  //
  // Mac, 2026-09-16 (bigdaddywetwet): "something causes spells to
  // disappear from the spellbook."
  //
  // This walk ended in `.filter(Boolean)`, and that is where they went.
  // A STOCK spell travels as a bare SPELLS.STD INDEX - a number - and
  // resolving it needs `spellsByIndex`. `scenes/world.js` fires
  // `loadMagicRegistries` at boot and does NOT await it, so for the
  // first seconds of a session the table is null: a quickload in that
  // window resolved every stock spell to `null`, the filter swept them
  // all, and the next save wrote the emptied list back. Silent, and
  // permanent.
  //
  // The host now waits for its table (that is the race, and it is
  // fixed there). This is the second lock, because the first one is a
  // promise and promises are a thing a future host can forget to await:
  // AN ENTRY THIS FUNCTION CANNOT RESOLVE IS KEPT, NOT DROPPED. It is
  // set aside in its saved form, `snapshotPlayer` writes it back out
  // beside the resolved ones, and `resolvePendingSpells` picks it up
  // if a table arrives later. A save that goes through a host with no
  // SPELLS.STD comes out the other side whole.
  //
  // `.filter(Boolean)` is a fine way to drop a blank. It is a terrible
  // way to handle a lookup miss, because the two are indistinguishable
  // by the time the filter runs - and the cost of confusing them here
  // is a player's spellbook.
  const _pending = [];
  entity.spells = (snap.spells ?? []).map((s) => {
    if (typeof s === 'object' && s !== null) return s;
    const found = spellsByIndex ? spellsByIndex.get(s) : null;
    if (!found) { _pending.push(s); return null; }
    return found;
  }).filter(Boolean);
  entity.spellsPending = _pending;
  if (_pending.length) {
    console.warn(`[save] ${_pending.length} spell(s) could not be resolved`
      + `${spellsByIndex ? '' : ' (SPELLS.STD not loaded yet)'} - HELD, not dropped:`, _pending);
  }
  seedCustomSpellIndex(entity.spells);
  // T4: a load replaces the discovery store; a pre-T4 save carries no
  // field and restores an empty one (nothing was discoverable then).
  restoreDiscovery(snap.discovery);
  // RR3b: WorldDataVariants.RestoreWorldVariationData (SaveLoadManager.cs:1465-1466); a save without the field restores nothing, as the C#'s null does
  clearWorldDataVariants();
  restoreWorldVariationData(snap.worldVariation ?? null);
  // A1: a load replaces the automap store too; a pre-A1 save carries
  // no field and the store is LEFT ALONE (restoreAutomap's null arm,
  // SaveLoadManager.cs:1508-1509 - AUDIT-AMAP F10 fixed this comment).
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
  // AUDIT WORLD5 C4: under the shared clock a LOAD is an arrival, in every host and through this one door - the
  // restored markers shifted to the world's time (alignEntityClocks) and the day's sky rolled from the shared day's
  // seed over the one the save carried. WORLD5 aligned the session's first save at the online start and nothing
  // after it: a quick load, a boot ?load or a dungeon's own load restored the save's own clock into every marker,
  // and the next tick caught up the distance to the world (or read it negative).
  if (sharedClockOn()) { alignEntityClocks(entity, worldMinutes()); rollClimateWeathersForDay(worldMinutes()); }
  if (sharedClockOn()) alignSurvival(entity, Math.floor(worldMinutes()), Math.floor(snap.classicMinutes ?? 0));   // SURV7: the needs' markers - a save from more than a day ago starts fed, watered and rested (WORLD5's law for these)
  // AUDIT 39: the three extras above ride back out too - a save from
  // before they were carried reads the same null/0 they used to.
  return { position: snap.position, pose: snap.pose ?? null, classicMinutes: snap.classicMinutes, readiedSpellIndex: snap.readiedSpellIndex, world: snap.world ?? null, locationKey: snap.locationKey ?? null, quest: snap.quest ?? null, talk: snap.talk ?? null, interior: snap.interior ?? null, dungeon: snap.dungeon ?? null, travelMap: snap.travelMap ?? null, escortingFaces: snap.escortingFaces ?? null, quickslots: snap.quickslots ?? null, spawns: snap.spawns ?? null, smallerDungeonsState: snap.smallerDungeonsState ?? 0, modData: snap.modData ?? null, terrainScale: snap.terrainScale ?? null };   // TERRAIN-SCALE1: null - written before the stamp, on the prefab's 1.5
}

/** CASTLE1 (2026-09-22, the same report's "(different dungeon - world
 *  state left as built)"): WHICH DOOR StartDungeonInterior takes. DFU's
 *  member builds the LOCATION it is handed (PlayerEnterExit.cs:968-997)
 *  - the save's own, RespawnPlayer's GetLocation at the save's pixel
 *  (:534-537). The port's arm took the FIRST dungeon-entrance door in
 *  the loaded exterior, and the streaming world loads the neighbours
 *  too: a load at Daggerfall carries the castle's twenty doors, a
 *  nearby dungeon's and a keep's, and whichever pixel built first won
 *  - the player re-entered a neighbour and the dungeon host said the
 *  save was for a different dungeon. The saved dungeon's own door
 *  first (by `dungeon:<locationId>`), then a door on the player's own
 *  pixel (the `site`'s group, DFU's GetLocation), then the doorless
 *  site itself, and only for a pixel with no dungeon at all the first
 *  door there is (a site with no dungeon of its own is the fallback the
 *  respawn keeps). Null when there is nothing to enter.
 *  @param {Array<{door:{doorType:number}, group?:string, dfLocation?:any}>} doors  the DUNGEON_ENTRANCE doors alone
 *  @param {{group?:string}|null} site  host.dungeonStartSite()'s answer
 *  @param {string|null} locationKey  the save's `dungeon:<id>` */
export function dungeonStartDoorFor(doors, site, locationKey = null) {
  const id = /^dungeon:(\d+)$/.exec(String(locationKey ?? ''))?.[1] ?? null;
  const list = doors ?? [];
  const own = id != null ? list.find((e) => String(e?.dfLocation?.dungeon?.recordElement?.header?.locationId ?? '') === id) : null;
  if (own) return own;
  const here = site?.group != null ? list.find((e) => e?.group === site.group) : null;
  return here ?? site ?? list[0] ?? null;
}

/** MAC6 #1: the dungeon a save was taken in, found by its id across
 *  the world's locations - for an envelope from before `dungeon`
 *  carried the pixel. `locationKey` is the dungeon host's
 *  `dungeon:<recordElement.header.locationId>`; `locations` is any
 *  iterable of MapsFile locations; `toPixel(mapTableData)` is the
 *  host's longitude/latitude-to-pixel. Null for anything else. */
export function dungeonPixelFor(locationKey, locations, toPixel) {
  const m = /^dungeon:(\d+)$/.exec(String(locationKey ?? ''));
  if (!m) return null;
  const id = Number(m[1]);
  for (const loc of locations ?? []) {
    if (!loc?.hasDungeon || loc.dungeon?.recordElement?.header?.locationId !== id || !loc.mapTableData) continue;
    const p = toPixel(loc.mapTableData);
    return p ? { x: p.x, y: p.y } : null;
  }
  return null;
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
export function composeSessionState({ questBridge = null, talk = null, spawnLedger = null } = {}) {
  return {
    quest: questBridge ? questBridge.snapshot() : null,
    talk: talk ? { ...talk.mill.getSaveData(), ...talk.tree.getSaveData(), ...talk.session.getSaveData() } : null,
    // U41: TravelMapSaveData (SaveLoadManager.cs:871) - DFU saves the
    // travel map's filters and the popup's three choices with the
    // game, off the ONE window it keeps alive. The port's state lives
    // in systems/travelMapState.js, so it rides the same composer
    // both hosts already call rather than a second inline envelope.
    travelMap: travelMapSaveData(),
    // FE1: saveData.escortingFaces (SaveLoadManager.cs:869) - the HUD
    // escort portraits ride every save, off the one panel, exactly as
    // DFU reaches DaggerfallHUD.EscortingFaces from its serializer.
    escortingFaces: getEscortFacesSaveData(),
    // QS1: the quickslot diamond's two consumables and its swap weapon
    // (systems/quickslots.js) - per-character state, so it rides the
    // save and not the browser's prefs shelf.
    quickslots: quickslotSaveData(),
    // TTL1: the spawned-dungeon ledger. Passed in rather than read off
    // a module singleton like its neighbours because it belongs to the
    // ONE world host that owns `locationIndex`; the dungeon host
    // forwards the same object in, so a save made underground carries
    // it too. Null in the standalone ?dungeon scene, which has no
    // overworld and therefore no spawns.
    spawns: spawnLedger ? spawnLedger.toJSON() : null,
  };
}

/**
 * AUDIT 63 F28 - ItemCollection.RemoveOrphanedItems (Items/
 * ItemCollection.cs:661-688), verbatim order: a QUEST item goes when
 * its quest is gone (`QuestMachine.GetQuest(item.QuestUID) == null`)
 * or tombstoned (`quest.QuestTombstoned`); anything else goes when it
 * has no name.
 *
 * AUDIT 63r F28: WHAT `shortName` IS. DFU's second arm is offered by
 * its own comment as "or has an invalid template" (ItemCollection.cs
 * :663), and that is exactly what it catches: SetItem assigns
 * `shortName = GetLocalizedItemName(itemTemplate.index,
 * itemTemplate.name)` (DaggerfallUnityItem.cs:551) on EVERY
 * template-backed mint, so an item only reads empty there when its
 * template did not resolve. The port's `name` is an OPTIONAL override
 * - resolveItemName (itemInfo.js) falls back to the template - and
 * whole classes of ordinary item are minted without one
 * (createPotion/createRandomPotion, randomlyAddMap,
 * randomlyAddPotionRecipe: loot.js). So the arm must test the
 * RESOLVED name, template included, or every alchemist's bottle,
 * treasure map and potion recipe is deleted from pack, wagon and
 * repair on the next load.
 *
 * The port's items model equipment by a slot ON the item, so a bare
 * splice would leave a ghost on the doll: RemoveItem's own unequip
 * (the same two lines quest Item.Dispose already runs at world.js's
 * removeItemFromPlayer hook) runs here too.
 *
 * @returns how many were removed.
 */
export function removeOrphanedItems(entity, collection, getQuest) {
  let n = 0;
  for (let i = (collection?.length ?? 0) - 1; i >= 0; i--) {
    const it = collection[i];
    if (!it) continue;
    let orphaned = false;
    if (it.questItem) {
      const q = getQuest?.(it.questUID) ?? null;
      orphaned = !q || !!q.questTombstoned;
    } else {
      // ItemCollection.cs:675 `else if (string.IsNullOrEmpty(item
      // .shortName))` - an INVALID TEMPLATE, never a missing override.
      orphaned = !it.name && !it.shortName && !templateByIndex(it.templateIndex)?.name;
    }
    if (!orphaned) continue;
    if (entity && isEquipped(it)) unequipSlot(entity, it.equipSlot);
    collection.splice(i, 1);
    n++;
  }
  return n;
}

/** AUDIT 63 F28 - SaveLoadManager.RemoveAllOrphanedItems (:1560-1571):
 *  Items, WagonItems, OtherItems in that order, and the one log line
 *  when anything went (:1567-1570). */
export function removeAllOrphanedItems(entity, getQuest) {
  if (!entity) return 0;
  let count = 0;
  count += removeOrphanedItems(entity, entity.items, getQuest);
  count += removeOrphanedItems(entity, entity.wagonItems, getQuest);
  count += removeOrphanedItems(entity, entity.otherItems, getQuest);
  if (count > 0) console.log(`Removed ${count} orphaned items.`);
  return count;
}

/** The restore half. Keeps the port's RECORDED null-arm departure: DFU
 *  calls RestoreConversationData(null) on a save with no conversation
 *  block, which RESETS the mill (TalkManager.cs:2440-2443 mints a
 *  fresh SaveDataConversation); the port leaves the live session
 *  standing on a pre-TK save (world.js quickLoad, recorded there).
 *  Returns whether a quest envelope was present, for the world host's
 *  _questStarted latch. */
export function restoreSessionState(extras, { questBridge = null, talk = null, entity = null, spawnLedger = null } = {}) {
  // restore(null) is a no-op and the live machine stands (Q4-v law).
  questBridge?.restore(extras?.quest ?? null);
  // U41: SetTravelMapFromSaveData(null) is DFU's own arm for a save
  // with no block (:1344-1345) - it restores the struct's defaults,
  // so a pre-U41 save clears the filters rather than keeping the
  // live session's.
  restoreTravelMapSaveData(extras?.travelMap ?? null);
  // FE1: RestoreEscortingFacesData (SaveLoadManager.cs:1071-1079) -
  // null is DFU's OWN arm here: a save without the block CLEARS the
  // panel, so a pre-FE1 save loads with no stale portraits.
  restoreEscortFacesSaveData(extras?.escortingFaces ?? null);
  // QS1: the same arm - a save without the block CLEARS the slots, so
  // a pre-QS save and another character's never carry a stale kind.
  restoreQuickslotSaveData(extras?.quickslots ?? null);
  // TTL1: a save with no ledger LOADS AN EMPTY ONE, the same arm its
  // neighbours take. That is not a loss: an unknown spawn is noted on
  // the next build of its pixel and simply starts its seven days over,
  // which is what every pre-TTL1 save has to mean.
  spawnLedger?.load(extras?.spawns ?? null);
  if (extras?.talk && talk) {
    talk.mill.restoreSaveData(extras.talk);
    talk.tree.restoreSaveData(extras.talk);   // the orphan sweep + relink + TellMeAbout tail run inside
    talk.session.restoreSaveData(extras.talk);
    // RestoreConversationData's mill-orphan sweep (:2522-2533)
    talk.mill.removeOrphanedQuestRumors((id) => !!questBridge?.machine.getQuest(id));
  }
  // AUDIT 63 F28: `// Clear any orphaned quest items` /
  // `RemoveAllOrphanedItems();` - SaveLoadManager.cs:1517-1518, the
  // last act of LoadGame before ClampLegalReputations (:1543, which
  // restorePlayer already runs). It sweeps the three player
  // collections of items whose quest is gone or tombstoned; nothing
  // else in DFU cleans them up, and Item.Dispose (Item.cs:258-268,
  // the port's removeItemFromPlayer hook) only ever reaches the MAIN
  // pack, so a droppable quest item stashed in the wagon outlived its
  // quest for the life of the character - and, once the quest was
  // expired, could not be taken back out either (itemTransfer.js's
  // CanDropQuestItems refusal).
  //
  // IT MUST RUN HERE AND NOT IN restorePlayer: the C#'s order is quest
  // restore (:1433) THEN sweep (:1518), so the lookup is against the
  // RESTORED quests. restorePlayer runs before this composer at both
  // host seams, where the machine still holds the OUTGOING session's
  // quests (or, on a boot load, none at all).
  //
  // Two port-only gates, both back-compat and neither a behaviour
  // departure: no machine to ask (the standalone ?dungeon scene mounts
  // none) and no quest envelope in the save (a pre-Q4-v save, a shape
  // DFU never writes - its items would sweep against an unrelated live
  // machine). Either way the live pack stands, as it did before.
  if (entity && questBridge?.machine && extras?.quest != null) {
    removeAllOrphanedItems(entity, (uid) => questBridge.machine.getQuest?.(uid) ?? null);
  }
  return !!extras?.quest;
}

/** Storage backend (absent in headless - callers gate): the DA1 seam,
 *  so the desktop shell's file store answers where a browser answers
 *  localStorage.
 *  setItem THROWS on real browsers - QuotaExceededError when storage
 *  is full, or a SecurityError under private-browsing modes that
 *  disable storage. An unguarded throw here propagates through the F9
 *  handler and kills the frame (the same unguarded-browser-API class
 *  as the bare requestPointerLock crash). Return false on failure so
 *  the caller reports "save failed" instead of crashing. */
export function writeQuicksave(snap, storage = appStorage()) {
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
export function restorableQuicksave(storage = appStorage()) {
  const snap = readQuicksave(storage);
  return snap && snap.v === SAVE_VERSION ? snap : null;
}

export function readQuicksave(storage = appStorage()) {
  if (!storage) return null;
  const raw = storage.getItem(QUICKSAVE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { console.warn('[save] corrupt quicksave'); return null; }
}
