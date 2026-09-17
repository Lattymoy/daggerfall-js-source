// HT6 (2026-09-17, Mac: "When equipping a shield or other offhand item,
// the torch in the inventory isnt shown unequipped and replaced") - THE
// HAND LAW AT THE EQUIP MOMENT.
//
// Handheld Torches keeps the lit light in ONE place, entity.lightSource,
// and never in the equip table - so equipping a shield does not touch
// it. What stows it is the mod's hand law, and that law runs in Update.
// The hosts do not run the weapon rig's frame while an overlay holds
// the game (worldModes' `overlayHeld ? [] : interiorWeapon.frame(dt)`),
// so with the inventory window OPEN the law never ran, and the window
// went on painting a lit torch beside the shield the player had just
// put on that hand.
//
// The fix runs the mod's OWN block at the equip change (equip.js's
// listener, fired inside equipItem / unequipSlot) instead of waiting
// for a frame. These pins DRIVE it: the component gets a frame, then a
// shield goes on through equipItem and what happens to
// entity.lightSource is read with NO further frame - which is exactly
// the paused window's case.
//
// The mod's 1:1 law is unchanged and pinned here as it stands: with the
// weapon SHEATHED a shield in the left hand leaves a hand free
// (UpdateFreeHand 0x2c91-0x2cb8 takes the left only for a BOW), so the
// torch stays lit until the weapon is drawn. That is the mod's, not the
// port's, and no departure is made from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR, ON_STOW } from '../src/systems/handheldTorches.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { equipItem, unequipSlot, equipTableOf, EQUIP_SLOTS } from '../src/systems/equip.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { itemLine } from '../src/ui/enhancedInventory.js';
import { quickslotView, clearQuickslots } from '../src/systems/quickslots.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const V = HANDHELD_TORCHES_VENDOR;
const T = TEMPLATES;
const defaults = () => Object.fromEntries(Object.entries(MOD_SETTINGS[V].keys).map(([k, d]) => [k, d.default]));

const torch = (cond = 50) => ({ group: 'UselessItems2', templateIndex: T.Torch, name: 'Torch', currentCondition: cond, maxCondition: 50 });
const lantern = () => ({ group: 'UselessItems2', templateIndex: T.Lantern, name: 'Lantern', currentCondition: 100, maxCondition: 100 });
const shield = () => ({ group: 'Armor', templateIndex: 109, material: 0x0200, name: 'Buckler', currentCondition: 100, maxCondition: 100 });
const weapon = (t) => ({ group: 'Weapons', templateIndex: t, material: 0, currentCondition: 100, maxCondition: 100 });

/**
 * The same frame the rig feeds the component (ht1's harness), with ONE
 * difference that this file needs: the entity carries the REAL equip
 * table, lazily minted by equip.js, because these pins go through
 * equipItem rather than writing slots by hand.
 */
function rig(over = {}) {
  const store = { ...defaults(), ...over };
  const said = [];
  const audio = {
    playOneShot: () => {}, loop: () => ({ stop() {} }), play3d: () => {},
  };
  const entity = { items: [], lightSource: null, stats: { speed: 50, strength: 50 }, activeEffects: [] };
  const pool = { spawned: [], spawnLightSource: (t, p, time) => pool.spawned.push({ t, p, time }), spawnLightSourceProjectile: () => {}, setOnPickedUp() {} };
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
  return { h, store, said, entity, pool, ctx, frame };
}

/** A lit torch in the pack, one frame run - the player holding a torch. */
function holding(over = {}) {
  const r = rig(over);
  const t = torch();
  r.entity.items.push(t);
  r.entity.lightSource = t;
  r.frame();
  assert.equal(r.entity.lightSource, t, 'the torch is lit before the shield');
  return { ...r, t };
}

test.beforeEach(() => clearQuickslots());

test('HT6: a shield equipped with the weapon DRAWN stows the torch AT THE EQUIP MOMENT - no frame in between, which is what a paused window has', () => {
  // OnStow Unequip, so the stow is readable in both directions.
  const r = holding({ 'Handling.OnStow': ON_STOW.Unequip });
  r.ctx.sheathed = false;
  const sh = shield();
  r.entity.items.push(sh);
  equipItem(r.entity, sh);
  // NO frame here. This is the state the enhanced inventory renders from.
  assert.equal(r.entity.lightSource, null, 'the light is stowed by equipItem itself');
  assert.equal(r.h.lastLightSource, r.t, 'the mod remembers the light to take back up');
  assert.equal(equipTableOf(r.entity)[EQUIP_SLOTS.LeftHand], sh, 'the shield is worn');
  assert.ok(r.entity.items.includes(r.t), 'Unequip keeps the torch in the pack');
  // THE OTHER DIRECTION: the shield comes off, the hand frees, the mod
  // takes the light back up - again with no frame in between.
  unequipSlot(r.entity, EQUIP_SLOTS.LeftHand);
  assert.equal(r.entity.lightSource, r.t, 'the torch is lit again by unequipSlot itself');
  assert.equal(r.h.lastLightSource, null, 'and the memory is spent');
});

