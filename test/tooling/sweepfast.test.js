// SWEEP-FAST (2026-10-19, Mac: "Yes" - a relay deploy took an hour, ~53 minutes of it one job sweeping a band's 500
// seeds): A BAND'S SEEDS IN PARTS. tools/egSpanSolve.mjs --part p/k sweeps every k-th seed of the band's list from its
// p-th, and eg-sweep.yml runs six such parts a band at once past a hundred seeds (the nightly's and a relay deploy's
// 500), one at a pull request's 25. Every seed is swept by exactly one part.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sweepPart, sweepPartOf, sweepSeeds, main, SWEEP_GOLDEN } from '../../tools/egSpanSolve.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('SWEEP-FAST THE PARTS: every seed of the band\'s list - the golden ones too - in exactly one of k parts, whatever k; the parts within one seed of each other; each of six parts over 500 seeds holds every circle of the band (a seed\'s circle is its fifth); one part is the whole list; `p/k` read only for 1 <= p <= k (mutants: a part off by one; a part past k, or none, taken)', () => {
  const all = sweepSeeds(500, 1, true);
  assert.equal(all.length, 502, 'the 500 and the two golden seeds past them');
  for (const k of [1, 2, 3, 5, 6, 8]) {
    const parts = Array.from({ length: k }, (_, i) => sweepPart(all, i + 1, k));
    assert.deepEqual(parts.flat().sort((a, b) => a - b), [...all].sort((a, b) => a - b), `${k}: every seed, each once`);
    const n = parts.map((q) => q.length);
    assert.ok(Math.max(...n) - Math.min(...n) <= 1, `${k}: even (${n})`);
  }
  for (let p = 1; p <= 6; p++) assert.equal(new Set(sweepPart(all, p, 6).map((s) => s % 5)).size, 5, `part ${p}: every circle`);
  assert.ok(SWEEP_GOLDEN.every((g) => [1, 2, 3, 4, 5, 6].some((p) => sweepPart(all, p, 6).includes(g))), 'the golden seeds swept');
  assert.deepEqual(sweepPart(all, 1, 1), all);
  assert.deepEqual(sweepPartOf('2/6'), { p: 2, k: 6 });
  assert.deepEqual(sweepPartOf('6/6'), { p: 6, k: 6 });
  for (const bad of ['0/6', '7/6', '1/0', '2', 'a/b', '', null, undefined]) assert.equal(sweepPartOf(bad), null, String(bad));
});

test('SWEEP-FAST THE CLI: `--part p/k` sweeps that part of the seeds `--seeds`, `--from` and `--golden` ask, and says so; without it the whole list, unsaid; a part that is none refused with the usage\'s exit (mutants: the part ignored; a bad part run)', () => {
  const asked = (argv) => {
    const seeds = [], lines = [];
    const code = main(['--sweep', '--band', '0', ...argv], (l) => lines.push(l), (seed) => { seeds.push(seed); return [{ ok: true, seed, h: 1, road: 0 }]; });
    return { code, seeds, lines };
  };
  const two = asked(['--seeds', '12', '--golden', '--part', '2/3']);
  assert.equal(two.code, 0);
  assert.deepEqual(two.seeds, sweepPart(sweepSeeds(12, 1, true), 2, 3));
  assert.deepEqual(two.seeds, [2, 5, 8, 11, 0xbeef]);
  assert.match(two.lines[0], /^part 2\/3: 5 of the 15 seeds$/);
  const whole = asked(['--seeds', '4', '--from', '10']);
  assert.deepEqual(whole.seeds, [10, 11, 12, 13]);
  assert.ok(!whole.lines.some((l) => /^part /.test(l)), 'one part unsaid');
  for (const bad of ['0/3', '4/3', 'x']) assert.equal(asked(['--seeds', '4', '--part', bad]).code, 2, bad);
});

test('SWEEP-FAST THE WORKFLOW: the sweep\'s matrix takes a part of each band - six past a hundred seeds a band, one else, the part list running 1 to the parts it names under the same rule; both steps sweep their part; a pull request\'s 25 stay one job a band, the nightly\'s and a relay deploy\'s 500 run six; the part named only where there are several (mutants: a part left out; the law 9 walk sweeping every seed in every part; a pull request split; the course step unparted)', () => {
  const w = read('.github/workflows/eg-sweep.yml');
  const part = /\n {8}part: \$\{\{ fromJSON\(\(inputs\.seeds \|\| 500\) > (\d+) && '\[([\d, ]+)\]' \|\| '\[1\]'\) \}\}\n/.exec(w);
  const parts = /\n {8}parts: \$\{\{ fromJSON\(\(inputs\.seeds \|\| 500\) > (\d+) && '\[(\d+)\]' \|\| '\[1\]'\) \}\}\n/.exec(w);
  assert.ok(part && parts, 'the part and the parts, by one rule');
  assert.equal(part[1], parts[1], 'the same threshold');
  const k = Number(parts[2]), list = part[2].split(',').map((x) => Number(x.trim()));
  assert.equal(k, 6);
  assert.deepEqual(list, Array.from({ length: k }, (_, i) => i + 1), 'every part of the parts');
  const at = Number(part[1]);
  assert.ok(25 <= at && at < 500, `a pull request's 25 one job, the 500 in parts (threshold ${at})`);
  const v = read('.github/workflows/verify.yml'), r = read('.github/workflows/relay-deploy.yml');
  assert.match(v, /\n {6}sweep:\n {8}description: [^\n]+\n {8}type: number\n {8}default: 25\n/);
  assert.match(r, /\n {6}sweep: 500\n/);
  const runs = w.match(/run: node tools\/egSpanSolve\.mjs --sweep [^\n]*\n/g) ?? [];
  assert.equal(runs.length, 2, 'the courses and the law 9 walk');
  for (const l of runs) assert.match(l, / --part \$\{\{ matrix\.part \}\}\/\$\{\{ matrix\.parts \}\}\n$/, l);
  assert.match(w, /\n {4}name: span sweep, band \$\{\{ matrix\.band \}\}\$\{\{ matrix\.parts > 1 && format\(' part \{0\}\/\{1\}', matrix\.part, matrix\.parts\) \|\| '' \}\}\n/);
});
