#!/usr/bin/env node
// BET1 (2026-10-05): BETONY RESTORED 1.1.3 (Cliffworms) - EVERY VENDORED FILE, OUT OF THE SHIPPED ARCHIVE AND THE
// PLAYER'S OWN ARENA2.
//
//   node tools/betonyRestoredAssets.mjs <arena2> <unzipped archive dir> [outDir]
//
// The archive (`Betony_Restored-515-1-1-3-1775279968.zip`) holds three things: `Mods/betony restored.dfmod` (the
// bundle), `Docs/Readme_BetonyRestored.txt` and `FlatReplacements/BetonyRestoredFlatReplacements.json` (six rules for
// Flat Replacer, a peer mod). Default outDir is vendor/betony-restored. What it writes, and why each is what it is:
//
// - `WorldDataPack/betony-restored.pack.json.gz` - the 25 new locations (the author's own records, carried whole: no
//   classic location is one) and the fourteen new blocks (each an edit of its classic namesake - WALLAA00Betony of
//   WALLAA00), WD3's pack, every file rebuilt sha256 for sha256 before it is written (tools/worldDataPackBuild.mjs);
// - `roads.json` - the map pixels where the bundle's roadData and trackData differ from Basic Roads' own
//   (vendor/roads-hazelnut), which the bundle's replace while the mod is loaded (ModManager.TryGetAsset asks the mods
//   loaded last first): Betony's roads, carried as the bytes that change;
// - `Textures/derived.json` - the pictures that ARE Daggerfall's: a classic record (moved to the mod's own archive, or
//   with the author's paint on it - Ralzar's extinguished lights with the flame taken out), or several classic records
//   stood together on the author's shelf. As WD2 specs (formats/derivedTexture.js): the classic records are the
//   player's own, the author's pixels ship. MEASURED, never listed - `classifyPicture` below;
// - `Textures/reshaded.json` - the pictures that are a classic record RE-SHADED whole (the rest of Ralzar's lights: the
//   record's own outline, most of its pixels recoloured). Port-Doctrine's own case - "a re-shaded sprite that keeps the
//   original silhouette" is game data - so neither the picture nor its pixels as edits ship: the record each re-shades
//   is named, the player's own copy of the mod answers first, and the classic record stands in;
// - `Textures/<name>.png` - the pictures no classic record is: Cliffworms' own bottles, Kamer's sitting patrons and the
//   Mara statue (WilhelmBlack and King of Worms), each credited by the readme;
// - `Textures/<name>.xml` - the scale file of each picture this directory carries, verbatim;
// - `betony-restored.files.json` - every file written under Textures/, the listing the doctrine's gate reads (AUDIT
//   BET1 D1);
// - `betony-restored.dfmod.json`, `Readme_BetonyRestored.txt`, `FlatReplacements/BetonyRestoredFlatReplacements.json`
//   - verbatim; `BetonyRestored.dll` - the compiled script byte for byte (the bundle carries no C# source; its IL is
//   dumped by tools/ilDump.py into `il/`).
//
// Not carried, by name and why (BETONY_NOT_CARRIED); and the pictures Detailed Ships already carries, identical pixel
// for pixel, are that mod's pictures shared (systems/detailedShips.js shareDetailedShipsArt), not a second copy.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';
import { isMain } from './lib/isMain.mjs';
import { readUnityBundle } from '../src/formats/unityBundle.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { composeDerivedPicture, deriveSpec } from '../src/formats/derivedTexture.js';
import { classicRecords, findClassicSource } from './detailedShipsAssets.mjs';
import { buildPack } from './worldDataPackBuild.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const BUNDLE = 'Mods/betony restored.dfmod';
export const README = 'Docs/Readme_BetonyRestored.txt';
export const FLAT_REPLACEMENTS = 'FlatReplacements/BetonyRestoredFlatReplacements.json';

/** The bundle's pictures the port does not carry, by name, and why. */
export const BETONY_NOT_CARRIED = Object.freeze({
  'BasicRoads-paths': 'Basic Roads\' own travel-map picture of the paths, with Betony\'s drawn in: Hazelnut\'s picture, and the port draws the paths off the arrays (roads.json carries Betony\'s)',
  '1200_14-0': 'StarMadeKnight\'s "Wealthy Woman", the RMB Resource Pack\'s (its catalogue names it; this is twice the pack\'s size) - not this author\'s, not credited by the readme, and WD3 carries nothing of the pack; a classic stand-in takes its place',
  '1200_15-0': 'StarMadeKnight\'s "Wealthy Helmeted Man", the RMB Resource Pack\'s - placed by no block of the mod',
  '1200_17-0': 'StarMadeKnight\'s "Hooded Man", the RMB Resource Pack\'s - a repaint over Daggerfall\'s own 186_16 (the same figure: silhouette IoU 0.94), and placed by no block of the mod',
  '1200_19-0': 'StarMadeKnight\'s "Armored Woman", the RMB Resource Pack\'s - a classic stand-in takes its place',
});

