// YARD-CELL YC2 (bible/11-Multiplayer/Yard-Cells.md sections 3.6 and 3.7) - THE PAGE'S END OF THE YARD PUSH.
// Over the real cell sync (scenes/yardCellSync.js) and the real push (net/yardPush.js): a hub word past the version a
// page holds asks that cell once, after a random wait; a word at or below it, or for a cell the page does not hold, is
// dropped, and the owner's own word too; the poll slows while the push is healthy and doubles over quiet polls, back on
// a change; a break in the hub link polls at its welcome. An order goes only down a link whose welcome said it hears
// yard words, spaced; the hub's frames are checked and gated before an ear hears them.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createYardCellSync, YARD_TOWN_TTL_MS, YARD_SLOW_POLL_MS, YARD_SLOW_POLL_MAX_MS, YARD_PUSH_WAIT_MS, YARD_PUSH_RETRY_MS, YARD_PUSH_TRIES } from '../../src/scenes/yardCellSync.js';
import { yardLinkWelcomed, yardLinkClosed, yardPushState, carryYardOrder, hearYardFrame, onYardWords, _resetYardPush, YARD_SEND_MS, YARD_ORDER_KEEP_MS } from '../../src/net/yardPush.js';
import { validYardFrame, YARD_WORDS_MAX, YARD_WELCOME_FIELD } from '../../src/net/yardWordLaw.js';
import { yardCellOf } from '../../src/net/yardCellLaw.js';
import { makeBuildingKey } from '../../src/systems/talk/talkTopics.js';

const A = makeBuildingKey(1, 1, 1);
const CELL = yardCellOf(A);
const TOWN = 7;
const wish = [{ mapId: TOWN, cell: CELL, distance: 10 }];
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** A fake cell route over one cell whose version the test moves, recording each request. */
function route() {
  const state = { ver: 1, asked: /** @type {number[][][]} */ ([]) };
  const yardCells = async (/** @type {number} */ mapId, /** @type {number[][]} */ cells) => {
    state.asked.push(cells.map((pair) => [...pair]));
    const out = cells.filter(([cell, have]) => cell === CELL && state.ver > have).map(([cell]) => ({ cell, ver: state.ver, yards: [] }));
    return { ok: true, data: { mapId, cells: out, more: [] } };
  };
  return { state, api: { yardCells } };
}

/** A sync on a clock the test turns, the push's state the test sets. */
async function stood({ healthy = true, rand = () => 0.5 } = {}) {
  const clock = { t: 0 };
  const link = { healthy, epoch: 1 };
  const { state, api } = route();
  const sync = createYardCellSync({ api, now: () => clock.t, push: () => link, rand });
  sync.update(wish);
  await flush();
  return { clock, link, state, sync, step: async (ms) => { clock.t += ms; sync.update(wish); await flush(); } };
}

test('YARD-CELL YC2 a word past the version held asks that cell once, after the random wait; one at or below it, for a cell not held, or the owner\'s own, is dropped (mutants: the version rule, the wait, the own mark)', async () => {
  const { clock, state, sync, step } = await stood();
  assert.equal(state.asked.length, 1, 'the cell coming into reach');
  sync.hear([[TOWN, CELL, 1], [TOWN, CELL + 1, 9], [TOWN + 1, CELL, 9]]);
  await step(YARD_PUSH_WAIT_MS);
  assert.equal(state.asked.length, 1, 'the version held, a cell not held, a town not held: no ask');
  state.ver = 2;
  sync.hear([[TOWN, CELL, 2]]);
  sync.hear([[TOWN, CELL, 2]]);
  await step(YARD_PUSH_WAIT_MS / 2 - 1);
  assert.equal(state.asked.length, 1, 'inside the random wait (half of YARD_PUSH_WAIT_MS here)');
  await step(1);
  assert.deepEqual(state.asked.slice(1), [[[CELL, 1]]], 'that cell, with the version held - the same word twice is one ask');
  await step(YARD_PUSH_WAIT_MS);
  assert.equal(state.asked.length, 2, 'answered at the word\'s version: nothing left to ask');
  // the owner's own write answered version 3: its word, when the hub says it, is dropped
  state.ver = 3;
  sync.wrote(TOWN, A, 3);
  sync.hear([[TOWN, CELL, 3]]);
  await step(YARD_PUSH_WAIT_MS);
  assert.equal(state.asked.length, 2, 'the owner\'s own word');
  assert.ok(clock.t < YARD_SLOW_POLL_MS, 'no poll came due in this test');
});

