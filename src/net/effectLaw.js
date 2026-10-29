// @ts-check
// STOREFRONT (2026-10-29, the owner: "Portal effects would influence both companion and portal stone portals and kill
// effects would be a brand new feature"; bible/06-Systems/Storefront.md): THE EFFECTS' LAW - the account's worn effects
// off the body: a kill effect (where a foe my blow killed falls), a portal skin (my companions' portals and my Portal
// Stone's gate) and a mount look (the horse I ride). One kit a token carries, `fx`: a character a slot in EFFECT_SLOTS'
// order, `0` for none - the Aura Armory's kit law. Read by the token, the wire, the account service, the shop and every
// face that draws one. Imports nothing, so the relay's and the worker's graphs stay flat. Pure. Ledger A (STOREFRONT).

/** The slots, in the kit's order. */
export const EFFECT_SLOTS = Object.freeze(['kill', 'portal', 'mount']);
/** An empty slot in a kit. */
export const EFFECT_EMPTY = '0';

const effect = (/** @type {string} */ slot, /** @type {string} */ key, /** @type {string} */ code, /** @type {string} */ name) => Object.freeze({ slot, key, code, name });
/** EVERY EFFECT, by slot and in the catalogue's order. `code` is its character in a kit, one a slot, never reused or
 *  renumbered: a stored kit names it. `name` is its English, for the service's lines and the receipt (the client's own
 *  words are ui/effectText.js - a pin holds them equal). */
export const EFFECTS = Object.freeze([
  effect('kill', 'ashen', 'a', 'Ashen Shatter'),
  effect('kill', 'voidrend', 'b', 'Voidrend'),
  effect('kill', 'pyre', 'c', 'Daedric Pyre'),
  effect('kill', 'tonal', 'd', 'Tonal Shatter'),
  effect('portal', 'runic', 'a', 'Runic Stone'),
  effect('portal', 'daedric', 'b', 'Daedric Stone'),
  effect('portal', 'aetheric', 'c', 'Aetheric Stone'),
  effect('portal', 'brass', 'd', 'Brass Gate'),
  effect('mount', 'warhorse', 'a', 'Daedric Warhorse'),
  effect('mount', 'spectral', 'b', 'Spectral Steed'),
  effect('mount', 'dawnfire', 'c', 'Dawnfire Charger'),
  effect('mount', 'automaton', 'd', 'Brass Automaton'),
]);
/** The keys of one slot, in the catalogue's order - the token's vocabulary for it. */
export const effectKeys = (/** @type {unknown} */ slot) => EFFECTS.filter((e) => e.slot === slot).map((e) => e.key);
export const KILL_EFFECTS = Object.freeze(effectKeys('kill'));
export const PORTAL_SKINS = Object.freeze(effectKeys('portal'));
export const MOUNT_LOOKS = Object.freeze(effectKeys('mount'));

/** An effect by its slot and key, or null. */
export const effectOf = (/** @type {unknown} */ slot, /** @type {unknown} */ key) =>
  (typeof key === 'string' ? EFFECTS.find((e) => e.slot === slot && e.key === key) ?? null : null);
/** The effect a slot's character names in a kit, or null (empty, or no effect of that slot). */
export const effectAt = (/** @type {string} */ slot, /** @type {unknown} */ code) =>
  (typeof code === 'string' && code !== EFFECT_EMPTY ? EFFECTS.find((e) => e.slot === slot && e.code === code) ?? null : null);

/** THE KIT A TOKEN CARRIES (`fx`): a character a slot in EFFECT_SLOTS' order, `0` for none - never all empty (no kit is
 *  no claim, so a player wearing none mints the bytes they always did). Pure. */
export function effectKitOk(/** @type {unknown} */ kit) {
  if (typeof kit !== 'string' || kit.length !== EFFECT_SLOTS.length) return false;
  let any = false;
  for (let i = 0; i < EFFECT_SLOTS.length; i++) {
    if (kit[i] === EFFECT_EMPTY) continue;
    if (!effectAt(EFFECT_SLOTS[i], kit[i])) return false;
    any = true;
  }
  return any;
}
/** A kit as its keys by slot - `{ kill, portal, mount }`, each a key or null; a kit that is not one reads as all empty. */
export function effectKitKeys(/** @type {unknown} */ kit) {
  const ok = effectKitOk(kit);
  /** @type {Record<string, string|null>} */ const out = {};
  EFFECT_SLOTS.forEach((s, i) => { out[s] = ok ? effectAt(s, /** @type {string} */ (kit)[i])?.key ?? null : null; });
  return out;
}
/** The key a kit wears in one slot, or null. */
export const effectWorn = (/** @type {unknown} */ kit, /** @type {string} */ slot) => effectKitKeys(kit)[slot] ?? null;
/** The kit with one slot changed: `key` an effect of that slot, or null to empty it. Null for a kit left empty; the kit
 *  unchanged (or null) for a key that is no effect of the slot. Pure. */
export function effectKitWith(/** @type {unknown} */ kit, /** @type {string} */ slot, /** @type {unknown} */ key) {
  const i = EFFECT_SLOTS.indexOf(slot);
  const base = effectKitOk(kit) ? /** @type {string} */ (kit) : EFFECT_SLOTS.map(() => EFFECT_EMPTY).join('');
  if (i < 0) return effectKitOk(base) ? base : null;
  const e = key === null ? null : effectOf(slot, key);
  if (key !== null && !e) return effectKitOk(base) ? base : null;
  const next = base.slice(0, i) + (e ? e.code : EFFECT_EMPTY) + base.slice(i + 1);
  return effectKitOk(next) ? next : null;
}
/** The kit less every effect not in `held` (`{ slot: keys[] }`) - what a row may still be signed for. Null when nothing
 *  held is left. Pure. */
export function effectKitHeld(/** @type {unknown} */ kit, /** @type {Record<string, ReadonlyArray<string>>} */ held) {
  let next = effectKitOk(kit) ? /** @type {string|null} */ (kit) : null;
  for (const s of EFFECT_SLOTS) {
    const k = effectWorn(next, s);
    if (k && !(held?.[s] ?? []).includes(k)) next = effectKitWith(next, s, null);
  }
  return next;
}
