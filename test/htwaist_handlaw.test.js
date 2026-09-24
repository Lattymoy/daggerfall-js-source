// HT-WAIST (2026-09-24, Mac: "Let the lantern item be able to be hung at
// the waist instead of having to be held"). THE HAND LAW UNDER THE SWITCH.
//
// Handheld Torches' law is that a light NEEDS a free hand: with none free
// the lit light is stowed (or dropped), the ignite key refuses, the throw's
// wind-up douses it, and the first-person hand holds it. A lantern hung at
// the waist is in no hand, so under the switch none of that reaches it -
// it stays lit through a two-hander, a bow, a spell, a climb or a swim (and
// at the EQUIP moment, HT6's second caller), the key reaches it with no
// hand free, the throw leaves it lit, the hand draws nothing - and it
// lights you from the hip (systems/playerTorch.js playerTorchLight), ahead
// of both writers of the light's position override. Torches and candles
// are held exactly as before, and with the switch OFF every one of these
// cases reads as it always did (each pin carries its own switch-off twin).
//
// Driven through the real component (the ht1/ht6 harness: the frame the
// rig feeds it, the store live), through equip.js's real equipItem, and
// through the real playerTorchLight.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR, MESSAGES, ON_STOW, TORCH_LIGHT_AT } from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { EQUIP_SLOTS, equipItem } from '../src/systems/equip.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { DEFAULT_BINDINGS } from '../src/systems/inputActions.js';
import {
  playerTorchLight, tickPlayerTorch, setPlayerTorchOffsetOverride, setPlayerWaistLightOverride, TORCH_OFFSET, LANTERN_HIP,
} from '../src/systems/playerTorch.js';
import { armBuildOptsOf } from '../src/combat/weaponRig.js';

const V = HANDHELD_TORCHES_VENDOR;
const T = TEMPLATES;
const WAIST = 'Handling.LanternsAtWaist';
const DEFAULT_CODE = Object.fromEntries(DEFAULT_BINDINGS.map(([code, action]) => [action, code]));
const defaults = () => Object.fromEntries(Object.entries(MOD_SETTINGS[V].keys).map(([k, d]) => [k, d.default]));
const torch = () => ({ group: 'UselessItems2', templateIndex: T.Torch, name: 'Torch', currentCondition: 50, maxCondition: 50 });
const lantern = () => ({ group: 'UselessItems2', templateIndex: T.Lantern, name: 'Lantern', currentCondition: 100, maxCondition: 100 });
const weapon = (t) => ({ group: 'Weapons', templateIndex: t, material: 0, currentCondition: 100, maxCondition: 100 });
const shield = () => ({ group: 'Armor', templateIndex: 109, material: 0x0200, name: 'Buckler', currentCondition: 100, maxCondition: 100 });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, msg ?? `${a} ~ ${b}`);

