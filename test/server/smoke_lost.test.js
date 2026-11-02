// SMOKE-LOST (2026-10-18, the owner's screenshot of #1004's account deploy: renown/xp -> 000, 503, then 200
// `"credited":0,"repeat":true`): A WRITE WHOSE ANSWER WAS LOST MAY HAVE LANDED. The smoke's first Renown report hung
// 15 s and was credited; its retry was answered, rightly, as that report again - and the smoke, asking `credited` 1 of
// the answer it got, failed a deploy whose Worker had taken. `ask` now leaves `<out>.lost` when a try went unanswered,
// and the two calls that write before they are read (the first beat, the first report) take, after a lost try, the
// answer the landed write gives its retry - never without one. The record: bible/06-Systems/Online-Arc.md, HOME2's
// "The deploy's smoke asks again".
//
// The step itself runs here, through bash as the runner runs it, against a curl that answers as the service does, up
// to the Renown checks; its files go to a directory of the test's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url);
const YML = readFileSync(new URL('.github/workflows/account-deploy.yml', ROOT), 'utf8');
const STEP = 'Verify a password route really runs on the platform';
const REACHED = 'SMOKE-REACHED-THE-HOMES';

/** The step's `run: |` block as the runner hands it to bash, cut where the homes' checks begin. */
function smokeToRenown() {
  const at = YML.indexOf(`- name: ${STEP}\n`);
  assert.ok(at >= 0, `no step named "${STEP}"`);
  const from = YML.indexOf('run: |\n', at) + 'run: |\n'.length;
  const lines = [];
  for (const line of YML.slice(from).split('\n')) {
    if (line.trim() && !line.startsWith('          ')) break;
    lines.push(line.slice(10));
  }
  const run = lines.join('\n');
  const cut = run.indexOf('# HOME1: THE HOMES ARE LIVE.');
  assert.ok(cut > 0, 'the homes\' checks follow the Renown report');
  return run.slice(0, cut);
}

const SERVICE = 'https://svc.invalid';
/** A service answering each path in turn - `000` is no answer (curl 28 after its 15 s), the last answer kept. */
const ANSWERS = {
  '/v1/auth/guest': ['200 {"secret":"s-smoke"}'],
  '/v1/account/played': ['200 {"playedS":0}'],
  '/v1/mod/mute': ['403 {"error":"not-moderator"}'],
  '/v1/realm/create': ['200 {"character":{"id":"r0d21b5963","lease":"9f3a"}}'],
  '/v1/realm/r0d21b5963/data': ['200 {"ok":true,"seq":1}'],
  '/v1/renown/xp': ['200 {"character":"r0d21b5963","xp":1,"level":1,"credited":1,"rose":false,"order":null}',
    '200 {"character":"r0d21b5963","xp":1,"level":1,"credited":0,"rose":false,"repeat":true,"order":null}'],
};

/** The smoke against `answers` (ANSWERS with these paths replaced); `stale` names files left from a run before. */
function smoke(answers = {}, { stale = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'smoke-lost-'));
  const calls = join(dir, 'calls');
  writeFileSync(calls, '');
  for (const f of stale) writeFileSync(join(dir, f), '');
  const table = { ...ANSWERS, ...answers };
  const decl = Object.entries(table).map(([p, a]) => `['${p}']='${a.join('|')}'`).join(' ');
  const script = `declare -A ANS=(${decl})
curl() {
  local out= url= a n
  while [ $# -gt 0 ]; do
    case "$1" in -o) out=$2; shift 2;; -w|-X|-H|-d|--max-time) shift 2;; -*) shift;; *) url=$1; shift;; esac
  done
  local path=\${url#${SERVICE}}
  n=$(grep -cxF "$path" "$CALLS" || true)
  echo "$path" >> "$CALLS"
  IFS='|' read -r -a said <<< "\${ANS[$path]}"
  a=\${said[$n]-\${said[-1]}}
  if [ "\${a%% *}" = 000 ]; then return 28; fi
  printf '%s' "\${a#* }" > "$out"
  printf '%s' "\${a%% *}"
}
sleep() { :; }
${smokeToRenown().replace(/^base=.*$/m, `base=${SERVICE}`).replaceAll('/tmp/', `${dir}/`)}
echo ${REACHED}`;
  const r = spawnSync('bash', ['-c', script], { cwd: ROOT.pathname, env: { PATH: process.env.PATH, CALLS: calls, LEGAL_TERMS: 't', LEGAL_PRIVACY: 'p' }, encoding: 'utf8' });
  const asked = readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean);
  return { ok: r.status === 0 && r.stdout.includes(REACHED), out: r.stdout + r.stderr, asked };
}

const REPEAT = (xp) => `200 {"character":"r0d21b5963","xp":${xp},"level":1,"credited":0,"rose":false,"repeat":true,"order":null}`;

