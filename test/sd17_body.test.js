// SD17 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 10 and section 16's SD17;
// Mac: "The detail needs to exceed that of the oblivion gates"): THE BODY MOVED (scenes/sdRemnantRig.js,
// world/sdRemnantModel.js buildRemnantParts, render/sdBeam.js) - the Brass Remnant and its Echoes in seven parts, six of
// them turned about their joints by a pure law of the fight: eighteen states to the Warden's sprite's ten, every blow
// moved; the parts whole at rest, every joint kept where it is; the walk in step with the voice's strides; the Hand
// pointing down the beam's bearing as it sweeps; the Stomp's leg raised; the Reset's hands over its head; the Volley's
// gears from between its hands to their marks; the beam out of its hand, stopped at a pillar's face, its light up and
// out; the scene standing the parts after the Hearts and hiding them with their bodies; the world drawing the beam.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  remnantRig, rigMatrices, restRig, arenaBase, apply4, handAt, sdGearsAt, sdBeamsAt, sdBeamDraws, beamReach, gearFlightOf,
  SD_REM_STATES, SD_RIG_PARTS, SD_RIG_JOINTS, SD_REM_HAND, SD_WAKE_MS, SD_SLIP_EVERY_MS, SD_GEAR_ARC_M, SD_BEAM_FLOOR_Y, SD_BEAM_DROP_M, SD_BEAM_FADE_MS, LEAN, TWIST, NOD,
} from '../src/scenes/sdRemnantRig.js';
import { buildRemnantParts, buildRemnantModel, buildGearModel, SD_REMNANT_PARTS, SD_REMNANT_BODY, SD_GEAR, remnantMatrix } from '../src/world/sdRemnantModel.js';
import { createSdRemnant, SD_GEAR_DRAWS, SD_DECOR_DRAWS } from '../src/scenes/sdRemnant.js';
import { SD_BLOWS, SD_BODY, SD_REM, SD_ECHO, SD_HEARTS, SD_PILLARS, SD_BREAK_MS, windupFor, behindPillar } from '../src/net/sdRemnant.js';
import { SD_STRIDE_M, SD_ECHO_STRIDE_M, SD_RELEASE_MS, SD_SLIP_FRAC } from '../src/scenes/sdRemnantVoice.js';
import { SD_ARENA, realmToDungeon } from '../src/net/sdBrain.js';
import { SdBeamRenderer, SD_BEAM_VS, SD_BEAM_FS, SD_BEAM_MAX, sdBeamVertices } from '../src/render/sdBeam.js';

const T0 = 1_800_000_000_000;
const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const B = SD_REMNANT_BODY;
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const nearV = (a, b, e = 1e-6) => a.length === b.length && a.every((v, i) => near(v, b[i], e));
/** A fight, its Remnant at (0, 0) facing +z, awake a minute. */
const fight = (over = {}) => ({ fi: 2, ph: 1, op: T0 - 60_000, ou: 0, su: 0, h: 1000, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0, ...over });
const blow = (A, landAt, more = {}) => ({ k: 'atk', b: SD_BODY.remnant, i: 1, a: A.id, at: landAt, x: 0, z: 0, yw: 0, tg: [], ...more });
/** A body's parts in the arena's frame at `t`. */
const partsAt = (s, who, t) => {
  const Bd = who < 0 ? s.rem : s.ec[who];
  return rigMatrices(arenaBase(Bd.x, Bd.z, Bd.yw, who < 0 ? 1 : SD_ECHO.h / SD_REM.h), remnantRig(s, who, t));
};
const stateAt = (s, who, t) => remnantRig(s, who, t).state;

