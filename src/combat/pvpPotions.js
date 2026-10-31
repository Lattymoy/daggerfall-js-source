// PVP-POTIONS (the PvP rework plan: "potion timers 15 s, health / magicka / other", "first effect only"): while a
// refereed fight may hold the player, each kind of potion waits 15 s after the last one of its kind, and a potion lands
// its first effect alone. The kind is the first effect's: Heal Health, Heal Spell Points, or anything else.
// POTION-CLOCK (2026-10-31, bible/11-Multiplayer/Elite-Gates.md section 17.4): a made level whose law times potions (the
// Spire's) runs the same clock and lands each bottle whole, so there a bottle is every kind it carries (AUDIT POTION-MIGHT
// C1: a Purification heals as Heal True does), and its drink is told to the made level's room, never a referee.
import { potionBundle } from '../systems/potions.js';
import { HEAL_SPELL_POINTS_KEY } from '../systems/potionRecipes.js';
import { isHealHealth } from '../systems/effects.js';
import { t } from '../systems/textManager.js';
import { declarePotion } from './pvpDeclare.js';   // PVP-VITALS: the referee hears of it

/** Real milliseconds a potion kind waits after one of its kind is drunk in a fight. */
export const PVP_POTION_MS = 15_000;
/** The kinds a bottle is, in the order the clock says them. */
export const POTION_KINDS = Object.freeze(['health', 'magicka', 'other']);
const WAIT = Object.freeze({
  health: (s) => t('pvp.potion.health', 'You can drink another health potion in {s} s.', { s }),
  magicka: (s) => t('pvp.potion.magicka', 'You can drink another magicka potion in {s} s.', { s }),
  other: (s) => t('pvp.potion.other', 'You can drink another potion of this kind in {s} s.', { s }),
});

let fight = false;
/** POTION-CLOCK: does the place I stand in time potions? A made level's law (systems/eliteGates/spireKit.js registers it). */
let timedHere = () => false;
/** POTION-CLOCK: who hears a bottle drunk where potions are timed - its kinds (the Spire's room, AUDIT POTION-MIGHT C2). */
let toldHere = null;
const last = new Map();
/** POTION-CLOCK: the doors a made level's law registers - whether potions are timed here, and who hears one drunk. */
export function registerPotionClockHere(fn, told = null) { timedHere = typeof fn === 'function' ? fn : () => false; toldHere = typeof told === 'function' ? told : null; }
const clockRuns = () => { if (fight) return true; try { return !!timedHere(); } catch { return false; } };

/** The health mirror's word each frame (net/siege/refereeHealthMirror.js): may a refereed fight hold the player? */
export function setPvpFight(active) { fight = !!active; }
export const playerInPvpFight = () => fight;

/** 'health', 'magicka' or 'other', by the first effect of the bottle's recipe; null for no recipe. Pure. */
export function pvpPotionKind(item) {
  const e = potionBundle(item?.potionRecipeKey ?? 0)?.effects?.[0];
  if (!e) return null;
  return isHealHealth(e) ? 'health' : e.key === HEAL_SPELL_POINTS_KEY ? 'magicka' : 'other';
}

/** One effect's kind. */
const effectKind = (e) => (isHealHealth(e) ? 'health' : e.key === HEAL_SPELL_POINTS_KEY ? 'magicka' : 'other');
/** POTION-CLOCK: the kinds a bottle lands as, in the kinds' order - its first effect's in a fight (the first lands alone),
 *  every effect's where it lands whole. Pure. */
export function potionKindsOf(item, whole = !fight) {
  const effects = potionBundle(item?.potionRecipeKey ?? 0)?.effects ?? [];
  const landed = whole ? effects : effects.slice(0, 1);
  return POTION_KINDS.filter((k) => landed.some((e) => effectKind(e) === k));
}

/** The ms `kind` still waits (0: drinkable). */
const leftOf = (kind, now) => (last.has(kind) ? Math.max(0, PVP_POTION_MS - (now - last.get(kind))) : 0);

/** The refusal of this potion now, or null - in a fight or where potions are timed, while one of its kinds' 15 s runs
 *  (the longest wait said). */
export function pvpPotionRefusal(item, now = Date.now()) {
  if (!clockRuns()) return null;
  let kind = null, left = 0;
  for (const k of potionKindsOf(item)) if (leftOf(k, now) > left) { kind = k; left = leftOf(k, now); }
  return kind ? WAIT[kind](Math.ceil(left / 1000)) : null;
}

/** A potion drunk: in a fight or where potions are timed, each of its kinds' clocks starts - the referee told in a fight,
 *  the made level's door elsewhere. */
export function pvpPotionDrunk(item, now = Date.now()) {
  if (!clockRuns()) return;
  const kinds = potionKindsOf(item);
  if (!kinds.length) return;
  for (const k of kinds) last.set(k, now);
  if (fight) declarePotion(kinds[0]);
  else { try { toldHere?.(kinds); } catch { /* the room hears nothing; the bottle is drunk */ } }
}

/** POTION-CLOCK: each kind still waiting, `[kind, whole seconds]` in the kinds' order - none where no clock runs.
 *  @returns {[string, number][]} */
export function potionWaits(now = Date.now()) {
  if (!clockRuns()) return [];
  return POTION_KINDS.map((k) => /** @type {[string, number]} */ ([k, Math.ceil(leftOf(k, now) / 1000)])).filter(([, s]) => s > 0);
}

/** The bundle a potion lands: its first effect alone in a fight, else whole. */
export const pvpPotionBundle = (bundle) => (fight && bundle?.effects?.length > 1 ? { ...bundle, effects: bundle.effects.slice(0, 1) } : bundle);

/** Pins only: forget the fight and every clock. */
export function resetPvpPotions() { fight = false; last.clear(); }
