#!/usr/bin/env node
// HAZE1 / WINDFALL1 / SNOWFALL1 / ALIKR1 (2026-10-08, Mac: "We have permission to use and implement everything into
// the codebase. These should be on by default and integrate into our enhanced environments seamlessly.") - THE FOUR
// ENVIRONMENT MODS, OUT OF THE ARCHIVES MAC HANDED OVER.
//
//   node tools/environmentModsExtract.mjs \
//     --heat     "<path-to>/heat-haze.dfmod" \
//     --windfall "<path-to>/windfall.dfmod" --windfall-readme "<path-to>/README-Windfall-Console-Commands.txt" \
//     --snowfall "<path-to>/snowfall.dfmod" \
//     --sands    "<path-to>/Sands of the Alik'r/Textures" \
//     [--write]
//
// Without --write the committed tree is checked against what the archives make, file by file (sha256); with it, the
// files are written. The output is a function of the four archives alone - nothing of the player's ARENA2 is read.
//
// What is written, and from where:
//   vendor/heat-haze/      heat-haze.dfmod.json, modsettings.json (the bundle's TextAssets, verbatim), HeatHaze.dll
//                          (byte for byte)
//   vendor/windfall/       windfall.dfmod.json, modsettings.json, Windfall.dll, README-Windfall-Console-Commands.txt
//                          (the zip's own note, verbatim); Textures/{spring_summer_leaves,fall_leaves,snowflake}.png -
//                          the bundle's three Texture2D objects (RGBA32, one mip: the PNG is the texture exactly);
//                          Sound/<clip>.ogg - the 27 AudioClips, each the bundle's FSB5 Vorbis packets remuxed into
//                          Ogg untouched (tools/lib/fsb5Vorbis.mjs, CSA-A's door) with the setup header
//                          vendor/vorbis-fsb-setups/ names by CRC32 - and Sound/sounds.json; windfall.files.json, the
//                          listing test/doctrine.test.js holds Textures/ to
//   vendor/snowfall/       snowfall.dfmod.json (the bundle's `dynamic-snow.dfmod`), modsettings.json,
//                          DynamicSnow.dll, BasicRoadsNotice.md (the bundle's own notice, verbatim); snowfall.files.json
//                          (the listing of public/art/snowfall/) and snowfall.index.json (the texture door's index)
//   public/art/snowfall/   <archive>_<record>-0.png - the 168 winter records (TEXTURE.103, .303, .403; RGB24 with a mip
//                          chain: mip 0 is what is written, losslessly) - snow_albedo.png, and the three surface-mask
//                          TextAssets as snow_surface_masks_<archive>.bytes (56 records x 64 x 64 coverage bytes each)
//   vendor/sands-of-the-alikr/  sands-of-the-alikr.files.json and sands-of-the-alikr.index.json
//   public/art/sands-of-the-alikr/  the 47 loose PNGs, byte for byte
//
// The IL dumps (vendor/<mod>/il/, tools/ilDump.py) and the shaders read back as GLSL (vendor/<mod>/shaders/,
// tools/dxbcGlsl.py) are the two Python tools' - each README gives its line.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';
import { isMain } from './lib/isMain.mjs';
import { readUnityFs, readSerializedFile, decodeTexture2D, CLASS_ID } from '../src/formats/unityBundle.js';
import { fsb5ToOgg } from './lib/fsb5Vorbis.mjs';
import { writePng } from './pngIO.mjs';
import { dfmodStoreKey, DFMOD_INDEX_VERSION, manifestDeps } from '../src/systems/dfmodTextures.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLASS_AUDIO_CLIP = 83;
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sorted = (a) => [...a].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
/** A record's name in DFU's loose-texture form sorts by archive, then record, as a number. */
const byRecord = (a, b) => {
  const pa = /^(\d+)_(\d+)-(\d+)/.exec(a), pb = /^(\d+)_(\d+)-(\d+)/.exec(b);
  if (!pa || !pb) return a < b ? -1 : a > b ? 1 : 0;
  return (Number(pa[1]) - Number(pb[1])) || (Number(pa[2]) - Number(pb[2])) || (Number(pa[3]) - Number(pb[3]));
};

