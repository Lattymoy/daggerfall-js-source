// PARTY-TRAVEL (2026-09-25, Mac: "Implementing a prompt for online to travel to party leader and the option for party
// members to ready up and travel together") - the party's journey, pinned by EXECUTION: the law on a table
// (systems/partyTravelLaw.js), the session (systems/partyTravel.js) RUN as a leader and a member whose poses cross
// through the wire's own law (net/wire.js validPartyPose) with fakes for everything that draws or moves, and the relay's
// real Room carrying the journey's fields between two seated accounts. The world.js seams only a browser can run - the
// headless fare, the beside landing, the map door, the chat's two commands - are pinned by source at the foot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PARTY_READY_TIMEOUT_MS, STAMP_SLACK_MS, memberPresent } from '../src/systems/partyRestLaw.js';
import {
  TRIP_CAUTIOUS, TRIP_INN, TRIP_SHIP, tripBits, tripOptionsOf, tripRoundOf, tripAnswerOf, tripTally, tripSetsOut, tripCountText,
  TRIP_FOLLOW_MS, PARTY_TRAVEL_TEXT, leaderTripOf, besideTargetOf, besideLandingOf, BESIDE_STEP, BESIDE_LEVEL, BESIDE_OFFSETS,
  leaderJourneyed, fareText, leaderOfferRows, tripAskRows,
} from '../src/systems/partyTravelLaw.js';
import { createPartyTravel, PARTY_TRIP_TICK_MS, PARTY_TRIP_GO_MS, LEADER_MAP_QUIET_MS } from '../src/systems/partyTravel.js';
import {
  validPartyPose, validPartyFrame, parseClient, RELAY_VERSION, relaySupportsPartyTravel, PARTY_TRAVEL_RELAY_MIN, SOCIAL_ROOM,
  MAP_PIXELS_X, MAP_PIXELS_Y, PIXEL_UNITS, POSE_Y_BOUND,
} from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { HOST_COMMANDS, HELP_LINES, parseChatLine } from '../src/net/chatCommands.js';
import { TravelPopUpWindow } from '../src/ui/travelPopUp.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const quiet = async (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return await fn(); } finally { console.info = info; console.warn = warn; } };
const NOW = 1_758_000_000_000;
const P = Object.freeze({ px: 100, py: 200, in: 0, loc: 'Daggerfall', h: 50, hm: 60, f: 50, fm: 60, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 1 });
/** A leader's feet inside pixel (x, y) - MapsFile's X and Z, a height in metres. */
const feetIn = (x, y, dx = 1000, dz = 2000, wy = 12.5) => ({ wx: x * PIXEL_UNITS + dx, wy, wz: (499 - y) * PIXEL_UNITS + dz });
const PLACES = { '100,200': 'Daggerfall', '300,150': 'Wayrest', '301,150': 'Wayrest Outskirts', '420,90': 'Castle Sentinel' };

// ─── THE LAW, ON A TABLE ────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-TRAVEL law: the popup\'s three toggles ride the wire as one small number, and back', () => {
  assert.equal(tripBits({ speedCautious: true, sleepModeInn: true, travelShip: true }), TRIP_CAUTIOUS | TRIP_INN | TRIP_SHIP);
  assert.equal(tripBits({ speedCautious: false, sleepModeInn: true, travelShip: false }), TRIP_INN);
  assert.equal(tripBits(null), 0);
  for (let b = 0; b <= 7; b++) assert.equal(tripBits(tripOptionsOf(b)), b, `bits ${b} round-trip`);
  assert.deepEqual(tripOptionsOf(TRIP_SHIP), { speedCautious: false, sleepModeInn: false, travelShip: true });
  assert.deepEqual(tripOptionsOf('7'), { speedCautious: false, sleepModeInn: false, travelShip: false }, 'anything but an integer sets nothing');
});

test('PARTY-TRAVEL law: a round is its stamp, read against the shared clock - open while fresh (PARTY_READY_TIMEOUT_MS), set out for TRIP_FOLLOW_MS, a stamp from beyond the slack is none, a `go` before its own `at` no departure', () => {
  const tv = (at, go = null) => ({ tv: { x: 300, y: 150, o: TRIP_INN, at, go } });
  assert.deepEqual(tripRoundOf(tv(NOW - 1000), NOW), { x: 300, y: 150, o: TRIP_INN, at: NOW - 1000, go: null });
  assert.equal(tripRoundOf(tv(NOW - PARTY_READY_TIMEOUT_MS), NOW)?.at, NOW - PARTY_READY_TIMEOUT_MS, 'the last fresh millisecond stands');
  assert.equal(tripRoundOf(tv(NOW - PARTY_READY_TIMEOUT_MS - 1), NOW), null, 'unanswered past the timeout: lapsed');
  assert.equal(tripRoundOf(tv(NOW + STAMP_SLACK_MS + 1), NOW), null, 'a round stamped from the future is no round - one client cannot hold a party in it for ever');
  assert.equal(tripRoundOf(tv(1e300), NOW), null);
  assert.equal(tripRoundOf(tv(NOW - 90_000, NOW - 10_000), NOW)?.go, NOW - 10_000, 'set out: it stands past the ready timeout, for the followers');
  assert.equal(tripRoundOf(tv(NOW - 90_000, NOW - TRIP_FOLLOW_MS - 1), NOW), null, '...until TRIP_FOLLOW_MS after it set out');
  assert.equal(tripRoundOf(tv(NOW - 1000, NOW - 5000), NOW)?.go, null, 'a go before its own at is no departure');
  assert.equal(tripRoundOf(tv(NOW - 1000, 1e300), NOW)?.go, null, 'nor is a go from the future');
  for (const p of [null, {}, { tv: null }, { tv: 'soon' }, { tv: { x: 1, y: 1, o: 0, at: null } }]) assert.equal(tripRoundOf(p, NOW), null);
});

test('PARTY-TRAVEL law: a vote names its round - the tally counts `tr`/`td` only for THIS round, leaves an offline seat out, and the party sets out when nobody gathered is still waiting', () => {
  const at = NOW - 5000;
  assert.equal(tripAnswerOf({ tr: at }, at), 'ready');
  assert.equal(tripAnswerOf({ td: at }, at), 'declined');
  assert.equal(tripAnswerOf({ tr: at - 60_000 }, at), 'waiting', 'a yes to the LAST round approves nothing (PARTY-REST9\'s class, closed by identity)');
  assert.equal(tripAnswerOf({ tr: at }, 0), 'waiting');
  assert.equal(tripAnswerOf(null, at), 'waiting');
  const seat = (name, p, online = true) => ({ acct: `acct-${name}`, name, online, p: p ? { ...P, ...p } : null });
  const gathered = [seat('Bran', { tr: at }), seat('Cyr', { td: at }), seat('Dala', { tr: at - 1 }), seat('Eld', { tr: at }, false), seat('Fen', null)];
  const tally = tripTally(gathered, at);
  assert.deepEqual(tally, { ready: ['Bran'], declined: ['Cyr'], waiting: ['Dala'] }, 'Eld\'s seat is offline and Fen has no pose: nobody here');
  assert.equal(tripSetsOut(tally), false, 'Dala is still asked');
  assert.equal(tripCountText(tally), '2/3 ready', 'the leader and Bran, of the leader, Bran and Dala - Cyr stays behind');
  const done = tripTally([seat('Bran', { tr: at }), seat('Cyr', { td: at })], at);
  assert.equal(tripSetsOut(done), true);
  assert.equal(tripCountText(done), '2/2 ready');
  assert.equal(tripSetsOut(tripTally([], at)), true, 'nobody gathered: the leader goes alone');
  assert.equal(tripSetsOut(null), false);
  assert.deepEqual(tripTally([seat('', { tr: at })], at).ready, ['A party member']);
});

