// UNREACHED - the modules under src/ that nothing ships (CLEANUP, 2026-10-30; bible/01-Overview/Code-Map.md).
// A module no page, relay, worker, app, script or tool reaches through its imports runs only in its own tests: dead
// code, or code staged for a slice that has not wired it yet. test/tooling/unreached.test.js holds the tree to
// tools/unreachedBaseline.json, where each staged module says why it waits; anything else unreached fails.
//
//   node tools/unreached.mjs           the unreached modules, and how they stand against the baseline
//
// The walk reads import text, not a parse: an import in a comment counts as one, so it can only find too little dead.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE = 'tools/unreachedBaseline.json';
/** Where shipped and dev code starts: every code file under these is an entry, beside the root's pages and main.js. */
export const ENTRY_DIRS = Object.freeze(['server', 'server-account', 'app', 'scripts', 'tools', 'public']);
const CODE = /\.(m?js|cjs|html)$/;

const IMPORT =
  /(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"`]([^'"`$]+)['"`]\s*\)|import\s*['"]([^'"]+)['"]|src=["']([^"']+\.m?js)["']|new URL\(\s*['"]([^'"]+)['"]|new (?:Shared)?Worker\(\s*['"]([^'"]+)['"]/g;
const GLOB = /import\.meta\.glob\(\s*(\[[^\]]*\]|['"][^'"]+['"])/g;

/** Every code file under `dir` (repo-relative), skipping installed packages. */
function walk(root, dir) {
  if (!existsSync(join(root, dir))) return [];
  return readdirSync(join(root, dir), { recursive: true })
    .map((f) => `${dir}/${String(f).split('\\').join('/')}`)
    .filter((f) => CODE.test(f) && !f.includes('node_modules/'));
}

/** The relative specifiers a file's text imports, loads or globs. */
export function specifiersIn(text) {
  const plain = [];
  for (const m of text.matchAll(IMPORT)) {
    const spec = m.slice(1).find(Boolean);
    if (spec && (spec.startsWith('.') || spec.startsWith('/'))) plain.push(spec.split('?')[0]);
  }
  const globs = [];
  for (const g of text.matchAll(GLOB)) {
    for (const p of g[1].match(/['"][^'"]+['"]/g) ?? [])
      if (!p.startsWith("'!") && !p.startsWith('"!')) globs.push(p.slice(1, -1));
  }
  return { plain, globs };
}

/** The src modules nothing reaches from an entry, repo-relative and sorted. */
export function unreached(root = ROOT) {
  const src = walk(root, 'src').filter((f) => /\.m?js$/.test(f));
  const pages = readdirSync(root).filter((f) => f.endsWith('.html'));
  const entries = [...pages, 'src/main.js', ...ENTRY_DIRS.flatMap((d) => walk(root, d))];
  const isFile = (p) => existsSync(join(root, p)) && statSync(join(root, p)).isFile();
  const target = (from, spec) => {
    const abs = spec.startsWith('/')
      ? spec.slice(1)
      : relative(root, resolve(root, dirname(from), spec))
          .split('\\')
          .join('/');
    return [abs, `${abs}.js`, `${abs}/index.js`].find(isFile) ?? null;
  };
  const seen = new Set(entries);
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    const { plain, globs } = specifiersIn(readFileSync(join(root, file), 'utf8'));
    const next = plain.map((s) => target(file, s)).filter(Boolean);
    for (const g of globs) {
      const base = relative(root, resolve(root, dirname(file), g.split('*')[0]))
        .split('\\')
        .join('/');
      next.push(...src.filter((f) => f.startsWith(base)));
    }
    for (const t of next)
      if (!seen.has(t)) {
        seen.add(t);
        stack.push(t);
      }
  }
  return src.filter((f) => !seen.has(f)).sort();
}

/** Today's unreached modules against the baseline: `dead` reached by nothing and not listed, `stale` listed but
 *  reached now or gone (its line comes out). */
export function verdict(found, base) {
  return { dead: found.filter((f) => !(f in base)), stale: Object.keys(base).filter((f) => !found.includes(f)) };
}

if (isMain(import.meta.url)) {
  const base = JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8'));
  const found = unreached();
  const { dead, stale } = verdict(found, base);
  for (const f of found) console.log(`${f in base ? 'staged' : 'DEAD  '} ${f}${f in base ? ` - ${base[f]}` : ''}`);
  for (const f of stale) console.log(`STALE  ${f} - reached now or gone: take its line out of ${BASELINE}`);
  process.exitCode = dead.length || stale.length ? 1 : 0;
}
