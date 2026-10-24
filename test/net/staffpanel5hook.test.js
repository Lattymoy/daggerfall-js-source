// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow, In game: the staff view; the
// weak spots "No camera looks through the player's eyes yet" and "The panel must not lean on game internals") - THE GAME'S
// HALF: the where note's pace on the session, the hub's `fol` door, the staff hook (net/staffHook.js) and its window
// door, the host's follow (scenes/staffFollowHost.js), and a /tp answered from a note (net/staffTeleport.js notePlace,
// followStaffPlayer, staffTpLine) - and the TP host's prepare, which loads a note's place without placing anyone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { OnlineSession } from '../../src/net/online.js';
import { SOCIAL_ROOM, CLOSE_POLICY, validPartyPose, cellRoomOfWire, rosterFor } from '../../src/net/wire.js';
import { FOLLOW_RELAY_MIN, WHERE_NOTE_MOVING_MS, WHERE_NOTE_STILL_MS } from '../../src/net/staffFollow.js';
import { createStaffHook, staffHookDoor, hiddenSeat, validTags, STAFF_HOOK_VERSION, STAFF_TOKEN_WAIT_MS, STAFF_RELINK_GAP_MS, TAGS_MAX, TAG_WHY_MAX, NAMEPLATE_DIST } from '../../src/net/staffHook.js';
import { createStaffFollowHost, staffFollowOnPage, relinkGame, followInFrame, FOLLOW_RETRY_MS, FOLLOW_RETRY_MAX_MS } from '../../src/scenes/staffFollowHost.js';
import { accountTokenMinter, SESSION_KEY, SERVICE_KEY } from '../../src/net/accountClient.js';
import { notePlace, staffTpLine, followStaffPlayer, staffDestinationKey, quietTeleportAllowed, STAFF_TP_FALLBACKS, validStaffDestination } from '../../src/net/staffTeleport.js';
import { fakeSocketClass } from '../fakeSocket.mjs';

const note = (rk = 'world:100,100', more = {}) => ({ px: 100, py: 100, in: 0, loc: 'Daggerfall', h: 50, hm: 60, f: 40, fm: 40, m: 10, mm: 20, rk, ...more });

/** A session on the hub with an account, its clock the test's. */
function hubSession(v = `world${FOLLOW_RELAY_MIN}`) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Bran', id: 'peer-bran', secret: 'secret-bran', acct: 'acct-bran', asecret: 'asecret-bran', WebSocketImpl: FakeWS, presence: false, now: () => t });
  s.join(SOCIAL_ROOM); const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'peer-bran', peers: [], n: 1, v });
  const parties = () => ws.sent.map(JSON.parse).filter((m) => m.t === 'party');
  return { s, ws, parties, tick: (ms) => { t += ms; } };
}

test('STAFF-PANEL5-FOLLOW session: a where note outside a party - one a 5 s while it changes, a keepalive a minute while it does not, and none to a relay before the follow; a member\'s pose as ever', () => {
  const { s, parties, tick } = hubSession();
  assert.equal(s.followOk, true);
  s.solo = true;
  assert.equal(s.sendParty(note()), true, 'the first goes at once');
  assert.equal(parties().at(-1).p.rk, 'world:100,100');
  tick(WHERE_NOTE_MOVING_MS - 1);
  assert.equal(s.sendParty(note('world:100,101')), false, 'a change waits the 5 s');
  tick(1);
  assert.equal(s.sendParty(note('world:100,101')), true);
  tick(WHERE_NOTE_STILL_MS - 1);
  assert.equal(s.sendParty(note('world:100,101'), { urgent: true, force: true }), false, 'still: nothing before the minute, whatever is asked');
  tick(1);
  assert.equal(s.sendParty(note('world:100,101')), true, 'the minute\'s keepalive, the same note again');
  assert.deepEqual(parties().map((m) => m.p.rk), ['world:100,100', 'world:100,101', 'world:100,101']);
  assert.equal(s.sendParty({ px: 'nowhere' }), false, 'a note the wire refuses never goes');
  // in a party: the member's pose, once a second when it changed (SOC2), as before
  s.solo = false;
  tick(1000);
  assert.equal(s.sendParty(note('world:100,102')), true);
  tick(1000);
  assert.equal(s.sendParty(note('world:100,103')), true, 'a member\'s change a second on');
  tick(1000);
  assert.equal(s.sendParty(note('world:100,103')), false, 'and an unchanged one never');
  s.leave();
  const old = hubSession(`world${FOLLOW_RELAY_MIN - 1}`);
  assert.equal(old.s.followOk, false);
  old.s.solo = true;
  assert.equal(old.s.sendParty(note()), false, 'a relay before it writes each one at once: none goes there');
  old.s.solo = false;
  assert.equal(old.s.sendParty(note()), true, 'a member\'s goes, as ever');
  old.s.leave();
});

test('STAFF-PANEL5-FOLLOW session: the hub\'s `fol` reaches onFollow through the wire\'s door, from the hub alone', () => {
  const { s, ws } = hubSession();
  const heard = [];
  s.onFollow = (f) => heard.push(f);
  ws.receive({ t: 'fol', k: 'on', sub: 'acct-target' });
  ws.receive({ t: 'fol', k: 'note', sub: 'acct-target', p: note(), ag: 2 });
  ws.receive({ t: 'fol', k: 'on', sub: 'x' });
  ws.receive({ t: 'fol', k: 'nope', sub: 'acct-target' });
  assert.deepEqual(heard, [{ k: 'on', sub: 'acct-target' }, { k: 'note', sub: 'acct-target', p: validPartyPose(note()), ag: 2 }]);
  s.leave();
  // a cell's socket saying it is no hub
  const { FakeWS, sockets } = fakeSocketClass();
  const cell = new OnlineSession({ url: 'wss://relay.test', name: 'Bran', id: 'peer-c', secret: 'secret-c', WebSocketImpl: FakeWS, presence: true });
  cell.join('world:100,100', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }); sockets[0].open();
  sockets[0].receive({ t: 'welcome', id: 'peer-c', peers: [], n: 1, v: `world${FOLLOW_RELAY_MIN}` });
  const told = [];
  cell.onFollow = (f) => told.push(f);   // a throw here is contained (online.js _deliver): counted instead
  sockets[0].receive({ t: 'fol', k: 'on', sub: 'acct-target' });
  assert.deepEqual(told, [], 'a room is not the hub');
  cell.leave();
});

/** A session double: what the hook asks of the sessions it makes. */
function fakeSessions() {
  const made = [];
  class Session {
    constructor(o) { this.o = o; this.room = null; this.joins = []; this.poses = []; this.ticks = 0; this.left = false; this.peers = new Map(); this.layerHint = 0; made.push(this); }
    join(room, pose) { this.room = room; this.joins.push([room, pose, this.layerHint]); }
    leave() { this.left = true; this.room = null; }
    tick() { this.ticks++; }
    sendPose(p) { this.poses.push(p); }
    // LEASE1's two doors, as online.js keeps them: a lease handed on is kept; a lane takes another's kept one
    sendLease(l) { this._lease = l; (this.leases ??= []).push(l); }
    leaseFrom(s) { if (typeof s?._lease === 'string') this._lease = s._lease; }
    drawable() { return [...this.peers.values()].filter((p) => p.shown); }   // STAFF-VIEW1: online.js's, of the peers this fake holds
  }
  return { Session, made };
}

