// COST-2 part two (2026-10-25; bible/11-Multiplayer/Scale-Arc.md COST-2 part two): THE TREE MOVES - its pure law
// (src/net/cellTree.js). The directory seeds the tree at a level, then moves it one node at a time: a crowded leaf
// splits into its four children, four quiet sibling leaves merge into their parent, each after its count has held for a
// dwell. Every tree a move makes lists only nodes the walk reaches, and its leaves still hold every fine cell once.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  L0_TREE, seedTree, isL0Tree, isReached, isLeaf, splitTree, mergeTree, treeAfter, cellMoveDue, cellSeedOf, leafOf, readTree,
  childNodes, parentNode, nodeAt, nodeLevelOf,
} from '../../src/net/cellTree.js';

const LAW = { splitAt: 150, splitDwellMs: 60_000, mergeAt: 40, mergeDwellMs: 600_000 };
const T0 = 1_800_000_000_000;
const NODE = 'cell:2:6,2';   // world:24,8 to world:27,11 - map pixels [384, 448) x [128, 192)
const KIDS = childNodes(NODE);

test('COST-2 part two THE SEED: every node above its level split, every node at it whole, nothing listed - L0 is L0_TREE; the setting read as off or a level (mutants: the seed\'s base; L0 seeded anew; a level read loose)', () => {
  const t = seedTree(2);
  assert.deepEqual(t, { v: 1, base: 2, split: [], joined: [] });
  assert.equal(leafOf(t, 'world:25,9'), NODE);
  assert.equal(leafOf(seedTree(4), 'world:25,9'), 'cell:4:1,0');
  assert.equal(seedTree(0), L0_TREE);
  for (const bad of [5, -1, 1.5, '2', null]) assert.equal(seedTree(bad), null, String(bad));
  assert.ok(isL0Tree(L0_TREE));
  assert.ok(!isL0Tree(t));
  assert.ok(!isL0Tree({ v: 1, base: 0, split: [], joined: ['cell:1:12,4'] }), 'a base-0 tree that merged is no longer L0');
  assert.deepEqual([undefined, null, '', 'off', '1', '2', '3', '4'].map(cellSeedOf), [0, 0, 0, 0, 1, 2, 3, 4]);
  for (const bad of ['0', '5', 'on', ' 2', '2 ', 'two', 2]) assert.equal(cellSeedOf(bad), bad === 2 ? 2 : undefined, String(bad));
});

test('COST-2 part two A SPLIT AND A MERGE: a leaf above L0 splits into four leaves, four sibling leaves merge back into their parent, above the base and below it; each refuses what is no such move; and a tree back where it began lists nothing (mutants: a split\'s children left split; a merge\'s children left listed; the base\'s side; a non-leaf split; a merge over a split child)', () => {
  const t0 = seedTree(2);
  assert.ok(isLeaf(t0, NODE) && isReached(t0, NODE));
  assert.ok(isReached(t0, 'cell:4:1,0') && !isLeaf(t0, 'cell:4:1,0'));
  assert.ok(!isReached(t0, 'cell:1:12,4') && !isReached(t0, 'world:25,9'), 'below a leaf nothing is reached');
  const t1 = splitTree(t0, NODE);
  assert.deepEqual(t1, { v: 1, base: 2, split: [NODE], joined: [] });
  assert.equal(leafOf(t1, 'world:25,9'), 'cell:1:12,4');
  assert.ok(KIDS.every((k) => isLeaf(t1, k)), 'its four children leaves');
  assert.equal(leafOf(t1, 'world:28,9'), 'cell:2:7,2', 'its neighbour untouched');
  assert.equal(splitTree(t1, NODE), null, 'a split node splits no more');
  assert.equal(splitTree(t1, 'cell:4:1,0'), null, 'nor one the walk passes through');
  assert.equal(splitTree(t0, 'cell:1:12,4'), null, 'nor one the walk never reaches');
  const t2 = splitTree(t1, 'cell:1:12,4');
  assert.equal(leafOf(t2, 'world:25,9'), 'world:25,9', 'split down to L0: the fine cell its own node');
  assert.equal(splitTree(t2, 'world:25,9'), null, 'an L0 node never splits');
  assert.equal(mergeTree(t2, NODE), null, 'a merge over a child that is split');
  assert.equal(mergeTree(t2, 'world:25,9'), null, 'an L0 node has no children');
  assert.deepEqual(mergeTree(t2, 'cell:1:12,4'), t1);
  assert.deepEqual(mergeTree(t1, NODE), t0, 'merged back: nothing listed');
  assert.equal(mergeTree(t0, NODE), null, 'a leaf merges nothing');
  // above the base: a merge joins its parent, a split of it unjoins it
  const up = mergeTree(t0, 'cell:3:3,1');
  assert.deepEqual(up, { v: 1, base: 2, split: [], joined: ['cell:3:3,1'] });
  assert.equal(leafOf(up, 'world:25,9'), 'cell:3:3,1');
  assert.deepEqual(splitTree(up, 'cell:3:3,1'), t0);
  assert.equal(mergeTree(up, 'cell:4:1,0'), null, 'a merge whose siblings are not all leaves');
  // the top: four L3 nodes joined, then their L4 parent - its children no longer listed; split again, each L3 a leaf
  let top = t0;
  for (const l3 of childNodes('cell:4:1,0')) top = /** @type {any} */ (mergeTree(top, l3));
  top = /** @type {any} */ (mergeTree(top, 'cell:4:1,0'));
  assert.deepEqual(top, { v: 1, base: 2, split: [], joined: ['cell:4:1,0'] });
  const down = /** @type {any} */ (splitTree(top, 'cell:4:1,0'));
  assert.ok(childNodes('cell:4:1,0').every((k) => isLeaf(down, k)), 'a joined node split: its children above the base leaves, never split by default');
  assert.deepEqual(down.joined, childNodes('cell:4:1,0').sort());
  assert.deepEqual(treeAfter(t0, { kind: 'split', from: [NODE], to: KIDS }), t1);
  assert.deepEqual(treeAfter(t1, { kind: 'merge', from: KIDS, to: [NODE] }), t0);
  assert.equal(treeAfter(t0, { kind: 'merge', from: KIDS, to: [NODE] }), null);
});

