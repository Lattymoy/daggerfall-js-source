// SET7 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 7; Mac: "Sigil stones become a currency to
// trade for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate"): THE SIGIL BROKER IN THE
// WORLD (scenes/sigilBrokerPool.js) - BROKER-CAGE (2026-10-02, Mac: "she should be present at the site in a jailed gate,
// and the gate opens after all the enemies are cleared"): where she stands, caged at the faithful's circle from the omen
// to midnight; her turn to a player near her, her body (the Seducer's idle, on the flats' axis), her post and her cage
// in the collider, her eye's box (her cage's whole while she is in it), her plaque and her press, caged and free; the
// race she runs in (player/activationRace.js); and the host's seams (scenes/world.js).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSigilBroker, brokerPlace, brokerFacing, turnToward, postTraps, cageTraps, cageSpotLocal, CAGE_R, CAGE_TURN, BROKER_MOBILE, BROKER_REACH,
  BROKER_BOX_HX, BROKER_BOX_HZ, BROKER_BOX_H, BROKER_GROUND_EVERY, BROKER_NOTICE_M, BROKER_TURN_RATE, BROKER_TEXT, BROKER_BUCKET, BROKER_CAGE_BUCKET,
  BROKER_DOOR_BUCKET, BROKER_POST, BROKER_BODY_R, BROKER_BODY_H, BROKER_FREED_SAY_M, BROKER_SHUT_SEEN_MS,
} from '../src/scenes/sigilBrokerPool.js';
import { gateTimes, gateSpotLocal } from '../src/net/gateLaw.js';
import { riteLocalOf, RITE_GRACE_MS } from '../src/net/gateRite.js';
import { riteLayout, RITE_BRAZIER_R, RITE_BRAZIER_W, RITE_TENT_R } from '../src/world/riteModel.js';
import { RITE_CLEAR_M } from '../src/world/gateClearance.js';
import { CAGE_W, CAGE_D, CAGE_H, CAGE_WALL_OUT, CAGE_DOOR_OPEN, CAGE_DOOR_MS, CAGE_FOOT, CAGE_FOOT_UNDER, CAGE_POST, CAGE_SILL, CAGE_SILL_OVER, CAGE_LEAF_W, cageHinge } from '../src/world/cageModel.js';
import { raceActivation, raceWinner } from '../src/player/activationRace.js';
import { pickActivatableHit, RAY_DISTANCE, STATIC_NPC_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { composeNamer } from '../src/systems/worldHover.js';
import { IDLE_ANIMS } from '../src/characters/mobileUnit.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { Collider } from '../src/player/collider.js';
import { CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../src/player/motor.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** The eye's box's reach from her feet, round any turn (its corner). */
const BOX_R = Math.hypot(BROKER_BOX_HX, BROKER_BOX_HZ);
/** A matrix's yaw (trs's R_y: its first column is (cos, 0, -sin)). */
const yawOf = (m) => Math.atan2(-m[2], m[0]);
const DAY = 812;
const T = gateTimes(DAY);
/** The breach the omen names (systems/gateOmen.js cageSite's shape). */
const SITE = Object.freeze({ day: DAY, px: 300, py: 200 });
/** The rite holds (its faithful chant), and after it the breach is open. */
const HOLDS = T.omenAt + 60_000, OPENED = T.openAt + 60_000;
/** A pixel's translation into the scene (streamingWorld.js's shape: x east, z north, the rows above north), moved by
 *  `shift` - a floating-origin recentre. */
let shift = 0;
const tr = (px, py, out = [0, 0, 0]) => { out[0] = (px - 300) * 819.2 + 100 + shift; out[1] = 0; out[2] = (200 - py) * 819.2 - 40; return out; };
/** A Broker on the host's seams, with the breach, the clock and her freedom the test's to move. */
function rig(over = {}) {
  const w = { site: SITE, clock: HOLDS, free: false, ground: 21 };
  const b = createSigilBroker({ site: () => w.site, pixelTranslation: tr, heightAt: () => w.ground, now: () => w.clock, freed: () => w.free, ...over });
  return { b, w };
}

test('BROKER-CAGE where she stands: her cage at the faithful\'s circle - CAGE_R from its heart, turned CAGE_TURN from its bearing to the gate, on the ground there, facing the gate - clear of the braziers, the casket, the ring, the Summoner, the tents and the fire, inside the rock\'s clearing; from the omen to midnight and not outside it, nowhere on a pixel not built (mutants: the spot turned the wrong way; the gate\'s bearing for hers; the cage within the braziers; midnight kept; the omen not waited for; a cage in the air)', () => {
  shift = 0;
  for (const day of [812, 813, 900, 1234, 4071]) {
    const t = gateTimes(day), site = { day, px: 300, py: 200 };
    const at = brokerPlace(site, t.omenAt, tr, () => 23.5);
    const [e, n] = riteLocalOf(day), t0 = tr(300, 200);
    const dx = at.feet[0] - (t0[0] + e), dz = at.feet[2] - (t0[2] + n);
    const [gx, gz] = gateSpotLocal(day), facing = Math.atan2(gx - e, gz - n);
    assert.ok(near(Math.hypot(dx, dz), CAGE_R), `day ${day}: CAGE_R from the circle's heart`);
    assert.ok(near(wrap(Math.atan2(dx, dz) - facing), CAGE_TURN), `day ${day}: turned CAGE_TURN from its bearing to the gate`);
    assert.ok(near(at.rest, facing), `day ${day}: facing the gate`);
    assert.equal(at.feet[1], 23.5, 'on the ground there');
    assert.deepEqual([at.day, at.px, at.py], [day, 300, 200]);
    const sp = cageSpotLocal(day);
    assert.ok(near(sp.x, e + dx, 1e-6) && near(sp.z, n + dz, 1e-6) && sp.facing === facing, 'the spot is the pixel\'s, carried by its translation');
    const L = riteLayout(facing), reach = BOX_R + 1;
    for (const [x, z] of L.braziers) assert.ok(Math.hypot(dx - x, dz - z) > reach + RITE_BRAZIER_W, `day ${day}: clear of a brazier`);
    assert.ok(Math.hypot(dx - L.casket.x, dz - L.casket.z) > reach + 1, 'clear of the casket');
    assert.ok(Math.hypot(dx - L.summoner[0], dz - L.summoner[1]) > reach + 1, 'clear of the Summoner');
    for (const [x, z] of L.ring(8)) assert.ok(Math.hypot(dx - x, dz - z) > reach + 1, 'clear of the faithful\'s ring');
    for (const tt of L.tents) assert.ok(Math.hypot(dx - tt.x, dz - tt.z) > reach + 3, 'clear of their tents');
    assert.ok(Math.hypot(dx - L.fire[0], dz - L.fire[1]) > reach + 1, 'clear of their fire');
  }
  assert.ok(CAGE_R - BOX_R > RITE_BRAZIER_R + 1, 'outside the braziers\' ring');
  assert.ok(CAGE_R + BOX_R < RITE_CLEAR_M - 2, 'inside the clearing the rock keeps off (gateClearance.js RITE_CLEAR_M)');
  assert.ok(CAGE_R + BOX_R < RITE_TENT_R, 'nearer than their camp');
  assert.equal(brokerPlace(SITE, T.omenAt - 1, tr, () => 0), null, 'before the omen');
  assert.ok(brokerPlace(SITE, T.omenAt, tr, () => 0), 'from the omen');
  assert.ok(brokerPlace(SITE, T.openAt + 1, tr, () => 0), 'the breach open');
  assert.ok(brokerPlace(SITE, T.wrathAt - 1, tr, () => 0), 'the last moment before midnight');
  assert.equal(brokerPlace(SITE, T.wrathAt, tr, () => 0), null, 'midnight takes her');
  assert.equal(brokerPlace(SITE, T.omenAt, tr, () => NaN), null, 'her pixel not built');
  assert.equal(brokerPlace(null, T.omenAt, tr, () => 0), null, 'no breach');
});

test('SET7 her turn: to a player within BROKER_NOTICE_M, back out of the gate beyond it, the short way round at a walk\'s pace (mutants: a snap; the long way round; a player across the field noticed)', () => {
  const at = [0, 0, 0];
  assert.equal(brokerFacing(at, 0.5, null), 0.5, 'no player: her rest');
  assert.ok(near(brokerFacing(at, 0.5, [3, 0, 3]), Math.PI / 4), 'a player near: toward them');
  assert.equal(brokerFacing(at, 0.5, [BROKER_NOTICE_M + 0.1, 0, 0]), 0.5, 'beyond her notice: her rest');
  assert.ok(near(brokerFacing(at, 0.5, [BROKER_NOTICE_M - 0.1, 0, 0]), Math.PI / 2));
  assert.equal(brokerFacing(at, 0.5, [0, 5, 0]), 0.5, 'a player straight overhead has no bearing');
  assert.equal(turnToward(0, 1, 0.1), BROKER_TURN_RATE * 0.1, 'at most her rate a second');
  assert.equal(turnToward(0, 0.1, 1), 0.1, 'and never past what she wants');
  assert.ok(turnToward(3, -3, 0.1) > 3, 'the short way round, across the seam');
  assert.ok(near(turnToward(-3, 3, 0.1), -3 - BROKER_TURN_RATE * 0.1));
  assert.equal(turnToward(1, 1, 0.1), 1);
  assert.equal(turnToward(0, 1, -5), 0, 'a clock run backwards turns nothing');
});



/** A fake renderer and texture: the court's own billboard seam (createBillboardBatch, textures.has), and the meshes' -
 *  her cage's (createMesh, drawMesh, the gate's art uploaded). */
function fakeArt() {
  const uploads = [], meshes = [], drawn = [], art = [], destroyed = [];
  const tex = { archive: 284, getFrameCount: () => 1, getSize: (r) => ({ width: 26, height: r === 15 ? 86 : 82 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = {
    textures: new Set(),
    createBillboardBatch: (archive, record, size, positions) => ({ archive, record, size, positions, bounds: [0, 0, 0, 1] }),
    createMesh: (model) => { const m = { model }; meshes.push(m); return m; },
    destroyMesh: (m) => destroyed.push(m),
    drawMesh: (mesh, mat) => drawn.push([mesh, mat]),
    uploadTexture: (a, rec) => art.push([a, rec]),
    uploadEmissionTexture: () => {},
  };
  return { renderer, tex, uploads, meshes, drawn, art, destroyed, getTexture: async (a) => (a === 284 ? tex : null), uploadRecordFrame: (a, r, f) => { uploads.push([a, r, f]); renderer.textures.add(`${a}_${r}#${f}`); } };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('SET7 her body: the Daedra Seducer\'s mortal guise (EnemyBasics 29, TEXTURE.284), the idle record her yaw and the eye choose, uploaded once, a billboard stood on her feet on the flats\' axis; unseen while it loads, and a sprite that will not load leaves her box and her window (mutants: another mobile\'s sprite; the frame uploaded every frame; her billboard off her feet) - BROKER-CAGE: her cage and its door drawn about her, made once', async () => {
  assert.equal(BROKER_MOBILE, 29);
  assert.equal(ENEMY_BASICS[BROKER_MOBILE].maleTexture, 284);
  const art = fakeArt();
  const { b, w } = rig({ ...art, cam: () => [0, 0, 0] });
  const at = b.frame(0.016);
  assert.ok(at, 'she stands');
  assert.deepEqual(b.batches(), [], 'unseen while her sprite loads');
  assert.equal(b.state().body, 'loading');
  await settle();
  b.frame(0.016);
  const [batch] = b.batches();
  assert.ok(batch, 'her billboard');
  assert.equal(batch.archive, 284);
  assert.deepEqual(batch.origin, at.feet, 'stood on her feet, as a walker stands');
  assert.ok(IDLE_ANIMS.some((a) => batch.record === `${a.record}#0`), `an idle record: ${batch.record}`);
  const n = art.uploads.length;
  b.frame(0.016);
  assert.equal(art.uploads.length, n, 'a frame uploaded once');
  assert.ok(Math.abs(batch.size.w) > 0 && batch.size.h > 2, 'sized to her frame');
  // her cage: two meshes made once, the gate's own art with them, drawn where she stands
  assert.equal(art.meshes.length, 2, 'the cage and its door, made once');
  assert.ok(art.art.some(([a]) => a === 38101), 'the gate\'s own art');
  assert.equal(b.draw(), 2);
  const [[, cm], [, dm]] = art.drawn;
  assert.deepEqual([cm[12], cm[13], cm[14]], at.feet.map(Math.fround), 'the cage about her feet');
  assert.ok(near(wrap(yawOf(cm) - at.rest), 0, 1e-6), 'turned with her rest - its door toward the gate (AUDIT BROKER-CAGE T3)');
  // the shut door on its hinge: the left jamb's inner face, turned as the cage is
  const cs = Math.cos(at.rest), sn = Math.sin(at.rest), [hx, hz] = cageHinge();
  assert.ok(near(dm[12], at.feet[0] + cs * hx + sn * hz, 1e-4) && near(dm[14], at.feet[2] - sn * hx + cs * hz, 1e-4), 'the door on its hinge');
  assert.ok(near(wrap(yawOf(dm) - at.rest), 0, 1e-6), 'shut: the leaf in the cage\'s face');
  // the eye walks round her: the record follows the orientation
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const eye = [at.feet[0] + Math.sin(a) * 40, at.feet[1], at.feet[2] + Math.cos(a) * 40];
    const { b: b2 } = rig({ ...art, cam: () => eye });
    b2.frame(0); await settle(); b2.frame(0);
    seen.add(`${b2.batches()[0].record}${b2.batches()[0].size.w < 0 ? '~' : ''}`);
  }
  assert.ok(seen.size >= 5, `the eight orientations read her five idle records and their flips: ${[...seen].join(' ')}`);
  // a sprite that will not load
  const { b: bad } = rig({ renderer: art.renderer, uploadRecordFrame: art.uploadRecordFrame, getTexture: async () => null });
  const warn = console.warn; console.warn = () => {};
  try { bad.frame(0); await settle(); bad.frame(0); } finally { console.warn = warn; }
  assert.deepEqual(bad.batches(), []);
  assert.equal(bad.state().body, 'failed');
  assert.equal(bad.targets().length, 1, 'her box stands all the same');
  // the breach gone: no body, no cage
  w.site = null;
  b.frame(0);
  assert.deepEqual(b.batches(), []);
  assert.equal(b.draw(), 0);
});

test('BROKER-CAGE her box, her plaque, her press: her cage\'s own box, turned with it, just beyond its walls, caged and free alike (AUDIT BROKER-CAGE C2, C3), at a static NPC\'s reach, a surface of its own; caged - the plaque naming who holds her, a press saying what frees her while the rite holds (and its grace, C13) and that she stays caged after it, Info and Steal as ever; freed - the plaque her trade, Grab and Talk open her window; another key nothing (mutants: a caged window opened; the plaque\'s trade while caged; the held line after the opening; the lost line in the grace; a stale day\'s key pressed)', () => {
  const said = [];
  let opened = 0;
  const { b, w } = rig({ say: (t) => said.push(t), open: () => { opened++; } });
  assert.deepEqual(b.targets(), [], 'no frame yet: no box');
  const at = b.frame(0);
  assert.equal(b.state().caged, true, 'caged from the omen');
  assert.equal(b.stands(), false, 'the sale asks: not while she is caged');
  assert.equal(b.caged(), true);
  let [t] = b.targets();
  assert.equal(t.key, 'broker:812');
  assert.equal(t.reach, BROKER_REACH);
  assert.equal(BROKER_REACH, STATIC_NPC_ACTIVATION_DISTANCE, 'PlayerActivate\'s static NPC reach');
  assert.equal(t.distance, RAY_DISTANCE);
  assert.equal(t.noSurface, false, 'a surface of its own - her walls, her post (a press from her doorway meets her)');
  assert.deepEqual(t.obb.box, [-BROKER_BOX_HX, 0, -BROKER_BOX_HZ, BROKER_BOX_HX, BROKER_BOX_H, BROKER_BOX_HZ], 'her cage\'s own box');
  assert.deepEqual([t.obb.m[12], t.obb.m[13], t.obb.m[14]], at.feet.map(Math.fround), 'about her feet');
  assert.ok(near(wrap(yawOf(t.obb.m) - at.rest), 0, 1e-6), 'turned with her cage');
  assert.ok(BROKER_BOX_HX > CAGE_W / 2 + CAGE_WALL_OUT && BROKER_BOX_HZ > CAGE_D / 2 + CAGE_WALL_OUT, 'beyond its walls - the ray meets it before any bar');
  assert.ok(BROKER_BOX_HX < CAGE_W / 2 + CAGE_WALL_OUT + CAPSULE_RADIUS && BROKER_BOX_HZ < CAGE_D / 2 + CAGE_WALL_OUT + CAPSULE_RADIUS, 'and short of any body its walls hold off');
  assert.ok(BROKER_BOX_H > CAGE_H, 'over its roof');
  const ca = Math.abs(Math.cos(at.rest)), sa = Math.abs(Math.sin(at.rest)), hw = BROKER_BOX_HX * ca + BROKER_BOX_HZ * sa, hd = BROKER_BOX_HX * sa + BROKER_BOX_HZ * ca;
  assert.ok(near(t.aabb.min[0], at.feet[0] - hw) && near(t.aabb.max[2], at.feet[2] + hd) && near(t.aabb.max[1], at.feet[1] + BROKER_BOX_H), 'its bounds beside it, the turned box\'s own');
  assert.equal(b.targets(), b.targets(), 'made once where she stands');
  const namer = composeNamer([(k) => b.hoverName(k)]);
  assert.deepEqual(namer('broker:812'), { title: 'Sigil Broker', subs: ['Caged by Dagon\'s Faithful'] }, 'the plaque: who holds her');
  for (const mode of ['grab', 'dialogue']) assert.equal(b.activate('broker:812', mode), true);
  assert.deepEqual(said, [BROKER_TEXT.held, BROKER_TEXT.held], 'what frees her, while the rite holds');
  assert.equal(BROKER_TEXT.held, 'Kill all of Dagon\'s Faithful to free her.');
  assert.equal(opened, 0, 'no window on a cage');
  w.clock = T.openAt + RITE_GRACE_MS - 1;
  b.frame(0);
  b.activate('broker:812', 'grab');
  assert.equal(said.at(-1), BROKER_TEXT.held, 'AUDIT BROKER-CAGE C13: the relay still hears the last fall in the grace');
  w.clock = OPENED;
  b.frame(0);
  b.activate('broker:812', 'grab');
  assert.equal(said.at(-1), BROKER_TEXT.lost, 'the breach open and the faithful passed into it: caged tonight');
  assert.equal(BROKER_TEXT.lost, 'She stays caged tonight.');
  b.activate('broker:812', 'info');
  assert.equal(said.at(-1), 'You see the Sigil Broker.', 'Info names her, caged or free');
  b.activate('broker:812', 'steal');
  assert.equal(said.at(-1), BROKER_TEXT.steal);
  // freed
  w.free = true;
  b.frame(0);
  assert.equal(b.stands(), true, 'free: the sale may go on');
  assert.equal(b.caged(), false);
  assert.equal(b.targets()[0], t, 'free: the same box (AUDIT BROKER-CAGE C3: her own, inside the walls, was hidden by them from all but her door)');
  assert.deepEqual(namer('broker:812'), { title: 'Sigil Broker', subs: ['Trades in Deadlands Embers'] }, 'the ladder takes her record');
  assert.equal(b.hoverName('broker:811'), null, 'yesterday\'s key');
  assert.equal(b.hoverName(7), null, 'a door\'s bare number (AUDIT-WH C1)');
  const n = said.length;
  for (const mode of ['grab', 'dialogue']) assert.equal(b.activate('broker:812', mode), true);
  assert.equal(opened, 2, 'Grab and Talk open her window');
  assert.equal(said.length, n, 'and say nothing');
  assert.equal(b.activate('broker:811', 'grab'), false, 'a stale day\'s key');
  assert.equal(b.activate('gate:812', 'grab'), false, 'the gate\'s key');
  assert.equal(opened, 2);
  w.site = null;
  b.frame(0);
  assert.equal(b.activate('broker:812', 'grab'), false, 'she is gone');
  assert.deepEqual(b.targets(), []);
  assert.equal(b.stands(), false);
});

test('BROKER-CAGE her door: shut from the omen; open the frame every one of the faithful fell, swinging OUT over CAGE_DOOR_MS, eased, and said to a player near her who saw it shut; open already for a page that came after (or whose word came within BROKER_SHUT_SEEN_MS, or - AUDIT BROKER-CAGE C8 - whose hub said it open before the page first saw it shut), and said to nobody; the shared clock stepping back never draws it shut again (C11); a new day\'s cage shut again (mutants: the door never opened; opened at once with no swing; swung in; swung linear; the line to a player across the field; the line to a page just opened; a stale word swung; yesterday\'s door left open)', () => {
  const said = [];
  let me = null;
  const art = fakeArt();
  const { b, w } = rig({ ...art, say: (t) => said.push(t), feet: () => me });
  me = [0, 0, 0];
  const at = b.frame(0);
  me = [at.feet[0] + 5, at.feet[1], at.feet[2]];
  assert.equal(b.state().door, 0, 'shut');
  w.clock += BROKER_SHUT_SEEN_MS;
  b.frame(0);
  w.free = true;
  b.frame(0);
  assert.equal(b.state().caged, false, 'open the frame they all fell');
  assert.deepEqual(said, [BROKER_TEXT.freed], 'said to a player near her');
  assert.equal(BROKER_TEXT.freed, 'The Sigil Broker is free.');
  assert.equal(b.state().door, 0, 'its swing begins');
  w.clock += CAGE_DOOR_MS / 4;
  assert.ok(near(b.state().door, CAGE_DOOR_OPEN * 0.15625, 1e-9), 'a quarter of the time, a sixth of the way (eased: k^2(3-2k))');
  w.clock += CAGE_DOOR_MS / 4;
  assert.ok(near(b.state().door, CAGE_DOOR_OPEN / 2, 1e-9), 'half way, half way round');
  w.clock += CAGE_DOOR_MS;
  assert.equal(b.state().door, CAGE_DOOR_OPEN, 'swung open');
  b.frame(0);
  assert.equal(said.length, 1, 'said once');
  // OUT: the leaf's free end, carried by the door's matrix, stands beyond the cage's face
  const dm = b.state().matrices.door, end = [dm[0] * CAGE_LEAF_W + dm[12], dm[2] * CAGE_LEAF_W + dm[14]];
  const cs = Math.cos(at.rest), sn = Math.sin(at.rest), dx = end[0] - at.feet[0], dz = end[1] - at.feet[2];
  assert.ok(sn * dx + cs * dz > CAGE_D / 2 + 0.5, `swung out of the cage, not into it (${(sn * dx + cs * dz).toFixed(2)})`);
  // C11: the shared clock steps back mid-life - the door stays open
  w.clock -= 10 * CAGE_DOOR_MS;
  b.frame(0);
  assert.equal(b.state().door, CAGE_DOOR_OPEN, 'never drawn shut again');
  // a player across the field hears nothing
  const far = [];
  const f2 = rig({ say: (t) => far.push(t), feet: () => [9999, 0, 9999] });
  f2.b.frame(0); f2.w.clock += BROKER_SHUT_SEEN_MS; f2.b.frame(0); f2.w.free = true; f2.b.frame(0);
  assert.equal(f2.b.state().caged, false);
  assert.deepEqual(far, [], 'beyond BROKER_FREED_SAY_M');
  assert.equal(BROKER_FREED_SAY_M, 60);
  // a page opened on an open cage: open, no swing, no line
  const late = [];
  const f3 = rig({ say: (t) => late.push(t), feet: () => me });
  f3.w.free = true;
  f3.b.frame(0);
  assert.equal(f3.b.state().door, CAGE_DOOR_OPEN, 'open already');
  assert.deepEqual(late, []);
  // the hub's word a moment behind a page's first frame: the same
  const soon = [];
  const f4 = rig({ say: (t) => soon.push(t), feet: () => me });
  f4.b.frame(0); f4.w.clock += BROKER_SHUT_SEEN_MS - 1; f4.w.free = true; f4.b.frame(0);
  assert.equal(f4.b.state().door, CAGE_DOOR_OPEN);
  assert.deepEqual(soon, [], 'within BROKER_SHUT_SEEN_MS: no line');
  // C8: the hub's word late behind the page's first sight of her (the omen's own fallback) - opened before it saw her shut
  const stale = [];
  let clearedAt = NaN;
  const f5 = rig({ say: (t) => stale.push(t), feet: () => me, freedAt: () => clearedAt });
  f5.b.frame(0);
  clearedAt = f5.w.clock - 60_000;   // the hub cleared it a minute before this page came
  f5.w.clock += BROKER_SHUT_SEEN_MS + 5000; f5.w.free = true; f5.b.frame(0);
  assert.equal(f5.b.state().door, CAGE_DOOR_OPEN, 'open already: no swing');
  assert.deepEqual(stale, [], 'and nothing said');
  const fresh = [];
  const f6 = rig({ say: (t) => fresh.push(t), feet: () => me, freedAt: () => clearedAt });
  f6.b.frame(0);
  f6.w.clock += BROKER_SHUT_SEEN_MS + 5000; clearedAt = f6.w.clock; f6.w.free = true; f6.b.frame(0);
  assert.deepEqual(fresh, [BROKER_TEXT.freed], 'opened after it was seen shut: said');
  // the next day's breach: a cage shut again
  w.free = false;
  const T2 = gateTimes(DAY + 1);
  w.site = { day: DAY + 1, px: 300, py: 200 }; w.clock = T2.omenAt + 1000;
  b.frame(0);
  assert.equal(b.state().caged, true, 'a new day\'s cage');
  assert.equal(b.state().door, 0);
});

test('SET7 the ray finds her - BROKER-CAGE (AUDIT C2, C3, C5): a player walked up against her cage by the motor itself, on every side, finds her with the pick, caged and free; free, from inside her open doorway too; from across the field she is found and too far; and her box never takes a press aimed at a body lying by her cage (mutants: a box her cage\'s whole round any turn - an eye at the bars inside it; her own box once free - hidden by the walls; a flat\'s box - the doorway pressed for nothing)', () => {
  shift = 0;
  const col = new Collider(() => 21);
  const { b, w } = rig({ collider: () => col });
  const at = b.frame(0);
  assert.equal(b.state().post, true, 'her post stands');
  assert.equal(b.state().cage, true, 'her cage stands');
  const cs = Math.cos(at.rest), sn = Math.sin(at.rest);
  const scene = (lx, lz) => [at.feet[0] + cs * lx + sn * lz, 21, at.feet[2] - sn * lx + cs * lz];
  const local = (p) => { const dx = p[0] - at.feet[0], dz = p[2] - at.feet[2]; return [cs * dx - sn * dz, sn * dx + cs * dz]; };
  /** Walk a body from 4 m out on a bearing of the cage's frame toward her, a small step at a time, until it stops. */
  const walkUp = (deg) => {
    const a = (deg * Math.PI) / 180, p = scene(Math.sin(a) * 4, Math.cos(a) * 4);
    for (let i = 0; i < 80; i++) { const dx = at.feet[0] - p[0], dz = at.feet[2] - p[2], l = Math.hypot(dx, dz); col.move(p, (dx / l) * 0.05, 0, (dz / l) * 0.05); }
    return p;
  };
  const pressFrom = (p) => {
    const eye = [p[0], p[1] + 1.6, p[2]], dir = [at.feet[0] - eye[0], at.feet[1] + 1.1 - eye[1], at.feet[2] - eye[2]], l = Math.hypot(...dir);
    return pickActivatableHit(eye, dir.map((x) => x / l), b.targets(), col);
  };
  for (const state of ['caged', 'free']) {
    if (state === 'free') { w.free = true; b.frame(0); }
    for (const deg of [20, 45, 90, 135, 180, 225, 270, 315]) {
      const p = walkUp(deg), [lx, lz] = local(p);
      if (state === 'caged' || deg !== 20) assert.ok(Math.max(Math.abs(lx), Math.abs(lz)) > CAGE_W / 2, `${state}, bearing ${deg}: the walls held the body outside`);   // free, 20 degrees off the door's line slides in through it
      const hit = pressFrom(p);
      assert.ok(hit && hit.key === 'broker:812' && hit.distance < hit.reach, `${state}, bearing ${deg}: pressed from against the bars (${hit ? hit.distance.toFixed(2) : 'nothing'})`);
    }
  }
  // free: in through her open door, and pressed from her doorway
  const p = walkUp(0), [, lz] = local(p);
  assert.ok(lz < CAGE_D / 2, `walked in through the open door (${lz.toFixed(2)})`);
  const inside = pressFrom(p);
  assert.ok(inside && inside.key === 'broker:812' && inside.distance < inside.reach, 'pressed from her doorway - the first surface inside her box is hers');
  const far = pickActivatableHit([at.feet[0], at.feet[1] + 1.6, at.feet[2] + 30], [0, 0, -1], b.targets(), col);
  assert.ok(far && far.distance > far.reach, 'across the field: found, and too far - the arm says so');
  // C5: a body lying by her cage, outside its bars, is the press's - her box ends at her walls
  for (const deg of [0, 45, 90]) {
    const a = (deg * Math.PI) / 180, [cx, , cz] = scene(Math.sin(a) * 1.8, Math.cos(a) * 1.8);
    const corpse = { key: 'corpse:1', aabb: { min: [cx - 0.35, 21, cz - 0.35], max: [cx + 0.35, 21.4, cz + 0.35] }, distance: 3.2, reach: 3.2 };
    const [ex, , ez] = scene(Math.sin(a) * 3.4, Math.cos(a) * 3.4), eye = [ex, 22.7, ez];
    const dir = [cx - eye[0], 21.2 - eye[1], cz - eye[2]], l = Math.hypot(...dir), d = dir.map((x) => x / l);
    const race = raceActivation({ corpse: pickActivatableHit(eye, d, [corpse], col), broker: pickActivatableHit(eye, d, b.targets(), col) });
    assert.equal(race.brokerWins, false, `bearing ${deg}: a body by her cage is looted, not her`);
  }
  assert.ok(BROKER_BODY_R < BROKER_BOX_HX && BROKER_BODY_H < BROKER_BOX_H, 'her post inside her box');
});

test('SET7 her post: a body in the collider under its own bucket, restood when she moves (a recentre), taken down when she goes and at a transition; a player walks into her, not through (mutants: the post never taken down; a post stood every frame; no post at all)', () => {
  shift = 0;
  const calls = [];
  const col = { addMesh: (k, p, i, m) => calls.push(['add', k, m[12], m[13], m[14]]), removeBucket: (k) => calls.push(['remove', k]) };
  const { b, w } = rig({ collider: () => col });
  const posts = () => calls.filter((c) => c[1] === BROKER_BUCKET);
  b.frame(0);
  const at = b.state().at;
  assert.deepEqual(posts(), [['add', BROKER_BUCKET, ...at.feet.map(Math.fround)]], 'stood at her feet (the matrix a Float32Array)');
  b.frame(0); b.frame(0);
  assert.equal(posts().length, 1, 'not stood again while she stays');
  shift = -40;   // a floating-origin recentre moves the land
  b.frame(0);
  assert.equal(posts().length, 3, 'restood where she moved');
  assert.deepEqual(posts()[1], ['remove', BROKER_BUCKET]);
  assert.equal(posts()[2][2], Math.fround(b.state().at.feet[0]));
  w.site = null;
  b.frame(0);
  assert.deepEqual(posts()[3], ['remove', BROKER_BUCKET], 'taken down when she goes');
  assert.equal(b.state().post, false);
  b.frame(0);
  assert.equal(posts().length, 4, 'and not asked again');
  w.site = SITE;
  b.frame(0);
  b.destroyAll();
  assert.deepEqual(posts().at(-1), ['remove', BROKER_BUCKET], 'a transition takes it down');
  assert.equal(b.state().at, null);
  shift = 0;
  // a real collider: the capsule walks into her
  const c = new Collider(() => 21);
  const { b: b2 } = rig({ collider: () => c });
  const f = b2.frame(0).feet;
  b2.frame(0);
  const moved = [f[0], 21, f[2] + 0.9];   // inside her cage, beside her
  c.move(moved, 0, 0, -2);
  assert.ok(moved[2] > f[2] + BROKER_BODY_R, `stopped at her post, not walked through: ${moved[2].toFixed(2)} vs ${f[2].toFixed(2)}`);
  assert.equal(BROKER_POST.indices.length, 36, 'twelve triangles');
});

test('BROKER-CAGE her cage in the collider: its walls under their own bucket, its shut door under another - a body walks into the bars from every side and never through; the door taken down the frame it opens, and a body walks in to her; restood when she moves, down when she goes and at a transition (mutants: no walls; the door left up once open; the door never up; walls stood every frame)', () => {
  shift = 0;
  const calls = [];
  const log = { addMesh: (k) => calls.push(['add', k]), removeBucket: (k) => calls.push(['remove', k]) };
  const { b, w } = rig({ collider: () => log });
  b.frame(0);
  assert.deepEqual(calls.filter((c) => c[1] !== BROKER_BUCKET), [['add', BROKER_CAGE_BUCKET], ['add', BROKER_DOOR_BUCKET]], 'its walls and its shut door');
  b.frame(0); b.frame(0);
  assert.equal(calls.filter((c) => c[1] !== BROKER_BUCKET).length, 2, 'not stood again while she stays');
  w.free = true;
  b.frame(0);
  assert.deepEqual(calls.at(-1), ['remove', BROKER_DOOR_BUCKET], 'the door down the frame it opens');
  b.frame(0);
  assert.equal(b.state().doorUp, false);
  shift = -40;
  b.frame(0);
  assert.deepEqual(calls.slice(-2), [['remove', BROKER_CAGE_BUCKET], ['add', BROKER_CAGE_BUCKET]], 'restood where she moved - open, no door');
  w.site = null;
  b.frame(0);
  assert.ok(calls.slice(-2).some((c) => c[0] === 'remove' && c[1] === BROKER_CAGE_BUCKET), 'down when she goes');
  w.site = SITE;
  b.frame(0);
  b.destroyAll();
  assert.ok([BROKER_BUCKET, BROKER_CAGE_BUCKET, BROKER_DOOR_BUCKET].every((k) => calls.slice(-3).some((c) => c[0] === 'remove' && c[1] === k)), 'a transition takes all three down');
  assert.equal(b.state().cage, false);
  // a real collider: the bars hold from every side while the door is shut; open, a body walks in
  shift = 0;
  const c = new Collider(() => 21);
  const r = rig({ collider: () => c });
  const at = r.b.frame(0);
  const cs = Math.cos(at.rest), sn = Math.sin(at.rest);
  const scene = (lx, lz) => [at.feet[0] + cs * lx + sn * lz, 21, at.feet[2] - sn * lx + cs * lz];
  const local = (p) => { const dx = p[0] - at.feet[0], dz = p[2] - at.feet[2]; return [cs * dx - sn * dz, sn * dx + cs * dz]; };
  // AUDIT BROKER-CAGE T1: both front walls, either side of the door, as well as the door and the three sides - each held at
  // its outer face (a body inside a wall slab passes nowhere)
  const held = CAGE_W / 2 + CAGE_WALL_OUT + CAPSULE_RADIUS - 0.02;
  for (const [lx, lz, mx, mz, what] of [[0, 3, 0, -2, 'the door'], [0, -3, 0, 2, 'the back'], [3, 0, -2, 0, 'a side'], [-3, 0, 2, 0, 'the other side'], [0.8, 3, 0, -2, 'the bars right of the door'], [-0.8, 3, 0, -2, 'the bars left of the door']]) {
    const p = scene(lx, lz), m = scene(lx + mx, lz + mz);
    c.move(p, m[0] - p[0], 0, m[2] - p[2]);
    const [qx, qz] = local(p);
    assert.ok(Math.abs(qx) > held || Math.abs(qz) > held, `${what}: held outside the bars (${qx.toFixed(2)}, ${qz.toFixed(2)})`);
  }
  // AUDIT BROKER-CAGE C10: its roof - a body dropped onto it stays on it
  const top = [at.feet[0], 21 + CAGE_H + 1, at.feet[2]];
  c.move(top, 0, -2, 0);
  assert.ok(top[1] > 21 + CAGE_H, `on its roof, not in it (${(top[1] - 21).toFixed(2)})`);
  r.w.free = true;
  r.b.frame(0);
  const p = scene(0, 3), m = scene(0, 0.9);
  c.move(p, m[0] - p[0], 0, m[2] - p[2]);
  assert.ok(local(p)[1] < CAGE_D / 2 - 0.2, `open: walked in through the door (${local(p)[1].toFixed(2)})`);
});

test('AUDIT BROKER-CAGE G6: her cage on a slope - its bars down to the lowest ground under its corners and CAGE_FOOT_UNDER beyond (never less than CAGE_FOOT), its door\'s sill over the highest ground its leaf sweeps; its meshes made again when either moves, the old ones let go (mutants: a fixed foot; a fixed sill; the meshes made once for ever)', () => {
  shift = 0;
  const art = fakeArt();
  let slope = 0, rise = 0;
  const { b, w } = rig({ ...art, heightAt: (x, z) => 21 + slope * (x - at0.feet[0]) + rise });
  let at0 = { feet: [0, 0, 0] };
  at0 = b.frame(0);
  assert.equal(b.state().foot, CAGE_FOOT, 'flat ground: the least foot');
  assert.equal(b.state().sill, CAGE_SILL, 'and the least sill');
  assert.equal(art.meshes.length, 2);
  // a slope of 1 in 2 across the land
  slope = 0.5; rise = 0.001;   // the land moves under her (a finer pixel) - read at the next reading
  for (let i = 0; i < BROKER_GROUND_EVERY + 1; i++) b.frame(0);
  const st = b.state(), at = st.at;
  const cs = Math.cos(at.rest), sn = Math.sin(at.rest), f = at.feet;
  const g = (lx, lz) => 21 + slope * (f[0] + cs * lx + sn * lz - at0.feet[0]) + rise - f[1];
  const c = CAGE_W / 2 + CAGE_POST / 2, low = Math.min(g(-c, -c), g(c, -c), g(c, c), g(-c, c));
  assert.ok(near(st.foot, Math.round(Math.max(CAGE_FOOT, CAGE_FOOT_UNDER - low) * 100) / 100, 1e-9) && st.foot > CAGE_FOOT, `down to the lowest corner and beyond (${st.foot})`);
  const [jx, jz] = cageHinge();
  let high = -Infinity;
  for (let i = 0; i <= 4; i++) { const a = (CAGE_DOOR_OPEN * i) / 4; for (const u of [CAGE_LEAF_W / 3, (2 * CAGE_LEAF_W) / 3, CAGE_LEAF_W]) high = Math.max(high, g(jx + Math.cos(a) * u, jz - Math.sin(a) * u)); }
  assert.ok(near(st.sill, Math.round(Math.max(CAGE_SILL, high + CAGE_SILL_OVER) * 100) / 100, 1e-9), `its sill over the ground its leaf sweeps (${st.sill})`);
  assert.equal(art.meshes.length, 4, 'its meshes made again');
  assert.deepEqual(art.destroyed, art.meshes.slice(0, 2), 'the old ones let go');
  let lowest = Infinity;
  const cageModel = art.meshes[2].model;
  for (let i = 1; i < cageModel.positions.length; i += 3) lowest = Math.min(lowest, cageModel.positions[i]);
  assert.ok(near(lowest, -st.foot, 1e-5), 'the bars as deep as the foot');
  w.clock += 1;
  b.frame(0);
  assert.equal(art.meshes.length, 4, 'not again while the ground stays');
});

test('SET7 AUDIT W1: her post never rises around a body - held back while a player stands where it would stand, asked again every frame, and stood the frame they step off; the player walks away from her spot through the motor itself (mutants: the post stood over a player; the hold never let go; the footprint missing the capsule) - BROKER-CAGE: nor her cage\'s walls around a body inside them', () => {
  shift = 0;
  const at = [10, 5, 10];
  assert.equal(postTraps(at, [10, 5, 10]), true, 'on her spot');
  assert.equal(postTraps(at, [10 + BROKER_BODY_R + CAPSULE_RADIUS - 0.01, 5, 10]), true, 'the capsule\'s edge inside the post');
  assert.equal(postTraps(at, [10 + BROKER_BODY_R + CAPSULE_RADIUS + 0.01, 5, 10]), false, 'clear of it');
  assert.equal(postTraps(at, [10, 5 + BROKER_BODY_H + 0.01, 10]), false, 'above its top');
  assert.equal(postTraps(at, [10, 5 - CAPSULE_HEIGHT - 0.01, 10]), false, 'below its foot');
  assert.equal(postTraps(at, null), false, 'no body');
  const edge = CAGE_W / 2 + CAGE_WALL_OUT + CAPSULE_RADIUS;
  for (const rest of [0, 0.7, -2.1]) {
    const c = Math.cos(rest), s = Math.sin(rest), w = (lx, lz) => [at[0] + c * lx + s * lz, 5, at[2] - s * lx + c * lz];
    assert.equal(cageTraps(at, rest, w(0.8, 0.8)), true, `rest ${rest}: inside her cage`);
    assert.equal(cageTraps(at, rest, w(edge - 0.01, 0)), true, 'the capsule\'s edge in its wall');
    assert.equal(cageTraps(at, rest, w(edge + 0.01, 0)), false, 'clear of it');
    assert.equal(cageTraps(at, rest, w(0, CAGE_D / 2 + CAGE_WALL_OUT + CAPSULE_RADIUS + 0.01)), false, 'clear of its door');
  }
  assert.equal(cageTraps(at, 0, [10, 5 + CAGE_H + 0.01, 10]), false, 'above it');
  assert.equal(cageTraps(at, 0, null), false, 'no body');
  const c = new Collider(() => 21);
  let me = null;
  const { b } = rig({ collider: () => c, feet: () => me });
  const spot = brokerPlace(SITE, HOLDS, tr, () => 21).feet;
  me = [spot[0] + 0.05, 21, spot[2] - 0.05];   // standing on her spot as the omen stands her
  b.frame(0);
  assert.equal(b.state().at !== null, true, 'she stands');
  assert.equal(b.state().post, false, 'her post held back');
  assert.equal(b.state().cage, false, 'and her cage');
  b.frame(0);
  assert.equal(b.state().post, false, 'still held while they stand there');
  c.move(me, 4, 0, 0);   // they walk off - nothing holds them
  assert.ok(me[0] > spot[0] + edge, `walked off: ${(me[0] - spot[0]).toFixed(2)} m`);
  b.frame(0);
  assert.equal(b.state().post, true, 'stood the frame they stepped off');
  assert.equal(b.state().cage, true, 'and her cage');
});

test('BROKER-CAGE midnight takes her from under her open window: the host shuts it and she says she is gone - once, and only when a window was up; a breach lost (the omen gone) the same; a page asleep across midnight that wakes on the next day\'s cage the same (AUDIT BROKER-CAGE C12); AUDIT W3: a frame her pixel answers no ground hides her and shuts nothing; AUDIT BROKER-CAGE C7: her ground read every BROKER_GROUND_EVERY frames and when the land moves, never every frame (mutants: the window left open on nothing; the line said with no window; a rebuilt pixel shutting the sale; yesterday\'s window left open; the ground read every frame)', () => {
  const said = [];
  let windowUp = true, shuts = 0;
  const { b, w } = rig({ say: (t) => said.push(t), gone: () => { shuts++; const was = windowUp; windowUp = false; return was; } });
  w.free = true;
  w.clock = T.wrathAt - 1;
  b.frame(0);
  w.clock = T.wrathAt;
  b.frame(0);
  assert.equal(shuts, 1);
  assert.deepEqual(said, [BROKER_TEXT.gone]);
  assert.equal(BROKER_TEXT.gone, 'The Sigil Broker leaves for the night.');
  b.frame(0);
  assert.equal(shuts, 1, 'once');
  w.clock = T.wrathAt - 1;
  b.frame(0);
  w.site = null;
  b.frame(0);
  assert.equal(shuts, 2, 'asked again when she goes again');
  assert.equal(said.length, 1, 'no window up: nothing said');
  windowUp = true;
  w.site = SITE;
  b.frame(0);
  w.ground = NaN;   // her pixel rebuilt under her: no ground, read at the next reading
  for (let i = 0; i < BROKER_GROUND_EVERY; i++) b.frame(0);
  assert.equal(b.stands(), false, 'unseen while her pixel answers nothing');
  assert.equal(shuts, 2, 'and the window left alone');
  w.ground = 21;
  b.frame(0);
  assert.equal(b.stands(), true, 'back when the pixel is built - an unknown ground is read every frame');
  // C12: asleep across midnight, woken on the next day's cage with yesterday's window up
  windowUp = true;
  const T2 = gateTimes(DAY + 1);
  w.site = { day: DAY + 1, px: 300, py: 200 }; w.clock = T2.omenAt + 1000;
  b.frame(0);
  assert.equal(shuts, 3, 'yesterday\'s window shut');
  assert.equal(said.at(-1), BROKER_TEXT.gone);
  // C7: the ground read when the land moves and every BROKER_GROUND_EVERY frames - and her cage's shape once a place
  let reads = 0;
  const g = rig({ heightAt: () => { reads++; return 21; } });
  g.b.frame(0);
  const first = reads;
  assert.ok(first >= 1, 'read at once');
  for (let i = 1; i < BROKER_GROUND_EVERY; i++) g.b.frame(0);
  assert.equal(reads, first, 'not every frame');
  g.b.frame(0);
  assert.equal(reads, first + 1, 'read again at BROKER_GROUND_EVERY');
  shift = 3; g.b.frame(0); shift = 0;
  assert.ok(reads > first + 1, 'and at once when the land moves under her (a recentre)');
  assert.equal(BROKER_GROUND_EVERY, 15);
});

test('SET7 the race: the Broker is a family of her own - she beats what is behind her and loses to what is before her, is the ground\'s rival for a person behind her, and at an exact tie comes right after the gate and before the camp, in the press and the plaque alike (mutants: the Broker left out of the rival; the tie order off)', () => {
  const at = (key, distance, reach = 3.2) => ({ key, distance, reach });
  const broker = at('broker:812', 4, 6.4);
  assert.equal(raceActivation({ broker }).brokerWins, true);
  assert.equal(raceActivation({ broker, doorDistance: 2 }).brokerWins, false, 'a nearer door');
  assert.equal(raceActivation({ broker, camp: at('camp:1', 6) }).brokerWins, true, 'a camp behind her');
  assert.equal(raceActivation({ broker, camp: at('camp:1', 6) }).campWins, false);
  assert.equal(raceActivation({ broker, personDistances: [9] }).nonPersonRival, 4, 'a person behind her must beat her');
  assert.equal(raceActivation({ broker, gate: at('gate:812', 4) }).gateWins, true, 'a tie with the gate: the gate');
  assert.equal(raceActivation({ broker, gate: at('gate:812', 4) }).brokerWins, false);
  assert.equal(raceActivation({ broker, camp: at('camp:1', 4) }).brokerWins, true, 'a tie with a camp: hers');
  assert.equal(raceWinner({ broker, camp: at('camp:1', 4) }), broker);
  assert.equal(raceWinner({ broker, gate: at('gate:812', 4) }).key, 'gate:812');
  assert.equal(raceActivation({}).brokerWins, false, 'no Broker never wins');
});


test('SET7 the host\'s seams: online alone (with the omen), stood each frame right after the gate, on the flats\' axis in the street, raced and armed after the gate in the press, raced and named after it in the plaque, the sale through the law behind the pack\'s carry gate and its clink, the stock and the record the shared clock\'s day, the record in every host\'s save, the window\'s chunk warmed with the doors (mutants: each seam removed) - BROKER-CAGE: her site the omen\'s cage site, her freedom the rite\'s cleared word, her cage drawn beside the circle', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const sigilBroker = gateOmen \? createSigilBroker\(\{/, 'with the omen: online alone');
  assert.match(w, /site: \(\) => gateOmen\.cageSite\(\),/, 'BROKER-CAGE: the breach the clock is about, omen to midnight');
  assert.match(w, /freed: \(day, px, py\) => _relayKeepsRite === false \|\| !!riteHost\?\.isCleared\(day, px, py, _relayKeepsCage !== true\),/, 'BROKER-CAGE: free once every one of the faithful fell - AUDIT C6: the hub\'s word alone where the relay says it; C4: free where the relay stands no faithful');
  assert.match(w, /freedAt: \(day, px, py\) => riteHost\?\.clearedAt\(day, px, py\) \?\? NaN,/, 'AUDIT C8: when the hub said it');
  assert.match(w, /const onRelayVersion = \(v\) => \{ _relayKeepsRite = relaySupportsRite\(v\); _relayKeepsCage = relaySupportsCage\(v\);/, 'AUDIT C4, C6: read off every welcome\'s relay');
  assert.match(w, /let _relayKeepsRite = null, _relayKeepsCage = null;/, 'unknown until a welcome says - caged meanwhile');
  assert.match(w, /heightAt: \(x, z\) => surfaceAt\(x, z\),/, 'the drawn ground, as the circle stands on');
  assert.match(w, /site: \(\) => gateOmen\.cageSite\(\),[^\n]*\n(?:[^\n]*\n){0,12}\s*say: \(text\) => townTalk\.say\(text\),/, 'AUDIT W4: her words to the HUD\'s lines, as a static NPC\'s Info says');
  assert.match(w, /if \(_torchesMode === 'exterior'\) \{ closeBrokerDoor\(\); sigilBroker\?\.destroyAll\(\); \}/, 'AUDIT W2: the street left - her window shut and her post down');
  assert.match(w, /gone: \(\) => closeBrokerDoor\(\),/, 'midnight: her window shut');
  assert.match(w, /riteHost\?\.draw\(renderer, null, mwv\.eye\);[^\n]*\n\s*sigilBroker\?\.draw\(renderer\);/, 'BROKER-CAGE: her cage drawn beside the circle');
  const gateFrame = w.indexOf('try { if (gatePool?.frame(dt)) warmGateVeil(); }'), brokerFrame = w.indexOf('try { sigilBroker?.frame(dt); }');
  assert.ok(gateFrame > 0 && brokerFrame > gateFrame && brokerFrame - gateFrame < 400, 'stood right after the gate');
  assert.match(w, /if \(sigilBroker && _mode\(\) === 'exterior'\) livePersonBatches\.push\(\.\.\.sigilBroker\.batches\(\)\);/);
  assert.match(w, /const _brokerPick = sigilBroker \? pickActivatableHit\(cam\.pos, useFwd, sigilBroker\.targets\(\), collider\) : null;/);
  assert.match(w, /else if \(_race\.brokerWins\) \{ if \(_brokerPick\.distance > _brokerPick\.reach\) setMidScreenText\(tooFarAwayText\(\)\); else sigilBroker\.activate\(_brokerPick\.key, getInteractionMode\(\)\); \}/, 'the arm after the gate\'s, refusing out loud past her reach');
  assert.ok(w.indexOf('if (_race.gateWins)') < w.indexOf('else if (_race.brokerWins)') && w.indexOf('else if (_race.brokerWins)') < w.indexOf('else if (_race.campWins)'), 'the arms in the race\'s tie order');
  assert.match(w, /broker: sigilBroker \? pickActivatableHit\(cam\.pos, _hd, sigilBroker\.targets\(\), collider\) : null,/, 'the plaque races her');
  assert.match(w, /\(key\) => gatePool\?\.hoverName\(key\) \?\? null,[^\n]*\n\s*\(key\) => sigilBroker\?\.hoverName\(key\) \?\? null,/, 'and names her, after the gate');
  assert.match(w, /const sale = makeBrokerSale\(offer, \{\s*\n\s*items: playerEntity\.items, day: brokerDay\(_brokerNow\(\)\),\s*\n\s*canCarry: \(item, rest\) => planTake\(item, \{ bag: rest, entity: playerEntity, dryRun: true \}\)\.ok,/, 'the sale through the law, behind the pack\'s carry gate');
  assert.match(w, /if \(!sigilBroker\?\.stands\(\) \|\| _mode\(\) !== 'exterior'\) return \{ ok: false, reason: 'gone' \};/, 'a window on her gone or caged sells nothing, nor one carried off the street (AUDIT W2)');
  assert.match(w, /audio\.playOneShot\(SOUND\.GoldPieces, 1\);\s*\n\s*surfacePlayer\(\);\s*\n\s*return sale;/, 'a concluded deal clinks');
  assert.match(w, /items: \(\) => spendableStonesIn\(playerEntity\.items \?\? \[\]\), locked: \(\) => stoneCount\(lockedStonesIn\(playerEntity\.items \?\? \[\]\)\),/, 'the purse: the stones a sale may spend, and the locked ones beside them - counted over their stacks (SS1)');
  assert.match(w, /if \(win\) townTalk\.showOverlay\(win\);/);
  assert.match(w, /const _brokerNow = \(\) => Date\.now\(\) \+ _sharedOffsetMs;/, 'the shared clock\'s day, never this machine\'s');
  assert.match(read('src/scenes/shared.js'), /import '\.\.\/systems\/sigilBroker\.js';/, 'the record\'s save slot in every host');
  assert.match(read('src/ui/enhancedChunk.js'), /\(\) => import\('\.\/brokerWindow\.js'\),/, 'warmed with the doors');
  const door = read('src/ui/brokerDoor.js');
  assert.match(door, /load: \(\) => import\('\.\/brokerWindow\.js'\),/, 'the door\'s chunk through the one home');
});
