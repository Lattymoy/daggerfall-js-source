// SCALE3 (2026-09-30, the scaling audit - bible/11-Multiplayer/Scale-Arc.md): THE BOT FLEET's own law
// (tools/loadBots.mjs). The fleet itself needs workerd and runs as `npm run load` (no suite row: it stands two Workers
// up); what it decides - the rooms a bot opens, its retry, how a run is summed up - is pinned here, so a report is
// read the same way from one run to the next.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { quantile, summarize, roomsFor, retryAfter, argsOf } from '../tools/loadBots.mjs';
import { roomOf, isChatRoom, isCellRoom, worldRoom, WORLD_CELL } from '../src/net/wire.js';
import { BACKOFF_MIN_MS, BACKOFF_MAX_MS } from '../src/net/online.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('SCALE3: a bot opens what a tab opens - its cell, a halo cell beside it, the hub and a region channel - every key one the relay routes (mutants: a room the relay refuses; the hub missing)', () => {
  for (const i of [0, 1, 7, 61, 62, 199]) {
    const rooms = roomsFor(i);
    assert.equal(rooms.length, 4);
    for (const r of rooms) assert.equal(roomOf(`/room/${r}`), r, `${r} is a room the relay routes`);
    assert.ok(isCellRoom(rooms[0]) && isCellRoom(rooms[1]), 'the cell and its halo');
    const [, cx, cy] = /^world:(\d+),(\d+)$/.exec(rooms[0]).map(Number);
    assert.ok(cx < 1000 / WORLD_CELL && cy < 500 / WORLD_CELL, 'a cell on the map');
    assert.equal(rooms[2], 'chat:world', 'the hub every tab joins');
    assert.ok(isChatRoom(rooms[3]) && /^chat:region\.\d+$/.test(rooms[3]));
    assert.equal(new Set(rooms).size, 4, 'four rooms, four sockets');
  }
  assert.notEqual(roomsFor(0)[0], roomsFor(1)[0], 'the bots spread over cells');
  assert.equal(roomsFor(0)[0], roomsFor(4)[0], 'and share them, as a town\'s players do');
  assert.equal(roomsFor(0)[0], worldRoom(207, 212), 'Daggerfall city\'s own cell');
});

test('SCALE3: a bot retries as a tab does - the first wait uniform over [BACKOFF_MIN_MS, 2x], each later window doubled to BACKOFF_MAX_MS (mutant: a fixed wait)', () => {
  assert.equal(retryAfter(0, () => 0), BACKOFF_MIN_MS);
  assert.equal(retryAfter(0, () => 1), 2 * BACKOFF_MIN_MS);
  assert.equal(retryAfter(1, () => 1), 2 * BACKOFF_MIN_MS, 'the second window: [1 s, 2 s] too (a 2 s backoff less the floor)');
  assert.equal(retryAfter(3, () => 1), BACKOFF_MAX_MS);
  assert.equal(retryAfter(9, () => 1), BACKOFF_MAX_MS, 'capped');
  assert.equal(retryAfter(3, () => 0), BACKOFF_MIN_MS);
});

test('SCALE3: a run is summed up the same way every time - nearest-rank quantiles, rounded; mints a bot; the refusals by word (mutants: the quantile off by one; the mints a bot unsaid)', () => {
  assert.equal(quantile([], 0.5), null);
  assert.equal(quantile([5], 0.95), 5);
  const xs = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.deepEqual([quantile(xs, 0.5), quantile(xs, 0.95), quantile(xs, 1)], [50, 95, 100]);
  assert.equal(quantile([3, 1, 2], 0.5), 2, 'sorted first, the input left as it was');
  const s = summarize({ mode: 'per-connect', bots: 40, sockets: 160, mints: 40, mintMs: [200.4, 250.6], welcomeMs: [1000.2], refusals: { busy: 3 }, unwelcomed: 1 });
  assert.deepEqual(s, {
    mode: 'per-connect', bots: 40, sockets: 160, mints: 40, mintsPerBot: 1,
    mint: { n: 2, p50: 200, p95: 251, max: 251 }, welcome: { n: 1, p50: 1000, p95: 1000, max: 1000 },
    refusals: { busy: 3 }, unwelcomed: 1,
  });
  assert.deepEqual(argsOf(['--bots', '80', '--json', 'out.json', '--flag', '--seconds', '20']), { bots: '80', json: 'out.json', flag: true, seconds: '20' });
});

test('SCALE3: the fleet never points at production by default, stands both Workers up locally with one throwaway key pair, and each bot is ONE tab that claims its seat (mutants: a production default; a peer id a room)', () => {
  const tool = src('tools/loadBots.mjs');
  assert.doesNotMatch(tool, /mackcothran\.workers\.dev/, 'no production address anywhere in it');
  assert.match(tool, /IDENTITY_PUBLIC_KEY:\$\{pub\}/, 'the relay verifies with the pair the local service signs with');
  assert.match(tool, /const \{ id, secret \} = bot\.tab;/, 'a tab\'s id is the same in every room it opens');
  assert.match(tool, /attempt === 0 \? \{ cl: 1 \} : \{\}/, 'the connect that goes online claims the seat');
  assert.match(src('package.json'), /"load": "node tools\/loadBots\.mjs"/);
});
