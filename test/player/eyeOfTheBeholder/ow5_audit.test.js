// AUDIT OW5 (2026-09-29, Mac: "Before we merge. Can we do a comprehensive audit on the overworld, just want to make sure
// it's perfect.") - the Overworld audited again before the merge, seven lenses, each finding verified before it was
// fixed (bible/06-Systems/Travel-View.md, AUDIT OW5). Pinned here, each on the host's own source where it can be run:
// the find's own uncapped list (D1), the raiders held under a window (R1), the ocean stop stood down for the crossing
// alone (S1), a jump stopping a route's walk (J2), the Overworld's lines held at the clock's scale (G2), a lock granted
// after the cursor was freed let go (V1), the head's activation keys never pressed from under the view (V2), and a door's
// POV row kept over the view's hold (V3). The rest are pinned beside their own suites (tv7, tv8, tv_wasd, ow_toggle,
// eotb_body, ows2/3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nearDungeons, dungeonToFind, dungeonApproach, pixelBox, NATIVE_PER_M, TV_DUNGEON_MAX } from '../../../src/systems/travel/travelDungeons.js';
import { chaseStep as raiderChaseStep, RAIDER_CONTACT_M, RAIDER_CONTACT_PLAY_M, NATIVE_PIXEL as RAID_NATIVE_PIXEL } from '../../../src/systems/seaRaiders.js';
import { AUTO_TOGGLE } from '../../../src/player/eyeOfTheBeholder/eotbBillboard.js';
import { planRoute, routeLegs, crossesWater } from '../../../src/systems/travel/travelRoute.js';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
// PIN MOVED (HOST-SPLIT 1, 2026-10-15): the Overworld's marks left world.js for scenes/travelViewMarks.js
const TVM = readFileSync(new URL('../../../src/scenes/travelViewMarks.js', import.meta.url), 'utf8');

/** One of world.js's functions, by name: a one-line declaration, or up to its closing brace at the host's indent. */
function fnSource(name) {
  const at = WORLD.indexOf(`  function ${name}(`);
  assert.ok(at >= 0, `world.js declares ${name}`);
  const eol = WORLD.indexOf('\n', at);
  if (WORLD.slice(at, eol).trimEnd().endsWith('}')) return WORLD.slice(at, eol);
  return WORLD.slice(at, WORLD.indexOf('\n  }\n', at) + 4);
}
const mount = (env, body) => { const names = Object.keys(env); return new Function(...names, body)(...names.map((k) => env[k])); };

