// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): THE DAY - what a resident does from one 04:00 to the next, drawn
// from their seed and the day's number, so it is the same day for every reader and a new one tomorrow.
//
// THE DAY TURNS AT 04:00 (DAY_START_MIN): the one hour everyone is abed - the larks rise at five, the night owls are in
// by two - so no night is cut in half by the turn. Each day is a run of ENTRIES covering every minute of it once:
// a stay at a place (a building, through its door; a spot in the street) or a WALK from one place to the next. The
// walk's minutes are the walk itself at the resident's pace (`mpm`, metres a minute of the clock: LW0 decision 3) over
// the grid's own distance and a detour; the host walks the real path (townPaths.js) and the resident arrives when the
// path says (`realised`).
//
// WHAT IS SEEN. A walk, and a stay at a spot (`OUTDOOR`), is in the street; a stay at a building is behind its door.
// THE JOB SETS THE DAY - the keeper keeps the shop from eight to six, the innkeeper serves into the small hours, the
// farmer is in the fields by six, the watch walks its beat in shifts - and the TEMPER, the drink, the piety and the
// liking for company set the rest: the errand, the meal, the evening's tavern, temple or square, a neighbour visited.
//
// WATCH-DAY (2026-10-05, Mac: "improve the guards" - asked, the night watch, gate posts and pairs, the uniform only on
// duty): THE WATCH KEEPS THE TOWN ROUND THE CLOCK. Four companies of it (census.js WATCH_COMPANIES) turn through the day's
// shift, the evening's and the night's, the fourth day off; in each, two of a company walk a patrol together on the
// patrol's own stops, the rest stand POSTS at the town's gates; the night runs past the day's turn, and the next day
// begins where it stands. On duty - the walk out, the watch, the walk home - they are in uniform (`duty`); off it, the
// town's people in their own clothes. The watch keeps its shift from its hour to its end: whatever its bedtime, an
// evening off left in time to walk out, and in a great city the morning's walk out begun before the day's turn.
//
// AWAY: a window the roads hold the resident (trips.js) is handed in and the day bends round it - geared at home (an
// armed traveller), walked out to the exit facing the road, away, walked home after; every walk to or from an away
// window ARMED (LW0 decision 5 - the host draws the class sprite).
import { NAV_CELL } from '../../world/cityNavigation.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { lwRng, lwSeed, rollInt, pickOf } from './seed.js';
import { hasShopJob, WATCH_COMPANIES } from './census.js';
import { exitNearest } from './places.js';
import { MOBILE_TYPES } from '../../characters/mobileTypes.js';
import { GUILDS } from '../guilds.js';
import { ORDERS } from '../guildVariants.js';

/** The living day turns at 04:00 (minutes after midnight). */
export const DAY_START_MIN = 240;
export const DAY_MIN = 1440;
/** A stay shorter than this (minutes) is not made: the walk to it is spared. */
export const MIN_STAY = 8;
/** The grid distance a walk covers is its Manhattan cells times this (corners, crowds), and this many metres more. */
export const WALK_DETOUR = 1.2;
export const WALK_EXTRA_M = 2;
/** How long an armed traveller takes to gear up at home before the walk out (minutes). */
export const GEAR_MIN = 30;
/** A gap between two stays this much longer than the walk home and back (minutes) is spent at home. */
export const HOME_GAP = 30;

/** The kinds seen in the street (LW-STIR: `gate`, a stranger halted at a gate the watch keeps, come in by it). */
export const OUTDOOR = Object.freeze(new Set(['walk', 'market', 'social', 'stall', 'beg', 'dock', 'watch', 'post', 'gate']));

/**
 * @typedef {import('./places.js').Spot} Spot
 * @typedef {import('./places.js').Places} Places
 * @typedef {import('./census.js').Resident} Resident
 * @typedef {{ from: Spot, to: Spot, t0: number, t1: number, kind: 'post'|'watch', mark: { duty: boolean, pair: 0|1|null } }} MorningWalk -
 *   WATCH-DAY: a walk out to the day's watch across the day's turn (morningWalk)
 * @typedef {{ kind: string, at: Spot, t0: number, t1: number, from?: Spot, to?: Spot, armed?: boolean, duty?: boolean, pair?: 0|1|null }} Entry -
 *   minutes on the clock (classic minutes, the day's own numbers); a walk carries `from` and `to`, `at` its end; WATCH-DAY
 *   `duty` one of the watch on duty (in uniform), `pair` his place in a patrol's pair
 * @typedef {{ t0: number, t1: number, exit?: Spot|null, armed?: boolean, halt?: number }} Away
 */

/** The minute an hour of `day` begins (hours past 24 run into the small hours of the next calendar day). */
const hourOf = (day, h) => day * DAY_MIN + Math.round(h * 60);

/** A walk's minutes between two spots at `mpm` metres a minute: none for the same cell, at least one. */
export function walkMinutes(a, b, mpm) {
  if (!a || !b) return 0;
  const cells = Math.abs(a.cell[0] - b.cell[0]) + Math.abs(a.cell[1] - b.cell[1]);
  if (cells === 0) return 0;
  return Math.max(1, Math.ceil((cells * NAV_CELL * WALK_DETOUR + WALK_EXTRA_M) / Math.max(0.1, mpm)));
}


/** WATCH-DAY: the watch's three shifts of a living day, in its hours (DAY_START_MIN is 04:00, so hour 30 is 06:00 the
 *  next morning): the day's 06-14, the evening's 14-22, the night's 22-06 - the night runs past the day's turn, and the
 *  next day's plan begins where it stands. */
export const WATCH_SHIFTS = Object.freeze([Object.freeze([6, 14]), Object.freeze([14, 22]), Object.freeze([22, 30])]);
/** WATCH-DAY: the watch's rotation - a watchman's shift is a shift later each day, the fourth day off: day, evening,
 *  night, off. Never a shift begun inside eight hours of the last one's end. */
export const WATCH_ROTATION = WATCH_COMPANIES;
/** WATCH-DAY: a patrol's stop, its least and most minutes. */
export const PATROL_STOP_MIN = MIN_STAY + 4;
export const PATROL_STOP_MAX = MIN_STAY + 14;

/**
 * WATCH-DAY: ONE OF THE WATCH'S DUTY on `day`. `size` the watch's strength a shift (census.js watchShiftSize - the
 * watch is four companies of it, one to each day of the rotation). A watchman's COMPANY is his slot's residue - the
 * slots that share it share a shift every day, so the same men stand a watch together - his RANK his place in it.
 * The first two of a company PATROL together, a pair (one alone where the company is one); the rest are POSTED at the
 * town's gates, one to an exit (the gate each keeps turns by the day); more than the gates patrol too.
 * @param {Resident} res @param {Places} places @param {number} day @param {number} size
 * @returns {{ shift: number, company: number, rank: number, kind: 'post'|'patrol', post: Spot|null, patrol: number, pair: 0|1|null }}
 *   `shift` 0 day, 1 evening, 2 night, 3 off; `patrol` which of the company's patrols, `pair` his place in it (null alone)
 */
