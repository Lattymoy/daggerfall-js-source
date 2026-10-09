// MWNPC5b (2026-10-09, the MW-NPC arc's fifth slice - bible/04-Characters/Morrowind-NPCs.md section 10b): A FOE, READ
// FOR ITS BODY (characters/foeBodies.js). Pinned on foe records of the shape every foe host keeps: the class foe alone
// offered; its look - a race and a face off its seed (the same foe the same person; the Bay's mix across many, not one
// Breton), its own gender, what its equip table holds and the clothes under the armour it has none over, kept while it
// wears the same; its actor - the motor's stride, a run only in pursuit, the stream's blows and casts, a recoil per hit
// the host's flash has marked, a death off its seed; and its tells off the batch the host dressed, in one object a foe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOE_RACES, FOE_WARDROBE, foeSeed, foeLook, foeActor, foeFx, foeId, isClassFoe } from '../src/characters/foeBodies.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { createEquipTable } from '../src/characters/equipTable.js';

const foe = ({ mobileType = 130, marker = [3, 0, 7], gender = 'male', slots = {}, ai = {}, ...rest } = {}) => {
  const equip = createEquipTable();
  for (const [k, v] of Object.entries(slots)) equip.slots[EQUIP_SLOTS[k]] = v;
  return { mobileType, marker, gender, entity: { isClass: mobileType >= 128, race: undefined, equip, items: [] }, ai: { feet: [1, 2, 3], yaw: 0.5, moving: false, giveUpTimer: 0, ...ai }, ...rest };
};

