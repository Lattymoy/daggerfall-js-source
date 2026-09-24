# Retro Mode (RETRO1)

2026-09-24, Mac: "Can we get retro mode from DFU ported over?"

DFU's Retro Mode renders the world at 320x200 or 640x400 and shows it
point-sampled, optionally posterized or cut down to Daggerfall's own
palette, optionally pillarboxed to 4:3 or 16:10. The port had stored
the five `[Video]` keys since the settings screen shipped and read none
of them. RETRO1 ports the whole of it. The settings screen's Video page
offers all five, live, and Shift-F11 toggles the effect.

## DFU's machinery, and where each piece went

| DFU | What it does | Port |
|---|---|---|
| `SettingsManager.cs:408-412` | `RetroRenderingMode` (0..2), `PostProcessingInRetroMode`, `UseMipMapsInRetroMode`, `RetroModeAspectCorrection` (0..2), `PalettizationLUTShift` | `systems/retroMode.js`, the five getters; LIVE-tier (`systems/settings.js`), with DFU's own words on the screen (`ui/settingsLaw.js` ENUM_LAW, RetroModeConfigPage.cs:39-73) |
| `Assets/Resources/RetroTarget*.renderTexture`, `RetroRenderer.UpdateRenderTarget` (:414-447) | The camera's target: 320x200 / 640x400, or the `_HUD` twin (320x154 / 640x308) when `LargeHUD && LargeHUDDocked` | `retroTargetSize`, `retroFrameConfig`; the renderer draws the WORLD frame into an image of that size (`render/retroPass.js` `beginFrameTarget`) |
| Unity's camera aspect | A camera rendering into a texture takes the texture's aspect, and the result is stretched over the screen rect | `ui/hudLarge.js` `largeHudWorldAspect` answers the texture's aspect under retro mode - every host's lens |
| `RetroRenderer.OnPostRender` (:495-506), `RetroPresentation.OnRenderImage` | Blit the texture into the 640x400 presentation target (with the material), then that to the screen; both Point | `RetroPass.present` - one quad, the coordinate snapped to the presentation texel first, so both Point blits are one fetch |
| `DaggerfallRetroPosterization.shader` | `round(c * 15) / 15` per channel in gamma space | the same arithmetic on the port's display-encoded bytes |
| `DaggerfallRetroPalettization.shader`, `InitLut` (:324-366), `art_pal` (:53-314), `FastColorPalette.cs` | A `256 >> shift` LUT, each texel the art palette's colour nearest to `(r,g,b) << shift`, found by a k-d tree; the shader looks the pixel up Point-filtered | `buildRetroLut` (the tree ported exactly; a candidate search per 8x8x8 block agrees with it wherever the nearest colour is unique and asks the tree where two tie - ~200 ms at the shipped shift against DFU's 850); the shader fetches the texel by integer index, `floor(byte * size / 255)` |
| `EXCLUDE_SKY` | "Sky untouched": a pixel whose depth is the far plane keeps its colour | the image's depth texture (or, under the lane, the lane frame's) read at the same texel |
| `ViewportChanger.SetRetroAspectViewport` (:96-147), `retroClearerCamera` | 4:3 or 16:10 pillarbox from a 6x-classic ratio, the docked bar's height off the bottom; the bars cleared black | `retroAspectViewportRect` (C#'s float32 and integer casts kept); `worldViewportRect` is the rect every host sets and maps through (tap ray, lock point, name labels); the present clears the canvas black |
| `TextureReader` (:93, :123, :206, :468) | No mip chain in retro mode unless `UseMipMapsInRetroMode` | `Renderer._applyRetroMips`: `TEXTURE_MAX_LEVEL` 0 over every cached world texture, emission map and tile array (and what loads meanwhile) - reversible, so it lands on what is already loaded too |
| `PlayerActivate` (:286-297) | A cursor pick scaled into the texture | already exact: the port unprojects through the frame's own projection and the presented rect |
| `DaggerfallHUD` (:320-326), `RetroRenderer.TogglePostprocessing` | Shift-F11 flips the effect off and on | `ui/hudShortcuts.js`'s third arm; the flag is `systems/retroMode.js`'s, session state |

