// @ts-check
// STEED1 / WAGONS4 (2026-10-11): THE UPKEEP, A FRAME AT A TIME - horse care (systems/steedCare.js) and wagon upkeep
// (systems/wagon/wagonUpkeep.js) run over a host's pack and clock. One a host (scenes/world.js, scenes/exterior.js -
// createUpkeep), its doors the host's:
//
//   items()      the pack (playerEntity.items)               now()      the character's clock (worldTick.js ownMinutes)
//   horseCare()  STEED1's tier - its rules (systems/upkeep/upkeepTiers.js), null for Off: the hosts hand THE ONE ACCESSOR,
//                systems/upkeep/upkeepSwitch.js horseCareRules (HORSE-TIERS, Features: Horse care)
//   wagonUpkeep()  WAGONS4's tier - its rules (systems/upkeep/upkeepTiers.js), null for Off: the hosts hand ITS ONE ACCESSOR,
//                systems/upkeep/upkeepSwitch.js wagonUpkeepRules (WAGON-TIERS, Features: Wagon upkeep)
//   where()      the horse's keep: 'with' | 'waiting' | 'stabled' (steedCare.js STEED_WHERE - the host reads Horse Cart
//                and Cargo's view: horseWhereOf)
//   stores()     the wagon's load where it is with its owner (its storage in reach - upkeepReach's wagonNear), else []:
//                a horse eats from it as from the pack
//   say(text)    a line on the HUD
//
// Each frame the host hands `tick` what its motor did: the transport (`mode`), whether it galloped (the run on a horse,
// moving), how far it rolled (its odometer's metres since the last frame), on a road or not, the wagon's load, and
// whether the wagon went with it (driven, or its team following). The motor asks `rideScale(mode)` for its ride's pace
// and transport.js's gallop gate asks `gallopGate`, its walk `rideWalks` (HORSE-WALK); the HUD asks `bar()`; the Stable
// card `model()` and `act()`; the Enhanced Plus saddle panel (ui/enhanced/enhancedSaddle.js) `saddle(mode)` and `act()`.
//
// A horse's breath is kept here, by its seed (no field: a gallop's breath is not a thing to save), and comes back whole
// over any span of the clock skipped (steedCare.js SKIP_MINUTES - a rest, a wait, a journey, a load).

import { activeHorseItem, birthHorses, isHorseItem, describeHorseLook, horseLookOf } from '../horse/horseCoats.js';
import { activeWagonItem, wagonHorsesOf, wagonKindOf } from '../wagon/wagonKinds.js';
import {
  steedStats, stepBreath, freshBreath, breathShare, canGallop, steedSpeedScale, teamDraftScale, tendHorses, feedHorse,
  chooseRiddenHorse, horsesIn, steedFoodOf, STEED_TEXT, SKIP_MINUTES, HUNGER, STEED_STATS, STEED_STAT_TEXT, fedUntil,
  FULL_AHEAD, BOND_TIERS,
} from '../steedCare.js';
import {
  wagonState, wagonSoundness, wagonCondition, wagonConditionMax, rollWear, journeyWear, createWearAccount, wearWagon,
  wagonPace, mendPrice, kitMendWagon, wagonWord, WAGON_UPKEEP_TEXT, THROWN_WEAR, WAGON_KIT_CEILING,
} from '../wagon/wagonUpkeep.js';
import { isWagonKitItem, UPKEEP_ITEM } from './upkeepItemRows.js';
import { registerItemUseHandler } from '../item/itemTemplates.js';
import { HORSE_MODE, WAGON_MODE, TRANSPORT } from '../horse/horseCartLaw.js';

/** A breath under this share shows short on the HUD. */
export const BREATH_LOW = 0.25;
/** STEED-UI: a bond's way on - the points its word was reached at (`tierAt`), and the next word and the points it is
 *  reached at (`next`, null at Kindred). Pure. @param {number} bond */
export function bondWay(bond) {
  const next = BOND_TIERS.find((x) => x.min > bond) ?? null;
  return { tierAt: [...BOND_TIERS].reverse().find((x) => bond >= x.min)?.min ?? 0, next: next ? { name: next.name, at: next.min } : null };
}

