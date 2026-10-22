// HORSE-WALK (2026-10-12, the owner: "when youre riding a horse, it walks by default and to gallop you must shift to
// sprint, just like when you are walking as a character") - THE WALK (bible/06-Systems/Horse-Care.md THE WALK): horse
// care's horse walks unless the run gallops it. The law (player/motor.js - the walk on DFU's walk base, its base for
// IsMovingLessThanHalfSpeed, the gallop on the ride base as ever; systems/transport.js setRideWalk; systems/upkeep/upkeepRuntime.js
// rideWalks), and everything that reads the gait: the riding sprite and its clop (systems/riding.js, player/mountRig.js),
// the peers' clop (the pose's `hs`, motor.js slowRide), the 3D horse under its rider (world/horseModel.js gaitFor's
// `gallops`, world/horseRig.js, player/mwView.js, net/peer/peerBodies.js), the saddle panel (ui/enhanced/enhancedSaddle.js,
// scenes/saddleHost.js), a town under Roleplay & Realism (TOWN-GALLOP: Galloping In Towns on, as the port ships it), the
// Features row, the Horses tutorial and the four hosts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HORSE_CARE_HARD as HARD } from '../../src/systems/upkeep/upkeepTiers.js';   // HORSE-TIERS (PIN MOVED): the upkeep is handed a tier's rules - these pins pin the system as it stood, Hard
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { PlayerMotor } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { TRANSPORT_MODES, setRideWalk, rideWalks, setGallopGate, setCanRunOverride } from '../../src/systems/transport.js';
import { createUpkeep } from '../../src/systems/upkeep/upkeepRuntime.js';
import { steedStats, steedSpeedScale, WINDED_UNTIL } from '../../src/systems/steedCare.js';
import { RidingAnimator, RIDING_SOUND, RIDING_VOLUME_SCALE, ANIM_FRAME_TIME, WALK_FRAME_TIME } from '../../src/systems/riding.js';
import { gaitFor, horseGait, stepHorseGait, gaitShare } from '../../src/world/horseModel.js';
import { createHorseRig } from '../../src/world/horseRig.js';
import { saddleGait, drawEnhancedSaddle, hideEnhancedSaddle } from '../../src/ui/enhanced/enhancedSaddle.js';
import { createSaddleHost } from '../../src/scenes/saddleHost.js';
import { AudioEngine } from '../../src/systems/audio.js';
import { RemotePlayers } from '../../src/net/remotePlayers.js';
import { SOUND } from '../../src/systems/soundClips.js';
import { FEATURES } from '../../src/systems/features.js';
import { TUTORIALS } from '../../src/systems/tutorialCatalogue.js';
import { setModSetting, onlineModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { rrRidingOn, rrCanRunRiding, rrRidingSetting, RR_VENDOR } from '../../src/systems/roleplayRealism/rrRealism.js';
import { fakeDoc, one } from '../decorFakes.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const near = (a, b) => Math.abs(a - b) < 1e-6;
const horse = (seed, extra = {}) => ({ group: 'Transportation', templateIndex: 94, horseSeed: seed, ...extra });
const T0 = 2_000_000;
const BAKE = JSON.parse(rd('src/assets/horse/courser.json'));
/** DFU's own numbers (PlayerSpeedChanger): the walk base 150, the ride base 375, the classic-to-Unity ratio 39.5. */
const WALK_50 = (50 + 150) / 39.5;   // the walk at Speed 50 - 5.06 m/s
const RIDE_50 = (50 + 375) / 39.5;   // DFU's ride at Speed 50 - 10.76 m/s

const STILL = { forward: 0, strafe: 0, run: false, sneak: false, jump: false, up: false, down: false };
/** A motor on a floor, standing, stats DFU's shape (Speed 50, Running 40). */
function motorOn() {
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const col = new Collider(() => 0);
  col.addMesh('floor', new Float32Array([-500, 0, -500, 500, 0, -500, 500, 0, 500, -500, 0, 500]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  const m = new PlayerMotor(col, { speed: 50, running: 40, agility: 50, strength: 50, endurance: 50, willpower: 50, swimming: 0, climbing: 0 });
  m.spawn(0, 0.1, 0);
  for (let f = 0; f < 5; f++) m.update(1 / 60, STILL, 0);
  return m;
}
/** One step forward with `input` held. */
const ride = (m, input = {}) => m.update(1 / 60, { ...STILL, forward: 1, ...input }, 0);

test('HORSE-WALK THE WALK IN THE MOTOR: where the seam says a horse walks, it walks on DFU\'s walk base ((Speed + 150) / 39.5, undragged as every ride arm is) at its own pace, and the run gallops it on the ride base x (1.35 + Running / 200) as ever; the walk is its base, so a walk is never under half speed and a sneak is; winded with Run held it walks; anything but the seam\'s true keeps DFU\'s ride; a mode change drops the gait (mutants: HORSEWALK-walk-base-unread, -walk-base-crouch, -half-base-ride, -walking-while-galloping, -walking-without-word, -mode-change-keeps-gait, -slowride-half-only, -seam-truthy, -seam-on-foot)', () => {
  const m = motorOn();
  m.transportMode = TRANSPORT_MODES.Horse;
  m.rideSpeedScale = 1.1;
  try {
    ride(m);
    assert.ok(near(m.speed, RIDE_50 * 1.1), `no word: DFU's ride (${m.speed})`);
    assert.deepEqual([m.rideWalking, m.slowRide], [false, false]);
    for (const word of [false, null, 1, 'yes']) {
      setRideWalk(() => word);
      ride(m);
      assert.ok(near(m.speed, RIDE_50 * 1.1), `${JSON.stringify(word)}: only true walks`);
    }
    setRideWalk(() => true);
    assert.deepEqual([rideWalks(TRANSPORT_MODES.Horse), rideWalks(TRANSPORT_MODES.Foot)], [true, false], 'on foot nothing walks a ride');
    setRideWalk((mode) => mode === TRANSPORT_MODES.Horse);
    setGallopGate(() => true);
    ride(m);
    assert.ok(near(m.speed, WALK_50 * 1.1), `the walk at its horse's pace (${m.speed})`);
    assert.deepEqual([m.rideWalking, m.isRunning, m.movingLessThanHalfSpeed, m.slowRide], [true, false, false, true]);
    assert.ok(near(m._halfSpeedBase(), WALK_50 * 1.1), 'the walk is its base (GetBaseSpeed)');
    ride(m, { run: true });
    assert.ok(near(m.speed, RIDE_50 * (1.35 + 40 / 200) * 1.1), `the run gallops it on the ride base (${m.speed})`);
    assert.deepEqual([m.rideWalking, m.isRunning, m.movingLessThanHalfSpeed, m.slowRide], [false, true, false, false]);
    ride(m, { sneak: true });
    assert.ok(near(m.speed, (WALK_50 * 1.1) / 2 - 1 / 39.5), 'a sneak halves the walk, less a classic unit');
    assert.deepEqual([m.rideWalking, m.movingLessThanHalfSpeed, m.slowRide], [true, true, true], 'and is under half its base');
    setGallopGate(() => false);
    ride(m, { run: true });
    assert.ok(near(m.speed, WALK_50 * 1.1), 'winded (the gate says no) with Run held: the walk');
    assert.deepEqual([m.isRunning, m.rideWalking], [false, true]);
    m.setTransportMode(TRANSPORT_MODES.Foot);
    assert.equal(m.rideWalking, false, 'off the horse at once - the next step derives it');
    m.setTransportMode(TRANSPORT_MODES.Cart);
    ride(m);
    assert.ok(near(m.speed, (50 + 250) / 39.5 * 1.1), 'the cart rolls on its own base');
    assert.equal(m.rideWalking, false);
  } finally { setRideWalk(null); setGallopGate(null); }
});

test('HORSE-WALK THE UPKEEP\'S WORD: a horse walks wherever horse care rules its gallop - care on, a horse, the one ridden born; a cart, care off, or no horse born keep DFU\'s ride (the gallop gate defers to the mod there) (mutants: HORSEWALK-upkeep-cart-walks, -upkeep-care-ignored, -upkeep-unborn-walks)', () => {
  let care = true;
  const items = [horse(2, { horseFed: T0 + 600 })];
  const u = createUpkeep({ items: () => items, now: () => T0, horseCare: () => (care ? HARD : null) });
  assert.deepEqual([u.rideWalks('Horse'), u.rideWalks('Cart'), u.rideWalks('Foot')], [true, false, false], 'a horse walks; a wagon rolls');
  care = false;
  assert.equal(u.rideWalks('Horse'), false, 'care off: DFU\'s horse');
  for (const pack of [[], [{ group: 'Transportation', templateIndex: 94 }]]) {
    const v = createUpkeep({ items: () => pack, now: () => T0, horseCare: () => HARD });
    assert.equal(v.rideWalks('Horse'), false, `${pack.length ? 'a horse not yet born' : 'no horse'}: DFU's ride`);
    assert.equal(v.gallopGate('Horse', null), null, 'and the gallop is not horse care\'s to give');
  }
});

test('HORSE-WALK END TO END: the hosts\' two words off one upkeep - the horse walks by default and gallops while Run is held, on its breath; winded it walks with Run held until its breath is back, then gallops again; horse care off it is DFU\'s, one pace and no run in the saddle', () => {
  const items = [horse(2, { horseFed: T0 + 600 })];
  let care = true;
  const u = createUpkeep({ items: () => items, now: () => T0, horseCare: () => (care ? HARD : null) });
  const m = motorOn();
  m.transportMode = TRANSPORT_MODES.Horse;
  setCanRunOverride(null);
  setRideWalk((mode) => u.rideWalks(mode));
  setGallopGate((mode, mods) => u.gallopGate(mode, mods));
  try {
    const k = steedSpeedScale(steedStats(items[0], T0).stats.speed);
    m.rideSpeedScale = u.rideScale('Horse');
    assert.equal(m.rideSpeedScale, k);
    ride(m);
    assert.ok(near(m.speed, WALK_50 * k), `it walks by default (${m.speed.toFixed(2)} m/s)`);
    ride(m, { run: true });
    assert.ok(near(m.speed, RIDE_50 * (1.35 + 40 / 200) * k), `and gallops with Run held (${m.speed.toFixed(2)} m/s)`);
    for (let i = 0; i < 400 && !u.breathOf().winded; i++) u.tick(0.1, { mode: 'Horse', galloping: true, moving: true });
    assert.equal(u.breathOf().winded, true);
    ride(m, { run: true });
    assert.deepEqual([m.isRunning, m.rideWalking, near(m.speed, WALK_50 * k)], [false, true, true], 'winded: Run held walks');
    for (let i = 0; i < 400 && u.breathOf().winded; i++) u.tick(0.1, { mode: 'Horse', moving: false });
    assert.equal(u.breathOf().winded, false, `${WINDED_UNTIL * 100}% back`);
    ride(m, { run: true });
    assert.deepEqual([m.isRunning, m.rideWalking], [true, false], 'and the run gallops it again');
    care = false;
    m.rideSpeedScale = u.rideScale('Horse');
    ride(m, { run: true });
    assert.deepEqual([m.isRunning, m.rideWalking, near(m.speed, RIDE_50)], [false, false, true], 'care off: DFU\'s ride, no run in the saddle');
  } finally { setRideWalk(null); setGallopGate(null); }
});

test('HORSE-WALK THE RIDING SPRITE AND ITS CLOP: a walk is the slow horse - the slow clop as a state from its first frame (the mount set the fast one), at half the volume, the sprite nodding on WALK_FRAME_TIME (0.25 s, twice DFU\'s 0.125); the gallop\'s first frame swaps to the fast clop on DFU\'s edge, at full volume and 1.2 pitch, on DFU\'s clock, every time (mutants: HORSEWALK-clop-edge-only, -edge-unarmed, -walk-volume-full, -walk-clock-dfu, -walk-clock-value)', () => {
  assert.deepEqual([ANIM_FRAME_TIME, WALK_FRAME_TIME], [0.125, 0.25]);
  const a = new RidingAnimator();
  a.mount(TRANSPORT_MODES.Horse, { rolls: () => 0.5 });
  assert.equal(a.clip, RIDING_SOUND.horseFast, 'UpdateMode mounts on the fast clop');
  const walk = { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: false, walking: true };
  const gallop = { mode: TRANSPORT_MODES.Horse, movingLessThanHalfSpeed: false, running: true };
  let r = a.update(0.01, walk);
  assert.deepEqual([r.clip, r.playing, near(r.volume, RIDING_VOLUME_SCALE * 0.5), r.pitch, r.frame], [RIDING_SOUND.horseSlow, true, true, 1, 0], 'the first walking frame: the slow clop, half the volume');
  assert.equal(a.update(0.2, walk).frame, 0, 'a walk holds its frame past the ride\'s 0.125 s');
  assert.equal(a.update(0.1, walk).frame, 1, 'and nods past 0.25 s');
  r = a.update(0.01, gallop);
  assert.deepEqual([r.clip, near(r.volume, RIDING_VOLUME_SCALE), r.pitch], [RIDING_SOUND.horseFast, true, 1.2], 'the gallop: the fast clop, the whole volume, the running pitch');
  assert.equal(a.update(0.1, gallop).frame, 1);
  assert.equal(a.update(0.05, gallop).frame, 2, 'on DFU\'s 0.125 s');
  for (let i = 0; i < 3; i++) {
    assert.equal(a.update(0.01, walk).clip, RIDING_SOUND.horseSlow, `walk ${i}`);
    assert.equal(a.update(0.01, gallop).clip, RIDING_SOUND.horseFast, `gallop ${i}: the edge is armed again`);
  }
  // a cart has no walk: the motor never says it walks, and its loop is its own
  const c = new RidingAnimator();
  c.mount(TRANSPORT_MODES.Cart, { rolls: () => 0.5 });
  assert.equal(c.update(0.01, { mode: TRANSPORT_MODES.Cart, movingLessThanHalfSpeed: false }).clip, RIDING_SOUND.cart);
});

test('HORSE-WALK THE OTHERS HEAR IT (AUDIT HORSE-WALK): a peer\'s clop through the real RemotePlayers plays the pose\'s slow ride (`hs`) as the rider\'s own animator plays the walk - a state, not the edge: first seen at a walk, the slow clop at half the volume from its first frame (on the edge alone it clopped fast until a first gallop); the gallop (hs gone, mv 2) the fast clop, whole, at the running pitch 1.2; a walk again the slow; every time (mutants: HORSEWALK-peer-walk-unread, -peer-gallop-pitch-unread, -peer-gallop-bit-any-move)', () => {
  const param = () => ({ value: 0 });
  const ctx = {
    state: 'running', destination: { connect(n) { return n; } },
    listener: { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() },
    createGain: () => ({ gain: param(), connect(n) { return n; }, disconnect() {} }),
    createPanner: () => ({ positionX: param(), positionY: param(), positionZ: param(), connect(n) { return n; }, disconnect() {} }),
    createBufferSource: () => ({ buffer: null, playbackRate: param(), loop: false, connect(n) { return n; }, start() {}, stop() {}, disconnect() {} }),
  };
  const e = new AudioEngine();
  e.ctx = ctx; e.enabled = true; e._ensureCtx = () => {};
  for (const k of [SOUND.HorseClop2, SOUND.HorseClop, SOUND.AnimalHorse]) e.buffers.set(k, { duration: 0.5 });
  const heard = [];
  const setLoop3d = e.setLoop3d.bind(e);
  e.setLoop3d = (name, clip, pos, opts) => { heard.push({ clip, volume: opts?.volume, pitch: opts?.pitch }); return setLoop3d(name, clip, pos, opts); };
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: e }, compose: async () => null });
  const peer = (o) => ({ id: 'ann-0001', name: 'ann', shown: { x: 1, y: 0, z: 4, yaw: 0, pitch: 0, wd: 0, an: 0, fk: 0, rd: 1, rv: 0, ...o }, look: null });
  const sync = (p) => { rp.sync([p], (sh) => [sh.x, sh.y, sh.z], { bodyHeight: () => 2, eye: [0, 1.7, 0], dt: 1 / 30 }); return heard.at(-1); };
  const slow = { clip: SOUND.HorseClop, volume: RIDING_VOLUME_SCALE * 0.5, pitch: 1 };
  const fast = { clip: SOUND.HorseClop2, volume: RIDING_VOLUME_SCALE, pitch: 1.2 };
  assert.deepEqual(sync(peer({ mv: 1, hs: 1 })), slow, 'first seen at a walk: the slow clop, half the volume');
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(sync(peer({ mv: 2 })), fast, `gallop ${i}: the fast clop, whole, at the running pitch`);
    assert.deepEqual(sync(peer({ mv: 1, hs: 1 })), slow, `walk ${i}`);
  }
});

