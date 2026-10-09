// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW13 (2026-10-09, bible/06-Systems/Living-World-II.md "LW13"): THE COMPANIES - a town's adventurers in parties of
// their own, travelling and diving together. Mac: "groups of npcs forming parties and traveling". Pure, like the
// census they are dealt from (LW0 decision 2): a company is its PLACES (the roster's slots), as a caravan's contract is
// its sellswords' - whoever holds a place that cycle walks with it (lives.js unchanged: a member the road takes leaves
// the place empty, then the newcomer holds it and belongs to the company).
//
//  - THE DEAL (`companiesOf`): a town's adventurers in slot order; each company's size off its first place's seed,
//    COMPANY_SIZE (2-4; up to COMPANY_CITY_MAX where the town keeps that many adventurers, a city's), each place after
//    the first the next in slot order of a run the company lacks (a mage's, a thief's, a warrior's - the eighteen
//    classes' three runs of six) where the town has one, else the next. One left over goes alone, as before.
//  - THE NAME (`companyName`): "The <word> Company", "<Ravens> of <their town>", or "<first's> company" - the first
//    place's census name.
//  - THE HEAD (`headOf`): the highest level of those holding its places that cycle - its word to the player, its name
//    on a greeting. The trip is its FIRST place's (its cycle and its dice: trips.js ownTrip), as a patrol's is.
//  - ROLES (`roleOf`, `byRole`): warriors before, thieves between, mages behind - the order it walks in.
//  - THE PILGRIMS' HOLY DAY (`holyDayOf`): a temple town's region's own holy day (holidays.js getHolidayId, a day only
//    its region keeps) inside a pilgrim's cycle draws them to it - out to arrive by its morning, home the next.
import { lwSeed, lwRng, rollInt, pickOf, textSeed } from './seed.js';
import { getHolidayId, holidayRegion } from '../holidays.js';
import { DAY_MIN } from './dayPlan.js';

/** A company's size (its first place's draw), and the most a town of that many adventurers keeps together. */
export const COMPANY_SIZE = Object.freeze([2, 4]);
export const COMPANY_CITY_MAX = 5;
/** A company of a town that keeps this many adventurers may be COMPANY_CITY_MAX strong (a city's). */
export const COMPANY_CITY_ADVENTURERS = 5;
/** A company dives in this share of its cycles (a lone adventurer: trips.js DIVE_CHANCE). */
export const COMPANY_DIVE_CHANCE = 0.75;
/** The three runs of the eighteen classes (MOBILE_TYPES 128-145, six each). */
export const ROLE_RUNS = Object.freeze({ mage: [128, 133], thief: [134, 139], warrior: [140, 145] });
/** The order a company walks in. */
export const ROLE_ORDER = Object.freeze(['warrior', 'thief', 'mage']);
/** A pilgrim's cycle with a holy day in reach goes to it this often (its own draw). */
export const HOLY_CHANCE = 0.8;
/** The words of a company's name. */
export const COMPANY_WORDS = Object.freeze(['Lantern', 'Iron', 'Silver', 'Wandering', 'Grey', 'Oaken', 'Last', 'Free', 'Crimson', 'Northern', 'Hollow', 'Bright']);
export const COMPANY_BEASTS = Object.freeze(['Ravens', 'Wolves', 'Hawks', 'Stags', 'Foxes', 'Owls', 'Bears', 'Hounds']);
const COMP = 0x636f6d70, HOLY = 0x686f6c79;   // 'comp', 'holy'

/** A class's run: 'mage', 'thief', 'warrior', or null. @param {number|null|undefined} cls */
export function roleOf(cls) {
  if (cls == null) return null;
  for (const [role, [lo, hi]] of Object.entries(ROLE_RUNS)) if (cls >= lo && cls <= hi) return role;
  return null;
}
/** Members in the order a company walks: warriors, thieves, mages (each in the order given). @template {{ cls?: number|null }} T @param {T[]} members @returns {T[]} */
export const byRole = (members) => [...members].sort((a, b) => rank(a) - rank(b));
const rank = (m) => { const i = ROLE_ORDER.indexOf(/** @type {string} */ (roleOf(m.cls))); return i < 0 ? ROLE_ORDER.length : i; };

