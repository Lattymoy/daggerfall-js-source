// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR1d (2026-09-25) — THE CATALOGUE, READ OUT OF THE GAME'S OWN
// BLOCKS A FEW AT A TIME.
//
// Mac: the catalogue is "Everything Daggerfall furnishes" and the panel
// "an intuitive scrolling menu with filters", priced "By size". What a
// piece IS comes from BLOCKS.BSA's town blocks (systems/decorCatalogue.js
// collectDecor - every building interior's props and flats); what it
// COSTS comes from how big it is, which only the game data can say. So
// the catalogue is read, not shipped, and it is read in steps the host
// takes between frames: all of BLOCKS.BSA at once is hundreds of blocks
// to parse, and a hitch that long the moment the panel opens is exactly
// what a panel must never cost.
//
// DECOR-DUNGEON (FIELD BUGS 2026-10-05b): and the dungeon blocks, where the
// host says which they are (`isDungeonBlock`) - their furnishings
// (decorCatalogue.js collectDecor). DECOR-MODS (the same day): and the
// town mods' furnishings (systems/decorMods.js), a stand-in measured off its
// own model (an alias bed off its classic one) - AUDIT 05b A3: every one
// whatever is on (the offer asks the switch), and one that stands only
// after the scan measured it measured then (`remeasure`), so priced.
//
// THREE PHASES. 'blocks': a few town blocks a step (the file keeps one
// parsed block at a time - BlocksFile's autoDiscard - so a step never
// holds more than it reads), counted into one Map; when the last block
// is read the catalogue stands, named and ordered, and the panel can
// list it. 'models': each model's radius (the ARCH3D header's, as the
// bank's house price reads it - worldModes.js houseMeshRadius), a few a
// step. 'flats': each flat's billboard, sized as the room stands it
// (rmbFlats.js billboardSize), its archive loaded once - asynchronous,
// so the step waits for it. Then 'done'. A piece whose size cannot be
// read (a record the game data lacks) has none, and the panel does not
// offer it for sale: a price is never guessed.
// ═══════════════════════════════════════════════════════════════════

import { collectDecor, decorCatalogue, addDecorNature, HALL_BOARD_ENTRY } from './decorCatalogue.js';
import { addDecorMods } from './decorMods.js';   // DECOR-MODS: the town mods' furnishings
import { customModelFor, customModelNeeds, classicModelIdOf } from '../world/customModels.js';   // DECOR-MODS: a stand-in's own size
import { BLOCK_TYPES } from '../formats/blocksFile.js';   // DECOR-DUNGEON: the host's deps, built once (decorScanDeps)
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { billboardSize } from '../world/rmbFlats.js';

/**
 * DECOR-DUNGEON: THE HOSTS' SCAN DEPS, ONE CONSTRUCTOR. The interior host (worldModes.js) and the yards (world.js) each
 * built theirs by hand, so what the scan grows - the dungeons, here - had to be remembered twice (THE ONE CONSTRUCTION
 * SEAM). `blocks` the host's BlocksFile; `arch` its ARCH3D - a model's radius off its header, as the house price reads it
 * (worldModes.js houseMeshRadius), in metres; `getTexture` its texture door - a flat's billboard as the room stands it,
 * half its diagonal.
 * @param {{ blocks: any, arch: any, getTexture: (archive: number) => any }} host
 */
export function decorScanDeps({ blocks, arch, getTexture }) {
  return {
    blocks,
    isTownBlock: (t) => t === BLOCK_TYPES.Rmb,
    isDungeonBlock: (t) => t === BLOCK_TYPES.Rdb,
    nature: true,   // DECOR-OUTDOOR: a yard's trees and plants, its own climate's
    mods: true,   // DECOR-MODS: the town mods' furnishings (offered while the port stands them)
    modelRadius: (id) => {
      const rec = arch?.getRecordIndex?.(classicModelIdOf(id));   // DECOR-MODS: an alias (a coloured bed) is its classic model's size
      if (rec != null && rec >= 0) {
        const r = arch.getMesh(rec)?.radius ?? 0;
        return r > 0 ? r * GLOBAL_SCALE : null;
      }
      return standInRadius(id);
    },
    flatRadius: async (a, r) => {
      const t = await getTexture(a);
      if (!t || !(r < t.recordCount)) return null;
      const size = billboardSize(t, r);
      return Math.hypot(size.w, size.h) / 2;
    },
  };
}

