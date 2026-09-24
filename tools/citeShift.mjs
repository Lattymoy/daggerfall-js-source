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
// (test/citedrift.test.js's law): `src/scenes/world.js:1269`, the
// basename form `world.js:1269`, a range `:1234-1240`, the tests' own
// regex spelling `world\.js:1269`, and - THE LEDGER ARM - the four
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
// RF3 (2026-09-14, Mac's refactor pass, the third): THE THREE CASES A
// PERSON RE-AIMED BY HAND AT EVERY MERGE OF THE LOOT-RARITY SLICE, now
// the tool's:
//   - BARE CONTINUATIONS ARE MOVED. "`world.js:4371/:4384`",
//     "`dungeonContext.js:5339/:5345`", "(cityGuards.js:757) ... (:939)",
//     "`world.js:1898`, `:1667`" - a `:N`, `/:N`, `/N`, `, :N` or `(:N`
//     after a cite into the target, up to the next cite of ANY file
//     (a `.cs:N` included), belongs to that cite (CITE-SLASH: a bare
//     `/N` only where it touches the cite or the continuation before it;
//     CITE-CS: a C# member or a table cell's edge ends the region too -
//     see continuationsIn and regionStops). citeMerge moved them
//     under the content check since CS2; citeShift only reported them,
//     and every slice paid for the difference. One law now, exported
//     from here (ANY_CITE, CONTINUATION) and imported there.
//   - A TEST'S ESCAPED LITERAL FOLLOWS THE ROW IT PINS. `world\\.js:3808`
//     inside test/citedrift.test.js is a quote of a Ledger row's text.
//     When that row is STRUCK the row's number is held (below) - and
//     the literal used to move anyway, so the pin and its row parted
//     at every shift. The escaped spelling is held whenever the target
//     number appears in the docs ONLY on struck lines (holdEscaped).
//   - THE TOOL'S OWN FIXTURES ARE NOT DOCS. This file's header and the
//     two pin files carry example cites (`world.js:1861`) that are
//     synthetic; they were rewritten on every run and restored by hand.
//     SELF_DOCS are skipped.
//
// WHAT IT STILL CANNOT DO, said plainly:
//   - A CONTINUATION ON THE NEXT LINE. A wrapped docstring that names the
//     file in prose ("dungeonContext's `overlayHover`") and puts "(:5623)"
//     on the line below carries no cite on that line to belong to; the
//     gated pin (citedrift CD8) is the catch, and a person re-aims it.
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
//   node tools/citeShift.mjs --apply --struck   # ...and on struck lines too (and the test literals that quote them)
//   node tools/citeShift.mjs --base <ref>       # map from another base (default HEAD)
//   node tools/citeShift.mjs --target <path>    # one target only (repeatable)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = 'bible/01-Overview/Port-Ledger.md';
/** RF3: the cite tools and their pin files carry SYNTHETIC cites - never docs. */
export const SELF_DOCS = Object.freeze(['tools/citeShift.mjs', 'tools/citeMerge.mjs', 'test/citeshift.test.js', 'test/citemerge.test.js']);

/** A cite of any file on a line - where the continuations after one cite
 *  stop belonging to it. A C# cite stops them too (RF3: the `.cs` arm),
 *  so "(:N)" after `SerializablePlayer.cs:421` is the C#'s, not ours.
 *  AUDIT 68: a test's escaped path (`systems\/spellcast\.js:158`) is one too. */
export const ANY_CITE = /(?<![\w/])(?:[\w./-]*\/)?(?:[\w.-]+\\\/)*[\w.-]+\\?\.(?:js|mjs|md|sh|cs):\d+|(?:Port-Ledger row|Ledger rows?|ledger rows?) `?:\d+/g;
/** The bare continuations after a cite: `:N, /:N, / :N, /N, `, :N` and (RF3) `(:N`.
 *  RF4 (2026-09-21): the SPACED slash. "world.js:6548 / :6549 / :6728" is the
 *  same continuation with the separator set off by spaces - the MAC-D shift
 *  moved the head and left the tail, and CD7 caught the backwards range that
 *  made. A space is allowed only BEFORE a colon (`/ *:`); a bare `/N` still
 *  has to sit against the slash, so "6 / 10" in prose is not a cite.
 *  RF5 (2026-09-21): the PROSE CONNECTOR. "worldModes.js:6213 against
 *  :6210" is a cite and its tail joined by a word, and the DAEDRA1 shift
 *  moved the head and left the tail - CD7 caught the backwards range, the
 *  same way it caught RF4's. Connectors are added BY NAME as they turn up
 *  rather than by a general "a word, then :N" rule, which would swallow
 *  ordinary prose; `against` is the one this repo writes. */
