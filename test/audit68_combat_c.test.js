// AUDIT 68 (2026-09-24), cluster combat_c - src/combat shieldWidget ..
// weaponWidgetMotion: the rig's attack gate and held shot, its module
// singletons, the EOTB canvas, the gun's slide, and the Shield Widget's
// material, sheet key and parry ring. Every pin drives a real rig or the
// real component, and each one failed on the base source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { currentWeaponPose } from '../src/combat/playerWeapon.js';
import { createShieldWidget, readShieldWidgetSettings, shieldTextureIndex, SHIELD_TEMPLATES, SHIELD_RECOIL_CONDITION, PARRY_CLIP_FIRST, PARRY_CLIP_COUNT } from '../src/combat/shieldWidget.js';
import { fpArm } from '../src/combat/fpArm.js';
import { eotbBody } from '../src/player/eotbBody.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { setItemFields, mintCondition } from '../src/systems/itemTemplates.js';
import { createThunderlock, createPellets } from '../src/systems/thunderlock.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { setValue } from '../src/systems/settings.js';

setValue('Controls', 'WeaponSwingMode', '2');   // the port's default (click or hold), stated so the file does not lean on it

const CANVAS = { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 };
const rigOf = (entity, over = {}) => createWeaponRig({
  renderer: { uploadTexture: () => null, drawScreenQuad: () => {} }, canvas: CANVAS,
  fetchBytes: () => { throw new Error('no art in tests'); }, palette: null, audio: { playOneShot() {} }, entity,
  camera: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { baseSpeed: 3, grounded: true, standing: true } }),
  ...over,
});
const bare = () => ({ items: [], stats: { speed: 50 }, equip: { slots: {} } });
/** Steps n frames; answers how many 'hit' events came back and how many frames the machine was out of Idle. */
const run = (r, n) => {
  let hits = 0, busy = 0;
  for (let i = 0; i < n; i++) {
    if (r.frame(1 / 60).includes('hit')) hits++;
    if (r.playerWeapon.machine.state !== 'Idle') busy++;
  }
  return { hits, busy };
};
const settleIdle = (r) => { for (let i = 0; i < 120 && r.playerWeapon.machine.state !== 'Idle'; i++) r.frame(1 / 60); };
/** A shield as the minters write it (setItemFields + SetItem's condition). */
const shieldItem = (templateIndex, material) => mintCondition(setItemFields({ group: 'Armor', templateIndex, material }));

test('AUDIT 68 S09-sheathed-swing: a release while the equip countdown runs still lets go, and no swing starts under the countdown', () => {
  _resetModSettings();
  const entity = bare();
  const r = rigOf(entity);
  r.readyWeapon();
  r.attackInput(0, 0, true);
  run(r, 30);
  entity.equipCountdown = 1500;
  run(r, 10);
  r.attackInput(0, 0, false);   // the release, sent while the countdown runs
  run(r, 60);
  assert.deepEqual(run(r, 180), { hits: 0, busy: 0 }, 'the button is up: nothing swings');
});

test('AUDIT 68 S09-sheathed-swing: a held button swings nothing once the weapon is put away, a spell is readied, or the countdown runs', () => {
  _resetModSettings();
  // the large HUD's panel sheathes under a held button (HUDLarge takes none of Update's refusals)
  const r = rigOf(bare());
  r.readyWeapon();
  r.attackInput(0, 0, true);
  run(r, 30);
  r.toggleSheath();
  assert.equal(r.playerWeapon.sheathed, true);
  settleIdle(r);   // a blow already in flight may finish
  assert.deepEqual(run(r, 240), { hits: 0, busy: 0 }, 'a sheathed weapon starts no swing (WeaponManager.cs:283-288)');

  // a readied spell (Update :246-262)
  let armed = false;
  const s = rigOf(bare(), { spellArmed: () => armed });
  s.readyWeapon();
  s.attackInput(0, 0, true);
  run(s, 30);
  armed = true;
  settleIdle(s);
  assert.deepEqual(run(s, 240), { hits: 0, busy: 0 }, 'a readied spell owns the button');

  // the equip countdown (Update :276-281)
  const entity = bare();
  const c = rigOf(entity);
  c.readyWeapon();
  c.attackInput(0, 0, true);
  run(c, 30);
  entity.equipCountdown = 2000;
  settleIdle(c);
  const under = run(c, 30);
  assert.ok(entity.equipCountdown > 0, 'still counting');
  assert.deepEqual(under, { hits: 0, busy: 0 }, 'no swing while the hand is still equipping');
});

