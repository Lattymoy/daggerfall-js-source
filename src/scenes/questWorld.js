// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { changeLegalRep, legalRepOf } from '../systems/court.js';
import { currentWeather } from '../systems/weather/weatherSim.js';
import { discoverLocation } from '../systems/discovery.js';
import { dungeonLocationFor } from '../world/smallerDungeons.js';
import { dungeonItemMarkerCount } from '../systems/quest/place.js';   // START2: a start dungeon holds a quest item's marker
import { startOfSiteId } from '../systems/starts/starts.js';   // START2: a start's own site
import { ENEMY_BASICS } from '../characters/enemy/enemyBasics.js';
import { entityOccupancy, heldSpots, holdSpotWhile, mintQuestFoeWave, partnerStandsQuestFoes, placeFoeEnv, questFoeGender } from './quest/questFoeHost.js';
import { fieldOfView } from '../ui/viewSettings.js';
import { findFactionByTypeAndRegion, getCourtOfCurrentRegion, getPeopleOfCurrentRegion, locationCompassDirection, lordNameForFaction } from '../systems/talk/talk.js';
import { generateBuildingName, BUILDING_TYPES as TALK_BUILDING_TYPES } from '../world/buildingNames.js';
import { getBool } from '../systems/settings/settings.js';
import { getDivine } from '../systems/guild/guildVariants.js';
import { GUILD_GROUPS } from '../formats/factionFile.js';
import { isHouseOwned } from '../systems/banking.js';
import { isWorldRoom } from '../net/wire.js';
import { keptOffArenaGround } from '../systems/arena/arenaGround.js';
import { liveVampirism } from '../systems/racialLive.js';
import { localizedText } from '../systems/textManager.js';
import { PLACE_FOE_DEFAULTS, placeFoeFreely } from '../systems/quest/sceneMount.js';
import { playerEntity } from '../characters/playerEntity.js';
import { REGION_RACES } from '../formats/mapsFile.js';
import { REGION_NAMES, isProvinceRegion } from '../formats/mapsTables.js';   // AUDIT RELEASE R2-4: a province's region's name past the Bay
import { spellRecordOfIndex } from '../systems/loot/loot.js';

