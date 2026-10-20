// AUDIT PRE-MERGE 0929 (2026-09-29, Mac: "Audit this") - TERMS1's half: the deploy that asks the service as a player
// does, the site that waits for the service its forms ask, a game from before the boxes told the truth, and a keyboard
// that survives the card's redraw. The record: bible/01-Overview/audits/Audit-PreMerge-0929.md.
//
// Each test failed on the unfixed tree for its finding's reason: the smoke's guest opened with a label alone (T-CI), a
// deploy job that published with nothing waited on (T2), a bare request answered `terms-unaccepted` - a word no game
// from before TERMS1 has a sentence for (T1) - and a card whose repaint left the focus on nothing (T3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { TERMS_VERSION, PRIVACY_VERSION, ACCEPTED } from '../../src/net/legalLaw.js';
import { AccountFlow, LOCAL_REFUSALS } from '../../src/ui/accountFlow.js';
import { accountCard } from '../../src/ui/enhanced/enhancedAccount.js';
import { DEFAULT_ACCOUNT_SERVICE, REFUSALS, accountRefusalText } from '../../src/net/accountClient.js';
import { DEFAULT_SERVER } from '../../src/net/online.js';
import { RELAY_VERSION } from '../../src/net/wire.js';
import { ACCOUNT_VERSION } from '../../server-account/src/service.js';
import worker from '../../server-account/src/index.js';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const WORKFLOWS = readdirSync(new URL('.github/workflows/', ROOT)).filter((f) => f.endsWith('.yml'));

/** A step's `run: |` block, by its name, as the runner hands it to bash (the block's own indentation taken off). */
function runBlock(yml, stepName) {
  const at = yml.indexOf(`- name: ${stepName}\n`);
  assert.ok(at >= 0, `no step named "${stepName}"`);
  const from = yml.indexOf('run: |\n', at) + 'run: |\n'.length;
  const lines = [];
  for (const line of yml.slice(from).split('\n')) {
    if (line.trim() && !line.startsWith('          ')) break;
    lines.push(line.slice(10));
  }
  return lines.join('\n');
}

/** bash, from the repository's root, with the environment given - how the runner runs a step. */
const bash = (script, env = {}) => spawnSync('bash', ['-c', script], { cwd: ROOT.pathname, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });

