// COST-1 (2026-10-24, the owner's Cloudflare bill; bible/11-Multiplayer/Scale-Arc.md COST-1): A REGION'S CHANNEL IS
// WHOLE AGAIN. Since HUB-PULL a shard holding a socket keeps a call open at its bus, so a populated region kept up to five
// objects awake all day. By default a region link says hello to the region's channel itself (net/hubShards.js shardOf
// answers no shard for it), the channel holds its players' real sockets and runs its lines, marks, census and list over
// them, and nothing polls; a link of an older build that asks for a shard is told the channel. The relay's REGION_SHARDS
// var splits a region again (the way back: test/net/scale5c.test.js holds the split). Over real Rooms on the pins' fake
// objects (test/fakeRoom.mjs fakeRooms).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import { chatRegionRoom, CHAT_ROOMS } from '../../src/net/wire.js';
import * as H from '../../src/net/hubShards.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const RB = chatRegionRoom(5);
const MARK = { px: 207, py: 213, fx: 12, fy: 250, h: 64, m: 1, tv: 1 };

/** A world of rooms on a clock of its own (`vars`: the relay's), the hub's doors driven to rest between steps -
 *  test/net/scale5c.test.js's harness. */
async function world(vars, fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    return await quiet(async () => {
      const W = fakeRooms({ now: () => clock, vars });
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          for (const [k, r] of W.made) if (H.isChannelShard(k)) await r.room._hubUpFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
        }
      };
      /** A region link for `n` (account `acct-<n>`), said hello to `key` as a link of this build does (`hs` 1). */
      const link = async (n, key = RB, extra = {}) => {
        const R = W.room(key);
        const ws = R.connect();
        clock += 30;
        await R.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, hs: 1, kind: 'linked', ...extra });
        await settle();
        return ws;
      };
      const say = async (ws, key, o) => { await W.room(key).raw(ws, JSON.stringify(o)); await settle(); };
      const drop = async (ws, key) => { await W.room(key).drop(ws); await settle(); };
      try { return await fn({ W, link, say, drop }); } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); }
      }
    });
  } finally { Date.now = realNow; }
}
const ofT = (ws, t) => ws.sent.filter((f) => f.t === t);

test('COST-1 the law: a region\'s channel has no shard unless the relay names its region (REGION_SHARDS: numbers by commas, or `all`; anything else names none) - the hub\'s sixteen untouched; the shards\' keys still channels a client may ask for, so an older build reaches the relay to be told; the relay ships naming none (mutants: a region split by default; the var read loose; `all` short; the hub\'s shards touched; the var shipped naming one)', () => {
  assert.equal(H.shardOf(RB, 'acct-x'), null, 'whole by default - the client\'s own answer too (world.js channelLinkRoom: the channel itself)');
  assert.equal(H.shardOf(RB, 'acct-x', H.NO_REGIONS), null);
  assert.equal(H.shardOf(RB, 'acct-x', H.regionsSharded('5')), `${RB}.${H.shardHash('acct-x') % H.REGION_SHARDS}`, 'a region the var names is split as before');
  assert.equal(H.shardOf(chatRegionRoom(6), 'acct-x', H.regionsSharded('5')), null, 'and no other');
  assert.equal(H.shardOf('chat:world', 'acct-x'), H.hubOfSubject('acct-x'), 'the hub keeps its sixteen whatever the var');
  assert.equal(H.shardOf('chat:world', 'acct-x', H.regionsSharded('all')), H.hubOfSubject('acct-x'));
  assert.deepEqual([...H.regionsSharded(' 5, 23 ,x,62,05,-1,5.5,')].sort((a, b) => a - b), [5, 23], 'region numbers alone, written as the map writes them');
  assert.equal(H.regionsSharded('all').size, H.REGION_CHANNELS);
  for (const none of ['', '  ', undefined, null, 7, 'none']) assert.equal(H.regionsSharded(none).size, 0, String(none));
  assert.equal(H.regionsSharded('5,23'), H.regionsSharded('5,23'), 'read once');
  for (const k of H.REGION_SHARD_ROOMS) assert.ok(CHAT_ROOMS.has(k), `${k} still a room the Worker opens`);
  // the deploy's own value names no region, and a Room reads the var it is given
  const shipped = /^REGION_SHARDS = "([^"]*)"$/m.exec(src('server/wrangler.toml'))?.[1];
  assert.equal(shipped, '', 'wrangler.toml declares it');
  assert.equal(H.regionsSharded(shipped).size, 0, 'the relay names no region');
  assert.equal(fakeRoom(RB, { vars: { REGION_SHARDS: shipped } }).room._shardOf(RB, 'acct-x'), null, 'a Room under the deploy\'s value: the channel whole');
  assert.equal(fakeRoom(RB, { vars: { REGION_SHARDS: '5' } }).room._shardOf(RB, 'acct-x'), H.shardOf(RB, 'acct-x', H.regionsSharded('5')), 'a Room under a var that names it: split');
});

