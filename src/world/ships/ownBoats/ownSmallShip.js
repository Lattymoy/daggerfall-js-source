// OUR SMALL SHIP - Come Sail Away's hull 2 (prefab 112412), built here: the hull Mac's galleon
// (world/ships/galleonModel.js) stands in for, what stands when her model will not, and where she takes her small
// things from (her anchor, her cargo, her stove, her lanterns' poles and hooks, her pennant, her wake, her Modifiers).
// Two masts with a large lateen each; a hold, a lower deck behind a door, a main deck between a poop and a
// forecastle, stairs between them. Every node the runtime walks keeps the name and the place Come Sail Away 2.1 gave
// it. Not a DFU member.
import * as P from './ownBoatParts.js';
import {
  nodeOf,
  yaw,
  modifiers,
  wakeObject,
  flagObject,
  poleShort,
  standPlank,
  hook,
  hanging,
  crew,
  boardTrigger,
  fishedAnchor,
  letGoAnchor,
} from './ownBoatKit.js';
import { sailBench, foreAftPoses } from './ownBoatSails.js';
import { clip, heldCurve } from './ownBoatAnimation.js';
import { quatEuler } from '../../unityAnimator.js';

export const SMALL_SHIP_ID = 112412;
/** Her stations aft to fore (her hull node's frame). */
export const SMALL_SHIP_STATIONS = Object.freeze([
  { z: -24.25, b: 3.6, g: 10.8, k: 5.0, f: 0.4 },
  { z: -23.0, b: 4.6, g: 10.8, k: 4.0, f: 0.4 },
  { z: -20.0, b: 6.9, g: 10.9, k: -1.0, f: 0.35 },
  { z: -14.0, b: 8.1, g: 10.7, k: -3.0, f: 0.3 },
  { z: -12.7, b: 8.25, g: 10.7, k: -3.2, f: 0.3 },
  { z: -12.4, b: 8.28, g: 7.75, k: -3.25, f: 0.3 },
  { z: -6.0, b: 8.43, g: 7.75, k: -3.35, f: 0.3 },
  { z: 4.0, b: 8.3, g: 7.75, k: -3.35, f: 0.3 },
  { z: 12.6, b: 6.8, g: 7.9, k: -2.9, f: 0.35 },
  { z: 12.9, b: 6.7, g: 10.6, k: -2.85, f: 0.35 },
  { z: 15.0, b: 5.6, g: 10.8, k: -2.2, f: 0.45 },
  { z: 18.5, b: 2.6, g: 10.8, k: -0.5, f: 0.6 },
  { z: 19.88, b: 0.1, g: 10.5, k: 3.0, f: 0.8 },
]);
const THICKNESS = 0.12;
/** Her decks' heights: the hold, the lower deck, the main deck, the poop's and the forecastle's tops. */
export const SMALL_SHIP_DECKS = Object.freeze({ hold: 0.4, lower: 3.644, main: 6.767, poop: 9.93, fore: 10.2 });
/** Her main deck's planking, its underside under its top (the deckhead over her stove: world/ships/galleonModel.js STOVE). */
const MAIN_PLANK = 0.029;
/** The poop's front and the forecastle's after face (z). */
const POOP_Z = -12.6,
  FORE_Z = 12.9;
/** Her masts' feet and heights: the fore and the main. */
const MASTS = Object.freeze({
  fore: Object.freeze({ at: Object.freeze([-0.0081, 6.8392, 7.3749]), h: 18.85 }),
  main: Object.freeze({ at: Object.freeze([-0.0081, 6.815, -5.8121]), h: 17.52 }),
});
/** Her main deck's well down to her lower deck, its stair rising aft to her main deck. */
const WELL = Object.freeze({ x0: 0.55, x1: 1.85, z0: 2.0, z1: 7.6 });
/** The lower deck's door, hinged at its node, and the bulkhead it hangs in. */
const DOOR = Object.freeze({ at: Object.freeze([0.0941, 4.7318, -2.6824]), w: 1.4, h: 2.175 });

