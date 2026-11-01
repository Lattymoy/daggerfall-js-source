// @ts-check
// The pipe's haze: for a while after a smoke the world is soft and hazy. The game's canvas is blurred and tinted with a
// CSS filter, and a pale green mist drifts over it, so nothing the renderer draws needs to know. A second smoke while
// hazy runs the clock on from now; the haze never stacks thicker. Pointer events pass through the mist.

/** Seconds of haze a smoke gives: a whole number from the first to the second, evenly. */
export const HAZE_SECONDS = Object.freeze([30, 60]);
/** Seconds the haze takes to come on, and to clear at its end. */
export const HAZE_FADE_IN_S = 2;
export const HAZE_FADE_OUT_S = 4;
/** The canvas's look while hazy. */
export const HAZE_FILTER = 'blur(2.5px) saturate(1.4) brightness(1.06) hue-rotate(12deg)';
const MIST_ID = 'pipe-haze-mist';
const MIST_KEYFRAMES = 'pipe-haze-drift';

/** A haze's length in seconds, from a [0, 1) roll. */
export const hazeSeconds = (/** @type {() => number} */ rolls = Math.random) =>
  HAZE_SECONDS[0] + Math.floor(rolls() * (HAZE_SECONDS[1] - HAZE_SECONDS[0] + 1));

let _endTimer = /** @type {any} */ (null);
let _clearTimer = /** @type {any} */ (null);
let _canvas = /** @type {any} */ (null);
let _canvasWas = '';
let _until = 0;

/** Whether a haze is on now (`now` in ms). */
export const hazeActive = (now = Date.now()) => now < _until;

function canvasOf(/** @type {any} */ doc) {
  return doc?.getElementById?.('c') ?? doc?.querySelector?.('canvas') ?? null;
}

function mistOf(/** @type {any} */ doc) {
  let mist = doc.getElementById(MIST_ID);
  if (mist) return mist;
  if (!doc.getElementById(`${MIST_ID}-style`)) {
    const style = doc.createElement('style');
    style.id = `${MIST_ID}-style`;
    style.textContent =
      `@keyframes ${MIST_KEYFRAMES} { 0% { transform: scale(1) translate(0, 0); } ` +
      `50% { transform: scale(1.06) translate(-1.5%, 1%); } 100% { transform: scale(1) translate(0, 0); } }`;
    doc.head?.appendChild(style);
  }
  mist = doc.createElement('div');
  mist.id = MIST_ID;
  Object.assign(mist.style, {
    position: 'fixed',
    inset: '-5%',
    pointerEvents: 'none',
    zIndex: '1',
    opacity: '0',
    transition: `opacity ${HAZE_FADE_IN_S}s ease-in`,
    background:
      'radial-gradient(ellipse at 50% 55%, rgba(210,255,200,0.10) 0%, rgba(170,230,160,0.22) 55%, rgba(120,170,110,0.38) 100%)',
    animationName: MIST_KEYFRAMES,
    animationDuration: '9s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  });
  doc.body?.appendChild(mist);
  return mist;
}

/** Clears the haze at once (a scene change, a test). */
export function clearHaze(/** @type {any} */ doc = typeof document === 'undefined' ? null : document) {
  clearTimeout(_endTimer);
  clearTimeout(_clearTimer);
  _endTimer = _clearTimer = null;
  _until = 0;
  if (_canvas) {
    _canvas.style.filter = _canvasWas;
    _canvas.style.transition = '';
  }
  _canvas = null;
  doc?.getElementById?.(MIST_ID)?.remove?.();
}

/**
 * Starts the haze for `seconds`, or runs a haze already on to `seconds` from now. Answers whether it could start (no
 * document or no canvas: nothing to blur).
 * @param {number} seconds @param {any} [doc] @param {number} [now] ms
 */
export function startHaze(seconds, doc = typeof document === 'undefined' ? null : document, now = Date.now()) {
  const canvas = canvasOf(doc);
  if (!canvas || !(seconds > 0)) return false;
  if (!_canvas) {
    _canvas = canvas;
    _canvasWas = canvas.style.filter ?? '';
  }
  clearTimeout(_endTimer);
  clearTimeout(_clearTimer);
  _clearTimer = null;
  canvas.style.transition = `filter ${HAZE_FADE_IN_S}s ease-in`;
  canvas.style.filter = HAZE_FILTER;
  const mist = mistOf(doc);
  mist.style.transition = `opacity ${HAZE_FADE_IN_S}s ease-in`;
  mist.style.opacity = '1';
  _until = now + seconds * 1000;
  _endTimer = setTimeout(() => {
    canvas.style.transition = `filter ${HAZE_FADE_OUT_S}s ease-out`;
    canvas.style.filter = _canvasWas;
    mist.style.transition = `opacity ${HAZE_FADE_OUT_S}s ease-out`;
    mist.style.opacity = '0';
    _clearTimer = setTimeout(() => clearHaze(doc), HAZE_FADE_OUT_S * 1000);
  }, Math.max(0, seconds - HAZE_FADE_OUT_S) * 1000);   // cleared by the end of its seconds, not after them
  return true;
}
