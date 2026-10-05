// @ts-check
// WB9g (2026-09-30, Mac: "Add a brand new title to the broker and a new addition (the aura), an animated burning ground
// aura that circles the ground where your character stands. These items should be expensive and sought after"): THE
// BROKER'S INSIGNIA - what Sigil Stones buy that no day's stock carries. Design: bible/11-Multiplayer/World-Bosses.md
// section 14 (WB9g).
//
// ═══ THIS FILE IS THE LAW BOTH ENDS READ ═══════════════════════════
//
// A day's ware (systems/sigilBroker.js) is an item: made on the pack, carried by the save, sold client-side as every
// shop here is. A piece of the INSIGNIA is not an item - it is a thing worn over the name or at the feet, that every
// other player SEES - and a thing others see must be one no client can assert (ACC3's law: a title rides the signed
// token). So a piece is bought ONCE and kept by the ACCOUNT: the account service records the sale (players.insignia,
// server-account/migrations/0040_insignia.sql), signs the title and the aura worn into the token (`t`, `au`), and the
// relay reads them out of it as it reads every badge.
//
// THE PRICE IS PAID TWICE-CHECKED. The embers are the pack's (the Deadlands Embers a breach pays - one a breach closed,
// and one more to each who broke its faithful's rite, WB12d), taken on this side as any ware's are; and the service will
// not record a sale the account's own embers could not have paid for - its gate_kills rows' `stones` (AUDIT WB12d A4: one
// a row before the rite) and (SERPENT-SET) its serpent_kills rows' - a sea serpent's hoard pays the gate's currency too -
// less what its insignia already cost (`insignia_spent`). An ember is made by a breach or a serpent's hoard alone, and the
// service counts both, so an honest pack never holds more than that; a client that skips its own half still cannot buy
// past them.
//
// Pure: the offers, their prices, and the column's words. Not a DFU member. Ledger A (WB).
import { TITLES, AURAS } from './identityToken.js';

/**
 * THE OFFERS, in the Broker's order: `{ id, kind, key, price }` - `kind` 'title' (its `key` one of identityToken.js
 * TITLES) or 'aura' (one of AURAS), `price` in Sigil Stones. Expensive on purpose (Mac: "expensive and sought after"):
 * a gate opens every two hours and drops one stone to a fighter, so the title is some thirty gates closed and the aura
 * fifty - a piece of Ruhn's Regalia in the day's stock is twelve.
 */
export const INSIGNIA = Object.freeze([
  Object.freeze({ id: 'title:gatebreaker', kind: 'title', key: 'gatebreaker', price: 30 }),
  Object.freeze({ id: 'aura:dagonfire', kind: 'aura', key: 'dagonfire', price: 50 }),
]);
/** An offer by its id, or null. */
export const insigniaById = (id) => INSIGNIA.find((r) => r.id === id) ?? null;
/** Every offer's key is in the token's vocabulary (a title a token could not carry would be a sale nobody sees). */
export const insigniaVocabularyOk = () => INSIGNIA.every((r) => (r.kind === 'title' ? TITLES.includes(r.key) : AURAS.includes(r.key)));

/** The most the column may hold - every offer once (a longer column is not one this law wrote). */
export const INSIGNIA_COLUMN_MAX = INSIGNIA.map((r) => r.id).join(' ').length;

/**
 * THE PIECES AN ACCOUNT HOLDS, off the row's `insignia` column: the offers' ids, space-separated, in the order they were
 * bought. A word that is no offer's id, and a repeat, are not held. Pure.
 * @param {unknown} column
 * @returns {string[]}
 */
export function insigniaHeld(column) {
  if (typeof column !== 'string' || !column || column.length > INSIGNIA_COLUMN_MAX) return [];
  const out = [];
  for (const w of column.split(' ')) if (insigniaById(w) && !out.includes(w)) out.push(w);
  return out;
}
/** The column once `id` is bought (held pieces kept, in their order). Pure. */
export const insigniaWith = (column, id) => [...insigniaHeld(column).filter((w) => w !== id), id].join(' ');
/** The keys of one kind an account holds - its titles, or its auras - in the offers' order. Pure. */
export const insigniaKeys = (column, kind) => { const held = insigniaHeld(column); return INSIGNIA.filter((r) => r.kind === kind && held.includes(r.id)).map((r) => r.key); };

/**
 * WHY AN OFFER MAY NOT BE BOUGHT, on this side's own knowing - 'owned' (the account holds it), 'stones' (the pack's
 * spendable stones are short of its price), 'offline' (no account to record it) - or null. The service answers its own
 * refusals as well ('short': the account's closed gates could not have paid; 'guest': a guest row keeps nothing).
 * @param {{ id: string, price: number }} offer @param {{ held: string[], stones: number, online: boolean }} state
 */
export function insigniaRefusal(offer, { held, stones, online }) {
  if (!offer || !insigniaById(offer.id)) return 'gone';
  if (Array.isArray(held) && held.includes(offer.id)) return 'owned';
  if (!online) return 'offline';
  if (!(stones >= offer.price)) return 'stones';
  return null;
}
