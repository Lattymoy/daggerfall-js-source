// OWN-WORK4 (2026-10-31): OUR LARGE BOAT - Come Sail Away's hull 1 (prefab 112411), built here: the hull Mac's large
// boat (world/ships/largeBoatModel.js) stands in for, and what stands when his model will not. Its seven sail plans
// are the mod's own by their names and their order (`Variants`, the player cycling them at the VariantTrigger), each
// sail ours; the nodes its runtime walks keep the names and places Come Sail Away 2.1 gave them. Not a DFU member.
import * as P from './ownBoatParts.js';
import {
  nodeOf,
  yaw,
  modifiers,
  wakeObject,
  waterPlane,
  waterCull,
  poleShort,
  poleTall,
  flagObject,
  rudderEffect,
} from './ownBoatKit.js';
import { sailBench, squarePoses, foreAftPoses, stayPoses } from './ownBoatSails.js';
import { clip, sampled, heldCurve } from './ownBoatAnimation.js';

export const SKIFF_ID = 112411;
/** Her stations aft to fore, in her hull node's frame (0.1 over her root). */
export const SKIFF_STATIONS = Object.freeze([
  { z: -5.99, b: 1.25, g: 1.36, k: 0.2, f: 0.5 },
  { z: -5.0, b: 1.75, g: 1.3, k: -0.45, f: 1.2 },
  { z: -3.0, b: 2.05, g: 1.25, k: -0.7, f: 1.8 },
  { z: 0.0, b: 2.13, g: 1.22, k: -0.74, f: 1.9 },
  { z: 2.5, b: 2.0, g: 1.26, k: -0.7, f: 1.8 },
  { z: 4.5, b: 1.5, g: 1.36, k: -0.5, f: 0.6 },
  { z: 5.8, b: 0.75, g: 1.45, k: -0.15, f: 0.7 },
  { z: 6.51, b: 0.03, g: 1.44, k: 0.6, f: 0.8 },
]);
const THICKNESS = 0.05;
/** Her mast's foot (every boom pivots on its axis there) and its two heights. */
export const SKIFF_MAST = Object.freeze({ at: Object.freeze([0.0054, 0.0851, 1.3369]), short: 5.86, tall: 9.24 });

function hullGeometry() {
  const b = P.bench();
  P.hullSkin(b, SKIFF_STATIONS, THICKNESS);
  P.deck(b, SKIFF_STATIONS, THICKNESS, { y: 0, z0: -5.4, z1: 4.8, under: null });
  P.deck(b, SKIFF_STATIONS, THICKNESS, { y: 1.0, z0: 4.6, z1: 6.3 });
  for (const z of [-3.4, -1.65, 1.65]) P.thwart(b, P.innerWidth(SKIFF_STATIONS, THICKNESS, z, 0.7), 0.7, z, 0.26);
  return b.finish();
}

/** Each sail's own numbers by its name (its kind and its size the mod's: its handling). */
const SAIL = Object.freeze({
  SkiffLargeLateenSail: () =>
    foreAftPoses({
      throat: [0, 1.5, 3.3],
      peak: [0, 8.2, -3.4],
      tack: [0, 1.5, 3.3],
      clew: [0, 1.25, -3.3],
      belly: 0.7,
      furl: 'head',
    }),
  SkiffSmallGaffSail2: () =>
    foreAftPoses({
      throat: [0, 5.0, -0.12],
      peak: [0, 5.9, -2.7],
      tack: [0, 1.35, -0.12],
      clew: [0, 1.3, -3.0],
      belly: 0.45,
    }),
  SkiffSmallGaffSail1: () =>
    foreAftPoses({
      throat: [0, 8.9, -0.12],
      peak: [0, 8.9, -0.16],
      tack: [0, 5.2, -0.12],
      clew: [0, 5.9, -2.6],
      belly: 0.3,
    }),
  SkiffLargeGaffSail: () =>
    foreAftPoses({
      throat: [0, 6.4, -0.12],
      peak: [0, 7.7, -3.9],
      tack: [0, 1.35, -0.12],
      clew: [0, 1.3, -4.3],
      belly: 0.6,
    }),
  SkiffLargeSquareSail: () => squarePoses({ head: 3.0, foot: 3.3, drop: 2.6, d: 0.22, belly: 0.55 }),
  SkiffSmallSquareSail: () => squarePoses({ head: 1.6, foot: 1.8, drop: 1.6, d: 0.16, belly: 0.35 }),
  SkiffSmallStaySail: () => stayPoses({ head: [0, 5.0, 1.55], tack: [0, 1.42, 6.1], clew: [0, 1.4, 2.7], belly: 0.4 }),
  'SkiffLargeStaySail (1)': () =>
    stayPoses({ head: [0, 8.3, 1.55], tack: [0, 1.42, 6.2], clew: [0, 1.35, 1.9], belly: 0.55 }),
});
/** A square sail's yard over the mast's foot. */
const YARD_Y = Object.freeze({ SkiffLargeSquareSail: 5.75, SkiffSmallSquareSail: 8.85 });

