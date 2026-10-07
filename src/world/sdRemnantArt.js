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
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { SD_ENDINGS } from '../net/sdMarks.js';

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
