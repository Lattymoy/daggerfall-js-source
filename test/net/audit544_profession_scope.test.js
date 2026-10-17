import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfBook } from '../../src/net/profBook.js';

const day = 20500;
const snapshot = (character) => ({ character, day, tracks: [{ profession: 'smithing', rank: 0, xp: 0 }], stores: [{ material: 'ingot:iron', own: 1, bought: 0 }], writs: { today: 0, max: 3 } });
const answer = { ok: true, data: {
  store: { material: 'ingot:iron', own: 99, bought: 0 }, stores: [{ material: 'ingot:iron', own: 99, bought: 0 }],
  track: { profession: 'smithing', rank: 80, xp: 64000 }, balance: 1234, today: { filled: 3, max: 3 }, writs: [],
} };
const operations = {
  smelt: (b) => b.smelt('ingot:iron', 1), stock: (b) => b.stock('ingot:iron', 1),
  deliver: (b) => b.deliver('court-writ', 1), spec: (b) => b.choose('smithing', 25, 'smith'),
  writs: (b) => b.writs(1), pixels: (b) => b.askPixels([[1, 1]]), dungeon: (b) => b.askDungeon(1),
};

for (const [operation, run] of Object.entries(operations)) {
  for (const switchKind of ['character', 'account']) {
    for (const ok of [true, false]) test(`audit544: late ${operation} ${ok ? 'success' : 'refusal'} cannot affect another ${switchKind}`, async () => {
      let character = 'A', account = 'owner-A', finish;
      const door = { account: () => account, state: async (c) => ({ ok: true, data: snapshot(c) }),
        [operation === 'dungeon' ? 'pixels' : operation]: () => new Promise((resolve) => { finish = resolve; }) };
      const book = createProfBook({ door, character: () => character, now: () => day * 86400000, rid: () => 'audit-request' });
      await book.refresh();
      const pending = run(book);
      if (switchKind === 'character') character = 'B'; else account = 'owner-B';
      await book.refresh({ force: true });
      const before = structuredClone(book.state);
      finish(ok ? answer : { ok: false, error: 'prof-closed' });
      const result = await pending;
      assert.deepEqual(book.state, before, 'no track, Stores, Marks, writ-count or closed-state contamination');
      assert.equal(book.stale(), false, 'the current character keeps its own fresh response');
      if (!['pixels', 'dungeon'].includes(operation)) assert.equal(result.error, 'elsewhere');
      if (operation === 'smelt') assert.notEqual(result.ok, true, 'the host must not charge the new character a forge fee');
    });
  }
}

test('audit544: overlapping character refreshes read independently and an old reply cannot replace the new character', async () => {
  let character = 'A', finishA, calls = 0;
  const book = createProfBook({ character: () => character, now: () => day * 86400000, door: {
    account: () => 'owner', state: (c) => { calls++; return c === 'A' ? new Promise((r) => { finishA = r; }) : Promise.resolve({ ok: true, data: snapshot(c) }); },
  } });
  const first = book.refresh();
  character = 'B';
  assert.equal((await book.refresh()).ok, true);
  assert.equal(book.state.character, 'B');
  finishA({ ok: true, data: snapshot('A') });
  assert.equal((await first).error, 'elsewhere');
  assert.equal(book.state.character, 'B');
  assert.equal(calls, 2);
});

test('audit544: a retry never sends the old character request under a different account', async () => {
  let account = 'A', calls = 0, sequence = 0;
  const sentIds = [];
  const book = createProfBook({ character: () => 'character', now: () => day * 86400000, rid: () => `retry-request-${++sequence}`,
    sleep: async () => { account = 'B'; }, door: { account: () => account, smelt: async (_c, _r, _n, id) => {
      sentIds.push(id); calls++; return calls === 1 ? { ok: false, error: 'offline' } : answer;
    } },
  });
  assert.equal((await book.smelt('ingot:iron', 1)).error, 'elsewhere');
  assert.equal(calls, 1);
  account = 'A';
  assert.equal((await book.smelt('ingot:iron', 1)).ok, true);
  assert.deepEqual(sentIds, ['retry-request-1', 'retry-request-1'], 'an uncertain transaction keeps its original id for its owner');
});

test('audit544: a current character still receives a successful smelt normally', async () => {
  const book = createProfBook({ character: () => 'A', rid: () => 'current-request', door: { account: () => 'owner', smelt: async () => answer } });
  assert.equal((await book.smelt('ingot:iron', 1)).ok, true);
  assert.equal(book.track('smithing').rank, 80);
  assert.equal(book.held('ingot:iron'), 99);
});
