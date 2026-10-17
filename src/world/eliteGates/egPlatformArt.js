// @ts-check
// EG-LOOK (2026-10-15, Mac: "Literally everything, and no band aids"; bible/11-Multiplayer/Elite-Gates-Look.md "What was
// wrong" - "The span pieces wore the Steps' clock faces" - and Elite-Gates.md sections 10.3 and 25): THE SPAN PIECES' OWN
// PICTURES - the two tells a piece's picture carries, painted in its band's dress under the band's tell archive
// (world/eliteGates/egBandArt.js egTellArchive, after the Beat's warning and return - EG_BEAT_TELL_RECORDS):
//
//   A CRUMBLE'S FOUR STAGES (EG_CRUMBLE_TELL_RECORDS): the Steps' own crumble (world/superDungeon/sdStepsArt.js crumbleArt - its atlas,
//     its two main cracks where it breaks into its chunks, its crack stages' widths and their light) laid over the band's
//     own floor instead of the Hour's basalt: its top the band's floor picture itself (world/eliteGates/egBandArt.js - its flags as
//     every other piece's top lays them, a tile two metres), the void's furnace in the cracks flaring stage by stage exactly
//     as the Steps' do (SD_CRACK_STAGES, SD_STEPS_GLOW.crack), its sides the band's foundation courses with the main cracks
//     running down them, the gold line under the rim going ember at the last stage. A Crumble reads as the band's floor
//     breaking, and still as a Crumble - its tell is the law's, its stone the band's.
//   A BEAT'S STONE DISSOLVING (EG_BEAT_STONE_RECORDS): a Beat is the Steps' dial set in the band's stone (world/
//     egPlatformModel.js egBeatModel - its cornice and its torn underside), so its stone goes and comes with its dial: the
//     band's moulding and foundation pictures (world/eliteGates/egBandArt.js egBandArtOf - the kit's records, whatever the band paints
//     there) cut by the same ordered dither the dial's warning is (egDissolveArt - SD_BEAT_DISSOLVE.keep), four stages out
//     and three back. They carry no light (stone does not glow); the place's white is the dial's and its line's alone.
//
// Pure: the same pixels every call (the paint box - world/superDungeon/sdPixelKit.js - quantized to the band's palette). Not a DFU
// member. Ledger A (ELITE-GATES).
import { SD_RAMP, SD_LIGHT } from '../superDungeon/sdLook.js';
import { image, putTexel, scale, ramp, step, noiseField, quantize } from '../superDungeon/sdPixelKit.js';
import { SD_STEPS_ATLAS, SD_STEP_BEVEL, SD_CRACK_STAGES, SD_STEPS_GLOW, SD_CRUMBLE_CRACKS, crackDistance } from '../superDungeon/sdStepsArt.js';
import { SD_CRUMBLE_SIZE } from '../superDungeon/sdSteps.js';
import { SD_BEAT_DISSOLVE } from '../superDungeon/sdStepsModel.js';
import { EG_BAND_RAMPS, EG_BEAT_TELL_RECORDS, EG_DRESS, egBandArtOf, egBandPalette, egDissolveArt } from './egBandArt.js';
import { EG_KIT_RECORD } from './egKit.js';

/** The tell archive's first record past the Beat's warning and return. */
const BASE = Math.max(...EG_BEAT_TELL_RECORDS.warn.flat(), ...EG_BEAT_TELL_RECORDS.back) + 1;
/** A CRUMBLE'S PICTURES in the band's tell archive: at rest, then its three stages under a foot (the Steps' order -
 *  world/superDungeon/sdStepsArt.js SD_STEPS_RECORD.crumble). */
export const EG_CRUMBLE_TELL_RECORDS = Object.freeze([BASE, BASE + 1, BASE + 2, BASE + 3]);
/** A BEAT'S STONE (world/eliteGates/egPlatformModel.js egBeatModel - the records it wears besides its dial): each record's four
 *  stages out (SD_BEAT_DISSOLVE.keep - its warning's) and three back in (the return's - the thinnest read first, as the
 *  dial's EG_BEAT_TELL_RECORDS.back), in the band's tell archive. */
