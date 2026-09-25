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
import { retroFrameConfig } from './systems/retroMode.js';   // RETRO1: the renderer's retro source - the settings are read here, not in render/
import { renderScaleSetting } from './systems/renderScale.js';   // PERF-SCALE: the renderer's render-scale source, read the same way
import { windowEmissionRGB } from './render/windowEmission.js';
// BOOT1 (2026-09-20, Mac: "overall performance improvements"): THE GAME
// HOSTS ARE BEHIND A DOOR, NOT ON THE ENTRY. These four were static
// imports, and a static import of a host is the host's WHOLE graph at
// module-evaluation time: 623 files and 13.4 MB of source reached from
// this file before boot() ran a line - every scene, every system, every
// window - while the MENU the player actually sees first was the thing
// loaded dynamically (below). The boot graph was inverted. Measured over
// the build: 54 chunks, 1,349 KB gzipped, had to arrive before the entry
// finished evaluating, and the game's hosts were most of it.
//
// Each door is a dynamic import at the moment of use, with the SAME
// NAME and the SAME CALL SHAPE the routes below always used, so the
// routes - and the pins that hold them (classicstart, hard2s, macn) -
// read as before. The hosts carry no import-time side effects (nothing
// at their top level runs), so evaluating them later changes nothing
// but WHEN. test/boot1.test.js walks this file's static graph and holds
// that no host is on it, transitively - a pin on the regex alone would
// pass the day something else on the entry imported a host for us.
const bootExterior = (...a) => import('./scenes/exterior.js').then((m) => m.bootExterior(...a));
const bootInterior = (...a) => import('./scenes/interior.js').then((m) => m.bootInterior(...a));
const bootDungeon = (...a) => import('./scenes/dungeon.js').then((m) => m.bootDungeon(...a));
const bootWorld = (...a) => import('./scenes/world.js').then((m) => m.bootWorld(...a));

import { ensureArena2, getBytes } from './scenes/dataSource.js';
import { installCursor } from './ui/cursor.js';
import { mountFpsCounter } from './ui/fpsCounter.js';   // FPS1: the counter, over every host
import { setScreenshotCanvas } from './ui/screenshot.js';   // KB1: the PrintScreen action's canvas - the key itself is routed by the hosts (AUDIT KB1)
import { getPref } from './systems/uiPrefs.js';   // FPS1: its switch
import { publishBootParams, BOOT_DOOR_KEYS } from './systems/onlineLane.js';   // MAC-N3: the boot's params are the URL, or the online lane reads nothing
// The deployed site is redeployed several times a day and every deploy
// renames chunks, so a page held open across one is holding a map of a
// build that is gone. Recoverable, and the law of that is its own file.
import { staleChunkAction, RELOAD_KEY, STALE_CHUNK_TEXT } from './systems/staleChunk.js';

