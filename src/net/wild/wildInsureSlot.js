// @ts-check
// WILD-INSURE - THE PAGE'S INSURANCE BOOK, for the pack's card and menu (the Firmament's registry's way): set by the world
// host online (net/wild/wildInsureBook.js createWildInsureBook), null elsewhere - and with none the card offers nothing.
// A leaf of its own (AUDIT PVP-EASE): the pack's window reads the book through it, so loading the window never loads
// the insurance law's graph - which registers the item law with the wire (systems/item/itemLaw.js setItemLaw) for every
// reader of validLootItem in the same page or test, where before the pack's import of the book did.

/** @typedef {{ lineOf: (item: any) => string | null, offers: (item: any) => boolean, premiumOf: (item: any) => number,
 *   insure: (item: any) => Promise<{ ok: boolean, text: string }> }} WildInsureCard */

let _book = /** @type {WildInsureCard | null} */ (null);
export const setWildInsureBook = (/** @type {WildInsureCard | null} */ b) => {
  _book = b;
};
export const wildInsureBook = () => _book;
