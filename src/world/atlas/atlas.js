// @ts-check
// FOUNDATION F1 (2026-10-30, bible/03-World/Foundation-Arc.md) - THE ATLAS: the world's places entity-major. The game's
// files are type-major (a place's name in MAPS.BSA's table, its grid in its record, its blocks in BLOCKS.BSA, joined by
// position); a bundle is one place whole - who it is, its exterior grid, its dungeon plan, its buildings and doors - and
// the blocks are a vocabulary the bundles name, interned once and never copied. Every name a bundle takes is resolved
// as the layout resolves it, so a reference that would not stand is found when the atlas is filled, not at a door.
// Identity is the registry's (world/worldWide/worldPlaces.js), so the atlas answers for every province. Pure: plain
// records in, answers out. Not a DFU member (DFU has MapsFile and BlocksFile, no join). Ledger A (FOUNDATION).

export const ATLAS_VERSION = 1;   // the surface's version: raised when a part's shape changes, so a consumer can check it

/** The closed set of part kinds. A bundle is a place, its exterior, its dungeon, its buildings and its doors; the
 *  vocabulary is the exterior blocks and the dungeon blocks; a region is the places that carry its index. */
export const PART_KINDS = Object.freeze(['place', 'exterior', 'dungeon', 'building', 'door', 'rmb', 'rdb', 'region']);

/** A block name's kind, by its extension: 'rmb', 'rdb', or null. @param {string} name */
export const blockKindOf = (name) => (/\.RMB$/i.test(name) ? 'rmb' : /\.RDB$/i.test(name) ? 'rdb' : null);

/**
 * @typedef {import('../worldWide/worldPlaces.js').WorldPlace} WorldPlace
 * @typedef {{ name: string, kind: 'rmb'|'rdb', uses: number }} BlockWord
 * @typedef {{ place: number, part: 'exterior'|'dungeon', name: string, why: 'unresolved'|'aliased', as?: string }} Problem
 * @typedef {{ type: Uint8Array, faction: Uint16Array, quality: Uint8Array }} Buildings
 */
const NONE = Object.freeze([]);

/**
 * An empty atlas. `resolveBlock` answers a name as the layout serves it: the same name, another (BLOCKS.BSA's alternate
 * match, MapsFile's own fallback) or '' / null when nothing stands under it.
 * @param {{ resolveBlock?: (name: string) => string|null|undefined }} [o]
 */
