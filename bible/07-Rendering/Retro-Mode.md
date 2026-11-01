# Retro Mode

Retro Mode is DFU's Retro Mode, ported whole. The world is rendered at 320x200 or 640x400 and shown point-sampled,
optionally posterized or cut down to Daggerfall's own palette, and optionally pillarboxed to 4:3 or 16:10. The player
sets it on the settings screen's Video page (DFU's five `[Video]` keys, live) and toggles the effect with **Shift-F11**.

## How it works

- **Settings.** `src/systems/retroMode.js` reads the five keys: `RetroRenderingMode` (0..2), `PostProcessingInRetroMode`
  (0..4: off, posterize, posterize without sky, palettize, palettize without sky), `UseMipMapsInRetroMode`,
  `RetroModeAspectCorrection` (0..2) and `PalettizationLUTShift` (0..7). The screen uses DFU's own words.
- **The image.** `retroTargetSize` is 320x200 or 640x400, or the docked-HUD twin (320x154 or 640x308) when a docked
  large HUD bar is actually drawn. `main.js` hands the renderer `retroFrameConfig` (`Renderer.setRetroSource`), and the
  renderer asks once per world frame; menus, videos and panels are never retro. Every host's lens takes the image's
  aspect (`src/ui/hud/hudLarge.js` `largeHudWorldAspect`).
- **Classic lane.** The world draws into the retro image (colour plus depth texture); the first screen quad, the
  first-person overlay, a panel or the host's frame foot presents it.
- **Enhanced lighting lane.** The lane's own frame image is made the retro size in a second slot, its passes run at that
  size, and its resolve writes into the retro image, which is then presented.
- **Present.** `src/render/retroPass.js` `RetroPass.present` draws one quad, snapping to the 640x400 presentation texel
  first so DFU's two point blits are one fetch. Posterize is `round(c * 15) / 15` between DFU's approximate gamma pair,
  so a level shows as on DFU's screen. Palettize looks up a `256 >> shift` LUT whose texels are the art palette's
  nearest colour (DFU's k-d tree, ported; the LUT matches DFU byte for byte at every shift). The "without sky" modes
  keep any pixel whose depth is the far plane.
- **Aspect.** `retroAspectViewportRect` pillarboxes from DFU's ratio, keeping its float and integer casts;
  `worldViewportRect` is what every host maps through (taps, lock point, labels). The bars clear black.
- **Mips.** With mipmaps off, `Renderer._applyRetroMips` caps every loaded world texture to level 0, and lifts the cap
  when retro goes off. Replacement textures keep their chains.
- **Render scale** shares the image: with retro off and a scale below 100% the world draws into the same image and is
  presented linear. Retro wins when both are on. A world frame drawn without an image frees it.

## Rules

- After the present nothing of the image is left bound, since the next frame draws into it (a feedback loop otherwise).
- A canvas pixel mapped into the world uses the lens's aspect, not the strip's (`Renderer.worldProjAspect`,
  `renderer.worldViewportPx`).
- The LUT is rebuilt when the shift changes, in slices of at most `RETRO_LUT_BUDGET_MS` (4 ms) a frame, streamed into
  its texture; the image shows plain until it is whole. It is freed when retro goes off. A failed build shows the image
  plain and retries on the next change.
- `?perf` measures the present as the frame's `retro` span.

## Daggerfall Unity

DFU's pieces: `SettingsManager` (the five keys), `RetroRenderer` (target and blit), `RetroPresentation`,
`DaggerfallRetroPosterization.shader`, `DaggerfallRetroPalettization.shader` with `FastColorPalette`,
`ViewportChanger.SetRetroAspectViewport`, `TextureReader` (no mips in retro) and `DaggerfallHUD` (Shift-F11).
Departures:

- **UI layout.** DFU lays its whole UI inside the pillarbox. We lay the play layer inside it too (the classic and large
  HUD, the weapon and its widgets, the hands, the mount, the enhanced held map, the enhanced HUD's edge pieces) through
  `retroScreenRect` and the screen offset (`src/ui/uiScreen.js`). The classic native windows (their own integer-scaled
  320x200 letterbox), the video and the Morrowind arms keep the whole canvas.
- **No mip bias.** DFU biases albedo by -0.75 in retro mode; WebGL2 has no sampler LOD bias, so the retro frame's mip
  choice is its own resolution's.
- **Two clamps.** `PostProcessingInRetroMode` 0..4 and `PalettizationLUTShift` 0..7; DFU reads them raw and an unknown
  value leaves a blank world.
- **The LUT follows the shift.** DFU builds it once a session in one go; we rebuild it on change, a slice a frame.
- **The mip switch lands both ways at once.** DFU's latches for the session.
- **The cursor pick** maps through the presented rect; DFU's divides by the screen width and misses by the pillarbox.
- **The HUD twin** follows the bar actually drawn, not the settings.
- **Camera-clear quirks** are not reproduced: we clear black every frame.
- **Sky test:** our depth holds nature batches, so trees against the sky are effected; DFU leaves them.
- **Shift-F11 only toggles.** In DFU the same press also quick-loads (F11); our toggle consumes the key.
- The Morrowind first-person arms have no DFU original; they draw on the canvas after the image, at their own
  resolution.

## Code and tests

- `src/systems/retroMode.js` - settings, `retroTargetSize`, `retroAspectViewportRect`, `retroScreenRect`,
  `retroFrameConfig`, the Shift-F11 flag
- `src/render/retroPass.js` - `RetroPass`, the LUT (`retroLutSteps`, `buildRetroLut`), posterize, the present
- `src/render/renderer.js` - `setRetroSource`, `_applyRetroMips`, the world image
- `src/ui/hud/hudShortcuts.js` - Shift-F11
- `test/render/retro1.test.js`, `test/render/auditretro1.test.js` - the port and its audits