/** scenes/world.js's own lines, lifted from its source and run (the tv8_party_walk technique). */
const WORLD = rd('src/scenes/world.js');
const liftWorld = (re, what) => { const m = re.exec(WORLD); assert.ok(m, `lifted from scenes/world.js: ${what}`); return m[1]; };

test('HORSE-WALK x THE OVERWORLD (the owner: "Ensure the overworld speed isnt affected"): ON THE ROAD THE RIDE KEEPS ITS PACE. world.js\'s own predicate and install, lifted from its source and run over the real motor and upkeep: under the Overworld\'s view - rising, up or falling - and while a journey\'s autopilot drives the motor, the horse rides DFU\'s ride and gallops as ever (at the view\'s x60 the ~650 m/s TV0 measured the clock against); the view down, or a journey\'s panel left up over a stopped journey, and it walks; the saddle panel reads the same word (mutants: HORSEWALK-road-ignored, -road-view-only, -road-journey-only, -road-panel-alone, -road-view-up-only, -saddle-reads-upkeep)', () => {
  const ROAD = liftWorld(/\n {2}(const rideOnTheRoad = \(\) => [^\n]*;)\n/, 'the road');
  const INSTALL = liftWorld(/\n {2}(setRideWalk\(\(mode, runAsked\) => [^\n]*?\);)/, 'the walk\'s install');   // HORSE-TIERS (PIN MOVED): the run asked rides with the question
  const travelView = { active: false, state: 'off' };
  const travelOptions = { isTravelActive: false, state: { autopilot: null } };
  const items = [horse(2, { horseFed: T0 + 600 })];
  const upkeep = createUpkeep({ items: () => items, now: () => T0, horseCare: () => HARD });
  const onTheRoad = new Function('d', `const { travelView, travelOptions, upkeep, setRideWalk } = d; ${ROAD} ${INSTALL} return rideOnTheRoad;`)({ travelView, travelOptions, upkeep, setRideWalk });
  const saddle = createSaddleHost({
    upkeep, runtime: () => null, items: () => items, wagonKg: () => 0, wagonLimit: () => 0, say: () => {}, pass: () => {},
    openStable: () => {}, canView: () => false, toggleView: () => {}, foot: () => {},
  });
  const m = motorOn();
  m.transportMode = TRANSPORT_MODES.Horse;
  setCanRunOverride(null);
  setGallopGate((mode, mods) => upkeep.gallopGate(mode, mods));
  // HORSE-TIERS (PIN MOVED): the panel reads the walk the motor TOOK, handed by the host's frame (saddleHost.motion's
  // `walk`, the motor's rideWalking) - so each step hands it, as the hosts do
  const step = (input) => { ride(m, input); saddle.motion(1 / 60, m.speed / 60, !!input?.run, m.rideWalking); };
  try {
    const k = upkeep.rideScale('Horse');
    m.rideSpeedScale = k;
    step();
    assert.deepEqual([onTheRoad(), near(m.speed, WALK_50 * k), saddle.read('Horse').walks], [false, true, true], 'off the road: the walk');
    for (const state of ['rising', 'up', 'falling']) {
      travelView.active = true; travelView.state = state;
      step();
      assert.ok(near(m.speed, RIDE_50 * k), `the Overworld's view ${state}: the ride's own pace (${m.speed.toFixed(2)} m/s, ${(m.speed * 60).toFixed(0)} m/s at x60)`);
      assert.deepEqual([m.rideWalking, m.slowRide, saddle.read('Horse').walks], [false, false, false], 'the clop, the 3D horse, the peers and the panel read the ride');
    }
    step({ run: true });
    assert.ok(near(m.speed, RIDE_50 * (1.35 + 40 / 200) * k), 'and Run gallops it as ever');
    travelView.active = false; travelView.state = 'off';
    travelOptions.isTravelActive = true;
    step();
    assert.ok(near(m.speed, WALK_50 * k), 'a journey\'s panel left up over a stopped journey (no autopilot): the walk');
    travelOptions.state.autopilot = {};
    step();
    assert.ok(near(m.speed, RIDE_50 * k), 'a journey under way - the view\'s on the ground at x1, First-Person Travel\'s, a party\'s: the ride\'s pace');
    assert.equal(saddle.read('Horse').walks, false);
    travelOptions.isTravelActive = false; travelOptions.state.autopilot = null;
    step();
    assert.deepEqual([near(m.speed, WALK_50 * k), saddle.read('Horse').walks], [true, true], 'off the road again: the walk');
  } finally { setRideWalk(null); setGallopGate(null); }
});

