// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CRAFT1 (2026-10-07) — THE CHAIN: a station plans the refining a craft
// needs (bible/06-Systems/Professions-Arc.md section 41, CRAFT0). Pure:
// no clock, no DOM, no network.
//
// Asked (2026-10-07, Mac: "How could we enhance the profession element
// of the game while reducing complexity and making crafting more
// viable"; then, of the five proposals, "Lets do it"). A Steel
// Longsword asks 3 Steel Ingots, 1 Copper and 1 Cured Leather - and
// from what a gatherer holds that was four works at two stations
// before the anvil: smelt the Iron, burn the Charcoal, smelt the Steel,
// cure the hide. THE STATION PLANS THE CHAIN NOW: a recipe whose inputs
// the Stores (and the bag and the pack, BAG1) lack is offered where
// the works that make them can be planned from what is held, and the
// craft runs them first (net/profBook.js craft) - each the service's
// own work (`/v1/prof/smelt`, professions.js smeltAtForge), its XP and
// its origin as ever. No new door: nothing the service is asked is new.
//
// ═══ WHAT A CHAIN MAY DO ════════════════════════════════════════════
//
// - Every work of the forge, the workbench, the loom and the mason's
//   bench (professionLaw WORK_RECIPES) - never a transmutation: that
//   is a Transmuter's choice of what to spend, and its ladder trades
//   a metal for another the craft may also want.
// - NEVER DOWN A TIER (DECIDED, CRAFT0 41.2): a work whose input is of
//   a higher tier than its product is never planned - Ghostwood is
//   never burnt to Charcoal, a Dragonling hide never cured to Hardened
//   Leather. Those stay the player's own press at the station.
// - THE CHEAPEST FIRST: where several works make one product (the
//   cures to Cured Leather), the table's first is spent first, and the
//   next only for what the first could not cover. FACT: the table
//   stands cheapest first for every such product (Rat, Bat, Bear;
//   Scorpion, Slaughterfish, Dreugh) - pinned, not sorted.
// - The rank and the choices the service asks (workOpen; workPer at
//   workSpecRank - a Tanner's cure, a Timberwright's saw, a
//   Quartermaster's ingot), read from the client's book: a plan the
//   service would refuse is a plan the service refuses, and the craft
//   stops there with the earlier works' products in the Stores.
// - At most CHAIN_DEPTH works deep, each at most SMELT_MAX units a
//   request (the service's bound), split where a count is more.
// ═══════════════════════════════════════════════════════════════════

import { WORK_RECIPES, SMELT_MAX, workOpen, workPer, workSpecRank, materialOf, smeltRecipe, professionName } from './professionLaw.js';

/** The deepest a chain plans: Steel's is three (the hide, the Iron, the Steel), Mortar's two. */
export const CHAIN_DEPTH = 4;

/** A material's tier, the ladder's (professionLaw materialOf; a work takes no herb) - 0 for a key no table names. */
const tierOf = (/** @type {string} */ key) => materialOf(key, () => null)?.tier ?? 0;

/** Whether a work never trades down: every input of a tier at most its product's (41.2). */
export const chainWorkOk = (/** @type {any} */ r) => !!r && !r.spec && r.inputs.every((/** @type {any} */ inp) => tierOf(inp.key) <= tierOf(r.out));

/** The works a chain may plan - WORK_RECIPES less the transmutations and the works that trade down. */
export const CHAIN_WORKS = Object.freeze(WORK_RECIPES.filter(chainWorkOk));

/** The works that make `key`, in the table's order - the cheapest first. */
export const producersOf = (/** @type {string} */ key) => CHAIN_WORKS.filter((r) => r.out === key);

/**
 * What a unit of work makes for a character - the service's own reading (professions.js smeltAtForge): the choice that
 * raises its yield, at the rank it is made (workSpecRank - a Tanner's at 50), read from `track` (the book's).
 * @param {any} r @param {(profession: string) => TrackView|null|undefined} [track]
 */
