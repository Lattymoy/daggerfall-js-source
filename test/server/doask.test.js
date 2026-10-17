// DO-ASK (2026-10-16, Mac: "Yes and do any other improvements along the way. I really wanna continue to beef up the
// server"; bible/11-Multiplayer/Scale-Arc.md DO-ASK): THE WORKER'S ASK OF A ROOM. The live relay's Durable Objects threw
// at the Worker now and then - a region channel's storage reset, a crowded cell's queue overloaded - and the Worker let
// it out as an exception: the socket's upgrade failed with nothing a page could read, and a reset that a second ask
// would have survived cost the player a reconnect's backoff. server/src/relayScale.js askRoom asks a `retryable` one
// once more and never an `overloaded` one, and answers what is left as a 503. tools/mutants/doask.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../../server/src/index.js';
import { askRoom, layerWalk } from '../../server/src/relayScale.js';

const quiet = async (fn) => { const keep = { warn: console.warn }; console.warn = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const upgrade = (key) => new Request(`https://relay.invalid/room/${key}`, { headers: { Upgrade: 'websocket' } });
const thrown = (message, props) => Object.assign(new Error(message), props);

/** A ROOMS binding whose objects throw each of `errors` in turn, then answer 101; every ask counted, by name. */
function rooms(errors) {
  const asks = [];
  let n = 0;
  return {
    asks,
    idFromName: (name) => name,
    get: (id) => ({ fetch: async () => { asks.push(id); const e = errors[n++]; if (e) throw e; return new Response(null, { status: 200, headers: { 'x-room': String(id) } }); } }),
  };
}

test('DO-ASK the Worker asks a room again once when the runtime says the error is retryable, never when it is overloaded, and answers what is left as a 503 the page backs off from - never an exception (mutants: a retryable never asked again; an overloaded asked again; asked again for ever; the failure thrown)', async () => {
  await quiet(async () => {
    // a reset before anything ran: asked again, and the second ask answers
    let R = rooms([thrown('Durable Object reset because its code was updated.', { retryable: true })]);
    let res = await worker.fetch(upgrade('chat:world.3'), { ROOMS: R });
    assert.equal(res.status, 200, 'the second ask answered');
    assert.deepEqual(R.asks, ['chat:world.3', 'chat:world.3']);
    // overloaded: never asked again - a 503 saying busy
    R = rooms([thrown('Durable Object is overloaded. Requests queued for too long.', { retryable: true, overloaded: true })]);
    res = await worker.fetch(upgrade('chat:world.3'), { ROOMS: R });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'busy' });
    assert.equal(res.headers.get('retry-after'), '2');
    assert.equal(R.asks.length, 1, 'an overloaded room is never asked again');
    // retryable twice: asked twice, then a 503
    R = rooms([thrown('Network connection lost.', { retryable: true }), thrown('Network connection lost.', { retryable: true })]);
    res = await worker.fetch(upgrade('chat:world.3'), { ROOMS: R });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'unavailable' });
    assert.equal(R.asks.length, 2, 'asked again once, never in a loop');
    // an error the runtime does not call retryable: one ask, a 503
    R = rooms([thrown('internal error; reference = x')]);
    res = await askRoom(R, 'chat:world.3', upgrade('chat:world.3'));
    assert.equal(res.status, 503);
    assert.equal(R.asks.length, 1);
  });
});

test('DO-ASK a crowded place\'s walk asks each layer the same way: a layer reset before it ran is asked again and answers, and a layer that cannot answer ends the walk with its 503 (mutants: the walk\'s ask thrown)', async () => {
  await quiet(async () => {
    let R = rooms([thrown('Durable Object reset.', { retryable: true })]);
    let res = await layerWalk(R, 'world:3,4', upgrade('world:3,4'), 0);
    assert.equal(res.status, 200);
    assert.equal(R.asks.length, 2);
    R = rooms([thrown('Durable Object is overloaded.', { overloaded: true, retryable: true })]);
    res = await layerWalk(R, 'world:3,4', upgrade('world:3,4'), 0);
    assert.equal(res.status, 503, 'its 503, never an exception out of the walk');
    assert.equal(R.asks.length, 1);
  });
});