/** The GL half's doors the rig's load and step use (test/formats/morrowind/coats3d_horse3d.test.js records them all). */
function stepRenderer() {
  const r = { uploads: 0 };
  return Object.assign(r, {
    createSkinnedCharacterMesh: (stream, o) => ({ vao: {}, vbo: {}, count: stream.length / o.floats, floats: o.floats, skin: r.createSkinPalette(o) }),
    createSkinPalette: (o) => ({ tex: {}, ...o }),
    releaseCharacterSkin: (mesh) => { if (mesh?.skin) mesh.skin.tex = null; },
    createCharacterTexture: (mips) => ({ mips: mips.length }),
    releaseCharacterTexture: () => {},
    updateSkinPalette: () => { r.uploads++; },
  });
}

test('HORSE-WALK THE 3D HORSE UNDER ITS RIDER: a slow ride (gallops false - the motor\'s slowRide, the pose\'s hs) never plays the gallop. Daggerfall\'s walk, about 5 m/s, stands inside the gallop\'s hold, so a horse left galloping at it galloped on in slow motion; held under, it trots from anywhere, a gallop playing fades out at once, and the run brings the gallop back; an unridden horse keeps COATS3D\'s law (mutants: HORSEWALK-gait-ceiling-ignored, -gallop-held-over-ceiling, -step-word-dropped, -rig-word-dropped, -own-horse-ungated, -peer-horse-ungated)', async () => {
  assert.equal(gaitFor(WALK_50, 'gallop'), 'gallop', 'unridden, the hold keeps a gallop at the walk\'s pace (COATS3D, unchanged)');
  assert.deepEqual(['idle', 'walk', 'trot', 'gallop'].map((c) => gaitFor(WALK_50, c, false)), ['trot', 'trot', 'trot', 'trot'], 'held under the gallop: a trot, from any gait');
  assert.deepEqual([gaitFor(17.2, 'trot', false), gaitFor(17.2, 'gallop', false), gaitFor(0.5, 'gallop', false), gaitFor(0, 'gallop', false)], ['trot', 'trot', 'walk', 'idle']);
  assert.deepEqual([gaitFor(17.2, 'trot', true), gaitFor(17.2, 'trot')], ['gallop', 'gallop'], 'the run lets it gallop');
  const g = horseGait();
  for (let i = 0; i < 10; i++) stepHorseGait(g, BAKE, 17.2, 0.1, 7);
  assert.deepEqual([g.gait, g.from], ['gallop', null]);
  stepHorseGait(g, BAKE, WALK_50, 0.1, 7, false);
  assert.deepEqual([g.gait, g.from], ['trot', 'gallop'], 'the gallop ends the step its rider walks');
  assert.ok(gaitShare(g, 'gallop') > 0 && gaitShare(g, 'gallop') < 1, 'faded, not cut');
  for (let i = 0; i < 5; i++) stepHorseGait(g, BAKE, WALK_50, 0.1, 7, false);
  assert.deepEqual([g.gait, g.from, gaitShare(g, 'gallop')], ['trot', null, 0]);
  // the rig's own step carries the word
  const rig = createHorseRig({
    renderer: stepRenderer(),
    fetchJson: async () => BAKE,
    fetchBytes: async (u) => new Uint8Array(readFileSync(new URL(u))),
    decode: async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; },
  });
  await rig.load();
  assert.equal(rig.ready(), true);
  const h = rig.horse(3);
  for (let i = 0; i < 10; i++) rig.step(h, { feet: [0, 0, 0], yaw: 0, speed: 17.2, dt: 0.1 });
  assert.equal(h.gait.gait, 'gallop', 'no word: its speed\'s gait');
  rig.step(h, { feet: [0, 0, 0], yaw: 0, speed: WALK_50, dt: 0.1, gallops: false });
  assert.equal(h.gait.gait, 'trot', 'its rider\'s slow ride');
  rig.release(h);
  // the player's horse holds to the host's slow ride, a peer's to its pose's hs
  assert.match(rd('src/player/mwView.js'), /look: horse\.look \| 0, gallops: !horse\.slow \}\);/);
  assert.match(rd('src/net/peer/peerBodies.js'), /look: shown\.rc \| 0, gallops: !shown\.hs, pose: false \}\);/);   // PIN MOVED (HORSE-VIEW): the gait alone stepped here - the pose waits for the rider's
});