test('AUDIT 68 S09-sheathed-swing: a button released while sheathed is UP when the weapon is drawn again', () => {
  _resetModSettings();
  const r = rigOf(bare());
  r.readyWeapon();
  r.attackInput(0, 0, true);   // held, swinging
  run(r, 20);
  settleIdle(r);
  assert.equal(r.readyWeapon(), true, 'Z on an idle frame, the button still down');
  assert.equal(r.playerWeapon.sheathed, true);
  run(r, 10);
  r.attackInput(0, 0, false);   // released while sheathed
  run(r, 10);
  settleIdle(r);
  assert.equal(r.readyWeapon(), true, 'drawn again');
  assert.deepEqual(run(r, 240), { hits: 0, busy: 0 }, 'no button held, no swing');
  // and the latch is the live button: a real press still swings
  r.attackInput(0, 0, true);
  assert.ok(run(r, 60).busy > 0, 'a press on a drawn weapon swings');
});

test('AUDIT 68 S09-held-hit-dropped: a held shot is flushed when the arm stops driving, and H cannot change the hand under it', () => {
  _resetModSettings();
  const LONG_BOW = { name: 'Long Bow', templateIndex: 130, material: 0 };
  const ARROWS = { name: 'Arrow', templateIndex: 131, stackCount: 20 };
  const keys = ['ready', 'active', 'thirdActive', 'attack', 'takeShootRelease', 'update', 'release', 'setSheathed', 'setWorn', 'readySpell', 'setTorch', 'setWeapon', 'setScreenTransform', 'draw'];
  const saved = Object.fromEntries(keys.map((k) => [k, fpArm[k]]));
  let released = false, armActive = true;
  fpArm.ready = () => true;
  fpArm.active = () => armActive;
  fpArm.thirdActive = () => false;
  fpArm.attack = () => 'shoot';
  fpArm.takeShootRelease = () => { if (!released) return false; released = false; return true; };
  for (const k of ['update', 'release', 'setSheathed', 'setWorn', 'readySpell', 'setTorch', 'setScreenTransform', 'draw']) fpArm[k] = () => {};
  fpArm.setWeapon = () => true;
  const bowRig = () => {
    const r = rigOf({ items: [ARROWS], stats: { speed: 50 }, equip: { slots: { [EQUIP_SLOTS.RightHand]: LONG_BOW } } });
    r.toggleSheath();
    run(r, 30);
    return r;
  };
  const loose = (r) => { r.attackInput(0, 0, true); r.frame(1 / 60); r.attackInput(0, 0, false); };
  try {
    // (a) the arm stops driving mid-hold (fpRecheck's unload, a view with no body)
    armActive = true; released = false;
    const a = bowRig();
    loose(a);
    assert.equal(run(a, 40).hits, 0, 'held for the arm');
    armActive = false;
    assert.equal(run(a, 200).hits, 1, 'NEVER-TRAPS: the shot lands, once, rather than vanishing');

    // (b) H inside the hold window: the machine is Idle, the bow's cooldown and the held shot are not
    armActive = true; released = false;
    const b = bowRig();
    loose(b);
    run(b, 40);
    assert.equal(b.playerWeapon.machine.state, 'Idle');
    assert.equal(b.switchHand(), false, 'Update returns on the cooldown before ToggleHand');
    assert.equal(b.playerWeapon.weapon, LONG_BOW, 'the bow is still in hand');
    assert.equal(b.readyWeapon(), false, 'and Z waits too');
    released = true;
    assert.equal(run(b, 1).hits, 1, 'the arm\'s release lets the arrow go');
  } finally {
    Object.assign(fpArm, saved);
  }
});

test('AUDIT 68 S09-rig-globals-last-built: the pose probe answers for the rig that is STEPPING, not the last one built', () => {
  _resetModSettings();
  const entity = bare();
  const worldRig = rigOf(entity);      // world.js builds its rig first...
  const interiorRig = rigOf(entity);   // ...and createWorldModes builds the interior's after it
  assert.ok(interiorRig);
  worldRig.readyWeapon();
  worldRig.frame(1 / 60);
  assert.equal(worldRig.playerWeapon.sheathed, false);
  assert.equal(currentWeaponPose()?.weaponDrawn, true, 'the climb gate reads the drawn weapon outside');
});

