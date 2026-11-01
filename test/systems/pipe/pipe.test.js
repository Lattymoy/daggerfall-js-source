// The Pipe and Nirnroot: their rows and the item law headless, the pipe's Use (one nirnroot spent and the haze started,
// or nothing spent without one), the haze's length and its canvas, the counter shelves, and the cards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PIPE_TEMPLATE, NIRNROOT_TEMPLATE, PIPE_LAW_ROW, NIRNROOT_LAW_ROW } from '../../../src/systems/pipe/pipeRow.js';
import {
  PIPE_ROW, NIRNROOT_ROW, PIPE_TEXT, NIRNROOT_SHELF_STACK, isPipe, isNirnroot, pipe, nirnroot, smokePipe,
  ensureShelfPipe, ensureShelfNirnroot,
} from '../../../src/systems/pipe/pipeItem.js';
import { HAZE_SECONDS, HAZE_FILTER, hazeSeconds, startHaze, clearHaze, hazeActive } from '../../../src/systems/pipe/pipeHaze.js';
import { templateByIndex, itemUseHandler } from '../../../src/systems/item/itemTemplates.js';
import { lawTemplate } from '../../../src/systems/item/itemLaw.js';
import { stockShopShelf } from '../../../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { survivalInfoTokens } from '../../../src/systems/item/itemInfo.js';

test('pipe: the rows are registered, and the item law knows them headless', () => {
  assert.equal(templateByIndex(PIPE_TEMPLATE)?.name, 'Pipe');
  assert.equal(templateByIndex(NIRNROOT_TEMPLATE)?.name, 'Nirnroot');
  assert.deepEqual([PIPE_ROW.worldTextureArchive, PIPE_ROW.worldTextureRecord], [211, 24]);
  assert.equal(lawTemplate(PIPE_TEMPLATE)?.basePrice, PIPE_LAW_ROW.basePrice);
  assert.equal(lawTemplate(NIRNROOT_TEMPLATE)?.basePrice, NIRNROOT_LAW_ROW.basePrice);
  assert.equal(NIRNROOT_ROW.stackable, true);
  assert.equal(PIPE_ROW.stackable, false);
  assert.ok(isPipe(pipe()) && isNirnroot(nirnroot(3)) && !isPipe(nirnroot()));
  assert.equal(nirnroot(3).stackCount, 3);
});

test('pipe: its Use spends one nirnroot from the pack and starts the haze', () => {
  const p = pipe();
  const entity = { items: [p, nirnroot(2)] };
  const hazes = [];
  const r = smokePipe(p, entity.items, { entity, rolls: () => 0.5, haze: (s) => hazes.push(s) });
  assert.equal(r.kind, 'smoked');
  assert.equal(r.closesWindow, true);
  assert.deepEqual(hazes, [45]);
  assert.equal(entity.items.find(isNirnroot).stackCount, 1);
  smokePipe(p, entity.items, { entity, rolls: () => 0, haze: (s) => hazes.push(s) });
  assert.equal(entity.items.some(isNirnroot), false, 'the last sprig is gone');
  assert.ok(entity.items.includes(p), 'the pipe is kept');
});

test('pipe: without nirnroot nothing is spent and the pack says why', () => {
  const p = pipe();
  const entity = { items: [p] };
  let hazed = false;
  const r = smokePipe(p, entity.items, { entity, haze: () => (hazed = true) });
  assert.deepEqual(r, { kind: 'text', text: PIPE_TEXT.noRoot() });
  assert.equal(hazed, false);
  assert.deepEqual(entity.items, [p]);
});

test('pipe: the use handler is registered for the pipe alone', () => {
  assert.equal(typeof itemUseHandler(PIPE_TEMPLATE), 'function');
  assert.equal(itemUseHandler(NIRNROOT_TEMPLATE), null);
});

test('pipe: a haze lasts 30 to 60 whole seconds', () => {
  assert.equal(hazeSeconds(() => 0), HAZE_SECONDS[0]);
  assert.equal(hazeSeconds(() => 0.999999), HAZE_SECONDS[1]);
  for (let i = 0; i < 200; i++) {
    const s = hazeSeconds();
    assert.ok(Number.isInteger(s) && s >= 30 && s <= 60, String(s));
  }
});

/** A document of one canvas, enough for the haze. */
function fakeDoc() {
  const els = new Map();
  const el = (id = '') => ({ id, style: {}, textContent: '', remove() { els.delete(this.id); } });
  const canvas = el('c');
  els.set('c', canvas);
  const add = (node) => { if (node.id) els.set(node.id, node); return node; };
  return {
    canvas,
    getElementById: (id) => els.get(id) ?? null,
    querySelector: () => canvas,
    createElement: () => el(),
    head: { appendChild: add },
    body: { appendChild: add },
  };
}

test('pipe: the haze blurs the canvas, mists over it, and clears at its end', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const doc = fakeDoc();
  assert.equal(startHaze(10, doc, 0), true);
  assert.equal(doc.canvas.style.filter, HAZE_FILTER);
  const mist = doc.getElementById('pipe-haze-mist');
  assert.ok(mist && mist.style.pointerEvents === 'none' && mist.style.opacity === '1');
  assert.equal(hazeActive(5000), true);
  t.mock.timers.tick(6000);
  assert.equal(doc.canvas.style.filter, '', 'fading out');
  assert.equal(mist.style.opacity, '0');
  t.mock.timers.tick(4000);
  assert.equal(doc.getElementById('pipe-haze-mist'), null, 'the mist is gone');
  assert.equal(hazeActive(10000), false);
  clearHaze(doc);
});

test('pipe: a second smoke runs the haze on from now, never thicker', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const doc = fakeDoc();
  startHaze(10, doc, 0);
  t.mock.timers.tick(5000);
  startHaze(10, doc, 5000);
  t.mock.timers.tick(5000);
  assert.equal(doc.canvas.style.filter, HAZE_FILTER, 'the first haze no longer ends it');
  t.mock.timers.tick(5000);
  assert.equal(doc.canvas.style.filter, '');
  clearHaze(doc);
  assert.equal(startHaze(10, null), false, 'no document, no haze');
});

test('pipe: the counter shelves carry a pipe and nirnroot', () => {
  const shelf = ensureShelfNirnroot(ensureShelfPipe([]));
  assert.equal(shelf.filter(isPipe).length, 1);
  assert.equal(shelf.find(isNirnroot).stackCount, NIRNROOT_SHELF_STACK);
  ensureShelfPipe(shelf);
  ensureShelfNirnroot(shelf);
  assert.equal(shelf.length, 2, 'never a second');
  const stock = (buildingType) => stockShopShelf({ buildingType, quality: 10 }, {}, { rolls: () => 0.5 });
  const general = stock(BUILDING_TYPES.GeneralStore);
  assert.ok(general.some(isPipe) && general.some(isNirnroot));
  const pawn = stock(BUILDING_TYPES.PawnShop);
  assert.ok(pawn.some(isPipe) && !pawn.some(isNirnroot));
  const alchemist = stock(BUILDING_TYPES.Alchemist);
  assert.ok(alchemist.some(isNirnroot) && !alchemist.some(isPipe));
});

test('pipe: the cards say what each is for', () => {
  assert.deepEqual(survivalInfoTokens(pipe()).slice(2).map((r) => r.text), PIPE_TEXT.pipe());
  assert.deepEqual(survivalInfoTokens(nirnroot()).slice(2).map((r) => r.text), PIPE_TEXT.nirnroot());
});
