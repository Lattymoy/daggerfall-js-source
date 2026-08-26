// AUDIT 26, the SAVE campaign - the EXTERIOR FOE POOL's three gaps
// against SerializableEnemy.cs, each pinned on the C# rather than on
// the port's own answer.
//
//   1.1  :109 startingHealth = entity.MaxHealth, :111 currentFatigue,
//        :120 instancedEffectBundles - and the restore ORDER,
//        :175 MaxHealth BEFORE :176 SetHealth, then :177 SetFatigue,
//        then RestoreInstancedBundleSaveData at :222.
//   1.2  :115 isDead is SAVED and :200-203 restores it by disabling
//        the enemy ("do not destroy as we must still save enemy state
//        when dead", EnemyDeath.cs:76-77). The port dropped corpses
//        from the save AND could not tear them down on load, so the
//        same body survived a quickload with its loot beside a
//        respawned copy of the foe carrying a duplicate set.
//   1.3  :119/:174 ItemEquipTable.Serialize/DeserializeEquipTable -
//        the WHOLE table re-links to the RESTORED items, so a loaded
//        foe wears the gear its save recorded, not its respawn's roll.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createExteriorFoes, MAX_ACTIVE_ENCOUNTER_FOES } from '../src/scenes/exteriorFoes.js';
import { equipEnemy } from '../src/scenes/hostCombat.js';
import { copyEffectEntry } from '../src/systems/save.js';
// AUDIT 26 (relink wave): DeserializeEquipTable is the one member both
// foe hosts restore, and it lives in systems/equip.js beside the table
// it fills - not in a scene, and no longer as a RightHand-only index.
import { deserializeEquipTable, equipTableOf, armorValuesOf, EQUIP_SLOTS } from '../src/systems/equip.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORLD = readFileSync(join(root, 'src/scenes/world.js'), 'utf8');

/** The `{ ... }` block containing index `i`, matched rather than
 *  guessed at by character count. */
function braceBlock(text, i) {
  const open = text.indexOf('{', i);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === '{') depth++;
    else if (text[k] === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  return text.slice(open);
}
const saveArm = () => braceBlock(WORLD, WORLD.indexOf('function worldQuickSave'));
const loadArm = () => braceBlock(WORLD, WORLD.indexOf('async function worldQuickLoad'));

/** A pool foe stood by hand: this pool builds entities from ARENA2
 *  careers and the save laws need none of that - a record with an ai,
 *  a texture and an entity is all damageFoe and spawnCorpse read. */
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8 };
function poolDeps(freed) {
  return {
    renderer: {
      createBillboardBatch: () => ({}),
      destroyBillboardBatch: () => { freed.n++; },
      textures: new Map(),
    },
    collider: { raycast: () => 0.5, heightAt: () => 0 },
    fetchBytes: async () => { throw new Error('no ARENA2 in this pin'); },
    getTexture: async () => stubTex,
    uploadRecordFrame: () => {},
    currentMinute: () => 1000,
    playerEntity: { level: 1, reflexes: 2, skills: 30, items: [], stats: { strength: 50, agility: 50, luck: 50 } },
    audio: null,
    onPlayerHurt: () => {},
    rand: () => 0.5,
    rolls: () => 0.5,
    currentPixelKey: () => '3,4',
  };
}
const standFoe = (mobileType, feet, items = []) => ({
  mobileType, gender: 'male', dead: false, entity: { health: 10, maxHealth: 10, items, activeEffects: [] },
  ai: { feet: [...feet], isHostile: true, detected: false, height: 1.8 },
  tex: stubTex, archive: ENEMY_BASICS[mobileType].maleTexture, batch: {}, _mout: null,
});
const settle = () => new Promise((r) => setTimeout(r, 0));

// =====================================================================
// 1.1 - startingHealth, currentFatigue, instancedEffectBundles
// =====================================================================

