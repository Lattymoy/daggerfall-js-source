// City light collection: one point light per archive-210 flat. 1:1 with
// Daggerfall Unity's RMBLayout AddLights/AddLight and the exterior-subrecord
// light path (MIT, Daggerfall Workshop). Verbatim:
//   - Misc block flats with archive 210: light at
//     (XPos, -YPos + nativeSize.y, ZPos + 4096) * GlobalScale. DFU's
//     GetScaledBillboardSize returns NATIVE units (MeshReader.cs:549-568 -
//     cm.recordSizes is raw texture pixels, no GlobalScale), so the offset is
//     added INSIDE the scaled vector; our getScaledSize returns WORLD units
//     (the contract DaggerfallInterior.cs:939 relies on), so we add it AFTER
//     the multiply, which is the same number.
//     Note the light Y differs from the billboard Y (blockFlatsOffsetY -6).
//   - Exterior subrecord flats with archive 210: same formula plus the
//     unrotated (subX, 0, -subZ) * scale offset. Original archive is checked
//     (210 is excluded from climate swaps).
// Light properties come from the DaggerfallLight [City] prefab: point light,
// range 18, intensity 1, color white. The prefab's night-only enable and
// Animate flicker belong to the day/night cycle; our scenes gate lights on
// the night window style as the documented equivalence.

import { RMB_DIMENSION } from '../formats/blocksFile.js';
import { GLOBAL_SCALE } from './meshReader.js';

export const LIGHTS_ARCHIVE = 210;
export const CITY_LIGHT_RANGE = 18;
/**
 * LA-LIGHTS2 (2026-09-27, Mac: "look for flickering issues"): THE CAP FADES, IT DOES NOT CUT. The lane lights the
 * nearest EL_MAX_LIGHTS (48) of a town's lanterns, and a town at night holds more (the probe's night street: all 48
 * taken, every frame). Each step the player took changed which lanterns made the cut, and the one that left went dark
 * at once wherever it lit - a pool of light on a far street switching off, another switching on. A lantern's share of
 * its light now falls to nothing over the last LIGHT_CAP_FADE units before the first lantern the cap leaves out, so
 * the one that leaves the set leaves it dark and the one that joins joins dark. The hand's lights (the torch, the
 * candle, a peer's) are never faded; a set the cap does not cut fades nothing.
 */
export const LIGHT_CAP_FADE = 16;
/** LA-LIGHTS2: the colours `renderer.setPointLights` takes for `lit` - the composed array, the hand's `lead` lights
 *  first and then the lanterns nearest first, one or more past the renderer's `cap` - seen from `pos`: `color` for the
 *  hand's, each kept lantern's `color` times its share, or null when the cap leaves nothing out. */
export function capFadeColors(lit, lead, pos, cap, color, fade = LIGHT_CAP_FADE) {
  return capFade(lit, lead, pos, cap, color, 0, fade);
}
/** LA-AUDIT A5 (2026-09-27, the audit before LA's merge; lens A measured it): THE DUNGEON'S CAP FADES TOO. A level
 *  holds more torches than the lane's 48 (Scourg Barrow's cap cut at 128 of 297 in range, Privateer's Hold at 38 of
 *  71), and each one the walk brought in popped on at full strength - 138 joins in a 20-second walk, the first left out
 *  34 to 72 units off. capFadeColors for a set whose lights carry their OWN colours (the world host's dungeon pairs:
 *  the candle's white, a camp's fire, the torches' flame): each kept light's colour times its share. */
export function capFadePairs(lit, lead, pos, cap, colors, fade = LIGHT_CAP_FADE) {
  return capFade(lit, lead, pos, cap, colors, 3, fade);
}
/** The two above: `color` one vec3 (`stride` 0) or one per light (`stride` 3). */
function capFade(lit, lead, pos, cap, color, stride, fade) {
  const count = lit.length >> 2;
  if (count <= cap || lead >= cap) return null;
  const dist = (i) => Math.hypot(lit[i * 4] - pos[0], lit[i * 4 + 1] - pos[1], lit[i * 4 + 2] - pos[2]);
  const cut = dist(cap);   // the first light the cap leaves out
  const out = new Float32Array(cap * 3);
  for (let i = 0; i < cap; i++) {
    const share = i < lead ? 1 : Math.max(0, Math.min(1, (cut - dist(i)) / fade));
    const c = i * stride;
    out[i * 3] = color[c] * share; out[i * 3 + 1] = color[c + 1] * share; out[i * 3 + 2] = color[c + 2] * share;
  }
  return out;
}
/** LA-LIGHTS1 (2026-09-27): the CityLightAnimator slot a pixel's FIRST lantern flickers on (its j-th: this plus j,
 *  modulo the animator's length) - named by the pixel, so each lantern keeps its own flicker whatever else is built
 *  around it (world.js refills its pool in `built`'s order, which a stream-out reshuffles). */
