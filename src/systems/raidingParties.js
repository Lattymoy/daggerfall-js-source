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
// RAID3, THE RELAY HOLDS THE RAID (net/raid/raidLaw.js, Mac's "1. Server"): where the relay speaks raids, every player
// standing in a raided town says its word to the town's cell (its own raiders' deaths, its strike) and the cell keeps
// the raid's ledger - the count, kept when everyone leaves; the cleanse, stamped once; a signed receipt to each player
// who earned it (net/raid/raidReceipt.js). The count and the cleanse are then the relay's alone: no sum of words here
// cleanses a town, and the hub's word closes a raid on every machine in the Bay (a cleanse said in its region, never
// a withdrawal). RAID2's words still elect the runner; offline, and at a relay before it, nothing here changes.
//
// RAID5, THE RAID'S KIND (systems/raidKinds.js, the owner: "rework town raids to bring them up to par with other world events"):
// each raid the day rolls is a classic raid, an ASSAULT (waves in packs, a breather between, the party's leader alone at
// the last - an elite with two boss traits), a SIEGE OF THE STANDARD (a Standard-Bearer of the watch holds the square;
// the raiders march on him) or an EXODUS (refugees walk the streets to the square; the raiders hunt them) - read off
// the raid's own tuple, so the roll the relay checks is unchanged. The count and the cleanse are RAID1-RAID3's; the
// kind decides how the raiders stand and whether the town was HELD (its thanks the more for it - systems/raidSpoils.js).
// The objective is its runner's, said to the town in its frame (`ro`), taken up by the next runner.
//
// The state is the mod's own save record (RaidSaveData: lastSelectedDay and the day's raids), riding DFU's per-mod
// slot (systems/modSaveData.js). The world host (scenes/world.js) is the one host with the Bay's towns, its GPS and
// the town watch, so it is the one that answers the seams below.

import { modSetting } from './modSettings.js';
import { registerModSaveData } from './modSaveData.js';
import { eventNotice } from './eventNotices.js';   // EVENTS1: a raid's lines in the event board's news
import { sharedClockOn, worldMinutes } from './worldTick.js';
import { MINUTES_PER_DAY } from './gameDate.js';
import { LOCATION_TYPES, longitudeLatitudeToMapPixel } from '../formats/mapsFile.js';
import { FACTION_TYPES, GUILD_GROUPS } from '../formats/factionFile.js';
import { MOBILE_TYPES } from '../characters/mobile/mobileTypes.js';
import { findFactionByTypeAndRegion } from './talk/talk.js';
import { changeReputation } from './faction/factionRep.js';
import { legalRepOf, changeLegalRep, LEGAL_REP_MIN, LEGAL_REP_MAX } from './court.js';
import { ORDERS } from './guild/guildVariants.js';
import { GUILDS } from './guild/guilds.js';
import { renownStruckAt } from '../net/renownTracker.js';
import { raidRunnerOf, validRaidWords, validRaidObjWords, RAID_WORD_STALE_MS, RAID_WORDS_MAX } from '../world/raidShared.js';   // RAID2: the online arm's law, shared with the foes pool
import { RAID_WORD_MS, RAID_WORD_KILLS_MAX, raidSig, rollRaidTowns, raidDayRandom, raidsPerDay, raidTownsCanon, raidTownsHash } from '../net/raid/raidLaw.js';   // RAID3: the relay's ledger's law; RAID-ROLL: the day's roll, the relay's too
import { readRaidReceipt } from '../net/raid/raidReceipt.js';
import { worldRoom, isCellRoom } from '../net/wire.js';
import { isWildRegion } from './wild/wildZone.js';   // PVPDUNGEONS: no world event in the open zone
import { noteAct } from './questlines/qlActs.js';   // QL11: the features' acts, heard by the running quests
import { staffRaids, staffRaidsEnded, staffRaidHere, staffRaider, staffRaidRoom, staffBossWanted, staffBossLost, staffBossByHand, staffBossToSay, staffEventBook, staffEventEnd, staffEventLedger, staffRaidOfKey } from './staffEvents.js';   // STAFF-EVENT: a staff event runs as a raid
import { validStaffEventIn, staffEventKey } from '../net/staffEvent/staffEventLaw.js';
import { readStaffReceipt } from '../net/staffEvent/staffEventReceipt.js';   // STAFF-EVENT THE REWARD: my receipt
import { promoteStaffBoss, promoteRaidLeader } from './eliteFoes.js';   // STAFF-EVENT: its mini boss; RAID5: a raid's leader
import { giveBossTraits, rollBossTraits } from './bossTraits.js';   // RAID5: the leader's two traits (BOSS-TRAITS)
import { RAID_KIND_ORDER, raidKindOf, raidKindAsk, raidKindName, raidWavePlan, raidWaveAt, raidWaveLine, raidLeaderLine, raidLeaderName, raidLeaderOf, raidLeaderNameOf,
  raidBearerFellLine, raidRefugeeSafeLine, raidRefugeeLostLine, raidHeldLine, raidObjectiveDetail, alongWay, wayLength,
  RAID_WAVE_BREATHER_S, RAID_WAVE_PACK_MIN, RAID_WAVE_PACK_MAX, RAID_WAVE_PACK_GAP_S, RAID_LEADER_TRAITS, RAID_LEADER_AGAIN_S,
  RAID_DEFEND_PACK_MAX, RAID_DEFEND_PACK_GAP_S, RAID_DEFEND_FROM_M, RAID_AIM_TICKS, RAID_REFUGEES, RAID_REFUGEES_HOLD, RAID_REFUGEE_PACE,
  RAID_REFUGEE_WAIT_M, RAID_REFUGEE_SAFE_M, RAID_ESCORT_PACK_MAX, RAID_ESCORT_PACK_GAP_S, RAID_ESCORT_AHEAD_M,
  RAID_WAVE_STALL_S, RAID_SITE_AGAIN_S, RAID_REFUGEE_GAP_M } from './raidKinds.js';   // RAID5: the raid's kind; AUDIT WORLD-EVENTS: and its clocks
import { enemyDisplayName } from '../characters/enemy/enemyBasics.js';   // STAFF-EVENT: its lines name a kind
import { t } from './textManager.js';   // STAFF-EVENT: its lines in the player's language

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
/** The placement standRaider stands a raider by (scenes/hostEnchant.js standLooseFoe's): the mod's just out of view, or
 *  STAFF-EVENT PACKS' `{ min, max, los }`. @param {{ min?: number, max?: number, los?: boolean } | undefined} at */
export const raidSpawnRange = (at) => ({ minDistance: at?.min ?? RAID_SPAWN_MIN_DISTANCE, maxDistance: at?.max ?? RAID_SPAWN_MAX_DISTANCE, lineOfSightCheck: at?.los ?? true });
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
/** The day's count: half a raid for each region the roll can pick (RAID-ROLL: net/raid/raidLaw.js's, the relay's one copy -
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
 * (systems/gate/gateSite.js), and the one RAID2's shared roll needs. Null without the picker's bytes.
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
 * target - in the IL's draw order (region, town, start, party, target). RAID-ROLL: the draws are net/raid/raidLaw.js
 * rollRaidTowns' - the one copy the relay reads a word against.
 */
export function rollRaids(day, regions, count, random) {
  return rollRaidTowns(day, regions, count, random).map(({ region, town, st, ty, tg }) => ({
    regionIndex: region, locationIndex: town.index, startDay: day, locationName: town.name,
    type: ty, startMinute: st, endMinute: st + RAID_DURATION_MINUTES,
    killed: 0, attackAmount: tg, cleansed: false,
    announced: false, struck: false,   // fixes 3 and 5: the port's own two, saved with the rest
    px: town.px, py: town.py,
    sacked: false, safe: 0, lost: 0,   // RAID5: its objective's (systems/raidKinds.js)
  }));
}

/** Fix 1: THE DAY'S raids - the roll off the day's own generator (RAID-ROLL: net/raid/raidLaw.js raidDayRandom, worldTick's
 *  dayRng for the raids' salt - the relay's one copy), the count off the pace. */
export const raidsForDay = (day, regions) => rollRaids(day, regions, raidsPerDay(regions?.length ?? 0), raidDayRandom(day));

