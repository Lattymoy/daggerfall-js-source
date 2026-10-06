#!/usr/bin/env node
// CITE-ANCHOR (2026-10-06, Mac - asked how to stop the merge conflicts the cites made, "Merge #630, then fix cites"):
// A CITE INTO OUR OWN CODE NAMES WHAT IT POINTS AT, NOT WHERE IT STOOD.
//
// WHY. A line number is a claim about every line above it. `world.js:6153` was true until anything above line 6153
// moved, and world.js is 29,000 lines: every change to it shifted every cite below the change, citeShift rewrote them
// in every doc that carried one (191 cites in 40 files for one feature), and any two branches that touched world.js
// then rewrote the same doc lines with different numbers. Every merge of main into PR #630 conflicted, and every
// conflict was cite numbers alone. The law that made the numbers checkable (test/citedrift.test.js, ROAD-E fix-D:
// "THE CITATION IS PART OF THE CLAIM") stands; what changes is what the claim says.
//
// THE ANCHOR. `world.js:"const livingQuarry = () =>"` is the one line of world.js that holds that text, and the text
// must stand once in the file. A line too common to quote (a closing brace, a `continue;`) is named by the quotable
// line above it and its own text: `world.js:"if (modes.frame(dt, now)) {".."}"` is the first line after the quoted one
// whose trimmed text is exactly `}` - or, past a twin of that text (an inner block's close), the first whose text is
// exactly `  }` as written, indentation included (`.."  }"`). A quote is counted outside the anchors - a file that cites its own lines carries
// each quote twice, once in the line and once in the anchor that names it. Lines added or removed anywhere else leave an
// anchor as it was, so a change to a
// file touches the docs that cite the lines it changed, and no others. A quote that stops being true is the gate's
// (test/citeanchor.test.js CA1) in the change that made it so, and it names the doc and the quote.
//
// WHAT IT COVERS. A cite into a tracked .js/.mjs - the path form (`src/scenes/world.js:6153`), the basename form
// (`world.js:6153`), a range (`:6153-6160`, anchored at its first line: the anchor names the place, the code shows the
// block), and the bare continuations after one (`/:N`, `` `:N` ``, `(:N`, `, :N`, `/N`, `against :N` - citeShift's
// RF3/RF4/RF5/CITE-SLASH/CITE-CS law, imported, so a continuation belongs to the same cite here as there), each written
// out in full (`world.js:"a"/world.js:"b"`). NOT covered, and held as they are: a cite inside STRUCK text (`~~...~~` -
// a record's measurement, Port-Status's struck law: never re-resolved, so never rewritten, so never a conflict; the
// Ledger strikes a closed row's retired claim and states the closing one beside it, live, on the same line, so the
// strike is read span by span, and a line whose marks do not pair - a strike across lines - is held whole); a cite
// into a .cs (DFU's lines do not move), a .md (the Ledger's rows are cited by name, CD1) or a .sh; a cite into another
// repository's file that shares a basename with ours (FOREIGN); the tools' own fixtures (SELF_DOCS); and a cite in a
// file of the relay's bundle (relayFiles - every byte there is a relay law, test/relayversion.test.js SLAM8, and a
// comment rewritten is a version bump and a deploy that drops every connected player: its cites become anchors with
// the next relay change that is one anyway).
//
// THE QUOTE. Read from the cited line after its indent and any comment opener (`//`, `/**`, `*`): the shortest run
// from a word's start to a token's edge (tokenEdge - never inside a name, an operator or a path), of at least
// QUOTE_MIN characters (or the whole line), that stands
// once in the file, and - where one does - stands nowhere in the citing file itself: the four hosts mirror each other,
// and a quote of world.js's `function runEncounterTick(` written into exterior.js's comments was the first copy of that
// text a test's indexOf met there (a file citing its own lines cannot help it, and is the one exception). What a quote
// may hold is the cite's context's (forbidAt), and its brackets balance - in a code file its braces too, quote and line
// read as one text (balanced: the tests' scanners count them in a comment as in code). There a block's close is named
// from the line that opens it (`x.js:"if (cond) {".."}"`), and a block's head with nothing to quote but its brace at the
// block's first line, nudged. Deterministic: the same line and the same citing file give the same quote on every branch.
//
// Usage:
//   node tools/citeAnchor.mjs            # list every numeric cite into our code still to convert, and the ones a person must answer (exit 1 if any)
//   node tools/citeAnchor.mjs --apply    # rewrite the convertible ones in place
//   node tools/citeAnchor.mjs --check    # resolve every anchor in the docs (exit 1 on one that does not)
//   ... --apply --relay                  # the relay bundle's files too - with a relay change that bumps RELAY_VERSION anyway
// After a merge of main into a branch that still wrote numbers: take main's side of each cite-only conflict, then run
// --apply on the merged tree and --check; the branch's own new cites become anchors in the same pass.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';
import { regionStops, continuationsIn, SELF_DOCS as SHIFT_SELF_DOCS, GIT_MAX_BUFFER } from './citeShift.mjs';
import { closureOf } from './testChanged.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The shortest quote, unless the line's whole rest is shorter. */
export const QUOTE_MIN = 16;
/** No quote longer than this: past it, a later start of the line is tried. */
export const QUOTE_MAX = 72;
/** How far above an unquotable line its context may stand. */
export const AFTER_REACH = 60;

