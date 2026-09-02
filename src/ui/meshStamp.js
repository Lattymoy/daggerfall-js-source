// ROAD-C c2/S10: THE MESH STAMP - a pure top-down orthographic
// rasteriser, and the exterior automap's answer to DFU's two mesh
// GameObjects.
//
// WHY A BITMAP AND NOT A MESH PASS. DFU's town map is an ORTHOGRAPHIC
// camera looking straight down (Quaternion.Euler(90,0,0),
// ExteriorAutomap.cs:539-543) at four objects whose only depth is a
// PAINT ORDER - circle y=-20, stamp y=-10, layout quad y=+0.01, arrow
// y=+0.1. Under that lens the arrow and its stamp are literally a
// top-down silhouette of mesh 99900, drawn twice at two scales and two
// tints. Rasterising that silhouette ONCE and blitting it as a rotated
// screen quad is the same picture, and it keeps the map a CPU
// composition: the circle and the stamp then show THROUGH the layout's
// transparent street pixels, which an opaque mesh pass at those
// y-offsets would delete.
//
// THE OVERSAMPLING ARITHMETIC, so nobody has to guess. The render
// panel is 318x169 native px and spans 2*orthographicSize world units
// down its height. At MAX zoom (orthoSize 25, the near clamp) that is
// 169/50 = 3.38 px per unit, so the 2.5-unit arrow spans ~8.5 px and
// the 4.0-unit stamp ~13.5 px; at the native panel's usual 3x screen
// scale, ~25 and ~40 real px. A 128x128 stamp is therefore oversampled
// at every zoom the window can reach, and it keeps mesh 99900's TRUE
// silhouette rather than a stand-in triangle.
//
// COORDINATES. Input is CPU mesh data in the port's own world frame
// (x east, y up, z north - meshReader's dfMeshToModel output). The
// projection drops y and lands +z at the TOP of the bitmap, so the
// stamp is drawn "north up" and the window rotates it by the player's
// yaw and the map's together. Pure: no GL, no data files, no clock.

/** Packed ABGR opaque white - the silhouette colour. The window tints
 *  it at the draw (drawScreenQuad's uColor), so ONE bitmap serves both
 *  the bright arrow and the dark stamp. */
export const STAMP_INK = 0xffffffff;

/**
 * Rasterise a mesh's top-down silhouette into a square RGBA bitmap.
 *
 * @param {{positions: ArrayLike<number>, indices: ArrayLike<number>}} mesh
 * @param {number} size    edge length in pixels (128 is the window's)
 * @param {{ink?: number, pad?: number}} opts
 *   `pad` is the border left clear on each edge, in pixels, so a
 *   rotated blit never clips its own silhouette at the quad's corner.
 * @returns {{width:number, height:number, colors:Uint32Array,
 *   span:number, worldPerPx:number}} the uploadTexture color32 shape,
 *   transparent (0) where no triangle covers the pixel centre, plus
 *   the fitted XZ span and the world units ONE bitmap pixel covers -
 *   the caller needs those to size the quad at DFU's own localScale.
 *   `span` is 0 for a mesh that could not be rasterised at all.
 */
export function rasterizeTopDown(mesh, size = 128, { ink = STAMP_INK, pad = 1 } = {}) {
  const w = Math.max(1, Math.trunc(size));
  const colors = new Uint32Array(w * w);
  const empty = { width: w, height: w, colors, span: 0, worldPerPx: 0 };
  const pos = mesh?.positions ?? null;
  const idx = mesh?.indices ?? null;
  if (!pos || !idx || idx.length < 3) return empty;

  // fit the XZ bounds into the padded square, ONE uniform scale so the
  // silhouette keeps its proportions
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let v = 0; v < pos.length; v += 3) {
    if (pos[v] < minX) minX = pos[v];
    if (pos[v] > maxX) maxX = pos[v];
    if (pos[v + 2] < minZ) minZ = pos[v + 2];
    if (pos[v + 2] > maxZ) maxZ = pos[v + 2];
  }
  const spanX = maxX - minX, spanZ = maxZ - minZ;
  const span = Math.max(spanX, spanZ);
  if (!(span > 0)) return empty;
  const inner = w - 2 * pad;
  const k = inner / span;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  // x east -> +px, z north -> -py (the bitmap is drawn top-down)
  const toPx = (x) => w / 2 + (x - cx) * k;
  const toPy = (z) => w / 2 - (z - cz) * k;

  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ax = toPx(pos[a]), ay = toPy(pos[a + 2]);
    const bx = toPx(pos[b]), by = toPy(pos[b + 2]);
    const cxp = toPx(pos[c]), cy = toPy(pos[c + 2]);
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cxp - ax);
    if (area === 0) continue;   // edge-on from above: no silhouette
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cxp)));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cxp)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const y1 = Math.min(w - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let py = y0; py <= y1; py++) {
      const sy = py + 0.5;
      for (let px = x0; px <= x1; px++) {
        const sx = px + 0.5;
        // barycentric sign test, both windings accepted (a silhouette
        // has no facing - back faces are part of the outline too)
        const w0 = (bx - ax) * (sy - ay) - (by - ay) * (sx - ax);
        const w1 = (cxp - bx) * (sy - by) - (cy - by) * (sx - bx);
        const w2 = (ax - cxp) * (sy - cy) - (ay - cy) * (sx - cxp);
        const neg = w0 <= 0 && w1 <= 0 && w2 <= 0;
        const posi = w0 >= 0 && w1 >= 0 && w2 >= 0;
        if (neg || posi) colors[py * w + px] = ink;
      }
    }
  }
  return { width: w, height: w, colors, span, worldPerPx: 1 / k };
}

/**
 * A filled disc - DFU's player-marker CIRCLE is a Unity Cylinder
 * primitive at localScale (12,1,12) seen from directly above
 * (ExteriorAutomap.cs:1647), which is exactly a disc of diameter 12
 * world units. Same bitmap shape as the stamp so the window blits both
 * through one path.
 */
export function rasterizeDisc(size = 64, { ink = STAMP_INK } = {}) {
  const w = Math.max(1, Math.trunc(size));
  const colors = new Uint32Array(w * w);
  const r = w / 2, r2 = r * r;
  for (let y = 0; y < w; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - r, dy = y + 0.5 - r;
      if (dx * dx + dy * dy <= r2) colors[y * w + x] = ink;
    }
  }
  return { width: w, height: w, colors };
}
