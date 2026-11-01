// @ts-check
// AUDIT-STOREFRONT (2026-10-29, the owner: "the horse designs are awful"; bible/06-Systems/Storefront.md section 7):
// A MOUNT LOOK PAINTED ON THE HORSE. Each look is a ramp of its own colours laid by the art's own light, so the art's
// shading stays its shading, and its marks follow the horse's own shape (mountAnatomy): its edge (the ghost's rim, the
// sun on the charger, the plates' seams), its legs (the fire, the dissolve, the joints) and its belly's hem (the
// barding's trim). The first looks laid flat patterns in the picture's box - a grid, rows of scales, stripes - over the
// head and legs alike. Pure. Not a DFU member.

const clamp01 = (/** @type {number} */ v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** A pixel's own [0, 1) for a seed. */
function hashAt(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 0x27d4eb2f)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise [0, 1). */
function vnoise(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ s) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy,
    ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = hashAt(ix, iy, s),
    b = hashAt(ix + 1, iy, s),
    c = hashAt(ix, iy + 1, s),
    d = hashAt(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/** The 4x4 ordered dither's thresholds: a dissolve that reads as drawn, never as noise. */
const BAYER4 = Object.freeze([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((k) => (k + 0.5) / 16));
const bayer = (/** @type {number} */ x, /** @type {number} */ y) => BAYER4[(y & 3) * 4 + (x & 3)];

/** THE LOOKS' RAMPS, dark to light (sRGB). A pixel takes its place on its ramp from the art's light. */
export const MOUNT_RAMPS = Object.freeze({
  spectral: [
    [14, 24, 42],
    [40, 66, 98],
    [92, 136, 172],
    [170, 214, 236],
    [238, 251, 255],
  ],
  spectralMane: [
    [10, 20, 40],
    [30, 62, 104],
    [96, 160, 214],
    [210, 244, 255],
  ],
  dawnfire: [
    [92, 40, 6],
    [176, 96, 18],
    [234, 164, 44],
    [255, 218, 108],
    [255, 248, 218],
  ],
  fire: [
    [96, 12, 0],
    [200, 58, 8],
    [255, 140, 30],
    [255, 214, 104],
    [255, 250, 226],
  ],
  obsidian: [
    [4, 3, 5],
    [14, 10, 14],
    [30, 24, 32],
    [58, 52, 66],
    [112, 108, 128],
  ],
  ember: [
    [70, 6, 2],
    [168, 24, 8],
    [255, 80, 24],
    [255, 168, 72],
  ],
  burning: [
    [24, 4, 2],
    [110, 14, 4],
    [220, 54, 12],
    [255, 136, 40],
    [255, 214, 120],
  ],
  brass: [
    [40, 21, 6],
    [104, 62, 18],
    [174, 120, 40],
    [226, 184, 98],
    [255, 241, 196],
  ],
  steel: [
    [12, 14, 17],
    [38, 44, 52],
    [80, 90, 102],
    [150, 162, 176],
  ],
  aether: [
    [20, 96, 200],
    [70, 180, 255],
    [190, 240, 255],
    [250, 255, 255],
  ],
});

/** How far in from the silhouette's edge a pixel's distance is counted, px - the plates' seams lie inside it. */
export const EDGE_MAX = 8;
/** A leg: a horizontal run of the picture narrower than this share of the hide's width, under this share of its height. */
export const LEG_RUN = 0.16;
export const LEG_FROM = 0.42;
/** How high (a share of the hide's height over the hooves) the ghost's legs dissolve and the charger's burn. */
export const GHOST_LEGS = 0.34;
export const FIRE_LEGS = 0.3;
/** The automaton's aetherium heart: its height (a share of the hide's over the hooves), how far in from the chest's front
 *  and its radius (shares of the hide's width). */
export const HEART_UP = 0.6;
export const HEART_IN = 0.07;
export const HEART_R = 0.036;

function rampInto(
  /** @type {Uint8Array|number[]} */ out,
  /** @type {number} */ o,
  /** @type {readonly (readonly number[])[]} */ ramp,
  /** @type {number} */ t,
) {
  const n = ramp.length - 1,
    x = clamp01(t) * n,
    i = Math.min(n - 1, Math.floor(x)),
    f = x - i,
    a = ramp[i],
    b = ramp[i + 1];
  out[o] = Math.round(a[0] + (b[0] - a[0]) * f);
  out[o + 1] = Math.round(a[1] + (b[1] - a[1]) * f);
  out[o + 2] = Math.round(a[2] + (b[2] - a[2]) * f);
}
function mixInto(
  /** @type {Uint8Array|number[]} */ out,
  /** @type {number} */ o,
  /** @type {readonly number[]} */ c,
  /** @type {number} */ k,
) {
  const q = clamp01(k);
  out[o] = Math.round(out[o] + (c[0] - out[o]) * q);
  out[o + 1] = Math.round(out[o + 1] + (c[1] - out[o + 1]) * q);
  out[o + 2] = Math.round(out[o + 2] + (c[2] - out[o + 2]) * q);
}
/** A pixel's light, its brightest channel. */
export const lightOf = (/** @type {number} */ r, /** @type {number} */ g, /** @type {number} */ b) =>
  Math.max(r, g, b) / 255;

/**
 * THE HORSE'S SHAPE in a picture, for the looks: per pixel `edge` (its distance in from the nearest see-through pixel,
 * 1 on the silhouette, to EDGE_MAX; the picture's border is inside, so a neck cut by it has no rim), `leg` (1 in a narrow
 * run under the body), `hem` (1 on the body's lowest pixels, over a leg or the air), `far` (a point's distance off the
 * hide: 1 an outline, more a mane's or a tail's strand) and the hide's light (`lo`, `hi`). `down(i)` a pixel's depth
 * under the hide's top, `dir` the rows' step toward the hooves. Which way it faces is the view's (mountFacing).
 * @param {Uint8Array} src @param {number} w @param {number} h @param {ArrayLike<number>} hideAt @param {ArrayLike<number>} points @param {(i: number) => number} down @param {number} hideW @param {number} hideH @param {number} dir
 */
export function mountAnatomy(src, w, h, hideAt, points, down, hideW, hideH, dir) {
  const n = w * h,
    edge = new Uint8Array(n),
    leg = new Uint8Array(n),
    hem = new Uint8Array(n),
    hideSet = new Uint8Array(n);
  const solid = (/** @type {number} */ i) => src[i * 4 + 3] > 0;
  for (let i = 0; i < n; i++) edge[i] = solid(i) ? EDGE_MAX : 0;
  // the distance in, Chebyshev: two passes
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!edge[i]) continue;
      let d = edge[i];
      if (x > 0) d = Math.min(d, edge[i - 1] + 1);
      if (y > 0) {
        d = Math.min(d, edge[i - w] + 1);
        if (x > 0) d = Math.min(d, edge[i - w - 1] + 1);
        if (x < w - 1) d = Math.min(d, edge[i - w + 1] + 1);
      }
      edge[i] = d;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!edge[i]) continue;
      let d = edge[i];
      if (x < w - 1) d = Math.min(d, edge[i + 1] + 1);
      if (y < h - 1) {
        d = Math.min(d, edge[i + w] + 1);
        if (x < w - 1) d = Math.min(d, edge[i + w + 1] + 1);
        if (x > 0) d = Math.min(d, edge[i + w - 1] + 1);
      }
      edge[i] = d;
    }
  // the legs: narrow runs under the body
  const horse = new Uint8Array(n);
  for (let j = 0; j < hideAt.length; j++) {
    horse[hideAt[j]] = 1;
    hideSet[hideAt[j]] = 1;
  }
  for (let j = 0; j < points.length; j++) horse[points[j]] = 1;
  const narrow = Math.max(3, LEG_RUN * hideW),
    below = LEG_FROM * hideH;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w;) {
      if (!solid(y * w + x)) {
        x++;
        continue;
      }
      let e = x;
      while (e < w && solid(y * w + e)) e++;
      if (e - x < narrow)
        for (let k = x; k < e; k++) {
          const i = y * w + k;
          if (horse[i] && down(i) > below) leg[i] = 1;
        }
      x = e;
    }
  }
  // the hem: the body's lowest pixels, a leg or the air within two rows under them
  for (let i = 0; i < n; i++) {
    if (!horse[i] || leg[i] || down(i) < 0.3 * hideH) continue;
    const y = (i - (i % w)) / w;
    for (let k = 1; k <= 2; k++) {
      const yy = y + dir * k;
      if (yy < 0 || yy >= h) break;
      const q = yy * w + (i % w);
      if (leg[q] || !solid(q)) {
        hem[i] = 1;
        break;
      }
    }
  }
  // a point's distance off the hide (Chebyshev, to 255): an outline or a far leg's shading 1, a mane's or a tail's
  // strands further, their tips furthest - a mane seen from the saddle is 40 px across, so none is left unmeasured
  const far = new Uint8Array(n),
    queue = [];
  for (let j = 0; j < hideAt.length; j++) queue.push(hideAt[j]);
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k],
      x = i % w,
      y = (i - x) / w,
      d = hideSet[i] ? 0 : far[i];
    if (d >= 255) continue;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx,
          Y = y + dy;
        if ((!dx && !dy) || X < 0 || X >= w || Y < 0 || Y >= h) continue;
        const q = Y * w + X;
        if (horse[q] && !far[q] && !hideSet[q]) {
          far[q] = d + 1;
          queue.push(q);
        }
      }
  }
  // the hide's light, its 5th to 95th share
  const lights = Array.from(hideAt, (i) => lightOf(src[i * 4], src[i * 4 + 1], src[i * 4 + 2])).sort((a, b) => a - b);
  const lo = lights.length ? lights[Math.floor(lights.length * 0.05)] : 0,
    hi = lights.length ? lights[Math.floor(lights.length * 0.95)] : 1;
  return { edge, leg, hem, far, lo, hi: Math.max(hi, lo + 0.05) };
}

