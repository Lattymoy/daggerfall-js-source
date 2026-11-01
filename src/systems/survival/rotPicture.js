// NO-BETHESDA3 (2026-10-31; the owner: "Also rebuild the rotten fish ourself"): OUR OWN ROT, drawn over the player's
// own picture of the fresh food. No pixel of a mod's picture is read: the colour is drawn toward a sick green-grey,
// the rim darkened, and a few mould specks set where a seeded pattern of ours puts them. Pure: a top-down RGBA picture
// in, a new one out, and a clear pixel stays clear (0,0,0,0).

/** The sick green-grey a pixel's light is drawn toward (a share of its luminance per channel), and how far. */
export const ROT_TINT = Object.freeze([0.84, 1, 0.66]);
export const ROT_MIX = 0.75;
/** A pixel's light one and two pixels in from the clear (or the picture's edge); deeper ones keep theirs. */
export const ROT_RIM = Object.freeze([0.55, 0.78]);
/** A speck's pale bloom, and the colour its fuzz is drawn toward on the drawn pixels beside it. */
export const MOULD = Object.freeze([196, 206, 166]);
export const MOULD_FUZZ = 0.45;
/** One speck to this many drawn pixels, and never fewer than MIN_SPECKS where the interior has room. */
export const DRAWN_PER_SPECK = 60;
export const MIN_SPECKS = 3;

/** xorshift32 from `seed`: the same specks every time for one seed. */
function rng(seed) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
}

/** How far each drawn pixel is from the clear, in pixels (1 = touching it, 3 = three or more), 0 where clear. */
export function rimDepth(pic) {
  const { width: w, height: h, data } = pic;
  const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= h || data[(y * w + x) * 4 + 3] === 0;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (clear(x, y)) continue;
      let d = 3;
      for (let k = 1; k < 3 && d === 3; k++) {
        for (let dy = -k; dy <= k && d === 3; dy++) for (let dx = -k; dx <= k; dx++) if (clear(x + dx, y + dy)) { d = k; break; }
      }
      out[y * w + x] = d;
    }
  }
  return out;
}

/** Where the specks fall: drawn pixels two or more from the clear, picked by the seed, one to `perSpeck`. Pure. */
export function mouldSpecks(depth, w, seed, perSpeck = DRAWN_PER_SPECK) {
  const room = [];
  let drawn = 0;
  for (let i = 0; i < depth.length; i++) { if (depth[i]) drawn++; if (depth[i] >= 2) room.push(i); }
  const want = Math.min(room.length, Math.max(MIN_SPECKS, Math.round(drawn / perSpeck)));
  const next = rng(seed), picked = [];
  while (picked.length < want) {
    const i = room.splice(next() % room.length, 1)[0];
    if (!picked.some((p) => Math.abs((p % w) - (i % w)) < 3 && Math.abs(((p / w) | 0) - ((i / w) | 0)) < 2)) picked.push(i);
    if (!room.length) break;
  }
  return picked.sort((a, b) => a - b);
}

/** OWN-WORK4: the first spoiled face, mouldy - less of the sick tint, more mould. Rotten is the default. */
export const MOULDY = Object.freeze({ mix: 0.3, perSpeck: 30 });

/** The food, rotten: `pic` is the fresh food's picture (top-down RGBA), `seed` our pattern's; `mix` and `perSpeck`
 *  set how far the tint goes and how thick the mould lies (MOULDY for the first stage). */
export function rotPicture(pic, { seed = 1, mix = ROT_MIX, perSpeck = DRAWN_PER_SPECK } = {}) {
  const { width: w, height: h } = pic;
  const src = pic.data, data = new Uint8Array(w * h * 4);
  const depth = rimDepth(pic);
  for (let i = 0; i < w * h; i++) {
    if (!depth[i]) continue;
    const o = i * 4, lum = 0.299 * src[o] + 0.587 * src[o + 1] + 0.114 * src[o + 2];
    const rim = depth[i] < 3 ? ROT_RIM[depth[i] - 1] : 1;
    for (let c = 0; c < 3; c++) data[o + c] = Math.min(255, Math.round((src[o + c] * (1 - mix) + lum * ROT_TINT[c] * mix) * rim));
    data[o + 3] = 255;
  }
  for (const i of mouldSpecks(depth, w, seed, perSpeck)) {
    const x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const j = (y + dy) * w + x + dx;
      if (x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h || !depth[j]) continue;
      for (let c = 0; c < 3; c++) data[j * 4 + c] = Math.round(data[j * 4 + c] + (MOULD[c] - data[j * 4 + c]) * MOULD_FUZZ);
    }
    data.set(MOULD, i * 4);
  }
  return { width: w, height: h, data };
}
