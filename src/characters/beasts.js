import { MOBILE_TYPES } from './mobileTypes.js';

// ═══════════════════════════════════════════════════════════════════
// THE BEASTS
//
// Rat, Grizzly Bear and Sabertooth Tiger: the first enemies in this
// project with no human in them at all.
//
// EVERY DESIGN SO FAR HAS BEEN A PERSON UNDERNEATH. An orc is a person
// scaled, a skeleton is a person stripped, a lich is a person in robes,
// and even the centaur is a person from the waist up with something
// hung off him. These are not. The rig's whole body is COLLAPSED — the
// centaur's mechanism, which moved two leg groups to a point inside the
// barrel, applied to all six groups — and what the player sees is
// entirely the piece.
//
// WHICH MEANS THE RIG IS DOING NOTHING BUT CARRYING THEM, and that is
// fine: it holds the face list at 2136 so they still ship as deltas, it
// gives them a transform to ride, and it means an animal animates
// through the same path a man does. Teaching buildNeutralBody to drop
// groups would have cost every caller that counts on the count.
//
// ONE BUILDER, THREE ANIMALS. A rat is long and low with a bare tail; a
// bear is a mountain on short legs; a tiger is longer again on longer
// ones. Those are NUMBERS, so the fourth quadruped costs a design rather
// than a file — the same bet the class file made and won.
// ═══════════════════════════════════════════════════════════════════

/** ART_PAL spans, same convention as the other lines. */
export const BEAST_RAMPS = Object.freeze({
  // block 2 - tan -> brown. Rat: the colour of something that lives in
  // a wall — but taken high enough to have a silhouette. At [36,46] it
  // meant 77 and would have been the same invisible animal the wereboar
  // and the spider both were.
  vermin: [32, 40],
  // block 11 - rust -> dark brown. A grizzly: still the darkest thing on
  // four legs here, and now light enough to be one.
  grizzly: [176, 184],
  // block 9 - yellow -> olive. A sabertooth's coat, which has to be
  // BRIGHT or it reads as another bear in the dark.
  tawny: [146, 155],
  // block 4 - cream -> tan. Underbelly, and the pale of a muzzle.
  pale: [64, 72],
  // block 7 - white -> charcoal, taken dark. A werewolf's coat: grey
  // going to black, and nothing warm anywhere in it.
  wolfGrey: [116, 124],
  // block 2, and NOT its dark end. A wereboar's bristle was [40,47] and
  // resolved to a mean of 58 against a background of about 20 — the only
  // pelt in this line dark enough to lose its own silhouette. It read
  // narrower than a werewolf despite being measurably WIDER, because the
  // edges went into the dark. Coarse and brown, but a boar you can see.
  bristle: [34, 42],
  // block 5 - lavender grey -> slate, taken HIGH. Chitin: the only thing
  // in this file that is neither fur nor skin.
  //
  // It was [84,91], mean 100, which cleared the contrast gate at 70 and
  // was still lost against the dark — a spider is a small body on thin
  // legs, so it has far less area to be seen with than a wereboar and
  // needs more brightness for the same read. The gate's floor was set
  // by the thing that failed rather than by the thing that has to pass.
  chitin: [80, 86],
  // block 9 - yellow -> olive, bright. A scorpion's carapace, which is
  // the colour of something that wants to be seen and left alone.
  carapace: [148, 156],
});

