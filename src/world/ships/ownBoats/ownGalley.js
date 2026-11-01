// OWN-WORK4 (2026-10-31): OUR LARGE GALLEY - Come Sail Away's hull 3 (prefab 112413), built here: a war galley of
// three decks - her rowers' deck, her middle deck and her top deck under an awning at her stern - pulled by 108 oars in
// three banks a side and steered by two great oars at her quarters, with one square sail on her mast. Every node the
// runtime walks keeps the name and the place Come Sail Away 2.1 gave it (her oars' ports, her crew's and rowers'
// posts, her lanterns, her triggers, her helm); the ship, her oars' stroke and her rig are ours. Not a DFU member.
import * as P from './ownBoatParts.js';
import {
  nodeOf,
  yaw,
  modifiers,
  wakeObject,
  waterPlane,
  flagObject,
  poleShort,
  poleTall,
  standPlank,
  hook,
  hanging,
  crew,
  boardTrigger,
  oar,
  rudderEffect,
  fishedAnchor,
  letGoAnchor,
} from './ownBoatKit.js';
import { sailBench, squarePoses } from './ownBoatSails.js';
import { clip, sampled, heldCurve, strokeAt } from './ownBoatAnimation.js';
import { quatEuler } from '../../unityAnimator.js';

export const GALLEY_ID = 112413;
/** Her stations aft to fore (her hull node's frame). */
export const GALLEY_STATIONS = Object.freeze([
  { z: -41.89, b: 0.5, g: 13.94, k: 6.0, f: 0.7 },
  { z: -38.0, b: 5.5, g: 11.6, k: 1.0, f: 0.4 },
  { z: -35.5, b: 8.0, g: 11.1, k: -1.2, f: 0.3 },
  { z: -28.0, b: 9.4, g: 10.95, k: -2.2, f: 0.25 },
  { z: 0, b: 9.7, g: 10.95, k: -2.46, f: 0.25 },
  { z: 24.0, b: 9.4, g: 10.95, k: -2.3, f: 0.25 },
  { z: 30.0, b: 8.6, g: 10.95, k: -1.8, f: 0.28 },
  { z: 33.7, b: 7.6, g: 11.55, k: -1.0, f: 0.3 },
  { z: 38.0, b: 4.6, g: 8.2, k: -0.8, f: 0.4 },
  { z: 44.5, b: 2.4, g: 7.95, k: -0.6, f: 0.5 },
  { z: 51.27, b: 0, g: 2.0, k: -0.8, f: 0.7 },
]);
const THICKNESS = 0.15;
/** Her outriggers' reach: her widest half beam. */
const OUTRIGGER = 11.17;
/** Her decks: the hold, the rowers', the middle, the top, and the bow's. */
export const GALLEY_DECKS = Object.freeze({ hold: 0.3, lower: 3.25, middle: 6.4, top: 10.245, bow: 7.54 });
/** Her bow's breastwork (her top deck's forward edge), and her officers' cabin's front on her middle deck. */
const BREAST_Z = 33.7,
  CABIN_Z = -24.0;
/** Her companion in her top deck, down to her middle deck: an open scuttle, its ladder leaning to its forward edge. */
const COMPANION = Object.freeze({ x0: 3.45, x1: 4.55, z0: 26.8, z1: 28.8 });
/** Her mast's foot and height, her yard's height over it. */
const MAST = Object.freeze({ at: Object.freeze([0.1208, 6.4767, 14.3591]), h: 31.46, yard: 29.97 });
/** Her oars: their ports' rows (z) and banks (x a side, height), each bank's rest and its reach to the water. */
const ROWS = Object.freeze([
  16.465, 13.994, 11.635, 9.227, 6.781, 4.403, 1.942, -0.552, -2.893, -5.336, -7.791, -10.161, -12.461, -14.908,
  -17.308, -19.708, -22.159, -24.523,
]);
const BANKS = Object.freeze([
  Object.freeze({ xl: -10.7936, xr: 10.5571, y: 2.2621 }),
  Object.freeze({ xl: -10.389, xr: 10.152, y: 3.6175 }),
  Object.freeze({ xl: -9.865, xr: 9.629, y: 5.0071 }),
]);
const OAR_REST = 32;
const OAR_LIFT = 0.12;
/** A bank's reach along its oar to the water at rest, and its oar's length outboard. */
const reach = (bank) => (bank.y + OAR_LIFT) / Math.sin((OAR_REST * Math.PI) / 180);
/** Her stroke: two seconds, the blades in from 0 to 1.25 s (the mod's three events). */
const STROKE = Object.freeze({ T: 2, catchAt: 0, inWater: 0.625 });
export const GALLEY_EVENTS = Object.freeze([
  [0, 'OarEvent_In'],
  [0.5, 'OarEvent_Sweep'],
  [1.25, 'OarEvent_Out'],
]);
/** Her steering oars' rake aft from the vertical (degrees about x: the rudder's clips hold it as they turn them). */
const STEERING_RAKE = 35;
/** The door on her rowers' deck, hinged at its node, and the bulkhead it hangs in. */
const DOOR = Object.freeze({ at: Object.freeze([-1.4753, 4.3744, -8.8826]), w: 1.16, h: 2.25 });

