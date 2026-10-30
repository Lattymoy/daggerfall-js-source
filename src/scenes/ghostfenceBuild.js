// @ts-check
// GHOSTFENCE (bible/03-World/Red-Mountain.md, The Ghostfence): the fence where it crosses a pixel, stood by the pixel
// build (scenes/pixelBuild.js) on the pixel's own ground - its pylons and Ghostgate in the pixel's batch, their orbs their
// own light, and the pylons, the gate's towers and the curtain between the pylons solid through the world's one gate
// (player/lateSolid.js) - no body passes the Ghostfence but by Ghostgate. Each foot and curtain point is noted for the glow.
import {
  ghostfenceFrame,
  ghostfencePylonsIn,
  ghostfenceRunCuts,
  ghostfenceCurtainPoint,
  sampleToPixel,
  CURTAIN_STEPS,
  ghostfenceNear,
  ghostfenceBeside,
} from '../world/tamriel/ghostfence.js';
import { redMountainLavaBed, redMountainLavaIn } from '../world/tamriel/redMountain.js'; // LAVA-CLEAR: nothing stood in the lava
import { landMeasures, LAND_PROP_FLOATS } from '../world/lands/landProps.js';
import { LAND_KINDS } from '../world/lands/landPropMesh.js';
import {
  pylonModel,
  pylonSolid,
  pylonFooting,
  ghostgateModel,
  ghostgateSolid,
  ghostfencePictures,
  GHOSTFENCE_ARCHIVE,
  GF_RECORD,
  PYLON,
  CURTAIN,
  GHOSTGATE,
} from '../world/tamriel/ghostfenceModel.js';
import { surfaceHeightAt, lowestGroundUnder } from '../world/terrain/terrainSurface.js';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';
import { BAY_H } from '../world/tamriel/tamrielFrame.js';
import { toColor32 } from '../formats/color32Order.js';
import { dfLook, lookSeed } from '../world/dfLook.js';
import { noteFenceFeet } from '../render/ghostfenceGlow.js';

const SAMPLE_M = TERRAIN_SIZE / 128;
/** How high the curtain's solid stands over its ground: to the pylons' collars. */
export const CURTAIN_SOLID_TOP = PYLON.collar.to + PYLON.collar.rim;
/** How far a pylon's centre stands over the lowest ground under its plinth before it is given a footing (metres). */
const FOOTING_FROM = 0.5;

/** The lowest and highest walk ground (`samples`, the pixel's) on the pixel-local segment (ax, az)-(bx, bz) - at its ends
 *  and every crossing of the ground's cells and their diagonals, where the triangles' plane turns: exact. */
