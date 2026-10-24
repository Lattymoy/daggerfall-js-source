// @ts-check
// KETCH-LOOK (bible/11-Multiplayer/Sky-Ketch-Look.md section 2; slice KL1): HER LOOK'S SHARED NUMBERS - pure, a leaf (it
// imports nothing, so a renderer's pass, a probe and a test read it alike).
//
//   THE LIGHTS (KT_MEANING): the four meanings and the beat, each a colour that already had its home - the lamps'
//     (world/ketch/ketchModel.js KT_LAMP), the lit things' (scenes/ketch/ketchDeckHost.js KT_GLOWS), the Hour's red and its
//     moment (world/superDungeon/sdLook.js SD_LIGHT). A leaf cannot import a ship builder or a scene, so the numbers are
//     written here and test/world/ketch/ketch_atmos.test.js pins each equal to its home: nothing is re-pointed.
//   THE VALUE LADDER (KT_LADDER): the display luma each rung is held to, as tools/ketchLabProbe.mjs measures it (Y' =
//     0.2126R' + 0.7152G' + 0.0722B' over the encoded frame).
//   THE PALETTE CONTRACT (KT_PAL, KETCH-LOOK KL2): her ramps as ART_PAL indices, dark to light, each step's fallback
//     colour beside it. Daggerfall's textures are 8-bit indices into ART_PAL.COL; hers are too, resolved at upload
//     through the player's own palette (formats/dfPalette.js) - or, with no game data (the lab, a test, a data-less
//     boot), drawn in the fallback colours: the port's own, each within 24 (sRGB distance) of its entry and never one
//     of the file's bytes - taken from the Ketch's and the Hour's ramps where one stood that near (world/ketch/
//     ketchArt.js KT_RAMP, world/superDungeon/sdLook.js SD_RAMP), painted fresh where none did, one colour an index
//     (test/world/ketch/kt_look_palette.test.js holds all of it, against ART_PAL itself with ARENA2_PATH). The indices
//     are code, as characters/dyes.js METAL_TABLES' are: her metal is Daggerfall's Dwarven (METAL_TABLES.Dwarven,
//     144-159 - every Dwarven blade and cuirass in the Iliac Bay), her steel the darkest greys under METAL_TABLES.Iron's.
//
// Not a DFU member. Ledger A (KETCH).

const f3 = (a, b, c) => Object.freeze([a, b, c]);

/** THE LIGHTS, linear RGB as the renderer takes them: LAMP the made way (`lampBelow` its warmer self below decks), AETHER
 *  her soul true (`aetherTrue` a true resonator's), EMBER out of tune or about to fail, RED refused or the end, and `beat`
 *  the white-gold of a beat landing, once. */
export const KT_MEANING = Object.freeze({
  lamp: f3(1.0, 0.8, 0.5), lampBelow: f3(1.0, 0.7, 0.4),
  aether: f3(0.5, 0.85, 1.0), aetherTrue: f3(0.55, 0.9, 1.0),
  ember: f3(1.0, 0.4, 0.15),
  red: f3(1.0, 0.32, 0.26),
  beat: f3(1.0, 0.92, 0.62),
});

/** THE VALUE LADDER (display luma): L0 the land far below (by day at most `dayMax` and under her hull's mean, by night at
 *  most `nightMax`); L1 her structure - on the open decks at noon the floor (the frame's lower 30%) at mean `noonFloorMean`
 *  and p95 `noonFloorP95` at most, nothing over `max`, at dusk p50 at least `duskP50`, at night mean at least
 *  `nightMean`; below decks p50 at least `p50` at every hour, a lamp's pool at most `pool`, a telegraph's floor at most
 *  `telegraphFloor` under every lamp; the cabin's p50 in `p50`; L2 ambient light (cages, edge lines, gauge faces, ports by
 *  night); L3 signals (aether and ember glass, needles, lit bands); L4 critical (a telegraph's core, a tell at its
 *  hottest, the beat) at least `min`, peaking at `peak` - render/airPass.js AIR_BRIGHT_THRESHOLD, where bloom begins. */
export const KT_LADDER = Object.freeze({
  deep: Object.freeze({ dayMax: 0.40, nightMax: 0.06 }),
  deck: Object.freeze({ noonFloorMean: 0.22, noonFloorP95: 0.30, max: 0.5, duskP50: 0.10, nightMean: 0.06 }),
  below: Object.freeze({ p50: 0.08, pool: 0.30, telegraphFloor: 0.25 }),
  cabin: Object.freeze({ p50: Object.freeze([0.15, 0.35]) }),
  ambient: Object.freeze([0.30, 0.45]),
  signal: Object.freeze([0.5, 0.8]),
  critical: Object.freeze({ min: 0.7, peak: 0.85 }),
});

