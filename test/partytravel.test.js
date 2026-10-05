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
import { createPartyTravel, PARTY_TRIP_TICK_MS, PARTY_TRIP_GO_MS, LEADER_MAP_QUIET_MS, LEADER_SETTLE_MS, followerSeatOf } from '../src/systems/partyTravel.js';
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
});

test('AUDIT PARTY-TRAVEL law: the followers of one leader each start from a spot of their own - eight spots around the leader, a step away; the follower\'s seat is where the search starts, and a walled spot passes on to the next', () => {
  const at = [10, 5, 20];
  const probe = (clear = () => true) => ({ clear, floor: (pos) => [pos[0], 5, pos[2]] });
  assert.equal(BESIDE_OFFSETS.length, 8, 'a whole party of eight: the leader and seven followers');
  const spots = new Set();
  for (const [dx, dz] of BESIDE_OFFSETS) {
    assert.ok(Math.abs(Math.hypot(dx, dz) - BESIDE_STEP) < 1e-12, 'each a step from the leader');
    spots.add(`${dx.toFixed(3)},${dz.toFixed(3)}`);
  }
  assert.equal(spots.size, 8, 'eight different spots');
  const landed = new Set();
  for (let seat = 0; seat < 7; seat++) {
    const l = besideLandingOf(at, probe(), seat);
    const [dx, dz] = BESIDE_OFFSETS[seat];
    assert.deepEqual(l.pos, [10 + dx, 5, 20 + dz], `seat ${seat} starts at its own spot`);
    assert.ok(Math.abs(l.yaw - Math.atan2(-dx, -dz)) < 1e-12, 'facing the leader');
    landed.add(l.pos.join(','));
  }
  assert.equal(landed.size, 7, 'seven followers of one leader land on seven spots - no two inside one another');
  assert.deepEqual(besideLandingOf(at, probe(), 0).pos, besideLandingOf(at, probe()).pos, 'no seat: the first spot');
  assert.deepEqual(besideLandingOf(at, probe(), 9).pos, besideLandingOf(at, probe(), 1).pos, 'the ring wraps');
  const westWalled = besideLandingOf(at, probe((from, dir) => dir[0] > -0.5), 1);
  assert.deepEqual(westWalled.pos, [10, 5, 20 + BESIDE_STEP], 'seat 1\'s west is walled: on round the ring, not back to the east another follower took');
  for (const bad of [-1, 1.5, NaN, null, '2']) assert.deepEqual(besideLandingOf(at, probe(), bad).pos, [10 + BESIDE_STEP, 5, 20], `a seat of ${bad} is the first spot`);
  // the seat is the follower's place among the members who are not the leader, in the hub's seat order
  const party = { leader: 'acct-Ann', members: ['Bran', 'Ann', 'Cyr', 'Dala'].map((n) => ({ acct: `acct-${n}` })) };
  assert.deepEqual(['Bran', 'Cyr', 'Dala'].map((n) => followerSeatOf(party, `acct-${n}`)), [0, 1, 2]);
  assert.equal(followerSeatOf(party, 'acct-Ann'), 0);
  assert.equal(followerSeatOf(null, 'acct-Bran'), 0);
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
  assert.equal(RELAY_VERSION, 'world169', 'AUDIT ARENA-LADDER moved it on last (world169: the arena ladder audit - elite champions, telegraphed blows, a judging floor and the attempt ticket - world167 on its branch, renumbered past SHADOW-CLOAK and SERAPH-WINGS at the merges); SERAPH-WINGS moved it on (world168: the Seraph Wings join the aura vocabulary of the token - a relay before it refuses the token of a developer wearing them); SHADOW-CLOAK moved it on (world167: the Holo Shadow Cloak joins the token\'s aura vocabulary - a relay before it refuses SirMcMobdon\'s token once they wear it; world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges); SERPENT2 moved it on (world166: the serpent herald - a serpent site word to the hub, its bells and its kill posted to Discord); SERPENT1 moved it on (world165: the serpent frame - a sea serpent fight in the cell of its site; world162 on its branch, renumbered past PRIMARCH (world162) and SUNBABY1 (world163), then PARTY-LEAD (world164), at the merges); PARTY-LEAD moved it on (world164: the hub\'s party.lead act - a leader hands the lead to a member); SUNBABY1 moved it on (world163: the hub\'s live events gain the sun baby\'s word - LIVE_EVENTS, no frame changes shape); PRIMARCH moved it on (world162: the Primarch\'s title and glyph and the Golden Radiance\'s aura join the token\'s vocabulary - a relay before it refuses GA00250\'s token); GUILD2 moved it on (world161: no wire change - the guild and heraldry laws moved under the relay); AEGIS moved it on (world160: the Aegis of Oblivion\'s title and glyph and the Oblivion Ward\'s aura join the token\'s vocabulary - a relay before it refuses Sureme\'s token); ARENA4 moved it on (world155: the arena rooms - the hall queue, the refereed bouts, the stands - and the arena titles and laurel on the token - world142 on its branch, renumbered past main\'s FRIENDS-SYNC, ELITE FOES, the Seats arc, WB12, GLYPH-WEAR, REVENANT-WIRE and BROKER-CAGE (world142-world154) at the merge); BROKER-CAGE moved it on (world154: the rite word says every one of the faithful fell, and the hub says the Broker cage open); REVENANT-WIRE moved it on (world153: the foe record carries a revenant\'s name, nm, and a beaten one\'s kneel, burning and oath, yd/ex/sp); GLYPH-WEAR moved it on (world152); WB12 moved it on (world151: Dagon\'s Breach - its words in the omen\'s lines and the herald\'s posts, the faithful\'s rite - main\'s CLIMB5 and CLIMB6, FRIENDS-SYNC, ELITE FOES and the Seats arc took world141-world150 first); before it SEAT2b part two (b) moved it on (world150: the works in battle); SEASON1 part two, the banner ribbon moved it on (world149: the banner ribbon - the Seats arc\'s six relays renumbered past main\'s HERALD, LOOT7, WB11 and CLIMB5 (world138-world141) at the merge); CROWN1 part two moved it on (world148: the Royal Tourney); SEAT2a moved it on (world147: the siege battle); PVP-REF moved it on (world146: the refereed siege room); SEAT1c moved it on (world145: the seats\' titles and glyphs - five generic title ids, a `ts` claim beside them, four glyphs); SEAT1b moved it on (world144: the Watch\'s tick - a `watch` frame carrying a `k1` receipt the relay signs, net/watchReceipt.js); ELITE FOES moved it on (world143: the foe record carries an elite foe, z, so a puppet stands as one); before it FRIENDS-SYNC moved it on (world142: the hub account is the signed-in player - the token subject - and a browser profile list is merged into it once); before it CLIMB5 and CLIMB6 moved it on (world141: the pose\'s climb - `cl`, `cw` and a move\'s `ck`, `cy`, `cd`); before it WB11 moved it on (world140: the host of the Legion-Lord - the `ahit` blow on one of it, the words `ad`, `amv`, `aatk`, `ah` and `adie` of the room, `lg` in the state, `a` in a chart row, the brain law 5; GATE-HEAL\'s `heal` and a chart row\'s `hl` with it - main\'s HERALD and LOOT7 took world138 and world139 first); before it LOOT7 moved it on (world139: the street foe record field `cp`, a champion trait - HERALD took world138 first); before it HERALD moved it on (world138: `herald` joins the titles and glyphs a token carries, the Patreon tier between Disciple and Hierophant); before it KEPT-KILL moved it on (world137: the party pose field `qk`, the kills of quest foes a member held for a partner, counted by every copy of the quest); before it GATE-UX moved it on (world136: the damage chart made at the kill - every challenger and their part, ranked, on the `fell` word of the court and on the fall in the state (`dm`)); before it WB9 moved it on (world135: the three courts of the Warden and the Reckoning of Dagon - his court and the walkways laid in the state (`ct`, `xa`), the crystals, their breaking and the stun (`cx`, `cxh`, `cxb`, `stun`, `su`, `rk`) and a blow on a crystal (`xhit`), judged and fanned by the relay - main\'s PARTY-MAP took world134 first); before it PARTY-MAP moved it on (world134: the `amap` frame, the automap rows a Shared Cartography caster reveals, to the party alone); before it SOFTCAP1 moved it on (world133: the party pose `cl`, a member character level for mentor mode); before it STRIKE-SHARED moved it on (world132: the strike spell on a hit and the trapper on a dead foe, both read by the clients alone); before it MERGE 2 moved it on (world131: the professions branch, BOUNTY1 + AUDIT 28 - `bq` and `lv` on the party pose, `k`, `a` and `t` on a bounty row - world125 on its branch, never deployed, a number VOICE1 took on main); before it REALM-DOOR moved it on (world130: the door refuses a token the account service signed as naming no realm character); before it PENITENT\'s badge vocabulary (world129); before it WB8 moved it on (world128: marks on the gate state, the fed word - world126 on its branch, never deployed, renumbered past OW6L at the merge); before it OW6L (world127: the overworld ledger of a cell, the ow frame - never world125 (VOICE1, reverted) nor world126 (DISCORD-GATES on its branch)); before it TV8 (world124: the party\'s Overworld walk - world123 on its branch, renumbered past THE MERGE\'s); before it THE MERGE (world123: the raids, the gates and Discord - world122 to world126 on their branch, never deployed - one relay past main\'s TV3); before it TV3 (world122: a region\'s traveller marks); ONE-SEAT before it (world121 - world119, then world120, on its branch, renumbered past main\'s AUDIT SET (world119) and PARTY-BUFFS + REST-OPT (world120) at the merges: a hub hello\'s claim - one tab of an account online); before it PARTY-BUFFS + REST-OPT + the batch audit (world120 - world119, world120 and world121 on their branch, renumbered past main AUDIT SET at the merge: fx, rs and nr on the party pose, TRADE_REV_MAX and REST_OPT_RELAY_MIN named); before it AUDIT SET (world119 - world117 on its branch, renumbered past main\'s SHADOW-FANG (world117) and OWN1 + INVIS-NET (world118) at the merge: the dungeon foe record carries `v`, the joiner whose blow killed it); OWN1 + INVIS-NET moved it on before (world118 - world114 on its branch, renumbered past main\'s world114-117: the own lane and the pose\'s concealment bits); SHADOW-FANG\'s badge vocabulary moved it on (world117 - world114 on its branch, world116 at its first merge; main\'s Oblivion Gate WBX took world116 first); the Oblivion Gate\'s WBX5, AUDIT WBX and AUDIT WBX2 moved it on (world116 - world114 on its branch, renumbered past main\'s Enhanced Plus patch (world114) and GUILD1c (world115)); GUILD1c (world115 - world113 on its branch) and the Enhanced Plus patch (world114) moved it on after WB3 and AUDIT WB (the gate\'s boss room, world113); PARTY-TRAVEL: the party pose\'s journey fields (world112 - world110 on its branch; EVENT1 and RENOWN1 took 110-111)');
  assert.equal(PARTY_TRAVEL_RELAY_MIN, 112);
  assert.equal(relaySupportsPartyTravel('world112'), true);
  assert.equal(relaySupportsPartyTravel('world113'), true);
  assert.equal(relaySupportsPartyTravel('world111'), false, 'the relay before this deploy (RENOWN1\'s, and EVENT1\'s before it) strips the round - no leader waits on answers that cannot come');
  for (const v of [null, '', 'world', 'World112', 112]) assert.equal(relaySupportsPartyTravel(v), false);
  // the hub link reads it off its welcome
  const link = (v) => {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => 1e6, presence: false, acct: 'acct-me', asecret: 'secret-of-acct-me' });
    s.join(SOCIAL_ROOM, null);
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v });
    return s.partyTravelOk;
  };
  assert.equal(link('world112'), true);
  assert.equal(link('world111'), false);
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
    const c = { name, acct: `acct-${name}`, pose: { ...P }, feet: null, near: true, online: true, lines: [], mids: [], midSecs: [], prompts: [], travels: [], opened: 0, tab: false,
      busy: false, alive: true, outdoors: true, refusal: null, afford: true, travelGoes: true, at: { x: 0, z: 0 }, relayOk: true, moving: false, journeying: false, dirty: 0, sendFails: false };
    c.social = { acct: c.acct, party: null, leads() { return this.party?.leader === this.acct; }, now: () => clock.shared };
    c.host = {
      social: () => c.social,
      gathered: () => (c.near ? c.social.party.members.filter((m) => m.acct !== c.acct && memberPresent(m) && byAcct(m.acct).near) : []),
      nearLeader: (row) => c.near && byAcct(row.acct).near,
      here: () => ({ x: c.pose.px, y: c.pose.py }),
      outdoors: () => c.outdoors, alive: () => c.alive, busy: () => c.busy, moving: () => c.moving, journeying: () => c.journeying,
      refusal: () => c.refusal,
      fare: (to, opts) => ({ opts: { ...opts }, computed: { totalCost: 40, piecesCost: 25, minutes: 600 }, afford: c.afford, unwell: false }),
      canAfford: () => c.afford,
      myToggles: () => ({ speedCautious: true, sleepModeInn: true, travelShip: false }),
      feet: () => c.at, radius: 15,
      placeName: (to, fb) => PLACES[`${to.x},${to.y}`] || fb || 'the wilderness',
      prompt: (rows, onYes, onNo) => { const h = { rows, onYes, onNo, closed: false }; c.prompts.push(h); return h; },
      closePrompt: (h) => { h.closed = true; },
      say: (t) => c.lines.push(t), mid: (t, sec) => { c.mids.push(t); c.midSecs.push(sec); },
      tabOpen: () => c.tab,   // PARTY-READY: the Social panel open on its Party tab
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
  w.step(LEADER_SETTLE_MS);   // AUDIT PARTY-TRAVEL: past the stillness the unasked offer waits for
  assert.equal(bran.prompts.length, 1, 'the leader\'s arrival where I am already bound is offered to nobody (the host\'s journey is still loading)');
  await flush();   // the leader's journey resolves: she has arrived
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
  assert.equal(bran.lines.filter((l) => l === 'Ann wants the party to travel to Wayrest. Type /travel to come along.').length, 1, 'busy: told once, in the chat - AUDIT PARTY-UI 8: naming no tab, which cannot open under the window (the box asks once it closes)');
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
  // before his yes reaches her - once it has, the round sets out, and a round that set out is never replaced (AUDIT PARTY-UI2 4)
  assert.equal(ann.pt.propose({ pixel: { x: 420, y: 90 }, name: 'Castle Sentinel' }, OPTS, FARE), true);
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
  w.step(LEADER_SETTLE_MS);   // AUDIT PARTY-TRAVEL: past the stillness the unasked offer waits for
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
  away.c('Bran').at = { x: 15.1, z: 0 };   // he walked off, out of the radius of where he was gathered
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
  assert.equal(window.c('Bran').lines.at(-1), 'The party went on without you. Travel to Ann from the Party tab, or type /leader.');
  assert.equal(window.c('Bran').travels.length, 0);
  window.step(LEADER_SETTLE_MS);
  assert.equal(window.c('Bran').lines.at(-1), 'The party went on without you. Travel to Ann from the Party tab, or type /leader.', 'AUDIT PARTY-TRAVEL: that line names /leader - the journey is not offered a second time');
});

