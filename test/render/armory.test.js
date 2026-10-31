// ARMORY (2026-10-28, the owner: "Aura armory would allow 1. Head piece 2. Torso 3. Arms 4. Legs 5. Weapon/Duel wield";
// bible/04-Characters/Aura-Armory.md): THE ARMORY'S OWN PINS - the kit's law, the pose a piece hangs on, what each piece
// draws, the world host's gather, and the words the service and the client say alike.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ARMORY_SLOTS, ARMORY_PIECES, ARMORY_KEYS, ARMORY_NAME, ARMORY_SETS, armoryKitOk, armoryKitPieces, armoryLinePieces, armoryLineKit, armoryWarePieces,
  armoryKitOf, armoryKitWith, armoryKitHeld, armoryPieceAt,
} from '../../src/net/armoryLaw.js';
import { ARMORY_TEXT, ARMORY_LOOK, ARMORY_SLOT_TEXT, armoryPieceName } from '../../src/ui/armoryText.js';
import { INSIGNIA, ARMORY_BROKER_PRICE } from '../../src/net/insignia.js';
import { SHOP_WARES, shopKeysOf, shopOwns } from '../../src/net/shopLaw.js';
import { ARMORY_SET_TEXT } from '../../src/ui/armoryText.js';
import { badged, readArmory } from '../../src/net/wire.js';
import { POSE_AT, REST_POINTS, newPose, poseFromBones, poseFromFigure, poseAtRest, poseWorld, spriteMarks, spriteArmsSeen, ARMORY_BEAST_FIT, ARMORY_BEAST_CHEST, ARMORY_BEAST_ARM } from '../../src/render/armoryPose.js';
import { spriteFor } from '../../src/player/eyeOfTheBeholder/eotbSprite.js';
import { auraSpriteBones, auraClothOver } from '../../src/render/auraRing.js';
import {
  armoryDraws, armoryWearers, armoryMotionStep, armoryEyeAtHead, armoryPrograms, armoryRatesWhole, ARMORY_BODY_PIECES, ARMORY_PROGRAMS,
  ARMORY_RANGE_M, ARMORY_DRAW_MAX, ARMORY_TRAIL, ARMORY_STRIDE_M, ArmoryRenderer, ARMORY_BEAST_SLOTS,
} from '../../src/render/armoryPass.js';
import { createAuraHost, armoryOthersOf, armoryLayers, ARMORY_NEAR_M } from '../../src/scenes/auraHost.js';
import { weaponPieceArt, weaponPieceLayout, startWeaponPiecePreview, BLADE_W, BLADE_H, BLADE_FILL } from '../../src/render/weaponPiecePreview.js';
import { glowSpec, ARMORY_LEVEL, armoryWeaponStage } from '../../src/systems/weaponGlow.js';
import { SESSION_KEY, keepSession, adoptIdentity } from '../../src/net/accountClient.js';
import { parseNif } from '../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../../src/formats/morrowind/mwSkin.js';
import { armBonesInBody } from '../../src/combat/fpArm.js';
import { retailSkeleton } from '../fixtures/mw/retailRig.mjs';
import { ARMORY_BONES } from '../../src/render/armoryPose.js';
import { insigniaRowOf, insigniaEquip } from '../../src/scenes/brokerInsignia.js';

