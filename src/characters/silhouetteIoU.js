// Front-silhouette IoU (C6k acceptance metric + pose fitter core).
// Centroid-x + feet-anchored registration: measures SHAPE.
import { facesBounds } from '../render/characterMesh.js';

export function silhouetteIoU(faces, bmp, traceMap = null) {
  const { width: W, height: H, data } = bmp;
  if (traceMap) {
    // Exact mapping: the model IS a trace of this sprite - register by
    // construction, not centroid estimation (sub-pixel phase rims die).
    return rasterize(faces, W, H, data,
      (x) => x / traceMap.u + traceMap.colOffset,
      (y) => (H - 0.5) - y / traceMap.u - traceMap.rowTop);
  }
  const b = facesBounds(faces);
  const u = (b.maxY - b.minY) / H;
  let scx = 0, sn = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[y * W + x]) { scx += x + 0.5; sn++; }
  }
  scx /= sn;
  let mcx = 0, mn = 0;
  for (const f of faces) {
    const np = f.p.length / 3;
    for (let i = 0; i < np; i++) { mcx += f.p[i * 3]; mn++; }
  }
  mcx /= mn;
  return rasterize(faces, W, H, data, (x) => (x - mcx) / u + scx, (y) => (b.maxY - y) / u);
}

function rasterize(faces, W, H, data, toCol, toRow) {
  const grid = new Uint8Array(W * H);
  const tri = (ax, ay, bx, by, cx, cy) => {
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) return;
    for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
      const x = px + 0.5, y = py + 0.5;
      const w0 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
      const w1 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
      const w2 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
      const s = Math.sign(area);
      if (w0 * s >= 0 && w1 * s >= 0 && w2 * s >= 0) grid[py * W + px] = 1;
    }
  };
  for (const f of faces) {
    const np = f.p.length / 3;
    const px = [], py = [];
    for (let i = 0; i < np; i++) { px.push(toCol(f.p[i * 3])); py.push(toRow(f.p[i * 3 + 1])); }
    tri(px[0], py[0], px[1], py[1], px[2], py[2]);
    if (np === 4) tri(px[0], py[0], px[2], py[2], px[3], py[3]);
  }

  let inter = 0, union = 0;
  for (let i = 0; i < W * H; i++) {
    const s = data[i] !== 0 ? 1 : 0;
    const m = grid[i];
    if (s & m) inter++;
    if (s | m) union++;
  }
  let modelArea = 0;
  for (let i = 0; i < W * H; i++) if (grid[i]) modelArea++;
  return { iou: inter / union, inter, union, modelArea };
}
