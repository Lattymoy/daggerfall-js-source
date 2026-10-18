// CONTAINER-PEEK - the plaque lists a cupboard's contents when the list
// already exists, and stays a name until it does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { containerPreviewItems, decorPreviewItems, interiorHeldPreview, createInteriorPeek } from '../../src/systems/containerPreview.js';

const ruby = { name: 'Ruby' };
const chest = (items, stockedDate = 5) => ({ items, stockedDate });

test('CONTAINER-PEEK: the player\'s own cupboard lists what it holds, a stranger\'s only once it is stocked today', () => {
  const boxes = [chest([ruby], 1)];
  assert.deepEqual(containerPreviewItems('container:0', boxes, { owned: true, today: 9 }), [ruby]);
  assert.equal(containerPreviewItems('container:0', boxes, { owned: false, today: 9 }), null, 'stockedDate 1 is stale for a stranger');
  const stocked = [chest([ruby], 9)];
  assert.deepEqual(containerPreviewItems('container:0', stocked, { owned: false, today: 9 }), [ruby]);
  assert.equal(containerPreviewItems('container:0', stocked, { owned: false, today: 10 }), null, 'a new day replaces the list on the press, so the plaque does not show yesterday\'s');
  assert.equal(containerPreviewItems('container:0', [{ items: null, stockedDate: 9 }], { owned: false, today: 9 }), null);
  assert.equal(containerPreviewItems('container:0', stocked, { shut: true, today: 9 }), null, 'somebody else\'s home');
  assert.equal(containerPreviewItems('container:0', stocked, { hall: true, owned: false, today: 9 }), null, 'a hall\'s cupboard opens the Stores chest');
  assert.equal(containerPreviewItems('door:1', stocked, { owned: true }), null);
  assert.equal(containerPreviewItems('container:3', stocked, { owned: true }), null, 'no such container');
});

test('CONTAINER-PEEK: a placed chest lists what it holds, and a chair is never asked', () => {
  let asked = 0;
  const bag = {
    pieceOf: (id) => (id === 'bin' ? { storage: true } : { storage: false }),
    itemsOf: (id) => { asked += 1; return id === 'bin' ? [ruby] : []; },
  };
  assert.equal(decorPreviewItems('decor:chair', bag), null);
  assert.equal(asked, 0, 'a chair is not a container');
  assert.deepEqual(decorPreviewItems('decor:bin', bag), [ruby]);
  assert.equal(asked, 1);
  assert.equal(decorPreviewItems('decor:bin', { ...bag, shut: true }), null);
  assert.equal(asked, 1, 'somebody else\'s chest is not read');
});

test('CONTAINER-PEEK: the interior reader answers one family and leaves the piles alone', () => {
  const bag = { containers: [chest([ruby], 9)], owned: false, today: 9, pieceOf: () => null, itemsOf: () => [] };
  assert.deepEqual(interiorHeldPreview('container:0', bag), [ruby]);
  assert.equal(interiorHeldPreview('loot:0', bag), null);
  assert.equal(interiorHeldPreview('droppedLoot:1', bag), null);
});

test('CONTAINER-PEEK: the interior host hands the reader to the plaque', () => {
  const wm = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(wm, /const interiorPeek = createInteriorPeek\(\{/);
  assert.match(wm, /\n\s*interiorPeek,\n/);
});

test('CONTAINER-PEEK createInteriorPeek: built once, it reads the room\'s word only over a cupboard or a placed chest, and answers what interiorHeldPreview answers (mutants: the getters read for every key, a getter read once at build)', () => {
  const read = [];
  const word = (name, value) => () => { read.push(name); return value; };
  let boxes = [chest([ruby], 9)];
  const peek = createInteriorPeek({
    containers: () => { read.push('containers'); return boxes; },
    decor: word('decor', { pieceOf: (id) => ({ storage: id === 'bin' }), itemsOf: () => [ruby] }),
    owned: word('owned', false), shut: word('shut', false), hall: word('hall', false), today: word('today', 9),
  });
  assert.deepEqual(read, [], 'nothing is read to build it');
  assert.equal(peek('loot:0'), null);
  assert.equal(peek('corpse:4'), null);
  assert.equal(peek(null), null);
  assert.deepEqual(read, [], 'a pile, a body and nothing at all never ask the room');
  assert.deepEqual(peek('container:0'), [ruby]);
  assert.deepEqual(peek('decor:bin'), [ruby]);
  boxes = [chest([], 9)];
  assert.deepEqual(peek('container:0'), [], 'each glance reads the room as it is now');
  assert.ok(read.includes('owned') && read.includes('shut') && read.includes('today'));
});

test('OUTDOOR-LOOT CONTAINER-PEEK (DESIGN 6.4): an UNBORN cupboard - one the room has not spoken about and this client has not opened - is a name, whatever list it holds (a roll that is no one\'s word); a born one, the player\'s own storage and a placed chest list as they did', () => {
  const stocked = [chest([ruby], 9)];
  assert.equal(containerPreviewItems('container:0', stocked, { today: 9, unborn: true }), null);
  assert.deepEqual(containerPreviewItems('container:0', stocked, { today: 9, unborn: false }), [ruby]);
  assert.deepEqual(containerPreviewItems('container:0', stocked, { today: 9 }), [ruby], 'no word on it: as it was');
  let unborn = true;
  const asked = [];
  const mount = (owned) => createInteriorPeek({
    containers: () => stocked, decor: () => ({ pieceOf: () => ({ storage: true }), itemsOf: () => [ruby] }),
    owned: () => owned, shut: () => false, hall: () => false, today: () => 9, unborn: (key) => { asked.push(key); return unborn; },
  });
  const peek = mount(false);
  assert.equal(peek('container:0'), null, 'unborn: the name alone');
  unborn = false;
  assert.deepEqual(peek('container:0'), [ruby], 'born: the room\'s one list');
  unborn = true;
  assert.deepEqual(mount(true)('container:0'), [ruby], 'the player\'s own storage is never the room\'s to be unborn');
  assert.deepEqual(peek('decor:bin'), [ruby], 'a placed chest is not a cupboard');
  assert.equal(peek('loot:0'), null);
  assert.ok(asked.every((k) => k.startsWith('container:') || k.startsWith('decor:')), 'a pile and a body never ask');
});