test('COST-2 part two EVERY TREE THE MOVES MAKE IS ONE THE WALK READS WHOLE: over 400 moves at random from the seed, the tree reads back as itself, lists only nodes the walk reaches, and its leaves hold every fine cell of the region once (mutants: an unreached node left listed; a child left whole under a split; the lists unsorted)', () => {
  let seedv = 7;
  const rand = () => { seedv = (seedv * 1103515245 + 12345) % 2 ** 31; return seedv / 2 ** 31; };
  const cells = [];
  for (let cx = 16; cx < 48; cx++) for (let cy = 0; cy < 24; cy++) cells.push(`world:${cx},${cy}`);
  let t = seedTree(2);
  let moves = 0;
  for (let i = 0; i < 2000 && moves < 400; i++) {
    const c = cells[Math.floor(rand() * cells.length)];
    const leaf = /** @type {string} */ (leafOf(t, c));
    const next = rand() < 0.55 ? splitTree(t, leaf) : parentNode(leaf) && mergeTree(t, /** @type {string} */ (parentNode(leaf)));
    if (!next) continue;
    t = next;
    moves++;
    assert.deepEqual(readTree(JSON.parse(JSON.stringify(t))), t, 'read back as itself');
    for (const k of [...t.split, ...t.joined]) assert.ok(isReached(t, k), `${k} listed and reached`);
    assert.deepEqual([...t.split], [...t.split].sort());
  }
  assert.ok(moves >= 400, `${moves} moves made`);
  for (const c of cells) {
    const leaf = /** @type {string} */ (leafOf(t, c));
    assert.ok(isLeaf(t, leaf), `${c}'s node ${leaf} is a leaf`);
    const L = /** @type {number} */ (nodeLevelOf(leaf));
    const [cx, cy] = c.slice(6).split(',').map(Number);
    assert.equal(nodeAt(L, cx, cy), leaf, `${c} in ${leaf}`);
  }
});

