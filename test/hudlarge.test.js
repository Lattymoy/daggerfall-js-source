// U44 - HUDLARGE, the classic bottom status bar. Geometry, the eleven
// panels, the two disagreeing mode cycles, and the wiring in all four
// hosts. Everything pinned here was mutation-proven.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LARGE_HUD_W, LARGE_HUD_H, COMPASS_FRAME_COUNT, LARGE_HUD_RECTS, MODE_SUBRECT,
  HUD_MODE_CYCLE, hudLargeNextMode, hudLargePrevMode, LARGE_HUD_PANELS,
  largeHudRect, compassFrameIndex, largeHudPoint, largeHudPanelAt, largeHudClick,
  headArchiveFor,
} from '../src/ui/hudLarge.js';
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
  // for the FIVE arms U44 added. The four that predate it (Rest,
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
    assert.match(src(host), /bindCursorToggle\(canvas/, `${host} binds ActivateCursor`);
  }
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