const rd = (/** @type {string} */ p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('ARMORY the kit: five slot letters, each a piece of its slot or empty, never all empty - and the pieces it names, the kit of a wardrobe, a slot changed, the held left (mutants: a piece in the wrong slot passed; an empty kit a claim; a slot changed beside the one asked)', () => {
  assert.deepEqual(ARMORY_SLOTS, ['head', 'torso', 'arms', 'legs', 'weapon']);
  // PIN MOVED: GUILD-SHOP - the guild's line, one piece: the Insignia Armlet in the arms slot, the guild shop's
  assert.equal(ARMORY_PIECES.length, 12, 'two lines of five, the guild\'s armlet and the Crystal Spurs');   // PIN MOVED (THANKS-POST): the update's gift
  assert.equal(new Set(ARMORY_KEYS).size, 12, 'a key each');
  for (const s of ARMORY_SLOTS) assert.equal(new Set(ARMORY_PIECES.filter((p) => p.slot === s).map((p) => p.code)).size, s === 'arms' ? 4 : 2, `${s}: its codes its own`);   // PIN MOVED (THANKS-POST): the Crystal Spurs, the arms slot's fourth
  assert.deepEqual(armoryLinePieces('guild').map((p) => [p.key, p.slot, p.code, p.source]), [['insigniaarmlet', 'arms', 'c', 'guild']]);
  assert.deepEqual(armoryLinePieces('dagonfire').map((p) => [p.key, p.source]), [['burningcrown', 'broker'], ['emberheart', 'broker'], ['ashbound', 'broker'], ['cinderstride', 'broker'], ['breachbrand', 'broker']], 'the Dagonfire line, the Sigil Broker\'s');
  assert.ok(armoryLinePieces('eternal').every((p) => p.source === 'shop'), 'the Eternal line, the shop\'s');
  assert.deepEqual([armoryLineKit('eternal'), armoryLineKit('dagonfire'), armoryLineKit('none')], ['bbbbb', 'aaaaa', null]);
  assert.deepEqual([armoryWarePieces('eternalset'), armoryWarePieces('emberheart'), armoryWarePieces('nonsuch')], [['eternalhalo', 'eternalsigil', 'eternalarmlets', 'eternalgreaves', 'eternaledge'], ['emberheart'], []]);
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
});

test('ARMORY the economy (the owner: "The dagon breach set should be very expensive from the dagon breach shop dealer", "The store set should be $20"): the Sigil Broker sells each Dagonfire piece for 75 of the account\'s embers; the shop sells each Eternal piece for 600 Aurum and the five together for 2,000 (PIN MOVED, AURUM-ONLY: $6 and $20), the set held whole when its five are and its five held when it is (mutants: the Broker\'s price; a set\'s pieces never given; the set sold over five singles)', () => {
  assert.equal(ARMORY_BROKER_PRICE, 75);
  assert.deepEqual(INSIGNIA.filter((o) => o.kind === 'armory').map((o) => [o.id, o.price]), armoryLinePieces('dagonfire').map((p) => [`armory:${p.key}`, 75]));
  const set = SHOP_WARES.find((w) => w.id === 'armory:eternalset');
  // PIN MOVED (AURUM-ONLY): the set's $20 and a piece's $6 are 2,000 and 600 Aurum - the owner's "$1 = 100 Aurum"
  assert.deepEqual([set?.price, set?.cents, set?.category], [2000, 0, 'armory']);
  assert.deepEqual(SHOP_WARES.filter((w) => w.kind === 'armory' && w.key !== 'eternalset').map((w) => w.price), [600, 600, 600, 600, 600]);
  assert.deepEqual(shopKeysOf(set?.bit, 'armory'), armoryWarePieces('eternalset'), 'the set gives its five');
  const singles = SHOP_WARES.filter((w) => w.kind === 'armory' && w.key !== 'eternalset').reduce((a, w) => a | w.bit, 0);
  assert.equal(shopOwns(singles, 'armory:eternalset'), true, 'five singles: the set is not sold again');
  assert.equal(shopOwns(singles & ~8, 'armory:eternalset'), false, 'four: it is');
  assert.equal(shopOwns(set?.bit, 'armory:eternalhalo'), true, 'the set held: no single sold again');
});

test('ARMORY the wire: a peer\'s kit badged only when it is a kit, and read back the same (mutants: any string badged; the badge dropped)', () => {
  assert.equal(badged({}, { ak: 'b0a0b' }).ak, 'b0a0b');
  assert.equal('ak' in badged({}, { ak: 'zzzzz' }), false, 'a kit of no pieces never rides');
  assert.equal('ak' in badged({}, { ak: '00000' }), false, 'nor an empty one');
  assert.equal(readArmory({ ak: 'a0000' }), 'a0000');
  assert.equal(readArmory({ ak: 'a00' }), null);
  assert.equal(readArmory(null), null);
});

test('ARMORY the Broker\'s rows: a Dagonfire piece named in the player\'s words, owned off the held ids, worn off the kit in its own slot; worn and taken off through the armory\'s own door in that slot, a title and an aura through theirs (mutants: a piece\'s wear read off another slot; a piece sent to the aura\'s door)', async () => {
  const ins = { held: ['armory:emberheart', 'aura:dagonfire'], title: null, aura: 'dagonfire', armory: '0a000' };
  const rows = INSIGNIA.map((o) => insigniaRowOf(o, ins));
  const heart = rows.find((r) => r.id === 'armory:emberheart'), crown = rows.find((r) => r.id === 'armory:burningcrown');
  assert.deepEqual([heart?.name, heart?.owned, heart?.worn, heart?.slot, heart?.line, heart?.price], ['Ember Heart', true, true, 'torso', 'dagonfire', 75]);
  assert.deepEqual([crown?.owned, crown?.worn, crown?.slot], [false, false, 'head']);
  assert.deepEqual(rows.filter((r) => r.worn).map((r) => r.id), ['aura:dagonfire', 'armory:emberheart'], 'the kit\'s torso, and the aura worn');
  assert.equal(insigniaRowOf(INSIGNIA[0], ins).slot, undefined, 'a title has no slot');
  /** @type {Array<[string, any]>} */ const asked = [];
  const io = { base: 'https://accounts.invalid', secret: 's', fetch: async (/** @type {string} */ u, /** @type {any} */ i) => { asked.push([new URL(u).pathname, JSON.parse(i.body)]); return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }); } };
  await insigniaEquip(io, heart, null);
  await insigniaEquip(io, crown, 'burningcrown');
  await insigniaEquip(io, INSIGNIA[1], 'dagonfire');
  await insigniaEquip(io, INSIGNIA[0], null);
  assert.deepEqual(asked, [
    ['/v1/account/armory', { slot: 'torso', piece: null }], ['/v1/account/armory', { slot: 'head', piece: 'burningcrown' }],
    ['/v1/account/aura', { aura: 'dagonfire' }], ['/v1/account/title', { title: null }],
  ]);
});

test('ARMORY the words: the client\'s English each piece\'s service name and each set\'s, a name and a look for every piece, a name for every slot (mutants: a name drifted)', () => {
  assert.deepEqual(Object.keys(ARMORY_TEXT), [...ARMORY_KEYS]);
  assert.deepEqual(Object.keys(ARMORY_LOOK), [...ARMORY_KEYS]);
  assert.deepEqual(Object.keys(ARMORY_SLOT_TEXT), [...ARMORY_SLOTS]);
  for (const k of ARMORY_KEYS) {
    assert.equal(ARMORY_TEXT[/** @type {keyof typeof ARMORY_TEXT} */ (k)](), ARMORY_NAME[/** @type {keyof typeof ARMORY_NAME} */ (k)], `${k}: one name`);
    const look = ARMORY_LOOK[/** @type {keyof typeof ARMORY_LOOK} */ (k)]();
    assert.ok(look.split(/\s+/).length <= 40, `${k}: PLAIN-TEXT - a look in 40 words at most`);
  }
  assert.equal(armoryPieceName('nonsuch'), 'nonsuch');
  for (const k of Object.keys(ARMORY_SETS)) assert.equal(ARMORY_SET_TEXT[/** @type {keyof typeof ARMORY_SET_TEXT} */ (k)](), ARMORY_NAME[/** @type {keyof typeof ARMORY_NAME} */ (k)], `${k}: one name`);
});

