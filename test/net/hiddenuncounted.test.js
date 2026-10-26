// HIDDEN-UNCOUNTED (2026-10-24, Mac: "Invisible players dont count towards the online count") - A HIDDEN STAFF MEMBER IS
// IN NO ONE'S COUNT, THEIR OWN INCLUDED. The relay already leaves a hidden socket out of every roster and count
// (server/src/staffHidden.js, NAMED BY NOBODY - test/net/staffpanel5hidden_relay.test.js pins it), so every other game's
// "Online - N" left them out; the hidden game's own list still drew its own row and counted it, one higher than everyone
// else's. Over the real relay (the harness of staffmap_e2e.test.js): the session notes its hello's hidden mark
// (net/online.js `hidden`) and the roster leaves its own row out (net/roster.js rosterRows), in every tab's source.
// AUDIT HIDDEN-UNCOUNTED (bible/01-Overview/audits/Audit-Hidden-Uncounted.md): and every count the relay says after the
// welcome is read without a seat of mine (a join elsewhere, a count of nobody), the mark follows the socket the relay
// holds (Hide me and Show myself mid-session, a halo promoted at a crossing), and the harness hands the game the relay's
// own closes and the count each room says each HUB_COUNT_MS (`sayCounts`), as a browser and a deployed room would.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRooms, roomSigner } from '../fakeRoom.mjs';
import { OnlineSession, tokenHidden } from '../../src/net/online.js';
import { relinkGame } from '../../src/scenes/staffFollowHost.js';
import { tokenHidden as mapTokenHidden } from '../../src/net/staffMap.js';
import { reconnectWave } from '../../src/net/reconnectWave.js';
import { SOCIAL_ROOM } from '../../src/net/wire.js';
import * as H from '../../src/net/hubShards.js';
import { rosterRows, rosterTitle, partyRosterSource, guildRosterSource, localRosterSource, placedRosterSource } from '../../src/net/roster.js';

const quiet = async (fn) => { const keep = { info: console.info, warn: console.warn, log: console.log }; console.info = console.warn = console.log = () => {}; try { return await fn(); } finally { Object.assign(console, keep); } };
const turn = () => new Promise((r) => setImmediate(r));

async function world(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const W = fakeRooms({ now: () => clock });
  try {
    return await quiet(async () => {
      const service = {};
      const signer = roomSigner(service, () => clock);
      await signer.signer();
      const room = (name) => { const r = W.room(name); r.env.IDENTITY_PUBLIC_KEY ??= service.IDENTITY_PUBLIC_KEY; r.env.ACCOUNTS ??= { fetch: async () => new Response('{}') }; return r; };
      const pending = [];
      class BridgeWS {
        constructor(url) {
          this.url = url;
          this.key = decodeURIComponent(/\/room\/([^?]+)/.exec(url)[1]);
          this.r = room(this.key);
          this.readyState = 0;
          const rws = this.r.connect();
          const send = rws.send.bind(rws);
          rws.send = (s) => { send(s); pending.push(() => { if (this.readyState === 1) this.onmessage?.({ data: s }); }); };
          // AUDIT L F4: a close the RELAY makes reaches the game's onclose, as a browser's would
          const sclose = rws.close.bind(rws);
          rws.close = (code, reason) => { sclose(code, reason); pending.push(() => { if (this.readyState !== 3) { this.readyState = 3; this.onclose?.({ code, reason }); } }); };
          this.rws = rws;
          pending.push(() => { if (this.readyState === 0) { this.readyState = 1; this.onopen?.(); } });
        }
        send(s) { if (this.readyState !== 1) throw new Error('not open'); const { r, rws } = this; pending.push(() => r.room.webSocketMessage(rws, s)); }
        close(code = 1000, reason = '') {
          if (this.readyState === 3) return;
          this.readyState = 3;
          const { r, rws } = this;
          pending.push(async () => { const i = r.sockets.indexOf(rws); if (i >= 0) { r.sockets.splice(i, 1); await r.room.webSocketClose(rws, code, reason); } });
          pending.push(() => this.onclose?.({ code, reason }));   // and the game's own close is heard, as a browser's is
        }
      }
      // the count each room says at most every HUB_COUNT_MS (the bus to its shards, a shard to its sockets), said now
      const sayCounts = async () => {
        for (const [k, r] of [...W.made]) if (H.isChannelBus(k) && r.room._countT) { clearTimeout(r.room._countT); r.room._countT = null; await r.room._busCountTell(); }
        for (const [k, r] of [...W.made]) if (H.isChannelShard(k) && r.room._hubCountT) { clearTimeout(r.room._hubCountT); r.room._hubCountT = null; r.room._hubCountSay(); }
      };
      const settle = async () => {
        for (let i = 0; i < 6; i++) {
          while (pending.length) await pending.shift()();
          await turn();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubUpFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelBus(k)) await r.room._downFlush();
          for (const [k, r] of [...W.made]) if (H.isChannelShard(k)) await r.room._hubPoll();
          await sayCounts();
        }
        while (pending.length) await pending.shift()();
      };
      const Session = class extends OnlineSession { constructor(o) { super({ wave: reconnectWave({ online: () => true }), ...o, now: () => clock }); } };
      try {
        return await fn({ W, signer, BridgeWS, Session, settle, tick: (ms) => { clock += ms; } });
      } finally {
        for (const [, r] of W.made) { clearTimeout(r.room._upT); clearTimeout(r.room._downT); clearTimeout(r.room._hubCountT); clearTimeout(r.room._owedSoon); clearTimeout(r.room._owedLate); clearTimeout(r.room._countT); }
      }
    });
  } finally { Date.now = realNow; }
}

