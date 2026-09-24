# Retro Mode (RETRO1)

2026-09-24, Mac: "Can we get retro mode from DFU ported over?" - and
AUDIT RETRO1 the same day (Mac: "Audit this"), below.

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
| `Assets/Resources/RetroTarget*.renderTexture`, `RetroRenderer.UpdateRenderTarget` (:414-447) | The camera's target: 320x200 / 640x400, or the `_HUD` twin (320x154 / 640x308) when `LargeHUD && LargeHUDDocked` | `retroTargetSize`; `retroFrameConfig` hands over both twins and the renderer takes the `_HUD` one when the host's world rect is a docked strip - the DRAWN bar, as the rect and the lens read it (AUDIT RETRO1 A1/C3); it draws the WORLD frame into an image of that size (`render/retroPass.js` `beginFrameTarget`) |
| Unity's camera aspect | A camera rendering into a texture takes the texture's aspect, and the result is stretched over the screen rect | `ui/hudLarge.js` `largeHudWorldAspect` answers the texture's aspect under retro mode - every host's lens |
| `RetroRenderer.OnPostRender` (:495-506), `RetroPresentation.OnRenderImage` | Blit the texture into the 640x400 presentation target (with the material), then that to the screen; both Point | `RetroPass.present` - one quad, the coordinate snapped to the presentation texel first, so both Point blits are one fetch |
| `DaggerfallRetroPosterization.shader` | `round(c * 15) / 15` per channel, between UnityCG's approximate `LinearToGammaSpace` and `GammaToLinearSpace`, in a linear 16-bit target the backbuffer encodes exactly | the port's frame holds display bytes: the present decodes them (exact sRGB), runs the effect between DFU's approximate pair and encodes again, so a level shows as DFU's screen shows it - 1/15 as 13, not 17 (AUDIT RETRO1 A3) |
| `DaggerfallRetroPalettization.shader`, `InitLut` (:324-366), `art_pal` (:53-314), `FastColorPalette.cs` | A `256 >> shift` LUT, each texel the art palette's colour nearest to `(r,g,b) << shift`, found by a k-d tree; the shader looks the pixel up Point-filtered | `retroLutSteps` / `buildRetroLut` (the tree ported exactly; a candidate search per 8x8x8 block agrees with it wherever the nearest colour is unique and asks the tree where two tie - ~200 ms at the shipped shift against DFU's 850, built by the pass `RETRO_LUT_BUDGET_MS` a frame); the shader fetches the texel by integer index, `floor(g * size)` of the pixel in DFU's approximate gamma (palette grey 4 shows as 1, as in DFU) |
| `EXCLUDE_SKY` | "Sky untouched": a pixel whose depth is the far plane keeps its colour | the image's depth texture (or, under the lane, the lane frame's) read at the same texel |
| `ViewportChanger.SetRetroAspectViewport` (:96-149), `retroClearerCamera` | 4:3 or 16:10 pillarbox from a 6x-classic ratio, the docked bar's height off the bottom; the bars cleared black | `retroAspectViewportRect` (C#'s float32 and integer casts kept); `worldViewportRect` is the rect every host sets and maps through (tap ray, lock point, name labels); the present clears the canvas black |
| `TextureReader` (:93, :123, :206, :468) | No mip chain in retro mode unless `UseMipMapsInRetroMode`; replacement textures (`TryImportTexture`) never pass through it | `Renderer._applyRetroMips`: `TEXTURE_MAX_LEVEL` 0 over every cached world texture, emission map and tile array (and what loads meanwhile) - reversible, so it lands on what is already loaded too; a replacement and its emission map are flagged at upload and passed by (AUDIT RETRO1 A4) |
| `PlayerActivate` (:286-297) | A cursor pick scaled into the texture | already exact: the port unprojects through the frame's own projection and the presented rect |
| `DaggerfallHUD` (:320-326), `RetroRenderer.TogglePostprocessing` | Shift-F11 flips the effect off and on; dead under an open window | `ui/hudShortcuts.js`'s third arm; the flag is `systems/retroMode.js`'s, session state. Under a window it does nothing, and `retroToggleKey` keeps the two arms that let QuickLoad through a window from reading its F11 as a load (AUDIT RETRO1 C1) |

## The frame, under both lanes

The renderer never reads the settings: `main.js` hands it
`retroFrameConfig` as its source (`Renderer.setRetroSource`) and it asks
once per WORLD frame (`_retroBegin`, inside `_beginLane`, after any owed
frame is presented). A menu's frame, a video's, a panel's are never
retro.

- **Classic lane.** The world draws into the retro image (color + a
  24-bit depth TEXTURE), which is the frame target every pass restores
  to; the world viewport is the image's whole, and the host's canvas rect
  (the docked strip, or the pillarbox) is kept, normalized, as where it
  lands - placed on the canvas as it is when the image is shown (AUDIT
  RETRO1 B6). The first screen quad presents it (`_compositeAir`'s first
  branch), or the first-person overlay (the Morrowind arms, C2), or a
  panel opened ahead of either (B2), or the host's `resolveFrame()` at the
  foot of its frame (every host now, C8/E5) - a frame never waits for the
  next `beginFrame` unless its host skipped the foot.
