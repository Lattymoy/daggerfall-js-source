// @ts-check
// RENOWN1 (2026-09-24, Mac: "What if the leveling system was something seperate unique to online but compatible"; asked,
// the online health and magicka go "On top" of Daggerfall's): THE ONLINE LAYER - Renown's health and
// magicka, added to the character's own while it plays online, and never anywhere else.
//
// WHERE IT SITS. Two plain fields on the entity, `renownHp` and `renownMp`, read by the two live accessors
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
// EG15 (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 19): A SECOND ONLINE TERM, the folds'
// magicka (systems/entityMods.js's `magicka` channel - the Battlemage's Bearing, a Sigil Set's, so awake online alone).
// It rides the same accessor beside Renown's (foldMpOf), and every reader that takes the online layer off takes it too
// (onlineMpOf): a save keeps the vitals as they would stand without either (offlineVitals, and save.js's test for
// whether to ask), and the magery's third is of Daggerfall's own maximum, never of either (passiveSpecials.js). The fold
// re-adds it on the next equip change or magic round, so nothing of it is ever stored.
//
// EG-ZR (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 15): A THIRD ONLINE TERM, THE SPIRE'S
// STONESKIN - `spireHp`, whole points of health a Stoneskin holder carries while it stands in an Elite Breach
// (systems/eliteGates/spireVestiges.js puts it on and takes it off at every exit - setSpireHp, the fraction kept), read by the same
// accessor beside Renown's. No save meets it: the Spire refuses every save (Elite-Gates.md section 24's made level), and the
// term goes at the first frame out of it. The room's shares of a body are of the body without it (spireBodyMax): the points are
// a cushion over it, never a larger body for a blow's share to take more of.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A (RENOWN1).

import { renownBonus } from '../net/renown.js';
import { evenHpOf } from './levelEven.js';   // LEVEL-EVEN: the floor's health, a term of the layer

/** The layer's health on an entity: whole, never negative. */
export const renownHpOf = (e) => (Number.isFinite(e?.renownHp) && e.renownHp > 0 ? Math.trunc(e.renownHp) : 0);
/** EG-ZR: the Spire's Stoneskin on an entity (`spireHp`): whole, never negative. */
export const spireHpOf = (e) => (Number.isFinite(e?.spireHp) && e.spireHp > 0 ? Math.trunc(e.spireHp) : 0);
/** EG-ZR: the body the Spire's shares are of - the maximum health without Stoneskin's points (the census's whole). */
export const spireBodyMax = (e) => Math.max(0, (e?.maxHealth ?? 0) - spireHpOf(e));
/** The layer's magicka on an entity: whole, never negative. */
export const renownMpOf = (e) => (Number.isFinite(e?.renownMp) && e.renownMp > 0 ? Math.trunc(e.renownMp) : 0);
/** EG15: the folds' magicka on an entity (entityMods.js's `magicka` channel, read off the one cached field as statMods.js
 *  reads `_mods` - this leaf imports no fold): whole, never negative. */
export const foldMpOf = (e) => { const v = e?._mods?.magicka; return Number.isFinite(v) && v > 0 ? Math.trunc(v) : 0; };
/** EG15: every online term on the maximum magicka - Renown's and the folds' - what a save and the magery take off. */
export const onlineMpOf = (e) => renownMpOf(e) + foldMpOf(e);

/** `v` moved from a maximum of `from` to one of `to`, keeping its fraction - whole, never above `to`, and never down to
 *  0 from anything above it (a scale must not kill) unless the maximum itself is 0; 0 and below stay where they are.
 *  AUDIT RENOWN1 GAME-5: `max(1, min(to, ...))` answered 1 for a maximum of 0 (a mage unable to hold magicka) - a
 *  value above its own maximum; the bound is now the last word. */
export function keepFraction(v, from, to) {
  if (!(v > 0) || !(from > 0) || !(to >= 0) || from === to) return v;
  return Math.min(to, Math.max(1, Math.round((v * to) / from)));
}

/**
 * Put the layer for `level` on the entity - null (or 1) takes it off - keeping current health and magicka at the same
 * fraction of their maximum. Answers the bonus put on, `{ hp, mp }`.
 * @param {any} entity
 * @param {number|null} level
 */
