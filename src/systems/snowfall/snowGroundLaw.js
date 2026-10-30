// SNOW-THREAD (2026-10-26): the ground the snow stands on, one law for two threads. The snow adapter (scenes/snowfallHost.js)
// answered the drawn ground's height, normal and bareness with closures over a built pixel entry `p`; the build worker
// reads the same ground off a snapshot of it, so the laws live here over the entry's fields: p.samples and p._stride (the
// drawn surface, terrainSurface.js), p.groundNormals, p._bed.depths (WATER-NEXT 2) and p.deepWaters (DW-B: the carved
// sea's floor, no snow on it). `floors` is the host's Deep Waters switch: off, a carved entry reads as the terrain's own.

import { drawnGroundAt, surfaceNormalAt, surfaceNormalFromSamples } from '../../world/terrain/terrainSurface.js';
import { carvedFloorLocalY } from '../../world/deepWater/deepWaterFloor.js';

/** The drawn ground's y in a pixel's frame. */
export function snowGroundHeight(p, floors, lx, lz) {
  if (floors && p.deepWaters) {
    // DW-B: the floor is drawn there
    const f = carvedFloorLocalY(p.deepWaters, lx, lz);
    if (f != null) return f;
  }
  return drawnGroundAt(p.samples, lx, lz, p._stride ?? 1, p._bed?.depths ?? null); // WATER-NEXT 2: and the bed carved under a shore - FLORA-GROUND: the ground the pixel draws, the plants' (terrainSurface.js drawnGroundAt)
}

/** The drawn ground's unit normal there, into `out`. */
export function snowGroundNormal(p, lx, lz, out) {
  const stride = p._stride ?? 1;
  return p.groundNormals && stride === 1
    ? surfaceNormalAt(p.groundNormals, lx, lz, out)
    : surfaceNormalFromSamples(p.samples, lx, lz, stride, out);
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
    groundNormals: stride === 1 ? (p.groundNormals ?? null) : null,
    _bed: p._bed?.depths ? { depths: p._bed.depths } : null,
    deepWaters: dw
      ? {
          holes: dw.holes ?? null,
          floor: floor
            ? { vertexLocalY: floor.vertexLocalY ?? null, floorQuadWater: floor.floorQuadWater ?? null }
            : null,
        }
      : null,
    floors: !!floors,
  };
}

/** The arrays a snapshot was taken from - a pixel's ground is the same ground while every one of them is. */
export function snowGroundSources(g) {
  return [
    g.samples,
    g.groundNormals,
    g._bed?.depths ?? null,
    g.deepWaters?.holes ?? null,
    g.deepWaters?.floor?.vertexLocalY ?? null,
    g.deepWaters?.floor?.floorQuadWater ?? null,
  ];
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
