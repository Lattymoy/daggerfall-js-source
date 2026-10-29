// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md sections 4, 5, 7): THE EFFECTS' WORDS - each kill effect's, portal
// skin's and mount look's name and look, and each slot's, in the player's language. One home for every face that says
// them: the profile's slots, the shop, the Collections page and the flow's notes. The English names are effectLaw.js
// EFFECTS' own (a pin holds them equal). Not a DFU member.
import { t } from '../systems/textManager.js';
import { EFFECTS, effectOf } from '../net/effectLaw.js';

/** Each effect's name, by `<slot>:<key>`. */
export const EFFECT_TEXT = Object.freeze({
  'kill:ashen': () => t('effect.kill.ashen', 'Ashen Shatter'),
  'kill:voidrend': () => t('effect.kill.voidrend', 'Voidrend'),
  'kill:pyre': () => t('effect.kill.pyre', 'Daedric Pyre'),
  'kill:tonal': () => t('effect.kill.tonal', 'Tonal Shatter'),
  'portal:runic': () => t('effect.portal.runic', 'Runic Stone'),
  'portal:daedric': () => t('effect.portal.daedric', 'Daedric Stone'),
  'portal:aetheric': () => t('effect.portal.aetheric', 'Aetheric Stone'),
  'portal:brass': () => t('effect.portal.brass', 'Brass Gate'),
  'mount:warhorse': () => t('effect.mount.warhorse', 'Daedric Warhorse'),
  'mount:spectral': () => t('effect.mount.spectral', 'Spectral Steed'),
  'mount:dawnfire': () => t('effect.mount.dawnfire', 'Dawnfire Charger'),
  'mount:automaton': () => t('effect.mount.automaton', 'Brass Automaton'),
});
/** Each effect in a sentence or two: what it looks like. */
export const EFFECT_LOOK = Object.freeze({
  'kill:ashen': () => t('effect.look.ashen', 'A foe you kill crumbles to ash from the feet up. Bone shards fall, and grey dust rolls out over the ground.'),
  'kill:voidrend': () => t('effect.look.voidrend', 'A rift tears open in the foe you kill. Its shards spiral into the void, and the rift snaps shut in a ring of violet light.'),
  'kill:pyre': () => t('effect.look.pyre', 'A Daedric sigil burns into the ground under the foe you kill. A pillar of crimson fire takes it, and embers storm upward.'),
  'kill:tonal': () => t('effect.look.tonal', 'The foe you kill bursts into brass cogs and steam. A blue tonal ring rolls out over the ground.'),
  'portal:runic': () => t('effect.look.runic', 'Your portals turn ice-blue inside a ring of carved runes that glow as it turns.'),
  'portal:daedric': () => t('effect.look.daedric', 'A jagged arch of black iron thrusts up round a crimson vortex. Its runes crawl, embers rise, and it opens in a burst.'),
  'portal:aetheric': () => t('effect.look.aetheric', 'Crystal shards rise off the ground and gather into a turning ring. It opens with a chime of its own.'),
  'portal:brass': () => t('effect.look.brass', 'A ring of brass cogs turns round a blue aetherium core. Steam vents at its foot.'),
  'mount:warhorse': () => t('effect.look.warhorse', 'Your horse wears black and crimson barding of light. Its mane burns, smoke rolls off its hooves, and its eyes glow like coals.'),
  'mount:spectral': () => t('effect.look.spectral', 'Your horse turns to a blue ghost. Its mane and tail flow like light, and its hooves leave glowing prints.'),
  'mount:dawnfire': () => t('effect.look.dawnfire', 'Your horse runs with a mane and tail of golden fire. Sun motes drift round it, and its hoofprints burn.'),
  'mount:automaton': () => t('effect.look.automaton', 'Your horse wears brass plates and turning cogs. Steam vents from its flanks, and its eyes glow aetherium blue.'),
});
/** Each slot's word. */
export const EFFECT_SLOT_TEXT = Object.freeze({
  kill: () => t('effect.slot.kill', 'Kill effect'),
  portal: () => t('effect.slot.portal', 'Portals'),
  mount: () => t('effect.slot.mount', 'Mount'),
});
/** An effect's name in the player's words - its key where it has none. */
export const effectName = (/** @type {string} */ slot, /** @type {string} */ key) => EFFECT_TEXT[/** @type {keyof typeof EFFECT_TEXT} */ (`${slot}:${key}`)]?.() ?? key;
/** An effect's look in the player's words, or ''. */
export const effectLook = (/** @type {string} */ slot, /** @type {string} */ key) => EFFECT_LOOK[/** @type {keyof typeof EFFECT_LOOK} */ (`${slot}:${key}`)]?.() ?? '';
/** A slot's word. */
export const effectSlotName = (/** @type {string} */ slot) => EFFECT_SLOT_TEXT[/** @type {keyof typeof EFFECT_SLOT_TEXT} */ (slot)]?.() ?? slot;
/** A wardrobe answer's held effects, checked on the way in: each slot's keys that are effects of it. Pure. */
export function effectsHeldOf(/** @type {any} */ held) {
  /** @type {Record<string, string[]>} */ const out = {};
  for (const e of EFFECTS) out[e.slot] ??= [];
  for (const slot of Object.keys(out)) out[slot] = (Array.isArray(held?.[slot]) ? held[slot] : []).filter((/** @type {unknown} */ k) => !!effectOf(slot, k));
  return out;
}
