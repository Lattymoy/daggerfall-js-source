#!/usr/bin/env node
// NO-BETHESDA (2026-10-31; the owner: "ensuring they are not implemented"): is any of Bethesda's Daggerfall data in the
// tree? The doctrine gate (test/tooling/doctrine.test.js) checks names and listings; this reads the bytes against the
// player's own ARENA2.
//
//   node tools/bethesdaScan.mjs --arena2 <ARENA2> [--json out.json] [--no-pictures]
//
// Three measures, every tracked file:
// - WHOLE: a file whose sha256 is an ARENA2 file's or a BSA record's.
// - EMBEDDED: a run of 64 bytes or more that is ARENA2's, found by 64-byte anchors every 1 KiB of the corpus (any run
//   of 1,088 bytes holds one), then grown both ways. Low-entropy anchors (padding, fills) are skipped.
// - PICTURES: every PNG decoded and set against every TEXTURE frame (ART_PAL and PAL.PAL), IMG and CIF/RCI frame: an
//   exact copy (at 1x to 4x, mirrored or not), or NEAR - box-scaled to a classic size, 80% of the drawn pixels within
//   48 of 765 of it - which is a repaint or a filtered upscale.
// Approved exceptions (Port-Doctrine's four) are reported apart. Anything else is a leak.

import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { BsaFile } from '../src/formats/bsaFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { ImgFile } from '../src/formats/imgFile.js';
import { CifRciFile } from '../src/formats/cifRciFile.js';
import { readPng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ANCHOR = 64;
export const STRIDE = 1024;
export const NEAR_SHARE = 0.8;
export const NEAR_DIFF = 48;

/** Port-Doctrine's approved exceptions to A RENDER OF GAME DATA IS GAME DATA, by directory. */
export const EXCEPTION_DIRS = Object.freeze([
  'public/art/vanilla-enhanced/', 'public/art/sands-of-the-alikr/', 'public/art/snowfall/',
  'vendor/layered-armor/', 'public/art/daggerfall-enemy-expansion-repainted/', 'vendor/class-skins/',
]);
export const inException = (path) => EXCEPTION_DIRS.some((d) => path.startsWith(d));

const sha = (b) => createHash('sha256').update(b).digest('hex');

/** Distinct byte values in a window: an anchor needs 20 or more. */
function busy(b, at) {
  const seen = new Uint8Array(256);
  let n = 0;
  for (let i = at; i < at + ANCHOR; i++) if (!seen[b[i]]++) n++;
  return n >= 20;
}

const BASE = 257;
let BASE_POW = 1;
for (let i = 0; i < ANCHOR - 1; i++) BASE_POW = Math.imul(BASE_POW, BASE);

function hashAt(b, at) {
  let h = 0;
  for (let i = at; i < at + ANCHOR; i++) h = (Math.imul(h, BASE) + b[i]) | 0;
  return h;
}

/** The ARENA2 byte corpus: every file, its sha256, every BSA record's sha256, and the anchor index. */
export function readCorpus(arena2) {
  const files = readdirSync(arena2).filter((n) => statSync(join(arena2, n)).isFile()).sort();
  const blobs = files.map((name) => ({ name, bytes: new Uint8Array(readFileSync(join(arena2, name))) }));
  const whole = new Map();
  for (const { name, bytes } of blobs) if (bytes.length >= ANCHOR) whole.set(sha(bytes), name);
  for (const { name, bytes } of blobs) {
    if (!/\.BSA$/i.test(name)) continue;
    let bsa;
    try { bsa = new BsaFile(bytes); } catch { continue; }
    for (let r = 0; r < bsa.count; r++) {
      const rec = bsa.getRecordBytes(r);
      if (rec && rec.length >= ANCHOR && !whole.has(sha(rec))) whole.set(sha(rec), `${name}:${bsa.getRecordName(r)}`);
    }
  }
  const anchors = new Map();
  const bloom = new Uint32Array(1 << 19);   // 2^24 bits
  for (let f = 0; f < blobs.length; f++) {
    const b = blobs[f].bytes;
    for (let at = 0; at + ANCHOR <= b.length; at += STRIDE) {
      if (!busy(b, at)) continue;
      const h = hashAt(b, at);
      const k = h >>> 8;
      bloom[k >>> 5] |= 1 << (k & 31);
      (anchors.get(h) ?? anchors.set(h, []).get(h)).push([f, at]);
    }
  }
  return { blobs, whole, anchors, bloom };
}

/** The runs of `bytes` that are the corpus's, each `{ at, length, source, sourceAt }`, longest-first per region. */
export function embeddedRuns(bytes, corpus) {
  const { blobs, anchors, bloom } = corpus;
  const runs = [];
  if (bytes.length < ANCHOR) return runs;
  let h = hashAt(bytes, 0);
  let skipTo = 0;
  for (let i = 0; ; i++) {
    if (i >= skipTo) {
      const k = h >>> 8;
      if (bloom[k >>> 5] & (1 << (k & 31))) {
        const hits = anchors.get(h);
        if (hits) {
          for (const [f, at] of hits) {
            const s = blobs[f].bytes;
            let same = true;
            for (let j = 0; j < ANCHOR; j++) if (s[at + j] !== bytes[i + j]) { same = false; break; }
            if (!same) continue;
            let back = 0;
            while (i - back > 0 && at - back > 0 && s[at - back - 1] === bytes[i - back - 1]) back++;
            let fwd = ANCHOR;
            while (i + fwd < bytes.length && at + fwd < s.length && s[at + fwd] === bytes[i + fwd]) fwd++;
            const run = { at: i - back, length: back + fwd, source: blobs[f].name, sourceAt: at - back };
            const last = runs[runs.length - 1];
            if (last && run.at < last.at + last.length) { if (run.length > last.length) runs[runs.length - 1] = run; } else runs.push(run);
            skipTo = run.at + run.length;
            break;
          }
        }
      }
    }
    if (i + ANCHOR >= bytes.length) break;
    h = (Math.imul(h - Math.imul(bytes[i], BASE_POW), BASE) + bytes[i + ANCHOR]) | 0;
  }
  return runs;
}

// ---- pictures ----

const rgbaOf = (bm, pal) => {
  const { width, height } = bm;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = bm.data[i];
    data[i * 4] = pal.getRed(idx); data[i * 4 + 1] = pal.getGreen(idx); data[i * 4 + 2] = pal.getBlue(idx);
    data[i * 4 + 3] = idx === 0 ? 0 : 255;
  }
  return { width, height, data };
};

