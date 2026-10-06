// AUDIT SHIPS (2026-10-06, Mac: "Audit everything" - PR #634's SAIL-FREE and SERPENT3; bible/01-Overview/Audit-Ships.md):
// THE SAILING HALF. Each pin is one finding, fixed at its root: A2 the Overworld journey keeps her off land at her way - it
// looks as far as her way needs and keeps the reach it saw land at, along her whole beam and the mark's own lane, and
// never turns her back onto what she turned off; A3 a heave-to's brake sized to the way she heaves to at; A4 the journey
// weighs her sails against a crew's oars by the runtime's own word, and under SAIL-FREE a breath fills her sails; A5 every
// rig's own gain, a coast taking it only for a way her canvas made, the autorun's oars at the oars' rate; A6/D1 the
// responsive helm trims her itself; A7 another player's boat snaps by her way; D4 the galleon's handling at her new way,
// as the record gives it. Each failed on the build before it.
// tools/mutants/auditships_sail.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { scene } from './csaScene.mjs';
import { WATER_LEVEL, BOAT_ACTIONS } from '../src/systems/comeSailAway.js';
import { HELM_WAY, SAIL_FREE, SAIL_FREE_GAINS, sailFreeGain } from '../src/systems/helmWay.js';
import { createSeaHelm, seaHelmStep, seaHelmReach, seaHelmLook, headingOf, squareOnly, SEA_HELM } from '../src/systems/seaHelm.js';
import { heaveToDecel, HEAVE_TO_DECEL, HEAVE_TO_M, HEAVE_TO_S } from '../src/scenes/navalHost.js';
import { BOARD_SPEED } from '../src/systems/naval/navalBoarding.js';
import { HULL } from '../src/systems/naval/navalShips.js';
import { quatRotate } from '../src/world/quat.js';
import { helmButtons } from '../src/ui/enhancedHelm.js';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { createComeSailAwayPeers, CSA_PEER_SNAP_M, CSA_PEER_SNAP_S, peerSnapM } from '../src/scenes/comeSailAwayPeers.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b} (±${eps})`);
const rad = (d) => (d * Math.PI) / 180;
/** Her helm taken, `hull` (rig `variant`), a wind of `len` blowing `off` degrees round from her bow's own way. */
function helmOn(hull, { handling = 'responsive', off = 90, len = 1.5, variant = 0, settings = {}, raise = true } = {}) {
  const s = scene({ settings });
  s.deps.handling = () => handling;
  const boat = s.helm(s.place(hull, variant));
  const w = [-len * Math.sin(rad(off)), 0, -len * Math.cos(rad(off))];
  const hold = () => { s.rt.state.windVectorCurrent = [...w]; s.rt.state.windVectorTarget = [...w]; };
  hold();
  if (raise) s.rt.RaiseSails();
  const run = (secs) => { for (let t = 0; t < secs - 1e-9; t += 0.25) { hold(); s.frame(); } };
  return { s, boat, run, way: () => Math.hypot(...s.rt.state.MoveVectorCurrent) };
}

// ═══ A2: THE JOURNEY KEEPS HER OFF LAND AT HER WAY ═════════════════════════════════════════════════════════════════