test('AUDIT OW5 D1: the find asks every unfound dungeon in reach - a dozen found about the traveller no longer hides the one within a kilometre (the plates\' list keeps TV_DUNGEON_MAX, the found first)', () => {
  // twelve found dungeons about the traveller, a dozen within the find's own reach (a crowd: the uncapped law), and one
  // unfound two pixels east - past the plates' grid of one (inside it, AUDIT OW5b D1 plates an unfound one beside the
  // twelve, so the plates would hold it), within the find's kilometre of feet at the east edge of their pixel
  const rows = [];
  const ring = [];   // past the grid (TV2's plates stand within it) and within the find's reach
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) >= 2 && Math.hypot(dx, dy) <= 4) ring.push([dx, dy]);
  for (let i = 0; i < 12; i++) rows.push({ x: 100 + ring[i][0], y: 200 + ring[i][1], row: { mapID: 1000 + i } });
  rows.push({ x: 102, y: 200, row: { mapID: 7 } });
  const found = (x, y) => !(x === 102 && y === 200);
  const loc = (x, y) => ({ name: found(x, y) ? `Keep ${x}.${y}` : 'Unfound Keep', x, y });
  const plates = nearDungeons({ at: { x: 100, y: 200 }, dungeons: rows, locAt: loc, isFound: found, grid: 1 });
  assert.equal(plates.length, TV_DUNGEON_MAX);
  assert.ok(!plates.some((g) => !g.found), 'the plates\' list, found first, has no room for it - what the find read');
  const env = {
    playerTravelPixel: () => ({ x: 100, y: 200 }), discoveryGeneration: () => 3, _locIndexGen: 9, nearDungeons, TV_FIND_REACH: 4,
    dungeonRows: () => rows, mapDict: null, locationIndex: { get: (k) => { const [x, y] = k.split(',').map(Number); return loc(x, y); } },
    tvPlaceSummary: (x, y) => (found(x, y) ? { name: 'x' } : null),
    locationWorldRect: (l, x, y) => ({ minX: x * 32768, maxX: x * 32768 + 4096, minZ: y * 32768, maxZ: y * 32768 + 4096 }),
  };
  // ETHER-OW: the lists' rows and their stand (world.js tvDungeonRowsAt, tvDungeonAt), lifted beside it - the sea off here
  const rowsOf = /\n {2}(const tvDungeonRowsAt = \(at, range = TV_FAR_RANGE\) => \{\n[\s\S]*?\n {2}\};\n {2}const tvDungeonAt = [^\n]*;)\n/.exec(WORLD);
  assert.ok(rowsOf, 'the rows lifted');
  const host = mount(env, `let tvFind = { at: null, dg: -1, n: -1, list: [] }; let _tvDungeonRows = null;
const etherSea = false, inEther = () => false, etherPlaceRows = () => [], tvEtherPlace = () => null, TV_FAR_RANGE = 24, tvKnownGen = () => discoveryGeneration();
${rowsOf[1]}
${fnSource('travelViewFindList')}
return { travelViewFindList };`);
  const list = host.travelViewFindList();
  assert.deepEqual(list.map((g) => g.loc.name), ['Unfound Keep'], 'the find\'s own list: every unfound one in reach, uncapped');
  const g = dungeonToFind({ feet: { x: 100 * 32768 + 32000, z: 200 * 32768 + 2048 }, list, mid: (d) => d });   // 890 m from its middle
  assert.equal(g?.loc.name, 'Unfound Keep', 'walked up to: found');
  assert.ok(host.travelViewFindList() === list, 'kept while the pixel, the finds and the index stand');
  assert.match(fnSource('dungeonFindFrame'), /dungeonToFind\(\{ feet: \{ x: n\.x, z: n\.z \}, list: travelViewFindList\(\), mid: \(d\) => d \}\)/, 'the frame asks it');
  assert.ok(WORLD.indexOf('  let tvFind = {') < WORLD.indexOf('    tvFind = { at: null, dg: -1, n: -1, list: [] };   // AUDIT OW5 D1: nor the find\'s'), 'BOOT-TDZ: declared above the load that empties it');
  assert.ok(NATIVE_PER_M > 0);
});

test('AUDIT OW5 R1: a window or a death HOLDS a pirates\' chase at sea (the bands\' law) - any window gave every chase up and spent its raider, a free escape; ashore still ends it', () => {
  const run = ({ paused = false, dead = false, boat = true } = {}) => {
    const tvRaid = { chase: new Map([['r1', { pos: { x: 0, z: 3000 * RAID_NATIVE_PIXEL / 819.2 }, best: Infinity, bestAt: 0 }]]), spent: new Set(), clock: 0, list: [], at: 0, life: 0 };
    const env = {
      tvRaid, playerEntity: { health: dead ? 0 : 50 }, modes: { mode: 'exterior', deathUp: () => false }, gamePaused: () => paused,
      warmAshesOn: () => true, isEnhanced: () => true, walkMode: true, playerSpawned: true, csaBoatUnderMe: () => (boat ? {} : null),
      worldTimeScale: () => 1, travelView: { active: false }, state: { worldCoords: () => ({ x: 0, z: 0 }) }, player: { pos: [0, 0, 0] },
      RAID_NATIVE_PIXEL, raiderSight: () => 0, isNight: () => false, minuteNow: () => 0, travelViewRaiders: () => [],
      raiderChaseStep, RAIDER_CONTACT_M, RAIDER_CONTACT_PLAY_M, tvRaidSea: () => true, raidContact: () => {},
      navalRaidersOn: () => false,   // THE MERGE (NAV-R): the sea fight off - the mod's own chase, this pin's
      // since the merge with AUDIT OW5b: its world-moved hold (S6), its quarry (S2: on one's own boat), OW6's spend and peers
      worldMoveBusy: () => false, raidQuarry: () => boat, seaRaidSpend: (id) => tvRaid.spent.add(id), seaRaidPeerChase: () => null,
    };
    mount(env, `${fnSource('raidFrame')}\nreturn raidFrame;`)(1 / 60);
    return tvRaid;
  };
  for (const [what, o] of [['a window', { paused: true }], ['dead', { dead: true }]]) {
    const r = run(o);
    assert.ok(r.chase.has('r1'), `${what}: the chase holds`);
    assert.equal(r.spent.size, 0, `${what}: nothing spent`);
    assert.equal(r.clock, 0, `${what}: its patience does not run`);
  }
  const ashore = run({ boat: false });
  assert.deepEqual([ashore.chase.size, [...ashore.spent]], [0, ['r1']], 'ashore: given up, spent for its life');
  const sailing = run();
  assert.ok(sailing.chase.has('r1') && sailing.clock > 0, 'at sea, nothing up: the chase runs');
});

