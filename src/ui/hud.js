// The classic HUD (UI arc, U1). Verbatim geometry from DFU
// HUDVitals.cs + HUDCompass.cs (MIT, Daggerfall Workshop), drawn in
// DFU's fullscreen style: vitals bottom-left, compass bottom-right.
//
//   Vitals: the classic bar art fills - MAIN03I0.IMG health,
//   MAIN04I0.IMG fatigue, MAIN05I0.IMG magicka - each cropped from
//   the BOTTOM by current/max (bottom-anchored, the
//   VerticalProgress shape). All three ride live entity stats
//   (fatigue joined in S15: current entity.fatigue over the derived
//   (Str+End) x 64 ceiling).
//   Compass: COMPBOX.IMG frame; a 64px window into COMPASS.IMG
//   scrolled by heading/360 x 258 (nonWrappedPart - the strip's tail
//   duplicates its head so no runtime wrap is needed), inset 2px
//   (boxOutlineSize), strip drawn first, frame over it.
//   Scale: classic pixels x floor(canvasHeight / 200) (the 320x200
//   reference), min 1 - integer scaling keeps the art crisp.

import { maxFatigue, maxBreath, liveStat } from '../systems/statMods.js';
import { drawCrosshairAndModeIcon } from './hudCrosshair.js';   // U38
import { playerDamageFlash } from './damageFlash.js';   // AUDIT 24 (wave 39): ShowPlayerDamage rides the one HUD call
import { drawHudLarge } from './hudLarge.js';   // U45: the classic bottom bar - an ALTERNATIVE HUD, see below
import { drawActiveSpells, activeSpellAt, createBlinkClock, hudPointer } from './hudActiveSpells.js';   // U46: the buff/debuff icon rows
import { preloadSpellIcons } from './spellIcons.js';   // U46: the sheet the rows draw from
import { nativeMetrics } from './nativePanel.js';
import { ToolTip } from './toolTip.js';

export const COMPASS_BOX_OUTLINE = 2;
export const COMPASS_BOX_INTERIOR = 64;
export const COMPASS_NON_WRAPPED = 258;
// HUDVitals.borderSize (HUDVitals.cs:26), applied through
// SetMargins(Margins.All, borderSize) (:88-90). The bars read it as
// Parent.LeftMargin/BottomMargin * parentScale in
// BaseScreenComponent.GetRectangle (:1211/:1231) and parentScale is
// the top-level parentPanel's LocalScale = Vector2.one (:43, :1180),
// so the inset is 10 SCREEN pixels at every HUD scale - it is NOT
// multiplied by Scale the way the bar geometry is.
export const HUD_BORDER = 10;
// HUDVitals.nativeBarWidth (HUDVitals.cs:25). PositionIndicators
// (:219-234) sets barWidth = nativeBarWidth * Scale.x and places
// health at +0, fatigue at +barWidth*2, magicka at +barWidth*4 - a
// stride of 8 native px that does NOT come from the loaded art's
// width.
export const HUD_NATIVE_BAR_WIDTH = 4;
export const HUD_BAR_STRIDE = HUD_NATIVE_BAR_WIDTH * 2;   // 8

// P12: HUDBreathBar verbatim - a SOLID VerticalProgress, width 6
// classic px, height = LiveEndurance px, filled bottom-anchored by
// breath/MaxBreath. Yellow (247,239,41); short-on-breath dark red
// (148,12,0) when (LiveEndurance >> 3) + 4 > currentBreath. Layout
// (HUDBreathBar.cs:66-72): breathBar.Position = Position +
// (306 * Scale.x, -92 * Scale.y - height) - BOTH terms are already
// scaled, so 306 is a LEFT edge in screen px, not a right inset. The
// panel itself carries SetMargins(All, 10) and has no Size, so its
// rect collapses onto the viewport's bottom edge and the child's
// alignment-None branches add the margin unscaled: x = 10 + 306*S,
// bottom = screenH + 10 - 92*S.
// Drawn only while holding breath (Amount 0 draws nothing in DFU).
export const BREATH_BAR_WIDTH = 6;
export const BREATH_BAR_LEFT = 306;
export const BREATH_BAR_BOTTOM = 92;
export const BREATH_COLOR_NORMAL = [247, 239, 41];
export const BREATH_COLOR_SHORT = [148, 12, 0];
export const breathShortThreshold = (liveEndurance) => (liveEndurance >> 3) + 4;