/** RaidEnemyName's bracket [IL_13cc]: one raid, one key - the region, the town and the day. */
export const raidKey = (raid) => raid.key ?? `${raid.regionIndex}:${raid.locationIndex}:${raid.startDay}`;   // STAFF-EVENT: an event's own (`s.<id>`)
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
    ...(r.sacked ? { sacked: true } : {}), ...(r.safe ? { safe: r.safe } : {}), ...(r.lost ? { lost: r.lost } : {}),   // RAID5: its objective, where it went
    ...(r.ld ? { ld: true } : {}), ...(r.wv >= 0 ? { wv: r.wv } : {}), ...(r.asked ? { asked: true } : {}), ...(r.ow ? { ow: r.ow.slice() } : {}),   // AUDIT WORLD-EVENTS L3-11: its leader's fall, its wave, and what was said of it - once, as RAID1's own lines are
  })),
  ...(_held.length ? { held: _held.slice() } : {}),   // RAID5: the raids held, for their thanks
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
      sacked: r.sacked === true, safe: Number.isInteger(r.safe) && r.safe >= 0 ? r.safe : 0, lost: Number.isInteger(r.lost) && r.lost >= 0 ? r.lost : 0,   // RAID5
      ...(r.ld === true ? { ld: true } : {}), ...(Number.isInteger(r.wv) && r.wv >= 0 ? { wv: r.wv } : {}), ...(r.asked === true ? { asked: true } : {}),   // AUDIT WORLD-EVENTS L3-11
      ...(Array.isArray(r.ow) && r.ow.length === 3 && r.ow.every((x) => Number.isInteger(x)) ? { ow: r.ow.slice() } : {}),
    });
  }
  state = { lastSelectedDay: day, raids };
  _held = Array.isArray(data?.held) ? data.held.filter((k) => typeof k === 'string').slice(-RAID_HELD_KEPT) : [];   // RAID5
  _dayFromSave = true;   // AUDIT LIVED1b A3: the one check that may roll another day than a later one
  _peerWords = new Map();
  _myClaims = new Map();
  _live = [];
  _peerObj = new Map(); _pack = null;   // AUDIT WORLD-EVENTS L3-11: and RAID5's words heard (the said live on each raid, `ow`)
  scheduleNextSpawn(-1);
  scheduleNextDefender();
  _lastRegion = -1;
}
export const raidState = () => state;
/** STAFF-EVENT: the day's raids and the staff events live here (systems/staffEvents.js) - every raid a frame runs. */
const allRaids = () => { const s = staffRaids(); return s.length ? [...state.raids, ...s] : state.raids; };

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
 *   standRaider(mobileType, at) a hostile foe placed 10-35 units off, just outside the view (FoeSpawner), or where a
 *                             staff event's pack asks (`at`: raidSpawnRange's, and its leader's feet) - a promise of
 *                             the foe record, null when no spot was found
 *   standDefender(threats)    one of the town's watch, the player's ally, sent at the nearest threat - a promise
 *   defenderCount()           the defenders standing and coming (cityGuards.defenderCount)
 *   defendersAllowed()        the watch would keep one here (no crime on the player, not a beast)
 *   removeFoe(foe)            Object.Destroy - gone, no corpse
 *   outOfSight(foe)           fix 6's test for a routed raider
 *   reputation()              {player, store} for GrantReputation
 *   say(line, id)             DaggerfallUI.AddHUDText - EVENTS1 (bible/10-UI/Event-Board.md, Ledger A): the event
 *                             board's news by default (systems/eventNotices.js), where the mod's line had stood on the
 *                             HUD's line (filed in the journal - and still, by the door's log); the board off, the
 *                             HUD's line again (hudText). `id` the raid's (`raid:<raidKey>`, AUDIT EVENTS1 A1)
 */
let _host = null;
export function setRaidingPartiesHost(host) { _host = host ?? null; }
const host = () => _host ?? {};
const rnd = () => host().random ?? Math.random;
const say = (line, raid = null) => { const id = raid ? `raid:${raidKey(raid)}` : null; (host().say ?? ((l, i) => eventNotice('raid', l, i)))(line, id); };
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
/** RAID3: the receipts the relay handed this player - key -> the receipt (net/raid/raidReceipt.js), RAID_RECEIPTS_KEPT at most. */
let _receipts = new Map();
export const RAID_RECEIPTS_KEPT = 32;
/** RAID3: my last word to the relay - { key, n, s, at } (at: the local clock). */
let _lastWord = null;

/** ScheduleNextSpawn [IL_0828]. */
function scheduleNextSpawn(type) {
  _nextSpawnIn = type === STAFF_RAID_TYPE ? rangeFloat(STAFF_SPAWN_INTERVAL_MIN_S, STAFF_SPAWN_INTERVAL_MAX_S, rnd()) : rangeFloat(SPAWN_INTERVAL_MIN_S, type === 2 ? ORC_SPAWN_INTERVAL_MAX_S : SPAWN_INTERVAL_MAX_S, rnd());
}
/** ScheduleNextDefender [IL_0852]. */
function scheduleNextDefender() {
  _nextDefenderIn = rangeFloat(SPAWN_INTERVAL_MIN_S, SPAWN_INTERVAL_MAX_S, rnd());
}
/** CancelPending [IL_14d4]: a spawn still in flight lands into nothing. */
function cancelPending() {
  if (_pending) _pending.cancelled = true;
  if (_pending?.boss) _pending.boss.bossFc = -1;   // BOSS-LOST: a boss given up on is called again (a late one is let go)
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
  for (const e of _live) if (e.key === key && (e.kind === 'raider' || e.kind === 'refugee')) e.routed = true;   // RAID5: and its refugees
}

const liveRaiders = (key) => _live.filter((e) => e.key === key && e.kind === 'raider' && !e.boss && !e.routed && !e.foe.dead && (e.foe.entity?.health ?? 1) > 0);
/** FIELD BUGS 2026-10-11g RAID-WORD: the raid on the map pixel I stand on that I fought (a death tallied, or a blow
 *  struck) - the word the relay credits from anywhere on the town's pixel, rect or not. */
function raidOnMyPixel(now) {
  const px = host().playerPixel?.();
  if (!px) return null;
  return state.raids.find((r) => raidActive(r, now) && r.px === px.x && r.py === px.y && (r.killed > 0 || r.struck)) ?? null;
}
/**
 * FIELD BUGS 2026-10-11g RAID-WORD: a jump's sweep (scenes/world.js `exteriorFoes.clearLive()` - a death's respawn, a
 * fast travel, Recall, /unstuck) empties the foe pool and marks no one dead, so every raider and defender it took stood
 * on here alive: the raid's 25 places held by nobody, and a player back in the town stood no raider for the rest of it -
 * the raid stalled short of its target and withdrew. They are let go here, a death not yet tallied kept for the tally.
 */
export function raidPoolCleared() {
  cancelPending();
  _live = _live.filter((e) => e.kind === 'raider' && e.foe.dead && !e.counted);
}
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
  const held = !raid.staff && raidHeld(raid);   // RAID5: read before the rout takes its objective's foes
  raid.cleansed = true;
  routRaid(raid);
  if (held) _held = [..._held.filter((k) => k !== raidKey(raid)), raidKey(raid)].slice(-RAID_HELD_KEPT);
  const px = host().playerPixel?.();
  if (raid.struck && px && px.x === raid.px && px.y === raid.py) {
    grantRaidReputation(host().reputation?.() ?? null, raid.regionIndex);
    if (held) grantRaidHeldReputation(host().reputation?.() ?? null, raid.regionIndex);   // RAID5: and a town held, more
    noteAct('raid-repelled');   // QL11: a raid driven off - one I fought, in the town as it was cleansed (a cleanse comes once a raid)
  }
  if (!said) return;
  const who = defendedLine(top, n);   // RAID3: the relay's cleanse names who held the town
  say(who ? `${cleansedLine(raid.locationName, regionName(raid.regionIndex), raid.type)} ${who}` : cleansedLine(raid.locationName, regionName(raid.regionIndex), raid.type), raid);
  if (held) say(raidHeldLine(raid.locationName), raid);   // RAID5
}

/** OnEnemyDeath, polled: each raider's death counts once, toward its raid while the raid is on; a blow of the
 *  player's on any of a raid's raiders marks the raid fought (fix 5). */
function tallyDeaths(now) {
  for (const e of _live) {
    if (e.kind === 'bearer' && e.foe.dead && e.foe.corpse && !e.counted) {   // RAID5: the Standard-Bearer KILLED (a walk-off is no fall)
      e.counted = true;
      const r = state.raids.find((x) => raidKey(x) === e.key);
      if (r && raidActive(r, now) && !r.cleansed) r.sacked = true;
    }
    if (e.kind !== 'raider') continue;
    if (!e.foe.raidTurned && !e.foe.dead && (e.foe.entity?.health ?? 1) < (e.foe.entity?.maxHealth ?? 1)) e.foe.raidTurned = true;   // AUDIT WORLD-EVENTS L6-5: struck, it fights who struck it (enemyTargets.js RAID_GOAL_PRIORITY's turn)
    const raid = allRaids().find((r) => raidKey(r) === e.key);
    if (raid && !raid.struck && renownStruckAt(e.foe) != null) raid.struck = true;
    if (!e.foe.dead || e.counted) continue;
    e.counted = true;
    if (!e.foe.corpse || !raid || !raidActive(raid, now)) continue;   // removed, not killed; or its raid is over
    if (e.boss) { raid.bossDown = 1; continue; }   // STAFF-EVENT: its mini boss fell - its own word, never a kill on the meter
    if (e.leader) { objOf(raid).leaderFell = objOf(raid).clock; raid.ld = true; }   // RAID5: its leader fell - none stood again until the count has heard; AUDIT WORLD-EVENTS L3-12: on the kind's own clock
    raid.killed++;
    if (raid.staff && renownStruckAt(e.foe) != null) raid.mine++;   // THE REWARD: one of mine I fought - my kill on the board
    if (!raid.staff && !raidRelayOn() && raidKillTotal(raid) >= raid.attackAmount) cleanse(raid);   // RAID3: at a raid relay, its cleanse alone; STAFF-EVENT: an event's end is the relay's
  }
}