test('HT7 (Mac: "Take care of both"): the port DEFAULTS to Unequip - a shield equipped while drawn puts the lit torch back in the pack and remembers it; the mod\'s Drop is still on the dial and still drops it exactly where the mod does', () => {
  // HT6 recorded the consequence of keeping the mod's shipped `OnStow =
  // Drop` once the hand law ran at the equip moment: equipping a shield
  // with your weapon drawn puts the lit torch on the DUNGEON FLOOR, in
  // front of you, while the inventory is still open. A player who equips
  // a shield mid-fight has not asked to drop anything. Mac's decision.
  assert.equal(MOD_SETTINGS[V].keys['Handling.OnStow'].default, ON_STOW.Unequip, 'the PORT\'s default');
  assert.deepEqual([...MOD_SETTINGS[V].keys['Handling.OnStow'].options], ['Unequip', 'Drop'],
    'and the mod\'s own value is one click away, in the mod\'s own order');

  // THE DEFAULT, driven: the light is stowed, the PACK KEEPS IT, and it
  // is REMEMBERED - which is what lights it again when a hand comes free.
  const r = holding();
  r.ctx.sheathed = false;
  const sh = shield();
  r.entity.items.push(sh);
  equipItem(r.entity, sh);
  assert.equal(r.entity.lightSource, null, 'the hand is taken, so the light is stowed');
  assert.deepEqual(r.pool.spawned, [], 'NOTHING was dropped on the floor');
  assert.equal(r.entity.items.includes(r.t), true, 'the pack still has the torch');
  assert.equal(r.h.lastLightSource, r.t, 'and it is remembered, which is the whole point of Unequip');
  // ...and the hand coming free lights it again, at the unequip moment.
  unequipSlot(r.entity, EQUIP_SLOTS.LeftHand);
  assert.equal(r.entity.lightSource, r.t, 'the shield off, the remembered light comes back up');

  // THE DIAL, driven: set to the mod's own value, the Drop arm is
  // untouched - the pool takes it, the pack loses it, nothing remembers.
  const d = holding({ 'Handling.OnStow': ON_STOW.Drop });
  d.ctx.sheathed = false;
  const sh2 = shield();
  d.entity.items.push(sh2);
  equipItem(d.entity, sh2);
  assert.equal(d.entity.lightSource, null);
  assert.equal(d.pool.spawned.length, 1, 'the dropped-torch pool took it, where the mod drops it');
  assert.equal(d.entity.items.includes(d.t), false, 'and the pack lost it - DropLightSource removes it');
  assert.equal(d.h.lastLightSource, null, 'a dropped light is not remembered');
});

