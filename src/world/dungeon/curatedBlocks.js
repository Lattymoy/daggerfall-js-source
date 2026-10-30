// @ts-check
// DELVE II (DLV5, bible/03-World/Delve-II.md section 8): CURATED BLOCKS - a dungeon block designed, its encounter with
// it. A curated block is a real interior block of the player's own BLOCKS.BSA (its `base`: the walls, the floors and the
// edges every interior block meets its neighbours by), with objects taken out by name (`drop`), Daggerfall's models, flats,
// markers and lights added (`add`: DLV6's set pieces), and the anchors of its encounters. Made when first read, as a capital's castle halls are
// (world/capitalCastles.js): the repository holds the record, never a block of the game's (WD1's rule). Laid only where
// curatedSplice.js puts one. Every length here is in metres in the block's own frame, the layout's axes (rdbLayout.js:
// a unit is GLOBAL_SCALE metres, y up).

import { RDB_RESOURCE_TYPES, ROTATION_DIVISOR } from '../../formats/blocksFile.js';
import { GLOBAL_SCALE } from '../meshReader.js';
import { RDB_SIDE } from '../rdbLayout.js';
import { DUNGEON_TYPES } from '../../formats/mapsFile.js';
import { DELVE_KIND_NAMES } from '../../net/delve/delveLaw.js';

/** The curated blocks' fixed indices: past the town outline's 906000, under TS4's walled towns' 1,000,000. */
export const CURATED_BLOCK_INDEX = 907000;
export const CURATED_BLOCKS_MAX = 1000;
/** A curated block's own record position: past any BSA offset (BLOCKS.BSA is under 2^28 bytes), so its objects' LoadIDs
 *  (rdbLayout.js: the block's position plus the object's) never meet its base's when both stand in one dungeon. */
export const CURATED_POSITION = 2 ** 36;
export const CURATED_POSITION_STEP = 2 ** 28;
/** An added object's own position in the block: past any record's offset inside a block. */
export const CURATED_ADD_POSITION = 0x7f000000;
/** The editor's markers by name (archive 199: rdbLayout.js's start and enter, a foe of the table, a foe of `mobile`, and
 *  systems/loot/loot.js RANDOM_TREASURE_MARKER_RECORD's pile). */
export const CURATED_MARKERS = Object.freeze({ start: 10, enter: 8, enemy: 16, foe: 15, treasure: 19 });
/** A curated block's name: an N first (formats/blocksFile.js getRdbType: an ordinary block), no name BLOCKS.BSA has. */
export const curatedBlockName = (n) => `NDLV${String(n).padStart(4, '0')}.RDB`;
/** An anchor's ward and the most a block holds (law 4's disc, DSITE.r; a block is one site at most - AUDIT DLV5-6: two in
 *  one block stood 8 m apart where the plan keeps sites 60 m). */
export const CURATED_ANCHOR_R = Object.freeze([3, 4]);
export const CURATED_ANCHORS_MAX = 1;
/** AUDIT DLV5-6 M8: the markers a drop never takes - the way in (the block's first start marker carries its water level
 *  and its castle flag, rdbLayout.js), and the way in's own. */
export const CURATED_KEPT_MARKERS = Object.freeze(['start', 'enter']);
/** DLV6: an added light's reach (m), as the block's own lights have (world/dungeon/dungeonLights.js collectDungeonLights:
 *  the radius times GLOBAL_SCALE times 3 - the freeware's interior lights reach 3 to 12 m). */
export const CURATED_LIGHT_M = Object.freeze([1, 12]);
/** A light's radius in the block's units, for a reach in metres. */
export const lightRadiusOf = (m) => Math.round(m / (GLOBAL_SCALE * 3));

/** In the block: half-open, as a block's own frame is (51.2 is the next block's 0 - AUDIT DLV5-6). */
const inBlock = (p) =>
  Array.isArray(p) &&
  p.length === 3 &&
  p.every(Number.isFinite) &&
  p[0] >= 0 &&
  p[0] < RDB_SIDE &&
  p[2] >= 0 &&
  p[2] < RDB_SIDE &&
  Math.abs(p[1]) <= RDB_SIDE;
