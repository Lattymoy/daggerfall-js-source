// @ts-check
// SD8c (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10): THE REMNANT'S ART - what
// the Brass Remnant's Echoes wear that the Remnant itself does not (it wears the Hour's own brass, world/sdRealmArt.js):
// the GOLD Echo's gilt and the SILVER Echo's, made in code as the realm's are (the realm's pseudo-archive, world/sdRealm.js
// SD_REALM_ARCHIVE, records after the Steps'): nothing ships, the same pixels every boot. Each `{ albedo, emission }` in the
// renderer's color32 shape - RGBA rows, row 0 the texture's v 0, drawn with y up.
//
//   gold   - beaten gold plate, riveted, a low gleam of its own (an Echo stands outside time: it glows)
//   silver - the same in silver
//   SD18c: the ENDINGS' LIGHTS (records 25-30, one an Ending - net/sdMarks.js SD_ENDINGS' `light`): the light its heart,
//          its eyes and the Reset's Hearts burn with in a Hollow that keeps that Ending - its colour, and as much again
//          its own light (the hall's glows' way, world/sdHallArt.js hallGlowArt)
//
//   SD-LOOK S8 (Super-Dungeons-Look.md section 10): THE REMNANT'S OWN PSEUDO-ARCHIVE (SD_REMNANT_ARCHIVE - never the
//          Hour's 38151, whose records section 7 names): THE TELL ATLAS, one a metal and a heat (off, mid, hot) - the
//          sole's tread, the fist's knuckles, the Hour-Hand's blade (root to tip) and the ribs, each region lit in its
//          blow's colour (scenes/sdRemnantBlows.js SD_BLOW_COLOR, handed in); a part that tells wears a remap to its
//          heat, and only its own faces sample its region. The Reset's WHITE HEART (mid the Reset's soul-white, hot the
//          moment's white-gold), the HUSK a torn-out heart leaves, the BACK-DIAL's chapter ring in each metal (its
//          numerals the sky's own glyphs - world/sdSkyArt.js), its HAND (cold, ember for the stun, gold or silver for
//          the Echo window, white for the Reset), and the RIB LAMPS' strip lit 0-8 from the bottom in Mantella.
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_ENDINGS } from '../net/sdMarks.js';
import { SD_RAMP, SD_LIGHT } from './sdLook.js';
import { image as kitImage, putTexel, texelAt, ramp, step, bayer, blendRgb, scale as kitScale, paletteOf, quantize } from './sdPixelKit.js';
import { realmBrassArt } from './sdRealmArt.js';
import { SD_HOUR_NUMERALS, numeralWidth, numeralCell } from './sdSkyArt.js';

/** The records, after the Steps' (world/sdStepsArt.js, 21-22). */
export const SD_REMNANT_GOLD_RECORD = 23;
export const SD_REMNANT_SILVER_RECORD = 24;
/** SD18c: each Ending's light, by its id - after the Echoes' metals. */
export const SD_REMNANT_ENDING_RECORD = Object.freeze(Object.fromEntries(SD_ENDINGS.map((E, k) => [E.id, 25 + k])));
/** The pictures' side, texels (an Ending's light, a flat colour, smaller). */
export const SD_REMNANT_ART_SIZE = 64;
export const SD_ENDING_ART_SIZE = 16;
/** Each metal's plate, its rivets' and seams' shade, and its own low light. */
export const SD_ECHO_METALS = Object.freeze({
  gold: Object.freeze({ plate: Object.freeze([226, 176, 64]), seam: Object.freeze([120, 84, 24]), glow: Object.freeze([120, 90, 30]) }),
  silver: Object.freeze({ plate: Object.freeze([200, 206, 214]), seam: Object.freeze([96, 102, 112]), glow: Object.freeze([90, 96, 110]) }),
});

const image = (S) => ({ width: S, height: S, colors: new Uint8Array(S * S * 4) });
const put = (img, x, y, rgb) => { const i = (y * img.width + x) * 4; img.colors[i] = rgb[0]; img.colors[i + 1] = rgb[1]; img.colors[i + 2] = rgb[2]; img.colors[i + 3] = 255; };
const shade = (c, k) => c.map((v) => Math.round(Math.max(0, Math.min(255, v * k))));

