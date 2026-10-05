#!/usr/bin/env node
// VE4 (2026-10-05, Mac: "Put it in the codebase") - VANILLA ENHANCED, VENDORED.
//
// carademono's Vanilla Enhanced ships as .dfmod bundles (Nexus Daggerfall Unity mod 273), and its sources are public at
// github.com/drcarademono/vanilla-enhanced. This tool reads that repository AT THE COMMIT IT PINS and writes what the
// port carries of three of its mods - the Base, Masked Roads, and Snowless Swamps and Jungles:
//
//   public/art/vanilla-enhanced/<mod>/<name>.png   every PNG the mod's own manifest names (`Files`), byte for byte,
//                                                  under its asset name (the extension written lower case);
//   public/art/vanilla-enhanced/<mod>/<archive>-TexArray_<slice>.png
//                                                  a slice of one of the mod's texture arrays that no PNG it or the
//                                                  Base ships draws - Masked Roads' road tiles - byte for byte from the
//                                                  repository's own source picture for that slice;
//   vendor/vanilla-enhanced/<title>.dfmod.json     each mod's manifest, verbatim;
//   vendor/vanilla-enhanced/<mod>.files.json       each directory's listing - every file, the repository path it came
//                                                  from and its sha256 - the authority test/doctrine.test.js reads;
//   vendor/vanilla-enhanced/vanilla-enhanced.index.json
//                                                  the name index each mod registers in the texture-mod door with
//                                                  (systems/dfmodTextures.js), the shape buildDfmodIndex writes for an
//                                                  attached bundle, and where each array's slices are served from.
//
// THE ARRAYS SHIP AS PNGS. A mod's `<archive>-TexArray` is the terrain archive's whole tile set (GROUND1), BC7 in the
// bundle. This tool decodes every slice (formats/unityBundle.js decodeTextureArray) and finds the picture it was made
// from: the mod's own record PNG, else the repository's source picture for it. Only a slice within BC7's error of that
// picture is carried (BC7_MEAN / BC7_MAX below; the measured worst is written into the listing), and it is served from
// the picture - the Base's own record where it is that record, pixel for pixel. An array whose depth is not a terrain
// archive's 56 is refused by Daggerfall Unity (TextureReplacement.cs:343, `textureArray.depth == depth`) and never
// read, so it is indexed with its depth and no slices: the door's own refusal still happens.
//
// LEFT OUT: Winter Tracks (its 30 records are never reached while the Base's arrays dress the ground - Daggerfall
// Unity's TryImportTextureArray takes the first mod carrying either name, and the Base carries both), Kokey's
// Temperate (Kokey's own mod, not the family's), and every mod's Materials (the port has no Material reader - Ledger C,
// A MOD'S MATERIALS).
//
//   node tools/vanillaEnhancedVendor.mjs <vanilla-enhanced clone>            check the committed tree against it
//   node tools/vanillaEnhancedVendor.mjs <vanilla-enhanced clone> --write    write it
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import { decodeTextureArray } from '../src/formats/unityBundle.js';
import { DFMOD_INDEX_VERSION, manifestDeps, dfmodStoreKey } from '../src/systems/dfmodTextures.js';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const VE_REPO = 'https://github.com/drcarademono/vanilla-enhanced';
/** The commit read: "HD dungeon textures, snowless swamps and jungles" (2025-05-08), the manifests' 3.4.7. */
export const VE_COMMIT = 'c0c9041c101ba8b57feb93258dda7a37be1b9433';
const ASSET_ROOT = 'Assets/Game/Mods/vanilla-enhanced/';
export const ART = 'public/art/vanilla-enhanced';
export const VENDOR = 'vendor/vanilla-enhanced';
/** The mods carried, in the order the index lists them, each under its own directory. */
export const VE_MODS = Object.freeze([
  Object.freeze({ title: 'Vanilla Enhanced - Base', dir: 'base' }),
  Object.freeze({ title: 'Vanilla Enhanced - Masked Roads', dir: 'masked-roads' }),
  Object.freeze({ title: 'Vanilla Enhanced - Snowless Swamps and Jungles', dir: 'snowless-swamps-and-jungles' }),
]);
/** A terrain archive's record count - TEXTURE.002..404's 56. An array of another depth is refused (see above). */
const TERRAIN_RECORDS = 56;
/** BC7's error on these tile sets: the mean absolute channel error and the worst channel error a slice may show
 *  against the picture it was made from. Measured at the pinned commit: every slice carried is at most 0.82 and 34 from
 *  its picture, and the nearest a Masked Roads road tile (records 46, 47 and 55) comes to the Base record it replaces
 *  is 5.20 and 78 - the bounds sit in that gap. */