export function createAtlas({ resolveBlock = (n) => n } = {}) {
  /** @type {BlockWord[]} */ const words = [];
  /** @type {Map<string, number>} */ const wordId = new Map();
  /** @type {Map<number, Set<number>>} */ const usersOfWord = new Map();
  /** @type {Map<number, Bundle>} */ const bundles = new Map();
  /** @type {Map<number, number[]>} */ const byRegion = new Map();
  /** @type {Problem[]} */ const problems = [];
  /** @type {Map<string, string>} */ const resolved = new Map();

  const resolve = (/** @type {string} */ name) => {
    let r = resolved.get(name);
    if (r === undefined) { r = String(resolveBlock(name) || ''); resolved.set(name, r); }
    return r;
  };
  /** A name's vocabulary id for a place's part, the name resolved first; -1 and a problem when it does not resolve. */
  const intern = (/** @type {string} */ name, /** @type {number} */ place, /** @type {'exterior'|'dungeon'} */ part) => {
    const n = String(name ?? '');
    const canon = n ? resolve(n) : '';
    if (!canon) { problems.push({ place, part, name: n, why: 'unresolved' }); return -1; }
    if (canon !== n) problems.push({ place, part, name: n, why: 'aliased', as: canon });
    let id = wordId.get(canon);
    if (id === undefined) {
      id = words.length;
      words.push({ name: canon, kind: blockKindOf(canon) ?? (part === 'dungeon' ? 'rdb' : 'rmb'), uses: 0 });
      wordId.set(canon, id);
      usersOfWord.set(id, new Set());
    }
    words[id].uses++;
    /** @type {Set<number>} */ (usersOfWord.get(id)).add(place);
    return id;
  };

  /**
   * One place into the atlas, from its registry record and its location as the readers mint it (MapsFile.getLocation,
   * a synthesizer past the Bay). A place already in it is kept as it is. Answers its bundle.
   * @param {WorldPlace} place @param {any} loc @returns {Bundle}
   */
  function add(place, loc) {
    const had = bundles.get(place.mapId);
    if (had) return had;
    const id = place.mapId;
    const ed = loc?.exterior?.exteriorData;
    /** @type {Exterior|null} */
    let exterior = null;
    if (ed?.blockNames?.length) {
      const blocks = Int32Array.from(ed.blockNames, (/** @type {string} */ n) => intern(n, id, 'exterior'));
      exterior = Object.freeze({ w: ed.width | 0, h: ed.height | 0, blocks });
    }
    /** @type {Dungeon|null} */
    let dungeon = null;
    const db = loc?.hasDungeon ? loc?.dungeon?.blocks : null;
    if (db?.length) {
      const blocks = Int32Array.from(db, (/** @type {any} */ b) => intern(b.blockName, id, 'dungeon'));
      dungeon = Object.freeze({
        blocks, x: Int16Array.from(db, (/** @type {any} */ b) => b.x | 0), z: Int16Array.from(db, (/** @type {any} */ b) => b.z | 0),
        start: db.findIndex((/** @type {any} */ b) => b.isStartingBlock),
      });
    }
    const bl = loc?.exterior?.buildings ?? NONE;
    const buildings = Object.freeze({
      type: Uint8Array.from(bl, (/** @type {any} */ b) => b?.buildingType ?? 0),
      faction: Uint16Array.from(bl, (/** @type {any} */ b) => b?.factionId ?? 0),
      quality: Uint8Array.from(bl, (/** @type {any} */ b) => b?.quality ?? 0),
    });
    const doors = Uint16Array.from(loc?.exterior?.recordElement?.doors ?? NONE, (/** @type {any} */ d) => d?.buildingDataIndex ?? 0);
    const bundle = Object.freeze({ id, place, exterior, dungeon, buildings, doors });
    bundles.set(id, bundle);
    if (!byRegion.has(place.region)) byRegion.set(place.region, []);
    /** @type {number[]} */ (byRegion.get(place.region)).push(id);
    return bundle;
  }

  const nameOf = (/** @type {number} */ w) => (w >= 0 ? words[w].name : '');

  /** Every part of one kind, as plain records (PART_KINDS). @param {string} kind */
  function* parts(kind) {
    if (!PART_KINDS.includes(kind)) throw new RangeError(`no part kind '${kind}' (atlas.js PART_KINDS)`);
    if (kind === 'rmb' || kind === 'rdb') {
      for (const [w, word] of words.entries()) if (word.kind === kind) yield { kind, name: word.name, uses: word.uses, places: usersOfWord.get(w)?.size ?? 0 };
      return;
    }
    if (kind === 'region') {
      for (const r of [...byRegion.keys()].sort((a, b) => a - b)) yield { kind, region: r, places: byRegion.get(r)?.length ?? 0 };
      return;
    }
    for (const b of bundles.values()) {
      if (kind === 'place') yield { kind, id: b.id, ...b.place };
      else if (kind === 'exterior' && b.exterior) yield { kind, place: b.id, w: b.exterior.w, h: b.exterior.h, blocks: [...b.exterior.blocks].map(nameOf) };
      else if (kind === 'dungeon' && b.dungeon) {
        const d = b.dungeon;
        yield { kind, place: b.id, start: d.start, blocks: [...d.blocks].map((w, i) => ({ name: nameOf(w), x: d.x[i], z: d.z[i] })) };
      } else if (kind === 'building') {
        for (let i = 0; i < b.buildings.type.length; i++) yield { kind, place: b.id, index: i, type: b.buildings.type[i], faction: b.buildings.faction[i], quality: b.buildings.quality[i] };
      } else if (kind === 'door') {
        for (let i = 0; i < b.doors.length; i++) yield { kind, place: b.id, index: i, building: b.doors[i] };
      }
    }
  }

  return {
    version: ATLAS_VERSION,
    add,
    /** A place's bundle by its map id, or null. @param {number} id */
    place: (id) => bundles.get(id >>> 0) ?? null,
    /** Every bundle, in the order added. */
    bundles: () => bundles.values(),
    parts,
    /** The bundles of a region (0..70, the registry's), in the order added. @param {number} r */
    inRegion: (r) => (byRegion.get(r) ?? NONE).map((id) => /** @type {Bundle} */ (bundles.get(id))),
    /** The map ids of the places that name a block, ascending. @param {string} name */
    usersOf(name) {
      const w = wordId.get(name) ?? wordId.get(resolve(name));
      return w === undefined ? [] : [.../** @type {Set<number>} */ (usersOfWord.get(w))].sort((a, b) => a - b);
    },
    /** The vocabulary: each block a bundle names, once. */
    words: () => words.map((w) => ({ ...w })),
    /** Of `names` (a block file's own list), the ones of `kind` no bundle names. @param {Iterable<string>} names @param {'rmb'|'rdb'} kind */
    unused: (names, kind) => [...names].filter((n) => blockKindOf(n) === kind && !wordId.has(n)),
    /** What did not resolve, and what resolved under another name. */
    problems: () => problems.slice(),
    /** The atlas's sizes. */
    counts() {
      let buildings = 0, doors = 0, dungeons = 0, exteriorSlots = 0, dungeonSlots = 0;
      for (const b of bundles.values()) {
        buildings += b.buildings.type.length; doors += b.doors.length;
        if (b.exterior) exteriorSlots += b.exterior.blocks.length;
        if (b.dungeon) { dungeons++; dungeonSlots += b.dungeon.blocks.length; }
      }
      const rmb = words.filter((w) => w.kind === 'rmb').length, rdb = words.length - rmb;
      return { places: bundles.size, buildings, doors, dungeons, exteriorSlots, rmb, dungeonSlots, rdb, regions: byRegion.size };
    },
  };
}

/**
 * The places of a registry into an atlas: each listed place with the location `locate` answers for it. A place no
 * location answers is counted, not bundled.
 * @param {Atlas} atlas @param {Iterable<WorldPlace>} places @param {(place: WorldPlace) => any} locate
 * @returns {{ added: number, unlocated: number[] }}
 */
export function fillAtlas(atlas, places, locate) {
  let added = 0;
  /** @type {number[]} */ const unlocated = [];
  for (const p of places) {
    const loc = locate(p);
    if (!loc) { unlocated.push(p.mapId); continue; }
    atlas.add(p, loc);
    added++;
  }
  return { added, unlocated };
}

/**
 * @typedef {{ w: number, h: number, blocks: Int32Array }} Exterior - `blocks` the vocabulary's ids, row-major; -1 unresolved
 * @typedef {{ blocks: Int32Array, x: Int16Array, z: Int16Array, start: number }} Dungeon - `start` the starting block's
 *   index, -1 for none
 * @typedef {{ id: number, place: WorldPlace, exterior: Exterior|null, dungeon: Dungeon|null, buildings: Buildings,
 *   doors: Uint16Array }} Bundle - `doors` each exterior door's building index
 * @typedef {ReturnType<typeof createAtlas>} Atlas
 */
