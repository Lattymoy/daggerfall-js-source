// U21: the main-menu host - the game's front door.
//
// Before this, main.js's bare URL called bootDungeon directly, so the
// first thing anyone saw was the chargen wizard on a black panel. The
// menu now sits in front of it: PICK03I0 with DFU's three verbatim
// button rects (ui/startWindow.js), and it hands off to the SAME
// classic start that used to run on boot.
//
// It is deliberately a thin host. It owns a renderer, a canvas and one
// window - no motor, no world, no audio - so the menu costs nothing to
// show and the game data only loads once a choice is made.
//
// LOAD GAME reuses the dungeon host's own quickLoad (the F12 path)
// rather than a second loader: the menu boots the classic start with
// `load` set and dungeon.js calls ctx.quickLoad after the context is
// built. A menu-side loader would be a duplicate port of a path that
// already works, which is the shape this project's audits keep finding.

import { StartWindow, loadStartArt } from '../ui/startWindow.js';
import { TitleScreen, loadTitleArt } from '../ui/titleScreen.js';
import { fetchBytes } from './shared.js';
import { readQuicksave } from '../systems/save.js';

/**
 * Show the menu, resolve when the player picks. Returns the action.
 * Art failure is NOT fatal - the window still answers clicks on the
 * verbatim rects, so the menu can never trap the player on a black
 * screen (the same "text fallback never traps" law the char sheet and
 * chargen follow).
 */
export async function runMenu(canvas, renderer, status) {
  await runTitle(canvas, renderer, status);
  status('main menu');
  let art = null;
  try {
    art = await loadStartArt({ renderer, fetchBytes });
  } catch (e) {
    console.warn('[menu] PICK03I0.IMG unavailable - the menu draws bare:', e?.message ?? e);
  }
  const win = new StartWindow(art);

  return new Promise((resolve) => {
    let done = false;
    const onPointerDown = (e) => {
      if (done) return;
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) * (canvas.width / r.width);
      const py = (e.clientY - r.top) * (canvas.height / r.height);
      const action = win.click(canvas, px, py);
      if (!action) return;                      // consumed, but not a button
      if (action === 'exit') {
        // DFU's exit quits the application (DaggerfallStartWindow.cs:60).
        // A browser tab cannot close itself unless script opened it, so
        // the button stays drawn - it is painted into PICK03I0 - and
        // says so instead of pretending. Ledger A.
        status('exit is not available in a browser');
        console.log('[menu] Exit: no application to quit in a browser (Ledger A)');
        return;
      }
      done = true;
      canvas.removeEventListener('pointerdown', onPointerDown);
      resolve(action);
    };
    canvas.addEventListener('pointerdown', onPointerDown);

    // The menu is 2D only: drawScreenQuad works in screen space, so
    // the frame just needs a cleared buffer and a bound program.
    const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const LIGHT = new Float32Array([0, 1, 0]);
    const frame = () => {
      renderer.beginFrame(IDENTITY, IDENTITY, LIGHT);
      win.draw(renderer, canvas);
      if (!done) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/** Is there a game to load? The menu shows Load unconditionally, as
 *  DFU does; this is for the host that has to act on the press. */
export const hasSavedGame = () => !!readQuicksave();

/**
 * U21c: the title screen, before the menu. Resolves as soon as the
 * player clicks or presses a key - and IMMEDIATELY if there is no logo
 * to show, so a missing asset costs a splash and never a game.
 */
export async function runTitle(canvas, renderer, status) {
  const art = await loadTitleArt({
    renderer,
    fetchBytes,
    // smooth: LINEAR/CLAMP, because our logo is a high-resolution banner
    // drawn at a non-integer scale - NEAREST is for pixel-exact classic
    // art and would alias the serifs. Classic's own title takes the
    // native path instead and never reaches here.
    uploadLogo: (pixels) => renderer.uploadTexture('ui', 'logo', pixels, { smooth: true }),
  });
  if (!art) return false;                          // no art, no title screen
  status('title');
  const title = new TitleScreen(art);

  const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const LIGHT = new Float32Array([0, 1, 0]);
  await new Promise((resolve) => {
    const finish = () => {
      if (title.done) return;
      title.done = true;
      canvas.removeEventListener('pointerdown', finish);
      removeEventListener('keydown', finish);
      resolve();
    };
    canvas.addEventListener('pointerdown', finish);
    addEventListener('keydown', finish);
    const frame = () => {
      renderer.beginFrame(IDENTITY, IDENTITY, LIGHT);
      title.draw(renderer, canvas);
      if (!title.done) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return true;
}