export function watchDuty(res, places, day, size = 1) {
  const company = res.slot % WATCH_ROTATION, rank = Math.floor(res.slot / WATCH_ROTATION);
  const shift = (company + day) % WATCH_ROTATION;
  const exits = [...places.exits].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const posts = size >= 3 ? Math.min(exits.length, size - 2) : 0;
  if (rank >= 2 && rank - 2 < posts) {
    const turn = lwSeed(res.town, 0x706f7374, company, day) % exits.length;   // 'post'
    return { shift, company, rank, kind: 'post', post: exits[(rank - 2 + turn) % exits.length], patrol: -1, pair: null };
  }
  const i = rank < 2 ? rank : rank - posts, patrols = Math.max(1, size - posts);
  const alone = patrols % 2 === 1 && i === patrols - 1;
  return { shift, company, rank, kind: 'patrol', post: null, patrol: Math.floor(i / 2), pair: alone ? null : /** @type {0|1} */ (i % 2) };
}

/** WATCH-DAY: a patrol's beat for a shift - a DISTRICT of the town: four to six of its spots (its exits, its social
 *  spots, its markets), the nearest about an anchor the patrol draws, walked as a ring about their middle - the
 *  patrol's own, so both of a pair walk it. The first cut drew a guard's stops from the whole town, and in a great
 *  city a leg ran past an hour of the clock: the beat ran out of stops it could reach hours before the shift's end.
 *  @param {Places} places @param {number} town @param {number} company @param {number} patrol @param {number} day
 *  @param {number} shift @returns {Spot[]} */