test('1.1: the exterior foe record carries MaxHealth, fatigue and the instanced bundles (SerializableEnemy.cs:109/:111/:120)', () => {
  const rec = saveArm();
  assert.ok(rec.includes('maxHealth: f.entity.maxHealth,'),
    ':109 data.startingHealth = entity.MaxHealth - makeEnemyEntity RE-ROLLS it on every spawn, and the load re-mints this whole pool');
  assert.ok(rec.includes('fatigue: f.entity.fatigue ?? 0,'), ':111 data.currentFatigue');
  assert.ok(rec.includes('activeEffects: (f.entity.activeEffects ?? []).map(copyEffectEntry),'),
    ':120 data.instancedEffectBundles - through the player envelope\'s own copier, so the nested effect/statMods detach');
});

test('1.1: the restore order is MaxHealth, THEN health, THEN fatigue (RestoreSaveData :175-177)', () => {
  const fn = loadArm();
  const iMax = fn.indexOf('f.entity.maxHealth = sf.maxHealth');
  const iHp = fn.indexOf('f.entity.health = sf.health');
  const iFat = fn.indexOf('f.entity.fatigue = sf.fatigue');
  assert.ok(iMax > 0 && iHp > 0 && iFat > 0, 'all three halves restore');
  assert.ok(iMax < iHp,
    'entity.MaxHealth = data.startingHealth (:175) lands BEFORE entity.SetHealth (:176) - the other order lets a restored foe keep health above a re-rolled maximum');
  assert.ok(iHp < iFat, 'SetFatigue follows at :177');
  assert.ok(fn.includes('f.entity.activeEffects = sf.activeEffects.map(copyEffectEntry);'),
    'RestoreInstancedBundleSaveData (:222) REPLACES the live bundle set with the saved one');
  assert.ok(fn.includes('seedBundleSeq(sf.activeEffects.reduce((m, a) => Math.max(m, a.bundleId ?? 0), 0));'),
    'bundleId is a module counter, not saved state - it lifts past the restored high-water mark');
});

test('1.1: the record\'s bundle copier DETACHES - a saved foe effect cannot alias the live entity', () => {
  const live = { kind: 'paralysis', bundleId: 9, effect: { magnitude: 4 }, statMods: { strength: -3 }, caster: { huge: true } };
  const copy = copyEffectEntry(live);
  copy.effect.magnitude = 99;
  copy.statMods.strength = 99;
  assert.equal(live.effect.magnitude, 4, 'the nested effect detaches');
  assert.equal(live.statMods.strength, -3, 'and the accumulating statMods map');
  assert.equal('caster' in copy, false, 'the live scene reference never enters the envelope (DFU re-resolves it at :222)');
});

// =====================================================================
// 1.2 - isDead: corpses ride the save, and a load tears them down
// =====================================================================

test('1.2: removeCorpse is the corpse half of the load teardown - removeFoe alone cannot destroy a body', async () => {
  const freed = { n: 0 };
  const pool = createExteriorFoes(poolDeps(freed));
  const f = standFoe(0, [10, 0, 10], [{ group: 'Weapons', templateIndex: 120, material: 2 }]);
  pool.foes.push(f);
  pool.damageFoe(f, 99, [0, 0, 0], null);
  await settle();
  assert.equal(pool.batches().length, 1, 'the corpse draws');
  assert.equal(pool.lootTargets().length, 1, 'and is lootable');

  // the LIVE door: its first line is `if (f.dead) return` - a dispel
  // cannot re-kill a body, so this is a no-op on a corpse. That is
  // exactly why the quickload teardown needed a second door.
  const before = freed.n;
  pool.removeFoe(f);
  assert.equal(freed.n, before, 'removeFoe frees nothing on a corpse');
  assert.equal(pool.lootTargets().length, 1, 'and the loot is still on the ground - the duplication exploit');

  pool.removeCorpse(f);
  assert.equal(freed.n, before + 1, 'removeCorpse frees the marker batch');
  assert.equal(f.corpse, false, 'the record is DESTROYED, not merely hidden');
  assert.equal(pool.batches().length, 0, 'nothing draws it');
  assert.equal(pool.lootTargets().length, 0, 'and nothing can loot it');
  pool.update(0, [0, 0, 0], [0, 1.7, 0], {});
  assert.equal(pool.foes.includes(f), false, 'update()\'s tail splice finally prunes it');
});

