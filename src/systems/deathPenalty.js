// DEATH PENALTY (2026-09-24, Mac: "add deathpenalty 25% of the gold you
// have with you" - "online mode only ofc").
//
// WHY A RESPAWN IS THE WHOLE SHAPE. A death that ends the run
// (endRunToTitleMenu: the video, then the title, or F11 for the last
// save) leaves no continuing purse to take from. A death that RESPAWNS
// you - online (D-ONLINE1), half health, the nearest safe place - was
// free, which is the gap this closes: the fall now costs a tenth of the
// coin you were carrying (a quarter until 2026-10-03, Mac: "Reduce gold
// loss on death").
//
// BAL4 (2026-10-10, bible/05-Combat/Balance-Arc.md section 6; Mac: "Do
// everything", of "a real cost for dying offline"): IT WAS ONLINE ONLY
// UNTIL OFFLINE RESPAWNED TOO. LEGACY2 (2026-10-05) gave Project
// Legacy's Enduring member an offline rise - the same respawn - and it
// cost nothing but Arkay's years (and nothing at all to the ageless).
// An offline rise now takes the same tenth, stated on the death screen
// (ui/deathScreen.js `rises`) as online. A death with no rise (Legacy
// off, Bloodline's fall, the fixed city) still takes nothing.
//
// "WITH YOU" IS THE PURSE. player.goldPieces is the counter (systems/
// inventory.js, E4). Not the bank account (the bank is where a careful
// player keeps it - that is the trade-off the penalty exists to create),
// and not letters of credit (paper, and deductGold's own order treats it
// separately).
//
// ROUNDED DOWN, in the player's favour: 9 gold loses nothing, 100 loses 10.
// There is no switch: a rule the player could turn off would be no rule.
// Offline it stands wherever a death respawns - Project Legacy's own
// switch decides that (off, the run ends, and nothing is taken).
import { goldPiecesOf } from './inventory.js';

/** AUDIT DEATH-TENTH: the share as a divisor - `g / 10` is exact for every whole purse, where `g * 0.1` rounds up past
 *  3 x 2^51 (0.1 is a hair over a tenth in binary) and charged a coin more than a tenth. */
export const DEATH_GOLD_DIVISOR = 10;
export const DEATH_GOLD_FRACTION = 1 / DEATH_GOLD_DIVISOR;

/** What a purse of `gold` loses to a death. Any input that is not a usable count loses nothing. */
export function deathGoldLoss(gold) {
  const g = Number.isFinite(gold) ? Math.max(0, Math.floor(gold)) : 0;
  return Math.floor(g / DEATH_GOLD_DIVISOR);
}

/**
 * AUDIT 28 B5: THE LOSS THE DEATH SCREEN SAID. The screen reads it once, as the player falls; the respawn takes THAT -
 * never a share of a purse that grew while the player lay dead (a party mate's bounty clear pays the dead too) -
 * capped at what the purse holds. A Resurrect spares it: the screen's word is for the respawn, and a rescue is none.
 * One player a page, so one statement a page; null when no screen has spoken since the last respawn.
 */
let _stated = null;
/** The death screen's word - or null to withdraw it (a Resurrect). */
export function stateDeathLoss(lost) { _stated = Number.isSafeInteger(lost) && lost >= 0 ? lost : null; }
/** What the screen said, if it has spoken since the last respawn (a test's seam, and the Resurrect's line). */
export const statedDeathLoss = () => _stated;

/** Takes the penalty off the player's purse - the loss the death screen said, if it spoke, else a tenth of the purse
 *  now - never more than the purse holds. Returns the gold lost (0 when there was none to take). */
export function applyDeathPenalty(player) {
  if (!player) return 0;
  const purse = goldPiecesOf(player);
  const lost = Math.max(0, Math.min(purse, _stated ?? deathGoldLoss(purse)));
  _stated = null;   // spent: the next death speaks for itself
  if (lost > 0) player.goldPieces = purse - lost;
  return lost;
}

/** The line the respawn says after the flavour text; empty when nothing was lost. */
export const deathPenaltyText = (lost) => (lost > 0 ? `Death claimed ${lost} gold from your purse.` : '');

/** The death screen's lines about the loss (Mac's own wording) - one is drawn per death, and every one
 *  carries the amount. Each is a function of the count so a line can say "coin" or "coins" properly. */
export const DEATH_PENALTY_LINES = Object.freeze([
  (n) => `Dropped in the dirt, your ${n} gold feeds the shadows.`,
  (n, raw) => `${n} ${raw === 1 ? 'coin scatters' : 'coins scatter'} into the void, leaving only your corpse behind.`,
  (n) => `The reaper collects his toll in gold, not blood: ${n} gold.`,
  (n) => `Your fortune of ${n} gold vanished into the abyss where you fell.`,
]);

/** One of the lines above for a loss of `lost` gold; empty when nothing was lost. `roll` is Math.random's shape,
 *  so a test can pick a line. The caller draws ONCE per death (a screen redraws every frame). */
export function deathPenaltyLine(lost, roll = Math.random) {
  if (!(lost > 0)) return '';
  const pool = DEATH_PENALTY_LINES;
  return pool[Math.min(pool.length - 1, Math.floor(roll() * pool.length))](lost.toLocaleString('en-US'), lost);
}