function hullGeometry() {
  const stations = GALLEY_STATIONS,
    decks = GALLEY_DECKS;
  const b = P.bench();
  P.hullSkin(b, stations, THICKNESS);
  // her outriggers: the oar boxes along each side her three banks work through, out to her widest half beam
  for (const side of [-1, 1]) P.block(b, 'trim', [side * 10.2, 3.45, 3.5], [OUTRIGGER - 10.2, 1.85, 21.5]);
  P.deck(b, stations, THICKNESS, { y: decks.hold, z0: -30, z1: 30, under: null });
  P.deck(b, stations, THICKNESS, { y: decks.lower, z0: -34, z1: BREAST_Z });
  P.deck(b, stations, THICKNESS, {
    y: decks.middle,
    z0: -34.5,
    z1: BREAST_Z,
    holes: [{ x0: -2.1, x1: -1.1, z0: 1.5, z1: 7.0 }],
  });
  P.deck(b, stations, THICKNESS, { y: decks.top, z0: -35.5, z1: BREAST_Z, holes: [COMPANION], under: 'beams' });
  P.deck(b, stations, THICKNESS, { y: decks.bow, z0: 36.0, z1: 47.0 });
  P.bulkhead(b, stations, THICKNESS, {
    z: BREAST_Z,
    y0: decks.middle,
    y1: 11.55,
    door: { x0: -1.1, x1: 1.1, top: 8.7 },
    facing: -1,
  });
  P.bulkhead(b, stations, THICKNESS, {
    z: DOOR.at[2],
    y0: decks.lower,
    y1: decks.middle,
    door: { x0: DOOR.at[0], x1: DOOR.at[0] + DOOR.w, top: decks.lower + DOOR.h + 0.02 },
    facing: 1,
  });
  // her officers' cabin aft on her middle deck, its door on her middle line: her top deck stays her largest floor
  P.bulkhead(b, stations, THICKNESS, {
    z: CABIN_Z,
    y0: decks.middle,
    y1: decks.top,
    door: { x0: -0.6, x1: 0.6, top: decks.middle + 2.1 },
    facing: 1,
  });
  P.stairFlight(b, { x: -1.6, w: 1.0, z0: 7.0, y0: decks.lower, z1: 1.5, y1: decks.middle });
  // her top deck climbed to by a ladder, no flight: her crew's walk keeps to her top deck, as Come Sail Away's does
  P.steepLadder(b, {
    x: (COMPANION.x0 + COMPANION.x1) / 2,
    z0: COMPANION.z0 + 0.5,
    y0: decks.middle,
    z1: COMPANION.z1 - 0.1,
    y1: decks.top,
  });
  P.stairFlight(b, { x: 0, w: 2.0, z0: BREAST_Z, y0: decks.middle, z1: 36.0, y1: decks.bow });
  return b.finish();
}

