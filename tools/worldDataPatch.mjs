#!/usr/bin/env node
// WD1 (2026-09-25): A MOD'S WORLD-DATA FILE, AS A DIFF OF THE CLASSIC BLOCK.
//
// Aquatic Sprites, Detailed Ships and Warm Ashes - Ships ship whole
// blocks and whole building records as DFU's World Data Editor writes
// them - the classic block with the author's edits in it. This tool
// takes each file against the player's own BLOCKS.BSA (the block the
// editor read it out of), keeps only the edit (formats/worldDataJson.js
// diffJson) and checks that the edit, laid back on the classic block,
// gives the author's file again - canonical form, sha256 for sha256 -
// before it writes anything.
//
//   node tools/worldDataPatch.mjs <arena2> <out dir> <mod file>...
//
// A mod file is the TextAsset out of the bundle under its asset name
// (`SHIPAA00.RMB_base`, `W0000000.RDB`, `SHIPAA00.RMB-390-building0`);
// the patch is written as `<out dir>/<asset name>.json` and rebuilds the
// DFU file `<asset name>.json`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { isMain } from './lib/isMain.mjs';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { blockToDfuJson, buildingToDfuJson, diffJson, canonicalJson } from '../src/formats/worldDataJson.js';
import { PATCH_FORMAT, rebuildWorldDataPatch } from '../src/formats/worldDataPatch.js';

/** What a world-data asset name says it is: a block (with its variant) or a building record of a block. */
export function parseWorldDataName(name) {
  const building = /^([A-Z0-9]+\.RMB)-(\d+)-building(\d+)(.*)$/.exec(name);
  if (building) return { kind: 'building', block: building[1], index: Number(building[2]), record: Number(building[3]), variant: building[4] };
  const block = /^([A-Z0-9]+\.(?:RMB|RDB|RDI))(.*)$/.exec(name);
  if (block) return { kind: 'block', block: block[1], variant: block[2] };
  throw new Error(`world-data patch: ${name} is neither a block nor a building file`);
}

/** The classic JSON a file of this name is an edit of. */
export function classicBaseFor(blocks, parsed) {
  const index = blocks.getBlockIndex(parsed.block);
  if (index < 0) throw new Error(`world-data patch: ${parsed.block} is not in BLOCKS.BSA`);
  if (parsed.kind === 'building' && parsed.index !== index) throw new Error(`world-data patch: ${parsed.block} is block ${index}, the file says ${parsed.index}`);
  const dfBlock = blocks.readClassicBlock(index);
  if (!dfBlock) throw new Error(`world-data patch: ${parsed.block} did not read`);
  return { index, json: parsed.kind === 'building' ? buildingToDfuJson(dfBlock, parsed.record) : blockToDfuJson(dfBlock) };
}

export const sha256Canonical = (json) => createHash('sha256').update(canonicalJson(json)).digest('hex');

/** Every object that is an element of an array, by the array's key: the
 *  records a mod's inserted record may be a moved copy of. */
function recordsByArrayKey(doc, block, into) {
  const walk = (v, path) => {
    if (Array.isArray(v)) {
      const key = [...path].reverse().find((k) => typeof k === 'string');
      v.forEach((x, i) => {
        if (x && typeof x === 'object' && !Array.isArray(x)) {
          if (!into.has(key)) into.set(key, []);
          into.get(key).push({ block, path: [...path, i], node: x });
        }
        walk(x, [...path, i]);
      });
    } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, [...path, k]);
  };
  walk(doc, []);
  return into;
}

const COPY_MIN_BYTES = 400;   // a record smaller than this is carried whole (a flat, a model)
/** Replace each large inserted or set record that is a moved copy of a
 *  classic record by a copy op and the author's edits to it. */
function preferCopies(ops, sources) {
  const out = [];
  for (const op of ops) {
    const [kind, path, value] = op;
    const whole = JSON.stringify(op);
    if ((kind !== 'i' && kind !== 's') || !value || typeof value !== 'object' || Array.isArray(value) || whole.length < COPY_MIN_BYTES) { out.push(op); continue; }
    const key = [...path].reverse().find((k) => typeof k === 'string');
    let best = null;
    for (const c of sources.get(key) ?? []) {
      const sub = diffJson(c.node, value).map((o) => [o[0], [...path, ...o[1]], ...o.slice(2)]);
      const size = JSON.stringify(sub).length + 80;
      if (!best || size < best.size) best = { c, sub, size };
    }
    if (best && best.size < whole.length * 0.6) {
      out.push([kind === 'i' ? 'ci' : 'cs', path, { block: best.c.block, path: best.c.path }], ...best.sub);
    } else out.push(op);
  }
  return out;
}

/** The patch for one mod file, checked. `copyFrom` names the classic
 *  blocks (their indices) whose records an inserted record may copy. */
export function makePatch(blocks, assetName, modJson, copyFrom = []) {
  const parsed = parseWorldDataName(assetName);
  const { index, json: base } = classicBaseFor(blocks, parsed);
  const sources = new Map();
  for (const bi of new Set([index, ...copyFrom])) {
    const b = blocks.readClassicBlock(bi);
    if (b) recordsByArrayKey(blockToDfuJson(b), bi, sources);
  }
  const ops = preferCopies(diffJson(base, modJson), sources);
  const baseRef = parsed.kind === 'building'
    ? { kind: 'building', block: parsed.block, index, record: parsed.record }
    : { kind: 'block', block: parsed.block, index };
  const patch = { format: PATCH_FORMAT, rebuilds: `${assetName}.json`, base: baseRef, sha256: sha256Canonical(modJson), ops };
  // Checked through the runtime's own rebuild (formats/worldDataPatch.js), not a second copy of it.
  if (sha256Canonical(rebuildWorldDataPatch(patch, blocks)) !== patch.sha256) throw new Error(`world-data patch: ${assetName} does not rebuild`);
  return patch;
}

/** One op a line: small, and a re-run's diff reads op for op. */
export function formatPatch(patch) {
  const { ops, ...head } = patch;
  const h = JSON.stringify(head);
  return `${h.slice(0, -1)},"ops":[\n${ops.map((o) => JSON.stringify(o)).join(',\n')}\n]}\n`;
}

if (isMain(import.meta.url)) {
  const [arena2, outDir, ...files] = process.argv.slice(2);
  if (!arena2 || !outDir || !files.length) {
    console.error('usage: node tools/worldDataPatch.mjs <arena2> <out dir> <mod file>...');
    process.exit(1);
  }
  const blocks = new BlocksFile();
  if (!blocks.load(new Uint8Array(readFileSync(join(arena2, 'BLOCKS.BSA'))))) throw new Error('BLOCKS.BSA did not load');
  mkdirSync(outDir, { recursive: true });
  // Every block the batch names is a copy source for every file in it.
  const copyFrom = [...new Set(files.map((f) => blocks.getBlockIndex(parseWorldDataName(basename(f).replace(/\.json$/, '')).block)))];
  for (const file of files) {
    const name = basename(file).replace(/\.json$/, '');
    const text = readFileSync(file, 'utf8');
    const modJson = JSON.parse(text);
    const patch = makePatch(blocks, name, modJson, copyFrom);
    const out = join(outDir, `${name}.json`);
    const body = formatPatch(patch);
    writeFileSync(out, body);
    console.log(`  ${name}: ${patch.ops.length} ops, ${body.length} bytes (the shipped file is ${text.length}) -> ${out}`);
  }
}
