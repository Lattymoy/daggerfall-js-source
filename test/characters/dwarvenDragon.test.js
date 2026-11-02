// DWARVEN-DRAGON (src/characters/dwarvenDragon.js): the clockwork dragon's row, name and pictures registered once, every
// picture shipped at one size, a staff event may bring it, and its soul fills no trap (the item law knows none such).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng } from '../../tools/pngIO.mjs';
import { installDwarvenDragon, dwarvenDragonSpriteEntries, DWARVEN_DRAGON_ID, DWARVEN_DRAGON_ARCHIVE, DWARVEN_DRAGON_FRAMES, DWARVEN_DRAGON_ART, DWARVEN_DRAGON_ROW } from '../../src/characters/dwarvenDragon.js';
import { ENEMY_BASICS, isClassEnemyId, isClassicEnemyId, enemyDisplayName } from '../../src/characters/enemy/enemyBasics.js';
import { customCareerTemplate } from '../../src/characters/enemy/customEnemies.js';
import { DEX_ENEMY_IDS } from '../../src/systems/enemyExpansion/dexIds.js';
import { DEX_ART } from '../../src/systems/enemyExpansion/dexArt.js';
import { staffEventKindOk } from '../../src/net/staffEvent/staffEventLaw.js';
import { attemptSoulTrap, fillEmptyTrap } from '../../src/systems/mysticism.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('DWARVEN-DRAGON its id and archive are its own: a monster past every classic and Enemy Expansion id and archive', () => {
  assert.ok(!isClassicEnemyId(DWARVEN_DRAGON_ID) && !isClassEnemyId(DWARVEN_DRAGON_ID));
  assert.ok(!DEX_ENEMY_IDS.includes(DWARVEN_DRAGON_ID));
  assert.ok(!(DWARVEN_DRAGON_ARCHIVE in DEX_ART));
  assert.ok(staffEventKindOk(DWARVEN_DRAGON_ID), 'a staff event may bring it');
});

test('DWARVEN-DRAGON install registers its row, career and name once', () => {
  assert.equal(installDwarvenDragon({ fetchBytes: async () => new Uint8Array(0) }), 2 * DWARVEN_DRAGON_FRAMES.reduce((a, b) => a + b, 0));   // PIN MOVED (DRAGON7): the brass's and the Aetherbright's (1801, the same files turned)
  assert.equal(installDwarvenDragon(), 0, 'once');
  assert.equal(ENEMY_BASICS[String(DWARVEN_DRAGON_ID)].maleTexture, DWARVEN_DRAGON_ARCHIVE);
  assert.equal(customCareerTemplate(DWARVEN_DRAGON_ID)?.name, 'Dwarven Dragon');
  assert.equal(enemyDisplayName(DWARVEN_DRAGON_ID), 'Dwarven Dragon');
});

test('DWARVEN-DRAGON every picture ships, each record\'s frames one size, the attack\'s blow one of its frames', () => {
  const entries = dwarvenDragonSpriteEntries({ fetchBytes: async () => new Uint8Array(0) }).filter((e) => e.archive === DWARVEN_DRAGON_ARCHIVE);   // PIN MOVED (DRAGON7): the files that ship - the Aetherbright's 1801 is these turned at load
  assert.equal(entries.length, DWARVEN_DRAGON_FRAMES.reduce((a, b) => a + b, 0));
  const sizes = new Map();
  for (const e of entries) {
    const file = join(root, 'public', DWARVEN_DRAGON_ART, `${e.fileName}.png`);
    assert.ok(existsSync(file), `${e.fileName} ships`);
    const { width, height } = readPng(readFileSync(file));
    sizes.set(`${width}x${height}`, true);
  }
  assert.equal(sizes.size, 1, 'one size for every picture, so a flipped facing and every frame stand on one spot');
  const frames = DWARVEN_DRAGON_ROW.primaryAttackAnimFrames;
  assert.deepEqual(frames.filter((f) => f >= 0), [...Array(DWARVEN_DRAGON_FRAMES[5]).keys()], 'every attack frame, in order');
  assert.equal(frames.filter((f) => f === -1).length, 1, 'one blow');
});

test('DWARVEN-DRAGON its soul fills no trap, and its death is never held for one', () => {
  const gem = { group: 'MiscItems', templateIndex: 274, trappedSoulType: null };
  assert.equal(fillEmptyTrap([gem], DWARVEN_DRAGON_ID), null);
  assert.equal(gem.trappedSoulType, null);
  const r = attemptSoulTrap({ activeEffects: [{ kind: 'soulTrap', chance: 100 }] }, DWARVEN_DRAGON_ID, [], 0);
  assert.deepEqual(r, { allowDeath: true, alert: null, filled: null });
});
