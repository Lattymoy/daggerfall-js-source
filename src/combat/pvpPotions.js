// PVP-POTIONS (the PvP rework plan: "potion timers 15 s, health / magicka / other", "first effect only"): while a
// refereed fight may hold the player, each kind of potion waits 15 s after the last one of its kind, and a potion lands
// its first effect alone. The kind is the first effect's: Heal Health, Heal Spell Points, or anything else.
import { potionBundle } from '../systems/potions.js';
import { HEAL_SPELL_POINTS_KEY } from '../systems/potionRecipes.js';
import { isHealHealth } from '../systems/effects.js';
import { t } from '../systems/textManager.js';
import { declarePotion } from './pvpDeclare.js';   // PVP-VITALS: the referee hears of it

/** Real milliseconds a potion kind waits after one of its kind is drunk in a fight. */
export const PVP_POTION_MS = 15_000;
const WAIT = Object.freeze({
  health: (s) => t('pvp.potion.health', 'You can drink another health potion in {s} s.', { s }),
  magicka: (s) => t('pvp.potion.magicka', 'You can drink another magicka potion in {s} s.', { s }),
  other: (s) => t('pvp.potion.other', 'You can drink another potion of this kind in {s} s.', { s }),
});

let fight = false;
const last = new Map();

/** The health mirror's word each frame (net/siege/refereeHealthMirror.js): may a refereed fight hold the player? */
export function setPvpFight(active) { fight = !!active; }
export const playerInPvpFight = () => fight;

/** 'health', 'magicka' or 'other', by the first effect of the bottle's recipe; null for no recipe. Pure. */
export function pvpPotionKind(item) {
  const e = potionBundle(item?.potionRecipeKey ?? 0)?.effects?.[0];
  if (!e) return null;
  return isHealHealth(e) ? 'health' : e.key === HEAL_SPELL_POINTS_KEY ? 'magicka' : 'other';
}

/** The refusal of this potion now, or null - in a fight, while its kind's 15 s run. */
export function pvpPotionRefusal(item, now = Date.now()) {
  const kind = fight ? pvpPotionKind(item) : null;
  const left = kind && last.has(kind) ? PVP_POTION_MS - (now - last.get(kind)) : 0;
  return left > 0 ? WAIT[kind](Math.ceil(left / 1000)) : null;
}

/** A potion drunk: in a fight, its kind's clock starts. */
export function pvpPotionDrunk(item, now = Date.now()) {
  const kind = fight ? pvpPotionKind(item) : null;
  if (kind) { last.set(kind, now); declarePotion(kind); }
}

/** The bundle a potion lands: its first effect alone in a fight, else whole. */
export const pvpPotionBundle = (bundle) => (fight && bundle?.effects?.length > 1 ? { ...bundle, effects: bundle.effects.slice(0, 1) } : bundle);

/** Pins only: forget the fight and every clock. */
export function resetPvpPotions() { fight = false; last.clear(); }
