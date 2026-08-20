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
  // block 7 - white -> charcoal, taken pale. A healer's whites, and the
  // only garment in this file that is meant to be seen clean.
  linen: [112, 120],
  // block 7 taken dark. An assassin, a nightblade: not black cloth,
  // which the palette has none of, but everything else taken out.
  nearBlack: [121, 127],
  // block 5 - lavender grey -> slate, mid. Mail, which is lighter than
  // plate and reads greyer for it.
  mail: [82, 89],
  // block 12 - pale yellow-green -> green. A ranger's, and the only
  // green worn by anything in this project that is not an orc.
  ranger: [192, 201],
  // block 11 - rust -> dark brown. Fur and hide: a barbarian's, and a
  // colour nothing civilised in here wears.
  fur: [176, 186],
  // block 14 - cream -> orange. A city watch tabard, which exists to be
  // recognised at a distance.
  tabard: [226, 234],
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
  {
    id: MOBILE_TYPES.Spellsword,
    name: 'Spellsword',
    level: null,
    damage: null,
    weaponTier: 2,
    // Mail under a cloak: a mage who learned to be hit.
    build: { ...PERSON, torso: 1.02, shoulder: 1.06 },
    zones: [
      torso('mail', 1.12, 1.56, 0.024),
      arms('mail', 1.14, 1.46, 0.018),
      pelvis('cloth'),
      legs('cloth', 0.46),
      feet('boot'),
    ],
    mats: { mail: CLASS_RAMPS.mail, cloth: CLASS_RAMPS.slate, boot: CLASS_RAMPS.leather },
    hideRamp: 'skin',
    bootRamp: 'leather',
    drape: { name: 'Casual Cloak', mat: 'cloth' },
  },
  {
    id: MOBILE_TYPES.Healer,
    name: 'Healer',
    level: null,
    damage: null,
    weaponTier: 0,
    // Whites, and the only garment here meant to be seen clean.
    build: { ...PERSON, arm: 0.94, shoulder: 0.94 },
    zones: [
      pelvis('cloth'),
      legs('cloth', 0.48),
      feet('boot'),
    ],
    mats: { cloth: CLASS_RAMPS.linen, boot: CLASS_RAMPS.homespun },
    hideRamp: 'skin',
    bootRamp: 'homespun',
    drape: { name: 'Priestess Robes', mat: 'cloth' },
  },
  {
    id: MOBILE_TYPES.Nightblade,
    name: 'Nightblade',
    level: null,
    damage: null,
    weaponTier: 1,
    // Everything taken out of the cloth but the cloth.
    build: { ...PERSON, torso: 0.94, arm: 0.94, leg: 0.96 },
    zones: [
      torso('dark', 1.1, 1.56, 0.018),
      arms('dark', 1.12, 1.46, 0.014),
      pelvis('dark'),
      legs('dark', 0.4),
      feet('dark', 0.0, 0.22, 0.016),
    ],
    mats: { dark: CLASS_RAMPS.nearBlack },
    hideRamp: 'skin',
    bootRamp: 'nearBlack',
    drape: { name: 'Casual Cloak', mat: 'dark' },
  },
  {
    id: MOBILE_TYPES.Burglar,
    name: 'Burglar',
    level: null,
    damage: null,
    weaponTier: 1,
    // A thief who works quieter and carries less.
    build: { ...PERSON, torso: 0.92, shoulder: 0.94, arm: 0.94 },
    zones: [
      torso('leather', 1.12, 1.52, 0.016),
      pelvis('leather'),
      legs('leather', 0.42),
      feet('leather', 0.0, 0.2, 0.014),
    ],
    mats: { leather: CLASS_RAMPS.leather },
    hideRamp: 'skin',
    bootRamp: 'leather',
  },
  {
    id: MOBILE_TYPES.Rogue,
    name: 'Rogue',
    level: null,
    damage: null,
    weaponTier: 1,
    // Leathers over hose: armed, and not hiding it.
    build: { ...PERSON, shoulder: 1.02 },
    zones: [
      torso('leather', 1.1, 1.54, 0.018),
      arms('leather', 1.14, 1.44, 0.014),
      pelvis('hose'),
      legs('hose', 0.42),
      feet('leather', 0.0, 0.2, 0.016),
    ],
    mats: { leather: CLASS_RAMPS.leather, hose: CLASS_RAMPS.homespun },
    hideRamp: 'skin',
    bootRamp: 'leather',
  },
  {
    id: MOBILE_TYPES.Monk,
    name: 'Monk',
    level: null,
    damage: null,
    weaponTier: 0,
    // Bare arms and bare feet: the only fighter here who wears nothing on either.
    build: { ...PERSON, torso: 1.02, arm: 1.04, shoulder: 1.02 },
    zones: [
      pelvis('cloth'),
      legs('cloth', 0.52),
    ],
    mats: { cloth: CLASS_RAMPS.homespun },
    hideRamp: 'skin',
    bootRamp: 'skin',
    drape: { name: 'Toga', mat: 'cloth' },
  },
  {
    id: MOBILE_TYPES.Ranger,
    name: 'Ranger',
    level: null,
    damage: null,
    weaponTier: 1,
    // The only green worn by anything here that is not an orc.
    build: { ...PERSON, shoulder: 1.02, arm: 1.0 },
    zones: [
      torso('green', 1.1, 1.54, 0.018),
      arms('green', 1.14, 1.44, 0.014),
      pelvis('leather'),
      legs('leather', 0.42),
      feet('leather', 0.0, 0.22, 0.016),
    ],
    mats: { green: CLASS_RAMPS.ranger, leather: CLASS_RAMPS.leather },
    hideRamp: 'skin',
    bootRamp: 'leather',
    drape: { name: 'Casual Cloak', mat: 'green' },
  },
  {
    id: MOBILE_TYPES.Knight,
    name: 'Knight',
    level: null,
    damage: null,
    weaponTier: 2,
    // Full plate, and the widest silhouette in this file.
    build: { ...PERSON, torso: 1.1, shoulder: 1.18, arm: 1.08, leg: 1.04 },
    zones: [
      torso('plate', 1.1, 1.58, 0.034),
      arms('plate', 1.12, 1.48, 0.026),
      pelvis('plate', 0.88, 1.12, 0.03),
      legs('plate', 0.44, 0.96, 0.026),
      feet('plate', 0.0, 0.22, 0.028),
    ],
    mats: { plate: CLASS_RAMPS.ironDark },
    hideRamp: 'skin',
    bootRamp: 'ironDark',
    drape: { name: 'Formal Cloak', mat: 'plate' },
  },
  {
    id: MOBILE_TYPES.Acrobat,
    name: 'Acrobat',
    level: null,
    damage: null,
    weaponTier: 0,
    // Wearing as little as anyone here: weight is the enemy.
    build: { ...PERSON, torso: 0.9, shoulder: 0.94, arm: 0.92, leg: 0.94 },
    zones: [
      torso('cloth', 1.16, 1.5, 0.012),
      pelvis('cloth'),
      legs('cloth', 0.5),
    ],
    mats: { cloth: CLASS_RAMPS.homespun },
    hideRamp: 'skin',
    bootRamp: 'skin',
  },
  {
    id: MOBILE_TYPES.Assassin,
    name: 'Assassin',
    level: null,
    damage: null,
    weaponTier: 2,
    // A NIGHTBLADE WHO DOES IT FOR MONEY — and my first cut made them
    // the same figure exactly: identical build, identical near-black
    // leathers, two names on one man. A nightblade is a spellcaster who
    // fights in the dark; an assassin is a killer, and reads heavier in
    // the shoulder and lighter on his feet for it.
    build: { ...PERSON, torso: 0.98, shoulder: 1.04, arm: 0.98, leg: 0.92 },
    zones: [
      torso('dark', 1.06, 1.56, 0.024),
      torso('dark', 1.44, 1.6, 0.03), // the collar, up to the jaw
      arms('dark', 1.08, 1.48, 0.02),
      pelvis('dark'),
      legs('dark', 0.34),
      feet('dark', 0.0, 0.24, 0.018),
    ],
    mats: { dark: CLASS_RAMPS.nearBlack },
    hideRamp: 'skin',
    bootRamp: 'nearBlack',
  },
  {
    id: MOBILE_TYPES.Archer,
    name: 'Archer',
    level: null,
    damage: null,
    weaponTier: 1,
    // Bracers to the elbow: the one part of an archer that wears out.
    build: { ...PERSON, shoulder: 1.06, arm: 1.04 },
    zones: [
      torso('leather', 1.12, 1.52, 0.018),
      arms('leather', 1.2, 1.46, 0.02),
      pelvis('hose'),
      legs('hose', 0.44),
      feet('leather', 0.0, 0.2, 0.016),
    ],
    mats: { leather: CLASS_RAMPS.leather, hose: CLASS_RAMPS.homespun },
    hideRamp: 'skin',
    bootRamp: 'leather',
  },
  {
    id: MOBILE_TYPES.Barbarian,
    name: 'Barbarian',
    level: null,
    damage: null,
    weaponTier: 1,
    // Bare to the waist and half again the width of a mage.
    build: { ...PERSON, torso: 1.24, shoulder: 1.3, arm: 1.24, hand: 1.14, neck: 1.12, leg: 1.16 },
    zones: [
      pelvis('fur', 0.88, 1.16, 0.026),
      legs('fur', 0.56, 0.96, 0.022),
      feet('fur', 0.0, 0.2, 0.02),
    ],
    mats: { fur: CLASS_RAMPS.fur },
    hideRamp: 'skin',
    bootRamp: 'fur',
  },
  {
    id: MOBILE_TYPES.Warrior,
    name: 'Warrior',
    level: null,
    damage: null,
    weaponTier: 2,
    // Mail rather than plate: a professional, not a noble.
    build: { ...PERSON, torso: 1.12, shoulder: 1.2, arm: 1.1, leg: 1.06 },
    zones: [
      torso('mail', 1.1, 1.56, 0.028),
      arms('mail', 1.12, 1.46, 0.022),
      pelvis('mail', 0.88, 1.12, 0.026),
      legs('hose', 0.44),
      feet('boot'),
    ],
    mats: { mail: CLASS_RAMPS.mail, hose: CLASS_RAMPS.homespun, boot: CLASS_RAMPS.leather },
    hideRamp: 'skin',
    bootRamp: 'leather',
  },
  {
    id: MOBILE_TYPES.Knight_CityWatch,
    name: 'City Watch',
    level: null,
    damage: null,
    weaponTier: 2,
    // Plate under a surcoat that exists to be recognised at a distance.
    build: { ...PERSON, torso: 1.08, shoulder: 1.16, arm: 1.06, leg: 1.02 },
    zones: [
      torso('plate', 1.1, 1.56, 0.03),
      arms('plate', 1.12, 1.46, 0.024),
      pelvis('plate', 0.88, 1.12, 0.028),
      legs('plate', 0.44, 0.96, 0.024),
      feet('plate', 0.0, 0.22, 0.026),
    ],
    mats: { plate: CLASS_RAMPS.ironDark, tabard: CLASS_RAMPS.tabard },
    hideRamp: 'skin',
    bootRamp: 'ironDark',
    drape: { name: 'Dwynnen Surcoat', mat: 'tabard' },
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