test('SD17 THE BODY IN SEVEN PARTS: its pelvis and the six its rig turns - together every face of the whole, each on its own side of its joint; the gear a cog of its own, both sides of every face', () => {
  assert.deepEqual(SD_REMNANT_PARTS, ['pelvis', ...SD_RIG_PARTS]);
  for (const metal of ['brass', 'gold', 'silver']) {
    const parts = buildRemnantParts(metal), whole = buildRemnantModel(metal);
    assert.equal(parts.length, 7);
    assert.equal(parts.reduce((n, p) => n + p.positions.length, 0), whole.positions.length, 'every face, once');
    const sum = (arr) => arr.reduce((a, v) => a + v, 0);
    assert.ok(near(parts.reduce((n, p) => n + sum(p.positions), 0), sum(whole.positions), 1e-2), 'the same faces');
    const xs = (p) => Array.from({ length: p.positions.length / 3 }, (_, i) => p.positions[i * 3]);
    const ys = (p) => Array.from({ length: p.positions.length / 3 }, (_, i) => p.positions[i * 3 + 1]);
    assert.ok(xs(parts[1]).every((x) => x > 0) && xs(parts[2]).every((x) => x < 0), 'its right leg at +x, its left at -x - +x the side its own right shows on through the camera\'s one mirror');   // AUDIT SD III (V11, PIN MOVED): its right was at -x, and every screen saw it point with its left
    assert.ok(xs(parts[5]).every((x) => x > 0) && xs(parts[6]).every((x) => x < 0), 'its arms the same');
    assert.ok(ys(parts[1]).every((y) => y <= SD_RIG_JOINTS.hip + 1e-6), 'the legs below their hips');
    assert.ok(ys(parts[0]).every((y) => y >= B.legH - 1e-6 && y <= SD_RIG_JOINTS.waist + 1e-6), 'the pelvis between the hips and the waist');
    assert.ok(ys(parts[3]).every((y) => y >= SD_RIG_JOINTS.waist - 1e-6 && y <= SD_RIG_JOINTS.neck + 1e-6), 'the torso between the waist and the neck');
    assert.ok(ys(parts[4]).every((y) => y >= SD_RIG_JOINTS.neck - 1e-6), 'the head above the neck');
  }
  const g = buildGearModel(), teeth = SD_GEAR.teeth * 2;
  assert.equal(g.positions.length / 3, (teeth * 3 + teeth) * 2 * 6, 'its faces, backs, rims and flanks, both sides');
  const r = Array.from({ length: g.positions.length / 3 }, (_, i) => Math.hypot(g.positions[i * 3], g.positions[i * 3 + 1]));
  assert.ok(near(Math.max(...r), SD_GEAR.r, 1e-5) && near(Math.min(...r), SD_GEAR.hub, 1e-5));
});