test('HT7 (Mac: "Take care of both"): SHEATHED, a shield takes the hand TOO - the port\'s one departure from UpdateFreeHand\'s sheathed arm (0x2c91-0x2cb8), which cleared a hand for a bow alone', () => {
  const r = holding({ 'Handling.OnStow': ON_STOW.Unequip });
  r.ctx.sheathed = true;
  // MAC'S CASE, which is a player walking around: a sword worn and a
  // shield going on, the weapon lowered rather than drawn. Daggerfall has
  // no back sheath - "sheathed" is a stance, the sword is still in the
  // hand - so both hands are taken and the torch has nowhere to be.
  const sw = weapon(WEAPONS.Longsword);
  r.entity.items.push(sw);
  equipItem(r.entity, sw);
  r.frame();
  const sh = shield();
  r.entity.items.push(sh);
  equipItem(r.entity, sh);
  // THE DEPARTURE. The mod's sheathed arm clears the left hand only for a
  // BOW, so a shield took nothing and the torch stayed lit in the arm the
  // shield had just gone onto. HT6 recorded that and defended it - a
  // Daggerfall shield is ARMOUR, strapped rather than gripped - and
  // flagged it for Mac, whose ORIGINAL report was that very case ("When
  // equipping a shield or other offhand item, the torch in the inventory
  // isnt shown unequipped and replaced"). A hand holding a shield is not
  // free, sheathed or drawn.
  assert.equal(r.entity.lightSource, null, 'sheathed, the shield takes the hand and the torch is stowed');
  assert.equal(r.h.hasFreeHand, false);
  assert.equal(r.h.lastLightSource, r.t, 'remembered, because the port\'s OnStow is Unequip');
  assert.deepEqual(r.pool.spawned, [], 'and nothing on the floor');
  // ...and taking the shield off gives the hand back, at the unequip
  // moment, sheathed throughout - the reverse of the same law.
  unequipSlot(r.entity, EQUIP_SLOTS.LeftHand);
  assert.equal(r.entity.lightSource, r.t, 'the shield off, the remembered light comes back up');
  // Drawing the weapon changes nothing here: the hands were already taken.
  equipItem(r.entity, sh);
  r.ctx.sheathed = false;
  r.frame();
  assert.equal(r.entity.lightSource, null, 'still stowed with the weapon drawn');
  assert.equal(r.h.lastLightSource, r.t);

  // AND THE CASE THAT IS NOT A DEPARTURE, kept beside it so the rule is
  // not read as "a shield always stows the torch": with NO weapon worn,
  // the right hand is genuinely free and the light moves into it. That
  // is the mod's law, it is true of this game, and it is the reason the
  // clause above is about what is WORN rather than about shields.
  const f = holding({ 'Handling.OnStow': ON_STOW.Unequip });
  f.ctx.sheathed = true;
  f.frame();
  const sh2 = shield();
  f.entity.items.push(sh2);
  equipItem(f.entity, sh2);
  assert.equal(f.entity.lightSource, f.t, 'no weapon worn: the free right hand takes the torch');
  assert.equal(f.h.hasFreeHand, true);
  // A BOW, and what it really does - measured rather than assumed. This
  // block's comment used to say "a bow left, a shield bumped off by it";
  // the bow is EITHER-handed here, so `equipItem` evicts the longsword
  // and takes the RIGHT slot, leaving the left empty. The left hand is
  // therefore free and the torch stays lit - which was true before HT7
  // and is true after it, because HT7 only changed what a WORN item does
  // and nothing is worn on that side.
  //
  // It is kept because it is the shape that would catch HT7 over-reaching
  // into "a weapon anywhere stows the light", which is not the rule.
  const b = rig({ 'Handling.OnStow': ON_STOW.Unequip });
  const bt = torch();
  b.entity.items.push(bt); b.entity.lightSource = bt;
  b.ctx.sheathed = true;
  b.frame();
  const sword = weapon(WEAPONS.Longsword), bow = weapon(WEAPONS.Long_Bow);
  b.entity.items.push(sword, bow);
  equipItem(b.entity, sword);
  equipItem(b.entity, bow);
  assert.equal(equipTableOf(b.entity)[EQUIP_SLOTS.LeftHand] ?? null, null, 'the bow took the RIGHT slot and evicted the sword');
  assert.equal(b.entity.lightSource, bt, 'the left hand is free, so the torch stays lit');
  assert.equal(b.h.hasFreeHand, true);
  // ...and put something in that hand and it goes, which is HT7.
  const bsh = shield();
  b.entity.items.push(bsh);
  equipItem(b.entity, bsh);
  // ...and putting a SHIELD on bumps the two-hander out of the right
  // slot, which hands the torch the hand the bow was using. Measured, and
  // kept as the boundary of HT7: what is WORN takes a hand, so an EMPTY
  // hand is free whatever was in it a moment ago.
  assert.equal(equipTableOf(b.entity)[EQUIP_SLOTS.LeftHand], bsh, 'the shield is on the left');
  assert.equal(equipTableOf(b.entity)[EQUIP_SLOTS.RightHand] ?? null, null, 'and the bow was bumped out of the right');
  assert.equal(b.entity.lightSource, bt, 'so the right hand is free again and the torch is back up');
  assert.equal(b.h.hasFreeHand, true);
});

