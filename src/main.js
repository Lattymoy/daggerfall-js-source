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

import { crashText } from './ui/crashText.js';   // the crash line, pinned in its own module
import { Renderer } from './render/renderer.js';
import { windowEmissionRGB } from './render/windowEmission.js';
import { bootExterior } from './scenes/exterior.js';
import { bootInterior } from './scenes/interior.js';
import { bootDungeon } from './scenes/dungeon.js';
import { bootWorld } from './scenes/world.js';

import { ensureArena2, getBytes } from './scenes/dataSource.js';
import { installCursor } from './ui/cursor.js';
import { getBool } from './systems/settings.js';   // SETT: the launcher gate
import { isEnhanced } from './systems/uiSkin.js';   // THE SKIN: which front door
// The deployed site is redeployed several times a day and every deploy
// renames chunks, so a page held open across one is holding a map of a
// build that is gone. Recoverable, and the law of that is its own file.
import { staleChunkAction, RELOAD_KEY, STALE_CHUNK_TEXT } from './systems/staleChunk.js';

async function boot() {
  const canvas = document.getElementById('c');
  const renderer = new Renderer(canvas);
  const params = new URLSearchParams(location.search);
  const status = (msg) => {
    document.title = `Daggerfall JavaScript - ${msg}`;
  };
  // Data gate: readers load user-supplied ARENA2 at runtime
  // (Port-Doctrine) - dev serves it via middleware, production asks
  // for the folder once and persists it in IndexedDB.
  //
  // IT IS A FUNCTION NOW, and idempotent, because THE ENHANCED FRONT
  // DOOR RUNS BEFORE IT. That screen needs no game data at all, so a
  // player who opens the page to change a setting, read the build or
  // check whether their save is still there is never asked for a
  // folder - which on a phone is a zip upload. The classic menu cannot
  // do this: it needs PICK03I0, a palette and FONT0003 before it can
  // draw one word, which is why the pick has always sat in front of
  // it. Every other path still gates first, exactly as before.
  let _data = null;
  const ensureData = () => (_data ??= (async () => {
    await ensureArena2();
    // The classic pointer for every surface (fire-and-forget; never traps).
    installCursor(getBytes);
  })());
  // M-EXT: ?music opens the replacement-music pick. It goes through
  // ensureData() FIRST and not around it: the picker needs the same
  // IndexedDB the ingest opens, and dropping a player who has never
  // chosen a game folder straight into a music picker would be asking
  // for the second thing before the first. Idempotent, so a path that
  // gates again below costs nothing.
  if (params.has('music') || params.has('textures')) {
    await ensureData();
    const ds = await import('./scenes/dataSource.js');
    // Both, when both are asked for - they are separate packs and a
    // player setting up for the first time wants one trip, not two.
    if (params.has('music')) await ds.pickMusicFolder();
    if (params.has('textures')) await ds.pickTextureFolder();
  }
  // Window emission style for every scene. DFU's GetMaterial default is Day.
  renderer.setWindowEmission(windowEmissionRGB(params.get('window') || 'day'));
  if (params.has('interior')) { await ensureData(); return bootInterior(canvas, renderer, params, status); }
  if (params.has('dungeon')) { await ensureData(); return bootDungeon(canvas, renderer, params, status); }
  if (params.has('world')) { await ensureData(); return bootWorld(canvas, renderer, params, status); }
  if (params.has('exterior') || params.has('region') || params.has('loc')) { await ensureData(); return bootExterior(canvas, renderer, params, status); }
  // U21: the bare URL is THE MAIN MENU, and the menu hands off to the
  // classic start (Privateer's Hold + chargen) that used to run here
  // directly. Dev scenes stay one param away (?exterior/?world/etc).
  //
  // ?shot BYPASSES the menu: it is the fixed-vantage test path that
  // tools/screenshot.mjs and the 25 probes in tools/ drive, and a menu
  // in front of it would block every one of them. ?nomenu is the same
  // escape hatch for a human.
  if (params.has('shot') || params.has('nomenu')) { await ensureData(); return bootDungeon(canvas, renderer, params, status); }

  // ── THE FRONT DOOR ─────────────────────────────────────────────
  // ENHANCED IS THE DEFAULT (systems/uiSkin.js; ?skin=classic or the
  // toggle in either screen chooses otherwise). One screen carrying
  // continue, new game, load, settings, mods and about - which is the
  // classic path's title, launcher, splash and start window collapsed
  // into a single place with a way back to it from inside the game.
  //
  // The three the enhanced door deliberately does NOT run, each
  // because the enhanced screen already answers what it was for:
  //   - the LAUNCHER (ShowOptionsAtStart). DFU shows its wizard every
  //     launch because settings are otherwise unreachable; here they
  //     are one press away, so a screen in front of the menu would be
  //     a screen in front of the menu.
  //   - the TITLE and the SPLASH. Both read ARENA2, and the whole
  //     point of this door is that it opens before the folder pick.
  //     Recorded as a real loss rather than dropped quietly: ?skin=
  //     classic still plays both, and giving the enhanced door its own
  //     title moment is its own slice.
  if (isEnhanced()) {
    const { runEnhancedMenu } = await import('./ui/enhancedMenu.js');
    // The enhanced door opens ON the menu. An intro cinematic lived
    // here (U65-U65e) and was RIPPED OUT at Mac's direction on
    // 2026-08-30 after five versions failed his eye; the history
    // carries all of it if it is ever wanted back.
    status('main menu');
    const choice = await runEnhancedMenu();
    await ensureData();
    // AUDIT 19 F12's law, and it matters more here: SET on load,
    // DELETE on anything else. A URL that already carries ?load would
    // otherwise make New Game restore the save - the one action whose
    // whole point is not to.
    if (choice === 'continue' || choice === 'load') params.set('load', '1');
    else params.delete('load');
    params.set('classic', '1');
    return bootWorld(canvas, renderer, params, status);
  }
  await ensureData();
  // SETT: THE LAUNCHER, before everything - DFU's setup wizard is the
  // first screen of a DFU session, and its gate is verbatim here:
  // SceneControl.cs:46 shows the wizard when the path is unvalidated
  // OR ShowOptionsAtStart is set OR any key is held, and the wizard
  // itself (:154) skips straight to the OPTIONS stage when the path is
  // already good. Our GameFolder stage is the ARENA2 pick, which has
  // already run by now (getBytes above), so a launch that gets here
  // has a validated path - which leaves ShowOptionsAtStart (DFU ships
  // it TRUE, which is why you see the wizard every launch until you
  // turn it off) and ?launcher as the held-key analogue.
  //
  // ?shot/?nomenu return above, so no probe in tools/ reaches this.
  if (params.has('launcher') || getBool('GUI', 'ShowOptionsAtStart')) {
    const { runLauncher } = await import('./scenes/launcherScene.js');
    status('settings');
    await runLauncher(canvas, renderer, status);
  }

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
      //
      // NOT awaited: audio.ensure creates the context in its synchronous
      // prefix, which is all the splash needs - awaiting the whole call
      // parked the splash on black while DAGGER.SND and MIDI.BSA read in
      // (DFU's splash plays immediately). The archives keep loading
      // underneath; every later consumer awaits its own ensure.
      ensureAudio(getBytes);
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
  // SAV4: the slot the start menu's save window picked, when it
  // picked one - the boot's load arm reads it. Same SET-or-DELETE law.
  const { takePickedLoadKey } = await import('./scenes/menu.js');
  const pickedKey = takePickedLoadKey();
  if (action === 'load' && pickedKey != null) params.set('loadkey', String(pickedKey));
  else params.delete('loadkey');
  // SAV3: a picked classic save boots the world's import arm. Same
  // SET-or-DELETE law as `load` - a stale ?classicload with no pending
  // SaveGames is a no-op in the world host, but it never survives a
  // non-classicload action either.
  if (action === 'classicload') params.set('classicload', '1');
  else params.delete('classicload');
  // U31: THE CLASSIC START IS THE WORLD, not the standalone dungeon
  // scene. scenes/dungeon.js has no exit path at all - its only
  // activation arm is ctx.actions.activate - so booting it left
  // Privateer's Hold a sealed box with no way back to Tamriel. The
  // world host owns both modes and the tested dungeon->exterior
  // transition (worldModes.tryExitDungeon), so the classic start goes
  // there and ?classic tells it to read StartCellX/StartCellY and
  // StartInDungeon, exactly as StartGameBehaviour does.
  params.set('classic', '1');
  return bootWorld(canvas, renderer, params, status);
}

