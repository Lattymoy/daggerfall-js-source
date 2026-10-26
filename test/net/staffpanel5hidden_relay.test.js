// STAFF-PANEL5-HIDDEN (2026-10-22, mob: "no tag no faint outline nothing just nothing", "true invis not lattys invis", "we
// want the player to have no idea we are wathcing them"; design doc "DFO Staff Panel: design", Invisible follow): THE
// RELAY'S HALF, OVER THE REAL ROOM (test/fakeRoom.mjs - a real signed token at a real hello, the hub's shards real Rooms on
// fake objects). The design's own acceptance: a second game and a raw socket that logs every frame stand in the same room,
// region and hub as a hidden staff socket and receive NOTHING that names it or comes from it, while the staff socket still
// hears the room. Then the drop list, the host, the cap's reserve, the admissions that write nothing, the private home's
// audit note, and the mark's lapse through the Worker's law door. tools/mutants/staff-panel5-hidden.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fakeRoom, fakeRooms } from '../fakeRoom.mjs';
import { SOCIAL_ROOM, SOCKETS_MAX, CLOSE_POLICY, CLOSE_BUSY, HELLO_WAIT_MS, chatRegionRoom, FOES_STALE_MS, PIXEL_UNITS, LAYER_HEADER, LAYER_ASK_HEADER, LAYER_EMPTY_HEADER } from '../../src/net/wire.js';
import { egBreachOfRoom } from '../../src/net/eliteGates/egLaw.js';
import * as H from '../../src/net/hubShards.js';
/** COST-1: these pins hold a region's channel SPLIT - the way back, the relay's REGION_SHARDS - so their worlds name every region, and a region's shard is asked of the same split (a region's channel is whole by default: test/net/cost1_regions.test.js). */
const SPLIT_VARS = { REGION_SHARDS: 'all' };
const SPLIT = H.regionsSharded(SPLIT_VARS.REGION_SHARDS);
import { mintHideOrder, mintOrder, importPublicKeyB64 } from '../../src/net/identityToken.js';
import { privateInteriorPrefix, privateInteriorRoom } from '../../src/net/privateInterior.js';
import { instanceOwnerOf, instanceRoomOf } from '../../src/net/instanceRoom.js';
import { openHiddenSeen, HIDDEN_SEEN_SIG_HEADER, HIDDEN_SEEN_PATH } from '../../src/net/hiddenSeen.js';
import { hiddenMay, hiddenEntered, hiddenSeenOn, HIDDEN_RESERVE, HIDDEN_LAPSED, HIDDEN_FRAMES, HIDDEN_CHAT, isHidden } from '../../server/src/staffHidden.js';
import worker from '../../server/src/index.js';
import { SAFE_LAW_PATH } from '../../server/src/relay.js';

const subtle = globalThis.crypto.subtle;
const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
/** A staff session's hidden subject (the account service's hiddenSubOf shape: 24 url-safe characters), never an account's. */
const GHOST_SUB = 'gH0st5ubAAAAAAAAAAAAAAAA';
const GHOST_ID = 'ghost-0099';
const GHOST_NAME = 'Staff member';
/** The hello fields that make a socket the hidden spectator's - the mark and the subject are the TOKEN's (fakeRoom mints them in). */
const HIDE = { tokenSub: GHOST_SUB, hd: 1, glyphs: ['mod'], name: GHOST_NAME };
const P = { x: 1, y: 0, z: 1, yaw: 0, pitch: 0, mv: 0 };
const ofT = (ws, t) => ws.sent.filter((f) => f.t === t);
const welcomeOf = (ws) => ws.sent.find((f) => f.t === 'welcome');
/** Every frame `ws` received that names the hidden socket or came from it - its id, its subject or its name, anywhere. */
const leaks = (ws, id = GHOST_ID, sub = GHOST_SUB) => ws.sent.filter((f) => { const s = JSON.stringify(f); return s.includes(id) || s.includes(sub) || s.includes(GHOST_NAME); });

test('STAFF-PANEL5-HIDDEN the allow list: a hidden socket is heard in its ping, pose, lease, find and a staff-channel line alone - every other frame, a line on any other channel, a binary or broken frame, one too long, refused (mutants: a frame type let through; the staff channel unread; the length unbounded)', () => {
  assert.deepEqual([...HIDDEN_FRAMES], ['ping', 'pose', 'lease', 'find', 'say']);   // STAFF-CHAT-RED: /red's ask, a line nobody speaks
  assert.equal(HIDDEN_CHAT, 'staff');
  for (const t of HIDDEN_FRAMES) assert.equal(hiddenMay(JSON.stringify({ t })), true, t);
  assert.equal(hiddenMay(JSON.stringify({ t: 'chat', ch: 'staff', text: 'hi' })), true, 'a staff-channel line');
  assert.equal(hiddenMay(JSON.stringify({ t: 'stp', k: 'ask', name: 'Bran', nonce: 'n1', nt: 1 })), true, 'STAFF-PANEL5-HIDDEN-FIX: a /tp ask');
  for (const f of [{ t: 'stp', k: 'answer', ticket: 'x', dest: {} }, { t: 'stp', k: 'capture' }, { t: 'stp' }]) assert.equal(hiddenMay(JSON.stringify(f)), false, `never ${JSON.stringify(f)}`);
  for (const f of [{ t: 'chat', text: 'hi' }, { t: 'chat', ch: 'party', text: 'hi' }, { t: 'chat', ch: 'guild', text: 'hi' }, { t: 'social', k: 'friend.request' }, { t: 'trav', p: {} }, { t: 'who', id: 'x' }, { t: 'world', data: {} }, { t: 'foes' }, { t: 'hello' }, { t: 'act' }, { t: 'quest' }, { t: 'roll' }, { t: 'mute' }, { t: 'ban' }, { t: 'narrate', text: 'hi' }, { t: 'red', text: 'hi' }, null, 5, []]) assert.equal(hiddenMay(JSON.stringify(f)), false, JSON.stringify(f));
  for (const m of ['{"t":"pose"', 'not json', new ArrayBuffer(4), null]) assert.equal(hiddenMay(m), false, String(m));
  assert.equal(hiddenMay(JSON.stringify({ t: 'pose', pad: 'x'.repeat(4096) })), false, 'a frame past the bound');
  assert.equal(isHidden({ hid: 1 }), true); assert.equal(isHidden({ hid: true }), false); assert.equal(isHidden(null), false);
});

