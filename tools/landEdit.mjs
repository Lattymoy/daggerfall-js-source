#!/usr/bin/env node
// FOUNDATION F4 (2026-10-30, bible/03-World/Foundation-Arc.md): A LAND EDIT WRITTEN AS DATA - one row onto
// src/world/land/landEdits.json, checked by the law every reader reads (world/land/landLayer.js landRowProblems). A shore or
// a hill is fixed by a row, never by code.
//   node tools/landEdit.mjs --x 207 --y 212 [--w 3 --h 2] [--height 0] [--climate 223] --note "why"
//   node tools/landEdit.mjs --check     every row of the file checked
import { readFileSync, writeFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';
import { landRowProblems, landLayerOf } from '../src/world/land/landLayer.js';

const FILE = new URL('../src/world/land/landEdits.json', import.meta.url);

/** The file with `row` appended - a new object; throws a row the law refuses. @param {{ version: number, edits: any[] }} json @param {any} row */
export function addLandRow(json, row) {
  const problems = landRowProblems(row);
  if (problems.length) throw new Error(`the row is refused: ${problems.join(', ')}`);
  return { ...json, edits: [...json.edits, row] };
}

if (isMain(import.meta.url)) {
  const json = JSON.parse(readFileSync(FILE, 'utf8'));
  if (process.argv.includes('--check')) {
    const layer = landLayerOf(json);
    console.log(`${layer.rows.length} row(s), ${layer.size} pixel(s), ${layer.dropped.length} refused${layer.dropped.length ? `: rows ${layer.dropped.join(', ')}` : ''}`);
    process.exit(layer.dropped.length ? 1 : 0);
  }
  const arg = (/** @type {string} */ k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
  const num = (/** @type {string} */ k) => (arg(k) === undefined ? undefined : Number(arg(k)));
  const row = Object.fromEntries(Object.entries({ x: num('x'), y: num('y'), w: num('w'), h: num('h'), height: num('height'), climate: num('climate'), note: arg('note') }).filter(([, v]) => v !== undefined));
  writeFileSync(FILE, `${JSON.stringify(addLandRow(json, row), null, 2)}\n`);
  console.log(`written: ${JSON.stringify(row)}`);
}
