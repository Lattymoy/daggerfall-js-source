// @ts-check
// RETRO1 (2026-09-24, Mac: "Can we get retro mode from DFU ported
// over?") - DFU'S RETRO MODE: THE SETTINGS, THE SIZES AND THE RECT.
//
// DFU renders the world camera into a small RenderTexture and presents
// it to the screen point-sampled (Utility/RetroRenderer.cs,
// Utility/RetroPresentation.cs), optionally posterized or palettized on
// the way (Shaders/DaggerfallRetroPosterization.shader,
// DaggerfallRetroPalettization.shader), optionally pillarboxed to 4:3 or
// 16:10 (Utility/ViewportChanger.cs SetRetroAspectViewport :96-147).
// Five [Video] keys drive it (SettingsManager.cs:408-412). This module
// is the half that reads them and does arithmetic; render/retroPass.js
// is the half that draws, and the renderer takes this module's
// `retroFrameConfig` as its source (main.js wires the two), so the
// renderer never imports the settings store.
//
// THE TARGETS ARE ASSETS, NOT CODE. RetroRenderer's four RenderTexture
// fields are assigned in the scene from Assets/Resources: RetroTarget
// 320x200, RetroTarget640x400, and a _HUD twin of each (320x154 and
// 640x308, m_Width/m_Height of the .renderTexture files) that
// UpdateRenderTarget (:414-447, the pick at :425-435) picks when the large HUD is on AND
// docked - "Unity viewport rect does not work with target render
// textures", so the world's strip above the bar gets a shorter texture
// instead of a smaller rect. The presentation target is always 640x400
// (RetroPresentation.renderTexture), point-filtered like the rest.
//
// THE CAMERA TAKES THE TEXTURE'S ASPECT. A Unity camera rendering into
// a RenderTexture derives its aspect from the texture, and RetroPresentation
// blits the result across whatever rect it is given. So the world is
// projected at 320/200 (or 320/154 over a docked bar) and STRETCHED to
// the screen: on a 16:9 window the picture is 11% wide, exactly as in
// DFU, and the two aspect corrections exist to undo that - 16:10 shows
// the texture at its own shape, 4:3 at the shape a 1994 monitor gave
// Mode 13h ("display output signal was stretched 20% higher in vertical
// dimension", :103-105). `largeHudWorldAspect` (ui/hudLarge.js) reads
// retroWorldAspect for every host's projection, so there is one
// denominator, as there was before.
//
// RECORDED DEPARTURES (Ledger A, RETRO1):
//   - PostProcessingInRetroMode and PalettizationLUTShift are read with
//     no range in DFU (:409, :412). An out-of-range post mode leaves
//     RetroRenderer with no material and `retroMode = 0` while the
//     camera still renders into the texture (:388-411) - a blank world;
//     a shift past 8 sizes a 0-texel LUT. Both are clamped here
//     (0..4, 0..8) instead.
//   - DFU's aspect-corrected rect also becomes DaggerfallUI's
//     CustomScreenRect (:138-140): every HUD element, window (freely
//     scaled, DaggerfallBaseWindow.cs:85), the weapon and the horse lay
//     out inside the pillarbox. The port's 2D pass keeps the whole
//     canvas; only the WORLD is pillarboxed.
import { getInt, getBool } from './settings.js';

/** RetroTarget320x200 / RetroTarget640x400 (.renderTexture sizes). */
export const RETRO_TARGETS = Object.freeze({ 1: Object.freeze([320, 200]), 2: Object.freeze([640, 400]) });
/** Their _HUD twins, for a docked large HUD (UpdateRenderTarget :425-435). */
export const RETRO_TARGETS_HUD = Object.freeze({ 1: Object.freeze([320, 154]), 2: Object.freeze([640, 308]) });
/** RetroModeAspects: Off, FourThree, SixteenTen. */
export const RETRO_ASPECT = Object.freeze({ OFF: 0, FOUR_THREE: 1, SIXTEEN_TEN: 2 });
/** PostProcessingInRetroMode (RetroModeConfigPage.cs:51-58, UpdateDepthProcessMaterial :388-406). */
export const RETRO_POST = Object.freeze({ OFF: 0, POSTERIZE: 1, POSTERIZE_NO_SKY: 2, PALETTIZE: 3, PALETTIZE_NO_SKY: 4 });

