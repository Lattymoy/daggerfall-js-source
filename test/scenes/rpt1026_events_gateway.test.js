// RPT1026-EVENTS GATE-WAY (two private reports: Portal Stone portals opened at the mouth of a breach or another event to carry
// the arriving crowd elsewhere, and a breach's gate walled with a parked wagon while a portal was laid in it as the gate opened,
// more than once): AN EVENT'S GATE KEEPS ITS WAY CLEAR. While a gate
// stands on a screen, no Portal Stone's portal stands within EVENT_GROUND_M of it there - its opener's pick refuses the place,
// a peer's word of one is not believed, one already open closes and takes nobody - and another player's wagon parked there
// is not drawn (systems/eventGround.js). The real gate pool (scenes/gate/gatePool.js) says where its gate stands; the real
// portal pool (scenes/portalGates.js), the stone's real pick (systems/portalStone.js) and the real cart pool
// (scenes/horseCartPool.js) ask it. tools/mutants/rpt1026_events.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EVENT_GROUND_M, setEventGround, eventGroundAt, groundNear } from '../../src/systems/eventGround.js';
import { createGatePool } from '../../src/scenes/gate/gatePool.js';
import { gateTimes, GATE_RISE_MS } from '../../src/net/gate/gateLaw.js';
import { createPortalGates } from '../../src/scenes/portalGates.js';
import { createEgCallPortal } from '../../src/scenes/eliteGates/egCall.js';
import { portalPlace, portalStonePlace, PORTAL_TEXT } from '../../src/systems/portalStone.js';
import { createHorseCartPool } from '../../src/scenes/horseCartPool.js';
import { HCC_WIRE_KIND } from '../../src/systems/horse/horseCartWire.js';
import { createEgArchPool } from '../../src/scenes/eliteGates/egArch.js';
import { signEgCall } from '../../src/net/eliteGates/egCallSig.js';
import { createStarfallHost } from '../../src/scenes/starfall/starfallHost.js';
import { starNightAt, starTimes, STAR_LIFE_MS } from '../../src/net/starfall/starfallLaw.js';
import { STAR_COVENS, starCovenOf } from '../../src/systems/starfall/starfallCovens.js';
import { FESTIVALS } from '../../src/net/festivalLaw.js';

const tickAsync = () => new Promise((r) => setTimeout(r, 0));
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await tickAsync(); };

/** The gate standing, sealed and risen (test/scenes/gateseen.test.js's world): its foot at (409.6, 12, 409.6), its phase
 *  `phase` (null: none standing). */
function gateWorld(phase = 'sealed') {
  const t = gateTimes(700);
  const clock = { now: t.riseAt + GATE_RISE_MS + 1000 };
  const g = { day: 700, px: 400, py: 200, spot: [409.6, 409.6], t, fellAt: null, near: 'Copperham' };
  const state = { phase };
  const pool = createGatePool({
    renderer: { createMesh: () => ({ stone: true }), uploadTexture() {}, uploadEmissionTexture() {} }, gl: null,
    collider: () => ({ addMesh() {}, removeBucket() {} }),
    standing: () => (state.phase ? { ...g, phase: state.phase } : null),
    pixelTranslation: () => [0, 0, 0], heightAt: () => 12, groundAt: () => 12, now: () => clock.now, feet: () => null,
  });
  pool.frame(0.016);
  return { pool, state, clock, foot: [409.6, 12, 409.6] };
}
const off = (p, dx, dz = 0) => [p[0] + dx, p[1], p[2] + dz];

test('RPT1026-EVENTS GATE-WAY THE LAW: a point within EVENT_GROUND_M of a gate a pool stands is that pool\'s ground; past it, or with the pool gone, none; a pool that throws stands nothing; the height never counts (mutants: the reach off; the pool unread)', () => {
  assert.equal(EVENT_GROUND_M, 40);
  assert.deepEqual(groundNear([[0, 0, 0]], [30, 100, 26]), [0, 0, 0], 'the ground, whatever the height');
  assert.equal(groundNear([[0, 0, 0]], [40.1, 0, 0]), null);
  setEventGround('t-pool', () => [[100, 0, 100]]);
  setEventGround('t-throws', () => { throw new Error('no'); });
  try {
    assert.equal(eventGroundAt([100 + EVENT_GROUND_M - 0.5, 0, 100]), 't-pool');
    assert.equal(eventGroundAt([100 + EVENT_GROUND_M + 0.5, 0, 100]), null);
    assert.equal(eventGroundAt(null), null);
  } finally { setEventGround('t-pool', null); setEventGround('t-throws', null); }
  assert.equal(eventGroundAt([100, 0, 100]), null, 'a pool let go stands nothing');
});

