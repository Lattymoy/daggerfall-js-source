// DEX5 (2026-10-20, Mac: "I want to implement this as our next mod 1:1") - THE TROLL THAT GETS BACK UP. Daggerfall
// Enemy Expansion's troll corpse prefab (1618_20) on the port's door for a mod's corpse prefab (scenes/corpseMarker.js
// registerCorpsePrefab): the body no one loots, its ten seconds and the troll that stands again, the cheat that freezes
// them, a spell's missile that burns it to ash through its own entity (the troll's career), and the save that keeps its
// time - read against the mod's own scripts and the prefab's components out of the bundle, driven through a real street
// pool (scenes/exteriorFoes.js) and the player's real missile (scenes/hostMagic.js), each with a mutation it must fail
// under (tools/mutants/dex5.json).
import '../../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TROLL_CORPSE, TROLL_TRIGGER_RADIUS, trollCorpseEntity, trollSaveData, restoreTrollSaveData, _resetDexTroll } from '../../../src/systems/enemyExpansion/dexTroll.js';
import { registerCorpsePrefab, createCorpsePrefabs, corpsePrefabStruck, _resetCorpsePrefabs } from '../../../src/scenes/corpseMarker.js';
import { installEnemyExpansion, _resetEnemyExpansion, DEX_VENDOR } from '../../../src/systems/enemyExpansion/dexInstall.js';
import { createExteriorFoes } from '../../../src/scenes/exteriorFoes.js';
import { createPlayerMagic } from '../../../src/scenes/hostMagic.js';
import { validFoeRecord } from '../../../src/net/wire.js';
import { setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';
import { setValue, _resetForTests as _resetSettings } from '../../../src/systems/settings/settings.js';
import { modSaveRecords, restoreModSaveRecords } from '../../../src/systems/modSaveData.js';
import { CAPSULE_HEIGHT } from '../../../src/player/motor.js';
import { clearCustomEnemies } from '../../../src/characters/enemy/customEnemies.js';
import { _resetMintRowEditors } from '../../../src/characters/enemy/enemyEntity.js';
import { _resetFoeGhosts } from '../../../src/characters/enemy/foeLook.js';
import { _resetExtraQuestRows } from '../../../src/systems/quest/tables.js';
import { _resetEncounterTableSelectors } from '../../../src/characters/encounterTableDoor.js';
import { _resetPlayerGps } from '../../../src/world/playerGps.js';
import { _resetSpellRecordsAssets } from '../../../src/systems/spell/standardSpells.js';
import { _resetEnemySpellbooks } from '../../../src/systems/enemySpells.js';
import { _resetFormulaDoors } from '../../../src/combat/formulas.js';
import { _resetForcedGenders } from '../../../src/characters/mobile/mobileUnit.js';
import { _resetDexBodies } from '../../../src/systems/enemyExpansion/dexBodies.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const CS = (n) => rd(`vendor/daggerfall-enemy-expansion/Scripts/${n}`);
const TROLL = 272;
const silent = () => {};
const reset = () => {
  _resetDexTroll(); _resetCorpsePrefabs(); _resetDexBodies(); _resetFormulaDoors(); _resetForcedGenders(); _resetSpellRecordsAssets(); _resetEnemySpellbooks();
  _resetEncounterTableSelectors(); _resetPlayerGps(); _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); _resetFoeGhosts(); _resetExtraQuestRows();
  _resetModSettings(); _resetSettings();
};
const settle = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
/** Math.random held at `v` for the length of `fn` - the saving throw's and the magnitude's dice (struck's own). */
function withRandom(v, fn) { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } }
const effect = (type, subType, n, extra = {}) => ({ type, subType, magnitudeBaseLow: n, magnitudeBaseHigh: n, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, ...extra });
const FIRE = { name: 'Fire Bolt', index: 900, element: 0, rangeType: 2, effects: [effect(4, 0, 6)] };   // Damage Health, fire: the troll's critical weakness
const FROST = { name: 'Frost Bolt', index: 901, element: 1, rangeType: 2, effects: [effect(4, 0, 6)] };   // its resistance
const LIGHT = { name: 'Light', index: 902, element: 4, rangeType: 2, effects: [effect(33, 0, 0, { durationBase: 3 })] };   // harms nothing
const FROST_ROT = { name: 'Frost Rot', index: 903, element: 1, rangeType: 2, effects: [effect(1, 0, 6, { durationBase: 5 })] };   // Continuous Damage Health, five rounds

