// @ts-check
// ARMORY (2026-10-28, the owner: "Aura armory ... customize your character without changing your overall sprite";
// bible/04-Characters/Aura-Armory.md): THE ARMORY'S LAW - the five slots, every piece there is, and the kit a token carries.
// Read by the token (identityToken.js), the wire (wire.js badged), the account service (server-account/src/armory.js,
// titles.js), the shop (shopLaw.js) and every face that draws or lists a piece. Imports nothing, so the relay's and the
// worker's graphs stay flat. Pure. Not a DFU member - Daggerfall Unity has no accounts. Ledger A (ARMORY).

/** The slots, in the kit's order: a kit is one character a slot, in this order. */
export const ARMORY_SLOTS = Object.freeze(['head', 'torso', 'arms', 'legs', 'weapon']);
/** An empty slot in a kit. */
export const ARMORY_EMPTY = '0';
/** The lines a piece belongs to: where it is had, and the colours it is drawn in. */
export const ARMORY_LINES = Object.freeze(['dagonfire', 'eternal']);
/** How a line's pieces are had: Dagon's Breach rolls the Dagonfire line; the shop sells the Eternal line. */
export const ARMORY_SOURCE = Object.freeze({ dagonfire: 'breach', eternal: 'shop' });

const piece = (/** @type {string} */ key, /** @type {string} */ slot, /** @type {string} */ code, /** @type {string} */ line, /** @type {number} */ bit) =>
  Object.freeze({ key, slot, code, line, source: ARMORY_SOURCE[/** @type {keyof typeof ARMORY_SOURCE} */ (line)], bit });
/** EVERY PIECE, in the catalogue's order. `code` is the piece's character in a kit, one a slot, never reused; `bit` its
 *  bit on the account's row - a Breach piece's on `players.armory_held`, a shop piece's 0 (the shop's ware carries its
 *  own bit, shopLaw.js). Neither is ever renumbered: a stored one is a piece someone holds. */
export const ARMORY_PIECES = Object.freeze([
  piece('burningcrown', 'head', 'a', 'dagonfire', 1),
  piece('emberheart', 'torso', 'a', 'dagonfire', 2),
  piece('ashbound', 'arms', 'a', 'dagonfire', 4),
  piece('cinderstride', 'legs', 'a', 'dagonfire', 8),
  piece('breachbrand', 'weapon', 'a', 'dagonfire', 16),
  piece('eternalhalo', 'head', 'b', 'eternal', 0),
  piece('eternalsigil', 'torso', 'b', 'eternal', 0),
  piece('eternalarmlets', 'arms', 'b', 'eternal', 0),
  piece('eternalgreaves', 'legs', 'b', 'eternal', 0),
  piece('eternaledge', 'weapon', 'b', 'eternal', 0),
]);
/** Every piece's key. */
export const ARMORY_KEYS = Object.freeze(ARMORY_PIECES.map((p) => p.key));
/** The pieces Dagon's Breach rolls. */
export const ARMORY_BREACH_PIECES = Object.freeze(ARMORY_PIECES.filter((p) => p.source === 'breach'));
/** Every Breach piece's bit, together. */
export const ARMORY_BREACH_BITS = ARMORY_BREACH_PIECES.reduce((a, p) => a | p.bit, 0);
/** A piece's name in English - the service's lines and the shop's receipt (the client's own words: ui/armoryText.js). */
export const ARMORY_NAME = Object.freeze({
  burningcrown: 'Crown of the Burning Door', emberheart: 'Ember Heart', ashbound: 'Ashbound Bracers', cinderstride: 'Cinderstride',
  breachbrand: 'Brand of the Breach', eternalhalo: 'Eternal Halo', eternalsigil: 'Eternal Sigil', eternalarmlets: 'Eternal Armlets',
  eternalgreaves: 'Eternal Greaves', eternaledge: 'Eternal Edge',
});

