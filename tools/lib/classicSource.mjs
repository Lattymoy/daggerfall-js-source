// IS A MOD'S PICTURE ONE OF DAGGERFALL'S OWN? The search the extract tools put every picture through before it may ship:
// a picture a classic record covers is game data and is rebuilt from the player's ARENA2 (formats/derivedTexture.js),
// never carried. Every record of every TEXTURE file within a pixel of the picture's size is laid at every offset that
// keeps it on the picture, and the best exact match of the picture's visible pixels is the answer.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TextureFile } from '../../src/formats/textureFile.js';
import { classicRecordRgba } from '../../src/formats/derivedTexture.js';

/** A picture is a classic record's when the record covers at least this share of its visible pixels exactly. */
export const DERIVED_SHARE = 0.6;

const visible = (pic, i) => pic.data[i * 4 + 3] !== 0;

/** How many of `pic`'s visible pixels `src` placed at (ax, ay) matches exactly. */
function coverage(pic, src, ax, ay) {
  let same = 0;
  for (let y = 0; y < pic.height; y++) {
    const sy = y - ay;
    for (let x = 0; x < pic.width; x++) {
      const i = y * pic.width + x;
      if (!visible(pic, i)) continue;
      const sx = x - ax;
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const j = (sy * src.width + sx) * 4;
      if (
        src.data[j + 3] !== 0 &&
        src.data[j] === pic.data[i * 4] &&
        src.data[j + 1] === pic.data[i * 4 + 1] &&
        src.data[j + 2] === pic.data[i * 4 + 2] &&
        pic.data[i * 4 + 3] === 255
      )
        same++;
    }
  }
  return same;
}

/** Every classic record, frame 0..n, as RGBA - the search space. */
export function* classicRecords(arena2, palette) {
  for (const f of readdirSync(arena2)
    .filter((n) => /^TEXTURE\.\d{3}$/i.test(n))
    .sort()) {
    const t = new TextureFile();
    if (!t.load(new Uint8Array(readFileSync(join(arena2, f))), f.toUpperCase(), palette)) continue;
    for (let r = 0; r < t.recordCount; r++) {
      const frames = Math.max(1, t.getFrameCount(r));
      for (let fr = 0; fr < frames; fr++) {
        const bm = t.getDFBitmap(r, fr);
        if (bm?.width) yield { archive: t.archive, record: r, frame: fr, rgba: classicRecordRgba(bm, palette) };
      }
    }
  }
}

/** The best classic source for a picture, or null: records within one pixel of its size, at every offset that keeps them on it. */
export function findClassicSource(pic, records) {
  let visibleCount = 0;
  for (let i = 0; i < pic.width * pic.height; i++) if (visible(pic, i)) visibleCount++;
  let best = null;
  for (const c of records) {
    const { width: w, height: h } = c.rgba;
    if (Math.abs(w - pic.width) > 1 || Math.abs(h - pic.height) > 1) continue;
    for (let ay = Math.min(0, pic.height - h); ay <= Math.max(0, pic.height - h); ay++) {
      for (let ax = Math.min(0, pic.width - w); ax <= Math.max(0, pic.width - w); ax++) {
        const same = coverage(pic, c.rgba, ax, ay);
        if (!best || same > best.same) best = { ...c, at: [ax, ay], same };
      }
    }
  }
  return best && best.same >= DERIVED_SHARE * visibleCount ? best : null;
}
