#!/usr/bin/env node
// NO-BETHESDA2 (2026-10-31; the owner: "ensuring they are not implemented"): A MOD'S PICTURES THAT ARE DAGGERFALL'S OWN
// LEAVE THE TREE. DEX0's law (Port-Doctrine, the fourth exception) for every picture folder: a picture whose drawn
// pixels are at least DERIVED_SHARE a classic record's, exactly, in ART_PAL or PAL.PAL, is not carried. It becomes a
// spec (formats/derivedTexture.js, with `pal`) built at runtime from the player's own TEXTURE file
// (formats/classicPictures.js); only the pixels the author changed ride along, as edits.
//
//   node tools/classicDerive.mjs --arena2 <ARENA2> --dir <folder> --out <derived.json> [--rci] [--remove]
//
// `--remove` deletes each derived picture's file. A later run with the files gone keeps the specs it already holds.
// `--rci` searches every RCI file's records too (Roleplay & Realism's buttons repaint BUTTONS.RCI): such a spec names
// its file, `{ rci: 'BUTTONS.RCI', from: [record, frame], ... }`.
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DFPalette } from '../src/formats/dfPalette.js';
import { CifRciFile } from '../src/formats/cifRciFile.js';
import { composeDerivedPicture, deriveSpec, classicRecordRgba } from '../src/formats/derivedTexture.js';
import { readPng } from './pngIO.mjs';
import { classicRecords, findClassicSource, DERIVED_SHARE } from './lib/classicSource.mjs';
import { keyOf } from './bethesdaScan.mjs';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PALETTES = Object.freeze(['PAL.PAL', 'ART_PAL.COL']);

/** Every record of every RCI file in `palette`, each tagged with its file (`rci`). */
export function* rciRecords(arena2, palette) {
  for (const f of readdirSync(arena2).filter((n) => /\.RCI$/i.test(n)).sort()) {
    const c = new CifRciFile(), name = f.toUpperCase();
    if (!c.load(new Uint8Array(readFileSync(join(arena2, f))), name, palette)) continue;
    for (let r = 0; r < c.recordCount; r++) {
      for (let fr = 0; fr < Math.max(1, c.getFrameCount(r)); fr++) {
        const bm = c.getDFBitmap(r, fr);
        if (bm?.width) yield { rci: name, record: r, frame: fr, rgba: classicRecordRgba(bm, palette) };
      }
    }
  }
}

/** Every classic record in both palettes, each tagged with its palette's name - the RCI files' too with `rci`. */
export function recordsInBothPalettes(arena2, { rci = false } = {}) {
  const out = [];
  for (const pal of PALETTES) {
    const p = new DFPalette();
    p.load(new Uint8Array(readFileSync(join(arena2, pal))), pal);
    for (const r of classicRecords(arena2, p)) out.push({ ...r, pal });
    if (rci) for (const r of rciRecords(arena2, p)) out.push({ ...r, pal });
  }
  return out;
}

/** The spec for one picture, or null when it is the author's own (under DERIVED_SHARE of it a record's). The exact
 *  copy is found by key first; the rest by findClassicSource (a record within a pixel of its size, at every offset). */
export function specFor(pic, records, exact) {
  const hit = exact.get(keyOf(pic));
  const best = hit ? { ...hit, at: [0, 0] } : findClassicSource(pic, records);
  if (!best) return null;
  const spec = deriveSpec(best.rci ? [best.record, best.frame] : [best.archive, best.record, best.frame], pic, best.rgba, best.at);
  const back = composeDerivedPicture(spec, best.rgba);
  for (let i = 0; i < pic.data.length; i += 4) {   // the spec is checked: built from the record, it is the picture
    if (pic.data[i + 3] === 0 && back.data[i + 3] === 0) continue;
    for (let c = 0; c < 4; c++) if (pic.data[i + c] !== back.data[i + c]) throw new Error(`spec does not rebuild its picture at byte ${i}`);
  }
  return best.rci ? { rci: best.rci, ...spec, pal: best.pal } : { ...spec, pal: best.pal };
}

/** The exact-copy index over `records`: drawn-pixel key -> record. */
export function exactIndex(records) {
  const out = new Map();
  for (const r of records) { const k = keyOf(r.rgba); if (k && !out.has(k)) out.set(k, r); }
  return out;
}

/** Every PNG under `dir` (recursive): name (basename, no extension) -> path. Names must be unique. */
export function picturesUnder(dir) {
  const out = new Map();
  for (const rel of readdirSync(dir, { recursive: true }).filter((n) => /\.png$/i.test(n)).sort()) {
    const name = basename(rel).replace(/\.png$/i, '');
    if (out.has(name)) throw new Error(`${name} stands twice under ${dir}`);
    out.set(name, join(dir, rel));
  }
  return out;
}

export function deriveFolder({ arena2, dir, prior = {}, rci = false, log = () => {} }) {
  const records = recordsInBothPalettes(arena2, { rci });
  const exact = exactIndex(records);
  const derived = { ...prior }, kept = [];
  for (const [name, path] of picturesUnder(dir)) {
    const spec = specFor(readPng(readFileSync(path)), records, exact);
    if (spec) derived[name] = spec; else kept.push(name);
  }
  log(`${Object.keys(derived).length} derived, ${kept.length} the authors' own`);
  return { derived: Object.fromEntries(Object.entries(derived).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), kept };
}

/** The file's text: one spec a line, so a diff shows which pictures moved. */
export const derivedText = (derived) => `{\n${Object.entries(derived).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`;

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const arena2 = opt('--arena2') ?? process.env.ARENA2_PATH, dir = opt('--dir'), out = opt('--out');
  if (!arena2 || !dir || !out) { console.error('usage: node tools/classicDerive.mjs --arena2 <ARENA2> --dir <folder> --out <derived.json> [--rci] [--remove]'); process.exit(2); }
  const prior = existsSync(resolve(ROOT, out)) ? JSON.parse(readFileSync(resolve(ROOT, out), 'utf8')) : {};
  const { derived } = deriveFolder({ arena2, dir: resolve(ROOT, dir), prior, rci: args.includes('--rci'), log: console.log });
  writeFileSync(resolve(ROOT, out), derivedText(derived));
  if (args.includes('--remove')) {
    let n = 0;
    for (const [name, path] of picturesUnder(resolve(ROOT, dir))) if (derived[name]) { unlinkSync(path); n++; }
    console.log(`removed ${n} pictures`);
  }
  console.log(`DERIVED_SHARE ${DERIVED_SHARE}: wrote ${out}`);
}
