import { MOBILE_TYPES } from './mobileTypes.js';
import { UNDEAD_RAMPS } from './undeadBody.js';

// ═══════════════════════════════════════════════════════════════════
// THE HUMAN CLASS ENEMIES
//
// Mage, Sorcerer, Battlemage, Bard and Thief — mapChance 3, 3, 2, 2, 2,
// which makes them collectively the commonest thing in a dungeon, and
// the last large group the player meets that had no rig.
//
// THEY SCALE WITH THE PLAYER. Every other design in this project carries
// a level and a damage band out of ENEMY_BASICS; these carry neither,
// because Daggerfall builds them to whoever walks in. So they say
// `level: null` and the viewer prints "scales" rather than "undefined" —
// a made-up number here would be a lie about the game's own rules.
//
// AND THEY ARE JUST PEOPLE. No new geometry, no new mechanism: a human
// build barely touched, and everything said with clothing. Which is the
// point — after orcs, bone, a horse body and a composition test, the
// most-met enemies in the game cost a data file, and that is the return
// on all of it.
//
// THE BATTLEMAGE IS THE ONE WORTH WATCHING. Robes OVER plate is exactly
// the case that was clipping until the drape learned to clear what is
// under it, so it is here partly as an enemy and partly as the thing
// that proves that fix on a design built after it.
// ═══════════════════════════════════════════════════════════════════

/** ART_PAL spans, same convention as ORC_RAMPS and UNDEAD_RAMPS. */
export const CLASS_RAMPS = Object.freeze({
  // block 4 - cream -> tan. Ordinary skin; these are living people.
  skin: [64, 76],
  // block 6 - light blue -> deep blue. A mage's guild blue, the one
  // colour in the palette nobody else in this project wears.
  guildBlue: [100, 110],
  // block 5 - lavender grey -> slate. A sorcerer's, and darker for it.
  slate: [84, 92],
  // block 5 taken low: crude iron, the battlemage's plate under the robe.
  ironDark: [86, 94],
  // block 15 - orange-red -> dark red. A bard is the only one of these
  // who dresses to be looked at.
  bardRed: [242, 250],
  // block 4 dark end - tan -> dark brown. A thief's leathers.
  leather: [70, 79],
  // block 2 - tan -> brown. Hose, belts, the parts nobody chose.
  homespun: [34, 44],
});

const B = 'body',
  AL = 'armL',
  AR = 'armR',
  LL = 'legL',
  LR = 'legR';

const torso = (mat, yLo, yHi = 1.62, th = 0.014) => ({ groups: [B], yLo, yHi, th, mat });
const arms = (mat, yLo, yHi = 1.5, th = 0.012) => ({ groups: [AL, AR], yLo, yHi, th, mat, arm: true });
const pelvis = (mat, yLo = 0.88, yHi = 1.12, th = 0.014) => ({ groups: [B], yLo, yHi, th, mat });
const legs = (mat, yLo, yHi = 0.96, th = 0.013) => ({ groups: [LL, LR], yLo, yHi, th, mat, leg: true });
const feet = (mat, yLo = 0.0, yHi = 0.18, th = 0.015) => ({ groups: [LL, LR], yLo, yHi, th, mat, leg: true });

/** A body that has not been made into anything: these are people. */
const PERSON = { torso: 1, shoulder: 1, arm: 1, hand: 1, neck: 1, skull: 1, jaw: 1, leg: 1 };

