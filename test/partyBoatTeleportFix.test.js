// BUG-PARTY-BOAT-TP-01 candidate integration, over actual source arrival statements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPartyTravel } from '../src/systems/partyTravel.js';
import { BESIDE_LEVEL } from '../src/systems/partyTravelLaw.js';
import { partyArrivalBeside, waitForPartyArrival, PartyArrivalUnavailable } from '../src/systems/partyArrival.js';
import { validPartyPose, PIXEL_UNITS } from '../src/net/wire.js';
import { floorLanding, openGroundNear, heldInSolid } from '../src/player/enterExit.js';   // UNSTUCK-OUT (PIN MOVED): the landing's rock check rides the lifted block
import { StreamingWorldState } from '../src/world/streamingWorld.js';
import { rig, HULL_NAMES, boardPlaceOf, raycastColliders, FLOOR, SEA, FIXED_DT, IDLE } from './partyBoatTeleportRig.mjs';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
function between(start, end) {
  const a = WORLD.indexOf(start), b = WORLD.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Source extraction failed: ${start}`);
  return WORLD.slice(a, b);
}
const partyLandingSource = between('  function partyBesideLanding(w, seat = 0) {', '  // TL2: a floor');
const initialLandingSource = between('    const wantsLanding = reposition ===', '    // Q4-v: StreamingWorld.OnInitWorld');

const X = 300, Y = 150;
const state = new StreamingWorldState();
state.init(X, Y);

// Execute the exact post-build arrival and party correction statements from
// world.js. The world-build boundary is injected: terrain is ready; peer hull
// collision may be ready, delayed, or at an older network position.
function landingHost(r, onWait = () => {}) {
  const body = `
    const { collider, player, cam, floorLanding, openGroundNear, heldInSolid, partyArrivalBeside, state, waitForPartyArrival, onWait } = deps;
    const ARRIVAL_REACH = 240, ARRIVAL_LIFT = 40;
    const OBSTRUCTED_ABOVE = 3, TERRAIN_SIZE = 819.2, walkMode = true;
    const tvSeaY = () => 0;
    const REPOSITION = { RandomStartMarker: 1, DirectionFromStartMarker: 2 };
    const reposition = 2, travelStart = null, localPos = null, grounded = false;
    const px = ${X}, py = ${Y}, dest = { centerHeight: ${FLOOR} };
    const locationLandingFor = () => null;
    let playerSpawned = false;
    ${partyLandingSource}
    return async (pick) => {
      const resolveArrival = () => waitForPartyArrival(() => partyBesideLanding(pick.besideAt(), pick.besideSeat),
        { wait: async () => onWait(), now: () => 0 });
      ${initialLandingSource}
      return { final: [...player.pos], target: pick.besideAt(), beside: true };
    };`;
  return new Function('deps', body)({ collider: r.colliders.exterior, player: r.player, cam: r.cam,
    floorLanding, openGroundNear, heldInSolid, partyArrivalBeside, state, waitForPartyArrival, onWait });
}

function partyJourney(deck) {
  const leader = { acct: 'ann', name: 'Ann', online: true, peers: ['ann-peer'], p: null };
  const setFeet = (feet, extra = {}) => {
    const wc = state.worldCoords(feet);
    leader.p = validPartyPose({ px: X, py: Y, in: 0, loc: 'Open sea', h: 100, hm: 100,
      f: 100, fm: 100, m: 50, mm: 50, wx: wc.x, wy: feet[1], wz: wc.z, ...extra });
    assert.ok(leader.p, 'real party wire accepts leader pose');
  };
  setFeet(deck);
  const social = { acct: 'me', party: { id: 'test', leader: 'ann', members: [leader, { acct: 'me' }] }, now: () => 1800000000000 };
  let prompt, pick;
  const host = { social: () => social, outdoors: () => true, here: () => ({ x: 100, y: 200 }),
    busy: () => false, refusal: () => null, myToggles: () => ({}),
    fare: () => ({ afford: true, computed: { totalCost: 0 }, opts: {} }),
    placeName: () => 'Open sea', prompt: (rows, yes) => { prompt = { rows, yes }; return prompt; },
    closePrompt() {}, say() {}, travel: (p) => { pick = p; return Promise.resolve(true); } };
  const session = createPartyTravel(host);
  assert.equal(session.command('leader'), null, 'actual /leader command offers travel');
  assert.ok(prompt.rows[0].includes('Ann'), 'leader named in confirmation');
  prompt.yes();
  assert.ok(pick?.besideAt, 'real journey carries destination reader');
  return { pick, setFeet, leader, prompt };
}

async function fixture(hull, ready = true) {
  const r = await rig({ hull, mine: false });
  r.hers.GameObject.position = [100, 0, 100];
  const trigger = boardPlaceOf(r.hers.BoardTriggers[0]);
  const hit = raycastColliders(r.hers.GameObject,
    [trigger.position[0], trigger.position[1] + 1, trigger.position[2]],
    [0, -1, 0], 6, { triggers: false, geometry: r.geometry });
  assert.ok(hit?.point, `${HULL_NAMES[hull]} has real deck geometry`);
  r.w.sync();
  r.player.spawn(hit.point[0], hit.point[1] + 0.02, hit.point[2]);
  for (let frame = 0; frame < 60; frame++) r.player.update(FIXED_DT, IDLE, 0);
  assert.ok(r.player.grounded && String(r.player.groundKey).startsWith(r.keyOf(r.hers)), 'leader pose is physically standing on real boat collision');
  const deck = [...r.player.pos];
  if (!ready) {
    for (const key of [...r.colliders.exterior._buckets.keys()]) r.colliders.exterior.removeBucket(key);
    r.w.buckets.clear();
  }
  const journey = partyJourney(deck);
  return { r, journey, deck, land: landingHost(r) };
}

function observe(name, result, deck) {
  console.log('OBSERVATION ' + JSON.stringify({ name, seaY: SEA, seabedY: FLOOR, deck, ...result }));
}

for (let hull = 0; hull < HULL_NAMES.length; hull++) {
  test(`CONTROL: ready ${HULL_NAMES[hull]} deck accepts party arrival`, async () => {
    const { journey, deck, land } = await fixture(hull);
    const result = await land(journey.pick);
    observe(`ready-${HULL_NAMES[hull]}`, result, deck);
    assert.equal(result.beside, true);
    assert.ok(Math.abs(result.final[1] - deck[1]) <= BESIDE_LEVEL, 'on deck level');
    assert.ok(result.final[1] > FLOOR + 10, 'not on seabed');
  });
}

for (const name of ['Small Ship', 'Carrack']) {
  test(`SAFETY: missing ${name} deck cannot commit ocean-floor arrival`, async () => {
    const { r, journey, land } = await fixture(HULL_NAMES.indexOf(name), false);
    const before = [...r.player.pos];
    await assert.rejects(land(journey.pick), PartyArrivalUnavailable);
    assert.deepEqual([...r.player.pos], before, 'unvalidated destination was never spawned');
  });
}

test('SAFETY: stale boat collision must not commit', async () => {
  const { r, journey, deck, land } = await fixture(HULL_NAMES.indexOf('Small Ship'));
  journey.setFeet([deck[0] + 80, deck[1], deck[2]]);
  const before = [...r.player.pos];
  await assert.rejects(land(journey.pick), PartyArrivalUnavailable);
  assert.deepEqual([...r.player.pos], before);
});

test('SAFETY: leader changes pixel during build', async () => {
  const { r, journey, deck, land } = await fixture(HULL_NAMES.indexOf('Small Ship'));
  journey.setFeet(deck, { px: X + 1, wx: state.worldCoords(deck).x + PIXEL_UNITS });
  const before = [...r.player.pos];
  assert.equal(journey.pick.besideAt(), null);
  await assert.rejects(land(journey.pick), PartyArrivalUnavailable);
  assert.deepEqual([...r.player.pos], before);
});

for (const name of ['Small Ship', 'Carrack']) {
  test(`CONTROL: loaded moved ${name} and fresh leader position agree`, async () => {
    const { r, journey, deck, land } = await fixture(HULL_NAMES.indexOf(name));
    const p = r.hers.GameObject.position;
    r.hers.GameObject.position = [p[0] + 80, p[1], p[2]];
    r.w.sync();
    journey.setFeet([deck[0] + 80, deck[1], deck[2]]);
    const result = await land(journey.pick);
    observe(`moved-and-synced-${name}`, result, deck);
    assert.equal(result.beside, true);
    assert.ok(result.final[0] > 150 && result.final[1] > FLOOR + 10);
  });
}

test('RECOVERY: delayed boat collision loads during bounded wait', async () => {
  const { r, journey } = await fixture(HULL_NAMES.indexOf('Small Ship'), false);
  let waits = 0;
  const land = landingHost(r, () => { if (++waits === 2) r.w.sync(); });
  const result = await land(journey.pick);
  assert.equal(waits, 2);
  assert.ok(result.final[1] > 4, 'waited for deck, then landed on it');
});

test('RECOVERY: moving boat catches up to leader pose during wait', async () => {
  const { r, journey, deck } = await fixture(HULL_NAMES.indexOf('Carrack'));
  journey.setFeet([deck[0] + 80, deck[1], deck[2]]);
  const land = landingHost(r, () => {
    r.hers.GameObject.position = [180, 0, 100]; r.w.sync();
  });
  const result = await land(journey.pick);
  assert.ok(result.final[0] > 180 && result.final[1] > 3);
});
