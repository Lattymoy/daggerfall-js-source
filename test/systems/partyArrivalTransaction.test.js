import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deductGold, deductGoldPieces } from '../../src/systems/court.js';
import { StreamingWorldState } from '../../src/world/streamingWorld.js';
import { waitForPartyArrival, PartyArrivalUnavailable, PARTY_ARRIVAL_TEXT, createPartyArrival, besideLeaderLanding } from '../../src/systems/party/partyArrival.js';
import { BESIDE_OFFSETS } from '../../src/systems/party/partyTravelLaw.js';
import { rig, HULL_NAMES } from '../partyBoatTeleportRig.mjs';

const source = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const start = source.indexOf('  async function fastTravelTo(');
assert.ok(start >= 0);
const travelSource = source.slice(start, source.indexOf('\n  }\n', start) + 5);

function host({ safe = true, target = true, failBuild = false, boat = false, ownBoat = false, dry = false, preThrows = false, postThrows = false, besideAfter = 0 } = {}) {
  const events = [], lines = [], commits = [];
  const state = new StreamingWorldState(); state.init(100, 200);
  const player = { pos: [20, 12, 30], spawn(x, y, z) { this.pos = [x, y, z]; commits.push([...this.pos]); } };
  const entity = { goldPieces: 100, items: [], health: 50, maxHealth: 100, career: {} };
  const cam = { pos: [...player.pos], yaw: 0.3 };
  const originBoat = boat || ownBoat ? {} : null;
  const destination = { pos: [140, 5, 130], yaw: 1, groundKey: 'csaBoat:1:hull' };
  let advances = 0, failures = 0, waits = 0, besideProbes = 0;
  const no = () => {};
  const deps = {
    worldMoveBusy: () => false, _traveling: false, walkMode: true,
    wildTravelGate: () => ({ ok: true, fee: 0 }), wildTravelPaid: no,   // WILD3: the open zone off (wildJourney's answer with no mask) - every journey goes, no fee
    playerTravelPixel: () => ({ ...state.current }), state, player, cam,
    csaBoatUnderMe: () => originBoat, csaLocalOf: () => [2, 3, 4], csaDeckPose: (b) => b,
    _partyTravelOriginBoat: null, _partyArrivalPending: false,
    hccRuntimeOn: () => ({ handlePreFastTravel: () => { if (preThrows) throw new Error('pre'); events.push('pre'); }, handlePostFastTravel: () => { events.push('post'); if (postThrows) throw new Error('post'); } }),
    navalStow: no, csaRuntime: { OnPreFastTravel: () => events.push('pack'), StopSailing: () => events.push('stop-sailing'), OnPostFastTravel: no },
    csaCall: (f) => f(), deductGoldPieces, deductGold, playerEntity: entity,
    warmAshesOn: () => false, warmAshesPreTravel: no, isOnShip: () => false, cacheExteriorScene: no,
    _teleportToPixel: async (x, y, local, opts) => {
      events.push(`build:${x}`); state.init(x, y);
      if (failBuild && failures++ === 0) throw new Error('injected world load failure');
      const landing = opts.resolveArrival ? await opts.resolveArrival([409, dry ? 10 : -30, 409]) : { pos: [409, 10, 409] };
      player.spawn(...landing.pos); if (landing.yaw != null) cam.yaw = landing.yaw;
    },
    sharedClockOn: () => true, skyMinutes: () => 1000, worldMinutes: () => 1000,
    getLocalizedLocationName: (mapId, name) => name,   // L10N3e: the arrival line's place as shown - English here
    REPOSITION: { DirectionFromStartMarker: 1 },
    csaPeers: { frame: no }, csaSyncColliders: no,
    // PARTY-FOLLOW: the arrival's own law (systems/party/partyArrival.js), over fake landings and a stepped clock
    partyLanding: createPartyArrival({
      besideLanding: () => { besideProbes++; return safe && besideProbes > besideAfter ? destination : null; },   // `besideAfter`: the probes on which no spot beside the leader holds a body yet
      supportedLanding: (pos) => (pos[1] >= 0 ? { pos } : null),
      sync: no,
      waiting: (line) => lines.push(line),
      clock: { now: () => waits * 100, wait: async () => { waits++; } },
    }),
    collider: {}, tvSeaY: () => 0, townTalk: { say: (s) => lines.push(s) }, PARTY_ARRIVAL_TEXT,
    csaWorldOf: () => [22, 15, 34], csaAboard: { board: (b) => events.push(b === originBoat ? 'board-origin' : 'board-target') },
    CSA_ABOARD_GRACE: 3, hudFade: { clearFade: () => events.push('clear'), fadeHUDFromBlack: no },
    PartyArrivalUnavailable, console: { warn: no }, csa: { peerBoats: ownBoat ? [] : [{}], boats: ownBoat ? [originBoat] : [] }, csaBoatId: () => 1,
    maxFatigue: () => 100, hasSpecialAbility: () => false, SPECIAL_ABILITY: { NoRegenSpellPoints: 1 },
    setSyntheticTimeIncrease: no, playerTicker: { advance: () => { advances++; }, classicMinutes: 1000, ownMinutes: 1000 },
    weatherOverride: true, tickWeather: no, maps: {}, applyClimateWeather: no, fieldXZ: no, climateAt: no,
    currentWeather: no, weather: null, applyWeather: no, arrivalClampMinutes: () => 0,
    racialSunAverse: () => false, careerSunAverse: () => false, _lastEncMinutes: 0,
    raisePlayerSkills: no, ActionTextBox: class {}, YesNoBoxWindow: class {}, announceLevelUp: no,
    makeCharSheetWindow: no, setCrimeCommitted: () => events.push('crime-cleared'), CRIMES: { None: 0 },
    arrestFlow: { crimeCleared: no }, warmAshesPostTravel: no,
    wagonRiders: null, GO_LEAD_MS: 0, _hccDirty: false, _goLeadBusy: false,   // WAGONS1: no rider in my wagon's back - a journey sets out at once; WAGONS2: no journey telling its riders
    hccOn: () => true, hasTransport: () => false, TRANSPORT_SMALL_CART: 1, upkeep: { journey: () => events.push('wagon-worn') }, travelDays: () => 1,   // WAGONS4: no wagon on the journey - none worn
  };
  // Execute the complete production travel function, with explicit host seams.
  const api = new Function(...Object.keys(deps), travelSource + '\nreturn { run: fastTravelTo, flags: () => [_traveling, _partyArrivalPending, _partyTravelOriginBoat] };')(...Object.values(deps));
  const pick = { pixel: { x: 300, y: 150 }, name: 'Open sea', besideText: 'Joined leader.', besideMissedText: 'Not beside the leader.', besideAt: () => target ? { x: 1, y: 5, z: 2 } : null, besideSeat: 0 };
  return { ...api, pick, entity, player, cam, events, lines, commits, counts: () => ({ advances, waits }) };
}
const fare = { piecesCost: 5, totalCost: 20, minutes: 100 };

