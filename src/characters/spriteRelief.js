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

export const DEPTH_RATIO = 0.55;

/**
 * @param bmp {{width,height,data:Uint8Array}} indexed sprite (0 clear)
 * @param opts {{offsetX?:number, offsetY?:number, canvasH?:number,
 *   depth?:number, zBias?:number}}
 * @returns faces [{p, n, idx, px, py}] px/py in SPRITE coords.
 */
export function reliefFromSprite(bmp, opts = {}) {
  const { width: W, height: H, data } = bmp;
  const offsetX = opts.offsetX ?? 0;
  const offsetY = opts.offsetY ?? 0;
  const canvasH = opts.canvasH ?? 200;
  const depth = opts.depth ?? DEPTH_RATIO;
  const zBias = opts.zBias ?? 0;

  const faces = [];
  for (let py = 0; py < H; py++) {
    // Opaque runs on this row.
    const runs = [];
    let s = -1;
    for (let x = 0; x <= W; x++) {
      const on = x < W && data[py * W + x] !== 0;
      if (on && s < 0) s = x;
      if (!on && s >= 0) { runs.push([s, x - 1]); s = -1; }
    }
    const yTop = canvasH - (offsetY + py);      // canvas y down -> world y up
    const yBottom = yTop - 1;
    for (const [x0, x1] of runs) {
      const c = (x0 + x1 + 1) / 2;              // run centre (pixel edges)
      const rw = (x1 - x0 + 1) / 2;
      const zAt = (xe) => {
        const dx = xe - c;
        const t = Math.max(0, rw * rw - dx * dx);
        return depth * Math.sqrt(t) + zBias;
      };
      for (let px = x0; px <= x1; px++) {
        const idx = data[py * W + px];
        if (idx === 0) continue;
        const xa = offsetX + px;
        const xb = xa + 1;
        const z0 = zAt(px);
        const z1 = zAt(px + 1);
        // Quad corners (shared z at shared x edges -> watertight).
        const a = [xa, yBottom, z0];
        const b = [xb, yBottom, z1];
        const cq = [xb, yTop, z1];
        const d = [xa, yTop, z0];
        // Normal from the surface slope: n ~ [-dz/dx, 0, 1].
        const nx = -(z1 - z0);
        const nl = Math.hypot(nx, 0, 1);
        faces.push({
          p: [a[0], a[1], a[2], b[0], b[1], b[2], cq[0], cq[1], cq[2], d[0], d[1], d[2]],
          n: [nx / nl, 0, 1 / nl],
          idx, px, py,
        });
      }
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