/** CheckRaidActors [IL_09a0], every three seconds: a routed raider out of sight goes (fix 6); the dead are let go. */
function sweep() {
  const h = host();
  for (const e of _live) {
    if ((e.kind === 'raider' || e.kind === 'refugee') && e.routed && !e.foe.dead && (h.outOfSight?.(e.foe) ?? true)) h.removeFoe?.(e.foe);   // RAID5: a refugee safe, or its raid over, goes out of sight
    if (e.kind === 'raider' && !e.routed && !e.foe.dead && !e.foe.ai?.target) { const r = state.raids.find((x) => raidKey(x) === e.key); if (r) aimRaider(r, e.foe); }   // RAID5: an idle raider sent at its kind's objective again
  }
  _live = _live.filter((e) => !e.foe.dead || (e.kind === 'raider' && !e.counted) || (e.kind === 'refugee' && !e.done));   // RAID5: a refugee's fall is counted by its runner's next frame
}

/** SpawnRaidEnemy [IL_0764]: one foe in flight; a spot not found costs nothing but this tick (fix 10). */
function spawn(raid, kind, mobileType, o = undefined, pack = null) {
  const h = host();
  const p = { key: raidKey(raid), age: 0, cancelled: false, boss: kind === 'boss' ? raid : null };
  _pending = p;
  const threats = () => liveRaiders(p.key).map((e) => e.foe);
  const sites = h.sites?.() ?? null;   // RAID5: the town's square, its way, its bearer and its refugees (scenes/raidSitesHost.js)
  const promise = kind === 'defender' ? h.standDefender?.(threats()) : kind === 'bearer' ? sites?.standBearer(o) : kind === 'refugee' ? sites?.standRefugee(o.at, o.follow) : h.standRaider?.(mobileType, o);   // STAFF-EVENT PACKS: where, for a pack's
  const boss = kind === 'boss';   // STAFF-EVENT: a staff event's mini boss - one raider, promoted
  Promise.resolve(promise).then((foe) => {
    if (_pending === p) _pending = null;
    if (!foe) { if (boss) raid.bossFc = -1; if (pack && !pack.at) { pack.left++; pack.far = false; } return; }   // STAFF-EVENT: no spot - the call is answered again; a pack's leader tried again, nearer
    if (pack && !pack.at && Array.isArray(foe.ai?.feet)) pack.at = [...foe.ai.feet];   // STAFF-EVENT PACKS: its pack stands around it
    if (p.cancelled && kind !== 'defender') { h.removeFoe?.(foe); if (boss) raid.bossFc = -1; return; }
    if (boss) { promoteStaffBoss(foe.entity, { sizePct: raid.staff.bs, healthX: raid.staff.bh, hp: raid.staff.hp }); raid.bossUp = 1; raid.bossDown = 0; }
    if (kind === 'bearer' || kind === 'refugee') foe.raidGoal = p.key;   // AUDIT WORLD-EVENTS L6-5: its raiders' quarry first (enemyTargets.js), whatever infighting reads
    if (kind === 'bearer' && foe.entity && objOf(raid).share < 1) foe.entity.health = Math.max(1, Math.round(foe.entity.maxHealth * objOf(raid).share));   // AUDIT WORLD-EVENTS L4-6: raised again as he was let go - never a whole standard for a walk-off
    if (kind === 'leader') { promoteRaidLeader(foe.entity, { name: raidLeaderNameOf(foe.mobileType ?? mobileType) }); foe.entity.bossTraits = undefined; foe.entity.bossWard = undefined; giveBossTraits(foe.entity, rollBossTraits(RAID_LEADER_TRAITS, rnd())); }   // RAID5: the party's leader - an elite with two traits (AUDIT WORLD-EVENTS L2-6: its two in place of any its stand drew as an elite)
    const fights = boss || kind === 'leader' || kind === 'raider';
    if (!_live.some((e) => e.foe === foe)) _live.push({ foe, key: p.key, kind: fights ? 'raider' : kind, boss, leader: kind === 'leader', routed: false, counted: false });   // WATCH-LEAVES: a defender called back from his walk off is the one already held
    if (fights) { foe.raidKey = p.key; aimRaider(raid, foe); }   // RAID2: it rides my frame tagged with its raid; RAID5: sent at its kind's objective
  }, () => { if (_pending === p) _pending = null; if (boss) raid.bossFc = -1; });
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
  for (const f of h.ownRaidFoes?.() ?? []) if (!_live.some((e) => e.foe === f)) _live.push({ foe: f, key: f.raidKey, kind: 'raider', boss: tookStaffBoss(f), leader: !!f.entity?.raidLeader, routed: false, counted: false });   // AUDIT WORLD-EVENTS L3-5: a leader taken over is the leader
  const puppets = h.raidPuppets?.() ?? [];   // the fallen with them (THE REWARD)
  for (const pup of puppets) {
    if (pup.dead) continue;
    const r = allRaids().find((x) => raidKey(x) === pup._pupRaid);
    if (r && !r.struck && renownStruckAt(pup) != null) r.struck = true;
  }
  staffPuppetKills(puppets, now);
  tallyDeaths(now);
  const relay = raidRelayOn();
  for (const r of state.raids) if (!relay && raidActive(r, now) && raidKillTotal(r) >= r.attackAmount) cleanse(r);   // RAID2: the owners' shares summed; RAID3: at a raid relay, its cleanse alone
  if (_sweepIn <= 0) { _sweepIn = ACTOR_SWEEP_S; sweep(); }
  for (const r of staffRaidsEnded()) { r.routed = true; routRaid(r); if (r.announced) say(staffEndLine(r), r); }   // STAFF-EVENT: an event the hub ended - its monsters stand down out of sight

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
      say(attackLine(r.locationName, regionName(region), r.type), r);
    }
  }
  // STAFF-EVENT: an event in my region, said once
  if (region >= 0) for (const r of staffRaids()) if (r.regionIndex === region && !r.announced) { r.announced = true; say(staffAttackLine(r), r); }
  // F. is the player standing in a raid [IL_0de4]? STAFF-EVENT: in a staff event first - a town's, as a raid's; an
  // area's, outdoors on its pixel (the host's `townHere(true)`: outdoors at all)
  const town = h.townHere?.() ?? null;
  const raid = staffRaidHere(town, h.playerPixel?.() ?? null, !!h.townHere?.(true)) ?? (town ? state.raids.find((r) => raidActive(r, now) && r.regionIndex === town.regionIndex && r.locationIndex === town.locationIndex) : null);
  if (raid?.staff && staffBossToSay(raid) >= 0) say(staffBossLine(raid), raid);
  // RAID3: my word to the town's ledger, whoever runs the raid. FIELD BUGS 2026-10-11g RAID-WORD ("Doesn't register raid
  // 20%ish of the time"): the relay credits a word said from the town's PIXEL (server/src/index.js _raidWord's `here`,
  // the mod's own reward test), and the rect is narrower - a hamlet's ~300 m in an 819 m pixel. A fight that drifted past
  // the rect tallied its deaths here and never said them: the town's count stood short of its target, nothing was
  // cleansed, and the raid withdrew. Past the rect, on the pixel, a raid I fought is still said; it stands no one there.
  const said = raid ?? (relay ? raidOnMyPixel(now) : null);
  if (said?.staff) sayToCell(said);   // STAFF-EVENT: its cell keeps its meter
  else if (relay && said) sayToRelay(said);
  if (!raid) { cancelPending(); for (const key of _myClaims.keys()) letGoAllies(key); _myClaims.clear(); return 'idle'; }   // AUDIT WORLD-EVENTS L4-9: the bearer and refugees go with the claim
  if (!raid.staff) sayObjective(raid, objNow(raid));   // RAID5: its waves, its standard, its refugees - said on every machine in the town
  // RAID2: online, the one who runs it stands its foes - every other player here stands them as puppets
  if (sharedClockOn() && !runsRaid(raid)) { cancelPending(); letGoAllies(raidKey(raid)); return 'standing-by'; }   // AUDIT WORLD-EVENTS L4-9: another runs it - mine stand down, the runner stands its own
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
  // STAFF-EVENT: its mini boss, once the cell calls it - before any raider, and no defenders (staff set the fight)
  if (raid.staff) {
    const fc = staffBossWanted(raid);
    const waits = fc >= 0 && !staffBossByHand(raid) && !staffFieldClear(raid, h) && !staffClearLong(raid, localNow());   // BOSS-CLEAR: the meter's boss once every monster standing at its call is dead - the packs come on meanwhile
    if (fc >= 0 && !waits) { raid.bossFc = fc; raid.handSeen = raid.staff.fb ?? 0; raid.clearSince = undefined; raid.clearWait = undefined; spawn(raid, 'boss', raid.staff.b, staffBossPlace()); return 'boss'; }
    const lost = staffBossLost(raid, staffBossStanding(raid, h), localNow());   // BOSS-LOST: stood, then gone without falling
    if (lost >= 0) { raid.bossFc = lost; spawn(raid, 'boss', raid.staff.b, staffBossPlace()); return 'boss'; }
  }
  // H. a defender first [IL_06d1-IL_0712]; the clock is rescheduled even at the cap
  if (!raid.staff && _nextDefenderIn <= 0) {
    scheduleNextDefender();
    if (h.defendersAllowed?.() !== false && (h.defenderCount?.() ?? 0) < MAX_RAID_DEFENDERS) {
      spawn(raid, 'defender');
      return 'defender';
    }
  }
  // RAID5: a raid of a kind stands its raiders its own way (null: the town has no square or way for it - the mod's)
  if (!raid.staff && kindOf(raid) !== 'classic') {
    if (!(dt > 0)) return 'idle';   // AUDIT WORLD-EVENTS L3-12: a paused frame stands no bearer, refugee or pack - fix 7's law
    adoptObjective(raid);
    const k = kindStep(raid, dt);
    if (k) return k;
  }
  // I. a raider [IL_0712-IL_0760]
  if (_nextSpawnIn <= 0) {
    if (raid.staff) return staffPackStep(raid, liveRaiders(raidKey(raid)).length);   // STAFF-EVENT PACKS
    scheduleNextSpawn(raid.type);
    const standing = liveRaiders(raidKey(raid)).length;
    if (standing < MAX_RAID_ENEMIES) {
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
    if (!r.cleansed && r.announced && region >= 0 && r.regionIndex === region) say(withdrawnLine(r.locationName, regionName(r.regionIndex)), r);
    routRaid(r);
    state.raids.splice(i, 1);
    _peerWords.delete(raidKey(r)); _unclaimedSince.delete(raidKey(r)); _relay.delete(raidKey(r));   // RAID2: its words go with it; RAID3: and the relay's
    _peerObj.delete(raidKey(r));   // RAID5: and its objective's
  }
}

