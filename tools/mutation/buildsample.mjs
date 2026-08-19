// Build a random-sample confirmation spec from the automated survivors,
// restricted to mutants whose token occurs EXACTLY ONCE on its line so the
// mutant is uniquely reproducible from the log.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const D = path.join(ROOT, '.mutaudit');
const N = Number(process.argv[2] || 15);
let seed = 20260819;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const surv = [];
for (const f of fs.readdirSync(D).filter(x => /^r\d+\.jsonl$/.test(x))) {
  for (const l of fs.readFileSync(path.join(D, f), 'utf8').trim().split('\n')) {
    if (!l) continue;
    const r = JSON.parse(l);
    if (r.verdict === 'SURVIVED') surv.push(r);
  }
}
const cand = surv.filter(r => {
  try {
    const line = fs.readFileSync(path.join(ROOT, r.file), 'utf8').split('\n')[r.line - 1];
    if (!line) return false;
    let n = 0, i = -1;
    while ((i = line.indexOf(r.from, i + 1)) >= 0) n++;
    return n === 1;
  } catch { return false; }
});
const pick = [];
const pool = cand.slice();
for (let k = 0; k < Math.min(N, pool.length); k++) pick.push(...pool.splice(Math.floor(rnd() * pool.length), 1));
fs.writeFileSync(path.join(D, 'sample.json'), JSON.stringify(pick.map(r => ({
  file: r.file, line: r.line, from: r.from, to: r.to, note: 'random survivor sample (' + r.op + ')',
})), null, 1));
console.log('survivors', surv.length, 'uniquely-reproducible', cand.length, 'sampled', pick.length);
