#!/usr/bin/env node
// L10N4 (2026-09-28): THE PORT'S OWN ENGLISH STILL WRITTEN INTO THE CODE, COUNTED.
//
// A player reads the port's own words - menus, the enhanced interface, the online game, every notice DFU does not have -
// only in English until each goes through the text core (`t(key, en, args)`, Port_Strings). This finds the words that
// have not yet: every string or template literal in src/ that reads as prose (two words of letters or more) and is not
// the argument of a text-core call, a console line, a thrown error, an import's source or an object's key. It is a
// heuristic - a data table's English (an item's canonical name, a key) counts too - so it is held as a RATCHET, file by
// file (test/l10n4_hardcoded.test.js): a file's count may fall, as its words are routed, and may not rise, so a new
// hard-coded sentence fails the suite where it is written instead of reaching a player in English.
//
//   node tools/l10nHardcoded.mjs           the counts, file by file (the ratchet's HARDCODED map), and the total
//   node tools/l10nHardcoded.mjs <file>    that file's literals, with their lines
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The text core's calls whose string arguments are already the player's language's (or DFU's keys). */
const ROUTED = new Set(['t', 'tIn', 'localizedText', 'localizedTextList', 'localizedStrings', 'localizedTable', 'formatText',
  'getLocalizedText', 'getLocalizedTextWithReversion', 'getLocalizedTextList', 'databaseText', 'gameSettingsText']);
/** Files the scan skips: the text core itself (its English is the fallback law's own) and the grammar rules (French). */
const SKIP = [/^src\/systems\/textManager\.js$/, /^src\/systems\/grammar\//];

const walk = (d, out = []) => {
  for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p); }
  return out;
};

/** Prose: two words of two letters or more, not a CSS value, a selector, a path, code or a URL. */
export function isProse(s) {
  if (!/[A-Za-z]{2,}[\s\u00a0]+[A-Za-z]{2,}/.test(s)) return false;
  if (/(^|\s)(px|em|rem|vh|vw)(\s|;|$)|\d(px|em|rem|vh|vw|ms|deg)\b|rgba?\(|hsla?\(|var\(--|calc\(|linear-gradient|;\s*$|=>|\bfunction\b|\bimport\b|\bconst\b|\breturn\b|https?:|\.(js|mjs|json|png|wav|ttf|glb|bsa|img|cif)\b/i.test(s)) return false;
  if (/^[a-z]+(-[a-z0-9]+)+( [a-z]+(-[a-z0-9]+)*)*$/.test(s)) return false;   // class lists
  if (/^[\w$.-]+( [\w$.-]+)*$/.test(s) && !/[A-Z]/.test(s[0]) && !/\s(a|an|the|of|to|is|in|on|and|or|you|your)\s/i.test(` ${s} `)) return false;   // identifier runs
  return true;
}

/** Every hard-coded prose literal in `root`'s src/: { file, line, text }. */
export function hardcodedStrings(root = ROOT) {
  const out = [];
  for (const path of walk(join(root, 'src'))) {
    const file = relative(root, path).split('\\').join('/');
    if (SKIP.some((re) => re.test(file))) continue;
    const text = readFileSync(path, 'utf8');
    let ast;
    try { ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true }); } catch { continue; }
    const visit = (n, quiet) => {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'ImportDeclaration' || n.type === 'ExportAllDeclaration' || n.type === 'ExportNamedDeclaration' && n.source) return;
      let q = quiet;
      if (n.type === 'CallExpression') {
        const c = n.callee;
        if (c?.type === 'Identifier' && ROUTED.has(c.name)) q = true;
        if (c?.type === 'MemberExpression' && c.object?.name === 'console') q = true;
      }
      if (n.type === 'ThrowStatement' || (n.type === 'NewExpression' && /Error$/.test(n.callee?.name ?? ''))) q = true;
      if (!q) {
        if (n.type === 'Literal' && typeof n.value === 'string' && isProse(n.value)) out.push({ file, line: n.loc.start.line, text: n.value });
        if (n.type === 'TemplateLiteral') {
          const s = n.quasis.map((x) => x.value.cooked ?? '').join(' {} ');
          if (isProse(s)) out.push({ file, line: n.loc.start.line, text: s });
        }
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc') continue;
        if (k === 'key' && (n.type === 'Property' || n.type === 'MethodDefinition' || n.type === 'PropertyDefinition') && !n.computed) continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach((x) => visit(x, q)); else if (v && typeof v.type === 'string') visit(v, q);
      }
    };
    visit(ast, false);
  }
  return out;
}

/** The counts, file by file. */
export function hardcodedCounts(root = ROOT) {
  const counts = {};
  for (const s of hardcodedStrings(root)) counts[s.file] = (counts[s.file] ?? 0) + 1;
  return counts;
}

if (isMain(import.meta.url)) {
  const only = process.argv[2];
  if (only) {
    for (const s of hardcodedStrings().filter((x) => x.file === only)) console.log(`${s.line}\t${JSON.stringify(s.text).slice(0, 160)}`);
  } else {
    const counts = hardcodedCounts();
    console.log('const HARDCODED = {');
    for (const f of Object.keys(counts).sort()) console.log(`  '${f}': ${counts[f]},`);
    console.log('};');
    console.log(`${Object.values(counts).reduce((a, b) => a + b, 0)} hard-coded prose literals in ${Object.keys(counts).length} files`);
  }
}
