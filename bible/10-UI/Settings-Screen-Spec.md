# SPEC — `SETTINGS`: the port's settings screen

> **AS BUILT (2026-08-21).** This document is the DESIGN, kept as the
> record of how the screen was decided. Two deviations were made while
> implementing it, both deliberate:
>
> - `src/ui/settingsWidgets.js` - DELETED from the plan, never built.
> - `src/ui/settingsDialog.js` - DELETED from the plan, never built. Their
>   contents live in `src/ui/settingsWindow.js`, because the spec's own
>   first law is that draw and hit-test read ONE layout, and splitting
>   the drawing across three files is how a second copy of a
>   coordinate gets born. The widget drawing and the dialog are each
>   under 60 lines.
> - The port-local rows the spec puts in Accessibility and Mods
>   (`ui.textScale`, `info.dataSource`) are not in the key map: that
>   map is pinned total and disjoint over the 171 STORE keys, and a
>   172nd entry would break it. Text Size lives in `systems/uiPrefs.js`
>   on its own shelf and reaches the screen through the metric.

**Base:** *Configure Daggerfall — the Stone Hall* (category rail + list pane + permanent help + honest tiers).
**Grafted:** the Deck's *value‑is‑a‑word* rule, ASCII‑33 glyph law, range‑equals‑clamp pin, drag‑suppresses‑tap, per‑row revert, save‑failure surfacing, INFO rows. The Five Pages' *unavailable readout* ("what you get instead"), permanent help panel, computed tally, reserved MODS panel, DFU's own words kept verbatim in a detail dialog.
**Dropped as fatal:** `nativeMetrics` on this screen (halves phone text); hiding `unavailable` rows behind a filter (breaks `settings.js:78‑81`); reuse of `listPicker.js` / `messageBox.js` (own metric + un‑preloaded ARENA2 art pre‑game); reuse of `attachTouch` (drops the gameplay HUD over the screen); orientation gating; three‑state view filters; `stored` rows drawn identically to `live`; 1px low‑contrast focus ring; audio previews that are silent because `ensureAudio` never ran.

**The one structural change that replaces all the view filters: TIER IS A GROUP.** Every category's list is three collapsible groups — `WORKS NOW`, `SAVED FOR LATER`, `NOT AVAILABLE HERE` — each with a live count in its heading. Nothing is ever hidden (the count is always on screen), the beginner sees a short list (the last two groups ship collapsed), and the veteran opens them with one keypress. There is no `common` flag, no `Show:` control, no `All keys` view.

---

## 0. Verified ground truth (do not re‑derive)

| Fact | Where |
|---|---|
| 171 keys / 13 sections, all raw strings | `src/systems/settingsDefaults.js`, pinned `test/settings.test.js:34‑35` |
| Tier counts today: **8 live, 18 unavailable, 145 stored** | `src/systems/settings.js:64‑101` |
| `canvas.width = canvas.clientWidth` — CSS px, **DPR 1** | `src/render/renderer.js:1060‑1064` |
| `nativeMetrics` floors to **s=1 on every phone in both orientations** | `src/ui/nativePanel.js:28‑31` |
| Today's launcher draws at a **hardcoded `s=2`** | `src/scenes/launcherScene.js:62`, `:82` |
| FONT0003: `fixedWidth 5`, `fixedHeight 7`, space glyph 4 | pinned `test/audit18_ui_native.test.js:66‑70` |
| `FNT_ASCII_START = 33`; codes < 33 draw as a space; **no arrow / ellipsis / degree / middle‑dot glyph exists** | `src/formats/fntFile.js:15`, `src/ui/text.js:80‑86` |
| `measureText` takes `font.fnt`, returns virtual px at scale 1 | `src/ui/text.js:60‑67` |
| `drawRect` / `shadowText` / `drawImg` consume `{s, ox, oy}` — **any** metric object works | `src/ui/nativePanel.js:68‑84` |
| `layoutMessageBox` hard‑codes `(320‑w)/2, (200‑h)/2`; `drawMessageBox` returns `false` unless SPOP.RCI is preloaded — and nothing preloads it before the game | `src/ui/messageBox.js:137`, `:184` |
| `ListPickerWindow.draw` calls `nativeMetrics(canvas)` **itself** | `src/ui/listPicker.js:148` |
| `attachTouch` is called only by world/interior/exterior/dungeon; it unconditionally builds F5/F6/☰/C/SV/LD + a movement stick claiming the left half of the viewport | `src/ui/touch.js:45‑190` |
| `ensureAudio(fetch)` is exported from `src/scenes/shared.js:384`, is safe un‑awaited, and `audio.ensure` attaches its own gesture‑resume (`src/systems/audio.js:69‑87`) | — |
| `audio._out()` re‑reads `Controls/SoundVolume` on every connection (`audio.js:48`) — so a `DungeonDoorOpen` preview really demonstrates the slider | — |
| `lookSettings.js:20` clamps `MouseLookSensitivity` to **0.1..4.0** while DFU's slider runs to 16.0 | — |
| `saveSettings()`'s boolean is discarded at `launcher.js:100, :122, :193` **and inside `settings.js:234`** | — |
| `SETTINGS_LABELS` (140 entries) / `SETTINGS_INFO` (78) are keyed by **DFU UI control names**, not ini keys; **no production file imports them** | `src/systems/settingsText.js:9`, `:152` |
| `wrapText(fnt, text, maxWidth)` exists | `src/ui/talkWindow.js:15` |
| `SOUND.ButtonClick = 360`, `SOUND.DungeonDoorOpen = 25` | `src/systems/soundClips.js:32`, `:9` |
| `index.html` sets `user-scalable=no`, `touch-action:none`, `viewport-fit=cover`, no safe‑area insets | — |

---

## 1. The categories, in order, with every store key

Seven categories. **Every one of the 171 keys appears in exactly one**; the map is total and pinned (T1). Order below is the rail order and the row order inside each category (`order` = position in this list).

`(L)` = tier `live` · `(NA)` = tier `unavailable` · everything else is `stored`.

### 1 — `game` · **Game**
> *How the world plays: fighting, dungeons, repairs and the rules you start out with.*

```
Enhancements/LoiterLimitInHours        (L)   Maximum Wait Time
Enhancements/PlayerTorchFromItems      (L)   Torches Light Your Way
Startup/StartInDungeon                       Start In The Dungeon
Experimental/SmallerDungeons                 Smaller Dungeons
Video/RandomDungeonTextures                  Dungeon Wall Style
MeleeAttacks/MeleeAttackDetection            Hit Detection
MeleeAttacks/MeleeAttackFriendlyProtection   Protect Bystanders
Enhancements/EnemyInfighting                 Enemies Fight Each Other
Enhancements/AlternateRandomEnemySelection   Varied Dungeon Monsters
Controls/InstantRepairs                      Instant Repairs
Controls/AllowMagicRepairs                   Repair Magic Items
Enhancements/GuildQuestListBox               Choose Guild Jobs
Enhancements/NearDeathWarning  → interface (see below)
ChildGuard/PlayerNudity                      Show Nudity
Enhancements/LypyL_GameConsole               Developer Console
GUI/CanDropQuestItems                        Drop Quest Items
GUI/EnableQuestDebugger                      Quest Debugger
GUI/QuestRumorWeight                         Quest Rumour Weight
Startup/StartCellX                           Start Map Square X
Startup/StartCellY                           Start Map Square Y
Enhancements/EnhancedCombatAI          (NA)  Smarter Enemies
Enhancements/AdvancedClimbing          (NA)  Advanced Climbing
```
**21 keys.** (`NearDeathWarning` is listed under Interface; it is not in Game. The 21 are the lines above minus that one.)

### 2 — `controls` · **Controls**
> *Looking, moving and swinging, whether you play with a mouse, a keyboard or a touchscreen.*

```
Controls/MouseLookSensitivity          (L)   Mouse Sensitivity
Controls/InvertMouseVertical           (L)   Invert Look Up/Down
Controls/MouseLookSmoothingFactor            Look Smoothing
Controls/WeaponSwingMode                     Weapon Swing Style
Controls/WeaponSensitivity                   Swing Sensitivity
Controls/WeaponAttackThreshold               Swing Travel Needed
Controls/BowDrawback                         Draw And Release Bows
Controls/ToggleSneak                         Sneak Stays On
Controls/MovementAcceleration                Gradual Start And Stop
Controls/Handedness                          Weapon Hand
Enhancements/BowLeftHandWithSwitching        Bows In Left Hand
Controls/EnableController              (NA)  Game Controller
Controls/JoystickLookSensitivity       (NA)  Gamepad Look Speed
Controls/JoystickCursorSensitivity     (NA)  Gamepad Cursor Speed
Controls/JoystickMovementThreshold     (NA)  Gamepad Movement Deadzone
Controls/JoystickDeadzone              (NA)  Gamepad Stick Deadzone
```
**16 keys.**

### 3 — `audio` · **Audio**
> *Music, sound effects and the noises people make in a fight.*

```
Controls/SoundVolume                   (L)   Sound Volume
Controls/MusicVolume                   (L)   Music Volume
Enhancements/CombatVoices              (L)   Combat Voices
Audio/AlternateMusic                         Alternate Music
Audio/SoundFont                              Music Instrument Set
```
**5 keys.**

### 4 — `video` · **Video**
> *How the game looks, how bright it is, and how hard your machine has to work.*