test('STAFF-PANEL5-HIDDEN THE ACCEPTANCE, a place: a second game and a raw logging socket in the cell with a hidden staff socket hear nothing naming it or from it - no who-is-here row, no join, no pose, no line, no answer to a who, no count, no leave - while the staff socket is welcomed to everyone and hears their poses (mutants: the welcome\'s roster; the join; the pose fanned; a dropped frame let through; the who answer; the leave; the count)', async () => {
  await quiet(async () => {
    const r = fakeRoom('world:3,12');
    const game = r.connect(); await r.hello(game, 'game-0001', P);
    const raw = r.connect(); await r.hello(raw, 'rawl-0002', P);
    const ghost = r.connect(); await r.hello(ghost, GHOST_ID, P, HIDE);
    const w = welcomeOf(ghost);
    assert.ok(w, 'the hidden socket is welcomed');
    assert.deepEqual(w.peers.map((p) => p.id).sort(), ['game-0001', 'rawl-0002'], 'to everyone in the room');
    assert.equal(ghost.att.hid, 1, 'marked off the verified token');
    assert.equal(ghost.att.sub, GHOST_SUB, 'its subject the session\'s, never the account\'s');
    // a newcomer after it: its welcome's who-is-here names the others, never the hidden socket
    const late = r.connect(); await r.hello(late, 'late-0003', P);
    assert.deepEqual(welcomeOf(late).peers.map((p) => p.id).sort(), ['game-0001', 'rawl-0002'], 'the who-is-here list a room sends a newcomer leaves it out');
    assert.equal(r.room._namedCount(), 3, 'nor is it counted');
    // what it says: a pose (kept for range, fanned to nobody), a line, every kind of frame a game in hidden mode might send
    await r.pose(ghost, { ...P, x: 2 });
    assert.equal(r.room._attach(ghost).pose?.x, 2, 'its pose kept on its own attachment - a listener\'s range');
    await r.chat(ghost, 'boo');
    for (const f of [{ t: 'who', id: 'game-0001' }, { t: 'act', k: 'door' }, { t: 'renown', order: 'x' }, { t: 'trav', p: {} }, { t: 'social', k: 'friend.request', peer: 'game-0001' }]) await r.raw(ghost, JSON.stringify(f));
    await r.raw(ghost, '{"t":"foes","l":[]}');
    assert.equal(ghost.closed, null, 'dropped silently - never struck, never closed');
    // the room's traffic reaches it
    ghost.sent.length = 0;
    await r.pose(game, { ...P, x: 3 });
    assert.ok(ofT(ghost, 'pose').some((f) => f.id === 'game-0001'), 'the staff socket hears the room\'s poses');
    await r.ping(ghost);
    assert.ok(ofT(ghost, 'pong').length, 'and its ping is answered');
    // asked for by id - a who, a directed frame - it is nobody's target
    await r.raw(game, JSON.stringify({ t: 'who', id: GHOST_ID }));
    assert.equal(r.room._idFirst(GHOST_ID), null, 'no directed frame reaches it');
    await r.drop(ghost);
    for (const ws of [game, raw, late]) assert.deepEqual(leaks(ws), [], `${ws.att.id} heard nothing of it`);
    assert.ok(raw.sent.length > 0, 'the raw socket was listening');
  });
});

test('STAFF-PANEL5-HIDDEN a dungeon: a hidden socket is never the host - in first, the next player leads, is told so, and the room\'s memory is never asked of it (mutants: the host walk counts it; the lead counts it; its leave moves the seat)', async () => {
  await quiet(async () => {
    const r = fakeRoom('dungeon:m187');
    const ghost = r.connect(); await r.hello(ghost, GHOST_ID, P, HIDE);
    assert.equal(welcomeOf(ghost).host, null, 'alone, it holds no seat');
    const game = r.connect(); await r.hello(game, 'game-0001', P);
    assert.equal(welcomeOf(game).host, 'game-0001', 'the next player is the host');
    assert.equal(r.room._hostOf(), 'game-0001');
    const raw = r.connect(); await r.hello(raw, 'rawl-0002', P);
    assert.equal(r.room._hostOf(), 'game-0001');
    assert.equal(r.room._leads(game.att), true, 'the player leads though the hidden socket said hello first');
    await r.drop(ghost);
    assert.equal(r.room._hostOf(), 'game-0001');
    for (const ws of [game, raw]) { assert.deepEqual(leaks(ws), []); assert.equal(ofT(ws, 'host').length, 0, 'and no host word moved by it'); }
  });
});

/** A world of rooms on a held clock, the hub's doors driven to rest between steps (test/net/scale5c.test.js's own). */
async function world(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try {
    return await quiet(async () => {
      const W = fakeRooms({ now: () => clock, vars: SPLIT_VARS });
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          for (const [k, r] of W.made) if (H.isChannelShard(k)) await r.room._hubUpFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
        }
      };
      const link = async (n, key, extra = {}) => {
        const R = W.room(key);
        const ws = R.connect();
        clock += 30;
        const { peer = `peer-${n}`, ...over } = extra;
        await R.hello(ws, peer, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, ...over });
        await settle();
        return ws;
      };
      const say = async (ws, key, o) => { await W.room(key).raw(ws, JSON.stringify(o)); await settle(); };
      const drop = async (ws, key) => { await W.room(key).drop(ws); await settle(); };
      try { return await fn({ W, settle, link, say, drop, tick: (ms) => { clock += ms; } }); } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._countT); }
      }
    });
  } finally { Date.now = realNow; }
}

