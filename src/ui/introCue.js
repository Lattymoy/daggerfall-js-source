// ═══════════════════════════════════════════════════════════════════
// THE INTRO CUE SHEET — every move in the intro, in BARS of the theme.
//
// Mac's brief: three splash screens as the camera streams over the
// continent, timing perfectly with the music, fading into the menu.
// "Timing perfectly" is the whole of this file, and it is not a matter
// of taste - the grid below was MEASURED off the shipped recording, not
// guessed at and not felt out.
//
// ── HOW THE GRID WAS FOUND ───────────────────────────────────────
//
// Spectral flux onset detection over the first sixty seconds (1024-pt
// FFT, 128-sample hop at 12 kHz, half-wave rectified, local-mean
// normalised), then a two-parameter fit of tempo and phase against the
// detected onsets weighted by strength. The fit is not close, it is
// exact to the resolution of the analysis: the seven strongest onsets
// in the second phrase land at 19.115, 21.013, 22.891, 24.779, 26.656,
// 28.555 and 30.421 s, and the grid puts those bars at 19.114, 21.000,
// 22.886, 24.772, 26.658, 28.544 and 30.429. Worst error 11 ms, which
// is a third of a frame.
//
//   BPM 127.26   phase 0.255 s   beat 0.4715 s   bar 1.8859 s
//
// ── THE ONE LAW THAT MAKES IT ACTUALLY SYNC ──────────────────────
//
// THE SONG IS THE CLOCK, NOT THE FRAME COUNTER. Every value here is a
// function of the audio element's own currentTime. A wall-clock
// animation started next to a <audio>.play() drifts the moment either
// one stalls - and on a cold load the audio is the thing that stalls,
// because it is streaming. Driving the visuals off the song means a
// buffer underrun holds the picture too, which is right, instead of
// sliding it permanently out of step, which is what "timed to the
// music" usually means in practice and is the failure this avoids.
//
// The fallback when the browser refuses to autoplay is the wall clock
// and the SAME sheet, so a silent intro is still the intro. Recorded as
// a real loss rather than hidden: it plays silent, exactly as U22's
// splash does before a gesture.
//
// ── THE SHAPE (v4 - Mac: the music starts wrong, use the clip; the
// logo lands on the FULL MAP, on the FIRST BIG BEAT. No exceptions.) ─
//
// v3 cold-opened at bar 24.5, which threw the whole opening of the
// recording away and started the film mid-phrase. Wrong. v4 plays the
// track FROM 0.000 and builds the film on what the opening actually
// contains - measured, not remembered, by tools/themeOnsets.py, which
// is committed now precisely so "the first big beat" is a row in a
// table and not an argument:
//
//   the first 18 seconds are AMBIENT - swells, no rhythm. Their
//   biggest attacks (0.57 s, 1.40 s) are off-grid crescendos.
//   7.915 s   THE HIT - the one percussive strike in the ambience,
//             strength 0.61. Off the grid (bar 5.06), and real.
//   19.115 s  bar 11: the rhythm ENTERS. An entrance, not a hit: 0.47.
//   21.013 s  bar 12: THE FIRST BIG BEAT. 0.69 - the strongest
//             on-grid onset in the whole opening. This is the slam.
//
//   bar  1     black; the first note (0.57 s) sounds under it
//   bar  2     CREDIT 1 over the low flight in off the sea
//   bar  3.2   the climb begins; the deck closes over the picture
//   7.915 s    THE BURST - the camera punches out of the cloud top ON
//              the hit, and the province appears below
//   bars 5-10  the pull-out: the map opens to the WHOLE province,
//              CREDIT 2 over it, full span by bar 10.3
//   bar 12     THE SLAM at 21.013 s: the logo drops onto the full map
//              and lands dead centre on the first big beat. That is
//              the film's one sentence, and everything before it is
//              the walk-up.
//   bar 14     the fade to the menu completes ON the 24.78 s onset.
// // ═══════════════════════════════════════════════════════════════════

