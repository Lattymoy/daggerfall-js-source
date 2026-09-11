// AUDIT 65 round-two integration: cites across a UNION of N mapped sides
// (six lanes on one stub, plus the integration commits that wrote lines of
// their own). Each line is mapped from every side that carries it verbatim
// (lanes and the stub first; an integration commit only for a line no lane
// wrote), with citeMerge's content check; the sides must agree.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { hunksFromDiff, lineMap, citeSpellings } from '/home/user/daggerfall-js-source/tools/citeShift.mjs';
import { mapLine } from '/home/user/daggerfall-js-source/tools/citeMerge.mjs';
const ROOT = process.cwd(), apply = process.argv.includes('--apply');
const LANES = process.argv.find((a) => a.startsWith('--lanes=')).slice(8).split(',');
const INTEG = (process.argv.find((a) => a.startsWith('--integ=')) ?? '--integ=').slice(8).split(',').filter(Boolean);
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
const sides = [...LANES, ...INTEG];
const targetsOf = {}, byBase = {};
for (const side of sides) {
  targetsOf[side] = new Map(); byBase[side] = new Map();
  for (const t of git('diff', '--name-only', side, '--', 'src', 'bible', 'test', 'tools').split('\n').filter((f) => /\.(js|mjs|md)$/.test(f))) {
    const hunks = hunksFromDiff(git('diff', '-U0', side, '--', t)); if (!hunks.length) continue;
    let oldLines; try { oldLines = git('show', `${side}:${t}`).split('\n'); } catch { continue; }
    targetsOf[side].set(t, { map: lineMap(hunks), oldLines, newLines: readFileSync(join(ROOT, t), 'utf8').split('\n'), res: citeSpellings(t) });
    const b = basename(t); (byBase[side].get(b) ?? byBase[side].set(b, []).get(b)).push(t);
  }
}
const cache = new Map();
const linesOf = (side, doc) => { const k = side + ':' + doc; if (!cache.has(k)) { try { cache.set(k, new Set(git('show', k).split('\n'))); } catch { cache.set(k, null); } } return cache.get(k); };
let moved = 0, held = 0, news = 0, same = 0;
for (const doc of git('ls-files', 'bible', 'test', 'src', 'tools').split('\n').filter((f) => /\.(js|mjs|md|sh)$/.test(f))) {
  const lines = readFileSync(join(ROOT, doc), 'utf8').split('\n'); let changed = false;
  lines.forEach((l, i) => {
    if (!/:\d/.test(l)) return;
    const names = new Set([...l.matchAll(/([\w.-]+?)(\\?)\.(js|mjs|md|sh):\d+/g)].map((m) => `${m[1]}.${m[3]}`));
    if (/Port-Ledger row|Ledger rows?|ledger rows?/.test(l)) names.add('Port-Ledger.md');
    if (!names.size) return;
    // The side a line was CORRECT in: the stub for a pre-existing line
    // (a lane that shifted a target without touching the line leaves it
    // stale in its own tree - the map from there is content-preserving
    // and still wrong); the lanes for a line a lane wrote; the earliest
    // integration commit for a line written at integration.
    const STUB = LANES[LANES.length - 1];
    let cands = linesOf(STUB, doc)?.has(l) ? [STUB] : LANES.slice(0, -1).filter((s) => linesOf(s, doc)?.has(l));
    if (!cands.length) cands = INTEG.filter((s) => linesOf(s, doc)?.has(l)).slice(0, 1);
    if (!cands.length) { news++; console.log(`  NEW      ${doc}:${i + 1}  (no side carries this line - read it)  ${l.trim().slice(0, 90)}`); return; }
    let out = l;
    for (const name of names) {
      const targets = new Set(cands.flatMap((s) => byBase[s].get(name) ?? []));
      for (const t of targets) {
        if (t === doc) continue;
        const votes = new Map();   // out -> [sides]
        const holds = [];
        for (const s of cands) {
          const info = targetsOf[s].get(t);
          if (!info) { (votes.get(out) ?? votes.set(out, []).get(out)).push(s + ' (unchanged there)'); continue; }
          const r = mapLine(out, t, info);
          if (r.held.length) holds.push(`${s}: ${r.held.map((h) => h.status + ' ' + h.text).join(', ')}`);
          else (votes.get(r.out) ?? votes.set(r.out, []).get(r.out)).push(s);
        }
        const moves = [...votes.keys()].filter((o) => o !== out);
        if (moves.length === 1) { moved++; console.log(`  ${apply ? 'moved  ' : 'MOVE   '} ${doc}:${i + 1}  [${t}] ${out.trim().slice(0, 80)}\n        -> ${moves[0].trim().slice(0, 80)}  (${votes.get(moves[0]).join(', ')})`); out = moves[0]; }
        else if (moves.length > 1) { held++; console.log(`  SPLIT    ${doc}:${i + 1}  [${t}] ${[...votes].map(([o, ss]) => `${ss.join('+')} -> ${o.trim().slice(0, 60)}`).join(' | ')}`); }
        else if (votes.size) { same++; }
        else { held++; console.log(`  HELD     ${doc}:${i + 1}  [${t}] ${holds.join(' | ')}`); }
      }
    }
    if (out !== l) { lines[i] = out; changed = true; }
  });
  if (changed && apply) writeFileSync(join(ROOT, doc), lines.join('\n'));
}
console.log(`${moved} cite(s) ${apply ? 'moved' : 'to move'}, ${same} same, ${held} for a person, ${news} line(s) no side carries`);