test('STAFF-PANEL5-FOLLOW hook: a follow holds a hub link on the panel\'s tokens, locks only on the hub\'s own `on`, watches from the room the hub names, and lets go', async () => {
  const { Session, made } = fakeSessions();
  const asked = [];
  const main = { url: 'wss://relay.test' };
  const hook = createStaffHook({ main: () => main, askToken: async (sub, room) => { asked.push([sub, room]); return 'tok'; }, Session });
  assert.equal(hook.version, STAFF_HOOK_VERSION);
  assert.equal(hook.follow('x'), false, 'no account, no follow');
  hook.tick();
  assert.equal(made.length, 0, 'nothing followed: no socket');
  assert.equal(hook.follow('acct-target'), true);
  hook.tick();
  const [hub] = made;
  assert.deepEqual([hub.o.presence, hub.o.name, hub.room, hub.o.url], [false, 'Spectator', SOCIAL_ROOM, 'wss://relay.test']);
  assert.equal(hub.o.acct, undefined, 'never the staff member\'s account');
  assert.equal(await hub.o.mintToken(SOCIAL_ROOM), 'tok');
  assert.deepEqual(asked, [['acct-target', SOCIAL_ROOM]]);
  assert.equal(hook.locked(), false, 'no camera before the hub says `on`');
  assert.equal(hook.view(), null);
  hook.heard({ k: 'on', sub: 'acct-someone-else' });
  assert.equal(hook.locked(), false, 'another follow\'s word is not mine');
  hook.heard({ k: 'note', sub: 'acct-target', p: validPartyPose(note('dungeon:m1234', { in: 1, ly: 2 })) });
  hook.tick();
  assert.equal(made.length, 1, 'no room before `on`');
  hub.onFollow({ k: 'on', sub: 'acct-target' });
  assert.equal(hook.locked(), true);
  hook.tick();
  const eye = made[1];
  assert.deepEqual([eye.o.presence, eye.room, eye.joins[0][2]], [true, 'dungeon:m1234', 2], 'the note\'s room, on its layer');
  assert.equal(hook.room(), 'dungeon:m1234');
  assert.equal(hook.place().kind, 'dungeon');
  // the target seen in that room: the view, and the room link stands on them for range
  const pose = { x: 5, y: 1, z: 7, yaw: 1.5, pitch: -0.2, mv: 1 };
  eye.peers.set('peer-t', { sub: 'acct-target', shown: pose });
  eye.peers.set('peer-o', { sub: 'acct-other', shown: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 } });
  assert.deepEqual(hook.view(), pose);
  hook.tick();
  assert.deepEqual(eye.poses.at(-1), pose);
  // a room's own word moves it; `out` waits for the next note
  hook.heard({ k: 'in', sub: 'acct-target', room: 'interior:m12.345', ly: 0 });
  hook.tick();
  assert.equal(eye.room, 'interior:m12.345');
  hook.heard({ k: 'out', sub: 'acct-target', room: 'interior:m12.345' });
  assert.equal(hook.room(), 'interior:m12.345');
  hook.heard({ k: 'gone', sub: 'acct-target' });
  assert.equal(hook.room(), null, 'offline: the follow waits');
  assert.equal(hook.locked(), true, 'and still holds - only Unlock or another pick lets go');
  // another pick: everything let go at once, and a fresh follow
  assert.equal(hook.follow('acct-second'), true);
  assert.ok(hub.left && eye.left);
  assert.equal(hook.locked(), false);
  hook.tick();
  assert.equal(made.length, 3);
  hook.unlock();
  assert.ok(made[2].left);
  assert.equal(hook.target(), null);
  assert.equal(await made[2].o.mintToken('world:1,1'), null, 'a let-go follow\'s link asks for no token');
  hook.tick();
  assert.equal(made.length, 3);
});

test('STAFF-PANEL5-FOLLOW hook: outdoors the target\'s own pose names the next cell before their note does', () => {
  const { Session, made } = fakeSessions();
  const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken: async () => 'tok', Session });
  hook.follow('acct-target'); hook.tick();
  made[0].onFollow({ k: 'on', sub: 'acct-target' });
  const a = { x: 100 * 32768 + 10, z: (499 - 100) * 32768 + 10 }, b = { x: 140 * 32768 + 10, z: (499 - 100) * 32768 + 10 };
  const ca = cellRoomOfWire(a.x, a.z), cb = cellRoomOfWire(b.x, b.z);
  assert.notEqual(ca, cb);
  hook.heard({ k: 'note', sub: 'acct-target', p: validPartyPose({ ...note(ca), wx: a.x, wy: 3, wz: a.z }) });
  hook.tick();
  const eye = made[1];
  assert.equal(eye.room, ca);
  assert.deepEqual(eye.joins[0][1], { x: a.x, y: 3, z: a.z, yaw: 0, pitch: 0, mv: 0 }, 'stood on the note\'s feet before they are seen');
  eye.peers.set('p', { sub: 'acct-target', shown: { x: b.x, y: 0, z: b.z, yaw: 0, pitch: 0 } });
  hook.tick();
  assert.equal(eye.room, cb);
  assert.equal(hook.room(), ca, 'the note\'s room stands until the hub says another');
});

test('STAFF-PANEL5-FOLLOW-R2 hook: the hub\'s newer word wins over an older pose - a fast travel, a door out, a word heard while they are still seen; a pose seen after it leads again, and an interior\'s own pose names no outdoor cell', () => {
  const { Session, made } = fakeSessions();
  const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken: async () => 'tok', Session });
  hook.follow('acct-target'); hook.tick();
  made[0].onFollow({ k: 'on', sub: 'acct-target' });
  const at = (px, pz) => ({ x: px * 32768 + 10, y: 3, z: (499 - pz) * 32768 + 10, yaw: 0, pitch: 0 });
  const cellOf = (p) => cellRoomOfWire(p.x, p.z);
  const feet = (p) => ({ wx: p.x, wy: p.y, wz: p.z });
  const noteAt = (rk, more = {}) => hook.heard({ k: 'note', sub: 'acct-target', p: validPartyPose({ ...note(rk), ...more }) });
  const a = at(100, 100), b = at(140, 100), f = at(300, 300), g = at(200, 40);
  assert.equal(new Set([a, b, f, g].map(cellOf)).size, 4);
  noteAt(cellOf(a), feet(a));
  hook.tick();
  const eye = made[1];
  const seeAt = (p) => eye.peers.set('p', { sub: 'acct-target', shown: p });
  const unseen = () => eye.peers.delete('p');
  // locked on in their cell: the view, and the eye stands on them
  seeAt(a); hook.tick();
  assert.deepEqual([eye.room, hook.view(), eye.poses.at(-1)], [cellOf(a), a, a]);
  // a fast travel heard while their last pose still stands here: they are seen here after it, so the eye stays on them...
  noteAt(cellOf(f), feet(f));
  hook.tick();
  assert.deepEqual([eye.room, eye.poses.at(-1)], [cellOf(a), a], 'still seen where I watch: not left for a word');
  // ...until they are gone from the room I saw them in: the note's room, on the note's feet
  unseen(); hook.tick();
  assert.equal(eye.room, cellOf(f), 'gone from the room I saw them in: the hub\'s word leads');
  assert.deepEqual(eye.joins.at(-1)[1], { x: f.x, y: 3, z: f.z, yaw: 0, pitch: 0, mv: 0 }, 'on the note\'s feet, not the old cell\'s pose');
  // their own pose leads to the next cell; a newer note while I have not seen them there wins
  seeAt({ ...f, x: b.x, z: b.z }); hook.tick();
  assert.equal(eye.room, cellOf(b), 'the pose seen after the note leads again');
  unseen(); hook.tick();
  assert.equal(eye.room, cellOf(b), 'on the way: the pose that led holds while nothing newer is said');
  noteAt(cellOf(g), feet(g));
  hook.tick();
  assert.equal(eye.room, cellOf(g), 'a fast travel while the eye was on its way: the note wins');
  // a room's word wins the same way
  seeAt({ ...g, x: a.x, z: a.z }); hook.tick();
  assert.equal(eye.room, cellOf(a));
  unseen();
  hook.heard({ k: 'in', sub: 'acct-target', room: cellOf(f) });
  hook.tick();
  assert.equal(eye.room, cellOf(f), 'a room said they came: that room, not the older pose\'s');
  // a door in, while their last pose still stands in the cell: the note's room at once
  seeAt(f); hook.tick();
  const bk = (5 << 16) + (9 << 8) + 42, inside = `interior:m99.${bk}`;
  noteAt(inside, { in: 2, bk });
  hook.tick();
  assert.equal(eye.room, inside);
  // inside, a pose in the interior's own frame: locked on, and stood on
  const pin = { x: 12, y: 1, z: 30, yaw: 0, pitch: 0 };
  seeAt(pin); hook.tick();
  assert.deepEqual([hook.view(), eye.poses.at(-1)], [pin, pin], 'locked on within the room');
  // a door out, heard while their interior pose still stands: the note's cell, on its feet - never a cell the interior's
  // own numbers name
  const c = at(101, 100);
  noteAt(cellOf(c), feet(c));
  hook.tick();
  assert.equal(eye.room, cellOf(c), `not ${cellRoomOfWire(pin.x, pin.z)}`);
  assert.deepEqual(eye.joins.at(-1)[1], { x: c.x, y: 3, z: c.z, yaw: 0, pitch: 0, mv: 0 }, 'on the note\'s feet, not the interior\'s pose');
  hook.unlock();
});

