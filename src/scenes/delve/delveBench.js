// @ts-check
// DELVE II (DLV5, bible/03-World/Delve-II.md section 8): THE BENCH'S OWN PLACES (scenes/dungeon.js, `?dungeon=`).
// `?spawn=px,py` with `?dungeon=<a dungeon's name>`: that dungeon cloned onto the pixel as the world clones a spawn
// (world/spawnedDungeons.js; `?elite` an Elite one), so its curated block and its encounters stand as they will in the
// world. `?dungeon=lab`: the lab's draft (delve.html) - this browser's, or a shipped record's (`?lab=<id>`) - number 0,
// laid as the start with four borders of a real dungeon of its type round it. Null for any other ask.
import { synthesizeDungeonLocation, WORLD_SALT } from '../../world/spawnedDungeons.js';
import { dfMeshToModel } from '../../world/meshReader.js';
import { classicBillboardSize } from '../../world/rmbFlats.js';
import { CURATED_RECORDS, setCuratedDraft } from '../../world/dungeon/curatedRecords.js';
import { installCuratedBlocks } from '../../world/dungeon/curatedInstall.js';
import { labDraftOf, labLocation, labBorders, labRound, LAB_DRAFT_KEY } from '../../world/dungeon/curatedLab.js';

export { LAB_DRAFT_KEY };
/** The lab's draft: a shipped record's (`?lab=<id>`), else this browser's kept one, else null. */
export function readLabDraft(params, storage) {
  const id = params.get('lab');
  if (id) { const rec = CURATED_RECORDS.find((r) => r.id === id); return rec ? labDraftOf(rec) : null; }
  try { const kept = storage?.getItem(LAB_DRAFT_KEY); return kept ? JSON.parse(kept) : null; } catch { return null; }
}
/** The first of the game's dungeons of `type` with border blocks to close a lab's block: its record and its look. */
export function labTemplate(maps, type) {
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
/** DLV6: where the lab stands me - `?at=x,y,z` (the spot its Rebuild left me on), else the draft's first anchor's heart;
 *  null leaves it to the dungeon's start (a base holds no start marker of its own). */
export function labSpawn(params, draft) {
  const at = String(params.get('at') ?? '').split(',').map(Number);
  if (at.length === 3 && at.every(Number.isFinite)) return at;
  const a = draft?.anchors?.[0]?.at;
  return a ? labRound([a[0], a[1] + 0.05, a[2]]) : null;
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
 * The bench's place for `params`, or null: `{ location, draft?, spawn? }`. A lab's draft the law refuses throws, by name.
 * @param {URLSearchParams} params @param {any} maps the bench's MapsFile @param {any} [storage]
 */
export function benchLocation(params, maps, storage = globalThis.localStorage) {
  const name = params.get('dungeon') ?? '', region = params.get('region') || 'Daggerfall';
  if (name === 'lab') {
    const draft = readLabDraft(params, storage);
    if (!draft) throw new Error('the lab holds no draft: open delve.html first');
    const why = setCuratedDraft(draft);
    if (why) throw new Error(`the lab's draft: ${why}`);
    const template = labTemplate(maps, draft.types[0]);
    if (!template) throw new Error(`the lab's draft: no dungeon of type ${draft.types[0]} to borrow borders from`);
    installCuratedBlocks([draft]);
    return { location: labLocation(draft, template), draft, spawn: labSpawn(params, draft) };
  }
  if (params.has('spawn')) {
    const [px, py] = String(params.get('spawn')).split(',').map(Number);
    const template = maps.getLocationByName(region, name);
    if (!template || !Number.isInteger(px) || !Number.isInteger(py)) return null;
    return { location: synthesizeDungeonLocation(template, { salt: WORLD_SALT, px, py, elite: params.has('elite') }) };
  }
  return null;
}