export const EG_BEAT_STONE_RECORDS = Object.freeze([EG_KIT_RECORD.moulding, EG_KIT_RECORD.found].map((rec, j) => Object.freeze({
  rec,
  warn: Object.freeze(SD_BEAT_DISSOLVE.keep.map((_, k) => BASE + 4 + j * 7 + k)),
  back: Object.freeze([0, 1, 2].map((k) => BASE + 8 + j * 7 + k)),
})));
/** Every record the spans' pieces put up under a band's tell archive besides the Beat's dial (the owner frees them all). */
export const EG_PIECE_TELL_RECORDS = Object.freeze([...EG_CRUMBLE_TELL_RECORDS, ...EG_BEAT_STONE_RECORDS.flatMap((q) => [...q.warn, ...q.back])]);

const EMBER = SD_LIGHT.ember.map((v) => Math.round(v * 255));
const GOLD_LIGHT = SD_LIGHT.gold.map((v) => Math.round(v * 255));
const GOLD = EG_BAND_RAMPS[0].metal;   // THE EDGE LINE's gold, every band's (world/eliteGates/egBandArt.js edgeArt)
const BLACK = Object.freeze([0, 0, 0]);
/** Paint a cell texel by texel (world/superDungeon/sdStepsArt.js's own fill): `fn(s, t, x, y)` its colour, s and t 0..1 across it. */
function fill(img, cell, fn) {
  const [x0, y0, w, h] = cell;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn((x + 0.5) / w, (y + 0.5) / h, x0 + x, y0 + y); if (c) putTexel(img, x0 + x, y0 + y, c); }
}
/** A crumble top's texel in metres of its own face (x, z from its centre - the top's inset, the Steps' topMetres). */
const topMetres = (s, t) => [(s - 0.5) * (SD_CRUMBLE_SIZE.w - 2 * SD_STEP_BEVEL), (t - 0.5) * (SD_CRUMBLE_SIZE.d - 2 * SD_STEP_BEVEL)];
const fract = (v) => v - Math.floor(v);

const _crumble = new Map();
/**
 * A CRUMBLE at stage `n` (0 at rest, 1-3 under a foot) in band `band`'s dress: `{ albedo, emission }` in the Steps' atlas
 * (world/superDungeon/sdStepsArt.js SD_STEPS_ATLAS - the geometry is the Steps' own bevelled box and its chunks, so every cell lies where
 * theirs does). The top: the band's flags a metre square in running bond, each its own shade, the joints its vein, the
 * cracks of the stage over them - their hearts the void's furnace and their lips dark, lit as the Steps' (SD_STEPS_GLOW
 * .crack). The sides: the band's stone in courses, the main cracks running down where they meet the edges. The line under
 * the rim gold, ember at the last stage. Pure; painted once a band and stage.
 */
