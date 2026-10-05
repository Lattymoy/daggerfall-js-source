// @ts-check
// LEGACY6 (2026-10-05, bible/06-Systems/Legacy-Arc.md section 10; Mac: "World Influence"): WHAT THE WORLD REMEMBERS OF
// THE HOUSE - the law, pure. The host (scenes/legacyHost.js) writes a member's standing as they are saved, hands a share
// of it to the child born of them, and keeps the house's news; the Living World's towns tell it (livingTown.js
// familyNews, lines.js KIN_NEWS).
//
//  - THE STANDING a member leaves (`memberStanding`): their legal reputation in every region, their faction standings (the
//    FACTIONS_KEPT furthest from nothing) and the Living World's regard of the residents who know them (the REGARDS_KEPT
//    strongest, at least REGARD_FLOOR either way) - read off the character at every save, on their person.
//  - THE BIRTH'S SHARE (`inheritStanding`, `inheritRegards`): a child born of them starts with STANDING_SHARE of what
//    the parent held over the child's own start - a region's law, a guild's regard - and REGARD_SHARE of each
//    resident's regard ("your mother saved my son"; and a grudge is half a grudge).
//  - THE HOUSE'S NEWS (`noteNews`, `newsFor`): a death, a laying to rest, a wedding and a birth are told for HOUSE_NEWS_DAYS in
//    the town where they happened and in the family's seat - by name and by house.
import { LEGAL_REP_MIN, LEGAL_REP_MAX } from '../court.js';
import { changeReputation } from '../factionRep.js';

export const STANDING_SHARE = 0.25;
export const REGARD_SHARE = 0.5;
export const FACTIONS_KEPT = 40;
export const REGARDS_KEPT = 60;
export const REGARD_FLOOR = 10;
export const HOUSE_NEWS_DAYS = 7;
export const NEWS_MAX = 24;
export const NEWS_KINDS = Object.freeze(['died', 'rested', 'wed', 'born']);
const DAY_MIN = 1440;
const NAME_MAX = 60;

/** @typedef {{ legal: Record<string, number>, factions: Record<string, number>, regard: Record<string, number> }} Standing */
/** @typedef {{ k: string, who: string, t: number, m: number|null }} News - kind, whole name, the town's minute, its map id */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const top = (entries, n) => entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || (a[0] < b[0] ? -1 : 1)).slice(0, n);

/**
 * The standing the played character holds now - their person's `standing`, written at every save.
 * @param {any} entity - the player entity (`legalRep`, `factionRep.dict`)
 * @param {{ entries?: () => { id: string }[], regard?: (id: string, day: number) => number } | null} regards - the
 *   Living World's relations, or none
 * @param {number} day - the relations' day
 * @returns {Standing}
 */
export function memberStanding(entity, regards, day) {
  const legal = {};
  for (const [k, v] of Object.entries(entity?.legalRep ?? {})) {
    const n = Math.trunc(Number(v));
    if (Number.isFinite(n) && n !== 0 && /^\d+$/.test(k)) legal[k] = clamp(n, LEGAL_REP_MIN, LEGAL_REP_MAX);
  }
  const dict = entity?.factionRep?.dict;
  const facs = dict instanceof Map ? [...dict].map(([id, f]) => [String(id), Math.trunc(Number(f?.rep) || 0)]).filter(([, r]) => r !== 0) : [];
  const regs = regards?.entries && regards.regard
    ? regards.entries().map((e) => [e.id, Math.round(/** @type {any} */ (regards).regard(e.id, day))]).filter(([, r]) => Math.abs(Number(r)) >= REGARD_FLOOR)
    : [];
  return { legal, factions: Object.fromEntries(top(facs, FACTIONS_KEPT)), regard: Object.fromEntries(top(regs, REGARDS_KEPT)) };
}

/** A standing read back (a save, the store) - the shape held, anything else dropped; null when there is none. */
export function readStanding(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const pick = (o, keyOk, lo, hi, n) => top(Object.entries(o && typeof o === 'object' ? o : {})
    .map(([k, v]) => [k, Math.trunc(Number(v))]).filter(([k, v]) => keyOk(k) && Number.isFinite(v) && v !== 0).map(([k, v]) => [k, clamp(v, lo, hi)]), n);
  return {
    legal: Object.fromEntries(pick(raw.legal, (k) => /^\d{1,3}$/.test(k), LEGAL_REP_MIN, LEGAL_REP_MAX, 200)),
    factions: Object.fromEntries(pick(raw.factions, (k) => /^\d{1,6}$/.test(k), -100, 100, FACTIONS_KEPT)),
    regard: Object.fromEntries(pick(raw.regard, (k) => k.length > 0 && k.length <= 40, -100, 100, REGARDS_KEPT)),
  };
}