/** Her rudder's clips over the Rudder Controller: the 108 oars rowed, held or raised, the two steering oars put over. */
function rudderClips(prefix, oarPaths) {
  const out = {};
  const rudders = (deg) => [
    heldCurve("T'avaTriremeLeftRudder", 'euler', [STEERING_RAKE, deg, 0]),
    heldCurve("T'avaTriremeRightRudder", 'euler', [STEERING_RAKE, deg, 0]),
  ];
  const stroke = (name, dirOf) => {
    const n = `${prefix} ${name}`;
    out[n] = clip(
      n,
      [
        ...oarPaths.map(({ path, sx: side }) =>
          sampled(path, 'euler', STROKE.T, 15, (time) =>
            strokeAt(time, STROKE.T, {
              dip: 6,
              sweep: 22,
              rest: OAR_REST,
              sx: side,
              dir: dirOf(side),
              catchAt: STROKE.catchAt,
              inWater: STROKE.inWater,
            }),
          ),
        ),
        ...rudders(0),
      ],
      { length: STROKE.T, dense: 15, events: GALLEY_EVENTS },
    );
    return n;
  };
  const pose = (name, oarE, rudder) => {
    const n = `${prefix} ${name}`;
    out[n] = clip(n, [
      ...oarPaths.map(({ path, sx: side }) => heldCurve(path, 'euler', oarE(side))),
      ...rudders(rudder),
    ]);
    return n;
  };
  const raised = (side) => [0, 0, side * 12];
  const swap = [
    ['clips/Rudder Sailing Left', pose('Sailing Left', raised, 25)],
    ['clips/Rudder Sailing Right', pose('Sailing Right', raised, -25)],
    ['clips/Rudder Rowing Forward', stroke('Rowing Forward', () => 1)],
    ['clips/Rudder Rowing Backward', stroke('Rowing Backward', () => -1)],
    ['clips/Rudder Rowing Left', stroke('Rowing Left', (side) => (side > 0 ? 1 : 0))],
    ['clips/Rudder Rowing Right', stroke('Rowing Right', (side) => (side < 0 ? 1 : 0))],
    ['clips/Rudder Rowing Center', pose('Rowing Center', (side) => [0, 0, -side * OAR_REST], 0)],
  ];
  return { clips: out, override: { base: 'Rudder Controller', clips: swap } };
}

/** The rowers: their posts and their flats (Come Sail Away's, kept), in the mod's order. */
const ROWERS = Object.freeze([
  ['RowerSitting', '182_030', [-7.136, 23.1331]],
  ['RowerStanding1', '182_057', [-4.0249, 18.8828]],
  ['RowerStanding2', '182_058', [-6.6338, 16.445]],
  ['RowerSitting (1)', '182_030', [-3.3065, 12.5779]],
  ['RowerStanding1 (1)', '182_057', [-6.0953, 9.8481]],
  ['RowerStanding2 (1)', '182_058', [-3.7781, 3.2638]],
  ['RowerSitting (2)', '182_030', [-6.2955, -2.9137]],
  ['RowerStanding1 (2)', '182_057', [-4.1229, -7.95]],
  ['RowerStanding2 (2)', '182_058', [-6.4122, -19.8548]],
]);
const ROWERS_AFT = Object.freeze([
  ['RowerStanding1 (3)', '182_057', [6, 10.25, -28.68]],
  ['RowerStanding2 (3)', '182_058', [-6, 10.25, -28.68]],
]);
const ROWERS_STARBOARD = Object.freeze([
  ['RowerSitting (3)', '182_030', [2.4088, 23.1331]],
  ['RowerStanding1 (4)', '182_057', [5.5199, 18.8828]],
  ['RowerStanding2 (5)', '182_058', [2.911, 16.445]],
  ['RowerStanding2 (6)', '182_058', [5.7667, 3.2638]],
  ['RowerStanding1 (5)', '182_057', [3.4495, 9.8481]],
  ['RowerSitting (4)', '182_030', [3.2494, -2.9137]],
  ['RowerStanding1 (6)', '182_057', [5.4219, -7.95]],
  ['RowerSitting (5)', '182_030', [6.2384, 12.5779]],
  ['RowerStanding2 (7)', '182_058', [3.1326, -19.8548]],
]);
/** Her hanging lanterns (Come Sail Away's posts): over the middle deck, the rowers' and the hold. */
const LANTERNS = Object.freeze([
  [-0.85, 9.5459, -6.0025],
  [0.06, 6.3681, 4.12],
  [0.06, 6.3681, 18.809],
  [0.06, 6.3681, -17.79],
  [6, 6.3681, 11.259],
  [6, 6.3681, -1.25],
  [6, 6.3681, -11.173],
  [-6, 6.3681, 11.259],
  [-6, 6.3681, -1.25],
  [-6, 6.3681, -11.173],
  [5.954, 6.3681, -22.675],
  [5, 6.3681, -30.705],
  [-5, 6.3681, -30.705],
  [5, 6.3681, 29.763],
  [-5, 6.3681, 29.763],
  [0, 3.0331, 4.2487],
  [0, 3.0331, -12.55],
  [0, 3.0331, 23.89],
]);

