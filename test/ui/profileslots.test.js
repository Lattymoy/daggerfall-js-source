// PROFILE-SLOTS (2026-10-28, the owner: "Overhaul the profile page and selection options to have a detailed character slot
// section ... an actual preview of either your morrowind/sprite for the selected character" and "Audit placement and
// ensure perfection"; bible/04-Characters/Aura-Armory.md section 10) - THE CHARACTER'S SLOTS on the profile: the law of
// what a slot wears and what the stage shows with a choice tried on, the section's presses through the account flow's own
// doors, the stage's one frame for every body, the head pieces' tips the plate stands over (on the stage and over a
// peer's head in the world), and the bodies the stage is handed. Its pixels: tools/profileSlotsProbe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTER_SLOTS, SLOTS_STAGE_PX, slotWorn, slotsShown, characterSlotName, characterSlots } from '../../src/ui/characterSlots.js';
import { STAGE_FRAME, stageCamera, stageTopOf, stageCameraOfBones, proxyMesh, STAGE_PROXY, STAGE_BONES } from '../../src/render/characterStage.js';
import { profileSpriteLook, spriteScaleOf, spriteOffsetScaleOf, spriteBodyOf, profileBodies, mwHeadOf, PROFILE_BODY_KINDS } from '../../src/ui/profileBody.js';
import { armoryHeadTip, armoryDraws, ARMORY_HEAD, ARMORY_RANGE_M } from '../../src/render/armoryPass.js';
import { createAuraHost } from '../../src/scenes/auraHost.js';
import { newPose, poseAtRest, poseFromBones, POSE_AT, REST_POINTS, ARMORY_BONES } from '../../src/render/armoryPose.js';
import { armoryKitWith, armoryLineKit } from '../../src/net/armoryLaw.js';
import { CLOAK_BONES } from '../../src/render/auraRing.js';
import { multiply } from '../../src/world/mat4.js';
import { CAPSULE_HEIGHT } from '../../src/player/motor.js';
import { RemotePlayers } from '../../src/net/remotePlayers.js';
import { perspective, lookAt } from '../../src/world/mat4.js';
import { parseNif } from '../../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../../src/formats/morrowind/mwSkin.js';
import { armBonesInBody } from '../../src/combat/fpArm.js';
import { retailSkeleton } from '../fixtures/mw/retailRig.mjs';

