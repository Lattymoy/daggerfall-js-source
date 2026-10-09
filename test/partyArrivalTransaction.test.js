import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deductGold, deductGoldPieces } from '../src/systems/court.js';
import { StreamingWorldState } from '../src/world/streamingWorld.js';
import { waitForPartyArrival, PartyArrivalUnavailable, PARTY_ARRIVAL_TEXT } from '../src/systems/partyArrival.js';
import { rig, HULL_NAMES } from './partyBoatTeleportRig.mjs';

const source = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const start = source.indexOf('  async function fastTravelTo(');
assert.ok(start >= 0);
const travelSource = source.slice(start, source.indexOf('\n  }\n', start) + 5);

function host({ safe = true, target = true, failBuild = false, boat = false, ownBoat = false, dry = false, preThrows = false, postThrows = false } = {}) {
  const events = [], lines = [], commits = [];
  const state = new StreamingWorldState(); state.init(100, 200);
  const player = { pos: [20, 12, 30], spawn(x, y, z) { this.pos = [x, y, z]; commits.push([...this.pos]); } };
  const entity = { goldPieces: 100, items: [], health: 50, maxHealth: 100, career: {} };
  const cam = { pos: [...player.pos], yaw: 0.3 };
  const originBoat = boat || ownBoat ? {} : null;
  const destination = { pos: [140, 5, 130], yaw: 1, groundKey: 'csaBoat:1:hull' };
  let advances = 0, failures = 0, waits = 0;
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
    REPOSITION: { DirectionFromStartMarker: 1 },
    waitForPartyArrival: (probe, opts) => waitForPartyArrival(probe, { ...opts, now: () => waits * 100, wait: async () => { waits++; } }),
    csaPeers: { frame: no }, csaSyncColliders: no,
    partyBesideLanding: (w) => safe && w ? destination : null,
    supportedPartyPosition: (col, pos) => pos[1] >= 0 ? { pos } : null,
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
    wagonRiders: null, GO_LEAD_MS: 0, _hccDirty: false,   // WAGONS1: no rider in my wagon's back - a journey sets out at once
  };
  // Execute the complete production travel function, with explicit host seams.
  const api = new Function(...Object.keys(deps), travelSource + '\nreturn { run: fastTravelTo, flags: () => [_traveling, _partyArrivalPending, _partyTravelOriginBoat] };')(...Object.values(deps));
  const pick = { pixel: { x: 300, y: 150 }, name: 'Open sea', besideText: 'Joined leader.', besideAt: () => target ? { x: 1, y: 5, z: 2 } : null, besideSeat: 0 };
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
});

test('TRANSACTION: joining a leader on my own departure hull never packs away the arrival floor', async () => {
  const h = host({ ownBoat: true });
  assert.equal(await h.run(h.pick, {}, fare), true);
  assert.ok(!h.events.includes('pack'));
  assert.ok(h.events.includes('stop-sailing'));
  assert.deepEqual(h.commits, [[140, 5, 130]]);
});