test('AUDIT SHIPS A2 the journey\'s hand keeps her off land as far as her way needs (seaHelmReach: avoidM, or what her way runs in avoidS) and keeps the reach it saw land at until she is clear of it (seaHelmLook - slowed under the oars to turn off an islet, the islet fell out of a shrinking reach and she raised sail and ran back at it); her bow clear, she holds the heading that cleared it while the mark\'s own line runs onto land within reach (mutants: a fixed reach; the reach let go; turned straight back)', () => {
  assert.equal(seaHelmReach(0), SEA_HELM.avoidM);
  near(seaHelmReach(16), 16 * SEA_HELM.avoidS, 1e-12);
  const ask = (o) => ({ heading: 0, bearing: 0, wind: [0, -1.5], hasSails: true, sailsUp: true, canSail: true, way: 16, dt: 1, free: true, ...o });
  const st = createSeaHelm();
  let c = seaHelmStep(st, ask({ landAhead: 200, freer: 1 }));
  assert.deepEqual([c.course, c.row], [90, true], 'land 200 m ahead at 16 m/s: inside her reach, hard over under the oars');
  assert.equal(st.reach, seaHelmReach(16), 'the reach she saw it at');
  c = seaHelmStep(st, ask({ way: 8, landAhead: 180, freer: 1 }));
  assert.equal(c.course, 90, 'slowed to 8 m/s, the land still 180 m ahead: still turning off it');
  assert.equal(seaHelmLook(st, 8), seaHelmReach(16), 'the host looks as far');
  c = seaHelmStep(st, ask({ heading: 60, way: 8, landAhead: Infinity, markAhead: 150 }));
  assert.deepEqual([c.course, c.turn], [60, 0], 'her bow clear, the mark\'s line onto it: her heading held');
  c = seaHelmStep(st, ask({ heading: 60, way: 8, landAhead: Infinity, markAhead: Infinity }));
  assert.equal(c.course, 0, 'clear of both: for the mark');
  assert.equal(st.reach, 0, 'the reach let go');
  assert.equal(seaHelmStep(createSeaHelm(), ask({ landfall: true, landAhead: 200, markAhead: 50 })).course, 0, 'a landfall goes on at its shore');
});

/** world.js's crossing hand (tvSeaLandAlong ... tvSeaSail), lifted whole over Come Sail Away's real runtime: a leg north
 *  to (0, 1800) from her place at the origin with an islet across it - `arrived`, or the journey's own stop. */
function crossing({ hull, windTo, islet, handling = 'responsive', maxS = 600, len = 1.5 }) {
  const DT = 1;
  const s = scene();
  s.deps.handling = () => handling;
  s.deps.dt = () => DT;
  s.deps.iliacPuddleNoMore = () => true;
  const isLand = (x, z) => x >= islet[0] && x <= islet[2] && z >= islet[1] && z <= islet[3];
  s.terrains[0].sampleHeight = (p) => (isLand(p[0], p[2]) ? WATER_LEVEL + 50 : WATER_LEVEL - 10);
  const boat = s.rt.PlaceBoat([0, WATER_LEVEL, 0], [0, 0, 1], hull, 0, s.terrains[0]);
  s.rt.StartSailing(boat);
  const w = [Math.sin(rad(windTo)) * len, 0, Math.cos(rad(windTo)) * len];
  const mark = [0, WATER_LEVEL, 1800];
  let stopped = null, presses = [];
  const num = (name) => Number(new RegExp(`const ${name} = ([\\d.]+);`).exec(WORLD)[1]);
  const scope = {
    TV_SEA_AHEAD_M: num('TV_SEA_AHEAD_M'), TV_SEA_LANE_M: num('TV_SEA_LANE_M'), TV_SEA_BEACH_M: num('TV_SEA_BEACH_M'), TV_SEA_NO_WAY_S: num('TV_SEA_NO_WAY_S'), TV_SEA_ASHORE_M: 60,
    tvSeaWaterAt: (x, z) => !isLand(x, z),
    tvSea: { helm: createSeaHelm(), best: Infinity, bestS: 0, phase: null, boat: null, means: { start: 'sea' } },
    tvSeaRelease: () => { s.held.clear(); s.deps.input.toggleAutorun = false; },
    csaHelmPress: (a) => presses.push(a), CSA_BOAT_ACTIONS: BOAT_ACTIONS,
    csaRuntime: s.rt, csaQuatRotate: quatRotate, csaCall: (fn) => fn(), csaPassengersOn: () => 0,
    heightAt: () => WATER_LEVEL, tvSeaY: () => WATER_LEVEL, player: { spawn: () => {} }, tvSay: () => {},
    tvSeaStop: (line) => { stopped = line; }, TRAVEL_VIEW_TEXT: { aground: 'aground', noWayAtSea: 'no way', noShore: 'no shore', leftMoored: 'moored' },
    tvSeaMark: () => mark, worldTimeScale: () => 1,
    seaHelmStep, seaHelmLook, seaHeadingOf: headingOf, seaSquareOnly: squareOnly,
    csaJourneyHelm: { held: s.held, get row() { return s.deps.input.toggleAutorun; }, set row(v) { s.deps.input.toggleAutorun = !!v; } },
  };
  const from = WORLD.indexOf('  /** Metres along a flat direction from `p` to the first land');
  const to = WORLD.indexOf('  /** THE CROSSING\'S FRAME');
  assert.ok(from > 0 && to > from, 'the crossing\'s hand before its frame');
  // eslint-disable-next-line no-new-func
  const hand = new Function(...Object.keys(scope), `${WORLD.slice(from, to)}\nreturn { tvSeaSail };`)(...Object.values(scope));
  for (let t = 0; t < maxS; t += DT) {
    s.rt.state.windVectorCurrent = [...w]; s.rt.state.windVectorTarget = [...w];
    const p = boat.GameObject.position;
    if (Math.hypot(mark[0] - p[0], mark[2] - p[2]) < 60) return 'arrived';
    presses = [];
    hand.tvSeaSail(boat, 'open', DT);
    if (stopped) return stopped;
    s.frame({ press: presses });
  }
  return 'no arrival';
}