/** Every classic picture of the corpus: TEXTURE frames in ART_PAL and PAL.PAL, IMG, CIF and RCI frames. */
export function* classicPictures(arena2) {
  const pal = (n) => { const p = new DFPalette(); p.load(new Uint8Array(readFileSync(join(arena2, n))), n); return p; };
  const art = pal('ART_PAL.COL'), game = pal('PAL.PAL');
  const pals = new Map([['ART_PAL.COL', art], ['PAL.PAL', game]]);
  const palNamed = (n) => { if (!pals.has(n)) { try { pals.set(n, pal(n)); } catch { pals.set(n, art); } } return pals.get(n); };
  for (const f of readdirSync(arena2).sort()) {
    const F = f.toUpperCase();
    const bytes = () => new Uint8Array(readFileSync(join(arena2, f)));
    if (/^TEXTURE\.\d{3}$/.test(F)) {
      for (const [pn, p] of [['ART_PAL', art], ['PAL', game]]) {
        const t = new TextureFile();
        if (!t.load(bytes(), F, p)) continue;
        for (let r = 0; r < t.recordCount; r++) {
          for (let fr = 0; fr < Math.max(1, t.getFrameCount(r)); fr++) {
            const bm = t.getDFBitmap(r, fr);
            if (bm?.width) yield { from: `${F} record ${r} frame ${fr} (${pn})`, rgba: rgbaOf(bm, p) };
          }
        }
      }
    } else if (/\.IMG$/.test(F)) {
      const im = new ImgFile();
      if (!im.load(bytes(), F, pal('ART_PAL.COL'))) continue;   // its own copy: a palettized IMG reads its palette into it
      const p = im.isPalettized ? null : palNamed(im.paletteName);
      if (p) im.palette = p;
      const bm = im.getDFBitmap(0, 0);
      if (bm?.width) yield { from: F, rgba: rgbaOf(bm, bm.palette ?? p ?? art) };
    } else if (/\.(CIF|RCI)$/.test(F)) {
      for (const [pn, p] of [['ART_PAL', art], ['PAL', game]]) {
        const c = new CifRciFile();
        if (!c.load(bytes(), F, p)) continue;
        for (let r = 0; r < c.recordCount; r++) {
          for (let fr = 0; fr < Math.max(1, c.getFrameCount(r)); fr++) {
            let bm;
            try { bm = c.getDFBitmap(r, fr); } catch { continue; }
            if (bm?.width) yield { from: `${F} record ${r} frame ${fr} (${pn})`, rgba: rgbaOf(bm, p) };
          }
        }
      }
    }
  }
}

