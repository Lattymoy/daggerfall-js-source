#!/usr/bin/env node
// THE CITE SHIFT - re-resolve every line cite into a file whose lines
// moved. CS1 (2026-09-10), the tool AUDIT 64's last lesson asked for:
// "The cite mappers need a Ledger arm. Every audit since ROAD-E has
// hand-fixed `Port-Ledger.md:N` cites at integration; this one wrote the
// second mapper. Fold it into the first before AUDIT 65." Neither mapper
// had ever been committed - each lane re-derived one in scratch - and the
// three slices of 2026-09-10 re-derived it three more times (34, 111 and
// 32 cites). This is the one home.
//
// WHAT A CITE IS HERE. A line number is a claim like any other
// (test/citedrift.test.js's law): `src/scenes/world.js:1253`, the
// basename form `world.js:1253`, a range `:1234-1240`, the tests' own
// regex spelling `world\.js:1253`, and - THE LEDGER ARM - the four
// spellings a Port-Ledger row is cited by: `Port-Ledger.md:N`,
// `Port-Ledger row :N` (tools/parity), `Ledger row \`:N\`` and
// `Ledger rows \`:N\``. A cite is INTO a target file; a doc is any
// tracked text file that carries one.
//
// WHAT IT DOES. For every target changed against a base ref (HEAD by
// default), the unified diff's hunks give a map from the base's line
// numbers to the working tree's. Every cite into the target whose number
// moved is listed old -> new, and applied only when the base's line and
// the tree's mapped line carry the SAME text - a cite that would land
// on different text is a MISMATCH and is left for a person. A cite whose
// number falls INSIDE an edited hunk has no mechanical answer and is
// listed as such. A cite on a STRUCK line (`~~`) is kept by default -
// Port-Status's own convention keeps the measurement's number inside a
// struck row - and moved only under --struck, which the gated ones
// (citedrift CD4/CD5) sometimes need.
//
// WHAT IT CANNOT DO, said plainly:
//   - BARE CONTINUATIONS. "`world.js:1882`, `:1667`" - the second number
//     is a cite too, but so is the C# `:524-525` on the next line. They
//     are REPORTED with their mapped value and never applied; a person
//     reads the line.
//   - THE PORT-STATUS ROW IDENTIFIERS. Section 2's `**\`:601\`** the
//     classic .SAV reader` headers name Ledger rows by number alone.
//     Reported when the Ledger is a target; citedrift's CD3 resolves
//     them by content and is the gate.
//   - RUN ONCE PER BASE. The map is from the BASE's numbers, and a pure
//     shift makes "base line N == tree line N+1" true whether the cite
//     still says N or was already moved to N+1 - so a second --apply
//     against the same base moves every cite again. Apply, commit, and
//     the next run's base is the new HEAD. The MAC1 integration learned
//     this the expensive way.
//
// Usage:
//   node tools/citeShift.mjs                    # list what moved (exit 1 if anything did)
//   node tools/citeShift.mjs --apply            # rewrite the verified moves on unstruck lines
//   node tools/citeShift.mjs --apply --struck   # ...and on struck lines too
//   node tools/citeShift.mjs --base <ref>       # map from another base (default HEAD)
//   node tools/citeShift.mjs --target <path>    # one target only (repeatable)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = 'bible/01-Overview/Port-Ledger.md';

// ---- the pure half (pinned in test/citeshift.test.js) ---------------------

/** Parse a unified diff's hunk headers into {oldStart, oldLen, newStart, newLen}. */
export function hunksFromDiff(diffText) {
  return [...diffText.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)]
    .map((m) => ({ oldStart: +m[1], oldLen: m[2] == null ? 1 : +m[2], newStart: +m[3], newLen: m[4] == null ? 1 : +m[4] }));
}

/** A base line number -> the tree's, or null when the line sits inside an
 *  edited hunk (deleted or rewritten - no mechanical answer). A pure
 *  insertion (oldLen 0) sits AFTER oldStart and moves the lines below it. */
