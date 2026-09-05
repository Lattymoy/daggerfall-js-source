// U45 - HUDLARGE, the classic bottom status bar. Geometry, the eleven
// panels, the two disagreeing mode cycles, and the wiring in all four
// hosts. Everything pinned here was mutation-proven.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LARGE_HUD_W, LARGE_HUD_H, COMPASS_FRAME_COUNT, LARGE_HUD_RECTS, MODE_SUBRECT,
  HUD_MODE_CYCLE, hudLargeNextMode, hudLargePrevMode, LARGE_HUD_PANELS,
  largeHudRect, compassFrameIndex, largeHudPoint, largeHudPanelAt, largeHudClick,
  headArchiveFor, horseOffsetHeight, weaponOffsetHeight,
  dockedLargeHudHeight, largeHudViewportRect, largeHudWorldAspect, STANDARD_VIEWPORT_RECT,   // ROAD-E E5
} from '../src/ui/hudLarge.js';
import { crosshairCentreY, drawCrosshairAndModeIcon } from '../src/ui/hudCrosshair.js';   // ROAD-E E5
import { Renderer } from '../src/render/renderer.js';   // ROAD-E E5: the viewport is the renderer's own frame state
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { ridingRect } from '../src/systems/riding.js';
import { MODES, nextInteractionMode } from '../src/player/interactionMode.js';
import { routeAction } from '../src/ui/input.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const canvas = (w, h) => ({ width: w, height: h });

// ---------------------------------------------------------------
// 1. THE RECTS
// ---------------------------------------------------------------

test('hudLarge: every rect is inside the 320x46 bar, and the eleven panels are DISJOINT', () => {
  assert.equal(LARGE_HUD_W, 320);
  assert.equal(LARGE_HUD_H, 46);
  for (const [key, [x, y, w, h]] of Object.entries(LARGE_HUD_RECTS)) {
    assert.ok(x >= 0 && y >= 0, `${key} starts inside the bar`);
    assert.ok(x + w <= LARGE_HUD_W, `${key} ends inside the bar horizontally`);
    assert.ok(y + h <= LARGE_HUD_H, `${key} ends inside the bar vertically`);
  }
  // DFU hit-tests its Components in order; nothing here overlaps, so
  // that order cannot matter and neither can this port's loop. Proven
  // rather than assumed - a mistyped rect that straddled two panels
  // would make one of them unreachable in DFU and silently reachable
  // here.
  for (const a of LARGE_HUD_PANELS) {
    for (const b of LARGE_HUD_PANELS) {
      if (a === b) continue;
      const [ax, ay, aw, ah] = a.rect, [bx, by, bw, bh] = b.rect;
      const overlap = ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
      assert.equal(overlap, false, `${a.key} and ${b.key} overlap`);
    }
  }
  // The head and the three vitals sit INSIDE the colour background,
  // which is not a panel and takes no clicks - so the head is
  // clickable and the bars beside it are not.
  const [cx, cy, cw, ch] = LARGE_HUD_RECTS.mainColorBackground;
  for (const key of ['head', 'health', 'fatigue', 'magicka']) {
    const [x, y, w, h] = LARGE_HUD_RECTS[key];
    assert.ok(x >= cx && y >= cy && x + w <= cx + cw && y + h <= cy + ch, `${key} sits on the colour field`);
  }
  assert.ok(LARGE_HUD_PANELS.some((p) => p.key === 'head'));
  assert.equal(LARGE_HUD_PANELS.some((p) => p.key === 'health'), false, 'the vitals are not buttons');
});

test('hudLarge: the four mode icons tile the 47x92 sheet exactly, in the ENUM order', () => {
  // ImageReader.GetSubTexture over nativeInteractionModesTextureSize
  // (:56). The port's fourth mode is 'dialogue' where DFU says Talk,
  // and its slice is the SECOND row - the enum's order, not the
  // panel's cycle.
  const rows = ['steal', 'dialogue', 'grab', 'info'].map((m) => MODE_SUBRECT[m]);
  assert.deepEqual(rows, [[0, 0, 47, 23], [0, 23, 47, 23], [0, 46, 47, 23], [0, 69, 47, 23]]);
  assert.equal(rows.length * 23, 92, 'four 23px rows are the whole sheet');
  for (const m of MODES) assert.ok(MODE_SUBRECT[m], `${m} has a slice`);
  assert.equal(Object.keys(MODE_SUBRECT).length, MODES.length);
  // and the icon panel is exactly one slice tall
  assert.deepEqual(LARGE_HUD_RECTS.interactionMode.slice(2), [47, 23]);
});

// ---------------------------------------------------------------
// 2. THE TWO CYCLES, WHICH DISAGREE
// ---------------------------------------------------------------