test('AUDIT OW5 S1: the mod\'s ocean stop is stood down for the Overworld\'s CROSSING alone - a journey of the mod\'s own begun at a helm (First Person Travel, the classic skin) meets it, as the mod does, never sailing on unsteered', () => {
  const m = /\n\s*atSea: (\(\) => [^\n]*?\),)   \/\/ AUDIT OW5 S1/.exec(WORLD);
  assert.ok(m, 'the host\'s atSea');
  const read = (tvSea, boat) => mount({ tvSea, csaBoatUnderMe: () => boat }, `return (${m[1].slice(0, -1)})();`);
  assert.equal(read({ means: null, phase: null }, {}), false, 'at a helm, no crossing: the mod\'s own stop');
  assert.equal(read({ means: { how: 'helm' }, phase: null }, {}), true, 'the crossing afloat: stood down');
  assert.equal(read({ means: { how: 'helm' }, phase: 'landing' }, null), true, 'the crossing coming ashore: stood down');
  assert.equal(read({ means: { how: 'helm' }, phase: null }, null), false, 'the crossing ashore: the stop is the land\'s again');
});

test('AUDIT OW5 J2: a jump stops a ROUTE\'s walk through the panel (the destination kept for the Resume, which plans it again) - a journey of the mod\'s own aims on from where it stands, and a load stops nothing', () => {
  const m = /\n\s*(if \(modEvent !== 'load' && travelOptions\?\.route && travelOptions\.isTravelActive\) travelOptions\.messages\.pauseTravel\(\);)\n/.exec(WORLD);
  assert.ok(m, 'the jump\'s stop');
  const tp = WORLD.indexOf('  async function _teleportToPixel(');
  assert.ok(tp >= 0 && WORLD.indexOf(m[1]) > tp && WORLD.indexOf(m[1]) < WORLD.indexOf('refreshSeason(arriveMinutes ?? skyMinutes());', tp), 'first thing in the one teleport every jump takes');
  const run = (modEvent, route) => {
    let paused = 0;
    const travelOptions = { route, isTravelActive: true, messages: { pauseTravel: () => { paused++; } } };
    mount({ modEvent, travelOptions }, m[1]);
    return paused;
  };
  assert.equal(run(null, { legs: [] }), 1, 'a fast travel mid-route: stopped');
  assert.equal(run(null, null), 0, 'the mod\'s own named journey: aims on at its destination, as the mod does');
  assert.equal(run('load', { legs: [] }), 0, 'a load: nothing of the old game to stop');
});

