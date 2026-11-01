// EYE OF THE BEHOLDER'S SPRITES PLACED BY OUR OWN LAW. Runs src/player/eyeOfTheBeholder/eotbAnchor.js measureSet over
// every set's pictures, built from the player's ARENA2 (tools/lib/eotbPictures.mjs), and writes
// src/player/eyeOfTheBeholder/eotbAnchors.json. Never read from the author's table: the shifts and scales are what the
// law measures on Daggerfall's own frames and our death.
//
//   ARENA2_PATH=... node tools/eotbAnchors.mjs           write the table
//   ARENA2_PATH=... node tools/eotbAnchors.mjs --check   exit 1 if the table is not what the law measures
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';
import { eotbPictures, eotbHas } from './lib/eotbPictures.mjs';
import { measureSet } from '../src/player/eyeOfTheBeholder/eotbAnchor.js';
import { STATE_TABLES, ARCHIVE_FOOT, ARCHIVE_LYCAN, ARCHIVE_HORSE } from '../src/player/eyeOfTheBeholder/eotbBillboard.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ANCHORS_PATH = join(ROOT, 'src/player/eyeOfTheBeholder/eotbAnchors.json');
/** The sets: the sixteen on foot, the two lycanthropes, the five horses. */
export const ANCHOR_ARCHIVES = Object.freeze([...Array.from({ length: 23 }, (_, i) => ARCHIVE_FOOT + i)]);

/** A set's sheets by their plain names (`IdleHorse` is the horse's `Idle`), each its first record. */
export function sheetsOf(archive) {
  const suffix = archive >= ARCHIVE_HORSE ? 'Horse' : archive >= ARCHIVE_LYCAN ? 'Lycan' : '';
  const out = {};
  for (const [name, t] of Object.entries(STATE_TABLES)) {
    const own = suffix ? name.endsWith(suffix) : !name.endsWith('Horse') && !name.endsWith('Lycan');
    if (own) out[suffix ? name.slice(0, -suffix.length) : name] = t.base;
  }
  return out;
}

/** The whole table, measured on the pictures `picture(key)` builds (top-down RGBA). */
export async function buildAnchors(picture = eotbPictures().picture) {
  const shift = {}, scale = {};
  for (const archive of ANCHOR_ARCHIVES) {
    const sheets = sheetsOf(archive), frames = new Map();
    for (const base of Object.values(sheets))
      for (let v = 0; v < 5; v++) {
        const pics = [];
        for (let f = 0; eotbHas(`${archive}_${base + v}-${f}`); f++) pics.push(await picture(`${archive}_${base + v}-${f}`));
        if (pics.length) frames.set(base + v, pics);
      }
    const own = measureSet(frames, sheets);
    for (const [r, s] of Object.entries(own.shift)) shift[`${archive}_${r}`] = s;
    for (const [r, s] of Object.entries(own.scale)) scale[`${archive}_${r}`] = s;
  }
  return { shift, scale };
}

/** The table as the file holds it: one record a line, so a change to the law shows as the records it moved. */
export function formatAnchors({ shift, scale }) {
  const lines = (o) => Object.entries(o).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  return `{\n  "law": "src/player/eyeOfTheBeholder/eotbAnchor.js, written by tools/eotbAnchors.mjs from the player's ARENA2",\n  "scale": {\n${lines(scale)}\n  },\n  "shift": {\n${lines(shift)}\n  }\n}\n`;
}

if (isMain(import.meta.url)) {
  const text = formatAnchors(await buildAnchors());
  if (process.argv.includes('--check')) {
    const same = readFileSync(ANCHORS_PATH, 'utf8') === text;
    console.log(same ? 'eotbAnchors.json is what the law measures' : 'eotbAnchors.json differs from what the law measures');
    process.exit(same ? 0 : 1);
  }
  writeFileSync(ANCHORS_PATH, text);
  console.log(`wrote ${ANCHORS_PATH}`);
}