## The frame, under both lanes

The renderer never reads the settings: `main.js` hands it
`retroFrameConfig` as its source (`Renderer.setRetroSource`) and it asks
once per WORLD frame (`_retroBegin`, inside `_beginLane`, after any owed
frame is presented). A menu's frame, a video's, a panel's are never
retro.

- **Classic lane.** The world draws into the retro image (color + a
  24-bit depth TEXTURE), which is the frame target every pass restores
  to; the world viewport is the image's whole, and the host's canvas rect
  (the docked strip, or the pillarbox) is kept as where it lands. The
  first screen quad presents it (`_compositeAir`'s new first branch); a
  frame that draws none is presented at the next `beginFrame`, under ITS
  config.
- **Enhanced Lighting lane.** The lane's own frame image is made the
  retro size, in a second slot (`AirPass._frames.retro`) so a menu or a
  video over the world never reallocates either; its passes run at that
  size (as Unity's post stack did on DFU's retro camera) and its resolve
  writes into the retro image (`AirPass.resolveTo`), which is presented
  after it. The "-sky" test reads the lane frame's depth.

Consumers of a canvas pixel mapped into the world use the LENS's aspect,
not the strip's: the Thunderlock's muzzle ray (`Renderer.worldProjAspect`)
and the lightning's minimum width (the world image's height,
`renderer.worldViewportPx`).

## Recorded departures (Ledger A, RETRO1)

- **The 2D layer keeps the whole canvas.** DFU hands the pillarboxed
  rect to DaggerfallUI as `CustomScreenRect` (:138-140): every HUD
  element, window (scaled freely, DaggerfallBaseWindow.cs:85), the
  weapon, the horse and the video (stretched, VideoPlayerDrawer.cs:50)
  lay out inside the pillarbox. Here only the world is pillarboxed.
- **No mip bias.** With `UseMipMapsInRetroMode` on, DFU biases the albedo
  -0.75 (TextureReader.cs:271-274). WebGL2 has no sampler LOD bias, and a
  bias uniform in every world shader was not worth the risk; the retro
  frame's mip choice is its own resolution's.
- **Two clamps DFU does not have.** `PostProcessingInRetroMode` 0..4 (DFU
  reads it raw; an unknown value leaves no material and a blank world)
  and `PalettizationLUTShift` 0..8 (past 8 the LUT has no texel).
- **The LUT follows the shift.** DFU builds it once a session
  (`if (lut) return;`); the port rebuilds it when the shift changes.
- **The mip switch lands at once.** DFU's lands on textures loaded after
  it; the port caps what is already loaded as well.
- **One tie is not reproduced.** .NET's `Array.Sort` is unstable; the
  order it leaves equal channel values in can decide between two colours
  at exactly equal distance inside one k-d leaf. The port's sort is
  stable.
- **The cursor pick lands under the cursor.** DFU's retro pick divides by
  `Screen.width` (PlayerActivate.cs:294), so with an aspect correction it
  misses by the pillarbox; the port maps through the presented rect.

## Testing

`test/retro1.test.js` (20 pins): the settings and their clamps, the
targets, the pillarbox to the cast, the frame's config and the toggle;
the palette, the tree's tie laws, the LUT against the tree texel for
texel (whole cubes at shifts 3 and 4, five whole slices at the shipped
shift, ties included), the Point lookup and the posterize; the shader's
laws; `RetroPass` on the fake GL (sizes, the black clear, the rect, the
LUT once per shift, the fallback blit when the program will not build);
the renderer's lifecycle under both lanes (the owed frame, a menu, a
panel, the slots); the mip caps; the LIVE tier and the words; Shift-F11;
the muzzle and the bolts. `tools/mutants/retro1.json`: 54 mutants, all
dead.

NOT SEEN ON A GPU. No probe was run for this slice (Mac: "Do not use
probes"); the shader is pinned by source and the pass by the fake GL. A
program that fails to build presents with a plain NEAREST blit and says
so once in the console - a retro world without its effect, never a
black one.
