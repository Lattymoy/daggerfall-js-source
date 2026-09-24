// PR-WW1 (2026-09-24, player report: "Werewolf morrowind sprite not showing online"): THE BEAST THE OTHERS SEE IS THE
// BEAST I SEE. A transformed player with no Morrowind body sees themselves as Eye Of The Beholder's lycanthrope
// (archives 112380 the werewolf, 112381 the wereboar - the Bloodmoon-style render, eotbBody's lycan tables), and every
// other player drew DISC12's classic enemy sprite (archive 264 / 269, remotePlayers' mobile): net/peerRiders.js, the one
// layer that draws another player in EOTB's art, took a peer only when `rd` said a mount. A transformed RIDER was drawn
// as a person on a horse (112382) where the player saw their beast (chooseTable: transformed first). And the modal
// passes (worldModes' dungeon and interior billboard runs) draw only `host.extraBillboards`, which was remotePlayers'
// batches alone. Beside it, the local body asked for its sprites with the mod's SETTINGS, which never carry the form -
// so a wereboar saw the werewolf on themselves. BY EXECUTION: the real validPose and lerpPose, the real createPeerRiders,
// RemotePlayers and createEotbBody, driven in world.js's order with a fake renderer and decode.
// 01-Overview/Field-Bugs-2026-09-24.md PR-WW1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validPose } from '../src/net/wire.js';
import { lerpPose } from '../src/net/online.js';
import * as PR from '../src/net/peerRiders.js';   // the namespace, so a pin run on the unfixed layer fails assertion by assertion, not at the import
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { ARCHIVE_LYCAN, ARCHIVE_HORSE, STATE_TABLES, LYCAN_TICK, frameTime, chooseTable } from '../src/player/eotbBillboard.js';
import { SIZE_RIDING_OR_TRANSFORMED } from '../src/player/eotbSprite.js';
import { createEotbBody } from '../src/player/eotbBody.js';

const { createPeerRiders } = PR;
const CLAW_TABLE = 'AttackMeleeLycan';   // eotbBody playLycanAttack's clip
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = { x: 10, y: 0, z: 5, yaw: 0, pitch: 0, mv: 0 };
/** a pose through the relay's door and the session's easing - what `peer.shown` is on a receiver */
const shownOf = (extra) => { const s = validPose({ ...P, ...extra }); return lerpPose(s, s, 1); };
const toScene = (p) => [p.x, p.y, p.z];
const W = 40, H = 70;   // the fake decode's picture, in pixels
const settle = () => new Promise((r) => setTimeout(r, 5));

function fakeRenderer() {
  const made = [], gone = [], uploads = [];
  return {
    made, gone, uploads,
    uploadTexture: (a, rec) => uploads.push(`${a}:${rec}`),
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, origin: null }; made.push(b); return b; },
    destroyBillboardBatch: (b) => gone.push(b),
  };
}
function riderLayer({ urlFor = (k) => `u:${k}` } = {}) {
  const renderer = fakeRenderer();
  const riders = createPeerRiders({ renderer, urlFor, decode: async () => ({ width: W, height: H, colors: new Uint32Array(W * H) }) });
  return { riders, renderer };
}
/** sync, let the decode land, sync again - the frame after the art is up */
async function drawn(riders, peers, dt = 0) {
  riders.sync(peers, toScene, { eye: [10, 1, 20], dt });
  await settle();
  riders.sync(peers, toScene, { eye: [10, 1, 20], dt });
}
const recordOf = (b) => Number(String(b.record).split('-')[0]);