test('AUDIT SHIPS A2 the journey crosses open legs at SAIL-FREE\'s way on Come Sail Away\'s real runtime - world.js\'s own hand, lifted whole: an islet across her leg in every wind, the rated and the storm\'s strongest, a galleon and a Carrack arrive every time and never run aground; looking 150 m along her centreline and turning back for the mark as her bow cleared, a galleon ran aground on 7 legs in 60 and stuck on an islet\'s edge on 30, and a fixed look ran 8 of the storm\'s 36 legs aground (mutants: the look a fixed 150 m; her beam unlooked; the mark\'s lane unlooked; the reach let go)', () => {
  const tally = {};
  for (const len of [1.5, 3]) {
    for (const hull of [HULL.SmallShip, HULL.Carrack]) {
      for (const windTo of [0, 90, 135]) {
        for (const [cx, width] of [[-20, 60], [-40, 120], [0, 30], [-20, 30], [20, 60], [40, 120]]) {
          const r = crossing({ hull, windTo, islet: [cx - width / 2, 700, cx + width / 2, 700 + width], len });
          tally[r] = (tally[r] ?? 0) + 1;
          assert.equal(r, 'arrived', `hull ${hull} in a ${len} m/s wind to ${windTo}, an islet ${width} m wide about x ${cx}`);
        }
      }
    }
  }
  assert.deepEqual(tally, { arrived: 72 });
});

// ═══ A3: HER WAY OFF BESIDE HER ════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS A3 a heave-to brakes her by the way she heaves to at (heaveToDecel): under BOARD_SPEED within HEAVE_TO_M and within HEAVE_TO_S, on Come Sail Away\'s real runtime, a galleon and a Carrack at full way on her beam and her quarter; HELM-WAY\'s ways are braked at HEAVE_TO_DECEL as they were; the fixed 2 m/s^2 ran them 50-93 m, out of BOARD_RANGE, the Carrack past HEAVE_TO_S (mutants: the fixed brake; the brake asked at the press\'s way unread)', () => {
  assert.equal(heaveToDecel(6), HEAVE_TO_DECEL);
  assert.equal(heaveToDecel(8.2), HEAVE_TO_DECEL, 'HELM-WAY\'s galleon');
  near(heaveToDecel(16), (16 * 16 - BOARD_SPEED * BOARD_SPEED) / (2 * HEAVE_TO_M), 1e-12);
  for (const hull of [HULL.SmallShip, HULL.Carrack]) {
    for (const off of [90, 135]) {
      const h = helmOn(hull, { off });
      h.run(60);
      const v0 = h.way();
      assert.ok(v0 > 14, `under SAIL-FREE's full sail (${v0.toFixed(1)} m/s)`);
      h.s.deps.dt = () => 1 / 60;
      h.s.rt.LowerSails();
      const decel = heaveToDecel(v0);
      h.s.deps.brake = () => decel;
      const p0 = [...h.boat.GameObject.position];
      let t = 0;
      while (h.way() > BOARD_SPEED && t < 30) { h.s.frame(); t += 1 / 60; }
      const p = h.boat.GameObject.position, d = Math.hypot(p[0] - p0[0], p[2] - p0[2]);
      assert.ok(d <= HEAVE_TO_M + 1, `hull ${hull} off ${off}: ${d.toFixed(1)} m to BOARD_SPEED`);
      assert.ok(t <= HEAVE_TO_S, `in ${t.toFixed(2)} s`);
    }
  }
  assert.match(WORLD, /brake: \(\) => naval\?\.brake\(\) \?\? 0,/, 'the world hands the sea fight\'s brake to her');
});

