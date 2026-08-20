import { MOBILE_TYPES } from './mobileTypes.js';

// ═══════════════════════════════════════════════════════════════════
// THE ATRONACHS
//
// Fire, Ice, Iron and Flesh: bound elementals, and the only group in
// ENEMY_BASICS whose members are STATISTICALLY IDENTICAL. All four are
// level 16, 5-15 damage, 25-130 health, armour 6. The game distinguishes
// them by element and by nothing else.
//
// Which makes them a design problem with the numbers taken away. Four
// things that fight the same have to look nothing alike, and the only
// tools are the shape of the body and what it is made of.
//
// TWO OF THEM NEEDED THE MATERIAL PATH THE GHOST OPENED. A fire
// atronach is not orange-coloured, it is LIT — it adds light to what is
// behind it rather than hiding it, which is additive blending and not a
// colour choice. Ice is the ghost's transparency at a harder edge. Iron
// and flesh are solid and say what they are with build and ramp, the way
// every enemy before the ghost did.
//
// So this file is the first place the project has four designs that use
// three different render modes, which is the point of having built the
// mechanism at all.
// ═══════════════════════════════════════════════════════════════════

/** ART_PAL spans, same convention as ORC_RAMPS and CLASS_RAMPS. */
export const ATRONACH_RAMPS = Object.freeze({
  // block 15 - orange-red -> dark red, taken at the hot end. Flame, and
  // it has to start near white: fire's core has no colour in it.
  flame: [240, 247],
  // block 14 - cream -> orange. The cooler outer body, where the fire
  // has something to burn rather than just being fire.
  ember: [224, 232],
  // block 6 - light blue -> deep blue, pale. Ice with light in it.
  ice: [97, 104],
  // block 7 near white. The frost on it, and the one part that is not
  // see-through.
  rime: [112, 117],
  // block 5 - lavender grey -> slate, dark. Crude iron, and heavier
  // than any plate a knight wears.
  iron: [88, 95],
  // block 3 - pink -> mauve. Flesh, which in this palette is the only
  // block that has ever been the wrong colour for anything else.
  meat: [50, 60],
  // block 11 - rust -> dark brown. The seams, and what has run down
  // from them.
  suture: [180, 190],
});

const B = 'body',
  AL = 'armL',
  AR = 'armR',
  LL = 'legL',
  LR = 'legR';

const torso = (mat, yLo, yHi = 1.62, th = 0.02) => ({ groups: [B], yLo, yHi, th, mat });
const arms = (mat, yLo, yHi = 1.5, th = 0.018) => ({ groups: [AL, AR], yLo, yHi, th, mat, arm: true });
const legs = (mat, yLo, yHi = 0.96, th = 0.018) => ({ groups: [LL, LR], yLo, yHi, th, mat, leg: true });

export const ATRONACH_DESIGNS = [
  {
    id: MOBILE_TYPES.FireAtronach,
    name: 'Fire Atronach',
    level: 16,
    damage: [5, 15],
    weaponTier: 0,
    // FIRE IS NOT A COLOUR, IT IS A LIGHT. An orange body reads as a
    // painted man; a body that ADDS to what is behind it reads as
    // burning. That is additive blending, which the ghost's material
    // work made reachable and which nothing before it needed.
    //
    // Narrow at the feet and wide at the shoulder: flame is widest where
    // it has risen furthest, and a column that is even top to bottom is
    // a lamp rather than a fire.
    build: { torso: 1.06, shoulder: 1.16, arm: 0.96, hand: 0.9, neck: 0.9, skull: 0.86, jaw: 0.84, leg: 0.86 },
    zones: [torso('ember', 1.0, 1.5, 0.024), arms('ember', 1.1, 1.46, 0.02)],
    mats: { ember: ATRONACH_RAMPS.ember },
    hideRamp: 'flame',
    bootRamp: 'ember',
    spectral: { opacity: 0.78, additive: true },
  },
  {
    id: MOBILE_TYPES.IceAtronach,
    name: 'Ice Atronach',
    level: 16,
    damage: [5, 15],
    weaponTier: 0,
    // The ghost's transparency at a HARDER edge. A ghost is absent; ice
    // is present and merely see-through, so it sits far denser — and it
    // keeps a solid rime on the shoulders and forearms, because the one
    // thing a ghost never has is a surface.
    build: { torso: 1.14, shoulder: 1.24, arm: 1.12, hand: 1.1, neck: 1.02, skull: 0.96, jaw: 0.98, leg: 1.08 },
    zones: [torso('rime', 1.3, 1.58, 0.03), arms('rime', 1.0, 1.3, 0.024)],
    mats: { rime: ATRONACH_RAMPS.rime },
    hideRamp: 'ice',
    bootRamp: 'rime',
    spectral: { opacity: 0.66 },
  },
  {
    id: MOBILE_TYPES.IronAtronach,
    name: 'Iron Atronach',
    level: 16,
    damage: [5, 15],
    weaponTier: 0,
    // SOLID, and the heaviest thing in the project that is not a giant.
    // No material trick at all: it says what it is with mass, which is
    // what every enemy did before the ghost and is still the right
    // answer for a thing made of metal.
    build: { torso: 1.34, shoulder: 1.42, arm: 1.3, hand: 1.36, neck: 1.24, skull: 1.02, jaw: 1.16, leg: 1.28 },
    zones: [
      torso('iron', 1.06, 1.6, 0.034),
      arms('iron', 1.02, 1.48, 0.03),
      legs('iron', 0.3, 0.96, 0.03),
    ],
    mats: { iron: ATRONACH_RAMPS.iron },
    hideRamp: 'iron',
    bootRamp: 'iron',
  },
  {
    id: MOBILE_TYPES.FleshAtronach,
    name: 'Flesh Atronach',
    level: 16,
    damage: [5, 15],
    weaponTier: 0,
    // Also solid, and the only one of the four that was ever alive —
    // several people, in fact. Lumpy rather than heavy: swollen through
    // the trunk and wrong at the joints, with the seams darker than what
    // they hold together.
    build: { torso: 1.22, shoulder: 1.1, arm: 1.18, hand: 1.24, neck: 0.86, skull: 0.94, jaw: 1.06, leg: 1.14 },
    zones: [
      torso('suture', 1.24, 1.34, 0.026), // the chest seam
      torso('suture', 0.96, 1.04, 0.024), // and the waist
      arms('suture', 1.16, 1.24, 0.022), // where the arms were joined on
    ],
    mats: { suture: ATRONACH_RAMPS.suture },
    hideRamp: 'meat',
    bootRamp: 'meat',
  },
];

/**
 * The same shape orcOpts, undeadOpts and classOpts return, so an
 * atronach goes down the one delta path with everything else.
 */
export function atronachOpts(design, pal) {
  const ramp = ([a, b]) => {
    const out = [];
    for (let i = b; i >= a; i--) {
      const c = pal.get(i);
      out.push([c.r, c.g, c.b]);
    }
    return out;
  };
  const mats = {};
  for (const [name, span] of Object.entries(design.mats)) mats[name] = ramp(span);
  const hide = ramp(ATRONACH_RAMPS[design.hideRamp]);
  return {
    drape: null, // an elemental wears nothing: it IS the thing
    ramps: { skin: hide, boot: ramp(ATRONACH_RAMPS[design.bootRamp]) },
    opts: { build: design.build, clothZones: design.zones, armorZones: [], mats },
    hide,
  };
}