test('MWNPC5b-1 the class foe alone; its look - the same foe the same person, the Bay\'s mix across many, its own gender, what it wears and the clothes under the armour it has none over', () => {
  assert.equal(isClassFoe(foe()), true);
  assert.equal(isClassFoe(foe({ mobileType: 12 })), false, 'a creature is MWNPC9\'s');
  assert.equal(isClassFoe({}), false);
  const a = foe(), b = foe();
  assert.equal(foeSeed(a), foeSeed(b), 'the same species where the same layout stood it: the same seed on every machine');
  assert.deepEqual(foeLook(a), foeLook(b), 'and the same person');
  assert.notEqual(foeSeed(foe({ marker: [3, 0, 8] })), foeSeed(a), 'another place, another seed');
  assert.notEqual(foeSeed(foe({ mobileType: 131 })), foeSeed(a), 'another species, another seed');
  assert.equal(foeSeed({ mobileType: 130, seq: 4 }), foeSeed({ mobileType: 130, seq: 4 }), 'no marker: its sequence');
  // the mix: a thousand foes draw every race, near their weights; faces 0..9
  const count = new Map(), faces = new Set();
  for (let i = 0; i < 1000; i++) { const l = foeLook(foe({ marker: [i * 1.3, 0, i * 0.7] })); count.set(l.race, (count.get(l.race) ?? 0) + 1); faces.add(l.faceIndex); }
  const total = FOE_RACES.reduce((s, [, w]) => s + w, 0);
  for (const [race, w] of FOE_RACES) {
    const n = count.get(race) ?? 0;
    assert.ok(Math.abs(n / 1000 - w / total) < 0.05, `${race}: ${n} of 1000 near its weight ${w}/${total}`);
  }
  assert.deepEqual([...faces].sort((x, y) => x - y), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(foeLook(foe({ gender: 'female' })).gender, 'female');
  assert.equal(foeLook(foe({ gender: undefined })).gender, 'male');
  // naked of armour: a shirt, legs, shoes - the gender's own, dyed
  const bare = foeLook(foe());
  const bySlot = new Map(bare.items.map((it) => [it.equipSlot, it]));
  assert.ok(FOE_WARDROBE.male.shirts.includes(bySlot.get(EQUIP_SLOTS.ChestClothes)?.templateIndex), 'a shirt');
  assert.ok(FOE_WARDROBE.male.legs.includes(bySlot.get(EQUIP_SLOTS.LegsClothes)?.templateIndex), 'legs');
  assert.ok(FOE_WARDROBE.male.feet.includes(bySlot.get(EQUIP_SLOTS.Feet)?.templateIndex), 'shoes');
  assert.ok(bare.items.every((it) => it.group === 'MensClothing' && Number.isInteger(it.dye)));
  const her = foeLook(foe({ gender: 'female', marker: [9, 0, 9] }));
  assert.ok(her.items.every((it) => it.group === 'WomensClothing'));
  assert.ok(FOE_WARDROBE.female.shirts.includes(her.items.find((it) => it.equipSlot === EQUIP_SLOTS.ChestClothes).templateIndex));
  // armoured: its pieces as worn, the clothes only where no piece stands - boots on the feet, so no shoes
  const sword = { templateIndex: 115, group: 'Weapons', material: 2 };
  const cuirass = { templateIndex: 102, group: 'Armor', material: 1 };
  const boots = { templateIndex: 109, group: 'Armor', material: 1 };
  const armed = foeLook(foe({ slots: { RightHand: sword, ChestArmor: cuirass, Feet: boots } }));
  const slots = armed.items.map((it) => it.equipSlot);
  assert.ok(armed.items.some((it) => it.equipSlot === EQUIP_SLOTS.RightHand && it.templateIndex === 115 && it.material === 2), 'its sword, as worn');
  assert.ok(armed.items.some((it) => it.equipSlot === EQUIP_SLOTS.ChestArmor && it.templateIndex === 102), 'its cuirass');
  assert.equal(slots.filter((s) => s === EQUIP_SLOTS.Feet).length, 1, 'its boots, and no shoes beside them');
  assert.ok(slots.includes(EQUIP_SLOTS.ChestClothes), 'a shirt under the cuirass (the reference shows the armour - the slot law)');
  // kept while it wears the same; a new piece a new look
  const f = foe({ slots: { RightHand: sword } });
  const l1 = foeLook(f);
  assert.equal(foeLook(f), l1, 'the same object - one body for its life');
  const snap = f._mwLookSlots;
  foeLook(f);
  assert.equal(f._mwLookSlots, snap, 'unchanged: a compare of the slots, no copy and no compose');
  f.entity.equip.slots[EQUIP_SLOTS.Head] = { templateIndex: 100, group: 'Armor', material: 1 };
  const l2 = foeLook(f);
  assert.notEqual(l2, l1, 'a helm put on: a new look');
  assert.equal(l2.race, l1.race, 'the same person in it');
  assert.equal(l2.faceIndex, l1.faceIndex);
});

test('MWNPC5b-2 the actor: the stride (a run only in pursuit), a swing per new attack count, a cast per cast, a recoil per hit the flash marked, a death off its seed', () => {
  const f = foe({ seq: 41, ai: { moving: true, giveUpTimer: 0 } });
  let a = foeActor(f);
  assert.equal(a.id, 41, 'the host\'s own sequence');
  assert.equal(a.look, foeLook(f));
  assert.equal(a.feet, f.ai.feet);
  assert.equal(a.yaw, 0.5, 'the motor\'s yaw - the player\'s convention (forward sin, cos)');
  assert.equal(a.moving, true);
  assert.equal(a.running, false, 'wandering: a walk');
  f.ai.giveUpTimer = 30;
  assert.equal(foeActor(f).running, true, 'in pursuit: a run');
  f.ai.moving = false;
  assert.equal(foeActor(f).running, false, 'standing: neither');
  assert.equal(a.drawn, true);
  assert.equal(a.swings, 0);
  f._atkA = (3 << 1) | 1;   // three blows, the last ranged
  a = foeActor(f);
  assert.equal(a.swings, 3, 'the count, not its ranged bit');
  assert.ok(a.strike >= 1 && a.strike <= 6, 'a strike, never Idle');
  assert.notEqual(foeActor({ ...f, _atkA: 4 << 1 }).strike, a.strike, 'the next blow another strike');
  f._castN = 7;
  assert.equal(foeActor(f).casts, 7);
  assert.equal(foeActor(f).castRange, 2);
  assert.equal(foeActor(f).hits, 0);
  f._hfAt = 10.5;
  assert.equal(foeActor(f).hits, 1, 'a hit marked: a recoil');
  assert.equal(foeActor(f).hits, 1, 'the same mark: no other');
  f._hfAt = 11.25;
  assert.equal(foeActor(f).hits, 2);
  assert.equal(foeActor(f).dead, 0);
  f.dead = true;
  const d = foeActor(f).dead;
  assert.ok(d >= 1 && d <= 5, 'dead: a death\'s roll + 1');
  assert.equal(foeActor(foe({ seq: 99, dead: true })).dead, foeActor(foe({ seq: 98, dead: true })).dead, 'the roll is the seed\'s (the same species and place: the same death)');
  const deaths = new Set(Array.from({ length: 60 }, (_, i) => foeActor(foe({ marker: [i, 0, i * 2], dead: true })).dead));
  assert.ok(deaths.size >= 4, `and across foes, the deaths vary (${[...deaths]})`);
  const g = foe({ marker: null });
  assert.equal(foeId(g), foeId(g), 'no sequence: one minted, kept');
  assert.notEqual(foeId(foe({ marker: null })), foeId(g), 'never another\'s');
});

test('MWNPC5b-3 the tells off the batch the host dressed: none for a plain foe; the glint, the elite\'s pulse and clock, the dissolve - in one object a foe, rewritten in place', () => {
  const f = foe({ batch: {} });
  assert.equal(foeFx(f), null);
  assert.equal(foeFx({}), null);
  f.batch.glint = [1, 0, 0, 0];
  assert.equal(foeFx(f), null, 'a glint at no strength is none');
  f.batch.glint = [1, 0.2, 0, 0.7];
  const one = foeFx(f);
  assert.deepEqual(one, { glint: [1, 0.2, 0, 0.7], elite: 0, time: 0, dissolve: null });
  f.batch.glint = undefined; f.batch.eliteGlow = 0.8; f.batch.eliteTime = 12.5; f.batch.dissolve = [0.3, 1, 0.5, 0.1, 0];
  const two = foeFx(f);
  assert.equal(two, one, 'the same object, rewritten');
  assert.deepEqual(two, { glint: null, elite: 0.8, time: 12.5, dissolve: [0.3, 1, 0.5, 0.1, 0] });
  f.batch.eliteGlow = 0; f.batch.dissolve = [0, 0, 0, 0, 0];
  assert.equal(foeFx(f), null, 'a dissolve at nothing gone is none');
});