test('PARTY-TRAVEL law: where the journey to the leader goes, or why not - no party, leading, the leader offline or unseen, me indoors, already there; a leader in a dungeon or a building is travelled to at its door', () => {
  const party = { leader: 'acct-Ann' };
  const leader = (p, online = true) => ({ acct: 'acct-Ann', name: 'Ann', online, p });
  const here = { x: 100, y: 200 };
  const base = { party, me: 'acct-Bran', leader: leader({ ...P, px: 300, py: 150, loc: 'Wayrest' }), outdoors: true, here };
  assert.deepEqual(leaderTripOf(base), { x: 300, y: 150, inside: null, loc: 'Wayrest', name: 'Ann', acct: 'acct-Ann' });
  assert.equal(leaderTripOf({ ...base, party: null }).refuse, PARTY_TRAVEL_TEXT.noParty);
  assert.equal(leaderTripOf({ ...base, me: 'acct-Ann' }).refuse, PARTY_TRAVEL_TEXT.leading);
  assert.equal(leaderTripOf({ ...base, leader: leader({ ...P }, false) }).refuse, PARTY_TRAVEL_TEXT.offline, 'the hub\'s online: false outranks the pose it carried over');
  assert.equal(leaderTripOf({ ...base, leader: null }).refuse, PARTY_TRAVEL_TEXT.offline);
  assert.equal(leaderTripOf({ ...base, leader: leader(null) }).refuse, PARTY_TRAVEL_TEXT.unseen);
  assert.equal(leaderTripOf({ ...base, outdoors: false }).refuse, PARTY_TRAVEL_TEXT.inside, 'fast travel is the map\'s, and the map opens outdoors only');
  assert.equal(leaderTripOf({ ...base, here: { x: 300, y: 150 } }).refuse, PARTY_TRAVEL_TEXT.here);
  assert.equal(leaderTripOf({ ...base, leader: leader({ ...P, px: 100, py: 200, in: 2 }) }).refuse, PARTY_TRAVEL_TEXT.here, 'a leader in a shop of my own town is here');
  assert.equal(leaderTripOf({ ...base, leader: leader({ ...P, px: 420, py: 90, in: 1, loc: 'Castle Sentinel' }) }).inside, 'dungeon');
  assert.equal(leaderTripOf({ ...base, leader: leader({ ...P, px: 420, py: 90, in: 2 }) }).inside, 'building');
});

test('PARTY-TRAVEL law: the leader\'s feet are a landing only in the open air of the pixel the journey paid for - a pose that puts them elsewhere, or indoors, or says two things at once, lands at the place\'s door', () => {
  const f = feetIn(300, 150);
  const open = { ...P, px: 300, py: 150, in: 0, ...f };
  assert.deepEqual(besideTargetOf(open, 300, 150), { x: f.wx, y: f.wy, z: f.wz });
  assert.equal(besideTargetOf({ ...open, in: 1 }, 300, 150), null, 'in a dungeon: the door');
  assert.equal(besideTargetOf({ ...open, in: 2 }, 300, 150), null, 'in a building: the door');
  assert.equal(besideTargetOf(open, 301, 150), null, 'the pose names another pixel than the journey');
  assert.equal(besideTargetOf({ ...open, ...feetIn(301, 150) }, 300, 150), null, 'feet outside the pixel the pose names: it contradicts itself');
  assert.equal(besideTargetOf({ ...open, wy: undefined }, 300, 150), null, 'all three or none');
  assert.equal(besideTargetOf(null, 300, 150), null);
});

test('PARTY-TRAVEL law: the spot beside the leader - a side clear of walls on the leader\'s own floor, facing them; else the leader\'s own spot; none when even that is another level', () => {
  const at = [10, 5, 20];
  const flat = (y = 5) => (pos) => [pos[0], y, pos[2]];
  const probe = (clear, floor = flat()) => ({ clear, floor });
  const all = besideLandingOf(at, probe(() => true));
  assert.deepEqual(all.pos, [10 + BESIDE_STEP, 5, 20], 'east first');
  assert.ok(Math.abs(all.yaw - Math.atan2(-BESIDE_STEP, 0)) < 1e-12, 'facing the leader: west');
  const rays = [];
  const eastWalled = besideLandingOf(at, probe((from, dir, dist) => { rays.push({ dir, dist }); return dir[0] < 0.5; }));
  assert.deepEqual(eastWalled.pos, [10 - BESIDE_STEP, 5, 20], 'a wall to the east: the west side');
  assert.equal(rays[0].dist, BESIDE_STEP + 0.5, 'the way is asked a body\'s reach beyond the spot');
  assert.deepEqual(rays[0].dir, [1, 0, 0]);
  const ledge = besideLandingOf(at, probe(() => true, (pos) => [pos[0], pos[0] > 10 ? 5 + BESIDE_LEVEL + 0.01 : 5, pos[2]]));
  assert.deepEqual(ledge.pos, [10 - BESIDE_STEP, 5, 20], 'a floor more than a level from the leader\'s is not beside them');
  const boxed = besideLandingOf(at, probe(() => false));
  assert.deepEqual(boxed, { pos: [10, 5, 20], yaw: null }, 'walled in: the leader\'s own spot, on its floor');
  assert.equal(besideLandingOf([10, 30, 20], probe(() => true, flat(5))), null, 'a leader flying (or swimming) over a floor 25 m down: no spot beside them - the door');
  assert.equal(BESIDE_OFFSETS.length, 4);
});

test('PARTY-TRAVEL law: a journey moves the leader more than a pixel at a step; the prompts\' rows', () => {
  assert.equal(leaderJourneyed({ px: 100, py: 200 }, { px: 101, py: 201 }), false, 'walking crosses pixels one at a time');
  assert.equal(leaderJourneyed({ px: 100, py: 200 }, { px: 102, py: 200 }), true);
  assert.equal(leaderJourneyed(null, { px: 1, py: 1 }), false);
  assert.equal(fareText({ totalCost: 40.4 }), 'The journey costs 40 gold.');
  assert.equal(fareText({ totalCost: 0 }), 'The journey costs nothing.');
  assert.equal(fareText({ totalCost: 90 }, false), 'You cannot afford the journey (90 gold).');
  const trip = { name: 'Ann', inside: null, loc: 'Wayrest' };
  assert.deepEqual(leaderOfferRows(trip, 'Wayrest', 'The journey costs 40 gold.'), ['Travel to Ann at Wayrest?', 'The journey costs 40 gold.']);
  assert.deepEqual(leaderOfferRows({ ...trip, inside: 'dungeon', loc: 'Castle Sentinel' }, 'Castle Sentinel', 'x', true), ['Travel to Ann at Castle Sentinel?', 'Ann is inside Castle Sentinel - you will arrive at its door.', 'x', 'You are diseased or poisoned.']);
  assert.deepEqual(leaderOfferRows({ ...trip, inside: 'building' }, 'Wayrest', 'x'), ['Travel to Ann at Wayrest?', 'Ann is indoors - you will arrive outside.', 'x']);
  assert.deepEqual(tripAskRows('Ann', 'Wayrest', 'The journey costs 40 gold.'), ['Ann wants the party to travel to Wayrest.', 'The journey costs 40 gold.', 'Travel with the party?']);
  assert.deepEqual(tripAskRows('', '', 'x', true), ['The leader wants the party to travel to a new place.', 'x', 'You are diseased or poisoned.', 'Travel with the party?']);
});