test('PR-WW1 layer: a peer in beast form is EOTB\'s lycanthrope - 112380 the werewolf, 112381 the wereboar - at the transformed size, the table EOTB\'s own chooseTable picks (idle, claws up, moving) (mutants: the beast not taken; the form not handed to spriteFor; the rider\'s table for a beast)', async () => {
  const { riders } = riderLayer();
  const wolf = { id: 'wolf', shown: shownOf({ wb: 1 }) };
  assert.equal(wolf.shown.wb, 1, 'the form survives the door and the easing');
  riders.sync([wolf], toScene, { eye: [10, 1, 20], dt: 0 });
  assert.equal(riders.isRiding('wolf'), false, 'art not up yet: the enemy sprite still stands for them, never nothing');
  assert.equal(riders.heightOf('wolf'), 0);
  await settle();
  riders.sync([wolf], toScene, { eye: [10, 1, 20], dt: 0 });
  assert.equal(riders.isRiding('wolf'), true, 'the beast is DRAWN by the EOTB layer');
  const b = riders.batches()[0];
  assert.equal(b.archive, ARCHIVE_LYCAN, 'the werewolf\'s own archive, 112380 - the one the transformed player sees');
  assert.equal(riders.riders.get('wolf').table, 'IdleLycan');
  assert.equal(riders.riders.get('wolf').table, chooseTable({ transformed: true, stopped: true, sheathed: true }), 'the local rule\'s answer');
  assert.ok(Math.abs(b.size.h - H * SIZE_RIDING_OR_TRANSFORMED) < 1e-9, `the transformed size (sizeMod): ${b.size.h}`);
  assert.ok(Math.abs(b.origin[0] - 10) < 2 && Math.abs(b.origin[2] - 5) < 1, `at the SHOWN feet: ${b.origin}`);
  const r = riders.riders.get('wolf');
  assert.ok(riders.heightOf('wolf') > 1 && Math.abs(riders.heightOf('wolf') - (r.size.h + r.xml.y / r.xml.scale)) < 1e-9, 'the name at the beast\'s own top');

  // the wereboar: the other archive (lycanArchive's `== 2`)
  const { riders: r2 } = riderLayer();
  await drawn(r2, [{ id: 'boar', shown: shownOf({ wb: 2 }) }]);
  assert.equal(r2.batches()[0]?.archive, ARCHIVE_LYCAN + 1, 'the wereboar, 112381');

  // moving: MoveLycan (base 5); claws up at a stand: IdleMeleeLycan (base 15)
  const { riders: r3 } = riderLayer();
  await drawn(r3, [{ id: 'm', shown: shownOf({ wb: 1, mv: 1 }) }]);
  assert.equal(r3.riders.get('m').table, 'MoveLycan');
  assert.ok(recordOf(r3.batches()[0]) >= STATE_TABLES.MoveLycan.base && recordOf(r3.batches()[0]) < STATE_TABLES.MoveLycan.base + 5);
  const { riders: r4 } = riderLayer();
  await drawn(r4, [{ id: 'c', shown: shownOf({ wb: 1, wd: 1 }) }]);
  assert.equal(r4.riders.get('c').table, 'IdleMeleeLycan');
  assert.ok(recordOf(r4.batches()[0]) >= STATE_TABLES.IdleMeleeLycan.base && recordOf(r4.batches()[0]) < STATE_TABLES.IdleMeleeLycan.base + 5);
  assert.equal(PR.beastTable?.({ mv: 1, wd: 1 }), 'MoveLycan', 'a beast that moves is MoveLycan whether or not the claws are up (IL_432c-IL_4360)');
  // a human rider is untouched
  const { riders: r5 } = riderLayer();
  await drawn(r5, [{ id: 'h', shown: shownOf({ rd: 1, rv: 2, mv: 1 }) }]);
  assert.equal(r5.batches()[0]?.archive, ARCHIVE_HORSE + 2, 'the rider\'s own mounted set, as RIDE drew it');
  assert.equal(r5.riders.get('h').table, 'MoveHorse');
  // a human on foot is not this layer's
  const { riders: r6 } = riderLayer();
  await drawn(r6, [{ id: 'man', shown: shownOf({}) }]);
  assert.equal(r6.isRiding('man'), false); assert.equal(r6.batches().length, 0);
});

test('PR-WW1 layer: a beast IN THE SADDLE is the beast, as the transformed player sees themselves (transformed first), on the saddle\'s clock; a beast running on foot walks at half the frame (mutants: the rider\'s table wins; the clock unchanged)', async () => {
  const { riders } = riderLayer();
  const rider = { id: 'wr', shown: shownOf({ wb: 1, rd: 1, rv: 3 }) };
  assert.equal(rider.shown.rd, 1);
  await drawn(riders, [rider]);
  assert.equal(riders.batches()[0]?.archive, ARCHIVE_LYCAN, 'the werewolf, not a person on a horse (112382 + rv)');
  assert.equal(riders.riders.get('wr').table, chooseTable({ transformed: true, riding: true, stopped: true, sheathed: true }));
  // the clock: a moving beast in the saddle advances at FRAME_TIME_RIDING
  const { riders: rm } = riderLayer();
  const moving = { id: 'rm', shown: shownOf({ wb: 1, rd: 1, mv: 1 }) };
  await drawn(rm, [moving]);
  assert.equal(rm.riders.get('rm').table, 'MoveLycan');
  rm.sync([moving], toScene, { eye: [10, 1, 20], dt: frameTime(true) + 1e-6 });
  assert.equal(rm.riders.get('rm').frame, 1, 'one saddle frame, one step');
  // on foot: a walk steps at FRAME_TIME_ON_FOOT, a run at half of it (speedMod)
  const { riders: rw } = riderLayer();
  const walker = { id: 'w', shown: shownOf({ wb: 1, mv: 1 }) };
  await drawn(rw, [walker]);
  rw.sync([walker], toScene, { eye: [10, 1, 20], dt: frameTime(false) / 2 + 1e-6 });
  assert.equal(rw.riders.get('w').frame, 0, 'a walk: half a frame is no step');
  const { riders: rr } = riderLayer();
  const runner = { id: 'r', shown: shownOf({ wb: 1, mv: 2 }) };
  await drawn(rr, [runner]);
  rr.sync([runner], toScene, { eye: [10, 1, 20], dt: frameTime(false) / 2 + 1e-6 });
  assert.equal(rr.riders.get('r').frame, 1, 'a run: the same time is a step');
});