/** The tools' own fixtures, which carry example cites that are synthetic. */
export const SELF_DOCS = Object.freeze([...SHIFT_SELF_DOCS, 'tools/citeAnchor.mjs', 'test/citeanchor.test.js']);

/** Cites into a file that is not one of ours but shares a basename with one: another repository's (Audit-68.md:
 *  project-final's main.js, which citeShift moved as if it were src/main.js - the five carry their first-written
 *  numbers again), or one of ours since deleted (the settings screen's spec cites the launcher it retired,
 *  src/ui/launcher.js - app/launcher/launcher.js came later). Held as written: nothing they name can move. */
export const FOREIGN = Object.freeze([
  ['src/ai/enhancedMotor.js', 'main.js'],
  ['src/ai/navBake.js', 'main.js'],
  ['test/enhancedAI.test.js', 'main.js'],
  ['bible/12-Enhanced-AI/Enhanced-AI-Arc.md', 'main.js'],
  ['bible/10-UI/Settings-Screen-Spec.md', 'launcher.js'],
]);

/** The relay's bundle: every file the worker's entry reaches (test/relayversion.test.js RELAY_GRAPH walks the same). */
export const relayFiles = (root = ROOT) => new Set(closureOf('server/src/index.js', root));

/** A numeric cite into a .js/.mjs, path or basename, with an optional range end. Not the tests' escaped spelling. */
export const NUM_CITE = /(?<![\w/\\])((?:[\w./-]*\/)?[\w.-]+\.m?js):(\d+)(?:-(\d+))?/g;
/** The same in a test's regex spelling (`world\.js:6153`) - converted by hand, reported here. Not a `git grep` hit's
 *  `file:N:` (brand.test.js reads grep's own output). */
export const ESCAPED_NUM_CITE = /(?<![\w\\])(?:[\w.-]+\\\/)*[\w.-]+\\\.m?js:\d+(?![\d:])/g;
/** An anchor: path or basename, the quote, and the after-form's line. */
export const ANCHOR = /(?<![\w/\\])((?:[\w./-]*\/)?[\w.-]+\.m?js):"([^"\n]+)"(?:\.\."([^"\n]+)")?/g;

/** The same in a test's regex spelling (`world\.js:"..."`), masked with the rest. */
const ESCAPED_ANCHOR = /[\w.-]+\\\.m?js:"([^"\n]+)"/g;

/** A file's text with every anchor's quote blanked to \u0001 - its lines and offsets kept - so a quote is counted and
 *  found outside the anchors. */
export function maskAnchors(text) {
  if (!text.includes(':"')) return text;
  const blank = (m, q) => m.slice(0, m.length - q.length - 1) + '\u0001'.repeat(q.length) + '"';
  return text.replace(ANCHOR, (m, p, q, after) => {
    if (after == null) return blank(m, q);
    const head = m.slice(0, m.length - after.length - 4);   // up to the first quote's close
    return blank(head, q) + '..' + '"' + '\u0001'.repeat(after.length) + '"';
  }).replace(ESCAPED_ANCHOR, blank);
}

/** For each line of a Markdown text, whether code is open at its start: a fenced block, or a code span that opened
 *  on an earlier line of its paragraph (a span runs to its closing backtick across lines; a blank line ends it). */
export function codeOpenAt(text) {
  const out = [];
  let open = false, fence = false;
  for (const l of text.split('\n')) {
    if (/^\s*```/.test(l)) { out.push(true); fence = !fence; open = false; continue; }
    if (fence) { out.push(true); continue; }
    if (!l.trim()) { out.push(false); open = false; continue; }
    out.push(open);
    if ((l.match(/`/g) ?? []).length % 2 === 1) open = !open;
  }
  return out;
}

/** What a quote may not hold where the cite stands: never a `"` (the anchor's own delimiter), a backtick (a doc's code
 *  span) or a backslash; in a Markdown table row no `|` (a cell's edge), and outside code no `*` (emphasis) - code
 *  being a span, open on this line or since an earlier one of its paragraph (`open`, codeOpenAt), or a fenced block;
 *  in a code comment no `*\/` (the comment's close). Null where a cite is not this tool's to write: in a code file
 *  outside a comment (a string, a regex, a test's title) it is a person's. */
