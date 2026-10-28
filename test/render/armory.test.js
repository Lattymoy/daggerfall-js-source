// ARMORY (2026-10-28, the owner: "Aura armory would allow 1. Head piece 2. Torso 3. Arms 4. Legs 5. Weapon/Duel wield";
// bible/04-Characters/Aura-Armory.md): THE ARMORY'S OWN PINS - the kit's law, the pose a piece hangs on, what each piece
// draws, the world host's gather, and the words the service and the client say alike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ARMORY_SLOTS, ARMORY_PIECES, ARMORY_KEYS, ARMORY_BREACH_PIECES, ARMORY_BREACH_BITS, ARMORY_NAME, armoryKitOk, armoryKitPieces,
  armoryKitOf, armoryKitWith, armoryKitHeld, armoryBreachHeldOf, armoryPieceAt,
} from '../../src/net/armoryLaw.js';
import { ARMORY_TEXT, ARMORY_LOOK, ARMORY_SLOT_TEXT, armoryPieceName } from '../../src/ui/armoryText.js';
import { ARMORY_ODDS } from '../../src/ui/collections/wardrobeCatalogue.js';
import { ARMORY_BREACH_ODDS, ARMORY_BREACH_ODDS_RITE, ARMORY_BREACH_PITY } from '../../server-account/src/armory.js';
import { badged, readArmory } from '../../src/net/wire.js';
import { P, REST_POINTS, newPose, poseFromBones, poseFromFigure, poseAtRest, poseWorld, spriteMarks } from '../../src/render/armoryPose.js';
import {
  armoryDraws, armoryWearers, armoryMotionStep, armoryEyeAtHead, armoryPrograms, armoryRatesWhole, ARMORY_BODY_PIECES, ARMORY_PROGRAMS,
  ARMORY_RANGE_M, ARMORY_DRAW_MAX, ARMORY_TRAIL, ARMORY_STRIDE_M, ArmoryRenderer,
} from '../../src/render/armoryPass.js';
import { createAuraHost, armoryOthersOf, ARMORY_NEAR_M } from '../../src/scenes/auraHost.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';