test('ARMORY the pose: a rig\'s bones its joints, a sprite\'s figure its card and its upper limbs, the rest pose crouched and saddled, a point turned with the body (mutants: a sprite\'s forearm called measured; the yaw unturned; the picture\'s marks ignored)', () => {
  const pose = newPose();
  assert.equal(poseFromBones(null, pose), false, 'no skeleton, nothing written');
  assert.equal(poseFromBones({ 'bip01 head': [0, 1.7, 0] }, pose), false, 'no shoulders');
  const bones = { 'bip01 head': [0, 1.65, 0], 'bip01 neck': [0, 1.5, 0], 'bip01 l upperarm': [-0.2, 1.42, 0], 'bip01 r upperarm': [0.2, 1.42, 0], 'bip01 l forearm': [-0.25, 1.15, 0.02], 'bip01 r calf': [0.1, 0.5, 0] };
  assert.equal(poseFromBones(bones, pose), true);
  assert.deepEqual([...pose.pts.slice(POSE_AT.elL, POSE_AT.elL + 3)].map((v) => +v.toFixed(3)), [-0.25, 1.15, 0.02], 'the forearm\'s origin is the elbow');
  assert.deepEqual([...pose.pts.slice(POSE_AT.knR, POSE_AT.knR + 3)].map((v) => +v.toFixed(3)), [0.1, 0.5, 0], 'the calf\'s the knee');
  assert.ok(pose.pts[POSE_AT.crown + 1] > pose.pts[POSE_AT.head + 1], 'the crown over the head');
  assert.deepEqual([pose.card, pose.limbs], [false, 'full']);
  assert.equal(poseFromFigure(null, pose), false);
  assert.equal(poseFromFigure({ base: 0, mpp: 0.02, marks: null }, pose), true);
  assert.deepEqual([pose.card, pose.limbs], [true, 'upper'], 'a painting has no forearm to measure');
  const marked = newPose();
  poseFromFigure({ base: 0, mpp: 0.02, marks: { top: 100, head: 5, chest: 3, pelvis: 1, beast: null }, shift: 0 }, marked);
  assert.equal(+marked.dx[POSE_AT.head / 3].toFixed(3), 0.1, 'the head hung where the picture draws it, 5 px off its middle');
  assert.equal(+marked.dx[POSE_AT.shL / 3].toFixed(3), 0.06, 'the shoulders with the chest');
  assert.equal(+marked.dx[POSE_AT.ftR / 3].toFixed(3), 0.02, 'the legs with the pelvis');
  poseAtRest(pose, 0.5, true);
  assert.ok(pose.pts[POSE_AT.head + 1] < REST_POINTS[POSE_AT.head + 1], 'crouched');
  assert.ok(pose.pts[POSE_AT.ftL + 1] > 0.5, 'saddled');
  const o = poseWorld(newPose(), 'chest', [10, 0, 10], Math.PI / 2, [0, 0, 0]);
  const fwd = REST_POINTS[POSE_AT.chest + 2];
  assert.ok(Math.abs(o[0] - (10 + fwd)) < 1e-6 && Math.abs(o[2] - 10) < 1e-6, 'facing +x, the chest\'s forward is +x');
});

test('ARMORY a picture\'s marks: the run nearest the middle at each body row, a staff beside it never the head - nor its orb, wide as a head (mutants: the widest run taken; the narrow-run floor gone; the top any run\'s)', () => {
  const w = 64, h = 128, px = new Uint32Array(w * h);
  const fill = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ y0, /** @type {number} */ y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px[y * w + x] = 0xff000000; };
  fill(30, 40, 0, 104);   // the body, 3.5 px right of the middle (31.5), its top row 104
  fill(24, 25, 0, 120);   // a staff to its left, two pixels wide, over the head
  fill(21, 28, 112, 122);   // PROFILE-SLOTS (the audit): its orb, eight wide - EOTB sets 6, 7 and 11 read their crowns off it
  const m = spriteMarks(px, w, h);
  assert.ok(m, 'a body stands');
  assert.equal(m.top, 104, 'the head\'s top, never the staff\'s nor its orb\'s');
  const front = new Uint32Array(w * h);
  for (let y = 0; y <= 104; y++) for (let x = 30; x <= 40; x++) front[y * w + x] = 0xff000000;
  for (let y = 0; y <= 125; y++) for (let x = 33; x <= 34; x++) front[y * w + x] = 0xff000000;   // a staff held up in front of the head
  for (let y = 118; y <= 125; y++) for (let x = 30; x <= 37; x++) front[y * w + x] = 0xff000000;   // its orb on it
  assert.equal(spriteMarks(front, w, h)?.top, 104, 'a shaft over the head is no head, nor what it holds up');
  const blade = new Uint32Array(w * h);
  for (let y = 0; y <= 90; y++) for (let x = 33; x <= 43; x++) blade[y * w + x] = 0xff000000;   // the body on its feet at 38
  for (let y = 91; y <= 104; y++) for (let x = 40; x <= 48; x++) blade[y * w + x] = 0xff000000;   // its head leant right
  for (let y = 60; y <= 118; y++) for (let x = 36; x <= 37; x++) blade[y * w + x] = 0xff000000;   // a blade held up over the feet
  assert.equal(spriteMarks(blade, w, h)?.top, 104, 'the head is a head\'s width - never a blade by it');
  // the body found from its feet: a sword held far out makes the picture wide, the body far off its middle (a side view)
  const W2 = 120, wide = new Uint32Array(W2 * h);
  const put = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ y0, /** @type {number} */ y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) wide[y * W2 + x] = 0xff000000; };
  put(80, 90, 0, 90); put(81, 89, 91, 104);   // the body, 25.5 px right of the picture's middle (59.5)
  for (let i = 0; i < 70; i++) put(10 + i, 11 + i, 70 + Math.round(i / 6), 70 + Math.round(i / 6));   // a sword out to the left, two pixels thick
  const far = spriteMarks(wide, W2, h);
  assert.equal(far?.head, 25.5, 'the head where the body stands, not lost off the middle');
  assert.equal(far?.top, 104);
  assert.equal(spriteMarks(wide, W2, h, { arms: false })?.arms, null, 'a side view: its arms are not read');
  assert.deepEqual([spriteArmsSeen(0), spriteArmsSeen(1), spriteArmsSeen(2), spriteArmsSeen(4)], [true, true, false, true]);
  assert.equal(m.head, 3.5);
  assert.equal(m.chest, 3.5);
  assert.equal(spriteMarks(new Uint32Array(w * h), w, h), null, 'nothing painted, no marks');
  assert.equal(spriteMarks(px, 0, h), null);
});