for (const hidden of [true, false]) test(`HIDDEN-UNCOUNTED: a staff game's World tab ${hidden ? 'on a hidden token reads the count every player reads - no row of its own, nobody counting it' : 'with Hide me off is a player: its own row, and in everyone\'s count'} (mutants: the own row pushed while hidden; the hello's mark unread)`, async () => {
  await world(async ({ signer, BridgeWS, Session, settle, tick }) => {
    const mk = (id, claims) => new Session({ url: 'wss://relay.test', name: claims.n, id, secret: `secret-of-${id}`, presence: false, wire2: true, WebSocketImpl: BridgeWS, mintToken: async () => signer.token(id, claims) });
    const a = mk('pla-0001', { s: 'acct-a-0001', n: 'Alpha', k: 'linked' });
    const b = mk('plb-0002', { s: 'acct-b-0002', n: 'Beta', k: 'linked' });
    const staff = mk('stf-0003', hidden ? { s: 'HiddenSub0123456789abcde', n: 'Staff member', k: 'linked', hd: 1 } : { s: 'acct-staff-0003', n: 'Mob', k: 'linked' });
    const all = [a, b, staff];
    // the World tab draws: each link asks the hub who is on its other shards while the tab is open (world.js chatRosterOf)
    const until = async (ok) => { for (let i = 0; i < 200 && !ok(); i++) { for (const s of all) { s.tick(); s.sendHubWho(); } await settle(); tick(250); } };
    const want = hidden ? 2 : 3;
    assert.deepEqual(all.map((s) => s.hidden), [false, false, false], 'AUDIT P1: a session that has said no hello is hidden from nobody');
    a.join(SOCIAL_ROOM); b.join(SOCIAL_ROOM); staff.join(SOCIAL_ROOM);
    // and every list as long as its count: the count is said each HUB_COUNT_MS (`sayCounts`), the other shards' rows only
    // by the next who-answer, asked at most each HUB_WHO_MS - a hello its relay verifies late (the token's Ed25519 is real
    // work, outside the fake clock: on a busy runner it lands ticks late) is counted a who-answer before it is listed
    await until(() => all.every((s) => s.welcomed && rosterRows(s).total === want && s.roomCount === want && rosterRows(s).rows.length === want));
    assert.ok(new Set(all.map((s) => s.room)).size > 1, 'the links stand on more than one shard - the hub\'s count and its other shards\' players read');
    assert.deepEqual(all.map((s) => s.roomCount), [want, want, want], 'AUDIT P3: the hub\'s own count, as every room says it (`sayCounts`)');
    assert.equal(staff.hidden, hidden, 'the session notes its hello\'s mark');
    assert.equal(a.hidden, false);
    for (const s of all) assert.equal(rosterRows(s).total, want, `${s.name}: ${rosterTitle(rosterRows(s).total)}`);
    const own = rosterRows(staff).rows.filter((r) => r.me);
    assert.deepEqual(own.map((r) => r.id), hidden ? [] : ['stf-0003'], hidden ? 'no row of its own' : 'its own row, marked');
    assert.deepEqual(rosterRows(staff).rows.map((r) => r.name).filter((n) => n !== 'Mob'), ['Alpha', 'Beta'], 'and everyone it can see');
    assert.equal(rosterRows(a).rows.some((r) => r.id === 'stf-0003'), !hidden, hidden ? 'nobody lists it' : 'everybody lists it');
  });
});

