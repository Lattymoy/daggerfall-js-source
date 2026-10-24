// FIELD BUGS 2026-10-21d PASSAGE-HANDS, PASSAGE-IN and PASSAGE-PLATE (Harlander, the Discord's #bug-reports, "Booked
// ocean passage ...": "You can steer the ship as if it was yours", "Fast travel gets stuck on docks and tries to path up
// onto land", "The ship control controls appear on top of the fast travel controls", "Boats go at slow time compression
// for unclear reasons"). The record: bible/01-Overview/bugs/Field-Bugs-2026-10-21d.md.
//
// HANDS: Come Sail Away's real runtime (test/csaScene.mjs) with a booked Large Boat at her helm, her master's hand
// pressing it (systems/seaHelm.js, as world.js tvSeaSail does), and the mod's input seam lifted out of world.js (its
// `has` and `started`) wrapped as the host wraps it (scenes/naval/passageHelm.js passengerHelm). IN: the voyage's law
// (passage.js voyageSails), the sailed leg's mark (systems/travel/seaMark.js) - on the real map's built ground where
// ARENA2 stands (test/portTerrain.mjs) - and the town rings (travelRoute.js routeLegs). PLATE: the naval plate's cover,
// lifted out of world.js.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scene } from '../../csaScene.mjs';
import { portTerrain } from '../../portTerrain.mjs';
import { BOAT_ACTIONS } from '../../../src/systems/comeSailAway/comeSailAway.js';
import { seaHelmStep, createSeaHelm, headingOf, squareOnly } from '../../../src/systems/seaHelm.js';
import { quatRotate } from '../../../src/world/quat.js';
import { HELM_RUDDER_ACTIONS } from '../../../src/systems/inputActions.js';
import { createJourneyHand, passengerHelm, passengerCard, mastersHelm, PASSENGER_KEYS } from '../../../src/scenes/naval/passageHelm.js';
import { passengerButtons, helmPadPrompts, drawEnhancedHelm, hideEnhancedHelm } from '../../../src/ui/enhanced/enhancedHelm.js';
import { fakeDoc, all, one } from '../../decorFakes.mjs';
import { voyageSails, passageDestinations } from '../../../src/systems/naval/passage.js';
import { seaLegMark, PIXEL_TILES, SEA_LEG_UNBUILT, SEA_LEG_DRY } from '../../../src/systems/travel/seaMark.js';
import { routeLegs, planRoute, routeGround, VOYAGE_LANDFALL_PX } from '../../../src/systems/travel/travelRoute.js';
import { createTravelOptions, readTravelOptionsSettings } from '../../../src/systems/travel/travelOptions.js';
import { mapPixelWorldOrigin, MP_WORLD_UNITS as PIXEL_UNITS } from '../../../src/systems/travel/travelPaths.js';
import { WATER_BYTE } from '../../../src/world/roadsProducer.js';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const WORLD = readFileSync(join(ROOT, 'src/scenes/world.js'), 'utf8');
/** One line of world.js, by its start. */
const line = (head) => { const i = WORLD.indexOf(head); assert.ok(i >= 0, `${head} is in world.js`); return WORLD.slice(i, WORLD.indexOf('\n', i) + 1); };
/** A function of world.js's, whole. */
const fn = (head) => { const i = WORLD.indexOf(head); assert.ok(i >= 0, head); return WORLD.slice(i, WORLD.indexOf('\n  }\n', i) + 4); };
function mount(scope, code, name) {
  const proxy = new Proxy(scope, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { ${code}\n return ${name}; }`)(proxy);
}

// ── PASSAGE-HANDS ───────────────────────────────────────────────────────────────────────────────────────────────────

/** A voyage of `seconds` due north under her master's hand, the passenger's keys held and pressed as `play` says - the
 *  boat a charter (`booked`) or mine. Answers where she ends and how she went. */
function voyage({ booked = true, seconds = 160, viewUp = true, autorun = false, master = true, wind = 1.5, play = () => {} } = {}) {
  const s = scene({ heightMapValue: () => 0, settings: { 'Waves.Enable': false } });
  s.deps.handling = () => 'responsive';
  for (const t of s.terrains) t.tileMap.fill(0);   // open water everywhere
  const keys = new Set(), latch = { edge: { downFrame: new Set() } };
  const csaHelmInput = { edges: new Set(), chord: new Set(), held: new Set() };
  const csaJourneyHelm = createJourneyHand();
  const player = { toggleAutorun: autorun };   // world.js's player latch - the player's own autorun
  const scope = {
    keys, latch, held: (k, a) => k.has(a), pressed: (e, _k, a) => e.downFrame.has(a), csaHelmInput, csaJourneyHelm,
    HELM_RUDDER_ACTIONS, helmTurnKeys: () => true, travelView: { active: viewUp }, CSA_BOAT_ACTIONS: BOAT_ACTIONS, player,
  };
  // the host's seam as world.js writes it - its keys, its taps, and (AUDIT FB1021d PS-4/PS-6) its autorun accessor pair
  const raw = mount(scope, `const __i = { ${line('      has: (action) => held(keys, action) ||')}${line('      started: (action) => !(travelView?.active &&')} horizontal: () => 0, vertical: () => 0, ${line('      get toggleAutorun() {')}${line('      set toggleAutorun(v) {')} };`, '__i');
  const boatRef = { boat: null };
  s.deps.input = passengerHelm(raw, () => s.rt.state.CurrentBoat, csaJourneyHelm);
  const boat = s.place(1, 0, [100, 34, 200], [0, 0, 1]);
  if (booked) boat.charter = { to: { name: 'Wayrest', px: 859, py: 244 }, ship: 'The Fair Silk', captain: 'Ada Lark', fare: 50 };
  boatRef.boat = boat;
  s.helm(boat);
  const mark = [100, 200 + 20000];
  const st = createSeaHelm();
  const track = [];
  let sailsUp = false, rowed = 0;
  for (let t = 0; t < seconds; t += 0.25) {
    s.rt.state.windVectorTarget = [wind, 0, 0]; s.rt.state.windVectorCurrent = [wind, 0, 0];
    const p = boat.GameObject.position, fw = quatRotate(boat.GameObject.rotation, [0, 0, 1]), v = s.rt.state.velocityCurrent ?? [0, 0, 0], w = s.rt.state.windVectorCurrent;
    const cmd = seaHelmStep(st, { heading: headingOf(fw[0], fw[2]), bearing: headingOf(mark[0] - p[0], mark[1] - p[2]), wind: [w[0], w[2]], hasSails: boat.Sails.length > 0, squareOnly: squareOnly(boat), sailsUp: s.rt.state.sailPosition > 0, canSail: s.rt.CanSail(boat), way: v[2], dt: 0.25, crewed: !!boat.crewed, oarWay: s.rt.oarWayOf(boat), sailWay: s.rt.sailWayOf(boat), free: !!s.rt.helmResponsive() });
    // world.js tvSeaSail: the hand's holds, its row and its own taps
    csaJourneyHelm.held.clear();
    if (master && cmd.turn > 0) csaJourneyHelm.held.add('MoveRight'); else if (master && cmd.turn < 0) csaJourneyHelm.held.add('MoveLeft');
    csaJourneyHelm.row = master && cmd.row;   // `master` false: the voyage halted (a foe near) - his hand off the helm
    csaJourneyHelm.live = master;   // world.js tvSeaFrame: the journey live, or not
    if (master && cmd.sails) csaJourneyHelm.press(BOAT_ACTIONS.toggleSail);
    if (csaJourneyHelm.row) rowed++;
    keys.clear(); latch.edge.downFrame.clear();
    play(t, keys, latch.edge.downFrame, csaHelmInput, csaJourneyHelm);
    s.rt.endOfFrame(); s.rt.fixedUpdate(); s.rt.update(); s.rt.lateUpdate();
    s.world.time += 0.25;
    // world.js csaUpdate: the frame's taps spent - the panel's and the journey's
    csaHelmInput.edges.clear(); csaHelmInput.chord.clear(); csaJourneyHelm.edges.clear();
    sailsUp ||= s.rt.state.sailPosition > 0;
    track.push({ t, x: p[0], z: p[2], rung: s.rt.state.oarThrottle, light: !!boat.LightOn, sails: s.rt.state.sailPosition });
  }
  return { s, boat, track, sailsUp, rowed, latch: player.toggleAutorun, at: s.rt.state.CurrentBoat === boat && s.rt.isSailing(), end: [...boat.GameObject.position] };
}

test('PASSAGE-HANDS: the report - a passenger holding D (the strafe key the Overworld leaves them) under a booked ship\'s master - she sails her master\'s course exactly, raises her sails at his word; a boat of mine turns for the same key (mutants: the passenger\'s keys read, the journey\'s taps unread, the wrapper unwired, the passenger\'s autorun read)', () => {
  const alone = voyage();
  assert.equal(alone.sailsUp, true, 'her master raises her sails - his own tap reaches the mod through the seam');
  const hand = voyage({ play: (t, keys) => { if (t >= 40 && t < 70) keys.add('MoveRight'); } });
  assert.deepEqual(hand.end.map((v) => v.toFixed(3)), alone.end.map((v) => v.toFixed(3)), 'the passenger\'s D moved her not at all');
  const rowing = voyage({ autorun: true });
  assert.deepEqual(rowing.end.map((v) => v.toFixed(3)), alone.end.map((v) => v.toFixed(3)), 'nor their autorun - her oars pull at her master\'s word');
  // AUDIT FB1021d PS-4: and let go as it is read - under way, never latched to pull her oars the moment her master ships
  // them with her sails down (with her sails up her oars move her not at all, so the track alone cannot tell)
  assert.deepEqual([rowing.at, rowing.latch], [true, false], 'under way at her helm, the passenger\'s autorun let go');
  // AUDIT FB1021d PS-2: the voyage halted (a foe near, aground, between his tries: his hand off her helm) - she is the
  // passenger's to handle, as a boat of mine is: their autorun pulls her oars, their D swings her
  const halted = voyage({ master: false, seconds: 40 }), haltedRow = voyage({ master: false, seconds: 40, autorun: true });
  assert.ok(Math.hypot(haltedRow.end[0] - halted.end[0], haltedRow.end[2] - halted.end[2]) > 5, 'halted: the passenger\'s autorun rows her');
  const mineRow = voyage({ booked: false, master: false, seconds: 40, autorun: true });
  assert.ok(Math.hypot(mineRow.end[0] - halted.end[0], mineRow.end[2] - halted.end[2]) > 5, 'my own autorun pulls my oars');
  const mine = voyage({ booked: false });
  const mineD = voyage({ booked: false, play: (t, keys) => { if (t >= 40 && t < 70) keys.add('MoveRight'); } });
  assert.ok(Math.hypot(mineD.end[0] - mine.end[0], mineD.end[2] - mine.end[2]) > 20, 'a boat of mine answers my rudder still');
});

test('PASSAGE-HANDS: with the Overworld down (First Person Travel, a foe near, between her master\'s tries) the oars, the sails, the lantern and the panel\'s and pad\'s taps are her master\'s; the passenger keeps stepping from her helm (mutants: the passenger\'s presses read, the keys kept unread)', () => {
  const taps = (want) => (t, _keys, down, panel) => {
    for (const [at, a, viaPanel] of want) if (Math.abs(t - at) < 0.01) (viaPanel ? panel.edges : down).add(a);
  };
  const alone = voyage({ viewUp: false, seconds: 100 });
  const pressed = voyage({ viewUp: false, seconds: 100, play: taps([[50, 'MoveBackwards'], [51, 'MoveBackwards'], [52, BOAT_ACTIONS.sailDown], [53, BOAT_ACTIONS.toggleLight], [54, BOAT_ACTIONS.sailDown, true], [55, BOAT_ACTIONS.toggleSail, true]]) });
  assert.deepEqual(pressed.track.map((r) => [r.rung, r.sails, r.light]), alone.track.map((r) => [r.rung, r.sails, r.light]), 'nothing the passenger pressed reached her');
  assert.deepEqual(pressed.end, alone.end);
  assert.equal(pressed.at, true, 'still under way at her helm');
  const off = voyage({ viewUp: false, seconds: 60, play: taps([[40, BOAT_ACTIONS.disembark]]) });
  assert.equal(off.at, false, 'the disembark key steps the passenger from her helm');
  assert.ok(PASSENGER_KEYS.includes(BOAT_ACTIONS.disembark) && PASSENGER_KEYS.includes('Transport'));
  // a boat of mine, the view down: the keys are mine
  const mine = voyage({ booked: false, viewUp: false, seconds: 100, play: taps([[50, 'MoveBackwards'], [51, 'MoveBackwards'], [53, BOAT_ACTIONS.toggleLight]]) });
  assert.ok(mine.track.some((r) => r.light), 'my lantern is mine');
});

test('PASSAGE-HANDS (AUDIT FB1021d PS-4/PS-6): in a calm her master rows her - the oars are his to pull; at a landfall his own disembark steps the passenger off; and the passenger\'s autorun, which has no hand at her helm, is let go - stepped off under sail, the player no longer runs off down the deck - as my own boat lets mine go; the time dial stays theirs (mutants: her master never rows, the journey\'s disembark refused, the latch kept, the setter dropped, the time keys taken)', () => {
  // the time dial is the passenger's - its keys reach the mod (Come Sail Away's IncreaseTimeScale)
  const dial = voyage({ seconds: 20, play: (t, _k, down) => { if (Math.abs(t - 10) < 0.01) down.add(BOAT_ACTIONS.timeScaleUp); } });
  assert.ok(dial.s.rt.state.timeScaleIndex > voyage({ seconds: 20 }).s.rt.state.timeScaleIndex, 'a passenger\'s time key turns the dial');
  const calm = voyage({ wind: 0, seconds: 60 });
  assert.ok(calm.rowed > 0, 'no wind: her master rows');
  assert.ok(Math.hypot(calm.end[0] - 100, calm.end[2] - 200) > 20, `and she goes: ${calm.end.map((v) => v.toFixed(1))}`);
  const landfall = voyage({ seconds: 45, play: (t, _k, _d, _p, journey) => { if (Math.abs(t - 40) < 0.01) journey.press(BOAT_ACTIONS.disembark); } });
  assert.equal(landfall.at, false, 'her master\'s landfall steps the passenger off');
  const offKey = (t, _k, down) => { if (Math.abs(t - 40) < 0.01) down.add(BOAT_ACTIONS.disembark); };
  const passenger = voyage({ seconds: 45, autorun: true, play: offKey });
  assert.equal(passenger.at, false);
  assert.equal(passenger.latch, false, 'a passenger stepped off under sail: their autorun let go');
  const mine = voyage({ booked: false, master: false, seconds: 45, autorun: true, play: offKey });
  assert.equal(mine.at, false);
  assert.equal(mine.latch, false, 'mine, as the mod lets it go (stopSailingHead)');
});

test('PASSAGE-HANDS: the helm panel at a booked ship\'s helm under way is a passenger\'s card - her name and her port, the time dial and Leave (AUDIT FB1021d PS-7); halted, and on a boat of mine, her helm (AUDIT FB1021d PS-2) (mutants: the card unread, the helm kept for a charter, the card while halted, the card\'s buttons dropped)', () => {
  const drawn = [];
  const scope = {
    csaRuntime: { helmPanelState: () => ({ hull: 1, hasSails: true }), state: { CurrentBoat: null } }, csaOn: () => true, isEnhancedPlus: () => true,
    document: {}, walkMode: true, enhancedHelmMounted: () => false, hideEnhancedHelm: () => {}, csaHelmInput: { held: new Set() },
    csaCall: (f) => f(), csaAboard: { aboard: null }, drawEnhancedHelm: (state) => drawn.push(state), peerName: (x) => x,
    townTalk: { hudCovered: false }, modes: null, gamePaused: () => false, hudRenderEnabled: () => true, touch: null,
    cursorActive: () => true, pointerSurfaces: new Set(), csaKeyLabel: () => '', csaHelmHooks: {}, travelView: { active: false },
    navalOn: () => true, _travelUIHolder: { ui: null }, holdsCargo: () => true, naval: null, passengerCard, csaJourneyHelm: { live: true },
  };
  scope.csaRuntime.helmPanelState = () => ({ hull: 1, hasSails: true, timeDial: true, timeScale: 2, timeScaleIndex: 1, timeScaleMax: 3 });
  const draw = mount(scope, fn('  function csaDrawHelmPanel() {'), 'csaDrawHelmPanel');
  scope.csaRuntime.state.CurrentBoat = { hull: 1, charter: { to: { name: 'Wayrest', px: 859, py: 244 }, ship: 'The Fair Silk' } };
  draw();
  assert.deepEqual([drawn.at(-1).helm, drawn.at(-1).aboard], [null, { hull: 1, passage: { ship: 'The Fair Silk', port: 'Wayrest' }, dial: { timeDial: true, timeScale: 2, timeScaleIndex: 1, timeScaleMax: 3 } }], 'a passenger\'s card, the helm\'s dial on it');
  assert.deepEqual(passengerButtons(drawn.at(-1).aboard).map((b) => b.act), ['slower', 'normal', 'faster', 'leave'], 'what a passenger keeps, on the card: the dial and Leave');
  assert.deepEqual(passengerButtons({ dial: { timeDial: false } }).map((b) => b.act), ['leave'], 'online the dial does not turn (HELM-TIME-ONLINE): Leave alone');
  // and the panel paints the card - its title, and the buttons a mouse or a finger keeps
  const doc = fakeDoc(), pressed = [];
  try {
    const root = drawEnhancedHelm(drawn.at(-1), { press: (a) => pressed.push(a) }, { doc });
    assert.equal(one(root, 'helmpanel-name').textContent, 'The Fair Silk, bound for Wayrest - her master steers', 'its title says where she is bound');
    const btns = all(root, 'helmpanel-btn');
    assert.deepEqual(btns.map((b) => b.dataset.act), ['slower', 'normal', 'faster', 'leave'], 'painted: the dial and Leave');
    btns.find((b) => b.dataset.act === 'leave').fire('click');
    btns.find((b) => b.dataset.act === 'faster').fire('click');
    assert.deepEqual(pressed, [BOAT_ACTIONS.disembark, BOAT_ACTIONS.timeScaleUp], 'Leave steps them off; the dial turns');
  } finally { hideEnhancedHelm(); }
  scope.csaJourneyHelm.live = false;
  draw();
  assert.equal(drawn.at(-1).helm?.hull, 1, 'the voyage halted: her helm is the passenger\'s, panel and all');
  scope.csaJourneyHelm.live = true;
  scope.csaRuntime.state.CurrentBoat = { hull: 1 };
  draw();
  assert.equal(drawn.at(-1).helm.hull, 1, 'my own: her helm');
  assert.equal(drawn.at(-1).aboard, null);
});

test('PASSAGE-HANDS (AUDIT FB1021d PS-2): the crossing\'s own frame marks the journey\'s hand on her helm - on while the Overworld\'s autopilot sails her, off the frame it stops (arrived, a foe near closing the controls, the autopilot let go) - and the passenger\'s keys reach her helm only once it is off (mutants: the hand never marked on, never marked off)', () => {
  const boat = { charter: { to: { name: 'Wayrest', px: 859, py: 244 }, ship: 'The Fair Silk' } };
  const csaJourneyHelm = createJourneyHand();
  const env = {
    travelOptions: { route: { i: 0, legs: [{ kind: 'sea' }] }, state: { autopilot: {} } }, travelControlUI: { isShowing: true },
    tvSea: { means: { how: 'helm' }, phase: null, boat: null, wasLive: false, legAt: 0, best: Infinity, bestS: 0, probeAt: 0 },
    csaRuntime: { isSailing: () => true, state: { CurrentBoat: boat, sailPosition: 1 } }, travelView: { active: true },
    SEA_KINDS: ['sea', 'embark', 'landfall'], TV_SEA_PROBE_S: 1, CSA_BOAT_ACTIONS: BOAT_ACTIONS, csaJourneyHelm,
    tvSeaRelease: () => {}, tvSeaLaunch: () => {}, tvSeaLand: () => {}, tvSeaSail: () => {}, tvSeaAshore: () => {},
  };
  const frame = mount(env, fn('  function tvSeaFrame(dt) {'), 'tvSeaFrame');
  const input = passengerHelm({ has: (a) => a === 'MoveRight', started: (a) => a === 'MoveRight', horizontal: () => 1, vertical: () => 0, toggleAutorun: false }, () => boat, csaJourneyHelm);
  frame(1 / 60);
  assert.equal(mastersHelm(boat, csaJourneyHelm), true, 'the journey live: her master\'s hand on her helm');
  assert.deepEqual([input.has('MoveRight'), input.started('MoveRight'), input.horizontal()], [false, false, 0], 'the passenger\'s D reaches her not');
  env.travelOptions.state.autopilot = null;   // the journey stopped
  frame(1 / 60);
  assert.equal(mastersHelm(boat, csaJourneyHelm), false, 'stopped: his hand off');
  assert.deepEqual([input.has('MoveRight'), input.started('MoveRight'), input.horizontal()], [true, true, 1], 'the passenger\'s D swings her');
  assert.ok(csaJourneyHelm.edges.has(BOAT_ACTIONS.toggleSail), 'and her sails struck as the journey lets her go');
});

test('PASSAGE-HANDS (AUDIT FB1021d PS-7): a passenger\'s pad prompts at her helm under way say what reaches it from them - leaving it, held, and the dial where it turns - never her sails, lanterns or trim; the host asks them so (mutants: a passenger told the helm\'s, the host unasked)', () => {
  const h = { hasSails: true, manualTrim: true, squareToggle: false, timeDial: true };
  const said = (rows) => rows.map(([, words]) => words);
  assert.deepEqual(said(helmPadPrompts(h, { passenger: true })), ['Leave the helm (hold)', 'Slower', 'Faster']);
  assert.deepEqual(said(helmPadPrompts({ ...h, timeDial: false }, { passenger: true })), ['Leave the helm (hold)'], 'online: no dial');
  assert.ok(said(helmPadPrompts(h)).some((w) => /Sails/.test(w)), 'at a helm of mine: the sails');
  assert.match(WORLD, /helmPadPrompts\(csaRuntime\?\.helmPanelState\(\) \?\? null, \{ glass: glassDpad\(\), passenger: mastersHelm\(csaRuntime\?\.state\?\.CurrentBoat, csaJourneyHelm\) \}\)/);
});

// ── PASSAGE-IN ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('PASSAGE-IN: her master\'s resume from her port\'s roadstead runs in - a plan that never sails is walked within VOYAGE_LANDFALL_PX of her port, and refused anywhere farther (AUDIT PASSAGE A1: never set down at the quay left, which is never that near a port booked) (mutants: the roadstead refused, every plan walked)', () => {
  const port = { x: 859, y: 244 };
  const landfall = { kinds: ['landfall', 'open'] };
  assert.equal(voyageSails({ x: 858, y: 246 }, port, landfall), true, 'off Wayrest, two pixels out: the landfall and the walk in');
  assert.equal(voyageSails({ x: 859 - VOYAGE_LANDFALL_PX, y: 244 }, port, landfall), true, 'at the reach itself: walked in (AUDIT FB1021d PS-6)');
  assert.equal(voyageSails({ x: 859 - VOYAGE_LANDFALL_PX - 1, y: 244 }, port, landfall), false, 'farther: a voyage sails');
  assert.equal(voyageSails({ x: 800, y: 240 }, port, { kinds: ['sea', 'sea', 'landfall'] }), true);
  assert.equal(voyageSails({ x: 858, y: 246 }, port, null), false, 'no plan, no voyage');
  // a quay left is never within the reach of a port booked
  const ports = [{ key: 'a', name: 'Near', px: 860, py: 245 }, { key: 'b', name: 'Far', px: 900, py: 245 }];
  assert.deepEqual(passageDestinations(ports, { x: 858, y: 246 }).map((d) => d.port.name), ['Far']);
  assert.match(WORLD, /if \(voyage && !voyageSails\(from, summary\.pixel, plan\)\) \{ noWay\?\.\(\); return false; \}/);
});

test('PASSAGE-IN: a pixel reached or left under sail is walked round no town - a ring\'s points stand on the town\'s land; on foot the ring stands, and on the land a party embarks from or makes landfall on (AUDIT FB1021d PS-3) (mutants: the rings back on the sea; every sea kind afloat; the landfall\'s land afloat; the launch\'s water ashore)', () => {
  const pixels = [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }, { x: 13, y: 10 }];
  const ringAt = (x) => (x === 11 || x === 12 ? [{ x: x * 32768, z: 0 }, { x: x * 32768 + 100, z: 0 }] : null);
  const sea = routeLegs(pixels, ['sea', 'sea', 'landfall'], { ringAt });
  assert.equal(sea.some((l) => l.ring), false, 'no ring on the sea');
  const land = routeLegs(pixels, ['open', 'open', 'open'], { ringAt });
  assert.equal(land.filter((l) => l.ring).length, 4, 'a walk rings both towns');
  // AUDIT FB1021d PS-3: the pixel a party embarks FROM and the one it makes landfall ON are land, walked - their rings
  // stand (my own boat's crossings: the walk to the water no longer runs straight across the town)
  const ringsAt = (kinds) => [...new Set(routeLegs(pixels, kinds, { ringAt }).filter((l) => l.ring).map((l) => Math.floor(l.at.x / 32768)))];
  assert.deepEqual(ringsAt(['open', 'embark', 'sea']), [11], 'embarked from 12: 11 walked, 12 left by boat');
  assert.deepEqual(ringsAt(['open', 'open', 'embark']), [11, 12], 'embarking out of 12: its ring walked first');
  assert.deepEqual(ringsAt(['sea', 'landfall', 'open']), [12], 'landfall on 12: walked from there, 11 sailed');
  assert.deepEqual(ringsAt(['embark', 'landfall', 'open']), [12], 'embarked into 11, landfall out of it onto 12');
});

test('PASSAGE-IN: a sailed leg is aimed at its pixel\'s middle where the built ground floats her there; where it is that ground\'s land, at the nearest water that does (5 by 5 tiles) - and the autopilot\'s mark and arrival are that point; a pixel built where nothing floats her is passed for the next leg, and one not built yet aimed at its middle and again once it is (AUDIT FB1021d PS-1) (mutants: the mark unread, the middle always, a lone tile taken, the dry leg sailed, the unbuilt leg never aimed again)', () => {
  const o = { x: 0, z: 0 }, TILE = PIXEL_UNITS / PIXEL_TILES;
  const tileOf = (x, z) => [Math.floor(x / TILE), Math.floor(z / TILE)];
  // a pixel whose west three quarters are land, east quarter water - and one lone wet tile near the middle
  const water = (x, z) => { const [i, j] = tileOf(x, z); return (i >= 96 && i < 128 && j >= 0 && j < 128) || (i === 62 && j === 64); };
  const m = seaLegMark(o, water);
  assert.ok(m, 'a mark');
  assert.ok(tileOf(m.x, m.z)[0] >= 98, `in water with room for her hull: tile ${tileOf(m.x, m.z)}`);
  assert.equal(tileOf(m.x, m.z)[0], 98, 'the nearest such to the middle');
  assert.equal(seaLegMark(o, () => true), null, 'the middle floats her: the middle quarter');
  assert.equal(seaLegMark(o, () => false), SEA_LEG_DRY, 'built, and nothing floats her: dry');
  assert.equal(seaLegMark(o, () => null), SEA_LEG_UNBUILT, 'no ground built yet');
  // Travel Options' sea leg, asked as the host asks it: the autopilot's centre is the mark
  const deps = { settings: readTravelOptionsSettings(), setTimeScale: () => {}, pushWindow: (w) => w.show?.(), worldPos: () => ({ x: 0, z: 0 }), mapPixel: () => ({ x: 0, y: 499 }), yaw: () => 0,
    seaWaterAt: (x, z) => { const oo = mapPixelWorldOrigin(1, 499); return water(x - oo.x, z - oo.z); } };
  const journey = createTravelOptions(deps);
  assert.equal(journey.beginTravelAlongRoute({ legs: [{ x: 1, y: 499, kind: 'sea' }], summary: { pixel: { x: 9, y: 499 }, name: 'Port' }, name: 'Port' }, false, { quiet: true }), true);
  const c = journey.state.autopilot?.destinationCentre;
  const oo = mapPixelWorldOrigin(1, 499);
  assert.ok(c && tileOf(c.x - oo.x, c.z - oo.z)[0] === 98, `the autopilot aims at the mark: ${JSON.stringify(c)}`);
  // AUDIT FB1021d PS-1: a dry pixel passed - the autopilot makes for the next leg's
  const dry = createTravelOptions({ ...deps, seaWaterAt: (x, z) => { const oo1 = mapPixelWorldOrigin(1, 499); return x >= oo1.x && x < oo1.x + PIXEL_UNITS ? false : true; } });
  assert.equal(dry.beginTravelAlongRoute({ legs: [{ x: 1, y: 499, kind: 'sea' }, { x: 2, y: 499, kind: 'sea' }, { x: 3, y: 499, kind: 'landfall' }], summary: { pixel: { x: 9, y: 499 }, name: 'Port' }, name: 'Port' }, false, { quiet: true }), true);
  assert.equal(dry.route.i, 1, 'the dry leg passed');
  const d = dry.state.autopilot?.destinationCentre, o2 = mapPixelWorldOrigin(2, 499);
  assert.ok(d && d.x >= o2.x && d.x < o2.x + PIXEL_UNITS, `aimed into the next leg's pixel: ${JSON.stringify(d)}`);
  // ...and a pixel not built when its leg begins: its middle, then the mark once the ground is built
  let built = false;
  const later = createTravelOptions({ ...deps, seaWaterAt: (x, z) => (built ? deps.seaWaterAt(x, z) : null) });
  assert.equal(later.beginTravelAlongRoute({ legs: [{ x: 1, y: 499, kind: 'sea' }], summary: { pixel: { x: 9, y: 499 }, name: 'Port' }, name: 'Port' }, false, { quiet: true }), true);
  const mid = later.state.autopilot?.destinationCentre;
  assert.equal(tileOf(mid.x - oo.x, mid.z - oo.z)[0], 64, 'unbuilt: its middle');
  later.update({ topWindowIsTravelUI: true });
  assert.equal(tileOf(later.state.autopilot.destinationCentre.x - oo.x, 0)[0], 64, 'still unbuilt: unmoved');
  built = true;
  later.update({ topWindowIsTravelUI: true });
  const now = later.state.autopilot?.destinationCentre;
  assert.equal(tileOf(now.x - oo.x, now.z - oo.z)[0], 98, `built: aimed again, at the mark - ${JSON.stringify(now)}`);
});

