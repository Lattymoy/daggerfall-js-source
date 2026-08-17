// U8f: the equip MECHANICS layer (systems/equip.js over the C5c
// assignment foundation) + the paperdoll base render on real art.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EQUIP_SLOTS, getEquipSlot, equipItem, unequipSlot, isEquipped } from '../src/systems/equip.js';
import { filterByTab } from '../src/ui/nativeInventory.js';
import { preloadPaperDollArt, drawPaperDoll, paperDollArtLoaded, WAIST_HEIGHT, PAPERDOLL_ORIGIN } from '../src/ui/paperDoll.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

const ent = () => ({ items: [] });

test('equipMechanics: EquipItem over string-group bag items - hands, 2H, shields, arrows, stacks', () => {
  const e = ent();
  // Either-hand weapons fill right then left (GetFirstSlot)
  const sword = { group: 'Weapons', templateIndex: 120, name: 'Longsword' };
  const dagger = { group: 'Weapons', templateIndex: 113, name: 'Dagger' };
  assert.deepEqual(equipItem(e, sword), []);
  assert.equal(sword.equipSlot, EQUIP_SLOTS.RightHand);
  assert.deepEqual(equipItem(e, dagger), []);
  assert.equal(dagger.equipSlot, EQUIP_SLOTS.LeftHand);
  // a 2H clears BOTH hands
  const claymore = { group: 'Weapons', templateIndex: 122, name: 'Claymore' };
  const out = equipItem(e, claymore);
  assert.deepEqual(out.map((i) => i.name).sort(), ['Dagger', 'Longsword']);
  assert.equal(claymore.equipSlot, EQUIP_SLOTS.RightHand);
  assert.equal(isEquipped(sword), false);
  // a shield bumps the held 2H
  const shield = { group: 'Armor', templateIndex: 109, name: 'Buckler' };
  assert.deepEqual(equipItem(e, shield).map((i) => i.name), ['Claymore']);
  assert.equal(shield.equipSlot, EQUIP_SLOTS.LeftHand);
  // with a 2H held, the next weapon replaces it in the RIGHT hand
  equipItem(e, claymore);   // re-equip 2H (bumps the shield)
  assert.equal(getEquipSlot(e, dagger), EQUIP_SLOTS.RightHand, 'the 2H-replace rule');
  // arrows never equip; wands resolve nowhere (the string boundary)
  assert.equal(equipItem(e, { group: 'Weapons', templateIndex: 131, name: 'Arrow', stackCount: 20 }), null);
  assert.equal(equipItem(e, { group: 'Jewellery', templateIndex: 140, name: 'Wand' }), null);
  // the slot swap: a second cuirass returns the first
  const c1 = { group: 'Armor', templateIndex: 102, name: 'Iron Cuirass' };
  const c2 = { group: 'Armor', templateIndex: 102, name: 'Steel Cuirass' };
  equipItem(e, c1);
  assert.deepEqual(equipItem(e, c2).map((i) => i.name), ['Iron Cuirass']);
  // a stack splits ONE off (SplitStack); the single joins the bag
  const rings = { group: 'Jewellery', templateIndex: 135, name: 'Rings', stackCount: 2 };
  e.items.push(rings);
  equipItem(e, rings);
  assert.equal(rings.stackCount, 1, 'the stack keeps the rest');
  assert.equal(rings.equipSlot, undefined);
  const worn = e.items.find((i) => i !== rings && i.name === 'Rings');
  assert.equal(worn.stackCount, 1);
  assert.ok(worn.equipSlot != null);
  // FilterLocalItems: worn items leave the tab lists; unequip returns them
  const bag = [c2, sword];
  assert.deepEqual(filterByTab(bag, 'weapons').map((i) => i.name), ['Longsword'], 'the worn cuirass hides');
  unequipSlot(e, EQUIP_SLOTS.ChestArmor);
  assert.deepEqual(filterByTab(bag, 'weapons').map((i) => i.name), ['Steel Cuirass', 'Longsword']);
});

test('equipMechanics: the paperdoll base renders the real classic art at the baked offsets', { skip: skipReal }, async () => {
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const draws = [];
  const renderer = {
    uploadTexture: (g, name, bmp) => ({ name, w: bmp.width, h: bmp.height }),
    drawScreenQuad: (tex, dst, src) => draws.push({ tex, dst, src }),
  };
  await preloadPaperDollArt({ renderer, palette, fetchBytes: async (n) => new Uint8Array(readFileSync(join(ARENA2, n))) });
  assert.ok(paperDollArtLoaded());
  const m = { s: 1, ox: 0, oy: 0 };
  assert.ok(drawPaperDoll(renderer, m, ent(), 49, 13));
  // background (SCBG04I0 town subrect 8,7,110,184) fills the panel
  assert.equal(draws[0].tex.name, 'SCBG04I0.IMG');
  assert.deepEqual(draws[0].dst, { x: 49, y: 13, w: 110, h: 184 });
  // the nude body sits at its OWN header offset minus paperDollOrigin (200,8)
  const nude = draws[1];
  assert.equal(nude.tex.name, 'BODY00I0.IMG');
  assert.ok(nude.dst.x >= 49 && nude.dst.x < 49 + 110, 'the baked offset lands inside the panel');
  assert.ok(nude.dst.y >= 13 && nude.dst.y < 13 + 184);
  // nothing equipped: BOTH censor welds draw from the clothed sheet
  const welds = draws.filter((d) => d.tex.name === 'BODY00I1.IMG');
  assert.equal(welds.length, 2);
  const split = WAIST_HEIGHT / welds[0].tex.h;
  assert.deepEqual(welds[0].src, { u0: 0, v0: 0, u1: 1, v1: split }, 'the upper weld is the top waistHeight band');
  assert.deepEqual(welds[1].src, { u0: 0, v0: split, u1: 1, v1: 1 });
  // the head rides the FACE CIF record offset
  const head = draws[draws.length - 1];
  assert.ok(head.tex.name.startsWith('head_Breton_male_0'));
  assert.ok(head.dst.y < nude.dst.y, 'the head sits above the body');
  assert.ok(PAPERDOLL_ORIGIN[0] === 200 && PAPERDOLL_ORIGIN[1] === 8);
});