test('STAFF-PANEL5-HIDDEN THE ACCEPTANCE, the hub: on its own shard, its account named in its hello, a hidden link is in no roster, no count, no find, no World list, no friend\'s presence and no join or leave - on its shard, on another, or on the bus - its line, its friend request and its party act dropped; it hears the world line and finds the others (mutants: the shard\'s join; the bus\'s join; the bus count; the shard count; the find; the World list; the hub account\'s hello; the leave)', async () => {
  await world(async ({ W, link, say, drop, tick }) => {
    const bus = W.room(SOCIAL_ROOM);
    const kg = H.hubOfSubject(GHOST_SUB);
    // the second game and the raw socket: one on the hidden link's own shard, one on another
    const mine = [];
    let rawName = null;
    for (let i = 0; i < 4096 && (mine.length < 2 || !rawName); i++) { const n = `p${i}`; const k = H.hubOfSubject(`acct-${n}`); if (k === kg) mine.push(n); else if (!rawName) rawName = n; }
    const [gameName, lateName] = mine;
    const game = await link(gameName, kg, { kind: 'linked' });
    const raw = await link(rawName, H.hubOfSubject(`acct-${rawName}`));
    const old = await link('legacy', SOCIAL_ROOM, { hs: undefined });   // a tab from before the shards, on the bus itself
    // the staff member's own account befriends the game first - its presence is the one thing a friend would see
    const ghost = await link('staffer', kg, { ...HIDE, peer: GHOST_ID });
    assert.equal(welcomeOf(ghost)?.t, 'welcome', 'welcomed on its shard');
    const onBus = await link('staffer3', SOCIAL_ROOM, { ...HIDE, tokenSub: 'gH0st5ubCCCCCCCCCCCCCCCC', peer: 'ghost-0096', hs: undefined });   // a build from before the shards, hidden on the bus itself
    assert.equal(welcomeOf(onBus)?.t, 'welcome');
    assert.equal(ofT(ghost, 'social').length, 0, 'never the hub\'s account: no picture, no friends\' presence, no party');
    assert.equal(bus.room._vsocks.size, 3, 'the bus holds its ShardSocket');
    assert.equal(bus.room._busCount(), 3, 'and counts it nowhere');
    assert.equal(W.room(kg).room._namedCount(), 1, 'nor does its shard');
    const late = await link(lateName, kg);
    assert.equal(welcomeOf(late).n, 3, 'a newcomer\'s welcome says the hub\'s count as the bus last said it - the visible three');
    assert.equal(bus.room._busCount(), 4, 'and the bus counts the visible four');
    assert.ok(ofT(game, 'n').every((f) => f.n <= 4) && ofT(late, 'n').every((f) => f.n <= 4), 'every count a shard says leaves it out');
    assert.deepEqual(welcomeOf(late).peers.map((p) => p.id), [`peer-${gameName}`], 'and its shard\'s roster leaves it out');
    // what it says
    await say(ghost, kg, { t: 'chat', text: 'boo' });
    await say(ghost, kg, { t: 'social', k: 'friend.request', peer: `peer-${gameName}` });
    await say(ghost, kg, { t: 'social', k: 'party.invite', peer: `peer-${gameName}` });
    await say(ghost, kg, { t: 'roll', spec: '1d6' });
    assert.equal(ghost.closed, null, 'dropped silently');
    // it hears the world, and finds the others
    ghost.sent.length = 0;
    await say(game, kg, { t: 'chat', text: 'hail' });
    assert.deepEqual(ofT(ghost, 'chat').map((f) => f.text), ['hail'], 'the world line reaches the staff socket');
    await say(ghost, kg, { t: 'find', q: rawName });
    assert.ok(ofT(ghost, 'found').at(-1)?.l.some((p) => p.name === rawName), 'its find answered');
    // asked for by everyone else
    tick(5000);
    for (const [ws, key] of [[game, kg], [raw, H.hubOfSubject(`acct-${rawName}`)], [old, SOCIAL_ROOM]]) {
      await say(ws, key, { t: 'find', q: 'staff' });
      await say(ws, key, { t: 'find', q: 'ghost' });
      await say(ws, key, { t: 'find', all: 1 });
      const all = ofT(ws, 'found').filter((f) => f.all === 1).at(-1);
      assert.deepEqual(all?.l.map((p) => p.id).sort(), [`peer-${gameName}`, `peer-${rawName}`, 'peer-legacy', `peer-${lateName}`].sort(), `the World list, the visible four (${ws.att.id})`);
    }
    await drop(ghost, kg);
    await drop(onBus, SOCIAL_ROOM);
    assert.equal(bus.room._vsocks.size, 3, 'its ShardSocket gone');
    assert.equal(bus.room._busCount(), 4, 'and the count stands where it stood');
    for (const ws of [game, raw, old, late]) { assert.deepEqual(leaks(ws), [], `${ws.att.id} heard nothing of it`); assert.deepEqual(leaks(ws, 'ghost-0096', 'gH0st5ubCCCCCCCCCCCCCCCC'), [], `${ws.att.id} heard nothing of the bus's either`); }
    assert.ok(raw.sent.length > 0 && old.sent.length > 0);
  });
});

test('STAFF-PANEL5-HIDDEN THE ACCEPTANCE, a region: a hidden link on its region shard is in no welcome, no traveller list, no Region list and no census, and its mark is never said - it hears the others\' marks (mutants: the census mark; the region\'s join; the Region list; the trav let through)', async () => {
  await world(async ({ W, link, say, drop }) => {
    const RB = chatRegionRoom(5);
    const bus = W.room(RB);
    const kg = H.shardOf(RB, GHOST_SUB, SPLIT);
    const MARK = { px: 207, py: 213, fx: 12, fy: 250, h: 64, m: 1, tv: 1 };
    let gameName = null;
    for (let i = 0; i < 4096 && !gameName; i++) if (H.shardOf(RB, `acct-r${i}`, SPLIT) === kg) gameName = `r${i}`;
    const game = await link(gameName, kg, { kind: 'linked' });
    const raw = await link('rawreg', RB, { hs: undefined, kind: 'linked' });
    const ghost = await link('staffer', kg, { ...HIDE, peer: GHOST_ID, kind: 'linked' });
    assert.equal(welcomeOf(ghost)?.t, 'welcome');
    assert.ok(!ghost.att.lk, 'never a registered body the census counts');
    assert.equal((await (await bus.room._sdCensusInternal()).json()).n, 2, 'the census: the two players');
    await say(ghost, kg, { t: 'trav', p: MARK });
    await say(game, kg, { t: 'trav', p: MARK });
    assert.ok(ofT(ghost, 'trav').some((f) => f.id === `peer-${gameName}`), 'the staff socket hears the region\'s marks');
    await say(raw, RB, { t: 'find', all: 1 });
    assert.deepEqual(ofT(raw, 'found').at(-1).l.map((p) => p.name).sort(), [gameName, 'rawreg'].sort(), 'the Region list leaves it out');
    const late = await link('latereg', H.shardOf(RB, 'acct-latereg', SPLIT));
    assert.ok(!(welcomeOf(late).tr ?? []).some((t) => t.id === GHOST_ID));
    await drop(ghost, kg);
    for (const ws of [game, raw, late]) assert.deepEqual(leaks(ws), [], `${ws.att.id} heard nothing of it`);
  });
});

