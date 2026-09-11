// AUDIT 65 integration: map cites across a MERGE of two mapped sides.
// citeShift.mjs takes ONE base; a merged tree carries lines at main's
// numbers and lines at ours. Each line is mapped from the side it came
// from (provenance: the line exists verbatim in that side's file), and
// the bare continuations the tool only reports (`:N`, /:N, /N, `, :N`)
// are moved with the same content check.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { hunksFromDiff, lineMap, citeSpellings } from '/home/user/daggerfall-js-source/tools/citeShift.mjs';
const ROOT = process.argv[2], MAIN = process.argv[3], MINE = process.argv[4], apply = process.argv.includes('--apply');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const bases = { main: MAIN, mine: MINE };
const targetsOf = {}, byBase = {};
for (const [k, base] of Object.entries(bases)) {
  targetsOf[k] = new Map(); byBase[k] = new Map();
  for (const t of git('diff', '--name-only', base, '--', 'src', 'bible', 'test', 'tools').split('\n').filter((f) => /\.(js|mjs|md)$/.test(f))) {
    const hunks = hunksFromDiff(git('diff', '-U0', base, '--', t)); if (!hunks.length) continue;
    let oldLines; try { oldLines = git('show', `${base}:${t}`).split('\n'); } catch { continue; }
    const newLines = readFileSync(join(ROOT, t), 'utf8').split('\n');
    targetsOf[k].set(t, { map: lineMap(hunks), oldLines, newLines, res: citeSpellings(t) });
    const b = basename(t); (byBase[k].get(b) ?? byBase[k].set(b, []).get(b)).push(t);
  }
}
const linesOf = (base, doc) => { try { return new Set(git('show', `${base}:${doc}`).split('\n')); } catch { return null; } };
const same1 = (x, y) => x != null && y != null && x.trim() === y.trim();
let moved = 0, held = 0, news = 0;
function mapLine(l, t, { map, oldLines, newLines, res }, doc, ln) {
  const verdict = (a, b) => {
    const ma = map(a), mb = b != null ? map(b) : null;
    if (ma === a && (b == null || mb === b)) return { status: 'same' };
    if (ma == null || (b != null && mb == null)) return { status: 'inside' };
    if (!same1(oldLines[a - 1], newLines[ma - 1]) || (b != null && !same1(oldLines[b - 1], newLines[mb - 1]))) return { status: 'mismatch', ma, mb };
    return { status: 'move', ma, mb };
  };
  const spans = [], edits = [];
  for (const re of res) for (const m of l.matchAll(re)) {
    const pre = m[0].slice(0, m[0].lastIndexOf(':')).replace('\\.', '.').replace(/^(\.\.?\/)+/, '');
    if (pre.includes('/') && !t.endsWith(pre)) continue;
    const a = +m[1], b = m[2] ? +m[2] : null, v = verdict(a, b);
    spans.push([m.index, m.index + m[0].length]);
    if (v.status === 'same') continue;
    if (v.status !== 'move') { held++; console.log(`  ${v.status.toUpperCase().padEnd(8)} ${doc}:${ln}  ${m[0]}${v.ma ? ' -> ' + v.ma + (b != null ? '-' + v.mb : '') : ''}  [${t}]`); continue; }
    const text = m[0].replace(/(\d+)(-(\d+))?(`?)$/, (s, x, d, y, tick) => `${v.ma}${y != null ? '-' + v.mb : ''}${tick}`);
    edits.push([m.index, m.index + m[0].length, text]); moved++;
    console.log(`  ${apply ? 'moved  ' : 'MOVE   '} ${doc}:${ln}  ${m[0]} -> ${text}`);
  }
  spans.sort((x, y) => x[0] - y[0]);
  // a continuation belongs to the cite just before it: the region ends at
  // the next cite of ANY file (not only this target's)
  const stops = [...l.matchAll(/(?<![\w/])(?:[\w./-]*\/)?[\w.-]+\\?\.(?:js|mjs|md|sh):\d+|(?:Port-Ledger row|Ledger rows?|ledger rows?) `?:\d+/g)].map((m) => m.index);
  for (let k = 0; k < spans.length; k++) {
    const from = spans[k][1], to = stops.find((x) => x >= from) ?? l.length;
    const rest = l.slice(from, to);
    for (const m of rest.matchAll(/(`:|\/:|\/|, :)(\d+)(?:-(\d+))?(?=[`'\s,;:)./-]|$)/g)) {
      const abs = from + m.index;
      if (/rows? $/i.test(l.slice(Math.max(0, abs - 6), abs))) continue;   // the Ledger-row forms the tool itself moves
      const a = +m[2], b = m[3] ? +m[3] : null, v = verdict(a, b);
      if (v.status === 'same') continue;
      if (v.status !== 'move') { held++; console.log(`  ${v.status.toUpperCase().padEnd(8)} ${doc}:${ln}  ${m[0]} (continuation)${v.ma ? ' -> ' + v.ma : ''}  [${t}]`); continue; }
      const text = `${m[1]}${v.ma}${b != null ? '-' + v.mb : ''}`;
      edits.push([abs, abs + m[0].length, text]); moved++;
      console.log(`  ${apply ? 'moved  ' : 'MOVE   '} ${doc}:${ln}  ${m[0]} -> ${text} (continuation)`);
    }
  }
  let out = l;
  for (const [s, e, text] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, s) + text + out.slice(e);
  return out;
}
const docs = git('ls-files', 'bible', 'test', 'src', 'tools').split('\n').filter((f) => /\.(js|mjs|md|sh)$/.test(f));
for (const doc of docs) {
  const text = readFileSync(join(ROOT, doc), 'utf8'); const lines = text.split('\n');
  const mainSet = linesOf(MAIN, doc), mineSet = linesOf(MINE, doc);
  let changed = false;
  lines.forEach((l, i) => {
    if (!/:\d/.test(l)) return;
    const prov = mainSet?.has(l) ? 'main' : mineSet?.has(l) ? 'mine' : null;
    if (!prov) { if (/[\w-]\\?\.(?:js|mjs|md|sh):\d+|`:\d+/.test(l)) { news++; console.log(`  NEW      ${doc}:${i + 1}  (from neither side - read it)`); } return; }
    const names = new Set([...l.matchAll(/([\w.-]+?)(\\?)\.(js|mjs|md|sh):\d+/g)].map((m) => `${m[1]}.${m[3]}`));
    if (/Port-Ledger row|Ledger rows?|ledger rows?/.test(l)) names.add('Port-Ledger.md');
    let out = l;
    for (const name of names) for (const t of byBase[prov].get(name) ?? []) { if (t === doc) continue; out = mapLine(out, t, targetsOf[prov].get(t), doc, i + 1); }
    if (out !== l) { lines[i] = out; changed = true; }
  });
  if (changed && apply) writeFileSync(join(ROOT, doc), lines.join('\n'));
}
console.log(`${moved} cite(s) ${apply ? 'moved' : 'to move'}, ${held} for a person, ${news} line(s) from neither side`);
