// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md sections 4, 5, 7): THE EFFECTS' WORDS - each kill effect's, portal
// skin's and mount look's name and look, and each slot's, in the player's language. One home for every face that says
// them: the profile's slots, the shop, the Collections page and the flow's notes. The English names are effectLaw.js
// EFFECTS' own (a pin holds them equal). Not a DFU member.
import { t } from '../systems/textManager.js';
import { EFFECTS, effectOf } from '../net/effectLaw.js';
import { SHOP_WARES } from '../net/shopLaw.js';   // AUDIT-STOREFRONT II: the shop's passes, bundles, boosters and packs, inked by kind

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
  'mount:warhorse': () => t('effect.look.warhorse', 'Your horse turns black and crimson under scaled barding with burning edges. Its mane burns, and smoke and embers roll off its hooves.'),
  'mount:spectral': () => t('effect.look.spectral', 'Your horse turns to a pale blue ghost that fades at the legs. Light wisps off it, and its hooves leave glowing prints.'),
  'mount:dawnfire': () => t('effect.look.dawnfire', 'Your horse turns radiant gold, its legs burning up from the hooves. Its mane is golden fire, and its hoofprints burn.'),
  'mount:automaton': () => t('effect.look.automaton', 'Your horse wears riveted brass plates set with aetherium studs. Sparks fly off its hooves, and steam breathes from its chest.'),
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

/** AUDIT-STOREFRONT II (lane E 4): EACH EFFECT'S INK - its word's colour and glow, one home for every face that writes
 *  one (the profile's slots, the shop's names, a bundle's pieces, the pass's rewards, the mailbox's tag). A pass, a bundle,
 *  a booster and Aurum their kind's. The rules were the profile card's alone, so the shop's effect words stood white. */
export const EFFECT_INK = Object.freeze({
  'kill:ashen': ['#e4ddd2', 'rgba(255, 140, 60, 0.55)'], 'kill:voidrend': ['#d0adff', 'rgba(150, 80, 255, 0.6)'],
  'kill:pyre': ['#ff8f52', 'rgba(255, 60, 10, 0.6)'], 'kill:tonal': ['#ffd27a', 'rgba(90, 190, 255, 0.6)'],
  'portal:runic': ['#aee6ff', 'rgba(80, 170, 255, 0.6)'], 'portal:daedric': ['#ff6e4e', 'rgba(220, 30, 10, 0.6)'],
  'portal:aetheric': ['#e8ccff', 'rgba(170, 110, 255, 0.6)'], 'portal:brass': ['#f0c060', 'rgba(80, 180, 255, 0.5)'],
  'mount:warhorse': ['#ff5e40', 'rgba(200, 20, 10, 0.6)'], 'mount:spectral': ['#d2efff', 'rgba(120, 190, 255, 0.7)'],
  'mount:dawnfire': ['#ffd56c', 'rgba(255, 150, 30, 0.6)'], 'mount:automaton': ['#ebc47c', 'rgba(90, 200, 255, 0.45)'],
});
export const KIND_INK = Object.freeze({
  pass: ['#ffe2a8', 'rgba(255, 190, 80, 0.5)'], bundle: ['#ffd27a', 'rgba(255, 190, 80, 0.45)'],
  boost: ['#9fdcff', 'rgba(90, 190, 255, 0.55)'], aurum: ['#ffe58a', 'rgba(255, 200, 80, 0.55)'],
});
/** The shop's other wares with an ink, by kind (net/shopLaw.js SHOP_WARES). */
const INKED_KINDS = () => Object.fromEntries(Object.keys(KIND_INK).map((k) => [k, SHOP_WARES.filter((w) => w.kind === k).map((w) => w.key)]));
/** The rules: the profile card's (its word inside the class's element), and the shop's (the word itself, or a reward's
 *  name inside its chip). `kinds` the shop's other wares' keys, by kind. */
export function effectInkCss(/** @type {Record<string, string[]>} */ kinds = INKED_KINDS()) {
  const rule = (/** @type {string} */ c, /** @type {string[]} */ [color, glow]) =>
    `.card .${c} .slotworn, .card .${c} .acteffectword, .${c}.sh-waretag-word, .${c}.sh-bname, .${c} .sh-rewardname { color: ${color}; text-shadow: 0 0 6px ${glow}; }`;
  return [
    ...Object.entries(EFFECT_INK).map(([id, ink]) => rule(`fx-${id.replace(':', '-')}`, ink)),
    ...Object.entries(kinds).flatMap(([kind, keys]) => keys.map((key) => rule(`fx-${kind}-${key}`, KIND_INK[/** @type {keyof typeof KIND_INK} */ (kind)] ?? KIND_INK.pass))),
  ].join('\n');
}
