// STATIC NPC IDENTITY - StaticNPC.cs (MIT, Daggerfall Workshop), the
// data layer under every person standing in a shop, temple, guild hall
// or palace. Until now the port drew those billboards and knew nothing
// about them: no name, no gender, no race, no portrait, so every click
// fell through to "You get no response."
//
// The identity is DERIVED, not stored: classic has no NPC table. A
// person is their POSITION and their FACTION, and everything else -
// which name they answer to, which face the talk window draws - falls
// out of those two through a seeded PRNG. That is why the same
// shopkeeper is the same person every time you walk in, and why they
// differ between one building and the next.

import { srand } from '../formats/dfRandom.js';
import { fullName, getNameBank, getNameBankOfRegion, GENDERS } from './nameHelper.js';
import { RACES } from '../systems/races.js';

/** StaticNPC.Context (:113-118). */
export const NPC_CONTEXT = Object.freeze({ Custom: 0, Dungeon: 1, Building: 2 });

/** StaticNPC.NPCData (:88-107) is a STRUCT, so C# has no null for it -
 *  an unassigned one is the all-zero value, and every field reads its
 *  enum's zero (Genders.Male, Context.Custom, BankTypes.Breton, and
 *  `(Races)0`, which is not even a member).
 *
 *  AUDIT 24 (the seven-slice sweep): the port used `null`, and three
 *  reads dereferenced it without a guard - topicTree's
 *  GetPersonBuildingKey and its quest-topic rebuild, and sceneMount's
 *  questor billboard pick. Every one of them is reachable: the OTHER
 *  route to isQuestor is `add <sym> as questor` (Quest.addQuestor),
 *  which sets the flag and never touches questorData - exactly as
 *  C#'s Quest.cs:472 does, because there the struct is already there.
 *  So a quest that names its own questor crashed the talk topic
 *  rebuild. The zero struct is the value C# actually holds. */
export const ZERO_NPC_DATA = Object.freeze({
  hash: 0,
  flags: 0,
  factionID: 0,
  nameSeed: 0,
  gender: 0,            // Genders.Male
  race: 0,              // (Races)0 - C#'s struct default, no member
  context: NPC_CONTEXT.Custom,
  mapID: 0,
  locationID: 0,
  buildingKey: 0,
  nameBank: 0,          // BankTypes.Breton
  billboardArchiveIndex: 0,
  billboardRecordIndex: 0,
});

/** GetPositionHash, verbatim: `x ^ y << 2 ^ z >> 2`. C# binds << and
 *  >> TIGHTER than ^, and so does JS, so the shape is the same one -
 *  but it is written with the parens here because the reader should
 *  not have to know that to check it. */
export const positionHash = (x, y, z) => (x ^ ((y << 2) ^ (z >> 2)));

/** SetLayoutData (:210-223) - the layout half, verbatim.
 *
 *  THE NAME SEED IS A PRECEDENCE TRAP, kept as written:
 *      data.nameSeed = (int)position ^ buildingKey + locationIndex;
 *  In C# `+` binds tighter than `^`, so this is
 *  `position ^ (buildingKey + locationIndex)` - NOT
 *  `(position ^ buildingKey) + locationIndex`. JS binds them the same
 *  way, so a literal transcription is already correct; the parens are
 *  here so nobody "fixes" it into the other reading, which would give
 *  every NPC in the game a different name.
 *
 *  @param {object} p
 *  @param {number} p.x @param {number} p.y @param {number} p.z  fixed-point layout position
 *  @param {number} p.flags        bit 32 is FEMALE
 *  @param {number} p.factionId
 *  @param {number} p.archive      billboard texture archive
 *  @param {number} p.record       billboard texture record
 *  @param {number} p.position     the record's raw position long
 *  @param {number} p.mapId
 *  @param {number} p.locationIndex
 *  @param {number} [p.buildingKey]
 */
export function staticNpcData({
  x, y, z, flags = 0, factionId = 0, archive = 0, record = 0,
  position = 0, mapId = 0, locationIndex = 0, buildingKey = 0,
}) {
  return {
    hash: positionHash(x, y, z),
    flags,
    factionID: factionId,
    billboardArchiveIndex: archive,
    billboardRecordIndex: record,
    nameSeed: position ^ (buildingKey + locationIndex),
    gender: (flags & 32) === 32 ? 'female' : 'male',
    race: null,           // GetRaceFromFaction needs the faction table - see raceFromFaction
    buildingKey,
    mapID: mapId,
  };
}

/** GetRaceFromFaction (:357-369), verbatim: a NAMED faction lends its
 *  race, and anything else - faction 0, or a faction whose race maps
 *  to None - takes the race of the REGION the player is standing in.
 *  So an unfactioned villager is a local, which is what classic looks
 *  like.
 *
 *  @param {number} factionId
 *  @param {function(number):object|null} getFaction  the FACTION.TXT lookup
 *  @param {function():number} raceOfCurrentRegion    PlayerGPS's fallback
 */