test('STAFF-PANEL5-HIDDEN the cap: a hidden seat (`?hd=1`) is taken from HIDDEN_RESERVE over a full room\'s cap, a full reserve refuses the next, and a visible socket\'s fullness counts no hidden one; STAFF-PANEL5-HIDDEN-R2: a hidden ask takes a free seat first, however many watch (mutants: the reserve unread; no bound on it; hidden sockets counted full; a hidden ask\'s visible seats unread; the reserve a hidden ask\'s only seats; R3: a hello\'d hidden socket counted as a pending seat)', async () => {
  let pairs = 0;
  const hadPair = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { pairs++; const att = {}; this[0] = {}; this[1] = { att, serializeAttachment(a) { Object.assign(att, a); }, deserializeAttachment() { return att; }, close() {} }; } };
  const upgrade = (q = '') => new Request(`https://relay.test/room/town:m9${q}`, { headers: { Upgrade: 'websocket' } });
  const status = (p) => p.then((x) => x.status, () => 101);   // node mints no 101 - a throw is the upgrade gone on to the pair
  try {
    assert.equal(HIDDEN_RESERVE, 8);
    const full = fakeRoom('town:m9');
    for (let i = 0; i < SOCKETS_MAX; i++) { const ws = full.connect(); ws.att = { ...ws.att, id: `p-${i}` }; full.room._adopt(ws, ws.att); }
    assert.equal(await status(full.room.fetch(upgrade())), 503, 'a visible socket: room full');
    assert.equal(await status(full.room.fetch(upgrade('?hd=0'))), 503, 'and only `hd=1` asks for the reserve');
    pairs = 0;
    for (let i = 0; i < HIDDEN_RESERVE; i++) assert.equal(await status(full.room.fetch(upgrade('?hd=1'))), 101, `hidden seat ${i + 1} of the reserve`);
    assert.equal(pairs, HIDDEN_RESERVE);
    const seats = full.state.getWebSockets().filter((ws) => ws.att?.hs === 1);
    assert.equal(seats.length, HIDDEN_RESERVE, 'each seat marked the reserve\'s (`hs`)');
    assert.equal(await status(full.room.fetch(upgrade('?hd=1'))), 503, 'the reserve full');
    // the reserve over a full room's cap is HIDDEN_RESERVE sockets, hello'd or not
    const fullV = fakeRoom('town:m9');
    for (let i = 0; i < SOCKETS_MAX; i++) { const ws = fullV.connect(); ws.att = { ...ws.att, id: `p-${i}` }; fullV.room._adopt(ws, ws.att); }
    for (let i = 0; i < HIDDEN_RESERVE; i++) { const ws = fullV.connect(); ws.att = { ...ws.att, id: `g-${i}`, hs: 1, hid: 1 }; fullV.room._adopt(ws, ws.att); }
    assert.equal(await status(fullV.room.fetch(upgrade('?hd=1'))), 503, 'HIDDEN_RESERVE hidden sockets over a full room: the next refused');
    // a room one short of its cap with hidden sockets in it: the visible seat is still there
    const near = fakeRoom('town:m9');
    for (let i = 0; i < SOCKETS_MAX - 1; i++) { const ws = near.connect(); ws.att = { ...ws.att, id: `p-${i}` }; near.room._adopt(ws, ws.att); }
    for (let i = 0; i < 3; i++) { const ws = near.connect(); ws.att = { ...ws.att, id: `g-${i}`, hid: 1 }; near.room._adopt(ws, ws.att); }
    assert.equal(await status(near.room.fetch(upgrade())), 101, 'hidden sockets are out of fullness');
    assert.equal(await status(near.room.fetch(upgrade())), 503, 'and the cap still holds');
    // STAFF-PANEL5-HIDDEN-R2: a hidden ask takes a free seat first - a near-empty layered cell with HIDDEN_RESERVE hidden
    // sockets in it seats the follow eye on its target's layer, never 503 with LAYER_FULL (the Worker's walk to another)
    const cell = fakeRoom('world:100,100');
    const cellUp = (q = '') => new Request(`https://relay.test/room/world:100,100${q}`, { headers: { Upgrade: 'websocket' } });
    for (let i = 0; i < 3; i++) { const ws = cell.connect(); ws.att = { ...ws.att, id: `p-${i}` }; cell.room._adopt(ws, ws.att); }
    for (let i = 0; i < HIDDEN_RESERVE; i++) { const ws = cell.connect(); ws.att = { ...ws.att, id: `g-${i}`, hs: 1, hid: 1 }; cell.room._adopt(ws, ws.att); }   // each came by a hidden seat and said its hidden hello
    assert.equal(await status(cell.room.fetch(cellUp('?hd=1'))), 101, 'a free seat, however many watch already');
    // and the reserve is still bounded: hello'd hidden sockets take an empty room's free seats, then HIDDEN_RESERVE over its
    // cap, and no more - a player still comes in, the hidden sockets out of the count (STAFF-PANEL5-HIDDEN-R3: the seats
    // asked and not yet hello'd are bounded on their own, the next test)
    const empty = fakeRoom('town:m9');
    for (let i = 0; i < SOCKETS_MAX + HIDDEN_RESERVE - 1; i++) { const ws = empty.connect(); ws.att = { ...ws.att, id: `g-${i}`, hs: 1, hid: 1 }; empty.room._adopt(ws, ws.att); }
    pairs = 0;
    assert.equal(await status(empty.room.fetch(upgrade('?hd=1'))), 101, 'the last seat of cap + HIDDEN_RESERVE');
    assert.equal(pairs, 1);
    assert.equal(await status(empty.room.fetch(upgrade('?hd=1'))), 503, 'cap + HIDDEN_RESERVE sockets: a hidden ask refused');
    assert.equal(await status(empty.room.fetch(upgrade())), 101, 'and a player still comes in');
  } finally { globalThis.WebSocketPair = hadPair; }
});

test('STAFF-PANEL5-HIDDEN-R3 anonymous parking: the hidden ask is no one\'s word until its hello, so seats asked and never hello\'d are HIDDEN_RESERVE at most, however empty the room; player traffic finds no more; past HELLO_WAIT_MS the next hidden ask closes them `no hello` and is seated - the eye on its target\'s layer (mutants: the pending seats unbounded; bounded one late; a closed one still counted)', async () => {
  const hadPair = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { const att = {}; this[0] = {}; this[1] = { att, closed: null, serializeAttachment(a) { Object.assign(att, a); }, deserializeAttachment() { return att; }, close(code, reason) { this.closed = { code, reason }; } }; } };
  const realNow = Date.now; let skew = 0; Date.now = () => realNow() + skew;
  const status = (p) => p.then((x) => x.status, () => 101);   // node mints no 101 - a throw is the upgrade gone on to the pair
  try {
    for (const key of ['town:m9', 'world:100,100']) {
      const r = fakeRoom(key);
      const upgrade = (q = '') => new Request(`https://relay.test/room/${key}${q}`, { headers: { Upgrade: 'websocket' } });
      const live = () => r.state.getWebSockets().filter((w) => !r.room._dead.has(w));
      let parked = 0;
      for (let i = 0; i < SOCKETS_MAX * 3; i++) { if (await status(r.room.fetch(upgrade('?hd=1'))) === 101) parked++; else break; }
      assert.equal(parked, HIDDEN_RESERVE, `${key}: an anonymous page parks HIDDEN_RESERVE silent hidden seats, never cap + HIDDEN_RESERVE`);
      const silent = live();
      skew += HELLO_WAIT_MS * 5;
      let players = 0;
      for (let i = 0; i < 20; i++) if (await status(r.room.fetch(upgrade())) === 101) players++;
      assert.equal(players, 20, 'players come in');
      assert.equal(live().length, HIDDEN_RESERVE + 20, 'and find no more parked');
      assert.equal(await status(r.room.fetch(upgrade('?hd=1'))), 101, 'past HELLO_WAIT_MS a hidden ask (the eye) is seated');
      assert.deepEqual(silent.map((w) => w.closed), silent.map(() => ({ code: CLOSE_BUSY, reason: 'no hello' })), 'the silent hidden seats closed on the room\'s own timer');
      assert.equal(live().length, 20 + 1);
      skew = 0;
    }
  } finally { globalThis.WebSocketPair = hadPair; Date.now = realNow; }
});