test('YARD-CELL YC2 a pushed cell answered at an older version (another isolate\'s kept answer) is asked again after YARD_PUSH_RETRY_MS, YARD_PUSH_TRIES asks in all', async () => {
  const { state, sync, step } = await stood({ rand: () => 0 });
  sync.hear([[TOWN, CELL, 5]]);   // the route still answers version 1
  await step(0);
  assert.equal(state.asked.length, 2);
  await step(YARD_PUSH_RETRY_MS - 1);
  assert.equal(state.asked.length, 2, 'inside the retry wait');
  for (let i = 0; i < YARD_PUSH_TRIES + 2; i++) await step(YARD_PUSH_RETRY_MS);
  assert.equal(state.asked.length, 1 + YARD_PUSH_TRIES, 'then the poll\'s to find');
});

test('YARD-CELL YC2 the poll: YARD_TOWN_TTL_MS with no healthy push, YARD_SLOW_POLL_MS with one, doubling over quiet polls to YARD_SLOW_POLL_MAX_MS and back on a change; a welcome after a break polls at once (mutants: each)', async () => {
  const off = await stood({ healthy: false });
  await off.step(YARD_TOWN_TTL_MS);
  assert.equal(off.state.asked.length, 2, 'no push: the minute\'s poll');

  const on = await stood();
  await on.step(YARD_TOWN_TTL_MS);
  assert.equal(on.state.asked.length, 1, 'a healthy push: no minute\'s poll');
  const waits = [];
  let last = on.clock.t - YARD_TOWN_TTL_MS;
  for (let polls = 0; polls < 5;) {
    const before = on.state.asked.length;
    await on.step(60_000);
    if (on.state.asked.length > before) {
      waits.push(on.clock.t - last);
      last = on.clock.t;
      polls++;
    }
  }
  assert.deepEqual(waits, [YARD_SLOW_POLL_MS, 2 * YARD_SLOW_POLL_MS, 4 * YARD_SLOW_POLL_MS, YARD_SLOW_POLL_MAX_MS, YARD_SLOW_POLL_MAX_MS], 'doubling over quiet polls, to its most');
  // a poll that finds a change sets it back
  on.state.ver = 9;
  for (let i = 0; i < YARD_SLOW_POLL_MAX_MS / 60_000; i++) await on.step(60_000);
  const changedAt = on.clock.t;
  const asks = on.state.asked.length;
  for (let i = 0; i < YARD_SLOW_POLL_MS / 60_000; i++) await on.step(60_000);
  assert.equal(on.state.asked.length, asks + 1, `back to YARD_SLOW_POLL_MS after the change (${changedAt})`);
  // the link breaks and is welcomed again: the cells in reach at once
  on.link.epoch++;
  await on.step(1);
  assert.equal(on.state.asked.length, asks + 2, 'the gap\'s words are lost: polled at the welcome');
  await on.step(60_000);
  assert.equal(on.state.asked.length, asks + 2, 'once');
});