export function raceFromFaction(factionId, getFaction, raceOfCurrentRegion) {
  if (factionId !== 0) {
    // AUDIT 24 (the seven-slice sweep): C# IGNORES GetFactionData's
    // bool (:362) and reads the `out` struct regardless - and a MISS
    // leaves that struct at its default, whose `race` field is 0,
    // which GetRaceFromFactionRace maps to FactionRaces.Nord. So an
    // unresolvable faction id answers NORD in DFU, not the region's
    // race: only a faction whose race really maps to None falls
    // through. The port read `fd?.race` as undefined on a miss and
    // sent it to the region, so an id the table does not hold produced
    // a local instead of a Nord.
    const fd = getFaction?.(factionId) ?? null;
    const race = raceFromFactionRace(fd?.race ?? 0);
    if (race !== null) return race;
  }
  return raceOfCurrentRegion();
}

/** RaceTemplate.GetRaceFromFactionRace (:109-133) over FACTION.TXT's
 *  OWN race enum (FactionFile.cs:609-623), which is a DIFFERENT
 *  numbering from the Races enum and not merely an offset of it:
 *      FactionRaces  None -1, Nord 0, Khajiit 1, Redguard 2, Breton 3,
 *                    Argonian 4, WoodElf 5, HighElf 6, DarkElf 7
 *      Races         Breton 1, Redguard 2, Nord 3, DarkElf 4, ...
 *  so the two orders disagree as well as the bases. Written out case
 *  by case against the source rather than computed, because the first
 *  draft of this function DID compute it - as "the same order, one
 *  lower" - and every NPC in the game would have taken the wrong race
 *  with the suite green.
 *
 *  FACTION.TXT also carries four values with no Races counterpart
 *  (Skakmat 11, Orc 17, Vampire 18, Fey 19); DFU's switch has no case
 *  for them, so they fall out as None like -1 does and send
 *  GetRaceFromFaction to its region fallback. */
/** RaceTemplate.GetFactionRaceFromRace (:142-167), the INVERSE of the
 *  map below - Races back to FACTION.TXT's own race numbering. Written
 *  out case by case for the same reason: the two orders disagree, and
 *  computing it would be wrong in a way a green suite would not catch.
 *  Races with no FactionRaces counterpart (Vampire 9, Werewolf 10,
 *  Wereboar 11) have no case in C#'s switch either and fall out None. */
export function factionRaceFromRace(race) {
  switch (race) {
    case RACES.Nord: return 0;
    case RACES.Khajiit: return 1;
    case RACES.Redguard: return 2;
    case RACES.Breton: return 3;
    case RACES.Argonian: return 4;
    case RACES.WoodElf: return 5;
    case RACES.HighElf: return 6;
    case RACES.DarkElf: return 7;
    default: return -1;   // FactionRaces.None
  }
}

export function raceFromFactionRace(factionRace) {
  switch (factionRace) {
    case 0: return RACES.Nord;
    case 1: return RACES.Khajiit;
    case 2: return RACES.Redguard;
    case 3: return RACES.Breton;
    case 4: return RACES.Argonian;
    case 5: return RACES.WoodElf;
    case 6: return RACES.HighElf;
    case 7: return RACES.DarkElf;
    default: return null;   // None (-1), Skakmat, Orc, Vampire, Fey
  }
}

/** GetDisplayName (:315-328), verbatim: an INDIVIDUAL faction answers
 *  its own name - that is how a named lord is always that lord - and
 *  everybody else is generated from their name seed, which makes them
 *  stable for that position without anything being stored.
 *
 *  @param {object} data      staticNpcData's result
 *  @param {object} [deps]
 *  @param {function(number):object|null} [deps.getFaction]
 *  @param {number} [deps.nameBank]  BankTypes; defaults from the race
 */
export function staticNpcName(data, { getFaction = null, nameBank = null } = {}) {
  const fd = getFaction?.(data.factionID) ?? null;
  // FactionFile.FactionTypes.Individual is 3.
  if (fd && fd.type === FACTION_TYPE_INDIVIDUAL) return fd.name;
  srand(data.nameSeed);
  const bank = nameBank ?? bankForRace(data.race);
  return fullName(bank, data.gender === 'female' ? GENDERS.Female : GENDERS.Male);
}

export const FACTION_TYPE_INDIVIDUAL = 3;

/** The name bank a race draws from; a race the bank table does not
 *  know falls to Breton exactly as getNameBank does. */
export const bankForRace = (race) => getNameBank(raceKeyOf(race));

/** The port's RACES enum is 1-based (Breton = 1); the bank table is
 *  keyed by the race's NAME. */
function raceKeyOf(race) {
  for (const [key, value] of Object.entries(RACES)) if (value === race) return key;
  return 'Breton';
}

export { getNameBankOfRegion };
