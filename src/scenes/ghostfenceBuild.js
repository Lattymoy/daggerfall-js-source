// @ts-check
// GHOSTFENCE (bible/03-World/Red-Mountain.md, The Ghostfence): the fence where it crosses a pixel, stood by the pixel
// build (scenes/pixelBuild.js) on the pixel's own ground - its pylons and Ghostgate in the pixel's batch, their orbs their
// own light, and the pylons, the gate's towers and the curtain between the pylons solid through the world's one gate
// (player/lateSolid.js) - no body passes the Ghostfence but by Ghostgate. Each foot is noted for the far views' glow.
import { ghostfenceFrame, ghostfencePylonsIn, ghostfencePanel } from '../world/tamriel/ghostfence.js';
import { pylonModel, pylonSolid, ghostgateModel, ghostgateSolid, ghostfencePictures, GHOSTFENCE_ARCHIVE, GF_RECORD, PYLON, CURTAIN, GHOSTGATE } from '../world/tamriel/ghostfenceModel.js';
import { surfaceHeightAt, lowestGroundUnder } from '../world/terrain/terrainSurface.js';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { TERRAIN_SIZE } from '../world/terrain/terrainSampler.js';
import { BAY_H } from '../world/tamriel/tamrielFrame.js';
import { toColor32 } from '../formats/color32Order.js';
import { dfLook, lookSeed } from '../world/dfLook.js';
import { noteFenceFeet } from '../render/ghostfenceGlow.js';

const SAMPLE_M = TERRAIN_SIZE / 128;
/** How high the curtain's solid stands over its feet: to the pylons' collars. */
export const CURTAIN_SOLID_TOP = PYLON.collar.to + PYLON.collar.rim;

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
  const ex = Math.abs(tx) * along + Math.abs(tz) * across, ez = Math.abs(tz) * along + Math.abs(tx) * across;
  return [x - ex, 0, z - ez, x + ex, 0, z + ez];
}

/**
 * STAND THE FENCE in Bay pixel (px, py) where it crosses it: each pylon whose foot is in it (Ghostgate in its place) on
 * the lowest ground under its plinth (`samples`, the pixel's), in the batch on its own pictures and solid with the
 * pixel's `translation`; the curtain to the next pylon solid from under the ground to the collars. Answers how many.
 * @param {{ px: number, py: number, pkey: string, key: string, samples: Float32Array, renderer: any,
 *   addStatic: (cpu: any, local: Float32Array, own: boolean) => void, unionBox: (b: number[]) => void,
 *   late: { add: Function }, translation: any }} o
 */
export function standGhostfence({ px, py, pkey, key, samples, renderer, addStatic, unionBox, late, translation }) {
  const f = ghostfenceFrame(), here = f ? ghostfencePylonsIn(px, py) : [];
  if (!f || !here.length) return 0;
  upload(renderer);
  const ox = px * 128, oy = (BAY_H - py) * 128;
  const local = (gx, gy) => [(gx - ox) * SAMPLE_M, (gy - oy) * SAMPLE_M];
  const seats = [], panels = [], panelIdx = [];
  const stand = (cpu, solid, m) => {
    addStatic(cpu, m, true);
    unionBox(transformedAabb(localAabb(cpu.positions), m));
    late.add(key, solid.positions, solid.indices, m, { translation });
  };
  for (const i of here) {
    const [x, z] = local(f.pts[2 * i], f.pts[2 * i + 1]), tx = f.tan[2 * i], tz = f.tan[2 * i + 1];
    const gate = i === f.gate;
    const box = gate ? footprint(x, z, tx, tz, GHOSTGATE.half, GHOSTGATE.depth) : footprint(x, z, tx, tz, PYLON.plinth[0], PYLON.plinth[0]);
    const y = lowestGroundUnder(samples, box);
    seats.push(y);
    const m = footMatrix(x, y, z, tx, tz);
    if (gate) stand(ghostgateModel(), ghostgateSolid(), m);
    else stand(pylonModel(), pylonSolid(), m);
    // the curtain from this foot to the next: its far end on this pixel's ground there (the next may be the neighbour's)
    const [[ax, ay], [bx, by]] = ghostfencePanel(f, i), [lax, laz] = local(ax, ay), [lbx, lbz] = local(bx, by);
    const ya = y, yb = surfaceHeightAt(samples, Math.max(0, Math.min(TERRAIN_SIZE, lbx)), Math.max(0, Math.min(TERRAIN_SIZE, lbz)));
    panels.push(lax, ya + CURTAIN.from, laz, lbx, yb + CURTAIN.from, lbz, lbx, yb + CURTAIN_SOLID_TOP, lbz, lax, ya + CURTAIN_SOLID_TOP, laz);
    panelIdx.push(i);
  }
  const quads = panelIdx.length, positions = new Float32Array(panels), indices = new Uint32Array(quads * 6);
  for (let q = 0; q < quads; q++) indices.set([4 * q, 4 * q + 1, 4 * q + 2, 4 * q, 4 * q + 2, 4 * q + 3], 6 * q);
  late.add(key, positions, indices, IDENTITY, { translation });
  noteFenceFeet(pkey, here.slice(), Float32Array.from(seats));
  return here.length;
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
