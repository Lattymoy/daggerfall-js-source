// FIELD BUGS 2026-10-17f (GROUND-GATE) - "People floating in mid air for some users", a screenshot from the Oblivion Gate
// in the Alik'r: the crowd drawn tens of metres over the sand. A pose's height is its sender's own ground's, so a copy on
// an older ground (a macOS or portable desktop copy never updates itself - bible/03-World/Landforms.md C2) drew every
// peer in the air. Mac's call: the relay turns such a build away. A ground room's hello says the ground it stands on
// (net/wire.js GROUND_LAW, `gl`), the relay refuses less or none while `groundGate` is on, and the ground is held to a
// print recorded under that law, so the law moves whenever the ground does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROUND_LAW, GROUND_LAW_WIRE_MAX, GROUND_OLD_REASON, GRANT_HELLO_LAW, groundRoom, isLayered, nativePoseRoom, parseClient, CLOSE_POLICY } from '../../src/net/wire.js';
import { RELAY_CFG_KEYS, RELAY_INTERNAL_CFG, RELAY_CFG_TTL_MS, parseRelayCfgCommand } from '../../src/net/relayCfg.js';
import { OnlineSession } from '../../src/net/online.js';
import { groundPrint, groundMoved, GROUND_PRINT_FILE, GROUND_PRINT_TOLERANCE_M } from '../../tools/groundPrint.mjs';

const quiet = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };

test('GROUND-GATE the law is the ground: the shaped ground this tree stands (landforms on, every land, by a road and on a mountain) is the print recorded under GROUND_LAW, within a float\'s noise - move the ground and this fails until the law moves with it (mutants: the mountains\' dials; the desert\'s; the law moved without a print)', () => {
  const recorded = JSON.parse(readFileSync(GROUND_PRINT_FILE, 'utf8'));
  assert.equal(recorded.law, GROUND_LAW, `test/fixtures/groundPrint.json is the print of GROUND_LAW ${recorded.law} and this tree names ${GROUND_LAW} - record the new ground's print: node tools/groundPrint.mjs --write`);
  const { most, at } = groundMoved(recorded, groundPrint());
  assert.ok(most <= GROUND_PRINT_TOLERANCE_M,
    `THE GROUND MOVED under GROUND_LAW ${GROUND_LAW}: ${most} m at ${at}.\n`
    + '  A copy on the old ground draws every peer on this one in the air (or under it) - bible/03-World/Landforms.md C2.\n'
    + '  Bump GROUND_LAW in src/net/wire.js (and RELAY_VERSION: the relay refuses the old ground by it), then record the\n'
    + '  print: node tools/groundPrint.mjs --write. Every copy before the bump is turned away while groundGate is on.');
  assert.ok(Object.keys(recorded.cells).some((k) => k.startsWith('Desert@')), 'the Alik\'r\'s dunes among them - the report\'s ground');
});

test('GROUND-GATE the wire: a hello says `gl` 1 to GROUND_LAW_WIRE_MAX, any other value read as none (the `w2` law, never refused); the ground rooms are the cells, the places that ride their frame, the battles and the owned rooms - not the hub; the refusal\'s close reason fits a WebSocket close (mutants: the bound; the rooms)', () => {
  const hello = (gl) => parseClient(JSON.stringify({ t: 'hello', id: 'peer-0001', secret: 'secret-of-peer-0001', name: 'A', look: { race: 'Nord', gender: 'male', faceIndex: 0, items: [] }, pose: null, ...(gl === undefined ? {} : { gl }) }));
  assert.equal(hello(GROUND_LAW).gl, GROUND_LAW);
  assert.equal(hello(GROUND_LAW_WIRE_MAX).gl, GROUND_LAW_WIRE_MAX, 'a later build\'s number, read');
  for (const v of [undefined, 0, -1, 1.5, '1', null, GROUND_LAW_WIRE_MAX + 1]) {
    const h = hello(v);
    assert.equal(h.t, 'hello', `gl ${v}: still a hello`);
    assert.equal('gl' in h, false, `gl ${v}: read as none`);
  }
  for (const k of ['world:9,9', 'world:-3,12', 'dungeon:m77', 'interior:m77.3']) assert.equal(groundRoom(k), true, k);
  for (const k of ['chat:world', 'party:abc', '', null]) assert.equal(groundRoom(k), false, String(k));
  for (const k of ['world:9,9', 'dungeon:m77', 'chat:world', 'interior:m1.1']) assert.equal(groundRoom(k), isLayered(k) || nativePoseRoom(k));
  assert.ok(new TextEncoder().encode(GROUND_OLD_REASON).length <= 123, 'a close reason past 123 bytes throws, and the socket is never closed');
  assert.ok(RELAY_CFG_KEYS.includes('groundGate'));
  assert.deepEqual(parseRelayCfgCommand('groundgate on'), { cmd: 'relay', k: 'groundGate', v: 'on' });
});

