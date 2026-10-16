// AUDIT GATHER-FEEL (2026-10-13, Mac: "audit everything" - GATHER-FEEL and GATHER-FEEL II, PR #868;
// bible/01-Overview/audits/Audit-Gather-Feel.md): THE AUDIT'S PINS, each failing on the code the lanes read (a frozen worktree
// at 5c345face) and passing on the fix.
//   LANDING (F1, F2, F3, R11, R4, W2, R12) - a blow lands on ONE clock, its machine's count of blows landed: the clack,
//     the kick, the chunks and the node's going on one frame at any frame length, a new act begun under it or not; a blow
//     let go (Escape, walked off, the dungeon left, the professions shut) goes from every ear, the others' too; a blow
//     whose node another took lands on nothing.
//   THE CRACKS AND CHUNKS (R3) - closed at every end the record names; a burst's box, the glint's five through the host,
//     the sink.
//   THE PEERS (W1, W3, W4) and THE RECENTRE - a net's water at the net however it was first heard; the body asleep
//     follows the beats; the idle early-out holds through a reload; the places held move with the land, here and there.
//   THE FEEL (R2, R16) - BLOW-SHAKE's own doors, as they ship; the springs never the look the glint is aimed with.
//   THE NUMBERS (R5, R7, F4) - the tables the record states, by their numbers; the floor one pose; the dungeon's veins
//     typed.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PX, WOODS, GLENUMBRA, NOON, rig, arrive, strikeOut, lands, sfxOf, tick, dice } from '../gatherRig.mjs';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { MINE_ACT, FISH_ACT } from '../../src/net/professionLaw.js';
import { createGatherEar, GATHER_SOUND } from '../../src/systems/gatherSounds.js';
import { createFishAct } from '../../src/systems/fishAct.js';
import { gatherBlowFeel, VEIN_CHUNKS, chunkSink } from '../../src/systems/gatherBlow.js';
import { VEIN_CRACK_SHADE, VEIN_CRACK_ORDER, VEIN_CRACK_CELL } from '../../src/systems/veinCrack.js';
import { stepTechniqueFx, techniqueView, techniqueHands, resetTechniqueFx } from '../../src/combat/technique/techniqueFx.js';
import { createClimbFeelHost } from '../../src/player/climb/climbFeel.js';
import { getPref, setPref } from '../../src/systems/uiPrefs.js';
import { setUiSkin } from '../../src/systems/uiSkin.js';
import { prefersReducedMotion } from '../../src/systems/hitFlash.js';
import { PeerGatherSounds, GATHER_POSE_ACTS, GATHER_POSE_BEATS, gatherBeatOf, peerActAt, PEER_GATHER_CUE_MS } from '../../src/net/peer/peerGather.js';
import { PEER_SOUND_PROFILE } from '../../src/net/remotePlayers.js';
import { PeerBodies, peerBuildOpts, BODY_RANGE } from '../../src/net/peer/peerBodies.js';
import { POSE_HZ } from '../../src/net/online.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { AudioEngine, VOICE_FADE_S } from '../../src/systems/audio.js';
import { mineFlats, standDungeonVeins, standMineNodes, mineKind } from '../../src/scenes/mineHost.js';
import { utcDayOfMs, veins } from '../../src/net/nodeLaw.js';
import { shedChunks, stepChunk, chunkBox } from '../../src/systems/gatherBlow.js';
import { setBatchCrack } from '../../src/systems/veinCrack.js';
import { groundAt } from '../../src/world/terrain/terrainNature.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../src/world/terrain/terrainSampler.js';
import { Renderer, WORLD_FRAME } from '../../src/render/renderer.js';
import { EL_LANE, EL_BB_FS, elDecode, elEncode } from '../../src/render/enhancedLighting.js';
import { perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const code = (n) => GATHER_POSE_ACTS.indexOf(n) + 1;
const beat = (n, k) => n * 16 + GATHER_POSE_BEATS.indexOf(k);
const OFF = Object.freeze([-819.2, 0, 0]);   // a recentre: the floating origin's shift, every scene point moved by it
const shifted = (p) => [p[0] + OFF[0], p[1] + OFF[1], p[2] + OFF[2]];
const round = (p) => p.map((v) => +v.toFixed(6));

/** A renderer that keeps every batch it was asked for, its moves and whether it was freed. */
function keepingRenderer() {
  const made = [];
  return {
    made,
    createBillboardBatch: (archive, record, size, centers, o) => { const b = { archive, record, size, centers: centers.map((c) => [...c]), dynamic: !!o?.dynamic, destroyed: false, moves: [], at: null }; made.push(b); return b; },
    destroyBatch: (b) => { b.destroyed = true; },
    moveBillboardBatch: (b, centers) => { b.at = centers.map((c) => [...c]); (b.moves ??= []).push(b.at); return true; },
  };
}
const bursts = (r) => r.made.filter((b) => b.dynamic).map((b) => b.centers.length);
const blows = (t) => t.audio.shots.filter((s) => /gather:(pick|chop)/.test(s.key)).length;
const heard = (t, from = 0) => t.audio.shots.slice(from).map((s) => sfxOf(s.key));
const sameCenters = (a, b) => a.length === b.length && a.every((c, i) => c.every((v, k) => near(v, b[i][k], 1e-9)));
/** The live batch that stands exactly a node's flats - its own (worked), or null where it shares one. */
const ownBatch = (list, n) => list.find((b) => !b.dynamic && !b.destroyed && sameCenters(b.centers, mineFlats(n))) ?? null;
/** One press of the attack, one frame long. */
function press(t, dt = 0.001) {
  t.input.v = { held: false, attack: true, choice: false };
  t.host.tick(dt);
  t.input.v = { held: false, attack: false, choice: false };
}
/** A host with its kicks kept (BLOW-SHAKE's door - each with the shots heard when it came) over a keeping renderer. */
async function feltRig(o = {}) {
  const r = keepingRenderer();
  const kicks = [];
  let t = null;
  t = await rig({ renderer: r, feel: (kind, clean) => { kicks.push({ kind, clean, blows: blows(t) }); return true; }, ...o });
  return { t, r, kicks };
}
/** A dungeon entered beside the rig's pixel, its one door's batches kept - and its first vein. */
async function underground(t, r) {
  const state = { under: false };
  const wall = (m, b) => [6 + m * 9, 0, 4 + b];
  const stood = [];
  t.host.enterDungeon({
    id: 1234, climate: WOODS, region: GLENUMBRA, wall,
    stand: async (a, rec, s, c, o) => { const b = r.createBillboardBatch(a, rec, { w: 0.3 * s, h: 0.3 * s }, c, o); stood.push(b); return b; },
    drop: (b) => { b.destroyed = true; },
  });
  return { state, stood, wall, vein: () => standDungeonVeins({ dungeon: 1234, day: utcDayOfMs(NOON * 1000), climate: WOODS, confirmed: false, wall })[0] };
}

// ═══ LANDING ═════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT GATHER-FEEL F1: a new act begun while the last blow is still in the air - that blow lands all the same, on its own frame: its clack, its kick, its node going (its rubble) and its breaking burst of seven; its vein stands apart, cracked, until then; the hand is the new act\'s (mutants: the swing dropped at a new act, the cracked vein stood back into its twin\'s batch)', async () => {
  try {
    const { t, r, kicks } = await feltRig();
    const [v, w] = t.host.nodesOf(PX, 150).filter((n) => n.what === 'vein' && n.tier === 1);
    assert.ok(v && w, 'two tier-1 veins');
    await arrive(t, v);
    strikeOut(t, v);
    const k0 = kicks.length, c0 = blows(t), n0 = t.audio.shots.length;
    t.face(w);
    t.host.tick(0.001);   // the frame the next vein is found
    assert.equal(t.host.press(), true, 'the next act begun under the blow still falling');
    assert.equal(t.host.handTool()?.state, 'Idle', 'the new act holds the hand');
    for (let i = 0; i < 4; i++) await tick();   // the pixel stood again for the new act's vein
    assert.ok(ownBatch(t.entry.batches, v)?.crack?.[0] > 0, 'the old vein still stands apart, cracked, under its last blow');
    let landed = -1;
    for (let i = 0; i < 20; i++) {
      const k = kicks.length, c = blows(t);
      t.host.tick(0.02);
      if (kicks.length > k) { landed = i; assert.equal(blows(t), c + 1, 'its clack on the kick\'s frame'); }
      else assert.equal(blows(t), c, 'no clack without its kick');
    }
    assert.ok(landed >= 0, 'its kick');
    assert.equal(kicks.length - k0, 1);
    assert.equal(blows(t) - c0, 1, 'its clack');
    assert.ok(heard(t, n0).includes('rubble'), 'its vein went as it landed');
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(bursts(r).at(-1), VEIN_CHUNKS.last, 'the breaking burst - the vein went under it');
    // a tree felled, and a vein begun on its pixel under the felling chop: the tree stands until the chop lands
    const tree = t.host.nodesOf(PX, 150).find((n) => n.kind === 'tree' && n.tier === 1);
    assert.ok(tree, 'a tier-1 tree');
    assert.equal(t.host.cancel(), true, 'the vein\'s act put down');
    t.host.tick(MINE_ACT.swingS);
    await arrive(t, tree);
    t.face(tree);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true, 'at the tree');
    for (let i = 0; i < 20 && t.host.acting(); i++) { t.host.tick(MINE_ACT.swingS + 0.01); press(t); }
    assert.equal(t.host.acting(), false, 'felled on its last press');
    const sunk = () => t.entry.forest.groups.get('504_12').sunkN ?? 0;
    assert.equal(sunk(), 0, 'standing under the chop still falling');
    const n1 = t.audio.shots.length;
    t.face(w);   // the vein put down, standing
    t.host.tick(0.001);
    assert.equal(t.host.press(), true, 'a vein begun on its pixel');
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(sunk(), 0, 'its pixel stood again, the tree still standing under its chop');
    for (let i = 0; i < 20; i++) t.host.tick(0.02);
    assert.ok(heard(t, n1).includes('fall'), 'it falls as its chop lands');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('AUDIT GATHER-FEEL F3/R11: one clock - at any frame length every blow\'s clack, its kick and (the last one\'s) its vein going are one frame, and the breaking burst is seven; a frame long enough to land one blow and begin the next swing lands that blow, felt and heard once (mutants: the landing read off landsIn, the ear on its own clock, the node felled on a countdown of its own)', async () => {
  try {
    for (const dt of [1 / 30, 1 / 60, 0.0225, 0.045, 0.009, 1 / 144]) {
      const { t, r, kicks } = await feltRig();
      const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
      await arrive(t, v);
      t.face(v);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true);
      let strikes = 0, fellAt = -1, lastKick = -1;
      const every = Math.ceil((MINE_ACT.swingS + 0.02) / dt);   // a press once the last swing has run out: each one counts
      for (let f = 0; f < 600 && (t.host.acting() || t.host.handTool()); f++) {
        const attack = t.host.acting() && f % every === every - 1;
        const k = kicks.length, c = blows(t), n = t.audio.shots.length;
        t.input.v = { held: false, attack, choice: false };
        t.host.tick(dt);
        if (attack) strikes++;
        assert.equal(kicks.length - k, blows(t) - c, `dt ${dt}: a frame\'s kicks are its clacks (frame ${f})`);
        if (kicks.length > k) lastKick = f;
        if (heard(t, n).includes('rubble')) fellAt = f;
      }
      t.input.v = { held: false, attack: false, choice: false };
      assert.equal(t.host.acting(), false, `dt ${dt}: worked out`);
      assert.ok(strikes >= 3 && kicks.length === strikes && blows(t) === strikes, `dt ${dt}: every blow felt and heard once (${strikes} strikes, ${kicks.length} kicks, ${blows(t)} clacks)`);
      assert.equal(fellAt, lastKick, `dt ${dt}: the vein went on its last blow\'s frame`);
      for (let i = 0; i < 4; i++) await tick();
      assert.equal(bursts(r).at(-1), VEIN_CHUNKS.last, `dt ${dt}: the breaking burst`);
      t.host.dispose();
    }
    // R11: a long frame lands the blow in the air and begins the next swing - the first blow felt, heard and shed once
    const { t, r, kicks } = await feltRig();
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    await arrive(t, v);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    t.view.yaw += 10;   // off the glint: every strike plain
    press(t);
    t.host.tick(0.05);
    const c0 = blows(t);
    press(t, 0.5);   // past the first blow's landing and its swing's end - the press begins the second swing
    assert.equal(kicks.length, 1, 'the first blow felt in the long frame');
    assert.equal(blows(t) - c0, 1, '...and heard there, once');
    for (let i = 0; i < 4; i++) await tick();
    assert.deepEqual(bursts(r), [VEIN_CHUNKS.plain], '...and its chunks shed');
    t.host.tick(lands + 0.01);
    assert.equal(kicks.length, 2, 'the second lands on its own');
    assert.equal(blows(t) - c0, 2);
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('AUDIT GATHER-FEEL F2/R4: a blow let go is heard nowhere after - the dungeon left under a finished act\'s last blow (no pick at the dungeon\'s places in the street) or the act\'s own strike; the professions shut under the last blow; walked off with a strike in the air - no clack, no kick, the hand put away (mutants: the swing let go without its ear, each door\'s let-go dropped)', async () => {
  try {
    // the dungeon left: a finished act's last swing, and the act's own strike
    for (const finished of [true, false]) {
      const { t, r, kicks } = await feltRig({ ranks: { mining: 25 }, extra: { rand: dice(0.1, 0.9, 0.5, 0.3, 0.7), activeDungeon: () => d.state.under } });
      const d = await underground(t, r);
      d.state.under = true;
      for (let i = 0; i < 8; i++) await tick();
      const v = d.vein();
      await arrive(t, v);
      t.face(v);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true, 'worked underground');
      if (finished) for (let i = 0; i < 20 && t.host.acting(); i++) { t.host.tick(MINE_ACT.swingS + 0.01); press(t); }
      else { t.host.tick(MINE_ACT.swingS + 0.01); press(t); }
      assert.equal(t.host.acting(), !finished);
      assert.ok(t.host.handTool(), 'a blow in the air');
      const n = t.audio.shots.length, k = kicks.length;
      t.host.leaveDungeon();
      d.state.under = false;
      t.feet[0] = 900; t.feet[2] = 900;   // the street's own frame now
      for (let i = 0; i < 20; i++) t.host.tick(0.02);
      assert.deepEqual(heard(t, n).filter((s) => s !== 'haul' && s !== 'rank'), [], `${finished ? 'the last' : 'a'} blow heard nowhere after the dungeon`);
      assert.equal(kicks.length, k, 'nor felt');
      assert.deepEqual(t.e.pending, [], '...nor held for a landing that will never come');
      assert.equal(t.host.handTool(), null, 'the pick put away');
      t.host.dispose();
    }
    // the professions shut under the last blow
    {
      const { t, kicks } = await feltRig();
      const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
      await arrive(t, v);
      strikeOut(t, v);
      const c = blows(t), k = kicks.length;
      t.book.state.open = false;
      for (let i = 0; i < 20; i++) t.host.tick(0.02);
      assert.equal(blows(t), c, 'shut: the last blow unheard');
      assert.equal(kicks.length, k, '...unfelt');
      assert.deepEqual(t.e.pending, [], '...nothing held for it');
      assert.equal(t.host.handTool(), null, '...the tool put away');
      t.host.dispose();
    }
    // walked off with a strike in the air
    {
      const { t, kicks } = await feltRig();
      const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
      await arrive(t, v);
      t.face(v);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true);
      t.host.tick(MINE_ACT.swingS + 0.01);
      press(t);
      const c = blows(t), k = kicks.length;
      t.feet[0] += 30;   // walked off: the act ends the next frame
      for (let i = 0; i < 20; i++) t.host.tick(0.02);
      assert.equal(t.host.acting(), false, 'walked off');
      assert.equal(blows(t), c, 'its blow went with the hand');
      assert.equal(kicks.length, k);
      t.host.dispose();
    }
  } finally { setForagingHost(null); }
});

test('AUDIT GATHER-FEEL W2: a blow taken back is taken back for everyone - Escape with a strike in the air: the gatherer\'s ear drops it and so does every peer\'s, on the pose\'s `stop` beat (under the floor too); an honest blow still lands for both (mutants: the stop uncounted, the stop unheard by the peer, the wrong blow dropped)', async () => {
  try {
    const t = await rig();
    const v = t.host.nodesOf(PX, 150).find((n) => n.kind === 'mine' && n.tier === 1);
    await arrive(t, v);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    t.view.yaw += 10;
    t.host.tick(0.016);
    // the peer who watches, fed the poses this gatherer's online frame would send
    const peerHeard = [];
    let ms = 10_000;
    const peer = new PeerGatherSounds({ audio: { play3d: (k) => peerHeard.push(sfxOf(k)) }, profile: PEER_SOUND_PROFILE, on: () => true, rand: () => 0.5, install: false, now: () => ms });
    const watch = (dt) => { ms += dt * 1000; peer.update('g', { yaw: 0, ...t.host.poseAct() }, [0, 0, 0]); };
    const run = (dt, frames = 1) => { for (let i = 0; i < frames; i++) { t.host.tick(dt); watch(dt); } };
    watch(0.016);   // first sight
    const mine = () => heard(t).filter((k) => k === 'swing' || k === 'pick' || k === 'pickGlint');
    run(MINE_ACT.swingS + 0.01);
    press(t); watch(0.001);
    run(0.016, 30);
    assert.deepEqual(mine(), ['swing', 'pick'], 'an honest blow: the gatherer');
    assert.deepEqual(peerHeard, ['swing', 'pick'], '...and the peer');
    // a strike, and Escape 50 ms on - inside the peer's floor of its swing's cue
    run(MINE_ACT.swingS);
    press(t); watch(0.001);
    run(0.05);
    const before = t.host.poseAct().gb;
    assert.equal(t.host.cancel(), true);
    const after = t.host.poseAct().gb;
    assert.equal(gatherBeatOf(after), 'stop', 'the pose counts the blow taken back');
    assert.equal(after >> 4, (before >> 4) % 255 + 1, '...the next beat after the blow');
    assert.ok(0.05 * 1000 < PEER_GATHER_CUE_MS, 'under the floor');
    run(0.016, 40);
    assert.deepEqual(mine(), ['swing', 'pick', 'swing'], 'the gatherer: the blow went with the hand');
    assert.deepEqual(peerHeard, ['swing', 'pick', 'swing'], 'the peer: the same');
    // a peer's ear alone: the stop drops the blow counted just before it, never an older one
    const shots = [];
    let at = 0;
    const s = new PeerGatherSounds({ audio: { play3d: (k) => shots.push(sfxOf(k)) }, profile: PEER_SOUND_PROFILE, on: () => true, rand: () => 0.5, install: false, now: () => at });
    s.update('p', { yaw: 0, ga: code('mine') }, [0, 0, 0]);
    at += 500; s.update('p', { yaw: 0, ga: code('mine'), gb: beat(255, 'blow') }, [0, 0, 0]);
    at += 50; s.update('p', { yaw: 0, ga: code('mine'), gb: beat(1, 'stop') }, [0, 0, 0]);
    at += 500; s.update('p', { yaw: 0, gb: beat(1, 'stop') }, [0, 0, 0]);
    assert.deepEqual(shots, ['swing'], 'the count round past 255: blow 255 taken back by stop 1');
    at += 500; s.update('p', { yaw: 0, ga: code('mine'), gb: beat(2, 'blow') }, [0, 0, 0]);
    at += 50; s.update('p', { yaw: 0, ga: code('mine'), gb: beat(4, 'stop') }, [0, 0, 0]);
    at += 500; s.update('p', { yaw: 0, ga: code('mine'), gb: beat(4, 'stop') }, [0, 0, 0]);
    assert.deepEqual(shots, ['swing', 'swing', 'pick'], 'a stop for another blow drops none');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('AUDIT GATHER-FEEL R12: a harvest another took (node-taken) answered before the last blow lands - its vein gone from under it, the blow lands on nothing: no clack, no kick, no chunks (mutants: the whiff unread, its blow kept in the ear)', async () => {
  try {
    const { t, r, kicks } = await feltRig();
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    await arrive(t, v);
    strikeOut(t, v);
    for (let i = 0; i < 4; i++) await tick();
    const b0 = bursts(r).length, k0 = kicks.length, c0 = blows(t);
    t.gate.answers.shift()({ ok: false, error: 'node-taken' });
    for (let i = 0; i < 6; i++) await tick();
    t.host.tick(0.001);
    for (let i = 0; i < 20; i++) t.host.tick(0.02);
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(blows(t), c0, 'no clack');
    assert.equal(kicks.length, k0, 'no kick');
    assert.equal(bursts(r).length, b0, 'no chunks out of the empty air');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

// ═══ THE CRACKS AND THE CHUNKS ═══════════════════════════════════════════════════════════════════════════════════════

test('AUDIT GATHER-FEEL R3: a worked vein\'s cracks close at every end the record names - walked off, the professions shut, the dungeon left (re-entered, it stands whole) - as at Escape and a refusal (mutants: each end\'s unwork dropped)', async () => {
  try {
    const crackedThenEnd = async (end) => {
      const r = keepingRenderer();
      const t = await rig({ renderer: r, ranks: { mining: 10 }, extra: { rand: dice(0.1, 0.9, 0.5, 0.3, 0.7) } });
      const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.material === 'metal:lodestone');
      await arrive(t, v);
      t.face(v);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true);
      for (let i = 0; i < 4; i++) await tick();
      t.view.yaw += 10;
      press(t);
      t.host.tick(lands + 0.01);
      assert.ok(ownBatch(t.entry.batches, v)?.crack?.[0] > 0, 'cracked');
      end(t);
      t.host.tick(0.016);
      assert.equal(ownBatch(t.entry.batches, v)?.crack ?? null, null, 'closed over');
      t.host.dispose();
    };
    await crackedThenEnd((t) => { t.feet[0] += 30; });   // walked off
    await crackedThenEnd((t) => { t.book.state.open = false; });   // the professions shut
    // the dungeon left: re-entered, its vein stands whole
    const r = keepingRenderer();
    const t = await rig({ renderer: r, ranks: { mining: 25 }, extra: { rand: dice(0.1, 0.9, 0.5, 0.3, 0.7), activeDungeon: () => d.state.under } });
    let d = await underground(t, r);
    d.state.under = true;
    for (let i = 0; i < 8; i++) await tick();
    const v = d.vein();
    await arrive(t, v);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    t.view.yaw += 10;
    press(t);
    t.host.tick(lands + 0.01);
    assert.ok(d.stood.find((b) => !b.dynamic && !b.destroyed && sameCenters(b.centers, mineFlats(v)))?.crack?.[0] > 0, 'cracked underground');
    t.host.leaveDungeon();
    d.state.under = false;
    const again = await underground(t, r);
    d = again;
    d.state.under = true;
    for (let i = 0; i < 8; i++) await tick();
    const own = again.stood.find((b) => !b.dynamic && sameCenters(b.centers, mineFlats(v)));
    assert.ok(own, 'stood again on re-entering');
    assert.equal(own.crack ?? null, null, 'whole - its act ended with the dungeon');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('AUDIT GATHER-FEEL R3: a burst\'s batch - its box holds every chunk\'s whole flight (EV3 culls by it: a batch without one is no batch the street\'s frame can test), a strike on the glint sheds five through the host, and the chunks lying sink before they go (mutants: the box dropped, the glint unread by the host, the sink dropped)', async () => {
  const realRandom = Math.random;
  try {
    const { t, r } = await feltRig();
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    await arrive(t, v);
    t.face(v);
    t.host.tick(0.016);
    Math.random = dice(0.1, 0.5, 0.9, 0.3);   // the act's glint first at the face's middle (MINE_POINTS[0]), where the look is
    try { assert.equal(t.host.press(), true); } finally { Math.random = realRandom; }
    press(t);
    t.host.tick(lands + 0.01);
    assert.ok(t.audio.shots.some((s) => sfxOf(s.key) === 'pickGlint'), 'struck on the glint');
    for (let i = 0; i < 4; i++) await tick();
    assert.deepEqual(bursts(r), [VEIN_CHUNKS.clean], 'the glint\'s five');
    const b = r.made.find((x) => x.dynamic);
    assert.ok(Array.isArray(b._box) && b._box.length === 6, 'its box');
    const floor = v.local[1];
    let sunk = false;
    for (let i = 0; i < 200 && !b.destroyed; i++) t.host.tick(0.02);
    assert.ok(b.destroyed, 'freed once its chunks are gone');
    for (const centers of b.moves) {
      for (const c of centers) {
        for (let k = 0; k < 3; k++) assert.ok(c[k] >= b._box[k] - 1e-9 && c[k] <= b._box[k + 3] + 1e-9, `inside its box: ${c}`);
        if (c[1] < floor - 1e-6) sunk = true;
      }
    }
    assert.ok(sunk, 'the chunks sink into the ground before they go');
    assert.ok(chunkSink({ rest: VEIN_CHUNKS.restS + VEIN_CHUNKS.sinkS / 2 }, 1) > 0);
    t.host.dispose();
  } finally { Math.random = realRandom; setForagingHost(null); }
});

// ═══ THE PEERS AND THE RECENTRE ══════════════════════════════════════════════════════════════════════════════════════

test('AUDIT GATHER-FEEL W1: a fishing peer\'s water is heard at the net however its landing was missed - first seen while it waits, its landing out of earshot - and the recentre carries the net with the land (mutants: the net a cue\'s alone, the first sight netless, the rebase dropping it)', () => {
  const FEET = [10, 0, 20], NET = [10, 0, 27];
  const run = (script) => {
    const shots = [];
    const clock = { ms: 1000 };
    const s = new PeerGatherSounds({ audio: { play3d: (k, at) => shots.push({ sfx: sfxOf(k), at: [...at] }) }, profile: PEER_SOUND_PROFILE, on: () => true, rand: () => 0.5, install: false, now: () => clock.ms });
    script(s, (sec) => { clock.ms += sec * 1000; });
    return shots.filter((x) => ['plip', 'tug', 'hauling', 'thrash'].includes(x.sfx));
  };
  const P = (o) => ({ yaw: 0, ...o });
  const wait = (s, step, feet = FEET, n = 40) => { for (let i = 0; i < n; i++) { step(0.25); s.update('p', P({ ga: code('wait'), gm: 7 }), feet); } };
  const firstSeen = run((s, step) => { s.update('p', P({ ga: code('wait'), gm: 7 }), FEET); wait(s, step); step(0.25); s.update('p', P({ ga: code('tug'), gm: 7 }), FEET); });
  assert.ok(firstSeen.length >= 2, 'the water heard');
  assert.ok(firstSeen.every((x) => sameCenters([x.at], [NET])), `first seen while it waits: at the net - ${JSON.stringify(firstSeen.map((x) => x.at))}`);
  const unheard = run((s, step) => {
    s.update('p', P({}), FEET);
    step(0.5); s.update('p', P({ ga: code('fly'), gm: 7 }), FEET, false);
    step(0.6); s.update('p', P({ ga: code('wait'), gm: 7 }), FEET, false);   // landed out of earshot
    wait(s, step);
  });
  assert.ok(unheard.length >= 2 && unheard.every((x) => sameCenters([x.at], [NET])), 'its landing out of earshot: at the net');
  const moved = run((s, step) => {
    s.update('p', P({}), FEET);
    step(0.5); s.update('p', P({ ga: code('fly'), gm: 7 }), FEET);
    step(0.6); s.update('p', P({ ga: code('wait'), gm: 7 }), FEET);
    s.rebase(OFF);
    wait(s, step, shifted(FEET));
  });
  assert.ok(moved.length >= 2 && moved.every((x) => sameCenters([round(x.at)], [round(shifted(NET))])), 'the recentre: at the net, carried with the land');
});

test('AUDIT GATHER-FEEL W3: the Morrowind body asleep (past its range, or a frozen frame) follows the act\'s beats as it follows the swings - no tool\'s blow replayed on waking (C7\'s law) (mutant: the gather record left behind)', async () => {
  const log = [];
  const fakeRig = () => ({
    attach() {}, build: async () => ({ ok: true }), canThirdPerson: () => true, setViewMode: () => true, unload() {},
    update() {}, thirdActive: () => true, upperBodyReady: () => true, bodyHeight: () => 1.8, raceHeightScale: () => 1,
    setSheathed() {}, readySpell() {}, release() {}, setHipLight() {}, die() {}, revive() {}, hurt() {},
    setWeapon: (w) => { log.push(['weapon', w?.templateIndex ?? null]); return true; },
    attack: (strike) => { log.push(['attack', strike]); return true; },
    castSpell: () => { log.push(['cast']); },
  });
  const sword = { templateIndex: 120, group: 'Weapons', material: 0, equipSlot: EQUIP_SLOTS.RightHand };
  const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [sword] };
  const pb = new PeerBodies({ renderer: {}, createRig: fakeRig, buildOpts: peerBuildOpts, now: () => 0 });
  const toScene = (p) => [p.x, p.y, p.z];
  const peer = (o, at = 5) => ({ id: 'gat-0001', told: true, look: LOOK, glyphs: null, shown: { x: at, y: 0, z: 0, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, cn: 0, ...o } });
  pb.sync([peer({ ga: code('chop'), gb: beat(1, 'blow') })], toScene, 1 / 60, [0, 0, 0]);
  await pb._queue;
  pb.sync([peer({ ga: code('chop'), gb: beat(1, 'blow') })], toScene, 1 / 60, [0, 0, 0]);
  for (const [label, o] of [['far', { at: BODY_RANGE + 50, dt: 1 / 60 }], ['frozen', { at: 5, dt: 0 }]]) {
    pb.sync([peer({ ga: code('chop'), gb: beat(1, 'blow'), an: 3, cn: 1 })], toScene, 1 / 60, [0, 0, 0]);
    log.length = 0;
    for (let i = 2; i <= 6; i++) pb.sync([peer({ ga: code('chop'), gb: beat(i, 'blow'), an: 3 + i, cn: 1 + i }, o.at)], toScene, o.dt, [0, 0, 0]);
    assert.deepEqual(log, [], `${label}: nothing drawn asleep`);
    pb.sync([peer({ ga: code('chop'), gb: beat(6, 'blow'), an: 9, cn: 7 })], toScene, 1 / 60, [0, 0, 0]);
    assert.deepEqual(log, [], `${label}: waking replays no blow struck asleep`);
    pb.sync([peer({ ga: code('chop'), gb: beat(7, 'blow'), an: 9, cn: 7 })], toScene, 1 / 60, [0, 0, 0]);
    assert.deepEqual(log, [['attack', 'StrikeDownRight']], `${label}: a blow struck awake is drawn`);
  }
});

test('AUDIT GATHER-FEEL W4: a peer whose pose names no beat after one that did (a reload: the same id, its count not yet begun) is no frame\'s work - the idle early-out holds (mutant: the early-out comparing an absent beat)', () => {
  let reads = 0, ms = 1000;
  const s = new PeerGatherSounds({ audio: { play3d: () => {} }, profile: PEER_SOUND_PROFILE, on: () => true, rand: () => 0.5, install: false, now: () => { reads++; return ms; } });
  s.update('p', { yaw: 0, ga: code('chop') }, [0, 0, 0]);
  ms += 500; s.update('p', { yaw: 0, ga: code('chop'), gb: beat(1, 'blow') }, [0, 0, 0]);
  for (let i = 0; i < 4; i++) { ms += 500; s.update('p', { yaw: 0, gb: beat(1, 'blow') }, [0, 0, 0]); }   // the act over, its blow landed
  reads = 0;
  for (let i = 0; i < 60; i++) { ms += 16; s.update('p', { yaw: 0 }, [0, 0, 0]); }   // reloaded: no `gb` until its next beat
  assert.equal(reads, 0, 'sixty frames, none past the early-out');
  s.update('p', { yaw: 0, ga: code('chop'), gb: beat(1, 'blow') }, [0, 0, 0]);
  assert.ok(reads > 0, 'its next act is heard');
});

test('AUDIT GATHER-FEEL RECENTRE: the gatherer\'s own ear - the net\'s place and a blow in the air move with the land at the recentre (the host\'s door, world.js\'s recentre block) - its water and its blow heard where they are (mutants: the door unwired, the ear\'s places left in the old frame)', async () => {
  // the net: thrown, landed, then the recentre - the water at the net in the new frame
  const shots = [];
  const audio = { playOneShot: () => 0.2, play3d: (k, at) => { shots.push({ sfx: sfxOf(k), at: [...at] }); return 0.2; } };
  const e = createGatherEar({ audio, on: () => true, rand: dice(0), install: false });
  const f = createFishAct({ rng: dice(0) });
  const eye = [0, 1.6, 0], at = [0, 1, 3];
  for (let i = 0; i < 4000 && f.state.phase !== 'wait'; i++) { f.tick(0.05, { held: f.state.phase === 'wind' ? i < 20 : false }); e.frame(0.05, f, at, eye); }
  assert.equal(f.state.phase, 'wait');
  const land = shots.find((x) => x.sfx === 'netLand')?.at;
  assert.ok(land && land[2] > FISH_ACT.throwMinM, 'landed out on the water');
  e.rebase(OFF);
  const n = shots.length;
  for (let i = 0; i < 200 && f.state.phase === 'wait'; i++) { f.tick(0.05); e.frame(0.05, f, shifted(at), shifted(eye)); }
  const water = shots.slice(n).filter((x) => x.sfx === 'plip' || x.sfx === 'tug');
  assert.ok(water.length >= 1, 'the water heard');
  assert.ok(water.every((x) => sameCenters([round(x.at)], [round(shifted(land))])), 'at the net, in the new frame');
  // a blow in the air across the recentre: lands at its vein in the new frame (the host's door)
  try {
    const t = await rig();
    const v = t.host.nodesOf(PX, 150).find((x) => x.what === 'vein' && x.tier === 1);
    await arrive(t, v);
    t.face(v);
    t.host.tick(0.016);
    assert.equal(t.host.press(), true);
    t.host.tick(MINE_ACT.swingS + 0.01);
    press(t);
    const m = t.audio.shots.length;
    t.host.rebase(OFF);
    t.host.tick(lands + 0.01);
    const clack = t.audio.shots.slice(m).find((s) => /gather:pick/.test(s.key));
    assert.ok(clack, 'it lands');
    const was = [v.local[0], v.local[1] + (v.lift ?? 0.3), v.local[2]];
    assert.deepEqual(round(clack.at), round(shifted(was)), 'at its vein, carried with the land');
    t.host.dispose();
  } finally { setForagingHost(null); }
  assert.match(src('src/scenes/world.js'), /remotePlayers\?\.rebaseSounds\?\.\(r\.offset\);[^\n]*\n\s*gatherHost\?\.rebase\(r\.offset\);/, 'the recentre block carries the gathering\'s ear, beside the peers\' sounds');
  assert.match(src('src/net/remotePlayers.js'), /rebaseSounds\(offset\) \{\n\s*if \(!offset\) return;\n\s*this\._gatherSounds\.rebase\(offset\);/, 'and the peers\' gathering, by the offset');
});

// ═══ THE FEEL ════════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT GATHER-FEEL R2: BLOW-SHAKE through its own doors as they ship - the skin read (classic: none), the system\'s reduced motion read (none), the player\'s technique motion read (Off none, half half) - the springs\' own numbers, no door handed in (mutants: each default door a constant)', () => {
  const realMatch = globalThis.matchMedia;
  const skin = getPref('skin'), motion = getPref('techniqueMotion');
  let at = Date.now() + 10_000;
  const reduce = (on) => { globalThis.matchMedia = (q) => ({ matches: on && /reduce/.test(q), addEventListener() {} }); prefersReducedMotion((at += 5_000)); };
  const peak = () => {
    resetTechniqueFx();
    gatherBlowFeel('mine', true);
    let p = 0;
    for (let i = 0; i < 400; i++) { stepTechniqueFx(0.001); p = Math.max(p, techniqueHands().y, -techniqueView().pitch); }
    return p;
  };
  try {
    setUiSkin('enhanced'); setPref('techniqueMotion', 1); reduce(false);
    const full = peak();
    assert.ok(full > 0, 'the enhanced skin, full motion: the view dips');
    setPref('techniqueMotion', 0.5);
    assert.ok(Math.abs(peak() - full / 2) < full * 0.02, 'half motion: half');
    setPref('techniqueMotion', 0);
    assert.equal(peak(), 0, 'Off: none');
    setPref('techniqueMotion', 1);
    reduce(true);
    assert.equal(peak(), 0, 'reduced motion: none');
    reduce(false);
    setUiSkin('classic');
    assert.equal(peak(), 0, 'the classic skin: none');
  } finally {
    globalThis.matchMedia = realMatch;
    prefersReducedMotion((at += 5_000));
    setUiSkin(skin ?? 'enhanced');
    setPref('techniqueMotion', motion ?? 1);
    resetTechniqueFx();
  }
});

test('AUDIT GATHER-FEEL R16: the springs are the view\'s, never the look the glint is aimed with - a blow folded into the view leaves the camera\'s yaw and pitch, which the gathering host\'s aim reads, as they were (mutant: a kick written into the camera)', () => {
  const ON = { enhanced: () => true, reduced: () => false, motion: () => 1 };
  const cam = { yaw: 0.3, pitch: -0.1, pos: [0, 1.7, 0] };
  const feel = createClimbFeelHost(() => null, cam, null);
  resetTechniqueFx();
  assert.equal(gatherBlowFeel('mine', true, ON), true);
  const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  for (let i = 0; i < 40; i++) feel.frame(0.002);
  feel.view(view, true);
  assert.ok(Math.abs(view[6]) > 1e-4 || Math.abs(view[9]) > 1e-4, 'the view dipped');
  assert.deepEqual([cam.yaw, cam.pitch], [0.3, -0.1], 'the camera\'s look untouched');
  assert.match(src('src/scenes/world.js'), /view: \(\) => \(\{ yaw: \(cam\.yaw \* 180\) \/ Math\.PI, pitch: \(cam\.pitch \* 180\) \/ Math\.PI \}\),/, 'the gathering host aims with the camera\'s own look');
  resetTechniqueFx();
});

// ═══ THE NUMBERS ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT GATHER-FEEL R5/R7/F4: the tables the record states, by their numbers - the crack\'s shade and order, the chunks\', the ear\'s (the slipping catch LOUDER, a plip every 2.2-5.5 s, a pitch moved up to 5%); a peer\'s floor one pose at the pose\'s top rate; the dungeon\'s veins keep their typed doc (mutants: each number moved)', () => {
  assert.deepEqual([VEIN_CRACK_CELL, VEIN_CRACK_SHADE, { ...VEIN_CRACK_ORDER }], [7, 0.3, { own: 0.35, heart: 0.75 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(VEIN_CHUNKS)), {
    plain: 3, clean: 5, last: 7, scale: 0.32, face: 0.35, spread: 0.12, out: [1.1, 2.4], up: [1.4, 3], side: 1.1,
    gravity: 9.81, restS: 1.2, sinkS: 0.35, flyMaxS: 1.5,
  });
  assert.equal(GATHER_SOUND.THRASH_SLIP_GAIN, 1.35);
  assert.ok(GATHER_SOUND.THRASH_SLIP_GAIN > 1, 'slipping: louder');
  assert.deepEqual([GATHER_SOUND.PLIP_MIN_S, GATHER_SOUND.PLIP_MAX_S, GATHER_SOUND.PITCH_JITTER], [2.2, 5.5, 0.05]);
  assert.equal(PEER_GATHER_CUE_MS, 1000 / POSE_HZ, 'one pose at the top rate - no floor of the climb\'s');
  assert.match(src('src/scenes/mineHost.js'), /\* @param \{\{ dungeon: number, day: number, climate: number, confirmed\?: boolean,\n \*   wall: \(marker: number, bearing: number\) => \(number\[\]\|null\) \}\} p\n \*\/\nexport function standDungeonVeins\(/, 'its doc on it, its parameters typed');
});

// ═══ THE VEIN, ITS CHUNKS AND ITS CRACKS (lane V) ════════════════════════════════════════════════════════════════════

const flatsDrawn = (t) => t.entry.batches.filter((b) => !b.dynamic && !b.destroyed).reduce((n, b) => n + b.centers.length, 0);

test('AUDIT GATHER-FEEL V1: a pixel stood again keeps its flats standing until the new ones stand - the press that begins a mining act (its vein stood apart) draws every flat of its pixel that frame, as does the vein\'s going under its last blow (mutant: the old flats torn down before the textures came)', async () => {
  try {
    const r = keepingRenderer();
    const t = await rig({ renderer: r });
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    await arrive(t, v);
    t.face(v);
    t.host.tick(0.016);
    const before = flatsDrawn(t);
    assert.ok(before > 0);
    assert.equal(t.host.press(), true);
    assert.equal(flatsDrawn(t), before, 'the press\'s frame draws every flat of the pixel');
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(flatsDrawn(t), before, 'stood again, as many');
    assert.ok(ownBatch(t.entry.batches, v), '...the vein apart');
    t.host.tick(MINE_ACT.swingS + 0.01);
    for (let i = 0; i < 20 && t.host.acting(); i++) { press(t); t.host.tick(MINE_ACT.swingS + 0.01); }
    const standing = flatsDrawn(t);
    for (let i = 0; i < 20; i++) t.host.tick(0.02);   // the last blow lands: the vein goes, its pixel stood again
    assert.equal(flatsDrawn(t), standing, 'the landing\'s frame still draws them (the vein\'s own went with the new stand)');
    for (let i = 0; i < 4; i++) await tick();
    assert.equal(flatsDrawn(t), standing - mineFlats(v).length, 'then the vein is gone');
    t.host.dispose();
    // the newest stand of a pixel alone swaps its flats in: one asked before an act began, its pictures slow, never
    // stands over the one the act's start asked (its vein apart)
    let slow = false, release = null;
    const r2 = keepingRenderer();
    const t2 = await rig({ renderer: r2, extra: { getTexture: () => (slow ? new Promise((res) => { release = () => res({ recordCount: 999 }); }) : Promise.resolve({ recordCount: 999 })) } });
    const w = t2.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    await arrive(t2, w);
    t2.face(w);
    t2.host.tick(0.016);
    slow = true;
    t2.host.restandAt(PX, 150);   // a stand before the act, its pictures on their way
    slow = false;
    assert.equal(t2.host.press(), true);   // the act's own stand: its vein apart
    for (let i = 0; i < 4; i++) await tick();
    const newer = ownBatch(t2.entry.batches, w);
    assert.ok(newer, 'the act\'s stand: the vein apart');
    release();
    for (let i = 0; i < 6; i++) await tick();
    assert.equal(ownBatch(t2.entry.batches, w), newer, 'the older stand, answered late, stood nothing over it');
    assert.equal(newer.destroyed, false, '...nor took the newer one down');
    t2.host.dispose();
  } finally { setForagingHost(null); }
});

test('AUDIT GATHER-FEEL V2: chunks in the air when the professions shut (a vein\'s own answer can shut them) fly, fall, lie and go all the same - never hung in the air, drawn, until the page goes (mutant: the chunks stepped after the shut\'s return)', async () => {
  try {
    const { t, r } = await feltRig();
    const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
    await arrive(t, v);
    strikeOut(t, v);
    t.host.tick(lands + 0.01);
    for (let i = 0; i < 4; i++) await tick();
    const flying = r.made.filter((b) => b.dynamic && !b.destroyed);
    assert.ok(flying.length >= 2, 'bursts in the air');
    t.book.state.open = false;
    for (let i = 0; i < 200; i++) t.host.tick(0.05);
    assert.ok(flying.every((b) => b.destroyed), 'every one lain, sunk and freed');
    assert.ok(flying.every((b) => !t.entry.batches.includes(b)), '...and off the pixel\'s list');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('AUDIT GATHER-FEEL V3: chunks come down on the ground where their arc meets it - on a hillside, struck from downhill and from uphill, each lies on the hill (never over the downhill nor in the uphill) at any frame rate; a dungeon\'s on its one floor; the box holds every chunk\'s picture (mutants: the ground unread, the landing the flat floor\'s, the picture\'s half-width out of the box)', () => {
  const WOODS_ = WOODS, day = utcDayOfMs(NOON * 1000), H = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, cell = TERRAIN_SIZE / 128;
  for (const grade of [0.2, 0.6]) {
    const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION);
    for (let x = 0; x < HEIGHTMAP_DIMENSION; x++) for (let y = 0; y < HEIGHTMAP_DIMENSION; y++) samples[x * HEIGHTMAP_DIMENSION + y] = (100 + grade * x * cell) / H;
    const law = veins({ x: PX, y: 150, day, climate: WOODS_, region: GLENUMBRA });
    const rocks = law.map((q) => [q.u * TERRAIN_SIZE - 2, 0, q.v * TERRAIN_SIZE + 4, q.u * TERRAIN_SIZE + 2, 6, q.v * TERRAIN_SIZE + 8]);
    const nodes = standMineNodes({ px: PX, py: 150, day, climate: WOODS_, region: GLENUMBRA, samples, tilemap: new Uint8Array(128 * 128).fill(2), rocks });
    const v = nodes.find((n) => n.what === 'vein');
    assert.ok(v, 'a vein on the hillside');
    const look = mineKind({ book: { state: {} } }).chunkOf(v, { samples });
    assert.equal(typeof look.ground, 'function', 'a street vein\'s ground, its pixel\'s heightmap');
    const at = [v.local[0], v.local[1] + v.lift, v.local[2]];
    const h = 0.1, w = 0.6;
    for (const side of [-1, 1]) {   // the striker downhill (-x), then uphill (+x)
      const eye = [v.local[0] + side * 1.5, groundAt(samples, v.local[0] + side * 1.5, v.local[2]) + 1.6, v.local[2]];
      for (const dt of [1 / 30, 1 / 144]) {
        const cs = shedChunks(at, eye, 7, dice(0.1, 0.9, 0.5, 0.3, 0.7, 0.2, 0.8), look.floor, look.ground);
        for (const c of cs) {
          const p0 = [...c.p], v0 = [...c.v];
          const arc = p0[1] + v0[1] * c.land - 0.5 * VEIN_CHUNKS.gravity * c.land * c.land;
          assert.ok(Math.abs(arc - c.floor) < 1e-6, `grade ${grade}: its arc meets the ground where it comes down (${(arc - c.floor).toFixed(4)} m)`);
          for (let i = 0; i < 400 && c.rest < 0; i++) {
            stepChunk(c, dt);
            if (c.rest < 0) assert.ok(c.p[1] >= groundAt(samples, c.p[0], c.p[2]) - 1e-6, `grade ${grade}: never inside the hill on its way`);
          }
          const g = groundAt(samples, c.p[0], c.p[2]);
          assert.ok(Math.abs(c.p[1] - g) < 1e-6, `grade ${grade}, struck from ${side < 0 ? 'downhill' : 'uphill'} at dt ${dt}: lying ${(c.p[1] - g).toFixed(3)} m off the ground`);
        }
      }
      // the box: the fastest chunk there is, thrown straight along an axis, a wide picture - inside it at every step
      const fast = shedChunks(at, [at[0] + side * 3, at[1], at[2]], 1, dice(0.999999), look.floor, look.ground)[0];
      const box = chunkBox(at, Math.min(look.floor, fast.floor), h, 2);
      for (let i = 0; i < 400 && stepChunk(fast, 1 / 120); i++) assert.ok(fast.p[0] - 1 >= box[0] - 1e-9 && fast.p[0] + 1 <= box[3] + 1e-9, `grade ${grade}: a wide chunk\'s picture inside its box`);
    }
  }
  // a dungeon's vein: the one floor under its wall, no ground of the pixel's
  const dv = { what: 'dvein', local: [5, 2, 5], lift: 0.3, tier: 3, material: 'metal:iron', key: 'dvein:1:1:1' };
  const dl = mineKind({ book: { state: {} } }).chunkOf(dv, { samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION) });
  assert.equal(dl.ground, null);
  const [c] = shedChunks([5, 2.3, 5], [5, 2, 9], 1, dice(0.5), dl.floor, dl.ground);
  for (let i = 0; i < 400 && c.rest < 0; i++) stepChunk(c, 1 / 60);
  assert.equal(c.p[1], 2, 'on the dungeon\'s floor, at the vein\'s foot');
});

test('AUDIT GATHER-FEEL V4: a seam on the Enhanced Lighting lane is as dark as on the classic one - its shade taken on the texel\'s display colour, then decoded into the lane\'s light with it (mutant: the shade multiplying the linear albedo)', () => {
  assert.match(EL_BB_FS, /vec3 albedo = max\(elDecode\(tex\.rgb \* veinCrackShade\(uv\)\) - emission, vec3\(0\.0\)\);/, 'the lane shades the display colour, then decodes it');
  for (const d of [0.05, 0.15, 0.3, 0.45, 0.6, 0.8, 1]) {
    const shown = elEncode(elDecode(d * VEIN_CRACK_SHADE)) / d;   // the lane's seam, back on the screen (no light: the albedo as shown)
    assert.ok(Math.abs(shown - VEIN_CRACK_SHADE) < 1e-6, `a texel of ${d}: the seam shows ${shown.toFixed(4)} of it - the classic lane's ${VEIN_CRACK_SHADE}`);
    const linear = elEncode(elDecode(d) * VEIN_CRACK_SHADE) / d;   // the shade on the linear albedo, as it stood
    if (d >= 0.15) assert.ok(linear > VEIN_CRACK_SHADE + 0.1, `...where on the linear albedo it showed ${linear.toFixed(3)}`);   // (the codec's linear toe aside)
  }
});

/** A recording fake GL: every call kept, uniform locations their names. */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE1: 33985, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}

test('AUDIT GATHER-FEEL V6: the low-poly trees drawn after a cracked vein take none of its seams - the crack sent back to whole before the trees, on both lanes (mutant: the trees\' reset dropped)', () => {
  const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 1.6, 0.1, 4000)), VIEW = lookAt([0, 1.7, 9], [0, 1.2, -4], [0, 1, 0]);
  for (const lane of [null, EL_LANE]) {
    const { calls, canvas } = recordingGl();
    const r = new Renderer(canvas);
    if (lane) r.setLightingLane(lane);
    r.textures.set('182_0', { id: 'ore' });
    const vein = r.createBillboardBatch(182, 0, { w: 1, h: 1 }, [[0, 0, -4]]);
    setBatchCrack(vein, 0.5, 0.3);
    const gpu = { vao: { id: 'treeVao' }, pointInstances: () => {} };
    r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    r.setLowPolyTrees({ eye: [0, 1.7, 9], radius: 140, band: 20, gpu, cut: new Set(), runs: [{ run: null, scale: [1, 1, 1], size: [3, 9], sway: 0, drawStart: 0, drawCount: 2, subs: [{ offset: 0, count: 6, tex: { id: 'leaf' }, alpha: 1, color: [1, 1, 1], cull: 0 }] }] });
    calls.length = 0;
    r.drawBillboards([vein], new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
    const trees = calls.findIndex((c) => c[0] === 'drawElementsInstanced');
    assert.ok(trees > 0, `${lane ? 'EL' : 'classic'}: the trees drawn`);
    const sent = calls.slice(0, trees).filter((c) => c[0] === 'uniform2f' && c[1] === 'uCrack');
    assert.ok(sent.some((c) => c[2] > 0), 'the vein\'s crack sent');
    assert.deepEqual(sent.at(-1).slice(2), [0, 0], `${lane ? 'EL' : 'classic'}: whole again before the trees`);
  }
});

test('AUDIT GATHER-FEEL V6/V7: the host lets every crack go with its node, its act, its batch, its dungeon and itself - a vein stood again mid-act keeps its crack; a burst whose dungeon was left, or whose pixel was torn down, while its batch was being made is never stood; a blow landing after its pixel went sheds nothing and throws nothing; the fall, a let-go last swing, a node another took and dispose hold no crack (mutants: holdCrack unapplied, the mint guards, the nowhere guard, each bookkeeping line)', async () => {
  const errs = [];
  const onErr = (e) => errs.push(e);
  process.on('unhandledRejection', onErr);
  try {
    // a vein stood again mid-act keeps its crack; the batches held are the live ones
    {
      const r = keepingRenderer();
      const t = await rig({ renderer: r });
      const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
      await arrive(t, v);
      t.face(v);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true);
      for (let i = 0; i < 4; i++) await tick();
      t.view.yaw += 10;
      press(t);
      t.host.tick(lands + 0.01);
      const crack = ownBatch(t.entry.batches, v)?.crack;
      assert.ok(crack?.[0] > 0, 'cracked');
      t.host.restandAt(PX, 150);
      for (let i = 0; i < 4; i++) await tick();
      assert.deepEqual(ownBatch(t.entry.batches, v)?.crack, crack, 'stood again, the same crack');
      assert.ok(t.host.cracking().held.length > 0 && t.host.cracking().held.every((b) => !b.destroyed), 'only live batches held');
      // its last blows: the fall lets its crack go
      t.host.tick(MINE_ACT.swingS);
      for (let i = 0; i < 20 && t.host.acting(); i++) { press(t); t.host.tick(MINE_ACT.swingS + 0.01); }
      for (let i = 0; i < 20; i++) t.host.tick(0.02);
      for (let i = 0; i < 4; i++) await tick();
      assert.deepEqual(t.host.cracking(), { cracked: [], worked: null, held: [] }, 'fallen: nothing held');
      // a blow in the air when its pixel is torn down: nowhere to fall, nothing thrown
      const w = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1 && n.key !== v.key);
      await arrive(t, w);
      t.face(w);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true);
      for (let i = 0; i < 4; i++) await tick();
      t.host.tick(MINE_ACT.swingS + 0.01);
      press(t);
      const made = r.made.length;
      t.host.onDestroyed(t.entry);
      assert.deepEqual(t.host.cracking().held, [], 'its pixel torn down: none of its batches held');
      t.host.tick(lands + 0.01);
      for (let i = 0; i < 6; i++) await tick();
      assert.equal(r.made.filter((b, i) => i >= made && b.dynamic).length, 0, 'no burst for a torn-down pixel');
      t.host.dispose();
      assert.deepEqual(t.host.cracking(), { cracked: [], worked: null, held: [] }, 'disposed: nothing held');
    }
    // a burst whose picture comes after its pixel was torn down: never stood
    {
      let slow = false, release = null;
      const r = keepingRenderer();
      const t = await rig({ renderer: r, extra: { getTexture: () => (slow ? new Promise((res) => { release = () => res({ recordCount: 999 }); }) : Promise.resolve({ recordCount: 999 })) } });
      const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
      await arrive(t, v);
      t.face(v);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true);
      for (let i = 0; i < 4; i++) await tick();
      t.host.tick(MINE_ACT.swingS + 0.01);
      press(t);
      slow = true;
      t.host.tick(lands + 0.01);   // the blow lands: its burst asks for its picture
      assert.ok(release, 'its picture on its way');
      const made = r.made.length;
      t.host.onDestroyed(t.entry);
      release();
      for (let i = 0; i < 6; i++) await tick();
      assert.equal(r.made.slice(made).filter((b) => b.dynamic).length, 0, 'the pixel gone: no batch made for it');
      t.host.dispose();
    }
    // a dungeon: a burst minted as the dungeon is left is dropped through its door, never kept; the last swing let go
    {
      const r = keepingRenderer();
      let release = null;
      const t = await rig({ renderer: r, ranks: { mining: 25 }, extra: { rand: dice(0.1, 0.9, 0.5, 0.3, 0.7), activeDungeon: () => under } });
      let under = false;
      const stood = [];
      const wall = (m, b) => [6 + m * 9, 0, 4 + b];
      t.host.enterDungeon({
        id: 1234, climate: WOODS, region: GLENUMBRA, wall,
        stand: async (a, rec, sc, c, o) => {
          if (o?.dynamic) await new Promise((res) => { release = res; });   // a burst's batch, made slowly
          const b = r.createBillboardBatch(a, rec, { w: 0.3 * sc, h: 0.3 * sc }, c, o); stood.push(b); return b;
        },
        drop: (b) => { b.destroyed = true; },
      });
      under = true;
      for (let i = 0; i < 8; i++) await tick();
      const v = standDungeonVeins({ dungeon: 1234, day: utcDayOfMs(NOON * 1000), climate: WOODS, confirmed: false, wall })[0];
      await arrive(t, v);
      t.face(v);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true);
      t.view.yaw += 10;
      for (let i = 0; i < 20 && t.host.acting(); i++) { t.host.tick(MINE_ACT.swingS + 0.01); press(t); }
      assert.equal(t.host.acting(), false, 'worked out, its last blow in the air');
      for (let i = 0; i < 4; i++) await tick();
      const pending = release;
      assert.ok(pending, 'a burst\'s batch on its way');
      t.host.leaveDungeon();
      under = false;
      pending();
      for (let i = 0; i < 6; i++) await tick();
      const late = stood.filter((b) => b.dynamic);
      assert.ok(late.length >= 1 && late.every((b) => b.destroyed), 'made after the dungeon was left: dropped through its door at once');
      assert.deepEqual(t.host.cracking(), { cracked: [], worked: null, held: [] }, 'the last swing let go: its crack with it');
      t.host.dispose();
    }
    // a dungeon's vein worked out, its last blow landed: the dungeon stood again holds no freed batch, no crack
    {
      const r = keepingRenderer();
      const t = await rig({ renderer: r, ranks: { mining: 25 }, extra: { rand: dice(0.1, 0.9, 0.5, 0.3, 0.7), activeDungeon: () => true } });
      const d = await underground(t, r);
      for (let i = 0; i < 8; i++) await tick();
      const v = d.vein();
      await arrive(t, v);
      t.face(v);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true);
      t.view.yaw += 10;
      for (let i = 0; i < 20 && t.host.acting(); i++) { t.host.tick(MINE_ACT.swingS + 0.01); press(t); }
      for (let i = 0; i < 20; i++) t.host.tick(0.02);
      for (let i = 0; i < 8; i++) await tick();
      assert.ok(d.stood.some((b) => !b.dynamic && b.destroyed), 'the dungeon stood again as the vein went');
      assert.ok(t.host.cracking().held.every((b) => !b.destroyed), 'no freed batch held');
      assert.deepEqual(t.host.cracking().cracked, []);
      t.host.dispose();
    }
    // a dungeon burst whose chunks lay and sank away before its batch came: dropped through the door at once
    {
      const r = keepingRenderer();
      let release = null;
      const t = await rig({ renderer: r, ranks: { mining: 25 }, extra: { rand: dice(0.1, 0.9, 0.5, 0.3, 0.7), activeDungeon: () => true } });
      const stood = [];
      const wall = (m, b) => [6 + m * 9, 0, 4 + b];
      t.host.enterDungeon({
        id: 1234, climate: WOODS, region: GLENUMBRA, wall,
        stand: async (a, rec, sc, c, o) => {
          if (o?.dynamic) await new Promise((res) => { release = res; });
          const b = r.createBillboardBatch(a, rec, { w: 0.3 * sc, h: 0.3 * sc }, c, o); stood.push(b); return b;
        },
        drop: (b) => { b.destroyed = true; },
      });
      for (let i = 0; i < 8; i++) await tick();
      const v = standDungeonVeins({ dungeon: 1234, day: utcDayOfMs(NOON * 1000), climate: WOODS, confirmed: false, wall })[0];
      await arrive(t, v);
      t.face(v);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true);
      t.view.yaw += 10;
      t.host.tick(MINE_ACT.swingS + 0.01);
      press(t);
      t.host.tick(lands + 0.01);
      const late = release;
      assert.ok(late, 'its batch on its way');
      for (let i = 0; i < 80; i++) t.host.tick(0.05);   // four seconds: its chunks lain and gone
      late();
      for (let i = 0; i < 6; i++) await tick();
      const b = stood.find((x) => x.dynamic);
      assert.ok(b && b.destroyed, 'came after its chunks were gone: dropped at once');
      t.host.dispose();
    }
    // a node another took, answered under the last blow: its crack let go
    {
      const t = await rig({ renderer: keepingRenderer() });
      const v = t.host.nodesOf(PX, 150).find((n) => n.what === 'vein' && n.tier === 1);
      await arrive(t, v);
      strikeOut(t, v);
      t.gate.answers.shift()({ ok: false, error: 'node-taken' });
      for (let i = 0; i < 6; i++) await tick();
      for (let i = 0; i < 20; i++) t.host.tick(0.02);
      assert.deepEqual(t.host.cracking().cracked, [], 'taken: no crack held');
      assert.equal(t.host.cracking().worked, null);
      t.host.dispose();
    }
    assert.deepEqual(errs, [], 'nothing thrown');
  } finally { process.off('unhandledRejection', onErr); setForagingHost(null); }
});

