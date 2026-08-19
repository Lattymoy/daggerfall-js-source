// Aggregate every round log into the audit numbers.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const D = path.join(ROOT, '.mutaudit');
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(D).filter(f => /^r\d+\.jsonl$/.test(f)).sort();

const rows = [];
for (const f of files) {
  for (const l of fs.readFileSync(path.join(D, f), 'utf8').trim().split('\n')) {
    if (l) rows.push({ ...JSON.parse(l), round: f });
  }
}
const run = rows.filter(r => r.verdict === 'SURVIVED' || r.verdict === 'CAUGHT' || r.verdict === 'TIMEOUT');
const surv = rows.filter(r => r.verdict === 'SURVIVED');
const dead = rows.filter(r => r.verdict === 'NO_TEST_EXECUTES_LINE');

console.log('== TOTALS ==');
console.log('mutants executed        :', run.length);
console.log('  caught                :', run.filter(r => r.verdict === 'CAUGHT').length);
console.log('  survived              :', surv.length);
console.log('  timeout               :', run.filter(r => r.verdict === 'TIMEOUT').length);
console.log('mutation score          :', ((100 * run.filter(r => r.verdict === 'CAUGHT').length) / run.length).toFixed(1) + '%');
console.log('sites on lines no test executes (not run):', dead.length);
console.log('distinct src files mutated:', new Set(run.map(r => r.file)).size);

console.log('\n== BY OPERATOR ==');
const ops = {};
for (const r of run) { const o = (ops[r.op] ||= { c: 0, s: 0 }); if (r.verdict === 'SURVIVED') o.s++; else o.c++; }
for (const [o, v] of Object.entries(ops).sort((a, b) => (b[1].c + b[1].s) - (a[1].c + a[1].s))) {
  console.log(`${o.padEnd(9)} run=${String(v.c + v.s).padStart(4)} caught=${String(v.c).padStart(4)} survived=${String(v.s).padStart(4)}  score=${((100 * v.c) / (v.c + v.s)).toFixed(0)}%`);
}

console.log('\n== BY DIRECTORY ==');
const dirs = {};
for (const r of run) { const d = r.file.split('/').slice(0, 2).join('/'); const o = (dirs[d] ||= { c: 0, s: 0 }); if (r.verdict === 'SURVIVED') o.s++; else o.c++; }
for (const [d, v] of Object.entries(dirs).sort()) {
  console.log(`${d.padEnd(20)} run=${String(v.c + v.s).padStart(4)} caught=${String(v.c).padStart(4)} survived=${String(v.s).padStart(4)}  score=${((100 * v.c) / (v.c + v.s)).toFixed(0)}%`);
}

console.log('\n== WORST FILES (>=3 survivors) ==');
const byFile = {};
for (const r of run) { const o = (byFile[r.file] ||= { c: 0, s: 0 }); if (r.verdict === 'SURVIVED') o.s++; else o.c++; }
for (const [f, v] of Object.entries(byFile).filter(x => x[1].s >= 3).sort((a, b) => b[1].s - a[1].s)) {
  console.log(`${String(v.s).padStart(3)}s/${String(v.c + v.s).padStart(3)}  ${f}`);
}

fs.writeFileSync(path.join(D, 'survivors.json'), JSON.stringify(surv, null, 1));
console.log('\nsurvivors.json written:', surv.length);

// annotate survivors with the tests whose coverage includes the mutated line
const COV = JSON.parse(fs.readFileSync(path.join(D, 'cov.json'), 'utf8'));
const ann = surv.map(r => ({ ...r, coveringTests: (COV[r.file] || {})[String(r.line)] || [] }));
fs.writeFileSync(path.join(D, 'survivors.json'), JSON.stringify(ann, null, 1));