// SettingsManager.cs:408-412
export const retroRenderingMode = () => getInt('Video', 'RetroRenderingMode', 0, 2);
export const retroPostProcessing = () => getInt('Video', 'PostProcessingInRetroMode', 0, 4);   // RETRO1 departure: DFU reads it unclamped
export const retroUseMipMaps = () => getBool('Video', 'UseMipMapsInRetroMode');
export const retroAspectCorrection = () => getInt('Video', 'RetroModeAspectCorrection', 0, 2);
export const palettizationLutShift = () => getInt('Video', 'PalettizationLUTShift', 0, 8);   // RETRO1 departure: DFU reads it unclamped

/** UpdateRenderTarget's own test (:425): the SETTINGS, not the bar - a
 *  docked bar still loading its art already has the short texture. */
const retroHudDocked = () => getBool('GUI', 'LargeHUD') && getBool('GUI', 'LargeHUDDocked');

/** The world's texture for a mode, [w, h], or null when retro is off. */
export function retroTargetSize(mode, docked) {
  const t = (docked ? RETRO_TARGETS_HUD : RETRO_TARGETS)[mode];
  return t ? [t[0], t[1]] : null;
}

/** The projection's aspect under retro mode - the texture's, not the
 *  window's - or null when retro is off. */
export function retroWorldAspect(mode = retroRenderingMode(), docked = retroHudDocked()) {
  const t = retroTargetSize(mode, docked);
  return t ? t[0] / t[1] : null;
}

/**
 * SetRetroAspectViewport (:96-147), in Unity's normalized BOTTOM-LEFT
 * rect space - gl.viewport's own, as ui/hudLarge.js's world rect is.
 * The arithmetic is DFU's to the cast: a 6x-classic height ratio, a
 * 5x (4:3) or 6x (16:10) classic width truncated to whole pixels, an
 * integer pillar either side, the docked bar's share off the bottom.
 * C#'s floats are float32, hence the frounds. Not clamped - on a window
 * narrower than the target the pillar goes negative in DFU too.
 * `hudPx` is LargeHUD.ScreenHeight when the bar is docked, else 0.
 */
export function retroAspectViewportRect(screenW, screenH, aspect, hudPx = 0) {
  const heightRatio = Math.fround(Math.fround(screenH / 6) / 200);
  const viewWidth = Math.trunc(Math.fround(Math.fround(320 * (aspect === RETRO_ASPECT.FOUR_THREE ? 5 : 6)) * heightRatio));
  const pillarWidth = Math.trunc((screenW - viewWidth) / 2);
  const hudHeight = hudPx > 0 ? Math.fround(hudPx / screenH) : 0;
  const x = Math.fround(pillarWidth / screenW);
  return { x, y: hudHeight, w: Math.fround(1 - x * 2), h: Math.fround(1 - hudHeight) };
}

// RetroRenderer.enablePostprocessing (:34) and TogglePostprocessing
// (:48-51) - the ToggleRetroPP shortcut's flag (DaggerfallHUD.cs:320-326,
// Shift-F11). Session state, never saved; it survives a mode change
// because DFU's RetroRenderer is not rebuilt by UpdateSettings.
let _postprocessing = true;
export const retroPostprocessingEnabled = () => _postprocessing;
export function toggleRetroPostprocessing() {
  _postprocessing = !_postprocessing;
  return _postprocessing;
}
/** Tests only: back to a fresh RetroRenderer's flag. */
export function _resetRetroPostprocessing() { _postprocessing = true; }

/**
 * THE FRAME'S RETRO STATE, for the renderer (main.js hands it this
 * function; it is asked once per WORLD frame). Null when retro is off.
 *
 *   width, height  the world's texture (retroTargetSize)
 *   post           the material OnPostRender blits with (:502-505):
 *                  0 when the toggle is off - a plain blit - else the
 *                  setting's 0..4
 *   lutShift       PalettizationLUTShift, for the palette's LUT
 *   mipmaps        whether the world's textures keep their chains:
 *                  TextureReader drops them in retro mode unless
 *                  UseMipMapsInRetroMode (:93, :123, :206, :468)
 */
export function retroFrameConfig() {
  const mode = retroRenderingMode();
  if (mode === 0) return null;
  const size = retroTargetSize(mode, retroHudDocked());
  if (!size) return null;
  return {
    width: size[0], height: size[1],
    post: _postprocessing ? retroPostProcessing() : RETRO_POST.OFF,
    lutShift: palettizationLutShift(),
    mipmaps: retroUseMipMaps(),
  };
}