export function egCrumbleArt(band, n = 0) {
  const b = Math.max(0, Math.min(3, band | 0)), k0 = `${b}:${n}`;
  let out = _crumble.get(k0);
  if (out) return out;
  const R = EG_BAND_RAMPS[b], A = SD_STEPS_ATLAS, S = SD_CRACK_STAGES[n], k = SD_STEPS_GLOW.crack[n], hot = SD_RAMP.void[4];
  const albedo = image(A.w, A.h), emission = image(A.w, A.h), g = noiseField(0xe6c0 + b * 31 + 7, 6, A.w, A.h);
  const floor = egBandArtOf(b, EG_DRESS.floor)[1].albedo, found = egBandArtOf(b, EG_KIT_RECORD.found)[1].albedo;
  /** a texel of picture `img` (tiling) at its own (u, v) in repeats */
  const texel = (img, u, v) => { const x = Math.floor(fract(u) * img.width), y = Math.floor(fract(v) * img.height), i = (y * img.width + x) * 4; return [img.colors[i], img.colors[i + 1], img.colors[i + 2]]; };
  const crack = (mx, mz) => { const [m, br] = crackDistance(mx, mz); return S.branch ? Math.min(m, br * 1.4) : Math.min(m, br * 2.2); };
  fill(albedo, A.top, (s, t, x, y) => {
    const [mx, mz] = topMetres(s, t), d = crack(mx, mz);
    if (d < S.core) return [...hot];
    if (d < S.lip) return step(R.vein, 0);
    return texel(floor, mx / 2 + 0.5, mz / 2 + 0.5);   // the band's own floor, a tile two metres (world/eliteGates/egPlatformModel.js topFace's)
  });
  fill(emission, A.top, (s, t) => { const [mx, mz] = topMetres(s, t), d = crack(mx, mz); return d < S.core ? scale(EMBER, k) : d < S.lip ? scale(EMBER, k * 0.18) : BLACK; });
  // the sides: the band's stone in courses, the main cracks running down where they meet the edges
  const [x0, y0, w, h] = A.side;
  fill(albedo, A.side, (s, t, x) => texel(found, (x - x0) / found.width, (6 + t * 40) / found.height));   // the foundation's courses (EG_KIT_MAP's band) under the rim
  for (const pts of [SD_CRUMBLE_CRACKS.across, SD_CRUMBLE_CRACKS.along]) for (const p of [pts[0], pts[pts.length - 1]]) {
    const u = Math.abs(Math.abs(p[0]) - SD_CRUMBLE_SIZE.w / 2) < 1e-6 ? (p[1] / SD_CRUMBLE_SIZE.d + 0.5) : (p[0] / SD_CRUMBLE_SIZE.w + 0.5);
    const cx = x0 + Math.round(u * (w - 1));
    for (let yy = 0; yy < h; yy++) { const wob = Math.round(Math.sin(yy * 1.7 + cx) * 0.8); putTexel(albedo, cx + wob, y0 + yy, [...hot]); putTexel(emission, cx + wob, y0 + yy, scale(EMBER, k * (1 - yy / h))); }
  }
  // the gold line under the rim (THE EDGE LINE's gold, ember at the last stage - the Steps' paintRim), its chamfer the
  // stone's lit arris, its underside the stone's dark
  const lineCol = n >= 3 ? EMBER : GOLD_LIGHT;
  fill(albedo, A.line, (s, t) => (t < 0.5 ? step(GOLD, 4) : step(GOLD, 3)));
  fill(emission, A.line, (s, t) => scale(lineCol, t < 0.5 ? SD_STEPS_GLOW.line : SD_STEPS_GLOW.line * 0.7));
  fill(albedo, A.bevel, (s, t, x, y) => ramp(R.stone, 0.62 + 0.25 * (1 - t), x, y));
  fill(albedo, A.under, (s, t, x, y) => ramp(R.vein, 0.2 + 0.5 * g(x, y), x, y));
  quantize(albedo, egBandPalette(b));
  out = Object.freeze({ albedo, emission });
  _crumble.set(k0, out);
  return out;
}
/** Every picture of a band's Crumble, `[[record, art], ...]` - its rest and its three stages. Pure. */
export const egCrumbleTellArt = (band) => EG_CRUMBLE_TELL_RECORDS.map((rec, n) => /** @type {[number, ReturnType<typeof egCrumbleArt>]} */ ([rec, egCrumbleArt(band, n)]));

const _stone = new Map();
/**
 * A BEAT'S STONE DISSOLVING in band `band`'s dress: `[[record, { albedo, emission }], ...]` - each stone record's picture
 * (the band's own - egBandArtOf) kept by the ordered dither, its four stages out and its three back (EG_BEAT_STONE_RECORDS),
 * its light black (stone does not glow). Pure; painted once a band.
 */
export function egBeatStoneArt(band) {
  const b = Math.max(0, Math.min(3, band | 0));
  let out = _stone.get(b);
  if (!out) {
    const list = [];
    for (const q of EG_BEAT_STONE_RECORDS) {
      const [, art] = egBandArtOf(b, q.rec), dark = { albedo: art.albedo, emission: image(art.emission.width, art.emission.height) };
      q.warn.forEach((rec, k) => list.push([rec, egDissolveArt(dark, SD_BEAT_DISSOLVE.keep[k])]));
      q.back.forEach((rec, k) => list.push([rec, egDissolveArt(dark, SD_BEAT_DISSOLVE.keep[k])]));
    }
    _stone.set(b, out = Object.freeze(list));
  }
  return out;
}