// ═══ A4: HER SAILS OR A CREW'S OARS, THE RUNTIME'S OWN WORD ════════════════════════════════════════════════════════

test('AUDIT SHIPS A4 the journey weighs a crew\'s oars against her sails by the runtime\'s own word - her way under sail as she lies (sailWayOf), set or not, is the way she then makes, and her oars\' (oarWayOf) the way they make; under SAIL-FREE a fog\'s breath fills her sails (seaWind\'s floor), so a galleon and a Carrack sail through a fog where they rowed at 1 m/s (the mod\'s formula of the raw wind, and its calm), and a Large Galley\'s crew still rows past her one square sail (mutants: the mod\'s formula; the calm under SAIL-FREE)', () => {
  for (const hull of [HULL.SmallShip, HULL.Carrack, HULL.LargeGalley]) {
    for (const len of [0.15, 1.5]) {
      const h = helmOn(hull, { len, raise: false });
      const est = h.s.rt.sailWayOf(h.boat), oars = h.s.rt.oarWayOf(h.boat);
      const cmd = seaHelmStep(createSeaHelm(), { heading: 90, bearing: 90, wind: [-len, 0], hasSails: true, squareOnly: false, sailsUp: false, canSail: true, way: 0, dt: 1, landfall: false, crewed: !!h.boat.crewed, oarWay: oars, sailWay: est, free: true });
      h.s.rt.RaiseSails();
      h.run(60);
      near(est, h.way(), 0.02, `hull ${hull} in a ${len} m/s wind: her sails' way, asked lowered`);
      assert.equal(cmd.row, hull === HULL.LargeGalley, `hull ${hull} in a ${len} m/s wind: ${cmd.row ? 'rows' : 'sails'}`);
    }
  }
  const r = helmOn(HULL.LargeGalley, { raise: false });
  r.s.rt.state.oarThrottle = 1;
  r.run(40);
  near(r.s.rt.oarWayOf(r.boat), r.way(), 0.02, 'her oars\' way');
  // the mod's own helm: a fog fills no sail, as the mod's calm says
  assert.equal(seaHelmStep(createSeaHelm(), { heading: 90, bearing: 90, wind: [-0.15, 0], hasSails: true, sailsUp: false, canSail: true, way: 0, dt: 1, free: false }).row, true);
  assert.match(WORLD, /crewed: !!boat\.crewed, oarWay: csaRuntime\.oarWayOf\(boat\),\n\s+sailWay: csaRuntime\.sailWayOf\(boat\),/, 'the world asks the runtime');
});

// ═══ A5: EVERY RIG'S OWN GAIN ══════════════════════════════════════════════════════════════════════════════════════

test('AUDIT SHIPS A5 every rig\'s own gain (SAIL_FREE_GAINS - the galleon\'s SAIL_FREE.gain hers): her SAIL-FREE drive on her beam in the rated wind over the mod\'s own, measured here on the real runtime for every hull and the Large Boat\'s seven rigs - so each gathers and loses her way as HELM-WAY tuned her; the galleon\'s 1.643 was every hull\'s, and a Large Boat gathered hers a third quicker, a Large Galley a third slower (mutants: one gain for all)', () => {
  const drive = (hull, variant, handling) => { const h = helmOn(hull, { variant, handling }); h.run(40); return h.s.rt.state.MoveVectorTarget[2]; };
  for (const [hull, rigs] of [[HULL.LargeBoat, 7], [HULL.SmallShip, 1], [HULL.LargeGalley, 1], [HULL.Carrack, 1]]) {
    for (let v = 0; v < rigs; v++) near(SAIL_FREE_GAINS[hull][v], drive(hull, v, 'responsive') / drive(hull, v, 'classic'), 0.002, `hull ${hull} rig ${v}`);
  }
  assert.equal(SAIL_FREE_GAINS[HULL.SmallShip][0], SAIL_FREE.gain);
  assert.equal(sailFreeGain({ hull: HULL.Rowboat, variant: 0 }), 1, 'no sails, no gain');
  assert.equal(sailFreeGain({ hull: HULL.LargeBoat, variant: 6 }), SAIL_FREE_GAINS[HULL.LargeBoat][6]);
});

