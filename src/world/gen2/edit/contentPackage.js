// @ts-check
// WG2 CONTENT PACKAGES ("Packages"): an editor's document as a file a designer hands
// on - the manifest's versions it was made under, its region and the bake it edits, its layers - with a print over the
// lot, so a package that was changed on the way, or made against another bake or generator, is refused on import with
// the reason.
import { worldManifest, GENERATORS } from '../manifest.js';
import { canonicalJson } from '../../../formats/worldData/worldDataJson.js';
import { opProblems } from './editLayers.js';
import { fnv1a } from '../../../formats/fnv1a.js';

export const PACKAGE_FORMAT = 1;
const print = (o) => fnv1a(new TextEncoder().encode(canonicalJson(o))).toString(16).padStart(8, '0');

/** The package of a document. @param {import('./editLayers.js').EditDoc} doc */
export function exportPackage(doc) {
  const m = worldManifest(), body = { format: PACKAGE_FORMAT, world: m.worldId, generator: m.generatorVersion, geography: m.geographyVersion, environment: m.environmentVersion, doc };
  return { ...body, print: print(body) };
}

/** A document from a package, or the reasons it is refused. `basePrint`: the print of the bake it must edit.
 *  @param {any} pkg @param {string} basePrint */
export function importPackage(pkg, basePrint) {
  const why = [];
  if (!pkg || pkg.format !== PACKAGE_FORMAT) return { refused: ['not a package of this format'] };
  const { print: p, ...body } = pkg;
  if (print(body) !== p) why.push('its print does not match: changed on the way');
  if (pkg.world !== worldManifest().worldId) why.push(`another world (${pkg.world})`);
  if (!GENERATORS.includes(pkg.generator)) why.push(`a generator this build cannot read (${pkg.generator})`);
  if (pkg.doc?.base !== basePrint) why.push('made against another bake of the region');
  (pkg.doc?.layers ?? []).forEach((L, i) => (L.ops ?? []).forEach((op, j) => { for (const b of opProblems(op)) why.push(`layer ${i} op ${j}: ${b}`); }));
  return why.length ? { refused: why } : { doc: pkg.doc };
}
