// @ts-check
// CARDS8 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 26): THE CARDS PART of the Collections page
// (ui/collectionsPage.js) - the Card Binder's collection and its decks. Filled in by CARDS8's binder.

/** Whether the part has anything to show: the character carries a Card Binder. */
export const cardsPartShown = (/** @type {any} */ player = null) => { void player; return false; };
/** The part forgotten (a load, a new character). */
export function resetCardsPart() {}
/** The part into `detail`. @param {any} detail @param {() => void} rerender @param {any} kit */
export function drawCardsPart(detail, rerender, kit) { void rerender; detail.append(kit.el('p', 'px-note', 'No Card Binder carried.')); }
