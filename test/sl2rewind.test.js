// SL2-slice (AUDIT 23 save-load-2): applyWorld REWIND semantics.
// DFU's load REBUILDS the location and overlays the saved truth per
// LoadID (SerializableEnemy.RestoreSaveData SETS health :176 and
// disables only data.isDead :200-203; SerializableLootContainer
// removes an empty-in-save container :158-160). The port patches the
// live scene in place, so a BACKWARD mid-session load must reverse
// post-save state explicitly: foes killed after the save come back
// (corpse freed), and pile flats follow the restored items both ways.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dc = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
const applyWorldSrc = () => {
  const i = dc.indexOf('function applyWorld(w)');
  assert.ok(i > 0, 'applyWorld exists');
  return dc.slice(i, dc.indexOf('\n  }\n', dc.indexOf('w.actions?.forEach', i)));
};

test('SL2 save-load-2: a foe killed after the save RESURRECTS on a backward load, corpse freed', () => {
  const fn = applyWorldSrc();
  // the kill arm stands...
  assert.ok(fn.includes('if (sf.dead && !f.dead) { f.dead = true; spawnCorpse(f); }'), 'the forward kill arm');
  // ...and the rewind arm reverses it: alive-in-save + dead-live -> un-kill
  const arm = fn.slice(fn.indexOf('else if (!sf.dead && f.dead)'));
  assert.ok(arm.length > 20, 'the backward resurrect arm exists');
  assert.ok(arm.includes('f.dead = false;'), 'the foe stands back up (SetHealth restores; only data.isDead disables)');
  // the corpse flat leaves with the rewind - freed from BOTH owner
  // lists and destroyed, the foe key cleared
  assert.ok(arm.includes('corpses.indexOf(f.corpseBatch)'), 'spliced from corpses');
  assert.ok(arm.includes('billboardBatches.indexOf(f.corpseBatch)'), 'spliced from the draw list');
  assert.ok(arm.includes('renderer.destroyBillboardBatch(f.corpseBatch)'), 'GL freed (EVERY ALLOCATION HAS AN OWNER)');
  assert.ok(arm.includes('f.corpseBatch = null'), 'the key clears for a later re-kill');
  // health/items restore UNCONDITIONALLY above both arms (the full-restore law)
  assert.ok(fn.indexOf('f.entity.health = sf.health;') < fn.indexOf('if (sf.dead && !f.dead)'),
    'health is SET from the save before the dead reconciliation');
});

test('SL2 save-load-2: the pile flat FOLLOWS the restored items, both directions', () => {
  const fn = applyWorldSrc();
  const piles = fn.slice(fn.indexOf('w.piles?.forEach'), fn.indexOf('droppedLoot.restorePiles'));
  assert.ok(piles.includes('p.items = sp.items.map((it) => ({ ...it }));'), 'items restore from the save');
  // emptied-in-save -> the flat leaves (RemoveLootContainer on restore, :158-160)
  const down = piles.slice(piles.indexOf('if (!p.items.length && p.batch)'));
  assert.ok(down.includes('billboardBatches.indexOf(p.batch)'), 'the empty pile leaves the draw list');
  assert.ok(down.includes('renderer.destroyBillboardBatch(p.batch)'), 'and frees its GL batch');
  // refilled-by-rewind -> the rebuild's own mint comes back at the
  // build-time size; a pile the build never mounted (no half) stays out
  const up = piles.slice(piles.indexOf('else if (p.items.length && !p.batch && p.half)'));
  assert.ok(up.length > 20, 'the re-mint arm exists and gates on the build-time size');
  assert.ok(up.includes('createBillboardBatch(RANDOM_TREASURE_ARCHIVE, p.record'), 'the flat re-mints with the PILE record, never rerolled');
  assert.ok(up.includes('billboardBatches.push(p.batch)'), 'and rejoins the draw list');
});

test('SL2 save-load-2: spawnCorpse keys its batch to the foe and aborts on a mid-warm resurrect', () => {
  const i = dc.indexOf('async function spawnCorpse(f)');
  const fn = dc.slice(i, dc.indexOf('\n  }\n', i));
  // the race: getTexture awaits; a backward load can resurrect the
  // foe before the batch mints - a corpse must never stand for a live foe
  const guard = fn.indexOf('if (!f.dead) return;');
  assert.ok(guard > 0, 'the resurrect race guard exists');
  assert.ok(guard > fn.indexOf('await getTexture'), 'the guard re-checks AFTER the await');
  assert.ok(guard < fn.indexOf('createBillboardBatch'), 'and before the mint');
  assert.ok(fn.includes('f.corpseBatch = batch;'), 'the batch keys to its foe so the rewind can free it');
});