test('PR-WW1 claw: the swing count moving on a beast plays EOTB\'s lycan swing once - its three frames forward at LYCAN_TICK - then the loop again; the count first seen is no swing; a human rider never claws (mutants: no claw; a claw on first sight)', async () => {
  const { riders } = riderLayer();
  const wolf = { id: 'wolf', shown: shownOf({ wb: 1, wd: 1, an: 7 }) };
  await drawn(riders, [wolf]);
  assert.equal(riders.riders.get('wolf').table, 'IdleMeleeLycan', 'a peer met mid-fight does not claw at nothing');
  wolf.shown = shownOf({ wb: 1, wd: 1, an: 8 });
  riders.sync([wolf], toScene, { eye: [10, 1, 20], dt: 1 / 60 });
  assert.equal(riders.riders.get('wolf').table, CLAW_TABLE);
  assert.equal(PR.CLAW_TABLE, CLAW_TABLE, 'the layer names the local body\'s claw');
  const frames = [riders.riders.get('wolf').frame];
  for (let i = 0; i < 3; i++) {
    riders.sync([wolf], toScene, { eye: [10, 1, 20], dt: LYCAN_TICK + 1e-6 });
    frames.push(riders.riders.get('wolf').table === CLAW_TABLE ? riders.riders.get('wolf').frame : riders.riders.get('wolf').table);
  }
  assert.deepEqual(frames, [0, 1, 2, 'IdleMeleeLycan'], 'the claw forward, a LYCAN_TICK a frame, then the loop');
  // the claw's art is asked for too (the batch follows it once up)
  const { riders: rc, renderer } = riderLayer();
  const w2 = { id: 'w2', shown: shownOf({ wb: 2, an: 1 }) };
  await drawn(rc, [w2]);
  w2.shown = shownOf({ wb: 2, an: 2 });
  rc.sync([w2], toScene, { eye: [10, 1, 20], dt: 0 });
  await settle();
  rc.sync([w2], toScene, { eye: [10, 1, 20], dt: 0 });
  const b = rc.batches()[0];
  assert.equal(b.archive, ARCHIVE_LYCAN + 1);
  assert.ok(recordOf(b) >= STATE_TABLES.AttackMeleeLycan.base && recordOf(b) < STATE_TABLES.AttackMeleeLycan.base + 5, `the claw's record: ${b.record}`);
  assert.ok(renderer.uploads.some((u) => u.startsWith(`${ARCHIVE_LYCAN + 1}:${STATE_TABLES.AttackMeleeLycan.base}`)));
  // a human rider's swing is no claw
  const { riders: rh } = riderLayer();
  const man = { id: 'man', shown: shownOf({ rd: 1, an: 1 }) };
  await drawn(rh, [man]);
  man.shown = shownOf({ rd: 1, an: 2 });
  rh.sync([man], toScene, { eye: [10, 1, 20], dt: 0 });
  assert.equal(rh.riders.get('man').table, 'IdleHorse');
});