// X4: the DETECT MARKER (HUDCompass.cs:219-257). The three Detect
// effects do not draw anything themselves - each registers with the
// compass (DetectMagic.cs:63-71 and its two twins are identical but
// for the flag), and the compass draws one marker per detected
// object above the compass box every frame.
//
// SUBSTITUTION (recorded departure). DFU's icon is
// Assets/Resources/DetectMarker.png - a DFU-AUTHORED asset outside
// ARENA2, so it is neither in the game data the port reads nor
// shippable here. It is a 5x3 RGBA image and its content is trivially
// describable: a downward-pointing triangle, rows of 5, 3 and 1
// pixels centred, every opaque pixel the SAME colour (154, 24, 8).
// The port draws that shape from these constants instead of loading
// a file - pixel-identical to DFU's art without carrying it.
export const DETECT_MARKER_W = 5;
export const DETECT_MARKER_H = 3;
export const DETECT_MARKER_RGB = [154, 24, 8];
/** Filled pixel width per row, top to bottom - centred in the 5px box. */
export const DETECT_MARKER_ROWS = Object.freeze([5, 3, 1]);

// TWO DFU GATES, recorded: HUDCompass.Draw early-outs on `Enabled`
// (:89), and the LARGE HUD setting force-disables the compass
// entirely - which silently kills every Detect marker with no
// alternative presentation, so a Large HUD player gets nothing from
// a Detect spell but the spell-point bill. Neither gate is ported
// because the port has no Large HUD (ui/pauseWindow.js:46 records
// that) and its compass is unconditional; both become live the day
// one ships.

/** HUDCompass.ChangeRange (:254-257), verbatim. */
export const changeRange = (v, oldMin, oldMax, newMin, newMax) =>
  (v - oldMin) * (newMax - newMin) / (oldMax - oldMin) + newMin;

/** DrawMarker's bearing half (:221-239), verbatim, answering the
 *  0..1 lerp along the compass box.
 *
 *  Two things here are easy to get wrong and are load-bearing:
 *
 *  1. targetDirection is `playerXZ - targetXZ` - FROM the target TO
 *     the player, not the other way round. Flipping it mirrors every
 *     marker through the centre.
 *  2. The lerp is NOT clamped by this formula: `angle` spans 0..1 and
 *     each branch maps a QUARTER-turn window onto 0..1, so the halves
 *     of the circle behind the player produce -0.5..0 and 1..1.5.
 *     Unity's Mathf.Lerp clamps t, which is what pins those markers
 *     to the compass edges rather than drawing them off-box - so the
 *     clamp is part of the behaviour and lives in the draw below.
 *
 *  heading01 is the port's camera yaw / 2pi with 0 facing +z, which
 *  is exactly DFU's eulerAngles.y / 360 - so facing is
 *  (sin, 0, cos) of the yaw, the same forward the motor uses. */
export function compassMarkerLerp(targetXZ, playerXZ, heading01) {
  const dx = playerXZ[0] - targetXZ[0];
  const dz = playerXZ[1] - targetXZ[1];
  const len = Math.hypot(dx, dz);
  if (!(len > 0)) return 0.5;   // standing inside the target: dead ahead
  const tx = dx / len, tz = dz / len;
  const yaw = heading01 * Math.PI * 2;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  // Vector3.SignedAngle(from, to, up) about +Y for XZ vectors:
  // atan2(cross.y, dot) where cross.y = from.z*to.x - from.x*to.z.
  const signed = Math.atan2(tz * fx - tx * fz, tx * fx + tz * fz) * 180 / Math.PI;
  const angle = (180 - signed) / 360;
  return (angle >= 0 && angle < 0.5)
    ? changeRange(angle, 0.25, 0.0, 1.0, 0.5)    // object is to the RIGHT
    : changeRange(angle, 1.0, 0.75, 0.5, 0.0);   // object is to the LEFT
}