test('SD17 EIGHTEEN STATES TO THE WARDEN\'S TEN - at rest the parts stand where the whole stood; whatever the pose, every joint stays where its parent holds it; the head and the arms ride the torso', () => {
  assert.equal(SD_REM_STATES.length, 18);
  assert.ok(SD_REM_STATES.length > 10);
  const base = remnantMatrix(5, -2, 9, 0.7, 1.3);
  const rest = rigMatrices(base, restRig());
  for (const m of rest) assert.ok(nearV([...m], [...base]), 'at rest, the whole');
  // a hard pose: everything turned
  const r = restRig();
  r.legs[0] = 0.8; r.legs[1] = -0.6; r.trunk[LEAN] = 0.4; r.trunk[TWIST] = -1.1; r.trunk[NOD] = 0.5; r.arms[0][0] = 2.2; r.arms[0][1] = 0.7; r.arms[1][0] = -0.5; r.arms[1][1] = 1.1;
  const P = rigMatrices(base, r), at = (m, p) => apply4(m, p);
  assert.ok(nearV(at(P[0], [B.legX, SD_RIG_JOINTS.hip, 0]), at(base, [B.legX, SD_RIG_JOINTS.hip, 0]), 1e-5), 'its right hip');   // AUDIT SD III (V11, PIN MOVED): its right at +x
  assert.ok(nearV(at(P[1], [-B.legX, SD_RIG_JOINTS.hip, 0]), at(base, [-B.legX, SD_RIG_JOINTS.hip, 0]), 1e-5), 'its left hip');
  assert.ok(nearV(at(P[2], [0, SD_RIG_JOINTS.waist, 0]), at(base, [0, SD_RIG_JOINTS.waist, 0]), 1e-5), 'the waist');
  assert.ok(nearV(at(P[3], [0, SD_RIG_JOINTS.neck, 0]), at(P[2], [0, SD_RIG_JOINTS.neck, 0]), 1e-5), 'the neck on the torso');
  assert.ok(nearV(at(P[4], [B.armX, SD_RIG_JOINTS.shoulder, 0]), at(P[2], [B.armX, SD_RIG_JOINTS.shoulder, 0]), 1e-5), 'its right shoulder on the torso');
  assert.ok(nearV(at(P[5], [-B.armX, SD_RIG_JOINTS.shoulder, 0]), at(P[2], [-B.armX, SD_RIG_JOINTS.shoulder, 0]), 1e-5), 'its left shoulder on the torso');
  // the turns' senses: a leg's forward swing puts its foot forward; a lean forward its chest; an arm's raise forward its hand; a nod its face down
  const one = (f) => { const q = restRig(); f(q); return rigMatrices(arenaBase(0, 0, 0), q); };
  assert.ok(apply4(one((q) => { q.legs[0] = 0.5; })[0], [B.legX, 0, 0])[2] > 1, 'the foot forward');   // AUDIT SD III (V11, PIN MOVED): its right at +x
  assert.ok(apply4(one((q) => { q.trunk[LEAN] = 0.3; })[2], [0, SD_RIG_JOINTS.neck, 0])[2] > 0.5, 'the chest forward');
  assert.ok(apply4(one((q) => { q.arms[0][0] = Math.PI / 2; })[4], SD_REM_HAND[0])[2] > 2.5, 'the hand forward');
  assert.ok(apply4(one((q) => { q.arms[0][1] = 0.8; })[4], SD_REM_HAND[0])[0] > B.armX + 1.5, 'its right arm out to its right');   // AUDIT SD III (V11, PIN MOVED): +x
  assert.ok(apply4(one((q) => { q.trunk[NOD] = 0.5; })[3], [0, SD_RIG_JOINTS.neck + 0.5, B.headD / 2])[1] < SD_RIG_JOINTS.neck + 0.5, 'its face down');
  assert.ok(apply4(one((q) => { q.trunk[TWIST] = Math.PI / 2; })[2], [0, SD_RIG_JOINTS.neck, 1])[0] > 0.9, 'turned as a facing turns: +z toward +x');
});

