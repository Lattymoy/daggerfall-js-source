#!/usr/bin/env node
// Export the EXACT current neutral rig for the one-shot skin baker.
//
// The texture pipeline used to rely on a hand-dumped neutral.json plus a second
// lm_rig.json landmark sidecar. That makes geometry drift invisible: a sculpt
// can change while the old files keep baking successfully. mvB2 now derives its
// landmarks from neutral.json, and this tool makes neutral.json directly from
// buildNeutralBody(), so there is one geometry authority again.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNeutralBody } from '../../src/characters/neutralBody.js';

// Geometry and _i do not depend on an ART_PAL colour choice. A neutral grayscale
// ramp keeps this exporter ARENA2-free; bake_atlas.py uses _i for unresolved
// fallback texels rather than these dummy colours.
const gray = Array.from({ length: 16 }, (_, i) => {
  const v = Math.round((i / 15) * 255);
  return [v, v, v];
});

const faces = buildNeutralBody({ skin: gray, boot: gray });
if (!faces.length) throw new Error('buildNeutralBody returned no faces');

const KEEP = new Set(['body', 'head', 'armL', 'armR', 'legL', 'legR']);
const out = faces.map((f, i) => {
  if (!KEEP.has(f.g)) throw new Error(`face ${i} has unknown group ${f.g}`);
  if (!Array.isArray(f.p) || f.p.length !== 12) throw new Error(`face ${i} has invalid corners`);
  if (!Array.isArray(f.n) || f.n.length !== 3) throw new Error(`face ${i} has invalid normal`);
  return {
    p: f.p.map(Number),
    n: f.n.map(Number),
    g: f.g,
    _i: Number(f._i ?? 0.6),
  };
});

const target = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL('./neutral.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(out)}\n`);

const groups = Object.fromEntries([...KEEP].map((g) => [g, 0]));
for (const f of out) groups[f.g]++;
console.log(`wrote ${target}`);
console.log(`${out.length} faces`, groups);
