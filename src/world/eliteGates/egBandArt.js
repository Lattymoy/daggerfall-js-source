// @ts-check
// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7 (the band table) and
// 25.1): THE SPIRE'S BAND ART - each band's own dress, painted here in code into its own pseudo-archive
// (world/eliteGates/pseudoArchives.js EG_BAND_ARCHIVES: 38241 the Galleries, 38251 the Cairn, 38261 the Shade, 38271 the Wellhead).
// Nothing ships and nothing is read from the player's data (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA): the same
// pixels every boot, through the Hour's paint box (world/superDungeon/sdPixelKit.js) - 1-px bevels lit from the top-left, dark joints,
// ordered dither between a ramp's steps, and every texel forced into the band's own ramps at the end.
//
// EG-PLAY's halls wore the Hour's records (world/superDungeon/sdRealmArt.js) - "the Hour's art dresses the Spire" (EG-PLAY departure 3,
// EG-FULL layer three's "the band art is EG-G's"). Each band now paints the same RECORDS the halls are built with, under
// its own archive, and `egBandDress` moves a built model's sub-meshes onto it: the hall's geometry is unchanged, its dress
// is the band's. The records (EG_DRESS_RECORDS):
//   floor  0  the walk, the plates, the islands
//   brass  1  the rims, the kerbs, the posts, the shelves - the band's metal (gold leaf, bone, moon-silver, iron)
//   root   2  the undersides hanging into the void, and the passages' vaults
//   arena  4  the courts' plates - the quietest thing in each band, so the telegraphs own it
//   cobble 31 the walkways
//   edge   32 THE EDGE LINE's gold (section 25.3) - gold in every band, because gold means the way and "it holds"
//   molten 33 NEW: what was the edge line's gold on the magma and the fire channels (world/eliteGates/egHall.js) is the band's own
//             liquid light - molten orange in the Galleries and the Wellhead, soul-light in the Cairn, quicksilver in
//             the Shade - its emission held at or under 0.45 display luminance (section 11.9: where magma meets a fight
//             floor it never outshines a telegraph)
//   pillar 56 the walls, the passages' sides, the arches
// Stone and metal are structure and do not glow (SD-LOOK's rule): the metal keeps SD_BRASS_EDGE_GLOW on its rubbed rows
// alone, the edge line its SD_EDGE_GLOW, the liquid its capped light; every other record's emission is black.
//
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md sections 1
// and 8): THE ACADEMY'S PICTURES. The ground's records were the Hour's painters in new ramps (flags, ashlar, rivets,
// cobble - "the Hour's motifs", the plan's "what was wrong"); each band now paints the Battlemages' academy in its realm's
// own forms (world/eliteGates/egKit.js EG_KIT_STYLE), and the kit's thirteen records - the ruin's, the wreck's and the halls' - are
// painted for the first time:
//   THE BROKEN GALLERIES - white marble flags veined grey, small blue-grey tesserae on the walks, fluted marble with gilded
//     fillets, egg-and-dart, polychrome voussoirs, Battlemages in procession on a blue ground, blue coffers with gold
//     rosettes, Battlemage-blue banners with the gold star in its ring, bronze tripods' gold flame, the Deadlands' red rock
//     under the courses;
//   THE SOUL CAIRN - slate-violet flags with bone lozenges, soul-light hairlines in the courts' joints (its own light),
//     bone-wrapped shafts, a frieze of skulls, an ossuary's wall of skulls, torn grey shrouds with the soul-gem, iron
//     lanterns' soul-gems (lit), packed bone and black roots under the courses;
//   THE SHADE PERILOUS - black glass split by moon-silver hairlines, half-obsidian shafts with silver arrises, faceted
//     cornices, thorn tracery, black banners with the silver crescent, ravens' feathers, silver moon-lamps, black-glass
//     stalactites veined silver;
//   THE HAVOC WELLHEAD - basalt bound in riveted iron, hexagonal basalt shafts in iron bands, Dremora on the march,
//     red-and-black war banners with Dagon's sigil, iron fire baskets, basalt prisms with capped molten seams, slag.
// Each band's ramps grow by the picture's needs (cloth, the deep stone, the fixture's metal, the flame, the walks'
// tesserae, the haze its foundations fade to - the band's own fog, world/eliteGates/egAtmos.js), and egBandPalette holds them all.
// Light where it means something, and nowhere else: the fixtures' flame (the band's lamps - the ruin's one emissive), the
// Cairn's soul-gems and soul-light hairlines, the Wellhead's molten seams, the liquid - each capped (EG_MOLTEN_LUMA_MAX,
// and EG_SEAM_LUMA_MAX for a light laid IN a fight floor). The banner's torn foot and the fixture's flames and grille are
// CUTOUTS (the renderer's RW1 holes - `{ cutout: true }` on the picture, the host's upload asks it). How each kit picture
// is worn (its texels a metre, which way its v runs, its bands): EG_KIT_MAP.
//
// EG-ZL (2026-10-12, sections 10.3, 25.2 and 25.7): THE BAND'S TELL RECORDS, under the band block's second archive (its
// own later records - world/eliteGates/pseudoArchives.js): a Beat's last 0.4 s burning the place's own white - the Steps' own dial at
// frame 10 and its falter (world/superDungeon/sdStepsArt.js beatArt) with the warning's light the danger palette's hazard colour
// (ui/eliteGates/egAccess.js - white, or High contrast's cyan, dashed) - dissolving out through the ordered dither, and its first
// frame dithering back in: the Steps' dissolve made in the picture (a cutout - the renderer's RW1 holes), so a kind of
// Beats stays one batched draw. Painted once a palette, as a span asks for it.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { SD_RAMP } from '../superDungeon/sdLook.js';
import { rng, noiseField, image, putTexel, scale, ramp, step, bevel, rivet, paletteOf, quantize, bayer, BAYER4 } from '../superDungeon/sdPixelKit.js';
import { SD_ART_SIZE, SD_ROOT_ART_H, SD_BRASS_EDGE_GLOW, SD_EDGE_GLOW } from '../superDungeon/sdRealmArt.js';
import { EG_BAND_ARCHIVES } from './pseudoArchives.js';
import { SD_REALM_ARCHIVE } from '../superDungeon/sdRealm.js';
import { beatArt, SD_STEPS_RECORD, SD_BEAT_EMBER_FRAME, SD_STEPS_ATLAS, SD_STEP_BEVEL } from '../superDungeon/sdStepsArt.js';   // EG-ZL: the Beat's warning, the place's white
import { SD_BEAT_DISSOLVE } from '../superDungeon/sdStepsModel.js';
import { SD_BEAT_SIZE } from '../superDungeon/sdSteps.js';
import { EG_DANGER_PALETTE_KEYS, egPaletteOf } from '../../ui/eliteGates/egAccess.js';
import { EG_KIT_RECORD, EG_KIT_RECORDS } from './egKit.js';   // EG-LOOK (Elite-Gates-Look.md section 8): the kit's records
import { EG_ATMOS } from './egAtmos.js';   // EG-LOOK: the haze the foundations fade to is the band's own fog

/** THE RECORDS each band paints (the Hour's own numbers - world/superDungeon/sdRealm.js - and the liquid's new 33). */
export const EG_DRESS = Object.freeze({ floor: 0, brass: 1, root: 2, arena: 4, cobble: 31, edge: 32, molten: 33, pillar: 56 });
/** @type {ReadonlyArray<number>} */
export const EG_DRESS_RECORDS = Object.freeze(Object.values(EG_DRESS));
/** EG-LOOK (Elite-Gates-Look.md section 8): EVERY RECORD A BAND PAINTS - the ground's (EG_DRESS_RECORDS, the ones a built
 *  model's Hour-archive faces move onto - egBandDress) and the kit's (world/eliteGates/egKit.js EG_KIT_RECORDS: the ruin, the wreck
 *  and the spans' pieces name them in the band's archive directly). What a band's dress puts up, holds whole and frees. */
/** @type {ReadonlyArray<number>} */
export const EG_BAND_RECORDS = Object.freeze([...EG_DRESS_RECORDS, ...EG_KIT_RECORDS]);
/** EG-LOOK: THE CUTOUT PICTURES - a texel under half alpha is a hole (renderer.js uploadTexture `{ cutout: true }`, RW1):
 *  the banner's torn foot, the fixture's flames and its grille's gaps. Every other picture is opaque. Their art carries
 *  `cutout: true` (it crosses the swap's worker with it), and the host's upload asks the renderer for it. */
export const EG_CUTOUT_RECORDS = Object.freeze([EG_KIT_RECORD.banner, EG_KIT_RECORD.fixture]);
/** The liquid's light at its brightest texel: at or under EG_MOLTEN_LUMA_MAX (section 11.9 - where magma meets a fight
 *  floor it never outshines a telegraph), never more than EG_MOLTEN_GLOW of its albedo. */
export const EG_MOLTEN_GLOW = 0.75;
export const EG_MOLTEN_LUMA_MAX = 0.45;
/** EG-LOOK: a light laid IN a fight floor - the Cairn's soul-light hairlines in the courts' joints, the Wellhead's molten
 *  seams in its mosaics (Elite-Gates-Look.md sections 1.2 and 1.4: "the band's own light, L2", "capped at L2 where it
 *  meets a fight floor") - held to L2's low end, under the liquid's own cap: the telegraphs stay the brightest thing there. */
export const EG_SEAM_LUMA_MAX = 0.3;

/** THE BANDS' RAMPS (sRGB 0-255, dark to light, five steps or more - section 25.1's), by band index. EG-LOOK adds each
 *  band's cloth (its banners), deep (the realm's stone under the academy's courses), fix (its fixtures' and chains' metal -
 *  bronze, black iron, silver, iron), flame (its lamps' light), tile (its walks' tesserae) and haze (its own fog, the
 *  foundations' tips - world/eliteGates/egAtmos.js EG_ATMOS fog). */
const r5 = (...s) => Object.freeze(s.map((c) => Object.freeze(c)));
/** A band's haze: its fog's colour (0-1, as sRGB bytes - SD_REALM_FOG's way) at its middle step, a step under and over. */
const hazeOf = (fog) => r5(...[0.5, 0.75, 1, 1.3, 1.6].map((k) => fog.map((c) => Math.round(Math.min(255, c * 255 * k)))));
const FIRE = r5([120, 30, 8], [180, 60, 14], [230, 96, 24], [255, 120, 30], [255, 176, 90]);
const SOUL = r5([40, 70, 86], [64, 112, 136], [90, 152, 180], [120, 200, 230], [176, 228, 244]);
const BONE = r5([92, 86, 74], [120, 112, 96], [150, 142, 122], [178, 170, 148], [204, 196, 174]);
const MOON = r5([160, 166, 176], [174, 180, 190], [187, 193, 202], [200, 206, 215], [214, 220, 228]);
const SILVER_GREY = r5([96, 102, 114], [120, 126, 138], [160, 166, 176], [187, 193, 202], [214, 220, 228]);
const IRON = r5([26, 26, 28], [44, 44, 48], [66, 66, 70], [92, 90, 92], [120, 116, 114]);
const SLAG = r5([22, 12, 9], [36, 20, 13], [54, 30, 18], [76, 42, 24], [100, 58, 32]);
export const EG_BAND_RAMPS = Object.freeze([
  Object.freeze({   // the Broken Galleries
    stone: r5([150, 146, 138], [166, 162, 154], [182, 178, 169], [198, 194, 185], [214, 210, 200]),     // marble
    vein: r5([52, 48, 46], [74, 70, 66], [98, 94, 88], [122, 118, 112], [140, 136, 130]),               // its veins, joints and soot
    metal: r5([140, 98, 40], [172, 124, 52], [196, 146, 64], [228, 184, 100], [246, 206, 120]),         // gold leaf (the Hour's brass)
    accent: r5([36, 52, 96], [48, 68, 124], [62, 86, 150], [76, 104, 174], [92, 124, 196]),             // Battlemage blue
    liquid: FIRE,                                                                                        // the fire-sea
    cloth: r5([20, 26, 52], [30, 40, 76], [42, 56, 102], [56, 74, 128], [72, 94, 152]),                 // Battlemage-blue cloth, matte
    deep: r5([30, 12, 10], [50, 20, 14], [74, 30, 20], [100, 44, 28], [128, 60, 38]),                   // the Deadlands' red rock
    fix: SD_RAMP.bronze,                                                                                 // the tripods' bronze (the Hour's)
    flame: r5([140, 48, 12], [206, 98, 24], [242, 154, 54], [255, 204, 108], [255, 234, 168]),          // the braziers' gold flame
    tile: r5([62, 68, 82], [84, 90, 106], [108, 114, 130], [134, 140, 154], [160, 166, 178]),           // blue-grey marble tesserae
    haze: hazeOf(EG_ATMOS[0].fog.color),
  }),
  Object.freeze({   // the Soul Cairn
    stone: r5([44, 37, 56], [64, 55, 78], [86, 75, 102], [110, 98, 130], [134, 121, 158]),             // slate violet (EG-LOOK: a step lighter - the realm's light reads it)
    vein: r5([14, 11, 18], [22, 18, 28], [30, 25, 38], [40, 34, 50], [50, 42, 62]),
    metal: BONE,                                                                                         // bone
    accent: SOUL,                                                                                        // soul-light
    liquid: SOUL,
    cloth: r5([46, 44, 52], [66, 64, 72], [88, 86, 94], [112, 110, 118], [138, 136, 144]),              // the grey shroud
    deep: r5([12, 9, 12], [20, 15, 19], [30, 23, 28], [42, 33, 38], [56, 45, 50]),                      // packed earth, black roots
    fix: r5([14, 14, 18], [26, 26, 32], [40, 40, 48], [58, 58, 68], [80, 80, 92]),                      // the gallows' black iron
    flame: SOUL,                                                                                         // the lanterns' soul-gems
    tile: BONE,                                                                                          // bone chips
    haze: hazeOf(EG_ATMOS[1].fog.color),
  }),
  Object.freeze({   // the Shade Perilous
    stone: r5([18, 18, 28], [30, 31, 44], [44, 46, 62], [62, 65, 84], [86, 90, 112]),                  // black glass (EG-LOOK: lifted - its sheen read under the moon, still the darkest band)
    vein: r5([8, 8, 13], [12, 12, 19], [17, 17, 26], [23, 23, 34], [30, 30, 44]),
    metal: MOON,                                                                                         // moon-silver
    accent: SILVER_GREY,
    liquid: r5([64, 68, 76], [104, 110, 120], [150, 156, 166], [196, 202, 212], [228, 232, 238]),      // quicksilver
    cloth: r5([10, 8, 14], [18, 15, 24], [28, 23, 36], [40, 33, 50], [54, 45, 66]),                     // Nocturnal's black cloth
    deep: r5([3, 3, 6], [7, 8, 13], [12, 13, 20], [19, 21, 30], [28, 31, 44]),                          // the stalactites' glass
    fix: SD_RAMP.silver,                                                                                 // the moon-lamps' silver (the Hour's)
    flame: r5([110, 120, 148], [150, 160, 188], [190, 198, 222], [220, 226, 242], [242, 246, 255]),     // the moon-lamps' cold light
    tile: SILVER_GREY,                                                                                   // glass and silver shards
    haze: hazeOf(EG_ATMOS[2].fog.color),
  }),
  Object.freeze({   // the Havoc Wellhead
    stone: r5([26, 22, 20], [38, 34, 31], [54, 48, 44], [72, 65, 58], [94, 85, 76]),                  // basalt (EG-LOOK: SD-LOOK's a step lighter and warmer - lit from the magma, it reads)
    vein: r5([10, 9, 9], [14, 13, 12], [19, 17, 16], [24, 22, 20], [30, 27, 25]),
    metal: IRON,                                                                                         // iron
    accent: FIRE,                                                                                        // molten
    liquid: FIRE,
    cloth: r5([44, 8, 8], [70, 14, 12], [98, 22, 16], [128, 32, 22], [160, 46, 30]),                    // the war banners' red
    deep: SLAG,                                                                                          // slag and its rust
    fix: IRON,                                                                                           // the fire baskets' iron
    flame: FIRE,                                                                                         // the baskets' molten fire
    tile: SLAG,                                                                                          // slag cobbles
    haze: hazeOf(EG_ATMOS[3].fog.color),
  }),
]);
/** The edge line's gold, the same in every band (the Galleries' gold leaf). */
const GOLD = EG_BAND_RAMPS[0].metal;

