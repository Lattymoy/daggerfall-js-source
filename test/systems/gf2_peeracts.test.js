// GATHER-FEEL II - PEER-ACTS (2026-10-13, Mac: "Do the not done" - GATHER-FEEL's open "a peer neither sees an act ...
// nor hears one"; bible/06-Systems/Professions-Arc.md 5.1 "Others see it" and section 45): ANOTHER PLAYER'S GATHERING,
// SEEN AND HEARD. The wire (net/wire.js validPose's `ga`, `gb`, `gm` - world200) through the door, the relay and the
// lerp, and end to end between two sessions over the real Room; the sender (net/peer/peerGather.js createGatherPose) off the
// real act machines and through the gathering host over the real kinds (scenes/gatherHost.js poseAct - the last blow and
// the herb pulled ride past their act's end); the receiver's ear (PeerGatherSounds) and every lane that draws a peer -
// the peers' sync hearing it, the class sprite's strike and kneel (net/remotePlayers.js), the Morrowind body's tool,
// blow and crouch (net/peer/peerBodies.js), Eye Of The Beholder's walker's stance and strokes (net/peer/peerRiders.js); and the
// stand-ins pinned equal to the hosts' own.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validPose, poseChanged, parseClient, POSE_GATHER_ACTS, POSE_GATHER_BEAT_MIN, POSE_GATHER_BEAT_MAX, POSE_GATHER_THROW_MAX } from '../../src/net/wire.js';
import { lerpPose, OnlineSession } from '../../src/net/online.js';
import {
  GATHER_POSE_ACTS, GATHER_POSE_BEATS, GATHER_POSE_TOOLS, GATHER_POSE_STRIKES, PEER_BLOW_DELAY_S, PEER_GATHER_CUE_MS,
  gatherActCode, createGatherPose, gatherBeatOf, peerKneeling, peerGatherTool, peerGatherSwing, peerActAt, PeerGatherSounds,
} from '../../src/net/peer/peerGather.js';
import { GATHER_SAY, GATHER_SOUND } from '../../src/systems/gatherSounds.js';
import { PROF_CUES } from '../../src/systems/professions/profSounds.js';
import { createChopAct } from '../../src/systems/chopAct.js';
import { createMineAct, MINE_POINTS } from '../../src/systems/mineAct.js';
import { createHerbAct } from '../../src/systems/herbAct.js';
import { createTraceAct } from '../../src/systems/traceAct.js';
import { createFishAct } from '../../src/systems/fishAct.js';
import { MINE_ACT, CHOP_ACT, FISH_ACT } from '../../src/net/professionLaw.js';
import { MELEE_HIT_SHARE } from '../../src/characters/weaponStates.js';
import { AXE_HAND, axeHandFrame } from '../../src/scenes/treeHost.js';
import { PICK_HAND, pickHandFrame } from '../../src/scenes/mineHost.js';
import { SICKLE_HAND } from '../../src/scenes/herbHost.js';
import { KNIFE_HAND } from '../../src/scenes/huntHost.js';
import { PeerBodies, peerCamera, peerBuildOpts, peerWeaponOf } from '../../src/net/peer/peerBodies.js';
import { RemotePlayers, PEER_SOUND_PROFILE } from '../../src/net/remotePlayers.js';
import { createPeerWalkers, createEotbArt, WALK_ONE_SHOTS, WALK_GATHER_STROKES, walkerHands } from '../../src/net/peer/peerRiders.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { fakeRoom } from '../fakeRoom.mjs';
import { PX, rig, arrive, dice, sfxOf } from '../gatherRig.mjs';
const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const P = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
/** An act's `ga`, and a beat's `gb` - the n-th counted, of its kind. */
const code = (name) => GATHER_POSE_ACTS.indexOf(name) + 1;
const beat = (n, kind) => n * 16 + GATHER_POSE_BEATS.indexOf(kind);
const toScene = (p) => [p.x, p.y, p.z];
const onGlint = (m) => ({ yaw: MINE_POINTS[m.state.glint][0], pitch: MINE_POINTS[m.state.glint][1] });

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════════════════════════

