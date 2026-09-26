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

import { collectDecor, decorCatalogue } from './decorCatalogue.js';

/** How many town blocks one step reads. */
export const DECOR_SCAN_BLOCKS_A_STEP = 8;
/** How many models one step measures. */
export const DECOR_SCAN_MODELS_A_STEP = 32;

/**
 * THE SCAN. `deps`:
 *   blocks       - { count, getBlockType(i), getBlock(i) } (formats/blocksFile.js)
 *   isTownBlock(type) - whether a block type is a town block (BLOCK_TYPES.Rmb)
 *   modelRadius(id)   - a model's radius in metres, or null
 *   flatRadius(archive, record) - a Promise of a flat's radius in metres (half its billboard's diagonal), or null
 */
export function createDecorScan({ blocks, isTownBlock, modelRadius, flatRadius }) {
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

  const keep = (key, r) => { if (Number.isFinite(r) && r > 0) radii.set(key, r); };

  function readBlocks(n) {
    const end = Math.min(total, next + n);
    for (; next < end; next++) {
      try {
        if (!isTownBlock(blocks.getBlockType(next))) continue;
        const b = blocks.getBlock(next);
        if (b) collectDecor([b], collected);
      } catch { /* a block the file cannot read is a block with nothing in it */ }
    }
    if (next >= total) {
      entries = decorCatalogue(collected);
      models = entries.filter((e) => e.model != null);
      phase = 'models';
    }
  }

  function measureModels(n) {
    const end = Math.min(models.length, measured + n);
    for (; measured < end; measured++) {
      const e = models[measured];
      try { keep(e.key, modelRadius(e.model)); } catch { /* unmeasured: no price */ }
    }
    if (measured >= models.length) {
      phase = 'flats';
      const flats = (entries ?? []).filter((e) => e.flat);
      Promise.all(flats.map((e) => Promise.resolve()
        .then(() => flatRadius(e.flat[0], e.flat[1]))
        .then((r) => keep(e.key, r), () => {})))
        .then(() => { phase = 'done'; });
    }
  }

  /**
   * ONE STEP of the host's. Answers whether the scan is done.
   * @param {{ blocksPerStep?: number, modelsPerStep?: number }} [opts]
   */
  function step({ blocksPerStep = DECOR_SCAN_BLOCKS_A_STEP, modelsPerStep = DECOR_SCAN_MODELS_A_STEP } = {}) {
    if (phase === 'blocks') readBlocks(blocksPerStep);
    else if (phase === 'models') measureModels(modelsPerStep);
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
  };
}