test('HT6: a relaxed lantern is not stowed by the equip moment either - the same three arms, one block', () => {
  const r = rig({ 'Handling.RelaxedLanterns': true, 'Handling.OnStow': ON_STOW.Unequip });
  const ln = lantern();
  r.entity.items.push(ln); r.entity.lightSource = ln;
  r.ctx.sheathed = false;
  r.frame();
  const sh = shield();
  r.entity.items.push(sh);
  equipItem(r.entity, sh);
  assert.equal(r.entity.lightSource, ln, 'the relaxed lantern rests on the belt, hands or no hands');
  // Not relaxed, the same equip stows it and says so.
  const s = rig({ 'Handling.RelaxedLanterns': false, 'Handling.OnStow': ON_STOW.Unequip });
  const ln2 = lantern();
  s.entity.items.push(ln2); s.entity.lightSource = ln2;
  s.ctx.sheathed = false;
  s.frame();
  const sh2 = shield();
  s.entity.items.push(sh2);
  equipItem(s.entity, sh2);
  assert.equal(s.entity.lightSource, null, 'a lantern with nowhere to rest is stowed');
  assert.ok(s.said.some((l) => /can't hold a light source/.test(l)), 'and the mod says its own line');
});

test('HT6: the equip moment reads the settings FRESH, as Update does - a dial moved since the last frame is the one the law obeys', () => {
  // The shipped Drop, one frame, then the player sets Unequip on the
  // Mods pane and equips a shield without a frame in between. The store
  // is live, so the law must read it now and stow rather than drop.
  const r = holding();
  r.ctx.sheathed = false;
  r.store['Handling.OnStow'] = ON_STOW.Unequip;
  const sh = shield();
  r.entity.items.push(sh);
  equipItem(r.entity, sh);
  assert.equal(r.pool.spawned.length, 0, 'nothing was dropped');
  assert.equal(r.h.lastLightSource, r.t, 'it was stowed, by the dial as it stands');
  assert.ok(r.entity.items.includes(r.t));
});

test('HT6: the equip change reaches only the LIVE component - no frame yet, another host\'s wearer, and a disposed one all leave the light alone', () => {
  // A component that has never had a frame has no ctx, so it cannot
  // read sheathed/usingRightHand and must not act.
  const cold = rig({ 'Handling.OnStow': ON_STOW.Unequip });
  const ct = torch();
  cold.entity.items.push(ct); cold.entity.lightSource = ct;
  const cs = shield();
  cold.entity.items.push(cs);
  equipItem(cold.entity, cs);
  assert.equal(cold.entity.lightSource, ct, 'no frame has run, so nothing applies the law');

  // TWO HOSTS, each with its own wearer. The second one to run a frame
  // is the live one; the first still holds its own stale ctx. An equip
  // change for a wearer that is not the live component's must move
  // NEITHER light - not the one it was fired for (that host is not
  // live) and not the live component's own (it was not fired for it).
  const a = holding({ 'Handling.OnStow': ON_STOW.Unequip });
  a.ctx.sheathed = false;
  const b = holding({ 'Handling.OnStow': ON_STOW.Unequip });
  b.ctx.sheathed = false;
  // b's wearer already has a shield on the hand, written into the table
  // without firing the change - so b's law WOULD stow b's torch the
  // moment anything asked it to.
  equipTableOf(b.entity)[EQUIP_SLOTS.LeftHand] = shield();
  const ash = shield();
  a.entity.items.push(ash);
  equipItem(a.entity, ash);
  assert.equal(a.entity.lightSource, a.t, 'the stale host does not answer for its own wearer');
  assert.equal(b.entity.lightSource, b.t, 'and the live host does not answer with ITS wearer for someone else\'s change');
  // b's own wearer changing IS b's business.
  const bsh = shield();
  b.entity.items.push(bsh);
  equipItem(b.entity, bsh);
  assert.equal(b.entity.lightSource, null, 'the live host answers for its own');

  // AUDIT 66 F8's teardown: the mod switched off disposes the
  // component, and a disposed one stops answering.
  const d = holding({ 'Handling.OnStow': ON_STOW.Unequip });
  d.ctx.sheathed = false;
  d.h.dispose();
  const dsh = shield();
  d.entity.items.push(dsh);
  equipItem(d.entity, dsh);
  assert.equal(d.entity.lightSource, d.t, 'a disposed component leaves the light alone');
  // A frame puts it back in charge.
  d.frame();
  assert.equal(d.entity.lightSource, null, 'and a frame makes it live again');

  // And a teardown silences ONLY its own component: the other host
  // being disposed must not take the live host's answer with it.
  const p = holding({ 'Handling.OnStow': ON_STOW.Unequip });
  p.ctx.sheathed = false;
  const q = holding({ 'Handling.OnStow': ON_STOW.Unequip });   // q framed last, so q is live
  q.ctx.sheathed = false;
  p.h.dispose();
  const qsh = shield();
  q.entity.items.push(qsh);
  equipItem(q.entity, qsh);
  assert.equal(q.entity.lightSource, null, 'the other host\'s teardown does not silence the live one');
});

test('HT6: the rule is not restated - the hand law lives in ONE block, and the equip seam calls it', () => {
  const src = read('src/systems/handheldTorches.js');
  assert.equal(src.match(/w\.s\.onStow > ON_STOW\.Unequip/g)?.length, 1, 'the stow-or-drop choice is written once');
  assert.equal(src.match(/function handLaw\(/g)?.length, 1, 'and it is the one block both callers run');
  assert.equal(src.match(/handLaw\(/g)?.length, 3, 'the one block and its two callers - Update and the equip moment');
  // ONE module listener for any number of rigs, registered once at
  // import - the shape systems/entityMods.js uses. A per-component
  // registration would stack one per host and never drop a disposed
  // one, because equip.js's list has no remove.
  assert.equal(src.match(/addEquipChangeListener\(/g)?.length, 1, 'one registration in the file');
});

test('HT6: the WINDOW reads the truth - the enhanced inventory\'s lit row and the quickslot diamond\'s off-hand cell, with no frame between the click and the paint', () => {
  const r = holding({ 'Handling.OnStow': ON_STOW.Unequip });
  r.ctx.sheathed = false;
  assert.equal(itemLine(r.t, r.entity).lit, true, 'the torch reads lit before the shield');
  const sh = shield();
  r.entity.items.push(sh);
  equipItem(r.entity, sh);
  // This is the render the open window does right after `wear()`.
  assert.equal(itemLine(r.t, r.entity).lit, false, 'and unlit the moment the shield is on');
  assert.equal(itemLine(sh, r.entity).equipped, true);
  // QS1's off-hand cell: the LIT light source comes before the shield,
  // and with the light stowed the shield is what the cell shows.
  const off = quickslotView(r.entity, { weapon: null, sheathed: false }).off;
  assert.equal(off.kind, 'shield');
  assert.equal(off.item, sh);
  // Sheathed, the mod keeps the torch in hand and the cell still leads
  // with it - the light IS the thing in the off hand there.
  unequipSlot(r.entity, EQUIP_SLOTS.LeftHand);
  assert.equal(r.entity.lightSource, r.t);
  r.ctx.sheathed = true;
  r.frame();
  const sh2 = shield();
  r.entity.items.push(sh2);
  equipItem(r.entity, sh2);
  assert.equal(itemLine(r.t, r.entity).lit, true, 'sheathed, the torch is still in hand and the window says so');
  assert.equal(quickslotView(r.entity, { weapon: null, sheathed: true }).off.kind, 'torch');
});


// AUDIT QS6 F7's THIRD CATCH. `HT6-the-equip-moment-obeys-a-stale-dial`
// SURVIVED once the sweep made every record apply again: HT6's own note
// says applyHandLaw re-reads the settings so the equip moment runs "over
// freshly read settings", and nothing here could fail dropping that read.
// Every fixture set its dial before the first frame, so the frame's own
// read had already cached the right answer and a stale one looked
// identical. The dial has to MOVE after the last frame for the claim to
// mean anything - which is the case it exists for: a player changes
// OnStow on the Mods pane with the inventory open, then equips.
test('HT6/HT7: the equip moment reads the dial FRESH - a setting changed since the last frame is obeyed at the equip, not the one the frame cached (mutant: the settings read dropped from applyHandLaw)', () => {
  const r = holding({ 'Handling.OnStow': ON_STOW.Unequip });
  r.ctx.sheathed = false;
  r.frame();                       // the frame caches Unequip
  r.store['Handling.OnStow'] = ON_STOW.Drop;   // ...and the player moves the dial with the window open
  const sh = shield();
  r.entity.items.push(sh);
  equipItem(r.entity, sh);
  assert.equal(r.entity.lightSource, null, 'the hand is taken either way');
  assert.equal(r.pool.spawned.length, 1, 'DROP - the dial as it stands NOW, not as the last frame read it');
  assert.equal(r.entity.items.includes(r.t), false);

  // ...and the other way round, so the pin cannot pass by always dropping.
  const u = holding({ 'Handling.OnStow': ON_STOW.Drop });
  u.ctx.sheathed = false;
  u.frame();
  u.store['Handling.OnStow'] = ON_STOW.Unequip;
  const sh2 = shield();
  u.entity.items.push(sh2);
  equipItem(u.entity, sh2);
  assert.equal(u.entity.lightSource, null);
  assert.deepEqual(u.pool.spawned, [], 'UNEQUIP - nothing on the floor');
  assert.equal(u.entity.items.includes(u.t), true, 'the pack kept it');
  assert.equal(u.h.lastLightSource, u.t, 'and it is remembered');
});
