// AUDIT 39 - ui-core-hud. The core UI and HUD findings: the dial's
// leaked singleton, the item rail's thumb, the touch attack seam, the
// picker's selected-row shadow, the font's ASCII fold, the vitals
// detector under the default skin, the Detect markers and escort
// faces, the nameplate solver's missing arm, the docked large HUD's
// viewport, the "none" mode icon and the bar fill's rounding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  scrollerHit, applyScroll, scrollThumbSpan, LIST_SLOTS, SCROLLBAR_Y, SCROLLBAR_H,
} from '../src/ui/itemScroller.js';
import { measureText, drawText, spaceGlyphWidth, asciiFold, hasGlyph, FNT_ERROR_CODE } from '../src/ui/text.js';
import { shadowText, DEFAULT_TEXT_COLOR } from '../src/ui/nativePanel.js';
import { rowTextColor, rowShadowOffset, SELECTED_TEXT_COLOR } from '../src/ui/listPicker.js';
import { resolveNameplates } from '../src/ui/nameplateLayout.js';
import { drawCrosshairAndModeIcon, modeIconEnabled } from '../src/ui/hudCrosshair.js';
import {
  drawVitalsBars, mathfRound, vitalsSkin, createVitalsRig, synchronizeImmediately,
  lastHealthLost, lastHealthLostPercent, _resetHudVitals,
} from '../src/ui/hudVitals.js';
import { drawHud } from '../src/ui/hud.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';
import { setInteractionMode } from '../src/player/interactionMode.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const recorder = () => {
  const quads = [];
  return { quads, drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, ...rect, uv, color }) };
};
// A font that answers a DIFFERENT width per glyph, so a substituted
// code is visible in the measure rather than hiding behind a uniform
// one. FixedWidth 6 -> the space glyph is 5 (CreateSpaceGlyph).
const stubFnt = {
  fixedWidth: 6, fixedHeight: 6,
  glyphWidth: (gi) => (gi >= 0 && gi < 240 ? gi + 1 : 0),
};
const stubFont = { fnt: stubFnt, tex: 'tex:FONT' };

// ---------------------------------------------------------------
// F125 - the dial's commit leaked the _open singleton
// ---------------------------------------------------------------

test('AUDIT 39 F125: choosing an arm leaves through the SAME exit the scrim does', () => {
  const dial = read('src/ui/pixelDial.js');
  // commit() used to call the closure `unmount()`, which is neither
  // onClose nor the wrapper openPixelDial installs on the returned
  // handle - so `_open` kept pointing at a torn-down dial and the next
  // Tab was spent raising nothing.
  const commit = dial.slice(dial.indexOf('function commit(dir)'), dial.indexOf('function close()'));
  assert.match(commit, /close\(\);/, 'commit closes through close()');
  assert.doesNotMatch(commit, /\bunmount\(\);/, 'never the bare teardown');
  assert.ok(commit.indexOf('close()') < commit.indexOf('entry.open()'),
    'the dial still leaves BEFORE the window it opens takes the keys');
  assert.match(dial, /function close\(\) \{ unmount\(\); onClose\(\); \}/);
  assert.match(dial, /onClose: \(\) => \{ _open = null; \},/, 'and onClose is what clears the singleton');
});

// ---------------------------------------------------------------
// F126 - the item rail pages off the thumb, not the rail midpoint
// ---------------------------------------------------------------

test('AUDIT 39 F126: the scrollbar thumb is VerticalScrollBar\'s, in bar-local px', () => {
  // Position (1,18), Size (6, itemListPanelRect.height - 35)
  // (ItemListScroller.cs:279-284).
  assert.equal(SCROLLBAR_Y, 18);
  assert.equal(SCROLLBAR_H, 117);
  // thumbHeight = height * display/total (min 10); thumbY = index *
  // (height - thumbHeight) / (total - display)  (:207-211)
  const top = scrollThumbSpan(0, 20);
  assert.ok(Math.abs(top.h - 117 * 4 / 20) < 1e-9, '23.4 px for four of twenty');
  assert.equal(top.y, 0, 'scrolled to the top, the thumb is at the bar top');
  const bottom = scrollThumbSpan(16, 20);
  assert.ok(Math.abs(bottom.y - (SCROLLBAR_H - bottom.h)) < 1e-9, 'and at the bottom it is flush');
  assert.equal(scrollThumbSpan(0, 50).h, 10, 'the 10px floor for a long list (117*4/50 = 9.36)');
  // A list that FITS never draws a thumb: Draw returns before
  // DrawScrollBar (:136-137).
  assert.equal(scrollThumbSpan(0, 4), null);
  assert.equal(scrollThumbSpan(0, 0), null);
});