test('PEER-ACTS P1 the wire: `ga` an act the client\'s table names and `gm` the net\'s throw with it, `gb` the beats on their own (a beat that ended its act rides the pose that ended it) - each bounded, OMITTED at none, kept by the relay\'s door, sent at once and carried whole by the lerp (mutants: an act past the table kept; a beat of no count kept; the beat only with an act; a throw with no act; each edge not sent; the lerp dropping a beat without its act)', () => {
  const base = validPose(P);
  for (const k of ['ga', 'gb', 'gm']) assert.equal(k in base, false, `${k}: absent until a player gathers`);
  assert.equal(JSON.stringify(validPose({ ...P, ga: 0, gb: 0, gm: 0 })), JSON.stringify(base), 'zeros serialize to the old bytes');
  assert.equal(GATHER_POSE_ACTS.length, POSE_GATHER_ACTS, 'the law bounds the names the client\'s table holds');
  assert.ok(GATHER_POSE_BEATS.length <= 16, 'a beat\'s kind fits under its count');
  assert.equal(POSE_GATHER_BEAT_MIN, 16, 'the least beat is the first count');
  assert.equal(POSE_GATHER_BEAT_MAX, 255 * 16 + 15);
  assert.ok(POSE_GATHER_THROW_MAX >= FISH_ACT.throwMaxM, 'every throw the net makes is named');
  // the act
  for (let ga = 1; ga <= POSE_GATHER_ACTS; ga++) assert.equal(validPose({ ...P, ga }).ga, ga);
  for (const junk of [POSE_GATHER_ACTS + 1, -1, 1.5, '2', true, NaN, null]) assert.equal('ga' in validPose({ ...P, ga: junk }), false, `${String(junk)}: no act, never clamped into one`);
  // the beats - on their own
  assert.equal(validPose({ ...P, gb: 16 }).gb, 16, 'a beat with no act - the herb pulled, on the pose that ended its act');
  assert.equal(validPose({ ...P, ga: 2, gb: POSE_GATHER_BEAT_MAX }).gb, POSE_GATHER_BEAT_MAX);
  for (const junk of [15, 1, 0, POSE_GATHER_BEAT_MAX + 1, 20.5, '32', -16]) assert.equal('gb' in validPose({ ...P, ga: 2, gb: junk }), false, `${String(junk)}: no beat`);
  assert.equal(validPose({ ...P, ga: 2, gb: 15 }).ga, 2, 'a bad beat drops alone, the act kept');
  // the throw - the act's
  assert.equal(validPose({ ...P, ga: code('wait'), gm: 1 }).gm, 1);
  assert.equal(validPose({ ...P, ga: code('wait'), gm: POSE_GATHER_THROW_MAX }).gm, POSE_GATHER_THROW_MAX);
  assert.equal('gm' in validPose({ ...P, gm: 12 }), false, 'no act, no throw');
  for (const junk of [0, POSE_GATHER_THROW_MAX + 1, 2.5, '3']) assert.equal('gm' in validPose({ ...P, ga: code('wait'), gm: junk }), false, `${String(junk)}: no throw`);
  assert.equal(validPose({ ...P, ga: code('wait'), gm: 99 }).ga, code('wait'), 'the act kept');
  // the relay's own door
  const door = parseClient(JSON.stringify({ t: 'pose', p: { ...P, ga: code('wait'), gb: beat(3, 'out'), gm: 4 } }), { hasHello: true }).p;
  assert.deepEqual([door.ga, door.gb, door.gm], [code('wait'), beat(3, 'out'), 4], 'the relay\'s door keeps all three');
  // sent at once
  const act = validPose({ ...P, ga: 2, gb: beat(1, 'blow') });
  assert.equal(poseChanged(base, validPose({ ...P, ga: 2 })), true, 'an act begun: at once');
  assert.equal(poseChanged(act, validPose({ ...P, ga: 2, gb: beat(2, 'blow') })), true, 'a beat: at once, as a swing');
  assert.equal(poseChanged(validPose({ ...P, ga: 9, gm: 3 }), validPose({ ...P, ga: 9, gm: 7 })), true, 'the throw named: at once');
  assert.equal(poseChanged(act, validPose({ ...P, gb: beat(1, 'blow') })), true, 'the act let go: at once');
  assert.equal(poseChanged(act, validPose({ ...P, ga: 2, gb: beat(1, 'blow') })), false, 'the same act and beat: no news');
  // the lerp
  const eased = lerpPose(base, validPose({ ...P, x: 3, ga: 9, gb: beat(4, 'out'), gm: 5 }), 0.5);
  assert.deepEqual([eased.ga, eased.gb, eased.gm, eased.x], [9, beat(4, 'out'), 5, 2], 'carried whole - nothing to ease');
  const after = lerpPose(act, validPose({ ...P, gb: beat(5, 'pluck') }), 0.5);
  assert.equal(after.gb, beat(5, 'pluck'), 'a beat without its act, carried');
  assert.equal('ga' in after || 'gm' in after, false, 'and the act gone with the pose it rode');
});

/** A fake WebSocket class (test/net/online.test.js's): records what was sent, lets the test drive the events. */
function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
  }
  return { FakeWS, sockets };
}

test('PEER-ACTS P2 end to end: my act, its beats and the net\'s throw leave my session the moment they move, pass the real relay Room and stand on the pose the player watching me draws - and the last beat rides past the act it ended (mutants: the relay\'s door or the receiver\'s lerp dropping a field)', async () => {
  const ROOM = 'town:m4243';
  const { FakeWS, sockets } = fakeSocketClass();
  let now = 1_700_000_000_000;
  const me = new OnlineSession({ url: 'wss://relay.test', name: 'axe-0001', id: 'axe-0001', secret: 'secret-of-axe-0001', WebSocketImpl: FakeWS, now: () => now });
  const them = new OnlineSession({ url: 'wss://relay.test', name: 'see-0001', id: 'see-0001', secret: 'secret-of-see-0001', WebSocketImpl: FakeWS, now: () => now });
  me.join(ROOM, P); them.join(ROOM, P);
  const [mine, theirs] = sockets;
  mine.open(); theirs.open();
  const r = fakeRoom(ROOM);
  const relayMine = r.connect(), relayTheirs = r.connect();
  await r.hello(relayMine, 'axe-0001', P); await r.hello(relayTheirs, 'see-0001', P);
  for (const f of relayMine.sent) mine.receive(f);
  let heard = 0;
  const hear = () => { for (; heard < relayTheirs.sent.length; heard++) theirs.receive(relayTheirs.sent[heard]); };
  hear();
  assert.deepEqual(them.drawable().map((p) => p.id), ['axe-0001'], 'they see me, from the welcome');
  const drawn = () => them.drawable()[0].shown;
  now += 150; me.sendPose({ ...P });
  const say = async (fields) => {
    now += 150;
    assert.equal(me.sendPose({ ...P, ...fields }), true, `sent at once, long before the heartbeat: ${JSON.stringify(fields)}`);
    const f = mine.sent.filter((m) => m.t === 'pose').at(-1);
    await r.room.webSocketMessage(relayMine, JSON.stringify(f));
    hear();
    now += 150; them.tick();
  };
  await say({ ga: code('mine') });
  assert.equal(drawn().ga, code('mine'), 'they see me at the stone');
  await say({ ga: code('mine'), gb: beat(1, 'clean') });
  assert.equal(drawn().gb, beat(1, 'clean'), 'and my blow');
  await say({ gb: beat(2, 'blow') });
  assert.equal('ga' in drawn(), false, 'the act let go');
  assert.equal(drawn().gb, beat(2, 'blow'), 'and the last blow rode the pose that let it go');
  await say({ ga: code('wait'), gb: beat(2, 'blow'), gm: 7 });
  assert.deepEqual([drawn().ga, drawn().gm], [code('wait'), 7], 'the net out, its throw named');
});

// ═══ THE SENDER ══════════════════════════════════════════════════════════════════════════════════════════════════════