test('1.2: spawnCorpse re-mints a saved body on load - :200-203 disables the restored enemy, loot and all', async () => {
  const freed = { n: 0 };
  const pool = createExteriorFoes(poolDeps(freed));
  const loot = [{ group: 'Weapons', templateIndex: 120, material: 2 }, { group: 'Armor', templateIndex: 102, material: 0x0100 }];
  const f = standFoe(0, [4, 0, 4], loot);
  pool.foes.push(f);
  // the load's own two lines: the record comes back dead, and the body
  // with it - on a cold boot this pool had neither.
  f.dead = true;
  pool.spawnCorpse(f);
  await settle();
  assert.equal(f.corpse, true);
  assert.equal(f.batch, null, 'the LIVE sprite batch is released - a corpse is a disabled enemy');
  assert.equal(pool.batches().length, 1, 'the restored body draws');
  const targets = pool.lootTargets();
  assert.equal(targets.length, 1, 'and is an activation target again');
  const took = pool.takeLoot(targets[0].key, () => {});
  assert.equal(took, 2, 'the body carries the loot the save recorded');
  assert.equal(f.entity.items.length, 0, 'transferred off the corpse, exactly once');
});

test('1.2: a pending marker never lands on a body that was destroyed inside the await', async () => {
  // the SL2 guard, widened: mintCorpseMarker awaits its texture, and a
  // quickload teardown lands inside that await. Without `f.corpse` in
  // the guard the marker pushed a batch onto a pool that had already
  // torn the corpse down - a GL batch nothing would ever free.
  const freed = { n: 0 };
  const pool = createExteriorFoes(poolDeps(freed));
  const f = standFoe(0, [1, 0, 1]);
  pool.foes.push(f);
  pool.damageFoe(f, 99, [0, 0, 0], null);
  pool.removeCorpse(f);          // the load tears it down before the texture warms
  await settle();
  assert.equal(pool.batches().length, 0, 'nothing landed after the destroy');
  assert.equal(f.corpseMarker, null);
});

test('1.2: the world envelope SAVES the dead and its teardown destroys them (SerializableEnemy.cs:115)', () => {
  const rec = saveArm();
  assert.ok(rec.includes('exteriorFoes.foes.filter((f) => f.ai && !f.questBehaviour && (!f.dead || f.corpse))'),
    'a body on the ground rides the save; one already destroyed (culled, dispelled, collected with its pixel) does not - DFU Destroy()s that object rather than disabling it');
  assert.equal(rec.includes('foes.filter((f) => !f.dead &&'), false, 'the corpse filter is gone');
  assert.ok(rec.includes('dead: !!f.dead,'), ':115 data.isDead');
  assert.ok(rec.includes('const fpos = f.corpseMarker?.pos ?? f.ai.feet;'),
    'a corpse stands where its MARKER landed (FindGroundPosition), not where the feet stopped');

  const fn = loadArm();
  assert.ok(fn.includes('exteriorFoes.removeFoe(f);') && fn.includes('exteriorFoes.removeCorpse(f);'),
    'the teardown is BOTH destroys - the disabled enemy and its loot container');
  assert.ok(fn.indexOf('exteriorFoes.removeFoe(f);') < fn.indexOf('exteriorFoes.removeCorpse(f);'),
    'live half first, corpse half second');
  assert.ok(fn.includes('if (sf.dead) { f.dead = true; exteriorFoes.spawnCorpse(f); }'),
    ':200-203 - a saved-dead enemy comes back disabled, which is this pool\'s corpse');
});