test('SMOKE-LOST the smoke, run: a service that answers every call passes it, each call asked once; and its refusals still fail it - a first report not credited, a repeat not answered as one (mutants: none - the harness itself, against the step as it stands)', () => {
  const clean = smoke();
  assert.ok(clean.ok, clean.out);
  assert.deepEqual(clean.asked.filter((p) => p === '/v1/renown/xp').length, 2, 'the report, and the same report again');
  assert.equal(clean.asked.length, 7, 'the guest, the beat, the mute, the character, its save, the report twice');
  assert.equal(smoke({ '/v1/renown/xp': ['200 {"xp":0,"credited":0,"order":null}'] }).ok, false, 'a first report credited nothing');
  assert.equal(smoke({ '/v1/renown/xp': [ANSWERS['/v1/renown/xp'][0]] }).ok, false, 'the same report credited again');
  assert.equal(smoke({ '/v1/account/played': ['200 {"playedS":7}'] }).ok, false, 'a fresh guest\'s first beat that found time already played');
});

test('SMOKE-LOST #1004\'s run: a first report whose answer was lost and landed is its retry\'s repeat, the track holding its 1 XP - the deploy passes; the same answer with no lost try before it, a track holding more than the report, or a retry credited nothing and no repeat, fail it (mutants: the loss never kept; a repeat taken without one; the track unread)', () => {
  const run1004 = smoke({ '/v1/renown/xp': ['000', '503 {"error":"server"}', REPEAT(1)] });
  assert.ok(run1004.ok, `#1004's answers - 000, 503, then the repeat - pass:\n${run1004.out}`);
  assert.equal(run1004.asked.filter((p) => p === '/v1/renown/xp').length, 4, 'three asks for the report, then the same report again');
  assert.equal(smoke({ '/v1/renown/xp': [REPEAT(1)] }).ok, false, 'a repeat with no lost try before it: a report this run never sent');
  assert.equal(smoke({ '/v1/renown/xp': ['503 {"error":"server"}', REPEAT(1)] }).ok, false, 'a 5xx writes nothing (a batch that failed whole): its retry is no repeat');
  assert.equal(smoke({ '/v1/renown/xp': ['000', REPEAT(2)] }).ok, false, 'a track holding more than the one report');
  assert.equal(smoke({ '/v1/renown/xp': ['000', REPEAT(12)] }).ok, false, 'nor the report\'s 1 at the head of a larger number');
  assert.equal(smoke({ '/v1/renown/xp': ['000', '200 {"xp":1,"credited":0,"order":null}'] }).ok, false, 'credited nothing and not a repeat');
  assert.equal(smoke({ '/v1/renown/xp': ['000', ANSWERS['/v1/renown/xp'][0], REPEAT(1)] }).ok, true, 'a lost try that never landed: the retry is credited, as any first report');
});

test('SMOKE-LOST the first beat: one whose answer was lost and landed makes its retry the second, credited the seconds between them - no more than seven asks\' 140; past that, or with no lost try before it, the deploy fails (mutants: the beat\'s loss unread; its bound unread)', () => {
  assert.ok(smoke({ '/v1/account/played': ['000', '200 {"playedS":20}'] }).ok, 'lost, landed, credited the twenty seconds since');
  assert.ok(smoke({ '/v1/account/played': ['000', '000', '000', '000', '000', '000', '200 {"playedS":140}'] }).ok, 'six lost asks: up to seven asks\' 140 seconds');
  assert.equal(smoke({ '/v1/account/played': ['000', '200 {"playedS":141}'] }).ok, false, 'more than the asks could have taken');
  assert.equal(smoke({ '/v1/account/played': ['200 {"playedS":20}'] }).ok, false, 'time played on the first answer to a fresh guest\'s first beat');
  assert.equal(smoke({ '/v1/account/played': ['000', '200 {}'] }).ok, false, 'an answer with no playedS');
});

test('SMOKE-LOST the loss is the call\'s own and this run\'s: a lost beat lends nothing to the report, and a marker left from a run before is cleared before the first ask (mutants: the marker never cleared)', () => {
  assert.equal(smoke({ '/v1/account/played': ['000', '200 {"playedS":5}'], '/v1/renown/xp': [REPEAT(1)] }).ok, false, 'the beat\'s lost try is not the report\'s');
  const stale = smoke({ '/v1/renown/xp': [REPEAT(1)] }, { stale: ['renown.json.lost'] });
  assert.equal(stale.ok, false, 'a marker from before this ask is not a try this ask lost');
  // the step's shape the harness leans on: `ask` is every write's retry, and the two checks read `lost` of their own file
  assert.match(YML, /\n\s*rm -f "\$out\.lost"\n\s*for i in \$\(seq 1 7\); do\n/);
  assert.match(YML, /\n\s*if \[ "\$got" = "000" \]; then : > "\$out\.lost"; fi\n/);
  assert.match(YML, /\n\s*lost\(\) \{ \[ -e "\$1\.lost" \]; \}\n/);
  assert.match(YML, /lost \/tmp\/beat\.json && \[ -n "\$played" \] && \[ "\$played" -le 140 \]/);
  assert.match(YML, /lost \/tmp\/renown\.json && grep -q '"repeat":true' \/tmp\/renown\.json && grep -q '"xp":1,' \/tmp\/renown\.json/);
});
