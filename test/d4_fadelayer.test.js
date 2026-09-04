// D4 - THE FADE LAYER (FadeBehaviour.cs) and the two windows that had
// been idling on it: DaggerfallTravelPopUp's smash/fade either side of
// the countdown and DaggerfallTeleportPopUp's either side of the jump,
// plus EXIT's key-UP deferral, which needed the overlay seam's missing
// edge rather than a new input stack.
//
// Everything here is CI-checkable: FadeBehaviour reads no asset and no
// table, the two windows are pure objects, and the host wiring is
// pinned by reading the sources the way this suite's other seam pins
// do (a call whose ORDER is the law cannot be proven by calling it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FadeBehaviour, hudFade, FADE_STEP, DEFAULT_FADE_DURATION, FADE_BLACK, FADE_CLEAR,
} from '../src/ui/fadeLayer.js';
import { HudFlickerController } from '../src/ui/hudFlicker.js';
import { TravelPopUpWindow } from '../src/ui/travelPopUp.js';
import { TeleportPopUpWindow } from '../src/ui/teleportPopUp.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');

test('D4: the five entry points are FadeBehaviour\'s, constants and all', () => {
  assert.equal(FADE_STEP, 0.02, 'TickFade\'s `const float fadeStep` (:99)');
  assert.equal(DEFAULT_FADE_DURATION, 0.5, 'FadeHUDToBlack/FromBlack\'s default argument');
  assert.deepEqual([...FADE_BLACK], [0, 0, 0, 1]);
  assert.deepEqual([...FADE_CLEAR], [0, 0, 0, 0]);

  const f = new FadeBehaviour();
  assert.equal(f.allowFade, true, ':22 - DFU\'s field initialiser');
  assert.equal(f.fadeInProgress, false);
  assert.deepEqual(f.backgroundColor, [0, 0, 0, 0]);

  // SmashHUDToBlack (:54-60): the colour, and NOTHING else - no
  // fadeInProgress, no timers. A port that "helpfully" also stopped a
  // running fade would diverge on the one path DFU leaves ragged.
  f.smashHUDToBlack();
  assert.deepEqual(f.backgroundColor, [0, 0, 0, 1]);
  assert.equal(f.fadeInProgress, false);

  // FadeHUDFromBlack (:74-84): start black, end clear, panel set to
  // BLACK immediately so the first drawn frame is already covered.
  f.fadeHUDFromBlack();
  assert.deepEqual(f.backgroundColor, [0, 0, 0, 1]);
  assert.equal(f.fadeInProgress, true);
  assert.equal(f.fadeDuration, 0.5);

  // FadeHUDToBlack (:62-72) is the mirror, and it CLEARS the panel on
  // the way in - the fade to black starts from transparent.
  f.fadeHUDToBlack(1.0);
  assert.deepEqual(f.backgroundColor, [0, 0, 0, 0]);
  assert.equal(f.fadeDuration, 1.0);
  assert.equal(f.fadeInProgress, true);

  // ClearFade (:86-95) zeroes the timers and the flag - and leaves
  // fadeDuration and the endpoints exactly where they were.
  f.fadeTotalTime = 0.3; f.fadeTimer = 0.01;
  f.clearFade();
  assert.deepEqual(f.backgroundColor, [0, 0, 0, 0]);
  assert.equal(f.fadeInProgress, false);
  assert.equal(f.fadeTimer, 0);
  assert.equal(f.fadeTotalTime, 0);
  assert.equal(f.fadeDuration, 1.0, 'ClearFade does not touch fadeDuration');
});