export function forbidAt(docPath, line, col, open = false) {
  if (/\.md$/.test(docPath)) {
    const inSpan = ((open ? 1 : 0) + (line.slice(0, col).match(/`/g) ?? []).length) % 2 === 1;
    return new RegExp(`["\`\\\\]${/^\s*\|/.test(line) ? '|\\|' : ''}${inSpan ? '' : '|\\*'}`);
  }
  const t = line.trimStart();
  const comment = /^(\/\/|\/\*|\*|#)/.test(t) || /(^|[^:'"`\\])\/\/(?![^'"`]*['"`]\s*[,)])/.test(line.slice(0, col));
  return comment ? /["`\\]|\*\// : null;
}
const FORBID = /["`\\*|]/;

/** Where a line's quotable text begins: past its indent and any comment opener. */
function bodyStart(raw) {
  return /^\s*(?:\/\/+|\/\*+|\*+(?!\/))?\s*/.exec(raw)[0].length;
}

/** Whether a quote's brackets close as they open - each never below none, none left open: parentheses and square
 *  brackets always, and braces too where `braces` (an anchor in a code file's comment). A comment's anchor is read by
 *  the tests' own scanners, which count a call's parentheses in its comments as in its code - one `(` left open in a
 *  call's comment carried FOE1's scan of `buildDungeonContext(` past the call's end - and a function's braces the same:
 *  BOOT-TDZ2 walks `buildPixelNow`'s depth brace by brace, and world.js's `.."}"` in a comment inside it closed the
 *  function there. In a Markdown doc braces are free: no scanner counts them, and a block's `{` or `}` is half the
 *  lines a quote names. */
export function balanced(q, braces = false) {
  let paren = 0, square = 0, brace = 0;
  for (const c of q) {
    if (c === '(') paren++;
    else if (c === ')' && --paren < 0) return false;
    else if (c === '[') square++;
    else if (c === ']' && --square < 0) return false;
    else if (braces && c === '{') brace++;
    else if (braces && c === '}' && --brace < 0) return false;
  }
  return paren === 0 && square === 0 && brace === 0;
}

/** How many times `needle` stands in `hay` (overlaps counted), stopping at two. */
function standing(hay, needle) {
  const a = hay.indexOf(needle);
  if (a < 0) return 0;
  return hay.indexOf(needle, a + 1) < 0 ? 1 : 2;
}

/**
 * The quote that names line `n` of a file - the shortest that stands once in it - or null when the line has none.
 * `avoid`, the citing file's own text (masked): a quote that stands nowhere in it is taken first. `braces`: the anchor
 * stands in a code file's comment, and the quote's braces balance too.
 * @param {string} fileText @param {string[]} lines @param {number} n @param {RegExp} forbid @param {string|null} [avoid]
 * @param {boolean} [braces]
 */
export function quoteFor(fileText, lines, n, forbid = FORBID, avoid = null, braces = false) {
  return (avoid != null ? quoteRun(fileText, lines, n, forbid, avoid, braces) : null) ?? quoteRun(fileText, lines, n, forbid, null, braces);
}

/** Whether a quote may end before `raw[e]`: at whitespace; a name before its call or index (`(`, `[`) or before a
 *  closing mark (`)`, `]`, `}`, `,`, `;`, `:`); a closing bracket before what follows it. Never inside a name, an
 *  operator (`=>`, `===`, `//`) or a path or member (`dungeon.js`, `Math.floor`): a quote cut there names its line as
 *  well, and reads as a typo (`nothingText: () =`, `const cy = Math.`). */
export function tokenEdge(raw, e) {
  return /\s/.test(raw[e]) || (/[\w$]/.test(raw[e - 1]) && /[([)\]},;:]/.test(raw[e])) || (/[)\]]/.test(raw[e - 1]) && !/[\w$]/.test(raw[e]));
}

/** quoteFor's search: the first run whose brackets balance (braces too, where `braces`) - or, `open`, that leaves open
 *  the one brace its after-form's line closes - that stands once in the file and, given `absentFrom`, nowhere in that
 *  text. Where braces balance, a line that ends opening a block is whole without its brace (`if (people)`). */
function quoteRun(fileText, lines, n, forbid, absentFrom, braces = false, open = false) {
  const raw = lines[n - 1];
  if (raw == null) return null;
  const end = raw.trimEnd().length, s0 = bodyStart(raw);
  if (s0 >= end) return null;
  const whole = braces && !open && raw[end - 1] === '{' ? raw.slice(0, end - 1).trimEnd().length : end;
  for (let s = s0; s < end; s++) {
    if (s > s0 && !(/\s/.test(raw[s - 1]) && /\S/.test(raw[s]))) continue;   // a word's start
    for (let e = s + 1; e <= end; e++) {
      if (e < end && !tokenEdge(raw, e)) continue;
      const q = raw.slice(s, e).trimEnd();
      if (forbid.test(q) || q.length > QUOTE_MAX) break;
      if (q.length < QUOTE_MIN && !((e === end || e === whole) && s === s0)) continue;   // shorter only as the whole line
      if ((open ? balanced(q + '}', true) : balanced(q, braces)) && standing(fileText, q) === 1 && (absentFrom == null || !absentFrom.includes(q))) return q;
    }
  }
  return null;
}

/** An after-form's line as it is matched: as written, its indentation included, when it starts with whitespace; else
 *  trimmed. */
const afterText = (line, after) => (/^\s/.test(after) ? line.trimEnd() : line.trim());

/** The after-form naming line `n` from quote `q` of line `k`: `n`'s trimmed text when the first line after `k` that
 *  reads so is `n`, else its text as written when that one is; null when neither is. */
function afterLine(lines, k, n, q) {
  const raw = lines[n - 1].trimEnd(), t = raw.trim();
  for (const line of raw === t ? [t] : [t, raw]) {
    for (let j = k + 1; j <= lines.length; j++) if (afterText(lines[j - 1], line) === line) { if (j === n) return { quote: q, line }; break; }
  }
  return null;
}

/** The line that opens the block line `n` closes - its `{` matched by counting braces upward - when that line stands
 *  at `n`'s own indentation; else null (a brace in a string or a comment miscounted, or the opener was written over
 *  several lines). */
function openerOf(lines, n) {
  const indent = /^\s*/.exec(lines[n - 1])[0];
  let depth = 1;
  for (let k = n - 1; k >= 1; k--) {
    const l = lines[k - 1];
    for (let c = l.length - 1; c >= 0; c--) {
      if (l[c] === '}') depth++;
      else if (l[c] === '{' && --depth === 0) return /^\s*/.exec(l)[0] === indent ? k : null;
    }
  }
  return null;
}

/**
 * The after-form for a line too common to quote: the nearest quotable line above it within AFTER_REACH, when the first
 * line after that one with the same trimmed text is this one - or, where a twin of the trimmed text stands between (the
 * inner block's `    }` before the outer one's `  }`), the same line as written, its indentation included. Null
 * otherwise (a twin stands between even so, or the line has no indentation to tell them apart: a person's).
 * Where `braces` (an anchor in a code file's comment: balanced), the quote and the line balance as one text, read in
 * order: a line that closes a block is named from the line that opens it, by a quote that holds the `{` it closes
 * (`"if (cond) {".."}"`) - or, where that line cannot be quoted so (`} else {`), from the line before it in the chain,
 * up to the chain's head (`"if (opts.houseOwned) {".."}"` for the close of its `else`); a line that leaves a brace
 * open (`} else {`, `try {`) has none.
 * @returns {{ quote: string, line: string } | null}
 */
export function afterFor(fileText, lines, n, forbid = FORBID, avoid = null, braces = false) {
  const t = (lines[n - 1] ?? '').trim();
  if (!t || forbid.test(t) || !balanced(t)) return null;
  if (braces && !balanced(t, true)) {
    if (!balanced('{' + t, true)) return null;
    for (let k = openerOf(lines, n); k != null; k = lines[k - 1].trim().startsWith('}') ? openerOf(lines, k) : null) {
      const q = (avoid != null ? quoteRun(fileText, lines, k, forbid, avoid, true, true) : null) ?? quoteRun(fileText, lines, k, forbid, null, true, true);
      if (q) return afterLine(lines, k, n, q);
    }
    return null;
  }
  for (let k = n - 1; k >= Math.max(1, n - AFTER_REACH); k--) {
    const q = quoteFor(fileText, lines, k, forbid, avoid, braces);
    if (q) return afterLine(lines, k, n, q);
  }
  return null;
}

/**
 * The line an anchor names, or why it names none: 'missing' (the quote stands nowhere), 'ambiguous' (twice or more),
 * 'no-line' (the after-form's line follows nowhere).
 * @returns {{ line: number } | { error: string }}
 */
export function resolveAnchor(fileText, lines, quote, after = null) {
  const at = fileText.indexOf(quote);
  if (at < 0) return { error: 'missing' };
  if (fileText.indexOf(quote, at + 1) >= 0) return { error: 'ambiguous' };
  const k = fileText.slice(0, at).split('\n').length;
  if (after == null) return { line: k };
  for (let j = k + 1; j <= lines.length; j++) if (afterText(lines[j - 1], after) === after) return { line: j };
  return { error: 'no-line' };
}

/** The anchor text for line `n` of a file, spelled as the cite spelled its path - or null when there is none.
 *  `braces`: it stands in a code file (bracesAt), and its braces balance. */
export function anchorFor(spelled, fileText, lines, n, forbid, avoid = null, braces = false) {
  const q = quoteFor(fileText, lines, n, forbid, avoid, braces);
  if (q) return `${spelled}:"${q}"`;
  const a = afterFor(fileText, lines, n, forbid, avoid, braces);
  return a ? `${spelled}:"${a.quote}".."${a.line}"` : null;
}

/** Whether an anchor written into `docPath` balances its braces: in a code file, whose scanners count them (balanced);
 *  never in a Markdown doc. */
export const bracesAt = (docPath) => !/\.md$/.test(docPath);

/** A cached reader of a file as a quote sees it: `text` masked (maskAnchors), `lines` as written. `source(f)` is the
 *  file's current text; a new text is read afresh. */
export function reader(source) {
  const cache = new Map();
  return (f) => {
    const raw = source(f), hit = cache.get(f);
    if (hit && hit.raw === raw) return hit;
    const entry = { raw, text: maskAnchors(raw), lines: raw.split('\n') };
    cache.set(f, entry);
    return entry;
  };
}

/** The tracked .js/.mjs files, and a resolver from a cite's spelling to one of them (null: none, or more than one). */
export function makeResolver(codeFiles) {
  const byBase = new Map();
  for (const f of codeFiles) { const b = f.slice(f.lastIndexOf('/') + 1); (byBase.get(b) ?? byBase.set(b, []).get(b)).push(f); }
  return (spelled) => {
    const p = spelled.replace(/^\/+/, '').replace(/^(\.\.?\/)+/, '');   // a continuation's slash (`a"/world.js:"b"`) is no root
    const hits = p.includes('/') ? codeFiles.filter((f) => f === p || f.endsWith('/' + p)) : (byBase.get(p) ?? []);
    return hits.length === 1 ? { file: hits[0] } : { file: null, why: hits.length ? 'ambiguous' : 'foreign' };
  };
}

/** A line's struck stretches, each `~~` pair's [start, end) - or null when its marks do not pair (a strike opened or
 *  closed on another line), and the line is held whole. */
export function struckSpans(l) {
  const at = [...l.matchAll(/~~/g)].map((m) => m.index);
  if (at.length % 2) return null;
  const out = [];
  for (let k = 0; k < at.length; k += 2) out.push([at[k], at[k + 1] + 2]);
  return out;
}

/** Prose that names code other than the head's file: DFU or C# by name, or a PascalCase name - DFU's classes, methods
 *  and fields are PascalCase (`StaticNPC.SetRuntimeData`, `MinDamage`, `TextBox.cs`) where ours are camelCase, and a
 *  class or enum member of ours named in prose is other code too. */
export const OTHER_CODE = /\bDFU\b|\bC#|\b[A-Z][a-z]+(?:[A-Z][a-z0-9]*)+\b/;
/** A file of ours named in prose, without a line (`the shared \`ui/verticalScrollBar.js\`, whose press() ...`). */
const NAMED_FILE = /(?<![\w/.-])(?:[\w-]+\/)*([\w.-]+\.m?js)\b(?!:\d|:")/g;

/** Whether a bare continuation still belongs to its head: the continuation law reads `(:N)` as the head's file by
 *  position alone, so once the prose between them names other code - DFU's, or another file of ours - the number may
 *  be either.
 *  The review that closed the 2026-10-06 conversion found C# lines read that way (citeShift had moved some of them as
 *  if they were ours) and a file named in prose whose lines went to the head's file. Such a number is a person's - the
 *  writer says which: `C# :N`, the `.cs` file, or the full cite. */
export function headOwns(between, headFile) {
  if (OTHER_CODE.test(between)) return false;
  const own = headFile.slice(headFile.lastIndexOf('/') + 1);
  for (const m of between.matchAll(NAMED_FILE)) if (m[1] !== own) return false;
  return true;
}

/** A line with nothing to quote: blank, or a comment's bare opener, star or close. */
const BARE = /^(?:\/\*\*?|\*\/?|\*)?$/;

/** Whether a line opens a block - a brace left open past its last close (`if (x) {`, `} else {`, `_confirmExit() {`). */
export function opensBlock(t) {
  let d = 0, low = 0;
  for (const c of t) { if (c === '{') d++; else if (c === '}') low = Math.min(low, --d); }
  return d > low;
}

/**
 * The line an anchor names for a cite of line `n` (`end` a range's last line): a range is named at its first line that
 * takes an anchor; a single line with nothing on it (BARE) at the next one that does, within three lines - `nudged`,
 * for a person to see - and so, where an anchor balances its braces, a line that opens a block and has nothing to
 * quote but with its brace (`_confirmExit() {`, whose name stands in its calls too): the block's first line names it.
 * Null when neither has one.
 */
export function anchorLine(text, lines, n, end, forbid, braces = false) {
  const takes = (k) => k >= 1 && k <= lines.length && !BARE.test(lines[k - 1].trim()) && (quoteFor(text, lines, k, forbid, null, braces) != null || afterFor(text, lines, k, forbid, null, braces) != null);   // whether a line takes one at all: `avoid` only chooses among them
  if (end != null && end >= n) { for (let k = n; k <= end; k++) if (takes(k)) return { n: k, nudged: false }; return { n: null }; }
  if (takes(n)) return { n, nudged: false };
  const t = lines[n - 1].trim();
  if (!BARE.test(t) && !(braces && opensBlock(t))) return { n: null };
  for (let k = n + 1; k <= n + 3; k++) if (takes(k)) return { n: k, nudged: true };
  return { n: null };
}

/**
 * Plan one doc's conversions: every numeric cite into our code outside struck text, and its continuations.
 * @param {{ docPath: string, docText: string, resolve: Function, read: (file: string) => { text: string, lines: string[] } }} o
 * @returns {{ line: number, col: number, len: number, text: string, to: string|null, status: string, file?: string, n?: number }[]}
 *   status: 'anchor' (to is the anchor), 'nudged' (an anchor of a nearby line - BARE), 'struck', 'foreign',
 *   'ambiguous', 'unquotable', 'past-end', 'in-code' (in a code file outside a comment: a person's), 'relay' (held:
 *   a file of the relay's bundle), 'chain' (a slash's continuation after a cite that stays a number: its head first),
 *   'unclear' (a continuation after prose that names DFU's code or another file of ours: headOwns)
 */
export function planDoc({ docPath, docText, resolve, read, relay = null }) {
  const out = [];
  const held = relay?.has(docPath) ? 'relay' : null;
  const braces = bracesAt(docPath);
  let ownText = null;   // the citing file as a quote must avoid it (quoteFor), read once
  const foreign = new Set(FOREIGN.filter(([d]) => d === docPath).map(([, b]) => b));
  const code = /\.md$/.test(docPath) ? codeOpenAt(docText) : [];
  docText.split('\n').forEach((l, i) => {
    if (!/\.m?js:\d/.test(l) && !/:\d/.test(l)) return;
    const spans = l.includes('~~') ? struckSpans(l) : [];
    const struckAt = (col) => spans === null || spans.some(([a, b]) => col >= a && col < b);
    // a chain's head is a numeric cite, or an anchor already written - whose bare continuations are still its own to
    // convert (a person who anchors a head by hand leaves its `/:N` to the next run, and the gate sees it)
    const heads = [...l.matchAll(NUM_CITE)].map((m) => ({ m, numeric: true }))
      .concat([...l.matchAll(ANCHOR)].map((m) => ({ m, numeric: false })))
      .sort((a, b) => a.m.index - b.m.index);
    if (!heads.length) return;
    const stops = [...regionStops(l), ...heads.filter((h) => !h.numeric).map((h) => h.m.index)].sort((a, b) => a - b);
    for (const { m, numeric } of heads) {
      const spelled = m[1];
      const items = numeric ? [{ col: m.index, len: m[0].length, text: m[0], n: +m[2], end: m[3] ? +m[3] : null, sep: '' }] : [];
      const from = m.index + m[0].length, to = stops.find((x) => x >= from) ?? l.length;
      for (const { m: c, at } of continuationsIn(l, from, to)) items.push({ col: at, len: c[0].length, text: c[0], n: +c[2], end: c[3] ? +c[3] : null, sep: c[1].replace(/:$/, '') });
      if (!items.length) continue;
      const bare = spelled.replace(/^\/+/, '');
      const r = foreign.has(bare.slice(bare.lastIndexOf('/') + 1)) ? { file: null, why: 'foreign' } : resolve(spelled);
      let before = numeric ? null : true;   // whether the chain's last element is an anchor (written, or to be)
      for (const it of items) {
        const base = { line: i + 1, col: it.col, len: it.len, text: it.text };
        const push = (p) => { out.push({ ...base, ...p }); before = p.status === 'anchor' || p.status === 'nudged'; };
        if (struckAt(it.col) || held) { push({ to: null, status: held ?? 'struck' }); continue; }
        if (!r.file) { push({ to: null, status: r.why }); continue; }
        if (!headOwns(l.slice(from, it.col), r.file)) { push({ to: null, status: 'unclear', file: r.file, n: it.n }); continue; }   // a head's own slice is empty
        // a slash's continuation after a number that stays a number would read as that number's directory
        if (before === false && it.sep.startsWith('/')) { push({ to: null, status: 'chain', file: r.file, n: it.n }); continue; }
        const { text, lines } = read(r.file);
        if (it.n < 1 || it.n > lines.length) { push({ to: null, status: 'past-end', file: r.file, n: it.n }); continue; }
        const forbid = forbidAt(docPath, l, it.col, code[i]);
        if (!forbid) { push({ to: null, status: 'in-code', file: r.file, n: it.n }); continue; }
        const { n, nudged } = anchorLine(text, lines, it.n, it.end, forbid, braces);
        const avoid = r.file === docPath ? null : (ownText ??= maskAnchors(docText));
        const a = n == null ? null : anchorFor(bare, text, lines, n, forbid, avoid, braces);
        push({ to: a == null ? null : it.sep + a, status: a == null ? 'unquotable' : nudged ? 'nudged' : 'anchor', file: r.file, n: n ?? it.n, cited: it.n });
      }
    }
  });
  return out;
}

/** Rewrite a doc's 'anchor' entries, right to left within a line. */
export function applyPlan(docText, plan) {
  const lines = docText.split('\n');
  const byLine = new Map();
  for (const p of plan) if (p.status === 'anchor' || p.status === 'nudged') (byLine.get(p.line) ?? byLine.set(p.line, []).get(p.line)).push(p);
  for (const [ln, ps] of byLine) {
    let l = lines[ln - 1];
    for (const p of ps.sort((x, y) => y.col - x.col)) l = l.slice(0, p.col) + p.to + l.slice(p.col + p.len);
    lines[ln - 1] = l;
  }
  return lines.join('\n');
}

/** Every anchor in a doc, resolved: [{ line, text, file, error? }]. */
export function checkDoc({ docText, resolve, read }) {
  const out = [];
  docText.split('\n').forEach((l, i) => {
    if (!l.includes(':"')) return;
    for (const m of l.matchAll(ANCHOR)) {
      const r = resolve(m[1]);
      if (!r.file) { out.push({ line: i + 1, text: m[0], file: null, error: r.why }); continue; }
      const { text, lines } = read(r.file);
      const v = resolveAnchor(text, lines, m[2], m[3] ?? null);
      out.push({ line: i + 1, text: m[0], file: r.file, ...v });
    }
  });
  return out;
}

/**
 * The lines of `target` the anchors in `text` name - a test's way to read a cite and judge where it lands, as CD4 and
 * the pins that once compared a number do. `target` a tracked path; anchors spelled by its path or basename.
 * @returns {{ quote: string, after: string|null, line: number|null, text: string|null, error?: string }[]}
 */
export function citedLines(text, target, root = ROOT) {
  const base = target.slice(target.lastIndexOf('/') + 1);
  const raw = readFileSync(join(root, target), 'utf8');
  const masked = maskAnchors(raw), lines = raw.split('\n');
  const out = [];
  for (const m of text.matchAll(ANCHOR)) {
    const spelled = m[1].replace(/^\/+/, '').replace(/^(\.\.?\/)+/, '');
    if (spelled !== target && spelled !== base && !target.endsWith('/' + spelled)) continue;
    const v = resolveAnchor(masked, lines, m[2], m[3] ?? null);
    out.push({ quote: m[2], after: m[3] ?? null, line: v.line ?? null, text: v.line ? lines[v.line - 1] : null, ...(v.error ? { error: v.error } : {}) });
  }
  return out;
}

/** The docs a cite can stand in, and the code it can point at - git's tracked files, as citeShift reads them. */
export function trackedSets(root = ROOT) {
  const files = execFileSync('git', ['ls-files', 'bible', 'test', 'src', 'tools'], { cwd: root, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER }).split('\n').filter(Boolean);
  const all = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER }).split('\n').filter(Boolean);
  return {
    docs: files.filter((f) => /\.(js|mjs|md|sh)$/.test(f) && !SELF_DOCS.includes(f)),
    code: all.filter((f) => /\.m?js$/.test(f)),
  };
}

/**
 * Convert every doc in memory and settle it: plan against the texts as they stand, write the anchors, then resolve each
 * new anchor against the CONVERTED texts - a cited file that is itself a doc had its own cites rewritten, which can
 * change a quoted line or stand a quote twice - and re-quote any that no longer names its line, until none moves.
 * @param {Map<string, string>} texts - doc path -> text (rewritten in place)
 * @returns {{ plans: Map<string, any[]>, requoted: number }}
 */
export function convertAll(texts, { resolve, readFile, relay = null }) {
  const read = reader((f) => texts.get(f) ?? readFile(f));
  const plans = new Map(), placed = [];
  for (const [d, docText] of texts) plans.set(d, planDoc({ docPath: d, docText, resolve, read, relay }));
  for (const [d, plan] of plans) {
    const anchors = plan.filter((p) => p.status === 'anchor' || p.status === 'nudged');
    if (!anchors.length) continue;
    texts.set(d, applyPlan(texts.get(d), plan));
    for (const p of anchors) placed.push({ doc: d, line: p.line, col: p.col, to: p.to, file: p.file, n: p.n, text: p.text, entry: p });
  }
  let requoted = 0;
  for (let round = 0; round < 10; round++) {
    let moved = 0;
    for (const a of placed) {
      if (a.held) continue;
      const m = /^(.*?)((?:[\w./-]*\/)?[\w.-]+\.m?js):"([^"\n]+)"(?:\.\."([^"\n]+)")?$/.exec(a.to);
      const { text, lines } = read(a.file);
      const v = resolveAnchor(text, lines, m[3], m[4] ?? null);
      if (v.line === a.n) continue;
      const docLines = texts.get(a.doc).split('\n');
      const open = /\.md$/.test(a.doc) ? codeOpenAt(texts.get(a.doc))[a.line - 1] : false;
      const next = anchorFor(m[2], text, lines, a.n, forbidAt(a.doc, docLines[a.line - 1], a.col, open) ?? FORBID, a.file === a.doc ? null : maskAnchors(texts.get(a.doc)), bracesAt(a.doc));
      const at = docLines[a.line - 1].indexOf(a.to);
      if (at < 0) throw new Error(`citeAnchor: cannot settle ${a.doc}:${a.line} ${a.to} (${a.file}:${a.n})`);
      // the line its number named holds nothing quotable once its own cites are anchors (`(save.js:520 out, :587
      // back)`): the number stands, and it is a person's - reported, as any line with no quote is
      const to = next == null ? a.text : m[1] + next;
      if (next == null) Object.assign(a.entry, { status: 'unquotable', to: null });
      docLines[a.line - 1] = docLines[a.line - 1].slice(0, at) + to + docLines[a.line - 1].slice(at + a.to.length);
      texts.set(a.doc, docLines.join('\n'));
      if (next == null) { a.held = true; moved++; continue; }
      a.to = to; moved++; requoted++;
    }
    if (!moved) return { plans, requoted };
  }
  throw new Error('citeAnchor: the anchors did not settle in ten rounds');
}

function main(argv) {
  const apply = argv.includes('--apply'), check = argv.includes('--check');
  const { docs, code } = trackedSets();
  const resolve = makeResolver(code);
  const readFile = (f) => readFileSync(join(ROOT, f), 'utf8');
  if (check) {
    const read = reader(readFile);
    let bad = 0, good = 0;
    for (const d of docs) {
      for (const a of checkDoc({ docText: readFile(d), resolve, read })) {
        if (a.error) { bad++; console.log(`  ${a.error.toUpperCase().padEnd(10)} ${d}:${a.line}  ${a.text}`); } else good++;
      }
    }
    console.log(`${good + bad} anchor(s): ${good} resolve, ${bad} do not`);
    return bad ? 1 : 0;
  }
  const before = new Map(docs.map((d) => [d, readFile(d)]));
  const texts = new Map(before);
  const { plans, requoted } = convertAll(texts, { resolve, readFile, relay: argv.includes('--relay') ? null : relayFiles() });
  const tally = { anchor: 0, nudged: 0, struck: 0, relay: 0, foreign: 0, ambiguous: 0, unquotable: 0, 'past-end': 0, 'in-code': 0, chain: 0, unclear: 0 };
  let escaped = 0, changedDocs = 0;
  for (const [d, plan] of plans) {
    for (const p of plan) {
      tally[p.status]++;
      if (p.status === 'anchor') console.log(`  ${apply ? 'anchored' : 'ANCHOR  '} ${d}:${p.line}  ${p.text} -> ${p.to}`);
      else if (p.status === 'nudged') console.log(`  NUDGED     ${d}:${p.line}  ${p.text} -> ${p.to}  (${p.file}:${p.cited} ${JSON.stringify((readFile(p.file).split('\n')[p.cited - 1] ?? '').trim())} -> :${p.n})`);
      else if (p.status !== 'struck' && p.status !== 'relay') {
        const at = p.file ? (readFile(p.file).split('\n')[p.n - 1] ?? '').trim().slice(0, 60) : '';
        console.log(`  ${p.status.toUpperCase().padEnd(10)} ${d}:${p.line}  ${p.text}${p.file ? `  (${p.file}:${p.n} ${JSON.stringify(at)})` : ''}`);
      }
    }
    for (const m of before.get(d).matchAll(ESCAPED_NUM_CITE)) { escaped++; console.log(`  ESCAPED    ${d}:${before.get(d).slice(0, m.index).split('\n').length}  ${m[0]}`); }
    if (apply && texts.get(d) !== before.get(d)) { writeFileSync(join(ROOT, d), texts.get(d)); changedDocs++; }
  }
  console.log(`${tally.anchor + tally.nudged} cite(s) ${apply ? 'anchored' : 'to anchor'} (${tally.nudged} nudged off a bare line; ${apply ? changedDocs + ' doc(s) written, ' : ''}${requoted} re-quoted after the conversion); held: ${tally.struck} struck, ${tally.relay} in the relay's bundle, ${tally.foreign} foreign; for a person: ${tally.ambiguous} ambiguous, ${tally.unquotable} unquotable, ${tally['past-end']} past the end, ${tally['in-code']} in code, ${tally.chain} behind a head left as a number, ${tally.unclear} after prose naming other code, ${escaped} escaped`);
  const open = tally.ambiguous + tally.unquotable + tally['past-end'] + tally['in-code'] + tally.chain + tally.unclear + escaped + (apply ? 0 : tally.anchor + tally.nudged);
  return open ? 1 : 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
