// RAID1 (2026-09-27, Mac: "World event mod was specially built for us", and, asked whether to port it offline with
// its bugs fixed, "Yes") - WORLD EVENTS - RAIDING PARTIES 1.1 (Kamer): "Selects Random Cities/Hamlets/Towns for Raids
// from enemies." The mod's one script, TownRaids, ported off its IL
// (vendor/world-events-raiding-parties/il/World_Events_Raiding_Parties.il.txt, tools/ilDump.py's offsets):
//
//   SelectRaids [IL_0bd4]   at a day's first frame: the travel map's regions (TRAV0I01.IMG - a pixel is 128 + its
//     region [IL_04b5]) that hold a city, hamlet or village, in index order, each with its towns in MapTable order;
//     then 23 raids [IL_0dc5] - a region evenly [IL_0cda], a town in it evenly and struck off the list [IL_0cfd], a
//     start 0-1320 minutes into the day [IL_0d3b], a party - knights, bandits or orcs [IL_0d8c] - two hours long
//     [IL_0da1], and 15-25 raider deaths to drive it off [IL_0dae].
//   Update [IL_0428]        the day's roll; the raids that ran out ("withdrawn", to a player in the region); each of
//     the region's raids announced once; and, outdoors in a raided town, one foe in flight at a time - a defender
//     every 1-10 s while fewer than 8 stand [IL_06fa], a raider every 1-10 s (orcs 1-8) while fewer than 25
//     [IL_0730], placed 10-35 units off, just outside the view [IL_07f0].
//   ChooseEnemy [IL_137c]   knights: Knight; bandits: Rogue 50, Thief 30, Burglar 20; orcs: Orc 70, Sergeant 25,
//     Warlord 5 (a fresh Random.Range(0, 100) each).
//   OnEnemyDeath [IL_0fec]  any raider's death counts, once; at the target the town is cleansed, its raiders and
//     defenders go, a player on the town's map pixel [IL_11c8] earns GrantReputation [IL_1240] - +5 legal reputation
//     in the region, +5 with its People, +3 with a knightly order of the region, +3 with the Fighters Guild - and the
//     town "has been cleansed", wherever the player is.
//
// THE MOD'S BUGS, AND WHAT EACH IS HERE (Mac: port it with them fixed; Port-Ledger A carries them as departures):
//   1. THE DAY'S RAIDS ARE THE DAY'S. The roll draws from the day's own generator (worldTick.js dayRng,
//      DAY_SALT.raids), where the mod's UnityEngine.Random re-rolled a day's towns at every reload. The same day rolls
//      the same towns for every player, which is what the online arm (RAID2) stands on. The spawn clocks and the
//      raiders' species stay THE ENGINE-PRNG RULE's (Port-Ledger A): an injectable roll, Math.random by default.
//   2. "WITHDRAWN" ONLY OF A RAID THE PLAYER WAS TOLD OF. The mod's first frame of a day expired every raid whose
//      hours had passed and said so of each in the player's region - a new game at 13:30 heard of half a day's raids
//      at once.
//   3. A RAID IS ANNOUNCED ONCE, REMEMBERED IN THE SAVE. The mod forgot at every load and said it again.
//   4. THE DEFENDERS ARE THE TOWN'S WATCH (scenes/cityGuards.js, DISC19-F's allied watchmen, sent at the raiders).
//      The mod's were Knights re-skinned every three seconds: no crime to kill, a Knight's loot to farm, and a
//      Knight's sprite and bow for three seconds after every load.
//   5. THE REWARD GOES TO A PLAYER WHO FOUGHT: a blow of theirs on one of the raid's raiders (the Renown tracker's own
//      stamp, net/renownTracker.js renownStruckAt), besides the mod's map pixel. Any death still counts toward the
//      cleanse - the town's watch fights for it - but the mod paid a player standing on the pixel, indoors, while the
//      watch did the work.
//   6. WHAT IS LEFT OF A RAID STANDS DOWN OUT OF SIGHT. The mod destroyed every raider at the cleanse, at the timeout
//      and at midnight - mid-swing, in view. Here the raiders of an ended raid are taken the first sweep they are out
//      of sight (and fight on while seen, counting nothing); the defenders stand down by the watch's own law.
//   7. THE SPAWN CLOCKS HOLD WITH THE GAME. They ran on Time.realtimeSinceStartup, through a pause, and raiders
//      piled up to the caps behind an open menu; here they run on the frame's time, which a pause holds.
//   8. NOTHING IS ANNOUNCED OR WITHDRAWN AT SEA. PlayerGPS reads the sea's politic 64 as region 31 and anything
//      unmapped as 0, so a sailor heard of raids in two provinces he was not in.
//   9. A RAID THAT ENDS ON THE DAY'S LAST MINUTE GETS ITS "WITHDRAWN". A raid rolled at 22:00 ends at the next day's
//      00:00, and the mod's day roll threw it away before its expiry pass could see it; here the old day's raids
//      are expired first.
//  10. A SPOT NOT FOUND COSTS NOTHING. The mod's spawner looked for a place for eight seconds and then held BOTH
//      clocks ten more - a cramped street starved the raid. The placement here is whole in one call
//      (hostEnchant.js standLooseFoe, its twelve tries), and a miss waits for the clock's own next tick; the eight
//      seconds and the ten stay for a spawn that never lands.
//  11. "The orc attack", where the mod wrote "the orcs attack".
//
// Mac's "4" (2026-09-27): a region is raided about once every four real hours. DFU's clock runs a game day in two
// (WorldTime.TimeScale 12), so a day rolls half a raid for each region the roll can pick - the mod's own 23 a day is
// 3.8 real hours at 44 such regions. RAID_REGION_REAL_HOURS is the one constant.
//
// RAID2, ONLINE (world/raidShared.js): the day's roll is already the shared day's, so every client names the same
// raids. ONE player in a raided town runs it - the first to claim it keeps it, WOD7's law - and stands its raiders and
// its defenders as its own foes; every other player there stands them as puppets and fights them through the owner.
// A raid's deaths are every owner's summed: each owner counts its own raiders' deaths and says so in its frame's word
// (`rk`), and a raid is cleansed where the sum reaches its target - so a runner who stands down (walks out, loses a
// race) keeps its share and the next counts on from it. A player who struck one of a raid's raiders - its own or a
// puppet - fought it, and the reward is RAID1's, on the town's pixel.
//
// RAID3, THE RELAY HOLDS THE RAID (net/raidLaw.js, Mac's "1. Server"): where the relay speaks raids, every player
// standing in a raided town says its word to the town's cell (its own raiders' deaths, its strike) and the cell keeps
// the raid's ledger - the count, kept when everyone leaves; the cleanse, stamped once; a signed receipt to each player
// who earned it (net/raidReceipt.js). The count and the cleanse are then the relay's alone: no sum of words here
// cleanses a town, and the hub's word closes a raid on every machine in the Bay (a cleanse said in its region, never
// a withdrawal). RAID2's words still elect the runner; offline, and at a relay before it, nothing here changes.
//
// The state is the mod's own save record (RaidSaveData: lastSelectedDay and the day's raids), riding DFU's per-mod
// slot (systems/modSaveData.js). The world host (scenes/world.js) is the one host with the Bay's towns, its GPS and
// the town watch, so it is the one that answers the seams below.

