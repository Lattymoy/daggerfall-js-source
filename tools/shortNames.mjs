// SHORT NAMES (LEGIBLE 5, bible/01-Overview/Readability-Arc.md): a binding of one or two characters says nothing of
// what it holds - `p` for a pixel, `dw` for Deep Waters. Each file's count of them is held to tools/shortNamesBaseline.json,
// which only goes down; bible/01-Overview/Glossary.md's first section lists the short names code may use, and its last
// the abbreviations being retired, counted like the short ones.
//   node tools/shortNames.mjs               the files past their count, and the counts now lower
//   node tools/shortNames.mjs --where FILE  each counted binding in FILE, by line
//   node tools/shortNames.mjs --lower       the baseline written down to today (never raised)
//   node tools/shortNames.mjs --seed REF    at a merge from a base without this law: REF's own counts admitted
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE = 'tools/shortNamesBaseline.json';
export const GLOSSARY = 'bible/01-Overview/Glossary.md';
export const SOURCE_DIRS = Object.freeze(['src', 'server/src', 'server-account/src']);

/** The names a section of the glossary lists: every backticked word on its list lines, before the dash. */
function listedIn(text, heading) {
  const at = text.indexOf(`\n## ${heading}\n`);
  if (at < 0) throw new Error(`${GLOSSARY} has no section "${heading}"`);
  const end = text.indexOf('\n## ', at + 1);
  const names = [];
  for (const line of text.slice(at, end < 0 ? text.length : end).split('\n')) {
    if (!line.startsWith('- ')) continue;
    const head = line.split(' - ')[0];
    for (const m of head.matchAll(/`([^`]+)`/g)) names.push(m[1]);
  }
  return names;
}

/** The glossary's two lists: the short names allowed, and the abbreviations being retired. */
export function glossary(root = ROOT) {
  const text = readFileSync(join(root, GLOSSARY), 'utf8');
  return {
    allowed: new Set(listedIn(text, 'Short names code may use')),
    retired: new Set(listedIn(text, 'Abbreviations to retire')),
  };
}

/** The names a binding pattern declares. */
function bound(pattern, out) {
  if (!pattern) return;
  if (pattern.type === 'Identifier') out.push(pattern);
  else if (pattern.type === 'ObjectPattern')
    for (const p of pattern.properties) bound(p.type === 'RestElement' ? p.argument : p.value, out);
  else if (pattern.type === 'ArrayPattern') for (const p of pattern.elements) bound(p, out);
  else if (pattern.type === 'RestElement') bound(pattern.argument, out);
  else if (pattern.type === 'AssignmentPattern') bound(pattern.left, out);
}

/** Every binding a source declares - variables, functions and their parameters, classes, catch parameters. Not an
 *  import: its local name is the exporting module's word (`t` is textManager's), renamed with the export. */
export function bindingsIn(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
  const out = [];
  const walk = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'VariableDeclarator') bound(node.id, out);
    else if (/Function/.test(node.type)) {
      if (node.id) out.push(node.id);
      for (const p of node.params) bound(p, out);
    } else if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id) out.push(node.id);
    else if (node.type === 'CatchClause') bound(node.param, out);
    for (const key of Object.keys(node)) {
      if (key === 'loc') continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value.type === 'string') walk(value);
    }
  };
  walk(ast);
  return out;
}

/** The bindings of `source` the law counts: two characters or fewer and not allowed, or an abbreviation retired. */
export function shortIn(source, { allowed, retired } = glossary()) {
  return bindingsIn(source).filter(({ name }) => (name.length <= 2 && !allowed.has(name)) || retired.has(name));
}

const sourceFiles = (root) =>
  SOURCE_DIRS.flatMap((d) =>
    readdirSync(join(root, d), { recursive: true })
      .map((f) => `${d}/${String(f).split('\\').join('/')}`)
      .filter((f) => /\.m?js$/.test(f)),
  ).sort();

/** Each source file's count, the files with none left out. */
export function measure(root = ROOT, read = (f) => readFileSync(join(root, f), 'utf8'), files = sourceFiles(root)) {
  const words = glossary(root);
  const out = {};
  for (const f of files) {
    let n = 0;
    try {
      n = shortIn(read(f), words).length;
    } catch {
      continue;
    }
    if (n) out[f] = n;
  }
  return out;
}

/** Against `base`: a file past its count (none for one not listed), and a count now lower than written. */
export function verdict(now, base) {
  const over = Object.entries(now)
    .filter(([f, n]) => n > (base[f] ?? 0))
    .map(([f, n]) => `${f}: ${n} (allowed ${base[f] ?? 0})`);
  const stale = Object.entries(base)
    .filter(([f, n]) => (now[f] ?? 0) < n)
    .map(([f, n]) => `${f}: ${now[f] ?? 0} (baseline ${n})`);
  return { over, stale };
}

/** The baseline lowered to `now`: never raised, an entry at zero dropped. */
export function lowered(base, now) {
  const out = {};
  for (const [f, n] of Object.entries(base)) if (Math.min(n, now[f] ?? 0) > 0) out[f] = Math.min(n, now[f] ?? 0);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** A host move's carry: the moved code's names go with it, so the new module is admitted at its count and the host
 *  lowered to its own - only while the two together hold no more than the host did (a move invents no name). The
 *  `rebound` names are the module unpacking the host's own (`const { a } = host`): bound twice, invented never. */
export function carried(base, hostFile, toFile, counts, rebound = 0) {
  const before = base[hostFile] ?? 0;
  if ((counts[hostFile] ?? 0) + (counts[toFile] ?? 0) - rebound > before) return base;
  const out = { ...base, [hostFile]: counts[hostFile] ?? 0, [toFile]: counts[toFile] ?? 0 };
  for (const f of [hostFile, toFile]) if (!out[f]) delete out[f];
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** `--seed REF`: the baseline with REF's own counts admitted beside it, for a merge from a base this law is not on. */
export function seeded(base, ref, root = ROOT) {
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', ...SOURCE_DIRS], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  })
    .split('\n')
    .filter((f) => /\.m?js$/.test(f));
  const theirs = measure(
    root,
    (f) => execFileSync('git', ['show', `${ref}:${f}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }),
    files,
  );
  const out = { ...base };
  for (const [f, n] of Object.entries(theirs)) out[f] = Math.max(out[f] ?? 0, n);
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

if (isMain(import.meta.url)) {
  const path = join(ROOT, BASELINE);
  const base = JSON.parse(readFileSync(path, 'utf8'));
  const write = (b) => writeFileSync(path, `${JSON.stringify(b, null, 1)}\n`);
  const at = (flag) => process.argv[process.argv.indexOf(flag) + 1];
  if (process.argv.includes('--where')) {
    for (const { name, loc } of shortIn(readFileSync(join(ROOT, at('--where')), 'utf8')))
      console.log(`${at('--where')}:${loc.start.line}  ${name}`);
  } else if (process.argv.includes('--lower')) {
    write(lowered(base, measure()));
    console.log('baseline lowered');
  } else if (process.argv.includes('--seed')) {
    write(seeded(base, at('--seed')));
    console.log(`baseline seeded from ${at('--seed')}`);
  } else {
    const { over, stale } = verdict(measure(), base);
    for (const o of over) console.log(`OVER   ${o}`);
    for (const s of stale) console.log(`LOWER  ${s}`);
    if (!over.length && !stale.length) console.log('short names: within the baseline');
    process.exitCode = over.length ? 1 : 0;
  }
}
