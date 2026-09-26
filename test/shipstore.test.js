// SHIP-STORE (2026-09-26, Mac: "No ui to put items in storage on boat - problem for enhanced and enhanced +"):
// MAC-M2 B made the enhanced skins' loot session take-only - the pile's frame alone, no way to the pack ("the loot
// window is for taking") - which is right for a body or a stranger's shelf. But the player's OWN storage opens
// through that same session: the ship's chest, an owned house's cupboards, a placed storage piece. Every one of them
// became a box that could only be emptied. DFU's HouseContainers arm opens it two-way (PlayerActivate.cs:902-925),
// and the classic skin still does. The host says `loot.storage` for the player's own, and that session opens beside
// the pack with a Store verb.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountEnhancedInventory, remoteModel, STOW_LABEL, REMOTE_TITLE } from '../src/ui/enhancedInventory.js';
import { withDom } from './invdrag.mjs';
import { ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAGGER = () => { const t = ITEM_TEMPLATES.find((x) => x.name === 'Dagger'); return { name: t.name, templateIndex: t.index, group: 'Weapons', stackCount: 1, currentCondition: 50, maxCondition: 50 }; };

test('SHIP-STORE: the player\'s own storage is its own remote kind - Storage, and a Store verb; a body stays Loot', () => {
  assert.equal(remoteModel({ loot: { items: () => [], storage: true } }).kind, 'storage');
  assert.equal(remoteModel({ loot: { items: () => [] } }).kind, 'container', 'a body, a stranger\'s cupboard, a shelf');
  assert.equal(remoteModel({ loot: { items: () => [], storage: 'yes' } }).kind, 'container', 'only a TRUE word is storage');
  assert.equal(REMOTE_TITLE.storage, 'Storage');
  assert.equal(STOW_LABEL.storage, 'Store');
  assert.equal(remoteModel({ loot: { items: () => [], storage: true }, pile: {} }).pile, null, 'storage is never a pile of bodies');
});

test('SHIP-STORE: the ship\'s chest opens BESIDE the pack, and an item goes in; a body opens alone, as MAC-M2 B has it', () => {
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Janome', stats: { strength: 50 }, items: [DAGGER()], goldPieces: 0 };
    const chest = [];
    let view = null;
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, loot: { items: () => chest, storage: true }, onExit: () => view.unmount() });
    assert.ok(host.querySelector('.pack-id'), 'the pack is built');
    assert.ok(host.querySelector('.loot-win'), 'and the chest beside it');
    const named = (r) => r.querySelector('.itemname')?.children?.[0]?.textContent ?? '';
    const row = host.querySelectorAll('.itemrow').find((r) => named(r).startsWith('Dagger'));
    assert.ok(row, 'the pack\'s own item is listed (the chest is empty)');
    row.onclick();
    const store = host.querySelectorAll('.act').find((b) => b.textContent === 'Store');
    assert.ok(store, 'the Store verb is offered');
    store.onclick();
    assert.equal(chest.length, 1, 'the item went into the chest');
    assert.equal(chest[0].name, 'Dagger');
    assert.equal(e.items.length, 0, '...out of the pack');
    view.unmount();
  });
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Janome', stats: { strength: 50 }, items: [DAGGER()], goldPieces: 0 };
    let view = null;
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, loot: { items: () => [DAGGER()] }, onExit: () => view.unmount() });
    assert.equal(host.querySelector('.pack-id'), null, 'a body: the pile\'s frame alone');
    assert.ok(host.querySelector('.loot-win'));
    view.unmount();
  });
});

test('SHIP-STORE: the host says storage for the player\'s own, and never for a stranger\'s or a shop\'s', () => {
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /loot: \{ items: \(\) => c\.items, storage: !privateProperty \},/, 'an owned house\'s or ship\'s cupboard (openLoot without privateProperty)');
  assert.match(m, /interiorInventory\(\{ loot: \{ items: \(\) => interiorDecor\.itemsOf\(id\), storage: true \} \}\)/, 'a placed storage piece, opened for its owner alone');
  assert.match(m, /loot: \{ items: \(\) => shelf\.items \},/, 'a closed shop\'s shelf is stealing, never storage');
});