test('hudLarge: the PANEL cycle is not the KEYBOARD cycle - a real DFU divergence', () => {
  // PlayerActivate.NextInteractionMode (:1431-1453) walks the enum:
  // Steal > Grab > Info > Talk. The panel (:398-414) walks
  // Steal > TALK > GRAB > Info. Same four modes, different order, in
  // the same build - so a player who clicks the bar and a player who
  // presses the key are not moving through the same sequence.
  assert.deepEqual(HUD_MODE_CYCLE, ['steal', 'dialogue', 'grab', 'info']);
  assert.deepEqual(MODES, ['steal', 'grab', 'info', 'dialogue']);
  assert.notDeepEqual(HUD_MODE_CYCLE, MODES);
  assert.equal(hudLargeNextMode('steal'), 'dialogue');
  assert.equal(nextInteractionMode('steal'), 'grab', 'and the keyboard disagrees at the very first step');
  // MUTATION: reusing nextInteractionMode for the panel passes any
  // "it cycles" pin and fails this one.

  // the right click is the EXACT inverse of the left (:417-438)
  for (const m of MODES) {
    assert.equal(hudLargePrevMode(hudLargeNextMode(m)), m, `${m} round-trips`);
    assert.equal(hudLargeNextMode(hudLargePrevMode(m)), m);
  }
  assert.equal(hudLargePrevMode('steal'), 'info');
  assert.equal(hudLargePrevMode('dialogue'), 'steal');
  // four steps forward is a full lap, from anywhere
  for (const m of MODES) {
    let x = m;
    for (let i = 0; i < 4; i++) x = hudLargeNextMode(x);
    assert.equal(x, m);
  }
});

// ---------------------------------------------------------------
// 3. WHERE THE BAR LANDS
// ---------------------------------------------------------------

test('hudLarge: DOCKED is the full screen width, flush to the bottom, in proportion', () => {
  // AutoSizeModes.ScaleToFit's arithmetic collapses to
  // parentWidth/size.x on any landscape screen - see the module.
  const b = largeHudRect(canvas(1280, 720), { docked: true });
  assert.equal(b.x, 0);
  assert.equal(b.w, 1280);
  assert.equal(b.s, 4);
  assert.equal(b.h, 46 * 4);
  assert.equal(b.y + b.h, 720, 'flush to the bottom edge');
  // the proportion holds at any width, including a non-integer scale
  const c = largeHudRect(canvas(1000, 700), { docked: true });
  assert.equal(c.w / c.h, LARGE_HUD_W / LARGE_HUD_H);
  // MUTATION: an integer-floored scale (the small HUD's hudScale)
  // leaves a gap at the right edge and this fails.
});

test('hudLarge: UNDOCKED is native scale x LargeHUDUndockedScale, aligned, and None means Centre', () => {
  const opts = { docked: false, undockedScale: 0.75 };
  const centre = largeHudRect(canvas(1280, 720), { ...opts, alignment: 0 });
  assert.equal(centre.s, 3 * 0.75);
  assert.equal(centre.w, 320 * 3 * 0.75);
  assert.equal(centre.y + centre.h, 720);
  // :227-229 forces HorizontalAlignment.None to Center, so 0 and 2 are
  // the same bar in the same place.
  assert.deepEqual(largeHudRect(canvas(1280, 720), { ...opts, alignment: 2 }), centre);
  assert.equal(largeHudRect(canvas(1280, 720), { ...opts, alignment: 1 }).x, 0, 'Left');
  const right = largeHudRect(canvas(1280, 720), { ...opts, alignment: 3 });
  assert.equal(right.x + right.w, 1280, 'Right');
  assert.ok(centre.w < 1280, 'and undocked really is narrower than the screen');
});

// ---------------------------------------------------------------
// 4. THE COMPASS
// ---------------------------------------------------------------

test('hudLarge: the compass frame is truncated, and a full turn never indexes past the last', () => {
  assert.equal(COMPASS_FRAME_COUNT, 32);
  assert.equal(compassFrameIndex(0), 0);
  assert.equal(compassFrameIndex(0.5), 16);
  assert.equal(compassFrameIndex(31 / 32), 31);
  // C#'s `(int)` cast is truncation, so anything short of the next
  // thirty-second stays put.
  assert.equal(compassFrameIndex(0.999), 31);
  // A heading of exactly 1.0 is 0 degrees again, and DFU's own read
  // (eulerAngles.y is [0,360)) can never produce it - the port wraps
  // first, the way its small-HUD compassScroll already does with the
  // same input, so the array is never indexed at 32.
  assert.equal(compassFrameIndex(1), 0);
  assert.equal(compassFrameIndex(-0.25), 24, 'and a negative heading wraps rather than going below zero');
  for (let i = 0; i <= 400; i++) {
    const f = compassFrameIndex(i / 400);
    assert.ok(f >= 0 && f < COMPASS_FRAME_COUNT, `heading ${i}/400 -> ${f}`);
  }
  // MUTATION: dropping the wrap makes compassFrameIndex(1) answer 32,
  // which reads one past the end of a 32-entry array.
});

// ---------------------------------------------------------------
// 5. THE CLICK
// ---------------------------------------------------------------