// ─── THE WIRE ───────────────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-TRAVEL wire: the journey rides the party pose - `tv`, `tr`/`td`, `wx`/`wy`/`wz` - each OMITTED when absent or out of its law, never refusing the pose, so a pose without them keeps its bytes', () => {
  const plain = validPartyPose(P);
  for (const k of ['tv', 'tr', 'td', 'wx', 'wy', 'wz']) assert.equal(k in plain, false, `${k}: omitted, not null`);
  const f = feetIn(300, 150);
  const full = validPartyPose({ ...P, tv: { x: 300, y: 150, o: 7, at: NOW + 0.4, go: NOW + 999.6 }, tr: NOW - 10.4, td: NOW - 20, ...f, wy: 12.345 });
  assert.deepEqual(full.tv, { x: 300, y: 150, o: 7, at: NOW, go: NOW + 1000 }, 'the stamps rounded - a vote names its round by equality, so both ends round alike');
  assert.equal(full.tr, NOW - 10);
  assert.equal(full.td, NOW - 20);
  assert.deepEqual([full.wx, full.wy, full.wz], [f.wx, 12.35, f.wz], 'the height to the centimetre');
  assert.equal(validPartyPose({ ...P, tv: { x: 300, y: 150, o: 0, at: NOW } }).tv.go, null, 'an open round: go null');
  // out of its law, the FIELD goes and the pose stands
  for (const bad of [{ x: MAP_PIXELS_X, y: 1, o: 0, at: NOW }, { x: -1, y: 1, o: 0, at: NOW }, { x: 1.5, y: 1, o: 0, at: NOW }, { x: 1, y: MAP_PIXELS_Y, o: 0, at: NOW },
    { x: 1, y: 1, o: 8, at: NOW }, { x: 1, y: 1, o: -1, at: NOW }, { x: 1, y: 1, o: 0, at: -1 }, { x: 1, y: 1, o: 0, at: null }, [1, 2], 'tv']) {
    const p = validPartyPose({ ...P, tv: bad });
    assert.ok(p, `the pose stands under ${JSON.stringify(bad)}`);
    assert.equal('tv' in p, false, `a destination clamped into the map is some other place - ${JSON.stringify(bad)} goes`);
  }
  assert.equal('tr' in validPartyPose({ ...P, tr: -1 }), false);
  assert.equal('td' in validPartyPose({ ...P, td: 'soon' }), false);
  assert.equal('wx' in validPartyPose({ ...P, in: 1, ...f }), false, 'feet only in the open air');
  assert.equal('wx' in validPartyPose({ ...P, ...f, wz: undefined }), false, 'all three or none');
  assert.equal('wx' in validPartyPose({ ...P, ...f, wx: MAP_PIXELS_X * PIXEL_UNITS }), false, 'X inside the map');
  assert.equal('wx' in validPartyPose({ ...P, ...f, wz: -1 }), false, 'Z inside the map');
  assert.equal('wx' in validPartyPose({ ...P, ...f, wy: POSE_Y_BOUND + 1 }), false, 'the height within the pose\'s own bound');
});

test('PARTY-TRAVEL wire: the relay\'s door projects the fields through (validPartyPose in parseClient - an OLDER relay strips them, so this deploy is the relay\'s), the version moved, and a hub from before it opens no round', () => {
  const f = feetIn(300, 150);
  const m = parseClient(JSON.stringify({ t: 'party', p: { ...P, tv: { x: 300, y: 150, o: 2, at: NOW, go: null }, tr: NOW - 5, ...f } }), { hasHello: true });
  assert.equal(m.t, 'party');
  assert.deepEqual(m.p.tv, { x: 300, y: 150, o: 2, at: NOW, go: null });
  assert.equal(m.p.tr, NOW - 5);
  assert.equal(m.p.wx, f.wx);
  assert.equal(RELAY_VERSION, 'world110', 'PARTY-TRAVEL: the party pose\'s journey fields');
  assert.equal(PARTY_TRAVEL_RELAY_MIN, 110);
  assert.equal(relaySupportsPartyTravel('world110'), true);
  assert.equal(relaySupportsPartyTravel('world111'), true);
  assert.equal(relaySupportsPartyTravel('world109'), false, 'the live relay before this deploy strips the round - no leader waits on answers that cannot come');
  for (const v of [null, '', 'world', 'World110', 110]) assert.equal(relaySupportsPartyTravel(v), false);
  // the hub link reads it off its welcome
  const link = (v) => {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => 1e6, presence: false, acct: 'acct-me', asecret: 'secret-of-acct-me' });
    s.join(SOCIAL_ROOM, null);
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v });
    return s.partyTravelOk;
  };
  assert.equal(link('world110'), true);
  assert.equal(link('world109'), false);
});

test('PARTY-TRAVEL relay: the real Room fans a member\'s journey fields to the party - the leader\'s round and feet reach the member, the member\'s answer reaches the leader - and the widest hub attachment still fits the runtime\'s 2 KiB', () => quiet(async () => {
  const r = fakeRoom(SOCIAL_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try {
    const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n.padEnd(20, n), acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); clock += 10; return ws; };
    const act = (ws, o) => r.raw(ws, JSON.stringify({ t: 'social', ...o }));
    const a = await join('a'), b = await join('b');
    await act(a, { k: 'party.invite', peer: 'peer-b' }); clock += 600;
    await act(b, { k: 'party.accept', party: a.att.party }); clock += 600;
    const f = feetIn(999, 0, PIXEL_UNITS - 1, PIXEL_UNITS - 1, -(POSE_Y_BOUND - 0.5));
    const widest = { ...P, loc: 'L'.repeat(32), px: 999, py: 499, h: 9999, hm: 9999, f: 9999, fm: 9999, m: 9999, mm: 9999,
      tv: { x: 999, y: 499, o: 7, at: 9_999_999_999_999, go: 9_999_999_999_999 }, tr: 9_999_999_999_999, td: 9_999_999_999_999, ...f };
    await r.raw(a, JSON.stringify({ t: 'party', p: widest })); clock += 600;
    const heard = b.sent.filter((m) => m.t === 'party').at(-1);
    const frame = validPartyFrame(heard);
    assert.ok(frame, 'the member reads it through the client\'s own door');
    assert.deepEqual(frame.p.tv, widest.tv);
    assert.deepEqual([frame.p.tr, frame.p.td, frame.p.wx, frame.p.wz], [widest.tr, widest.td, f.wx, f.wz]);
    assert.equal(a.closed, null, 'never a failed attachment write');
    const bytes = JSON.stringify(a.att).length;
    assert.ok(bytes <= 2048, `the widest hub attachment is ${bytes} bytes`);
    await r.raw(b, JSON.stringify({ t: 'party', p: { ...P, tr: 4242 } })); clock += 600;
    assert.equal(a.sent.filter((m) => m.t === 'party').at(-1)?.p?.tr, 4242, 'and the answer comes back');
  } finally { Date.now = realNow; }
}));

