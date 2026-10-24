// ADMIT-LINE (2026-10-11, Mac: "I think the issue is so many people logging in at once. We need to implement a queue
// system"): THE SIGN-IN LINE (server-account/src/admit.js). The doors a sign-in knocks at take a place in one line the
// whole service shares, let in ADMIT_RATE a second, first come first served; the rest are told their place and when to
// ask again (503 `queue`), and never touch the database. By execution over the real line and the real Worker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  admitLine, admitAsk, admitWait, AdmitGate, ADMIT_ROUTES, ADMIT_RATE, ADMIT_BURST, ADMIT_PASS_MS, ADMIT_KEEP_MS,
  ADMIT_WAIT_MIN_MS, ADMIT_WAIT_MAX_MS,
} from '../../server-account/src/admit.js';
import service, { AdmitGate as Exported } from '../../server-account/src/index.js';

test('ADMIT-LINE: a quiet line lets a burst in at once, then holds the rest in order with their place and wait', () => {
  const line = admitLine();
  const t0 = 1_000_000;
  for (let i = 0; i < ADMIT_BURST; i++) assert.deepEqual(admitAsk(line, `a${i}`, t0), { go: true }, `burst ${i}`);
  const first = admitAsk(line, 'late1', t0);
  const second = admitAsk(line, 'late2', t0);
  assert.equal(first.go, false);
  assert.equal(first.position, 1);
  assert.equal(second.position, 2);
  assert.ok(first.wait >= ADMIT_WAIT_MIN_MS && first.wait <= ADMIT_WAIT_MAX_MS);
  assert.ok(second.wait >= first.wait);
  // the head moves ADMIT_RATE a second: one second on, the first in line goes in, in its order
  assert.deepEqual(admitAsk(line, 'late1', t0 + 1000 / ADMIT_RATE), { go: true });
  assert.equal(admitAsk(line, 'late2', t0 + 1000 / ADMIT_RATE).position, 1);
});

test('ADMIT-LINE: an address asking again keeps its ticket - a newcomer never jumps it', () => {
  const line = admitLine();
  const t0 = 5_000_000;
  for (let i = 0; i < ADMIT_BURST; i++) admitAsk(line, `a${i}`, t0);
  const mine = admitAsk(line, 'me', t0);
  for (let i = 0; i < 10; i++) admitAsk(line, `n${i}`, t0);
  assert.equal(admitAsk(line, 'me', t0).position, mine.position, 'asked again: the same place');
  assert.equal(admitAsk(line, 'n0', t0).position, mine.position + 1, 'the next behind it');
});

test('ADMIT-LINE: let in, an address passes for ADMIT_PASS_MS (one sign-in is one wait); a place unasked for ADMIT_KEEP_MS is let go', () => {
  const line = admitLine();
  const t0 = 9_000_000;
  assert.deepEqual(admitAsk(line, 'me', t0), { go: true });
  for (let i = 0; i < ADMIT_BURST * 2; i++) admitAsk(line, `x${i}`, t0);
  assert.deepEqual(admitAsk(line, 'me', t0 + 1), { go: true }, 'the mint after the guest row: no second wait');
  const held = admitAsk(line, 'gone', t0 + 2);
  assert.equal(held.go, false);
  admitAsk(line, 'other', t0 + ADMIT_KEEP_MS + ADMIT_PASS_MS + 20_000);   // the sweep runs
  assert.equal(line.places.has('gone'), false, 'a place nobody asked about is forgotten');
  assert.equal(line.passes.has('me'), false, 'a pass past its time is forgotten');
});

test('ADMIT-LINE: the gate fails open - no binding, a throw, or no answer lets the caller in', async () => {
  assert.equal(await admitWait({}, 'k'), null);
  assert.equal(await admitWait({ ADMIT: { idFromName: () => { throw new Error('down'); } } }, 'k'), null);
  const answering = (/** @type {any} */ body) => ({ idFromName: () => 'id', get: () => ({ fetch: async () => ({ json: async () => body }) }) });
  assert.equal(await admitWait({ ADMIT: answering({ go: true }) }, 'k'), null);
  assert.deepEqual(await admitWait({ ADMIT: answering({ go: false, position: 7, wait: 1400 }) }, 'k'), { position: 7, wait: 1400 });
  // the Durable Object answers the pure line's word
  const gate = new AdmitGate({}, {});
  const res = await gate.fetch(new Request('https://admit/ask', { method: 'POST', body: JSON.stringify({ key: 'k' }) }));
  assert.deepEqual(await res.json(), { go: true });
  assert.equal(Exported, AdmitGate, 'index.js exports the class wrangler binds');
});

test('ADMIT-LINE: the Worker answers a held sign-in 503 `queue` with its place, before the database is asked', async () => {
  assert.deepEqual([...ADMIT_ROUTES].sort(), ['/v1/auth/guest', '/v1/auth/login', '/v1/auth/recover', '/v1/auth/session', '/v1/auth/token']);
  let asked = 0;
  const DB = new Proxy({}, { get: () => { asked++; throw new Error('the database was asked'); } });
  const ADMIT = { idFromName: () => 'id', get: () => ({ fetch: async () => ({ json: async () => ({ go: false, position: 42, wait: 8400 }) }) }) };
  const env = { DB, ADMIT, ACCOUNT_VERSION: 'test' };
  const res = await service.fetch(new Request('https://acct.test/v1/auth/guest', {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' }, body: '{}',
  }), env);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: 'queue', position: 42, wait: 8400 });
  assert.equal(res.headers.get('retry-after'), '9');
  assert.equal(asked, 0, 'a held sign-in costs the database nothing');
  // health is never in the line
  const health = await service.fetch(new Request('https://acct.test/v1/health'), env);
  assert.equal(health.status, 200);
});

test('ADMIT-LINE: wrangler binds the line to the class index.js exports, SQLite-backed', () => {
  const toml = readFileSync(new URL('../../server-account/wrangler.toml', import.meta.url), 'utf8');
  assert.match(toml, /\[\[durable_objects\.bindings\]\]\nname = "ADMIT"\nclass_name = "AdmitGate"/);
  assert.match(toml, /\[\[migrations\]\]\ntag = "admit1"\nnew_sqlite_classes = \["AdmitGate"\]/);
});