test('AUDIT 68 S09-eotb-canvas-null: Don\'tHideWeapon keeps the first-person weapon while EOTB hides the spell hands', () => {
  _resetModSettings();
  setModSetting('weapon-widget', 'Enabled', true);
  const r = rigOf(bare());
  r.readyWeapon();
  let calls = 0;
  const real = r.widget.draw;
  r.widget.draw = (...a) => { calls++; return real(...a); };
  const hides = eotbBody.hides;
  try {
    eotbBody.hides = () => ({ weapon: false, horse: false, spellHands: true });   // third person, Compatibility.Don'tHideWeapon on
    r.frame(1 / 60); r.draw();
    assert.equal(calls, 1, 'the clone draws');
    calls = 0;
    eotbBody.hides = () => ({ weapon: true, horse: true, spellHands: true });    // the setting off
    r.frame(1 / 60); r.draw();
    assert.equal(calls, 0, 'and without it the weapon still goes');
  } finally { eotbBody.hides = hides; _resetModSettings(); }
});

test('AUDIT 68 S09-gun-sliding-offset-off: with Weapon Widget\'s Offset module off, a sheathed Thunderlock leaves the screen', async () => {
  // a synthetic 3x2 contact sheet: a dark box per cell on the key's white, a flash in cell 1
  const W = 360, H = 120;
  const px = new Uint8Array(W * H * 4).fill(255);
  for (let cell = 0; cell < 6; cell++) {
    const cx = (cell % 3) * 120 + 30, cy = Math.floor(cell / 3) * 60 + 20;
    for (let y = cy; y < cy + 20; y++) for (let x = cx; x < cx + 40; x++) { const p = (y * W + x) * 4; px[p] = 40; px[p + 1] = 40; px[p + 2] = 40; }
    if (cell === 1) for (let y = cy; y < cy + 5; y++) for (let x = cx; x < cx + 5; x++) { const p = (y * W + x) * 4; px[p] = 250; px[p + 1] = 200; px[p + 2] = 50; }
  }
  const saved = { fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap, OffscreenCanvas: globalThis.OffscreenCanvas };
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  globalThis.createImageBitmap = async () => ({ width: W, height: H, close() {} });
  globalThis.OffscreenCanvas = class { getContext() { return { drawImage() {}, getImageData: () => ({ width: W, height: H, data: new Uint8ClampedArray(px) }) }; } };
  try {
    _resetModSettings();
    setModSetting('weapon-widget', 'Modules.Offset', false);
    const gun = createThunderlock();
    const entity = { items: [gun, createPellets(20)], stats: { speed: 50 }, equip: { slots: { [EQUIP_SLOTS.RightHand]: gun } } };
    let quads = [];
    const r = rigOf(entity, { renderer: { uploadTexture: (k, name) => ({ name }), drawScreenQuad: (tex, rect) => quads.push({ tex, rect }) } });
    r.readyWeapon();
    for (let i = 0; i < 5; i++) { r.frame(1 / 60); r.draw(); await new Promise((res) => setTimeout(res, 0)); }
    quads = []; r.frame(1 / 60); r.draw();
    assert.equal(quads.length, 1, 'drawn: the gun is on screen (the art landed)');
    r.readyWeapon();
    assert.equal(r.playerWeapon.sheathed, true);
    for (let i = 0; i < 600; i++) { r.frame(1 / 60); r.draw(); }
    quads = []; r.frame(1 / 60); r.draw();
    assert.equal(quads.length, 0, 'ten seconds sheathed: no slide was ever running, so nothing is drawn');
  } finally {
    Object.assign(globalThis, saved);
    _resetModSettings();
  }
});

test('AUDIT 68 S09-v-shield-material-ignored: the Shield Widget draws a minted shield\'s own metal', () => {
  _resetModSettings();
  setModSetting('shield-widget', 'Enabled', true);
  const entity = bare();
  const r = rigOf(entity);
  const want = (templateIndex, nativeMaterialValue) => shieldTextureIndex({ templateIndex, nativeMaterialValue, conditionPercentage: 100 },
    r.shield.settings.conditionThresholdUpper, r.shield.settings.conditionThresholdLower);
  for (const m of [ARMOR_MATERIAL.Leather, ARMOR_MATERIAL.Steel, ARMOR_MATERIAL.Daedric]) {
    entity.equip.slots[EQUIP_SLOTS.LeftHand] = shieldItem(SHIELD_TEMPLATES.Kite, m);
    run(r, 5);
    assert.equal(r.shield.textureIndex, want(SHIELD_TEMPLATES.Kite, m), `a Kite of material ${m}`);
  }
  assert.notEqual(want(SHIELD_TEMPLATES.Kite, ARMOR_MATERIAL.Steel), want(SHIELD_TEMPLATES.Kite, ARMOR_MATERIAL.Leather), 'steel is not the leather art');
});