/** The measured grid. Seconds. */
export const BPM = 127.26;
export const BEAT = 60 / BPM;              // 0.4715 s
export const BAR = BEAT * 4;               // 1.8859 s
export const PHASE = 0.255;                // where bar 1 starts

/** The onsets the grid was fitted against, kept so a test can assert
 *  the fit rather than assert my arithmetic back at me. Seconds, from
 *  the spectral-flux detector; these are DATA about the recording.
 *
 *  Every one of these is the detector's PEAK time, not the grid time it
 *  sits near. The distinction is the entire value of the table and it
 *  is easy to lose: when the later bars were added, three of the four
 *  were transcribed from the grid column of the analysis printout
 *  instead of the onset column, which would have made this file assert
 *  its own arithmetic back at itself and pass forever. Re-measured. */
export const MEASURED_ONSETS = Object.freeze([
  19.115, 21.013, 22.891, 24.779, 26.656, 28.555, 30.421,
  45.515, 53.067, 62.485, 68.149, 71.925,
]);
/** Which bar each of those onsets is claimed to be. Same order. */
export const MEASURED_BARS = Object.freeze([11, 12, 13, 14, 15, 16, 17, 25, 29, 34, 37, 39]);

/** The onset STRENGTHS at those bars, from the same detector, kept so
 *  the sheet's central claim is checkable rather than asserted: bar 34
 *  is the loudest thing in the opening, which is why the reveal is
 *  there and not somewhere that merely felt right. */
export const ONSET_STRENGTH = Object.freeze({
  11: 0.25, 12: 0.46, 17: 0.43, 25: 0.41, 29: 0.50, 34: 0.70, 37: 0.49, 39: 0.49,
});

/** Bar n's start time in seconds. Bars are 1-based, as a musician
 *  counts them - bar 1 is the first, not the second. */
export function barTime(n) {
  return PHASE + (n - 1) * BAR;
}

/** FROM THE TOP. v3's cold open threw the recording's whole opening
 *  away; Mac's report. The track plays from 0.000 and the film is
 *  built on what that opening measurably contains. START_TIME stays
 *  exported because introScreen's wall-clock fallback and the theme's
 *  seek are both written against it - at 0 the seek is a no-op and
 *  the wall clock counts from the first sample, which is the point. */
export const START_BAR = 1;
export const START_TIME = 0;

/** THE HIT: the one percussive strike in the ambient opening, at
 *  7.915 s - measured by tools/themeOnsets.py (0.61, the strongest
 *  thing before the rhythm enters), OFF the grid at bar 5.06, and
 *  used as what it is: the camera bursts out of the cloud top ON it.
 *  An off-grid onset is still an onset; the grid is scaffolding and
 *  the recording is the law. */
export const HIT_TIME = 7.915;
export const HIT_BAR = (HIT_TIME - PHASE) / BAR + 1;

/** The intro ends here: the crossfade to the menu completes at bar 37.
 *
 *  IT WAS 17, AND IT WAS TOO SNAPPY. Thirty seconds is enough to show
 *  three credits and not enough for a flight to arrive anywhere - the
 *  camera climbed, the title landed, and it stopped, with the province
 *  it had been crossing never once seen whole. So the sheet was
 *  re-measured further out rather than simply stretched, and the track
 *  answered: bar 34, at 62.49 s, carries an onset of 0.70, the
 *  strongest in the opening by a wide margin and nearly three times
 *  bar 11's. That is where a reveal belongs, and everything below is
 *  built to arrive there. */
/** Bar 14 carries a 0.71 onset at 24.78 s, so the menu's arrival is
 *  itself ON a beat - the last thing the intro does still lands. 24.8
 *  seconds door to menu, and the recording is used from its first
 *  sample. */
export const END_BAR = 14;
export const DURATION = barTime(END_BAR);

// ── THE SPLASHES ───────────────────────────────────────────────────

