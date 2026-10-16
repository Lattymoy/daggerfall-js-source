// @ts-check
// WB12c (2026-10-01, Mac: "shops, libraries and the first breach" for the book): THE FIRST BREACH'S BOOK - the first
// Deadlands Ember into a character's pack brings a copy of On the Burning Doors (systems/portBooks.js), with a Mages
// Guild courier's line. Once a character: the save's own record (systems/modSaveData.js), as the Broker's is. Design:
// bible/11-Multiplayer/World-Bosses.md section 19 C.
//
// Not a DFU member. Ledger A (WB).
import { registerModSaveData } from './modSaveData.js';
import { isSigilStone } from './gate/gateSpoils.js';
import { createBook } from './books.js';
import { BURNING_DOORS_ID } from './portBooks.js';

export const BREACH_BOOK_TEXT = "A Mages Guild courier finds you: 'On the Burning Doors', with the Guild's compliments.";

/** The save's slot for the record (systems/modSaveData.js), under this name. */
export const BREACH_BOOK_SAVE_VENDOR = 'BreachBook';
let _given = false;
/** Whether this character has had the book. */
export const breachBookGiven = () => _given;

/** A spoil into the pack: the first ember brings the book - minted, and the record kept; anything else, or a
 *  character that has had it, nothing. */
export function breachBookFor(item) {
  if (_given || !isSigilStone(item)) return null;
  const book = createBook(BURNING_DOORS_ID);
  if (book) _given = true;
  return book;
}

registerModSaveData(BREACH_BOOK_SAVE_VENDOR, {
  newSaveData: () => ({ given: false }),
  getSaveData: () => ({ given: _given }),
  restoreSaveData: (r) => { _given = r?.given === true; },
});