test('RPT1026-EVENTS GATE-WAY THE GATE\'S GROUND: the real gate pool says its gate\'s foot while it stands - rising, sealed, open, collapsing - and nothing once it is gone (mutants: the gate never said)', () => {
  const W = gateWorld('sealed');
  try {
    assert.ok(W.pool.place(), 'the gate stands');
    assert.equal(eventGroundAt(W.foot), 'gate');
    assert.equal(eventGroundAt(off(W.foot, EVENT_GROUND_M - 1)), 'gate', 'at its edge');
    assert.equal(eventGroundAt(off(W.foot, EVENT_GROUND_M + 1)), null, 'past it');
    W.state.phase = 'open'; W.pool.frame(0.016);
    assert.equal(eventGroundAt(off(W.foot, 0, 12)), 'gate', 'open, before its fire');
    W.state.phase = null; W.pool.frame(0.016);
    assert.equal(eventGroundAt(W.foot), null, 'gone: no ground');
  } finally { setEventGround('gate', null); }
});

test('RPT1026-EVENTS GATE-WAY THE PICK: a Portal Stone\'s portal is refused before a standing gate - `event`, nothing spent, its line said - and stands where it stood before past the ground; an Elite Breach\'s call opens its own as ever (mutants: the stone\'s pick unasked)', () => {
  const W = gateWorld('sealed');
  try {
    const ground = () => 1, probes = { ground };
    const near = portalStonePlace(off(W.foot, 10, 1), 0, probes);
    assert.deepEqual(near, { refused: 'event' }, 'two metres on from ten off the gate: on its ground');
    assert.ok(PORTAL_TEXT.event.length > 0 && PORTAL_TEXT[near.refused] === PORTAL_TEXT.event, 'the line the host says (world.js standPortal: PORTAL_TEXT[place.refused])');
    assert.ok(portalStonePlace(off(W.foot, 60, 1), 0, probes).at, 'past the ground: placed');
    assert.ok(portalPlace(off(W.foot, 10, 1), 0, probes).at, 'the place law itself unchanged - the call\'s portal is the way in');
  } finally { setEventGround('gate', null); }
  const world = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /const place = portalStonePlace\(feet, cam\.yaw, \{/, 'the world host\'s pick asks the stone\'s place');
});

test('RPT1026-EVENTS GATE-WAY A PEER\'S PORTAL: a word of one on a standing gate\'s ground is not believed; one already standing when the gate rises beside it closes and takes nobody stepping in; past the ground a peer\'s stands; the Elite call\'s pool keeps its own there (mutants: the peer\'s word believed; the standing one left open)', () => {
  const W = gateWorld(null);
  let now = 1000;
  const entered = [];
  const gates = createPortalGates({ now: () => now, destOf: (x, y) => ({ pixel: { x, y }, name: 'Wayrest' }), onEnter: (g) => entered.push(g) });
  const opener = createPortalGates({ now: () => now });
  try {
    // before the gate rises: a peer's portal ten metres from where it will stand, believed
    opener.open(off(W.foot, 10, 0), { pixel: { x: 40, y: 40 }, name: 'Wayrest' });
    const word = opener.wireRecord(off(W.foot, 9, 0));
    assert.ok(word, 'the opener\'s own record');
    assert.equal(gates.applyOwner('p1', word, off(W.foot, 9, 0)), true, 'no gate yet: believed');
    // the gate rises: the standing portal closes, and a step into it takes nobody
    W.state.phase = 'rising'; W.pool.frame(0.016);
    for (const x of [8, 9, 10]) { now += 100; gates.tick(off(W.foot, x, 0)); }
    assert.equal(entered.length, 0, 'nobody taken');
    assert.equal(gates.gates.length, 0, 'it closed');
    // a word of a new one there is refused while the gate stands
    const opener2 = createPortalGates({ now: () => now });
    opener2.open(off(W.foot, -12, 3), { pixel: { x: 40, y: 40 }, name: 'Wayrest' });
    assert.equal(gates.applyOwner('p2', opener2.wireRecord(off(W.foot, -12, 2)), off(W.foot, -12, 2)), false, 'refused on the ground');
    const opener3 = createPortalGates({ now: () => now });
    opener3.open(off(W.foot, 70, 0), { pixel: { x: 40, y: 40 }, name: 'Wayrest' });
    assert.equal(gates.applyOwner('p3', opener3.wireRecord(off(W.foot, 69, 0)), off(W.foot, 69, 0)), true, 'past it: believed');
    // the Elite call's own portal, opened on the ground, stands - it is the way into an event
    const call = createEgCallPortal({ now: () => now });
    assert.ok(call.open(off(W.foot, 5, 0), 0, { ground: () => 1 }).at, 'opened');
    call.tick(off(W.foot, 30, 0));
    assert.equal(call.standing(), true, 'and kept');
  } finally { setEventGround('gate', null); }
});

test('RPT1026-EVENTS GATE-WAY A CARAVAN IN THE GATE: another player\'s wagon parked on a standing gate\'s ground draws nothing on my screen, its team neither, and offers no press; one parked past it draws, and my own parked there draws (mutants: their wagon drawn on the ground)', async () => {
  const W = gateWorld('sealed');
  try {
    const draws = [];
    const r = { uploadTexture() {}, evictTexture() {}, createMesh: (model) => ({ model }), drawMesh: (gpu, m) => draws.push([...m]), recordShadowMesh() {}, createBillboardBatch: () => ({ origin: [0, 0, 0] }), destroyBillboardBatch() {} };
    const bake = (k) => JSON.parse(readFileSync(new URL(`../../src/assets/wagons/${k}.json`, import.meta.url), 'utf8'));
    const pool = createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, wagonKind: () => 'openWagon', bakedWagon: async (k) => bake(k), peerAnchor: () => null });
    const mine = off(W.foot, 3, -8);
    pool.attach({ view: () => ({ state: { HorseName: '', HorseMode: 0, Mode: 2, WorldX: 0, WorldZ: 0 }, moving: null, deployed: { isGrounded: true, position: mine, rotation: [0, 0, 0, 1], cargoTier: 0 }, horse: null, teamFollowing: false, horseFollowing: false, persistence: true }), lateUpdate() {}, actionRows: () => [] });
    pool.partsOf('openWagon'); await flush();
    const parked = (p) => [HCC_WIRE_KIND.Deployed, p[0], p[1], p[2], 0, 0, 0, 1, 0, 0];
    const inGate = off(W.foot, 0, 4), past = off(W.foot, 70, 0);
    pool.applyOwner('griefer', { w: parked(inGate), wk: 1 }, (q) => q, 0);
    pool.applyOwner('honest', { w: parked(past), wk: 1 }, (q) => q, 0);
    pool.frame(1 / 60, W.foot);
    draws.length = 0;
    pool.draw(r);
    const near = (p, reach = 6) => draws.some((m) => Math.hypot(m[12] - p[0], m[14] - p[2]) < reach);
    assert.equal(near(inGate), false, 'theirs in the gate: nothing drawn');
    assert.ok(near(past), 'theirs past the ground: drawn');
    assert.ok(near(mine), 'mine: drawn - mine to move');
    assert.equal(pool.teamOf('griefer').length, 0, 'no team stood for it');
    assert.equal(pool.peers.get('griefer').offGround, true);
  } finally { setEventGround('gate', null); }
});