/**
 * HORSE-TIERS (2026-10-15): `horseCare()` answers the live tier's rules (upkeepTiers.js HORSE_CARE_RULES) or null for
 * Off - each door below reads it once, at its call, so a turn of the tier takes effect at once. WAGON-TIERS: and
 * `wagonUpkeep()` wagon upkeep's (WAGON_UPKEEP_RULES), the same way.
 * @param {{ items: () => any[], now: () => number, horseCare?: () => any, wagonUpkeep?: () => any,
 *   where?: () => string, stores?: () => any[], say?: (text: string) => void }} deps
 */
export function createUpkeep({ items, now, horseCare = () => null, wagonUpkeep = () => null, where = () => 'with', stores = () => [], say = () => {} }) {
  /** @type {Map<number, { spent: number, winded: boolean }>} */
  const breaths = new Map();
  let lastNow = /** @type {number|null} */ (null);
  let tendedAt = /** @type {number|null} */ (null);   // the clock's minute the keep last ran (once a game minute - five seconds)
  let wasRiding = false, wasWinded = false;
  const wear = createWearAccount();
  let lastState = /** @type {string|null} */ (null);
  let lastWagon = /** @type {any} */ (null);

  const pack = () => { const it = items(); return Array.isArray(it) ? it : []; };
  const store = () => { const s = stores(); return Array.isArray(s) ? s : []; };
  const breathOf = (horse) => { const s = horse?.horseSeed | 0; if (!breaths.has(s)) breaths.set(s, freshBreath()); return /** @type {{ spent: number, winded: boolean }} */ (breaths.get(s)); };
  const ridden = () => activeHorseItem(pack());

  /** A wagon's state moved down a step: said, once - Rickety, Failing. WAGON-TIERS: in its tier's words - Boons' say
   *  no slowness it does not have. */
  function sayWorn(item, after, wcare) {
    if (!after || after.key === 'sound' || after.key === 'worn') return;
    const name = wagonWord(item), slows = !!wcare?.wearSlows;
    if (after.key === 'failing') say(slows ? WAGON_UPKEEP_TEXT.failing(name) : WAGON_UPKEEP_TEXT.failingBoons(name));
    else say(slows ? WAGON_UPKEEP_TEXT.rickety(name) : WAGON_UPKEEP_TEXT.ricketyBoons(name));
  }

  /**
   * One frame. `dt` real seconds; `mode` the transport ('Horse', 'Cart', 'Foot'...); `galloping` the run on a horse,
   * moving; `moving` the body moved this frame; `metres` the odometer's horizontal metres since the last frame; `road`
   * the wheels on a road; `load` the wagon's load share; `wagonGoes` the wagon rolls with the player (driven, or its
   * team following them).
   * @param {number} dt
   * @param {{ mode?: string, galloping?: boolean, moving?: boolean, metres?: number, road?: boolean, load?: number, wagonGoes?: boolean }} [f]
   */
  function tick(dt, { mode = 'Foot', galloping = false, moving = false, metres = 0, road = true, load = 0, wagonGoes = false } = {}) {
    const its = pack(), t = now();
    if (!Number.isFinite(t)) return;
    const skipped = lastNow != null && t - lastNow >= SKIP_MINUTES;
    const care = horseCare();
    if (care) {
      birthHorses(its);
      if (skipped || tendedAt == null || Math.floor(t) !== tendedAt) {   // the keep: the host's `where` read a game minute at most
        const r = tendHorses(its, t, { since: tendedAt ?? lastNow, where: where(), stores: store(), rules: care });
        if (r.ate) say(STEED_TEXT.ateOnTheRoad(r.ate));
        tendedAt = Math.floor(t);
      }
      if (skipped) breaths.clear();   // a span skipped: every horse its breath back
      const horse = activeHorseItem(its);
      const riding = mode === 'Horse';
      if (horse) {
        const st = steedStats(horse, t, care);
        if (st) {
          const b = stepBreath(breathOf(horse), { stats: st.stats, hunger: st.hunger, galloping: riding && galloping, ridden: riding && moving, dt, rules: care });
          breaths.set(horse.horseSeed | 0, b);
          if (b.winded && !wasWinded && riding) say(STEED_TEXT.winded);
          else if (!b.winded && wasWinded && riding) say(STEED_TEXT.rested);
          wasWinded = b.winded;
          if (riding && !wasRiding && st.hunger !== 'fed') say(st.hunger === 'starving' ? STEED_TEXT.starving : 'Your horse is hungry.');
        }
      }
      wasRiding = riding;
    } else {
      breaths.clear(); wasRiding = false; wasWinded = false; tendedAt = null;   // AUDIT STEED1: off, no keep ran - none to catch up when it is on again
      // HORSE-TIERS (Climates & Calories' Off, SURV-TIERS: "its minutes are nobody's needs"): Off a horse is DFU's and
      // needs nothing, so each horse's food clock is carried with the clock - it stands, on again, where Off found it,
      // neither starved nor its bond faded by the time it was DFU's
      if (lastNow != null && t > lastNow) {
        for (const h of its) if (isHorseItem(h) && Number.isInteger(h.horseFed) && h.horseFed > 0) h.horseFed = Math.round(h.horseFed + (t - lastNow));
      }
    }
    const wcare = wagonUpkeep();   // WAGON-TIERS: Boons and Hard wear it alike (the same world); Off never
    if (wcare) {
      const w = activeWagonItem(its);
      if (w !== lastWagon) { lastWagon = w; lastState = w ? wagonState(w).key : null; }
      if (w && wagonGoes && metres > 0 && metres < 1000) {
        const r = wear.add(w, rollWear(metres, { kind: wagonKindOf(w), road, load }));
        if (r && r.after.key !== r.before.key) sayWorn(w, r.after, wcare);
      }
      if (w) lastState = wagonState(w).key;
    }
    lastNow = t;
  }

  /** The motor's ride pace, its ride base times this: a horse's Speed; a wagon's state and its team's Strength under
   *  its load. 1 with either tier Off - and a wagon's state only where its tier's wear slows it (WAGON-TIERS: Hard).
   *  @param {string} mode @param {number} [load] */
  function rideScale(mode, load = 0) {
    const its = pack(), t = now();
    const care = horseCare();
    if (mode === 'Horse') {
      if (!care) return 1;
      const st = steedStats(activeHorseItem(its), t, care);
      return st ? steedSpeedScale(st.stats.speed, care) : 1;
    }
    if (mode === 'Cart') {
      let k = 1;
      const w = activeWagonItem(its);
      const wcare = wagonUpkeep();
      if (wcare && w) k *= wagonPace(w, wcare);   // WAGON-MEND: a failing wagon's the slowest - and every wagon rolls; WAGON-TIERS: on Hard
      if (care && w) {
        const team = horsesIn(its).slice(0, wagonHorsesOf(wagonKindOf(w)));
        const strengths = team.map((h) => steedStats(h, t, care)?.stats.strength).filter((v) => Number.isFinite(v));
        if (strengths.length) k *= teamDraftScale(strengths.reduce((a, b) => a + b, 0) / strengths.length, load, care);
      }
      return k;
    }
    return 1;
  }

  /** transport.js's gallop gate: on a horse, the run only while it has its breath and is not starving (and the mod's
   *  own word - Roleplay & Realism's no-gallop-in-town - first); with horse care, a run on a horse the mod does not
   *  rule on is a gallop. Null: no word (horse care off, or not a horse). @param {string} mode @param {boolean|null} base */
  function gallopGate(mode, base) {
    const care = horseCare();
    if (!care || mode !== 'Horse') return null;
    if (base === false) return false;
    const horse = ridden();
    const st = steedStats(horse, now(), care);
    if (!st) return base;
    return canGallop(breathOf(horse), st.hunger);
  }

  /** transport.js's walk (HORSE-WALK): the horse walks unless it gallops wherever horse care rules its gallop - horse
   *  care on, a horse, the one ridden born (its stats; gallopGate defers to the mod without them). Else false: DFU's
   *  ride base. HORSE-TIERS: `runAsked` the rider asks the gallop (Run held, or latched) - a gallop asked and refused
   *  (winded, starving: gallopGate) walks only in a tier that holds a refused gallop to the walk (`refusedRunWalks` -
   *  Hard); Boons rides it at DFU's own pace, so Run held is never slower than DFU's horse.
   *  @param {string} mode @param {boolean} [runAsked] */
  function rideWalks(mode, runAsked = false) {
    const care = horseCare();
    if (!care || mode !== 'Horse') return false;
    if (runAsked && !care.refusedRunWalks) return false;
    return !!steedStats(ridden(), now(), care);
  }

  /** Whether the rider pays the gallop's fatigue (DFU's running band): not when horse care has the horse pay it in
   *  breath. @param {string} mode */
  const riderPaysGallop = (mode) => !(!!horseCare() && mode === 'Horse' && !!ridden());

  /** The HUD's horse bar while riding: `{ amount, low }` or null. @param {string} mode */
  function bar(mode) {
    const care = horseCare();
    if (!care || mode !== 'Horse') return null;
    const horse = ridden();
    const st = steedStats(horse, now(), care);
    if (!st) return null;
    const b = breathOf(horse), amount = breathShare(b, st.stats);
    return { amount, low: b.winded || amount < BREATH_LOW || st.hunger === 'starving' };
  }

  /** A journey on the travel map of `days`, the wagon with it: worn by the day. */
  function journey(days) {
    const wcare = wagonUpkeep();
    if (!wcare) return null;
    const w = activeWagonItem(pack());
    const r = w ? wearWagon(w, journeyWear(days)) : null;
    if (r && r.after.key !== r.before.key) sayWorn(w, r.after, wcare);
    return r;
  }
  /** The watch carried the wagon off (scenes/wagonWarden.js): THROWN_WEAR off it. */
  function thrown() {
    const wcare = wagonUpkeep();
    if (!wcare) return null;
    const w = activeWagonItem(pack());
    const r = w ? wearWagon(w, THROWN_WEAR) : null;
    if (r && r.after.key !== r.before.key) sayWorn(w, r.after, wcare);
    return r;
  }

  /** The oats, the apples and the kits to hand: the pack's, and the wagon's load where it is with its owner. */
  function supplies() {
    const out = { oats: 0, apples: 0, kits: 0 };
    for (const it of [...pack(), ...store()]) {
      const food = steedFoodOf(it)?.key;
      if (food === 'oats') out.oats += it.stackCount ?? 1;
      else if (food === 'apple') out.apples += it.stackCount ?? 1;
      if (isWagonKitItem(it)) out.kits += it.stackCount ?? 1;
    }
    return out;
  }
  /** A wagon's card: its kind's word, its state, its share of whole, whether a kit would mend it, and a Wagon Yard's
   *  price to make it whole - drawn up at the yard, and with its wright going out to it (`mendAway`). WAGON-TIERS: its
   *  tier's id and whether its wear slows it (`wearSlows` - the card's and the panel's words and tones read it). */
  function wagonCard(w, wcare) {
    const s = wagonState(w), share = wagonSoundness(w);
    return {
      name: wagonWord(w), state: s.name, stateKey: s.key, tone: s.tone, condition: wagonCondition(w), max: wagonConditionMax(w), share,
      tier: wcare?.id ?? null, wearSlows: !!wcare?.wearSlows,
      kitWorks: share < WAGON_KIT_CEILING, mend: mendPrice(w), mendAway: mendPrice(w, { away: true }),
    };
  }

  // ── the Stable card ──────────────────────────────────────────────
  /** The card's horses and wagon: each horse's look, stats, bond, hunger and breath; the wagon's soundness.
   *  FIELD BUGS 2026-10-16b HORSE-CARE-OFF ("turning horse care off completely hides my other horses"): every horse owned,
   *  on every tier - Off, and any skin but the enhanced one (horseCareRules' null), each its place, whether it is ridden,
   *  its name and its look, for its card and the choice to ride it; its care (stats, bond, hunger, breath) only where
   *  horse care rules. */
  function model({ near = true, name = '' } = {}) {
    const its = pack(), t = now();
    const care = horseCare();
    // HORSE-TIERS: `tier` the tier's id and `hungerCosts` its word on hunger (the card's words and tones read them)
    const wcare = wagonUpkeep();
    const out = { horseCare: !!care, tier: care?.id ?? null, hungerCosts: !!care?.hungerCosts, wagonUpkeep: !!wcare, near: !!near, horses: /** @type {any[]} */ ([]), wagon: /** @type {any} */ (null), ...supplies() };
    horsesIn(its).forEach((h, i) => {
      const own = { i, ridden: i === 0, name: i === 0 && name ? name : null, look: describeHorseLook(horseLookOf(h)) };
      if (!care) { out.horses.push(own); return; }   // HORSE-CARE-OFF: Off owns its horses all the same - no care to read
      const st = steedStats(h, t, care);
      if (!st) return;
      const f = fedUntil(h);
      out.horses.push({
        ...own,
        stats: STEED_STATS.map((k) => ({ key: k, name: STEED_STAT_TEXT[k], born: st.born[k], now: st.stats[k] })),
        ...bondWay(st.bond), bond: st.bond, tier: st.tier, bonus: st.bonus, penalty: st.penalty, hunger: HUNGER[st.hunger].name, hungerKey: st.hunger,
        fedHours: f != null && f > t ? (f - t) / 60 : 0, full: f != null && f - t >= FULL_AHEAD,
        breath: i === 0 ? breathShare(breathOf(h), st.stats) : 1, winded: i === 0 && !!breathOf(h).winded,
      });
    });
    const w = activeWagonItem(its);
    if (wcare && w) out.wagon = wagonCard(w, wcare);
    return out;
  }

  /**
   * STEED-UI: THE SADDLE PANEL'S READ (ui/enhanced/enhancedSaddle.js) - the horse ridden, or the lead of the team driven (the
   * pack's first horse either way: horseCoats.js activeHorseItem), and the wagon: the horse's breath while it is ridden
   * (`mode` 'Horse' - a team in harness never gallops), winded or not; its bond's word, its points, and the next word
   * and the points it is reached at (null at Kindred). The hunger is the one a hand should feed: astride, the horse
   * ridden; on a bench, the team's horse whose food runs out first (`feed` its index among the pack's horses, `team`
   * the team's size) - a Caravan's fourth horse starving drags the team's Strength as surely as its lead would. Its
   * hours of food, and whether it is full. The wagon's card (wagonCard). The supplies to hand. Each half null with its
   * switch off, or with nothing to read.
   * @param {string} mode
   */
  function saddle(mode) {
    const its = pack(), t = now();
    const out = { horse: /** @type {any} */ (null), wagon: /** @type {any} */ (null), ...supplies() };
    const care = horseCare();
    if (care) {
      const h = ridden(), st = steedStats(h, t, care);
      if (st) {
        const riding = mode === 'Horse', b = breathOf(h);
        const horses = horsesIn(its), w = activeWagonItem(its);
        const team = riding || !w ? [h] : horses.slice(0, Math.max(1, wagonHorsesOf(wagonKindOf(w))));
        const needy = team.reduce((a, x) => ((fedUntil(x) ?? Infinity) < (fedUntil(a) ?? Infinity) ? x : a), h);
        const ns = steedStats(needy, t, care) ?? st, f = fedUntil(needy);
        out.horse = {
          breath: riding ? breathShare(b, st.stats) : null, winded: riding && !!b.winded,
          hunger: HUNGER[ns.hunger].name, hungerKey: ns.hunger, fedHours: f != null && f > t ? (f - t) / 60 : 0,
          full: f != null && f - t >= FULL_AHEAD, feed: Math.max(0, horses.indexOf(needy)), team: team.length,
          tier: st.tier, bond: st.bond, ...bondWay(st.bond),
          hungerCosts: !!care.hungerCosts,   // HORSE-TIERS: NO RED where hunger costs nothing (ui/enhanced/enhancedSaddle.js)
        };
      }
    }
    const wcare = wagonUpkeep();
    const w = wcare ? activeWagonItem(its) : null;
    if (w) out.wagon = wagonCard(w, wcare);
    return out;
  }

  /**
   * The Stable card's acts: 'feed' / 'treat' horse `arg` (its index among the horses) - oats or an apple, the horse
   * here (`near`); 'ride' horse `arg` - made the one ridden; 'kit' - a Wagon Repair Kit spent on the wagon, here (an
   * hour passed: `pass(minutes)`). `{ ok, text }`.
   * `from`/`piece` an inventory's Use: the list the oats or the kit is taken out of (the pack, or the wagon's load) and
   * the very piece.
   * @param {string} verb @param {any} arg @param {{ near?: boolean, stabled?: boolean, wagonNear?: boolean, pass?: (m: number) => void, who?: string, from?: any[]|null, piece?: any }} [o]
   */
  function act(verb, arg, { near = true, stabled = false, wagonNear = true, pass = () => {}, who = 'Your horse', from = null, piece = null } = {}) {
    const its = pack(), t = now();
    if (verb === 'ride') return chooseRiddenHorse(its, Number(arg) | 0);
    if (verb === 'feed' || verb === 'treat') {
      const care = horseCare();
      if (!care) return { ok: false, text: 'Not here.' };
      const horse = horsesIn(its)[Number(arg) | 0];
      if (!horse) return { ok: false, text: STEED_TEXT.noHorse };
      if (stabled) return { ok: false, text: STEED_TEXT.stabled };
      if (!near) return { ok: false, text: STEED_TEXT.notHere };
      const kind = verb === 'feed' ? 'oats' : 'apple';
      const list = from ?? (steedFoodOf(its.find((x) => steedFoodOf(x)?.key === kind)) ? its : store().some((x) => steedFoodOf(x)?.key === kind) ? store() : its);   // the pack's first, then the wagon's load
      return feedHorse(its, horse, kind, t, (Number(arg) | 0) === 0 ? who : 'Your horse', { from: list, food: piece, rules: care });
    }
    if (verb === 'kit') {
      if (!wagonUpkeep()) return { ok: false, text: 'Not here.' };
      const w = activeWagonItem(its);
      if (!w) return { ok: false, text: WAGON_UPKEEP_TEXT.noWagon };
      if (!wagonNear) return { ok: false, text: WAGON_UPKEEP_TEXT.kitNotNear(wagonWord(w)) };
      const list = from ?? (its.some(isWagonKitItem) ? its : store().some(isWagonKitItem) ? store() : its);   // the pack's first, then the wagon's load
      const kit = piece && isWagonKitItem(piece) && list.includes(piece) ? piece : list.find(isWagonKitItem);
      if (!kit) return { ok: false, text: 'You have no Wagon Repair Kit. A Wagon Yard sells them.' };
      const r = kitMendWagon(w);
      if (!r.ok) return r;
      if ((kit.stackCount ?? 1) > 1) kit.stackCount--; else list.splice(list.indexOf(kit), 1);
      pass(60);
      lastState = wagonState(w).key;
      return r;
    }
    return { ok: false, text: 'Not here.' };
  }

  return {
    tick, rideScale, gallopGate, rideWalks, riderPaysGallop, bar, journey, thrown, model, saddle, act,
    /** The yard's price to mend the wagon driven (`away` it is not at the yard), or 0. */
    mendPrice: (away = false) => { const w = activeWagonItem(pack()); return w ? mendPrice(w, { away }) : 0; },
    /** Tests: the ridden horse's breath. */
    breathOf: () => { const h = ridden(); return h ? { ...breathOf(h) } : null; },
    /** A load, a new character: every breath fresh, no span to catch up. */
    reset() { breaths.clear(); lastNow = null; tendedAt = null; wasRiding = false; wasWinded = false; lastWagon = null; lastState = null; },
  };
}