/** scroll = int(nonWrappedPart * heading01), verbatim. */
export const compassScroll = (heading01) =>
  Math.trunc(COMPASS_NON_WRAPPED * (((heading01 % 1) + 1) % 1));

/** Bottom-anchored fill: the drawn fraction and the source-V window
 *  (v grows downward; a half-full bar shows the LOWER half). */
export function barFill(current, max) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  return { ratio, v0: 1 - ratio, v1: 1 };
}

/** Classic-UI integer scale: FIT the 320x200 virtual screen inside
 *  the canvas (min axis), never overflow it. Height-only scaling blew
 *  classic layouts past the edges on portrait phones (2026-08-14 -
 *  Mac's report); on landscape desktop min() picks the same value the
 *  old formula did. */
export const hudScale = (canvasWidth, canvasHeight) =>
  Math.max(1, Math.floor(Math.min(canvasWidth / 320, canvasHeight / 200)));

/**
 * Load the five classic HUD images. Returns null (loudly, once) when
 * the art is absent - the HUD is data-gated like everything else.
 * ImgFile + palette come from the caller (scene layer owns data).
 */
export function bitmapToColor32(bmp, palette) {
  const colors = new Uint32Array(bmp.width * bmp.height);
  const u8 = new Uint8Array(colors.buffer);
  for (let i = 0; i < bmp.data.length; i++) {
    const idx = bmp.data[i];
    const o = i * 4;
    if (idx === 0) continue;   // classic IMG index 0 = transparent (the box corners)
    const c = palette.get(idx);
    u8[o] = c.r; u8[o + 1] = c.g; u8[o + 2] = c.b; u8[o + 3] = 255;
  }
  return { width: bmp.width, height: bmp.height, colors };
}

export async function loadHud({ fetchBytes, ImgFile, palette, renderer }) {
  // U46: the spell-icon sheet loads HERE, with the rest of the HUD's
  // art, and not with the spellbook window that used to be its only
  // consumer. Left there, the buff rows were invisible until the
  // player happened to open their spellbook once - the F2 shape: a
  // feature that silently does nothing while every pin stays green.
  // Fired and NOT awaited, exactly as the registries are: the bars do
  // not wait on icons, and a frame before the sheet lands simply
  // draws none.
  preloadSpellIcons({ fetchBytes, palette, renderer })
    .catch((e) => console.warn('[hud] spell icon sheets unavailable:', e?.message ?? e));
  const load = async (name) => {
    const img = new ImgFile();
    img.load(await fetchBytes(name), name, palette);
    const bmp = img.getDFBitmap();
    return { tex: renderer.uploadTexture('img', name, bitmapToColor32(bmp, palette)), w: bmp.width, h: bmp.height };
  };
  try {
    const [health, fatigue, magicka, compass, compassBox] = await Promise.all([
      load('MAIN03I0.IMG'), load('MAIN04I0.IMG'), load('MAIN05I0.IMG'),
      load('COMPASS.IMG'), load('COMPBOX.IMG'),
    ]);
    // P12: the breath bar is SOLID color (VerticalProgress), no art -
    // two generated 1x1 textures.
    const solid = ([r, g, b], name) => {
      const colors = new Uint32Array(1);
      const u8 = new Uint8Array(colors.buffer);
      u8[0] = r; u8[1] = g; u8[2] = b; u8[3] = 255;
      return { tex: renderer.uploadTexture('img', name, { width: 1, height: 1, colors }), w: 1, h: 1 };
    };
    return {
      health, fatigue, magicka, compass, compassBox,
      breathNormal: solid(BREATH_COLOR_NORMAL, 'hud-breath-normal'),
      breathShort: solid(BREATH_COLOR_SHORT, 'hud-breath-short'),
    };
  } catch {
    console.warn('[hud] classic HUD art unavailable; HUD disabled');
    return null;
  }
}

