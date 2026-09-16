// SOC2 (2026-09-16, Mac: "friend other users, see if they are online/last online ... the players name who are in a
// party together should turn green"): THE CLIENT'S HALF - the session's account and social arms (net/online.js) and
// the picture it holds (net/social.js), driven over a fake socket and plain frames, no browser.
//
// TWO IDENTITIES. The peer id is the tab's (TABS1) and stays exactly where its pin holds it; the ACCOUNT is the
// profile's (net/social.js accountId, in the app's own storage) and rides the HUB's hello alone - a presence session
// is never handed one. Each pin names the mutants it kills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OnlineSession } from '../src/net/online.js';
import { SocialState, accountId, accountSecret, lastOnlineText, noteText, PARTY_GREEN, PARTY_GREEN_CSS, FRIEND_CSS } from '../src/net/social.js';
import { SOCIAL_ROOM, SOCIAL_HZ_MAX, PARTY_HZ_MAX, PARTY_SEND_MS, INVITE_TTL_MS, PARTY_MAX, NOTE_CODES, validPartyPose, RELAY_VERSION } from '../src/net/wire.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const P = Object.freeze({ px: 100, py: 200, loc: 'Daggerfall', in: 0, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 });
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
/** A hub link over a fake socket, opened and welcomed; `clock` is the session's own. */
function hubLink({ acct = 'acct-me', asecret = 'secret-of-acct-me', presence = false } = {}) {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1e6 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => clock.t, presence, acct, asecret });
  s.join(presence ? 'world:1,1' : SOCIAL_ROOM, presence ? { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 } : null);
  const ws = sockets[0]; ws.open();
  ws.receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v: RELAY_VERSION });
  const sent = (t) => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === t);
  return { s, ws, sockets, clock, sent };
}
const row = (n, over = {}) => ({ acct: `acct-${n}`, name: n, online: true, seen: 1e12, peers: [`peer-${n}`], ...over });
const state = (over = {}) => ({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', friends: [], in: [], out: [], party: null, invites: [], ...over });
const view = (members, leader = members[0]?.acct) => ({ id: 'q-party-1', leader, members: members.map((m) => ({ ...m, p: m.p ?? null })) });

test('SOC2: the account\'s pair - minted once in the storage handed in, kept, the shape the wire admits, an `a` first; a storage that throws mints a fresh one and never crashes; and the peer\'s pair is untouched in its own home (mutants: the account in the tab\'s storage; net/online.js reaching for appStorage)', () => {
  const store = new Map(); const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  const id = accountId(storage); assert.match(id, /^a[A-Za-z0-9_-]{3,39}$/); assert.equal(accountId(storage), id, 'the same next time'); assert.equal(store.get('dagger.online.account'), id);
  const sec = accountSecret(storage); assert.match(sec, /^[A-Za-z0-9_-]{8,64}$/); assert.equal(accountSecret(storage), sec); assert.notEqual(sec, id);
  assert.equal(accountId({ getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } }), null, 'AUDIT SOC B10: a storage that throws keeps no account - null, never a crash and never a fresh permanent record per load');
  assert.equal(accountId(null), null, 'no storage at all: no account');
  assert.equal(accountSecret({ getItem: () => null, setItem() {} }), null, 'a storage that takes the write and forgets it: no account either (read back after the write)');
  const src = rd('src/net/social.js');
  assert.match(src, /export const accountId = \(storage = appStorage\(\)\)/, 'the app\'s own storage - the profile\'s, not the tab\'s');
  assert.match(src, /export const accountSecret = \(storage = appStorage\(\)\)/);
  assert.doesNotMatch(src, /tabStorage/, 'never the tab\'s: two tabs are two peers of one account');
  assert.doesNotMatch(rd('src/net/online.js'), /appStorage\(\)/, 'TABS1\'s pin: the session module never touches the browser-wide storage');
});

test('SOC2: the hello carries the account when the session holds both halves and NOTHING when it does not - a presence session is never handed one, a build before SOC1 sends the hello it always sent (mutants: the account defaulted from storage; one half sent; the keys on the presence hello)', () => quiet(() => {
  const { ws } = hubLink();
  const hello = JSON.parse(ws.sent[0]);
  assert.deepEqual(hello, { t: 'hello', id: 'peer-me', secret: 'secret-of-peer-me', name: 'Mac', look: { race: 'Breton', gender: 'male', faceIndex: 0, items: [] }, pose: null, acct: 'acct-me', asecret: 'secret-of-acct-me' });
  assert.ok(ws.sent[0].startsWith('{"t":"hello"'), 'the prefix the relay reads first');
  const half = hubLink({ acct: 'acct-me', asecret: null });
  assert.ok(!('acct' in JSON.parse(half.ws.sent[0])) && !('asecret' in JSON.parse(half.ws.sent[0])), 'one half is no account');
  assert.equal(half.s.acct, null);
  const none = hubLink({ acct: null, asecret: null });
  assert.deepEqual(Object.keys(JSON.parse(none.ws.sent[0])), ['t', 'id', 'secret', 'name', 'look', 'pose'], 'the old hello, key for key');
  // one half set on the session AFTER construction (world.js sets both; a caller that sets one is not the port's) - the hello's own door
  const lone = hubLink({ acct: null, asecret: null });
  lone.s.acct = 'acct-me'; lone.ws.drop(1006); lone.clock.t += 60_000; lone.s.tick();
  const lws = lone.sockets[1]; lws.open();
  assert.ok(!('acct' in JSON.parse(lws.sent[0])) && !('asecret' in JSON.parse(lws.sent[0])), 'an account without its secret is not sent - the hub would refuse the hello whole');
  const pres = hubLink({ presence: true });
  assert.equal(JSON.parse(pres.ws.sent[0]).acct, 'acct-me', 'a presence session HANDED the pair sends it - the caller\'s choice; world.js hands it to the hub link alone');
  assert.match(rd('src/scenes/world.js'), /if \(tab\.room === SOCIAL_ROOM\) \{ link\.acct = accountId\(\); link\.asecret = accountSecret\(\); \}/, 'and world.js hands it to the hub tab\'s link - after the join, before the socket can open');
  assert.doesNotMatch(rd('src/scenes/world.js'), /online = new OnlineSession\(\{[^}]*acct/, 'never to the presence session');
}));

test('SOC2: sendSocial - an act as SOCIAL_ACTS has it, gated at home at the hub\'s rate (the token spent only on an act that left), refused without an account or with a kind the wire has no law for (mutants: the gate off; a made-up kind sent; the act sent with no account)', () => quiet(() => {
  const { s, clock, sent } = hubLink();
  assert.equal(s.sendSocial({ k: 'friend.request', peer: 'peer-b' }), true);
  assert.deepEqual(sent('social').at(-1), { t: 'social', k: 'friend.request', peer: 'peer-b' });
  assert.equal(s.sendSocial({ k: 'party.accept', party: 'q-1234', extra: 'dropped' }), true);
  assert.deepEqual(sent('social').at(-1), { t: 'social', k: 'party.accept', party: 'q-1234' }, 'the three named fields alone ride');
  assert.equal(s.sendSocial({ k: 'party.leave' }), false, 'the third in a burst: over SOCIAL_HZ_MAX, refused here, never sent');
  assert.equal(sent('social').length, SOCIAL_HZ_MAX);
  clock.t += 1000; assert.equal(s.sendSocial({ k: 'party.leave' }), true, 'refilled');
  assert.equal(s.sendSocial({ k: 'friend.befriend', acct: 'acct-b' }), false, 'no law, no frame'); assert.equal(s.sendSocial(null), false); assert.equal(s.sendSocial({}), false);
  assert.equal(s.stats.socials, 3);
  const none = hubLink({ acct: null, asecret: null });
  assert.equal(none.s.sendSocial({ k: 'party.leave' }), false, 'no account: nothing to act as'); assert.equal(none.sent('social').length, 0);
  s.leave(); assert.equal(s.sendSocial({ k: 'party.leave' }), false, 'no socket: nothing went');
}));

test('SOC2: sendParty - projected by the wire\'s law first, no sooner than PARTY_SEND_MS, only when CHANGED, forced on request, and the first after a reopened socket goes whole (mutants: an unchanged pose re-sent every second; a bad pose sent; the door\'s memory kept across a reconnect)', () => quiet(() => {
  const { s, ws, sockets, clock, sent } = hubLink();
  assert.equal(s.sendParty(P), true); assert.deepEqual(sent('party').at(-1), { t: 'party', p: validPartyPose(P) });
  assert.equal(s.sendParty({ ...P, px: 101 }), false, 'inside PARTY_SEND_MS: not yet');
  clock.t += PARTY_SEND_MS;
  assert.equal(s.sendParty(P), false, 'unchanged: not sent'); assert.equal(sent('party').length, 1);
  assert.equal(s.sendParty(P, { force: true }), true, 'forced: sent');
  clock.t += PARTY_SEND_MS;
  assert.equal(s.sendParty({ ...P, h: 49 }), true, 'a vital moved: sent'); assert.equal(sent('party').at(-1).p.h, 49);
  clock.t += PARTY_SEND_MS;
  assert.equal(s.sendParty({ ...P, h: 49.4 }), false, 'a change the projection rounds away is no change');
  assert.equal(s.sendParty({ ...P, h: -1 }), false, 'a pose the hub would refuse is never sent'); assert.equal(s.sendParty(null), false);
  assert.equal(s.stats.parties, 3);
  // the socket drops and reopens: the hub's attachment is fresh, so the same pose goes whole again
  ws.drop(1006); clock.t += 60_000; s.tick();
  const ws2 = sockets[1]; ws2.open(); ws2.receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v: RELAY_VERSION });
  assert.equal(s.sendParty({ ...P, h: 49 }), true, 'the first after the reopen goes whole'); assert.equal(JSON.parse(ws2.sent.at(-1)).p.h, 49);
  const none = hubLink({ acct: null, asecret: null });
  assert.equal(none.s.sendParty(P), false, 'no account: no party to pose for');
  // the gate itself: PARTY_HZ_MAX a second even when forced
  const g = hubLink();
  let went = 0; for (let i = 0; i < 6; i++) { if (g.s.sendParty({ ...P, px: i }, { force: true })) went++; g.clock.t += PARTY_SEND_MS / 2; }
  assert.ok(went <= Math.ceil(6 * PARTY_SEND_MS / 2 / 1000 * PARTY_HZ_MAX) + 1 && went >= 2, `the floor and the gate together (went ${went})`);
}));