export const lanternSlot = (px, py) => (Math.imul(px | 0, 73856093) ^ Math.imul(py | 0, 19349663)) >>> 0;
/** LA-AUDIT F2 (2026-09-27; lens F found the fill unpinned - LA-LIGHTS1's test ran its own copy): THE STREET'S LANTERN
 *  POOL, REFILLED (world.js's PERF-LIGHTS pool). Each built pixel's lanterns go into `pool` from 0 under the pixel's
 *  live translation, and each takes the range of its own animator slot - its pixel's lanternSlot plus its place in the
 *  pixel's list (LA-LIGHTS1). `ranges` grows with the pool (a town holds more than its first 64), and is handed back.
 *  @param {Iterable<{ px: number, py: number, lights: ArrayLike<ArrayLike<number>> }>} pixels
 *  @param {(p: any) => ArrayLike<number>} translate the pixel's live translation
 *  @param {Array<{ x: number, y: number, z: number }>} pool
 *  @param {Float32Array} ranges
 *  @param {ArrayLike<number>} animRanges the animator's live ranges
 *  @returns {{ n: number, ranges: Float32Array }} */
export function fillLanternPool(pixels, translate, pool, ranges, animRanges) {
  let n = 0;
  for (const p of pixels) {
    if (!p.lights.length) continue;
    const t = translate(p);
    ranges = rangesFor(ranges, n + p.lights.length);
    const slot0 = lanternSlot(p.px, p.py);
    for (let j = 0; j < p.lights.length; j++) {
      const l = p.lights[j];
      const e = pool[n] ?? (pool[n] = { x: 0, y: 0, z: 0 });
      e.x = l[0] + t[0]; e.y = l[1] + t[1]; e.z = l[2] + t[2];
      ranges[n] = animRanges[(slot0 + j) % animRanges.length];
      n++;
    }
  }
  return { n, ranges };
}
/** A range array with room for `n`, keeping what is in it (the same one when it has room). */
export function rangesFor(ranges, n) {
  if (ranges.length >= n) return ranges;
  const g = new Float32Array(Math.max(n, ranges.length * 2));
  g.set(ranges);
  return g;
}
export const CITY_LIGHT_INTENSITY = 1;
export const CITY_LIGHT_COLOR = Object.freeze([1, 1, 1]);

/**
 * Collect point-light positions for one RMB block.
 * @param {object} dfBlock - BlocksFile.getBlock output (type Rmb).
 * @param {(record:number) => {w:number,h:number}} getScaledSize -
 *   scaledBillboardSize for archive 210 records.
 * @returns {Array<{record:number,x:number,y:number,z:number,foot:number,w:number,h:number}>}
 */
export function collectCityLights(dfBlock, getScaledSize) {
  const rmb = dfBlock.rmbBlock;
  const lights = [];

  // Misc block flats (AddLights -> AddLight).
  for (const obj of rmb.miscFlatObjectRecords) {
    if (obj.textureArchive !== LIGHTS_ARCHIVE) continue;
    const size = getScaledSize(obj.textureRecord);
    lights.push({
      // HEARTH1: the RECORD rides along. A lantern and a brazier are the
      // same point light to this collector and NOT the same thing to the
      // survival law (survival/hearth.js), and this is the one walk of
      // the block that knows which is which - collecting the flats a
      // second time to ask again would be the same walk for the same
      // answer.
      record: obj.textureRecord,
      x: obj.xPos * GLOBAL_SCALE,
      y: -obj.yPos * GLOBAL_SCALE + size.h,
      z: (obj.zPos + RMB_DIMENSION) * GLOBAL_SCALE,
      // FIX-D: and the SPRITE the light sits on top of - its base and
      // its size - so a brazier's eye box is the brazier (survival/
      // hearth.js hearthAabb) rather than a guess hung off the flame.
      foot: -obj.yPos * GLOBAL_SCALE, w: size.w, h: size.h,
    });
  }

  // Exterior subrecord flats: unrotated subrecord offset, verbatim.
  for (const subRecord of rmb.subRecords) {
    const subX = subRecord.xPos * GLOBAL_SCALE;
    const subZ = -subRecord.zPos * GLOBAL_SCALE;
    for (const obj of subRecord.exterior.blockFlatObjectRecords) {
      if (obj.textureArchive !== LIGHTS_ARCHIVE) continue;
      const size = getScaledSize(obj.textureRecord);
      lights.push({
        record: obj.textureRecord,   // HEARTH1
        x: obj.xPos * GLOBAL_SCALE + subX,
        y: -obj.yPos * GLOBAL_SCALE + size.h,
        z: (obj.zPos + RMB_DIMENSION) * GLOBAL_SCALE + subZ,
        foot: -obj.yPos * GLOBAL_SCALE, w: size.w, h: size.h,   // FIX-D
      });
    }
  }

  return lights;
}