/** The deal kept by roster (the census's roster is made once a town). @type {WeakMap<object, any[]>} */
const DEALS = new WeakMap();

/**
 * THE COMPANIES of a town's roster - each `{ key, places, name }`, `places` the roster's own entries (the first leads its
 * trip). A town of one adventurer keeps none.
 * @param {any[]} roster @returns {{ key: string, places: any[], name: string }[]}
 */
export function companiesOf(roster) {
  let got = DEALS.get(roster);
  if (got) return got;
  const advs = roster.filter((r) => r.job === 'adventurer').sort((a, b) => a.slot - b.slot);
  const max = advs.length >= COMPANY_CITY_ADVENTURERS ? COMPANY_CITY_MAX : COMPANY_SIZE[1];
  const left = [...advs];
  got = [];
  while (left.length >= 2) {
    const first = /** @type {any} */ (left.shift());
    const size = Math.min(left.length + 1, rollInt(lwRng(first.town >>> 0, first.slot, COMP), COMPANY_SIZE[0], max));
    const places = [first];
    for (let j = 1; j < size; j++) {
      const have = new Set(places.map((p) => roleOf(p.cls)));
      const i = left.findIndex((r) => !have.has(roleOf(r.cls)));
      places.push(left.splice(i >= 0 ? i : 0, 1)[0]);
    }
    const key = `C${first.town >>> 0}.${got.length}`;
    got.push({ key, places, name: companyName(key, first.name, '') });
  }
  DEALS.set(roster, got);
  return got;
}

/** A company's name off its key: "The <word> Company", "<beasts> of <town>", or "<first>'s company".
 *  @param {string} key @param {string} first @param {string} town */
export function companyName(key, first, town) {
  const rng = lwRng(textSeed(key), COMP);
  const r = rng(), word = pickOf(rng, COMPANY_WORDS), beasts = pickOf(rng, COMPANY_BEASTS);
  const name = String(first).split(' ')[0];
  if (r < 1 / 3 && name) return `${name}'s company`;
  if (r < 2 / 3 && town) return `${beasts} of ${town}`;
  return `The ${word} Company`;
}
/** A company with its town's name in it (the census's roster carries no town name: the host's). @param {any} c @param {string} town */
export const namedIn = (c, town) => ({ ...c, name: companyName(c.key, c.places[0]?.name ?? '', town) });

/** The company a place belongs to, or null (a lone adventurer, anyone else). @param {any} res @param {any[]} roster */
export function companyOfPlace(res, roster) {
  if (res?.job !== 'adventurer') return null;
  return companiesOf(roster).find((c) => c.places.some((p) => p.slot === res.slot)) ?? null;
}

/** THE HEAD: the highest level of the members walking, the first of them on a tie. @param {any[]} members */
export const headOf = (members) => members.reduce((a, m) => (!a || (m.level ?? 1) > (a.level ?? 1) ? m : a), null);

/**
 * THE HOLY DAY a pilgrim's cycle reaches - the first day inside it (from its second to its last but one) that one of
 * `temples` keeps as its region's own holy day (never the day every region keeps), the nearer town first on a tie; null
 * none. `day0` the cycle's first day, `days` its length.
 * @param {any[]} temples @param {number} day0 @param {number} days @returns {{ town: any, day: number, id: number } | null}
 */
export function holyDayOf(temples, day0, days) {
  for (let d = day0 + 1; d < day0 + days - 1; d++) {
    for (const t of temples) {
      const id = getHolidayId(d * DAY_MIN + 12 * 60, t.region ?? -1);
      if (id && holidayRegion(id) !== 0xFF) return { town: t, day: d, id };
    }
  }
  return null;
}
/** The minute a town's pilgrims set out of a morning for a holy day (one for them all: they go as a band).
 *  @param {any} home @param {number} day */
export const holyDepartMin = (home, day) => 6 * 60 + (lwSeed(home.mapId >>> 0, day, HOLY) % 90);
/** A pilgrim's own draw for the holy day: true, it goes. @param {any} res @param {number} k */
export const holyDraw = (res, k) => lwRng(res.town >>> 0, res.slot, k, HOLY)() < HOLY_CHANCE;