/**
 * THE BIRTH'S SHARE of the law and the guilds: STANDING_SHARE of what the parent held over the child's own start, added
 * to the child's (a region's law written straight - no crime's word is said for it - and held to DFU's bounds; a
 * faction's flat, never walked to its allies). Answers how many standings moved.
 * @param {any} entity - the newborn's @param {Standing|null} parent
 */
export function inheritStanding(entity, parent) {
  if (!entity || !parent) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(parent.legal ?? {})) {
    const own = Number(entity.legalRep?.[k]) || 0;
    const d = Math.trunc((v - own) * STANDING_SHARE);
    if (!d) continue;
    entity.legalRep ??= {};
    entity.legalRep[k] = clamp(own + d, LEGAL_REP_MIN, LEGAL_REP_MAX);
    n++;
  }
  const store = entity.factionRep;
  for (const [id, v] of Object.entries(parent.factions ?? {})) {
    const f = store?.dict?.get?.(Number(id));
    if (!f) continue;
    const d = Math.trunc((v - (Number(f.rep) || 0)) * STANDING_SHARE);
    if (d && changeReputation(store, Number(id), d, false)) n++;
  }
  return n;
}

/**
 * THE BIRTH'S SHARE of the town's regard: REGARD_SHARE of each resident's regard of the parent, into the child's
 * relations (relations.js inherit - no word is counted for it). Answers how many residents know the child now.
 * @param {{ inherit?: (id: string, amount: number, day: number) => number } | null} relations
 * @param {Standing|null} parent @param {number} day
 */
export function inheritRegards(relations, parent, day) {
  if (!relations?.inherit || !parent) return 0;
  let n = 0;
  for (const [id, r] of Object.entries(parent.regard ?? {})) {
    const d = Math.trunc(r * REGARD_SHARE);
    if (d) { relations.inherit(id, d, day); n++; }
  }
  return n;
}

/** The house's news read back - kinds known, names bounded, the newest NEWS_MAX. @returns {News[]} */
export function readNews(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n) => n && NEWS_KINDS.includes(n.k) && typeof n.who === 'string' && n.who && Number.isFinite(Number(n.t)))
    .map((n) => ({ k: n.k, who: n.who.slice(0, NAME_MAX), t: Number(n.t), m: Number.isInteger(n.m) ? n.m >>> 0 : null }))
    .sort((a, b) => a.t - b.t).slice(-NEWS_MAX);
}

/**
 * Something befell the house that its towns will talk of: `kind` one of NEWS_KINDS, `who` the member's whole name, at
 * the town's minute `t`, in the town `mapId` (or none - the seat alone tells it). Answers whether it was new.
 * @param {any} family @param {string} kind @param {string} who @param {number} t @param {number|null|undefined} mapId
 */
export function noteNews(family, kind, who, t, mapId) {
  if (!family || !NEWS_KINDS.includes(kind) || !who || !Number.isFinite(t)) return false;
  const list = (family.news ??= []);
  const n = { k: kind, who: String(who).slice(0, NAME_MAX), t: Math.floor(t), m: Number.isInteger(mapId) ? Number(mapId) >>> 0 : null };
  if (list.some((x) => x.k === n.k && x.who === n.who && x.t === n.t)) return false;
  list.push(n);
  if (list.length > NEWS_MAX) list.splice(0, list.length - NEWS_MAX);
  return true;
}

/** Two copies' news as one (store.js mergeFacts): the union, the newest NEWS_MAX. */
export function mergeNews(a, b) {
  const out = readNews(a);
  for (const n of readNews(b)) if (!out.some((x) => x.k === n.k && x.who === n.who && x.t === n.t)) out.push(n);
  return out.sort((x, y) => x.t - y.t).slice(-NEWS_MAX);
}

/**
 * WHAT A TOWN SAYS OF THE HOUSE at minute `t`: each piece of news of the last HOUSE_NEWS_DAYS that happened in it, or of any
 * kind when it is the family's seat - in the shape the town's news takes (livingTown.js lineCtx), `kin` its own words,
 * `house` the family's name.
 * @param {any} family @param {number} mapId @param {number} t
 * @returns {{ kind: string, kin: true, who: string, house: string, foe: string, place: string, t: number, seen: true }[]}
 */
export function newsFor(family, mapId, t) {
  if (!family?.news?.length || !Number.isFinite(t)) return [];
  const here = Number(mapId) >>> 0;
  const seat = family.seat?.mapId != null && (family.seat.mapId >>> 0) === here;
  return family.news.filter((n) => n.t <= t && t - n.t < HOUSE_NEWS_DAYS * DAY_MIN && (seat || (n.m != null && n.m === here)))
    .map((n) => ({ kind: n.k, kin: /** @type {true} */ (true), who: n.who, house: family.surname ?? '', foe: '', place: '', t: n.t, seen: /** @type {true} */ (true) }))
    .sort((a, b) => b.t - a.t);
}
