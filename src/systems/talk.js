// T3a talk foundation (DFU TalkManager / PersistentFactionData /
// PlayerGPS, MIT Daggerfall Workshop) - the reaction layer under the
// talk window (T3b) and pickpocketing.
//
// - findFactions: PersistentFactionData.FindFactions verbatim (-1
//   wildcards; region compares against the parser's 0-based value).
// - getPeopleOfCurrentRegion: PlayerGPS verbatim - the single
//   People/Commoners/GeneralPopulace faction of the region; every
//   mobile townsperson talks as that faction.
// - getReactionToPlayer: TalkManager verbatim - faction rep +
//   biography reaction mod + live effect reaction mod (sgroup) +
//   the player's social-group reputation (sgroup).
//
// The player's faction state: classic clones FACTION.TXT into the
// save and mutates rep in place, and both halves are here now. The
// rep deltas landed with S25's systems/factionRep.js (changeReputation
// :116, propagateReputationChange :165) and are driven by court.js
// :181, quest/quest.js:300's QuestSuccessRep/FailureRep, quest/
// actions.js:2058 and guildServiceActions.js:181. The save arc carries
// them: save.js:363 snapshotFactionRep writes and :379
// restoreFactionRep reads back INTO the store the loader rebuilt from
// FACTION.TXT (the AUDIT 20 note at save.js:526). The live FactionFile
// dict is still the working state - what round-trips is the mutable
// columns, a recorded departure from FactionData_v2's whole-dictionary
// write.