const rd = (/** @type {string} */ p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** A world point's place down a picture, 0 its top and 1 its bottom, by `vp`. */
const downOf = (/** @type {Float32Array} */ vp, /** @type {number[]} */ p) => { const c = [1, 3].map((r) => vp[r] * p[0] + vp[4 + r] * p[1] + vp[8 + r] * p[2] + vp[12 + r]); return 0.5 - (c[0] / c[1]) * 0.5; };
const mwBones = () => { const sk = buildSkeleton(parseNif(retailSkeleton())); return armBonesInBody({ skeleton: sk, mats: skeletonSpaceMatrices(sk, new Map(), GRAPH_ROOT) }, STAGE_BONES); };

/** The card's smallest document (wb9g_insignia.test.js's), a canvas that answers for a context and a style to write. */
function slotsDoc() {
  const mk = (/** @type {string} */ tag) => {
    const n = /** @type {any} */ ({
      tag, className: '', type: null, value: '', disabled: false, children: [], attrs: {}, style: {},
      append: (/** @type {any[]} */ ...k) => n.children.push(...k.filter(Boolean)),
      setAttribute(/** @type {string} */ k, /** @type {string} */ v) { n.attrs[k] = v; },
      get all() { return [n, ...n.children.flatMap((/** @type {any} */ c) => c.all)]; },
      get firstChild() { return n.children[0] ?? null; },
    });
    if (tag === 'canvas') n.getContext = () => ({});
    Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
    return n;
  };
  return { createElement: mk };
}

test('PROFILE-SLOTS the slots: the body\'s five down the left, over the head, the weapon, the portrait and the aura down the right - what each wears, and the stage\'s look with a choice tried on (mutants: a slot left out; a tried piece put in the wrong slot)', () => {
  assert.deepEqual(CHARACTER_SLOTS.map((s) => `${s.side}:${s.id}`), ['left:head', 'left:torso', 'left:arms', 'left:legs', 'right:plate', 'right:weapon', 'right:icon', 'right:aura', 'under:kill', 'under:portal', 'under:mount']);   // STOREFRONT: the effects under the stage
  assert.deepEqual([characterSlotName('plate'), characterSlotName('aura'), characterSlotName('icon'), characterSlotName('head')], ['Over the head', 'Aura', 'Portrait', 'Head']);
  const w = { title: 'gatebreaker', aura: 'dagonfire', icon: null, armory: 'ab000', glyphs: ['sprout', 'origin'], glyphsOff: ['origin'] };
  assert.deepEqual(slotWorn(w, 'head'), { kind: 'armory', key: 'burningcrown', word: 'Crown of the Burning Door' });
  assert.deepEqual(slotWorn(w, 'arms'), { kind: 'armory', key: null, word: null });
  assert.equal(slotWorn(w, 'plate').key, 'gatebreaker');
  assert.equal(slotWorn(w, 'icon').key, null, 'the face, no icon');
  assert.deepEqual(slotsShown(w, null), { kit: 'ab000', aura: 'dagonfire', title: 'gatebreaker', glyphs: ['sprout'] }, 'a glyph hidden is not shown');
  assert.equal(slotsShown(w, { slot: 'head', key: 'eternalhalo' }).kit, 'bb000', 'a head piece tried on, in the head');
  assert.equal(slotsShown(w, { slot: 'torso', key: null }).kit, 'a0000', 'a slot bared');
  assert.equal(slotsShown(w, { slot: 'set', key: 'bbbbb' }).kit, 'bbbbb', 'a whole set');
  assert.equal(slotsShown(w, { slot: 'aura', key: null }).aura, null);
  assert.equal(slotsShown(w, { slot: 'plate', key: 'founder' }).title, 'founder');
  assert.deepEqual(slotsShown(w, { slot: 'glyph', key: 'origin' }).glyphs, ['sprout', 'origin'], 'a hidden glyph tried on');
  assert.deepEqual(slotsShown({}, null), { kit: null, aura: null, title: null, glyphs: [] }, 'an empty wardrobe');
});

test('PROFILE-SLOTS the section: a tile opens its picker; a choice pointed at is tried on the stage, pressed is worn through the flow\'s own door; a piece not held is tried, never worn; a set held whole worn at once; the plate the gap over the head the stage answers (mutants: a locked piece worn; the try-on never reaching the stage; the gap dropped)', () => {
  const pressed = [];
  const flow = {
    busy: false,
    wardrobe: { titles: ['gatebreaker'], title: 'gatebreaker', glyphs: ['sprout'], glyphsOff: [], auras: ['dagonfire'], aura: null, icons: [], icon: null,
      armoryHeld: ['burningcrown', 'emberheart', 'ashbound', 'cinderstride', 'breachbrand', 'eternalhalo'], armory: 'a0000' },
    wearArmory: (/** @type {string} */ s, /** @type {string|null} */ k) => { pressed.push(['armory', s, k]); return true; },
    wearArmoryKit: (/** @type {string|null} */ k) => { pressed.push(['kit', k]); return true; },
    wearAura: (/** @type {string|null} */ k) => { pressed.push(['aura', k]); return true; },
    equip: (/** @type {string|null} */ k) => { pressed.push(['title', k]); return true; },
    toggleGlyph: (/** @type {string} */ k) => { pressed.push(['glyph', k]); return true; },
    wearIcon: (/** @type {string|null} */ k) => { pressed.push(['icon', k]); return true; },
  };
  const told = { kit: [], aura: [], body: [] };
  const stage = { setKit: (/** @type {any} */ k) => told.kit.push(k), setAura: (/** @type {any} */ a) => told.aura.push(a), setBody: (/** @type {any} */ b) => told.body.push(b), headAt: () => ({ x: 100, y: 60 }), stop() { told.stopped = true; } };
  const started = [];
  const bodies = { kinds: () => ['mw', 'sprite'], of: (/** @type {string} */ k) => Promise.resolve({ kind: k }) };
  const doc = slotsDoc();
  const entryOf = (/** @type {string} */ kind, /** @type {string} */ key) => ({ how: () => `Buy the ${key} (${kind}) from the shop.` });
  const slots = characterSlots(doc, flow, { start: (canvas, o) => { started.push(o); return stage; }, bodies, entryOf, gap: 5, who: () => ({ name: 'Aelwyn', lv: 12 }) });
  const paint = () => { sec = slots.node(paint); };   // as the card repaints: the section built afresh round the one canvas
  let sec = slots.node(paint);
  assert.equal(started.length, 1, 'the stage started once, with the canvas');
  assert.deepEqual({ ...started[0], cue: typeof started[0].cue }, { kit: 'a0000', aura: null, cue: 'function' }, 'STOREFRONT: and an effect\'s loop rings');
  const find = (/** @type {(n: any) => boolean} */ f) => sec.all.find(f);
  assert.equal(sec.all.filter((n) => n.tag === 'button' && n.className.startsWith('slottile')).length, 11, 'a tile a slot (STOREFRONT: and the three effects)');
  const plate = find((n) => n.className === 'slots-platehost').children[0];
  assert.equal(plate.style.transform, 'translate(100px, 55px) translate(-50%, -100%)', 'the plate\'s bottom the gap over the head point, as the world\'s names stand');
  assert.equal(slots.state().picked, 'head', 'the head\'s picker first');
  const halo = find((n) => n.tag === 'button' && n.className.includes('actarmory') && n.children[0]?.textContent === 'Eternal Halo');
  halo.onpointerenter();
  assert.deepEqual(slots.state().trial, { slot: 'head', key: 'eternalhalo' });
  assert.equal(told.kit.at(-1), 'b0000', 'tried on the stage');
  halo.onpointerleave();
  assert.equal(told.kit.at(-1), 'a0000', 'and off again');
  assert.equal(halo.onclick(), true, 'pressed, the flow\'s answer');
  assert.deepEqual(pressed.at(-1), ['armory', 'head', 'eternalhalo']);
  // the arms: the Eternal Armlets are not held - tried, never worn
  find((n) => n.tag === 'button' && n.className.startsWith('slottile') && n.children[0]?.textContent === 'Arms').onclick();
  assert.equal(slots.state().picked, 'arms');
  const locked = find((n) => n.tag === 'button' && n.className.includes('locked') && n.children[0]?.textContent === 'Eternal Armlets');
  assert.equal(locked.attrs['aria-disabled'], 'true');
  const before = pressed.length;
  assert.equal(locked.onclick(), false);
  assert.equal(pressed.length, before, 'a piece not held is never worn from here');
  assert.equal(told.kit.at(-1), 'a0b00', 'tried on instead');
  assert.match(find((n) => n.className === 'meta slots-look').textContent, /^Engraved bands .* Buy the eternalarmlets \(armory\) from the shop\.$/, 'its look, and how it is had, under the row');
  const whole = find((n) => n.tag === 'button' && n.children[0]?.textContent === 'Dagonfire: wear the whole set');
  assert.ok(whole, 'the Dagonfire line held whole: its set at once');
  whole.onclick();
  assert.deepEqual(pressed.at(-1), ['kit', 'aaaaa']);
  // over the head: a title and a glyph
  find((n) => n.tag === 'button' && n.className.startsWith('slottile') && n.children[0]?.textContent === 'Over the head').onclick();
  const glyph = find((n) => n.tag === 'button' && n.className.startsWith('acctglyph'));
  glyph.onclick();
  assert.deepEqual(pressed.at(-1), ['glyph', 'sprout']);
  assert.ok(find((n) => n.className === 'slots-bodies'), 'two bodies, a switch between them');
  slots.dispose();
  assert.equal(told.stopped, true, 'the stage let go with the card');
});

test('PROFILE-SLOTS the stage\'s frame: one camera law for every body - the highest a plate can stand at STAGE_FRAME.top, the widest ring\'s near edge at its bottom, room kept for the tallest head piece so a try-on never moves the camera (mutants: the ring\'s reach the dagonfire\'s; the frame on the head alone)', () => {
  assert.equal(STAGE_FRAME.reach, 1, 'the widest ring, the Seraph Wings\' pool');
  for (const top of [1.8, 2.2, 2.6]) {
    const cam = stageCamera(top, 0.75), vp = multiply(cam.proj, cam.view);
    assert.ok(Math.abs(downOf(vp, [0, top, 0]) - STAGE_FRAME.top) < 1e-6, `${top} m at the top's place`);
    assert.ok(Math.abs(downOf(vp, [0, 0, STAGE_FRAME.reach]) - STAGE_FRAME.bottom) < 1e-6, 'the ring\'s near edge at the bottom\'s');
  }
  const pose = poseAtRest(newPose());
  const head = pose.pts[POSE_AT.head + 1];
  const top = stageTopOf(head, pose);
  const tips = Object.keys(ARMORY_HEAD).map((k) => armoryHeadTip({ kit: armoryKitWith(null, 'head', k), pose }));
  assert.equal(top, Math.max(head, ...tips), 'room for the tallest head piece');
  assert.ok(top > head + 0.1, 'and the crown\'s flames reach well over the head');
  const cam = stageCameraOfBones(1.8, mwBones(), 0.75);
  const vp = multiply(cam.proj, cam.view);
  assert.ok(downOf(vp, [0, 1.8, 0]) - STAGE_FRAME.top > 0.02, 'a Morrowind body\'s head under its frame\'s top - the crown\'s room over it');
  const proxy = proxyMesh(pose.pts, POSE_AT);
  assert.equal(proxy.length, STAGE_PROXY.length * 8 * 12 * 6, 'eight sides and two caps of eight a part');
  assert.deepEqual(STAGE_BONES, [...new Set([...ARMORY_BONES, ...CLOAK_BONES])]);
});

test('PROFILE-SLOTS the head pieces\' tips: the crown\'s flames and the halo\'s motes over the head, the highest each draws to stay - where a plate stands clear of it (mutants: the crown\'s tip at its band; the halo\'s motes left out)', () => {
  const pose = poseAtRest(newPose()), eye = [0, 1.6, 3];
  const crown = { kit: armoryKitWith(null, 'head', 'burningcrown'), pose, at: [0, 0, 0], yaw: 0 };
  const halo = { kit: armoryKitWith(null, 'head', 'eternalhalo'), pose, at: [0, 0, 0], yaw: 0 };
  assert.equal(armoryHeadTip({ kit: 'a0a00'.replace('a', '0'), pose }), null, 'no head piece, no tip');
  assert.equal(armoryHeadTip({ kit: armoryLineKit('dagonfire'), pose }), armoryHeadTip(crown), 'a whole set\'s head piece');
  // the crown's tip is its flames' own tube's top, as its build draws it
  const tubes = armoryDraws('burningcrown', crown, eye, true).filter((d) => d.mesh === 0);
  const flameTop = Math.max(...tubes.map((d) => d.B[1]));
  const tipC = /** @type {number} */ (armoryHeadTip(crown));
  assert.ok(tipC >= flameTop - 1e-6 && tipC - flameTop < 0.08, `the crown's tip its flames' (${tipC.toFixed(3)} over ${flameTop.toFixed(3)})`);
  const crownPt = pose.pts[POSE_AT.crown + 1];
  const tipH = /** @type {number} */ (armoryHeadTip(halo));
  assert.ok(tipH > crownPt + ARMORY_HEAD.eternalhalo.lift && tipH < crownPt + 0.2, `the halo over the crown, its motes with it (${(tipH - crownPt).toFixed(3)} m)`);
  assert.ok(armoryHeadTip({ ...crown, at: [0, 2, 0] }) - tipC > 1.99, 'the wearer\'s feet carry it');
});

test('the profile\'s sprite stands as the world stands it at any scale: its shift scaled with the picture (BillboardScale) and by GlobalOffsetScale, both read off the settings as the body reads them', async () => {
  assert.equal(spriteOffsetScaleOf({ 'Animation.GlobalOffsetScale': 1.5, 'Animation.FineGlobalOffsetScale': 0.25 }), 1.75);
  assert.equal(spriteOffsetScaleOf({}), 1);
  const px = { width: 40, height: 100, colors: new Uint32Array(4000) };
  const at = (o) => spriteBodyOf({ onFoot: 0 }, { decode: async () => px, urlOf: () => 'x.png', ...o });
  const one = await at({}), big = await at({ scale: 2, offset: 1.5 });
  assert.ok(one.shift !== 0 && one.base !== undefined);
  assert.equal(Number(big.mpp.toFixed(9)), Number((one.mpp * 2).toFixed(9)), 'the picture twice the size');
  assert.equal(Number(big.shift.toFixed(9)), Number((one.shift * 3).toFixed(9)), 'its shift with it, and by the offset scale');
  assert.equal(Number(big.base.toFixed(9)), Number((one.base * 3).toFixed(9)));
});

test('PROFILE-SLOTS the bodies: Morrowind\'s where a rig stands (drawn by the stage\'s camera, its head the world\'s), the sprite the world draws - its skin or its layered gear - at the world\'s size and place (mutants: the sprite\'s offset unmirrored; the Morrowind body asked with no camera)', async () => {
  assert.deepEqual(PROFILE_BODY_KINDS, ['mw', 'sprite']);
  assert.deepEqual(profileSpriteLook({ gender: 'female', outfit: 'p6p6p6' }, { 'Graphics.OnFoot': 3 }), { onFoot: 3, wornArmour: false });
  assert.deepEqual(profileSpriteLook({ gender: 'female', outfit: 'p6p6p6' }, { 'Graphics.LayeredGear': 3 }), { onFoot: 0, wornArmour: true, gender: 'female', outfit: 'p6p6p6' }, 'Layered Gearing in the body\'s own');
  assert.equal(spriteScaleOf({ 'Animation.BillboardScale': 1.2, 'Animation.FineBillboardScale': 0.05 }), 1.25);
  const px = { width: 40, height: 100, colors: new Uint32Array(4000) };
  const b = await spriteBodyOf({ onFoot: 0 }, { decode: async () => px, urlOf: () => 'x.png' });
  assert.ok(b && b.kind === 'sprite' && b.width === 40 && b.mpp > 0 && Number.isFinite(b.base) && Number.isFinite(b.shift));
  assert.equal(await spriteBodyOf({ onFoot: 0 }, { decode: async () => null, urlOf: () => 'x.png' }), null, 'no picture, no body');
  assert.equal(mwHeadOf({ bodyHeight: () => null, raceHeightScale: () => 1.1 }), CAPSULE_HEIGHT * 1.1, 'a person\'s head the capsule\'s at the race\'s height');
  assert.equal(mwHeadOf({ bodyHeight: () => 2.6 }), 2.6, 'a creature\'s its own');
  const asked = [];
  const bones = mwBones();
  const arm = {
    canThirdPerson: () => true, bodyHeight: () => null, raceHeightScale: () => 1,
    stage: (/** @type {any} */ o) => { const cam = o.frame(bones); asked.push({ ...o, cam }); return { width: o.width, height: o.height, data: new Uint8ClampedArray(4), ...cam, bones }; },
  };
  const bodies = profileBodies({ arm, settings: () => ({}) });
  assert.deepEqual(bodies.kinds(), ['mw', 'sprite']);
  const mw = await bodies.of('mw', SLOTS_STAGE_PX);
  assert.equal(mw.kind, 'mw');
  assert.equal(mw.head, CAPSULE_HEIGHT);
  assert.deepEqual(asked[0].names, STAGE_BONES);
  assert.deepEqual(Array.from(mw.proj), Array.from(stageCameraOfBones(CAPSULE_HEIGHT, bones, 0.75).proj), 'drawn by the stage\'s own camera');
  assert.deepEqual(profileBodies({ arm: { canThirdPerson: () => false } }).kinds(), ['sprite'], 'no rig, the sprite alone');
  assert.equal(await profileBodies({ arm: { canThirdPerson: () => true, stage: () => null } }).of('mw'), null);
});

test('PROFILE-SLOTS the world\'s names stand over a worn head piece: a peer\'s name point at its head piece\'s tip where that is higher than its head, the host wiring the aura host\'s answer in one entry (mutants: the lift dropped; the lower of the two taken)', () => {
  const PROJ = perspective(Math.PI / 3, 16 / 9, 0.2, 6000);
  const VIEW = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
  const rp = new RemotePlayers({ renderer: { drawScreenQuad() {} }, deps: null, compose: async () => null });
  rp.sync([{ id: 'p1', name: 'A', title: null, glyphs: [], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }], (p) => [p.x, p.y, p.z], { bodyHeight: () => 1.8 });
  const at = (/** @type {any} */ lift) => rp.namePoints(PROJ, VIEW, 1600, 900, [0, 1.7, 0], (q) => [q.x, q.y, q.z], null, null, lift)[0].y;
  const bare = at(null);
  assert.ok(at(() => 2.1) < bare - 5, 'a crown\'s flames to 2.1 m: the name over them');
  assert.equal(at(() => 1.2), bare, 'a tip under the head moves nothing');
  const w = rd('src/scenes/world.js');
  assert.match(w, /\n {6}lift: auraHost\.nameTopOf,/, 'the world host wires it');
  assert.match(rd('src/net/remotePlayers.js'), /this\.namePoints\(proj, view, w, h, eye, toScene, rect, blocked, lift\)/);
});

test('PROFILE-SLOTS a name lifts only over a head piece DRAWN this frame: a near peer\'s crown lifts its name, one past the range, a beast\'s and a stale frame\'s (a quiet one, gathered with none drawn) none (mutants: the drawn mark dropped; the frame\'s count never moved)', () => {
  const was = globalThis.localStorage, m = new Map();
  globalThis.localStorage = /** @type {any} */ ({ getItem: (/** @type {string} */ k) => m.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => m.set(k, String(v)), removeItem: (/** @type {string} */ k) => m.delete(k), key: () => null, length: 0 });
  try {
    let quiet = false;
    const online = { auraOf: () => null, armoryOf: (/** @type {string} */ id) => (id === 'far' ? 'a0000' : id === 'near' || id === 'wolf' ? 'a0000' : null) };
    const renderer = { gl: null, _proj: new Float32Array(16), _view: new Float32Array(16), _camPos: [0, 1.7, 0] };
    const host = createAuraHost({
      renderer, online: () => online, travelActive: () => false, quiet: () => quiet, camYaw: () => 0,
      player: () => ({ feetAt: () => [0, 0, 0], bodyYawFor: () => 0, height: 1.8, riding: false }),
      spawned: () => false, beast: () => false, veiled: () => false, toScene: (/** @type {any} */ s) => s.at,
      sprites: () => [], bodies: () => null,
    });
    const seen = [{ id: 'near', shown: { at: [0, 0, -5] } }, { id: 'far', shown: { at: [0, 0, -(ARMORY_RANGE_M + 5)] } }, { id: 'wolf', shown: { at: [2, 0, -5], wb: 1 } }];
    host.frame(seen); host.draw();
    const lift = host.nameTopOf('near');
    assert.ok(lift > CAPSULE_HEIGHT * 0.9 && lift < 3, `the crown's tip over its wearer's feet: ${lift}`);
    assert.deepEqual(['far', 'wolf', 'nobody'].map((id) => host.nameTopOf(id)), [0, 0, 0], 'past the range, turned beast, no kit: no lift');
    quiet = true;
    host.frame(seen); host.draw();
    assert.equal(host.nameTopOf('near'), 0, 'a frame that drew no piece lifts no name - never the last one\'s');
  } finally {
    if (was === undefined) delete globalThis.localStorage; else globalThis.localStorage = was;
  }
});

test('PROFILE-SLOTS the stage\'s life on the card: a stage that stopped itself (its canvas off the page) started again when the section is back; a body asked again when its look changes beside it; a press\'s focus given back tries nothing on; the weapon\'s look says where it shows (mutants: the dead stage kept; the look never read again; the focus retrying the press)', async () => {
  const queue = /** @type {Function[]} */ ([]), raf = globalThis.requestAnimationFrame, caf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = /** @type {any} */ ((/** @type {Function} */ f) => queue.push(f));
  globalThis.cancelAnimationFrame = () => {};
  const frames = (/** @type {number} */ n) => { for (let i = 0; i < n; i++) { const now = queue.splice(0); for (const f of now) f(0); } };
  try {
    const flow = {
      busy: false,
      wardrobe: { titles: [], title: null, glyphs: [], glyphsOff: [], auras: [], aura: null, icons: [], icon: null, armoryHeld: ['burningcrown', 'eternalhalo', 'breachbrand'], armory: 'a0000' },
      wearArmory: () => true, wearArmoryKit: () => true, wearAura: () => true, equip: () => true, toggleGlyph: () => true, wearIcon: () => true,
    };
    const stages = /** @type {any[]} */ ([]);
    const start = () => { const s = { up: true, kits: /** @type {any[]} */ ([]), bodies: /** @type {any[]} */ ([]), setKit(/** @type {any} */ k) { s.kits.push(k); }, setAura() {}, setBody(/** @type {any} */ b) { s.bodies.push(b); }, headAt: () => null, stop() { s.up = false; }, alive: () => s.up }; stages.push(s); return s; };
    let look = 'p6', asks = 0;
    const bodies = { kinds: () => ['sprite'], lookKey: () => look, of: () => Promise.resolve({ kind: 'sprite', n: ++asks }) };
    const slots = characterSlots(slotsDoc(), flow, { start, bodies, entryOf: () => null });
    const paint = () => { sec = slots.node(paint); };   // as the card repaints
    let sec = slots.node(paint);
    frames(1);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(stages.length, 1);
    assert.deepEqual(stages[0].bodies.map((b) => b.n), [1], 'the body asked once');
    frames(40);
    assert.equal(asks, 1, 'its look unchanged: never asked again');
    look = 'p7';   // the skin card, beside it in the same window
    frames(40);
    await Promise.resolve(); await Promise.resolve();
    assert.deepEqual(stages[0].bodies.map((b) => b.n), [1, 2], 'its look changed: the body asked again and taken in');
    // a press, then the card's repaint giving it the focus back
    const find = (/** @type {(n: any) => boolean} */ f) => sec.all.find(f);
    const halo = find((n) => n.tag === 'button' && n.className.includes('actarmory') && n.children[0]?.textContent === 'Eternal Halo');
    const tried = stages[0].kits.length;
    halo.onclick();
    halo.onfocus();
    assert.equal(slots.state().trial, null, 'the focus a press got back tries nothing on');
    assert.equal(stages[0].kits.length, tried);
    halo.onfocus();
    assert.deepEqual(slots.state().trial, { slot: 'head', key: 'eternalhalo' }, 'a later focus, from the keys, tries on as ever');
    find((n) => n.tag === 'button' && n.className.startsWith('slottile') && n.children[0]?.textContent === characterSlotName('weapon')).onclick();
    find((n) => n.tag === 'button' && n.className.includes('actarmory') && n.children[0]?.textContent === 'Brand of the Breach').onpointerenter();
    assert.match(find((n) => n.className === 'meta slots-look').textContent, /It shows on the weapon in your hand\.$/, 'the weapon\'s piece is drawn on the held weapon, never on the stage');
    // the card's other pages took the canvas off the page: the stage stopped itself - the section back, a new one
    stages[0].up = false;
    paint();
    frames(1);
    assert.equal(stages.length, 2, 'a stage again, on a canvas of its own');
    slots.dispose();
  } finally {
    globalThis.requestAnimationFrame = raf; globalThis.cancelAnimationFrame = caf;
  }
});

test('STOREFRONT the effects under the stage: a tile each for the kill effect, the portals and the mount, saying what is worn; a kill or a portal pointed at plays on the stage, the open slot\'s worn one when none is (a portal\'s none the violet vortex); one not held is tried, never worn; one held is worn through the flow\'s own door; its look and how it is had said under the row (mutants: the try-on never reaching the stage; a locked effect worn; the worn one not shown)', () => {
  const pressed = [];
  const flow = {
    busy: false,
    wardrobe: { titles: [], title: null, glyphs: [], glyphsOff: [], auras: [], aura: null, icons: [], icon: null, armoryHeld: [], armory: null,
      effectsHeld: { kill: ['pyre'], portal: ['runic'], mount: [] }, effects: 'c00' },
    wearEffect: (/** @type {string} */ s, /** @type {string|null} */ k) => { pressed.push([s, k]); return true; },
  };
  const fx = /** @type {any[]} */ ([]);
  const stage = { setKit() {}, setAura() {}, setBody() {}, setEffect: (/** @type {any} */ s, /** @type {any} */ k) => fx.push([s, k]), headAt: () => null, stop() {} };
  const doc = slotsDoc();
  const entryOf = (/** @type {string} */ kind, /** @type {string} */ key) => ({ how: () => `Buy the ${key} (${kind}) from the shop.` });
  const slots = characterSlots(doc, flow, { start: () => stage, entryOf });
  const paint = () => { sec = slots.node(paint); };
  let sec = slots.node(paint);
  const find = (/** @type {(n: any) => boolean} */ f) => sec.all.find(f);
  const tile = (/** @type {string} */ id) => find((n) => n.tag === 'button' && n.className.startsWith('slottile') && n.children[0]?.textContent === characterSlotName(id));
  assert.deepEqual(['kill', 'portal', 'mount'].map((id) => slotWorn(flow.wardrobe, id).word), ['Daedric Pyre', null, null]);
  assert.deepEqual(['kill', 'portal', 'mount'].map(characterSlotName), ['Kill effect', 'Portals', 'Mount']);
  tile('kill').onclick();
  assert.equal(slots.state().picked, 'kill');
  assert.deepEqual(fx.at(-1), ['kill', 'pyre'], 'the slot opened plays the kill effect worn');
  const voidrend = find((n) => n.tag === 'button' && n.className.includes('acteffect') && n.children[0]?.textContent === 'Voidrend');
  assert.ok(voidrend.className.includes('locked'), 'not held: locked');
  voidrend.onpointerenter();
  assert.deepEqual(fx.at(-1), ['kill', 'voidrend'], 'tried on the stage');
  assert.match(find((n) => n.className === 'meta slots-look').textContent, /^A rift tears open .* Buy the voidrend \(kill\) from the shop\.$/, 'its look, and how it is had');
  assert.equal(voidrend.onclick(), false, 'a press tries it, never wears it');
  assert.deepEqual(pressed, []);
  voidrend.onpointerleave();
  assert.deepEqual(fx.at(-1), ['kill', 'pyre'], 'and goes back to the one worn');
  tile('portal').onclick();
  assert.deepEqual(fx.at(-1), ['portal', null], 'no skin worn: the violet vortex plays');
  const runic = find((n) => n.tag === 'button' && n.className.includes('acteffect') && n.children[0]?.textContent === 'Runic Stone');
  runic.onclick();
  assert.deepEqual(pressed, [['portal', 'runic']], 'held: worn through the flow');
  tile('mount').onclick();
  assert.deepEqual(fx.at(-1), [null, null], 'the mount slot plays nothing on the stage - its horse stands over the choices');
  assert.ok(find((n) => n.className === 'slots-mount'), 'the mount\'s horse');
  slots.dispose();
});
