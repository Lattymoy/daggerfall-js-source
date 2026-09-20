// BOOT2 (2026-09-20, Mac: "overall performance improvements", after BOOT1):
// A CURSOR MUST NOT NEED THE HUD TO CONVERT A BITMAP. With the four hosts
// behind doors (BOOT1), the entry's static graph was still 259 files and
// 4.9 MB of source, and ONE edge carried 216 files / 4.1 MB of it:
// ui/cursor.js imported `bitmapToColor32` - a pure palette lookup - from
// ui/hud.js, and the HUD imports the enhanced HUD, which imports the world
// tick, which imports the game. The helper is a formats concern and lives
// in formats/color32Order.js now, with every importer repointed and hud.js
// importing it back like everyone else.
//
// Three laws, each derived from the tree rather than listed:
//   1. ONE HOME - exactly one definition, in the leaf; nobody imports it
//      from hud.js and hud.js exports it to nobody (a re-export would put
//      the hub edge back for whoever took the shortcut).
//   2. The cursor is a LEAF - it imports formats and nothing under ui/.
//   3. The entry's static reach neither touches the two hubs this slice
//      found (ui/hud.js, systems/worldTick.js) nor exceeds a ceiling that
//      the measurement set: 43 files after the cut, held under 60.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const STATIC = /^\s*(?:import\s[^'"]*?from\s*|import\s*|export\s[^'"]*?from\s*)['"]([^'"]+)['"]/gm;
const resolveSpec = (from, spec) => { if (!spec.startsWith('.')) return null; const p = resolve(dirname(from), spec); for (const c of [p, p + '.js']) { try { if (statSync(c).isFile()) return c; } catch { /* next */ } } return null; };
const walk = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.m?js$/.test(n)) out.push(p); } return out; };
function staticReach(entry) {
  const seen = new Set(); const q = [resolve(root, entry)];
  while (q.length) { const f = q.pop(); if (seen.has(f)) continue; seen.add(f); let s; try { s = readFileSync(f, 'utf8'); } catch { continue; } for (const m of s.matchAll(STATIC)) { const t = resolveSpec(f, m[1]); if (t && /\.m?js$/.test(t) && !seen.has(t)) q.push(t); } }
  return seen;
}

test('BOOT2: bitmapToColor32 has ONE home, the formats leaf - nobody takes it from the HUD and the HUD hands it to nobody', () => {
  const defs = walk(join(root, 'src')).filter((f) => /^export (?:function|const) bitmapToColor32\b/m.test(readFileSync(f, 'utf8'))).map((f) => relative(root, f));
  assert.deepEqual(defs, ['src/formats/color32Order.js'], 'the definition is in exactly one place, and it is the leaf');
  const hud = rd('src/ui/hud.js');
  assert.doesNotMatch(hud, /export\s*\{[^}]*\bbitmapToColor32\b/, 'hud.js re-exports it - the hub edge is back for whoever takes the shortcut');
  assert.match(hud, /import \{ bitmapToColor32 \} from '\.\.\/formats\/color32Order\.js';/, 'hud.js imports it from the leaf like every other caller');
  const fromHud = [];
  for (const f of [...walk(join(root, 'src')), ...walk(join(root, 'test'))]) {
    const s = readFileSync(f, 'utf8');
    if (/import\s*\{[^}]*\bbitmapToColor32\b[^}]*\}\s*from\s*'[^']*\/hud\.js'/.test(s)) fromHud.push(relative(root, f));
  }
  assert.deepEqual(fromHud, [], 'these still import bitmapToColor32 from hud.js');
});

test('BOOT2: the cursor is a leaf - formats in, nothing from ui/', () => {
  const cursor = rd('src/ui/cursor.js');
  const imports = [...cursor.matchAll(STATIC)].map((m) => m[1]);
  assert.ok(imports.length >= 2, `cursor.js imports ${imports.length} modules - re-read this pin`);
  const fromUi = imports.filter((s) => /^\.\/|\/ui\//.test(s));
  assert.deepEqual(fromUi, [], 'ui/cursor.js imports from ui/ - the entry installs the cursor, so whatever it imports is on the boot path');
});

test('BOOT2: the entry\'s static reach touches neither hub and stays under the ceiling the cut measured', () => {
  const reach = new Set([...staticReach('src/main.js')].map((f) => relative(root, f)));
  for (const hub of ['src/ui/hud.js', 'src/systems/worldTick.js', 'src/ui/enhancedHud.js']) {
    assert.ok(!reach.has(hub), `${hub} is on the entry's static graph again (${reach.size} files reached)`);
  }
  // 259 before the cut, 43 after; the ceiling leaves room for a real need and none for a hub.
  assert.ok(reach.size <= 60, `the entry statically reaches ${reach.size} files - BOOT2 measured 43 and holds the ceiling at 60`);
});