const rd = (/** @type {string} */ p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('ARMORY the kit: five slot letters, each a piece of its slot or empty, never all empty - and the pieces it names, the kit of a wardrobe, a slot changed, the held left (mutants: a piece in the wrong slot passed; an empty kit a claim; a slot changed beside the one asked)', () => {
  assert.deepEqual(ARMORY_SLOTS, ['head', 'torso', 'arms', 'legs', 'weapon']);
  assert.equal(ARMORY_PIECES.length, 10, 'two lines of five');
  assert.equal(new Set(ARMORY_KEYS).size, 10, 'a key each');
  for (const s of ARMORY_SLOTS) assert.equal(new Set(ARMORY_PIECES.filter((p) => p.slot === s).map((p) => p.code)).size, 2, `${s}: its codes its own`);
  assert.deepEqual(ARMORY_BREACH_PIECES.map((p) => p.key), ['burningcrown', 'emberheart', 'ashbound', 'cinderstride', 'breachbrand']);
  assert.equal(ARMORY_BREACH_BITS, 31, 'a bit each, never shared');
  for (const k of ['a0000', '0b000', 'aaaaa', 'bbbbb', 'ab0ba', '0000b']) assert.equal(armoryKitOk(k), true, k);
  for (const k of ['00000', 'c0000', 'a000', 'a00000', 'A0000', '', null, 12345, undefined]) assert.equal(armoryKitOk(k), false, String(k));
  assert.equal(armoryPieceAt('head', 'a')?.key, 'burningcrown');
  assert.equal(armoryPieceAt('weapon', 'b')?.key, 'eternaledge');
  assert.equal(armoryPieceAt('head', '0'), null);
  assert.deepEqual(armoryKitPieces('ab00b'), { head: 'burningcrown', torso: 'eternalsigil', arms: null, legs: null, weapon: 'eternaledge' });
  assert.deepEqual(armoryKitPieces('nonsense'), { head: null, torso: null, arms: null, legs: null, weapon: null }, 'no kit, all bare');
  assert.equal(armoryKitOf({ head: 'eternalhalo', legs: 'cinderstride' }), 'b00a0');
  assert.equal(armoryKitOf(['emberheart', 'nonsuch']), '0a000', 'a key that is no piece is left out');
  assert.equal(armoryKitOf({}), null, 'nothing worn, no kit');
  assert.equal(armoryKitWith(null, 'arms', 'ashbound'), '00a00', 'a first piece');
  assert.equal(armoryKitWith('00a00', 'head', 'eternalhalo'), 'b0a00', 'only the slot asked moves');
  assert.equal(armoryKitWith('b0a00', 'head', null), '00a00', 'a slot bared');
  assert.equal(armoryKitWith('00a00', 'arms', null), null, 'the last bared - no kit');
  assert.equal(armoryKitWith('00a00', 'head', 'ashbound'), '00a00', 'a piece of another slot changes nothing');
  assert.equal(armoryKitWith('00a00', 'tail', 'ashbound'), '00a00', 'no such slot changes nothing');
  assert.equal(armoryKitHeld('aa0bb', ['burningcrown', 'eternaledge']), 'a000b', 'a piece no longer held is not signed');
  assert.equal(armoryKitHeld('aa000', []), null);
  assert.deepEqual(armoryBreachHeldOf(5), ['burningcrown', 'ashbound']);
  assert.deepEqual(armoryBreachHeldOf(64), [], 'a bit no piece has');
  for (const b of [0, -1, 'x', null, 2 ** 60]) assert.deepEqual(armoryBreachHeldOf(b), [], String(b));
});

test('ARMORY the wire: a peer\'s kit badged only when it is a kit, and read back the same (mutants: any string badged; the badge dropped)', () => {
  assert.equal(badged({}, { ak: 'b0a0b' }).ak, 'b0a0b');
  assert.equal('ak' in badged({}, { ak: 'zzzzz' }), false, 'a kit of no pieces never rides');
  assert.equal('ak' in badged({}, { ak: '00000' }), false, 'nor an empty one');
  assert.equal(readArmory({ ak: 'a0000' }), 'a0000');
  assert.equal(readArmory({ ak: 'a00' }), null);
  assert.equal(readArmory(null), null);
});

test('ARMORY the words: the client\'s English each piece\'s service name, a name and a look for every piece, a name for every slot - and the Breach\'s odds as the service rolls them (mutants: a name drifted; the odds one side only)', () => {
  assert.deepEqual(Object.keys(ARMORY_TEXT), [...ARMORY_KEYS]);
  assert.deepEqual(Object.keys(ARMORY_LOOK), [...ARMORY_KEYS]);
  assert.deepEqual(Object.keys(ARMORY_SLOT_TEXT), [...ARMORY_SLOTS]);
  for (const k of ARMORY_KEYS) {
    assert.equal(ARMORY_TEXT[/** @type {keyof typeof ARMORY_TEXT} */ (k)](), ARMORY_NAME[/** @type {keyof typeof ARMORY_NAME} */ (k)], `${k}: one name`);
    const look = ARMORY_LOOK[/** @type {keyof typeof ARMORY_LOOK} */ (k)]();
    assert.ok(look.split(/\s+/).length <= 40, `${k}: PLAIN-TEXT - a look in 40 words at most`);
  }
  assert.equal(armoryPieceName('nonsuch'), 'nonsuch');
  assert.equal(1 / ARMORY_ODDS.plain, ARMORY_BREACH_ODDS);
  assert.equal(1 / ARMORY_ODDS.rite, ARMORY_BREACH_ODDS_RITE);
  assert.equal(ARMORY_ODDS.pity, ARMORY_BREACH_PITY);
});

test('ARMORY the pose: a rig\'s bones its joints, a sprite\'s figure its card and its upper limbs, the rest pose crouched and saddled, a point turned with the body (mutants: a sprite\'s forearm called measured; the yaw unturned; the picture\'s marks ignored)', () => {
  const pose = newPose();
  assert.equal(poseFromBones(null, pose), false, 'no skeleton, nothing written');
  assert.equal(poseFromBones({ 'bip01 head': [0, 1.7, 0] }, pose), false, 'no shoulders - the wolf');
  const bones = { 'bip01 head': [0, 1.65, 0], 'bip01 neck': [0, 1.5, 0], 'bip01 l upperarm': [-0.2, 1.42, 0], 'bip01 r upperarm': [0.2, 1.42, 0], 'bip01 l forearm': [-0.25, 1.15, 0.02], 'bip01 r calf': [0.1, 0.5, 0] };
  assert.equal(poseFromBones(bones, pose), true);
  assert.deepEqual([...pose.pts.slice(P.elL, P.elL + 3)].map((v) => +v.toFixed(3)), [-0.25, 1.15, 0.02], 'the forearm\'s origin is the elbow');
  assert.deepEqual([...pose.pts.slice(P.knR, P.knR + 3)].map((v) => +v.toFixed(3)), [0.1, 0.5, 0], 'the calf\'s the knee');
  assert.ok(pose.pts[P.crown + 1] > pose.pts[P.head + 1], 'the crown over the head');
  assert.deepEqual([pose.card, pose.limbs], [false, 'full']);
  assert.equal(poseFromFigure(null, pose), false);
  assert.equal(poseFromFigure({ base: 0, mpp: 0.02, marks: null }, pose), true);
  assert.deepEqual([pose.card, pose.limbs], [true, 'upper'], 'a painting has no forearm to measure');
  const marked = newPose();
  poseFromFigure({ base: 0, mpp: 0.02, marks: { top: 100, head: 5, chest: 3, pelvis: 1, beast: null }, shift: 0 }, marked);
  assert.equal(+marked.dx[P.head / 3].toFixed(3), 0.1, 'the head hung where the picture draws it, 5 px off its middle');
  assert.equal(+marked.dx[P.shL / 3].toFixed(3), 0.06, 'the shoulders with the chest');
  assert.equal(+marked.dx[P.ftR / 3].toFixed(3), 0.02, 'the legs with the pelvis');
  poseAtRest(pose, 0.5, true);
  assert.ok(pose.pts[P.head + 1] < REST_POINTS[P.head + 1], 'crouched');
  assert.ok(pose.pts[P.ftL + 1] > 0.5, 'saddled');
  const o = poseWorld(newPose(), 'chest', [10, 0, 10], Math.PI / 2, [0, 0, 0]);
  const fwd = REST_POINTS[P.chest + 2];
  assert.ok(Math.abs(o[0] - (10 + fwd)) < 1e-6 && Math.abs(o[2] - 10) < 1e-6, 'facing +x, the chest\'s forward is +x');
});

test('ARMORY a picture\'s marks: the run nearest the middle at each body row, a staff beside it never the head (mutants: the widest run taken; the narrow-run floor gone)', () => {
  const w = 64, h = 128, px = new Uint32Array(w * h);
  const fill = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ y0, /** @type {number} */ y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * w + x] = 0xff000000; };
  fill(30, 40, 0, 104);   // the body, 3.5 px right of the middle (31.5), its top row 104
  fill(24, 25, 0, 120);   // a staff to its left, two pixels wide, over the head
  const m = spriteMarks(px, w, h);
  assert.ok(m, 'a body stands');
  assert.equal(m.top, 104, 'the head\'s top, never the staff\'s');
  assert.equal(m.head, 3.5);
  assert.equal(m.chest, 3.5);
  assert.equal(spriteMarks(new Uint32Array(w * h), w, h), null, 'nothing painted, no marks');
  assert.equal(spriteMarks(px, 0, h), null);
});

