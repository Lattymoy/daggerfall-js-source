// @ts-check
// THE CELL TREE: a quadtree over the open country's fixed grid of 16-pixel cells (bible/11-Multiplayer/Scale-Arc.md,
// COST-2). The page keeps computing its own 16-pixel cell (wire.js worldRoom, cellHaloFor) exactly as before. The Worker
// maps that FINE key to the NODE that holds it, and the node is the Durable Object a cell's sockets share. The object is
// named after the node, but each socket keeps the fine key it joined with (the same pattern as wire.js layerName for
// layers), so every law that reads a socket's cell - its square, a grant's `q`, a ledger row's pixel - still reads the
// fine key, and only which object the socket shares changes.
//
//   L0  WORLD_CELL (16) pixels - the fine cell, keyed `world:<cx>,<cy>` as it always was, so its stored rows stay valid
//   L1  32, L2 64, L3 128, L4 256 pixels - keyed `cell:<L>:<nx>,<ny>`, a name no page may ask for (the Worker refuses it)
//
// A tree is stored as the nodes that differ from a BASE level: a node above the base is split unless the tree lists it
// as JOINED; a node at or below the base (and above L0) is whole unless the tree lists it as SPLIT. A fine cell's node is
// found by walking down from its L4 node while the node it stands in is split. L0_TREE (base 0, nothing listed) splits
// every node down to L0, so every fine key is its own node.
//
// The tree moves one node at a time: a crowded leaf splits into its four children, four quiet sibling leaves merge into
// their parent (splitTree, mergeTree, cellMoveDue). Every tree a move makes lists only nodes the walk reaches, so a tree
// stays as long as a town's worth of nodes, never the whole map's.
//
// Pure: the relay, the page and the account service bundle it.
import { WORLD_CELL, cellOfRoom } from './wire.js';

/**
 * A partition of the open country into nodes.
 * @typedef {object} CellTree
 * @property {1} v - the shape's version
 * @property {number} base - the level whose nodes are whole unless listed in `split`
 * @property {readonly string[]} split - nodes at or below the base that are split
 * @property {readonly string[]} joined - nodes above the base that are whole
 */
/**
 * A node key read back.
 * @typedef {object} ParsedNode
 * @property {number} L - its level, 0 to CELL_LEVEL_MAX
 * @property {number} nx - its column at that level
 * @property {number} ny - its row at that level
 */
/**
 * One move of the tree: the nodes whose rows are handed over (`from`) and the nodes that take them (`to`).
 * @typedef {object} TreeMove
 * @property {'split' | 'merge'} kind
 * @property {string[]} from
 * @property {string[]} to
 */
/**
 * When each node's condition began: `over` for a node past the split line, `under` for a parent whose four children
 * are together under the merge line.
 * @typedef {object} MoveDwell
 * @property {Record<string, number>} over
 * @property {Record<string, number>} under
 */
/**
 * The thresholds a move is judged by (the relay's vars, server/src/cellMoves.js cellLawOf).
 * @typedef {object} MoveLaw
 * @property {number} splitAt - named sockets a node must stay over to split
 * @property {number} splitDwellMs - how long it must stay over
 * @property {number} mergeAt - named sockets four siblings must stay under, together, to merge
 * @property {number} mergeDwellMs - how long they must stay under
 */