export const BC7_MEAN = 1.5;
export const BC7_MAX = 48;

const sha = (b) => createHash('sha256').update(b).digest('hex');
const decodePng = (bytes) => { const p = PNG.sync.read(bytes); return { width: p.width, height: p.height, data: p.data }; };
/** A manifest's text, its byte-order mark off. */
const manifestJson = (bytes) => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
/** The asset name of a repository path: the file's name without its extension. */
const assetName = (p) => basename(p).replace(/\.[^.]+$/, '');

/** A Texture2DArray `.asset` (Unity's text serialisation): the fields decodeTextureArray reads. */
function readArrayAsset(bytes) {
  const t = bytes.toString('utf8');
  const num = (k) => { const m = new RegExp(`\\n\\s*${k}: (\\d+)`).exec(t); if (!m) throw new Error(`no ${k}`); return Number(m[1]); };
  const hex = /_typelessdata: ([0-9a-f]+)/.exec(t);
  if (!hex) throw new Error('no _typelessdata');
  return {
    m_Name: /m_Name: (.*)/.exec(t)[1].trim(), m_Format: num('m_Format'), m_Width: num('m_Width'), m_Height: num('m_Height'),
    m_Depth: num('m_Depth'), m_DataSize: num('m_DataSize'), 'image data': new Uint8Array(Buffer.from(hex[1], 'hex')),
  };
}

/** Mean and worst absolute colour-channel difference of two top-down RGBA pictures of one size (alpha aside: a ground
 *  tile is opaque). */
export function channelError(a, b) {
  if (a.width !== b.width || a.height !== b.height) return null;
  let sum = 0, max = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    for (let c = 0; c < 3; c++) { const d = Math.abs(a.data[i + c] - b.data[i + c]); sum += d; if (d > max) max = d; }
  }
  return { mean: sum / (a.width * a.height * 3), max };
}
const samePixels = (a, b) => a.width === b.width && a.height === b.height && Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;
const within = (e) => !!e && e.mean <= BC7_MEAN && e.max <= BC7_MAX;
const round2 = (x) => Math.round(x * 100) / 100;