test('ARMORY what a piece draws: a crown on the head, a heart on the chest, arms and legs on both sides; a sprite\'s forearm stands down; a rider\'s legs and a sunk body\'s chest none; the weapon\'s nothing here (mutants: the weapon drawn on the body; a rider\'s greaves drawn; the forearm drawn on a card)', () => {
  const rig = { at: [0, 0, 0], yaw: 0, pose: newPose(), vel: [0, 0, 0] }, eye = [0, 1.6, 3];
  const crown = armoryDraws('burningcrown', rig, eye, true);
  assert.ok(crown.length >= 3 && crown.every((d) => d.A[1] > 1.5), 'the crown over the brow');
  const heart = armoryDraws('emberheart', rig, eye, true);
  assert.ok(heart.some((d) => d.mesh === 2) && heart.every((d) => d.A[1] > 1 && d.A[1] < 1.6), 'a decal on the chest');
  assert.equal(armoryDraws('emberheart', rig, eye, false).filter((d) => d.mesh === 1).length, 1, 'far: the embers go, the glow stays');
  const arms = armoryDraws('ashbound', rig, eye, true).filter((d) => d.mesh === 0);
  assert.equal(arms.length, 4, 'upper and forearm, both sides');
  assert.ok(arms.some((d) => d.A[0] < 0) && arms.some((d) => d.A[0] > 0), 'left and right');
  const legs = armoryDraws('eternalgreaves', rig, eye, true).filter((d) => d.mesh === 0);
  assert.equal(legs.length, 2);
  for (const k of ['breachbrand', 'eternaledge']) assert.deepEqual(armoryDraws(k, rig, eye, true), [], `${k}: drawn on the weapon by the weapon glow`);
  const card = { ...rig, pose: newPose() };
  poseFromFigure({ base: 0, mpp: 0.02 }, card.pose);
  assert.equal(armoryDraws('ashbound', card, eye, true, [1, 0, 0]).filter((d) => d.mesh === 0).length, 2, 'a sprite: the upper arm alone');
  assert.deepEqual(armoryDraws('cinderstride', { ...rig, mounted: true }, eye, true), [], 'a rider\'s legs are the horse\'s');
  const sunk = { ...rig, pose: newPose() }; sunk.pose.sunk = true;
  assert.deepEqual(armoryDraws('emberheart', sunk, eye, true), [], 'under the water to the neck, no chest');
  assert.ok(armoryDraws('eternalhalo', sunk, eye, true).length > 0, 'the head still above it');
});