test('SOC2: the frames in - a hub frame reaches onSocial through the wire\'s door and a shaped one is dropped whole; a member\'s pose reaches onParty and my own account\'s never does; a throw inside a handler is contained (mutants: the door skipped; my own pose delivered; the handler\'s throw reaching the socket)', () => quiet(() => {
  const { s, ws } = hubLink();
  const social = [], party = [];
  s.onSocial = (f) => social.push(f); s.onParty = (acct, p) => party.push([acct, p]);
  ws.receive(state({ friends: [row('b')] }));
  assert.equal(social.length, 1); assert.deepEqual(social[0].friends, [row('b')]);
  ws.receive({ t: 'social', k: 'state', acct: 'acct-me', friends: [{ name: 'nobody' }] });
  assert.equal(social.length, 1, 'a frame the door refuses is dropped whole');
  ws.receive({ t: 'social', k: 'note', code: 'party.joined', acct: 'acct-b', name: 'b' });
  assert.deepEqual(social.at(-1), { t: 'social', k: 'note', code: 'party.joined', acct: 'acct-b', name: 'b' });
  ws.receive({ t: 'social', k: 'note', code: 'party.exploded' }); assert.equal(social.length, 2);
  ws.receive({ t: 'party', acct: 'acct-b', p: P });
  assert.deepEqual(party, [['acct-b', validPartyPose(P)]]);
  ws.receive({ t: 'party', acct: 'acct-me', p: P }); assert.equal(party.length, 1, 'my own account\'s pose - a second tab of mine - is not a member to draw');
  ws.receive({ t: 'party', acct: 'acct-b', p: { px: 1 } }); assert.equal(party.length, 1, 'a bad pose is dropped');
  s.onSocial = () => { throw new Error('the panel fell over'); };
  assert.doesNotThrow(() => ws.receive(state()));
  assert.equal(s.stats.threw, 1); assert.equal(s.threw.kind, 'social');
  assert.equal(s.status, 'open', 'the socket stands');
}));