// ---- RAID5: the raid's kind (systems/raidKinds.js) ------------------------------------------------------------------
/** A raid's kind, read once off its tuple (never saved: the tuple is) - the mod's raid on a host with no town's sites
 *  to stand a kind at. */
export const kindOf = (raid) => (raid.kind ??= raid.staff || host().sites ? raidKindOf(raid) : 'classic');
/** The town's count of a raid's deaths: the relay's ledger where it keeps one, else the owners' sum (RAID2). */
const townKills = (raid) => Math.max(raidKillTotal(raid), _relay.get(raidKey(raid))?.n ?? 0);
/** A raid's objective as this machine runs it (runtime - the parts a save keeps are the raid's own `sacked`, `safe`,
 *  `lost`, `ld` and `wv`). AUDIT WORLD-EVENTS L3-12: `clock` the kind's own time (s), run on the frame's dt - a pause holds
 *  it, where the wall clock ran a breather out behind an open menu. */
const objOf = (raid) => (raid.obj ??= { wave: -1, said: -1, breather: 0, leaderFell: -Infinity, post: undefined, way: undefined, len: 0, guide: 0, trail: null, trailAt: -1, clock: 0, stall: 0, stallK: -1, share: 1, siteAt: -Infinity });
/** RAID5: every runner's word on its raids' objectives (`ro`) - key -> { from, k, a, b, at }, the freshest kept. */
let _peerObj = new Map();
/** RAID5: the raids held - their keys, the newest RAID_HELD_KEPT (saved: a town's thanks are rolled when the account
 *  service answers, perhaps after a load). */
let _held = [];
export const RAID_HELD_KEPT = 16;
/** Was this raid's town held (its objective kept to the cleanse)? A town's thanks are more for it (systems/raidSpoils.js). */
export const raidWasHeld = (key) => _held.includes(key);
/** AUDIT WORLD-EVENTS L3-14: is this raid's town held now - its cleanse's word, or (a receipt that came before it) its
 *  objective as it stands - for the receipt to carry to the character that fought it. */
export const raidHeldFor = (key) => _held.includes(key) || (() => { const r = raidByKey(key); return !!r && !r.staff && raidHeld(r); })();

/** The raid's objective as a word: [kind's index, a, b] - the assault its wave said and whether its leader fell, the
 *  standard its bearer's health (per cent) and whether it fell, the exodus its saved and its lost; null for a classic raid. */
function objWordOf(raid) {
  const kind = kindOf(raid), k = RAID_KIND_ORDER.indexOf(kind), o = objOf(raid);
  if (kind === 'waves') return o.said >= 0 ? [k, o.said, raid.ld ? 1 : 0] : null;   // none until its first wave is said; its leader's fall the third
  if (kind === 'defend') {
    const b = _live.find((e) => e.key === raidKey(raid) && e.kind === 'bearer' && !e.foe.dead);
    if (!b && !raid.sacked && !o.post) return null;   // no standard raised here (yet, or no square)
    const pct = b ? Math.round((100 * Math.max(0, b.foe.entity?.health ?? 0)) / Math.max(1, b.foe.entity?.maxHealth ?? 1)) : (raid.sacked ? 0 : Math.round(100 * o.share));   // AUDIT WORLD-EVENTS L4-6: one let go, as he was
    return [k, Math.max(0, Math.min(100, pct)), raid.sacked ? 1 : 0];
  }
  if (kind === 'escort') return o.way || raid.safe || raid.lost ? [k, Math.min(raid.safe | 0, RAID_OBJ_WORD_MAX), Math.min(raid.lost | 0, RAID_OBJ_WORD_MAX)] : null;
  return null;
}
/** The word's ceiling on a count (world/raidShared.js RAID_OBJ_MAX). */
const RAID_OBJ_WORD_MAX = 100;
/** RAID5: one frame of a raid's kind, for the one who runs it - the section's word, or null where the town has no
 *  square or way for it (the mod's raid stands instead). */
function kindStep(raid, dt) {
  const kind = kindOf(raid);
  objOf(raid).clock += dt;
  if (kind === 'waves') return wavesStep(raid, dt);
  if (kind === 'defend') return defendStep(raid);
  if (kind === 'escort') return escortStep(raid, dt);
  return null;
}
/** RAID5: a raid's objective in the board's words ('' for none - a classic raid, or one nobody here runs). */
function objDetail(r) {
  const kind = kindOf(r);
  if (r.staff || kind === 'classic') return '';
  const w = objNow(r);
  if (!w) return '';
  if (kind === 'waves') return raidObjectiveDetail(kind, { wave: w[1], of: (r.plan ??= raidWavePlan(r.attackAmount)).sizes.length });
  if (kind === 'defend') return raidObjectiveDetail(kind, { pct: w[1], fallen: w[2] === 1 });
  return raidObjectiveDetail(kind, { safe: w[1], lost: w[2], of: RAID_REFUGEES });
}
/** RAID5: a town HELD - its leader felled, its standard standing, most of its refugees saved - pays the region's legal
 *  reputation and its People RAID_HELD_REP more, beside GrantReputation's own (its clamp, its door). */
export const RAID_HELD_REP = 3;
export function grantRaidHeldReputation(ctx, region) {
  const player = ctx?.player, store = ctx?.store;
  if (!player || !store?.dict) return false;
  const rep = legalRepOf(player, region);
  changeLegalRep(player, region, Math.min(LEGAL_REP_MAX, Math.max(LEGAL_REP_MIN, rep + RAID_HELD_REP)) - rep, { kind: 'raid' });
  const people = findFactionByTypeAndRegion(store.dict, FACTION_TYPES.People, region);
  if (people && people.region === region) changeReputation(store, people.id, RAID_HELD_REP, false);
  return true;
}
/** The objective's state on this machine: mine where I run it, else the freshest runner's word - AUDIT WORLD-EVENTS
 *  L3-13: while it is fresh (RAID_WORD_STALE_MS; a word from a runner gone stood on the board for the rest of the raid). */
function objNow(raid) {
  const key = raidKey(raid);
  if (_myClaims.has(key) || !sharedClockOn()) return objWordOf(raid);
  const p = _peerObj.get(key);
  return p && localNow() - p.at <= RAID_WORD_STALE_MS ? [p.k, p.a, p.b] : null;
}
/** The objective's lines, said once each on every machine in the town - the runner's own, a reader's off the word.
 *  AUDIT WORLD-EVENTS L3-13: off the high-water mark of what was said (`ow`, saved - L3-11), so two runners' words
 *  crossing in a claim race say no line twice. */
function sayObjective(raid, w) {
  if (!w) return;
  if (!raid.asked) { raid.asked = true; const ask = raidKindAsk(RAID_KIND_ORDER[w[0]], raid.locationName); if (ask) say(ask, raid); }   // what the town asks, once its objective stands (a town with no square or way is the mod's raid)
  const was = raid.ow ?? [-1, -1, -1];
  const kind = RAID_KIND_ORDER[w[0]], town = raid.locationName;
  if (kind === 'waves' && w[1] > was[1]) {
    const plan = raid.plan ??= raidWavePlan(raid.attackAmount);
    say(w[1] < plan.sizes.length ? raidWaveLine(w[1] + 1, plan.sizes.length, town) : raidLeaderLine(raidLeaderName(raid.type), town), raid);
  }
  if (kind === 'defend' && w[2] === 1 && was[2] !== 1) say(raidBearerFellLine(town), raid);
  if (kind === 'escort') {
    for (let n = Math.max(0, was[1]) + 1; n <= w[1]; n++) say(raidRefugeeSafeLine(n, RAID_REFUGEES), raid);
    if (w[2] > Math.max(0, was[2])) say(raidRefugeeLostLine(), raid);
  }
  raid.ow = [w[0], Math.max(was[1], w[1]), Math.max(was[2], w[2])];
}
/** AUDIT WORLD-EVENTS L3-4: a runner whose claim is new takes up what the raid's runners said - the leader's fall (its
 *  wait on this machine's clock) and the standard as it was left; the rest is folded into the raid as it is heard
 *  (foldObjective), so it only moves one way. Each claim once (a runner that ran it before took nothing up again). */
function adoptObjective(raid) {
  const at = _myClaims.get(raidKey(raid));
  if (raid.adoptedAt === at) return;
  raid.adoptedAt = at;
  const o = objOf(raid), p = _peerObj.get(raidKey(raid));
  if (raid.ld) o.leaderFell = o.clock;
  if (kindOf(raid) === 'defend' && p && p.b !== 1) o.share = Math.min(o.share, p.a / 100);
}
/** AUDIT WORLD-EVENTS L3-4/L3-6: a runner's word, folded into the raid as it is heard - the leader's fall, the wave
 *  reached, the standard sacked (or seen standing), the refugees saved and lost: each the most heard, never back. */