/** The seven plans, the mod's order: each its masts, booms (their sails in order) and staysails, and its flag's height. */
const PLANS = Object.freeze([
  { masts: ['SkiffMast'], rig: [['SkiffLateenBoom', ['SkiffLargeLateenSail']]], flag: 5.9475 },
  {
    masts: ['SkiffMast'],
    rig: [['SkiffSmallGaffBoom', ['SkiffSmallGaffSail2']], 'SkiffSmallStaySail'],
    flag: 5.9475,
    mastLast: true,
  },
  {
    masts: ['SkiffMast'],
    rig: [
      ['SkiffSmallGaffBoom', ['SkiffSmallGaffSail2']],
      ['SkiffLargeSquareBoom', ['SkiffLargeSquareSail']],
      'SkiffSmallStaySail',
    ],
    flag: 5.9475,
  },
  {
    masts: ['SkiffLargeMast'],
    rig: [
      ['SkiffSmallSquareBoom', ['SkiffSmallSquareSail']],
      ['SkiffLateenBoom', ['SkiffLargeLateenSail']],
    ],
    flag: 9.3269,
    mastLast: true,
  },
  {
    masts: ['SkiffLargeMast (1)'],
    rig: ['SkiffLargeStaySail (1)', ['SkiffSmallGaffBoom (1)', ['SkiffSmallGaffSail1', 'SkiffSmallGaffSail2']]],
    flag: 9.3269,
    mastLast: true,
  },
  {
    masts: ['SkiffLargeMast'],
    rig: [
      ['SkiffLargeGaffBoom', ['SkiffLargeGaffSail']],
      ['SkiffSmallSquareBoom', ['SkiffSmallSquareSail']],
      'SkiffSmallStaySail',
    ],
    flag: 9.3269,
    mastAt: 2,
  },
  {
    masts: ['SkiffLargeMast'],
    rig: [
      ['SkiffLargeSquareBoom', ['SkiffLargeSquareSail']],
      ['SkiffSmallSquareBoom', ['SkiffSmallSquareSail']],
    ],
    flag: 9.3269,
    mastLast: true,
  },
]);