- **Enhanced Lighting lane.** The lane's own frame image is made the
  retro size, in a second slot (`AirPass._frames.retro`) so a menu or a
  video over the world never reallocates either; its passes run at that
  size (as Unity's post stack did on DFU's retro camera) and its resolve
  writes into the retro image (`AirPass.resolveTo`), which is presented
  after it. The "-sky" test reads the lane frame's depth, taken when the
  frame begins (AUDIT RETRO1 B5). A menu's frame on the canvas slot
  resolves over its whole image, not the last world frame's rect (B4).

After the present nothing of the image is left on a unit - the next
retro frame binds that image to draw into, and a sampler still reading
it is a WebGL feedback loop (AUDIT RETRO1 B1; the grass's smooth style
read unit 0 for the same reason and names its own unit now) - and a
live screen scissor is lifted for the black clear and the quad and put
back (B3).

Consumers of a canvas pixel mapped into the world use the LENS's aspect,
not the strip's: the Thunderlock's muzzle ray (`Renderer.worldProjAspect`)
and the lightning's minimum width (the world image's height,
`renderer.worldViewportPx`).

## Recorded departures (Ledger A, RETRO1)

- **The 2D layer keeps the whole canvas.** DFU hands the pillarboxed
  rect to DaggerfallUI as `CustomScreenRect` (:138-140): every HUD
  element, window (scaled freely, DaggerfallBaseWindow.cs:85), the
  weapon, the horse, the casting hands (FPSSpellCasting.cs:88-89), the
  automap's windows and the video (stretched, VideoPlayerDrawer.cs:50)
  lay out inside the pillarbox. Here only the world is pillarboxed - so
  a docked bar is the canvas's width, taller than DFU's (its bar is the
  pillarbox's width * 46/320: at 1920x1080 in 4:3, 276 px against 207),
  and the world strip above it is wider for its height than DFU's
  (1.791 against 1.649; in 16:10 the 320x154 image is stretched 3.5%
  where DFU shows it at its own shape) (AUDIT RETRO1 A2).
- **No mip bias.** DFU biases the albedo -0.75 whenever retro mode is on
  (TextureReader.cs:271-274 - the gate is `RetroRenderingMode > 0`, not
  `UseMipMapsInRetroMode`). WebGL2 has no sampler LOD bias, and a bias
  uniform in every world shader was not worth the risk; the retro
  frame's mip choice is its own resolution's.
- **Two clamps DFU does not have.** `PostProcessingInRetroMode` 0..4 (DFU
  reads it raw; an unknown value leaves no material and a blank world)
  and `PalettizationLUTShift` 0..7 (past 8 the LUT has no texel, and 8
  itself is ONE texel - black - which the settings screen, where DFU
  puts this setting nowhere, would step onto: AUDIT RETRO1 C7).
- **The LUT follows the shift, a slice a frame.** DFU builds it once a
  session (`if (lut) return;`), in one go (850 ms at the shipped shift
  by its own comment). The port rebuilds it when the shift changes,
  `RETRO_LUT_BUDGET_MS` (4 ms) a frame with the image shown plain until
  it is whole, and frees it when retro mode goes off (AUDIT RETRO1
  E1/E2); a build or upload that fails shows the image plain and says so
  once (E3).
- **The mip switch lands at once, both ways.** DFU's arm writes an
  instance field (TextureReader.cs:207, :469) that nothing sets back, so
  in DFU the switch latches for the session: what loads after retro mode
  goes off still has no chain, and the terrain arrays and the tileset
  atlas lose theirs only through that latch. The port caps what is
  already loaded as well, and lifts the cap with retro off. Replacement
  textures keep their chains in both (A4).
- **The cursor pick lands under the cursor.** DFU's retro pick divides by
  `Screen.width` (PlayerActivate.cs:294), so with an aspect correction it
  misses by the pillarbox; the port maps through the presented rect.
- **The twin follows the drawn bar (AUDIT RETRO1 A1/C3).** DFU asks the
  settings (:425), and in DFU a docked bar is always drawn when they say
  so (DaggerfallHUD.cs:213-216). The port's enhanced skin draws no
  classic bar, and the classic skin draws none while its art loads, so
  the settings alone gave a 320x154 image with a 2.078 lens stretched
  over the whole canvas. The texture, the lens and the rect now all read
  the bar the rect is taken from.
- **DFU's camera-clear quirks are not reproduced (A5).**
  CameraClearManager reads retro mode once, at Start (:37-41, :46-47):
  with retro on at launch the main camera only ever clears depth, and
  the sky camera is off indoors, so interiors and dungeons keep stale
  pixels where nothing draws. ViewportChanger's early return (:73)
  leaves a stale `camera.rect` when retro is toggled over a docked bar.
  The port clears black every frame.
- **What the -sky test calls sky (A6, B7).** DFU's `_CameraDepthTexture`
  holds render queues up to 2500; with `NatureBillboardShadows` the
  nature batches are `Queue=Transparent` (DaggerfallBillboardBatch.shader
  :23, chosen at DaggerfallBillboardBatch.cs:315-317), so DFU leaves
  trees against the sky untouched. The port's depth holds them. And the
  enhanced far ring (`farRing.js`) draws at the far plane, so the port's
  -sky modes leave it as sky.
- **The Morrowind first-person arms (C2).** They have no DFU original.
  On the classic set they are drawn on the canvas after the image is
  shown, at their own resolution, as DFU's OnGUI weapon is; under the
  Enhanced Lighting lane they are lane-encoded and need its resolve, so
  they are drawn into the lane's frame and are retro with the world.
  Either way they keep the canvas's lens while a retro world is
  stretched to its rect, so a shot's orb leaves up to ~94 px inboard of
  the drawn barrel at 1920x1080 in 4:3 (none at 16:10, ~62 px outboard
  with no correction on 16:9).

**The LUT is DFU's, byte for byte.** The first record here said .NET's
unstable `Array.Sort` left one tie unreproduced. AUDIT RETRO1 modelled
.NET's IntrospectiveSort: 4 of the 32 k-d leaves come out in another
order, and no texel of the LUT moves at any shift from 0 to 8.

Not departures, the port's own: the mip cap passes by textures that
have no DFU original (the character sprites' truncated chains - a
MAX_LEVEL of 1000 would make them incomplete - the grass tuft sheet,
Dynamic Skies), and a shift-0 LUT is a 64 MiB 3D texture.

## AUDIT RETRO1 (2026-09-24, Mac: "Audit this")

Five lenses - fidelity to DFU, WebGL2 correctness, host integration,
the pins and the docs, cost and robustness - and every confirmed
finding fixed and pinned (`test/auditretro1.test.js`) or recorded above.

- **HIGH, C1.** Shift-F11 under any open window quick-loaded with no
  prompt: the two arms that let QuickLoad through a window read F11's
  code alone, and Shift-F11 is the retro toggle's chord on that key. A
  player on the settings screen's Video page who pressed the advertised
  toggle lost everything since the last quicksave. `retroToggleKey`
  guards both.
- **MED.** The docked twin by the settings against the rect by the drawn
  bar (A1/C3); DFU's colour (A3: posterize and palettize run between
  UnityCG's approximate gamma pair); the image left on units 0 and 1 (B1,
  a feedback loop for any sampler reading them - the smooth grass read
  unit 0); the Morrowind arms drawn into the retro image (C2); the LUT
  built inside one frame (E1, ~200 ms at the shipped shift, ~750 ms at 0)
  and never freed (E2); the pins that compared the port with itself
  (D1-D5).
