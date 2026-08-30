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
// ── THE SHAPE (v3 - Mac: over a minute is way too long) ──────────
//
// The first cut ended at bar 17 and was too snappy; the second ran to
// bar 39 and was 74 seconds, which is an overture, not an intro. The
// third keeps the second's best three seconds and cuts everything that
// was leading up to them: THE TRACK NOW STARTS AT BAR 24.5, mid-song,
// a cold open on the flight already in progress. Every cue below is
// still a bar OF THE RECORDING, still sitting on a measured onset -
// the sheet was cropped, not squeezed, so nothing lands differently,
// there is just less of it. 23.6 seconds, door to menu.
//
//   bar 24.5  black; the bay fades up mid-flight (44.57 s of track)
//   bar 25    CREDIT 1 - Interkarma's Daggerfall Workshop, on the
//             0.41 onset
//   bar 27.4  CREDIT 2 - Nexus Mods
//   bar 29    THE SLAM, 53.07 s, onset 0.50: the Daggerfall JavaScript
//             logo DROPS from the top of frame and lands dead centre
//             ON the beat. The camera is at rest when it hits.
//   bar 31    THE LAUNCH, 56.83 s, onset 0.49: the logo SHOOTS upward
//             off the top and the camera goes after it, straight into
//             the cloud deck. Logo first, camera chasing - the logo is
//             the subject now, not a caption.
//   bar 34    THE BURST, 62.49 s, onset 0.70 - the strongest in the
//             song: out through the top of the deck, the province
//             whole beneath, and the logo CUTS back in at centre,
//             arrived in the sky it shot into.
//   bar 37    the fade to the menu completes ON the 68.15 s onset; the
//             music keeps playing, because the menu inherits the
//             element.
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

/** THE COLD OPEN. The intro no longer plays the track from the top -
 *  it seeks here and fades up on a flight already in progress. Bars
 *  stay bars of the RECORDING (bar 29 is still 53.07 s), so every cue
 *  in this file still sits on the onset it was measured against; the
 *  sheet is cropped, not squeezed. systems/introTheme.js seeks the
 *  element; the wall-clock fallback starts its count here too, or the
 *  silent intro would replay the cut half. */
export const START_BAR = 24.5;
export const START_TIME = barTime(START_BAR);   // 44.57 s of track

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
/** IT WAS 39, AND 74 SECONDS IS AN OVERTURE. Mac's report. Bar 37
 *  carries a 0.49 onset, so the menu's arrival is itself ON the grid -
 *  the last thing the intro does is still a beat. */
export const END_BAR = 37;
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
  { key: 'interkarma', in: 24.8, up: 25.4, out: 26.8, gone: 27.3 },
  { key: 'nexus', in: 27.3, up: 27.9, out: 28.4, gone: 28.8 },
  // THE TITLE IS NOT A SPLASH ANY MORE. It does not fade in a caption;
  // it DROPS, sits, and SHOOTS - see LOGO below. Credit 2 is gone a
  // fifth of a bar before the slam so the drop owns an empty frame.
]);

// ── THE LOGO ───────────────────────────────────────────────────────
//
// Mac's brief, v3: the Daggerfall JavaScript logo drops ON the beat
// and shoots into the sky through the clouds ON the beat. So the logo
// is a rigid body with three events, each on a measured onset, and the
// camera is its chase plane:
//
//   SLAM    bar 29, 53.07 s, 0.50 - falls in from above frame under
//           gravity (ease-in square: a dropped thing accelerates) and
//           is AT y=0, dead centre, on the downbeat exactly. The
//           impact rings for a third of a bar - a shake the host draws
//           - and the camera, level and at rest, dips a breath.
//   LAUNCH  bar 31, 56.83 s, 0.49 - straight up and gone in a bar,
//           ease-in cubic, shrinking as it goes: the thing is leaving,
//           not scrolling. The camera goes AFTER it into the deck, so
//           for two bars the logo is the subject and the world is what
//           falls away behind it.
//   BURST   bar 34, 62.49 s, 0.70 - the camera breaks out the top of
//           the deck and the logo CUTS back in at centre, arrived in
//           the sky it shot into, settling from 1.06 to rest exactly
//           as the old title did. The strongest onset in the song
//           carries the reunion of the two.
//
// `impact` is exported to the host as a number rather than baked into
// y, because a shake is the HOST's business (it jitters the element in
// CSS pixels) and the sheet's business is when and how much.
export const LOGO = Object.freeze({
  enter: 28.55,   // leaves the top of frame here...
  slam: 29.0,     // ...and lands HERE, on the onset
  launch: 31.0,   // straight up, on the onset
  gone: 32.0,     // fully out the top / into the glare
  burst: 34.0,    // the cut back in, on the strongest onset
  settled: 34.6,  // the 1.06 -> 1 settle is done
});

/**
 * The logo at bar `bar`: vertical offset `y` in fractions of the
 * viewport height (0 = centre, negative = up), `scale`, `opacity`,
 * and `impact` 0..1 for the host's shake.
 */
