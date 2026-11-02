// @ts-check
// MUSIC-BOX (bible/06-Systems/Online-Arc.md MUSIC-BOX): A MUSIC BOX PRESSED - the interior host's activateDecor hands a
// placed piece made the `music` station here. Its list is the room's own music, then each tune this character has
// collected (systems/musicBox.js), the one it plays marked; the pick plays at once (the world host's music chain, the
// box's score). Anyone in the room may press it: what it plays is the presser's own.
import { ListPickerWindow, listPickerArtLoaded } from '../ui/listPicker.js';
import { t } from '../systems/textManager.js';
import { tunesHeld, tuneName, tuneCount, boxPick, setBoxPick } from '../systems/musicBox.js';

export const MUSIC_BOX_TEXT = Object.freeze({
  get none() { return t('music.box.none', 'The music box has no tunes yet. Foes sometimes drop sheet music. Use a sheet to add its tune.'); },
  get quiet() { return t('music.box.quiet', 'Off - the room\'s own music'); },
  count: (/** @type {number} */ n, /** @type {number} */ total) => t('music.box.count', 'Music box: {n} of {total} tunes collected.', { n, total }),
  playing: (/** @type {string} */ name) => t('music.box.playing', 'The music box plays {name}.', { name }),
  get off() { return t('music.box.off', 'The music box stops.'); },
});

/**
 * Open the box `pieceId`'s list. `show(w)` mounts the window (the interior's slot), `say(text)` the HUD's line.
 * Answers the window, or null where none opened (no tunes, no picker art).
 * @param {string} pieceId @param {{ show: (w: any) => void, say: (text: string) => void }} deps
 */
export function openMusicBox(pieceId, { show, say }) {
  const keys = tunesHeld();
  if (!keys.length) { say(MUSIC_BOX_TEXT.none); return null; }
  if (!listPickerArtLoaded()) return null;
  const now = boxPick(pieceId);
  const items = [MUSIC_BOX_TEXT.quiet, ...keys.map((k) => (k === now ? `* ${tuneName(k)}` : tuneName(k)))];
  const n = tuneCount();
  say(MUSIC_BOX_TEXT.count(n.held, n.total));
  const win = new ListPickerWindow({
    items, selectedIndex: now ? keys.indexOf(now) + 1 : 0,
    onPick: (/** @type {number} */ i) => {
      const key = i > 0 ? keys[i - 1] ?? null : null;
      if (!setBoxPick(pieceId, key)) return;
      say(key ? MUSIC_BOX_TEXT.playing(tuneName(key)) : MUSIC_BOX_TEXT.off);
    },
  });
  show(win);
  return win;
}
