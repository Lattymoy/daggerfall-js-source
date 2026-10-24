// EG-ZN (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 11.8, "The camera in
// rock"): THE SHAFT'S CAMERA. THE SHAFT'S LEDGE (world/eliteGates/egHall.js egShaftLedgeAt): a shaft's rim, its flights and the air
// between them, never its Drop's landing, its foot or the passage after. THE CAMERA (player/mwView.js setSpireShaft and the
// lanes): facing the way down within 60 degrees (held to 75) the pitch biased 20 degrees down and the pivot risen a metre,
// eased over half a second, cut whole under reduced motion, none in first person or out of the Spire; the real Morrowind
// camera's eye risen over the edge; the host's view along the camera's own forward after the aim is taken. THE BREACH CLIENT
// (scenes/eliteGates/egClient.js): the shaft's word, and the band textures' end told on every way out of the Spire, never inside.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egShaftLedgeAt, egFragZones, egToDungeon, EG_SHAFT_LEDGE_M, EG_SHAFT_WAY } from '../../../src/world/eliteGates/egHall.js';
import { egHallOf, egCircleOfHall, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { setSpireShaft, spireShaftFacing, spireShaftEase, spireShaftPitch, spireShaftPivot, spireShaftLook, spireShaftBias, SPIRE_SHAFT_PITCH, SPIRE_SHAFT_RISE_M, SPIRE_SHAFT_EASE_S, SPIRE_SHAFT_FACE_IN, SPIRE_SHAFT_FACE_OUT } from '../../../src/player/mwView.js';
import { createMwCamera, MW_UNITS_PER_METER, FOCAL_HEIGHT, PITCH_LIMIT } from '../../../src/player/mwCamera.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const WM = rd('src/scenes/worldModes.js');
/** The first shaft of seed 7 (hall 17, the Caverns' throat). */
const SHAFT = { seed: 7, h: 17 };

// ── THE SHAFT'S LEDGE ───────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZN THE SHAFT\'S LEDGE (world/eliteGates/egHall.js egShaftLedgeAt, section 11.8): a body on a shaft\'s rim, on each flight down and in the air between them faces the shaft\'s way down (+z); on its Drop\'s landing, over its foot, in the passage after it and in every other hall none - the foot\'s own height and half a metre over it the line (mutants: the shaft\'s mark unread; the foot\'s z unread; the foot\'s height unread; the half metre moved)', () => {
  assert.deepEqual([EG_SHAFT_LEDGE_M, [...EG_SHAFT_WAY]], [0.5, [0, 1]]);
  assert.ok(Object.isFrozen(EG_SHAFT_WAY));
  const spec = egHallOf(SHAFT.seed, SHAFT.h, 0), q = spec.caves.find((k) => k.shaft);
  assert.ok(q && q.yB < q.y - 3, 'a shaft, its foot far under its rim');
  const at = (x, y, z) => egShaftLedgeAt(spec, egToDungeon(spec, x, y, z));
  assert.equal(at(q.x, q.y, (q.z0 + q.zA) / 2), EG_SHAFT_WAY, 'the rim');
  const steps = spec.steps.filter((s) => s.z > q.zA && s.z < q.zB);
  const ledges = steps.filter((s) => s.kind === 'ledge'), drop = steps.find((s) => s.kind === 'drop');
  assert.ok(ledges.length >= 3 && drop, 'its flights and its Drop');
  for (const s of ledges) assert.equal(at(s.x, s.y, s.z), EG_SHAFT_WAY, `the flight at ${s.z}`);
  assert.equal(at(q.x, (ledges[0].y + ledges[1].y) / 2 + 0.6, (ledges[0].z + ledges[1].z) / 2), EG_SHAFT_WAY, 'in the air between two flights');
  assert.equal(at(drop.x, drop.y, drop.z), null, 'the Drop\'s landing: no drop before it');
  assert.equal(at(q.x, q.yB, (q.zB + q.z1) / 2), null, 'the foot');
  assert.equal(at(q.x, q.yB + 1.2, q.zB + 0.5), null, 'over the foot, in the air: past the shaft\'s ground');
  assert.equal(at(q.x, q.yB + EG_SHAFT_LEDGE_M - 0.05, drop.z), null, 'under the line');
  assert.equal(at(q.x, q.yB + EG_SHAFT_LEDGE_M + 0.05, drop.z), EG_SHAFT_WAY, 'over it');
  const after = spec.caves.find((k) => !k.shaft && k.z0 >= q.z1 - 1e-6);
  assert.ok(after && after.yB === q.yB);
  assert.equal(at(after.x, after.y + 1.5, (after.z0 + after.zB) / 2), null, 'the passage after it, over its floor: no shaft');
  assert.equal(at(q.x + q.halfW + 2, q.y, (q.z0 + q.zA) / 2), null, 'past the shaft\'s side');
  const open = egHallOf(77, 1, 0);
  assert.equal(egShaftLedgeAt(open, egToDungeon(open, open.arrive.x, 0, open.arrive.z)), null, 'open ground');
  assert.equal(egShaftLedgeAt(null, [0, 0, 0]), null);
  assert.ok(egFragZones(spec).some((z) => z.shaft === 1 && z.zB === q.zB && z.yB === q.yB));
});

