// DEX2 (2026-10-20, bible/04-Characters/Enemy-Expansion.md section 6) - THE MOBILE'S RENDERER, SetupDemoEnemy.cs:129-151:
// a Spectral enemy wears the ghost shader (its cutoff 0.1, its alpha blended - render/renderer.js ghostShaded), and a row's
// NoShadow casts none. The port drew the ghost by the classic ghosts' archives (TextureFile.isSpectralArchive), which a
// mod's spectral enemy - drawn from an archive of its own - never matched; the row's behaviour is DFU's test, and the
// classic Ghost and Wraith are the only Spectral rows, on exactly those archives. A mod may lay the shader on a
// non-spectral enemy (registerFoeGhost - Daggerfall Enemy Expansion's Transparent, BestiaryMod.cs:1394-1402).
// GlowColor's LightAura is not here: its light's range and intensity are the prefab's, not yet read (Port-Ledger C).
// A LEAF beside the table it reads.
import { ENEMY_BASICS } from './enemyBasics.js';

const _ghosts = [];
/** A mod's word that `mobileType` wears the ghost shader though its row is not Spectral: `fn(mobileType)` true. */
export function registerFoeGhost(fn) {
  if (typeof fn !== 'function') throw new Error('registerFoeGhost: a function of (mobileType)');
  _ghosts.push(fn);
}
/** The test seam. */
export function _resetFoeGhosts() { _ghosts.length = 0; }

/** Whether `mobileType` wears the ghost shader: a Spectral row, or a mod's word. */
export const foeWearsGhost = (mobileType, row = ENEMY_BASICS[mobileType]) => row?.behaviour === 'Spectral' || _ghosts.some((fn) => fn(mobileType) === true);

/** The mobile's batch dressed as SetupDemoEnemy dresses its MeshRenderer - answers the batch, so a host wraps its
 *  createBillboardBatch in it and grows nothing. */
export function setupFoeLook(batch, mobileType, row = ENEMY_BASICS[mobileType]) {
  if (!batch) return batch;
  if (foeWearsGhost(mobileType, row)) batch.ghost = true;
  if (row?.noShadow === true) batch.noShadow = true;
  return batch;
}
