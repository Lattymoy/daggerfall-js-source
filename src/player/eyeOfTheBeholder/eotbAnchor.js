// @ts-check
// OWN-AUDIT (2026-11-01; the owner: "no latching onto other mod authors"): WHERE A SPRITE STANDS, BY OUR OWN LAW.
// Eye Of The Beholder's author placed each record by a hand-tuned offset. Ours is measured on the pictures: the body's
// centre line stands on the player's spot and the lowest foot on the ground, in every facing and every state, and a
// sheet drawn small is scaled to its view's standing figure. tools/eotbAnchors.mjs runs it over the player's ARENA2 and
// writes eotbAnchors.json, which eotbSprite.js spriteOffset reads (bible/06-Systems/Eye-Of-The-Beholder.md OWN-AUDIT).

/** @typedef {{ width: number, height: number, data: ArrayLike<number> }} Picture top-down RGBA */
/** @typedef {[number, number]} Shift a picture's move, in its own pixels: right, and up (never up past the ground) */
/** @typedef {{ shift: Record<string, Shift|Shift[]>, scale: Record<string, [number, number]> }} AnchorTable */

/** The rows the body's centre line is read in: shares of the standing height above the feet, hips to chest. */
export const BODY_ROWS = Object.freeze([0.4, 0.7]);
/** A sheet is drawn small when its middle frame stands under this share of its view's standing figure. A taller
 *  reading is an arm or a weapon raised over the head, never a bigger drawing, so it is not scaled. */
export const SHORT_SHEET = 0.85;
/** figureTall's column: its half-width and the least a row holds to count, as shares of the standing height. */
const HEAD_WINDOW = 0.08;
const HEAD_LEAST = 0.035;