```
Video/Fullscreen                       (L*)  Fullscreen          <- see §9 companion change
Video/FieldOfView                            Field Of View
Video/QualityLevel                           Detail Level
Video/MainFilterMode                         World Texture Filter
GUI/GUIFilterMode                            Menu Texture Filter
GUI/VideoFilterMode                          Video Texture Filter
Video/VSync                                  Wait For Screen Refresh
Video/TargetFrameRate                        Frame Rate Cap
Video/RunInBackground                        Keep Running In Background
Enhancements/DungeonAmbientLightScale        Dungeon Brightness
Enhancements/NightAmbientLightScale          Night Brightness
Enhancements/PlayerTorchLightScale           Torch Brightness
Spells/EnableSpellLighting                   Spell Lighting
Spells/EnableSpellShadows                    Spell Shadows
Video/DungeonLightShadows                    Dungeon Light Shadows
Video/InteriorLightShadows                   Indoor Light Shadows
Video/ExteriorLightShadows                   Outdoor Light Shadows
Video/AmbientLitInteriors                    Lit Interiors
Video/MobileNPCShadows                       Townsfolk Shadows
Video/GeneralBillboardShadows                Object Shadows
Video/NatureBillboardShadows                 Tree And Plant Shadows
Video/DungeonShadowDistance                  Dungeon Shadow Range
Video/InteriorShadowDistance                 Indoor Shadow Range
Video/ExteriorShadowDistance                 Outdoor Shadow Range
Video/ShadowResolutionMode                   Shadow Sharpness
Video/RetroRenderingMode                     Retro Picture Mode
Video/PostProcessingInRetroMode              Retro Picture Effects
Video/UseMipMapsInRetroMode                  Retro Mip Maps
Video/RetroModeAspectCorrection              Retro Aspect
Video/PalettizationLUTShift                  Retro Palette Shift
Video/EnableTextureArrays                    Texture Arrays
Video/ResolutionWidth                  (NA)  Screen Width
Video/ResolutionHeight                 (NA)  Screen Height
Video/ExclusiveFullscreen              (NA)  Exclusive Fullscreen
GUI/AccelerateUICopyTexture                  Faster Menu Textures
Experimental/TerrainDistance                 Land View Distance
Experimental/TerrainHeightmapPixelError      Land Detail Error
Experimental/AssetCacheThreshold             Asset Cache Size
Effects/AntialiasingMethod                   Edge Smoothing
Effects/AntialiasingFXAAFastMode             Edge Smoothing Fast Mode
Effects/AntialiasingSMAAQuality              Edge Smoothing Quality
Effects/AntialiasingTAASharpness             Edge Smoothing Sharpness
Effects/AmbientOcclusionEnable               Corner Shading
Effects/AmbientOcclusionMethod               Corner Shading Method
Effects/AmbientOcclusionIntensity            Corner Shading Strength
Effects/AmbientOcclusionThickness            Corner Shading Thickness
Effects/AmbientOcclusionRadius               Corner Shading Radius
Effects/AmbientOcclusionQuality              Corner Shading Quality
Effects/BloomEnable                          Glow
Effects/BloomIntensity                       Glow Strength
Effects/BloomThreshold                       Glow Threshold
Effects/BloomDiffusion                       Glow Spread
Effects/BloomFastMode                        Glow Fast Mode
Effects/DepthOfFieldEnable                   Depth Of Field
Effects/DepthOfFieldFocusDistance            Focus Distance
Effects/DepthOfFieldAperture                 Aperture
Effects/DepthOfFieldFocalLength              Focal Length
Effects/DepthOfFieldMaxBlurSize              Maximum Blur
Effects/DitherEnable                         Dithering
Effects/ColorBoostEnable                     Colour Boost
Effects/ColorBoostRadius                     Colour Boost Radius
Effects/ColorBoostIntensity                  Colour Boost Strength
Effects/ColorBoostDungeonScale               Colour Boost Dungeons
Effects/ColorBoostExteriorScale              Colour Boost Outdoors
Effects/ColorBoostInteriorScale              Colour Boost Indoors
Effects/ColorBoostDungeonFalloff             Colour Boost Falloff
```
**66 keys.**

### 5 — `interface` · **Interface**
> *Everything drawn on top of the world: bars, icons, tooltips, prompts and maps.*

```
GUI/ShowOptionsAtStart                 (L)   Show Settings At Startup
GUI/Crosshair                                Crosshair
GUI/EnableToolTips                           Tooltips
GUI/ToolTipDelayInSeconds                    Tooltip Delay
GUI/ToolTipTextColor                         Tooltip Text Colour
GUI/ToolTipBackgroundColor                   Tooltip Background
GUI/EnableVitalsIndicators                   Health And Fatigue Bars
GUI/InteractionModeIcon                      Interaction Icon
GUI/EnableArrowCounter                       Arrow Counter
GUI/IconsPositioningScheme                   Spell Icon Layout
GUI/HelmAndShieldMaterialDisplay             Helm And Shield Metal
GUI/EnableInventoryInfoPanel                 Inventory Info Panel
GUI/EnableEnhancedItemLists                  Enhanced Item Lists
GUI/EnableModernConversationStyleInTalkWindow  Modern Talk Layout
GUI/ShowQuestJournalClocksAsCountdown        Journal Countdowns
GUI/DungeonExitWagonPrompt                   Wagon Prompt At Exits
GUI/TravelMapLocationsOutline                Outline Map Locations
GUI/EnableGeographicBackgrounds              Map Backgrounds
GUI/ShopQualityPresentation                  Shop Quality Text
GUI/ShopQualityHUDDelay                      Shop Quality Delay
GUI/IllegalRestWarning                       Illegal Rest Warning
GUI/DisableEnemyDeathAlert                   Silence Death Alerts
GUI/HideLoginName                            Hide Login Name
Enhancements/NearDeathWarning                Near Death Warning
Map/AutomapNumberOfDungeons                  Dungeon Maps Remembered
Map/AutomapDisableMicroMap                   Hide Dungeon Micro-Map
Map/AutomapRememberSliceLevel                Remember Map Slice
Map/AutomapAlwaysMaxOutSliceLevel            Always Full Map Slice
Map/ExteriorMapDefaultZoomLevel              Town Map Zoom
Map/ExteriorMapResetZoomLevelOnNewLocation   Reset Town Map Zoom
Map/AutomapTempleColor                       Temple Colour
Map/AutomapShopColor                         Shop Colour
Map/AutomapTavernColor                       Tavern Colour
Map/AutomapHouseColor                        House Colour
Map/DungeonMicMapQoL                         Improved Micro-Map
Map/DunMicMapInnerColor                      Micro-Map Fill Colour
Map/DunMicMapBorderColor                     Micro-Map Edge Colour
```
**37 keys.**

### 6 — `accessibility` · **Accessibility**
> *Comfort and readability, for anyone bothered by motion, flashing or small text.*

```
ui.textScale               (PORT-LOCAL, LIVE)  Text Size
Controls/HeadBobbing                           Head Bobbing
Controls/CameraRecoilStrength                  Screen Shake On Damage
Effects/MotionBlurEnable                       Motion Blur
Effects/MotionBlurShutterAngle                 Motion Blur Amount
Effects/MotionBlurSampleCount                  Motion Blur Samples
Effects/VignetteEnable                         Darkened Edges
Effects/VignetteIntensity                      Darkened Edge Strength
Effects/VignetteSmoothness                     Darkened Edge Softness
Effects/VignetteRoundness                      Darkened Edge Shape
Effects/VignetteRounded                        Round Darkened Edges
GUI/SwapHealthAndFatigueColors                 Swap Bar Colours
GUI/DimAlphaStrength                           Dimming Strength
GUI/SDFFontRendering                           Smooth Fonts
GUI/LargeHUD                                   Large Status Bar
GUI/LargeHUDDocked                             Dock Large Status Bar
GUI/LargeHUDUndockedScale                      Large Status Bar Size
GUI/LargeHUDUndockedAlignment                  Large Status Bar Side
GUI/LargeHUDUndockedOffsetWeapon               Keep Bar Clear Of Weapon
GUI/LargeHUDOffsetHorse                        Keep Bar Clear Of Horse
```
**19 DFU keys + 1 port‑local row.**

### 7 — `mods` · **Mods**
> *Community-made add-ons. Nothing here does anything yet, and each switch says why.*

```
[INTRO BLOCK: the reserved mod-list frame — see §5]
info.dataSource            (PORT-LOCAL, INFO)  Where Your Game Files Came From
Enhancements/LypyL_ModSystem           (NA)   Mod Support
Enhancements/AssetInjection            (NA)   Replace Game Artwork
Enhancements/CompressModdedTextures    (NA)   Compress Mod Textures
Experimental/CustomBooksImport         (NA)   Add Your Own Books
Daggerfall/MyDaggerfallPath            (NA)   Daggerfall Folder
Daggerfall/MyDaggerfallUnitySavePath   (NA)   Save Folder
Daggerfall/MyDaggerfallUnityScreenshotsPath (NA) Screenshot Folder
```
**7 DFU keys + 1 info row.**

**Totals: 21 + 16 + 5 + 66 + 37 + 19 + 7 = 171.** Pinned exactly (T1).

### 1.1 Labels and help — the authoring rule

`labelOf(key)` resolves in this order:
1. `LABELS[key]` from `settingsCopy.js` — **authored, required** for: all 8 (9 with Fullscreen) live keys, all 18 unavailable keys, every non‑bool operable key (§3.2 tables), and every key named in §1 above.
2. Otherwise: the ini key de‑camel‑cased — insert a space before any uppercase run that follows a lowercase letter, strip a leading `LypyL_`, strip a leading `Enable`. Deterministic; no invention.

`helpOf(key)` resolves:
1. `HELP[key]` — authored (the curated sentences).
2. `SETTINGS_INFO[DFU_TEXT_KEY[key]]` — DFU's own tooltip (`settingsText.js:152`). `DFU_TEXT_KEY` is a hand‑built ini‑key → DFU‑UI‑key alias map in `settingsCopy.js` (~66 entries: `Video/FieldOfView→fovSlider`, `Controls/MouseLookSensitivity→mouseSensitivity`, `Enhancements/LypyL_ModSystem→modSystem`, `Spells/EnableSpellLighting→spellLighting`, `GUI/EnableToolTips→toolTips`, `Video/ResolutionWidth→resolution`, …). Every alias must resolve (T2).
3. Otherwise `''` — the help panel then shows only the status line, and the detail dialog says *"Daggerfall Unity ships no description for this one."*

**Copy pins (T2/T3):** authored labels ≤ 26 chars; authored help ≤ 100 chars; category blurbs ≤ 100 chars; every authored string matches `/^[\x20-\x7E]+$/` (ASCII 32..126 only — no `…`, `·`, `°`, `—`, `“”`, `–`). Truncation is never permitted anywhere on this screen: labels wrap (≤ 2 lines at 216px, ≤ 3 at 138px), help wraps into the panel's budget.

---

## 2. Screen model, metric, and every coordinate

### 2.1 The metric — `src/ui/settingsMetrics.js` (OURS)

This screen does **not** use `nativeMetrics`. That function floors to `s=1` on every phone (verified: 390×844 → 1; 844×390 → 1), which would give 7 CSS‑px text — **half** what today's hardcoded `s=2` launcher shows. The settings screen is a scrolling list, not a 320×200 IMG, so it may have an elastic page. Every other window in the port keeps `nativeMetrics`.