export const CONTINUATION = /(`:|\/ *:|\/|, *:|\(:|against +:)(\d+)(?:-(\d+))?(?=[`'\s,;:)./-]|$)/g;

/** Where a cite's continuations stop on line `l`, in order. RF3 stops them
 *  at the next cite of any file, a `.cs:N` included. CITE-CS (2026-09-23,
 *  the same merge) adds two stops for C# lines that name no `.cs` file:
 *  - a C# member, PascalCase.PascalCase, just before its `(:N`, as in
 *    "DaggerfallRestWindow.CanRest (:762-831)";
 *  - in a table row, each cell's edge. The Ledger's DFU column is a cell
 *    of its own ("| TalkManager reaction seed (:744-748) |").
 *  Without them, a JS cite earlier in the row took all of those for its own
 *  lines, and 42 of the Ledger's DFU ranges moved at every shift
 *  (TalkManager.GetReactionToPlayer_0_1_2 went from :689 to :874). Both
 *  rules were run against the whole tree before they were written, and
 *  everything they exclude is C#. */
export const CS_MEMBER = /(?<![\w.])[A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9_]*(?=`?\s*\(:)/g;
export function regionStops(l) {
  const stops = [...l.matchAll(ANY_CITE)].map((m) => m.index);
  for (const m of l.matchAll(CS_MEMBER)) stops.push(m.index);
  if (/^\s*\|/.test(l)) for (const m of l.matchAll(/(?<!\\)\|/g)) stops.push(m.index);   // a table row: an unescaped pipe is a cell's edge
  return stops.sort((a, b) => a - b);
}

/** The continuations of the cite that ends at `from`, in `l` up to `to`.
 *  CITE-SLASH (2026-09-23, the community arc's sixth merge): A BARE SLASH
 *  CONTINUES ONLY THE CHAIN IT TOUCHES. "`world.js:6548/6549`" is a cite
 *  and its tail. In a Ledger row reading "(`world.js:3714`) ... Work bands
 *  to 8076/8077", the second is a message id a sentence later, and the
 *  bare `/N` arm took "/8077" for world.js:8077. It moved at every shift:
 *  8076/11995, then 8076/12009 on main, and 8076/12322 here. The colon
 *  forms say what they are wherever they stand. A bare `/N` has no colon,
 *  so it is a continuation only where it abuts the cite, or the
 *  continuation before it. One law for both tools, as RF3's regexes are. */
export function* continuationsIn(l, from, to) {
  let end = from;   // where the chain so far stops
  for (const m of l.slice(from, to).matchAll(CONTINUATION)) {
    const at = from + m.index;
    if (m[1] === '/' && at !== end) continue;   // a slash after a number of the prose's own
    end = at + m[0].length;
    yield { m, at };
  }
}

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

/** The path a cite spells before its `:N`, unescaped (`systems\/spellcast\.js`
 *  is systems/spellcast.js) - or null when it names no directory. */
function citedPath(text) {
  const p = text.slice(0, text.lastIndexOf(':')).replace(/\\([./])/g, '$1').replace(/^(\.\.?\/)+/, '');
  return p.includes('/') ? p : null;
}

/** The spellings a cite INTO `target` can take, as regexes with the
 *  number in group 1 and an optional range end in group 2. */
export function citeSpellings(target) {
  const base = basename(target);
  const [stem, ext] = base.includes('.') ? [base.slice(0, base.lastIndexOf('.')), base.slice(base.lastIndexOf('.'))] : [base, ''];
  const res = [
    // the path or the basename, then :N or :N-M (the path form first so the basename form does not eat it)
    new RegExp(`(?<![\\w/])(?:[\\w./-]*/)?${esc(base)}:(\\d+)(?:-(\\d+))?`, 'g'),
    // the tests' regex spelling: world\.js:N. AUDIT 68 X5-citeshift-escaped-regex-pins-never-move: a
    // bare `/` before it can only be the regex's own delimiter, and a directory is escaped (`systems\/`)
    new RegExp(`(?<![\\w\\\\])(?:[\\w.-]+\\\\/)*${esc(stem)}\\\\${esc(ext)}:(\\d+)(?:-(\\d+))?`, 'g'),
  ];
  if (target === LEDGER) {
    res.push(/Port-Ledger row :(\d+)()/g);
    res.push(/(?:Port-Ledger row|Ledger rows?|ledger rows?) `:(\d+)(?:-(\d+))?`/g);
  }
  return res;
}

/**
 * Plan the moves for one target over one doc's text: the primary
 * spellings, and (RF3) the bare continuations after each primary up to
 * the next cite of any file, each under the same content check.
 * @param holdEscaped  (RF3) target numbers whose escaped test literal
 *   must stay - the docs carry them on struck lines only (see the CLI).
 * @param ambiguousBare  (AUDIT 68) another target of this run has the same
 *   basename, so a cite that names no directory is not known to be this
 *   target's: it is held as 'ambiguous' rather than moved once per target.
 * @returns [{line, col, text, from:[a,b|null], to:[a',b'|null], status, spelling, kind}]
 *   status: 'move' | 'struck' | 'inside' | 'mismatch' | 'same' | 'pinned-struck' | 'ambiguous'
 *   spelling: 'path' | 'escaped' | 'ledger'; kind: 'cite' | 'cont'
 */
export function planDoc({ docText, target, oldLines, newLines, map, moveStruck = false, holdEscaped = null, ambiguousBare = false }) {
  const plan = [];
  const lines = docText.split('\n');
  const same1 = (x, y) => x != null && y != null && x.trim() === y.trim();
  const verdict = (l, a, b, spelling) => {
    const ma = map(a), mb = b != null ? map(b) : null;
    if (ma === a && (b == null || mb === b)) return { status: 'same', ma, mb };
    if (ma == null || (b != null && mb == null)) return { status: 'inside', ma, mb };
    // the same text on both sides, and a line that EXISTS on both -
    // a cite past the end of a file is a mismatch, not two empties
    const ok = same1(oldLines[a - 1], newLines[ma - 1]) && (b == null || same1(oldLines[b - 1], newLines[mb - 1]));
    if (!ok) return { status: 'mismatch', ma, mb };
    if (/~~/.test(l) && !moveStruck) return { status: 'struck', ma, mb };
    if (spelling === 'escaped' && holdEscaped?.has(a)) return { status: 'pinned-struck', ma, mb };
    return { status: 'move', ma, mb };
  };
  const spellings = citeSpellings(target).map((re, i) => [re, i === 0 ? 'path' : i === 1 ? 'escaped' : 'ledger']);
  const ambiguous = (v) => (v.status === 'move' ? { ...v, status: 'ambiguous' } : v);
  lines.forEach((l, i) => {
    const spans = [];
    for (const [re, spelling] of spellings) {
      for (const m of l.matchAll(re)) {
        // AUDIT 68 X5-citeshift-foreign-path-and-ambiguous-basename: a
        // directory written before the basename names ONE file - `ui/chargen.js`
        // is not a cite into src/systems/chargen.js, and the content check
        // cannot tell (a pure shift passes it whatever file the cite names).
        const dir = spelling !== 'ledger' && citedPath(m[0]);
        if (dir && dir !== target && !target.endsWith('/' + dir) && !dir.endsWith('/' + target)) continue;
        const a = +m[1], b = m[2] ? +m[2] : null;
        const bare = ambiguousBare && spelling !== 'ledger' && !dir;
        const v = bare ? ambiguous(verdict(l, a, b, spelling)) : verdict(l, a, b, spelling);
        plan.push({ line: i + 1, col: m.index, text: m[0], from: [a, b], to: [v.ma, v.mb], status: v.status, spelling, kind: 'cite' });
        spans.push([m.index + m[0].length, bare]);
      }
    }
    if (!spans.length) return;
    // RF3: a continuation belongs to the cite just before it, up to the next cite of ANY file (CITE-CS: or C# member, or cell edge)
    const stops = regionStops(l);
    for (const [from, bare] of spans.sort((x, y) => x[0] - y[0])) {
      const to = stops.find((x) => x >= from) ?? l.length;
      for (const { m, at } of continuationsIn(l, from, to)) {
        const a = +m[2], b = m[3] ? +m[3] : null;
        const v = bare ? ambiguous(verdict(l, a, b, 'path')) : verdict(l, a, b, 'path');
        plan.push({ line: i + 1, col: at, text: m[0], from: [a, b], to: [v.ma, v.mb], status: v.status, spelling: 'path', kind: 'cont' });
      }
    }
  });
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

/** The bare continuations a plan found (RF3: they are plan entries of
 *  kind 'cont' now, moved under the content check like any cite; this
 *  is the view of them the old report printed). */
export function continuations(docText, target, map, extra = {}) {
  const oldLines = extra.oldLines ?? [], newLines = extra.newLines ?? [];
  return planDoc({ docText, target, oldLines, newLines, map, ...extra })
    .filter((p) => p.kind === 'cont' && p.status !== 'same')
    .map((p) => ({ line: p.line, text: p.text, from: p.from[0], to: p.to[0], status: p.status }));
}

// ---- the CLI --------------------------------------------------------------

function main(argv) {
  const opt = (k) => argv.includes(k);
  const val = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
  const base = val('--base') ?? 'HEAD';
  const apply = opt('--apply'), moveStruck = opt('--struck');
  const only = argv.flatMap((a, i) => (a === '--target' ? [argv[i + 1]] : []));
  // AUDIT 68 X5: git's default 1 MiB maxBuffer threw ENOBUFS on `git show` of a
  // target past 1 MiB (world.js crossed it), and the new-file catch below swallowed
  // it - every cite into the tree's largest file was silently never moved.
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  const changed = git('diff', '--name-only', base, '--', 'src', 'bible', 'test', 'tools').split('\n').filter(Boolean);
  const targets = (only.length ? only : changed).filter((f) => /\.(js|mjs|md)$/.test(f));
  const docs = git('ls-files', 'bible', 'test', 'src', 'tools').split('\n').filter((f) => /\.(js|mjs|md|sh)$/.test(f) && !SELF_DOCS.includes(f));   // RF3: the tools' own fixtures are not docs
  let moved = 0, applied = 0, held = 0;
  // AUDIT 68: two targets with one basename (src/systems/loot.js and
  // survival/loot.js) - a bare `loot.js:N` is neither's to move, where it was
  // moved once by each, the second time off the first one's rewrite.
  const sharedBase = new Set(targets.map((t) => basename(t)).filter((b, i, all) => all.indexOf(b) !== i));
  for (const target of targets) {
    const ambiguousBare = sharedBase.has(basename(target));
    const hunks = hunksFromDiff(git('diff', '-U0', base, '--', target));
    if (!hunks.length) continue;
    const map = lineMap(hunks);
    let oldLines; try { oldLines = git('show', `${base}:${target}`).split('\n'); } catch { continue; }   // a new file cites nothing yet
    if (!existsSync(join(ROOT, target))) continue;   // MAC5 (the water revert): a target the change DELETED has no lines to land on; its cites are the record's to strike
    const newLines = readFileSync(join(ROOT, target), 'utf8').split('\n');
    // RF3, pass one: plan every doc, and learn which numbers the docs
    // carry on STRUCK lines only - a test's escaped literal of one of
    // those is a quote of the struck row and must stay with it.
    const plans = new Map();
    const struckNums = new Set(), movedNums = new Set();
    for (const doc of docs) {
      if (doc === target) continue;
      const text = readFileSync(join(ROOT, doc), 'utf8');
      const plan = planDoc({ docText: text, target, oldLines, newLines, map, moveStruck, ambiguousBare });
      plans.set(doc, { text, plan });
      for (const p of plan) {
        if (p.spelling === 'escaped') continue;
        if (p.status === 'struck') struckNums.add(p.from[0]);
        else if (p.status === 'move') movedNums.add(p.from[0]);
      }
    }
    const holdEscaped = new Set([...struckNums].filter((n) => !movedNums.has(n)));
    for (const [doc, { text }] of plans) {
      const plan = planDoc({ docText: text, target, oldLines, newLines, map, moveStruck, holdEscaped, ambiguousBare }).filter((p) => p.status !== 'same');
      if (!plan.length) continue;
      for (const p of plan) {
        const arrow = `${p.text} -> ${p.to[0]}${p.from[1] != null ? '-' + p.to[1] : ''}${p.kind === 'cont' ? ' (a continuation)' : ''}`;
        if (p.status === 'move') { moved++; console.log(`  ${apply ? 'moved  ' : 'MOVE   '} ${doc}:${p.line}  ${arrow}`); }
        else { held++; console.log(`  ${p.status.toUpperCase().padEnd(8)} ${doc}:${p.line}  ${p.status === 'inside' ? p.text + ' (inside an edited hunk)' : arrow}`); }
      }
      if (apply) { const out = applyPlan(text, plan); if (out !== text) { writeFileSync(join(ROOT, doc), out); applied += plan.filter((p) => p.status === 'move').length; } }
    }
  }
  console.log(`${targets.length} target(s) against ${base}: ${moved} cite(s) ${apply ? 'moved' : 'to move'}, ${held} for a person`);
  if (apply) console.log(`applied ${applied}; this base is spent - commit before running again`);
  return moved && !apply ? 1 : 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
