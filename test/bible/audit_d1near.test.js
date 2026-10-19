// AUDIT D1-NEAR (2026-10-12, the owner: "Audit this"; bible/01-Overview/audits/Audit-D1-Near.md) - D1-NEAR read by three
// cold lanes on a frozen snapshot: the platform (P), the measurement and every claim built on it (M), the deploy's
// report step and its pins (T). These pins hold what the audit FIXED in the step and the records; test/bible/d1near.test.js
// holds the slice's own law, and test/d1nearStep.mjs runs the step for both as the runner runs it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, STEP, workflow, stepAt, stepKeys, stepRun, runStep, d1Answer, PLAN_UP } from '../d1nearStep.mjs';

const src = (p) => readFileSync(join(ROOT, p), 'utf8');

test('AUDIT D1-NEAR T3 T4 T6: the report step\'s own keys are a report\'s - it never fails the deploy, a bound on its minutes, run from server-account/ beside the toml its readout reads - and it stands after the health check and before the smoke steps, each by a name that is there; its D1 readout is bounded too (mutants: the gate back; the minutes unbounded; another shell; the readout unbounded)', () => {
  const wf = workflow();
  // T4: `shell: sh` (dash refuses `set -o pipefail` and fails the deploy) or `if: false` passed every pin the slice had
  assert.deepEqual(stepKeys(wf, STEP), ['continue-on-error: true', 'timeout-minutes: 4', 'working-directory: server-account']);
  // T6: an order against a name that is not there was true (-1 < n); before the smoke steps, so it runs on a deploy a
  // smoke step fails - the overload days the report is for
  assert.ok(stepAt(wf, 'Deploy') < stepAt(wf, 'Verify /v1/health names this deploy'));
  assert.ok(stepAt(wf, 'Verify /v1/health names this deploy') < stepAt(wf, STEP), 'reported once the deploy is known to have taken');
  assert.ok(stepAt(wf, STEP) < stepAt(wf, 'Read the documents a new account agrees to'), 'and before the first smoke step');
  // T3: ten curls at --max-time 10 and the readout's 60 s fit inside the step's four minutes
  assert.ok(stepRun(wf, STEP).includes('d1=$(timeout 60 $WRANGLER d1 execute "$DB_NAME" --remote --command "SELECT 1" --json 2>/dev/null) || d1=""'), 'the readout is bounded and its failure discarded');
});

test('AUDIT D1-NEAR T2 T3 T5: every curl the report makes is bounded, sends its body nowhere and fails on an error answer, and the readout asks D1 one SELECT 1 of the deploy\'s own database (mutants: either curl unbounded; either body kept; either error answer timed)', () => {
  const r = runStep({ plan: PLAN_UP, d1: d1Answer('LAX', 'WNAM', true) });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.asked.length, 10);
  for (const a of r.asked) {
    assert.equal(a.maxTime, '10', `${a.kind}: bounded`);
    // T5: a body with no -o lands on stdout with no newline after it, the -w text glued on - every deploy's cost
    // "unmeasured", and nothing said why
    assert.equal(a.out, '/dev/null', `${a.kind}: its body sent nowhere`);
    assert.equal(a.fail, true, `${a.kind}: an error answer fails the transfer (-f)`);
    assert.equal(a.dump, a.kind === 'health' ? '-' : '', `${a.kind}: headers read off the health alone`);
  }
  assert.deepEqual(r.wranglerAsked, ['d1 execute daggerfall-accounts --remote --command SELECT 1 --json']);
});

test('AUDIT D1-NEAR T1 T10: an answer that did not come is no answer - curl writes a failed transfer\'s time too (a refused connection, exit 7), and the step drops it; the medians are of the answers that came, and how many came is said (mutants: a failed health\'s time kept; a failed read\'s time kept; the counts crossed)', () => {
  // the good answers spread, so a kept failure moves a middle: 50/81/120 and 60/86/140 ms, two failures of each
  const r = runStep({
    plan: {
      health: ['200 0.050 h2:remote-SJC', 'refused 0.0002', '200 0.081 h2:remote-SJC', 'refused 0.0002', '200 0.120 h2:remote-SJC'],
      read: ['200 0.060', 'refused 10.003', '200 0.086', 'refused 10.003', '200 0.140'],
    },
    d1: d1Answer('LAX', 'WNAM', true),
  });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes('cf-placement over five answers: remote-SJC none remote-SJC none remote-SJC; one statement on the primary costs it ~5 ms (medians: /v1/seats/sieges/live 86 ms of 3 answers, /v1/health 81 ms of 3);'), r.stdout);
  // a failure on one side only, each way: the reads answered none and the health all, then the other way about - the
  // cost unmeasured, the counts each side's, and the step green (a middle of nothing is no failure)
  const noReads = runStep({ plan: { health: PLAN_UP.health, read: Array(5).fill('refused 0.0003') } });
  assert.equal(noReads.status, 0, noReads.stderr);
  assert.ok(noReads.summary.includes('From there, one statement\'s cost unmeasured (of five, /v1/health answered 5 and /v1/seats/sieges/live 0)'), noReads.summary);
  const noHealth = runStep({ plan: { health: Array(5).fill('refused 0.0003'), read: PLAN_UP.read } });
  assert.equal(noHealth.status, 0, noHealth.stderr);
  assert.ok(noHealth.summary.includes('From there, one statement\'s cost unmeasured (of five, /v1/health answered 0 and /v1/seats/sieges/live 5)'), noHealth.summary);
});

