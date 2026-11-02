// @ts-check
// ARMORY (2026-10-28, the owner: "The dagon breach set should be very expensive from the dagon breach shop dealer";
// bible/04-Characters/Aura-Armory.md section 4) - THE BROKER'S INSIGNIA ROWS AND THEIR WEAR, every kind's: a title, an
// aura, a Dagonfire piece. Read off the account's last word the world host keeps (`_insignia`), out of bootWorld
// (HOST-SPLIT). Pure but for the service's doors it hands back.
import { TITLE_TEXT, AURA_TEXT } from '../ui/playerBadge.js';
import { armoryPieceName } from '../ui/armoryText.js';
import { armoryPieceOf, armoryKitPieces } from '../net/armoryLaw.js';
import { equipTitle, equipAura, equipArmory } from '../net/accountClient.js';

/** A row the Broker's window draws: the offer, its name in the player's words, whether the account owns and wears it - a
 *  piece's slot and line beside. `ins` the account's last word: `{ held, title, aura, armory }`. */
export function insigniaRowOf(/** @type {any} */ o, /** @type {any} */ ins) {
  const piece = o.kind === 'armory' ? armoryPieceOf(o.key) : null;
  const name =
    o.kind === 'title'
      ? (TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (o.key)] ?? o.key)
      : piece
        ? armoryPieceName(o.key)
        : (AURA_TEXT[/** @type {keyof typeof AURA_TEXT} */ (o.key)] ?? o.key);
  const worn =
    o.kind === 'title'
      ? ins.title === o.key
      : piece
        ? armoryKitPieces(ins.armory)[piece.slot] === o.key
        : ins.aura === o.key;
  return { ...o, name, owned: ins.held.includes(o.id), worn, ...(piece ? { slot: piece.slot, line: piece.line } : {}) };
}

/** An offer worn, or taken off (`want` null): the account card's own door for its kind - a piece in its own slot. */
export const insigniaEquip = (/** @type {any} */ io, /** @type {any} */ offer, /** @type {string|null} */ want) =>
  offer.kind === 'title'
    ? equipTitle(io, want)
    : offer.kind === 'armory'
      ? equipArmory(io, armoryPieceOf(offer.key)?.slot, want)
      : equipAura(io, want);
