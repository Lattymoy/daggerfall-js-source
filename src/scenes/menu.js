// U21: the main-menu host - the game's front door.
//
// Before this, main.js's bare URL called bootDungeon directly, so the
// first thing anyone saw was the chargen wizard on a black panel. The
// menu now sits in front of it: PICK03I0 with DFU's three verbatim
// button rects (ui/startWindow.js), and it hands off to the SAME
// classic start that used to run on boot.
//
// It is deliberately a thin host. It owns a renderer, a canvas, one
// window and the title music - no motor, no world - so the menu costs
// little to show and the game data only loads once a choice is made.
//
// TITLE MUSIC: DFU's start scene carries a DaggerfallSongPlayer set to
// SongFiles.song_5strong, so the whole start flow plays under it. The
// service's pre-gesture arm holds the request until the title screen's
// dismiss click/key - the first gesture - so autoplay policy never
// bites. The in-game director replaces it the moment a scene host
// boots and feeds its own context. '03.HMI' (the classic theme
// melody) stands in if the archive lacks a 5STRONG record.
//
// LOAD GAME reuses the dungeon host's own quickLoad (the F12 path)
// rather than a second loader: the menu boots the classic start with
// `load` set and dungeon.js calls ctx.quickLoad after the context is
// built. A menu-side loader would be a duplicate port of a path that
// already works, which is the shape this project's audits keep finding.

import { StartWindow, loadStartArt } from '../ui/startWindow.js';
import { TitleScreen, loadTitleArt } from '../ui/titleScreen.js';
import { fetchBytes } from './shared.js';
import { music } from '../systems/music.js';
import { restorableQuicksave } from '../systems/save.js';

const TITLE_SONGS = ['5STRONG.HMI', '03.HMI'];   // DFU start scene song, then the stand-in

async function startTitleMusic() {
  await music.ensure(fetchBytes);
  const name = TITLE_SONGS.find((n) => (music.archive?.getSongIndex(n) ?? -1) >= 0);
  if (name) music.playSong(name);
  else if (music.enabled) console.warn('[menu] no title song in MIDI.BSA (tried ' + TITLE_SONGS.join(', ') + ')');
}

/**
 * Show the menu, resolve when the player picks. Returns the action.
 * Art failure is NOT fatal - the window still answers clicks on the
 * verbatim rects, so the menu can never trap the player on a black
 * screen (the same "text fallback never traps" law the char sheet and
 * chargen follow).
 */
export async function runMenu(canvas, renderer, status) {
  startTitleMusic();   // fire-and-forget: the menu never waits on MIDI.BSA
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
      if (action === 'load' && !hasSavedGame()) {
        // AUDIT 19 F3: LOAD with no save used to fall through and silently
        // START A NEW GAME - the boot set `load`, quickLoad found nothing,
        // printed "No saved game." into a HUD nobody was looking at yet,
        // and chargen came up as if NEW GAME had been pressed. DFU's Load
        // opens a save list, which is simply empty; it never starts a game
        // you did not ask for. The port has no save list yet, so the
        // honest equivalent is to say so and stay on the menu.
        status('no saved game');
        console.log('[menu] Load Game: no quicksave to load');
        return;
      }
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
 *  DFU does; this is for the host that has to act on the press.
 *
 *  AUDIT (2026-08-25) F2: this asked readQuicksave, which parses the
 *  blob and does not test its VERSION - so F3's own guard passed on an
 *  envelope restorePlayer would refuse, and Load came up on the chargen
 *  wizard. The question is "can this build restore it", and that
 *  question has one home. */
export const hasSavedGame = () => !!restorableQuicksave();

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