test('STAFF-PANEL5-HIDDEN the hello\'s refusals: a hidden seat said hello with a visible token is closed `hidden lapsed`, and a hidden hello on an id a visible socket holds is `id taken` - before anything is written; a visible hello on a hidden socket\'s id replaces it with no leave said (mutants: the reserve\'s seat let a visible token in; the visible id replaced)', async () => {
  await quiet(async () => {
    const r = fakeRoom('world:3,12');
    const seat = r.connect(); seat.att = { ...seat.att, hs: 1 }; r.room._adopt(seat, seat.att);
    await r.hello(seat, 'sneak-0001', P);
    assert.equal(seat.sent.find((f) => f.t === 'error')?.m, HIDDEN_LAPSED);
    assert.equal(seat.closed?.code, CLOSE_POLICY);
    assert.equal(r.store.has('secret:sneak-0001'), false, 'nothing written');
    const game = r.connect(); await r.hello(game, 'game-0001', P);
    const ghost = r.connect(); await r.hello(ghost, 'game-0001', P, { ...HIDE, secret: 'secret-of-game-0001' });
    assert.equal(ghost.sent.find((f) => f.t === 'error')?.m, 'id taken', 'a player is never turned into a watcher');
    assert.equal(game.closed, null, 'the player stands');
    const g2 = r.connect(); await r.hello(g2, GHOST_ID, P, HIDE);
    const raw = r.connect(); await r.hello(raw, 'rawl-0002', P);
    const back = r.connect(); await r.hello(back, GHOST_ID, P, { name: 'Shown' });
    assert.equal(g2.closed?.reason, 'replaced', 'Show myself: the hidden socket goes, replaced');
    assert.equal(ofT(raw, 'leave').length, 0, 'its leave said to nobody');
    assert.ok(ofT(raw, 'join').some((f) => f.id === GHOST_ID && f.name === 'Shown'), 'and the visible one joins as anyone does');
  });
});

test('STAFF-PANEL5-HIDDEN the admissions: a private home admits the hidden spectator as staff and reports it - its subject and the room, signed with the receipt key - only while HIDDEN_SEEN_URL is set, and is closed to it while the relay cannot report it (STAFF-PANEL5-HIDDEN-FIX); an instance admits it with no party mark; a breach admits it without its company\'s word (mutants: the home refused; the note unsent; the note unsigned; the instance refused; the breach refused)', async () => {
  await quiet(async () => {
    const owned = privateInteriorRoom(await privateInteriorPrefix('acct-owner', 'char-0001'), 17, 200);
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const posted = [];
    const r = fakeRoom(owned);
    r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
    r.env.HIDDEN_SEEN_URL = 'https://accounts.test/v1/mod/hidden-seen';
    r.env.ACCOUNTS = { fetch: async (req) => { posted.push({ url: req.url, sig: req.headers.get(HIDDEN_SEEN_SIG_HEADER), body: new Uint8Array(await req.arrayBuffer()) }); return new Response('{}', { status: 202 }); } };
    const stranger = r.connect(); await r.hello(stranger, 'strg-0001', P);
    assert.equal(stranger.sent.find((f) => f.t === 'error')?.m, 'private room', 'a stranger is refused');
    const ghost = r.connect(); await r.hello(ghost, GHOST_ID, P, HIDE);
    assert.ok(welcomeOf(ghost), 'the hidden spectator is let in');
    for (let i = 0; i < 5 && !posted.length; i++) await new Promise((res) => setTimeout(res, 10));
    assert.equal(posted.length, 1, 'its entry reported once');
    assert.equal(posted[0].url, r.env.HIDDEN_SEEN_URL);
    const opened = await openHiddenSeen(posted[0].body, posted[0].sig, kp.publicKey, { subtle, nowMs: Date.now() });
    assert.equal(opened.ok, true, 'signed with the relay\'s receipt key');
    assert.equal(opened.note.s, GHOST_SUB); assert.equal(opened.note.r, owned);
    // STAFF-PANEL5-HIDDEN-FIX: a relay that cannot report the entry lets no hidden socket in - no HIDDEN_SEEN_URL, no
    // receipt key to sign with, or a URL over plain http - with a stranger's word, and nothing posted
    const quietRoom = fakeRoom(owned);
    quietRoom.env.ACCOUNTS = r.env.ACCOUNTS;
    const g2 = quietRoom.connect(); await quietRoom.hello(g2, GHOST_ID, P, HIDE);
    quietRoom.env.HIDDEN_SEEN_URL = r.env.HIDDEN_SEEN_URL;
    const g6 = quietRoom.connect(); await quietRoom.hello(g6, 'ghost-0095', P, { ...HIDE, tokenSub: 'gH0st5ubDDDDDDDDDDDDDDDD' });
    quietRoom.env.GATE_SIGNING_KEY = r.env.GATE_SIGNING_KEY;
    quietRoom.env.HIDDEN_SEEN_URL = 'http://accounts.test/v1/mod/hidden-seen';
    const g4 = quietRoom.connect(); await quietRoom.hello(g4, 'ghost-0097', P, { ...HIDE, tokenSub: 'gH0st5ubBBBBBBBBBBBBBBBB' });
    for (const [g, why] of [[g2, 'no HIDDEN_SEEN_URL'], [g6, 'no receipt key'], [g4, 'plain http']]) {
      assert.ok(!welcomeOf(g), `${why}: no home`);
      assert.equal(g.sent.find((f) => f.t === 'error')?.m, 'private room', `${why}: a stranger's word`);
    }
    assert.equal(hiddenSeenOn(quietRoom.env), false);
    const cell = fakeRoom('world:3,12');
    Object.assign(cell.env, { HIDDEN_SEEN_URL: r.env.HIDDEN_SEEN_URL, ACCOUNTS: r.env.ACCOUNTS, GATE_SIGNING_KEY: r.env.GATE_SIGNING_KEY });
    const g5 = cell.connect(); await cell.hello(g5, GHOST_ID, P, HIDE);
    const g7 = fakeRoom('world:3,12'); const g7s = g7.connect(); await g7.hello(g7s, GHOST_ID, P, HIDE);
    await new Promise((res) => setTimeout(res, 20));
    assert.ok(welcomeOf(g5) && welcomeOf(g7s), 'a room that is no home asks no report');
    assert.equal(posted.length, 1, 'never over plain http, never for a room that is no private home');
    assert.equal(hiddenEntered(cell.room, 'world:3,12', GHOST_SUB), null, 'nothing goes for a room that is no home');
    assert.ok(hiddenEntered(r.room, owned, GHOST_SUB) instanceof Promise, 'a home\'s note goes');
    // an instance: staff's right, no party mark (no seat, no membership asked again)
    const inst = instanceRoomOf('dungeon:m187853213', { owner: await instanceOwnerOf('acct-alice'), epoch: '89abcdef' });
    const W = fakeRooms();
    const ir = W.room(inst);
    const carol = ir.connect(); await ir.hello(carol, 'carol');
    assert.equal(carol.sent.find((f) => f.t === 'error')?.m, 'private instance');
    const g3 = ir.connect(); await ir.hello(g3, GHOST_ID, P, HIDE);
    assert.ok(welcomeOf(g3), 'the instance admits it');
    assert.equal(g3.att.ip, undefined, 'as staff - never the party\'s guest');
    // a breach: open to it, its company's word never asked
    const { Room } = await import('../../server/src/index.js');
    const key = 'eg:0123456789abcdef';
    const breach = { _egOf: async () => ({ b: egBreachOfRoom(key) }) };
    assert.equal(await Room.prototype._egAdmit.call(breach, key, { hid: 1, subject: GHOST_SUB, kind: 'guest' }, Date.now()), null, 'the open breach admits the hidden spectator');
    assert.equal(await Room.prototype._egAdmit.call(breach, key, { subject: 'acct-x', kind: 'guest' }, Date.now()), 'the breach answers only to its company', 'a guest still is not');
    assert.equal(await Room.prototype._egAdmit.call({ _egOf: async () => null }, key, { hid: 1, subject: GHOST_SUB }, Date.now()), 'the breach is closed', 'a closed one is closed to it too');
  });
});