test('1.2: the load instantiates EXACTLY the saved set - the pool\'s own cap is not a law (RestoreEnemyData :404-425)', async () => {
  const freed = { n: 0 };
  const pool = createExteriorFoes(poolDeps(freed));
  for (let i = 0; i < MAX_ACTIVE_ENCOUNTER_FOES; i++) pool.foes.push(standFoe(0, [i, 0, 0]));
  assert.equal(pool.activeCount(), MAX_ACTIVE_ENCOUNTER_FOES, 'the encounter bound is full');

  // no ARENA2 here, so every spawn ends in the career load's catch -
  // but the CAP turns a foe away BEFORE that, silently. The log is the
  // difference between "refused by the port's bound" and "reached the
  // mint", which is the whole point of the restore's exemption.
  const errs = [];
  const realErr = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  try {
    assert.equal(await pool.spawnFoe(0, [0, 0, 0]), null, 'a capped encounter spawn is refused');
    assert.equal(errs.length, 0, 'and never reaches the mint');
    assert.equal(await pool.spawnFoe(0, [0, 0, 0], { ignoreEncounterLimit: true }), null);
    assert.equal(errs.length, 1, 'a RESTORED foe walks past the cap and reaches the mint');
  } finally {
    console.error = realErr;
  }
  assert.ok(loadArm().includes('{ gender: sf.gender, yaw: sf.yaw, ignoreEncounterLimit: true }'),
    'the load arm asks for the exemption');
});

// =====================================================================
// 1.3 - the equip table re-links to the RESTORED items
// =====================================================================

test('1.3: DeserializeEquipTable relinks EVERY slot into the restored items (:353-373), not just the right hand', () => {
  // the real mint: equipEnemy hangs the loadout on the entity, EQUIPS
  // every piece (ItemHelper.cs:1366-1460 makes the same EquipItem +
  // Items.AddItem pair for the weapon, the shield and each of Helm /
  // Right_Pauldron / Left_Pauldron / Cuirass / Greaves / Boots) and
  // appends all of them to its items (the corpse's loot).
  const entity = { isClass: true, careerIndex: 4, armor: 0, items: [{ group: 'Weapons', templateIndex: 113, material: 0 }] };
  const eq = equipEnemy(entity, 132, 6);
  assert.ok(eq && entity.weapon, 'a class enemy carries a right hand');
  const worn = equipTableOf(entity).filter(Boolean);
  assert.ok(worn.length >= 1, 'the foe wears its loadout - the table is not empty');
  // AssignEnemyStartingEquipment hands ONE DaggerfallUnityItem to both
  // EquipItem and Items.AddItem (ItemHelper.cs:1379-1381), and the UID
  // equip table only works because of that identity.
  for (const it of worn) assert.ok(entity.items.includes(it), 'every worn piece IS an item on the corpse');

  // DeserializeEquipTable (:353-373) re-links the table INTO the
  // restored collection: the restored foe wears the very objects its
  // corpse will drop, which is what makes each piece's condition, its
  // poison and its material one thing rather than two. DFU links by
  // item UID; the port's items carry `equipSlot`, so the slot is the
  // link and it rides inside `items`.
  const restored = { items: entity.items.map((it) => ({ ...it })), weapon: { templateIndex: 999, material: 9 } };   // the respawn's fresh roll
  deserializeEquipTable(restored);
  restored.weapon = equipTableOf(restored)[EQUIP_SLOTS.RightHand] ?? null;
  const rworn = equipTableOf(restored).filter(Boolean);
  assert.equal(rworn.length, worn.length, 'the WHOLE table comes back, slot for slot');
  // IDENTITY, not a field match: this is the bug the relink wave
  // closed. Only RightHand was relinked, so after a load a foe's
  // shield and armour slots still held the respawn's throwaway roll -
  // objects not in entity.items and that would never drop - and
  // DamageEquipment (FormulaHelper.cs:1080-1117) billed the struck
  // slot to them, so a shield hacked to pieces came back pristine and
  // could never be worn down again.
  for (const it of rworn) assert.ok(restored.items.includes(it), 'every restored slot points at an object IN entity.items');
  assert.equal(restored.weapon, equipTableOf(restored)[EQUIP_SLOTS.RightHand], 'entity.weapon is the RightHand slot (EnemyAttack.cs:141/:143/:192/:409)');
  assert.deepEqual(
    { templateIndex: restored.weapon.templateIndex, material: restored.weapon.material },
    { templateIndex: entity.weapon.templateIndex, material: entity.weapon.material },
    'and it is the weapon the SAVE recorded, not the one the respawn rolled',
  );
  // a bare-handed foe relinks to an empty table and a null weapon
  const bare = { items: [{ group: 'Weapons', templateIndex: 113, material: 0 }] };
  deserializeEquipTable(bare);
  assert.equal(equipTableOf(bare).filter(Boolean).length, 0, 'nothing carries a slot, so nothing relinks');
  assert.equal(equipTableOf(bare)[EQUIP_SLOTS.RightHand] ?? null, null, 'an empty RightHand stays empty');
});