/** DECOR-MODS: a stand-in the port builds - its farthest point from its origin, metres (the ARCH3D header's sphere, for a
 *  model no ARCH3D carries) - or null: none registered or on, or one built over the player's own models (a build that
 *  needs them is the pipeline's, never the scan's). */
export function standInRadius(id) {
  if (customModelNeeds(id).length) return null;
  const p = customModelFor(id)?.positions;
  if (!p?.length) return null;
  let r2 = 0;
  for (let i = 0; i + 2 < p.length; i += 3) r2 = Math.max(r2, p[i] * p[i] + p[i + 1] * p[i + 1] + p[i + 2] * p[i + 2]);
  return r2 > 0 ? Math.sqrt(r2) : null;
}

/** How many town blocks one step reads. */
export const DECOR_SCAN_BLOCKS_A_STEP = 8;
/** How many models one step measures. */
export const DECOR_SCAN_MODELS_A_STEP = 32;

/**
 * THE SCAN. `deps`:
 *   blocks       - { count, getBlockType(i), getBlock(i) } (formats/blocksFile.js)
 *   isTownBlock(type) - whether a block type is a town block (BLOCK_TYPES.Rmb)
 *   isDungeonBlock(type) - DECOR-DUNGEON: whether it is a dungeon block (BLOCK_TYPES.Rdb), read for its furnishings; none
 *                     reads none
 *   nature            - DECOR-OUTDOOR: whether the climates' nature sets join the catalogue (decorCatalogue.js
 *                     addDecorNature - a yard's trees and plants); the hosts' constructor says so
 *   mods              - DECOR-MODS: whether the town mods' furnishings join it (decorMods.js addDecorMods) - every one,
 *                     whatever is on (AUDIT 05b A3); the hosts' constructor says so
 *   modelRadius(id)   - a model's radius in metres, or null
 *   flatRadius(archive, record) - a Promise of a flat's radius in metres (half its billboard's diagonal), or null
 */