test('STAFF-PANEL5-HIDDEN a battle and a realm: a hidden spectator is let into a siege\'s field and a Super dungeon\'s realm without a pass, a side or a place in the realm\'s record - and the player who has none is still refused (mutants: the siege\'s pass asked of it; the realm\'s record asked of it)', async () => {
  await quiet(async () => {
    for (const key of ['siege:3021:20', 'sd:1']) {
      const r = fakeRoom(key);
      const stranger = r.connect(); await r.hello(stranger, 'strg-0001', P);
      assert.ok(!welcomeOf(stranger), `${key}: a player with no pass or place is refused`);
      const ghost = r.connect(); await r.hello(ghost, GHOST_ID, P, HIDE);
      assert.ok(welcomeOf(ghost), `${key}: the hidden spectator is let in`);
      assert.equal(ghost.att.sd, undefined, 'on no side');
      assert.ok(!ghost.att.lk, 'counted by no stone');
    }
  });
});

test('STAFF-PANEL5-HIDDEN the mark lapses: a hide order through the Worker\'s law door closes every hidden hub socket of its subject `hidden lapsed` - never one minted after it, never another subject\'s, never a player - and nobody hears it go; a forged or mis-kinded order closes nothing (mutants: the door refuses the kind; the subject unread; the order\'s time unread; a visible socket closed; the hub hands it to _takeOrder)', async () => {
  await world(async ({ W, link, drop }) => {
    const bus = W.room(SOCIAL_ROOM);
    const kg = H.hubOfSubject(GHOST_SUB);
    const game = await link('gamer', H.hubOfSubject('acct-gamer'));
    const ghost = await link('staffer', kg, { ...HIDE, peer: GHOST_ID });
    const OTHER = 'oTh3rGh0stAAAAAAAAAAAAA';
    const other = await link('staffer2', H.hubOfSubject(OTHER), { ...HIDE, tokenSub: OTHER, peer: 'ghost-0098' });
    // STAFF-PANEL5-HIDDEN-R2: a follow eye's hub link, its subject the follow token's (staffFollow.js followSubject) - the
    // account service's cut and removal push its hide order too (staff.js cutPush)
    const EYE = `hd-${'0a'.repeat(12)}`;
    const eye = await link('eye', H.hubOfSubject(EYE), { ...HIDE, tokenSub: EYE, name: 'Spectator', peer: 'eye-0001' });
    const TWIN = 'tW1nVisibleAAAAAAAAAAAAA';
    const twin = await link('twin', H.hubOfSubject(TWIN), { tokenSub: TWIN, peer: 'twin-0001', acct: undefined, asecret: undefined });   // a visible token on a subject a hide order names, as no service mints one
    const kp = await bus.signer();
    const nowS = Math.floor(Date.now() / 1000);
    const order = await mintHideOrder({ s: GHOST_SUB }, kp.privateKey, { subtle, nowS });
    const env = { ROOMS: W.ROOMS, IDENTITY_PUBLIC_KEY: bus.env.IDENTITY_PUBLIC_KEY };
    const law = (o) => worker.fetch(new Request(`https://relay.test${SAFE_LAW_PATH}`, { method: 'POST', body: JSON.stringify({ order: o }) }), env);
    // a forgery, and a mute dressed as a hide, close nothing
    const fake = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    assert.equal((await law(await mintHideOrder({ s: GHOST_SUB }, fake.privateKey, { subtle, nowS }))).status, 403);
    const mute = await mintOrder({ s: GHOST_SUB, mu: nowS + 60 }, kp.privateKey, { subtle, nowS });
    assert.equal((await law(mute)).status, 200, 'a mute is a mute');
    assert.equal(ghost.closed, null);
    const res = await law(order);
    assert.equal(res.status, 200, 'the Worker\'s door takes the hide kind');
    assert.deepEqual(await res.json(), { ok: true });
    await W.room(kg).room._hubPoll();
    for (let i = 0; i < 3; i++) { await W.room(kg).room._hubPoll(); for (const [k, rr] of W.made) if (H.isChannelBus(k)) await rr.room._downFlush(); }
    assert.equal(ghost.closed?.reason, HIDDEN_LAPSED, 'closed, never shown');
    assert.equal(eye.closed, null, 'a follow eye stands on another subject\'s order');
    assert.equal((await law(await mintHideOrder({ s: EYE }, kp.privateKey, { subtle, nowS }))).status, 200);
    for (let i = 0; i < 3; i++) { await W.room(H.hubOfSubject(EYE)).room._hubPoll(); for (const [k, rr] of W.made) if (H.isChannelBus(k)) await rr.room._downFlush(); }
    assert.equal(eye.closed?.reason, HIDDEN_LAPSED, 'and is closed by its own');
    assert.equal(other.closed, null, 'another subject\'s stands');
    assert.equal(game.closed, null, 'a player stands');
    assert.equal((await law(await mintHideOrder({ s: TWIN }, kp.privateKey, { subtle, nowS }))).status, 200);
    for (let i = 0; i < 3; i++) { await W.room(H.hubOfSubject(TWIN)).room._hubPoll(); for (const [k, rr] of W.made) if (H.isChannelBus(k)) await rr.room._downFlush(); }
    assert.equal(twin.closed, null, 'a visible socket is never closed by a hide order, whatever subject it bears');
    assert.deepEqual(leaks(game), [], 'and nobody heard it go');
    // a token minted after the order is the service's newer word
    const pub = await importPublicKeyB64(bus.env.IDENTITY_PUBLIC_KEY, { subtle });
    assert.ok(pub);
    const older = await mintHideOrder({ s: OTHER }, kp.privateKey, { subtle, nowS: nowS - 30 });
    assert.equal((await law(older)).status, 200);
    for (let i = 0; i < 3; i++) { await W.room(H.hubOfSubject(OTHER)).room._hubPoll(); for (const [k, rr] of W.made) if (H.isChannelBus(k)) await rr.room._downFlush(); }
    assert.equal(other.closed, null, 'an order older than the token closes nothing');
    await drop(game, H.hubOfSubject('acct-gamer'));
  });
});

