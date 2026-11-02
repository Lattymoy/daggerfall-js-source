// FIRST-VISIT (bible/07-Rendering/Performance-Priority.md FIRST-VISIT): THE PORT SHIPS' BUILDS, KEPT.
// comeSailAwayModels.js builds each port ship's prefab from its bake (20-100 ms each in node, 350 ms for the three in one
// frame of a warm launch). The build reads only files shipped with the build, so it is kept in the derived store as built
// (a structured clone, typed arrays intact, 1.3-2.3 MB a ship). The key holds:
//   - the scope `fv-ship:<ship>:` (one build a ship, a new one sweeps the last);
//   - firstVisitPin('shipBuilds'), the pin of the builders' code (tools/computationPin.mjs);
//   - the bake's sha256, and a stamp over the bake's text, the mod prefabs it reads and its base.

import { textStamp, firstVisitPin } from '../firstVisit/firstVisitStore.js';

/** One ship's scope: its one kept build. */
export const shipBuildScope = (ship) => `fv-ship:${ship}:`;

/** The key of one ship's build. @param {string} ship @param {string} sha256 @param {string} bake - the bake's JSON text
 *  @param {number} base @param {string} old - the mod prefabs it reads, as JSON text */
export const shipBuildKey = (ship, sha256, bake, base, old) =>
  `${shipBuildScope(ship)}${firstVisitPin('shipBuilds')}:${sha256 ?? ''}:${base}:${textStamp(bake, old)}`;

/** A build as the builders answer it: its prefab tree, its components, its meshes' geometry and its animation. */
export function isShipBuild(v) {
  if (!v || typeof v !== 'object' || !v.prefab || typeof v.prefab !== 'object' || !Array.isArray(v.components))
    return false;
  if (!v.meshes || typeof v.meshes !== 'object' || !v.animation || typeof v.animation !== 'object') return false;
  return Object.values(v.meshes).every((g) => g?.positions instanceof Float32Array && Number.isInteger(g.vertexCount));
}
