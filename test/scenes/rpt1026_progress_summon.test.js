// RPT1026-PROGRESS (a private report, 2026-10-26: the Skull's copies were looted like any foe): an artifact's allied summon carries
// no loot. Driven on the producers: the Skull of Corruption minted off DFU's own MAGIC.DEF table (loot.js createArtifact),
// used through the enchantment payload door (enchantments.js doItemEnchantmentPayloads) over the ONE enchant ctx every
// host mounts (scenes/hostEnchant.js createEnchantCtx), whose stand is a real foe pool (scenes/exteriorFoes.js - the
// street's and a building's) on the freeware's MONSTER.BSA; the foes die through the pool's own damage door. The record
// is the batch's Field-Bugs page.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createEnchantCtx } from '../../src/scenes/hostEnchant.js';
import { doItemEnchantmentPayloads, PAYLOAD, ENCHANTMENT_TYPES as T } from '../../src/systems/enchantments.js';
import { ARTIFACTS } from '../../src/systems/artifactEffects.js';
import { createArtifact } from '../../src/systems/loot/loot.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { capFoeLoot } from '../../src/systems/foeLootCap.js';
import { fakeMagicTemplates } from '../honestItems.mjs';   // DFU's own MAGIC.DEF table (dfuMagicItems.mjs)

const ARENA2 = process.env.ARENA2_PATH ?? '';   // 17n: the corpus comes from the environment alone
const SKIP = existsSync(join(ARENA2, 'MONSTER.BSA')) ? false : 'no ARENA2 - run tools/fetch-data.sh and set ARENA2_PATH';
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
const player = () => ({ isPlayer: true, level: 20, reflexes: 2, health: 500, maxHealth: 500, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), items: [], goldPieces: 0, activeEffects: [], gender: 'male', stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 }, armorValues: new Array(7).fill(60) });
const pool = (pe) => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => new Uint8Array(readFileSync(join(ARENA2, n))), getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => '3,12', playerEntity: pe, audio: null, onPlayerHurt: () => {}, rolls: () => 0.3, rand: () => 0.3, spellsByIndex: () => null, say: () => {},
});
/** The Skull of Corruption, off DFU's own MAGIC.DEF - the artifact whose Used payload names its subtype. */
function skull() {
  const magic = fakeMagicTemplates();
  for (let i = 0; i < 64; i++) {
    let it;
    try { it = createArtifact(magic, i); } catch { break; }
    if ((it.enchantments ?? []).some((e) => e.type === T.SpecialArtifactEffect && e.param === ARTIFACTS.SkullOfCorruption)) return it;
  }
  throw new Error('no Skull of Corruption in the table');
}
/** A pool and the ctx the hosts mount over it, its stand the street host's own door (world.js _standLooseFoe: a loose
 *  stand, the alliance passed through). */
function scene() {
  const pe = player();
  const foes = pool(pe);
  const ctx = createEnchantCtx({
    playerEntity: pe, spellsByIndex: () => new Map(), now: () => 0, sinks: {}, magic: null,
    foes: () => foes.foes, foeSinks: () => ({}), feet: () => [0, 0, 0],
    standLooseFoe: (mt, o = {}) => foes.spawnFoe(mt, [4, 0, 4], { yaw: 0, allied: o.allied, loose: true, feetGiven: true }),
  });
  return { pe, foes, ctx };
}

test('RPT1026-PROGRESS (Skull of Corruption): the Skull\'s allied copy of a Daedroth carries nothing, alive or dead - the original it fights carries its loot as ever (mutants: the summon unmarked; the death\'s finds kept)', { skip: SKIP }, async () => {
  const { pe, foes, ctx } = scene();
  const original = await foes.spawnFoe(MOBILE_TYPES.Daedroth, [6, 0, 6], { yaw: 0, feetGiven: true });
  assert.ok(original?.entity, 'the Daedroth stands');
  assert.ok(original.entity.items.length > 0, `a Daedroth carries its loot (${original.entity.items.length} pieces)`);
  const item = skull();
  doItemEnchantmentPayloads(PAYLOAD.Used, item, { entity: pe, ctx, collection: pe.items });
  await settle(); await settle();
  const copy = foes.foes.find((f) => f !== original && f.entity?.team === 'PlayerAlly');
  assert.ok(copy, 'the Skull stood an allied copy');
  assert.equal(copy.mobileType, MOBILE_TYPES.Daedroth, 'of the nearest foe');
  assert.deepEqual(copy.entity.items, [], 'the copy carries nothing');
  assert.equal(copy.entity.summoned, true);
  foes.damageFoe(copy, 1e6, [0, 0, 0]);
  assert.equal(copy.dead, true);
  assert.deepEqual(copy.entity.items, [], 'and its body holds nothing - no kit laddered, no death handler\'s find');
  foes.damageFoe(original, 1e6, [0, 0, 0]);
  assert.ok(original.entity.items.length > 0, 'the original\'s body is looted as ever');
});

test('RPT1026-PROGRESS (Skull of Corruption): a summon\'s body is emptied by the last word every body door asks, whatever was laid on it after its stand', () => {
  const e = { summoned: true, items: [{ group: 'Currency', templateIndex: 276, stackCount: 40 }, { group: 'Weapons', templateIndex: 116 }], lootCap: 3 };
  const list = e.items;
  assert.equal(capFoeLoot(e).length, 2);
  assert.equal(e.items, list, 'emptied in place - a corpse that holds the list holds an empty one');
  assert.deepEqual(e.items, []);
});
