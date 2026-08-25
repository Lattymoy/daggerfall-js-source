// AUDIT 23 fix pins, wave 1: save integrity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { createDroppedLoot } from '../src/scenes/droppedLoot.js';
import { attachFactionRep, getReputation, setReputation } from '../src/systems/factionRep.js';
import { FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS } from '../src/formats/factionFile.js';
import { applyCharacter } from '../src/systems/chargen.js';
import { CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';

// The producer-shaped synthetic faction dict (the court.test.js idiom):
// every column FactionFile mints, never a thinner record.
const FIELDS = ['id', 'parent', 'type', 'name', 'rep', 'summon', 'region', 'power', 'flags',
  'ruler', 'ally1', 'ally2', 'ally3', 'enemy1', 'enemy2', 'enemy3', 'face', 'race',
  'flat1', 'flat2', 'sgroup', 'ggroup', 'minf', 'maxf', 'vam', 'rank',
  'rulerNameSeed', 'rulerPowerBonus', 'children'];
const fac = (o) => {
  const base = {};
  for (const k of FIELDS) base[k] = (k === 'name' ? 'f' + o.id : k === 'children' ? null : 0);
  return Object.assign(base, o);
};
const dict = () => new Map([
  [100, fac({ id: 100, type: FACTION_TYPES.People, sgroup: SOCIAL_GROUPS.Commoners, ggroup: GUILD_GROUPS.GeneralPopulace, region: 17 })],
  [41, fac({ id: 41, type: 2, ggroup: 11 })],
]);
const minimalEntity = () => ({ stats: { endurance: 50 }, skills: [], skillUses: [], items: [], spells: [] });

test('AUDIT 23 C1: a load with no store STASHES the faction columns, attach REPLAYS them, and a re-save cannot null them', () => {
  // A played session: store attached, reputation earned, saved.
  const played = minimalEntity();
  attachFactionRep(played, dict());
  setReputation(played.factionRep, 41, 37);
  const snap = snapshotPlayer(played, {});
  assert.equal(snap.factionRep.ids.includes(41), true);

  // The menu LOAD GAME path: restore into the pre-chargen entity,
  // which has NO store - the columns must not be dropped.
  const fresh = minimalEntity();
  restorePlayer(fresh, snap);
  assert.equal(fresh.factionRep, undefined, 'nothing attaches a store during restore');
  assert.ok(fresh.savedFactionRep, 'the saved columns are stashed for the attach');

  // F9 pressed BEFORE anything attaches: the save must carry the
  // stash forward, not null (nulling here was the permanent loss).
  const resaved = snapshotPlayer(fresh, {});
  assert.ok(resaved.factionRep, 'a store-less re-save keeps the saved reputation');
  assert.deepEqual(resaved.factionRep, snap.factionRep);

  // The store finally attaches (guild popup / court / chargen): the
  // stash replays onto it and is consumed.
  attachFactionRep(fresh, dict());
  assert.equal(getReputation(fresh.factionRep, 41), 37, 'the earned reputation survives the round trip');
  assert.equal(fresh.savedFactionRep, undefined, 'the stash is consumed by the replay');
});

test('AUDIT 23: guild memberships restore UNCONDITIONALLY - a pre-guild save clears the book', () => {
  // GuildManager.RestoreMembershipData clears before applying (:321-324).
  const entity = minimalEntity();
  const preGuildSnap = snapshotPlayer(entity, {});   // carries guildMemberships: null
  entity.guildMemberships = { 11: { guild: 'FightersGuild', rank: 3, lastRankChange: 0 } };
  restorePlayer(entity, preGuildSnap);
  assert.deepEqual(entity.guildMemberships, {}, 'the later-joined membership does not survive a backward load');
});

test('AUDIT 23: lastSkillCheckTime rides the envelope and anchors at the classic start', () => {
  // SerializablePlayer.cs:124/:293 persist it one-for-one.
  const entity = minimalEntity();
  entity.lastSkillCheckTime = 524000;
  const snap = snapshotPlayer(entity, {});
  const back = minimalEntity();
  restorePlayer(back, snap);
  assert.equal(back.lastSkillCheckTime, 524000);
  // PlayerEntity.cs:881 anchors at NOW on AssignCharacter; a new
  // game's now is the classic start minute, not zero.
  const rolled = {};
  const career = {
    name: 'Warrior', hitPointsPerLevel: 10, advancementMultiplier: 1.0,
    strength: 55, intelligence: 40, willpower: 45, agility: 50,
    endurance: 55, personality: 45, speed: 50, luck: 50,
    abilityFlagsAndSpellPointsBitfield: 0,
    primarySkills: [], majorSkills: [], minorSkills: [],
  };
  applyCharacter(rolled, career, 16, {
    rolls: () => 0.5,
    stats: { strength: 55, intelligence: 40, willpower: 45, agility: 50, endurance: 55, personality: 45, speed: 50, luck: 50 },
    skills: new Array(35).fill(12),
  });
  assert.equal(rolled.lastSkillCheckTime, CLASSIC_GAME_START_TIME);
});

test('AUDIT 23: dropped piles round-trip the world snapshot with their SAVED icon', async () => {
  // save-load-4: LootContainerData_v1 (SerializableGameObject.cs:396-416)
  // carries the container across every DFU save; the dungeon snapshot
  // now rides {pos, record, items} the same way.
  const deps = () => {
    let batchN = 0;
    return {
      renderer: {
        createBillboardBatch: () => ({ n: ++batchN }),
        destroyBillboardBatch: () => { batchN--; },
        live: () => batchN,
      },
      getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
      uploadRecordFrame: () => {},
    };
  };
  const a = deps();
  const store = createDroppedLoot({ ...a, pick: () => 7 });
  store.dropPile([{ name: 'sword', stackCount: 1 }], [3, 0, 4]);
  const saved = store._piles.map((p) => ({ pos: [...p.pos], record: p.record, items: p.items.map((it) => ({ ...it })) }));

  // A fresh context (the boot-load path): restore re-mints the pile
  // with the SAVED record - rolling a new icon here would visibly
  // reshuffle every pile on load.
  const b = deps();
  const fresh = createDroppedLoot({ ...b, pick: () => { throw new Error('a restore must not reroll the icon'); } });
  fresh.restorePiles(saved);
  assert.equal(fresh._piles.length, 1);
  assert.equal(fresh._piles[0].record, saved[0].record);
  assert.deepEqual(fresh._piles[0].items, [{ name: 'sword', stackCount: 1 }]);
  assert.notEqual(fresh._piles[0].items, saved[0].items, 'restored items are copies, not aliases');
  await Promise.resolve(); await Promise.resolve();   // the mount promise settles
  assert.equal(b.renderer.live(), 1, 'the restored pile mounts its flat');

  // A snapshot with no piles CLEARS the live set (rebuild-from-save).
  fresh.restorePiles(undefined);
  assert.equal(fresh._piles.length, 0);
  assert.equal(b.renderer.live(), 0, 'clearing frees the batch');
});

test('AUDIT 23: both dungeon-mounting hosts pass the spawn applier; the snapshot carries the piles', () => {
  // save-load-3: worldModes wrote player.pos raw where dungeon.js uses
  // player.spawn - a quickload kept velY/falling across the teleport.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const wm = readFileSync(join(root, 'src/scenes/worldModes.js'), 'utf8');
  assert.ok(wm.includes('(p) => player.spawn(p[0], p[1], p[2])'),
    'worldModes routeKey applier calls player.spawn');
  assert.equal(wm.includes('player.pos[0] = p[0]'), false,
    'the raw-pos applier is gone');
  // I2 FOLLOW-UP: the applier has to be routeKey's THIRD argument, and
  // the input arc's signature change left this host passing the old
  // castDir thunk there - the applier was silently never called, so a
  // quickload in ?dungeon restored the character without moving them.
  // Both hosts are pinned to the three-argument form.
  const dj = readFileSync(join(root, 'src/scenes/dungeon.js'), 'utf8');
  for (const [name, sourceText] of [['dungeon.js', dj], ['worldModes.js', wm]]) {
    const call = /routeKey\(e, \w+, \(p\) => player\.spawn\(p\[0\], p\[1\], p\[2\]\)\)/.exec(sourceText);
    assert.ok(call, `${name} passes the spawn applier as routeKey's third argument`);
  }
  const dc = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.ok(/droppedLoot: droppedLoot\._piles\.map/.test(dc), 'collectWorld carries the piles');
  assert.ok(/droppedLoot\.restorePiles\(w\.droppedLoot\)/.test(dc), 'applyWorld restores them');
  // save-load-11: the action-object record is ActionSystem's law (and
  // pinned by RUNNING it in action.test.js); the host must route
  // through it rather than grow a second, thinner snapshot shape.
  assert.ok(/actions: actions\.collectSaveData\(\)/.test(dc), 'collectWorld delegates the action record');
  assert.ok(/actions\.restoreSaveData\(w\.actions\)/.test(dc), 'applyWorld delegates the restore');
});

test('AUDIT 23: the sticky region price band rides the envelope', () => {
  // RegionData.PriceAdjustment is serialized (SerializablePlayer.cs:168).
  const entity = minimalEntity();
  entity.regionPrices = { 17: 991, 23: 1204 };
  const snap = snapshotPlayer(entity, {});
  const back = minimalEntity();
  restorePlayer(back, snap);
  assert.deepEqual(back.regionPrices, { 17: 991, 23: 1204 });
  // ...and the snapshot is a copy, not an alias.
  entity.regionPrices[17] = 800;
  assert.equal(snap.regionPrices[17], 991);
});