/** A picture's key: its size and the sha256 of its drawn pixels (a clear pixel is clear whatever colour sits under it). */
export function keyOf(p, mirrored = false) {
  const { width: w, height: h, data } = p;
  const d = Buffer.alloc(w * h * 4);
  let drawn = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + (mirrored ? w - 1 - x : x)) * 4, o = (y * w + x) * 4;
      if (data[i + 3] === 0) continue;
      d[o] = data[i]; d[o + 1] = data[i + 1]; d[o + 2] = data[i + 2]; d[o + 3] = 255; drawn++;
    }
  }
  return drawn < 16 ? null : `${w}x${h}:${sha(d)}`;
}

/** The picture `p` drawn at 1/k by nearest - null unless every k x k block is one colour (a nearest upscale). */
export function nearestDown(p, k) {
  const { width: W, height: H, data } = p;
  if (W % k || H % k) return null;
  const w = W / k, h = H / k, out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((y * k) * W + x * k) * 4;
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const t = ((y * k + dy) * W + x * k + dx) * 4;
          for (let c = 0; c < 4; c++) if (data[t + c] !== data[s + c] && !(c < 3 && data[t + 3] === 0 && data[s + 3] === 0)) return null;
        }
      }
      out.set(data.subarray(s, s + 4), (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data: out };
}

/** The picture `p` box-averaged down by k: a cell is drawn when half its pixels are. */
export function boxDown(p, k) {
  const { width: W, height: H, data } = p;
  const w = W / k, h = H / k, out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const t = ((y * k + dy) * W + x * k + dx) * 4;
          if (data[t + 3] < 128) continue;
          r += data[t]; g += data[t + 1]; b += data[t + 2]; n++;
        }
      }
      const o = (y * w + x) * 4;
      if (n * 2 >= k * k) { out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255; }
    }
  }
  return { width: w, height: h, data: out };
}

const THUMB = 8;
/** An 8 x 8 thumbnail: each cell's mean colour and drawn share, for a cheap first look. */
export function thumbOf(p) {
  const { width: w, height: h, data } = p;
  const t = new Float32Array(THUMB * THUMB * 4), n = new Float32Array(THUMB * THUMB);
  for (let y = 0; y < h; y++) {
    const cy = Math.min(THUMB - 1, (y * THUMB / h) | 0);
    for (let x = 0; x < w; x++) {
      const c = cy * THUMB + Math.min(THUMB - 1, (x * THUMB / w) | 0), i = (y * w + x) * 4;
      n[c]++;
      if (data[i + 3] < 128) continue;
      t[c * 4] += data[i]; t[c * 4 + 1] += data[i + 1]; t[c * 4 + 2] += data[i + 2]; t[c * 4 + 3]++;
    }
  }
  for (let c = 0; c < THUMB * THUMB; c++) {
    const d = t[c * 4 + 3];
    if (d) { t[c * 4] /= d; t[c * 4 + 1] /= d; t[c * 4 + 2] /= d; }
    t[c * 4 + 3] = n[c] ? d / n[c] : 0;
  }
  return t;
}

