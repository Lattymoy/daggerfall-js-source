// Regenerate src/characters/enemyBasics.js from DFU's EnemyBasics.cs
// Enemies table (MIT, Daggerfall Workshop). C3 extracted the visual
// fields; E3a re-extracts with the combat/entity fields. HARD RULE:
// the three C3 fields must come out byte-identical for every existing
// key - asserted below against the current module before writing.
// Usage: node tools/extract-enemy-basics.mjs /path/to/EnemyBasics.cs
//
// AUDIT 24 (wave 23): the extraction itself now lives in
// extractEnemyBasics.lib.mjs as a pure function, so the SAME code the
// gate in test/audit24_enemytable.test.js runs is the code that writes
// this file. A column the extraction never looked at used to be
// invisible from both sides - see the library header.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { extractEnemyBasics } from './extractEnemyBasics.lib.mjs';

const src = readFileSync(process.argv[2], 'utf8');
// SoundClips.cs rides next to EnemyBasics.cs's tree (Assets/Scripts/SoundClips.cs)
const scPath = process.argv[3] || join(dirname(process.argv[2]), '..', 'SoundClips.cs');
const out = extractEnemyBasics(src, readFileSync(scPath, 'utf8'));

// Assert C3 parity before writing
const cur = (await import(pathToFileURL(new URL('../src/characters/enemyBasics.js', import.meta.url).pathname))).ENEMY_BASICS;
for (const [k, v] of Object.entries(cur)) {
  const n = out[k];
  if (!n) throw new Error(`ASSERT FAIL: key ${k} missing from re-extraction`);
  for (const f of ['maleTexture', 'femaleTexture', 'behaviour']) {
    if (n[f] !== v[f]) throw new Error(`ASSERT FAIL: ${k}.${f}: ${v[f]} -> ${n[f]}`);
  }
}
console.log(`ASSERT: C3 parity holds for ${Object.keys(cur).length} keys; re-extracted ${Object.keys(out).length}`);

const body = JSON.stringify(out, null, 1).replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, "'$1':").replace(/"/g, "'");
writeFileSync(new URL('../src/characters/enemyBasics.js', import.meta.url),
`// Enemy visual/behaviour/entity basics (Characters C3, re-extracted
// E3a with combat fields). Generated from DFU's EnemyBasics.cs
// Enemies table (MIT, Daggerfall Workshop): textures + Behaviour
// (C3, byte-identical parity asserted at generation) + affinity,
// corpse texture, MinMetalToHit (material index, None=-1), monster
// damage pairs 1-3 + health/level/armor, soul points, team, loot key,
// flags.
// Class entries (128+) carry no health/level/damage - those come
// from the career (CLASS*.CFG) + FormulaHelper, per SetEnemyCareer.
// Do not hand-edit; regenerate: node tools/extract-enemy-basics.mjs
export const ENEMY_BASICS = Object.freeze(${body});
`);
console.log('written');
