// AUDIT SOC (2026-09-16, Mac: "Can we do an audit of everything just merged. Just want it to be perfection"): the
// pins for what the four lenses found in the merged social arc (PR #217). The hub's (A), the client link's and the
// picture's (B), the second tab of one's own (C20), and the host's source (B4, B5, B7, B10, B17, B18). The DOM's (C)
// and the maps' and input's (D) live beside the surfaces they pin (soc3, soc5, soc6). Every pin names the finding
// and the mutant it kills, and the hub is driven over the fake Durable Object (test/fakeRoom.mjs) with the runtime's
// walls - 128 keys a batch, 2 KiB an attachment, a paged list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SOCIAL_ROOM, SOCIAL_REPEAT_MS, ACCOUNT_IDLE_MS, ACCOUNT_SWEEP_MS, SWEEP_STEP_MS, SWEEP_PAGE, INVITE_TTL_MS, PARTY_OFFLINE_MS, ACCOUNT_TABS_MAX,
  SOCIAL_ROOM_HZ_MAX, SOCIAL_IN_HZ_MAX, NOTE_IN_HZ_MAX, PARTY_IN_HZ_MAX, PARTY_HZ_MAX, PARTY_MAX, INBOUND_FRAME_MAX, WORLD_FRAME_MAX, ROSTER_MAX, MAX_FRAME_BYTES,
  PARTY_LOC_MAX, NAME_MAX, RELAY_VERSION, validPartyPose, validSocialAct, validSocialFrame,
} from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { SocialState, PARTY_GREEN_CSS, FRIEND_CSS } from '../src/net/social.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const P = Object.freeze({ px: 100, py: 200, loc: 'Daggerfall', in: 0, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 });
const ofKind = (ws, k) => ws.sent.filter((m) => m.t === 'social' && m.k === k);
const lastOf = (ws, k) => ofKind(ws, k).at(-1) ?? null;
const errors = (ws) => ofKind(ws, 'error').map((m) => m.m);
const poses = (ws) => ws.sent.filter((m) => m.t === 'party');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
/** The hub over a driven clock (soc1_hub's harness): `tick(ms)` moves it; acts from one socket sit ~600 ms apart. */
async function withHub(fn, key = SOCIAL_ROOM) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms = 600) => { clock += ms; };
  const act = (ws, o) => r.raw(ws, JSON.stringify({ t: 'social', ...o }));
  const pose = (ws, p = P) => r.raw(ws, JSON.stringify({ t: 'party', p }));
  const join = async (n, extra = {}) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}`, ...extra }); tick(10); return ws; };
  /** a and b made friends: a asks by peer, b says yes. */
  const befriend = async (a, b, bn) => { await act(a, { k: 'friend.request', peer: `peer-${bn}` }); tick(); await act(b, { k: 'friend.accept', acct: a.att.acct }); tick(); };
  const now = () => clock;
  try { await quiet(() => fn({ r, act, pose, join, befriend, tick, now })); } finally { Date.now = realNow; }
}
/** A hub link over a fake socket, opened and welcomed (soc2_session's harness). */
function hubLink({ acct = 'acct-me', asecret = 'secret-of-acct-me' } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1e6 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => clock.t, presence: false, acct, asecret });
  s.join(SOCIAL_ROOM, null);
  const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v: RELAY_VERSION });
  const sent = (t) => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === t);
  return { s, ws, clock, sent };
}
const state = (over = {}) => ({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', peers: ['peer-me'], friends: [], in: [], out: [], party: null, invites: [], ...over });
const row = (n, over = {}) => ({ acct: `acct-${n}`, name: n, online: true, seen: 1e12, peers: [`peer-${n}`], ...over });

// ------------------------------------------------------------ THE HUB (A) ------------------------------------------------------------

test('AUDIT SOC A1/A8: a request-and-cancel loop at the gate\'s rate reaches its target ONCE per SOCIAL_REPEAT_MS, and an invite-and-decline loop the same - the 40x amplifier is a 1x (mutants: the cooldown off; the stamp set on a refused act; the cooldown keyed by socket, so a reconnect resets it)', () => withHub(async ({ r, act, join, tick }) => {
  const a = await join('a'), b = await join('b');
  const heard = b.sent.length;
  for (let i = 0; i < 10; i++) { await act(a, { k: 'friend.request', peer: 'peer-b' }); tick(); await act(a, { k: 'friend.cancel', acct: 'acct-b' }); tick(); }
  assert.equal(b.sent.length - heard, 3, 'b heard the first request (a state frame and a note) and its cancel (a state frame) once');
  assert.equal(errors(a).filter((e) => e === 'already asked').length, 9, 'nine of the ten were refused in words');
  // a reconnect of a's tab does not reset it: the stamp is the ACCOUNT's
  const a2 = r.connect(); await r.hello(a2, 'peer-a', null, { name: 'a', acct: 'acct-a', asecret: 'secret-of-acct-a' }); tick();
  await act(a2, { k: 'friend.request', peer: 'peer-b' }); tick(); assert.equal(errors(a2).at(-1), 'already asked');
  tick(SOCIAL_REPEAT_MS);
  await act(a2, { k: 'friend.request', peer: 'peer-b' }); tick(); assert.deepEqual(lastOf(b, 'state').in.map((e) => e.acct), ['acct-a'], 'past the window it lands');
  // the stamps are PER TARGET and all kept: an ask at c between does not forget b's
  const c = await join('c');
  await act(a2, { k: 'friend.cancel', acct: 'acct-b' }); tick();
  await act(a2, { k: 'friend.request', peer: 'peer-c' }); tick(); assert.deepEqual(lastOf(c, 'state').in.map((e) => e.acct), ['acct-a'], 'c asked, first time');
  const bHeard = b.sent.length;
  await act(a2, { k: 'friend.request', peer: 'peer-b' }); tick(); assert.equal(errors(a2).at(-1), 'already asked', 'b\'s stamp stands beside c\'s'); assert.equal(b.sent.length, bHeard);
  await act(a2, { k: 'friend.cancel', acct: 'acct-c' }); tick();
  tick(SOCIAL_REPEAT_MS);
  // the invite loop
  const heardC = c.sent.length;
  for (let i = 0; i < 6; i++) { await act(a2, { k: 'party.invite', peer: 'peer-c' }); tick(); await act(c, { k: 'party.decline', party: a2.att.party }); tick(); }
  assert.equal(ofKind(c, 'invite').length, 1, 'one invite frame reached c');
  assert.equal(errors(c).filter((e) => e === 'no such invite').length, 5, 'the rest c heard were its own declines\' answers - nothing of a\'s five re-invites reached it');
  assert.equal(c.sent.length - heardC, 2 + 5, 'the invite, the decline\'s own picture, and five refusals of c\'s own asking');
  assert.equal(errors(a2).filter((e) => e === 'already asked').length, 2 + 5, 'the two re-requests and the five re-invites refused');
}));

test('AUDIT SOC A2: a storage that throws is CONTAINED in every arm - an act answers "the hub stumbled", a hello still welcomes, a leave still leaves, and no socket is closed for it (mutants: any arm unwrapped, which threw out of the door and dropped the socket)', () => withHub(async ({ r, act, join, tick }) => {
  const a = await join('a'), b = await join('b');
  const get = r.state.storage.get.bind(r.state.storage);
  // the HUB's keys throw (an account, a secret, a party); the room's own (the hello gate, the peer's secret) answer - the
  // base relay's arms are not this audit's, and a hello whose gate read throws is the relay's to answer as it always did
  r.state.storage.get = async (k) => { if ((Array.isArray(k) ? k : [k]).some((x) => /^(acct|asecret|party):/.test(x))) throw new Error('storage down'); return get(k); };
  r.wake();   // a fresh instance: nothing cached, every arm reads
  await act(a, { k: 'party.leave' }); tick();
  assert.equal(errors(a).at(-1), 'the hub stumbled - try again'); assert.equal(a.closed, null, 'the socket stands');
  const c = r.connect(); await assert.doesNotReject(r.hello(c, 'peer-c', null, { name: 'c', acct: 'acct-c', asecret: 'secret-of-acct-c' }));
  assert.equal(c.closed, null, 'the hello gate\'s own read threw');
  await assert.doesNotReject(r.drop(b), 'the leave');
  r.state.storage.get = get;
  r.wake();
  await act(a, { k: 'party.leave' }); tick(); assert.equal(errors(a).at(-1), 'you are not in a party', 'storage back: the hub answers again');
}));

test('AUDIT SOC A3: the hub sweeps on an alarm - the room is marked a hub and the alarm armed by the first account hello; an account NOBODY\'S LIST NAMES and nobody has seen for ACCOUNT_IDLE_MS is forgotten with its secret, a page (SWEEP_PAGE) per firing with the cursor in storage, a listed or a recent or an online one never (mutants: the alarm never armed; every account swept; a friend swept; the page unbounded; the cursor not kept)', () => withHub(async ({ r, join, befriend, tick, now }) => {
  const a = await join('a');
  assert.equal(r.store.get('hub'), 1, 'marked a hub by the first account hello'); assert.equal(r.alarm.at, now() - 10 + ACCOUNT_SWEEP_MS, 'the sweep armed');
  const b = await join('b'), c = await join('c');
  await befriend(a, b, 'b');
  const armed = r.alarm.at;
  const d = await join('d');   // stays online through the idle window
  await r.drop(a); await r.drop(b); await r.drop(c); tick();
  assert.equal(r.alarm.at, armed, 'a later hello arms nothing again');
  // 130 unlisted idle accounts written straight into storage, beside c
  const idle = { seen: now() - ACCOUNT_IDLE_MS - 1, friends: [], in: [], out: [], invites: [], party: null };
  for (let i = 0; i < 130; i++) { r.store.set(`acct:acct-x${String(i).padStart(3, '0')}`, { name: 'x', ...idle }); r.store.set(`asecret:acct-x${String(i).padStart(3, '0')}`, 's'.repeat(8)); }
  r.wake();
  tick(ACCOUNT_IDLE_MS + 1000);
  await r.fire();
  const keys = () => [...r.store.keys()];
  assert.ok(keys().includes('acct:acct-a') && keys().includes('acct:acct-b') && keys().includes('asecret:acct-a'), 'a and b name each other: never swept');
  assert.ok(keys().includes('acct:acct-d'), 'd is online: never swept');
  assert.ok(!keys().includes('acct:acct-c') && !keys().includes('asecret:acct-c'), 'c, unlisted and idle, is forgotten with its secret');
  const left = keys().filter((k) => k.startsWith('acct:acct-x')).length;
  assert.equal(left, 130 - (SWEEP_PAGE - 4), 'ONE PAGE: a, b, c, d and the first of the x\'s filled it');
  assert.equal(r.store.get('sweep:acct'), 'acct:acct-x' + String(SWEEP_PAGE - 5).padStart(3, '0'), 'the cursor rides storage');
  assert.equal(r.alarm.at, now() + SWEEP_STEP_MS, 'a full page is followed SWEEP_STEP_MS later');
  tick(SWEEP_STEP_MS);
  await r.fire();
  assert.equal(keys().filter((k) => k.startsWith('acct:acct-x')).length, 0, 'the second firing takes the rest');
  assert.equal(r.store.get('sweep:acct'), null, 'and the cursor is done');
  assert.equal(r.alarm.at, now() + ACCOUNT_SWEEP_MS, 'an empty page: the next sweep is ACCOUNT_SWEEP_MS out');
  assert.ok(keys().includes('acct:acct-a') && keys().includes('acct:acct-d'));
}));

test('AUDIT SOC A4: a party of ONE with no live invite goes with its maker\'s last tab; one that has asked someone waits out the invite; and the sweep deletes a party whose every seat has lapsed and keeps one with a seat still held (mutants: the solo party kept until the sweep; a party deleted under a live invite; a party with an online member swept)', () => withHub(async ({ r, act, join, tick, now }) => {
  const a = await join('a'), b = await join('b');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick();
  const pid = a.att.party;
  await r.drop(a); tick();
  assert.ok(r.store.has('party:' + pid), 'the invite to b is live: the party waits for a\'s refresh');
  const a2 = await join('a');
  assert.deepEqual(lastOf(a2, 'state').party.members.map((m) => m.acct), ['acct-a'], 'and a is back in the seat');
  tick(INVITE_TTL_MS);
  await r.drop(a2); tick();
  assert.equal(r.store.has('party:' + pid), false, 'the invite lapsed, the seat is a\'s alone: the party goes with a\'s last tab');
  assert.equal(r.store.get('acct:acct-a').party, null, 'and a\'s pointer is cleared');
  // the sweep's party page
  const lapsed = { id: 'q-lapsed', leader: 'acct-l1', members: ['acct-l1', 'acct-l2'], invites: [], away: { 'acct-l1': now() - PARTY_OFFLINE_MS - 1, 'acct-l2': now() - PARTY_OFFLINE_MS - 1 }, at: now() };
  const never = { id: 'q-never', leader: 'acct-n1', members: ['acct-n1'], invites: [], away: {}, at: now() };
  const held = { id: 'q-held', leader: 'acct-b', members: ['acct-b', 'acct-h2'], invites: [], away: { 'acct-h2': now() - PARTY_OFFLINE_MS - 1 }, at: now() };
  for (const p of [lapsed, never, held]) r.store.set('party:' + p.id, p);
  r.wake();
  await r.fire();
  assert.equal(r.store.has('party:q-lapsed'), false, 'every seat lapsed: deleted');
  assert.equal(r.store.has('party:q-never'), false, 'a seat never stamped away and nobody in it: deleted');
  assert.equal(r.store.has('party:q-held'), true, 'b is online in it: kept');
}));

test('AUDIT SOC A5: a state frame for an account with NO socket is not composed (it reached nobody and read every friend\'s record), and the records an awake object has read are kept - a second act reads storage for nothing it holds (mutants: the frame composed for the offline; the cache dropped, which is one act at ~500 reads again)', () => withHub(async ({ r, act, join, befriend, tick }) => {
  const a = await join('a'), b = await join('b'), c = await join('c');
  await befriend(a, b, 'b');
  await act(b, { k: 'friend.request', peer: 'peer-c' }); tick();   // b's picture has an outbox row to read
  await r.drop(b); tick();
  let framed = 0;
  const accts = r.room._accts.bind(r.room);
  r.room._accts = async function (ids) { if ([...ids].includes('acct-c')) framed++; return accts(ids); };
  await act(a, { k: 'friend.remove', acct: 'acct-b' }); tick();
  assert.equal(framed, 0, 'b has no socket: b\'s picture was not built');
  assert.deepEqual(r.store.get('acct:acct-b').friends, [], 'the record moved all the same');
  // the cache: a second act by a reads no record from storage
  let reads = 0;
  const get = r.state.storage.get.bind(r.state.storage);
  r.state.storage.get = async (k) => { reads++; return get(k); };
  await act(a, { k: 'party.leave' }); tick();
  assert.equal(reads, 0, 'a\'s record is the instance\'s copy');
  r.wake();
  await act(a, { k: 'party.leave' }); tick();
  assert.ok(reads >= 1, 'after a wake it is read once, then kept');
  const after = reads;
  await act(a, { k: 'party.leave' }); tick();
  assert.equal(reads, after, 'kept');
  // AUDIT SOC A9: a party that is NOT there is kept as a miss - an invite naming a swept party read storage on every
  // picture until its TTL
  r.store.set('acct:acct-a', { ...r.store.get('acct:acct-a'), invites: [{ party: 'q-gone', from: 'acct-c', at: Date.now() }] });
  r.wake();
  let partyReads = 0;
  r.state.storage.get = async (k) => { if ((Array.isArray(k) ? k : [k]).includes('party:q-gone')) partyReads++; return get(k); };
  const t1 = await join('a'), t2 = await join('a');   // two hellos of a: two pictures composed, each reading the invite's party
  assert.ok(lastOf(t1, 'state') && lastOf(t2, 'state'), 'two pictures composed'); assert.deepEqual(lastOf(t2, 'state').invites, [], 'the invite names a party that is not there: dropped');
  assert.equal(partyReads, 1, 'the missing party read once, then a kept miss');
}));

test('AUDIT SOC A7: a socket REPLACED by a hello naming another account (or none) leaves its account - the friends hear it go, last-seen is stamped, the seat is marked away (mutants: the replaced socket\'s account never leaving, so its seat could never lapse and its friends saw it online for ever)', () => withHub(async ({ r, act, join, befriend, tick, now }) => {
  const a = await join('a'), b = await join('b');
  await befriend(a, b, 'b');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick(); await act(b, { k: 'party.accept', party: a.att.party }); tick();
  const pid = a.att.party;
  // the same PEER id says hello again with no account: the first socket is replaced
  const plain = r.connect(); await r.hello(plain, 'peer-a', null, { name: 'a' }); tick();
  assert.equal(a.att.id, null, 'replaced');
  assert.deepEqual(lastOf(b, 'presence'), { t: 'social', k: 'presence', acct: 'acct-a', name: 'a', online: false, seen: now() - 600, peers: [] }, 'b heard a go');
  assert.equal(r.store.get('acct:acct-a').seen, now() - 600, 'last seen stamped');
  assert.equal(r.store.get('party:' + pid).away['acct-a'], now() - 600, 'the seat marked away');
  assert.equal(lastOf(b, 'party').party.members.find((m) => m.acct === 'acct-a').online, false, 'the view says so');
}));

test('AUDIT SOC A10/B9: ACCOUNT_TABS_MAX is the hub\'s own bound - a row names that many peer ids and a fan reaches that many sockets of one account; and of one account\'s tabs the NEWEST speaks for the party seat - an older tab\'s pose is kept and fanned to nobody (mutants: the bound on the projection alone; every tab fanned to; two tabs fighting over the seat\'s pose)', () => withHub(async ({ r, act, pose, join, befriend, tick }) => {
  const a = await join('a'), b = await join('b');
  await befriend(a, b, 'b');
  const tabs = [b];
  for (let i = 0; i < ACCOUNT_TABS_MAX + 1; i++) { const t = r.connect(); await r.hello(t, `peer-b${i}`, null, { name: 'b', acct: 'acct-b', asecret: 'secret-of-acct-b' }); tick(); tabs.push(t); }
  assert.equal(lastOf(a, 'presence').peers.length, ACCOUNT_TABS_MAX, 'the row names ACCOUNT_TABS_MAX of the ten');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick(); await act(b, { k: 'party.accept', party: a.att.party }); tick();
  await pose(a); tick();
  assert.equal(tabs.filter((t) => poses(t).length > 0).length, ACCOUNT_TABS_MAX, 'the fan reaches ACCOUNT_TABS_MAX of b\'s tabs');
  assert.ok(poses(b).length === 0 && poses(tabs[1]).length === 0, 'and the two STALEST tabs are the ones past the bound - the newest are kept');
  // the newest tab speaks
  const newest = tabs.at(-1), older = tabs[2];
  await pose(older, { ...P, px: 1 }); tick();
  assert.equal(poses(a).length, 0, 'the older tab\'s pose reached nobody');
  assert.equal(older.att.pm.px, 1, 'but it is kept on its attachment');
  await pose(newest, { ...P, px: 2 }); tick();
  assert.equal(poses(a).at(-1)?.p.px, 2, 'the newest tab\'s pose is the seat\'s');
  await r.drop(newest); tick();
  await pose(tabs.at(-2), { ...P, px: 3 }); tick();
  assert.equal(poses(a).at(-1)?.p.px, 3, 'the newest gone, the next newest speaks');
  await pose(older, { ...P, px: 4 }); tick();
  assert.equal(poses(a).at(-1)?.p.px, 3, 'and the older still does not');
}));

test('AUDIT SOC A11: "no account" is a refusal UNDER the room\'s budget - past SOCIAL_ROOM_HZ_MAX in a second every socket hears "busy", the accountless too (mutants: the accountless answered before the budget, which was an unbudgeted send per act from every socket without one)', () => withHub(async ({ r, act, tick }) => {
  const socks = [];
  for (let i = 0; i < SOCIAL_ROOM_HZ_MAX + 4; i++) { const ws = r.connect(); await r.hello(ws, `peer-n${i}`, null, { name: 'n' }); tick(10); socks.push(ws); }   // spaced as a real crowd is: the channel's hello gate is not the pin
  tick(2000);
  let none = 0, busy = 0;
  for (const ws of socks) { await act(ws, { k: 'party.leave' }); const e = errors(ws).at(-1); if (e === 'no account') none++; else if (e === 'busy') busy++; }
  assert.equal(none, SOCIAL_ROOM_HZ_MAX); assert.equal(busy, 4);
}));

test('AUDIT SOC (the attachment): the widest attachment a hub socket carries - the longest name, a party pose with the longest place name, every bucket - fits the runtime\'s 2 KiB, which the fake enforces (mutants: a field added to the attachment without this being re-measured)', () => withHub(async ({ r, act, pose, join, tick }) => {
  const a = await join('a', { name: 'N'.repeat(NAME_MAX) });
  const b = await join('b');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick(); await act(b, { k: 'party.accept', party: a.att.party }); tick();
  await pose(a, { ...P, loc: 'L'.repeat(PARTY_LOC_MAX), px: 999, py: 499, h: 9999, hm: 9999, f: 9999, fm: 9999, m: 9999, mm: 9999 }); tick();
  for (let i = 0; i < 5; i++) { await act(a, { k: 'party.kick', acct: 'acct-zz' }); await r.ping(a); await pose(a); }   // the buckets and the strike counts written
  assert.equal(a.closed, null, 'never "hello too large" or a failed write');
  const bytes = JSON.stringify(a.att).length;
  assert.ok(bytes <= 2048, `the attachment is ${bytes} bytes`);
  assert.ok(bytes > 400, 'and it is the wide one (the pose, the name, the buckets are on it)');
}));

// ------------------------------------------------------------ THE CLIENT (B) ------------------------------------------------------------

test('AUDIT SOC B3: the hub\'s frames are GATED COMING IN, per room - the picture at SOCIAL_IN_HZ_MAX, the lines (a note, an error) at NOTE_IN_HZ_MAX, the members\' poses at PARTY_IN_HZ_MAX - and an honest hub at full tilt passes whole (mutants: any gate off; the three on one bucket, so a flood of notes stalled the picture)', () => quiet(() => {
  const { s, ws, clock } = hubLink();
  const social = [], party = [];
  s.onSocial = (f) => social.push(f); s.onParty = (acct, p) => party.push([acct, p]);
  for (let i = 0; i < SOCIAL_IN_HZ_MAX + 5; i++) ws.receive(state());
  assert.equal(social.length, SOCIAL_IN_HZ_MAX, 'a burst is the rate'); assert.equal(s.stats.socialsDropped, 5);
  for (let i = 0; i < NOTE_IN_HZ_MAX + 3; i++) ws.receive({ t: 'social', k: 'note', code: 'party.joined', acct: 'acct-b', name: 'b' });
  assert.equal(social.filter((f) => f.k === 'note').length, NOTE_IN_HZ_MAX, 'the lines on their own, tighter bucket'); assert.equal(s.stats.socialsDropped, 8);
  ws.receive({ t: 'social', k: 'error', m: 'busy' });
  assert.equal(social.at(-1)?.k, 'note', 'an error is a line too: the notes spent its bucket');
  for (let i = 0; i < PARTY_IN_HZ_MAX + 2; i++) ws.receive({ t: 'party', acct: 'acct-b', p: P });
  assert.equal(party.length, PARTY_IN_HZ_MAX); assert.equal(s.stats.partiesDropped, 2);
  assert.equal(PARTY_IN_HZ_MAX, PARTY_HZ_MAX * (PARTY_MAX - 1), 'three other members at the pose rate each');
  clock.t += 1000;
  ws.receive(state()); ws.receive({ t: 'party', acct: 'acct-b', p: P }); ws.receive({ t: 'social', k: 'error', m: 'busy' });
  assert.equal(social.length, SOCIAL_IN_HZ_MAX + NOTE_IN_HZ_MAX + 2, 'refilled, all three'); assert.equal(party.length, PARTY_IN_HZ_MAX + 1);
  assert.equal(s.status, 'open', 'a flood closes nothing on this side');
}));

test('AUDIT SOC B20: a frame wider than an honest relay\'s widest (INBOUND_FRAME_MAX: a memory and a full roster of hellos) is dropped UNPARSED; one at the bound is read (mutants: the bound off, which is JSON.parse of a relay\'s megabytes; the bound under the widest welcome, which drops a loaded room\'s memory)', () => quiet(() => {
  const { s, ws } = hubLink();
  const social = [];
  s.onSocial = (f) => social.push(f);
  assert.equal(INBOUND_FRAME_MAX, WORLD_FRAME_MAX + ROSTER_MAX * MAX_FRAME_BYTES, 'derived from the wire\'s own bounds, not a number');
  const pad = (n) => JSON.stringify({ t: 'social', k: 'note', code: 'party.joined', acct: 'acct-b', name: 'b', pad: 'x'.repeat(n) });
  const wide = pad(INBOUND_FRAME_MAX);
  ws.receive(wide);
  assert.equal(social.length, 0, 'dropped'); assert.equal(s.stats.oversize, 1); assert.equal(s.stats.received, 1, 'never counted as received... counted at the door');
  const fits = pad(INBOUND_FRAME_MAX - pad(0).length);
  assert.ok(fits.length <= INBOUND_FRAME_MAX);
  ws.receive(fits);
  assert.equal(social.length, 1, 'at the bound it is read');
}));

test('AUDIT SOC B11: an act leaves through the wire\'s OWN projection - a kind with no law, a target named twice or not at all, an id outside the id law never leaves (the hub\'s parser answers those with a CLOSE) (mutants: the shape checked by hand here and by law there, and the two disagreeing)', () => quiet(() => {
  const { s, sent } = hubLink();
  for (const bad of [{ k: 'friend.request' }, { k: 'friend.request', acct: 'acct-b', peer: 'peer-b' }, { k: 'party.accept', party: 'q-1' }, { k: 'party.accept' }, { k: 'friend.accept', peer: 'peer-b' }, { k: 'friend.befriend', acct: 'acct-b' }, { k: 'friend.request', peer: 'peer b' }]) {
    assert.equal(s.sendSocial(bad), false, JSON.stringify(bad)); assert.equal(validSocialAct(bad), null, 'the same answer the door gives');
  }
  assert.equal(sent('social').length, 0);
  assert.equal(s.sendSocial({ k: 'party.kick', acct: 'acct-b', party: 'q-1234', peer: 'peer-b' }), true, 'a field the kind does not need is dropped, not refused');
  assert.deepEqual(sent('social').at(-1), { t: 'social', k: 'party.kick', acct: 'acct-b' });
}));

test('AUDIT SOC B7: the link says whether a welcome has carried the relay\'s clock (`clockRead`) - a channel\'s does since AUDIT SOC, and the host reads the HUB link\'s clock through it, the presence session\'s standing in only for a relay from before (mutants: the flag never set; the offset read off a link whose welcome carried none)', () => quiet(() => {
  const { s, ws } = hubLink();
  assert.equal(s.clockRead, false, 'the welcome above carried no clock');
  assert.equal(s.clockOffsetMs, 0);
  ws.receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v: RELAY_VERSION, now: Date.now() + 5000 });
  assert.equal(s.clockRead, true); assert.ok(Math.abs(s.clockOffsetMs - 5000) < 200, `the offset (${s.clockOffsetMs})`);
  const w = rd('src/scenes/world.js');
  assert.match(w, /const hub = socialLink\(\);\n\s*social\.setClockOffset\(hub\?\.clockRead \? hub\.clockOffsetMs : \(online\?\.clockOffsetMs \?\? 0\)\);/, 'the host: the hub link\'s clock when it has one, else the presence session\'s');
}));

test('AUDIT SOC C20/C23: the picture names MY OWN tabs (`peers`) - a second tab of mine is me (accountOfPeer, relation "me", actionsFor "that is you"), never a stranger to friend or invite; and the colour answers are kept per version, dropped on every change (mutants: my own tab a stranger; the memo never dropped, so a friend made stayed uncoloured)', () => {
  const social = new SocialState({ now: () => 1e12, acct: 'acct-me' });
  social.apply(validSocialFrame(state({ peers: ['peer-me', 'peer-me2'], friends: [row('b')] })));
  assert.deepEqual(social.peers, ['peer-me', 'peer-me2']);
  assert.equal(social.accountOfPeer('peer-me2'), 'acct-me'); assert.equal(social.relation(social.accountOfPeer('peer-me2')), 'me');
  const a = social.actionsFor('peer-me2');
  assert.equal(a.canFriend, false); assert.equal(a.canInvite, false); assert.equal(a.whyNotFriend, 'that is you'); assert.equal(a.whyNotInvite, 'that is you');
  assert.equal(social.accountOfPeer('peer-b'), 'acct-b'); assert.equal(social.actionsFor('peer-b').canInvite, true, 'a friend\'s tab is a door still');
  assert.equal(social.accountOfPeer('peer-zz'), null);
  // the memo
  assert.equal(social.cssColorOf('peer-b'), FRIEND_CSS); assert.equal(social.cssColorOf('peer-zz'), null);
  assert.equal(social._colors.size, 2, 'two answers kept');
  assert.equal(social.cssColorOf('peer-b'), FRIEND_CSS, 'the same answer, from the memo');
  const v = social.version;
  social.apply(validSocialFrame({ t: 'social', k: 'party', party: { id: 'q-party-1', leader: 'acct-me', members: [{ ...row('me'), p: null }, { ...row('b'), p: null }] } }));
  assert.ok(social.version > v); assert.equal(social._colors, null, 'dropped on the change');
  assert.equal(social.cssColorOf('peer-b'), PARTY_GREEN_CSS, 'and the new answer is the party\'s');
  assert.equal(social.colorOf('peer-b') !== null, true);
  assert.equal(social.cssColorOf('peer-me2'), null, 'my own other tab wears no colour: I am not my own friend');
  const before = validSocialFrame({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac' });
  assert.deepEqual(before.peers, [], 'a frame from before AUDIT SOC names none, and the door says so as a list');
});

// ------------------------------------------------------------ THE HOST'S SOURCE ------------------------------------------------------------

test('AUDIT SOC B5/B18/B10: the party pose says fatigue in the sheet\'s digits (/ FATIGUE_MULTIPLIER) and reads the entity, not a whole look, with the pixel read once; a page with no account says so once on the world tab and builds no social arm (mutants: the pool sent x64, so a member\'s card said 3200/6400; composeLook per pose, every item for three fields; the accountless page silent with a dead button)', () => {
  const w = rd('src/scenes/world.js');
  const pose = w.slice(w.indexOf('const composePartyPose = () => {'), w.indexOf('const partyMarkers = '));
  assert.match(pose, /f: Math\.trunc\(\(playerEntity\.fatigue \?\? 0\) \/ FATIGUE_MULTIPLIER\), fm: Math\.trunc\(maxFatigue\(playerEntity\) \/ FATIGUE_MULTIPLIER\)/, 'the digits ui/charsheet.js shows');
  assert.match(w, /import \{ maxFatigue, FATIGUE_MULTIPLIER \} from '\.\.\/systems\/statMods\.js';/);
  assert.doesNotMatch(pose, /composeLook\(/, 'no look composed for three fields');
  assert.match(pose, /race: playerEntity\.race \?\? 'Breton', gender: playerEntity\.gender \?\? 'male', face: playerEntity\.faceIndex \?\? 0/, 'composeLook\'s own three readings');
  assert.equal((pose.match(/playerTravelPixel\(\)/g) ?? []).length, 1, 'the pixel once');
  assert.doesNotMatch(pose, /_questLoc\(\)/, 'which read it twice more');
  const start = w.slice(w.indexOf('const socialStart = () => {'), w.indexOf('const composePartyPose'));
  assert.match(start, /if \(!link\.acct\) \{[^\n]*\n\s*if \(!_noAccountSaid\) \{ _noAccountSaid = true; chatLog\.push\(tab\.id, \{ text: NO_ACCOUNT_TEXT, system: true \}\); \}\n\s*return;\n\s*\}/, 'no account: the line, once, and out');
  assert.match(start, /social = new SocialState\(\{ acct: link\.acct \}\);/, 'AUDIT SOC B19: the picture expects the account this session sent');
  assert.match(w, /const NO_ACCOUNT_TEXT = 'Friends and parties are off: this browser keeps no storage, so there is no account to be anyone by';/);
  // AUDIT SOC C2/C14/C9: the host's word on which surface is TOPMOST (ui/chatPanel.js, ui/socialPanel.js, ui/socialMenu.js
  // take `above`), and the phone's F handed to the touch layer as the host's own door
  assert.match(w, /above: \(\) => !!\(socialPanel\?\.isOpen\?\.\(\) \|\| socialMenu\?\.isOpen\?\.\(\)\),/, 'the chat yields to the panel and the menu');
  assert.match(start, /above: \(\) => !!socialMenu\?\.isOpen\?\.\(\),/, 'the panel yields to the menu');
  assert.match(w, /socialInteract: \(\) => socialInteract\(\),/, 'the touch layer\'s hook is the host\'s door (AUDIT SOC C9)');
});