test('TRANSACTION: success charges exactly once after supported arrival and attaches guest', async () => {
  const h = host();
  assert.equal(await h.run(h.pick, {}, fare), true);
  assert.deepEqual(h.commits, [[140, 5, 130]]);
  assert.equal(h.entity.goldPieces, 80);
  assert.equal(h.counts().advances, 1);
  assert.deepEqual(h.flags(), [false, false, null]);
  assert.ok(h.events.includes('board-target'));
  assert.equal(h.events.filter((e) => e === 'pack').length, 1);
  assert.ok(h.events.indexOf('pack') > h.events.indexOf('build:300'));
});

for (const options of [{ safe: false }, { target: false }, { failBuild: true }]) {
  test(`TRANSACTION: failure restores departure without fare/time/heal/crime changes ${JSON.stringify(options)}`, async () => {
    const h = host(options);
    assert.equal(await h.run(h.pick, { speedCautious: true }, fare), false);
    assert.deepEqual(h.commits, [[20, 12, 30]], 'no seabed spawn before the return');
    assert.equal(h.entity.goldPieces, 100);
    assert.equal(h.entity.health, 50);
    assert.equal(h.counts().advances, 0);
    assert.ok(!h.events.includes('pack') && !h.events.includes('crime-cleared'));
    assert.equal(h.lines.at(-1), PARTY_ARRIVAL_TEXT.returned);
    assert.deepEqual(h.flags(), [false, false, null]);
    assert.equal(h.events.filter((e) => e === 'post').length, 1);
  });
}