test('SOC2: SocialState - the picture: a state replaces everything, presence keeps a friend\'s row (and the seat\'s), a party view rides over and keeps the poses it already held, an invite lands and is spent by the seat, a note becomes words, an error is kept for the panel; the version moves on every change and only then (mutants: presence for a stranger kept; a stale invite left after joining; the version bumped per frame)', () => {
  let clock = 1e12;
  const st = new SocialState({ now: () => clock });
  const changes = []; st.onChange = (k) => changes.push(k);
  const notes = []; st.onNote = (n, text) => notes.push(text);
  const errs = []; st.onError = (m) => errs.push(m);
  const invites = []; st.onInvite = (i) => invites.push(i.party);
  assert.equal(st.apply({ t: 'chat' }), null); assert.equal(st.version, 0);
  assert.equal(st.apply(state({ friends: [row('b'), row('c', { online: false, seen: 1e12 - 5000 })], in: [{ ...row('d'), at: 1e12 }], out: [{ ...row('e'), at: 1e12 }] })), 'state');
  assert.equal(st.acct, 'acct-me'); assert.equal(st.name, 'Mac'); assert.deepEqual([...st.friends.keys()], ['acct-b', 'acct-c']); assert.equal(st.version, 1);
  assert.equal(st.relation('acct-b'), 'friend'); assert.equal(st.relation('acct-d'), 'in'); assert.equal(st.relation('acct-e'), 'out'); assert.equal(st.relation('acct-me'), 'me'); assert.equal(st.relation('acct-zz'), 'none'); assert.equal(st.relation(null), 'none');
  assert.equal(st.pendingCount(), 1);
  // presence: a friend's row moves; a stranger's is nothing
  assert.equal(st.apply({ t: 'social', k: 'presence', ...row('c', { online: true, seen: 1e12, peers: ['peer-c', 'peer-c2'] }) }), 'presence');
  assert.deepEqual(st.friends.get('acct-c').peers, ['peer-c', 'peer-c2']); assert.equal(st.version, 2);
  assert.equal(st.apply({ t: 'social', k: 'presence', ...row('zz') }), null); assert.equal(st.version, 2, 'nothing changed, nothing bumped');
  assert.equal(st.isFriendPeer('peer-c2'), true); assert.equal(st.isFriendPeer('peer-zz'), false); assert.equal(st.accountOfPeer('peer-d'), 'acct-d', 'a requester\'s tab is known too'); assert.equal(st.accountOfPeer('peer-zz'), null);
  // the party: a view in, then a pose, then a view without the pose - the pose survives
  const members = [row('me', { acct: 'acct-me', name: 'Mac' }), row('b')];
  assert.equal(st.apply({ t: 'social', k: 'party', party: view(members) }), 'party');
  assert.equal(st.leads(), true); assert.deepEqual(st.others().map((m) => m.acct), ['acct-b']); assert.equal(st.seatsFree(), PARTY_MAX - 2);
  assert.deepEqual([...st.partyPeers()], ['peer-b']); assert.equal(st.isPartyPeer('peer-b'), true); assert.equal(st.isPartyPeer('peer-me'), false, 'never my own tab'); assert.equal(st.isPartyPeer('peer-c'), false, 'a friend is not a party');
  assert.deepEqual(st.colorOf('peer-b'), PARTY_GREEN); assert.equal(st.colorOf('peer-c'), null); assert.equal(st.colorOf('peer-zz'), null);
  assert.equal(st.cssColorOf('peer-b'), PARTY_GREEN_CSS, 'the DOM\'s green for my party'); assert.equal(st.cssColorOf('peer-c'), FRIEND_CSS, 'a friend not in my party is blue in the chat'); assert.equal(st.cssColorOf('peer-zz'), null, 'a stranger is nobody\'s colour');
  assert.equal(st.applyParty('acct-b', validPartyPose(P)), true); assert.equal(st.party.members[1].p.px, 100); assert.equal(changes.at(-1), 'pose');
  assert.equal(st.applyParty('acct-zz', validPartyPose(P)), false, 'not a member');
  st.apply({ t: 'social', k: 'party', party: view(members) });
  assert.equal(st.party.members[1].p.px, 100, 'a view with no pose keeps the pose I hold');
  st.apply({ t: 'social', k: 'party', party: view([members[0], { ...members[1], p: validPartyPose({ ...P, px: 7 }) }]) });
  assert.equal(st.party.members[1].p.px, 7, 'a view WITH a pose is the hub\'s latest');
  // presence follows onto the seat's row
  st.apply({ t: 'social', k: 'presence', ...row('b', { online: false, seen: 1e12 + 1, peers: [] }) });
  assert.equal(st.party.members[1].online, false); assert.deepEqual(st.party.members[1].peers, []); assert.equal(st.party.members[1].p.px, 7, 'the pose stays');
  assert.deepEqual([...st.partyPeers()], [], 'an away member has no tabs to draw green');
  // an invite lands, counts, and is spent by the seat; one to my own party is nothing
  const inv = { party: 'q-party-2', from: { acct: 'acct-c', name: 'c' }, members: [{ acct: 'acct-c', name: 'c' }], at: 1e12, expires: 1e12 + INVITE_TTL_MS };
  assert.equal(st.apply({ t: 'social', k: 'invite', ...inv }), 'invite'); assert.deepEqual(invites, ['q-party-2']); assert.equal(st.pendingCount(), 2);
  assert.equal(st.apply({ t: 'social', k: 'invite', ...inv, party: 'q-party-1' }), null, 'an invite to the party I sit in');
  clock = 1e12 + INVITE_TTL_MS + 1; assert.deepEqual(st.liveInvites(), [], 'lapsed as it is read'); assert.equal(st.pendingCount(), 1); clock = 1e12;
  st.apply({ t: 'social', k: 'invite', ...inv });
  st.apply({ t: 'social', k: 'party', party: view([row('c'), members[0]], 'acct-c') });   // I joined c's party (id q-party-1 in this fixture, so:)
  st.apply({ t: 'social', k: 'party', party: { ...view([row('c'), members[0]], 'acct-c'), id: 'q-party-2' } });
  assert.equal(st.invites.has('q-party-2'), false, 'seated: the invite is spent'); assert.equal(st.leads(), false);
  st.apply({ t: 'social', k: 'party', party: null }); assert.equal(st.party, null); assert.deepEqual([...st.partyPeers()], []); assert.equal(st.seatsFree(), PARTY_MAX - 1);
  // notes and errors
  st.apply({ t: 'social', k: 'note', code: 'party.joined', acct: 'acct-b', name: 'b' }); assert.equal(notes.at(-1), 'b joined the party');
  st.apply({ t: 'social', k: 'note', code: 'party.kicked', acct: 'acct-me', name: 'Mac' }); assert.equal(notes.at(-1), 'You were removed from the party');
  st.apply({ t: 'social', k: 'error', m: 'the party is full' }); assert.deepEqual(errs, ['the party is full']); assert.equal(st.lastError, 'the party is full');
  st.apply(state()); assert.equal(st.lastError, null, 'a fresh picture clears the last refusal');
  assert.deepEqual(changes.slice(0, 3), ['state', 'presence', 'party']);
});