test('D4: TickFade steps by a CONSTANT 0.02, not by the elapsed time', () => {
  // This is the quirk, and it is visible: at 60 fps (dt 1/60) the
  // accumulator needs two frames to pass 0.02 and then advances the
  // fade by 0.02 - 0.6 units of progress per real second, so DFU's
  // half-second fade runs for about five sixths of one.
  const f = new FadeBehaviour();
  f.fadeHUDFromBlack();          // black -> clear over 0.5
  const dt = 1 / 60;
  f.tickFade(dt);
  assert.deepEqual(f.backgroundColor, [0, 0, 0, 1], 'one 60fps frame does not pass the step');
  f.tickFade(dt);
  // fadeTotalTime is now 0.02; progress 0.04; alpha 1 -> 0.96.
  assert.equal(f.fadeTotalTime, 0.02);
  assert.ok(Math.abs(f.backgroundColor[3] - 0.96) < 1e-9, `alpha ${f.backgroundColor[3]}`);

  // Run it to the end and count the REAL seconds it took.
  let elapsed = 2 * dt;
  while (f.fadeInProgress && elapsed < 5) { f.tickFade(dt); elapsed += dt; }
  assert.equal(f.fadeInProgress, false);
  assert.deepEqual(f.backgroundColor, [0, 0, 0, 0], 'completion assigns fadeEndColor exactly');
  assert.ok(elapsed > 0.5 + 0.2 && elapsed < 1.0,
    `a "0.5s" fade takes about 0.83 real seconds at 60fps, got ${elapsed}`);

  // Completion is `fadeTotalTime > fadeDuration`, STRICTLY - a step
  // that lands exactly on the duration keeps the fade alive one more.
  const g = new FadeBehaviour();
  g.fadeHUDToBlack(0.04);
  g.tickFade(0.03); g.tickFade(0.03);
  assert.equal(g.fadeTotalTime, 0.04);
  assert.equal(g.fadeInProgress, true, '0.04 is not > 0.04');
  g.tickFade(0.03);
  assert.equal(g.fadeInProgress, false);
  assert.deepEqual(g.backgroundColor, [0, 0, 0, 1]);
});

test('D4: allowFade and a null target panel gate all five, including the tick', () => {
  const f = new FadeBehaviour();
  f.allowFade = false;
  f.smashHUDToBlack();
  assert.deepEqual(f.backgroundColor, [0, 0, 0, 0]);
  f.fadeHUDFromBlack();
  assert.equal(f.fadeInProgress, false);

  // TickFade tests all three of target, fadeInProgress and allowFade
  // (:101-102), so a fade started and then disallowed FREEZES rather
  // than finishing.
  const g = new FadeBehaviour();
  g.fadeHUDFromBlack();
  g.allowFade = false;
  for (let i = 0; i < 200; i++) g.tickFade(0.03);
  assert.equal(g.fadeInProgress, true, 'frozen mid-fade, not completed');
  assert.deepEqual(g.backgroundColor, [0, 0, 0, 1]);

  const h = new FadeBehaviour();
  h.hasTarget = false;           // fadeTargetPanel == null
  h.smashHUDToBlack();
  h.fadeHUDToBlack();
  h.clearFade();
  assert.deepEqual(h.backgroundColor, [0, 0, 0, 0]);
  assert.equal(h.fadeInProgress, false);
});

test('D4: the HUD parent panel is ONE colour with TWO writers', () => {
  // FadeBehaviour targets dfHUD.ParentPanel (DaggerfallUI.cs:409) and
  // HUDFlickerController is a component OF that panel
  // (DaggerfallHUD.cs:163) whose NextCycle assigns
  // Parent.BackgroundColor. The two gates at HUDFlickerController.cs
  // :46-47 are what keeps them from fighting - "prevents conflict with
  // fade in from black" - and they had no reader until this slice.
  const c = new HudFlickerController();
  const never = () => 1;
  // A healthy player's Normal arm answers clear... but not while the
  // panel is black: parentAlpha > 0.9 returns before the switch.
  assert.equal(c.nextCycle({
    health: 100, maxHealth: 100, dt: 0.02, parentAlpha: 1, rolls: never,
  }), null, 'a smashed-to-black panel is not cleared by a healthy frame');
  assert.equal(c.nextCycle({
    health: 100, maxHealth: 100, dt: 0.02, fadeInProgress: true, parentAlpha: 0.5, rolls: never,
  }), null, 'nor is a panel mid-fade');
  // 0.9 exactly is NOT above 0.9 - the gate is strict, so the last
  // ninth of a fade from black is writable again.
  assert.deepEqual(c.nextCycle({
    health: 100, maxHealth: 100, dt: 0.02, parentAlpha: 0.9, rolls: never,
  }), [0, 0, 0, 0]);

  // ...and ui/hud.js actually feeds both from the fade layer, in DFU's
  // order: tick the fade, let the flicker overwrite, draw once.
  const hud = src('ui/hud.js');
  assert.match(hud, /import \{ hudFade \} from '\.\/fadeLayer\.js'/);
  const tick = hud.indexOf('hudFade.tickFade(dt);');
  const cycle = hud.indexOf('_flicker.nextCycle({');
  const write = hud.indexOf('if (c) hudFade.backgroundColor = c;');
  const draw = hud.indexOf('return hudFade.draw(renderer, canvas);');
  assert.ok(tick > 0 && cycle > tick && write > cycle && draw > write,
    'TickFade, then NextCycle, then the one panel draw');
  assert.match(hud, /fadeInProgress: hudFade\.fadeInProgress,/);
  assert.match(hud, /parentAlpha: hudFade\.backgroundColor\[3\],/);
  // The flicker no longer owns a quad of its own: one panel, one draw.
  const flick = hud.slice(cycle, draw);
  assert.equal(/drawScreenQuad/.test(flick), false,
    'the tint is written INTO the panel, not painted beside it');
});