test('STAFF-PANEL5-FOLLOW-FIX hook, on real sessions: a place room names no account, so the target is found by the id the room said (finding 1); the hub\'s lease rides the eye (finding 5); the eye alone asks a hidden seat (finding 18)', async () => {
  const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
  const { FakeWS, sockets } = fakeSocketClass();
  const v = `world${FOLLOW_RELAY_MIN}`;
  const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken: async () => 'tok', WS: FakeWS });
  const idOf = (ws) => ws.sent.map(JSON.parse).find((m) => m.t === 'hello').id;
  hook.follow('acct-target'); hook.tick();
  const [hub] = sockets;
  assert.equal(hub.url, `wss://relay.test/room/${SOCIAL_ROOM}`, 'the hub link asks no hidden seat: the reserve is a few a room, and the hub holds every hidden staff game');
  hub.open(); await flush();
  hub.receive({ t: 'welcome', id: idOf(hub), peers: [], n: 1, v });
  hub.receive({ t: 'lease', l: 'lease-1' });   // before there is an eye to hand it to
  hub.receive({ t: 'fol', k: 'on', sub: 'acct-target' });
  const a = { x: 100 * 32768 + 10, y: 3, z: (499 - 100) * 32768 + 10 };
  const cell = cellRoomOfWire(a.x, a.z);
  hub.receive({ t: 'fol', k: 'note', sub: 'acct-target', p: note(cell, { wx: a.x, wy: a.y, wz: a.z }), ag: 0 });
  assert.equal(hook.locked(), true);
  hook.tick();
  const eye = sockets[1];
  assert.equal(eye.url, `wss://relay.test/room/${cell}?hd=1`, 'a hidden seat, from the reserve over a full layer');
  const Seat = hiddenSeat(FakeWS);
  assert.equal(new Seat('wss://relay.test/room/world:1,1?ly=2').url, 'wss://relay.test/room/world:1,1?ly=2&hd=1', 'beside a layer asked');
  assert.ok(new Seat('wss://relay.test/room/x') instanceof FakeWS);
  eye.open(); await flush();
  // the cell's welcome as the relay writes it (wire.js rosterFor): the target's row carries no account
  const pose = { x: a.x + 5, y: 3, z: a.z + 7, yaw: 1.5, pitch: -0.2 };
  const peers = rosterFor([{ id: 'peer-t', name: 'Bran', look: null, pose, sub: 'acct-target' }], idOf(eye));
  assert.equal('sub' in peers[0], false);
  eye.receive({ t: 'welcome', id: idOf(eye), peers, n: 2, v });
  assert.equal(hook.view(), null, 'not by account: the room never says one');
  hub.receive({ t: 'fol', k: 'in', sub: 'acct-target', room: cell, id: 'peer-t' });
  assert.deepEqual([hook.view()?.x, hook.view()?.z, hook.view()?.yaw], [pose.x, pose.z, pose.yaw], 'by the id the room said');
  hook.tick();
  const said = eye.sent.map(JSON.parse);
  const at = said.findIndex((m) => m.t === 'pose');
  assert.ok(at > 0, JSON.stringify(said.map((m) => m.t)));
  assert.deepEqual(said[at - 1], { t: 'lease', l: 'lease-1' }, 'the hub\'s lease from before the eye, ahead of its first pose');
  assert.deepEqual([said[at].p.x, said[at].p.z], [pose.x, pose.z], 'standing on the target, for range');
  hook.heard({ k: 'gone', sub: 'acct-target' });
  assert.equal(hook.view(), null, 'offline: their next socket\'s id is the next room\'s word');
  hook.unlock();
});

test('STAFF-PANEL5-FOLLOW-R2 hook, on real sessions: once locked on, a fast travel and a door out still move the eye to the note\'s cell, on the note\'s feet - the last pose seen leads nowhere after they left its room', async () => {
  const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
  const v = `world${FOLLOW_RELAY_MIN}`;
  const idOf = (ws) => ws.sent.map(JSON.parse).find((m) => m.t === 'hello').id;
  const helloPose = (ws) => ws.sent.map(JSON.parse).find((m) => m.t === 'hello').pose;
  const at = (px, pz) => ({ x: px * 32768 + 10, y: 3, z: (499 - pz) * 32768 + 10 });
  const noteAt = (p, more = {}) => ({ t: 'fol', k: 'note', sub: 'acct-target', p: note(cellRoomOfWire(p.x, p.z), { px: Math.trunc(p.x / 32768), wx: p.x, wy: p.y, wz: p.z, ...more }), ag: 0 });
  const a = at(100, 100), cellA = cellRoomOfWire(a.x, a.z);
  for (const leg of ['fast travel', 'door out']) {
    const { FakeWS, sockets } = fakeSocketClass();
    const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken: async () => 'tok', WS: FakeWS });
    hook.follow('acct-target'); hook.tick();
    const [hub] = sockets;
    hub.open(); await flush();
    hub.receive({ t: 'welcome', id: idOf(hub), peers: [], n: 1, v });
    hub.receive({ t: 'lease', l: 'lease-1' });
    hub.receive({ t: 'fol', k: 'on', sub: 'acct-target' });
    hub.receive(noteAt(a));
    hook.tick();
    let eye = sockets.at(-1);
    eye.open(); await flush();
    const there = { x: a.x + 5, y: 3, z: a.z + 7, yaw: 1.5, pitch: -0.2 };
    eye.receive({ t: 'welcome', id: idOf(eye), peers: rosterFor([{ id: 'peer-t', name: 'Bran', look: null, pose: there, sub: 'acct-target' }], idOf(eye)), n: 2, v });
    hub.receive({ t: 'fol', k: 'in', sub: 'acct-target', room: cellA, id: 'peer-t' });
    hook.tick();
    assert.deepEqual([hook.view()?.x, hook.view()?.z], [there.x, there.z], `${leg}: locked on in their cell`);
    let to = at(300, 300);
    if (leg === 'door out') {
      const bk = (5 << 16) + (9 << 8) + 42, inside = `interior:m99.${bk}`;
      hub.receive({ t: 'fol', k: 'note', sub: 'acct-target', p: note(inside, { in: 2, bk }), ag: 0 });
      hook.tick();
      eye = sockets.at(-1);
      assert.equal(eye.url, `wss://relay.test/room/${inside}?hd=1`);
      eye.open(); await flush();
      eye.receive({ t: 'welcome', id: idOf(eye), peers: rosterFor([{ id: 'peer-t', name: 'Bran', look: null, pose: { x: 12, y: 1, z: 30, yaw: 0, pitch: 0 }, sub: 'acct-target' }], idOf(eye)), n: 2, v });
      hook.tick();
      assert.deepEqual([hook.view()?.x, hook.view()?.z], [12, 30], 'locked on inside, in the interior\'s own frame');
      to = at(101, 100);
    }
    eye.receive({ t: 'leave', id: 'peer-t' });
    hub.receive(noteAt(to));
    for (let i = 0; i < 3; i++) hook.tick();
    const cellTo = cellRoomOfWire(to.x, to.z), last = sockets.at(-1);
    assert.equal(last.url, `wss://relay.test/room/${cellTo}?hd=1`, `${leg}: the eye goes to the note's cell (${sockets.slice(1).map((s) => s.url)})`);
    assert.ok(!sockets.some((s) => s.url.includes(cellRoomOfWire(12, 30))), 'never the cell an interior\'s own numbers name');
    last.open(); await flush();
    assert.deepEqual([helloPose(last)?.x, helloPose(last)?.z], [to.x, to.z], 'standing on the note\'s feet');
    last.receive({ t: 'welcome', id: idOf(last), peers: [], n: 1, v });
    hook.tick();
    const said = last.sent.map(JSON.parse), first = said.findIndex((m) => m.t === 'pose');
    assert.deepEqual([said[first - 1], said[first]?.p?.x], [{ t: 'lease', l: 'lease-1' }, to.x], 'the hub\'s lease rides the new room ahead of its first pose (leaseDoor on), on the note\'s feet');
    hook.unlock();
  }
});

/** STAFF-PANEL5-FOLLOW-R3: a follow on real sessions, its hub and its eye, and the target at the seam of world:6,6 and
 *  world:7,6 - the room's welcome shows them by the socket id the hub's `in` said. */
async function seamFollow() {
  const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
  const v = `world${FOLLOW_RELAY_MIN}`;
  const { FakeWS, sockets } = fakeSocketClass();
  const counts = { mints: 0 };
  const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken: async () => { counts.mints++; return 'tok'; }, WS: FakeWS });
  const idOf = (ws) => ws.sent.map(JSON.parse).find((m) => m.t === 'hello').id;
  const roomOf = (ws) => ws.url.replace('wss://relay.test/room/', '').replace('?hd=1', '');
  const at = (px) => ({ x: px * 32768 + 10, y: 3, z: (499 - 100) * 32768 + 10, yaw: 0, pitch: 0 });
  const A = at(111), B = at(112), cellA = cellRoomOfWire(A.x, A.z), cellB = cellRoomOfWire(B.x, B.z);
  assert.deepEqual([cellA, cellB], ['world:6,6', 'world:7,6']);
  hook.follow('acct-target'); hook.tick();
  const [hub] = sockets;
  hub.open(); await flush();
  hub.receive({ t: 'welcome', id: idOf(hub), peers: [], n: 1, v });
  hub.receive({ t: 'fol', k: 'on', sub: 'acct-target' });
  const say = (f) => hub.receive({ t: 'fol', sub: 'acct-target', ...f });
  const noteAt = (p) => say({ k: 'note', p: note(cellRoomOfWire(p.x, p.z), { px: Math.trunc(p.x / 32768), wx: p.x, wy: p.y, wz: p.z }), ag: 0 });
  /** The eye's room opens and welcomes it, the target in it at `pose` (or not there). */
  const welcome = async (pose) => {
    const eye = sockets.at(-1);
    eye.open(); await flush();
    eye.receive({ t: 'welcome', id: idOf(eye), peers: pose ? rosterFor([{ id: 'peer-t', name: 'Bran', look: null, pose }], idOf(eye)) : [], n: pose ? 2 : 1, v });
    hook.tick(); await flush();
  };
  const step = async () => { hook.tick(); await flush(); };
  const eyes = () => sockets.slice(1).map(roomOf);
  return { hook, sockets, counts, A, B, cellA, cellB, say, noteAt, welcome, step, eyes };
}