test('SOC2: actionsFor a peer in the world - a stranger can be friended and invited, a friend invited but not friended again, a request out says so, my party\'s member neither, a full party invites nobody, and myself nothing (mutants: a friend friended twice; a fifth invite offered)', () => {
  const st = new SocialState({ now: () => 1e12 });
  st.apply(state({ friends: [row('b')], out: [{ ...row('e'), at: 1e12 }], in: [{ ...row('d'), at: 1e12 }] }));
  assert.deepEqual(st.actionsFor('peer-zz'), { acct: null, relation: 'none', canFriend: true, canInvite: true, whyNotFriend: null, whyNotInvite: null }, 'a stranger');
  assert.deepEqual(st.actionsFor('peer-b'), { acct: 'acct-b', relation: 'friend', canFriend: false, canInvite: true, whyNotFriend: 'already friends', whyNotInvite: null });
  assert.equal(st.actionsFor('peer-e').whyNotFriend, 'request sent');
  assert.equal(st.actionsFor('peer-d').canFriend, true, 'they asked me: a request back is a yes (the hub\'s law)');
  st.apply({ t: 'social', k: 'party', party: view([row('me', { acct: 'acct-me', name: 'Mac' }), row('b')]) });
  assert.deepEqual(st.actionsFor('peer-b').canInvite, false); assert.equal(st.actionsFor('peer-b').whyNotInvite, 'in your party');
  assert.equal(st.actionsFor('peer-zz').canInvite, true, 'two seats free');
  st.apply({ t: 'social', k: 'party', party: view([row('me', { acct: 'acct-me', name: 'Mac' }), row('b'), row('c'), row('f')]) });
  assert.equal(st.actionsFor('peer-zz').whyNotInvite, 'the party is full');
  assert.deepEqual(st.actionsFor('peer-me'), { acct: 'acct-me', relation: 'me', canFriend: false, canInvite: false, whyNotFriend: 'that is you', whyNotInvite: 'that is you' });
});