/** Where the Nexus pages are - the archives' own names carry the mod ids (`Heat_Haze_1397_1.0.1_...`). */
export const SOURCES = Object.freeze({
  'heat-haze': 'https://www.nexusmods.com/daggerfallunity/mods/1397',
  windfall: 'https://www.nexusmods.com/daggerfallunity/mods/1396',
  snowfall: 'https://www.nexusmods.com/daggerfallunity/mods/1401',
  'sands-of-the-alikr': 'https://www.nexusmods.com/daggerfallunity/mods/1390',
});
/** The 27 clips Windfall's WindMod.CreateEnvironmentalEffects loads, in the three pools it hands
 *  WindEnvironmentEffects.Initialize - gusts, the long windy/storm passages, the foliage ruffles. */
export const WINDFALL_CLIPS = Object.freeze({
  gust: Object.freeze(Array.from({ length: 12 }, (_, i) => `wind_gust_${String(i + 1).padStart(2, '0')}`)),
  ambient: Object.freeze([
    'wind_blowing_01_ultrasoft', 'wind_blowing_02_ultrasoft', 'wind_blowing_03_ultrasoft',
    'whistling_wind_01_ultrasoft', 'whistling_wind_02_ultrasoft', 'whistling_wind_03_ultrasoft',
    'open_wind_01_ultrasoft', 'open_wind_02_ultrasoft', 'open_wind_03_ultrasoft',
  ]),
  ruffle: Object.freeze(Array.from({ length: 6 }, (_, i) => `leaf_ruffle_${String(i + 1).padStart(2, '0')}`)),
});
export const WINDFALL_TEXTURES = Object.freeze(['spring_summer_leaves', 'fall_leaves', 'snowflake']);
/** Snowfall's winter archives (SnowCoverageData.Archives) and the surface-mask asset each pairs with. */
export const SNOWFALL_ARCHIVES = Object.freeze([103, 303, 403]);
/** SnowCoverageData: 56 records of 64 x 64 coverage bytes - DynamicSnowMod.SurfaceMaskByteCount. */
export const SNOW_MASK_BYTES = 229376;

/** The bundle's main serialized file, its objects read, and its resource streams. */
export function openBundle(bytes) {
  const fs = readUnityFs(bytes);
  const main = fs.files.find((f) => !/\.res(S|ource)$/.test(f.path));
  const sf = readSerializedFile(main, main.path);
  const resource = (path, offset, size) => {
    const base = path.slice(path.lastIndexOf('/') + 1);
    const f = fs.files.find((x) => x.path === base || x.path === path);
    if (!f) throw new Error(`the bundle has no stream ${path}`);
    return f.read(offset, size);
  };
  const objects = sf.objects.map((o) => ({ classId: o.classId, read: () => o.read() }));
  return { objects, resource };
}

/** The bundle's TextAssets by name, as bytes. */
function textAssets(b) {
  const out = new Map();
  for (const o of b.objects) {
    if (o.classId !== CLASS_ID.TextAsset) continue;
    const t = o.read();
    out.set(t.m_Name, new Uint8Array(t.m_Script));
  }
  return out;
}
/** The bundle's Texture2D objects by name, decoded top row first. */
function textures(b) {
  const out = new Map();
  for (const o of b.objects) {
    if (o.classId !== CLASS_ID.Texture2D) continue;
    const t = o.read();
    out.set(t.m_Name, { pic: decodeTexture2D(t, b.resource), format: t.m_TextureFormat, mips: t.m_MipCount });
  }
  return out;
}
const need = (map, name, what) => {
  if (!map.has(name)) throw new Error(`${what} carries no ${name}`);
  return map.get(name);
};
/** A manifest TextAsset is the `<name>.dfmod` one - the JSON with a ModTitle. */
function manifestOf(assets, what) {
  for (const [name, bytes] of assets) {
    if (!/\.dfmod$/i.test(name)) continue;
    try { const j = JSON.parse(new TextDecoder().decode(bytes)); if (j?.ModTitle) return { name, bytes, json: j }; } catch { /* not this one */ }
  }
  throw new Error(`${what} carries no manifest`);
}

