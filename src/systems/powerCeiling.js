// @ts-check
// POWER-CEILING (bible/05-Combat/Power-Ceiling.md): THE TWO COMPOSITE CEILINGS. A blow's powers multiply (the sigil, the
// sets, the loot, the sky, mastery, the paths) and a hurt's guards compose, so each registry asks this leaf for its room:
// its own measured top first, then the product of every top (tools/powerCeiling.mjs). AUDIT HORIZONTAL D4: the product
// alone cut whichever registry the import graph asked last (a loot power past 240 took a martial path from 40 to 8), so
// the registry past its own top is the one cut. The runners (entityMods.js, playerEntity.js) and registries import it.

/** THE BLOW POWERS' TOPS: each registry's most onto one blow (per cent), measured from today's records and laws. */
export const BLOW_TOPS = Object.freeze({ sigil: 12, sets: 200, loot: 240, firmament: 50, mastery: 400, martial: 40 }); // WEAPON-GEAR: mastery's top the axe's climb 80 + its gear's 320 (weaponMastery.js), was the climb's +80%
/** THE GUARDS' TOPS: each registry's most off one hurt (per cent), its guards multiplied. */
export const GUARD_TOPS = Object.freeze({ loot: 55, sets: 50, firmament: 15, martial: 30, arcane: 20 });
/** A blow is at most this many times what its powers were handed (x119.95; x43.18 before WEAPON-GEAR). */
export const BLOW_MOST = Object.values(BLOW_TOPS).reduce((k, p) => k * (1 + p / 100), 1);
/** A hurt keeps at least this share of what reached the guards (10.71%). Points (Bulwark, a ward, a Shield's pool), a
 *  hit capped by health (Unyielding) and a blow turned aside whole are no share, and stand outside it. */
export const GUARD_LEAST = Object.values(GUARD_TOPS).reduce((k, p) => k * (1 - p / 100), 1);
/** Rounding's slack: a product taken in another order differs in its last bits, and that is no stacking. */
const SLACK = 1e-6;

/** @typedef {{ k: number, per: Record<string, number> }} Held  the running product, and each registry's own */
/** @type {Held|null} the blow's while its runner holds it open; null outside */
let _blow = null;
/** @type {Held|null} the hurt's share kept, the same way */
let _guard = null;
const held = () => ({ k: 1, per: {} });

/** The blow runner opens its product before the first power and closes it after the last (a nested blow keeps its own). */
export function openBlowCeiling() {
  const was = _blow;
  _blow = held();
  return was;
}
/** @param {Held|null} was */
export function closeBlowCeiling(was) {
  _blow = was;
}
/** The hurt runner's, the same way. */
export function openGuardCeiling() {
  const was = _guard;
  _guard = held();
  return was;
}
/** @param {Held|null} was */
export function closeGuardCeiling(was) {
  _guard = was;
}

/** THE ROOM A BLOW POWER HAS: the share of `pct` (onto the blow it was handed) that keeps `registry` at its own top
 *  (BLOW_TOPS - a name it has no top under has no room) and the product under BLOW_MOST. A price (a negative per cent)
 *  is taken whole and makes room. Outside a runner a power stands alone, held at its registry's top.
 *  @param {number} pct @param {string|null} [registry] */
export function blowRoom(pct, registry = null) {
  if (!Number.isFinite(pct)) return 0;
  const k = _blow?.k ?? 1,
    own = (registry != null ? _blow?.per[registry] : null) ?? 1;
  const top = registry == null ? BLOW_MOST : 1 + (BLOW_TOPS[registry] ?? 0) / 100;
  const room = Math.max(0, (Math.min(BLOW_MOST / k, top / own) - 1) * 100);
  const take = pct <= room + SLACK ? pct : room;
  if (_blow) {
    _blow.k = k * (1 + take / 100);
    if (registry != null) _blow.per[registry] = own * (1 + take / 100);
  }
  return take;
}
/** THE ROOM A GUARD HAS: the share of `less` (per cent off the hurt it was handed) that keeps `registry`'s guards at
 *  their own top (GUARD_TOPS) and the hurt at GUARD_LEAST of what reached the guards. A price (more damage taken) is
 *  taken whole. @param {number} less @param {string|null} [registry] */
export function guardRoom(less, registry = null) {
  if (!Number.isFinite(less)) return 0;
  const k = _guard?.k ?? 1,
    own = (registry != null ? _guard?.per[registry] : null) ?? 1;
  const least = registry == null ? GUARD_LEAST : 1 - (GUARD_TOPS[registry] ?? 0) / 100;
  const room = Math.max(0, (1 - Math.max(GUARD_LEAST / k, least / own)) * 100);
  const take = less <= room + SLACK ? less : room;
  if (_guard) {
    _guard.k = k * (1 - take / 100);
    if (registry != null) _guard.per[registry] = own * (1 - take / 100);
  }
  return take;
}

/** Tests: the running products, or null where no runner holds one open. */
export const ceilingProducts = () => ({ blow: _blow?.k ?? null, guard: _guard?.k ?? null });