// ── THE SHAFT'S CAMERA ──────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZN THE SHAFT\'S CAMERA (player/mwView.js, section 11.8): facing a shaft\'s way down - within 60 degrees, held to 75 - the camera\'s pitch biases 20 degrees down and its pivot rises a metre, eased in over half a second and out again as the facing goes, whole at once under reduced motion; first person and out of the Spire none, at once; the pitch never past the camera\'s own limit; the frame\'s eye answers the camera\'s own forward; on the real Morrowind camera the eye rises by the metre and the orbit\'s own lift (mutants: the bias\'s degrees; the hysteresis; the ease\'s pace; reduced motion eased; first person biased; the rise unread; the look unanswered)', () => {
  assert.deepEqual([SPIRE_SHAFT_PITCH, SPIRE_SHAFT_RISE_M, SPIRE_SHAFT_EASE_S], [(20 * Math.PI) / 180, 1, 0.5]);
  assert.deepEqual([SPIRE_SHAFT_FACE_IN, SPIRE_SHAFT_FACE_OUT], [Math.cos(Math.PI / 3), Math.cos((75 * Math.PI) / 180)]);
  const W = [0, 1], deg = (d) => (d * Math.PI) / 180;
  assert.equal(spireShaftFacing(W, 0, false), true);
  assert.equal(spireShaftFacing(W, deg(59), false), true);
  assert.equal(spireShaftFacing(W, deg(-59), false), true);
  assert.equal(spireShaftFacing(W, deg(61), false), false, 'past 60: not yet');
  assert.equal(spireShaftFacing(W, deg(61), true), true, 'held to 75');
  assert.equal(spireShaftFacing(W, deg(76), true), false);
  assert.equal(spireShaftFacing(W, Math.PI, true), false, 'facing back up');
  const P = SPIRE_SHAFT_PITCH;
  assert.equal(spireShaftEase(0, P, 0.1, false), (P * 0.1) / 0.5);
  assert.equal(spireShaftEase(0, P, 1, false), P, 'never past it');
  assert.equal(spireShaftEase(P, 0, 0.25, false), P / 2, 'out at the same pace');
  assert.equal(spireShaftEase(0, P, 0.01, true), 0, 'reduced motion: none - never a snap (AUDIT EG III, PIN MOVED: it was whole at once)');
  assert.equal(spireShaftEase(P, 0, 0.01, true), 0);
  let word = { way: [0, 1], still: false };
  setSpireShaft(() => word);
  try {
    assert.equal(spireShaftPitch(0.1, 0, 0.25, true), 0.1 - P / 2, 'half in after a quarter second');
    assert.equal(spireShaftBias(), P / 2);
    assert.equal(spireShaftPivot(null, 1.77), 1.77 + SPIRE_SHAFT_RISE_M / 2, 'the pivot risen by the bias\'s share');
    assert.equal(spireShaftPivot(5, 1.77), 5, 'never under the host\'s own floor');
    assert.equal(spireShaftPitch(0.1, 0, 0.25, true), 0.1 - P);
    assert.equal(spireShaftPivot(null, 1.77), 2.77);
    assert.equal(spireShaftPitch(-1.5, 0, 0.1, true), -PITCH_LIMIT, 'never past the camera\'s own limit');
    const out = spireShaftLook({ eye: [0, 0, 0], focal: [0, 1, 0], thirdPerson: true }, 0.4, -0.3);
    assert.deepEqual(out.look, [Math.sin(0.4) * Math.cos(-0.3), Math.sin(-0.3), Math.cos(0.4) * Math.cos(-0.3)], 'the camera\'s own forward');
    assert.equal(spireShaftLook({ eye: [0, 0, 0], focal: null, thirdPerson: false }, 0, 0).look, undefined, 'none for a first-person eye');
    // facing turned away: eased out; the facing held through a turn to 70 degrees
    spireShaftPitch(0, deg(70), 0.1, true);
    assert.equal(spireShaftBias(), P, 'held at 70');
    spireShaftPitch(0, deg(80), 0.25, true);
    assert.equal(spireShaftBias(), P / 2, 'past 75: easing out');
    assert.equal(spireShaftPitch(0.2, deg(80), 0.25, true), 0.2, 'out');
    assert.equal(spireShaftPivot(null, 1.77), null, 'no bias, no rise');
    assert.equal(spireShaftLook({ eye: [0, 0, 0], focal: [0, 1, 0], thirdPerson: true }, 0, 0).look, undefined, 'no bias: the camera looks where the player does');
    spireShaftPitch(0, deg(70), 0.5, true);
    assert.equal(spireShaftBias(), 0, 'at 70 from off: not facing yet');
    // off the ledge: eased out
    spireShaftPitch(0, 0, 0.5, true);
    assert.equal(spireShaftBias(), P);
    word = { way: null, still: false };
    spireShaftPitch(0, 0, 0.1, true);
    assert.ok(Math.abs(spireShaftBias() - P * 0.8) < 1e-12, 'off the ledge: easing out');
    // reduced motion: none (AUDIT EG III, PIN MOVED: it was whole at once, both ways)
    word = { way: [0, 1], still: true };
    spireShaftPitch(0, 0, 0.5, true);
    assert.equal(spireShaftBias(), 0);
    word = { way: null, still: true };
    spireShaftPitch(0, 0, 0.001, true);
    assert.equal(spireShaftBias(), 0);
    // first person, out of the Spire: none at once
    word = { way: [0, 1], still: false };
    spireShaftPitch(0, 0, 1, true);
    assert.equal(spireShaftPitch(0.3, 0, 0.01, false), 0.3, 'first person: the look\'s own');
    assert.equal(spireShaftBias(), 0, 'and cut');
    spireShaftPitch(0, 0, 1, true);
    word = null;
    assert.equal(spireShaftPitch(0.3, 0, 0.01, true), 0.3);
    assert.equal(spireShaftBias(), 0, 'out of the Spire: cut');
    setSpireShaft(() => { throw new Error('x'); });
    assert.equal(spireShaftPitch(0.3, 0, 1, true), 0.3, 'a host that throws biases nothing');
    // THE REAL MORROWIND CAMERA: the bias laid on its eye rises it by the metre and the orbit's own lift, looking down 20 degrees
    word = { way: [0, 1], still: false };   // AUDIT EG III: eased in whole over a second (reduced motion lays none)
    setSpireShaft(() => word);
    const cam = createMwCamera();
    cam.restore({ firstPerson: false });
    const feet = [3, 2, 5], u = 1 / MW_UNITS_PER_METER, focalY = feet[1] + FOCAL_HEIGHT * u;
    const flat = cam.eye({ fpEye: [3, 3.7, 5], feet, yaw: 0, pitch: 0 });
    const p = spireShaftPitch(0, 0, 1, true), floor = spireShaftPivot(null, focalY);
    const leaned = spireShaftLook(cam.eye({ fpEye: [3, 3.7, 5], feet, yaw: 0, pitch: p, pivotFloor: floor }), 0, p);
    const dist = flat.distance;
    assert.ok(Math.abs(flat.eye[1] - focalY) < 1e-9);
    assert.ok(Math.abs(leaned.eye[1] - (focalY + SPIRE_SHAFT_RISE_M + dist * Math.sin(P))) < 1e-9, `risen over the edge: ${leaned.eye[1]}`);
    assert.ok(Math.abs(leaned.eye[2] - (feet[2] - dist * Math.cos(P))) < 1e-9, 'still behind me');
    assert.deepEqual(leaned.look, [0, Math.sin(-P), Math.cos(-P)], 'looking down the shaft');
  } finally { setSpireShaft(null); }
  // the lanes lay it on their own eyes, before their casts; the host's view looks along it after the aim is taken
  const V = rd('src/player/mwView.js');
  assert.match(V, /pitch = spireShaftPitch\(pitch, yaw, frame\.dt \?\? 0, eotbCamera\.thirdPerson\(\)\);[^\n]*\n\s*pivotFloor = spireShaftPivot\(pivotFloor, fpEye\[1\]\);[^\n]*\n\s*const out = eotbCamera\.eye\(/, 'the sprite\'s lane: its head risen');
  assert.match(V, /spireCameraFrame\(out, SPIRE_EOTB_FULL_M, frame\.dt \?\? 0\);[^\n]*\n\s*spireShaftLook\(out, yaw, pitch\);/);
  assert.match(V, /pitch = spireShaftPitch\(pitch, yaw, state\.dt \?\? 0, mwCamera\.thirdPerson\(\)\);[^\n]*\n\s*pivotFloor = spireShaftPivot\(pivotFloor, feet\[1\] \+ \(FOCAL_HEIGHT \* heightScale\) \/ MW_UNITS_PER_METER\);[^\n]*\n(\s*\/\/[^\n]*\n){2}\s*if \(saddled && ownSaddle\) feet = [^\n]*\n\s*const eye = mwCamera\.eye\(/, 'the Morrowind lane: its focal risen');
  assert.match(V, /spireCameraFrame\(eye, mwCamera\.baseDistance\(\) \/ MW_UNITS_PER_METER, state\.dt \?\? 0\);[^\n]*\n\s*spireShaftLook\(eye, yaw, pitch\);/);
  const aim = WM.indexOf('const aimView = view.slice();'), feel = WM.indexOf('host.climbFeel?.view(view, !decorTool.flying() && !mwv.thirdPerson);', aim), tap = WM.indexOf('host.reportFrame?.(proj, view);', aim), lean = WM.indexOf('if (mwv.look && !decorTool.flying() && !cardSeat) view.set(betterAmbience.view(lookAt(mwv.eye, [mwv.eye[0] + mwv.look[0], mwv.eye[1] + mwv.look[1], mwv.eye[2] + mwv.look[2]], [0, 1, 0])));');
  assert.ok(aim > 0 && feel > aim && lean > feel && tap > lean && tap - aim < 800, 'the host\'s view along the camera\'s own forward after the aim (the player\'s) and the climb\'s feel are taken, before the tap ray reads the frame');
});

