// CLIMB5 (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md; Mac: "I really want you to go all in on this"):
// THE CLIMB, SEEN AND HEARD BY THE OTHERS - and by the player in third person. The motor's facing on the wall and the
// body's eased yaw (player/motor.js climbFacing, bodyYawFor), the pose's two fields (climbPoseOf -> net/wire.js
// validPose `cl`/`cw`, poseChanged, online.js lerpPose), the peers' readings of them (net/peerClimb.js: the facing, the
// pose off the ground, no walk on the wall, the climb's sounds at the peer) and every host and renderer wired to them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerMotor, climbPoseOf, BODY_TURN_TAU } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { validPose, poseChanged } from '../src/net/wire.js';
import { lerpPose } from '../src/net/online.js';
import { peerCamera } from '../src/net/peerBodies.js';
import { PeerClimbSounds, peerClimbCues, peerBodyYaw, peerMoving, peerClimbing, PEER_CLIMB } from '../src/net/peerClimb.js';
import { CLIMB_SFX, CLIMB_SOUND } from '../src/player/climbSounds.js';
import { FEEL } from '../src/player/climbFeel.js';
import { PEER_SOUND_PROFILE } from '../src/net/remotePlayers.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const blank = { forward: 0, strafe: 0, run: false, jump: false, crouch: false };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
function world() {
  const col = new Collider(() => 0);
  let n = 0;
  const box = (...b) => col.addMesh(`b${n++}`, new Float32Array([b[0], b[1], b[2], b[3], b[1], b[2], b[3], b[4], b[2], b[0], b[4], b[2], b[0], b[1], b[5], b[3], b[1], b[5], b[3], b[4], b[5], b[0], b[4], b[5]]), BOX_IDX, I);
  return { col, box };
}
function climber(col, skill = 50) {
  return new PlayerMotor(col, { speed: 50, running: 30 }, {
    parkour: { enabled: () => true, inputs: () => ({ climbing: skill, jumping: skill }), say: () => {}, tally: () => {} },
  });
}
/** A wall across +z from z = 1 (its face looks -z), 2.3 m tall; the body caught hanging from its lip, `yaw` the view. */
function hung(yaw = 0) {
  const w = world();
  w.box(-3, 0, 1, 3, 2.3, 4);
  const m = climber(w.col);
  m.spawn(0, 0.02, 0.4);
  for (let i = 0; i < 120 && !m.hanging; i++) m.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, yaw);
  return { m, w };
}

test('CLIMB5 C1: the motor says where the body faces on the climb - into the wall held, the wall a move ends on, or the move\'s own way - and the pose says the climb: 1 hanging, 2 on a face (the classic climb too), 3 a move; nothing at all on the ground (mutants: the facing out of the wall, the states swapped, a ground pose that grows fields)', () => {
  const { m } = hung(0);
  assert.ok(m.hanging, 'caught');
  assert.ok(Math.abs(wrap(m.climbFacing - 0)) < 1e-6, `facing the wall (+z) - ${m.climbFacing}`);
  assert.deepEqual(climbPoseOf(m), { cl: 1, cw: 0 }, 'hanging, facing it');
  // a move: Forward pulls up - the move's facing is its way over the top
  let mv = null;
  for (let i = 0; i < 30 && !mv; i++) { m.update(1 / 60, { ...blank, forward: 1 }, 0); if (m.mantling) mv = climbPoseOf(m); }
  assert.equal(mv?.cl, 3, 'a move in flight');
  assert.ok(Math.abs(wrap(mv.cw)) < 0.2, `...its way over the lip (${mv.cw})`);
  for (let i = 0; i < 120 && (m.mantling || !m.grounded); i++) m.update(1 / 60, blank, 0);
  assert.equal(m.climbFacing, null, 'on the top: no facing');
  assert.deepEqual(climbPoseOf(m), {}, 'and no fields - a ground pose keeps its bytes');
  // a wall facing +x (its face looks -x... the body faces into it)
  const w2 = world();
  w2.box(1, 0, -3, 4, 6, 3);
  const f = climber(w2.col);
  f.spawn(0.4, 0.02, 0);
  for (let i = 0; i < 200 && !f.onWall; i++) f.update(1 / 60, { ...blank, forward: 1 }, Math.PI / 2);
  assert.ok(f.onWall && !f.hanging, 'climbing the face');
  const p = climbPoseOf(f);
  assert.equal(p.cl, 2);
  assert.ok(Math.abs(wrap(p.cw - Math.PI / 2)) < 1e-3, `facing +x (${p.cw})`);
  // a move that ends on a hold faces the wall it ends on, not its own way: crouched off a roof's edge (CLIMB-DOWN's
  // lower), the body goes out over the drop and faces back into the wall all the way
  const roof = world();
  roof.box(-3, 0, 1, 3, 2.3, 4);
  const r = climber(roof.col);
  r.spawn(0, 2.32, 2.5);
  let lowering = null;
  for (let i = 0; i < 200 && !lowering; i++) {
    r.update(1 / 60, { ...blank, crouch: i === 0, forward: i > 0 ? 1 : 0 }, Math.PI);
    if (r.mantling && r.climbMove?.kind === 'lower') lowering = climbPoseOf(r);
  }
  assert.equal(lowering?.cl, 3, 'lowering over the edge: a move');
  assert.ok(Math.abs(wrap(lowering.cw)) < 1e-3, `facing back into the wall (+z), not out over the drop (${lowering?.cw})`);
  // the classic climb names the climb, and no facing it does not know
  assert.deepEqual(climbPoseOf({ mantling: false, hanging: false, onWall: false, climb: { isClimbing: true }, climbFacing: null }), { cl: 2 });
});

