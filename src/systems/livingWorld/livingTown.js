// @ts-check
// LW2 (2026-10-04, bible/06-Systems/Living-World.md): THE LIVING TOWN - the residents on the street. It stands where
// DFU's wandering pool stood (systems/townPopulation.js TownPopulation) and answers the street's seams in the pool's own
// shape - `pool` rows of { person, active, scheduleEnable, scheduleRecycle, visible }, `update()` the live seats,
// `retire(person)`, `nav`, `maxPopulation` - so the talk ray, the watch's conversion, the trample, the probes and the
// draw take a resident as they took a walker. What stands on the street is not a pool's roll but the town's day:
//
//  - THE CENSUS AND THE DAY. Every resident of the town (census.js) has their day (dayPlan.js); four times a second the
//    town reads each one's entry at the clock's minute, and those OUTDOORS - walking, or standing at a spot - within
//    LIVING_RANGE of the player are wanted on the street, the nearest first, to DFU's own cap (maxPopulationFor).
//  - WHERE EXACTLY. A walk is the grid's A* path (townPaths.js, searched in slices), walked at the day's pace and
//    never slower (a path longer than the plan guessed is walked faster, to WALK_FAST times the pace, and arrives late
//    past that - the stay after it starts when they arrive). A stay at a spot is a place about it: in a circle with
//    the others met there (meetups.js), else a place of their own. LW-SPACE: nobody inside another - those alone at a
//    spot placed apart (`_spaceAlone`), a company leaving one place together in file (`_fileOf`), and a walker steps
//    aside for whoever is in its way (`_dodge`).
//  - POP-IN IS HIDDEN, DFU'S WAY: a resident wanted comes onto the street beyond POP_VISIBLE_RANGE or behind the
//    player's half of the view (PopulationManager's own rule) - or out of a door, which is a coming-out and needs no
//    hiding. One walking into a door is gone through it at once; one only out of range goes when unseen. BUT ON
//    ARRIVAL - the town's first frame, the clock jumped past ARRIVAL_JUMP_MIN (a rest, a wait, a load), or the player
//    moved past ARRIVAL_STEP_M in one frame (a Recall, a teleport) - the street is simply as the day has it: everyone
//    out of doors is there, as they were before the player came (DFU's rule alone would keep a street the player
//    arrives facing empty but for its doors). The hiding is for the street's own churn: one more stood under the cap
//    as another goes in.
//  - THE POLITENESS GATE holds them as it holds DFU's walkers (the street's own `wantsToStop`), and their day waits
//    for them: the minutes they stood are owed, and walked off at CATCH_UP faster until they are back on their day.
//  - WHAT THEY SAY (`speech()`): a circle's line at this minute (pure: every reader hears it), and a word to the player
//    passing close - by name from a friend, a cold one from an enemy (relations.js).
//  - A RESIDENT TAKEN off the street - trampled - is gone for the rest of the day. WATCH-FIX: one the watch's conversion
//    took is LENT to the guard stood in their place (`lend` - scenes/livingWatch.js follows it): off the street while it
//    stands, and at its end back to their day (`back`), or - one of the watch cut down - slain by the player's own blow,
//    else KILLED (`killed`: dead for good, nobody's regard moved). Another player's watch stands for residents here too
//    (WATCH1's records name them, `peerLend`): off this street while it does.
//  - LW3, THE ROADS IN TOWN (`o.tripsOf`): a traveller of this town on a trip has its away window (geared at home, out
//    to the exit facing the road, home again - dayPlan.js schedule), and walks it ARMED in their class's sprite
//    (`o.armOf`, ResidentWalker.arm); a party of another town staying here is a VISITOR - in by the exit facing the road
//    it came, lodged at a tavern, out by the same exit when it leaves.
//  - LW7, THE DEEDS (bible/06-Systems/Living-World.md "LW7"). A resident the player STRUCK DOWN (`slain` - DFU's one-hit
//    civilian) is dead for good: the host makes the hand's turn (`o.slay`; lives.js takes the place from that minute -
//    the town's people read `o.holderOf` and `o.deadAt`), their own - the household they live in, the party they came
//    with, the crew they came ashore with - count the player their enemy for it, and every resident who saw it
//    (`WITNESS_M`, a clear line - `o.sees`) counts it a crime; so does every one who saw a hand caught in a purse, and
//    one of the watch STRUCK (`struck`) remembers the blow. A word's tone (`toned`) moves a regard once a day. The town
//    talks of it for NEWS_DAYS (`deedNews`): one of its own struck down - and, seen, by whom.
import { POP_VISIBLE_RANGE, POP_RECYCLE_DISTANCE, maxPopulationFor } from '../townPopulation.js';
import { PERSON_MOVE_SPEED } from '../../characters/mobilePerson.js';
import { townPlaces, exitToward, harbourDock, streetGeometry } from './places.js';
import { townCensus, isHome, watchShiftSize } from './census.js';
import { dayPlan, entryAt, isOutdoor, DAY_START_MIN, DAY_MIN } from './dayPlan.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { createPathBook, pointOnLine } from './townPaths.js';
import { spotCircles, circleLine, circlesStands, aloneStand, aloneStands, ROUND_S, GATHER_BEAT_S, lineMinutes, ALONE_FAR_M, SPACE_M } from './meetups.js';
import { LIVING_GREETINGS, LIVING_KEEPSAKE, WATCH_GREETINGS, watchBand, fillLine, firstNameOf } from './lines.js';
import { keepsakeFor } from './keepsake.js';
import { lwSeed, textSeed } from './seed.js';
import { placeKeyOf } from './lives.js';
import { NEWS_DAYS } from './trips.js';

/** AUDIT LEGACY II B2: whose household a resident is of - their own `household` when they live here beyond the census
 *  (Project Legacy's line), else their census house; null for none. */
export const householdKeyOf = (res) => res?.household ?? (res?.home == null ? null : `H${res.home}`);

/** LW5: a visiting crew's day is planned again only when its arrival moved this far (the clock's minutes) - it is read
 *  off the ships' clock and the sky's at each census, and the two drift by a hair. */
export const CREW_REPLAN_MIN = 5;
/** The census read this often (real seconds). */
export const LIVING_TICK_S = 0.25;
/** How far a resident is stood from the player (m) - DFU's recycle distance. */
export const LIVING_RANGE = POP_RECYCLE_DISTANCE;
/** The searches one frame may make. */
export const PATHS_PER_FRAME = 4;
/** A path longer than the day guessed is walked up to this many times the pace. */
export const WALK_FAST = 1.6;
/** The owed minutes are walked off this much faster than the day. */
export const CATCH_UP = 0.35;
/** A body further than this from where its day has it (m) is stood there at once (a first frame, a rest's jump of the
 *  clock); nearer, it walks there (a circle reshuffled, a stand left for the next walk). */
export const SNAP_M = 30;
/** A walk begun this many of the clock's minutes ago from a door is a coming-out (seen at any range). */
export const DOOR_POP_MIN = 2;
/** WATCH-PROTECTS: how near a hostile monster sends one on the street running (m) - a few strides of it. */
export const PANIC_M = 10;
/** WATCH-PROTECTS: a townsperson running from one (m/s) - twice their walk. */
export const FLEE_SPEED = PERSON_MOVE_SPEED * 2;
/** WATCH-PROTECTS: how near one who ran keeps clear of the monster (m) - standing, never walking their day back to it
 *  while it stands within this of them. */
export const FLEE_WARY_M = PANIC_M * 2;
/** WATCH-PROTECTS: how long one who ran keeps clear once the monster is beyond FLEE_WARY_M (real seconds), standing,
 *  before their day takes them up again. */
export const FLEE_HOLD_S = 4;
/** WATCH-PROTECTS: the farthest one runs from where they took fright (m) - then they cower: inside SNAP_M of their day,
 *  so it takes them up again on foot, never with a jump. */
export const FLEE_FAR_M = 20;
/** WATCH-DAY: how far the second of a patrol's pair walks beside the first (m), and behind him where the street will
 *  not hold him beside. */
export const PAIR_SIDE_M = 0.9;
export const PAIR_BEHIND_M = 1.2;
/** How near the player passes for a word (m), how far lines are heard (m), and a resident's word's rest (minutes). */
export const GREET_RANGE = 3.2;
export const LINE_RANGE = 24;
export const GREET_REST_MIN = 90;
/** A clock jump past this (minutes) between two frames is an arrival: the street is stood whole. */
export const ARRIVAL_JUMP_MIN = 15;
/** A player moved past this in one frame (m) has arrived (a journey's x100 step is a few metres). */
export const ARRIVAL_STEP_M = 40;
/** The searches a frame may make while the street is being stood on arrival. */
export const ARRIVAL_PATHS_PER_FRAME = 32;
/** LW-PERF: the cells a frame's searches may open (townPaths.js createPathBook `cells`) - about two milliseconds of
 *  searching on a desktop (a walk across a great city opens up to a hundred thousand: ~25 ms, now over many frames) -
 *  and while the street is being stood on an arrival (ARRIVAL_SHOW_S), three times that: measured (tools/
 *  livingPerfProbe.mjs), every resident near a great city's player is on its morning street in one to three and a half
 *  seconds, and no frame of it near the 40-120 ms the whole searches stood. */
export const PATH_CELLS = 8000;
export const ARRIVAL_PATH_CELLS = 24000;
/** LW-PERF: how long after an arrival (real seconds) the street is still being stood: a resident the census finds then
 *  is stood where their day has them though the player sees it (the street as it was before the player came); after
 *  it, as any other - when unseen. The searches are run over frames now, so the street fills over a few. */
export const ARRIVAL_SHOW_S = 1.5;
/** AUDIT-G1: the searches a census beat may make for the walks not searched yet that may pass near the player. */
export const CENSUS_PATHS = 4;
/** AUDIT-G1: how far (m) a walk's path may stray outside the box its two ends make - a town's streets turn a path about
 *  a block at most (the synthetic town's straying, measured: 16 m). */
export const WALK_STRAY_M = 48;

/** LW-SPACE: walks from one place begun within this many of the clock's minutes of each other are a company leaving
 *  together - a shop's two at noon, a table's drinkers at the hour: they walk it IN FILE, each FILE_M behind the one
 *  before (the first on its line). On one line at one pace they walked inside each other the whole way. */
