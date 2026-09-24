// @ts-check
// ADV1 (2026-09-24, Mac: "What if the leveling system was something seperate unique to online but compatible"; asked,
// the online health and magicka go "On top" of Daggerfall's): THE ONLINE LAYER - the Adventuring Level's health and
// magicka, added to the character's own while it plays online, and never anywhere else.
//
// WHERE IT SITS. Two plain fields on the entity, `advBonusHp` and `advBonusMp`, read by the two live accessors
// (systems/chargen.js defineLiveMaxHealth and defineLiveMaxMagicka) ON TOP of everything they already sum - the stored
// health, the lycanthrope's limiter, the spell points off live intelligence, the enchantments' and the magery's
// modifier. So every heal, rest, potion, bar and clamp that reads `maxHealth` or `maxMagicka` reads the online value
// with no second door, and nothing that WRITES either one touches the layer:
//   - a level-up adds to `rawMaxHealth` (advancement.js, oblivionLeveling.js) - the stored value, without the layer;
//   - the magic round rewrites `maxMagickaModifier` every game minute (passiveSpecials.js, enchantments.js) - a
//     different term of the sum.
//
// WHY IT IS NEVER SAVED. save.js writes a WHITELIST (ENTITY_FIELDS), and neither field is on it. The save's maximum
// health is `rawMaxHealth` (DISC10-E L4), which the layer never enters; its maximum magicka and its CURRENT health and
// magicka are taken through `offlineVitals` here, so a save written online is the save the character would have
// written offline. Loading is refused online (world.js), so a save only ever meets the layer on its way out.
//
// THE FRACTION IS KEPT. When the layer goes on, rises with a level, or is taken off for a save, current health and
// magicka keep the same share of their maximum: a character at full health comes online at full health, and one at
// half comes online at half. Scaling both ways is its own inverse, so going online, leveling, saving and coming back
// never makes or loses health beyond a rounding unit - and a character with 0 health stays at 0.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A (ADV1).

import { advBonus } from '../net/advLevel.js';

/** The layer's health on an entity: whole, never negative. */
export const advHpOf = (e) => (Number.isFinite(e?.advBonusHp) && e.advBonusHp > 0 ? Math.trunc(e.advBonusHp) : 0);
/** The layer's magicka on an entity: whole, never negative. */
export const advMpOf = (e) => (Number.isFinite(e?.advBonusMp) && e.advBonusMp > 0 ? Math.trunc(e.advBonusMp) : 0);

/** `v` moved from a maximum of `from` to one of `to`, keeping its fraction - whole, never above `to`, and never down to
 *  0 from anything above it (a scale must not kill); 0 and below stay where they are. */
export function keepFraction(v, from, to) {
  if (!(v > 0) || !(from > 0) || !(to >= 0) || from === to) return v;
  return Math.max(1, Math.min(to, Math.round((v * to) / from)));
}

/**
 * Put the layer for `level` on the entity - null (or 1) takes it off - keeping current health and magicka at the same
 * fraction of their maximum. Answers the bonus put on, `{ hp, mp }`.
 * @param {any} entity
 * @param {number|null} level
 */
export function setAdvLayer(entity, level) {
  const b = Number.isSafeInteger(level) && level > 1 ? advBonus(level) : { hp: 0, mp: 0 };
  if (!entity) return b;
  if (advHpOf(entity) === b.hp && advMpOf(entity) === b.mp) return b;
  const hpFrom = entity.maxHealth, mpFrom = entity.maxMagicka;
  entity.advBonusHp = b.hp;
  entity.advBonusMp = b.mp;
  if (Number.isFinite(entity.health)) entity.health = keepFraction(entity.health, hpFrom, entity.maxHealth);
  if (Number.isFinite(entity.magicka)) entity.magicka = keepFraction(entity.magicka, mpFrom, entity.maxMagicka);
  return b;
}

/**
 * The vitals as they would stand WITHOUT the layer - what a save keeps: `{ health, magicka, maxMagicka }` (the save's
 * maximum health is already `rawMaxHealth`, which the layer never enters). With no layer on, the entity's own values.
 * @param {any} entity
 */
export function offlineVitals(entity) {
  const hp = advHpOf(entity), mp = advMpOf(entity);
  const out = { health: entity?.health, magicka: entity?.magicka, maxMagicka: entity?.maxMagicka };
  if (hp) {
    // the offline maximum is the stored one under the limiter, exactly as the accessor reads it with no layer
    const raw = Number.isFinite(entity.rawMaxHealth) ? entity.rawMaxHealth : Math.max(0, entity.maxHealth - hp);
    const lim = entity.maxHealthLimiter;
    const off = lim >= 1 && lim < raw ? lim : raw;
    out.health = keepFraction(entity.health, entity.maxHealth, off);
  }
  if (mp) {
    const off = Math.max(0, (entity.maxMagicka ?? 0) - mp);
    out.magicka = keepFraction(entity.magicka, entity.maxMagicka, off);
    out.maxMagicka = off;
  }
  return out;
}