test('AUDIT SHIPS A5 a coast takes her rig\'s gain only for a way her canvas made (`wayBySail`): a galleon\'s sails struck, at it; a rowboat\'s oars at rest, a Large Galley\'s crew shipping theirs, at HELM-WAY\'s own coast (a rowboat stopped in 2 s where she took 3.3, a galley\'s oar coast from 8 m/s 16 s against 27); and the autorun\'s oars - a journey\'s - come on at the oars\' rate, as the oars\' own law asks them (they came on at her coast\'s, gained) (mutants: the gain on every coast; the autorun not the oars\')', () => {
  const pair = (hull) => [helmOn(hull, { handling: 'classic' }), helmOn(hull)];
  // the galleon: under sail a beat, then struck
  const [cg, rg] = pair(HULL.SmallShip);
  for (const h of [cg, rg]) { h.s.frame(); h.s.rt.LowerSails(); }
  near(rg.s.rt.properties.moveAccel(), cg.s.rt.properties.moveAccel() * HELM_WAY.coast * sailFreeGain(rg.boat), 1e-5, 'the galleon\'s canvas: gained');
  // a rowboat and a galley rowing, then their oars at rest
  for (const hull of [HULL.Rowboat, HULL.LargeGalley]) {
    const [c, r] = [helmOn(hull, { handling: 'classic', raise: false }), helmOn(hull, { raise: false })];
    for (const h of [c, r]) { h.s.rt.state.oarThrottle = 1; h.s.frame(); h.s.rt.state.oarThrottle = 0; }
    near(r.s.rt.properties.moveAccel(), c.s.rt.properties.moveAccel() * HELM_WAY.coast, 1e-5, `hull ${hull}: her oars' way, HELM-WAY's coast`);
  }
  // the autorun pulls at the oars' rate
  const [ca, ra] = [helmOn(HULL.SmallShip, { handling: 'classic', raise: false }), helmOn(HULL.SmallShip, { raise: false })];
  for (const h of [ca, ra]) h.s.deps.input.toggleAutorun = true;
  ra.s.rt.state.oarThrottle = 0;
  const oarRate = (() => { const h = helmOn(HULL.SmallShip, { raise: false }); h.s.rt.state.oarThrottle = 1; return h.s.rt.properties.moveAccel(); })();
  assert.equal(ra.s.rt.properties.moveAccel(), oarRate, 'the autorun: the oars\' rate');
  assert.equal(ca.s.rt.properties.moveAccel(), oarRate, 'under the mod\'s own helm too (its autorun holds MoveForwards)');
});

// ═══ A6/D1: THE RESPONSIVE HELM TRIMS HER ITSELF ══════════════════════════════════════════════════════════════════