/** The coarsest level - a 256-pixel node (the Bay, about 1,000 x 500 pixels, is some 4 x 2 of them). */
export const CELL_LEVEL_MAX = 4;
/** A level-`level` node's side, map pixels. @param {number} level */
export const nodeSize = (level) => WORLD_CELL * 2 ** level;
const NODE_RE = /^cell:([1-4]):(-?\d{1,3}),(-?\d{1,3})$/;
/** The level-`level` node (`nx`, `ny`)'s key - an L0 node is the fine cell's own `world:` key. */
export const cellNodeKey = (/** @type {number} */ level, /** @type {number} */ nx, /** @type {number} */ ny) => (level === 0 ? `world:${nx},${ny}` : `cell:${level}:${nx},${ny}`);
/** A node key read back, or null for a key that is no node. @param {unknown} key @returns {ParsedNode | null} */
export function parseNode(key) {
  const cell = cellOfRoom(key);
  if (cell) return { L: 0, nx: cell[0], ny: cell[1] };
  const match = NODE_RE.exec(String(key ?? ''));
  return match ? { L: Number(match[1]), nx: Number(match[2]), ny: Number(match[3]) } : null;
}
/** Is `key` a node of the tree (a fine cell's key included)? @param {unknown} key */
export const isNodeRoom = (key) => parseNode(key) != null;
/** Is `key` a COARSE node (L1 and up) - a name only the Worker gives an object, never a page's room? @param {unknown} key */
export const isCoarseNode = (key) => NODE_RE.test(String(key ?? ''));
/** A node's level, or null for a key that is no node. @param {unknown} key */
export const nodeLevelOf = (key) => parseNode(key)?.L ?? null;
/** The level-`level` node holding fine cell (`cx`, `cy`). @param {number} level @param {number} cx @param {number} cy */
export const nodeAt = (level, cx, cy) => cellNodeKey(level, Math.floor(cx / 2 ** level), Math.floor(cy / 2 ** level));
/** A node's square, map pixels, `[x0, x1) x [y0, y1)`, or null. @param {unknown} key */
export function nodeBounds(key) {
  const parsed = parseNode(key);
  if (!parsed) return null;
  const size = nodeSize(parsed.L);
  return { x0: parsed.nx * size, y0: parsed.ny * size, x1: (parsed.nx + 1) * size, y1: (parsed.ny + 1) * size };
}
/** Does node `key` hold map pixel (`px`, `py`)? @param {unknown} key @param {number} px @param {number} py */
export const nodeHolds = (key, px, py) => {
  const bounds = nodeBounds(key);
  return !!bounds && Number.isFinite(px) && Number.isFinite(py) && px >= bounds.x0 && px < bounds.x1 && py >= bounds.y0 && py < bounds.y1;
};
/** Does node `node` hold fine cell `cellKey`? An L0 node holds its own cell alone. @param {unknown} node @param {unknown} cellKey */
export function nodeHoldsCell(node, cellKey) {
  const parsed = parseNode(node),
    cell = cellOfRoom(cellKey);
  return !!parsed && !!cell && nodeAt(parsed.L, cell[0], cell[1]) === node;
}
/**
 * THE ONE LAW OF WHAT A SOCKET COVERS, both ends' (the page and the relay read it alike). A socket's COVER is its coarse
 * node's key or, with none, its own room's key. A cell-scoped word, a grant's `q` or a park's anchor stands in that
 * socket's room when its cell is covered: the cover itself, or a fine cell its coarse node holds. Under L0 every cover
 * is a fine cell, which covers itself alone - so nothing changes until the tree is coarse.
 * @param {unknown} cover @param {unknown} key
 */
export const coversCell = (cover, key) => typeof key === 'string' && (key === cover || (isCoarseNode(cover) && nodeHoldsCell(cover, key)));
/** A node's square in FINE CELLS, `[x0, y0, x1, y1]` half-open - what a welcome tells a page its socket covers. @param {unknown} key */
export function cellsOfNode(key) {
  const parsed = parseNode(key);
  if (!parsed) return null;
  const size = 2 ** parsed.L;
  return [parsed.nx * size, parsed.ny * size, (parsed.nx + 1) * size, (parsed.ny + 1) * size];
}
/** The node a welcome's `cells` name - an aligned square of 1 to 16 cells a side - or null for anything else. @param {unknown} cells */
export function nodeOfCells(cells) {
  if (!Array.isArray(cells) || cells.length !== 4 || !cells.every((value) => Number.isInteger(value))) return null;
  const [x0, y0, x1, y1] = /** @type {number[]} */ (cells);
  const size = x1 - x0,
    level = Math.log2(size);
  if (y1 - y0 !== size || !Number.isInteger(level) || level < 0 || level > CELL_LEVEL_MAX || x0 % size !== 0 || y0 % size !== 0) return null;
  const key = cellNodeKey(level, x0 / size, y0 / size);
  return parseNode(key) ? key : null;
}
/** A node's parent (null at the top). @param {unknown} key */
export function parentNode(key) {
  const parsed = parseNode(key);
  return parsed && parsed.L < CELL_LEVEL_MAX ? cellNodeKey(parsed.L + 1, Math.floor(parsed.nx / 2), Math.floor(parsed.ny / 2)) : null;
}
/** A node's four children, row by row (none at L0). @param {unknown} key @returns {string[]} */
export function childNodes(key) {
  const parsed = parseNode(key);
  if (!parsed || parsed.L === 0) return [];
  return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => cellNodeKey(parsed.L - 1, parsed.nx * 2 + dx, parsed.ny * 2 + dy));
}