test('HIDDEN-UNCOUNTED (AUDIT L1 = C2, L2): every count the relay says after the welcome is read without a seat of mine - a player joining on another shard is counted at once, and a count of nobody is taken: the hidden screen reads the bus\'s own count of the visible at every step, with no who-answer between (mutants: the hub count\'s seat read as one; its floor at one)', async () => {
  await world(async ({ W, signer, BridgeWS, Session, settle, tick }) => {
    const mk = (id, claims) => new Session({ url: 'wss://relay.test', name: claims.n, id, secret: `secret-of-${id}`, presence: false, wire2: true, WebSocketImpl: BridgeWS, mintToken: async () => signer.token(id, claims) });
    const STAFF = 'HiddenSub0123456789abcde', home = H.hubOfSubject(STAFF);
    // accounts by the shard they land on: one beside the staff, two on others
    const subs = { beside: [], far: [] };
    for (let i = 0; i < 4096 && (subs.beside.length < 1 || subs.far.length < 2); i++) { const sub = `acct-q-${i}`; (H.hubOfSubject(sub) === home ? subs.beside : subs.far).push(sub); }
    const staff = mk('stf-0003', { s: STAFF, n: 'Staff member', k: 'linked', hd: 1 });
    const a = mk('pla-0001', { s: subs.beside[0], n: 'Alpha', k: 'linked' });
    const c = mk('plc-0002', { s: subs.far[0], n: 'Cass', k: 'linked' });
    const d = mk('pld-0003', { s: subs.far[1], n: 'Dag', k: 'linked' });
    const bus = () => W.room(SOCIAL_ROOM).room;
    let live = [staff, a];
    // `who`: the World tab asks the hub who is on its other shards (world.js chatRosterOf) - left out where a step pins
    // the count the relay SAYS, so a list refreshed under it cannot stand in for a count thrown away
    const step = async (ok, who = false) => { for (let i = 0; i < 200 && !ok(); i++) { for (const s of live) { s.tick(); if (who) s.sendHubWho(); } await settle(); tick(250); } };
    staff.join(SOCIAL_ROOM); a.join(SOCIAL_ROOM);
    // settled as the World tab settles: the hub's who-answer in - the bus has handed the staff's shard something, so it is
    // told the hub's count from then on (index.js _busCountMoved: a game's account picture does it at its hello)
    await step(() => staff.welcomed && a.welcomed && staff.hubOnline.size === 1 && rosterRows(staff).total === 1, true);
    assert.equal(staff.room, a.room, 'Alpha beside the staff, on its shard');
    assert.equal(rosterRows(staff).total, 1);
    live = [staff, a, c];
    c.join(SOCIAL_ROOM);
    await step(() => c.welcomed && bus()._busCount() === 2 && rosterRows(staff).total === 2);
    assert.notEqual(c.room, staff.room, 'Cass on another shard');
    assert.equal(rosterRows(staff).total, bus()._busCount(), 'a join elsewhere counted at once - the relay\'s two, never thrown away for my own shard\'s one plus a seat I do not have');
    live = [staff, a, c, d];
    d.join(SOCIAL_ROOM);
    await step(() => d.welcomed && bus()._busCount() === 3 && rosterRows(staff).total === 3);
    assert.equal(rosterRows(staff).total, 3);
    for (const s of [a, c, d]) s.leave();
    live = [staff];
    await step(() => bus()._busCount() === 0);
    tick(20_000);   // past HUB_WHO_MS: the next who-answer empties the other shards' list
    await step(() => rosterRows(staff).total === 0, true);
    assert.equal(bus()._busCount(), 0, 'nobody visible online');
    assert.equal(rosterRows(staff).total, 0, 'and the hidden screen reads nobody - a count of none taken, never the three it last held');
  });
});