test('D4: the fade panel draws over the world and under the HUD elements', () => {
  // A Panel paints its BackgroundColor and then its children, and the
  // fade's panel is the HUD's PARENT - so the black hides the world
  // and the vitals stay legible on it. In this port that is one quad
  // at the top of drawHud, which is the one call all four hosts make
  // last, over the viewmodel.
  const quads = [];
  const renderer = { drawScreenQuad: (tex, rect, uv, color) => quads.push({ rect, color }) };
  const canvas = { width: 640, height: 400 };
  const f = new FadeBehaviour();
  assert.equal(f.draw(renderer, canvas), false, 'a clear panel draws nothing');
  assert.equal(quads.length, 0);
  f.smashHUDToBlack();
  assert.equal(f.draw(renderer, canvas), true);
  assert.deepEqual(quads[0].rect, { x: 0, y: 0, w: 640, h: 400 });
  assert.deepEqual(quads[0].color, [0, 0, 0, 1]);
});

test('D4: the travel popup smashes to black on the frame the countdown empties', () => {
  // Update (:229-246): while countdownValueTravelTimeDays > 0 it
  // ticks; on the frame it is zero it drops doFastTravel,
  // SmashHUDToBlack, and only THEN performFastTravel.
  hudFade.clearFade();
  const w = new TravelPopUpWindow({ x: 10, y: 0 }, {
    getPlayerPixel: () => ({ x: 10, y: 0 }),
    getClimateIndex: () => 231,
    gold: () => 100000, goldPieces: () => 100000,
    onTravel: () => { w._arrived = true; },
  });
  w.countdownValueTravelTimeDays = 2;
  w.doFastTravel = true;
  assert.deepEqual(hudFade.backgroundColor, [0, 0, 0, 0]);
  w.tick(0.06); w.tick(0.06);
  assert.equal(w.countdownValueTravelTimeDays, 0);
  assert.deepEqual(hudFade.backgroundColor, [0, 0, 0, 0],
    'the days tick down on a normal screen');
  assert.equal(w._arrived, undefined);
  w.tick(0.06);
  assert.equal(w._arrived, true);
  assert.deepEqual(hudFade.backgroundColor, [0, 0, 0, 1],
    'black BEFORE performFastTravel, which is what the smash exists to hide');
  hudFade.clearFade();

  // The other half is the host's, because performFastTravel's order is
  // (:381, after RaiseSkills).
  const world = src('scenes/world.js');
  const raise = world.indexOf('\n      raisePlayerSkills(playerEntity, {');
  const fade = world.indexOf('hudFade.fadeHUDFromBlack();', raise);
  assert.ok(raise > 0 && fade > raise, 'the fade from black is performFastTravel\'s tail');
});

test('D4: the teleport popup smashes to black as TeleportAway\'s first statement', () => {
  hudFade.clearFade();
  const seen = [];
  const w = new TeleportPopUpWindow({ pixel: { x: 3, y: 4 }, name: 'Sentinel' }, {
    onTeleport: () => { seen.push([...hudFade.backgroundColor]); },
  });
  w.input('KeyY');
  assert.deepEqual(seen, [[0, 0, 0, 1]],
    'the screen is already black when the destination reaches the host (:137)');

  // NO answers nothing: the map underneath is still live and there is
  // no transition to hide.
  hudFade.clearFade();
  const { 0: n } = [new TeleportPopUpWindow({ pixel: null, name: '' }, {})];
  n.input('KeyN');
  assert.deepEqual(hudFade.backgroundColor, [0, 0, 0, 0]);

  const world = src('scenes/world.js');
  const tp = world.indexOf('async function teleportTo(pick)');
  assert.ok(tp > 0);
  const fade = world.indexOf('hudFade.fadeHUDFromBlack();', tp);
  const end = world.indexOf('_teleporting = false;', tp);
  assert.ok(fade > tp && fade < end, 'TeleportAway\'s :150 is the arrival\'s last act');
});

