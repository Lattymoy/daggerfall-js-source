// OWN-WORK4 (2026-10-31; the owner: "Our goal is no latching onto other mod authors or needing permissions. A proper
// 1 to 1 recreation for everything"): OUR OWN PIXEL PAINTER. Each picture a retired mod's folder carried is drawn here
// from a recipe of ours - filled shapes, a ramp of light laid by ordered dither, a one-pixel dark rim - in a small
// palette made to sit beside Daggerfall's own. Pure and deterministic: no file is read, one recipe gives one picture.

/** '#rrggbb' to [r, g, b]. */
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ramp = (...hs) => Object.freeze(hs.map((h) => Object.freeze(hex(h))));

/** The palette: ramps dark to light, in Daggerfall's earthy, muted hand. */
export const RAMP = Object.freeze({
  wood: ramp('#24170d', '#3d2816', '#5a3b20', '#7a522d', '#9a6c3e', '#b88b57'),
  pale: ramp('#3a2c1c', '#5e4a30', '#857049', '#a99567', '#c9b88b', '#e2d5ad'),
  iron: ramp('#16181c', '#2c3036', '#474c53', '#656b72', '#878d93', '#b4b9bc'),
  steel: ramp('#262a30', '#454b53', '#6a727a', '#949ca2', '#c0c6ca', '#e8ecee'),
  leather: ramp('#21130b', '#3a2213', '#57341d', '#754829', '#946139', '#b07c4f'),
  rope: ramp('#3b2c15', '#5c4622', '#7d6232', '#9d7f46', '#bb9d60', '#d6bd83'),
  egg: ramp('#6f5e48', '#97826a', '#b9a68d', '#d4c5ae', '#e9dfcd', '#f8f2e6'),
  meat: ramp('#3a0b0c', '#5e1416', '#842022', '#a5333a', '#c2555c', '#d97f83'),
  fat: ramp('#7d6a58', '#a08d78', '#c0ae98', '#d9cab6', '#ece2d2'),
  bone: ramp('#6b6152', '#8f846f', '#b1a68e', '#cfc6ae', '#e8e1cd'),
  skin: ramp('#3e2418', '#633b27', '#8a5639', '#ad7350', '#c99470', '#e0b592'),
  stone: ramp('#1a1917', '#2e2c28', '#45423c', '#5e5a52', '#7a756b', '#9a9488', '#bbb5a7'),
  gold: ramp('#3a2606', '#64430d', '#8f6516', '#b98a22', '#dcb43c', '#f6df7c'),
  flame: ramp('#5a0c02', '#9a2204', '#d24808', '#f27e12', '#fbb52c', '#fee27a', '#fff8d8'),
  red: ramp('#2c0a09', '#4f1412', '#76201b', '#9b3227', '#bb4e3b', '#d27458'),
  blue: ramp('#0f1424', '#1d2741', '#2d3d60', '#41567f', '#5c759b', '#839bb8'),
  green: ramp('#101a0e', '#1f3019', '#304626', '#445f35', '#5d7a48', '#7d9862'),
  wine: ramp('#1c0b14', '#341424', '#4f1f37', '#6c2d4c', '#8a4363', '#a9617d'),
  brown: ramp('#1f160e', '#372718', '#523b24', '#6d5132', '#8a6a44', '#a68659'),
  grey: ramp('#1e1e20', '#363639', '#535357', '#727277', '#96969a', '#bfbfc2'),
  white: ramp('#4c4c52', '#76767e', '#a2a2aa', '#c8c8ce', '#e4e4e8', '#fafafa'),
  black: ramp('#08080a', '#141418', '#212127', '#303038', '#43434d'),
  yellow: ramp('#4a3305', '#7a560b', '#a87d14', '#d2a725', '#f0cc44', '#fbe788'),
  ember: ramp('#3d0d06', '#6b1a0b', '#9c2c12', '#c64a1c', '#e2702c', '#f39a4a'),
  bronze: ramp('#2c1d0c', '#4d3416', '#714d20', '#94692c', '#b48a42', '#cfab64'),
  olive: ramp('#16180b', '#2a2e15', '#40461f', '#58602a', '#727c38', '#90994c'),
  sea: ramp('#0e171d', '#1d2c36', '#2f4552', '#466170', '#62808e', '#87a2ad'),
});

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** The 4x4 ordered-dither threshold of a pixel, in [0, 1). */
export const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
/** A pixel's own grain in [0, 1): an integer hash of where it is, under `seed`. */
export function grain(x, y, seed = 1) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A ramp's colour at light `t` for pixel (px, py), dithered as `fill` lays it - for a paint that picks its ramp. */
export function shadeOf(r, t, px, py) {
  const v = Math.max(0, Math.min(1, t)) * (r.length - 1);
  return r[Math.max(0, Math.min(r.length - 1, Math.floor(v + bayer(px, py))))];
}