function foldObjective(raid, w, t) {
  const kind = kindOf(raid);
  if (kind === 'waves') { raid.wv = Math.max(raid.wv ?? -1, w.a); if (w.b === 1) raid.ld = true; }
  if (kind === 'defend') { if (w.b === 1) raid.sacked = true; else raid.stAt = t; }
  if (kind === 'escort') { raid.safe = Math.max(raid.safe | 0, w.a); raid.lost = Math.max(raid.lost | 0, w.b); }
}
/** AUDIT WORLD-EVENTS L3-8: how long a standard last seen standing - by its runner, or in a runner's word - still holds the
 *  town at its cleanse (the runner stepped into a tavern as the relay's cleanse came). */
export const RAID_STANDARD_FRESH_MS = 60000;
/** Was the town held: its leader felled, its standard standing, most of its refugees saved. AUDIT WORLD-EVENTS L3-6/L3-8:
 *  off the raid's own folded state, never the word in hand alone - an assault whose word had reached its leader's charge
 *  is held at its cleanse (the runner's last word raced the relay's cleanse); a standard seen standing in the last
 *  RAID_STANDARD_FRESH_MS holds. */
export function raidHeld(raid) {
  const kind = kindOf(raid);
  if (kind === 'waves') return !!raid.ld || objOf(raid).leaderFell > -Infinity || (raid.wv ?? -1) >= (raid.plan ??= raidWavePlan(raid.attackAmount)).sizes.length;
  if (kind === 'defend') return !raid.sacked && raid.stAt != null && localNow() - raid.stAt <= RAID_STANDARD_FRESH_MS;
  if (kind === 'escort') return (raid.safe | 0) >= RAID_REFUGEES_HOLD;
  return false;
}
/** AUDIT WORLD-EVENTS L4-9: the bearer and the refugees I stood for a raid I no longer run go - a bearer walks off, a
 *  refugee is let go - and the next runner stands its own (none of them is handed to an heir). Online alone: offline
 *  there is no other runner, and they wait for me where they stand. */
function letGoAllies(key) {
  if (!sharedClockOn()) return;
  const h = host(), sites = h.sites?.() ?? null;
  for (const e of _live) {
    if (e.key !== key || (e.kind !== 'bearer' && e.kind !== 'refugee') || e.foe.dead || e.done) continue;
    if (e.kind === 'bearer') sites?.releaseBearer?.(e.foe); else h.removeFoe?.(e.foe);
    e.gone = true;
  }
  _live = _live.filter((e) => !e.gone);
}

/** One of a kind's packs (the assault's, the standard's, the exodus's): up to `room` raiders, `min` to `max` at once,
 *  `gapS` between - its leader stood about `near` (a point, or the next player in the town - PACK-SPREAD's turn), its
 *  pack about its leader. Answers the section's word. */
function kindPackStep(raid, room, min, max, gapS, near = undefined) {
  const key = raidKey(raid);
  if (_pack && (_pack.key !== key || _pack.left <= 0)) _pack = null;
  if (room <= 0) { _pack = null; _nextSpawnIn = 1; return 'idle'; }
  if (!_pack) { const size = Math.min(room, rangeInt(min, max + 1, rnd())); _pack = { key, left: size, size, at: null, far: true, near: near ?? staffPackPlayer()?.slice() ?? null, kind: true }; }   // AUDIT WORLD-EVENTS L4-7: its own point (the origin's shift moves it)
  const pack = _pack;
  pack.left--;
  const o = pack.at ? { at: pack.at, min: 1.5, max: STAFF_PACK_NEAR, los: false } : { min: RAID_SPAWN_MIN_DISTANCE, max: STAFF_PACK_FAR_MAX / 2, los: false, near: pack.near };
  _nextSpawnIn = pack.left > 0 ? STAFF_PACK_STEP_S : gapS;
  spawn(raid, 'raider', chooseRaider(raid.type, rnd()), o, pack);
  return 'raider';
}

/** THE ASSAULT: the waves, a breather between, and the leader alone at the last. AUDIT WORLD-EVENTS L3-7: at a raid
 *  relay, nothing stands before its ledger is heard (a late-comer stood its first pack off its own count of none), and
 *  the leader only into an empty field; L3-10: a wave whose count has not moved in RAID_WAVE_STALL_S stands again past
 *  those it cannot reach. */
function wavesStep(raid, dt) {
  const key = raidKey(raid), o = objOf(raid), plan = raid.plan ??= raidWavePlan(raid.attackAmount), t = o.clock;
  if (raidRelayOn() && !_relay.has(key)) return 'idle';
  const kills = townKills(raid), at = raidWaveAt(plan, kills);
  if (kills !== o.stallK) { o.stallK = kills; o.stall = 0; } else o.stall += dt;
  const stalled = o.stall >= RAID_WAVE_STALL_S;
  if (at.wave !== o.wave) { if (o.wave >= 0) o.breather = t + RAID_WAVE_BREATHER_S; o.wave = at.wave; _pack = null; }
  if (t < o.breather) return 'idle';
  o.said = o.wave;
  raid.wv = Math.max(raid.wv ?? -1, o.wave);
  const puppets = (host().raidPuppets?.() ?? []).filter((p) => p._pupRaid === key && !p.dead);
  if (at.wave >= plan.sizes.length) {   // the leader alone
    if (at.left <= 0 || _nextSpawnIn > 0 || t - o.leaderFell < RAID_LEADER_AGAIN_S) return 'idle';
    if (_live.some((e) => e.key === key && e.leader && !e.foe.dead) || puppets.some((p) => p.entity?.raidLeader)) return 'idle';
    if (!stalled && (liveRaiders(key).length || puppets.length)) return 'idle';   // into an empty field
    _nextSpawnIn = RAID_WAVE_PACK_GAP_S; o.stall = 0;
    spawn(raid, 'leader', raidLeaderOf(raid.type), { ...(staffBossPlace() ?? {}), min: RAID_SPAWN_MAX_DISTANCE / 2, max: RAID_SPAWN_MAX_DISTANCE, los: false });
    return 'leader';
  }
  if (_nextSpawnIn > 0) return 'idle';
  const standing = liveRaiders(key).length;
  const room = stalled ? Math.min(at.left, RAID_WAVE_PACK_MAX, MAX_RAID_ENEMIES - standing) : Math.min(at.left, MAX_RAID_ENEMIES) - standing - puppets.length;
  const k = kindPackStep(raid, room, RAID_WAVE_PACK_MIN, RAID_WAVE_PACK_MAX, RAID_WAVE_PACK_GAP_S);
  if (k === 'raider' && stalled) o.stall = 0;
  return k;
}

/** AUDIT WORLD-EVENTS L4-4: a kind's site (the square, the way) asked of the town - found once and kept, a null asked
 *  again RAID_SITE_AGAIN_S on (the town not built yet about the player, the player still on the road). */
function siteOf(o, field, ask) {
  if (o[field] === undefined || (o[field] === null && o.clock >= o.siteAt)) {
    o[field] = ask() ?? null;
    if (!o[field]) o.siteAt = o.clock + RAID_SITE_AGAIN_S;
  }
  return o[field];
}
/** THE STANDARD: the bearer held at the square, the raiders marching on him in packs. Null where the town has no square
 *  (the classic raid instead). */
function defendStep(raid) {
  const key = raidKey(raid), o = objOf(raid), h = host();
  if (!siteOf(o, 'post', () => h.sites?.()?.square(raid))) return null;
  const b = _live.find((e) => e.key === key && e.kind === 'bearer');
  if (b && !b.foe.dead && b.foe.entity) { o.share = Math.max(0, b.foe.entity.health) / Math.max(1, b.foe.entity.maxHealth); raid.stAt = localNow(); }   // AUDIT WORLD-EVENTS L3-8/L4-6: seen standing, and as he stands
  if (!raid.sacked && !b) { spawn(raid, 'bearer', null, o.post); return 'bearer'; }
  if (_nextSpawnIn > 0) return 'idle';
  return kindPackStep(raid, Math.min(RAID_DEFEND_PACK_MAX, MAX_RAID_ENEMIES - liveRaiders(key).length), 2, RAID_DEFEND_PACK_MAX, RAID_DEFEND_PACK_GAP_S, alongSquare(o.post));
}
/** Where the standard's packs come from: a point about the square, RAID_DEFEND_FROM_M out on a bearing of the roll. */
const alongSquare = (post) => { const a = rnd()() * Math.PI * 2; return [post[0] + Math.sin(a) * RAID_DEFEND_FROM_M, post[1], post[2] + Math.cos(a) * RAID_DEFEND_FROM_M]; };

/** THE EXODUS: the refugees stood at the way's start, walked behind its guide, counted as they arrive or fall; the
 *  raiders in packs ahead of them. Null where the town has no way, and once every refugee is safe or fallen (the
 *  classic raid instead). */
