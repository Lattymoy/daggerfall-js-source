// Clothing on the neutral rig, 1:1 with the item DB. Each garment TYPE
// maps to a set of displace ZONES (rig group + Y band + thickness) that
// thicken the body's own surface with cloth - the same body-as-armour
// approach, so it animates for free and layers under armour. Template
// indices resolve to a type by NAME (the DB carries the names), so
// every wearable index is covered without duplicating specs.
//
// Y bands are in the body's pre-HSCALE space (see neutralBody.js).
// Draped garments (skirts, robes, cloaks, togas, dresses, surcoats,
// kimono, sash, mummy wrappings) are DEFERRED - they need standoff
// geometry, handled elsewhere. They resolve to [] here.

import templates from './itemTemplates.json' with { type: 'json' };

const TH = 0.008; // cloth thickness (thinner than armour)
const B = 'body',
  LL = 'legL',
  LR = 'legR',
  AL = 'armL',
  AR = 'armR';

// Reusable zone builders.
const torso = (yLo, yHi = 1.62, th = TH) => ({ groups: [B], yLo, yHi, th });
const sleeves = (yLo, yHi = 1.62, th = TH) => ({ groups: [AL, AR], yLo, yHi, th, arm: true });
const legs = (yLo, yHi = 1.0, th = TH) => ({ groups: [LL, LR], yLo, yHi, th, leg: true });
const pelvis = (yLo = 0.9, yHi = 1.14, th = TH) => ({ groups: [B], yLo, yHi, th });
const feet = (yLo = 0.0, yHi = 0.16, th = TH) => ({ groups: [LL, LR], yLo, yHi, th, leg: true });

// Garment TYPE -> zones. Distinct body-hugging silhouettes by coverage.
const TYPES = {
  'Short Shirt': [torso(1.2), sleeves(1.36)],
  'Long Shirt': [torso(1.02), sleeves(1.16)],
  'Short Tunic': [torso(1.06), sleeves(1.4)],
  'Formal Tunic': [torso(1.02), sleeves(1.2)],
  'Reversible Tunic': [torso(1.04), sleeves(1.22)],
  'Open Tunic': [torso(1.1), sleeves(1.4)],
  'Vest': [torso(1.16, 1.58)],
  'Straps': [torso(1.3, 1.56, 0.006)],
  'Challenger Straps': [torso(1.3, 1.56, 0.006)],
  'Champion Straps': [torso(1.3, 1.56, 0.006)],
  'Armbands': [sleeves(1.24, 1.5)],
  'Fancy Armbands': [sleeves(1.24, 1.5)],
  'Brassiere': [torso(1.4, 1.56)],
  'Formal Brassiere': [torso(1.4, 1.56)],
  'Eodoric': [torso(1.1, 1.6)],
  'Formal Eodoric': [torso(1.1, 1.6)],
  'Casual Pants': [legs(0.4), pelvis()],
  'Loincloth': [pelvis(0.72, 1.08), legs(0.72, 0.92)],
  'Khajiit Suit': [torso(1.02), sleeves(1.16), legs(0.16), pelvis(0.9, 1.14)],
  'Shoes': [feet(0.0, 0.1)],
  'Sandals': [feet(0.0, 0.08)],
  'Boots': [feet(0.0, 0.16)],
  'Tall Boots': [feet(0.0, 0.34)],
};

// Deferred (draped) - resolve to no displacement here.
const DRAPED = new Set([
  'Toga',
  'Dwynnen Surcoat',
  'Anticlere Surcoat',
  'Casual Dress',
  'Strapless Dress',
  'Kimono',
  'Sash',
  'Mummy Wrappings',
  'Short Skirt',
  'Long Skirt',
  'Wrap',
  'Plain Robes',
  'Priest Robes',
  'Priestess Robes',
  'Casual Cloak',
  'Formal Cloak',
]);

const byIndex = new Map(templates.map((t) => [t.index, t.name]));

/** Zones for a clothing template index (or name). [] if draped/unknown. */
export function clothingZones(indexOrName) {
  const name = typeof indexOrName === 'number' ? byIndex.get(indexOrName) : indexOrName;
  if (!name || DRAPED.has(name)) return [];
  return TYPES[name] || [];
}

export { TYPES as CLOTHING_TYPES };
