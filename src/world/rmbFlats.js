// RMB flat (billboard) collection: misc block flats, exterior subrecord
// flats, and ground scenery. 1:1 with Daggerfall Unity's RMBLayout
// AddMiscBlockFlats / AddExteriorBlockFlats / AddNatureFlats and
// MeshReader.GetScaledBillboardSize (MIT, Daggerfall Workshop). Verbatim:
//   - blockFlatsOffsetY -6, natureFlatsOffsetY -2 (raw constants).
//   - Flat position = (XPos, -YPos + blockFlatsOffsetY, ZPos + 4096) * scale.
//   - Exterior subrecord flats offset by (subX, 0, -subZ) * scale with NO
//     subrecord rotation - DFU does not rotate exterior flats with the
//     building subrecord.
//   - Exterior flats in the nature archive range (500-511) swap to the
//     climate nature archive and then DFU assigns
//     billboardPosition.z = natureFlatsOffsetY (the raw -2, post-scale).
//     This looks like an upstream y/z typo but is kept verbatim for parity;
//     flagged in World-Arc.md.
//   - Ground scenery reads GroundScenery[x][15 - y], skips records < 1
//     (0 is a marker), places at (x*256, natureFlatsOffsetY, y*256+256)*scale
//     with the climate nature archive. HOUSE-BUSH (FIELD BUGS 2026-10-18f, a
//     departure from AddNatureFlats): a cell whose foot the block's own
//     automap draws inside a building is not stood (sceneryUnderRoof).
//   - Editor flats (archive 199) are two DIFFERENT laws. A SUBRECORD
//     exterior flat is never spawned at all (RMBLayout.cs:409-410's
//     `continue`). A MISC block flat IS spawned - AddMiscBlockFlats
//     (:340-379) skips only the lights archive - and it is the
//     BILLBOARD COMPONENT that hides it: MaterialReader.GetFlatType
//     maps archive 199 to FlatTypes.Editor (:980-981) and
//     DaggerfallBillboard.Start disables the mesh renderer for it
//     (:77-84, "Just disable mesh renderer as actual object can be
//     part of action chain"; StartGameBehaviour.cs:45
//     `ShowEditorFlats = false`). So the misc flat is carried here
//     with `editor: true` - the start markers, quest markers and
//     action chains read it - and the hosts refuse to DRAW it.
//   - Scaled billboard size: change = trunc(size * scale / 256) per axis,
//     final = (size + change) * GlobalScale. Billboards are bottom-anchored:
//     AlignToBase raises the centre by half the final height.
// Lights (archive 210) get their billboard here; the point-light component
// and NPC/faction metadata are later features (see World-Arc.md).

import { RMB_DIMENSION, SCALE_DIVISOR } from '../formats/blocksFile.js';
import { GLOBAL_SCALE } from './meshReader.js';
import { applyBillboardXml, billboardXmlScaleOf, billboardXmlGeneration } from './billboardXml.js';   // MM1: the xml scale registry (a leaf)
import { textureReplacementEnabled, hasTextureReplacement } from '../systems/textureReplacement.js';   // AUDIT MM1: DFU's two gates on the xml scale
import { flatFieldFor, sowField } from './flatFields.js';   // WD3: a scene model that is a field of flats (the town mods' crops)
import { PROPS_OFFSET_Y } from './rmbLayout.js';   // FIELD BUGS 2026-10-04d CROPS: a field's batch stands where its misc model does
import { quarterOf } from '../ui/town/townQuarters.js';   // HOUSE-BUSH: an automap byte's building, by the town map's own ladder

/** RMBLayout's blockFlatsOffsetY: a block's flats stand this far (native units) below their records - and their lights
 *  do not (AddLight hangs at the record's -YPos plus the picture's height - world/city/cityLights.js). AUDIT YARD-LIGHT: so a
 *  yard's lamp hangs the town's distance above its picture (scenes/homeYards.js yardLampOf). */