test('ARMORY a picture\'s arms (PROFILE-SLOTS audit, the owner: "The arm effects on the sprite aren\'t positioned correctly"): each arm read down its own outer edge - one hanging apart, one bent out to its elbow, a shield on the forearm stepped past - and the pose\'s arms where the picture draws them, across its card (mutants: the shield taken for the arm; the arms off the table again)', () => {
  const w = 64, h = 128, px = new Uint32Array(w * h);
  const fill = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ y0, /** @type {number} */ y1) => { for (let y = y0; y <= y1; y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) px[y * w + x] = 0xff000000; };
  fill(26, 37, 0, 90);   // the torso and legs, on the middle (31.5)
  fill(28, 35, 91, 104);   // the head
  fill(18, 23, 50, 88); fill(24, 25, 84, 88);   // the left arm hanging apart, its shoulder joined to the torso
  for (let r = 50; r <= 88; r++) { const c = Math.round(38 + (88 - r) / 2); fill(c - 2, c + 3, r, r); }   // the right bent out, half a pixel a row
  fill(40, 62, 68, 78);   // a shield over its forearm, joined to it
  const m = spriteMarks(px, w, h);
  assert.ok(m?.arms, 'both arms read');
  const { L, R } = m.arms;
  assert.deepEqual(L.rows, [86, 67, 50]);
  assert.deepEqual([L.sh, L.el], [-10, -10], 'the hanging arm: its middle, half an arm in from its outer edge');
  const line = (/** @type {number} */ r) => Math.round(38 + (88 - r) / 2) + 3 - 3.5 - 31.5;   // the bent arm's middle at row r
  assert.ok(Math.abs(R.sh - line(86)) <= 1, `the bent arm's shoulder (${R.sh})`);
  assert.ok(Math.abs(R.el - line(67)) <= 1.5, `its elbow on its own line (${R.el} by ${line(67)}), never the shield's rim (${62 - 3.5 - 31.5})`);
  const pose = newPose();
  poseFromFigure({ base: 0.1, mpp: 0.02, marks: m, shift: 0.05 }, pose);
  assert.equal(+pose.dx[POSE_AT.elR / 3].toFixed(4), +(0.05 + R.el * 0.02).toFixed(4), 'the elbow across the card where the picture draws it');
  assert.equal(pose.pts[POSE_AT.elR], 0, 'none of it turned with the body - the picture is what is seen');
  assert.equal(+pose.pts[POSE_AT.elL + 1].toFixed(4), +(0.1 + 67 * 0.02).toFixed(4), 'at its row over the card\'s foot');
  assert.equal(m.beast.arms, undefined, 'a beast\'s arms are its own - it wears nothing');
  // THE LEGS: a stride's two legs at their own middles; a robe beside a staff split at its quarters, the shaft no leg
  const legsOf = (/** @type {(f: (x0: number, x1: number, y0: number, y1: number) => void) => void} */ draw) => {
    const q = new Uint32Array(w * h);
    draw((x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) q[y * w + x] = 0xff000000; });
    return spriteMarks(q, w, h)?.legs;
  };
  const stride = legsOf((f) => { f(14, 21, 0, 45); f(40, 47, 0, 45); f(20, 42, 46, 90); f(27, 36, 91, 104); });
  assert.deepEqual([stride?.knee, stride?.ankle], [[-14, 12], [-14, 12]], 'each leg at its own middle');
  const robe = legsOf((f) => { f(20, 41, 0, 90); f(26, 35, 91, 104); f(8, 10, 0, 100); });
  assert.deepEqual(robe?.knee, [-6.5, 4.5], 'a robe two legs wide, at its quarters - never the staff beside it');
  const walker = newPose();
  poseFromFigure({ base: 0, mpp: 0.02, marks: { ...m, legs: stride }, shift: 0 }, walker);
  assert.equal(+walker.dx[POSE_AT.knR / 3].toFixed(3), 0.24, 'the knee across the card where the picture stands it');
  assert.equal(walker.pts[POSE_AT.ftL], 0);
  // which view a picture is, as the sprite's own table says it: the front, the side (mirrored or not), the back
  assert.deepEqual([0, 1, 2, 4, 6].map((o) => spriteFor('Idle', o, 0, { onFoot: 0 })?.view), [0, 1, 2, 4, 2]);
  assert.equal(spriteFor('Idle', 2, 0, { onFoot: 20 })?.view, 2, 'a class skin\'s');
  assert.equal(spriteFor('Idle', 2, 0, { onFoot: 0, wornArmour: true, gender: 'female', outfit: 'p6p6p6' })?.view, 2, 'Layered Gearing\'s');
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
  assert.equal(armoryEyeAtHead(me, [0, REST_POINTS[POSE_AT.head + 1], 0.1]), true, 'my own first person');
  assert.equal(armoryEyeAtHead(me, [0, 1.6, 3]), false, 'my third person');
  const walker = { at: [0, 0, 0], yaw: 0, pose: newPose() };
  for (let i = 0; i <= 40; i++) { walker.at[2] = i * 0.05; armoryMotionStep(walker, i * 0.025); }
  const born = [...walker.trail].filter((_, i) => i % 4 === 3 && _ >= 0).length;
  assert.equal(born, Math.floor(2 / ARMORY_STRIDE_M), 'an ember a stride walked');
  assert.ok(walker.vel[2] > 1.5, 'the velocity smoothed toward 2 m/s');
  assert.ok(born <= ARMORY_TRAIL);
  armoryMotionStep(walker, 1.0 + 10);   // a long gap: a placement, never a stride
  assert.deepEqual([...walker.vel], [0, 0, 0]);
  // a sprite's feet stand across its card, along the view's right - its embers left a foot each side, never on its middle
  const card = { at: [0, 0, 0], yaw: 0, pose: newPose() };
  card.pose.card = true;
  for (const [n, d] of /** @type {[string, number][]} */ ([['ftL', -0.12], ['ftR', 0.12]])) { card.pose.pts[POSE_AT[n]] = 0; card.pose.dx[POSE_AT[n] / 3] = d; }
  for (let i = 0; i <= 40; i++) { card.at[2] = i * 0.05; armoryMotionStep(card, i * 0.025, [1, 0, 0]); }
  const xs = [...card.trail].filter((_, i) => i % 4 === 0 && card.trail[i + 3] >= 0).map((x) => Math.round(x * 100) / 100);
  assert.deepEqual([...new Set(xs)].sort(), [-0.12, 0.12], 'the ember at the foot that strode, off the middle');
});