/** The large galley's prefab. */
export function buildGalley(k, anim) {
  const root = String(GALLEY_ID);
  const stations = GALLEY_STATIONS,
    decks = GALLEY_DECKS;
  const hullPath = `${root}/Trireme`;
  const rudderPath = `${hullPath}/RudderObject`;
  const RUDDER_AT = [0.0978, 0, 0];
  // the oars: port then starboard, row by row, bank by bank - each turned by the rudder's clips
  const oarPaths = [];
  const bankOars = (group) =>
    ROWS.flatMap((y, row) =>
      BANKS.map((bank, bankIndex) => {
        const sign = group === 'OarsLeft' ? -1 : 1;
        const i = (group === 'OarsLeft' ? 0 : 54) + row * 3 + bankIndex;
        const oarName = i ? `T'avaTriremeOar.${String(i).padStart(3, '0')}` : "T'avaTriremeOar";
        const toWater = reach(bank),
          out = toWater + 0.9;
        oarPaths.push({ path: `${group}/${oarName}`, sx: sign });
        const node = oar(k, {
          name: oarName,
          oarName: 'Loom',
          p: [(sign < 0 ? bank.xl : bank.xr) - RUDDER_AT[0], bank.y, -y],
          out,
          sx: sign,
          rootName: root,
          path: `${rudderPath}/${group}`,
          lift: OAR_LIFT,
          at: toWater / out,
          dropSize: 0.4,
          splash: [6, 12],
        });
        return node;
      }),
    );
  const oarsLeft = nodeOf('OarsLeft', { kids: bankOars('OarsLeft') });
  const oarsRight = nodeOf('OarsRight', { kids: bankOars('OarsRight') });
  const overrideName = 'own/galley/Rudder';
  const rudderSet = rudderClips(overrideName, oarPaths);
  Object.assign(anim.clips, rudderSet.clips);
  anim.overrides[overrideName] = rudderSet.override;
  const steering = (name, x) =>
    k.part(
      name,
      'own:galley:steeringOar',
      () =>
        P.merge(P.rudderBladeGeometry(9.0, 2.2, 0.22, 1.2), P.sparGeometry([0, 1.2, -0.05], [0, -6.5, -0.05], 0.22)),
      {
        p: [x - RUDDER_AT[0], 7.1228, -33.0846],
        r: quatEuler(STEERING_RAKE, 0, 0),
        kids: [
          rudderEffect(k, {
            rootName: root,
            path: `${rudderPath}/${name}`,
            p: [0, -6.0, -1.2],
            size: 0.5,
            splash: [10, 15],
          }),
        ],
      },
    );
  const sailMaker = sailBench(k, 'own/galley');
  const sail = sailMaker.sail(
    "T'avaTriremeLargeSquareSail",
    squarePoses({ head: 25.4, foot: 26.4, drop: 20.6, d: 0.6, belly: 4.0 }),
  );
  sail.position = [0, MAST.yard, 0];
  Object.assign(anim.clips, sailMaker.clips);
  Object.assign(anim.overrides, sailMaker.overrides);
  const outside = (z, y, pad) => P.outerWidth(stations, z, y) + pad;
  const ladder = (name, side) =>
    k.part(name, `own:ladder:7.6:${side}`, () => P.ladderGeometry(7.6, 0.6, side * 0.12), {
      p: [side * outside(-21.122, 10.8, 0.02), 10.85, -21.122],
    });
  const anchorAt = [outside(29.3, 6.2, 0.6), 6.2314, 29.3139];
  const station = (name, side) =>
    k.part(name, `own:galley:oarStation:${side}`, () =>
      P.merge(
        ...BANKS.map((bank) =>
          P.oarStationGeometry(side < 0 ? bank.xl + 0.15 : bank.xr - 0.15, -25.5, 17.5, [bank.y], 18),
        ),
      ),
    );
  const kids = [
    nodeOf('IdleObject', {
      kids: [
        ladder("T'avaTriremeRightRopeLadder", 1),
        ladder("T'avaTriremeLeftRopeLadder", -1),
        letGoAnchor(k, "T'avaTriremeAnchorDeployed", stations, anchorAt[2], anchorAt[1]),
      ],
    }),
    nodeOf('ActiveObject', {
      kids: [fishedAnchor(k, "T'avaTriremeAnchor", stations, anchorAt[2], anchorAt[1], { size: 2, stock: 1.6 })],
    }),
    nodeOf('BedObject', { p: [5.843, 3.512, -33.289], r: yaw(90) }),
    boardTrigger([-10.672, 1.7, -21.165], [0.9862, 1.584, -0.0073], yaw(90)),
    boardTrigger([10.722, 1.7, -21.164], [-0.9738, 1.599, -0.0077], yaw(-90)),
    k.part("T'avaTriremeCargo", 'own:cargo', () => P.cargoGeometry(), { p: [3.522, 10.28, -34.017], r: yaw(-49.8) }),
    nodeOf('DriveTrigger', {
      p: [0, 11.13, -30.66],
      kids: [nodeOf('DrivePosition', { p: [0, 0.5, 0.25] }), nodeOf('ModelHelper-41123:1', { p: [0, -0.8833, 0] })],
    }),
    k.part("T'ava Trireme Door", `own:door:${DOOR.w}:${DOOR.h}`, () => P.doorGeometry(DOOR.w, DOOR.h, 0.08), {
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
    k.part("T'avaTriremeHammock", 'own:hammock', () => P.hammockGeometry(), {
      p: [6.5393, decks.lower, -31.2632],
      r: yaw(26),
    }),
    k.part(
      "T'avaTriremeLargeSquareBoom",
      'own:galley:yard',
      () => P.sparGeometry([-26.7, MAST.yard, 0.3], [26.7, MAST.yard, 0.3], 0.35),
      {
        p: MAST.at,
        kids: [sail],
      },
    ),
    station("T'avaTriremeLeftOarStation", -1),
    k.part("T'avaTriremeMast", 'own:galley:mast', () => P.mastGeometry(MAST.h, 0.45, 0.22), {
      p: MAST.at,
      collider: true,
    }),
    station("T'avaTriremeRightOarStation", 1),
    nodeOf('RudderObject', {
      p: RUDDER_AT,
      c: [
        k.comp({
          type: 'Animator',
          m_Enabled: true,
          m_Controller: { controller: overrideName },
          m_ApplyRootMotion: false,
        }),
        k.comp({
          type: 'AudioSource',
          m_Enabled: 1,
          m_audioClip: null,
          m_PlayOnAwake: false,
          m_Volume: 1,
          m_Pitch: 1.5,
          Loop: false,
          MinDistance: 1,
          MaxDistance: 500,
          rolloffMode: 0,
          panLevelCustomCurve: { m_Curve: [{ time: 0, value: Math.fround(0.9), inSlope: 0, outSlope: 0 }] },
        }),
      ],
      kids: [
        steering("T'avaTriremeLeftRudder", -7.4338),
        steering("T'avaTriremeRightRudder", 7.4278),
        oarsLeft,
        oarsRight,
      ],
    }),
    flagObject(k, [0.11, 37.942, 14.222], [3, 3, 8]),
    crew('CommonerStanding', '182_025', [2.054, 10.2467, -35.3922], 'StatusTrigger'),
    ...ROWERS.map(([n, flat, [x, z]]) => crew(n, flat, [x, 3.2506, z])),
    ...ROWERS_AFT.map(([n, flat, place]) => crew(n, flat, place)),
    k.part("T'avaTriremeTent", 'own:galley:awning', () => P.awningGeometry(5.4, -35.3, -29.6, 3.2, 1.8, 2.0), {
      p: [0, decks.top, 0],
      collider: true,
    }),
    ...ROWERS_STARBOARD.map(([n, flat, [x, z]]) => crew(n, flat, [x, 3.2506, z])),
    hook(k, 'LanternHook (1)', [0.1208, 13.15, 14.633], yaw(180)),
    hook(k, 'LanternHook', [0, 15.12, -30.388], yaw(180)),
    poleShort(k, 'LanternHookStandPoleShort', [8.8133, 11.552, 33.493], yaw(-135)),
    poleShort(k, 'LanternHookStandPoleShort (1)', [-8.491, 11.552, 33.487], yaw(135)),
    standPlank(k, 'LanternHookStandPlank', [0, decks.bow, 44.387]),
    poleTall(k, 'LanternHookStandPoleTall', [9.0402, 6.4042, -19.38], yaw(-90)),
    poleTall(k, 'LanternHookStandPoleTall (1)', [-9.0402, 6.4042, -19.38], yaw(90)),
    ...LANTERNS.map((place, i) => hanging(i ? `LanternHanging (${i})` : 'LanternHanging', place)),
    nodeOf('Coxswain', {
      p: [-3.6946, 10.2467, -34.1077],
      kids: [
        nodeOf('BillboardHelper-346_006:1'),
        nodeOf('112406', {
          p: [0, 1, 0],
          c: [
            k.comp({
              type: 'BoxCollider',
              m_Enabled: true,
              m_IsTrigger: true,
              m_Material: null,
              m_Center: { x: 0, y: 0, z: 0 },
              m_Size: { x: 1, y: 1, z: 1 },
            }),
          ],
        }),
      ],
    }),
    crew('Boatswain', '182_035', [1.0622, 6.4042, 12.8353], 'VariantTrigger'),
    crew('Master-At-Arms', '183_004', [-0.51, 6.4042, 31.23]),
    crew('Quartermaster', '182_020', [-1.2449, 6.4042, -11.4951], 'CargoTrigger'),
    k.part('Stove', 'own:stove', () => P.stoveGeometry(), {
      p: [-4.54, 3.274, 34.56],
      r: yaw(135),
      kids: [
        k.part('StovePipe', 'own:stovePipe', () => P.stovePipeGeometry(), { p: [0, 2.3941, -0.3857] }),
        nodeOf('FireObject', { p: [0, 1.2064, 0.5301] }),
      ],
    }),
    crew('Cook', '182_008', [-4.6238, 3.2506, 31.4348]),
    ...[
      [3.8851, -25.464],
      [3.8851, -22.5059],
      [6.6226, -23.7621],
      [6.6226, -20.804],
      [9.217, -25.46],
      [9.217, -22.5019],
    ].map(([x, z], i) =>
      k.part(`Hammock (${[4, 5, 6, 7, 10, 11][i]})`, 'own:hammock', () => P.hammockGeometry(), {
        p: [x, decks.lower, z],
      }),
    ),
  ];
  const hull = k.part('Trireme', 'own:galley:hull', hullGeometry, { collider: true, kids });
  return nodeOf(root, {
    kids: [
      wakeObject(k, {
        at: [0.0967, 0.1, 0],
        s: 60,
        bow: [0, 0, 0.76],
        wave: { s: [3, 3, 3], speed: 0.03, size: [0.02, 0.04] },
      }),
      hull,
      modifiers([
        ['Crewed', {}],
        ['HandlingOar', { p: [4, 1, 0], s: [0.75, 0.25, 1] }],
        ['HandlingSail', { p: [1.5, 0.5, 0], s: [0.5, 0.5, 1] }],
        ['HandlingAnimation', { p: [0.4, 0, 0] }],
        ['HandlingRudder', { p: [0.5, 0, 0] }],
        ['Audio', { p: [1, 3, 1] }],
        ['Cargo', { p: [3, 0, 0] }],
      ]),
      waterPlane(k),
    ],
  });
}
