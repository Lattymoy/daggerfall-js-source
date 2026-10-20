// HANDLE-EMAIL (2026-10-11, the owner: "ban account names as email"). The handle is the name the world reads - the
// token's `n`, every roster, every home's owner - so a player who typed their address into the Username field published it
// to everyone they met. A handle carrying an `@` is refused at registration (server-account/src/accounts.js
// handleRefusal, `handle-email`) and at the form before it is sent (ui/accountFlow.js); one chosen before still signs in
// by it, and the world reads its guest name in its place (displayName) - while the player's own account card still shows
// them the handle they sign in with. On the real Worker over the real migrations (test/accountDb.mjs). Each pin failed
// on the build before it. tools/mutants/handleemail.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleLooksLikeEmail } from '../../src/net/handleShape.js';
import { REFUSALS, DEFAULT_ACCOUNT_SERVICE } from '../../src/net/accountClient.js';
import { AccountFlow } from '../../src/ui/accountFlow.js';
import { displayName, handleRefusal } from '../../server-account/src/accounts.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';
import { standService } from '../accountDb.mjs';

test('HANDLE-EMAIL the law: a handle with an `@` is an address and refused as one - `handle-email`, after its shape, with a sentence of its own; a handle without one is a name (mutants: the law, the refusal, its order)', () => {
  for (const h of ['olga@mail.com', 'Olga@home', 'a@b']) assert.equal(handleLooksLikeEmail(h), true, h);
  for (const h of ['Olga', 'Ser-Kithlan', 'RookieG(Dev)', 'mail.com', '', null, 42]) assert.equal(handleLooksLikeEmail(h), false, String(h));
  assert.equal(handleRefusal('olga@mail.com'), 'email');
  assert.equal(handleRefusal('Olga@home'), 'email');
  assert.equal(handleRefusal('@olga'), 'shape', 'a handle starts with a letter: its shape first');
  assert.equal(handleRefusal('Nystul'), null);
  assert.match(REFUSALS['handle-email'], /cannot be an email address, because other players see it/);
  assert.match(REFUSALS['handle-email'], /cannot be an email address/);   // PIN MOVED (VOICE2): no dash aside (Voice.md rule 5)
});

test('HANDLE-EMAIL registration: an address offered as a username is refused and nothing is written - the guest stays a guest; a name is taken (mutants: the refusal)', async () => {
  const svc = await standService();
  const g = (await svc.call('/v1/auth/guest', { ...ACCEPTED })).body;
  const r = await svc.call('/v1/auth/register', { handle: 'olga@mail.com', password: 'a good long one', ...ACCEPTED }, g.secret);
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.equal(r.body.error, 'handle-email');
  assert.equal(svc.env.DB._raw.prepare('SELECT handle FROM players WHERE id = ?').get(g.id).handle, null, 'still a guest');
  const ok = await svc.call('/v1/auth/register', { handle: 'Olga', password: 'a good long one', ...ACCEPTED }, g.secret);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
});

test('HANDLE-EMAIL an address chosen before: it still signs in by it, the world reads the guest name in its place - the token\'s name, the login\'s - and the player\'s own card still shows the handle (mutants: displayName unguarded)', async () => {
  const svc = await standService();
  const who = await svc.registered('Olga');
  const raw = svc.env.DB._raw;
  raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run('olga@mail.com', 'olga@mail.com', who.id);
  const guestName = raw.prepare('SELECT guest_name FROM players WHERE id = ?').get(who.id).guest_name;
  assert.equal(displayName({ handle: 'olga@mail.com', guest_name: guestName }), guestName);
  assert.equal(displayName({ handle: 'Olga', guest_name: guestName }), 'Olga', 'a name is read as it is');
  const login = await svc.call('/v1/auth/login', { handle: 'olga@mail.com', password: 'a good long one' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.equal(login.body.name, guestName, 'signed in, named by the guest name');
  assert.equal(login.body.kind, 'linked', 'and still an account, never a guest again');
  const tok = await svc.call('/v1/auth/token', {}, login.body.secret);
  assert.equal(tok.status, 200, JSON.stringify(tok.body));
  assert.equal(tok.body.name, guestName, 'the name every other player is handed');
  const view = await svc.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${login.body.secret}` } });
  const card = (await view.json()).account;
  assert.equal(card.handle, 'olga@mail.com', 'the card shows its owner the handle they sign in with');
  assert.equal(card.name, guestName);
});

test('HANDLE-EMAIL the form: an address typed as a new username is refused before any request, in the service\'s own sentence; signing in by one chosen before is never refused here (mutants: the form unasked, the sign-in refused)', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    const path = url.replace(DEFAULT_ACCOUNT_SERVICE, '').replace(/^https?:\/\/[^/]+/, '');
    calls.push(path);
    if (path === '/v1/auth/login') return { ok: false, status: 401, json: async () => ({ error: 'bad-login' }) };
    throw new Error(`no answer for ${path}`);
  };
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const flow = AccountFlow({ io: { fetch }, storage });
  await flow.start();
  flow.go('register');
  for (const [k, v] of Object.entries({ handle: 'olga@mail.com', password: 'correcthorse', confirm: 'correcthorse' })) flow.set(k, v);
  for (const box of ['terms', 'privacy']) flow.agree(box, true);
  await flow.submit();
  assert.equal(flow.error, REFUSALS['handle-email']);
  assert.equal(flow.stage, 'register');
  assert.deepEqual(calls, [], 'no round trip to learn it');
  flow.go('login');
  flow.set('handle', 'olga@mail.com');
  flow.set('password', 'correcthorse');
  await flow.submit();
  assert.deepEqual(calls, ['/v1/auth/login'], 'a sign-in by it is asked');
});