import { SOCIAL_GROUP_COUNT, FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS } from '../formats/factionFile.js';
import { racialSuppressCrime } from './lycanthropy.js';   // V4: SuppressCrime's inline gate (court.js imports this module)
import { tallyCrimeGuildRequirements } from './crimeGuilds.js';   // CG2: a leaf, so this module can reach it
import { calculatePickpocketingChance, dice100 } from '../combat/formulas.js';
import { skillValue, tallySkill, SKILLS } from './skills.js';
import { addGoldPieces } from './inventory.js';   // E4: the pinched purse lands in the counter
import { longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';   // wave 26: the compass law

// PlayerActivate constants. AUDIT 24 (wave 23): these were a SECOND
// declaration of PlayerActivate.cs:76-88, written out as bare
// `256 * 0.025` literals next to the set in player/activate.js - and
// wave 22 of this audit added DEFAULT_ACTIVATION_DISTANCE to the copy
// rather than to the original, which is how a duplicate set gets built
// one honest commit at a time. Re-exported from the one home now.
export {
  RAY_DISTANCE,
  DEFAULT_ACTIVATION_DISTANCE,
  STATIC_NPC_ACTIVATION_DISTANCE,
  MOBILE_NPC_ACTIVATION_DISTANCE,
  PICKPOCKET_DISTANCE,
} from '../player/activate.js';
import { MOBILE_NPC_ACTIVATION_DISTANCE, PICKPOCKET_DISTANCE } from '../player/activate.js';
export const FOUND_NOTHING_VALUABLE_TEXT_ID = 8999;

/** The eight compass words (Internal_Strings_en 383-390) and the
 *  never-mind (425), the strings DirectionVector2DirectionHintString
 *  answers with. */
export const DIRECTION_HINTS = Object.freeze({
  east: 'east', northeast: 'northeast', north: 'north', northwest: 'northwest',
  west: 'west', southwest: 'southwest', south: 'south', southeast: 'southeast',
  resolvingError: '...never mind...',
  thisPlace: 'this place',
});

/** DirectionVector2DirectionHintString (TalkManager.cs:1163-1187),
 *  verbatim. Eight 45-degree bands off EAST, measured
 *  counter-clockwise.
 *
 *  Acos returns 0..180, so C# recovers the lower half-plane with
 *  `if (y < 0) angle = 180 + (180 - angle)` rather than with atan2 -
 *  the same number by a longer road, kept as written.
 *
 *  TWO C# EDGES KEPT. A ZERO vector divides by a zero magnitude:
 *  0/0 is NaN, every band comparison against NaN is false, and the
 *  chain falls to its `else` - so "the target is exactly where you
 *  are" answers `...never mind...`, not a direction. And the bands are
 *  half-open upwards (`>= 22.5 && < 67.5`), with east taking BOTH ends
 *  (`>= 337.5 && <= 360`), so 337.5 is east and 22.5 is northeast.
 *
 *  @param {number} x  target.x - player.x
 *  @param {number} y  target.y - player.y (already y-inverted by the
 *                     caller where C# inverts it)
 */
export function directionHintString(x, y) {
  const magnitude = Math.sqrt(x * x + y * y);
  // Vector2.Dot(v, Vector2.right) is v.x
  let angle = (Math.acos(x / magnitude) / Math.PI) * 180.0;
  if (y < 0) angle = 180.0 + (180.0 - angle);
  if ((angle >= 0.0 && angle < 22.5) || (angle >= 337.5 && angle <= 360.0)) return DIRECTION_HINTS.east;
  if (angle >= 22.5 && angle < 67.5) return DIRECTION_HINTS.northeast;
  if (angle >= 67.5 && angle < 112.5) return DIRECTION_HINTS.north;
  if (angle >= 112.5 && angle < 157.5) return DIRECTION_HINTS.northwest;
  if (angle >= 157.5 && angle < 202.5) return DIRECTION_HINTS.west;
  if (angle >= 202.5 && angle < 247.5) return DIRECTION_HINTS.southwest;
  if (angle >= 247.5 && angle < 292.5) return DIRECTION_HINTS.south;
  if (angle >= 292.5 && angle < 337.5) return DIRECTION_HINTS.southeast;
  return DIRECTION_HINTS.resolvingError;
}

/** GetBuildingCompassDirection (TalkManager.cs:1203-1236): which way a
 *  named building of the CURRENT location lies.
 *
 *  DFU compares two points in one frame and asks
 *  DirectionVector2DirectionHintString for the word. Outside, the
 *  player's transform is mapped into the exterior automap's layout
 *  space (Nystul's own note says he reused the automap's mapping "so
 *  both building position as well as player position are calculated in
 *  map coordinates and compared"); inside, the player IS the current
 *  building's position, and the building you are standing in answers
 *  "this place" before any angle is taken.
 *
 *  THE PORT'S FRAME. The map transform is a translate+scale of the
 *  location's own plane, so the pair only has to share ONE frame for
 *  the angle to be the DFU one: this takes both in the LOCATION frame
 *  the building directory is already built in (positions relative to
 *  locOrigin), which is the same pair GetAnswerWhereIs' compass has
 *  used since T3c. `position` is the port's 3-vector, so north is z.
 *
 *  TWO C# SHAPES KEPT. `listBuildings.Find` returns the DEFAULT STRUCT
 *  when nothing matches - buildingKey 0 at position (0,0) - so an
 *  unknown key measures from the location origin rather than refusing,
 *  and inside an unknown building that meets an unknown target the
 *  key test answers "this place". The one JS-shaped guard is a caller
 *  with NO location frame at all (the wilderness, where DFU always has
 *  a transform): that answers the resolving error.
 *
 *  @param {object} deps
 *  @param {Array} deps.listBuildings  the location's building directory
 *  @param {number[]|null} deps.playerPos  location-frame [x, y, z]
 *  @param {boolean} deps.isPlayerInside
 *  @param {number} deps.currentBuildingKey  the building being stood in
 */
export function buildingCompassDirection({
  listBuildings = [], playerPos = null, isPlayerInside = false, currentBuildingKey = 0,
} = {}, buildingKey) {
  const ZERO = { buildingKey: 0, position: [0, 0, 0] };
  const list = listBuildings ?? [];
  const target = list.find((b) => b.buildingKey === buildingKey) ?? ZERO;
  let px;
  let pz;
  if (!isPlayerInside) {
    if (!playerPos) return DIRECTION_HINTS.resolvingError;
    px = playerPos[0];
    pz = playerPos[2];
  } else {
    const current = list.find((b) => b.buildingKey === currentBuildingKey) ?? ZERO;
    px = current.position?.[0] ?? 0;
    pz = current.position?.[2] ?? 0;
    if ((current.buildingKey ?? 0) === (target.buildingKey ?? 0)) return DIRECTION_HINTS.thisPlace;
  }
  const tp = target.position ?? ZERO.position;
  return directionHintString(tp[0] - px, tp[2] - pz);
}

/** GetLocationCompassDirection (TalkManager.cs:1238-1281): which way
 *  the quest's remote Place lies, in MAP PIXELS.
 *
 *  The region is the POLITIC index at the player's own pixel (minus
 *  128, and out-of-range reads -1), and the location is found by
 *  case-insensitive NAME within that region's map names.
 *
 *  THREE C# SHAPES KEPT. The row is looked up BY NAME, not by the loop
 *  index:
 *
 *      int index = currentDFRegion.MapNameLookup[locations[i]];
 *      locationInfo = currentDFRegion.MapTable[index];
 *
 *  and MapNameLookup is built FIRST-WINS (`if (!ContainsKey(name))
 *  Add(name, i)`, MapsFile.cs:1082-1083). So although the loop does not
 *  break, every iteration for a duplicated name resolves the SAME first
 *  row - the repeats are wasted work, not a last-wins rule. (Wave 26
 *  shipped `mapTable[i]` here, which really is last-wins, and pinned
 *  that as the law; the wave-26 scout caught it. Two names differing
 *  only in CASE still take the last, because the ToLower compare
 *  matches both while the dictionary keys stay exact-case - so the
 *  lookup is per-iteration, not hoisted.)
 *
 *  The "did we find it" test is `positionLocation != Vector2.zero`, so
 *  a location whose map pixel really is (0,0) reads as not-found; and
 *  the y axis is INVERTED before the hint, because map pixels grow
 *  southwards while the hint's bands are drawn on a normal y-up plane.
 *
 *  @param {object} deps
 *  @param {function():{x:number,y:number}} deps.playerMapPixel
 *  @param {object} deps.maps  the MapsFile reader
 *  @param {string} locationName
 */
export function locationCompassDirection({ playerMapPixel, maps }, locationName) {
  const player = playerMapPixel?.() ?? { x: 0, y: 0 };
  let region = (maps?.getPoliticIndex?.(player.x, player.y) ?? 0) - 128;
  if (region < 0 || region >= (maps?.regionCount ?? 0)) region = -1;
  const dfRegion = maps?.getRegion?.(region) ?? null;
  const names = dfRegion?.mapNames ?? [];
  const wanted = String(locationName ?? '').toLowerCase();
  const lookup = dfRegion?.mapNameLookup ?? null;
  let loc = { x: 0, y: 0 };
  for (let i = 0; i < names.length; i++) {
    if (String(names[i]).toLowerCase() !== wanted) continue;
    // `if (MapNameLookup.ContainsKey(locations[i]))` - a name the
    // dictionary does not hold is skipped, not defaulted
    if (!lookup?.has(names[i])) continue;
    const row = dfRegion.mapTable?.[lookup.get(names[i])];
    if (!row) continue;
    loc = longitudeLatitudeToMapPixel(Math.trunc(row.longitude), Math.trunc(row.latitude));
  }
  if (loc.x === 0 && loc.y === 0) return DIRECTION_HINTS.resolvingError;
  // `vecDirectionToTarget.y = -vecDirectionToTarget.y`
  return directionHintString(loc.x - player.x, -(loc.y - player.y));
}

/** FindFactionByTypeAndRegion (PersistentFactionData.cs:236-265).
 *
 *  An EXACT type+region match returns IMMEDIATELY, so the first one in
 *  dictionary order wins. Otherwise the loop keeps overwriting a
 *  partial match on `region == -1`, so the LAST region-less faction of
 *  that type is the fallback - not the first. A total miss answers the
 *  zero struct with `false`; the port answers null and lets the
 *  callers (%rt, %nrn) take their own zero-struct fallbacks, which is
 *  what C#'s bool-discarding callers do with it.
 */
export function findFactionByTypeAndRegion(factionDict, type, regionIndex) {
  let partial = null;
  for (const item of factionDict.values()) {
    if (type === item.type && regionIndex === item.region) return item;
    if (type === item.type && item.region === -1) partial = item;
  }
  return partial;
}

/** PersistentFactionData.FindFactions, verbatim (-1 = any). */
export function findFactions(factionDict, { type = -1, socialGroup = -1, guildGroup = -1, region = -1 } = {}) {
  const out = [];
  for (const item of factionDict.values()) {
    if (type !== -1 && type !== item.type) continue;
    if (socialGroup !== -1 && socialGroup !== item.sgroup) continue;
    if (guildGroup !== -1 && guildGroup !== item.ggroup) continue;
    if (region !== -1 && region !== item.region) continue;
    out.push(item);
  }
  return out;
}

/** PlayerGPS.GetPeopleOfCurrentRegion, verbatim: the region's single
 *  People faction (type 15, Commoners, GeneralPopulace). */
export function getPeopleOfCurrentRegion(factionDict, regionIndex) {
  const factions = findFactions(factionDict, {
    type: FACTION_TYPES.People,
    socialGroup: SOCIAL_GROUPS.Commoners,
    guildGroup: GUILD_GROUPS.GeneralPopulace,
    region: regionIndex,
  });
  if (factions.length !== 1) return null;   // DFU throws; the caller decides
  return factions[0];
}

/** CQ1 - PlayerGPS.GetCourtOfCurrentRegion (PlayerGPS.cs:469-483),
 *  verbatim: the region's single noble COURT (type 14, guild group
 *  Region, social group ANY - DFU passes -1 there, unlike the People
 *  lookup above, which pins Commoners).
 *
 *  Same refusal convention as its sibling: DFU throws "did not find
 *  exactly 1 match" and the port answers null, because a host that
 *  cannot name a court should show no court rather than take down the
 *  frame. The two consumers - TalkManager's "tell me about" resolution
 *  (:893, :903) and quest Person's court binding (Person.cs:1010) -
 *  both already have a no-faction path.
 *
 *  world.js hardcoded `courtOfCurrentRegion: () => 0` before this,
 *  which is not merely absent: 0 is a REAL faction id, so a palace
 *  interior and the three generic Random_* factions resolved to
 *  whatever faction 0 happens to be rather than to nothing. */
export function getCourtOfCurrentRegion(factionDict, regionIndex) {
  const factions = findFactions(factionDict, {
    type: FACTION_TYPES.Courts,
    guildGroup: GUILD_GROUPS.Region,
    region: regionIndex,
  });
  if (factions.length !== 1) return null;   // DFU throws; the caller decides
  return factions[0];
}

/** Ensure the entity carries the reaction-state fields (all zero at
 *  chargen; classic starts every social-group rep at 0). */
export function ensureReactionState(entity) {
  if (!entity.sGroupReputations) entity.sGroupReputations = new Array(SOCIAL_GROUP_COUNT).fill(0);
  if (!entity.reactionMods) entity.reactionMods = new Array(SOCIAL_GROUP_COUNT).fill(0);
  if (entity.biographyReactionMod === undefined) entity.biographyReactionMod = 0;
  return entity;
}

/** TalkManager.GetReactionToPlayer, verbatim. */
export function getReactionToPlayer(faction, player) {
  ensureReactionState(player);
  let reaction = faction.rep + player.biographyReactionMod;
  const sgroup = faction.sgroup;
  if (sgroup >= 0 && sgroup < player.reactionMods.length) reaction += player.reactionMods[sgroup];
  if (sgroup >= 0 && sgroup < player.sGroupReputations.length) reaction += player.sGroupReputations[sgroup];
  return reaction;
}

/** PlayerActivate.Pickpocket on a TOWNSPERSON, verbatim: tally the
 *  skill, roll the chance, 67% of successes pinch 1-6 gold (the
 *  Currency stack), 33% find nothing valuable (random text 8999);
 *  failure sets CrimeCommitted = Pickpocketing AND spawns the watch -
 *  G1 shipped that half, townTalk.js:512's `if (!r.success) onCrime?.()`
 *  into the single SpawnCityGuards entry (world.js:1683 _spawnGuards,
 *  exterior.js the same seam), which is PlayerActivate.cs:1656-1658's
 *  two lines in order. Enemy pickpocketing (PlayerActivate.cs:830-838)
 *  has no host arm yet: formulas.js's CalculatePickpocketingChance
 *  already takes targetLevel, so it is one call away from whatever
 *  gives the enemy activate ladder a steal mode.
 *  Returns { success, gold, message, modal } for the scene's UI
 *  routing. ROAD-D D10 added `modal`, and it is DFU's own split, not
 *  a convenience: BOTH success arms raise a real parchment
 *  (`DaggerfallUI.MessageBox(gotGold)` :1630 and
 *  `DaggerfallUI.MessageBox(noGoldFound, true)` :1645) while the
 *  FAILURE is a HUD line (`DaggerfallUI.Instance.PopupMessage(
 *  notSuccessfulMessage)` :1650) - the one arm that has to stay out
 *  of the way, because the guards are spawning behind it.
 *  rolls: Math.random-compatible (Random.Range + Dice100). */
export function pickpocketTownsperson(player, { rolls = Math.random, nothingText = () => 'You found nothing valuable.' } = {}) {
  tallySkill(player, SKILLS.Pickpocket, 1);
  const chance = calculatePickpocketingChance(skillValue(player, SKILLS.Pickpocket), player.level, null);
  if (dice100(chance, rolls())) {
    if (!dice100(33, rolls())) {   // Dice100.FailedRoll(33)
      const gold = Math.floor(rolls() * 6) + 1;   // Random.Range(0,6) + 1
      addGoldPieces(player, gold);   // E4: `player.GoldPieces += pinchedGoldPieces` (:1628)
      // CG2: PlayerActivate.cs:1641's TallyCrimeGuildRequirements(true,
      // 1) - the pinched purse counts toward the Thieves Guild's ten.
      // Only the arm that actually TOOK something tallies: the 33%
      // "nothing to steal" arm below is a successful pickpocket that
      // stole nothing, and DFU's call sits inside the gold branch.
      tallyCrimeGuildRequirements(player, true, 1);
      return { success: true, gold, modal: true, message: gold === 1 ? 'You pinched 1 gold piece.' : `You pinched ${gold} gold pieces.` };
    }
    return { success: true, gold: 0, modal: true, message: nothingText() };
  }
  // PlayerEntity.Crimes, verbatim state. V4: the SuppressCrime gate
  // rides inline here - court.js imports THIS module, so the one
  // setter cannot be (a transformed werewolf cannot reach this window
  // anyway; the talk door refuses first).
  if (!racialSuppressCrime(player)) player.crimeCommitted = 'Pickpocketing';
  return { success: false, gold: 0, modal: false, message: 'You are not successful.' };
}

// ── TN1: THE LORD'S NAME (MacroHelper.cs:310-331, verbatim) ──────
// GetLordNameForFaction feeds %fl1/%fl2 (the news pair's lords) and
// %ol1 (the OLD ruler, oldRuler=true). The law: if the faction's
// FIRST child is an Individual, she/he IS the ruler and answers by
// name; otherwise the ruler is GENERATED - gender from the ruler
// title's parity ("even entries are female titles/genders, odd
// entries are male ones": (ruler+1)%2, and nameHelper's GENDERS is
// Male 0 / Female 1, so the arithmetic lands as written), the name
// bank from the faction's RACE byte, and the DFRandom stream SEEDED
// from rulerNameSeed - the high half for the old ruler, the low half
// for the current one, "matched to classic: used to retain the same
// old and new ruler name for each region". The seeding is the
// ENGINE-PRNG rule's DFRandom arm: srand into the one shared classic
// stream, exactly as DFRandom.Seed is a static set in C#.

import { GENDERS, getNameBank, fullName } from '../characters/nameHelper.js';
import { srand } from '../formats/dfRandom.js';

/** FactionFile.FactionRaces (FactionFile.cs:609-622) -> the port's
 *  race keys (nameHelper's BANK_BY_RACE vocabulary). Skakmat (11) and
 *  Orc (17) fall through like None: GetRaceFromFactionRace answers
 *  Races.None and GetNameBank's default arm answers Breton. */
export const FACTION_RACE_KEYS = Object.freeze({
  0: 'Nord', 1: 'Khajiit', 2: 'Redguard', 3: 'Breton',
  4: 'Argonian', 5: 'WoodElf', 6: 'HighElf', 7: 'DarkElf',
});

/**
 * @param {Map<number, object>} factionDict - the live FactionFile dict
 * @param {number} factionId
 * @param {boolean} [oldRuler]
 */
export function lordNameForFaction(factionDict, factionId, oldRuler = false) {
  const fd = factionDict?.get(factionId);
  // C# GetFactionData's out-param defaults on a miss: no children, ruler
  // 0, race 0, seed 0 - the generate arm runs over zeros, verbatim.
  const children = fd?.children ?? null;
  if (children && children.length > 0) {
    const firstChild = factionDict.get(children[0]);
    if (firstChild?.type === FACTION_TYPES.Individual) return firstChild.name;
  }
  const gender = ((fd?.ruler ?? 0) + 1) % 2 === 1 ? GENDERS.Female : GENDERS.Male;
  const raceKey = FACTION_RACE_KEYS[fd?.race ?? 0] ?? null;
  const seed = fd?.rulerNameSeed ?? 0;
  srand(oldRuler ? seed >>> 16 : seed & 0xffff);
  return fullName(getNameBank(raceKey), gender);
}