test('ARMORY on the Morrowind body: every bone the pose reads stands on retail\'s own skeleton, read by the game\'s own reader (fpArm armBonesInBody, what thirdBones and a peer\'s bonesOf answer) - and the pieces land on its parts (mutants: a bone misnamed; the chest on the spine, not its face; the forearm left off the rig; the Sigil\'s back inside the torso)', () => {
  const sk = buildSkeleton(parseNif(retailSkeleton()));
  const bones = armBonesInBody({ skeleton: sk, mats: skeletonSpaceMatrices(sk, new Map(), GRAPH_ROOT) }, ARMORY_BONES);
  assert.deepEqual(ARMORY_BONES.filter((n) => !bones[n]), [], 'every bone found on the retail skeleton');
  const pose = newPose();
  assert.equal(poseFromBones(bones, pose), true);
  const y = (/** @type {string} */ n) => pose.pts[POSE_AT[n] + 1];
  assert.ok(y('crown') > y('head') && y('head') > y('neck') && y('neck') > y('chest') && y('chest') > y('pelvis') && y('pelvis') > y('knL') && y('knL') > y('ftL'), 'crown over head over neck over chest over pelvis over knee over foot');
  assert.ok(y('head') > 1.7 && y('head') < 1.9 && y('ftL') < 0.15, `a 1.83 m body stood on its feet (head ${y('head').toFixed(2)})`);
  assert.ok(pose.pts[POSE_AT.shL] < 0 && pose.pts[POSE_AT.shR] > 0 && pose.pts[POSE_AT.elL] < 0 && pose.pts[POSE_AT.waR] > 0, 'its left on the left, its right on the right');
  assert.ok(pose.pts[POSE_AT.chest + 2] > bones['bip01 spine2'][2] + 0.1, 'the chest\'s face, a hand forward of the spine');
  const w = { at: [0, 0, 0], yaw: 0, pose, vel: [0, 0, 0] }, eye = [0, 1.5, 3];
  assert.ok(armoryDraws('burningcrown', w, eye, true).every((d) => d.A[1] > y('head') - 0.01), 'the crown round the head');
  const heart = armoryDraws('emberheart', w, eye, true).find((d) => d.mesh === 2);
  assert.ok(heart && Math.abs(heart.A[1] - y('chest')) < 1e-6 && heart.A[2] > 0.1, 'the heart on the chest\'s face');
  assert.equal(armoryDraws('ashbound', w, eye, true).filter((d) => d.mesh === 0).length, 4, 'a rig\'s forearms drawn too');
  const sigilBack = armoryDraws('eternalsigil', w, [0, 1.5, -3], true).filter((d) => d.mesh === 2).find((d) => d.N[2] < 0);
  assert.ok(sigilBack && sigilBack.A[2] < bones['bip01 spine2'][2] - 0.12, 'the Sigil\'s back ring behind the back, never inside the torso (AUDIT ARMORY)');
  const shins = armoryDraws('cinderstride', w, eye, true).filter((d) => d.mesh === 0);
  assert.ok(shins.length === 2 && shins.every((d) => d.A[1] < 0.1 && d.B[1] > 0.6), 'the shins, foot to knee');
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
  for (const [why, w] of [['my own first person', wearer({ atHead: true })], ['turned beast, the crown off the muzzle', wearer({ torn: 1 })], ['not yet kindled', wearer({ kindle: 0 })], ['a weapon\'s piece', wearer({ kit: '0000a' })]]) {
    log.length = 0;
    pass.draw([w], I, I, [0, 1.6, 3], 1, null, true);
    assert.deepEqual([pass.drawn, count('drawArrays')], [0, 0], why);
  }
  const tail = log.map((c) => c[0]).slice(-5);
  assert.deepEqual(tail, ['bindVertexArray', 'enable', 'depthMask', 'blendFunc', 'disable'], 'the state handed back');
  assert.deepEqual(log.find((c) => c[0] === 'depthMask' && c[1] === true)?.[1], true);
});

test('WOLF-KIT turned beast, the chest, arm and leg pieces stay worn on the wolf and the head\'s does not; the wolf\'s pose fitted wider, the paperdoll\'s wolf bare (mutants: every piece off the beast; the paperdoll\'s wolf dressed; the head\'s crown on the muzzle; the wolf posed at a person\'s scale)', () => {
  const { gl, count } = logGl();
  const pass = new ArmoryRenderer(/** @type {any} */ (gl));
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const wearer = (/** @type {any} */ o = {}) => ({ kit: 'aaaaa', at: [0, 0, 0], yaw: 0, pose: newPose(), kindle: 1, torn: 1, _d: 3, ...o });
  assert.deepEqual([...ARMORY_BEAST_SLOTS], ['torso', 'arms', 'legs']);
  pass.draw([wearer()], I, I, [0, 1.6, 3], 1, null, true);
  assert.equal(pass.drawn, 3, 'the heart, the bracers and the stride on the wolf - never the crown, and the brand is the claws\' glow');
  for (const kit of ['0a000', '00a00', '000a0', '0b000', '00b00', '000b0']) { pass.draw([wearer({ kit })], I, I, [0, 1.6, 3], 1, null, true); assert.equal(pass.drawn, 1, `${kit} worn turned`); }
  for (const kit of ['a0000', 'b0000']) { pass.draw([wearer({ kit })], I, I, [0, 1.6, 3], 1, null, true); assert.equal(pass.drawn, 0, `${kit}: no head piece on the wolf`); }
  assert.ok(count('drawArrays') > 0);
  const bones = { 'bip01 head': [0, 1.65, 0.3], 'bip01 neck': [0, 1.5, 0.2], 'bip01 spine2': [0.08, 1.3, 0], 'bip01 l upperarm': [-0.25, 1.42, 0.1], 'bip01 r upperarm': [0.25, 1.42, 0.1] };
  const person = newPose(), wolf = newPose();
  poseFromBones(bones, person); poseFromBones(bones, wolf, true);
  assert.deepEqual([person.scale, wolf.scale], [1, ARMORY_BEAST_FIT], 'the wolf\'s pieces as wide as its limbs');
  assert.ok(ARMORY_BEAST_FIT > 1);
    assert.deepEqual([+wolf.pts[POSE_AT.chest].toFixed(3), +(wolf.pts[POSE_AT.chest + 2] - 0.1).toFixed(3)], [0, ARMORY_BEAST_CHEST.face], 'the hunched chest\'s face, centred between the shoulders - not on its leaning spine');
  assert.deepEqual([person.back, wolf.back], [0, ARMORY_BEAST_CHEST.back]);
  poseFromBones(bones, wolf); assert.equal(wolf.back, 0, 'turned back, a person\'s back again');
  const sigil = (/** @type {any} */ pose) => armoryDraws('eternalsigil', { at: [0, 0, 0], yaw: 0, pose }, [0, 1.5, 3], true).filter((d) => d.mesh === 2);
  const wolfBack = newPose(); poseFromBones(bones, wolfBack, true);
  const [front, back] = sigil(wolfBack);
  assert.equal(+(front.A[2] - back.A[2]).toFixed(3), ARMORY_BEAST_CHEST.back, 'the sigil\'s back piece behind the wolf\'s back, not inside it');
  assert.equal(+(bones['bip01 spine2'][1] - wolf.pts[POSE_AT.chest + 1]).toFixed(3), 0, 'a person\'s chest at the spine\'s height');
  assert.equal(+(bones['bip01 spine2'][1] - wolfBack.pts[POSE_AT.chest + 1]).toFixed(3), ARMORY_BEAST_CHEST.down, 'the wolf\'s down off its shoulders, mid-chest');
  // the arms: wider round the wolf's, stopped at the wrist
  const arms = (/** @type {string} */ key, /** @type {any} */ pose) => armoryDraws(key, { at: [0, 0, 0], yaw: 0, pose }, [0, 1.5, 3], true).filter((d) => d.mesh === 0);
  for (const key of ['ashbound', 'eternalarmlets']) {
    const p = arms(key, person), w = arms(key, wolfBack);
    assert.equal(w.length, p.length, `${key}: nothing past the wrist`);
    assert.ok(Math.abs(w[0].r[0] / p[0].r[0] - ARMORY_BEAST_FIT * ARMORY_BEAST_ARM.arm) < 1e-6, `${key}: as wide as the wolf's arm`);
  }
  assert.deepEqual([person.arm, wolfBack.arm], [1, ARMORY_BEAST_ARM.arm]);
  // the greaves on the wolf's shank, from the hock down to its toes - a person's from the ankle up to the knee
  const legs = (/** @type {any} */ pose) => armoryDraws('eternalgreaves', { at: [0, 0, 0], yaw: 0, pose }, [0, 1.5, 3], true).filter((d) => d.mesh === 0);
  const [pl] = legs(person), [wl] = legs(wolfBack);
  assert.ok(pl.B[1] > pl.A[1] + 0.1, 'a person\'s up the shin');
  assert.equal(+wl.B[1].toFixed(3), +wolfBack.pts[POSE_AT.ftL + 1].toFixed(3), 'the wolf\'s topped at the hock');
  assert.ok(Math.abs(wl.A[1] - 0.1 * ARMORY_BEAST_FIT) < 1e-6 && Math.abs(wl.A[0] - wl.B[0]) < 1e-6, 'and straight down to its toes');
  poseAtRest(wolfBack); assert.deepEqual([wolfBack.arm, wolfBack.hock, wolfBack.back], [1, false, 0], 'the rest pose a person\'s - nothing of the wolf left on it');
  // the classic sprite's lycanthrope wears none (mob: "just remove them from the paperdoll")
  const lyc = newPose(); poseFromFigure({ base: 0.1, mpp: 0.029, beast: true, marks: null }, lyc);
  pass.draw([wearer({ pose: lyc })], I, I, [0, 1.6, 3], 1, null, true);
  assert.equal(pass.drawn, 0, 'the paperdoll\'s wolf bare');
  pass.draw([wearer({ pose: lyc, torn: -1 })], I, I, [0, 1.6, 3], 1, null, true);
  assert.equal(pass.drawn, 4, 'a person\'s picture dressed');
  poseFromBones(bones, wolfBack, true); poseFromFigure({ base: 0, mpp: 0.02, marks: null }, wolfBack); assert.deepEqual([wolfBack.arm, wolfBack.hock, wolfBack.back], [1, false, 0], 'nor on a sprite\'s');
});

