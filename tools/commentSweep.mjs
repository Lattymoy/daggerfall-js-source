// The comment sweep (HISTORY-OUT, LEGIBLE's comments step; bible/01-Overview/Readability-Arc.md): takes slice tags,
// dates, bible pointers and owner quotes out of comments, by the rules in tools/commentRules.mjs. Code is untouched.
//
//   node tools/commentSweep.mjs <path ...>              report: history lines before -> after, per file
//   node tools/commentSweep.mjs <path ...> --list       the files it would change, one a line (for carryPins)
//   node tools/commentSweep.mjs <path ...> --write      write them (prefer carryPins, which also moves the pins)
//   node tools/carryPins.mjs --transform tools/commentSweep.mjs <files> --write
//
// A file in the relay's bundle is skipped unless --relay is given: any byte of it is a new RELAY_VERSION and a deploy
// that drops every connected player. Generated files are skipped: their generator owns their text.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMain } from './lib/isMain.mjs';
import { commentsOf, cleanText, historyLines } from './commentRules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Files whose bytes are pinned whole, so no comment in them may change. */
export const KEEP_BYTES = new Set([
  'src/ai/nav/navmesh.js',   // shared with project-final, digest-pinned by test/ai/nav/enhancedAI.test.js
]);

const ownLine = (src, start) => /^[ \t]*$/.test(src.slice(src.lastIndexOf('\n', start - 1) + 1, start));
const lineStart = (src, at) => src.lastIndexOf('\n', at - 1) + 1;

/** Runs of `//` comments, each alone on its line, on consecutive lines: one text to clean together. */
function groups(src, comments) {
  const out = [];
  for (const c of comments) {
    const prev = out[out.length - 1];
    const solo = ownLine(src, c.start);
    if (!c.block && solo && prev && prev.kind === 'run' && /^[ \t]*$/.test(src.slice(prev.end, c.start).replace(/^\n/, ''))
      && !src.slice(prev.end, c.start).includes('\n\n')) {
      prev.items.push(c); prev.end = c.end; continue;
    }
    out.push({ kind: c.block ? 'block' : solo ? 'run' : 'trailing', items: [c], start: c.start, end: c.end });
  }
  return out;
}

/** The text of a run of line comments, one space after each `//` dropped. */
const runText = (src, g) => g.items.map((c) => src.slice(c.start + 2, c.end).replace(/^ /, '')).join('\n');

function rewriteRun(src, g) {
  const before = runText(src, g);
  const after = cleanText(before);
  if (after === before) return null;
  const indent = src.slice(lineStart(src, g.start), g.start);
  if (!after) {
    const end = src.indexOf('\n', g.end);
    return [lineStart(src, g.start), end < 0 ? src.length : end + 1, ''];
  }
  const text = after.split('\n').map((l) => (l.trim() ? `//${l.startsWith(' ') ? '' : ' '}${l}` : '//')).join(`\n${indent}`);
  return [g.start, g.end, text];
}

function rewriteTrailing(src, g) {
  const c = g.items[0];
  const before = src.slice(c.start + 2, c.end).replace(/^ /, '');
  const after = cleanText(before);
  if (after === before) return null;
  if (!after) { let a = c.start; while (a > 0 && /[ \t]/.test(src[a - 1])) a--; return [a, c.end, '']; }
  return [c.start, c.end, `// ${after}`];
}