test('D4: EXIT plays its click on the press and pops the window on the RELEASE', () => {
  // ExitButton_OnKeyboardEvent (:482-495). A DFU Button with a
  // keyboard handler hears both edges (Button.cs:79-92); this one
  // arms isCloseWindowDeferred on KeyDown and closes on KeyUp.
  const mk = () => {
    const log = { exits: 0 };
    const w = new TravelPopUpWindow({ x: 10, y: 0 }, {
      getPlayerPixel: () => ({ x: 10, y: 0 }),
      getClimateIndex: () => 231,
      gold: () => 100000, goldPieces: () => 100000,
      onExit: () => { log.exits++; },
    });
    return { w, log };
  };
  const { w, log } = mk();
  w.input('KeyE');
  assert.equal(w.isCloseWindowDeferred, true);
  assert.equal(w.done, false, 'holding E keeps the popup open');
  assert.equal(log.exits, 0);
  w.keyup('KeyE');
  assert.equal(w.isCloseWindowDeferred, false);
  assert.equal(w.done, true);
  assert.equal(log.exits, 1);

  // A release with nothing armed does nothing - `&& isCloseWindowDeferred`.
  const b = mk();
  b.w.keyup('KeyE');
  assert.equal(b.w.done, false);
  assert.equal(b.log.exits, 0);

  // Any other key's release is not EXIT's.
  const c = mk();
  c.w.input('KeyE');
  c.w.keyup('KeyB');
  assert.equal(c.w.done, false, 'B up is not E up');
  c.w.keyup('KeyE');
  assert.equal(c.w.done, true);

  // The MOUSE and Escape paths are unchanged and immediate -
  // ExitButtonOnClickHandler and CancelWindow both act at once.
  const d = mk();
  d.w.input('Escape');
  assert.equal(d.w.done, true);
  assert.equal(d.log.exits, 1);

  // The three TOGGLES subscribe keyboard handlers too but act on
  // KeyDown only (:504-508, :524-528, :544-548), and BEGIN subscribes
  // none at all - so neither defers.
  const e = mk();
  assert.equal(e.w.speedCautious, true);
  e.w.input('KeyS');
  assert.equal(e.w.speedCautious, false, 'S flips on the press');
  e.w.keyup('KeyS');
  assert.equal(e.w.speedCautious, false, 'and the release is not a second flip');
});

test('D4: the overlay seam carries the key-up edge the hosts already bind', () => {
  const tt = src('scenes/townTalk.js');
  assert.match(tt, /function keyup\(e\) \{/, 'townTalk exposes the edge');
  assert.match(tt, /\n    keydown, keyup, tryActivate, frame,/, 'and hands it to the hosts');
  // OPTIONAL on the window: nearly every DFU button subscribes no
  // keyboard handler at all, so a window without `keyup` must still
  // swallow the event rather than throw on it.
  assert.match(tt, /if \(typeof overlay\.keyup !== 'function'\) return true;/);
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    assert.match(src(host), /addEventListener\('keyup'[^\n]*townTalk\.keyup\(e\);/,
      `${host} forwards the edge it has always bound`);
  }
  // ...and the travel map routes it to whichever sub-window has the
  // keyboard, exactly as `input` does.
  const map = src('ui/travelMapWindow.js');
  assert.match(map, /keyup\(code, e = null\) \{/);
  assert.match(map, /this\.popUp\.keyup\?\.\(code, e\);/);
  assert.match(map, /this\.telePopUp\.keyup\?\.\(code, e\);/);
});

test('D4: PushWindow clears an in-flight fade - and a SMASH survives it', () => {
  // UserInterfaceManager.cs:86-89. The gate is the CALLER's, and it
  // matters: ClearFade sets the panel clear unconditionally, so a push
  // made while the screen is smashed to black (which raises no
  // fadeInProgress) must not reach it - the level-up box the fast
  // travel arrival can raise is pushed BEFORE performFastTravel's fade.
  const tt = src('scenes/townTalk.js');
  const guarded = [...tt.matchAll(/hudFade\.clearFade\(\)/g)];
  assert.equal(guarded.length, 2, 'both doors into the slot are PushWindow');
  for (const m of guarded) {
    assert.ok(tt.slice(Math.max(0, m.index - 40), m.index).includes('hudFade.fadeInProgress'),
      'every clear is behind PushWindow\'s own FadeInProgress gate');
  }
  const f = new FadeBehaviour();
  f.smashHUDToBlack();
  if (f.fadeInProgress) f.clearFade();
  assert.deepEqual(f.backgroundColor, [0, 0, 0, 1], 'the smash is not a fade and survives');
  f.fadeHUDFromBlack();
  if (f.fadeInProgress) f.clearFade();
  assert.deepEqual(f.backgroundColor, [0, 0, 0, 0], 'the fade is stopped and the panel cleared');
});
