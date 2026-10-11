// @ts-check
// STEED1 / WAGONS4 (2026-10-11): THE UPKEEP, A FRAME AT A TIME - horse care (systems/steedCare.js) and wagon upkeep
// (systems/wagonUpkeep.js) run over a host's pack and clock. One a host (scenes/world.js, scenes/exterior.js -
// createUpkeep), its doors the host's:
//
//   items()      the pack (playerEntity.items)               now()      the character's clock (worldTick.js ownMinutes)
//   horseCare()  STEED1's switch (Features: Horse care)      wagonUpkeep()  WAGONS4's (Features: Wagon upkeep)
//   where()      the horse's keep: 'with' | 'waiting' | 'stabled' (steedCare.js STEED_WHERE - the host reads Horse Cart
//                and Cargo's view: horseWhereOf)
//   stores()     the wagon's load where it is with its owner (its storage in reach - upkeepReach's wagonNear), else []:
//                a horse eats from it as from the pack
//   say(text)    a line on the HUD
//
// Each frame the host hands `tick` what its motor did: the transport (`mode`), whether it galloped (the run on a horse,
// moving), how far it rolled (its odometer's metres since the last frame), on a road or not, the wagon's load, and
// whether the wagon went with it (driven, or its team following). The motor asks `rideScale(mode)` for its ride's pace
// and transport.js's gallop gate asks `gallopGate`; the HUD asks `bar()`; the Stable card `model()` and `act()`; the
// Enhanced Plus saddle panel (ui/enhancedSaddle.js) `saddle(mode)` and `act()`.
//
// BARD1 (bible/06-Systems/Horse-Barding.md): what the ridden horse wears costs its pace here (rideScale - bardingPace,
// its Strength's to carry, horse care on or off) and its breath at the gallop (stepBreath's burden), and arms its
// rider while astride (`rider()` the host's player entity - the fold below, its points re-summed when they move).
//
// A horse's breath is kept here, by its seed (no field: a gallop's breath is not a thing to save), and comes back whole
// over any span of the clock skipped (steedCare.js SKIP_MINUTES - a rest, a wait, a journey, a load).

import { activeHorseItem, birthHorses, isHorseItem, describeHorseLook, horseLookOf } from './horseCoats.js';
import { activeWagonItem, wagonHorsesOf, wagonKindOf } from './wagonKinds.js';
import {
  steedStats, stepBreath, freshBreath, breathShare, canGallop, steedSpeedScale, teamDraftScale, tendHorses, feedHorse,
  chooseRiddenHorse, horsesIn, steedFoodOf, STEED_TEXT, SKIP_MINUTES, HUNGER, STEED_STATS, STEED_STAT_TEXT, fedUntil,
  FULL_AHEAD, BOND_TIERS,
} from './steedCare.js';
import {
  wagonState, wagonSoundness, wagonCondition, wagonConditionMax, rollWear, journeyWear, createWearAccount, wearWagon,
  wagonBrokenWhy, wagonPace, mendPrice, kitMendWagon, wagonWord, WAGON_UPKEEP_TEXT, THROWN_WEAR, WAGON_KIT_CEILING,
} from './wagonUpkeep.js';
import { isWagonKitItem, UPKEEP_ITEM } from './upkeepItemRows.js';
import { registerItemUseHandler } from './itemTemplates.js';
import { HORSE_MODE, WAGON_MODE, TRANSPORT } from './horseCartLaw.js';
import { horseBardingOf, bardingPace, bardingBreath, riderArmor } from './horseBarding.js';   // BARD1
import { registerEntityFold, computeEntityMods, NUMBER_BODY_PARTS } from './entityMods.js';

