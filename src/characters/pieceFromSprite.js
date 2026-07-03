// Sprite-derived paperdoll pieces (Characters C6b).
// THE 1:1 METHOD, no exceptions: the classic paperdoll sprite's pixels
// ARE the piece. Every opaque pixel becomes one face on a shell wrapped
// around the torso ellipse - column -> angle across the FRONT arc, row
// -> height, color -> the pixel's RAW PALETTE INDEX (not RGB), so the
// C5b band swap + ART_PAL resolve every material exactly as classic
// does. Nothing is invented: no back faces (the sprite shows a front),
// no redrawn details, no palette guesses. The front orthographic
// projection of the shell reproduces the sprite pixel-for-pixel BY
// CONSTRUCTION, and the parity test proves it.

/**
 * Build index-colored faces from a paperdoll bitmap.
 * @param bmp {{width,height,data:Uint8Array}} indexed sprite (0 = clear)
 * @param opts {{radiusX?:number, radiusZ?:number, height?:number,
 *   arc?:number}} shell ellipse half-extents, world height of the
 *   sprite span, and the front arc the columns cover (radians).
 * @returns faces [{p, n, idx, px, py}] - idx is the palette index;
 *   px/py the source pixel (the parity witness).
 */
export function shellFromSprite(bmp, opts = {}) {
  const { width: W, height: H, data } = bmp;
  const radiusX = opts.radiusX ?? 0.34;
  const radiusZ = opts.radiusZ ?? 0.22;
  const height = opts.height ?? 0.9;
  const arc = opts.arc ?? Math.PI * 0.9;

  const faces = [];
  const cellH = height / H;
  const theta = (x) => -arc / 2 + (arc * x) / (W - 1);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const idx = data[py * W + px];
      if (idx === 0) continue;
      // Column centre + half-step angles bound the cell on the ellipse.
      const t0 = theta(px - 0.5);
      const t1 = theta(px + 0.5);
      const y1 = height / 2 - py * cellH;       // sprite row 0 = top
      const y0 = y1 - cellH;
      const P = (t, y) => [radiusX * Math.sin(t), y, radiusZ * Math.cos(t)];
      const a = P(t0, y0);
      const b = P(t1, y0);
      const c = P(t1, y1);
      const d = P(t0, y1);
      const tm = (t0 + t1) / 2;
      const n = norm3(radiusZ * Math.sin(tm), 0, radiusX * Math.cos(tm));
      faces.push({
        p: [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]],
        n, idx, px, py,
      });
    }
  }
  return faces;
}

function norm3(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** Resolve index faces to RGB via the classic dye path. */
export function resolvePiece(faces, dye, target, palette, applyDyeToIndex) {
  return faces.map((f) => {
    const c = palette.get(applyDyeToIndex(f.idx, dye, target));
    return { p: f.p, n: f.n, c: [c.r, c.g, c.b] };
  });
}

/**
 * The 1:1 witness: recover each face's source pixel FROM ITS GEOMETRY
 * (midpoint angle -> column, midpoint height -> row) and rebuild the
 * W x H index grid. Equality with the source sprite proves the shell
 * mapping round-trips - stored px/py are deliberately unused here.
 */
export function projectFront(faces, W, H, opts = {}) {
  const height = opts.height ?? 0.9;
  const arc = opts.arc ?? Math.PI * 0.9;
  const cellH = height / H;
  const grid = new Uint8Array(W * H);
  for (const f of faces) {
    // Face midpoint from the quad corners.
    let mx = 0, my = 0, mz = 0;
    for (let i = 0; i < 4; i++) { mx += f.p[i * 3]; my += f.p[i * 3 + 1]; mz += f.p[i * 3 + 2]; }
    mx /= 4; my /= 4; mz /= 4;
    const t = Math.atan2(mx / (opts.radiusX ?? 0.34), mz / (opts.radiusZ ?? 0.22));
    const px = Math.round(((t + arc / 2) * (W - 1)) / arc);
    const py = Math.round((height / 2 - my) / cellH - 0.5);
    if (px >= 0 && px < W && py >= 0 && py < H) grid[py * W + px] = f.idx;
  }
  return grid;
}
