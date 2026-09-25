#!/usr/bin/env node
// DS1 (2026-09-25): DETAILED SHIPS 1.0.0 (Cliffworms) - EVERY VENDORED
// FILE, OUT OF THE SHIPPED BUNDLE AND THE PLAYER'S OWN BLOCKS.BSA.
//
//   node tools/detailedShipsAssets.mjs <arena2> "<path-to>/detailed ships.dfmod" [outDir]
//
// Default outDir is vendor/detailed-ships. What it writes, and why each
// is what it is:
//
// - `WorldDataPatches/SHIPAA0x.RMB-<index>-building0.json` - the author's
//   edit of each ship's building record (formats/worldDataPatch.js); the
//   record itself is the player's classic block.
// - `Textures/derived.json` - the pictures that ARE classic records, or
//   classic records with the author's paint on them, as specs
//   (formats/derivedTexture.js). Each is found by measurement, not by a
//   list: every record of every TEXTURE file is tried at every offset
//   that keeps the picture on it, and a picture whose visible pixels a
//   record covers by DERIVED_SHARE or more is carried as that record plus
//   the pixels that differ. The rebuild is checked exact (visible pixels)
//   before anything is written.
// - `Textures/<name>.png` - the pictures no classic record is: the
//   author's own drawings (and the Kynareth statue the readme credits to
//   King of Worms and Zoran), re-encoded from the bundle's pixels.
// - `Textures/<name>.xml` - the scale files, the bundle's text verbatim.
// - `detailed-ships.dfmod.json` - the manifest, verbatim.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { isMain } from './lib/isMain.mjs';
import { readUnityBundle } from '../src/formats/unityBundle.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { classicRecordRgba, deriveSpec, composeDerivedPicture } from '../src/formats/derivedTexture.js';
import { makePatch, formatPatch } from './worldDataPatch.mjs';

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
      if (src.data[j + 3] !== 0 && src.data[j] === pic.data[i * 4] && src.data[j + 1] === pic.data[i * 4 + 1] && src.data[j + 2] === pic.data[i * 4 + 2] && pic.data[i * 4 + 3] === 255) same++;
    }
  }
  return same;
}

/** Every classic record, frame 0..n, as RGBA - the search space. */
function* classicRecords(arena2, palette) {
  for (const f of readdirSync(arena2).filter((n) => /^TEXTURE\.\d{3}$/i.test(n)).sort()) {
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

const sha = (b) => createHash('sha256').update(b).digest('hex');

/** Everything the vendor directory holds, as { path: bytes | string } - pure but for the two files it reads. */
export function detailedShipsAssets(arena2, bundleBytes) {
  const bundle = readUnityBundle(bundleBytes);
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(arena2, 'ART_PAL.COL'))));
  const blocks = new BlocksFile();
  if (!blocks.load(new Uint8Array(readFileSync(join(arena2, 'BLOCKS.BSA'))))) throw new Error('BLOCKS.BSA did not load');
  const out = {};
  const report = [];
  const text = (t) => (typeof t.text === 'string' ? t.text : Buffer.from(t.bytes).toString('utf8'));
  for (const t of bundle.textAssets) {
    if (/^SHIPAA0\d\.RMB-\d+-building\d+$/.test(t.name)) {
      const patch = makePatch(blocks, t.name, JSON.parse(text(t)));
      out[`WorldDataPatches/${t.name}.json`] = formatPatch(patch);
      report.push(`${t.name}: ${patch.ops.length} ops`);
    } else if (/^\d+_\d+-\d+$/.test(t.name)) {
      out[`Textures/${t.name}.xml`] = Buffer.from(t.bytes);
    } else if (/\.dfmod$/.test(t.name)) {
      out['detailed-ships.dfmod.json'] = Buffer.from(t.bytes);
    }
  }
  const records = [...classicRecords(arena2, palette)];
  const derived = {};
  for (const tex of bundle.textures.slice().sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))) {
    const { width, height, data } = tex.rgba();
    const pic = { width, height, data: new Uint8Array(data) };
    const src = findClassicSource(pic, records);
    if (src) {
      const spec = deriveSpec(src.frame ? [src.archive, src.record, src.frame] : [src.archive, src.record], pic, src.rgba, src.at);
      const back = composeDerivedPicture(spec, src.rgba);
      for (let i = 0; i < width * height; i++) {
        if (!visible(pic, i) && back.data[i * 4 + 3] === 0) continue;
        for (let k = 0; k < 4; k++) if (back.data[i * 4 + k] !== pic.data[i * 4 + k]) throw new Error(`${tex.name}: the derived rebuild differs at pixel ${i}`);
      }
      derived[tex.name] = spec;
      report.push(`${tex.name}: TEXTURE.${String(src.archive).padStart(3, '0')} record ${src.record}${src.frame ? ` frame ${src.frame}` : ''}${spec.at ? ` at ${spec.at}` : ''}, ${spec.edits?.length ?? 0} author pixels`);
    } else {
      const png = new PNG({ width, height });
      png.data = Buffer.from(pic.data);
      out[`Textures/${tex.name}.png`] = PNG.sync.write(png);
      report.push(`${tex.name}: the author's own picture (${width}x${height})`);
    }
  }
  const lines = Object.entries(derived).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  out['Textures/derived.json'] = `{\n${lines.join(',\n')}\n}\n`;
  return { out, report };
}

if (isMain(import.meta.url)) {
  const [arena2, bundlePath, outArg] = process.argv.slice(2);
  if (!arena2 || !bundlePath) {
    console.error('usage: node tools/detailedShipsAssets.mjs <arena2> "<path-to>/detailed ships.dfmod" [outDir]');
    process.exit(1);
  }
  const outDir = outArg ?? fileURLToPath(new URL('../vendor/detailed-ships/', import.meta.url));
  const { out, report } = detailedShipsAssets(arena2, new Uint8Array(readFileSync(bundlePath)));
  for (const line of report) console.log(`  ${line}`);
  for (const [path, body] of Object.entries(out)) {
    const full = join(outDir, path);
    mkdirSync(full.slice(0, full.lastIndexOf('/')), { recursive: true });
    writeFileSync(full, body);
    console.log(`  ${path}  ${typeof body === 'string' ? Buffer.byteLength(body) : body.length} bytes  sha256 ${sha(typeof body === 'string' ? Buffer.from(body) : body)}`);
  }
}
