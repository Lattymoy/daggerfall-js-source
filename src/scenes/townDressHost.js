// @ts-check
// ═══════════════════════════════════════════════════════════════════
// THE TOWN'S DRESS, WIRED INTO A TOWN PIXEL'S BUILD (scenes/pixelBuild.js). The law
// is world/townDress.js; this module hands it the town's walk grid - its blocks' cells, its ground, its wall and its
// painted paths (the build's own walk shut), its yards, its port and its monument carved out - and the models of its
// blocks, then dresses the laid-out town in place before its blocks are drawn. It stands after the yards and the port:
// none of theirs moves. The fixed city (scenes/exterior.js) stands none, as it stands no yard.
// ═══════════════════════════════════════════════════════════════════
import { CityNavigation } from '../world/city/cityNavigation.js';
import { carveYards } from '../world/merchantYards/merchantYardSites.js';
import { carveLefay } from '../world/lefayMonument.js';
import { carveCapitalWalks } from '../world/capitalWalks.js';
import { townFabricOf } from '../world/urban/townFabricStand.js';
import { townDressSteps, dressLocation, buildTownStall, TOWN_STALL_MODEL } from '../world/townDress.js';
import { stepsBreathing } from '../world/puddleMask.js';   // The build's breather between the law's steps
import { registerCustomModel } from '../world/customModels.js';

let _installed = false;
/** Our stall on the model door, once - behind no switch, as the capitals' landmarks are (scenes/modWorldData.js). */
export function installTownDress() {
  if (_installed) return false;
  _installed = true;
  registerCustomModel(TOWN_STALL_MODEL, () => buildTownStall(), () => true, { climateFree: true });
  return true;
}
/** Test seam. */
export function _resetTownDress() { _installed = false; }

/**
 * THE TOWN DRESSED: `loc` takes the dress in place, and the answer is the dress (null where none), for the walkers' grid
 * (world/townDress.js carveTownDress). `modelOf(id)` the pipeline's model; `breathe` the build's breather.
 * @param {any} loc @param {any} dfLocation
 * @param {{ modelOf: (id: number) => Promise<any>, walkShut?: ((nav: any) => void) | null, yards?: any[] | null,
 *   ports?: any[] | null, lefay?: any, enhancedWater?: boolean, breathe?: () => Promise<void> }} o
 */
export async function townDressFor(loc, dfLocation, { modelOf, walkShut = null, yards = null, ports = null, lefay = null, enhancedWater = true, breathe = async () => {} }) {
  try {
    if (!loc?.blocks?.length || dfLocation?.capital) return null;
    const nav = new CityNavigation(loc.width, loc.height);
    for (const b of loc.blocks) {
      const fld = b.dfBlock?.rmbBlock?.fldHeader, tiles = fld?.groundData?.groundTiles;
      if (fld?.autoMapData && tiles) nav.setBlockData(b.x, b.y, fld.autoMapData, (tx, ty) => tiles[tx][ty].textureRecord, { enhancedWater });
    }
    walkShut?.(nav);
    if (lefay) carveLefay(nav, lefay);
    if (yards?.length) carveYards(nav, yards);
    if (ports?.length) carveYards(nav, ports);
    carveCapitalWalks(nav, dfLocation);
    const models = new Map();
    for (const b of loc.blocks) for (const m of b.layout?.models ?? []) if (!models.has(m.modelIdNum)) models.set(m.modelIdNum, (await modelOf(m.modelIdNum)) ?? null);
    const dress = await stepsBreathing(townDressSteps(loc, dfLocation, { nav, modelOf: (id) => models.get(id) ?? null, plan: townFabricOf(dfLocation)?.plan ?? null }), breathe);
    dressLocation(loc, dress);
    return dress;
  } catch (e) {
    console.warn(`[town-dress] ${dfLocation?.name ?? '?'}: not dressed (${e?.message ?? e})`);   // the town stands as its blocks lay it
    return null;
  }
}