test('ARMORY a weapon piece\'s own stage: a longsword of Daggerfall\'s pixels, point up, laid at whole pixels a cell; its outline the classic hand\'s shaders, the field baked once and the band drawn over the blade each frame; a weapon piece alone takes it, any other kit the figure\'s (mutants: the field baked every frame; the band drawn under the blade; a kit with a body piece on the blade\'s stage)', () => {
  const art = weaponPieceArt();
  assert.deepEqual([art.w, art.h, art.px.length], [BLADE_W, BLADE_H, BLADE_W * BLADE_H * 4]);
  const solid = (/** @type {number} */ x, /** @type {number} */ y) => art.px[(y * BLADE_W + x) * 4 + 3] === 255;
  const runOf = (/** @type {number} */ y) => Array.from({ length: BLADE_W }, (_, x) => solid(x, y)).filter(Boolean).length;
  assert.deepEqual([runOf(0), runOf(20), runOf(44), runOf(50), runOf(BLADE_H - 1)], [1, 5, 15, 3, 3], 'the point, the blade, the guard, the grip, the pommel');
  assert.ok(Array.from({ length: BLADE_H }, (_, y) => runOf(y)).every((n) => n > 0), 'one piece, top to bottom');
  assert.ok(solid(7, 0) && !solid(6, 0), 'the point on the middle column');
  const L = weaponPieceLayout(300, 400, 3);
  assert.ok(Number.isInteger(L.cell) && L.cell >= 1 && L.w === BLADE_W * L.cell && L.h === BLADE_H * L.cell, 'whole pixels a cell');
  assert.ok(L.h <= 400 * BLADE_FILL && Math.abs(L.x + L.w / 2 - 150) <= 1 && Math.abs(L.y + L.h / 2 - 200) <= 1, 'centred, inside the stage');
  assert.equal(weaponPieceLayout(1, 1).cell, 1, 'never under a pixel');
  assert.deepEqual([armoryWeaponStage('0000b'), armoryWeaponStage('0000a'), armoryWeaponStage('b000b'), armoryWeaponStage('b0000'), armoryWeaponStage(null)], ['edge', 'brand', null, null, null]);
  const { gl, log, count } = logGl();
  const canvas = { getContext: () => gl, clientWidth: 300, clientHeight: 400, width: 0, height: 0, isConnected: true };
  assert.equal(startWeaponPiecePreview(/** @type {any} */ (canvas), null), null, 'no look, no stage');
  const stage = startWeaponPiecePreview(/** @type {any} */ (canvas), glowSpec('edge', ARMORY_LEVEL), { now: () => 12 });
  assert.ok(stage);
  assert.deepEqual([count('createProgram'), count('framebufferTexture2D'), count('drawArrays')], [3, 1, 1], 'three programs; the field baked, once');
  log.length = 0;
  stage.step(); stage.step();
  assert.equal(count('drawArrays'), 4, 'the blade and its outline, a frame');
  const calls = log.map((c) => c[0]);
  const blend = calls.indexOf('blendFunc'), draws = calls.flatMap((c, i) => (c === 'drawArrays' ? [i] : []));
  assert.ok(draws[0] < blend && blend < draws[1], 'the band blended over the blade');
  assert.deepEqual(log[blend].slice(1), [1, 1], 'premultiplied - ONE, ONE_MINUS_SRC_ALPHA (the logging GL answers 1 for every constant)');
  assert.equal(count('framebufferTexture2D'), 0, 'never baked again');
  assert.deepEqual([canvas.width, canvas.height], [300, 400]);
  stage.stop();
});