// The light falls from the upper left, toward the viewer: a shape's lit side is its upper-left one.
const LX = -0.55, LY = -0.62, LZ = 0.56;
const lit = (nx, ny, nz) => (nx * LX + ny * LY + nz * LZ + 1) / 2;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** An ellipse at (cx, cy), radii rx, ry, turned `rot` radians; lit as a dome. */
export function ellipse(cx, cy, rx, ry, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), r = Math.max(rx, ry);
  const local = (x, y) => [((x - cx) * c + (y - cy) * s) / rx, (-(x - cx) * s + (y - cy) * c) / ry];
  return {
    box: [cx - r, cy - r, cx + r, cy + r],
    has: (x, y) => { const [u, v] = local(x, y); return u * u + v * v <= 1; },
    tone: (x, y) => { const [u, v] = local(x, y); const d = Math.min(1, u * u + v * v); return lit(u * c - v * s, u * s + v * c, Math.sqrt(1 - d)); },
  };
}

/** A polygon (points [[x, y], ...]); lit as a slab whose upper-left is nearer the light. */
export function poly(points) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, ext = Math.max(1e-6, Math.hypot(box[2] - box[0], box[3] - box[1]) / 2);
  return {
    box,
    has: (x, y) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    },
    tone: (x, y) => clamp01(0.62 + (((x - cx) * LX + (y - cy) * LY) / ext) * 0.42),
  };
}

/** A rectangle [x0, x1) x [y0, y1); lit as a slab. */
export const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

/** A thick line through `points`, radius r0 at its start to r1 at its end, round-capped; lit as a rod. */
export function stroke(points, r0, r1 = r0) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i], len = Math.hypot(bx - ax, by - ay) || 1e-6;
    segs.push({ ax, ay, dx: (bx - ax) / len, dy: (by - ay) / len, len, at: total });
    total += len;
  }
  const rmax = Math.max(r0, r1);
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const near = (x, y) => {
    let best = null;
    for (const s of segs) {
      const t = Math.max(0, Math.min(s.len, (x - s.ax) * s.dx + (y - s.ay) * s.dy));
      const ox = x - (s.ax + s.dx * t), oy = y - (s.ay + s.dy * t), d = Math.hypot(ox, oy);
      const r = r0 + (r1 - r0) * ((s.at + t) / (total || 1));
      if (d <= r && (!best || d / r < best.k)) best = { k: d / r, side: Math.sign(ox * -s.dy + oy * s.dx) || 1, s };
    }
    return best;
  };
  return {
    box: [Math.min(...xs) - rmax, Math.min(...ys) - rmax, Math.max(...xs) + rmax, Math.max(...ys) + rmax],
    has: (x, y) => near(x, y) != null,
    tone: (x, y) => {
      const n = near(x, y);
      if (!n) return 0.5;
      const o = n.k * n.side; // across the rod, -1..1
      return lit(-n.s.dy * o, n.s.dx * o, Math.sqrt(Math.max(0, 1 - o * o)));
    },
  };
}

/** Two shapes as one: inside either (`union`), inside the first and not the second (`minus`), inside both (`and`). */
export const union = (a, b) => ({ box: [Math.min(a.box[0], b.box[0]), Math.min(a.box[1], b.box[1]), Math.max(a.box[2], b.box[2]), Math.max(a.box[3], b.box[3])], has: (x, y) => a.has(x, y) || b.has(x, y), tone: (x, y) => (a.has(x, y) ? a.tone(x, y) : b.tone(x, y)) });
export const minus = (a, b) => ({ box: a.box, has: (x, y) => a.has(x, y) && !b.has(x, y), tone: a.tone });
export const and = (a, b) => ({ box: a.box, has: (x, y) => a.has(x, y) && b.has(x, y), tone: a.tone });

/** A picture `width` x `height`, top-down RGBA, clear. Shapes are placed in `space` units (the picture's own pixels by
 *  default): a picture Unity's import stretched is drawn in the shape it shows and sampled at its own size. */