export const BLOCK_FLATS_OFFSET_Y = -6;
const NATURE_FLATS_OFFSET_Y = -2;
export const EDITOR_FLATS_ARCHIVE = 199;
export const LIGHTS_ARCHIVE = 210;
const NATURE_ARCHIVE_MIN = 500; // ClimateTextureSet.Nature_RainForest
const NATURE_ARCHIVE_MAX = 511; // ClimateTextureSet.Nature_Mountains_Snow
/** TREES-SEATED: an archive in the nature range - AddExteriorBlockFlats' own test (RMBLayout.cs:421, master), which swaps such a
 *  sub-record flat to the climate's archive. A MISC flat in the range keeps the archive it names (AddMiscBlockFlats,
 *  :326-380, swaps nothing), so a block's tree can be a nature archive that is not the pixel's. */
export const isNatureArchive = (archive) => archive >= NATURE_ARCHIVE_MIN && archive <= NATURE_ARCHIVE_MAX;
/** TREES-SEATED: where a nature flat stands on the location's plane - AddNatureFlats' `natureFlatsOffsetY`, scaled
 *  (the ground scenery's y below). */
export const NATURE_FLATS_Y = NATURE_FLATS_OFFSET_Y * GLOBAL_SCALE;

/** HOUSE-BUSH: an RMB block's automap is AUTOMAP_SIDE pixels a side, AUTOMAP_SIDE / 16 to a ground tile. */
const AUTOMAP_SIDE = 64, AUTOMAP_PER_TILE = AUTOMAP_SIDE / 16;
/**
 * HOUSE-BUSH (FIELD BUGS 2026-10-18f, æther on the Discord: "Small bush in a house wall, near east gate of Penwall
 * Derry"). WHETHER A GROUND-SCENERY CELL'S FOOT STANDS INSIDE A BUILDING, as the block's own automap draws it.
 *
 * AddNatureFlats (RMBLayout.cs, the walk below) stands every scenery record a block names and reads no building, so a
 * cell its author left under a house stands in the house - a billboard through its wall. Beautiful Cities' composite
 * blocks were made so: Penwall Derry's east gate (WALLAA09.TVRNAS01) stands its record 4 inside a House2, and the two
 * town packs between them hold 18 such cells (AUDIT FB1018f L4-1: 26 counted by the automap alone, 8 of them under
 * footprints no building of the block stands on). The author took the same class out by hand elsewhere (TVRNAL01's edit
 * sets two classic cells to -1, both on a House2). DFU stands them as written; the port does not (Port-Ledger A).
 *
 * The automap (FLD header, AUTOMAP_SIDE x AUTOMAP_SIDE, row 0 the block's north edge, a byte BuildingType + 1 where a
 * building's footprint covers it) is what the town map draws a building from, and its rows and columns are the
 * scenery's own: cell (x, y) of the walk stands its foot at (256x, 256y + 256) units, the corner of automap columns
 * 4x - 1 and 4x and rows 59 - 4y and 60 - 4y. INSIDE is all four of them architecture by the town map's ladder
 * (ui/town/townQuarters.js quarterOf - not street, a ground flat's mark, a ship or a special); a foot on a footprint's
 * edge or corner is left as authored, and so is one on the block's rim, whose far cells are the next block's.
 * AUDIT FB1018f L4-1: AND THE FOOTPRINT IS A BUILDING'S. Two Beautiful Villages blocks (TEMPBSE0, TEMPBSC0) draw houses
 * on their automaps that the blocks do not have, and their authors planted scenery on that open ground; a footprint no
 * subrecord of the block stands on is no roof (`held`, heldFootprints below). Without `held` nothing is taken.
 * @param {?ArrayLike<number>} autoMap the block's fldHeader.autoMapData
 * @param {number} x the walk's tile column (0 west)
 * @param {number} y the walk's tile row (0 south)
 * @param {?(i: number) => boolean} held whether automap index `i` lies in a footprint a building of the block stands on
 */
export function sceneryUnderRoof(autoMap, x, y, held) {
  if (!autoMap || autoMap.length < AUTOMAP_SIDE * AUTOMAP_SIDE || !held) return false;
  const col = AUTOMAP_PER_TILE * x, row = AUTOMAP_SIDE - AUTOMAP_PER_TILE * (y + 1);
  if (col < 1 || row < 1 || col >= AUTOMAP_SIDE || row >= AUTOMAP_SIDE) return false;
  for (const r of [row - 1, row]) for (const c of [col - 1, col]) if (quarterOf(autoMap[r * AUTOMAP_SIDE + c]) === null) return false;
  return held(row * AUTOMAP_SIDE + col);   // the four are one footprint: architecture, side by side
}

