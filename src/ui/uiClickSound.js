// SND1 - THE ENHANCED UI'S CLICK.
//
// Discord, 2026-09-23: "everything you click at in the UI ... needs the
// Daggerfall click sound." DFU gives every Button a ClickSound and plays
// SoundClips.ButtonClick for it (Button.cs, DaggerfallMessageBox :487);
// the classic windows here play it per handler. The enhanced windows are
// DOM, and giving each of their several hundred buttons its own call
// would be several hundred calls to keep in step - so ONE listener at
// the window's capture phase hears every click on anything clickable,
// and plays the click AFTER the click's own handlers have run, UNLESS
// one of them chose a sound of its own (an equip, a drink, the gold, a
// page turn): a press makes one sound, and the specific one wins.
//
// Enhanced skin only. The classic windows keep DFU's own per-button
// calls, untouched.
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { isEnhanced } from '../systems/uiSkin.js';

/** What is "something you click" - buttons and the things that act
 *  like them. An empty hotbar socket is not one; the game canvas never. */
export const CLICKABLE = [
  'button', 'a[href]', 'summary', 'select', 'input[type="checkbox"]', 'input[type="radio"]',
  '[role="button"]', '[role="tab"]', '[role="option"]', '[role="menuitem"]', '[role="checkbox"]', '[role="switch"]',
  '.hb-slot:not(.hb-empty)',
].join(', ');

/** AUDIT CONTRIB U2: the click's own window opens at its GESTURE's
 *  pointerdown - a pointerdown or pointerup handler that already acted (the
 *  hotbar's press, the pack's drag) sounded for this click however long the
 *  finger was held. It was a fixed 150 ms before the click, so a touch held
 *  past it on a hotbar slot sounded twice. A keyboard's click (detail 0) has
 *  no gesture and opens its window at itself; a pointerdown older than this
 *  is another gesture's. */
const GESTURE_MS = 10_000;

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

let installed = false;

export function installUiClickSound(doc = globalThis.document) {
  const win = doc?.defaultView;
  if (installed || !win) return;
  installed = true;
  let pressAt = -Infinity;
  win.addEventListener('pointerdown', () => { pressAt = nowMs(); }, true);   // capture: before any handler of the press sounds
  win.addEventListener('click', (e) => {
    if (!isEnhanced()) return;
    const t = e.target?.closest?.(CLICKABLE);
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    const now = nowMs();
    const at = e.detail > 0 && now - pressAt < GESTURE_MS ? pressAt : now;
    // After every handler of THIS click has run - and a handler that
    // stops propagation cannot stop this, which is why it is scheduled
    // from the capture phase rather than heard at the bubble.
    setTimeout(() => {
      if ((audio.lastOneShotAt ?? -Infinity) >= at) return;   // the press already sounded
      audio.playOneShot(SOUND.ButtonClick, 1);
    }, 0);
  }, true);
}