export const BEAST_DESIGNS = [
  {
    id: MOBILE_TYPES.Rat,
    name: 'Giant Rat',
    level: 1,
    damage: [1, 4],
    weaponTier: 0,
    // Long, low and mostly tail. The lowest thing in the project — a rat
    // that stands at a man's knee is a dog.
    beast: {
      back: 0.26,
      len: 0.6,
      girth: 0.09,
      legs: 0.028,
      crouch: 0.8,
      head: 0.075,
      snout: 0.09,
      tail: 0.42,
      tailUp: 0.05,
    },
    pelt: 'vermin',
  },
  {
    id: MOBILE_TYPES.GrizzlyBear,
    name: 'Grizzly Bear',
    level: 8,
    damage: [1, 20],
    weaponTier: 0,
    // A mountain on short legs, and almost no tail: the bear's mass is
    // the whole of it, so the barrel is nearly as wide as it is tall.
    beast: {
      back: 0.8,
      len: 1.0,
      girth: 0.24,
      legs: 0.075,
      crouch: 0.25,
      head: 0.15,
      snout: 0.09,
      tail: 0.06,
      tailUp: 0.2,
    },
    pelt: 'grizzly',
  },
  {
    id: MOBILE_TYPES.SabertoothTiger,
    name: 'Sabertooth Tiger',
    level: 10,
    damage: [1, 25],
    weaponTier: 0,
    // Longer than the bear on longer legs and half its width: a cat is
    // built to cover ground, not to hold it. Carries its tail up.
    beast: {
      back: 0.72,
      len: 1.1,
      girth: 0.18,
      legs: 0.055,
      crouch: 0.35,
      head: 0.13,
      snout: 0.08,
      tail: 0.55,
      tailUp: 0.35,
    },
    pelt: 'tawny',
  },
  {
    id: MOBILE_TYPES.Werewolf,
    name: 'Werewolf',
    level: 6,
    damage: [1, 10],
    weaponTier: 0,
    // A DAGGERFALL WEREWOLF IS NOT A WOLF ON FOUR LEGS. It is a man with
    // the wrong head, and that is the whole design: the rig keeps its
    // arms, its legs and its stance, and only the SKULL is replaced.
    //
    // Which makes this the narrowest collapse in the project — one group
    // of six, where the beasts take all of them — and the first design
    // that is human and animal at the same time rather than one or the
    // other. Two systems on one figure, which is the lich's question
    // asked of geometry instead of cloth.
    //
    // Heavier than a man through the chest and arms, because whatever it
    // is now was not built by exercise.
    build: { torso: 1.16, shoulder: 1.24, arm: 1.2, hand: 1.28, neck: 1.18, skull: 1, jaw: 1, leg: 1.12 },
    zones: [],
    mats: {},
    pelt: 'wolfGrey',
    // Only the head goes. Everything else is the man it used to be.
    collapse: ['head'],
    beastHead: { skull: 0.1, snout: 0.15, depth: 0.55, ears: 1, tusks: 0 },
    tail: { len: 0.34, up: 0.25 },
  },
  {
    id: MOBILE_TYPES.Wereboar,
    name: 'Wereboar',
    level: 8,
    damage: [2, 12],
    weaponTier: 0,
    // The same affliction on a different animal: blunter, broader, and
    // with the tusks that are the only reason anyone can tell a wereboar
    // from a very bad man in the dark.
    build: { torso: 1.3, shoulder: 1.3, arm: 1.24, hand: 1.3, neck: 1.3, skull: 1, jaw: 1, leg: 1.18 },
    zones: [],
    mats: {},
    pelt: 'bristle',
    collapse: ['head'],
    beastHead: { skull: 0.11, snout: 0.11, depth: 0.95, ears: 0.5, tusks: 1 },
    tail: { len: 0.12, up: 0.5 },
  },

  {
    id: MOBILE_TYPES.Spider,
    name: 'Giant Spider',
    level: 3,
    damage: [1, 8],
    weaponTier: 0,
    // NO SPINE AT ALL, which is why it has its own builder rather than
    // more numbers on the quadruped's. That builder assumes a backbone
    // with a leg near each corner, and every animal it makes is a
    // variation on that; a spider's legs radiate from one joint in a
    // ring and its body is two lumps rather than a tube.
    //
    // The test of whether a mechanism is right is what happens to the
    // thing that does not fit it. The beasts stretched from a rat to a
    // bear on numbers alone. This does not stretch at all, so it gets a
    // builder, and that is the mechanism telling the truth about its own
    // edges rather than being forced past them.
    arachnid: { span: 0.36, ride: 0.16, thorax: 0.11, abdomen: 0.15, legR: 0.024, arch: 0.6 },
    pelt: 'chitin',
  },
  {
    id: MOBILE_TYPES.GiantScorpion,
    name: 'Giant Scorpion',
    level: 9,
    damage: [1, 20],
    weaponTier: 0,
    // The same plan with things added: claws forward, and a tail that
    // arches UP AND OVER rather than dragging. Lower and flatter than
    // the spider — a scorpion keeps its body near the ground and its
    // threat above it.
    arachnid: { span: 0.26, ride: 0.11, thorax: 0.1, abdomen: 0.1, legR: 0.015, arch: 0.3, claws: 1, sting: 0.5 },
    pelt: 'carapace',
  },

];

/** Every group of the human rig, because none of it is wanted. */
export const ALL_GROUPS = ['body', 'head', 'armL', 'armR', 'legL', 'legR'];

/**
 * The same shape the other opts functions return.
 *
 * The ramps still matter even though the body is collapsed: the rig's
 * faces keep their colours, and a collapsed face has no area but it does
 * still exist. Giving it the pelt rather than leaving it human means
 * that if a collapse ever fails, what shows through is at least the
 * right colour — which is a smaller bug than a human arm inside a bear.
 */
export function beastOpts(design, pal) {
  const ramp = ([a, b]) => {
    const out = [];
    for (let i = b; i >= a; i--) {
      const c = pal.get(i);
      out.push([c.r, c.g, c.b]);
    }
    return out;
  };
  const pelt = ramp(BEAST_RAMPS[design.pelt]);
  return {
    drape: null,
    ramps: { skin: pelt, boot: pelt },
    // A FULL BEAST HAS NO BUILD — its body is collapsed and the piece is
    // everything. A werewolf DOES: it keeps the man's body, so the build
    // is the difference between him and the man he was.
    opts: { build: design.build || {}, clothZones: design.zones || [], armorZones: [], mats: {} },
    hide: pelt,
    pelt,
  };
}