export function groundAlong(samples, ax, az, bx, bz) {
  const cell = TERRAIN_SIZE / 128,
    dx = bx - ax,
    dz = bz - az,
    ts = [0, 1];
  const cross = (a, d) => {
    if (Math.abs(d) < 1e-12) return;
    const lo = Math.min(a, a + d),
      hi = Math.max(a, a + d);
    for (let k = Math.ceil(lo / cell); k * cell <= hi; k++) {
      const t = (k * cell - a) / d;
      if (t > 0 && t < 1) ts.push(t);
    }
  };
  cross(ax, dx);
  cross(az, dz);
  cross(az - ax, dz - dx);
  let lo = Infinity,
    hi = -Infinity;
  for (const t of ts) {
    const y = surfaceHeightAt(
      samples,
      Math.max(0, Math.min(TERRAIN_SIZE, ax + dx * t)),
      Math.max(0, Math.min(TERRAIN_SIZE, az + dz * t)),
    );
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return [lo, hi];
}

/** FENCE-CLEAR: how far off the fence's line a flat, and a landmark past its own reach, keeps (metres): Ghostgate's
 *  half-depth and 2 m. */
export const FENCE_CLEAR = GHOSTGATE.depth + 2;

/**
 * LAVA-CLEAR, FENCE-CLEAR (the fold of TESA-LANDS: its landmarks and every flat stood in the lava, 449 spires and 9,887
 * flats on the freeware's ground): what Bay pixel (px, py)'s build keeps its flats and landmarks off - the lava's beds
 * and the fence's line - as `(x, z, reach) => true to drop it`, pixel-local metres; null where neither comes.
 */
export function fireClearing(px, py) {
  const lava = redMountainLavaIn(px, py),
    fence = ghostfenceBeside(px, py);
  if (!lava && !fence) return null;
  const ox = px * 128,
    oy = (BAY_H - py) * 128;
  return (x, z, reach = 0) => {
    const gx = ox + x / SAMPLE_M,
      gy = oy + z / SAMPLE_M;
    return (lava && redMountainLavaBed(gx, gy)) || (fence && ghostfenceNear(gx, gy, FENCE_CLEAR + reach));
  };
}
/** A pixel's landmarks (LAND_PROP_FLOATS each, world/lands/landProps.js) less those `clear` drops, each by its own reach. */
export function clearedLandProps(clear, raw) {
  const kept = [];
  for (let i = 0; i < raw.length; i += LAND_PROP_FLOATS) {
    const reach = landMeasures(LAND_KINDS[raw[i + 5]], raw[i + 6]).reach * raw[i + 4];
    if (!clear(raw[i], raw[i + 2], reach)) for (let k = 0; k < LAND_PROP_FLOATS; k++) kept.push(raw[i + k]);
  }
  return Float32Array.from(kept);
}

let _pics = null;
/** The fence's pictures up under GHOSTFENCE_ARCHIVE - asked by every build that stands it (the place it stands holds
 *  them), the stone in Daggerfall's own colours (world/dfLook.js), the orb its own light. */
function upload(renderer) {
  if (!renderer?.uploadTexture) return;
  if (!_pics) {
    const p = ghostfencePictures();
    _pics = { stone: toColor32(dfLook(p.stone, lookSeed(GHOSTFENCE_ARCHIVE, GF_RECORD.stone))), orb: toColor32(p.orb) };
  }
  renderer.uploadTexture(GHOSTFENCE_ARCHIVE, GF_RECORD.stone, _pics.stone);
  renderer.uploadTexture(GHOSTFENCE_ARCHIVE, GF_RECORD.orb, _pics.orb);
  renderer.uploadEmissionTexture?.(GHOSTFENCE_ARCHIVE, GF_RECORD.orb, _pics.orb, { white: true });
}

/** A foot's matrix: at pixel-local (x, y, z), its x along the fence's tangent (tx, tz), its z in toward the mountain. */
export const footMatrix = (x, y, z, tx, tz) => new Float32Array([tx, 0, tz, 0, 0, 1, 0, 0, -tz, 0, tx, 0, x, y, z, 1]);

/** The pixel-local box a footprint of half-widths (along, across) covers about (x, z) turned to (tx, tz). */
function footprint(x, z, tx, tz, along, across) {
  const ex = Math.abs(tx) * along + Math.abs(tz) * across,
    ez = Math.abs(tz) * along + Math.abs(tx) * across;
  return [x - ex, 0, z - ez, x + ex, 0, z + ez];
}

/**
 * STAND THE FENCE in Bay pixel (px, py): each pylon whose foot is in it on the ground at its centre, a footing to the
 * lowest under its plinth (Ghostgate on the lowest under its own), in the batch and solid with the pixel's `translation`;
 * and each piece of the curtain's solid whose middle is in it, under its lowest ground to the collars over its highest,
 * one solid a run. Answers how many pylons. @param {{ px: number, py: number, pkey: string, key: string, samples: Float32Array, renderer: any,
 *   addStatic: (cpu: any, local: Float32Array, own: boolean) => void, unionBox: (b: number[]) => void,
 *   late: { add: Function }, translation: any }} o
 */
export function standGhostfence({ px, py, pkey, key, samples, renderer, addStatic, unionBox, late, translation }) {
  const f = ghostfenceFrame(),
    here = f ? ghostfencePylonsIn(px, py) : [],
    runs = f?.runsBy.get(`${px},${py}`) ?? [];
  if (!f || (!here.length && !runs.length)) return 0;
  upload(renderer);
  const ox = px * 128,
    oy = (BAY_H - py) * 128;
  const local = (gx, gy) => [(gx - ox) * SAMPLE_M, (gy - oy) * SAMPLE_M];
  const groundAt = (x, z) =>
    surfaceHeightAt(samples, Math.max(0, Math.min(TERRAIN_SIZE, x)), Math.max(0, Math.min(TERRAIN_SIZE, z)));
  const seats = [],
    points = [],
    heights = [];
  const stand = (cpu, solid, m) => {
    addStatic(cpu, m, true);
    unionBox(transformedAabb(localAabb(cpu.positions), m));
    late.add(key, solid.positions, solid.indices, m, { translation });
  };
  for (const i of here) {
    const [x, z] = local(f.pts[2 * i], f.pts[2 * i + 1]),
      tx = f.tan[2 * i],
      tz = f.tan[2 * i + 1];
    if (i === f.gate) {
      const y = lowestGroundUnder(samples, footprint(x, z, tx, tz, GHOSTGATE.half, GHOSTGATE.depth));
      seats.push(y);
      stand(ghostgateModel(), ghostgateSolid(), footMatrix(x, y, z, tx, tz));
      continue;
    }
    const y = groundAt(x, z),
      low = lowestGroundUnder(samples, footprint(x, z, tx, tz, PYLON.plinth[0], PYLON.plinth[0]));
    seats.push(y);
    const m = footMatrix(x, y, z, tx, tz);
    stand(pylonModel(), pylonSolid(), m);
    if (y - low > FOOTING_FROM) {
      const foot = pylonFooting(y - low);
      stand(foot.model, foot.solid, m);
    }
  }
  for (const i of runs) {
    // the solid: this pixel's pieces of the run (by their middles), each from under its lowest ground to over its highest
    const cuts = ghostfenceRunCuts(f, i),
      quads = [];
    for (let c = 0; c + 3 < cuts.length; c += 2) {
      const [mx, my] = sampleToPixel((cuts[c] + cuts[c + 2]) / 2, (cuts[c + 1] + cuts[c + 3]) / 2);
      if (mx !== px || my !== py) continue;
      const [ax, az] = local(cuts[c], cuts[c + 1]),
        [bx, bz] = local(cuts[c + 2], cuts[c + 3]),
        [lo, hi] = groundAlong(samples, ax, az, bx, bz);
      quads.push(
        ax,
        lo + CURTAIN.from,
        az,
        bx,
        lo + CURTAIN.from,
        bz,
        bx,
        hi + CURTAIN_SOLID_TOP,
        bz,
        ax,
        hi + CURTAIN_SOLID_TOP,
        az,
      );
    }
    if (quads.length) {
      const q = quads.length / 12,
        indices = new Uint32Array(q * 6);
      for (let k = 0; k < q; k++) indices.set([4 * k, 4 * k + 1, 4 * k + 2, 4 * k, 4 * k + 2, 4 * k + 3], 6 * k);
      late.add(key, new Float32Array(quads), indices, IDENTITY, { translation });
    }
    // the glow's curtain points in this pixel, on its ground
    for (let k = 0; k <= CURTAIN_STEPS; k++) {
      const [gx, gy] = ghostfenceCurtainPoint(f, i, k),
        [qx, qy] = sampleToPixel(gx, gy);
      if (qx !== px || qy !== py) continue;
      const [x, z] = local(gx, gy);
      points.push(i * (CURTAIN_STEPS + 1) + k);
      heights.push(groundAt(x, z));
    }
  }
  noteFenceFeet(pkey, {
    frame: f,
    idx: here.slice(),
    seats: Float32Array.from(seats),
    points,
    heights: Float32Array.from(heights),
  });
  return here.length;
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