test('AUDIT PRE-MERGE 0929 T-CI: every request a workflow makes that opens or names an account carries the versions both ends read - the deploy smoke opened its guest with a label alone, 400 under curl -f, and every check after the Worker went live never ran (mutants: a body without the versions; the versions typed in the workflow)', () => {
  let asked = 0;
  for (const f of WORKFLOWS) {
    const yml = read(`.github/workflows/${f}`);
    const uses = [...yml.matchAll(/\/v1\/auth\/(guest|register)"/g)];
    if (!uses.length) continue;
    // THE VERSIONS ARE READ OFF legalLaw.js BY THE STEP ITSELF, run here as the runner runs it
    const reader = runBlock(yml, 'Read the documents a new account agrees to');
    assert.ok(yml.indexOf('- name: Read the documents a new account agrees to') < uses[0].index, `${f}: the versions are read after the first request that needs them`);
    assert.doesNotMatch(reader, /\d{4}-\d{2}-\d{2}/, `${f}: a version typed in the workflow is a second home for it`);
    const envFile = join(mkdtempSync(join(tmpdir(), 'a0929-')), 'env');
    writeFileSync(envFile, '');
    const r = bash(reader, { GITHUB_ENV: envFile });
    assert.equal(r.status, 0, r.stderr);
    const env = Object.fromEntries(readFileSync(envFile, 'utf8').trim().split('\n').map((l) => l.split('=')));
    assert.deepEqual(env, { LEGAL_TERMS: TERMS_VERSION, LEGAL_PRIVACY: PRIVACY_VERSION });
    // ...AND EVERY BODY SENT TO THE TWO ROUTES CARRIES THEM, as bash expands it
    for (const u of uses) {
      const call = yml.slice(u.index, yml.indexOf(')\n', u.index));
      const word = call.match(/-d ("(?:[^"\\]|\\.)*")/)?.[1];
      assert.ok(word, `${f}: a request to /v1/auth/${u[1]} with no body`);
      const out = bash(`printf '%s' ${word}`, { ...env, secret: 's', handle: 'smoke1' });
      assert.equal(out.status, 0, out.stderr);
      const body = JSON.parse(out.stdout);
      assert.equal(body.terms, TERMS_VERSION, `${f}: /v1/auth/${u[1]} is asked without the Terms: ${out.stdout}`);
      assert.equal(body.privacy, PRIVACY_VERSION, `${f}: /v1/auth/${u[1]} is asked without the Privacy Policy: ${out.stdout}`);
      asked++;
    }
  }
  assert.equal(asked, 3, 'the account deploy asks the two routes three times: the gate\'s half, the password route\'s guest and its name');
});

/** scripts/serviceWait.sh as a publish job's step runs it - `run: scripts/serviceWait.sh`, from the root of the tree it
 * is given - over a relay and an account service that answer as the real ones do (the relay's /health
 * `{ ok, service, version, t }`, server/src/index.js; the service's /v1/health `{ ok, v }`, server-account/src/index.js),
 * each from its own list in turn, its last answer kept; '' is an answer that never came (curl -f fails). The clock is the
 * stubs' own: `sleep` moves it by what it is asked and each ask by `lag`, so a budget of hours is spent in a moment. */
function serviceWait({ relay, account }, { lag = 0, tree = ROOT.pathname } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'a0929-'));
  mkdirSync(join(dir, 'bin'));
  const stub = (name, body) => writeFileSync(join(dir, 'bin', name), `#!/usr/bin/env bash\nset -eu\nD=${JSON.stringify(dir)}\n${body}\n`, { mode: 0o755 });
  stub('date', '[ "$*" = +%s ] || { echo "date: +%s alone, not $*" >&2; exit 2; }\ncat "$D/clock"');
  stub('sleep', 'echo $(( $(cat "$D/clock") + $1 )) > "$D/clock"');
  stub('curl', `url=\${!#}
case "$url" in */v1/health) k=account ;; */health) k=relay ;; *) echo "curl: no service at $url" >&2; exit 2 ;; esac
t=$(cat "$D/clock"); echo "$t $url" >> "$D/asked"; echo "$t" >> "$D/$k.asked"; echo $(( t + ${lag} )) > "$D/clock"
mapfile -t A < "$D/$k"
n=$(wc -l < "$D/$k.asked")
a=\${A[$((n - 1))]-\${A[-1]}}
[ -n "$a" ] || exit 22
printf '%s' "$a"`);
  writeFileSync(join(dir, 'relay'), `${relay.join('\n')}\n`);
  writeFileSync(join(dir, 'account'), `${account.join('\n')}\n`);
  writeFileSync(join(dir, 'clock'), String(T0));
  writeFileSync(join(dir, 'asked'), '');
  const r = spawnSync('bash', ['-c', 'scripts/serviceWait.sh'], { cwd: tree, env: { PATH: `${join(dir, 'bin')}:${process.env.PATH}` }, encoding: 'utf8', timeout: 30_000 });
  const asked = readFileSync(join(dir, 'asked'), 'utf8').trim().split('\n').filter(Boolean).map((l) => ({ t: Number(l.slice(0, l.indexOf(' '))), url: l.slice(l.indexOf(' ') + 1) }));
  return { status: r.status, out: r.stdout + r.stderr, asked, end: Number(readFileSync(join(dir, 'clock'), 'utf8')) };
}
const T0 = 1_000_000;   // the stubs' clock as the wait begins