// ═══ STAFF-PANEL5-HIDDEN-FIX (the relay flaw review, findings 3, 16, 17 and 20) ═══

test('STAFF-PANEL5-HIDDEN-FIX the relay is told where to report a home entered: HIDDEN_SEEN_URL in server/wrangler.toml is the account service\'s door, on the host the reviewer\'s feed posts to (mutants: the var gone)', () => {
  const toml = readFileSync(new URL('../../server/wrangler.toml', import.meta.url), 'utf8');
  const varOf = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
  const url = varOf('HIDDEN_SEEN_URL');
  assert.ok(url, 'set');
  assert.equal(new URL(url).pathname, HIDDEN_SEEN_PATH, 'the service\'s own path');
  assert.equal(new URL(url).origin, new URL(varOf('MOD_FEED_URL')).origin, 'the service the feed already posts to');
  assert.equal(hiddenSeenOn({ HIDDEN_SEEN_URL: url, GATE_SIGNING_KEY: 'k' }), true);
});

test('STAFF-PANEL5-HIDDEN-FIX a hidden Admin\'s /tp, on its hub shard: its ask is heard and answered from the target\'s where note alone, and the target\'s game is never sent a capture - a note unmatched or missing answers `unavailable`; a visible Admin\'s missing note still asks the game (mutants: the ask dropped; the capture asked for a hidden asker)', async () => {
  await world(async ({ link, say, tick }) => {
    const NOTE = { px: 100, py: 100, in: 1, loc: 'Daggerfall', h: 50, hm: 60, f: 40, fm: 40, m: 10, mm: 20, rk: 'dungeon:m1234' };
    const stp = (ws, k) => ws.sent.filter((f) => f.t === 'stp' && f.k === k);
    const kg = H.hubOfSubject(GHOST_SUB);
    const ghost = await link('staffer', kg, { ...HIDE, glyphs: ['dev'], peer: GHOST_ID });
    const bran = await link('bran', H.hubOfSubject('acct-bran'));
    const cleo = await link('cleo', H.hubOfSubject('acct-cleo'));
    const dev = await link('devvy', H.hubOfSubject('acct-devvy'), { glyphs: ['dev'] });
    await say(bran, H.hubOfSubject('acct-bran'), { t: 'party', p: NOTE });
    const ask = async (ws, key, m) => { tick(3000); await say(ws, key, { t: 'stp', k: 'ask', nt: 1, ...m }); return stp(ws, 'result').at(-1); };
    const quiet = await ask(ghost, kg, { name: 'bran', nonce: 'h1' });
    assert.deepEqual([quiet?.via, quiet?.id, quiet?.note?.rk], ['note', 'peer-bran', 'dungeon:m1234'], 'answered from the note');
    assert.equal(ghost.closed, null);
    assert.equal((await ask(ghost, kg, { id: 'peer-bran', nonce: 'h2', cap: 1 }))?.error, 'unavailable', 'a note its game could not place: never its game asked');
    assert.equal((await ask(ghost, kg, { name: 'cleo', nonce: 'h3' }))?.error, 'unavailable', 'no note at all: the same');
    for (const ws of [bran, cleo]) assert.equal(stp(ws, 'capture').length, 0, `${ws.att.id}'s game was sent nothing`);
    await ask(dev, H.hubOfSubject('acct-devvy'), { name: 'cleo', nonce: 'v1' });
    assert.equal(stp(cleo, 'capture').length, 1, 'a visible Admin\'s missing note still falls back to the capture');
    for (const ws of [bran, cleo, dev]) assert.deepEqual(leaks(ws), [], `${ws.att.id} heard nothing of it`);
  });
});

// STAFF-CHAT-RED (2026-10-23, mob: "give me a option next to chat to chat as /red or myself at all times"): the chat box's
// Me / Red switch, kept on Red by a hidden Admin - so its /red ask must be heard, and its line must still name nobody.
test('STAFF-CHAT-RED a hidden Admin speaks as the server: on its hub shard its /red ask (`{t:\'say\', text}`) is heard, and every shard and the bus hear the server\'s line - `{t:\'red\', text, at}` and nothing else, naming nobody; a hidden socket without the dev glyph is ignored in silence, never closed, and its other frames are still dropped (mutants: the ask dropped; the dev glyph unread for a hidden socket; the line naming its speaker)', async () => {
  await world(async ({ link, say }) => {
    const kg = H.hubOfSubject(GHOST_SUB);
    const MOD_SUB = 'gH0st5ubBBBBBBBBBBBBBBBB';
    const ghost = await link('staffer', kg, { ...HIDE, glyphs: ['dev', 'dm'], peer: GHOST_ID });   // a Dungeon Master too: its /dm dropped by the allow list, never by the glyph
    const mod = await link('staffer2', H.hubOfSubject(MOD_SUB), { ...HIDE, tokenSub: MOD_SUB, peer: 'ghost-0098' });
    const bran = await link('bran', H.hubOfSubject('acct-bran'));
    const old = await link('legacy', SOCIAL_ROOM, { hs: undefined });   // a tab from before the shards, on the bus itself
    const everyone = [ghost, mod, bran, old];
    const reds = (ws) => ofT(ws, 'red');
    await say(ghost, kg, { t: 'say', text: 'Server restarts in five minutes' });
    for (const ws of everyone) {
      assert.deepEqual(reds(ws).map((f) => f.text), ['Server restarts in five minutes'], `${ws.att.id} heard the server's line`);
      assert.deepEqual(Object.keys(reds(ws)[0]).sort(), ['at', 't', 'text'], `${ws.att.id}: a line nobody speaks - no id, no name, no subject`);
    }
    assert.equal(ghost.closed, null);
    // a hidden Moderator holds no dev glyph: its ask is the room's to ignore, silently, as any stranger's
    await say(mod, H.hubOfSubject(MOD_SUB), { t: 'say', text: 'not the server' });
    for (const ws of everyone) assert.equal(reds(ws).length, 1, `${ws.att.id} heard no line of the Moderator's`);
    assert.equal(mod.closed, null, 'never struck, never closed');
    // and the rest of what the hidden Admin says is still dropped: its line, its /dm, a roll
    await say(ghost, kg, { t: 'chat', text: 'boo' });
    await say(ghost, kg, { t: 'narrate', text: 'a voice over the game' });
    await say(ghost, kg, { t: 'roll', n: 1, m: 6, k: 0 });
    for (const ws of [bran, old]) { assert.equal(ofT(ws, 'chat').length + ofT(ws, 'dm').length + ofT(ws, 'roll').length, 0, `${ws.att.id} heard nothing else of it`); }
    for (const ws of [bran, old]) { assert.deepEqual(leaks(ws), [], `${ws.att.id} heard nothing naming it`); assert.deepEqual(leaks(ws, 'ghost-0098', MOD_SUB), [], `${ws.att.id} nor the Moderator`); }
  });
});