test('COST-1 A REGION\'S CHANNEL WHOLE: a link of this build is welcomed on the region\'s channel itself, which holds its real socket - no shard made, nothing polled; a region line and a traveller\'s mark reach every other link there and never back to the mark\'s own; a joiner is told the marks; the census counts the registered; the Region tab lists everyone; a link of an older build on a shard is told the channel and closed, nothing written there; and the last leave leaves no object behind it awake on the region\'s behalf (mutants: the bus hops a link to a shard; the old shard keeps its link; the old shard told its own)', async () => {
  await world({}, async ({ W, link, say, drop }) => {
    const bus = W.room(RB);
    const wa = await link('ra'), wb = await link('rb');
    assert.equal(wa.sent[0]?.t, 'welcome', 'welcomed on the channel - no `hub` hop');
    assert.equal(bus.sockets.length, 2, 'the channel holds the real sockets');
    assert.equal(bus.room._vsocks.size, 0, 'and no shard\'s');
    for (const ws of [wa, wb]) ws.sent.length = 0;
    await say(wa, RB, { t: 'chat', text: 'hail, region' });
    for (const ws of [wa, wb]) assert.deepEqual(ofT(ws, 'chat').map((f) => f.text), ['hail, region']);
    await say(wa, RB, { t: 'trav', p: MARK });
    assert.deepEqual(ofT(wb, 'trav').map((f) => [f.id, f.p?.px]), [['peer-ra', MARK.px]]);
    assert.equal(ofT(wa, 'trav').length, 0, 'never back to its own');
    const wc = await link('rc', RB, { kind: undefined });
    assert.deepEqual((ofT(wc, 'welcome')[0]?.tr ?? []).map((m) => m.id), ['peer-ra'], 'a joiner told the region\'s marks in its welcome');
    assert.equal((await (await bus.room._sdCensusInternal()).json()).n, 2, 'the census: the two registered accounts');
    await say(wb, RB, { t: 'find', all: 1 });
    assert.deepEqual(ofT(wb, 'found').at(-1).l.map((p) => p.name).sort(), ['ra', 'rb', 'rc'], 'everyone in the region, for the Region tab');
    // an older build asks for its shard: told the channel, closed, nothing held or written there
    const shardKey = `${RB}.${H.shardHash('acct-rd') % H.REGION_SHARDS}`;
    const old = await link('rd', shardKey);
    assert.deepEqual(old.sent, [{ t: 'hub', key: RB }]);
    assert.equal(old.closed?.code, H.CLOSE_HUB);
    const shard = W.room(shardKey);
    assert.equal(shard.sockets.length, 0);
    assert.equal(shard.store.size, 0, 'nothing written on the shard (no `hubkey`: it owes the bus nothing)');
    assert.equal(bus.room._vsocks.size, 0);
    assert.deepEqual([...W.made.keys()].filter((k) => H.isRegionShard(k)), [shardKey], 'no shard but the one the old link asked for');
    for (const [ws] of [[wa], [wb], [wc]]) await drop(ws, RB);
    assert.equal(bus.room._polls?.size ?? 0, 0, 'no poll held at the channel');
    assert.equal(shard.room._pollWake ?? null, null, 'and none out from the shard');
  });
});

test('COST-1 THE WAY BACK: with REGION_SHARDS naming a region, a link of this build said hello to its channel is told its shard, as SCALE5c part two had it; a region the var does not name keeps its link (mutants: the var unread at the hop; every region split)', async () => {
  await world({ REGION_SHARDS: '5' }, async ({ link }) => {
    const want = H.shardOf(RB, 'acct-sa', H.regionsSharded('5'));
    const hop = await link('sa');
    assert.deepEqual(hop.sent, [{ t: 'hub', key: want }], 'region 5 split');
    const other = await link('sb', chatRegionRoom(6));
    assert.equal(other.sent[0]?.t, 'welcome', 'region 6 whole');
    const onShard = await link('sa', want);
    assert.equal(onShard.sent[0]?.t, 'welcome', 'its own shard welcomes it');
  });
});