/** The Vorbis setup headers vendor/vorbis-fsb-setups/ carries, by CRC32 - each checked against its own name. */
function setupHeaders() {
  const setups = new Map();
  const dir = join(ROOT, 'vendor/vorbis-fsb-setups');
  for (const f of readdirSync(dir).filter((n) => /^setup_[0-9a-f]{8}\.bin$/.test(n))) {
    const b = new Uint8Array(readFileSync(join(dir, f)));
    const crc = zlib.crc32(b) >>> 0;
    if (f !== `setup_${crc.toString(16).padStart(8, '0')}.bin`) throw new Error(`${f} is not the header its name says (CRC32 ${crc.toString(16)})`);
    setups.set(crc, b);
  }
  return setups;
}

const json = (v) => Buffer.from(`${JSON.stringify(v, null, 2)}\n`);

/** Heat Haze: the manifest, the settings and the assembly. */
export function heatHazeFiles(bytes) {
  const b = openBundle(bytes);
  const assets = textAssets(b);
  const m = manifestOf(assets, 'heat-haze.dfmod');
  const out = new Map();
  out.set('vendor/heat-haze/heat-haze.dfmod.json', m.bytes);
  out.set('vendor/heat-haze/modsettings.json', need(assets, 'modsettings', 'heat-haze.dfmod'));
  out.set('vendor/heat-haze/HeatHaze.dll', need(assets, 'HeatHaze.dll', 'heat-haze.dfmod'));
  return { out, report: [`heat-haze: ${m.json.ModTitle} ${m.json.ModVersion}`] };
}

/** Windfall: the manifest, the settings, the assembly, the console note, its three pictures and 27 clips. */
export function windfallFiles(bytes, readmeBytes) {
  const b = openBundle(bytes);
  const assets = textAssets(b);
  const m = manifestOf(assets, 'windfall.dfmod');
  const out = new Map();
  const report = [`windfall: ${m.json.ModTitle} ${m.json.ModVersion}`];
  out.set('vendor/windfall/windfall.dfmod.json', m.bytes);
  out.set('vendor/windfall/modsettings.json', need(assets, 'modsettings', 'windfall.dfmod'));
  out.set('vendor/windfall/Windfall.dll', need(assets, 'Windfall.dll', 'windfall.dfmod'));
  out.set('vendor/windfall/README-Windfall-Console-Commands.txt', readmeBytes);
  const pics = textures(b);
  const files = [];
  for (const name of WINDFALL_TEXTURES) {
    const t = need(pics, name, 'windfall.dfmod');
    if (t.format !== 4 || t.mips !== 1) throw new Error(`${name}: format ${t.format}, ${t.mips} mips - the PNG would not be the texture exactly`);
    out.set(`vendor/windfall/Textures/${name}.png`, writePng(t.pic));
    files.push(`${name}.png`);
    report.push(`  ${name}: ${t.pic.width}x${t.pic.height} RGBA32`);
  }
  const setups = setupHeaders();
  const wanted = new Set(Object.values(WINDFALL_CLIPS).flat());
  const clips = [];
  for (const o of b.objects) {
    if (o.classId !== CLASS_AUDIO_CLIP) continue;
    const c = o.read();
    if (!wanted.has(c.m_Name)) { report.push(`  ${c.m_Name}: never loaded by the assembly, not carried`); continue; }
    const fsb = b.resource(c.m_Resource.m_Source, Number(c.m_Resource.m_Offset), Number(c.m_Resource.m_Size));
    const r = fsb5ToOgg(fsb, (crc) => setups.get(crc) ?? null);
    out.set(`vendor/windfall/Sound/${c.m_Name}.ogg`, r.ogg);
    clips.push({ name: c.m_Name, channels: r.channels, frequency: r.rate, samples: r.numSamples, length: Math.fround(c.m_Length), setup: r.crc.toString(16).padStart(8, '0') });
  }
  const missing = [...wanted].filter((n) => !clips.some((c) => c.name === n));
  if (missing.length) throw new Error(`windfall.dfmod lacks ${missing.join(', ')}`);
  const order = Object.values(WINDFALL_CLIPS).flat();
  clips.sort((x, y) => order.indexOf(x.name) - order.indexOf(y.name));
  out.set('vendor/windfall/Sound/sounds.json', Buffer.from(`[\n${clips.map((c) => `  ${JSON.stringify(c)}`).join(',\n')}\n]\n`));
  report.push(`  ${clips.length} clips remuxed to Ogg (${clips.reduce((a, c) => a + out.get(`vendor/windfall/Sound/${c.name}.ogg`).length, 0)} bytes)`);
  out.set('vendor/windfall/windfall.files.json', json({
    ModTitle: m.json.ModTitle, ModVersion: m.json.ModVersion, ModAuthor: m.json.ModAuthor, Source: SOURCES.windfall,
    Bundle: 'windfall.dfmod', BundleSha256: sha(bytes),
    Note: 'Generated by tools/environmentModsExtract.mjs from the shipped bundle - not written by hand. Every picture under vendor/windfall/Textures/: the three Texture2D objects WindMod.CreateEnvironmentalEffects loads (RGBA32, one mip - each PNG is the texture exactly). The authority test/doctrine.test.js reads for what may stand in that directory.',
    Files: files,
    Sha256: Object.fromEntries(files.map((f) => [f, sha(out.get(`vendor/windfall/Textures/${f}`))])),
  }));
  return { out, report };
}

