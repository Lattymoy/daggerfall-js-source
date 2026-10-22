// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW-HITCH (2026-10-21, the owner: "Theres still a lot of hitching in the overworld. Can you please fix this properly")
// - THE GROUND SETS OF THE STREAMING WORLD, a module the world host wires (HOST-SPLIT, bible/01-Overview/Host-Split.md:
// scenes/fishHost.js is the shape) - moved here whole from bootWorld (R9's one home of a ground archive's tile set, for
// the build and ECOTONE1's neighbours alike), with what it does now said in it.
//
// A journey meets a ground set at every climate and season it reaches - on the snow lane (PRECIP4) its winter twin with
// it - and the set was made inside the build in one go: the classic records' puddles and shores marked, a texture mod's
// set (Vanilla Enhanced, worn by default: 256 texels a record) given their shapes and its own shores marked, the twin
// joined, all of it uploaded with its mips. A fifth of a second to half a second of one task, at a climate's edge,
// twice on the snow lane: the BOOT-FREEZE record's "a ground set's puddle masks, 0.5-1.1 s ... again when the stream
// meets a new climate or season". Now:
//   - the marks run a record at a time through the build's breather (world/puddleMask.js `...Steps`, `stepsBreathing`):
//     the frame is given back once a slice is spent, a microtask before - the same bytes in the same order;
//   - the upload goes up a few layers a breath (renderer.js uploadTileArraySteps), the set registered only once whole;
//   - one load a set at a time (`_loading`): a second build asking for a set on its way waits for it, never makes it
//     again (the upload's breaths are where a second could have started);
//   - the classic puddles are marked once a set: the grass's own mask (`groundPuddles`) is the one the layers were
//     marked with, where it had been marked a second time from the same records.
// What it makes is what it made.
// ═══════════════════════════════════════════════════════════════════
import { dfmodGroundLayers } from '../systems/dfmodTextures.js';   // GROUND1: an attached mod's terrain tile set
import { grassRecordsOf, floorRecordsOf, tileMeanColour } from '../render/labGrass.js';
import { markPuddleWaterSteps, carryPuddleMaskSteps, stepsBreathing } from '../world/puddleMask.js';   // WATER-PUDDLE: the puddle is the art's
import { twinKey, twinLayers } from './snowCoverHost.js';   // PRECIP4

/**
 * @param {{ renderer: any, getTexture: (archive: number) => Promise<any>, labGrass: any, breathe: () => Promise<void>,
 *   grassRecords: Map<number, any>, floorRecords: Map<number, any>, groundPuddles: Map<number, any>,
 *   groundMeanColour: Map<number, any>, groundDrawnMeans: Map<number, any> }} deps
 *   `breathe` the stream's breather (world.js `breather.breathe()`); the five maps the world host's grass and water read
 *   (archive -> its grass records, its floor's, its puddles' layers, its records' mean colours, and the drawn mod set's
 *   means), written here as the build learns them
 */