export const FILE_MIN = 0.25;
export const FILE_M = 1.2;
/** LW-SPACE: A WALKER STEPS ASIDE for one in its way - how far ahead it looks (m), the ways aside it may take (m to its
 *  right; the nearest to where it walks first, the right before the left), and how fast it steps (m a real second). */
export const DODGE_AHEAD_M = 2.4;
export const DODGE_SIDES = Object.freeze([0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35]);
export const DODGE_SPEED = 1;
/** LW-SPACE: a body walking up to its stand this near it (m) steps aside for nobody - it is there. */
export const DODGE_SETTLE_M = 0.6;
/** LW-SPACE: a hair's slack on SPACE_M (m) - a way aside exactly SPACE_M from one in it keeps the space, whichever side the
 *  sums round to. */
const SPACE_EPS = 1e-6;

/** AUDIT-G1: the gap (m) from `p` to the box a walk's two ends make - no nearer can its path pass, but by WALK_STRAY_M.
 *  @param {{ from?: { x: number, z: number }, to?: { x: number, z: number } }} e @param {number[]} p */
export function walkGap(e, p) {
  const a = /** @type {{ x: number, z: number }} */ (e.from), b = /** @type {{ x: number, z: number }} */ (e.to);
  const gx = Math.max(Math.min(a.x, b.x) - p[0], 0, p[0] - Math.max(a.x, b.x));
  const gz = Math.max(Math.min(a.z, b.z) - p[2], 0, p[2] - Math.max(a.z, b.z));
  return Math.hypot(gx, gz);
}
/** LW-TALK: how much nearer a talking circle counts than its nearest one (m) - the ring the ones alone at a spot stand in
 *  (meetups.js ALONE_FAR_M), which its circles stand beyond: counted level with them, not behind them all. Nearest alone,
 *  the busiest square at six in the evening kept the ones alone about it and fell silent (10.5 lines a minute, 63% of
 *  its seconds silent; with the ring counted, 24 and 33%). */
export const TALK_PULL_M = ALONE_FAR_M;
/**
 * LW-TALK: WHO THE STREET KEEPS - the wanted ([{ res, d }], d the metres off the player), each with the circle they
 * stand in (`circleOf(id)`, else alone): a circle's people come on together, nearest first - a unit as near as its
 * nearest one, a circle TALK_PULL_M nearer - while the whole of it fits the cap, or wait together. Nearest first is the
 * street's one order (LW2's): put first, those already on the street held every row from the nearer (a walk passing
 * beside the player never came on, nor a watchman back from his guard), and those in the player's sight let one go who
 * stood just behind him.
 * @param {{ res: Resident, d: number }[]} wanted @param {(id: string) => any} circleOf @param {number} cap
 * @returns {Set<Resident>}
 */
export function keepUnits(wanted, circleOf, cap) {
  /** @type {Map<any, { res: Resident[], d: number }>} */
  const units = new Map();
  for (const w of wanted) {
    const c = circleOf(w.res.id);
    const key = c ?? w.res, d = c ? w.d - TALK_PULL_M : w.d;
    const u = units.get(key);
    if (u) { u.res.push(w.res); u.d = Math.min(u.d, d); } else units.set(key, { res: [w.res], d });
  }
  const keep = new Set();
  for (const u of [...units.values()].sort((a, b) => a.d - b.d || (a.res[0].id < b.res[0].id ? -1 : 1))) {
    if (keep.size + u.res.length <= cap) for (const r of u.res) keep.add(r);
  }
  return keep;
}
/** How long a word to the player stands (real seconds). */
export const GREET_S = 3.4;
/** A resident's line stands this high over their feet (m) - a townsperson's billboard and a little. */
export const LINE_HEAD_M = 2.1;
/** What an enemy says to the talk ray instead of talking ({a} their first name). */
export const LIVING_REFUSAL = '{a} turns away from you.';
/** LW7: how near a resident stands to see a deed (m) - the street's own lines' reach. */
export const WITNESS_M = LINE_RANGE;
/** LW7: a deed in the street is the town's talk from this many of the clock's minutes after it (the body found, the word
 *  gone round). */
export const DEED_KNOWN_MIN = 60;

/**
 * @typedef {import('./census.js').Resident} Resident
 * @typedef {import('./dayPlan.js').Entry} Entry
 * @typedef {{ person: any, active: boolean, scheduleEnable: boolean, scheduleRecycle: boolean, visible: boolean, res: Resident|null, mine: boolean, arrival: boolean, paused?: boolean, flee?: { at: number[], left: number, from: number[] } | null, side?: number, halt?: boolean }} Row - LW-STAND `paused`: in view on a walk not
 *   yet searched (its minutes owed, as the politeness gate's); WATCH-PROTECTS `flee`: running from a monster (`_fright`);
 *   LW-SPACE `side` how far to its right a walker has stepped aside (`_dodge`), `halt` held where it stands this frame (the
 *   politeness gate, a pause)
 */

export class LivingTown {
  /**
   * @param {any} nav - the town's CityNavigation
   * @param {{
   *   town: import('./census.js').LwTown,
   *   buildings: readonly import('./census.js').LwBuilding[],
   *   doors: readonly { key: number, x: number, z: number, nx: number, nz: number }[],
   *   makePerson: (archive: number, guard: boolean) => any,
   *   clock: () => number, rate: () => number, mpm: number,
   *   suppressSpawns?: () => boolean,
   *   relations?: () => (ReturnType<typeof import('./relations.js').createRelations> | null),
   *   playerName?: () => string, weather?: () => (string|null), townName?: string, regionName?: string,
   *   tripsOf?: (day: number) => ({ away: Map<string, { t0: number, t1: number, yaw: number, armed: boolean, dock?: boolean }[]>, visitors: { res: Resident, inT: number, outT: number, yaw: number, trip?: any, dock?: boolean }[],
   *     holders?: Map<string, Resident|null>, news?: { kind: string, who: string, foe: string, place: string }[], places?: string[] } | undefined),
   *   armOf?: (res: Resident) => ({ mobileType: number, basics: any, archive: number, frameCount: (record: number) => number, sex?: 'male'|'female' } | null),
   *   ashore?: (res: Resident) => ('home'|'sea'|'abroad'|null),
   *   crews?: () => { res: Resident, inT: number, outT: number, berth?: { lane: { key: string }, k: number } }[],
   *   harbour?: () => ({ x: number, z: number } | null),
   *   holderOf?: (res: Resident, day: number) => (Resident|null),
   *   deadAt?: (res: Resident, t: number) => boolean,
   *   slay?: (res: Resident, t: number, seen: boolean) => void,
   *   killed?: (res: Resident, t: number) => void,
   *   sees?: (from: number[], to: number[]) => boolean,
   *   legalStanding?: (region: number) => ({ rep: number, known: boolean } | null),
   *   keepsakes?: () => readonly any[],
   *   takeKeepsake?: (item: any) => void,
   *   extraPeople?: (day: number, town: LivingTown) => readonly Resident[],
   *   familyNews?: (t: number) => readonly any[] | null,
   *   dangers?: () => (readonly number[][] | null),
   * }} o - LW6c: `keepsakes()` what the player carries (a keepsake carried home), `takeKeepsake(item)` it handed over.
   *   `tripsOf(day)` the roads' word on the town for a day (trips.js through the host's book: who of it is away
   *   when, who of elsewhere stays here; LW-TALK `places` the towns its roads and news name, its talk's {place}), undefined while its ways are still being asked; `armOf(res)` a resident's
   *   class sprite once its art is loaded, else null - `clock` the sky's minute (worldTick.js skyMinutes); `rate` the clock's minutes a real second now (a
   *   journey's scale in it); `mpm` the walking pace in the clock's metres a minute (LW0 decision 3). LW5: `ashore(res)`
   *   where one of its sailors is by their packet's clock (portCrews.js - at sea or abroad, in no street of this town);
   *   `crews()` the hands of the packets lying here from elsewhere, each ashore from `inT` to `outT` (the clock's
   *   minutes); `harbour()` the harbour's berth in the location's frame (the dock of a port with no Ship building).
   *   LW7: `holderOf(res, day)` who holds a townsperson's place on a day (lives.js - the census's own, a newcomer after a
   *   death, null while it stands empty; a traveller's come with the roads' word); `deadAt(res, t)` whether a hand took
   *   a resident by the minute; `slay(res, t, seen)` the player struck one down (the host makes the turn); WATCH-FIX
   *   `killed(res, t)` one killed by another hand (the host makes the turn `killed`); WATCH-KNOWS `legalStanding(region)` the
   *   player's standing with a region's law - its number and whether its watch knows them for a criminal; `sees(a, b)`
   *   a clear line between two points of the location frame (none given: always). LEGACY-HOME: `extraPeople(day, town)`
   *   residents beyond the census who live here (Project Legacy's bloodline, systems/legacy/household.js) - the same
   *   list while nothing about them changed, so the day's people are kept with it. LEGACY6: `familyNews(t)` what the
   *   town says of that house at the minute (systems/legacy/influence.js newsFor), told beside the roads' and the deeds'
   *   news.
   */
  constructor(nav, o) {
    this.nav = nav;
    this.o = o;
    this.places = townPlaces(nav, o.doors, o.buildings);
    /** LW-STAND: the street a person stands and walks on - never in a wall nor over the water (places.js streetGeometry:
     *  the stands about a spot, the way to one) */
    this._street = streetGeometry(this.nav, this.places);
    this.residents = townCensus(o.town, o.buildings, new Set(this.places.doors.keys()));   // LW-WALLS: the watch's and a traveller's home on the street
    /** WATCH-DAY: the town's watch a shift (census.js) - its companies' duties (dayPlan.js watchDuty) */
    this._watchSize = watchShiftSize(o.town);
    this.maxPopulation = maxPopulationFor(o.town.blocks);
    /** @type {Row[]} */
    this.pool = [];
    /** @type {Map<string, { day: number, plan: Entry[], roads?: boolean, inT?: number, home?: number|null }>} */
    this._plans = new Map();
    this._paths = createPathBook(nav);
    this._timer = Infinity;
    /** @type {Map<string, number>} the residents taken off the street, and the day */
    this._taken = new Map();
    /** WATCH-FIX: the residents lent to the watch - a guard of it stands for them (`lend`) @type {Set<string>} */
    this._lent = new Set();
    /** WATCH-FIX: the residents another player's watch stands for here (`peerLend`) @type {ReadonlySet<string>} */
    this._peerLent = new Set();
    /** @type {Map<string, number>} the minutes each is behind its day */
    this._lag = new Map();
    /** @type {Map<string, { circle: any, place: { x: number, z: number, yaw: number }, spot: any }>} this tick's circles, by member - LW-SPACE
     *  `place` where they stand in it (the round's circles laid together, meetups.js circlesStands) */
    this._inCircle = new Map();
    /** LW-SPACE: this beat's places of those alone at a spot (meetups.js aloneStands), by id @type {Map<string, { spot: any, x: number, z: number, yaw: number }>} */
    this._aloneAt = new Map();
    /** LW-SPACE: each spot's last allocation, kept while the same people stand there @type {Map<string, { sig: string, got: Map<string, { x: number, z: number, yaw: number }> }>} */
    this._aloneKeep = new Map();
    /** LW-SPACE: a count of the plans made (a company's file is read again when one changes), and each day's walks by
     *  where they leave from @type {number} */
    this._planGen = 0;
    /** @type {{ day: number, gen: number, from: Map<string, { t0: number, id: string, e: Entry }[]> } | null} */
    this._departures = null;
    /** @type {Map<string, { t: number, said: boolean }>} when each last came by the player (the clock's minute), and
     *  whether they spoke (LW-TALK: one who kept quiet speaks when the player stops before them) */
    this._greeted = new Map();
    /** LW-TALK: each exchange's script as it began (meetups.js exchangeScript) @type {Map<string, any>} */
    this._scripts = new Map();
    /** @type {{ person: any, text: string, until: number }[]} the words to the player standing */
    this._greetings = [];
    this._now = 0;
    this._realNow = 0;
    /** @type {number|null} the clock at the last frame (an arrival is a jump from it) */
    this._lastClock = null;
    /** @type {number[]|null} the player's feet at the last frame (an arrival is a jump from them) */
    this._lastPlayer = null;
    this._arriving = false;
    /** LW-PERF: the real second the street being stood on the last arrival ends (ARRIVAL_SHOW_S); and whether the
     *  street's own pass is asking (its walks searched before the census's). */
    this._arrivalUntil = -Infinity;
    this._onStreet = false;
    /** PERF-TOWN1's discipline: the live list and its rows are the town's own, refilled each frame. @type {any[]} */
    this._live = [];
    /** @type {{ person: any, out: any }[]} */
    this._rows = [];
    /** LW4: today's people, kept while the roads' word for the day stands (LEGACY-HOME: and the list beyond the census). @type {{ day: number, roads: any, extra?: readonly Resident[]|null, list: Resident[] } | null} */
    this._people = null;
    /** AUDIT LEGACY II P7: the town's houses with a door, listed once (homeFor). @type {number[]|null} */
    this._homes = null;
    /** LW5: the crews ashore here from elsewhere, read at each census (LW7: each with its packet). @type {Map<string, { res: Resident, inT: number, outT: number, berth?: { lane: { key: string }, k: number } }>} */
    this._crewOf = new Map();
    /** LW5: the dock found off the harbour (a port with no Ship building), once found. @type {any} */
    this._harbourDock = null;
  }