export function createPainter(width, height, { space = [width, height] } = {}) {
  const data = new Uint8Array(width * height * 4);
  const kx = space[0] / width, ky = space[1] / height;
  const at = (x, y) => (y * width + x) * 4;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < width && y < height && data[at(x, y) + 3] !== 0;
  /** Paint `shape` with `paint` - a ramp (dark to light), one colour, or ({ x, y, px, py, t }) => colour. Options:
   *  `bias` and `gain` move and stretch the light, `seed` and `rough` grain it, `over` paints only where already
   *  painted, `under` only where clear, `clip` only inside another shape, `flat` lays no dither. */
  function fill(shape, paint, { bias = 0, gain = 1, seed = 0, rough = 0, over = false, under = false, clip = null, flat = false } = {}) {
    const [x0, y0, x1, y1] = shape.box;
    const px0 = Math.max(0, Math.floor(x0 / kx)), py0 = Math.max(0, Math.floor(y0 / ky));
    const px1 = Math.min(width - 1, Math.ceil(x1 / kx)), py1 = Math.min(height - 1, Math.ceil(y1 / ky));
    for (let py = py0; py <= py1; py++) {
      for (let px = px0; px <= px1; px++) {
        const x = (px + 0.5) * kx, y = (py + 0.5) * ky;
        if (!shape.has(x, y) || (clip && !clip.has(x, y))) continue;
        const o = at(px, py);
        if ((over && !data[o + 3]) || (under && data[o + 3])) continue;
        let t = 0.5 + (shape.tone(x, y) - 0.5) * gain + bias;
        if (rough) t += (grain(px, py, seed) - 0.5) * rough;
        let c;
        if (typeof paint === 'function') c = paint({ x, y, px, py, t: clamp01(t) });
        else if (Array.isArray(paint[0])) {
          const v = clamp01(t) * (paint.length - 1);
          c = paint[Math.max(0, Math.min(paint.length - 1, flat ? Math.round(v) : Math.floor(v + bayer(px, py))))];
        } else c = paint;
        if (!c) continue;
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
      }
    }
  }
  /** Set one pixel (picture coordinates); `null` clears it. */
  function set(px, py, c) {
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const o = at(px, py);
    if (!c) { data.fill(0, o, o + 4); return; }
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  const get = (px, py) => (opaque(px, py) ? [...data.subarray(at(px, py), at(px, py) + 3)] : null);
  /** The rim: every painted pixel beside a clear one (or the picture's edge, `edges`) drawn toward `dark`, `keep` of
   *  its own colour kept - Daggerfall's sprites end in a shadowed edge, never a bright one. */
  function outline({ dark = [16, 11, 8], keep = 0.3, edges = true } = {}) {
    const rim = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!opaque(x, y)) continue;
        const out = (nx, ny) => (nx < 0 || ny < 0 || nx >= width || ny >= height ? edges : !opaque(nx, ny));
        if (out(x - 1, y) || out(x + 1, y) || out(x, y - 1) || out(x, y + 1)) rim.push(at(x, y));
      }
    }
    for (const o of rim) for (let c = 0; c < 3; c++) data[o + c] = Math.round(data[o + c] * keep + dark[c] * (1 - keep));
  }
  /** Words in our letters (5x7, or the 4x7 `NARROW` set) at picture pixel (px, py), with a one-pixel shadow under
   *  and right when `shadow`. */
  function text(str, px, py, c, { shadow = null, font = GLYPHS } = {}) {
    const draw = (ox, oy, col) => {
      let x = ox;
      for (const ch of String(str)) {
        const g = font[ch] ?? font[' '];
        g.forEach((row, gy) => { for (let gx = 0; gx < row.length; gx++) if (row[gx] === '#') set(x + gx, oy + gy, col); });
        x += g[0].length + 1;
      }
    };
    if (shadow) draw(px + 1, py + 1, shadow);
    draw(px, py, c);
  }
  return { width, height, data, fill, set, get, outline, text, picture: () => ({ width, height, data }) };
}

/** How many pixels `str` takes in our letters (the gap after the last one not counted). */
export const textWidth = (str, font = GLYPHS) =>
  [...String(str)].reduce((w, ch) => w + (font[ch] ?? font[' '])[0].length + 1, 0) - 1;

// Our letters: 5x7 capitals, a 3-wide 'x' and ':' - what the travel strip's buttons and labels say.
const G = (s) => Object.freeze(s.split('|'));
export const GLYPHS = Object.freeze({
  ' ': G('...|...|...|...|...|...|...'),
  A: G('.###.|#...#|#...#|#####|#...#|#...#|#...#'),
  C: G('.###.|#...#|#....|#....|#....|#...#|.###.'),
  D: G('####.|#...#|#...#|#...#|#...#|#...#|####.'),
  E: G('#####|#....|#....|####.|#....|#....|#####'),
  I: G('###|.#.|.#.|.#.|.#.|.#.|###'),
  M: G('#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#'),
  N: G('#...#|##..#|#.#.#|#..##|#...#|#...#|#...#'),
  O: G('.###.|#...#|#...#|#...#|#...#|#...#|.###.'),
  P: G('####.|#...#|#...#|####.|#....|#....|#....'),
  R: G('####.|#...#|#...#|####.|#.#..|#..#.|#...#'),
  S: G('.####|#....|#....|.###.|....#|....#|####.'),
  T: G('#####|..#..|..#..|..#..|..#..|..#..|..#..'),
  X: G('#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#'),
  x: G('...|...|#.#|.#.|#.#|...|...'),
  ':': G('.|.|#|.|#|.|.'),
});

/** Our narrow letters, 4x7: what a 32-pixel message-box button has room for. */
export const NARROW = Object.freeze({
  ' ': G('..|..|..|..|..|..|..'),
  5: G('####|#...|###.|...#|...#|#..#|.##.'),
  A: G('.##.|#..#|#..#|####|#..#|#..#|#..#'),
  D: G('###.|#..#|#..#|#..#|#..#|#..#|###.'),
  S: G('.###|#...|#...|.##.|...#|...#|###.'),
  Y: G('#..#|#..#|#..#|.##.|.##.|.##.|.##.'),
});