test('PARTY-TRAVEL session: TO THE LEADER - a member elsewhere is offered the journey unasked when they first see the leader, once per place; Yes travels to where the leader is THEN, beside them in the open air, at the door of a dungeon they are in; a later journey of the leader\'s is offered again', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  ann.pose = { ...ann.pose, px: 300, py: 150, loc: 'Wayrest' }; ann.feet = feetIn(300, 150);
  w.step();
  assert.equal(bran.prompts.length, 0, 'AUDIT PARTY-TRAVEL: not until the leader\'s pixel has held still');
  w.step(LEADER_SETTLE_MS);
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
  w.step(LEADER_SETTLE_MS);
  assert.equal(bran.prompts.length, 2, 'a journey of the leader\'s is offered again');
  assert.deepEqual(bran.prompts[1].rows, ['Travel to Ann at Castle Sentinel?', 'Ann is inside Castle Sentinel - you will arrive at its door.', 'The journey costs 40 gold.']);
  bran.prompts[1].onYes();
  assert.equal(bran.travels[1].pick.besideAt(), null, 'inside: the dungeon\'s door');
  // walking a pixel is not a journey
  ann.pose = { ...ann.pose, px: 421, in: 0 };
  w.step();
  w.step(LEADER_SETTLE_MS);
  assert.equal(bran.prompts.length, 2);
});