```js
export const PAGE_W = 320, MIN_PAGE_W = 156, MIN_PAGE_H = 150;

export function settingsMetrics(canvas, { textScale = 0 } = {}) {
  const W = canvas.width | 0, H = canvas.height | 0;
  // 1. CLASSIC: the largest integer scale that fits a full 320x200 page.
  //    Identical to nativeMetrics whenever that returns >= 2.
  let s = Math.floor(Math.min(W / PAGE_W, H / 200));
  if (textScale > 0) s += textScale;                    // Text Size = Large
  if (s >= 2 && W >= PAGE_W * s && H >= 200 * s) {
    return metric(s, PAGE_W, 200, W, H, 'classic');
  }
  // 2. COMFORT: force s = 2 and let the PAGE be elastic on both axes.
  s = 2 + (textScale > 0 ? 1 : 0);
  if (W >= MIN_PAGE_W * s && H >= MIN_PAGE_H * s) {
    const pageW = Math.max(MIN_PAGE_W, Math.min(PAGE_W, Math.floor(W / s)));
    const pageH = Math.max(MIN_PAGE_H, Math.floor(H / s));
    return metric(s, pageW, pageH, W, H, 'comfort');
  }
  // 3. DEGENERATE (viewport under 312x300 CSS px): s = 1, page = viewport.
  return metric(1, Math.max(MIN_PAGE_W, Math.min(PAGE_W, W)), Math.max(MIN_PAGE_H, H), W, H, 'tiny');
}
const metric = (s, pageW, pageH, W, H, mode) => ({
  s, pageW, pageH, mode,
  ox: Math.floor((W - pageW * s) / 2), oy: Math.floor((H - pageH * s) / 2),
});
```

The returned object is shape‑compatible with `nativePanel.drawRect`/`drawImg`/`shadowText`, which only read `{s, ox, oy}`.

```js
/** Screen point -> page point, or null outside the page. Replaces
 *  pointToNative, which clamps against NATIVE_H = 200. */
export function pointToPage(m, px, py) {
  const x = (px - m.ox) / m.s, y = (py - m.oy) / m.s;
  return x >= 0 && y >= 0 && x < m.pageW && y < m.pageH ? [x, y] : null;
}
/** Minimum interactive short axis, in PAGE units. 44 CSS px on touch. */
export const tapMin = (m) => (isTouchDevice() ? Math.ceil(44 / m.s) : 12);
```

Verified outcomes (pinned as a table, T8):

| canvas (CSS px) | mode | s | page | body text | row |
|---|---|---|---|---|---|
| 1920×1080 | classic | 5 | 320×200 | 35 px | 90 px |
| 1280×720 | classic | 3 | 320×200 | 21 px | 54 px |
| 1024×768 | classic | 3 | 320×200 | 21 px | 54 px |
| 1180×820 (iPad, touch) | classic | 3 | 320×200 | 21 px | 54 px |
| 844×390 (phone landscape) | comfort | 2 | 320×195 | 14 px | 44 px |
| 390×844 (phone portrait) | comfort | 2 | 195×422 | 14 px | 44 px |
| 360×640 | comfort | 2 | 180×320 | 14 px | 44 px |
| 320×568 | comfort | 2 | 160×284 | 14 px | 44 px |

Portrait is fully supported. There is **no rotate card** and no orientation gate.

### 2.2 Derived layout constants

```
TAP        = tapMin(m)                      // 12 desktop, 22 at s=2 touch, 15 at s=3 touch
LINE_H     = 9                              // 7px glyph + 2 leading
TITLE_H    = 11
ROW_BASE   = Math.max(18, TAP)              // two-line row; grows +9 per extra label line
GROUP_H    = Math.max(13, TAP)              // group heading row
CAT_H      = Math.max(14, TAP)              // narrow-mode category bar
FOOT_H     = TAP + 2
HELP_LINES = pageW >= 260 ? 3 : 4
HELP_H     = (HELP_LINES + 1) * LINE_H + 3
CTRL_W     = 96                             // control column, page units
```

**Wide vs narrow.** Wide (left rail) is used only when **both** `pageW >= 260` **and** `railH >= 7 * TAP + 6`, where `railH = helpY - TITLE_H`. Otherwise narrow (top category bar). Verified: desktop/tablet → wide; phone portrait → narrow (too narrow); phone landscape → narrow (rail cannot hold 7 tap‑sized plates in 121 units).

### 2.3 WIDE layout — exact rects (classic 320×200, non‑touch)

```
backdrop      full canvas, INK                      (renderer.drawScreenQuad, not drawMenuBackdrop)
page          [  0,   0, 320, 200]  PANEL
titlebar      [  0,   0, 320,  11]  PANEL_DEEP ; rule [0,10,320,1] RULE
  "SETTINGS"  shadowText (4, 2)                     TEXT
  status      right-aligned ending x=316, y=2:
              "NOT SAVED" (WARN) if saveFailed, else "3 changed" (TEXT) if any, else nothing
rail          [  0,  11,  84, 136]                  ; rule [84,11,1,136] RULE
  plateH      = Math.floor((railH - 6) / 7)   = 18
  plate i     [  1,  11 + i*(plateH+1),  82, plateH]   -> y = 11,30,49,68,87,106,125
  label       shadowText (plate.x+5, plate.y + (plateH-7)/2)
              selected: fill FOCUS, label INK, NO shadow, + 2px tick [0, y, 2, plateH]
              unselected: fill PANEL, label TEXT_SOFT
pane          [ 85,  11, 235, 136]
  header      [ 85,  11, 235,  11]  category title HEADING at (89,13)
              rule [85,21,235,1]
  list        [ 85,  22, 229, 125]
  scrollbar   [314,  22,   4, 125]  track PANEL_DEEP, thumb TEXT (drawn only when content > band)
help          [  0, 147, 320,  39]  PANEL_DEEP ; rule [0,147,320,1]
  help lines  y = 150, 159, 168     wrapped to width 312, x = 4
  status line y = 177               (always present)
footer        [  0, 186, 320,  14]  PANEL_DEEP ; rule [0,186,320,1]
  btnHelp     [  3, 187,  26,  12]  "?"
  btnReset    [ 32, 187,  44,  12]  "Reset"
  btnPlay     [239, 187,  78,  12]  "PLAY"  (fill FOCUS, INK label, no shadow)
```

Touch classic (s=3): `TAP=15`, `FOOT_H=17`, `helpY=144`, `railH=133`, `plateH=18`, list `[85,22,229,122]`.

### 2.4 NARROW layout — exact rects (page P × H)

```
titlebar      [0, 0, P, TITLE_H]                     as above
catbar        [0, TITLE_H, P, CAT_H]                 PANEL_DEEP; rule [0,TITLE_H+CAT_H-1,P,1]
  prev        [0, TITLE_H, CAT_H+6, CAT_H]           drawn: a left triangle of rects, 5x7, centred
  name        [CAT_H+6, TITLE_H, P-2*(CAT_H+6), CAT_H]   centred HEADING; tap = category dialog
  next        [P-CAT_H-6, TITLE_H, CAT_H+6, CAT_H]   right triangle
list          [0, TITLE_H+CAT_H, P-5, helpY-(TITLE_H+CAT_H)]
scrollbar     [P-5, TITLE_H+CAT_H, 4, listH]
help          [0, helpY, P, HELP_H]                  helpY = H - FOOT_H - HELP_H
footer        [0, H-FOOT_H, P, FOOT_H]
  btnHelp     [3, fy+1, 26, FOOT_H-2]
  btnReset    [32, fy+1, 44, FOOT_H-2]
  btnPlay     [P-3-playW, fy+1, playW, FOOT_H-2]     playW = Math.min(78, P - 84)
```

### 2.5 The list: items, groups, scrolling

`layout()` builds one flat `items[]` for the selected category:

```
{ kind:'group', id:'live'|'stored'|'na', count, open, rect }
{ kind:'row',   key, widget, tier, value, display, changed, labelLines, rect, labelRect, ctrlRect,
                sub: { prev, value, next }  |  null }
{ kind:'info',  id, label, value, rect }
{ kind:'intro', rect }                       // Mods only
```

* Groups in fixed order: `WORKS NOW (n)`, `SAVED FOR LATER (n)`, `NOT AVAILABLE HERE (n)`. A group with `count === 0` is **not emitted**. `live` ships open; `stored` and `na` ship collapsed **except** `na` in the `mods` category, which ships open (§5). Open/closed persists per `category+group` in `uiPrefs`.
* Row heights are variable: `rowH = ROW_BASE + (labelLines-1) * LINE_H`, `labelLines = wrapText(font.fnt, label, labelW).length` capped at 3.
* Scroll is by **item index** (`scrollIndex`). Items are laid out from `list.y`; an item is emitted only if it fits **wholly** (`y + h <= list.y + list.h`) — the renderer has no scissor (`grep scissor src/render/renderer.js` → nothing), so a partially visible row is never drawn and never hit‑tested.
* On focus move, clamp `scrollIndex` so the focused item is wholly visible (ListBox's `ClampSelectionToVisibleRange`, `listPicker.js:102‑103`).
* Scrollbar thumb: `h = max(6, round(trackH * visibleCount / totalCount))`, `y = track.y + round(trackH * scrollIndex / totalCount)` — the `TotalUnits/DisplayUnits` proportion of `VerticalScrollBar.cs:187‑198` (precedent `nativeTalk.js:82‑83`). Draggable; a tap above/below the thumb pages.

### 2.6 Row internals (all rows are two‑line)

Given row rect `[rx, ry, rw, rh]`:

```
focus tick    [rx, ry, 2, rh]                        FOCUS, only when focused
caret '>'     shadowText (rx+3, ry+2)                only when focused
label         x = rx+10, y = ry+2, wrapped to labelW = rw - 13, LINE_H per line
ctrlLineY     = ry + rh - 9                          (line 2 baseline)
ctrlRight     = rx + rw - 3
labelRect     [rx, ry, rw - CTRL_W, rh]              hit: focus (and toggle, for switch)
ctrlRect      [rx + rw - CTRL_W, ry, CTRL_W, rh]     hit: operate — ONLY on the focused row
  sub.prev    [ctrlRect.x,      ry, 28, rh]
  sub.value   [ctrlRect.x + 28, ry, 40, rh]
  sub.next    [ctrlRect.x + 68, ry, 28, rh]
```

Drawn widget art sits on line 2, right‑aligned to `ctrlRight`, and is **always smaller than its hit rect** (draw ≠ hit, by construction). At s=2 touch: `sub.prev` = 56 × 44 CSS px; the whole row = `rw*2` × 44 CSS px.

Rows with no control (`readout`, `blocked`, `unavailable`, `info`) have `ctrlRect = null`; their whole rect is the label zone and activating opens the **detail dialog**.

---

## 3. Widgets — drawing and operation

### 3.0 Drawing law

Everything is `nativePanel.drawRect` + `nativePanel.shadowText`. **No ARENA2 art is loaded by this screen** (SPOP.RCI / BUTTONS.RCI / PICK00I0.IMG are only preloaded by scenes that run *after* the launcher). **No glyph outside ASCII 33..126 is ever passed to `drawText`** — `FNT_ASCII_START = 33` (`fntFile.js:15`) means every arrow, ellipsis, degree sign and middle dot silently becomes a space. Every triangle/chevron/lock/knob is built from `drawRect`. Separators are `" - "`, truncation markers are `"..."`, "65 deg" not "65°".

Text inside a filled button (PLAY, a selected rail plate, a dialog button) is drawn with **no shadow** — DFU's `ShadowPosition = zero` case, precedent `guildServiceWindow.js:175‑177`. Everything else goes through `shadowText` (DFU's `AddDefaultShadowedTextLabel`, `nativePanel.js:24‑25`, `:78‑84`).