async function boot() {
  const canvas = document.getElementById('c');
  const renderer = new Renderer(canvas);
  renderer.setRetroSource(retroFrameConfig);   // RETRO1: DFU's retro mode - asked once per world frame, so the settings screen's change lands on the next
  renderer.setRenderScaleSource(renderScaleSetting);   // PERF-SCALE: the world's share of the window's pixels - asked once per world frame, and retro wins
  const params = new URLSearchParams(location.search);
  setScreenshotCanvas(canvas);   // KB1: once, beside the counter - the hosts' routeAction arm shoots it (AUDIT KB1: a window's F8 stays the window's)
  // AUDIT KB1 F3: the keybinding carry's report, told on the HUD the moment a scene can speak. Loaded OFF the entry's
  // static graph (BOOT2): the notice door reaches the box's whole import ring, and the input readers load with the
  // first scene anyway; the sink delivers whichever of it and the registry comes first (ui/input.js).
  Promise.all([import('./ui/input.js'), import('./systems/controlsConfig.js'), import('./systems/notify.js')])
    .then(([input, cfg, notify]) => input.setKeybindNoticeSink((report) => { for (const line of cfg.keybindCarryNotes(report)) notify.hudTextWhenShown(line, 12); }))
    .catch((err) => console.warn('[keybinds] the carry notice could not load:', err?.message ?? err));
  mountFpsCounter({ enabled: () => params.has('fps') || !!getPref('showFps'), stats: () => renderer.stats, info: () => renderer.frameInfo });   // FPS1: over every host, on the pref or the probe door; PERF3: with the renderer's counts; PERF-SCALE: and its GPU and frame size
  const status = (msg) => {
    document.title = `Daggerfall Enhanced - ${msg}`;
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
  // FD1 (2026-09-11, Mac: "Remove the classic Manager screen and instead
  // use the enhanced menu for both enhanced and classic"): ONE door for
  // BOTH skins. The enhanced screen carries continue, new game, load,
  // settings, controls, mods and about, and it needs no game data, so
  // a player who opens the page to change a setting is never asked for
  // a folder. Under the CLASSIC skin the rail collapses its three game
  // doors into BEGIN, which leads into the classic start sequence as
  // Daggerfall has it - the title, the opening film, and its own start
  // window (Load Game / Start New Game / Exit) - with the data gated in
  // front of it as always.
  //
  // The DFU setup wizard (the "launcher" that ShowOptionsAtStart used
  // to raise, `scenes/launcherScene.js` + `ui/settingsWindow.js`) is
  // GONE: its one job was reaching the settings before the game, and
  // Settings is now one press away on this door under either skin.
  // GUI/ShowOptionsAtStart is stored and written back, read by nothing.
  //
  // The TITLE and the SPLASH still do not run before this door: both
  // read ARENA2, and the door's whole point is that it opens before the
  // folder pick. Classic's Begin plays both.
  //
  // ?begin skips the door straight into the classic sequence - the
  // old bare-URL behaviour under ?skin=classic, kept for the probes
  // that pin classic geometry from the title on.
  let choice;
  if (params.has('begin')) choice = 'begin';
  else {
    // BOOT1: THE WARM-UP. Every door out of this menu ends in bootWorld,
    // so the world host's chunks start downloading NOW - behind the
    // cinematic and the menu, where a player is looking at something
    // else - and Play finds them in the cache instead of paying for them
    // at the click. It sits ABOVE the MAC-N3 trio below (delete, publish, import the menu) because that trio is pinned adjacent - the URL must be published before the menu reads it - and the warm-up has no part in that law. Not awaited: nothing here needs the host yet. The
    // catch is not optional: a deploy between page load and Play renames
    // every chunk (systems/staleChunk.js), and a warm-up that rejected
    // unhandled would be a console error for a failure the real import
    // at Play reports properly through the same law.
    import('./scenes/world.js').catch(() => {});
    // MAC-N3: the menu DECIDES these keys, so it must not read a stale
    // set off the URL a previous session published - the Mods pane
    // would show the online lock, and uiSkin the online skin, for a
    // player who has not chosen yet. Cleared off both copies here;
    // every door below sets or deletes each one again (F12's law).
    for (const k of BOOT_DOOR_KEYS) params.delete(k);
    publishBootParams(params);
    const { runEnhancedMenu } = await import('./ui/enhancedMenu.js');
    const { runCinematicFrontDoor } = await import('./ui/introScreen.js');
    // INTRO2: the cinematic and menu share ONE music session. The final
    // splash holds for the player's tap; opening the menu ducks the track,
    // choosing a game closes it before any in-game or classic video audio.
    status('introduction');
    const freeze = import.meta.env.DEV && params.has('introat') ? Number(params.get('introat')) : null;
    choice = await runCinematicFrontDoor(() => {
      status('main menu');
      return runEnhancedMenu();
    }, {
      // UXB1-A: the player's own Skip start video (uiPrefs skipStartVideo), beside the probes' one-visit ?nointro -
      // and only the player's skip keeps the menu's music, as the film's own Skip intro button does.
      skip: params.has('nointro') || !!getPref('skipStartVideo'),
      menuMusic: !params.has('nointro') && !!getPref('skipStartVideo'),
      debug: import.meta.env.DEV && params.has('introdebug'),
      freezeAt: freeze !== null && Number.isFinite(freeze) ? Math.max(0, freeze) : null,
    });
  }
  if (choice !== 'begin') {
    await ensureData();
    // AUDIT 19 F12's law, and it matters more here: SET on load,
    // DELETE on anything else. A URL that already carries ?load would
    // otherwise make New Game restore the save - the one action whose
    // whole point is not to.
    if (choice === 'continue' || choice === 'load' || choice === 'online') params.set('load', '1');   // ONLINE1: Online brings the most recent save in
    else params.delete('load');
    // ONLINE1 (AUDIT ONLINE E1): the world host joins the relay on this
    // flag (world.js), SET here and DELETED on every other door under
    // F12's law - the first cut wired it into the classic start window's
    // branch below, which never answers 'online', so PLAY ONLINE booted a
    // new character with no relay at all.
    if (choice === 'online') params.set('online', '1');
    else params.delete('online');
    // SLOTS1: the Load and Online panes pick a slot; the boot's load arm
    // reads the key (world.js, the SAV4 arm). The same SET-or-DELETE law.
    const { takePickedSaveKey } = await import('./ui/enhancedMenu.js');
    const picked = takePickedSaveKey();
    if ((choice === 'load' || choice === 'online') && picked != null) params.set('loadkey', String(picked));
    else params.delete('loadkey');
    // TR3: the Test Room door - the pane answers 'test:<preset>' and
    // the world host seeds the character and the armory off the same
    // testRoom home the pane showed. The param family follows F12's
    // law above: set on this choice, DELETED on every other, or a URL
    // that once entered the room would re-enter it on New Game.
    if (typeof choice === 'string' && choice.startsWith('test:')) params.set('test', choice.slice(5));
    else params.delete('test');
    // TSR4b (Mac: "it either places me in the dungeon or places me in
    // the ground"): the classic start is Privateer's Hold - a map cell
    // out of settings, and StartInDungeon puts a new character INSIDE
    // it - and the ride was booting there too, racing the dungeon
    // entry with an exterior landing. The ride is a SPAWN OUTDOORS, a
    // dev boot in the U31 sense: it keeps the named start (the city's
    // exterior) and never asks for the classic path. Every other menu
    // door still begins where Daggerfall begins.
    const { TEST_RIDE } = await import('./systems/testRoom.js');
    if (params.get('test') === TEST_RIDE.id) params.delete('classic');
    else params.set('classic', '1');
    // MAC-N3: THE DECIDED PARAMS ARE THE URL before the world boots.
    // `online` above was set on this in-memory copy alone, and the
    // online lane (systems/onlineLane.js isOnlinePage - the read under
    // uiSkin, getPref and modSetting) reads location.search: it never
    // saw a Play Online session, so the skin stayed the player's
    // stored choice and a Classic player had no chat.
    publishBootParams(params);
    return bootWorld(canvas, renderer, params, status);
  }
  // FD1: BEGIN - the classic start sequence, data first.
  await ensureData();
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
  // UXB1-A: and the player's Skip start video is enableVideos off for the start splash alone (the pref, uiPrefs.js).
  if (!params.has('novideo') && !getPref('skipStartVideo')) {
    try {
      const { playVideo } = await import('./ui/videoPlayer.js');
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
  params.delete('online');   // ONLINE1: the classic start window has no Online door; a stale flag does not ride in
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
  publishBootParams(params);   // MAC-N3: the same law on the classic door - the URL is what every location.search reader boots from
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

// BOOT1: NO DOCUMENT, NO BOOT. This entry loads in node now - the four
// hosts were the static imports that used to reject it at link time
// (world.js's import.meta.glob), and with those behind doors the body
// below RUNS under test/moduleload_smoke.test.js. boot() then reached
// for `document`, rejected, and its own catch reached for `document`
// again to report it - an unhandled rejection after the test ended,
// for a page that does not exist. A runtime with no document has
// nothing to boot: the chain starts from a resolved promise instead,
// and its `.then` (the reload flag, already optional-chained) is inert.
(typeof document === 'undefined' ? Promise.resolve() : boot()).then(() => {
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
// playtest reports pinpoint the throw. Returns the report's element.
function crashOverlay(msg) {
  const prior = document.getElementById('crash');
  if (prior) {
    // A SECOND crash used to be dropped on the floor. The frame loop
    // is dead after the first, but a later rejection is often the one
    // that names the cause - keep a count and the newest text.
    prior._count = (prior._count ?? 1) + 1;
    prior.textContent = `CRASH (${prior._count})\n${msg}`;
    return prior;
  }
  const el = document.createElement('pre');
  el.id = 'crash';
  el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;max-height:45%;overflow:auto;background:#300;color:#f88;font:12px monospace;padding:8px;border:1px solid #f66;z-index:20;white-space:pre-wrap;pointer-events:none';   // PL3: a report, not a wall - it sat over the bottom half of the canvas and ate every click that should have relocked the pointer
  el.textContent = `CRASH\n${msg}`;
  document.body.appendChild(el);
  return el;
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
  const el = crashOverlay('graphics context lost (usually memory pressure on phones)\n\ntap here to reload');
  // AUDIT 68 S02-contextlost-tap-dead: PL3 made the report click-through,
  // so the promised tap fell to the dead canvas. This one takes taps, and
  // by onclick - a second loss must not stack a second listener.
  el.style.pointerEvents = 'auto';
  el.onclick = () => location.reload();
});
