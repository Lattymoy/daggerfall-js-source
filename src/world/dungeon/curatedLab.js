// @ts-check
// DELVE II (DLV5, bible/03-World/Delve-II.md section 8): THE LAB'S LAW - a curated block laid out by hand in the game's
// own bench (delve.html opens `?dungeon=lab`): its draft (number 0) edited a step at a time - an add, a drop, an anchor,
// its vault - each at the player's feet in the block's own frame, the made location the bench walks (the draft the start,
// four borders of a real dungeon of its type round it), and the JSON a shipped record is (src/assets/delve/<id>.json). Pure.
import { curatedBlockName, curatedRecordError } from './curatedBlocks.js';

/** Where a browser keeps the lab's draft (delve.html makes it, the bench's `?dungeon=lab` reads it). */
export const LAB_DRAFT_KEY = 'delve.lab.draft';
/** A point to the centimetre, as a record keeps it. */
export const labRound = (p) => p.map((v) => Math.round(v * 100) / 100);
/** A draft of `rec`: number 0, its lists its own. */
export const labDraftOf = (rec) => ({ id: rec.id, n: 0, base: rec.base, types: [...rec.types], drop: (rec.drop ?? []).map((d) => ({ ...d })), add: (rec.add ?? []).map((a) => ({ ...a })), anchors: (rec.anchors ?? []).map((a) => ({ ...a })) });
/** A new draft: its id, its base, its first type. */
export const labNew = (id, base, type) => ({ id, n: 0, base, types: [type], drop: [], add: [], anchors: [] });
/** The draft with `item` added to list `list` (`add`, `drop` or `anchors`) at `at` - or its refusal, by name. */
export function labPut(draft, list, item, at) {
  const next = { ...draft, [list]: [...(draft[list] ?? []), { ...item, at: labRound(at), ...(list === 'anchors' ? { vault: labRound(item.vault ?? at) } : {}) }] };
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
/** The made location the bench lays: the draft's block the start at the grid's heart, the borders round it (north, west,
 *  east, south - lairLayout's order), the template's climate and record. No map id: no room keys off it. */
export function labLocation(draft, template) {
  const borders = labBorders(template);
  const sides = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  return {
    ...template, name: `Delve lab: ${draft.id}`, locationIndex: -1, spawned: false, country: undefined, delveLab: true,
    mapTableData: { ...template.mapTableData, mapId: 0, dungeonType: draft.types[0] },
    dungeon: {
      ...template.dungeon,
      blocks: [{ x: 0, z: 0, blockName: curatedBlockName(0), isStartingBlock: true }, ...borders.map((n, k) => ({ x: sides[k][0], z: sides[k][1], blockName: n, isStartingBlock: false }))],
    },
  };
}
/** The record a draft ships as, numbered `n`: its keys in the record's order, two spaces, a newline at its end. */
export function labExport(draft, n) {
  const rec = { id: draft.id, n, base: draft.base, types: draft.types, drop: draft.drop ?? [], add: draft.add ?? [], anchors: draft.anchors ?? [] };
  const why = curatedRecordError(rec);
  if (why) return { why };
  return { text: `${JSON.stringify(rec, null, 2)}\n` };
}
