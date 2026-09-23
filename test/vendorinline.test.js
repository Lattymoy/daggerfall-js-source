// INLINE1 (2026-09-20, Mac: "Want to talk about overall performance
// improvements"): NOTHING UNDER vendor/ IS EVER INLINED AS BASE64, AND THE
// PIN IS GENERATIVE. The rule that preceded this was an allow-list of three
// vendor folders, and the pins that held it named the folders it held OUT
// ("every other vendor asset keeps the default"). That is a rule enforced
// by memory, and it bit on schedule: twenty vendor folders landed after the
// list and none joined it, and Shield Widget's 275 under-4 KB sprites went
// into the weaponRig chunk - which main imports STATICALLY - as 1.34 MB of
// nearly incompressible base64, a megabyte on the wire before first paint.
//
// So this walks vendor/ itself. Every file the default limit would inline
// is put through the real rule from vite.config.js, and the day a new mod
// lands with small art this goes on holding without anyone remembering to
// add a folder. The negative half is held too: a path outside vendor/ still
// gets Vite's default, because a rule that inlined nothing anywhere would
// pass every assertion above and be the opposite mistake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VITE_DEFAULT_INLINE = 4096;   // build.assetsInlineLimit's default

/** The rule, as vite.config.js actually spells it - not a copy. */
function inlineRule() {
  const cfg = readFileSync(join(root, 'vite.config.js'), 'utf8');
  const m = /assetsInlineLimit: \(filePath\) => \((.*?)\),/.exec(cfg);
  assert.ok(m, 'vite.config.js no longer carries the assetsInlineLimit callback');
  // eslint-disable-next-line no-new-func
  return new Function('filePath', `return (${m[1]});`);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push({ path: p, size: st.size });
  }
  return out;
}

test('INLINE1: every vendored file under the default inline limit is refused by the rule - derived from the tree, not a list', () => {
  const rule = inlineRule();
  const files = walk(join(root, 'vendor'));
  const small = files.filter((f) => f.size < VITE_DEFAULT_INLINE);
  // The measurement that makes this non-academic: without the rule these
  // would all be base64 in a chunk. If this number ever drops near zero the
  // vendor tree has changed shape and the pin should be re-read.
  assert.ok(small.length > 1000, `${small.length} vendored files sit under the inline limit`);
  const inlined = small.filter((f) => rule(f.path) !== false).map((f) => relative(root, f.path));
  assert.deepEqual(inlined.slice(0, 10), [], `${inlined.length} vendored file(s) would be inlined (first ten shown) - the rule stopped covering vendor/`);
  // and the class covers every vendor FOLDER, not just the ones with art today
  const folders = readdirSync(join(root, 'vendor')).filter((n) => statSync(join(root, 'vendor', n)).isDirectory());
  for (const f of folders) assert.equal(rule(join(root, 'vendor', f, 'x.png')), false, `vendor/${f} is not covered`);
  assert.ok(folders.length >= 20, `${folders.length} vendor folders - the enumeration this replaced named three`);
});

test('INLINE1: outside vendor/ the default stands - the rule is the class, not "inline nothing"', () => {
  const rule = inlineRule();
  for (const p of ['/x/src/ui/icons/diamond.png', 'C:\\x\\src\\assets\\mw\\textures\\thunderlock.dds', '/x/public/favicon.png']) {
    assert.equal(rule(p), undefined, `${p} must fall through to Vite's default`);
  }
});