test('hudLarge: a click maps through the bar rect to the panel under it', () => {
  const bar = largeHudRect(canvas(320, 200), { docked: true });   // s = 1, y = 154
  assert.equal(bar.s, 1);
  const hit = (x, y, b = 0) => largeHudClick(bar, x, bar.y + y, b);
  assert.equal(hit(20, 20).key, 'head');
  assert.equal(hit(290, 20).key, 'compass');
  assert.equal(hit(140, 10).key, 'interactionMode');
  assert.equal(hit(140, 30).key, 'transportMode');
  assert.equal(hit(75, 40).key, 'options', 'the tall thin one spans both rows');
  assert.equal(hit(230, 30).key, 'rest');
  // off the bar entirely, and on the bar but between panels
  assert.equal(largeHudClick(bar, 20, 10), null, 'above the bar');
  assert.equal(hit(55, 20), null, 'the vitals are not a panel');
  assert.equal(largeHudPoint(bar, -1, bar.y + 5), null);
  assert.equal(largeHudPoint(bar, 5, bar.y - 1), null);
  // the edges are half-open, exactly as inRect says
  assert.equal(largeHudPanelAt(7, 8).key, 'head', 'the top-left corner is inside');
  assert.equal(largeHudPanelAt(7 + 33, 8), null, 'and the far edge is not');
});

test('hudLarge: only the MAP panel differs on the right button', () => {
  const bar = largeHudRect(canvas(320, 200), { docked: true });
  const at = (key, b) => {
    const [x, y, w, h] = LARGE_HUD_RECTS[key];
    return largeHudClick(bar, x + w / 2, bar.y + y + h / 2, b);
  };
  assert.equal(at('map', 0).action, 'AutoMap');
  assert.equal(at('map', 2).action, 'TravelMap');
  // DFU binds the SAME handler to both buttons everywhere else
  // (:167-173, :181-233), which is why `right` is set on one panel.
  for (const p of LARGE_HUD_PANELS) {
    if (p.key === 'map' || p.key === 'interactionMode') {
      assert.ok(p.right, `${p.key} has a distinct right-click`);
      continue;
    }
    assert.equal(p.right, undefined, `${p.key} binds one handler to both buttons`);
    assert.equal(at(p.key, 2).action, at(p.key, 0).action);
  }
  // a middle click takes the left handler - DFU binds only the two
  assert.equal(at('map', 1).action, 'AutoMap');
});

test('hudLarge: every panel posts an action ui/input.js can route', () => {
  // DFU's panels PostMessage into the UI manager; the port's
  // equivalent vocabulary is the action registry, so a click and a
  // keypress reach ONE door. Proven by routing each through a ctx
  // that records what it was asked for.
  const seen = [];
  const ctx = {
    toggleCharSheet: () => seen.push('CharacterSheet'),
    toggleInventory: () => seen.push('Inventory'),
    toggleSpellbook: () => seen.push('CastSpell'),
    togglePause: () => seen.push('Escape'),
    toggleRest: () => seen.push('Rest'),
    toggleAutomap: () => seen.push('AutoMap'),
    openTravelMap: () => seen.push('TravelMap'),
    showStatus: () => seen.push('Status'),
    toggleSheath: () => seen.push('ReadyWeapon'),
    openUseMagicItem: () => seen.push('UseMagicItem'),
    openTransport: () => seen.push('Transport'),
    cycleMode: (d) => seen.push(d > 0 ? 'CycleModeForward' : 'CycleModeBackward'),
  };
  for (const p of LARGE_HUD_PANELS) {
    assert.equal(routeAction(p.action, ctx), true, `${p.key} routes ${p.action}`);
    if (p.right) assert.equal(routeAction(p.right, ctx), true, `${p.key} routes ${p.right}`);
  }
  assert.deepEqual(seen, [
    'CharacterSheet', 'Status', 'CycleModeForward', 'CycleModeBackward', 'Escape',
    'CastSpell', 'Inventory', 'ReadyWeapon', 'UseMagicItem', 'Transport',
    'AutoMap', 'TravelMap', 'Rest',
  ]);
  // A host that has not grown a door yet does not consume the action -
  // for the FIVE arms U45 added. The four that predate it (Rest,
  // AutoMap, QuickSave, QuickLoad) return true whether or not a
  // handler exists, because they were written for routeKey where the
  // answer means "preventDefault", not "something happened". Pinned as
  // the inconsistency it is; it costs the large HUD nothing, because
  // routeLargeHudClick consumes a hit on the bar either way.
  for (const a of ['Status', 'TravelMap', 'ReadyWeapon', 'UseMagicItem', 'Transport']) {
    assert.equal(routeAction(a, {}), false, `${a} reports honestly`);
  }
  assert.equal(routeAction('Rest', {}), true, 'and the older arms do not');
  assert.equal(routeAction('nonsense', ctx), false);
});