test('SD17 THE STATES AS THE FIGHT TURNS: dormant with no fight and before its wake, waking, still, walking in step with the voice\'s strides, its turns, stunned, risen, slipping on a seeded beat, fallen - every one reached, an Echo\'s too', () => {
  const seen = new Set();
  const see = (s, who, t, want) => { const st = stateAt(s, who, t); assert.equal(st, want, `${want} at ${t - T0}`); seen.add(st); };
  see({ fi: 0, ph: 0, op: 0, lost: 0, rem: null }, -1, T0, 'dormant');
  see(fight({ op: T0 + 1000 }), -1, T0, 'dormant');
  see(fight({ op: T0 }), -1, T0 + SD_WAKE_MS / 2, 'wake');
  see(fight(), -1, T0, 'still');
  // walking: at each stride walked a leg at its forward reach (the voice's footfall); between, the legs passing
  const len = 20, v = 2.6, walkS = fight({ rem: { x: 0, z: 0, yw: 0, mv: { x: 0, z: 0, tx: 0, tz: len, v, at: T0 }, atk: null } });
  const atAlong = (d) => T0 + (d / v) * 1000;
  see(walkS, -1, atAlong(2 * SD_STRIDE_M), 'walk');
  const plant = remnantRig(walkS, -1, atAlong(2 * SD_STRIDE_M)), plant2 = remnantRig(walkS, -1, atAlong(3 * SD_STRIDE_M)), pass = remnantRig(walkS, -1, atAlong(2.5 * SD_STRIDE_M));
  assert.ok(near(plant.legs[0], 0.42) && near(plant.legs[1], -0.42), 'its right foot forward at the second stride');
  assert.ok(near(plant2.legs[0], -0.42) && near(plant2.legs[1], 0.42), 'its left at the third');
  assert.ok(near(pass.legs[0], 0, 1e-6), 'between them, passing (to the clock\'s own grain)');
  assert.ok(near(apply4(partsAt(walkS, -1, atAlong(2 * SD_STRIDE_M))[2], [0, SD_RIG_JOINTS.waist, 0])[1], SD_RIG_JOINTS.waist - 0.14, 1e-6), 'its body down on the planted foot');
  assert.ok(near(apply4(partsAt(walkS, -1, atAlong(2.5 * SD_STRIDE_M))[2], [0, SD_RIG_JOINTS.waist, 0])[1], SD_RIG_JOINTS.waist, 1e-6), 'up as the legs pass');
  assert.ok(Math.abs(remnantRig(walkS, -1, atAlong(0.25)).legs[0]) < 0.42 * 0.3, 'easing in over its first metre');
  assert.equal(stateAt(walkS, -1, atAlong(len) + 10), 'still', 'arrived');
  // the stun, the rising, the slip, the fall
  see(fight({ su: T0 + 4000 }), -1, T0, 'stunned');
  assert.ok(remnantRig(fight({ su: T0 + 4000 }), -1, T0).trunk[LEAN] > 0.4 && remnantRig(fight({ su: T0 + 4000 }), -1, T0).trunk[NOD] > 0.4, 'slumped, its head down');
  see(fight({ ph: 3, ou: T0 + SD_BREAK_MS / 2 }), -1, T0, 'rising');
  const low = fight({ h: SD_SLIP_FRAC * 1000 - 1 });
  let slipT = null;
  for (let t = T0; t < T0 + 2 * SD_SLIP_EVERY_MS; t += 20) if (stateAt(low, -1, t) === 'slip') { slipT = t; break; }
  assert.ok(slipT !== null, 'a stagger within two beats'); seen.add('slip');
  assert.ok(remnantRig(low, -1, slipT + 100).trunk[LEAN] > 0.05);
  let healthy = 0; for (let t = T0; t < T0 + 2 * SD_SLIP_EVERY_MS; t += 20) if (stateAt(fight(), -1, t) === 'slip') healthy++;
  assert.equal(healthy, 0, 'never above a fifth');
  const fell = fight({ fell: { at: T0, top: [], n: 1 } });
  see(fell, -1, T0 + 2000, 'fallen');
  assert.ok(remnantRig(fell, -1, T0 + 4000).trunk[LEAN] > remnantRig(fell, -1, T0 + 1000).trunk[LEAN], 'toppling as it sinks');
  // the Hour's own: the Pulse, the End
  see(fight({ clk: { ...blow(SD_BLOWS.pulse, T0 + 1000), b: SD_BODY.hour } }), -1, T0, 'pulse');
  see(fight({ clk: { ...blow(SD_BLOWS.end, T0 + 1000), b: SD_BODY.hour } }), -1, T0, 'end');
  // an Echo: risen, walking at its own stride, broken
  const E = (over) => ({ h: 100, m: 100, up: T0 - 1, dn: 0, x: 4, z: 0, yw: 0, mv: null, atk: null, ...over });
  assert.equal(stateAt(fight({ ph: 2, ec: [E({ up: T0 + 1000 }), E()] }), 0, T0), 'rising');
  const ew = fight({ ph: 2, ec: [E({ mv: { x: 4, z: 0, tx: 4, tz: 20, v: 3, at: T0 } }), E()] });
  assert.ok(near(remnantRig(ew, 0, T0 + (2 * SD_ECHO_STRIDE_M / 3) * 1000).legs[0], 0.42), 'at its own stride');
  assert.equal(stateAt(fight({ ph: 2, ec: [E({ h: 0, dn: T0 - 500 }), E()] }), 0, T0), 'fallen');
  // its blows' states
  const s = (A, at, more = {}) => fight({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: blow(A, at, more) } });
  see(s(SD_BLOWS.stomp, T0 + 1000), -1, T0, 'stompRaise');
  see(s(SD_BLOWS.stomp, T0 - 100), -1, T0, 'stompLand');
  see(s(SD_BLOWS.hand, T0 + 1000), -1, T0, 'handRaise');
  see(s(SD_BLOWS.hand, T0 - 1000), -1, T0, 'handSweep');
  see(s(SD_BLOWS.volley, T0 + 1800), -1, T0, 'volleyGather');
  see(s(SD_BLOWS.volley, T0 + 300), -1, T0, 'volleyThrow');
  see(fight({ ph: 3, rem: { x: 0, z: 0, yw: 0, mv: null, atk: blow(SD_BLOWS.reset, T0 + 4000) } }), -1, T0, 'resetRaise');
  see(fight({ ph: 3, rem: { x: 0, z: 0, yw: 0, mv: null, atk: blow(SD_BLOWS.reset, T0 - 200) } }), -1, T0, 'resetSlam');
  assert.deepEqual([...seen].sort(), [...SD_REM_STATES].sort(), 'every state reached');
});