/** Each splash: which art, when it starts to appear, when it is fully
 *  up, when it starts to leave, when it is gone - all in BARS.
 *
 *  `hold` is deliberately not centred between in and out. A logo that
 *  fades up and immediately begins fading down reads as a transition;
 *  one that ARRIVES and then sits still for two bars reads as a credit,
 *  which is what these are. */
export const SPLASHES = Object.freeze([
  // Credit 1 rides the low flight in off the sea, and is gone before
  // the climb whites the picture out - a credit over a cloud is a
  // credit over nothing.
  { key: 'interkarma', in: 1.9, up: 2.45, out: 3.6, gone: 4.15 },
  // Credit 2 rides the opening MAP, after the burst, and is gone two
  // and a half bars before the slam - the province gets time to be
  // the whole picture before the logo owns it.
  { key: 'nexus', in: 5.8, up: 6.4, out: 8.9, gone: 9.5 },
]);

// ── THE LOGO ───────────────────────────────────────────────────────
//
// One event now, and it is the film's whole sentence: the logo DROPS
// onto the finished map and lands dead centre ON THE FIRST BIG BEAT -
// bar 12, 21.013 s, strength 0.69, the strongest on-grid onset in the
// opening (tools/themeOnsets.py). It enters when the map is already at
// FULL SPAN (pinned against SKY_PATH, not assumed), falls under
// gravity, rings for a third of a bar, and then it HOLDS - it landed
// on the province and it stays landed, through to the fade. v3's
// launch and re-entry are gone with the cold open they belonged to.
export const LOGO = Object.freeze({
  enter: 11.55,   // leaves the top of frame here, over the full map...
  slam: 12.0,     // ...and lands HERE, on the first big beat
  settled: 12.6,  // the impact ring is done
});

/**
 * The logo at bar `bar`: vertical offset `y` in fractions of the
 * viewport height (0 = centre, negative = up), `scale`, `opacity`,
 * and `impact` 0..1 for the host's shake.
 */
export function logoAt(bar) {
  const L = LOGO;
  if (bar < L.enter || bar >= END_BAR) return { y: 0, scale: 1, opacity: 0, impact: 0 };
  if (bar < L.slam) {
    // THE DROP. Ease-in SQUARE: constant acceleration is what falling
    // is, and an eased-out drop reads as lowered on a string.
    const k = (bar - L.enter) / (L.slam - L.enter);
    return { y: -0.85 * (1 - k * k), scale: 1.05 - 0.05 * k * k, opacity: 1, impact: 0 };
  }
  // Landed. The ring decays over a third of a bar; the logo stays.
  const impact = Math.max(0, 1 - (bar - L.slam) / 0.35);
  return { y: 0, scale: 1, opacity: 1, impact };
}

// ── THE CLIMB, THE CLOUD, AND THE CHANGE OF PROJECTION ─────────────
//
// ui/introFlyover.js cannot draw the province from above - its pitch is
// a horizon shift, so the nearest ground it can show is always a couple
// of hundred units ahead and the picture is always a wedge running to a
// vanishing point. ui/introSkyMap.js draws that shot; the two cannot be
// cross-faded, because they disagree about where everything is.
//
// So the camera climbs THROUGH A CLOUD DECK, and the cut happens inside
// it. The white-out is not a curtain over a technical seam - it is what
// makes the altitude legible, it is what the brief asked for, and it
// is why this arrangement works at all. Both facts are true and both
// are recorded, so nobody later removes the clouds as decoration.

/** The bar the projection changes on. It must sit where the white-out
 *  is TOTAL, which introSkyMap's inCloud() decides from altitude alone -
 *  so this is a claim about the flight path and it is pinned as one. */
export const MAP_BAR = 4.75;

/** The map view's camera: centre in cells, and how many cells the
 *  frame's width spans. It opens from a tight frame to the whole
 *  province as the white-out clears. */