test('ARMORY the pass: a program a body piece with its piece a constant, the rates whole over the auras\' clock, the wearers nearest first within range, my own head no body piece, a stride an ember (mutants: the weapon\'s program built; a wearer past range drawn; the trail never written)', () => {
  assert.deepEqual([...ARMORY_BODY_PIECES], ARMORY_KEYS.filter((k) => !/brand|edge/.test(k)));
  assert.equal(ARMORY_PROGRAMS.length, ARMORY_BODY_PIECES.length);
  const [[vs, fs]] = armoryPrograms(3);
  assert.ok(vs.includes('const int uPiece = 3;') && fs.includes('const int uPiece = 3;') && !vs.includes('uniform int uPiece'));
  assert.equal(armoryPrograms(3), armoryPrograms(3), 'built once');
  assert.equal(armoryRatesWhole(), true);
  const wearer = (/** @type {number} */ x) => ({ kit: 'a0000', at: [x, 0, 0], pose: newPose() });
  const out = [];
  armoryWearers([wearer(30), wearer(5), wearer(ARMORY_RANGE_M + 1), { at: [1, 0, 0], pose: newPose() }, null], [0, 0, 0], out);
  assert.deepEqual(out.map((w) => w.at[0]), [5, 30], 'nearest first; none past range nor bare');
  armoryWearers(Array.from({ length: ARMORY_DRAW_MAX + 5 }, (_, i) => wearer(i)), [0, 0, 0], out);
  assert.equal(out.length, ARMORY_DRAW_MAX);
  const me = { at: [0, 0, 0], yaw: 0, pose: newPose() };
  assert.equal(armoryEyeAtHead(me, [0, REST_POINTS[P.head + 1], 0.1]), true, 'my own first person');
  assert.equal(armoryEyeAtHead(me, [0, 1.6, 3]), false, 'my third person');
  const walker = { at: [0, 0, 0], yaw: 0, pose: newPose() };
  for (let i = 0; i <= 40; i++) { walker.at[2] = i * 0.05; armoryMotionStep(walker, i * 0.025); }
  const born = [...walker.trail].filter((_, i) => i % 4 === 3 && _ >= 0).length;
  assert.equal(born, Math.floor(2 / ARMORY_STRIDE_M), 'an ember a stride walked');
  assert.ok(walker.vel[2] > 1.5, 'the velocity smoothed toward 2 m/s');
  assert.ok(born <= ARMORY_TRAIL);
  armoryMotionStep(walker, 1.0 + 10);   // a long gap: a placement, never a stride
  assert.deepEqual([...walker.vel], [0, 0, 0]);
});

/** A GL that answers every call and keeps its log - enough for the pass's own choices, never its pixels (the GPU's are
 *  tools/armoryProbe.mjs's). */
function logGl() {
  const log = [];
  const gl = new Proxy({}, { get: (_, k) => (typeof k === 'string' && /^[A-Z][A-Z_0-9]*$/.test(k) ? 1 : (...a) => { log.push([k, ...a]); return k === 'getExtension' ? null : {}; }) });
  return { gl, log, count: (/** @type {string} */ n) => log.filter((c) => c[0] === n).length };
}