/** Every node split down to L0, so a fine key is its own node. */
export const L0_TREE = Object.freeze({ v: 1, base: 0, split: Object.freeze([]), joined: Object.freeze([]) });
/** The most nodes a tree lists split or joined. Every Worker isolate reads the tree, so it stays small: a town's nodes,
 *  never the map's. */
export const TREE_NODES_MAX = 4096;
/** Each tree's lists as sets, made once per tree object (a tree is frozen, so its sets never go stale). */
const listSets = new WeakMap();
/** A tree's lists as sets. @param {{split: readonly string[], joined: readonly string[]}} tree */
const setsOf = (tree) => {
  let members = listSets.get(tree);
  if (!members) {
    members = { split: new Set(tree.split), joined: new Set(tree.joined) };
    listSets.set(tree, members);
  }
  return members;
};

/**
 * A tree read off the wire or storage - a fresh, frozen tree whose every listed node is a coarse node on its list's side
 * of the base (split: at or below the base, joined: above it), each once - or null for anything else.
 * @param {unknown} raw @returns {CellTree | null}
 */
export function readTree(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = /** @type {{v?: unknown, base?: unknown, split?: unknown, joined?: unknown}} */ (raw);
  if (candidate.v !== 1 || !Number.isInteger(candidate.base) || /** @type {number} */ (candidate.base) < 0 || /** @type {number} */ (candidate.base) > CELL_LEVEL_MAX) return null;
  const base = /** @type {number} */ (candidate.base);
  const list = (/** @type {unknown} */ listed, /** @type {(level: number) => boolean} */ side) => {
    if (!Array.isArray(listed) || listed.length > TREE_NODES_MAX) return null;
    const nodes = new Set();
    for (const key of listed) {
      const level = isCoarseNode(key) ? nodeLevelOf(key) : null;
      if (level == null || !side(level) || nodes.has(key)) return null;
      nodes.add(key);
    }
    return Object.freeze([...nodes]);
  };
  const split = list(candidate.split ?? [], (level) => level <= base),
    joined = list(candidate.joined ?? [], (level) => level > base);
  return split && joined ? Object.freeze({ v: 1, base, split, joined }) : null;
}

/** Is node `key` split in `tree`? An L0 node never is. @param {{base: number, split: readonly string[], joined: readonly string[]}} tree @param {string} key */
export function isSplit(tree, key) {
  const level = nodeLevelOf(key);
  if (!level) return false;
  const members = setsOf(tree);
  return level > tree.base ? !members.joined.has(key) : members.split.has(key);
}

/**
 * THE WALK: the node that holds fine key `fineKey` in `tree` - down from its L4 node while the node it stands in is
 * split - or null for a key that is no fine cell. Under L0_TREE it is the fine key itself.
 * @param {{base: number, split: readonly string[], joined: readonly string[]}} tree @param {unknown} fineKey
 */
export function leafOf(tree, fineKey) {
  const cell = cellOfRoom(fineKey);
  if (!cell) return null;
  let level = CELL_LEVEL_MAX;
  let node = nodeAt(level, cell[0], cell[1]);
  while (level > 0 && isSplit(tree, node)) {
    level--;
    node = nodeAt(level, cell[0], cell[1]);
  }
  return node;
}

