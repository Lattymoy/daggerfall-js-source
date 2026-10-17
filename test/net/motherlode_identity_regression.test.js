import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMotherlodeBook, MOTHERLODE_ME_MS } from '../../src/net/motherlodeBook.js';
import { mintWatchReceipt } from '../../src/net/watchReceipt.js';

test('Motherlodes: a pending response cannot become the next account\'s state', async () => {
  let account = 'account-a';
  let finish;
  let calls = 0;
  const book = createMotherlodeBook({
    character: () => 'char-shared', me: () => account, nowS: () => 1800000000, nowMs: () => 1000,
    door: { motherlodes: () => { calls++; return new Promise(resolve => { finish = resolve; }); } },
  });
  const pending = book.read();
  account = 'account-b';
  finish({ ok: true, data: { day: 20833, lodes: [], found: 'mlode:20833:0' } });
  await pending;
  assert.equal(book.found(), null, 'discard the departed account\'s found marker');
  book.tick();
  assert.equal(calls, 2, 'the current account gets its own read immediately');
  finish({ ok: true, data: { day: 20833, lodes: [], found: null } });
  await Promise.resolve();
});

test('Motherlodes: a pending response cannot become the next character\'s state', async () => {
  let character = 'char-a';
  let finish;
  const book = createMotherlodeBook({
    character: () => character, me: () => 'account-a', nowS: () => 1800000000, nowMs: () => 1000,
    door: { motherlodes: () => new Promise(resolve => { finish = resolve; }) },
  });
  const pending = book.read();
  character = 'char-b';
  finish({ ok: true, data: { day: 20833, lodes: [], found: 'mlode:20833:0' } });
  await pending;
  assert.equal(book.found(), null);
});

test('Motherlodes: a Watch action checks account identity even within the frame cache interval', async () => {
  let account = 'account-a';
  const now = 1800000000;
  const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const receipt = await mintWatchReceipt({ s: account, x: 300, y: 120, c: 1 }, keys.privateKey, { subtle: crypto.subtle, nowS: now });
  const book = createMotherlodeBook({
    character: () => 'char-a', me: () => account, nowS: () => now, nowMs: () => 1000,
    door: { motherlodes: async () => ({ ok: true, data: {} }) },
  });
  assert.equal(book.watch(receipt), true);
  account = 'account-b';
  assert.equal(book.watchFor(300, 120, 0), null, 'do not submit account A\'s receipt while B is signed in');
  assert.equal(book.watch(receipt), false);
});

for (const failure of ['offline', 'auth', 'throw']) {
  test(`Motherlodes: cached marker clears across account switch with ${failure} refresh`, async () => {
    let account = 'account-a', fail = false, ms = 1000, meCalls = 0, asking = false;
    const now = 1800000000, day = Math.floor(now / 86400);
    const lode = { key: `mlode:${day}:0`, x: 300, y: 120, opensAt: now - 1, closesAt: now + 3600, struck: 0 };
    const changes = [];
    const book = createMotherlodeBook({
      character: () => 'char-a', me: () => { meCalls++; return account; }, nowS: () => now, nowMs: () => ms,
      onChange: (l) => changes.push(asking ? 'from inside' : l.key),
      door: { motherlodes: async () => {
        if (fail && failure === 'throw') throw new Error('offline');
        return fail ? { ok: false, error: failure } : { ok: true, data: { day, lodes: [lode], found: lode.key } };
      } },
    });
    await book.read();
    assert.equal(book.found(), lode.key);
    fail = true;
    await book.read();
    assert.equal(book.found(), lode.key, 'same-account failure retains its known marker');
    // AUDIT SILVER-WAYS D7: the gather host's marks ask found() every frame - the stored session is parsed once a second
    const calls = meCalls;
    for (let i = 0; i < 50; i++) { book.found(); ms += 16; }
    assert.ok(meCalls - calls <= 1, `the account read ${meCalls - calls} times in 800 ms`);
    account = 'account-b';
    ms += MOTHERLODE_ME_MS;
    asking = true;
    assert.equal(book.found(), null, 'clear before any refresh completes');
    assert.equal(book.standingOn(300, 120).length, 1);
    asking = false;
    assert.equal(changes.length, 1, 'the host is never told from inside its own stand (gatherHost restandAt re-entered)');
    book.tick();   // the frame's settle tells the host
    await book.read();
    assert.equal(book.found(), null);
    assert.equal(book.standingOn(300, 120).length, 1);
    assert.equal(book.standingAll().length, 1);
    assert.deepEqual(changes, [lode.key, lode.key], 'notify host when account eligibility changes');
  });
}
