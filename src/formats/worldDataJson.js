// WD1 (2026-09-25): A CLASSIC BLOCK IN DFU'S WORLD-DATA JSON, AND THE
// DIFF THAT CARRIES A MOD'S EDIT OF IT.
//
// Aquatic Sprites, Detailed Ships and Warm Ashes - Ships ship their world
// data the way DFU's World Data Editor writes it: the WHOLE block (or the
// whole building record), serialised by FullSerializer from the DFBlock
// DFU read out of the player's BLOCKS.BSA, with the author's edits in it.
// Most of every such file is therefore the classic block itself - game
// data, which this repository never carries (Port-Doctrine; the
// windmills-kamer README says the same of whole RMB blocks). So the port
// vendors the DIFF: `blockToDfuJson` below serialises the player's own
// classic block into exactly the shape the editor writes, `diffJson`
// takes the mod's file against it (tools/worldDataPatch.mjs), and at run
// time `patchJson` lays the vendored diff back on the player's block and
// the result is handed to the world-data door under the file's DFU name
// (scenes/modWorldData.js). The patch records the sha256 of the mod's
// file in canonical form (`canonicalJson`), so a rebuild that does not
// come back to the author's bytes is said, not silently served.
//
// The serialiser is DFBlock's FullSerializer shape, member for member
// (DFBlock.cs): public fields only (every `internal` is left out), enums
// by name, the RMB ground arrays flattened y-outer x-inner
// (RmbGroundDataConverter.DoSerialize), the RDB model reference list cut
// at the first "���" description (RdbBlockDescProcessor),
// an RDB object's Resources down to the one its Type uses
// (RdbObjectProcessor), and an RMB model's zero scales dropped
// (RmbBlock3dObjectRecordProcessor). The files these three mods ship were
// written before DFU added RdbFlatResource.IsCustomData, so the
// serialiser writes the field set they carry and no more.

import { BUILDING_TYPES } from '../world/buildingNames.js';
import { BLOCK_TYPES, RDB_RESOURCE_TYPES } from './blocksFile.js';

const BLOCK_TYPE_NAMES = ['Unknown', 'Rmb', 'Rdb', 'Rdi'];
const RDB_RESOURCE_NAMES = { [RDB_RESOURCE_TYPES.Model]: 'Model', [RDB_RESOURCE_TYPES.Light]: 'Light', [RDB_RESOURCE_TYPES.Flat]: 'Flat' };
/** DFLocation.BuildingTypes by value: FullSerializer writes an enum by its name (the first declared, as Enum.GetName). */
const BUILDING_TYPE_NAMES = (() => {
  const m = new Map();
  for (const [name, v] of Object.entries(BUILDING_TYPES)) if (!m.has(v)) m.set(v, name);
  return m;
})();
const buildingTypeName = (v) => BUILDING_TYPE_NAMES.get(v) ?? v;

/** DFLocation.BuildingData's public fields. */
const buildingDataJson = (b) => ({
  NameSeed: b.nameSeed, FactionId: b.factionId, Sector: b.sector, LocationId: b.locationId,
  BuildingType: buildingTypeName(b.buildingType), Quality: b.quality,
});

/** RmbBlock3dObjectRecord (zero scales dropped - the classic record has none). */
function modelJson(m) {
  const o = { ModelId: m.modelId, ModelIdNum: m.modelIdNum, ObjectType: m.objectType, XPos: m.xPos, YPos: m.yPos, ZPos: m.zPos };
  if (m.xScale) o.XScale = m.xScale;
  if (m.yScale) o.YScale = m.yScale;
  if (m.zScale) o.ZScale = m.zScale;
  o.XRotation = m.xRotation; o.YRotation = m.yRotation; o.ZRotation = m.zRotation;
  return o;
}
/** RmbBlockFlatObjectRecord / RmbBlockPeopleRecord. */
const flatJson = (f) => ({
  Position: f.position, XPos: f.xPos, YPos: f.yPos, ZPos: f.zPos,
  TextureArchive: f.textureArchive, TextureRecord: f.textureRecord, FactionID: f.factionID, Flags: f.flags,
});
const section3Json = (s) => ({ XPos: s.xPos, YPos: s.yPos, ZPos: s.zPos });
const doorJson = (d) => ({
  Position: d.position, XPos: d.xPos, YPos: d.yPos, ZPos: d.zPos,
  YRotation: d.yRotation, OpenRotation: d.openRotation, DoorModelIndex: d.doorModelIndex,
});
/** RmbBlockData: the header's five public counts and the five arrays. */
export function rmbBlockDataJson(d) {
  const h = d.header;
  return {
    Header: {
      Num3dObjectRecords: h.num3dObjectRecords, NumFlatObjectRecords: h.numFlatObjectRecords,
      NumSection3Records: h.numSection3Records, NumPeopleRecords: h.numPeopleRecords, NumDoorRecords: h.numDoorRecords,
    },
    Block3dObjectRecords: d.block3dObjectRecords.map(modelJson),
    BlockFlatObjectRecords: d.blockFlatObjectRecords.map(flatJson),
    BlockSection3Records: d.blockSection3Records.map(section3Json),
    BlockPeopleRecords: d.blockPeopleRecords.map(flatJson),
    BlockDoorRecords: d.blockDoorRecords.map(doorJson),
  };
}
/** RmbSubRecord. */
export const rmbSubRecordJson = (s) => ({
  XPos: s.xPos, ZPos: s.zPos, YRotation: s.yRotation,
  Exterior: rmbBlockDataJson(s.exterior), Interior: rmbBlockDataJson(s.interior),
});