/**
 * THE HANDOVER'S PARTITION: each row given to the node of `targets` that holds its pixel (`pixelOf`: `[px, py]` or
 * null), the rows with no pixel - or none any target holds - apart (`rest`). Pure: the caller decides what the rest is.
 * @template T
 * @param {Iterable<T>} rows @param {(row: T) => ([number, number] | null)} pixelOf @param {string[]} targets
 * @returns {{ by: Map<string, T[]>, rest: T[] }}
 */
export function partitionRows(rows, pixelOf, targets) {
  const by = new Map(targets.map((target) => [target, /** @type {T[]} */ ([])]));
  const rest = /** @type {T[]} */ ([]);
  for (const row of rows) {
    const pixel = pixelOf(row);
    const target = pixel ? targets.find((key) => nodeHolds(key, pixel[0], pixel[1])) : undefined;
    if (target) /** @type {T[]} */ (by.get(target)).push(row);
    else rest.push(row);
  }
  return { by, rest };
}

// ── THE TREE MOVES ──────────────────────────────────────────────────────────────────────────────────────────────

/** The tree seeded at level `level` (0 to CELL_LEVEL_MAX): every node above it split, every node at it whole, nothing
 *  listed. L0 is L0_TREE. Null for any other `level`. @param {unknown} level @returns {CellTree | null} */
export function seedTree(level) {
  if (!Number.isInteger(level) || /** @type {number} */ (level) < 0 || /** @type {number} */ (level) > CELL_LEVEL_MAX) return null;
  return level === 0 ? L0_TREE : Object.freeze({ v: 1, base: /** @type {number} */ (level), split: Object.freeze([]), joined: Object.freeze([]) });
}
/** Is `tree` every node split down to L0? A base-0 tree can list no split node, so its joined list is all it merged.
 *  @param {{base: number, joined: readonly string[]}} tree */
export const isL0Tree = (tree) => tree.base === 0 && tree.joined.length === 0;
/** Does the walk reach node `key` in `tree` - is every node above it split? @param {any} tree @param {string} key */
export function isReached(tree, key) {
  if (!isNodeRoom(key)) return false;
  for (let ancestor = parentNode(key); ancestor; ancestor = parentNode(ancestor)) if (!isSplit(tree, ancestor)) return false;
  return true;
}
/** Is node `key` a LEAF of `tree` - the object its fine cells' sockets share: reached, and not split itself? @param {any} tree @param {string} key */
export const isLeaf = (tree, key) => isReached(tree, key) && !isSplit(tree, key);

/** `tree` with each node of `whole` made whole, each of `cut` split and each of `drop` unlisted - or null when a list
 *  would pass TREE_NODES_MAX. @param {any} tree @param {{ whole?: string[], cut?: string[], drop?: string[] }} change */
function changed(tree, { whole = [], cut = [], drop = [] }) {
  const members = setsOf(tree),
    split = new Set(members.split),
    joined = new Set(members.joined);
  for (const key of drop) {
    split.delete(key);
    joined.delete(key);
  }
  for (const key of whole) {
    if (/** @type {number} */ (nodeLevelOf(key)) > tree.base) joined.add(key);
    else split.delete(key);
  }
  for (const key of cut) {
    if (/** @type {number} */ (nodeLevelOf(key)) > tree.base) joined.delete(key);
    else split.add(key);
  }
  if (split.size > TREE_NODES_MAX || joined.size > TREE_NODES_MAX) return null;
  return Object.freeze({ v: 1, base: tree.base, split: Object.freeze([...split].sort()), joined: Object.freeze([...joined].sort()) });
}
/** THE SPLIT: `tree` with leaf `key` (above L0) split into its four children, each a leaf - or null when `key` is no
 *  such leaf. @param {any} tree @param {string} key */
