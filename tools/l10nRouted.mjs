// L10N3d (2026-09-27): THE DFU WORDS THE PORT ROUTES, READ OFF THE SOURCE.
//
// DFU shows its interface words through TextManager.GetLocalizedText(key); the port holds them as constants and reads
// each through the text core where it is shown. This reads every such word in src/ - each `localizedText('key', ...)`
// and `localizedTextList('key', [...])` with a literal key, and each entry of a `localizedStrings({...})` or
// `localizedTable({...})` table, in a module that imports them from systems/textManager.js (under any local name); an
// English may be a literal or the module's own `const NAME = '...'` -
// for test/l10n3d_sites.test.js's pins, and says how far the routing has come.
//
//   node tools/l10nRouted.mjs            the routed words, file by file (the sites test's ROUTED map), the name lookups
//                                        file by file (its NAMED map), the grammar's sites file by file
//                                        (test/l10n3g_wiring.test.js's GRAMMAR map), and coverage:
//                                        DFU's keys the port routes, of those DFU's own code asks for by name
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { DEFAULT_COLLECTION_NAMES, loadStringTableCsv } from '../src/systems/textManager.js';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTERS = new Set(['localizedText', 'localizedTextList', 'localizedStrings', 'localizedTable']);

/** DFU's English, collection -> Map(key -> English): the vendored master tables (vendor/dfu-text). */
export function dfuTables(root = ROOT) {
  const out = new Map();
  for (const [collection, name] of Object.entries(DEFAULT_COLLECTION_NAMES)) {
    let text;
    try { text = readFileSync(join(root, 'vendor/dfu-text', `${name}.csv`), 'utf8'); } catch { continue; }
    out.set(collection, new Map(loadStringTableCsv(text).map(([k, v]) => [k, v.replace(/[\r\n]+$/, '')])));
  }
  return out;
}

const walk = (d, out = []) => {
  for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p); }
  return out;
};
const literal = (n) => (n?.type === 'Literal' && typeof n.value === 'string' ? n.value
  : n?.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked : undefined);
/** A router's collection argument: `TextCollections.<name>`, Internal when there is none, null for anything else. */
const collectionOf = (n) => (n?.type === 'MemberExpression' && n.object?.name === 'TextCollections' ? n.property.name : n ? null : 'Internal');

/** Each src/ module (not the text core itself) that imports one of `names` from systems/textManager.js, parsed:
 *  { file, ast, local } - `local` maps the name the module calls it by to the core's own name (an alias kept). */
function* coreCallers(root, names) {
  for (const path of walk(join(root, 'src'))) {
    const file = relative(root, path).split('\\').join('/');
    if (file === 'src/systems/textManager.js') continue;
    const text = readFileSync(path, 'utf8');
    if (![...names].some((r) => text.includes(r))) continue;
    const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    const local = new Map();
    for (const d of ast.body) {
      if (d.type !== 'ImportDeclaration' || !/\/textManager\.js$/.test(d.source.value)) continue;
      for (const sp of d.specifiers) if (sp.type === 'ImportSpecifier' && names.has(sp.imported.name)) local.set(sp.local.name, sp.imported.name);
    }
    if (local.size) yield { file, ast, local };
  }
}

/** Every node of `ast`, with whether it stands inside a function - a call outside every function runs once, at load. */
function walkNodes(ast, onNode) {
  const visit = (n, inFn) => {
    if (!n || typeof n.type !== 'string') return;
    onNode(n, inFn);
    const fn = inFn || /Function/.test(n.type);
    for (const k of Object.keys(n)) {
      if (k === 'loc') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((x) => visit(x, fn)); else if (v && typeof v.type === 'string') visit(v, fn);
    }
  };
  visit(ast, false);
}

/**
 * Every routed word in src/: { file, line, via, key, en, collection, loose }. `en` is undefined where the English is
 * not a literal; `loose` marks a single word read outside any function - once, at module load.
 */