/** U45: the rect the large HUD last drew itself into, so a host's
 *  pointer handler can hit-test the bar without recomputing a layout
 *  it does not own. Null whenever the bar is off - which is also what
 *  makes a click fall through to the world. */
let lastLargeHudBar = null;
export const largeHudBar = () => lastLargeHudBar;

// U46 - THE ACTIVE-SPELL ICONS. One blink clock and one tooltip for
// the whole game, because DFU has one HUD: four hosts each counting
// their own phase would strobe when the player walks through a door.
// The tooltip is this component's own (DFU gives HUDActiveSpells a
// `defaultToolTip` of its own, :57), and it is drawn LAST.
// LAZY, and not for tidiness: ui/toolTip.js reaches ui/nativePanel.js,
// which reaches back here for bitmapToColor32 - so constructing a
// ToolTip at THIS module's top level runs `new ToolTip()` before the
// class declaration it names has been evaluated, and every importer
// dies with "Cannot access 'ToolTip' before initialization". Built on
// first draw instead, by which time every module is up.
const _spellBlink = createBlinkClock();
let _spellTip = null;
const spellTip = () => (_spellTip ??= new ToolTip());
let _placedSpellIcons = [];
export const activeSpellIconsPlaced = () => _placedSpellIcons;
export function _resetActiveSpellHud() { _spellBlink._reset(); _spellTip?.hide(); _placedSpellIcons = []; }

/**
 * The icon rows, drawn from the ONE host-agnostic call - and drawn on
 * BOTH branches, because DaggerfallHUD.cs:209 enables activeSpells
 * from ShowActiveSpells alone and the large-HUD block below it never
 * touches them. They ride over the bar, lifted clear of it.
 *
 * The tooltip follows DFU's own gate (:141-147): shown when the game
 * is PAUSED or the cursor is active, never while the player is
 * looking around with the pointer captured.
 */
function drawSpellIconRows(renderer, canvas, vitals, dt, { font, cursorActive, largeHudRect, hover }) {
  const at = hover ?? hudPointer();
  const m = nativeMetrics(canvas);
  const blink = _spellBlink.tick(dt);
  // The bar's top edge in VIRTUAL units - what AdjustIconPosition
  // ForLargeHUD computes as `(Screen.height - hudHeight) / LocalScale`.
  const largeHudTop = largeHudRect ? (canvas.height - largeHudRect.h) / m.s : null;
  _placedSpellIcons = drawActiveSpells(renderer, m, vitals, {
    blinkState: blink, paused: cursorActive, largeHudTop,
  });
  if (!font) { spellTip().hide(); return; }
  const hit = (cursorActive && at) ? activeSpellAt(_placedSpellIcons, at[0], at[1]) : null;
  spellTip().show(hit?.displayName ?? null, at?.[0] ?? 0, at?.[1] ?? 0);
  spellTip().update(dt);
  if (cursorActive) spellTip().draw(renderer, m, font);
}

/** P12: the breath bar (HUDBreathBar verbatim geometry) - only while
 *  holding breath. Its own member because DaggerfallHUD.Update
 *  (:203, :214-220) has TWO callers for it: the breath bar's Enabled
 *  is set from ShowBreathBar every frame and the large-HUD force-off
 *  block below it turns off only the vitals, the compass and the
 *  interaction-mode icon, so the bar draws under BOTH huds. */