  /** LW5: the town's dock - a Ship building's, else the street nearest its harbour's berth (once the harbour is
   *  sounded: the sailors are planned again to work it), else none. */
  dockSpot() {
    if (this.places.dock.length) return this.places.dock[0];
    if (this._harbourDock) return this._harbourDock;
    const h = this.o.harbour?.() ?? null;
    if (!h) return null;
    this._harbourDock = harbourDock(this.nav, this.places, h.x, h.z);
    if (this._harbourDock) { this.places.dock.push(this._harbourDock); this._plans.clear(); }
    return this._harbourDock;
  }

  /** LW5: a sailor at sea, or ashore at the far port, is in no street of this town. @param {Resident} res */
  _gone(res) {
    const a = this.o.ashore?.(res) ?? null;
    return a === 'sea' || a === 'abroad';
  }

  /** LW5: the crews of the packets lying here from elsewhere, read afresh at each census. @returns {Resident[]} */
  _crewsNow() {
    const got = this.o.crews?.() ?? [];
    this._crewOf = new Map(got.map((c) => [c.res.id, c]));
    return got.map((c) => c.res);
  }

  /** The living day `t` falls in. @param {number} t */
  dayOf(t) { return Math.floor((t - DAY_START_MIN) / DAY_MIN); }

  /** A resident's day - a traveller's bent round its trips, a visitor's round its stay. @param {Resident} res @param {number} day */
  planOf(res, day) {
    let e = this._plans.get(res.id);
    const crew = this._crewOf.get(res.id) ?? null;
    // AUDIT LEGACY II B3: a resident whose HOME changed (Project Legacy's line moved into a house bought, or to the home
    // the player marked) is planned again at once - kept by the day alone, they slept the rest of it in the old house
    if (!e || e.day !== day || e.home !== res.home || (crew && !(Math.abs((e.inT ?? -Infinity) - crew.inT) <= CREW_REPLAN_MIN))) {   // LW5: a crew's arrival read off two clocks: replanned only when it moved
      const roads = this._roadsOf(day);
      const visit = roads?.visitorOf.get(res.id) ?? null;
      let plan;
      if (crew) {
        // LW5: a hand of a packet lying here - in off the dock when she made fast, lodged at a tavern, back aboard by her
        // sailing (the square, a town with no dock)
        const dock = this.dockSpot() ?? this.places.square ?? null;
        const D0 = day * DAY_MIN + DAY_START_MIN;
        const away = [{ t0: D0 - DAY_MIN, t1: crew.inT, exit: dock, armed: false }, { t0: crew.outT, t1: D0 + 2 * DAY_MIN, exit: dock, armed: false }];
        plan = dayPlan(res, this.places, day, { mpm: this.o.mpm, visitor: true, home: this._lodging(res), away });
        e = { day, plan, roads: true, inT: crew.inT, home: res.home };
        this._planGen++;
        this._plans.set(res.id, e);
        return e.plan;
      }
      if (visit) {
        const exit = visit.dock ? (this.dockSpot() ?? exitToward(this.places, visit.yaw)) : exitToward(this.places, visit.yaw);   // LW5b: off a ship, by the dock
        const D0 = day * DAY_MIN + DAY_START_MIN;
        const away = [{ t0: D0 - DAY_MIN, t1: visit.inT, exit, armed: false }, { t0: visit.outT, t1: D0 + 2 * DAY_MIN, exit, armed: false }];
        plan = dayPlan(res, this.places, day, { mpm: this.o.mpm, visitor: true, home: this._lodging(res), away });
      } else {
        const away = (roads?.away.get(res.id) ?? []).map((w) => ({ t0: w.t0, t1: w.t1, exit: w.dock ? (this.dockSpot() ?? exitToward(this.places, w.yaw)) : exitToward(this.places, w.yaw), armed: w.armed }));   // LW5b: a passage leaves by the dock
        plan = dayPlan(res, this.places, day, { mpm: this.o.mpm, away, watch: this._watchSize });
      }
      e = { day, plan, roads: !!roads, home: res.home };
      this._planGen++;
      this._plans.set(res.id, e);
    }
    return e.plan;
  }

  /** The roads' word for a day, kept (undefined while its ways are being asked - the day is planned without them and
   *  planned again once they are known). */
  _roadsOf(day) {
    if (!this.o.tripsOf) return null;
    if (this._roads?.day === day) return this._roads;
    const got = this.o.tripsOf(day);
    if (!got) return null;
    this._roads = { day, away: got.away, visitorOf: new Map(got.visitors.map((v) => [v.res.id, v])), visitors: got.visitors.map((v) => v.res),
      holders: got.holders ?? null, news: got.news ?? null, places: got.places ?? null };   // LW4: who holds each traveller's place today; the town's news of the road; LW-TALK: its towns
    this._people = null;
    for (const [id, e] of this._plans) if (e.day === day && !e.roads) this._plans.delete(id);   // planned before the roads were known: again
    return this._roads;
  }

  /** A visitor's lodging: one of the town's taverns, by their id (none: the square). */
  _lodging(res) {
    const taverns = [...this.places.doors.entries()].filter(([k]) => this.places.types.get(k) === BUILDING_TYPES.Tavern).map(([, s]) => s);
    return taverns.length ? taverns[lwSeed(textSeed(res.id), 0x6c6f6467) % taverns.length] : (this.places.square ?? null);   // 'lodg'
  }

  /** Everyone the town reads today: its people - LW4: each traveller's place as its holder today (a newcomer after a
   *  death on the road; nobody while the place stands empty) - its visitors, and (LEGACY-HOME) those who live here
   *  beyond the census (`o.extraPeople`). @param {number} day */
  peopleOf(day) {
    const roads = this._roadsOf(day);
    const v = roads?.visitors;
    const extra = this.o.extraPeople?.(day, this) ?? null;
    if (this._people?.day === day && this._people.roads === roads && this._people.extra === extra) return this._people.list;
    const h = roads?.holders;
    const hold = this.o.holderOf;
    // the census's own while it holds the place; a newcomer lodged where the place is (the census's home for it). LW7: a
    // townsperson's place too, by the lives (`holderOf`) - a traveller's comes with the roads' word
    const own = h || hold ? this.residents.flatMap((r) => {
      const x = h?.has(r.id) ? h.get(r.id) : (hold && r.roll !== 't' ? hold(r, day) : r);
      return !x ? [] : [x.id === r.id ? r : { ...x, home: r.home }];
    }) : this.residents;
    const list = v?.length || extra?.length ? own.concat(v ?? [], extra ?? []) : own;
    this._people = { day, roads, extra, list };
    return list;
  }

  /** LEGACY-HOME: a house of the town LENT to a household from beyond the census (a line with no house of its own, in its
   *  seat): one of its residences with a door, by `seed`, the same for the same seed - or 0 with none. @param {string} seed */
  homeFor(seed) {
    // AUDIT LEGACY II P7: the town's doors are fixed at its making - its houses listed once
    this._homes ??= [...this.places.doors.keys()].filter((k) => isHome(this.places.types.get(k))).sort((a, b) => a - b);
    return this._homes.length ? this._homes[lwSeed(textSeed(String(seed)), 0x686f6d65) % this._homes.length] : 0;   // 'home'
  }

  /** The entry a resident is in at minute `t` (with the one before and the one after), or null. @param {Resident} res @param {number} t */
  entryOf(res, t) {
    const plan = this.planOf(res, this.dayOf(t));
    const i = entryAt(plan, t);
    return i >= 0 ? { e: plan[i], prev: plan[i - 1] ?? null, next: plan[i + 1] ?? null } : null;
  }