/** A metal's plate: four panels a side, seams between them, a rivet at each panel's corners, a grain down it. */
export function echoMetalArt(metal) {
  const M = SD_ECHO_METALS[metal];
  const S = SD_REMNANT_ART_SIZE, albedo = image(S), emission = image(S), P = S / 4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const px = x % P, py = y % P;
    const seam = px === 0 || py === 0;
    const rivet = (px === 3 || px === P - 3) && (py === 3 || py === P - 3);
    const grain = 0.92 + 0.08 * Math.sin((x * 0.7 + y * 0.13) * 1.7);
    put(albedo, x, y, seam ? M.seam : rivet ? shade(M.plate, 1.15) : shade(M.plate, grain));
    put(emission, x, y, seam ? [0, 0, 0] : M.glow);
  }
  return { albedo, emission };
}

/** SD18c: an Ending's light - its colour, and as much again its own light (a flat picture). */
export function endingLightArt(light) {
  const S = SD_ENDING_ART_SIZE, albedo = image(S), emission = image(S), rgb = light.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { put(albedo, x, y, rgb); put(emission, x, y, rgb); }
  return { albedo, emission };
}
/** Every picture the Remnant's Echoes wear, and (SD18c) every Ending's light, by record: `[record, { albedo, emission }]`.
 * @returns {Array<[number, ReturnType<typeof echoMetalArt>]>} */
export function remnantArt() {
  return [[SD_REMNANT_GOLD_RECORD, echoMetalArt('gold')], [SD_REMNANT_SILVER_RECORD, echoMetalArt('silver')], ...SD_ENDINGS.map((E) => /** @type {[number, ReturnType<typeof echoMetalArt>]} */ ([SD_REMNANT_ENDING_RECORD[E.id], endingLightArt(E.light)]))];
}

// ── SD-LOOK S8: the Remnant's own archive ────────────────────────────────────────────────────────────────────────────
/** The Remnant's own pseudo-archive (the port's made archives, one owner each - world/sdRealm.js SD_REALM_ARCHIVE the
 *  Hour's): its records from 100, so a model mixing both archives keys every record apart (world/gateModel.js faces). */
export const SD_REMNANT_ARCHIVE = 38155;
/** THE TELL ATLAS's records: a metal's off, mid and hot. */
export const SD_REMNANT_TELL_RECORD = Object.freeze({ brass: Object.freeze([100, 101, 102]), gold: Object.freeze([103, 104, 105]), silver: Object.freeze([106, 107, 108]) });
/** The Reset's white heart (mid, hot), the husk a torn-out heart leaves, the back-dial's chapter ring in each metal, its
 *  hand (cold, ember, gold, silver, white), the rib lamps' strip lit 0..8. */
export const SD_REMNANT_WHITE_RECORD = Object.freeze([109, 110]);
export const SD_REMNANT_HUSK_RECORD = 111;
export const SD_REMNANT_DIAL_RECORD = Object.freeze({ brass: 112, gold: 113, silver: 114 });
export const SD_REMNANT_HAND_RECORD = Object.freeze({ cold: 115, ember: 116, gold: 117, silver: 118, white: 119 });
export const SD_REMNANT_LAMP_RECORD = Object.freeze(Array.from({ length: 9 }, (_, n) => 120 + n));
/** The back-dial's rim line in each metal: its teeth's tips rubbed bright, at the ambient rung (L2, as the realm's edge
 *  line - world/sdRealmArt.js SD_EDGE_GLOW), so from the front its rim haloes the head; SD_DIAL_RIM_GLOW of its colour. */
export const SD_REMNANT_RIM_RECORD = Object.freeze({ brass: 129, gold: 130, silver: 131 });
export const SD_DIAL_RIM_GLOW = 0.3;
/** The Volley's gears forming in its hands: brass hot in the Volley's colour (a tell, from any side), SD_GATHER_GLOW of it. */
export const SD_REMNANT_GATHER_RECORD = 132;
export const SD_GATHER_GLOW = 0.8;
/** The atlas's side, and its regions in texels `[x0, y0, w, h]` (row 0 is v 0): the sole's tread, the fist's knuckles,
 *  the blade (its length along u, 0 at the tip, the root at the right), the ribs' bar (along u). */