test('STAFF-PANEL5-FOLLOW-R3 hook, on real sessions: a target at a seam - the eye\'s own `in` from the cell it just left, said through the bus a few frames behind, no longer sends it back: it locks on, one socket a cell', async () => {
  const { hook, sockets, counts, A, B, cellA, cellB, say, noteAt, welcome, step, eyes } = await seamFollow();
  noteAt(B); await step();
  await welcome(B);
  say({ k: 'in', room: cellB, id: 'peer-t' }); await step();
  assert.ok(hook.view(), 'locked on in their cell');
  // they step over the seam into A: B (their halo now) shows them there, and the eye goes to A
  sockets.at(-1).receive({ t: 'pose', id: 'peer-t', p: { ...A, ts: 1 } }); await step();
  assert.deepEqual(eyes(), [cellB, cellA]);
  // and back: A's welcome (their halo) shows them in B, and the eye goes back to B...
  await welcome(B);
  assert.deepEqual(eyes(), [cellB, cellA, cellB]);
  // ...while A's word for the eye's own hello there, through the bus, lands after: no newer than the pose A showed
  say({ k: 'in', room: cellA, id: 'peer-t' });
  for (let i = 0; i < 4; i++) await step();
  assert.deepEqual(eyes(), [cellB, cellA, cellB], 'the eye stays on its way to B - no flip back to A');
  await welcome(B);
  say({ k: 'in', room: cellB, id: 'peer-t' });
  for (let i = 0; i < 4; i++) await step();
  assert.deepEqual([hook.view()?.x, hook.room()], [B.x, cellB], 'locked on in B');
  assert.deepEqual([sockets.length - 1, counts.mints], [3, 4], 'three eye sockets, four tokens (the hub\'s and one a room joined)');
  hook.unlock();
});

test('STAFF-PANEL5-FOLLOW-R3 hook, on real sessions: a note sent before the crossing, naming the cell the eye just left on their pose, keeps it on its way; a note still wins once the cell it went to welcomed it without them', async () => {
  const { hook, sockets, A, B, cellA, cellB, say, noteAt, welcome, step, eyes } = await seamFollow();
  noteAt(A); await step();
  await welcome(A);
  say({ k: 'in', room: cellA, id: 'peer-t' }); await step();
  assert.ok(hook.view(), 'locked on in their cell');
  // they cross into B: A shows them there, and the eye goes on to B
  sockets.at(-1).receive({ t: 'pose', id: 'peer-t', p: { ...B, ts: 1 } }); await step();
  assert.deepEqual(eyes(), [cellA, cellB]);
  // their last note from A, written before the crossing, lands now
  noteAt(A);
  for (let i = 0; i < 4; i++) await step();
  assert.deepEqual(eyes(), [cellA, cellB], 'a late note naming the cell the pose was seen in sends the eye back nowhere');
  await welcome(B);
  assert.deepEqual([hook.view()?.x, hook.room()], [B.x, cellA], 'locked on in B, the note\'s room standing until the hub says another');
  // they step back into A: B shows them there, the eye goes - and before A welcomes it they recall to the far side of B
  sockets.at(-1).receive({ t: 'pose', id: 'peer-t', p: { ...A, ts: 2 } }); await step();
  assert.deepEqual(eyes(), [cellA, cellB, cellA]);
  await welcome(null);
  assert.deepEqual(eyes(), [cellA, cellB, cellA], 'on its way, the pose that led holds');
  noteAt(B);
  for (let i = 0; i < 4; i++) await step();
  assert.deepEqual(eyes(), [cellA, cellB, cellA, cellB], 'A welcomed the eye without them: their note naming B wins, though B is where the pose was seen');
  hook.unlock();
});

test('STAFF-PANEL5-FOLLOW-FIX hook: a lease the hub hands after the eye is made reaches it too (finding 5); a follow into a home asks that room, and the place is the home (finding 2)', async () => {
  const { Session, made } = fakeSessions();
  const asked = [];
  const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken: async (sub, room) => { asked.push([sub, room]); return 'tok'; }, Session });
  hook.follow('acct-target'); hook.tick();
  const [hub] = made;
  hub.onFollow({ k: 'on', sub: 'acct-target' });
  const bk = (5 << 16) + (9 << 8) + 42, home = `owned:${'a'.repeat(32)}.${'b'.repeat(16)}:99.${bk}`;
  hook.heard({ k: 'note', sub: 'acct-target', p: validPartyPose(note(home, { in: 2, bk })) });
  assert.equal(hook.room(), home, 'their home is a room the follow enters');
  hook.tick();
  const eye = made[1];
  assert.equal(eye.room, home);
  assert.equal(await eye.o.mintToken(home), 'tok');
  assert.deepEqual(asked.at(-1), ['acct-target', home], 'its token asked by name - the service writes `follow-home`');
  assert.deepEqual([hook.place()?.kind, hook.place()?.privateRoom], ['interior', home]);
  hub.onLease('lease-2');
  assert.deepEqual(eye.leases, ['lease-2'], 'handed to the eye');
  assert.equal(hub._lease, 'lease-2', 'and kept on the hub link, for an eye made later');
  hook.unlock();
});

test('STAFF-PANEL5-FOLLOW hook door: same window and origin alone; the version, a follow, Unlock, and the panel\'s tokens', async () => {
  const listeners = [], posted = [], timers = new Map();
  const win = { location: { origin: 'https://game.test' }, addEventListener: (k, f) => { assert.equal(k, 'message'); listeners.push(f); }, postMessage: (m, o) => posted.push([m, o]) };
  const calls = [];
  const hook = { follow: (s) => calls.push(['follow', s]), unlock: () => calls.push(['unlock']) };
  const door = staffHookDoor(win, () => hook, { setTimer: (f, ms) => { const k = Symbol('t'); timers.set(k, [f, ms]); return k; }, clearTimer: (k) => timers.delete(k) });
  const say = (data, more = {}) => listeners[0]({ source: win, origin: 'https://game.test', data, ...more });
  assert.equal(door.panel(), false);
  say({ dfoStaff: 'hook?' }, { origin: 'https://evil.test' });
  say({ dfoStaff: 'hook?' }, { source: {} });
  assert.equal(posted.length, 0, 'another origin or window is not the panel');
  say({ dfoStaff: 'hook?' });
  assert.deepEqual(posted.at(-1), [{ dfoStaff: 'hook', v: STAFF_HOOK_VERSION }, 'https://game.test']);
  assert.equal(door.panel(), true);
  say({ dfoStaff: 'follow', sub: 'acct-target' });
  say({ dfoStaff: 'unlock' });
  say({ dfoStaff: 'act', act: 'freeze', sub: 'acct-target' });
  assert.deepEqual(calls, [['follow', 'acct-target'], ['unlock']]);
  // a token asked and answered; my own ask (no `tok`) is never taken for an answer
  const p = door.askToken('acct-target', 'world:1,1');
  assert.deepEqual(posted.at(-1), [{ dfoStaff: 'token', sub: 'acct-target', room: 'world:1,1' }, 'https://game.test']);
  say({ dfoStaff: 'token', sub: 'acct-target', room: 'world:1,1' });
  say({ dfoStaff: 'token', sub: 'acct-target', room: 'world:9,9', tok: 'other' });
  say({ dfoStaff: 'token', sub: 'acct-target', room: 'world:1,1', tok: 'v1.abc.def' });
  assert.equal(await p, 'v1.abc.def');
  assert.equal(timers.size, 0);
  // unanswered: null when the wait is out; refused: null
  const late = door.askToken('acct-target', 'world:2,2');
  const [[f, ms]] = timers.values();
  assert.equal(ms, STAFF_TOKEN_WAIT_MS);
  f();
  assert.equal(await late, null);
  const refused = door.askToken('acct-target', 'world:3,3');
  say({ dfoStaff: 'token', sub: 'acct-target', room: 'world:3,3', tok: null });
  assert.equal(await refused, null);
  const long = door.askToken('acct-target', 'world:4,4');
  say({ dfoStaff: 'token', sub: 'acct-target', room: 'world:4,4', tok: 'x'.repeat(1025) });
  assert.equal(await long, null, 'longer than any token');
  // with no window at all the door stands and every ask is no token
  const none = staffHookDoor(undefined, () => hook);
  await assert.rejects(none.askToken('acct-target', 'world:1,1'));
});

