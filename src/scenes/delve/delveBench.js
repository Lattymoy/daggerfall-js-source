// @ts-check
// DELVE II (DLV5, bible/03-World/Delve-II.md section 8): THE BENCH'S OWN PLACES (scenes/dungeon.js, `?dungeon=`).
// `?spawn=px,py` with `?dungeon=<a dungeon's name>`: that dungeon cloned onto the pixel as the world clones a spawn
// (world/spawnedDungeons.js; `?elite` an Elite one) and built as the world builds it (its size, its curated block - `?online`
// the online world's), so its encounters stand as they will there. `?dungeon=lab`: the lab's draft (delve.html) - a
// shipped record's (`?lab=<id>`), a kept one (`?draft=<id>`) or the open one - number 0, laid with four borders of a real
// dungeon of its type round it. Null for any other ask.
import { synthesizeDungeonLocation, WORLD_SALT } from '../../world/spawnedDungeons.js';
import { dungeonLocationFor } from '../../world/smallerDungeons.js';
import { dfMeshToModel } from '../../world/meshReader.js';
import { classicBillboardSize } from '../../world/rmbFlats.js';
import { CURATED_RECORDS, setCuratedDraft } from '../../world/dungeon/curatedRecords.js';
import { installCuratedBlocks } from '../../world/dungeon/curatedInstall.js';
import { labDraftOf, labLocation, labBorders, labKept, labKeep } from '../../world/dungeon/curatedLab.js';
import { appStorage } from '../../systems/appStorage.js';

/** The lab's draft: a shipped record's (`?lab=<id>`), a kept one by its id (`?draft=<id>`), else the open one, else null. */
export function readLabDraft(params, storage) {
  const id = params.get('lab');
  if (id) {
    const rec = CURATED_RECORDS.find((r) => r.id === id);
    return rec ? labDraftOf(rec) : null;
  }
  const { drafts, current } = labKept(storage);
  return drafts[params.get('draft') ?? current ?? ''] ?? null;
}
/** The first of the game's dungeons of `type` with border blocks to close a lab's block: its record and its look. */
export function labTemplate(maps, type) {
  // The lab borrows a real dungeon's border blocks and climate, and every dungeon type stands among MAPS.BSA's own.
  // BAY-OWN: the templates every lair past the Bay is cloned from too (world/tamrielDungeons.js)
  for (let r = 0; r < maps.regionCount; r++) {
    const reg = maps.getRegion(r);
    if (!reg) continue;
    for (let l = 0; l < Math.min(maps.baseLocationCount(r), reg.locationCount); l++) {
      const loc = maps.getLocation(r, l);
      if (loc?.hasDungeon && loc.mapTableData?.dungeonType === type && labBorders(loc).length) return loc;
    }
  }
  return null;
}
/** DLV6: where the lab stands me - `?at=x,y,z`, the spot its Rebuild left me on; null leaves it to the host's floor by
 *  the first encounter, outside its ward (scenes/delve/delveHost.js firstFloor - its heart would wake it at the boot). */
export function labSpawn(params) {
  const raw = String(params.get('at') ?? '').split(',');
  return raw.length === 3 && raw.every((v) => v.trim() !== '' && Number.isFinite(Number(v))) ? raw.map(Number) : null; // an empty field is no 0
}
/** DLV6: where the bench stands me in its lab - its `?at` spot, else the host's floor by the first encounter; null off
 *  the lab, the game's own spawn (scenes/dungeon.js). @param {any} bench benchLocation's @param {any} delve the host */
export const labStand = (bench, delve) => (bench?.draft ? (bench.spawn ?? delve?.firstFloor?.() ?? null) : null);
/**
 * DLV5-6: the lab's panel over the bench (scenes/delve/delveLab.js, loaded for a lab alone): a Rebuild keeps the draft
 * and lays it again where I stand; one the law refuses, or no storage, is said and never laid (AUDIT DLV5-6 M6).
 * @param {any} bench @param {{ feet: () => number[], delve: () => any, foot: (item: any) => Promise<number | null>, storage?: any, go?: (q: string) => void, doc?: any }} o
 */