test('GROUND-GATE the relay\'s door, through a real Room: off, an old build is let in; a developer turns it on at the hub; a cold cell asks the hub before its first old hello, refuses it with the words and the close every build shows, writes nothing, and lets the current build in without asking; the hub itself lets an old build in; on and off alone; turned off, the cell lets it in again inside a TTL (mutants: the room\'s test; the law\'s; the cold ask unawaited; the setting unread; the refusal\'s value)', async () => {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    await quiet(async () => {
      const W = (await import('../fakeRoom.mjs')).fakeRooms({ now: () => clock });
      const H = W.room('chat:world');
      const join = async (R, id, extra = {}) => { const ws = R.connect(); clock += 300; await R.hello(ws, id, null, extra); return ws; };
      const roster = (R) => R.sockets.filter((s) => s.att?.id).map((s) => s.att.id);
      // OFF (the deploy's own state - the relay goes first, and the site after it): the old build is let in
      const A = W.room('world:9,9');
      const old0 = await join(A, 'old-0001');
      assert.equal(old0.closed, null, 'off: an old build stands in the cell');
      // a developer turns it on at the hub - on and off alone
      const dev = await join(H, 'dev-0001', { glyphs: ['dev'] });
      const say = async (k, v) => { clock += 5000; await H.raw(dev, JSON.stringify({ t: 'cfg', k, v })); return dev.sent.filter((f) => f.t === 'cfg').at(-1); };
      assert.match((await say('groundGate', 'yes')).error, /groundGate is on .* or off/);
      assert.deepEqual(await say('groundGate', 'on'), { t: 'cfg', k: 'groundGate', v: 'on' });
      const old1 = await join(H, 'old-0002');
      assert.equal(old1.closed, null, 'the hub is no ground room: an old build keeps its friends and its chat');
      // a COLD cell: its first old hello asks the hub, and is refused
      let asked = 0;
      const fetch0 = H.room.fetch.bind(H.room);
      H.room.fetch = (req) => { if (new URL(req.url).pathname === RELAY_INTERNAL_CFG) asked++; return fetch0(req); };
      const B = W.room('world:10,10');
      const now0 = await join(B, 'new-0001', { gl: GROUND_LAW, gv: GRANT_HELLO_LAW, ls: 1 });   // PIN MOVED (GRANT-DOOR, Spawn-Grants section 20): the current build says its spawn grants too - one that did not would ask the hub for the grant door. PIN MOVED (LEASE1, net/roomLease.js): and that it hands its hub's lease on - one that did not would ask the hub for the lease door
      assert.equal(now0.closed, null, 'the current build is let in');
      assert.equal(asked, 0, 'and asks the hub nothing');
      const old2 = await join(B, 'old-0003');
      assert.equal(asked, 1, 'the cold room asked the hub before it answered');
      assert.deepEqual(old2.closed, { code: CLOSE_POLICY, reason: GROUND_OLD_REASON });
      const said = old2.sent.at(-1);
      assert.equal(said.t, 'error');
      assert.match(said.m, /^This copy of the game is older than the world online\. Update it to play online: reload the page, or download the latest desktop release\.$/, 'the words every build shows as its error (net/online.js) - what to do, said');
      assert.deepEqual(roster(B), ['new-0001'], 'nothing of the old hello written');
      const old3 = await join(B, 'old-0004', { gl: 0 });
      assert.deepEqual(old3.closed, { code: CLOSE_POLICY, reason: GROUND_OLD_REASON }, 'a `gl` the wire reads as none is none');
      assert.equal(asked, 1, 'inside a TTL the room asks no more');
      // and a newer build than this relay's ground is let in (the site never runs ahead of the relay - the chain's order)
      assert.equal((await join(B, 'next-0001', { gl: GROUND_LAW + 1 })).closed, null);
      // turned off: the room hears it within a TTL
      assert.deepEqual(await say('groundGate', 'off'), { t: 'cfg', k: 'groundGate', v: 'off' });
      clock += RELAY_CFG_TTL_MS;
      await join(B, 'old-0005');   // asks again, unawaited - this hello rides the answer it holds
      await new Promise((r) => setImmediate(r));
      const old6 = await join(B, 'old-0006');
      assert.equal(old6.closed, null, 'off again: the old build is let in');
    });
  } finally { Date.now = realNow; }
});

test('GROUND-GATE the client: a hello to a ground room says the ground this build stands on, to the room it goes to (a halo cell\'s too); the hub\'s says none; refused for an old ground, the session shows the relay\'s words and stops - no reconnect loop (mutants: the field dropped; the room read off the session)', () => {
  const s = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: class {}, now: () => 0 });
  s.room = 'chat:world';
  assert.equal(s._helloFrame(null, 'world:9,9').gl, GROUND_LAW, 'the room it goes to, not the session\'s');
  assert.equal('gl' in s._helloFrame(null), false, 'the hub\'s hello as it was, key for key');
  s.room = 'world:9,9';
  assert.equal(s._helloFrame(null).gl, GROUND_LAW);
  // an old build's view of the refusal is the same code path: the error frame's words, then a terminal close
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; sockets.push(this); }
    send(x) { this.sent.push(x); }
    close() {}
  }
  const o = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', id: 'mac-0002', secret: 'shh-shh-shh-0002', WebSocketImpl: FakeWS, now: () => 0 });
  o.join('world:9,9');
  const ws = sockets[0];
  const words = 'This copy of the game is older than the world online.';
  ws.onmessage?.({ data: JSON.stringify({ t: 'error', m: words }) });
  ws.onclose?.({ code: CLOSE_POLICY, reason: GROUND_OLD_REASON });
  assert.equal(o.status, 'error');
  assert.equal(o.error, words);
  assert.equal(o.terminal, true, 'terminal: no retry until the player updates');
});