test('STAFF-VIEW1 hook: peers() is the followed room\'s players as the eye draws them - nobody before the eye stands, and nobody once let go (the host\'s own room is left while a follow is locked, so these are the only players the staff view can tag)', () => {
  const { Session, made } = fakeSessions();
  const hook = createStaffHook({ main: () => ({ url: 'wss://relay.test' }), askToken: async () => 'tok', Session });
  assert.deepEqual(hook.peers(), [], 'no follow');
  hook.follow('acct-target'); hook.tick();
  made[0].onFollow({ k: 'on', sub: 'acct-target' });
  hook.heard({ k: 'note', sub: 'acct-target', p: validPartyPose(note('dungeon:m1234', { in: 1 })) });
  assert.deepEqual(hook.peers(), [], 'the hub\'s link alone: no room yet');
  hook.tick();
  const eye = made[1];
  const t = { id: 'peer-t', sub: 'acct-target', shown: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 } }, o = { id: 'peer-o', shown: { x: 4, y: 5, z: 6, yaw: 0, pitch: 0 } };
  eye.peers.set('peer-t', t); eye.peers.set('peer-o', o); eye.peers.set('peer-gone', { id: 'peer-gone' });
  assert.deepEqual(hook.peers(), [t, o], 'the eye\'s drawable');
  hook.unlock();
  assert.deepEqual(hook.peers(), [], 'let go');
});

test('FOLLOW-BODIES (mob, 2026-10-24: "cant see other players bodys"): while a follow is locked the scene draws the players around the target - the eye\'s room less the target, whose eyes the camera is - and the game\'s own room otherwise (mutants: the target kept, the game\'s room while locked)', () => {
  const { Session, made } = fakeSessions();
  const mine = [{ id: 'peer-mine' }];
  const main = { url: 'wss://relay.test', drawable: () => mine };
  const page = staffFollowOnPage({ main: () => main, prepare: async () => {}, mode: () => 'exterior', pixel: () => ({ x: 1, y: 2 }), toScene: (p) => [p.x, p.y, p.z], win: { location: { origin: 'https://game.test' }, addEventListener() {}, postMessage() {} }, Session, entity: null });
  assert.deepEqual(page.drawable(), mine, 'no follow: the game\'s own room');
  const hook = page.hook;
  hook.follow('acct-target', { room: 'world:1,1', id: 'peer-t' }); hook.tick();
  made[0].onFollow({ k: 'on', sub: 'acct-target' });
  hook.tick();
  const eye = made[1];
  const t = { id: 'peer-t', shown: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 } }, o = { id: 'peer-o', shown: { x: 4, y: 5, z: 6, yaw: 0, pitch: 0 } }, s = { id: 'peer-s', sub: 'acct-target', shown: { x: 7, y: 8, z: 9, yaw: 0, pitch: 0 } };
  eye.peers.set('peer-t', t); eye.peers.set('peer-o', o); eye.peers.set('peer-s', s);
  assert.deepEqual(page.drawable(), [o], 'locked: the others around the target, never the target (by socket or by account)');
  hook.unlock();
  assert.deepEqual(page.drawable(), mine, 'let go: the game\'s own room again');
});

test('STAFF-VIEW1 hook door: `tags?` to this page\'s own origin; a `tags` answer kept as validTags reads it - from this window and origin alone, an account that is an account id, a known level, words of TAG_WHY_MAX at most, TAGS_MAX rows, a distance Your settings offers - and an answer with no list keeps the last (mutants: each check dropped, the ask to \'*\')', () => {
  const listeners = [], posted = [];
  const win = { location: { origin: 'https://game.test' }, addEventListener: (_k, f) => listeners.push(f), postMessage: (m, o) => posted.push([m, o]) };
  const door = staffHookDoor(win, () => null);
  const say = (data, more = {}) => listeners[0]({ source: win, origin: 'https://game.test', data, ...more });
  assert.equal(door.tags(), null, 'none before an answer');
  door.askTags();
  assert.deepEqual(posted, [[{ dfoStaff: 'tags?' }, 'https://game.test']]);
  assert.equal(door.panel(), false, 'an ask is not the panel speaking');
  const good = { dfoStaff: 'tags', dist: 200, list: [{ sub: 'acct-a', level: 'high', why: '4 reports' }] };
  say(good, { origin: 'https://evil.test' });
  say(good, { source: {} });
  assert.equal(door.tags(), null, 'another origin or window is not the panel');
  say(good);
  assert.deepEqual([door.tags().dist, [...door.tags().flags]], [200, [['acct-a', { level: 'high', why: '4 reports', watch: false }]]]);
  say({ dfoStaff: 'tags', dist: 200 });
  assert.equal(door.tags().flags.size, 1, 'no list: the last answer stands');
  say({ dfoStaff: 'tags', list: [] });
  assert.deepEqual([door.tags().dist, door.tags().flags.size], [NAMEPLATE_DIST, 0], 'an empty answer is an answer');
  // row by row
  const read = (list, dist = 100) => validTags({ list, dist });
  assert.deepEqual([...read([{ sub: 'x', level: 'high', why: 'w' }, { sub: 'acct a', level: 'high' }, { sub: 7, level: 'high' }, { sub: 'acct-b'.repeat(8), level: 'high' }]).flags], [], 'no account id, no row');
  assert.deepEqual([...read([{ sub: 'acct-a', level: 'urgent', why: 'w' }, { sub: 'acct-b', why: 'w' }]).flags], [], 'no known level and no watch: nothing to show');
  assert.deepEqual(read([{ sub: 'acct-a', level: 'low', why: 'x'.repeat(TAG_WHY_MAX + 1) }, { sub: 'acct-b', level: 'low', why: 'x'.repeat(TAG_WHY_MAX) }, { sub: 'acct-c', level: 'low', why: 12 }]).flags, new Map([['acct-a', { level: 'low', why: '', watch: false }], ['acct-b', { level: 'low', why: 'x'.repeat(TAG_WHY_MAX), watch: false }], ['acct-c', { level: 'low', why: '', watch: false }]]), 'long or odd words are no words');
  assert.deepEqual([...read([{ sub: 'acct-a', watch: 'yes', level: 'low', why: 'w' }, { sub: 'acct-b', watch: 1 }]).flags], [['acct-a', { level: 'low', why: 'w', watch: false }]], 'a watch is `true` alone');
  const big = read(Array.from({ length: TAGS_MAX + 50 }, (_, i) => ({ sub: `acct-${String(i).padStart(4, '0')}`, level: 'low' })));
  assert.equal(big.flags.size, TAGS_MAX, 'an oversize list: its first TAGS_MAX rows');
  assert.equal(big.flags.has(`acct-${String(TAGS_MAX).padStart(4, '0')}`), false);
  for (const [dist, kept] of [[50, 50], [100, 100], [200, 200], [350, 350], [351, NAMEPLATE_DIST], [5000, NAMEPLATE_DIST], [75, NAMEPLATE_DIST], ['200', NAMEPLATE_DIST], [undefined, NAMEPLATE_DIST]]) assert.equal(read([], dist).dist, kept, String(dist));
  for (const m of [null, {}, { list: 'x' }, { list: {} }]) assert.equal(validTags(m), null);
});

test('STAFF-VIEW1 page: what the staff view reads of the page\'s follow - whether a panel spoke, the eye\'s players, the game\'s session, its frame and mode, the tags and their ask', () => {
  const { Session } = fakeSessions();
  const listeners = [], posted = [];
  const main = { url: 'wss://relay.test' };
  const win = { location: { origin: 'https://game.test' }, addEventListener: (_k, f) => listeners.push(f), postMessage: (m, o) => posted.push([m, o]) };
  const page = staffFollowOnPage({ main: () => main, prepare: async () => {}, mode: () => 'interior', pixel: () => ({ x: 1, y: 2 }), toScene: (p) => [p.x, 9, p.z], win, Session });
  assert.equal(page.panel(), false);
  listeners[0]({ source: win, origin: 'https://game.test', data: { dfoStaff: 'hook?' } });
  assert.equal(page.panel(), true);
  assert.deepEqual([page.main(), page.mode(), page.toScene({ x: 1, z: 3 }), page.peers()], [main, 'interior', [1, 9, 3], []]);
  page.askTags();
  assert.deepEqual(posted.at(-1), [{ dfoStaff: 'tags?' }, 'https://game.test']);
  listeners[0]({ source: win, origin: 'https://game.test', data: { dfoStaff: 'tags', dist: 50, list: [{ sub: 'acct-a', watch: true }] } });
  assert.deepEqual(page.tags().flags.get('acct-a'), { level: null, why: '', watch: true });
});

