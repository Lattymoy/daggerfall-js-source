// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW16 (2026-10-09, bible/06-Systems/Living-World-II.md "LW16"): THE WORD TRAVELS - what happens in one town is heard in
// the next. Pure: a town's own news and the visits of these days in, never a clock or a scene.
//
//  - THE WORD CARRIED (`carriedNews`): a party come in from a town about tells what its own town knew when it set out -
//    the road's news of its own parties (trips.js newsOf) and the character's deeds known there (livingTown.js
//    deedNews) - known here from the minute it came in, for NEWS_DAYS. A courier carries the word its own town had heard
//    from ITS visitors too: one hop further, never two. The town's talk tells it in CARRIED_SHARE of its news
//    (lines.js newsScript), "There's word from Wayrest." before it.
//  - THE CHARACTER'S REPUTE (`reputeOf`): each deed of the character known in a town, its own or carried in, moves the
//    regard of the town's STRANGERS - those with no regard of their own - by its REPUTE: read, never stored, and never
//    past FRIEND_AT or ENEMY_AT (a name heard makes nobody a friend or an enemy). A stranger who has heard greets the
//    character by it (`heardOf`, lines.js HEARD_GREETINGS).
// ═══════════════════════════════════════════════════════════════════
import { NEWS_DAYS } from './trips.js';
import { DAY_MIN } from './dayPlan.js';
import { FRIEND_AT, ENEMY_AT } from './relations.js';
import { CARRIED_SHARE } from './lines.js';
export { CARRIED_SHARE };

/** What a deed of the character known in a town moves a stranger's regard by. */
export const REPUTE = Object.freeze({ saved: 4, helped: 2, routed: 5, slain: -8, robbed: -5 });
/** A stranger's regard by repute stays short of a friend's and an enemy's. */
export const REPUTE_MAX = FRIEND_AT - 1;
export const REPUTE_MIN = ENEMY_AT + 1;
/** Of a stranger's words to the character, the share that speaks of a deed they heard of. */
export const HEARD_SHARE = 0.5;

/** A news item's name across towns: a trouble of the road by its trip, a deed by its kind, its name and its minute.
 *  @param {any} item */
export const carriedKey = (item) => item.key ?? (item.id ? `trip:${item.id}` : `${item.kind}|${item.who}|${item.t}`);

/**
 * THE WORD CARRIED at minute `t`: each visit (`{ from, inT, outT0, courier, news, relay }` - a party come in at `inT`
 * from the town `from` it left at `outT0`; `news` that town's own news of the road at `outT0`) tells its town's news and
 * the character's deeds known there (`deedsAt(from, minute)`) as they stood when it set out, known here from `inT` for
 * NEWS_DAYS. A courier's tells too what its town had heard by then from its own visitors (`relay`, visits as these but
 * none of their own: one hop) - each from the town it was first told in. The town's own news (`own`) is never told as
 * carried; an item carried by two, from the first in. Newest first, each `{ ...item, key, carried: true, from, t: inT }`.
 * AUDIT LW-II B8: `here` the town's own map id - a courier's relay of a visit FROM it is its own word come back (told as
 * "word from" itself, its deeds' repute counted again once its own days had passed): never told.
 * @param {readonly any[]} visits @param {number} t
 * @param {{ own?: readonly any[], deedsAt?: (town: any, minute: number) => readonly any[], here?: number | null }} [o]
 */
export function carriedNews(visits, t, { own = [], deedsAt = () => [], here = null } = {}) {
  const ownKeys = new Set(own.map(carriedKey));
  /** What a visit's town knew when it set out. @param {any} w */
  const toldAt = (w) => [...(w.news ?? []), ...deedsAt(w.from, w.outT0)].filter((it) => it.t <= w.outT0);
  /** @type {Map<string, any>} */
  const best = new Map();
  for (const v of visits ?? []) {
    if (!(v.inT <= t && t - v.inT < NEWS_DAYS * DAY_MIN)) continue;
    const items = toldAt(v);
    if (v.courier) {
      for (const r of v.relay ?? []) {
        if (!(r.inT <= v.outT0 && v.outT0 - r.inT < NEWS_DAYS * DAY_MIN)) continue;   // heard at home before the courier set out
        if (here != null && (r.from?.mapId ?? null) === here) continue;   // AUDIT LW-II B8: its own word come back
        for (const it of toldAt(r)) items.push({ ...it, key: carriedKey(it), from: it.from || (r.from?.name ?? ''), t: r.inT });
      }
    }
    for (const it of items) {
      const key = carriedKey(it);
      if (ownKeys.has(key) || (best.get(key)?.t ?? Infinity) <= v.inT) continue;
      best.set(key, { ...it, key, carried: true, from: it.from || (v.from?.name ?? ''), t: v.inT });
    }
  }
  return [...best.values()].sort((a, b) => b.t - a.t || (a.key < b.key ? -1 : 1));
}

/**
 * The repute's kind of a news item - a deed of the character's: a keepsake carried home (`saved`), a band routed, a
 * party robbed (`robbed`), one of a town struck down where it was seen (`slain`), a fight the character turned on the
 * road (`helped`) - else null.
 * @param {any} item @returns {keyof typeof REPUTE | null}
 */
export function reputeKind(item) {
  if (!item || item.kin) return null;
  if (item.kind === 'home') return 'saved';
  if (item.kind === 'routed') return 'routed';
  if (item.kind === 'held') return 'robbed';
  if (item.kind === 'slain') return item.seen ? 'slain' : null;
  return item.helped ? 'helped' : null;
}

/**
 * A TOWN'S REPUTE of the character at the news it knows (its own and carried in): the stranger's regard, the deeds'
 * REPUTE summed and held between REPUTE_MIN and REPUTE_MAX; and the deeds, newest first.
 * @param {readonly any[]} items @returns {{ regard: number, deeds: any[] }}
 */
export function reputeOf(items) {
  let sum = 0;
  const deeds = [];
  for (const it of items ?? []) {
    const k = reputeKind(it);
    if (!k) continue;
    sum += REPUTE[k];
    deeds.push(it);
  }
  return { regard: Math.max(REPUTE_MIN, Math.min(REPUTE_MAX, sum)), deeds: deeds.sort((a, b) => b.t - a.t) };
}

/** A resident's regard of the character: their own where they have one, else their town's repute. @param {boolean} known
 *  @param {number} own @param {number} repute */
export const regardWithRepute = (known, own, repute) => (known ? own : repute);

/**
 * The deed a stranger who has heard speaks of, by their seed - HEARD_SHARE of their words, one of the deeds known (null:
 * none, or not this time).
 * @param {readonly any[]} deeds @param {number} seed @returns {any | null}
 */
export function heardOf(deeds, seed) {
  if (!deeds?.length || ((seed >>> 0) % 1000) / 1000 >= HEARD_SHARE) return null;
  return deeds[Math.floor((seed >>> 0) / 1000) % deeds.length];
}