test('RPT1026-EVENTS GATE-WAY AN ELITE BREACH\'S ARCH: the real arch pool says the foot of every arch it stands - the company\'s, from the hub\'s signed call - and nothing once there is none (mutants: the arches never said)', async () => {
  const { subtle } = globalThis.crypto;
  const T0 = 1_800_000_000_000, B = '0123456789abcdef', ME = 'acct-mac', SITE = { px: 300, py: 200, x: 409.6, y: 0, z: 380, yaw: 0 };
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  let clock = T0;
  const pool = createEgArchPool({
    renderer: { createMesh: (m) => ({ m }), uploadTexture() {}, uploadEmissionTexture() {}, drawMesh() {} },
    collider: () => ({ addMesh() {}, removeBucket() {} }),
    pixelTranslation: () => [0, 0, 0], heightAt: () => 0, now: () => clock, feet: () => [409.6, 0, 360], me: () => ME,
    say: () => {}, onStep: () => {}, verifyKey: async () => kp.publicKey,
  });
  try {
    assert.equal(eventGroundAt([409.6, 0, 380]), null, 'no arch: no ground');
    pool.call({ b: B, o: 'Mac', os: ME, op: T0, ew: 0, site: SITE, co: [[ME, 'Mac', 1]], sg: await signEgCall({ b: B, o: 'Mac', os: ME, op: T0, ew: 0, site: SITE }, kp.privateKey, { subtle }) });
    clock = T0 + 30_000;
    pool.frame(0.016);
    assert.deepEqual(pool.arches.get(B).place.origin, [409.6, 0, 380]);
    assert.equal(eventGroundAt([409.6 + EVENT_GROUND_M - 1, 0, 380]), 'arch', 'its ground');
    assert.equal(eventGroundAt([409.6 + EVENT_GROUND_M + 1, 0, 380]), null, 'past it');
    assert.deepEqual(createPortalGates({ now: () => clock }).applyOwner('p1', (() => { const o = createPortalGates({ now: () => clock }); o.open([420, 0, 380], { pixel: { x: 40, y: 40 }, name: 'Wayrest' }); return o.wireRecord([420, 0, 380]); })(), [420, 0, 380]), false, 'a stranger\'s portal before the arch refused');
  } finally { setEventGround('arch', null); }
});