/** Snowfall: the manifest, the settings, the assembly, the Basic Roads notice, and its art under public/art/snowfall/. */
export function snowfallFiles(bytes) {
  const b = openBundle(bytes);
  const assets = textAssets(b);
  const m = manifestOf(assets, 'snowfall.dfmod');
  const out = new Map();
  const report = [`snowfall: ${m.json.ModTitle} ${m.json.ModVersion} (the bundle's manifest is ${m.name})`];
  out.set('vendor/snowfall/snowfall.dfmod.json', m.bytes);
  out.set('vendor/snowfall/modsettings.json', need(assets, 'modsettings', 'snowfall.dfmod'));
  out.set('vendor/snowfall/DynamicSnow.dll', need(assets, 'DynamicSnow.dll', 'snowfall.dfmod'));
  out.set('vendor/snowfall/BasicRoadsNotice.md', need(assets, 'BasicRoadsNotice', 'snowfall.dfmod'));
  const pics = textures(b);
  const files = [];
  const records = [];
  for (const [name, t] of pics) {
    const isRecord = /^(\d+)_(\d+)-(\d+)$/.exec(name);
    if (!isRecord && name !== 'snow_albedo') throw new Error(`snowfall.dfmod: an unexpected texture ${name}`);
    if (t.format !== 3) throw new Error(`${name}: format ${t.format} - mip 0 of RGB24 is what is written losslessly`);
    out.set(`public/art/snowfall/${name}.png`, writePng(t.pic));
    files.push(`${name}.png`);
    if (isRecord) records.push([name, t.pic.width, t.pic.height]);
  }
  for (const a of SNOWFALL_ARCHIVES) {
    const mask = need(assets, `snow_surface_masks_${a}`, 'snowfall.dfmod');
    if (mask.length !== SNOW_MASK_BYTES) throw new Error(`snow_surface_masks_${a}: ${mask.length} bytes, not ${SNOW_MASK_BYTES}`);
    out.set(`public/art/snowfall/snow_surface_masks_${a}.bytes`, mask);
    files.push(`snow_surface_masks_${a}.bytes`);
  }
  for (const a of SNOWFALL_ARCHIVES) {
    for (let r = 0; r < 56; r++) if (!pics.has(`${a}_${r}-0`)) throw new Error(`snowfall.dfmod lacks ${a}_${r}-0`);
  }
  files.sort(byRecord);
  records.sort((x, y) => byRecord(x[0], y[0]));
  report.push(`  ${records.length} winter records, snow_albedo, ${SNOWFALL_ARCHIVES.length} surface masks`);
  out.set('vendor/snowfall/snowfall.files.json', json({
    ModTitle: m.json.ModTitle, ModVersion: m.json.ModVersion, ModAuthor: m.json.ModAuthor, Source: SOURCES.snowfall,
    Bundle: 'snowfall.dfmod', BundleSha256: sha(bytes),
    Note: "Generated by tools/environmentModsExtract.mjs from the shipped bundle - not written by hand. Every file under public/art/snowfall/: the bundle's 168 winter ground records (TEXTURE.103, .303 and .403 - Daggerfall's winter tiles under the author's snow, RGB24, mip 0 written losslessly), its snow albedo, and its three surface-mask TextAssets (SnowCoverageData's 56 records of 64 x 64 coverage bytes each). The authority test/doctrine.test.js reads for what may stand in that directory.",
    Files: files,
    Sha256: Object.fromEntries(files.map((f) => [f, sha(out.get(`public/art/snowfall/${f}`))])),
  }));
  out.set('vendor/snowfall/snowfall.index.json', json({
    Pack: 'Snowfall', Source: SOURCES.snowfall, Root: 'art/snowfall',
    Mods: [{
      key: dfmodStoreKey('snowfall.dfmod'), dir: '.',
      index: {
        v: DFMOD_INDEX_VERSION, title: m.json.ModTitle, version: m.json.ModVersion, author: m.json.ModAuthor, guid: m.json.GUID,
        // SNOWFALL1: the port orders the shipped winter records after Vanilla Enhanced's Base (an optional dependency, which
        // orders when the Base is attached and is dropped when it is not - dfmodLoadOrder), as a player orders Snowfall
        // in DFU's mod window for its packaged winter archives to decide over the Base's arrays. The shipped manifest
        // names none (`"Dependencies": []`) - bible/03-World/Snowfall.md, the departures.
        deps: [...manifestDeps(m.json), ['vanilla enhanced - base', true, false]],
        textures: records, arrays: [], xml: {},
      },
    }],
  }));
  return { out, report };
}