const opaque = (/** @type {Picture} */ pic, /** @type {number} */ x, /** @type {number} */ y) => pic.data[(y * pic.width + x) * 4 + 3] > 0;
const median = (/** @type {number[]} */ values) => {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

/** The lowest row with a drawn pixel, or -1 for an empty picture. */
export function feetRow(/** @type {Picture} */ pic) {
  for (let y = pic.height - 1; y >= 0; y--) for (let x = 0; x < pic.width; x++) if (opaque(pic, x, y)) return y;
  return -1;
}

/** THE BODY'S CENTRE LINE, in pixels from the picture's left edge: the median, over BODY_ROWS of `tall`, of the middle
 *  of each row's widest run. The widest run is the torso, so an arm or a blade held out moves it little. A picture too
 *  low to hold a chest (a body laid down) answers its own middle. */
export function bodyLine(/** @type {Picture} */ pic, /** @type {number} */ tall) {
  const feet = feetRow(pic), mids = [];
  if (feet - Math.round(BODY_ROWS[1] * tall) < 0) return pic.width / 2;
  for (let k = Math.round(BODY_ROWS[0] * tall); k <= Math.round(BODY_ROWS[1] * tall); k++) {
    const y = feet - k;
    if (y < 0) break;
    let best = -1, bestMid = 0, from = -1;
    for (let x = 0; x <= pic.width; x++) {
      const o = x < pic.width && opaque(pic, x, y);
      if (o && from < 0) from = x;
      if (!o && from >= 0) {
        if (x - from > best) { best = x - from; bestMid = (from + x) / 2; }
        from = -1;
      }
    }
    if (best > 0) mids.push(bestMid);
  }
  return median(mids) ?? pic.width / 2;
}

/** How tall the figure stands, in pixels: from the feet up the body's column (`line`) to the first row thinner than
 *  HEAD_LEAST of `tall`, which is the top of the head and not a blade held over it. */
export function figureTall(/** @type {Picture} */ pic, /** @type {number} */ line, /** @type {number} */ tall) {
  const feet = feetRow(pic), half = Math.max(2, Math.round(HEAD_WINDOW * tall)), least = Math.max(2, Math.round(HEAD_LEAST * tall));
  let top = feet - Math.round(BODY_ROWS[1] * tall);
  for (let y = top; y >= 0; y--) {
    let n = 0;
    for (let x = Math.round(line - half); x <= Math.round(line + half); x++) if (x >= 0 && x < pic.width && opaque(pic, x, y)) n++;
    if (n < least) break;
    top = y;
  }
  return feet - top + 1;
}

/** The standing figure's height in a view's idle picture: a first guess from its first row of three pixels, then
 *  figureTall on that guess. */
export function standingTall(/** @type {Picture} */ pic) {
  let first = 0;
  for (let y = 0; y < pic.height; y++) {
    let n = 0;
    for (let x = 0; x < pic.width && n < 3; x++) if (opaque(pic, x, y)) n++;
    if (n >= 3) { first = y; break; }
  }
  const guess = feetRow(pic) - first + 1;
  return figureTall(pic, bodyLine(pic, guess), guess);
}

const sameKey = (/** @type {Picture} */ pic) => {
  let h = 2166136261;
  for (let i = 0; i < pic.data.length; i++) h = Math.imul(h ^ pic.data[i], 16777619);
  return `${pic.width}x${pic.height}:${h >>> 0}`;
};
const quarter = (/** @type {number} */ v) => Math.round(v * 4) / 4 || 0;

/**
 * THE LAW OVER ONE SET. `frames` maps a record to its pictures, `sheets` a sheet's name to its first record (the five
 * views follow it); a sheet named `Death...` is not scaled, and `Idle` is the standing sheet. Records of one view that
 * hold the same picture are one family, and a family's pictures of one size share a canvas: the art is registered on
 * it, so its pictures share one shift, read off its first picture. Answers the set's part of an AnchorTable, keyed
 * by record.
 * @param {Map<number, Picture[]>} frames
 * @param {Record<string, number>} sheets
 * @returns {AnchorTable}
 */
export function measureSet(frames, sheets) {
  const stand = [0, 1, 2, 3, 4].map((v) => standingTall(frames.get(sheets.Idle + v)[0]));
  const scale = /** @type {Record<string, [number, number]>} */ ({}), shift = /** @type {Record<string, Shift|Shift[]>} */ ({});
  const short = /** @type {Map<number, [number, number]>} */ (new Map());
  for (const [name, base] of Object.entries(sheets)) {
    if (name.startsWith('Death')) continue;
    const votes = /** @type {[number, number][]} */ ([]);
    for (let v = 0; v < 5; v++) for (const p of frames.get(base + v) ?? []) votes.push([figureTall(p, bodyLine(p, stand[v]), stand[v]), stand[v]]);
    votes.sort((a, b) => a[0] / a[1] - b[0] / b[1]);
    const mid = votes[(votes.length - 1) >> 1];
    if (mid && mid[0] / mid[1] < SHORT_SHEET) for (let v = 0; v < 5; v++) short.set(base + v, mid);
  }
  const records = [...frames.keys()].sort((a, b) => a - b);
  const head = new Map(records.map((r) => [r, r]));
  const find = (/** @type {number} */ r) => { while (head.get(r) !== r) r = head.get(r); return r; };
  const byPicture = new Map();
  for (const r of records) for (const p of frames.get(r)) {
    const key = `${r % 5}|${sameKey(p)}`;
    if (!byPicture.has(key)) byPicture.set(key, r);
    const a = find(byPicture.get(key)), b = find(r);
    if (a !== b) head.set(Math.max(a, b), Math.min(a, b));
  }
  const canvases = new Map();
  for (const r of records) for (const p of frames.get(r)) {
    const id = `${find(r)}:${p.width}x${p.height}`;
    if (!canvases.has(id)) canvases.set(id, { lead: p, record: r, low: Infinity, shift: /** @type {Shift} */ ([0, 0]) });
    const c = canvases.get(id);
    c.low = Math.min(c.low, p.height - 1 - feetRow(p));
  }
  for (const c of canvases.values()) {
    const s = short.get(c.record), tall = s ? (stand[c.record % 5] * s[0]) / s[1] : stand[c.record % 5];
    c.shift = [quarter(c.lead.width / 2 - bodyLine(c.lead, tall)), -c.low || 0];
  }
  for (const r of records) {
    const own = frames.get(r).map((p) => canvases.get(`${find(r)}:${p.width}x${p.height}`).shift);
    shift[r] = own.every((s) => s === own[0]) ? own[0] : own;
    if (short.has(r)) scale[r] = short.get(r);
  }
  return { shift, scale };
}

/** A sprite's shift in `table` for `frame` - `{ right, up }` in its own pixels - or null where the law has none. */
export function anchorShift(/** @type {AnchorTable} */ table, /** @type {number} */ archive, /** @type {number} */ record, frame = 0) {
  const s = table.shift[`${archive}_${record}`];
  if (!s) return null;
  const [right, up] = Array.isArray(s[0]) ? /** @type {Shift[]} */ (s)[Math.min(Math.max(frame | 0, 0), s.length - 1)] : /** @type {Shift} */ (s);
  return { right, up };
}

/** The scale a record was drawn at against its view's standing figure (its pixels over the standing one's); 1 for a
 *  record drawn at the set's own. */
export function anchorScale(/** @type {AnchorTable} */ table, /** @type {number} */ archive, /** @type {number} */ record) {
  const s = table.scale[`${archive}_${record}`];
  return s ? s[0] / s[1] : 1;
}