// ─── THE SESSION, RUN ───────────────────────────────────────────────────────────────────────────────────────────

/** A party of sessions over fakes: each client's pose is its base, the session's share and (leading) its feet,
 *  through the wire's own law into every other client's picture - the hub's fan, minus the socket. */
function partyOf(names = ['Ann', 'Bran'], leaderName = names[0]) {
  const clock = { shared: NOW, mono: 1e6 };
  const clients = new Map();
  const byAcct = (acct) => [...clients.values()].find((c) => c.acct === acct);
  for (const name of names) {
    const c = { name, acct: `acct-${name}`, pose: { ...P }, feet: null, near: true, online: true, lines: [], mids: [], prompts: [], travels: [], opened: 0,
      busy: false, alive: true, outdoors: true, refusal: null, afford: true, travelGoes: true, at: { x: 0, z: 0 }, relayOk: true, moving: false, dirty: 0, sendFails: false };
    c.social = { acct: c.acct, party: null, leads() { return this.party?.leader === this.acct; }, now: () => clock.shared };
    c.host = {
      social: () => c.social,
      gathered: () => (c.near ? c.social.party.members.filter((m) => m.acct !== c.acct && memberPresent(m) && byAcct(m.acct).near) : []),
      nearLeader: (row) => c.near && byAcct(row.acct).near,
      here: () => ({ x: c.pose.px, y: c.pose.py }),
      outdoors: () => c.outdoors, alive: () => c.alive, busy: () => c.busy, moving: () => c.moving,
      refusal: () => c.refusal,
      fare: (to, opts) => ({ opts: { ...opts }, computed: { totalCost: 40, piecesCost: 25, minutes: 600 }, afford: c.afford, unwell: false }),
      canAfford: () => c.afford,
      myToggles: () => ({ speedCautious: true, sleepModeInn: true, travelShip: false }),
      feet: () => c.at, radius: 15,
      placeName: (to, fb) => PLACES[`${to.x},${to.y}`] || fb || 'the wilderness',
      prompt: (rows, onYes, onNo) => { const h = { rows, onYes, onNo, closed: false }; c.prompts.push(h); return h; },
      closePrompt: (h) => { h.closed = true; },
      say: (t) => c.lines.push(t), mid: (t) => c.mids.push(t),
      travel: (pick, opts, computed) => { c.travels.push({ pick, opts, computed }); return Promise.resolve(c.travelGoes); },
      openMap: () => { c.opened++; },
      clock: () => clock.mono,
      relayOk: () => c.relayOk,
      poseDirty: () => { c.dirty++; },
    };
    c.pt = createPartyTravel(c.host);
    clients.set(name, c);
  }
  const seats = () => names.map((n) => ({ acct: `acct-${n}`, name: n, online: true, seen: NOW, peers: [`peer-${n}`], p: null }));
  for (const c of clients.values()) c.social.party = { id: 'q1', leader: `acct-${leaderName}`, members: seats() };
  const exchange = () => {
    for (const c of clients.values()) {
      const p = validPartyPose({ ...c.pose, ...c.pt.poseFields(), ...(c.feet ?? {}) });
      if (!c.sendFails) c.pt.sent(p);   // the host's own order: a pose that left for the hub
      for (const o of clients.values()) if (o !== c) { const seat = o.social.party?.members.find((x) => x.acct === c.acct); if (seat) { seat.p = c.online ? p : null; seat.online = c.online; } }
    }
  };
  const step = (ms = PARTY_TRIP_TICK_MS) => { clock.mono += ms; clock.shared += ms; exchange(); for (const c of clients.values()) c.pt.tick(); };
  return { clock, c: (n) => clients.get(n), exchange, step };
}
const PICK = Object.freeze({ pixel: Object.freeze({ x: 300, y: 150 }), name: 'Wayrest' });
const OPTS = Object.freeze({ speedCautious: false, sleepModeInn: true, travelShip: false });
const FARE = Object.freeze({ totalCost: 12, piecesCost: 12, minutes: 100 });
const flush = () => new Promise((r) => setImmediate(r));

test('PARTY-TRAVEL session: TOGETHER - the leader\'s Begin with a member gathered is a proposal on the leader\'s pose; the member is asked with their fare; a yes rides back; the leader sees who is ready and the party sets out; the leader travels once the "we set out" pose has left; the member follows and, once the leader stands in the destination\'s open air, lands beside them', async () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step();
  assert.equal(ann.pt.propose(PICK, OPTS, FARE), true, 'a round, not a departure');
  assert.equal(ann.travels.length, 0, 'nobody travels yet - the fare is taken when the party sets out');
  assert.equal(ann.lines.at(-1), 'You ask the party to travel to Wayrest. (1/2 ready)');
  assert.equal(ann.mids.at(-1), 'Waiting for the party to ready up (1/2 ready).');
  const tv = ann.pt.poseFields().tv;
  assert.deepEqual({ x: tv.x, y: tv.y, o: tv.o, go: tv.go }, { x: 300, y: 150, o: TRIP_INN, go: null }, 'the destination and the leader\'s toggles, on the leader\'s own pose');
  assert.equal(tv.at, NOW + PARTY_TRIP_TICK_MS, 'stamped on the shared clock');
  assert.equal(bran.pt.poseFields().tv, undefined, 'a member proposes nothing');
  w.step();
  assert.equal(bran.prompts.length, 1, 'the gathered member is asked');
  assert.deepEqual(bran.prompts[0].rows, ['Ann wants the party to travel to Wayrest.', 'The journey costs 40 gold.', 'Travel with the party?'], 'with THEIR fare');
  w.step();
  assert.equal(bran.prompts.length, 1, 'once per round');
  bran.prompts[0].onYes();
  assert.equal(bran.lines.at(-1), 'You are ready to travel to Wayrest.');
  assert.equal(bran.pt.poseFields().tr, tv.at, 'the yes names the round');
  w.step();
  assert.ok(ann.lines.includes('Bran is ready to travel. (2/2 ready)'), 'the leader sees who is ready');
  assert.equal(ann.lines.at(-1), 'The party sets out for Wayrest.');
  assert.ok(ann.pt.state.trip.go >= tv.at);
  assert.equal(ann.travels.length, 0, 'not before the pose that says so has left');
  w.step();
  assert.equal(ann.travels.length, 1, 'the leader\'s own journey, as the popup began it');
  assert.equal(ann.travels[0].pick, PICK);
  assert.equal(ann.travels[0].opts, OPTS);
  assert.equal(ann.travels[0].computed, FARE);
  assert.equal(bran.lines.at(-1), 'The party sets out for Wayrest - you follow Ann.');
  assert.equal(bran.pt.poseFields().tr, undefined, 'the vote is spent');
  assert.equal(bran.travels.length, 0, 'the follower waits for the leader to arrive');
  w.step();
  assert.equal(bran.travels.length, 0, 'the leader still loading: their pose is where it was');
  // the leader arrives: the destination pixel, their feet in its open air
  ann.pose = { ...ann.pose, px: 300, py: 150, loc: 'Wayrest' }; ann.feet = feetIn(300, 150);
  w.step();
  assert.equal(bran.travels.length, 1, 'the member travels');
  const j = bran.travels[0];
  assert.deepEqual(j.pick.pixel, { x: 300, y: 150 });
  assert.equal(j.pick.name, 'Wayrest');
  assert.deepEqual(j.opts, { speedCautious: false, sleepModeInn: true, travelShip: false }, 'priced with the LEADER\'s toggles');
  assert.deepEqual(j.pick.besideAt(), { x: ann.feet.wx, y: ann.feet.wy, z: ann.feet.wz }, 'beside the leader, read when the pixel has built');
  ann.feet = feetIn(300, 150, 1500, 2500);
  w.exchange();
  assert.deepEqual(j.pick.besideAt(), { x: ann.feet.wx, y: ann.feet.wy, z: ann.feet.wz }, 'the leader walked on while it built: where they are NOW');
  assert.equal(j.pick.besideText, 'You join Ann at Wayrest.');
  assert.equal(bran.prompts.length, 1, 'the leader\'s arrival where I am already bound is offered to nobody (the host\'s journey is still loading)');
  w.step(TRIP_FOLLOW_MS + 1);
  assert.equal(ann.pt.state.trip, null, 'the round leaves the leader\'s pose TRIP_FOLLOW_MS after it set out');
});