test('STAFF-PANEL5-FOLLOW host: a follow leaves the host\'s room, enters the note\'s place once, puts the camera at the target\'s eyes, and let go never shows the body where the target stood', async () => {
  let locked = false, view = null, place = null, here = 'exterior|10,10', mode = 'exterior';
  const hook = { ticks: 0, tick() { this.ticks++; }, locked: () => locked, view: () => view, place: () => place };
  const prepared = [];
  let release;
  const host = createStaffFollowHost({ hook, prepare: (d) => { prepared.push(d); return new Promise((r) => { release = r; }); }, mode: () => mode, where: () => here, toScene: (p) => [p.x + 1, p.y + 2, p.z + 3], eyeHeight: (p) => (p.rd ? 2.5 : 1.6) });
  assert.equal(host.frame(), false, 'no follow: the host\'s room is its own');
  assert.equal(hook.ticks, 1);
  locked = true;
  place = notePlace(validPartyPose(note('dungeon:m1234', { in: 1 })));
  assert.equal(host.frame(), true);
  await new Promise((r) => setImmediate(r));
  assert.equal(prepared.length, 1);
  assert.equal(host.frame(), true);
  assert.equal(prepared.length, 1, 'entering: once');
  const player = { pos: [0, 0, 0], velY: -9, falling: true, fallStart: 400, _airVelX: 1, _airVelZ: 2 }, cam = { pos: [0, 0, 0], yaw: 0, pitch: 0 };
  view = { x: 10, y: 20, z: 30, yaw: 1.25, pitch: -0.5 };
  assert.equal(host.eye(player, cam), false, 'no camera while the place loads');
  release(); await new Promise((r) => setImmediate(r));
  assert.equal(host.eye(player, cam), false, 'FOLLOW-FRAME: entered, but the scene is still the open air - their dungeon pose is not its frame');
  mode = 'dungeon';
  assert.equal(host.eye(player, cam), true);
  assert.deepEqual([player.pos, cam.pos, cam.yaw, cam.pitch], [[11, 22, 33], [11, 23.6, 33], 1.25, -0.5]);
  assert.deepEqual([player.velY, player.falling, player.fallStart, player._airVelX, player._airVelZ], [0, false, 22, 0, 0], 'carried, no fall billed');
  view = { ...view, rd: 1 };
  host.eye(player, cam);
  assert.equal(cam.pos[1], 22 + 2.5, 'a rider\'s eye');
  host.frame();
  assert.equal(prepared.length, 1, 'the same place: not entered again');
  // outdoors, seen: the camera carries itself
  mode = 'exterior';
  place = notePlace({ ...validPartyPose(note('world:1,1')), wx: 1, wy: 2, wz: 3 });
  host.frame();
  await new Promise((r) => setImmediate(r));
  assert.equal(prepared.length, 1, 'outdoors and seen: not entered');
  view = null;
  host.frame();
  await new Promise((r) => setImmediate(r));
  assert.equal(prepared.length, 2, 'outdoors and not seen: entered');
  release(); await new Promise((r) => setImmediate(r));
  assert.equal(host.eye(player, cam), false, 'nothing to copy');
  // let go: out of every room until somewhere else
  locked = false;
  assert.equal(host.frame(), true, 'let go where the target stood: still in no room');
  assert.equal(host.frame(), true);
  here = 'exterior|10,11';
  assert.equal(host.frame(), false, 'off that map pixel: the host\'s own room again');
  assert.equal(host.frame(), false);
  // a failed enter is said, and tried again only for another place
  locked = true; view = null; place = notePlace({ ...validPartyPose(note('dungeon:m77', { in: 1 })), rk: 'dungeon:m77' });
  const failing = createStaffFollowHost({ hook, prepare: async () => { throw new Error('no'); }, mode: () => mode, where: () => here, toScene: () => null, eyeHeight: () => 0 });
  const warn = console.warn; const warned = []; console.warn = (...a) => warned.push(a.join(' '));
  try { failing.frame(); await new Promise((r) => setImmediate(r)); failing.frame(); await new Promise((r) => setImmediate(r)); } finally { console.warn = warn; }
  assert.equal(warned.length, 1);
});

test('FOLLOW-FRAME host (mob: "u end up in the bottom left corner" "of the daggerfall map"): a dungeon pose never lands on the open air - the camera waits at the door, and an enter that failed is tried again, each wait twice the last', async () => {
  let t = 0, fail = true, mode = 'exterior';
  const view = { x: 12, y: 1, z: 30, yaw: 0, pitch: 0 };
  const place = notePlace(validPartyPose(note('dungeon:m1234.m', { in: 1 })));
  const hook = { tick() {}, locked: () => true, view: () => view, place: () => place };
  const tried = [];
  const host = createStaffFollowHost({ hook, prepare: async () => { tried.push(t); if (fail) throw new Error('sealed'); mode = 'dungeon'; }, mode: () => mode, where: () => 'exterior|1,1', toScene: (p) => [p.x, p.y, p.z], eyeHeight: () => 1.6, now: () => t });
  const settle = () => new Promise((r) => setImmediate(r));
  const player = { pos: [500, 60, 500] }, cam = { pos: [500, 61, 500], yaw: 2, pitch: 0 };
  const warn = console.warn; const warned = []; console.warn = (...a) => warned.push(a.join(' '));
  try {
    host.frame(); await settle();
    assert.deepEqual(tried, [0]);
    assert.equal(host.eye(player, cam), false, 'not entered: the camera is not moved');
    assert.deepEqual([player.pos, cam.pos, host.seeing()], [[500, 60, 500], [500, 61, 500], false], 'never at the world\'s origin');
    t = FOLLOW_RETRY_MS - 1; host.frame(); await settle();
    assert.deepEqual(tried, [0], 'not before the wait');
    t = FOLLOW_RETRY_MS; host.frame(); await settle();
    assert.deepEqual(tried, [0, FOLLOW_RETRY_MS], 'tried again - it was tried once, and never again');
    t += 2 * FOLLOW_RETRY_MS - 1; host.frame(); await settle();
    assert.equal(tried.length, 2, 'the second wait is twice the first');
    t += 1; fail = false; host.frame(); await settle();
    assert.equal(tried.length, 3);
    assert.equal(warned.length, 1, 'said once a place');
    assert.equal(host.eye(player, cam), true, 'entered: their eyes');
    assert.deepEqual([player.pos, host.seeing()], [[12, 1, 30], true]);
    host.frame(); await settle();
    assert.equal(tried.length, 3, 'entered: not again');
  } finally { console.warn = warn; }
  assert.deepEqual([followInFrame(null, 'exterior'), followInFrame({ kind: 'gate' }, 'dungeon'), followInFrame({ kind: 'abyss' }, 'exterior'), followInFrame({ kind: 'interior' }, 'interior'), followInFrame({ kind: 'exterior' }, 'dungeon')], [true, true, false, true, false]);
  assert.equal(FOLLOW_RETRY_MAX_MS, 60000);
});

test('STAFF-PANEL5-FOLLOW page: a /tp follows on only where a Staff Panel spoke on this page; the panel\'s follow drives the one hook', () => {
  const { Session, made } = fakeSessions();
  const listeners = [];
  const win = { location: { origin: 'https://game.test' }, addEventListener: (_k, f) => listeners.push(f), postMessage: () => {} };
  const page = staffFollowOnPage({ main: () => ({ url: 'wss://relay.test' }), prepare: async () => {}, mode: () => 'exterior', pixel: () => ({ x: 1, y: 2 }), toScene: (p) => [p.x, p.y, p.z], win, Session });
  assert.equal(page.follow('acct-target'), false, 'no panel: a TP follows nobody');
  assert.equal(page.hook.target(), null);
  listeners[0]({ source: win, origin: 'https://game.test', data: { dfoStaff: 'hook?' } });
  assert.equal(page.follow('acct-target'), true);
  assert.equal(page.follow(undefined), false, 'a relay that named no account');
  page.frame();
  assert.equal(made.length, 1);
  made[0].onFollow({ k: 'on', sub: 'acct-target' });
  assert.equal(page.locked(), true);
  assert.equal(page.frame(), true, 'locked: the host stands in no room');
  const player = { pos: [0, 0, 0] }, cam = { pos: [0, 0, 0], yaw: 0, pitch: 0 };
  assert.equal(page.eye(player, cam), false, 'not seen yet');
  listeners[0]({ source: win, origin: 'https://game.test', data: { dfoStaff: 'unlock' } });
  assert.equal(page.locked(), false);
  assert.equal(page.frame(), true, 'let go where it stood: in no room until somewhere else');
});

