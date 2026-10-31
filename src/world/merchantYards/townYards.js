// @ts-check
// IC-PROPS (2026-10-27, the owner: "the issues I mentioned for the imperial city for stables/doors/etc are a world wide
// issue. They have no logical placements"; bible/03-World/Merchant-Yards.md IC-PROPS) - WHAT A TOWN TELLS ITS YARDS' LAW
// besides its blocks (world/merchantYards/merchantYardSites.js townGroundOf's `ways`): its fabric's plan where URBANIZER
// planned one (its streets, pavements, alleys and yards - world/urban/townFabricStand.js townFabricOf), and a capital that
// names its own yards - the Imperial City, one town over 625 slices, whose yards stand at its gates (world/imperialYards.js),
// none on any other slice. The world host hands it to the one ground its yards and its port are placed on
// (scenes/world.js townPlacesFor).
import { townFabricOf } from '../urban/townFabricStand.js';
import { CAPITALS } from '../tamrielCapitals.js';
import { imperialSliceYards } from '../imperialYards.js';

/**
 * A TOWN'S WAYS AND ITS OWN YARDS for townGroundOf: `plan` its fabric's (URBANIZER's, or null), `fixed` its own yards' sites
 * on this location's grid where its capital names them (the Imperial City's slice's share - often none), else null (the
 * law places them).
 * @param {any} dfLocation
 * @returns {{ plan: any, fixed: any[] | null }}
 */
export function townYardsOf(dfLocation) {
  const cap = dfLocation?.capital ? CAPITALS[dfLocation.capital.k] : null;
  return {
    plan: townFabricOf(dfLocation)?.plan ?? null,
    fixed: cap?.family ? imperialSliceYards(dfLocation.capital.s) : null,
  };
}