/** RmbFldGroundData through RmbGroundDataConverter.DoSerialize: y-outer, x-inner; scenery by TextureRecord only. */
function groundDataJson(g) {
  if (!g?.header) return {};
  const tiles = [], scenery = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const t = g.groundTiles[x][y];
      tiles.push({ TileBitfield: t.tileBitfield, TextureRecord: t.textureRecord, IsRotated: t.isRotated, IsFlipped: t.isFlipped });
    }
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) scenery.push({ TextureRecord: g.groundScenery[x][y].textureRecord });
  return { Header: [...g.header], GroundTiles: tiles, GroundScenery: scenery };
}

/** An RmbBlockDesc left at its default (what an RDB block serialises as). */
const EMPTY_RMB = () => ({
  FldHeader: {
    NumBlockDataRecords: 0, NumMisc3dObjectRecords: 0, NumMiscFlatObjectRecords: 0,
    BlockPositions: null, BuildingDataList: null, BlockDataSizes: null, GroundData: {},
    AutoMapData: null, Name: null, OtherNames: null,
  },
  SubRecords: null, Misc3dObjectRecords: null, MiscFlatObjectRecords: null,
});

function rmbJson(rmb) {
  const h = rmb.fldHeader;
  return {
    FldHeader: {
      NumBlockDataRecords: h.numBlockDataRecords, NumMisc3dObjectRecords: h.numMisc3dObjectRecords, NumMiscFlatObjectRecords: h.numMiscFlatObjectRecords,
      BlockPositions: h.blockPositions?.map((p) => ({ XPos: p.xPos, ZPos: p.zPos, YRotation: p.yRotation })) ?? null,
      BuildingDataList: h.buildingDataList?.map(buildingDataJson) ?? null,
      BlockDataSizes: h.blockDataSizes ? [...h.blockDataSizes] : null,
      GroundData: groundDataJson(h.groundData),
      AutoMapData: h.autoMapData ? [...h.autoMapData] : null,
      Name: h.name ?? null,
      OtherNames: h.otherNames ? [...h.otherNames] : null,   // a block served from JSON carries none (worldDataReplacement.blockFromJson)
    },
    SubRecords: rmb.subRecords.map(rmbSubRecordJson),
    Misc3dObjectRecords: rmb.misc3dObjectRecords.map(modelJson),
    MiscFlatObjectRecords: rmb.miscFlatObjectRecords.map(flatJson),
  };
}

const UNUSED_REFERENCE = '���';
function rdbObjectJson(o) {
  const r = o.resources;
  const resources = {};
  if (o.type === RDB_RESOURCE_TYPES.Model) {
    const m = r.modelResource, a = m.actionResource;
    resources.ModelResource = {
      XRotation: m.xRotation, YRotation: m.yRotation, ZRotation: m.zRotation, ModelIndex: m.modelIndex,
      TriggerFlag_StartingLock: m.triggerFlagStartingLock, SoundIndex: m.soundIndex,
      ActionResource: {
        Position: a.position, Axis: a.axis, Duration: a.duration, Magnitude: a.magnitude,
        NextObjectOffset: a.nextObjectOffset, PreviousObjectOffset: a.previousObjectOffset, NextObjectIndex: a.nextObjectIndex, Flags: a.flags,
      },
    };
  } else if (o.type === RDB_RESOURCE_TYPES.Light) {
    const l = r.lightResource;
    resources.LightResource = { Unknown1: l.unknown1, Unknown2: l.unknown2, Radius: l.radius };
  } else if (o.type === RDB_RESOURCE_TYPES.Flat) {
    const f = r.flatResource;
    resources.FlatResource = {
      Position: f.position, TextureArchive: f.textureArchive, TextureRecord: f.textureRecord, Flags: f.flags,
      Magnitude: f.magnitude, SoundIndex: f.soundIndex, FactionOrMobileId: f.factionOrMobileId,
      NextObjectOffset: f.nextObjectOffset, Action: f.action,
    };
  }
  return { Position: o.position, Index: o.index, XPos: o.xPos, YPos: o.yPos, ZPos: o.zPos, Type: RDB_RESOURCE_NAMES[o.type] ?? o.type, Resources: resources };
}
function rdbJson(rdb) {
  const refs = [];
  for (const m of rdb.modelReferenceList) {
    if (m.description === UNUSED_REFERENCE) break;   // RdbBlockDescProcessor.OnAfterSerialize
    refs.push({ ModelId: m.modelId, ModelIdNum: m.modelIdNum, Description: m.description });
  }
  return {
    ModelReferenceList: refs,
    ObjectRootList: rdb.objectRootList.map((g) => ({ RdbObjects: g.rdbObjects ? g.rdbObjects.map(rdbObjectJson) : null })),
  };
}

