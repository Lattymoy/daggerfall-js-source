// Re-apply a specific mutant and run the ENTIRE 688-test suite, to prove a
// SURVIVED verdict is not an artefact of the coverage-derived test subset.
//   node .mutaudit/confirm.mjs <spec-file.json>
// spec-file: [ {file, line, from, to, nth?} , ... ]  (nth = which occurrence of
// `from` on that line, default 1)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const specs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const results = [];

for (const s of specs) {
  const abs = path.join(ROOT, s.file);
  const orig = fs.readFileSync(abs, 'utf8');
  const lines = orig.split('\n');
  const L = lines[s.line - 1];
  let idx = -1;
  for (let k = 0; k < (s.nth || 1); k++) idx = L.indexOf(s.from, idx + 1);
  if (idx < 0) { results.push({ ...s, verdict: 'PATCH_FAILED' }); continue; }
  lines[s.line - 1] = L.slice(0, idx) + s.to + L.slice(idx + s.from.length);
  fs.writeFileSync(abs, lines.join('\n'));
  const chk = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (chk.status !== 0) { fs.writeFileSync(abs, orig); results.push({ ...s, verdict: 'SYNTAX' }); continue; }
  const r = spawnSync(process.execPath, ['--test'], { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
  fs.writeFileSync(abs, orig);
  const m = (r.stdout || '').match(/# fail (\d+)/);
  const verdict = r.status === 0 ? 'SURVIVED_FULL_SUITE' : 'CAUGHT_BY_FULL_SUITE';
  results.push({ ...s, verdict, fails: m ? Number(m[1]) : null });
  process.stderr.write(`${verdict} ${s.file}:${s.line} ${s.from}->${s.to} fails=${m ? m[1] : '?'}\n`);
}
fs.writeFileSync(path.join(ROOT, '.mutaudit', 'confirm-' + path.basename(process.argv[2])), JSON.stringify(results, null, 1));
const surv = results.filter(r => r.verdict === 'SURVIVED_FULL_SUITE').length;
console.log(JSON.stringify({ total: results.length, survivedFullSuite: surv, caught: results.length - surv }));