test('PARTY-TRAVEL session: the offer\'s refusals in words - the leader offline, me indoors, the gold, the map door - and a busy member is told in the chat to use /leader', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  ann.pose = { ...ann.pose, px: 300, py: 150 };
  bran.busy = true;
  w.step();
  w.step(LEADER_SETTLE_MS);
  assert.equal(bran.prompts.length, 0);
  assert.equal(bran.lines.at(-1), 'Ann is at Wayrest. Travel to them from the Party tab, or type /leader.');
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
  bran.near = false; bran.at = { x: 15.1, z: 0 };   // AUDIT PARTY-UI 3: walked out of the radius of where he was read gathered - as the departure reads it
  w.step();
  assert.equal(bran.pt.command('travel'), 'Gather with Ann to travel with the party.');
  assert.equal(ann.pt.command('travel'), 'You call off the journey.');
  assert.equal(ann.pt.poseFields().tv, undefined);
});

test('PARTY-TRAVEL session: leaving the party takes every round, box and journey with it, and a new party is offered afresh', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  ann.pose = { ...ann.pose, px: 300, py: 150 };
  w.step();
  w.step(LEADER_SETTLE_MS);
  assert.equal(bran.prompts.length, 1);
  bran.social.party = null;
  w.step();
  assert.equal(bran.prompts[0].closed, true);
  bran.social.party = { id: 'q1', leader: 'acct-Ann', members: [{ acct: 'acct-Ann', name: 'Ann', online: true, peers: [], p: null }, { acct: 'acct-Bran', name: 'Bran', online: true, peers: [], p: null }] };
  w.step();
  w.step(LEADER_SETTLE_MS);
  assert.equal(bran.prompts.length, 2, 'offered again');
});

// ─── AUDIT PARTY-TRAVEL (2026-09-25, the pre-merge review) ─────────────────────────────────────────────────────

test('AUDIT PARTY-TRAVEL session: GATHERED IS LOST BY WALKING AWAY - a member who said yes and never moved follows even when the leader\'s body left their scene before the pose saying "we set out" reached them (the hub link and the world link are two sockets, with no order between them)', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step();
  ann.pt.propose(PICK, OPTS, FARE);
  w.step();
  bran.prompts[0].onYes();
  // one breath, by hand: Bran's yes reaches Ann and she sets out - and her body leaves Bran's scene before her pose does
  w.clock.mono += PARTY_TRIP_TICK_MS; w.clock.shared += PARTY_TRIP_TICK_MS;
  w.exchange();
  ann.pt.tick();
  assert.ok(ann.pt.state.trip.go > 0, 'the leader counted Bran and set out');
  bran.host.nearLeader = () => false;   // no body beside me: her world link left the room first
  bran.pt.tick();
  w.step();
  assert.equal(bran.lines.at(-1), 'The party sets out for Wayrest - you follow Ann.', 'I stood where I was gathered: I am gathered still');
  assert.ok(bran.pt.state.follow);
  ann.pose = { ...ann.pose, px: 300, py: 150 }; ann.feet = feetIn(300, 150);
  w.step();
  assert.equal(bran.travels.length, 1, 'and I arrive with the party');
});

test('AUDIT PARTY-TRAVEL session: the door\'s refusals are asked again as the leader\'s journey begins - a leader who stepped inside (or met an enemy) between "we set out" and the start is never flown off the map; the round goes with it and nobody follows; a refusal that IS "the journey is off" is said once', () => {
  const setOut = () => {
    const w = partyOf();
    w.step();
    w.c('Ann').pt.propose(PICK, OPTS, FARE);
    w.step();
    w.c('Bran').prompts[0].onYes();
    w.c('Ann').sendFails = true;   // the pose saying so has not left the link yet
    w.step();
    assert.ok(w.c('Ann').pt.state.trip.go > 0);
    w.step();
    assert.ok(w.c('Bran').pt.state.follow, 'Bran read "we set out"');
    return w;
  };
  const inside = setOut();
  inside.c('Ann').outdoors = false;   // through a door
  inside.step(PARTY_TRIP_GO_MS);
  assert.equal(inside.c('Ann').travels.length, 0, 'no journey from a building\'s floor');
  assert.equal(inside.c('Ann').pt.state.trip, null, 'the round goes with it');
  assert.equal(inside.c('Ann').lines.at(-1), PARTY_TRAVEL_TEXT.off);
  inside.step();
  assert.equal(inside.c('Bran').lines.at(-1), `Ann did not set out. ${PARTY_TRAVEL_TEXT.off}`);
  assert.equal(inside.c('Bran').travels.length, 0, 'nobody follows where the leader did not go');
  const foe = setOut();
  foe.c('Ann').refusal = 'You cannot travel with enemies nearby.';
  foe.step(PARTY_TRIP_GO_MS);
  assert.equal(foe.c('Ann').travels.length, 0);
  assert.equal(foe.c('Ann').lines.at(-1), `You cannot travel with enemies nearby. ${PARTY_TRAVEL_TEXT.off}`);
  const busyStart = setOut();
  busyStart.c('Ann').refusal = PARTY_TRAVEL_TEXT.off;   // a load moving me: the door's own "off"
  busyStart.step(PARTY_TRIP_GO_MS);
  assert.equal(busyStart.c('Ann').lines.at(-1), PARTY_TRAVEL_TEXT.off, 'said once, not twice');
  // and the same word at the setting out
  const twice = partyOf();
  twice.step();
  twice.c('Ann').pt.propose(PICK, OPTS, FARE);
  twice.step();
  twice.c('Bran').prompts[0].onYes();
  twice.c('Ann').refusal = PARTY_TRAVEL_TEXT.off;
  twice.step();
  assert.equal(twice.c('Ann').lines.at(-1), PARTY_TRAVEL_TEXT.off, 'the setting out\'s refusal, said once');
  assert.equal(twice.c('Ann').pt.state.trip, null);
});

