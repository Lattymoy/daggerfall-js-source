// citeMerge - cites across a MERGE of two mapped sides (AUDIT 65 integration).
//
// citeShift.mjs takes ONE base: every cite in the tree is read as that
// base's number and moved to the tree's. A merge of two branches that each
// ran the mapper carries lines at THEIR numbers and lines at OURS in the
// same files, and no single base fits both - normalising both sides back
// to a common base and mapping once double-shifts whatever the pair
// tables miss (the /:N and `:N` continuations, a hand-resolved cite).
//
// So each line is mapped from the side it came from: a line that exists
// verbatim in their file is theirs (their numbers - map from their head),
// else in ours is ours, else it is new (reported, never touched). The
// map, the content check and the cite spellings are citeShift's own; the
// bare continuations citeShift only reports (`:N`, /:N, /N, `, :N` after a
// cite, up to the next cite of any file) are moved here with the same
// content check; the Ledger-row spellings are primaries here as there.
//
//   node tools/citeMerge.mjs origin/main <our-head>            # report
//   node tools/citeMerge.mjs origin/main <our-head> --apply    # rewrite
//
// Run it on the merged, conflict-free working tree BEFORE the merge
// commit, once; like citeShift, the sides are spent after --apply.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hunksFromDiff, lineMap, citeSpellings } from './citeShift.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- the pure half (pinned in test/citemerge.test.js) ---------------------

/** Which side a merged line came from: 'theirs' if their file carries it
 *  verbatim, else 'ours' if ours does, else null - a line the merge wrote. */
export function provenance(line, theirs, ours) {
  return theirs?.has(line) ? 'theirs' : ours?.has(line) ? 'ours' : null;
}

/** A cite of any file on a line - where the continuations after one cite
 *  stop belonging to it. */
const ANY_CITE = /(?<![\w/])(?:[\w./-]*\/)?[\w.-]+\\?\.(?:js|mjs|md|sh):\d+|(?:Port-Ledger row|Ledger rows?|ledger rows?) `?:\d+/g;
const CONTINUATION = /(`:|\/:|\/|, :)(\d+)(?:-(\d+))?(?=[`'\s,;:)./-]|$)/g;

/**
 * Move one line's cites into `t` (the primary spellings and the bare
 * continuations after them) by `map`, each under the content check.
 * @returns {{ out: string, moved: number, held: {status, text, to}[] }}
 */
export function mapLine(l, t, { map, oldLines, newLines, res = citeSpellings(t) }) {
  const same1 = (x, y) => x != null && y != null && x.trim() === y.trim();
  const verdict = (a, b) => {
    const ma = map(a), mb = b != null ? map(b) : null;
    if (ma === a && (b == null || mb === b)) return { status: 'same' };
    if (ma == null || (b != null && mb == null)) return { status: 'inside' };
    if (!same1(oldLines[a - 1], newLines[ma - 1]) || (b != null && !same1(oldLines[b - 1], newLines[mb - 1]))) return { status: 'mismatch', ma, mb };
    return { status: 'move', ma, mb };
  };
  const spans = [], edits = [], held = [];
  for (const re of res) for (const m of l.matchAll(re)) {
    // a path before the basename must be the target's own
    const pre = m[0].slice(0, m[0].lastIndexOf(':')).replace('\\.', '.').replace(/^(\.\.?\/)+/, '');
    if (pre.includes('/') && !t.endsWith(pre)) continue;
    const a = +m[1], b = m[2] ? +m[2] : null, v = verdict(a, b);
    spans.push([m.index, m.index + m[0].length]);
    if (v.status === 'same') continue;
    if (v.status !== 'move') { held.push({ status: v.status, text: m[0], to: v.ma ?? null }); continue; }
    edits.push([m.index, m.index + m[0].length, m[0].replace(/(\d+)(-(\d+))?(`?)$/, (s, x, d, y, tick) => `${v.ma}${y != null ? '-' + v.mb : ''}${tick}`)]);
  }
  // a continuation belongs to the cite just before it: the region ends at
  // the next cite of ANY file, not only this target's
  spans.sort((x, y) => x[0] - y[0]);
  const stops = [...l.matchAll(ANY_CITE)].map((m) => m.index);
  for (const [, from] of spans) {
    const to = stops.find((x) => x >= from) ?? l.length;
    for (const m of l.slice(from, to).matchAll(CONTINUATION)) {
      const abs = from + m.index;
      const a = +m[2], b = m[3] ? +m[3] : null, v = verdict(a, b);
      if (v.status === 'same') continue;
      if (v.status !== 'move') { held.push({ status: v.status, text: m[0], to: v.ma ?? null, continuation: true }); continue; }
      edits.push([abs, abs + m[0].length, `${m[1]}${v.ma}${b != null ? '-' + v.mb : ''}`]);
    }
  }
  let out = l;
  for (const [s, e, text] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, s) + text + out.slice(e);
  return { out, moved: edits.length, held };
}

