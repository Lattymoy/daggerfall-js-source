// project-dagger entry point.
// Hand-rolled WebGL2, no framework. Same doctrine as project-final.
// Desktop-first; touch devices get the ui/touch.js layer (stick +
// drag-look + buttons) speaking the same input language.
// Scene router: bare = the classic start (Privateer's Hold + chargen);
// ?interior, ?dungeon=<name>, ?world, ?exterior (or ?region/?loc)
// by default (?region=<name>&loc=<name>). Scene details live in
// src/scenes/*.js headers.
//
// Controls: mouselook engages on any click/keypress and windows free
// the cursor (DFU shape); WASD + mouse, Shift for speed.
// ?shot raises window.__shotReady at a fixed vantage for tools/screenshot.mjs.

import { Renderer } from './render/renderer.js';
import { windowEmissionRGB } from './render/windowEmission.js';
import { bootExterior } from './scenes/exterior.js';
import { bootInterior } from './scenes/interior.js';
import { bootDungeon } from './scenes/dungeon.js';
import { bootWorld } from './scenes/world.js';

import { ensureArena2, getBytes } from './scenes/dataSource.js';
import { installCursor } from './ui/cursor.js';

async function boot() {
  const canvas = document.getElementById('c');
  const renderer = new Renderer(canvas);
  const params = new URLSearchParams(location.search);
  const status = (msg) => {
    document.title = `project-dagger - ${msg}`;
  };
  // Data gate: readers load user-supplied ARENA2 at runtime
  // (Port-Doctrine) - dev serves it via middleware, production asks
  // for the folder once and persists it in IndexedDB.
  await ensureArena2();
  // The classic pointer for every surface (fire-and-forget; never traps).
  installCursor(getBytes);
  // Window emission style for every scene. DFU's GetMaterial default is Day.
  renderer.setWindowEmission(windowEmissionRGB(params.get('window') || 'day'));
  if (params.has('interior')) return bootInterior(canvas, renderer, params, status);
  if (params.has('dungeon')) return bootDungeon(canvas, renderer, params, status);
  if (params.has('world')) return bootWorld(canvas, renderer, params, status);
  if (params.has('exterior') || params.has('region') || params.has('loc')) return bootExterior(canvas, renderer, params, status);
  // U21: the bare URL is THE MAIN MENU, and the menu hands off to the
  // classic start (Privateer's Hold + chargen) that used to run here
  // directly. Dev scenes stay one param away (?exterior/?world/etc).
  //
  // ?shot BYPASSES the menu: it is the fixed-vantage test path that
  // tools/screenshot.mjs and the 25 probes in tools/ drive, and a menu
  // in front of it would block every one of them. ?nomenu is the same
  // escape hatch for a human.
  if (params.has('shot') || params.has('nomenu')) return bootDungeon(canvas, renderer, params, status);
  // U22: THE SPLASH. DaggerfallUI.InitGame pushes the Start window and
  // THEN pushes the VidPlayer on top of it, so ANIM0001.VID (splashVideo,
  // DaggerfallUI.cs:49) plays first and reveals the menu when it ends -
  // which is why this sits ahead of runMenu rather than inside it.
  // ?novideo is DFU's enableVideos setting. ?shot/?nomenu return above,
  // so no probe in tools/ ever reaches this.
  //
  // NEVER TRAPS, the same law the title screen and every native window
  // follow: a video that will not load costs you the splash, not the
  // game. ANIM0001 is named in dataSource's KEEP diet and a pin enforces
  // that, so the warn-and-skip here is a real fallback rather than the
  // AUDIT 18 F2 silent degradation it would otherwise be.
  if (!params.has('novideo')) {
    try {
      const { playVideo } = await import('./ui/videoPlayer.js');
      const { getBytes } = await import('./scenes/dataSource.js');
      const { ensureAudio } = await import('./scenes/shared.js');
      status('splash');
      // AUDIT 19 F2(vid): BOOT AUDIO FIRST. The player resolves its
      // AudioContext ONCE at construction, and nothing had booted one by
      // this point, so the splash's audio path was fully ported and
      // unconditionally silent - the file's own header blamed the browser
      // gesture rule, which is not what was stopping it. The context still
      // only starts on a gesture; this makes sure there IS one to start,
      // and on a first run the ARENA2 folder pick is itself a gesture.
      await ensureAudio(getBytes);
      await playVideo(canvas, renderer, await getBytes('ANIM0001.VID'));
    } catch (e) {
      console.warn('[boot] ANIM0001.VID unavailable - skipping the splash:', e?.message ?? e);
    }
  }
  const { runMenu } = await import('./scenes/menu.js');
  const action = await runMenu(canvas, renderer, status);
  // Load Game rides the dungeon host's OWN quickLoad (the F12 path) -
  // dungeon.js calls ctx.quickLoad once the context is built. A
  // menu-side loader would be a second copy of a working path.
  // AUDIT 19 F12: SET on load, DELETE on anything else. `load` was only
  // ever set, never cleared, so a URL that already carried ?load made NEW
  // GAME restore the save instead - the one action whose whole point is
  // not to.
  if (action === 'load') params.set('load', '1');
  else params.delete('load');
  return bootDungeon(canvas, renderer, params, status);
}

boot().catch((e) => {
  document.body.textContent = `boot failed: ${e.message}`;
  console.error(e);
  // A data-seam failure (missing file in the stored set - the
  // partial-ingest brick) gets a recovery path: wipe + re-pick.
  if (/re-pick|not in the stored/i.test(e.message)) {
    const b = document.createElement('button');
    b.textContent = 'clear stored data and pick again';
    b.style.cssText = 'display:block;margin:16px;padding:12px;font:14px monospace';
    b.onclick = async () => {
      const { clearStoredData } = await import('./scenes/dataSource.js');
      try { await clearStoredData(); } catch { /* wipe best-effort */ }
      location.reload();
    };
    document.body.appendChild(b);
  }
});

// Crash observability: an uncaught exception in the frame loop kills
// requestAnimationFrame silently - on the deployed site that reads as
// "the game crashed" with no signal. Surface the stack on screen so
// playtest reports pinpoint the throw.
function crashOverlay(msg) {
  if (document.getElementById('crash')) return;
  const el = document.createElement('pre');
  el.id = 'crash';
  el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;max-height:45%;overflow:auto;background:#300;color:#f88;font:12px monospace;padding:8px;border:1px solid #f66;z-index:20;white-space:pre-wrap';
  el.textContent = `CRASH\n${msg}`;
  document.body.appendChild(el);
}
addEventListener('error', (e) => crashOverlay(e.error?.stack || e.message));
addEventListener('unhandledrejection', (e) => crashOverlay(`unhandled rejection\n${e.reason?.stack || e.reason}`));

// A lost WebGL context is the classic MOBILE black screen: the page
// lives, the canvas goes permanently black, nothing throws. Surface
// it with a reload path (2026-08-14 - Mac's phone report; ingest
// memory pressure was the trigger, fixed in dataSource, but ANY
// cause must read as signal, never as silent black).
document.getElementById('c')?.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  crashOverlay('graphics context lost (usually memory pressure on phones)\n\ntap here to reload');
  document.getElementById('crash')?.addEventListener('click', () => location.reload());
});
addEventListener('unhandledrejection', (e) => crashOverlay(e.reason?.stack || String(e.reason)));