test('HORSE-WALK THE SADDLE PANEL SAYS IT: Walking where horse care walks the horse, Galloping on the run, Trotting at DFU\'s ride (care off, or on the road), Rolling on a bench, Standing still; the host reads the very walk the motor took (its rideWalking, handed by the host\'s frame - HORSE-TIERS, PIN MOVED: the motor alone knows a gallop asked and refused), and the panel draws it (mutants: HORSEWALK-saddle-trots, -saddle-cart-walks, -saddle-host-unread, -saddle-panel-unread)', () => {
  assert.deepEqual(
    [saddleGait('Horse', 5, false, true), saddleGait('Horse', 17, true, true), saddleGait('Horse', 11, false, false), saddleGait('Horse', 11), saddleGait('Cart', 7, false, true), saddleGait('Horse', 0.1, false, true)],
    ['Walking', 'Galloping', 'Trotting', 'Trotting', 'Rolling', 'Standing'],
  );
  let walks = true;
  const upkeep = {
    saddle: () => ({ horse: null, wagon: null, oats: 0, apples: 0, kits: 0 }),
    act: () => null,
    rideWalks: () => { throw new Error('the panel reads the installed word, never the upkeep\'s own'); },
  };
  const host = createSaddleHost({
    upkeep, runtime: () => null, items: () => [], wagonKg: () => 0, wagonLimit: () => 0, say: () => {}, pass: () => {},
    openStable: () => {}, canView: () => false, toggleView: () => {}, foot: () => {},
  });
  const doc = fakeDoc();
  setRideWalk(() => { throw new Error('the panel reads the walk the motor took, never the installed word'); });
  try {
    host.motion(1 / 60, 0.08, false, walks);
    assert.deepEqual([host.read('Horse').walks, host.read('Cart').walks], [true, false]);
    walks = false;
    host.motion(1 / 60, 0.18, false, walks);
    assert.equal(host.read('Horse').walks, false, 'care off, or on the road: the motor\'s word, handed each frame');
    const saddle = { mode: 'Horse', name: 'Shadow', wagonName: '', speed: WALK_50, galloping: false, walks: true, horse: null, wagon: null, oats: 0, apples: 0, kits: 0, load: null, near: true, wagonNear: false, cargo: null, view: false, hcc: false };
    const root = drawEnhancedSaddle({ saddle, keyOf: () => 'LEFTSHIFT', mouseFree: true }, {}, { doc });
    assert.equal(one(root, 'saddlepanel-gait').textContent, 'Walking · 18 km/h');
  } finally { hideEnhancedSaddle(); setRideWalk(null); }
});