/** BARD1: the rider astride a barded horse, and the points it arms them with (each part - entityMods.js armorParts). */
const astride = new WeakMap();
export const BARDING_FOLD = 'horse-barding';
registerEntityFold(BARDING_FOLD, (e) => { const k = astride.get(e) ?? 0; return k ? { armorParts: new Array(NUMBER_BODY_PARTS).fill(k) } : null; });
/** The rider `entity` astride with `points` (0 afoot, or on a bare horse): their armour re-summed when it moves. */
export function setAstride(entity, points) {
  if (!entity || typeof entity !== 'object') return;
  const k = Number.isFinite(points) && points > 0 ? points | 0 : 0;
  if ((astride.get(entity) ?? 0) === k) return;
  if (k) astride.set(entity, k); else astride.delete(entity);
  computeEntityMods(entity);
}
/** The points the rider is armoured with astride (0 afoot) - the pins' read. */
export const astridePoints = (entity) => astride.get(entity) ?? 0;

/** A breath under this share shows short on the HUD. */
export const BREATH_LOW = 0.25;
/** STEED-UI: a bond's way on - the points its word was reached at (`tierAt`), and the next word and the points it is
 *  reached at (`next`, null at Kindred). Pure. @param {number} bond */
export function bondWay(bond) {
  const next = BOND_TIERS.find((x) => x.min > bond) ?? null;
  return { tierAt: [...BOND_TIERS].reverse().find((x) => bond >= x.min)?.min ?? 0, next: next ? { name: next.name, at: next.min } : null };
}

/**
 * @param {{ items: () => any[], now: () => number, horseCare?: () => boolean, wagonUpkeep?: () => boolean,
 *   where?: () => string, stores?: () => any[], say?: (text: string) => void, rider?: () => any }} deps
 */