test('PEER-ACTS P3 the sender: the act machines\' own beats (the ear\'s law), each one the pose names counted once with its kind - a blow and a clean one, the herb pulled, the knife going in, each stroke, the tear and the pelt off, the net in; `ga` each machine\'s act, a net by its phase, `gm` its throw once thrown; the count round past 255 and never 0 (mutants: a beat counted twice; the kind crossed; the count unwrapped; a cancelled act still named; the throw while winding)', () => {
  const st = (o) => ({ cancelled: false, done: false, ...o });
  for (const k of ['chop', 'mine', 'hand', 'steady', 'basket', 'trace']) assert.equal(gatherActCode(st({ kind: k })), code(k), k);
  for (const ph of ['wind', 'fly', 'wait', 'tug', 'haul']) assert.equal(gatherActCode(st({ kind: 'fish', phase: ph })), code(ph), ph);
  assert.equal(gatherActCode(st({ kind: 'mine', cancelled: true })), 0, 'Escape: no act');
  assert.equal(gatherActCode(st({ kind: 'mine', done: true })), code('mine'), 'a finished act the hand is still on (its last swing) is its act');
  assert.equal(gatherActCode(null), 0);
  assert.equal(gatherActCode(st({ kind: 'stitch' })), 0, 'nothing the pose names');
  // a vein: a strike on the glint, then one off it
  const pose = createGatherPose();
  const m = createMineAct({ tier: 1, rng: dice(0, 0.3, 0.6, 0.9) });
  pose.frame(m);
  assert.deepEqual(pose.fields(m), { ga: code('mine') }, 'begun: the act, no beat yet');
  const gbs = [];
  const drive = (fn) => { fn(); pose.frame(m); pose.frame(m); gbs.push(pose.fields(m).gb ?? 0); };
  drive(() => m.tick(0.001, { attack: true, aim: onGlint(m) }));
  drive(() => m.tick(MINE_ACT.swingS + 0.01));
  drive(() => m.tick(0.001, { attack: true, aim: { yaw: 40, pitch: 40 } }));
  assert.deepEqual(gbs, [beat(1, 'clean'), beat(1, 'clean'), beat(2, 'blow')], 'each strike once (a frame read twice counts nothing), its kind under its count');
  // a herb by hand: pulled at the end - and the count runs on across acts
  const h = createHerbAct({ kind: 'hand' });
  pose.frame(h);
  assert.deepEqual(pose.fields(h), { ga: code('hand'), gb: beat(2, 'blow') }, 'kneeling, the last beat still the last');
  for (let i = 0; i < 40 && !h.state.done; i++) { h.tick(0.1); pose.frame(h); }
  assert.equal(pose.fields(h).gb, beat(3, 'pluck'), 'the herb pulled - counted the frame it came up');
  pose.frame(null);
  assert.deepEqual(pose.fields(null), { gb: beat(3, 'pluck') }, 'off an act: the beats alone');
  // the knife: going in, a stroke a point, a slip torn, the pelt off
  const tr = createTraceAct({ tier: 1, rng: dice(0.5) });
  const pts = tr.state.points;
  const kinds = [];
  let k = 0, slipped = false, last = pose.fields(null).gb;
  for (let i = 0; i < 400 && !tr.state.done; i++) {
    const p = pts[Math.min(pts.length - 1, Math.floor(k))];
    if (!slipped && k >= 2) { slipped = true; k = 0; tr.tick(0.05, { held: false, aim: { yaw: p[0], pitch: p[1] } }); }
    else { tr.tick(0.05, { held: true, aim: { yaw: p[0], pitch: p[1] } }); k += 0.5; }
    pose.frame(tr);
    const gb = pose.fields(tr).gb;
    if (gb !== last) { kinds.push(gatherBeatOf(gb)); last = gb; }
  }
  assert.equal(kinds[0], 'knife', `the knife going in: ${kinds}`);
  assert.ok(kinds.includes('slice') && kinds.includes('tear'), 'each stroke, the slip');
  assert.equal(kinds.at(-1), 'peel', 'the pelt off');
  // the net: its act by its phase, its throw once thrown, the net in at the end
  const f = createFishAct({ rng: dice(0) });
  f.tick(0.1, { held: true });
  pose.frame(f);
  assert.deepEqual([pose.fields(f).ga, 'gm' in pose.fields(f)], [code('wind'), false], 'wound: no throw yet');
  const phases = [];
  for (let i = 0; i < 4000 && !f.state.done; i++) {
    if (f.state.phase === 'tug') f.tick(0.01, { attack: true }); else f.tick(0.05, { held: false });
    pose.frame(f);
    if (f.state.done) break;
    const out = pose.fields(f);
    if (phases.at(-1) !== f.state.phase) phases.push(f.state.phase);
    assert.equal(out.ga, code(f.state.phase));
    assert.equal(out.gm, Math.round(f.state.throwM), `the throw in whole metres while out (${f.state.phase})`);
  }
  assert.deepEqual(phases, ['fly', 'wait', 'tug', 'haul']);
  assert.equal(gatherBeatOf(pose.fields(null).gb), 'out', 'the net in, counted at its end');
  // round and round: the 256th beat is the first count again, never 0
  const w = createGatherPose();
  const basket = { state: { kind: 'basket', spot: -1, hits: [] } };
  for (let i = 0; i < 256; i++) { basket.state.hits = [...basket.state.hits, true]; w.frame(basket); }
  assert.equal(w.fields(null).gb, beat(1, 'find'));
});