export function mountLabPanel(
  bench,
  {
    feet,
    delve,
    foot,
    storage = appStorage(),
    go = (q) => {
      globalThis.location.search = q;
    },
    doc,
  },
) {
  if (!bench?.draft) return null;
  const rebuild = (d, at) => {
    const why = labKeep(storage, d);
    if (!why) go(`?dungeon=lab&draft=${encodeURIComponent(d.id)}&class=1&novideo&at=${at.join(',')}`);
    return why;
  };
  return import('./delveLab.js').then(({ mountDelveLab }) =>
    mountDelveLab({
      draft: bench.draft,
      feet,
      landing: (at, r) => delve()?.landing(at, r) ?? { ok: false, rule: 'none' },
      foot,
      rebuild,
      ...(doc ? { doc } : {}),
    }),
  );
}
/**
 * DLV6: how far a thing's origin stands over its foot (m), so the lab sets it ON the floor at my feet - a model's lowest
 * point under its origin (as it stands unturned), a flat's half height (an RDB flat's y is its centre:
 * scenes/dungeonContext.js stands it down half a height). Null for a model or a flat the player's data lacks.
 * @param {any} arch the bench's ARCH3D @param {(archive: number) => Promise<any>} getTexture the pipeline's
 */
export function labFoot(arch, getTexture) {
  return async (item) => {
    if (item.model !== undefined) {
      const k = arch?.getRecordIndex(item.model) ?? -1;
      if (k < 0) return null;
      const p = dfMeshToModel(arch.getMesh(k), () => ({ width: 1, height: 1 })).positions;
      let lo = Infinity;
      for (let i = 1; i < p.length; i += 3) lo = Math.min(lo, p[i]);
      return Number.isFinite(lo) ? -lo : null;
    }
    if (item.flat) {
      const t = await getTexture(item.flat[0]);
      return t && item.flat[1] < (t.recordCount ?? 0) ? classicBillboardSize(t, item.flat[1]).h / 2 : null;
    }
    return 0;
  };
}
/**
 * The bench's place for `params`, or null: `{ location, draft?, spawn? }`. A lab's draft the law refuses throws, by name,
 * as does one whose base the player's BLOCKS.BSA lacks (`blocks`, the bench's).
 * @param {URLSearchParams} params @param {any} maps the bench's MapsFile @param {any} [storage] @param {any} [blocks]
 */
export function benchLocation(params, maps, storage = appStorage(), blocks = null) {
  const name = params.get('dungeon') ?? '',
    region = params.get('region') || 'Daggerfall';
  if (name === 'lab') {
    const draft = readLabDraft(params, storage);
    if (!draft) throw new Error('the lab holds no draft: open delve.html first');
    const why =
      setCuratedDraft(draft) ??
      (blocks && blocks.getBlockIndex(draft.base) === -1 ? `base: ${draft.base} is not in your BLOCKS.BSA` : null);
    if (why) throw new Error(`the lab's draft: ${why}`);
    const template = labTemplate(maps, draft.types[0]);
    if (!template) throw new Error(`the lab's draft: no dungeon of type ${draft.types[0]} to borrow borders from`);
    installCuratedBlocks([draft]);
    return { location: labLocation(draft, template), draft, spawn: labSpawn(params) };
  }
  if (params.has('spawn')) {
    const [px, py] = String(params.get('spawn')).split(',').map(Number);
    const template = maps.getLocationByName(region, name);
    if (!template || !Number.isInteger(px) || !Number.isInteger(py)) return null;
    const clone = synthesizeDungeonLocation(template, { salt: WORLD_SALT, px, py, elite: params.has('elite') });
    return { location: dungeonLocationFor(clone, { online: params.has('online') }) }; // AUDIT DLV5-6: built as the world builds it
  }
  return null;
}