import { modSetting } from './modSettings.js';
import { registerModSaveData } from './modSaveData.js';
import { hudText } from './notify.js';
import { sharedClockOn, worldMinutes } from './worldTick.js';
import { MINUTES_PER_DAY } from './gameDate.js';
import { LOCATION_TYPES, longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { FACTION_TYPES, GUILD_GROUPS } from '../formats/factionFile.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { findFactionByTypeAndRegion } from './talk.js';
import { changeReputation } from './factionRep.js';
import { legalRepOf, changeLegalRep, LEGAL_REP_MIN, LEGAL_REP_MAX } from './court.js';
import { ORDERS } from './guildVariants.js';
import { GUILDS } from './guilds.js';
import { renownStruckAt } from '../net/renownTracker.js';
import { raidRunnerOf, validRaidWords, RAID_WORD_STALE_MS, RAID_WORDS_MAX } from '../world/raidShared.js';   // RAID2: the online arm's law, shared with the foes pool
import { RAID_WORD_MS, RAID_WORD_KILLS_MAX, raidSig, rollRaidTowns, raidDayRandom, raidsPerDay, raidTownsCanon, raidTownsHash } from '../net/raidLaw.js';   // RAID3: the relay's ledger's law; RAID-ROLL: the day's roll, the relay's too
import { readRaidReceipt } from '../net/raidReceipt.js';
import { worldRoom, isCellRoom } from '../net/wire.js';
import { isWildRegion } from './wildZone.js';   // PVPDUNGEONS: no world event in the open zone

export const RAIDING_PARTIES_VENDOR = 'world-events-raiding-parties';
export const raidingPartiesOn = () => modSetting(RAIDING_PARTIES_VENDOR, 'Enabled') === true;

// ---- the mod's numbers ------------------------------------------------------
/** `endMinute = startMinute + 120` [IL_0da1]. */
export const RAID_DURATION_MINUTES = 120;
/** `Random.Range(0, 1321)` [IL_0d3b]: a raid starts 00:00 to 22:00. */
export const RAID_START_SPAN = 1321;
/** `for (l < 23)` [IL_0dc5] - the mod's count, kept for the record; the pace is RAID_REGION_REAL_HOURS's. */
export const MOD_DAILY_RAIDS = 23;
/** `Random.Range(15, 26)` [IL_0dae]: the raider deaths that cleanse a town. */
export const RAID_KILLS_MIN = 15;
export const RAID_KILLS_MAX_EXCLUSIVE = 26;
/** The caps [IL_0730, IL_06fa] - Mac, 2026-09-27, on 25 and 8: "Keep". */
export const MAX_RAID_ENEMIES = 25;
export const MAX_RAID_DEFENDERS = 8;
/** ScheduleNextSpawn / ScheduleNextDefender [IL_0828, IL_0852]: `Random.Range(1f, 10f)`, and `8f` for an orc raid's raiders. */
export const SPAWN_INTERVAL_MIN_S = 1;
export const SPAWN_INTERVAL_MAX_S = 10;
export const ORC_SPAWN_INTERVAL_MAX_S = 8;
/** PendingTimeoutSeconds [IL_069f], and what both clocks wait when a spawn lapses [IL_06b2, IL_06c3]. */
export const PENDING_TIMEOUT_S = 8;
export const PENDING_BACKOFF_S = 10;
/** CheckRaidActors' period [IL_0471]. */
export const ACTOR_SWEEP_S = 3;
/** CreateFoeSpawner(minDistance: 10, maxDistance: 35) [IL_07f0, IL_07f5]. */
export const RAID_SPAWN_MIN_DISTANCE = 10;
export const RAID_SPAWN_MAX_DISTANCE = 35;
/** GrantReputation [IL_1240]. */
export const RAID_LEGAL_REP = 5;
export const RAID_PEOPLE_REP = 5;
export const RAID_ORDER_REP = 3;
export const RAID_GUILD_REP = 3;
/** The towns SelectRaids takes, in the order it tests them [IL_0bd4]. */
export const RAID_TOWN_TYPES = Object.freeze([LOCATION_TYPES.TownCity, LOCATION_TYPES.TownVillage, LOCATION_TYPES.TownHamlet]);
/** RaidTypeName [IL_1355]: 0 knights, 1 bandits, anything else orcs. */
export const raidTypeName = (type) => (type === 1 ? 'bandits' : type === 0 ? 'knights' : 'orcs');
/** Fix 11: the cleanse line's adjective. */
export const raidTypeAdjective = (type) => (type === 1 ? 'bandit' : type === 0 ? 'knight' : 'orc');

/** Mac, 2026-09-27 ("4"): a region is raided about once every this many real hours. */
export const RAID_REGION_REAL_HOURS = 4;
/** DFU's WorldTime.TimeScale 12: a game day is two real hours. */
export const GAME_DAY_REAL_HOURS = 24 / 12;
/** The day's count: half a raid for each region the roll can pick (RAID-ROLL: net/raidLaw.js's, the relay's one copy -
 *  re-exported, never declared twice: audit24's one-home ratchet). */
export { raidsPerDay };

// ---- the lines, verbatim but for fix 11 --------------------------------------
/** AnnounceRegion [IL_0f40]. */
export const attackLine = (town, region, type) => `${town} in ${region} is under attack by ${raidTypeName(type)}!`;
/** AnnounceWithdrawal [IL_0fd7]. */
export const withdrawnLine = (town, region) => `The attackers have withdrawn from ${town} in ${region}.`;
/** OnEnemyDeath's last line [IL_1179]. */
export const cleansedLine = (town, region, type) => `${town} in ${region} has been cleansed of the ${raidTypeAdjective(type)} attack!`;
/** RAID3: who held the town, as the relay's cleanse names them - the most deaths first, the rest counted. */
export function defendedLine(top, n = 0) {
  const names = (Array.isArray(top) ? top : []).filter((x) => typeof x === 'string' && x);
  if (!names.length) return '';
  const more = Math.max(0, (n | 0) - names.length);
  const parts = more > 0 ? [...names, `${more} other${more === 1 ? '' : 's'}`] : names;
  return `Defended by ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]}.`;
}

/** UnityEngine.Random.Range(int, int): min inclusive, max exclusive. */
const rangeInt = (min, maxExclusive, random) => (maxExclusive <= min ? min : min + Math.floor(random() * (maxExclusive - min)));
/** UnityEngine.Random.Range(float, float): both ends inclusive. */
const rangeFloat = (min, max, random) => min + random() * (max - min);

/** ChooseEnemy [IL_137c]: the roll is drawn first, for every party [IL_137f]. */
export function chooseRaider(type, random = Math.random) {
  const roll = rangeInt(0, 100, random);
  if (type === 0) return MOBILE_TYPES.Knight;
  if (type === 1) return roll < 50 ? MOBILE_TYPES.Rogue : roll < 80 ? MOBILE_TYPES.Thief : MOBILE_TYPES.Burglar;
  return roll < 70 ? MOBILE_TYPES.Orc : roll < 95 ? MOBILE_TYPES.OrcSergeant : MOBILE_TYPES.OrcWarlord;
}

/**
 * SelectRaids' two lists [IL_0bd4]: every region the picker's bytes name (a byte b is region b - 128, kept when it is
 * in [0, RegionCount)), in index order, that holds a raidable town - each with its towns in MapTable order: the
 * index, the name (`MapNames`), and the map pixel PlayerIsAtRaidPixel compares [IL_11ff]. The game's own rows only
 * (`baseLocationCount`): a world-data mod appends rows past them on one client and not another - the gate scan's law
 * (systems/gateSite.js), and the one RAID2's shared roll needs. Null without the picker's bytes.
 * @param {{regionCount:number, getRegion:(r:number)=>any, baseLocationCount?:(r:number)=>number}|null} maps
 * @param {ArrayLike<number>|null} pickerData
 */
export function raidRegions(maps, pickerData) {
  if (!maps || !pickerData) return null;
  const count = maps.regionCount ?? 0;
  const onMap = new Set();
  for (let i = 0; i < pickerData.length; i++) {
    const r = pickerData[i] - 128;
    if (r >= 0 && r < count) onMap.add(r);
  }
  const types = new Set(RAID_TOWN_TYPES);
  const out = [];
  for (let r = 0; r < count; r++) {
    if (!onMap.has(r)) continue;
    const region = maps.getRegion(r);
    const table = region?.mapTable;
    if (!table) continue;
    const base = typeof maps.baseLocationCount === 'function' ? Math.min(table.length, maps.baseLocationCount(r)) : table.length;
    const towns = [];
    for (let k = 0; k < base; k++) {
      const row = table[k];
      if (!row || !types.has(row.locationType)) continue;
      const px = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
      towns.push(Object.freeze({ index: k, name: String(region.mapNames?.[k] ?? ''), px: px.x, py: px.y }));
    }
    if (towns.length) out.push(Object.freeze({ region: r, towns: Object.freeze(towns) }));
  }
  return Object.freeze(out);
}

/**
 * SelectRaids' roll [IL_0cda-IL_0dc5]: `count` raids, each a region evenly among those with a town left, a town
 * evenly in it and struck off (a region with none left is struck off too), a start, a party, two hours and a kill
 * target - in the IL's draw order (region, town, start, party, target). RAID-ROLL: the draws are net/raidLaw.js
 * rollRaidTowns' - the one copy the relay reads a word against.
 */
export function rollRaids(day, regions, count, random) {
  return rollRaidTowns(day, regions, count, random).map(({ region, town, st, ty, tg }) => ({
    regionIndex: region, locationIndex: town.index, startDay: day, locationName: town.name,
    type: ty, startMinute: st, endMinute: st + RAID_DURATION_MINUTES,
    killed: 0, attackAmount: tg, cleansed: false,
    announced: false, struck: false,   // fixes 3 and 5: the port's own two, saved with the rest
    px: town.px, py: town.py,
  }));
}

/** Fix 1: THE DAY'S raids - the roll off the day's own generator (RAID-ROLL: net/raidLaw.js raidDayRandom, worldTick's
 *  dayRng for the raids' salt - the relay's one copy), the count off the pace. */
export const raidsForDay = (day, regions) => rollRaids(day, regions, raidsPerDay(regions?.length ?? 0), raidDayRandom(day));

/** RaidEnemyName's bracket [IL_13cc]: one raid, one key - the region, the town and the day. */
export const raidKey = (raid) => `${raid.regionIndex}:${raid.locationIndex}:${raid.startDay}`;
/** The windows every Update test reads: begun, not ended, not cleansed. */
export const raidActive = (raid, now) => !raid.cleansed && now >= raid.startMinute && now < raid.endMinute;

/**
 * GrantReputation [IL_1240], in its order, none of it propagating: the region's legal reputation +5, clamped to
 * [-100, 100] [IL_125b-IL_126c]; the region's People +5 - FindFactionByTypeAndRegion AND the region itself, so DFU's
 * region-less fallback is refused [IL_1289]; the first knightly order of the region in the dictionary's order +3
 * [IL_130f]; the Fighters Guild +3, member or not [IL_133d].
 * @param {{player:any, store:{dict:Map<number, any>}}|null} ctx
 */
export function grantRaidReputation(ctx, region) {
  const player = ctx?.player, store = ctx?.store;
  if (!player || !store?.dict) return false;
  // AUDIT REP F5: through the one door, with its cause - REP5's "a notice on every change" (the raid's +5 was the one
  // legal change a cause moved that said nothing); the clamp is the mod's own, kept: the delta is what it lets through
  const rep = legalRepOf(player, region);
  changeLegalRep(player, region, Math.min(LEGAL_REP_MAX, Math.max(LEGAL_REP_MIN, rep + RAID_LEGAL_REP)) - rep, { kind: 'raid' });
  const people = findFactionByTypeAndRegion(store.dict, FACTION_TYPES.People, region);
  if (people && people.region === region) changeReputation(store, people.id, RAID_PEOPLE_REP, false);
  const orders = new Set(Object.values(ORDERS));
  for (const f of store.dict.values()) {
    if (f.region === region && f.ggroup === GUILD_GROUPS.KnightlyOrder && orders.has(f.id)) {
      changeReputation(store, f.id, RAID_ORDER_REP, false);
      break;
    }
  }
  changeReputation(store, GUILDS.FightersGuild.factionId, RAID_GUILD_REP, false);
  return true;
}

/** The cone's slack past the view's edge, so a raider at the rim is not taken while half on screen. */
export const SIGHT_MARGIN_DEGREES = 10;
/** Fix 6: is a point out of the player's sight - outside the view's horizontal cone (the port's yaw: forward is
 *  [sin yaw, 0, cos yaw]), or the player not outdoors to see it at all? */
export function outOfSight(feet, eye, yawRad, fovDegrees, outdoors = true) {
  if (!outdoors || !feet || !eye) return true;
  const dx = feet[0] - eye[0], dz = feet[2] - eye[2];
  if (dx * dx + dz * dz < 1e-6) return false;
  const d = Math.atan2(dx, dz) - yawRad;
  const off = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
  return off > ((fovDegrees / 2) + SIGHT_MARGIN_DEGREES) * Math.PI / 180;
}

// ---- the mod's state --------------------------------------------------------
/** RaidSaveData [IL_15e7]: lastSelectedDay -1, no raids. */
export const newRaidSaveData = () => ({ lastSelectedDay: -1, raids: [] });
let state = newRaidSaveData();
// AUDIT LIVED1b A3: whether the record in hand is a save's, not yet held against the world's day - RAID2's online
// "any other day is rolled afresh" is that record's (a save made on a clock of its own can carry a day the world has
// not reached), and ONLY that record's: past its first check the mod's own law stands, a LATER day alone rolls.
let _dayFromSave = true;

const RAID_FIELDS_INT = ['regionIndex', 'locationIndex', 'startDay', 'type', 'startMinute', 'endMinute', 'killed', 'attackAmount', 'px', 'py'];
/** GetSaveData [IL_02e8]: the record, the port's two flags with it. */
export const getRaidSaveData = () => ({
  lastSelectedDay: state.lastSelectedDay,
  raids: state.raids.map((r) => ({
    regionIndex: r.regionIndex, locationIndex: r.locationIndex, startDay: r.startDay, locationName: r.locationName,
    type: r.type, startMinute: r.startMinute, endMinute: r.endMinute, killed: r.killed, attackAmount: r.attackAmount,
    cleansed: r.cleansed, announced: r.announced, struck: r.struck, px: r.px, py: r.py,
  })),
});
/**
 * RestoreSaveData [IL_02fc]: the record as saved - a raid that is not whole is dropped rather than guessed at, and
 * the mod's own migration of a target of 0 or less (`Random.Range(15, 26)` [IL_035d]) kept; its second, for its
 * 12:00-20:00 era's saves, has no save here to mend. The pending spawn goes, both clocks start again, the region is
 * forgotten - and the announcements are NOT (fix 3: they are the raids' own `announced`).
 */
export function restoreRaidSaveData(data) {
  cancelPending();
  const day = Number.isInteger(data?.lastSelectedDay) ? data.lastSelectedDay : -1;
  const raids = [];
  for (const r of Array.isArray(data?.raids) ? data.raids : []) {
    if (!r || typeof r !== 'object' || !RAID_FIELDS_INT.every((k) => Number.isInteger(r[k]))) continue;
    if (r.endMinute <= r.startMinute || r.killed < 0) continue;
    raids.push({
      regionIndex: r.regionIndex, locationIndex: r.locationIndex, startDay: r.startDay, locationName: String(r.locationName ?? ''),
      type: r.type, startMinute: r.startMinute, endMinute: r.endMinute, killed: r.killed,
      attackAmount: r.attackAmount > 0 ? r.attackAmount : rangeInt(RAID_KILLS_MIN, RAID_KILLS_MAX_EXCLUSIVE, rnd()),
      cleansed: r.cleansed === true, announced: r.announced === true, struck: r.struck === true, px: r.px, py: r.py,
    });
  }
  state = { lastSelectedDay: day, raids };
  _dayFromSave = true;   // AUDIT LIVED1b A3: the one check that may roll another day than a later one
  _peerWords = new Map();
  _myClaims = new Map();
  _live = [];
  scheduleNextSpawn(-1);
  scheduleNextDefender();
  _lastRegion = -1;
}
export const raidState = () => state;

// ---- the host ---------------------------------------------------------------
/**
 * The world host's seams - GameManager's members the mod reaches for:
 *   now()                     the classic minutes (DaggerfallDateTime.ToClassicDaggerfallTime); worldMinutes by default
 *   random()                  UnityEngine.Random's uniform draw - THE ENGINE-PRNG RULE (Port-Ledger A): the spawn
 *                             clocks and the raiders' species; Math.random by default
 *   maps()                    MAPS.BSA's reader (regionCount, getRegion, baseLocationCount)
 *   picker()                  TRAV0I01.IMG's bytes (DaggerfallUI.GetImgBitmap), null until loaded
 *   regionIndex()             PlayerGPS.CurrentRegionIndex - and -1 at sea or off the map (fix 8)
 *   townHere()                {regionIndex, locationIndex} while the player stands OUTDOORS in a location's rect
 *                             (FindCurrentRaid's three tests [IL_0df9-IL_0e09]), else null
 *   playerPixel()             PlayerGPS.CurrentMapPixel
 *   standRaider(mobileType)   a hostile foe placed 10-35 units off, just outside the view (FoeSpawner) - a promise of
 *                             the foe record, null when no spot was found
 *   standDefender(threats)    one of the town's watch, the player's ally, sent at the nearest threat - a promise
 *   defenderCount()           the defenders standing and coming (cityGuards.defenderCount)
 *   defendersAllowed()        the watch would keep one here (no crime on the player, not a beast)
 *   removeFoe(foe)            Object.Destroy - gone, no corpse
 *   outOfSight(foe)           fix 6's test for a routed raider
 *   reputation()              {player, store} for GrantReputation
 *   say(line)                 DaggerfallUI.AddHUDText; notify.js hudText by default
 */
let _host = null;
export function setRaidingPartiesHost(host) { _host = host ?? null; }
const host = () => _host ?? {};
const rnd = () => host().random ?? Math.random;
const say = (line) => (host().say ?? hudText)(line);
const regionName = (r) => host().regionName?.(r) ?? String(r);

// ---- the runtime (not saved - the mod's own instance fields) ----------------
/** The raid's foes this session stood: { foe, key, kind: 'raider'|'defender', routed }. The mod found its actors by
 *  name; the port keeps the records it stood (a raider is `transient`: no save carries it). */
let _live = [];
/** The one spawn in flight: { key, age, cancelled }. */
let _pending = null;
let _nextSpawnIn = 0;
let _nextDefenderIn = 0;
let _sweepIn = 0;
let _lastRegion = -1;
/** SelectRaids' lists, made once the picker is at hand - static data for the session. */
let _regions = null;
/** RAID2: every peer's word on each raid - key -> Map(peer id -> { n, since, at }): n the most deaths of its own
 *  raiders it has said (a share is never taken back), since the local clock its claim stands from (null: it claims
 *  none), at when it last spoke. */
let _peerWords = new Map();
/** RAID2: the raids I run - key -> the local clock I claimed each at. */
let _myClaims = new Map();
/** RAID2: since when a smaller id standing in the town has left a raid unclaimed - key -> local clock. */
let _unclaimedSince = new Map();
/** RAID2: how long a smaller id in the town may leave a raid unclaimed before I claim it (a client that never will -
 *  one without RAID2, or gone quiet - must not hold a town unraided). */
export const RAID_CLAIM_GRACE_MS = 10000;
/** RAID3: the relay's word on each raid's ledger - key -> { n, tg, c } (c: the cleanse's moment on its clock, 0: none). */
let _relay = new Map();
/** RAID3: the receipts the relay handed this player - key -> the receipt (net/raidReceipt.js), RAID_RECEIPTS_KEPT at most. */
let _receipts = new Map();
export const RAID_RECEIPTS_KEPT = 32;
/** RAID3: my last word to the relay - { key, n, s, at } (at: the local clock). */
let _lastWord = null;

/** ScheduleNextSpawn [IL_0828]. */
function scheduleNextSpawn(type) {
  _nextSpawnIn = rangeFloat(SPAWN_INTERVAL_MIN_S, type === 2 ? ORC_SPAWN_INTERVAL_MAX_S : SPAWN_INTERVAL_MAX_S, rnd());
}
/** ScheduleNextDefender [IL_0852]. */
function scheduleNextDefender() {
  _nextDefenderIn = rangeFloat(SPAWN_INTERVAL_MIN_S, SPAWN_INTERVAL_MAX_S, rnd());
}
/** CancelPending [IL_14d4]: a spawn still in flight lands into nothing. */
function cancelPending() {
  if (_pending) _pending.cancelled = true;
  _pending = null;
}

const regionsNow = () => {
  if (!_regions) _regions = raidRegions(host().maps?.() ?? null, host().picker?.() ?? null);
  return _regions;
};

/** Fix 6: an ended raid's raiders are routed - taken at the first sweep they are out of sight. */
function routRaid(raid) {
  const key = raidKey(raid);
  if (_pending?.key === key) cancelPending();
  _myClaims.delete(key);   // RAID2: an ended raid is run by no one
  for (const e of _live) if (e.key === key && e.kind === 'raider') e.routed = true;
}

const liveRaiders = (key) => _live.filter((e) => e.key === key && e.kind === 'raider' && !e.routed && !e.foe.dead && (e.foe.entity?.health ?? 1) > 0);
/** Is a raid on in the town the player stands in? The host's watch reads it (the raid brings its defenders
 *  whatever the watch's own switch says). */
export function raidDefendingHere(now = (host().now ?? worldMinutes)()) {
  const town = host().townHere?.();
  if (!town) return false;
  return state.raids.some((r) => raidActive(r, now) && r.regionIndex === town.regionIndex && r.locationIndex === town.locationIndex);
}

/** The cleanse [IL_1117-IL_1179]: the raid ends, its raiders are routed, a player who fought and stands on the
 *  town's pixel earns the reputation, and the line is said wherever the player is. */
function cleanse(raid, { said = true, top = [], n = 0 } = {}) {
  raid.cleansed = true;
  routRaid(raid);
  const px = host().playerPixel?.();
  if (raid.struck && px && px.x === raid.px && px.y === raid.py) grantRaidReputation(host().reputation?.() ?? null, raid.regionIndex);
  if (!said) return;
  const who = defendedLine(top, n);   // RAID3: the relay's cleanse names who held the town
  say(who ? `${cleansedLine(raid.locationName, regionName(raid.regionIndex), raid.type)} ${who}` : cleansedLine(raid.locationName, regionName(raid.regionIndex), raid.type));
}

/** OnEnemyDeath, polled: each raider's death counts once, toward its raid while the raid is on; a blow of the
 *  player's on any of a raid's raiders marks the raid fought (fix 5). */
function tallyDeaths(now) {
  for (const e of _live) {
    if (e.kind !== 'raider') continue;
    const raid = state.raids.find((r) => raidKey(r) === e.key);
    if (raid && !raid.struck && renownStruckAt(e.foe) != null) raid.struck = true;
    if (!e.foe.dead || e.counted) continue;
    e.counted = true;
    if (!e.foe.corpse || !raid || !raidActive(raid, now)) continue;   // removed, not killed; or its raid is over
    raid.killed++;
    if (!raidRelayOn() && raidKillTotal(raid) >= raid.attackAmount) cleanse(raid);   // RAID3: at a raid relay, its cleanse alone
  }
}

/** CheckRaidActors [IL_09a0], every three seconds: a routed raider out of sight goes (fix 6); the dead are let go. */
function sweep() {
  const h = host();
  for (const e of _live) {
    if (e.kind === 'raider' && e.routed && !e.foe.dead && (h.outOfSight?.(e.foe) ?? true)) h.removeFoe?.(e.foe);
  }
  _live = _live.filter((e) => !e.foe.dead || (e.kind === 'raider' && !e.counted));
}

/** SpawnRaidEnemy [IL_0764]: one foe in flight; a spot not found costs nothing but this tick (fix 10). */
function spawn(raid, kind, mobileType) {
  const h = host();
  const p = { key: raidKey(raid), age: 0, cancelled: false };
  _pending = p;
  const threats = () => liveRaiders(p.key).map((e) => e.foe);
  const promise = kind === 'defender' ? h.standDefender?.(threats()) : h.standRaider?.(mobileType);
  Promise.resolve(promise).then((foe) => {
    if (_pending === p) _pending = null;
    if (!foe) return;
    if (p.cancelled && kind === 'raider') { h.removeFoe?.(foe); return; }
    _live.push({ foe, key: p.key, kind, routed: false, counted: false });
    if (kind === 'raider') foe.raidKey = p.key;   // RAID2: it rides my frame tagged with its raid
  }, () => { if (_pending === p) _pending = null; });
}

/**
 * Update [IL_0428], one frame. `dt` is the frame's time, held by a pause (fix 7). Answers what it did, for the pins:
 * null (off, online, or waiting for the picker), 'idle' (no raid here), 'waiting' (a spawn in flight), or the spawn
 * it started ('defender' / 'raider').
 */
export function raidFrame(dt = 0) {
  if (!raidingPartiesOn()) return null;
  const h = host();
  const now = (h.now ?? worldMinutes)();
  const day = Math.floor(now / MINUTES_PER_DAY);
  const region = h.regionIndex?.() ?? -1;
  _nextSpawnIn -= dt;
  _nextDefenderIn -= dt;
  _sweepIn -= dt;
  // RAID2: a raider taken over from a fallen runner is mine to count; a puppet of a raid I struck marks it fought
  for (const f of h.ownRaidFoes?.() ?? []) if (!_live.some((e) => e.foe === f)) _live.push({ foe: f, key: f.raidKey, kind: 'raider', routed: false, counted: false });
  for (const pup of h.raidPuppets?.() ?? []) {
    const r = state.raids.find((x) => raidKey(x) === pup._pupRaid);
    if (r && !r.struck && renownStruckAt(pup) != null) r.struck = true;
  }
  tallyDeaths(now);
  const relay = raidRelayOn();
  for (const r of state.raids) if (!relay && raidActive(r, now) && raidKillTotal(r) >= r.attackAmount) cleanse(r);   // RAID2: the owners' shares summed; RAID3: at a raid relay, its cleanse alone
  if (_sweepIn <= 0) { _sweepIn = ACTOR_SWEEP_S; sweep(); }

  // B. the day's roll [IL_0498-IL_0540]: the old day's raids expire first (fix 9), then the day's are rolled (fix 1).
  // The mod rolls only on a LATER day. RAID2: online the day is the world's, and a save made on a clock of its own can
  // carry a list rolled for a day the world has not reached - kept, it would hold every raid until then; any other
  // day is rolled afresh.
  // AUDIT LIVED1b A3 (a sibling of AUDIT LIVED1 I, older than LIVED1): ...ON THE SAVE'S RECORD ALONE. The world's clock
  // steps back - the relay's offset corrected at a welcome, this machine's clock set back between them - and a step
  // across a midnight rolled yesterday's list, then today's afresh a frame later: a town already cleansed was under
  // attack again, said so again, and paid its cleanse's reputation a second time (legal 5, then 10).
  if (day > state.lastSelectedDay || (sharedClockOn() && _dayFromSave && day !== state.lastSelectedDay)) {
    const regions = regionsNow();
    if (!regions) return null;   // no picker, no Update [IL_04b5]
    expire(now, region);
    for (const r of state.raids) routRaid(r);
    state.lastSelectedDay = day;
    state.raids = raidsForDay(day, regions).filter((r) => !isWildRegion(r.regionIndex));   // PVPDUNGEONS (the owner: "Do not spawn world events in the PVP zone!"): every client drops the zone's towns from the day's roll alike
    cancelPending();
    scheduleNextSpawn(-1);
    scheduleNextDefender();
    _lastRegion = region;
  }
  if (sharedClockOn()) _dayFromSave = false;   // AUDIT LIVED1b A3: the save's record has met the world's day (an offline frame is not the world's)
  // C. the raids that ran out [IL_0540-IL_05b9]
  expire(now, region);
  // D. a new region cancels the spawn in flight [IL_05b9]
  if (region !== _lastRegion) { _lastRegion = region; cancelPending(); }
  // E. the region's raids, each announced once (fix 3), never at sea (fix 8)
  if (region >= 0) {
    for (const r of state.raids) {
      if (!raidActive(r, now) || r.regionIndex !== region || r.announced) continue;
      r.announced = true;
      say(attackLine(r.locationName, regionName(region), r.type));
    }
  }
  // F. is the player standing in a raid [IL_0de4]?
  const town = h.townHere?.() ?? null;
  const raid = town ? state.raids.find((r) => raidActive(r, now) && r.regionIndex === town.regionIndex && r.locationIndex === town.locationIndex) : null;
  if (!raid) { cancelPending(); _myClaims.clear(); return 'idle'; }
  if (relay) sayToRelay(raid);   // RAID3: my word to the town's ledger, whoever runs the raid
  // RAID2: online, the one who runs it stands its foes - every other player here stands them as puppets
  if (sharedClockOn() && !runsRaid(raid)) { cancelPending(); return 'standing-by'; }
  // G. one foe in flight [IL_0661-IL_06d1]
  if (_pending && _pending.key !== raidKey(raid)) cancelPending();
  if (_pending) {
    _pending.age += dt;
    if (_pending.age <= PENDING_TIMEOUT_S) return 'waiting';
    cancelPending();
    _nextSpawnIn = PENDING_BACKOFF_S;
    _nextDefenderIn = PENDING_BACKOFF_S;
    return 'waiting';
  }
  // H. a defender first [IL_06d1-IL_0712]; the clock is rescheduled even at the cap
  if (_nextDefenderIn <= 0) {
    scheduleNextDefender();
    if (h.defendersAllowed?.() !== false && (h.defenderCount?.() ?? 0) < MAX_RAID_DEFENDERS) {
      spawn(raid, 'defender');
      return 'defender';
    }
  }
  // I. a raider [IL_0712-IL_0760]
  if (_nextSpawnIn <= 0) {
    scheduleNextSpawn(raid.type);
    if (liveRaiders(raidKey(raid)).length < MAX_RAID_ENEMIES) {
      spawn(raid, 'raider', chooseRaider(raid.type, rnd()));
      return 'raider';
    }
  }
  return 'idle';
}

/** The expiry pass [IL_0540-IL_05b9], from the end of the list: a raid past its end is withdrawn - said only of one
 *  the player was told of (fix 2), in the player's region - its raiders routed, and it leaves the list. */
function expire(now, region) {
  for (let i = state.raids.length - 1; i >= 0; i--) {
    const r = state.raids[i];
    if (now < r.endMinute) continue;
    if (!r.cleansed && r.announced && region >= 0 && r.regionIndex === region) say(withdrawnLine(r.locationName, regionName(r.regionIndex)));
    routRaid(r);
    state.raids.splice(i, 1);
    _peerWords.delete(raidKey(r)); _unclaimedSince.delete(raidKey(r)); _relay.delete(raidKey(r));   // RAID2: its words go with it; RAID3: and the relay's
  }
}

// ---- RAID2: the online arm ------------------------------------------------------
const localNow = () => (host().wallNow ?? (() => performance.now()))();
/** A raid's deaths: mine and every peer's share said (offline, mine alone - RAID1's count). */
export function raidKillTotal(raid) {
  let n = raid.killed;
  for (const e of _peerWords.get(raidKey(raid))?.values() ?? []) n += e.n;
  return n;
}
/** Do I run this raid? The claims heard and still fresh, mine among them; else the smallest id in the town, which
 *  claims - or I claim once one smaller has left it unclaimed RAID_CLAIM_GRACE_MS. */
function runsRaid(raid) {
  const h = host(), key = raidKey(raid), t = localNow();
  const me = h.selfId?.() ?? null;
  if (!me) return false;
  const claims = [];
  for (const [id, e] of _peerWords.get(key) ?? []) if (e.since != null && t - e.at <= RAID_WORD_STALE_MS) claims.push({ id, age: t - e.since });
  if (_myClaims.has(key)) claims.push({ id: me, age: t - _myClaims.get(key) });
  let runner = raidRunnerOf({ me, inTown: h.peersInTown?.() ?? [], claims });
  if (!claims.length && runner !== me) {
    if (!_unclaimedSince.has(key)) _unclaimedSince.set(key, t);
    if (t - _unclaimedSince.get(key) >= RAID_CLAIM_GRACE_MS) runner = me;
  } else _unclaimedSince.delete(key);
  if (runner !== me) { _myClaims.delete(key); return false; }
  if (!_myClaims.has(key)) _myClaims.set(key, t);
  return true;
}
/** A peer's word off its foes frame (`rk`, validated here): its share of each raid's deaths - the most it has said -
 *  and its claim, if it runs one. */
export function raidPeerWord(from, raw, t = localNow()) {
  if (typeof from !== 'string' || !from) return 0;
  const words = validRaidWords(raw);
  for (const w of words) {
    let m = _peerWords.get(w.key);
    if (!m) { m = new Map(); _peerWords.set(w.key, m); }
    const e = m.get(from) ?? { n: 0, since: null, at: t };
    e.n = Math.max(e.n, w.n);
    e.since = w.age >= 0 ? t - w.age : null;
    e.at = t;
    m.set(from, e);
  }
  return words.length;
}
/** My word for my frame: each raid on now that I run or whose raiders I have killed - `[key, my deaths, claim age
 *  (-1: none)]` - at most RAID_WORDS_MAX; null when I have none to say. */
export function raidWireWord(t = localNow()) {
  const now = (host().now ?? worldMinutes)();
  const out = [];
  for (const r of state.raids) {
    if (out.length >= RAID_WORDS_MAX) break;
    const key = raidKey(r);
    if (!raidActive(r, now) || (!_myClaims.has(key) && r.killed === 0)) continue;
    out.push([key, Math.min(r.killed, 999), _myClaims.has(key) ? Math.max(0, Math.round(t - _myClaims.get(key))) : -1]);
  }
  return out.length ? out : null;
}

// ---- RAID3: the relay's arm -------------------------------------------------------
/** Does the relay keep this world's raids? Online, at a relay that knows the frame (net/wire.js relaySupportsRaid). */
export const raidRelayOn = () => sharedClockOn() && !!host().relayRaids?.();
const raidByKey = (key) => state.raids.find((r) => raidKey(r) === key) ?? null;
/** AUDIT RAID R1: my raid's signature - the tuple my word names (the day's roll's own), which the relay's words carry. */
const raidSigOf = (raid) => raidSig({ st: raid.startMinute, tg: raid.attackAmount, ty: raid.type, px: raid.px, py: raid.py });
/** AUDIT RAID R1: the raid of mine a relay's word is about - its key AND its signature, or null. A socket's forged word
 *  names the honest key with its own tuple; its ledger and its cleanse are its own, and never close mine. */
const raidOfWord = (key, g) => { const r = raidByKey(key); return r && raidSigOf(r) === g ? r : null; };
/** My word on the raid whose town I stand in, to its cell - at once when my deaths or my strike moved, else every
 *  RAID_WORD_MS; a word the session could not send is said again next frame (the session's own gate spaces them). */
function sayToRelay(raid, t = localNow()) {
  const key = raidKey(raid), n = Math.min(raid.killed, RAID_WORD_KILLS_MAX), s = raid.struck ? 1 : 0;
  if (_lastWord && _lastWord.key === key && _lastWord.n === n && _lastWord.s === s && t - _lastWord.at < RAID_WORD_MS) return false;
  const word = { k: 'w', key, st: raid.startMinute, tg: raid.attackAmount, ty: raid.type, px: raid.px, py: raid.py, n, s };
  if (!host().sendRaid?.(word, worldRoom(raid.px, raid.py))) return false;
  _lastWord = { key, n, s, at: t };
  return true;
}
/**
 * The relay's word on a raid (net/wire.js validRaidOut, off the town's cell or the hub): the ledger's state (`st`), a
 * cleanse (`cl`), the day's cleanses at a hello (`cls`), or my receipt (`rc`). A cleanse closes the raid on this
 * machine - said where RAID1 says it (the town's own cell: I stood there; the hub: I was told of the raid and stand
 * in its region), quietly from a hello's list - and RAID1's reward is paid by RAID1's own law (struck, on the pixel).
 */
export function raidRelayWord(f, room = null) {
  if (!f || typeof f !== 'object') return false;
  if (f.k === 'rc') {
    const c = readRaidReceipt(f.r);
    if (!c || _receipts.get(c.w) === f.r) return false;
    _receipts.delete(c.w);
    _receipts.set(c.w, f.r);
    while (_receipts.size > RAID_RECEIPTS_KEPT) _receipts.delete(_receipts.keys().next().value);
    host().onRaidReceipt?.(f.r, c);   // RAID4 carries it to the account service and rolls the spoils off its seed
    return true;
  }
  if (f.k === 'cls') {
    for (const [key, , g] of Array.isArray(f.l) ? f.l : []) { const r = raidOfWord(key, g); if (r && !r.cleansed) cleanse(r, { said: false }); }
    return true;
  }
  const raid = raidOfWord(f.key, f.g);
  if (f.k === 'st') {
    if (!raid) return false;   // a raid this machine does not hold (its list is the day's roll - AUDIT RAID R1: its tuple too) is not its to keep
    _relay.set(f.key, { n: f.n, tg: f.tg, c: f.c });
    if (f.c > 0 && !raid.cleansed) cleanse(raid);   // a cleanse this machine missed (a dropped link): said now
    return true;
  }
  if (f.k === 'cl') {
    if (!raid || raid.cleansed) return false;
    const inRegion = raid.announced && (host().regionIndex?.() ?? -1) === raid.regionIndex;
    cleanse(raid, { said: (typeof room === 'string' && isCellRoom(room)) || inRegion, top: f.top, n: f.n });
    return true;
  }
  return false;
}
/** RAID3: the relay's last word on a raid's ledger ({ n, tg, c }), or null. */
export const raidRelayState = (key) => _relay.get(key) ?? null;
/** RAID3: the receipt the relay handed me for a raid, or null. */
export const raidReceipt = (key) => _receipts.get(key) ?? null;

let _installed = false;
/** Once, at the scene boot: the save record's slot (the mod's SaveDataInterface [IL_025c]). */
export function installRaidingParties() {
  if (_installed) return false;
  _installed = true;
  registerModSaveData(RAIDING_PARTIES_VENDOR, { newSaveData: newRaidSaveData, getSaveData: getRaidSaveData, restoreSaveData: restoreRaidSaveData });
  return true;
}

/**
 * RAID-ROLL: THIS WORLD'S TOWNS TABLE for the hub that asks for one by its operator's pinned hash (`raid` `tw`) - the
 * table in its one spelling (net/raidLaw.js raidTownsCanon) when it hashes to `h`, else null (a world whose towns are
 * not the operator's - a data mod - or whose picker has not loaded yet). The first time it is spelled its hash is said
 * to the console once: the value an operator pins as RAID_TOWNS_SHA256 (tools/raidTowns.mjs says it too).
 * @param {string} h @returns {Promise<string|null>}
 */
export async function raidTownsFor(h) {
  const regions = regionsNow();
  if (!regions?.length) return null;
  if (_townsText == null) {
    const text = raidTownsCanon(regions);
    const hash = await raidTownsHash(text);
    if (_townsText == null) { _townsText = text; _townsHash = hash; if (hash) console.info(`[raid] this world's towns table: ${hash}`); }
  }
  return _townsHash && _townsHash === h ? _townsText : null;
}
let _townsText = null, _townsHash = null;

/** Test seam. */
export function _resetRaidingParties() {
  state = newRaidSaveData(); _live = []; _pending = null; _nextSpawnIn = 0; _nextDefenderIn = 0; _sweepIn = 0;
  _lastRegion = -1; _regions = null; _host = null; _installed = false; _townsText = null; _townsHash = null;
  _peerWords = new Map(); _myClaims = new Map(); _unclaimedSince = new Map();
  _relay = new Map(); _receipts = new Map(); _lastWord = null;
}
/** Test seam: the runtime, read-only. */
export const _raidRuntime = () => ({ live: _live.slice(), pending: _pending, nextSpawnIn: _nextSpawnIn, nextDefenderIn: _nextDefenderIn });