test('AUDIT PRE-MERGE 0929 T2, AUDIT RELEASE-FLOW A6: the site and the desktop release are published only once the account service serves the version their forms need and the relay its RELAY_VERSION - a site ahead of its service named accounts whose rows say "never asked" for players who ticked both boxes, and a release that moved the relay put every client ahead of it for as long as the relay\'s approval waited (mutants: no wait; the wait after the publish; the desktop release unwaited; an older service taken; the relay never asked; the loop that never fails; a tree not read taken as anything; a file it reads left out of the site\'s checkout; the budget by the count of asks)', () => {
  const deploy = read('.github/workflows/deploy.yml');
  const desktop = read('.github/workflows/release-desktop.yml');
  const script = read('scripts/serviceWait.sh');
  const STEP = '- name: Wait for the relay and the account service to serve this release\n        run: scripts/serviceWait.sh\n';
  const job = (yml, name) => {
    const at = yml.indexOf(`\n  ${name}:\n`);
    assert.ok(at >= 0, `no job ${name}`);
    const next = yml.slice(at + 1).search(/\n {2}[\w-]+:\n/);
    return next < 0 ? yml.slice(at) : yml.slice(at, at + 1 + next);
  };
  // PIN MOVED (AUDIT RELEASE-FLOW A6): the wait was the site's own step and asked the account service alone; it is one
  // script now, run by both publishes, and it asks the relay too. BOTH WAIT, BEFORE ANYTHING IS PUBLISHED.
  const site = job(deploy, 'deploy');
  const release = job(desktop, 'publish');
  for (const [where, j, publish] of [['deploy.yml deploy', site, 'uses: actions/deploy-pages'], ['release-desktop.yml publish', release, 'uses: softprops/action-gh-release']]) {
    const at = j.indexOf(STEP);
    assert.ok(at > 0, `${where}: no step runs scripts/serviceWait.sh`);
    assert.ok(j.indexOf(publish) > at, `${where}: published before the services are asked`);
    assert.doesNotMatch(j, /timeout-minutes:\s*([0-9]|[0-9][0-9]|[0-2][0-9][0-9]|3[0-4][0-9])\n/, `${where}: a job timeout shorter than the wait`);
  }
  assert.ok(statSync(new URL('scripts/serviceWait.sh', ROOT)).mode & 0o100, 'the step runs the file itself: it is executable');
  // the site's wait reads the release it publishes, and its checkout holds every file the script reads - run in a tree
  // holding those alone
  const checkout = site.slice(site.indexOf('- name: The release\'s tree, for what it waits on\n'), site.indexOf(STEP));
  assert.match(checkout, /\n {10}ref: \$\{\{ needs\.release\.outputs\.sha \}\}\n/, 'the release this run verified and built');
  assert.match(checkout, /\n {10}sparse-checkout-cone-mode: false\n/, 'files by their paths, not cones of directories');
  const sparse = /\n {10}sparse-checkout: \|\n((?: {12}\S+\n)+)/.exec(checkout)?.[1].trim().split(/\s+/) ?? [];
  assert.ok(sparse.includes('scripts/serviceWait.sh'), 'the script itself');
  const tree = mkdtempSync(join(tmpdir(), 'a0929-tree-'));
  for (const f of sparse) {
    mkdirSync(join(tree, dirname(f)), { recursive: true });
    copyFileSync(new URL(f, ROOT), join(tree, f));
  }

  // THE SCRIPT, as its step runs it. What it waits for is read off the tree: the versions and both hosts.
  const relayAt = `${DEFAULT_SERVER.replace(/^wss:\/\//, 'https://')}/health`;
  const accountAt = `${DEFAULT_ACCOUNT_SERVICE}/v1/health`;
  const bump = (v, d) => v.replace(/\d+$/, (n) => String(Number(n) + d));
  const R = (d) => JSON.stringify({ ok: true, service: 'daggerfall-online', version: bump(RELAY_VERSION, d), t: 1 });
  const S = (d) => JSON.stringify({ ok: true, v: bump(ACCOUNT_VERSION, d) });
  const now = serviceWait({ relay: [R(0)], account: [S(0)] }, { tree });
  assert.equal(now.status, 0, now.out);
  assert.deepEqual(now.asked.map((a) => a.url), [relayAt, accountAt], 'both serving it already: one request each, to the hosts the tree names - in the site\'s sparse tree');
  // the account service (T2): an old one and a silent one waited through; a later one serves this build too
  const svc = serviceWait({ relay: [R(0)], account: [S(-1), '', S(0)] });
  assert.deepEqual([svc.status, svc.asked.filter((a) => a.url === accountAt).length], [0, 3], `waited through an old service and a silent one: ${svc.out}`);
  assert.equal(serviceWait({ relay: [R(0)], account: [S(1)] }).status, 0, 'a later service serves this build too');
  // the relay (A6): the same
  const rel = serviceWait({ relay: [R(-1), '', R(0)], account: [S(0)] });
  assert.deepEqual([rel.status, rel.asked.filter((a) => a.url === relayAt).length], [0, 3], `waited through an old relay and a silent one: ${rel.out}`);
  assert.equal(serviceWait({ relay: [R(1)], account: [S(0)] }).status, 0, 'a later relay serves this build too');

  // EITHER ONE THAT NEVER COMES: nothing is published - and the budget is the CLOCK's (AUDIT RELEASE-FLOW A6: it was a
  // count of asks, which slow answers carried past the job's ceiling). Asks 2091 seconds slow end the fifth round ten
  // seconds inside the budget, where a sixth would start past it: five rounds, and nothing slept after the last.
  const budget = Number(/^deadline=\$\(\( \$\(date \+%s\) \+ (\d+) \)\)$/m.exec(script)?.[1]);
  const pause = Number(/^ +sleep (\d+)$/m.exec(script)?.[1]);
  const LAG = 2091;
  for (const [what, answers] of [['relay', { relay: [R(-1)], account: [S(0)] }], ['account service', { relay: [R(0)], account: [S(-1)] }]]) {
    const never = serviceWait(answers, { lag: LAG });
    assert.equal(never.status, 1, `a ${what} that never came: nothing is published - ${never.out}`);
    assert.match(never.out, /::error::the relay and the account service never came to serve/, 'and it says why');
    const rounds = never.asked.filter((a) => a.url === relayAt).map((a) => a.t);
    assert.deepEqual(never.asked.map((a) => a.url), rounds.flatMap(() => [relayAt, accountAt]), `each round asks both (${what})`);
    assert.deepEqual(rounds, [0, 1, 2, 3, 4].map((k) => T0 + k * (2 * LAG + pause)), `one round a pause apart (${what})`);
    assert.ok(rounds.at(-1) < T0 + budget, 'no round starts past the budget');
    assert.ok(rounds.at(-1) + 2 * LAG + pause >= T0 + budget, 'and none is left unasked before it');
    assert.equal(never.end, rounds.at(-1) + 2 * LAG, 'nothing slept after the last');
  }
  // a tree it cannot read is no version at all: nothing asked, nothing published
  const bare = mkdtempSync(join(tmpdir(), 'a0929-bare-'));
  mkdirSync(join(bare, 'scripts'));
  copyFileSync(new URL('scripts/serviceWait.sh', ROOT), join(bare, 'scripts/serviceWait.sh'));
  const blind = serviceWait({ relay: [R(0)], account: [S(0)] }, { tree: bare });
  assert.deepEqual([blind.status, blind.asked], [1, []], 'a tree without the versions publishes nothing');
  assert.match(blind.out, /::error::could not read relay_want off the tree/);

  // PIN MOVED (DEPLOY-WAIT, 2026-10-17): 90 asks, thirty minutes, gave up on #983's site six minutes before its service
  // came - the service waits up to five and a half hours on the relay. Now as long as that chain may take, and no longer
  // than a job may run: the budget, the last round's two asks at their longest, and five minutes to publish.
  const acct = read('.github/workflows/account-deploy.yml');
  const relayWait = runBlock(acct, 'Wait for the relay to serve this release\'s version');
  const relayS = Number(/for i in \$\(seq 1 (\d+)\); do/.exec(relayWait)?.[1]) * Number(/\n\s+sleep (\d+)\n/.exec(relayWait)?.[1]);
  const asks = [...script.matchAll(/curl -fsS --max-time (\d+) /g)].map((m) => Number(m[1]));
  assert.equal(asks.length, 2, 'two asks a round, each bounded');
  assert.equal(budget, 21000, 'five hours fifty minutes of waiting');
  assert.ok(relayS > 0, 'the account deploy\'s own wait read');
  assert.ok(budget >= relayS + 10 * 60, `the wait outlasts the service's own wait on the relay, and ten minutes of its deploy and checks (${budget} s against ${relayS} s)`);
  assert.ok(budget + asks[0] + asks[1] + 5 * 60 <= 360 * 60, `and its last round ends with five minutes to publish inside GitHub's six-hour job ceiling (${budget} s)`);
});