test('SOC2: the words - last online in a row\'s units and every note code has a sentence, "you" when it is me (mutants: a code with no words; "Mac was removed" said to Mac)', () => {
  const now = 1e12, min = 60_000, hour = 60 * min, day = 24 * hour;
  assert.equal(lastOnlineText(true, now - 5 * day, now), 'Online');
  assert.equal(lastOnlineText(false, null, now), 'Never online');
  assert.equal(lastOnlineText(false, now - 10_000, now), 'Last online just now');
  assert.equal(lastOnlineText(false, now - 5 * min, now), 'Last online 5 min ago');
  assert.equal(lastOnlineText(false, now - 3 * hour, now), 'Last online 3 h ago');
  assert.equal(lastOnlineText(false, now - 30 * hour, now), 'Last online yesterday');
  assert.equal(lastOnlineText(false, now - 5 * day, now), 'Last online 5 days ago');
  assert.equal(lastOnlineText(false, now - 21 * day, now), 'Last online 3 weeks ago');
  assert.equal(lastOnlineText(false, now - 400 * day, now), 'Last online long ago');
  assert.equal(lastOnlineText(false, now + 5000, now), 'Last online just now', 'a stamp ahead of this clock is now, never negative');
  for (const code of NOTE_CODES) assert.ok(noteText({ code, acct: 'acct-b', name: 'b' }).length > 0, `${code} has words`);
  assert.equal(noteText({ code: 'party.leader', acct: 'acct-me', name: 'Mac' }, 'acct-me'), 'You lead the party now');
  assert.equal(noteText({ code: 'party.leader', acct: 'acct-b', name: 'b' }, 'acct-me'), 'b leads the party now');
  assert.equal(noteText({ code: 'party.kicked', acct: 'acct-b', name: 'b' }, 'acct-me'), 'b was removed from the party');
  assert.equal(noteText({ code: 'friend.requested', acct: 'acct-b', name: null }), 'Someone wants to be your friend');
  assert.equal(noteText({ code: 'nope' }), '');
  assert.deepEqual(PARTY_GREEN, [0.45, 1, 0.45, 1]); assert.match(PARTY_GREEN_CSS, /^#[0-9a-f]{6}$/); assert.match(FRIEND_CSS, /^#[0-9a-f]{6}$/);
});
