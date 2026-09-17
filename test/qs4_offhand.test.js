// QS4 - THE OFF-HAND CELL'S PRESS, DRIVEN THROUGH THE MOD.
//
// Mac: "The 4th quickslot doesnt have a keybind". Three of the diamond's
// four corners named a key and the off hand did not - it spoke only
// through Handheld Torches' own TextKey, which the enhanced pane cannot
// rebind and no pad can carry. The cell has its own action now, and the
// ACT it performs is still the mod's: one door (`toggleLightPress`,
// the toggle key's own arm), so the free-hand guard, the relaxed-lantern
// carve-out and the refusal line have exactly one home.
//
// The pins below drive that door through a real component rather than
// reading it - the F-SING lesson this port has learned five times is
// that a pin on the parts is not a pin on the wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandheldTorches, MESSAGES, HANDHELD_TORCHES_VENDOR, readTorchSettings } from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { offHandQuickslot, QUICKSLOT_TEXT } from '../src/systems/quickslots.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const V = HANDHELD_TORCHES_VENDOR;
const defaults = () => Object.fromEntries(Object.entries(MOD_SETTINGS[V].keys).map(([k, d]) => [k, d.default]));
const torch = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50 });
const shield = () => ({ group: 'Armor', templateIndex: 109 });
const sword = () => ({ group: 'Weapons', templateIndex: 120 });

/** The component with a fake frame, the shape test/ht1_handheldtorches.js drives. */
function rig(over = {}) {
  const store = { ...defaults(), ...over };
  const said = [];
  const audio = { playOneShot() {}, loop: () => ({ stop() {} }), play3d() {} };
  const entity = { items: [], equip: { slots: {} }, lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const pool = { spawnLightSource() {}, spawnLightSourceProjectile() {}, setOnPickedUp() {} };
  const h = createHandheldTorches({
    settings: () => readTorchSettings(() => store), audio, say: (l) => said.push(l), rolls: () => 0.5, torches: () => pool,
    handedness: () => false, loadSprite: async () => null,
  });
  const ctx = {
    renderer: null, canvas: { width: 640, height: 400 }, entity, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, sheathWeapons: () => { ctx.sheathed = true; },
  };
  const frame = (dt = 0.016) => { h.update(dt, ctx); h.lateUpdate(dt, ctx); };
  return { h, entity, ctx, said, frame };
}

test('QS4: the off-hand press is the MOD\'s toggle - it lights, it douses, and a full hand refuses in the mod\'s own words', () => {
  const r = rig();
  r.entity.items.push(torch());
  r.frame();   // the component reads the hands before anything is pressed

  // LIGHT. The act is the mod's ToggleLightSourceAction, reached through
  // the same arm its own key reaches it by.
  assert.equal(r.h.toggleLightPress(), true);
  assert.equal(r.entity.lightSource, r.entity.items[0], 'the torch is in hand');
  // ...and DOUSE, the same press again.
  assert.equal(r.h.toggleLightPress(), true);
  assert.equal(r.entity.lightSource, null);
  assert.ok(r.said.some((l) => l.startsWith(MESSAGES.douse)), 'the mod said it put the torch out');

  // NO FREE HAND: a shield on the left and a sword drawn in the right.
  // The refusal is the MOD's line, and nothing is lit.
  r.entity.equip.slots[EQUIP_SLOTS.LeftHand] = shield();
  r.entity.equip.slots[EQUIP_SLOTS.RightHand] = sword();
  r.ctx.sheathed = false;
  r.frame();
  const before = r.said.length;
  assert.equal(r.h.toggleLightPress(), false, 'a full hand cannot take a torch');
  assert.equal(r.entity.lightSource, null);
  assert.equal(r.said.at(-1), MESSAGES.noFreeHand);
  assert.equal(r.said.length, before + 1, 'one line, the mod\'s own');
});

test('QS4: the model asks the door and says nothing over it - the one line it adds is the one the mod has none for', () => {
  const r = rig();
  const said = [];
  const say = (l) => said.push(l);
  const toggleLight = () => r.h.toggleLightPress();

  // A player carrying no light at all: the mod has no word for this
  // (its key simply does nothing), so the model has one - and the door
  // is never troubled.
  assert.deepEqual(offHandQuickslot({ entity: r.entity, say, toggleLight }), { kind: 'none' });
  assert.equal(said.at(-1), QUICKSLOT_TEXT.noLight);
  assert.equal(r.said.length, 0, 'the mod was not asked');

  // With a torch in the pack the press is the mod's, and its verdict is
  // the answer the host passes back to the key ladder.
  r.entity.items.push(torch());
  r.frame();
  // `lit` is the state AFTER the press - what is in the hand now.
  assert.deepEqual(offHandQuickslot({ entity: r.entity, say, toggleLight }), { kind: 'light', lit: true });
  assert.equal(r.entity.lightSource, r.entity.items[0]);
  // A LIT light counts as carrying one: the next press douses it.
  assert.deepEqual(offHandQuickslot({ entity: r.entity, say, toggleLight }), { kind: 'light', lit: false });
  assert.equal(r.entity.lightSource, null);
});

test('QS4: one home for the guard - the mod\'s own key and the port\'s action press the SAME arm', () => {
  const src = read('src/systems/handheldTorches.js');
  // The key poll does not restate the guard; it presses the door.
  assert.match(src, /if \(pressed\(w\.s\.toggleKey\)\) toggleLightPress\(\);/);
  assert.match(src, /function toggleLightPress\(\) \{[\s\S]*?if \(w\.s\.lanternRelaxed\) \{[\s\S]*?hasFreeHand\(\) \|\| contains\('UselessItems2', T\.Lantern\)[\s\S]*?\} else if \(hasFreeHand\(\)\)[\s\S]*?say\(MESSAGES\.noFreeHand\);\s*\n\s*return false;\s*\n\s*\}/);
  assert.equal((src.match(/MESSAGES\.noFreeHand\);/g) ?? []).length >= 1, true);
  // The rig's door is the only way the HUD reaches it, and the mod being
  // OFF is an answer rather than a throw.
  const rigSrc = read('src/combat/weaponRig.js');
  assert.match(rigSrc, /toggleLight\(\) \{ return handheldOn\(\) \? handheld\.toggleLightPress\(\) === true : false; \},/);
  // ...and no host lights a torch itself.
  for (const p of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(read(p), /toggleLightSourceAction/, `${p} reaches the act through the rig's door alone`);
  }
});
