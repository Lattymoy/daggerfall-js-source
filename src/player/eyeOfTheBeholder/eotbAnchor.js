// @ts-check
// OWN-AUDIT (2026-11-01; the owner: "no latching onto other mod authors"): WHERE A SPRITE STANDS, MEASURED ON ITS OWN
// PICTURES - the body's centre line on the player's spot and the lowest foot on the ground, in every facing and state, a
// sheet drawn small scaled to its view's standing figure. tools/eotbAnchors.mjs writes eotbAnchors.json from ARENA2.

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
  const sorted = [...values].sort((a, b) => a - b), half = sorted.length / 2;
  return sorted.length ? (sorted.length % 2 ? sorted[half - 0.5] : (sorted[half - 1] + sorted[half]) / 2) : null;
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
      const drawn = x < pic.width && opaque(pic, x, y);
      if (drawn && from < 0) from = x;
      if (!drawn && from >= 0) {
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
  let hash = 2166136261;
  for (let i = 0; i < pic.data.length; i++) hash = Math.imul(hash ^ pic.data[i], 16777619);
  return `${pic.width}x${pic.height}:${hash >>> 0}`;
};
const quarter = (/** @type {number} */ value) => Math.round(value * 4) / 4 || 0;

/** THE LAW OVER ONE SET, keyed by record: `frames` a record's pictures, `sheets` a sheet's first record (`Idle` the
 *  standing one; `Death...` never scaled). A view's records that share a picture are a family, and its pictures of one
 *  size share a canvas, registered as drawn: one shift, read off the first.
 *  @param {Map<number, Picture[]>} frames
 *  @param {Record<string, number>} sheets
 *  @returns {AnchorTable} */
export function measureSet(frames, sheets) {
  const stand = [0, 1, 2, 3, 4].map((view) => standingTall(frames.get(sheets.Idle + view)[0]));
  const scale = /** @type {Record<string, [number, number]>} */ ({}), shift = /** @type {Record<string, Shift|Shift[]>} */ ({});
  const short = /** @type {Map<number, [number, number]>} */ (new Map());
  for (const [name, base] of Object.entries(sheets)) {
    if (name.startsWith('Death')) continue;
    const votes = /** @type {[number, number][]} */ ([]);
    for (let view = 0; view < 5; view++)
      for (const pic of frames.get(base + view) ?? []) votes.push([figureTall(pic, bodyLine(pic, stand[view]), stand[view]), stand[view]]);
    votes.sort((a, b) => a[0] / a[1] - b[0] / b[1]);
    const mid = votes[(votes.length - 1) >> 1];
    if (mid && mid[0] / mid[1] < SHORT_SHEET) for (let view = 0; view < 5; view++) short.set(base + view, mid);
  }
  const records = [...frames.keys()].sort((a, b) => a - b);
  const head = new Map(records.map((record) => [record, record]));
  const family = (/** @type {number} */ record) => { while (head.get(record) !== record) record = head.get(record); return record; };
  const byPicture = new Map();
  for (const record of records) for (const pic of frames.get(record)) {
    const key = `${record % 5}|${sameKey(pic)}`;
    if (!byPicture.has(key)) byPicture.set(key, record);
    const a = family(byPicture.get(key)), b = family(record);
    if (a !== b) head.set(Math.max(a, b), Math.min(a, b));
  }
  const canvases = new Map(), canvasOf = (/** @type {number} */ record, /** @type {Picture} */ pic) => `${family(record)}:${pic.width}x${pic.height}`;
  for (const record of records) for (const pic of frames.get(record)) {
    const id = canvasOf(record, pic);
    if (!canvases.has(id)) canvases.set(id, { lead: pic, record, low: Infinity, shift: /** @type {Shift} */ ([0, 0]) });
    const canvas = canvases.get(id);
    canvas.low = Math.min(canvas.low, pic.height - 1 - feetRow(pic));
  }
  for (const canvas of canvases.values()) {
    const small = short.get(canvas.record), tall = small ? (stand[canvas.record % 5] * small[0]) / small[1] : stand[canvas.record % 5];
    canvas.shift = [quarter(canvas.lead.width / 2 - bodyLine(canvas.lead, tall)), -canvas.low || 0];
  }
  for (const record of records) {
    const own = frames.get(record).map((pic) => canvases.get(canvasOf(record, pic)).shift);
    shift[record] = own.every((one) => one === own[0]) ? own[0] : own;
    if (short.has(record)) scale[record] = short.get(record);
  }
  return { shift, scale };
}

/** A sprite's shift in `table` for `frame` - `{ right, up }` in its own pixels - or null where the law has none. */
export function anchorShift(/** @type {AnchorTable} */ table, /** @type {number} */ archive, /** @type {number} */ record, frame = 0) {
  const entry = table.shift[`${archive}_${record}`];
  if (!entry) return null;
  const [right, up] = Array.isArray(entry[0]) ? /** @type {Shift[]} */ (entry)[Math.min(Math.max(frame | 0, 0), entry.length - 1)] : /** @type {Shift} */ (entry);
  return { right, up };
}

/** The scale a record was drawn at against its view's standing figure (its pixels over the standing one's); 1 for a
 *  record drawn at the set's own. */
export function anchorScale(/** @type {AnchorTable} */ table, /** @type {number} */ archive, /** @type {number} */ record) {
  const drawnAt = table.scale[`${archive}_${record}`];
  return drawnAt ? drawnAt[0] / drawnAt[1] : 1;
}