/**
 * Pick the nearest `max` lights to a position; returns flat vec4 data
 * [x, y, z, range] ready for the renderer.
 *
 * LT1: pass `colorOf` - `(light, index) => [r, g, b]`, the light's
 * colour x intensity - and the return becomes `{ data, colors }`:
 * `colors` is the flat vec3 array in the SAME pick order as `data`,
 * from the ONE sort (a second sort could diverge on distance ties).
 * Without it the return is the bare vec4 array, unchanged - the
 * exterior lantern callers.
 */
/** EV2: the selection scratch. The old body allocated one {l, index,
 *  d} object PER LIGHT and full-sorted, every frame, in all four
 *  hosts. A bounded stable insertion into two module arrays keeps the
 *  exact same answer - `>` on the shift and strict `<` on admission
 *  reproduce a stable sort's tie order (earliest index wins, at the
 *  cut too) - with zero allocation until the small result arrays,
 *  which stay per-call because setPointLights holds the returned
 *  buffer across the frame's re-uploads. */
const _selD = [];
const _selIdx = [];

/** A10: `xzRange` is DungeonLightHandler's cut, handed in by the
 *  callers that have one (the dungeon hosts). It is a RANGE, not a
 *  count: a light farther than it on XZ is not a candidate at all,
 *  which is the reference's own per-light `myLight.enabled = false`
 *  (DungeonLightHandler.cs:60-74). 0 means "no cut" - every exterior
 *  and interior caller, unchanged. See dungeonLights.js for why the
 *  two rules compose in this order. */
export function nearestLights(lights, pos, max = 16, range = CITY_LIGHT_RANGE, colorOf = null, xzRange = 0, n = -1) {
  const perLight = typeof range !== 'number' ? range : null;
  const xz2 = xzRange > 0 ? xzRange * xzRange : 0;
  // PERF-LIGHTS (2026-09-19): how many of `lights` are live. The world
  // host refills a POOL of light objects rather than minting one per
  // lantern per frame (a town at night is hundreds of them, sixty times a
  // second, in a frame that is already script-bound), so its array is
  // longer than its contents. Default -1 keeps every other caller's
  // meaning exactly: the whole array.
  const len = n < 0 ? lights.length : Math.min(n, lights.length);
  let count = 0;
  for (let i = 0; i < len; i++) {
    const l = lights[i];
    const dx = l.x - pos[0];
    const dy = l.y - pos[1];
    const dz = l.z - pos[2];
    // The XZ block-range gate, BEFORE the nearest-N admission: DFU
    // compares XZ only ("dungeon blocks have no defined vertical
    // height", :62) and disables on strictly greater, so a light
    // exactly at the range stays lit.
    if (xz2 && dx * dx + dz * dz > xz2) continue;
    const d = dx * dx + dy * dy + dz * dz;
    if (count >= max && d >= _selD[count - 1]) continue;   // not admitted; ties keep the earlier light
    let j = count < max ? count++ : count - 1;
    while (j > 0 && _selD[j - 1] > d) { _selD[j] = _selD[j - 1]; _selIdx[j] = _selIdx[j - 1]; j--; }
    _selD[j] = d; _selIdx[j] = i;
  }
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const l = lights[_selIdx[i]];
    out[i * 4] = l.x;
    out[i * 4 + 1] = l.y;
    out[i * 4 + 2] = l.z;
    // AUDIT PERF-LIGHTS F2 (pre-existing, found by this audit): a
    // per-light range array SHORTER than the light list gives `undefined`
    // here, which lands in a Float32Array as NaN - and a NaN far plane
    // goes on to the point-shadow matrices and the shader's depth
    // reconstruction, where it fails silently and totally. The host sizes
    // its animator at 4096 lanterns and nothing checks the lights against
    // it; a big enough city at a long enough land view is a cliff with no
    // edge marked. The fallback is the module's own default range, which
    // is what an unanimated lantern is anyway.
    const w = perLight ? perLight[_selIdx[i]] : range;
    out[i * 4 + 3] = Number.isFinite(w) ? w : CITY_LIGHT_RANGE;
  }
  if (!colorOf) return out;
  // The colour arm rides the SAME selection - the one-sort law above
  // holds exactly as before: one ordering, two views of it.
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = colorOf(lights[_selIdx[i]], _selIdx[i]);
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
  }
  return { data: out, colors };
}
