// The atlas-island rule the trees converter and the trees probe share:
// where each opaque sprite sits on an atlas, and which one a UV lands in.
// Read for GEOMETRY only - nothing here writes a pixel anywhere.

// ── the atlas: islands of opaque pixels ──────────────────────────

/** Label the atlas's opaque islands (4-connected, alpha > 8) and return
 *  each island's bounding box in atlas pixels, plus a label map. Read
 *  for geometry only: the pixels are never written anywhere. */
export function islands(png) {
  const { width: W, height: H, data } = png;
  const label = new Int32Array(W * H).fill(-1);
  const boxes = [];
  const stack = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (label[i] >= 0 || data[i * 4 + 3] <= 8) continue;
      const id = boxes.length;
      const box = { x0: x, y0: y, x1: x, y1: y, n: 0 };
      boxes.push(box); label[i] = id; stack.push(i);
      while (stack.length) {
        const j = stack.pop(); const jx = j % W, jy = (j / W) | 0;
        box.n++;
        if (jx < box.x0) box.x0 = jx; if (jx > box.x1) box.x1 = jx;
        if (jy < box.y0) box.y0 = jy; if (jy > box.y1) box.y1 = jy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = jx + dx, ny = jy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const k = ny * W + nx;
          if (label[k] >= 0 || data[k * 4 + 3] <= 8) continue;
          label[k] = id; stack.push(k);
        }
      }
    }
  }
  // Sprites are drawn with small detached specks (a leaf, a label
  // digit). Merge any island that sits inside another's box into it,
  // and drop the digits - the numbers the partner wrote beside each
  // record are tiny and never under a card.
  const big = boxes.map((b, i) => ({ ...b, id: i })).filter((b) => b.n >= 24);
  return { label, boxes: big, W, H };
}

/** The island under a card: the one whose box contains the card's UV
 *  centre, else the nearest box by centre distance (a card's UVs can
 *  overhang an island by a texel of filtering margin). */
export function islandFor(atlas, u, v) {
  const px = u * atlas.W, py = (1 - v) * atlas.H;     // Collada v is up; PNG rows are down
  let best = null, bestD = Infinity;
  for (const b of atlas.boxes) {
    const inside = px >= b.x0 - 1 && px <= b.x1 + 1 && py >= b.y0 - 1 && py <= b.y1 + 1;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const d = inside ? 0 : Math.hypot(px - cx, py - cy);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