export function createDecorScan({ blocks, isTownBlock, isDungeonBlock = (_type) => false, nature = false, mods = false, modelRadius, flatRadius }) {
  /** @type {'blocks'|'models'|'flats'|'done'} */
  let phase = 'blocks';
  const total = Math.max(0, blocks?.count ?? 0);
  let next = 0;
  /** @type {Map<string, {model: number|null, flat: number[]|null, count: number}>} */
  const collected = new Map();
  /** @type {readonly any[]|null} */
  let entries = null;
  /** @type {any[]} */
  let models = [];
  let measured = 0;
  /** @type {Map<string, number>} */
  const radii = new Map();
  /** AUDIT 05b A3: the entries to measure again once the scan is done (`remeasure`), the flats still being measured, and
   *  how many have been measured since it was done (the panel lists again as each lands - its price) */
  const late = [];
  const measuring = new Set();
  let lateSized = 0;

  const keep = (key, r) => { if (Number.isFinite(r) && r > 0) { radii.set(key, r); if (phase === 'done') lateSized++; } };
  /** One entry measured - a model at once, a flat when its archive answers. */
  function measure(e) {
    if (e.model != null) { try { keep(e.key, modelRadius(e.model)); } catch { /* unmeasured: no price */ } return null; }
    measuring.add(e.key);
    return Promise.resolve().then(() => flatRadius(e.flat[0], e.flat[1])).then((r) => keep(e.key, r), () => {}).finally(() => measuring.delete(e.key));
  }

  function readBlocks(n) {
    const end = Math.min(total, next + n);
    for (; next < end; next++) {
      try {
        const type = blocks.getBlockType(next);
        if (!isTownBlock(type) && !isDungeonBlock(type)) continue;   // DECOR-DUNGEON: and a dungeon's furnishings
        // WD3: Daggerfall's blocks as BLOCKS.BSA holds them, never a world-data mod's through the door (Beautiful Villages
        // and Beautiful Cities redecorate 1,400 interiors; read here their pieces would renumber the catalogue) - DECOR-MODS:
        // the mods' furnishings join after every place of Daggerfall's instead (decorMods.js, measured), offered while they stand
        const b = blocks.readClassicBlock ? blocks.readClassicBlock(next) : blocks.getBlock(next);
        if (b) collectDecor([b], collected);
      } catch { /* a block the file cannot read is a block with nothing in it */ }
    }
    if (next >= total) {
      // GUILD1e: and the hall's board, which no room placed - measured and priced as every piece
      const read = nature ? addDecorNature(collected) : collected;   // DECOR-OUTDOOR: and the climates' nature
      entries = Object.freeze([...decorCatalogue(mods ? addDecorMods(read) : read), HALL_BOARD_ENTRY]);   // DECOR-MODS: and the town mods' furnishings
      models = entries.filter((e) => e.model != null);
      phase = 'models';
    }
  }

  function measureModels(n) {
    const end = Math.min(models.length, measured + n);
    for (; measured < end; measured++) measure(models[measured]);
    if (measured >= models.length) {
      phase = 'flats';
      Promise.all((entries ?? []).filter((e) => e.flat).map(measure)).then(() => { phase = 'done'; });
    }
  }
  /** AUDIT 05b A3: the entries asked again, a step's worth of models at a time (a stand-in measured off its model is
   *  that model built), each still unmeasured and not being measured. */
  function measureLate(n) {
    for (let k = 0; k < n && late.length;) {
      const e = late.shift();
      if (radii.has(e.key) || measuring.has(e.key)) continue;
      measure(e);
      if (e.model != null) k++;
    }
  }

  /**
   * ONE STEP of the host's. Answers whether the scan is done.
   * @param {{ blocksPerStep?: number, modelsPerStep?: number }} [opts]
   */
  function step({ blocksPerStep = DECOR_SCAN_BLOCKS_A_STEP, modelsPerStep = DECOR_SCAN_MODELS_A_STEP } = {}) {
    if (phase === 'blocks') readBlocks(blocksPerStep);
    else if (phase === 'models') measureModels(modelsPerStep);
    else if (phase === 'done') measureLate(modelsPerStep);
    return phase === 'done';
  }

  return {
    step,
    phase: () => phase,
    /** How far along, 0..1 - the blocks are most of it. */
    progress() {
      if (phase === 'done') return 1;
      if (phase === 'blocks') return total ? 0.8 * (next / total) : 0;
      if (phase === 'models') return 0.8 + 0.15 * (models.length ? measured / models.length : 1);
      return 0.95;
    },
    /** The catalogue (decorCatalogue's frozen entries) once the blocks are read, else null. */
    entries: () => entries,
    /** An entry's radius in metres once measured, else null - the panel's price and size band. */
    radiusOf: (entry) => (entry ? radii.get(entry.key) ?? null : null),
    /** AUDIT 05b A3: how many entries were measured after the scan was done (`remeasure`). */
    lateSized: () => lateSized,
    /**
     * AUDIT 05b A3: MEASURE AGAIN the entries of `keys` still unmeasured - a mod's piece the port stands only now (its
     * stand-in off, or its pack not yet landed, when the scan measured it: no size, so no price, so never offered) - in
     * the steps after the scan is done. The host asks when what stands changes, never every frame.
     * @param {Iterable<string>} keys
     */
    remeasure(keys) {
      const want = new Set(keys);
      for (const e of entries ?? []) if (want.has(e.key) && !radii.has(e.key)) late.push(e);
    },
  };
}