test('PARTY-TRAVEL session: a vote names its round - a yes that names an older round (a crafted pose, a tab that slept) never sets the party out, and a round called off takes the member\'s vote and box with it', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step();
  ann.pt.propose(PICK, OPTS, FARE);
  const first = ann.pt.poseFields().tv.at;
  w.step();
  bran.prompts[0].onYes();
  assert.equal(ann.pt.command('travel'), 'You call off the journey.', 'the leader calls it off');
  w.step();
  assert.equal(bran.lines.at(-1), PARTY_TRAVEL_TEXT.called);
  assert.equal(bran.pt.state.vote, null, 'the vote went with its round');
  w.step(1000);
  ann.pt.propose(PICK, OPTS, FARE);
  bran.pose = { ...bran.pose, tr: first };   // an old yes, said again
  bran.busy = true;   // and no box to answer
  for (let i = 0; i < 8; i++) w.step();
  assert.equal(ann.pt.state.trip.go, null, 'the old yes approves nothing');
  assert.equal(bran.lines.filter((l) => l === 'Ann wants the party to travel to Wayrest. Type /travel to come along.').length, 1, 'busy: told once, in the chat');
  bran.busy = false;
  w.step();
  assert.equal(bran.prompts.length, 2, 'asked when free');
  ann.pt.command('travel');
  w.step();
  assert.equal(bran.prompts[1].closed, true, 'a round that ended takes its own box down');
  assert.equal(bran.lines.at(-1), PARTY_TRAVEL_TEXT.called);
  // a round REPLACED in one breath: the yes to the first is dropped on the member's own side too
  delete bran.pose.tr;
  w.step(1000);
  ann.pt.propose(PICK, OPTS, FARE);
  w.step();
  bran.prompts.at(-1).onYes();
  const yes = bran.pt.poseFields().tr;
  assert.ok(yes > 0);
  w.step(1000);
  ann.pt.propose({ pixel: { x: 420, y: 90 }, name: 'Castle Sentinel' }, OPTS, FARE);
  w.step();
  assert.equal(bran.pt.poseFields().tr, undefined, 'my pose stops carrying a yes to a round that is gone');
  assert.deepEqual(bran.prompts.at(-1).rows[0], 'Ann wants the party to travel to Castle Sentinel.', 'asked afresh');
});

test('PARTY-TRAVEL session: a member who is not gathered is not asked and is not counted', () => {
  const w = partyOf(['Ann', 'Bran', 'Cyr']);
  w.c('Cyr').near = false;
  w.step();
  w.c('Ann').pt.propose(PICK, OPTS, FARE);
  assert.equal(w.c('Ann').lines.at(-1), 'You ask the party to travel to Wayrest. (1/2 ready)', 'Cyr is elsewhere');
  w.step(); w.step();
  assert.equal(w.c('Cyr').prompts.length, 0);
  assert.equal(w.c('Bran').prompts.length, 1);
});

test('PARTY-TRAVEL session: the leader\'s setting out - it waits while a window of theirs is up, it is refused when they can no longer pay, a pose that never leaves holds it PARTY_TRIP_GO_MS and no longer, and a round that has set out is not called off', () => {
  const busy = partyOf();
  busy.step();
  busy.c('Ann').pt.propose(PICK, OPTS, FARE);
  busy.step();
  busy.c('Bran').prompts[0].onYes();
  busy.c('Ann').busy = true;
  busy.step(); busy.step();
  assert.equal(busy.c('Ann').pt.state.trip.go, null, 'everyone ready, and the leader in a window: not yet');
  busy.c('Ann').busy = false;
  busy.step();
  assert.ok(busy.c('Ann').pt.state.trip.go > 0, 'the window closed: the party sets out');
  const poor = partyOf();
  poor.step();
  poor.c('Ann').pt.propose(PICK, OPTS, FARE);
  poor.step();
  poor.c('Bran').prompts[0].onYes();
  poor.c('Ann').afford = false;
  poor.step();
  assert.equal(poor.c('Ann').lines.at(-1), `You cannot afford the journey (12 gold). ${PARTY_TRAVEL_TEXT.off}`, 'the gold spent while the party gathered');
  assert.equal(poor.c('Ann').pt.state.trip, null);
  const mute = partyOf();
  mute.step();
  mute.c('Ann').pt.propose(PICK, OPTS, FARE);
  mute.step();
  mute.c('Bran').prompts[0].onYes();
  mute.c('Ann').sendFails = true;   // the hub link will not take the pose
  mute.step();
  assert.ok(mute.c('Ann').pt.state.trip.go > 0);
  assert.equal(mute.c('Ann').pt.command('travel'), 'Choose a destination on the travel map - the party gathered with you is asked to come along.', 'set out: not called off');
  mute.step();
  assert.equal(mute.c('Ann').travels.length, 0, 'waiting for the pose that says so to leave');
  mute.step(PARTY_TRIP_GO_MS);
  assert.equal(mute.c('Ann').travels.length, 1, 'and no longer than PARTY_TRIP_GO_MS');
});

test('PARTY-TRAVEL session: a member who says No, or whose Yes the map door or the gold refuses, STAYS BEHIND - the leader is told and is never held; with nobody coming the leader goes alone, and the place they stayed behind from is not offered to them after', async () => {
  const w = partyOf(['Ann', 'Bran', 'Cyr']);
  const ann = w.c('Ann'), bran = w.c('Bran'), cyr = w.c('Cyr');
  w.step();
  ann.pt.propose(PICK, OPTS, FARE);
  cyr.refusal = 'You cannot travel with enemies nearby.';
  w.step();
  bran.prompts[0].onNo();
  cyr.prompts[0].onYes();
  assert.equal(bran.lines.at(-1), PARTY_TRAVEL_TEXT.stay);
  assert.equal(cyr.lines.at(-1), `You cannot travel with enemies nearby. ${PARTY_TRAVEL_TEXT.stay}`, 'a refused yes stays behind, with its reason');
  assert.equal(cyr.pt.poseFields().td, ann.pt.poseFields().tv.at);
  w.step();
  assert.ok(ann.lines.includes('Bran stays behind.') && ann.lines.includes('Cyr stays behind.'));
  assert.equal(ann.lines.at(-1), 'Nobody else is coming - you set out for Wayrest alone.');
  w.step();
  assert.equal(ann.travels.length, 1);
  await flush();
  ann.pose = { ...ann.pose, px: 300, py: 150 }; ann.feet = feetIn(300, 150);
  w.step();
  assert.equal(bran.travels.length + cyr.travels.length, 0, 'nobody follows who did not say yes');
  assert.equal(bran.prompts.length, 1, 'the leader\'s arrival where Bran chose not to go is not offered to him');
  // a refused yes by the gold alone
  const w2 = partyOf();
  w2.step();
  w2.c('Ann').pt.propose(PICK, OPTS, FARE);
  w2.c('Bran').afford = false;
  w2.step();
  w2.c('Bran').prompts[0].onYes();
  assert.equal(w2.c('Bran').lines.at(-1), `You cannot afford the journey (40 gold). ${PARTY_TRAVEL_TEXT.stay}`);
});

