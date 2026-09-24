// Re-apply a specific mutant and run the ENTIRE 688-test suite, to prove a
// SURVIVED verdict is not an artefact of the coverage-derived test subset.
//   node tools/mutation/confirm.mjs <spec-file.json>
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
  // AUDIT 68 X5-mutation-harness-enobufs-orphaned: a whole-suite TAP outgrows the default 1 MiB maxBuffer, and the
  // child killed by ENOBUFS exits non-zero - which read as CAUGHT, so every real survivor sent here was dismissed.
  const r = spawnSync(process.execPath, ['--test'], { cwd: ROOT, encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 28 });
  fs.writeFileSync(abs, orig);
  if (r.error || r.status === null) {
    results.push({ ...s, verdict: 'HARNESS_ERROR', error: r.error?.code ?? r.signal });
    process.stderr.write(`HARNESS_ERROR ${s.file}:${s.line} ${r.error?.code ?? r.signal} - not a verdict\n`);
    continue;
  }
  const m = (r.stdout || '').match(/# fail (\d+)/);
  const verdict = r.status === 0 ? 'SURVIVED_FULL_SUITE' : 'CAUGHT_BY_FULL_SUITE';
  results.push({ ...s, verdict, fails: m ? Number(m[1]) : null });
  process.stderr.write(`${verdict} ${s.file}:${s.line} ${s.from}->${s.to} fails=${m ? m[1] : '?'}\n`);
}
fs.writeFileSync(path.join(ROOT, '.mutaudit', 'confirm-' + path.basename(process.argv[2])), JSON.stringify(results, null, 1));
const count = (v) => results.filter(r => r.verdict === v).length;
console.log(JSON.stringify({ total: results.length, survivedFullSuite: count('SURVIVED_FULL_SUITE'), caught: count('CAUGHT_BY_FULL_SUITE'), harnessErrors: count('HARNESS_ERROR') }));