export const SD_TELL_ART_SIZE = 64;
export const SD_TELL_REGION = Object.freeze({
  sole: Object.freeze([0, 0, 32, 32]), fist: Object.freeze([32, 0, 32, 32]), blade: Object.freeze([0, 32, 64, 16]), rib: Object.freeze([0, 48, 64, 16]),
});
/** The blow each region tells (its colour scenes/sdRemnantBlows.js SD_BLOW_COLOR's), and how far into the blade the mid
 *  heat has run from the root (its share of the length - its front dithered over SD_BLADE_FRONT of it). */
export const SD_TELL_BLOW = Object.freeze({ sole: 'stomp', fist: 'volley', blade: 'hand', rib: 'pulse' });
export const SD_BLADE_MID = 0.5;
export const SD_BLADE_FRONT = 0.125;
/** A heat's light: off none, mid and hot each a share of the blow's colour (hot at the critical rung, L4). */
export const SD_TELL_GLOW = Object.freeze([0, 0.55, 1.0]);
/** The chapter ring's picture (u round the dial, v from its inner edge out) and the lamps' strip (a cell each). */
export const SD_DIAL_ART = Object.freeze({ w: 256, h: 16 });
export const SD_LAMP_ART = Object.freeze({ w: 32, h: 4 });

const rgb8 = (c) => [Math.round(Math.max(0, Math.min(1, c[0])) * 255), Math.round(Math.max(0, Math.min(1, c[1])) * 255), Math.round(Math.max(0, Math.min(1, c[2])) * 255)];
/** The metal every tell's region is painted over, at the same texels as the body around it wears: the Hour's brass
 *  (world/sdRealmArt.js realmBrassArt), or an Echo's gilt or silver (echoMetalArt). */
const metalBase = (metal) => (metal === 'brass' ? realmBrassArt() : echoMetalArt(metal));
/** Whether texel (lx, ly) of region `key` (w x h) is one of its features - what a mid heat lights: the sole's tread
 *  grooves, the fist's knuckle seams, the blade's fuller and its edges, the rib's core. */
function tellFeature(key, lx, ly, w, h) {
  if (key === 'sole') return lx % 8 < 2 || ly % 8 < 2;
  if (key === 'fist') return ly % 8 < 2 || lx < 2 || lx >= w - 2;
  if (key === 'blade') return (ly >= h / 2 - 2 && ly < h / 2 + 2) || ly < 2 || ly >= h - 2;
  return ly >= h / 2 - 2 && ly < h / 2 + 2;   // the rib's core
}
/** How much of region `key` a heat lights at its texel (lx, ly): 0 none, 1 its glow, 2 its core (the hottest). Off
 *  nothing; mid its features - the blade's root half alone, its front dithered toward the tip; hot the whole region, its
 *  features the core. Pure. */
export function tellLit(key, heat, lx, ly, w = SD_TELL_REGION[key][2], h = SD_TELL_REGION[key][3]) {
  if (!(heat > 0)) return 0;
  const feature = tellFeature(key, lx, ly, w, h);
  if (heat >= 2) return feature ? 2 : 1;
  if (key === 'blade') {
    const a = (lx + 0.5) / w, from = 1 - SD_BLADE_MID;   // a: its share of the length from the tip - the root's half heats first
    if (a < from - SD_BLADE_FRONT || (a < from && (from - a) / SD_BLADE_FRONT > bayer(lx, ly))) return 0;
    return 1;
  }
  return feature ? 1 : 0;
}
/** THE TELL ATLAS of `metal` at `heat` (0 off, 1 mid, 2 hot), its regions' colours `colors` (SD_BLOW_COLOR's shape,
 *  linear): the metal everywhere, each region's tread, knuckles, fuller or core cut in a shade darker; a lit texel heats
 *  toward its blow's colour and gives its light (SD_TELL_GLOW), its core the hottest; every texel quantized into the
 *  metal's own colours and the heats' steps. Off, it is the metal its neighbours wear and its own low light. */