/** The five views every horse sprite is drawn in (the pool's horse1-5, Eye of the Beholder's records 0-4): its front,
 *  its front three-quarter, its side, its back three-quarter, its back. */
export const VIEW_FRONT = 0,
  VIEW_SIDE = 2,
  VIEW_BACK = 4;

/**
 * WHICH WAY THE HORSE FACES in a picture and where its heart is: `face` -1 the head to the left, 1 to the right, 0 seen
 * from the front or behind; `heart` [x, y, radius] at the chest's height (HEART_UP), or NaN where no chest is seen. `view`
 * the picture's (VIEW_FRONT..VIEW_BACK), or undefined (the tail read alone: a tall picture is its front or its back).
 * The tail stands off the hide behind the horse: the head is to its other side.
 * @param {{ far: Uint8Array, leg: Uint8Array }} an @param {number} w @param {ArrayLike<number>} hideAt
 * @param {ArrayLike<number>} points @param {(i: number) => number} down @param {number} hideW @param {number} hideH @param {number|undefined} view
 */
export function mountFacing(an, w, hideAt, points, down, hideW, hideH, view) {
  let face = 0;
  if (view !== VIEW_FRONT && view !== VIEW_BACK && !(view === undefined && hideW < 0.75 * hideH)) {
    // a tall picture unsaid is either
    let left = 0,
      right = 0,
      x0 = w,
      x1 = -1;
    for (let j = 0; j < hideAt.length; j++) {
      const x = hideAt[j] % w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
    for (let j = 0; j < points.length; j++) {
      const i = points[j],
        x = i % w;
      if (an.far[i] < 2 || down(i) > 0.75 * hideH) continue;
      if (x > x1 - 0.12 * hideW) right++;
      else if (x < x0 + 0.12 * hideW) left++;
    }
    face = right > 2 * left + 3 ? -1 : left > 2 * right + 3 ? 1 : 0;
  }
  // the heart: a few pixels in from the chest's front edge at its height, seen from the side or the front quarter -
  // from the front the head stands before it, from behind the body does
  const chest = face !== 0 && (view === undefined || view < 3);
  let cx = NaN,
    cy = NaN,
    lx = w,
    hx = -1,
    at = 0;
  const heartDown = (1 - HEART_UP) * hideH;
  for (let j = 0; chest && j < hideAt.length; j++) {
    const i = hideAt[j];
    if (an.leg[i] || Math.abs(down(i) - heartDown) >= 0.5) continue;
    const x = i % w;
    at = (i - x) / w;
    if (x < lx) lx = x;
    if (x > hx) hx = x;
  }
  if (hx >= 0) {
    const r = Math.max(3, HEART_IN * hideW);
    cx = face < 0 ? lx + r : hx - r;
    cy = at;
  }
  return { face, heart: [cx, cy, Math.max(2, HEART_R * hideW)] };
}

/**
 * One pixel's place for the painters: `t` its light on the hide's scale (0 dark, 1 light), `up` its height over the
 * hooves (a share of the hide's), `ur` its place along the hide (0 its back, 1 its front - where the head is), `edge`,
 * `leg`, `hem`, `far` (the anatomy's), `heart` its distance from the automaton's heart (its radius 1), `px`, `py` its grid, `seed` the horse's, `legs` whether hooves are drawn, `flat`
 * whether the picture has no silhouette (the 3D horse: lit by the world, so no rim is painted), `face` the anatomy's.
 * @typedef {{ t: number, up: number, ur: number, edge: number, leg: number, hem: number, far: number, heart: number, px: number, py: number, seed: number, legs: boolean, flat: boolean, face: number }} MountPixel
 */

/** The rim's weight: the silhouette's pixel, then the next a touch. */
const rimOf = (/** @type {MountPixel} */ p) => (p.flat ? 0 : p.edge <= 1 ? 1 : p.edge === 2 ? 0.3 : 0);

/**
 * A HIDE PIXEL IN ITS LOOK (`out` at `o`, already its coat). Answers its alpha: 255, or 0 where the ghost's legs dissolve.
 * @param {Uint8Array} out @param {number} o @param {string} look @param {MountPixel} p
 */
export function paintMountHide(out, o, look, p) {
  const s = p.seed | 0,
    rim = rimOf(p);
  switch (look) {
    case 'spectral': {
      // a pale ghost lit from within: mist drifting through it, its edge glowing, its legs dissolving
      const mist = vnoise(p.px * 0.09 + p.py * 0.03, p.py * 0.07, s + 31) - 0.5;
      rampInto(out, o, MOUNT_RAMPS.spectral, 0.2 + 0.74 * p.t + 0.22 * mist);
      mixInto(out, o, [214, 244, 255], 0.6 * rim);
      if (!p.flat && hashAt(p.px, p.py, s + 35) < 0.012) mixInto(out, o, [250, 255, 255], 0.75); // a glint of light in it
      if (p.legs && p.leg && p.up < GHOST_LEGS) {
        const fade = 1 - p.up / GHOST_LEGS,
          ragged = 0.22 * (vnoise(p.px * 0.5, p.py * 0.12, s + 33) - 0.5);
        if (!p.flat && bayer(p.px, p.py) < fade * 1.05 + ragged - 0.12) return 0; // the 3D horse's, in a texture, pale out
        mixInto(out, o, [196, 236, 255], (p.flat ? 0.8 : 0.5) * fade);
      }
      return 255;
    }
    case 'dawnfire': {
      // radiant gold, the sun along its back and edge, its legs burning up from the hooves
      const sheen = 0.16 * smooth(0.55, 0.9, vnoise(p.px * 0.08 + p.py * 0.05, p.py * 0.05, s + 41));
      rampInto(out, o, MOUNT_RAMPS.dawnfire, 0.1 + 0.82 * p.t + sheen);
      mixInto(out, o, [255, 244, 200], 0.4 * rim);
      if (p.legs && p.leg) {
        const top = FIRE_LEGS * (0.75 + 0.5 * vnoise(p.px * 0.3, 0.5, s + 42));
        const f = 1 - p.up / top + 0.28 * (vnoise(p.px * 0.55, p.py * 0.4, s + 44) - 0.5); // its edge in tongues
        if (f > 0) rampInto(out, o, MOUNT_RAMPS.fire, 0.3 + 0.7 * clamp01(f * 1.4) + 0.12 * p.t);
      }
      return 255;
    }
    case 'warhorse': {
      // obsidian with a cold sheen, lit from below by its own fire; its hooves burning
      rampInto(out, o, MOUNT_RAMPS.obsidian, 0.04 + 0.9 * p.t);
      const under = smooth(0.62, 0, p.up);
      mixInto(out, o, [176, 26, 8], 0.5 * under * (1 - 0.6 * p.t));
      if (under > 0.3) mixInto(out, o, [255, 96, 32], 0.7 * rim * under); // the glow catching its lower edge
      if (!p.flat && hashAt(p.px, p.py, s + 55) < 0.025 * under) rampInto(out, o, MOUNT_RAMPS.ember, 0.8); // an ember on the hide
      if (p.legs && p.up < 0.06) rampInto(out, o, MOUNT_RAMPS.ember, 0.55 + 0.45 * (1 - p.up / 0.06));
      return 255;
    }
    case 'automaton': {
      // polished brass in plates, their seams riveted, its joints ringed, an aetherium heart
      const polish = 0.14 * Math.pow(vnoise(p.px * 0.05 + p.py * 0.04, p.py * 0.03, s + 61), 3);
      rampInto(out, o, MOUNT_RAMPS.brass, 0.06 + 0.84 * p.t + polish);
      if (!p.leg) {
        const lean = 0.06 * (1 - p.up);
        const seam = Math.min(
          Math.abs(p.up - 0.62),
          p.face ? Math.min(Math.abs(p.ur - 0.4 - lean), Math.abs(p.ur - 0.72 - lean)) * 0.7 : 1,
        );
        if (seam < 0.009) {
          if (p.px % 6 === 0)
            rampInto(out, o, MOUNT_RAMPS.brass, 1); // a rivet
          else mixInto(out, o, [34, 16, 4], 0.85);
        } else if (seam < 0.02 && p.up > 0.62) mixInto(out, o, [255, 232, 160], 0.3); // the plate's bevel over it
        const core = p.heart; // the aetherium heart at the chest, its radius 1
        if (p.legs && core < 1)
          rampInto(out, o, MOUNT_RAMPS.aether, p.flat ? 0.3 + 0.5 * (1 - core) : 1 - core); // lit by the world, a white core washes out
        else if (p.legs && core < 1.6) mixInto(out, o, [90, 190, 255], 0.6 * (1 - (core - 1) / 0.6));
      } else {
        const joint = Math.min(Math.abs(p.up - 0.18), Math.abs(p.up - 0.36)); // the hock's and the knee's rings
        if (joint < 0.012) mixInto(out, o, [30, 16, 4], 0.85);
        else if (joint < 0.026) mixInto(out, o, [255, 230, 160], 0.3);
      }
      return 255;
    }
    default:
      return 255;
  }
}

/**
 * A POINT IN ITS LOOK - the near-black the art paints its outlines, far legs, mane and tail in. An outline or a far leg
 * (`far` 1, or a leg) is the hide's own shade, darker; a mane's or a tail's strand is the look's: the ghost's glowing
 * wisps, dissolving at their tips; the charger's and the warhorse's fire, brightest at the tips; the automaton's steel.
 * Answers its alpha.
 * @param {Uint8Array} out @param {number} o @param {string} look @param {MountPixel} p
 */
export function paintMountPoint(out, o, look, p) {
  if (p.leg || p.far <= 1) {
    const t = p.t;
    p.t = 0.22 * t;
    const a = paintMountHide(out, o, look, p);
    p.t = t;
    return a;
  }
  // its tip: out along the strand, by length (a tail's tips 8 px off) and by share (a mane's fringe, however wide)
  const tip = Math.min(clamp01((p.far - 1) / 8), p.far / (p.far + p.edge)),
    t = p.t,
    flick = 0.2 * (vnoise(p.px * 0.7, p.py * 0.45, (p.seed | 0) + 71) - 0.5);
  switch (look) {
    case 'spectral':
      rampInto(out, o, MOUNT_RAMPS.spectralMane, 0.25 + 0.35 * t + 0.45 * tip);
      // its tips dissolving - thinly inside a mane's mass, so it reads as wisps and not as a screen
      if (!p.flat && tip > 0.6 && bayer(p.px, p.py) < (tip - 0.6) * (p.edge <= 3 ? 1.5 : 0.5)) return 0;
      return 255;
    case 'dawnfire': // a tail of fire, its root deep, its tips white-hot, flickering
      rampInto(out, o, MOUNT_RAMPS.fire, 0.18 + 0.28 * t + 0.6 * tip + flick);
      return 255;
    case 'warhorse':
      rampInto(out, o, MOUNT_RAMPS.burning, 0.12 + 0.3 * t + 0.62 * tip + flick);
      return 255;
    case 'automaton':
      rampInto(out, o, MOUNT_RAMPS.steel, 0.15 + 0.6 * t + 0.25 * tip);
      return 255;
    default:
      return 255;
  }
}
