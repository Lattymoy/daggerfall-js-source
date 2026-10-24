// CARRY PINS - moves the mutant records and the cites through a mechanical change (LEGIBLE 2,
// bible/01-Overview/Readability-Arc.md).
//
// A mutant record quotes the exact source text it replaces, and a cite quotes the exact line it names. A formatter or a
// rename changes that text in thousands of places at once, and every record and cite that quoted it goes stale. This
// carries them, given the change as a function `transform(source, file) -> source`:
//
//   - A MUTANT RECORD is carried by running the transform over both sides: the file as it is, and the file with the
//     mutant applied. The two outputs differ only where the mutant does, so the stretch between their common start and
//     common end - widened to whole lines, and further until it stands once in the file - is the record's new `old`,
//     and the same stretch of the mutated output is its new `new`. Applying the carried record to the transformed file
//     gives exactly the transformed mutant, and that is checked for every record.
//   - A CITE is carried by mapping its line: the two versions of the file are cut into tokens (comments included) and
//     lined up, so the first token of the cited line finds its place in the new text. The new anchor for that line is
//     then written by tools/citeAnchor.mjs's own rules (`anchorLine`, `anchorFor`), as `npm run cites -- --apply` would
//     write it, and every carried anchor is resolved again until none moves.
//
// What cannot be carried is reported, never guessed: a record whose mutant does not survive the transform (it does not
// parse, or the transform erases it), a cite whose line holds no token, an anchor in a code string. A record whose text
// stands twice is carried as tools/mutate.mjs applies it - at the first copy - and comes out naming that one site.
//
//   node tools/carryPins.mjs --transform <module.mjs> [path ...] [--write] [--jobs N]
//       <module.mjs> exports `transform(source, file)`; the paths default to every tracked .js/.mjs. Without --write
//       it reports what it would carry; with it, it writes the transformed files, the records and the docs. Then
//       `node tools/sameProgram.mjs --against HEAD` proves the files are the same programs.
//       Carrying a record runs the transform over its whole file once, so a file with thousands of records (world.js
//       has 3,778) is the slow part: the records are carried on N worker threads (default: every core).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tokenizer } from 'acorn';
import {
  ANCHOR, reader, makeResolver, trackedSets, resolveAnchor, anchorLine, anchorFor, forbidAt, codeOpenAt, maskAnchors, bracesAt,
} from './citeAnchor.mjs';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Replace the first occurrence of `find` in `text` - as tools/mutate.mjs applies a record. */
const replaceFirst = (text, find, replacement) => {
  const at = text.indexOf(find);
  return at < 0 ? text : text.slice(0, at) + replacement + text.slice(at + find.length);
};
/** A string of its own: a slice of a string keeps the whole of it alive (V8), and a carried record is a slice of a
 *  transformed file - kept for every record of a file, those were 3,781 copies of world.js and 11 GB. */
const detach = (text) => Buffer.from(text, 'utf8').toString('utf8');
const occurrences = (text, find) => {
  let count = 0;
  for (let at = text.indexOf(find); at >= 0 && count < 2; at = text.indexOf(find, at + 1)) count++;
  return count;
};

/**
 * Carry one mutant record through a transform of its file.
 * @param {{ old: string, new: string }} record
 * @param {string} source - the file as the record was written against
 * @param {(src: string) => string} transform
 * @param {string} [transformed] - transform(source), when the caller already has it
 * @returns {{ record: object } | { error: string }}
 */