- **LOW.** The `(int)` bar (A7); replacements capped (A4); the
  `?interior` host's lens, rect and shortcuts (A8/C4); a panel before the
  first quad (B2/C5/E6); a live scissor (B3); a menu frame's rect (B4);
  the depth taken at begin (B5); the rect placed at the present (B6); a
  sprite's texels in the image's pixels (C6); the shift's cap and DFU's
  tip (C7); the frame shown at its host's foot (C8/E5); a failed LUT
  (E3); one warning a bad value, not one a read (E4); the program warmed
  (E7); float32 and highp int pinned (D6/D7); and the docs (D8-D10).
- **Recorded, not fixed:** A2, A5, A6, B7 and C2's lens (the departures
  above).

## Testing

`test/retro1.test.js` (20 pins): the settings and their clamps, the
targets, the pillarbox to the cast, the frame's config and the toggle;
the palette, the tree's tie laws, the LUT against the tree texel for
texel (whole cubes at shifts 3 and 4, five whole slices at the shipped
shift, ties included), the Point lookup and the posterize in DFU's
gamma; the shader's laws; `RetroPass` on the fake GL (sizes, the black
clear, the rect, the LUT once per shift, the fallback blit when the
program will not build); the renderer's lifecycle under both lanes (the
owed frame, a menu, a panel, the slots); the mip caps; the LIVE tier and
the words; Shift-F11; the muzzle and the bolts.
`tools/mutants/retro1.json`: 54 mutants, all dead (twelve re-aimed by
content at the audit).

`test/auditretro1.test.js` (30 pins), on a STATEFUL fake GL with
WebGL2's own constants (units, attachments, each texture's parameters,
the feedback-loop and sampler-type rules): one pin a finding, above,
plus the LUT's and the palette's SHA-256 (D1), the pass's GL state
texture by texture (D2), the renderer's viewport, clear colour and one
pass (D3), every late-upload cap (D4) and the lane's retro slot (D5).
`tools/mutants/auditretro1.json`: 51 mutants, all dead.

NOT SEEN ON A GPU. No probe was run for this slice or its audit (Mac:
"Do not use probes"); the shader is pinned by source and the pass by
the fake GLs. A
program that fails to build presents with a plain NEAREST blit and says
so once in the console - a retro world without its effect, never a
black one.
