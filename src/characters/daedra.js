import { MOBILE_TYPES } from './mobileTypes.js';

// ═══════════════════════════════════════════════════════════════════
// THE DAEDRA
//
// Frost, Fire, Daedroth, Lord and Seducer. Every one of them is
// minMetalToHit 5 — daedric weapons or nothing — which is what marks
// them as a class in the game's own terms rather than in ours.
//
// AND THEY COST ALMOST NOTHING, WHICH IS THE POINT. A Daedroth is a
// crocodile-headed man: that is the werewolf's mechanism, one group
// collapsed and a beast head over it. A Fire Daedra burns: that is the
// fire atronach's additive blend. A Frost Daedra is the ice atronach's
// transparency at a different density. The only new geometry in five
// enemies is a pair of horns.
//
// Which is what a mechanism is supposed to do after enough of it exists:
// the twentieth enemy costs a file and the forty-sixth costs a line. The
// beasts needed a builder because a spider does not fit a spine; these
// need nothing because a daedra IS a man, however unpleasantly.
// ═══════════════════════════════════════════════════════════════════

/** ART_PAL spans, same convention as every other line. */
export const DAEDRA_RAMPS = Object.freeze({
  // block 6 - light blue -> deep blue. Frost daedra: cold enough to
  // read as a temperature rather than a colour.
  frost: [98, 105],
  // block 15 - orange-red -> dark red, hot end. Fire daedra, and it has
  // to start near white the way the atronach's does.
  hellfire: [240, 247],
  // block 11 - rust -> dark brown. Daedroth hide: a lizard that has
  // been somewhere hot for a long time.
  scale: [176, 184],
  // block 3 - pink -> mauve, dark. A daedra lord: not red, which is the
  // obvious choice, but the colour of something bruised.
  lordflesh: [50, 58],
  // block 14 - cream -> orange. Gold: a lord's fittings, and the
  // seducer's, which are the only ornament in this file.
  gilt: [226, 234],
  // block 5 - lavender grey -> slate. Iron, for what a lord wears.
  ironDark: [86, 93],
  // block 7 near white. The seducer, who is the only daedra here that
  // is trying to look like something you would follow.
  fair: [113, 120],
});

const B = 'body',
  AL = 'armL',
  AR = 'armR',
  LL = 'legL',
  LR = 'legR';

const torso = (mat, yLo, yHi = 1.62, th = 0.02) => ({ groups: [B], yLo, yHi, th, mat });
const arms = (mat, yLo, yHi = 1.5, th = 0.018) => ({ groups: [AL, AR], yLo, yHi, th, mat, arm: true });
const pelvis = (mat, yLo = 0.88, yHi = 1.12, th = 0.02) => ({ groups: [B], yLo, yHi, th, mat });
const legs = (mat, yLo, yHi = 0.96, th = 0.018) => ({ groups: [LL, LR], yLo, yHi, th, mat, leg: true });