test('PARTY-TRAVEL session: the round is off when the leader walks out of where they asked, goes inside, or nobody answers in time - the member\'s box comes down with it', () => {
  const walked = partyOf();
  walked.step();
  walked.c('Ann').pt.propose(PICK, OPTS, FARE);
  walked.step();
  walked.c('Ann').at = { x: 15.1, z: 0 };
  walked.step();
  assert.equal(walked.c('Ann').lines.at(-1), PARTY_TRAVEL_TEXT.moved, 'PARTY-REST16\'s radius');
  walked.step();
  assert.equal(walked.c('Bran').prompts[0].closed, true);
  const inside = partyOf();
  inside.step();
  inside.c('Ann').pt.propose(PICK, OPTS, FARE);
  inside.c('Ann').outdoors = false;
  inside.step();
  assert.equal(inside.c('Ann').lines.at(-1), PARTY_TRAVEL_TEXT.off);
  const late = partyOf();
  late.step();
  late.c('Ann').pt.propose(PICK, OPTS, FARE);
  late.step(PARTY_READY_TIMEOUT_MS - 2 * PARTY_TRIP_TICK_MS);
  assert.equal(late.c('Ann').pt.state.trip?.go, null, 'still open inside the timeout');
  late.step(3 * PARTY_TRIP_TICK_MS);
  assert.equal(late.c('Ann').lines.at(-1), PARTY_TRAVEL_TEXT.late);
  assert.equal(late.c('Ann').pt.state.trip, null);
});

test('PARTY-TRAVEL session: the map\'s own journey goes ahead, alone, when there is no round to open - a member\'s Begin, a hub from before the version, nobody gathered, a trip to where the leader stands', () => {
  const w = partyOf();
  w.step();
  assert.equal(w.c('Bran').pt.propose(PICK, OPTS, FARE), false, 'only the leader proposes');
  w.c('Ann').relayOk = false;
  assert.equal(w.c('Ann').pt.propose(PICK, OPTS, FARE), false, 'an older hub would strip the round');
  w.c('Ann').relayOk = true;
  assert.equal(w.c('Ann').pt.propose(PICK, { ...OPTS, playerControlled: true }, FARE), false, 'a walked trip is Travel Options\' own - the party rides it on its own feet');
  assert.equal(w.c('Ann').pt.propose({ pixel: { x: 100, y: 200 }, name: 'Daggerfall' }, OPTS, FARE), false, 'to where I stand');
  w.c('Bran').near = false;
  assert.equal(w.c('Ann').pt.propose(PICK, OPTS, FARE), false, 'nobody gathered');
  w.c('Bran').near = true;
  w.c('Bran').online = false;
  w.exchange();
  assert.equal(w.c('Ann').pt.propose(PICK, OPTS, FARE), false, 'an offline seat gathers nowhere');
  assert.equal(w.c('Ann').pt.state.trip, null);
});

test('PARTY-TRAVEL session: a member who said yes and walked away before the party set out does not follow; a leader whose journey never left takes the round with them and nobody follows; a follower whose leader went quiet mid-journey goes to the place after TRIP_FOLLOW_MS', async () => {
  const away = partyOf();
  away.step();
  away.c('Ann').pt.propose(PICK, OPTS, FARE);
  away.step();
  away.c('Bran').prompts[0].onYes();
  away.c('Bran').near = false;
  away.step(); away.step(); away.step();
  assert.equal(away.c('Bran').lines.at(-1), PARTY_TRAVEL_TEXT.lost);
  assert.equal(away.c('Bran').pt.state.follow, null);
  const stuck = partyOf();
  stuck.step();
  stuck.c('Ann').travelGoes = false;
  stuck.c('Ann').pt.propose(PICK, OPTS, FARE);
  stuck.step();
  stuck.c('Bran').prompts[0].onYes();
  stuck.step(); stuck.step();
  assert.ok(stuck.c('Bran').pt.state.follow, 'following');
  await flush();
  assert.equal(stuck.c('Ann').pt.state.trip, null, 'the journey that never left took its round');
  assert.equal(stuck.c('Ann').lines.at(-1), PARTY_TRAVEL_TEXT.off);
  stuck.step();
  assert.equal(stuck.c('Bran').lines.at(-1), `Ann did not set out. ${PARTY_TRAVEL_TEXT.off}`);
  assert.equal(stuck.c('Bran').travels.length, 0);
  const quietLeader = partyOf();
  quietLeader.step();
  quietLeader.c('Ann').pt.propose(PICK, OPTS, FARE);
  quietLeader.step();
  quietLeader.c('Bran').prompts[0].onYes();
  quietLeader.step(); quietLeader.step();
  quietLeader.c('Ann').online = false;
  quietLeader.step(TRIP_FOLLOW_MS - PARTY_TRIP_TICK_MS);
  assert.equal(quietLeader.c('Bran').travels.length, 0, 'waiting for the leader');
  quietLeader.step(PARTY_TRIP_TICK_MS);
  assert.equal(quietLeader.c('Bran').travels.length, 1, 'to the place anyway');
  assert.equal(quietLeader.c('Bran').travels[0].pick.besideAt(), null, 'with no leader to stand beside: the place\'s own door');
  const window = partyOf();
  window.step();
  window.c('Ann').pt.propose(PICK, OPTS, FARE);
  window.step();
  window.c('Bran').prompts[0].onYes();
  window.step(); window.step();
  assert.ok(window.c('Bran').pt.state.follow);
  window.c('Ann').pose = { ...window.c('Ann').pose, px: 300, py: 150 }; window.c('Ann').feet = feetIn(300, 150);   // she arrived
  window.c('Bran').busy = true;
  window.step(); window.step();
  assert.equal(window.c('Bran').travels.length, 0, 'the leader has arrived, and a window of mine is up: never from under it');
  window.step(2 * TRIP_FOLLOW_MS - 3 * PARTY_TRIP_TICK_MS);
  assert.ok(window.c('Bran').pt.state.follow, 'still following while the window stands');
  window.step(PARTY_TRIP_TICK_MS);
  assert.equal(window.c('Bran').pt.state.follow, null, 'twice TRIP_FOLLOW_MS under a window: left behind');
  assert.equal(window.c('Bran').lines.at(-1), 'The party went on without you. Type /leader to travel to Ann.');
  assert.equal(window.c('Bran').travels.length, 0);
});

