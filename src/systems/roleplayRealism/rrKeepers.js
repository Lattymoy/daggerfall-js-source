// OWN-WORK4 AUDIT (2026-11-01; the coordinator: "better than the removed packs in every way"): THE VARIANT KEEPERS,
// OUR RULE OVER THE PLAYER'S OWN PEOPLE. Each keeper is put together from Daggerfall's tavern and shop folk (TEXTURE.182
// in the player's ARENA2): one record's body, another's head, a cloth swapped to another of the palette's ramps, a prop
// from a third. RR_KEEPERS is the data; no pixel of any hand but Daggerfall's is in it. Each picture keeps the aspect
// of the classic keeper it stands in for (RR_KEEPER_OF), at the height Daggerfall drew these folk, so it is shown at
// that keeper's size (rrVariants.js RR_NPC_XML_SCALE) with Daggerfall's own shading.

/** The palette's ramps are its rows of sixteen, light to dark; 0 is clear and 255 the mask. */
const RAMP_OF = (i) => i >> 4;
const MASK = 0xff;

/** Each keeper: `size` its picture, `body` the record it stands on (feet on the floor, centred), `clear` the body's own
 *  head (rects in the body's pixels), `pieces` laid over it (`from` a record, `rect` its part, `at` where that part's
 *  corner lands, in the body's pixels), and `swaps` (a ramp `from` to a ramp `to`, `darker` steps down it, inside
 *  `rect`). By trade and house:
 *  0 a poor shop's working man, 1 a plain shop's wife, 2 a good shop's elder merchant with his purse, 3 a fine shop's
 *  lady, 5 a good tavern's young barkeep, 6 the tavern's own keeper among his bottles. */
export const RR_KEEPERS = Object.freeze({
  0: {
    size: [79, 128],
    body: [182, 4],
    clear: [[12, 0, 42, 21]],
    pieces: [{ from: [182, 25], rect: [21, 0, 45, 21], at: [16, 1] }],
    swaps: [{ from: 0x7, to: 0x4, darker: 3, rect: [0, 21, 50, 76] }],
  },
  1: {
    size: [79, 128],
    body: [182, 26],
    clear: [[10, 0, 40, 23]],
    pieces: [{ from: [182, 27], rect: [15, 0, 38, 22], at: [13, 5] }],
    swaps: [{ from: 0xc, to: 0x6, rect: [0, 23, 51, 119] }],
  },
  2: {
    size: [79, 128],
    body: [182, 17],
    clear: [[16, 0, 46, 21]],
    pieces: [{ from: [182, 7], rect: [16, 0, 46, 24], at: [17, -2] }],
    swaps: [
      { from: 0xa, to: 0xb, rect: [0, 18, 75, 90] },
      { from: 0xc, to: 0xb, rect: [0, 18, 75, 90] },
    ],
  },
  3: {
    size: [79, 128],
    body: [182, 10],
    clear: [
      [20, 0, 50, 23],
      [24, 23, 47, 27],
    ],
    pieces: [{ from: [182, 9], rect: [26, 0, 49, 24], at: [24, 3] }],
    swaps: [{ from: 0x8, to: 0x3, rect: [0, 15, 58, 128] }],
  },
  5: {
    size: [67, 128],
    body: [182, 3],
    clear: [[15, 0, 45, 20]],
    pieces: [{ from: [182, 23], rect: [21, 0, 45, 20], at: [19, 1] }],
    swaps: [{ from: 0x4, to: 0xa, rect: [0, 20, 59, 70] }],
  },
  6: {
    size: [71, 128],
    body: [182, 8],
    clear: [[13, 0, 43, 20]],
    pieces: [
      { from: [182, 20], rect: [20, 0, 43, 20], at: [17, 1] },
      { from: [182, 2], rect: [12, 96, 31, 128], at: [-3, 89] },
    ],
    swaps: [{ from: 0x4, to: 0xb, rect: [0, 20, 60, 75] }],
  },
});

/** The picture sizes, by record. */
export const RR_KEEPER_SIZE = Object.freeze(
  Object.fromEntries(Object.entries(RR_KEEPERS).map(([r, k]) => [r, k.size])),
);

/** Keeper `spec` put together from `read(archive, record)` -> { width, height, data } (palette indices, frame 0).
 *  Answers the same shape at the spec's size. Pure. */
export function composeKeeper(spec, read) {
  const [w, height] = spec.size;
  const out = new Uint8Array(w * height);
  const body = read(...spec.body);
  const left = Math.floor((w - body.width) / 2),
    top = height - body.height;
  const lay = (src, [x0, y0, x1, y1], atX, atY) => {
    for (let y = y0; y < Math.min(y1, src.height); y++)
      for (let x = x0; x < Math.min(x1, src.width); x++) {
        const i = src.data[y * src.width + x],
          dx = left + atX + x - x0,
          dy = top + atY + y - y0;
        if (i && i !== MASK && dx >= 0 && dy >= 0 && dx < w && dy < height) out[dy * w + dx] = i;
      }
  };
  const inside = ([x0, y0, x1, y1], f) => {
    for (let y = Math.max(0, top + y0); y < Math.min(height, top + y1); y++)
      for (let x = Math.max(0, left + x0); x < Math.min(w, left + x1); x++) f(y * w + x);
  };
  lay(body, [0, 0, body.width, body.height], 0, 0);
  for (const rect of spec.clear ?? []) inside(rect, (p) => (out[p] = 0));
  for (const piece of spec.pieces ?? []) lay(read(...piece.from), piece.rect, piece.at[0], piece.at[1]);
  for (const swap of spec.swaps ?? [])
    inside(swap.rect, (p) => {
      if (out[p] && RAMP_OF(out[p]) === swap.from)
        out[p] = (swap.to << 4) | Math.min(15, (out[p] & 15) + (swap.darker ?? 0));
    });
  return { width: w, height, data: out };
}

/** Our keeper for 197 record `record`, top-down RGBA - or null where the record is none of ours. `art` reads the
 *  player's records (formats/classicPictures.js); a record their data lacks rejects, as any missing file does. */
export async function rrKeeperPicture(record, art) {
  const spec = RR_KEEPERS[record];
  if (!spec) return null;
  const records = [spec.body, ...(spec.pieces ?? []).map((piece) => piece.from)];
  const [bitmaps, palette] = await Promise.all([
    Promise.all(records.map(([a, r]) => art.bitmap(a, r, 0))),
    art.palette(),
  ]);
  if (bitmaps.some((b) => !b?.width)) throw new Error(`keeper ${record}: a record is not in the player's data`);
  const byKey = new Map(records.map(([a, r], i) => [`${a}_${r}`, bitmaps[i]]));
  const { width, height, data } = composeKeeper(spec, (a, r) => byKey.get(`${a}_${r}`));
  const rgba = new Uint8Array(width * height * 4);
  for (let p = 0; p < data.length; p++) {
    if (!data[p]) continue;
    const c = palette.get(data[p]);
    rgba.set([c.r, c.g, c.b, 255], p * 4);
  }
  return { width, height, data: rgba };
}