/** @param {any} host */
export function createQuestWorld(host) {
  const {
    NAVAL_DECK_BODY_R, _musicInLocationRect, _questLoc, _questRegionIndex, _questStore, _regionFaction,
    _respawnAtSite, arenaCityPixel, arenaCityStage, blocks, built, cam, collider, exteriorFoePool, exteriorFoes,
    homeLayoutsOnline, maps, navalDeckBody, onlineHomes, params, pipeline, placeByName, player, playerTravelOrigin,
    playerTravelPixel, questSiteMovedHere, startLairAt, talkBuildingCompassDirection, townTalk, walkMode, weatherOverride
  } = host;
  /** A dungeon as the quest layer's maps hand it on (AUDIT 28 W4, below: the smaller-dungeon law) - its two location
   *  doors' and START2's start seam's one sizing. The page flag off `params`, not `onlineOn` - that const is declared
   *  far below, and a quest parsed at chargen asks for its dungeon before it is ("Parsing quest FAILED! Cannot access
   *  'onlineOn' before initialization"). INSTANCES: online a quest's markers are chosen on the dungeon whole - its
   *  instance's layout (bible/11-Multiplayer/Instances.md); AUDIT WORLD34 B2: online, the room's one layout. */
  const questSized = (loc) => dungeonLocationFor(loc, { questMachine: host.questBridge?.machine, online: params.has('online'), whole: params.has('online') });
  const questWorld = {
    // AUDIT 28 W4 SELF-AUDIT (F-B2): DFU's smaller-dungeon law lives
    // INSIDE MapsFile.GetLocation, so quest marker enumeration walks
    // the FIVE-BLOCK dungeon when the law says so - the frozen quest
    // state exists precisely so the same five blocks come back when
    // the player arrives. The port sized only at the door: a quest
    // set up under the setting picked markers from the FULL dungeon
    // and could aim at a block the build does not have. The quest
    // layer's maps therefore sizes getLocation/getLocationByName the
    // way DFU's does, late-binding the machine (the bridge is created
    // after this adapter, and DFU's GetLocation consults the global
    // machine the same way - another quest's link on the same dungeon
    // wins there too).
    maps: Object.create(maps, {
      getLocation: { value: (r, l) => questSized(maps.getLocation(r, l)) },   // INSTANCES: online a quest's markers are chosen on the dungeon whole - its instance's layout (bible/11-Multiplayer/Instances.md)   // AUDIT WORLD34 B2: online, the room's one layout (SD-ONLINE: the world's size for it)
      getLocationByName: { value: (rn, ln) => questSized(placeByName(rn, ln)) },   // AUDIT-TESA A2-1: the clock's travel time to a site past the Bay
    }),
    getBlock: (name) => blocks.getBlockByName(name),
    // START2 (systems/starts/starts.js): A START'S OWN SITE - a province's start dungeon, which no MAPS.BSA table holds
    // (quest/place.js _setupFixedLocation asks it for a start's site id): the first of its candidates whose dungeon, as
    // the quest layer's maps size it (the smaller-dungeon law, as getLocation above), has a quest item's marker for the
    // commission (scenes/tamrielPlacesHost.js startLairAt) - sized the same way; or null, the land past the Bay unstood
    startSiteOfId: (id) => {
      const start = startOfSiteId(id);
      const loc = start ? startLairAt?.(start, (l) => dungeonItemMarkerCount((name) => blocks.getBlockByName(name), questSized(l)) > 0) : null;
      return loc ? questSized(loc) : null;
    },
    // NPC1: the =symbol_ macro's flat caption. The quest machine has
    // declared this seam since Q2 and nothing production-side answered
    // it - every =person_ expanded to nothing. FLATS.CFG answers it now.
    flatCaption: (archive, record) => pipeline.flatCaption(archive, record),
    // PlayerGPS.CurrentLocation is the location of the CURRENT MAP
    // PIXEL (in or out of the walls); IsPlayerInLocationRect is the
    // music director's own live rect flag.
    currentLocation: () => _questLoc(),
    currentRegionIndex: () => _questRegionIndex(),
    currentLocationIndex: () => _questLoc()?.locationIndex ?? -1,
    // M-X: the macro table's world reads. legalRepNow feeds %ltn's
    // fourteen bands; currentLocationType feeds %ct/%cn2. The talk
    // getters (%fa/%fe/%fpc...), lordNameForFaction and oldLeaderFate
    // stay unmounted - the talk-news arc's - and answer the charter's
    // null through the handlers' optional reads; currentBuildingName
    // is the interior host's and this exterior host answers none
    // ('[invalid]' at the handler, DFU's own outside-a-building arm).
    legalRepNow: () => legalRepOf(playerEntity, _questRegionIndex()),
    // Q5: the Weather and Climate triggers' reads - the weather IS
    // the seven-name enum, the climate the MAPS.BSA index at the
    // player's pixel.
    // AUDIT 39 (#27): the fold IS the identity and the index was a
    // NAME - WEATHER_TYPES is the name array and currentWeather()
    // already answers out of it, so the read was undefined -> null on
    // every call and the always-on Weather trigger could never match.
    currentWeatherKey: () => weatherOverride ?? currentWeather() ?? null,
    // QG1: CastSpellDo's two documented world reads, live at last -
    // the machine has declared both since the Q-arc and nothing
    // production-side answered them, so `cast X spell do` (three
    // corpus quests) completed its template at parse and the trigger
    // was dead. The record read is the G4 SPELLS.STD registry
    // (first-duplicate-wins, the Free Action patch applied - the same
    // dict DFU's broker rebuilds); the match is EntityEffectBundle
    // .HasMatchForClassicEffect over the port's spells, whose effect
    // entries ARE the classic (type, subType) pairs - C# folds both
    // sides through MakeClassicKey's byte casts (EntityEffect.cs:999-
    // 1002), so the compare folds to byte too.
    // TN1: THE TALK-NEWS GETTERS, mounted at last. The four faction
    // names are TalkManager's npcData fields - TK-iv computed them in
    // every arm of getGreetingIndex and recorded "the names nobody
    // reads"; MacroHelper.cs:965-995 reads all four through the
    // TalkManager getters (:1795-1824), so %fa/%fae/%fe/%fea/%fnpc/
    // %fpc/%fpa stop expanding empty. GetFactionName's HolyOrder arm
    // (:1815-1822) answers the TEMPLE'S deity - Temple.FactionOrder-
    // Name is `parent.deity.ToString()` - resolved through getDivine
    // off the building the player is inside; outside one (or in a
    // non-temple) C# would be off in GetGuild's catch-land, and the
    // port falls to pcFactionName, recorded.
    // IH1: the LAST four pending world reads.
    // %cbd - MacroHelper.CurrentBuilding (:849-867): inside a building
    // the name is REGENERATED from the building's own seed through
    // BuildingNames.GetName with the current location and region;
    // outside one C# answers "[invalid]", which is the handler's own
    // null arm here.
    currentBuildingName: () => {
      const b = host.modes?.interiorBuilding;
      if (!b) return null;
      return generateBuildingName(b.nameSeed, b.buildingType,
        { ...(townTalk.nameOpts?.() ?? {}), factionId: b.factionId ?? 0 });
    },
    // %nt - MacroHelper.NearbyTavern (:630-642): "just gets a random
    // tavern from current location and ignores how near it is" -
    // UnityEngine.Random.Range over the directory's taverns (the
    // ENGINE-PRNG rule's injectable uniform roll), the localized
    // "tavern" when the location has none.
    randomTavernName: (roll = Math.random) => {
      const taverns = (townTalk.buildingDirectory ?? []).filter((b) => b.buildingType === TALK_BUILDING_TYPES.Tavern);
      if (!taverns.length) return localizedText('tavern', 'tavern');   // L10N3d: MacroHelper.cs:641
      return taverns[Math.floor(roll() * taverns.length)]?.name ?? localizedText('tavern', 'tavern');
    },
    // Place.SetupSites' residence filter (Place.cs:1196):
    // DaggerfallBankManager.IsHouseOwned reads the CURRENT region's
    // owned-house slot (:140-148) - banking.js's own law, H1's home.
    isHouseOwned: (buildingKey) => isHouseOwned(playerEntity.houses ?? [], _questRegionIndex(), buildingKey),
    // HOME1: nor a player's online home - a quest must not send its player into a house its owner keeps shut. FIELD BUGS 2026-10-14 QUEST-HOME: in ANY town - the boot's read of every town's homes beside the towns this page has asked (systems/online/onlineHomes.js homeStands); the asked towns alone left every remote residence unguarded.
    isPlayerHome: (mapId, buildingKey) => onlineHomes?.homeStands(mapId, buildingKey) ?? false,
    // QUEST-HOME (Mac, 2026-10-15: "Close both"): a site chosen again because its building became a player's home - its
    // map mark moves with it: the old house's quest stamp undiscovered (Quest.cs:655's own undiscover), and where the
    // player had it on the map, the new one discovered under the quest's name
    questSiteMoved: (quest, place, was) => questSiteMovedHere(place, was),
    townLayoutsKnown: () => !homeLayoutsOnline || host._homeLayoutsApplied,   // QUESTOR-MOVED: a shared quest is mended on arrival only once the towns' layouts are known (applyLayoutPins' own gate, AUDIT WD3 S5) - AUDIT QA2: and STAND, the pins and their held-back towns set (a share landing while the packs were fetched was chosen again unpinned); the load's own re-seat mends one that landed before
    // Place's _getBuildingName bag - townTalk's ONE name bag, so the
    // quest's generated names and the talk directory's cannot drift.
    buildingNameOpts: () => townTalk.nameOpts?.() ?? {},
    factionNPC: () => host.npcSession.npcData?.npcFactionName ?? '',
    factionNPCAlly: () => host.npcSession.npcData?.allyFactionName ?? '',
    factionNPCEnemy: () => host.npcSession.npcData?.enemyFactionName ?? '',
    factionPC: () => host.npcSession.npcData?.pcFactionName ?? '',
    factionName: () => {
      if (host.npcSession.npcData?.guildGroup === GUILD_GROUPS.HolyOrder) {
        // AUDIT 39 (#26): factionId. The building record carries the
        // lowercase spelling (buildingDataForDoor's merge); the
        // uppercase one belongs to StaticNPC records, and reading it
        // here handed getDivine a 0 that can never resolve.
        const divine = getDivine(townTalk.factionDict, host.modes?.interiorBuilding?.factionId ?? 0);
        if (divine) return divine;
      }
      return host.npcSession.npcData?.pcFactionName ?? '';
    },
    // %fl1/%fl2/%ol1 - MacroHelper.GetLordNameForFaction, the one home
    // in systems/talk/talk.js (the first-child Individual, the parity
    // gender, the seeded classic stream)
    lordNameForFaction: (id, old = false) => lordNameForFaction(townTalk.factionDict, id, old),
    // %olf - the pipeline's own localized fates (answerPipeline TALK_STRINGS)
    oldLeaderFate: (i) => host.answerPipeline.getOldLeaderFateString(i),
    getClassicSpellEffects: (spellID) => spellRecordOfIndex(spellID)?.effects ?? null,
    spellHasMatchForClassicEffect: (sp, effect) => (sp?.effects ?? []).some((e) =>
      ((e.type ?? 0) & 0xff) === ((effect.type ?? 0) & 0xff)
      && ((e.subType ?? 0) & 0xff) === ((effect.subType ?? 0) & 0xff)),
    currentClimateIndex: () => maps.getClimateIndex(playerTravelPixel().x, playerTravelPixel().y),
    currentLocationType: () => _questLoc()?.mapTableData?.locationType ?? null,
    // AUDIT RELEASE R2-4 (bible/01-Overview/audits/Audit-Release-R2.md): PlayerGPS.CurrentRegionName - the loaded region's
    // name on the Bay (an empty region's '' as DFU's empty DFRegion), and past it the province's region's (WW-R), which no
    // MAPS.BSA record holds: '' there kept every NPC past the Bay from knowing a quest's place or person there (the place's
    // site names its province - scenes/tamrielPlacesHost.js), and "Where am I?" in a lair said "in ."
    currentRegionName: () => { const r = _questRegionIndex(); return maps.getRegion(r)?.name ?? (isProvinceRegion(r) ? REGION_NAMES[r] : ''); },
    isPlayerInLocationRect: () => _musicInLocationRect(),
    // F114: the bridge declares this hook as GetPlayerTravelPosition
    // "incl. its on-ship arm" (machine.js's ctx doc) and its one
    // consumer is the quest clock's travel arm, so it answers the
    // origin rule rather than PlayerGPS's raw pixel.
    playerPixel: () => playerTravelOrigin(),
    playerInside: () => {
      // B2: the DUNGEON arm - PcAt / IsPlayerHere / ConfigureFrom-
      // PlayerLocation never saw the player as inside one, which is
      // where the majority of the quest corpus sends them.
      if ((host.modes?.mode ?? 'exterior') === 'dungeon') {
        return { dungeon: { name: host.modes?.dungeonLocation?.name ?? '' } };
      }
      const b = host.modes?.interiorBuilding;
      if (!b) return null;
      return { building: { buildingKey: b.buildingKey, buildingType: b.buildingType, factionId: b.factionId, name: b.name ?? '' } };
    },
    // AUDIT 24 (the seven-slice sweep): FOUR SEAMS THE MACHINE HAS
    // DECLARED SINCE Q3 AND NOTHING ANSWERED. Every one of them was a
    // ported law running into `world?.x?.()` and evaporating - the
    // corpus's 193 `reveal` lines discovered nothing and filed no
    // note, %oth had no text to read, and every Person whose faction
    // race does not map fell to -1 instead of the region's race.
    /** PlayerGPS.DiscoverLocation (:872-890): resolve by name and file
     *  it, THROWING when the pair names nothing - C#'s own throw. */
    discoverLocation: (regionName, locationName) => {
      // AUDIT CAPTAIN'S SEA P8: an isle's place is in no MAPS.BSA table - found in the index it stands in (a guild's local
      // job in an isle town threw here on its first tick, and the quest was removed)
      const loc = placeByName(regionName, locationName);   // AUDIT-TESA A2-1: past the Bay too (an Arena town's guild job threw here and was removed)
      if (!loc?.loaded && !loc?.ether) throw new Error(`Error finding location ${regionName} : ${locationName}`);
      return discoverLocation(loc.mapTableData.mapId, { regionName: loc.regionName, locationName: loc.arena && !loc.capital ? '' : loc.name });   // QREPAIR: whether it was new, for the repair's count (RevealLocation reads nothing back)
    },
    /** RevealLocation's readmap note - PlayerNotebook.AddNote(string). */
    addNote: (text) => host.questBridge?.notebook?.addNote(text),
    /** JournalNote's filing - the OTHER overload,
     *  PlayerNotebook.AddNote(List<TextFile.Token>). */
    addNoteTokens: (tokens) => host.questBridge?.notebook?.addNoteTokens(tokens),
    /** PlayerGPS.GetRaceOfCurrentRegion (:432-435): a RACES value,
     *  RegionRaces[index] + 1 - NOT a FactionRaces one. */
    currentRegionRace: () => REGION_RACES[_questRegionIndex()] + 1,
    // AUDIT 39 (#23): THE FIVE FACTION-TYPE READS Person.cs's
    // GetFactionTypeFactionID makes (:967-1018) and the %vam name
    // beside them. Unmounted, each `?? -1` landed in
    // _setupFactionTypeNPC's ZERO_FACTION arm, so every quest Person
    // declared `factiontype People/Courts/Province/Vampire_Clan` -
    // and every `group Resident1-4` career default - was built from
    // the zero record with a console warning. All five producers were
    // already in this file; only the mounts were missing.
    /** PlayerGPS.GetPeopleOfCurrentRegion (:440-457). Its sibling
     *  npcSession seam takes the LOCATION's region; this one is
     *  CurrentRegionIndex, which is what the C# reads. */
    currentRegionPeople: () => getPeopleOfCurrentRegion(_questStore()?.dict ?? null, _questRegionIndex())?.id ?? -1,
    /** PlayerGPS.GetCourtOfCurrentRegion (:469-483). */
    currentRegionCourt: () => getCourtOfCurrentRegion(_questStore()?.dict ?? null, _questRegionIndex())?.id ?? -1,
    /** PlayerGPS.GetCurrentRegionFaction (:459-467) - GetRegionFaction
     *  is FindFactions(Province, -1, -1, region), first row. */
    currentRegionFaction: () => _regionFaction()?.id ?? -1,
    /** PlayerGPS.GetCurrentRegionVampireClan (:485-490): the SAME
     *  Province record's `vam` column. */
    currentRegionVampireClan: () => _regionFaction()?.vam ?? -1,
    /** (racialEffect as VampirismEffect).VampireClan - the clan the
     *  curse entry carries; -1 when the PC is no vampire. */
    playerVampireClan: () => liveVampirism(playerEntity)?.clan ?? -1,
    /** VampirismEffect.GetClanName (:317-320). NULL - never '' - is
     *  what makes %vam print C#'s own "PC not a vampire" literal. */
    playerVampireClanName: () => {
      const clan = liveVampirism(playerEntity)?.clan ?? 0;
      if (!clan) return null;
      return _questStore()?.dict.get(clan)?.name ?? '';
    },
    /** TextProvider.GetRandomText (:250-268) - the flat Text-token
     *  pool over one TEXT.RSC record. */
    getRandomText: (id) => townTalk.randomText(id),
    /** The journal clock's countdown toggle. AUDIT 24: clock.js has
     *  read this seam since Q4-iv and nothing answered it, so the
     *  port's own "Journal Countdowns" switch did nothing. */
    showClocksAsCountdown: () => getBool('GUI', 'ShowQuestJournalClocksAsCountdown'),
    locationRevealedByMapItem: () => host._locationRevealedByMapItem,   // MACROS1: %map (questMacros.js) - PlayerGPS's field, set by the map reveal above
    getFactionData: (id) => _questStore()?.dict.get(id) ?? null,
    findFactionsOfType: (type) => { const s = _questStore(); return s ? [...s.dict.values()].filter((f) => f.type === type) : []; },
    /** FindFactionByTypeAndRegion (PersistentFactionData.cs:236-265):
     *  an EXACT type+region match returns immediately (the first one
     *  wins); otherwise the LAST `region == -1` faction of that type
     *  is the partial match, because the loop keeps overwriting it;
     *  a total miss answers the zero struct, which reads as null here
     *  and lets %rt/%nrn take C#'s zero-struct fallbacks.
     *
     *  AUDIT 24 (wave 26): %rn/%rt have called this since Q4-i and
     *  nothing answered it - it was invisible to the seam gate, which
     *  could not see through questMacros.js's `const w = hooks?.world`
     *  alias. */
    findFactionByTypeAndRegion: (type, regionIndex) => {
      const s = _questStore();
      return s ? findFactionByTypeAndRegion(s.dict, type, regionIndex) : null;
    },
    /** GetLocationCompassDirection (TalkManager.cs:1238-1281) - %di's
     *  remote arm. Same wave, same alias hole. */
    locationCompassDirection: (place) => locationCompassDirection(
      { playerMapPixel: playerTravelPixel, maps },
      place?.siteDetails?.locationName ?? '',
    ),
    /** GetBuildingCompassDirection (TalkManager.cs:1203-1236) - %di's
     *  LOCAL arm, over the SAME closure the answer pipeline is given. */
    buildingCompassDirection: (buildingKey) => talkBuildingCompassDirection(buildingKey),
    // AUDIT 39 (#25): LegalRepute.cs:48-52 writes
    // PlayerGPS.CurrentRegionIndex, which is the POLITIC read - the
    // location's regionIndex is absent across the whole wilderness,
    // so the `?? 0` arm was the common case and filed the change
    // against Alik'r. The object's own read (legalRepNow) always used
    // _questRegionIndex; the write now agrees with it.
    changeLegalRep: (amount) => changeLegalRep(playerEntity, _questRegionIndex(), amount),
    mountCurrentSiteQuestResources: () => host.modes?.mountQuestResources?.(),
    /** AUDIT 63 F1: ActiveGameObjectDatabase.GetActiveStaticNPCQuest
     *  ResourceBehaviours (ActiveGameObjectDatabase.cs:307-311) - the
     *  list AddQuestor walks to relink an individual's standing
     *  behaviour (Quest.cs:483-496). DFU's cache spans every static
     *  NPC in the scene, so the answer is the UNION of the modal
     *  hosts' (interior people, interior and dungeon marker stands)
     *  and this host's own STREET NPCs, which carry the same bootstrap
     *  behaviour (exteriorNpcs.js's quest pass) and stand individuals
     *  too. Inactive hosts are dropped - GetActiveComponents keeps
     *  only activeInHierarchy objects (:32-46). */
    staticNpcQuestBehaviours: () => {
      const out = host.modes?.activeStaticNpcQuestBehaviours?.() ?? [];
      for (const entry of built.values()) {
        for (const pn of entry.npcs ?? []) {
          const b = pn.questBehaviour;
          if (!b || typeof b.host?.staticNpcFactionId !== 'number') continue;
          if (b.host.isActive?.() === false) continue;
          out.push(b);
        }
      }
      return out;
    },
    // ---- B1 (AUDIT 25 blocker 1): THE FOE SPAWN SEAMS. The machine
    // has declared these since Q3-iii and no host answered - the
    // placement law sat fully ported in sceneMount.js with no caller,
    // so no quest that kills or meets a Foe could ever complete.
    /** GameObjectHelper.CreateFoeGameObjects (:1243-1305), data side:
     *  `count` inactive handles, one QuestResourceBehaviour each;
     *  activation (bindHost + start) waits for placement. */
    createFoeGameObjects: (foe, count) => mintQuestFoeWave(host.questBridge.machine, foe, count),
    /** CURSE-OFF-SAND (FIELD BUGS 2026-10-04e): CreateFoe's spawn event passes while the player stands where the wave is
     *  kept off (systems/arena/arenaGround.js - the Curse of Daggerfall's dead off the arena's grounds, its floor and
     *  undercroft): outside, the city's arena grounds; inside, the mode machine's answer. */
    foeKeptOff: (foe) => ((host.modes?.mode ?? 'exterior') !== 'exterior'
      ? !!host.modes?.questFoeKeptOff?.(foe)
      : keptOffArenaGround({ questName: foe?.parentQuest?.questName, feet: player.pos, centre: arenaCityPixel() ? arenaCityStage.centre() : null })),
    /** CreateFoe.TryPlacement (:183-211): the INSIDE arms live with
     *  the modes host (dungeon places, interior pends - see the FLAG
     *  there); outside, IsPlayerInLocationRect picks the location ring
     *  (5/20) and the wilderness arm widens to 8/25 (:252-257).
     *  DFU's wilderness arm also TrackLooseObject's the spawn into
     *  the streaming world - the pool's cull owns that lifetime here. */
    tryPlaceFoe: (handle) => {
      const m = host.modes?.mode ?? 'exterior';
      if (m !== 'exterior') {
        // QUEST-PARTY phase 3b/3c: in a building or a dungeon the member who shared this quest, in the room and near,
        // stands the wave (through a relay whose own lane carries it here); this copy counts it as placed, as the open
        // air's does - VERMIN-SHARED: only while the sharer's foe of this wave's Foe stands here; else this copy stands its own
        if ((m === 'interior' || m === 'dungeon') && host.online?.ownOk && isWorldRoom(host.online.room) && partnerStandsQuestFoes({ questName: handle.foe?.parentQuest?.questName, symbol: handle.foe?.symbol?.name, sharerOf: (q) => host._liveSharer(q), inMyParty: (a) => !!host.social?.inMyParty(a), peers: host.peersNear(), accountOfPeer: (id) => host.social?.accountOfPeer(id), myFeet: player.pos, foes: host.modes?.insideFoes?.() ?? [] })) return true;
        return host.modes?.tryPlaceQuestFoe?.(handle) ?? false;
      }
      if (!(walkMode && host.playerSpawned)) return false;
      // NAV-D: a raid the sea fight started (a pirate grappled a crewed boat) stands its waves on the deck they board -
      // the boat's own, not the wilderness ring (scenes/naval/navalHost.js placeQuestFoe): Warm Ashes' "Your crew quickly
      // spring into action!" is a fight on your planks
      // AUDIT NAV1 (B10): a spot held - a body on it, or one standing up there (the ring's own two tests) - is passed
      // over, and the one taken held while its foe stands up; none free, the wave waits (`false`)
      const _held = entityOccupancy((f) => f.ai?.feet, () => [...exteriorFoePool(), ...heldSpots(collider)], player.pos);
      const _deck = host.naval?.placeQuestFoe(handle.foe?.parentQuest ?? null, (s) => !_held({ x: s[0][0], y: s[0][1] + 0.9, z: s[0][2] }, NAVAL_DECK_BODY_R));
      if (_deck === false) return false;
      if (_deck) {
        holdSpotWhile(collider, { x: _deck[0][0], y: _deck[0][1] + 0.9, z: _deck[0][2] }, () => exteriorFoes.spawnFoe(handle.foe.foeType, _deck[0], { gender: questFoeGender(handle.foe), yaw: _deck[1], questBehaviour: handle.behaviour, feetGiven: true }))
          .then((f) => { if (!host.raidAshore.late(handle.foe?.parentQuest, f)) navalDeckBody(f, _deck[2]); })   // DECK-WALK: a raid's wave stands on her deck, and stays on it; RAID-WON: unless its raid ended while it stood up
          .catch((e) => console.error('[quest] naval deck foe stand failed:', e?.message ?? e));
        return true;
      }
      const feet = player.pos;
      // QUEST-PARTY: the member who shared this quest stands near - that copy stands the wave and this one sees it
      // through the stream; here it counts as placed (its message and its count run on) - VERMIN-SHARED: only while the sharer's foe of this Foe stands here
      if (partnerStandsQuestFoes({ questName: handle.foe?.parentQuest?.questName, symbol: handle.foe?.symbol?.name, sharerOf: (q) => host._liveSharer(q), inMyParty: (a) => !!host.social?.inMyParty(a), peers: host.peersNear(), accountOfPeer: (id) => host.social?.accountOfPeer(id), myFeet: feet, foes: exteriorFoes.foes })) return true;
      const env = placeFoeEnv({
        collider,
        // origin at the controller centre - DFU casts from
        // PlayerObject.transform.position, not the feet
        playerFeet: [feet[0], feet[1] + 0.9, feet[2]],
        playerYawRad: cam.yaw,
        // MERGE (the S-A lane's catch): fieldOfView() answers RADIANS,
        // the law speaks DEGREES - raw, every foe placed dead ahead
        // inside the view instead of just outside the cone.
        fovDegrees: fieldOfView() * 180 / Math.PI,
        // AUDIT 62 F15: the WHOLE street, not the encounter pool alone.
        // CreateFoe.cs:319-323 is `Physics.OverlapSphere(testPoint,
        // overlapSphereRadius); if (colliders.Length > 0) return;` -
        // ANY collider refuses the spot, and a watchman's capsule is a
        // collider. This arm asked `exteriorFoes.foes` while its own
        // sibling at :2457 and the ?exterior twin both ask the join, so
        // a quest foe could be stood inside a standing watchman.
        // QUEST-WAVE: and the spots a stand in flight holds - a wave placed in one tick saw none of its own
        isOccupied: entityOccupancy((f) => f.ai?.feet, () => [...exteriorFoePool(), ...heldSpots(collider)], feet),
      });
      const spot = _musicInLocationRect() ? placeFoeFreely(env)
        : placeFoeFreely(env, { minDistance: PLACE_FOE_DEFAULTS.wildernessMinDistance, maxDistance: PLACE_FOE_DEFAULTS.wildernessMaxDistance });   // AUDIT 68 S30-placefoe-defaults-dup
      if (!spot) return false;
      const foe = handle.foe;
      // FinalizeFoe (CreateFoe.cs:341-359): a FLYING foe lifts 1.5
      // from the test point; walkers land through the pool's own chain.
      const _fly = (ENEMY_BASICS[foe.foeType]?.behaviour ?? 'General') === 'Flying';
      holdSpotWhile(collider, spot, () => exteriorFoes.spawnFoe(foe.foeType, [spot.x, _fly ? spot.y + 1.5 : spot.y, spot.z], {
        gender: questFoeGender(foe),
        yaw: Math.atan2(feet[0] - spot.x, feet[2] - spot.z),   // LookAt player (CreateFoe.cs:328)
        questBehaviour: handle.behaviour,
      })).then((f) => host.raidAshore.late(foe.parentQuest, f)).catch((e) => console.error('[quest] exterior foe stand failed:', e?.message ?? e));   // RAID-WON (AUDIT FB1019 D1): a raid's wave landing after its raid ended, withdrawn
      return true;
    },
    /** GameManager.RaiseOnEncounterEvent - its one core consumer is
     *  the rest window's AbortRestForEnemySpawn, routed through the
     *  modes host (dungeon mode owns the only rest overlay). */
    raiseOnEncounterEvent: () => { host.travelOptions?.onEncounter(); host.modes?.raiseOnEncounterEvent?.(); },   // AUDIT-TO1 B3: GameManager_OnEncounter (:405-413) hears it first
    // ---- B3: THE RESPAWN SEAMS (TeleportPc's transport - see
    // _respawnAtSite above for the composition and the BT1 record of
    // DFU's own partial implementation).
    /** GetLocation + RespawnPlayer (TeleportPc.cs:96-118): true =
     *  the respawn STARTED (the action idles on isRespawning); false =
     *  unresolvable location, retry - the C#'s ONLY refusal. */
    respawnPlayerAtSite: (place) => {
      const sd = place?.siteDetails;
      if (!sd || host._respawning) return false;
      const loc = placeByName(sd.regionName, sd.locationName);   // AUDIT-TESA A2-1: a site past the Bay too
      if (!loc?.loaded) return false;
      host._respawning = true;
      _respawnAtSite(loc)
        .catch((e) => console.error('[quest] respawn failed:', e?.message ?? e))
        .finally(() => { host._respawning = false; });
      return true;
    },
    isRespawning: () => host._respawning,
    /** AUDIT STARTS W5: the start host's move into its dungeon (scenes/startsHost.js) - the quest's own transport, latched
     *  as TeleportPc's is (`_respawning`: worldMoveBusy - no load, save, journey or Recall while its dungeon builds). */
    respawnLatched: async (loc) => { host._respawning = true; try { await _respawnAtSite(loc); } finally { host._respawning = false; } },
    /** The marker landing on the tick after the respawn completes
     *  (TeleportPc.cs:120-135) - scene space per the mounted mode. */
    setPlayerScenePosition: (p) => { if (p) host.modes?.setPlayerScenePosition?.(p); },
  };
  return { questWorld };
}
