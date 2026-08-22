// THE QUEST PERSON (Q1 declaration + Q3-ii world binding) - Person.cs.
// The options scan runs over the WHOLE line (unlike Item/Clock, which
// scan only past the declaration - a DFU asymmetry kept as-is), and
// DFU throws when none of named/group/factionType/faction identifies
// the NPC.
//
// Q3-ii ships THE SETUP CHAIN: the identification ladder dispatches
// SetupIndividualNPC / SetupCareerAllianceNPC (with the Questor arm
// off the machine's last-clicked NPC) / SetupFactionTypeNPC /
// SetupFactionAllianceNPC against the vendored Quests-Factions table
// and the host's PERSISTENT faction store, then AssignRace / Gender /
// HUDFace / DisplayName / HomeTown run in C#'s order. World facts
// ride quest.hooks.world (the persistent faction store accessors and
// the region-faction lookups documented at machine.js); a HEADLESS
// parse leaves `npcPending` true LOUDLY, the sitePending precedent.
// Random draws ride the quest's injectable roll (Ledger A), including
// the DateTime.Now.Millisecond name seed, and the display name's
// classic srand(nameSeed) draw is DFU's own.
//
// QUIRKS KEPT (each cited inline): AssignHUDFace IGNORES the parsed
// face index and always rolls 0..9; the factionType==-1 "random type"
// draw assigns the RAW Range(0,4) INDEX as the type (Daedra/God/
// Group/Subgroup - never the Courts/Province/People/Temple the array
// beside it promises); a failed lookup error-LOGS and leaves the
// zero faction record, it does not throw.

import { QuestResource } from './questResource.js';
import { Symbol as QuestSymbol, symbolToSaveData, symbolFromSaveData } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';
import { factionsTable, placesTable } from './tables.js';
import { raceFromFactionRace, factionRaceFromRace, ZERO_NPC_DATA } from '../../characters/staticNpc.js';
import { raceById } from '../races.js';
import { Place } from './place.js';
import { FACTION_TYPES } from '../../formats/factionFile.js';
import { getNameBankOfRegion, fullName, GENDERS } from '../../characters/nameHelper.js';
import { srand } from '../../formats/dfRandom.js';
import { ORDERS } from '../guildVariants.js';