const ramp = (idx, fallback) => Object.freeze({ idx: Object.freeze(idx), fallback: Object.freeze(fallback.map((c) => f3(c[0], c[1], c[2]))) });
/** THE PALETTE CONTRACT: each ramp `{ idx, fallback }`, ART_PAL indices dark to light and the port's colour for each.
 *  `dwarven` her plate, trim and rails - METAL_TABLES.Dwarven's own steps; `rubbed` its worn edge, `glint` its brightest;
 *  `burnished` the Dwarven ramp's light end (the bridge's instruments); `rust` its two darkest seams and the oil under a
 *  vent; `copper` pipes and coils (181 stands darker than 183 in the palette); `verdigris` recesses, weeping below seams;
 *  `steel` her machinery and the floor under a fight - the darker metal, so a telegraph owns it; `stone` Dwemer dressed
 *  stone, warm sand; `aether`, `ember`, `lamp` the three glasses; `gilt` the helm's and the chest's gold; `cloud` and
 *  `cloudBlue` cloud and steam; `field`, `meadow`, `soil`, `water` the painted land where no data stands. */
export const KT_PAL = Object.freeze({
  dwarven: ramp([159, 158, 156, 154, 152, 150, 148], [[62, 44, 24], [70, 52, 32], [92, 60, 24], [114, 96, 6], [138, 114, 0], [168, 153, 0], [198, 186, 0]]),
  rubbed: ramp([18], [[196, 146, 64]]),
  glint: ramp([145], [[240, 240, 48]]),
  burnished: ramp([150, 148, 146, 145], [[168, 153, 0], [198, 186, 0], [228, 222, 0], [240, 240, 48]]),
  rust: ramp([191, 190, 189, 187], [[32, 22, 14], [48, 30, 12], [51, 38, 18], [88, 58, 22]]),
  copper: ramp([189, 187, 185, 181, 183, 176], [[51, 38, 18], [88, 58, 22], [112, 84, 48], [138, 64, 34], [140, 98, 40], [180, 108, 84]]),
  verdigris: ramp([143, 141, 139, 137, 135, 133], [[52, 48, 44], [60, 60, 66], [48, 72, 96], [48, 102, 102], [60, 126, 126], [78, 144, 144]]),
  steel: ramp([223, 220, 95, 93, 91, 89, 87, 85], [[12, 12, 14], [30, 27, 25], [40, 42, 46], [66, 60, 54], [64, 68, 74], [86, 86, 92], [106, 112, 120], [120, 120, 138]]),
  stone: ramp([79, 77, 75, 73, 71, 69, 67], [[46, 42, 38], [72, 54, 34], [96, 74, 46], [122, 98, 62], [150, 126, 84], [174, 126, 78], [198, 156, 108]]),
  aether: ramp([108, 105, 102, 100, 98, 96, 80], [[54, 72, 90], [40, 96, 150], [66, 114, 180], [92, 140, 210], [126, 162, 228], [170, 226, 250], [214, 218, 226]]),
  ember: ramp([251, 247, 243, 240, 237, 234, 231], [[86, 38, 20], [110, 26, 12], [176, 58, 20], [192, 84, 30], [210, 120, 60], [234, 156, 48], [255, 188, 96]]),
  lamp: ramp([15, 13, 10, 5, 2, 1], [[228, 184, 100], [246, 192, 78], [255, 198, 84], [255, 204, 90], [246, 206, 120], [255, 228, 132]]),
  gilt: ramp([21, 18, 13, 9, 4, 1], [[186, 150, 78], [196, 146, 64], [246, 192, 78], [255, 198, 102], [246, 204, 114], [255, 228, 132]]),
  cloud: ramp([118, 116, 114, 112], [[138, 126, 112], [160, 166, 176], [182, 178, 170], [214, 220, 228]]),
  cloudBlue: ramp([83, 81, 80], [[150, 158, 172], [186, 192, 204], [214, 218, 226]]),
  field: ramp([207, 206, 205, 204, 203, 202, 201, 200, 199, 198, 197, 196], [[40, 40, 46], [36, 56, 46], [50, 45, 41], [48, 66, 30], [70, 88, 40], [54, 90, 36], [66, 96, 36], [96, 106, 52], [84, 120, 48], [90, 126, 54], [102, 138, 60], [108, 144, 66]]),
  meadow: ramp([172, 171, 170, 169, 168, 167, 166, 165, 164], [[42, 60, 42], [48, 66, 36], [54, 78, 48], [58, 88, 70], [66, 102, 66], [78, 108, 78], [88, 124, 98], [96, 132, 96], [108, 144, 108]]),
  soil: ramp([79, 77, 75, 73, 71], [[46, 42, 38], [72, 54, 34], [96, 74, 46], [122, 98, 62], [150, 126, 84]]),
  water: ramp([108, 107, 106, 105, 104], [[54, 72, 90], [54, 78, 102], [48, 84, 120], [40, 96, 150], [54, 96, 156]]),
});
