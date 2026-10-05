// @ts-check
// HELM-WAY (DECLARED, the Port-Ledger's HELM-WAY row; 2026-09-29, Mac: "Improve the overall mobility and
// maneuverability of ships") - THE RESPONSIVE HELM: one law for how a hull gathers way, loses it and answers her helm,
// read by the player's own boat (systems/comeSailAway.js, over Come Sail Away's own handling - the Features row's Ship
// handling, 'responsive' by default, 'classic' the mod to the letter) and by the sea's captains
// (systems/naval/navalAI.js maxTurnRate - they sail at the player's own pace, so they turn at the player's own helm).
// SAIL-FREE (below) is the player's alone: her way under sail, and her handling scaled with it (SAIL_FREE.gain) - the
// captains sail at HELM-WAY's pace and by their own point of sail (navalAI.js windFactor), as they did.
//
// MEASURED FIRST, on the real runtime (test/csaScene.mjs at 1/60 s frames, waves off, a 1.5 m/s wind on her beam; AUDIT
// NAV2 F20: re-measured like-for-like, each figure at its speed; GALLEON, 2026-10-01: re-measured again on Mac's galleon,
// hull 2 now - her five sails, where Come Sail Away's own two lateens took 25.4 s to 7.6 m/s): under the mod's handling
// the Small Ship took 29.2 s to her full way of 8.75 m/s and 43.7 s (191 m) to lose it with her sails struck; she turned
// only with way on - her rudder is her speed (TurnTarget = |v| x rudder / 10) - so 0.75 deg/s at 1 m/s, 6.56 at her full
// way, nothing at rest, on a 153 m circle at every speed; a Large Galley under sail turned 0.85 deg/s at 3.4 m/s (a 458
// m circle); and a Carrack could neither make way nor turn (no Cargo node: a hold of 0, and UpdateBoatCargoMod's 2 - w /
// 0 clamps every speed to nothing).
//
// THE LAW:
//   - WAY: under sail her way comes on at HELM_WAY.sailAccel of the mod's rate and, sails struck, off at HELM_WAY.coast
//     of it, each times SAIL_FREE.gain - a Small Ship 8.35 s to her full way, 14.6 s (105 m) to lose it. Every Handling
//     dial of the mod still multiplies it. SAIL-FREE (below) gave her more way - 14.38 m/s on her beam where it was 8.75
//     - so her rates are read at its gain (HELM-WAY's took her 8.33 s and 14.6 s): the same handling at her new way.
//   - STEERAGE (`steerage`): the rudder answers by a curve of her way through the water in place of the way itself -
//     STEER_FLOOR at rest (the wind in her canvas swings her), biting hardest at steerPeakV (her way read over
//     SAIL_FREE.gain, so the player's at 7.4), easing toward her full way - so half sail turns tightest, as Black
//     Flag's does. Times the hull's own helm (HULL_HELM, the prefab's rudder x sail-turn modifiers): a Small Ship 2.25
//     deg/s at rest, 10.50 at 7.4 m/s (a 81 m circle), 8.49 at her full way of 14.38 m/s (a 194 m circle), 9.44 at 12
//     m/s (146 m) - the mod's 153 m at every way and none at rest; two seconds from rest with the helm over she swings
//     8.8 deg/s (the mod's 0.45); a Large Galley under sail 2.92 deg/s at 3.4 m/s (a 133 m circle; the mod's 458 m).
//     The helm comes over HELM_WAY.turnAccelSail times the mod's own rate.
//   - A HULL WITH NO CARGO NODE carries the largest hold the mod gave any hull (CARGO_HOLD_MISSING, the Large Galley's).
//   - SAIL-FREE (below): her way under sail is her canvas by the point of sail, at her own pace (SAIL_FREE).

export const HELM_WAY = Object.freeze({ sailAccel: 3.5, coast: 3, turnAccelSail: 2.4, steerFloor: 3, steerPeak: 14, steerPeakV: 4.5 });