/** A storage of the session's shape (localStorage's). */
function memStorage() {
  const m = new Map();
  return { _m: m, getItem: (/** @type {string} */ k) => m.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => m.set(k, String(v)), removeItem: (/** @type {string} */ k) => m.delete(k), key: (/** @type {number} */ i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
}

test('ARMORY the world host: my kit gathered at my feet and a peer\'s off the relay\'s badge - a peer in a Morrowind body posed off its bones where it is drawn - a concealed peer none, a kit the room did not hear said again, (mutants: a peer\'s Morrowind bones read as no bones; a veiled peer\'s pieces gathered; the rehello never asked)', () => {
  const was = globalThis.localStorage;
  const sk = buildSkeleton(parseNif(retailSkeleton()));
  const mwBones = armBonesInBody({ skeleton: sk, mats: skeletonSpaceMatrices(sk, new Map(), GRAPH_ROOT) }, ARMORY_BONES);   // a peer standing in a Morrowind body
  const st = memStorage();
  st.setItem(SESSION_KEY, JSON.stringify({ id: 'u1', name: 'Me', kind: 'linked', sessionId: 's1', secret: 'x', glyphs: [], armory: 'b0a00' }));
  globalThis.localStorage = /** @type {any} */ (st);
  try {
    let rehellos = 0;
    const online = { rehello: () => { rehellos++; return true; }, auraOf: () => null, armoryOf: (/** @type {string} */ id) => (id === 'p2' || id === 'p3' ? '000b0' : null) };
    const host = createAuraHost({
      renderer: { gl: null }, online: () => online, travelActive: () => false, quiet: () => false, camYaw: () => 0,
      player: () => ({ feetAt: () => [1, 0, 2], bodyYawFor: () => 0, height: 1.8, riding: false }),
      spawned: () => true, beast: () => false, veiled: (id) => id === 'p3', toScene: (s) => s.at,
      sprites: () => [], bodies: () => ({ bonesOf: (/** @type {string} */ id) => (id === 'p2' ? { feet: [5.1, 0, 5.2], yaw: 1, bones: mwBones } : null) })
    });
    host.issued({ armory: null });
    host.frame([{ id: 'p2', shown: { at: [5, 0, 5] } }, { id: 'p3', shown: { at: [6, 0, 6] } }, { id: 'p4', shown: { at: [7, 0, 7] } }]);
    assert.equal(host.counts().armory, 2, 'mine and p2\'s - p3 veiled, p4 bare');
    const p2 = host.armoryWearersNow().find((w) => w.id === 'p2');
    assert.deepEqual([...p2.at, p2.yaw], [5.1, 0, 5.2, 1], 'a peer\'s Morrowind body stands its pieces where the body is drawn (peerBodies.bonesOf\'s feet and facing)');
    assert.deepEqual([p2.pose.card, p2.pose.limbs], [false, 'full'], 'posed off its bones - never the rest pose');
    assert.deepEqual(Array.from(p2.pose.pts.slice(POSE_AT.elR, POSE_AT.elR + 3)), Array.from(new Float32Array(mwBones['bip01 r forearm'])), 'its elbow its forearm\'s joint');
    assert.equal(rehellos, 1, 'the token said no kit, I wear one: said again');
    host.frame([]);
    assert.equal(rehellos, 1, 'heard now - once');
    host.draw();
    assert.equal(host.counts().armory, 0, 'a frame\'s, drawn once');
    assert.deepEqual([armoryOthersOf('near'), armoryOthersOf('none'), armoryOthersOf('x'), ARMORY_NEAR_M], ['near', 'none', 'all', 20]);
  } finally {
    if (was === undefined) delete globalThis.localStorage; else globalThis.localStorage = was;
  }
});

test('ARMORY-SEEN the cloth law: a cloak or a cape covers its body from an eye on the side its back faces - not from the front or the side, not folded away on a rider, never an aura with no cloth - and the frame\'s pieces split by it, by the wearer\'s id (mutants: the side reversed; any aura a cloth; the split by place, not id)', () => {
  const w = (/** @type {any} */ o) => ({ id: 'a', at: [5, 0, 5], aura: 'eternal', yaw: 0, ...o });
  const behind = [5, 1.6, 2], front = [5, 1.6, 8], side = [8, 1.6, 5.4];
  assert.deepEqual([auraClothOver(w({}), behind), auraClothOver(w({}), front), auraClothOver(w({}), side)], [true, false, false]);
  assert.deepEqual([auraClothOver(w({ aura: 'shadowcloak' }), behind), auraClothOver(w({ aura: 'dagonfire' }), behind), auraClothOver(w({ aura: 'seraphwings' }), behind)], [true, false, false], 'the cloak\'s cloth and Eternal\'s cape alone');
  assert.deepEqual([auraClothOver(w({ mounted: true }), behind), auraClothOver(w({ yaw: Math.PI }), behind), auraClothOver(w({}), null)], [false, false, false], 'a rider\'s folded away; turned round, its back to the other side');
  const under = /** @type {any[]} */ ([]), over = /** @type {any[]} */ ([]);
  const kits = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  armoryLayers(kits, [w({ id: 'c', at: [0, 0, 0] }), w({ id: 'a' }), w({ id: 'b', aura: 'dagonfire' })], behind, under, over);
  assert.deepEqual([under.map((k) => k.id), over.map((k) => k.id)], [['a'], ['b', 'c']], 'each kit by its own wearer\'s cloth');
  armoryLayers([{ id: 'a' }], [], behind, under, over);
  assert.deepEqual([under.length, over.length], [0, 1], 'refilled, and no aura no cloth');
});

test('ARMORY-SEEN the world host lays my pieces under my Eternal cape where the eye sees my back, and over it from the front - drawn after every cape, a Sigil on the back burned through it (mutants: the layers never split; the under layer drawn after the auras)', () => {
  const was = globalThis.localStorage, wasNow = performance.now;
  const st = memStorage();
  keepSession(st, { id: 'u1', name: 'Me', kind: 'linked', sessionId: 's1', secret: 'x' });
  adoptIdentity(st, { aura: 'eternal', armory: '0b000', secret: 'x' });
  globalThis.localStorage = /** @type {any} */ (st);
  let clock = 100;
  performance.now = () => clock * 1000;
  try {
    const log = /** @type {any[]} */ ([]);
    const gl = new Proxy({}, { get: (_, k) => (typeof k === 'string' && /^[A-Z][A-Z_0-9]*$/.test(k) ? 1 : (...a) => { log.push([k, ...a]); return k === 'getExtension' ? null : k === 'getUniformLocation' ? a[1] : {}; }) });
    const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const renderer = /** @type {any} */ ({ gl, _proj: I, _view: I, _camPos: [0, 1.6, -3], _fogMode: 0, markForeignPass: () => {} });
    const online = { rehello: () => true, auraOf: () => null, armoryOf: () => null };
    const host = createAuraHost({
      renderer, online: () => online, travelActive: () => false, quiet: () => false, camYaw: () => 0,
      player: () => ({ feetAt: () => [0, 0, 0], bodyFeetAt: () => [0, 0, 0], bodyYawFor: () => 0, height: 1.8, riding: false }),
      spawned: () => true, beast: () => false, veiled: () => false, toScene: (/** @type {any} */ s) => s.at,
      sprites: () => [], bodies: () => null,
    });
    const order = (/** @type {number[]} */ eye) => {
      renderer._camPos = eye;
      clock += 5;   // kindled past AURA_KINDLE_S
      host.frame([]);
      log.length = 0;
      host.draw();
      const at = (/** @type {string} */ u) => log.findIndex((c) => c[0].startsWith('uniform') && c[1] === u);
      return { piece: at('uFace'), cape: at('uCapeS') };
    };
    order([0, 1.6, -3]);
    const back = order([0, 1.6, -3]), front = order([0, 1.6, 3]);
    assert.ok(back.piece >= 0 && back.cape >= 0 && front.piece >= 0 && front.cape >= 0, `both drawn each frame (${JSON.stringify({ back, front })})`);
    assert.ok(back.piece < back.cape, 'seen from behind: the Sigil first, the cape laid over it');
    assert.ok(front.cape < front.piece, 'seen from the front: the cape behind the body, the Sigil over it');
  } finally {
    performance.now = wasNow;
    if (was === undefined) delete globalThis.localStorage; else globalThis.localStorage = was;
  }
});

test('ARMORY HOST-SPLIT: the world host wires the module and keeps none of it (mutants: the gather back in bootWorld)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /\n  const auraHost = createAuraHost\(\{/);
  assert.match(w, /auraHost\.frame\(seen\);/);
  assert.match(w, /const insigniaRows = \(\) => INSIGNIA\.map\(\(o\) => insigniaRowOf\(o, _insignia\)\);/, 'the Broker\'s rows, every kind\'s, the module\'s too');
  assert.ok(!/new ArmoryRenderer|armoryWearers\(/.test(w), 'the armory\'s pass is the module\'s alone');
  const h = rd('src/scenes/auraHost.js');
  assert.match(h, /const vw = renderer\._view, right = vw \? cardRightOf\(renderer\._proj, vw\) : null;/, 'ARMORY-MIRROR (PIN MOVED): the card\'s right, the draw\'s (ArmoryRenderer.draw) - the view\'s first row is the screen\'s left');
  assert.match(h, /selfPose\(selfKit\.pose, player, selfLiftNow > 0\); armoryMotionStep\(selfKit, now, vw \? cardRightOf\(renderer\._proj, vw\) : null\);/, 'FOLLOW-NOW (PIN MOVED): mine posed and stepped at the draw, where my body is drawn; ARMORY-MIRROR (PIN MOVED): along the card\'s right');
  assert.match(h, /peerPose\(d\.id, w, layers\); armoryMotionStep\(w, t, right\);/, 'a sprite\'s embers off its feet, mine and a peer\'s');   // CAPE-CARD (PIN MOVED): posed off the sprite layers' list
});

test('ARMORY a record drawn at another scale (eotbSprite.js spriteArtScale - ACRO-SHORT\'s Acrobat seen three-quarter on, 81 px where the sets draw 110): its marks read at the sets\' rows scaled by it, and its pose stands at the body\'s own heights (mutants: the art unread; the pose\'s rows the picture\'s pixels)', () => {
  const w = 64, h = 128, big = new Uint32Array(w * h);
  const fill = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ y0, /** @type {number} */ y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) big[y * w + x] = 0xff000000; };
  fill(26, 37, 0, 90); fill(28, 35, 91, 104);   // the torso and legs, the head
  fill(18, 23, 50, 88); fill(24, 25, 84, 88); fill(40, 45, 50, 88); fill(38, 39, 84, 88);   // two arms hanging apart
  const A = 0.75, sw = Math.round(w * A), sh = Math.round(h * A), small = new Uint32Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) small[y * sw + x] = big[Math.floor(y / A) * w + Math.floor(x / A)];
  const full = spriteMarks(big, w, h), drawn = spriteMarks(small, sw, sh, { art: A });
  assert.ok(full?.arms && drawn?.arms && drawn.legs, 'the small picture read whole - its arms and legs');
  assert.equal(drawn.art, A);
  assert.ok(Math.abs(drawn.top - full.top * A) <= 1, `its head's top in its own pixels (${drawn.top} by ${full.top * A})`);
  assert.equal(spriteMarks(small, sw, sh)?.arms, null, 'read at the sets\' own rows, its shoulders are its neck - no arms');
  // the pose: the same body at the same heights, its picture's pixels the bigger
  const at = (/** @type {any} */ marks, /** @type {number} */ mpp, /** @type {string} */ n) => { const p = newPose(); poseFromFigure({ base: 0, mpp, marks, shift: 0 }, p); return p.pts[POSE_AT[n] + 1]; };
  for (const n of ['shL', 'elR', 'knL', 'head', 'crown']) {
    const a = at(full, 0.02, n), b = at(drawn, 0.02 / A, n);
    assert.ok(Math.abs(a - b) < 0.04, `${n} at ${b.toFixed(3)} m, the full picture's ${a.toFixed(3)}`);
  }
  // the auras' cape and wings hang off the same rows (auraRing.js auraSpriteBones)
  const cape = (/** @type {any} */ marks, /** @type {number} */ mpp) => auraSpriteBones({ base: 0, mpp, marks })['bip01 l upperarm'][1];
  assert.ok(Math.abs(cape(drawn, 0.02 / A) - cape(full, 0.02)) < 1e-9, 'the cape\'s shoulders at the body\'s own');
  // every reader hands the record's scale over (the world's body, a peer's, the profile's stage)
  for (const f of ['src/player/eyeOfTheBeholder/eotbBody.js', 'src/net/peer/peerRiders.js']) assert.match(rd(f), /spriteMarks\(px, width, height, \{ arms: spriteArmsSeen\(s\.view\), art: spriteArtScale\(s\.archive, s\.record\) \}\)/, f);
  assert.match(rd('src/render/characterStage.js'), /art: shown\.art,\n\s*\}/);
  assert.match(rd('src/ui/profileBody.js'), /art: spriteArtScale\(s\.archive, s\.record\),\n\s*\};/);
});
