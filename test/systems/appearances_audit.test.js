// AUDIT HORIZONTAL E (2026-10-27, the owner: "Audit this", of the horizontal-progression pull request; bible/04-Characters/
// Wardrobe.md, bible/10-UI/Collections.md section 9): lane E's findings on the wardrobe, each pinned where its fix lives -
// a peer's re-dressed weapon (E1), the first-person shield (E2), the catalogue's unmade look (E3), the Collections part's
// words (E4), a Light Flail at the Wardrobe (E5) and a W held at a shop's popup (E7). E6's pin is the doll's own
// (test/ui/appearances2_preview.test.js); E8, E9 and E10 are records.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PeerBodies, peerBuildOpts } from '../../src/net/peer/peerBodies.js';
import { validLook } from '../../src/net/wire.js';
import { createFpArm } from '../../src/combat/fpArm.js';
import { fixtureBodyDeps, countingRenderer } from '../fixtures/mw/bodyRig.mjs';
import { createWeaponRig } from '../../src/combat/weapon/weaponRig.js';
import { shieldTextureIndex, shieldTextureName, isPartShielded } from '../../src/combat/shieldWidget.js';
import { shieldProtectedBodyParts, createWeapon } from '../../src/combat/enemyEquipment.js';
import { ALL_LOOKS, lookCode, lookOfPiece, ARMOR_LOOK_MATERIALS, WEAPON_LOOK_MATERIALS, lookOfKey } from '../../src/net/appearanceLaw.js';
import { randomizeArmorVariant } from '../../src/systems/shopStock.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { LOOK_WORDS, everyMintMakes } from '../../src/ui/collections/appearancesPart.js';
import { wardrobePieces, lookName } from '../../src/systems/appearances.js';
import { MerchantServiceWindow } from '../../src/ui/merchant/merchantServiceWindow.js';
import { MerchantRepairWindow } from '../../src/ui/merchant/merchantRepairWindow.js';
import { routeKey } from '../../src/ui/input.js';
import { equipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';

const armour = (templateIndex, material, variant = 0) => mintCondition(setItemFields({ group: 'Armor', templateIndex, material, variant }));
const settle = (ms = 0) => new Promise((r) => setTimeout(r, ms));

test('AUDIT HORIZONTAL E1: a peer re-dressing the weapon in hand - or taking up its twin in another metal - puts the new one in my copy of their body\'s hand, and its glow stays lit (mutants: the hand\'s key blind to the look; blind to the metal)', async () => {
  const sword = { templateIndex: 120, group: 'Weapons', material: 1, equipSlot: EQUIP_SLOTS.RightHand };
  const look = (it) => validLook({ race: 'Breton', gender: 'male', faceIndex: 0, items: [it] });
  const set = [];
  const fake = { setSheathed() {}, readySpell() {}, release() {}, upperBodyReady: () => true, setWeapon: (w) => { set.push(w ? [w.templateIndex, w.material, w.appearance ?? null] : null); return true; }, setOffWeapon() {}, setHands() {}, setWeaponGlow() {}, setOffWeaponGlow() {}, setSpellHand() {}, setHipLight() {} };
  const pb = new PeerBodies({ renderer: {}, createRig: () => fake, buildOpts: peerBuildOpts });
  const b = { weapon: null, ammo: 0, held: false, swing: null, cast: null, rig: fake };
  pb._arm(b, { wd: 1, an: 0, cn: 0 }, look(sword));
  pb._arm(b, { wd: 1, an: 0, cn: 0 }, look({ ...sword }));
  assert.equal(set.length, 1, 'the same weapon in a new look object: no swap');
  pb._arm(b, { wd: 1, an: 0, cn: 0 }, look({ ...sword, ap: [121, 7, 0] }));
  assert.deepEqual(set.at(-1), [120, 1, { t: 121, m: 7, v: 0 }], 're-dressed: the hand takes the longsword in its new look');
  pb._arm(b, { wd: 1, an: 0, cn: 0 }, look({ ...sword, material: 7, ap: [121, 7, 0] }));
  assert.deepEqual(set.at(-1), [120, 7, { t: 121, m: 7, v: 0 }], 'its twin in Ebony: the hand takes it');
  // the real rig on the fixture data: the glow the owner's card shows stays on the weapon re-dressed
  const lit = { ...sword, glow: 'fire2' };
  const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });
  const rig = createFpArm(); rig.attach(countingRenderer(), cam);
  const first = peerBuildOpts(look(lit));
  assert.equal((await rig.build({ race: 'fprace', deps: fixtureBodyDeps(), weapon: first.weapon })).ok, true);
  const run = () => { for (let i = 0; i < 200; i++) rig.update(0.05); };
  rig.setSheathed(false); run();
  const real = new PeerBodies({ renderer: {}, createRig: () => rig, buildOpts: peerBuildOpts });
  const body = { weapon: first.weapon, ammo: 0, held: false, swing: null, cast: null, rig };
  real._arm(body, { wd: 1, an: 0, cn: 0 }, look(lit)); await settle(20); run();
  assert.ok(rig.weaponGlow(), 'before: the owner\'s fire glows on my copy');
  real._arm(body, { wd: 1, an: 0, cn: 0 }, look({ ...lit, ap: [121, 7, 0] })); await settle(20); run();
  real._arm(body, { wd: 1, an: 0, cn: 0 }, look({ ...lit, ap: [121, 7, 0] })); run();
  assert.deepEqual(body.weapon.appearance, { t: 121, m: 7, v: 0 }, 'the body holds the look');
  assert.ok(rig.weaponGlow(), 'and its glow stays lit');
  rig.unload();
});

