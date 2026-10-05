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
// AWAY: a window the roads hold the resident (trips.js) is handed in and the day bends round it - geared at home (an
// armed traveller), walked out to the exit facing the road, away, walked home after; every walk to or from an away
// window ARMED (LW0 decision 5 - the host draws the class sprite).
import { NAV_CELL } from '../../world/cityNavigation.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { lwRng, lwSeed, rollInt, pickOf } from './seed.js';
import { hasShopJob } from './census.js';
import { exitNearest } from './places.js';

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

/** The kinds seen in the street. */
export const OUTDOOR = Object.freeze(new Set(['walk', 'market', 'social', 'stall', 'beg', 'dock', 'watch']));

/**
 * @typedef {import('./places.js').Spot} Spot
 * @typedef {import('./places.js').Places} Places
 * @typedef {import('./census.js').Resident} Resident
 * @typedef {{ kind: string, at: Spot, t0: number, t1: number, from?: Spot, to?: Spot, armed?: boolean }} Entry -
 *   minutes on the clock (classic minutes, the day's own numbers); a walk carries `from` and `to`, `at` its end
 * @typedef {{ t0: number, t1: number, exit?: Spot|null, armed?: boolean }} Away
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
    /** @type {Spot[]} */ const tavern = [], temple = [], guild = [], shops = [], houses = [], outfitters = [];
    for (const [key, spot] of places.doors) {
      const t = places.types.get(key) ?? -1;
      if (t === BUILDING_TYPES.Tavern) tavern.push(spot);
      if (t === BUILDING_TYPES.Temple) temple.push(spot);
      if (t === BUILDING_TYPES.GuildHall) guild.push(spot);
      if (hasShopJob(t)) shops.push(spot);
      if (t >= BUILDING_TYPES.House1 && t <= BUILDING_TYPES.House6) houses.push(spot);
      if (t === BUILDING_TYPES.Armorer || t === BUILDING_TYPES.WeaponSmith || t === BUILDING_TYPES.Alchemist) outfitters.push(spot);
    }
    const spots = [...new Set([...places.doors.values(), ...places.social, ...places.market])].sort((a, b) => a.key.localeCompare(b.key));
    k = { tavern, temple, guild, shops, houses, outfitters, rank: new Map(spots.map((s, i) => [s, i])) };
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

/** A resident's favourites, worked out. @param {Resident} res @param {Places} places @param {Spot|null} home */
function favouritesNow(res, places, home) {
  const rng = lwRng(res.town, res.roll.charCodeAt(0), res.slot, 0x666176);   // 'fav'
  const near = (list) => (list.length ? list[Math.floor(rng() * Math.min(list.length, 2))] : null);
  const kinds = doorKinds(places);
  const byNear = (/** @type {readonly Spot[]} */ list) => nearestOf(places, list, home);
  const social = byNear(places.social);
  const s1 = places.square && rng() < 0.6 ? places.square : near(social);
  const s2 = near(social.filter((s) => s !== s1)) ?? s1;
  const market = byNear(places.market);
  return {
    social: [s1, s2].filter(Boolean),
    tavern: near(byNear(kinds.tavern)),
    temple: near(byNear(kinds.temple)),
    guild: near(byNear(kinds.guild)),
    market: near(market) ?? places.square,
    shops: byNear(kinds.shops),
  };
}

/**
 * THE DAY: `res`'s entries for `day` (the day's number - the living day begins at `day * 1440 + DAY_START_MIN`).
 * @param {Resident} res @param {Places} places @param {number} day
 * @param {{ mpm: number, away?: readonly Away[], visitor?: boolean, home?: Spot|null }} opts - `away` the windows the
 *   roads hold them (trips.js); `visitor` a traveller lodging here (their home `home`, a tavern's door)
 * @returns {Entry[]}
 */