export const chainYield = (r, track = () => null) => workPer(r, r.more ? { [r.more.profession]: track(r.more.profession)?.specs?.[workSpecRank(r)] ?? null } : {});

/**
 * @typedef {{ rank?: number, specs?: Record<number, string|null|undefined> }} TrackView
 * @typedef {{ key: string, n: number }} Need
 * @typedef {{ id: string, count: number }} ChainWork
 * @typedef {{ ok: boolean, works: ChainWork[], spent: Need[], short: Need[] }} ChainPlan
 */

class Plan {
  /** @param {(key: string) => number} held */
  constructor(held) {
    this.held = held;
    /** @type {Map<string, number>} */ this.avail = new Map();
    /** @type {Map<string, number>} */ this.spent = new Map();
    /** @type {Map<string, number>} */ this.short = new Map();
    /** @type {ChainWork[]} */ this.works = [];
  }
  /** @returns {Plan} */
  clone() {
    const p = new Plan(this.held);
    p.avail = new Map(this.avail); p.spent = new Map(this.spent); p.short = new Map(this.short); p.works = this.works.slice();
    return p;
  }
  /** @param {Plan} p */
  take(p) { this.avail = p.avail; this.spent = p.spent; this.short = p.short; this.works = p.works; }
  /** @param {string} key */
  left(key) {
    if (this.avail.has(key)) return /** @type {number} */ (this.avail.get(key));
    const h = Number(this.held(key));
    return Number.isSafeInteger(h) && h > 0 ? h : 0;
  }
  /** What is held of `key` taken toward `n`; the rest answered. @param {string} key @param {number} n */
  use(key, n) {
    const have = this.left(key);
    const t = Math.min(have, n);
    this.avail.set(key, have - t);
    if (t > 0) this.spent.set(key, (this.spent.get(key) ?? 0) + t);
    return n - t;
  }
  /** Products a work made past what was asked of it, there for a later need. @param {string} key @param {number} n */
  spare(key, n) { if (n > 0) this.avail.set(key, this.left(key) + n); }
}

/**
 * THE CHAIN FOR A CRAFT'S INPUTS (CRAFT1): what the works must make, and in what order, for `inputs` to be held - planned
 * from `held(key)` (the Stores and what is carried, profBook's `held`) and `track(profession)` (the book's track view:
 * `{ rank, specs }`). Answers `{ ok, works, spent, short }`: `works` the service's works in the order they are asked
 * (each at most SMELT_MAX units), `spent` every held unit the plan takes (the inputs held as they are among them), and
 * `short` what nothing held or plannable covers - `ok` when it is empty. A plan that is not ok still lists the works it
 * would run, so a page can say what is missing at the bottom of the chain ("short 4 Iron"), not at the top.
 * @param {Need[]} inputs
 * @param {(key: string) => number} held
 * @param {{ track?: (profession: string) => TrackView|null|undefined }} [opts]
 * @returns {ChainPlan}
 */