test('HIDDEN-UNCOUNTED (AUDIT L4, C N4): Hide me and Show myself mid-session, through the game\'s own relink (staffFollowHost.js relinkGame) - the mark and every screen\'s count follow the switch, 3 then 2 then 3, and my own row goes and comes back (mutants: a mark that sticks once hidden)', async () => {
  await world(async ({ signer, BridgeWS, Session, settle, tick }) => {
    let hideOn = false;   // the account service's switch: each mint reads it (server-account/src/staffHidden.js hiddenToken)
    const claims = () => (hideOn ? { s: 'HiddenSub0123456789abcde', n: 'Staff member', k: 'linked', hd: 1 } : { s: 'acct-staff-0003', n: 'Mob', k: 'linked' });
    const mk = (id, mint) => new Session({ url: 'wss://relay.test', name: id, id, secret: `secret-of-${id}`, presence: false, wire2: true, WebSocketImpl: BridgeWS, mintToken: mint });
    const a = mk('pla-0001', async () => signer.token('pla-0001', { s: 'acct-a-0001', n: 'Alpha', k: 'linked' }));
    const b = mk('plb-0002', async () => signer.token('plb-0002', { s: 'acct-b-0002', n: 'Beta', k: 'linked' }));
    const staff = mk('stf-0003', async () => signer.token('stf-0003', claims()));
    const all = [a, b, staff];
    const until = async (ok) => { for (let i = 0; i < 200 && !ok(); i++) { for (const s of all) { s.tick(); s.sendHubWho(); } await settle(); tick(250); } };
    const totals = () => all.map((s) => rosterRows(s).total);
    for (const s of all) s.join(SOCIAL_ROOM);
    await until(() => all.every((s) => s.welcomed) && totals().every((n) => n === 3));
    assert.deepEqual([staff.hidden, ...totals()], [false, 3, 3, 3], 'shown: a player');
    hideOn = true; relinkGame(null, null, [staff]);
    await until(() => staff.welcomed && staff.hidden && totals().every((n) => n === 2));
    assert.deepEqual([staff.hidden, ...totals()], [true, 2, 2, 2], 'Hide me: counted by nobody, itself included');
    assert.equal(rosterRows(staff).rows.some((r) => r.me), false, 'no row of its own');
    hideOn = false; relinkGame(null, null, [staff]);
    await until(() => staff.welcomed && !staff.hidden && totals().every((n) => n === 3));
    assert.deepEqual([staff.hidden, ...totals()], [false, 3, 3, 3], 'Show myself: a player again');
    assert.deepEqual(rosterRows(staff).rows.filter((r) => r.me).map((r) => r.id), ['stf-0003'], 'its own row back');
  });
});