test('TRANSACTION: guest rollback uses its retained hull frame', async () => {
  const h = host({ safe: false, boat: true });
  assert.equal(await h.run(h.pick, {}, fare), false);
  assert.deepEqual(h.commits, [[22, 15, 34]]);
  assert.ok(h.events.includes('board-origin'));
  assert.equal(h.entity.goldPieces, 100);
});

test('TRANSACTION: ordinary fast travel retains the existing fare and arrival behavior', async () => {
  const h = host(); delete h.pick.besideAt;
  assert.equal(await h.run(h.pick, {}, fare), true);
  assert.equal(h.entity.goldPieces, 80);
  assert.deepEqual(h.commits, [[409, 10, 409]]);
  assert.ok(h.events.indexOf('pack') < h.events.indexOf('build:300'));
  assert.equal(h.counts().waits, 0);
});

test('RETRY: the cap terminates even with a stalled clock', async () => {
  let polls = 0, waits = 0, notices = 0;
  await assert.rejects(waitForPartyArrival(() => { polls++; return null; }, {
    now: () => 0, wait: async () => { waits++; }, onWait: () => { notices++; },
  }), PartyArrivalUnavailable);
  assert.equal(polls, 41); assert.equal(waits, 40); assert.equal(notices, 1);
});

test('RETENTION: departed guest hull survives room clear and origin shift, then is released', async () => {
  const r = await rig({ hull: HULL_NAMES.indexOf('Small Ship'), mine: false });
  let keep = true;
  r.peers.setKeepAboard((b) => keep && b === r.hers);
  r.peers.clearPeers(); r.peers.frame(0);
  assert.ok(r.pool.peerBoats.includes(r.hers));
  assert.deepEqual(r.peers.placeOf(r.hers), { owner: 'ann', slot: 0 });
  r.peers.rebase([40, 5, 60]); r.peers.frame(0);
  assert.deepEqual(r.hers.GameObject.position, [40, 5, 60]);
  keep = false; r.peers.frame(0);
  assert.ok(!r.pool.peerBoats.includes(r.hers));
});

for (const options of [{ preThrows: true }, { safe: false, postThrows: true }]) {
  test(`TRANSACTION: a throwing companion hook releases every hold ${JSON.stringify(options)}`, async () => {
    const h = host(options);
    await assert.rejects(h.run(h.pick, {}, fare), options.preThrows ? /pre/ : /post/);
    assert.deepEqual(h.flags(), [false, false, null]);
    assert.equal(h.entity.goldPieces, 100);
  });
}

test('TRANSACTION: safe dry fallback preserves travel when the leader cannot be reached', async () => {
  const h = host({ safe: false, dry: true });
  assert.equal(await h.run(h.pick, {}, fare), true);
  assert.deepEqual(h.commits, [[409, 10, 409]]);
  assert.equal(h.entity.goldPieces, 80);
  assert.equal(h.counts().waits, 40, 'PARTY-FOLLOW: only once the whole wait found no spot beside the leader');
  assert.equal(h.lines.at(-1), 'Not beside the leader.', 'PARTY-FOLLOW: and the arrival says so');
});

test('PARTY-FOLLOW TRANSACTION: a leader with no spot beside them for a moment (mid-jump, knocked back in a fight) is waited for - the follower lands beside them, never at the place\'s own arrival, which the first check took (mutants: the fallback on the first check; the fallback never taken)', async () => {
  const h = host({ dry: true, besideAfter: 3 });
  assert.equal(await h.run(h.pick, {}, fare), true);
  assert.deepEqual(h.commits, [[140, 5, 130]], 'beside the leader');
  assert.equal(h.counts().waits, 3);
  assert.equal(h.lines.at(-1), 'Joined leader.');
});

