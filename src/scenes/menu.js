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

import { UP_Y } from '../world/mat4.js';   // EV2: the shared billboard up axis
import { StartWindow, loadStartArt } from '../ui/startWindow.js';
import { TitleScreen, loadTitleArt } from '../ui/titleScreen.js';
import { LoadClassicWindow, LOAD_CLASSIC_IMG } from '../ui/loadClassicWindow.js';
import { fetchBytes } from './shared.js';
import { music } from '../systems/music.js';
import { mostRecentRestorable } from '../systems/saveSlots.js';   // SAV4: the F2 question, now over the slot store
import { SaveGames, SAVENAME_TXT, MAPSAVE_FILENAME, RUMOR_FILENAME, BIO_FILENAME } from '../formats/saveGames.js';
import { SAVETREE_FILENAME } from '../formats/saveTreeFile.js';
import { SAVE_IMAGE_FILENAME } from '../formats/saveImageFile.js';
import { SAVEVARS_FILENAME } from '../formats/saveVarsFile.js';
import { setPendingClassicSave } from '../systems/classicSave.js';
import { DFPalette } from '../formats/dfPalette.js';
import { FntFile } from '../formats/fntFile.js';
import { loadImg, nativeMetrics, pointToNative } from '../ui/nativePanel.js';
import { makeFont } from '../ui/text.js';
import { bitmapToColor32 } from '../ui/hud.js';
import { SaveWindow } from '../ui/saveWindow.js';   // SAV4: the start menu's Load door

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
    let suspended = false;   // SAV3: the classic-load flow draws its own frames
    const onPointerDown = async (e) => {
      if (done || suspended) return;
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) * (canvas.width / r.width);
      const py = (e.clientY - r.top) * (canvas.height / r.height);
      const action = win.click(canvas, px, py);
      if (!action) return;                      // consumed, but not a button
      if (action === 'load') {
        // SAV4: DFU's start-window Load opens the SLOT WINDOW
        // (LoadGame mode, displayMostRecentChar - StartWindow.cs:89),
        // whose no-saves arm prompts the classic list (:328-332) and
        // whose Classic button reaches it WITH saves present - the
        // SAV3 residue, closed. AUDIT 19 F3's law holds throughout:
        // no path here ever starts a game the player did not ask for.
        suspended = true;
        const picked = hasSavedGame()
          ? await runSaveLoadWindow(canvas, renderer, status)
          : 'classic';
        let resolved = null;
        if (picked === 'classic') {
          resolved = (await runClassicLoad(canvas, renderer, status)) ? 'classicload' : null;
        } else if (picked != null) {
          _pickedLoadKey = picked;
          resolved = 'load';
        }
        suspended = false;
        if (!resolved) { status('main menu'); return; }
        done = true;
        canvas.removeEventListener('pointerdown', onPointerDown);
        resolve(resolved);
        return;
      }
      if (action === 'exit') {
        // DFU's exit quits the application (DaggerfallStartWindow.cs:60).
        // A browser tab cannot close itself unless script opened it, so
        // the button stays drawn - it is painted into PICK03I0 - and
        // says so instead of pretending. Ledger A, the MAIN-MENU EXIT
        // BUTTON row, by name.
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
    const LIGHT = UP_Y;
    const frame = () => {
      if (!suspended) {
        renderer.beginFrame(IDENTITY, IDENTITY, LIGHT);
        win.draw(renderer, canvas);
      }
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
 *  question has one home - SAV4 moved it to the slot store's recency
 *  walk, so one stale-version save cannot hide an older good one. */
export const hasSavedGame = () => !!mostRecentRestorable();

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
  const LIGHT = UP_Y;
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

// ─────────────────── SAV3: the classic-load flow ───────────────────

/** The seven files a classic save directory can carry, by their
 *  UPPERCASE names (SaveGames' own set). */
const CLASSIC_SAVE_FILES = new Set([
  SAVETREE_FILENAME, SAVEVARS_FILENAME, SAVE_IMAGE_FILENAME,
  SAVENAME_TXT, MAPSAVE_FILENAME, RUMOR_FILENAME, BIO_FILENAME,
]);

/**
 * The browser's stand-in for SaveGames' Directory.GetDirectories walk
 * (Ledger A, the MAIN-MENU EXIT BUTTON row, which carries this half
 * too - a browser cannot read the Daggerfall folder on its own): a
 * picker overlay takes the classic Daggerfall folder (or
 * the SAVE0-SAVE5 folders, or a drop) and returns
 * { saveIndex: { FILENAME: bytes } } keyed by the SAVE# path segment.
 * Resolves null on cancel. Nothing persists - like DFU, the "disk" is
 * re-read on every open; ours just arrives through a picker.
 */
function pickClassicSaveFiles() {
  return new Promise((resolve) => {
    const ui = document.createElement('div');
    ui.style.cssText = 'position:fixed;inset:0;background:#111;color:#ddd;font:14px monospace;display:flex;align-items:center;justify-content:center;z-index:10';
    ui.innerHTML = `
      <div style="max-width:460px;text-align:center;border:1px solid #444;padding:24px">
        <h2 style="margin-top:0">Load Classic Save</h2>
        <p>Select your classic <b>Daggerfall</b> folder (the one holding
        SAVE0-SAVE5 beside ARENA2), or drop it here. Saves are read for
        this load only - nothing is stored.</p>
        <input type="file" id="picksaves" webkitdirectory multiple style="margin:8px">
        <p><button id="cancelsaves" style="font:inherit;padding:4px 12px">Cancel</button></p>
        <p id="savemsg" style="color:#8a8"></p>
      </div>`;
    document.body.appendChild(ui);
    const msg = ui.querySelector('#savemsg');
    const finish = (result) => { ui.remove(); resolve(result); };

    const collect = (files) => {
      const saves = {};
      for (const f of files) {
        const path = (f.webkitRelativePath || f.name).toUpperCase();
        const m = path.match(/(?:^|\/)SAVE([0-5])\/([^/]+)$/);
        if (!m || !CLASSIC_SAVE_FILES.has(m[2])) continue;
        (saves[Number(m[1])] ??= {})[m[2]] = f;
      }
      return saves;
    };
    const ingest = async (files) => {
      const saves = collect(files);
      const indexes = Object.keys(saves);
      if (!indexes.length) { msg.textContent = 'no SAVE0-SAVE5 folders in that selection'; return; }
      msg.textContent = `reading ${indexes.length} save slot(s)...`;
      for (const files2 of Object.values(saves)) {
        for (const [name, file] of Object.entries(files2)) {
          files2[name] = new Uint8Array(await file.arrayBuffer());
        }
      }
      finish(saves);
    };

    ui.querySelector('#picksaves').addEventListener('change', (e) => ingest([...e.target.files]));
    ui.querySelector('#cancelsaves').addEventListener('click', () => finish(null));
    ui.addEventListener('dragover', (e) => e.preventDefault());
    ui.addEventListener('drop', async (e) => {
      e.preventDefault();
      const files = [];
      // Directory entries carry no webkitRelativePath - rebuild it
      // from the walk so the SAVE# segment survives.
      const walk = async (entry, prefix) => {
        if (entry.isFile) {
          const f = await new Promise((r) => entry.file(r));
          files.push({ webkitRelativePath: prefix + entry.name, arrayBuffer: () => f.arrayBuffer() });
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          let batch;
          do {
            batch = await new Promise((r) => reader.readEntries(r));
            for (const en of batch) await walk(en, prefix + entry.name + '/');
          } while (batch.length);
        }
      };
      for (const item of e.dataTransfer.items) { const en = item.webkitGetAsEntry?.(); if (en) await walk(en, ''); }
      ingest(files);
    });
  });
}

/**
 * SAV3: the whole classic-load flow - the picker, then
 * DaggerfallLoadClassicGameWindow over the picked saves. On a load the
 * opened SaveGames is stashed for the world host
 * (setPendingClassicSave) and this resolves true; cancel/exit resolve
 * false and the caller stays on the menu.
 */
export async function runClassicLoad(canvas, renderer, status) {
  status('classic saves');
  const saves = await pickClassicSaveFiles();
  if (!saves) return false;

  const saveGames = new SaveGames();
  if (!saveGames.openSavesPath(saves)) {
    status('no classic saves in that selection');
    return false;
  }

  // The window's art: LOAD00I0 + the default UI font + ART_PAL for
  // the slot screenshots. Each optional - the window never traps.
  let palette = null;
  let artPalBytes = null;
  try {
    artPalBytes = await fetchBytes('ART_PAL.COL');
    palette = new DFPalette();
    palette.load(artPalBytes, 'ART_PAL.COL');
  } catch { palette = null; }
  const art = { bg: null, font: null };
  try { art.bg = await loadImg({ renderer, fetchBytes, palette: palette ?? new DFPalette() }, LOAD_CLASSIC_IMG); }
  catch (e) { console.warn('[menu] LOAD00I0.IMG unavailable - the classic list draws bare:', e?.message ?? e); }
  try { art.font = makeFont(renderer, new FntFile().load(await fetchBytes('FONT0003.FNT')), 'FONT0003'); }
  catch (e) { console.warn('[menu] FONT0003.FNT unavailable - save names go unlabelled:', e?.message ?? e); }

  // LazyOpenSave per slot: a bad slot is logged and stays unmounted,
  // DFU's own arm (:117-121). The screenshot is the save's IMAGE.RAW
  // over ART_PAL, drawn OPAQUE (GetColor32's alphaIndex -1 - a
  // screenshot has no cutout).
  const slots = new Array(6).fill(null);
  for (let i = 0; i < 6; i++) {
    if (!saveGames.hasSave(i)) continue;
    try {
      saveGames.lazyOpenSave(i, artPalBytes);
      let tex = null;
      const bmp = saveGames.saveImage?.getDFBitmap();
      if (palette && bmp?.data?.length) {
        tex = renderer.uploadTexture('img', `CLASSICSAVE${i}`, bitmapToColor32(bmp, palette, -1));
      }
      slots[i] = { name: saveGames.saveName, tex };
    } catch (e) {
      console.warn(`[menu] could not lazy open save index ${i}.`, e?.message ?? e);
    }
  }
  if (!slots.some(Boolean)) {
    status('no readable classic saves');
    return false;
  }

  status('load classic game');
  const win = new LoadClassicWindow(art, slots);
  const picked = await new Promise((resolve) => {
    const onPointerDown = (e) => {
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) * (canvas.width / r.width);
      const py = (e.clientY - r.top) * (canvas.height / r.height);
      // e.detail carries the click count - 2+ is the double click that
      // selects AND loads (:225-230).
      const action = win.click(canvas, px, py, e.detail >= 2);
      if (!action) return;
      if (action.action === 'select') return;
      win.done = true;
      canvas.removeEventListener('pointerdown', onPointerDown);
      resolve(action.action === 'load' ? action.index : null);
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const LIGHT = UP_Y;
    const frame = () => {
      renderer.beginFrame(IDENTITY, IDENTITY, LIGHT);
      win.draw(renderer, canvas);
      if (!win.done) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  if (picked == null) return false;

  // TryOpenSave's log-and-continue: a save that will not open leaves
  // the player on the menu with the reason said, never in a half
  // game.
  try {
    saveGames.openSave(picked, artPalBytes);
  } catch (e) {
    console.warn(`[menu] could not open classic save index ${picked}.`, e?.message ?? e);
    status('could not open that classic save');
    return false;
  }
  setPendingClassicSave(saveGames);
  return true;
}

// ─────────────────── SAV4: the start menu's slot window ───────────────────

/** The picked slot key rides to main.js the same take-once shape the
 *  classic hand-off uses. */
let _pickedLoadKey = null;
export function takePickedLoadKey() {
  const k = _pickedLoadKey;
  _pickedLoadKey = null;
  return k;
}

/**
 * DFU's start-window Load: the slot window in LoadGame mode with
 * displayMostRecentChar (StartWindow.cs:89). Resolves the picked slot
 * KEY, the string 'classic' for the classic switch, or null on
 * cancel.
 */
export async function runSaveLoadWindow(canvas, renderer, status) {
  status('load game');
  let font = null;
  try { font = makeFont(renderer, new FntFile().load(await fetchBytes('FONT0003.FNT')), 'FONT0003'); }
  catch (e) { console.warn('[menu] FONT0003.FNT unavailable - the save list draws bare:', e?.message ?? e); }

  return new Promise((resolve) => {
    const win = new SaveWindow('load', {
      loadKey: (key) => { finish(key); },
      onSwitchClassic: () => { finish('classic'); },
      onBack: () => { finish(null); },
    }, { displayMostRecentChar: true });
    const finish = (result) => {
      if (win.done && result === undefined) return;
      win.done = true;
      canvas.removeEventListener('pointerdown', onPointerDown);
      removeEventListener('keydown', onKeyDown);
      resolve(result);
    };
    const onPointerDown = (e) => {
      const r = canvas.getBoundingClientRect();
      const px = (e.clientX - r.left) * (canvas.width / r.width);
      const py = (e.clientY - r.top) * (canvas.height / r.height);
      const m = nativeMetrics(canvas);
      const pt = pointToNative(m, px, py);
      if (pt) win.click(pt[0], pt[1]);
    };
    const onKeyDown = (e) => {
      win.input(e.code, e);
      e.preventDefault();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    addEventListener('keydown', onKeyDown);
    const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const LIGHT = UP_Y;
    const frame = () => {
      if (!win.done && font) {
        renderer.beginFrame(IDENTITY, IDENTITY, LIGHT);
        win.draw(renderer, canvas, font);
      }
      if (!win.done) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    // No font, no window - resolve to the boot-load fallback rather
    // than trap on a black screen (the text-fallback-never-traps law:
    // here the fallback IS the old most-recent boot load).
    if (!font) finish(null);
  });
}