test('AUDIT HORIZONTAL E2: the first-person shield (Shield Widget) is drawn as the look its shield wears, and covers the parts the shield itself covers (mutants: the sprite the piece\'s; the cover the look\'s)', () => {
  _resetModSettings();
  setModSetting('shield-widget', 'Enabled', true);
  try {
    const buckler = armour(109, ARMOR_MATERIAL.Iron);
    const entity = { items: [buckler], stats: { speed: 50 } };
    equipItem(entity, buckler);
    buckler.appearance = { t: 112, m: ARMOR_MATERIAL.Daedric, v: 0 };
    const r = createWeaponRig({
      renderer: { uploadTexture: () => null, drawScreenQuad: () => {} }, canvas: { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 },
      fetchBytes: () => { throw new Error('no art in tests'); }, palette: null, audio: { playOneShot() {} }, entity,
      camera: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { baseSpeed: 3, grounded: true, standing: true } }),
    });
    const fed = [];
    const real = r.shield.lateUpdate;
    r.shield.lateUpdate = (ctx) => { fed.push(ctx.item); return real(ctx); };
    r.frame(1 / 60);
    const item = fed.at(-1);
    assert.ok(item, 'the widget was fed its shield');
    const name = (it) => shieldTextureName(shieldTextureIndex(it, 60, 30));
    const tower = { templateIndex: 112, nativeMaterialValue: ARMOR_MATERIAL.Daedric, conditionPercentage: item.conditionPercentage, isShield: true };
    assert.deepEqual(name(item), name(tower), 'the Daedric Tower Shield\'s sprite');
    const towerOnly = shieldProtectedBodyParts(112).filter((p) => !shieldProtectedBodyParts(109).includes(p));
    assert.ok(towerOnly.length > 0, 'a part a tower shield covers and a buckler does not');
    assert.equal(isPartShielded(item, towerOnly[0]), false, 'the buckler covers what a buckler covers');
    for (const p of shieldProtectedBodyParts(109)) assert.equal(isPartShielded(item, p), true);
  } finally { _resetModSettings(); }
});

/** Every look any mint can make: loot, a corpse and the smith (no style rolled), and a shelf, the Create Item spell and a
 *  Roleplay & Realism kit (systems/shopStock.js randomizeArmorVariant, over every roll it can draw). */
function mintable() {
  const reach = new Set();
  const note = (it) => { const a = lookOfPiece(it); if (a) reach.add(lookCode(a)); };
  for (let t = 102; t <= 112; t++) for (const m of ARMOR_LOOK_MATERIALS) {
    note(armour(t, m));
    for (let k = 0; k < 64; k++) note(armour(t, m, randomizeArmorVariant(t, m, () => k / 64)));
  }
  for (let t = 113; t <= 130; t++) for (const m of WEAPON_LOOK_MATERIALS) note(createWeapon(t, m));
  return reach;
}