// ── THE BREACH CLIENT: THE SHAFT'S WORD AND THE BAND TEXTURES' END ────────────────────────────────────────────────────
/** A breach on this screen (test/net/eliteGates/egz_sound.test.js's harness): the brain's own state told to the client, a mode machine of
 *  fakes counting the band dress's frees. */
function inBreach({ seed = SHAFT.seed, h = SHAFT.h, win = undefined } = {}) {
  const T0 = 1_800_000_000_000, ME = 'acct-0';
  let clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  B.h = h; B.sg = 'trial'; B.wk = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: { strength: 50, endurance: 50 }, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, arena: null, collider: { move: () => {} } };
  let inside = true;
  const downs = [];
  const modes = { mode: 'dungeon', egHallBreach: () => (inside ? B.b : null), egHallCircle: () => egCircleOfHall(h), egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => { inside = false; return true; }, egHallReturn: () => null, dungeonCtx: { exitDoors: [] }, egBandsDown: () => { downs.push(inside); return 0; } };
  const online = { welcomes: 1, terminal: false, sendEg: () => true };
  const audio = { holdReverb: () => true, reverbZone: () => true, reverbFade: () => {}, releaseReverb: () => {}, playOneShot: () => {}, play3d: () => {} };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0] },
    say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, audio, ...(win !== undefined ? { win } : {}) });
  const tell = () => { const v = validEgOut(JSON.parse(JSON.stringify(egStateOf(B, clock)))); assert.ok(v); client.word(v); };
  tell();
  const spec = egHallOf(seed, h, 0);
  const stand = (x, y, z) => { player.pos = egToDungeon(spec, x, y, z); };
  stand(spec.arrive.x, spec.arrive.y, spec.arrive.z);
  return { client, B, player, spec, stand, online, downs, tell, ME, leave: () => { inside = false; }, enter: () => { inside = true; }, step: (ms) => { clock += ms; } };
}
test('EG-ZN THE SHAFT\'S WORD (scenes/eliteGates/egClient.js setSpireShaft): alive in the Spire on a shaft\'s ledge, the shaft\'s way down - on its Drop\'s landing, on open ground, as a witness and out of the Spire nothing - with whether the screen stands still (the shelf\'s row or the system\'s) (mutants: the word never told; the witness told; the stillness unread)', () => {
  /** The bias a third-person camera takes over half a second from the word the client now tells the seam (the last client
   *  made holds it), cut again after. */
  const bias = (dt = 0.5) => { spireShaftPitch(0, 0, dt, true); const b = spireShaftBias(); spireShaftPitch(0, 0, 0, false); return b; };
  try {
    const R = inBreach();
    const q = R.spec.caves.find((k) => k.shaft), drop = R.spec.steps.find((s) => s.kind === 'drop' && s.z > q.zA && s.z < q.zB);
    R.stand(q.x, q.y, (q.z0 + q.zA) / 2);
    assert.equal(bias(), SPIRE_SHAFT_PITCH, 'on the rim: the way down told');
    R.stand(drop.x, drop.y, drop.z);
    assert.equal(bias(), 0, 'on the Drop\'s landing: none');
    R.stand(R.spec.arrive.x, R.spec.arrive.y, R.spec.arrive.z);
    assert.equal(bias(), 0, 'open ground: none');
    R.stand(q.x, q.y, (q.z0 + q.zA) / 2);
    R.leave();
    assert.equal(bias(), 0, 'out of the Spire: none');
    R.enter();
    assert.equal(bias(), SPIRE_SHAFT_PITCH);
    assert.equal(bias(0.1), SPIRE_SHAFT_PITCH * 0.2, 'eased: the screen moves');
    R.client.fallSave();
    assert.equal(R.client.witnessing(), true);
    assert.equal(bias(), 0, 'a witness: none');
    // reduced motion (the system's here): none (AUDIT EG III, PIN MOVED: it was whole at once)
    const S = inBreach({ win: { matchMedia: () => ({ matches: true }) } });
    S.stand(q.x, q.y, (q.z0 + q.zA) / 2);
    assert.equal(bias(), 0, 'reduced motion: none - never a snap');
  } finally { setSpireShaft(null); }
  assert.match(rd('src/scenes/eliteGates/egClient.js'), /setSpireShaft\(\(\) => \(inSpire\(\) && !witness \? \{ way: shaftWay\(link\.state\(\)\), still: stillNow\(\) \} : null\)\);/);
});