/** A boom's spars: a square sail's yard, a gaff's boom and gaff, a lateen's yard - in the boom's frame. */
function sparsOf(sails) {
  const b = P.bench();
  const first = sails[0];
  const spar = P.sparGeometry;
  if (YARD_Y[first] != null) {
    const half = first === 'SkiffLargeSquareSail' ? 3.35 : 1.85;
    return spar(
      [-half, YARD_Y[first], 0.12],
      [half, YARD_Y[first], 0.12],
      first === 'SkiffLargeSquareSail' ? 0.07 : 0.05,
    );
  }
  if (first === 'SkiffLargeLateenSail') return spar([0, 1.4, 3.5], [0, 8.4, -3.6], 0.07);
  const top = sails.includes('SkiffSmallGaffSail2')
    ? [
        [0, 5.0, -0.12],
        [0, 5.9, -2.75],
      ]
    : [
        [0, 6.4, -0.12],
        [0, 7.7, -3.95],
      ];
  const foot = sails.includes('SkiffLargeGaffSail') ? [0, 1.3, -4.4] : [0, 1.3, -3.1];
  P.block(b, 'spar', [0, 1.32, foot[2] / 2], [0.05, 0.05, Math.abs(foot[2]) / 2]);
  const geometry = b.finish();
  const gaff = spar(top[0], top[1], 0.05);
  return P.merge(geometry, gaff);
}
/** Her rudder's clips: sculled when rowed, put over when she sails (the Rudder Controller's slots). */
function rudderClips(prefix) {
  const out = {};
  const scull = (name, bias, dir) => {
    const n = `${prefix} ${name}`;
    out[n] = clip(
      n,
      [
        sampled('OldSkiffRudder', 'euler', 2, 30, (time) => [
          0,
          bias + dir * 24 * Math.sin((time / 2) * Math.PI * 2),
          0,
        ]),
      ],
      {
        length: 2,
        dense: 30,
      },
    );
    return n;
  };
  const pose = (name, deg) => {
    const n = `${prefix} ${name}`;
    out[n] = clip(n, [heldCurve('OldSkiffRudder', 'euler', [0, deg, 0])]);
    return n;
  };
  const swap = [
    ['clips/Rudder Rowing Forward', scull('Rowing Forward', 0, 1)],
    ['clips/Rudder Rowing Backward', scull('Rowing Backward', 0, -1)],
    ['clips/Rudder Rowing Left', scull('Rowing Left', 14, 1)],
    ['clips/Rudder Rowing Right', scull('Rowing Right', -14, 1)],
    ['clips/Rudder Rowing Center', pose('Rowing Center', 0)],
    ['clips/Rudder Sailing Left', pose('Sailing Left', 30)],
    ['clips/Rudder Sailing Right', pose('Sailing Right', -30)],
  ];
  return { clips: out, override: { base: 'Rudder Controller', clips: swap } };
}