/** A dungeon room on a held clock (the review's probe): `fn` gets the room and the clock. */
async function onClock(fn) { const real = Date.now; const c = { t: real() }; Date.now = () => c.t; try { return await quiet(() => fn(c)); } finally { Date.now = real; } }
const at = (k = 0) => ({ x: PIXEL_UNITS + 10 + k, y: 0, z: PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });

test('STAFF-PANEL5-HIDDEN-FIX seat-live: a hidden socket is nobody there to hear a dungeon\'s seat - a lone player back from silence is sent no host frame, and a reconnecting host keeps its seat as it would with nobody watching (mutants: the silence walk counts it; the reconnect walk counts it)', async () => {
  const lone = (watched) => onClock(async (c) => {
    const r = fakeRoom('dungeon:m1291010263');
    const p = r.connect(); await r.hello(p, 'pppp-0001', at());
    c.t += 60_000;
    if (watched) { const g = r.connect(); await r.hello(g, GHOST_ID, at(1), HIDE); assert.equal(g.att.hid, 1); }
    c.t += FOES_STALE_MS + 1000;
    p.sent.length = 0;
    await r.pose(p, at(2));
    return ofT(p, 'host');
  });
  assert.deepEqual(await lone(false), [], 'alone: nothing');
  assert.deepEqual(await lone(true), [], 'watched: nothing either');
  // a host whose page blipped: the ghost in first, then the host, then a player; the host reconnects inside the player's patience
  const blip = (watched) => onClock(async (c) => {
    const r = fakeRoom('dungeon:m1291010263');
    if (watched) { const g = r.connect(); await r.hello(g, GHOST_ID, at(1), HIDE); }
    c.t += 1000;
    const a = r.connect(); await r.hello(a, 'aaaa-0001', at());
    c.t += 1000;
    const b = r.connect(); await r.hello(b, 'bbbb-0002', at(3));
    assert.equal(r.room._hostOf(), 'aaaa-0001');
    c.t += FOES_STALE_MS - 500;
    b.sent.length = 0;
    const a2 = r.connect(); await r.hello(a2, 'aaaa-0001', at());
    return [r.room._hostOf(), ofT(b, 'host').map((f) => f.id)];
  });
  assert.deepEqual(await blip(false), ['aaaa-0001', []], 'nobody watching: the host keeps its seat');
  assert.deepEqual(await blip(true), ['aaaa-0001', []], 'watched: the same');
});

test('STAFF-PANEL5-HIDDEN-FIX an asked layer holding only hidden sockets is empty, as one holding nobody - a ?ly probe learns nothing; a layer with a player in it is opened (mutants: the hidden sockets counted)', async () => {
  const had = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { const att = {}; this[0] = {}; this[1] = { att, serializeAttachment(x) { Object.assign(att, x); }, deserializeAttachment() { return att; }, close() {} }; } };
  const knock = async (r) => {
    const res = await r.room.fetch(new Request('https://relay.test/room/world:3,12', { headers: { Upgrade: 'websocket', [LAYER_HEADER]: '1', [LAYER_ASK_HEADER]: '1' } })).catch(() => null);
    return res ? { status: res.status, empty: res.headers.get(LAYER_EMPTY_HEADER) } : 'admitted';
  };
  try {
    await quiet(async () => {
      const EMPTY = { status: 503, empty: '1' };
      assert.deepEqual(await knock(fakeRoom('world:3,12')), EMPTY, 'nobody: empty');
      const ghosted = fakeRoom('world:3,12');
      const g = ghosted.connect(); g.att.ly = 1; await ghosted.hello(g, GHOST_ID, at(), HIDE);
      const seat = ghosted.connect(); seat.att = { ...seat.att, hs: 1, ly: 1 }; ghosted.room._adopt(seat, seat.att);   // a hidden seat not yet said hello
      assert.deepEqual(await knock(ghosted), EMPTY, 'only hidden sockets: empty');
      const peopled = fakeRoom('world:3,12');
      const p = peopled.connect(); p.att.ly = 1; await peopled.hello(p, 'pppp-0001', at());
      const g2 = peopled.connect(); g2.att.ly = 1; await peopled.hello(g2, GHOST_ID, at(), HIDE);
      assert.equal(await knock(peopled), 'admitted', 'a player there: opened');
    });
  } finally { globalThis.WebSocketPair = had; }
});

test('STAFF-HIDE-TOGGLE (2026-10-23, mob: "need hide to be a toggle") the relink\'s order at the relay, with no relay change: Hide me pressed, the game closes its shown socket and says hello hidden on the same id - welcomed, never `id taken`, its leave said once and its hidden join never; Show myself the other way, as ever (scenes/staffFollowHost.js relinkGame)', async () => {
  await quiet(async () => {
    for (const key of ['world:3,12', SOCIAL_ROOM]) {
      const r = fakeRoom(key);
      const raw = r.connect(); await r.hello(raw, 'rawl-0002', P);
      const shown = r.connect(); await r.hello(shown, 'mobb-0001', P, { name: 'SirMcMobdon' });
      await r.drop(shown);   // relinkGame: leave() first - the shown socket's close reaches the room before the new socket's hello
      const hid = r.connect(); await r.hello(hid, 'mobb-0001', P, { ...HIDE, secret: 'secret-of-mobb-0001' });
      assert.equal(hid.sent.find((f) => f.t === 'error'), undefined, `${key}: no refusal`);
      assert.ok(welcomeOf(hid), `${key}: welcomed hidden`);
      assert.equal(hid.att.hid, 1);
      assert.equal(ofT(raw, 'join').filter((f) => f.id === 'mobb-0001').length, 1, `${key}: the shown join alone`);
      await r.drop(hid);
      assert.equal(ofT(raw, 'leave').filter((f) => f.id === 'mobb-0001').length, 1, `${key}: the shown leave alone - the hidden one is said to nobody`);
      const back = r.connect(); await r.hello(back, 'mobb-0001', P, { name: 'SirMcMobdon' });
      assert.ok(welcomeOf(back), `${key}: and shown again`);
      assert.equal(ofT(raw, 'join').filter((f) => f.id === 'mobb-0001').length, 2);
    }
  });
});