export function dayPlan(res, places, day, { mpm, away = [], visitor = false, home: homeIn = null }) {
  const D0 = day * DAY_MIN + DAY_START_MIN, D1 = D0 + DAY_MIN;
  const home = homeIn ?? (res.home != null ? places.doors.get(res.home) ?? null : null);
  if (!home) return [{ kind: 'home', at: /** @type {any} */ (null), t0: D0, t1: D1 }];   // a home off the net: always in
  const rng = lwRng(res.town, res.roll.charCodeAt(0), res.slot, day);
  const fav = favourites(res, places, home);
  const work = res.work != null ? places.doors.get(res.work) ?? null : null;
  const h = (hh) => hourOf(day, hh);
  // the temper's waking and bedtime - the watch's by its shift (a day shift rises early, an evening shift late)
  const shift = res.job === 'guard' && !visitor ? (res.slot + day) % 3 : -1;
  let wake = res.temper === 0 ? h(5 + rng()) : res.temper === 2 ? h(8 + rng() * 2) : h(6 + rng() * 1.5);
  let bed = res.temper === 0 ? h(20 + rng()) : res.temper === 2 ? h(24.5 + rng() * 1.5) : h(21.5 + rng() * 1.5);
  if (shift === 0) { wake = h(5 + rng() * 0.5); bed = h(21 + rng()); }
  else if (shift === 1) { wake = h(9 + rng()); bed = h(24.5 + rng()); }
  /** @type {{ kind: string, at: Spot|null, from: number, dur: number, until?: number, slack?: number }[]} */
  const intents = [];
  const I = (kind, at, from, dur, until = undefined, slack = undefined) => { if (at) intents.push({ kind, at, from, dur, until, slack }); };
  /** A stroll: two short stops at two of the town's spots - out among people, seen walking. */
  const stroll = (from) => {
    const spots = [...places.social, ...places.market];
    if (spots.length < 2) return;
    const a = spots[Math.floor(rng() * spots.length)];
    let b = spots[Math.floor(rng() * spots.length)];
    if (b === a) b = spots[(spots.indexOf(a) + 1) % spots.length];
    I('social', a, from, rollInt(rng, 6, 15));
    I('market', b, from + 20, rollInt(rng, 6, 15));
  };
  const evening = (from = h(18)) => {
    if (res.social > 0.3) I('social', pickOf(rng, fav.social.length ? fav.social : [null]), from, rollInt(rng, 30, 90));
    if (res.drink > 0.55 && rng() < 0.75) I('tavern', fav.tavern, from + 60, rollInt(rng, 90, 180));
    else if (res.pious > 0.7 && rng() < 0.6) I('temple', fav.temple, from + 30, rollInt(rng, 30, 60));
    else if (res.social > 0.75 && rng() < 0.3) {
      const houses = doorKinds(places).houses.filter((s) => s !== home);
      if (houses.length) I('visit', houses[Math.floor(rng() * houses.length)], from + 45, rollInt(rng, 60, 120));
    }
  };
  const errand = (from) => {
    if (rng() < 0.5 && fav.shops.length) I('shop', fav.shops[Math.floor(rng() * Math.min(4, fav.shops.length))], from, rollInt(rng, 15, 35));
    else I('market', fav.market, from, rollInt(rng, 20, 40));
  };
  const job = visitor ? 'visitor' : res.job;
  switch (job) {
    case 'keeper': case 'smith': case 'clerk': case 'scholar': case 'helper': case 'guildsman': {
      if (rng() < 0.25) errand(wake + 30);
      const at = work ?? home;
      I('work', at, h(job === 'smith' ? 7 : 8), 240);
      const lunch = rng();
      if (lunch < 0.3) I('tavern', fav.tavern, h(12), 45);
      else if (lunch < 0.5) I('market', fav.market, h(12), 30);
      I('work', at, h(12.5), 330, h(18));
      evening();
      break;
    }
    case 'crafter': {
      if (rng() < 0.7) errand(h(9));
      if (rng() < 0.5) I('stall', places.square ?? fav.market, h(13), rollInt(rng, 60, 150));   // their wares at the square
      else if (rng() < 0.5) errand(h(14));
      evening();
      break;
    }
    case 'homemaker': {
      I('market', fav.market, h(8.5 + rng()), rollInt(rng, 45, 90));
      errand(h(11));
      if (res.social > 0.5) stroll(h(13));
      if (res.pious > 0.6) I('temple', fav.temple, h(15), rollInt(rng, 30, 60));
      if (res.social > 0.3) I('social', pickOf(rng, fav.social.length ? fav.social : [null]), h(16), rollInt(rng, 45, 120));
      evening(h(18.5));
      break;
    }
    case 'labourer': case 'courier': {
      let t = h(7);
      for (let i = 0, n = rollInt(rng, 3, 5); i < n; i++) {
        const shop = fav.shops.length && rng() < 0.3;
        const spots = [...places.market, ...places.social];
        I(shop ? 'work' : 'stall', shop ? fav.shops[Math.floor(rng() * fav.shops.length)] : (spots.length ? spots[Math.floor(rng() * spots.length)] : null),
          t, rollInt(rng, 25, 60));
        t += 120;
        if (i === 1 && rng() < 0.3) I('tavern', fav.tavern, h(12), 30);
      }
      evening();
      break;
    }
    case 'farmer': {
      I('fields', exitNearest(places, home.cell), h(6), 660, h(17));
      evening(h(18));
      break;
    }
    case 'fisher': case 'sailor': {
      const dock = places.dock.length ? places.dock[lwSeed(res.town, res.slot) % places.dock.length] : null;
      I(dock ? 'dock' : 'fields', dock ?? exitNearest(places, home.cell), h(job === 'sailor' ? 6 : 5.5), 450, h(job === 'sailor' ? 15 : 13));
      if (job === 'fisher') I('stall', places.square ?? fav.market, h(14), rollInt(rng, 60, 90));
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
    case 'courtier': {
      if (rng() < 0.35) I('social', places.square, h(15), rollInt(rng, 30, 60));
      break;
    }
    case 'guard': {
      if (shift === 2) { evening(h(17)); break; }
      const [from, until] = shift === 0 ? [h(6), h(16)] : [h(14), h(24)];
      const beat = guardBeat(res, places, day);
      let t = from;
      // AUDIT-G2: each stop a stay's length at the least (MIN_STAY - `schedule` drops a shorter one: drawn at three to
      // eight minutes, five stops in six were dropped and the 64 ran out hours before the shift's end), and stops enough
      // for the whole shift
      for (let i = 0, n = Math.ceil((until - from) / MIN_STAY); beat.length && t < until && i < n; i++) {
        I('watch', beat[i % beat.length], t, rollInt(rng, MIN_STAY, MIN_STAY + 7), until, Infinity);
        t += 1;   // each stop follows the last as soon as the walk to it allows
      }
      if (shift === 0) evening(h(18));
      break;
    }
    case 'merchant': {
      I('stall', places.square ?? fav.market, h(8), 300, h(13));
      I('tavern', fav.tavern, h(13), 45);
      for (let i = 0; i < 2 && fav.shops.length; i++) I('shop', fav.shops[Math.floor(rng() * fav.shops.length)], h(14.5 + i), rollInt(rng, 30, 50));
      I('tavern', fav.tavern, h(19), rollInt(rng, 120, 200));
      break;
    }
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
      I('tavern', fav.tavern, h(18.5), rollInt(rng, 180, 300));
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
    case 'visitor': {
      I('market', fav.market, h(9), rollInt(rng, 30, 60));
      if (fav.shops.length) I('shop', fav.shops[Math.floor(rng() * fav.shops.length)], h(10.5), rollInt(rng, 30, 60));
      if (res.pious > 0.5) I('temple', fav.temple, h(13), rollInt(rng, 30, 45));
      I('social', places.square ?? fav.social[0] ?? null, h(15), rollInt(rng, 45, 90));
      I('tavern', fav.tavern, h(18), rollInt(rng, 180, 300));
      break;
    }
    default: evening();
  }
  // the larks and the restless take a turn about the town before the day's business (a stroll at first light)
  if (res.temper === 0 && res.social > 0.6 && job !== 'guard' && job !== 'farmer' && job !== 'fisher') { const at = intents.length; stroll(wake + 20); intents.unshift(...intents.splice(at)); }
  return schedule(intents, { D0, D1, wake, bed, home, mpm, away });
}

/**
 * A guard's beat for the day: four to six spots of the town - its exits, its social spots, its market - in a ring.
 * @param {Resident} res @param {Places} places @param {number} day @returns {Spot[]}
 */
export function guardBeat(res, places, day) {
  const rng = lwRng(res.town, res.roll.charCodeAt(0), res.slot, day, 0x62656174);   // 'beat'
  const pool = [...places.exits, ...places.social, ...places.market];
  const out = [];
  for (let i = 0, n = Math.min(pool.length, rollInt(rng, 4, 6)); i < n; i++) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

/**
 * The intents laid on the clock: each begins when the walk to it allows and not before its hour (nor more than its
 * slack after it - a morning's work is not done at dusk), stays its minutes (and not past its `until`, nor past the
 * walk home before bed, nor into the next away window's going); between two the resident stays where they were - at
 * home asleep before waking and after bed; every minute of the day covered once. An away window cuts the day: the walk
 * out (armed, after gearing at home where they go armed) arrives as it opens, and the walk home leaves as it closes.
 * @param {{ kind: string, at: Spot|null, from: number, dur: number, until?: number, slack?: number }[]} intents
 * @param {{ D0: number, D1: number, wake: number, bed: number, home: Spot, mpm: number, away: readonly Away[] }} o
 * @returns {Entry[]}
 */
export function schedule(intents, { D0, D1, wake, bed, home, mpm, away }) {
  /** @type {Entry[]} */
  const out = [];
  const push = (kind, at, t0, t1, extra = {}) => {
    if (!(t1 > t0)) return;
    const last = out[out.length - 1];
    if (last && kind !== 'walk' && last.kind === kind && last.at === at && last.t1 === t0 && !!last.armed === !!extra.armed) { last.t1 = t1; return; }
    out.push({ kind, at, t0, t1, ...extra });
  };
  const windows = [...(away ?? [])].filter((w) => w.t1 > D0 && w.t0 < D1).sort((a, b) => a.t0 - b.t0);
  let at = home, atKind = 'home', cursor = D0;
  /** Stay where they are until `t` - at home asleep before waking and from bed on. */
  const fill = (t) => {
    t = Math.min(t, D1);
    if (!(t > cursor)) return;
    if (at === home) {
      for (const [a, b, k] of [[cursor, Math.min(t, wake), 'sleep'], [Math.max(cursor, wake), Math.min(t, bed), 'home'], [Math.max(cursor, bed), t, 'sleep']]) {
        if (b > a) push(/** @type {string} */ (k), home, /** @type {number} */ (a), /** @type {number} */ (b));
      }
    } else push(atKind, at, cursor, t);
    cursor = t;
  };
  /** Walk to `to`, arriving by `by` where the clock allows (leaving now if it is already late); there, `arriveKind`
   *  is what they are about while they wait. */
  const go = (to, by, extra = {}, arriveKind = 'home') => {
    if (to === at) return;
    const m = walkMinutes(at, to, mpm);
    if (m > 0) { fill(Math.max(cursor, by - m)); push('walk', to, cursor, cursor + m, { from: at, to, ...extra }); cursor += m; }
    at = to;
    atKind = arriveKind;
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
    let t1 = Math.min(D1, w.t1);
    // AUDIT-G5: a walk home that would run past the day's end is never begun - away to the end, the next day's plan has
    // them home (its own day drops the window; the walk cut at 04:00 left the street mid-step, in plain view)
    if (back > 0 && Math.max(cursor, t1) + back > D1) t1 = D1;
    if (t1 > cursor) push('away', exit ?? home, cursor, t1, { armed: !!w.armed });
    cursor = Math.max(cursor, t1);
    at = exit ?? home; atKind = 'away';
    if (cursor < D1 && back > 0) {
      push('walk', home, cursor, cursor + back, { from: exit, to: home, armed: !!w.armed });
      cursor += back;
      at = home; atKind = 'home';
    }
  };
  let wi = 0;
  while (wi < windows.length && windows[wi].t0 <= D0) runAway(windows[wi++]);
  for (const it of intents) {
    if (cursor >= D1) break;
    const m = walkMinutes(at, it.at, mpm);
    while (wi < windows.length && windows[wi].t0 < Math.max(cursor + m, it.from) + MIN_STAY) runAway(windows[wi++]);
    const m2 = walkMinutes(at, it.at, mpm);
    const start = Math.max(cursor + m2, it.from);
    if (start - it.from > (it.slack ?? 120)) continue;
    const homeBy = bed - walkMinutes(it.at, home, mpm);
    const w = windows[wi];
    const awayBy = w ? w.t0 - (w.armed ? GEAR_MIN : 0) - walkMinutes(home, w.exit ?? home, mpm) - walkMinutes(it.at, home, mpm) : Infinity;
    const end = Math.min(start + it.dur, it.until ?? Infinity, homeBy, awayBy, D1);
    if (end - start < MIN_STAY) continue;
    // between two places, never lingering where the last stay ended (a shop shut at six is left at six): a long gap
    // is spent at home, a short one going on at once and waiting at the next
    if (at !== home && at !== it.at) {
      if (start - cursor > walkMinutes(at, home, mpm) + walkMinutes(home, it.at, mpm) + HOME_GAP) go(home, cursor);
      else go(/** @type {Spot} */ (it.at), cursor + walkMinutes(at, it.at, mpm), {}, it.kind);
    }
    go(/** @type {Spot} */ (it.at), start, {}, it.kind);
    fill(start);
    push(it.kind, it.at, start, end);
    cursor = end;
    atKind = it.kind;
  }
  while (wi < windows.length) runAway(windows[wi++]);
  if (cursor < D1 && at !== home) go(home, cursor);
  fill(D1);
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