function escortStep(raid, dt) {
  const key = raidKey(raid), o = objOf(raid), h = host();
  if (!siteOf(o, 'way', () => h.sites?.()?.way(raidSideOf(raid), raid))) return null;
  if (!o.len) o.len = wayLength(o.way);
  if (o.way.length < 2) return null;
  const end = o.way[o.way.length - 1];
  const walkers = _live.filter((e) => e.key === key && e.kind === 'refugee' && !e.done);
  for (const e of walkers) {
    const f = e.foe.ai?.feet;
    if (e.foe.dead) { e.done = true; if (e.foe.corpse) raid.lost = (raid.lost | 0) + 1; }   // AUDIT WORLD-EVENTS L4-2: KILLED - one let go with no body (a pool's sweep) is stood again
    else if (f && Math.hypot(f[0] - end[0], f[2] - end[2]) <= RAID_REFUGEE_SAFE_M) { e.done = true; e.routed = true; raid.safe = (raid.safe | 0) + 1; }
  }
  const alive = walkers.filter((e) => !e.done);
  const still = RAID_REFUGEES - (raid.safe | 0) - (raid.lost | 0) - alive.length;
  if (alive.length && still <= 0) {   // AUDIT WORLD-EVENTS L4-9: the guide sets off once they all stand
    const g = alongWay(o.way, o.guide);
    const lag = Math.min(...alive.map((e) => (e.foe.ai?.feet ? Math.hypot(e.foe.ai.feet[0] - g[0], e.foe.ai.feet[2] - g[2]) : Infinity)));
    if (lag <= RAID_REFUGEE_WAIT_M) o.guide = Math.min(o.len, o.guide + RAID_REFUGEE_PACE * dt);
  }
  if (still > 0 && !_pending) {
    const i = RAID_REFUGEES - still;
    o.guide = Math.max(o.guide, Math.min(o.len, 2 + (RAID_REFUGEES - 1) * RAID_REFUGEE_GAP_M));   // AUDIT WORLD-EVENTS L4-9: room behind the guide for the last of them
    spawn(raid, 'refugee', null, { at: alongWay(o.way, Math.max(0, o.guide - 2 - i * RAID_REFUGEE_GAP_M)), follow: refugeeFollow(o, i) });   // AUDIT WORLD-EVENTS L4-9: each a pace behind the one before, never all on one point
    return 'refugee';
  }
  if (!alive.length && still <= 0) return null;   // the exodus over, every refugee safe or fallen: the rest of the raid is the mod's
  if (_nextSpawnIn > 0 || !alive.length) return 'idle';
  return kindPackStep(raid, Math.min(RAID_ESCORT_PACK_MAX, MAX_RAID_ENEMIES - liveRaiders(key).length), 2, RAID_ESCORT_PACK_MAX, RAID_ESCORT_PACK_GAP_S, alongWay(o.way, o.guide + RAID_ESCORT_AHEAD_M));
}
/** A refugee's `follow` (characters/enemy/enemyMotor.js): its guide on the way, a step behind the one before it, and the
 *  way walked so far as the trail it keeps to. */
function refugeeFollow(o, i) {
  return {
    feet: () => alongWay(o.way, o.guide),
    stop: 1.2 + i * 0.9,
    leash: 3,
    trail: () => {
      if (o.trailAt !== o.guide) { o.trailAt = o.guide; o.trail = wayTo(o.way, o.guide); }
      return o.trail;
    },
  };
}
/** The way's points up to `s` metres along it, the point there last. */
function wayTo(pts, s) {
  const out = [pts[0]];
  let left = s;
  for (let i = 1; i < pts.length && left > 0; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
    if (left >= d) { out.push(pts[i]); left -= d; } else { out.push(alongWay(pts, s)); left = 0; }
  }
  return out;
}
/** The side of the town its refugees come from - the raid's own (every machine the same). */
const raidSideOf = (raid) => (raid.startMinute + raid.attackAmount + raid.locationIndex) % 4;

/** AUDIT WORLD-EVENTS L4-7: the floating origin moved - every scene point a raid's kind holds moves with the land (its
 *  square, its refugees' way, its pack's place; the bearer's post and the refugees' guide are read off them). */
export function raidOffsetAll(d) {
  const shift = (p) => { if (Array.isArray(p)) { p[0] += d[0]; p[1] += d[1]; p[2] += d[2]; } };
  for (const r of state.raids) {
    const o = r.obj;
    if (!o) continue;
    shift(o.post);
    if (Array.isArray(o.way)) for (const p of o.way) shift(p);
    o.trail = null; o.trailAt = -1;
  }
  if (_pack?.kind) { shift(_pack.at); shift(_pack.near); }
}

/** Aim a raider at the objective its kind sets: the standard's bearer, or one of the walking refugees. */
function aimRaider(raid, foe) {
  const key = raidKey(raid), kind = kindOf(raid);
  const goal = kind === 'defend' ? _live.find((e) => e.key === key && e.kind === 'bearer' && !e.foe.dead)?.foe
    : kind === 'escort' ? (() => { const a = _live.filter((e) => e.key === key && e.kind === 'refugee' && !e.done && !e.foe.dead); return a.length ? a[Math.floor(rnd()() * a.length)].foe : null; })() : null;
  if (goal?.ai?.feet && foe?.ai?.makeEnemyHostileToAttacker) foe.ai.makeEnemyHostileToAttacker(goal, goal.ai.feet, RAID_AIM_TICKS);
}

/** RAID5: my word on the objectives of the raids I run, for my frame (`ro`): [[key, kind, a, b]], at most RAID_WORDS_MAX. */
export function raidObjWord() {
  const now = (host().now ?? worldMinutes)();
  const out = [];
  for (const r of state.raids) {
    if (out.length >= RAID_WORDS_MAX) break;
    if (!raidActive(r, now) || !_myClaims.has(raidKey(r))) continue;
    const w = objWordOf(r);
    if (w) out.push([raidKey(r), ...w]);
  }
  return out.length ? out : null;
}
/** RAID5: a peer's word on the objectives of the raids it runs (`ro`, validated here) - the freshest kept, and folded
 *  into the raid (foldObjective). AUDIT WORLD-EVENTS L3-9: a word of another kind than the raid's own is no word of it. */