test('AUDIT D1-NEAR T2: an error answer is no statement - a 503 from the one-statement read (the route answers no-database with no statement, and a D1 failure there escapes as the platform\'s own 500) or from the health is dropped, never timed (mutants: the read timed without -f; the health timed without -f)', () => {
  const r = runStep({
    plan: {
      health: ['200 0.080 h2:remote-SJC', '503 0.001 h2:remote-SJC', '200 0.081 h2:remote-SJC', '503 0.001 h2:remote-SJC', '200 0.082 h2:remote-SJC'],
      read: ['503 0.002', '200 0.090', '503 0.002', '200 0.150', '200 0.300'],
    },
    d1: d1Answer('LAX', 'WNAM', true),
  });
  assert.equal(r.status, 0, r.stderr);
  // timed, the two 503s' 2 ms would make the read's middle 90 and the cost ~10 ms - "beside the primary", of nothing
  assert.ok(r.stdout.includes('cf-placement over five answers: remote-SJC none remote-SJC none remote-SJC; one statement on the primary costs it ~69 ms (medians: /v1/seats/sieges/live 150 ms of 3 answers, /v1/health 81 ms of 3);'), r.stdout);
});

test('AUDIT D1-NEAR P1 M2 M12: where the primary is, by D1\'s own word - its SELECT 1\'s answer names the data centre that served it, said as the primary\'s only where D1 says the primary served it; a replica\'s is never taken for it, and an answer D1 did not give says so (mutant: a replica taken for the primary)', () => {
  const said = (d1) => { const r = runStep({ plan: PLAN_UP, d1 }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim().split('; ').pop(); };
  assert.equal(said(d1Answer('LAX', 'WNAM', true)), 'D1\'s primary answered from LAX (WNAM)');
  assert.equal(said(d1Answer('SJC', undefined, true)), 'D1\'s primary answered from SJC (its region unsaid)');
  assert.equal(said(d1Answer('IAD', 'ENAM', false)), 'a D1 replica answered from IAD, not the primary - where the primary is, unsaid');
  assert.equal(said(JSON.stringify({ error: 'Authentication error [code: 10000]' })), 'D1 did not say where its primary is');
  assert.equal(said('not json at all'), 'D1 did not say where its primary is');
  assert.equal(said(null), 'D1 did not say where its primary is', 'wrangler failing');
});

test('AUDIT D1-NEAR M1 M2 M6: the records say what the data holds - both probes\' Newark rows in the measurement\'s table, the primary in western North America and never "California" as where it is, the Guild tab\'s thirteen or fourteen (mutants: probe B\'s Newark row dropped; the toml\'s primary put in California; Active-Arcs\' put in California)', () => {
  const arc = src('bible/11-Multiplayer/Scale-Arc.md');
  const at = arc.indexOf('\n## D1-NEAR: built');
  const record = arc.slice(at, arc.indexOf('\n## ', at + 1));
  assert.ok(record.includes('| A: p50 199 ms, min 148 (n=5); B: p50 337, min 281 (n=5) |'), 'M1: both probes\' local reads, the slower one too');
  assert.ok(record.includes('**Where the primary is - by bounds, not by a fit**'), 'M1: read by bounds');
  assert.ok(record.includes('thirteen statements for a member, fourteen for an officer or the guildmaster'), 'M6');
  // M2: the comment as one text (a line break never hides a claim), the record, the index line and the testing row
  const toml = src('server-account/wrangler.toml').split('\n');
  const p = toml.findIndex((l) => l === '[placement]');
  let i = p - 1; while (i >= 0 && toml[i].startsWith('#')) i--;
  const comment = toml.slice(i + 1, p).map((l) => l.replace(/^# ?/, '')).join(' ');
  assert.ok(comment.includes('the primary is in western North America (the record has the bounds)'), 'the toml says western North America');
  const index = src('bible/01-Overview/Active-Arcs.md').split('\n').find((l) => l.startsWith('- `11-Multiplayer/Scale-Arc.md` D1-NEAR'));
  const row = src('bible/09-Testing/Testing-Rows-2026-10-19.md').split('\n').find((l) => l.startsWith('| d1near.test.js |'));   // LEGIBLE 1b: the closed table
  assert.ok(index && row);
  const CALIFORNIA = /primary (?:stands|is) in California|which is California|California \(Los Angeles or San Jose\)/;
  for (const [name, text] of [['wrangler.toml', comment], ['the record', record], ['Active-Arcs', index], ['Testing.md', row]]) {
    assert.doesNotMatch(text, CALIFORNIA, `${name} puts the primary in California - the bounds say western North America, D1 says the city`);
  }
});