test('PASSAGE-IN on the real map (ARENA2): voyages to Wayrest, Daggerfall and Sentinel from every port town within 120 pixels - every sailed leg is aimed where the built ground floats her or passed where nothing does (56 voyages, 527 sailed legs: 80 were aimed at that ground\'s land, none now; AUDIT FB1021d PS-1: the first count filtered 25 dry legs out) (mutants: the mark unread, a lone tile taken, the dry leg sailed)', { skip: portTerrain() ? false : 'ARENA2_PATH has no ARENA2' }, (t) => {
  const T = portTerrain();
  const woods = T.woods;
  const ground = routeGround((x, y) => T.maps.getClimateIndex(x, y), (x, y) => woods.getHeightMapValue(x, y), WATER_BYTE, 1000, 500, null);
  // native units over the built ground (portTerrain: world metres, x east, z north - native is forty to the metre)
  const waterAt = (x, z) => T.isWater(x / 40, z / 40);
  const floatsAt = (x, z) => { const t = PIXEL_UNITS / PIXEL_TILES; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (!waterAt(x + a * t, z + b * t)) return false; return true; };
  let legs = 0, before = 0, after = 0, voyages = 0, passed = 0;
  for (const name of ['Wayrest', 'Daggerfall', 'Sentinel']) {
    const dest = T.towns.find((t) => t.name === name);
    assert.ok(dest, name);
    for (const from of T.towns) {
      if (from === dest || Math.max(Math.abs(from.px - dest.px), Math.abs(from.py - dest.py)) > 120) continue;
      const r = planRoute({ x: from.px, y: from.py }, { x: dest.px, y: dest.py }, { ...ground, sea: { start: 'sea', again: false, goal: 'land', voyage: true } });
      if (!r) continue;
      voyages++;
      for (const leg of routeLegs(r.pixels, r.kinds)) {
        if (leg.kind !== 'sea') continue;
        legs++;
        const o = mapPixelWorldOrigin(leg.x, leg.y);
        const mid = { x: o.x + PIXEL_UNITS / 2, z: o.z + PIXEL_UNITS / 2 };
        if (!floatsAt(mid.x, mid.z)) before++;
        const read = seaLegMark(o, waterAt);
        if (read === SEA_LEG_DRY) { passed++; continue; }   // AUDIT FB1021d PS-1: passed for the next leg (travelOptions.js startRouteLeg)
        const m = read ?? mid;
        if (!floatsAt(m.x, m.z)) after++;
      }
    }
  }
  assert.ok(voyages > 30 && legs > 300, `${voyages} voyages, ${legs} sailed legs`);
  assert.ok(before > 20, `before: ${before} legs aimed at the built ground's land`);
  assert.equal(after, 0, `after: ${after} aimed at the built ground's land`);
  assert.ok(passed > 0, `the dry pixels passed: ${passed}`);
  t.diagnostic(`${voyages} voyages, ${legs} sailed legs: ${before} aimed at the built ground's land before, ${after} after (${passed} dry, passed)`);
});