test('CLIMB5 C2: the third-person body turns to the wall - eased, whatever the view does - and back to the view off it, then IS the view\'s yaw again, exactly; a player who never climbs is drawn at the view\'s yaw to the bit (mutants: the snap, the body stuck on the wall\'s yaw after)', () => {
  const never = climber(world().col);
  never.spawn(0, 0.02, 0);
  for (let i = 0; i < 30; i++) never.update(1 / 60, blank, 1.234);
  assert.equal(never.bodyYawFor(1.234), 1.234, 'never climbed: the view\'s yaw itself');
  const { m } = hung(0);
  assert.ok(m.hanging, 'caught');
  const at = [];   // ...and the view turns away to the side, and on
  for (let i = 0; i < 40; i++) { m.update(1 / 60, blank, 2.5 + 0.02 * i); at.push(m.bodyYawFor(2.5 + 0.02 * i)); }   // the view turns on
  assert.ok(at.every((y) => Math.abs(wrap(y)) < 0.01), `faces the wall all the while (${at.at(-1).toFixed(3)}), though the view turned away and on`);
  assert.ok(BODY_TURN_TAU > 0 && BODY_TURN_TAU < 0.2);
  // let go: back to the view - turned, not snapped - then the view's own
  m.update(1 / 60, { ...blank, crouch: true }, 1);
  const first = m.bodyYawFor(1);
  assert.ok(!m.onWall && first > 0.05 && first < 0.5, `turning back to the view, eased (${first.toFixed(3)})`);
  for (let i = 0; i < 90; i++) m.update(1 / 60, blank, 1);
  assert.ok(!m.onWall);
  assert.equal(m.bodyYawFor(1), 1, 'off the wall: the view\'s yaw again, exactly');
  assert.equal(m.bodyYawFor(-0.3), -0.3, '...whatever it is');
});

test('CLIMB5 C3: the wire carries the climb - validPose bounds it (a state past 3 is 3, the facing wrapped, a facing that is no number dropped, none off the wall), poseChanged sends a hold taken or let go and the body turning on the wall at once, and the drawn pose carries both whole (mutants: the fields stripped, the change unsent, the lerp dropping them)', () => {
  const base = { x: 1, y: 2, z: 3, yaw: 0.5, pitch: 0, mv: 0 };
  const ground = validPose(base);
  assert.ok(!('cl' in ground) && !('cw' in ground), 'on the ground: the bytes it always had');
  assert.deepEqual(validPose({ ...base, cl: 0, cw: 1 }), ground, 'cl 0 is no climb, and its facing goes with it');
  const v = validPose({ ...base, cl: 1, cw: 0.25 });
  assert.equal(v.cl, 1); assert.equal(v.cw, 0.25);
  assert.equal(validPose({ ...base, cl: 9, cw: 0.25 }).cl, 3, 'bounded');
  assert.ok(Math.abs(validPose({ ...base, cl: 2, cw: 7 * Math.PI }).cw - Math.PI) < 1e-9 || Math.abs(validPose({ ...base, cl: 2, cw: 7 * Math.PI }).cw + Math.PI) < 1e-9, 'wrapped');
  assert.deepEqual(Object.keys(validPose({ ...base, cl: 2, cw: 'east' })).filter((k) => k === 'cl' || k === 'cw'), ['cl'], 'a facing that is no number is dropped, the climb kept');
  assert.equal(validPose({ ...base, cl: -1 }).cl, undefined, 'a negative climb is none');
  // poseChanged
  assert.equal(poseChanged(ground, validPose({ ...base, cl: 1, cw: 0 })), true, 'a hold taken goes out');
  assert.equal(poseChanged(validPose({ ...base, cl: 1, cw: 0 }), validPose({ ...base, cl: 3, cw: 0 })), true, 'a move begun goes out');
  assert.equal(poseChanged(validPose({ ...base, cl: 1, cw: 0 }), validPose({ ...base, cl: 1, cw: 0.3 })), true, 'the body turning on the wall goes out');
  assert.equal(poseChanged(validPose({ ...base, cl: 1, cw: 0 }), validPose({ ...base, cl: 1, cw: 0.001 })), false, 'a drift under the epsilon does not');
  assert.equal(poseChanged(validPose({ ...base, cl: 1, cw: Math.PI - 0.001 }), validPose({ ...base, cl: 1, cw: -Math.PI + 0.001 })), false, 'compared as an angle (SLAM13)');
  // the drawn pose
  const from = validPose({ ...base, cl: 1, cw: 0 }), to = validPose({ ...base, x: 2, cl: 1, cw: 0.2 });
  const mid = lerpPose(from, to, 0.5);
  assert.equal(mid.cl, 1); assert.equal(mid.cw, 0.2, 'whole - the body eases its own yaw');
  const off = lerpPose(from, ground, 0.5);
  assert.ok(!('cl' in off) && !('cw' in off), 'off the wall, omitted as the wire omits it');
});