test('PR-WW1 claw, the local body\'s own rule (eotbBody playLycanAttack): a beast in the saddle does not claw, and a swing while the claw plays does not restart it (mutants: the saddle claws; a new swing restarts the claw)', async () => {
  const { riders } = riderLayer();
  const mounted = { id: 'm', shown: shownOf({ wb: 1, rd: 1, an: 1 }) };
  await drawn(riders, [mounted]);
  mounted.shown = shownOf({ wb: 1, rd: 1, an: 2 });
  riders.sync([mounted], toScene, { eye: [10, 1, 20], dt: 1 / 60 });
  assert.notEqual(riders.riders.get('m').table, CLAW_TABLE, 'never in the saddle');
  const { riders: rf } = riderLayer();
  const wolf = { id: 'f', shown: shownOf({ wb: 1, wd: 1, an: 1 }) };
  await drawn(rf, [wolf]);
  wolf.shown = shownOf({ wb: 1, wd: 1, an: 2 });
  rf.sync([wolf], toScene, { eye: [10, 1, 20], dt: 1 / 60 });
  rf.sync([wolf], toScene, { eye: [10, 1, 20], dt: LYCAN_TICK + 1e-6 });
  assert.equal(rf.riders.get('f').frame, 1, 'the claw is on its second frame');
  wolf.shown = shownOf({ wb: 1, wd: 1, an: 3 });   // a swing while it plays
  rf.sync([wolf], toScene, { eye: [10, 1, 20], dt: 1 / 60 });
  assert.equal(rf.riders.get('f').table, CLAW_TABLE);
  assert.equal(rf.riders.get('f').frame, 1, 'not restarted: the claw plays on');
});

test('PR-WW1 hand-off, in world.js\'s order: once the lycanthrope is up the enemy sprite gives way and the name rides at the beast\'s top; with no art (a build without it, or a failed fetch) DISC12\'s werewolf still stands - a beast is never nothing; the form back to human takes the beast away (mutants: the fallback lost; both drawn)', async () => {
  const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [], class: 'Warrior' };
  const tex = (archive) => ({ archive, getFrameCount: () => 5, getSize: () => ({ w: 60, h: 100 }), getScale: () => ({ x: 0, y: 0 }) });
  const run = async (urlFor, shown, n = 6) => {
    const renderer = { ...fakeRenderer(), textures: new Map() };
    const riders = createPeerRiders({ renderer, urlFor, decode: async () => ({ width: W, height: H, colors: new Uint32Array(W * H) }) });
    const asked = [];
    const rp = new RemotePlayers({ renderer, deps: { getTexture: async (a) => tex(a), uploadRecordFrame: () => {}, audio: null }, compose: async () => null });
    const mobileFor = rp._mobileFor.bind(rp);
    rp._mobileFor = (id, type, g) => { asked.push(type); return mobileFor(id, type, g); };
    const peer = { id: 'wolf', name: 'wolf', look: LOOK, told: true, shown };
    for (let i = 0; i < n; i++) {
      const drawable = [peer];
      riders.sync(drawable, toScene, { eye: [0, 1, 0], dt: 1 / 60 });                                                        // world.js peerRiders.sync
      rp.sync(drawable, toScene, { bodyHeight: (id) => riders.heightOf(id), dt: 1 / 60, eye: [0, 0, 0] });                  // world.js remotePlayers.sync
      await settle();
    }
    return { riders, rp, asked, peer };
  };
  // the art up: the EOTB beast, and no enemy sprite beside it
  const up = await run((k) => `u:${k}`, shownOf({ x: 1, z: 1, wb: 1 }));
  assert.equal(up.riders.isRiding('wolf'), true);
  assert.equal(up.rp._batches.has('wolf'), false, 'the enemy sprite gives way - one beast, not two');
  assert.equal(up.riders.batches()[0].archive, ARCHIVE_LYCAN);
  const tag = up.rp._shown.find((s) => s.peer.id === 'wolf');
  assert.ok(tag && Math.abs(tag.height - up.riders.heightOf('wolf')) < 1e-9, 'the name at the lycanthrope\'s own top');
  // no art at all: the DISC12 fallback
  const none = await run(() => null, shownOf({ x: 1, z: 1, wb: 1 }));
  assert.equal(none.riders.isRiding('wolf'), false);
  assert.ok(none.asked.includes(MOBILE_TYPES.Werewolf), 'the werewolf enemy sprite is still built');
  assert.equal(none.rp._batches.get('wolf')?.kind, 'mobile', 'and drawn');
  const noneBoar = await run(() => null, shownOf({ x: 1, z: 1, wb: 2 }));
  assert.ok(noneBoar.asked.includes(MOBILE_TYPES.Wereboar));
  // human again: the lycanthrope goes
  up.peer.shown = shownOf({ x: 1, z: 1 });
  up.riders.sync([up.peer], toScene, { eye: [0, 1, 0], dt: 0 });
  assert.equal(up.riders.isRiding('wolf'), false); assert.equal(up.riders.batches().length, 0);
});