const flat = (a) => Array.isArray(a) && a.length === 2 && a.every((v) => Number.isInteger(v) && v >= 0 && v < 1024);
/** The editor's archive (TEXTURE.199): its records are markers, named by `marker` alone. */
const EDITOR_ARCHIVE = 199;

/** What is wrong with a record, or null (each block's own word, so a bad one is refused by name). Pure. @param {any} rec */
export function curatedRecordError(rec) {
  if (!rec || typeof rec !== 'object') return 'no record';
  if (typeof rec.id !== 'string' || !/^[a-z][a-z0-9-]{2,40}$/.test(rec.id)) return 'id: a-z, 0-9 and -';
  if (!Number.isInteger(rec.n) || rec.n < 0 || rec.n >= CURATED_BLOCKS_MAX) return `n: 0 to ${CURATED_BLOCKS_MAX - 1}`;
  if (typeof rec.base !== 'string' || !/^[NW][0-9]{7}\.RDB$/.test(rec.base))
    return 'base: an interior block of BLOCKS.BSA (N or W, seven digits)';
  const types = Object.values(DUNGEON_TYPES).filter((t) => t !== DUNGEON_TYPES.NoDungeon);
  if (!Array.isArray(rec.types) || !rec.types.length || !rec.types.every((t) => types.includes(t)))
    return 'types: the dungeon types it joins';
  for (const d of rec.drop ?? []) {
    if (!inBlock(d?.at) || !(d.r > 0 && d.r <= RDB_SIDE)) return 'drop: a point in the block and a radius';
    if ([d.model !== undefined, d.flat !== undefined, d.marker !== undefined].filter(Boolean).length !== 1)
      return 'drop: what it takes - one of model, flat or marker';
    if (d.model !== undefined && !(Number.isInteger(d.model) && d.model > 0)) return 'drop: a model id';
    if (
      d.flat !== undefined &&
      !(
        Array.isArray(d.flat) &&
        d.flat.length === 2 &&
        Number.isInteger(d.flat[0]) &&
        Number.isInteger(d.flat[1]) &&
        d.flat[1] >= -1
      )
    )
      return 'drop: a flat [archive, record], record -1 for any';
    if (d.flat?.[0] === EDITOR_ARCHIVE) return 'drop: an editor marker by its name (`marker`), never by its flat';
    if (d.marker !== undefined && !Object.hasOwn(CURATED_MARKERS, d.marker))
      return `drop: a marker of ${Object.keys(CURATED_MARKERS).join(', ')}`;
    if (CURATED_KEPT_MARKERS.includes(d.marker)) return 'drop: never the way in (a start or an enter marker)';
  }
  for (const a of rec.add ?? []) {
    if (!inBlock(a?.at)) return 'add: a point in the block';
    const kinds = [a.model !== undefined, a.flat !== undefined, a.marker !== undefined, a.light !== undefined].filter(
      Boolean,
    ).length;
    if (kinds !== 1) return 'add: one of model, flat, marker or light';
    if (
      a.light !== undefined &&
      !(Number.isFinite(a.light) && a.light >= CURATED_LIGHT_M[0] && a.light <= CURATED_LIGHT_M[1])
    )
      return `add: a light's reach, ${CURATED_LIGHT_M.join(' to ')} m`;
    if (a.model !== undefined && !(Number.isInteger(a.model) && a.model > 0 && a.model < 1e6)) return 'add: a model id';
    if (a.flat !== undefined && !flat(a.flat)) return 'add: a flat [archive, record]';
    if (a.marker !== undefined && !Object.hasOwn(CURATED_MARKERS, a.marker))
      return `add: a marker of ${Object.keys(CURATED_MARKERS).join(', ')}`;
    if (
      (a.marker === 'foe') !== (a.mobile !== undefined) ||
      (a.mobile !== undefined && !(Number.isInteger(a.mobile) && a.mobile >= 0 && a.mobile < 1024))
    )
      return 'add: a foe marker and its mobile, together';
    if (a.rot !== undefined && !(Array.isArray(a.rot) && a.rot.length === 3 && a.rot.every(Number.isFinite)))
      return 'add: rot in degrees [x, y, z]';
  }
  const anchors = rec.anchors ?? [];
  if (!Array.isArray(anchors) || anchors.length > CURATED_ANCHORS_MAX) return `anchors: ${CURATED_ANCHORS_MAX} at most`;
  for (const a of anchors) {
    if (!DELVE_KIND_NAMES.includes(a?.kind)) return `anchors: a kind of ${DELVE_KIND_NAMES.join(', ')}`;
    if (!inBlock(a.at) || !inBlock(a.vault)) return 'anchors: a heart and a vault in the block';
    if (!CURATED_ANCHOR_R.includes(a.r)) return `anchors: r ${CURATED_ANCHOR_R.join(' or ')}`;
  }
  return null;
}