/** A picture is a classic record's re-shade when a record of exactly its size covers every visible pixel but this
 *  many (Ralzar's extinguished lights: the record's own outline, the flame taken out, the glass darkened)... */
export const RESHADE_OWN_PIXELS = 4;
/** ...and the record's own visible pixels outside the picture (the flame taken out) are at most this share of it. */
export const RESHADE_CUT_SHARE = 0.5;
/** A further classic record on one picture (the shelves): it must lend this many of the picture's pixels, and this share
 *  of its own visible pixels, exactly - a few matching pixels of a wall texture are a coincidence, a whole bottle is not. */
export const LAYER_MIN_PIXELS = 24;
export const LAYER_MIN_SHARE = 0.4;
/** ...and the records together must lend the picture at least this share, or it is the author's own. */
export const LAYERED_SHARE = 0.5;

const visible = (pic, i) => pic.data[i * 4 + 3] !== 0;
const sameRgb = (a, i, b, j) => a.data[i * 4] === b.data[j * 4] && a.data[i * 4 + 1] === b.data[j * 4 + 1] && a.data[i * 4 + 2] === b.data[j * 4 + 2];
const rgbKey = (p, i) => (p.data[i * 4] << 16) | (p.data[i * 4 + 1] << 8) | p.data[i * 4 + 2];

/** The re-shade's record: exactly the picture's size, its outline the picture's - every visible pixel of the picture
 *  but RESHADE_OWN_PIXELS on the record, and no more than RESHADE_CUT_SHARE of the record's off the picture. The one
 *  whose outline agrees best (fewest pixels either way), then the most pixels left as they were. */
export function findReshadeSource(pic, records) {
  let best = null;
  for (const c of records) {
    const s = c.rgba;
    if (s.width !== pic.width || s.height !== pic.height) continue;
    let own = 0, covered = 0, same = 0, cut = 0;
    for (let i = 0; i < pic.width * pic.height; i++) {
      const p = visible(pic, i), r = s.data[i * 4 + 3] !== 0;
      if (p && !r) { own++; if (own > RESHADE_OWN_PIXELS) break; continue; }
      if (r && !p) { cut++; continue; }
      if (!p) continue;
      covered++;
      if (sameRgb(pic, i, s, i)) same++;
    }
    if (own > RESHADE_OWN_PIXELS || !covered || cut > RESHADE_CUT_SHARE * (covered + cut)) continue;
    const off = own + cut;
    if (!best || off < best.off || (off === best.off && same > best.same)) best = { ...c, at: [0, 0], same, covered, off };
  }
  return best;
}

/** The classic sprites stood together on one picture, peeled off one at a time (each the record and the spot that lend
 *  the most of the pixels still unexplained, exactly). Sprites only - archives from 100 up; the wall and floor sets
 *  below them match a run of dark pixels anywhere. Null when they lend less than LAYERED_SHARE. */