export function carryMutant(record, source, transform, transformed = transform(source)) {
  if (!source.includes(record.old) || record.old === '') return { error: 'the record does not apply to the file as it stands' };
  // a record whose text stands twice mutates the first copy, as tools/mutate.mjs does (mutantdrift.test.js holds the
  // few that do, CARRIED_AIM): carried, it names that site alone
  const mutated = replaceFirst(source, record.old, record.new);
  let transformedMutant;
  try {
    transformedMutant = transform(mutated);
  } catch (e) {
    return { error: `the transform cannot run on the mutant (${e.message.split('\n')[0]})` };
  }
  if (transformedMutant === transformed) return { error: 'the transform erases the mutant (it changed only what the transform drops)' };

  let start = 0;
  const shortest = Math.min(transformed.length, transformedMutant.length);
  while (start < shortest && transformed[start] === transformedMutant[start]) start++;
  let tail = 0;
  while (tail < shortest - start && transformed[transformed.length - 1 - tail] === transformedMutant[transformedMutant.length - 1 - tail]) tail++;

  // widen to whole lines, then line by line until the stretch stands once in the transformed file
  let from = transformed.lastIndexOf('\n', start - 1) + 1;
  let to = transformed.indexOf('\n', transformed.length - tail);
  if (to < 0) to = transformed.length;
  const stretch = () => transformed.slice(from, to);
  let widenUp = true;
  while (occurrences(transformed, stretch()) !== 1 || stretch() === '') {
    if (from === 0 && to === transformed.length) return { error: 'no stretch of the transformed file names the site once' };
    if ((widenUp && from > 0) || to === transformed.length) from = transformed.lastIndexOf('\n', from - 2) + 1;
    else to = transformed.indexOf('\n', to + 1) < 0 ? transformed.length : transformed.indexOf('\n', to + 1);
    widenUp = !widenUp;
  }
  const carried = { ...record, old: detach(stretch()), new: detach(transformedMutant.slice(from, transformedMutant.length - (transformed.length - to))) };
  if (replaceFirst(transformed, carried.old, carried.new) !== transformedMutant) return { error: 'the carried record does not reproduce the transformed mutant' };
  return { record: carried };
}

/** A source's tokens and comments in order, each with its line and a key that ignores how it is spelled. */
function tokensOf(source, renames) {
  const comments = [];
  const tokens = [];
  const options = { ecmaVersion: 'latest', locations: true, allowHashBang: true, onComment: comments };
  let list;
  try {
    list = [...tokenizer(source, { ...options, sourceType: 'module' })];
  } catch {
    comments.length = 0;
    list = [...tokenizer(source, { ...options, sourceType: 'script' })];
  }
  for (const t of list) {
    let value = t.value;
    if (t.type.label === 'name' && Object.hasOwn(renames, value)) value = renames[value];
    if (t.type.label === 'regexp') value = `${t.value.pattern}/${t.value.flags}`;
    tokens.push({ key: `${t.type.label}:${typeof value === 'bigint' ? `${value}n` : String(value ?? '')}`, start: t.start, line: t.loc.start.line, endLine: t.loc.end.line });
  }
  for (const c of comments) tokens.push({ key: `comment:${c.value.trim()}`, start: c.start, line: c.loc.start.line, endLine: c.loc.end.line });
  return tokens.sort((a, b) => a.start - b.start);
}

/** Punctuation a layout change may add or drop without changing the program. */
const OPTIONAL = new Set([';:', ',:', '(:', '):']);
/** How far ahead to look for the next shared token when two runs disagree. */
const RESYNC_REACH = 64;

/**
 * Line up two versions of a file token by token, and map a line of the first to the lines it became in the second:
 * the new lines of every token that starts on it, in order - more than one where a crowded line was split. Given an
 * offset into the line (where a cite's quote starts), the line of the first token at or after it comes first: a cite
 * quotes the part of a crowded line it means. A line inside a token that spans lines (a block comment, a template)
 * keeps its offset within that token. Empty when no token of the line found its place.
 * @param {string} oldSource
 * @param {string} newSource
 * @param {{ renames?: Record<string, string> }} [options]
 * @returns {(line: number, offset?: number | null) => number[]}
 */