/** sessionStorage throws OUTRIGHT in some privacy modes rather than
 *  answering null, and a storage failure must never become the boot
 *  failure - so every touch is shielded the way settings.js and
 *  inputActions.js shield theirs. No memory means NO free reload,
 *  which is the safe way to be wrong: a page that cannot remember it
 *  already tried is a page that would reload forever. */
const reloadTried = () => {
  try { return !!globalThis.sessionStorage?.getItem(RELOAD_KEY); } catch { return true; }
};
const rememberReload = () => {
  try { globalThis.sessionStorage.setItem(RELOAD_KEY, '1'); return true; } catch { return false; }
};

boot().then(() => {
  // A boot that WORKED gives the next one its reload back. Without
  // this the flag outlives the problem: a player who recovers once
  // would face the dead page on the next deploy with the retry
  // already spent.
  try { globalThis.sessionStorage?.removeItem(RELOAD_KEY); } catch { /* nothing to forget */ }
}).catch((e) => {
  // THE BUILD MOVED WHILE THE PAGE WAS OPEN (systems/staleChunk.js).
  // The page is holding a map of a build that is gone; the current one
  // is one fetch away, so this is recoverable rather than fatal.
  const act = staleChunkAction(e, { reloaded: reloadTried() });
  if (act === 'reload' && rememberReload()) {
    console.warn('[boot] a chunk of this build is gone - reloading onto the current one', e);
    location.reload();
    return;
  }
  document.body.textContent = act === 'rethrow' ? `boot failed: ${e.message}` : STALE_CHUNK_TEXT;
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
  const prior = document.getElementById('crash');
  if (prior) {
    // A SECOND crash used to be dropped on the floor. The frame loop
    // is dead after the first, but a later rejection is often the one
    // that names the cause - keep a count and the newest text.
    prior._count = (prior._count ?? 1) + 1;
    prior.textContent = `CRASH (${prior._count})\n${msg}`;
    return;
  }
  const el = document.createElement('pre');
  el.id = 'crash';
  el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;max-height:45%;overflow:auto;background:#300;color:#f88;font:12px monospace;padding:8px;border:1px solid #f66;z-index:20;white-space:pre-wrap';
  el.textContent = `CRASH\n${msg}`;
  document.body.appendChild(el);
}

addEventListener('error', (e) => crashOverlay(crashText(e.error, e) || e.message));
addEventListener('unhandledrejection', (e) => crashOverlay(`unhandled rejection\n${crashText(e.reason)}`));

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
