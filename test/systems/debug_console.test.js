import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  executeConsoleLine,
  executeConsoleCommand,
  hasConsoleCommand,
  getConsoleCommand,
  setDebugSceneContext,
  getDebugSceneContext,
} from '../../src/systems/consoleCommands.js';
import { staffPowers, setStaffPowers, playerEntity, playerDamageWithheld } from '../../src/characters/playerEntity.js';
import { goldPiecesOf } from '../../src/systems/inventory.js';

test('Debug Console: tgm toggles god mode and invulnerability', () => {
  setStaffPowers({ god: false });
  assert.equal(staffPowers().god, false);
  assert.equal(playerDamageWithheld(), false);

  const res1 = executeConsoleLine('tgm');
  assert.equal(res1, 'God Mode: ON');
  assert.equal(staffPowers().god, true);
  assert.equal(playerDamageWithheld(), true);

  const res2 = executeConsoleLine('tgm');
  assert.equal(res2, 'God Mode: OFF');
  assert.equal(staffPowers().god, false);
  assert.equal(playerDamageWithheld(), false);
});

test('Debug Console: addgold increases player gold', () => {
  const initialGold = goldPiecesOf(playerEntity);
  const res = executeConsoleLine('addgold 250');
  assert.ok(res.includes('Added 250 gold'));
  assert.equal(goldPiecesOf(playerEntity), initialGold + 250);

  const resInvalid = executeConsoleLine('addgold');
  assert.equal(resInvalid, 'Usage: addgold <count>');

  const resNan = executeConsoleLine('addgold notanumber');
  assert.equal(resNan, 'Usage: addgold <count>');
});

test('Debug Console: teleport moves player coordinates', () => {
  let placed = null;
  setDebugSceneContext({
    setPlayerPos: (x, y, z) => { placed = [x, y, z]; },
  });

  const res = executeConsoleLine('teleport 12.5 34.0 -56.7');
  assert.deepEqual(placed, [12.5, 34.0, -56.7]);
  assert.ok(res.includes('Teleported to 12.50, 34.00, -56.70'));

  const resMissing = executeConsoleLine('teleport 10 20');
  assert.equal(resMissing, 'Usage: teleport <x> <y> <z>');

  const resInvalid = executeConsoleLine('teleport 10 abc 30');
  assert.equal(resInvalid, 'Usage: teleport <x> <y> <z>');
});

test('Debug Console: tele2loc teleports to named location', async () => {
  let targetLoc = null;
  setDebugSceneContext({
    tele2loc: async (name) => {
      targetLoc = name;
      return `Teleported to ${name} (100, 200)`;
    },
  });

  const res = await executeConsoleLine('tele2loc Daggerfall City');
  assert.equal(targetLoc, 'Daggerfall City');
  assert.equal(res, 'Teleported to Daggerfall City (100, 200)');

  const resMissing = await executeConsoleLine('tele2loc');
  assert.equal(resMissing, 'Usage: tele2loc <locationName>');
});

test('Debug Console: killall destroys hostile mobs', () => {
  let killed = false;
  setDebugSceneContext({
    killAllFoes: () => {
      killed = true;
      return 5;
    },
  });

  const res = executeConsoleLine('killall');
  assert.equal(killed, true);
  assert.equal(res, 'Killed 5 hostile entities.');

  setDebugSceneContext({
    killAllFoes: () => 0,
  });
  const resEmpty = executeConsoleLine('killall');
  assert.equal(resEmpty, 'No hostile entities found.');
});

test('Debug Console: help lists all basic debug commands', () => {
  assert.equal(hasConsoleCommand('tgm'), true);
  assert.equal(hasConsoleCommand('killall'), true);
  assert.equal(hasConsoleCommand('addgold'), true);
  assert.equal(hasConsoleCommand('teleport'), true);
  assert.equal(hasConsoleCommand('tele2loc'), true);
  assert.equal(hasConsoleCommand('help'), true);

  const helpList = executeConsoleLine('help');
  assert.ok(helpList.includes('tgm'));
  assert.ok(helpList.includes('killall'));
  assert.ok(helpList.includes('addgold'));
  assert.ok(helpList.includes('teleport'));
  assert.ok(helpList.includes('tele2loc'));
  assert.ok(helpList.includes('HELP'));

  const tgmDetail = executeConsoleLine('help tgm');
  assert.ok(tgmDetail.includes('Toggle God Mode'));
});

test('Debug Console: suicide/kill forces player death', () => {
  playerEntity.health = 50;
  setStaffPowers({ god: true });

  const res = executeConsoleLine('kill');
  assert.equal(res, 'Player killed.');
  assert.equal(playerEntity.health, 0);
  assert.equal(staffPowers().god, false);

  const resSuicide = executeConsoleLine('suicide');
  assert.equal(resSuicide, 'Player is already dead.');

  playerEntity.health = 50;
  const resKillme = executeConsoleLine('killme');
  assert.equal(resKillme, 'Player killed.');
  assert.equal(playerEntity.health, 0);
});

test('Debug Console: spawnfoe / spawn creates mobs by ID or name', async () => {
  let spawnedMob = null;
  let spawnedCount = 0;
  setDebugSceneContext({
    spawnFoe: async (mobileType, count) => {
      spawnedMob = mobileType;
      spawnedCount = count;
      return count;
    },
  });

  // By ID
  const resId = await executeConsoleLine('spawnfoe 15');
  assert.equal(spawnedMob, 15);
  assert.equal(spawnedCount, 1);
  assert.ok(resId.includes('SkeletalWarrior (ID: 15)'));

  // By name
  const resName = await executeConsoleLine('spawn rat 3');
  assert.equal(spawnedMob, 0);
  assert.equal(spawnedCount, 3);
  assert.ok(resName.includes('3x Rat (ID: 0)'));

  // By alias
  const resAlias = await executeConsoleLine('spawn skeleton');
  assert.equal(spawnedMob, 15);
  assert.ok(resAlias.includes('SkeletalWarrior'));

  // Invalid mob
  const resInvalid = await executeConsoleLine('spawn unknown_creature');
  assert.ok(resInvalid.includes('Unknown mob'));

  // Missing args
  const resMissing = await executeConsoleLine('spawnfoe');
  assert.equal(resMissing, 'Usage: spawnfoe <id|name> [count]');

  // spawnlist
  const resList = executeConsoleLine('spawnlist');
  assert.ok(resList.includes('Monsters (0..42):'));
  assert.ok(resList.includes('SkeletalWarrior'));
  assert.ok(resList.includes('Classes (128..146):'));
});

test('Debug Console UI: toggle and state API', async () => {
  const { isDebugConsoleOpen, toggleDebugConsole, openDebugConsole, closeDebugConsole, submitConsoleInput } = await import('../../src/ui/debugConsole.js');
  assert.equal(typeof isDebugConsoleOpen, 'function');
  assert.equal(typeof toggleDebugConsole, 'function');
  assert.equal(typeof openDebugConsole, 'function');
  assert.equal(typeof closeDebugConsole, 'function');
  assert.equal(typeof submitConsoleInput, 'function');
  assert.equal(isDebugConsoleOpen(), false);
});

