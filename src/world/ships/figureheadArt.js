// @ts-check
// FIGUREHEAD (2026-10-30; bible/03-World/Naval-Refit.md FIGUREHEAD) - THE CARVINGS' PICTURES, the port's own, made in code
// under a pseudo-archive (merchantYardArt.js's law: pixels and numbers, nothing of Daggerfall's read). Beaten gilt, carved
// wood under each of SHIP_PAINTS' fourteen, the oak of the bracket, the pitch of an eye and the ivory of a tooth. A carving
// wears them by ROLE (world/ships/figureheadModels.js): its body gilt as built and her accent paint when painted, its trim
// gilt, its bracket oak.
import { YARD_ART_KIT } from '../merchantYards/merchantYardArt.js';
import { SHIP_PAINTS, PAINT_MAX } from '../../systems/naval/shipLivery.js';

const { rng, noiseField, image, put, mix } = YARD_ART_KIT;

/** The pseudo-archive the carvings' pictures stand under (world/eliteGates/pseudoArchives.js) - beside the ship's paint,
 *  cabin and name boards (38191-38193). */
export const FIGUREHEAD_ARCHIVE = 38194;
/** Its records: gilt 0, each paint at its own index (1-14), then oak, pitch and ivory. */
export const CARVING_REC = Object.freeze({ gilt: 0, oak: PAINT_MAX + 1, pitch: PAINT_MAX + 2, ivory: PAINT_MAX + 3 });
/** A picture's side, texels. */
export const CARVING_ART_SIZE = 32;
/** The roles a carving's faces wear (figureheadModels.js) - its body, its trim, its bracket, an eye, a tooth. */
export const ROLE = Object.freeze({ body: 0, trim: 1, base: 2, eye: 3, bone: 4 });

/** The record each role wears under `paint` (0: as built): the body gilt or the paint, the trim gilt, the rest fixed. */
export function roleRecords(paint) {
  const p = Number.isInteger(paint) && paint > 0 && paint <= PAINT_MAX ? paint : 0;
  return Object.freeze({ [ROLE.body]: p || CARVING_REC.gilt, [ROLE.trim]: CARVING_REC.gilt, [ROLE.base]: CARVING_REC.oak, [ROLE.eye]: CARVING_REC.pitch, [ROLE.bone]: CARVING_REC.ivory });
}

/** Each record's middle colour - the panel's picture paints a face with it (ui/figureheadPanel.js). */
export const GILT_RGB = Object.freeze([206, 160, 58]);
export const OAK_RGB = Object.freeze([112, 76, 44]);
export const PITCH_RGB = Object.freeze([26, 20, 16]);
export const IVORY_RGB = Object.freeze([226, 214, 184]);
export const recordRgb = (rec) => (rec === CARVING_REC.gilt ? GILT_RGB : rec === CARVING_REC.oak ? OAK_RGB : rec === CARVING_REC.pitch ? PITCH_RGB
  : rec === CARVING_REC.ivory ? IVORY_RGB : SHIP_PAINTS[rec]?.rgb ?? GILT_RGB);

/** Beaten gilt: warm, a hammered light across it. */
function giltArt(seed = 0x9117) {
  const S = CARVING_ART_SIZE, img = image(S), n = noiseField(seed, 5, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, mix([150, 106, 30], [252, 214, 118], 0.25 + 0.7 * n(x, y)));
  return img;
}
/** Carved wood under a paint: the paint at the grain's light, a worn fleck of the wood showing here and there. */
function paintedArt(rgb, seed) {
  const S = CARVING_ART_SIZE, img = image(S), g = noiseField(seed, 3, S, S, 12), r = rng(seed + 1);
  const dark = rgb.map((v) => v * 0.72), light = rgb.map((v) => Math.min(255, v * 1.12 + 6));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, r() < 0.012 ? mix(OAK_RGB, rgb, 0.4) : mix(dark, light, 0.2 + 0.75 * g(x, y)));
  return img;
}
/** The bracket's oak: grain along u, a darker check now and then. */
function oakArt(seed = 0x0a6) {
  const S = CARVING_ART_SIZE, img = image(S), g = noiseField(seed, 2, S, S, 14), r = rng(seed + 1);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, r() < 0.006 ? [40, 26, 14] : mix([80, 52, 28], [146, 104, 62], 0.2 + 0.7 * g(x, y)));
  return img;
}
/** A flat material with a little noise in it (pitch, ivory). */
function flatArt(rgb, seed, spread) {
  const S = CARVING_ART_SIZE, img = image(S), n = noiseField(seed, 4, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(img, x, y, rgb.map((v) => Math.max(0, Math.min(255, Math.round(v + (n(x, y) - 0.5) * spread)))));
  return img;
}

/** Every picture of the archive, by record - `[[record, picture], ...]`, the same on every machine. */
export function carvingArt() {
  /** @type {[number, { width: number, height: number, colors: Uint8Array }][]} */
  const out = [[CARVING_REC.gilt, giltArt()]];
  for (let i = 1; i <= PAINT_MAX; i++) out.push([i, paintedArt(SHIP_PAINTS[i].rgb, 0xf1600 + i * 97)]);
  out.push([CARVING_REC.oak, oakArt()], [CARVING_REC.pitch, flatArt(PITCH_RGB, 0x717c, 14)], [CARVING_REC.ivory, flatArt(IVORY_RGB, 0x1704, 22)]);
  return out;
}
