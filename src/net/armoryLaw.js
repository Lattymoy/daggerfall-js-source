// @ts-check
// ARMORY (2026-10-28, the owner: "Aura armory ... customize your character without changing your overall sprite";
// bible/04-Characters/Aura-Armory.md): THE ARMORY'S LAW - the five slots, every piece there is, and the kit a token carries.
// Read by the token (identityToken.js), the wire (wire.js badged), the account service (titles.js), the Sigil Broker
// (insignia.js), the shop (shopLaw.js) and every face that draws or lists a piece. Imports nothing, so the relay's and the
// worker's graphs stay flat. Pure. Not a DFU member - Daggerfall Unity has no accounts. Ledger A (ARMORY).

/** The slots, in the kit's order: a kit is one character a slot, in this order. */
export const ARMORY_SLOTS = Object.freeze(['head', 'torso', 'arms', 'legs', 'weapon']);
/** An empty slot in a kit. */
export const ARMORY_EMPTY = '0';
/** The lines a piece belongs to: where it is had, and the colours it is drawn in. */
export const ARMORY_LINES = Object.freeze(['dagonfire', 'eternal', 'guild', 'crystal']);
/** How a line's pieces are had (the owner: "The dagon breach set should be very expensive from the dagon breach shop
 *  dealer"): the Sigil Broker sells the Dagonfire line for Deadlands Embers (insignia.js); the shop sells the Eternal line;
 *  GUILD-SHOP: the guild shop sells the guild line for silver (guildShopLaw.js), drawn in the wearer's guild's arms.
 *  THANKS-POST: the crystal line is a gift, never sold (net/giftLaw.js). */
export const ARMORY_SOURCE = Object.freeze({ dagonfire: 'broker', eternal: 'shop', guild: 'guild', crystal: 'gift' });

const piece = (/** @type {string} */ key, /** @type {string} */ slot, /** @type {string} */ code, /** @type {string} */ line) =>
  Object.freeze({ key, slot, code, line, source: ARMORY_SOURCE[/** @type {keyof typeof ARMORY_SOURCE} */ (line)] });
/** EVERY PIECE, in the catalogue's order. `code` is the piece's character in a kit, one a slot, never reused or
 *  renumbered: a stored kit names it. What is held is the Broker's insignia (insignia.js) and the shop's wares (shopLaw.js). */
export const ARMORY_PIECES = Object.freeze([
  piece('burningcrown', 'head', 'a', 'dagonfire'),
  piece('emberheart', 'torso', 'a', 'dagonfire'),
  piece('ashbound', 'arms', 'a', 'dagonfire'),
  piece('cinderstride', 'legs', 'a', 'dagonfire'),
  piece('breachbrand', 'weapon', 'a', 'dagonfire'),
  piece('eternalhalo', 'head', 'b', 'eternal'),
  piece('eternalsigil', 'torso', 'b', 'eternal'),
  piece('eternalarmlets', 'arms', 'b', 'eternal'),
  piece('eternalgreaves', 'legs', 'b', 'eternal'),
  piece('eternaledge', 'weapon', 'b', 'eternal'),
  piece('insigniaarmlet', 'arms', 'c', 'guild'),   // GUILD-SHOP: the guild's arms on one upper arm
  piece('crystalspurs', 'arms', 'd', 'crystal'),   // THANKS-POST: small crystal spurs along both arms, the update's gift
]);
/** Every piece's key. */
export const ARMORY_KEYS = Object.freeze(ARMORY_PIECES.map((p) => p.key));
/** The pieces of a line, in the catalogue's order. */
export const armoryLinePieces = (/** @type {unknown} */ line) => ARMORY_PIECES.filter((p) => p.line === line);
/** A SET, sold whole (the owner: "The store set should be $20"): its key, and the line whose every piece it gives. */
export const ARMORY_SETS = Object.freeze({ eternalset: 'eternal' });
/** The pieces a ware of the armory gives, by its key: a piece itself, or a set's every piece; none for anything else. */
export const armoryWarePieces = (/** @type {unknown} */ key) => (armoryPieceOf(key) ? [/** @type {string} */ (key)]
  : typeof key === 'string' && Object.hasOwn(ARMORY_SETS, key) ? armoryLinePieces(ARMORY_SETS[/** @type {keyof typeof ARMORY_SETS} */ (key)]).map((p) => p.key) : []);
/** The kit that wears a line's every piece (`bbbbb` for the Eternal line), or null for no line. Pure. */
export const armoryLineKit = (/** @type {unknown} */ line) => armoryKitOf(armoryLinePieces(line).map((p) => p.key));
/** A piece's name in English - the service's lines and the shop's receipt (the client's own words: ui/armoryText.js). */
export const ARMORY_NAME = Object.freeze({
  burningcrown: 'Crown of the Burning Door', emberheart: 'Ember Heart', ashbound: 'Ashbound Bracers', cinderstride: 'Cinderstride',
  breachbrand: 'Brand of the Breach', eternalhalo: 'Eternal Halo', eternalsigil: 'Eternal Sigil', eternalarmlets: 'Eternal Armlets',
  eternalgreaves: 'Eternal Greaves', eternaledge: 'Eternal Edge', insigniaarmlet: 'Insignia Armlet', crystalspurs: 'Crystal Spurs',
  eternalset: 'The Eternal Set',
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
