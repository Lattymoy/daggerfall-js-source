// INTRO2. Seconds in the DECODED recording, not an approximate tempo grid.
// tools/introAudioCheck.mjs reproduces these landmarks from the shipped MP3.
// There is no capture correction or arbitrary lead.
//
// INTRO2b (Mac, 2026-09-18: "the logo needs to drop with the beat that
// happens around the 19 second mark"). The first cut landed on 20.533333s,
// which is only the loudest FRAME inside a hand-picked 20.35-20.7s window -
// it is not a local maximum of the onset curve at all, and the ear hears no
// attack there. The beat Mac means is the real one: decoded sample 230016,
// normalized flux 1.77 and the largest raw onset anywhere between the cloud
// break and the closing pair. The louder answer at 21.066667s still follows
// it, and is still deliberately ignored.
//
// Measured on the REMASTERED master Mac supplied on the same day, which is a
// different recording (164.3335s, not 164.5202s) carrying the same
// arrangement. Its cloud break is still 11.712s; its 19s beat moved one
// analysis hop earlier than the old master's, and the cue moved with it.
export const TITLE_IMPACT_TIME = 230016 / 12000;
export const CLOUD_REVEAL_TIME = 11.712;
export const TITLE_ENTER_TIME = TITLE_IMPACT_TIME - 0.78;
export const TITLE_READY_TIME = TITLE_IMPACT_TIME + 1.35;
export const MENU_FADE_SECONDS = 1.1;
export const INTRO_HOLD_TIME = TITLE_IMPACT_TIME + 2.4;
// The camera must be at rest BEFORE the logo starts moving, so the landing is
// the only movement on the beat. Moving the beat 1.365s earlier moves this
// with it, keeping the same 0.85s of stillness ahead of TITLE_ENTER_TIME.
export const LANDSCAPE_HOLD_TIME = 17.54;

const unit = (x) => Math.max(0, Math.min(1, x));
export const introEase = (x) => { const k = unit(x); return k * k * k * (k * (k * 6 - 15) + 10); };
const between = (t, a, b) => introEase((t - a) / (b - a));

export const INTRO_CREDITS = Object.freeze([
  { key: 'interkarma', caption: 'Built on the work of', start: 1.25, up: 2.25, out: 4.55, end: 5.3 },
  { key: 'nexus', caption: 'With the modding community of', start: 5.65, up: 6.6, out: 8.5, end: 9.3 },
]);

export function introCreditOpacity(credit, time) {
  return between(time, credit.start, credit.up) * (1 - between(time, credit.out, credit.end));
}

/** INTRO2c (Mac: "I want the logo to fly in from the screen, not from the top
 * of the screen. If that makes sense. Needs to feel powerful, not goofy").
 *
 * The mark no longer drops in from above. It comes out of the DEPTH of the
 * shot, dead centre on the camera axis, and stops on the beat.
 *
 * The apparent size of something travelling at a CONSTANT speed toward a lens
 * is 1/z, so a linear sweep of z from TITLE_DEPTH to 1 is the real thing: far
 * and almost still for most of the approach, then filling the frame over the
 * last few frames. An eased size ramp is exactly what reads as goofy, and so
 * does an overshoot - this has neither. The mark stops dead at 1, and the
 * recoil belongs to the WORLD (impact: bloom and a settling frame), not to a
 * bouncing wordmark. Depth of field closes with the distance, so it resolves
 * as it arrives instead of sliding in already sharp.
 *
 * y stays 0 at every time: the entrance has no vertical component at all. */
export const TITLE_DEPTH = 5.5;
export const TITLE_BLUR = 7;
export function introTitleAt(time, reducedMotion = false) {
  // Reduced motion keeps the musical reveal and nothing that flies.
  if (reducedMotion) return { opacity: time < TITLE_IMPACT_TIME ? 0 : 1, y: 0, scale: 1, blur: 0, impact: 0 };
  if (time < TITLE_ENTER_TIME) return { opacity: 0, y: 0, scale: 1 / TITLE_DEPTH, blur: TITLE_BLUR, impact: 0 };
  if (time < TITLE_IMPACT_TIME) {
    const k = unit((time - TITLE_ENTER_TIME) / (TITLE_IMPACT_TIME - TITLE_ENTER_TIME));
    const z = TITLE_DEPTH - (TITLE_DEPTH - 1) * k;
    return { opacity: between(k, 0, 0.16), y: 0, scale: 1 / z, blur: TITLE_BLUR * (z - 1) / (TITLE_DEPTH - 1), impact: 0 };
  }
  return { opacity: 1, y: 0, scale: 1, blur: 0, impact: Math.exp(-(time - TITLE_IMPACT_TIME) * 8) };
}

/** One perspective camera from the water to the full bay. No projection cut.
 * The two credits are gone before the climb. Quintic easing has zero first
 * and second derivatives at each end, so the rise does not kick or wobble. */
export function introCameraAt(time, aspect = 16 / 9, reducedMotion = false) {
  const t = Math.max(0, Math.min(INTRO_HOLD_TIME, time));
  const approach = unit(t / 9.5);
  const lift = between(t, 9.45, CLOUD_REVEAL_TIME + 0.45);
  const pullback = between(t, CLOUD_REVEAL_TIME, LANDSCAPE_HOLD_TIME);
  const eye = [
    -470 + 235 * approach + 235 * pullback,
    32 + 4 * Math.sin(approach * Math.PI * 1.4) + lift * 290 + pullback * 325,
    32 + Math.sin(approach * Math.PI * 1.8) * 13 + pullback * 235,
  ];
  const aim = [eye[0] + 340 * (1 - pullback), 12 * (1 - pullback), -5];
  // A portrait screen widens vertically, preserving the full bay's width.
  const horizontalFov = reducedMotion ? 1.2 : 1.03 + 0.17 * lift;
  const fov = 2 * Math.atan(Math.tan(horizontalFov / 2) / Math.max(0.45, aspect));
  if (reducedMotion) return { eye: [0, 647, 267], aim: [0, 0, -5], fov };
  return { eye, aim, fov };
}

/** The title persists indefinitely. Only the player's action ends the intro. */
export function introFrameAt(time, reducedMotion = false) {
  const t = Math.max(0, time);
  return {
    time: t,
    landscapeTime: reducedMotion ? LANDSCAPE_HOLD_TIME : Math.min(t, LANDSCAPE_HOLD_TIME),
    opening: between(t, 0, 1.5),
    cloud: between(t, 10.25, 11.35) * (1 - between(t, CLOUD_REVEAL_TIME, 12.35)),
    shade: 0.16 + 0.50 * between(t, LANDSCAPE_HOLD_TIME, TITLE_IMPACT_TIME + 0.25),
    title: introTitleAt(t, reducedMotion),
    credits: INTRO_CREDITS.map((credit) => ({ ...credit, opacity: introCreditOpacity(credit, t) })),
    ready: t >= TITLE_READY_TIME,
    prompt: between(t, TITLE_READY_TIME, TITLE_READY_TIME + 0.65),
  };
}