export function createUpkeep({ items, now, horseCare = () => false, wagonUpkeep = () => false, where = () => 'with', stores = () => [], say = () => {}, rider = () => null }) {
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

  /** A wagon's state moved down a step: said, once - Rickety, Failing, Broken. */
  function sayWorn(item, after) {
    if (!after || after.key === 'sound' || after.key === 'worn') return;
    const name = wagonWord(item);
    say(after.key === 'broken' ? WAGON_UPKEEP_TEXT.brokeNow(name) : after.key === 'failing' ? WAGON_UPKEEP_TEXT.failing(name) : WAGON_UPKEEP_TEXT.rickety(name));
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
    setAstride(rider(), mode === 'Horse' ? riderArmor(horseBardingOf(activeHorseItem(its))) : 0);   // BARD1: astride, the barding arms the rider
    if (!Number.isFinite(t)) return;
    const skipped = lastNow != null && t - lastNow >= SKIP_MINUTES;
    if (horseCare()) {
      birthHorses(its);
      if (skipped || tendedAt == null || Math.floor(t) !== tendedAt) {   // the keep: the host's `where` read a game minute at most
        const r = tendHorses(its, t, { since: tendedAt ?? lastNow, where: where(), stores: store() });
        if (r.ate) say(STEED_TEXT.ateOnTheRoad(r.ate));
        tendedAt = Math.floor(t);
      }
      if (skipped) breaths.clear();   // a span skipped: every horse its breath back
      const horse = activeHorseItem(its);
      const riding = mode === 'Horse';
      if (horse) {
        const st = steedStats(horse, t);
        if (st) {
          const b = stepBreath(breathOf(horse), { stats: st.stats, hunger: st.hunger, galloping: riding && galloping, ridden: riding && moving, dt, burden: bardingBreath(horseBardingOf(horse)) });   // BARD1: its barding's weight
          breaths.set(horse.horseSeed | 0, b);
          if (b.winded && !wasWinded && riding) say(STEED_TEXT.winded);
          else if (!b.winded && wasWinded && riding) say(STEED_TEXT.rested);
          wasWinded = b.winded;
          if (riding && !wasRiding && st.hunger !== 'fed') say(st.hunger === 'starving' ? STEED_TEXT.starving : 'Your horse is hungry.');
        }
      }
      wasRiding = riding;
    } else { breaths.clear(); wasRiding = false; wasWinded = false; tendedAt = null; }   // AUDIT STEED1: off, no keep ran - none to catch up when it is on again
    if (wagonUpkeep()) {
      const w = activeWagonItem(its);
      if (w !== lastWagon) { lastWagon = w; lastState = w ? wagonState(w).key : null; }
      if (w && wagonGoes && metres > 0 && metres < 1000) {
        const r = wear.add(w, rollWear(metres, { kind: wagonKindOf(w), road, load }));
        if (r && r.after.key !== r.before.key) sayWorn(w, r.after);
      }
      if (w) lastState = wagonState(w).key;
    }
    lastNow = t;
  }

  /** The motor's ride pace, its ride base times this: a horse's Speed; a wagon's state and its team's Strength under
   *  its load. 1 with either switch off. @param {string} mode @param {number} [load] */
  function rideScale(mode, load = 0) {
    const its = pack(), t = now();
    if (mode === 'Horse') {
      const horse = activeHorseItem(its), worn = horseBardingOf(horse);   // BARD1: what it wears, carried on its Strength
      if (!horseCare()) return bardingPace(worn);
      const st = steedStats(horse, t);
      return st ? steedSpeedScale(st.stats.speed) * bardingPace(worn, st.stats.strength) : bardingPace(worn);
    }
    if (mode === 'Cart') {
      let k = 1;
      const w = activeWagonItem(its);
      if (wagonUpkeep() && w) k *= wagonPace(w);   // AUDIT WAGONS4: a broken wagon's is none - it goes nowhere
      if (horseCare() && w) {
        const team = horsesIn(its).slice(0, wagonHorsesOf(wagonKindOf(w)));
        const strengths = team.map((h) => steedStats(h, t)?.stats.strength).filter((v) => Number.isFinite(v));
        if (strengths.length) k *= teamDraftScale(strengths.reduce((a, b) => a + b, 0) / strengths.length, load);
      }
      return k;
    }
    return 1;
  }

  /** transport.js's gallop gate: on a horse, the run only while it has its breath and is not starving (and the mod's
   *  own word - Roleplay & Realism's no-gallop-in-town - first); with horse care, a run on a horse the mod does not
   *  rule on is a gallop. Null: no word (horse care off, or not a horse). @param {string} mode @param {boolean|null} base */
  function gallopGate(mode, base) {
    if (!horseCare() || mode !== 'Horse') return null;
    if (base === false) return false;
    const horse = ridden();
    const st = steedStats(horse, now());
    if (!st) return base;
    return canGallop(breathOf(horse), st.hunger);
  }

  /** Whether the rider pays the gallop's fatigue (DFU's running band): not when horse care has the horse pay it in
   *  breath. @param {string} mode */
  const riderPaysGallop = (mode) => !(horseCare() && mode === 'Horse' && !!ridden());

  /** The HUD's horse bar while riding: `{ amount, low }` or null. @param {string} mode */
  function bar(mode) {
    if (!horseCare() || mode !== 'Horse') return null;
    const horse = ridden();
    const st = steedStats(horse, now());
    if (!st) return null;
    const b = breathOf(horse), amount = breathShare(b, st.stats);
    return { amount, low: b.winded || amount < BREATH_LOW || st.hunger === 'starving' };
  }

  /** WAGONS4: why the wagon goes nowhere (broken), or null - the hosts' teamShort's second word. */
  const brokenWhy = () => (wagonUpkeep() ? wagonBrokenWhy(pack()) : null);

  /** A journey on the travel map of `days`, the wagon with it: worn by the day, never to breaking. */
  function journey(days) {
    if (!wagonUpkeep()) return null;
    const w = activeWagonItem(pack());
    const r = w ? wearWagon(w, journeyWear(days), { floor: 1 }) : null;
    if (r && r.after.key !== r.before.key) sayWorn(w, r.after);
    return r;
  }
  /** The watch carried the wagon off (scenes/wagonWarden.js): THROWN_WEAR off it. */
  function thrown() {
    if (!wagonUpkeep()) return null;
    const w = activeWagonItem(pack());
    const r = w ? wearWagon(w, THROWN_WEAR) : null;
    if (r && r.after.key !== r.before.key) sayWorn(w, r.after);
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
   *  price to make it whole - drawn up at the yard, and with its wright going out to it (`mendAway`). */
  function wagonCard(w) {
    const s = wagonState(w), share = wagonSoundness(w);
    return {
      name: wagonWord(w), state: s.name, stateKey: s.key, tone: s.tone, condition: wagonCondition(w), max: wagonConditionMax(w), share,
      kitWorks: share < WAGON_KIT_CEILING, mend: mendPrice(w), mendAway: mendPrice(w, { away: true }),
    };
  }

  // ── the Stable card ──────────────────────────────────────────────
  /** The card's horses and wagon: each horse's look, stats, bond, hunger and breath; the wagon's soundness. */
  function model({ near = true, name = '' } = {}) {
    const its = pack(), t = now();
    const out = { horseCare: !!horseCare(), wagonUpkeep: !!wagonUpkeep(), near: !!near, horses: /** @type {any[]} */ ([]), wagon: /** @type {any} */ (null), ...supplies() };
    if (out.horseCare) {
      horsesIn(its).forEach((h, i) => {
        const st = steedStats(h, t);
        if (!st) return;
        const f = fedUntil(h);
        out.horses.push({
          i, ridden: i === 0, name: i === 0 && name ? name : null, look: describeHorseLook(horseLookOf(h)),
          stats: STEED_STATS.map((k) => ({ key: k, name: STEED_STAT_TEXT[k], born: st.born[k], now: st.stats[k] })),
          ...bondWay(st.bond), bond: st.bond, tier: st.tier, bonus: st.bonus, penalty: st.penalty, hunger: HUNGER[st.hunger].name, hungerKey: st.hunger,
          fedHours: f != null && f > t ? (f - t) / 60 : 0, full: f != null && f - t >= FULL_AHEAD,
          breath: i === 0 ? breathShare(breathOf(h), st.stats) : 1, winded: i === 0 && !!breathOf(h).winded,
        });
      });
    }
    const w = activeWagonItem(its);
    if (out.wagonUpkeep && w) out.wagon = wagonCard(w);
    return out;
  }

  /**
   * STEED-UI: THE SADDLE PANEL'S READ (ui/enhancedSaddle.js) - the horse ridden, or the lead of the team driven (the
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
    if (horseCare()) {
      const h = ridden(), st = steedStats(h, t);
      if (st) {
        const riding = mode === 'Horse', b = breathOf(h);
        const horses = horsesIn(its), w = activeWagonItem(its);
        const team = riding || !w ? [h] : horses.slice(0, Math.max(1, wagonHorsesOf(wagonKindOf(w))));
        const needy = team.reduce((a, x) => ((fedUntil(x) ?? Infinity) < (fedUntil(a) ?? Infinity) ? x : a), h);
        const ns = steedStats(needy, t) ?? st, f = fedUntil(needy);
        out.horse = {
          breath: riding ? breathShare(b, st.stats) : null, winded: riding && !!b.winded,
          hunger: HUNGER[ns.hunger].name, hungerKey: ns.hunger, fedHours: f != null && f > t ? (f - t) / 60 : 0,
          full: f != null && f - t >= FULL_AHEAD, feed: Math.max(0, horses.indexOf(needy)), team: team.length,
          tier: st.tier, bond: st.bond, ...bondWay(st.bond),
        };
      }
    }
    const w = wagonUpkeep() ? activeWagonItem(its) : null;
    if (w) out.wagon = wagonCard(w);
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
      if (!horseCare()) return { ok: false, text: 'Not here.' };
      const horse = horsesIn(its)[Number(arg) | 0];
      if (!horse) return { ok: false, text: STEED_TEXT.noHorse };
      if (stabled) return { ok: false, text: STEED_TEXT.stabled };
      if (!near) return { ok: false, text: STEED_TEXT.notHere };
      const kind = verb === 'feed' ? 'oats' : 'apple';
      const list = from ?? (steedFoodOf(its.find((x) => steedFoodOf(x)?.key === kind)) ? its : store().some((x) => steedFoodOf(x)?.key === kind) ? store() : its);   // the pack's first, then the wagon's load
      return feedHorse(its, horse, kind, t, (Number(arg) | 0) === 0 ? who : 'Your horse', { from: list, food: piece });
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
    tick, rideScale, gallopGate, riderPaysGallop, bar, brokenWhy, journey, thrown, model, saddle, act,
    /** The yard's price to mend the wagon driven (`away` it is not at the yard), or 0. */
    mendPrice: (away = false) => { const w = activeWagonItem(pack()); return w ? mendPrice(w, { away }) : 0; },
    /** Tests: the ridden horse's breath. */
    breathOf: () => { const h = ridden(); return h ? { ...breathOf(h) } : null; },
    /** A load, a new character: every breath fresh, no span to catch up. */
    reset() { breaths.clear(); lastNow = null; tendedAt = null; wasRiding = false; wasWinded = false; lastWagon = null; lastState = null; },
  };
}

