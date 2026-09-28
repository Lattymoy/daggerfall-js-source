#!/usr/bin/env node
// FLOW3 (2026-09-26, Mac: "is there a way to really ensure we have a faster workflow with the same standards?"): THE
// TESTS A CHANGE CAN MOVE, AND NO OTHERS - the loop while working. The whole suite is ~6 minutes; a change to one module
// is pinned by a few dozen files (a change to spoilsPool.js: ten, two seconds). A test file is chosen when
//   - it changed itself,
//   - a file it imports - through every module those import, `import`/`export ... from`/`import()` of a relative path -
//     changed, or
//   - its own text names a changed file, by its path or its name (the source pins read files by path: a comment's
//     cite, a regex over world.js, a workflow's YAML) - by name it chooses too many sometimes, never too few.
// A change to a file every test leans on (package.json, the lockfile, the test runner's own configuration) runs the
// whole suite. Changed is: against the merge base with origin/main (else HEAD), plus what is staged, unstaged and
// untracked. THE STANDARD IS UNCHANGED: CI runs every file on every PR and before every deploy (.github/workflows/
// verify.yml); this only decides what runs first, here.
//
//   npm run test:changed                       # run them
//   node tools/testChanged.mjs --list          # print them, one a line
//   node tools/testChanged.mjs --base HEAD~3   # changed since another point
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, normalize, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { isMain } from './lib/isMain.mjs';
import { testFiles } from './testShards.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Files whose change can move every test: the whole suite runs. */
export const EVERYTHING = new Set(['package.json', 'package-lock.json', 'tsconfig.json']);

const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

/** The relative specifiers a module's text imports, resolved against its own path (repo-relative), existing files
 *  only. Pure but for the existence check. */
export function importsOf(file, text, root = ROOT) {
  const out = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec || !spec.startsWith('.')) continue;
    const base = normalize(join(dirname(file), spec));
    for (const cand of [base, `${base}.js`, `${base}.mjs`, join(base, 'index.js')]) {
      const abs = join(root, cand);
      if (existsSync(abs) && statSync(abs).isFile()) { out.push(relative(root, abs).split('\\').join('/')); break; }
    }
  }
  return out;
}

/** Every file a test file reaches through its imports, itself included. */
export function closureOf(test, root = ROOT, cache = new Map()) {
  const seen = new Set([test]);
  const stack = [test];
  while (stack.length) {
    const f = stack.pop();
    let deps = cache.get(f);
    if (!deps) {
      let text = '';
      try { text = readFileSync(join(root, f), 'utf8'); } catch { /* gone: no imports */ }
      deps = importsOf(f, text, root);
      cache.set(f, deps);
    }
    for (const d of deps) if (!seen.has(d)) { seen.add(d); stack.push(d); }
  }
  return seen;
}

/**
 * THE CHOICE: the test files among `tests` a change to `changed` (repo-relative paths) can move - or 'all'. Pure but
 * for reading the files.
 * @param {string[]} changed @param {string[]} tests @returns {string[] | 'all'}
 */
export function testsFor(changed, tests, root = ROOT) {
  if (changed.some((f) => EVERYTHING.has(f))) return 'all';
  const set = new Set(changed);
  const names = [...new Set(changed.map((f) => basename(f)))];
  const cache = new Map();
  const chosen = [];
  for (const t of tests) {
    if (set.has(t)) { chosen.push(t); continue; }
    const reach = closureOf(t, root, cache);
    if (changed.some((f) => reach.has(f))) { chosen.push(t); continue; }
    let text = '';
    try { text = readFileSync(join(root, t), 'utf8'); } catch { continue; }
    if (changed.some((f) => text.includes(f)) || names.some((n) => text.includes(n))) chosen.push(t);
  }
  return chosen;
}

/** What changed: against the merge base with origin/main (else `base`, else HEAD), and every uncommitted file. */
export function changedFiles(base = null, root = ROOT) {
  const git = (...args) => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };
  const from = base ?? (git('merge-base', 'HEAD', 'origin/main').trim() || 'HEAD');
  const lines = [
    git('diff', '--name-only', `${from}...HEAD`), git('diff', '--name-only'), git('diff', '--name-only', '--cached'),
    git('ls-files', '--others', '--exclude-standard'),
  ].join('\n');
  return [...new Set(lines.split('\n').map((l) => l.trim()).filter(Boolean))].sort();
}

function main(argv) {
  const at = argv.indexOf('--base');
  const changed = changedFiles(at >= 0 ? argv[at + 1] : null);
  const tests = testFiles();
  const chosen = testsFor(changed, tests);
  const files = chosen === 'all' ? tests : chosen;
  if (argv.includes('--list')) { for (const f of files) console.log(f); return 0; }
  console.log(`${changed.length} changed files -> ${chosen === 'all' ? 'the whole suite (a file every test leans on changed)' : `${files.length} of ${tests.length} test files`}`);
  if (!files.length) return 0;
  const r = spawnSync(process.execPath, ['--test', ...files], { cwd: ROOT, stdio: 'inherit' });
  return r.status ?? 1;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