/** A DFBlock as DFU's World Data Editor writes it. */
export function blockToDfuJson(dfBlock) {
  const isRmb = dfBlock.type === BLOCK_TYPES.Rmb, isRdb = dfBlock.type === BLOCK_TYPES.Rdb;
  return {
    Position: dfBlock.position,
    Index: dfBlock.index,
    Name: dfBlock.name,
    Type: BLOCK_TYPE_NAMES[dfBlock.type] ?? 'Unknown',
    RmbBlock: isRmb ? rmbJson(dfBlock.rmbBlock) : EMPTY_RMB(),
    RdbBlock: isRdb ? rdbJson(dfBlock.rdbBlock) : { ModelReferenceList: null, ObjectRootList: null },
    RdiBlock: { Data: dfBlock.rdiBlock?.data ? [...dfBlock.rdiBlock.data] : null },
  };
}

/** A building record of a classic RMB block in the BuildingReplacementData shape (`<block>-<index>-building<n>.json`). */
export function buildingToDfuJson(dfBlock, recordIndex) {
  const b = dfBlock.rmbBlock.fldHeader.buildingDataList[recordIndex];
  return {
    FactionId: b.factionId, BuildingType: b.buildingType, Quality: b.quality, NameSeed: b.nameSeed,
    RmbSubRecord: rmbSubRecordJson(dfBlock.rmbBlock.subRecords[recordIndex]),
    AutoMapData: null,
  };
}

// ======================================================================
// THE DIFF: ops over a JSON tree, applied in order, each path read
// against the document as the ops before it left it.
//   ['s', path, value]  set an object key / replace an array element / (path []) the root
//   ['d', path]         delete an object key
//   ['i', path, value]  insert into an array before the index
//   ['r', path]         remove an array element
//   ['ci', path, ref]   insert a copy of a classic block's node (`ref`: { block, path })
//   ['cs', path, ref]   set a copy of a classic block's node
// The two copy ops are how a mod that DUPLICATED a classic record (Warm
// Ashes' raiders are the ship's own subrecord, moved) is carried without
// the record: the patch names where it came from, the ops after it say
// what the author changed (tools/worldDataPatch.mjs finds them).
// ======================================================================

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** JSON with every object's keys sorted: the form the patch's sha256 is taken over. */
export function canonicalJson(v) {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/** The ops that turn `a` into `b`. */
export function diffJson(a, b) {
  const ops = [];
  diffInto(a, b, [], ops, new Map());
  return ops;
}

function diffInto(a, b, path, ops, memo) {
  if (a === b) return;
  if (isObj(a) && isObj(b)) {
    for (const k of Object.keys(a)) if (!(k in b)) ops.push(['d', [...path, k]]);
    for (const k of Object.keys(b)) {
      if (!(k in a)) ops.push(['s', [...path, k], b[k]]);
      else diffInto(a[k], b[k], [...path, k], ops, memo);
    }
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) { diffArray(a, b, path, ops, memo); return; }
  if (canon(a, memo) !== canon(b, memo)) ops.push(['s', path, b]);
}

function canon(v, memo) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  let s = memo.get(v);
  if (s === undefined) { s = canonicalJson(v); memo.set(v, s); }
  return s;
}

/** Myers' O((N+M)D) shortest edit script over element identity: the
 *  matched [indexA, indexB] pairs in order, or null past MAX_EDITS (the
 *  caller then takes the arrays as one hunk). */
const MAX_EDITS = 1500;
function lcsPairs(ka, kb) {
  const n = ka.length, m = kb.length, max = n + m;
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace = [];
  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    if (d > MAX_EDITS) return null;
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && ka[x] === kb[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) { found = true; break; }
    }
  }
  // Walk back from (n, m): trace[d] is the frontier before step d.
  const pairs = [];
  let x = n, y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vv = trace[d];
    const k = x - y;
    const prevK = (k === -d || (k !== d && vv[off + k - 1] < vv[off + k + 1])) ? k + 1 : k - 1;
    const prevX = vv[off + prevK], prevY = prevX - prevK;
    while (x > prevX && y > prevY) { x--; y--; pairs.push([x, y]); }
    if (d > 0) { x = prevX; y = prevY; }
  }
  return pairs.reverse();
}

