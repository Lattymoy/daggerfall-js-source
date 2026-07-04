// Armour on the neutral rig, 1:1 with the item DB. Body-hugging pieces
// (cuirass, greaves, gauntlets, boots) thicken the body's own surface
// via displace ZONES - same as clothing, but a metal/leather material
// and thicker, so armour sits OVER clothing. Standoff pieces (pauldrons,
// helm) are separate meshes - see pieces/. Shields are held items.
//
// Material follows the armour family (paperdollArt MATERIAL_FAMILY):
// Plate -> steel, Chain -> mail, Leather -> leather.
import { MATERIAL_FAMILY } from './paperdollArt.js';

const B = 'body', LL = 'legL', LR = 'legR', AL = 'armL', AR = 'armR';

// Template index -> body-hugging zones (rig group + Y band + thickness
// + optional front/back squash). Tuned in the viewer.
const ZONES = {
  102: [{ groups: [B], yLo: 1.12, yHi: 1.62, th: 0.022 }],                               // Cuirass
  104: [{ groups: [LL, LR], yLo: 0.56, yHi: 1.00, th: 0.020, zScale: 0.28, leg: true },  // Greaves (legs)
        { groups: [B], yLo: 0.90, yHi: 1.14, th: 0.020 }],                               //   + hip fauld
  103: [{ groups: [AL, AR], yLo: 0.83, yHi: 1.22, th: 0.016, arm: true }],               // Gauntlets
  108: [{ groups: [LL, LR], yLo: 0.00, yHi: 0.42, th: 0.016, leg: true }],               // Boots
};

const materialOf = (family) =>
  family === MATERIAL_FAMILY.Leather ? 'leather'
  : family === MATERIAL_FAMILY.Chain ? 'mail'
  : 'steel'; // Plate (default)

/** Body-hugging displace zones for an armour template + family, each
 *  stamped with the family material. [] for standoff/held pieces. */
export function armorZones(templateIndex, family = MATERIAL_FAMILY.Plate) {
  const zs = ZONES[templateIndex];
  if (!zs) return [];
  const mat = materialOf(family);
  return zs.map((z) => ({ ...z, mat }));
}

export { materialOf };
