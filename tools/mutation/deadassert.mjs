// Run the whole suite under V8 coverage and report every `assert.*` call site in
// test/ that is NEVER EXECUTED — a pin that cannot fail because it never runs.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const DIR = path.join(ROOT, '.mutaudit', 'testcov');
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const r = spawnSync(process.execPath, ['--test'], {
  cwd: ROOT, encoding: 'utf8', timeout: 600000,
  env: { ...process.env, NODE_V8_COVERAGE: DIR },
});
process.stderr.write('suite status=' + r.status + '\n');

const ranges = {};
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json'))) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { continue; }
  for (const sc of j.result || []) {
    if (!sc.url || !sc.url.startsWith('file://')) continue;
    let abs; try { abs = fileURLToPath(sc.url); } catch { continue; }
    if (!abs.startsWith(path.join(ROOT, 'test') + path.sep)) continue;
    if (!abs.endsWith('.test.js')) continue;
    const acc = (ranges[abs] ||= []);
    for (const fn of sc.functions || []) for (const rng of fn.ranges || []) acc.push(rng);
  }
}

let totalSites = 0, deadSites = 0;
const out = [];
for (const [abs, rs] of Object.entries(ranges).sort()) {
  const text = fs.readFileSync(abs, 'utf8');
  const n = text.length;
  const paint = new Int32Array(n);
  rs.sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
  for (const rng of rs) paint.fill(rng.count > 0 ? 1 : -1, Math.max(0, rng.startOffset), Math.min(n, rng.endOffset));
  const ls = [0];
  for (let i = 0; i < n; i++) if (text[i] === '\n') ls.push(i + 1);
  const lineOf = (o) => { let lo = 0, hi = ls.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ls[m] <= o) lo = m; else hi = m - 1; } return lo + 1; };
  for (const m of text.matchAll(/\bassert\s*\./g)) {
    totalSites++;
    if (paint[m.index] !== 1) {
      deadSites++;
      const L = lineOf(m.index);
      out.push(`${path.basename(abs)}:${L}  ${text.split('\n')[L - 1].trim().slice(0, 140)}`);
    }
  }
}
console.log(`assert call sites: ${totalSites}   NEVER EXECUTED: ${deadSites}`);
console.log(out.join('\n'));
fs.writeFileSync(path.join(ROOT, '.mutaudit', 'deadasserts.txt'), out.join('\n'));
