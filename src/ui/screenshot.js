// KB1 (2026-09-23, Mac: "Build 2, hide 2" - the DFU actions bound and read by nothing): THE PRINTSCREEN ACTION.
//
// DFU binds PrintScreen to F8 (InputManager.cs:1030) and reads it nowhere - GameManager's TakeScreenshot is
// commented out (:946-953). The port shipped the same dead row, so F8 did nothing. This is the key made to do what
// its name says: the game canvas, saved as a PNG.
//
// ONE listener, installed once at boot, not an arm in each host's ladder: a screenshot does not depend on which
// scene is up, and a window being open is exactly when a player wants one. It reads the registry like every other
// key (the action, combos through the event's own modifiers), and skips a text field's typing.
//
// THE FRAME, NOT THE BUFFER'S LEFTOVERS. The renderer's context does not preserve its drawing buffer, so reading the
// canvas from inside a key event gets a cleared buffer. A requestAnimationFrame callback queued now runs AFTER the
// host's own (queued during the previous frame), and the buffer is only cleared after every callback of the frame
// has run - so the read lands on the frame just drawn.
import { actionOf, eventModifiers, isTextEntryTarget } from './input.js';

/** `daggerfall-20260923-141502.png` - local time, sortable, no characters a filesystem refuses. */
export function screenshotName(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `daggerfall-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}

/** Save `canvas` as a PNG after the frame now being drawn. Answers a promise of the file name, or null when the
 *  canvas gave no image (a lost context). */
export function takeScreenshot(canvas, { raf = globalThis.requestAnimationFrame, doc = globalThis.document } = {}) {
  return new Promise((resolve) => {
    const shoot = () => {
      canvas.toBlob((blob) => {
        if (!blob) { resolve(null); return; }
        const url = URL.createObjectURL(blob);
        const a = doc.createElement('a');
        a.href = url;
        a.download = screenshotName();
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        resolve(a.download);
      }, 'image/png');
    };
    if (typeof raf === 'function') raf(shoot); else shoot();
  });
}

/** Install the key, once. Returns the uninstaller. */
export function installScreenshotKey(canvas, { target = globalThis.window, shoot = takeScreenshot } = {}) {
  if (!canvas || !target?.addEventListener) return () => {};
  const onKey = (e) => {
    if (e.repeat || isTextEntryTarget(e.target)) return;
    if (actionOf(e, eventModifiers(e)) !== 'PrintScreen') return;
    e.preventDefault();
    shoot(canvas);
  };
  target.addEventListener('keydown', onKey);
  return () => target.removeEventListener('keydown', onKey);
}