/** Units from metres, the layout's way back (rdbLayout.js: x, -y, z times GLOBAL_SCALE). */
const units = (at) => [
  Math.round(at[0] / GLOBAL_SCALE),
  Math.round(-at[1] / GLOBAL_SCALE),
  Math.round(at[2] / GLOBAL_SCALE),
];
/** Where a base object stands, in metres. */
const metresOf = (o) => [o.xPos * GLOBAL_SCALE, -o.yPos * GLOBAL_SCALE, o.zPos * GLOBAL_SCALE];
/** The base's objects that act or that an action names (a door's chain, a lever and what it moves, a teleport): never
 *  dropped, so no chain is broken and no way is shut (AUDIT DLV5-6 M8: a chain's head was droppable - 138 of them). */
function linkedOf(rdb) {
  const linked = new Set();
  for (const g of rdb.objectRootList ?? [])
    for (const o of g.rdbObjects ?? []) {
      const a = o.resources?.modelResource?.actionResource,
        f = o.resources?.flatResource;
      if (o.type === RDB_RESOURCE_TYPES.Model && a) {
        if (a.flags || a.nextObjectOffset > 0 || a.previousObjectOffset > 0) linked.add(o.position);
        if (a.nextObjectOffset > 0) linked.add(a.nextObjectOffset);
        if (a.previousObjectOffset > 0) linked.add(a.previousObjectOffset);
      }
      if (o.type === RDB_RESOURCE_TYPES.Flat && f && (f.action > 0 || f.nextObjectOffset > 0)) {
        linked.add(o.position);
        if (f.nextObjectOffset > 0) linked.add(f.nextObjectOffset);
      }
    }
  return linked;
}
/** Whether a drop names this object: its model's id, its flat (any record of the archive at -1), or its marker. */
function takes(d, o, rdb) {
  if (d.model !== undefined)
    return (
      o.type === RDB_RESOURCE_TYPES.Model &&
      rdb.modelReferenceList?.[o.resources?.modelResource?.modelIndex]?.modelIdNum === d.model
    );
  if (o.type !== RDB_RESOURCE_TYPES.Flat) return false;
  const f = o.resources?.flatResource;
  const [archive, record] = d.flat ?? [199, CURATED_MARKERS[d.marker]];
  return f?.textureArchive === archive && (record === -1 || f.textureRecord === record);
}
const actionNone = () => ({
  position: 0,
  axis: 0,
  duration: 0,
  magnitude: 0,
  nextObjectOffset: 0,
  flags: 0,
  previousObjectOffset: 0,
  nextObjectIndex: 0,
});
const flatOf = (archive, record, mobile = 0) => ({
  position: 0,
  textureBitfield: ((archive << 7) | (record & 0x7f)) & 0xffff,
  textureArchive: archive,
  textureRecord: record,
  flags: 0,
  magnitude: 0,
  soundIndex: 0,
  factionOrMobileId: mobile,
  nextObjectOffset: -1,
  action: 0,
  isCustomData: false,
});
/** A flat's model resource: DFU's default struct, as formats/worldData's JSON reader leaves one (every object has three). */
const modelNone = () => ({
  xRotation: 0,
  yRotation: 0,
  zRotation: 0,
  modelIndex: 0,
  triggerFlagStartingLock: 0,
  soundIndex: 0,
  actionOffset: 0,
  actionResource: actionNone(),
});
const lightNone = () => ({ unknown1: 0, unknown2: 0, radius: 0 });

/**
 * THE BLOCK MADE: the base's copy under the curated name and index, at its own record position - the base's objects
 * within a `drop` taken out (an object an action names is kept), each `add` laid as an object of its own (a model's id
 * joining the reference list, a light a Light resource), in a root of its own. Null without the base. Pure.
 * @param {any} base the base's DFBlock (formats/blocksFile.js getBlockByName) @param {any} rec a record curatedRecordError passes
 */
