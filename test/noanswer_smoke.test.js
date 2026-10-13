// NO-ANSWER (2026-10-13, a screenshot of #883's deploy: "renown/xp -> 000"; bible/06-Systems/Online-Arc.md HOME2): THE
// DEPLOY'S SMOKE ASKS A CALL THAT GOT NO ANSWER AGAIN. acct128 had taken - /v1/health named it - when renown/xp waited on
// a database still overloaded from 14:11 until curl gave up at fifteen seconds, and `post` read that `000` as an answer:
// a live Worker's deploy failed on its first ask, where the guest mint, the registration and the gate's claim each ask a
// no-answer again. A call curl gave up on may still land, so the two writes read `post`'s mark of it - a beat sent again
// may follow one that landed, a report sent again may be that report's repeat - and keep their strict answer otherwise.
// The step's own script, run here as the runner runs it (bash with the runner's flags), over a fake curl that answers
// as the service does - a write that lands and then loses its answer among its faults - and a fake `sleep` that waits
// for nothing. tools/mutants/noanswer_smoke.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { workflow, stepRun } from './d1nearStep.mjs';

const STEP = 'Verify a password route really runs on the platform';

/** The service as the smoke meets it, and curl as the smoke calls it (`-o`, `-w '%{http_code}'`, `-d`): each route
 *  answers as the Worker does, its state kept across calls - a beat after the first answers its gap, a report id
 *  credited once and its repeat after. A call's planned fault: `lost` never reaches the service, `landed` is taken
 *  and its answer lost (both curl's timeout: `000` written, exit 28, no body); `gap` and `repeat` are a service that
 *  answers a first beat or a first report wrongly. */
const FAKE_CURL = String.raw`
const fs = require('fs');
const dir = process.env.FAKE_DIR;
const args = process.argv.slice(2);
let out = null, data = '{}', url = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o') out = args[++i];
  else if (args[i] === '-d') data = args[++i];
  else if (['-w', '-X', '-H', '--max-time'].includes(args[i])) i++;
  else if (/^https?:/.test(args[i])) url = args[i];
}
const route = new URL(url).pathname;
const stateFile = dir + '/state.json';
const s = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { asked: [], beats: 0, rids: [] };
const plan = JSON.parse(fs.readFileSync(dir + '/plan.json', 'utf8'));
const n = s.asked.filter((a) => a === route).length;
s.asked.push(route);
const fault = (plan[route] ?? [])[n] ?? 'ok';
const body = JSON.parse(data);
let status = 404, answer = { error: 'not-found' };
if (fault !== 'lost') {
  if (route === '/v1/auth/guest') { status = 200; answer = { secret: 'smoke-secret' }; }
  else if (route === '/v1/account/played') { s.beats++; status = 200; answer = { playedS: s.beats === 1 && fault !== 'gap' ? 0 : 20 }; }
  else if (route === '/v1/mod/mute') { status = 403; answer = { error: 'not-moderator' }; }
  else if (route === '/v1/renown/xp') {
    status = 200;
    if (s.rids.includes(body.rid) || fault === 'repeat') answer = { credited: 0, repeat: true };
    else { s.rids.push(body.rid); answer = { credited: 1 }; }
  }
  else if (route === '/v1/homes/town') { status = 200; answer = { homes: [] }; }
  else if (route === '/v1/homes/decor') { status = 200; answer = { pieces: [] }; }
  else if (route === '/v1/homes/claim' || route === '/v1/homes/decor/place') { status = 403; answer = { error: 'homes-need-account' }; }
  else if (route === '/v1/auth/register') { status = 200; answer = { token: 'smoke-token' }; }
}
fs.writeFileSync(stateFile, JSON.stringify(s));
if (fault === 'lost' || fault === 'landed') {
  process.stderr.write('curl: (28) Operation timed out after 15001 milliseconds with 0 bytes received\n');
  process.stdout.write('000');
  process.exit(28);
}
if (out) fs.writeFileSync(out, JSON.stringify(answer));
process.stdout.write(String(status));
`;

