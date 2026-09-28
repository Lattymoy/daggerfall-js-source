// SET7 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 7; Mac: "Sigil stones become a currency to
// trade for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate"): THE SIGIL BROKER IN THE
// WORLD (scenes/sigilBrokerPool.js) - where she stands off the gate's own frame and only while it stands whole, her
// turn to a player near her, her body (the Seducer's idle, on the flats' axis), her post in the collider, her eye's box,
// her plaque and her press; the race she runs in (player/activationRace.js); and the host's seams (scenes/world.js).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createSigilBroker, brokerPlace, brokerFacing, turnToward, postTraps, BROKER_SPOT, BROKER_MOBILE, BROKER_REACH, BROKER_HALF_W, BROKER_H,
  BROKER_NOTICE_M, BROKER_TURN_RATE, BROKER_TEXT, BROKER_BUCKET, BROKER_POST, BROKER_BODY_R, BROKER_BODY_H,
} from '../src/scenes/sigilBrokerPool.js';
import { gateLocal, inGateRoot } from '../src/scenes/gatePool.js';
import { raceActivation, raceWinner } from '../src/player/activationRace.js';
import { pickActivatableHit, RAY_DISTANCE, STATIC_NPC_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { composeNamer } from '../src/systems/worldHover.js';
import { PLINTH_R } from '../src/world/gateModel.js';
import { IDLE_ANIMS } from '../src/characters/mobileUnit.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { Collider } from '../src/player/collider.js';
import { CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../src/player/motor.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
/** A gate's place, as gatePool.js gatePlacement answers one. */
const placeOf = (over = {}) => ({ day: 812, phase: 'open', origin: [100, 20, -40], ground: 20, yaw: 0.7, fade: 1, risen: true, coarse: false, ...over });

test('SET7 where she stands: the spot in the gate\'s own frame carried into the scene - off the plinth, clear of the horns\' roots - on the ground there (the gate\'s foot where the ground answers nothing), facing out of the gate; nowhere while the gate climbs, sinks or stands a beacon alone (mutants: the spot turned the wrong way; the ground under the gate taken for hers; a Broker by a sinking gate; a Broker by a beacon)', () => {
  for (const yaw of [0, 0.7, -2.1, Math.PI]) {
    const place = placeOf({ yaw });
    const at = brokerPlace(place, () => 23.5);
    const [lx, ly, lz] = gateLocal(place, at.feet);
    assert.ok(near(lx, BROKER_SPOT.lx, 1e-9) && near(lz, BROKER_SPOT.lz, 1e-9), `yaw ${yaw}: the spot, in the gate's frame`);
    assert.equal(ly, 3.5, 'on the ground there');
    assert.equal(at.rest, yaw, 'facing out of the gate');
    assert.equal(at.day, 812);
    assert.equal(inGateRoot(place, at.feet), false, 'clear of the horns\' roots');
  }
  assert.ok(Math.hypot(BROKER_SPOT.lx, BROKER_SPOT.lz) > PLINTH_R + 1, 'off the plinth, a body\'s width and more');
  assert.equal(brokerPlace(placeOf(), () => NaN).feet[1], 20, 'the ground answers nothing: the gate\'s foot');
  assert.equal(brokerPlace(placeOf({ risen: false, phase: 'rising' }), () => 0), null, 'the gate still climbing');
  assert.equal(brokerPlace(placeOf({ phase: 'collapsing' }), () => 0), null, 'the gate sinking - from its first frame');
  assert.equal(brokerPlace(placeOf({ coarse: true }), () => 0), null, 'a beacon alone');
  assert.equal(brokerPlace(null, () => 0), null, 'no gate');
  for (const phase of ['sealed', 'open', 'closed']) assert.ok(brokerPlace(placeOf({ phase }), () => 0), `${phase}: she stands`);
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

/** A fake renderer and texture: the court's own billboard seam (createBillboardBatch, textures.has). */
function fakeArt() {
  const uploads = [];
  const tex = { archive: 284, getFrameCount: () => 1, getSize: (r) => ({ width: 26, height: r === 15 ? 86 : 82 }), getScale: () => ({ width: 0, height: 0 }) };
  const renderer = {
    textures: new Set(),
    createBillboardBatch: (archive, record, size, positions) => ({ archive, record, size, positions, bounds: [0, 0, 0, 1] }),
  };
  return { renderer, tex, uploads, getTexture: async (a) => (a === 284 ? tex : null), uploadRecordFrame: (a, r, f) => { uploads.push([a, r, f]); renderer.textures.add(`${a}_${r}#${f}`); } };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('SET7 her body: the Daedra Seducer\'s mortal guise (EnemyBasics 29, TEXTURE.284), the idle record her yaw and the eye choose, uploaded once, a billboard stood on her feet on the flats\' axis; unseen while it loads, and a sprite that will not load leaves her box and her window (mutants: another mobile\'s sprite; the frame re-uploaded every frame; her billboard off her feet)', async () => {
  assert.equal(BROKER_MOBILE, 29);
  assert.equal(ENEMY_BASICS[BROKER_MOBILE].maleTexture, 284);
  const art = fakeArt();
  let place = placeOf();
  const b = createSigilBroker({ ...art, place: () => place, heightAt: () => 21, cam: () => [0, 0, 0], now: () => 0 });
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
  // the eye walks round her: the record follows the orientation
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const eye = [at.feet[0] + Math.sin(a) * 40, at.feet[1], at.feet[2] + Math.cos(a) * 40];
    const b2 = createSigilBroker({ ...art, place: () => place, heightAt: () => 21, cam: () => eye, now: () => 0 });
    b2.frame(0); await settle(); b2.frame(0);
    seen.add(`${b2.batches()[0].record}${b2.batches()[0].size.w < 0 ? '~' : ''}`);
  }
  assert.ok(seen.size >= 5, `the eight orientations read her five idle records and their flips: ${[...seen].join(' ')}`);
  // a sprite that will not load
  const bad = createSigilBroker({ renderer: art.renderer, uploadRecordFrame: art.uploadRecordFrame, getTexture: async () => null, place: () => place, heightAt: () => 21 });
  const warn = console.warn; console.warn = () => {};
  try { bad.frame(0); await settle(); bad.frame(0); } finally { console.warn = warn; }
  assert.deepEqual(bad.batches(), []);
  assert.equal(bad.state().body, 'failed');
  assert.equal(bad.targets().length, 1, 'her box stands all the same');
  // the gate gone: no body
  place = null;
  b.frame(0);
  assert.deepEqual(b.batches(), []);
});

test('SET7 her box, her plaque, her press: a box about her feet to her crown at a static NPC\'s reach, keyed to the gate\'s day and made once where she stands; the plaque names her and her trade through the hover\'s ladder; Info names her, Steal is watched, anything else opens her window; another key is never hers (mutants: her reach a door\'s; the plaque a bare string; Steal opening her stock; a stale day\'s key pressed)', () => {
  let place = placeOf();
  const said = [];
  let opened = 0;
  const b = createSigilBroker({ place: () => place, heightAt: () => 21, say: (t) => said.push(t), open: () => { opened++; } });
  assert.deepEqual(b.targets(), [], 'no frame yet: no box');
  const at = b.frame(0);
  const [t] = b.targets();
  assert.equal(t.key, 'broker:812');
  assert.equal(t.reach, BROKER_REACH);
  assert.equal(BROKER_REACH, STATIC_NPC_ACTIVATION_DISTANCE, 'PlayerActivate\'s static NPC reach');
  assert.equal(t.distance, RAY_DISTANCE);
  assert.equal(t.noSurface, true, 'a flat: no surface of its own in the collider');
  assert.deepEqual(t.aabb.min, [at.feet[0] - BROKER_HALF_W, at.feet[1], at.feet[2] - BROKER_HALF_W]);
  assert.deepEqual(t.aabb.max, [at.feet[0] + BROKER_HALF_W, at.feet[1] + BROKER_H, at.feet[2] + BROKER_HALF_W]);
  assert.equal(b.targets(), b.targets(), 'made once where she stands');
  const namer = composeNamer([(k) => b.hoverName(k)]);
  assert.deepEqual(namer('broker:812'), { title: 'Sigil Broker', subs: ['Trades in Sigil Stones'] }, 'the ladder takes her record');
  assert.equal(b.hoverName('broker:811'), null, 'yesterday\'s key');
  assert.equal(b.hoverName(7), null, 'a door\'s bare number (AUDIT-WH C1)');
  assert.equal(b.activate('broker:812', 'info'), true);
  assert.deepEqual(said, ['You see the Sigil Broker.']);
  assert.equal(b.activate('broker:812', 'steal'), true);
  assert.equal(said[1], BROKER_TEXT.steal);
  assert.equal(opened, 0, 'neither opens her stock');
  for (const mode of ['grab', 'dialogue']) assert.equal(b.activate('broker:812', mode), true);
  assert.equal(opened, 2, 'Grab and Talk open her window');
  assert.equal(b.activate('broker:811', 'grab'), false, 'a stale day\'s key');
  assert.equal(b.activate('gate:812', 'grab'), false, 'the gate\'s key');
  assert.equal(opened, 2);
  place = null;
  b.frame(0);
  assert.equal(b.activate('broker:812', 'grab'), false, 'she is gone');
  assert.deepEqual(b.targets(), []);
  assert.equal(b.stands(), false);
});

test('SET7 the ray finds her: the pick under the crosshair, at her reach and not past it, and her post never hides her box (mutants: her post outside her box, occluding her; a box at her feet alone)', () => {
  const col = new Collider(() => 21);
  const place = placeOf({ yaw: 0 });
  const b = createSigilBroker({ place: () => place, heightAt: () => 21, collider: () => col });
  const at = b.frame(0);
  assert.equal(b.state().post, true, 'her post stands');
  const eye = [at.feet[0], at.feet[1] + 1.6, at.feet[2] + 5];
  const dir = [0, -0.05, -1];
  const l = Math.hypot(...dir);
  const d = dir.map((x) => x / l);
  const hit = pickActivatableHit(eye, d, b.targets(), col);
  assert.ok(hit, 'the pick finds her through her own post');
  assert.equal(hit.key, 'broker:812');
  assert.ok(hit.distance < hit.reach, 'within her reach');
  const far = pickActivatableHit([at.feet[0], at.feet[1] + 1.6, at.feet[2] + 30], [0, 0, -1], b.targets(), col);
  assert.ok(far && far.distance > far.reach, 'across the field: found, and too far - the arm says so');
  assert.ok(BROKER_BODY_R < BROKER_HALF_W && BROKER_BODY_H < BROKER_H, 'the post inside her box');
});

test('SET7 her post: a body in the collider under its own bucket, restood when she moves (a recentre), taken down when she goes and at a transition; a player walks into her, not through (mutants: the post never taken down; a post stood every frame; no post at all)', () => {
  const calls = [];
  const col = { addMesh: (k, p, i, m) => calls.push(['add', k, m[12], m[13], m[14]]), removeBucket: (k) => calls.push(['remove', k]) };
  let place = placeOf({ yaw: 0 });
  const b = createSigilBroker({ place: () => place, heightAt: () => 21, collider: () => col });
  b.frame(0);
  const at = b.state().at;
  assert.deepEqual(calls, [['add', BROKER_BUCKET, ...at.feet.map(Math.fround)]], 'stood at her feet (the matrix a Float32Array)');
  b.frame(0); b.frame(0);
  assert.equal(calls.length, 1, 'not stood again while she stays');
  place = placeOf({ yaw: 0, origin: [60, 20, -40] });   // a floating-origin recentre moves the gate
  b.frame(0);
  assert.equal(calls.length, 3, 'restood where she moved');
  assert.deepEqual(calls[1], ['remove', BROKER_BUCKET]);
  assert.equal(calls[2][2], Math.fround(b.state().at.feet[0]));
  place = null;
  b.frame(0);
  assert.deepEqual(calls[3], ['remove', BROKER_BUCKET], 'taken down when she goes');
  assert.equal(b.state().post, false);
  b.frame(0);
  assert.equal(calls.length, 4, 'and not asked again');
  place = placeOf({ yaw: 0 });
  b.frame(0);
  b.destroyAll();
  assert.deepEqual(calls.at(-1), ['remove', BROKER_BUCKET], 'a transition takes it down');
  assert.equal(b.state().at, null);
  // a real collider: the capsule walks into her
  const c = new Collider(() => 21);
  const b2 = createSigilBroker({ place: () => placeOf({ yaw: 0 }), heightAt: () => 21, collider: () => c });
  const f = b2.frame(0).feet;
  const moved = [f[0], 21, f[2] + 2];
  c.move(moved, 0, 0, -4);   // the feet, moved in place
  assert.ok(moved[2] > f[2] + BROKER_BODY_R, `stopped at her post, not walked through: ${moved[2].toFixed(2)} vs ${f[2].toFixed(2)}`);
  const beside = [f[0] + 3, 21, f[2] + 2];
  c.move(beside, 0, 0, -4);
  assert.ok(beside[2] < f[2] - 1.5, 'beside her the way is clear');
  assert.equal(BROKER_POST.indices.length, 36, 'twelve triangles');
});

test('SET7 AUDIT W1: her post never rises around a body - held back while a player stands where it would stand, asked again every frame, and stood the frame they step off; the player walks away from her spot through the motor itself (mutants: the post stood over a player; the hold never let go; the footprint missing the capsule\'s radius)', () => {
  const at = [10, 5, 10];
  assert.equal(postTraps(at, [10, 5, 10]), true, 'on her spot');
  assert.equal(postTraps(at, [10 + BROKER_BODY_R + CAPSULE_RADIUS - 0.01, 5, 10]), true, 'the capsule\'s edge inside the post');
  assert.equal(postTraps(at, [10 + BROKER_BODY_R + CAPSULE_RADIUS + 0.01, 5, 10]), false, 'clear of it');
  assert.equal(postTraps(at, [10, 5 + BROKER_BODY_H + 0.01, 10]), false, 'above its top');
  assert.equal(postTraps(at, [10, 5 - CAPSULE_HEIGHT - 0.01, 10]), false, 'below its foot');
  assert.equal(postTraps(at, null), false, 'no body');
  const c = new Collider(() => 21);
  let me = null;
  const b = createSigilBroker({ place: () => placeOf({ yaw: 0 }), heightAt: () => 21, collider: () => c, feet: () => me });
  const spot = brokerPlace(placeOf({ yaw: 0 }), () => 21).feet;
  me = [spot[0] + 0.05, 21, spot[2] - 0.05];   // standing on her spot as the gate stands whole
  b.frame(0);
  assert.equal(b.state().at !== null, true, 'she stands');
  assert.equal(b.state().post, false, 'her post held back');
  b.frame(0);
  assert.equal(b.state().post, false, 'still held while they stand there');
  c.move(me, 0.8, 0, 0);   // they walk off - nothing holds them
  assert.ok(me[0] > spot[0] + BROKER_BODY_R + CAPSULE_RADIUS, `walked off: ${(me[0] - spot[0]).toFixed(2)} m`);
  b.frame(0);
  assert.equal(b.state().post, true, 'stood the frame they stepped off');
  const back = [me[0], 21, me[2]];
  c.move(back, -1.5, 0, 0);
  assert.ok(back[0] > spot[0] + BROKER_BODY_R, 'and now she is solid');
});

test('SET7 the gate falls under her open window: the host shuts it and she says she is gone - once, and only when a window was up; AUDIT W3: a frame the gate stands a beacon (its pixel rebuilt) hides her and shuts nothing (mutants: the window left open on nothing; the line said with no window; a beacon frame shutting the sale)', () => {
  let place = placeOf();
  const said = [];
  let windowUp = true, shuts = 0;
  const b = createSigilBroker({ place: () => place, heightAt: () => 21, say: (t) => said.push(t), gone: () => { shuts++; const was = windowUp; windowUp = false; return was; } });
  b.frame(0);
  place = placeOf({ phase: 'collapsing' });
  b.frame(0);
  assert.equal(shuts, 1);
  assert.deepEqual(said, [BROKER_TEXT.gone]);
  assert.equal(BROKER_TEXT.gone, 'The Sigil Broker is gone with the gate.');
  b.frame(0);
  assert.equal(shuts, 1, 'once');
  place = placeOf();
  b.frame(0);
  place = null;
  b.frame(0);
  assert.equal(shuts, 2, 'asked again when she goes again');
  assert.equal(said.length, 1, 'no window up: nothing said');
  windowUp = true;
  place = placeOf();
  b.frame(0);
  place = placeOf({ coarse: true });   // the gate's pixel rebuilt under her: a beacon for a frame
  b.frame(0);
  assert.equal(b.stands(), false, 'unseen while the gate is a beacon');
  assert.equal(shuts, 2, 'and the window left alone');
  place = placeOf();
  b.frame(0);
  assert.equal(b.stands(), true, 'back when the pixel is built');
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

test('SET7 the host\'s seams: online alone (with the gate), stood each frame right after the gate that places her, on the flats\' axis in the street, raced and armed after the gate in the press, raced and named after it in the plaque, the sale through the law behind the pack\'s carry gate and its clink, the window through its door into the host\'s slot; the record\'s save slot in every host; the window warmed with the doors (mutants: any seam cut)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const sigilBroker = gatePool \? createSigilBroker\(\{/, 'with the gate: online alone');
  assert.match(w, /place: \(\) => gatePool\.place\(\),/, 'placed by the gate\'s own place (AUDIT W5: the record itself, no state object a frame)');
  assert.match(w, /place: \(\) => gatePool\.place\(\),[^\n]*\n(?:[^\n]*\n){0,6}\s*say: \(text\) => townTalk\.say\(text\),/, 'AUDIT W4: her words to the HUD\'s lines, as a static NPC\'s Info says');
  assert.match(w, /if \(_torchesMode === 'exterior'\) \{ closeBrokerDoor\(\); sigilBroker\?\.destroyAll\(\); \}/, 'AUDIT W2: the street left - her window shut and her post down');
  assert.match(w, /gone: \(\) => closeBrokerDoor\(\),/, 'the gate gone: her window shut');
  const gateFrame = w.indexOf('try { if (gatePool?.frame(dt)) warmGateVeil(); }'), brokerFrame = w.indexOf('try { sigilBroker?.frame(dt); }');
  assert.ok(gateFrame > 0 && brokerFrame > gateFrame && brokerFrame - gateFrame < 400, 'stood right after the gate that places her');
  assert.match(w, /if \(sigilBroker && _mode\(\) === 'exterior'\) livePersonBatches\.push\(\.\.\.sigilBroker\.batches\(\)\);/);
  assert.match(w, /const _brokerPick = sigilBroker \? pickActivatableHit\(cam\.pos, useFwd, sigilBroker\.targets\(\), collider\) : null;/);
  assert.match(w, /else if \(_race\.brokerWins\) \{ if \(_brokerPick\.distance > _brokerPick\.reach\) setMidScreenText\(TOO_FAR_AWAY_TEXT\); else sigilBroker\.activate\(_brokerPick\.key, getInteractionMode\(\)\); \}/, 'the arm after the gate\'s, refusing out loud past her reach');
  assert.ok(w.indexOf('if (_race.gateWins)') < w.indexOf('else if (_race.brokerWins)') && w.indexOf('else if (_race.brokerWins)') < w.indexOf('else if (_race.campWins)'), 'the arms in the race\'s tie order');
  assert.match(w, /broker: sigilBroker \? pickActivatableHit\(cam\.pos, _hd, sigilBroker\.targets\(\), collider\) : null,/, 'the plaque races her');
  assert.match(w, /\(key\) => gatePool\?\.hoverName\(key\) \?\? null,[^\n]*\n\s*\(key\) => sigilBroker\?\.hoverName\(key\) \?\? null,/, 'and names her, after the gate');
  assert.match(w, /const sale = makeBrokerSale\(offer, \{\s*\n\s*items: playerEntity\.items, day: brokerDay\(_brokerNow\(\)\),\s*\n\s*canCarry: \(item, rest\) => planTake\(item, \{ bag: rest, entity: playerEntity, dryRun: true \}\)\.ok,/, 'the sale through the law, behind the pack\'s carry gate');
  assert.match(w, /if \(!sigilBroker\?\.stands\(\) \|\| _mode\(\) !== 'exterior'\) return \{ ok: false, reason: 'gone' \};/, 'a window on a gate that fell sells nothing, nor one carried off the street (AUDIT W2)');
  assert.match(w, /audio\.playOneShot\(SOUND\.GoldPieces, 1\);\s*\n\s*surfacePlayer\(\);\s*\n\s*return sale;/, 'a concluded deal clinks');
  assert.match(w, /items: \(\) => spendableStonesIn\(playerEntity\.items \?\? \[\]\), locked: \(\) => stoneCount\(lockedStonesIn\(playerEntity\.items \?\? \[\]\)\),/, 'the purse: the stones a sale may spend, and the locked ones beside them - counted over their stacks (SS1)');
  assert.match(w, /if \(win\) townTalk\.showOverlay\(win\);/);
  assert.match(w, /const _brokerNow = \(\) => Date\.now\(\) \+ _sharedOffsetMs;/, 'the shared clock\'s day, never this machine\'s');
  assert.match(read('src/scenes/shared.js'), /import '\.\.\/systems\/sigilBroker\.js';/, 'the record\'s save slot in every host');
  assert.match(read('src/ui/enhancedChunk.js'), /\(\) => import\('\.\/brokerWindow\.js'\),/, 'warmed with the doors');
  const door = read('src/ui/brokerDoor.js');
  assert.match(door, /load: \(\) => import\('\.\/brokerWindow\.js'\),/, 'the door\'s chunk through the one home');
});