const stubTex = { getSize: () => ({ width: 64, height: 120 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 30, getFrameCount: () => 1 };
function streetPool(said) {
  return createExteriorFoes({
    renderer: { createBillboardBatch: (archive, record, size, centers) => ({ archive, record, size, centers }), destroyBillboardBatch() {}, destroyBatch() {}, textures: new Map() },
    collider: { raycast: () => 0.5, heightAt: () => 0 },
    fetchBytes: async (name) => { if (name === 'MONSTER.BSA') return Uint8Array.from([0, 0, 0x00, 0x01]); throw new Error(`no ${name} in this pin`); },
    getTexture: async () => stubTex,
    uploadRecordFrame: () => {},
    currentMinute: () => 1000,
    playerEntity: { level: 1, reflexes: 2, skills: 30, items: [], stats: { strength: 50, agility: 50, luck: 50 } },
    audio: null, onPlayerHurt: () => {}, rand: () => 0.5, rolls: () => 0.5,
    say: (line) => said.push(line),
  });
}
/** A street with the mod loaded and a troll fallen in it: its pool, its body and what the HUD said. */
async function fallenTroll({ on = true } = {}) {
  reset();
  installEnemyExpansion({ on, log: silent });
  const said = [];
  const pool = streetPool(said);
  const troll = await pool.spawnFoe(TROLL, [5, 0, 5], { feetGiven: true });
  assert.ok(troll && !troll.dead, 'a troll stands');
  troll.entity.items = [{ group: 'Weapons', templateIndex: 116, name: 'Shortsword', stackCount: 1 }];   // what it carried - a body DFU would search
  pool.damageFoe(troll, 100000, [0, 0, 0]);
  await settle();
  assert.equal(troll.dead, true);
  return { pool, troll, said };
}
const tick = (pool, seconds, dt = 0.25) => { for (let t = 0; t < seconds - 1e-9; t += dt) pool.update(dt, [100, 0, 100], null, {}); };

test('DEX5-1 THE PREFAB, read off the bundle: the body\'s picture, the ash\'s and the ten seconds (its imported components); its entity of type None, its effect manager and its trigger of radius 1 (its own GameObject); the rules its scripts write', () => {
  const imported = JSON.parse(rd('vendor/daggerfall-enemy-expansion/Prefabs/1618_20.imported.json')).Components[0];
  assert.deepEqual([TROLL_CORPSE.archive, TROLL_CORPSE.record, TROLL_CORPSE.respawnTime], [imported.Archive, imported.Record, imported.RespawnTime]);
  assert.deepEqual([TROLL_CORPSE.ash.archive, TROLL_CORPSE.ash.record], [imported.AshArchive, imported.AshRecord]);
  assert.deepEqual([TROLL_CORPSE.archive, TROLL_CORPSE.record, TROLL_CORPSE.ash.record, TROLL_CORPSE.respawnTime], [1618, 20, 21, 10]);
  const own = JSON.parse(rd('vendor/daggerfall-enemy-expansion/Prefabs/1618_20.components.json')).Components;
  const sphere = own.find((c) => c.class === 'SphereCollider');
  assert.equal(sphere.m_IsTrigger, true, 'a trigger - a missile\'s cast meets it, a body walks through it');
  assert.equal(TROLL_TRIGGER_RADIUS, sphere.m_Radius);
  assert.deepEqual(sphere.m_Center, { x: 0, y: 0, z: 0 }, 'about the body\'s centre');
  assert.equal(own.find((c) => c.script === 'DaggerfallEntityBehaviour').EntityType, 0, 'EntityTypes.None - WeaponDamage harms only an enemy-typed entity');
  assert.ok(own.some((c) => c.script === 'EntityEffectManager'), 'a spell\'s bundle lands on it');
  // the scripts' own law, pinned by its text
  const entity = CS('BestiaryTrollCorpseEntity.cs'), billboard = CS('BestiaryTrollCorpseBillboard.cs');
  assert.match(entity, /MaxHealth = 1;\s*CurrentHealth = 1;/);
  assert.match(entity, /if \(BestiaryMod\.DisableTrollRespawn\)\s*return;\s*respawnBuffer -= Time\.deltaTime;/, 'the cheat freezes the count before it moves');
  assert.match(entity, /new Vector3\(0\.0f, -CorpseBillboardHeight \/ 2\.0f \+ 0\.1f, 0\.0f\)/, 'the ash\'s centre 0.1 over the body\'s foot');
  assert.equal(TROLL_CORPSE.ash.centre, 0.1);
  assert.match(entity, /\$"The \{enemyName\} has recovered from its injuries\."/);
  assert.match(billboard, /\/\/ This troll is no loot\s*var lootObject = transform\.parent\.gameObject;\s*var lootComponent = lootObject\.GetComponent<DaggerfallLoot>\(\);\s*if \(lootComponent != null\)\s*\{\s*Destroy\(lootComponent\);/);
});

test('DEX5-2 the corpse\'s entity is a bare DaggerfallEntity\'s with health 1 and the troll\'s career: fire (its critical weakness) burns it, frost (its resistance) is saved on a low roll and lands on a high one, a spell that harms nothing leaves it', async () => {
  const { troll } = await fallenTroll();
  const career = troll.entity.career;
  assert.ok(career, 'the troll\'s own career, from the mod\'s CareerBase');
  const e = trollCorpseEntity(career);
  assert.deepEqual([e.health, e.maxHealth, e.level, e.career], [1, 1, 0, career]);
  assert.ok(Object.values(e.stats).every((v) => v === 50), 'DaggerfallStats.SetDefaults: every stat 50');
  const c = troll.corpsePrefab;
  assert.ok(c, 'the prefab took the body');
  withRandom(0, () => c.struck(FROST, 1, null));
  assert.ok(troll.corpsePrefab === c && c.entity.health === 1, 'frost on a low roll: the resistance saves it whole');
  withRandom(0, () => c.struck(LIGHT, 1, null));
  assert.equal(c.entity.health, 1, 'a light harms nothing');
  withRandom(0, () => c.struck(FIRE, 1, null));
  assert.equal(c.entity.health, 0, 'fire on the same low roll: the weakness takes no save');
  assert.equal(troll.corpsePrefab, null, 'and the body is gone');
  const second = await fallenTroll();
  withRandom(0.999, () => second.troll.corpsePrefab.struck(FROST, 1, null));
  assert.equal(second.troll.corpsePrefab, null, 'frost on a high roll lands - and burns it');
  // a lasting effect: its first round now (saved), a later round in the host's magic rounds (OnNewMagicRound)
  const third = await fallenTroll();
  const rot = third.troll.corpsePrefab;
  withRandom(0, () => rot.struck(FROST_ROT, 1, null));
  assert.ok(third.troll.corpsePrefab === rot && rot.entity.health === 1 && rot.entity.activeEffects.length, 'its first round saved, the rot still on the body');
  withRandom(0.999, () => rot.rounds(1000, 1001));
  assert.equal(third.troll.corpsePrefab, null, 'a later round lands - and burns it');
});

test('DEX5-3 THE STREET: the troll\'s body is no loot from its first frame; ten seconds of the foes\' clock and a NEW troll stands where it lay, the body gone and the HUD told; a body this machine does not run never counts; the cheat freezes the count', async () => {
  const { pool, troll, said } = await fallenTroll();
  assert.equal(troll.corpseDisabled, true, 'PostParentedSetup: the loot destroyed');
  assert.deepEqual(pool.lootTargets().filter((t) => t.key?.startsWith('foeCorpse')), [], 'no body to search');
  assert.ok(troll.corpseMarker, 'the body lies');
  const at = [...troll.corpseMarker.pos];
  tick(pool, 9.5);
  assert.equal(pool.foes.filter((f) => f.mobileType === TROLL && !f.dead).length, 0, 'not before its ten seconds');
  tick(pool, 0.75);
  await settle();
  const risen = pool.foes.filter((f) => f.mobileType === TROLL && !f.dead);
  assert.equal(risen.length, 1, 'a troll stands again');
  assert.notEqual(risen[0], troll, 'a NEW one (CreateEnemy) - the dead one stays dead');
  assert.deepEqual(risen[0].ai.feet.map((v) => +v.toFixed(3)), at.map((v) => +v.toFixed(3)), 'where the body lay');
  assert.equal(troll.corpse, false, 'its body taken away');
  assert.ok(said.includes('The Troll has recovered from its injuries.'), said.join(' | '));
  // a puppet's body: its owner counts, and its owner's spell burns it
  const other = await fallenTroll();
  other.troll.puppet = 'peer-0001';
  tick(other.pool, 12);
  await settle();
  assert.equal(other.pool.foes.filter((f) => f.mobileType === TROLL && !f.dead).length, 0, 'a body another machine runs does not rise here');
  withRandom(0, () => other.troll.corpsePrefab.struck(FIRE, 1, null));
  assert.ok(other.troll.corpsePrefab && other.troll.corpse, 'nor burns here');
  // the cheat
  const frozen = await fallenTroll();
  setModSetting(DEX_VENDOR, 'Cheat.DisableTrollRespawn', true);
  tick(frozen.pool, 20);
  await settle();
  assert.equal(frozen.pool.foes.filter((f) => f.mobileType === TROLL && !f.dead).length, 0, 'Cheat.DisableTrollRespawn: it stays down');
  assert.equal(frozen.troll.corpsePrefab.respawnBuffer, TROLL_CORPSE.respawnTime, 'its count frozen where it stood');
  setModSetting(DEX_VENDOR, 'Cheat.DisableTrollRespawn', false);
  tick(frozen.pool, 10.25);
  await settle();
  assert.equal(frozen.pool.foes.filter((f) => f.mobileType === TROLL && !f.dead).length, 1, 'the cheat off: the count goes on');
});

test('DEX5-4 THE BURN in the street: the death is said (DisableEnemyDeathAlert its gate), the body goes and the ash stands in its place by its centre, 0.1 over the body\'s foot - the record\'s body now, a marker the pool keeps; no troll rises after', async () => {
  const { pool, troll, said } = await fallenTroll();
  const foot = [...troll.corpseMarker.pos];
  troll.entity.properName = 'the bridge troll';   // a troll with a name of its own (champions.js properName) - its body knows its MobileID alone
  const before = said.length;
  withRandom(0, () => troll.corpsePrefab.struck(FIRE, 1, null));
  await settle();
  assert.deepEqual(said.slice(before), ['Troll just died.'], 'GetLocalizedEnemyName(MobileID) - the kind, never the foe\'s own name');
  assert.equal(troll.corpseDestroyed, 2, 'the body burnt');
  assert.ok(!pool.batches().some((b) => b.archive === TROLL_CORPSE.archive && b.record === TROLL_CORPSE.record), 'the body\'s picture gone');
  const ash = pool.batches().find((b) => b.archive === TROLL_CORPSE.ash.archive && b.record === TROLL_CORPSE.ash.record);
  assert.ok(ash, 'the ash stands');
  assert.equal(troll.corpseMarker?.batch, ash, 'in the body\'s place - so its record rides on and says so');
  assert.deepEqual(pool.lootTargets().filter((t) => t.key?.startsWith('foeCorpse')), [], 'an ash is no container');
  const [c] = ash.centers;
  assert.ok(Math.abs(c[1] + ash.size.h / 2 - (foot[1] + TROLL_CORPSE.ash.centre)) < 1e-9, `its centre 0.1 over the foot (${c[1]} + ${ash.size.h / 2})`);
  assert.deepEqual([c[0], c[2]], [foot[0], foot[2]]);
  tick(pool, 15);
  await settle();
  assert.equal(pool.foes.filter((f) => f.mobileType === TROLL && !f.dead).length, 0, 'burnt: gone for good');
  const quiet = await fallenTroll();
  setValue('GUI', 'DisableEnemyDeathAlert', true);
  const n = quiet.said.length;
  withRandom(0, () => quiet.troll.corpsePrefab.struck(FIRE, 1, null));
  assert.equal(quiet.said.length, n, 'the alert off: silent');
});

test('DEX5-5 THE MISSILE: my spell\'s missile meets the body\'s trigger and its bundle burns it (a target at range); a blade or an arrow is no door to it; nor is a body the mod\'s switch left a plain corpse', async () => {
  const { troll } = await fallenTroll();
  const player = { isPlayer: true, level: 1, health: 50, maxHealth: 50, magicka: 500, maxMagicka: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  const sinks = { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: () => {} };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity }, playerEntity: player, playerSinks: sinks, say: () => {}, surfacePlayer() {},
    foes: () => [troll], foeSinks: () => sinks, absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99,
  });
  const s = troll.corpsePrefab.sphere();
  assert.ok(s && s.radius === TROLL_TRIGGER_RADIUS);
  assert.ok(Math.abs(s.center[1] - (troll.corpseMarker.pos[1] + troll.corpseMarker.size.h / 2)) < 1e-9, 'about the body\'s centre');
  magic.readySpell(FIRE);
  const eye = [troll.corpseMarker.pos[0], s.center[1], troll.corpseMarker.pos[2] - 6];
  assert.equal(magic.castInput(eye, [0, 0, 1]), true, 'the bolt is loosed');
  withRandom(0, () => { for (let i = 0; i < 40 && troll.corpsePrefab; i++) magic.update(0.05, [0, 0, -50], [0, 0, 1], CAPSULE_HEIGHT); });
  assert.equal(troll.corpsePrefab, null, 'the missile met the trigger and the fire burned it');
  // the melee and arrow doors read living foes alone: the body's prefab is never on them
  const ext = rd('src/scenes/exteriorFoes.js');
  assert.match(ext, /function damageFoe\(f, damage[^\n]*\n\s*if \(f\.dead \|\| \(fromPlayer && !peer && sparedBySwing\(f\)\)\) return;/, 'a blade or an arrow on a body lands nothing (WeaponDamage passes an entity of type None by)');   // AUDIT WORLD-EVENTS: PIN MOVED - a shipmate is now one of the bodies `sparedBySwing` spares (combat/friendlyFire.js), a refugee the other
  // the switch off: the prefab is the loaded mod's - a plain corpse, lootable, and it lies
  const off = await fallenTroll({ on: false });
  assert.equal(off.troll.corpsePrefab, null);
  assert.notEqual(off.troll.corpseDisabled, true);
});

test('DEX5-6 THE DOOR: a prefab by its picture, attached on every machine at the mint and driven only while the body lies; never on an executed revenant\'s body; the trigger\'s geometry (its radius and the missile\'s reach)', () => {
  reset();
  const seen = [];
  registerCorpsePrefab(9, 3, (f, host) => { seen.push(f.id); return { frame: (dt) => seen.push(`${f.id}:${dt}`), sphere: () => ({ center: [0, 1, 0], radius: 1 }), host }; });
  assert.throws(() => registerCorpsePrefab(9, 'x', () => null), /registerCorpsePrefab/);
  const runner = createCorpsePrefabs({ runs: () => true, key: () => null });
  const a = { id: 'a', dead: true, corpse: true }, b = { id: 'b', dead: true, corpse: true, executed: true }, c = { id: 'c', dead: true, corpse: true };
  assert.ok(runner.mint(a, { archive: 9, record: 3 }));
  assert.equal(runner.mint(b, { archive: 9, record: 3 }), null, 'an executed revenant\'s body is the port\'s own fate');
  assert.equal(runner.mint(c, { archive: 9, record: 4 }), null, 'another picture: no prefab');
  assert.equal(runner.mint({ id: 'd' }, null), null, 'no picture at all');
  assert.equal(a.corpsePrefab.host.alive(), true);
  runner.frame([a, b, c], 0.5);
  a.corpse = false;
  runner.frame([a], 0.5);
  assert.deepEqual(seen, ['a', 'a:0.5'], 'driven while it lies, and only it');
  a.corpse = true;
  assert.equal(corpsePrefabStruck([0, 1, 1.4], [a], 0.45), a, 'radius 1 and the missile\'s reach 0.45');
  assert.equal(corpsePrefabStruck([0, 1, 1.5], [a], 0.45), null);
  assert.equal(corpsePrefabStruck([0, 1, 0], [{ ...a, dead: false }], 0.45), null, 'a living foe is no body');
  const pa = a.corpsePrefab;
  runner.destroy();
  assert.equal(pa.host.alive(), false, 'the host gone: its bodies with it');
  assert.equal(a.corpsePrefab, null, 'AUDIT DEX D12: and each of its prefabs let go');
});

test('DEX5-7 THE SAVE: every body still down with its time left, by the host\'s key; a load sets a body\'s time where it lies and where it is stood later (a quickload restores the mod\'s record first); a body with no time left is skipped; a body gone, risen or its host destroyed is not saved', async () => {
  reset();
  installEnemyExpansion({ on: true, log: silent });
  const host = (keys) => createCorpsePrefabs({ runs: () => true, body: () => null, rise: () => true, burn() {}, say() {}, key: (f) => keys.get(f) ?? null });
  const keys = new Map();
  const runner = host(keys);
  const body = (id) => { const f = { id, mobileType: TROLL, dead: true, corpse: true, entity: {} }; keys.set(f, `dungeon:7|${id}`); runner.mint(f, { archive: 1618, record: 20 }); return f; };
  const one = body(1), two = body(2);
  runner.frame([one], 4);
  assert.deepEqual(trollSaveData(), { activeCorpses: [{ key: 'dungeon:7|1', respawnBuffer: 6 }, { key: 'dungeon:7|2', respawnBuffer: 10 }] });
  assert.deepEqual(modSaveRecords()[DEX_VENDOR], trollSaveData(), 'on DFU\'s mod save slot, under the mod\'s vendor');
  restoreTrollSaveData({ activeCorpses: [{ key: 'dungeon:7|1', respawnBuffer: 2.5 }, { key: 'dungeon:7|3', respawnBuffer: 4 }, { key: 'dungeon:7|4', respawnBuffer: 0 }] });
  assert.equal(one.corpsePrefab.respawnBuffer, 2.5, 'a body that lies: its time now');
  assert.equal(two.corpsePrefab.respawnBuffer, 10, 'a body the save did not name keeps its own');
  const three = body(3), four = body(4);
  assert.equal(three.corpsePrefab.respawnBuffer, 4, 'a body stood after the load: its time then');
  assert.equal(four.corpsePrefab.respawnBuffer, 10, 'no time left: skipped (RestoreSaveData\'s `continue`)');
  two.corpse = false;   // freed by another road (the hour's respawn, the stream's un-death)
  runner.frame([one], 3);   // ...and one rises (AUDIT DEX D8: once its stand answers)
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(trollSaveData().activeCorpses.map((r) => r.key), ['dungeon:7|3', 'dungeon:7|4']);
  runner.destroy();
  assert.deepEqual(trollSaveData(), { activeCorpses: [] }, 'the host destroyed: no body of it is saved');
  restoreModSaveRecords({});
  assert.equal(trollSaveData().activeCorpses.length, 0, 'a save without the record: NewSaveData');
});

test('DEX5-8 THE HOSTS WIRE IT: the dungeon and the street mint a body\'s prefab at their corpse mint, drive it on the foes\' clock and its magic rounds, drop it with the host; the dungeon\'s loot gate honours the disabled body and its save writes a destroyed body as none', () => {
  const dc = rd('src/scenes/dungeonContext.js'), ext = rd('src/scenes/exteriorFoes.js'), sh = rd('src/scenes/shared.js');
  assert.match(dc, /f\.corpsePos = p;[^\n]*\n\s*corpsePrefabs\.mint\(f, ct\);/);
  assert.match(dc, /function lootableBody\(f\) \{ return !!f\?\.dead && !!f\.corpse && f\._ownFrom == null && !f\.corpseDisabled; \}/);
  assert.match(dc, /roomClaimTick\(_ecvT \* 1000\);[^\n]*\n\s*corpsePrefabs\.frame\(foes, dt\);/);
  assert.equal((dc.match(/if \(f\.dead\) \{ f\.corpsePrefab\?\.rounds\?\.\(/g) ?? []).length, 2, 'both of the dungeon\'s foe round loops');
  assert.match(dc, /_peopleLane\.destroy\(\);[^\n]*\n\s*corpsePrefabs\.destroy\(\);/);
  assert.match(dc, /\.\.\.\(f\.dead && f\.corpseDestroyed \? \{ bg: f\.corpseDestroyed \} : \{\}\),/, 'AUDIT DEX D3: its kind, which the memory carries too');
  assert.match(ext, /corpsePrefabs\.mint\(f, ct\);[^\n]*\n\s*mintCorpseMarker\(\{/);
  assert.match(ext, /corpsePrefabs\.frame\(foes, dt\);/);
  assert.match(ext, /foes\.length = 0;\n\s*corpsePrefabs\.destroy\(\);/);
  assert.match(sh, /if \(f\?\.dead && !f\.puppet\) f\.corpsePrefab\?\.rounds\?\.\(from, to\);/);
});

/** DEX5b: two players in one cell - the troll's owner and a peer - each a real pool, their frames and hits carried by
 *  hand (net/online.js's two lanes, as test/net/world6biiic.test.js carries them). */
const netFor = (me, hits) => ({ room: () => 'world:3,12', inRoom: () => false, selfId: () => me, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });
let _n = 0;
const carry = (from, to, id) => { const frame = from.foesFrame(true); to.applyFoes(id, { ...frame, n: ++_n, k: 'world:3,12', full: 1 }); };
async function cell() {
  reset();
  installEnemyExpansion({ on: true, log: silent });
  const said = [], peerSaid = [], ownerHits = [], peerHits = [];
  const owner = streetPool(said), peer = streetPool(peerSaid);
  owner.setNet(netFor('own-0001', ownerHits)); peer.setNet(netFor('peer-0002', peerHits));
  const troll = await owner.spawnFoe(TROLL, [5, 0, 5], { feetGiven: true });
  troll.entity.items = [{ group: 'Weapons', templateIndex: 116, name: 'Shortsword', stackCount: 1 }];
  carry(owner, peer, 'own-0001');   // the peer sees it standing...
  await settle();
  owner.damageFoe(troll, 100000, [0, 0, 0]);
  await settle();
  carry(owner, peer, 'own-0001');   // ...and fall where its owner's stream lets it
  await settle();
  const copy = peer.foes.find((f) => f.puppet === 'own-0001' && f.mobileType === TROLL);
  return { owner, troll, said, peer, peerSaid, ownerHits, peerHits, copy };
}

test('DEX5-9 THE WIRE: a dead foe\'s record may say its body gone - `bg` 1 (it rose) or 2 (burnt to its ash), on a death\'s record alone; else the record is refused whole', () => {
  for (const bg of [1, 2]) assert.deepEqual(validFoeRecord({ i: 3, d: 1, bg }), { i: 3, d: 1, bg });
  for (const r of [{ i: 3, d: 1, bg: 0 }, { i: 3, d: 1, bg: 3 }, { i: 3, d: 1, bg: '2' }, { i: 3, d: 0, bg: 2 }, { i: 3, bg: 1 }]) assert.equal(validFoeRecord(r), null, JSON.stringify(r));
});

test('DEX5-10 ONLINE, THE BURN: a peer\'s copy of the body is no loot either (the owner\'s record says none on it); the peer\'s missile bundle goes to the owner (`cs`), whose body burns; the owner\'s record says `bg` 2 and the peer\'s copy turns to ash - its own count never ran', async () => {
  const { owner, troll, peer, ownerHits, peerHits, copy } = await cell();
  assert.ok(copy?.dead, 'the peer holds a copy of the body');
  assert.equal(owner.foesFrame(true).f.find((r) => r.t === TROLL).o, 0, 'the owner says nothing lies on it');
  assert.equal(copy.corpseDisabled, true);
  assert.deepEqual(peer.lootTargets().filter((t) => t.key?.startsWith('foeCorpse')), [], 'no body to search on the peer');
  withRandom(0, () => copy.corpsePrefab.struck(FIRE, 4, null));
  assert.ok(copy.corpsePrefab && copy.corpse && !copy.corpseDestroyed, 'nothing burns on the copy');
  const hit = peerHits.at(-1);
  assert.deepEqual([hit.to, hit.i, hit.dmg, hit.kind, hit.cs, hit.lv], ['own-0001', troll.seq, 0, 'spell', 1, 4], 'the bundle, to the owner');
  assert.equal(ownerHits.length, 0);
  assert.equal(withRandom(0, () => owner.applyHit('peer-0002', hit)), true, 'the owner lands it on its body');
  assert.equal(troll.corpseDestroyed, 2, 'and the body burns');
  await settle();
  const r = owner.foesFrame(true).f.find((x) => x.t === TROLL);
  assert.equal(r.bg, 2, 'its record says so');
  assert.deepEqual(validFoeRecord(r).bg, 2, 'through the wire\'s own door');
  carry(owner, peer, 'own-0001');
  await settle();
  assert.equal(copy.corpseDestroyed, 2, 'the peer\'s copy burns too');
  assert.equal(copy.corpseMarker?.record, TROLL_CORPSE.ash.record, 'to its ash');
  assert.ok(!peer.batches().some((b) => b.archive === TROLL_CORPSE.archive && b.record === TROLL_CORPSE.record), 'its body\'s picture gone');
  assert.equal(owner.applyHit('peer-0002', hit), false, 'a body gone takes no second bundle');
});

test('DEX5-11 ONLINE, THE RISE: the owner alone counts; its body goes with its record and the peer\'s copy with it; the new troll reaches the peer as any foe of the owner\'s', async () => {
  const { owner, peer, copy } = await cell();
  tick(peer, 12);
  await settle();
  assert.ok(copy.dead && copy.corpse, 'the peer\'s copy never rises by itself');
  tick(owner, 10.25);
  await settle();
  const risen = owner.foes.find((f) => f.mobileType === TROLL && !f.dead);
  assert.ok(risen, 'the owner\'s troll stands again');
  carry(owner, peer, 'own-0001');
  await settle();
  assert.ok(!peer.foes.includes(copy) || !copy.corpse, 'the copy of the body is gone');
  assert.ok(peer.foes.some((f) => f.puppet === 'own-0001' && f.mobileType === TROLL && !f.dead), 'and the new troll stands on the peer');
});

test('DEX5-12 ONLINE UNDERGROUND: the record says a body gone (`bg`, roomRecord) and every copy loses it (applyFoeRecord); a destroyed body rides on in a shared encounter\'s and a loose foe\'s lanes; a copy\'s missile goes by the lane its foe rides, and the seat and a loose foe\'s owner land it on the body', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /^\s*if \(f\.dead && f\.corpseDestroyed\) r\.bg = f\.corpseDestroyed;/m);
  assert.match(dc, /\$\{r\.d\},\$\{r\.bg \?\? 0\},\$\{r\.a\}/, 'and a change of it is a change of the record (its key)');
  assert.match(dc, /else setFoeDead\(f, false\);\n\s*\}\n\s*if \(r\.d === 1 && r\.bg\) corpsePrefabs\.told\(f, r\.bg\);/);
  assert.match(dc, /if \(f\._ownFrom != null \|\| \(f\.dead && !f\.corpse && !f\.corpseDestroyed\)\) continue;/);
  assert.match(dc, /if \(\(f\.dead && !f\.corpse && !f\.corpseDestroyed\) \|\| !foes\.includes\(f\)\) _sharedById\.delete\(id\);/);
  assert.match(rd('src/scenes/corpsePrefabHost.js'), /f\._ownFrom != null \? \{ own: 1, to: f\._ownFrom, k: h\.locationKey\(\), i: f\._ownI, \.\.\.hit \} : \{ \.\.\.\(f\._encId != null \? \{ i: f\._encId, xs: 1 \} : \{ i: f\._surI \?\? h\.foes\.indexOf\(f\) \}\), \.\.\.hit \}/);
  assert.match(dc, /if \(f\?\.dead && data\.cs === 1 && \(xs \|\| i < _layoutFoes\)\) \{ const s = hitSpellOf\(data\); return !!s && !!f\.corpsePrefab\?\.struck\(s\.spell, s\.level, null\); \}/);
  assert.match(dc, /if \(f\?\.dead && data\.cs === 1\) \{ if \(f\.entity\?\.team === 'PlayerAlly' \|\| !\(ownLoose\(f\) \|\| \(!!ownQuestTag\(f\) && ownPeerMayHit\(id, f\)\)\)\) return false; const s = hitSpellOf\(data\); return !!s && !!f\.corpsePrefab\?\.struck\(s\.spell, s\.level, null\); \}/, 'AUDIT DEX D7: through the gate a living blow passes');
  assert.match(dc, /if \(!foes\.includes\(f\) \|\| f\.corpseDestroyed\) return;/, 'a body told gone while its art warmed never lands');
  const ext = rd('src/scenes/exteriorFoes.js');
  assert.match(ext, /if \(npcLane\) for \(const f of foes\) if \(f\.dead && f\.corpse && !f\.corpseDestroyed && isBodyFoe\(f\) && f\.ai\)/, 'the street\'s ash stands no Morrowind body');
  assert.match(ext, /if \(_corpseGen !== epoch \|\| f\._gone \|\| f\.corpseDestroyed\) \{ renderer\.destroyBillboardBatch\(c\.batch\); return; \}/, 'a body told gone while its art loaded never lands');
  // the door's told, by itself: a copy with a prefab loses the body by the prefab's word, one with none by the host's
  const seen = [];
  const runner = createCorpsePrefabs({ vanish: (f) => seen.push(`vanish:${f.id}`) });
  const withPrefab = { id: 'a', dead: true, corpse: true, corpsePrefab: { gone: (k) => seen.push(`gone:${k}`) } };
  runner.told(withPrefab, 2);
  runner.told({ id: 'b', dead: true, corpse: true }, 2);
  runner.told({ id: 'c', dead: false }, 1);
  runner.told({ id: 'd', dead: true, corpseDestroyed: 1 }, 1);
  runner.told({ id: 'e', dead: true }, 7);
  assert.deepEqual(seen, ['gone:2', 'vanish:b'], 'a live foe, a body already gone and a word of no law are nothing');
});

