// COST-2 (2026-10-24; bible/11-Multiplayer/Scale-Arc.md COST-2): THE CELL TREE (src/net/cellTree.js) - a quadtree over
// the open country's 16-pixel grid. L0 is today's cell under today's `world:` key; a coarse node is `cell:<L>:<nx>,<ny>`;
// the tree is the set of split nodes around a base level, and a fine cell's node is the walk down from its L4 node while
// the node it stands in is split. L0_TREE is today's partition exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CELL_LEVEL_MAX, nodeSize, cellNodeKey, parseNode, isNodeRoom, isCoarseNode, nodeLevelOf, nodeAt, nodeBounds, nodeHolds, parentNode,
  childNodes, L0_TREE, TREE_NODES_MAX, readTree, isSplit, leafOf, partitionRows,
} from '../../src/net/cellTree.js';
import { WORLD_CELL, worldRoom, roomOf, isCellRoom } from '../../src/net/wire.js';

test('COST-2 the nodes: five levels over the 16-pixel grid - L0 the fine cell under its own `world:` key, L1-L4 `cell:<L>:<nx>,<ny>` at 32 to 256 pixels; a key read back, its level, its square, its parent and its four children, the node of a fine cell at any level (negative cells too); a coarse key is a room a page may name but the Worker refuses, never a cell (mutants: L0 keyed anew; a level\'s size; floor for negatives; a child out of place; the parent\'s rounding)', () => {
  assert.equal(CELL_LEVEL_MAX, 4);
  assert.deepEqual([0, 1, 2, 3, 4].map(nodeSize), [16, 32, 64, 128, 256]);
  assert.equal(nodeSize(0), WORLD_CELL);
  assert.equal(cellNodeKey(0, 25, 9), 'world:25,9');
  assert.equal(cellNodeKey(2, 6, 2), 'cell:2:6,2');
  assert.deepEqual(parseNode('world:25,9'), { L: 0, nx: 25, ny: 9 });
  assert.deepEqual(parseNode('cell:3:-1,2'), { L: 3, nx: -1, ny: 2 });
  for (const no of ['cell:0:1,1', 'cell:5:1,1', 'cell:2:1', 'cell:2:1,1,1', 'world:1', 'chat:world', null, 7]) assert.equal(parseNode(no), null, String(no));
  assert.equal(isNodeRoom('world:3,4'), true); assert.equal(isCoarseNode('world:3,4'), false);
  assert.equal(isCoarseNode('cell:1:3,4'), true); assert.equal(isCellRoom('cell:1:3,4'), false, 'a node is no cell: no page law reads it as one');
  assert.equal(roomOf('/room/cell:1:3,4'), 'cell:1:3,4', 'a page may ask for it - so the Worker refuses it by name (cellNodes.js)');
  assert.equal(nodeLevelOf('cell:4:0,0'), 4); assert.equal(nodeLevelOf('world:0,0'), 0); assert.equal(nodeLevelOf('town:x'), null);
  // a pixel's fine cell and its node at every level agree with worldRoom
  for (const [px, py] of [[402, 151], [0, 0], [999, 499], [-1, -1], [-17, 40]]) {
    const fine = worldRoom(px, py);
    const [cx, cy] = fine.slice(6).split(',').map(Number);
    assert.equal(nodeAt(0, cx, cy), fine);
    for (let L = 0; L <= CELL_LEVEL_MAX; L++) assert.equal(nodeHolds(nodeAt(L, cx, cy), px, py), true, `${px},${py} in its L${L} node`);
  }
  assert.equal(nodeAt(2, -1, -1), 'cell:2:-1,-1', 'floored, never truncated, west of the Bay');
  assert.deepEqual(nodeBounds('cell:2:6,2'), { x0: 384, y0: 128, x1: 448, y1: 192 });
  assert.deepEqual(nodeBounds('world:25,9'), { x0: 400, y0: 144, x1: 416, y1: 160 });
  assert.equal(nodeHolds('cell:2:6,2', 448, 150), false, 'the square half-open');
  assert.equal(parentNode('world:25,9'), 'cell:1:12,4');
  assert.equal(parentNode('cell:1:-1,3'), 'cell:2:-1,1');
  assert.equal(parentNode('cell:4:1,0'), null);
  assert.deepEqual(childNodes('cell:1:12,4'), ['world:24,8', 'world:25,8', 'world:24,9', 'world:25,9']);
  assert.deepEqual(childNodes('cell:3:1,0'), ['cell:2:2,0', 'cell:2:3,0', 'cell:2:2,1', 'cell:2:3,1']);
  assert.deepEqual(childNodes('world:1,1'), []);
  for (const k of ['cell:2:6,2', 'cell:1:-3,7', 'cell:4:0,1']) for (const c of childNodes(k)) assert.equal(parentNode(c), k);
});

