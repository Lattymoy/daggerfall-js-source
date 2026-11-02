// FIELD BUGS 2026-10-21b BELT-WAIST (bible/01-Overview/bugs/Field-Bugs-2026-10-21b.md): "Equipping the lantern with O still
// puts it into your shield slot and not the lantern slot". The world hangs a lit lantern at the hip whenever the mod's
// switch says so (shipped on), and the inventory read the belt's mark alone - so the O key's lantern was drawn in the
// shield's hand and the lantern slot stood empty. Every fixture is minted by the shops' own shelves and every act is the
// game's own: the O key's press (Handheld Torches' toggleLightPress), the pack's Use and the hotbar's press.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockShopShelf } from '../../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { TEMPLATES } from '../../src/systems/item/itemKinds.js';
import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR } from '../../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';
import { equippedModel, LIGHT_SLOT, mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { withDom } from '../invdrag.mjs';
import { waistLanternOf, hangBeltLantern } from '../../src/systems/beltLantern.js';
import { useItem } from '../../src/systems/useItem.js';
import { equipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { isShieldTemplate } from '../../src/systems/armorMaterials.js';
import * as Q from '../../src/systems/quickslots.js';

const shelf = (bt) => stockShopShelf({ buildingType: bt, quality: 10 }, { level: 5 }, { rolls: () => 0, torchesFromItems: true, shelfIndex: 1 });
const mint = (t) => structuredClone(shelf(BUILDING_TYPES.GeneralStore).find((it) => it.templateIndex === t));
const mintShield = () => structuredClone(shelf(BUILDING_TYPES.Armorer).find((it) => it.group === 'Armor' && isShieldTemplate(it.templateIndex)));
const mintSword = () => structuredClone(shelf(BUILDING_TYPES.WeaponSmith).find((it) => it.group === 'Weapons' && /sword/i.test(it.name ?? '')));
const player = (items) => ({ isPlayer: true, items, equip: undefined, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [], level: 5, career: {} });

/** The mod's shipped settings (the waist switch on, HT-WAIST-ON), Handheld Torches enabled, `over` on top. */
const shipped = Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default]));
function rig(entity, over = {}, ctxOver = {}) {
  const said = [];
  const s = { ...shipped, Enabled: true, ...over };
  const ht = createHandheldTorches({ settings: () => readTorchSettings(() => s), audio: null, say: (t) => said.push(t), rolls: () => 0.5,
    torches: () => ({ spawnLightSource() {}, spawnLightSourceProjectile() {}, setOnPickedUp() {} }), handedness: () => false, loadSprite: async () => null });
  ht.update(0.016, { renderer: null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed: true, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 0, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, actionDown: () => false, sheathWeapons() {}, ...ctxOver });
  return { ht, said };
}
const handRow = (e) => equippedModel(e).rows.find((r) => r.slot === LIGHT_SLOT)?.item ?? null;

test('BELT-WAIST: the report - a lantern lit by O hangs in the lantern slot, never in the shield\'s hand', () => {
  const lantern = mint(TEMPLATES.Lantern);
  const e = player([lantern]);
  assert.equal(rig(e).ht.toggleLightPress(), true);
  assert.equal(e.lightSource, lantern, 'O lit it');
  assert.equal(lantern.beltLantern, undefined, 'and marked nothing - the switch hangs it');
  assert.equal(handRow(e), null, 'the hand\'s row (drawn in L·Hand, on the shield\'s panel) does not hold it');
  assert.equal(waistLanternOf(e), lantern, 'the lantern slot does');
});

test('BELT-WAIST: the shelf\'s Lantern socket DRAWS it, lit - the pane mounted, as the player opens it', () => {
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const lantern = mint(TEMPLATES.Lantern);
    const e = player([lantern]);
    rig(e).ht.toggleLightPress();
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    try {
      const sock = host.querySelectorAll('.shelfgrp-lantern')[0]?.querySelectorAll('.wornsock')[0];
      assert.ok(sock, 'the socket stands');
      assert.equal(sock.classList.contains('wornempty'), false, 'it holds the lantern (it stood empty, the open diamond)');
      assert.equal(sock.classList.contains('unlit'), false, 'lit');
    } finally { view.unmount(); }
  });
});

test('BELT-WAIST: the pack\'s Use (the card\'s Light, a double-click) lands it in the same slot', () => {
  const lantern = mint(TEMPLATES.Lantern);
  const e = player([lantern]);
  assert.equal(useItem(lantern, null, { entity: e }).kind, 'lit');
  assert.equal(handRow(e), null);
  assert.equal(waistLanternOf(e), lantern);
});

test('BELT-WAIST: a torch and a candle are held, as Handheld Torches holds them - still the hand\'s row', () => {
  for (const t of [TEMPLATES.Torch, TEMPLATES.Candle]) {
    const light = mint(t);
    const e = player([light]);
    rig(e).ht.toggleLightPress();
    assert.equal(e.lightSource, light);
    assert.equal(handRow(e), light, `${light.name} in the hand`);
    assert.equal(waistLanternOf(e), null);
  }
});

