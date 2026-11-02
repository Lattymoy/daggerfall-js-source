// FIELD BUGS 2026-10-18 LOOT-FLATS (bible/01-Overview/bugs/Field-Bugs-2026-10-18.md, found reading Anon-e-moose's
// "Gradual FPS loss then crash": "When in interior cells, and especially in combat, the FPS gradually slows down over 5
// mins or so"). Not that report's cause - its cause is not proven - but a real leak on its path: five of the nine places
// the loot pool freed a pile's batch (both restores - every room left and every load - and the scene's sweep of emptied
// piles) destroyed it and left its animator entry, so the animator ticked the dead batches of every animated pile the pool
// had ever held; and a pile reminted where it now lies (a recentre, a moved ground) stood still, its entry still on the
// batch it replaced. Driven on the real pool (scenes/droppedLoot.js) over a renderer that records its batches.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDroppedLoot } from '../../src/scenes/droppedLoot.js';
import { FlatAnimator } from '../../src/render/flatAnimation.js';

const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };
/** An animated record: four frames (a light's flicker, a glinting pile). */
const animTex = { getSize: () => ({ width: 64, height: 64 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 64, getFrameCount: () => 4 };
/** A still record: one frame. */
const stillTex = { ...animTex, getFrameCount: () => 1 };

function pool(tex = animTex) {
  const made = [], destroyed = new Set();
  // AUDIT FB1018 L4-4: the real batch's frame starts null (renderer.js createBillboardBatch), as here
  const renderer = { createBillboardBatch: () => { const b = { frame: null }; made.push(b); return b; }, destroyBillboardBatch: (b) => destroyed.add(b) };
  const loot = createDroppedLoot({ renderer, getTexture: async () => tex, uploadRecordFrame: () => {} });
  return { loot, made, destroyed };
}
/** Whether ticking moves `batch`'s frame (the animator still holds it). */
function ticks(loot, batch) {
  const was = [];
  for (let i = 0; i < 12; i++) { loot.tickFlats(0.1); was.push(batch.frame); }
  return new Set(was).size > 1;
}

test('LOOT-FLATS A FREED PILE LEAVES THE ANIMATOR: both restores and the sweep of emptied piles take a pile\'s animator entry with its batch, as removal and a pixel\'s collection always did - a destroyed batch is never ticked again (mutants: a restore\'s free without the animator; the sweep\'s)', async () => {
  for (const clear of [(l) => l.restorePiles([]), (l) => l.restoreWorld([], () => [0, 0, 0]), (l, p) => { p.items.length = 0; l.releaseEmptied(); }, (l, p) => l.removePile(p)]) {   // AUDIT FB1018 L4-4: and a pile removed
    const { loot, destroyed } = pool();
    const p = loot.seedPile([{ group: 'Gems', templateIndex: 0 }], [1, 0, 1], { archive: 216, record: 5 }, null, '1,1', { unsaved: true });
    await flush();
    const b = p.batch;
    assert.ok(b && ticks(loot, b), 'an animated pile animates');
    clear(loot, p);
    assert.ok(destroyed.has(b), 'its batch freed');
    assert.equal(ticks(loot, b), false, 'and never ticked again');
  }
  // AUDIT FB1018 L3-1: the sweep's own arm - a player's pile. A scene-built container emptied is deactivated (an arm that
  // always let go of its entry), so the seeded pile above never reached the sweep's free.
  const { loot, destroyed } = pool();
  const p = loot.dropPile([{ group: 'Gems', templateIndex: 0 }], [1, 0, 1], null, { archive: 216, record: 5 });
  await flush();
  const b = p.batch;
  assert.ok(b && !p.container && ticks(loot, b), 'a player\'s pile animates');
  p.items.length = 0; loot.releaseEmptied();
  assert.ok(destroyed.has(b), 'the sweep freed its batch');
  assert.equal(ticks(loot, b), false, 'and never ticked again');
});

test('LOOT-FLATS A REMINTED PILE KEEPS ITS CLOCK: a recentre and a moved ground mint the batch again where the pile lies, and the animator\'s entry follows it - the new batch animates, the old is ticked no more (FlatAnimator.rebind) (mutants: the entry left on the old batch; the rebind unwired)', async () => {
  for (const move of [(l) => l.offsetAll([819.2, 0, 0]), (l) => l.groundMoved(-1e9, -1e9, 1e9, 1e9, () => 2)]) {
    const { loot } = pool();
    const p = loot.seedPile([{ group: 'Gems', templateIndex: 0 }], [1, 0, 1], { archive: 216, record: 5 }, null, '1,1', { unsaved: true });
    await flush();
    const old = p.batch;
    move(loot);
    assert.notEqual(p.batch, old, 'reminted');
    assert.ok(ticks(loot, p.batch), 'the new batch animates');
    assert.equal(ticks(loot, old), false, 'the old one is let go');
  }
  // AUDIT FB1018 L4-4: every animated pile follows its own remint, not the first alone; a still one keeps its frame and F2
  {
    const { loot } = pool();
    const a = loot.seedPile([{ group: 'Gems', templateIndex: 0 }], [1, 0, 1], { archive: 216, record: 5 }, null, '1,1', { unsaved: true });
    const b = loot.seedPile([{ group: 'Gems', templateIndex: 0 }], [3, 0, 3], { archive: 216, record: 6 }, null, '1,1', { unsaved: true });
    await flush();
    loot.offsetAll([819.2, 0, 0]);
    assert.ok(ticks(loot, a.batch) && ticks(loot, b.batch), 'both reminted piles animate');
  }
  {
    const { loot } = pool(stillTex);
    const p = loot.seedPile([{ group: 'Gems', templateIndex: 0 }], [1, 0, 1], { archive: 216, record: 5 }, null, '1,1', { unsaved: true });
    await flush();
    const f0 = p.batch.frame;
    loot.offsetAll([819.2, 0, 0]);
    assert.equal(p.batch.frame, f0, 'a still pile drawn at the frame it was minted at');
    assert.equal(p.batch.noShadow, true, 'and casting no shadow (F2)');
  }
  const a = new FlatAnimator(), from = {}, to = {};
  a.add(from, 216, 4);
  a.tick(0.5);
  a.rebind(from, to);
  assert.equal(to.frame, from.frame, 'its frame carried, not restarted');
  assert.equal(a.entries.length, 1);
});

test('LOOT-FLATS ONE WAY TO FREE A PILE\'S BATCH: every destroyBillboardBatch in the pool is freeBatch\'s or remintBatch\'s (mutants: a free written again by hand)', () => {
  const src = readFileSync(new URL('../../src/scenes/droppedLoot.js', import.meta.url), 'utf8');
  const frees = src.match(/renderer\.destroyBillboardBatch\(/g) ?? [];
  assert.equal(frees.length, 2, 'freeBatch and remintBatch alone');
  assert.match(src, /function freeBatch\(p\) \{\n\s+if \(!p\.batch\) return;\n\s+flatAnims\.remove\(p\.batch\);\n\s+renderer\.destroyBillboardBatch\(p\.batch\);/);
  assert.match(src, /flatAnims\.rebind\(was, p\.batch\);/);
});