/** The step run over a service planned as `plan` - route -> each call's fault, in order (a call past the list: 'ok'). */
function smoke(plan = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'noanswer-'));
  try {
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    mkdirSync(join(dir, 'tmp'));
    writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan));
    writeFileSync(join(dir, 'curl.cjs'), FAKE_CURL);
    writeFileSync(join(bin, 'curl'), `#!/usr/bin/env bash\nexec node "${dir}/curl.cjs" "$@"\n`);
    writeFileSync(join(bin, 'sleep'), `#!/usr/bin/env bash\necho "$1" >> "${dir}/slept"\n`);
    chmodSync(join(bin, 'curl'), 0o755);
    chmodSync(join(bin, 'sleep'), 0o755);
    const script = stepRun(workflow(), STEP)
      .replaceAll('${{ steps.deploy.outputs.base }}', 'https://account.smoke.test')
      .replaceAll('/tmp/', `${dir}/tmp/`);
    const r = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', script], {
      env: { PATH: `${bin}:${process.env.PATH}`, FAKE_DIR: dir, LEGAL_TERMS: '2026-09-28', LEGAL_PRIVACY: '2026-09-28' },
      encoding: 'utf8',
    });
    const state = JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8'));
    const slept = existsSync(join(dir, 'slept')) ? readFileSync(join(dir, 'slept'), 'utf8').trim().split('\n').map(Number) : [];
    const asked = (route) => state.asked.filter((a) => a === route).length;
    return { status: r.status, out: `${r.stdout}${r.stderr}`, asked, slept, state };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('NO-ANSWER a call that gets no answer is asked again, a read and a write alike, and one that never answers fails the deploy after seven asks, naming its 000; a service that answers is asked each call once and waited on for nothing (mutant: a no-answer read as an answer)', () => {
  const clean = smoke();
  assert.equal(clean.status, 0, clean.out);
  assert.match(clean.out, /VERIFIED: a password route runs on the real platform/);
  for (const route of ['/v1/auth/guest', '/v1/account/played', '/v1/mod/mute', '/v1/homes/town', '/v1/homes/claim', '/v1/homes/decor', '/v1/homes/decor/place', '/v1/auth/register']) {
    assert.equal(clean.asked(route), 1, `${route} asked once`);
  }
  assert.equal(clean.asked('/v1/renown/xp'), 2, 'the report and its repeat');
  assert.deepEqual(clean.slept, [], 'nothing waited on');

  const lost = smoke({ '/v1/renown/xp': ['lost'], '/v1/homes/town': ['lost'] });
  assert.equal(lost.status, 0, lost.out);
  assert.equal(lost.asked('/v1/renown/xp'), 3, 'the report asked again, then its repeat');
  assert.equal(lost.asked('/v1/homes/town'), 2, 'the town asked again');
  assert.deepEqual(lost.slept, [5, 5], 'five seconds before each ask again');
  assert.match(lost.out, /renown\/xp -> 000 \(attempt 1/);

  const never = smoke({ '/v1/renown/xp': Array(7).fill('lost') });
  assert.equal(never.status, 1, never.out);
  assert.equal(never.asked('/v1/renown/xp'), 7, 'seven asks');
  assert.match(never.out, /::error::a Renown report failed on the deployed Worker \(000\)/);
  assert.equal(never.asked('/v1/homes/town'), 0, 'and the deploy stops there');
});

test('NO-ANSWER a write the service took whose answer was lost is asked again and its second answer holds: the report\'s repeat (its id credited once - #883\'s deploy\'s own case), the beat\'s gap since the one that landed (mutants: the mark never made; the beat\'s or the report\'s mark unread)', () => {
  const report = smoke({ '/v1/renown/xp': ['landed'] });
  assert.equal(report.status, 0, report.out);
  assert.equal(report.state.rids.length, 1, 'one report id, credited once');
  assert.equal(report.asked('/v1/renown/xp'), 3, 'the lost answer, the repeat that answers it, the repeat asked on purpose');
  assert.match(report.out, /VERIFIED/);

  const beat = smoke({ '/v1/account/played': ['landed'] });
  assert.equal(beat.status, 0, beat.out);
  assert.equal(beat.state.beats, 2, 'the beat that landed, and the one that answered');
  assert.match(beat.out, /played -> 200\n\{"playedS":20\}/);
  assert.match(beat.out, /VERIFIED/);
});

test('NO-ANSWER with every answer heard the two writes keep their strict answer: a first beat that answers a gap, or a first report that answers a repeat, still fails the deploy (mutants: the beat\'s or the report\'s loose answer taken always)', () => {
  const beat = smoke({ '/v1/account/played': ['gap'] });
  assert.equal(beat.status, 1, beat.out);
  assert.match(beat.out, /::error::the time-played beat failed on the deployed Worker \(200\) - a first beat must answer playedS 0/);

  const report = smoke({ '/v1/renown/xp': ['repeat'] });
  assert.equal(report.status, 1, report.out);
  assert.match(report.out, /::error::a Renown report failed on the deployed Worker \(200\) - a first report of 1 XP must be credited 1/);
});