test('AUDIT 39 F126: a rail click pages by the thumb, and a click ON the thumb moves nothing', () => {
  const rect = [163, 48, 59, 152];       // INV_RECTS.localList
  const at = (y, scroll, len) => scrollerHit(rect, 163 + 4, 48 + y, scroll, len)?.kind;
  // The finding's own case: 20 items at scroll 0, a click at y=60. The
  // thumb spans scroller y 18..41.4, so the click is BELOW it and DFU
  // pages down; the old rail-midpoint split answered 'page-up' (60 <
  // 76) and applyScroll clamped it to a no-op.
  assert.equal(at(60, 0, 20), 'page-down');
  assert.equal(applyScroll(0, at(60, 0, 20), 20), LIST_SLOTS, 'and the page really moves');
  // Symmetrically at the bottom: the same pixel is now ABOVE the thumb.
  assert.equal(at(60, 16, 20), 'page-up');
  assert.equal(applyScroll(16, at(60, 16, 20), 20), 12);
  // On the thumb itself: neither of DFU's two arms fires.
  assert.equal(at(30, 0, 20), 'thumb');
  assert.equal(applyScroll(0, 'thumb', 20), 0, 'an unknown kind moves nothing');
  // The arrows are untouched by all of this.
  assert.equal(at(5, 0, 20), 'up');
  assert.equal(at(140, 0, 20), 'down');
});

test('AUDIT 39 F126: the three item windows hand the rail their live scroll and length', () => {
  assert.match(read('src/ui/nativeInventory.js'),
    /scrollerHit\(R\.localList, vx, vy, this\.scroll, this\._filtered\(\)\.length\)/);
  assert.match(read('src/ui/nativeInventory.js'),
    /scrollerHit\(R\.remoteList, vx, vy, this\.remoteScroll, this\._remote\(\)\.length\)/);
  assert.match(read('src/ui/nativeTrade.js'), /scrollerHit\(rect, vx, vy, this\[which\], items\.length\)/);
  assert.match(read('src/ui/itemMakerWindow.js'),
    /scrollerHit\(ITEM_RECTS\.itemList, vx, vy, safeScrollIndex\(this\.scroll, list\.length\), list\.length\)/);
});

// ---------------------------------------------------------------
// F127 - the touch attack hook nothing called
// ---------------------------------------------------------------

test('AUDIT 39 F127: the sword button is gated by the hook it CALLS', () => {
  const touch = read('src/ui/touch.js');
  assert.match(touch, /if \(hooks\.attackTap\) \{/, 'the gate is the live seam');
  assert.doesNotMatch(touch, /hooks\.attack\b(?!Tap)/, 'the dead drag hook is gone, gate included');
  // ...and the header no longer documents the retired press/drag/
  // release seam as live.
  assert.doesNotMatch(touch, /attack\(0,0,true\)/);
  assert.doesNotMatch(touch, /attack\?\(dx,dy,held\)/);
  assert.match(touch, /@param hooks \{ look\(dx,dy\), attackTap\?\(\) \}/);
  // The three combat hosts pass attackTap alone; the fly-cam interior
  // passes neither and gets no sword.
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const s = read(h);
    assert.match(s, /attackTap: \(\) =>/, `${h} keeps the tap`);
    assert.doesNotMatch(s, /\n\s*attack: \(dx, dy, held\)/, `${h} drops the dead closure`);
  }
  assert.doesNotMatch(read('src/scenes/interior.js'), /attackTap/);
});

// ---------------------------------------------------------------
// F128 - the picker's selected row has no shadow
// ---------------------------------------------------------------

test('AUDIT 39 F128: a zero ShadowPosition draws no shadow pass at all', () => {
  const m = { ox: 0, oy: 0, s: 1 };
  const withShadow = recorder();
  shadowText(withShadow, stubFont, 'AB', m, 0, 0, {});
  const without = recorder();
  shadowText(without, stubFont, 'AB', m, 0, 0, { shadowOffset: 0 });
  assert.equal(withShadow.quads.length, 4, 'two glyphs, shadow pass then colour pass');
  assert.equal(without.quads.length, 2, 'TextLabel.cs:355 skips the pass outright');
  // and the surviving pass is the COLOUR one, at the unoffset position
  assert.equal(without.quads[0].x, withShadow.quads[2].x);
  assert.equal(without.quads[0].y, withShadow.quads[2].y);
});