test('SD17 EVERY BLOW MOVED: the Stomp\'s leg raised over the floor and slammed by its landing; the Hand pointing down the beam\'s bearing through the sweep, its waist turned to the start as it winds up; the Volley\'s arms gathered back then thrown; the Reset\'s hands over its head, trembling more as it nears; an Echo\'s faster wind-up its own', () => {
  const s = (A, at, more = {}, over = {}) => fight({ rem: { x: 0, z: 0, yw: 0.4, mv: null, atk: blow(A, at, { yw: 0.4, ...more }) }, ...over });
  const w = SD_BLOWS.stomp.windup, st = s(SD_BLOWS.stomp, T0 + w);
  const foot = (t) => apply4(partsAt(st, -1, t)[0], [-B.legX, 0, 0])[1];
  assert.ok(near(foot(T0), 0, 1e-9), 'its foot on the floor as the word is said');
  assert.ok(foot(T0 + w * 0.7) > 0.8, `raised: ${foot(T0 + w * 0.7).toFixed(2)} m`);
  assert.ok(foot(T0 + w - SD_RELEASE_MS / 2) < foot(T0 + w - SD_RELEASE_MS), 'coming down at the release');
  assert.ok(near(foot(T0 + w), 0, 1e-9), 'down as it lands');
  // the Hand: the right hand along the bearing - at a quarter of the sweep, and at three quarters, turned the other way
  for (const [sw, k] of [[1, 0.25], [1, 0.75], [-1, 0.25]]) {
    const A = SD_BLOWS.hand, hs = s(A, T0, { sw }), t = T0 + A.active * k, P = partsAt(hs, -1, t);
    const shoulder = apply4(P[4], [B.armX, SD_RIG_JOINTS.shoulder, 0]), hand = apply4(P[4], SD_REM_HAND[0]);   // AUDIT SD III (V11, PIN MOVED): its right shoulder at +x
    const bearing = 0.4 + sw * (A.arc * k - A.arc / 2);
    assert.ok(near(Math.atan2(hand[0] - shoulder[0], hand[2] - shoulder[2]), bearing, 1e-6), `the hand down the bearing (sw ${sw}, ${k})`);
    assert.ok(Math.abs(hand[1] - shoulder[1]) < 0.6, 'held out, about level (its lean dips it)');
    assert.ok(near(sdBeamsAt(hs, t)[0].bearing, bearing, 1e-12), 'the beam\'s own');
  }
  const raise = remnantRig(s(SD_BLOWS.hand, T0 + 1600, { sw: 1 }), -1, T0 + 1600 - SD_RELEASE_MS);
  assert.ok(near(raise.trunk[TWIST], -SD_BLOWS.hand.arc / 2, 1e-9), 'turned to the sweep\'s start as it winds up');
  // the Volley: gathered back, then thrown
  const vw = SD_BLOWS.volley.windup, vs = s(SD_BLOWS.volley, T0 + vw, { tg: [[3, 9]] }), go = T0 + vw - gearFlightOf(vw);
  assert.ok(remnantRig(vs, -1, go - 1).arms[0][0] < -0.6, 'its arms back');
  assert.ok(remnantRig(vs, -1, go + 300).arms[0][0] > 2, 'thrown');
  // the Reset: hands over its head, trembling more as it nears
  const rs = fight({ ph: 3, rem: { x: 0, z: 0, yw: 0, mv: null, atk: blow(SD_BLOWS.reset, T0 + 8000) } });
  const hands = (t) => partsAt(rs, -1, t).slice(4).map((m, h) => apply4(m, SD_REM_HAND[h])[1]);
  assert.ok(hands(T0 + 3000).every((y) => y > SD_REM.h), 'over its head');
  const spread = (a, b) => { let lo = Infinity, hi = -Infinity; for (let t = a; t < b; t += 5) { const v = remnantRig(rs, -1, t).trunk[LEAN]; lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
  assert.ok(spread(T0 + 7400, T0 + 7800) > spread(T0 + 1600, T0 + 2000) * 2, 'trembling more as it nears');
  // an Echo's wind-up the faster
  const ew = windupFor(SD_BLOWS.stomp, 2, SD_BODY.gold);
  const es = fight({ ph: 2, ec: [{ h: 100, m: 100, up: T0 - 1, dn: 0, x: 0, z: 0, yw: 0, mv: null, atk: blow(SD_BLOWS.stomp, T0 + ew) }, null] });
  assert.equal(stateAt(es, 0, T0 + 1), 'stompRaise');
  assert.equal(stateAt(es, 0, T0 - 1), 'still', 'not before its own wind-up');
});

test('SD17 THE GEARS IN FLIGHT: from between its hands as the arms throw, arcing over the floor, down on each mark as the Volley lands - an Echo\'s too, never a broken Echo\'s; THE BEAM out of its pointing hand, stopped at a pillar\'s face, its light up and out', () => {
  const vw = SD_BLOWS.volley.windup, fl = gearFlightOf(vw), tg = [[6, 10], [-8, 4]];
  const s = fight({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: blow(SD_BLOWS.volley, T0 + vw, { tg }) } }), go = T0 + vw - fl;
  assert.deepEqual(sdGearsAt(s, go - 1), [], 'none before they leave');
  const out = sdGearsAt(s, go), r = handAt(s, -1, 0, go), l = handAt(s, -1, 1, go);
  assert.equal(out.length, 2);
  assert.ok(nearV([out[0].x, out[0].y, out[0].z], [(r[0] + l[0]) / 2, (r[1] + l[1]) / 2, (r[2] + l[2]) / 2]), 'from between its hands');
  const late = sdGearsAt(s, T0 + vw - 1);
  assert.ok(tg.every((q, i) => Math.hypot(late[i].x - q[0], late[i].z - q[1]) < 0.05 && Math.abs(late[i].y - 0.4) < 0.05), 'on their marks as it lands');
  const mid = sdGearsAt(s, go + fl / 2);
  assert.ok(mid[0].y > (out[0].y + 0.4) / 2 + SD_GEAR_ARC_M * 0.9, 'arcing over');
  assert.deepEqual(sdGearsAt(s, T0 + vw), [], 'landed: the burst\'s (SD16)');
  assert.notEqual(mid[0].spin, sdGearsAt(s, go + fl / 2 + 100)[0].spin, 'spinning');
  const E = (h) => ({ h, m: 100, up: T0 - 1, dn: h > 0 ? 0 : T0 - 1, x: 0, z: 0, yw: 0, mv: null, atk: { ...blow(SD_BLOWS.volley, T0 + 2000, { tg: [[1, 1]] }), b: SD_BODY.gold } });
  const ewf = gearFlightOf(windupFor(SD_BLOWS.volley, 2, SD_BODY.gold));
  assert.equal(sdGearsAt(fight({ ph: 2, ec: [E(100), E(0)] }), T0 + 2000 - ewf / 2).length, 1, 'the standing Echo\'s alone');
  assert.deepEqual(sdGearsAt(fight({ fell: { at: T0 - 1 }, rem: s.rem }), go + 10), [], 'nothing once it has fallen');
  // THE BEAM
  const A = SD_BLOWS.hand, hs = (yw) => fight({ rem: { x: 0, z: 0, yw, mv: null, atk: blow(A, T0, { yw, sw: 1 }) } });
  assert.deepEqual(sdBeamsAt(hs(0), T0 - 1), [], 'none before the sweep');
  assert.deepEqual(sdBeamsAt(hs(0), T0 + A.active), [], 'none after');
  const open = sdBeamsAt(hs(Math.PI), T0 + A.active / 2)[0];   // bearing pi: toward -z, clear of every pillar
  assert.ok(nearV(open.a, handAt(hs(Math.PI), -1, 0, T0 + A.active / 2)), 'out of its right hand');
  // AUDIT SD III (V2, PIN MOVED): its band on the floor from its body's rim to its full length, the law's width across;
  // its light falling from the hand to the floor SD_BEAM_DROP_M past the hand's own reach
  const along = (m) => [Math.sin(Math.PI) * m, SD_BEAM_FLOOR_Y, Math.cos(Math.PI) * m];
  assert.ok(near(open.reach, A.len) && nearV(open.f1, along(A.len), 1e-9) && nearV(open.f0, along(SD_REM.r), 1e-9) && open.w === A.width, 'its band, its full length to the floor');
  const fwd = open.a[0] * Math.sin(Math.PI) + open.a[2] * Math.cos(Math.PI);
  assert.ok(nearV(open.b, along(Math.max(SD_REM.r, fwd) + SD_BEAM_DROP_M), 1e-9) && SD_BEAM_FLOOR_Y < 0.1, 'its light down to the floor before the hand');
  // toward a pillar: the bearing at mid-sweep is the facing - face the first pillar
  const [px, pz] = SD_PILLARS[0], toPillar = Math.atan2(px, pz), blocked = sdBeamsAt(hs(toPillar), T0 + A.active / 2)[0];
  assert.ok(blocked.reach < Math.hypot(px, pz) && blocked.reach > Math.hypot(px, pz) - 2, `stopped at its face: ${blocked.reach.toFixed(2)} m`);
  const sx = Math.sin(toPillar), cz = Math.cos(toPillar);
  assert.ok(!behindPillar(0, 0, sx * (blocked.reach - 0.01), cz * (blocked.reach - 0.01)) && behindPillar(0, 0, sx * (blocked.reach + 0.01), cz * (blocked.reach + 0.01)));
  assert.equal(beamReach(0, 0, Math.PI, A.len), A.len);
  // its light up and out, in the dungeon's frame
  const d = (t) => sdBeamDraws(hs(Math.PI), t);
  assert.ok(near(d(T0 + SD_BEAM_FADE_MS[0] / 2)[0].alpha, 0.5) && near(d(T0 + A.active / 2)[0].alpha, 1) && near(d(T0 + A.active - SD_BEAM_FADE_MS[1] / 2)[0].alpha, 0.5));
  assert.ok(nearV(d(T0 + A.active / 2)[0].b, realmToDungeon(SD_ARENA.x + open.b[0], open.b[1], SD_ARENA.z + open.b[2])));
  // the pair's two
  const pair = fight({ ph: 2, ec: [0, 1].map((e) => ({ h: 100, m: 100, up: T0 - 1, dn: 0, x: e ? 5 : -5, z: 0, yw: Math.PI, mv: null, atk: { ...blow(A, T0, { x: e ? 5 : -5, yw: Math.PI, sw: e ? -1 : 1 }), b: SD_BODY.gold + e } })), rem: { x: 0, z: 0, yw: 0, mv: null, atk: null } });
  assert.equal(sdBeamsAt(pair, T0 + 100).length, 2);
  assert.ok(SD_BEAM_MAX >= 3);
});

test('SD17 THE SCENE AND THE WORLD: the parts stood after the Hearts and turned by the rig on their body\'s own matrix, hidden with it; the gears placed while they fly; every mesh freed; the beam drawn in the Hour\'s world pass - its shader a ribbon facing the eye, added, unwritten to the depth', () => {
  const made = [], freed = [];
  const renderer = { createMesh: (m) => { made.push(m); return { id: made.length }; }, destroyMesh: (m) => freed.push(m), uploadTexture() {}, uploadEmissionTexture() {} };
  let S = fight(), t = T0;
  const set = createSdRemnant({ renderer, link: () => ({ state: () => S, now: () => t, inDue: () => false, sentIn() {}, joined: () => true }) });
  const draws = [];
  set.stand({ dynamicDraws: draws });
  const H = 3 + SD_HEARTS[1], P = SD_RIG_PARTS.length;
  assert.equal(draws.length, H + 3 * P + SD_GEAR_DRAWS + SD_DECOR_DRAWS.length);   // PIN MOVED (SD-LOOK S8): the decor after the gears
  assert.equal(SD_GEAR_DRAWS, SD_BLOWS.volley.max * 3);
  assert.equal(made.length, 3 * 7 + 2 + 3 + 3, 'seven parts a body, the Heart, the gear - SD-LOOK S8: a back-dial a body, its hand, the rib lamps, the heart torn out');
  set.frame(1 / 60, null);
  const remParts = draws.slice(H, H + P);
  const want = rigMatrices(draws[0].object.matrix, remnantRig(S, -1, t));
  assert.ok(remParts.every((d, i) => !d.hidden && nearV([...d.object.matrix], [...want[i]], 1e-6)), 'turned on its own matrix');
  assert.ok(draws.slice(H + P, H + 3 * P + SD_GEAR_DRAWS).every((d) => d.hidden), 'no Echo\'s parts, no gear');   // PIN MOVED (SD-LOOK S8): its own decor stands with it
  // outside time: hidden with it; the Echoes' parts stand
  S = fight({ ph: 2, ec: [0, 1].map((e) => ({ h: 100, m: 100, up: T0 - 1, dn: 0, x: e ? 6 : -6, z: 0, yw: 0, mv: null, atk: null })) });
  set.frame(1 / 60, null);
  assert.ok(remParts.every((d) => d.hidden && d.object.matrix.every((v) => v === 0)), 'hidden with its body');
  assert.ok(draws.slice(H + P, H + 3 * P).every((d) => !d.hidden), 'the Echoes\' parts');
  // the gears while they fly
  const vw = SD_BLOWS.volley.windup;
  S = fight({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: blow(SD_BLOWS.volley, T0 + vw, { tg: [[3, 3], [4, -2], [-6, 1]] }) } });
  t = T0 + vw - gearFlightOf(vw) / 2;
  set.frame(1 / 60, null);
  const gears = draws.slice(H + 3 * P, H + 3 * P + SD_GEAR_DRAWS);   // PIN MOVED (SD-LOOK S8): the decor after them
  assert.deepEqual(gears.map((d) => !d.hidden), gears.map((d, i) => i < 3), 'three in flight');
  const g = sdGearsAt(S, t)[1], m = gears[1].object.matrix;
  assert.ok(nearV([m[12], m[13], m[14]], realmToDungeon(SD_ARENA.x + g.x, g.y, SD_ARENA.z + g.z), 1e-3), 'where the law flies it');
  t = T0 + vw + 1;
  set.frame(1 / 60, null);
  assert.ok(gears.every((d) => d.hidden), 'landed');
  set.clear();
  assert.equal(freed.length, made.length, 'every mesh freed');
  // the beam's pass
  assert.equal(sdBeamVertices().length, 8 * 12);
  assert.match(SD_BEAM_VS, /vec3 across = cross\(along, toEye\);/);
  assert.match(SD_BEAM_FS, /fogFactorAt\(vWorld\)/);
  const src = readFileSync(new URL('../src/render/sdBeam.js', import.meta.url), 'utf8');
  assert.match(src, /gl\.blendFunc\(gl\.ONE, gl\.ONE\);\n\s+gl\.depthMask\(false\);/);
  assert.equal(typeof SdBeamRenderer, 'function');
  // the world
  // AUDIT SD III (V5, PIN MOVED): into a list the world keeps - a frame of a sweep made 3.4 KB
  assert.match(W, /import \{ sdBeamDraws, sdKeptList \} from '\.\/sdRemnantRig\.js';[^\n]*\n[^\n]*\nconst _sdBeamDraws = sdKeptList\(\), NO_SD_BEAMS = Object\.freeze\(\[\]\);/);
  assert.match(W, /const beams = sdFightLink \? sdBeamDraws\(sdFightLink\.state\(\), sdFightLink\.now\(\), _sdBeamDraws\) : NO_SD_BEAMS; const beam = beams\.length > 0 && !!sdBeamPassOf\(\)\?\.draw\(beams, proj, view, eye, t, fog\); const reads = drawSdArenaReads\(proj, view, fog\); if \(blows \|\| lines \|\| motes \|\| sparks \|\| beam \|\| reads\) renderer\.markForeignPass\(\);/);   // SD-LOOK S7/S8 (PIN MOVED): the arena's reads in the same pass, the sky told the fight, the hearts' lights first
  assert.match(W, /_sdBeamPass = new SdBeamRenderer\(renderer\.gl\);/);
});
