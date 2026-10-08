// @ts-check
// CARDS9 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 28; Mac: "Dont forget about a card needing to come
// from the abyss dungeon also"): THE BOSSES' OWN CARDS - section 6.3, "the Oblivion Gate's boss and the Sea Serpent can
// drop their own, at the aetheric tier", and the Abyss Dungeon's Brass Remnant beside them. Its own small module (the
// card and the item, nothing heavier): the three hoards import it (systems/gateSpoils.js, serpentSpoils.js, sdSpoils.js),
// and systems/cardSources.js - whose pack price reaches the shared clock and, through it, those hoards - would close an
// import cycle round them (found by the hoards' first load).
//
// Not a DFU member: Daggerfall Unity has no card games. Ledger A row (TAVERN CARDS).
import { mintIliacCard } from './iliacItems.js';

/** Each boss's own card: the Gate's Warden, the Sea Serpent, the Abyss Dungeon's Brass Remnant (net/iliacCards.js). */
export const BOSS_CARDS = Object.freeze({ gate: 'valkynaz-ruhn', serpent: 'sethrakul', abyss: 'brass-remnant' });
export const BOSS_CARD_IDS = Object.freeze(Object.values(BOSS_CARDS));
/** MEASURE (CARDS9): a boss's card in a fighter's hoard, per mille - a quarter of the Serpent's and the Remnant's (the
 *  set piece's own share of a dealer), a fifth of the Gate's claims. */
export const BOSS_CARD_PER_MILLE = Object.freeze({ gate: 200, serpent: 250, abyss: 250 });
/**
 * A boss's card for one hoard: ONE draw, always taken (so whatever follows it draws as it would), the card minted when
 * it lands - or null. `kind` a key of BOSS_CARDS; `rolls` the hoard's own seeded source.
 * @param {string} kind @param {() => number} rolls
 */
export function bossCardRoll(kind, rolls) {
  const r = rolls();
  const id = BOSS_CARDS[kind];
  return id && r * 1000 < (BOSS_CARD_PER_MILLE[kind] ?? 0) ? mintIliacCard(id) : null;
}
