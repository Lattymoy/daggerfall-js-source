// FIELD BUGS 2026-10-16c (LAYOUT-KEEP) - MD-Geist: "the automap needed to be revealed again in 'Instance' even though it
// had been fully explored and revealed in 'Public'". Online one dungeon stands in two layouts under one automap record (its
// key is the place's - automapDungeonKey): the public room the size the world gives it, the instance Daggerfall's whole.
// The restore guard (bindAutomapLayout, DFU's :2385-2386) wiped the discovery, the notes and the portals of one layout
// each time the player took the other, both ways. A record now keeps each layout's discovery under its own blocks, and
// takes it back when that layout is built again - through a save and a load as well; a layout no record knows still
// starts blank, as DFU's guard rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  enterDungeonAutomap, exitDungeonAutomap, resetAutomapStore, bindAutomapLayout, snapshotAutomap, restoreAutomap, getDungeonAutomap,
  automapDungeonKey, AUTOMAP_LAYOUTS_KEPT,
} from '../../../src/systems/automap/automap.js';
import { buildAutomapModel } from '../../../src/systems/automap/automapModel.js';
import { _resetForTests } from '../../../src/systems/settings/settings.js';

const KEY = automapDungeonKey(17, 'Ruins of The Hold of Coppering');
/** A layout of `names`, one model a block. */
const layout = (...names) => buildAutomapModel(names.map((n, i) => ({ key: `${i}:1`, aabb: [i, 0, 0, i + 1, 1, 1], blockIndex: i, blockName: n })));
const PUBLIC = layout('B0', 'B1', 'B2');            // the world's medium build
const WHOLE = layout('B0', 'B1', 'B2', 'B3', 'B4');  // the instance's, Daggerfall's own
/** Enter the dungeon as built (`model`), as dungeonContext does: the record, then the bind. */
const enter = (model, t) => { const rec = enterDungeonAutomap(KEY, t); bindAutomapLayout(rec, model); return rec; };
const discover = (rec, rows, note) => {
  for (const r of rows) rec.revealed.add(r);
  rec.entranceDiscovered = true;
  if (note) rec.notes.set(1, { position: [1, 2, 3], note });
};

test('LAYOUT-KEEP: public, then the instance, then public again - each layout\'s map, notes and portals kept and taken back; a layout no record knows starts blank (mutants: the keep; the take-back; the visit reset)', () => {
  _resetForTests(); resetAutomapStore();
  try {
    const pub = enter(PUBLIC, 10);
    discover(pub, ['0:1', '1:1', '2:1'], 'the lever');
    pub.teleporters.set('a', { entrance: { pos: [0, 0, 0], yawDeg: 0 }, exit: { pos: [1, 1, 1], yawDeg: 90 } });
    exitDungeonAutomap(20);
    const inst = enter(WHOLE, 30);
    assert.deepEqual([inst.revealed.size, inst.notes.size, inst.entranceDiscovered], [0, 0, false], 'the whole layout: never the public room\'s models');
    discover(inst, ['3:1', '4:1']);
    exitDungeonAutomap(40);
    const back = enter(PUBLIC, 50);
    assert.deepEqual([[...back.revealed].sort(), back.notes.get(1)?.note, back.teleporters.size, back.entranceDiscovered, back.blockNames], [['0:1', '1:1', '2:1'], 'the lever', 1, true, ['B0', 'B1', 'B2']], 'public again: its map, as it was left');
    assert.equal(back.visitedThisRun.size, 0, 'a new run');
    exitDungeonAutomap(60);
    assert.deepEqual([...enter(WHOLE, 70).revealed].sort(), ['3:1', '4:1'], 'and the instance\'s, both ways');
    exitDungeonAutomap(80);
    const fresh = enter(layout('C0', 'C1'), 90);
    assert.equal(fresh.revealed.size, 0, 'a layout no record knows: blank, as DFU\'s guard rules');
    // a bounded keep: a third layout explored and a fourth built - the oldest kept (public's) let go
    discover(fresh, ['0:1']);
    exitDungeonAutomap(95);
    enter(layout('D0'), 100);
    assert.equal(AUTOMAP_LAYOUTS_KEPT, 2);
    assert.equal(getDungeonAutomap(KEY).layouts.size, AUTOMAP_LAYOUTS_KEPT);
    exitDungeonAutomap(105);
    assert.equal(enter(PUBLIC, 110).revealed.size, 0, 'the oldest kept, let go');
  } finally { resetAutomapStore(); _resetForTests(); }
});

test('LAYOUT-KEEP: the kept layouts ride the save - a load in the instance, then public, finds the public map (mutants: the save\'s field; the load\'s)', () => {
  _resetForTests(); resetAutomapStore();
  try {
    discover(enter(PUBLIC, 10), ['0:1', '2:1'], 'the lever');
    exitDungeonAutomap(20);
    const whole = enter(WHOLE, 30);
    discover(whole, ['4:1']);
    whole.visitedThisRun.add('4:1');
    const snap = JSON.parse(JSON.stringify(snapshotAutomap(40)));
    assert.equal(snap[KEY].layouts.length, 1);
    resetAutomapStore();
    restoreAutomap(snap);
    const loaded = enterDungeonAutomap(KEY, 40, { fromLoad: true });
    bindAutomapLayout(loaded, WHOLE);
    assert.deepEqual([...loaded.revealed], ['4:1']);
    exitDungeonAutomap(50);
    const pub = enter(PUBLIC, 60);
    assert.deepEqual([[...pub.revealed].sort(), pub.notes.get(1)?.note], [['0:1', '2:1'], 'the lever']);
    // a load whose build is the OTHER layout (a load arm keeps the saved run's visits): the kept one taken back, a new run
    resetAutomapStore();
    restoreAutomap(snap);
    const other = enterDungeonAutomap(KEY, 40, { fromLoad: true });
    assert.deepEqual([...other.visitedThisRun], ['4:1'], 'the load keeps the saved run');
    bindAutomapLayout(other, PUBLIC);
    assert.deepEqual([[...other.revealed].sort(), other.visitedThisRun.size], [['0:1', '2:1'], 0], 'the whole layout\'s visits are none of the public room\'s');
    // a save with no kept layout writes none - the field is absent, as an older reader expects
    resetAutomapStore();
    discover(enter(PUBLIC, 10), ['0:1']);
    assert.equal('layouts' in snapshotAutomap(20)[KEY], false);
  } finally { resetAutomapStore(); _resetForTests(); }
});