test('AUDIT SHIPS A6/D1 under the responsive helm her trim is the helm\'s own - every sail draws at its crest, so with the mod\'s AutoTrimming off the panel and the pad offer no trim (helmPanelState `manualTrim`), the trim keys move nothing, and her booms are trimmed as the assist trims them, to show it; under the mod\'s own helm the trim is the player\'s as it was; the trim had stayed offered, and moved her booms and nothing else (mutants: the trim the player\'s under the responsive helm)', () => {
  const off = { 'SailingAssist.AutoTrimming': false };
  const r = helmOn(HULL.SmallShip, { settings: off });
  r.run(5);
  assert.equal(r.s.rt.helmPanelState().manualTrim, false, 'no trim offered');
  assert.ok(!helmButtons(r.s.rt.helmPanelState()).some((b) => /trim|square(Left|Right)/i.test(b.act)), 'no trim buttons');
  const drive = r.s.rt.state.MoveVectorTarget[2];
  const booms = r.boat.Booms.map((b) => [...b.localRotation]);
  r.s.held.add(BOAT_ACTIONS.trimRight);
  r.run(2);
  near(r.s.rt.state.MoveVectorTarget[2], drive, 1e-9, 'the trim keys move nothing');
  assert.deepEqual(r.boat.Booms.map((b) => [...b.localRotation]), booms, 'her booms as the assist trims them');
  // AUDIT 2 XD6 (2026-10-06): the assist's own trim, in the same wind - read as unmoved alone, booms never trimmed at all
  // passed too (in this wind they turn about 30 degrees off their spawn)
  for (const wind of [90, 150]) {
    const resp = helmOn(HULL.SmallShip, { off: wind, settings: off }), assist = helmOn(HULL.SmallShip, { off: wind, handling: 'classic' });
    const spawn = resp.boat.Booms.map((b) => [...b.localRotation]);
    resp.run(5); assist.run(5);
    const rot = (x) => x.boat.Booms.map((b) => b.localRotation.map((q) => Math.round(q * 1e6) / 1e6));
    assert.deepEqual(rot(resp), rot(assist), `wind ${wind} deg: her booms where the assist trims them`);
    assert.ok(resp.boat.Booms.some((b, i) => b.localRotation.some((q, k) => Math.abs(q - spawn[i][k]) > 0.05)), `wind ${wind} deg: trimmed off their spawn`);
  }
  const c = helmOn(HULL.SmallShip, { handling: 'classic', settings: off });
  c.run(1);
  assert.equal(c.s.rt.helmPanelState().manualTrim, true, 'the mod\'s own helm: the trim is the player\'s');
});

// ═══ A7: A PEER'S BOAT SNAPS BY HER WAY ════════════════════════════════════════════════════════════════════════════

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
function quietRenderer() {
  return {
    createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }),
    drawMesh: () => {}, updateMeshVertices: () => {}, createBillboardBatch: (archive, record, size, centers, opts) => ({ archive, record, size, centers, opts }), destroyBillboardBatch: () => {}, destroyMesh: () => {},
  };
}
function standInPipeline() {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const files = new Map();
  return { getTexture: async (a) => { if (!files.has(a)) files.set(a, texture()); return files.get(a); }, uploadRecord: () => {}, getGpuMesh: async (id) => ({ classic: id }) };
}