export function patrolBeat(places, town, company, patrol, day, shift) {
  const rng = lwRng(town, 0x62656174, company, patrol, day, shift);   // 'beat'
  const pool = [...places.exits, ...places.social, ...places.market];
  if (!pool.length) return [];
  const anchor = pool[Math.floor(rng() * pool.length)];
  const n = Math.min(pool.length, rollInt(rng, 4, 6));
  const gap = (/** @type {Spot} */ a) => Math.abs(a.cell[0] - anchor.cell[0]) + Math.abs(a.cell[1] - anchor.cell[1]);
  const near = pool.map((sp) => ({ sp, d: gap(sp) })).sort((a, b) => a.d - b.d || (a.sp.key < b.sp.key ? -1 : a.sp.key > b.sp.key ? 1 : 0)).slice(0, n).map((x) => x.sp);
  const cx = near.reduce((a, sp) => a + sp.x, 0) / near.length, cz = near.reduce((a, sp) => a + sp.z, 0) / near.length;
  const bearing = (/** @type {Spot} */ sp) => Math.atan2(sp.x - cx, sp.z - cz);
  return near.sort((a, b) => bearing(a) - bearing(b) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * WATCH-DAY: A PATROL'S STOPS laid on the clock, from the beat's `first` spot at `from` to `until`: each a stay of
 * PATROL_STOP_MIN to PATROL_STOP_MAX minutes and the walk to the next - so the two of a pair are at the same stop at the
 * same minute, whatever their homes. `hold`: the last stop kept to `until` (the night's, held over the day's turn, so
 * the next day's plan begins there), a stop too late to be made dropped first.
 * @param {readonly Spot[]} beat @param {() => number} rng @param {number} first @param {number} from @param {number} until
 * @param {number} mpm @param {boolean} [hold] @returns {{ at: Spot, i: number, from: number, dur: number }[]}
 */
export function patrolStops(beat, rng, first, from, until, mpm, hold = false) {
  const out = [];
  for (let t = from, i = first; beat.length && t < until; i++) {
    const at = beat[i % beat.length], next = beat[(i + 1) % beat.length];
    const dur = rollInt(rng, PATROL_STOP_MIN, PATROL_STOP_MAX);
    out.push({ at, i: i % beat.length, from: t, dur });
    t += dur + walkMinutes(at, next, mpm);
  }
  if (hold) {
    while (out.length > 1 && out[out.length - 1].from > until - MIN_STAY * 2) out.pop();
    if (out.length) { const last = out[out.length - 1]; last.dur = until - last.from; }
  }
  return out;
}

/**
 * WATCH-DAY: THE NIGHT'S END - where one of the watch stands at the day's turn after a night shift, read off the
 * night's own plan (his post, or his patrol's last stop held over 04:00), and what he keeps to 06:00: the next day's
 * plan begins there. The first cut replayed the night's stops apart from its plan, and a man the clock had put
 * elsewhere began the morning at a post he had left. Nobody on watch at the turn (a beat with no spots), nothing.
 * @param {Resident} res @param {Places} places @param {number} day - the night's own day @param {number} size @param {number} mpm
 * @returns {{ at: Spot, kind: 'post'|'watch', pair: 0|1|null, stops: { at: Spot, from: number, dur: number }[] } | null}
 */
export function nightTail(res, places, day, size, mpm) {
  const d = watchDuty(res, places, day, size);
  if (d.shift !== 2) return null;
  const night = dayPlan(res, places, day, { mpm, watch: size });   // the watch never takes the roads: no away windows
  const last = night[night.length - 1];
  if (!last?.duty) return null;
  const D1 = (day + 1) * DAY_MIN + DAY_START_MIN, morning = hourOf(day, WATCH_SHIFTS[2][1]);
  if (last.kind === 'post') return { at: last.at, kind: 'post', pair: null, stops: [{ at: last.at, from: D1, dur: morning - D1 }] };
  const beat = patrolBeat(places, res.town, d.company, d.patrol, day, 2);
  const tail = patrolStops(beat, lwRng(res.town, 0x7461696c, d.company, d.patrol, day), beat.indexOf(last.at), D1, morning, mpm, true);   // 'tail' - held to six
  return { at: last.at, kind: 'watch', pair: d.pair, stops: tail };
}

/**
 * WATCH-DAY: THE MORNING'S WALK OUT, BEGUN THE NIGHT BEFORE - one of the day's watch whose walk from his door to his
 * post or his patrol's first stop is longer than the two hours from the day's turn to six (a great city's far house)
 * leaves before the turn: his day off ends with the walk and his day begins with it, one walk across 04:00. The first
 * cut began every day at home at the turn, and in a great city half the day's watch came on up to an hour late - the
 * night's man gone home at six, the gate empty. Null where the walk fits the morning.
 * @param {Resident} res @param {Places} places @param {number} day - the day of the day's watch @param {number} size @param {number} mpm
 * @returns {{ from: Spot, to: Spot, t0: number, t1: number, kind: 'post'|'watch', mark: { duty: boolean, pair: 0|1|null } } | null}
 */
export function morningWalk(res, places, day, size, mpm) {
  const d = watchDuty(res, places, day, size);
  if (d.shift !== 0) return null;
  const home = res.home != null ? places.doors.get(res.home) ?? null : null;
  const to = d.kind === 'post' ? d.post : patrolBeat(places, res.town, d.company, d.patrol, day, 0)[0] ?? null;
  if (!home || !to) return null;
  const t1 = hourOf(day, WATCH_SHIFTS[0][0]), t0 = t1 - walkMinutes(home, to, mpm);
  return t0 < day * DAY_MIN + DAY_START_MIN ? { from: home, to, t0, t1, kind: d.kind === 'post' ? 'post' : 'watch', mark: { duty: true, pair: d.pair } } : null;
}

/** LW-PERF: each town's favourites, kept by its places (a resident's are their seed's alone, the same every day). */
const favouritesOf = new WeakMap();

/**
 * A resident's favourite places, the same every day (their seed alone): the two social spots they keep to - so the
 * same people meet at the same places, day after day - their tavern, their temple and their market. LW-PERF: kept, by
 * the town's places - the sorting of a great city's four hundred doors was three quarters of every day's plan, and a
 * city's whole census is planned at once (an arrival, the day's turn).
 * @param {Resident} res @param {Places} places @param {Spot|null} home
 */
export function favourites(res, places, home) {
  let kept = favouritesOf.get(places);
  if (!kept) { kept = new Map(); favouritesOf.set(places, kept); }
  const key = `${res.town}|${res.roll}|${res.slot}|${home?.key ?? ''}`;
  let fav = kept.get(key);
  if (!fav) { fav = favouritesNow(res, places, home); kept.set(key, fav); }
  return fav;
}

/** LW-PERF: a town's doors by the kind a favourite asks (in the doors' own order), and each spot's place in the order
 *  of the keys (the nearness sorts' tie, read once - a key compared as text in every comparison of every sort was most
 *  of a plan). Kept by the town's places. */
const doorKindsOf = new WeakMap();
/** @param {Places} places */
function doorKinds(places) {
  let k = doorKindsOf.get(places);
  if (!k) {
    /** @type {Spot[]} */ const tavern = [], temple = [], shops = [], houses = [], outfitters = [];
    /** @type {Map<number, Spot[]>} LW-ERRANDS: the guild halls by their guild's faction */
    const halls = new Map();
    for (const [key, spot] of places.doors) {
      const t = places.types.get(key) ?? -1;
      if (t === BUILDING_TYPES.Tavern) tavern.push(spot);
      if (t === BUILDING_TYPES.Temple) temple.push(spot);
      if (t === BUILDING_TYPES.GuildHall) { const f = places.factions?.get(key) ?? 0; halls.set(f, [...(halls.get(f) ?? []), spot]); }
      if (hasShopJob(t)) shops.push(spot);
      if (t >= BUILDING_TYPES.House1 && t <= BUILDING_TYPES.House6) houses.push(spot);
      if (t === BUILDING_TYPES.Armorer || t === BUILDING_TYPES.WeaponSmith || t === BUILDING_TYPES.Alchemist) outfitters.push(spot);
    }
    const spots = [...new Set([...places.doors.values(), ...places.social, ...(places.corners ?? []), ...(places.squares ?? []), ...places.market])].sort((a, b) => a.key.localeCompare(b.key));
    const orders = [...halls].filter(([f]) => ORDER_FACTIONS.has(f)).flatMap(([, list]) => list);
    k = { tavern, temple, halls, orders, shops, houses, outfitters, rank: new Map(spots.map((s, i) => [s, i])) };
    doorKindsOf.set(places, k);
  }
  return k;
}

/** The spots of `list` by manhattan nearness to `from` (the first the nearest), the key's order breaking a tie; with no
 *  `from`, as they stand. @param {Places} places @param {readonly Spot[]} list @param {Spot|null} from */
function nearestOf(places, list, from) {
  const out = [...list];
  if (!from) return out;
  const fx = from.cell[0], fy = from.cell[1], rank = doorKinds(places).rank;
  return out.sort((a, b) => (Math.abs(a.cell[0] - fx) + Math.abs(a.cell[1] - fy)) - (Math.abs(b.cell[0] - fx) + Math.abs(b.cell[1] - fy))
    || (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
}

/** LW-SPREAD: the share of a town who keep to its square from wherever they live (the rest keep to it where it is one of
 *  the social spots nearest their home), how many of the social spots (and of the markets) nearest home a favourite is
 *  drawn from, and how late after its hour one goes out for the evening (minutes, their own each day - the town went
 *  out on the hour). */
export const SQUARE_LIKE = 0.2;
export const SOCIAL_NEAR = 3;
export const EVENING_SPREAD_MIN = 75;
/** One who drinks over this goes to the tavern of an evening (three times in four) - AUDIT LW-STIR D2: LW-STIR's DRINKER
 *  (`stir.js`: who falls out four times as often of an evening) is this one, read, never a second literal. */
export const TAVERN_DRINK = 0.55;
/** LW-SPREAD: the hours a homemaker goes to the morning's market between (the first cut's one hour, 08:30-09:30, stood a
 *  hamlet's every homemaker at its one store's front at once). */
export const MARKET_HOURS = Object.freeze([7.5, 10.5]);

/**
 * LW-SPREAD: THE SQUARE'S POINT A RESIDENT KEEPS TO - one of its points (places.js `squares`), their seed's alone, the
 * same every day; none without a square. Whatever takes them to the square takes them there (dayPlan's intents): a
 * stall, the talk, the market, a stroll's stop, a labourer's job - the watch's beat aside, its stops a patrol's pair's.
 * @param {Resident} res @param {Places} places @returns {Spot|null}
 */
export function squareOf(res, places) {
  const pts = places.squares?.length ? places.squares : places.square ? [places.square] : [];
  return pts.length ? pts[lwSeed(res.town, res.roll.charCodeAt(0), res.slot, 0x73717561) % pts.length] : null;   // 'squa'
}

/** LW-ERRANDS: THE GUILDS A TOWN SHOWS - the Mages Guild and the Fighters Guild (guilds.js GUILDS) and the ten knightly
 *  orders (guildVariants.js ORDERS, KnightlyOrder.Orders); the thieves' two keep no hall on the street. */
export const MAGES_GUILD = GUILDS.MagesGuild.factionId;
export const FIGHTERS_GUILD = GUILDS.FightersGuild.factionId;
export const ORDER_FACTIONS = /** @type {ReadonlySet<number>} */ (Object.freeze(new Set(Object.values(ORDERS))));
/** LW-ERRANDS: Daggerfall's eighteen classes stand in three runs of six (MOBILE_TYPES 128-133 the mage's, 134-139 the
 *  thief's, 140-145 the warrior's - the character's own class list). @param {number|null|undefined} cls */
export const isMageClass = (cls) => cls != null && cls >= MOBILE_TYPES.Mage && cls <= MOBILE_TYPES.Nightblade;
/** @param {number|null|undefined} cls */
export const isWarriorClass = (cls) => cls != null && cls >= MOBILE_TYPES.Monk && cls <= MOBILE_TYPES.Knight;
/** LW-ERRANDS: the trades whose workplace keeps them in a guild - a bookseller's, a library's and an alchemist's people
 *  the Mages Guild, an armourer's and a weaponsmith's the Fighters Guild. */
export const GUILD_OF_TRADE = /** @type {ReadonlyMap<number, number>} */ (Object.freeze(new Map([
  [BUILDING_TYPES.Bookseller, MAGES_GUILD], [BUILDING_TYPES.Library, MAGES_GUILD], [BUILDING_TYPES.Alchemist, MAGES_GUILD],
  [BUILDING_TYPES.Armorer, FIGHTERS_GUILD], [BUILDING_TYPES.WeaponSmith, FIGHTERS_GUILD],
])));

/**
 * LW-ERRANDS: A RESIDENT'S GUILD HALL - the hall of the guild their trade or their class keeps them in, the nearest to
 * home of the town's halls of it; null where they keep none, or the town has no hall of it. A guild hall's own members
 * their own hall; a courtier and a knight a knightly order (any of the ten - the town's; a knight where none stands the
 * Fighters Guild); the mage's classes and the trades of GUILD_OF_TRADE their guild; the warrior's classes the Fighters
 * Guild; the thief's none the street shows. Their trade and class alone: the same every day, on every reader. The first
 * cut sent a sellsword and an adventurer to one of the two halls nearest home, whatever its guild (a sorcerer to the
 * Fighters Guild), and nobody else to any.
 * @param {Resident} res @param {Places} places @param {Spot|null} home @returns {Spot|null}
 */
export function guildHallOf(res, places, home) {
  if (res.job === 'guildsman') return res.work != null ? places.doors.get(res.work) ?? null : null;
  const { halls, orders } = doorKinds(places);
  const nearest = (/** @type {readonly Spot[]|undefined} */ list) => (list?.length ? nearestOf(places, list, home)[0] : null);
  const order = nearest(orders);
  if (res.job === 'courtier') return order;
  if (res.cls === MOBILE_TYPES.Knight && order) return order;
  const guild = (res.work != null ? GUILD_OF_TRADE.get(places.types.get(res.work) ?? -1) : undefined)
    ?? (isMageClass(res.cls) ? MAGES_GUILD : isWarriorClass(res.cls) ? FIGHTERS_GUILD : null);
  return guild == null ? null : nearest(halls.get(guild));
}

/** LW-ERRANDS: the days of the week a member keeps at their hall - two, their own, three apart (Daggerfall's week is
 *  seven days), the seed's alone. @param {Resident} res @param {number} day */
export function guildDay(res, day) {
  const w = lwSeed(res.town, res.roll.charCodeAt(0), res.slot, 0x67696c64) % 7;   // 'gild'
  const d = ((day % 7) + 7) % 7;
  return d === w || d === (w + 3) % 7;
}

const B = BUILDING_TYPES;
/**
 * LW-ERRANDS: WHAT EACH TRADE'S ERRANDS ARE FOR - the kinds of shop one of the trade has need of, by weight: a
 * household's stores (the general store, the clothier, the alchemist's remedies); a keeper's and a smith's bank (the
 * takings) and stock; a scholar's library and bookseller; a courtier's jeweller and clothier; a merchant's bank and
 * pawnbroker; a visitor's wares. An errand's shop is of one of these the town keeps ERRAND_NEED_SHARE of the time,
 * drawn by its weight, the nearer of its two nearest home (`errandShop`); else - and where the town keeps none - one of
 * the four shops nearest home, as every errand's was in the first cut (a city's banks saw 1-6 a day of its three
 * hundred people, its library 0-4); and an errand goes into a shop ERRAND_SHOP_SHARE of the time, else to the market
 * (a shop's front, the square's stalls: half, in the first cut).
 * @type {Readonly<Record<string, readonly (readonly [number, number])[]>>}
 */
export const ERRAND_NEEDS = Object.freeze({
  homemaker: [[B.GeneralStore, 4], [B.ClothingStore, 2], [B.Alchemist, 1], [B.FurnitureStore, 1], [B.PawnShop, 1]],
  crafter: [[B.GeneralStore, 3], [B.PawnShop, 2], [B.FurnitureStore, 1], [B.Bank, 1]],
  keeper: [[B.Bank, 3], [B.GeneralStore, 2]],
  helper: [[B.GeneralStore, 3], [B.Bank, 1]],
  smith: [[B.Bank, 2], [B.GeneralStore, 2], [B.Alchemist, 1]],
  clerk: [[B.GeneralStore, 2], [B.ClothingStore, 1], [B.Bookseller, 1]],
  scholar: [[B.Library, 3], [B.Bookseller, 2], [B.Alchemist, 1]],
  guildsman: [[B.Alchemist, 2], [B.Bookseller, 1], [B.Armorer, 1], [B.WeaponSmith, 1]],
  guard: [[B.GeneralStore, 2], [B.Armorer, 1], [B.WeaponSmith, 1], [B.Alchemist, 1]],
  courtier: [[B.GemStore, 3], [B.ClothingStore, 2], [B.Bank, 2], [B.Bookseller, 1]],
  merchant: [[B.Bank, 3], [B.GeneralStore, 2], [B.PawnShop, 2], [B.GemStore, 1]],
  visitor: [[B.GeneralStore, 2], [B.ClothingStore, 1], [B.GemStore, 1], [B.PawnShop, 1], [B.Alchemist, 1], [B.Bookseller, 1]],
});

export const ERRAND_NEED_SHARE = 0.6;
export const ERRAND_SHOP_SHARE = 2 / 3;

/** LW-LODGE: one who lodges at a tavern - their home its door, and not its own staff (a visitor, a hand of a packet
 *  lying here, one of the town with no house but its rooms). @param {Resident} res @param {Places} places
 *  @param {Spot|null} home */
export const isLodger = (res, places, home) => !!home && home.building != null && places.types.get(home.building) === BUILDING_TYPES.Tavern && res.work !== home.building;
/** LW-LODGE: a lodger's breakfast in the common room - minutes after waking, and how long - and how long before bed they
 *  go up to their room from the evening's supper there. */
export const LODGE_BREAKFAST_MIN = Object.freeze([15, 45]);
export const LODGE_UP_MIN = Object.freeze([20, 60]);
/** LW9: a carter's stall at a market (hours: from the morning - from their coming in, at once - to the afternoon), and a
 *  minstrel's evening playing a tavern (hours). */
export const MARKET_STALL_H = Object.freeze([8, 13.5]);
export const MINSTREL_PLAY_H = Object.freeze([18.5, 23]);

/** LW-ERRANDS: the shop an errand of `job` takes one into, of `shops` (the shops nearest home, the nearest first): of a
 *  kind ERRAND_NEEDS gives the trade and the town keeps, ERRAND_NEED_SHARE of the time, by weight, the nearer of its two
 *  nearest; else one of the four nearest. @param {string} job @param {Places} places @param {readonly Spot[]} shops
 *  @param {() => number} rng @returns {Spot|null} */
export function errandShop(job, places, shops, rng) {
  const needs = (ERRAND_NEEDS[job] ?? []).map(([t, w]) => /** @type {const} */ ([shops.filter((s) => places.types.get(s.building ?? -1) === t), w])).filter(([list]) => list.length);
  if (!needs.length || rng() >= ERRAND_NEED_SHARE) return shops.length ? shops[Math.floor(rng() * Math.min(4, shops.length))] : null;
  let r = rng() * needs.reduce((n, [, w]) => n + w, 0);
  let list = needs[needs.length - 1][0];
  for (const [l, w] of needs) { if (r < w) { list = l; break; } r -= w; }
  return list[Math.floor(rng() * Math.min(2, list.length))];
}

/** A resident's favourites, worked out. LW-SPREAD: their two social spots are of those nearest home (SOCIAL_NEAR), the
 *  square among them where it is near - and the square from anywhere for SQUARE_LIKE of them - and their market of the
 *  shops' fronts and the square's points nearest home; the square their own point of it. The first cut kept six in ten
 *  of a town to the square, and its evening stood about one point; and a hamlet's market was its one shop's front.
 *  @param {Resident} res @param {Places} places @param {Spot|null} home */
function favouritesNow(res, places, home) {
  const rng = lwRng(res.town, res.roll.charCodeAt(0), res.slot, 0x666176);   // 'fav'
  const near = (list, n = 2) => (list.length ? list[Math.floor(rng() * Math.min(list.length, n))] : null);
  const kinds = doorKinds(places);
  const byNear = (/** @type {readonly Spot[]} */ list) => nearestOf(places, list, home);
  const sq = squareOf(res, places);
  const own = (/** @type {Spot|null} */ s) => (s?.kind === 'square' ? sq : s);
  const social = byNear([...places.social, ...(places.corners ?? [])]);   // a corner of the town a social spot as any
  const s1 = places.square && rng() < SQUARE_LIKE ? sq : own(near(social, SOCIAL_NEAR));
  const s2 = own(near(social.filter((s) => own(s) !== s1), SOCIAL_NEAR)) ?? s1;
  const market = byNear([...places.market, ...(places.squares ?? [])]);   // a shop's front, or the square where the stalls stand - by its points, the more of them the more of the market
  return {
    social: [s1, s2].filter(Boolean),
    tavern: near(byNear(kinds.tavern)),
    temple: near(byNear(kinds.temple)),
    guild: guildHallOf(res, places, home),   // LW-ERRANDS: their own guild's hall
    market: own(near(market, SOCIAL_NEAR)),
    shops: byNear(kinds.shops),
    square: sq,
  };
}

/**
 * THE DAY: `res`'s entries for `day` (the day's number - the living day begins at `day * 1440 + DAY_START_MIN`).
 * @param {Resident} res @param {Places} places @param {number} day
 * @param {{ mpm: number, away?: readonly Away[], visitor?: boolean, home?: Spot|null, watch?: number }} opts - `away` the
 *   windows the roads hold them (trips.js); `visitor` a traveller lodging here (their home `home`, a tavern's door);
 *   WATCH-DAY `watch` the town's watch a shift (census.js watchShiftSize)
 * @returns {Entry[]}
 */
export function dayPlan(res, places, day, { mpm, away = [], visitor = false, home: homeIn = null, watch: watchSize = 1 }) {
  const D0 = day * DAY_MIN + DAY_START_MIN, D1 = D0 + DAY_MIN;
  const home = homeIn ?? (res.home != null ? places.doors.get(res.home) ?? null : null);
  if (!home) return [{ kind: 'home', at: /** @type {any} */ (null), t0: D0, t1: D1 }];   // a home off the net: always in
  const rng = lwRng(res.town, res.roll.charCodeAt(0), res.slot, day);
  const fav = favourites(res, places, home);
  const work = res.work != null ? places.doors.get(res.work) ?? null : null;
  const h = (hh) => hourOf(day, hh);
  // the temper's waking and bedtime - the watch's by its shift (WATCH-DAY: a day shift rises early, an evening shift
  // late; the night sleeps the day, abed after the night's watch till the afternoon)
  const shift = res.job === 'guard' && !visitor ? watchDuty(res, places, day, watchSize).shift : -1;
  let wake = res.temper === 0 ? h(5 + rng()) : res.temper === 2 ? h(8 + rng() * 2) : h(6 + rng() * 1.5);
  let bed = res.temper === 0 ? h(20 + rng()) : res.temper === 2 ? h(24.5 + rng() * 1.5) : h(21.5 + rng() * 1.5);
  if (shift === 0) { wake = h(5 + rng() * 0.5); bed = h(21 + rng()); }
  else if (shift === 1) { wake = h(9 + rng()); bed = h(23 + rng()); }
  else if (shift === 2) { wake = h(10.5 + rng()); bed = h(WATCH_SHIFTS[2][1]); }
  else if (shift === 3) { wake = h(13 + rng()); bed = h(21.5 + rng()); }
  // WATCH-DAY: the morning after the night's watch begins where it stood at the day's turn - his post, his patrol's stop;
  // a day's watch whose walk out is longer than the morning begins the day on it, and his day off ends with it
  const startOut = shift === 3 ? nightTail(res, places, day - 1, watchSize, mpm) : null;
  const walkIn = shift === 0 ? morningWalk(res, places, day, watchSize, mpm) : null;
  const walkOut = shift === 3 ? morningWalk(res, places, day + 1, watchSize, mpm) : null;
  /** @type {{ kind: string, at: Spot|null, from: number, dur: number, until?: number, slack?: number, mark?: { duty?: boolean, pair?: 0|1|null } }[]} */
  const intents = [];
  // LW-SPREAD: whatever takes them to the square takes them to their own point of it (squareOf) - the watch's beat aside,
  // its stops a patrol's pair's
  const I = (kind, at, from, dur, until = undefined, slack = undefined, mark = undefined) => { if (at) intents.push({ kind, at: at.kind === 'square' && !mark?.duty ? fav.square : at, from, dur, until, slack, mark }); };
  /** A stroll: two short stops at two of the town's spots - out among people, seen walking. */
  const stroll = (from) => {
    const spots = [...places.social, ...(places.corners ?? []), ...places.market];   // LW-SPREAD: the town's corners too
    if (spots.length < 2) return;
    const a = spots[Math.floor(rng() * spots.length)];
    let b = spots[Math.floor(rng() * spots.length)];
    if (b === a) b = spots[(spots.indexOf(a) + 1) % spots.length];
    I('social', a, from, rollInt(rng, 6, 15));
    I('market', b, from + 20, rollInt(rng, 6, 15));
  };
  const evening = (at = h(18)) => {
    const from = at + rollInt(rng, 0, EVENING_SPREAD_MIN);   // LW-SPREAD: out for the evening at their own minute
    if (res.social > 0.3) I('social', pickOf(rng, fav.social.length ? fav.social : [null]), from, rollInt(rng, 30, 90));
    if (res.drink > TAVERN_DRINK && rng() < 0.75) I('tavern', fav.tavern, from + 60, rollInt(rng, 90, 180));
    else if (res.pious > 0.7 && rng() < 0.6) I('temple', fav.temple, from + 30, rollInt(rng, 30, 60));
    else if (res.social > 0.75 && rng() < 0.3) {
      const houses = doorKinds(places).houses.filter((s) => s !== home);
      if (houses.length) I('visit', houses[Math.floor(rng() * houses.length)], from + 45, rollInt(rng, 60, 120));
    }
  };
  const errand = (from) => {
    if (rng() < ERRAND_SHOP_SHARE && fav.shops.length) I('shop', errandShop(job, places, fav.shops, rng), from, rollInt(rng, 15, 35));   // LW-ERRANDS: into a shop, of their need
    else I('market', fav.market, from, rollInt(rng, 20, 40));
  };
  // LW9: a carter come to market keeps a stall; a minstrel come to play keeps the tavern's evening - their own visits
  const job = visitor ? (res.job === 'carter' ? 'carter-visit' : res.job === 'minstrel' ? 'minstrel-visit' : 'visitor') : res.job;
  const lodger = isLodger(res, places, home);
  switch (job) {
    case 'keeper': case 'smith': case 'clerk': case 'scholar': case 'helper': case 'guildsman': {
      if (rng() < 0.25) errand(wake + 30);
      const at = work ?? home;
      I('work', at, h(job === 'smith' ? 7 : 8), 240);
      const lunch = rng();
      if (lunch < 0.3) I('tavern', fav.tavern, h(12), 45);
      else if (lunch < 0.5) I('market', fav.market, h(12), 30);
      I('work', at, h(12.5), 330, h(18));
      // LW-ERRANDS: on their guild's days, the evening at its hall first (a hall's own members are at it all day)
      if (fav.guild && job !== 'guildsman' && guildDay(res, day)) I('guild', fav.guild, h(18), rollInt(rng, 60, 120));
      evening();
      break;
    }
    case 'crafter': {
      if (rng() < 0.7) errand(h(9));
      if (rng() < 0.5) I('stall', rng() < 0.5 ? places.square ?? fav.market : fav.market, h(13), rollInt(rng, 60, 150));   // their wares at the square - LW-SPREAD: or at their market
      else if (rng() < 0.5) errand(h(14));
      evening();
      break;
    }
    case 'homemaker': {
      I('market', fav.market, h(MARKET_HOURS[0] + rng() * (MARKET_HOURS[1] - MARKET_HOURS[0])), rollInt(rng, 45, 90));   // LW-SPREAD: the morning's market at their own hour
      errand(h(11));
      if (res.social > 0.5) stroll(h(13));
      if (res.pious > 0.6) I('temple', fav.temple, h(15), rollInt(rng, 30, 60));
      if (res.social > 0.3) I('social', pickOf(rng, fav.social.length ? fav.social : [null]), h(16), rollInt(rng, 45, 120));
      evening(h(18.5));
      break;
    }
    case 'labourer': case 'courier': {
      let t = h(7), lunch = false;
      for (let i = 0, n = rollInt(rng, 3, 5); i < n; i++) {
        const shop = fav.shops.length && rng() < 0.3;
        const spots = [...places.market, ...places.social];
        const at = shop ? fav.shops[Math.floor(rng() * fav.shops.length)] : (spots.length ? spots[Math.floor(rng() * spots.length)] : null);
        const dur = rollInt(rng, 25, 60);
        I(shop ? 'work' : 'stall', at, t, dur);
        t += 120;
        // LW-ROOMS: the lunch at the tavern after the stint at eleven - laid after the one at nine, the three in ten who
        // lunch there walked on from it and waited in the tavern for noon wherever home was too far to go between; AUDIT
        // LW-ROOMS: from the stint's own end (laid at noon, one done at 11:25 waited there for it - six of the town of
        // sixteen blocks' came in at 11:40-11:57), the three in ten drawn where the first cut drew them (the day's every
        // later roll as it was)
        if (i === 1) lunch = rng() < 0.3;
        if (i === 2 && lunch) I('tavern', fav.tavern, t - 120 + dur, 30);
      }
      evening();
      break;
    }
    case 'carter': case 'hunter':   // LW9: a farm's and a village's own, at home
    case 'farmer': {
      I('fields', exitNearest(places, home.cell), h(6), 660, h(17));
      evening(h(18));
      break;
    }
    case 'fisher': case 'sailor': {
      const dock = places.dock.length ? places.dock[lwSeed(res.town, res.slot) % places.dock.length] : null;
      I(dock ? 'dock' : 'fields', dock ?? exitNearest(places, home.cell), h(job === 'sailor' ? 6 : 5.5), 450, h(job === 'sailor' ? 15 : 13));
      if (job === 'fisher') I('stall', rng() < 0.5 ? places.square ?? fav.market : fav.market, h(14), rollInt(rng, 60, 90));   // LW-SPREAD: the catch at the square, or at their market
      if (job === 'sailor' && res.drink > 0.3) I('tavern', fav.tavern, h(16), rollInt(rng, 120, 240));
      evening(h(18.5));
      break;
    }
    case 'beggar': {
      I('beg', fav.social[0] ?? null, h(8), 240);
      I('market', fav.market, h(12), 30);
      I('beg', fav.social[1] ?? fav.social[0] ?? null, h(13), 300, h(18));
      break;
    }
    case 'innkeeper': case 'server': {
      if (rng() < 0.6) I('market', fav.market, h(10.5), rollInt(rng, 30, 45));
      I('work', work ?? home, h(11), 900, bed);
      break;
    }
    case 'priest': {
      if (rng() < 0.4) I('social', fav.temple ? (places.social.find((s) => s.building === fav.temple?.building) ?? null) : null, h(8), rollInt(rng, 30, 60));
      if (rng() < 0.3) I('market', fav.market, h(10), rollInt(rng, 20, 30));
      I('work', work ?? home, h(11), 600, bed);
      break;
    }
    case 'noble':   // LW9: a court's own, at home
    case 'courtier': {
      if (rng() < 0.35) I('social', places.square, h(15), rollInt(rng, 30, 60));
      if (fav.guild && guildDay(res, day)) I('guild', fav.guild, h(16.5), rollInt(rng, 60, 120));   // LW-ERRANDS: their order's hall
      break;
    }
    case 'guard': {
      // WATCH-DAY: the watch's day by its rotation (watchDuty): a shift of eight hours - a patrol, its two together on
      // the patrol's own stops, or a post at a gate - in uniform from the walk out to the walk home (`duty`); the night's
      // run past the day's turn, the next day beginning where it stands (nightTail) and home to sleep at six
      const duty = watchDuty(res, places, day, watchSize);
      if (duty.shift === 3) {
        // the morning after the night: the watch kept to six, then home to bed - up in the afternoon, the evening theirs
        if (startOut) for (const s of startOut.stops) I(startOut.kind, s.at, s.from, s.dur, undefined, Infinity, { duty: true, pair: startOut.pair });
        evening(h(18));
        break;
      }
      const [s0, s1] = WATCH_SHIFTS[duty.shift];
      const [from, until] = [h(s0), Math.min(h(s1), D1)];
      if (duty.shift === 2) { errand(h(15)); if (res.social > 0.4) I('social', pickOf(rng, fav.social.length ? fav.social : [null]), h(17.5), rollInt(rng, 30, 75)); }
      const mark = { duty: true, pair: duty.pair };
      if (duty.kind === 'post') I('post', duty.post, from, until - from, until, Infinity, mark);
      else {
        const beat = patrolBeat(places, res.town, duty.company, duty.patrol, day, duty.shift);
        const stops = patrolStops(beat, lwRng(res.town, 0x73746f70, duty.company, duty.patrol, day, duty.shift), 0, from, until, mpm, true);   // 'stop' - the last held to the shift's end
        for (const s of stops) I('watch', s.at, s.from, s.dur, until, Infinity, mark);
      }
      if (duty.shift === 0) evening(h(17.5));
      break;
    }
    case 'merchant': {
      I('stall', places.square ?? fav.market, h(8), 300, h(13));
      I('tavern', fav.tavern, h(13), 45);
      for (let i = 0; i < 2 && fav.shops.length; i++) I('shop', errandShop(job, places, fav.shops, rng), h(14.5 + i), rollInt(rng, 30, 50));   // LW-ERRANDS: the bank, the trade
      I('tavern', fav.tavern, h(19), rollInt(rng, 120, 200));
      break;
    }
    case 'patrol': case 'retainer':   // LW9: a knight of the patrol, a noble's retainer, at home
    case 'mercenary': {
      I('social', places.square ?? fav.social[0] ?? null, h(10), rollInt(rng, 60, 120));
      I('tavern', fav.tavern, h(13), 60);
      I('guild', fav.guild, h(15), rollInt(rng, 60, 120));
      I('tavern', fav.tavern, h(19), rollInt(rng, 120, 240));
      break;
    }
    case 'adventurer': {
      if (rng() < 0.3) I('temple', fav.temple, h(9), rollInt(rng, 20, 40));
      const outfitters = nearestOf(places, doorKinds(places).outfitters, home);
      if (outfitters.length && rng() < 0.6) I('shop', outfitters[Math.floor(rng() * Math.min(3, outfitters.length))], h(10), rollInt(rng, 30, 60));
      I('guild', fav.guild, h(11.5), 60);
      I('social', places.square ?? fav.social[0] ?? null, h(14), rollInt(rng, 60, 120));
      I('tavern', lodger ? home : fav.tavern, h(18.5), rollInt(rng, 180, 300), lodger ? bed - rollInt(rng, LODGE_UP_MIN[0], LODGE_UP_MIN[1]) : undefined);   // LW-LODGE: a lodger sups at their own, and goes up before bed
      break;
    }
    case 'pilgrim': {
      I('temple', fav.temple, h(7), 60);
      I('market', fav.market, h(10), rollInt(rng, 30, 60));
      if (res.social > 0.5) stroll(h(12.5));
      if (res.social > 0.4) I('social', fav.social[0] ?? null, h(15), rollInt(rng, 30, 60));
      I('temple', fav.temple, h(17), 45);
      break;
    }
    case 'carter-visit': {
      // LW9: THE CARTER AT MARKET - straight to a stall at the market as they come in, till the afternoon (their window cuts it)
      I('stall', places.square ?? fav.market, h(MARKET_STALL_H[0]), (MARKET_STALL_H[1] - MARKET_STALL_H[0]) * 60, h(MARKET_STALL_H[1]), Infinity);
      break;
    }
    case 'minstrel': case 'minstrel-visit': {
      // LW9: THE MINSTREL plays a tavern's common room of an evening (lodged at it, away from home; at home, their own
      // town's), a turn about the market first
      I('market', fav.market, h(11), rollInt(rng, 30, 60));
      const room = job === 'minstrel-visit' && lodger ? home : fav.tavern;
      I('tavern', room, h(MINSTREL_PLAY_H[0]), (MINSTREL_PLAY_H[1] - MINSTREL_PLAY_H[0]) * 60, lodger && job === 'minstrel-visit' ? bed - rollInt(rng, LODGE_UP_MIN[0], LODGE_UP_MIN[1]) : undefined);
      break;
    }
    case 'visitor': {
      I('market', fav.market, h(9), rollInt(rng, 30, 60));
      if (fav.shops.length) I('shop', errandShop(job, places, fav.shops, rng), h(10.5), rollInt(rng, 30, 60));   // LW-ERRANDS: a visitor's wares
      if (res.pious > 0.5) I('temple', fav.temple, h(13), rollInt(rng, 30, 45));
      I('social', places.square ?? fav.social[0] ?? null, h(15), rollInt(rng, 45, 90));
      I('tavern', lodger ? home : fav.tavern, h(18), rollInt(rng, 180, 300), lodger ? bed - rollInt(rng, LODGE_UP_MIN[0], LODGE_UP_MIN[1]) : undefined);   // LW-LODGE: a lodger sups at their own, and goes up before bed
      break;
    }
    default: evening();
  }
  // the larks and the restless take a turn about the town before the day's business (a stroll at first light)
  if (res.temper === 0 && res.social > 0.6 && job !== 'guard' && job !== 'farmer' && job !== 'fisher') { const at = intents.length; stroll(wake + 20); intents.unshift(...intents.splice(at)); }
  // LW-LODGE: a lodger breakfasts in the common room before anything (up in their room before it and after it)
  if (lodger) { const at = intents.length; I('tavern', home, wake + rollInt(rng, LODGE_BREAKFAST_MIN[0], LODGE_BREAKFAST_MIN[1]), rollInt(rng, 20, 40)); intents.unshift(...intents.splice(at)); }
  const start = startOut ? { at: startOut.at, kind: startOut.kind, mark: { duty: true, pair: startOut.pair } } : walkIn ? { at: walkIn.to, kind: walkIn.kind, mark: walkIn.mark, walk: walkIn } : null;
  return schedule(intents, { D0, D1, wake, bed, home, mpm, away, start, end: walkOut });
}

/**
 * The intents laid on the clock: each begins when the walk to it allows and not before its hour (nor more than its
 * slack after it - a morning's work is not done at dusk), stays its minutes (and not past its `until`, nor past the
 * walk home before bed, nor into the next away window's going); between two a long gap is spent at home and a short
 * one going on at once and waiting at the next (AUDIT LW-ROOMS: "stays where they were", this said - never so but out of
 * doors, where one stands on between two at one place, and at the same place indoors before LW-ROOMS) - at home asleep
 * before waking and after bed; every minute of the day covered once (WATCH-DAY: a walk out across the day's
 * turn, morningWalk, the one entry both days carry). An away window cuts the day: the walk
 * out (armed, after gearing at home where they go armed) arrives as it opens, and the walk home leaves as it closes.
 * WATCH-DAY: `start` where the day begins when it is not at home (the morning after the night's watch: his post or his
 * patrol's stop, about it what he was - `mark`; or on the walk to it begun the night before, `walk`); `end` the walk out
 * the day ends with where the next day begins on it (morningWalk); an intent's `mark` rides on its stay and on the walks
 * to and from it (the watch in uniform from the walk out to the walk home).
 * @param {{ kind: string, at: Spot|null, from: number, dur: number, until?: number, slack?: number, mark?: { duty?: boolean, pair?: 0|1|null } }[]} intents
 * @param {{ D0: number, D1: number, wake: number, bed: number, home: Spot, mpm: number, away: readonly Away[], start?: { at: Spot, kind: string, mark?: { duty?: boolean, pair?: 0|1|null }, walk?: MorningWalk } | null, end?: MorningWalk | null }} o
 * @returns {Entry[]}
 */
export function schedule(intents, { D0, D1, wake, bed, home, mpm, away, start = null, end: walkOut = null }) {
  /** @type {Entry[]} */
  const out = [];
  const push = (kind, at, t0, t1, extra = {}) => {
    if (!(t1 > t0)) return;
    const last = out[out.length - 1];
    if (last && kind !== 'walk' && last.kind === kind && last.at === at && last.t1 === t0 && !!last.armed === !!extra.armed) { last.t1 = t1; return; }
    out.push({ kind, at, t0, t1, ...extra });
  };
  const windows = [...(away ?? [])].filter((w) => w.t1 > D0 && w.t0 < D1).sort((a, b) => a.t0 - b.t0);
  let at = start?.at ?? home, atKind = start?.kind ?? 'home', cursor = D0;
  /** WATCH-DAY: the mark of where they are (a duty stay's), carried onto the walk that leaves it */
  let atMark = start?.mark ?? null;
  if (start?.walk) { const w = start.walk; push('walk', w.to, w.t0, w.t1, { from: w.from, to: w.to, ...w.mark }); cursor = w.t1; }   // begun the night before
  /** Stay where they are until `t` - at home asleep before waking and from bed on. */
  const fill = (t) => {
    t = Math.min(t, D1);
    if (!(t > cursor)) return;
    if (at === home) {
      for (const [a, b, k] of [[cursor, Math.min(t, wake), 'sleep'], [Math.max(cursor, wake), Math.min(t, bed), 'home'], [Math.max(cursor, bed), t, 'sleep']]) {
        if (b > a) push(/** @type {string} */ (k), home, /** @type {number} */ (a), /** @type {number} */ (b));
      }
    } else push(atKind, at, cursor, t, atMark ?? {});
    cursor = t;
  };
  /** Walk to `to`, arriving by `by` where the clock allows (leaving now if it is already late); there, `arriveKind`
   *  is what they are about while they wait. */
  const go = (to, by, extra = {}, arriveKind = 'home', arriveMark = null) => {
    if (to === at) return;
    const m = walkMinutes(at, to, mpm);
    if (m > 0) { fill(Math.max(cursor, by - m)); push('walk', to, cursor, cursor + m, { from: at, to, ...(atMark ?? {}), ...(arriveMark ?? {}), ...extra }); cursor += m; }
    at = to;
    atKind = arriveKind;
    atMark = arriveMark;
  };
  const runAway = (w) => {
    const exit = w.exit ?? null;
    if (w.t0 > cursor && exit) {
      const out_ = walkMinutes(home, exit, mpm);
      const leaveHome = w.t0 - out_;
      if (at !== home) go(home, leaveHome - (w.armed ? GEAR_MIN : 0));
      if (w.armed) { fill(leaveHome - GEAR_MIN); if (leaveHome > cursor) { push('gear', home, cursor, leaveHome); cursor = leaveHome; } }
      go(exit, w.t0, { armed: !!w.armed }, 'away');
    }
    const back = exit && exit !== home ? walkMinutes(exit, home, mpm) : 0;
    // LW-STIR: a stranger come in at a gate the watch keeps halts there first (stir.js gateHalt) - questioned
    const halt = exit && exit !== home && w.halt && w.halt > 0 ? w.halt : 0;
    let t1 = Math.min(D1, w.t1);
    // AUDIT-G5: a walk home that would run past the day's end is never begun - away to the end, the next day's plan has
    // them home (its own day drops the window; the walk cut at 04:00 left the street mid-step, in plain view)
    if (back > 0 && Math.max(cursor, t1) + halt + back > D1) t1 = D1;
    if (t1 > cursor) push('away', exit ?? home, cursor, t1, { armed: !!w.armed });
    cursor = Math.max(cursor, t1);
    at = exit ?? home; atKind = 'away';
    if (cursor < D1 && halt > 0) { push('gate', exit, cursor, cursor + halt); cursor += halt; atKind = 'gate'; }
    if (cursor < D1 && back > 0) {
      push('walk', home, cursor, cursor + back, { from: exit, to: home, armed: !!w.armed });
      cursor += back;
      at = home; atKind = 'home';
    }
  };
  let wi = 0;
  while (wi < windows.length && windows[wi].t0 <= D0) runAway(windows[wi++]);
  /** WATCH-DAY: the watch next after each intent (the one a stay off duty must leave in time for) */
  const nextWatch = intents.map(() => /** @type {typeof intents[number] | null} */ (null));
  for (let k = intents.length - 2; k >= 0; k--) nextWatch[k] = intents[k + 1].mark?.duty ? intents[k + 1] : nextWatch[k + 1];
  for (const [k, it] of intents.entries()) {
    if (cursor >= D1) break;
    // WATCH-DAY: into the uniform and out of it at home - never from one's watch straight to the evening's errand, nor
    // from an errand to one's watch (a stay at the same spot read as the watch kept the man in uniform till evening)
    if (!!atMark?.duty !== !!it.mark?.duty && at !== home) go(home, cursor);
    const m = walkMinutes(at, it.at, mpm);
    while (wi < windows.length && windows[wi].t0 < Math.max(cursor + m, it.from) + MIN_STAY) runAway(windows[wi++]);
    const m2 = walkMinutes(at, it.at, mpm);
    const start = Math.max(cursor + m2, it.from);
    if (start - it.from > (it.slack ?? 120)) continue;
    // WATCH-DAY: the watch keeps its shift to its end and goes to bed when it is home - a bedtime cut a great city's
    // evening and night watch short by the walk home (the night's last stop never kept, the morning begun at a post its
    // man had left); off duty, a stay ends in time to change at home and walk out to the next watch on its hour
    const homeBy = it.mark?.duty ? Infinity : bed - walkMinutes(it.at, home, mpm);
    const w = windows[wi];
    const awayBy = w ? w.t0 - (w.armed ? GEAR_MIN : 0) - walkMinutes(home, w.exit ?? home, mpm) - walkMinutes(it.at, home, mpm) : Infinity;
    const nw = it.mark?.duty ? null : nextWatch[k];
    const watchBy = nw ? nw.from - walkMinutes(it.at, home, mpm) - walkMinutes(home, nw.at, mpm) : Infinity;
    const end = Math.min(start + it.dur, it.until ?? Infinity, homeBy, awayBy, watchBy, D1);
    if (end - start < MIN_STAY) continue;
    // between two places, never lingering where the last stay ended (a shop shut at six is left at six): a long gap
    // is spent at home, a short one going on at once and waiting at the next - LW-ROOMS: and a long one between two stays
    // at the same place indoors too (a sellsword with no hall of their guild sat in the tavern from one o'clock to the
    // evening's drink, a labourer from their lunch to it); AUDIT LW-ROOMS: out of doors one stands on there between two,
    // as ever (sent home too, the street's evening stood a quarter thinner, its talk a fifth quieter)
    if (at !== home && (at !== it.at || !OUTDOOR.has(it.kind))) {
      if (start - cursor > walkMinutes(at, home, mpm) + walkMinutes(home, it.at, mpm) + HOME_GAP) go(home, cursor);
      else go(/** @type {Spot} */ (it.at), cursor + walkMinutes(at, it.at, mpm), {}, it.kind, it.mark ?? null);
    }
    go(/** @type {Spot} */ (it.at), start, {}, it.kind, it.mark ?? null);
    fill(start);
    push(it.kind, it.at, start, end, it.mark ?? {});
    cursor = end;
    atKind = it.kind;
    atMark = it.mark ?? null;
  }
  while (wi < windows.length) runAway(windows[wi++]);
  if (cursor < D1 && at !== home) go(home, cursor);
  if (walkOut) { fill(walkOut.t0); push('walk', walkOut.to, walkOut.t0, walkOut.t1, { from: walkOut.from, to: walkOut.to, ...walkOut.mark }); }   // on into the next day
  else fill(D1);
  return out;
}

/** The entry covering minute `t` (the last whose start is not after it), or null. @param {readonly Entry[]} plan @param {number} t */
export function entryAt(plan, t) {
  let lo = 0, hi = plan.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (plan[mid].t0 <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 && t < plan[ans].t1 ? ans : -1;
}

/** Whether entry `e` is seen in the street. @param {Entry|null|undefined} e */
export const isOutdoor = (e) => !!e && OUTDOOR.has(e.kind);