// ---------------------------------------------------------------
// 6. THE HEAD, AND THE WIRING
// ---------------------------------------------------------------

test('hudLarge: the head follows the race and the gender, through the paperdoll archives', () => {
  assert.equal(headArchiveFor({ race: 'Breton', gender: 'male' }), 'FACE00I0.CIF');
  assert.notEqual(headArchiveFor({ race: 'Khajiit', gender: 'male' }),
    headArchiveFor({ race: 'Breton', gender: 'male' }), 'a Khajiit is not a Breton');
  assert.notEqual(headArchiveFor({ race: 'Breton', gender: 'female' }),
    headArchiveFor({ race: 'Breton', gender: 'male' }), 'and the genders differ');
  assert.equal(headArchiveFor(null), 'FACE00I0.CIF', 'no entity falls to the default rather than throwing');
});

test('hudLarge: all four hosts draw the bar and offer it the click, and the crosshair survives', () => {
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js']) {
    assert.match(src(host), /largeHud: largeHudOptions\(/, `${host} draws the bar`);
  }
  // dungeonContext DRAWS it; the two hosts that own its pointer are
  // dungeon.js and worldModes.js, which is where the click is offered
  // (the same split U14's overlay seam has).
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeon.js']) {
    assert.match(src(host), /routeLargeHudClick\(/, `${host} offers the bar the click`);
  }
  // AUDIT 58 (f3/input): the ActivateCursor half of this loop was a
  // TEXT-PRESENCE check, and it passed while ?world and ?exterior each
  // ran TWO registrations - the host's own and the mode machine's -
  // over a module-global flag, so one Enter netted zero toggles and
  // `cursorActive()` could never rise. That flag IS
  // IsLargeHUDInteractable (activeMouseOverLargeHUD and
  // routeLargeHudClick below), so the eleven panels were unreachable by
  // mouse in both shipping outdoor hosts while this line stayed green.
  // The law is a COUNT, not a presence, and it lives where it can be
  // counted: test/cursortoggle.test.js sweeps every entry host's
  // scenes/ import closure and drives one Enter through the real
  // module. What stays here is the consumer end - the two reads that
  // made the defect visible.
  const hl = src('ui/hudLarge.js');
  assert.match(hl, /export const activeMouseOverLargeHUD = \(\) =>\n {2}_overBar && largeHudEnabled\(\) && cursorActive\(\);/);
  assert.match(hl, /if \(!largeHudEnabled\(\) \|\| windowUp \|\| !cursorActive\(\)\) return false;/);
  // DaggerfallHUD.cs:214-220: the bar turns OFF the vitals, the
  // compass and the mode icon - and nothing else. The crosshair is
  // still drawn on the large-HUD branch.
  const hud = src('ui/hud.js');
  const bStart = hud.indexOf('if (largeHud?.art) {');
  assert.ok(bStart > 0, 'the large-HUD branch exists');
  const branch = hud.slice(bStart, hud.indexOf('lastLargeHudBar = null;', bStart));
  assert.match(branch, /drawHudLarge\(/);
  assert.match(branch, /drawCrosshairAndModeIcon\(/, 'the crosshair outlives the vitals');
  assert.match(branch, /showModeIcon: false/, 'and the corner mode word does not');
  assert.match(branch, /return;/, 'the small HUD is not also drawn');
});

// ---------------------------------------------------------------
// ROAD-D D10: THE TWO OFFSETS. LargeHUDOffsetHorse
// (TransportManager.cs:304-309) and LargeHUDUndockedOffsetWeapon
// (FPSWeapon.cs:146-155) both lift by LargeHUD.ScreenHeight - the
// DRAWN bar's height - and their gates are NOT the same one.
// ---------------------------------------------------------------
const barOf = (h) => ({ x: 0, y: 200 - h, w: 320, h, s: 1 });

test('D10: horseOffsetHeight is the drawn bar height, and never asks about docking', () => {
  resetToDefaults();
  // no bar drawn at all is DaggerfallHUD == null
  setValue('GUI', 'LargeHUD', 'True');
  assert.equal(horseOffsetHeight(null), 0, 'a null bar is a null HUD');
  // LargeHUDOffsetHorse ships True, "to match classic"
  assert.equal(horseOffsetHeight(barOf(46)), 46);
  // ...and it is the ONLY setting the horse arm asks after LargeHUD:
  // undocked still offsets, where the weapon arm would not
  setValue('GUI', 'LargeHUDDocked', 'False');
  assert.equal(horseOffsetHeight(barOf(34.5)), 34, 'the (int) cast in TransportManager.cs:306');
  setValue('GUI', 'LargeHUDOffsetHorse', 'False');
  assert.equal(horseOffsetHeight(barOf(46)), 0);
  setValue('GUI', 'LargeHUDOffsetHorse', 'True');
  setValue('GUI', 'LargeHUD', 'False');
  assert.equal(horseOffsetHeight(barOf(46)), 0, 'no large HUD, no offset');
  resetToDefaults();
});

test('D10: a DOCKED bar FORCES the weapon offset, whatever the setting says', () => {
  resetToDefaults();
  setValue('GUI', 'LargeHUD', 'True');
  // LargeHUDUndockedOffsetWeapon ships False and LargeHUDDocked True,
  // so the shipping combination already offsets - FPSWeapon.cs's own
  // comment: "Weapon is forced to offset when using docked HUD else it
  // would appear underneath HUD".
  assert.equal(weaponOffsetHeight(barOf(46)), 46, 'docked forces it');
  setValue('GUI', 'LargeHUDDocked', 'False');
  assert.equal(weaponOffsetHeight(barOf(46)), 0, 'undocked, setting off: no offset');
  setValue('GUI', 'LargeHUDUndockedOffsetWeapon', 'True');
  assert.equal(weaponOffsetHeight(barOf(46)), 46, 'undocked, setting on');
  setValue('GUI', 'LargeHUD', 'False');
  assert.equal(weaponOffsetHeight(barOf(46)), 0);
  assert.equal(weaponOffsetHeight(null), 0);
  resetToDefaults();
});

test('D10: the offset really moves the horse rect and the viewmodel quad', () => {
  // ridingRect's bottom edge rises by the offset (:310-315)
  const art = { width: 200, height: 100, frames: [] };
  const c = canvas(320, 200);
  const flat = ridingRect(c, art, 0);
  const lifted = ridingRect(c, art, 46);
  assert.equal(flat.y - lifted.y, 46);
  assert.equal(flat.h, lifted.h, 'the sprite is moved, not resized');
  // and the weapon quad takes the same subtraction - the ONE caller
  // (combat/weaponRig.js) passes nothing, so the default reads the bar
  const w = src('combat/fpsWeapon.js');
  assert.ok(w.includes('offsetHeight = weaponOffsetHeight(),'), 'the default IS the law');
  assert.ok(w.includes('const y = canvas.height - h - offsetHeight;'), 'OnGUI :388');
  assert.ok(src('scenes/world.js').includes('ridingRect(canvas, ridingArt, horseOffsetHeight())'),
    'the world host feeds the horse arm');
});

test('D10: the narrowed flag\'s citation resolves to the activation ray it rests on', () => {
  // A withdrawal is only as good as its evidence, and the evidence
  // here IS the citation: "there are no screen-to-ray conversions to
  // fix" rests entirely on the reader being able to open the named
  // line and find the camera-forward pick. It named scenes/world.js
  // :5880 - the AUDIT 18 arrow-streaming block, sixty-odd lines from
  // any activation - so the one reader who checked would have found
  // nothing and had to re-derive the clause. Resolve it instead of
  // trusting it, both ways: the cite must land on the call, and the
  // hosts it names must be ALL the hosts that carry one.
  // E5 shipped what "WHAT REALLY REMAINS" named and rewrote that
  // paragraph; the withdrawal above it stands unchanged, so the split
  // moves to the block that now follows it.
  const header = src('ui/hudLarge.js').split('WHAT E5 DID NOT TAKE')[0];
  const cites = [...header.matchAll(/scenes\/([A-Za-z0-9_]+)\.js:(\d+)/g)]
    .map((m) => [`scenes/${m[1]}.js`, Number(m[2])]);
  assert.ok(cites.length >= 2, 'the withdrawal cites the hosts it rests on');
  for (const [rel, n] of cites) {
    const line = src(rel).split('\n')[n - 1];
    assert.match(line, /townTalk\.tryActivate\(cam\.pos, useFwd/,
      `${rel}:${n} is cited for the activation ray and must BE it`);
    // ...and the ray is the camera's own forward vector from the angles
    // - or, since TI1, the touch tap's ray in its place: a pixel
    // unprojected, but through the SAME reduced-viewport rect the world
    // pass draws into, so a docked bar moves no pick on either device.
    assert.match(src(rel).split('\n').slice(Math.max(0, n - 24), n).join('\n'),
      /const useFwd = _tapDir \?\? \[Math\.sin\(cam\.yaw\) \* Math\.cos\(cam\.pitch\)/,
      `${rel}'s useFwd is the camera angles, or the tap's ray`);
    assert.match(src(rel), /rayDirFromScreen\([^\n]*largeHudViewportRect\(canvas\.clientHeight\)\)/,
      `${rel}'s tap ray unprojects through the world-pass rect, not the canvas`);
  }
  // no third host carries the call and goes uncited
  const hosts = ['world', 'exterior', 'dungeon', 'dungeonContext', 'interior', 'worldModes']
    .filter((h) => /townTalk\.tryActivate\(cam\.pos, useFwd/.test(src(`scenes/${h}.js`)))
    .map((h) => `scenes/${h}.js`);
  assert.deepEqual(cites.map(([r]) => r).sort(), hosts.sort(),
    'the cite names exactly the hosts that pick this way - "the other hosts" was one host');
});

// ---------------------------------------------------------------
// ROAD-E E5: THE DOCKED BAR SHRINKS THE WORLD PASS.
// ViewportChanger.cs:52-67 sets the game camera's rect to
// `new Rect(0, hudHeight, 1, 1 - hudHeight)` every frame the bar is
// docked, and HUDCrosshair.cs:43-52 re-centres the reticle into what
// is left. The rect is renderer-owned frame state; the aspect is not
// (each host builds its own lens), and both halves are pinned here.
// ---------------------------------------------------------------

test('E5: the docked height is ScreenHeight, and ONLY when LargeHUD && LargeHUDDocked', () => {
  resetToDefaults();
  // ViewportChanger.cs:44-45 `if (DaggerfallHUD == null) return` - the
  // port's null bar is the same nothing-drawn state.
  setValue('GUI', 'LargeHUD', 'True');
  assert.equal(dockedLargeHudHeight(null), 0, 'a null bar is a null HUD');
  assert.equal(dockedLargeHudHeight(barOf(46)), 46, 'LargeHUDDocked ships True');
  // :57 "When not using docked the large HUD is just an overlay of
  // variable size and main viewport does not change"
  setValue('GUI', 'LargeHUDDocked', 'False');
  assert.equal(dockedLargeHudHeight(barOf(46)), 0, 'undocked changes no viewport');
  setValue('GUI', 'LargeHUDDocked', 'True');
  setValue('GUI', 'LargeHUD', 'False');
  assert.equal(dockedLargeHudHeight(barOf(46)), 0, 'no bar, no rect');
  resetToDefaults();
  // ...and it is NOT the horse's gate, which never asks about docking
  setValue('GUI', 'LargeHUD', 'True');
  setValue('GUI', 'LargeHUDDocked', 'False');
  assert.equal(horseOffsetHeight(barOf(46)), 46);
  assert.equal(dockedLargeHudHeight(barOf(46)), 0, 'the two gates really differ');
  resetToDefaults();
});

test('E5: the camera rect is Rect(0, hudHeight, 1, 1 - hudHeight), bottom-left as Unity writes it', () => {
  resetToDefaults();
  setValue('GUI', 'LargeHUD', 'True');
  // a 640-wide canvas docks the bar at 640/320 = 2x, so 92px tall.
  const bar = largeHudRect(canvas(640, 400), { docked: true });
  assert.equal(bar.h, 92);
  const r = largeHudViewportRect(400, bar);
  assert.equal(r.x, 0);
  assert.equal(r.w, 1);
  assert.equal(r.y, 92 / 400, 'hudHeight = ScreenHeight / Screen.height');
  assert.equal(r.h, 1 - 92 / 400, 'and the height is its complement');
  // y is the BOTTOM edge in this space - the bar sits under the view,
  // so the rect starts above it. A top-left reading would put the
  // world where the bar is.
  assert.ok(r.y > 0 && r.y + r.h === 1, 'the rect reaches the top of the screen');
  // every non-docked state is standardViewportRect (:26, :64-66)
  assert.equal(largeHudViewportRect(400, null), STANDARD_VIEWPORT_RECT);
  setValue('GUI', 'LargeHUDDocked', 'False');
  assert.equal(largeHudViewportRect(400, bar), STANDARD_VIEWPORT_RECT);
  setValue('GUI', 'LargeHUDDocked', 'True');
  setValue('GUI', 'LargeHUD', 'False');
  assert.equal(largeHudViewportRect(400, bar), STANDARD_VIEWPORT_RECT);
  assert.deepEqual({ ...STANDARD_VIEWPORT_RECT }, { x: 0, y: 0, w: 1, h: 1 });
  resetToDefaults();
});

test('E5: the ASPECT loses the bar too, or the world stretches instead of cropping', () => {
  resetToDefaults();
  setValue('GUI', 'LargeHUD', 'True');
  const bar = largeHudRect(canvas(640, 400), { docked: true });   // h = 92
  assert.equal(largeHudWorldAspect(640, 400, bar), 640 / (400 - 92));
  assert.notEqual(largeHudWorldAspect(640, 400, bar), 640 / 400,
    'the plain canvas ratio is exactly what a shrunk rect must not keep');
  // undocked, off, and no bar at all all answer the plain ratio
  setValue('GUI', 'LargeHUDDocked', 'False');
  assert.equal(largeHudWorldAspect(640, 400, bar), 640 / 400);
  resetToDefaults();
  assert.equal(largeHudWorldAspect(640, 400, null), 640 / 400);
});

test('E5: the crosshair re-centres into the reduced view (HUDCrosshair.cs:43-52)', () => {
  // DFU's `y = (Screen.height - ScreenHeight - crosshairSize.y) / 2` is
  // the reticle's TOP; its CENTRE is that plus crosshairSize.y / 2, so
  // the size cancels and the answer is the middle of what the bar
  // leaves. That is the form this port draws about.
  assert.equal(crosshairCentreY(400, 92), (400 - 92) / 2);
  assert.equal(crosshairCentreY(400, 92), 154);
  assert.equal(crosshairCentreY(400, 0), 200, 'VerticalAlignment.Middle, the else arm at :50-51');
  // ...and it really moves the drawn cross. The plain crosshair is two
  // quads about (cx, cy); take the vertical arm's centre back out.
  resetToDefaults();
  setValue('GUI', 'Crosshair', 'True');
  setValue('GUI', 'InteractionModeIcon', 'none');
  const centreOf = (opts) => {
    const quads = [];
    const rec = { drawScreenQuad: (tex, rect) => quads.push(rect) };
    drawCrosshairAndModeIcon(rec, canvas(640, 400), null,
      { cursorActive: false, scale: 1, showModeIcon: false, ...opts });
    assert.equal(quads.length, 2, 'the cross is two arms');
    return quads[1].y + quads[1].h / 2;   // the vertical arm spans the centre
  };
  assert.equal(centreOf({}), 200, 'no bar: the screen middle');
  assert.equal(centreOf({ largeHudHeight: 92 }), 154, 'docked: the viewport middle');
  resetToDefaults();
});

// The EV6 counting Proxy-GL, the glstate/panelframe precedent, grown a
// call LOG so the viewport arguments themselves can be read back.
function loggingRenderer(log, size = { w: 640, h: 400 }) {
  const stub = new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation' || k === 'getAttribLocation') return () => ({});
      if (k === 'createTexture' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createProgram' || k === 'createShader' || k === 'createFramebuffer') return () => ({});
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return size.w;
      if (k === 'drawingBufferHeight') return size.h;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
  const canvasEl = {
    getContext: () => stub, clientWidth: size.w, clientHeight: size.h, width: size.w, height: size.h,
  };
  const r = new Renderer(canvasEl);
  log.length = 0;
  return r;
}
const viewports = (log) => log.filter((c) => c[0] === 'viewport').map((c) => c.slice(1));
const IDENT = () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
const LIGHT = () => new Float32Array([0, 1, 0]);

test('E5: the renderer draws the world into the rect and gives the canvas back for the 2D pass', () => {
  const log = [];
  const r = loggingRenderer(log);
  const I = IDENT();

  // a frame with no rect set is the full canvas, exactly as before -
  // this is what keeps a menu, the video player or the travel map from
  // ever inheriting a world frame's strip.
  r.beginFrame(I, I, LIGHT());
  assert.deepEqual(viewports(log), [[0, 0, 640, 400]]);
  assert.equal(r.worldViewportPx, null);

  // ...and a docked rect shrinks it. 92/400 of the bottom goes to the
  // bar; gl.viewport is BOTTOM-LEFT origin, so y is the bar's height.
  log.length = 0;
  r.setWorldViewport({ x: 0, y: 92 / 400, w: 1, h: 1 - 92 / 400 });
  r.beginFrame(I, I, LIGHT());
  assert.deepEqual(viewports(log), [[0, 0, 640, 400], [0, 92, 640, 308]],
    'full canvas first (beginFrame may have resized), then the world rect');
  assert.deepEqual(r.worldViewportPx, [0, 92, 640, 308]);
  // the clear is NOT viewport-clipped, so the strip under the rect is
  // still cleared and the bar paints over it - Unity's own behaviour.
  assert.ok(log.some((c) => c[0] === 'clear'));

  // the FIRST screen quad is where the canvas comes back: drawScreenQuad
  // lays out in canvas pixels and would be squashed into the strip
  // otherwise. No host has to ask for it.
  log.length = 0;
  r.drawScreenQuad(null, { x: 0, y: 0, w: 10, h: 10 });
  assert.deepEqual(viewports(log)[0], [0, 0, 640, 400], 'the 2D pass owns the whole canvas');
  assert.equal(r.worldViewportPx, null, 'and the world pass is over');
  log.length = 0;
  r.drawScreenQuad(null, { x: 0, y: 0, w: 10, h: 10 });
  assert.equal(viewports(log).length, 0, 'the restore is once, not per quad');

  // THE PENDING RECT IS CONSUMED. ViewportChanger.Update recomputes it
  // every frame; a host that stops asking gets the standard viewport
  // back on its very next frame.
  log.length = 0;
  r.beginFrame(I, I, LIGHT());
  assert.deepEqual(viewports(log), [[0, 0, 640, 400]], 'no rect carried into the next frame');
  // Rect(0,0,1,1) is standardViewportRect and sets nothing extra
  log.length = 0;
  r.setWorldViewport({ x: 0, y: 0, w: 1, h: 1 });
  r.beginFrame(I, I, LIGHT());
  assert.deepEqual(viewports(log), [[0, 0, 640, 400]]);
});

test('E5: the sprite RT and the panel bracket both RETURN the world rect they borrow', () => {
  const log = [];
  const r = loggingRenderer(log);
  const I = IDENT();
  r.setWorldViewport({ x: 0, y: 92 / 400, w: 1, h: 1 - 92 / 400 });
  r.beginFrame(I, I, LIGHT());

  // Every voxel character composites through renderCharacterSprite in
  // the MIDDLE of the world pass. Returning a hardcoded full canvas
  // would undo the rect for every draw after the first character.
  log.length = 0;
  r.renderCharacterSprite({ vao: {}, subMeshes: [] }, I, I, I, 64, 64);
  assert.deepEqual(viewports(log).at(-1), [0, 92, 640, 308], 'the world rect comes back');
  assert.deepEqual(r.worldViewportPx, [0, 92, 640, 308]);

  // A panel frame sets its OWN rect and must not read its clear quad as
  // "the 2D pass has begun"; on the way out the host's world rect is
  // restored, because the bracket saves every global it takes (EV6).
  log.length = 0;
  r.panelFrame({ proj: I, view: I, lightDir: LIGHT(), rect: { x: 10, y: 20, w: 318, h: 169 } }, () => {
    assert.equal(r.worldViewportPx, null, 'inside the panel the world rect is not live');
  });
  assert.deepEqual(r.worldViewportPx, [0, 92, 640, 308], 'and it is handed back');
  assert.deepEqual(viewports(log).at(-1), [0, 92, 640, 308]);
});

test('E5: every host that draws the bar shrinks its world pass AND its lens', () => {
  // The four-hosts rule. dungeonContext.js is where the dungeon HUD is
  // drawn, but its beginFrame and its projection belong to the two
  // hosts that call drawFoes - worldModes.js and dungeon.js - so those
  // are the files that carry the law.
  for (const host of ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js', 'scenes/dungeon.js']) {
    const body = src(host);
    assert.match(body, /renderer\.setWorldViewport\(largeHudViewportRect\(canvas\.clientHeight\)\);/,
      `${host} sets the world pass's rect`);
    assert.match(body, /largeHudWorldAspect\(canvas\.clientWidth, canvas\.clientHeight\)/,
      `${host} takes the bar out of its aspect`);
    // ...and the plain ratio is GONE from every world LENS the host
    // builds - an aspect left at clientWidth/clientHeight stretches the
    // world into the strip instead of cropping the lens, and a
    // largeHudWorldAspect computed and then not used would satisfy the
    // line above on its own. Each perspective() that names the game's
    // own field of view is read whole, to its statement's semicolon.
    const lenses = [...body.matchAll(/perspective\(/g)]
      .map((m) => body.slice(m.index, body.indexOf(';', m.index) + 1))
      .filter((stmt) => stmt.includes('fieldOfView()'));
    assert.ok(lenses.length >= 1, `${host} builds a world lens`);
    for (const stmt of lenses) {
      // the call itself, or the const each streaming host binds it to
      assert.match(stmt, /[wW]orldAspect/,
        `${host}'s world lens takes the reduced aspect`);
      assert.equal(stmt.includes('canvas.clientWidth / canvas.clientHeight'), false,
        `${host} has no full-canvas world lens left`);
    }
  }
  // both of worldModes' modal arms are covered by its ONE projection,
  // and each sets the rect immediately above its own beginFrame, so no
  // early return between them can strand a pending rect.
  const wm = src('scenes/worldModes.js');
  assert.equal((wm.match(/renderer\.setWorldViewport\(/g) || []).length, 2,
    'the dungeon arm and the interior arm each set it');
  assert.equal((wm.match(/renderer\.setWorldViewport\([^\n]*\n\s*renderer\.beginFrame\(/g) || []).length, 2,
    'and each sits immediately above its beginFrame');
  // the SKY draws into the same rect, so it takes the same aspect -
  // and so does EV8's far province ring, the other pass in this frame
  // that builds a projection of its own.
  for (const host of ['scenes/world.js', 'scenes/exterior.js']) {
    assert.match(src(host), /sky\.draw\([^;]*worldAspect\)/s, `${host}'s sky shares the lens`);
  }
  assert.match(src('scenes/world.js'), /fovY: fieldOfView\(\), aspect: worldAspect,/,
    'the far ring shares it too, or the horizon steps against the terrain');
  // no plain-ratio lens survives anywhere in the world host
  const w = src('scenes/world.js');
  assert.equal(/aspect: canvas\.clientWidth \/ canvas\.clientHeight/.test(w), false);
  // scenes/interior.js draws no HUD at all - no bar, no crosshair - so
  // it has no surface to carry, and a call there would be dead forever.
  const interior = src('scenes/interior.js');
  assert.equal(/drawHud\(|drawCrosshairAndModeIcon\(|largeHudOptions\(/.test(interior), false,
    'interior.js still draws no HUD; the day it does, it takes this law too');
  // the crosshair's own re-centre is fed from the ONE home
  assert.match(src('ui/hud.js'), /largeHudHeight: dockedLargeHudHeight\(lastLargeHudBar\)/);
});
