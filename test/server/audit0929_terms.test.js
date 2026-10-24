// AUDIT PRE-MERGE 0929 (2026-09-29, Mac: "Audit this") - TERMS1's half: the deploy that asks the service as a player
// does, the site that waits for the service its forms ask, a game from before the boxes told the truth, and a keyboard
// that survives the card's redraw. The record: bible/01-Overview/audits/Audit-PreMerge-0929.md.
//
// Each test failed on the unfixed tree for its finding's reason: the smoke's guest opened with a label alone (T-CI), a
// deploy job that published with nothing waited on (T2), a bare request answered `terms-unaccepted` - a word no game
// from before TERMS1 has a sentence for (T1) - and a card whose repaint left the focus on nothing (T3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { TERMS_VERSION, PRIVACY_VERSION, ACCEPTED } from '../../src/net/legalLaw.js';
import { AccountFlow, LOCAL_REFUSALS } from '../../src/ui/accountFlow.js';
import { accountCard } from '../../src/ui/enhanced/enhancedAccount.js';
import { DEFAULT_ACCOUNT_SERVICE, REFUSALS, accountRefusalText } from '../../src/net/accountClient.js';
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

test('AUDIT PRE-MERGE 0929 T2: the site is published only once the account service serves the version its forms need - a site ahead of its service named accounts whose rows say "never asked" for players who ticked both boxes (mutants: no wait; the wait after the publish; an older service taken; the loop that never fails)', () => {
  const yml = read('.github/workflows/deploy.yml');
  // what the tree needs, read by the site job's own step - run here as the runner runs it (from the checkout)
  const outFile = join(mkdtempSync(join(tmpdir(), 'a0929-')), 'out');
  writeFileSync(outFile, '');
  const r = bash(runBlock(yml, 'Read the account service this build talks to'), { GITHUB_OUTPUT: outFile });
  assert.equal(r.status, 0, r.stderr);
  const outs = Object.fromEntries(readFileSync(outFile, 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  assert.deepEqual(outs, { version: ACCOUNT_VERSION, base: DEFAULT_ACCOUNT_SERVICE });
  assert.match(yml, /account_version: \$\{\{ steps\.account\.outputs\.version \}\}/);
  assert.match(yml, /account_base: \$\{\{ steps\.account\.outputs\.base \}\}/);
  // the deploy job waits BEFORE it publishes
  const deployJob = yml.slice(yml.indexOf('\n  deploy:\n'));
  const wait = deployJob.indexOf('- name: Wait for the account service to serve this build\'s version');
  assert.ok(wait > 0 && wait < deployJob.indexOf('actions/deploy-pages'), 'the site is published before the service is asked');
  assert.match(deployJob, /WANT: \$\{\{ needs\.site\.outputs\.account_version \}\}/);
  assert.match(deployJob, /BASE: \$\{\{ needs\.site\.outputs\.account_base \}\}/);
  // the loop itself, over a service that answers as the real one does (`{ ok, v }`, index.js /v1/health)
  const loop = runBlock(deployJob, 'Wait for the account service to serve this build\'s version');
  const against = (answers, { upto = 0 } = {}) => {
    // each ask runs in the $( ) subshell the step puts it in, so the stub counts its asks in a file, not a variable;
    // `upto` cuts the loop's `seq` short (DEPLOY-WAIT: 1050 asks of stubs cost the suite twelve seconds) - the count
    // itself is read off the source below
    const script = `A=(${answers.map((a) => `'${a}'`).join(' ')})
curl() { local i; i=$(wc -l < "$CALLS"); echo "$*" >> "$CALLS"; local a="\${A[$i]-\${A[-1]}}"; [ -n "$a" ] && printf '%s' "$a"; return 0; }
sleep() { :; }
${upto ? `seq() { command seq 1 ${upto}; }\n` : ''}${loop}`;
    const calls = join(mkdtempSync(join(tmpdir(), 'a0929-')), 'calls');
    writeFileSync(calls, '');
    const res = bash(script, { WANT: 'acct20', BASE: 'https://svc.invalid', CALLS: calls });
    return { status: res.status, asked: readFileSync(calls, 'utf8').trim().split('\n').filter(Boolean) };
  };
  const now = against(['{"ok":true,"v":"acct20"}']);
  assert.deepEqual([now.status, now.asked.length], [0, 1], 'a service already serving it: one request');
  assert.match(now.asked[0], /https:\/\/svc\.invalid\/v1\/health/);
  assert.deepEqual([against(['{"ok":true,"v":"acct19"}', '', '{"ok":true,"v":"acct20"}']).status], [0], 'waited through an old service and a silent one');
  assert.equal(against(['{"ok":true,"v":"acct21"}']).status, 0, 'a later service serves this build too');
  const never = against(['{"ok":true,"v":"acct19"}'], { upto: 3 });
  assert.equal(never.status, 1, 'a service that never came: the site is not published');
  assert.equal(never.asked.length, 3, 'one ask a turn, and none after the last');
  // PIN MOVED (DEPLOY-WAIT, 2026-10-17): 90 asks, thirty minutes, gave up on #983's site six minutes before its service
  // came - the service waits up to five and a half hours on the relay. Now as long as that chain may take, and no longer
  // than a job may run.
  const asks = (src, name) => Number(/for i in \$\(seq 1 (\d+)\); do/.exec(runBlock(src, name))?.[1]);
  const pause = (src, name) => Number(/\n\s+sleep (\d+)\n/.exec(runBlock(src, name))?.[1]);
  const siteS = asks(deployJob, 'Wait for the account service to serve this build\'s version') * pause(deployJob, 'Wait for the account service to serve this build\'s version');
  const acct = read('.github/workflows/account-deploy.yml');
  const relayS = asks(acct, 'Wait for the relay to serve this push\'s version') * pause(acct, 'Wait for the relay to serve this push\'s version');
  assert.equal(asks(deployJob, 'Wait for the account service to serve this build\'s version'), 1050, 'five hours fifty minutes of asking');
  assert.ok(relayS > 0 && siteS > 0, 'both waits read');
  assert.ok(siteS >= relayS + 10 * 60, `the site outwaits the service's own wait on the relay, and ten minutes of its deploy and checks (${siteS} s against ${relayS} s)`);
  assert.ok(siteS + 5 * 60 <= 360 * 60, `and leaves five minutes to publish inside GitHub's six-hour job ceiling (${siteS} s)`);
  assert.doesNotMatch(yml.slice(yml.indexOf('\n  deploy:\n')), /timeout-minutes:\s*([0-9]|[0-9][0-9]|[0-2][0-9][0-9]|3[0-4][0-9])\n/, 'no job timeout shorter than the wait');
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