  /**
   * LW8: WHO IS INSIDE building `key` at minute `t` - each resident whose day has them in at its door (arrived: not on
   * the street, a walk running late still out), but those asleep, the building's own staff at their work where it is no
   * house (its static people stand for them, DFU's own), and the taken, the gone and the dead. In the order of their ids.
   * @param {number} key @param {number} t @returns {{ res: Resident, e: Entry }[]}
   */
  insideAt(key, t) {
    const day = this.dayOf(t);
    const house = isHome(this.places.types.get(key) ?? -1);
    const out = [];
    for (const res of this.peopleOf(day).concat(this._crewsNow())) {
      if (this._taken.get(res.id) === day || this._away(res) || this._gone(res) || this.o.deadAt?.(res, t)) continue;   // WATCH-FIX: nor one with the watch
      const at = this.entryOf(res, t);
      const e = at?.e;
      if (!e || e.kind === 'walk' || isOutdoor(e) || e.at?.building !== key) continue;
      if (e.kind === 'sleep' || (e.kind === 'work' && !house && res.work === key)) continue;
      if (this.where(res, t, false)) continue;   // still in the street: a walk running late
      out.push({ res, e });
    }
    return out.sort((a, b) => (a.res.id < b.res.id ? -1 : 1));
  }

  /** The walk's line, if its path is known (undefined: not searched yet; null: no way). LW-PERF: a resident on the street
   *  asks first (`_onStreet`, the street's own pass). */
  _line(e, search) {
    const a = e.from.cell, b = e.to.cell;
    const known = this._paths.get(a, b);
    if (known !== undefined || !search) return known;
    return this._paths.want(a, b, this._onStreet);
  }

  /** How far along a walk's line at minute `t` - the day's pace, never slower, to WALK_FAST times it. */
  _walked(e, line, t) {
    const dur = Math.max(1e-6, e.t1 - e.t0);
    const v = Math.min(this.o.mpm * WALK_FAST, Math.max(this.o.mpm, line.len / dur));
    return { s: (t - e.t0) * v, arrive: e.t0 + line.len / v };
  }

  /**
   * Where a resident's day has them at minute `t`, or null indoors. `search` lets this frame's budget search a path.
   * A walk is its path walked at `_walked`'s pace: one that has not arrived when its window closes holds the walker
   * past it, and one that arrives early stands them at its end (or takes them through the door, out of the gate).
   * A walk whose path is not searched yet is `pending` (AUDIT-G1: the census searches the ones that may pass near the
   * player, `_tick`).
   * @param {Resident} res @param {number} t @param {boolean} search
   * @returns {{ x: number, z: number, yaw: number, moving: boolean, e: Entry, pending?: boolean, fromDoor?: boolean } | null}
   */
  where(res, t, search) {
    const at = this.entryOf(res, t);
    if (!at) return null;
    let e = at.e, after = at.next;
    if (e.kind !== 'walk' && at.prev?.kind === 'walk') {
      const line = this._line(at.prev, search);
      if (line && this._walked(at.prev, line, t).arrive > t) { after = e; e = at.prev; }
    }
    if (e.kind === 'walk') {
      const line = this._line(e, search);
      if (line === undefined) return { x: e.from.x, z: e.from.z, yaw: 0, moving: false, e, pending: true };
      if (line === null) return null;
      const w = this._walked(e, line, t);
      if (w.s < line.len) {
        // WATCH-DAY: the second of a pair at the first's shoulder; LW-SPACE: one of a company leaving together in file
        const p = e.pair === 1 ? this._atShoulder(line, w.s) : pointOnLine(line, Math.max(0, w.s - this._fileOf(res, e) * FILE_M));
        return { x: p.x, z: p.z, yaw: p.yaw, moving: true, e, fromDoor: e.from.kind === 'door' && (t - e.t0) < DOOR_POP_MIN };
      }
      if (!after || !isOutdoor(after) || after.kind === 'walk') return null;   // arrived: in through the door, out of the gate
      e = after;
    }
    if (!isOutdoor(e)) return null;
    const c = this._inCircle.get(res.id);
    const inCircle = !!c && c.spot === e.at;
    const alone = inCircle ? null : this._aloneAt.get(res.id);   // LW-SPACE: their place at the spot this beat
    const st = inCircle ? c.place : alone && alone.spot === e.at ? alone : aloneStand(e.at, res.id, this._street);   // LW-STAND
    return { x: st.x, z: st.z, yaw: e.kind === 'post' && !inCircle ? e.at.yaw : st.yaw, moving: false, e };   // WATCH-DAY: a post keeps the road
  }