export function remnantTellArt(metal, heat, colors, base = metalBase(metal)) {
  const S = SD_TELL_ART_SIZE, albedo = kitImage(S), emission = kitImage(S);
  const palette = metal === 'brass' ? paletteOf(SD_RAMP.brass, SD_RAMP.verdigris) : [], seen = new Set();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const c = texelAt(base.albedo, x, y), k = (c[0] << 16) | (c[1] << 8) | c[2];
    putTexel(albedo, x, y, c); putTexel(emission, x, y, texelAt(base.emission, x, y));
    if (metal !== 'brass' && !seen.has(k)) { seen.add(k); palette.push(c); }
  }
  const bright = metal === 'silver' ? SD_RAMP.silver[4] : SD_RAMP.brass[5];
  for (const [key, R] of Object.entries(SD_TELL_REGION)) {
    const [x0, y0, w, h] = R, hue = rgb8(colors[SD_TELL_BLOW[key]]);
    const steps = [blendRgb(bright, hue, 0.45), blendRgb(bright, hue, 0.8), hue];
    palette.push(...steps, ...[0, 1, 2, 3, 4].map((i) => blendRgb(metal === 'silver' ? SD_RAMP.silver[i] : SD_RAMP.brass[i], [0, 0, 0], 0.35)));
    for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) {
      const x = x0 + lx, y = y0 + ly;
      if (tellFeature(key, lx, ly, w, h)) putTexel(albedo, x, y, blendRgb(texelAt(albedo, x, y), [0, 0, 0], 0.35));
      const lit = tellLit(key, heat, lx, ly, w, h);
      if (!lit) continue;
      putTexel(albedo, x, y, steps[lit === 2 ? 2 : heat >= 2 ? 1 : 0]);
      putTexel(emission, x, y, kitScale(hue, SD_TELL_GLOW[heat] * (lit === 2 ? 1 : 0.7)));
    }
  }
  quantize(albedo, palette);
  return { albedo, emission };
}
/** THE HUSK: what the cage holds once its heart is torn out - dark glass, cold, a dull verdigris glint; no light. */
export function remnantHuskArt() {
  const S = SD_ENDING_ART_SIZE, albedo = kitImage(S), emission = kitImage(S), V = SD_RAMP.void, Vg = SD_RAMP.verdigris;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) putTexel(albedo, x, y, (x + y) % 7 === 0 ? step(Vg, 1) : ramp(V, 0.15 + (0.35 * ((x * 5 + y * 3) % 8)) / 8, x, y));
  return { albedo, emission };
}
/** THE BACK-DIAL's chapter ring in `metal`: u once round from XII (clockwise as its face is seen from behind), v from
 *  its inner edge out - a dark enamel band between rubbed rims, a tick each minute at its outer edge, and the twelve
 *  hours in the sky's own Roman glyphs (world/sdSkyArt.js), their tops outward. No light of its own: metal is structure. */
export function remnantDialArt(metal) {
  const { w: W, h: H } = SD_DIAL_ART, albedo = kitImage(W, H), emission = kitImage(W, H);
  const M = metal === 'silver' ? SD_RAMP.silver : SD_RAMP.brass, B = SD_RAMP.basalt;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const rim = y < 2 || y >= H - 2;
    putTexel(albedo, x, y, rim ? step(M, y === 0 || y === H - 1 ? 1 : 4) : ramp(B, 0.3 + (0.25 * ((x * 7) % 5)) / 5, x, y));
  }
  for (let m = 0; m < 60; m++) { const x = Math.round((m / 60) * W); for (let y = H - 4; y < H - 2; y++) putTexel(albedo, x, y, step(M, m % 5 ? 2 : 4)); }
  SD_HOUR_NUMERALS.forEach((s, k) => {
    const cx = Math.round((k / 12) * W), wd = numeralWidth(s), left = cx - Math.floor(wd / 2);
    for (let cy = 0; cy < 7; cy++) for (let c = 0; c < wd; c++) if (numeralCell(s, c, cy)) putTexel(albedo, left + c, H - 6 - cy, step(M, 4));
  });
  quantize(albedo, paletteOf(M, B));
  return { albedo, emission };
}
/** THE DIAL'S RIM LINE in `metal`: its bright rubbed steps in rows a texel apart, its light SD_DIAL_RIM_GLOW of them. */
export function remnantRimArt(metal) {
  const S = SD_ENDING_ART_SIZE, albedo = kitImage(S), emission = kitImage(S), M = metal === 'silver' ? SD_RAMP.silver : SD_RAMP.brass, top = M.length - 1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const c = step(M, y % 4 === 3 ? top - 2 : top - (x + y) % 2); putTexel(albedo, x, y, c); putTexel(emission, x, y, kitScale(c, SD_DIAL_RIM_GLOW)); }
  return { albedo, emission };
}
/** THE VOLLEY'S GEARS FORMING: bright brass heated toward `color` (the Volley's), rubbed rows a texel apart, its light
 *  SD_GATHER_GLOW of the colour. */