test('AUDIT GATHER-FEEL F7: a felled tree whose harvest is refused - or whose kept harvest lapsed - is heard falling no more: its sound taken back with its picture, faded out; an accepted one falls on to its ground (mutants: the voice unkept, the hush unasked at a refusal, at a lapse)', async () => {
  try {
    const t = await rig({ ranks: { logging: 50 } });
    const voices = [];
    t.audio.play3dVoice = (key, at, volume, o) => {
      const v = { key, stopped: 0 };
      voices.push(v);
      t.audio.shots.push({ key, at: [...at], volume, ref: o?.refDistance ?? null, pitch: o?.pitch });
      return { stop: () => { v.stopped++; } };
    };
    const trees = t.host.nodesOf(PX, 150).filter((n) => n.kind === 'tree');
    assert.ok(trees.length >= 3, 'three trees');
    const fell = async (tree) => {
      await arrive(t, tree);
      t.face(tree);
      t.host.tick(0.016);
      assert.equal(t.host.press(), true, 'at a tree');
      for (let i = 0; i < 20 && t.host.acting(); i++) { t.host.tick(MINE_ACT.swingS + 0.01); press(t); }
      assert.equal(t.host.acting(), false, 'felled');
      for (let i = 0; i < 20; i++) t.host.tick(0.02);   // its last chop lands: it falls, heard
      const v = voices.filter((x) => sfxOf(x.key) === 'fall').at(-1);
      assert.ok(v, 'its fall heard, kept');
      return v;
    };
    // refused after it began to fall: the sound taken back with the picture
    const a = await fell(trees[0]);
    t.gate.answers.shift()({ ok: false, error: 'prof-rank' });
    for (let i = 0; i < 6; i++) await tick();
    t.host.tick(0.016);
    assert.equal(a.stopped, 1, 'refused: its fall heard no more');
    // accepted: it falls on to its ground
    const b = await fell(trees[1]);
    t.gate.answers.shift()();
    for (let i = 0; i < 6; i++) await tick();
    t.host.tick(0.016);
    assert.equal(b.stopped, 0, 'accepted: its fall runs out');
    // a kept harvest let go unanswered (lapsed): taken back too
    const c = await fell(trees[2]);
    let once = true;
    const pump = t.book.pump;
    t.book.pump = (fn) => { if (once) { once = false; fn({ node: trees[2].key }, { ok: false, error: 'lapsed' }, 0); } else pump.call(t.book, fn); };
    t.host.tick(0.016);
    assert.equal(c.stopped, 1, 'lapsed: its fall heard no more');
    t.host.dispose();
  } finally { setForagingHost(null); }
});