test('COST-2 part two THE HYSTERESIS: a leaf past splitAt splits once its count has held for splitDwellMs, and its dwell starts again when the count falls back; four sibling leaves under mergeAt together merge after mergeDwellMs, a sibling unheard counting none; an L0 node, a split node and a cooled one never move; a split goes before a merge, the longest dwell first (mutants: the dwell unread; at the line taken as past it; the merge\'s sum per child; a cooled node moved; an L0 node split; the order)', () => {
  const t0 = seedTree(2);
  const ask = (tree, counts, dwell, now, cool = {}) => cellMoveDue(tree, new Map(Object.entries(counts)), dwell, cool, now, LAW);
  let r = ask(t0, { [NODE]: 151 }, { over: {}, under: {} }, T0);
  assert.equal(r.move, null);
  assert.deepEqual(r.dwell.over, { [NODE]: T0 });
  r = ask(t0, { [NODE]: 151 }, r.dwell, T0 + LAW.splitDwellMs - 1);
  assert.equal(r.move, null, 'not before its dwell');
  const held = ask(t0, { [NODE]: 151 }, r.dwell, T0 + LAW.splitDwellMs);
  assert.deepEqual(held.move, { kind: 'split', from: [NODE], to: KIDS });
  assert.equal(ask(t0, { [NODE]: 150 }, { over: {}, under: {} }, T0).dwell.over[NODE], undefined, 'at the line is not past it');
  const fell = ask(t0, { [NODE]: 120 }, r.dwell, T0 + 30_000);
  assert.deepEqual(fell.dwell.over, {}, 'fallen back: the dwell forgotten');
  assert.equal(ask(t0, { [NODE]: 151 }, fell.dwell, T0 + LAW.splitDwellMs).move, null, 'and begun again');
  assert.equal(ask(t0, { [NODE]: 151 }, r.dwell, T0 + LAW.splitDwellMs, { [NODE]: T0 + LAW.splitDwellMs + 1 }).move, null, 'cooled');
  assert.equal(ask(t0, { [NODE]: 151 }, r.dwell, T0 + LAW.splitDwellMs, { [NODE]: T0 + LAW.splitDwellMs }).move?.kind, 'split', 'cooled until then, and no longer');
  // a count that names no leaf - a split node's stale word, a node below a leaf, an L0 node split down to - never splits
  const t1 = splitTree(t0, NODE);
  assert.equal(ask(t1, { [NODE]: 999 }, { over: { [NODE]: T0 } , under: {} }, T0 + 10 * LAW.splitDwellMs).move, null);
  assert.equal(ask(t0, { 'cell:1:12,4': 999 }, { over: { 'cell:1:12,4': T0 }, under: {} }, T0 + 10 * LAW.splitDwellMs).move, null);
  const deep = splitTree(t1, 'cell:1:12,4');
  assert.equal(ask(deep, { 'world:25,9': 999 }, { over: { 'world:25,9': T0 }, under: {} }, T0 + 10 * LAW.splitDwellMs).move, null);
  // THE MERGE: four siblings' sum, a sibling unheard counting none
  const quiet = { [KIDS[0]]: 10, [KIDS[1]]: 10, [KIDS[2]]: 19 };
  let m = ask(t1, quiet, { over: {}, under: {} }, T0);
  assert.deepEqual(m.dwell.under, { [NODE]: T0 });
  assert.equal(ask(t1, quiet, m.dwell, T0 + LAW.mergeDwellMs - 1).move, null);
  assert.deepEqual(ask(t1, quiet, m.dwell, T0 + LAW.mergeDwellMs).move, { kind: 'merge', from: KIDS, to: [NODE] });
  assert.equal(ask(t1, { ...quiet, [KIDS[3]]: 1 }, { over: {}, under: {} }, T0).dwell.under[NODE], undefined, 'forty together is not under forty');
  assert.equal(ask(t1, quiet, m.dwell, T0 + LAW.mergeDwellMs, { [KIDS[3]]: Infinity }).move, null, 'a cooled sibling holds its parent');
  const under = ask(deep, { ...quiet, ...Object.fromEntries(childNodes('cell:1:12,4').map((k) => [k, 0])) }, { over: {}, under: { [NODE]: T0 } }, T0 + LAW.mergeDwellMs);
  assert.equal(under.move, null, 'a sibling split further holds its parent');
  assert.deepEqual(Object.keys(under.dwell.under), ['cell:1:12,4'], 'and its own children begin their dwell');
  // seeded and emptied: four L2 leaves merge into their L3 parent above the base
  const four = Object.fromEntries(childNodes('cell:3:3,1').map((k) => [k, 0]));
  m = ask(t0, four, { over: {}, under: {} }, T0);
  assert.deepEqual(ask(t0, four, m.dwell, T0 + LAW.mergeDwellMs).move, { kind: 'merge', from: childNodes('cell:3:3,1'), to: ['cell:3:3,1'] });
  // ONE MOVE AT A TIME: a split before a merge, the longest dwell first
  const both = ask(t1, { ...quiet, 'cell:2:9,2': 200, 'cell:2:9,3': 200 }, { over: { 'cell:2:9,3': T0 - 5, 'cell:2:9,2': T0 }, under: { [NODE]: T0 - LAW.mergeDwellMs } }, T0 + LAW.splitDwellMs);
  assert.deepEqual(both.move, { kind: 'split', from: ['cell:2:9,3'], to: childNodes('cell:2:9,3') });
});