test('PARTY-FOLLOW TRANSACTION: with no leader in the pixel\'s open air there is nobody to wait for - the place\'s own arrival at once, said as not beside them', async () => {
  const h = host({ target: false, dry: true });
  assert.equal(await h.run(h.pick, {}, fare), true);
  assert.deepEqual(h.commits, [[409, 10, 409]]);
  assert.equal(h.counts().waits, 0);
  assert.equal(h.lines.at(-1), 'Not beside the leader.');
});

test('PARTY-FOLLOW RETRY: the probe is told which attempt is its last - on the cap, and on a clock past the wait', async () => {
  const byCap = [];
  await assert.rejects(waitForPartyArrival((last) => { byCap.push(last); return null; }, { now: () => 0, wait: async () => {} }), PartyArrivalUnavailable);
  assert.equal(byCap.length, 41);
  assert.equal(byCap.filter(Boolean).length, 1);
  assert.equal(byCap.at(-1), true);
  let clock = 0;
  const byClock = [];
  const landing = await waitForPartyArrival((last) => { byClock.push(last); return last ? { pos: [0, 0, 0] } : null; }, { now: () => clock, wait: async () => { clock += 3000; } });
  assert.deepEqual(landing, { pos: [0, 0, 0] });
  assert.deepEqual(byClock, [false, false, true], 'the wait spent after two polls: the third is the last');
});

test('TRANSACTION: joining a leader on my own departure hull never packs away the arrival floor', async () => {
  const h = host({ ownBoat: true });
  assert.equal(await h.run(h.pick, {}, fare), true);
  assert.ok(!h.events.includes('pack'));
  assert.ok(h.events.includes('stop-sailing'));
  assert.deepEqual(h.commits, [[140, 5, 130]]);
});

test('PARTY-FOLLOW arrivalLine: beside the leader the pick\'s own line; a party arrival not beside them its "no room" line; anything else the ordinary line (mutants: the missed line dropped)', () => {
  const { arrivalLine } = createPartyArrival({ besideLanding: () => null, supportedLanding: () => null, sync: () => {}, waiting: () => {} });
  const pick = { besideAt: () => null, besideText: 'You join Ann at Wayrest.', besideMissedText: 'There was no room beside Ann. You arrive at Wayrest.' };
  const landing = { pos: [0, 0, 0] };
  assert.equal(arrivalLine(pick, true, landing, 'You arrive at Wayrest.'), 'You join Ann at Wayrest.');
  assert.equal(arrivalLine(pick, true, null, 'You arrive at Wayrest.'), 'There was no room beside Ann. You arrive at Wayrest.');
  assert.equal(arrivalLine(pick, false, null, 'You arrive at Wayrest.'), 'You arrive at Wayrest.', 'not a party arrival: the ordinary line');
  assert.equal(arrivalLine({ besideAt: () => null }, false, null, 'You arrive at Wayrest.'), 'You arrive at Wayrest.', 'an ordinary journey');
});

test('PARTY-FOLLOW besideLeaderLanding: the leader\'s feet into this scene\'s frame, and the follower\'s seat is where the ring search starts (mutants: the seat dropped)', () => {
  const state = new StreamingWorldState();
  state.init(300, 150);
  const wc = state.worldCoords([10, 0, 20]);
  const feet = { x: wc.x, y: 5, z: wc.z };
  // An open, level floor: nothing in the way, and the capsule stands wherever it is put.
  const collider = { raycast: () => Infinity, move: () => ({ grounded: true, hitCeiling: false, groundKey: null }) };
  const first = besideLeaderLanding(feet, 0, state, collider, -100);
  const second = besideLeaderLanding(feet, 1, state, collider, -100);
  const leaderY = 5 + state.compensation[1];
  assert.deepEqual(first.pos.map((v) => Math.round(v * 1000) / 1000), [10 + BESIDE_OFFSETS[0][0], leaderY, 20 + BESIDE_OFFSETS[0][1]].map((v) => Math.round(v * 1000) / 1000));
  assert.deepEqual(second.pos.map((v) => Math.round(v * 1000) / 1000), [10 + BESIDE_OFFSETS[1][0], leaderY, 20 + BESIDE_OFFSETS[1][1]].map((v) => Math.round(v * 1000) / 1000), 'seat 1 starts at the ring\'s second spot');
});