// ── THE SERVICE ─────────────────────────────────────────────────────

const MIGRATIONS = readdirSync(new URL('server-account/migrations/', ROOT)).filter((f) => f.endsWith('.sql')).sort();
function service() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(read(`server-account/migrations/${f}`));
  const DB = {
    prepare(sql) {
      const stmt = db.prepare(sql); let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return api;
    },
  };
  const env = { DB, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (path, body) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env);
    return { status: res.status, body: await res.json() };
  };
  return { call, rows: () => db.prepare('SELECT * FROM players').all() };
}

test('AUDIT PRE-MERGE 0929 T1: a game from before the boxes is told it may need updating, in a word it already renders - it said "the account service had a problem" at every press, and the desktop app\'s reload brings back the same bundled game (mutants: the bare request answered terms-unaccepted; a half-ticked one answered not-found)', async () => {
  const { call, rows } = service();
  // what every build before TERMS1 sends (openGuest's `{ label }`)
  const old = await call('/v1/auth/guest', { label: null });
  assert.deepEqual([old.status, old.body], [400, { error: 'not-found' }]);
  assert.match(accountRefusalText(old.body.error), /The game may need updating\./, 'the sentence every shipped build carries for the word');
  assert.match(REFUSALS['not-found'], /may need updating/);
  // a half-ticked or malformed agreement is still the form's own refusal, and a dated one still stale
  assert.deepEqual((await call('/v1/auth/guest', { terms: TERMS_VERSION })).body, { error: 'terms-unaccepted' });
  assert.deepEqual((await call('/v1/auth/guest', { terms: null, privacy: null })).body, { error: 'terms-unaccepted' });
  assert.deepEqual((await call('/v1/auth/guest', { terms: '2000-01-01', privacy: '2000-01-01' })).body, { error: 'terms-stale' });
  assert.equal(rows().length, 0, 'a refused request wrote a row');
  assert.equal((await call('/v1/auth/guest', { label: 'x', ...ACCEPTED })).status, 200);
  // the stale sentence names the desktop app's way too - a reload there loads the same bundled game
  assert.match(REFUSALS['terms-stale'], /[Rr]eload the game \(or update the app\)/);
});

