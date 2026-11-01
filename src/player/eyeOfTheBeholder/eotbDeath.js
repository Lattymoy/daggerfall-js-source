// @ts-check
// THE BODY'S DEATH, OURS. Eye Of The Beholder 2.1's death table (records 10-14, two frames, the five views) was the
// author's own drawing on 166 of its sprites. Ours is built from the player's ARENA2: the first frame is Daggerfall's
// own record of the set's class struck (its TEXTURE's records 10-14, the werewolf's and the wereboar's too), the second
// that same picture laid on the ground by our code, a shadow of our painter's under it. The keys, the frames and the
// views are the mod's.
import { createPainter, ellipse } from '../../art/ownPainter.js';

/** The death table's records and frames, and the sets whose death is drawn so (the on-foot sixteen, the two lycans). */
export const DEATH_BASE = 10;
export const DEATH_FRAMES = 2;
export const DEATH_ARCHIVES = Object.freeze({ from: 112364, to: 112381 });

/**
 * The spec of an own death sprite `key` (`<archive>_<record>-<frame>`), given `specs` (eotbDerived.json): frame 0 is
 * the class's struck record (`{ from, pal }`, Daggerfall's record alone), frame 1 that record laid down (`laid` its
 * view). Null for any other key, and for a key eotbDerived.json names itself. The class and palette are the set's idle's.
 */
export function deathSpec(/** @type {string} */ key, /** @type {Record<string, { from: number[], pal?: string }>} */ specs) {
  const parts = /^(\d+)_(\d+)-(\d+)$/.exec(key);
  if (!parts || Object.hasOwn(specs, key)) return null;
  const [archive, record, frame] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (archive < DEATH_ARCHIVES.from || archive > DEATH_ARCHIVES.to) return null;
  const view = record - DEATH_BASE;
  if (view < 0 || view > 4 || frame >= DEATH_FRAMES) return null;
  const idle = specs[`${archive}_${view}-0`];
  if (!idle) return null;
  const base = { from: [idle.from[0], DEATH_BASE + view, 0], pal: idle.pal };
  return frame === 0 ? base : { ...base, laid: view };
}

/** Every own death key for `specs`: each set's records 10-14, frames 0 and 1, that eotbDerived.json does not name. */
export function ownDeathKeys(/** @type {Record<string, { from: number[], pal?: string }>} */ specs) {
  const out = [];
  for (let archive = DEATH_ARCHIVES.from; archive <= DEATH_ARCHIVES.to; archive++)
    for (let view = 0; view < 5; view++)
      for (let frame = 0; frame < DEATH_FRAMES; frame++) {
        const key = `${archive}_${DEATH_BASE + view}-${frame}`;
        if (deathSpec(key, specs)) out.push(key);
      }
  return out;
}

/** How a fallen body is drawn, by view. From the front and the back it lies toward the eye, feet first: kept as drawn,
 *  its height foreshortened to `run`. From the side and the quarters it lies across the view, its head to the left:
 *  turned, its height along the ground by `run`, its width as its depth by `deep` (the eye looks down on it). */
export const LAID = Object.freeze([
  Object.freeze({ turn: false, run: 0.34, deep: 1 }),
  Object.freeze({ turn: true, run: 0.8, deep: 0.6 }),
  Object.freeze({ turn: true, run: 0.95, deep: 0.58 }),
  Object.freeze({ turn: true, run: 0.8, deep: 0.6 }),
  Object.freeze({ turn: false, run: 0.34, deep: 1 }),
]);
/** Rows of shadow below the body, and how dark it is. */
const SHADOW_ROWS = 3;
const SHADOW = Object.freeze([14, 11, 10]);

/** THE STRUCK BODY LAID DOWN, PURE: `pic` (top-down RGBA, standing) on the ground as LAID[view] says, on a shadow of our
 *  painter's. Mirrored views mirror it. */
export function layDown(/** @type {{width:number,height:number,data:Uint8Array|Uint8ClampedArray}} */ pic, /** @type {number} */ view) {
  const { turn, run, deep } = LAID[view] ?? LAID[2];
  const { width: w, height: tall, data: src } = pic;
  // the body's own box, so the turn is about what is drawn and not the record's empty margin
  let x0 = w,
    x1 = -1,
    y0 = tall,
    y1 = -1;
  for (let y = 0; y < tall; y++)
    for (let x = 0; x < w; x++)
      if (src[(y * w + x) * 4 + 3]) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return { width: 1, height: 1, data: new Uint8Array(4) };
  const bodyWide = x1 - x0 + 1,
    bodyTall = y1 - y0 + 1;
  // the laid picture's size: across the view by along it
  const across = Math.max(1, Math.round(turn ? bodyTall * run : bodyWide * deep)),
    along = Math.max(1, Math.round(turn ? bodyWide * deep : bodyTall * run));
  const rows = along + SHADOW_ROWS;
  const painter = createPainter(across, rows);
  painter.fill(ellipse(across / 2, along - 0.5, across / 2 + 1, SHADOW_ROWS + 1), SHADOW, { flat: true });
  for (let y = 0; y < rows; y++) for (let x = 0; x < across; x++) if ((x + y) & 1) painter.set(x, y, null);
  const out = painter.data;
  for (let y = 0; y < along; y++) {
    for (let x = 0; x < across; x++) {
      // turned: x runs from the head (the picture's top) to the feet, y across the body's width; else the picture as
      // drawn, its rows foreshortened
      const fromY = y0 + Math.min(bodyTall - 1, Math.floor((turn ? x / across : y / along) * bodyTall)),
        fromX = x0 + Math.min(bodyWide - 1, Math.floor((turn ? y / along : x / across) * bodyWide));
      const from = (fromY * w + fromX) * 4;
      if (!src[from + 3]) continue;
      const to = (y * across + x) * 4;
      out[to] = src[from];
      out[to + 1] = src[from + 1];
      out[to + 2] = src[from + 2];
      out[to + 3] = 255;
    }
  }
  return { width: across, height: rows, data: out };
}