test('AUDIT 39 F128: the list picker gives the selected row ListBox\'s zero shadow', () => {
  // ListBox.cs:41 selectedShadowPosition = Vector2.zero, handed to the
  // label in both selected arms of DecideTextColor (:363-372);
  // DaggerfallListPickerWindow never overrides it.
  //
  // ROAD-A7 MOVED THIS PIN, deliberately. It used to regex the draw
  // line's exact ternary, and that line grew DecideTextColor's other
  // two arms (the hover colours) - the source shape it matched no
  // longer exists. The law it was pinning did not change, so the pin
  // is now BEHAVIOURAL over the two helpers the draw calls, which
  // cannot drift out from under it the way a source regex can.
  assert.equal(rowShadowOffset(true), 0, 'the selected row skips the shadow pass');
  assert.equal(rowShadowOffset(false), 1, 'every other row keeps DaggerfallDefaultShadowPos');
  // ...and the two selected arms of DecideTextColor still answer the
  // selected colours, so "selected" means the same thing to both.
  assert.deepEqual(rowTextColor(false, false), DEFAULT_TEXT_COLOR);
  assert.deepEqual(rowTextColor(true, false), SELECTED_TEXT_COLOR);
});

// ---------------------------------------------------------------
// F129 - Encoding.ASCII + ErrorCode
// ---------------------------------------------------------------

test('AUDIT 39 F129: the ASCII fold and the two substitutions', () => {
  // Encoding.ASCII.GetBytes: every code above 127 becomes '?' (:304).
  assert.equal(asciiFold('e'.charCodeAt(0)), 101);
  assert.equal(asciiFold(233), FNT_ERROR_CODE, 'e-acute reaches the font as a question mark');
  assert.equal(asciiFold(0x2694), FNT_ERROR_CODE, 'and so does anything above the byte range');
  assert.equal(asciiFold(127), 127, 'the boundary is > 127, not >=');
  // HasGlyph over LoadFont's dictionary (:602-608): SpaceCode plus 240
  // glyphs from asciiStart.
  assert.equal(hasGlyph(32), true);
  assert.equal(hasGlyph(31), false);
  assert.equal(hasGlyph(33), true);
  assert.equal(hasGlyph(272), true);
  assert.equal(hasGlyph(273), false);
});

test('AUDIT 39 F129: a non-glyph code MEASURES as ? and DRAWS as space', () => {
  // CalculateTextWidth :378-379 substitutes ErrorCode; DrawText
  // :313-314 substitutes SpaceCode. The asymmetry is DFU's.
  const qWidth = stubFnt.glyphWidth(FNT_ERROR_CODE - 33) + 1;   // '?' + GlyphSpacing
  assert.equal(measureText(stubFnt, '\u00e9'), qWidth, 'e-acute measures as the ? glyph');
  assert.equal(measureText(stubFnt, '\u0001'), qWidth, 'and so does a control code');
  assert.equal(measureText(stubFnt, '?'), qWidth, 'which is exactly a question mark');
  assert.equal(measureText(stubFnt, ' '), spaceGlyphWidth(stubFnt) + 1, 'the space is still the space');
  // The draw: the accent draws the '?' glyph, the control code draws
  // nothing and advances by the space width alone.
  const r = recorder();
  const advance = drawText(r, stubFont, '\u00e9', 0, 0, 1);
  assert.equal(r.quads.length, 1);
  assert.equal(r.quads[0].w, stubFnt.glyphWidth(FNT_ERROR_CODE - 33), 'the ? glyph, not raw index 200');
  assert.equal(advance, qWidth);
  const r2 = recorder();
  const adv2 = drawText(r2, stubFont, '\u0001', 0, 0, 1);
  assert.equal(r2.quads.length, 0, 'cast to a space, which draws nothing');
  assert.equal(adv2, spaceGlyphWidth(stubFnt), 'and advances by the width alone (:328)');
});

// ---------------------------------------------------------------
// F131 - the detector is a game-state seam, not a skin one
// ---------------------------------------------------------------

