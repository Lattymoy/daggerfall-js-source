// FIRM-RETRY (2026-10-25; bible/06-Systems/Firmament.md section 6) - THE BOOK READS AGAIN BY ITSELF
// (src/net/firmament/firmamentBook.js): a read or a change the service never answered is followed by a read of the book's
// own, the wait doubling to its ceiling, until a read is answered. The world host reads once, at the first Renown, and
// only the enhanced HUD asked again, so a classic-HUD character whose first read failed played with no stars.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createFirmamentBook, FIRM_READ_RETRY_MS, FIRM_READ_RETRY_MAX_MS, FIRM_KEPT_KEY } from '../../../src/net/firmament/firmamentBook.js';

const TREE = 'wr.start|wr.s1';

const memory = () => {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)) };
};

/** A door whose reads answer each word of `stateWords` in turn ('ok' an answer holding TREE), then 'ok'; and whose
 *  changes answer `setWord` ('ok' lands the tree). Every ask is written down. */
function door({ stateWords = [], setWord = 'ok' } = {}) {
  const asks = [];
  const words = [...stateWords];
  let held = TREE;
  const answer = () => ({ ok: true, data: { tree: held, renown: 20, stars: 38, craft: 0, ranks: {}, refund: { freeBelow: 10, perStar: 10 } } });
  return {
    asks,
    account: () => 'acct-1',
    state: async () => {
      asks.push(['state']);
      const word = words.shift() ?? 'ok';
      return word === 'ok' ? answer() : { ok: false, error: word };
    },
    set: async (character, tree, id) => {
      asks.push(['set', tree, id]);
      if (setWord !== 'ok') return { ok: false, error: setWord };
      held = tree;
      return answer();
    },
  };
}

/** A timer the test runs by hand: every wait asked for, in order. */
function handTimer() {
  const waits = [];
  return {
    waits,
    later: (fn, ms) => { waits.push({ fn, ms }); },
    /** Run the oldest wait and let the read it starts settle. */
    async runNext() {
      const next = waits.shift();
      next.fn();
      await new Promise((resolve) => { setImmediate(resolve); });
    },
  };
}

function bookOver(serviceDoor, timer, storage = memory()) {
  let ids = 0;
  return createFirmamentBook({ door: serviceDoor, storage, character: () => 'char-1', rid: () => `fretry${String(++ids).padStart(4, '0')}`, later: timer.later });
}

test('FIRM-RETRY: an unanswered read is read again, the wait doubling, until a read is answered', async () => {
  const serviceDoor = door({ stateWords: ['offline', 'server', 'maintenance'] });
  const timer = handTimer();
  const book = bookOver(serviceDoor, timer);
  assert.equal(await book.read(), false);
  assert.deepEqual(timer.waits.map((wait) => wait.ms), [FIRM_READ_RETRY_MS]);
  await timer.runNext();
  assert.deepEqual(timer.waits.map((wait) => wait.ms), [FIRM_READ_RETRY_MS * 2]);
  await timer.runNext();
  assert.deepEqual(timer.waits.map((wait) => wait.ms), [FIRM_READ_RETRY_MS * 4]);
  await timer.runNext();
  assert.equal(timer.waits.length, 0, 'an answered read asks for no further retry');
  assert.equal(serviceDoor.asks.length, 4);
  assert.equal(book.state.open, true);
  assert.deepEqual(book.state.tree, { start: 'wr.start', keys: ['wr.s1'] });
});

test('FIRM-RETRY: the wait stops doubling at its ceiling, and starts again from the first after an answer', async () => {
  const failures = Array.from({ length: 6 }, () => 'offline');
  const serviceDoor = door({ stateWords: [...failures, 'ok', 'offline'] });
  const timer = handTimer();
  const book = bookOver(serviceDoor, timer);
  await book.read();
  const seen = [];
  while (timer.waits.length) {
    seen.push(timer.waits[0].ms);
    await timer.runNext();
  }
  assert.deepEqual(seen, [15_000, 30_000, 60_000, 120_000, 120_000, 120_000]);
  assert.equal(FIRM_READ_RETRY_MAX_MS, 120_000);
  await book.read();
  assert.deepEqual(timer.waits.map((wait) => wait.ms), [FIRM_READ_RETRY_MS], 'a failure after an answer waits the first wait again');
});

test('FIRM-RETRY: one retry waits at a time, and one that comes due after another read was answered asks nothing', async () => {
  const serviceDoor = door({ stateWords: ['offline', 'offline'] });
  const timer = handTimer();
  const book = bookOver(serviceDoor, timer);
  await book.read();
  await book.read();
  assert.equal(timer.waits.length, 1, 'two failed reads, one retry');
  assert.equal(await book.read(), true);
  const asksBefore = serviceDoor.asks.length;
  await timer.runNext();
  assert.equal(serviceDoor.asks.length, asksBefore);
  assert.equal(timer.waits.length, 0);
});

test('FIRM-RETRY: a refusal the service gave after it looked is not read again', async () => {
  for (const word of ['firm-closed', 'firm-character']) {
    const timer = handTimer();
    const book = bookOver(door({ stateWords: [word] }), timer);
    assert.equal(await book.read(), false);
    assert.equal(timer.waits.length, 0, word);
  }
});

test('FIRM-RETRY: a change whose answer did not come is followed by a read, which asks the kept change again under its id', async () => {
  const serviceDoor = door({ setWord: 'offline' });
  const timer = handTimer();
  const storage = memory();
  const book = bookOver(serviceDoor, timer, storage);
  const sent = await book.commit({ start: 'wr.start', keys: ['wr.s1'] });
  assert.deepEqual(sent, { ok: false, error: 'offline' });
  const lostId = JSON.parse(storage.getItem(FIRM_KEPT_KEY))['acct-1|char-1'].rid;
  assert.deepEqual(timer.waits.map((wait) => wait.ms), [FIRM_READ_RETRY_MS]);
  await timer.runNext();
  const resent = serviceDoor.asks.filter((ask) => ask[0] === 'set');
  assert.deepEqual(resent.map((ask) => ask[2]), [lostId, lostId], 'the retry\'s read asked the kept change again, under the same id');
});
