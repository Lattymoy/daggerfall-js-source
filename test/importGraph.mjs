// The import graph of a Worker entry, as wrangler bundles it - moved here
// from relayversion.test.js (SLAM13) at ACC4 so the account Worker's
// deploy filter can be held to its own graph by the SAME walk. The
// relay's hash reads the order this returns, so the walk is unchanged
// byte for byte in what it visits and when.
//
// IMPORT-GRAPH1 (2026-10-10, the owner: "Make your own decisions and take care of any issues"; found by AUDIT TECH1):
// THE WALK READS EACH FILE AS THE BUNDLER DOES - parsed (acorn, a devDependency), never a regex over the text. The
// regex stripped block comments before line comments, so a line comment carrying a stray `/*` opened a "block" that ran
// to the next `*/` and swallowed the imports between: the account Worker bundled nine files the walk never saw
// (systems/partyScale.js, books.js, booksData.js, portBooks.js, potions.js, lootThemes.js, formats/bookFile.js,
// textRsc.js, rscTable.js), and a change to any of them deployed nothing. Each file's relative specifiers - an import,
// a re-export, a literal dynamic import() - in the order they are written; a file that is not JavaScript (a JSON table)
// is a leaf, as it was. The relay's graph is the same sixty files in the same order (its hash unmoved), and both
// Workers' graphs are what esbuild bundles from them (test/accountdeploy.test.js IMPORT-GRAPH1).
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse } from 'acorn';

/** The relative specifiers a file names, in the order they are written. */
function specifiers(file) {
  if (!/\.m?js$/.test(file)) return [];
  const ast = parse(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  const found = [];
  const visit = (node) => {
    if (Array.isArray(node)) { for (const n of node) visit(n); return; }
    if (!node || typeof node.type !== 'string') return;
    const literal = node.source?.type === 'Literal' && typeof node.source.value === 'string';
    if (literal && (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ImportExpression')) found.push(node.source);
    for (const key of Object.keys(node)) if (key !== 'source' && node[key] && typeof node[key] === 'object') visit(node[key]);
  };
  visit(ast);
  return found.sort((a, b) => a.start - b.start).map((s) => s.value).filter((s) => s.startsWith('.'));
}

/** Every relative import, depth first, each file once, in the order the imports are written. */
export function graph(entry) {
  const out = [];
  const walk = (file) => {
    if (out.includes(file)) return;
    out.push(file);
    for (const spec of specifiers(file)) walk(relative('.', join(dirname(file), spec)).split('\\').join('/'));
  };
  walk(entry);
  return out;
}