test('AUDIT PARTY-TRAVEL session: the unasked offer waits for the leader to hold still - a Travel Options ride whose poses jump two pixels at a time is offered NOTHING while it rides and once where it ends; a jump seen while my own journey moved me is offered once I arrive, not lost', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step(); w.step(LEADER_SETTLE_MS);
  assert.equal(bran.prompts.length + bran.lines.length, 0, 'first sight, at my side: nothing to offer');
  ann.pose = { ...ann.pose, loc: '' };
  for (let i = 1; i <= 20; i++) { ann.pose = { ...ann.pose, px: 100 + 2 * i }; w.step(1000); }
  assert.equal(bran.prompts.length, 0, 'not a box a second while she rides');
  assert.equal(bran.lines.length, 0, 'nor a line');
  w.step(LEADER_SETTLE_MS - PARTY_TRIP_TICK_MS);
  assert.equal(bran.prompts.length, 0, 'not until her pixel has held still LEADER_SETTLE_MS');
  w.step();
  assert.equal(bran.prompts.length, 1, 'once, where the ride ended');
  w.step(); w.step(LEADER_SETTLE_MS);
  assert.equal(bran.prompts.length, 1, 'and once only');
  bran.prompts[0].onYes();
  assert.deepEqual(bran.travels[0].pick.pixel, { x: 140, y: 200 });
  // she journeys on while my own journey is still loading
  bran.moving = true;
  ann.pose = { ...ann.pose, px: 300, py: 150 };
  w.step(); w.step(LEADER_SETTLE_MS);
  assert.equal(bran.prompts.length, 1, 'not while a journey is moving me');
  bran.moving = false;
  w.step();
  assert.equal(bran.prompts.length, 2, 'offered once I have arrived - the jump was not lost');
  assert.equal(bran.prompts[1].rows[0], 'Travel to Ann at Wayrest?');
});

test('AUDIT PARTY-TRAVEL session: the followers of one leader carry their own seats - each journey\'s pick names where in the ring beside the leader that member tries first, so the party that arrives together does not arrive inside one another', () => {
  const w = partyOf(['Ann', 'Bran', 'Cyr']);
  const ann = w.c('Ann'), bran = w.c('Bran'), cyr = w.c('Cyr');
  w.step();
  ann.pt.propose(PICK, OPTS, FARE);
  w.step();
  bran.prompts[0].onYes(); cyr.prompts[0].onYes();
  w.step(); w.step();
  ann.pose = { ...ann.pose, px: 300, py: 150 }; ann.feet = feetIn(300, 150);
  w.step();
  assert.equal(bran.travels.length + cyr.travels.length, 2, 'both follow');
  assert.deepEqual([bran.travels[0].pick.besideSeat, cyr.travels[0].pick.besideSeat], [0, 1], 'two seats, two spots');
  // the journey to the leader carries it too
  const solo = partyOf(['Ann', 'Bran', 'Cyr']);
  solo.c('Ann').pose = { ...solo.c('Ann').pose, px: 300, py: 150 };
  solo.step(); solo.step(LEADER_SETTLE_MS);
  solo.c('Cyr').prompts[0].onYes();
  assert.equal(solo.c('Cyr').travels[0].pick.besideSeat, 1);
});