export function curatedBlockOf(base, rec) {
  const rdb = base?.rdbBlock;
  if (!rdb) return null;
  const linked = linkedOf(rdb);
  const dropped = (o) =>
    !linked.has(o.position) &&
    (rec.drop ?? []).some((d) => takes(d, o, rdb) && Math.hypot(...metresOf(o).map((v, k) => v - d.at[k])) <= d.r);
  const refs = [...(rdb.modelReferenceList ?? [])];
  const refOf = (id) => {
    let k = refs.findIndex((m) => m.modelIdNum === id && !m.description); // a described reference means more (`DOR`: an action door)
    if (k < 0) {
      k = refs.length;
      refs.push({ modelId: String(id), modelIdNum: id, description: '' });
    }
    return k;
  };
  const added = (rec.add ?? []).map((a, k) => {
    const [xPos, yPos, zPos] = units(a.at);
    const o = {
      position: CURATED_ADD_POSITION + k,
      next: 0,
      previous: 0,
      index: k,
      xPos,
      yPos,
      zPos,
      resourceOffset: 0,
    };
    if (a.model !== undefined) {
      const [rx, ry, rz] = (a.rot ?? [0, 0, 0]).map((deg) => Math.round(-deg * ROTATION_DIVISOR));
      return {
        ...o,
        type: RDB_RESOURCE_TYPES.Model,
        resources: {
          modelResource: { ...modelNone(), xRotation: rx, yRotation: ry, zRotation: rz, modelIndex: refOf(a.model) },
          flatResource: flatOf(0, 0),
          lightResource: lightNone(),
        },
      };
    }
    if (a.light !== undefined)
      return {
        ...o,
        type: RDB_RESOURCE_TYPES.Light,
        resources: {
          modelResource: modelNone(),
          flatResource: flatOf(0, 0),
          lightResource: { ...lightNone(), radius: lightRadiusOf(a.light) },
        },
      };
    const [archive, record] = a.flat ?? [199, CURATED_MARKERS[a.marker]];
    return {
      ...o,
      type: RDB_RESOURCE_TYPES.Flat,
      resources: {
        modelResource: modelNone(),
        flatResource: flatOf(archive, record, a.mobile ?? 0),
        lightResource: lightNone(),
      },
    };
  });
  const name = curatedBlockName(rec.n);
  return {
    ...base,
    index: CURATED_BLOCK_INDEX + rec.n,
    name,
    servedName: name,
    position: CURATED_POSITION + rec.n * CURATED_POSITION_STEP,
    rdbBlock: {
      ...rdb,
      modelReferenceList: refs,
      objectRootList: [
        ...(rdb.objectRootList ?? []).map((g) => ({
          ...g,
          rdbObjects: g.rdbObjects ? g.rdbObjects.filter((o) => !dropped(o)) : g.rdbObjects,
        })),
        { rootOffset: 0, rdbObjects: added },
      ],
    },
  };
}

/** A block's curated record by its name, among `records`, or null. */
export const curatedByName = (name, records) => records.find((r) => curatedBlockName(r.n) === name) ?? null;
/** Whether a block's name is a curated one's (its shape alone - curatedSplice.js asks it of a block list). */
export const isCuratedName = (name) => /^NDLV[0-9]{4}\.RDB$/.test(String(name ?? ''));

/**
 * THE ANCHORS OF A LAID DUNGEON: each curated block's, in the dungeon's frame (its origin added), in block order - the
 * sites they stand (world/dungeon/delveSites.js delveSitePlan). Pure.
 * @param {{ name: string, originX: number, originZ: number }[]} blocks the layout's (world/dungeon/dungeonLayout.js)
 * @param {readonly any[]} records
 */
export function curatedAnchors(blocks, records) {
  const out = [];
  for (const b of blocks ?? []) {
    const rec = isCuratedName(b.name) ? curatedByName(b.name, records) : null;
    for (const a of rec?.anchors ?? []) {
      out.push({
        kind: a.kind,
        r: a.r,
        at: [a.at[0] + b.originX, a.at[1], a.at[2] + b.originZ],
        vault: [a.vault[0] + b.originX, a.vault[1], a.vault[2] + b.originZ],
        id: rec.id,
      });
    }
  }
  return out;
}