/** Display luminance of an sRGB triple, 0-1 (the value ladder's measure - world/superDungeon/sdLook.js SD_LADDER). */
export const egLuma = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
/** Band `band`'s liquid's emission over its albedo: EG_MOLTEN_GLOW, or less where its brightest step would pass
 *  EG_MOLTEN_LUMA_MAX (a texel's rounding held a hair under it). */
export const egMoltenGlow = (band) => Math.min(EG_MOLTEN_GLOW, (EG_MOLTEN_LUMA_MAX - 0.004) / Math.max(...EG_BAND_RAMPS[Math.max(0, Math.min(3, band | 0))].liquid.map((c) => egLuma(c))));
const black = (W = SD_ART_SIZE, H = W) => image(W, H);
const seedOf = (band, rec) => (0xe6b0 + band * 0x101 + rec * 0x1f) >>> 0;

/**
 * EG-LOOK: HOW EACH OF THE KIT'S PICTURES IS WORN (Elite-Gates-Look.md section 8) - the builders' one table (world/
 * egRuin.js, world/eliteGates/egVista.js, world/eliteGates/egHall.js). `w` x `h` its texels; `mU`, `mV` the metres one repeat spans along u and
 * v at its intended mapping (so it lays about 32 texels a metre - SD-LOOK's pixel law - but where its line's comment says otherwise);
 * `v` which way v runs in the world: 'up' (v = height / mV - world/eliteGates/meshKit.js lathe, box and prism at their uvScale 0.5:
 * the picture painted the right way up for it) or 'down' (v from the picture's top row: a profile from its top, the strata
 * from the floor, a banner from its rod); `bands` its rows laid out across v, each [v0, v1); `around` (the shaft) how many
 * repeats once round a column, by band (its sides' u = k / sides x around - the flutes and facets meet the seam whole).
 */
export const EG_KIT_MAP = Object.freeze({
  [EG_KIT_RECORD.shaft]: Object.freeze({ w: 64, h: 64, mU: 2, mV: 2, v: 'up', around: Object.freeze([2, 2, 2, 3]) }),   // u round the shaft (16 flutes, 8 octagon facets, 6 hexagon faces whole), v along it
  [EG_KIT_RECORD.moulding]: Object.freeze({ w: 64, h: 64, mU: 2, mV: 2, v: 'down', bands: Object.freeze({ fillet: Object.freeze([0, 4 / 64]), ornament: Object.freeze([4 / 64, 22 / 64]), band: Object.freeze([22 / 64, 28 / 64]), cove: Object.freeze([28 / 64, 48 / 64]), torn: Object.freeze([48 / 64, 1]) }) }),   // u along the run; v across the profile from its top, each of the profile's faces laid in its band
  [EG_KIT_RECORD.voussoir]: Object.freeze({ w: 64, h: 64, mU: 2, mV: 2, v: 'down', bands: Object.freeze({ inner: Object.freeze([0, 0.5]), outer: Object.freeze([0.5, 1]) }) }),   // u along the arc (a block each 0.5 m), v out from the intrados: a ring of 1 m is [0, 0.5), a double ring [0, 1)
  [EG_KIT_RECORD.relief]: Object.freeze({ w: 64, h: 64, mU: 2, mV: 2, v: 'down' }),   // a square panel: u along / h and v down / h for a frieze h metres tall (1-2 m), so its figures keep their shape
  [EG_KIT_RECORD.banner]: Object.freeze({ w: 64, h: 128, mU: 2, mV: 4, v: 'down' }),   // the whole cloth once: u 0-1 across its width (1.5-2 m), v 0-1 from its rod to its torn foot (3-5 m); a cutout
  [EG_KIT_RECORD.coffer]: Object.freeze({ w: 64, h: 64, mU: 2, mV: 2, v: 'down' }),   // planar on a soffit: two coffers a metre square each way
  [EG_KIT_RECORD.statue]: Object.freeze({ w: 64, h: 64, mU: 2, mV: 2, v: 'up' }),   // round the figure and up it, the folds running v
  [EG_KIT_RECORD.fixture]: Object.freeze({ w: 64, h: 64, mU: 2, mV: 2, v: 'down', bands: Object.freeze({ flame: Object.freeze([0, 0.5]), body: Object.freeze([0.5, 0.75]), grille: Object.freeze([0.75, 1]) }), cells: 4 }),   // the flame: one of four cells (u k/4 to (k+1)/4) on a crossed quad 0.5 m by 1 m, lit and cut out; the body planar; the grille round a cage or basket, cut out between its bars
  [EG_KIT_RECORD.found]: Object.freeze({ w: 64, h: SD_ROOT_ART_H, mU: 0, mV: 0, v: 'down', bands: Object.freeze({ slab: Object.freeze([0, 6 / 128]), courses: Object.freeze([6 / 128, 46 / 128]), rubble: Object.freeze([46 / 128, 64 / 128]), deep: Object.freeze([64 / 128, 100 / 128]), haze: Object.freeze([100 / 128, 1]) }) }),   // the Hour's root mapping (world/superDungeon/sdIslandModel.js islandRoot): v the depth under the floor over the foundation's whole depth, u repeated round it so the texels are square (max(1, round(circumference x 2 / depth))) - seen from far, about 4 texels a metre on 30 m
  [EG_KIT_RECORD.wreck]: Object.freeze({ w: 64, h: 64, mU: 16, mV: 16, v: 'up' }),   // 4 texels a metre on purpose: seen at 120-450 m with no mips, a texel is about a pixel at 300 m (two bays and two storeys a repeat)
  [EG_KIT_RECORD.crystal]: Object.freeze({ w: 64, h: 64, mU: 2, mV: 2, v: 'up' }),   // u round the crystal, v along its length
  [EG_KIT_RECORD.inlay]: Object.freeze({ w: 64, h: 128, mU: 2, mV: 4, v: 'down', bands: Object.freeze({ accent: Object.freeze([0, 0.5]), metal: Object.freeze([0.5, 1]) }) }),   // planar in the floor (2 m a repeat in u); a region laid in one band of v, at most 2 m across it - the sigil's field in one, its figure in the other
  [EG_KIT_RECORD.chain]: Object.freeze({ w: 32, h: 32, mU: 0, mV: 0, v: 'down', bands: Object.freeze({ faces: Object.freeze([0, 0.25]), outer: Object.freeze([0.5, 0.75]), inner: Object.freeze([0.75, 1]) }) }),   // the Hour's chain (world/superDungeon/sdIslandModel.js SD_CHAIN_RECORD): each bar of a link u 0-1, its faces, outer walls and inner walls in their bands
});

// ── the paint box's own helpers ───────────────────────────────────────────────────────────────────────────────────
/** Rows reversed in place - a picture painted top-down, worn with its v running up (EG_KIT_MAP `v: 'up'`). */
function flipV(img) {
  const W = img.width, H = img.height, c = img.colors, row = W * 4;
  for (let y = 0; y < H >> 1; y++) { const a = y * row, b = (H - 1 - y) * row; for (let i = 0; i < row; i++) { const t = c[a + i]; c[a + i] = c[b + i]; c[b + i] = t; } }
  return img;
}
/** A TILING CELL FIELD: n x m jittered sites over a W x H picture, (x, y) -> the nearest's `{ id, d1, d2, sx, sy, t }`
 *  (texel centres; `t` the site's own 0-1) - the 3 x 3 cells about the texel alone, so a field costs nine sites a texel. */
function cellField(seed, n, m, W, H, jit = 0.7) {
  const r = rng(seed), cw = W / n, ch = H / m, site = [];
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) site.push([(i + 0.5 + (r() - 0.5) * jit) * cw, (j + 0.5 + (r() - 0.5) * jit) * ch, r()]);
  const out = { id: 0, d1: 0, d2: 0, sx: 0, sy: 0, t: 0 };
  return (x, y) => {
    const px = x + 0.5, py = y + 0.5, ci = Math.floor(px / cw), cj = Math.floor(py / ch);
    let d1 = Infinity, d2 = Infinity;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj, wi = ((ii % n) + n) % n, wj = ((jj % m) + m) % m, s = site[wj * n + wi];
      const sx = s[0] + (ii - wi) * cw, sy = s[1] + (jj - wj) * ch, d = Math.hypot(px - sx, py - sy);
      if (d < d1) { d2 = d1; d1 = d; out.id = wj * n + wi; out.sx = sx; out.sy = sy; out.t = s[2]; } else if (d < d2) d2 = d;
    }
    out.d1 = d1; out.d2 = d2;
    return out;
  };
}
/** A small hash of integers, 0-1 (a tessera's or a block's own pick). */
const hash = (a, b = 0, c = 0) => { let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) >>> 0; h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };
/** Wrapped index. */
const wrap = (v, n) => ((v % n) + n) % n;
/** THE LIGHT A PICTURE MEANS: emission = albedo x k on the texels `lit(x, y)` answers (opaque ones), k the most that keeps
 *  its brightest at or under `cap` display luminance (and never past EG_MOLTEN_GLOW of its albedo); every other texel dark. */
function capGlow(albedo, emission, lit, cap) {
  const W = albedo.width, H = albedo.height, c = albedo.colors;
  let top = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (c[i + 3] > 127 && lit(x, y)) top = Math.max(top, egLuma([c[i], c[i + 1], c[i + 2]])); }
  const k = top > 0 ? Math.min(EG_MOLTEN_GLOW, (cap - 0.004) / top) : 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; putTexel(emission, x, y, c[i + 3] > 127 && lit(x, y) ? scale([c[i], c[i + 1], c[i + 2]], k) : [0, 0, 0]); }
}
/**
 * A CARVING: sprites laid on a field and cut from it - `rows` of characters each `k` texels square at (x0, y0), each
 * character's `[role, t]` from `key` (a role > 0 is the figure's, '.' or a character key lacks the field's), written into
 * `role` and `tone` (W x H, wrapping). `carve` then lights each figure texel whose up or left neighbour is the field and
 * shades each whose down or right is, and darkens the field under a figure's lower right (its cast shadow) - a relief.
 */
function stamp(role, tone, W, H, x0, y0, rows, key, k = 1) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const v = key[rows[j][i]];
    if (!v) continue;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) { const p = wrap(y0 + j * k + a, H) * W + wrap(x0 + i * k + b, W); role[p] = v[0]; tone[p] = v[1]; }
  }
}
function carve(role, tone, W, H, lift = 0.22) {
  const at = (x, y) => role[wrap(y, H) * W + wrap(x, W)];
  const t2 = Float32Array.from(tone);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (role[p] > 0) {
      if (!at(x, y - 1) || !at(x - 1, y)) t2[p] += lift;
      else if (!at(x, y + 1) || !at(x + 1, y)) t2[p] -= lift;
    } else if (at(x - 1, y - 1) > 0 || at(x - 1, y) > 0 || at(x, y - 1) > 0) t2[p] -= 0.3;
  }
  return t2;
}
/** Distance from (px, py) to the segment a-b. */
const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0; return Math.hypot(px - ax - dx * t, py - ay - dy * t); };

// ── THE GROUND ────────────────────────────────────────────────────────────────────────────────────────────────────
/** FLOOR: flags a metre square (32 texels) in running bond, bevelled, their faces quiet, each band's own figure in them -
 *  the Galleries' white marble veined grey (each flag cut from its own block: its veins its own, broken at the joints),
 *  the Cairn's slate-violet in cleavage with a bone lozenge where the joints meet, the Shade's black glass catching the
 *  moon along one diagonal and split by moon-silver hairlines, the Wellhead's basalt bound in riveted iron. Matte. */
function floorArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black(), r = rng(seedOf(band, 0));
  const tone = noiseField(seedOf(band, 0) + 1, 4), fine = noiseField(seedOf(band, 0) + 2, 16), wob = noiseField(seedOf(band, 0) + 3, 8);
  const F = 32, J = band === 2 ? 1 : 2;
  const shade = Array.from({ length: 8 }, () => 0.3 + 0.35 * r());
  const veins = Array.from({ length: 8 }, () => ({ a: (r() < 0.5 ? 0.25 : 0.75) * Math.PI + (r() - 0.5) * 0.7, c: (r() - 0.5) * 16, b: r() < 0.75 ? r() * 6 : null }));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const row = Math.floor(y / F), xs = x + (row % 2) * (F / 2), fx = wrap(xs, F), fy = y % F, k = row * 4 + Math.floor(wrap(xs, S) / F);
    if (fx < J || fy < J) { putTexel(albedo, x, y, band === 2 ? step(R.accent, 0) : band === 3 ? step(R.vein, 1) : fx === 0 || fy === 0 ? step(R.vein, band === 0 ? 2 : 0) : step(R.stone, 0)); continue; }
    let t = shade[k % 8] + 0.16 * (tone(x, y) - 0.5) + 0.07 * (fine(x, y) - 0.5);
    if (band === 1 && hash(k, Math.floor((fy + 3 * wob(x, y)) / 3)) < 0.22) t += hash(k, fy) < 0.5 ? 0.18 : -0.16;   // the slate's cleavage
    if (band === 2) { t = 0.04 + 0.38 * shade[k % 8] + 0.34 * (1 - (fx + fy) / (2 * F)); if (wrap(fx - fy + k * 7, 23) < 2) t += 0.22; }   // glass: lit toward the moon, a streak
    if (band === 3 && hash(x >> 1, y >> 1, k) < 0.05) t -= 0.35;   // the basalt's pits
    let c = ramp(R.stone, t, x, y);
    if (band === 0 && veins[k % 8].b !== null) {   // the marble's veins: one wandering line across most flags, its own block's, a cloud of grey about it
      const v = veins[k % 8], ca = Math.cos(v.a), sa = Math.sin(v.a), lx = fx - 16, ly = fy - 16, s = ly * ca - lx * sa;
      const d = lx * ca + ly * sa - v.c - 1.5 * Math.sin(s * 0.12 + v.b) - 0.8 * Math.sin(s * 0.37 + v.a * 3);
      if (Math.abs(d) < 0.6) c = step(R.vein, 4); else if (d > 0 && d < 2.4 && bayer(x, y) < 0.5) c = step(R.stone, 0); else if (d < 0 && d > -3.5 && bayer(x, y) < 0.15) c = step(R.stone, 0);
    }
    putTexel(albedo, x, y, c);
  }
  for (let row = 0; row < 2; row++) for (let c = 0; c < 3; c++) bevel(albedo, c * F - (row % 2) * (F / 2) + J, row * F + J, F - J, F - J, step(R.stone, band === 2 ? 3 : 4), step(R.stone, band === 2 ? 0 : 1));
  if (band === 1) for (let row = 0; row < 2; row++) for (let c = 0; c < 3; c++) {   // the bone lozenges where the joints meet
    const cx = c * F - (row % 2) * (F / 2), cy = row * F;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const d = Math.abs(dx) + Math.abs(dy); if (d <= 3) putTexel(albedo, cx + dx, cy + dy, d === 3 ? step(R.vein, 0) : step(R.metal, dx + dy < 0 ? 3 : dx + dy > 0 ? 1 : 2)); }
  }
  if (band === 2) for (let n = 0; n < 5; n++) {   // the moon-silver hairlines: a fracture across a flag, branching once
    let x = r() * S, y = r() * S, a = r() * Math.PI * 2;
    const len = 9 + Math.floor(r() * 12);
    for (let i = 0; i < len; i++) { putTexel(albedo, x, y, step(R.accent, i % 5 === 0 ? 1 : 0)); a += (r() - 0.5) * 0.7; x += Math.cos(a); y += Math.sin(a); if (i === 5) { let bx = x, by = y, ba = a + 1.1; for (let q = 0; q < 5; q++) { bx += Math.cos(ba); by += Math.sin(ba); putTexel(albedo, bx, by, step(R.accent, 0)); } } }
  }
  if (band === 3) for (let row = 0; row < 2; row++) {   // the iron straps along the courses' joints, riveted
    const y0 = row * F;
    for (let x = 0; x < S; x++) { putTexel(albedo, x, y0, step(R.metal, 3)); putTexel(albedo, x, y0 + 1, step(R.metal, 2)); putTexel(albedo, x, y0 + 2, step(R.metal, 1)); putTexel(albedo, x, y0 + 3, step(R.vein, 1)); }
    for (let x = 4 + row * 8; x < S; x += 16) rivet(albedo, x, y0 + 1, step(R.metal, 4), step(R.metal, 0), step(R.metal, 4));
  }
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal, R.accent));
  return { albedo, emission };
}
/** BRASS: the band's metal, rubbed along its grain (u) in bands 16 texels high, each its own wear: the Galleries' gold leaf
 *  in a bead-and-reel, the Cairn's bone in knuckled segments, the Shade's moon-silver in chevron facets, the Wellhead's
 *  iron in riveted plates; its own light on its rubbed rows alone (SD_BRASS_EDGE_GLOW). */
function metalArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  const grain = noiseField(seedOf(band, 1), 16, S, S, 2), broad = noiseField(seedOf(band, 1) + 2, 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ly = y % 16, g = 0.55 * grain(x, y) + 0.45 * broad(x, y);
    let t = 0.2 + 0.5 * g;
    if (band === 0 && ly >= 3 && ly <= 12) {   // bead and reel between two fillets
      const bx = x % 8, ex = (bx - 2) / 2.6, ey = (ly - 7.5) / 3.6, e = ex * ex + ey * ey;
      t = ly === 3 || ly === 12 ? 0.08 : e <= 1 ? 0.78 - 0.3 * (ex + ey) / 2 : bx === 6 && ly >= 6 && ly <= 9 ? 0.6 - 0.1 * (ly - 6) : 0.1;
    }
    if (band === 1) {   // long bones bundled along the grain, two to a band, their knuckles staggered
      const by = ly < 8 ? ly - 1 : ly - 8, bx = wrap(x + (ly < 8 ? 0 : 16) + Math.floor(y / 16) * 7, 32), knob = bx < 4 || bx > 27;
      t = bx === 0 || by < 0 ? 0 : !knob && (by === 0 || by === 6) ? 0.05 : [0.9, 0.85, 0.7, 0.55, 0.45, 0.3, 0.12][Math.min(6, by)] + 0.1 * (g - 0.5);
    }
    if (band === 2) { const v = wrap(x + (ly < 8 ? ly : 15 - ly), 16); t = v < 8 ? 0.65 + 0.1 * g : 0.3 + 0.1 * g; }   // chevron facets
    putTexel(albedo, x, y, ramp(R.metal, t, x, y));
  }
  if (band === 3) for (let px = 0; px < S; px += 32) {
    for (let y = 0; y < S; y++) { putTexel(albedo, px, y, step(R.vein, 1)); putTexel(albedo, px + 1, y, step(R.metal, 1)); }
    for (const ry of [4, 20, 36, S - 12]) rivet(albedo, px + 6, ry, step(R.metal, 3), step(R.metal, 0), step(R.metal, 4));
  }
  for (let x = 0; x < S; x++) for (const y of [0, 16, 32, 48]) {
    putTexel(albedo, x, y, step(R.metal, 4)); putTexel(emission, x, y, scale(step(R.metal, 4), SD_BRASS_EDGE_GLOW));
    putTexel(albedo, x, y + 15, step(R.metal, 0));
  }
  quantize(albedo, paletteOf(R.metal, R.vein));
  return { albedo, emission };
}
/** THE STRATA (root 2 and found 68): a 64 x SD_ROOT_ART_H strip top (v 0) to tip (v 1) - the floor's slab, the academy's
 *  courses (marble, slate, black glass, basalt bound in iron), the rubble they broke into, the realm's own stone under
 *  them (the Deadlands' red rock in its beds; packed bone and black roots; black glass veined silver; basalt prisms with
 *  slag running down them), thinning into the band's haze. `L` the rows each starts at. Nothing glows. */
function strataArt(band, rec, L) {
  const R = EG_BAND_RAMPS[band], W = SD_ART_SIZE, H = SD_ROOT_ART_H, albedo = image(W, H), emission = image(W, H), r = rng(seedOf(band, rec));
  const tone = noiseField(seedOf(band, rec), 8, W, H), wob = noiseField(seedOf(band, rec) + 3, 6, W, H), beds = noiseField(seedOf(band, rec) + 5, 4, W, H, 16);
  const rubble = cellField(seedOf(band, rec) + 7, 8, 3, W, L.deep - L.rubble);
  const CH = L.course;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = tone(x, y), yy = y + (wob(x, y) - 0.5) * 6;
    let c;
    if (y < L.courses) c = y === 0 ? step(R.stone, 4) : y >= L.courses - 2 ? step(R.vein, 1) : ramp(R.stone, 0.5 + 0.3 * n, x, y);   // the slab
    else if (yy < L.rubble) {   // the courses, darker as they go down, a band's binding between
      const cy = y - L.courses, course = Math.floor(cy / CH), bx = wrap(x + (course % 2) * 8 + course * 3, 16), by = cy % CH, depth = cy / (L.rubble - L.courses);
      if (L.step && course % L.step === L.step - 1 && by >= CH - 2) c = by === CH - 1 ? step(R.vein, 0) : step(R.stone, band === 2 ? 3 : 4);   // a step's ledge (the foundations step in as they go down), its shadow under
      else if (by === 0 || bx === 0) c = band === 2 && by === 0 && hash(x >> 2, course) < 0.5 ? step(R.accent, 0) : step(R.vein, band === 0 ? 2 : 1);
      else if (band === 3 && course % 3 === 1 && by >= CH - 3) c = by === CH - 3 ? step(R.metal, 3) : step(R.metal, 1);   // iron straps
      else c = ramp(R.stone, (band === 2 ? 0.55 - 0.35 * depth + 0.25 * (1 - bx / 16) : 0.55 - 0.4 * depth) + 0.2 * (n - 0.5) + (by === 1 ? 0.18 : 0), x, y);
    } else if (yy < L.deep) {   // the rubble: broken blocks in dark mortar
      const q = rubble(x, y - L.rubble);
      c = q.d2 - q.d1 < 1.4 ? step(R.vein, 0) : ramp(q.t < 0.3 && band !== 2 ? R.deep : R.stone, 0.12 + 0.35 * q.t - 0.25 * ((x + 0.5 - q.sx) + (y - L.rubble + 0.5 - q.sy)) / 8, x, y);
    } else {   // the realm's own stone, into the haze
      const d = (yy - L.deep) / (H - L.deep);
      if (band === 0) { const b = beds(x, y) * 3 + y / 9; c = ramp(R.deep, 0.15 + 0.55 * (b % 1) * (1 - d * 0.6) + 0.15 * (n - 0.5), x, y); if (wrap(b * 3, 3) < 0.25) c = step(R.deep, 0); }
      else if (band === 1) c = ramp(R.deep, 0.2 + 0.5 * n * (1 - d * 0.5), x, y);
      else if (band === 2) { const v = wrap(x + Math.round(6 * wob(x, y)), 11); c = v === 0 ? step(R.accent, d < 0.5 ? 0 : 1) : ramp(R.deep, 0.15 + 0.55 * (1 - v / 11) * (1 - d * 0.7), x, y); }
      else { const v = wrap(x + Math.floor(y / 24) * 4, 8); c = v === 0 ? step(R.vein, 1) : v === 1 ? step(R.stone, 3) : ramp(R.stone, 0.15 + 0.35 * n - 0.25 * d, x, y); }
      if (y >= L.haze) { const f = Math.min(1, (y - L.haze) / (H - L.haze - 4)); if (bayer(x, y) < f * 0.92) c = ramp(R.haze, 0.2 + 0.5 * n, x, y); }
    }
    putTexel(albedo, x, y, c); putTexel(emission, x, y, [0, 0, 0]);
  }
  // the band's own thing through the deep stone: bones and black roots, slag drips
  if (band === 1) {
    for (let n = 0; n < 22; n++) {   // packed bone: long bones, knuckled at both ends, and a skull here and there
      const x = r() * W, y = L.deep + 3 + r() * (L.haze - L.deep - 2), len = 5 + Math.floor(r() * 6), a = (r() - 0.5) * 1.2, ca = Math.cos(a), sa = Math.sin(a);
      if (n % 5 === 4) { SKULL_S.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') putTexel(albedo, x + i, y + j, ch === 'h' ? step(R.deep, 0) : step(R.metal, i + j < 3 ? 3 : 2)); })); continue; }
      for (let i = 0; i <= len; i++) { putTexel(albedo, x + ca * i, y + sa * i, step(R.metal, 2)); putTexel(albedo, x + ca * i - sa, y + sa * i + ca, step(R.metal, 0)); }
      for (const e of [0, len]) { putTexel(albedo, x + ca * e + sa, y + sa * e - ca, step(R.metal, 3)); putTexel(albedo, x + ca * e - 2 * sa, y + sa * e + 2 * ca, step(R.metal, 1)); }
    }
    for (let k = 0; k < 6; k++) { let x = r() * W; for (let y = L.rubble; y < H - 6; y++) { putTexel(albedo, x, y, step(R.vein, 0)); if (y % 3 === 0) putTexel(albedo, x + 1, y, step(R.deep, 0)); x += (r() - 0.5) * 1.6; } }   // the black roots
  }
  if (band === 3) for (let k = 0; k < 7; k++) {   // the slag's drips
    const x = Math.floor(r() * W), y0 = L.deep + Math.floor(r() * 10), len = 10 + Math.floor(r() * 24);
    for (let y = y0; y < Math.min(H, y0 + len); y++) { putTexel(albedo, x, y, step(R.deep, y - y0 < 3 ? 3 : 2)); if (y - y0 < len - 4) putTexel(albedo, x + 1, y, step(R.deep, 1)); }
  }
  if (band === 0) for (let k = 0; k < 3; k++) {   // the gold leaf's last scraps in the courses (a cramp, an old fillet)
    const x0 = Math.floor(r() * W), y0 = L.courses + CH * (1 + Math.floor(r() * 2));
    for (let i = 0; i < 6; i++) putTexel(albedo, x0 + i, y0, step(R.metal, 1));
  }
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal, R.accent, R.deep, R.haze));
  return { albedo, emission };
}
/** ROOT: the ground's undersides (a disc's torn lip, a walkway's sides, the underside's strata - world/eliteGates/egUnderside.js). */
const rootArt = (band) => strataArt(band, EG_DRESS.root, { courses: 6, course: 11, rubble: 50, deep: 70, haze: 100 });
/** ARENA: one court plate a tile, its seams at its left and top (the courts lay it in rings - world/superDungeon/sdRealm.js realmIsland:
 *  u 2 m along the ring, v across it). The quietest record: the marble low on its ramp with a ghost of a vein, the slate
 *  with the soul-light in its joints (the Cairn's own light, held to EG_SEAM_LUMA_MAX), the glass split by a silver
 *  hairline, the basalt edged in iron. The sigil's mosaic is the inlay's (71), laid in the floor by the halls. */
function arenaArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  const tone = noiseField(seedOf(band, 4) + 1, 4), fine = noiseField(seedOf(band, 4) + 2, 16), wob = noiseField(seedOf(band, 4) + 3, 8);
  const quiet = band === 0 ? 0.12 : 0.22;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c;
    if (x < 3 || y < 3) {
      const e = Math.min(x, y);
      c = band === 1 ? (e === 1 ? step(R.accent, 2) : step(R.vein, 0))
        : band === 2 ? (e === 0 ? step(R.accent, 0) : step(R.vein, 1))
          : band === 3 ? (e === 0 ? step(R.vein, 1) : e === 1 ? step(R.metal, 2) : step(R.metal, 1))
            : (e === 0 ? step(R.vein, 3) : step(R.stone, 0));
    } else {
      let t = quiet + 0.28 * tone(x, y) + 0.06 * (fine(x, y) - 0.5);
      if (band === 2) t = 0.2 + 0.25 * tone(x, y) + 0.25 * (1 - (x + y) / (2 * S));
      c = ramp(R.stone, t, x, y);
      if (band === 0 && Math.abs((x - y) * 0.7 + 10 * (wob(x, y) - 0.5) - 8) < 0.6) c = step(R.stone, 3);   // a ghost of a vein
      if (band === 1 && Math.floor(y + 3 * wob(x, y)) % 7 === 0 && hash(x >> 3, y) < 0.4) c = step(R.stone, 2);   // the slate's grain
    }
    putTexel(albedo, x, y, c);
  }
  bevel(albedo, 3, 3, S - 3, S - 3, step(R.stone, band === 0 ? 2 : 3), step(band === 0 ? R.stone : R.vein, band === 0 ? 0 : 2));
  if (band === 3) rivet(albedo, 1, 1, step(R.metal, 4), step(R.metal, 0), step(R.metal, 4));
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal, R.accent));
  if (band === 1) capGlow(albedo, emission, (x, y) => (x < 3 || y < 3) && Math.min(x, y) === 1, EG_SEAM_LUMA_MAX);
  return { albedo, emission };
}
/** COBBLE: the walkways - small tesserae (8 texels, a quarter metre) set in their grout, each lit from the top-left: the
 *  Galleries' blue-grey marble in staggered rows (opus tessellatum, a white or a blue one here and there), the Cairn's
 *  slate and bone chips, the Shade's black-glass shards glinting silver on their lit edge, the Wellhead's basalt and slag. */
function walkArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  if (band === 0) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const j = Math.floor(y / 8), i = Math.floor(wrap(x + (j % 2) * 4, S) / 8), lx = wrap(x + (j % 2) * 4, 8), ly = y % 8;
      if (lx === 0 || ly === 0) { putTexel(albedo, x, y, step(R.vein, 1)); continue; }
      const h = hash(i, j, 31), rp = h < 0.16 ? R.stone : h < 0.24 ? R.accent : R.tile, base = h < 0.16 ? 2 : h < 0.24 ? 1 : 1 + Math.floor(hash(j, i) * 3);
      putTexel(albedo, x, y, step(rp, base + (lx === 1 || ly === 1 ? 1 : lx === 7 || ly === 7 ? -1 : 0)));
    }
  } else {
    const cf = cellField(seedOf(band, 31), band === 2 ? 7 : 8, band === 2 ? 7 : 8, S, S, 0.8);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const q = cf(x, y), cell = S / 8;
      if (q.d2 - q.d1 < (band === 2 ? 1.1 : 1.5)) { putTexel(albedo, x, y, step(R.vein, 0)); continue; }
      const lit = 0.25 + 0.4 * q.t - 0.4 * ((x + 0.5 - q.sx) + (y + 0.5 - q.sy)) / cell;
      const rp = band === 1 ? (q.t > 0.72 ? R.tile : R.stone) : band === 3 ? (q.t > 0.68 ? R.tile : R.stone) : R.stone;
      let c = ramp(rp, band === 2 ? lit - 0.1 : lit, x, y);
      if (band === 2 && q.t > 0.62 && q.d2 - q.d1 < 1.9 && (x + 0.5 - q.sx) + (y + 0.5 - q.sy) < -2) c = step(R.accent, 0);   // the shard's lit edge
      putTexel(albedo, x, y, c);
    }
  }
  quantize(albedo, paletteOf(R.stone, R.vein, R.accent, R.tile));
  return { albedo, emission };
}
/** EDGE: THE EDGE LINE's gold (section 25.3), the same in every band - rubbed gold, alight at the ambient rung. */
function edgeArt() {
  const S = 8, albedo = image(S), emission = image(S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const c = step(GOLD, y < 2 ? 4 : 3); putTexel(albedo, x, y, c); putTexel(emission, x, y, scale(c, SD_EDGE_GLOW)); }
  return { albedo, emission };
}
/** MOLTEN: the band's liquid light in slow cells - its emission egMoltenGlow of its albedo, so its brightest texel stays
 *  at or under EG_MOLTEN_LUMA_MAX. */
function moltenArt(band) {
  const R = EG_BAND_RAMPS[band], S = 32, albedo = image(S), emission = image(S);
  const cells = noiseField(seedOf(band, 33), 4, S), crust = noiseField(seedOf(band, 33) + 7, 8, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = 0.55 * cells(x, y) + 0.45 * crust(x, y), c = v < 0.32 ? step(R.liquid, 0) : ramp(R.liquid, (v - 0.25) * 1.4, x, y);
    putTexel(albedo, x, y, c);
  }
  quantize(albedo, paletteOf(R.liquid));
  const k = egMoltenGlow(band);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, c = albedo.colors; putTexel(emission, x, y, scale([c[i], c[i + 1], c[i + 2]], k)); }
  return { albedo, emission };
}
/** PILLAR: the academy's wall, two metres a repeat and worn with v up (world/eliteGates/egHall.js's walls: v = height / 2 m): a
 *  string course (the Galleries' gold leaf, the Cairn's bone beads, the Shade's silver arris, the Wellhead's riveted iron
 *  strap) over four courses of ashlar a metre long - drafted margins on the marble, cleavage on the slate, a sheen on the
 *  glass, pits in the basalt - each block bevelled from the top-left. Matte. */
function pillarArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black(), r = rng(seedOf(band, 56));
  const tone = noiseField(seedOf(band, 56) + 1, 4), fine = noiseField(seedOf(band, 56) + 2, 16);
  const W = 32, H = 14, J = 2, TOP = 8, shade = Array.from({ length: 16 }, () => 0.2 + 0.32 * r());
  for (let y = TOP; y < S; y++) for (let x = 0; x < S; x++) {
    const cy = y - TOP, row = Math.floor(cy / H), xs = x + (row % 2) * (W / 2), bx = wrap(xs, W), by = cy % H, k = row * 2 + Math.floor(wrap(xs, S) / W);
    if (bx < J || by < J) { putTexel(albedo, x, y, band === 2 && (bx === 0 || by === 0) ? step(R.accent, 0) : step(R.vein, band === 0 ? 2 : 1)); continue; }
    let t = shade[k % 16] + 0.16 * (tone(x, y) - 0.5) + 0.06 * (fine(x, y) - 0.5);
    if (band === 0 && (bx < J + 3 || by < J + 3 || bx > W - 4 || by > H - 4)) t += 0.22;   // the drafted margin, smoother and paler
    if (band === 1 && hash(k, by >> 1) < 0.25) t += 0.15;
    if (band === 2) t = 0.15 + 0.45 * shade[k % 16] + 0.3 * (1 - bx / W);
    if (band === 3 && hash(x >> 1, y >> 1, k) < 0.06) t -= 0.3;
    putTexel(albedo, x, y, ramp(R.stone, t, x, y));
  }
  for (let row = 0; row < 4; row++) for (let c = 0; c < 3; c++) bevel(albedo, c * W - (row % 2) * (W / 2) + J, TOP + row * H + J, W - J, H - J, step(R.stone, band === 2 ? 3 : 4), step(R.stone, band === 2 ? 0 : 1));
  // the string course: a fillet, the band's own band, its shadow under
  for (let x = 0; x < S; x++) {
    const col = [step(R.stone, 4), step(R.stone, 3)];
    if (band === 0) col.push(step(R.metal, 4), step(R.metal, 2), step(R.metal, 1), step(R.metal, 0));
    else if (band === 1) { const b = x % 6; col.push(...[0, 1, 2, 3].map((i) => (b < 4 ? step(R.metal, [4, 3, 2, 0][i]) : step(R.vein, i === 0 ? 2 : 0)))); }
    else if (band === 2) col.push(step(R.metal, 2), step(R.stone, 4), step(R.stone, 2), step(R.stone, 1));
    else col.push(step(R.metal, 3), step(R.metal, 2), step(R.metal, 1), step(R.metal, 0));
    col.push(step(R.vein, 2), step(R.vein, 0));
    for (let y = 0; y < TOP; y++) putTexel(albedo, x, y, col[y]);
  }
  if (band === 3) for (let x = 4; x < S; x += 16) rivet(albedo, x, 3, step(R.metal, 4), step(R.metal, 0), step(R.metal, 4));
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal, R.accent));
  return { albedo: flipV(albedo), emission };
}

// ── THE KIT (Elite-Gates-Look.md section 8) ────────────────────────────────────────────────────────────────────────
/** SHAFT (60): a column's shaft, worn round it and up it (EG_KIT_MAP): the Galleries' marble in eight flutes a repeat,
 *  their fillets gilded and the leaf rubbed away in places, its drums' joints; the Cairn's slate core wrapped in long bones
 *  bound in a spiral, their knuckles staggered; the Shade's obsidian in four facets a repeat, its arrises silver, the old
 *  stone showing where the glass has not yet taken it; the Wellhead's basalt hexagon, two faces a repeat, bound in iron
 *  bands riveted on each face. Matte. */
function shaftArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  const tone = noiseField(seedOf(band, 60), 4), fine = noiseField(seedOf(band, 60) + 1, 16, S, S, 4), wear = noiseField(seedOf(band, 60) + 2, 8), rem = noiseField(seedOf(band, 60) + 3, 8, S, S, 2);
  const FLUTE = [4, 0, 0, 1, 2, 2, 3, 3];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c;
    if (band === 0) {
      const f = x % 8;
      c = f === 0 ? (wear(x, y) > 0.38 ? step(R.metal, wear(x, y) > 0.7 ? 3 : 2) : step(R.stone, 4)) : f === 1 ? step(R.vein, 4) : ramp(R.stone, FLUTE[f] / 4 + 0.12 * (tone(x, y) - 0.5), x, y);
      if (y % 32 === 31) c = step(R.vein, 3); else if (y % 32 === 0 && f !== 0) c = step(R.stone, 4);
    } else if (band === 1) {
      const u = wrap(x + y, S), t = wrap(x - y, S), b = Math.floor(u / 8), w = u % 8, tt = wrap(t + b * 11, 32);
      const knob = tt < 4 || tt > 28, cord = wrap(t + b * 5, 16) < 2;
      if (tt === 0) c = step(R.vein, 0);
      else if (cord && w > 0 && w < 7) c = step(R.vein, 2);
      else if (w === 0 || (w === 7 && !knob)) c = step(R.stone, 0);
      else c = step(R.metal, [4, 4, 3, 3, 2, 2, 1, 0][w] - (knob ? 0 : 1) + (fine(x, y) > 0.7 ? 1 : 0));
    } else if (band === 2) {
      const f = Math.floor(x / 16), lx = x % 16, base = [0.55, 0.35, 0.15, 0.4][f];
      let t = base + (lx >= 3 && lx <= 5 ? 0.3 : 0) + (wrap(Math.round(y + 5 * Math.sin(lx * 0.45 + f * 2)), 12) === 0 ? 0.18 : 0) + 0.08 * (fine(x, y) - 0.5);
      if (rem(x, y) + 0.25 * (fine(x, y) - 0.5) > 0.7) t = -1;   // the old stone, not yet glass - in long runs down the shaft
      c = lx === 0 ? step(R.metal, 1) : lx === 15 ? step(R.vein, 0) : t < 0 ? ramp(R.accent, 0.1 + 0.3 * fine(x, y), x, y) : ramp(R.stone, t, x, y);
    } else {
      const lx = x % 32, by = y % 32;
      c = lx === 0 ? step(R.stone, 4) : lx === 1 ? step(R.stone, 3) : lx === 31 ? step(R.vein, 1) : ramp(R.stone, 0.25 + 0.3 * tone(x, y) + 0.12 * (fine(x, y) - 0.5) - (hash(x >> 1, y >> 1) < 0.05 ? 0.3 : 0), x, y);
      if (by >= 12 && by <= 17) c = step(R.metal, by === 12 ? 3 : by === 17 ? 0 : by === 13 ? 2 : 1);
    }
    putTexel(albedo, x, y, c);
  }
  if (band === 3) for (let x = 8; x < S; x += 16) for (const y of [14, 46]) rivet(albedo, x, y, step(R.metal, 4), step(R.metal, 0), step(R.metal, 4));
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal, R.accent));
  return { albedo: flipV(albedo), emission };
}
/** A skull five texels across - packed in the Cairn's deep stone. */
const SKULL_S = ['.BBB.', 'BBBBB', 'BhBhB', '.BBB.', '.B.B.'];
/** A skull ten texels across, 'o' its outline, 'B' its lit bone, 'b' its shaded side, 'h' its holes, 'T' its teeth. */
const SKULL = [
  '..oooooo..',
  '.oBBBBBBo.',
  'oBBBBBBBbo',
  'oBBBBBBBbo',
  'oBhhBBhhbo',
  'oBhhBBhhbo',
  'oBBBBBBBbo',
  '.oBBhhBbo.',
  '..oBBBbo..',
  '..oTbTbo..',
  '...oooo...',
];
/** MOULDING (61): the cornice's and the capitals' profile, across v from its top (EG_KIT_MAP's bands): a fillet, the
 *  band's ornament (egg-and-dart; a row of skulls; faceted lozenges with silver arrises; iron straps riveted down the
 *  stone), the band's metal band (gold leaf; bone beads; a silver arris; riveted iron), a cove shading down, and the torn
 *  stone the cornice breaks into. Matte. */
function mouldingArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  const tone = noiseField(seedOf(band, 61), 8), torn = noiseField(seedOf(band, 61) + 1, 8, S, S, 1), fine = noiseField(seedOf(band, 61) + 2, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c;
    const lx = x % 16, ly = y - 4;
    if (y < 4) c = [step(R.stone, 4), step(R.stone, 3), step(R.stone, 3), step(R.vein, band === 0 ? 2 : 0)][y];
    else if (y < 22) {
      if (band === 0) {   // egg and dart: each egg in its cup, a dart pointing down between
        const ex = (lx - 8) / 4.4, ey = (ly - 8) / 6.6, e = ex * ex + ey * ey, sx = (lx - 8) / 6.2, sy = (ly - 7.2) / 8.4, s = sx * sx + sy * sy;
        const ax = lx < 8 ? lx : lx - 16, dw = ly < 9 ? 0.5 : (15 - ly) * 0.55;
        if (e <= 1) c = ramp(R.stone, 0.85 - 0.4 * (ex + ey + 0.5) / 2, x, y);
        else if (s <= 1) c = e < 1.3 ? step(R.vein, 3) : step(R.stone, sx < 0 ? 3 : 1);
        else if (Math.abs(ax + 0.5) <= dw && ly < 15) c = step(R.stone, ax < 0 ? 4 : 2);
        else c = step(R.vein, 4);
      } else if (band === 1) c = ramp(R.stone, 0.1 + 0.15 * tone(x, y), x, y);   // the frieze's niche - its skulls stamped below
      else if (band === 2) {   // faceted lozenges, their arrises silver
        const dx = lx - 8, dy = ly - 9, d = Math.abs(dx) / 8 + Math.abs(dy) / 9;
        c = d > 1.02 ? step(R.stone, 0) : d > 0.9 || dx === 0 || dy === 0 ? step(R.metal, dx < 0 && dy < 0 ? 2 : 0) : step(R.stone, dx < 0 ? (dy < 0 ? 4 : 2) : (dy < 0 ? 3 : 1));
      } else {   // iron straps down the basalt
        c = lx >= 5 && lx <= 10 ? step(R.metal, lx === 5 ? 3 : lx === 10 ? 0 : lx < 8 ? 2 : 1) : ramp(R.stone, 0.2 + 0.35 * tone(x, y) + 0.1 * (fine(x, y) - 0.5), x, y);
      }
    } else if (y < 28) {
      const by = y - 22;
      if (band === 0) c = step(R.metal, [4, 3, 2, 2, 1, 0][by]);
      else if (band === 1) { const b = x % 6; c = b < 4 ? step(R.metal, [3, 4, 3, 2, 1, 0][by] - (b === 3 ? 1 : 0)) : by > 0 && by < 5 ? step(R.vein, 1) : step(R.metal, 1); }
      else if (band === 2) c = [step(R.metal, 4), step(R.metal, 1), step(R.stone, 3), step(R.stone, 2), step(R.stone, 1), step(R.vein, 0)][by];
      else c = step(R.metal, [3, 2, 2, 1, 1, 0][by]);
    } else {
      const edge = 50 + Math.round(6 * torn(x, y));
      if (y < edge) c = y === 28 ? step(R.vein, band === 0 ? 3 : 1) : ramp(R.stone, 0.12 + 0.6 * (y - 28) / 22 + 0.1 * (tone(x, y) - 0.5), x, y);
      else if (y === edge) c = step(R.stone, band === 2 ? 2 : 3);
      else c = ramp(band === 0 ? R.vein : R.stone, (band === 0 ? 0.55 : 0.15) + 0.35 * fine(x, y) - 0.2 * (y - edge) / 12, x, y);
    }
    putTexel(albedo, x, y, c);
  }
  if (band === 1) for (let k = 0; k < 4; k++) {   // the skulls
    const role = new Uint8Array(10 * 11);
    SKULL.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return; role[j * 10 + i] = 1; putTexel(albedo, k * 16 + 3 + i, 7 + j, ch === 'o' ? step(R.vein, 0) : ch === 'h' ? step(R.vein, 0) : ch === 'T' ? step(R.vein, 1) : ch === 'b' ? step(R.metal, 1) : step(R.metal, j < 3 && i < 5 ? 4 : 3)); }));
  }
  if (band === 3) for (let x = 7; x < S; x += 16) { rivet(albedo, x + 1, 8, step(R.metal, 4), step(R.metal, 0), step(R.metal, 4)); rivet(albedo, x + 1, 17, step(R.metal, 4), step(R.metal, 0), step(R.metal, 4)); }
  if (band === 3) for (let x = 4; x < S; x += 8) rivet(albedo, x, 24, step(R.metal, 4), step(R.metal, 0), step(R.metal, 3));
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal));
  return { albedo, emission };
}
/** VOUSSOIR (62): an arch's blocks, u along the arc and v out from the intrados (EG_KIT_MAP): two rings of a metre, their
 *  radial joints staggered - the Galleries' white marble alternating with blue-grey (the academy's polychrome arches), the
 *  Cairn's slate keyed with a bone fillet at the intrados, the Shade's glass jointed in silver, the Wellhead's basalt with
 *  an iron strap over every other joint. Matte. */
function voussoirArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  const tone = noiseField(seedOf(band, 62), 4), fine = noiseField(seedOf(band, 62) + 1, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ring = y >> 5, ly = y & 31, xs = x + ring * 8, blk = Math.floor(wrap(xs, S) / 16) + ring * 4, lx = wrap(xs, 16);
    let c;
    if (lx < 2 || ly < 2) c = band === 2 && (lx === 0 || ly === 0) ? step(R.accent, 0) : step(R.vein, band === 0 ? 2 : 1);
    else {
      const rp = band === 0 && blk % 2 ? R.tile : R.stone;
      let t = 0.35 + 0.25 * hash(blk, 62) + 0.15 * (tone(x, y) - 0.5) + 0.05 * (fine(x, y) - 0.5);
      if (band === 2) t = 0.15 + 0.35 * hash(blk, 62) + 0.3 * (1 - lx / 16);
      if (band === 3 && hash(x >> 1, y >> 1) < 0.05) t -= 0.3;
      c = lx === 2 || ly === 2 ? step(rp, band === 2 ? 3 : 4) : lx === 15 || ly === 31 ? step(rp, band === 2 ? 0 : 1) : ramp(rp, t, x, y);
      if (band === 1 && ring === 0 && ly >= 2 && ly <= 4) c = step(R.metal, ly === 2 ? 3 : ly === 3 ? 2 : 0);
      if (band === 3 && lx >= 6 && lx <= 10 && blk % 2 === 0) c = step(R.metal, lx === 6 ? 3 : lx === 10 ? 0 : 1 + (lx === 7 ? 1 : 0));
    }
    putTexel(albedo, x, y, c);
  }
  if (band === 3) for (let ring = 0; ring < 2; ring++) for (let b = 0; b < 4; b += 2) for (const ry of [9, 24]) rivet(albedo, b * 16 - ring * 8 + 8, ring * 32 + ry, step(R.metal, 4), step(R.metal, 0), step(R.metal, 4));
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal, R.accent, R.tile));
  return { albedo, emission };
}
const MAGE = [
  '.........w..',
  '........www.',
  '.........w..',
  '.....hh..s..',
  '....hhhh.s..',
  '...hhhhhds..',
  '...hhhhdds..',
  '...hhhhh.s..',
  '..rrrrrrrs..',
  '..rrrrrrrq..',
  '..rrrrrr.s..',
  '..rrfrrr.s..',
  '..rrfrrr.s..',
  '.rrrfrrr.s..',
  '.rrrfrrrrs..',
  '.rrfrrfrrs..',
  '.rrfrrfrrs..',
  'rrrfrrfrrs..',
  'rrfrrrfrrs..',
  'rrfrrrrfrs..',
  'rrrrrrrrrs..',
  'gggggggggs..',
  '.dd...dd.s..',
  '.........s..',
];
const DREMORA = [
  '..^.........',
  '.^^^........',
  '..s.k....k..',
  '..s.kk..kk..',
  '..s..hhhh...',
  '..s.dhhhh...',
  '..s.dhhhh...',
  '..s..hhh....',
  '..q.aaaaaa..',
  '..saaaaaaaa.',
  '.ooo.aaaaaa.',
  'ooooo.aaaaa.',
  'ooxoo.aaaaa.',
  'ooooo.aaaaa.',
  '.ooo.aaaaaa.',
  '..s.aaaaaaa.',
  '..s.llllll..',
  '..s.llllll..',
  '..s.llllll..',
  '..s.ll..ll..',
  '..s.ll..ll..',
  '..s.ll..ll..',
  '..sbbb..bbb.',
  '..s.........',
];
/** RELIEF (63): a frieze panel, square (EG_KIT_MAP), between a fillet over and under, its figures carved proud of a sunk
 *  field and lit from the top-left: the Galleries' Battlemages in procession (marble, their staves and hems gilded) on the
 *  ground's old Battlemage-blue paint; the Cairn's wall of skulls on rows of long bones; the Shade's thorn tracery in
 *  silver about two crescents; the Wellhead's Dremora on the march, spears and shields, on the ground's old red. Matte. */
function reliefArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  const tone = noiseField(seedOf(band, 63), 4), paint = noiseField(seedOf(band, 63) + 1, 8), fine = noiseField(seedOf(band, 63) + 2, 16);
  const role = new Uint8Array(S * S), tn = new Float32Array(S * S);
  // roles: 1 the figure's stone, 2 the metal, 3 a shadowed cut in the figure, 4 bone
  if (band === 0) {
    const key = { w: [2, 0.9], s: [2, 0.5], q: [1, 0.8], h: [1, 0.6], r: [1, 0.55], f: [3, 0.2], d: [3, 0.1], g: [2, 0.55] };
    stamp(role, tn, S, S, 3, 7, MAGE, key, 2); stamp(role, tn, S, S, 35, 7, MAGE, key, 2);
  } else if (band === 1) {
    const key = { o: [3, 0], B: [4, 0.75], b: [4, 0.45], h: [3, 0], T: [3, 0.1] };
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) stamp(role, tn, S, S, i * 16 + 3 + (row % 2) * 8, 6 + row * 18, SKULL, key);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) { const y0 = 18 + row * 18, x0 = i * 16 + (row % 2 ? 0 : 8); for (let k = -1; k < 15; k++) for (let t = 0; t < 2; t++) { const p = wrap(y0 + t, S) * S + wrap(x0 + k, S); role[p] = 4; tn[p] = k < 1 || k > 12 ? 0.8 : t ? 0.35 : 0.6; } }
  } else if (band === 2) {
    for (let x = 0; x < S; x++) for (const sgn of [1, -1]) {
      const yc = 32 + sgn * 15 * Math.sin((2 * Math.PI * x) / S);
      for (let dy = -1; dy <= 1; dy++) { const p = wrap(Math.round(yc) + dy, S) * S + x; role[p] = 2; tn[p] = dy < 0 ? 0.8 : dy > 0 ? 0.3 : 0.55; }
      if (x % 5 === (sgn > 0 ? 0 : 2)) {   // the thorns, out of each side by turns, hooked toward the stem's run
        const side = x % 10 < 5 ? -1 : 1;
        for (let k = 2; k <= 5; k++) for (let w = 0; w < (k < 4 ? 2 : 1); w++) { const p = wrap(Math.round(yc) + side * k, S) * S + wrap(x + w + (k > 4 ? 1 : 0), S); role[p] = 2; tn[p] = k < 4 ? 0.65 : 0.85; }
      }
    }
    for (const [sx, sy, sr] of [[0, 9, 3], [32, 55, 3], [8, 52, 2], [40, 12, 2], [56, 50, 2], [24, 14, 2]]) for (let dy = -sr; dy <= sr; dy++) for (let dx = -sr; dx <= sr; dx++) {   // Nocturnal's stars in the tracery's gaps
      if (Math.abs(dx) * Math.abs(dy) !== 0 && Math.abs(dx) + Math.abs(dy) > 1) continue;
      const p = wrap(sy + dy, S) * S + wrap(sx + dx, S); role[p] = 2; tn[p] = dx === 0 && dy === 0 ? 0.95 : 0.6;
    }
    for (const cx of [16, 48]) for (let y = 22; y < 43; y++) for (let x = cx - 9; x <= cx + 9; x++) {   // a crescent in each eye of the tracery
      const a = Math.hypot(x - cx, y - 32), b = Math.hypot(x - cx - 3.5, y - 29.5);
      if (a <= 6.5 && b > 5.2) { const p = y * S + x; role[p] = 2; tn[p] = 0.55 + 0.3 * (cx - x) / 7; }
    }
  } else {
    const key = { '^': [2, 0.85], s: [2, 0.45], k: [1, 0.95], h: [2, 0.62], d: [3, 0.05], q: [1, 0.8], a: [2, 0.5], o: [2, 0.55], x: [2, 0.95], l: [2, 0.32], b: [1, 0.55] };   // iron-clad, horned in basalt
    stamp(role, tn, S, S, 4, 7, DREMORA, key, 2); stamp(role, tn, S, S, 36, 7, DREMORA, key, 2);
  }
  const t2 = carve(role, tn, S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c;
    if (y < 4) c = [step(R.stone, 4), step(R.stone, 3), step(R.stone, 2), step(R.vein, band === 0 ? 2 : 0)][y];
    else if (y >= 60) c = [step(R.stone, 3), step(R.stone, 2), step(R.stone, 1), step(R.vein, band === 0 ? 2 : 0)][y - 60];
    else {
      const p = y * S + x, ro = role[p], t = t2[p];
      if (ro === 1) c = ramp(R.stone, band === 2 ? t * 0.8 : t + 0.08 * (fine(x, y) - 0.5), x, y);
      else if (ro === 2) c = ramp(R.metal, band === 2 ? t - 0.1 : t, x, y);
      else if (ro === 3) c = step(R.vein, band === 0 ? (t > 0.15 ? 3 : 2) : 0);
      else if (ro === 4) c = ramp(R.metal, t, x, y);
      else {   // the sunk field: the old paint where it holds
        const sh = t < 0 ? -0.3 : 0;
        c = band === 0 && paint(x, y) > 0.38 ? step(R.cloth, sh < 0 ? 0 : 1 + (paint(x, y) > 0.6 ? 1 : 0))
          : band === 3 && paint(x, y) > 0.28 ? step(R.cloth, sh < 0 ? 0 : 1 + (paint(x, y) > 0.62 ? 1 : 0))
            : band === 1 ? step(R.vein, sh < 0 ? 0 : 1)
              : ramp(band === 0 ? R.vein : R.stone, (band === 0 ? 0.7 : 0.15) + 0.2 * tone(x, y) + sh, x, y);
      }
    }
    putTexel(albedo, x, y, c);
  }
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal, R.cloth));
  return { albedo, emission };
}
/** The banners' sigils, by band (section 1): the Battlemages' eight-pointed star in its ring (gold), the soul-gem, the
 *  crescent (silver), Dagon's war-sigil (black on the red, edged in iron). `(dx, dy)` from the sigil's centre: its role
 *  (0 none, 1 the sign's body, 2 its lit face, 3 its outline) - the banner paints the roles. */