/** A piece by its key, or null. */
export const armoryPieceOf = (/** @type {unknown} */ key) => (typeof key === 'string' ? ARMORY_PIECES.find((p) => p.key === key) ?? null : null);
/** The piece a slot's character names in a kit, or null (empty, or no piece of that slot). */
export const armoryPieceAt = (/** @type {string} */ slot, /** @type {unknown} */ code) =>
  (typeof code === 'string' && code !== ARMORY_EMPTY ? ARMORY_PIECES.find((p) => p.slot === slot && p.code === code) ?? null : null);

/** THE KIT A TOKEN CARRIES (`ak`): five characters, a slot each in ARMORY_SLOTS' order, `0` for an empty slot - never all
 *  empty (no kit is no claim, so a player wearing none mints the bytes they always did). Pure. */
export function armoryKitOk(/** @type {unknown} */ kit) {
  if (typeof kit !== 'string' || kit.length !== ARMORY_SLOTS.length) return false;
  let any = false;
  for (let i = 0; i < ARMORY_SLOTS.length; i++) {
    if (kit[i] === ARMORY_EMPTY) continue;
    if (!armoryPieceAt(ARMORY_SLOTS[i], kit[i])) return false;
    any = true;
  }
  return any;
}
/** A kit as its pieces' keys by slot - `{ head, torso, arms, legs, weapon }`, each a key or null. A kit that is not one
 *  reads as all empty. Pure. */
export function armoryKitPieces(/** @type {unknown} */ kit) {
  const ok = armoryKitOk(kit);
  /** @type {Record<string, string|null>} */ const out = {};
  ARMORY_SLOTS.forEach((s, i) => { out[s] = ok ? armoryPieceAt(s, /** @type {string} */ (kit)[i])?.key ?? null : null; });
  return out;
}
/** The kit that wears these pieces (`{ slot: key }`, or a list of keys) - a key in the wrong slot or none at all is left
 *  out; null when nothing is worn. Pure. */
export function armoryKitOf(/** @type {unknown} */ worn) {
  const keys = Array.isArray(worn) ? worn : worn && typeof worn === 'object' ? Object.values(worn) : [];
  const chars = ARMORY_SLOTS.map(() => ARMORY_EMPTY);
  for (const k of keys) {
    const p = armoryPieceOf(k);
    if (p) chars[ARMORY_SLOTS.indexOf(p.slot)] = p.code;
  }
  const kit = chars.join('');
  return armoryKitOk(kit) ? kit : null;
}
/** The kit with one slot changed: `key` a piece of that slot, or null to empty it. Null for a kit left empty; the kit
 *  unchanged (or null) for a key that is no piece of the slot. Pure. */
export function armoryKitWith(/** @type {unknown} */ kit, /** @type {string} */ slot, /** @type {unknown} */ key) {
  const i = ARMORY_SLOTS.indexOf(slot);
  const base = armoryKitOk(kit) ? /** @type {string} */ (kit) : ARMORY_SLOTS.map(() => ARMORY_EMPTY).join('');
  if (i < 0) return armoryKitOk(base) ? base : null;
  const p = key === null ? null : armoryPieceOf(key);
  if (key !== null && (!p || p.slot !== slot)) return armoryKitOk(base) ? base : null;
  const next = base.slice(0, i) + (p ? p.code : ARMORY_EMPTY) + base.slice(i + 1);
  return armoryKitOk(next) ? next : null;
}
/** The kit less every piece not in `held` (a list of keys) - what a row may still be signed for. Null when nothing
 *  held is left. Pure. */
export function armoryKitHeld(/** @type {unknown} */ kit, /** @type {ReadonlyArray<string>} */ held) {
  const pieces = armoryKitPieces(kit);
  return armoryKitOf(Object.values(pieces).filter((k) => k && held.includes(k)));
}
/** The Breach pieces a row's `armory_held` bits hold, in the catalogue's order. A bit no piece has is not held. Pure. */
export function armoryBreachHeldOf(/** @type {unknown} */ bits) {
  const b = Number(bits);
  if (!Number.isSafeInteger(b) || b <= 0) return [];
  return ARMORY_BREACH_PIECES.filter((p) => (b & p.bit) !== 0).map((p) => p.key);
}