function hullGeometry() {
  const stations = SMALL_SHIP_STATIONS,
    decks = SMALL_SHIP_DECKS;
  const b = P.bench();
  P.hullSkin(b, stations, THICKNESS);
  P.deck(b, stations, THICKNESS, { y: decks.hold, z0: -15, z1: 9, under: null });
  P.deck(b, stations, THICKNESS, { y: decks.lower, z0: -20.5, z1: 12.5 });
  P.deck(b, stations, THICKNESS, { y: decks.main, z0: -20.6, z1: FORE_Z, holes: [WELL], thick: MAIN_PLANK });
  P.deck(b, stations, THICKNESS, { y: decks.poop, z0: -21.2, z1: POOP_Z, under: 'beams' });
  P.deck(b, stations, THICKNESS, { y: decks.fore, z0: FORE_Z, z1: 18.3, under: 'beams' });
  P.bulkhead(b, stations, THICKNESS, {
    z: POOP_Z,
    y0: decks.main,
    y1: decks.poop,
    door: { x0: -0.75, x1: 0.75, top: 9.0 },
    facing: 1,
  });
  P.bulkhead(b, stations, THICKNESS, {
    z: FORE_Z,
    y0: decks.main,
    y1: decks.fore,
    door: { x0: -0.7, x1: 0.7, top: 9.1 },
    facing: -1,
  });
  const dz = DOOR.at[2];
  P.bulkhead(b, stations, THICKNESS, {
    z: dz,
    y0: decks.lower,
    y1: decks.main,
    door: { x0: DOOR.at[0], x1: DOOR.at[0] + DOOR.w, top: decks.lower + DOOR.h + 0.02 },
    facing: 1,
  });
  P.stairFlight(b, { x: 1.2, w: 1.2, z0: 7.6, y0: decks.lower, z1: 2.0, y1: decks.main });
  // its well railed a metre high on her main deck, either side and at its foot's end, open at its head
  for (const x of [WELL.x0 - 0.03, WELL.x1 + 0.03])
    P.block(b, 'trim', [x, decks.main + 0.5, (WELL.z0 + WELL.z1) / 2], [0.03, 0.5, (WELL.z1 - WELL.z0) / 2]);
  P.block(
    b,
    'trim',
    [(WELL.x0 + WELL.x1) / 2, decks.main + 0.5, WELL.z1 + 0.03],
    [(WELL.x1 - WELL.x0) / 2 + 0.06, 0.5, 0.03],
  );
  P.stairFlight(b, { x: 3.4, w: 1.1, z0: -6.4, y0: decks.main, z1: POOP_Z, y1: decks.poop });
  P.stairFlight(b, { x: -3.2, w: 1.1, z0: 7.0, y0: decks.main, z1: FORE_Z, y1: decks.fore });
  return b.finish();
}

/** Her helm's clips over the Rudder Wheel Controller: the wheel turned and the rudder put over, ten steps a side. */
function helmClips(prefix) {
  const out = {};
  const swap = [];
  for (const [side, sgn] of [
    ['Left', 1],
    ['Right', -1],
  ])
    for (let step = 0; step < 5; step++) {
      const turn = sgn * (0.2 + 0.2 * step);
      const n = `${prefix} Sailing ${side} ${step}`;
      out[n] = clip(n, [
        heldCurve('GalleonWhelWell/GalleonWheel', 'rotation', quatEuler(0, 0, turn * 270)),
        heldCurve('GalleonRudder', 'euler', [0, turn * 35, 0]),
      ]);
      swap.push([`Rudder Wheel Sailing ${side} ${step}`, n]);
    }
  return { clips: out, override: { base: 'Rudder Wheel Controller', clips: swap } };
}