test('COST-2 the tree and the walk: L0_TREE leaves every fine cell its own node - today\'s partition, for every cell of the map and past it; a node above the base is split unless joined, at or below it whole unless split; the walk goes down from L4 while split; a tree read back strictly (its version, its base, each listed node coarse and on its list\'s side of the base, each once, bounded) (mutants: the base\'s side; the walk\'s start; the joined set unread; a tree read loose)', () => {
  assert.deepEqual(L0_TREE, { v: 1, base: 0, split: [], joined: [] });
  for (let cx = -63; cx <= 63; cx += 7) for (let cy = -32; cy <= 32; cy += 5) assert.equal(leafOf(L0_TREE, `world:${cx},${cy}`), `world:${cx},${cy}`);
  assert.equal(leafOf(L0_TREE, 'town:x'), null);
  // seeded at L2: a cell's node its 64-pixel one; a town split back to L1, a quiet corner joined up to L3
  const seed = readTree({ v: 1, base: 2, split: ['cell:2:6,2'], joined: ['cell:3:0,0'] });
  assert.ok(seed);
  assert.equal(leafOf(seed, 'world:25,9'), 'cell:1:12,4', 'the split town: down to L1');
  assert.equal(leafOf(seed, 'world:28,9'), 'cell:2:7,2', 'its neighbour stays at the base');
  assert.equal(leafOf(seed, 'world:3,3'), 'cell:3:0,0', 'the joined corner is one L3 node');
  assert.equal(isSplit(seed, 'cell:4:0,0'), true, 'above the base: split');
  assert.equal(isSplit(seed, 'cell:3:0,0'), false, 'unless joined');
  assert.equal(isSplit(seed, 'cell:2:6,2'), true, 'at the base: whole unless split');
  assert.equal(isSplit(seed, 'cell:2:7,2'), false);
  assert.equal(isSplit(seed, 'world:25,9'), false, 'an L0 node never');
  const top = readTree({ v: 1, base: 2, joined: ['cell:4:0,0'] });
  assert.equal(leafOf(top, 'world:3,3'), 'cell:4:0,0', 'the walk starts at L4: a joined top node is one node');
  // the reader
  for (const bad of [null, 7, {}, { v: 2, base: 0 }, { v: 1, base: 5 }, { v: 1, base: -1 }, { v: 1, base: 1.5 },
    { v: 1, base: 2, split: ['cell:3:0,0'] }, { v: 1, base: 2, joined: ['cell:2:0,0'] }, { v: 1, base: 2, split: ['world:1,1'] },
    { v: 1, base: 2, split: ['cell:2:1,1', 'cell:2:1,1'] }, { v: 1, base: 2, split: 'cell:2:1,1' },
    { v: 1, base: 4, split: Array.from({ length: TREE_NODES_MAX + 1 }, (_, i) => `cell:1:${i % 999},${Math.floor(i / 999)}`) }]) assert.equal(readTree(bad), null, JSON.stringify(bad)?.slice(0, 80));
  assert.deepEqual(readTree({ v: 1, base: 0 }), L0_TREE, 'lists default empty');
  assert.ok(Object.isFrozen(readTree({ v: 1, base: 0 })), 'read back frozen');
});

test('COST-2 the handover\'s partition: each row to the target node that holds its pixel, the rest apart (mutants: the first target taken for every row; the rest dropped silently)', () => {
  const kids = childNodes('cell:1:12,4');
  const rows = [{ p: [385, 129] }, { p: [400, 128] }, { p: [399, 144] }, { p: [415, 159] }, { p: null }, { p: [500, 500] }];
  const { by, rest } = partitionRows(rows, (r) => r.p, kids);
  assert.deepEqual(kids.map((k) => by.get(k).map((r) => r.p)), [[[385, 129]], [[400, 128]], [[399, 144]], [[415, 159]]]);
  assert.deepEqual(rest.map((r) => r.p), [null, [500, 500]]);
});