test('CLIMB5 C4: the others draw a climber facing the wall, off the ground, never walking on it - the Morrowind body\'s camera, the billboards\' facing and move bit, the riders\' walkers, all off the one reading (mutants: the camera yaw used, the walk on the wall, the ground pose)', () => {
  const shown = { x: 0, y: 0, z: 0, yaw: 2.9, pitch: 0, mv: 1, cl: 1, cw: 0.4 };
  assert.equal(peerClimbing(shown), true);
  assert.equal(peerBodyYaw(shown), 0.4, 'the wall, not where their camera looks');
  assert.equal(peerMoving(shown), false, 'a shimmy is no walk');
  assert.equal(peerBodyYaw({ ...shown, cl: undefined }), 2.9, 'off the wall: the pose\'s yaw');
  assert.equal(peerMoving({ ...shown, cl: undefined }), true);
  assert.equal(peerBodyYaw({ ...shown, cw: undefined }), 2.9, 'a climb with no facing (the classic climb) keeps the yaw');
  const cam = peerCamera(shown, [1, 2, 3], 1.5);
  assert.equal(cam.yaw, 0.4, 'the Morrowind body faces the wall');
  assert.equal(cam.move.grounded, false, 'off the ground: the in-air pose the local body takes there');
  assert.equal(cam.move.forward, 0, 'no walk');
  const again = peerCamera({ ...shown, cl: undefined, cw: undefined }, [1, 2, 3], 1.5, cam);
  assert.equal(again.move.grounded, true, 'down again: grounded');
  assert.equal(again.move.forward, 1);
  assert.equal(again.yaw, 2.9);
  // every renderer reads it
  const rp = rd('src/net/remotePlayers.js');
  assert.match(rp, /const moving = peerMoving\(shown\);/, 'the billboard\'s move bit');
  assert.match(rp, /const face = peerBodyYaw\(shown\);[^\n]*\n\s*const yaw = Number\.isFinite\(face\) \? face : 0;/, 'the billboard\'s facing');
  assert.match(rp, /standingStill: !peerMoving\(shown\)/, 'no stride on the wall');
  const pb = rd('src/net/peerBodies.js');
  assert.match(pb, /b\.yaw \+= wrapAngle\(peerBodyYaw\(peer\.shown\) - b\.yaw\)/, 'the body eases to the wall');
  assert.match(pb, /yaw: peerBodyYaw\(shown\), speed: 0,/, 'and stands at it');
  const pr = rd('src/net/peerRiders.js');
  assert.match(pr, /const standing = \(pose\) => chooseTable\(\{ stopped: !peerMoving\(pose\)/, 'the walkers stand on the wall (not only the beast: AUDIT CLIMB-ARC N2 says the same words there)');
  assert.match(pr, /const yaw = peerBodyYaw\(pose\), view = viewOf\(yaw, feet, eye\);   \/\/ CLIMB5: facing the wall it climbs/);   // SPRITE-FACE (PIN MOVED): the walker's facing named once, its view and its aura's facing off it
  assert.match(pr, /spriteStride\(peerMoving\(pose\) && !r\.shot,/);
});

/** The peers' ear on a pin's bus: every play3d, [kind, volume, pitch, at, profile]. */
function peerEar({ on = () => true, rand = () => 0.5 } = {}) {
  const shots = [];
  const audio = { play3d: (k, at, v, opts) => shots.push([String(k).replace(/^climb:/, '').replace(/-\d$/, ''), v, opts.pitch, at, opts]) };
  let t = 0;   // PIN MOVED (AUDIT CLIMB-ARC N6): a clock a second on per frame - the floors never bite an honest climb here
  return { shots, law: new PeerClimbSounds({ audio, profile: PEER_SOUND_PROFILE, on, rand, install: false, now: () => (t += 1000) }) };
}

test('CLIMB5 C5: the others HEAR the climb, at the climber - a catch, the hands onto a face, the haul over a lip, the hands taking a hold, letting go; a hand at every reach up a face (a boot half a reach on) and every span along a lip; nothing for an old climb first seen, a snap, a peer out of earshot, or with the port\'s own sounds off (mutants: the cue table, the rhythm, the first-sight replay)', () => {
  const C = CLIMB_SOUND, { HANG, FACE, MOVE } = PEER_CLIMB;
  assert.deepEqual(peerClimbCues(0, HANG), [['catch', C.CATCH_BASE + 0.1]]);
  assert.deepEqual(peerClimbCues(0, FACE), [['grab', C.GRAB * 0.75]]);
  assert.deepEqual(peerClimbCues(HANG, MOVE), [['pull', C.PULL]]);
  assert.deepEqual(peerClimbCues(MOVE, HANG), [['grab', C.GRAB]]);
  assert.deepEqual(peerClimbCues(HANG, 0), [['step', C.LET_GO]]);
  assert.deepEqual(peerClimbCues(MOVE, 0), [], 'onto a top: the stride\'s');
  assert.deepEqual(peerClimbCues(FACE, FACE), []);
  // a catch, heard at them, through the peers' falloff
  {
    const { shots, law } = peerEar();
    law.update('a', { cl: 0 }, [0, 0, 0]);
    law.update('a', { cl: HANG }, [1, 2, 3]);
    assert.equal(shots.length, 1);
    assert.equal(shots[0][0], 'catch');
    assert.deepEqual(shots[0][3], [1, 2, 3], 'at the climber');
    assert.equal(shots[0][4].maxDistance, PEER_SOUND_PROFILE.maxDistance, 'the peers\' own falloff');
    law.update('a', { cl: MOVE }, [1, 2.2, 3]);
    law.update('a', { cl: 0 }, [1, 3, 3.5]);
    assert.deepEqual(shots.map((s) => s[0]), ['catch', 'pull'], 'the haul; then onto the top, the stride\'s');
  }
  // first sight: an old climb is not replayed
  {
    const { shots, law } = peerEar();
    law.update('b', { cl: HANG }, [0, 2, 0]);
    assert.equal(shots.length, 0);
  }
  // the rhythm up a face, and along a lip
  {
    const { shots, law } = peerEar();
    law.update('c', { cl: FACE }, [0, 0, 0]);
    for (let i = 1; i <= 200; i++) law.update('c', { cl: FACE }, [0, 0.01 * i, 0]);   // 2 m up
    const hands = shots.filter((s) => s[1] === C.STEP), feet = shots.filter((s) => s[1] === C.FOOT);
    assert.equal(hands.length, Math.floor(2 / FEEL.REACH + 1e-9));
    assert.equal(feet.length, Math.floor(2 / FEEL.REACH - 0.5 + 1e-9) + 1);
    assert.ok(shots.every((s) => CLIMB_SFX.step.some((k) => k.startsWith(`climb:${s[0]}`))));
    const n = shots.length;
    law.update('c', { cl: FACE }, [0, 9, 0]);
    assert.equal(shots.length, n, 'a snap is no climb');
    law.update('d', { cl: HANG }, [0, 2, 0]);
    for (let i = 1; i <= 100; i++) law.update('d', { cl: HANG }, [0.01 * i, 2, 0]);   // 1 m along
    assert.equal(shots.length - n, Math.floor(1 / FEEL.SHIMMY_SPAN + 1e-9), 'a hand per span');
  }
  // the rhythm starts afresh with each hold: 0.40 m up a face (no hand yet), onto a lip and back to the face, 0.10 m
  // more - no hand: the reach climbed before the change is not carried across it
  {
    const { shots, law } = peerEar();
    law.update('h', { cl: FACE }, [0, 0, 0]);
    for (let i = 1; i <= 40; i++) law.update('h', { cl: FACE }, [0, 0.01 * i, 0]);
    law.update('h', { cl: HANG }, [0, 0.4, 0]);
    law.update('h', { cl: FACE }, [0, 0.4, 0]);
    const n = shots.length;
    for (let i = 1; i <= 10; i++) law.update('h', { cl: FACE }, [0, 0.4 + 0.01 * i, 0]);
    assert.equal(shots.slice(n).filter((s) => s[1] === C.STEP).length, 0, 'no hand for a reach begun on another hold');
  }
  // out of earshot, switched off, forgotten, rebased
  {
    const { shots, law } = peerEar();
    law.update('e', { cl: 0 }, [0, 0, 0]);
    law.update('e', { cl: HANG }, [0, 2, 0], false);
    assert.equal(shots.length, 0, 'out of earshot: silent');
    const off = peerEar({ on: () => false });
    off.law.update('f', { cl: 0 }, [0, 0, 0]);
    off.law.update('f', { cl: HANG }, [0, 2, 0]);
    assert.equal(off.shots.length, 0, 'the port\'s own sounds off: silent');
    law.forget('e');
    law.update('e', { cl: MOVE }, [0, 2, 0]);
    assert.equal(shots.length, 0, 'forgotten: the next sight is a first');
    law.update('g', { cl: FACE }, [0, 0, 0]);
    law.rebase();
    law.update('g', { cl: FACE }, [0, 0.9, 0]);
    assert.equal(shots.length, 0, 'the origin moved: no travel');
  }
});

test('CLIMB5 C6: every host says the climb and draws its own body at the climb\'s yaw, and the peers\' sounds ride the peers\' own switch (mutants: the pose unsent, a host drawing the body at the camera\'s yaw, the sound unwired)', () => {
  assert.match(rd('src/scenes/world.js'), /\.\.\.climbPoseOf\(player\),[^\n]*\n\s*\};/, 'the pose carries the climb');
  let n = 0;
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    const s = rd(f);
    n += (s.match(/mwViewDrawBody\(canvas, \{[^}]*feet: player\.bodyFeetAt\(\), yaw: player\.bodyYawFor\(cam\.yaw\)/g) ?? []).length;
    assert.doesNotMatch(s, /mwViewDrawBody\(canvas, \{[^}]*yaw: cam\.yaw[ ,}]/, `${f}: no body drawn at the camera's yaw`);
  }
  assert.equal(n, 5, 'all five body draws');
  const rp = rd('src/net/remotePlayers.js');
  assert.match(rp, /this\._syncFootsteps\(peer, toScene, eye\);\s*\n\s*this\._syncClimbSound\(peer, toScene, eye\);/, 'heard beside the stride');
  // PIN MOVED (AUDIT CLIMB-ARC N5): the switch silences the sound, never the law's knowing - off, the law is still told
  assert.match(rp, /_syncClimbSound\(peer, toScene, eye\) \{\s*\n\s*if \(!this\.deps\?\.audio\?\.play3d\) return;[\s\S]{0,400}?this\._climbSounds\.update\(peer\.id, peer\.shown, f, getPref\('peerFootsteps'\) !== false && peerInEarshot\(f, eye\)\);/, 'behind the peers\' sounds\' own switch');
  assert.match(rp, /this\._climbSounds\.update\(peer\.id, peer\.shown, f, [^\n]*&& peerInEarshot\(f, eye\)\);/, 'past the peers\' far edge nothing is made (the earshot, as the stride\'s)');
  assert.match(rp, /if \(!seen\.has\(id\)\) this\._climbSounds\.forget\(id\);/, 'a peer gone is forgotten');
  assert.match(rp, /this\._climbSounds\.rebase\(\);/, 'and the recentre is no climb');
});

test('CLIMB5 C7: end to end - a body caught on a lip with its camera turned away is sent as a hang facing the wall, arrives through the relay\'s door, and the other client draws it facing the wall, off the ground', () => {
  const { m } = hung(0);
  for (let i = 0; i < 20; i++) m.update(1 / 60, blank, 2.8);   // the view turns away
  const sent = { x: m.pos[0], y: m.pos[1], z: m.pos[2], yaw: 2.8, pitch: 0, mv: 0, ...climbPoseOf(m) };
  const relayed = validPose(JSON.parse(JSON.stringify(sent)));
  const shown = lerpPose(relayed, relayed, 1);
  assert.equal(shown.cl, 1);
  const cam = peerCamera(shown, [0, 0, 0]);
  assert.ok(Math.abs(wrap(cam.yaw)) < 1e-3, `drawn facing the wall (${cam.yaw}), not the camera's 2.8`);
  assert.equal(cam.move.grounded, false);
});
