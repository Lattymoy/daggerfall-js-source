// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE PORT SHIPS' BUILDS, KEPT.
//
// comeSailAwayModels.js builds each port ship's prefab from its bake (galleonPrefab, carrackPrefab, largeBoatPrefab:
// 20-100 ms each in node, 350 ms for the three inside one frame of a warm launch) once a process (AUDIT GN2-PF4's
// cache). The build reads the ship's bake, the mod prefabs it copies from and the place its components take in the
// table, all shipped with the build; so it is kept in the player's derived store as it was built (a structured clone:
// its typed arrays come back typed - 1.3-2.3 MB a ship, a few milliseconds to read) under:
//   - SHIP_BUILDS_VERSION, bumped by hand when a builder changes shape;
//   - the build (BUILD_TAG), so a release that changes a builder's code never reads an older answer;
//   - the ship, its bake's sha256 and a stamp over the bake's text and the mod prefabs it reads, and its base.

import { BUILD_TAG } from '../../buildTag.js';
import { textStamp } from '../firstVisit/firstVisitStore.js';

/** Bump when a port ship's builder (world/ships/*Model.js) changes shape. */
export const SHIP_BUILDS_VERSION = 1;

/** The key of one ship's build. @param {string} ship @param {string} sha256 @param {string} bake - the bake's JSON text
 *  @param {number} base @param {string} old - the mod prefabs it reads, as JSON text */
export const shipBuildKey = (ship, sha256, bake, base, old) => `fv-ship:v${SHIP_BUILDS_VERSION}:${ship}:${BUILD_TAG}:${sha256 ?? ''}:${base}:${textStamp(bake, old)}`;

/** A build as the builders answer it: its prefab tree, its components, its meshes' geometry and its animation. */
export function isShipBuild(v) {
  if (!v || typeof v !== 'object' || !v.prefab || typeof v.prefab !== 'object' || !Array.isArray(v.components)) return false;
  if (!v.meshes || typeof v.meshes !== 'object' || !v.animation || typeof v.animation !== 'object') return false;
  return Object.values(v.meshes).every((g) => g?.positions instanceof Float32Array && Number.isInteger(g.vertexCount));
}
