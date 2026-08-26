// Clothing on the neutral rig, 1:1 with the item DB. Each garment TYPE
// maps to a set of displace ZONES (rig group + Y band + thickness) that
// thicken the body's own surface with cloth - the same body-as-armour
// approach, so it animates for free and layers under armour. Template
// indices resolve to a type by NAME (the DB carries the names), so
// every wearable index is covered without duplicating specs.
//
// Y bands are in the body's pre-HSCALE space (see neutralBody.js).
// Draped garments (skirts, robes, cloaks, togas, dresses, surcoats,
// kimono, sash, mummy wrappings) use standoff geometry, handled by
// pieces/draped.js rather than body displacement.

import templates from './itemTemplates.json' with { type: 'json' };

const TH = 0.008;            // cloth thickness (thinner than armour)
const B = 'body', LL = 'legL', LR = 'legR', AL = 'armL', AR = 'armR';

// Reusable zone builders.
const torso = (yLo, yHi = 1.62, th = TH) => ({ groups: [B], yLo, yHi, th });
const sleeves = (yLo, yHi = 1.62, th = TH) => ({ groups: [AL, AR], yLo, yHi, th, arm: true });
const legs = (yLo, yHi = 1.00, th = TH) => ({ groups: [LL, LR], yLo, yHi, th, leg: true });
const pelvis = (yLo = 0.90, yHi = 1.14, th = TH) => ({ groups: [B], yLo, yHi, th });
const feet = (yLo = 0.00, yHi = 0.16, th = TH) => ({ groups: [LL, LR], yLo, yHi, th, leg: true });

// Garment TYPE -> zones. Distinct body-hugging silhouettes by coverage.
const TYPES = {
  'Short Shirt':      [torso(1.20), sleeves(1.36)],
  'Long Shirt':       [torso(1.02), sleeves(1.16)],
  'Short Tunic':      [torso(1.06), sleeves(1.40)],
  'Formal Tunic':     [torso(1.02), sleeves(1.20)],
  'Reversible Tunic': [torso(1.04), sleeves(1.22)],
  'Open Tunic':       [torso(1.10), sleeves(1.40)],
  'Vest':             [torso(1.16, 1.58)],
  'Straps':           [torso(1.30, 1.56, 0.006)],
  'Challenger Straps':[torso(1.30, 1.56, 0.006)],
  'Champion Straps':  [torso(1.30, 1.56, 0.006)],
  'Armbands':         [sleeves(1.24, 1.50)],
  'Fancy Armbands':   [sleeves(1.24, 1.50)],
  'Brassiere':        [torso(1.40, 1.56)],
  'Formal Brassiere': [torso(1.40, 1.56)],
  'Eodoric':          [torso(1.10, 1.60)],
  'Formal Eodoric':   [torso(1.10, 1.60)],
  'Casual Pants':     [legs(0.40), pelvis()],
  'Loincloth':        [pelvis(0.72, 1.08), legs(0.72, 0.92)],
  'Khajiit Suit':     [torso(1.02), sleeves(1.16), legs(0.16), pelvis(0.90, 1.14)],
  'Shoes':            [feet(0.00, 0.10)],
  'Sandals':          [feet(0.00, 0.08)],
  'Boots':            [feet(0.00, 0.16)],
  'Tall Boots':       [feet(0.00, 0.34)],
};

// Classic clothing that hangs away from the body. The names are the item DB
// names AND the keys used by pieces/draped.js, so the 2D Daggerfall item and
// the 3D garment share one identity instead of a second hand-maintained map.
export const DRAPED_CLOTHING_TYPES = Object.freeze([
  'Toga', 'Dwynnen Surcoat', 'Anticlere Surcoat', 'Casual Dress',
  'Strapless Dress', 'Kimono', 'Sash', 'Mummy Wrappings', 'Short Skirt',
  'Long Skirt', 'Wrap', 'Plain Robes', 'Priest Robes', 'Priestess Robes',
  'Casual Cloak', 'Formal Cloak',
]);
const DRAPED = new Set(DRAPED_CLOTHING_TYPES);

const byIndex = new Map(templates.map((t) => [t.index, t]));
const byName = new Map();
for (const t of templates) if (!byName.has(t.name)) byName.set(t.name, t);

const cloneZone = (z) => ({ ...z, groups: [...z.groups] });

/** Zones for a clothing template index (or name). [] if draped/unknown. */
export function clothingZones(indexOrName) {
  const name = typeof indexOrName === 'number' ? byIndex.get(indexOrName)?.name : indexOrName;
  if (!name || DRAPED.has(name)) return [];
  return (TYPES[name] || []).map(cloneZone);
}

/** 'body' for body-owned cloth, 'drape' for standoff cloth, null otherwise. */
export function clothingRenderKind(indexOrName) {
  const name = typeof indexOrName === 'number' ? byIndex.get(indexOrName)?.name : indexOrName;
  if (!name) return null;
  if (TYPES[name]) return 'body';
  if (DRAPED.has(name)) return 'drape';
  return null;
}

/**
 * The Daggerfall clothing records that the 3D rig knows how to represent.
 * Art addressing is kept beside the geometry identity now because the next
 * stage can consume the original paperdoll TEXTURE archive/record without
 * inventing another clothing table.
 */
export const CLOTHING_CATALOG = Object.freeze(
  templates
    .filter((t) => TYPES[t.name] || DRAPED.has(t.name))
    .map((t) => Object.freeze({
      index: t.index,
      name: t.name,
      kind: TYPES[t.name] ? 'body' : 'drape',
      zones: TYPES[t.name] ? TYPES[t.name].map(cloneZone) : [],
      drape: DRAPED.has(t.name) ? t.name : null,
      variants: t.variants ?? 0,
      drawOrder: t.drawOrderOrEffect ?? 0,
      playerTextureArchive: t.playerTextureArchive ?? 0,
      playerTextureRecord: t.playerTextureRecord ?? 0,
    })),
);

/** Full 3D descriptor by classic template index or clothing name. */
export function clothingDescriptor(indexOrName) {
  const t = typeof indexOrName === 'number' ? byIndex.get(indexOrName) : byName.get(indexOrName);
  if (!t) return null;
  const kind = clothingRenderKind(t.index);
  if (!kind) return null;
  return {
    index: t.index,
    name: t.name,
    kind,
    zones: clothingZones(t.index),
    drape: kind === 'drape' ? t.name : null,
    variants: t.variants ?? 0,
    drawOrder: t.drawOrderOrEffect ?? 0,
    playerTextureArchive: t.playerTextureArchive ?? 0,
    playerTextureRecord: t.playerTextureRecord ?? 0,
  };
}

export { TYPES as CLOTHING_TYPES };