// ---- the CLI --------------------------------------------------------------

function main(argv) {
  const [THEIRS, OURS] = argv.filter((a) => !a.startsWith('--')), apply = argv.includes('--apply');
  if (!THEIRS || !OURS) { console.error('usage: node tools/citeMerge.mjs <their-side> <our-side> [--apply]'); return 2; }
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
  const sides = { theirs: THEIRS, ours: OURS };
  const targetsOf = {}, byBase = {};
  for (const [k, base] of Object.entries(sides)) {
    targetsOf[k] = new Map(); byBase[k] = new Map();
    for (const t of git('diff', '--name-only', base, '--', 'src', 'bible', 'test', 'tools').split('\n').filter((f) => /\.(js|mjs|md)$/.test(f))) {
      const hunks = hunksFromDiff(git('diff', '-U0', base, '--', t)); if (!hunks.length) continue;
      let oldLines; try { oldLines = git('show', `${base}:${t}`).split('\n'); } catch { continue; }   // new on the other side: nothing cites it at this side's numbers
      targetsOf[k].set(t, { map: lineMap(hunks), oldLines, newLines: readFileSync(join(ROOT, t), 'utf8').split('\n'), res: citeSpellings(t) });
      const b = basename(t); (byBase[k].get(b) ?? byBase[k].set(b, []).get(b)).push(t);
    }
  }
  const linesOf = (base, doc) => { try { return new Set(git('show', `${base}:${doc}`).split('\n')); } catch { return null; } };
  let moved = 0, held = 0, news = 0;
  for (const doc of git('ls-files', 'bible', 'test', 'src', 'tools').split('\n').filter((f) => /\.(js|mjs|md|sh)$/.test(f))) {
    const lines = readFileSync(join(ROOT, doc), 'utf8').split('\n');
    const theirs = linesOf(THEIRS, doc), ours = linesOf(OURS, doc);
    let changed = false;
    lines.forEach((l, i) => {
      if (!/:\d/.test(l)) return;
      const prov = provenance(l, theirs, ours);
      if (!prov) { if (/[\w-]\\?\.(?:js|mjs|md|sh):\d+|`:\d+/.test(l)) { news++; console.log(`  NEW      ${doc}:${i + 1}  (from neither side - read it)`); } return; }
      const names = new Set([...l.matchAll(/([\w.-]+?)(\\?)\.(js|mjs|md|sh):\d+/g)].map((m) => `${m[1]}.${m[3]}`));
      if (/Port-Ledger row|Ledger rows?|ledger rows?/.test(l)) names.add('Port-Ledger.md');
      let out = l;
      for (const name of names) for (const t of byBase[prov].get(name) ?? []) {
        if (t === doc) continue;
        const r = mapLine(out, t, targetsOf[prov].get(t));
        for (const h of r.held) { held++; console.log(`  ${h.status.toUpperCase().padEnd(8)} ${doc}:${i + 1}  ${h.text}${h.continuation ? ' (continuation)' : ''}${h.to ? ' -> ' + h.to : ''}  [${t}]`); }
        if (r.out !== out) { moved += r.moved; console.log(`  ${apply ? 'moved  ' : 'MOVE   '} ${doc}:${i + 1}  ${out.trim().slice(0, 100)}\n        -> ${r.out.trim().slice(0, 100)}`); out = r.out; }
      }
      if (out !== l) { lines[i] = out; changed = true; }
    });
    if (changed && apply) writeFileSync(join(ROOT, doc), lines.join('\n'));
  }
  console.log(`${moved} cite(s) ${apply ? 'moved' : 'to move'}, ${held} for a person, ${news} line(s) from neither side`);
  return moved && !apply ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