export const CLASS_DESIGNS = [
  {
    id: MOBILE_TYPES.Mage,
    name: 'Mage',
    level: null, // scales to the player — see the note above
    damage: null,
    weaponTier: 0,
    build: { ...PERSON, arm: 0.94, shoulder: 0.94 }, // a life indoors
    zones: [pelvis('cloth'), legs('cloth', 0.5), feet('boot')],
    mats: { cloth: CLASS_RAMPS.guildBlue, boot: CLASS_RAMPS.homespun },
    hideRamp: 'skin',
    bootRamp: 'homespun',
    drape: { name: 'Plain Robes', mat: 'cloth' },
  },
  {
    id: MOBILE_TYPES.Sorcerer,
    name: 'Sorcerer',
    level: null,
    damage: null,
    weaponTier: 0,
    // The same trade and a colder version of it. Gaunter, and in slate
    // rather than guild blue — a sorcerer answers to nobody.
    build: { ...PERSON, torso: 0.94, arm: 0.9, shoulder: 0.92, jaw: 0.94 },
    zones: [pelvis('cloth'), legs('cloth', 0.46), feet('boot')],
    mats: { cloth: CLASS_RAMPS.slate, boot: CLASS_RAMPS.leather },
    hideRamp: 'skin',
    bootRamp: 'leather',
    drape: { name: 'Priest Robes', mat: 'cloth' },
  },
  {
    id: MOBILE_TYPES.Battlemage,
    name: 'Battlemage',
    level: null,
    damage: null,
    weaponTier: 2,
    // ROBES OVER PLATE, which is the case that was clipping. The armour
    // is a thick torso zone and the robe has to start outside it — a
    // design built AFTER the drape learned to clear what is under it,
    // which is the only honest way to check that it did.
    build: { ...PERSON, torso: 1.06, shoulder: 1.12, arm: 1.04 },
    zones: [
      torso('plate', 1.12, 1.58, 0.03), // the cuirass
      arms('plate', 1.16, 1.48, 0.022), // spaulders
      pelvis('plate', 0.9, 1.12, 0.026),
      legs('cloth', 0.46),
      feet('boot'),
    ],
    mats: { plate: CLASS_RAMPS.ironDark, cloth: CLASS_RAMPS.slate, boot: CLASS_RAMPS.leather },
    hideRamp: 'skin',
    bootRamp: 'leather',
    drape: { name: 'Formal Cloak', mat: 'cloth' },
  },
  {
    id: MOBILE_TYPES.Bard,
    name: 'Bard',
    level: null,
    damage: null,
    weaponTier: 1,
    // The only one of these who dresses to be LOOKED at.
    build: { ...PERSON, torso: 0.98, shoulder: 1.02 },
    zones: [
      torso('finery', 1.1, 1.55, 0.016),
      arms('finery', 1.1, 1.46, 0.014),
      pelvis('hose'),
      legs('hose', 0.42),
      feet('boot'),
    ],
    mats: { finery: CLASS_RAMPS.bardRed, hose: CLASS_RAMPS.homespun, boot: CLASS_RAMPS.leather },
    hideRamp: 'skin',
    bootRamp: 'leather',
    drape: { name: 'Casual Cloak', mat: 'finery' },
  },
  {
    id: MOBILE_TYPES.Thief,
    name: 'Thief',
    level: null,
    damage: null,
    weaponTier: 1,
    // Wiry, and in the one colour that is not a colour. No drape: a
    // cloak is the last thing you want going over a wall.
    build: { ...PERSON, torso: 0.92, shoulder: 0.96, arm: 0.94, leg: 0.96 },
    zones: [
      torso('leather', 1.1, 1.56, 0.018),
      arms('leather', 1.12, 1.46, 0.014),
      pelvis('leather'),
      legs('leather', 0.4),
      feet('leather', 0.0, 0.22, 0.016),
    ],
    mats: { leather: CLASS_RAMPS.leather },
    hideRamp: 'skin',
    bootRamp: 'leather',
  },
];

/**
 * The same shape orcOpts and undeadOpts return, so a class enemy goes
 * down the one delta path with everything else.
 */
export function classOpts(design, pal) {
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
  const hide = ramp(CLASS_RAMPS[design.hideRamp]);
  const drape = design.drape ? { name: design.drape.name, ramp: mats[design.drape.mat] } : null;
  return {
    drape,
    ramps: { skin: hide, boot: ramp(CLASS_RAMPS[design.bootRamp] || UNDEAD_RAMPS.gravecloth) },
    opts: { build: design.build, clothZones: design.zones, armorZones: [], mats },
    hide,
  };
}