test('AUDIT GATHER-FEEL F7: the bus\'s voice - play3d\'s own positional shot, its handle\'s stop fading it to nothing over VOICE_FADE_S and stopping it, its chain let go and `onEnd` told as it ends, nothing played (and no handle) before the bus is up (mutants: the stop at its level, the stop unramped, the chain kept, the end untold)', () => {
  const made = { sources: [], gains: [], panners: [] };
  let now = 0;
  const param = (v = 0) => ({ value: v, events: [], setValueAtTime(x, t) { this.events.push(['set', x, t]); this.value = x; }, linearRampToValueAtTime(x, t) { this.events.push(['ramp', x, t]); }, cancelScheduledValues(t) { this.events.push(['cancel', t]); } });
  const node = (o = {}) => ({ connect(n) { this.to = n; return n; }, disconnect() { this.gone = true; }, ...o });
  const ctx = {
    state: 'running', destination: node(), listener: { setPosition() {}, setOrientation() {} }, get currentTime() { return now; },
    createBufferSource() { const src = node({ context: ctx, playbackRate: param(1), started: null, stopAt: null, start(w) { this.started = w ?? now; }, stop(w) { this.stopAt = w ?? now; } }); made.sources.push(src); return src; },
    createGain() { const g = node({ gain: param(1), context: ctx }); made.gains.push(g); return g; },
    createPanner() { const p = node({ positionX: param(), positionY: param(), positionZ: param() }); made.panners.push(p); return p; },
    createBuffer(ch, len, rate) { const d = new Float32Array(len); return { numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: () => d }; },
  };
  const e = new AudioEngine();
  assert.equal(e.play3dVoice('fall', [0, 0, 0], 1), null, 'no bus up: nothing, and no handle');
  e.ctx = ctx; e.enabled = true;
  e.registerSamples('fall', new Float32Array(22050 * 2), 22050);
  e.setListener([0, 0, 0], [0, 0, -1]);
  let ended = 0;
  const h = e.play3dVoice('fall', [3, 0, 4], 0.65, { refDistance: 2, pitch: 1.02, onEnd: () => { ended++; } });
  assert.ok(h && typeof h.stop === 'function', 'a handle');
  const [src] = made.sources, gain = src.to, pan = gain.to;   // its own chain: the source, its gain, its panner
  assert.equal(src.started, 0, 'sounding');
  assert.equal(gain.gain.value, 0.65);
  assert.equal(src.playbackRate.value, 1.02);
  now = 0.5;
  h.stop();
  const ramp = gain.gain.events.find((v) => v[0] === 'ramp');
  assert.deepEqual(ramp, ['ramp', 0, 0.5 + VOICE_FADE_S], 'faded to nothing over the fade, never cut at its level');
  assert.ok(gain.gain.events.findIndex((v) => v[0] === 'set') < gain.gain.events.indexOf(ramp), 'from where it stood');
  assert.ok(src.stopAt >= 0.5 + VOICE_FADE_S, 'then stopped');
  src.onended();
  assert.ok(src.gone && gain.gone && pan.gone, 'its chain let go');
  assert.equal(ended, 1, 'its end told');
  src.onended();
  assert.equal(ended, 1, 'once');
  h.stop();
  assert.equal(gain.gain.events.filter((v) => v[0] === 'ramp').length, 1, 'a stop after its end is nothing');
  assert.ok(VOICE_FADE_S > 0 && VOICE_FADE_S <= 0.1);
});