export function remnantGatherArt(color) {
  const S = SD_ENDING_ART_SIZE, albedo = kitImage(S), emission = kitImage(S), hue = rgb8(color), Br = SD_RAMP.brass;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const edge = y % 4 === 0; putTexel(albedo, x, y, blendRgb(step(Br, edge ? 5 : 4), hue, edge ? 0.5 : 0.7)); putTexel(emission, x, y, kitScale(hue, SD_GATHER_GLOW * (edge ? 1 : 0.8))); }
  return { albedo, emission };
}
/** THE DIAL'S HAND, by its look: cold (the dial's dark brass, no light - it only ticks), or lit in the light it means -
 *  ember (the stun running out), gold or silver (the fallen Echo's window), white (the Reset). */
export function remnantHandArt(look) {
  const S = SD_ENDING_ART_SIZE, albedo = kitImage(S), emission = kitImage(S);
  const lit = { ember: SD_LIGHT.ember, gold: SD_LIGHT.gold, silver: SD_LIGHT.moon, white: SD_LIGHT.moment }[look] ?? null;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const edge = x === 0 || x === S - 1;
    if (!lit) { putTexel(albedo, x, y, step(SD_RAMP.brass, edge ? 3 : 1)); continue; }
    const c = rgb8(lit);
    putTexel(albedo, x, y, edge ? blendRgb(c, [255, 255, 255], 0.4) : c); putTexel(emission, x, y, kitScale(c, edge ? 1 : 0.85));
  }
  return { albedo, emission };
}
/** THE RIB LAMPS' strip with `n` lit: eight cells (lamp k's faces sample cell k), the first n in Mantella, the rest dark
 *  glass with a cold glint. */
export function remnantLampArt(n) {
  const { w: W, h: H } = SD_LAMP_ART, albedo = kitImage(W, H), emission = kitImage(W, H), c = rgb8(SD_LIGHT.mantella), cw = W / 8;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = Math.floor(x / cw), glint = x % cw === 1 && y === 1;
    if (k < n) { putTexel(albedo, x, y, glint ? [230, 255, 240] : c); putTexel(emission, x, y, glint ? c : kitScale(c, 0.9)); }
    else putTexel(albedo, x, y, glint ? step(SD_RAMP.verdigris, 3) : step(SD_RAMP.void, 2));
  }
  return { albedo, emission };
}
/** @typedef {{ width: number, height: number, colors: Uint8Array }} RemnantImg */
/** EVERY PICTURE OF THE REMNANT'S OWN ARCHIVE, by record (`colors` the blows' - SD_BLOW_COLOR's shape): the tell
 *  atlases, the white heart (mid the Reset's own soul-white, hot the moment's white-gold), the husk, the dials, the
 *  hands, the lamps, the rim lines.
 * @returns {Array<[number, { albedo: RemnantImg, emission: RemnantImg }]>} */
export function remnantLookArt(colors) {
  /** @type {Array<[number, { albedo: RemnantImg, emission: RemnantImg }]>} */
  const out = [];
  for (const metal of /** @type {const} */ (['brass', 'gold', 'silver'])) { const base = metalBase(metal); SD_REMNANT_TELL_RECORD[metal].forEach((rec, heat) => out.push([rec, remnantTellArt(metal, heat, colors, base)])); }   // its metal painted once
  out.push([SD_REMNANT_WHITE_RECORD[0], endingLightArt(colors.reset)], [SD_REMNANT_WHITE_RECORD[1], endingLightArt(SD_LIGHT.moment)], [SD_REMNANT_HUSK_RECORD, remnantHuskArt()]);
  for (const metal of /** @type {const} */ (['brass', 'gold', 'silver'])) out.push([SD_REMNANT_DIAL_RECORD[metal], remnantDialArt(metal)]);
  for (const [look, rec] of Object.entries(SD_REMNANT_HAND_RECORD)) out.push([rec, remnantHandArt(look)]);
  SD_REMNANT_LAMP_RECORD.forEach((rec, n) => out.push([rec, remnantLampArt(n)]));
  for (const metal of /** @type {const} */ (['brass', 'gold', 'silver'])) out.push([SD_REMNANT_RIM_RECORD[metal], remnantRimArt(metal)]);
  out.push([SD_REMNANT_GATHER_RECORD, remnantGatherArt(colors.volley)]);
  return out;
}