test('STAFF-PANEL5-FOLLOW TP law: where a note puts staff, the line a TP says, and who the hub answers from a note', () => {
  const p = (more) => ({ ...validPartyPose(note('world:207,213', { px: 207, py: 213 })), ...more });
  assert.deepEqual(notePlace(p({ wx: 1.5, wy: -2, wz: 3.25 })), { kind: 'exterior', pixel: { x: 207, y: 213 }, pos: [1.5, -2, 3.25], yaw: 0, pitch: 0 }, 'outside, on their feet');
  assert.deepEqual(notePlace(p({})), { kind: 'exterior', pixel: { x: 207, y: 213 }, yaw: 0, pitch: 0, pos: null }, 'outside with no feet: the pixel');
  assert.equal(notePlace(p({ wx: NaN, wy: 0, wz: 0 })).pos, null);
  assert.deepEqual(notePlace(p({ in: 1, rk: 'dungeon:m1234' })), { kind: 'dungeon', pixel: { x: 207, y: 213 }, yaw: 0, pitch: 0, mapId: 1234, whole: true, pos: null });
  assert.equal(notePlace(p({ in: 1, rk: 'dungeon:m1234.s' })).whole, false, 'a small re-lay is the world\'s size for it');
  const ins = notePlace(p({ in: 1, rk: `dungeon:m1234.i${'0123456789abcdef'}.89abcdef` }));
  assert.deepEqual([ins.ins, ins.whole], ['0123456789abcdef.89abcdef', true], 'an instance: its word, the dungeon whole');
  assert.equal(notePlace(p({ in: 1, rk: 'world:1,1' })), null, 'a dungeon with no dungeon room does not match');
  assert.equal(notePlace(p({ in: 1 })), null);
  const bk = (5 << 16) + (9 << 8) + 42;
  assert.deepEqual(notePlace(p({ in: 2, bk, rk: `interior:m99.${bk}` })), { kind: 'interior', pixel: { x: 207, y: 213 }, yaw: 0, pitch: 0, door: { blockIndex: 0, recordIndex: 42, doorIndex: 0, buildingKey: bk }, pos: null });
  assert.equal(notePlace(p({ in: 2, bk: 0, rk: 'interior:m99.0' })), null, 'no building');
  assert.equal(notePlace(p({ in: 2, bk })), null, 'a building with no room named');
  // STAFF-PANEL5-FOLLOW-FIX (finding 2): a home is its building, entered as its own private room
  const owner = `owned:${'a'.repeat(32)}.${'b'.repeat(16)}`, home = `${owner}:99.${bk}`;
  const atHome = notePlace(p({ in: 2, bk, rk: home }));
  assert.deepEqual(atHome, { kind: 'interior', pixel: { x: 207, y: 213 }, yaw: 0, pitch: 0, door: { blockIndex: 0, recordIndex: 42, doorIndex: 0, buildingKey: bk }, privateRoom: home, pos: null });
  assert.deepEqual(validStaffDestination({ ...atHome, pos: [0, 0, 0] }).privateRoom, home, 'a destination the TP host takes');
  assert.equal(notePlace(p({ in: 2, bk: bk + 1, rk: home })), null, 'a home of another building does not match');
  assert.equal(notePlace(p({ in: 2, bk, rk: `${owner}:boat.7` })), null, 'a boat\'s cabin: no door to restore - their game is asked');
  assert.equal(notePlace({ px: 5000, py: 1, in: 0 }), null, 'off the map');
  assert.equal(notePlace(null), null);
  assert.equal(staffDestinationKey(notePlace(p({ in: 2, bk, rk: `interior:m99.${bk}` }))), staffDestinationKey(notePlace(p({ in: 2, bk, rk: `interior:m99.${bk}`, h: 1 }))));
  // the line: the player can see it, every way
  assert.match(staffTpLine({ name: 'Bran', via: 'note' }), /where note - their game was told nothing, but the player can see you arrive/);
  assert.match(staffTpLine({ name: 'Bran', fb: 'missing' }), /was missing \(the player can see this\)/);
  assert.match(staffTpLine({ name: 'Bran', fb: 'mismatch' }), /did not match \(the player can see this\)/);
  assert.equal(staffTpLine({ name: 'Bran' }), 'Teleported to Bran\'s exact position (the player can see this).');
  assert.deepEqual(STAFF_TP_FALLBACKS, ['missing', 'mismatch']);
  for (const [g, ok] of [[['dev'], true], [['shadowfang'], true], [['dm'], false], [['mod'], false], [[], false], [null, false], ['dev', false]]) assert.equal(quietTeleportAllowed(g), ok, JSON.stringify(g));
});

test('STAFF-PANEL5-FOLLOW TP: a note\'s answer is loaded and, with feet, placed; a place with no spot is loaded alone; a note this build cannot place asks their game, every ask after it too', async () => {
  const base = validPartyPose(note('world:207,213', { px: 207, py: 213 }));
  const run = async (answers) => {
    const asks = [], prepared = [], placed = [];
    const who = await followStaffPlayer('Bran', { ask: async (t) => { asks.push(t); return answers.shift(); }, prepare: async (d) => prepared.push(d), place: (d) => placed.push(d) });
    return { who, asks, prepared, placed };
  };
  const feet = { id: 'peer-bran', name: 'Bran', via: 'note', note: { ...base, wx: 1, wy: 2, wz: 3 } };
  let r = await run([feet, feet]);
  assert.deepEqual(r.asks, [{ name: 'Bran' }, { id: 'peer-bran' }]);
  assert.deepEqual(r.placed.map((d) => d.pos), [[1, 2, 3]]);
  const dungeon = { id: 'peer-bran', name: 'Bran', via: 'note', note: { ...base, in: 1, rk: 'dungeon:m1234' } };
  r = await run([dungeon, dungeon]);
  assert.equal(r.prepared.length, 1);
  assert.equal(r.placed.length, 0, 'no spot: loaded, never placed');
  assert.equal(r.who.via, 'note');
  const lost = { id: 'peer-bran', name: 'Bran', via: 'note', note: { ...base, in: 2, bk: 7 } };
  const captured = { id: 'peer-bran', name: 'Bran', dest: { kind: 'exterior', pixel: { x: 207, y: 213 }, pos: [4, 5, 6], yaw: 0.5, pitch: 0 }, fb: 'mismatch' };
  r = await run([lost, captured, captured]);
  assert.deepEqual(r.asks, [{ name: 'Bran' }, { id: 'peer-bran', cap: 1 }, { id: 'peer-bran', cap: 1 }]);
  assert.deepEqual(r.placed.map((d) => d.pos), [[4, 5, 6]]);
  assert.equal(r.who.fb, 'mismatch');
  await assert.rejects(run([lost, { ...captured, id: 'peer-other' }]), /target player changed/);
});

// the TP host's own prepare, run from the source with doubles (as test/net/staffTeleport.test.js runs it)
const worldSource = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const functions = new Map();
const walk = (n) => {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'FunctionDeclaration' && n.id) functions.set(n.id.name, worldSource.slice(n.start, n.end));
  for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
};
walk(parse(worldSource, { ecmaVersion: 'latest', sourceType: 'module' }));
const hostFunction = (name, supplied) => { const scope = { player: { collider: {}, height: 1.8 }, ...supplied }; return Function(...Object.keys(scope), `return (${functions.get(name)});`)(...Object.values(scope)); };

test('STAFF-PANEL5-FOLLOW TP host: a place a note names no spot in is loaded and nobody is put anywhere - the place\'s own entrance stands', async () => {
  const placed = [];
  const calls = [];
  const modes = { forceExitToExterior: () => calls.push('out'), setPlayerLocalPosition: (p) => placed.push(p), dungeonLocation: { mapTableData: { mapId: 1234 } }, startInDungeon: async () => { calls.push('dungeon'); return true; } };
  const prepare = hostFunction('prepareStaffDestination', { modes, _wodInside: false, playerSpawned: false, _teleportToPixel: async () => calls.push('pixel'), staffLanding: () => assert.fail('no spot to land on'), capsuleFits: () => assert.fail('no spot to fit'), ohAbyss: null });
  await prepare(notePlace({ ...validPartyPose(note('dungeon:m1234', { in: 1 })), rk: 'dungeon:m1234' }));
  await prepare(notePlace(validPartyPose(note('world:100,100'))));
  assert.deepEqual(placed, []);
  assert.deepEqual(calls, ['out', 'pixel', 'dungeon', 'out', 'pixel']);
  // a spot: as ever
  const withSpot = hostFunction('prepareStaffDestination', { modes, _wodInside: false, playerSpawned: false, _teleportToPixel: async () => {}, staffLanding: (d) => d.pos, capsuleFits: () => true, ohAbyss: null });
  await withSpot(notePlace({ ...validPartyPose(note('world:100,100')), wx: 1, wy: 2, wz: 3 }));
  assert.deepEqual(placed, [[1, 2, 3]]);
});

test('STAFF-PANEL5-FOLLOW host: outside a party the pose goes on as the where note, its feet and its room in it', () => {
  assert.match(worldSource, /\.\.\.\(!social\?\.party && mode === 'exterior' && walkMode && playerSpawned && !worldMoveBusy\(\) && partyFeetOf\(player\.pos\)\),/, 'my feet outside a party');
  assert.match(worldSource, /\.\.\.\(online\?\.room \? \{ rk: online\.room \} : \{\}\),/, 'the room I stand in');
  assert.match(worldSource, /if \(socialLink\(\)\) socialLink\(\)\.solo = !social\.party;/, 'sent outside a party, at the note\'s pace');
});