function rewriteBlock(src, g) {
  const c = g.items[0];
  const raw = src.slice(c.start, c.end);
  if (/^\/\*[!@#]|^\/\*\s*(?:global|eslint|istanbul|c8)\b/.test(raw)) return null;
  const doc = raw.startsWith('/**');
  const inner = raw.slice(doc ? 3 : 2, -2);
  const lines = inner.split('\n');
  if (lines.length === 1) {
    if (/(?:^|\s)@[a-z]/.test(inner)) return null;   // a JSDoc tag carries a type: never touched
    const lead = inner.match(/^\s*/)[0], tail = inner.match(/\s*$/)[0];
    const after = cleanText(inner.trim());
    if (after === inner.trim()) return null;
    if (!after) {
      if (!ownLine(src, c.start)) { let a = c.start; while (a > 0 && /[ \t]/.test(src[a - 1])) a--; return [a, c.end, '']; }
      const end = src.indexOf('\n', c.end);
      const restOfLine = src.slice(c.end, end < 0 ? src.length : end);
      if (restOfLine.trim()) return [c.start, c.end + (restOfLine.match(/^[ \t]*/)[0].length), ''];
      return [lineStart(src, c.start), end < 0 ? src.length : end + 1, ''];
    }
    return [c.start, c.end, `${doc ? '/**' : '/*'}${lead}${after}${tail}*/`];
  }
  // multi-line: strip each line's ` * ` prefix, clean the whole, put the prefix back
  const prefixOf = (l) => l.match(/^[ \t]*\*?[ \t]?/)[0];
  const contPrefix = lines.slice(1).map(prefixOf).find((p) => p.includes('*')) ?? prefixOf(lines[1] ?? '');
  const firstText = lines[0];
  const bodies = [firstText.replace(/^[ \t]?/, ''), ...lines.slice(1).map((l) => l.slice(prefixOf(l).length))];
  const lastIsClose = /^[ \t]*$/.test(bodies[bodies.length - 1]);
  const textLines = lastIsClose ? bodies.slice(0, -1) : bodies;
  const firstEmpty = textLines[0] === '';
  const tagAt = textLines.findIndex((l) => /^\s*@/.test(l));   // JSDoc tags carry types: never touched
  if (tagAt === 0 || (tagAt === 1 && firstEmpty)) return null;
  const kept = tagAt > 0 ? textLines.slice(tagAt) : [];
  const described = tagAt > 0 ? textLines.slice(0, tagAt) : textLines;
  const before = (firstEmpty ? described.slice(1) : described).join('\n');
  const after = cleanText(before);
  if (after === before) return null;
  const closeIndent = lastIsClose ? lines[lines.length - 1].replace(/\S.*$/, '') : '';
  if (!after) {
    if (!ownLine(src, c.start)) return null;
    const end = src.indexOf('\n', c.end);
    const restOfLine = src.slice(c.end, end < 0 ? src.length : end);
    if (restOfLine.trim()) return null;
    return [lineStart(src, c.start), end < 0 ? src.length : end + 1, ''];
  }
  const tail = lastIsClose ? '' : (textLines[textLines.length - 1].match(/[ \t]*$/)[0] || ' ');
  if (kept.length && !after) return null;
  const keptRaw = tagAt > 0 ? lines.slice(tagAt + (lastIsClose ? 0 : 0), lastIsClose ? -1 : undefined) : [];
  const out = after.split('\n').map((l, i, all) => (i === all.length - 1 && !lastIsClose ? l.replace(/[ \t]+$/, '') : l));
  const bar = contPrefix.replace(/[ \t]+$/, '');
  const body = out.map((l, i) => (i === 0 && !firstEmpty ? ` ${l}` : `\n${l.trim() ? contPrefix + l : bar}`)).join('');
  if (keptRaw.length) return [c.start, c.end, `${doc ? '/**' : '/*'}${body}\n${keptRaw.join('\n')}${lastIsClose ? `\n${closeIndent}` : ''}*/`];
  return [c.start, c.end, `${doc ? '/**' : '/*'}${body}${lastIsClose ? `\n${closeIndent}` : tail}*/`];
}

/** The sweep as carryPins takes it: the same file with its comments' history out, code untouched. */
export function transform(source) {
  const comments = commentsOf(source);
  if (!comments || !comments.length) return source;
  if (/GENERATED by|do not edit by hand/i.test(source.slice(0, 600))) return source;
  const edits = [];
  for (const g of groups(source, comments)) {
    const e = g.kind === 'run' ? rewriteRun(source, g) : g.kind === 'trailing' ? rewriteTrailing(source, g) : rewriteBlock(source, g);
    if (e) edits.push(e);
  }
  let out = source;
  for (const [a, b, text] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + text + out.slice(b);
  return out;
}

/** The files of the relay's bundle (test/importGraph.mjs's walk from server/src/index.js). */
async function relayFiles() {
  const { graph } = await import(pathToFileURL(join(ROOT, 'test/importGraph.mjs')).href);
  return new Set(graph('server/src/index.js').map(String));
}

function walk(p, out = []) {
  const abs = join(ROOT, p);
  if (statSync(abs).isDirectory()) {
    for (const e of readdirSync(abs)) if (e !== 'node_modules') walk(join(p, e), out);
  } else if (/\.(?:m?js|cjs)$/.test(p)) out.push(p);
  return out;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const paths = args.filter((a) => !a.startsWith('--')).map((p) => relative(ROOT, join(process.cwd(), p)));
  const relay = args.includes('--relay') ? new Set() : await relayFiles();
  const files = paths.flatMap((p) => walk(p)).filter((f) => !relay.has(f) && !KEEP_BYTES.has(f));
  let before = 0, after = 0, changed = 0;
  const list = [];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    const out = transform(src);
    if (out === src) continue;
    changed++; list.push(f);
    const b = historyLines(src), a = historyLines(out);
    before += b; after += a;
    if (args.includes('--write')) writeFileSync(join(ROOT, f), out);
    else if (!args.includes('--list')) console.log(`${f}: ${b} -> ${a}`);
  }
  if (args.includes('--list')) console.log(list.join('\n'));
  else console.log(`${changed} of ${files.length} files change; history lines ${before} -> ${after}${args.includes('--write') ? ' (written)' : ''}`);
}