function sigilAt(band, dx, dy) {
  const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  if (band === 0) {
    if (r >= 15 && r < 18) return r < 15.8 || r >= 17.3 ? 3 : dx + dy < 0 ? 2 : 1;
    const f = ((a / (Math.PI * 2)) * 8 + 8.5) % 1, R = 6 + 7 * (1 - Math.abs(f * 2 - 1));
    if (r <= 2.2) return 3;
    if (r <= R) return Math.abs(f - 0.5) < 0.08 ? 3 : f < 0.5 ? 2 : 1;
    return r <= R + 1 ? 3 : 0;
  }
  if (band === 1) {
    const d = Math.abs(dx) / 9 + Math.abs(dy) / 16;
    if (d <= 1) return d > 0.88 ? 3 : dx === 0 || Math.abs(dy) < 0.6 ? 3 : dx < 0 ? 2 : 1;
    if (r >= 18 && r < 19.5) return 1;
    return 0;
  }
  if (band === 2) {
    const a1 = Math.hypot(dx, dy), b1 = Math.hypot(dx - 6, dy + 4);
    if (a1 <= 15 && b1 > 12) return a1 > 14 || b1 < 13 ? 3 : dx < -4 ? 2 : 1;
    if (Math.abs(dx - 9) + Math.abs(dy + 1) <= 2) return 2;   // a star in its arms
    return 0;
  }
  // Dagon's war-sigil: an iron ring, two horns rising out of it, a blade down through it with its guard, a spike out of
  // each flank - black on the red, edged in iron
  if (r >= 10.5 && r < 13.5 && !(Math.abs(dx) < 2.6 && dy < 0)) return r < 11.2 || r >= 12.9 ? 3 : 2;
  let d = 99;
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 16; i++) { const t = i / 16, bx = s * ((1 - t) ** 2 * 6 + 2 * (1 - t) * t * 18 + t * t * 11), by = (1 - t) ** 2 * -10 + 2 * (1 - t) * t * -13 + t * t * -26; d = Math.min(d, Math.hypot(dx - bx, dy - by) - (2.6 - 2.1 * t)); }
    d = Math.min(d, segDist(dx, dy, s * 12.5, 3, s * 19.5, 10) - (1.6 - 0.12 * Math.abs(dx)));
  }
  d = Math.min(d, segDist(dx, dy, 0, -18, 0, 14) - 1.8, dy > 14 && dy < 22 ? Math.abs(dx) - 1.8 * (22 - dy) / 8 : 99, segDist(dx, dy, -6, -13, 6, -13) - 1.1);
  return d < 0 ? 1 : d < 0.9 ? 3 : 0;
}
/** BANNER (64): the whole cloth once (EG_KIT_MAP), hanging still - a hem over its rod with its rings, long folds, the
 *  band's trim and its sigil, and its foot torn away into holes (a CUTOUT): the Galleries' Battlemage blue cut in a
 *  swallowtail and burnt through; the Cairn's grey shroud torn to rags, rent and moth-eaten; the Shade's black cloth dagged
 *  into points; the Wellhead's red and black war banner charred ragged. Matte, never lit (SD-LOOK's cloth). */
function bannerArt(band) {
  const R = EG_BAND_RAMPS[band], W = 64, H = 128, albedo = image(W, H), emission = image(W, H), r = rng(seedOf(band, 64));
  const fray = noiseField(seedOf(band, 64), 16, W, H, 2), tone = noiseField(seedOf(band, 64) + 1, 4, W, H), rag = noiseField(seedOf(band, 64) + 2, 8, W, H, 1);
  const holes = Array.from({ length: band === 1 ? 14 : band === 0 ? 4 : band === 3 ? 6 : 2 }, () => [r() * W, (band === 1 ? 66 : 78) + r() * (band === 1 ? 44 : 28), 1 + r() * (band === 1 ? 1.6 : 2.4)]);
  const rents = band === 1 ? [[14, 80], [37, 96], [52, 86]] : band === 3 ? [[46, 100]] : [];
  /** the foot: the first row torn away, by column */
  const foot = (x) => band === 0 ? 127 - 20 * (1 - Math.abs(x - 31.5) / 32) + 3 * (rag(x, 0) - 0.5)
    : band === 1 ? 96 + 26 * rag(x, 0) + 4 * Math.sin(x * 1.7)
      : band === 2 ? 124 - 16 * Math.abs(wrap(x + 8, 16) - 8) / 8 + 2 * (rag(x, 0) - 0.5)
        : 102 + 18 * rag(x, 0) + 3 * Math.sin(x * 2.3);
  const torn = (x, y) => {
    if (y >= foot(x)) return true;
    if (y > 92 && (x < 2 * (y - 92) / 18 * (0.5 + rag(x, y)) || W - 1 - x < 2 * (y - 92) / 18 * (0.5 + rag(W - x, y)))) return true;   // the sides eaten near the foot
    for (const [hx, hy, hr] of holes) if (Math.hypot(x - hx, (y - hy) * 0.8) < hr) return true;
    for (const [rx, ry] of rents) if (Math.abs(x - rx - (y - ry) * 0.15) < 1 && y > ry) return true;
    return false;
  };
  const hole = new Uint8Array(W * H);   // the holes found once, read by every texel and its neighbours
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hole[y * W + x] = torn(x, y) ? 1 : 0;
  const gone = (x, y) => x < 0 || x >= W || y >= H || hole[y * W + x] === 1;
  const fold = (x) => 0.5 + 0.2 * Math.sin((2 * Math.PI * x) / 16 + 0.6) + 0.08 * Math.sin((2 * Math.PI * x) / 7);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (gone(x, y)) { putTexel(albedo, x, y, step(R.cloth, 0), 0); putTexel(emission, x, y, [0, 0, 0]); continue; }
    const edge = gone(x, y + 1) || gone(x - 1, y) || gone(x + 1, y) || gone(x, y + 2);
    let rp = R.cloth;
    if (band === 3 && (x < 14 || x > 49)) rp = R.stone;   // the war banner's black flanks
    let t = fold(x) - 0.1 * (y / H) + 0.1 * (tone(x, y) - 0.5) + 0.06 * (fray(x, y) - 0.5);
    let c = ramp(rp, t, x, y);
    if (y < 6) c = y === 0 || y === 5 ? step(rp, 0) : step(rp, y < 3 ? 2 : 1);   // the hem over the rod
    if (band === 0 && (x === 3 || x === 4 || x === 59 || x === 60) && y >= 6) c = step(R.metal, x === 3 || x === 59 ? 2 : 0);
    if (band === 2 && (x === 3 || x === 60) && y >= 6) c = step(R.metal, 0);
    if (band === 3 && (x === 14 || x === 49) && y >= 6) c = step(R.metal, 2);
    if (band === 1 && y >= 8 && y <= 10) c = step(R.cloth, y === 9 ? 3 : 1);   // the shroud's one hem stitch
    const s = y >= 12 && y <= 66 ? sigilAt(band, x - 31.5, y - 40) : 0;
    if (s) c = band === 0 ? step(R.metal, s === 3 ? 0 : s === 2 ? 3 : 2)
      : band === 1 ? (s === 3 ? step(R.vein, 1) : step(R.accent, s === 2 ? 2 : 1))
        : band === 2 ? step(R.metal, s === 3 ? 0 : s === 2 ? 4 : 2)
          : (s === 3 ? step(R.metal, 1) : s === 2 ? step(R.metal, 2) : step(R.vein, 0));
    if (edge && !s) c = band === 3 ? step(R.deep, 0) : step(rp, 0);   // the torn edge frayed dark (charred in the Wellhead)
    putTexel(albedo, x, y, c); putTexel(emission, x, y, [0, 0, 0]);
  }
  for (const x of [8, 24, 40, 56]) rivet(albedo, x, 2, step(R.fix, 4), step(R.fix, 0), step(R.fix, 4));   // the rings
  quantize(albedo, paletteOf(R.cloth, R.stone, R.vein, R.metal, R.accent, R.deep, R.fix));
  return { albedo, emission, cutout: true };
}
/** COFFER (65): a soffit's coffers, a metre square, two each way: a rib between, the recess stepped in twice (lit on its
 *  far sides from below and the top-left alike - a soffit is seen from under), its panel and its boss: the Galleries' blue
 *  panels and gold rosettes, the Cairn's dark panels with a small skull, the Shade's glass with a silver star, the
 *  Wellhead's basalt in iron ribs with a spiked boss. Matte. */
function cofferArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  const tone = noiseField(seedOf(band, 65), 4), fine = noiseField(seedOf(band, 65) + 1, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const lx = x % 32, ly = y % 32, e = Math.min(lx, ly, 31 - lx, 31 - ly);
    let c;
    if (e < 3) c = band === 3 ? step(R.metal, e === 0 ? 3 : e === 1 ? 2 : 0) : e === 0 ? step(R.stone, 4) : e === 1 ? ramp(R.stone, 0.6 + 0.2 * tone(x, y), x, y) : step(R.stone, 1);
    else if (e < 9) { const lit = lx <= ly ? lx < 31 - ly : ly >= 31 - lx; const stp = e < 6 ? 0 : 1; c = step(R.stone, (lit ? 3 : 1) - stp); if (e === 5 || e === 8) c = step(R.vein, band === 0 ? 3 : 1); }
    else {
      const dx = lx - 15.5, dy = ly - 15.5, rr = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      c = band === 0 ? step(R.cloth, 1 + (fine(x, y) > 0.6 ? 1 : 0)) : ramp(band === 2 ? R.stone : R.vein, 0.3 + 0.4 * tone(x, y), x, y);
      if (band === 0 && rr < 2.2 + 3 * Math.abs(Math.cos(4 * a))) c = step(R.metal, rr < 1.6 ? 4 : dx + dy < 0 ? 3 : 1);
      if (band === 2 && Math.sqrt(Math.abs(dx)) + Math.sqrt(Math.abs(dy)) < 2.5) c = step(R.metal, rr < 1 ? 4 : dx + dy < 0 ? 3 : 0);   // a four-pointed star
      if (band === 3 && rr < 4) c = rr < 1.5 ? step(R.metal, 4) : step(R.metal, rr < 2.8 ? (dx + dy < 0 ? 3 : 1) : 0);
    }
    putTexel(albedo, x, y, c);
  }
  if (band === 1) for (let i = 0; i < 4; i++) SKULL.forEach((row, j) => [...row].forEach((ch, k) => { if (ch !== '.') putTexel(albedo, (i % 2) * 32 + 11 + k, (i >> 1) * 32 + 10 + j, ch === 'o' || ch === 'h' ? step(R.vein, 0) : ch === 'T' ? step(R.vein, 1) : step(R.metal, ch === 'b' ? 1 : 3)); }));
  if (band === 3) for (const [x, y] of [[0, 0], [32, 0], [0, 32], [32, 32]]) rivet(albedo, x + 1, y + 1, step(R.metal, 4), step(R.metal, 0), step(R.metal, 4));
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal, R.cloth));
  return { albedo, emission };
}
/** STATUE (66): the figures' weathered stone, worn round the figure and up it (EG_KIT_MAP): the Galleries' marble in
 *  robe folds with a trace of the old blue paint in the deepest, streaked by soot; the Cairn's slate shroud, its folds
 *  long and deep, crusted pale; the Shade's ravens' feathers, black stone scalloped, their rims catching the moon; the
 *  Wellhead's Dremora in lamellar plates of basalt, riveted iron at the lacing. Matte. */
function statueArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  const tone = noiseField(seedOf(band, 66), 4), streak = noiseField(seedOf(band, 66) + 1, 32, S, S, 2), paint = noiseField(seedOf(band, 66) + 2, 8), fine = noiseField(seedOf(band, 66) + 3, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c;
    if (band <= 1) {
      const P = band === 0 ? 16 : 21.333, sway = 2.2 * Math.sin((2 * Math.PI * y) / S + x * 0.05);
      const ph = (2 * Math.PI * (x + sway)) / P, slope = Math.cos(ph) + 0.4 * Math.cos(2 * ph + 1), depth = Math.sin(ph) + 0.2 * Math.sin(2 * ph + 1);
      let t = 0.45 + 0.28 * slope + 0.1 * (tone(x, y) - 0.5) - (band === 1 ? 0.12 : 0);
      if (streak(x, y) > 0.74) t -= 0.18;
      c = ramp(R.stone, t, x, y);
      if (band === 0 && depth < -0.9 && paint(x, y) > 0.6) c = step(R.accent, paint(x, y) > 0.75 ? 1 : 0);   // the old paint in the deepest folds
      if (band === 0 && streak(x, y) > 0.86) c = step(R.vein, 4);
      if (band === 1 && fine(x, y) > 0.78 && depth > 0.2) c = step(R.metal, fine(x, y) > 0.86 ? 1 : 0);   // the pale crust
    } else if (band === 2) {
      const j = Math.floor(y / 6), lx = wrap(x + (j % 2) * 4, 8), ly = y % 6, d = ((lx - 3.5) / 4) ** 2 + (ly / 6.5) ** 2;
      c = d > 0.86 ? step(R.vein, 1) : d > 0.6 && lx < 4 ? step(R.accent, ly < 3 ? 1 : 0) : ramp(R.stone, 0.55 - 0.4 * d + (lx === 4 ? 0.15 : 0) + 0.1 * (tone(x, y) - 0.5), x, y);
    } else {
      const j = Math.floor(y / 6), lx = wrap(x + (j % 2) * 4, 8), ly = y % 6;
      c = ly === 5 ? step(R.vein, 1) : lx === 0 ? step(R.vein, 2) : ly === 0 ? step(R.stone, 4) : lx === 7 ? step(R.stone, 1) : ramp(R.stone, 0.35 + 0.3 * tone(x, y) - 0.08 * ly + 0.1 * (fine(x, y) - 0.5), x, y);
      if (ly === 2 && (lx === 1 || lx === 6) && (j % 2 === 0)) c = step(R.metal, 3);
    }
    putTexel(albedo, x, y, c);
  }
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal, R.accent));
  return { albedo: flipV(albedo), emission };
}
/** FIXTURE (67): a lamp's fixture and its light (EG_KIT_MAP): its top half four cells of light - the Galleries' tripods'
 *  gold flames, the Cairn's lanterns' soul-gems, the Shade's moon-lamps' cold globes, the Wellhead's baskets' ragged fire -
 *  each cut out of the dark and LIT (the ruin's one emissive, its brightest at or under EG_MOLTEN_LUMA_MAX); its body's
 *  band (bronze beaded in gold, black iron with a bone fillet, fluted silver, riveted iron); its grille's bars round a
 *  cage or a basket, cut out between them. */
function fixtureArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  const lick = noiseField(seedOf(band, 67), 16, S, S, 8), grain = noiseField(seedOf(band, 67) + 1, 16, S, S, 2);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = null;
    if (y < 32) {   // the light
      const cell = x >> 4, lx = (x & 15) + 0.5, ly = y + 0.5, ph = cell * 1.7;
      if (band === 0 || band === 3) {
        const base = band === 3 ? 27 : 29, cx = 8 + 1.6 * Math.sin(ly * 0.28 + ph) * (1 - ly / 32), h = (ly - (band === 3 ? 2 : 4)) / (base - (band === 3 ? 2 : 4));
        const w = h < 0 ? 0 : h < 1 ? (band === 3 ? 6.2 : 5.2) * Math.pow(h, 0.7) : (band === 3 ? 6.2 : 5.2) * Math.sqrt(Math.max(0, 1 - ((ly - base) / 3.2) ** 2));
        const d = Math.abs(lx - cx) / Math.max(0.01, w * (0.75 + 0.45 * lick(x, y)));
        if (d < 1) c = step(R.flame, d < 0.35 && h > 0.35 ? 4 : d < 0.65 && h > 0.2 ? 3 : h > 0.55 ? 2 : 1);
        else if (band === 3 && hash(x, y, 67) < 0.025 && ly < 20) c = step(R.flame, 3);   // a spark
      } else if (band === 1) {
        const d = Math.abs(lx - 8) / 5 + Math.abs(ly - 17) / 12;
        if (d <= 1) c = step(R.flame, d > 0.85 ? 1 : lx < 8 ? (ly < 17 ? 4 : 3) : (ly < 17 ? 2 : 1));
      } else {
        const d = Math.hypot(lx - 8, ly - 18) / 6.5, hl = Math.hypot(lx - 6.2, ly - 16);
        if (d <= 1) c = step(R.flame, d > 0.9 ? 1 : hl < 2.4 ? 4 : d < 0.6 ? 3 : 2);
        else if (lx >= 7 && lx <= 9 && ly >= 9 && ly < 12) c = step(R.fix, 3);   // its finial
      }
      if (!c) { putTexel(albedo, x, y, step(R.fix, 0), 0); continue; }
    } else if (y < 48) {   // the body
      const by = y - 32, g = grain(x, y);
      if (band === 0) c = by === 0 ? step(R.metal, 2) : by === 1 ? step(R.fix, 4) : by >= 6 && by <= 9 ? (x % 6 < 4 ? step(R.metal, by === 6 ? 3 : by === 9 ? 0 : 1) : step(R.fix, 0)) : by === 15 ? step(R.fix, 0) : ramp(R.fix, 0.35 + 0.4 * g, x, y);
      else if (band === 1) c = by === 0 ? step(R.fix, 4) : by >= 6 && by <= 8 ? step(R.metal, by === 6 ? 3 : by === 7 ? 2 : 0) : by === 15 ? step(R.fix, 0) : ramp(R.fix, 0.25 + 0.4 * g, x, y);
      else if (band === 2) { const f = x % 4; c = by === 0 ? step(R.fix, 4) : by === 15 ? step(R.fix, 0) : step(R.fix, f === 0 ? 4 : f === 1 ? 3 : f === 2 ? 2 : 1); }
      else c = by === 0 ? step(R.fix, 3) : by === 15 ? step(R.vein, 1) : x % 32 === 0 ? step(R.vein, 1) : ramp(R.fix, 0.2 + 0.45 * g, x, y);
    } else {   // the grille: bars, cut out between
      const gy = y - 48, bw = band === 3 ? 4 : band === 2 ? 2 : 3, lx = x % 8;
      if (gy < 2 || gy > 13) c = step(R.fix, gy === 0 || gy === 14 ? 4 : gy === 15 ? 0 : 2);
      else if (lx < bw) c = step(R.fix, lx === 0 ? 4 : lx === bw - 1 ? 0 : 2);
      else if (band === 2 && Math.abs(lx - 4.5 - (gy - 7.5) * 0.4) < 0.6) c = step(R.fix, 3);
      else { putTexel(albedo, x, y, step(R.fix, 0), 0); continue; }
    }
    putTexel(albedo, x, y, c);
  }
  if (band === 3) for (let x = 6; x < S; x += 16) rivet(albedo, x, 40, step(R.fix, 4), step(R.fix, 0), step(R.fix, 4));
  if (band === 3) for (let x = 2; x < S; x += 16) { rivet(albedo, x, 49, step(R.fix, 4), step(R.fix, 0), step(R.fix, 3)); }
  quantize(albedo, paletteOf(R.fix, R.flame, R.metal, R.vein));
  capGlow(albedo, emission, (x, y) => y < 32 && albedo.colors[(y * S + x) * 4 + 3] > 127 && R.flame.some((f) => { const i = (y * S + x) * 4; return f[0] === albedo.colors[i] && f[1] === albedo.colors[i + 1] && f[2] === albedo.colors[i + 2]; }), EG_MOLTEN_LUMA_MAX);
  return { albedo, emission, cutout: true };
}
/** FOUND (68): the foundations' strata top to tip (EG_KIT_MAP - the Hour's root mapping): the floor's slab, the long run
 *  of the academy's courses stepped in (the foundations' inverted ziggurat), the rubble they broke into, the realm's own
 *  stone, the spires' tips fading into the band's haze. */
const foundArt = (band) => strataArt(band, EG_KIT_RECORD.found, { courses: 6, course: 8, step: 2, rubble: 46, deep: 64, haze: 100 });
/** WRECK (69): the far wings' stone, a step darker than the halls' (EG_KIT_MAP: four texels a metre, for the haze's
 *  distance): two storeys of two bays a repeat, a cornice at each floor, pilasters between the bays and a window dark in
 *  each - the Galleries' round-headed, the Cairn's pointed, the Shade's tall lancets, the Wellhead's squat slits under
 *  iron bands. Matte. */
function wreckArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black();
  const tone = noiseField(seedOf(band, 69), 4), fine = noiseField(seedOf(band, 69) + 1, 16);
  const win = [[5, 9, 22], [5, 7, 22], [3, 5, 25], [6, 13, 22]][band];   // half-width, top row, bottom row (in a storey)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ly = y % 32, lx = x % 32, dx = Math.abs(lx - 16) + 0.5, [hw, top, bot] = win;
    let c;
    if (ly < 3) c = band === 3 ? step(R.metal, ly === 0 ? 2 : ly === 1 ? 1 : 0) : [step(R.stone, 2), step(R.stone, 1), step(R.vein, 1)][ly];
    else if (lx < 3) c = lx === 0 ? step(R.stone, 2) : lx === 1 ? step(R.stone, 1) : step(R.vein, 1);
    else {
      let inWin = false;
      if (ly <= bot && dx <= hw) {
        if (band === 0) inWin = ly >= top + hw || Math.hypot(dx, ly - (top + hw)) <= hw;
        else if (band === 1 || band === 2) inWin = ly >= top + hw * 1.6 || Math.hypot(dx + hw, ly - (top + hw * 1.6)) <= hw * 2;
        else inWin = ly >= top;
      }
      const lo = [0.04, 0.12, 0.3, 0.14][band];   // a step darker than the halls' (the Shade's glass a step lighter, or its windows are lost)
      if (inWin) c = step(R.vein, 0);
      else if (ly <= bot + 1 && dx <= hw + 1 && ly >= top - 1) c = step(R.stone, ly === bot + 1 ? 2 : band === 2 ? 4 : 1);
      else c = ly % 4 === 3 ? step(band === 0 ? R.stone : R.vein, band === 0 ? 0 : 2) : ramp(R.stone, lo + 0.26 * tone(x, y) + 0.1 * (fine(x, y) - 0.5), x, y);
    }
    putTexel(albedo, x, y, c);
  }
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal));
  return { albedo: flipV(albedo), emission };
}
/** CRYSTAL (70): worn round a crystal and along it (EG_KIT_MAP), in long facets: the Galleries' pale quartz, milky and
 *  cool; the Cairn's soul-gem, LIT (its own light - the band's L2, capped at EG_MOLTEN_LUMA_MAX); the Shade's black glass,
 *  its arrises glinting silver, dark; the Wellhead's basalt prisms, their seams molten and LIT under the same cap. */
function crystalArt(band) {
  const R = EG_BAND_RAMPS[band], S = SD_ART_SIZE, albedo = image(), emission = black(), r = rng(seedOf(band, 70));
  const tone = noiseField(seedOf(band, 70), 4), milk = noiseField(seedOf(band, 70) + 1, 8, S, S, 2);
  const cuts = [0]; while (cuts.at(-1) < S) cuts.push(cuts.at(-1) + (band === 3 ? 16 : 9 + Math.floor(r() * 9)));
  cuts[cuts.length - 1] = S;
  const facet = (x) => { let k = 0; while (cuts[k + 1] <= x) k++; return k; };
  const base = cuts.map(() => r());
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = facet(x), lx = x - cuts[k], w = cuts[k + 1] - cuts[k];
    let c;
    if (band === 0) c = lx === 0 ? step(R.stone, 4) : lx === 1 ? step(R.stone, 2) : wrap(y + lx * 0.7 + k * 13, 17) < 1.6 && milk(x, y) > 0.4 ? step(R.stone, 3) : hash(x, y, 70) < 0.008 ? step(R.stone, 4) : ramp(R.tile, 0.5 + 0.4 * base[k] - 0.45 * lx / w + 0.15 * (milk(x, y) - 0.5), x, y);
    else if (band === 1) c = lx === 0 ? step(R.accent, 4) : ramp(R.accent, 0.3 + 0.45 * base[k] - 0.25 * lx / w + (Math.abs(lx - w * 0.35) < 1.2 ? 0.25 : 0) + 0.1 * (tone(x, y) - 0.5), x, y);
    else if (band === 2) c = lx === 0 ? step(R.metal, base[k] > 0.5 ? 1 : 0) : ramp(R.stone, 0.1 + 0.45 * base[k] - 0.25 * lx / w + (wrap(Math.round(y + 4 * Math.sin(lx * 0.5 + k)), 13) === 0 ? 0.2 : 0), x, y);
    else c = lx <= 1 ? step(R.liquid, lx === 0 ? 3 : 1 + (hash(y >> 2, k) < 0.3 ? 1 : 0)) : lx === 2 || lx === w - 1 ? step(R.vein, 1) : ramp(R.stone, 0.2 + 0.35 * tone(x, y) + 0.2 * base[k] - 0.15 * lx / w, x, y);
    putTexel(albedo, x, y, c);
  }
  quantize(albedo, paletteOf(R.stone, R.vein, R.metal, R.accent, R.liquid, R.tile));
  flipV(albedo);
  if (band === 1) capGlow(albedo, emission, () => true, EG_MOLTEN_LUMA_MAX);
  else if (band === 3) capGlow(albedo, emission, (x) => { const k = facet(x); return x - cuts[k] <= 1; }, EG_MOLTEN_LUMA_MAX);
  return { albedo, emission };
}
/** INLAY (71): the courts' mosaics and the rims' borders, laid IN the floor (EG_KIT_MAP: a region in one band of v) -
 *  small tesserae (a quarter metre) in staggered rows, each lit from the top-left, kept low on their ramps so the
 *  telegraphs own the courts: the band's accent above (Battlemage blue; the soul-light's dim teal; grey silver; the
 *  Wellhead's slag with MOLTEN SEAMS in its grout, LIT under EG_SEAM_LUMA_MAX), its metal below (gold; bone; moon-silver;
 *  iron). */