// ── PASSAGE-PLATE ───────────────────────────────────────────────────────────────────────────────────────────────────

test('PASSAGE-PLATE: the ship\'s plate stands down under the Overworld\'s controls - bottom right, where it stands - as the helm panel does, and stands again when they go (a foe near closes them: enemiesStop); under First Person Travel\'s bar, top centre and clear of it, it stands (AUDIT FB1021d PS-5) (mutants: the plate over the Overworld, the plate down under the bar)', () => {
  const drawn = [];
  const scope = {
    navalOn: () => true, _mode: () => 'exterior', naval: { hudModel: () => ({ plate: {} }) },
    townTalk: { overlayActive: false, hudHidden: false }, gamePaused: () => false,
    controllerLook: () => false, padFamily: () => null, navalPadCodes: () => null, hdGlyphName: () => 'X', navalKeyName: (a) => a,
    enhancedHudScale: () => 1, enhancedHelmBar: () => null, enhancedHudBottom: () => null, enhancedHudQuick: () => null,
    isEnhanced: () => true, hudArt: null, classicCompassBox: () => null, touch: null, spyglass: { up: false },
    drawNavalHud: (m, opts) => drawn.push(opts.covered), travelView: { active: true }, _travelUIHolder: { ui: { isShowing: true } },
  };
  const navalHud = mount(scope, fn('  function navalHud(dt = 0) {'), 'navalHud');
  navalHud(0.25);
  assert.equal(drawn.pop(), true, 'under the Overworld');
  scope._travelUIHolder.ui.isShowing = false;
  navalHud(0.25);
  assert.equal(drawn.pop(), true, 'the Overworld up, its bar not drawn: still under it');
  scope._travelUIHolder.ui.isShowing = true;
  scope.travelView.active = false;
  navalHud(0.25);
  assert.equal(drawn.pop(), false, 'First Person Travel\'s bar up, top centre: the plate stands - a fight\'s card and the touch Brace beside it');
  scope._travelUIHolder.ui.isShowing = false;
  navalHud(0.25);
  assert.equal(drawn.pop(), false, 'the journey over or stopped: the plate');
});

