// INTRO2. Seconds in the DECODED recording, not an approximate tempo grid.
// tools/introAudioCheck.mjs reproduces these landmarks from the shipped MP3.
// The title uses the first closing beat itself; the louder answer is
// deliberately ignored. There is no capture correction or arbitrary lead.
export const TITLE_IMPACT_TIME = 246400 / 12000;
export const CLOUD_REVEAL_TIME = 11.712;
export const TITLE_ENTER_TIME = TITLE_IMPACT_TIME - 0.78;
export const TITLE_READY_TIME = TITLE_IMPACT_TIME + 1.35;
export const MENU_FADE_SECONDS = 1.1;
export const INTRO_HOLD_TIME = TITLE_IMPACT_TIME + 2.4;
export const LANDSCAPE_HOLD_TIME = 18.9;

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

/** Exact landing at the measured onset; no random jitter of the wordmark. */
export function introTitleAt(time, reducedMotion = false) {
  if (time < TITLE_ENTER_TIME) return { opacity: 0, y: -0.68, scale: 1.04, impact: 0 };
  if (time < TITLE_IMPACT_TIME) {
    const k = unit((time - TITLE_ENTER_TIME) / (TITLE_IMPACT_TIME - TITLE_ENTER_TIME));
    return { opacity: reducedMotion ? 0 : between(k, 0, 0.18), y: -0.68 * (1 - k * k), scale: 1.04 - 0.04 * k * k, impact: 0 };
  }
  return { opacity: 1, y: 0, scale: 1, impact: reducedMotion ? 0 : Math.exp(-(time - TITLE_IMPACT_TIME) * 8) };
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
    shade: 0.16 + 0.50 * between(t, 18.9, TITLE_IMPACT_TIME + 0.25),
    title: introTitleAt(t, reducedMotion),
    credits: INTRO_CREDITS.map((credit) => ({ ...credit, opacity: introCreditOpacity(credit, t) })),
    ready: t >= TITLE_READY_TIME,
    prompt: between(t, TITLE_READY_TIME, TITLE_READY_TIME + 0.65),
  };
}