test('AUDIT PARTY-TRAVEL session: the leader\'s round stays on their pose until their own journey has ARRIVED - a build slower than TRIP_FOLLOW_MS does not tell the followers the leader "did not set out"; they go to the place, and the round leaves once the leader stands there', async () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  let arrive = null;
  ann.host.travel = (pick, opts, computed) => { ann.travels.push({ pick, opts, computed }); return new Promise((r) => { arrive = r; }); };   // a slow build
  w.step();
  ann.pt.propose(PICK, OPTS, FARE);
  w.step();
  bran.prompts[0].onYes();
  w.step(); w.step();
  assert.equal(ann.travels.length, 1, 'the leader is on the road');
  assert.ok(bran.pt.state.follow);
  w.step(TRIP_FOLLOW_MS - PARTY_TRIP_TICK_MS);
  w.step(2 * PARTY_TRIP_TICK_MS);   // past TRIP_FOLLOW_MS, the leader still building
  assert.ok(ann.pt.poseFields().tv, 'the round stays on the leader\'s pose while their journey is under way');
  assert.ok(!bran.lines.some((l) => l.includes('did not set out')), 'no follower is told the leader stayed');
  assert.equal(bran.travels.length, 1, 'the follower goes to the place anyway');
  arrive(true);
  await flush();
  w.step();
  assert.equal(ann.pt.state.trip, null, 'arrived, and TRIP_FOLLOW_MS past setting out: the round leaves');
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

test('PARTY-TRAVEL host by source: world.js wires the session - the map door\'s offer and the Begin\'s proposal, the pose\'s share and the leader\'s feet, the sent pose, the tick, the chat\'s two commands, the fare through the popup over the maps\' ONE bag, and the arrival beside the leader; AUDIT PARTY-UI2: outdoors off the mode and journeying off worldMoveBusy (mutants: outdoors always; journeying the Travel Options walk too)', () => {
  const w = rd('src/scenes/world.js');
  const door = w.slice(w.indexOf('const toggleTravelMap = (gotoPlace = null) => {'), w.indexOf('function openTeleportMap'));
  assert.ok(door.indexOf('if (!gotoPlace && partyTravel?.mapOffer()) return false;') > door.indexOf('const ftb = racialFastTravelBlock(playerEntity'), 'the offer after every refusal the door asks');
  assert.ok(door.indexOf('if (!gotoPlace && partyTravel?.mapOffer()) return false;') < door.indexOf('_travelMap = buildTravelMapWindow('), '...and before the map is built');
  assert.match(door, /onTravel: \(pick, opts, computed\) => \{\n\s*if \(partyTravel\?\.propose\(pick, opts, computed\)\) \{ hudFade\.clearFade\(\); return; \}[^\n]*\n\s*if \(opts\?\.playerControlled && beginAcceleratedTravel\(/, 'the Begin: a gathered party\'s fast travel is a proposal first (the session refuses a walked trip), then the mod\'s walk, then the journey');
  assert.match(w, /\.\.\.\(partyTravel\?\.poseFields\(\) \?\? \{\}\),\n(?:\s*\.\.\.\(_walk(?:Lead|Ts) [^\n]*\n)*\s*\.\.\.\(social\?\.leads\?\.\(\) && mode === 'exterior' && walkMode && playerSpawned && !worldMoveBusy\(\) \? partyFeetOf\(player\.pos\) : \{\}\),/, 'the pose\'s share; the leader\'s feet in the open air, never mid-journey');
  assert.match(w, /const partyFeetOf = \(pos\) => \{ const wc = state\.worldCoords\(pos\); return \{ wx: wc\.x, wy: pos\[1\] - state\.compensation\[1\], wz: wc\.z \}; \};/, 'the world pose\'s own frame');
  assert.match(w, /_partyPose = composePartyPose\(\);(?:\s*\/\/[^\n]*)*\s*if \(socialLink\(\)\?\.sendParty\(_partyPose\)\) partyTravel\?\.sent\(_partyPose\);/, 'AUDIT PARTY-TRAVEL: the session is told of a pose the link SENT - never of one sendParty refused (PARTY_SEND_MS\'s floor, a repeat, its gate)');
  assert.doesNotMatch(w, /\n\s*partyTravel\?\.sent\(_partyPose\);/, 'no unconditional hand-over left beside it');
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
  assert.match(refusal, /if \(duelEnemyNear\(\) \|\| areEnemiesNearby\(\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]\) \|\| navalHostileNear\(\)\) return CANNOT_TRAVEL_ENEMIES_TEXT;/, 'the door\'s own rungs, in its own words (NAV-H: a hostile ship in reach among them)');
  assert.match(refusal, /const sun = racialFastTravelBlock\(playerEntity, nowMin\)\?\.text \?\? null;\s*\n\s*return sun \? withNightfall\(sun\) : null;/, 'the door\'s own words, and (LIVED1) when the world\'s night falls');
  const travel = w.slice(w.indexOf('async function fastTravelTo(pick, opts, computed)'), w.indexOf('\n  }\n', w.indexOf('async function fastTravelTo(pick, opts, computed)')));
  assert.match(travel, /resolveArrival: partyArrival \? async \(fallback\)/, 'party landing is validated before the teleport commits');
  const core = w.slice(w.indexOf('async function _teleportToPixel('), w.indexOf('let _teleporting = false;'));
  assert.ok(core.indexOf('await resolveArrival(pos)') > core.indexOf('await awaitedBuild('), 'read after the build');
  assert.match(travel, /townTalk\.say\(beside && pick\.besideText \? pick\.besideText : `You arrive at \$\{pick\.name\}\.`\);/);
  assert.match(w, /return partyArrivalBeside\(\[lx, w\.y \+ state\.compensation\[1\], lz\], collider, seat/, 'capsule support over the destination collider');
  assert.match(travel, /partyBesideLanding\(target, pick\.besideSeat\)/, 'the follower seat reaches the supported landing search');
  assert.match(w, /moving: \(\) => worldMoveBusy\(\) \|\| !!travelControlUI\?\.isShowing,/, 'AUDIT PARTY-TRAVEL: no unasked box over a Travel Options walk the player is steering');
  // AUDIT PARTY-UI2 3: the tab's "Step outside" - the leader's Travel map and the member's journey alike - rests on the
  // host's own read of the mode; and 2: the tab's "elsewhere" hides over what the door itself refuses as "off", alone
  const seams = w.slice(w.indexOf('partyTravel = createPartyTravel({'), w.indexOf('\n  });', w.indexOf('partyTravel = createPartyTravel({')));
  assert.match(seams, /\n\s*outdoors: \(\) => \(modes\?\.mode \?\? 'exterior'\) === 'exterior',/, 'outdoors is the mode machine\'s own answer');
  assert.match(seams, /\n\s*journeying: \(\) => worldMoveBusy\(\),/, 'journeying is worldMoveBusy, as partyTravelRefusal\'s "off" is - no Travel Options walk');
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

// ─── PARTY-UI: the session as the Party tab reads it ────────────────────────────────────────────────────────────

test('PARTY-UI session: status() is what the Party tab shows - the leader\'s round, its count and its setting out; a member\'s round, answered or not, gathered or not; following; the leader elsewhere; none outside a party - and respond() is the tab\'s Ready and Stay behind, one way each, over /travel\'s own arm (mutants: the count never kept, respond a toggle, the box left standing, gathered unread)', async () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step();
  assert.deepEqual(ann.pt.status(), { role: 'leader', round: null, outdoors: true, hub: true, gathered: true, held: false });
  assert.deepEqual(bran.pt.status(), { role: 'member', leader: 'Ann', round: null, following: false, away: false, outdoors: true });
  ann.pt.propose(PICK, OPTS, FARE);
  assert.deepEqual(ann.pt.status().round, { dest: 'Wayrest', count: '1/2 ready', set: false });
  w.step();
  assert.deepEqual(bran.pt.status().round, { dest: 'Wayrest', ready: false, staying: false, gathered: true });
  assert.equal(bran.prompts.length, 1, 'the box asks, as ever');
  assert.equal(bran.pt.respond(false), PARTY_TRAVEL_TEXT.stay, 'AUDIT PARTY-UI 4: the answer\'s own line, for the tab\'s note');
  assert.equal(bran.prompts[0].closed, true, 'the box asking the same goes');
  assert.equal(bran.lines.at(-1), PARTY_TRAVEL_TEXT.stay, 'and said in the chat, as the box\'s answer is');
  assert.deepEqual(bran.pt.status().round, { dest: 'Wayrest', ready: false, staying: true, gathered: true });
  assert.equal(bran.pt.respond(false), PARTY_TRAVEL_TEXT.stay);
  assert.equal(bran.pt.state.decline != null && bran.pt.state.vote == null, true, 'Stay behind again stays behind - never a toggle');
  assert.equal(bran.pt.respond(true), 'You are ready to travel to Wayrest.');
  assert.deepEqual(bran.pt.status().round, { dest: 'Wayrest', ready: true, staying: false, gathered: true });
  w.step();
  assert.deepEqual(ann.pt.status().round, { dest: 'Wayrest', count: '2/2 ready', set: true }, 'every one gathered ready: the count, and the party sets out');
  w.step();   // the pose that says so reaches the member
  assert.equal(bran.pt.status().round, null, 'set out: nothing to answer on the tab');
  assert.equal(bran.pt.respond(true), 'There is no journey to ready up for. /leader travels to your leader.', 'no open round to answer');
  assert.equal(ann.pt.respond(true), null, 'the leader answers nothing');
  // far from the leader: the tab reads it, and the session refuses as /travel does
  const v = partyOf();
  const a2 = v.c('Ann'), b2 = v.c('Bran');
  v.step();
  b2.busy = true;
  a2.pt.propose(PICK, OPTS, FARE);
  b2.near = false;
  v.step();
  assert.equal(b2.pt.status().round.gathered, false);
  assert.equal(b2.pt.respond(true), 'Gather with Ann to travel with the party.');
  // the leader elsewhere: offered
  const u = partyOf();
  const b3 = u.c('Bran');
  u.c('Ann').pose = { ...u.c('Ann').pose, px: 300, py: 150 };
  u.step();
  assert.equal(b3.pt.status().away, true, 'the leader in another place: the journey to them is offered');
  // out of the party
  b3.social.party = null;
  assert.equal(b3.pt.status(), null);
  assert.equal(b3.pt.respond(true), PARTY_TRAVEL_TEXT.noParty);
});

// ─── AUDIT PARTY-UI (2026-09-27, the read-only audit of PARTY-UI) ──────────────────────────────────────────────────

test('AUDIT PARTY-UI session: the leader\'s tab reads whether a destination chosen now IS a round - outdoors, through a hub that carries it, with somebody gathered as the tick last counted (else the map\'s journey goes alone); the tab\'s Travel map is the host\'s map door; and the round is the tab\'s until the leader\'s own journey has arrived (mutants: indoors read as out, an old hub as new, nobody gathered as company, a dead Travel map, "Setting out" over a leader already there)', async () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step();
  const can = () => { const { outdoors, hub, gathered } = ann.pt.status(); return { outdoors, hub, gathered }; };
  assert.deepEqual(can(), { outdoors: true, hub: true, gathered: true }, 'a round can open: the map\'s pick is the party\'s');
  ann.outdoors = false;
  assert.equal(can().outdoors, false, 'indoors - the map opens nowhere else (the door, by source below)');
  ann.outdoors = true;
  bran.near = false;
  w.step();
  assert.equal(can().gathered, false, 'nobody gathered, as the tick counts it...');
  assert.equal(ann.pt.propose(PICK, OPTS, FARE), false, '...which is propose\'s own no: the pick would travel alone');
  bran.near = true;
  w.step();
  assert.equal(can().gathered, true);
  ann.relayOk = false;
  assert.equal(can().hub, false, 'a hub from before PARTY_TRAVEL_RELAY_MIN...');
  assert.equal(ann.pt.propose(PICK, OPTS, FARE), false, '...strips the round');
  ann.relayOk = true;
  ann.pt.openMap();
  assert.equal(ann.opened, 1, 'the tab\'s Travel map reaches the host\'s own door');
  // set out, on the road, arrived
  let arrive = null;
  ann.host.travel = (pick, opts, computed) => { ann.travels.push({ pick, opts, computed }); return new Promise((r) => { arrive = r; }); };
  assert.equal(ann.pt.propose(PICK, OPTS, FARE), true);
  w.step();
  bran.prompts[0].onYes();
  w.step();
  assert.equal(ann.pt.status().round.set, true, 'every one ready: set out');
  w.step();
  assert.equal(ann.travels.length, 1, 'on the road');
  assert.equal(ann.pt.status().round?.set, true, 'setting out, while the journey is under way');
  arrive(true);
  await flush();
  assert.ok(ann.pt.poseFields().tv, 'arrived: the round stays on the pose TRIP_FOLLOW_MS, for the followers...');
  assert.equal(ann.pt.status().round, null, '...and the tab is done with it');
});

test('AUDIT PARTY-UI session: Ready and Stay behind answer by gathered as the departure reads it - a member read gathered who stands on within the radius of where he was read is answered, and follows; one who walked out of it is refused; one who walks up is answered before the tick reads him - and the answer\'s own line is the tab\'s, a refused Ready\'s reason with it, while /travel says it once (mutants: the instant read alone, the kept read alone, the tab handed no line, /travel said twice)', () => {
  const w = partyOf(['Ann', 'Bran', 'Cyr']);
  const ann = w.c('Ann'), bran = w.c('Bran'), cyr = w.c('Cyr');
  w.step();
  bran.busy = true; cyr.busy = true;   // no boxes: the tab is how they answer
  ann.pt.propose(PICK, OPTS, FARE);
  w.step();
  assert.equal(bran.pt.status().round.gathered, true);
  bran.near = false; bran.at = { x: 10, z: 0 };   // past the leader's radius, inside the radius of where he was read gathered
  w.step();
  assert.equal(bran.pt.status().round.gathered, true, 'the tab draws Ready live...');
  assert.equal(bran.pt.respond(true), 'You are ready to travel to Wayrest.', '...and Ready answers - the instant read alone refused it');
  assert.equal(bran.lines.at(-1), 'You are ready to travel to Wayrest.', 'said in the chat too');
  cyr.pt.respond(true);
  w.step(); w.step();
  assert.equal(bran.lines.at(-1), 'The party sets out for Wayrest - you follow Ann.', 'the departure takes him: the rule Ready answers by');
  // walked out of that radius: refused, as the departure would leave him; walked back up: answered at once
  const v = partyOf(['Ann', 'Bran', 'Cyr']);
  const b = v.c('Bran');
  v.step();
  b.busy = true; v.c('Cyr').busy = true;
  v.c('Ann').pt.propose(PICK, OPTS, FARE);
  v.step();
  b.near = false; b.at = { x: 15.1, z: 0 };
  v.step();
  assert.equal(b.pt.status().round.gathered, false);
  assert.equal(b.pt.respond(true), 'Gather with Ann to travel with the party.');
  b.near = true;
  assert.equal(b.pt.status().round.gathered, false, 'back beside her - the tick has not read him yet');
  assert.equal(b.pt.respond(true), 'You are ready to travel to Wayrest.', 'with her now: answered');
  // a Ready the gold refuses is staying behind, and the tab is told why
  b.afford = false;
  assert.equal(b.pt.respond(true), `You cannot afford the journey (40 gold). ${PARTY_TRAVEL_TEXT.stay}`);
  assert.equal(b.pt.status().round.staying, true);
  const said = b.lines.length;
  assert.equal(b.pt.command('travel'), null, '/travel: the answer says its own line...');
  assert.equal(b.lines.length, said + 1, '...once');
});

test('AUDIT PARTY-UI session: the leader "elsewhere" as the session reads it - more than a pixel off on either axis, a seat that is here, never while a journey of mine is under way; indoors the tab is told why it waits; following is read; and a journey asked from the tab spends the unasked offer for that place, seen or not yet seen (mutants: a pixel\'s step read as a journey, y unread, an offline seat\'s last pose, the move unread, indoors read as out, following never, the pending offer kept, the jump left to be seen)', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step(); w.step(LEADER_SETTLE_MS); w.step();   // first sight, at my side: spent
  const away = () => bran.pt.status().away;
  ann.pose = { ...ann.pose, px: 101 };
  w.step();
  assert.equal(away(), false, 'a pixel over, walking side by side across its line: no 40-gold journey to her');
  ann.pose = { ...ann.pose, px: 100, py: 202 };
  w.step();
  assert.equal(away(), true, 'two pixels off - on y alone');
  bran.journeying = true;
  assert.equal(away(), false, 'my own journey moving me: the door\'s "The journey is off." over one that goes on');
  bran.journeying = false;
  bran.outdoors = false;
  assert.deepEqual([away(), bran.pt.status().outdoors], [true, false], 'indoors: shown, and why it waits');
  bran.outdoors = true;
  const seat = bran.social.party.members.find((m) => m.acct === 'acct-Ann');
  seat.online = false;
  assert.equal(away(), false, 'a seat the hub marked offline, its last pose still on it: nobody to travel to');
  seat.online = true;
  // P6: she journeys on; the tab's press at once, and No - the same box is not asked again LEADER_SETTLE_MS later
  ann.pose = { ...ann.pose, px: 300, py: 150, loc: 'Wayrest' };
  w.step();   // the watch reads the jump: an offer is due once her pixel holds still
  assert.equal(bran.pt.command('leader'), null, 'the box');
  const boxes = bran.prompts.length;
  bran.prompts.at(-1).onNo();
  w.step(LEADER_SETTLE_MS); w.step();
  assert.equal(bran.prompts.length, boxes, 'the No answered this place');
  ann.pose = { ...ann.pose, px: 420, py: 90, loc: 'Castle Sentinel' };
  w.exchange();   // her pose is here, and the watch has not read it
  assert.equal(bran.pt.command('leader'), null);
  bran.prompts.at(-1).onNo();
  w.step(); w.step(LEADER_SETTLE_MS); w.step();
  assert.equal(bran.prompts.length, boxes + 1, 'nor a jump the watch had yet to see');
  // following is what the tab reads as "Following"
  const f = partyOf();
  f.step();
  f.c('Ann').pt.propose(PICK, OPTS, FARE);
  f.step();
  f.c('Bran').prompts[0].onYes();
  f.step(); f.step();
  assert.equal(f.c('Bran').pt.status().following, true);
});

test('AUDIT PARTY-UI host by source: the travel map\'s door refuses indoors ITSELF - IsPlayerInside, dfuiOpenTravelMapWindow\'s first test - so the doors past the keydown ladder\'s exterior gate (the Party tab\'s Travel map, the journal\'s Find Place on the interior host) open no map on a building\'s floor (mutants: the door\'s own test dropped)', () => {
  const w = rd('src/scenes/world.js');
  const door = w.slice(w.indexOf('const toggleTravelMap = (gotoPlace = null) => {'), w.indexOf('function openTeleportMap'));
  const inside = door.indexOf("if ((modes?.mode ?? 'exterior') !== 'exterior') {");
  assert.ok(inside > 0, 'the door asks it');
  assert.ok(inside < door.indexOf('if (!travelMapDoorReady())'), 'first, as DFU asks it - ahead of the art, the enemies and the sun');
  assert.ok(inside < door.indexOf('_travelMap = buildTravelMapWindow('), 'and before the map is built');
  assert.match(w, /openMap: \(\) => toggleTravelMap\(\),/, 'the session\'s openMap - the tab\'s Travel map - is that door');
  assert.match(w, /gotoPlace: \(place\) => toggleTravelMap\(place\),/, 'as the journal\'s Find Place is');
  assert.match(w, /makeJournal: \(mode\) => makeJournalWindow\(mode\),/, 'and the interior host builds its journal here');
});

// ─── AUDIT PARTY-UI2 (2026-09-27, the second audit - of the fixes above) ─────────────────────────────────────────

test('AUDIT PARTY-UI2 session: "Travel to <leader>" hides only where the door itself would refuse - over my own journey or load (`journeying`, its "The journey is off."), never over my Travel Options walk, from which /leader goes; a neighbouring pixel stays a walk on the tab while /leader still offers the journey there (mutants: the walk read as a journey)', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step(); w.step(LEADER_SETTLE_MS); w.step();   // first sight, at my side: spent
  ann.pose = { ...ann.pose, px: 300, py: 150, loc: 'Wayrest' };
  w.step();
  bran.moving = true;   // my Travel Options walk: `moving`, and nothing the door refuses
  assert.equal(bran.pt.status().away, true, 'offered over my walk...');
  const boxes = bran.prompts.length;
  assert.equal(bran.pt.command('leader'), null, '...as /leader offers it');
  assert.equal(bran.prompts.length, boxes + 1, 'the box');
  bran.prompts.at(-1).onNo();
  bran.journeying = true;   // my own journey or load: the door's "off"
  assert.equal(bran.pt.status().away, false, 'not over my own journey');
  bran.journeying = false; bran.moving = false;
  // the leader in the neighbouring pixel: the tab's measure is more than a pixel (the first audit's 40-gold walk)
  ann.pose = { ...ann.pose, px: 101, py: 201, loc: 'Daggerfall' };
  w.step();
  assert.equal(bran.pt.status().away, false, 'a pixel over: a walk, on the tab');
  assert.equal(bran.pt.command('leader'), null, '/leader still offers it');
  assert.equal(bran.prompts.length, boxes + 2);
});

test('AUDIT PARTY-UI2 session: status() asks nobody who is gathered - the leader\'s `gathered` is the tick\'s last count however often the tab reads it (the live pass reads it twice a frame), and moves on the next tick; beside a round it carries none of the no-round flags, so a member pacing the radius under "Setting out" changes nothing the live pass keys on (mutants: the host asked live; the flags beside a round)', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step();
  let asked = 0;
  const gathered = ann.host.gathered;
  ann.host.gathered = () => { asked++; return gathered(); };
  for (let i = 0; i < 10; i++) ann.pt.status();
  assert.equal(asked, 0, 'ten readings, nobody asked');
  bran.near = false;
  assert.equal(ann.pt.status().gathered, true, 'he walked off: the tab reads the tick\'s count until the next tick');
  w.step();
  assert.equal(ann.pt.status().gathered, false);
  assert.ok(asked > 0, 'the tick asks');
  // a round that set out with nobody coming, the leader still on the road; Bran pacing the radius
  bran.near = true;
  w.step();
  bran.busy = true;   // no box: he never answers
  ann.host.travel = (pick, opts, computed) => { ann.travels.push({ pick, opts, computed }); return new Promise(() => {}); };   // a slow build
  ann.pt.propose(PICK, OPTS, FARE);
  bran.near = false;
  w.step(); w.step();
  assert.equal(ann.pt.status().round.set, true, 'nobody gathered is waiting: set out alone');
  const key = () => JSON.stringify(ann.pt.status(), (k, v) => (k === 'count' ? undefined : v));
  const first = key();
  for (let i = 0; i < 6; i++) { bran.near = i % 2 === 0; w.step(); assert.equal(key(), first, 'the same reading, crossing after crossing'); }
});

test('AUDIT PARTY-UI2 session: a round that set out is HELD for its followers - propose refuses over it until TRIP_FOLLOW_MS past its going (the tab reads `held`), so a follower still under a window follows it to its place and is never told the leader "did not set out" (mutants: a new round over a held one; held never read)', async () => {
  const w = partyOf(['Ann', 'Bran', 'Cyr']);
  const ann = w.c('Ann'), cyr = w.c('Cyr');
  w.step();
  ann.pt.propose(PICK, OPTS, FARE);
  w.step();
  w.c('Bran').prompts.at(-1).onYes(); cyr.prompts.at(-1).onYes();
  w.step(); w.step();
  assert.ok(cyr.pt.status().following);
  cyr.busy = true;   // his inventory, while the party travels
  ann.pose = { ...ann.pose, px: 300, py: 150, loc: 'Wayrest' };
  await flush();   // her journey has arrived
  w.step();
  assert.deepEqual(ann.pt.status(), { role: 'leader', round: null, outdoors: true, hub: true, gathered: true, held: true }, 'the tab is done with the round, and it is held');
  const SENTINEL = { pixel: { x: 420, y: 90 }, name: 'Castle Sentinel' };
  assert.equal(ann.pt.propose(SENTINEL, OPTS, FARE), false, 'no new round over it: the map\'s journey goes alone');
  assert.ok(ann.pt.poseFields().tv, 'the round still on her pose');
  // she goes on alone while Cyr is still under his window
  ann.pose = { ...ann.pose, px: 420, py: 90, loc: 'Castle Sentinel' };
  w.step(2000);
  cyr.busy = false;
  for (let i = 0; i < 2 * TRIP_FOLLOW_MS / PARTY_TRIP_TICK_MS && !cyr.travels.length; i++) w.step();
  assert.ok(!cyr.lines.some((l) => l.includes('did not set out')), 'never told she did not set out - she did');
  assert.deepEqual(cyr.travels.map((t) => t.pick.pixel), [{ x: 300, y: 150 }], 'he follows the round to its place');
  w.step(TRIP_FOLLOW_MS);
  assert.equal(ann.pt.status().held, false, 'TRIP_FOLLOW_MS past its going: let go');
  assert.equal(ann.pt.propose(PICK, OPTS, FARE), true, 'and a round opens again');
});

test('AUDIT PARTY-UI2 host by source: the map door SAYS it indoors - "You cannot travel while indoors.", DFU\'s cannotTravelIndoors through AddHUDText (townTalk.say here) - and the journal\'s Find Place target is armed before the refusals and taken by the next map to open, as DFU\'s GotoPlace is (mutants: the door silent; the words drifted; the target dropped by a refusal)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const CANNOT_TRAVEL_INDOORS_TEXT = 'You cannot travel while indoors\.';/, 'Internal_Strings.csv cannotTravelIndoors, verbatim');
  const door = w.slice(w.indexOf('const toggleTravelMap = (gotoPlace = null) => {'), w.indexOf('function openTeleportMap'));
  assert.match(door, /if \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) \{ townTalk\.say\(CANNOT_TRAVEL_INDOORS_TEXT\); return false; \}/, 'said, then refused');
  const arm = door.indexOf('if (gotoPlace) _travelGoto = gotoPlace;');
  assert.ok(arm > 0 && arm < door.indexOf('CANNOT_TRAVEL_INDOORS_TEXT'), 'armed before the first refusal');
  assert.match(door, /if \(_travelGoto\) \{ _travelMap\.gotoPlace\(_travelGoto\); _travelGoto = null; \}/, 'taken by the map that opens');
  assert.ok(door.indexOf('_travelMap.gotoPlace(_travelGoto)') > door.indexOf('_travelMap = buildTravelMapWindow('), '...once one has been built');
  assert.equal((door.match(/_travelGoto = null/g) ?? []).length, 1, 'and let go nowhere else - a refused open keeps it');
  assert.match(w, /let _travelGoto = null;\n\s*const toggleTravelMap = /, 'one target, kept beside the door across opens');
});

