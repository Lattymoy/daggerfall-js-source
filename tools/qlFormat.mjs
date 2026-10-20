#!/usr/bin/env node
// QL1: the questlines' data files in their one form - a family's sheets one a line, its patches one a quest a line - so a
// wave's diff reads quest by quest. `node tools/qlFormat.mjs` rewrites every file under src/systems/questlines/{sheets,patches};
// `node tools/qlFormat.mjs --file <path>` rewrites that one file alone (AUDIT QUESTLINES DOC-35).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'systems', 'questlines');
export function formatFamily(data, key) {
  const head = `{\n  "family": ${JSON.stringify(data.family)},\n  "${key}": `;
  if (key === 'sheets') {
    const rows = data.sheets.map((s) => `    ${JSON.stringify(s)}`);
    return `${head}${rows.length ? `[\n${rows.join(',\n')}\n  ]` : '[]'}\n}\n`;
  }
  const rows = Object.entries(data.patches).map(([q, list]) => `    ${JSON.stringify(q)}: ${JSON.stringify(list)}`);
  return `${head}${rows.length ? `{\n${rows.join(',\n')}\n  }` : '{}'}\n}\n`;
}
export function formatAll() {
  for (const [dir, key] of [['sheets', 'sheets'], ['patches', 'patches']]) {
    for (const f of readdirSync(join(ROOT, dir))) {
      if (!f.endsWith('.json')) continue;
      const p = join(ROOT, dir, f);
    writeFileSync(p, formatFamily(JSON.parse(readFileSync(p, 'utf8')), key));
    }
  }
}
/** One file alone (a wave's writer formats its own family's file and no other's). */
export function formatFile(path) {
  const key = /[\\/]patches[\\/]/.test(path) ? 'patches' : 'sheets';
  writeFileSync(path, formatFamily(JSON.parse(readFileSync(path, 'utf8')), key));
}
if (isMain(import.meta.url)) {
  const i = process.argv.indexOf('--file');
  if (i >= 0) formatFile(process.argv[i + 1]); else formatAll();
}