export function createGroundSets({ renderer, getTexture, labGrass, breathe, grassRecords, floorRecords, groundPuddles, groundMeanColour, groundDrawnMeans }) {
  /** A ground archive's layers as they are drawn (a texture mod's set first, GROUND1/VE2: TextureReader.GetTerrainTextureArray),
   *  puddles marked (WATER-PUDDLE: a puddle record's water in its layer's alpha; GROUND1-W: a mod's set takes their shapes
   *  from the classic records) - `modLayers` the mod's own, null for none. OW-HITCH: marked a record a breath, and the
   *  classic marks kept as the grass's own (`groundPuddles`). */
  const groundLayersOf = async (archive, tex) => {
    const modLayers = await dfmodGroundLayers(archive, tex), classic = [];
    for (let r = 0; r < tex.recordCount; r++) classic.push(tex.getColor32(tex.getDFBitmap(r, 0), 0));
    const marked = await stepsBreathing(markPuddleWaterSteps(classic), breathe);
    if (!groundPuddles.has(archive)) groundPuddles.set(archive, marked);   // WATER-PUDDLE: the blades ask the mask the pass draws by
    return { modLayers, layers: modLayers ? await stepsBreathing(carryPuddleMaskSteps(modLayers, marked), breathe) : marked };
  };
  /** OW-HITCH: the sets on their way, by tile-array key - one load a set. */
  const _loading = new Map();
  /** A set's layers made and uploaded (its twin's, `winter`, with it), its grass means kept - once a key. */
  const makeSet = async (key, groundArchive, groundTex, winter) => {
    const own = await groundLayersOf(groundArchive, groundTex);
    const layers = winter == null ? own.layers : twinLayers(own.layers, (await groundLayersOf(winter, await getTexture(winter))).layers);
    await stepsBreathing(renderer.uploadTileArraySteps(key, layers), breathe);   // OW-HITCH: a few layers a breath
    // AUDIT GRASS-LIT2 B2: the grass's colours off THESE layers - the ones drawn - and not a second ask of the mod
    // door, whose cache a mod indexed mid-session empties (another decode, maybe another mod's tiles than these)
    if (labGrass) groundDrawnMeans.set(groundArchive, own.modLayers ? own.modLayers.map(tileMeanColour) : null);
  };
  const loadGroundSet = async (groundArchive, hold, winter = null) => {
    // AUDIT PRECIP GROUND-2: on the snow lane a set that wears a winter IS its twin - one array, its summer records then its
    // winter ones (scenes/snowCoverHost.js twinLayers), held and uploaded once: never the two sets and a copy of both
    const key = winter == null ? groundArchive : twinKey(groundArchive);
    hold.tileArray(key); const groundTex = await getTexture(groundArchive);   // FIELD BUGS 2026-10-04d PLACE-LRU: held BEFORE the cache is asked, so no sweep in the await frees what this pixel will draw
    if (!renderer.tileArrays.has(key)) {
      let loading = _loading.get(key);
      if (!loading) {
        loading = makeSet(key, groundArchive, groundTex, winter).finally(() => _loading.delete(key));
        _loading.set(key, loading);
      }
      await loading;
    }
    renderer.applyGroundSharpness();   // GRAIN AUDIT 1: the ground-sharpness tier lands on THIS load, on every cached archive - the cache outlives the scene
    // GR1: which of this archive's records are GRASS, from its own texels -
    // roads excluded by record, and a winter archive has no green base so
    // it yields none. AUDIT 49 F3: learned whenever MISSING, not only on a
    // tile-cache miss - the tile array cache lives on the renderer and
    // outlives this scene, so an archive the exterior host had uploaded
    // came back here cached, skipped the block above, and grew no grass.
    // GRASS-LIT2: the tile set that is DRAWN - an attached texture mod's (GROUND1, the cached promise the upload above
    // asked) - is what the grass's colour is taken off; asked BEFORE the three below are learned, so all three land in
    // one step and no pixel places a field against records whose colours are still on their way
    // AUDIT GRASS-LIT2 B2: the means taken at the upload above when it ran in this scene; asked of the door only for a
    // tile array an earlier scene uploaded (the renderer's cache outlives the scene)
    const drawnMeans = grassRecords.has(groundArchive) ? null
      : groundDrawnMeans.has(groundArchive) ? groundDrawnMeans.get(groundArchive)
      : (await dfmodGroundLayers(groundArchive, groundTex))?.map(tileMeanColour) ?? null;
    // OW-HITCH: a set an earlier scene uploaded has its puddles marked here, a record a breath, before the three below
    // land in one step (the mask the pass draws by: the classic records', as groundLayersOf marks them)
    if (!grassRecords.has(groundArchive) && !groundPuddles.has(groundArchive)) {
      const classic = [];
      for (let r = 0; r < groundTex.recordCount; r++) classic.push(groundTex.getColor32(groundTex.getDFBitmap(r, 0), 0));
      const marked = await stepsBreathing(markPuddleWaterSteps(classic), breathe);
      if (!groundPuddles.has(groundArchive)) groundPuddles.set(groundArchive, marked);
    }
    if (!grassRecords.has(groundArchive)) {
      const layers = [];
      for (let r = 0; r < groundTex.recordCount; r++) layers.push(groundTex.getColor32(groundTex.getDFBitmap(r, 0), 0));
      grassRecords.set(groundArchive, grassRecordsOf(layers)); floorRecords.set(groundArchive, floorRecordsOf(layers));   // BANTHA2: the floor's beside the meadow's
      // GR4: each record's MEAN colour, for the grass root that stands on
      // it - averaged once, rather than sampled per blade. AUDIT 68 S17:
      // learned here, beside grassRecords (the tile cache outlives the
      // scene), and off the color32's texels - it read the object's length.
      // GRASS-LIT2: off the mod's tile where one dresses the archive - the
      // ground a blade stands in is the one drawn. Which records are grass
      // stays the classic file's question: a record means the same tile
      // under any picture of it.
      groundMeanColour.set(groundArchive, drawnMeans ?? layers.map(tileMeanColour));
    }
  };
  return { groundLayersOf, loadGroundSet, get loading() { return _loading.size; } };
}
