// MAP-KEEP (2026-09-27, Flylighter on Discord: "3D Map Unfilling areas mid-dungeon - Parts of the map previously
// filled out will randomly disappear from the 3D map ... just about every dungeon"). The reveal store only ever grows
// while a player stands in a dungeon; it was the LOAD that took the map away. A save made in a dungeon comes back
// through the world host's door build, and (1) that build entered the restored record on the FRESH-ENTRY arm - the
// colour tier (visited this run) reset, so every step taken went gray, the record stamped and the store pruned - where
// DFU's load arm (initFromLoadingSave, Automap.cs:2492-2493) touches none of it; and (2) the save was restored
// BEFORE the scene being left was torn down, and that teardown's exit stamped the dungeon it left in the SAVE's store
// with the clock being left, and at "remember 0 dungeons" cleared the whole store it had just restored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enterDungeonAutomap, exitDungeonAutomap, getDungeonAutomap, restoreAutomap, resetAutomapStore } from '../src/systems/automap.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const saved = () => ({ 'r/Crypt': { revealed: ['0:1', '0:2', '1:9'], visitedThisRun: ['0:1', '0:2'], entranceDiscovered: true, lastVisited: 5000 } });

test('MAP-KEEP: a load into the dungeon it was saved in keeps the run\'s colour tier - the teardown of the scene left writes nothing into the save\'s store', () => {
  resetAutomapStore(); _resetForTests();
  try {
    enterDungeonAutomap('r/Crypt', 9000).revealed.add('9:9');   // standing in the dungeon when the load is pressed
    restoreAutomap(saved());                                   // restorePlayer: the store is the save's
    exitDungeonAutomap(9100);                                  // forceExitToExterior's teardown of the scene being left
    assert.equal(getDungeonAutomap('r/Crypt').lastVisited, 5000, 'the save\'s record is not stamped with the clock being left');
    const rec = enterDungeonAutomap('r/Crypt', 5000, { fromLoad: true });   // the door build, on the load arm
    assert.deepEqual([...rec.visitedThisRun], ['0:1', '0:2'], 'the run drawn in colour is still in colour');
    assert.deepEqual([...rec.revealed], ['0:1', '0:2', '1:9'], 'and everything revealed is revealed');
    assert.equal(rec.lastVisited, 5000);
    // the fresh-entry arm is what the build used to take: it is a new run, and the gray tier is its law
    exitDungeonAutomap(5100);
    assert.equal(enterDungeonAutomap('r/Crypt', 6000).visitedThisRun.size, 0, 'a real re-entry starts a new run');
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('MAP-KEEP: at "remember 0 dungeons" the store a load restored survives the teardown - a real exit still forgets', () => {
  resetAutomapStore(); _resetForTests();
  try {
    setValue('Map', 'AutomapNumberOfDungeons', 0);
    enterDungeonAutomap('r/Other', 100);
    restoreAutomap(saved());
    exitDungeonAutomap(200);
    assert.ok(getDungeonAutomap('r/Crypt'), 'the loaded dungeon\'s map is there to enter');
    enterDungeonAutomap('r/Crypt', 5000, { fromLoad: true });
    exitDungeonAutomap(5100);
    assert.equal(getDungeonAutomap('r/Crypt'), null, 'walking out still forgets it - the vanilla law');
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('MAP-KEEP / THE HOSTS: the world host\'s load enters the saved dungeon on the load arm, through the door build', () => {
  assert.match(rd('src/scenes/world.js'), /modes\?\.startInDungeon\?\.\(\{ locationKey: extras\.locationKey, fromLoad: true \}\)/);
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /async function startInDungeon\(\{ locationKey = null, fromLoad = false \} = \{\}\) \{/);
  assert.match(m, /return tryEnterDungeon\(hit, entries, \{ preferEnterMarker: true, fromLoad \}\);/);
  assert.match(m, /gatedTransition\(\(live\) => dungeonTransition\(hit, entries, preferEnterMarker, live, fromLoad\)\)/);
  assert.match(m, /automapFromLoad: fromLoad,/);
  // AUDIT 27h M1: the court's record stands outside the store; every other dungeon enters on the arm it was handed
  assert.match(rd('src/scenes/dungeonContext.js'), /let automapRec = isGateArena\(dfLocation\)(?: \|\| isArenaFloor\(dfLocation\))? \? detachedAutomapRecord\(\)[^\n]*\n\s*: enterDungeonAutomap\(automapKey, classicMinutesRef\.value, \{ fromLoad: !!opts\.automapFromLoad \}\);/);
  // the other entries stay fresh ones: only the load passes it
  assert.equal((m.match(/fromLoad: true/g) ?? []).length, 0, 'worldModes never claims a load on its own');
});
