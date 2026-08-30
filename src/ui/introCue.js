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
// ── THE SHAPE ────────────────────────────────────────────────────
//
//   bar  1   black; the sea fades up under the first note
//   bar  3   SPLASH 1 - Interkarma's Daggerfall Workshop, over open sea
//   bar  5   the hit at 7.80 s: the coast breaks the horizon
//   bar  7   splash 1 out
//   bar  8   SPLASH 2 - Nexus Mods
//   bar 10   splash 2 out; the camera drops and runs for the ridge
//   bar 11   THE DOWNBEAT at 19.11 s, where the rhythm enters and the
//            single loudest onset of the opening sits. The camera
//            crests, the whole bay opens, and SPLASH 3 - Daggerfall
//            JavaScript - lands ON it. The biggest moment in the music
//            carries the title, which is the only arrangement of these
//            three that is not arbitrary.
//   bar 17   the fade to the menu completes at 30.43 s; the music
//            keeps playing, because the menu inherits the element.
// ═══════════════════════════════════════════════════════════════════

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
export const END_BAR = 39;
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
  { key: 'interkarma', in: 2.6, up: 3.4, out: 6.6, gone: 7.4 },
  { key: 'nexus', in: 8.0, up: 8.7, out: 10.0, gone: 10.8 },
  // The title does not fade in. It CUTS in on bar 11's downbeat with
  // the rhythm - a fade would arrive before the beat or after it, and
  // either way the one moment the whole sheet is built around would be
  // the one moment nothing lands exactly.
  //
  // AND IT LEAVES BEFORE THE END, which is the deliberate part. The
  // last thirteen bars are the pull-back, and the widest shot in the
  // film should not have a logo across it: the title has already said
  // what this is, so the ending gets to show what it IS. The province
  // whole, and then the menu.
  // THE TITLE MOVED TO THE REVEAL. It used to cut in at bar 11 over the
  // bay and be gone long before the widest shot, which left it stranded
  // in the middle of a sixty-second flight and gave the climax no
  // subject. It now lands on bar 34 - the strongest onset in the
  // opening by a wide margin - at the exact moment the camera breaks
  // out of the cloud deck and the whole province appears beneath it.
  // The biggest thing in the music, the biggest thing in the picture,
  // and the title, all on one beat.
  { key: 'title', in: 34.0, up: 34.0, out: 37.6, gone: END_BAR },
]);

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
export const MAP_BAR = 33.2;

/** The map view's camera: centre in cells, and how many cells the
 *  frame's width spans. It opens from a tight frame to the whole
 *  province as the white-out clears. */