test('AUDIT 68 S09-shield-template-key-collision: a shield equipped straight over one of the same template+material SUM re-reads its sheet', () => {
  _resetModSettings();
  setModSetting('shield-widget', 'Enabled', true);
  const tower = shieldItem(SHIELD_TEMPLATES.Tower, ARMOR_MATERIAL.Iron);   // 112 + 512 = 624
  const kite = shieldItem(SHIELD_TEMPLATES.Kite, ARMOR_MATERIAL.Steel);     // 111 + 513 = 624
  const entity = { ...bare(), items: [tower, kite] };
  entity.equip.slots[EQUIP_SLOTS.LeftHand] = tower;
  const r = rigOf(entity);
  const { conditionThresholdUpper: up, conditionThresholdLower: lo } = r.shield.settings;
  run(r, 5);
  assert.equal(r.shield.textureIndex, shieldTextureIndex({ templateIndex: SHIELD_TEMPLATES.Tower, nativeMaterialValue: ARMOR_MATERIAL.Iron, conditionPercentage: 100 }, up, lo));
  entity.equip.slots[EQUIP_SLOTS.LeftHand] = kite;   // no empty-hand frame between them
  run(r, 5);
  assert.equal(r.shield.textureIndex, shieldTextureIndex({ templateIndex: SHIELD_TEMPLATES.Kite, nativeMaterialValue: ARMOR_MATERIAL.Steel, conditionPercentage: 100 }, up, lo),
    'the Steel Kite, not the Iron Tower it replaced');
});

test('AUDIT 68 S09-shield-impact-silent: the parry ring plays at volume 1.1 - the IL\'s 0 is the spatial blend', () => {
  const sounds = [];
  const w = createShieldWidget({
    settings: () => readShieldWidgetSettings(() => ({ Enabled: true, 'Modules.Recoil': true, 'Recoil.Condition': SHIELD_RECOIL_CONDITION.AnyAttack })),
    textures: { size: () => ({ width: 100, height: 100 }) },
    audio: { playOneShot: (clip, vol, pitch) => sounds.push({ clip, vol, pitch }) },
    rolls: () => 0.5, handedness: () => false,
  });
  // the shape the rig's shieldItem() hands the component
  w.onAttackDamageCalculated({ targetIsPlayer: true, bodyPart: 2, damage: 4, item: { templateIndex: SHIELD_TEMPLATES.Kite, nativeMaterialValue: ARMOR_MATERIAL.Steel, conditionPercentage: 100, isShield: true } });
  assert.equal(sounds.length, 1);
  assert.ok(sounds[0].clip >= PARRY_CLIP_FIRST && sounds[0].clip < PARRY_CLIP_FIRST + PARRY_CLIP_COUNT);
  assert.equal(sounds[0].vol, 1.1, 'audible');
  assert.equal(sounds[0].pitch, 1);
});

test('AUDIT 68 S09-frame-motion-triplicated: the shield motor reads the frame\'s filtered speed, not a raw NaN', () => {
  _resetModSettings();
  setModSetting('shield-widget', 'Enabled', true);
  const entity = bare();
  entity.equip.slots[EQUIP_SLOTS.LeftHand] = shieldItem(SHIELD_TEMPLATES.Kite, ARMOR_MATERIAL.Steel);
  const r = rigOf(entity, { camera: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { speedRatio: NaN, speedField: 6, baseSpeed: 3, grounded: true } }) });
  const seen = [];
  const real = r.shield.lateUpdate;
  r.shield.lateUpdate = (ctx) => { seen.push(ctx.motor.speed); return real(ctx); };
  r.frame(1 / 60);
  assert.equal(seen.length, 1);
  assert.equal(seen[0], 6, 'speedField / baseSpeed is the ratio, times the base');
});