test('PARTY-TRAVEL session: TO THE LEADER - a member elsewhere is offered the journey unasked when they first see the leader, once per place; Yes travels to where the leader is THEN, beside them in the open air, at the door of a dungeon they are in; a later journey of the leader\'s is offered again', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  ann.pose = { ...ann.pose, px: 300, py: 150, loc: 'Wayrest' }; ann.feet = feetIn(300, 150);
  w.step();
  assert.equal(bran.prompts.length, 1, 'the unasked offer');
  assert.deepEqual(bran.prompts[0].rows, ['Travel to Ann at Wayrest?', 'The journey costs 40 gold.']);
  w.step(); w.step();
  assert.equal(bran.prompts.length, 1, 'once per place');
  ann.pose = { ...ann.pose, px: 301 };
  ann.feet = feetIn(301, 150);
  w.exchange();
  bran.prompts[0].onYes();
  assert.equal(bran.travels.length, 1);
  assert.deepEqual(bran.travels[0].pick.pixel, { x: 301, y: 150 }, 'to where the leader is NOW');
  assert.deepEqual(bran.travels[0].opts, { speedCautious: true, sleepModeInn: true, travelShip: false }, 'my own way of travelling');
  assert.deepEqual(bran.travels[0].pick.besideAt(), { x: ann.feet.wx, y: ann.feet.wy, z: ann.feet.wz });
  assert.equal(bran.travels[0].pick.besideText, 'You join Ann at Wayrest Outskirts.');
  // the leader journeys on - into a dungeon
  ann.pose = { ...ann.pose, px: 420, py: 90, in: 1, loc: 'Castle Sentinel' }; ann.feet = null;
  w.step();
  assert.equal(bran.prompts.length, 2, 'a journey of the leader\'s is offered again');
  assert.deepEqual(bran.prompts[1].rows, ['Travel to Ann at Castle Sentinel?', 'Ann is inside Castle Sentinel - you will arrive at its door.', 'The journey costs 40 gold.']);
  bran.prompts[1].onYes();
  assert.equal(bran.travels[1].pick.besideAt(), null, 'inside: the dungeon\'s door');
  // walking a pixel is not a journey
  ann.pose = { ...ann.pose, px: 421, in: 0 };
  w.step();
  assert.equal(bran.prompts.length, 2);
});

test('PARTY-TRAVEL session: the offer\'s refusals in words - the leader offline, me indoors, the gold, the map door - and a busy member is told in the chat to use /leader', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  ann.pose = { ...ann.pose, px: 300, py: 150 };
  bran.busy = true;
  w.step();
  assert.equal(bran.prompts.length, 0);
  assert.equal(bran.lines.at(-1), 'Ann is at Wayrest. Type /leader to travel to them.');
  assert.equal(bran.pt.command('leader'), PARTY_TRAVEL_TEXT.busy, 'the box never takes the slot from another window');
  assert.equal(bran.prompts.length, 0);
  bran.busy = false;
  bran.outdoors = false;
  assert.equal(bran.pt.command('leader'), PARTY_TRAVEL_TEXT.inside);
  bran.outdoors = true;
  bran.afford = false;
  assert.equal(bran.pt.command('leader'), 'You cannot afford the journey (40 gold).');
  bran.afford = true;
  bran.refusal = 'You cannot travel with enemies nearby.';
  assert.equal(bran.pt.command('leader'), 'You cannot travel with enemies nearby.');
  bran.refusal = null;
  ann.online = false;
  w.exchange();
  assert.equal(bran.pt.command('leader'), PARTY_TRAVEL_TEXT.offline);
  assert.equal(ann.pt.command('leader'), PARTY_TRAVEL_TEXT.leading);
  ann.online = true;
  w.exchange();
  assert.equal(bran.pt.command('leader'), null, 'asked - the box says the rest');
  assert.equal(bran.prompts.length, 1);
  bran.social.party = null;
  assert.equal(bran.pt.command('leader'), PARTY_TRAVEL_TEXT.noParty);
  assert.equal(bran.pt.command('travel'), PARTY_TRAVEL_TEXT.noParty);
});

test('PARTY-TRAVEL session: the travel map\'s own offer - a member away who opens the map is asked first; No opens the map once the box has left the slot, and the map asks no more for LEADER_MAP_QUIET_MS; a member at the leader\'s side, and the leader, are never asked', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step();
  assert.equal(bran.pt.mapOffer(), false, 'together already');
  assert.equal(ann.pt.mapOffer(), false, 'the leader');
  ann.pose = { ...ann.pose, px: 300, py: 150 };
  bran.busy = true;   // the unasked offer waits
  w.step();
  bran.busy = false;
  assert.equal(bran.pt.mapOffer(), true, 'the offer took the press');
  const box = bran.prompts.at(-1);
  bran.busy = true;   // the box still in the slot
  box.onNo();
  w.step();
  assert.equal(bran.opened, 0, 'not while the slot is held');
  bran.busy = false;
  w.step();
  assert.equal(bran.opened, 1, 'the map, as the key asked');
  assert.equal(bran.pt.mapOffer(), false, 'quiet after a No');
  w.step(LEADER_MAP_QUIET_MS);
  assert.equal(bran.pt.mapOffer(), true, 'and asks again after LEADER_MAP_QUIET_MS');
});

test('PARTY-TRAVEL session: /travel - a gathered member readies up, and again stays behind; far from the leader it says so; the leader calls the round off; with no round it says what to do', () => {
  const w = partyOf(['Ann', 'Bran', 'Cyr']);
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.c('Cyr').busy = true;   // Cyr never answers: the round stays open
  w.step();
  assert.equal(bran.pt.command('travel'), 'There is no journey to ready up for. /leader travels to your leader.');
  assert.equal(ann.pt.command('travel'), 'Choose a destination on the travel map - the party gathered with you is asked to come along.');
  ann.pt.propose(PICK, OPTS, FARE);
  const at = ann.pt.poseFields().tv.at;
  bran.busy = true;
  w.step();
  assert.equal(bran.pt.command('travel'), null);
  assert.equal(bran.pt.poseFields().tr, at, 'ready');
  assert.equal(bran.pt.command('travel'), null);
  assert.equal(bran.pt.poseFields().td, at, 'and, ready already, staying behind');
  bran.busy = false;
  w.step();
  assert.equal(bran.prompts.length, 0, 'an answered round asks no more');
  bran.near = false;
  assert.equal(bran.pt.command('travel'), 'Gather with Ann to travel with the party.');
  assert.equal(ann.pt.command('travel'), 'You call off the journey.');
  assert.equal(ann.pt.poseFields().tv, undefined);
});

test('PARTY-TRAVEL session: leaving the party takes every round, box and journey with it, and a new party is offered afresh', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  ann.pose = { ...ann.pose, px: 300, py: 150 };
  w.step();
  assert.equal(bran.prompts.length, 1);
  bran.social.party = null;
  w.step();
  assert.equal(bran.prompts[0].closed, true);
  bran.social.party = { id: 'q1', leader: 'acct-Ann', members: [{ acct: 'acct-Ann', name: 'Ann', online: true, peers: [], p: null }, { acct: 'acct-Bran', name: 'Bran', online: true, peers: [], p: null }] };
  w.step();
  assert.equal(bran.prompts.length, 2, 'offered again');
});