/**
 * The keep a horse is in, off Horse Cart and Cargo's Stable view (systems/horseCart.js stableView - null with the mod
 * off): 'with' its owner - ridden, pulling, following, or the mod off or without persistence (the classic transport:
 * it goes where they go); 'waiting' in the world (left loose, or in the harness of a parked wagon); 'stabled' out of
 * it, where the Stable card says it is (ui/holdingsPages.js stableWords - mounted from the Transport window, or
 * summoned). Pure.
 * @param {any} view
 */
export function horseWhereOf(view) {
  if (!view || !view.persistence || !view.hasHorse) return 'with';
  if (view.transport === TRANSPORT.Horse || view.transport === TRANSPORT.Cart) return 'with';
  if (view.horseMode === HORSE_MODE.FollowingPlayer) return 'with';
  if (view.wagonMode === WAGON_MODE.FollowingPlayer && view.horseMode === HORSE_MODE.HitchedToWagon) return 'with';
  if (view.horseMode === HORSE_MODE.LooseStationary) return 'waiting';
  if (view.horseMode === HORSE_MODE.HitchedToWagon && view.wagonMode === WAGON_MODE.Deployed) return 'waiting';
  return 'stabled';
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
 * @param {{ reach: () => any, pass: (minutes: number) => void, horseCare: () => boolean, wagonUpkeep: () => boolean }} o
 */
export function registerUpkeepUses(upkeep, { reach, pass, horseCare, wagonUpkeep }) {
  registerItemUseHandler(UPKEEP_ITEM.Oats, Object.assign((item, collection) => {
    if (!horseCare()) return null;
    const r = upkeep.act('feed', 0, { ...reach(), from: collection, piece: item, pass });
    return { kind: 'upkeep', text: r.text };
  }, { usable: () => horseCare() }));
  registerItemUseHandler(UPKEEP_ITEM.WagonKit, Object.assign((item, collection) => {
    if (!wagonUpkeep()) return null;
    const r = upkeep.act('kit', 0, { ...reach(), from: collection, piece: item, pass });
    return { kind: 'upkeep', text: r.text };
  }, { usable: () => wagonUpkeep() }));
}

/** Whether a pack's horses are all born and known to the law (a test's and a host's read). */
export const horsesBorn = (items) => (Array.isArray(items) ? items.filter(isHorseItem).every((h) => Number.isInteger(h.horseSeed) && h.horseSeed > 0) : true);