test('AUDIT 39 F131: the vitals detector runs before the skin fork AND before the art gate', () => {
  _resetForTests();
  _resetHudVitals();
  const canvas = { width: 320, height: 200 };
  const vit = (health) => ({
    health, maxHealth: 50, magicka: 20, maxMagicka: 20, fatigue: 6400,
    stats: { strength: 50, endurance: 50 },
  });
  // NO ART AT ALL - the case the old code returned on before the
  // detector ever ran. VitalsChangeDetector is its own MonoBehaviour
  // (:66-81) and CameraRecoiler reads it whatever HUD is up.
  drawHud(recorder(), canvas, null, vit(50), 0, 0.016);
  assert.equal(lastHealthLost(), 0, 'the priming frame reports nothing');
  drawHud(recorder(), canvas, null, vit(25), 0, 0.016);
  assert.equal(lastHealthLost(), 25, 'the hit reaches HealthLost');
  assert.equal(lastHealthLostPercent(), 0.5, '...and HealthLostPercent, which is the recoil gate');
  // The pause gate still holds: cursorActive stands in for IsGamePaused.
  drawHud(recorder(), canvas, null, vit(10), 0, 0.016, { cursorActive: true });
  assert.equal(lastHealthLost(), 0, 'a paused frame detects nothing (:68-69)');
  _resetHudVitals();
  _resetForTests();
});

// ---------------------------------------------------------------
// F133 - Detect markers and escort faces under the default skin
// ---------------------------------------------------------------