const thumbFar = (a, b) => {
  let s = 0;
  for (let c = 0; c < THUMB * THUMB; c++) {
    const da = a[c * 4 + 3], db = b[c * 4 + 3];
    s += Math.abs(da - db) * 255;
    if (da > 0.5 && db > 0.5) s += (Math.abs(a[c * 4] - b[c * 4]) + Math.abs(a[c * 4 + 1] - b[c * 4 + 1]) + Math.abs(a[c * 4 + 2] - b[c * 4 + 2])) / 3;
  }
  return s / (THUMB * THUMB);
};

/** The share of the union of drawn pixels where `a` and `b` (one size) agree within NEAR_DIFF, mirrored or not. */
export function nearShare(a, b, mirrored = false) {
  const { width: w, height: h } = a;
  let both = 0, either = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, j = (y * w + (mirrored ? w - 1 - x : x)) * 4;
      const p = a.data[i + 3] >= 128, q = b.data[j + 3] >= 128;
      if (!(p || q)) continue;
      either++;
      if (p && q && Math.abs(a.data[i] - b.data[j]) + Math.abs(a.data[i + 1] - b.data[j + 1]) + Math.abs(a.data[i + 2] - b.data[j + 2]) <= NEAR_DIFF) both++;
    }
  }
  return either ? both / either : 0;
}

/** The classic index of the player's ARENA2. */
export const classicIndex = (arena2) => pictureIndex(classicPictures(arena2));

/** An index of `{ from, rgba }` pictures: exact keys, and per size the pictures with their thumbnails. */
export function pictureIndex(pictures) {
  const exact = new Map(), bySize = new Map();
  let count = 0;
  for (const c of pictures) {
    count++;
    const k = keyOf(c.rgba);
    if (!k) continue;
    if (!exact.has(k)) exact.set(k, c.from);
    const s = `${c.rgba.width}x${c.rgba.height}`;
    if (c.rgba.width * c.rgba.height < 64) continue;
    (bySize.get(s) ?? bySize.set(s, []).get(s)).push({ from: c.from, rgba: c.rgba, thumb: thumbOf(c.rgba) });
  }
  return { exact, bySize, count };
}

/** What one picture is of the corpus: `{ kind: 'exact' | 'near', from, scale, mirrored, share }`, or null. `near`
 *  false asks for exact copies only. */
export function matchPicture(pic, index, { near = true } = {}) {
  for (const k of [1, 2, 3, 4]) {
    const down = k === 1 ? pic : nearestDown(pic, k);
    if (!down) continue;
    for (const mirrored of [false, true]) {
      const key = keyOf(down, mirrored);
      if (key && index.exact.has(key)) return { kind: 'exact', from: index.exact.get(key), scale: k, mirrored, share: 1 };
    }
  }
  if (!near) return null;
  let best = null;
  for (const k of [1, 2, 3, 4]) {
    if (pic.width % k || pic.height % k) continue;
    const peers = index.bySize.get(`${pic.width / k}x${pic.height / k}`);
    if (!peers) continue;
    const down = k === 1 ? pic : boxDown(pic, k);
    const t = thumbOf(down);
    const tm = thumbOf({ ...down, data: mirrorData(down) });
    for (const c of peers) {
      for (const [mirrored, tt] of [[false, t], [true, tm]]) {
        if (thumbFar(tt, c.thumb) > 40) continue;
        const share = nearShare(down, c.rgba, mirrored);
        if (share >= NEAR_SHARE && (!best || share > best.share)) best = { kind: 'near', from: c.from, scale: k, mirrored, share };
        if (best?.share >= 0.95) return best;   // a repaint this close needs no closer one
      }
    }
  }
  return best;
}