// PARTY-READY (2026-10-01, Mac: "Also when party readying up, the ui element is hidden"): the ready-up stays on screen.
test('PARTY-READY session: THE LEADER\'S WAIT STANDS THE ROUND - the HUD label for the round\'s minute, not the host\'s four seconds; set again only as the count moves (every label is a notebook line), for what is left of it; the set-out, a call-off or a lapse says its own line over it (mutants: the wait for the host\'s default, set every tick, never moved, left standing over the outcome)', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  w.step();
  assert.equal(ann.pt.propose(PICK, OPTS, FARE), true);
  assert.equal(ann.mids.at(-1), 'Waiting for the party to ready up (1/2 ready).');
  assert.equal(ann.midSecs.at(-1), PARTY_READY_TIMEOUT_MS / 1000, 'for the round\'s whole minute');
  const n = ann.mids.length;
  w.step(); w.step();
  assert.equal(ann.mids.length, n, 'the count unmoved: set no more');
  bran.prompts[0].onYes();
  w.step();
  assert.deepEqual(ann.mids.slice(n), ['Waiting for the party to ready up (2/2 ready).', 'The party sets out for Wayrest.'], 'the count moved, then the round set out over it');
  assert.equal(ann.midSecs[n], (PARTY_READY_TIMEOUT_MS - 3 * PARTY_TRIP_TICK_MS) / 1000, 'for what was left of the round');
  assert.equal(ann.midSecs[n + 1], undefined, 'the outcome for the host\'s own short while');
  // called off from the tab or the chat
  const off = partyOf();
  off.step();
  off.c('Ann').pt.propose(PICK, OPTS, FARE);
  assert.equal(off.c('Ann').pt.command('travel'), 'You call off the journey.');
  assert.equal(off.c('Ann').mids.at(-1), 'You call off the journey.', 'over the wait');
  // lapsed, unanswered
  const late = partyOf();
  late.step();
  late.c('Ann').pt.propose(PICK, OPTS, FARE);
  late.step(PARTY_READY_TIMEOUT_MS + PARTY_TRIP_TICK_MS);
  assert.ok(late.c('Ann').mids.length >= 2 && late.c('Ann').mids.at(-1) === late.c('Ann').lines.at(-1), `the lapse said over it: ${late.c('Ann').mids.at(-1)}`);
});

