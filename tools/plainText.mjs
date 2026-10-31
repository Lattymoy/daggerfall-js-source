#!/usr/bin/env node
// PLAIN-TEXT (2026-10-26; the owner: "We need a law to reduce over explanatory text + reduce the amount of ai-like
// crafted text"). Measures the three places text grows: the player's strings, code comments and the bible.
// The law is bible/Home.md's SAY IT ONCE, PLAINLY; test/tooling/plaintext.test.js enforces it.
//   node tools/plainText.mjs              report what breaks the law, against the baseline
//   node tools/plainText.mjs --lower      rewrite the baseline to today's excess (never raises one)
//   node tools/plainText.mjs --seed REF   at a merge from a base without the law: admit REF's own excess, no more
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStringTableCsv } from '../src/systems/textManager.js';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE = 'tools/plainTextBaseline.json';

/** A player string's limits: words in the whole string and in its longest sentence. Longer help is a page or a fold. */
export const STRING_WORDS_MAX = 40;
export const SENTENCE_WORDS_MAX = 25;
/** Phrases that pad or sell instead of saying. Only words never needed in this game's text. */
export const PADDING = Object.freeze([
  /\bseamless(ly)?\b/i,
  /\bdelve\b/i,
  /\belevate\b/i,
  /\bembark\b/i,
  /\bunleash\b/i,
  /\bvibrant\b/i,
  /\bbustling\b/i,
  /\ba testament to\b/i,
  /\btapestry of\b/i,
  /\bin the world of\b/i,
  /\bdive into\b/i,
  /\bwhether you're\b/i,
  /\bnot (just|only|merely)\b/i,
  /\bsimply\b/i,
  /\bplease note\b/i,
  /\brest assured\b/i,
  /\bit'?s worth noting\b/i,
  /\bgame-?changer\b/i,
  /—/,
  /[\u{1F300}-\u{1FAFF}]/u,
]);
/** A comment block's most lines (a run of comment lines with no code between). */
export const COMMENT_LINES_MAX = 8;
/** A bible paragraph's most words (tables and code blocks aside). */
export const PARAGRAPH_WORDS_MAX = 150;
/** Where comments are measured. */
export const SOURCE_DIRS = Object.freeze(['src', 'server-account/src', 'server/src']);
/** AUDIT HORIZONTAL PT1, PT4: the baseline's parts, each `key -> excess past its limit` - a string's words past 40, its
 *  longest sentence's past 25 and its padding phrases; a source file's comment lines past 8, summed over its blocks; a
 *  bible page's words past 150, summed over its paragraphs. A count of long blocks let a block grow unseen. */
export const PARTS = Object.freeze(['strings', 'sentences', 'padding', 'comments', 'bible']);

const count = (s) => String(s).split(/\s+/).filter(Boolean).length;
/** The most renderings a message is read in (a message of many choices is measured by its first ones). */
export const RENDERINGS_MAX = 256;
/** The index of the brace closing the one at `at`, or -1. */
function closing(s, at) {
  for (let i = at, d = 0; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}' && --d === 0) return i;
  }
  return -1;
}
/** AUDIT HORIZONTAL PT3: what a message renders as - each plural or select branch in turn, every argument one word (X).
 *  The branches were one X, so a long branch was never read. Unbalanced braces read as the text itself. */
export function renderings(text) {
  const s = String(text);
  let out = [''];
  for (let i = 0; i < s.length;) {
    const open = s.indexOf('{', i);
    if (open < 0) {
      out = out.map((o) => o + s.slice(i));
      break;
    }
    const end = closing(s, open);
    if (end < 0) return [s];
    const body = s.slice(open + 1, end);
    const head = /^\s*[\w.]+\s*,\s*(?:plural|select|selectordinal)\s*,/.exec(body);
    const alts = [];
    for (let j = head ? head[0].length : body.length; j < body.length;) {
      const b = body.indexOf('{', j);
      const e = b < 0 ? -1 : closing(body, b);
      if (e < 0) break;
      alts.push(...renderings(body.slice(b + 1, e)));
      j = e + 1;
    }
    const lead = s.slice(i, open);
    out = out.flatMap((o) => (alts.length ? alts : ['X']).map((a) => o + lead + a)).slice(0, RENDERINGS_MAX);
    i = end + 1;
  }
  return out;
}
/** The words a player reads in a message: its longest rendering's. */
export const messageWords = (text) => Math.max(0, ...renderings(text).map(count));