function mirrorData(p) {
  const { width: w, height: h, data } = p, out = new Uint8Array(data.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set(data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (y * w + w - 1 - x) * 4);
  return out;
}

// ---- the scan ----

export function trackedFiles(root = ROOT) {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\0').filter(Boolean);
}

export function scan({ arena2, root = ROOT, pictures = true, files = trackedFiles(root), log = () => {} }) {
  log(`reading ARENA2 at ${arena2}`);
  const corpus = readCorpus(arena2);
  log(`${corpus.blobs.length} files, ${corpus.whole.size} whole hashes, ${corpus.anchors.size} anchors`);
  const whole = [], embedded = [], pics = [], unreadable = [];
  const index = pictures ? classicIndex(arena2) : null;
  if (index) log(`${index.count} classic pictures, ${index.exact.size} exact keys`);
  let done = 0, pngSeen = 0;
  const exceptionPictures = new Map();
  for (const path of files) {
    if (++done % 2000 === 0) log(`${done}/${files.length}`);
    let bytes;
    try { bytes = new Uint8Array(readFileSync(join(root, path))); } catch { continue; }
    const h = sha(bytes);
    if (corpus.whole.has(h)) whole.push({ path, source: corpus.whole.get(h), exception: inException(path) });
    const runs = embeddedRuns(bytes, corpus);
    if (runs.length) {
      const total = runs.reduce((s, r) => s + r.length, 0);
      const sources = [...new Set(runs.map((r) => r.source))];
      embedded.push({ path, runs: runs.length, bytes: total, longest: Math.max(...runs.map((r) => r.length)), sources, first: runs[0], exception: inException(path) });
    }
    if (index && /\.png$/i.test(path)) {
      let pic;
      try { pic = readPng(bytes); } catch (e) { unreadable.push({ path, why: e.message }); continue; }
      if (pic.width * pic.height > 4096 * 4096) continue;
      // An approved exception is known to be derived: every picture is checked for an exact copy, one in ten for a
      // near one (the measure's own check that it sees a repaint). Everywhere else, every picture gets both.
      const ex = inException(path);
      const sampled = ex && (pngSeen++ % 10 !== 0);
      const m = matchPicture(pic, index, { near: !sampled });
      if (m) pics.push({ path, ...m, exception: ex });
      if (ex) exceptionPictures.set(path, sampled);
    }
  }
  const nearChecked = [...exceptionPictures.values()].filter((s) => !s).length;
  return { arena2Files: corpus.blobs.length, scanned: files.length, whole, embedded, pictures: pics, unreadable,
    exceptionPictures: { total: exceptionPictures.size, nearChecked } };
}

/** The report grouped by directory: `{ dir: { whole, embedded, exact, near, exception } }`. */
export function byDirectory(report, depth = 3) {
  const out = {};
  const dirOf = (p) => p.split('/').slice(0, Math.min(depth, p.split('/').length - 1)).join('/') + '/';
  const add = (p, k) => { const d = dirOf(p.path); out[d] ??= { whole: 0, embedded: 0, exact: 0, near: 0, exception: inException(p.path) }; out[d][k]++; };
  for (const w of report.whole) add(w, 'whole');
  for (const e of report.embedded) add(e, 'embedded');
  for (const p of report.pictures) add(p, p.kind);
  return out;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const arena2 = opt('--arena2') ?? process.env.ARENA2_PATH;
  if (!arena2) { console.error('usage: node tools/bethesdaScan.mjs --arena2 <ARENA2> [--json out.json] [--no-pictures]'); process.exit(2); }
  const t0 = Date.now();
  const report = scan({ arena2, pictures: !args.includes('--no-pictures'), log: (s) => console.error(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`) });
  const out = opt('--json');
  if (out) writeFileSync(out, JSON.stringify(report, null, 1));
  const dirs = byDirectory(report);
  const leaks = Object.entries(dirs).filter(([, d]) => !d.exception);
  console.log(`scanned ${report.scanned} tracked files against ${report.arena2Files} ARENA2 files`);
  console.log(`whole ${report.whole.length}, embedded ${report.embedded.length}, pictures ${report.pictures.length} (exact ${report.pictures.filter((p) => p.kind === 'exact').length}), unreadable PNGs ${report.unreadable.length}`);
  for (const [d, c] of Object.entries(dirs).sort()) console.log(`${c.exception ? 'EXCEPTION' : 'FINDING  '} ${d} whole=${c.whole} embedded=${c.embedded} exact=${c.exact} near=${c.near}`);
  process.exit(leaks.length ? 1 : 0);
}