function inlayArt(band) {
  const R = EG_BAND_RAMPS[band], W = 64, H = 128, albedo = image(W, H), emission = image(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = Math.floor(y / 8), lx = wrap(x + (j % 2) * 4, 8), i = Math.floor(wrap(x + (j % 2) * 4, W) / 8), ly = y % 8, metal = y >= 64;
    if (lx === 0 || ly === 0) { putTexel(albedo, x, y, band === 3 && !metal ? step(R.liquid, hash(i, j, 71) < 0.5 ? 1 : 2) : step(R.vein, band === 0 ? 2 : 1)); continue; }
    const rp = metal ? R.metal : band === 3 ? R.deep : R.accent, lo = metal ? (band === 2 ? 0 : 1) : band === 3 ? 1 : 0, h = hash(i, j, 7171);
    const base = lo + Math.floor(h * (band === 2 ? 2 : 3));   // the Shade's silver kept lowest - its court is black glass
    putTexel(albedo, x, y, step(rp, base + (lx === 1 || ly === 1 ? 1 : lx === 7 || ly === 7 ? -1 : 0)));
  }
  quantize(albedo, paletteOf(R.metal, R.accent, R.deep, R.vein, R.liquid));
  if (band === 3) capGlow(albedo, emission, (x, y) => { const j = Math.floor(y / 8); return y < 64 && (wrap(x + (j % 2) * 4, 8) === 0 || y % 8 === 0); }, EG_SEAM_LUMA_MAX);
  return { albedo, emission };
}
/** CHAIN (81): the band's chains' links in the Hour's own bands (world/superDungeon/sdHangArt.js chainArt - EG_KIT_MAP): the fixtures'
 *  metal (bronze, black iron, silver, iron), rubbed bright where the links bear (gold on the Galleries' bronze), dark in the
 *  bends. Matte. */
function chainArt(band) {
  const R = EG_BAND_RAMPS[band], S = 32, albedo = image(S), emission = image(S), tone = noiseField(seedOf(band, 81), 4, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const b = Math.floor(y / 8), t = tone(x, y);
    const c = b === 0 ? ramp(R.fix, 0.25 + 0.3 * t, x, y) : b === 2 ? ramp(R.fix, 0.45 + 0.3 * t, x, y) : b === 3 ? ramp(R.fix, 0.05 + 0.2 * t, x, y) : ramp(R.fix, 0.15 + 0.2 * t, x, y);
    putTexel(albedo, x, y, c); putTexel(emission, x, y, [0, 0, 0]);
  }
  for (let x = 0; x < S; x++) { putTexel(albedo, x, 0, step(R.fix, 4)); putTexel(albedo, x, 16, band === 0 ? step(R.metal, 2) : step(R.fix, 4)); putTexel(albedo, x, 7, step(R.fix, 0)); putTexel(albedo, x, 23, step(R.fix, 0)); }
  quantize(albedo, paletteOf(R.fix, R.metal));
  return { albedo, emission };
}

/** Each record's painter, by record. */
const PAINTERS = Object.freeze({
  [EG_DRESS.floor]: floorArt, [EG_DRESS.brass]: metalArt, [EG_DRESS.root]: rootArt, [EG_DRESS.arena]: arenaArt,
  [EG_DRESS.cobble]: walkArt, [EG_DRESS.edge]: edgeArt, [EG_DRESS.molten]: moltenArt, [EG_DRESS.pillar]: pillarArt,
  // EG-LOOK (section 8): the kit's records
  [EG_KIT_RECORD.shaft]: shaftArt, [EG_KIT_RECORD.moulding]: mouldingArt, [EG_KIT_RECORD.voussoir]: voussoirArt, [EG_KIT_RECORD.relief]: reliefArt,
  [EG_KIT_RECORD.banner]: bannerArt, [EG_KIT_RECORD.coffer]: cofferArt, [EG_KIT_RECORD.statue]: statueArt, [EG_KIT_RECORD.fixture]: fixtureArt,
  [EG_KIT_RECORD.found]: foundArt, [EG_KIT_RECORD.wreck]: wreckArt, [EG_KIT_RECORD.crystal]: crystalArt, [EG_KIT_RECORD.inlay]: inlayArt,
  [EG_KIT_RECORD.chain]: chainArt,
});
/** Every picture band `band` (0-3) wears, by record: `[record, { albedo, emission, cutout? }]` - what a host uploads under
 *  the band's archive (egBandArchive) before it draws the band's halls (a `cutout` picture asking the renderer for its
 *  holes - EG_CUTOUT_RECORDS). Pure: the same pixels every call. */
/** @returns {Array<[number, { albedo: import('../superDungeon/sdPixelKit.js').Img, emission: import('../superDungeon/sdPixelKit.js').Img, cutout?: boolean }]>} */
export function egBandArt(band) {
  return EG_BAND_RECORDS.map((rec) => egBandArtOf(band, rec));
}
/** EG-ZO (2026-10-12, Elite-Gates.md section 7): ONE of band `band`'s pictures, `[record, { albedo, emission }]` - painted
 *  alone, for a pass that wears a few of the band's records (the Spire's underside on the stair - world/eliteGates/egUnderside.js:
 *  its walkways' tesserae, the costliest picture by far, are never painted for a fall that wears none). The same pixels
 *  egBandArt paints for that record. Pure. A record the band does not paint throws.
 *  @returns {[number, { albedo: import('../superDungeon/sdPixelKit.js').Img, emission: import('../superDungeon/sdPixelKit.js').Img, cutout?: boolean }]} */
export function egBandArtOf(band, rec) {
  const paint = PAINTERS[rec];
  if (!paint) throw new Error(`the band paints no record ${rec}`);
  return [rec, paint(Math.max(0, Math.min(3, band | 0)))];
}
/** The palette each band's pictures are forced into (the law's check: nothing off it) - every ramp of the band's (EG-LOOK:
 *  its cloth, deep, fix, flame, tile and haze with its first five), the edge line's gold and the Hour's void. */
export function egBandPalette(band) {
  const R = EG_BAND_RAMPS[Math.max(0, Math.min(3, band | 0))];
  return paletteOf(...Object.values(R), GOLD, SD_RAMP.void);
}
/** Band `band`'s archive (world/eliteGates/pseudoArchives.js EG_BAND_ARCHIVES). */
export const egBandArchive = (band) => EG_BAND_ARCHIVES[Math.max(0, Math.min(3, band | 0))];

/**
 * THE DRESS: a built model (renderer.createMesh's shape - world/superDungeon/sdRealm.js packRealmFaces) moved onto band `band`'s
 * archive - every sub-mesh of the Hour's archive whose record the band paints (EG_DRESS_RECORDS) takes the band's archive;
 * the rest (the Steps' own faces - their dials, cracks and runes are the machine's read, the same in every band) keep
 * theirs. The model is changed in place and answered.
 * @template {{ subMeshes: Array<{ textureArchive: number, textureRecord: number }> }} M
 * @param {M} model @param {number} band @returns {M}
 */
export function egBandDress(model, band) {
  const archive = egBandArchive(band);
  for (const sm of model?.subMeshes ?? []) if (sm.textureArchive === SD_REALM_ARCHIVE && EG_DRESS_RECORDS.includes(sm.textureRecord)) sm.textureArchive = archive;
  return model;
}

// ── EG-ZL: THE BAND'S TELL RECORDS ──────────────────────────────────────────────────────────────────────────────
/** Band `band`'s tell archive: the second of its block (world/eliteGates/pseudoArchives.js EG_BAND_BLOCK - its own later records). */
export const egTellArchive = (band) => egBandArchive(band) + 1;
/** A Beat's dissolve cell in its picture's own texels: the Steps' cell (world/superDungeon/sdStepsModel.js SD_BEAT_DISSOLVE.cell) over a
 *  texel of the plate's top (its inset width across the atlas's top cell). */
export const EG_DISSOLVE_TEXELS = Math.round(SD_BEAT_DISSOLVE.cell / ((SD_BEAT_SIZE.w - 2 * SD_STEP_BEVEL) / SD_STEPS_ATLAS.top[2]));
/** The Beat's records in the tell archive: a danger palette's four warning stages (ui/eliteGates/egAccess.js EG_DANGER_PALETTE_KEYS
 *  order - its dial at frame 10 keeping SD_BEAT_DISSOLVE.keep[0] and [1] of 16 cells, then its falter keeping [2] and [3]),
 *  and the dial's first frame dithering back in (keeping [0], [1], [2] - the stage the return reads first is the thinnest). */
export const EG_BEAT_TELL_RECORDS = Object.freeze({
  warn: Object.freeze(EG_DANGER_PALETTE_KEYS.map((_, v) => Object.freeze(SD_BEAT_DISSOLVE.keep.map((_, k) => v * SD_BEAT_DISSOLVE.keep.length + k)))),
  back: Object.freeze([0, 1, 2].map((k) => EG_DANGER_PALETTE_KEYS.length * SD_BEAT_DISSOLVE.keep.length + k)),
});
/**
 * A PICTURE DISSOLVED (the Steps' dissolve, in the picture - world/superDungeon/sdStepsModel.js buildBeatDissolve cuts the plate's cells
 * out of its mesh; here a cell's texels go to nothing, a picture the renderer cuts, `{ cutout: true }`): `art`'s cells of
 * EG_DISSOLVE_TEXELS kept `keep` of every 16 by the ordered dither (world/superDungeon/sdPixelKit.js BAYER4) - the rest clear in its
 * albedo (a hole) and dark in its light. Pure.
 * @param {{ albedo: import('../superDungeon/sdPixelKit.js').Img, emission: import('../superDungeon/sdPixelKit.js').Img }} art @param {number} keep
 */
export function egDissolveArt(art, keep) {
  const W = art.albedo.width, H = art.albedo.height, a = Uint8Array.from(art.albedo.colors), e = Uint8Array.from(art.emission.colors), C = EG_DISSOLVE_TEXELS;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (BAYER4[((Math.floor(y / C) & 3) << 2) | (Math.floor(x / C) & 3)] < keep) continue;
    const i = (y * W + x) * 4;
    a[i + 3] = 0; e[i] = 0; e[i + 1] = 0; e[i + 2] = 0;
  }
  return { albedo: { width: W, height: H, colors: a }, emission: { width: W, height: H, colors: e } };
}
/** A palette's index (Standard for anything else). */
const paletteIndex = (key) => Math.max(0, EG_DANGER_PALETTE_KEYS.indexOf(egPaletteOf(key).key));
const _warnArt = new Map();
/**
 * A BEAT'S LAST 0.4 S in palette `key`'s hazard (sections 10.3 and 25.2: "the last 0.4 s white"; section 25.7: "the
 * place's hazard dashed cyan" under High contrast) - `[[record, { albedo, emission }], ...]`, the four stages it dissolves
 * out through: the Steps' dial at frame 10, then its falter (world/superDungeon/sdStepsArt.js beatArt, the warning's light the
 * palette's, a hatching palette's rim line dashed), each dissolved. Pure, and painted once a palette.
 */
export function egBeatWarnArt(key) {
  const v = paletteIndex(key);
  let out = _warnArt.get(v);
  if (!out) {
    const P = egPaletteOf(key), warn = P.hazard.map((c) => Math.round(c * 255)), dash = P.hatch === 1;
    const frame = beatArt(SD_BEAT_EMBER_FRAME, false, undefined, { warn, dash }), falter = beatArt(SD_BEAT_EMBER_FRAME + 1, true, undefined, { warn, dash });
    // its light faltered over the warning's second half (the Steps' falter: once at SD_BEAT_BLINK_HZ, shown 0.2 s then out)
    out = Object.freeze(SD_BEAT_DISSOLVE.keep.map((keep, k) => [EG_BEAT_TELL_RECORDS.warn[v][k], egDissolveArt(k < SD_BEAT_DISSOLVE.keep.length / 2 ? frame : falter, keep)]));
    _warnArt.set(v, out);
  }
  return out;
}
let _backArt = null;
/** A BEAT COMING BACK: the Steps' dial at its first frame dithering in over SD_BEAT_IN_S - `[[record, art], ...]`, its three
 *  stages (every palette's). Pure, and painted once. */
export function egBeatBackArt() {
  if (!_backArt) { const first = beatArt(0); _backArt = Object.freeze([0, 1, 2].map((k) => [EG_BEAT_TELL_RECORDS.back[k], egDissolveArt(first, SD_BEAT_DISSOLVE.keep[k])])); }
  return _backArt;
}
/** The picture maps a Beat's draw takes on band `band` in palette `key` (a draw's texRemap - the Steps' dial record onto the
 *  tell archive's): `{ warn: [its four stages out], back: [its three stages in, the thinnest last] }`, made once each. */
const _tellMaps = new Map();
export function egBeatTellMaps(band, key) {
  const v = paletteIndex(key), k = `${band | 0}:${v}`;
  let m = _tellMaps.get(k);
  if (!m) {
    const from = `${SD_REALM_ARCHIVE}_${SD_STEPS_RECORD.beat[0]}`, to = (rec) => new Map([[from, `${egTellArchive(band)}_${rec}`]]);
    _tellMaps.set(k, m = Object.freeze({ warn: Object.freeze(EG_BEAT_TELL_RECORDS.warn[v].map(to)), back: Object.freeze(EG_BEAT_TELL_RECORDS.back.map(to)) }));
  }
  return m;
}
