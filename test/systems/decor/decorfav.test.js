// Catalogue favourites: a star on a row, a Favourites filter that still searches and sorts, and the ids kept on
// this device by catalogue key — never a display name, never the account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterDecor } from '../../../src/systems/decor/decorCatalogue.js';
import { loadDecorFavourites, toggleDecorFavourite, saveDecorFavourites } from '../../../src/systems/decor/decorFavourites.js';
import { createDecorPanel } from '../../../src/ui/decorPanel.js';
import { catalogue, fakeDoc, fakeWin, all, rows, chipNamed } from '../../decorFakes.mjs';
import { DECOR_CAP } from '../../../src/net/decorLaw.js';

function store() {
  const bag = new Map();
  return {
    getItem: (k) => bag.get(k) ?? null,
    setItem: (k, v) => { bag.set(k, String(v)); },
    removeItem: (k) => { bag.delete(k); },
  };
}

test('DECOR-FAV the filter: favourites narrow the catalogue and leave kind, words and sort in force; a display name is not an id', () => {
  const entries = [
    { key: 'm1', kind: 'furniture', name: 'Chair', storage: false, light: null },
    { key: 'm2', kind: 'furniture', name: 'Table', storage: false, light: null },
    { key: 'f210.3', kind: 'light', name: 'Candle', storage: false, light: {} },
  ];
  const fav = new Set(['m1', 'f210.3']);
  assert.deepEqual(filterDecor(entries, { favourite: fav, sort: 'name' }).map((e) => e.key), ['f210.3', 'm1']);
  assert.deepEqual(filterDecor(entries, { favourite: fav, kinds: ['furniture'] }).map((e) => e.key), ['m1']);
  assert.deepEqual(filterDecor(entries, { favourite: fav, text: 'candle' }).map((e) => e.key), ['f210.3']);
  assert.deepEqual(filterDecor(entries, { text: 'table' }).map((e) => e.key), ['m2'], 'favourites off: the search is the whole catalogue');
  const mem = store();
  assert.equal(toggleDecorFavourite('Chair', mem).size, 0);
  assert.deepEqual([...toggleDecorFavourite('m41000', mem)], ['m41000']);
  assert.equal(loadDecorFavourites(mem).has('m41000'), true);
  assert.equal(toggleDecorFavourite('m41000', mem).has('m41000'), false);
  saveDecorFavourites(new Set(['not a key', 'f210.3']), mem);
  assert.deepEqual([...loadDecorFavourites(mem)], ['f210.3']);
  mem.setItem('dfdecor-fav', '{');
  assert.equal(loadDecorFavourites(mem).size, 0, 'a broken store is no favourites');
});

test('DECOR-FAV the panel: a star marks a catalogue row, Favourites shows only those, and unstarring one there takes it off the list; a new panel still has them', () => {
  const prev = globalThis.localStorage;
  const mem = store();
  globalThis.localStorage = mem;
  try {
    const entries = catalogue();
    const doc = fakeDoc();
    const win = fakeWin();
    const view = {
      where: 'Your house', entries, progress: 1, ready: true, gold: 1000, count: 0, cap: DECOR_CAP,
      radiusOf: () => 0.5, priceOf: () => 75, placed: [],
    };
    const panel = createDecorPanel({ doc, win, onPlace() {}, thumbOf: async () => null });
    panel.open(view);
    const root = panel.root;
    const candle = entries.find((e) => e.key === 'f210.3');
    const row = rows(root).find((r) => r.dataset.key === candle.key);
    const star = all(row, 'dfdecor-fav')[0];
    assert.equal(star.getAttribute('aria-pressed'), 'false');
    const before = row.getAttribute('aria-selected');
    star.fire('click');
    const again = rows(root).find((r) => r.dataset.key === candle.key);
    assert.equal(all(again, 'dfdecor-fav')[0].getAttribute('aria-pressed'), 'true');
    assert.equal(again.getAttribute('aria-selected'), before, 'the star does not choose the row');
    chipNamed(root, 'Favourites').fire('click');
    assert.deepEqual(rows(root).map((r) => r.dataset.key), [candle.key]);
    all(rows(root)[0], 'dfdecor-fav')[0].fire('click');
    assert.equal(rows(root).length, 0, 'unstarring it under Favourites takes it off the list');
    chipNamed(root, 'Favourites').fire('click');
    const chair = rows(root).find((r) => r.dataset.key === 'm41000');
    all(chair, 'dfdecor-fav')[0].fire('click');
    const doc2 = fakeDoc();
    const panel2 = createDecorPanel({ doc: doc2, win: fakeWin(), onPlace() {}, thumbOf: async () => null });
    panel2.open(view);
    const root2 = panel2.root;
    assert.equal(all(rows(root2).find((r) => r.dataset.key === 'm41000'), 'dfdecor-fav')[0].getAttribute('aria-pressed'), 'true');
    chipNamed(root2, 'Favourites').fire('click');
    const search = all(root2, 'dfdecor-search')[0];
    search.value = 'candle';
    search.fire('input');
    assert.equal(rows(root2).length, 0, 'a favourite chair does not match a search for a candle');
  } finally {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
  }
});
