// AUDIT 28 SELF-AUDIT 5: the DFU-constants diff, kept as a tool.
// Every `const int/float NAME = value` in a DFU checkout against every
// `export const SCREAMING_NAME = value` in src/. Same-named constants
// with different values are printed; most are name collisions across
// DFU classes, so read each against the port constant's OWN cited
// source before calling it a finding.
//   node tools/dfuConstDiff.mjs [/path/to/dfu/Assets/Scripts]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dfu = process.argv[2] ?? '/tmp/dfu/Assets/Scripts';
const walk = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const snake = (n) => n.replace(/(?<!^)(?=[A-Z])/g, '_').toUpperCase();
const consts = new Map();
for (const f of walk(dfu).filter((p) => p.endsWith('.cs'))) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\bconst\s+(?:int|float|double)\s+(\w+)\s*=\s*(-?[0-9]*\.?[0-9]+)f?\s*;/g)) {
    if (!consts.has(m.group?.(1) ?? m[1])) consts.set(m[1], []);
    consts.get(m[1]).push([Number(m[2]), f.slice(dfu.length + 1)]);
  }
}
const port = new Map();
for (const f of walk('src').filter((p) => p.endsWith('.js'))) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/^export const ([A-Z][A-Z0-9_]+) = (-?[0-9]*\.?[0-9]+);/gm)) {
    if (!port.has(m[1])) port.set(m[1], []);
    port.get(m[1]).push([Number(m[2]), f]);
  }
}
let shared = 0, mismatches = 0;
for (const [name, vals] of consts) {
  const sn = snake(name);
  if (!port.has(sn)) continue;
  shared++;
  for (const [pv, pf] of port.get(sn)) {
    if (!vals.some(([v]) => Math.abs(v - pv) < 1e-9)) { mismatches++; console.log(`MISMATCH ${name}: DFU ${JSON.stringify(vals)} vs port ${sn}=${pv} (${pf})`); }
  }
}
console.log(`compared ${shared} shared names; ${mismatches} mismatches`);
