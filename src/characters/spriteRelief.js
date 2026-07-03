// Sprite reliefs in classic canvas space (Characters C6 redesign).
// THE BODY AND THE PIECES ARE THE SAME CONSTRUCTION: every classic
// paperdoll image (BODY*.IMG, item TEXTURE records) blits at its own
// screen offset into one 320x200 canvas - so every image becomes a
// front relief IN THAT SHARED SPACE and seating is arithmetic on the
// classic offsets. Nothing is fitted, tuned, or invented.
//   - Exact-x construction: each opaque pixel is one quad whose x/y
//     span IS the canvas pixel (orthographic front view = identity),
//     so the front projection reproduces the sprite pixel-for-pixel
//     and the witness needs no geometry recovery.
//   - Depth: per row, each opaque RUN bulges forward on a half-ellipse
//     (z at a corner = depth * sqrt(rw^2 - dx^2), corners shared ->
//     watertight front surface). ONE documented assumption: the
//     front-view art carries no depth; DEPTH_RATIO covers it.
//   - Colors ride as RAW palette indices (dye bands intact).
// Output space: x right, y UP (canvas bottom = 0), z toward viewer;
// units are CANVAS PIXELS - the consumer applies one uniform scale.

export const DEPTH_RATIO = 0.9;

/**
 * Euclidean-ish distance field to the nearest TRANSPARENT pixel (two-
 * pass chamfer, 3-4 metric / 3). The inflation z = depth * sqrt(dt)
 * rounds the whole form smoothly - one field over the image, so
 * vertically adjacent rows share their bulge (the per-run ellipses
 * ridged row-by-row; this is the root fix). Corner z averages the 4
 * touching pixels' field values -> shared corners, watertight.
 */
export function distanceField(bmp) {
  const { width: W, height: H, data } = bmp;
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = data[i] === 0 ? 0 : INF;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : d[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (d[i] === 0) continue;
    d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 4 / 3, at(x + 1, y - 1) + 4 / 3);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (d[i] === 0) continue;
    d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 4 / 3, at(x - 1, y + 1) + 4 / 3);
  }
  return d;
}

/**
 * @param bmp {{width,height,data:Uint8Array}} indexed sprite (0 clear)
 * @param opts {{offsetX?:number, offsetY?:number, canvasH?:number,
 *   depth?:number, zBias?:number, back?:boolean, field?:Float32Array,
 *   colorBmp?:{data:Uint8Array}}}
 *   back: negate z (rear shell); field: share a mask's field so front
 *   and back meet at zero on the same silhouette; colorBmp: take
 *   palette indices from a different image over the same mask (the
 *   invented back detail rides the FRONT's geometry mask).
 * @returns faces [{p, n, idx, px, py}] px/py in SPRITE coords.
 */
export function reliefFromSprite(bmp, opts = {}) {
  const { width: W, height: H, data } = bmp;
  const offsetX = opts.offsetX ?? 0;
  const offsetY = opts.offsetY ?? 0;
  const canvasH = opts.canvasH ?? 200;
  const depth = opts.depth ?? DEPTH_RATIO;
  const zBias = opts.zBias ?? 0;
  const sign = opts.back ? -1 : 1;
  const field = opts.field ?? distanceField(bmp);
  const colors = opts.colorBmp?.data ?? data;

  const fAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : field[y * W + x];
  // Corner z: mean of the 4 touching pixels' field values.
  const zCorner = (cx, cy) => {
    const v = (fAt(cx - 1, cy - 1) + fAt(cx, cy - 1) + fAt(cx - 1, cy) + fAt(cx, cy)) / 4;
    return sign * (depth * Math.sqrt(v) + zBias);
  };

  const faces = [];
  for (let py = 0; py < H; py++) {
    const yTop = canvasH - (offsetY + py);
    const yBottom = yTop - 1;
    for (let px = 0; px < W; px++) {
      if (data[py * W + px] === 0) continue;
      const idx = colors[py * W + px] || data[py * W + px];
      const xa = offsetX + px;
      const xb = xa + 1;
      const z00 = zCorner(px, py + 1);      // bottom-left
      const z10 = zCorner(px + 1, py + 1);  // bottom-right
      const z11 = zCorner(px + 1, py);      // top-right
      const z01 = zCorner(px, py);          // top-left
      const a = [xa, yBottom, z00];
      const b = [xb, yBottom, z10];
      const cq = [xb, yTop, z11];
      const dd = [xa, yTop, z01];
      // Normal from the two quad diagonals (real surface slope).
      const e1 = [cq[0] - a[0], cq[1] - a[1], cq[2] - a[2]];
      const e2 = [dd[0] - b[0], dd[1] - b[1], dd[2] - b[2]];
      let nx = e1[1] * e2[2] - e1[2] * e2[1];
      let ny = e1[2] * e2[0] - e1[0] * e2[2];
      let nz = e1[0] * e2[1] - e1[1] * e2[0];
      if (nz * sign < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const nl = Math.hypot(nx, ny, nz) || 1;
      faces.push({
        p: [a[0], a[1], a[2], b[0], b[1], b[2], cq[0], cq[1], cq[2], dd[0], dd[1], dd[2]],
        n: [nx / nl, ny / nl, nz / nl],
        idx, px, py,
      });
    }
  }
  return faces;
}

/**
 * Identity witness: the exact-x construction means face min-corner
 * x/y ARE the canvas pixel - recover sprite px/py arithmetically and
 * rebuild the grid. No stored bookkeeping is consulted.
 */
export function projectRelief(faces, W, H, opts = {}) {
  const offsetX = opts.offsetX ?? 0;
  const offsetY = opts.offsetY ?? 0;
  const canvasH = opts.canvasH ?? 200;
  const grid = new Uint8Array(W * H);
  for (const f of faces) {
    const px = Math.round(Math.min(f.p[0], f.p[3])) - offsetX;
    const yTop = Math.max(f.p[1], f.p[7]);
    const py = canvasH - yTop - offsetY;
    if (px >= 0 && px < W && py >= 0 && py < H) grid[py * W + px] = f.idx;
  }
  return grid;
}