/** Everything the tool writes, built in memory from the clone: Map<repo-relative output path, Buffer>. */
export function build(clone) {
  const out = new Map();
  const report = [];
  const repo = (p) => join(clone, p);
  const mods = VE_MODS.map((m) => {
    const bytes = readFileSync(repo(`${m.title}.dfmod.json`));
    return { ...m, manifestBytes: bytes, manifest: manifestJson(bytes) };
  });
  const toRepo = (f) => { if (!f.startsWith(ASSET_ROOT)) throw new Error(`${f}: outside ${ASSET_ROOT}`); return f.slice(ASSET_ROOT.length); };
  // every record PNG a carried mod ships, by mod: asset name -> { from, bytes, pic }
  const records = new Map();
  for (const m of mods) {
    const recs = new Map();
    for (const f of m.manifest.Files ?? []) {
      if (!/\.png$/i.test(f)) continue;
      const from = toRepo(f);
      const name = assetName(from);
      if (recs.has(name.toLowerCase())) throw new Error(`${m.title}: two PNGs named ${name}`);
      const bytes = readFileSync(repo(from));
      recs.set(name.toLowerCase(), { name, from, bytes, pic: decodePng(bytes) });
    }
    records.set(m.dir, recs);
  }
  const base = records.get('base');
  const index = { Pack: 'Vanilla Enhanced', Source: VE_REPO, Commit: VE_COMMIT, Root: 'art/vanilla-enhanced', Mods: [] };
  for (const m of mods) {
    const recs = records.get(m.dir);
    const files = new Map();   // served basename -> { from, bytes }
    for (const r of recs.values()) files.set(`${r.name}.png`, { from: r.from, bytes: r.bytes, kind: 'record' });
    const arrays = [];
    const slices = {};
    const proofs = {};
    for (const f of (m.manifest.Files ?? []).filter((x) => /\.asset$/i.test(x))) {
      const from = toRepo(f);
      const arr = readArrayAsset(readFileSync(repo(from)));
      const am = /^(\d+)-TexArray$/i.exec(arr.m_Name);
      if (!am) throw new Error(`${from}: ${arr.m_Name} is not an <archive>-TexArray`);
      arrays.push([arr.m_Name, arr.m_Width, arr.m_Height, arr.m_Depth]);
      if (arr.m_Depth !== TERRAIN_RECORDS) {   // refused by DFU at every read - indexed, never drawn
        slices[arr.m_Name] = [];
        report.push(`${m.dir} ${arr.m_Name}: depth ${arr.m_Depth}, refused (no slices carried)`);
        continue;
      }
      const archive = am[1];
      const decoded = decodeTextureArray(arr);
      const folder = dirname(from);
      const served = [];
      const proof = [];
      for (let i = 0; i < decoded.length; i++) {
        const recName = `${archive}_${i}-0`;
        const own = recs.get(recName.toLowerCase()) ?? null;
        const srcPath = [`${folder}/${recName}.png`, `${folder}/${recName}.PNG`].find((p) => existsSync(repo(p))) ?? null;
        const source = srcPath ? { from: srcPath, bytes: readFileSync(repo(srcPath)) } : null;
        if (source) source.pic = decodePng(source.bytes);
        // the picture the slice was made from: the mod's own record, else the repository's source for it
        const candidates = [own && { ...own, kind: 'own' }, source && { ...source, kind: 'source' }].filter(Boolean);
        let pick = null, err = null;
        for (const c of candidates) { const e = channelError(decoded[i], c.pic); if (within(e)) { pick = c; err = e; break; } }
        if (!pick) {
          const seen = candidates.map((c) => { const e = channelError(decoded[i], c.pic); return `${c.from}: ${e ? `${round2(e.mean)}/${e.max}` : 'another size'}`; });
          throw new Error(`${m.title} ${arr.m_Name}[${i}] is not within BC7's error of any picture - ${seen.join('; ') || 'none found'}`);
        }
        let path;
        if (pick.kind === 'own') path = `${m.dir}/${pick.name}.png`;
        else {
          const b = base.get(recName.toLowerCase());
          if (b && samePixels(b.pic, pick.pic)) path = `base/${b.name}.png`;   // the Base's own record, pixel for pixel
          else {
            const name = `${arr.m_Name}_${i}.png`;
            files.set(name, { from: pick.from, bytes: pick.bytes, kind: 'slice' });
            path = `${m.dir}/${name}`;
          }
        }
        served.push(path);
        proof.push([i, round2(err.mean), err.max]);
      }
      slices[arr.m_Name] = served;
      proofs[arr.m_Name] = proof;
      const own = served.filter((p) => !p.startsWith(`${m.dir}/`)).length;
      report.push(`${m.dir} ${arr.m_Name}: ${served.length} slices - worst ${Math.max(...proof.map((p) => p[1]))}/${Math.max(...proof.map((p) => p[2]))}${own ? `, ${own} the Base's records` : ''}${served.filter((p) => p.includes('-TexArray_')).length ? `, ${served.filter((p) => p.includes('-TexArray_')).length} carried as slices` : ''}`);
    }
    arrays.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const byName = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    // the files of this directory
    const names = [...files.keys()].sort();
    for (const n of names) out.set(`${ART}/${m.dir}/${n}`, files.get(n).bytes);
    out.set(`${VENDOR}/${m.title}.dfmod.json`, m.manifestBytes);
    const listing = {
      ModTitle: m.manifest.ModTitle, ModVersion: m.manifest.ModVersion, ModAuthor: m.manifest.ModAuthor,
      Source: VE_REPO, Commit: VE_COMMIT,
      Note: `Generated by tools/vanillaEnhancedVendor.mjs from the repository at the commit above - not written by hand. Every file under ${ART}/${m.dir}/ and the repository path it is the bytes of: the mod's own PNGs (the ones its manifest, ${m.title}.dfmod.json beside this file, names)${m.dir === 'masked-roads' ? ", and the slices of its texture arrays that no PNG it or the Base ships draws, each the repository's source picture for that slice and within BC7's error of the slice (Proofs: slice, mean, worst)" : ''}. The authority test/doctrine.test.js reads for what may stand in that directory.`,
      Files: names,
      From: Object.fromEntries(names.map((n) => [n, files.get(n).from])),
      Sha256: Object.fromEntries(names.map((n) => [n, sha(files.get(n).bytes)])),
      Proofs: byName(proofs),
    };
    out.set(`${VENDOR}/${m.dir}.files.json`, Buffer.from(`${JSON.stringify(listing, null, 2)}\n`));
    const textures = [...recs.values()].map((r) => [r.name, r.pic.width, r.pic.height]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    index.Mods.push({
      key: dfmodStoreKey(`${m.manifest.ModTitle}.dfmod`), dir: m.dir,
      index: {
        v: DFMOD_INDEX_VERSION, title: m.manifest.ModTitle, version: m.manifest.ModVersion, author: m.manifest.ModAuthor, guid: m.manifest.GUID,
        deps: manifestDeps(m.manifest), textures, arrays, xml: {},
      },
      slices: byName(slices),
    });
  }
  out.set(`${VENDOR}/vanilla-enhanced.index.json`, Buffer.from(`${JSON.stringify(index)}\n`));
  return { out, report };
}

function main() {
  const [clone, flag] = process.argv.slice(2);
  if (!clone) { console.error('usage: node tools/vanillaEnhancedVendor.mjs <vanilla-enhanced clone> [--write]'); process.exit(2); }
  const head = execFileSync('git', ['-C', clone, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== VE_COMMIT) { console.error(`${clone} is at ${head}; this tool reads ${VE_COMMIT}`); process.exit(1); }
  const { out, report } = build(clone);
  for (const line of report) console.log(line);
  const want = new Set([...out.keys()].filter((p) => p.startsWith(`${ART}/`)));
  const have = existsSync(join(ROOT, ART))
    ? readdirSync(join(ROOT, ART), { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => `${ART}/${join(e.parentPath ?? e.path, e.name).slice(join(ROOT, ART).length + 1).split('\\').join('/')}`)
    : [];
  if (flag === '--write') {
    for (const p of have) if (!want.has(p)) rmSync(join(ROOT, p));
    for (const [p, bytes] of out) { mkdirSync(dirname(join(ROOT, p)), { recursive: true }); writeFileSync(join(ROOT, p), bytes); }
    const pics = [...want].length;
    const bytes = [...want].reduce((a, p) => a + out.get(p).length, 0);
    console.log(`wrote ${pics} pictures (${(bytes / 1e6).toFixed(1)} MB) under ${ART}/ and ${out.size - pics} files under ${VENDOR}/`);
    return;
  }
  const bad = [];
  for (const [p, bytes] of out) {
    const f = join(ROOT, p);
    if (!existsSync(f)) bad.push(`${p}: missing`);
    else if (sha(readFileSync(f)) !== sha(bytes)) bad.push(`${p}: differs`);
  }
  for (const p of have) if (!want.has(p)) bad.push(`${p}: in the tree, not in the pack`);
  if (bad.length) { console.error(bad.slice(0, 40).join('\n') + (bad.length > 40 ? `\n... ${bad.length - 40} more` : '')); process.exit(1); }
  console.log(`the committed tree is the pack at ${VE_COMMIT.slice(0, 8)}: ${out.size} files`);
}

if (isMain(import.meta.url)) main();