test('PEER-ACTS P4 the host: the pose names the act the hand is on - from a vein\'s first frame, through the last swing past the press that ended it (the tool still in the hand), and none once the hand lets go - with every strike counted, the last one too; a herb pulled rides the pose that ends its act (mutants: the beats counted after the act let go; the act dropped with the last press; the act kept past the swing)', async () => {
  try {
    const t = await rig();
    assert.deepEqual(t.host.poseAct(), {}, 'nothing gathered: no fields');
    const v = t.host.nodesOf(PX, 150).find((n) => n.kind === 'mine' && n.tier === 1);
    assert.ok(v, 'a tier-1 vein');
    await arrive(t, v);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    t.host.tick(0.016);
    assert.deepEqual(t.host.poseAct(), { ga: code('mine') }, 'at the stone from the act\'s first frame');
    const seen = [];
    let strikes = 0;
    for (let i = 0; i < 12 && t.host.acting(); i++) {
      t.input.v = { held: false, attack: false, choice: false };
      t.host.tick(MINE_ACT.swingS + 0.01);
      t.input.v = { held: false, attack: true, choice: false };
      t.host.tick(0.001);
      strikes++;
      seen.push(t.host.poseAct());
    }
    t.input.v = { held: false, attack: false, choice: false };
    assert.equal(t.host.acting(), false, 'worked out');
    assert.deepEqual(seen.map((s) => s.gb >> 4), Array.from({ length: strikes }, (_, i) => i + 1), 'every strike counted once, the last with them');
    for (const s of seen) assert.ok(['blow', 'clean'].includes(gatherBeatOf(s.gb)));
    assert.ok(t.host.handTool(), 'the last swing still in the hand');
    assert.equal(t.host.poseAct().ga, code('mine'), '...and on the pose: the others see it land');
    t.host.tick(MINE_ACT.swingS);
    assert.equal(t.host.handTool(), null, 'the swing run out');
    assert.deepEqual(t.host.poseAct(), { gb: seen.at(-1).gb }, 'the act let go, its last beat kept');
    // a herb by hand
    const p = t.host.nodesOf(PX, 150).find((n) => n.kind === 'herb' && n.tier === 1);
    assert.ok(p, 'a tier-1 patch');
    t.face(p);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    t.host.tick(0.016);
    assert.equal(t.host.poseAct().ga, code('hand'), 'kneeling at it');
    for (let i = 0; i < 40 && t.host.acting(); i++) t.host.tick(0.05);
    assert.equal(t.host.acting(), false);
    assert.deepEqual(t.host.poseAct(), { gb: beat(strikes + 1, 'pluck') }, 'pulled: the pose that ends the act carries it');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

// ═══ THE RECEIVER'S EAR ══════════════════════════════════════════════════════════════════════════════════════════════

/** A peer's ear over a bus that keeps its shots, on its own clock (ms), the variety's dice in the middle. */
function ear({ on = true } = {}) {
  const shots = [];
  const audio = { play3d: (key, at, volume, o) => { shots.push({ key, at: [...at], volume, ref: o?.refDistance ?? null, pitch: o?.pitch ?? null }); return 0.2; } };
  const clock = { ms: 1000 };
  const s = new PeerGatherSounds({ audio, profile: PEER_SOUND_PROFILE, on: () => on, rand: () => 0.5, install: false, now: () => clock.ms });
  return { s, shots, clock, step: (sec) => { clock.ms += sec * 1000; } };
}
const FEET = [10, 0, 20];
const sfx = (shots) => shots.map((x) => sfxOf(x.key));

test('PEER-ACTS P5 the receiver\'s ear: a peer\'s blow - its swing at once, its blow on DFU\'s hit frame, the pick\'s or the axe\'s, a clean one its own - at the act\'s place before the body, with the peers\' falloff; the last blow come with no act still the tool\'s; nothing at first sight (mutants: the blow on the swing\'s frame; the place the feet; the tools crossed; the last blow unheard; an old act replayed)', () => {
  const { s, shots, step } = ear();
  const place = peerActAt(FEET, Math.PI / 2);
  assert.deepEqual(place.map((v) => +v.toFixed(9)), [FEET[0] + 1, 0.8, FEET[2]], 'a metre before the body, at the hands\' height');
  s.update('p', { yaw: Math.PI / 2, ga: code('mine'), gb: beat(3, 'blow') }, FEET);
  assert.deepEqual(shots, [], 'first sight: an act met mid-way is not replayed');
  step(0.5);
  s.update('p', { yaw: Math.PI / 2, ga: code('mine'), gb: beat(4, 'blow') }, FEET);
  assert.deepEqual(sfx(shots), ['swing'], 'the swing at once');
  assert.deepEqual(shots[0].at.map((v) => +v.toFixed(9)), place.map((v) => +v.toFixed(9)));
  assert.ok(near(shots[0].pitch, GATHER_SOUND.PICK_SWING_PITCH), 'the pick\'s heavier head');
  assert.equal(shots[0].ref, PEER_SOUND_PROFILE.refDistance, 'the peers\' own falloff');
  assert.ok(near(PEER_BLOW_DELAY_S.mine, MINE_ACT.swingS * MELEE_HIT_SHARE));
  step(PEER_BLOW_DELAY_S.mine - 0.02);
  s.update('p', { yaw: Math.PI / 2, ga: code('mine'), gb: beat(4, 'blow') }, FEET);
  assert.equal(shots.length, 1, 'the blow still in the air');
  step(0.03);
  s.update('p', { yaw: Math.PI / 2, ga: code('mine'), gb: beat(4, 'blow') }, FEET);
  assert.deepEqual(sfx(shots), ['swing', 'pick'], 'landed on the hit frame');
  assert.equal(shots[1].volume, GATHER_SAY.pick.volume);
  // a clean strike: the ore rings
  step(0.5);
  s.update('p', { yaw: Math.PI / 2, ga: code('mine'), gb: beat(5, 'clean') }, FEET);
  step(0.5);
  s.update('p', { yaw: Math.PI / 2, ga: code('mine'), gb: beat(5, 'clean') }, FEET);
  assert.deepEqual(sfx(shots).slice(2), ['swing', 'pickGlint']);
  // the last blow, on the pose that let the act go: still the pick's
  step(0.5);
  s.update('p', { yaw: Math.PI / 2, gb: beat(6, 'blow') }, FEET);
  step(0.5);
  s.update('p', { yaw: Math.PI / 2, gb: beat(6, 'blow') }, FEET);
  assert.deepEqual(sfx(shots).slice(4), ['swing', 'pick'], 'the act it ended');
  // a beat whose act this ear never saw (the pose that named it lost to the rate): still heard
  const lone = ear();
  lone.s.update('q', { yaw: 0 }, FEET);
  lone.step(0.5); lone.s.update('q', { yaw: 0, gb: beat(1, 'pluck') }, FEET);
  assert.deepEqual(sfx(lone.shots), ['pluck'], 'a herb pulled, its kneel unseen');
  // the axe: its own swing, its own blows
  step(0.5);
  s.update('p', { yaw: 0, ga: code('chop'), gb: beat(7, 'blow') }, FEET);
  step(0.5);
  s.update('p', { yaw: 0, ga: code('chop'), gb: beat(8, 'clean') }, FEET);
  step(0.5);
  s.update('p', { yaw: 0, ga: code('chop'), gb: beat(8, 'clean') }, FEET);
  assert.deepEqual(sfx(shots).slice(6), ['swing', 'chop', 'swing', 'chopClean']);
  assert.equal(shots[6].pitch, 1, 'the axe\'s swing, unlowered');
  assert.ok(near(PEER_BLOW_DELAY_S.chop, CHOP_ACT.swingS * MELEE_HIT_SHARE));
});

test('PEER-ACTS P6 the receiver\'s ear: the hand\'s, the knife\'s and the net\'s beats - the kneel among the leaves as a herb\'s or the Basket\'s act begins (never the knife\'s), a bruise, the herb pulled, a find and a miss, the knife going in and each stroke, a tear, the pelt off; the net thrown, landing where it was thrown, the water\'s plip while it waits, the tug, the haul and the catch fighting at the net, the net in at the body (mutants: the kneel lost or the knife kneeling; the net landing at the body; the water silent; a beat crossed)', () => {
  const { s, shots, step } = ear();
  const at = (o) => ({ yaw: 0, ...o });
  s.update('p', at({}), FEET);
  const go = (o) => { step(0.5); s.update('p', at(o), FEET); };
  go({ ga: code('hand') });
  go({ ga: code('hand'), gb: beat(1, 'pluck') });
  go({ ga: code('steady'), gb: beat(1, 'pluck') });
  go({ ga: code('steady'), gb: beat(2, 'bruise') });
  go({ ga: code('basket'), gb: beat(2, 'bruise') });
  go({ ga: code('basket'), gb: beat(3, 'find') });
  go({ ga: code('basket'), gb: beat(4, 'miss') });
  go({ ga: code('trace'), gb: beat(4, 'miss') });
  go({ ga: code('trace'), gb: beat(5, 'knife') });
  go({ ga: code('trace'), gb: beat(6, 'slice') });
  go({ ga: code('trace'), gb: beat(7, 'tear') });
  go({ gb: beat(8, 'peel') });
  assert.deepEqual(sfx(shots), ['rustle', 'pluck', 'rustle', 'bruise', 'rustle', 'find', 'rustle', 'slice', 'slice', 'tear', 'peel'], 'the knife kneels unheard, as the gatherer\'s own ear has it');
  assert.ok(near(shots[6].pitch, GATHER_SOUND.MISS_PITCH), 'a miss: the rustle, lower');
  assert.ok(near(shots[7].pitch, GATHER_SAY.knife.pitch), 'the knife going in');
  // the net
  shots.length = 0;
  go({ ga: code('wind') });
  go({ ga: code('fly'), gm: 7 });
  go({ ga: code('wait'), gm: 7 });
  assert.deepEqual(sfx(shots), ['throw', 'netLand']);
  const net = [FEET[0], FEET[1], FEET[2] + 7];
  assert.deepEqual(shots[1].at, net, 'landing where it was thrown - seven metres along the way the body faces');
  const plipS = GATHER_SOUND.PLIP_MIN_S + 0.5 * (GATHER_SOUND.PLIP_MAX_S - GATHER_SOUND.PLIP_MIN_S);
  step(plipS - 0.1);
  s.update('p', at({ ga: code('wait'), gm: 7 }), FEET);
  assert.equal(shots.length, 2, 'the water quiet a while');
  step(0.2);
  s.update('p', at({ ga: code('wait'), gm: 7 }), FEET);
  assert.deepEqual(sfx(shots).slice(2), ['plip'], 'a plip by the floats');
  assert.deepEqual(shots[2].at, net);
  go({ ga: code('tug'), gm: 7 });
  go({ ga: code('haul'), gm: 7 });
  const thrashS = GATHER_SOUND.THRASH_MIN_S + 0.5 * (GATHER_SOUND.THRASH_MAX_S - GATHER_SOUND.THRASH_MIN_S);
  step(thrashS + 0.01);
  s.update('p', at({ ga: code('haul'), gm: 7 }), FEET);
  assert.deepEqual(sfx(shots).slice(3), ['tug', 'thrash', 'thrash'], 'the tug, the haul begun, the catch fighting');
  for (const x of shots.slice(3)) assert.deepEqual(x.at, net, 'at the net');
  go({ gb: beat(9, 'out') });
  assert.equal(sfx(shots).at(-1), 'netOut');
  assert.deepEqual(shots.at(-1).at, [FEET[0], FEET[1] + 0.8, FEET[2]], 'the net in, at the body');
});

test('PEER-ACTS P7 the receiver\'s ear: the classic skin says the DFU cue the gatherer\'s own ear says, positional; out of earshot or behind the switch it says nothing and replays nothing later, its blows in the air dropped; a floor under one peer\'s cues; a peer forgotten is met afresh; the recentre carries what was held with the land (mutants: the classic skin silent; a beat replayed; the held blow kept; the floor; the rebase)', () => {
  // the classic skin
  const c = ear({ on: false });
  c.s.update('p', { yaw: 0, ga: code('mine') }, FEET);
  c.step(0.5); c.s.update('p', { yaw: 0, ga: code('mine'), gb: beat(1, 'blow') }, FEET);
  assert.deepEqual(c.shots, [], 'the swing has no DFU cue');
  c.step(0.5); c.s.update('p', { yaw: 0, ga: code('mine'), gb: beat(1, 'blow') }, FEET);
  assert.equal(c.shots.length, 1);
  assert.ok(PROF_CUES.strike.clips.includes(c.shots[0].key), 'the blow: a DFU hit');
  assert.equal(c.shots[0].volume, PROF_CUES.strike.volume);
  assert.deepEqual(c.shots[0].at, peerActAt(FEET, 0), 'at the act');
  // out of earshot: nothing, and nothing replayed
  const { s, shots, step } = ear();
  s.update('p', { yaw: 0, ga: code('mine') }, FEET);
  step(0.5); s.update('p', { yaw: 0, ga: code('mine'), gb: beat(1, 'blow') }, FEET, false);
  step(0.5); s.update('p', { yaw: 0, ga: code('mine'), gb: beat(1, 'blow') }, FEET, true);
  assert.deepEqual(shots, [], 'a beat struck out of earshot is not heard on coming near');
  step(0.5); s.update('p', { yaw: 0, ga: code('mine'), gb: beat(2, 'blow') }, FEET);
  assert.deepEqual(sfx(shots), ['swing']);
  s.update('p', { yaw: 0, ga: code('mine'), gb: beat(2, 'blow') }, FEET, false);
  step(0.5); s.update('p', { yaw: 0, ga: code('mine'), gb: beat(2, 'blow') }, FEET);
  assert.deepEqual(sfx(shots), ['swing'], 'the blow in the air dropped with the peer out of earshot');
  // the floor
  step(0.5); s.update('p', { yaw: 0, ga: code('mine'), gb: beat(3, 'blow') }, FEET);
  step((PEER_GATHER_CUE_MS - 30) / 1000); s.update('p', { yaw: 0, ga: code('mine'), gb: beat(4, 'blow') }, FEET);
  assert.deepEqual(sfx(shots), ['swing', 'swing'], `a second beat within ${PEER_GATHER_CUE_MS} ms is no cue`);
  // forgotten: met afresh
  step(0.5); s.update('p', { yaw: 0, ga: code('mine'), gb: beat(4, 'blow') }, FEET);
  const before = shots.length;
  s.forget('p');
  assert.equal(s.peers.has('p'), false);
  step(0.5); s.update('p', { yaw: 0, ga: code('mine'), gb: beat(5, 'blow') }, FEET);
  assert.equal(shots.length, before, 'a first sight again');
  // the recentre: a blow in the air is a place on the land - PIN MOVED (AUDIT GATHER-FEEL W1): it moves with the land,
  // where it was dropped with the old frame (and a net's water with it, heard at the body for the rest of its cast)
  const off = [-819.2, 0, 0], moved = [FEET[0] + off[0], FEET[1], FEET[2]];
  step(0.5); s.update('p', { yaw: 0, ga: code('mine'), gb: beat(6, 'blow') }, FEET);
  s.rebase(off);
  step(0.5); s.update('p', { yaw: 0, ga: code('mine'), gb: beat(6, 'blow') }, moved);
  assert.equal(sfx(shots).at(-1), 'pick', 'the held blow lands after the recentre');
  assert.deepEqual(shots.at(-1).at.map((v) => +v.toFixed(6)), peerActAt(moved, 0).map((v) => +v.toFixed(6)), '...where it was struck, in the new frame');
});

// ═══ THE LANES ═══════════════════════════════════════════════════════════════════════════════════════════════════════

test('PEER-ACTS P8 the peers\' sync hears every peer gathering - a body peer\'s, a hidden one\'s - behind the swings\' switch and within earshot; a peer gone is forgotten and the recentre carries what was held with the land (mutants: the sound unwired; the switch, the earshot ignored; the sweep; the rebase)', async () => {
  const { getPref, setPref } = await import('../../src/systems/uiPrefs.js');
  const shots = [];
  const rp = new RemotePlayers({ renderer: {}, deps: { fetchBytes: async () => null, palette: null, audio: { play3d: (k, at) => shots.push({ key: k, at: [...at] }) } }, compose: async () => null });
  const clock = { ms: 0 };
  Object.assign(rp._gatherSounds, { now: () => clock.ms, on: () => true, rand: () => 0.5, install: false });
  const peer = (s) => ({ id: 'ida-0001', name: 'ida', shown: { x: 3, y: 0, z: 4, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, fk: 0, ...s }, look: null });
  const opts = { bodyHeight: () => 2, eye: [0, 1.7, 0], dt: 1 / 60 };
  const frame = (s, o = {}) => { clock.ms += 500; rp.sync([peer(s)], toScene, { ...opts, ...o }); };
  const was = getPref('peerAttackSounds');
  try {
    setPref('peerAttackSounds', true);
    frame({ ga: code('chop'), gb: beat(1, 'blow') });
    frame({ ga: code('chop'), gb: beat(2, 'blow') });
    assert.deepEqual(sfx(shots), ['swing'], 'a body peer\'s blow, heard');
    assert.deepEqual(shots[0].at, peerActAt([3, 0, 4], 0), 'at their act');
    frame({ ga: code('chop'), gb: beat(2, 'blow') });
    assert.deepEqual(sfx(shots), ['swing', 'chop']);
    setPref('peerAttackSounds', false);
    frame({ ga: code('chop'), gb: beat(3, 'blow') });
    frame({ ga: code('chop'), gb: beat(3, 'blow') });
    setPref('peerAttackSounds', true);
    frame({ ga: code('chop'), gb: beat(3, 'blow') });
    assert.equal(shots.length, 2, 'the switch off: silent - and nothing replayed when it is on again');
    frame({ ga: code('chop'), gb: beat(4, 'blow') }, { eye: [500, 1.7, 500] });
    assert.equal(shots.length, 2, 'past the peers\' far edge: nothing made');
    frame({ ga: code('chop'), gb: beat(5, 'blow') }, { hidden: () => true });
    assert.deepEqual(sfx(shots).slice(2), ['swing'], 'a peer no lane stands is still heard');
    // PIN MOVED (AUDIT GATHER-FEEL W1): the recentre carries the blow in the air with the land (rebaseSounds, the offset's door)
    rp.rebaseSounds([-819.2, 0, 0]);
    frame({ ga: code('chop'), gb: beat(5, 'blow') });
    assert.deepEqual(sfx(shots).slice(3), ['chop'], 'the blow in the air lands after the recentre');
    assert.deepEqual(shots[3].at.map((v) => +v.toFixed(6)), peerActAt([3 - 819.2, 0, 4], 0).map((v) => +v.toFixed(6)), '...carried with the land');
    rp.sync([], toScene, opts);
    assert.equal(rp._gatherSounds.peers.has('ida-0001'), false, 'gone: forgotten');
  } finally { setPref('peerAttackSounds', was); }
});

test('PEER-ACTS P9 the class sprite: a tool\'s blow and the net\'s throw are its strike - never at the first sight of an act - and an act that kneels draws the yielding foe\'s kneel (REVENANT-FATE\'s held hurt frame), a one-shot and a walk played through (mutants: the strike lost; first sight a strike; the kneel never drawn; the kneel over a one-shot)', () => {
  const renderer = { createBillboardBatch: (archive, record, size) => ({ archive, record, size }), destroyBillboardBatch() {}, textures: { has: () => true } };
  const rp = new RemotePlayers({ renderer, deps: { fetchBytes: async () => null, palette: null, uploadRecordFrame: () => {} }, compose: async () => null });
  const calls = [];
  let oneShot = false;
  const mobileUnit = {
    update: (dt, flags) => { calls.push(['update', flags.striking]); return { record: 1, frame: 0, flip: false }; },
    heldPose: (state, frame) => { calls.push(['held', state, frame]); return { record: 7, frame: 3, flip: false }; },
    isPlayingOneShot: () => oneShot,
  };
  const bundle = { mobileUnit, archive: 400, tex: { archive: 400, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) } };
  const peer = { id: 'p1', shown: null };
  const frame = (o) => { peer.shown = { x: 2, y: 0, z: 3, yaw: 0, mv: 0, an: 0, ...o }; calls.length = 0; rp._shown = []; rp._syncMobilePeer(peer, bundle, toScene, 0.016, [0, 1.6, 0]); return rp._batches.get('p1'); };
  frame({ ga: code('mine'), gb: beat(9, 'blow') });
  assert.deepEqual(calls, [['update', false]], 'first sight: an act met mid-way strikes nothing');
  frame({ ga: code('mine'), gb: beat(9, 'blow') });
  assert.deepEqual(calls, [['update', false]], 'the same beat: nothing');
  frame({ ga: code('mine'), gb: beat(10, 'clean') });
  assert.deepEqual(calls, [['update', true]], 'a blow: the strike');
  frame({ ga: code('wind'), gb: beat(10, 'clean') });
  assert.deepEqual(calls, [['update', false]], 'the net wound: nothing yet');
  frame({ ga: code('fly'), gb: beat(10, 'clean') });
  assert.deepEqual(calls, [['update', true]], 'thrown: the strike');
  const e = frame({ ga: code('hand'), gb: beat(10, 'clean') });
  assert.deepEqual(calls, [['update', false], ['held', 'hurt', -1]], 'kneeling at a herb: the hurt\'s last frame');
  assert.equal(e.batch.record, '7#3', 'drawn on the held frame');
  oneShot = true;
  frame({ ga: code('trace'), gb: beat(10, 'clean') });
  assert.deepEqual(calls, [['update', false]], 'a one-shot plays through');
  oneShot = false;
  frame({ ga: code('basket'), gb: beat(10, 'clean'), mv: 1 });
  assert.deepEqual(calls, [['update', false]], 'and a walk');
  assert.equal(peerKneeling({ ga: code('steady') }), true);
  for (const a of ['chop', 'mine', 'wind', 'fly', 'wait', 'tug', 'haul']) assert.equal(peerKneeling({ ga: code(a) }), false, a);
});

test('PEER-ACTS P10 the Morrowind body: an act\'s tool in the hand, drawn, and swung on each blow with the strike the gatherer\'s hand draws it with; an act of the bare hand, the Basket or the net puts the weapon away; the act over, the look\'s weapon back; a wolf holds no tool; the dead follow the beats; the crouch while an act kneels (mutants: the tool never held; the strike the swing\'s; the blow lost; the weapon drawn at a herb; the dead\'s beats replayed; the crouch lost)', () => {
  const sword = { templateIndex: 120, group: 'Weapons', material: 0, equipSlot: EQUIP_SLOTS.RightHand };
  const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [sword] };
  const log = [];
  const pb = new PeerBodies({ renderer: {}, createRig: () => ({}), buildOpts: peerBuildOpts });
  const rig = {
    setSheathed: (s) => log.push(['sheathed', s]), readySpell() {}, release() {}, setHipLight() {}, upperBodyReady: () => true,
    setWeapon: (w) => { log.push(['weapon', w?.templateIndex ?? null]); return true; },
    attack: (strike) => { log.push(['attack', strike]); return true; },
  };
  const b = { weapon: peerWeaponOf(LOOK), ammo: 0, held: false, swing: null, cast: null, rig };
  const arm = (shown) => { log.length = 0; pb._arm(b, { wd: 1, an: 0, cn: 0, ...shown }, LOOK); return log.filter(([k]) => k !== 'sheathed').concat([log.find(([k]) => k === 'sheathed')]); };
  assert.deepEqual(arm({}), [['sheathed', false]], 'the sword drawn, as it was');
  assert.deepEqual(arm({ ga: code('mine'), gb: beat(3, 'blow') }), [['weapon', PICK_HAND.templateIndex], ['attack', 'StrikeDown'], ['sheathed', false]], 'the Warhammer drawn for the pick - and the blow struck while watched');
  assert.deepEqual(arm({ ga: code('mine'), gb: beat(3, 'blow') }), [['sheathed', false]], 'the same beat: no blow');
  assert.deepEqual(arm({ ga: code('mine'), gb: beat(4, 'clean') }), [['attack', 'StrikeDown'], ['sheathed', false]], 'a clean one too');
  assert.deepEqual(arm({ ga: code('chop'), gb: beat(5, 'blow') }), [['weapon', AXE_HAND.templateIndex], ['attack', 'StrikeDownRight'], ['sheathed', false]], 'the War Axe, struck as the axe is');
  assert.deepEqual(arm({ ga: code('hand'), gb: beat(6, 'pluck') }), [['weapon', sword.templateIndex], ['sheathed', true]], 'at a herb: the hands at work, the sword put away');
  assert.deepEqual(arm({ ga: code('steady'), gb: beat(6, 'pluck') }), [['weapon', SICKLE_HAND.templateIndex], ['sheathed', false]], 'the Tanto for the sickle - drawn, never swung');
  assert.deepEqual(arm({ gb: beat(6, 'pluck') }), [['weapon', sword.templateIndex], ['sheathed', false]], 'the act over: the look\'s weapon, drawn as the pose says');
  // the dead follow the beats: a body brought back replays none
  arm({ ga: code('mine'), gb: beat(7, 'blow'), dd: 1 });
  assert.deepEqual(arm({ ga: code('mine'), gb: beat(7, 'blow') }).filter(([k]) => k === 'attack'), [], 'risen: no blow from while it lay dead');
  // the wolf's hands are its claws
  b.wolf = true;
  assert.deepEqual(arm({ ga: code('mine'), gb: beat(8, 'blow') }).filter(([k]) => k === 'weapon').map(([, w]) => w), [null], 'a wolf holds no tool');
  // the crouch
  const cam = (o) => peerCamera({ ...P, ...o }, [0, 0, 0]).sneaking;
  for (const a of ['hand', 'steady', 'basket', 'trace']) assert.equal(cam({ ga: code(a) }), true, `${a}: crouched - Morrowind's own sneak idle`);
  for (const a of ['chop', 'mine', 'fly', 'haul']) assert.equal(cam({ ga: code(a) }), false, a);
  assert.equal(cam({}), false, 'standing off an act');
});

/** The walkers over an art store whose pictures decode to a plain sheet. */
function walkers() {
  const renderer = { uploadTexture() {}, createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: null }), destroyBillboardBatch() {} };
  const art = createEotbArt({ renderer, urlFor: (k) => `u:${k}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }) });
  return createPeerWalkers({ art });
}
const walkPose = (o = {}) => ({ x: 4, y: 0, z: 9, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });

test('PEER-ACTS P11 Eye Of The Beholder\'s walker: ready while an act holds a tool, its hands at work otherwise (a drawn sword put away at a herb, no bow drawn, no spell readied); a blow plays the melee clip\'s chop and the throw its sweep - once, never at first sight (mutants: the stance the pose\'s; the strokes crossed; the blow lost; first sight a stroke)', () => {
  assert.deepEqual(walkerHands(walkPose({ ga: code('mine') })), { sheathed: false, spellcasting: false, usingBow: false });
  assert.deepEqual(walkerHands(walkPose({ ga: code('hand'), wd: 1, sr: 1 })), { sheathed: true, spellcasting: false, usingBow: false });
  assert.deepEqual(walkerHands(walkPose({ ga: code('wait'), wd: 2 })), { sheathed: true, spellcasting: false, usingBow: false });
  assert.deepEqual(walkerHands(walkPose({ wd: 2, sr: 1 })), { sheathed: false, spellcasting: true, usingBow: true }, 'off an act: the pose\'s own');
  const w = walkers();
  const at = (o) => ({ id: 'p1', look: { eo: 2 }, shown: walkPose(o) });
  const eye = { eye: [4, 1, 20], dt: 0 };
  w.sync([at({ ga: code('mine'), gb: beat(1, 'blow') })], toScene, eye);
  const r = w.walkers.get('p1');
  assert.equal(r.table, 'IdleMelee', 'the pick in hand: ready - and first sight no stroke');
  w.sync([at({ ga: code('hand'), gb: beat(1, 'blow'), wd: 1 })], toScene, eye);
  assert.equal(r.table, 'Idle', 'at a herb: the sword put away');
  const melee = WALK_ONE_SHOTS.find((o) => o.table === 'AttackMelee');
  w.sync([at({ ga: code('mine'), gb: beat(2, 'blow') })], toScene, eye);
  assert.equal(r.table, 'AttackMelee');
  assert.deepEqual(r.shot.frames, melee.frames(WALK_GATHER_STROKES.blow), 'the blow: the clip\'s chop');
  assert.equal(WALK_GATHER_STROKES.blow % 2, 1, 'its second stroke - a chop on an axe or a hammer, an overhead one on a sword');
  const n = r.shot.frames.length, tickS = r.shot.tick;
  w.sync([at({ ga: code('mine'), gb: beat(2, 'blow') })], toScene, { ...eye, dt: tickS * (n + 0.5) });
  assert.equal(r.table, 'IdleMelee', 'played once, then ready again');
  w.sync([at({ ga: code('fly'), gb: beat(2, 'blow') })], toScene, eye);
  assert.deepEqual(r.shot?.frames, melee.frames(WALK_GATHER_STROKES.throw), 'the throw: its sweep');
  assert.notDeepEqual(melee.frames(WALK_GATHER_STROKES.throw), melee.frames(WALK_GATHER_STROKES.blow));
});

// ═══ ONE LAW ═════════════════════════════════════════════════════════════════════════════════════════════════════════

test('PEER-ACTS P12 one law, pinned: the stand-in tools are the classic hand\'s own (the hosts\' AXE_HAND, PICK_HAND, SICKLE_HAND, KNIFE_HAND), the strikes the ones the hand draws (axeHandFrame, pickHandFrame), a peer\'s blow\'s delay the machines\' own landsIn at the press; and the hosts send and hear it - the online frame\'s arm spreads the gathering host\'s poseAct, the peers\' sync hears every peer (mutants: a stand-in drifted; the arm unspread; the sync unwired)', () => {
  assert.deepEqual({ ...GATHER_POSE_TOOLS.chop }, { ...AXE_HAND });
  assert.deepEqual({ ...GATHER_POSE_TOOLS.mine }, { ...PICK_HAND });
  assert.deepEqual({ ...GATHER_POSE_TOOLS.steady }, { ...SICKLE_HAND });
  assert.deepEqual({ ...GATHER_POSE_TOOLS.trace }, { ...KNIFE_HAND });
  for (const a of ['hand', 'basket', 'wind', 'fly', 'wait', 'tug', 'haul']) assert.equal(peerGatherTool({ ga: code(a) }), null, `${a}: no weapon in the hand`);
  assert.equal(GATHER_POSE_STRIKES.chop, axeHandFrame(1).state);
  assert.equal(GATHER_POSE_STRIKES.mine, pickHandFrame(1).state);
  const c = createChopAct({ tier: 1 });
  c.tick(0.001, { attack: true });
  assert.ok(near(PEER_BLOW_DELAY_S.chop, c.landsIn, 1e-9), 'the axe\'s blow lands when the gatherer\'s does');
  const m = createMineAct({ tier: 1, rng: dice(0, 0.3, 0.6, 0.9) });
  m.tick(0.001, { attack: true, aim: onGlint(m) });
  assert.ok(near(PEER_BLOW_DELAY_S.mine, m.landsIn, 1e-9), 'and the pick\'s');
  // a lane's own record: first sight nothing, a new blow or a throw once
  const seen = {};
  assert.equal(peerGatherSwing(seen, { ga: code('fly'), gb: beat(4, 'blow') }), null, 'first sight');
  assert.equal(peerGatherSwing(seen, { ga: code('wait'), gb: beat(4, 'blow') }), null);
  assert.equal(peerGatherSwing(seen, { gb: beat(5, 'pluck') }), null, 'a pluck swings nothing');
  assert.equal(peerGatherSwing(seen, { ga: code('chop'), gb: beat(6, 'clean') }), 'blow');
  assert.equal(peerGatherSwing(seen, { ga: code('fly'), gb: beat(6, 'clean') }), 'throw');
  assert.equal(peerGatherSwing(seen, { ga: code('fly'), gb: beat(6, 'clean') }), null, 'once');
  // the hosts
  const w = src('src/scenes/world.js');
  const arm = w.slice(w.indexOf('    const arm = {\n      mv,'), w.indexOf('};   // the wire\'s move bit'));
  assert.ok(arm.length > 0, 'the pose\'s arm block');
  assert.match(arm, /\n\s*\.\.\.\(gatherHost\?\.poseAct\(\) \?\? \{\}\),/, 'every pose and the hello carry the gathering host\'s fields');
  const rp = src('src/net/remotePlayers.js');
  assert.match(rp, /this\._syncAttackSound\(peer, toScene, eye\);\s*\n\s*this\._syncGatherSound\(peer, toScene, eye\);/, 'heard beside the swing, for every peer the sync meets');
});