// ═══ STAFF-HIDE-TOGGLE (2026-10-23, mob: "i cant talk in chat?", "need hide to be a toggle") - Hide me and Show myself take
// effect at once: the panel's `relink` word (net/staffHook.js), the game's own links remade on a fresh token
// (scenes/staffFollowHost.js relinkGame), and the minter letting go of a mint on its way (net/accountClient.js `forget`).
// tools/mutants/staff-hide-toggle.json ═══

/** A device signed in (net/accountClient.js storedSession's shape). */
const signedIn = () => {
  const mem = new Map([[SESSION_KEY, JSON.stringify({ secret: 's3cret', id: 'acct-mob', name: 'SirMcMobdon' })], [SERVICE_KEY, 'https://accounts.test']]);
  return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
};
const minted = (token) => new Response(JSON.stringify({ token, name: 'SirMcMobdon', kind: 'account', glyphs: ['dev'] }), { status: 200, headers: { 'content-type': 'application/json' } });
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
const helloTok = (ws) => ws.sent.map((x) => JSON.parse(x)).find((f) => f.t === 'hello')?.tok ?? null;

test('STAFF-HIDE-TOGGLE hook door: `relink` runs the host\'s relink - from the panel\'s window and origin alone; at most once a STAFF_RELINK_GAP_MS, one asked inside the gap run at its end and never two waiting; a door with no relink takes the word for nothing (mutants: the word unread; the gap unread; a second waiting)', () => {
  const listeners = [], timers = new Map();
  let t = 1_000_000, relinks = 0;
  const win = { location: { origin: 'https://game.test' }, addEventListener: (_k, f) => listeners.push(f), postMessage: () => {} };
  staffHookDoor(win, () => null, { relink: () => relinks++, now: () => t, setTimer: (f, ms) => { const k = Symbol('t'); timers.set(k, [f, ms]); return k; }, clearTimer: (k) => timers.delete(k) });
  const say = (data, more = {}) => listeners[0]({ source: win, origin: 'https://game.test', data, ...more });
  say({ dfoStaff: 'relink' }, { origin: 'https://evil.test' });
  say({ dfoStaff: 'relink' }, { source: {} });
  assert.equal(relinks, 0, 'another origin or window is not the panel');
  say({ dfoStaff: 'relink' });
  assert.equal(relinks, 1, 'at once');
  t += 1000;
  say({ dfoStaff: 'relink' });
  say({ dfoStaff: 'relink' });
  assert.equal(relinks, 1, 'inside the gap: it waits');
  assert.equal(timers.size, 1, 'one waiting, however many asked');
  const [[f, ms]] = timers.values();
  assert.equal(ms, STAFF_RELINK_GAP_MS - 1000, 'until the gap\'s end');
  timers.clear();
  t += ms;
  f();
  assert.equal(relinks, 2, 'run at the gap\'s end');
  t += STAFF_RELINK_GAP_MS;
  say({ dfoStaff: 'relink' });
  assert.equal(relinks, 3, 'a gap on: at once again');
  assert.equal(timers.size, 0);
  const bare = [];
  const win2 = { location: { origin: 'https://game.test' }, addEventListener: (_k, f2) => bare.push(f2), postMessage: () => {} };
  staffHookDoor(win2, () => null);
  bare[0]({ source: win2, origin: 'https://game.test', data: { dfoStaff: 'relink' } });   // no throw, nothing run
});

test('STAFF-HIDE-TOGGLE relink, on real sessions and the real minter: the held token let go; the presence room left for the world frame to join again; each chat link left and opened again at once on a fresh mint - the hub link a hide order closed `hidden lapsed` too, its terminal wait cleared; a link in no room opens nothing and keeps its word (one out of the seat says so still); the next room joined mints afresh though TOKEN_REUSE_MS has not run (mutants: the token kept; the presence room kept; a chat link left and not opened; a link in no room left again)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let hidden = false, mints = 0;
  const minter = accountTokenMinter({ fetch: async () => minted(`v1.${hidden ? 'hidden' : 'shown'}${++mints}.sig`), storage: signedIn() });
  const session = (presence) => { const x = new OnlineSession({ url: 'wss://relay.test', name: 'SirMcMobdon', id: 'peer-mob1', secret: 'secret-mob1', presence, WebSocketImpl: FakeWS }); x.mintToken = minter; return x; };
  const main = session(true), hub = session(false), region = session(false), gone = session(false);
  main.join('world:3,12');
  hub.join(SOCIAL_ROOM);
  for (const ws of sockets) ws.open();
  gone.supersede();   // ONE-SEAT: another tab holds the seat - this link waits for its player, in no room
  await settle();
  assert.deepEqual(sockets.map(helloTok), ['v1.shown1.sig', 'v1.shown1.sig'], 'shown: one mint for the sockets that opened together');
  sockets[1].drop(CLOSE_POLICY, 'hidden lapsed');   // a hide order's close: terminal, a rejoin would wait CHAT_REJOIN_MS
  assert.equal(hub.terminal, true);
  hidden = true;   // Hide me pressed: the service mints hidden from now
  const goneWas = [gone.status, gone.error];
  relinkGame(minter, main, [hub, region, gone]);
  assert.equal(minter.holds('chat:region:7'), false, 'the token from before the press let go - no room it never opened is handed it');
  assert.deepEqual([gone.room, gone.status, gone.error], [null, ...goneWas], 'a link out of the seat left as it was - its word on screen too');
  assert.equal(main.room, null, 'the presence room left - the world frame joins a session in no room at once');
  assert.deepEqual(sockets[0].closed, { code: 1000, reason: 'leaving' }, 'its socket closed first');
  assert.deepEqual([hub.room, hub.terminal, sockets.length], [SOCIAL_ROOM, false, 3], 'the hub link opened again at once, its wait cleared; the region link, in no room, opens nothing');
  sockets[2].open();
  await settle();
  assert.equal(helloTok(sockets[2]), 'v1.hidden2.sig', 'on a fresh mint: the switch as it stands now');
  main.join('world:3,12');   // the world frame's join
  sockets[3].open();
  await settle();
  assert.equal(helloTok(sockets[3]), 'v1.hidden2.sig');
  region.join('chat:region:7');   // a room the shown token never opened, inside TOKEN_REUSE_MS of it
  sockets[4].open();
  await settle();
  assert.equal(helloTok(sockets[4]), 'v1.hidden2.sig', 'never the token from before the press');
  // and back: Show myself
  hidden = false;
  relinkGame(minter, main, [hub, region]);
  assert.deepEqual([sockets[2].closed, sockets[3].closed, sockets[4].closed], [{ code: 1000, reason: 'leaving' }, { code: 1000, reason: 'leaving' }, { code: 1000, reason: 'leaving' }]);
  assert.deepEqual([main.room, hub.room, region.room], [null, SOCIAL_ROOM, 'chat:region:7']);
  sockets[5].open(); sockets[6].open();
  await settle();
  assert.deepEqual([helloTok(sockets[5]), helloTok(sockets[6])], ['v1.shown3.sig', 'v1.shown3.sig'], 'shown at once');
});

test('STAFF-HIDE-TOGGLE minter: a mint on its way when forget() is said is its own asker\'s and held for no other room - the next room asks the service, which reads the switch as it stands (mutants: the mint on its way held)', async () => {
  const waiting = [];
  const minter = accountTokenMinter({ fetch: () => new Promise((r) => waiting.push(r)), storage: signedIn() });
  const first = minter('world:1,1');
  await settle();
  assert.equal(waiting.length, 1, 'on its way');
  minter.forget();
  waiting.shift()(minted('v1.before.sig'));
  assert.equal(await first, 'v1.before.sig', 'its own asker');
  assert.equal(minter.holds('chat:world'), false, 'held for nobody');
  const next = minter('chat:world');
  await settle();
  assert.equal(waiting.length, 1, 'the next room asks the service');
  waiting.shift()(minted('v1.after.sig'));
  assert.equal(await next, 'v1.after.sig');
  assert.equal(minter.holds('cell:1.1'), true, 'a mint after the forget is held as ever');
});

test('STAFF-HIDE-TOGGLE page: the door\'s relink is the host\'s - and the host hands it its minter, its presence session and its chat links (mutants: the door handed no relink)', () => {
  const listeners = [];
  const win = { location: { origin: 'https://game.test' }, addEventListener: (_k, f) => listeners.push(f), postMessage: () => {} };
  let relinks = 0;
  staffFollowOnPage({ main: () => null, prepare: async () => {}, mode: () => 'exterior', pixel: () => ({ x: 1, y: 2 }), toScene: () => null, relink: () => relinks++, win, Session: fakeSessions().Session });
  listeners[0]({ source: win, origin: 'https://game.test', data: { dfoStaff: 'relink' } });
  assert.equal(relinks, 1);
  assert.ok(worldSource.includes("relink: () => relinkGame(identityMinter, online, chatLinks?.values())"), 'world.js hands the page its minter, presence session and chat links');
  assert.match(worldSource, /else if \(key !== online\.room\) \{ if \(!online\.room \|\| /, 'and the world frame joins a presence session in no room at once');
});
