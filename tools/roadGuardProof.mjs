#!/usr/bin/env node
// FAST-SUITE (2026-10-04): THE ROAD PAINTER'S SKIP GUARD, PROVEN - world/road/roadPainter.js paintRoads passes by every tile
// no painter can reach (off the centre cross, the two diagonals and the location rect). This runs the painter as it is
// against the painter as it stood BEFORE the guard - taken from git, `--ref` (default the guard's parent commit) - over
// every road, track, river and stream pixel of the shipped map (vendor/roads-hazelnut), water on and off, a location
// rect and a few location tiles on some, the GRASS-PATH1 paths mask on all; then a synthetic sweep of every road mask
// with random tracks, rivers, streams, corners and rects. Tilemap bytes, the paths mask and the count must agree,
// case for case. AUDIT FAST-SUITE: the record's "103,487 cases" could be checked by nobody until this was committed.
//
//   node tools/roadGuardProof.mjs                 # the whole proof (a few minutes)
//   node tools/roadGuardProof.mjs --every 25      # every 25th pixel of the map (a quick look)
//   node tools/roadGuardProof.mjs --ref <commit>  # against the painter of another commit
//
// Not a test: it needs the repository's history, which a shallow checkout has not. Exits 1 on any difference.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const GUARD_PARENT = 'ae33fe8e7';   // the commit the guard (a06279295) was made on

/** The painter as it stood at `ref`, its relative imports pointed back into this tree; answers its module. */
async function painterAt(ref) {
  const text = execFileSync('git', ['show', `${ref}:src/world/road/roadPainter.js`], { cwd: ROOT, encoding: 'utf8' })
    .replace(/from '\.\/([^']+)'/g, (_, p) => `from '${pathToFileURL(join(ROOT, 'src/world', p)).href}'`)
    .replace(/from '\.\.\/([^']+)'/g, (_, p) => `from '${pathToFileURL(join(ROOT, 'src', p)).href}'`);
  const dir = mkdtempSync(join(tmpdir(), 'roadguard-'));
  const file = join(dir, 'roadPainter.before.mjs');
  writeFileSync(file, text);
  try { return await import(pathToFileURL(file).href); } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function main(argv) {
  const at = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
  const every = Math.max(1, Number(at('--every')) || 1);
  const before = await painterAt(at('--ref') ?? GUARD_PARENT);
  const now = await import(pathToFileURL(join(ROOT, 'src/world/road/roadPainter.js')).href);
  const { MAP_W } = await import(pathToFileURL(join(ROOT, 'src/world/road/roadNetwork.js')).href);
  const plane = (f) => new Uint8Array(readFileSync(join(ROOT, 'vendor/roads-hazelnut', f)));
  const R = { road: plane('roadData.bytes'), track: plane('trackData.bytes'), river: plane('riverData.bytes'), stream: plane('streamData.bytes') };
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  let cases = 0, differing = 0;
  const check = (masks, corners, water, rect, prefill) => {
    const ground = new Uint8Array(129 * 129);
    for (let k = 0; k < ground.length; k++) ground[k] = Math.floor(rnd() * 5);
    const a = new Uint8Array(128 * 128), b = new Uint8Array(128 * 128);
    if (prefill) for (let k = 0; k < 300; k++) { const j = Math.floor(rnd() * 16384); a[j] = b[j] = 1 + Math.floor(rnd() * 200); }
    const pa = new Uint8Array(16384), pb = new Uint8Array(16384);
    const opts = (paths) => ({ river: masks.river, stream: masks.stream, water, paths, corners });
    const na = before.paintRoads(ground, a, masks.road, masks.track, rect, 129, opts(pa));
    const nb = now.paintRoads(ground, b, masks.road, masks.track, rect, 129, opts(pb));
    cases++;
    let same = na === nb;
    for (let k = 0; same && k < 16384; k++) if (a[k] !== b[k] || pa[k] !== pb[k]) same = false;
    if (!same && ++differing <= 5) console.log('DIFFERS', JSON.stringify({ masks, corners, water, rect, prefill }));
  };
  const cornersOf = (m, px, py) => now.pathCorners(m, px, py, MAP_W);
  let real = 0;
  for (let i = 0; i < R.road.length; i++) {
    const masks = { road: R.road[i], track: R.track[i], river: R.river[i], stream: R.stream[i] };
    const px = i % MAP_W, py = (i / MAP_W) | 0;
    const corners = { road: cornersOf(R.road, px, py), track: cornersOf(R.track, px, py), river: cornersOf(R.river, px, py), stream: cornersOf(R.stream, px, py) };
    if (!masks.road && !masks.track && !masks.river && !masks.stream && !corners.road && !corners.track && !corners.river && !corners.stream) continue;
    if (real++ % every) continue;
    const rect = i % 7 === 0 ? { xMin: 20 + Math.floor(rnd() * 30), yMin: 20 + Math.floor(rnd() * 30), xMax: 70 + Math.floor(rnd() * 50), yMax: 70 + Math.floor(rnd() * 50) } : null;
    check(masks, corners, true, rect, i % 3 === 0);
    if (i % 5 === 0) check(masks, corners, false, rect, false);
  }
  const map = cases;
  for (let m = 0; m < 256; m++) {
    for (let k = 0; k < 40; k++) {
      const r8 = () => Math.floor(rnd() * 256);
      check({ road: m, track: r8(), river: r8(), stream: r8() }, { road: r8(), track: r8(), river: r8(), stream: r8() }, rnd() < 0.7,
        rnd() < 0.5 ? { xMin: Math.floor(rnd() * 64), yMin: Math.floor(rnd() * 64), xMax: 64 + Math.floor(rnd() * 64), yMax: 64 + Math.floor(rnd() * 64) } : null, rnd() < 0.3);
    }
  }
  console.log(`${map} cases over the shipped map, ${cases} with the sweep: ${differing ? `${differing} DIFFER` : 'none differ'}`);
  return differing ? 1 : 0;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(e?.message ?? e); process.exitCode = 2; });