test('AUDIT 39 F133: the Detect markers reach the skin that replaces the classic compass', () => {
  const hud = read('src/ui/hud.js');
  const branch = hud.slice(hud.indexOf('if (isEnhanced() && typeof document'), hud.indexOf('if (!art) return;'));
  assert.match(branch, /detected: detected \?\? null,/);
  assert.match(branch, /playerXZ: playerXZ \?\? null,/);
  assert.match(branch, /drawEscortFaces\(renderer, canvas\);/, 'and the escort column draws too');
  const en = read('src/ui/enhancedHud.js');
  assert.match(en, /drawDetectMarkers\(opts\.detected \?\? null, opts\.playerXZ \?\? null, heading01\)/);
  // The bearing is the classic box's own law, Mathf.Lerp's clamp
  // included - one home for it, not a second copy here.
  assert.match(en, /compassMarkerLerp\(list\[i\], playerXZ, heading01\)/);
  assert.match(en, /Math\.min\(1, Math\.max\(0, compassMarkerLerp/);
  assert.match(en, /import \{ compassScroll, breathShortThreshold, compassMarkerLerp, DETECT_MARKER_RGB \}/);
});

// ---------------------------------------------------------------
// F134 - the solver's "collider already placed" arm
// ---------------------------------------------------------------

test('AUDIT 39 F134: a count-1 plate whose only collider was placed is PLACED, not surrendered', () => {
  // ExteriorAutomap.cs:1179-1184 - `if (j >= buildingNameplates.Length)
  // { first.numCollisionsDetected = 0; first.placed = true; continue; }`.
  // The state is reachable because the collision COUNT walks every
  // plate while the search takes only unplaced ones. This layout hit it
  // on the last plate: the old `continue` dropped it through the +-h hop
  // to the "*" surrender, where DFU prints the name where it stands.
  const plates = [
    { x: 4, y: 1, w: 14, h: 10 },
    { x: 8, y: 19, w: 20, h: 9 },
    { x: 25, y: 14, w: 24, h: 9 },
    { x: 2, y: 19, w: 23, h: 8 },
    { x: 16, y: 27, w: 23, h: 8 },
  ];
  const out = resolveNameplates(plates);
  assert.deepEqual(out.map((r) => r.offY), [0, -0.5, -9, 8.5, 0], 'the other four are unmoved by the arm');
  assert.equal(out[4].replaced, false, 'the plate keeps its name');
  assert.equal(out.filter((r) => r.replaced).length, 0);
  assert.match(read('src/ui/nameplateLayout.js'), /if \(!q\) \{ p\.count = 0; p\.placed = true; continue; \}/);
});

// ---------------------------------------------------------------
// F135 - the docked large HUD's viewport. SHIPPED (ROAD-E E5).
// ---------------------------------------------------------------

test('AUDIT 39 F135: the docked bar SHRINKS the world pass, and the head records the ship', () => {
  // The finding was that DFU shrinks the camera rect
  // (ViewportChanger.cs:52-67) and re-centres the crosshair into what
  // is left (HUDCrosshair.cs:43-52) while the port drew the bar over a
  // full-canvas frame. E5 landed both halves together, which is the
  // condition this test used to hold the flag open for - so it now
  // pins the ship, and the flag TOKEN is pinned GONE.
  const large = read('src/ui/hudLarge.js');
  const head = large.slice(0, large.indexOf('import '));
  assert.equal(/FLAGGED|INTERIM/.test(head), false, 'the flag is retired, not re-worded');
  assert.match(head, /SHIPPED \(ROAD-E E5, 2026-09-02\)/);
  assert.match(head, /ViewportChanger\.cs:52-67/);
  assert.match(head, /HUDCrosshair\.cs:43-52/);
  // ...and the crosshair marks the centre of the VIEWPORT, which is
  // the camera centre in both states - the half that could not move on
  // its own.
  assert.match(read('src/ui/hudCrosshair.js'),
    /const cx = canvas\.width \/ 2, cy = crosshairCentreY\(canvas\.height, largeHudHeight\);/);
});

// ---------------------------------------------------------------
// F136 - InteractionModeIcon "none"
// ---------------------------------------------------------------

test('AUDIT 39 F136: "none" switches the interaction-mode indicator off', () => {
  // DaggerfallHUD.cs:151 `ShowInteractionModeIcon = Settings
  // .InteractionModeIcon.ToLower() != "none"` -> :205 Enabled. The
  // component itself never tests the word, which is why the gate lives
  // outside it.
  assert.equal(modeIconEnabled('none'), false);
  assert.equal(modeIconEnabled('NONE'), false, 'DFU lowercases first');
  assert.equal(modeIconEnabled('classic'), true);
  assert.equal(modeIconEnabled(undefined), true, 'an absent setting is not "none"');

  _resetForTests();
  setInteractionMode('steal');
  setValue('GUI', 'Crosshair', 'False');   // the cross alone would hide the count
  setValue('GUI', 'InteractionModeIcon', 'none');
  const r = recorder();
  drawCrosshairAndModeIcon(r, { width: 640, height: 400 }, stubFont, { cursorActive: false, scale: 2 });
  assert.equal(r.quads.length, 0, 'no plate, no mode word');
  // ...and the same store with a real style draws it, so the gate is
  // what silenced it and not the harness.
  setValue('GUI', 'InteractionModeIcon', 'classic');
  const r2 = recorder();
  drawCrosshairAndModeIcon(r2, { width: 640, height: 400 }, stubFont, { cursorActive: false, scale: 2 });
  assert.ok(r2.quads.length > 0, 'the corner indicator is alive');
  setInteractionMode('grab');
  _resetForTests();
});

// ---------------------------------------------------------------
// F137 - the bar fill rounds to whole pixels
// ---------------------------------------------------------------

test('AUDIT 39 F137: the vitals fill height is Mathf.Round of the rect height', () => {
  // VerticalProgress.cs:66-71 - `float scaledAmount = Mathf.Round(
  // dstRect.height * amount); dstRect.y += dstRect.height -
  // scaledAmount; dstRect.height = scaledAmount;` with the SOURCE
  // window left unrounded.
  assert.equal(mathfRound(94.72), 95);
  assert.equal(mathfRound(6.5), 6, 'Mathf.Round takes the EVEN half, unlike Math.round');
  assert.equal(mathfRound(7.5), 8);
  assert.equal(mathfRound(0), 0);
  const rig = createVitalsRig();
  synchronizeImmediately(rig, { health: 37, maxHealth: 50, fatigue: 1, maxFatigue: 1, magicka: 1, maxMagicka: 1 }, false);
  const skin = vitalsSkin({ health: { tex: 'h' }, fatigue: { tex: 'f' }, magicka: { tex: 'm' } }, false);
  const rects = {
    health: { x: 0, y: 0, w: 4, h: 128 },   // a 32px bar at scale 4
    fatigue: { x: 10, y: 0, w: 4, h: 128 },
    magicka: { x: 20, y: 0, w: 4, h: 128 },
  };
  const r = recorder();
  drawVitalsBars(r, rig, skin, rects, false);
  const health = r.quads.find((q) => q.tex === 'h');
  assert.equal(health.h, 95, '128 * 37/50 = 94.72 draws as 95, not as a blended partial texel');
  assert.equal(health.y, 128 - 95, 'and the rect is offset by the ROUNDED height');
  assert.ok(Math.abs(health.uv.v0 - (1 - 37 / 50)) < 1e-9, 'the source window stays unrounded');
});