test('PARTY-READY session: A MEMBER WITH THE PARTY TAB OPEN ANSWERS THERE - no box over the tab that asks it already (the box paused the game, and the pause took the tab and the party\'s HUD out of the page as the ready-up began), nor a line to type what it offers; the tab\'s Ready answers; closed unanswered, the box asks (mutants: the box over the tab, the round marked asked under it)', () => {
  const w = partyOf();
  const ann = w.c('Ann'), bran = w.c('Bran');
  bran.tab = true;
  w.step();
  ann.pt.propose(PICK, OPTS, FARE);
  w.step(); w.step();
  assert.equal(bran.prompts.length, 0, 'no box over the tab');
  assert.ok(!bran.lines.some((l) => l.includes('/travel')), 'nor a line to type what the tab offers');
  assert.equal(bran.pt.status().round.gathered, true, 'the tab can answer it');
  assert.equal(bran.pt.respond(true), 'You are ready to travel to Wayrest.');
  const shut = partyOf();
  shut.c('Bran').tab = true;
  shut.step();
  shut.c('Ann').pt.propose(PICK, OPTS, FARE);
  shut.step();
  assert.equal(shut.c('Bran').prompts.length, 0);
  shut.c('Bran').tab = false;
  shut.step();
  assert.equal(shut.c('Bran').prompts.length, 1, 'the tab closed unanswered: the box asks');
});

test('PARTY-READY host by source: the wait\'s seconds reach the HUD\'s label, and the session reads the Party tab open (mutants: the seconds dropped at the seam, the tab never read)', () => {
  const w = rd('src/scenes/world.js');
  const host = w.slice(w.indexOf('partyTravel = createPartyTravel({'), w.indexOf('poseDirty: () => { _partyComposedAt = -Infinity; },'));
  assert.match(host, /mid: \(text, seconds = PARTY_REST_FAR_SECONDS\) => setMidScreenText\(text, seconds\),/);
  assert.match(host, /tabOpen: \(\) => !!socialPanel\?\.isOpen\?\.\(\) && socialPanel\.tab\(\) === 'party',/);
});