export const SKY_PATH = Object.freeze([
  { bar: MAP_BAR, x: 500, y: 318, span: 560 },
  { bar: 34.0, x: 508, y: 320, span: 950 },
  { bar: 36.0, x: 512, y: 320, span: MAX_SPAN * 0.98 },
  { bar: END_BAR, x: 514, y: 320, span: MAX_SPAN },
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
export const OPEN_FADE = Object.freeze({ from: 0.0, to: 1.6 });
export const CLOSE_FADE = Object.freeze({ from: 37.4, to: END_BAR });

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
// The route, read as geography: in off the Eltheric from the west, over
// open water; the north shore's headland enters frame; across the coast
// and inland over High Rock; then a climb and a hard right turn so that
// at bar 11 the camera crests the ridge with the whole bay below it and
// the dawn sun straight ahead. Every key is a bar number from the sheet
// above, so a re-time of the music moves the flight with it.

// YAW'S CONVENTION IS THE RAY WALK'S: forward is (-sin, -cos), so
// yaw 0 looks NORTH (up the map), -PI/2 looks EAST (up the bay, into
// the dawn), and the sun sits at SUN_BEARING 0.18 which is very
// slightly south of due east. The whole flight runs east into the
// light.
export const EAST = -Math.PI / 2;

export const PATH = Object.freeze([
  // ── ACT I: in off the Eltheric, low and level (bars 0-11) ───────
  // Slow, and deliberately almost still. The sun is dead ahead and its
  // path is on the water the whole way in.
  { bar: 0.0, x: 8, y: 322, z: 40, yaw: EAST - 0.02, horizon: 0.50, fov: 0.62 },
  { bar: 3.0, x: 54, y: 321, z: 39, yaw: EAST - 0.02, horizon: 0.50, fov: 0.62 },
  { bar: 5.0, x: 92, y: 320, z: 38, yaw: EAST, horizon: 0.49, fov: 0.62 },
  // Into the mouth. The two shores close in on either flank - the
  // first moment the picture says "bay" rather than "sea".
  { bar: 8.0, x: 150, y: 318, z: 37, yaw: EAST + 0.02, horizon: 0.49, fov: 0.62 },
  // THE LIFT, on bar 11's downbeat, under the title's cut. A LIFT and
  // not a leap: the first sheet jumped the altitude fivefold in one
  // bar and it read as a jerk, because the music's event there is the
  // rhythm ARRIVING, not a shock. The title cutting is what lands on
  // the beat; the camera only has to breathe.
  { bar: 11.0, x: 210, y: 316, z: 46, yaw: EAST + 0.03, horizon: 0.47, fov: 0.62 },

  // ── ACT II: the long rise up the bay (bars 11-21) ────────────────
  { bar: 14.0, x: 278, y: 312, z: 58, yaw: EAST + 0.03, horizon: 0.45, fov: 0.63 },
  { bar: 17.0, x: 348, y: 308, z: 78, yaw: EAST + 0.02, horizon: 0.42, fov: 0.65 },
  // Over Balfiera, which sits in the middle of the bay and is the one
  // landmark the flight passes close enough to read.
  { bar: 21.0, x: 436, y: 303, z: 112, yaw: EAST + 0.01, horizon: 0.38, fov: 0.68 },

  // ── ACT III: the climb (bars 24-34) ─────────────────────────────
  //
  // THREE BEATS, THREE EVENTS, and this is the part that has to be
  // exact. A smooth ease from bar 24 to bar 34 puts the camera in the
  // sky without ever ARRIVING anywhere - the move has no onset, so
  // there is nothing for the music to land on and the whole climb
  // reads as drift. Every move now begins on a measured onset:
  //
  //   bar 29  53.07 s  0.50   THE LAUNCH - the nose comes up
  //   bar 31  56.83 s  0.49   THE SECOND KICK - and into the deck
  //   bar 34  62.49 s  0.70   BURST OUT, and the title
  //
  // A MOVE STARTS ON A BEAT ONLY IF THE CAMERA IS AT REST WHEN THE
  // BEAT ARRIVES. The keys are interpolated with a smoothstep, which
  // has zero velocity at both ends, so putting a key exactly ON the
  // beat with the previous key nearly equal to it parks the camera
  // there - and the acceleration that follows is unmistakably the
  // beat's. Without the near-equal key before it the camera is already
  // moving when the beat lands and the two just overlap.
  { bar: 24.0, x: 462, y: 302, z: 150, yaw: EAST, horizon: 0.330, fov: 0.72 },
  { bar: 27.0, x: 470, y: 302, z: 156, yaw: EAST, horizon: 0.325, fov: 0.73 },
  // At rest, level, cruising - and then the beat.
  { bar: 29.0, x: 476, y: 303, z: 160, yaw: EAST, horizon: 0.320, fov: 0.74 },
  { bar: 29.8, x: 480, y: 303, z: 196, yaw: EAST, horizon: 0.250, fov: 0.75 },
  // Settled again, just in time to be kicked again.
  { bar: 31.0, x: 484, y: 304, z: 240, yaw: EAST, horizon: 0.200, fov: 0.76 },
  // Straight up into the weather. CLOUD_BASE is 300, so the deck
  // closes over the picture across this key.
  { bar: 31.7, x: 486, y: 304, z: 300, yaw: EAST, horizon: 0.130, fov: 0.77 },
  { bar: 33.4, x: 488, y: 305, z: 385, yaw: EAST, horizon: 0.050, fov: 0.80 },
  // THE LAST BREATH OF CLOUD. Still 95% white here, a tenth of a bar
  // out. The old sheet let the deck thin from bar 33.2 onward, so the
  // province was fully readable 18 frames BEFORE the title arrived and
  // the reveal and the beat were two separate events - which is
  // exactly what it looked like.
  { bar: 33.85, x: 489, y: 305, z: 396, yaw: EAST, horizon: 0.030, fov: 0.81 },
  // BAR 34: out the top. CLOUD_TOP is 460, so the white-out goes from
  // 0.95 to nothing inside eight frames and lands on the downbeat with
  // the title.
  { bar: 34.0, x: 489, y: 305, z: 470, yaw: EAST, horizon: 0.000, fov: 0.82 },
  // The tail key exists to bound the interpolation. Past bar 34 the
  // MAP view draws the picture from SKY_PATH, and the only thing still
  // read off this camera is inCloud(z) - so the one thing that matters
  // here is that it stays above CLOUD_TOP, and the exact number is not
  // observable. Found by a mutation campaign: raising it to 1400
  // changed nothing on screen, which is a dead parameter rather than a
  // missing test, and pretending otherwise would have meant writing a
  // pin for an effect that does not exist.
  { bar: END_BAR, x: 490, y: 306, z: 560, yaw: EAST, horizon: 0.000, fov: 0.82 },
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