export function routedWords(root = ROOT) {
  const out = [];
  for (const { file, ast, local } of coreCallers(root, ROUTERS)) {
    const consts = new Map();   // a module's own `const NAME = 'text'` (exported or not): an English held by name
    for (const d of ast.body) {
      const decl = d.type === 'ExportNamedDeclaration' ? d.declaration : d;
      if (decl?.type !== 'VariableDeclaration' || decl.kind !== 'const') continue;
      for (const v of decl.declarations) if (v.id.type === 'Identifier' && literal(v.init) !== undefined) consts.set(v.id.name, literal(v.init));
    }
    const str = (n) => (n?.type === 'Identifier' && consts.has(n.name) ? consts.get(n.name) : literal(n));
    walkNodes(ast, (n, inFn) => {
      if (n.type !== 'CallExpression' || !local.has(n.callee?.name)) return;
      const via = local.get(n.callee.name), [a, b, c] = n.arguments, line = n.loc.start.line;
      if (via === 'localizedText' && str(a) !== undefined) {
        out.push({ file, line, via, key: str(a), en: str(b), collection: collectionOf(c), loose: !inFn });
      } else if (via === 'localizedTextList' && str(a) !== undefined) {
        const en = b?.type === 'ArrayExpression' && b.elements.every((e) => str(e) !== undefined) ? b.elements.map(str).join('\n') : undefined;
        out.push({ file, line, via, key: str(a), en, collection: collectionOf(c), loose: !inFn });
      } else if ((via === 'localizedStrings' || via === 'localizedTable') && a?.type === 'ObjectExpression') {
        for (const p of a.properties) {
          if (via === 'localizedTable' && /FunctionExpression$/.test(p.value?.type ?? '')) continue;   // the port's own line beside DFU's - its words are a `t` call's, read off by l10nExtract
          const pair = via === 'localizedTable' && p.value?.type === 'ArrayExpression' ? p.value.elements : null;
          const key = via === 'localizedTable' ? str(pair?.[0]) : (p.key.name ?? String(p.key.value));
          out.push({ file, line: p.loc.start.line, via, key, en: str(via === 'localizedTable' ? pair?.[1] : p.value), collection: collectionOf(b), loose: false });
        }
      }
    });
  }
  return out;
}

const NAMERS = new Set(['getLocalizedLocationName', 'getLocalizedRegionName', 'getLocalizedEnemyName', 'getLocalizedSpellName',
  'getLocalizedItemName', 'getLocalizedMagicItemName', 'getLocalizedFactionName']);

/**
 * L10N3e: every call to one of DFU's name lookups (the text core's getLocalized*Name, under any local name) in src/ -
 * the names come from the game's own data, so there is no English to hold to a table here, only the site:
 * { file, line, via, loose }, `loose` a lookup made once at module load.
 */
export function namedSites(root = ROOT) {
  const out = [];
  for (const { file, ast, local } of coreCallers(root, NAMERS)) {
    walkNodes(ast, (n, inFn) => {
      if (n.type === 'CallExpression' && local.has(n.callee?.name)) out.push({ file, line: n.loc.start.line, via: local.get(n.callee.name), loose: !inFn });
    });
  }
  return out;
}

/**
 * L10N3g: every call to the text core's processGrammar (DFU's GrammarManager.grammarProcessor.ProcessGrammar, under
 * any local name) in src/ - DFU runs the grammar at a fixed set of display sites, and a French pack's tokens stay raw
 * wherever a site is lost: { file, line, loose }, `loose` a call made once at module load (whatever language was
 * chosen then, and whatever gender the text carried in).
 */
export function grammarSites(root = ROOT) {
  const out = [];
  for (const { file, ast, local } of coreCallers(root, new Set(['processGrammar']))) {
    walkNodes(ast, (n, inFn) => {
      if (n.type === 'CallExpression' && local.has(n.callee?.name)) out.push({ file, line: n.loc.start.line, loose: !inFn });
    });
  }
  return out;
}

/** The Internal_Strings keys DFU's own code asks for by a literal key, read off a DFU checkout's Assets/Scripts. */
export function dfuAskedKeys(dfuScripts) {
  const keys = new Set();
  const cs = [];
  const walkCs = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walkCs(p); else if (p.endsWith('.cs')) cs.push(p); } };
  walkCs(dfuScripts);
  for (const f of cs) for (const m of readFileSync(f, 'utf8').matchAll(/GetLocalizedText(?:List|WithReversion)?\("([A-Za-z0-9_.]+)"/g)) keys.add(m[1]);
  return keys;
}

if (isMain(import.meta.url)) {
  const words = routedWords();
  const counts = {};
  for (const w of words) counts[w.file] = (counts[w.file] ?? 0) + 1;
  console.log('const ROUTED = {');
  for (const f of Object.keys(counts).sort()) console.log(`  '${f}': ${counts[f]},`);
  console.log('};');
  const named = {};
  for (const n of namedSites()) named[n.file] = (named[n.file] ?? 0) + 1;
  console.log('const NAMED = {');
  for (const f of Object.keys(named).sort()) console.log(`  '${f}': ${named[f]},`);
  console.log('};');
  const grammar = {};
  for (const g of grammarSites()) grammar[g.file] = (grammar[g.file] ?? 0) + 1;
  console.log('const GRAMMAR = {');
  for (const f of Object.keys(grammar).sort()) console.log(`  '${f}': ${grammar[f]},`);
  console.log('};');
  const internal = new Set(words.filter((w) => w.collection === 'Internal').map((w) => w.key));
  const dfu = dfuTables().get('Internal');
  console.log(`${words.length} routed words in ${Object.keys(counts).length} files; ${internal.size} of DFU's ${dfu.size} Internal_Strings keys`);
  const scripts = process.env.DFU_SCRIPTS;
  if (scripts) {
    const asked = [...dfuAskedKeys(scripts)].filter((k) => dfu.has(k));
    const routed = asked.filter((k) => internal.has(k));
    console.log(`DFU's code asks for ${asked.length} Internal_Strings keys by name; the port routes ${routed.length}`);
  }
}
