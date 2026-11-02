// @ts-check
// DELVE II (DLV5, bible/03-World/Delve-II.md section 8): THE LAB'S LAW - a curated block laid out by hand in the game's
// own bench (delve.html opens `?dungeon=lab`): its draft (number 0) edited a step at a time - an add, a drop, an anchor,
// its vault - each at the player's feet in the block's own frame, the made location the bench walks (the draft the start,
// four borders of a real dungeon of its type round it), and the JSON a shipped record is (src/assets/delve/<id>.json). Pure.
import { curatedBlockName, curatedRecordError } from './curatedBlocks.js';

/** Where a browser keeps the lab's drafts, each by its id, and which is open (delve.html makes one, the bench's
 *  `?dungeon=lab` reads them) - AUDIT DLV5-6 M6: one slot lost a designer's work to a shipped record opened, or a typo. */
export const LAB_DRAFTS_KEY = 'delve.lab.drafts';
export const LAB_CURRENT_KEY = 'delve.lab.current';
/** A point to the centimetre, as a record keeps it. */
export const labRound = (p) => p.map((v) => Math.round(v * 100) / 100);
/** A draft of `rec`: number 0, its lists its own, the number it ships as kept (`from` - AUDIT DLV5-6 M5). */
export const labDraftOf = (rec) => ({
  id: rec.id,
  n: 0,
  from: rec.n,
  base: rec.base,
  types: [...rec.types],
  drop: (rec.drop ?? []).map((d) => ({ ...d })),
  add: (rec.add ?? []).map((a) => ({ ...a })),
  anchors: (rec.anchors ?? []).map((a) => ({ ...a })),
});
/** The types a field says (`1, 2, 11`), or null for one that says none or names no number. */
export function labTypes(text) {
  const t = String(text ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  return t.length && t.every(Number.isInteger) ? [...new Set(t)] : null;
}
/** The drafts this browser keeps, by id, and the open one's id. Never throws: a browser that keeps none keeps none. */
export function labKept(storage) {
  try {
    const drafts = JSON.parse(storage?.getItem(LAB_DRAFTS_KEY) ?? 'null');
    return {
      drafts: drafts && typeof drafts === 'object' ? drafts : {},
      current: storage?.getItem(LAB_CURRENT_KEY) ?? null,
    };
  } catch {
    return { drafts: {}, current: null };
  }
}
/** THE KEEP: `draft` kept under its id and opened - or why not, by name (the law's word on it, or no storage). A draft the
 *  law refuses is never kept, so the lab always opens on one it can lay. */
export function labKeep(storage, draft) {
  const why = curatedRecordError(draft) ?? (draft?.n !== 0 ? 'n: a draft is number 0' : null);
  if (why) return why;
  try {
    const { drafts } = labKept(storage);
    storage.setItem(LAB_DRAFTS_KEY, JSON.stringify({ ...drafts, [draft.id]: draft }));
    storage.setItem(LAB_CURRENT_KEY, draft.id);
    return null;
  } catch {
    return 'this browser keeps no storage: the lab needs it';
  }
}
/** A new draft: its id, its base, its first type. */
export const labNew = (id, base, type) => ({ id, n: 0, base, types: [type], drop: [], add: [], anchors: [] });
/** The draft with `item` added to list `list` (`add`, `drop` or `anchors`) at `at` - or its refusal, by name. */
export function labPut(draft, list, item, at) {
  const next = {
    ...draft,
    [list]: [
      ...(draft[list] ?? []),
      { ...item, at: labRound(at), ...(list === 'anchors' ? { vault: labRound(item.vault ?? at) } : {}) },
    ],
  };
  const why = curatedRecordError(next);
  return why ? { why } : { draft: next };
}
/** The draft with list `list`'s entry `k` taken out. */
export const labTake = (draft, list, k) => ({ ...draft, [list]: (draft[list] ?? []).filter((_, j) => j !== k) });
/** The draft with its last anchor's vault at `at`. */
export function labVault(draft, at) {
  const a = draft.anchors ?? [];
  if (!a.length) return { why: 'anchors: none yet' };
  const next = { ...draft, anchors: [...a.slice(0, -1), { ...a[a.length - 1], vault: labRound(at) }] };
  const why = curatedRecordError(next);
  return why ? { why } : { draft: next };
}
/** Four border blocks of a real dungeon (its own `B` blocks in its order, the first again where it holds fewer). */
export function labBorders(template) {
  const b = [...new Set((template?.dungeon?.blocks ?? []).map((x) => x.blockName).filter((n) => /^B/i.test(n)))];
  return b.length ? [0, 1, 2, 3].map((k) => b[k % b.length]) : [];
}
/** The made location the bench lays: the draft's block at the grid's heart, the borders round it (north, west, east, south
 *  - lairLayout's order), the template's climate and record. Never the start (AUDIT DLV5-6: the game lays a curated block
 *  as none, so no exit door of its base stands - the bench stands the player itself). No map id: no room keys off it. */
export function labLocation(draft, template) {
  const borders = labBorders(template);
  const sides = [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ];
  return {
    ...template,
    name: `Delve lab: ${draft.id}`,
    locationIndex: -1,
    spawned: false,
    country: undefined,
    delveLab: true,
    mapTableData: { ...template.mapTableData, mapId: 0, dungeonType: draft.types[0] },
    dungeon: {
      ...template.dungeon,
      blocks: [
        { x: 0, z: 0, blockName: curatedBlockName(0), isStartingBlock: false },
        ...borders.map((n, k) => ({ x: sides[k][0], z: sides[k][1], blockName: n, isStartingBlock: false })),
      ],
    },
  };
}
/** The record a draft ships as, numbered `n`: its keys in the record's order, two spaces, a newline at its end. */
export function labExport(draft, n) {
  const rec = {
    id: draft.id,
    n,
    base: draft.base,
    types: draft.types,
    drop: draft.drop ?? [],
    add: draft.add ?? [],
    anchors: draft.anchors ?? [],
  };
  const why =
    curatedRecordError(rec) ?? (n === 0 ? "n: 0 is the lab's own draft - a shipped record is 1 or more" : null); // AUDIT DLV5-6: a 0 shipped stops every load
  if (why) return { why };
  return { text: `${JSON.stringify(rec, null, 2)}\n` };
}