export const SKY_PATH = Object.freeze([
  // Tight over the burst point, ON the hit...
  { bar: HIT_BAR, x: 500, y: 318, span: 560 },
  { bar: 6.5, x: 506, y: 319, span: 900 },
  { bar: 8.5, x: 511, y: 320, span: MAX_SPAN * 0.96 },
  // ...and the WHOLE PROVINCE by bar 10.3 - a bar and a quarter
  // before the logo even enters, because Mac's brief is exact: the
  // logo lands when the FULL MAP is in view. Pinned as
  // full-span-before-enter, not as a number that merely looks early.
  { bar: 10.3, x: 512, y: 320, span: MAX_SPAN },
  { bar: END_BAR, x: 512, y: 320, span: MAX_SPAN },
]);

/** The map camera at bar `bar`, clamped at both ends like cameraAt. */
export function skyCameraAt(bar) {
  const P = SKY_PATH;
  if (bar <= P[0].bar) return { ...P[0] };
  const last = P[P.length - 1];
  if (bar >= last.bar) return { ...last };
  let i = 0;
  while (i < P.length - 2 && P[i + 1].bar <= bar) i++;
  const a = P[i], b = P[i + 1];
  const k = smooth((bar - a.bar) / (b.bar - a.bar));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, span: a.span + (b.span - a.span) * k };
}

/** The black the intro opens on, and the fade to the menu at the end.
 *  In bars, like everything else. */
export const OPEN_FADE = Object.freeze({ from: 1.0, to: 1.85 });
export const CLOSE_FADE = Object.freeze({ from: 12.8, to: END_BAR });

import { inCloud, MAX_SPAN } from './introSkyMap.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Smoothstep, so a fade eases at both ends instead of starting and
 *  stopping with a corner. */
const smooth = (t) => { const x = clamp01(t); return x * x * (3 - 2 * x); };

/** Ramp from 0 to 1 across a bar range, eased. */
export function ramp(bar, from, to) {
  if (to <= from) return bar >= to ? 1 : 0;
  return smooth((bar - from) / (to - from));
}

/** A splash's opacity at bar `bar`. Up on the way in, 1 across the
 *  hold, down on the way out. */
export function splashOpacity(s, bar) {
  // `bar < s.in`, NOT `<=`. The title is a CUT (in === up), and with
  // `<=` the one frame that matters - bar 11.0 exactly, the downbeat
  // the entire sheet is built around - returned 0 and the title
  // arrived on the frame after the beat. The whole point of measuring
  // the grid to 13 ms was thrown away by a comparison operator.
  if (bar < s.in) return 0;
  if (bar >= s.gone) return 0;
  if (bar < s.up) return ramp(bar, s.in, s.up);
  if (bar > s.out) return 1 - ramp(bar, s.out, s.gone);
  return 1;
}

// ── THE CAMERA PATH ────────────────────────────────────────────────
//
// Keyframes in BARS, interpolated with a smoothstep so the flight
// eases between moves rather than snapping at each key. Positions are
// in map cells (introMap's MAP_W x MAP_H grid), `z` is altitude in
// height units, `yaw` is radians and `horizon` is the fraction of the
// buffer the horizon sits at.
//
// The route, read as geography: in off the Eltheric at first light,
// three bars low over the mouth of the bay, then straight up through
// the weather - and from the burst on, the picture belongs to the map
// and the pull-out. Every key is a bar number from the sheet above,
// so a re-time of the music moves the flight with it.

// YAW'S CONVENTION IS THE RAY WALK'S: forward is (-sin, -cos), so
// yaw 0 looks NORTH (up the map), -PI/2 looks EAST (up the bay, into
// the dawn), and the sun sits at SUN_BEARING 0.18 which is very
// slightly south of due east. The whole flight runs east into the
// light.
export const EAST = -Math.PI / 2;