/**
 * The keep a horse is in, off Horse Cart and Cargo's Stable view (systems/horse/horseCart.js stableView - null with the mod
 * off): 'with' its owner - ridden, pulling, following, beside them on foot by the mod's WithPlayer, or the mod off or
 * without persistence (the classic transport: it goes where they go); 'waiting' in the world (left loose, or in the
 * harness of a parked wagon); 'stabled' out of it - WAGON-STABLED: sent away (the view's `horseStabled`), where the
 * Stable card says it is (ui/holdingsPages.js stableWords - mounted from the Transport window, or summoned). Pure.
 * @param {any} view
 */
export function horseWhereOf(view) {
  if (!view || !view.persistence || !view.hasHorse) return 'with';
  if (view.transport === TRANSPORT.Horse || view.transport === TRANSPORT.Cart) return 'with';
  if (view.horseMode === HORSE_MODE.FollowingPlayer) return 'with';
  if (view.wagonMode === WAGON_MODE.FollowingPlayer && view.horseMode === HORSE_MODE.HitchedToWagon) return 'with';
  if (view.horseMode === HORSE_MODE.LooseStationary) return 'waiting';
  if (view.horseMode === HORSE_MODE.HitchedToWagon && view.wagonMode === WAGON_MODE.Deployed) return 'waiting';
  return view.horseStabled ? 'stabled' : 'with';   // WAGON-STABLED: sent away; never sent, the mod's WithPlayer beside its owner
}

