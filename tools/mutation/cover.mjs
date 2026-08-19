// Per-test-file EXACT line coverage of src/ via NODE_V8_COVERAGE.
// Innermost-range-wins painting, so a loaded-but-unexecuted function body is
// correctly reported as uncovered (V8 reports the module wrapper as count=1).
// Output: .mutaudit/cov.json   { "<src rel>": { "<line>": ["a.test.js", ...] } }
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.mutaudit');
const COVROOT = path.join(OUT, 'v8cov');
fs.rmSync(COVROOT, { recursive: true, force: true });
fs.mkdirSync(COVROOT, { recursive: true });

const tests = fs.readdirSync(path.join(ROOT, 'test')).filter(f => f.endsWith('.test.js')).sort();

const srcCache = new Map();
function getSrc(abs) {
  if (!srcCache.has(abs)) {
    const t = fs.readFileSync(abs, 'utf8');
    const ls = [0];
    for (let i = 0; i < t.length; i++) if (t[i] === '\n') ls.push(i + 1);
    srcCache.set(abs, { text: t, ls });
  }
  return srcCache.get(abs);
}
function offToLine(ls, off) {
  let lo = 0, hi = ls.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ls[mid] <= off) lo = mid; else hi = mid - 1; }
  return lo + 1;
}

const perTest = {};
let i = 0;
for (const t of tests) {
  i++;
  const dir = path.join(COVROOT, String(i));
  fs.mkdirSync(dir, { recursive: true });
  const r = spawnSync(process.execPath, ['--test', path.join('test', t)], {
    cwd: ROOT, encoding: 'utf8', timeout: 180000,
    env: { ...process.env, NODE_V8_COVERAGE: dir, ARENA2_PATH: process.env.ARENA2_PATH },
  });
  // gather all ranges per src file across all coverage json shards
  const ranges = {};
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json')); } catch { /* ignore */ }
  for (const f of files) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    for (const sc of j.result || []) {
      if (!sc.url || !sc.url.startsWith('file://')) continue;
      let abs;
      try { abs = fileURLToPath(sc.url); } catch { continue; }
      if (!abs.startsWith(path.join(ROOT, 'src') + path.sep)) continue;
      const rel = path.relative(ROOT, abs);
      const acc = (ranges[rel] ||= []);
      for (const fn of sc.functions || []) for (const rng of fn.ranges || []) acc.push(rng);
    }
  }
  const covered = {};
  for (const [rel, rs] of Object.entries(ranges)) {
    let s;
    try { s = getSrc(path.join(ROOT, rel)); } catch { continue; }
    const n = s.text.length;
    const paint = new Int32Array(n);           // 0 = not seen / not executed
    rs.sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
    for (const rng of rs) {
      const a = Math.max(0, rng.startOffset), b = Math.min(n, rng.endOffset);
      const v = rng.count > 0 ? 1 : -1;
      paint.fill(v, a, b);
    }
    const set = new Set();
    for (let k = 0; k < n; k++) {
      if (paint[k] !== 1) continue;
      const ch = s.text[k];
      if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') continue;
      set.add(offToLine(s.ls, k));
    }
    if (set.size) covered[rel] = [...set].sort((a, b) => a - b);
  }
  perTest[t] = covered;
  fs.rmSync(dir, { recursive: true, force: true });
  process.stderr.write(`[${i}/${tests.length}] ${t} status=${r.status} srcfiles=${Object.keys(covered).length}\n`);
}

const inv = {};
for (const [t, files] of Object.entries(perTest)) {
  for (const [rel, lines] of Object.entries(files)) {
    const m = (inv[rel] ||= {});
    for (const L of lines) (m[L] ||= []).push(t);
  }
}
fs.writeFileSync(path.join(OUT, 'cov.json'), JSON.stringify(inv));
fs.writeFileSync(path.join(OUT, 'covByTest.json'), JSON.stringify(perTest));
console.log('wrote cov.json srcFiles=', Object.keys(inv).length);