test('PR-WW1 the local body: the lycan sprite is the LIVE form\'s - a wereboar sees 112381 on themselves, as the others now draw them; a curse caught after the body attached fetches its own beast (mutants: the settings alone - the werewolf for every form)', async () => {
  const mk = () => {
    const uploads = [], batches = [];
    const r = {
      uploads, batches,
      uploadTexture(archive, rec) { uploads.push(`${archive}:${rec}`); },
      createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; batches.push(b); return b; },
      destroyBillboardBatch() {}, drawBillboards() {},
    };
    const b = createEotbBody({ count: () => 3035, urlFor: (k) => `/art/${k}.png`, decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }) });
    b.attach(r, () => ({}));
    return { b, r };
  };
  const still = (extra) => ({ motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 0, 0], yaw: 0, cameraPos: [0, 1.5, -2], ...extra });
  for (const [form, archive] of [[1, ARCHIVE_LYCAN], [2, ARCHIVE_LYCAN + 1]]) {
    const { b, r } = mk();
    await settle();
    b.toggle(true, false);
    for (let i = 0; i < 8; i++) b.tick(1 / 60, still({ transformed: true, lycanthropyType: form }));
    await settle();
    for (let i = 0; i < 4; i++) b.tick(1 / 60, still({ transformed: true, lycanthropyType: form }));
    assert.equal(b.state().table, 'IdleLycan');
    assert.equal(b.draw({}, { eye: [0, 1.5, -2], feet: [0, 0, 0], yaw: 0 }), true);
    assert.equal(r.batches.at(-1).archive, archive, `form ${form}: the body draws ${archive}`);
    assert.equal(r.uploads.some((u) => u.startsWith(`${ARCHIVE_LYCAN + 1}:`)), form === 2, 'the boar\'s art is fetched for the boar alone');
    // the body attached before the curse was known (the state thunk said nothing): the form's WHOLE lycan set is
    // fetched on the first tick that names it - a walk it has not drawn yet included - not a sprite at a time
    assert.ok(r.uploads.includes(`${archive}:${STATE_TABLES.MoveLycan.base + 2}-3`), `form ${form}: the preload re-run for its own archive`);
  }
  assert.match(rd('src/player/eotbBody.js'), /const lookNow = \(\) => \(\{ \.\.\.cfg, lycanthropyType: last\.lycanthropyType \}\);/);
  assert.doesNotMatch(rd('src/player/eotbBody.js'), /spriteFor\([^)]*, cfg[,)]/, 'no spriteFor on the settings alone');
});

test('PR-WW1 hosts: the modal passes draw the lycanthrope too - world.js\'s extraBillboards hands worldModes the peerRiders batches beside remotePlayers\', and worldModes\' dungeon and interior runs draw that hook alone; the beast still takes no Morrowind body (mutant: the hook narrowed back)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /extraBillboards: \(\) => \[\.\.\.\(remotePlayers\?\.batches\(\) \?\? \[\]\), \.\.\.\(peerRiders\?\.batches\(\) \?\? \[\]\)\],/);
  assert.match(w, /const afoot = drawable\.filter\(\(d\) => !peerRiders\.isRiding\(d\.id\) && !d\.shown\?\.wb\);/, 'a beast takes no body while its art loads either');
  assert.match(w, /peerRiders\.sync\(drawable, onlineToScene, \{ eye: cam\.pos,/);
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /renderer\.drawBillboards\(\[\.\.\.dungeonCtx\.billboardBatches, [^\n]*\.\.\.\(host\.extraBillboards\?\.\(\) \?\? \[\]\)\], camRight, UP_Y\);/, 'the dungeon\'s pass');
  assert.match(m, /renderer\.drawBillboards\(\[\.\.\.interiorCtx\.billboardBatches, \.\.\.\(host\.extraBillboards\?\.\(\) \?\? \[\]\)\], camRight, UP_Y\);/, 'the interior\'s pass');
  assert.match(m, /const \{ canvas, renderer, player, cam, keys,/, 'the modes share world.js\'s cam - the eye peerRiders reads is live underground');
  assert.match(m, /cam\.pos = player\.eyeAt\(\);   \/\/ EV1: the interpolated render eye\n(?:\s*\/\/[^\n]*\n)*\s*if \(interiorOverlay instanceof DeathScreen\) cam\.pos\[1\] -= interiorOverlay\.drop;/, 'set each modal frame');
});