export function lineMap(oldSource, newSource, { renames = {} } = {}) {
  const a = tokensOf(oldSource, renames), b = tokensOf(newSource, {});
  const matched = new Array(a.length).fill(-1);
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].key === b[j].key) { matched[i++] = j++; continue; }
    if (OPTIONAL.has(a[i].key)) { i++; continue; }
    if (OPTIONAL.has(b[j].key)) { j++; continue; }
    let found = false;
    for (let reach = 1; reach <= RESYNC_REACH && !found; reach++) {
      if (i + reach < a.length && a[i + reach].key === b[j].key) { i += reach; found = true; } else if (j + reach < b.length && a[i].key === b[j + reach].key) { j += reach; found = true; }
    }
    if (!found) { i++; j++; }
  }
  const startingOn = new Map(), spanning = [];
  a.forEach((t, k) => {
    if (!startingOn.has(t.line)) startingOn.set(t.line, []);
    startingOn.get(t.line).push(k);
    if (t.endLine > t.line) spanning.push(k);
  });
  return (line, offset = null) => {
    const lines = new Set();
    if (offset != null) {
      // the token the quote starts in - a quote may start inside one (a comment's words, a string's)
      let quoted;
      for (const k of startingOn.get(line) ?? []) { if (a[k].start <= offset) quoted = k; else break; }
      if (quoted !== undefined && matched[quoted] >= 0) lines.add(b[matched[quoted]].line);
    }
    for (const k of startingOn.get(line) ?? []) if (matched[k] >= 0) lines.add(b[matched[k]].line);
    if (!lines.size) {
      // a line inside a token that spans lines: the same offset into the token's new place, if the token kept its text
      for (const k of spanning) {
        if (a[k].line < line && line <= a[k].endLine && matched[k] >= 0 && a[k].endLine - a[k].line === b[matched[k]].endLine - b[matched[k]].line) {
          lines.add(b[matched[k]].line + (line - a[k].line));
        }
      }
    }
    return [...lines];
  };
}

/**
 * Carry every anchor into the changed files through the change.
 * @param {{
 *   docs: Map<string, string>,                 doc path -> its text (a changed file that is also a doc: its NEW text)
 *   oldText: (file: string) => string,         a code file as the anchors were written against
 *   newText: (file: string) => string,         a code file after the change
 *   changed: Set<string>,                      the files the change touched
 *   codeFiles: string[],                       every tracked .js/.mjs (for resolving a cite's spelling)
 *   renames?: Record<string, string>,
 * }} o
 * @returns {{ docs: Map<string, string>, carried: number, failed: { doc: string, line: number, text: string, why: string }[] }}
 */