/** Each coven's region 400 pixels in a block of its own, each pixel its own town's (test/scenes/starfall/star5_host.test.js's scan). */
function starScan() {
  const byRegion = new Map(), townAt = new Int32Array(1000 * 500).fill(-1), towns = [];
  [...new Set(STAR_COVENS.map((c) => c.region))].forEach((region, i) => {
    const pixels = [];
    for (let y = 20 + i * 30; y < 40 + i * 30; y++) for (let x = 300; x < 320; x++) { const id = y * 1000 + x; pixels.push(id); townAt[id] = towns.length; towns.push({ name: `Town ${towns.length}`, px: x, py: y, region }); }
    byRegion.set(region, Int32Array.from(pixels));
  });
  return { byRegion, towns, townAt };
}

test('RPT1026-EVENTS GATE-WAY A FALLEN STAR: the real starfall host says the heart of every star fallen on this screen, its ground the coven\'s ring and past it; before it falls, and once its life is over, none (mutants: the stars never said)', () => {
  const N = starNightAt(FESTIVALS[0].fromMs) + 30, SCAN = starScan(), realNow = Date.now;
  let t = starTimes(N, 0).fallAt + 5000;
  Date.now = () => t;
  try {
    const host = createStarfallHost({
      renderer: null, state: { pixelTranslation: (px, py, out) => { out[0] = px * 100; out[1] = 0; out[2] = py * 100; return out; } },
      exteriorFoes: null, gateScanOf: () => SCAN, warmGateScan: () => {}, surfaceAt: () => 0, player: { feetAt: () => null },
      walkMode: true, playerSpawned: true, online: null, _wodPeerSprung: new Set(), _questRegionIndex: () => starCovenOf(N).region,
      gamePaused: () => false, townTalk: { hudHidden: false }, collider: null, _sharedOffsetMs: 0, storage: null,
      eventNotice: () => {}, audio: { playOneShot() {}, play3d() {} },
    });
    host.frame();
    const S = host.state().find((x) => x.key.startsWith(`${N}.0@`));
    assert.equal(S.phase, 'fallen');
    const h = [...S.heart];
    assert.equal(eventGroundAt(h), 'star');
    assert.equal(eventGroundAt([h[0] + EVENT_GROUND_M - 1, 0, h[2]]), 'star', 'its ground');
    assert.equal(eventGroundAt([h[0] + EVENT_GROUND_M + 1, 0, h[2]]), null, 'past it');
    t = starTimes(N, 0).fallAt + STAR_LIFE_MS + 1000; host.frame();
    assert.equal(host.state().find((x) => x.key === S.key)?.phase ?? 'gone', 'after');
    assert.equal(eventGroundAt(h), null, 'its life over: no ground');
    t = starTimes(N, 0).fallAt - 3_600_000; host.frame();
    assert.equal(eventGroundAt(h), null, 'before it falls: none');
  } finally { Date.now = realNow; setEventGround('star', null); }
});