test('BELT-WAIST: O lights the lantern hung in the slot, never another one ahead of it in the pack', () => {
  const pack = mint(TEMPLATES.Lantern), hung = mint(TEMPLATES.Lantern);
  const e = player([pack, hung]);
  assert.equal(hangBeltLantern(e, hung), true);
  rig(e).ht.toggleLightPress();
  assert.equal(e.lightSource, hung, 'the hung lantern is lit');
  assert.equal(waistLanternOf(e), hung);
  assert.equal(handRow(e), null);
});

test('BELT-WAIST: O remembering a lantern (the mod\'s last-light) still takes the hung one', () => {
  const pack = mint(TEMPLATES.Lantern), hung = mint(TEMPLATES.Lantern);
  const e = player([pack, hung]);
  hangBeltLantern(e, hung);
  const { ht } = rig(e, { 'Handling.RememberLastLightSource': true });
  ht.toggleLightPress();
  ht.toggleLightPress();   // douse - the kind remembered
  assert.equal(e.lightSource, null);
  ht.toggleLightPress();
  assert.equal(e.lightSource, hung);
});

test('BELT-WAIST: a hung lantern takes no hand with the switch off - a shield and a drawn sword do not refuse it', () => {
  const hung = mint(TEMPLATES.Lantern), shield = mintShield(), sword = mintSword();
  const e = player([sword, shield, hung]);
  equipItem(e, sword);
  equipItem(e, shield);
  hangBeltLantern(e, hung);
  const { ht, said } = rig(e, { 'Handling.LanternsAtWaist': false }, { sheathed: false });
  assert.equal(ht.toggleLightPress(), true, `refused: ${JSON.stringify(said)}`);
  assert.equal(e.lightSource, hung);
  assert.equal(e.equip.slots[EQUIP_SLOTS.LeftHand], shield, 'the shield stays');
  // and with the switch off, an unhung lantern still asks a hand: the slot's lantern alone answers the waist
  const loose = mint(TEMPLATES.Lantern), shield2 = mintShield(), sword2 = mintSword();
  const e2 = player([sword2, shield2, loose]);
  equipItem(e2, sword2);
  equipItem(e2, shield2);
  assert.equal(rig(e2, { 'Handling.LanternsAtWaist': false }, { sheathed: false }).ht.toggleLightPress(), false);
  assert.equal(e2.lightSource, null);
});

test('BELT-WAIST: the hotbar\'s lantern slot lights it at the waist and leaves the shield on (SHIELD1 is a hand\'s law)', () => {
  const lantern = mint(TEMPLATES.Lantern), shield = mintShield();
  const e = player([shield, lantern]);
  equipItem(e, shield);
  Q.clearHotbar();
  Q.setHotbarSlot(0, Q.hotbarEntryForItem(lantern));
  const r = Q.hotbarPress(0, { entity: e, doors: { quickUse: () => Q.useQuickslot('c1', { entity: e }) }, say: () => {} });
  assert.equal(r.kind, 'light');
  assert.equal(e.lightSource, lantern);
  assert.equal(e.equip.slots[EQUIP_SLOTS.LeftHand], shield, 'the shield was not taken off');
  // nor does a weapon in the off hand refuse it (two daggers, the second in the left hand)
  const dagger = structuredClone(shelf(BUILDING_TYPES.WeaponSmith).find((it) => it.group === 'Weapons' && /dagger/i.test(it.name ?? '')));
  const lantern3 = mint(TEMPLATES.Lantern);
  const e3 = player([dagger, structuredClone(dagger), lantern3]);
  equipItem(e3, e3.items[0]);
  equipItem(e3, e3.items[1]);
  assert.equal(Q.quickslotView(e3).off.kind, 'weapon');
  Q.clearHotbar();
  Q.setHotbarSlot(0, Q.hotbarEntryForItem(lantern3));
  assert.equal(Q.hotbarPress(0, { entity: e3, doors: { quickUse: () => Q.useQuickslot('c1', { entity: e3 }) }, say: () => {} }).kind, 'light');
  assert.equal(e3.lightSource, lantern3);
  // a torch's slot still takes the shield off first - it is held
  const torch = mint(TEMPLATES.Torch), shield2 = mintShield();
  const e2 = player([shield2, torch]);
  equipItem(e2, shield2);
  Q.clearHotbar();
  Q.setHotbarSlot(0, Q.hotbarEntryForItem(torch));
  Q.hotbarPress(0, { entity: e2, doors: { quickUse: () => Q.useQuickslot('c1', { entity: e2 }) }, say: () => {} });
  assert.equal(e2.lightSource, torch);
  assert.notEqual(e2.equip.slots?.[EQUIP_SLOTS.LeftHand], shield2);
  Q.clearHotbar();
});