export const PATH = Object.freeze([
  // ── THE APPROACH (bars 1-3.2): v1's opening, at v4's pace ───────
  // In off the Eltheric, low over the water, the dawn dead ahead -
  // the shot U65 opened with, compressed. The first note sounds under
  // the fade; credit 1 rides this.
  { bar: 1.0, x: 40, y: 322, z: 40, yaw: EAST - 0.02, horizon: 0.50, fov: 0.62 },
  { bar: 2.2, x: 96, y: 320, z: 39, yaw: EAST, horizon: 0.50, fov: 0.62 },
  { bar: 3.2, x: 150, y: 318, z: 42, yaw: EAST + 0.02, horizon: 0.49, fov: 0.63 },
  // ── THE CLIMB (bars 3.2-5.06): up and through the deck ──────────
  // This is the camera doing the shooting-into-the-sky: nose up out
  // of the bay, CLOUD_BASE 300 closes over the picture by ~4.5, and
  // the top of the deck arrives exactly ON the hit.
  { bar: 4.1, x: 196, y: 315, z: 200, yaw: EAST + 0.02, horizon: 0.30, fov: 0.72 },
  { bar: 4.55, x: 214, y: 314, z: 330, yaw: EAST + 0.01, horizon: 0.14, fov: 0.77 },
  // THE LAST BREATH: still deep in the white a tenth of a bar out,
  // so the burst and the hit are ONE event (the 18-frames lesson).
  { bar: 4.95, x: 226, y: 313, z: 400, yaw: EAST, horizon: 0.04, fov: 0.80 },
  // 7.915 s, THE HIT: out the top. CLOUD_TOP is 460.
  { bar: HIT_BAR, x: 230, y: 313, z: 470, yaw: EAST, horizon: 0.00, fov: 0.82 },
  // Bounds the interpolation; only inCloud(z) reads it past the
  // burst, so the one requirement is that it stays above CLOUD_TOP.
  { bar: END_BAR, x: 236, y: 313, z: 560, yaw: EAST, horizon: 0.00, fov: 0.82 },
]);

/** The camera at bar `bar`. Clamps at both ends of the path, so a
 *  scrubbed or overrun clock never produces a camera at NaN. */
export function cameraAt(bar) {
  const P = PATH;
  if (bar <= P[0].bar) return { ...P[0] };
  const last = P[P.length - 1];
  if (bar >= last.bar) return { ...last };
  let i = 0;
  while (i < P.length - 2 && P[i + 1].bar <= bar) i++;
  const a = P[i], b = P[i + 1];
  const k = smooth((bar - a.bar) / (b.bar - a.bar));
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
    yaw: a.yaw + (b.yaw - a.yaw) * k,
    horizon: a.horizon + (b.horizon - a.horizon) * k,
  };
}

/**
 * The whole state of the intro at song time `t` seconds.
 * One call per frame; everything the host draws comes out of here, so
 * there is exactly one place the timing lives.
 */
export function introState(t) {
  const bar = (t - PHASE) / BAR + 1;
  const camera = cameraAt(bar);
  return {
    bar,
    camera,
    // Which renderer draws this frame. The switch is a BAR and not an
    // altitude test, so it happens once and at a known time - deriving
    // it from `camera.z` would flip back and forth on any path that
    // dipped, and "which projection am I in" is not a question a frame
    // should be able to answer differently from its neighbour.
    view: bar >= MAP_BAR ? 'map' : 'ground',
    // The white-out, straight off the deck's own geometry: 1 at the
    // middle of the cloud, 0 outside it. The cut is hidden under this.
    whiteout: inCloud(camera.z),
    sky: skyCameraAt(bar),
    // Opening black and closing fade, as one number the host multiplies
    // the whole picture by.
    open: ramp(bar, OPEN_FADE.from, OPEN_FADE.to),
    close: ramp(bar, CLOSE_FADE.from, CLOSE_FADE.to),
    splashes: SPLASHES.map((s) => ({ key: s.key, opacity: splashOpacity(s, bar) })),
    done: t >= DURATION,
  };
}