### 3.1 `widgetFor(key)` — total, decidable, no implementer judgement

```
1. tierOf(key) === 'unavailable'                     -> 'unavailable'
2. key in COLOUR_KEYS                                -> 'colour'
3. key === 'Audio/SoundFont'                         -> 'readout'
4. key in TEXT_LAW                                   -> 'text'
5. key in ENUM_LAW                                   -> 'enum'
6. DEFAULTS value is 'True' or 'False'               -> 'switch'
7. key in NUMBER_LAW                                 -> 'number'
8. otherwise (a numeric with no vendored range/list) -> 'blocked'
```

Rule 8 is the honesty rule: **the port never invents a range or an option name.** ~60 stored numeric keys become read‑only rows with a stated reason rather than sliders that pretend to know DFU's limits. Every bool remains fully operable because a bool needs no law beyond `True`/`False`.

### 3.2 The law tables (`src/ui/settingsLaw.js`)

**`ENUM_LAW`** — names and order are DFU's, verbatim, cited. `encode` says what the store holds.

| key | values | encode | cite |
|---|---|---|---|
| `Video/RandomDungeonTextures` | Classic, Climate, Climate Only, Random, Random Only | index | `DaggerfallAdvancedSettingsWindow.cs:244-252` |
| `Controls/CameraRecoilStrength` | Off, Low (25%), Medium (50%), High (75%), V. High(100%) | index | `:244-252` |
| `MeleeAttacks/MeleeAttackDetection` | Performance, Quality | index | `:277-282` |
| `Video/QualityLevel` | Fastest, Fast, Simple, Good, Beautiful, Fantastic | index | `:360-379` |
| `Video/MainFilterMode` | Point, Bilinear, Trilinear | index | `:360-379` |
| `GUI/GUIFilterMode` | Point, Bilinear, Trilinear | index | `:360-379` |
| `GUI/VideoFilterMode` | Point, Bilinear, Trilinear | index | `:360-379` |
| `GUI/HelmAndShieldMaterialDisplay` | Off, No Leather Chain, No Leather, On | index | `:309-321` |
| `GUI/IconsPositioningScheme` | Classic, Medium, Small, Small Deck Left, Small Deck Right, Small Vert Left, Small Vert Right, Small Horz Bottom | **token** | `:309-321` |

`GUI/InteractionModeIcon` is **deliberately absent**: it stores a lowercase token (`"classic"`) and the DFU tokens for *Classic Crosshair* / *Colour Crosshair* are not vendored. It falls to `blocked('novalues')`. Do **not** guess them.

**`NUMBER_LAW`** — `{min, max, step, coarse, format, source}`. `format`: `pct` → `Math.round(v*100)+'%'`; `mult` → `'x' + v.toFixed(1)`; `unit:'…'` → `v + ' ' + unit`.