/** The small ship's prefab. */
export function buildSmallShip(k, anim) {
  const root = String(SMALL_SHIP_ID);
  const stations = SMALL_SHIP_STATIONS,
    decks = SMALL_SHIP_DECKS;
  const sailMaker = sailBench(k, 'own/smallShip');
  const mast = (name, spec) =>
    k.part(name, `own:smallShip:${name}`, () => P.mastGeometry(spec.h, 0.3, 0.16), { p: spec.at, collider: true });
  /** A lateen on her mast; `scale` < 1 the fore's cut sewn smaller, her yard with it. */
  const lateen = (boom, sail, spec, poses, scale = 1) =>
    k.part(
      boom,
      `own:smallShip:${boom}`,
      () => P.sparGeometry(...poses.yard.map((e) => e.map((value) => value * scale)), 0.18),
      {
        p: spec.at,
        kids: [sailMaker.sail(sail, foreAftPoses(poses.sail), undefined, scale)],
      },
    );
  const foreSail = {
    yard: [
      [0, 4.0, 9.4],
      [0, 20.8, -8.2],
    ],
    sail: {
      throat: [0, 4.2, 9.2],
      peak: [0, 20.5, -8.0],
      tack: [0, 4.2, 9.2],
      clew: [0, 2.6, -7.8],
      belly: 1.6,
      furl: 'head',
    },
  };
  /** The main lateen: the fore's, cut at MAIN_CUT of it. */
  const MAIN_CUT = 0.88;
  const overrideName = 'own/smallShip/Rudder';
  const helm = helmClips(overrideName);
  Object.assign(anim.clips, helm.clips);
  anim.overrides[overrideName] = helm.override;
  const outside = (z, y, pad) => P.outerWidth(stations, z, y) + pad;
  const ladder = (side) =>
    k.part(
      side > 0 ? 'GalleonRightRopeLadder' : 'GalleonLeftRopeLadder',
      `own:ladder:7.4:${side}`,
      () => P.ladderGeometry(7.4, 0.6, side * 0.12),
      {
        p: [side * outside(-2.37, 7.6, 0.02), 7.7, -2.37],
      },
    );
  const anchorAt = [outside(15.9, 6.0, 0.5), 6.0, 15.9];
  const kids = [
    lateen('GalleonLateenBoom', 'GalleonLargeLateenSail', MASTS.fore, foreSail),
    mast('GalleonMast2', MASTS.main),
    mast('GalleonMast', MASTS.fore),
    lateen('GalleonLateenBoom2', 'GalleonLargeLateen2Sail', MASTS.main, foreSail, MAIN_CUT),
    k.part('GalleonInteriorEntrance', 'own:door:1.4:2.175', () => P.doorGeometry(DOOR.w, DOOR.h, 0.1), {
      p: DOOR.at,
      collider: true,
      convex: true,
      c: [
        k.comp({
          type: 'Animator',
          m_Enabled: true,
          m_Controller: { controller: 'Door Controller' },
          m_ApplyRootMotion: false,
        }),
      ],
      kids: [nodeOf('DoorTrigger')],
    }),
    k.part('GalleonHammock', 'own:hammock', () => P.hammockGeometry(), {
      p: [4.3708, decks.main, -15.4301],
      r: yaw(90),
    }),
    crew('OfficerStanding1', '182_025', [2.2625, 9.9325, -18.8592], 'StatusTrigger'),
    k.part('GalleonCargo', 'own:cargo', () => P.cargoGeometry(), { p: [3.6624, 9.9325, -19.385], r: yaw(-30) }),
    nodeOf('DriveTrigger', { p: [0, 10.915, -15.587] }),
    nodeOf('DrivePosition', { p: [-0.5459, 10.915, -16] }),
    boardTrigger([7.9932, 2.16, -2.3635], [-1.0139, 1.5601, -0.099], yaw(-90)),
    boardTrigger([-7.8516, 1.649, -2.2756], [0.9667, 1.7304, -0.1283], yaw(90)),
    nodeOf('RudderObject', {
      p: [0.0058, 0.8039, -5.7304],
      c: [
        k.comp({
          type: 'Animator',
          m_Enabled: true,
          m_Controller: { controller: overrideName },
          m_ApplyRootMotion: false,
        }),
      ],
      kids: [
        k.part('GalleonWhelWell', 'own:pedestal', () => P.pedestalGeometry(0.95), {
          p: [-0.0058, 9.111, -8.8517],
          kids: [k.part('GalleonWheel', 'own:wheel', () => P.helmWheelGeometry(0.75), { p: [0, 0.95, -0.438] })],
        }),
        k.part('GalleonRudder', 'own:smallShip:rudder', () => P.rudderBladeGeometry(6.4, 2.6, 0.24, 5.2), {
          p: [-0.0058, 0.3561, -17.7234],
        }),
      ],
    }),
    nodeOf('BedObject', { p: [4.42, 3.906, -14.522], r: yaw(-90) }),
    nodeOf('ActiveObject', { kids: [fishedAnchor(k, 'GalleonAnchor', stations, anchorAt[2], anchorAt[1])] }),
    nodeOf('IdleObject', {
      kids: [ladder(1), ladder(-1), letGoAnchor(k, 'GalleonAnchorDeployed', stations, anchorAt[2], anchorAt[1])],
    }),
    standPlank(k, 'LanternHookStandPlank', [0.755, decks.main, -2.81], yaw(180)),
    hook(k, 'LanternHook', [0, 11.29, -5.9571]),
    hook(k, 'LanternHook (1)', [2.679, 8.9421, 12.82]),
    hook(k, 'LanternHook (2)', [5, 8.9536, -12.434], yaw(180)),
    hook(k, 'LanternHook (3)', [-5, 8.9536, -12.434], yaw(180)),
    poleShort(k, 'LanternHookStandPoleShort', [5.107, 10.923, -19.839], yaw(-60)),
    poleShort(k, 'LanternHookStandPoleShort (1)', [-5.102, 10.923, -19.804], yaw(60)),
    ...[
      [0.016, -8.0199],
      [0, 5.129],
      [0, 9.538],
      [4.333, -1.052],
      [4.91, -10.128],
      [-4.09, -3.48],
      [-3.6255, 2.6195],
      [0, 10.0404],
      [-4.09, -9.807],
    ].map(([x, z], i) => hanging(i ? `LanternHanging (${i})` : 'LanternHanging', [x, 6.7376, z])),
    hanging('LanternHanging', [-0.1431, 6.7376, -16.899]),
    hanging('LanternHanging (1)', [0, 9.86, -16.331]),
    flagObject(k, [0, 24.636, -5.9571], [3, 3, 8]),
    crew('Boatswain', '182_035', [-2.95, decks.main - 0.0033, 3.38], 'VariantTrigger'),
    crew('Coxswain', '346_006', [-2.249, 9.9325, -18.9766], 'PositionTrigger'),
    crew('Master-At-Arms', '183_004', [-2.9, decks.main - 0.0033, -10.9]),
    crew('Quartermaster', '182_020', [1.68, decks.main - 0.0033, 9.98], 'CargoTrigger'),
    crew('Cook', '182_008', [-3.3873, 3.6442, 1.884]),
    k.part('Stove', 'own:stove', () => P.stoveGeometry(), {
      p: [-5.358, 3.6677, 0.336],
      r: yaw(45),
      kids: [
        k.part('StovePipe', 'own:stovePipe', () => P.stovePipeGeometry(), { p: [0, 2.3941, -0.3857], r: yaw(45) }),
        nodeOf('FireObject', { p: [0, 1.2064, 0.5301] }),
      ],
    }),
  ];
  Object.assign(anim.clips, sailMaker.clips);
  Object.assign(anim.overrides, sailMaker.overrides);
  const hull = k.part('Galleon', 'own:smallShip:hull', hullGeometry, { collider: true, kids });
  return nodeOf(root, {
    kids: [
      wakeObject(k, {
        at: [0, 0.1, 0],
        s: 20,
        bow: [0, 0, 0.479],
        wave: { s: [2, 2, 2], speed: 0.1, size: [0.06, 0.12] },
      }),
      hull,
      modifiers([
        ['HandlingOar', { p: [0.5, 0.25, 0], s: [0.5, 0.25, 1] }],
        ['HandlingSail', { p: [1, 1, 0], s: [1, 0.75, 1] }],
        ['Crewed', {}],
        ['HandlingAnimation', { p: [0.6, 0, 0] }],
        ['HandlingRudder', { p: [0.75, 0, 0] }],
        ['Audio', { p: [1, 2, 1] }],
        ['Cargo', { p: [2, 0, 0] }],
      ]),
    ],
  });
}