const DECL = /(Person|person) (?<symbol>[a-zA-Z0-9'_.-]+)/;
const OPTIONS = /named (?<individualNPCName>[a-zA-Z0-9'_.-]+)|face (?<faceIndex>\d+)|(factionType|factiontype) (?<factionType>[a-zA-Z0-9'_.-]+)|faction (?<factionAlliance>[a-zA-Z0-9'_.-]+)|group (?<careerAlliance>[a-zA-Z0-9'_.-]+)|(?<gender>female|male)|(?<locationScope>local|remote)|(?<atHome>atHome|athome)/g;

const FACE_COUNT = 10;   // Person.cs:35

/** The zero faction record a failed lookup leaves behind: C#'s
 *  default(FactionData) is EVERY int field 0 (FactionFile.cs:640-672)
 *  - race 0 reads as FactionRaces.Nord, so a failed lookup yields a
 *  NORD, not the region race (AUDIT VI: the -1s here were wrong). */
const ZERO_FACTION = Object.freeze({
  id: 0, parent: 0, type: 0, name: '', rep: 0, summon: 0, region: 0,
  power: 0, flags: 0, ruler: 0,
  ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0,
  face: 0, race: 0, flat1: 0, flat2: 0, sgroup: 0, ggroup: 0,
  minf: 0, maxf: 0, vam: 0, rank: 0,
});

/** Person.GetFactionData (Person.cs:848-856), the STATIC one - the
 *  quest actions call it too (WhenNpcIsAvailable.cs:58,
 *  WhenReputeWith.cs:57). A missing record is a hard THROW; only
 *  factionID 0 answers the zero record, whose type is 0 and so fails
 *  every `type != Individual` test that follows. */
export function getFactionDataOrThrow(world, factionID) {
  const record = world?.getFactionData?.(factionID) ?? null;
  if (!record && factionID !== 0) throw new Error(`Could not find faction data for FactionID ${factionID}`);
  return record ?? ZERO_FACTION;
}

/** KnightlyOrder.Orders in C# Enum.GetValues order - sorted by VALUE
 *  (KnightlyOrder.cs:49-61). */
const KNIGHTLY_ORDER_IDS = Object.freeze([...Object.values(ORDERS)].sort((a, b) => a - b));

export class Person extends QuestResource {
  constructor(parentQuest, line = null) {
    super(parentQuest);
    this.individualNPCName = '';
    this.faceIndex = -1;
    this.factionTypeName = '';
    this.factionAllianceName = '';
    this.careerAllianceName = '';
    this.genderName = '';
    this.locationScopeName = '';
    this.atHome = false;
    this.isIndividualNPC = false;
    this.isIndividualAtHome = false;
    this.assignedPlaceSymbol = null;   // C# lastAssignedPlaceSymbol - the Place this person stands at
    this.npcPending = true;   // no world seam -> the Setup*NPC chain pends LOUDLY
    // Q2b lifecycle flags (Person.cs:42,86,143,149).
    this.isMuted = false;
    this.isDestroyed = false;
    this.isQuestor = false;
    this.displayName = '';
    // Q3-ii world-bound state (Person.cs:36-56)
    this.factionData = null;      // the persistent faction record (null while pending)
    this.factionTableKey = '';
    // AUDIT 24 (the seven-slice sweep): `race` is a RACES value, C#'s
    // own field, and it was never real here - the port kept only
    // factionRace and getSaveData wrote `race: this.race ?? -1`, so the
    // envelope's race column has been -1 for every Person ever saved.
    // Worse, the region FOLD conflated the two enums: AssignRace's
    // fallback is GetRaceOfCurrentRegion(), a Races, and it was being
    // stored straight into a FactionRaces field. `factionRace` is now
    // DERIVED from race through the same GetFactionRaceFromRace the
    // oath reads, so there is one truth.
    this.race = -1;               // Races (EntityEnums), -1 = None
    this.factionRace = -1;        // FactionFile.FactionRaces number, derived from race
    this.nameBank = null;
    this.npcGender = GENDERS.Male;
    this.nameSeed = -1;
    this.homePlaceSymbol = null;
    this.assignedToHome = false;
    // StaticNPC.NPCData of the clicked questor. AUDIT 24 (the
    // seven-slice sweep): C#'s field is a STRUCT, so it is never null -
    // an un-setup questor holds the ZERO struct, and topicTree's
    // GetPersonBuildingKey / quest-topic rebuild and sceneMount's
    // billboard pick all read it WITHOUT a guard, exactly as C# can.
    // The port had null here, and `add <sym> as questor` (the other
    // route to isQuestor, which never calls SetupQuestorNPC) crashed
    // all three.
    this.questorData = { ...ZERO_NPC_DATA };
    if (line !== null) this.setResource(line);
  }

  get isPerson() { return true; }

  /** Quest.cs / dialog surfaces read the faction id off the record. */
  get factionId() { return this.factionData?.id ?? 0; }

  /** SetAssignedPlaceSymbol / GetAssignedPlaceSymbol (Person.cs). */
  setAssignedPlaceSymbol(placeSymbol) { this.assignedPlaceSymbol = placeSymbol?.clone() ?? null; }
  getAssignedPlaceSymbol() { return this.assignedPlaceSymbol; }

  /** GetHomePlace (Person.cs:452). */
  getHomePlace() {
    return this.homePlaceSymbol ? this.parentQuest.getPlace(this.homePlaceSymbol) : null;
  }

  get gender() { return this.npcGender; }

  /** HomeRegionName / HomeRegionIndex / HomeBuildingName
   *  (Person.cs:112-125 -> :523-569): all derive from the HOME Place -
   *  BLANK / -1 when the person has none. The index resolves the home
   *  region NAME back through the map reader, exactly C#'s
   *  GetRegionIndex walk. TK-ii's topic tree reads these. */
  get homeRegionName() {
    const place = this.getHomePlace();
    return place ? place.siteDetails.regionName : 'BLANK';
  }

  get homeRegionIndex() {
    const place = this.getHomePlace();
    if (!place) return -1;
    const maps = this.parentQuest?.hooks?.world?.maps;
    return maps?.getRegionIndex?.(place.siteDetails.regionName) ?? -1;
  }

  get homeBuildingName() {
    const place = this.getHomePlace();
    return place ? place.siteDetails.buildingName : 'BLANK';
  }

  /** GetDialogPlace (Person.cs): the assigned Place, else home. */
  getDialogPlace() {
    if (this.assignedPlaceSymbol) return this.parentQuest.getPlace(this.assignedPlaceSymbol);
    return this.getHomePlace();
  }

  /** ExpandMacro (Person.cs:295-350): stores this person (and their
   *  dialog place) as the quest's last-referenced for pronouns/%di.
   *  _symbol_ display name; __symbol_ building, ___symbol_ town,
   *  ____symbol_ region - all off the DIALOG place, the literal
   *  "BLANK" when the person stands nowhere; =symbol_ the flat
   *  caption through the world's FLATS.CFG seam (C#'s
   *  IsIndividualNPC flat1 arm is a DEAD STORE - the gender if-else
   *  overwrites it unconditionally, kept as written); ==symbol_ the
   *  faction name (a questor answers the QUEST's faction - the
   *  guild - not their own). */
  expandMacro(macroType) {
    const quest = this.parentQuest;
    quest.lastResourceReferenced = this;
    const dialogPlace = this.getDialogPlace();
    if (dialogPlace) quest.lastPlaceReferenced = dialogPlace;
    const world = quest.hooks?.world;
    switch (macroType) {
      case 1:   // NameMacro1 - display name
        return this.displayName;
      case 2:   // NameMacro2 - building name
        return dialogPlace ? dialogPlace.siteDetails.buildingName : 'BLANK';
      case 3:   // NameMacro3 - town name
        return dialogPlace ? dialogPlace.siteDetails.locationName : 'BLANK';
      case 4:   // NameMacro4 - region name
        return dialogPlace
          ? (world?.maps?.getRegion?.(dialogPlace.siteDetails.regionIndex)?.name ?? 'BLANK')
          : 'BLANK';
      case 5: {   // DetailsMacro - the flat caption ("young lady in green")
        // GetFlatDetailsString (Person.cs:354-383). FactionFile.GetFlatData:
        // archive = flat >> 7, record = flat & 0x7f.
        //
        // C# QUIRK KEPT: the IsIndividualNPC arm ("Individuals are
        // always flat1 no matter gender") has NO else, so the gender
        // branch immediately overwrites it and an individual FEMALE
        // still takes flat2. The comment is a lie about C#'s own dead
        // assignment; the port writes what actually runs.
        //
        // AUDIT 24 (the seven-slice sweep): the FALLBACK was missing.
        // When FLATS.CFG has no caption for the flat id, DFU answers
        // the RACE NAME - `GetRaceDictionary()[(int)race].Name` - not
        // an unexpanded macro. The port returned false and left
        // "=symbol_" standing in the text.
        const flat = (this.npcGender === GENDERS.Male ? this.factionData?.flat1 : this.factionData?.flat2) ?? 0;
        return world?.flatCaption?.(flat >> 7, flat & 0x7f)
          ?? raceById(this.race)?.name ?? false;
      }
      case 6: {   // FactionMacro
        if (this.isQuestor) {
          const guild = world?.getFactionData?.(quest.factionId);
          return guild ? guild.name : false;
        }
        return this.factionData?.name ?? false;
      }
      default:
        return false;
    }
  }

  /** Tick (Person.cs:385-404): the auto-home hot-place (AUDIT VI).
   *  A generated home stands dormant until the PLAYER ENTERS it -
   *  then the NPC is placed exactly as "place npc at home" would,
   *  but only while nothing else has placed them. Never re-fires:
   *  the assignment is permanent for the quest's duration. */
  tick(caller) {
    super.tick(caller);
    if (this.assignedPlaceSymbol === null && this.homePlaceSymbol !== null && !this.assignedToHome) {
      const home = this.parentQuest.getPlace(this.homePlaceSymbol);
      if (!home) return;
      if (home.isPlayerHere()) this.placeAtHome();
    }
  }

  /** PlaceAtHome (Person.cs:414-429): pins this person to their
   *  generated home Place - never questors or individuals. */
  placeAtHome() {
    const homePlace = this.parentQuest.getPlace(this.homePlaceSymbol);
    if (!homePlace || this.isQuestor || this.isIndividualNPC) return false;
    const hooks = this.parentQuest.hooks;
    if (!hooks?.hasSiteLink?.(this.parentQuest, this.homePlaceSymbol)) {
      hooks?.createSiteLink?.(this.parentQuest, this.homePlaceSymbol);
    }
    homePlace.assignQuestResource(this.symbol);
    this.setAssignedPlaceSymbol(homePlace.symbol);
    this.assignedToHome = true;
    return true;
  }

  /** DestroyNPC (Person.cs:507-511). The Tick law then keeps a
   *  destroyed NPC hidden while it stands in a scene. */
  destroyNPC() { this.isDestroyed = true; }

  setResource(line) {
    super.setResource(line);
    const match = DECL.exec(line);
    if (!match) return;
    this.symbol = new QuestSymbol(match.groups.symbol);

    for (const option of line.matchAll(OPTIONS)) {
      const g = option.groups;
      if (g.individualNPCName != null) this.individualNPCName = g.individualNPCName;
      if (g.faceIndex != null) this.faceIndex = questParseInt(g.faceIndex);
      if (g.factionType != null) this.factionTypeName = g.factionType;
      if (g.factionAlliance != null) this.factionAllianceName = g.factionAlliance;
      if (g.careerAlliance != null) this.careerAllianceName = g.careerAlliance;
      if (g.gender != null) this.genderName = g.gender;
      if (g.locationScope != null) this.locationScopeName = g.locationScope;
      this.atHome = g.atHome != null;   // AUDIT quest-P6: C# assigns UNCONDITIONALLY per option - last one wins, a later option resets it
    }

    // DFU's identification ladder: named > group > factionType > faction,
    // and no match at all throws.
    if (!this.individualNPCName && !this.careerAllianceName && !this.factionTypeName && !this.factionAllianceName) {
      throw new Error(`Person resource could not identify NPC from line ${line}`);
    }

    const world = this.parentQuest?.hooks?.world;
    if (!world) return;   // npcPending stays true - the headless charter

    if (this.individualNPCName) this._setupIndividualNPC(world, this.individualNPCName);
    else if (this.careerAllianceName) this._setupCareerAllianceNPC(world, this.careerAllianceName);
    else if (this.factionTypeName) this._setupFactionTypeNPC(world, this.factionTypeName);
    else this._setupFactionAllianceNPC(world, this.factionAllianceName);

    this._assignRace(world);
    this._assignGender(this.genderName);
    this._assignHUDFace();
    this._assignDisplayName();
    this._assignHomeTown(world, this.locationScopeName);

    this.isIndividualAtHome = this.atHome;
    this.npcPending = false;
  }

  _rolls() { return this.parentQuest?.rolls ?? Math.random; }
  _range(n) { return n > 0 ? Math.floor(this._rolls()() * n) : 0; }

  // ---- the Setup* dispatch (Person.cs:751-870) ----

  /** GetFactionData (Person.cs:848-856): the PERSISTENT store; a miss
   *  throws unless the id is 0 (the zero record). */
  _getFactionData(world, factionID) {
    return getFactionDataOrThrow(world, factionID);
  }

  _setupIndividualNPC(world, individualNPCName) {
    const factionID = getIndividualFactionID(individualNPCName);
    if (factionID !== -1) {
      const factionData = this._getFactionData(world, factionID);
      if (factionData.type !== FACTION_TYPES.Individual && factionData.type !== FACTION_TYPES.Daedra) {
        throw new Error(`Named NPC ${individualNPCName} with FactionID ${factionID} is not an individual NPC or Daedra`);
      }
      this.isIndividualNPC = true;
      this.factionTableKey = individualNPCName;
      this.factionData = factionData;
    } else {
      console.warn(`[quest] SetupIndividualNPC() failed to setup ${individualNPCName}`);
      this.factionData = ZERO_FACTION;
    }
  }

  _setupFactionAllianceNPC(world, factionAllianceName) {
    const factionID = getIndividualFactionID(factionAllianceName);
    if (factionID !== -1) {
      this.factionTableKey = factionAllianceName;
      this.factionData = this._getFactionData(world, factionID);
    } else {
      console.warn(`[quest] SetupFactionAllianceNPC() failed to setup ${factionAllianceName}`);
      this.factionData = ZERO_FACTION;
    }
  }

  _setupCareerAllianceNPC(world, careerAllianceName) {
    if (/^questor$/i.test(careerAllianceName)) {
      if (this._setupQuestorNPC(world)) return;
    }
    const factionID = this._getCareerFactionID(world, careerAllianceName);
    if (factionID !== -1) {
      this.factionTableKey = careerAllianceName;
      this.factionData = this._getFactionData(world, factionID);
    } else {
      console.warn(`[quest] SetupCareerAllianceNPC() failed to setup ${careerAllianceName}`);
      this.factionData = ZERO_FACTION;
    }
  }

  _setupFactionTypeNPC(world, factionTypeName) {
    const factionID = this._getFactionTypeFactionID(world, factionTypeName);
    if (factionID !== -1) {
      this.factionTableKey = factionTypeName;
      this.factionData = this._getFactionData(world, factionID);
    } else {
      console.warn(`[quest] SetupFactionTypeNPC() failed to setup ${factionTypeName}`);
      this.factionData = ZERO_FACTION;
    }
  }

  /** SetupQuestorNPC (Person.cs:829-846): binds to the last NPC the
   *  player clicked; none clicked logs and answers false so the quest
   *  still compiles with a virtual NPC. */
  _setupQuestorNPC(world) {
    const clicked = this.parentQuest.hooks?.lastNPCClicked?.() ?? null;
    if (!clicked) {
      console.warn(`[quest] Quest Person _${this.symbol.name}_ is expecting a Questor NPC, but one has not been clicked. Proceeding with a virtual NPC so quest will compile.`);
      return false;
    }
    this.questorData = clicked;
    this.isQuestor = true;
    this.factionData = this._getFactionData(world, clicked.factionID);
    this.nameSeed = clicked.nameSeed;
    this.npcGender = clicked.gender;
    return true;
  }

  /** GetCareerFactionID (Person.cs:1019-1085): Quests-Factions p2
   *  (p3 when p2 < 0; 10000 folds to 0), then the classic career ->
   *  faction mapping. */
  _getCareerFactionID(world, careerAllianceName) {
    const MAGES_GUILD = 40, NOBLES = 242, GENERIC_TEMPLE = 450, MERCHANTS = 510;
    const table = factionsTable();
    if (!table.hasValue(careerAllianceName)) {
      console.warn(`[quest] Could not find careerAllianceName ${careerAllianceName}`);
      return -1;
    }
    let careerID = questParseInt(table.getValue('p2', careerAllianceName));
    if (careerID < 0) careerID = questParseInt(table.getValue('p3', careerAllianceName));
    if (careerID === 10000) careerID = 0;
    switch (careerID) {
      case 0: case 1: case 2: case 3: case 5: case 6: case 7: case 8:
      case 9: case 10: case 12: case 13: case 15:
        return MERCHANTS;
      case 11: return MAGES_GUILD;
      case 14: return GENERIC_TEMPLE;
      case 16: return NOBLES;
      case 17: case 18: case 19: case 20:
      default:
        // "Not sure if Resident1-4 career really maps to regional
        // people of in classic" - DFU's own note; the default rides it
        return world.currentRegionPeople?.() ?? -1;
    }
  }

  /** GetFactionTypeFactionID (Person.cs:903-1018). */
  _getFactionTypeFactionID(world, factionTypeName) {
    const table = factionsTable();
    if (!table.hasValue(factionTypeName)) {
      console.warn(`[quest] Could not find factionTypeName ${factionTypeName}`);
      return -1;
    }
    let factionType = questParseInt(table.getValue('p3', factionTypeName));
    if (factionType === -1) {
      // C# BUG KEPT (Person.cs:925-928): the array beside this promises
      // Courts/Province/People/Temple, but the code assigns the RAW
      // Range(0,4) INDEX as the type - Daedra/God/Group/Subgroup.
      factionType = this._range(4);
    }
    switch (factionType) {
      case FACTION_TYPES.Daedra:
      case FACTION_TYPES.Group:
      case FACTION_TYPES.Subgroup:
      case FACTION_TYPES.Official:
      case FACTION_TYPES.Temple:
      case FACTION_TYPES.God:
      case FACTION_TYPES.Individual:
      case FACTION_TYPES.WitchesCoven:
        return this._getRandomFactionOfType(world, factionType);
      case FACTION_TYPES.VampireClan:
        // P0/$CUREVAM quests read the PLAYER's clan (the vampirism
        // racial effect); everything else the region's.
        if (this.parentQuest.questName.startsWith('P0') || this.parentQuest.questName.startsWith('$CUREVAM')) {
          return world.playerVampireClan?.() ?? -1;
        }
        return world.currentRegionVampireClan?.() ?? -1;
      case FACTION_TYPES.Province:
        return world.currentRegionFaction?.() ?? -1;
      case FACTION_TYPES.KnightlyGuard:
        return KNIGHTLY_ORDER_IDS[this._range(KNIGHTLY_ORDER_IDS.length)];
      case FACTION_TYPES.MagicUser:
        return 40;
      case FACTION_TYPES.Generic:
        return this._rolls()() < 0.5 ? 450 : 844;
      case FACTION_TYPES.Thieves:
        return 42;
      case FACTION_TYPES.Courts:
        return world.currentRegionCourt?.() ?? -1;
      case FACTION_TYPES.People:
        return world.currentRegionPeople?.() ?? -1;
      default:
        return -1;
    }
  }

  /** GetRandomFactionOfType (Person.cs:1087-1099): the persistent
   *  store's type filter; Temple excludes the Generic Temple 450;
   *  zero matches THROW. */
  _getRandomFactionOfType(world, factionType) {
    let factions = world.findFactionsOfType?.(factionType) ?? [];
    if (factionType === FACTION_TYPES.Temple) factions = factions.filter((f) => f.id !== 450);
    if (!factions.length) throw new Error('GetRandomFactionOfType() found 0 matches.');
    return factions[this._range(factions.length)].id;
  }

  // ---- the Assign* chain (Person.cs:571-663) ----

  /** AssignRace (Person.cs:571-580), verbatim now. GetRaceFromFactionRace
   *  (RaceTemplate.cs:109-133) maps ONLY FactionRaces -1..7; the
   *  oddballs (Skakmat 11, Orc 17, Vampire 18, Fey 19) fall through to
   *  Races.None, and AssignRace folds None to the region's race - so
   *  anything outside 0..7 reads regional (AUDIT VI).
   *
   *  AUDIT 24 (the seven-slice sweep): the fold used to write
   *  currentRegionRace() - a Races - into factionRace, a FactionRaces
   *  field. The two enums are not an offset of each other (Nord is 3
   *  as a Races and 0 as a FactionRaces), so every regionally-folded
   *  Person carried a race that named someone else. The port now holds
   *  C#'s own `race` and derives factionRace from it. */
  _assignRace(world) {
    const raw = this.factionData?.race ?? -1;
    this.race = raceFromFactionRace(raw) ?? (world.currentRegionRace?.() ?? -1);
    this.factionRace = factionRaceFromRace(this.race);
    this.nameBank = getNameBankOfRegion(world.currentRegionIndex());
  }

  _assignGender(genderName) {
    if (this.isQuestor) return;   // questors keep the clicked NPC's gender
    if (genderName === 'female') this.npcGender = GENDERS.Female;
    else if (genderName === 'male') this.npcGender = GENDERS.Male;
    else this.npcGender = this._rolls()() < 0.5 ? GENDERS.Male : GENDERS.Female;
  }

  _assignHUDFace() {
    // QUIRK KEPT (Person.cs:589-591): the parsed face index is IGNORED
    // - the HUD face always rolls Range(0, 10).
    this.faceIndex = this._range(FACE_COUNT);
  }

  _assignDisplayName() {
    // Witches covens and faction 512 are always female
    if (this.factionData?.type === FACTION_TYPES.WitchesCoven || this.factionData?.id === 512) {
      this.npcGender = GENDERS.Female;
    }
    if ((this.factionData?.type === FACTION_TYPES.Individual || this.factionData?.type === FACTION_TYPES.Daedra)
      && this.factionData?.id !== 0) {
      this.displayName = this.factionData.name;
      return;
    }
    // nameSeed -1 draws DateTime.Now.Millisecond in C# - a wall-clock
    // seed; the Ledger A engine-random rule routes it through the
    // quest's injectable roll (0..999, the same surface).
    if (this.nameSeed === -1) this.nameSeed = this._range(1000);
    srand(this.nameSeed);
    this.displayName = fullName(this.nameBank, this.npcGender);
  }

  /** AssignHomeTown (Person.cs:631-663): questors configure from the
   *  player's location; individuals have NO generated home; everyone
   *  else gets a Place declaration built from the faction row's
   *  building type (or house), scoped local/remote by a 50/50 roll
   *  when unstated.
   *  C# DEAD ARM KEPT (AUDIT VI): the condition reads the
   *  isIndividualAtHome FIELD, which SetResource assigns only AFTER
   *  AssignHomeTown returns (Person.cs:275 vs :278) - so the
   *  individual half can never fire during setup and an at-home
   *  individual falls to the IsIndividualNPC return like any other.
   *  Reading the live atHome local here would resurrect the arm. */
  _assignHomeTown(world, scopeString) {
    const HOUSE = 'house';
    const symbolName = `_${this.symbol.name}_home_`;

    if (this.isQuestor || (this.isIndividualNPC && this.isIndividualAtHome)) {
      const homePlace = new Place(this.parentQuest);
      if (world.currentLocation?.()?.loaded) {
        if (!homePlace.configureFromPlayerLocation(world, symbolName)) {
          throw new Error('AssignHomeTown() could not configure questor/individual home from current player location.');
        }
        this.homePlaceSymbol = homePlace.symbol;
        this.parentQuest.addResource(homePlace);
        return;
      }
    }
    if (this.isIndividualNPC) return;

    if (!scopeString) {
      const loc = world.currentLocation?.();
      if (loc?.loaded && (loc.exterior?.buildings?.length ?? 0) > 0) {
        scopeString = this._rolls()() < 0.5 ? 'local' : 'remote';
      } else {
        scopeString = 'remote';
      }
    }

    let buildingTypeString = HOUSE;
    if (this.factionTableKey) {
      const fTable = factionsTable();
      const p1 = questParseInt(fTable.getValue('p1', this.factionTableKey));
      const p2 = questParseInt(fTable.getValue('p2', this.factionTableKey));
      const p3 = questParseInt(fTable.getValue('p3', this.factionTableKey));
      if (p1 === 0 && p2 >= 0 && p2 <= 20 && p3 === 0) {
        buildingTypeString = placesTable().getKeyForValue('p2', String(p2));
      }
    }

    let homePlace;
    try {
      homePlace = new Place(this.parentQuest, `Place ${symbolName} ${scopeString} ${buildingTypeString}`);
    } catch {
      homePlace = new Place(this.parentQuest, `Place ${symbolName} ${scopeString} ${HOUSE}`);
    }
    this.homePlaceSymbol = homePlace.symbol.clone();
    this.parentQuest.addResource(homePlace);
  }

  // ---- the save envelope (Q4-iv; Person.cs:1108-1190) ----

  /** GetSaveData: the C# field set verbatim. The port stores no
   *  separate `race` (nothing downstream reads it - names ride
   *  nameBank) and the talk-arc discovery flag pends its arc; both
   *  serialize at their defaults so the envelope keeps C#'s shape. */
  getSaveData() {
    return {
      race: this.race ?? -1,
      nameBank: this.nameBank,
      npcGender: this.npcGender,
      faceIndex: this.faceIndex,
      nameSeed: this.nameSeed,
      isQuestor: this.isQuestor,
      isIndividualNPC: this.isIndividualNPC,
      isIndividualAtHome: this.isIndividualAtHome,
      displayName: this.displayName,
      homePlaceSymbol: symbolToSaveData(this.homePlaceSymbol),
      lastAssignedPlaceSymbol: symbolToSaveData(this.assignedPlaceSymbol),
      assignedToHome: this.assignedToHome,
      factionID: this.factionData?.id ?? 0,
      factionTableKey: this.factionTableKey,
      questorData: { ...this.questorData },   // the struct always rides, zeros and all
      discoveredThroughTalkManager: this.discoveredThroughTalkManager ?? false,
      isMuted: this.isMuted,
      isDestroyed: this.isDestroyed,
    };
  }

  /** RestoreSaveData: the faction record re-derives from the LIVE
   *  store (C# reads PlayerEntity.FactionData); an unknown non-zero
   *  id throws C#'s deserialize error; id 0 lands the all-zeros
   *  record (default struct = ZERO_FACTION, the Q3-ii law). */
  restoreSaveData(dataIn) {
    if (dataIn == null) return;
    const world = this.parentQuest.hooks?.world;
    const record = world?.getFactionData?.(dataIn.factionID) ?? null;
    if (!record && dataIn.factionID !== 0) {
      throw new Error('Could not deserialize Person resource FactionID to FactionData');
    }
    this.race = dataIn.race;
    this.factionRace = factionRaceFromRace(this.race);   // derived, as at assign
    this.nameBank = dataIn.nameBank;
    this.npcGender = dataIn.npcGender;
    this.faceIndex = dataIn.faceIndex;
    this.nameSeed = dataIn.nameSeed;
    this.isQuestor = dataIn.isQuestor;
    this.isIndividualNPC = dataIn.isIndividualNPC;
    this.isIndividualAtHome = dataIn.isIndividualAtHome;
    this.displayName = dataIn.displayName;
    this.homePlaceSymbol = symbolFromSaveData(dataIn.homePlaceSymbol);
    this.assignedPlaceSymbol = symbolFromSaveData(dataIn.lastAssignedPlaceSymbol);
    this.assignedToHome = dataIn.assignedToHome;
    this.factionData = record ?? ZERO_FACTION;
    this.factionTableKey = dataIn.factionTableKey;
    this.questorData = { ...ZERO_NPC_DATA, ...(dataIn.questorData ?? {}) };   // a struct, never null
    this.discoveredThroughTalkManager = dataIn.discoveredThroughTalkManager;
    this.isMuted = dataIn.isMuted;
    this.isDestroyed = dataIn.isDestroyed;
  }
}

/** GetIndividualFactionID (Person.cs:875-889): Quests-Factions p3. */
export function getIndividualFactionID(individualNPCName) {
  const table = factionsTable();
  if (table.hasValue(individualNPCName)) {
    return questParseInt(table.getValue('p3', individualNPCName));
  }
  console.warn(`[quest] Could not find individualNPCName ${individualNPCName}`);
  return -1;
}