/** The large boat's prefab. */
export function buildSkiff(k, anim) {
  const root = String(SKIFF_ID);
  const hullPath = `${root}/OldSkiffHull`;
  const sailMaker = sailBench(k, 'own/skiff');
  const mastNode = (name) =>
    k.part(
      name,
      `own:skiff:${name.startsWith('SkiffLarge') ? 'tallMast' : 'mast'}`,
      () => P.mastGeometry(name.startsWith('SkiffLarge') ? SKIFF_MAST.tall : SKIFF_MAST.short, 0.1, 0.06),
      { p: SKIFF_MAST.at },
    );
  const variant = (plan, index) => {
    const kids = [];
    const rigged = plan.rig.map((spar) => {
      if (typeof spar === 'string') return sailMaker.sail(spar, SAIL[spar](), 'Staysail Controller');
      const [boom, sails] = spar;
      const key = `own:skiff:boom:${sails.join('+')}`;
      return k.part(boom, key, () => sparsOf(sails), {
        p: SKIFF_MAST.at,
        kids: sails.map((sail) => {
          const node = sailMaker.sail(sail, SAIL[sail]());
          if (YARD_Y[sail] != null) node.position = [0, YARD_Y[sail], 0];
          return node;
        }),
      });
    });
    const masts = plan.masts.map(mastNode);
    if (plan.mastLast) kids.push(...rigged, ...masts);
    else if (plan.mastAt != null) kids.push(...rigged.slice(0, plan.mastAt), ...masts, ...rigged.slice(plan.mastAt));
    else kids.push(...masts, ...rigged);
    kids.push(flagObject(k, [0, plan.flag, 1.2923]));
    return nodeOf(String(index), { active: false, kids });
  };
  const overrideName = 'own/skiff/Rudder';
  const rudderSet = rudderClips(overrideName);
  Object.assign(anim.clips, rudderSet.clips);
  anim.overrides[overrideName] = rudderSet.override;
  const rudder = k.part(
    'OldSkiffRudder',
    'own:skiff:rudder',
    () => P.merge(P.rudderBladeGeometry(1.85, 0.7, 0.08, 0.35), P.tillerGeometry(1.55)),
    {
      kids: [
        rudderEffect(k, {
          rootName: root,
          path: `${hullPath}/RudderObject/OldSkiffRudder`,
          p: [0, -1.0, -0.62],
          size: 0.2,
        }),
      ],
    },
  );
  const hull = k.part('OldSkiffHull', 'own:skiff:hull', hullGeometry, {
    p: [0, 0.1, 0],
    collider: true,
    kids: [
      nodeOf('Variants', { kids: PLANS.map(variant) }),
      poleTall(k, 'LanternHookStandPoleTall', [0.0114, 1.443, 6.3523], yaw(180)),
      poleShort(k, 'LanternHookStandPoleShort', [-1.3248, 1.123, -3.1047], [0, 0.6088, 0, 0.7934]),
      nodeOf('IdleObject', {
        p: [0, -0.3, 0],
        kids: [
          nodeOf('BillboardHelper-253_015:2', { p: [0.0127, 1.7887, 6.5111] }),
          nodeOf('BoardTrigger', {
            p: [0.013, 0.3, 6.511],
            s: [1, 3, 1],
            kids: [nodeOf('BoardPosition', { p: [0, 0.6, -2.5111], r: yaw(180) })],
          }),
        ],
      }),
      nodeOf('ActiveObject', {
        p: [0, -0.3, 0],
        kids: [
          k.part('SkiffAnchor', 'own:anchorStowed:0.6', () => P.anchorStowedGeometry(0.6), {
            p: [0.0136, 1.3346, 5.4306],
          }),
        ],
      }),
      nodeOf('FireObject', { p: [0, 0, 3], active: false }),
      nodeOf('BedObject', { p: [0, 0.75, -1.715], active: false }),
      k.part('SkiffCargo', 'own:cargo', () => P.cargoGeometry(), { p: [0.0032, 0.0836, 0.8345] }),
      nodeOf('CargoTrigger', { p: [0.0032, 0.1836, 0.8345] }),
      nodeOf('RudderObject', {
        p: [0.0058, 1.2539, -5.7304],
        c: [
          k.comp({
            type: 'Animator',
            m_Enabled: true,
            m_Controller: { controller: overrideName },
            m_ApplyRootMotion: false,
          }),
        ],
        kids: [rudder],
      }),
      nodeOf('DrivePosition', { p: [0, 1.1, -4] }),
      nodeOf('DriveTrigger', { p: [0, 0.7055, -3.5623] }),
      mastNode('SkiffMast'),
      waterCull(k, 'OldSkiffHullWaterCull', 'own:skiff:waterCull', 2.0, -5.5, 6.0, { p: [0, 1.1364, 0] }),
      nodeOf('VariantTrigger', { p: [0.0032, 2, 1.349], s: [0.5, 3, 0.5] }),
    ],
  });
  Object.assign(anim.clips, sailMaker.clips);
  Object.assign(anim.overrides, sailMaker.overrides);
  return nodeOf(root, {
    kids: [
      wakeObject(k, { at: [0, 0.1, 0], s: 10, bow: [0, 0, 0.344], wave: { speed: 0.12, size: [0.15, 0.3] } }),
      hull,
      modifiers([
        ['HandlingOar', { p: [1, 1, 0] }],
        ['HandlingSail', { p: [1, 1, 0] }],
        ['HandlingAnimation', { p: [0.8, 0, 0] }],
        ['HandlingRudder', { p: [1, 0, 0] }],
        ['Audio', { p: [1, 1, 1] }],
        ['Packable', {}],
        ['Cargo', { p: [1, 0, 0] }],
      ]),
      waterPlane(k),
    ],
  });
}
