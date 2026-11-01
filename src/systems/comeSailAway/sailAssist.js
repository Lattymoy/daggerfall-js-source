// OWN-AUDIT (2026-11-01; bible/03-World/Come-Sail-Away.md): two of the mod's keys LoadSettings never read, made ours.
// Handling.BadTack: a boat sailed closer to the wind than a beam reach loses way, down to BadTackMultiplier of it
// close-hauled. SailingAssist.AutoStowGaffSails: a gaff sail the wind would lay aback is stowed, and set again when the
// wind frees - the gaff's half of the square sails' assist. The runtime (comeSailAway.js) asks both where it reads its
// handling.

/** Degrees between her bow and where the wind blows to: on a beam reach (90) the bad tack begins, close-hauled (135) it
 *  takes its whole share; between them it grows in a line. 0 is a run, 180 in irons. */
export const BAD_TACK = Object.freeze({ fromDeg: 90, fullDeg: 135 });
/** A gaff sail's pull crosses nought here and turns back (GetSailPower's gaff curve: 100 at 135, 0 at 150). */
export const GAFF_FOUL_DEG = 150;

/** Her way's share under sail with the wind `offRunDeg` off her run - 1 with the switch off, `multiplier` (0..1) at
 *  close-hauled and past it. */
export function badTackShare(offRunDeg, on, multiplier) {
  if (!on) return 1;
  const keep = Math.max(0, Math.min(1, Number(multiplier) || 0));
  const fraction = (Math.abs(Number(offRunDeg) || 0) - BAD_TACK.fromDeg) / (BAD_TACK.fullDeg - BAD_TACK.fromDeg);
  return 1 - (1 - keep) * Math.max(0, Math.min(1, fraction));
}

/** Whether a gaff sail at `deg` (its signed angle to the wind, as updateSails reads it) would be laid aback. */
export const gaffFoul = (deg) => Math.abs(deg) > GAFF_FOUL_DEG;