test('AUDIT PRE-MERGE 0929 T1: the form never sends the bare request the service now answers as an old game - a press with a box unticked asks nothing', async () => {
  const calls = [];
  const flow = AccountFlow({ io: { fetch: async (url) => { calls.push(url); throw new Error('asked'); } }, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  flow.go('register');
  flow.set('handle', 'Nystul'); flow.set('password', 'a good long one'); flow.set('confirm', 'a good long one');
  flow.agree('terms', true);
  assert.equal(await flow.submit(), false);
  assert.equal(flow.error, LOCAL_REFUSALS['privacy-unticked']);
  assert.equal(calls.length, 0);
});

// ── THE CARD ────────────────────────────────────────────────────────

/** The smallest document with a keyboard: a focus that follows `focus()`, and falls to the body when its node is taken
 *  off the card (as a browser's does). */
function focusDoc() {
  const doc = { activeElement: null, body: { tag: 'body' }, documentElement: { tag: 'html' } };
  doc.activeElement = doc.body;
  const mk = (tag) => {
    const n = {
      tag, className: '', type: null, value: '', checked: false, disabled: false, href: null, target: null, rel: null,
      selectionStart: null, selectionEnd: null, children: [], parent: null,
      append: (...kids) => { for (const k of kids.filter(Boolean)) { k.parent = n; n.children.push(k); } },
      focus() { if (!n.disabled) doc.activeElement = n; },
      setSelectionRange(a, b) { n.selectionStart = a; n.selectionEnd = b; },
      get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
    };
    Object.defineProperty(n, 'textContent', {
      get() { return n._txt ?? null; },
      set(v) {
        n._txt = v;
        if (v === '') {
          if (n.children.some((c) => c.all.includes(doc.activeElement))) doc.activeElement = doc.body;
          n.children.length = 0;
        }
      },
    });
    return n;
  };
  doc.createElement = mk;
  return doc;
}

const cardWithKeys = (fetch = async () => { throw new Error('offline'); }) => {
  const doc = focusDoc();
  let card = null;
  const flow = AccountFlow({ io: { fetch }, storage: { getItem: () => null, setItem() {}, removeItem() {} }, onChange: () => card?.paint() });
  card = accountCard(doc, flow);
  flow.go('register');
  return { doc, flow, card, find: (pred) => card.root.all.find(pred) };
};

test('AUDIT PRE-MERGE 0929 T3: a keystroke that clears a refusal keeps its field and its caret - after "Type your username" the rest of "Nystul" went nowhere but its N (mutants: no focus kept; the caret dropped; the focus kept across a change of stage)', async () => {
  const { doc, flow, find } = cardWithKeys();
  await flow.submit();
  assert.equal(flow.error, LOCAL_REFUSALS['handle-empty']);
  let input = find((n) => n.acctKey === 'field:handle');
  input.focus();
  // the browser's order: the value and the caret move, then `input` fires
  input.value = 'N'; input.setSelectionRange(1, 1);
  input.oninput();
  assert.equal(flow.error, '', 'the keystroke cleared the refusal - and repainted the card');
  const now = doc.activeElement;
  assert.notEqual(now, input, 'the redraw built the field anew');
  assert.equal(now.acctKey, 'field:handle', `the keyboard fell to ${now.tag}`);
  assert.deepEqual([now.selectionStart, now.selectionEnd], [1, 1], 'the caret went back to the start');
  // the rest of the name lands in the field the keyboard is on
  for (const ch of 'ystul') { const f = doc.activeElement; f.value += ch; f.setSelectionRange(f.value.length, f.value.length); f.oninput(); }
  assert.equal(flow.values.handle, 'Nystul');
  // a new stage is a new card: nothing is focused into it
  flow.go('login');
  assert.equal(doc.activeElement, doc.body);
});

test('AUDIT PRE-MERGE 0929 T3: a tick that clears the boxes\' refusal keeps the box - its one answer left the next Tab on Username - and a press the redraw disabled gets the focus back after it (mutants: the box\'s key dropped; a disabled control focused; the kept focus forgotten while the press is out)', async () => {
  const { doc, flow, find } = cardWithKeys();
  flow.set('handle', 'Nystul'); flow.set('password', 'a good long one'); flow.set('confirm', 'a good long one');
  await flow.submit();
  assert.equal(flow.error, LOCAL_REFUSALS['terms-unticked']);
  const box = find((n) => n.acctKey === 'agree:terms');
  box.focus();
  box.checked = true; box.onchange();
  assert.equal(flow.error, '');
  assert.equal(doc.activeElement.acctKey, 'agree:terms', 'the tick left the box');
  assert.equal(doc.activeElement.checked, true);
  // the press: its button is disabled while the request is out, and has the focus back when it answers
  let answer;
  const { doc: d2, flow: f2, find: find2 } = cardWithKeys(() => new Promise((res) => { answer = res; }));
  f2.set('handle', 'Nystul'); f2.set('password', 'a good long one'); f2.set('confirm', 'a good long one');
  f2.agree('terms', true); f2.agree('privacy', true);
  const press = find2((n) => n.acctKey === 'act:submit');
  press.focus();
  const out = f2.submit();
  const busy = find2((n) => n.acctKey === 'act:submit');
  assert.equal(busy.disabled, true);
  assert.equal(d2.activeElement, d2.body, 'a disabled button holds no focus');
  answer({ ok: false, status: 400, json: async () => ({ error: 'handle-taken' }) });
  await out;
  assert.equal(f2.error, REFUSALS['handle-taken']);
  assert.equal(d2.activeElement.acctKey, 'act:submit', 'the press never had the keyboard back');
  assert.equal(d2.activeElement.disabled, false);
});