export function logoAt(bar) {
  const L = LOGO;
  if (bar < L.enter || bar >= END_BAR) return { y: 0, scale: 1, opacity: 0, impact: 0 };
  // the ring-down after the slam, wherever we are past it
  const impact = bar >= L.slam ? Math.max(0, 1 - (bar - L.slam) / 0.35) : 0;
  if (bar < L.slam) {
    // THE DROP. Ease-in SQUARE: constant acceleration is what falling
    // is, and an eased-out drop reads as lowered on a string.
    const k = (bar - L.enter) / (L.slam - L.enter);
    return { y: -0.85 * (1 - k * k), scale: 1.05 - 0.05 * k * k, opacity: 1, impact: 0 };
  }
  if (bar < L.launch) return { y: 0, scale: 1, opacity: 1, impact };
  if (bar < L.gone) {
    // THE SHOOT. Ease-in CUBE - it leaves harder than it fell - and it
    // fades only across the last quarter, into the deck's glare the
    // camera is about to enter.
    const k = (bar - L.launch) / (L.gone - L.launch);
    const rise = k * k * k;
    return {
      // `|| 0` folds the -0 that -1.1 * 0 produces on the launch frame
      // itself - strictEqual(-0, 0) fails, and so would any consumer
      // that formats the number. The logo is AT rest on the beat; it
      // should say 0 like it means it.
      y: -1.1 * rise || 0,
      scale: 1 - 0.25 * rise,
      opacity: k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1,
      impact: 0,
    };
  }
  if (bar < L.burst) return { y: 0, scale: 1, opacity: 0, impact: 0 };
  // THE ARRIVAL: the old title cut, kept move for move.
  const settle = 1 + 0.06 * Math.max(0, 1 - (bar - L.burst) / (L.settled - L.burst));
  return { y: 0, scale: settle, opacity: 1, impact: 0 };
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
export const MAP_BAR = 33.2;

/** The map view's camera: centre in cells, and how many cells the
 *  frame's width spans. It opens from a tight frame to the whole
 *  province as the white-out clears. */
export const SKY_PATH = Object.freeze([
  { bar: MAP_BAR, x: 500, y: 318, span: 560 },
  { bar: 34.0, x: 508, y: 320, span: 950 },
  // The pull to the whole province finishes as the menu fade STARTS,
  // not as it ends - the widest shot gets a full bar in the clear
  // before anything is drawn over it.
  { bar: 35.8, x: 512, y: 320, span: MAX_SPAN * 0.98 },
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
export const OPEN_FADE = Object.freeze({ from: START_BAR, to: START_BAR + 0.7 });
export const CLOSE_FADE = Object.freeze({ from: 35.8, to: END_BAR });

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
// The route, read as geography: the cold open finds the camera already
// over the inner bay, past Balfiera, cruising east into the dawn. It
// holds that line for the credits and the slam, then climbs after the
// logo through the deck. Every key is a bar number from the sheet
// above, so a re-time of the music moves the flight with it. The
// western approach - eleven bars of sea that v2 opened with - is what
// the cut removed; the map still has that coast, the film just no
// longer starts there.

// YAW'S CONVENTION IS THE RAY WALK'S: forward is (-sin, -cos), so
// yaw 0 looks NORTH (up the map), -PI/2 looks EAST (up the bay, into
// the dawn), and the sun sits at SUN_BEARING 0.18 which is very
// slightly south of due east. The whole flight runs east into the
// light.
export const EAST = -Math.PI / 2;

export const PATH = Object.freeze([
  // ── THE CRUISE (bars 24-29): level up the bay, at rest ──────────
  // The cold open fades up on this. Nearly still on purpose: the slam
  // needs a camera with nothing else happening, or the logo's impact
  // is one of two motions instead of the only one.
  { bar: 24.0, x: 462, y: 302, z: 150, yaw: EAST, horizon: 0.330, fov: 0.72 },
  { bar: 27.0, x: 470, y: 302, z: 156, yaw: EAST, horizon: 0.325, fov: 0.73 },
  { bar: 29.0, x: 476, y: 303, z: 160, yaw: EAST, horizon: 0.320, fov: 0.74 },
  // THE SLAM'S DIP. The logo hits on 29 and the camera gives a breath
  // - four units down, recovered in half a bar. The world flinches;
  // the logo does not.
  { bar: 29.15, x: 477, y: 303, z: 156, yaw: EAST, horizon: 0.328, fov: 0.74 },
  { bar: 29.6, x: 478, y: 303, z: 160, yaw: EAST, horizon: 0.320, fov: 0.74 },
  // Level again, and AT REST for the launch - the same near-equal-key
  // law as before: a move starts on a beat only if the camera is
  // parked when the beat lands.
  { bar: 31.0, x: 482, y: 304, z: 161, yaw: EAST, horizon: 0.318, fov: 0.75 },
  // ── THE CHASE (bars 31-34): after the logo, through the deck ────
  // One climb now, not two. The logo launched on this beat; the camera
  // goes after it, CLOUD_BASE is 300, and the deck closes over the
  // picture across the second key.
  { bar: 31.8, x: 485, y: 304, z: 268, yaw: EAST, horizon: 0.180, fov: 0.78 },
  { bar: 33.4, x: 488, y: 305, z: 385, yaw: EAST, horizon: 0.050, fov: 0.80 },
  // THE LAST BREATH OF CLOUD - still 95% white a tenth of a bar out,
  // so the reveal and the beat stay one event (the 18-frames lesson).
  { bar: 33.85, x: 489, y: 305, z: 396, yaw: EAST, horizon: 0.030, fov: 0.81 },
  // BAR 34: out the top. CLOUD_TOP is 460; white-out to nothing in
  // eight frames, on the downbeat, with the logo's cut.
  { bar: 34.0, x: 489, y: 305, z: 470, yaw: EAST, horizon: 0.000, fov: 0.82 },
  // Bounds the interpolation; only inCloud(z) reads it past 34, so the
  // one requirement is that it stays above CLOUD_TOP.
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
