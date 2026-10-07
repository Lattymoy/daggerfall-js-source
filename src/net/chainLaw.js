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
// - THE STORES' ROOM (AUDIT CRAFT1 F1): a work's products land in the
//   Stores, whose room the service counts over every origin (gold's
//   too - smeltAtForge's `stores-full`); a plan never makes more of a
//   product than `room(key)` leaves, and says so (`full`) where it
//   would have to.
// - WHAT IS HELD IS TAKEN FIRST (AUDIT CRAFT1 F2): every input's held
//   units are taken before any work is planned, so an earlier input's
//   works never spend a raw good a later input asks as it is.
// ═══════════════════════════════════════════════════════════════════

import { WORK_RECIPES, SMELT_MAX, STORES_MAX, workOpen, workPer, workSpecRank, materialOf, smeltRecipe, professionName } from './professionLaw.js';

/** The deepest a chain plans. FACT: no product's works are more than two deep (the Iron Ingot and the Charcoal under the
 *  Steel), so the bound is a guard, never a limit a real recipe meets. */
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
 * @typedef {{ ok: boolean, works: ChainWork[], spent: Need[], short: Need[], full: Need[] }} ChainPlan
 */

/** A count a caller gave: a whole number of units, else none. */
const units = (/** @type {unknown} */ v) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : 0; };

class Plan {
  /** @param {(key: string) => number} held @param {(key: string) => number} room */
  constructor(held, room) {
    this.held = held;
    this.room = room;
    /** what is held and not yet taken @type {Map<string, number>} */ this.heldLeft = new Map();
    /** what the plan's works made and nothing has taken yet @type {Map<string, number>} */ this.pool = new Map();
    /** every unit the plan's works make of a product - the Stores' room it asks @type {Map<string, number>} */ this.made = new Map();
    /** @type {Map<string, number>} */ this.spent = new Map();
    /** @type {Map<string, number>} */ this.short = new Map();
    /** @type {Map<string, number>} */ this.full = new Map();
    /** @type {ChainWork[]} */ this.works = [];
  }
  /** @returns {Plan} */
  clone() {
    const p = new Plan(this.held, this.room);
    for (const k of /** @type {const} */ (['heldLeft', 'pool', 'made', 'spent', 'short', 'full'])) p[k] = new Map(this[k]);
    p.works = this.works.slice();
    return p;
  }
  /** @param {Plan} p */
  take(p) { Object.assign(this, { heldLeft: p.heldLeft, pool: p.pool, made: p.made, spent: p.spent, short: p.short, full: p.full, works: p.works }); }
  /** @param {string} key */
  heldOf(key) { return this.heldLeft.has(key) ? /** @type {number} */ (this.heldLeft.get(key)) : units(this.held(key)); }
  /** `n` of `key` taken toward a need - what the works made first, then what is held (only that counted `spent`, F3);
   *  the rest answered. @param {string} key @param {number} n */
  use(key, n) {
    const fromPool = Math.min(this.pool.get(key) ?? 0, n);
    if (fromPool) this.pool.set(key, /** @type {number} */ (this.pool.get(key)) - fromPool);
    const have = this.heldOf(key), t = Math.min(have, n - fromPool);
    this.heldLeft.set(key, have - t);
    if (t > 0) this.spent.set(key, (this.spent.get(key) ?? 0) + t);
    return n - fromPool - t;
  }
  /** The Stores' room left for the products of `key` the plan has not yet made. @param {string} key */
  roomFor(key) { const r = Number(this.room(key)); return Math.max(0, (Number.isFinite(r) ? Math.floor(r) : Number.MAX_SAFE_INTEGER) - (this.made.get(key) ?? 0)); }
  /** `made` products of `key`, `want` of them asked now - the rest there for a later need. @param {string} key @param {number} made @param {number} want */
  produce(key, made, want) {
    this.made.set(key, (this.made.get(key) ?? 0) + made);
    if (made > want) this.pool.set(key, (this.pool.get(key) ?? 0) + made - want);
  }
}

/**
 * THE CHAIN FOR A CRAFT'S INPUTS (CRAFT1): what the works must make, and in what order, for `inputs` to be held - planned
 * from `held(key)` (the Stores and what is carried, profBook's `held`) and `track(profession)` (the book's track view:
 * `{ rank, specs }`). Answers `{ ok, works, spent, short }`: `works` the service's works in the order they are asked
 * (each at most SMELT_MAX units), `spent` every held unit the plan takes (the inputs held as they are among them), and
 * `short` what nothing held or plannable covers, `full` the products the Stores have no room to take - `ok` when both are
 * empty. A plan that is not ok still lists the works it
 * would run, so a page can say what is missing at the bottom of the chain ("short 4 Iron"), not at the top.
 * @param {Need[]} inputs
 * @param {(key: string) => number} held
 * @param {{ track?: (profession: string) => TrackView|null|undefined, room?: (key: string) => number }} [opts] `room` the
 *   Stores' room for a product as it stands (STORES_MAX less every origin held - the service's count); none, no bound
 * @returns {ChainPlan}
 */
