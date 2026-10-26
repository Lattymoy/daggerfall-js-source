// SNOW-THREAD (2026-10-26): THE GROUND THE SNOW STANDS ON, ONE LAW FOR TWO THREADS. world.js's snow adapter (its
// SnowGround, scenes/snowfallHost.js) answered the drawn ground's height, normal and bareness with closures over a
// built pixel entry `p`, and put a scene point on its map pixel and in global metres through the streaming world's
// origin. The snow's build worker (snowBuildWorker.js) reads the very same ground off a snapshot of that entry, so the
// laws live here, over the entry's own fields, and both threads call them:
//
//   p.samples, p._stride        - the drawn surface (terrainSurface.js surfaceHeightAt) at its ring's stride
//   p.groundNormals             - the stride-1 grid's normals, while the grass keeps them (else from the samples)
//   p._bed.depths               - WATER-NEXT 2: the bed carved under a shore, off the drawn ground
//   p.deepWaters (holes, floor) - DW-B: the carved sea - its floor where it is drawn, and no snow on it
//
// `floors` is the host's Deep Waters switch (the mod on at the world's mount): off, a carved entry's ground is read as
// the terrain's own, as world.js always read it.

import { surfaceHeightAt, surfaceNormalAt, surfaceNormalFromSamples, gridValueAt } from '../../world/terrain/terrainSurface.js';
import { TERRAIN_SIZE } from '../../world/terrain/terrainSampler.js';
import { carvedFloorLocalY } from '../../world/deepWater/deepWaterFloor.js';

const TILE_SIDE = TERRAIN_SIZE / 128;

/** The drawn ground's y in a pixel's frame. */
export function snowGroundHeight(p, floors, lx, lz) {
  if (floors && p.deepWaters) {   // DW-B: the floor is drawn there
    const f = carvedFloorLocalY(p.deepWaters, lx, lz);
    if (f != null) return f;
  }
  const stride = p._stride ?? 1;
  const h = surfaceHeightAt(p.samples, lx, lz, stride);
  const d = p._bed?.depths;
  const g = 128 / stride + 1;
  return d ? h - gridValueAt(d, g, g, TILE_SIDE * stride, lx, lz) : h;   // WATER-NEXT 2: and the bed carved under a shore
}

/** The drawn ground's unit normal there, into `out`. */
export function snowGroundNormal(p, lx, lz, out) {
  const stride = p._stride ?? 1;
  return p.groundNormals && stride === 1 ? surfaceNormalAt(p.groundNormals, lx, lz, out) : surfaceNormalFromSamples(p.samples, lx, lz, stride, out);
}

/** DW-B: the carved sea has no ground to lie on. */
export function snowGroundBare(p, lx, lz) {
  return !!p.deepWaters && carvedFloorLocalY(p.deepWaters, lx, lz) != null;
}

/**
 * What the three laws above read of an entry, and nothing else - the record the build worker is handed (copied once a
 * pixel's ground, never a frame: snowBuildClient.js). Each array is the entry's own here; the client copies it.
 */
export function snowGroundSnapshot(p, floors) {
  const stride = p._stride ?? 1;
  const dw = p.deepWaters;
  const floor = dw?.floor;
  return {
    samples: p.samples,
    _stride: stride,
    groundNormals: stride === 1 ? p.groundNormals ?? null : null,
    _bed: p._bed?.depths ? { depths: p._bed.depths } : null,
    deepWaters: dw ? { holes: dw.holes ?? null, floor: floor ? { vertexLocalY: floor.vertexLocalY ?? null, floorQuadWater: floor.floorQuadWater ?? null } : null } : null,
    floors: !!floors,
  };
}

/** The arrays a snapshot was taken from - a pixel's ground is the same ground while every one of them is. */
export function snowGroundSources(g) {
  return [g.samples, g.groundNormals, g._bed?.depths ?? null, g.deepWaters?.holes ?? null, g.deepWaters?.floor?.vertexLocalY ?? null, g.deepWaters?.floor?.floorQuadWater ?? null];
}

// ---- the streaming world's frame: `mx`, `my` its map origin, `cx`, `cz` its compensation, `size` a pixel's side ----
/** The map pixel column under a scene x. */
export const snowPixelX = (mx, cx, size, x) => mx + Math.floor((x - cx) / size);
/** The map pixel row under a scene z (rows run north to south). */
export const snowPixelY = (my, cz, size, z) => my - Math.floor((z - cz) / size);
/** A scene point in global metres (WorldX / SceneMapRatio), into `out`. */
export function snowGlobalOf(mx, my, cx, cz, size, x, z, out) {
  out[0] = mx * size + (x - cx);
  out[1] = (499 - my) * size + (z - cz);
  return out;
}
