// SAFARI1 (2026-09-22) - NO REGEX LOOKBEHIND IN ANYTHING A BROWSER LOADS.
//
// `(?<=...)` and `(?<!...)` are a PARSE error in Safari before 16.4 -
// macOS 12 and older, iOS 16.3 and older. Not a wrong answer: the whole
// module refuses to load, and with it every chunk that imports it. Two
// lookbehinds in src/systems/controlsConfig.js sat in the chunk BOTH
// the menu and the world import, so a player on an older Mac or iPhone
// got no game at all. esbuild does not lower regex syntax, so the build
// target cannot catch this; this walk does.
//
// DERIVED, NOT LISTED: every .js under src/ is read, so a new file is
// held to it the day it lands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { splitCamel } from '../src/systems/controlsConfig.js';

const root = new URL('../src/', import.meta.url).pathname;
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js)$/.test(name)) out.push(p);
  }
  return out;
}
const LOOKBEHIND = /\(\?<[=!]/;

test('SAFARI1: no file under src/ carries a regex lookbehind - an older Safari cannot parse the module at all', () => {
  const files = walk(root);
  assert.ok(files.length > 500, `the walk found ${files.length} files - it is not reading the tree`);
  // POSITIVE CONTROL: the pattern sees the exact line that shipped
  assert.match("text.replace(/(?<=[a-z])([A-Z])/g, ' $1')", LOOKBEHIND);
  assert.doesNotMatch("s.replace(/([a-z])([A-Z])/g, '$1 $2')", LOOKBEHIND);
  const offenders = files.filter((f) => LOOKBEHIND.test(readFileSync(f, 'utf8'))).map((f) => f.slice(root.length));
  assert.deepEqual(offenders, [], 'these files would not load in Safari before 16.4');
});

test('SAFARI1: the camel split without a lookbehind says exactly what DFU\'s did', () => {
  const dfu = (s) => s.replace(new RegExp('(?<=[a-z])([A-Z])', 'g'), ' $1').trim();   // node parses it; only the shipped source may not
  for (const s of ['ActivateCenterObject', 'MoveForwards', 'aBC', 'aBcD', 'X', 'Mouse1', 'ToggleConsole', 'aB', '']) {
    assert.equal(splitCamel(s), dfu(s), s);
  }
});