test('YARD-CELL YC2 no ask goes while polling() says no; a word heard meanwhile is asked the moment it says yes', async () => {
  const clock = { t: 0 };
  const { state, api } = route();
  let shown = true;
  const sync = createYardCellSync({ api, now: () => clock.t, polling: () => shown, push: () => ({ healthy: true, epoch: 1 }), rand: () => 0 });
  sync.update(wish);
  await flush();
  shown = false;
  state.ver = 2;
  sync.hear([[TOWN, CELL, 2]]);
  for (let i = 0; i < 10; i++) { clock.t += 1000; sync.update(wish); await flush(); }
  assert.equal(state.asked.length, 1, 'indoors, under a window or hidden: none');
  shown = true;
  sync.update(wish);
  await flush();
  assert.deepEqual(state.asked.slice(1), [[[CELL, 1]]]);
});

test('YARD-CELL YC2 the carrier: an order goes only down a link whose welcome said it hears yard words, one each YARD_SEND_MS, dropped past YARD_ORDER_KEEP_MS; a close breaks the push and a welcome counts', async (t) => {
  _resetYardPush();
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });   // the push reads Date.now() in its timer
  t.after(() => _resetYardPush());
  const sent = [];
  const session = {};
  assert.equal(carryYardOrder('o1'), false, 'no link');
  yardLinkWelcomed(session, { v: 'world200' }, (frame) => { sent.push(frame); return true; });
  assert.deepEqual(yardPushState(), { healthy: false, epoch: 1 }, 'an older relay: not healthy');
  assert.deepEqual(sent, [], 'never sent a frame it would close the socket on');
  t.mock.timers.tick(1000);
  yardLinkWelcomed(session, { [YARD_WELCOME_FIELD]: 1 }, (frame) => { sent.push(frame); return true; });
  assert.deepEqual(yardPushState(), { healthy: true, epoch: 2 });
  assert.deepEqual(sent.map((f) => JSON.parse(f)), [{ t: 'yard', order: 'o1' }], 'the held order, at the welcome');
  t.mock.timers.tick(1);
  assert.equal(carryYardOrder('o2'), false, 'inside YARD_SEND_MS: held');
  t.mock.timers.tick(YARD_SEND_MS);
  assert.equal(sent.length, 2, 'then sent by the timer');
  yardLinkClosed({});
  assert.equal(yardPushState().healthy, true, 'another session\'s close is not this link\'s');
  yardLinkClosed(session);
  assert.deepEqual(yardPushState(), { healthy: false, epoch: 2 });
  carryYardOrder('o3');
  t.mock.timers.tick(YARD_ORDER_KEEP_MS);
  yardLinkWelcomed(session, { [YARD_WELCOME_FIELD]: 1 }, (frame) => { sent.push(frame); return true; });
  assert.equal(sent.length, 2, 'past its keep: dropped');
});

test('YARD-CELL YC2 the hub\'s frames: checked word by word, YARD_WORDS_MAX a frame, gated, heard only on the link\'s own session', () => {
  _resetYardPush();
  const session = {};
  yardLinkWelcomed(session, { [YARD_WELCOME_FIELD]: 1 }, () => true, 0);
  const heard = [];
  const off = onYardWords((words) => heard.push(words));
  assert.deepEqual(validYardFrame({ l: [[7, 1, 2]] }), [[7, 1, 2]]);
  for (const bad of [{ l: [] }, { l: [[7, 1, 0]] }, { l: [[7, -1, 2]] }, { l: [[7, 1]] }, { l: [[7, 1, 2.5]] }, { l: Array.from({ length: YARD_WORDS_MAX + 1 }, () => [7, 1, 2]) }]) assert.equal(validYardFrame(bad), null, JSON.stringify(bad).slice(0, 60));
  hearYardFrame({}, { t: 'yard', l: [[7, 1, 2]] }, 0);
  assert.equal(heard.length, 0, 'another session');
  hearYardFrame(session, { t: 'yard', l: [[7, 1, 0]] }, 0);
  assert.equal(heard.length, 0, 'a bad word');
  for (let i = 0; i < 10; i++) hearYardFrame(session, { t: 'yard', l: [[7, 1, 2 + i]] }, 0);
  assert.ok(heard.length >= 1 && heard.length < 10, `gated (${heard.length} of 10 in one instant)`);
  off();
  _resetYardPush();
});