test('AUDIT OW5 G2: the Overworld\'s own lines are held the time asked at the scale they are said at - "You have found X." at x10 was up half a second', () => {
  const said = [];
  let scale = 10;
  const tvSay = mount({ townTalk: { say: (t, s) => said.push([t, s]) }, worldTimeScale: () => scale, HUD_TEXT_POP_DELAY: 1 }, `${fnSource('tvSay')}\nreturn tvSay;`);
  tvSay('You have found Castle Dread.', 5);
  tvSay('There is no way there by land.');
  scale = 1;
  tvSay('The mountains cannot be crossed on foot.');
  assert.deepEqual(said, [['You have found Castle Dread.', 50], ['There is no way there by land.', 10], ['The mountains cannot be crossed on foot.', 1]]);
  assert.match(WORLD, /import \{ HUD_TEXT_POP_DELAY \} from '\.\.\/ui\/hud\/hudText\.js';/);
  assert.equal((WORLD.match(/townTalk\.say\(TRAVEL_VIEW_TEXT\./g) ?? []).length, 0, 'every one of the view\'s own lines through it');
});

test('AUDIT OW5 V1: a pointer lock the browser grants after the cursor was freed is let go - the Overworld risen on the frame after a window closed had the look gate\'s relock land under it', async () => {
  const listeners = { pointerlockchange: [], pointerlockerror: [] };
  let exits = 0;
  const doc = {
    pointerLockElement: null,
    addEventListener: (t, fn) => { (listeners[t] ??= []).push(fn); },
    removeEventListener: () => {},
    exitPointerLock: () => { exits++; doc.pointerLockElement = null; },
  };
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true });
  try {
    const pl = await import('../../../src/player/pointerLock.js');
    const canvas = { requestPointerLock: () => undefined };
    pl.setCursorActive(false);
    pl.requestLook(canvas);   // the look gate's relock on a window's close - answered later
    pl.setCursorActive(true); pl.releaseLook();   // the view rises: the cursor freed, and no lock yet to release
    assert.equal(exits, 0, 'nothing to let go yet');
    doc.pointerLockElement = canvas;   // the browser's answer lands
    for (const fn of listeners.pointerlockchange) fn();
    assert.equal(exits, 1, 'let go at once');
    pl.setCursorActive(false);
    doc.pointerLockElement = canvas;
    for (const fn of listeners.pointerlockchange) fn();
    assert.equal(exits, 1, 'a lock granted with the cursor NOT freed is kept');
  } finally {
    if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document;
  }
});