for (const startHidden of [false, true]) test(`HIDDEN-UNCOUNTED (AUDIT L3): a halo promoted at a crossing - no new socket, no new hello - and the mark is the promoted socket's: the account's switch ${startHidden ? 'off' : 'on'} between the primary's mint and the halo's, the presence session says what the relay holds its room's socket as, and the Nearby tab lists my own row by it (mutants: the mark read once, at the primary's own hello)`, async () => {
  await world(async ({ W, signer, BridgeWS, Session, settle, tick }) => {
    let hideOn = startHidden;
    const claims = () => (hideOn ? { s: 'HiddenSub0123456789abcde', n: 'Staff member', k: 'linked', hd: 1 } : { s: 'acct-staff-0003', n: 'Mob', k: 'linked' });
    const pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const staff = new Session({ url: 'wss://relay.test', name: 'Mob', id: 'stf-0003', secret: 'secret-of-stf-0003', presence: true, wire2: true, WebSocketImpl: BridgeWS, mintToken: async () => signer.token('stf-0003', claims()) });
    const peer = new Session({ url: 'wss://relay.test', name: 'Beta', id: 'plb-0002', secret: 'secret-of-plb-0002', presence: true, wire2: true, WebSocketImpl: BridgeWS, mintToken: async () => signer.token('plb-0002', { s: 'acct-b-0002', n: 'Beta', k: 'linked' }) });
    const run = async (k, ok = () => false) => { for (let i = 0; i < k && !ok(); i++) { await settle(); tick(100); staff.tick(); peer.tick(); } };
    staff.join('world:3,12', pose); peer.join('world:2,12', pose);
    await run(40, () => staff.welcomed && peer.welcomed);
    assert.equal(staff.hidden, startHidden, 'the primary\'s hello');
    hideOn = !startHidden;   // the switch flips; the halo's mint reads it, and no relink follows (a game the panel cannot reach)
    const halo = () => staff._halo.get('world:2,12');
    staff.setHalo(['world:2,12']);
    await run(40, () => { staff.setHalo(['world:2,12']); return halo()?.status === 'open' && staff._welcomed.has(halo()?.ws); });
    staff.join('world:2,12', pose);   // the crossing: the halo promoted
    await run(6);
    const att = [...W.made.get('world:2,12').sockets].map((ws) => ws.deserializeAttachment?.() ?? {}).find((x) => x.id === 'stf-0003');
    assert.equal(staff.room, 'world:2,12');
    assert.equal(att?.hid === 1, !startHidden, 'the relay holds the promoted socket by the halo\'s token');
    assert.equal(staff.hidden, !startHidden, 'and the session says the same');
    const near = localRosterSource(staff, [...staff.peers.values()].map((p) => ({ id: p.id, feet: [0, 0, 0] })), [0, 0, 0]);
    assert.equal(rosterRows(near).rows.some((r) => r.me), startHidden, 'my own row in Nearby by the socket the relay holds');
    assert.equal(peer.peers.has('stf-0003'), startHidden, 'as Beta sees it');
  });
});

test('HIDDEN-UNCOUNTED: every tab\'s source carries the link\'s hidden mark - Party, Guild, Nearby and a placed tab list no row of mine while it is set, and mine while it is not; a placed tab keeps the link\'s roster, count and the hub\'s other shards under the place\'s name (mutants: a source drops `hidden`; the placed source drops a field)', () => {
  const peers = new Map([['plx-0001', { id: 'plx-0001', name: 'Xan', gt: 'WOLF' }], ['ply-0002', { id: 'ply-0002', name: 'Yorn' }]]);
  const hubOnline = new Map([['plz-0003', { id: 'plz-0003', name: 'Zed' }]]);
  for (const hidden of [true, false]) {
    const link = { id: 'stf-0009', name: 'Staff member', title: 'Warden', glyphs: ['mod'], gt: 'WOLF', hidden, peers, roomCount: 900, hubOnline };
    const party = { members: [{ acct: 'acct-x', name: 'Xan', peers: ['plx-0001'] }] };
    const sources = { party: partyRosterSource(party, link, 'acct-me'), guild: guildRosterSource(link, 'WOLF'), local: localRosterSource(link, [{ id: 'ply-0002', feet: [0, 0, 0] }], [0, 0, 0]), placed: placedRosterSource(link, 'Wayrest') };
    for (const [tab, src] of Object.entries(sources)) {
      assert.equal(src.hidden, hidden, `${tab}: the mark carried`);
      assert.equal(rosterRows(src).rows.some((r) => r.me), !hidden, `${tab}: ${hidden ? 'no row of mine' : 'my row'}`);
    }
    const p = sources.placed;
    assert.deepEqual([p.id, p.name, p.title, p.glyphs, p.gt, p.peers, p.roomCount, p.hubOnline, p.label], [link.id, link.name, 'Warden', link.glyphs, 'WOLF', peers, 900, hubOnline, 'Wayrest'], 'AUDIT P4: every field, my own badge and tag among them');
    assert.equal(rosterRows(p).total, 900, 'the relay\'s count, as the link\'s own');
  }
  assert.equal(placedRosterSource({ id: 'p1', name: 'P' }, 'Daggerfall').hidden, false, 'a link with no mark is shown');
});

test('HIDDEN-UNCOUNTED: the token\'s mark is one function - net/online.js reads it, net/staffMap.js hands the same one on', () => {
  assert.equal(mapTokenHidden, tokenHidden);
  const body = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  assert.equal(tokenHidden(`v1.${body({ s: 'x', hd: 1 })}.sig`), true);
  assert.equal(tokenHidden(`v1.${body({ s: 'x' })}.sig`), false);
  assert.equal(tokenHidden(null), false);
});