test('PASSAGE wiring by source: the host\'s Come Sail Away seam is the passenger\'s wrapper over the boat at the helm and the journey\'s hand; the journey\'s taps are its own and spent with the panel\'s; the journey is handed the built water (mutants: unwrapped, unwired)', () => {
  assert.match(WORLD, /    input: passengerHelm\(\{   \/\/ PASSAGE-HANDS[^\n]*\n\s+has: \(action\) => held\(keys, action\)/);
  // AUDIT FB1021d PS-1: the host's water reader tells ground not built from land (a sailed leg's mark waits for it)
  assert.match(WORLD, /function tvSeaWaterAt\(x, z\) \{\n\s+const t = csaTerrainOf\(csaPixelAt\(x, z\)\);\n\s+if \(!t\) return null;/);
  assert.match(WORLD, /\.\.\.csaInput,[^\n]*\n {4}\}, \(\) => csaRuntime\?\.state\?\.CurrentBoat, csaJourneyHelm\),/);
  assert.match(WORLD, / {2}const csaJourneyHelm = createJourneyHand\(\);/);
  assert.match(WORLD, /csaHelmInput\.edges\.clear\(\); csaHelmInput\.chord\.clear\(\); csaJourneyHelm\.edges\.clear\(\);/);
  assert.equal((WORLD.match(/csaJourneyHelm\.press\(CSA_BOAT_ACTIONS\.(toggleSail|disembark)\)/g) ?? []).length, 3, 'the hand\'s sails twice and its landfall');
  assert.match(WORLD, /    seaWaterAt: \(x, z\) => tvSeaWaterAt\(\.\.\.state\.localFromWorld\(x, z\)\),/);
});