  /**
   * WATCH-DAY: the second of a patrol's pair walks at the first's shoulder - PAIR_SIDE_M to his right where the street
   * holds it, to his left where only that does, else a pace behind him on the way. @param {any} line @param {number} s
   * @returns {{ x: number, z: number, yaw: number }}
   */
  _atShoulder(line, s) {
    const p = pointOnLine(line, s);
    const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);   // the walker's right, his forward (sin, cos)
    for (const side of [PAIR_SIDE_M, -PAIR_SIDE_M]) {
      const x = p.x + rx * side, z = p.z + rz * side;
      if (this._street.holds(x, z)) return { x, z, yaw: p.yaw };
    }
    const b = pointOnLine(line, Math.max(0, s - PAIR_BEHIND_M));
    return { x: b.x, z: b.z, yaw: p.yaw };
  }

  /**
   * LW-SPACE: A COMPANY LEAVING TOGETHER WALKS IN FILE - one's place in it: how many walks left the same place before
   * this one (`e`) within FILE_MIN of each other, one after another, the earlier first and on a tie the lower id (a
   * patrol's pair walks its own way - at the shoulder - and is none of it: its walks are in no company, `_walksFrom`).
   * Read off the day's whole census and its visitors, so every reader's company is the same. 0 alone, or the first.
   * @param {Resident} res @param {Entry} e @returns {number}
   */
  _fileOf(res, e) {
    if (!e.from) return 0;
    const list = this._walksFrom(this.dayOf(e.t0)).get(e.from.key);
    if (!list) return 0;
    let i = list.findIndex((w) => w.e === e || (w.id === res.id && w.t0 === e.t0));
    if (i < 0) return 0;
    let k = 0;
    while (i > 0 && list[i].t0 - list[i - 1].t0 <= FILE_MIN) { i--; k++; }
    return k;
  }

  /** LW-SPACE: the day's walks by where they leave from, each list in order (the earlier first, then the lower id) -
   *  made again when a plan does. @param {number} day */
  _walksFrom(day) {
    const d = this._departures;
    if (d && d.day === day && d.gen === this._planGen) return d.from;
    /** @type {Map<string, { t0: number, id: string, e: Entry }[]>} */
    const from = new Map();
    for (const res of [...this.peopleOf(day), ...[...this._crewOf.values()].map((c) => c.res)]) {
      for (const e of this.planOf(res, day)) {
        if (e.kind !== 'walk' || e.pair != null || !e.from) continue;
        const list = from.get(e.from.key) ?? [];
        list.push({ t0: e.t0, id: res.id, e });
        from.set(e.from.key, list);
      }
    }
    for (const list of from.values()) list.sort((a, b) => a.t0 - b.t0 || (a.id < b.id ? -1 : 1));
    this._departures = { day, gen: this._planGen, from };
    return from;
  }

  _rowOf(res) { return this.pool.find((r) => r.res === res) ?? null; }

  _freeRow() {
    for (const r of this.pool) if (!r.active && !r.res) return r;
    if (this.pool.length >= this.maxPopulation) return null;
    const row = { person: this.o.makePerson(this.residents[0]?.archive ?? 0, false), active: false, scheduleEnable: false, scheduleRecycle: false, visible: false, res: null, mine: true, arrival: false, paused: false };
    this.pool.push(row);
    return row;
  }

  /** A body becomes a resident: their outfit, their name, their face, their talk seed. */
  _dress(row, res) {
    const p = row.person;
    p.setIdentity(res.archive, res.guard);
    p.gender = res.gender;
    p.nameNPC = res.name;
    p.personFaceRecordId = res.face;
    p._talkSeed = lwSeed(textSeed(res.id), 0x74616c6b) & 0x7fffffff;   // 'talk': their own, for life
    p.pickpocketAttempted = false;
    p.living = { id: res.id, res, town: this };
    row.res = res;
  }

  _free(row) {
    row.active = false; row.scheduleEnable = false; row.scheduleRecycle = false; row.visible = false; row.arrival = false; row.paused = false; row.flee = null; row.side = 0; row.halt = false;
    if (row.res) this._lag.delete(row.res.id);
    row.res = null;
    if (row.person) row.person.living = null;
  }

  /** A resident taken off the street for the day. @param {Resident} res */
  _take(res) { this._taken.set(res.id, this.dayOf(this._now)); }

  /** WATCH-FIX: a resident with the watch - a guard of it stands for them, this player's or another's. @param {Resident} res */
  _away(res) { return this._lent.has(res.id) || this._peerLent.has(res.id); }

  /**
   * WATCH-FIX: A RESIDENT LENT TO THE WATCH - the conversion stood a guard in their place (scenes/livingWatch.js follows
   * it): off the street while it stands (the body free at once), never taken for the day - the conversion's own take
   * (the street disabled the row) undone.
   * @param {Resident} res
   */
  lend(res) {
    this._lent.add(res.id);
    this._taken.delete(res.id);
    for (const r of this.pool) if (r.res?.id === res.id) this._free(r);
  }

  /** WATCH-FIX: today's resident by id - one of its people (a newcomer by their generation's id), a visitor, a crew's
   *  hand ashore - or null. A guard a load restored names whom he stands for by it alone. @param {string} id */
  residentOf(id) {
    const day = this.dayOf(this._liveMinute());
    return this.peopleOf(day).find((r) => r.id === id) ?? [...this._crewOf.values()].find((c) => c.res.id === id)?.res ?? null;
  }

  /** WATCH-FIX: the guard gone with no body - the resident back to their day (the census stands them where it has them,
   *  as any resident wanted: out of the player's sight). @param {Resident} res */
  back(res) { this._lent.delete(res.id); }

  /**
   * WATCH-FIX: THE RESIDENTS ANOTHER PLAYER'S WATCH STANDS FOR HERE - its records name them (WATCH1's `lr`): off this
   * street while it does, as one's own lent (the body free at once - the peer's guard stands where they stood), back
   * when its record goes. The world is shared; who their guard fought is its owner's.
   * @param {ReadonlySet<string>} ids
   */
  peerLend(ids) {
    this._peerLent = ids;
    if (ids.size) for (const r of this.pool) if (r.res && ids.has(r.res.id)) this._free(r);
  }

  _inView(dx, dz, viewYaw) { return dx * Math.sin(viewYaw) + dz * Math.cos(viewYaw) > 0; }

  /** DFU's hiding: whether a body `dx`, `dz` off the player is out of their sight - beyond POP_VISIBLE_RANGE or behind
   *  them - where a row may come on or go (in sight it does neither). */
  _hidden(dx, dz, viewYaw) { return Math.hypot(dx, dz) > POP_VISIBLE_RANGE || !this._inView(dx, dz, viewYaw); }

  /** WATCH-PROTECTS: what frightens one on the street this frame - the nearest hostile monster (`dangers`, the host's,
   *  [x, z] in the location frame): within PANIC_M, run from; once they ran, kept clear of standing while it is within
   *  FLEE_WARY_M of them (walked back, their day took them to it and they ran again), and for FLEE_HOLD_S after; null
   *  when nothing does. No farther than FLEE_FAR_M from where it began, they cower.
   *  @param {Row} row @param {any} p @param {readonly number[][] | null} dangers @param {number} dt */
  _fright(row, p, dangers, dt) {
    let near = null, best = Infinity;
    for (const d of dangers ?? []) { const m = Math.hypot(d[0] - p.pos[0], d[1] - p.pos[2]); if (m < best) { best = m; near = d; } }
    const run = best < PANIC_M;
    if (run || (row.flee && best < FLEE_WARY_M)) row.flee = { at: near, left: FLEE_HOLD_S, from: row.flee?.from ?? [p.pos[0], p.pos[2]] };
    else if (row.flee && (row.flee.left -= dt) <= 0) row.flee = null;
    if (!row.flee) return null;
    const far = Math.hypot(p.pos[0] - row.flee.from[0], p.pos[2] - row.flee.from[1]) >= FLEE_FAR_M;
    return { at: row.flee.at, run: run && !far };
  }

  /** WATCH-PROTECTS: a frame of running from `fear.at` - straight away from it where the street holds the stride, else
   *  turned a little at a time, to a quarter turn either way; cornered, or done running, they stand.
   *  @param {any} p @param {{ at: number[], run: boolean }} fear @param {number} dt */
  _run(p, fear, dt) {
    p.moving = false;
    if (!fear.run) return;
    const away = Math.atan2(p.pos[0] - fear.at[0], p.pos[2] - fear.at[1]), stride = FLEE_SPEED * dt;
    for (const turn of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, Math.PI / 2, -Math.PI / 2]) {
      const a = away + turn, x = p.pos[0] + Math.sin(a) * stride, z = p.pos[2] + Math.cos(a) * stride;
      if (!this._street.clear(p.pos[0], p.pos[2], x, z)) continue;
      p.pos[0] = x; p.pos[2] = z; p.pos[1] = p.groundY(x, z); p.yaw = a; p.moving = true;
      p.pace = FLEE_SPEED / PERSON_MOVE_SPEED;   // their legs at the run's cadence (residentWalker.js pace)
      return;
    }
  }

  /** The census read: who is wanted on the street now, and the circles at the spots. */
  _tick(playerPos, viewYaw) {
    const t = this._now;
    const day = this.dayOf(t);
    // a row the street disabled itself (the watch's conversion copies the pool's free inline): that resident is taken -
    // WATCH-FIX: and a guard of the watch's standing for them undoes it (`lend`, which frees the row itself when it comes first)
    for (const r of this.pool) if (r.res && !r.active) { this._take(r.res); this._free(r); }
    const roundMin = ROUND_S * this._baseRate();
    /** LW-TALK: every stay at a spot that runs into the last two rounds - the deal is the plans', so every reader deals
     *  alike: one gone from this street alone (taken, struck down) is dealt, and left out after (`absent`); before, the
     *  spot dealt without them, and every pair after them changed on that reader alone */
    /** @type {Map<string, { who: Resident, t0: number, t1: number }[]>} */
    const presence = new Map();
    /** @type {Map<string, any>} */
    const spotOf = new Map();
    const absent = new Set();
    /** LW-TALK: the census's own on this street, each read for where they stand once the beat's circles are dealt */
    const alive = [];
    /** LW-SPACE: everyone the plans stand in this town now, the struck down too (their place is dealt, and left empty) */
    const everyone = [];
    const wanted = [];
    /** @type {{ res: Resident, gap: number }[]} */
    const pending = [];
    if (this.o.harbour && !this.places.dock.length && !this._harbourDock) this.dockSpot();   // LW5: the harbour sounded since
    for (const res of [...this.peopleOf(day), ...this._crewsNow()]) {
      if (this._away(res)) continue;   // WATCH-FIX: with the watch - a guard stands for them
      if (this._gone(res)) continue;   // LW5: aboard, or ashore at the far port
      everyone.push(res);
      const plan = this.planOf(res, day);
      for (let i = Math.max(0, entryAt(plan, t)); i >= 0 && plan[i].t1 > t - 2 * roundMin; i--) {
        const e = plan[i];
        if (e.t0 > t || e.kind === 'walk' || !isOutdoor(e)) continue;
        const list = presence.get(e.at.key) ?? [];
        list.push({ who: res, t0: e.t0, t1: e.t1 });
        presence.set(e.at.key, list);
        spotOf.set(e.at.key, e.at);
      }
      if (this._taken.get(res.id) === day || this.o.deadAt?.(res, t)) {   // LW7: struck down - dead from that minute
        absent.add(res.id);
        const row = this._rowOf(res);
        if (row) this._free(row);   // LW-TALK: and off the street at once, in the player's sight or not - marked to go, the
        continue;                   // dead stood where the player looked till he looked away, unless the host disabled them
      }
      alive.push(res);
    }
    // the circles at every spot two or more stand at (the whole census's, so every reader's circles agree) - LW-TALK: each
    // circle's talk waits for its people to gather, from where the last round stood them (their place in it, else their
    // own about the spot) to their place in this one, at the walking pace (`from`)
    this._inCircle.clear();
    for (const [key, list] of presence) {
      if (list.length < 2) continue;
      const spot = spotOf.get(key);
      const now = spotCircles(key, list, t, roundMin);
      if (!now.length) continue;
      /** @type {Map<string, { x: number, z: number }>} */
      const stood = new Map();
      const before = spotCircles(key, list, now[0].start - 1e-6, roundMin);
      circlesStands(spot, before, this._street).forEach((places, ci) => places.forEach((st, i) => stood.set(before[ci].members[i].id, st)));   // LW-SPACE: the round's circles laid together
      const laid = circlesStands(spot, now, this._street);
      for (const [ci, dealt] of now.entries()) {
        const places = laid[ci];
        let far = 0;
        dealt.members.forEach((m, i) => { const was = stood.get(m.id) ?? aloneStand(spot, m.id, this._street); far = Math.max(far, Math.hypot(places[i].x - was.x, places[i].z - was.z)); });
        const from = dealt.start + (far / PERSON_MOVE_SPEED + GATHER_BEAT_S) * this._baseRate();
        const members = dealt.members.filter((m) => !absent.has(m.id));
        if (members.length < 2) continue;   // left alone on this street: their own counsel
        const circle = { ...dealt, members, from };
        dealt.members.forEach((m, i) => { if (!absent.has(m.id)) this._inCircle.set(m.id, { circle, place: places[i], spot }); });   // LW-SPACE: their place in the round's laying - the deal's, every reader's
      }
    }
    this._spaceAlone(everyone, t);
    // LW-TALK: WHERE EACH ONE STANDS IS READ BY THIS BEAT'S DEAL, dealt above - read before it, an arrival stood the street
    // by the last scene's circles (or none: each one about their own stand) and moved it a beat later, every one dealt
    // into a circle walking off to their place in it as the player came
    for (const res of alive) {
      const at = this.entryOf(res, t);
      if (!at) continue;
      const w = this.where(res, t, false);
      if (!w) continue;
      if (w.pending) { const gap = walkGap(w.e, playerPos); if (gap < LIVING_RANGE + WALK_STRAY_M) pending.push({ res, gap }); continue; }
      const d = Math.hypot(w.x - playerPos[0], w.z - playerPos[2]);
      if (d < LIVING_RANGE) wanted.push({ res, d });
    }
    // AUDIT-G1: THE WALKS NOT SEARCHED YET THAT MAY PASS NEAR - searched here, the nearest first, on the census's own
    // budget (the rest on the beats after). Read at their start, a walk begun beyond the street's reach was never searched
    // (only a row on the street searches its own) and its walker never came on, though they passed beside the player
    if (pending.length) {
      pending.sort((a, b) => a.gap - b.gap || (a.res.id < b.res.id ? -1 : 1));
      this._paths.budget(this._standing() ? ARRIVAL_PATHS_PER_FRAME : CENSUS_PATHS);
      for (const { res } of pending) {
        const w = this.where(res, t, true);
        // LW-PERF: one whose walk is still waiting to be searched is nowhere known yet - wanted on the beat after its
        // search (a row stood off its walk's start was out of the street's reach once its walk was known)
        if (!w || w.pending) continue;
        const d = Math.hypot(w.x - playerPos[0], w.z - playerPos[2]);
        if (d < LIVING_RANGE) wanted.push({ res, d });
      }
    }
    // LW-TALK: THE STREET KEEPS A CIRCLE WHOLE (keepUnits) - its people come on together, nearest first, or wait together
    // (the nearest were taken one by one, and at a busy square 44 of 64 lines went to a partner the street had not stood)
    const keep = keepUnits(wanted, (id) => this._inCircle.get(id)?.circle, this.maxPopulation);
    // the street: a row whose resident is no longer wanted goes when unseen; one wanted again stays
    for (const r of this.pool) if (r.active && r.res) r.scheduleRecycle = !keep.has(r.res);
    // the wanted not yet on the street come on
    if (this.o.suppressSpawns?.()) return;
    for (const res of keep) {
      if (this._rowOf(res)) continue;
      const row = this._freeRow();
      if (!row) break;
      this._dress(row, res);
      row.active = true; row.scheduleEnable = true; row.visible = false; row.scheduleRecycle = false;
      row.arrival = this._standing();   // stood with the street on arrival: seen as soon as it has its place (LW-PERF: while it is being stood)
    }
  }

  /**
   * LW-SPACE: THE PLACES OF THOSE ALONE AT EACH SPOT THIS BEAT (meetups.js aloneStands) - by the plans alone, so every
   * reader places alike: one whose stay holds them at a spot and no circle does, and one on their way to a stay there (a
   * walk brings one early, or late: their place is kept for them, never found on arriving - the paths a reader has
   * searched are its own); the first bound for it first - since they set out for it, or their stays there began (a stall,
   * then the talk, at one spot are one stand) - then the lower id, so no newcomer takes the place of one already there or
   * on their way. The circles' places are taken before
   * them. Kept while the same people stand there with the same circles.
   * @param {readonly Resident[]} everyone @param {number} t
   */
  _spaceAlone(everyone, t) {
    /** @type {Map<string, { spot: any, who: { id: string, t0: number }[] }>} */
    const at = new Map();
    for (const res of everyone) {
      const plan = this.planOf(res, this.dayOf(t)), i = entryAt(plan, t);
      if (i < 0) continue;
      const e = plan[i].kind === 'walk' ? plan[i + 1] : plan[i];   // on their way there: their place kept for them as they come
      if (!e) continue;
      if (e.kind === 'walk' || !isOutdoor(e) || !e.at) continue;
      if (this._inCircle.get(res.id)?.spot === e.at) continue;
      // bound for it since they set out for it (the walk there), through every stay there since (a stall, then the talk)
      let j = i;
      if (plan[j].kind !== 'walk') {
        while (j > 0 && plan[j - 1].at === e.at && plan[j - 1].kind !== 'walk') j--;
        if (j > 0 && plan[j - 1].kind === 'walk' && plan[j - 1].to === e.at) j--;
      }
      const since = plan[j].t0;
      const k = e.at.key, list = at.get(k) ?? { spot: e.at, who: [] };
      list.who.push({ id: res.id, t0: since });
      at.set(k, list);
    }
    /** @type {Map<string, { x: number, z: number }[]>} the circles' places at each spot */
    const circled = new Map();
    for (const c of this._inCircle.values()) {
      const k = c.spot.key, list = circled.get(k) ?? [];
      list.push(c.place);
      circled.set(k, list);
    }
    this._aloneAt.clear();
    for (const [k, { spot, who }] of at) {
      who.sort((a, b) => a.t0 - b.t0 || (a.id < b.id ? -1 : 1));
      const ids = who.map((w) => w.id), taken = circled.get(k) ?? [];
      const sig = `${ids.join(',')}|${taken.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join(';')}`;
      let kept = this._aloneKeep.get(k);
      if (!kept || kept.sig !== sig) this._aloneKeep.set(k, kept = { sig, got: aloneStands(spot, ids, taken, this._street) });
      for (const [id, st] of kept.got) this._aloneAt.set(id, { spot, ...st });
    }
    for (const k of this._aloneKeep.keys()) if (!at.has(k)) this._aloneKeep.delete(k);
  }

  /** LW-FIX2: the clock's minute now - the street's own while it stands (`_now`, read each frame), the clock's own when
   *  it does not (a room's door asks a word, a tone, a refusal while the street is still: `_now` is the minute the
   *  player went in, or nought after a load made indoors). */
  _liveMinute() { return this.o.clock?.() ?? this._now; }

  /** LW-PERF: whether the street is still being stood after an arrival (ARRIVAL_SHOW_S). */
  _standing() { return this._realNow <= this._arrivalUntil; }

  /** The clock's minutes a real second at the walking pace's own rate (a journey's scale left out). */
  _baseRate() { return PERSON_MOVE_SPEED / Math.max(1e-6, this.o.mpm); }

  /**
   * One frame: the census read on its beat, every body laid where its day has it. `playerPos` the player's feet in the
   * location frame; `viewYaw` the camera's yaw; `cameraPos` the eye (location frame); `wantsToStopFn(person)` the
   * street's politeness gate. Answers the live seats - { person, out } - the pool's own reused rows.
   * @param {number} dt @param {number[]} playerPos @param {number} viewYaw @param {number[]} cameraPos @param {boolean} _isDay
   * @param {(person: any) => boolean} [wantsToStopFn]
   */
  update(dt, playerPos, viewYaw, cameraPos, _isDay, wantsToStopFn = () => false) {
    this._now = this.o.clock();
    this._realNow += dt;
    this._timer += dt;
    const stepped = this._lastPlayer ? Math.hypot(playerPos[0] - this._lastPlayer[0], playerPos[2] - this._lastPlayer[2]) : 0;
    this._arriving = this._lastClock === null || Math.abs(this._now - this._lastClock) > ARRIVAL_JUMP_MIN || stepped > ARRIVAL_STEP_M;
    this._lastClock = this._now;
    this._lastPlayer = [playerPos[0], playerPos[1], playerPos[2]];
    if (this._arriving) { this._timer = LIVING_TICK_S; this._arrivalUntil = this._realNow + ARRIVAL_SHOW_S; }   // an arrival reads the census at once
    const standing = this._standing();
    this._paths.cells(standing ? ARRIVAL_PATH_CELLS : PATH_CELLS);   // LW-PERF: the frame's searching, the census's and the street's
    if (this._timer >= LIVING_TICK_S) { this._timer = 0; this._tick(playerPos, viewYaw); }
    this._paths.budget(standing && this.pool.some((r) => r.arrival) ? ARRIVAL_PATHS_PER_FRAME : PATHS_PER_FRAME);
    const rate = this.o.rate();
    const scale = Math.max(1, rate / this._baseRate());
    const out = this._live;
    out.length = 0;
    const seats = this._rows;
    this._onStreet = true;   // LW-PERF: the street's own walks asked first
    const dangers = this.o.dangers?.() ?? null;   // WATCH-PROTECTS: the hostile monsters about (the host's, this frame)
    for (const row of this.pool) {
      if (!row.active || !row.res) continue;
      const res = row.res, p = row.person;
      // WATCH-PROTECTS: one a monster comes near runs from it - their day held while they run, owed as the gate's
      // minutes, and taken up again from where they ran to; frightened, they stop for nobody (the politeness gate is a
      // walk's), and a frame the clock stands still (a talk window open) keeps the fright as it was
      const fear = row.visible ? this._fright(row, p, dangers, dt) : null;
      const stop = row.visible && dt > 0 && !fear ? !!wantsToStopFn(p) : false;
      p.pace = 1;
      // the politeness gate's minutes, owed and walked off - LW-STAND: and a pause's, on a walk not yet searched
      let lag = this._lag.get(res.id) ?? 0;
      if (stop || row.paused || fear) lag += dt * rate;
      else if (lag > 0) lag = Math.max(0, lag - dt * rate * CATCH_UP);
      const w = this.where(res, this._now - lag, true);
      if (!w) { this._free(row); continue; }   // indoors: in through the door, out through the gate
      // LW3: walking to or from the road, in their gear
      const armed = !!w.e.armed && res.cls != null;
      if (armed !== !!p.armed && typeof p.arm === 'function') { if (!armed) p.arm(null); else { const look = this.o.armOf?.(res) ?? null; if (look) p.arm(look); } }
      if (w.e.kind !== 'walk') lag = 0;   // standing at a spot owes nothing
      if (lag > 0) this._lag.set(res.id, lag); else this._lag.delete(res.id);
      // LW-STAND (field, 2026-10-05): a walk not yet searched is a pause where they stand - before, the body kept the
      // stride it had (on its way to its stand) and walked on the spot, into whatever it faced, till the path came; and
      // its minutes are owed (`paused`, above): searched, the walk is walked from where they stood, never cut straight
      // across, through whatever stood between, to where its clock had got to
      row.paused = !!w.pending && row.visible;
      row.halt = stop || row.paused;   // LW-SPACE: held where it stands - one the others step round
      if (fear) this._run(p, fear, dt);
      else if (w.pending) { if (!row.visible) continue; p.moving = false; }
      else {
        const d0 = Math.hypot(w.x - p.pos[0], w.z - p.pos[2]);
        const step = PERSON_MOVE_SPEED * WALK_FAST * dt * scale;
        if (!row.visible || d0 > Math.max(SNAP_M, step * 3)) { p.pos[0] = w.x; p.pos[2] = w.z; p.yaw = w.yaw; p.moving = w.moving; row.side = 0; }
        else if (stop) p.moving = false;   // held by the politeness gate: where it stands, still (DFU's walker idles on the spot) - LW-SPREAD's audit: a body trailing its walk's point walked up to it while held
        else {
          const g = this._dodge(row, p, w, dt);   // LW-SPACE: where they walk this frame, stepped aside for whoever is in the way
          const dx0 = g.x - p.pos[0], dz0 = g.z - p.pos[2];
          const d = Math.hypot(dx0, dz0);
          if (d > 0.05) {
            // LW-STAND: a stand is walked to over the street - by its spot when the straight way is not (every stand at a
            // spot is seen from it, meetups.js): a new round's place across a corner, or across a fountain, from the last
            let vx = dx0, vz = dz0, vd = d;
            if (!w.moving) {
              const ox = w.e.at.x - p.pos[0], oz = w.e.at.z - p.pos[2], od = Math.hypot(ox, oz);
              if (od > 0.05 && !this._street.clear(p.pos[0], p.pos[2], g.x, g.z)) { vx = ox; vz = oz; vd = od; }
            }
            const k = Math.min(1, step / vd);
            p.pos[0] += vx * k; p.pos[2] += vz * k;
            p.yaw = w.moving ? w.yaw : Math.atan2(vx, vz);
            p.moving = true;
          } else { p.pos[0] = g.x; p.pos[2] = g.z; p.yaw = w.yaw; p.moving = w.moving; }
        }
        p.pos[1] = p.groundY(p.pos[0], p.pos[2]);
      }
      const dx = p.pos[0] - playerPos[0], dz = p.pos[2] - playerPos[2];
      const dist = Math.hypot(dx, dz);
      const allowChange = this._hidden(dx, dz, viewYaw);
      // WATCH-DAY: one of the watch wears the uniform on duty and his own clothes off it - changed where nobody sees it
      // (a body not yet stood, or out of the player's sight): never in view
      if (res.guard && p.guard !== !!w.e.duty && (!row.visible || allowChange)) p.setIdentity(w.e.duty ? res.archive : (res.civvies ?? res.archive), !!w.e.duty);
      if (row.scheduleRecycle && allowChange) { this._free(row); continue; }
      if (row.scheduleEnable && !w.pending && (allowChange || w.fromDoor || (row.arrival && standing))) { row.scheduleEnable = false; row.visible = true; row.arrival = false; }
      if (!row.visible) continue;
      const frameOut = p.update(dt, cameraPos, stop);
      const seat = seats[out.length] ??= { person: null, out: null };
      seat.person = p; seat.out = frameOut;
      out.push(seat);
      if (dt > 0 && !fear) this._greet(res, p, dist, stop);   // WATCH-PROTECTS: the frightened greet nobody
    }
    this._onStreet = false;
    this._paths.run();   // LW-PERF: the frame's searching on what the asking left of its cells
    return out;
  }

  /**
   * LW-SPACE: A WALKER STEPS ASIDE - where its day has it this frame (`w`), moved to its right or left (`row.side`) for
   * whoever is in its way: one standing (in a circle, alone, held by the politeness gate), or one coming the other way or
   * across within DODGE_AHEAD_M ahead of it (or between it and that place, where the body trails it), or one going its own
   * way that it is inside of (the lower id keeps its line,
   * the other steps round). Aside to the nearest of DODGE_SIDES that keeps SPACE_M from every one of them and that the
   * street holds - the right before the left, so two coming at each other both keep right - stepped to at DODGE_SPEED,
   * and back to its line once the way is clear. A walker walking up to its stand steps aside till it is DODGE_SETTLE_M
   * off it, never after (it is there); one the politeness gate holds stands where it stood, aside or not (LW-SPREAD's
   * audit: held, it drifted back to its line). DFU's walkers keep off one another by the
   * tiles they claim (MobilePersonMotor.cs SetTargetPosition, CityNavigation's Occupied flag); a resident claims none - its
   * day lays its walk - and the town's people walked inside one another. The day is the plans' (every reader's alike);
   * the step aside, a few hands' breadth, is this reader's street.
   * @param {Row} row @param {any} p @param {{ x: number, z: number, yaw: number, moving: boolean }} w @param {number} dt
   * @returns {{ x: number, z: number }}
   */
  _dodge(row, p, w, dt) {
    const tx = w.x, tz = w.z;
    const toX = tx - p.pos[0], toZ = tz - p.pos[2];
    const yaw = w.moving ? w.yaw : Math.atan2(toX, toZ);
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);   // its way and its right
    const cur = row.side ?? 0;
    let want = row.halt ? cur : 0;   // held, it stands where it stood - aside or not (the politeness gate's hold is whole)
    if (!row.halt && (w.moving || Math.hypot(toX, toZ) > DODGE_SETTLE_M)) {
      const far = Math.max(...DODGE_SIDES) + SPACE_M;
      const back = Math.min(0, -toX * fx - toZ * fz) - SPACE_M;   // the body may trail its day's place: whoever stands between counts
      /** @type {number[]} how far to its right each one in its way stands */
      const inWay = [];
      for (const o of this.pool) {
        if (o === row || !o.active || !o.visible || !o.res) continue;
        const q = o.person, dx = q.pos[0] - tx, dz = q.pos[2] - tz;
        const a = dx * fx + dz * fz, s = dx * rx + dz * rz;
        if (a < back || a > DODGE_AHEAD_M || Math.abs(s) > far) continue;
        if (q.moving && !o.halt && Math.sin(q.yaw) * fx + Math.cos(q.yaw) * fz > 0.7 && (a > SPACE_M || o.res.id > row.res.id)) continue;   // going its way: ahead, or its to step round
        inWay.push(s);
      }
      if (inWay.length) {
        want = cur;
        for (const c of [...DODGE_SIDES].sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur) || b - a)) {
          if (inWay.every((s) => Math.abs(s - c) >= SPACE_M - SPACE_EPS) && this._street.holds(tx + rx * c, tz + rz * c)) { want = c; break; }
        }
      }
    }
    let side = cur + Math.max(-DODGE_SPEED * dt, Math.min(DODGE_SPEED * dt, want - cur));
    if (side !== 0 && !this._street.holds(tx + rx * side, tz + rz * side)) side = 0;
    row.side = side;
    return { x: tx + rx * side, z: tz + rz * side };
  }

  /** A word to the player passing close, at most once in GREET_REST_MIN of the clock - LW-TALK: and one who kept quiet
   *  as the player came by speaks when the player stops before them (the rest was taken by the quiet pass, so the stop
   *  that rule waits for never came: not one of 298 quiet strangers spoke, held before the player). */
  _greet(res, person, dist, stopped) {
    if (dist > GREET_RANGE || this._inCircle.has(res.id)) return;
    const last = this._greeted.get(res.id);
    if (last && this._now >= last.t && this._now - last.t < GREET_REST_MIN && (last.said || !stopped)) return;   // AUDIT-E6: a clock gone back (a load) forgets the rest
    const text = this.greetingFor(res, this._now, stopped);
    this._greeted.set(res.id, { t: this._now, said: text != null });
    if (text == null) return;
    this._greetings = this._greetings.filter((g) => g.person !== person && g.until > this._realNow);
    this._greetings.push({ person, text, until: this._realNow + GREET_S });
  }

  /**
   * The word a resident has for the player passing close at minute `t`: a friend's by name, an enemy's cold, a known
   * face's plain, a stranger's now and then (and always when the player stops before them) - else null. A word said
   * notes them seen. LW8b: the street's (`_greet`) and a room's (scenes/livingIndoors.js).
   * @param {Resident} res @param {number} t @param {boolean} stopped @returns {string|null}
   */
  greetingFor(res, t, stopped) {
    const rel = this.o.relations?.() ?? null;
    const day = this.dayOf(t);
    const standing = rel ? rel.standing(res.id, day) : 'neutral';
    const cold = standing === 'enemy' || standing === 'hostile';
    // WATCH-KNOWS: one of the watch on duty speaks for the law - the player's standing with the town's region, not his own
    // regard (one with a grudge of his own stays cold)
    const law = !cold && res.guard && this.entryOf(res, t)?.e.duty ? this.o.legalStanding?.(this.o.town.region) ?? null : null;
    const pool = law ? WATCH_GREETINGS[watchBand(law.rep, law.known)] : standing === 'friend' ? LIVING_GREETINGS.friend : cold ? LIVING_GREETINGS.enemy
      : rel?.known(res.id) ? LIVING_GREETINGS.known : LIVING_GREETINGS.stranger;
    // a stranger says something only now and then (and always when the player stops before them) - WATCH-KNOWS: and the
    // watch to a common citizen
    const seldom = pool === LIVING_GREETINGS.stranger || pool === WATCH_GREETINGS.citizen;
    if (seldom && !stopped && (lwSeed(textSeed(res.id), Math.floor(t)) % 4) !== 0) return null;
    rel?.seen(res.id, day);
    return fillLine(pool[lwSeed(textSeed(res.id), Math.floor(t / 7)) % pool.length], { player: this.o.playerName?.() ?? '', town: this.o.townName ?? '' });
  }

  /**
   * What is being said on the street this moment: each talking circle's line (pure - every reader hears it), and the
   * words to the player. Only the residents standing, within `range` of `eye` (location frame).
   * @param {number[]} eye @param {number} [range]
   * @returns {{ person: any, text: string, kind: 'talk' }[]}
   */
  speech(eye, range = LINE_RANGE) {
    const out = [];
    const lineMin = lineMinutes(this._baseRate());
    const ctx = this.lineCtx(this._now);
    this._greetings = this._greetings.filter((g) => g.until > this._realNow);
    if (this._scripts.size > 4096) this._scripts.clear();
    /** LW-TALK: a circle's line is said aloud to a circle that stands together on this street - every one of them stood
     *  and at their place (22-84% of the first cut's lines were said while their circle was still walking together, or
     *  to one the street had not stood) - WATCH-PROTECTS: and none of them frightened (`flee`): scattered from a monster,
     *  standing clear of it, the circle is silent */
    const standing = new Set(this.pool.filter((r) => r.visible && r.res && !r.person.moving && !r.flee).map((r) => r.res.id));
    for (const row of this.pool) {
      if (!row.visible || !row.res || row.flee) continue;   // WATCH-PROTECTS: the frightened say nothing
      const p = row.person;
      if (Math.hypot(p.pos[0] - eye[0], p.pos[2] - eye[2]) > range) continue;
      const c = this._inCircle.get(row.res.id);
      if (c) {
        const line = circleLine(c.circle, this._now, lineMin, ctx, this._scripts);
        if (line && line.who.id === row.res.id && c.circle.members.every((m) => standing.has(m.id))) out.push({ person: p, text: line.text, kind: /** @type {'talk'} */ ('talk') });
        continue;
      }
      const g = this._greetings.find((x) => x.person === p);
      if (g) out.push({ person: p, text: g.text, kind: /** @type {'talk'} */ ('talk') });
    }
    return out;
  }

  /**
   * What the town's talk knows at minute `t`: the town, the region, the weather, the hour, the road's news (LW4) and the
   * deeds' beside it (LW7), the character's name for a deed's. The street's circles' (`speech`) and LW8b's rooms'.
   * @param {number} t
   * @returns {{ town?: string, region?: string, weather: string|null, hour: number, news: any[]|null, places: readonly string[]|null, player?: string }}
   */
  lineCtx(t) {
    const hour = Math.floor((((t % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60);
    /** @type {{ town?: string, region?: string, weather: string|null, hour: number, news: any[]|null, places: readonly string[]|null, player?: string }} */
    const ctx = { town: this.o.townName, region: this.o.regionName, weather: this.o.weather?.() ?? null, hour, news: this._roads?.news ?? null, places: this._roads?.places ?? null };   // LW4: the road's news; LW-TALK: its towns
    const deeds = this.deedNews(t);   // LW7: the deeds' news beside the road's, and the character's name for it
    if (deeds.length) ctx.news = [...(ctx.news ?? []), ...deeds];
    const kin = this.o.familyNews?.(t) ?? [];   // LEGACY6: what the town says of Project Legacy's house (legacy/influence.js newsFor)
    if (kin.length) ctx.news = [...(ctx.news ?? []), ...kin];
    ctx.player = this.o.playerName?.() ?? '';
    return ctx;
  }

  /** LW8b: the meetings' beat on the town's clock - a round (meetups.js ROUND_S) and a line (the crew's), in its minutes. */
  talkBeat() {
    return { roundMin: ROUND_S * this._baseRate(), lineMin: lineMinutes(this._baseRate()) };
  }

  /** LW8b: a building's type (BUILDING_TYPES) by its key, or -1. @param {number} key */
  typeOf(key) {
    return this.places.types.get(key) ?? -1;
  }

  /** RR2's trample, and any seam that takes a walker off the street: that resident is gone for the day. */
  retire(person) {
    for (const r of this.pool) {
      if (r.person !== person) continue;
      if (r.res) this._take(r.res);
      this._free(r);
      return true;
    }
    return false;
  }

  /** The player spoke with this body: a word noted in the resident's regard. Answers the resident's id, or null. */
  talked(person) {
    const id = person?.living?.id;
    if (!id) return null;
    this.o.relations?.()?.note(id, 'talk', this.dayOf(this._liveMinute()));
    return id;
  }

  /** LW3: a hand caught in a body's resident's purse - a crime they saw, noted in their regard; LW7: and in the regard of
   *  every resident who saw it. */
  caught(person) {
    const id = person?.living?.id;
    if (!id) return null;
    const day = this.dayOf(this._now);
    const rel = this.o.relations?.();
    rel?.note(id, 'crime', day);
    for (const w of this.witnesses(person.pos, id)) rel?.note(w.id, 'crime', day);
    return id;
  }

  /**
   * LW7: THE RESIDENTS WHO SEE A DEED at `at` (the location frame): every one on the street within WITNESS_M with a clear
   * line to it (`o.sees`, from their eyes), but `exceptId`.
   * @param {number[]|null|undefined} at @param {string|null} [exceptId] @returns {Resident[]}
   */
  witnesses(at, exceptId = null) {
    if (!at) return [];
    const out = [];
    for (const row of this.pool) {
      if (!row.visible || !row.res || row.res.id === exceptId) continue;
      const p = row.person.pos;
      if (Math.hypot(p[0] - at[0], p[2] - at[2]) > WITNESS_M) continue;
      if (this.o.sees && !this.o.sees([p[0], p[1] + 1.6, p[2]], [at[0], at[1] + 1, at[2]])) continue;
      out.push(row.res);
    }
    return out;
  }

  /**
   * LW7: A RESIDENT'S OWN - who takes their death as their own: the household they live in (today's people sharing
   * their home), the party they came with (a visitor's), the crew they came ashore with (a packet's).
   * @param {Resident} res @returns {Resident[]}
   */
  kinOf(res) {
    const day = this.dayOf(this._now);
    const visit = this._roads?.visitorOf.get(res.id) ?? null;
    if (visit) return visit.trip.party.filter((m) => m.id !== res.id);
    const crew = this._crewOf.get(res.id) ?? null;
    if (crew) return [...this._crewOf.values()].filter((c) => c.res.id !== res.id && c.berth?.lane?.key === crew.berth?.lane?.key && c.berth?.k === crew.berth?.k).map((c) => c.res);
    // AUDIT LEGACY II B2: a household is its census house - or, for those living here beyond the census (Project Legacy's
    // line, `household`), their own: a line lent a census house shared it with the census's people, and a stranger
    // struck down turned the player's own sister against them (and the line's death, the strangers)
    const hh = householdKeyOf(res);
    if (hh == null) return [];
    return this.peopleOf(day).filter((r) => r.id !== res.id && householdKeyOf(r) === hh);
  }

  /**
   * LW7: A BODY'S RESIDENT STRUCK DOWN by the player (DFU's one-hit civilian): dead for good from this minute (`o.slay`),
   * their own turned against the player (`slain`), and every resident who saw it noting the crime. Answers the
   * resident's id, or null.
   */
  slain(person) {
    const res = person?.living?.res;
    if (!res || person.living.town !== this) return null;
    const day = this.dayOf(this._now);
    const rel = this.o.relations?.();
    const seen = this.witnesses(person.pos, res.id);
    this.o.slay?.(res, this._now, seen.length > 0);
    for (const kin of this.kinOf(res)) rel?.note(kin.id, 'slain', day);
    for (const w of seen) rel?.note(w.id, 'crime', day);
    this._lent.delete(res.id);   // WATCH-FIX: his guard cut down
    this._take(res);
    return res.id;
  }

  /**
   * WATCH-FIX: A BODY'S RESIDENT KILLED BY ANOTHER HAND than the player's - one of the watch whose guard a beast, a fall,
   * a reflected blow or another player cut down: dead for good from this minute (`o.killed` - the hand death `killed`,
   * which empties the place as any), and nobody's regard of the player moved. Answers the resident's id, or null.
   */
  killed(person) {
    const res = person?.living?.res;
    if (!res || person.living.town !== this) return null;
    this.o.killed?.(res, this._now);
    this._lent.delete(res.id);
    this._take(res);
    return res.id;
  }

  /** LW7: one of the watch STRUCK by the player (the assault that turns them on the player): the blow in their regard, and
   *  the crime in every witness's. Answers the resident's id, or null. */
  struck(person) {
    const res = person?.living?.res;
    if (!res || person.living.town !== this) return null;
    const day = this.dayOf(this._now);
    const rel = this.o.relations?.();
    rel?.note(res.id, 'struck', day);
    for (const w of this.witnesses(person.pos, res.id)) rel?.note(w.id, 'crime', day);
    return res.id;
  }

  /** LW7: a word asked in the talk's tone - a courteous one (`polite`, tone 0) or a blunt one (`insulted`, tone 2), each
   *  once a day. Answers the resident's id, or null. @param {any} person @param {number} tone */
  toned(person, tone) {
    const id = person?.living?.id;
    const kind = tone === 0 ? 'polite' : tone === 2 ? 'insulted' : null;
    if (!id || !kind) return null;
    this.o.relations?.()?.note(id, kind, this.dayOf(this._liveMinute()));
    return id;
  }

  /**
   * LW7: WHAT THE TOWN SAYS OF THE DEEDS - each of its own the player struck down (`slain`), known DEED_KNOWN_MIN after,
   * for NEWS_DAYS: `who` their name, `seen` whether anyone saw whose hand it was; each who died fighting at the
   * player's side (`died`); WATCH-FIX: each another hand cut down in its street (`killed`), `watch` one of the watch's.
   * The character's own, read over the town's pure news (relations.js turns).
   * @returns {{ kind: string, who: string, foe: string, place: string, t: number, seen: boolean, watch?: boolean }[]}
   */
  deedNews(t = this._now) {
    const turns = this.o.relations?.()?.turns?.();
    if (!turns || (!turns.slain?.size && !turns.died?.size && !turns.killed?.size && !turns.home?.size)) return [];
    const prefix = `L${this.o.town.mapId >>> 0}.`;
    const out = [];
    for (const kind of /** @type {const} */ (['slain', 'died', 'killed'])) {   // WATCH-FIX: and one of the watch another hand cut down
      for (const [key, h] of turns[kind] ?? []) {
        const known = h.t + DEED_KNOWN_MIN;
        if (!key.startsWith(prefix) || !(known <= t && t - known < NEWS_DAYS * DAY_MIN)) continue;
        const place = key.slice(0, key.lastIndexOf('@'));
        const res = this.residents.find((r) => placeKeyOf(r) === place);
        const who = h.who || res?.name || '';
        if (who) out.push({ kind, who, foe: '', place: '', t: known, seen: !!h.seen, watch: !!res?.guard });   // WATCH-FIX: one of the watch's, told as one
      }
    }
    // LW6d: the tales - a keepsake of one of its own carried home, told by the name of the one it was
    for (const [key, h] of turns.home ?? []) {
      const known = h.t + DEED_KNOWN_MIN;
      if (!key.startsWith(prefix) || known > t || t - known >= NEWS_DAYS * DAY_MIN || !h.who) continue;
      out.push({ kind: 'home', who: h.who, foe: '', place: '', t: known, seen: true });
    }
    return out.sort((a, b) => b.t - a.t);
  }

  /**
   * LW6c: CARRIED HOME - the player speaking with one of a household while carrying the keepsake of one of theirs the
   * deep kept (keepsake.js): it is handed over (`o.takeKeepsake`), the one spoken with remembers it (`saved`) and the
   * rest of the household too (`helped`), and theirs are the moment's words (LIVING_KEEPSAKE). Answers the words, or null.
   * @param {any} person @returns {string[]|null}
   */
  moment(person) {
    const res = person?.living?.res;
    if (!res || res.household != null) return null;   // AUDIT LEGACY II B2: a keepsake is a census household's - never the line's in its house
    const item = keepsakeFor(this.o.keepsakes?.() ?? [], res.town, res.home, res.id, (id) => this._homeOfPlace(id));   // LW-FIX1: their own town's home - a visitor's is in theirs; AUDIT-C1: a traveller's off this town's census
    if (!item) return null;
    this.o.takeKeepsake?.(item);
    const rel = this.o.relations?.();
    const now = this.o.clock?.() ?? this._now;   // the clock's own minute - a room's door asks it while the street stands still
    const day = this.dayOf(now);
    rel?.note(res.id, 'saved', day);
    for (const k of this.kinOf(res)) if (k.town === res.town) rel?.note(k.id, 'helped', day);   // LW-FIX1: their own, never another town's same-numbered house
    rel?.turn('home', `${item.livingKeepsake.id}@home`, { t: now, who: item.livingKeepsake.name });   // LW6d: a tale its town tells
    const words = LIVING_KEEPSAKE[lwSeed(textSeed(res.id), textSeed(item.livingKeepsake.id)) % LIVING_KEEPSAKE.length];
    return words.map((w) => fillLine(w, { who: firstNameOf(item.livingKeepsake.name), player: this.o.playerName?.() ?? '' }));
  }

  /** AUDIT-C1: the home this town's census gives the place `id` names (a newcomer's generation aside), or null. @param {string} id */
  _homeOfPlace(id) {
    const place = String(id ?? '').split('~')[0];
    return this.residents.find((r) => r.id === place)?.home ?? null;
  }

  /** What a body's resident says instead of talking, when they count the player an enemy - else null. */
  refuses(person) {
    const id = person?.living?.id;
    const rel = this.o.relations?.();
    if (!id || !rel) return null;
    const s = rel.standing(id, this.dayOf(this._liveMinute()));
    return s === 'enemy' || s === 'hostile' ? fillLine(LIVING_REFUSAL, { a: firstNameOf(person.nameNPC) }) : null;
  }
}