function diffArray(a, b, path, ops, memo) {
  const ka = a.map((v) => canon(v, memo)), kb = b.map((v) => canon(v, memo));
  // Equal lengths: element-for-element ops when they are the smaller
  // script (an automap with two bytes changed is two sets, not a shift).
  if (a.length === b.length) {
    const pos = [];
    for (let i = 0; i < a.length; i++) if (ka[i] !== kb[i]) diffInto(a[i], b[i], [...path, i], pos, memo);
    const lcs = [];
    diffArrayLcs(a, b, ka, kb, path, lcs, memo);
    ops.push(...(JSON.stringify(pos).length <= JSON.stringify(lcs).length ? pos : lcs));
    return;
  }
  diffArrayLcs(a, b, ka, kb, path, ops, memo);
}

function diffArrayLcs(a, b, ka, kb, path, ops, memo) {
  const pairs = lcsPairs(ka, kb) ?? [];
  // Hunks between matches: [aStart, aEnd) replaced by [bStart, bEnd).
  const hunks = [];
  let pa = 0, pb = 0;
  for (const [ia, ib] of [...pairs, [a.length, b.length]]) {
    if (ia > pa || ib > pb) hunks.push([pa, ia, pb, ib]);
    pa = ia + 1; pb = ib + 1;
  }
  // Right to left, so every index the ops name is still the document's.
  for (let h = hunks.length - 1; h >= 0; h--) {
    const [a0, a1, b0, b1] = hunks[h];
    const k = a1 - a0, mm = b1 - b0, paired = Math.min(k, mm);
    for (let t = 0; t < paired; t++) {
      const sub = [];
      diffInto(a[a0 + t], b[b0 + t], [...path, a0 + t], sub, memo);
      const whole = ['s', [...path, a0 + t], b[b0 + t]];
      if (JSON.stringify(sub).length < JSON.stringify(whole).length) ops.push(...sub);
      else ops.push(whole);
    }
    for (let t = k - 1; t >= paired; t--) ops.push(['r', [...path, a0 + t]]);
    for (let t = paired; t < mm; t++) ops.push(['i', [...path, a0 + t], b[b0 + t]]);
  }
}

const clone = (v) => (v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)));

/** Apply ops (diffJson's) to a deep copy of `base`. `resolve(ref)`
 *  answers a copy op's source - `{ block, path }`, a node of a classic
 *  block's JSON (the patch never carries what it can point at). */
export function patchJson(base, ops, resolve = null) {
  let root = clone(base);
  for (let op of ops) {
    if (op[0] === 'ci' || op[0] === 'cs') {
      if (!resolve) throw new Error('world-data patch: a copy op and no resolver');
      const v = resolve(op[2]);
      if (v === undefined) throw new Error(`world-data patch: copy source ${JSON.stringify(op[2])} not found`);
      op = [op[0] === 'ci' ? 'i' : 's', op[1], v];
    }
    const [kind, path] = op;
    if (path.length === 0) {
      if (kind !== 's') throw new Error(`world-data patch: '${kind}' at the root`);
      root = clone(op[2]);
      continue;
    }
    let parent = root;
    for (let i = 0; i < path.length - 1; i++) {
      parent = parent?.[path[i]];
      if (parent === null || typeof parent !== 'object') throw new Error(`world-data patch: ${JSON.stringify(path)} does not reach a container`);
    }
    const key = path[path.length - 1];
    if (kind === 's') {
      if (Array.isArray(parent) && !(key >= 0 && key < parent.length)) throw new Error(`world-data patch: set past the end at ${JSON.stringify(path)}`);
      parent[key] = clone(op[2]);
    } else if (kind === 'd') {
      if (!isObj(parent) || !(key in parent)) throw new Error(`world-data patch: no key at ${JSON.stringify(path)}`);
      delete parent[key];
    } else if (kind === 'i') {
      if (!Array.isArray(parent) || key < 0 || key > parent.length) throw new Error(`world-data patch: insert outside the array at ${JSON.stringify(path)}`);
      parent.splice(key, 0, clone(op[2]));
    } else if (kind === 'r') {
      if (!Array.isArray(parent) || key < 0 || key >= parent.length) throw new Error(`world-data patch: remove outside the array at ${JSON.stringify(path)}`);
      parent.splice(key, 1);
    } else throw new Error(`world-data patch: unknown op '${kind}'`);
  }
  return root;
}

/** The node at `path` (undefined when the path does not reach one). */
export function jsonAt(root, path) {
  let v = root;
  for (const k of path) { if (v === null || typeof v !== 'object') return undefined; v = v[k]; }
  return v;
}
