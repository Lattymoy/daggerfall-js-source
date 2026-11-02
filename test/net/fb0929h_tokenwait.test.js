// FIELD BUGS 2026-09-29h (TOKEN-WAIT) - "I'm stuck in a perpetual 'World: Sign in to play online' & 'World: Connecting'
// state... I am currently updated."
//
// "sign in to play online" is the RELAY's refusal of a hello with no token (server/src/index.js _named, ACC1g - the wall
// at the door). A session mints a token as its socket opens and waits TOKEN_WAIT_MS for it; ACC1d set that at 2.5 s when
// an unsigned hello was still admitted ("a connection that works"). ACC1g made it a refusal and left the budget, so a
// token route slower than 2.5 s - eight D1 round trips from the player's edge and a preflighted POST to a second host -
// was a hello refused every time, the World link's thirty-second rejoin met it again, and the World line swung between
// "connecting" and "sign in to play online" for as long as the page stood.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OnlineSession, TOKEN_WAIT_MS } from '../../src/net/online.js';
import { HELLO_WAIT_MS } from '../../src/net/wire.js';

const RELAY = readFileSync(new URL('../../server/src/index.js', import.meta.url), 'utf8');
const TOKEN = `v1.${'a'.repeat(120)}.${'b'.repeat(86)}`;

function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
  }
  return { FakeWS, sockets };
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const session = (over) => new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', now: () => 1_700_000_000_000, ...over });

test('TOKEN-WAIT: the premise - the relay refuses a hello with no token, so an unsigned hello is no connection', () => {
  assert.match(RELAY, /\n {4}if \(!m\.tok\) return \{ error: 'sign in to play online' \};\n/, 'ACC1g\'s wall at the door');
});

test('TOKEN-WAIT: a token that takes three seconds rides the hello - the report\'s loop, closed (mutant: the 2.5 s budget)', async () => {
  const warned = [];
  const warn = mock.method(console, 'warn', (m) => { warned.push(String(m)); });
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { FakeWS, sockets } = fakeSocketClass();
    let answer = null;
    const s = session({ WebSocketImpl: FakeWS, mintToken: () => new Promise((r) => { answer = r; }) });
    s.join('world:0,0');
    sockets[0].open();
    await settle();
    mock.timers.tick(3000);   // a slow service's answer, past ACC1d's 2.5 s
    await settle();
    assert.equal(sockets[0].sent.length, 0, 'still waiting for the token - not an unsigned hello the relay refuses');
    answer(TOKEN);
    await settle();
    assert.equal(sockets[0].sent.length, 1, 'the hello');
    assert.equal(sockets[0].sent[0].tok, TOKEN, 'signed');
    assert.deepEqual(warned, [], 'nothing to say');
  } finally { mock.timers.reset(); warn.mock.restore(); }
});

test('TOKEN-WAIT: past the budget the hello still goes, and the console says why it will be refused; the budget stays under the relay\'s wait for a hello', async () => {
  assert.ok(TOKEN_WAIT_MS < HELLO_WAIT_MS, 'a full room closes a silent socket at HELLO_WAIT_MS (server/src/index.js _unseatSilent)');
  const warned = [];
  const warn = mock.method(console, 'warn', (m) => { warned.push(String(m)); });
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = session({ WebSocketImpl: FakeWS, mintToken: () => new Promise(() => {}) });
    s.join('world:0,0');
    sockets[0].open();
    await settle();
    mock.timers.tick(TOKEN_WAIT_MS);
    await settle();
    assert.equal(sockets[0].sent.length, 1, 'the hello goes');
    assert.equal('tok' in sockets[0].sent[0], false);
    assert.equal(warned.length, 1);
    assert.match(warned[0], /^\[online\] no identity token within 8000 ms/);
  } finally { mock.timers.reset(); warn.mock.restore(); }
});

test('TOKEN-WAIT: the minter says why it has no token - no sign-in on this device, or the service\'s own refusal', async () => {
  const { accountTokenMinter, SESSION_KEY } = await import('../../src/net/accountClient.js');
  const storage = (seed) => { const m = new Map(seed ? [[SESSION_KEY, JSON.stringify(seed)]] : []); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const warned = [];
  const warn = mock.method(console, 'warn', (m) => { warned.push(String(m)); });
  try {
    const fetch = async () => ({ ok: false, status: 503, json: async () => ({ error: 'maintenance' }) });
    assert.equal(await accountTokenMinter({ fetch, storage: storage(null) })(), null);
    assert.equal(await accountTokenMinter({ fetch, storage: storage({ id: 'acct-1', name: 'Mac', kind: 'linked', sessionId: 's-1', secret: 'sekrit-of-mac' }) })(), null);
  } finally { warn.mock.restore(); }
  assert.deepEqual(warned, ['[account] no identity token: no sign-in stored on this device', '[account] no identity token: maintenance (503)']);
});