/** Sands of the Alik'r: the loose pictures, byte for byte, and the door's index. */
export function sandsFiles(dir) {
  const out = new Map();
  const names = sorted(readdirSync(dir).filter((n) => /\.png$/i.test(n))).sort(byRecord);
  const records = [];
  for (const n of names) {
    const m = /^002_(\d+)-0\.png$/.exec(n);
    if (!m) throw new Error(`Sands of the Alik'r: an unexpected file ${n}`);
    const bytes = new Uint8Array(readFileSync(join(dir, n)));
    out.set(`public/art/sands-of-the-alikr/${n}`, bytes);
    // the PNG's own size, off its IHDR - every one is a 64 x 64 terrain record
    const v = new DataView(bytes.buffer, bytes.byteOffset);
    records.push([n.replace(/\.png$/i, ''), v.getUint32(16), v.getUint32(20)]);
  }
  out.set('vendor/sands-of-the-alikr/sands-of-the-alikr.files.json', json({
    ModTitle: "Sands of the Alik'r", ModVersion: '2', ModAuthor: null, Source: SOURCES['sands-of-the-alikr'],
    Archive: 'Sands_Of_The_AlikR_1390_2_2026-09-14T18-24Z_bWMMNpOWt.7z',
    Note: "Generated by tools/environmentModsExtract.mjs from the shipped archive's Textures/ folder - not written by hand. Every file under public/art/sands-of-the-alikr/, byte for byte: the pack's 47 loose TEXTURE.002 records (Daggerfall's desert tiles under the author's sand). The archive's Mod Screenshots/ are not carried. The authority test/doctrine.test.js reads for what may stand in that directory.",
    Files: names,
    Sha256: Object.fromEntries(names.map((n) => [n, sha(out.get(`public/art/sands-of-the-alikr/${n}`))])),
  }));
  out.set('vendor/sands-of-the-alikr/sands-of-the-alikr.index.json', json({
    Pack: "Sands of the Alik'r", Source: SOURCES['sands-of-the-alikr'], Root: 'art/sands-of-the-alikr',
    Mods: [{
      key: dfmodStoreKey('sands of the alikr.dfmod'), dir: '.',
      index: {
        v: DFMOD_INDEX_VERSION, title: "Sands of the Alik'r", version: '2', author: null, guid: null,
        // ALIKR1: a loose pack in DFU, shipped as the door's mod; ordered after Vanilla Enhanced's Base (optional - see
        // snowfall.index.json) so its records keep their names on the texture door, and the desert's ground follows the
        // pack's own rule: `looseGround` - TEXTURE.002 made of its records over Daggerfall's own, as DFU makes it from a
        // loose folder no mod's array overrides (systems/dfmodTextures.js groundSource, ALIKR1)
        deps: [['vanilla enhanced - base', true, false]],
        textures: records, arrays: [], xml: {}, looseGround: [2],
      },
    }],
  }));
  return { out, report: [`sands of the alik'r: ${names.length} records`] };
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

function main() {
  const heat = arg('--heat'), wind = arg('--windfall'), windReadme = arg('--windfall-readme'), snow = arg('--snowfall'), sands = arg('--sands');
  if (!heat || !wind || !windReadme || !snow || !sands) {
    console.error('usage: node tools/environmentModsExtract.mjs --heat <heat-haze.dfmod> --windfall <windfall.dfmod> --windfall-readme <README-Windfall-Console-Commands.txt> --snowfall <snowfall.dfmod> --sands <Textures dir> [--write]');
    process.exit(2);
  }
  const parts = [
    heatHazeFiles(new Uint8Array(readFileSync(heat))),
    windfallFiles(new Uint8Array(readFileSync(wind)), new Uint8Array(readFileSync(windReadme))),
    snowfallFiles(new Uint8Array(readFileSync(snow))),
    sandsFiles(sands),
  ];
  const out = new Map(parts.flatMap((p) => [...p.out]));
  for (const p of parts) for (const line of p.report) console.log(line);
  // the art directories are the tool's whole: a file there it does not make is a stranger
  const ART = ['public/art/snowfall', 'public/art/sands-of-the-alikr', 'vendor/windfall/Textures', 'vendor/windfall/Sound'];
  const have = ART.flatMap((d) => (existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).map((n) => `${d}/${n}`) : []));
  if (process.argv.includes('--write')) {
    for (const p of have) if (!out.has(p)) rmSync(join(ROOT, p));
    for (const [p, bytes] of out) { mkdirSync(dirname(join(ROOT, p)), { recursive: true }); writeFileSync(join(ROOT, p), bytes); }
    console.log(`wrote ${out.size} files`);
    return;
  }
  const bad = [];
  for (const [p, bytes] of out) {
    const f = join(ROOT, p);
    if (!existsSync(f)) bad.push(`${p}: missing`);
    else if (sha(readFileSync(f)) !== sha(bytes)) bad.push(`${p}: differs`);
  }
  for (const p of have) if (!out.has(p)) bad.push(`${p}: in the tree, not made by the archives`);
  if (bad.length) { console.error(bad.slice(0, 40).join('\n') + (bad.length > 40 ? `\n... ${bad.length - 40} more` : '')); process.exit(1); }
  console.log(`the tree matches: ${out.size} files (${basename(heat)}, ${basename(wind)}, ${basename(snow)}, ${basename(sands)})`);
}

if (isMain(import.meta.url)) main();