export function setRenownLayer(entity, level) {
  const r = Number.isSafeInteger(level) && level > 1 ? renownBonus(level) : { hp: 0, mp: 0 };
  if (!entity) return r;
  // FIRM1: the Firmament's health and magicka ride the same layer (setOnlineLayerExtra) - on while online, off with it
  const online = Number.isSafeInteger(level) && level >= 1;
  _levels.set(entity, online ? level : null);
  const x = online ? _extras.get(entity) : null;
  // LEVEL-EVEN (systems/levelEven.js): the floor's health, at the permanent Endurance with the Firmament's in it
  const even = online ? evenHpOf(entity, (entity.stats?.endurance ?? NaN) + (x?.end ?? 0)) : 0;
  const b = x || even ? { hp: r.hp + (x?.hp ?? 0) + even, mp: r.mp + (x?.mp ?? 0) } : r;
  entity.evenHp = even;   // AUDIT LEVEL-EVEN L2-3: the floor's share of the layer, for the readers that size the body (mentorMode.js)
  if (renownHpOf(entity) === b.hp && renownMpOf(entity) === b.mp) return b;
  const hpFrom = entity.maxHealth, mpFrom = entity.maxMagicka;
  entity.renownHp = b.hp;
  entity.renownMp = b.mp;
  if (Number.isFinite(entity.health)) entity.health = keepFraction(entity.health, hpFrom, entity.maxHealth);
  if (Number.isFinite(entity.magicka)) entity.magicka = keepFraction(entity.magicka, mpFrom, entity.maxMagicka);
  return b;
}

/** FIRM1: the layer's other part - the Firmament's health and magicka (systems/firmamentPowers.js), by entity - and
 *  the Renown level each entity's layer was last put on for (null: off). */
const _extras = new WeakMap();
const _levels = new WeakMap();
/**
 * FIRM1 (bible/06-Systems/Firmament.md): THE FIRMAMENT'S HEALTH AND MAGICKA, laid on the online layer beside Renown's -
 * the same two fields, so the same never-saved, fraction-kept law holds for them (offlineVitals takes the whole layer
 * off). `extra` `{ hp, mp }`, whole and never negative; laid on at once where the layer is on, and kept for when it
 * goes on. Answers the layer's bonus as it now stands.
 * @param {any} entity @param {{ hp?: number, mp?: number, end?: number }|null} extra
 */
export function setOnlineLayerExtra(entity, extra) {
  if (!entity) return { hp: 0, mp: 0 };
  const hp = Math.max(0, Math.trunc(Number(extra?.hp) || 0)), mp = Math.max(0, Math.trunc(Number(extra?.mp) || 0));
  const end = Math.trunc(Number(extra?.end) || 0);   // LEVEL-EVEN: the stars' Endurance, which the floor reads
  if (hp || mp || end) _extras.set(entity, { hp, mp, end }); else _extras.delete(entity);
  const level = _levels.get(entity);
  return level == null ? { hp: renownHpOf(entity), mp: renownMpOf(entity) } : setRenownLayer(entity, level);
}

/** LEVEL-EVEN: put the layer on again at the Renown it was last put on for - a level-up moved the stored maximum the
 *  floor is read against. Nothing where the layer is off. AUDIT LEVEL-EVEN L2-1: `keepHealth` - a level-up's refresh
 *  leaves current health as it stands (DFU's level-up never moves CurrentHealth), only bounded by the new maximum; the
 *  layer's fraction-keeping is for the layer going on and off, and here it took a high roll's own health away. */
export function refreshOnlineLayer(entity, { keepHealth = false } = {}) {
  const level = entity ? _levels.get(entity) : null;
  if (level == null) return;
  const health = entity.health;
  setRenownLayer(entity, level);
  if (keepHealth && Number.isFinite(health)) entity.health = Math.min(health, entity.maxHealth);
}

/**
 * EG-ZR: put the Spire's Stoneskin of `hp` whole points on the entity (0 takes it off), keeping current health at the same
 * fraction of its maximum as the layer does. Only an entity whose maximum is the live accessor (systems/chargen.js
 * defineLiveMaxHealth - every player's, chargen's and the load arm's) carries it. Answers the points put on.
 * @param {any} entity @param {number} hp
 */
export function setSpireHp(entity, hp) {
  const pts = Number.isFinite(hp) && hp > 0 ? Math.trunc(hp) : 0;
  if (!entity || !Object.getOwnPropertyDescriptor(entity, 'maxHealth')?.get) return 0;
  if (spireHpOf(entity) === pts) return pts;
  const from = entity.maxHealth;
  entity.spireHp = pts;
  if (Number.isFinite(entity.health)) entity.health = keepFraction(entity.health, from, entity.maxHealth);
  return pts;
}

/**
 * The vitals as they would stand WITHOUT the layer - what a save keeps: `{ health, magicka, maxMagicka }` (the save's
 * maximum health is already `rawMaxHealth`, which the layer never enters). With no layer on, the entity's own values.
 * @param {any} entity
 */
export function offlineVitals(entity) {
  const hp = renownHpOf(entity), mp = onlineMpOf(entity);   // EG15: and the folds' magicka (the Battlemage's Bearing)
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