/** A player string's breaches: `{ words, sentence, padding }` with each over its limit, or null where it keeps the law. */
export function stringBreach(text) {
  const all = renderings(text);
  const w = Math.max(0, ...all.map(count));
  const s = Math.max(0, ...all.flatMap((r) => r.split(/(?<=[.!?])\s+/).map(count)));
  const padding = PADDING.filter((re) => re.test(text)).map(String);
  if (w <= STRING_WORDS_MAX && s <= SENTENCE_WORDS_MAX && !padding.length) return null;
  return { words: w, sentence: s, padding };
}

/** A source file's comment lines past COMMENT_LINES_MAX, summed over its blocks. AUDIT HORIZONTAL PT2: a block is a run
 *  of comment lines no code line breaks - a blank line ends none. PT6: a version log's entry (`// world271:`,
 *  `// acct198:`) is a block of its own, as PT5's list item is - a bump's note moved into the log grows no block. */
export const VERSION_LOG_LINE = /^\/\/\s*(?:world|acct)\d+:/;
export function commentExcess(text) {
  let run = 0,
    inBlock = false,
    n = 0;
  const end = () => {
    n += Math.max(0, run - COMMENT_LINES_MAX);
    run = 0;
  };
  for (const line of String(text).split('\n')) {
    const t = line.trim();
    if (!t && !inBlock) continue;
    let c = false;
    if (inBlock) {
      c = true;
      if (t.includes('*/')) inBlock = false;
    } else if (t.startsWith('//')) c = true;
    else if (/^\/\*[^]*?\*\/\s*\S/.test(t) && !/^\/\*[^]*?\*\/\s*\/[/*]/.test(t))
      c = false; // a JSDoc cast opening a code line is code (LEGIBLE 3)
    else if (t.startsWith('/*')) {
      c = true;
      if (!t.includes('*/')) inBlock = true;
    }
    if (c && !inBlock && VERSION_LOG_LINE.test(t)) {
      end();
      continue;
    }
    if (c) run++;
    else end();
  }
  return n + Math.max(0, run - COMMENT_LINES_MAX);
}

/** A bible page's words past PARAGRAPH_WORDS_MAX, summed over its paragraphs (tables and code blocks aside). A top-level
 *  list item is a paragraph of its own: an index page is one list, and its next entry is not its last one grown. */
/** A cite into our code (`world.js:"const a = 1"`, a range's `.."}"` with it): an address, not prose - its quote is the
 *  code's own words, and a layout change that moves the code lengthens the quote (LEGIBLE 3). */
export const CITE_ANCHOR = /[\w./-]+\.m?js:"(?:[^"\\\n]|\\.)*"(?:\.\."(?:[^"\\\n]|\\.)*")?/g;

export function paragraphExcess(text) {
  return String(text)
    .replace(CITE_ANCHOR, 'cite')
    .split(/\n\s*\n/)
    .filter((p) => !/^\s*(\||```)/.test(p))
    .flatMap((p) => p.split(/\n(?=(?:[-*+]|\d+\.) )/))
    .reduce((n, p) => n + Math.max(0, count(p) - PARAGRAPH_WORDS_MAX), 0);
}

const walk = (root, dir, ext, out = []) => {
  if (!existsSync(join(root, dir))) return out;
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(root, p, ext, out);
    else if (ext.test(e.name)) out.push(p);
  }
  return out;
};

/** The tree on disk, as measure() reads it. */
const diskTree = (root) => ({
  list: (dir, ext) => walk(root, dir, ext),
  read: (f) => readFileSync(join(root, f), 'utf8'),
});
/** The tree at a git ref, read in one `git cat-file --batch`. */
export function gitTree(ref, root = ROOT) {
  const git = (args, input) => execFileSync('git', args, { cwd: root, input, maxBuffer: 1 << 30 });
  const paths = String(git(['ls-tree', '-r', '--name-only', ref, '--', ...SOURCE_DIRS, 'bible', 'locales/en']))
    .split('\n')
    .filter(Boolean);
  const out = git(['cat-file', '--batch'], paths.map((p) => `${ref}:${p}`).join('\n'));
  const files = new Map();
  let at = 0;
  for (const p of paths) {
    const nl = out.indexOf(10, at);
    const size = Number(String(out.subarray(at, nl)).split(' ')[2]);
    files.set(p, out.subarray(nl + 1, nl + 1 + size).toString('utf8'));
    at = nl + 1 + size + 1;
  }
  return {
    list: (dir, ext) => paths.filter((p) => p.startsWith(`${dir}/`) && ext.test(p)),
    read: (f) => files.get(f) ?? '',
  };
}

/** Today's excess, each part's (PARTS) - a key listed only where it has some. `tree` the files read (the disk's, or
 *  gitTree's). */
export function measure(root = ROOT, tree = diskTree(root)) {
  const out = Object.fromEntries(PARTS.map((p) => [p, /** @type {Record<string, number>} */ ({})]));
  const put = (part, k, n) => {
    if (n > 0) out[part][k] = n;
  };
  for (const [k, v] of parseStringTableCsv(tree.read('locales/en/Port_Strings.csv'))) {
    const b = stringBreach(v);
    if (b) {
      put('strings', k, b.words - STRING_WORDS_MAX);
      put('sentences', k, b.sentence - SENTENCE_WORDS_MAX);
      put('padding', k, b.padding.length);
    }
  }
  for (const f of SOURCE_DIRS.flatMap((d) => tree.list(d, /\.(m?js)$/)))
    put('comments', f, commentExcess(tree.read(f)));
  for (const f of tree.list('bible', /\.md$/)) put('bible', f, paragraphExcess(tree.read(f)));
  return out;
}

/** A merge from a base that does not hold the law yet: each excess past the baseline is admitted up to the base's own
 *  for it, never past it - what the base wrote before the law stands, what this branch adds does not. */
export function seeded(base, now, at) {
  const out = {};
  for (const part of PARTS) {
    out[part] = { ...(base[part] ?? {}) };
    for (const [k, n] of Object.entries(now[part] ?? {})) {
      const allow = Math.min(n, at[part]?.[k] ?? 0);
      if (allow > (out[part][k] ?? 0)) out[part][k] = allow;
    }
  }
  return out;
}

/** AUDIT HORIZONTAL PT4: whether `ref` already holds the law - its baseline file. Seeded from such a ref (the branch's own
 *  HEAD), a seed admitted everything the branch wrote. */
export function holdsLaw(ref, root = ROOT) {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${BASELINE}`], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
/** `--seed REF`: the baseline with REF's own excess admitted, or null - refused - where REF holds the law. */
export function seedFrom(ref, base, now, root = ROOT) {
  return holdsLaw(ref, root) ? null : seeded(base, now, measure(root, gitTree(ref, root)));
}

/** What breaks the law against `base`: an entry past its baseline (none for one not listed), and a baseline entry now
 *  lower than written (the baseline only shrinks, so it is lowered in the same change). */
export function verdict(now, base) {
  const over = [],
    stale = [];
  for (const part of PARTS) {
    const b = base[part] ?? {},
      n0 = now[part] ?? {};
    for (const [k, n] of Object.entries(n0))
      if (n > (b[k] ?? 0)) over.push(`${part} ${k}: ${n} (allowed ${b[k] ?? 0})`);
    for (const [k, n] of Object.entries(b))
      if ((n0[k] ?? 0) < n) stale.push(`${part} ${k}: ${n0[k] ?? 0} (baseline ${n})`);
  }
  return { over, stale };
}

/** A baseline as written: every part, its keys in order. */
const sortedBaseline = (b) =>
  Object.fromEntries(
    PARTS.map((p) => [p, Object.fromEntries(Object.entries(b[p] ?? {}).sort(([x], [y]) => x.localeCompare(y)))]),
  );

if (isMain(import.meta.url)) {
  const now = measure();
  const path = join(ROOT, BASELINE);
  const base = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const seedAt = process.argv.indexOf('--seed');
  if (seedAt > 0) {
    const ref = process.argv[seedAt + 1];
    const seed = seedFrom(ref, base, now);
    if (!seed) {
      console.log(`REFUSED  ${ref} holds ${BASELINE} already: a seed admits only a base without the law`);
      process.exitCode = 1;
    } else {
      for (const part of PARTS)
        for (const [k, n] of Object.entries(seed[part]))
          if (n !== (base[part]?.[k] ?? 0)) console.log(`SEED  ${part} ${k}: ${base[part]?.[k] ?? 0} -> ${n}`);
      writeFileSync(path, `${JSON.stringify(sortedBaseline(seed), null, 1)}\n`);
    }
  } else if (process.argv.includes('--lower')) {
    const low = Object.fromEntries(
      PARTS.map((p) => [
        p,
        Object.fromEntries(
          Object.entries(base[p] ?? {})
            .map(([k, n]) => [k, Math.min(n, now[p][k] ?? 0)])
            .filter(([, n]) => n > 0),
        ),
      ]),
    );
    writeFileSync(path, `${JSON.stringify(sortedBaseline(low), null, 1)}\n`);
    console.log('baseline lowered');
  } else {
    const { over, stale } = verdict(now, base);
    for (const o of over) console.log(`OVER  ${o}`);
    for (const s of stale) console.log(`LOWER ${s}`);
    if (!over.length && !stale.length) console.log('plain text: within the law');
    process.exitCode = over.length || stale.length ? 1 : 0;
  }
}
