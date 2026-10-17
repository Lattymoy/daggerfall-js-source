// IT1 (2026-10-04): IMMERSIVE TRAVEL'S CARRIAGES, AT WHICHEVER GATE THE TOWN STANDS.
//
// The mod's whole world edit is four of Daggerfall's city-gate blocks, WALLAA08-11, each with records appended: a
// carriage (model 41214) and its team or a cart (41207, 41209, 41109), the horses (TEXTURE.201), a hay or a crate
// flat, and the driver - a person flat in faction 8642, Carriage Drivers, whose click is the "Fast Travel" service
// (systems/immersiveTravel.js). Its four files are carried as WD1 patches of the player's own classic blocks
// (vendor/immersive-travel/WorldDataPatches, tools/immersiveTravelPatches.mjs).
//
// THE DEPARTURE (the owner's choice, "Add carriages to either"): Beautiful Cities ships the same four names - its own
// redrawn gates - and 52 composites built on them (`WALLAA08.FARMAA00` and the rest, a wall and a farm made one), at a
// higher priority, and online the room owns it. DFU's rule is one mod's file a name, so there the gates would carry no
// driver. Here the mod's appended records are a LAYER (formats/worldData/worldDataReplacement.js registerWorldDataLayer): laid
// onto whichever of those files the door serves, in the block's own coordinates, under the same header counts the
// editor leaves (DFU lays a block out by its arrays). Where the mod's own patch is what is served it already carries
// them, and the layer stands aside.
//
// NOT SEEN: how the carriages sit among Beautiful Cities' own gate furniture - this container has no ARENA2 to lay a
// town out in. The bible's page names it for the owner's eyes.

import { registerWorldDataLayer } from '../formats/worldData/worldDataReplacement.js';

/** The four gate blocks the mod edits, and Beautiful Cities' composites on them: `WALLAA08.RMB.json`,
 *  `WALLAA08.FARMAA00.RMB.json` - the gate is the name's first part. */
export const IT_GATE_FILE = /^(WALLAA(?:08|09|10|11))(?:\.[A-Z0-9]+)?\.RMB\.json$/;
/** OW-HUBS (FIELD BUGS 2026-10-04e): whether a town stands a carriage at its gate - one of its exterior blocks is a
 *  gate the mod edits (`IT_GATE_FILE`, read off the block's own name: 'WALLAA08.RMB', or a composite on it). Pure; the
 *  mod's switch is the caller's (systems/immersiveTravel.js immersiveTravelLoaded). */
export const hasCarriageGate = (loc) => (loc?.exterior?.exteriorData?.blockNames ?? []).some((n) => IT_GATE_FILE.test(`${String(n ?? '').toUpperCase()}.json`));
/** The two arrays the mod appends to. */
const ARRAYS = Object.freeze(['Misc3dObjectRecords', 'MiscFlatObjectRecords']);

/** A patch's appended records, per array, in the patch's order - its `i` ops into the block's two misc arrays at or past
 *  the classic counts (`counts`, the rebuilt file's header; the editor leaves the classic block's there). AUDIT IT1
 *  G1/G2: every other op is the mod's own file's - the editor's round trip (tools/immersiveTravelPatches.mjs), or what
 *  WD1's diff against a real BLOCKS.BSA finds (an automap byte, a classic record re-set or re-inserted) - and is passed
 *  over, never refused: one op the layer could not lay stopped every world loading. */
export function gateAppends(patch, counts = null) {
  const out = { Misc3dObjectRecords: [], MiscFlatObjectRecords: [] };
  for (const [kind, path, value] of patch?.ops ?? []) {
    if (kind !== 'i' || path?.length !== 3 || path[0] !== 'RmbBlock' || !ARRAYS.includes(path[1])) continue;
    if (counts && !(path[2] >= (counts[path[1]] ?? 0))) continue;
    out[path[1]].push(value);
  }
  return out;
}

/** The served file with the mod's records appended - a new document; the served one is untouched. */
export function layGateRecords(json, appends) {
  const rmb = json?.RmbBlock;
  if (!rmb) return json;
  const next = { ...rmb };
  for (const k of ARRAYS) {
    if (!appends[k]?.length) continue;
    next[k] = [...(Array.isArray(rmb[k]) ? rmb[k] : []), ...appends[k].map((r) => ({ ...r }))];
  }
  return { ...json, RmbBlock: next };
}

/**
 * The layer, once the patches are read: `patches` the mod's four (by the gate block's name, 'WALLAA08.RMB'), `own`
 * the documents its patches rebuilt (the door serves those as the mod's own file), `isOn` the mod's switch. Answers
 * whether a layer was laid.
 */
export function installImmersiveTravelGates(patches, own, isOn) {
  const byGate = new Map();
  (patches ?? []).forEach((p, i) => {
    const h = own?.[i]?.RmbBlock?.FldHeader;   // the rebuilt file's header: the classic counts the editor left there
    const counts = h ? { Misc3dObjectRecords: h.NumMisc3dObjectRecords, MiscFlatObjectRecords: h.NumMiscFlatObjectRecords } : null;
    byGate.set(String(p.rebuilds ?? '').replace(/\.RMB\.json$/, ''), gateAppends(p, counts));
  });
  if (!byGate.size) return false;
  const mine = new WeakSet((own ?? []).filter((j) => j && typeof j === 'object'));
  return registerWorldDataLayer({
    vendor: 'immersive-travel',
    isOn: typeof isOn === 'function' ? isOn : () => true,
    match: (fileName) => byGate.has(IT_GATE_FILE.exec(fileName)?.[1]),
    owns: (json) => mine.has(json),
    apply: (json, fileName) => layGateRecords(json, byGate.get(IT_GATE_FILE.exec(fileName)?.[1])),
  });
}