/**
 * THE UPKEEP'S REACH, off Horse Cart and Cargo's runtime (`on` its switch): a horse is fed by hand only within the mod's
 * own mount reach (a horse waiting across the map is not) and never at the stable (it is fed there); a kit is spent on
 * the wagon only where its load is reached. With the mod off, or without its physical persistence, both are always
 * with their owner. `who` the horse's name in a sentence.
 */
export function upkeepReach(runtime, on) {
  const v = on ? runtime?.stableView?.() ?? null : null;
  const persistent = !!v?.persistence;
  return {
    near: !persistent || !!runtime?.canMountHorseFromTransportWindow?.(),
    stabled: horseWhereOf(v) === 'stabled',
    wagonNear: !persistent || !!runtime?.canAccessWagonInventory?.()?.allowed,
    who: v?.horseName || 'Your horse',
  };
}

/**
 * STEED1/WAGONS4: AN INVENTORY'S USE on the two items - a Sack of Oats feeds the horse ridden, a Wagon Repair Kit mends
 * the wagon driven (an hour, `pass`), each out of the list it was used from (the pack or the wagon's load). Registered
 * by the host whose upkeep it is (the registry is one a template - the host standing last answers). A use while the
 * switch is off is no use (`usable`), and the item stays.
 * @param {ReturnType<typeof createUpkeep>} upkeep
 * @param {{ reach: () => any, pass: (minutes: number) => void, horseCare: () => any, wagonUpkeep: () => any }} o
 * HORSE-TIERS: `horseCare` the one accessor, as the upkeep is handed it - the tier's rules, null for Off. WAGON-TIERS:
 * `wagonUpkeep` wagon upkeep's, the same way.
 */
export function registerUpkeepUses(upkeep, { reach, pass, horseCare, wagonUpkeep }) {
  registerItemUseHandler(UPKEEP_ITEM.Oats, Object.assign((item, collection) => {
    if (!horseCare()) return null;
    const r = upkeep.act('feed', 0, { ...reach(), from: collection, piece: item, pass });
    return { kind: 'upkeep', text: r.text };
  }, { usable: () => !!horseCare() }));
  registerItemUseHandler(UPKEEP_ITEM.WagonKit, Object.assign((item, collection) => {
    if (!wagonUpkeep()) return null;
    const r = upkeep.act('kit', 0, { ...reach(), from: collection, piece: item, pass });
    return { kind: 'upkeep', text: r.text };
  }, { usable: () => !!wagonUpkeep() }));
}

/** Whether a pack's horses are all born and known to the law (a test's and a host's read). */
export const horsesBorn = (items) => (Array.isArray(items) ? items.filter(isHorseItem).every((h) => Number.isInteger(h.horseSeed) && h.horseSeed > 0) : true);
