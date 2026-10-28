// ROTSPRITE - a pixel picture turned with no new colour in it. Pure, no DOM, beside resample.js. The Pistolet's doll
// layers (tools/pistoletArt.mjs) and the spear lab's strikes (combat/spearStrikes.js) both turn the owner's pixels
// with it, so it has one home here (Home.md, ONE DFU MEMBER, ONE EXPORT, for our own code too).

/** Scale2x (EPX), exact on colours: twice the size, a diagonal edge rounded rather than doubled into a staircase. */
export function scale2x({ width: w, height: h, data }) {
  const W = w * 2, out = new Uint8Array(W * h * 2 * 4);
  const at = (x, y) => (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4;
  const eq = (a, b) => data[a] === data[b] && data[a + 1] === data[b + 1] && data[a + 2] === data[b + 2] && data[a + 3] === data[b + 3];
  const put = (x, y, s) => { const d = (y * W + x) * 4; for (let c = 0; c < 4; c++) out[d + c] = data[s + c]; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const E = at(x, y), B = at(x, y - 1), D = at(x - 1, y), F = at(x + 1, y), H = at(x, y + 1);
      const edge = !eq(B, H) && !eq(D, F);
      put(2 * x, 2 * y, edge && eq(D, B) ? D : E);
      put(2 * x + 1, 2 * y, edge && eq(B, F) ? F : E);
      put(2 * x, 2 * y + 1, edge && eq(D, H) ? D : E);
      put(2 * x + 1, 2 * y + 1, edge && eq(H, F) ? F : E);
    }
  }
  return { width: W, height: h * 2, data: out };
}

/** RotSprite's working size: Scale2x three times. */
export const ROT_K = 8;

/** The picture at ROT_K times its size, the three Scale2x passes RotSprite samples. */
export const rotSpriteUp = (img) => scale2x(scale2x(scale2x(img)));

/**
 * ROTSPRITE: a pixel picture turned `deg` counter-clockwise on the screen with no new colour in it - Scale2x three times
 * (8x), the turn sampled nearest at 8x, read back at 1x. A nearest turn at 1x is the staircase-and-holes the Gun-Lab
 * record warns of; this is the pixel-art answer to it. `point` (source pixels) is carried through the same turn.
 * Answers `{ img, at }`, the picture just big enough to hold the turned one.
 */
export function rotSprite(img, deg, point = null) {
  const K = ROT_K, big = rotSpriteUp(img);
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const cx = img.width / 2, cy = img.height / 2;
  const turn = (x, y) => [(x - cx) * c + (y - cy) * s, -(x - cx) * s + (y - cy) * c];   // y down: (1, 0) goes up-right
  const corners = [[0, 0], [img.width, 0], [0, img.height], [img.width, img.height]].map(([x, y]) => turn(x, y));
  const x0 = Math.floor(Math.min(...corners.map((p) => p[0]))), y0 = Math.floor(Math.min(...corners.map((p) => p[1])));
  const W = Math.ceil(Math.max(...corners.map((p) => p[0]))) - x0, H = Math.ceil(Math.max(...corners.map((p) => p[1]))) - y0;
  const out = new Uint8Array(W * H * 4);
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const u = X + 0.5 + x0, v = Y + 0.5 + y0;
      const bx = Math.floor((u * c - v * s + cx) * K), by = Math.floor((u * s + v * c + cy) * K);
      if (bx < 0 || by < 0 || bx >= big.width || by >= big.height) continue;
      const si = (by * big.width + bx) * 4, d = (Y * W + X) * 4;
      for (let k = 0; k < 4; k++) out[d + k] = big.data[si + k];
    }
  }
  const p = point && turn(point[0], point[1]);
  return { img: { width: W, height: H, data: out }, at: p && { x: p[0] - x0, y: p[1] - y0 } };
}

/** Where a source point lands under a pose: the source sits at `origin` in the target's pixels, and is turned `deg`
 *  counter-clockwise on the screen and scaled `scale` about `pivot` (target pixels), then moved by `shift`. */
export function turnedPoint([x, y], { deg = 0, scale = 1, pivot = [0, 0], origin = [0, 0], shift = [0, 0] } = {}) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const dx = (x + origin[0] - pivot[0]) * scale, dy = (y + origin[1] - pivot[1]) * scale;
  return [pivot[0] + dx * c + dy * s + shift[0], pivot[1] - dx * s + dy * c + shift[1]];
}

/** A POSE DRAWN INTO A PICTURE: `big` (rotSpriteUp of a source) under turnedPoint's pose, sampled nearest at 8x as
 *  rotSprite is. Opaque texels only, so a later pose draws over an earlier one. `keep(X, Y, qx, qy)`, if given, says
 *  which target texels (X, Y) take their source texel (qx, qy). Answers `into`. */
export function drawTurned(into, big, pose = {}, keep = null) {
  const { deg = 0, scale = 1, pivot = [0, 0], origin = [0, 0], shift = [0, 0] } = pose;
  const K = ROT_K, a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const sw = big.width / K, sh = big.height / K;
  const box = [[0, 0], [sw, 0], [0, sh], [sw, sh]].map((q) => turnedPoint(q, pose));
  const X0 = Math.max(0, Math.floor(Math.min(...box.map((p) => p[0])))), X1 = Math.min(into.width, Math.ceil(Math.max(...box.map((p) => p[0]))));
  const Y0 = Math.max(0, Math.floor(Math.min(...box.map((p) => p[1])))), Y1 = Math.min(into.height, Math.ceil(Math.max(...box.map((p) => p[1]))));
  const out = into.data, src = big.data, bw = big.width, bh = big.height;
  for (let Y = Y0; Y < Y1; Y++) {
    for (let X = X0; X < X1; X++) {
      const ux = X + 0.5 - shift[0] - pivot[0], uy = Y + 0.5 - shift[1] - pivot[1];
      const qx = (ux * c - uy * s) / scale + pivot[0] - origin[0], qy = (ux * s + uy * c) / scale + pivot[1] - origin[1];
      const bx = Math.floor(qx * K), by = Math.floor(qy * K);
      if (bx < 0 || by < 0 || bx >= bw || by >= bh) continue;
      const si = (by * bw + bx) * 4;
      if (src[si + 3] < 128 || (keep && !keep(X, Y, qx, qy))) continue;
      const d = (Y * into.width + X) * 4;
      out[d] = src[si]; out[d + 1] = src[si + 1]; out[d + 2] = src[si + 2]; out[d + 3] = 255;
    }
  }
  return into;
}