test('1.3: the relink does NOT re-derive the foe\'s armour values (SerializableEnemy has no :355-368 block)', () => {
  // SerializablePlayer.RestoreItems wipes ArmorValues to 100 and
  // re-applies them from the rebuilt table (:355-368). That block is
  // the PLAYER's: SerializableEnemy.RestoreSaveData (:173-174) calls
  // DeserializeItems then DeserializeEquipTable and NOTHING else,
  // because a foe's values were already re-derived by its spawn's
  // SetEnemyEquipment pass (EnemyEntity.cs:409-427) - which skips the
  // boots (Feet is the loop's EXCLUSIVE bound) and clamps a class
  // enemy at 60. Re-deriving on restore would refill to 100, count
  // the boots and drop the clamp: a restored foe would come back
  // markedly easier to hit than the one that was saved.
  const entity = { isClass: true, careerIndex: 4, armor: 0, items: [{ group: 'Weapons', templateIndex: 113, material: 0 }] };
  equipEnemy(entity, 132, 6);
  const saved = [...armorValuesOf(entity)];
  const restored = { items: entity.items.map((it) => ({ ...it })), armorValues: [...saved] };
  deserializeEquipTable(restored);
  assert.deepEqual(armorValuesOf(restored), saved, 'the relink leaves armorValues exactly as the spawn derived them');
});

test('1.3: the load arm relinks the whole table AFTER the items land (:173-174)', () => {
  const fn = loadArm();
  assert.ok(fn.includes('deserializeEquipTable(f.entity);'),
    ':174 DeserializeEquipTable(data.equipTable, entity.Items) - the WHOLE table, relinked to the RESTORED items');
  assert.ok(fn.includes('f.entity.weapon = equipTableOf(f.entity)[EQUIP_SLOTS.RightHand] ?? null;'),
    'entity.weapon follows the table - it is the port\'s cached RightHand slot, not a second mechanism');
  // THE ORDER IS THE LAW: the table can only relink to an item the
  // collection already holds, so :173 lands before :174.
  assert.ok(fn.indexOf('f.entity.items = (sf.items ?? []).map((it) => ({ ...it }));') < fn.indexOf('deserializeEquipTable(f.entity);'),
    'the items deserialize first (:173), then the table relinks to them (:174)');
  assert.ok(fn.indexOf('deserializeEquipTable(f.entity);') < fn.indexOf('f.entity.weapon = equipTableOf(f.entity)'),
    'and the cached right hand is read off the table the line above filled');
  // DFU does NOT save the derived armour values: SetEnemyEquipment
  // re-runs them on the respawn's own loadout (EnemyEntity.cs:409-427),
  // and a field DFU re-derives must not be persisted. Nor may the
  // restore re-derive them - that block is SerializablePlayer's.
  assert.equal(saveArm().includes('armorValues'), false, 'armorValues are RE-DERIVED, never saved');
  assert.equal(loadArm().includes('rebuildEquipState'), false,
    'the foe restore must NOT run the player\'s :355-368 armour re-derive');
  // ONE DFU MEMBER, ONE EXPORT: the relink is the same law on both foe
  // hosts, so it has one home in systems/equip.js and neither the scene
  // file nor systems/save.js keeps a RightHand-only stand-in.
  assert.doesNotMatch(readFileSync(join(root, 'src/scenes/exteriorFoes.js'), 'utf8'), /equippedWeaponIndex|deserializeEquipTable/,
    'the equip link stays out of the scene file');
  assert.doesNotMatch(readFileSync(join(root, 'src/systems/save.js'), 'utf8'), /export const equippedWeaponIndex/,
    'the RightHand-only stand-in is gone - the whole-table relink subsumes it');
});