/**
 * HOUSE-BUSH (AUDIT FB1018f L4-1): THE FOOTPRINTS THE BLOCK'S OWN BUILDINGS STAND ON. A footprint is a 4-connected run
 * of architecture on the automap (quarterOf's ladder, as sceneryUnderRoof reads it); it is held when a subrecord's
 * origin falls in it - automap column xPos / 64, row zPos / 64, which puts 817 of Beautiful Cities' 884 buildings and 502
 * of Beautiful Villages' 557 on their own footprint. Answers the test sceneryUnderRoof takes, or null without an automap.
 * @param {?ArrayLike<number>} autoMap the block's fldHeader.autoMapData
 * @param {?Array<{xPos: number, zPos: number}>} subRecords the block's buildings
 * @returns {?(i: number) => boolean}
 */
export function heldFootprints(autoMap, subRecords) {
  if (!autoMap || autoMap.length < AUTOMAP_SIDE * AUTOMAP_SIDE) return null;
  const run = new Int32Array(AUTOMAP_SIDE * AUTOMAP_SIDE).fill(-1);
  let runs = 0;
  for (let i = 0; i < run.length; i++) {
    if (run[i] >= 0 || quarterOf(autoMap[i]) === null) continue;
    const open = [i];
    run[i] = runs;
    while (open.length) {
      const k = open.pop(), r = Math.floor(k / AUTOMAP_SIDE), c = k % AUTOMAP_SIDE;
      for (const [rr, cc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
        if (rr < 0 || cc < 0 || rr >= AUTOMAP_SIDE || cc >= AUTOMAP_SIDE) continue;
        const kk = rr * AUTOMAP_SIDE + cc;
        if (run[kk] < 0 && quarterOf(autoMap[kk]) !== null) { run[kk] = runs; open.push(kk); }
      }
    }
    runs++;
  }
  const held = new Set();
  for (const s of subRecords ?? []) {
    const c = Math.floor(s.xPos / 64), r = Math.floor(s.zPos / 64);
    if (r >= 0 && c >= 0 && r < AUTOMAP_SIDE && c < AUTOMAP_SIDE && run[r * AUTOMAP_SIDE + c] >= 0) held.add(run[r * AUTOMAP_SIDE + c]);
  }
  return (i) => run[i] >= 0 && held.has(run[i]);
}

/**
 * World-unit billboard size for a texture record, verbatim
 * GetScaledBillboardSize.
 * @param {{width:number,height:number}} size - record dimensions.
 * @param {{width:number,height:number}} scale - record scale fields.
 * @returns {{w:number,h:number}}
 */
/** MM1 / AUDIT MM1: the size a billboard of `t`'s record draws at -
 *  GetScaledBillboardSize over the record's own scale, then the xml
 *  scale a vendored mod registered for (archive, record), on DFU's TWO
 *  rules, which are not the same:
 *
 *  - A MOBILE UNIT (an enemy: DaggerfallMobileUnit.CacheRecordSizesAndFrames,
 *    :657-682; a street person: MobilePersonBillboard.cs:343) runs
 *    TextureReplacement.SetBillboardScale on every record, with or
 *    without a replacement texture - `mobileBillboardSize`.
 *  - A STATIC billboard (DaggerfallBillboard.SetMaterial, :252-258 - a
 *    flat, a corpse, a loot pile, spell art) reads the xml only INSIDE
 *    GetStaticBillboardMaterial's `if (LoadFromCacheOrImport(...))`
 *    (TextureReplacement.cs:504-519): no imported PNG for the record,
 *    no xml scale - `billboardSize`. So a mod that ships xml alone
 *    scales its monsters and not their corpses (Meaner Monsters' 96/0).
 *
 *  Both sit behind DaggerfallUnity.Settings.AssetInjection (SetBillboardScale
 *  :663-664, GetStaticBillboardMaterial :497-498) - the port's
 *  Enhancements/AssetInjection. `scaledBillboardSize` below stays the
 *  pure law, and a texture with no archive stamped takes no xml. */
/**
 * PERF-TOWN1 (2026-09-20, Mac: "the exterior is really heavy rn", and
 * the `?perf=cpu` line that answered it - `people` swinging 1.14 to
 * 7.36 ms a frame).
 *
 * THE TEXTURE'S OWN SIZE IS A FACT ABOUT THE FILE, and this recomputed
 * it for every person, every frame. `getSize` and `getScale` each mint
 * a record, `scaledBillboardSize` mints a third, and the arithmetic
 * between them cannot answer differently for the same texture and the
 * same record - a sprite does not change size while you watch it.
 *
 * Cached on the TEXTURE OBJECT rather than on its archive number, in a
 * WeakMap: a replacement that swaps the file in is a different object
 * and gets a different entry, so there is no staleness to invalidate
 * and no table to grow. Archive numbers would have needed both.
 *
 * The XML scale is read at every ask and deliberately: billboardXml
 * reads a LIVE predicate per registered vendor (its own `isOn`), so a
 * mod toggled in the settings menu has to be seen on the next frame. The
 * walk is the cheap half - one or two entries.
 *
 * AUDIT DEX B7: but the PRODUCT was minted at every ask - `applyBillboardXml`
 * answers a new `{ w, h }` (and `billboardXmlScale` a new `{ x, y }` under
 * it), two objects per foe per frame for every stand-in archive the xml
 * names (Daggerfall Enemy Expansion's every sprite), behind a door its
 * hosts read as "a shared, cached object". The xml-applied size is cached
 * beside the classic one now, per texture and record, and kept while the
 * same live table entry answers (its array, by identity - a switch turned
 * moves it) under the same registrations (billboardXmlGeneration - a table
 * registered again moves it).
 */
const _mobileSize = new WeakMap();   // texture -> size by record
const _mobileXml = new WeakMap();    // AUDIT DEX B7: texture -> by record { s, gen, size } - the xml-applied size

export function mobileBillboardSize(t, record) {
  let byRecord = _mobileSize.get(t);
  if (!byRecord) { byRecord = []; _mobileSize.set(t, byRecord); }
  let size = byRecord[record];
  if (!size) { size = scaledBillboardSize(t.getSize(record), t.getScale(record)); byRecord[record] = size; }
  // DEX2: and a stand-in's whatever the switch - a mod-only archive's pictures ARE the port's vendored art, drawn
  // ungated (systems/textureReplacement.js SURV2), so the xml that sizes them goes with them (Daggerfall Enemy
  // Expansion's riders at 1.3, its centurion at 0.7); DFU draws a mod's enemy only under AssetInjection, scale and all
  if (!(textureReplacementEnabled() || t?.vendor === true)) return size;
  const s = billboardXmlScaleOf(t?.archive, record);
  if (!s) return size;
  let byXml = _mobileXml.get(t);
  if (!byXml) { byXml = []; _mobileXml.set(t, byXml); }
  const gen = billboardXmlGeneration();
  let x = byXml[record];
  if (!x || x.s !== s || x.gen !== gen) { x = { s, gen, size: { w: size.w * s[0], h: size.h * s[1] } }; byXml[record] = x; }   // applyBillboardXml's product
  return x.size;
}
export function billboardSize(t, record) {
  const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
  return t?.archive != null && hasTextureReplacement(t.archive, record, 0) ? applyBillboardXml(t.archive, record, size) : size;
}
/**
 * DW-E2: MeshReader.GetScaledBillboardSize - the CLASSIC record's scaled
 * size, never an XML scale. Two readers want exactly that and no door
 * would answer it: a DaggerfallBillboardBatch standing a record with no
 * replacement (its atlas sizes are the TEXTURE file's), and Iliac Puddle
 * No More's placement, which reserves a record's classic height under the
 * surface whatever art stands there later (TryGetAuthoredDecorationVisualHeight).
 */
export function classicBillboardSize(t, record) {
  return scaledBillboardSize(t.getSize(record), t.getScale(record));
}

/**
 * FIELD-GUN20 (2026-09-21, Mac: "The orb projectile that fires is still
 * not aligned with coming out of the barrel"): THE BASE OF A CENTRED
 * BILLBOARD. The renderer bottom-anchors EVERY batch - its centre sits
 * half a height above the placement base - because that is
 * DaggerfallBillboard.AlignToBase (:410-416, `offset.y = Size.y / 2`)
 * baked in, and every flat a block places calls it. A MISSILE does not:
 * DaggerfallMissile.cs:601-602 creates the billboard at
 * `localPosition = Vector3.zero` on the missile's own transform, and
 * EnemyBlood.cs:32-35 sets the splash's `transform.position` to the hit
 * point - both are CENTRED on the position they are given. So a lane
 * that places one of those by its position hands the renderer this: the
 * position with half the billboard's height taken off, and the sprite's
 * centre lands where DFU's does.
 * @param {number[]} pos - where the sprite's CENTRE belongs
 * @param {{w:number,h:number}} size - billboardSize's answer for it
 * @returns {number[]} the placement base for createBillboardBatch
 */
export function centredBase(pos, size) {
  return [pos[0], pos[1] - (size?.h ?? 0) / 2, pos[2]];
}

export function scaledBillboardSize(size, scale) {
  const xChange = Math.trunc(size.width * (scale.width / SCALE_DIVISOR));
  const yChange = Math.trunc(size.height * (scale.height / SCALE_DIVISOR));
  return {
    w: (size.width + xChange) * GLOBAL_SCALE,
    h: (size.height + yChange) * GLOBAL_SCALE,
  };
}

/**
 * The block's misc flats alone - collectBlockFlats' first pass, its own export (HOLD-MONUMENT, 2026-10-14: the monument
 * outside Privateer's Hold reads the block's start markers off them, world/lefayMonument.js lefaySpotOf, with no
 * scenery sown and no climate asked).
 * @param {{rmbBlock: {miscFlatObjectRecords: any[]}}} dfBlock
 * @returns {Array<{archive:number,record:number,x:number,y:number,z:number,editor:boolean}>}
 */
export function collectMiscFlats(dfBlock) {
  const flats = [];
  for (const obj of dfBlock.rmbBlock.miscFlatObjectRecords) {
    flats.push({
      archive: obj.textureArchive,
      record: obj.textureRecord,
      // AUDIT 64 F12: stood as data, never drawn - DaggerfallBillboard
      // .cs:77-84 disables the renderer of a FlatTypes.Editor billboard
      // (MaterialReader.cs:980-981 maps archive 199 to Editor).
      editor: obj.textureArchive === EDITOR_FLATS_ARCHIVE,
      x: obj.xPos * GLOBAL_SCALE,
      y: (-obj.yPos + BLOCK_FLATS_OFFSET_Y) * GLOBAL_SCALE,
      z: (obj.zPos + RMB_DIMENSION) * GLOBAL_SCALE,
      // C2: StaticNPC inputs ride every flat (a non-zero factionID IS
      // an exterior NPC - RMBLayout verbatim); scenery carries zeros.
      factionID: obj.factionID, flags: obj.flags, recordPosition: obj.position,
      // ...and the RAW record triple, which is the other half of those
      // inputs: StaticNPC.SetLayoutData hashes the UNSCALED XPos/YPos/
      // ZPos (StaticNPC.cs:210/:333-336), never the scaled position.
      // Same field names collectInteriorPeople writes, so both people
      // paths hand the layout one record shape.
      rawX: obj.xPos, rawY: obj.yPos, rawZ: obj.zPos,
    });
  }
  return flats;
}

/**
 * Collect every flat of one RMB block as {archive, record, x, y, z} with the
 * position at the billboard BASE (AlignToBase handled by the renderer via
 * the scaled size).
 * @param {object} dfBlock - BlocksFile.getBlock output (type Rmb).
 * @param {number} natureArchive - climate nature archive
 *   (dfLocation.climate.natureArchive).
 * @param {{climateIndex?:?number, solid?:?Function}} [fields] - FIELD BUGS
 *   2026-10-04d CROPS: for a crop field's batch, the raw climate it reads and
 *   the block's solids it keeps a metre off (world/flatFields.js
 *   blockSolids); a caller with neither sows every plant of the climate's
 *   nature archive.
 * @returns {Array<{archive:number,record:number,x:number,y:number,z:number,
 *   editor?:boolean}>}
 */
export function collectBlockFlats(dfBlock, natureArchive, { climateIndex = null, solid = null } = {}) {
  const rmb = dfBlock.rmbBlock;
  const flats = [];

  // Misc block flats (lights included - AddLights uses the same position) - their own export (HOLD-MONUMENT).
  for (const f of collectMiscFlats(dfBlock)) flats.push(f);

  // WD3: a scene model that is a FIELD OF FLATS (world/flatFields.js - the RMB Resource Pack's crop batches, which
  // Beautiful Cities lays over its farmland): the plants it sows, the climate's, round the spot the block places it.
  // Asked with a nature archive only - the climate picks the plant (a caller reading markers passes none).
  // FIELD BUGS 2026-10-04d CROPS: the batch is the misc model's prefab, so it stands where RMBLayout.AddProps stands
  // the model - propsOffsetY under its record - and every plant's foot is there (CreateBillboard: the batch's own y).
  if (natureArchive >= NATURE_ARCHIVE_MIN && natureArchive <= NATURE_ARCHIVE_MAX) {
    for (const obj of rmb.misc3dObjectRecords ?? []) {
      const spec = flatFieldFor(obj.modelIdNum);
      if (!spec) continue;
      flats.push(...sowField(spec, natureArchive, obj.xPos * GLOBAL_SCALE, (-obj.yPos + PROPS_OFFSET_Y) * GLOBAL_SCALE, (obj.zPos + RMB_DIMENSION) * GLOBAL_SCALE, { climateIndex, solid }));
    }
  }

  // Exterior subrecord flats: unrotated subrecord offset, editor flats
  // skipped, nature range swapped to the climate archive.
  for (const subRecord of rmb.subRecords) {
    const subX = subRecord.xPos * GLOBAL_SCALE;
    const subZ = -subRecord.zPos * GLOBAL_SCALE;
    for (const obj of subRecord.exterior.blockFlatObjectRecords) {
      let archive = obj.textureArchive;
      if (archive === EDITOR_FLATS_ARCHIVE) continue;

      let x = obj.xPos * GLOBAL_SCALE + subX;
      let y = (-obj.yPos + BLOCK_FLATS_OFFSET_Y) * GLOBAL_SCALE;
      let z = (obj.zPos + RMB_DIMENSION) * GLOBAL_SCALE + subZ;

      if (archive >= NATURE_ARCHIVE_MIN && archive <= NATURE_ARCHIVE_MAX) {
        archive = natureArchive;
        // Verbatim DFU: billboardPosition.z = natureFlatsOffsetY (raw -2).
        z = NATURE_FLATS_OFFSET_Y;
      }

      flats.push({ archive, record: obj.textureRecord, x, y, z, factionID: obj.factionID, flags: obj.flags, recordPosition: obj.position, rawX: obj.xPos, rawY: obj.yPos, rawZ: obj.zPos });
    }
  }

  // Ground scenery -> climate nature flats.
  const scenery = rmb.fldHeader.groundData.groundScenery;
  const autoMap = rmb.fldHeader.autoMapData;   // HOUSE-BUSH
  const held = heldFootprints(autoMap, rmb.subRecords);   // AUDIT FB1018f L4-1: the footprints a building of the block stands on
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const item = scenery[x][15 - y];
      if (item.textureRecord < 1) continue;
      if (sceneryUnderRoof(autoMap, x, y, held)) continue;   // HOUSE-BUSH: a cell its author left under a house
      flats.push({
        archive: natureArchive,
        record: item.textureRecord,
        x: x * 256 * GLOBAL_SCALE,
        y: NATURE_FLATS_OFFSET_Y * GLOBAL_SCALE,
        z: (y * 256 + 256) * GLOBAL_SCALE,
      });
    }
  }

  return flats;
}
