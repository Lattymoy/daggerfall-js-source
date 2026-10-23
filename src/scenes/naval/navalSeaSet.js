// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-SET (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected"; bible/03-World/
// Eltheric-Ocean.md SEA-SET) - THE ELTHERIC TIDEMAIL AT SEA, the naval host's two asks of it: the Captain's Due on a ball's
// hurt on a boat of mine, and a legend's piece when she ends. AUDIT SEA VENTURES D12 (HOST-SPLIT): out of createNavalHost,
// where SEA VENTURES had grown them - the naval host calls them, and keeps no state of theirs.
// ═══════════════════════════════════════════════════════════════════
import { captainsDue } from '../../systems/sigil/sigilSetPowers.js';
import { rollElthericPiece, elthericChance, TIDEMAIL_SALT } from '../../systems/aetheric.js';
import { setById } from '../../systems/sigil/sigilSets.js';
import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { t } from '../../systems/textManager.js';

/** THE CAPTAIN'S DUE (systems/sigil/sigilSetPowers.js captainsDue): a ball's hurt on a boat of mine, her hull and canvas
 *  taking the tier's share less while it is awake on me (her men as the ball takes them). In place; answers it. */
export function dueOnHull(/** @type {any} */ hurt, due = captainsDue()) {
  const k = due.hull;
  if (k !== 1) { if (Number.isFinite(hurt.hull)) hurt.hull *= k; if (Number.isFinite(hurt.sail)) hurt.sail *= k; }
  return hurt;
}

/**
 * A LEGEND ENDED carries a piece of the Eltheric Tidemail on her own band's share (systems/aetheric.js ELTHERIC_CHANCE.legend
 * - the Deep Aether's two a quarter of the time, the Abyss's two every time, the Reaches' none), on its own stream off her
 * seed: sunk, it floats up from her wreck; taken, it is among her captain's things - `give`n into the boat I sail, as her
 * chart is (never let go for a full pack), and `say`d. AUDIT SEA VENTURES D1: only for a legend whose purse was `paid` (the
 * world's legendEnded - none for one this captain's ledger has ended and the aether not yet raised): another's copy of her,
 * sunk again, gave her piece every time. Answers the piece, or null.
 * @param {{ name: string, band: string }} legend @param {number} seed @param {unknown} paid
 * @param {{ give: (items: any[]) => void, say: (text: string, s: number) => void }} out
 */
export function legendTidemail(legend, seed, paid, { give, say }) {
  if (!(Number(paid) > 0)) return null;
  const piece = rollElthericPiece(mulberry32(((seed >>> 0) ^ TIDEMAIL_SALT) >>> 0), elthericChance('legend', legend.band));
  if (!piece) return null;
  give([piece]);
  say(t('sea.tidemail.legend', 'From {ship}: {piece}, a piece of {set}!', { ship: legend.name, piece: piece.name, set: setById('eltheric')?.name ?? '' }), 6);
  return piece;
}