test('HORSE-WALK THE HOSTS (world.js, exterior.js): the walk installed beside the gallop, off the one upkeep; the 3D horse handed the motor\'s slow ride; the riding sprite its walk (mountRig.js, both hosts\' one rig); the peers the slow ride on the pose\'s hs (world.js, the online host). THE FOUR HOSTS: worldModes.js (interiors) and dungeonContext.js (dungeons) stand no transport - a building or a dungeon puts the rider on foot (transport.js dismountOnTransition) - and are named, not wired (mutants: HORSEWALK-host-install, -host-slow-unhanded, -peers-hear-half-only, -mountrig-unwalked)', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    assert.match(s, /import \{ setGallopGate, setRideWalk \} from '\.\.\/systems\/transport\.js';/, host);
    // HORSE-TIERS (PIN MOVED): the run asked rides with the question
    const install = host.endsWith('world.js') ? 'setRideWalk\\(\\(mode, runAsked\\) => !rideOnTheRoad\\(\\) && upkeep\\.rideWalks\\(mode, runAsked\\)\\);' : 'setRideWalk\\(\\(mode, runAsked\\) => upkeep\\.rideWalks\\(mode, runAsked\\)\\);';
    assert.match(s, new RegExp(`\\n\\s*${install}[^\\n]*\\n\\s*setGallopGate\\(\\(mode, mods\\) => upkeep\\.gallopGate\\(mode, mods\\)\\);`), `${host}: the walk beside the gallop (world.js never on the road - the Overworld's view and the journeys are its alone)`);
    assert.match(s, /\{ look: riddenHorseLook\(playerEntity\.items \?\? \[\]\), slow: player\.slowRide \}/, `${host}: the 3D horse held on a slow ride`);
  }
  assert.match(rd('src/scenes/world.js'), /_hsLatch = player\.slowRide; \}/, 'the peers hear the slow ride');
  assert.match(rd('src/player/mountRig.js'), /\n\s*walking: !!player\.rideWalking,/, 'the riding sprite and its clop');
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.equal(/setRideWalk\(|rideWalks\(/.test(rd(host)), false, `${host}: no transport indoors`);
});