export const DAEDRA_DESIGNS = [
  {
    id: MOBILE_TYPES.FrostDaedra,
    name: 'Frost Daedra',
    level: 17,
    damage: [50, 100],
    weaponTier: 2,
    // The hardest hitter in the whole table at 50-100, and it shows in
    // the build rather than in an effect: this is the broadest daedra.
    build: { torso: 1.26, shoulder: 1.36, arm: 1.26, hand: 1.3, neck: 1.2, skull: 1.02, jaw: 1.12, leg: 1.2 },
    zones: [torso('rime', 1.2, 1.56, 0.026), arms('rime', 1.06, 1.42, 0.022)],
    mats: { rime: DAEDRA_RAMPS.fair },
    hideRamp: 'frost',
    bootRamp: 'frost',
    // Denser than an ice atronach: a daedra is a thing, not a substance.
    spectral: { opacity: 0.8 },
  },
  {
    id: MOBILE_TYPES.FireDaedra,
    name: 'Fire Daedra',
    level: 17,
    damage: [15, 50],
    weaponTier: 2,
    // The atronach's additive blend on a body that is a person rather
    // than a column of flame — narrower at the shoulder than the frost
    // daedra, and lit rather than coloured.
    build: { torso: 1.14, shoulder: 1.2, arm: 1.14, hand: 1.16, neck: 1.1, skull: 1, jaw: 1.06, leg: 1.1 },
    zones: [],
    mats: {},
    hideRamp: 'hellfire',
    bootRamp: 'hellfire',
    spectral: { opacity: 0.82, additive: true },
  },
  {
    id: MOBILE_TYPES.Daedroth,
    name: 'Daedroth',
    level: 18,
    damage: [15, 50],
    weaponTier: 2,
    // A CROCODILE-HEADED MAN, which is the werewolf's design exactly:
    // collapse the skull, put a beast head on it, keep everything else.
    // The muzzle is longer and deeper than a wolf's and there are no
    // ears at all — a lizard has none, and leaving them on would have
    // made it a very strange dog.
    build: { torso: 1.24, shoulder: 1.3, arm: 1.24, hand: 1.3, neck: 1.26, skull: 1, jaw: 1, leg: 1.18 },
    zones: [],
    mats: {},
    hideRamp: 'scale',
    bootRamp: 'scale',
    collapse: ['head'],
    beastHead: { skull: 0.11, snout: 0.24, depth: 0.85, ears: 0, tusks: 0.5 },
    tail: { len: 0.4, up: 0.15, thick: 0.038 },
  },
  {
    id: MOBILE_TYPES.DaedraLord,
    name: 'Daedra Lord',
    level: 20,
    damage: [15, 50],
    weaponTier: 2,
    // 35-210 health, the deepest pool in the table, and the only enemy
    // in this project with HORNS. Bruised rather than red — red is the
    // obvious choice and every other thing in the palette that is red is
    // either blood or fire.
    build: { torso: 1.3, shoulder: 1.42, arm: 1.3, hand: 1.34, neck: 1.26, skull: 1.06, jaw: 1.18, leg: 1.24 },
    zones: [
      torso('plate', 1.14, 1.58, 0.03),
      arms('plate', 1.12, 1.44, 0.024),
      pelvis('plate'),
      legs('plate', 0.42, 0.96, 0.024),
      torso('gold', 1.3, 1.4, 0.036), // a band across the chest
    ],
    mats: { plate: DAEDRA_RAMPS.ironDark, gold: DAEDRA_RAMPS.gilt },
    hideRamp: 'lordflesh',
    bootRamp: 'ironDark',
    horns: { len: 0.26, thick: 0.024, sweep: 0.85, skull: 0.106 },
    // NO CLOAK. He had a Formal Cloak, and on a 1.3 torso with a 1.42
    // shoulder the drape fit scaled it to 1.49 — a tent that swallowed
    // the plate, the gold band and the horns, and left a grey slab with
    // a small head on it. The fit was doing exactly what it should; the
    // garment was simply wrong for the wearer.
    //
    // A lord's authority is his MASS and the horns. He is already the
    // broadest thing in the file; a cloak on top of that is not more
    // imposing, it is just larger.
    drape: null,
  },
  {
    id: MOBILE_TYPES.DaedraSeducer,
    name: 'Daedra Seducer',
    level: 19,
    damage: [15, 50],
    weaponTier: 2,
    // The only daedra here trying to look like something you would
    // follow, which is the whole of its threat. Slight where the others
    // are broad, pale where they are lurid, and the gold is the only
    // ornament in the file that is worn rather than grown.
    build: { torso: 0.94, shoulder: 0.96, arm: 0.92, hand: 0.94, neck: 0.94, skull: 0.98, jaw: 0.94, leg: 0.96 },
    zones: [torso('gold', 1.24, 1.36, 0.022), pelvis('gold', 0.9, 1.06, 0.02)],
    mats: { gold: DAEDRA_RAMPS.gilt },
    hideRamp: 'fair',
    bootRamp: 'fair',
    // Small horns: it is still a daedra, and that is the tell.
    horns: { len: 0.11, thick: 0.013, sweep: 0.95, skull: 0.098 },
    drape: { name: 'Toga', mat: 'gold' },
  },
];

/** The same shape every other opts function returns. */
export function daedraOpts(design, pal) {
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
  const hide = ramp(DAEDRA_RAMPS[design.hideRamp]);
  const drape = design.drape ? { name: design.drape.name, ramp: mats[design.drape.mat] } : null;
  return {
    drape,
    ramps: { skin: hide, boot: ramp(DAEDRA_RAMPS[design.bootRamp]) },
    opts: { build: design.build, clothZones: design.zones, armorZones: [], mats },
    hide,
  };
}