/** The frame the rig feeds the component, the store live (flip a key between frames). */
function rig(over = {}, deps = {}) {
  const store = { ...defaults(), ...over };
  const said = [], shots = [];
  const audio = { playOneShot: (c, v, p) => shots.push([c, v, p]), loop: () => ({ stop() {} }), play3d: () => {} };
  const entity = { items: [], lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const pool = { spawned: [], thrown: [], spawnLightSource: (...a) => pool.spawned.push(a), spawnLightSourceProjectile: (...a) => pool.thrown.push(a), setOnPickedUp() {} };
  const keys = new Set();
  const h = createHandheldTorches({
    settings: () => readTorchSettings(() => store), audio, say: (l) => said.push(l), rolls: () => 0.5, torches: () => pool,
    handedness: () => false, loadSprite: deps.loadSprite ?? (async () => null),
  });
  const ctx = {
    renderer: deps.renderer ?? null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, actionDown: (a) => keys.has(DEFAULT_CODE[a]), sheathWeapons: () => { ctx.sheathed = true; },
  };
  const frame = (dt = 0.016) => { h.update(dt, ctx); h.lateUpdate(dt, ctx); };
  const tap = (code) => { keys.add(code); frame(); keys.delete(code); frame(); };
  return { h, store, said, shots, entity, pool, ctx, frame, tap };
}
/** A lit lantern in hand, both hands then taken by a bow in the left (UpdateFreeHand's own table). */
function lanternAndBow(over) {
  const r = rig(over);
  const ln = lantern();
  r.entity.items.push(ln); r.entity.lightSource = ln;
  r.frame();
  r.entity.equip = { slots: { [EQUIP_SLOTS.LeftHand]: weapon(WEAPONS.Long_Bow) } };
  r.frame();
  return { ...r, ln };
}

test('HT-WAIST: a bow takes both hands and the waist\'s lantern stays LIT, with no word said - switch off, the mod stows it and says so; a lit TORCH is still held and stowed either way (mutant: the stow arm\'s waist leg dropped, or spread to the torch arm)', () => {
  const on = lanternAndBow({ [WAIST]: true });
  assert.equal(on.h.hasFreeHand, false, 'the bow really took both hands');
  assert.equal(on.entity.lightSource, on.ln, 'at the waist: no hand to lose, nothing stowed');
  assert.equal(on.h.lastLightSource, null, 'and nothing remembered as stowed');
  assert.ok(!on.said.includes(MESSAGES.noFreeHand), 'no "can\'t hold" line - it is not held');
  const off = lanternAndBow({ [WAIST]: false });
  assert.equal(off.entity.lightSource, null, 'the switch off: the mod\'s own stow');
  assert.equal(off.h.lastLightSource, off.ln);
  assert.ok(off.said.includes(MESSAGES.noFreeHand), 'with the mod\'s own line');
  // a spell, a climb, a swim and the beast form take both hands too, and the waist's lantern stays through each
  for (const [k, v] of [['spellArmed', true], ['climbing', true], ['swimming', true], ['transformedLycanthrope', true]]) {
    const r = rig({ [WAIST]: true });
    const ln = lantern(); r.entity.items.push(ln); r.entity.lightSource = ln;
    r.ctx[k] = v; r.frame(); r.frame();
    assert.equal(r.h.hasFreeHand, false, `${k}: no hand free`);
    assert.equal(r.entity.lightSource, ln, `${k}: the lantern at the waist stays lit`);
  }
  // and a lit TORCH is still held: no hand free stows it, switch on or off (the waist is the lantern's alone)
  for (const waist of [true, false]) {
    const r = rig({ [WAIST]: waist, 'Handling.OnStow': ON_STOW.Unequip });
    const t = torch(); r.entity.items.push(t); r.entity.lightSource = t;
    r.frame();
    r.entity.equip = { slots: { [EQUIP_SLOTS.LeftHand]: weapon(WEAPONS.Long_Bow) } };
    r.frame();
    assert.equal(r.entity.lightSource, null, `waist ${waist}: the torch is stowed`);
    assert.equal(r.h.lastLightSource, t);
  }
});

test('HT-WAIST: the EQUIP moment (HT6\'s second caller of the law) leaves the waist\'s lantern lit - switch off, it stows it there and then (mutant: applyHandLaw reading another rule)', () => {
  for (const [waist, lit] of [[true, true], [false, false]]) {
    const r = rig({ [WAIST]: waist, 'Handling.OnStow': ON_STOW.Unequip });
    const ln = lantern(); r.entity.items.push(ln); r.entity.lightSource = ln;
    r.ctx.sheathed = false;
    r.frame();
    const sh = shield(); r.entity.items.push(sh);
    equipItem(r.entity, sh);   // NO frame: the open window's case
    assert.equal(r.entity.lightSource === ln, lit, waist ? 'at the waist: a shield on the arm takes nothing from the belt' : 'held: stowed by equipItem itself, as HT6 pins');
  }
});


test('HT-WAIST: the ignite key with NO hand free reaches the waist - it lights the pack\'s lantern (forgetting a stowed torch), and douses the lit one; switch off, the mod refuses (mutant: toggleLightPress\'s waist arm dropped)', () => {
  // a torch was stowed by the bow, the lantern is in the pack
  const r = rig({ [WAIST]: true, 'Handling.OnStow': ON_STOW.Unequip });
  const t = torch(), ln = lantern();
  r.entity.items.push(t, ln); r.entity.lightSource = t;
  r.frame();
  r.entity.equip = { slots: { [EQUIP_SLOTS.LeftHand]: weapon(WEAPONS.Long_Bow) } };
  r.frame();
  assert.equal(r.entity.lightSource, null); assert.equal(r.h.lastLightSource, t, 'the torch stowed and remembered');
  r.said.length = 0;
  r.tap('KeyO');
  assert.equal(r.entity.lightSource, ln, 'O lights the lantern at the waist - not the stowed torch the ladder would take first');
  assert.equal(r.h.lastLightSource, null, 'and the stowed torch is forgotten, or a freed hand would put the lantern out');
  assert.deepEqual(r.said, ['You ignite the new lantern'], 'the mod\'s own ignite line, once');
  r.frame(); r.frame();
  assert.equal(r.entity.lightSource, ln, 'and it stays lit, frames later, with the bow still up');
  r.tap('KeyO');
  assert.equal(r.entity.lightSource, null, 'O again douses it');
  assert.equal(r.said.at(-1), 'You douse the new lantern');
  // switch off: the mod's refusal, byte for byte
  const off = rig({ [WAIST]: false, 'Handling.OnStow': ON_STOW.Unequip });
  off.entity.items.push(lantern());
  off.entity.equip = { slots: { [EQUIP_SLOTS.LeftHand]: weapon(WEAPONS.Long_Bow) } };
  off.frame();
  off.tap('KeyO');
  assert.equal(off.entity.lightSource, null, 'the switch off: nothing lights');
  assert.deepEqual(off.said, [MESSAGES.noFreeHand]);
  // no lantern to reach: the waist arm steps aside and the mod refuses
  const none = rig({ [WAIST]: true });
  none.entity.items.push(torch());
  none.entity.equip = { slots: { [EQUIP_SLOTS.LeftHand]: weapon(WEAPONS.Long_Bow) } };
  none.frame();
  none.tap('KeyO');
  assert.equal(none.entity.lightSource, null); assert.deepEqual(none.said, [MESSAGES.noFreeHand], 'a torch still needs the hand it has not got');
});

test('HT-WAIST: the throw\'s wind-up leaves the waist\'s lantern lit - switch off, it douses the lantern as the mod does (mutant: the throw arm\'s waist leg dropped)', () => {
  for (const [waist, lit] of [[true, true], [false, false]]) {
    const r = rig({ [WAIST]: waist });
    const ln = lantern(); r.entity.items.push(ln, torch()); r.entity.lightSource = ln;
    r.frame();
    assert.equal(r.h.hasFreeHand, true, 'a hand is free to throw with');
    r.tap('KeyX');   // press then release: the wind-up, then the throw from the pack
    assert.equal(r.entity.lightSource === ln, lit, waist ? 'the lantern at the waist burns on while the torch flies' : 'held: the wind-up douses it (0x18d9)');
    assert.equal(r.pool.thrown.length, 1, 'a torch was thrown either way');
  }
});

// ═══ the first-person hand ═══════════════════════════════════════════════

const loadSprite = async (record, frame) => (frame < 4 && record <= 1 ? { width: record ? 110 : 90, height: record ? 138 : 205, colors: null } : null);
const fakeRenderer = () => { const r = { uploads: [], quads: [], uploadTexture: (a, k, img) => { const t = { a, k, img }; r.uploads.push(t); return t; }, drawScreenQuad: (tex, rect) => r.quads.push(rect) }; return r; };

test('HT-WAIST: the first-person hand never holds the waist\'s lantern - no lantern frames, the hand slides off, draw() paints nothing; switch off, the lantern hand draws (mutant: the draw or the frame rule\'s waist leg dropped)', async () => {
  for (const [waist, drawn] of [[true, false], [false, true]]) {
    const renderer = fakeRenderer();
    const r = rig({ [WAIST]: waist, 'Modules.Sprite': true, 'Modules.Bob': false }, { renderer, loadSprite });
    const ln = lantern(); r.entity.items.push(ln); r.entity.lightSource = ln;
    r.frame(); await r.h._w.texturesLoading;
    r.frame(1); r.frame(1);
    assert.equal(r.h._w.textures.length, 8, 'the sprites are loaded - the draw has something it could paint');
    assert.equal(r.h._w.offsetFrame, waist ? -1 : 4, waist ? 'no hand frames for a lantern at the waist' : 'the lantern frames at 4');
    assert.equal(r.h.draw(renderer, r.ctx.canvas), drawn, waist ? 'nothing in the hand, nothing on the screen' : 'the lantern hand draws');
    assert.equal(renderer.quads.length, drawn ? 1 : 0);
  }
  // a TORCH under the switch is still the torch hand
  const renderer = fakeRenderer();
  const t = rig({ [WAIST]: true, 'Modules.Sprite': true, 'Modules.Bob': false }, { renderer, loadSprite });
  t.entity.items.push(torch()); t.entity.lightSource = t.entity.items[0];
  t.frame(); await t.h._w.texturesLoading; t.frame(1);
  assert.equal(t.h._w.offsetFrame, 0);
  assert.equal(t.h.draw(renderer, t.ctx.canvas), true, 'the torch is held and drawn');
});

// ═══ the light ═══════════════════════════════════════════════════════════

test('HT-WAIST: the light shines from the HIP - LANTERN_HIP in the yaw frame, over BOTH writers of the torch\'s override; a drawn body\'s point when one is handed in; a torch keeps TORCH_OFFSET; switch off, the lantern takes the override as before (mutant: the waist rule dropped or read after the override)', () => {
  _resetModSettings();
  setPlayerTorchOffsetOverride(null); setPlayerWaistLightOverride(null);
  try {
    const ln = lantern();
    const e = { lightSource: ln, items: [ln] };
    tickPlayerTorch(e, 0.016, { fromItems: true });
    const feet = [10, 0, 20];
    // off: the held lantern is where the flip's override says, else DFU's offset
    setPlayerTorchOffsetOverride({ ...TORCH_LIGHT_AT.lantern });
    let at = playerTorchLight(e, feet, 0);
    near(at.y, TORCH_LIGHT_AT.lantern.up, 'switch off: the override stands for a held lantern');
    // on: the hip, whatever the override says
    setModSetting(V, WAIST, true);
    at = playerTorchLight(e, feet, 0);
    near(at.x, 10 + LANTERN_HIP.left * -1); near(at.y, LANTERN_HIP.up); near(at.z, 20 + LANTERN_HIP.forward);
    assert.equal(at.carried, true, 'still the light in the hand\'s record - no glare, as MAC-T1 made it');
    assert.ok(LANTERN_HIP.left < 0, 'the RIGHT hip: clear of the scabbard on the left');
    // the yaw frame: a quarter turn carries the hip round with the body
    at = playerTorchLight(e, feet, Math.PI / 2);
    near(at.x, 10 + LANTERN_HIP.forward); near(at.z, 20 - (-LANTERN_HIP.left));
    // a drawn body's own point, when handed in (Eye Of The Beholder's sprite faces its walk, not the yaw)
    setPlayerWaistLightOverride({ left: -0.3, up: 0.8, forward: 0 });
    at = playerTorchLight(e, feet, 0);
    near(at.x, 10.3); near(at.y, 0.8); near(at.z, 20);
    setPlayerWaistLightOverride(null);
    // a torch lit a moment later never inherits the hip
    const t = torch();
    const et = { lightSource: t, items: [t] };
    tickPlayerTorch(et, 0.016, { fromItems: true });
    setPlayerTorchOffsetOverride(null);
    at = playerTorchLight(et, feet, 0);
    near(at.y, TORCH_OFFSET.up, 'the torch: DFU\'s own offset');
  } finally { setPlayerTorchOffsetOverride(null); setPlayerWaistLightOverride(null); _resetModSettings(); }
});

test('HT-WAIST: the Morrowind build is asked for the lantern at the hip off the same question - armBuildOptsOf\'s hipLight (mutant: the opt dropped or read off the torch)', () => {
  _resetModSettings();
  try {
    const ln = lantern();
    const ent = { race: 'Breton', gender: 'male', faceIndex: 0, items: [ln], lightSource: ln };
    assert.equal(armBuildOptsOf(ent).hipLight, false, 'the switch off: no lantern at the hip');
    assert.equal(armBuildOptsOf(ent).torch, false, 'and it is never the held torch');
    setModSetting(V, WAIST, true);
    assert.equal(armBuildOptsOf(ent).hipLight, true, 'on: the body is built with it');
    const t = torch();
    assert.equal(armBuildOptsOf({ ...ent, items: [t], lightSource: t }).hipLight, false, 'a torch is the hand\'s');
  } finally { _resetModSettings(); }
});

test('HT-WAIST: a lantern lit at the waist by any door (Use, a quickslot) is the light - a torch stowed earlier is not lit over it when a hand frees; switch off, the mod ends on the lantern too (mutant: the hand law\'s third arm left to relight the remembered torch)', () => {
  for (const onSwitch of [true, false]) {
    const r = rig({ [WAIST]: onSwitch });
    const tc = torch(), ln = lantern();
    r.entity.items.push(tc, ln); r.entity.lightSource = tc;
    r.frame();
    r.entity.equip = { slots: { [EQUIP_SLOTS.LeftHand]: weapon(WEAPONS.Long_Bow) } };
    r.frame();
    assert.equal(r.entity.lightSource, null, `${onSwitch}: the bow stowed the torch`);
    assert.equal(r.h.lastLightSource, tc, `${onSwitch}: and the mod remembers it`);
    r.entity.lightSource = ln;   // useItem's light arm / a quickslot: setLightSource, no key
    r.frame();
    r.entity.equip = { slots: {} };   // the bow put away: a hand frees
    r.frame(); r.frame();
    assert.equal(r.entity.lightSource, ln, `${onSwitch}: the lantern is still the light`);
    assert.notEqual(r.entity.lightSource, tc, `${onSwitch}: the stowed torch was not lit over it`);
  }
});