export function lineMap(hunks) {
  return (oldLine) => {
    let delta = 0;
    for (const h of hunks) {
      if (h.oldLen === 0) { if (oldLine > h.oldStart) delta += h.newLen; continue; }
      if (oldLine < h.oldStart) break;
      if (oldLine <= h.oldStart + h.oldLen - 1) return null;
      delta += h.newLen - h.oldLen;
    }
    return oldLine + delta;
  };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The spellings a cite INTO `target` can take, as regexes with the
 *  number in group 1 and an optional range end in group 2. */
export function citeSpellings(target) {
  const base = basename(target);
  const [stem, ext] = base.includes('.') ? [base.slice(0, base.lastIndexOf('.')), base.slice(base.lastIndexOf('.'))] : [base, ''];
  const res = [
    // the path or the basename, then :N or :N-M (the path form first so the basename form does not eat it)
    new RegExp(`(?<![\\w/])(?:[\\w./-]*/)?${esc(base)}:(\\d+)(?:-(\\d+))?`, 'g'),
    // the tests' regex spelling: world\.js:N
    new RegExp(`(?<![\\w/])${esc(stem)}\\\\${esc(ext)}:(\\d+)(?:-(\\d+))?`, 'g'),
  ];
  if (target === LEDGER) {
    res.push(/Port-Ledger row :(\d+)()/g);
    res.push(/(?:Port-Ledger row|Ledger rows?|ledger rows?) `:(\d+)(?:-(\d+))?`/g);
  }
  return res;
}

/**
 * Plan the moves for one target over one doc's text.
 * @returns [{line, col, text, from:[a,b|null], to:[a',b'|null], status}]
 *   status: 'move' | 'struck' | 'inside' | 'mismatch' | 'same'
 */
export function planDoc({ docText, target, oldLines, newLines, map, moveStruck = false }) {
  const plan = [];
  const lines = docText.split('\n');
  for (const re of citeSpellings(target)) {
    lines.forEach((l, i) => {
      for (const m of l.matchAll(re)) {
        const a = +m[1], b = m[2] ? +m[2] : null;
        const ma = map(a), mb = b != null ? map(b) : null;
        const same = ma === a && (b == null || mb === b);
        const rec = { line: i + 1, col: m.index, text: m[0], from: [a, b], to: [ma, mb] };
        if (same) { plan.push({ ...rec, status: 'same' }); continue; }
        if (ma == null || (b != null && mb == null)) { plan.push({ ...rec, status: 'inside' }); continue; }
        // the same text on both sides, and a line that EXISTS on both -
        // a cite past the end of a file is a mismatch, not two empties
        const same1 = (x, y) => x != null && y != null && x.trim() === y.trim();
        const ok = same1(oldLines[a - 1], newLines[ma - 1])
          && (b == null || same1(oldLines[b - 1], newLines[mb - 1]));
        if (!ok) { plan.push({ ...rec, status: 'mismatch' }); continue; }
        if (/~~/.test(l) && !moveStruck) { plan.push({ ...rec, status: 'struck' }); continue; }
        plan.push({ ...rec, status: 'move' });
      }
    });
  }
  return plan;
}

/** Rewrite the 'move' entries of a plan into the doc text. */
export function applyPlan(docText, plan) {
  const lines = docText.split('\n');
  // right-to-left within a line so earlier columns stay valid
  const byLine = new Map();
  for (const p of plan) if (p.status === 'move') (byLine.get(p.line) ?? byLine.set(p.line, []).get(p.line)).push(p);
  for (const [ln, ps] of byLine) {
    let l = lines[ln - 1];
    for (const p of ps.sort((x, y) => y.col - x.col)) {
      const replaced = p.text.replace(/(\d+)(-(\d+))?(`?)$/, (m, a, dash, b, tick) => `${p.to[0]}${b != null ? '-' + p.to[1] : ''}${tick}`);
      l = l.slice(0, p.col) + replaced + l.slice(p.col + p.text.length);
    }
    lines[ln - 1] = l;
  }
  return lines.join('\n');
}

/** The bare continuations on a line that carries a cite into `target`:
 *  the `` `:N` `` tokens after it, with their mapped values. Reported only. */
export function continuations(docText, target, map) {
  const out = [];
  const [pathRe] = citeSpellings(target);
  docText.split('\n').forEach((l, i) => {
    const first = [...l.matchAll(pathRe)][0];
    if (!first) return;
    const rest = l.slice(first.index + first[0].length);
    for (const m of rest.matchAll(/`:(\d+)(?:-(\d+))?`/g)) {
      const a = +m[1]; const ma = map(a);
      if (ma !== a) out.push({ line: i + 1, text: m[0], from: a, to: ma });
    }
  });
  return out;
}

// ---- the CLI --------------------------------------------------------------

function main(argv) {
  const opt = (k) => argv.includes(k);
  const val = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
  const base = val('--base') ?? 'HEAD';
  const apply = opt('--apply'), moveStruck = opt('--struck');
  const only = argv.flatMap((a, i) => (a === '--target' ? [argv[i + 1]] : []));
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  const changed = git('diff', '--name-only', base, '--', 'src', 'bible', 'test', 'tools').split('\n').filter(Boolean);
  const targets = (only.length ? only : changed).filter((f) => /\.(js|mjs|md)$/.test(f));
  const docs = git('ls-files', 'bible', 'test', 'src', 'tools').split('\n').filter((f) => /\.(js|mjs|md|sh)$/.test(f));
  let moved = 0, applied = 0, held = 0;
  for (const target of targets) {
    const hunks = hunksFromDiff(git('diff', '-U0', base, '--', target));
    if (!hunks.length) continue;
    const map = lineMap(hunks);
    let oldLines; try { oldLines = git('show', `${base}:${target}`).split('\n'); } catch { continue; }   // a new file cites nothing yet
    const newLines = readFileSync(join(ROOT, target), 'utf8').split('\n');
    for (const doc of docs) {
      if (doc === target) continue;
      const text = readFileSync(join(ROOT, doc), 'utf8');
      const plan = planDoc({ docText: text, target, oldLines, newLines, map, moveStruck }).filter((p) => p.status !== 'same');
      const cont = continuations(text, target, map);
      if (!plan.length && !cont.length) continue;
      for (const p of plan) {
        const arrow = `${p.text} -> ${p.to[0]}${p.from[1] != null ? '-' + p.to[1] : ''}`;
        if (p.status === 'move') { moved++; console.log(`  ${apply ? 'moved  ' : 'MOVE   '} ${doc}:${p.line}  ${arrow}`); }
        else { held++; console.log(`  ${p.status.toUpperCase().padEnd(8)} ${doc}:${p.line}  ${p.status === 'inside' ? p.text + ' (inside an edited hunk)' : arrow}`); }
      }
      for (const c of cont) { held++; console.log(`  CONTIN.  ${doc}:${c.line}  ${c.text} -> ${c.to ?? 'inside'} (a bare continuation - read the line)`); }
      if (apply) { const out = applyPlan(text, plan); if (out !== text) { writeFileSync(join(ROOT, doc), out); applied += plan.filter((p) => p.status === 'move').length; } }
    }
  }
  console.log(`${targets.length} target(s) against ${base}: ${moved} cite(s) ${apply ? 'moved' : 'to move'}, ${held} for a person`);
  if (apply) console.log(`applied ${applied}; this base is spent - commit before running again`);
  return moved && !apply ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