export function peelClassicLayers(pic, records) {
  const W = pic.width, H = pic.height;
  const left = new Uint8Array(W * H);
  let vis = 0;
  const colours = new Map();
  for (let i = 0; i < W * H; i++) if (visible(pic, i)) { left[i] = 1; vis++; const k = rgbKey(pic, i); colours.set(k, (colours.get(k) ?? 0) + 1); }
  const sprites = records.filter((c) => c.archive >= 100 && c.rgba.width <= W + 8 && c.rgba.height <= H + 8);
  const layers = [];
  let lent = 0;
  for (let round = 0; round < 8; round++) {
    // the records sharing the most colours with what is left, then every spot of those, exactly
    const scored = [];
    for (const c of sprites) {
      const s = c.rgba;
      const seen = new Set();
      let score = 0;
      for (let j = 0; j < s.width * s.height; j++) { if (!visible(s, j)) continue; const k = rgbKey(s, j); if (!seen.has(k)) { seen.add(k); score += colours.get(k) ?? 0; } }
      if (score >= LAYER_MIN_PIXELS) scored.push([score, c]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    let best = null;
    for (const [, c] of scored.slice(0, 400)) {
      // every spot at once: each pixel still unexplained votes for the spots that put a pixel of its colour under it
      const s = c.rgba;
      const at = new Map();   // colour -> [[sx, sy], ...] of the record
      let own = 0;
      for (let j = 0; j < s.width * s.height; j++) {
        if (!visible(s, j)) continue;
        own++;
        const k = rgbKey(s, j);
        if (!at.has(k)) at.set(k, []);
        at.get(k).push([j % s.width, Math.floor(j / s.width)]);
      }
      const VW = W + s.width, votes = new Int32Array(VW * (H + s.height));   // spot (ax, ay) at (ax + sw, ay + sh)
      for (let i = 0; i < W * H; i++) {
        if (!left[i]) continue;
        const x = i % W, y = Math.floor(i / W);
        for (const [sx, sy] of at.get(rgbKey(pic, i)) ?? []) votes[(y - sy + s.height) * VW + (x - sx + s.width)]++;
      }
      for (let v = 0; v < votes.length; v++) {
        const same = votes[v];
        if (same >= LAYER_MIN_PIXELS && same >= LAYER_MIN_SHARE * own && (!best || same > best.same)) best = { c, at: [(v % VW) - s.width, Math.floor(v / VW) - s.height], same };
      }
    }
    if (!best) break;
    const s = best.c.rgba, [ax, ay] = best.at;
    for (let y = Math.max(0, ay); y < Math.min(H, ay + s.height); y++) {
      for (let x = Math.max(0, ax); x < Math.min(W, ax + s.width); x++) {
        const i = y * W + x, j = (y - ay) * s.width + (x - ax);
        if (left[i] && visible(s, j) && sameRgb(pic, i, s, j)) { left[i] = 0; const k = rgbKey(pic, i); colours.set(k, colours.get(k) - 1); }
      }
    }
    layers.push(best);
    lent += best.same;
  }
  return layers.length && lent >= LAYERED_SHARE * vis ? layers : null;
}

const fromOf = (c) => (c.frame ? [c.archive, c.record, c.frame] : [c.archive, c.record]);

/** What one of the bundle's pictures is: `{ kind: 'derived', spec, says }`, `{ kind: 'reshade', of, says }` or
 *  `{ kind: 'own', says }`. A spec is checked to rebuild the picture exactly (every visible pixel, and nothing visible
 *  where it is clear). */
export function classifyPicture(name, pic, records) {
  const check = (spec, srcs) => {
    const back = composeDerivedPicture(spec, srcs[0], srcs.slice(1));
    for (let i = 0; i < pic.width * pic.height; i++) {
      if (!visible(pic, i) && back.data[i * 4 + 3] === 0) continue;
      for (let k = 0; k < 4; k++) if (back.data[i * 4 + k] !== pic.data[i * 4 + k]) throw new Error(`${name}: the derived rebuild differs at pixel ${i}`);
    }
    return spec;
  };
  const one = findClassicSource(pic, records);
  if (one) {
    const spec = check(deriveSpec(fromOf(one), pic, one.rgba, one.at), [one.rgba]);
    return { kind: 'derived', spec, says: `TEXTURE.${String(one.archive).padStart(3, '0')} record ${one.record}${one.frame ? ` frame ${one.frame}` : ''}${spec.at ? ` at ${spec.at}` : ''}, ${spec.edits?.length ?? 0} author pixels` };
  }
  // a re-shade is checked BEFORE the layers: its record lends what it lends at (0, 0) and nowhere else
  const shade = findReshadeSource(pic, records);
  if (shade) return { kind: 'reshade', of: fromOf(shade), says: `TEXTURE.${String(shade.archive).padStart(3, '0')} record ${shade.record} RE-SHADED (its outline; ${shade.same} of ${shade.covered} pixels left as they were) - not carried, the classic record stands in` };
  const layers = peelClassicLayers(pic, records);
  if (layers) {
    const [first, ...rest] = layers;
    const spec = check(deriveSpec(fromOf(first.c), pic, first.c.rgba, first.at, rest.map((l) => ({ from: fromOf(l.c), at: l.at, src: l.c.rgba }))), layers.map((l) => l.c.rgba));
    return { kind: 'derived', spec, says: `${layers.map((l) => `${l.c.archive}_${l.c.record} at ${l.at} (${l.same} px)`).join(' + ')}, ${spec.edits?.length ?? 0} author pixels` };
  }
  return { kind: 'own', says: `the author's own picture (${pic.width}x${pic.height})` };
}

/** Basic Roads' arrays where the bundle's differ: [[pixel index, byte], ...] for roads and tracks. */
export function roadsDiff(bundleBytes, hazelnutDir) {
  const bundle = readUnityBundle(bundleBytes);
  const out = {};
  for (const [key, asset] of [['roads', 'roadData'], ['tracks', 'trackData']]) {
    // the bundle carries each twice - the `.bytes` Basic Roads reads (500,000: a byte a map pixel) and a `.txt` dump
    const mine = bundle.textAssets.find((t) => t.name === asset && t.bytes.length === 500000);
    if (!mine) throw new Error(`betony: no ${asset} of 500,000 bytes in the bundle`);
    const base = new Uint8Array(readFileSync(join(hazelnutDir, `${asset}.bytes`)));
    const diff = [];
    for (let i = 0; i < base.length; i++) if (base[i] !== mine.bytes[i]) diff.push([i, mine.bytes[i]]);
    out[key] = { base: sha(base), result: sha(mine.bytes), pixels: diff };
  }
  return out;
}

const sha = (b) => createHash('sha256').update(b).digest('hex');
const png = ({ width, height, data }) => { const p = new PNG({ width, height }); p.data = Buffer.from(data); return PNG.sync.write(p); };
const byName = (a, b) => a.localeCompare(b, 'en', { numeric: true });

/** Everything the vendor directory holds, as { path: bytes | string }, and the report. */
export function betonyRestoredAssets(arena2, archiveDir) {
  const bundleBytes = new Uint8Array(readFileSync(join(archiveDir, BUNDLE)));
  const bundle = readUnityBundle(bundleBytes);
  const out = {};
  const report = [];
  const text = (name) => bundle.textAssets.find((t) => t.name === name);

  out['betony-restored.dfmod.json'] = Buffer.from(text('BetonyRestored.dfmod').bytes);
  out['BetonyRestored.dll'] = Buffer.from(text('Betony Restored.dll').bytes);
  out['Readme_BetonyRestored.txt'] = readFileSync(join(archiveDir, README));
  out[FLAT_REPLACEMENTS] = readFileSync(join(archiveDir, FLAT_REPLACEMENTS));

  const manifest = JSON.parse(Buffer.from(text('BetonyRestored.dfmod').bytes).toString('utf8'));
  const { pack, shipped } = buildPack({ arena2, bundleBytes, vendor: 'betony-restored', mod: { title: manifest.ModTitle, author: manifest.ModAuthor, version: manifest.ModVersion }, log: (s) => report.push(s.trim()) });
  out['WorldDataPack/betony-restored.pack.json.gz'] = zlib.gzipSync(Buffer.from(shipped, 'utf8'), { level: 9 });
  report.push(`WorldDataPack: ${Object.keys(pack.files).length} files, ${pack.nodes.length} nodes`);

  const roads = roadsDiff(bundleBytes, join(ROOT, 'vendor/roads-hazelnut'));
  out['roads.json'] = `${JSON.stringify({ format: 'dfe-roads-diff/1', of: 'vendor/roads-hazelnut', roads: roads.roads, tracks: roads.tracks })}\n`;
  report.push(`roads.json: ${roads.roads.pixels.length} road and ${roads.tracks.pixels.length} track pixels`);

  // the pictures
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(arena2, 'ART_PAL.COL'))));
  const records = [...classicRecords(arena2, palette)];
  const dsDir = join(ROOT, 'vendor/detailed-ships/Textures');
  const dsDerived = JSON.parse(readFileSync(join(dsDir, 'derived.json'), 'utf8'));
  const recordRgba = (from) => records.find((c) => c.archive === from[0] && c.record === from[1] && c.frame === (from[2] ?? 0))?.rgba;
  const dsPicture = (name) => {
    if (existsSync(join(dsDir, `${name}.png`))) { const p = PNG.sync.read(readFileSync(join(dsDir, `${name}.png`))); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; }
    const spec = dsDerived[name];
    return spec ? composeDerivedPicture(spec, recordRgba(spec.from), (spec.also ?? []).map((l) => recordRgba(l.from))) : null;
  };
  const samePicture = (a, b) => {
    if (!a || !b || a.width !== b.width || a.height !== b.height) return false;
    for (let i = 0; i < a.width * a.height; i++) {
      if (!visible(a, i) && !visible(b, i)) continue;
      for (let k = 0; k < 4; k++) if (a.data[i * 4 + k] !== b.data[i * 4 + k]) return false;
    }
    return true;
  };
  const derived = {}, reshaded = {};
  const carried = new Set();
  for (const tex of bundle.textures.slice().sort((a, b) => byName(a.name, b.name))) {
    if (BETONY_NOT_CARRIED[tex.name]) { report.push(`${tex.name}: not carried - ${BETONY_NOT_CARRIED[tex.name]}`); continue; }
    const { width, height, data } = tex.rgba();
    const pic = { width, height, data: new Uint8Array(data) };
    if (samePicture(pic, dsPicture(tex.name))) { report.push(`${tex.name}: Detailed Ships' picture, pixel for pixel - shared`); continue; }
    const c = classifyPicture(tex.name, pic, records);
    report.push(`${tex.name}: ${c.says}`);
    if (c.kind === 'reshade') { reshaded[tex.name] = c.of; continue; }
    if (c.kind === 'derived') derived[tex.name] = c.spec;
    else out[`Textures/${tex.name}.png`] = png(pic);
    carried.add(tex.name);
  }
  const table = (o) => `{\n${Object.keys(o).sort(byName).map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(o[k])}`).join(',\n')}\n}\n`;
  out['Textures/derived.json'] = table(derived);
  out['Textures/reshaded.json'] = table(reshaded);
  // an xml rides with the picture it scales; one whose picture is not carried here scales nothing the port draws
  for (const t of bundle.textAssets.filter((a) => /^\d+_\d+-\d+$/.test(a.name)).sort((a, b) => byName(a.name, b.name))) {
    if (carried.has(t.name)) out[`Textures/${t.name}.xml`] = Buffer.from(t.bytes);
    else report.push(`${t.name}.xml: not carried - its picture is ${dsPicture(t.name) ? 'Detailed Ships\' (which carries the same scale)' : 'not carried here'}`);
  }
  // the listing test/doctrine.test.js reads for what may stand under Textures/ - the tool's, not a hand's (AUDIT BET1
  // D1: the integration's head carried the author's 66 pictures with no doctrine row, AUDIT-TO1 F3's trap once more)
  const textures = Object.keys(out).filter((p) => p.startsWith('Textures/')).map((p) => p.slice('Textures/'.length)).sort(byName);
  out['betony-restored.files.json'] = `${JSON.stringify({
    ModTitle: manifest.ModTitle, ModVersion: manifest.ModVersion, ModAuthor: manifest.ModAuthor,
    Source: 'https://www.nexusmods.com/daggerfallunity/mods/515',
    Bundle: BUNDLE, BundleSha256: sha(bundleBytes),
    Note: 'Every file tools/betonyRestoredAssets.mjs writes under Textures/ - the pictures no classic record is (the author\'s own: Kamer\'s sitting patrons, Cliffworms\' bottle shelves, the Mara statue), the scale beside the one it scales, and the two indexes: derived.json (the pictures that ARE Daggerfall\'s records, rebuilt from the player\'s own files) and reshaded.json (the classic records re-shaded whole, not carried). Generated by the tool, not written by hand - the authority test/doctrine.test.js reads for what may stand under vendor/betony-restored/Textures/. The bundle\'s own manifest (betony-restored.dfmod.json) names pictures the port does not carry: the derived and re-shaded ones, Detailed Ships\' (shared), StarMadeKnight\'s and Basic Roads\'.',
    Files: textures,
  }, null, 2)}\n`;
  return { out, report };
}

if (isMain(import.meta.url)) {
  const [arena2, archiveDir, outArg] = process.argv.slice(2);
  if (!arena2 || !archiveDir) {
    console.error('usage: node tools/betonyRestoredAssets.mjs <arena2> <unzipped archive dir> [outDir]');
    process.exit(1);
  }
  const outDir = outArg ?? join(ROOT, 'vendor/betony-restored');
  const { out, report } = betonyRestoredAssets(arena2, archiveDir);
  for (const line of report) console.log(`  ${line}`);
  for (const [path, body] of Object.entries(out).sort(([a], [b]) => byName(a, b))) {
    const full = join(outDir, path);
    mkdirSync(full.slice(0, full.lastIndexOf('/')), { recursive: true });
    writeFileSync(full, body);
    console.log(`  ${path}  ${typeof body === 'string' ? Buffer.byteLength(body) : body.length} bytes  sha256 ${sha(typeof body === 'string' ? Buffer.from(body) : body)}`);
  }
  if (!readdirSync(outDir).length) process.exit(1);
}