test('AUDIT OW5 V2: the head\'s activation is never pressed from under the view - E (Interact), F on a body (SocialInteract) and the loot keys\' tap; the journey panel\'s own E is taken above them', () => {
  assert.match(WORLD, /const useEdge = !travelView\?\.active && pressed\(latch\.edge, keys, 'Interact'\);/);
  assert.match(WORLD, /if \(!townTalk\.overlayActive && !travelView\?\.active && act === 'SocialInteract' && socialMenuCanOpen\(\) && socialInteract\(\)\)/);
  assert.match(WORLD, /if \(!townTalk\.overlayActive && !travelView\?\.active && socialMenuCanOpen\(\) && quickLootArm\(act\)\) \{ _tapArmed = 2;/);
  assert.ok(WORLD.indexOf('if (travelControlUI.input(e.code, e)) { e.preventDefault(); return; }') < WORLD.indexOf("act === 'SocialInteract' && socialMenuCanOpen()"), 'the panel takes its keys (its E: TravelExit) before the world\'s ladder');
});

test('AUDIT OW5 V3: a door\'s POV row that DECIDES (armed, first or third person) is kept over the travel view\'s hold - the view\'s release at the door put the head back; Don\'tChange leaves the hold to hand back what it found', async () => {
  const { createEotbCamera, eotbCamera } = await import('../../../src/player/eyeOfTheBeholder/eotbCamera.js');
  const mv = await import('../../../src/player/mwView.js');
  const rows = (interior) => (v, k) => ({ 'AutoTogglePerspective.OnTransitionInterior': interior, 'AutoTogglePerspective.OnFoot': AUTO_TOGGLE.FirstPerson })[k];
  const cam = createEotbCamera();
  cam.loadSettings(rows(AUTO_TOGGLE.ThirdPerson));
  assert.equal(cam.transitionDecides('Interior'), true, 'armed, third: decides');
  assert.equal(cam.transitionDecides('Exterior'), false, 'its Don\'tChange row: does not');
  cam.toggleAuto();
  assert.equal(cam.transitionDecides('Interior'), false, 'disarmed: nothing decides');
  mv.setEotbBodyReady(() => true);
  try {
    for (const [row, third] of [[AUTO_TOGGLE.ThirdPerson, true], [AUTO_TOGGLE.DontChange, false]]) {
      eotbCamera.loadSettings(row === AUTO_TOGGLE.DontChange ? rows(undefined) : rows(row));
      if (eotbCamera.thirdPerson()) eotbCamera.toggleOffset(false);
      assert.equal(mv.mwViewHoldThird(true), true, 'the view holds the body out of the head');
      mv.mwViewTransition('Interior');   // the door, taken under the view
      mv.mwViewHoldThird(false);   // the door's cut, a frame later
      assert.equal(eotbCamera.thirdPerson(), third, third ? 'the row\'s third person kept' : 'no row: handed back into the head it was in');
    }
  } finally {
    mv.setEotbBodyReady(() => false);
    eotbCamera.loadSettings(null);
    if (eotbCamera.thirdPerson()) eotbCamera.toggleOffset(false);
  }
});

test('AUDIT OW5 P6: my party on the Overworld wherever they are - from the party\'s own poses, as the held map draws them - never twice (a member already marked by a body or the region\'s mark stands as that)', () => {
  const m = /\n( {4}for \(const m of host\.social\?\.others\(\) \?\? \[\]\) \{\n[\s\S]*?\n {4}\}\n)/.exec(TVM);   // PIN MOVED (HOST-SPLIT 1)
  assert.ok(m, 'the party\'s block');
  const marks = [];
  const env = {
    social: { others: () => [
      { acct: 'a', name: 'Far Ally', peers: ['p1'], p: { px: 300, py: 200 } },   // past the pose range, not shared: no other mark
      { acct: 'b', name: 'Near Ally', peers: ['p2'], p: { px: 101, py: 100 } },   // a body drawn above
      { acct: 'c', name: 'Old Pose', peers: ['p3'], p: {} },   // no pixel on the pose
    ] },
    near: new Set(['p2']), marks, _tvPartyHold: new Map(),
    mapPixelToWorldCoords: (x, y) => ({ x: x * 32768, z: y * 32768 }), tvSceneKept: (h, x, z, lift) => [x, lift, z],
  };
  env.host = { social: env.social };   // HOST-SPLIT 1: the party read live, as the module reads it
  mount(env, m[1]);
  assert.deepEqual(marks, [{ key: 'pty:a', at: [300 * 32768 + 16384, 2, 200 * 32768 + 16384], label: 'Far Ally', kind: 'party', edge: true }]);
  assert.match(TVM, /marks\.push\(\{ key: `trav:\$\{t\.id\}`[^\n]*\n\s*kin: travellerKin\([^\n]*\n\s*near\.add\(t\.id\);/, 'a region\'s mark counts as marked');   // FIELD BUGS 2026-10-04e: the mark's OW-KIN/OW-WHO fields on its own line
});

test('AUDIT OW5 G5: a first-person crossing keeps its journey\'s clock - Come Sail Away\'s own reset (the landfall\'s disembark) left x1 under a panel asking x10 with the view down; never over the Overworld\'s own hold, nor the helm\'s own time step', () => {
  const run = ({ owns = false, helmStep = false, viewUp = false, held = null } = {}) => {
    let scale = 1;
    const env = {
      travelOptions: { route: { i: 0, legs: [{ kind: 'sea' }] }, state: { autopilot: {} } }, travelControlUI: { isShowing: true },
      tvSea: { means: { how: 'helm' }, phase: null, wasLive: false, legAt: 0, best: Infinity, bestS: 0, probeAt: 0 },
      csaRuntime: { isSailing: () => true, state: { CurrentBoat: {}, sailPosition: 1 } },
      travelView: { active: viewUp }, tvOwnsJourneys: () => owns, csaHoldsTimeScale: () => helmStep,
      worldTimeScale: () => scale, setWorldTimeScale: (n) => { scale = n; }, travelAsked: 10, tvHeld: held,
      SEA_KINDS: ['sea', 'landfall'], TV_SEA_PROBE_S: 1, tvSeaRelease: () => {}, tvSeaLaunch: () => {}, tvSeaLand: () => {},
      tvSeaSail: () => {}, tvSeaAshore: () => {}, csaHelmPress: () => {}, CSA_BOAT_ACTIONS: {},
      csaJourneyHelm: { live: false },   // AUDIT FB1021d PS-2: the journey's hand, marked live as the frame runs
    };
    mount(env, `${fnSource('tvSeaFrame')}\nreturn tvSeaFrame;`)(1 / 60);
    return scale;
  };
  assert.equal(run(), 10, 'First Person Travel, the view down: the journey\'s x10 back');
  assert.equal(run({ owns: true }), 1, 'the Overworld\'s own journey with its view down: AUDIT OW4 J5 holds it at x1');
  assert.equal(run({ helmStep: true }), 1, 'the helm\'s own time step holds the clock: left to it');
  assert.equal(run({ viewUp: true }), 1, 'the view up: the governor\'s to give back');
  assert.equal(run({ held: 4 }), 4, 'OW6: an enemy near holds the journey (the governor\'s tvHeld) - the restore asks that rate, never over it');
});

/** world.js's travelViewWalkTo and tvMooredDry, run over the real planner on a small map: `sea` the water, `means` the
 *  boat to hand (tvSeaMeans), the journey and the crossing recorded. */
function walkRig({ sea = () => false, means = null } = {}) {
  const begun = [], armed = [], said = [];
  const env = {
    state: { worldCoords: (p) => ({ x: p[0], y: p[1], z: p[2] }) }, maps: { getClimateIndex: () => 231 }, TV_MOUNTAIN_CLIMATE: 226,
    tvSay: (t) => said.push(t), TRAVEL_VIEW_TEXT: { mountains: 'peaks', noWay: 'no way', spot: 'spot' },
    playerTravelPixel: () => ({ x: 10, y: 5 }), terrainGen: { roads: () => null }, planRoute, tvWater: (x, y) => sea(x, y),
    tvRouteGround: () => ({ isWater: (x, y) => sea(x, y), width: 40, height: 20, peakAt: () => false }),   // OW-WOD-PATH: the spot's peak test is the ground's own (no peak on this map)
    tvJoinedLegs: (from, plan) => routeLegs(plan.pixels, plan.kinds), dungeonApproach: () => null, lastLegStart: () => null,
    player: { pos: [0, 0, 0] }, tvLegMid: () => [0, 0],
    travelOptions: { beginTravelAlongRoute: (r) => { begun.push(r); return true; }, route: {} }, tvCautious: () => false, tvQuiet: false,
    partyWalkBegin: () => {}, travelGovernor: { reset: () => {} }, tvTrip: {}, routeDrawPoints: () => [], travelTripLine: () => '',
    tvSeaMeans: () => means, dryLine: (a, b, w) => !w(b.x, b.y) && !w(a.x, a.y), tvSeaAsk: (m, goal) => (m ? { start: m.start, again: m.again, goal } : null),
    tvSeaBegin: (m, kinds) => armed.push([m?.how ?? null, crossesWater(kinds)]), tvSeaNoWay: () => said.push('no way'), crossesWater,
    travelPathUsesRoads: () => true, TRAVEL_PATH_TEXT: { fellBack: 'fell back' },   // OW-PATH: the Roads mode, the default
  };
  const host = mount(env, `${fnSource('tvMooredDry')}\n${fnSource('travelViewWalkTo')}\nreturn travelViewWalkTo;`);
  return { walkTo: host, begun, armed, said };
}

test('AUDIT OW5 S4: a spot on the sea in the traveller\'s own pixel, from the helm, is SAILED to - the planner\'s one pixel was no leg, and the crossing landed the boat mid-sea and packed it from under the traveller', () => {
  const r = walkRig({ sea: () => true, means: { start: 'sea', how: 'helm', again: false } });
  assert.equal(r.walkTo([10 * 32768 + 900, 0, 5 * 32768 + 900], { x: 10, y: 5 }, { water: true }), true);
  assert.deepEqual(r.begun[0].legs, [{ x: 10, y: 5, kind: 'sea' }], 'one sea leg to the spot');
  assert.deepEqual(r.armed, [['helm', true]], 'the crossing armed, sailing');
});

test('AUDIT OW5 S3: a boat moored in reach is taken only where the route puts to sea - a trip with no water on the way walks, the boat left where it lies; one across the water still sails', () => {
  // the traveller's pixel is the shore (10,5), the sea west of x=8; the trip inland to (16,5)
  const west = (x) => x < 8;
  const inland = walkRig({ sea: (x) => west(x), means: { start: 'sea', how: 'moored', again: true } });
  assert.equal(inland.walkTo([16 * 32768, 0, 5 * 32768], { x: 16, y: 5 }), true);
  assert.ok(!inland.begun[0].legs.some((l) => ['sea', 'embark', 'landfall'].includes(l.kind)), 'walked: no step at sea, no landfall');
  assert.deepEqual(inland.armed, [[null, false]], 'the crossing stood down - the moored boat never boarded');
  // across a strait (the water between x=11 and x=14 from y=0 to y=19: no way round on land)
  const strait = (x) => x >= 11 && x <= 14;
  const across = walkRig({ sea: strait, means: { start: 'sea', how: 'moored', again: true } });
  assert.equal(across.walkTo([17 * 32768, 0, 5 * 32768], { x: 17, y: 5 }), true);
  assert.ok(across.begun[0].legs.some((l) => l.kind === 'sea'), 'sailed across');
  assert.deepEqual(across.armed[0], ['moored', true], 'the moored boat taken');
});

test('AUDIT OW5 J3: the whole map\'s rung is never cut short - a far pick round a range with no road to help is found, never "no way by land" (the guard stopped it at 200 000 of the map\'s 500 000 cells)', () => {
  // a wall of water down x=500 from the top to y=439; the way round is past its end - over 400 pixels, no roads
  const wall = (x, y) => x === 500 && y < 440;
  const t = performance.now();
  const r = planRoute({ x: 490, y: 200 }, { x: 510, y: 200 }, { isWater: wall });
  const ms = performance.now() - t;
  assert.ok(r, 'a way round is found');
  assert.ok(r.pixels.some((p) => p.y >= 440), 'past the wall\'s end');
  assert.ok(r.pixels.every((p) => !wall(p.x, p.y)), 'never through it');
  assert.ok(ms < 5000, `and within reason (${ms.toFixed(0)} ms)`);
});

test('AUDIT OW5 J4: a walk\'s approach point stays inside its own pixel - a place filling its pixel (eight blocks) put it 20 m into the next, where the spot\'s arrival is never asked, and the walk went back and forth for ever', () => {
  const box = pixelBox(10, 5);
  assert.deepEqual(box, { minX: 10 * 32768 + 256, maxX: 11 * 32768 - 256, minZ: 494 * 32768 + 256, maxZ: 495 * 32768 - 256 });
  const rect = { minX: 10 * 32768, maxX: 11 * 32768, minZ: 494 * 32768, maxZ: 495 * 32768 };   // eight blocks: the whole pixel
  const feet = { x: 9 * 32768, z: rect.minZ + 16384 };   // coming in from the west
  assert.ok(dungeonApproach(rect, feet).x < rect.minX, 'unclamped: in the pixel to the west');
  const n = dungeonApproach(rect, feet, undefined, box);
  assert.ok(n.x >= box.minX && n.x <= box.maxX && n.z >= box.minZ && n.z <= box.maxZ, 'clamped: inside the walk\'s own pixel');
  const small = { minX: rect.minX + 12000, maxX: rect.minX + 20000, minZ: rect.minZ + 12000, maxZ: rect.minZ + 20000 };
  assert.deepEqual(dungeonApproach(small, feet, undefined, box), dungeonApproach(small, feet), 'a small place\'s edge point is as it was');
});