test('EG-ZN THE BAND TEXTURES\' END, EVERY WAY OUT (scenes/eliteGates/egClient.js): never while I stand in the Spire; on the first frame out of it, whatever took me out - the room closing my socket, the way home, forsaking, the tear (the breach\'s end), a plain step out - the mode machine is told to free the band dress; held through a swap\'s or an answer\'s step under way (mutants: told inside; never told; told under a swap)', () => {
  const ways = {
    socket: (P) => { P.online.terminal = true; },
    home: (P) => { P.B.mem[P.ME].home = true; P.tell(); },
    forsake: (P) => { P.B.mem[P.ME].forsaken = true; P.tell(); },
    tear: (P) => { P.B.end = 'tear'; P.tell(); P.client.frame(); P.step(5000); },
    out: (P) => { P.leave(); },
  };
  for (const [name, go] of Object.entries(ways)) {
    const P = inBreach();
    P.client.frame(); P.client.frame();
    assert.equal(P.downs.length, 0, `${name}: never inside`);
    go(P);
    for (let i = 0; i < 4; i++) P.client.frame();
    assert.ok(P.downs.length > 0, `${name}: told once out`);
    assert.ok(P.downs.every((inside) => inside === false), `${name}: only ever out of the Spire`);
  }
  const SRC = rd('src/scenes/eliteGates/egClient.js');
  assert.match(SRC, /if \(!swapping && !answering\) modes\(\)\?\.egBandsDown\?\.\(\);/, 'held through a swap or an answer under way');
});