export function chainPlan(inputs, held, { track = () => null } = {}) {
  const rankOf = (/** @type {any} */ r) => (r.xp ? track(r.xp)?.rank ?? 0 : 0);
  const perOf = (/** @type {any} */ r) => chainYield(r, track);
  /**
   * `n` of `key` covered into `p` - held first, then by its works. Strict: answers false and leaves `p` as it was where
   * it cannot. Lenient: covers what it can, books the rest `short` at the bottom of the chain, and answers true.
   * @param {Plan} p @param {string} key @param {number} n @param {number} depth @param {string[]} path @param {boolean} lenient
   */
  const cover = (p, key, n, depth, path, lenient) => {
    let left = p.use(key, n);
    if (left === 0) return true;
    const works = depth < CHAIN_DEPTH && !path.includes(key) ? producersOf(key).filter((r) => workOpen(r, rankOf(r))) : [];
    const below = [...path, key];
    for (const r of works) {
      const per = perOf(r);
      // the most units of this work the held can carry: a work that covers u units covers fewer - the bound searched
      let lo = 0, hi = Math.ceil(left / per), best = null;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const t = p.clone();
        if (r.inputs.every((/** @type {any} */ inp) => cover(t, inp.key, inp.n * mid, depth + 1, below, false))) { best = { t, mid }; lo = mid; } else hi = mid - 1;
      }
      if (best && best.mid > 0) {
        best.t.works.push({ id: r.id, count: best.mid });
        p.take(best.t);
        const made = best.mid * per;
        p.spare(key, made - Math.min(made, left));
        left = Math.max(0, left - made);
        if (left === 0) return true;
      }
    }
    if (!lenient) return false;
    // what nothing covers: through the cheapest open work to the bottom of the chain, else short here
    const r = works[0];
    if (r) {
      const per = perOf(r), units = Math.ceil(left / per);
      for (const inp of r.inputs) cover(p, inp.key, inp.n * units, depth + 1, below, true);
      p.works.push({ id: r.id, count: units });
      p.spare(key, units * per - left);
    } else p.short.set(key, (p.short.get(key) ?? 0) + left);
    return true;
  };
  const p = new Plan(held);
  for (const inp of inputs ?? []) {
    const n = Number(inp?.n);
    if (typeof inp?.key !== 'string' || !Number.isSafeInteger(n) || n <= 0) continue;
    const t = p.clone();
    if (cover(t, inp.key, n, 0, [], false)) p.take(t);
    else cover(p, inp.key, n, 0, [], true);
  }
  return { ok: p.short.size === 0, works: chainWorks(p.works), spent: [...p.spent].map(([key, n]) => ({ key, n })), short: [...p.short].map(([key, n]) => ({ key, n })) };
}

/** The works in their order, a work asked twice in a row asked once, and each request at most SMELT_MAX units. */
export function chainWorks(/** @type {ChainWork[]} */ works) {
  /** @type {ChainWork[]} */
  const joined = [];
  for (const w of works) {
    const last = joined[joined.length - 1];
    if (last && last.id === w.id) last.count += w.count; else joined.push({ id: w.id, count: w.count });
  }
  return joined.flatMap((w) => Array.from({ length: Math.ceil(w.count / SMELT_MAX) }, (_, i) => ({ id: w.id, count: Math.min(SMELT_MAX, w.count - i * SMELT_MAX) })));
}

/** Whether a craft wants a chain at all: some input not held as it stands. */
export const chainNeeded = (/** @type {Need[]} */ inputs, /** @type {(key: string) => number} */ held) => (inputs ?? []).some((inp) => (Number(held(inp.key)) || 0) < inp.n);

/**
 * What a chain refined, said after the craft it ran for (the station's answer): "Refined first: Iron Ingot x3, Charcoal x3,
 * Steel Ingot x3 (+120 Smithing XP)." - `refined` the book's (`{ id, count, xp }` a work asked), `name` a material's
 * label, `track` the book's (the yield a unit of work made). Empty where nothing was refined.
 * @param {{ id: string, count: number, xp?: number }[]|null|undefined} refined
 * @param {(key: string) => string} name
 * @param {(profession: string) => TrackView|null|undefined} [track]
 */
export function refinedText(refined, name, track = () => null) {
  if (!Array.isArray(refined) || !refined.length) return '';
  const made = new Map(), xp = new Map();
  for (const w of refined) {
    const r = smeltRecipe(w.id);
    if (!r) continue;
    made.set(r.out, (made.get(r.out) ?? 0) + w.count * chainYield(r, track));
    if (r.xp && Number(w.xp) > 0) xp.set(r.xp, (xp.get(r.xp) ?? 0) + Number(w.xp));
  }
  if (!made.size) return '';
  const xps = [...xp].map(([prof, n]) => `+${n} ${professionName(prof)} XP`).join(', ');
  return `Refined first: ${[...made].map(([k, n]) => `${name(k)} x${n}`).join(', ')}${xps ? ` (${xps})` : ''}.`;
}