/**
 * SAIL-FREE (DECLARED, the Port-Ledger's HELM-WAY row; 2026-10-05, Mac: "Currently its too hard to sail against the wind,
 * ships need more speed"; his calls: "No tacking, Black Flag" and "nothing that breaks immersion") - HER WAY UNDER SAIL,
 * the responsive helm's (the mod's own stays under Classic). Measured first on the real runtime (a 1.5 m/s wind): Come
 * Sail Away's GetSailPower gives a fore-and-aft sail a quarter to half of its pull close-hauled and drives it ASTERN
 * within 30 degrees of the wind's eye, and a square sail nothing forward of the beam - the galleon made 4.7 m/s 45
 * degrees off the eye and went astern at 30, a Carrack 1.8 m/s, a Large Galley nothing at all - while every captain on
 * the Bay sails by navalAI.js windFactor (70% close-hauled, never astern). So under the responsive helm:
 *   - HER CANVAS is each sail she has set at its own best pull (comeSailAway.js canvasPull: the mod's own curve for its
 *     kind, at its crest, scaled for its size) - the mod's law draws her square and her fore-and-aft sails at their best
 *     on different headings, so a mixed rig never had all of its canvas drawing at once;
 *   - THE POINT OF SAIL takes a share of it (`pointOfSail`): best with the wind on her quarter, about half dead into the
 *     wind, never astern, its fall eased so sailing straight for a mark to windward makes the most of it - no tack;
 *   - THE WIND is the captains' bounded share of the rated wind (`seaWind`): a fog no longer lays her becalmed, a storm
 *     drives her at most twice her rated way;
 *   - HER PACE (SAIL_FREE.pace): Come Sail Away's speeds were set for its time dial, which online is gone
 *     (HELM-TIME-ONLINE) - every way under sail a fifth again;
 *   - HER HANDLING at her new way (SAIL_FREE.gain - the galleon's way on her beam, SAIL-FREE's 14.38 m/s over the mod's
 *     8.75): her way comes on and off at HELM-WAY's rates times it, and her rudder reads her way over it (steerage), so
 *     she gathers her way, loses it and swings at her full way as she did - on a wider circle, as a faster hull does.
 * The player's alone: the captains keep their own point of sail (navalAI.js windFactor) and HELM-WAY's pace.
 */
export const SAIL_FREE = Object.freeze({ pace: 1.2, gain: 1.643 });
export const POINT_OF_SAIL = Object.freeze({ run: 0.9, quarter: 45, head: 0.55 });
/**
 * The point of sail's share of her best way: `offRun` degrees between her heading and where the wind blows TO (0 running
 * dead before it, 180 head to wind) - POINT_OF_SAIL.run running, 1 on the quarter, eased down to POINT_OF_SAIL.head in
 * the wind's eye.
 * @param {number} offRun
 */
export function pointOfSail(offRun) {
  const d = Math.min(180, Math.abs(Number(offRun) || 0));
  const { run, quarter, head } = POINT_OF_SAIL;
  if (d <= quarter) return run + ((1 - run) * (1 - Math.cos((Math.PI * d) / quarter))) / 2;
  return head + ((1 - head) * (1 + Math.cos((Math.PI * (d - quarter)) / (180 - quarter)))) / 2;
}
/** The wind a ship's way is rated at - Come Sail Away's Random.Range(1, 2), its middle - and the bounds of the share a
 *  stronger or lighter wind makes of it. ONE HOME for every ship at sea (navalAI.js, the captains, re-exports them). */
export const WIND_RATED = 1.5;
export const WIND_SHARE = Object.freeze([0.3, 2]);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** The share of her rated way a wind of strength `windLen` gives (Come Sail Away's way is linear in it), bounded. */
export const windShare = (windLen) => clamp(windLen / WIND_RATED, WIND_SHARE[0], WIND_SHARE[1]);
/** SAIL-FREE: the wind her canvas feels under the responsive helm (m/s) - the rated wind times its bounded share; none
 *  where there is none (a building's or a dungeon's water: UpdateWind lays no wind indoors). */
export const seaWind = (windLen) => (windLen > 0 ? WIND_RATED * windShare(windLen) : 0);
/** The Features row's two handlings (prefs `naval-handling`): the port's responsive helm, and the mod's own. */
export const HANDLINGS = Object.freeze(['responsive', 'classic']);
export const CARGO_HOLD_MISSING = 3;
/** A hull's own helm - Come Sail Away's rudder modifier times its sail-turn modifier, read off the prefab (Rowboat,
 *  Large Boat, Small Ship, Large Galley, Carrack): the steerage's degrees a second, per metre a second of it. */
export const HULL_HELM = Object.freeze([1, 1, 0.75, 0.25, 0.75]);

/**
 * The steerage of a hull making `v` m/s through the water - the "way" her rudder answers to (the mod's own rudder reads
 * the way itself): steerFloor at rest, steerPeak at steerPeakV, easing past it (x e^(1 - x), x her way over the peak's).
 * @param {number} v
 */
export function steerage(v) {
  const x = Math.max(0, Number(v) || 0) / HELM_WAY.steerPeakV;
  return HELM_WAY.steerFloor + (HELM_WAY.steerPeak - HELM_WAY.steerFloor) * x * Math.exp(1 - x);
}

/** Whether a handling choice is the responsive helm (anything but the mod's own 'classic'). @param {unknown} h */
export const isResponsive = (h) => h !== 'classic';