/** systems/roleplayRealism/rrInstall.js's own line - Roleplay & Realism's CanRun on a mount (CanRunUnlessRidingCart) - lifted from its
 *  source and run, as the Overworld's lines are world.js's. */
const RR_INSTALL = rd('src/systems/roleplayRealism/rrInstall.js');

test('HORSE-WALK IN A TOWN (TOWN-GALLOP, 2026-10-13, Mac: "Remove forced horse walking in towns"): Roleplay & Realism as the port ships it - Enhanced Riding on, Galloping In Towns ON, where the mod ships it off - lets Run gallop a horse in a town as out of one, and there it walks unless Run gallops it, as everywhere; online the room reads the port\'s on whatever a player saved. The mod\'s own rule, Galloping In Towns off, is the town walk AUDIT HORSE-WALK pinned: Run held walks a horse in a town and gallops it out of one. The mod\'s own CanRun line, lifted from its source and run over the real upkeep and motor (mutants: TOWNGALLOP-town-walks-as-shipped, TOWNGALLOP-room-walks-in-town, TOWNGALLOP-room-leaves-it-to-the-player, TOWNGALLOP-setting-unread)', () => {
  const m0 = /\n {2}(setCanRunOverride\(\(mode\) => \(rrRidingOn\(\)[\s\S]*?: null\)\);)\n/.exec(RR_INSTALL);
  assert.ok(m0, 'lifted from systems/roleplayRealism/rrInstall.js: the mod\'s CanRun');
  let town = true;
  const items = [horse(2, { horseFed: T0 + 600 })];
  const u = createUpkeep({ items: () => items, now: () => T0, horseCare: () => HARD });
  const m = motorOn();
  m.transportMode = TRANSPORT_MODES.Horse;
  _resetModSettings();
  new Function('d', `const { setCanRunOverride, rrRidingOn, rrCanRunRiding, rrRidingSetting, _host } = d; ${m0[1]}`)({
    setCanRunOverride, rrRidingOn, rrCanRunRiding, rrRidingSetting, _host: { riding: () => true, inTown: () => town },
  });
  setRideWalk((mode) => u.rideWalks(mode));
  setGallopGate((mode, mods) => u.gallopGate(mode, mods));
  try {
    const k = u.rideScale('Horse');
    m.rideSpeedScale = k;
    const GALLOP = RIDE_50 * (1.35 + 40 / 200) * k;
    assert.deepEqual([rrRidingOn(), rrRidingSetting('GallopingInTowns')], [true, true], 'the mod as the port ships it');
    ride(m);
    assert.deepEqual([m.isRunning, m.rideWalking, near(m.speed, WALK_50 * k)], [false, true, true], 'in a town, no Run: the walk');
    ride(m, { run: true });
    assert.deepEqual([m.isRunning, m.rideWalking, near(m.speed, GALLOP)], [true, false, true], `in a town, Run held: the gallop (${m.speed.toFixed(2)} m/s)`);
    town = false;
    ride(m, { run: true });
    assert.deepEqual([m.isRunning, near(m.speed, GALLOP)], [true, true], 'out of town: the gallop');
    setModSetting(RR_VENDOR, 'EnhancedRiding.GallopingInTowns', false);
    assert.equal(onlineModSetting(RR_VENDOR, 'EnhancedRiding.GallopingInTowns', '?online=1'), true, 'online the room gallops in a town, whatever a player saved (Roleplay & Realism is the room\'s whole: onlineLane.js ONLINE_WHOLE_MODS)');
    town = true;
    ride(m, { run: true });
    assert.deepEqual([m.isRunning, m.rideWalking, near(m.speed, WALK_50 * k)], [false, true, true], `the mod's own rule, Galloping In Towns off - in a town, Run held: the walk (${m.speed.toFixed(2)} m/s)`);
    town = false;
    ride(m, { run: true });
    assert.equal(m.isRunning, true, 'and out of town the gallop');
  } finally { setCanRunOverride(null); setRideWalk(null); setGallopGate(null); _resetModSettings(); }
});

test('HORSE-WALK THE WORDS: the Features row and the Horses tutorial say the horse walks and Run gallops it - in a town too since TOWN-GALLOP (AUDIT HORSE-WALK\'s "outside towns" retired with the town walk), and the tutorial says what a gallop into the people of a town does: the trample Roleplay & Realism ships on (TUT1: a slice that changes how a system plays changes its page) (mutants: TOWNGALLOP-tutorial-towns-back, TOWNGALLOP-tutorial-trample-dropped, TOWNGALLOP-trample-ships-off)', () => {
  assert.match(FEATURES.find((f) => f.id === 'horse-care').note, /walks unless you hold Run to gallop, which tires it/);
  assert.ok(TUTORIALS.find((t) => t.id === 'horse').body.some((b) => b.includes('Your horse walks; hold {Run} to gallop. Do not gallop into people in town: trampling them is a crime.')));
  _resetModSettings();
  assert.equal(rrRidingSetting('TrampleCivilians'), true, 'the trample the page warns of ships on');
});