export function carryCites({ docs, oldText, newText, changed, codeFiles, renames = {} }) {
  const resolve = makeResolver(codeFiles);
  const readOld = reader(oldText);
  const texts = new Map(docs);
  const readNew = reader((f) => texts.get(f) ?? newText(f));
  const maps = new Map();
  const mapOf = (file) => maps.get(file) ?? maps.set(file, lineMap(oldText(file), newText(file), { renames })).get(file);
  const placed = [], failed = [];

  for (const [doc, text] of texts) {
    if (!text.includes(':"')) continue;
    const lines = text.split('\n');
    const codeOpen = /\.md$/.test(doc) ? codeOpenAt(text) : [];
    const docMasked = maskAnchors(text);
    let touched = false;
    lines.forEach((line, i) => {
      if (!line.includes(':"')) return;
      const edits = [];
      for (const m of line.matchAll(ANCHOR)) {
        const r = resolve(m[1]);
        if (!r.file || !changed.has(r.file)) continue;
        const fail = (why) => failed.push({ doc, line: i + 1, text: m[0], why });
        const before = readOld(r.file);
        const at = resolveAnchor(before.text, before.lines, m[2], m[3] ?? null);
        if (at.error) { fail(`the anchor did not resolve before the change (${at.error})`); continue; }
        const quoteAt = m[3] == null ? before.text.indexOf(m[2]) : null;   // a quote names its part of the line
        const newLines = mapOf(r.file)(at.line, quoteAt);
        if (!newLines.length) { fail('no token of the cited line found its place in the new text'); continue; }
        const forbid = forbidAt(doc, line, m.index, codeOpen[i]);
        if (!forbid) { fail('the anchor stands in code, outside a comment - a person writes it'); continue; }
        const after = readNew(r.file), braces = bracesAt(doc);
        const bare = m[1].replace(/^\/+/, '');
        // the cited line may have become several (a crowded line split): any of them names the same code, so the
        // first that takes an anchor does
        let anchor = null, n = null;
        for (const candidate of newLines) {
          ({ n } = anchorLine(after.text, after.lines, candidate, null, forbid, braces));
          anchor = n == null ? null : anchorFor(bare, after.text, after.lines, n, forbid, r.file === doc ? null : docMasked, braces);
          if (anchor) break;
        }
        if (!anchor) { fail(`none of the lines it became (${r.file}:${newLines.join(',')}) holds anything quotable`); continue; }
        edits.push({ col: m.index, len: m[0].length, to: anchor, file: r.file, n, spelled: bare });
      }
      for (const e of edits.sort((x, y) => y.col - x.col)) {
        line = line.slice(0, e.col) + e.to + line.slice(e.col + e.len);
        placed.push({ doc, line: i + 1, ...e });
      }
      if (edits.length) { lines[i] = line; touched = true; }
    });
    if (touched) texts.set(doc, lines.join('\n'));
  }

  // a carried anchor's quote is counted outside every anchor, and the anchors just changed: settle, as
  // citeAnchor.mjs's convertAll does, until every carried anchor resolves to the line it was written for
  for (let round = 0; round < 10; round++) {
    let moved = 0;
    for (const p of placed) {
      const m = /^((?:[\w./-]*\/)?[\w.-]+\.m?js):"([^"\n]+)"(?:\.\."([^"\n]+)")?$/.exec(p.to);
      const { text, lines } = readNew(p.file);
      if (resolveAnchor(text, lines, m[2], m[3] ?? null).line === p.n) continue;
      const docLines = texts.get(p.doc).split('\n');
      const open = /\.md$/.test(p.doc) ? codeOpenAt(texts.get(p.doc))[p.line - 1] : false;
      const col = docLines[p.line - 1].indexOf(p.to);
      const forbid = col < 0 ? null : forbidAt(p.doc, docLines[p.line - 1], col, open);
      const next = forbid && anchorFor(p.spelled, text, lines, p.n, forbid, p.file === p.doc ? null : maskAnchors(texts.get(p.doc)), bracesAt(p.doc));
      if (!next) { failed.push({ doc: p.doc, line: p.line, text: p.to, why: 'the carried anchor could not be settled' }); p.n = -1; continue; }
      docLines[p.line - 1] = docLines[p.line - 1].slice(0, col) + next + docLines[p.line - 1].slice(col + p.to.length);
      texts.set(p.doc, docLines.join('\n'));
      p.to = next;
      moved++;
    }
    if (!moved) break;
  }
  return { docs: texts, carried: placed.filter((p) => p.n !== -1).length, failed };
}

/** A worker's heap, in MB: every record makes two whole-file strings and their tokens (world.js: 3 MB and ~750,000
 *  tokens a time), and a worker capped at this collects as it goes instead of growing toward a quarter of the machine. */
const WORKER_HEAP_MB = 1024;

/**
 * Carry many records across worker threads. Each job is `{ record, file }`; the result at each index is carryMutant's.
 * Records are dealt round-robin within each file, so a file with thousands of them is shared by every worker.
 */
async function carryMutantsInParallel(jobs, { transformUrl, oldTexts, newTexts, workers }) {
  const chunks = Array.from({ length: Math.max(1, Math.min(workers, jobs.length)) }, () => []);
  jobs.forEach((job, index) => chunks[index % chunks.length].push({ ...job, index }));
  const results = new Array(jobs.length);
  await Promise.all(chunks.map((chunk) => new Promise((resolveChunk, reject) => {
    const files = {};
    for (const { file } of chunk) files[file] ??= { old: oldTexts.get(file), new: newTexts.get(file) };
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { carryPinsWorker: true, transformUrl, files, jobs: chunk },
      resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB },
    });
    worker.once('message', (out) => { for (const { index, result } of out) results[index] = result; resolveChunk(); });
    worker.once('error', reject);
  })));
  return results;
}

