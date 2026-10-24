// EM3-3D TRAIL (the 3D dungeon map's walked record, systems/automap/automap.js automapTrailTick): the patch pinned the tick
// and the reveal arms but not the SAVE. Added at the merge (2026-09-27): the trail rides the save and comes back with
// the dungeon's record, and a save from another layout of the same dungeon comes back without it, as its reveal does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enterDungeonAutomap, bindAutomapLayout, buildRevealIndex, automapTrailTick, automapTrailPoints,
  snapshotAutomap, restoreAutomap, resetAutomapStore,
} from '../../../src/systems/automap/automap.js';

const BIG = { min: [-100, -100, -100], max: [100, 100, 100] };

test('EM3-3D trail: the walked trail rides the save and comes back on the load arm (mutants: not saved; not restored)', () => {
  resetAutomapStore();
  try {
    const model = buildRevealIndex([{ key: '0:1', aabb: BIG, blockIndex: 0, blockName: 'LIVE.RDB' }]);
    const rec = enterDungeonAutomap('em3/trail', 0);
    bindAutomapLayout(rec, model);
    assert.equal(automapTrailTick(rec, [1.2, 1.7, 3.4]), true, 'a first step is recorded');
    assert.equal(automapTrailTick(rec, [4.6, 1.7, 3.4]), true);
    const snap = snapshotAutomap(0);
    assert.deepEqual([...snap['em3/trail'].trail].sort(), [...rec.trail].sort(), 'the save carries the trail');
    resetAutomapStore();
    restoreAutomap(JSON.parse(JSON.stringify(snap)));   // through the save's own JSON
    const loaded = enterDungeonAutomap('em3/trail', 0, { fromLoad: true });
    bindAutomapLayout(loaded, model);
    assert.deepEqual([...loaded.trail].sort(), [...rec.trail].sort(), 'and the load puts it back');
    assert.equal(automapTrailPoints(loaded).length, 2, 'as the two points the solid sheet draws near');
  } finally { resetAutomapStore(); }
});

test('EM3-3D trail: a save from another layout of the same dungeon comes back with no trail, as it comes back with no reveal (mutant: the trail kept across a new layout)', () => {
  resetAutomapStore();
  try {
    const model = buildRevealIndex([{ key: '0:1', aabb: BIG, blockIndex: 0, blockName: 'LIVE.RDB' }]);
    restoreAutomap({ 'em3/other': { revealed: ['0:1'], visitedThisRun: ['0:1'], entranceDiscovered: true, lastVisited: 5,
      blockNames: ['OTHER.RDB'], notes: [], teleporters: [], trail: ['1,0,3', '4,0,3'], trailAll: true } });
    const loaded = enterDungeonAutomap('em3/other', 0, { fromLoad: true });
    assert.equal(loaded.trail?.size, 2, 'restored as saved');
    bindAutomapLayout(loaded, model);
    assert.equal(loaded.revealed.size, 0, 'the layout guard cleared the reveal');
    assert.equal(loaded.trail, undefined, 'and the walked trail of a layout that is gone');
    assert.equal(loaded.trailAll, undefined);
  } finally { resetAutomapStore(); }
});
