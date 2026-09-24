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
//   node tools/citeMerge.mjs origin/main <our-head> --apply --struck   # ...struck lines too (citeShift's --struck; the gated cites CD4/CD5 sometimes need it)
//
// Run it on the merged, conflict-free working tree BEFORE the merge
// commit, once; like citeShift, the sides are spent after --apply.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hunksFromDiff, lineMap, planDoc, applyPlan, SELF_DOCS } from './citeShift.mjs';   // AUDIT 68: one law - the plan (spellings, continuations, struck, the path a cite names) is citeShift's, and the tools' own fixtures skipped
import { isMain } from './lib/isMain.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- the pure half (pinned in test/citemerge.test.js) ---------------------

/** Which side a merged line came from: 'theirs' if their file carries it
 *  verbatim, else 'ours' if ours does, else null - a line the merge wrote. */
export function provenance(line, theirs, ours) {
  return theirs?.has(line) ? 'theirs' : ours?.has(line) ? 'ours' : null;
}


/**
 * Move one line's cites into `t` (the primary spellings and the bare
 * continuations after them) by `map`, each under the content check.
 *
 * THE STRUCK LAW, which this tool was missing (2026-09-15). citeShift has
 * carried it since RF3 and citeMerge - written later, for the AUDIT 65
 * integration - never took it over: the same rule in one tool and not its
 * sibling, which is this codebase's own measured failure mode wearing a
 * different hat. Two things follow from it:
 *
 *   - A STRUCK line (`~~...~~`) holds its cites. Its subject was fixed or
 *     deleted, so its numbers are a record of where the thing USED to be,
 *     and moving them makes the record say something that was never true.
 *   - An ESCAPED test literal (`world\.js:N`) whose number the docs carry
 *     ONLY on struck lines holds too, because the literal exists to MATCH
 *     that struck row and the two must stay in step. That is `holdEscaped`,
 *     and it is what bit twice in one hour: `world.js:4117-4120` names a
 *     seam FX1 deleted, citedrift.test.js quotes it in NO_LINE_LEFT, and
 *     each merge moved the quote away from the row it has to match.
 *
 * AUDIT 68 X5-citemerge-struck-continuations-move: this was a second copy
 * of citeShift's plan, and the copies had parted - the struck law held a
 * struck line's head and moved its `/:N` tail, and every cite on a struck
 * line was reported for a person even when it would not move. It is
 * citeShift's planDoc and applyPlan now, seen through this tool's shape.
 *
 * @param moveStruck   move them anyway (citeShift's --struck)
 * @param holdEscaped  numbers whose escaped literal must stay (see main)
 * @param ambiguousBare  another target this side changed has the same basename
 * @returns {{ out: string, moved: number, held: {status, text, to}[],
 *   seen: {a: number, status: string, escaped: boolean}[] }}
 */
export function mapLine(l, t, { map, oldLines, newLines, moveStruck = false, holdEscaped = null, ambiguousBare = false }) {
  const plan = planDoc({ docText: l, target: t, oldLines, newLines, map, moveStruck, holdEscaped, ambiguousBare });
  return {
    out: applyPlan(l, plan),
    moved: plan.filter((p) => p.status === 'move').length,
    held: plan.filter((p) => p.status !== 'same' && p.status !== 'move')
      .map((p) => ({ status: p.status, text: p.text, to: p.to[0] ?? null, ...(p.kind === 'cont' ? { continuation: true } : {}) })),
    seen: plan.filter((p) => p.kind === 'cite').map((p) => ({ a: p.from[0], status: p.status, escaped: p.spelling === 'escaped' })),
  };
}

// ---- the CLI --------------------------------------------------------------

function main(argv) {
  const [THEIRS, OURS] = argv.filter((a) => !a.startsWith('--')), apply = argv.includes('--apply'), moveStruck = argv.includes('--struck');   // SURV merge 2026-09-18: the sibling's --struck, so a merge needs no second tool for the gated struck cites
  if (!THEIRS || !OURS) { console.error('usage: node tools/citeMerge.mjs <their-side> <our-side> [--apply]'); return 2; }
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
  const sides = { theirs: THEIRS, ours: OURS };
  const targetsOf = {}, byBase = {};
  for (const [k, base] of Object.entries(sides)) {
    targetsOf[k] = new Map(); byBase[k] = new Map();
    for (const t of git('diff', '--name-only', base, '--', 'src', 'bible', 'test', 'tools').split('\n').filter((f) => /\.(js|mjs|md)$/.test(f))) {
      const hunks = hunksFromDiff(git('diff', '-U0', base, '--', t)); if (!hunks.length) continue;
      let oldLines; try { oldLines = git('show', `${base}:${t}`).split('\n'); } catch { continue; }   // new on the other side: nothing cites it at this side's numbers
      if (!existsSync(join(ROOT, t))) continue;   // deleted by the other side (WATER4's merge of #96): no lines to land on, and its cites are the deleter's to strike
      targetsOf[k].set(t, { map: lineMap(hunks), oldLines, newLines: readFileSync(join(ROOT, t), 'utf8').split('\n') });
      const b = basename(t); (byBase[k].get(b) ?? byBase[k].set(b, []).get(b)).push(t);
    }
  }
  const linesOf = (base, doc) => { try { return new Set(git('show', `${base}:${doc}`).split('\n')); } catch { return null; } };
  const docs = git('ls-files', 'bible', 'test', 'src', 'tools').split('\n').filter((f) => /\.(js|mjs|md|sh)$/.test(f) && !SELF_DOCS.includes(f));   // RF3
  const linesCache = new Map(), provCache = new Map();

  // PASS ONE (citeShift's, in this tool's shape): learn, per target, which
  // numbers the docs carry on STRUCK lines ONLY. A test's escaped literal
  // of one of those is a QUOTE of the struck row, not a reference to a
  // live line, and must stay with it. Nothing is written in this pass.
  const holdOf = new Map();
  {
    const struckNums = new Map(), movedNums = new Map();
    const add = (m, t, n) => (m.get(t) ?? m.set(t, new Set()).get(t)).add(n);
    for (const doc of docs) {
      const lines = readFileSync(join(ROOT, doc), 'utf8').split('\n');
      linesCache.set(doc, lines);
      const theirs = linesOf(THEIRS, doc), ours = linesOf(OURS, doc);
      provCache.set(doc, [theirs, ours]);
      for (const l of lines) {
        if (!/:\d/.test(l)) continue;
        const prov = provenance(l, theirs, ours);
        if (!prov) continue;
        for (const [t, cfg] of targetsOf[prov]) {
          if (t === doc) continue;
          for (const { a, status, escaped } of mapLine(l, t, { ...cfg, moveStruck, ambiguousBare: byBase[prov].get(basename(t)).length > 1 }).seen) {
            if (escaped) continue;
            if (status === 'struck') add(struckNums, t, a);
            else if (status === 'move') add(movedNums, t, a);
          }
        }
      }
    }
    for (const [t, nums] of struckNums) {
      holdOf.set(t, new Set([...nums].filter((n) => !(movedNums.get(t)?.has(n)))));
    }
  }

  let moved = 0, held = 0, news = 0;
  for (const doc of docs) {
    const lines = linesCache.get(doc);
    const [theirs, ours] = provCache.get(doc);
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
        const r = mapLine(out, t, { ...targetsOf[prov].get(t), moveStruck, holdEscaped: holdOf.get(t) ?? null, ambiguousBare: byBase[prov].get(name).length > 1 });
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

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
