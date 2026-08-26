// Armour on the neutral rig, 1:1 with the item DB. Body-hugging pieces
// (cuirass, greaves, gauntlets, boots) thicken the body's own surface
// via displace ZONES - same as clothing, but a metal/leather material
// and thicker, so armour sits OVER clothing. Standoff pieces (pauldrons,
// helm) are separate meshes - see pieces/. Shields are held items.
//
// Material follows the armour family (paperdollArt MATERIAL_FAMILY):
// Plate -> steel, Chain -> mail, Leather -> leather.
import templates from './itemTemplates.json' with { type: 'json' };
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

const SLOT_BY_INDEX = Object.freeze({
  102: 'cuirass',
  103: 'gauntlets',
  104: 'greaves',
  105: 'pauldronL',
  106: 'pauldronR',
  107: 'helm',
  108: 'boots',
});
const PIECE_INDEX = new Set([105, 106, 107]);

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
  return zs.map((z) => ({ ...z, groups: [...z.groups], mat }));
}

/** Every wearable armour template the neutral rig can currently represent.
 * Shields are intentionally not in this list: they are held equipment and need
 * a hand-mounted shield mesh rather than pretending to be body armour. */
export const ARMOR_CATALOG = Object.freeze(
  templates
    .filter((t) => SLOT_BY_INDEX[t.index])
    .map((t) => Object.freeze({
      index: t.index,
      name: t.name,
      slot: SLOT_BY_INDEX[t.index],
      kind: PIECE_INDEX.has(t.index) ? 'piece' : 'body',
      variants: t.variants ?? 0,
      drawOrder: t.drawOrderOrEffect ?? 0,
      playerTextureArchive: t.playerTextureArchive ?? 0,
      playerTextureRecord: t.playerTextureRecord ?? 0,
    })),
);

export { materialOf, MATERIAL_FAMILY };