test('AUDIT SHIPS A7 another player\'s boat snaps - and carries nobody - past what her word\'s way runs in CSA_PEER_SNAP_S, or CSA_PEER_SNAP_M at the least (peerSnapM): a hitch of the wire\'s seconds is eased at every way SAIL-FREE gives, a teleport still snaps; at a fixed 20 m a Carrack at 19 m/s snapped after a 1.75 s hitch and put her passengers off (mutants: the fixed snap)', async () => {
  near(peerSnapM([0, 0, 0]), CSA_PEER_SNAP_M, 1e-12);
  near(peerSnapM([19.44, 0, 0]), 19.44 * CSA_PEER_SNAP_S, 1e-12);
  const pool = createComeSailAwayPool({ renderer: quietRenderer(), pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  const word = (x) => [2, 0, x, 34, 20, 0, 0, 0, 1, 0, 1, 0];
  let n = 0;
  const hitch = (v, gap, jump = 0, aboard = true) => {
    const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
    peers.setKeepAboard(() => aboard);   // a passenger aboard her: the hitch must carry her
    const id = `p${n++}`;
    let t = 0, x = 0, next = 0, snapped = false, before = null;
    for (let i = 0; i < 60 * 6; i++) {
      const inGap = t >= 2 && t < 2 + gap;
      if (t + 1e-9 >= next && !inGap) { peers.applyOwner(id, { b: [word(x + (t >= 2 ? jump : 0))], m: [[v, 0, 0]] }, (p) => p, Math.round(t * 1000)); next += 0.2; } else if (inGap) next = 2 + gap;
      peers.frame(1 / 60);
      const b = peers.boatAt(id, 0);
      if (b && t > 0.5 && peers.moveOf(b) == null) snapped = true;
      if (t < 2) before = b;
      t += 1 / 60; x += v / 60;
    }
    // the hull she stands on is the one that sailed on, with her word (a passenger left on a hull kept still while another
    // took her place is a passenger put off)
    const end = peers.boatAt(id, 0);
    return snapped || end !== before || Math.abs(end.GameObject.position[0] - x) > v * 1 + 1;
  };
  for (const v of [14.38, 19.44, 25.9]) {
    assert.equal(hitch(v, 2.5), false, `${v} m/s through a 2.5 s hitch, a passenger aboard: carried`);
    assert.equal(hitch(v, 2.5, 0, false), false, `${v} m/s through a 2.5 s hitch: eased`);
  }
  assert.equal(hitch(0, 0.2, 100, false), true, 'a boat at rest moved 100 m: a teleport');
});

// ═══ D4: THE GALLEON'S HANDLING AT HER NEW WAY, AS THE RECORD SAYS IT ═════════════════════════════════════════════════

test('AUDIT SHIPS D4 the galleon\'s handling under SAIL-FREE, measured as AUDIT GALLEON T11 measured HELM-WAY\'s (1/60 s frames, a rated wind on her beam): her full way 14.38 m/s, 95% of it in 7.93 s, struck to 2.5 m/s in 12.05 s, head to wind with the helm over 40 deg off its eye in 4.83 s, her rudder 9.68 and 10.33 deg/s at 4.5 and 9 m/s - the figures `03-World/Come-Sail-Away.md` gives; it kept T11\'s HELM-WAY figures (10.42 s, 6.37 s, "the rudder as above") as hers, and no pin read them', () => {
  const DT = 1 / 60;
  const helm = (wind) => {
    const s = scene();
    s.deps.handling = () => 'responsive';
    s.deps.dt = () => DT;
    const boat = s.helm(s.place(HULL.SmallShip, 0));
    s.rt.RaiseSails();
    const step = () => { s.rt.state.windVectorCurrent = [...wind]; s.rt.state.windVectorTarget = [...wind]; s.frame(); };
    const heading = () => { const fw = quatRotate(boat.GameObject.rotation, [0, 0, 1]); return (Math.atan2(fw[0], fw[2]) * 180) / Math.PI; };
    return { s, step, heading, way: () => Math.hypot(...s.rt.state.MoveVectorCurrent), top: () => Math.hypot(...s.rt.state.velocityTarget) };
  };
  const h = helm([1.5, 0, 0]);
  let t = 0, to95 = null;
  while (t < 90) { h.step(); t += DT; if (to95 == null && h.top() > 1 && h.way() >= 0.95 * h.top()) to95 = t; if (h.top() > 1 && h.way() >= h.top() - 1e-4) break; }
  near(h.way(), 14.38, 0.005, 'her full way');
  near(to95, 7.93, 0.02, 'to 95% of it');
  h.s.rt.LowerSails();
  let struck = null;
  for (t = 0; t < 90 && struck == null;) { h.step(); t += DT; if (h.way() <= 2.5) struck = t; }
  near(struck, 12.05, 0.02, 'struck to 2.5 m/s');
  const g = helm([0, 0, -1.5]);
  g.s.held.add('MoveRight');
  let off = null;
  for (t = 0; t < 60 && off == null;) { g.step(); t += DT; if (Math.abs(g.heading()) > 40) off = t; }
  near(off, 4.83, 0.02, 'head to wind, 40 deg off its eye');
  for (const [v, rate] of [[4.5, 9.68], [9, 10.33]]) {
    const r = scene();
    r.deps.handling = () => 'responsive';
    r.helm(r.place(HULL.SmallShip, 0));
    r.rt.RaiseSails();
    r.held.add('MoveRight');
    for (let i = 0; i < 80; i++) { r.rt.state.MoveVectorCurrent = [0, 0, v]; r.rt.state.windVectorCurrent = [1.5, 0, 0]; r.rt.state.windVectorTarget = [1.5, 0, 0]; r.frame(); }
    near(Math.abs(r.rt.state.TurnCurrent), rate, 0.005, `her rudder at ${v} m/s`);
  }
});