// ─── THE HEADLESS FARE ──────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-TRAVEL fare: the travel map\'s own popup prices a journey with no map and no screen - its toggles move the fare as they do on the card, and its gold gate is two-sided', () => {
  const pop = (gold, pieces) => new TravelPopUpWindow({ x: 60, y: 40 }, {
    getPlayerPixel: () => ({ x: 10, y: 10 }), getClimateIndex: () => 0, gold: () => gold, goldPieces: () => pieces, noWorldTime: () => true,
  });
  const p = pop(1e6, 1e6);
  p.speedCautious = false; p.sleepModeInn = true; p.travelShip = false;
  p.refresh();
  const inn = p.trip.totalCost;
  assert.ok(inn > 0, 'the inn is billed');
  p.sleepModeInn = false; p.refresh();
  assert.ok(p.trip.totalCost < inn, 'camping out is cheaper, on the card and here alike');
  p.sleepModeInn = true; p.refresh();
  assert.equal(p.enoughGoldCheck(), true);
  const poor = pop(1e6, 0);
  poor.speedCautious = false; poor.sleepModeInn = true; poor.travelShip = false; poor.refresh();
  assert.equal(poor.enoughGoldCheck(), false, 'letters of credit cannot pay the inn');
});

// ─── THE HOST, BY SOURCE ────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-TRAVEL host by source: world.js wires the session - the map door\'s offer and the Begin\'s proposal, the pose\'s share and the leader\'s feet, the sent pose, the tick, the chat\'s two commands, the fare through the popup over the maps\' ONE bag, and the arrival beside the leader', () => {
  const w = rd('src/scenes/world.js');
  const door = w.slice(w.indexOf('const toggleTravelMap = (gotoPlace = null) => {'), w.indexOf('function openTeleportMap'));
  assert.ok(door.indexOf('if (!gotoPlace && partyTravel?.mapOffer()) return;') > door.indexOf('const ftb = racialFastTravelBlock(playerEntity'), 'the offer after every refusal the door asks');
  assert.ok(door.indexOf('if (!gotoPlace && partyTravel?.mapOffer()) return;') < door.indexOf('_travelMap = buildTravelMapWindow('), '...and before the map is built');
  assert.match(door, /onTravel: \(pick, opts, computed\) => \{\n\s*if \(partyTravel\?\.propose\(pick, opts, computed\)\) \{ hudFade\.clearFade\(\); return; \}[^\n]*\n\s*if \(opts\?\.playerControlled && beginAcceleratedTravel\(/, 'the Begin: a gathered party\'s fast travel is a proposal first (the session refuses a walked trip), then the mod\'s walk, then the journey');
  assert.match(w, /\.\.\.\(partyTravel\?\.poseFields\(\) \?\? \{\}\),\n\s*\.\.\.\(social\?\.leads\?\.\(\) && mode === 'exterior' && walkMode && playerSpawned && !worldMoveBusy\(\) \? partyFeetOf\(player\.pos\) : \{\}\),/, 'the pose\'s share; the leader\'s feet in the open air, never mid-journey');
  assert.match(w, /const partyFeetOf = \(pos\) => \{ const wc = state\.worldCoords\(pos\); return \{ wx: wc\.x, wy: pos\[1\] - state\.compensation\[1\], wz: wc\.z \}; \};/, 'the world pose\'s own frame');
  assert.match(w, /_partyPose = composePartyPose\(\);\s*socialLink\(\)\?\.sendParty\(_partyPose\);\n\s*partyTravel\?\.sent\(_partyPose\);/, 'the pose handed to the link, handed to the session');
  assert.match(w, /partyTravel\?\.tick\(\);[^\n]*\n\s*partyRestFollowTick\(\);[^\n]*\n\s*partyFrame\(performance\.now\(\)\);/, 'every frame, before the pose is composed - PARTY-REST1\'s mirror still right beside the send');
  assert.match(w, /const trip = \/\^\\\/\(leader\|travel\)\$\/i\.exec\(text\.trim\(\)\);\n\s*if \(trip\) \{ const line = partyTravel \? partyTravel\.command\(trip\[1\]\.toLowerCase\(\)\) : NO_PARTY_TEXT;/);
  const onSend = /onSend: \(tabId, text\) => \{([\s\S]*?)\n {6}\},/.exec(w)[1];
  assert.ok(onSend.indexOf("/^\\/ready$/i") < onSend.indexOf('(leader|travel)') && onSend.indexOf('(leader|travel)') < onSend.indexOf('parseChatLine('), 'the host\'s own commands, then the parser');
  const fare = w.slice(w.indexOf('function partyTripFare(to, opts) {'), w.indexOf('function partyTravelRefusal() {'));
  assert.match(fare, /new TravelPopUpWindow\(\{ x: to\.x, y: to\.y \}, \{\s*\.\.\.travelFareDeps\(\),/, 'the popup, over the maps\' own bag');
  assert.match(fare, /pop\.enforceShipRestriction\(\);\s*pop\.refresh\(\);/);
  assert.match(fare, /afford: pop\.enoughGoldCheck\(\),/);
  const bag = w.slice(w.indexOf('createTravelMapWindow({'), w.indexOf('...extra,', w.indexOf('createTravelMapWindow({')));
  assert.match(bag, /\.\.\.travelFareDeps\(\),/, 'both maps read the same bag the party prices with');
  const refusal = w.slice(w.indexOf('function partyTravelRefusal() {'), w.indexOf('const partyTravelJourney'));
  assert.match(refusal, /if \(duelEnemyNear\(\) \|\| areEnemiesNearby\(\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]\)\) return CANNOT_TRAVEL_ENEMIES_TEXT;/, 'the door\'s own rungs, in its own words');
  assert.match(refusal, /return racialFastTravelBlock\(playerEntity, nowMin\)\?\.text \?\? null;/);
  const travel = w.slice(w.indexOf('async function fastTravelTo(pick, opts, computed)'), w.indexOf('\n  }\n', w.indexOf('async function fastTravelTo(pick, opts, computed)')));
  assert.match(travel, /const beside = walkMode && pick\.besideAt \? partyBesideLanding\(pick\.besideAt\(\)\) : null;\s*\n\s*if \(beside\) \{\s*\n\s*player\.spawn\(beside\.pos\[0\], beside\.pos\[1\], beside\.pos\[2\]\);/, 'beside the leader, after the core built the pixel');
  assert.ok(travel.indexOf('const beside = ') > travel.indexOf('await _teleportToPixel('), 'read after the build');
  assert.match(travel, /townTalk\.say\(beside && pick\.besideText \? pick\.besideText : `You arrive at \$\{pick\.name\}\.`\);/);
  assert.match(w, /return besideLandingOf\(\[lx, w\.y \+ state\.compensation\[1\], lz\], \{/, 'the law picks the spot over the pixel\'s collider');
  assert.match(w, /relayOk: \(\) => !!socialLink\(\)\?\.partyTravelOk,/, 'a round only through a hub that carries it');
  assert.match(w, /busy: \(\) => gamePaused\(\),/, 'a prompt waits while a window holds the slot - the pause\'s own question');
  assert.match(w, /prompt: \(rows, onYes, onNo\) => \{ const box = new YesNoBoxWindow\(\{ rows, onYes, onNo \}\); townTalk\.showOverlay\(box\); return box; \},/, 'UXB1-M\'s box, either skin');
});

test('PARTY-TRAVEL chat: /leader and /travel are the host\'s own commands, and /help says both', () => {
  for (const n of ['leader', 'travel']) {
    assert.ok(HOST_COMMANDS.includes(n));
    assert.deepEqual(parseChatLine(`/${n}`), { kind: 'host', name: n });
  }
  assert.ok(HELP_LINES.includes('/leader - travel to your party leader'));
  assert.ok(HELP_LINES.includes('/travel - ready up for the leader\'s journey (the leader: call it off)'));
  assert.equal(PARTY_TRIP_GO_MS, 3000);
});