function drawBreathBar(renderer, canvas, art, vitals, s) {
  const breath = vitals.currentBreath ?? 0;
  if (!(breath > 0) || !art.breathNormal) return;
  const liveEnd = liveStat(vitals, 'endurance');
  const mb = maxBreath(vitals) || 1;
  const bh = liveEnd * s;
  const fill = Math.max(0, Math.min(1, breath / mb)) * bh;
  const bx2 = HUD_BORDER + BREATH_BAR_LEFT * s;
  const bBottom = canvas.height + HUD_BORDER - BREATH_BAR_BOTTOM * s;
  const img = breathShortThreshold(liveEnd) > breath ? art.breathShort : art.breathNormal;
  if (fill > 0) renderer.drawScreenQuad(img.tex, { x: bx2, y: bBottom - fill, w: BREATH_BAR_WIDTH * s, h: fill });
}

/** Draw the HUD. vitals = { health, maxHealth, magicka, maxMagicka };
 *  heading01 = camera yaw / 2pi with 0 facing +z. */
export function drawHud(renderer, canvas, art, vitals, heading01, dt = 0,
  { font = null, cursorActive = false, detected = null, playerXZ = null, largeHud = null, hover = null } = {}) {
  // AUDIT 24 (wave 39): ShowPlayerDamage's red flash, under the bars.
  // THE FOUR HOSTS RULE, applied before the fact: drawHud is the one
  // host-agnostic call all four make, "last, over the viewmodel", so
  // the flash rides it instead of being pasted into four frame bodies
  // that would then drift. It runs BEFORE the `!art` return because a
  // host that never loaded the HUD art still takes damage.
  playerDamageFlash.tick(dt);
  playerDamageFlash.draw(renderer, canvas);
  if (!art) return;
  // U45 - THE LARGE HUD IS AN ALTERNATIVE, NOT AN ADDITION.
  // DaggerfallHUD.cs:214-220 turns off the vitals, the compass AND the
  // interaction-mode icon whenever it is on, "as they conflict in
  // space or utility"; the CROSSHAIR and the breath bar stay, and the
  // arrow counter goes too (:273, on DFU's own unresolved TODO). So
  // this is an early branch rather than another draw call at the end,
  // and the one thing that outlives it - the crosshair - is drawn
  // here with the mode icon suppressed.
  if (largeHud?.art) {
    const s2 = hudScale(canvas.width, canvas.height);
    lastLargeHudBar = drawHudLarge(renderer, canvas, largeHud.art, vitals, heading01, {
      ...largeHud, barFill, maxFatigueOf: maxFatigue, barArt: art,
    });
    drawCrosshairAndModeIcon(renderer, canvas, font,
      { cursorActive, scale: s2, border: HUD_BORDER, barWidth: HUD_NATIVE_BAR_WIDTH, showModeIcon: false });
    // DaggerfallHUD.cs:203 sets breathBar.Enabled from ShowBreathBar
    // every frame and the force-off block (:214-220) does NOT include
    // it, so the bar survives the large HUD - drawn here after the
    // crosshair, the order the components are added in (:158-160).
    drawBreathBar(renderer, canvas, art, vitals, s2);
    drawSpellIconRows(renderer, canvas, vitals, dt, { font, cursorActive, largeHudRect: lastLargeHudBar, hover });
    return;
  }
  lastLargeHudBar = null;
  const s = hudScale(canvas.width, canvas.height);
  const bottom = canvas.height - HUD_BORDER;
  // Vitals, left to right: health, fatigue, magicka (classic order),
  // strided by barWidth * 2 = 8 native px (PositionIndicators).
  let x = HUD_BORDER;
  const bars = [
    [art.health, vitals.health, vitals.maxHealth],
    [art.fatigue, vitals.fatigue ?? 0, maxFatigue(vitals) || 1],   // S15: the live fatigue stat ((Str+End) x 64 ceiling)
    [art.magicka, vitals.magicka ?? 0, vitals.maxMagicka ?? 1],
  ];
  for (const [img, cur, max] of bars) {
    const { ratio, v0, v1 } = barFill(cur, max);
    const w = img.w * s, hFull = img.h * s, h = hFull * ratio;
    if (h > 0) renderer.drawScreenQuad(img.tex, { x, y: bottom - h, w, h }, { u0: 0, v0, u1: 1, v1 });
    x += HUD_BAR_STRIDE * s;
  }
  drawBreathBar(renderer, canvas, art, vitals, s);
  // Compass, bottom-right: strip window first, frame over it.
  // DaggerfallHUD.cs:254-257 sets compass.Position to
  // (screenRect.xMax - Size.x, screenRect.yMax - Size.y) and HUDCompass
  // never calls SetMargins - COMPBOX sits FLUSH in the corner.
  const box = art.compassBox;
  const bw = box.w * s, bh = box.h * s;
  const bx = canvas.width - bw;
  const by = canvas.height - bh;
  const scroll = compassScroll(heading01);
  const stripH = art.compass.h * s;
  renderer.drawScreenQuad(art.compass.tex,
    { x: bx + COMPASS_BOX_OUTLINE * s, y: by + COMPASS_BOX_OUTLINE * s, w: bw - COMPASS_BOX_OUTLINE * 2 * s, h: stripH },
    { u0: scroll / art.compass.w, v0: 0, u1: (scroll + COMPASS_BOX_INTERIOR) / art.compass.w, v1: 1 });
  renderer.drawScreenQuad(box.tex, { x: bx, y: by, w: bw, h: bh });
  // X4: DrawTrackedObjects (HUDCompass.cs:198-217), AFTER the box -
  // HUDCompass.Draw() calls DrawCompass() then DrawTrackedObjects(),
  // so markers sit OVER the frame, and above it: DFU's marker y is
  // `Position.y - icon.height * Scale.y`, the box's TOP edge minus
  // the icon. `detected` is the union of every live detector's
  // objects, which is what registeredDetectors amounts to once the
  // per-detector loop is flattened - DFU draws one marker per object
  // per detector, so an object matched by TWO live Detect spells is
  // drawn twice, exactly on top of itself.
  if (detected && detected.length && playerXZ) {
    const mw = DETECT_MARKER_W * s, mh = DETECT_MARKER_H * s;
    const boxLeft = bx, boxRight = bx + bw - mw;
    const my = by - mh;
    const rowH = mh / DETECT_MARKER_H;
    const col = [DETECT_MARKER_RGB[0] / 255, DETECT_MARKER_RGB[1] / 255, DETECT_MARKER_RGB[2] / 255, 1];
    for (const t of detected) {
      const raw = compassMarkerLerp(t, playerXZ, heading01);
      // Mathf.Lerp CLAMPS t - the half-circle behind the player maps
      // outside 0..1 and pins to the box edges rather than drawing off it.
      const lerp = Math.min(1, Math.max(0, raw));
      const mx = boxLeft + (boxRight - boxLeft) * lerp;
      // the 5x3 triangle, row by row, centred
      for (let r = 0; r < DETECT_MARKER_ROWS.length; r++) {
        const fill = DETECT_MARKER_ROWS[r] * s;
        renderer.drawScreenQuad(null,
          { x: mx + (mw - fill) / 2, y: my + r * rowH, w: fill, h: rowH }, undefined, col);
      }
    }
  }
  // U38: the crosshair and the interaction-mode indicator, LAST -
  // DaggerfallHUD draws them from one Update beside the vitals it
  // already owns, and drawHud is the ONE host-agnostic call all four
  // hosts make, so they ride it rather than four pasted frame bodies.
  // The two geometry constants travel as arguments: this module is
  // their home and hudCrosshair must not import back into it.
  drawCrosshairAndModeIcon(renderer, canvas, font,
    { cursorActive, scale: s, border: HUD_BORDER, barWidth: HUD_NATIVE_BAR_WIDTH });
  drawSpellIconRows(renderer, canvas, vitals, dt, { font, cursorActive, largeHudRect: null, hover });
}