export function raidObjPeerWord(from, raw, t = localNow()) {
  if (typeof from !== 'string' || !from) return 0;
  let n = 0;
  for (const w of validRaidObjWords(raw)) {
    const raid = raidByKey(w.key);
    if (!raid || raid.staff || RAID_KIND_ORDER[w.k] !== kindOf(raid)) continue;
    _peerObj.set(w.key, { from, k: w.k, a: w.a, b: w.b, at: t });
    foldObjective(raid, w, t);
    n++;
  }
  return n;
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
export function raidPeerWord(from, raw, t = localNow(), ro = undefined) {
  if (typeof from !== 'string' || !from) return 0;
  if (ro !== undefined) raidObjPeerWord(from, ro, t);   // RAID5: and its word on the objectives it runs
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
  for (const r of allRaids()) {   // STAFF-EVENT: an event's runner is elected by the same words
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
  if (f.k === 'sev') return staffRelayWord(f.sev, room);   // STAFF-EVENT: the hub's book and ends, a cell's ledger
  if (f.k === 'rc') {
    const c = readRaidReceipt(f.r);
    if (!c || _receipts.get(c.w) === f.r) return false;
    _receipts.delete(c.w);
    _receipts.set(c.w, f.r);
    while (_receipts.size > RAID_RECEIPTS_KEPT) _receipts.delete(_receipts.keys().next().value);
    host().onRaidReceipt?.(f.r, c, raidHeldFor(c.w));   // RAID4 carries it to the account service and rolls the spoils off its seed; AUDIT WORLD-EVENTS L3-14: and whether its town was held, for the character that fought
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

// ---- STAFF-EVENT: a staff event run as a raid (systems/staffEvents.js, net/staffEvent/staffEventLaw.js) ----------------
/** The party word a staff event's raid carries for its spawn clock. */
export const STAFF_RAID_TYPE = 9;   // no party of the mod's (0-2), and never the day roll's first clock (-1)
/** A staff event stands its monsters faster than a raid's one to ten seconds - it is up to 500 of them, staged now. */
export const STAFF_SPAWN_INTERVAL_MIN_S = 0.5;
export const STAFF_SPAWN_INTERVAL_MAX_S = 2;
/**
 * STAFF-EVENT PACKS (2026-10-25, mob: "when we do a raid spawn they need to be spread all over not a SINGLE SPAWN POINT
 * ... SHOULD DO PACK SPAWNING", "3-5 per pack of the monster chosen trhis need to feel like a take over", "and packs
 * quickly to the 25 cap", "it can be pack of any of the selected monsterts"): a staff event stands its monsters in PACKS of
 * STAFF_PACK_MIN to STAFF_PACK_MAX, each one any of staff's kinds -
 * a leader anywhere around me (any bearing, STAFF_PACK_FAR_MIN to STAFF_PACK_FAR_MAX off, in front of me too), its pack
 * within STAFF_PACK_NEAR of it, STAFF_PACK_STEP_S apart - and the next pack after a gap paced so the event stands its
 * MAX_RAID_ENEMIES in STAFF_PACK_FILL_MIN_S to STAFF_PACK_FILL_MAX_S (mob 2026-10-25: "make it take 120-45 secdon for a
 * pack to full hit 25", then "20-45" - the event's own pace, rolled once, each gap its pack's share of it). A leader with no spot that far is tried nearer (a narrow street) - never lost. A
 * town raid keeps the mod's one foe at a time just out of view.
 */
export const STAFF_PACK_MIN = 3;
export const STAFF_PACK_MAX = 5;
export const STAFF_PACK_FAR_MIN = 20;
export const STAFF_PACK_FAR_MAX = 60;
export const STAFF_PACK_NEAR = 6;
export const STAFF_PACK_STEP_S = 0.15;
export const STAFF_PACK_FILL_MIN_S = 20;
export const STAFF_PACK_FILL_MAX_S = 45;
/** A pack's gap after it: its share of the event's pace (`paceS`). The first pack comes at once, so the cap stands when
 *  all but its last pack - 1 to 5, the cap cutting it short - have had their gaps. @param {number} paceS @param {number} size */
export const staffPackGapS = (paceS, size) => paceS * size / (MAX_RAID_ENEMIES - 1);
/** The wait after a pack's last: its gap less the steps its pack already took. @param {number} paceS @param {number} size */
const packWaitS = (paceS, size) => Math.max(STAFF_PACK_STEP_S, staffPackGapS(paceS, size) - STAFF_PACK_STEP_S * (size - 1));
/** The event's pace, rolled once: a last pack of STAFF_PACK_MAX stands the cap at its least, of one at its most. @param {() => number} roll */
export const staffPackPaceS = (roll) => rangeFloat(STAFF_PACK_FILL_MIN_S * (MAX_RAID_ENEMIES - 1) / (MAX_RAID_ENEMIES - STAFF_PACK_MAX), STAFF_PACK_FILL_MAX_S, roll);
/** The pack standing now: `{ key, left, size, at, far }` - its raid, how many more, how many in all, its leader's feet, whether its leader is sought far. */
let _pack = null;
/** One step of a staff event's packs (section I's, the clock run out). @param {any} raid @param {number} standing */
function staffPackStep(raid, standing) {
  const key = raidKey(raid);
  if (_pack && (_pack.key !== key || _pack.left <= 0)) _pack = null;
  const sc = staffPackScale(host().peerFeetInTown?.()?.length ?? 1);   // PACK-SCALE: the players here
  if (!staffRaidRoom(raid, standing, sc.cap)) { _pack = null; scheduleNextSpawn(raid.type); return 'idle'; }
  raid.fillS ??= staffPackPaceS(rnd());   // the event's pace, once
  if (!_pack) { const size = rangeInt(STAFF_PACK_MIN, STAFF_PACK_MAX + 1, rnd()); _pack = { key, left: size, size, at: null, far: true, near: staffPackPlayer() }; }
  const pack = _pack;
  pack.left--;
  const o = pack.at ? { at: pack.at, min: 1.5, max: STAFF_PACK_NEAR, los: false }
    : pack.far ? { min: STAFF_PACK_FAR_MIN, max: STAFF_PACK_FAR_MAX, los: false, near: pack.near } : { min: RAID_SPAWN_MIN_DISTANCE, max: RAID_SPAWN_MAX_DISTANCE, los: false, near: pack.near };
  _nextSpawnIn = pack.left > 0 ? STAFF_PACK_STEP_S : packWaitS(raid.fillS / sc.speed, pack.size);
  spawn(raid, 'raider', staffRaider(raid, rnd()), o, pack);   // any of staff's kinds, each one
  return 'raider';
}
/**
 * PACK-SCALE (2026-10-25, mob: "they arnt spawn ing quick enough", card "Scale with players in town"): an event's packs
 * by the players in its place (me counted) - one alone as ever (MAX_RAID_ENEMIES standing, the event's pace); each more
 * player STAFF_PACK_CAP_PER more standing, to STAFF_PACK_CAP_MAX, and the pace a quarter quicker, to twice. Pure.
 * @param {number} players @returns {{ cap: number, speed: number }}
 */
export function staffPackScale(players) {
  const more = Math.max(0, (Number.isFinite(players) ? Math.floor(players) : 1) - 1);
  return { cap: Math.min(STAFF_PACK_CAP_MAX, MAX_RAID_ENEMIES + STAFF_PACK_CAP_PER * more), speed: Math.min(2, 1 + 0.25 * more) };
}
/** PACK-SCALE: the most an event stands at once however many play (a reader stands as many: world/raidShared.js RAID_PUPPETS_MAX). */
export const STAFF_PACK_CAP_MAX = 40;
/** PACK-SCALE: the more standing each player past the first brings. */
export const STAFF_PACK_CAP_PER = 5;
/**
 * PACK-SPREAD (mob 2026-10-25: "make sure we spread spawn all over the citys player not just the bottom left", "evenly
 * swap them between all player in a city"): each pack goes to the next player in the town in turn - me, then each peer
 * standing in its rect, by id - and is led from around that player's feet. Answers the feet, or null for my own.
 */
function staffPackPlayer() {
  const me = host().selfId?.() ?? '';
  const all = [[me, null], ...(host().peerFeetInTown?.() ?? []).filter(([id, f]) => id !== me && Array.isArray(f))].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return all[_packTurn++ % all.length][1];
}
/**
 * BOSS-SPOT (2026-10-25, mob: "spawn it on the highest lvl player in the town or area", "or largewst groupoing"; card:
 * "Biggest group, ties by level"): the player a mini boss stands beside - the one with the most players within
 * STAFF_BOSS_GROUP_M of them (themselves counted), a tie to the group whose highest level is higher, then the lower id.
 * Pure. @param {[string, number[], number][]} players `[id, feet, level]` @returns {[string, number[], number]|null}
 */
export function staffBossSpot(players) {
  let best = null, bestN = -1, bestLv = -1;
  for (const p of players) {
    if (!Array.isArray(p?.[1])) continue;
    const near = players.filter((q) => Array.isArray(q?.[1]) && Math.hypot(q[1][0] - p[1][0], q[1][2] - p[1][2]) <= STAFF_BOSS_GROUP_M);
    const lv = Math.max(...near.map((q) => (Number.isFinite(q[2]) ? q[2] : 0)));
    if (near.length > bestN || (near.length === bestN && (lv > bestLv || (lv === bestLv && p[0] < best[0])))) { best = p; bestN = near.length; bestLv = lv; }
  }
  return best;
}
/** BOSS-SPOT: how near another player stands to count in a player's group (metres). */
export const STAFF_BOSS_GROUP_M = 30;
/** BOSS-SPOT: where my mini boss stands - beside the biggest group's player; mine (undefined: about me) when it is me. */
function staffBossPlace() {
  const me = host().selfId?.() ?? '';
  const at = staffBossSpot(host().peerFeetInTown?.() ?? []);
  return at && at[0] !== me ? { near: at[1] } : undefined;
}
/** PACK-SPREAD's turn: the packs stood so far. */
let _packTurn = 0;
/** THE REWARD: a staff event's monster another stands that fell after a blow of mine is my kill on the board (its
 *  owner's word counts it on the meter). Each puppet once. @param {any[]} puppets the raids' puppets, the fallen too @param {number} now */
function staffPuppetKills(puppets, now) {
  for (const pup of puppets) {
    if (!pup.dead || !pup.corpse || _pupKilled.has(pup) || renownStruckAt(pup) == null || pup.entity?.staffBoss) continue;
    const r = staffRaidOfKey(pup._pupRaid);
    if (!r || !raidActive(r, now)) continue;
    _pupKilled.add(pup);
    r.mine++;
  }
}
/** The puppets counted as my kills (THE REWARD). */
let _pupKilled = new WeakSet();
/** BOSS-CLEAR: one the players cannot reach (in a wall, on a roof) never holds the boss back past STAFF_BOSS_CLEAR_MAX_MS. @param {any} raid @param {number} t */
function staffClearLong(raid, t) {
  raid.clearSince ??= t;
  return t - raid.clearSince >= STAFF_BOSS_CLEAR_MAX_MS;
}
export const STAFF_BOSS_CLEAR_MAX_MS = 120000;
/** BOSS-CLEAR: is every monster of it that stood at the boss's call dead or gone - mine and the puppets of another's (a
 *  boss aside)? The field is taken once, at the first ask (`clearWait`); a pack stood since never holds the boss
 *  (BOSS-CLEAR-CALL, mob 2026-10-25: "no only the mini boss need to wait for everything to be dead"). @param {any} raid @param {any} h */
function staffFieldClear(raid, h) {
  const key = raidKey(raid);
  const pups = h.raidPuppets?.() ?? [];
  raid.clearWait ??= new Set([...liveRaiders(key).map((e) => e.foe), ...pups.filter((pup) => pup._pupRaid === key && !pup.dead && !pup.entity?.staffBoss)]);
  for (const f of raid.clearWait) if (!f.dead && (_live.some((e) => e.foe === f) || pups.includes(f))) return false;
  return true;
}
/** BOSS-LOST: does its boss stand anywhere I can see - mine, or a puppet of another's? @param {any} raid @param {any} h */
function staffBossStanding(raid, h) {
  const key = raidKey(raid);
  if (_live.some((e) => e.key === key && e.boss && !e.foe.dead)) return true;
  return (h.raidPuppets?.() ?? []).some((pup) => pup._pupRaid === key && !pup.dead && pup.entity?.staffBoss);
}
/** A foe of mine taken over from a fallen runner: its event's mini boss is still the boss I stand now. */
function tookStaffBoss(f) {
  if (!f?.entity?.staffBoss) return false;
  const r = staffRaids().find((x) => x.key === f.raidKey);
  if (r) { r.bossUp = 1; r.bossDown = 0; }
  return true;
}
/** The name a staff event's place is said by: its town's, off my own map (the panel's word when the map has none), or
 *  its region's for an area. */
function staffPlaceName(r) {
  if (r.locationIndex >= 0) {
    const town = regionsNow()?.find((x) => x.region === r.regionIndex)?.towns.find((t) => t.index === r.locationIndex);
    if (town?.name) return town.name;
  }
  return r.locationName || regionName(r.regionIndex);
}
const kindName = (t) => enemyDisplayName(t) ?? 'monster';
/** Is a staff event's place a city? The panel's word (`ct`, off the game's map), or a town of my own map. Anything else
 *  is said as an area (mob 2026-10-24: "make sure to add that it is a city ... and make sure to say its an area if it not"). */
const staffCity = (r) => r.locationIndex >= 0 && (r.staff?.ct === 1 || !!regionsNow()?.find((x) => x.region === r.regionIndex)?.towns.some((t) => t.index === r.locationIndex));
export const staffAttackLine = (r) => (staffCity(r)
  ? t('staffEvent.attackCity', 'The city of {place} is under attack!', { place: staffPlaceName(r) })
  : t('staffEvent.attackArea', 'The area of {place} is under attack!', { place: staffPlaceName(r) }));
export const staffBossLine = (r) => (staffCity(r)
  ? t('staffEvent.bossCity', 'A mighty {kind} has come to the city of {place}!', { kind: kindName(r.staff.b), place: staffPlaceName(r) })
  : t('staffEvent.bossArea', 'A mighty {kind} has come to the area of {place}!', { kind: kindName(r.staff.b), place: staffPlaceName(r) }));
export function staffEndLine(r) {
  const city = staffCity(r), args = { kind: kindName(r.staff.b), place: staffPlaceName(r) };
  if (r.bossDown) return city ? t('staffEvent.bossFellCity', 'The {kind} has fallen. The city of {place} is safe.', args) : t('staffEvent.bossFellArea', 'The {kind} has fallen. The area of {place} is safe.', args);
  return city ? t('staffEvent.overCity', 'The attack on the city of {place} is over.', args) : t('staffEvent.overArea', 'The attack on the area of {place} is over.', args);
}
/** My word on the staff event I stand in, to its place's cell - at once when my deaths, my strike or my boss moved, else
 *  every STAFF_EVENT_WORD_MS (the raid's RAID_WORD_MS); the session sends it where the relay keeps events. */
function sayToCell(raid, t = localNow()) {
  const w = validStaffEventIn({ k: 'w', id: raid.staff.id, px: raid.px, py: raid.py, n: Math.min(raid.killed, 9999), s: raid.struck ? 1 : 0, bu: raid.bossUp, bk: raid.bossDown, fb: Math.max(0, raid.bossFc), h: Math.min(raid.mine ?? 0, 9999) });
  if (!w) return false;
  const sig = `${w.n}.${w.s}.${w.bu}.${w.bk}.${w.fb}.${w.h}`;
  if (_lastStaffWord && _lastStaffWord.id === w.id && _lastStaffWord.sig === sig && t - _lastStaffWord.at < RAID_WORD_MS) return false;
  if (!host().sendRaid?.(w, worldRoom(raid.px, raid.py))) return false;   // the session knows a staff word by its shape (net/online.js sendRaid)
  _lastStaffWord = { id: w.id, sig, at: t };
  return true;
}
let _lastStaffWord = null;
/** The relay's word on the staff events: the hub's book (`ev`) and an end (`end`), a cell's ledger (`st`). */
function staffRelayWord(sev, room) {
  if (!sev) return false;
  if (sev.k === 'ev') { staffEventBook(sev.l); return true; }
  if (sev.k === 'end') return staffEventEnd(sev.id, sev.why);
  if (sev.k === 'st') return typeof room === 'string' && isCellRoom(room) && staffEventLedger(sev);
  if (sev.k === 'bd') {   // THE REWARD: the board, said where the boss fell
    const r = staffRaidOfKey(staffEventKey(sev.id));   // an ended one is kept (cleansed) - the board may come after its end
    if (!r || _staffBoards.has(sev.id) || !sev.top.length) return false;
    _staffBoards.add(sev.id);
    say(staffBoardLine(sev.top), r);
    return true;
  }
  if (sev.k === 'rc') {   // THE REWARD: my receipt - its spoils rolled off its seed (scenes/world.js onRaidReceipt, systems/staffEventSpoils.js)
    const c = readStaffReceipt(sev.r);
    const key = c ? `sev:${c.v}` : null;
    if (!c || !key || _receipts.get(key) === sev.r) return false;
    _receipts.delete(key);
    _receipts.set(key, sev.r);
    while (_receipts.size > RAID_RECEIPTS_KEPT) _receipts.delete(_receipts.keys().next().value);
    host().onRaidReceipt?.(sev.r, c);
    return true;
  }
  return false;
}
/** THE REWARD's boards said, by event (once each). */
const _staffBoards = new Set();
/** The board as one line: "The top fighters: 1. Ana (23), 2. Bo (19) ..." - the boss's killer marked. @param {[string, number, number][]} top */
export function staffBoardLine(top) {
  const who = t('staffEvent.boardWho', 'A fighter');   // a nameless row (the law's '')
  const list = top.map(([name, n, k], i) => [name || who, n, k]).map(([nm, n, k], i) => (k ? t('staffEvent.boardRowKiller', '{rank}. {name} ({kills}, the killing blow)', { rank: i + 1, name: nm, kills: n }) : t('staffEvent.boardRow', '{rank}. {name} ({kills})', { rank: i + 1, name: nm, kills: n }))).join(', ');
  return t('staffEvent.board', 'The top fighters: {list}', { list });
}
/**
 * TIMERS1 / EVENTS1: THE DAY'S RAIDS AS THE TIMERS WINDOW AND THE EVENT BOARD READ THEM (systems/eventTimers.js
 * eventTimerRows `raids`, systems/eventBoard.js eventBoardModel) - each raid's town, its region (`regionName`), its party,
 * its two hours in relay ms (`relayOf(minute)`, the host's: a classic minute to the relay's clock), whether it is over,
 * its town's map pixel, its key (raidKey - the id its lines come with, AUDIT EVENTS1 A1), and the town's ledger at a raid
 * relay where one is known (`n` of `tg` raiders down, raidRelayState - the map's card's count, FIELD BUGS 2026-10-11g
 * RAID-WORD). Moved out of scenes/world.js's timersSource (HOST-SPLIT), the pixel and the ledger EVENTS1's.
 * AUDIT EVENTS1 A4: and, within `aheadMs` of the day's turn, the next day's - the roll is the day's own (fix 1), so a raid
 * early in a day is named a quarter of an hour ahead too, where it had been named only once its day began.
 * @param {(minute: number) => number} relayOf
 * @param {(region: number) => (string|undefined)} [regionName]
 * @param {number} [aheadMs]
 */
export function raidTimerList(relayOf, regionName = () => '', aheadMs = 0) {
  const row = (r) => {
    const led = raidRelayState(raidKey(r));
    return {
      name: r.locationName, region: regionName(r.regionIndex) ?? '', type: raidTypeName(r.type), startMs: relayOf(r.startMinute), endMs: relayOf(r.endMinute),
      done: !!r.cleansed, px: r.px, py: r.py, key: raidKey(r), n: Number.isFinite(led?.n) ? led.n : null, tg: Number.isFinite(led?.tg) ? led.tg : null,
      kind: raidKindName(kindOf(r)), obj: objDetail(r),   // RAID5: its kind, and its objective in words where it has one
    };
  };
  const out = state.raids.map(row);
  // the day after the one rolled, where its turn is still to come and within the ahead (a list not yet rolled for today
  // looks ahead of nothing)
  const next = state.lastSelectedDay + 1, now = (host().now ?? worldMinutes)(), turn = next * MINUTES_PER_DAY;
  if (aheadMs > 0 && Number.isFinite(next) && turn > now && relayOf(turn) - relayOf(now) <= aheadMs) {
    if (_ahead.day !== next) { const regions = regionsNow(); if (regions) _ahead = { day: next, raids: raidsForDay(next, regions).filter((r) => !isWildRegion(r.regionIndex)) }; }
    if (_ahead.day === next) out.push(..._ahead.raids.map(row));   // the regions not read yet: asked again next read
  }
  return out;
}
/** AUDIT EVENTS1 A4: the next day's roll, made once a day for raidTimerList. */
let _ahead = { day: NaN, raids: [] };
/** AUDIT EVENTS1 A8 / C7: the region the raids count the player in - PlayerGPS.CurrentRegionIndex less the sea and the
 *  Eltheric Ocean (fix 8, AUDIT CAPTAIN'S SEA G7: the host's own `regionIndex`) - -1 where none. */
export const raidRegionNow = () => { try { return host().regionIndex?.() ?? -1; } catch { return -1; } };

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
 * table in its one spelling (net/raid/raidLaw.js raidTownsCanon) when it hashes to `h`, else null (a world whose towns are
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
  _relay = new Map(); _receipts = new Map(); _lastWord = null; _ahead = { day: NaN, raids: [] }; _staffBoards.clear(); _pupKilled = new WeakSet(); _pack = null; _packTurn = 0;
  _peerObj = new Map(); _held = [];   // RAID5
}
/** Test seam: the runtime, read-only. */
export const _raidRuntime = () => ({ live: _live.slice(), pending: _pending, nextSpawnIn: _nextSpawnIn, nextDefenderIn: _nextDefenderIn });