export function splitTree(tree, key) {
  if (!isLeaf(tree, key) || !nodeLevelOf(key)) return null;
  return changed(tree, { cut: [key], whole: childNodes(key) });
}
/** THE MERGE: `tree` with the split node `parent`, whose four children are leaves, made a leaf itself and its children
 *  no longer listed - or null when it is no such node. @param {any} tree @param {string} parent */
export function mergeTree(tree, parent) {
  const children = childNodes(parent);
  if (!children.length || !isReached(tree, parent) || !isSplit(tree, parent) || !children.every((key) => isLeaf(tree, key))) return null;
  return changed(tree, { drop: children, whole: [parent] });
}
/** The tree a move leaves: a split's of its one departing node, a merge's of its one receiving node.
 *  @param {any} tree @param {{kind: string, from: string[], to: string[]}} move */
export const treeAfter = (tree, move) => (move.kind === 'split' ? splitTree(tree, move.from[0]) : move.kind === 'merge' ? mergeTree(tree, move.to[0]) : null);

/**
 * THE TREE'S HYSTERESIS (pure): the move due at `now`, or null, and the dwell to carry to the next ask.
 * - A SPLIT: a leaf above L0 whose count stays past `splitAt` for `splitDwellMs` splits into its four children.
 * - A MERGE: four sibling leaves whose players together stay under `mergeAt` for `mergeDwellMs` merge into their parent.
 * `counts` maps a leaf to its players now; a node with no fresh count counts none, so a node its players left merges.
 * `cool` maps a node to the time before which no move touches it - one whose last move its rows blocked. One move at a
 * time: a split first, since a crowd is the cost that grows, and the longest dwell first among each.
 * @param {any} tree @param {Map<string, number>} counts @param {MoveDwell} dwell @param {Record<string, number>} cool
 * @param {number} now @param {MoveLaw} law
 * @returns {{ move: TreeMove | null, dwell: MoveDwell }}
 */
export function cellMoveDue(tree, counts, dwell, cool, now, law) {
  const movable = (/** @type {string} */ key) => !(now < (cool[key] ?? -Infinity));
  const playersIn = (/** @type {string} */ key) => counts.get(key) ?? 0;
  const over = /** @type {Record<string, number>} */ ({}),
    under = /** @type {Record<string, number>} */ ({});
  const splits = [],
    merges = [];
  for (const [key, players] of counts) {
    if (!(players > law.splitAt) || !nodeLevelOf(key) || !isLeaf(tree, key) || !movable(key)) continue;
    over[key] = dwell.over[key] ?? now;
    if (now - over[key] >= law.splitDwellMs) splits.push(key);
  }
  const parents = new Set([...counts.keys()].map(parentNode).filter((parent) => parent != null));
  for (const parent of /** @type {Set<string>} */ (parents)) {
    const children = childNodes(parent);
    if (!isReached(tree, parent) || !isSplit(tree, parent) || !children.every((key) => isLeaf(tree, key) && movable(key)) || !movable(parent)) continue;
    if (!(children.reduce((sum, key) => sum + playersIn(key), 0) < law.mergeAt)) continue;
    under[parent] = dwell.under[parent] ?? now;
    if (now - under[parent] >= law.mergeDwellMs) merges.push(parent);
  }
  const first = (/** @type {string[]} */ candidates, /** @type {Record<string, number>} */ since) => candidates.sort((left, right) => since[left] - since[right] || (left < right ? -1 : 1))[0];
  const splitting = first(splits, over),
    merging = splitting ? null : first(merges, under);
  const move = /** @type {TreeMove | null} */ (splitting ? { kind: 'split', from: [splitting], to: childNodes(splitting) } : merging ? { kind: 'merge', from: childNodes(merging), to: [merging] } : null);
  return { move, dwell: { over, under } };
}

/** The `cellSeed` relay setting (net/relayCfg.js) read: the level 1 to CELL_LEVEL_MAX the directory seeds its tree at,
 *  0 for off or unset (the tree fixed at L0), and undefined for a value it is not. @param {unknown} value */
export const cellSeedOf = (value) => (value == null || value === '' || value === 'off' ? 0 : /^[1-4]$/.test(String(value)) ? Number(value) : undefined);