if (!isMainThread && workerData?.carryPinsWorker) {
  const { transformUrl, files, jobs } = workerData;
  const { transform } = await import(transformUrl);
  parentPort.postMessage(jobs.map(({ record, file, index }) => ({
    index, result: carryMutant(record, files[file].old, (src) => transform(src, file), files[file].new),
  })));
}

async function main(args) {
  const transformAt = args.indexOf('--transform');
  if (transformAt < 0) {
    console.error('usage: node tools/carryPins.mjs --transform <module.mjs> [path ...] [--write]');
    return 2;
  }
  const transformUrl = pathToFileURL(resolvePath(args[transformAt + 1])).href;
  const { transform } = await import(transformUrl);
  const write = args.includes('--write');
  const jobsAt = args.indexOf('--jobs');
  const workers = jobsAt >= 0 ? Math.max(1, Number(args[jobsAt + 1]) | 0) : availableParallelism();
  const { docs: docPaths, code } = trackedSets();
  const named = args.filter((a, i) => /\.m?js$/.test(a) && i !== transformAt + 1 && i !== jobsAt + 1);
  const targets = named.length ? named : code;
  const read = (f) => readFileSync(join(ROOT, f), 'utf8');

  const oldTexts = new Map(), newTexts = new Map();
  for (const f of targets) {
    const old = read(f), next = transform(old, f);
    if (next !== old) { oldTexts.set(f, old); newTexts.set(f, next); }
  }
  console.log(`${newTexts.size} of ${targets.length} file(s) change under the transform`);

  let carriedRecords = 0;
  const recordFailures = [];
  const mutantDir = join(ROOT, 'tools/mutants');
  const lists = readdirSync(mutantDir).filter((f) => f.endsWith('.json')).sort()
    .map((list) => ({ list, records: JSON.parse(readFileSync(join(mutantDir, list), 'utf8')) }));
  const jobs = [];
  for (const { list, records } of lists) {
    records.forEach((record, k) => { if (oldTexts.has(record.file)) jobs.push({ list, k, record, file: record.file }); });
  }
  const results = await carryMutantsInParallel(jobs.map(({ record, file }) => ({ record, file })), { transformUrl, oldTexts, newTexts, workers });
  const changedLists = new Set();
  jobs.forEach(({ list, k, record }, i) => {
    if (results[i].error) { recordFailures.push(`${list}::${record.name}: ${results[i].error}`); return; }
    lists.find((l) => l.list === list).records[k] = results[i].record;
    changedLists.add(list);
    carriedRecords++;
  });
  const listTexts = new Map(lists.filter(({ list }) => changedLists.has(list))
    .map(({ list, records }) => [`tools/mutants/${list}`, JSON.stringify(records, null, 2) + '\n']));

  const docTexts = new Map(docPaths.map((d) => [d, newTexts.get(d) ?? read(d)]));
  const { docs, carried, failed } = carryCites({
    docs: docTexts, oldText: (f) => oldTexts.get(f) ?? read(f), newText: (f) => newTexts.get(f) ?? read(f),
    changed: new Set(newTexts.keys()), codeFiles: code,
  });

  for (const f of recordFailures) console.log(`  RECORD NOT CARRIED  ${f}`);
  for (const f of failed) console.log(`  CITE NOT CARRIED    ${f.doc}:${f.line}  ${f.text}  - ${f.why}`);
  console.log(`${carriedRecords} mutant record(s) carried, ${recordFailures.length} not; ${carried} cite(s) carried, ${failed.length} not`);
  if (write) {
    for (const [f, text] of newTexts) if (!docs.has(f)) writeFileSync(join(ROOT, f), text);
    for (const [d, text] of docs) if (text !== read(d)) writeFileSync(join(ROOT, d), text);
    for (const [list, text] of listTexts) writeFileSync(join(ROOT, list), text);
    console.log('written - now prove the files: node tools/sameProgram.mjs --against HEAD');
  }
  return recordFailures.length || failed.length ? 1 : 0;
}

if (isMainThread && isMain(import.meta.url)) process.exit(await main(process.argv.slice(2)));