export function chainPlan(inputs, held, { track = () => null, room = () => Infinity } = {}) {
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
      // the most units of this work the held can carry - a work that covers u units covers fewer, the bound searched -
      // and the Stores' room can take
      let lo = 0, hi = Math.min(Math.ceil(left / per), Math.floor(p.roomFor(key) / per)), best = null;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const t = p.clone();
        if (r.inputs.every((/** @type {any} */ inp) => cover(t, inp.key, inp.n * mid, depth + 1, below, false))) { best = { t, mid }; lo = mid; } else hi = mid - 1;
      }
      if (best && best.mid > 0) {
        best.t.works.push({ id: r.id, count: best.mid });
        p.take(best.t);
        const made = best.mid * per;
        p.produce(key, made, Math.min(made, left));
        left = Math.max(0, left - made);
        if (left === 0) return true;
      }
    }
    if (!lenient) return false;
    // what nothing covers: through the cheapest open work to the bottom of the chain, else short here
    const r = works[0];
    if (r) {
      const per = perOf(r), count = Math.ceil(left / per);
      if (count * per > p.roomFor(key)) p.full.set(key, (p.full.get(key) ?? 0) + count * per);
      for (const inp of r.inputs) cover(p, inp.key, inp.n * count, depth + 1, below, true);
      p.works.push({ id: r.id, count });
      p.produce(key, count * per, left);
    } else p.short.set(key, (p.short.get(key) ?? 0) + left);
    return true;
  };
  const p = new Plan(held, room);
  const asked = (inputs ?? []).filter((inp) => typeof inp?.key === 'string' && units(inp?.n) > 0);
  // F2: every input's held units taken first; the works plan only what is left of each
  const rest = asked.map((inp) => ({ key: inp.key, n: p.use(inp.key, units(inp.n)) }));
  for (const inp of rest) {
    if (inp.n === 0) continue;
    const t = p.clone();
    if (cover(t, inp.key, inp.n, 0, [], false)) p.take(t);
    else cover(p, inp.key, inp.n, 0, [], true);
  }
  const list = (/** @type {Map<string, number>} */ m) => [...m].map(([key, n]) => ({ key, n }));
  return { ok: p.short.size === 0 && p.full.size === 0, works: chainWorks(p.works), spent: list(p.spent), short: list(p.short), full: list(p.full) };
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

/** The Stores' room for a material as a book's view holds it (`{ own, bought, gold }`) - STORES_MAX less every origin, as
 *  the service counts it (smeltAtForge's `stores-full`). */
export const storesRoom = (/** @type {{ own?: number, bought?: number, gold?: number }|null|undefined} */ s) => Math.max(0, STORES_MAX - ((s?.own ?? 0) | 0) - ((s?.bought ?? 0) | 0) - ((s?.gold ?? 0) | 0));

/** Whether a craft wants a chain at all: some input not held as it stands. */
export const chainNeeded = (/** @type {Need[]} */ inputs, /** @type {(key: string) => number} */ held) => (inputs ?? []).some((inp) => (Number(held(inp.key)) || 0) < inp.n);

/**
 * What a chain refined, said after the craft it ran for (the station's answer): "Refined first: Iron Ingot x3, Charcoal x3,
 * Steel Ingot x3 (+120 Smithing XP)." - `refined` the book's (`{ id, count, xp }` a work asked), `name` a material's
 * label, `track` the book's (the yield a unit of work made, where the book kept no `made` - the service's own and bought).
 * Empty where nothing was refined.
 * @param {{ id: string, count: number, xp?: number, made?: number }[]|null|undefined} refined
 * @param {(key: string) => string} name
 * @param {(profession: string) => TrackView|null|undefined} [track]
 */
export function refinedText(refined, name, track = () => null) {
  if (!Array.isArray(refined) || !refined.length) return '';
  const made = new Map(), xp = new Map();
  for (const w of refined) {
    const r = smeltRecipe(w.id);
    if (!r) continue;
    // AUDIT CRAFT1 F4: what the service said it made (its own and bought), where the book kept it
    const n = Number.isSafeInteger(w.made) && /** @type {number} */ (w.made) >= 0 ? /** @type {number} */ (w.made) : w.count * chainYield(r, track);
    made.set(r.out, (made.get(r.out) ?? 0) + n);
    if (r.xp && Number(w.xp) > 0) xp.set(r.xp, (xp.get(r.xp) ?? 0) + Number(w.xp));
  }
  if (!made.size) return '';
  const xps = [...xp].map(([prof, n]) => `+${n} ${professionName(prof)} XP`).join(', ');
  return `Refined first: ${[...made].map(([k, n]) => `${name(k)} x${n}`).join(', ')}${xps ? ` (${xps})` : ''}.`;
}

/**
 * AUDIT CRAFT1 F4: where a chain stopped, said after the refusal ("The chain stopped at the Steel Ingot, short of
 * Charcoal.") - `stopped` the work refused (the book's), `material` what the service named; empty where none stopped.
 * @param {string|null|undefined} stopped @param {string|null|undefined} material @param {(key: string) => string} name
 */
export function chainStopText(stopped, material, name) {
  const r = typeof stopped === 'string' ? smeltRecipe(stopped) : null;
  if (!r) return '';
  return `The chain stopped at the ${name(r.out)}${typeof material === 'string' && material ? `, short of ${name(material)}` : ''}.`;
}