test('AUDIT HORIZONTAL E3: the catalogue is the looks a mint makes - each of the 473 can be held, and every look a mint makes is one; chain boots\' second style, which none makes, is none (mutant: the unmade style kept)', () => {
  const reach = mintable();
  const all = new Set(ALL_LOOKS.map(lookCode));
  assert.deepEqual([...all].filter((k) => !reach.has(k)), [], 'every look can be collected');
  assert.deepEqual([...reach].filter((k) => !all.has(k)), [], 'and every look made is in it');
  assert.equal(ALL_LOOKS.length, 473);
  assert.equal(lookOfKey(`108.${ARMOR_MATERIAL.Chain}.2`), null);
  assert.ok(lookOfKey(`108.${ARMOR_MATERIAL.Chain}.1`), 'chain boots: one look');
});

test('AUDIT HORIZONTAL E4: a look not held says how it is had in plain English - no "Hold a" before a name; a style past the first, which loot and the smith never make, is a shop\'s (mutants: the shop\'s style said as anyone\'s; the style-1 look said as the shop\'s)', () => {
  const words = (key) => (everyMintMakes(lookOfKey(key)) ? LOOK_WORDS.howGet : LOOK_WORDS.howBuy)(lookName(lookOfKey(key)));
  assert.equal(words('107.512.3'), 'To collect Iron Helm, style 4: buy it at a shop.');
  assert.equal(words('107.512.0'), 'To collect Iron Helm, style 1: buy it, find it or make it.');
  assert.equal(words('102.515.1'), 'To collect Elven Cuirass, style 1: buy it, find it or make it.', 'a plate cuirass\'s first style is the one a piece minted with none draws');
  assert.equal(words('102.515.2'), 'To collect Elven Cuirass, style 2: buy it at a shop.');
  assert.equal(words('104.0.1'), 'To collect Leather Greaves, style 2: buy it at a shop.');
  assert.equal(words('127.0.0'), 'To collect Iron Battle Axe: buy it, find it or make it.');
  assert.equal(words('103.513.1'), 'To collect Steel Gauntlets: buy it, find it or make it.');
  // the shop's styles are exactly the looks no style-less mint makes
  const plain = new Set();
  for (let t = 102; t <= 112; t++) for (const m of ARMOR_LOOK_MATERIALS) { const a = lookOfPiece(armour(t, m)); if (a) plain.add(lookCode(a)); }
  for (const a of ALL_LOOKS) if (a.t <= 112) assert.equal(everyMintMakes(a), plain.has(lookCode(a)), lookCode(a));
});

test('AUDIT HORIZONTAL E5: a worn piece of a kind no look is of (Roleplay & Realism\'s Light Flail) is not offered at the Wardrobe (mutant: any kind listed)', () => {
  _resetModSettings();
  setModSetting('roleplay-realism-items', 'Enabled', true);
  try {
    const flail = createWeapon(514, 3), chest = armour(102, ARMOR_MATERIAL.Iron);
    const me = { items: [flail, chest] };
    equipItem(me, flail); equipItem(me, chest);
    assert.deepEqual(wardrobePieces(me).map((p) => p.kind), ['chest'], 'the cuirass alone');
  } finally { _resetModSettings(); }
});

test('AUDIT HORIZONTAL E7: a key held as a shop\'s popup opens (W walking forward, S back) runs no row - its repeats are no press; a press begun under the popup still does (mutants: the repeat read as a press, on either popup)', () => {
  let opened = 0, served = 0;
  const hooks = { service: 'Sell', onTalk() {}, onService() { served++; }, onRepair() {}, onSell() {}, wardrobe: { label: 'Wardrobe', onOpen: () => { opened++; } }, portal: { label: 'Portal Stone', onBuy() {} } };
  for (const Win of [MerchantServiceWindow, MerchantRepairWindow]) {
    const win = new Win({ ...hooks });
    const ctx = { uiOverlayActive: true, overlayIsNative: true, overlayInput: (code, e) => win.input(code, e), overlayWindow: () => win };
    routeKey({ code: 'KeyW', key: 'w', repeat: true, target: null, preventDefault() {} }, ctx);
    routeKey({ code: 'KeyS', key: 's', repeat: true, target: null, preventDefault() {} }, ctx);
    assert.deepEqual([opened, served, win.done], [0, 0, false], `${Win.name}: a held key does nothing`);
    routeKey({ code: 'KeyW', key: 'w', repeat: false, target: null, preventDefault() {} }, ctx);
    assert.deepEqual([opened, win.done], [1, true], `${Win.name}: W pressed opens the Wardrobe`);
    opened = 0;
  }
});
