// BOOT1 (2026-09-20, Mac: "overall performance improvements"): THE GAME
// HOSTS ARE NOT ON THE ENTRY'S STATIC GRAPH. src/main.js imported all four
// scene hosts statically, which put 623 files and 13.4 MB of source - the
// whole game - on the boot path before boot() ran a line, while the menu a
// player sees first was the thing behind a dynamic import. Inverted.
//
// The first pin walks the entry's STATIC import graph itself, transitively,
// exactly as the bundler will, and holds that no host is on it. A regex on
// main.js's import lines would go vacuous the day any other module on the
// entry imported a host on main.js's behalf; the walk cannot. The set of
// hosts is DERIVED - every file under src/scenes/ that exports a boot door -
// so a fifth host lands under the same law with nobody adding it here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');

const STATIC = /^\s*(?:import\s[^'"]*?from\s*|import\s*|export\s[^'"]*?from\s*)['"]([^'"]+)['"]/gm;
function resolveSpec(from, spec) {
  if (!spec.startsWith('.')) return null;
  const p = resolve(dirname(from), spec);
  for (const c of [p, p + '.js']) { try { if (statSync(c).isFile()) return c; } catch { /* next */ } }
  return null;
}
/** Every file reachable from `entry` by STATIC edges alone - what a browser must evaluate before the entry runs. */
function staticReach(entry) {
  const seen = new Set(); const q = [resolve(root, entry)];
  while (q.length) {
    const f = q.pop(); if (seen.has(f)) continue; seen.add(f);
    let s; try { s = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of s.matchAll(STATIC)) { const t = resolveSpec(f, m[1]); if (t && /\.m?js$/.test(t) && !seen.has(t)) q.push(t); }
  }
  return seen;
}
/** The hosts: derived, not listed. */
const hosts = () => readdirSync(join(root, 'src/scenes')).filter((f) => f.endsWith('.js') && /^export (?:async )?function boot[A-Z]/m.test(rd(`src/scenes/${f}`)));

test('BOOT1: no scene host is on the entry\'s static import graph - walked transitively, hosts derived from the tree', () => {
  const found = hosts();
  assert.ok(found.length >= 4, `${found.length} hosts export a boot door - the set this pin derives is not academic`);
  const reach = staticReach('src/main.js');
  const onEntry = found.filter((f) => reach.has(resolve(root, 'src/scenes', f))).map((f) => `src/scenes/${f}`);
  assert.deepEqual(onEntry, [], 'a host is statically reachable from src/main.js - the whole game is back on the boot path');
  // ...and each is still reachable by its DOOR: a dynamic import naming the file and calling its boot export.
  const main = rd('src/main.js');
  for (const f of found) {
    const boot = /^export (?:async )?function (boot[A-Z]\w*)/m.exec(rd(`src/scenes/${f}`))[1];
    const door = new RegExp(`import\\('\\./scenes/${f.replace('.', '\\.')}'\\)\\.then\\(\\(m\\) => m\\.${boot}\\(`);
    assert.match(main, door, `${f}: no dynamic door calling ${boot} - the route would have no host to boot`);
  }
  // the measurement, so the claim has a number: the entry's static reach is a fraction of the tree
  const all = [];
  (function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.js')) all.push(p); } })(join(root, 'src'));
  assert.ok(reach.size < all.length * 0.6, `the entry statically reaches ${reach.size} of ${all.length} src files - BOOT1 measured 623 of them before, and this ceiling holds the graph un-inverted`);
});

test('BOOT1: the world host warms up behind the menu, before the menu is awaited, and never rejects unhandled', () => {
  const main = rd('src/main.js');
  const warm = main.indexOf("import('./scenes/world.js').catch(() => {});");
  const menu = main.indexOf("const { runEnhancedMenu } = await import('./ui/enhancedMenu.js');");
  assert.ok(warm > 0, 'the warm-up is gone - Play pays for the world host at the click');
  assert.ok(menu > 0, 'the enhanced menu door is gone - re-aim this pin');
  assert.ok(warm < menu, 'the warm-up must START before the menu is awaited, or it downloads after the player has already clicked Play');
  // and it is the same file the doors boot, so the warm-up warms the thing that is actually used
  assert.match(main, /const bootWorld = \(\.\.\.a\) => import\('\.\/scenes\/world\.js'\)/, 'the door and the warm-up name one file');
});