| key | min | max | step | coarse | format | source |
|---|---|---|---|---|---|---|
| `Controls/SoundVolume` | 0 | 1 | 0.05 | 0.2 | pct | LAW `:268-271` (DisplayUnits = 100) |
| `Controls/MusicVolume` | 0 | 1 | 0.05 | 0.2 | pct | LAW `:272-274` |
| `Controls/MouseLookSensitivity` | 0.1 | **4.0** | 0.1 | 1.0 | mult | **clamp** `lookSettings.js:20` (DFU's slider is 0.1..16.0) |
| `Enhancements/LoiterLimitInHours` | 3 | 12 | 1 | 3 | unit `hours` | LAW `:342-354` |
| `Video/FieldOfView` | 60 | 120 | 5 | 20 | unit `deg` | LAW `:380-395` |
| `GUI/ToolTipDelayInSeconds` | 0 | 10 | 0.5 | 2 | unit `sec` | LAW `:291-297` |
| `Enhancements/DungeonAmbientLightScale` | 0 | 1 | 0.05 | 0.2 | pct | LAW `:333-341` |
| `Enhancements/NightAmbientLightScale` | 0 | 1 | 0.05 | 0.2 | pct | LAW `:333-341` |
| `Enhancements/PlayerTorchLightScale` | 0 | 1 | 0.05 | 0.2 | pct | LAW `:333-341` |
| `Controls/MouseLookSmoothingFactor` | 0 | 1 | 0.05 | 0.2 | pct | **OURS** (flagged: the natural range of a stored 0..1 factor) |

**Range‑equals‑clamp law (pinned, T5).** A slider must never offer travel its consumer ignores. `MouseLookSensitivity` runs to 4.0, not DFU's 16.0, and its help line says: *"Daggerfall Unity allows up to 16; this port applies up to 4."* Every getter call in this screen passes **both** `min` and `max` — `settings.js:158` clamps with `Math.min(max, …)`, so a min without a max yields `NaN`.

**`TEXT_LAW`** — `Controls/WeaponAttackThreshold`: `maxChars 5`, clamp `0.001..1.0` **on commit** (LAW `:444`).
**`COLOUR_KEYS`** (8): `GUI/ToolTipTextColor`, `GUI/ToolTipBackgroundColor`, `Map/AutomapTempleColor`, `Map/AutomapShopColor`, `Map/AutomapTavernColor`, `Map/AutomapHouseColor`, `Map/DunMicMapInnerColor`, `Map/DunMicMapBorderColor`. Stored as **8‑hex `RRGGBBAA`** (alpha is load‑bearing: `ToolTipBackgroundColor` ships `404040D2`).

### 3.3 `formatValue(key, raw)` — the "no raw values" law

| widget | display |
|---|---|
| switch | `On` / `Off` |
| enum (index) | `values[parseInt(raw)]`; index out of range → `blocked` |
| enum (token) | `raw` if in `values`, else `blocked` |
| number | per `format` above — `50%`, `x2.0`, `3 hours`, `65 deg`, `0.5 sec` |
| colour | uppercase 8‑hex |
| text | `raw`, or `default` when empty (DFU's own substitution) |
| readout / blocked / unavailable | the READOUT word (§4) |

A raw ini string is **never drawn on a row**. The raw `[Section] Key` appears in exactly one place: the detail dialog.

### 3.4 Widget specifications

Coordinates below are relative to `ctrlRight = rx + rw - 3`, `ly = ry + rh - 9`.

**SWITCH** (bool; ~100 keys)
*Draw:* the word `On`/`Off` in TEXT (changed) or TEXT_SOFT, right‑aligned ending at `ctrlRight-38`. Pill: 1px BORDER frame `[ctrlRight-34, ly-1, 34, 9]`, fill `[ctrlRight-33, ly, 32, 7]` = ON_FILL / OFF_FILL, knob `[on ? ctrlRight-19 : ctrlRight-33, ly, 14, 7]` = KNOB. The **word is primary**; the pill's position and its fill are two redundant encodings of it.
*Keyboard:* `Left` = Off, `Right` = On — **absolute, not a flip** (pressing Right twice must not undo the first press). `Enter`/`Space` toggles.
*Mouse/touch:* tap anywhere on the row when focused (whole row, both zones). One tap when unfocused = focus only.
*Commit:* `setValue(section, key, next)` → `SOUND.ButtonClick` → debounced save (§3.5).

**ENUM**
*Draw:* left triangle in `[ctrlRight-96+2, ly, 5, 7]` built from three stacked rects (5×1 / 3×1 / 1×1) — never a glyph; value name centred in a plate `[ctrlRight-88, ly-1, 78, 9]`; right triangle at `[ctrlRight-7, ly, 5, 7]`. At the ends of the list the corresponding triangle is drawn in TEXT_DIM and is inert — **there is no wrap**. If `measureText(value) > 74` the value re‑draws at the same position clipped by word‑drop to `"..."` — never a truncated word.
*Keyboard:* `Left`/`Right` step one; `Shift+Left/Right` jump to first/last; `Enter` opens the **choice dialog** (§3.6) listing every value.
*Mouse/touch:* `sub.prev` / `sub.next` step; `sub.value` opens the choice dialog.

**NUMBER**
*Draw:* value text right‑aligned ending at `ctrlRight-30`; track frame `[ctrlRight-66, ly+2, 36, 4]` BORDER, well `[ctrlRight-65, ly+3, 34, 2]` PANEL_DEEP, fill `[ctrlRight-65, ly+3, round(t*34), 2]` TEXT, knob `[ctrlRight-66 + round(t*31), ly, 5, 7]` KNOB; triangles as for ENUM.
*Keyboard:* `Left`/`Right` = one `step`; `Shift+Left/Right` = `coarse`; `Enter` opens the numeric prompt (§3.6).
*Mouse/touch:* `sub.prev`/`sub.next` step; a tap in `sub.value` sets `t = clamp((px - trackX) / trackW)` and commits; a **drag** inside `sub.value` scrubs live and commits on `pointerup`.
*Live preview (LAW, `:268-274`):* `Controls/MusicVolume` applies on every step. `Controls/SoundVolume` plays `SOUND.DungeonDoorOpen` **on release only** (`pointerup` / `keyup`) — never per scroll tick, or a held arrow machine‑guns it. Because `audio._out()` re‑reads `SoundVolume` per connection (`audio.js:48`), the preview genuinely demonstrates the setting. This works only because `launcherScene` now boots audio (§7.2).

**COLOUR**
*Draw:* swatch `[ctrlRight-20, ly, 18, 8]` filled with the parsed RGB inside a 1px BORDER frame; a 2px alpha strip under it `[ctrlRight-20, ly+8, round(18*A/255), 1]` in TEXT; the 8‑hex right‑aligned ending at `ctrlRight-22` in TEXT_SOFT. A value that is not 8 hex digits draws the swatch as diagonal BORDER hatching and the row becomes `blocked` with the reason *"This saved value is not a colour."*
*Operate (all three):* the whole `ctrlRect` / `Enter` opens the **colour dialog**.

**TEXT** (`Controls/WeaponAttackThreshold` only)
*Draw:* a recessed well `[ctrlRight-72, ly-1, 72, 9]` (BORDER frame, PANEL_DEEP fill) with the value in TEXT.
*Operate:* `Enter` / tap `ctrlRect` → `window.prompt(label, current)`. On OK: parse, clamp `0.001..1.0` (LAW `:444`), `setValue`, save. If the value had to be clamped the status line says so. `window.prompt` is used deliberately on **every** platform — it is keyboard‑, mouse‑ and touch‑complete, needs no caret model, and `touch.js`'s existing `prompt('name')` route is unusable here (its title is hardcoded).

**READOUT** (`Audio/SoundFont`)
*Draw:* flat plate `[ctrlRight-72, ly-1, 72, 9]` (no bevel, so it does not look pressable) with the value or `default` in TEXT_DIM, plus a 6×7 padlock (four rects: body `[x,ly+3,7,4]`, shackle top `[x+2,ly,3,1]`, legs `[x+2,ly+1,1,2]` and `[x+6,ly+1,1,2]`).
*Operate:* `Enter` / tap → detail dialog. `Left`/`Right` do nothing and **play no sound**. LAW: DFU sets `ReadOnly = true` and never writes this key back from this window (`:264-267`), so its inertness is parity, not a port limitation, and the dialog says exactly that.

**BLOCKED** — same drawing as READOUT (value + padlock, no operable control), with the reason in the help status line and the dialog:
* `novalues` → *"Daggerfall Unity's own names for this setting are not in the port's data yet."*
* `norange` → *"Daggerfall Unity's own limits for this setting are not in the port's data yet."*

**UNAVAILABLE** — §4.

**GROUP HEADING**
*Draw:* disclosure triangle `[rx+4, ry+(h-5)/2, 5, 5]` from stacked rects (pointing down when open, right when closed); title uppercase in HEADING at `rx+13`; count `(n)` in TEXT_DIM right‑aligned at `ctrlRight`; a 1px RULE across the row's top edge for every heading but the first.
*Operate:* `Enter` / `Left` (close) / `Right` (open) / tap anywhere on the heading toggles. A closed group is never a hidden group — its title and count are on screen.

**INFO ROW** — label on line 1, a read‑only value on line 2 right‑aligned in TEXT_SOFT, and a `[ Read more ]` button `[ctrlRight-56, ly-2, 56, 11]` (hit rect = `ctrlRect`). Visibly a button and a value, never a switch. `Enter` / tap opens the detail dialog.

**FOOTER / DIALOG BUTTON** — 1px BORDER frame, PANEL fill, centred label; the primary (PLAY, and a dialog's default action) inverts: FOCUS fill, INK label, no shadow.

### 3.5 Commit, save, and undo

* Every commit calls `setValue` then `SOUND.ButtonClick` then schedules a save.
* **Saves are debounced**: `saveSettings()` runs on `pointerup`, on `keyup`, after 250 ms idle, and unconditionally on leaving the screen. A drag never hammers `localStorage`.
* **The boolean is consumed at every write site.** `saveSettings() === false` sets `win.saveFailed = true`, which paints `NOT SAVED` in the title bar (WARN) and raises a one‑per‑session dialog: *"Your settings could not be saved. This browser is blocking storage; private windows often do. Your changes will work until you close the tab."* This is new behaviour — all three current call sites discard the boolean.
* **Per‑row revert**: `Backspace` on the focused row, and a `[ Reset ]` button inside the detail dialog, call `setValue(section, key, DEFAULTS[section][key])` — which `settings.js:210-214` turns into deleting the override. The help status line always names the default when the row differs from it.
* **Global reset** goes through a Yes/No dialog (`R` never fires bare — today `launcher.js:132` wipes 171 keys on one keystroke). "Yes" calls `resetToDefaults()` **and reads its return value** (see §9 companion change) plus `resetPrefs()`.

### 3.6 Dialogs — `src/ui/settingsDialog.js` (OURS, no ARENA2 art)  <!-- DELETED from the plan: folded into settingsWindow.js -->

One chrome for all of them. Panel is centred **on the page**, not on 320×200:

```
w = Math.min(pageW - 12, 240)
h = 6 + titleH + bodyLines*LINE_H + 4 + btnH + 6
x = Math.floor((pageW - w)/2), y = Math.max(4, Math.floor((pageH - h)/2))
dim   = SCREEN_DIM over the whole CANVAS   (nativePanel.js:26)
frame = 1px BORDER, fill PANEL_DEEP
btnH  = Math.max(14, TAP);  buttons right-aligned, 6 apart, width = max(44, measure+12)
```

Body text is wrapped with `wrapText(font.fnt, s, w - 12)`; if the body exceeds the panel it scrolls with Up/Down and drag. **A tap anywhere outside the panel cancels** (equivalent to the rightmost/negative button) — a modal can never trap. `Escape` closes; `Left`/`Right` pick a button; `Enter` presses.

Five dialogs:
1. **detail** — see §4.3. Buttons `[ Reset ] [ Close ]` (`Reset` omitted when the value equals its default or the row is not operable).
2. **confirm** — title, body, `[ Yes ] [ No ]`, `No` focused by default.
3. **choice** — the enum's value list, one row of height `max(14, TAP)`, scrollable, current marked with a `>` caret and a FOCUS fill. Tap = pick + close.
4. **colour** — four NUMBER rows (Red / Green / Blue / Opacity, 0..255, step 5, `Shift` = 1) reusing the number widget, a 40×16 live preview swatch, `[ Accept ] [ Cancel ]`.
5. **legend** — the `?` button: the keyboard/mouse/touch contract in plain words. It **never opens by itself.**

---

## 4. How `unavailable` and `stored` are shown honestly

### 4.1 The group is the disclosure

`WORKS NOW (n)` / `SAVED FOR LATER (n)` / `NOT AVAILABLE HERE (n)` — always present with a live count, never filtered away. This satisfies `settings.js:78-81` literally ("*a hidden setting is a setting the player cannot find out about*") while keeping the default view to one short group. No `stored` or `unavailable` row can ever be mistaken for a working one, because reaching it requires opening a group whose heading says what it holds.

### 4.2 Per‑row treatment

| tier | control | label colour | value column | status line |
|---|---|---|---|---|
| `live` | fully operable | TEXT_SOFT (TEXT when changed) | formatted value | `Now 50%.  Default 50%.` |
| `stored` | fully operable (it really round‑trips) | TEXT_SOFT | formatted value + a 5×5 hollow BORDER square at `[rx+rw-CTRL_W-8, ly+1, 5, 5]` | `Saved for later - nothing in the port reads this yet.` |
| `blocked` | **none drawn** | TEXT_SOFT (**not dimmed**) | value + padlock, TEXT_DIM | the `novalues` / `norange` sentence |
| `unavailable` | **none drawn** | TEXT_SOFT (**not dimmed**) | **READOUT word** + padlock, TEXT_DIM | `Fixed here - ` + `UNAVAILABLE[key]` verbatim |

The label keeps full contrast for `blocked` and `unavailable`. Dimming a label makes a setting look like broken junk; it is not junk, it simply does not apply here.

### 4.3 The READOUT — what you get instead

An `unavailable` row draws **no box, no trough, no well, no pill**. Where its control would be, it prints a fact about what the port actually does. `n/a` tells a player they were denied something; `classic` tells them what they are playing.

| key | readout | detail‑dialog "instead" line |
|---|---|---|
| `Enhancements/EnhancedCombatAI` | `classic` | You get Daggerfall's own enemy behaviour, exactly as it shipped. |
| `Enhancements/AdvancedClimbing` | `classic` | You get Daggerfall's own climbing, exactly as it shipped. |
| `Enhancements/LypyL_ModSystem` | `none` | Nothing to add yet - when add-ons arrive they will be listed on this page. |
| `Enhancements/AssetInjection` | `none` | (same) |
| `Enhancements/CompressModdedTextures` | `none` | (same) |
| `Experimental/CustomBooksImport` | `none` | (same) |
| `Daggerfall/MyDaggerfallPath` | `your files` | The game reads the files you chose, straight from this browser. |
| `Daggerfall/MyDaggerfallUnitySavePath` | `this browser` | Saves live in this browser and survive a reload. |
| `Daggerfall/MyDaggerfallUnityScreenshotsPath` | `downloads` | Pictures go wherever your browser puts downloads. |
| `Video/ResolutionWidth` / `Height` | `your window` | The picture already fills the window you give it. (dialog shows the live canvas size) |
| `Video/ExclusiveFullscreen` | `browser` | Use your browser's own fullscreen - F11 on a desktop. |
| `Controls/EnableController` | `no gamepad` | Keyboard, mouse and touch all work today. |
| `Controls/Joystick*` (4) | `no gamepad` | (same) |

The words *unsupported*, *broken*, *missing* and *not implemented* appear nowhere on this screen — pinned (T2).

**Detail dialog contents** (F1, `?`, `Enter` on a non‑operable row, or tapping the help panel):

```
<curated label>
<curated help, wrapped>
Daggerfall Unity calls this "<SETTINGS_LABELS[alias]>".        (omitted when no alias)
<SETTINGS_INFO[alias], wrapped>                                 (omitted when absent)
Now: <display>    Default: <display of DEFAULTS[section][key]>
<tier sentence>
Fixed here - <UNAVAILABLE[key]>                                 (unavailable only)
<instead line>                                                  (unavailable only)
Saved as [<Section>] <Key>
                                              [ Reset ]  [ Close ]
```

This is the **only** place the raw ini key appears, and the only place DFU's own strings are shown — which finally gives `settingsText.js` a production consumer (it currently has none).

### 4.4 The pane header tally

The pane header prints, computed live from `tierOf` (never typed): `Video - 1 works now, 61 saved, 4 not here`. A player who opens Video learns the truth about this port in one line before touching anything.

---

## 5. The mod manager's home

Category 7, `mods`, is a permanent rail plate. Its list, top to bottom:

1. **INTRO BLOCK** — a drawn, inert, correctly‑sized frame at `[list.x + 4, list.y, list.w - 8, 44]`: 1px BORDER, PANEL_DEEP fill, an **inverted** bevel (no raised edge, no arrows, no scrollbar) so nothing about it invites a press. Header `INSTALLED ADD-ONS` in HEADING at `+3,+2`; centred `No add-ons installed` (TEXT_DIM) at `+18`; centred `This is where they will be listed.` (TEXT_SOFT) at `+28`. It is focusable; focusing it writes its explanation into the help panel.
2. **`WORKS NOW (1)`** → the info row `Where Your Game Files Came From`, value from `deps.dataSourceLabel()` (§7.4): `bundled with the page` / `files you chose` / `saved in this browser`. `[ Read more ]` explains how a browser build reads ARENA2. **No `Change…` button** — re‑running `ensureArena2` requires `clearStoredData()`, which would wipe the player's ingested data with no rollback.
3. **`NOT AVAILABLE HERE (7)` — open by default, only in this category.** The seven keys of §1.7, each with its readout, padlock and verbatim reason. Everywhere else hiding a dead switch behind a collapsed group is kindness; here an empty page would read as an unexplained blank, and the intro block has already told the truth at the threshold.

**How it becomes real without redrawing the map.** When a mod system lands: the intro block's rect becomes the mod list (each row an ordinary `switch` with a load‑order number, using the row model unchanged and the list's existing scroll); the four `Enhancements/*` + `Experimental/CustomBooksImport` keys are deleted from `UNAVAILABLE` in `settings.js:85-88`; `tierOf` starts returning `stored`/`live`; the padlocks and readouts vanish; the group headings and the tally recompute themselves. **No new page, no new rail plate, no moved key, no relearned navigation, and no change to `settingsMap.js`.** That is the test of whether the home is real.

---

## 6. Readability rules

1. **No ini keys on a row.** Ever. The raw `[Section] Key` lives in the detail dialog only.
2. **No raw values.** `0.5` → `50%`; `12` → `12 hours`; `2` → `Climate Only`; `True` → `On`; `''` → `default`. This single rule answers most of "it's too technical", and it costs nothing in parity because the words and their order are DFU's own `SetIndicator` lists.
3. **Type scale.** FONT0003 (`fixedWidth 5`, `fixedHeight 7`) for every readable string; `LINE_H = 9` (1.29× leading inside a block); FONT0002 (5px) is **banned** — nothing a beginner must read is drawn smaller than the body. Only one font is loaded, so a missing FONT0000 can never cost the screen.
4. **Minimum on‑screen text size: 14 CSS px.** Guaranteed by the `s >= 2` floor for any viewport ≥ 312 × 300 CSS px. Pinned (T8d).
5. **Two‑line rows, always.** Label above, control below, `ROW_BASE = max(18, TAP)`. Labels wrap (≤ 3 lines); **nothing is ever truncated with an ellipsis** — a truncated label is a lie about the setting.
6. **Help is a permanent panel, never a tooltip.** Hover does not exist on a phone and a delayed tooltip is invisible to anyone scanning. `HELP_LINES` (3 wide / 4 narrow) of wrapped help plus one status line, always filled, updated identically by arrow keys, hover, tap and scroll. The wrap budget is pinned (T3) against the narrowest supported width, so no help sentence can ever overflow: if a string does not fit, the **pin fails and the copy is shortened** — the copy is ours.
7. **Long prose lives in the detail dialog**, which scrolls. The strip carries a sentence; the dialog carries the essay.
8. **First contact is a sentence.** Selecting a category writes its blurb into the help panel before any row is focused.
9. **Colour roles** (all measured against `PANEL`, WCAG 2.x contrast):

| role | RGB | ratio vs PANEL | use |
|---|---|---|---|
| `INK` | 24, 22, 18 | — | canvas backdrop; text on filled buttons |
| `PANEL` | 44, 40, 32 | 1.00 | page and row ground |
| `PANEL_DEEP` | 28, 26, 20 | 1.35 | title/help/footer bars, wells, tracks |
| `RULE` | 74, 68, 52 | 1.9 | 1px separators only (never carries meaning) |
| `BORDER` | 150, 140, 110 | **4.6 : 1** | every widget outline (≥ 3:1 required by 1.4.11) |
| `TEXT` | 243, 239, 44 | **12.0 : 1** | DFU default gold; values, changed rows, scrollbar thumb |
| `TEXT_SOFT` | 214, 206, 170 | ~9 : 1 | row labels |
| `TEXT_DIM` | 160, 155, 135 | **5.3 : 1** | readouts, counts, status line |
| `HEADING` | 232, 148, 56 | ~5.6 : 1 | group headings, category title |
| `FOCUS` | 196, 178, 96 | **6.9 : 1** | focused row/plate/button fill; label drawn in `INK` at **8.5 : 1** |
| `ON_FILL` | 108, 166, 74 | 5.0 : 1 | switch on |
| `OFF_FILL` | 28, 26, 20 | 1.35 | switch off (its BORDER carries the shape) |
| `KNOB` | 214, 206, 170 | ~9 : 1 | switch knob, slider knob |
| `WARN` | 222, 96, 48 | ~4.6 : 1 | `NOT SAVED` |

No zebra striping (a 1.1:1 band does nothing but add a second ground to test against); rows are separated by position and by the focus fill.
10. **Focus is never colour‑only and never 1px.** The focused row carries **four** signals: a 2‑px `FOCUS` tick at its left edge, a full‑row `FOCUS` fill, a `>` caret glyph before the label, and the label redrawn in `INK`. It survives greyscale, blur and a bad monitor.
11. **State is never colour‑only.** Every row carries a WORD (`On`/`Off`/the readout), a shape (pill position, padlock, hollow square), the group it sits in, and the help status sentence.
12. **DFU's `+1,+1` shadow** on all body text via `shadowText`; omitted only inside filled buttons.
13. **No motion, no animation, no timed reveals.** A screenshot of the screen is the whole truth about the screen.
14. **Sound sparingly:** `ButtonClick` on every commit and button press (DFU's law); `DungeonDoorOpen` on Sound Volume release; **nothing on cursor movement**.

---

## 7. Modules

### 7.1 New files

| file | exports |
|---|---|
| `src/ui/settingsMetrics.js` | `PAGE_W`, `MIN_PAGE_W`, `MIN_PAGE_H`, `settingsMetrics(canvas, opts)`, `pointToPage(m, px, py)`, `tapMin(m)` |
| `src/ui/settingsMap.js` | `CATEGORY_IDS` (ordered 7), `KEY_CATEGORY` (171 entries), `KEY_ORDER`, `categoryOf(key)`, `keysOf(catId)` |
| `src/ui/settingsCopy.js` | `CATEGORIES` (`{id,title,blurb}`×7), `LABELS`, `HELP`, `READOUT`, `INSTEAD`, `DFU_TEXT_KEY`, `TIER_TEXT`, `DIALOG_TEXT`, `labelOf(key)`, `helpOf(key)` |
| `src/ui/settingsLaw.js` | `ENUM_LAW`, `NUMBER_LAW`, `TEXT_LAW`, `COLOUR_KEYS`, `BLOCKED_REASON`, `widgetFor(key)`, `formatValue(key, raw)`, `parseColour(hex)`, `stepValue(key, raw, dir, coarse)` |
| `src/ui/settingsWidgets.js` | `drawSwitch/drawEnum/drawNumber/drawColour/drawText/drawReadout/drawGroup/drawInfo/drawButton`, `drawTriangle(renderer,m,rect,dir,color)`, `drawPadlock(...)` — each takes `(renderer, m, font, item, state)` and draws **only** inside the rects `layout()` produced |  <!-- DELETED from the plan: folded into settingsWindow.js -->
| `src/ui/settingsDialog.js` | `layoutDialog(font, m, {title, body, buttons, list})`, `drawDialog(renderer, m, font, d)`, `dialogHit(d, vx, vy)` (returns a button id or `'outside'`) |  <!-- DELETED from the plan: folded into settingsWindow.js -->
| `src/ui/settingsWindow.js` | `class SettingsWindow` — see 7.3 |
| `src/systems/uiPrefs.js` | `PREF_DEFAULTS`, `getPref(k)`, `setPref(k,v)`, `allPrefs()`, `resetPrefs()`. Storage key **`dagger.ui.v1`**, separate from `dagger.settings.v1`. Keys: `textScale` (0\|1), `category` (id), `open` (`{"video:stored":true,…}`), `seenLegend` (bool). Never touches the 171 — `test/settings.test.js:35` pins `ALL_KEYS.length === 171` and a 172nd key would break parity. |
| `src/ui/fullscreen.js` | `fullscreenSupported()`, `applyFullscreen(canvas)`, `isFullscreen()` — the consumer that makes `Video/Fullscreen` live (§9) |  <!-- DELETED from this slice: Video/Fullscreen stays unavailable, browser-owned -->

### 7.2 Existing modules reused (unchanged)

`nativePanel.js` (`drawRect`, `shadowText`, `SCREEN_DIM`, `DEFAULT_TEXT_COLOR`, `DEFAULT_SHADOW_COLOR`) · `text.js` (`makeFont`, `measureText`, `drawText`) · `talkWindow.js` (`wrapText`) · `settings.js` · `settingsText.js` (**first production consumer**) · `audio.js` + `soundClips.js` · `shared.js` (`ensureAudio`) · `touch.js` (`isTouchDevice` **only** — `attachTouch` is never called here).

**Never imported by this screen** (pinned, T14): `messageBox.js`, `listPicker.js`, `nativePanel.loadImg`, `chargenArt.js`. Their art is not preloaded before the game and both hard‑code the 320×200 metric.

### 7.3 `SettingsWindow`

```js
new SettingsWindow({ onLaunch, dataSourceLabel })
// overlay contract, satisfied so the future pause route needs no host change:
isChoiceWindow = true
done
input(code, e)                 // raw e.code
click(vx, vy)                  // PAGE coords
move(vx, vy) / up(vx, vy) / cancel()   // drag + scrub
wheel(dir)
draw(renderer, canvas, font)
layout(canvas)  -> { m, mode, page, title, rail|catbar, pane, list:{items, rect, scrollbar},
                     help:{rect, lines, status}, footer:{help, reset, play}, dialog|null,
                     hit:[{id, rect, kind}] }   // ONE source read by draw, click AND the probe
probe()         -> the plain object window.__settings() serialises
```

`draw()` and `click()` read the value returned by a single `layout(canvas)` call and nothing else. This is `launcher.js:153-156`'s own audit law and it is not negotiable: the launcher shipped keyboard‑only, and its first fix "worked" while still drawing PLAY where no finger could reach because draw and hit‑test held two copies of the coordinates.

**Focus ring.** Three zones: `NAV` (rail plates / category bar), `LIST`, `FOOTER`. `Tab`/`Shift+Tab` cycles `NAV → LIST → FOOTER → NAV`. The focused zone is unambiguous because the focused *item* always carries the four‑signal treatment of §6.10.

**Keyboard (raw `e.code`).**

```
Tab / Shift+Tab   next / previous zone
Up / Down         move within the zone (NAV: category; LIST: item; FOOTER: nothing)
Left / Right      operate the focused thing (NAV in narrow: prev/next category;
                  FOOTER: pick a button; LIST: per widget, §3.4)
Shift+Left/Right  coarse step / first-last
Enter / Space     activate (§3.4); in NAV: enter the list; in FOOTER: press
Escape            close the top dialog if one is open; OTHERWISE save and leave.
                  Escape NEVER asks a question - launcherScene.js:16-20's NEVER TRAPS law.
PageUp / PageDown one page, focus to the first item of the new page
Home / End        first / last item
Backspace         reset the focused row to its DFU default
F1 or Slash       detail dialog for the focused item
Digit1..Digit7    jump to category N
BracketLeft/Right previous / next category   (kept from launcher.js:130-131)
KeyR              Reset - ALWAYS through the Yes/No dialog, never bare
```
No type‑to‑jump (it collided with `R`/`Q`/`E` in the reviewed designs). Everything else is swallowed; the host `preventDefault`s as `launcherScene.js:45` already does.

**Mouse.** `pointerdown` → `pointToPage` → `hitTest`. Click a rail plate / category arrow → select. Click an unfocused row → focus only. Click the focused row's `labelRect` → toggle (switch only), else nothing. Click its `ctrlRect` sub‑rects → operate. Drag a track → scrub. Drag the scrollbar thumb → scroll. Wheel over the list → **one item per notch, selection untouched, never a value** (`listPicker.js:111-115`'s law). A click that hits nothing is consumed and does nothing — a stray click on a settings screen must never fall through.

**Touch — the scar, closed by construction.**
1. Touch has **no separate input path**: `pointerdown/move/up/cancel` fire for touch on every browser we target and `touch-action: none` is already set on `#c`.
2. `attachTouch` is **not** used. It builds F5/F6/☰/C/SV/LD/jump/stick over the screen and claims the whole left half of the viewport for a movement joystick — which is where every row's label lives.
3. **Minimum target, in SCREEN pixels: 44.** `TAP = ceil(44/s)` in page units, and it drives `ROW_BASE`, `GROUP_H`, `CAT_H`, `FOOT_H`, rail `plateH` and every dialog button. Hit rects are allowed to be larger than what is drawn (a 5×7 drawn triangle hits 28 × rowH). If the rail cannot hold 7 tap‑sized plates the layout falls back to narrow — the rule is enforced in `layout()`, not hoped for.
4. **A drag suppresses the tap.** A `pointerdown`+`pointerup` inside 400 ms having moved < 4 page units is a TAP; anything longer or further is a DRAG. On the list body a drag scrolls (one item per `rowH` of travel); on a track it scrubs. Scrolling a list of toggles can therefore never flip one.
5. **Tap slop**: a `pointerdown` that hits nothing is re‑tested against rows, plates and footer buttons inflated by 3 page units and snaps to the nearest.
6. **Long press (450 ms)** on any item opens its detail dialog — the touch equivalent of `F1`, with `[ Reset ]` inside it. It is a convenience only: **no gesture is load‑bearing.** The tap/long‑press boundary is exactly 400/450 ms with no dead zone in between (a 420 ms press resolves as a long press).
7. **The exit is always on screen and always fat**: PLAY is `78 × FOOT_H-2` in the bottom‑right, drawn in every mode, and a dialog is dismissed by tapping outside it. Pinned (T8c, T9).

### 7.4 `src/scenes/launcherScene.js` — rewritten

```js
export async function runLauncher(canvas, renderer, status) {
  let font;
  try { font = makeFont(renderer, new FntFile().load(await getBytes('FONT0003.FNT')), 'FONT0003'); }
  catch (e) { console.warn('[settings] FONT0003.FNT unavailable; skipping the settings screen', e); return; }
  // AUDIT: boot audio HERE. main.js:65 runs this scene before the splash's
  // ensureAudio, so audio.enabled was false and every playOneShot in the old
  // launcher was silently a no-op. Un-awaited: audio.ensure creates the
  // context in its synchronous prefix and attaches its own gesture resume
  // (audio.js:69-87), which is all the volume preview needs.
  ensureAudio(getBytes);
  ...
}
```
Listeners registered **and released on exit**: `keydown` (window), and on the canvas `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `wheel`. Today only `pointerdown` is attached, which is why no draggable or scrollable control could ever have worked here.

`deps.dataSourceLabel` is supplied from a new `export function dataSourceLabel()` in `src/scenes/dataSource.js`, set by whichever branch `ensureArena2` took (`'bundled with the page'` at the `fetch('./arena2/PROBE')` branch, `'saved in this browser'` at the IndexedDB‑manifest branch, `'files you chose'` after the picker). If the export is absent the Mods info row is omitted.

Probe surface `window.__settings()` replaces `window.__launcher()`; it reports `{ up, mode, metric:{s,pageW,pageH,ox,oy}, category, focus:{zone,index,key}, tally, groups, items:[{key,label,widget,tier,display,changed,rect}], help:{lines,status}, hit:[{id,kind,rect}], dialog, canvas:{w,h}, saveFailed }` — **every rect in SCREEN pixels**, because a probe that guessed coordinates read a working screen as trapped (`launcherScene.js:70-75`).

### 7.5 Retired

`src/ui/launcher.js` is DELETED (RETIRED). `tools/launcherProbe.mjs` is replaced by `tools/settingsProbe.mjs`. `test/settings.test.js`'s two `LauncherWindow` tests (`:165-202`, `:215-232`) are rewritten against `SettingsWindow` (see T8/T11) — note that they must assert in **screen** pixels, because the new `layout()` returns page‑space rects and `rect[0]+rect[2] <= 393` would otherwise be vacuously true.

---

## 8. Test plan

New file `test/settingsUI.test.js` unless noted. Real‑font assertions live behind the existing `skip: skipReal` / `ARENA2` convention (`test/audit18_ui_native.test.js:36`); every other pin runs font‑free using the conservative upper bound `maxWidth(s) = s.length * (5 + 1)` (FONT0003 `fixedWidth 5` + `FNT_GLYPH_SPACING 1`), which can never under‑estimate.

**T1 — the map is total and disjoint.** Every `ALL_KEYS` entry appears in exactly one category; `KEY_CATEGORY` contains no key outside `ALL_KEYS`; total 171; per‑category counts are exactly `21/16/5/66/37/19/7`; `KEY_ORDER` is unique within each category. *A DFU re‑bake that adds or renames a key fails the build instead of quietly dropping a row off the screen.*

**T2 — copy.** Authored labels ≤ 26 chars; authored help ≤ 100; blurbs ≤ 100; every authored string matches `/^[\x20-\x7E]+$/`; the banned‑word sweep (`unsupported|broken|missing|not implemented|n\/a`) finds nothing; every `DFU_TEXT_KEY` alias resolves in `SETTINGS_LABELS`; every `UNAVAILABLE` key has a `READOUT` and an `INSTEAD` line; derived labels (rule 2 of §1.1) all wrap to ≤ 2 lines at 216 px and ≤ 3 at 138 px.

**T3 — the help panel cannot overflow.** For every category blurb and every help string (authored + `SETTINGS_INFO` fallbacks), `wrapText` with the conservative measure fits `HELP_LINES` at the narrowest help width (`MIN_PAGE_W - 8 = 148`) and at 312. Plus the same assertion with the real font under `skipReal`. *This is the pin that would have caught the winning design's 15‑of‑32 overflow.*

**T4 — widget law is total.** `widgetFor` returns a known kind for all 171. Every `enum` has ≥ 2 values, a citation string and an `encode`; token enums' defaults are members of their own list; index enums' defaults parse to a valid index. Every `number` has `min < max`, `(max-min)` divisible by `step`, a `format`, and a `source`. Every colour key's default is `/^[0-9A-F]{8}$/i`. Every `blocked` key has a reason. No `unavailable` key resolves to an operable kind.

**T5 — range equals consumer clamp.** For each `NUMBER_LAW` key that is also in `LIVE`, read the consumer file named in `LIVE`, regex its `get(Float|Int)('S','K', min, max)` literals, and assert they equal the row's `min`/`max`. Concretely pins `MouseLookSensitivity` at `0.1..4.0` against `lookSettings.js:20`. Also: sweep `settingsLaw.js`/`settingsWindow.js` for any getter call passing a `min` without a `max` (that returns `NaN`, `settings.js:158`).

**T6 — tier honesty.** For every category: the three groups partition its rows; group counts equal the `tierOf` counts; no `unavailable` or `blocked` item exposes a `ctrlRect`; `live` is open by default; `stored` and `na` are closed by default **except** `mods:na`, which is open.

**T7 — one layout.** Drive `draw()` against a recording renderer (the `recorder()` helper used by `audit18_ui_native.test.js`) and assert (a) every emitted quad lies inside the page rect from `layout()`, and (b) for every entry of `layout().hit`, `hitTest(centre(rect))` returns that entry's `id`. *A second copy of the coordinates cannot survive this.*

**T8 — THE TOUCH‑REACHABILITY LAW.** For canvases `1920×1080, 1280×720, 1024×768, 1180×820, 844×390, 390×844, 360×640, 320×568`, each with `isTouchDevice()` stubbed true and false, and with `textScale` 0 and 1:
* **(a)** every rect in `layout().hit`, mapped to screen (`ox + x*s`, `oy + y*s`, `w*s`, `h*s`), lies inside `[0,W]×[0,H]`;
* **(b)** with touch true, every such rect's **short axis in screen px ≥ 44**;
* **(c)** a `play` entry exists in every configuration and is inside the canvas;
* **(d)** for every canvas with `W ≥ 312` and `H ≥ 300`, `m.s ≥ 2`, i.e. body text ≥ 14 screen px;
* **(e)** `hitTest(centre(play))` returns `'play'`, and driving that click sets `done` and fires `onLaunch` exactly once;
* **(f)** the metric table of §2.1 matches exactly.
This single test would have caught the phone text halving, the 8‑px picker rows, the off‑canvas PLAY and the under‑sized footer in the three reviewed designs.

**T9 — never traps.** For each dialog kind: `dialogHit` at a point outside the panel returns `'outside'` and cancels; `Escape` with a dialog open closes it and does **not** launch; `Escape` with none launches exactly once. Source pin on `launcherScene.js`: it adds `keydown`, `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `wheel` **and removes all six** on exit.

**T10 — save failure is visible.** Stub `localStorage.setItem` to throw; a commit sets `saveFailed`; the title‑bar string contains `NOT SAVED`; the warning dialog raises exactly once per session; and `resetToDefaults()` returns `false` (requires the §9 change) so the Reset flow reports the failure too.

**T11 — the lock‑out warning is a decision, not a notice.** Focusing `GUI/ShowOptionsAtStart` and pressing `Left` opens a confirm whose body matches `/\?launcher/`; choosing **No** leaves the value `True`; choosing **Yes** sets it `False`. Turning it back on raises no dialog. *(Replaces `test/settings.test.js:215-232`.)*

**T12 — the store stays 171.** `ALL_KEYS.length === 171` re‑asserted after the UI modules load; `uiPrefs` writes only `dagger.ui.v1`; `resetToDefaults()` leaves `dagger.ui.v1` untouched (the screen's Reset clears both, and says so in the confirm).

**T13 — no ARENA2 art dependency.** Source pin: `settingsWindow.js`, `settingsWidgets.js` and `settingsDialog.js` import neither `messageBox.js` nor `listPicker.js` nor `loadImg`.  <!-- DELETED from the plan: folded into settingsWindow.js -->

**T14 — audio really boots.** Source pin: `launcherScene.js` imports `ensureAudio` from `shared.js` and calls it before the frame loop; `settingsWindow.js` contains `SOUND.DungeonDoorOpen` on the SoundVolume release path and does **not** call it inside a step handler.

**T15 — ASCII sweep.** Every string reachable by `drawText` from `settingsCopy.js` + `settingsLaw.js` + the window's own literals is ASCII 32..126.

**T16 — the probe taps what a finger taps.** `tools/settingsProbe.mjs` (Playwright, in the shape of the launcher probe it replaces) at 1280×800 **and** with `page.setViewportSize({width:390,height:844})` + touch emulation: assert the screen is up; assert every category is reachable; `page.tap()` the reported screen rect of a `WORKS NOW` row, then of its control, and assert the value changed and persisted through a reload; `page.tap()` the reported PLAY rect and assert the launcher closes. No coordinate is ever guessed.

---

## 9. LAW vs OURS, and the companion changes

### 9.1 DFU LAW — ported verbatim, cited

| Law | Citation |
|---|---|
| 171 keys, 13 sections, defaults | `SettingsManager` / vendored `defaults.ini.txt` → `settingsDefaults.js`, pinned `settings.test.js:28-41` |
| Typed getters and their failure modes (unparseable bool → `False`; unparseable clamped int/float → `MIN`; `GetString` raw) | `SettingsManager.cs:911-996` → `settings.js:163-195` |
| Booleans stringify capitalised `True`/`False` | C# `value.ToString()` → `settings.js:206-217` |
| Enum value **names and order** | `DaggerfallAdvancedSettingsWindow.cs:244-252, :277-282, :291-297, :298-305, :309-321, :327-341, :342-354, :360-379, :380-395` — table §3.2 |
| Volume `DisplayUnits = 100`; MusicVolume live on scroll; SoundVolume plays `DungeonDoorOpen` on mouse‑up | `:268-274` |
| `WeaponAttackThreshold` MaxCharacters 5, clamped `0.001..1.0` on save | `:444` |
| `SoundFont` is ReadOnly and is never written back; shows `default` when empty | `:264-267` |
| `MouseLookSensitivity` slider `0.1..16.0`, `GetValue() = Value/10` | `:253-263` (the port's range follows its consumer clamp — flagged in §3.2 and on the row's help line) |
| `ButtonClick` on every button press | `DaggerfallMessageBox.ButtonClickHandler:487`, precedent `messageBox.js:209-218` |
| Wheel = one row per notch | `ListBox`, precedent `listPicker.js:111-115` |
| Clamp selection to the visible range | `ListBox`, precedent `listPicker.js:102-103` |
| Scrollbar thumb = `DisplayUnits / TotalUnits` | `VerticalScrollBar.cs:187-198`, precedent `nativeTalk.js:82-83` |
| Glyph advance, space width, trailing spacing | `DaggerfallFont.cs:377-383`, `:623-627` → `text.js` |
| Default text colour + `+1,+1` shadow; `ShadowPosition = zero` inside filled buttons | `DaggerfallUI` → `nativePanel.js:24-25`; precedent `guildServiceWindow.js:175-177` |
| `ScreenDimColor` behind modals | `DaggerfallUI` → `nativePanel.js:26` |
| The launcher gate (wizard shown when unvalidated OR `ShowOptionsAtStart` OR a held key; skip straight to Options when the path is good) | `SceneControl.cs:46`, wizard `:154` → `main.js:65` |

### 9.2 OURS — the presentation split (Ledger A), flagged in each file's header

The **seven categories, their order, titles, blurbs and the whole key→category map**; every curated label and help sentence; the three tier **groups** and their headings, counts and collapse behaviour; `settingsMetrics` and every pixel rect on the screen; the colour palette and the focus treatment; the widget shapes (pill switch, ◄value►, track+knob, swatch, padlock) — all drawn from `drawRect`, because `FNT_ASCII_START = 33` means the classic fonts contain no arrow glyph; the dialog chrome; `window.prompt` for text and numeric entry; the READOUT words and the "what you get instead" lines; the Mods intro block; the port‑local `dagger.ui.v1` store; the Reset confirm, the `ShowOptionsAtStart` confirm and the save‑failure banner; the debounced save.

**Explicitly noted as a departure from DFU's own IA:** DFU's five pages (`gamePlay / interface / enhancements / video / accessibility`) and thirteen section titles are *its* window's taxonomy, baked and test‑pinned in `settingsText.js:11-28`. This screen replaces them with seven categories because DFU's advanced window reaches only 78 of our 171 keys and leaves 93 with no home, and because "audio" and "mods" must be top‑level per the ask. **DFU's own words survive verbatim** — every row's detail dialog prints `SETTINGS_LABELS` and `SETTINGS_INFO`, giving those two exports their first production consumer. This is a Ledger‑A row and must be recorded as one.

### 9.3 Required companion changes

1. **`src/systems/settings.js:232-235`** — `resetToDefaults()` must `return saveSettings();`. Today it discards the boolean, so a reset that failed to persist reports success.
2. **`src/systems/settings.js:64-101`** — move `'Video/Fullscreen'` out of `UNAVAILABLE` and into `LIVE` as `'src/ui/fullscreen.js'`. A settings toggle **is** the user gesture `canvas.requestFullscreen()` needs, so the reason "the browser owns fullscreen" is no longer true; `Video/ExclusiveFullscreen` stays unavailable. This gives the Video category a real `WORKS NOW` row. `src/ui/fullscreen.js` reads `getBool('Video','Fullscreen')`, calls `requestFullscreen`/`exitFullscreen` from the click handler, listens for `fullscreenchange` to write the value back, and reports `fullscreenSupported()` false (→ the row shows `not supported` as a readout) when the API is absent.  <!-- DELETED from this slice: Video/Fullscreen stays unavailable, browser-owned -->
3. **`src/scenes/dataSource.js`** — add `export function dataSourceLabel()` returning one of the three short strings of §5, set at each `ensureArena2` branch.
4. **`src/scenes/launcherScene.js`** — rewritten per §7.4.
5. **Deletions/rewrites:** `src/ui/launcher.js` DELETED; `test/settings.test.js:165-202` and `:215-232` rewritten (T8, T11); `tools/launcherProbe.mjs` → `tools/settingsProbe.mjs` (T16).

### 9.4 Explicitly **out** of this slice (record as Ledger rows)

* **The in‑game route.** `SettingsWindow` already satisfies the overlay contract (`isChoiceWindow` + `input(code,e)` + `click(vx,vy)` + `wheel(dir)` + `draw` + `done`), which is exactly the shape `dungeonContext.js:2324`, `worldModes.js:1174` and `townTalk.js:201` consume — but no pause window exists yet, so the only routes back in remain the `GUI/ShowOptionsAtStart` gate and `?launcher`. The confirm dialog names `?launcher` explicitly. Note the honest limit: the in‑game seam exposes `overlayClick`/`overlayWheel` but **no** `pointermove`/`pointerup`, so slider *drag* will not work in‑game until that seam grows — tapping the track will, so it is a convenience loss, not a trap. Say so in the Ledger row.
* ~~**`Video/FieldOfView` as a live setting.** `Math.PI/3` is hardcoded at five hosts. Wiring it is worth doing and is a separate commit with its own pin; until then the row is `stored` and operable (its range is DFU law).~~ **STALE - STRUCK (ROAD-G G7 records sweep, 2026-09-04).** *Shipped by the SETT/MENU view-settings slice and never struck here, so this bullet went on naming five `Math.PI/3` sites that no longer exist - the whole reason the cites had rotted. `src/ui/viewSettings.js:23` is `fieldOfView()`, `GetInt(sectionVideo, "FieldOfView", 60, 120)` verbatim (SettingsManager.cs:418, clamp 60..120), READ AT THE POINT OF USE so a change lands on the next frame; the five projections that carried a copy each read it now - `worldModes.js:4936`, `world.js:6530`, `interior.js:276`, `exterior.js:3263`, `dungeon.js:675`. Wiring it also corrected the shipped view: every copy sat at 60, which is DFU's MINIMUM and not its 65 default.*
* **`GUI/InteractionModeIcon` and the other un‑vendored enums.** Extend `scripts/bakeSettingsText.mjs` to emit a `SETTINGS_VALUES` table from `vendor/dfu-settings/GameSettings.txt` and, where that file is silent, vendor the lists from `DaggerfallAdvancedSettingsWindow.cs`. Until a list is vendored the key stays `blocked('novalues')`. **Never guess an option name.**
* **`index.html`'s `user-scalable=no`.** It removes the only text‑size escape hatch a low‑vision player has on a WebGL canvas. Removing it is a one‑token change with whole‑port consequences (the game canvas wants it) and belongs in its own row; the in‑screen `Text Size` row is this slice's answer.
* **Safe‑area insets.** `viewport-fit=cover` is set with no `env(safe-area-inset-*)` anywhere in the tree, so on a notched phone the footer sits under the home‑indicator strip. A whole‑port row; note that this screen's `oy` letterbox partly absorbs it in comfort mode but not in portrait, where `oy = 0`.