test('ARMORY the pass draws a worn piece and nothing over my own eyes, a torn beast\'s body, an unkindled one or a weapon\'s; the frame\'s state handed back (mutants: my head under my crown; a beast dressed; the depth left unwritten)', () => {
  const { gl, log, count } = logGl();
  const pass = new ArmoryRenderer(/** @type {any} */ (gl));
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const wearer = (/** @type {any} */ o = {}) => ({ kit: 'a0000', at: [0, 0, 0], yaw: 0, pose: newPose(), kindle: 1, torn: -1, _d: 3, ...o });
  pass.draw([wearer()], I, I, [0, 1.6, 3], 1, null, true);
  assert.equal(pass.drawn, 1, 'the crown drawn');
  assert.ok(count('drawArrays') >= 3, 'its tubes and its embers');
  for (const [why, w] of [['my own first person', wearer({ atHead: true })], ['turned beast', wearer({ torn: 1 })], ['not yet kindled', wearer({ kindle: 0 })], ['a weapon\'s piece', wearer({ kit: '0000a' })]]) {
    log.length = 0;
    pass.draw([w], I, I, [0, 1.6, 3], 1, null, true);
    assert.deepEqual([pass.drawn, count('drawArrays')], [0, 0], why);
  }
  const tail = log.map((c) => c[0]).slice(-5);
  assert.deepEqual(tail, ['bindVertexArray', 'enable', 'depthMask', 'blendFunc', 'disable'], 'the state handed back');
  assert.deepEqual(log.find((c) => c[0] === 'depthMask' && c[1] === true)?.[1], true);
});

/** A storage of the session's shape (localStorage's). */
function memStorage() {
  const m = new Map();
  return { _m: m, getItem: (/** @type {string} */ k) => m.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => m.set(k, String(v)), removeItem: (/** @type {string} */ k) => m.delete(k), key: (/** @type {number} */ i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
}

test('ARMORY the world host: my kit gathered at my feet and a peer\'s off the relay\'s badge, a concealed peer none, a kit the room did not hear said again, and a Breach\'s find said in the chat (mutants: a veiled peer\'s pieces gathered; the rehello never asked; the find unsaid)', () => {
  const was = globalThis.localStorage;
  const st = memStorage();
  st.setItem(SESSION_KEY, JSON.stringify({ id: 'u1', name: 'Me', kind: 'linked', sessionId: 's1', secret: 'x', glyphs: [], armory: 'b0a00' }));
  globalThis.localStorage = /** @type {any} */ (st);
  try {
    let rehellos = 0;
    const notes = [];
    const online = { rehello: () => { rehellos++; return true; }, auraOf: () => null, armoryOf: (/** @type {string} */ id) => (id === 'p2' || id === 'p3' ? '000b0' : null) };
    const host = createAuraHost({
      renderer: { gl: null }, online: () => online, travelActive: () => false, quiet: () => false, camYaw: () => 0,
      player: () => ({ feetAt: () => [1, 0, 2], bodyYawFor: () => 0, height: 1.8, riding: false }),
      spawned: () => true, beast: () => false, veiled: (id) => id === 'p3', toScene: (s) => s.at,
      walkers: () => null, riders: () => null, bodies: () => null, notice: (l) => notes.push(l),
    });
    host.issued({ armory: null });
    host.frame([{ id: 'p2', shown: { at: [5, 0, 5] } }, { id: 'p3', shown: { at: [6, 0, 6] } }, { id: 'p4', shown: { at: [7, 0, 7] } }]);
    assert.equal(host.counts().armory, 2, 'mine and p2\'s - p3 veiled, p4 bare');
    assert.equal(rehellos, 1, 'the token said no kit, I wear one: said again');
    host.frame([]);
    assert.equal(rehellos, 1, 'heard now - once');
    host.draw();
    assert.equal(host.counts().armory, 0, 'a frame\'s, drawn once');
    host.heard({ ok: true, data: { armory: { found: 'emberheart' } } });
    host.heard({ ok: true, data: { armory: { found: null } } });
    assert.deepEqual(notes, ['Dagon\'s Breach gives you an Aura Armory piece: Ember Heart. Wear it from your profile.']);
    assert.deepEqual([armoryOthersOf('near'), armoryOthersOf('none'), armoryOthersOf('x'), ARMORY_NEAR_M], ['near', 'none', 'all', 20]);
  } finally {
    if (was === undefined) delete globalThis.localStorage; else globalThis.localStorage = was;
  }
});

test('ARMORY HOST-SPLIT: the world host wires the module and keeps none of it (mutants: the gather back in bootWorld)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /\n  const auraHost = createAuraHost\(\{/);
  assert.match(w, /auraHost\.frame\(seen\);/);
  assert.match(w, /auraHost\.heard\(a\);/);
  assert.ok(!/new ArmoryRenderer|armoryWearers\(/.test(w), 'the armory\'s pass is the module\'s alone');
});
