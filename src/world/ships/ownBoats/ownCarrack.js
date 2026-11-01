// OUR CARRACK - Come Sail Away's hull 4 (prefab 112414), built here: the hull Mac's carrack
// (world/ships/carrackModel.js) stands in for, and what stands when his model will not. Three masts and a bowsprit
// under five sails (a spritsail, two courses, a main topsail and a mizzen lateen); a well-decked hull - her main deck
// low in her waist (3.64), its cargo hatch over her hold, her castles' half deck (6.8) fore and aft over it, the poop and
// the forecastle over those, a stair up into her forecastle, five doors. Every node the runtime walks keeps the name and
// the place Come Sail Away 2.1 gave it. Not a DFU member.
import * as P from './ownBoatParts.js';
import { nodeOf, yaw, modifiers, wakeObject, boardTrigger, fishedAnchor, letGoAnchor } from './ownBoatKit.js';
import { sailBench, squarePoses, foreAftPoses } from './ownBoatSails.js';
import { clip, heldCurve, doorClips } from './ownBoatAnimation.js';
import { quatEuler } from '../../unityAnimator.js';

export const CARRACK_ID = 112414;
/** Her stations aft to fore (her hull node's frame). */
export const CARRACK_STATIONS = Object.freeze([
  { z: -28.24, b: 5.2, g: 11.7, k: 4.5, f: 0.4 },
  { z: -26.0, b: 7.0, g: 11.3, k: -1.0, f: 0.35 },
  { z: -17.2, b: 8.1, g: 11.0, k: -3.0, f: 0.3 },
  { z: -16.6, b: 8.15, g: 7.85, k: -3.1, f: 0.3 },
  { z: -6.0, b: 8.43, g: 7.85, k: -3.35, f: 0.3 },
  { z: 6.0, b: 8.3, g: 7.85, k: -3.35, f: 0.3 },
  { z: 10.9, b: 7.4, g: 8.0, k: -3.0, f: 0.35 },
  { z: 11.3, b: 7.3, g: 11.0, k: -2.95, f: 0.35 },
  { z: 17.6, b: 5.0, g: 11.2, k: -2.0, f: 0.45 },
  { z: 21.5, b: 2.2, g: 11.4, k: 0.0, f: 0.6 },
  { z: 23.71, b: 0.1, g: 11.0, k: 4.0, f: 0.8 },
]);
const THICKNESS = 0.12;
/** Her decks' heights: the hold, her main deck in her waist, her castles' half deck, the poop's and the forecastle's. */
export const CARRACK_DECKS = Object.freeze({ hold: 0.4, lower: 3.64, main: 6.8, poop: 9.9, fore: 10.2 });
/** The poop's front, the great cabin's bulkhead, the waist's after wall and the one under the quarterdeck, the
 *  forecastle's after face (z); her forecastle's stair (x across, z from its foot to its head). */
const POOP_Z = -16.82,
  CABIN_Z = -25.0753,
  LOWER_Z = Object.freeze([-6.8311, -19.4013]),
  FORE_Z = 11.2;
const FORE_STAIR = Object.freeze({ x: 0.32, w: 1.2, z0: FORE_Z, z1: 15.2 });
/** A door leaf's size, and the cargo hatch's leaves (x across, z along) at their hinges. */
const LEAF = Object.freeze({ w: 1.4016, h: 2.175 });
const HATCH = Object.freeze({ w: 2.0, d: 5.0, y: 3.5597, z: 3.5044, x: Object.freeze([-2.0081, 1.9919]) });
/** Her masts (foot, height, the fore's rake forward) and her bowsprit (heel, end). */
const MASTS = Object.freeze({
  main: Object.freeze({ at: Object.freeze([-0.0081, 3.6484, -3.0818]), h: 43.86 }),
  fore: Object.freeze({ at: Object.freeze([0.0231, 9.2602, 13.2727]), h: 31.4, rake: 2.62 }),
  mizzen: Object.freeze({ at: Object.freeze([-0.0081, 9.9422, -21.5208]), h: 24.04 }),
  bowsprit: Object.freeze({ at: Object.freeze([-0.0081, 9.5211, 19.0996]), end: Object.freeze([0, 12.9, 16.3]) }),
});

function hullGeometry() {
  const stations = CARRACK_STATIONS,
    decks = CARRACK_DECKS;
  const b = P.bench();
  P.hullSkin(b, stations, THICKNESS);
  P.deck(b, stations, THICKNESS, { y: decks.hold, z0: -15, z1: 10, under: null });
  const hz0 = HATCH.z - HATCH.d / 2,
    hz1 = HATCH.z + HATCH.d / 2;
  P.deck(b, stations, THICKNESS, {
    y: decks.lower,
    z0: -26.5,
    z1: 17.0,
    holes: [{ x0: HATCH.x[0], x1: HATCH.x[1], z0: hz0, z1: hz1 }],
  });
  const foreStair = FORE_STAIR;
  P.deck(b, stations, THICKNESS, { y: decks.main, z0: -27.9, z1: LOWER_Z[0] - 0.17 });
  P.deck(b, stations, THICKNESS, {
    y: decks.main,
    z0: FORE_Z,
    z1: 17.6,
    holes: [
      { x0: foreStair.x - foreStair.w / 2, x1: foreStair.x + foreStair.w / 2, z0: foreStair.z0, z1: foreStair.z1 },
    ],
  });
  P.deck(b, stations, THICKNESS, { y: decks.poop, z0: -27.6, z1: POOP_Z, under: 'beams' });
  P.deck(b, stations, THICKNESS, { y: decks.fore, z0: 15.6, z1: 21.0, under: 'beams' });
  const door = (x0, x1, y) => ({ x0, x1, top: y + LEAF.h + 0.02 });
  P.bulkhead(b, stations, THICKNESS, {
    z: POOP_Z,
    y0: decks.main,
    y1: decks.poop,
    door: door(-1.4, 1.41, decks.main),
    facing: 1,
  });
  P.bulkhead(b, stations, THICKNESS, {
    z: CABIN_Z,
    y0: decks.main,
    y1: decks.poop,
    door: door(-0.725, 0.68, decks.main),
    facing: 1,
  });
  for (const z of LOWER_Z)
    P.bulkhead(b, stations, THICKNESS, {
      z,
      y0: decks.lower,
      y1: decks.main,
      door: door(-0.725, 0.68, decks.lower),
      facing: 1,
    });
  // her forecastle's front open over her waist in one arch, her stair rising through it: the deck under her forecastle her waist's
  P.bulkhead(b, stations, THICKNESS, {
    z: FORE_Z,
    y0: decks.lower,
    y1: decks.main,
    door: { x0: -2.6, x1: 3.2, top: decks.main - 0.2 },
    facing: -1,
  });
  P.bulkhead(b, stations, THICKNESS, {
    z: 15.6,
    y0: decks.main,
    y1: decks.fore,
    door: { x0: -0.7, x1: 0.7, top: 9.0 },
    facing: -1,
  });
  P.stairFlight(b, {
    x: foreStair.x,
    w: foreStair.w,
    z0: foreStair.z0,
    y0: decks.lower,
    z1: foreStair.z1,
    y1: decks.main,
    steps: 13,
  });
  // its well railed either side on her forecastle's deck, a metre high
  for (const side of [-1, 1])
    P.block(
      b,
      'trim',
      [foreStair.x + side * (foreStair.w / 2 + 0.03), decks.main + 0.5, (foreStair.z0 + foreStair.z1) / 2],
      [0.03, 0.5, (foreStair.z1 - foreStair.z0) / 2],
    );
  P.stairFlight(b, { x: -3.2, w: 1.1, z0: -0.8, y0: decks.lower, z1: LOWER_Z[0] - 0.17, y1: decks.main });
  // her poop and her forecastle's top climbed by ladders, as the mod's are reached: no walk of her crew's goes up there
  P.steepLadder(b, { x: 3.2, z0: POOP_Z + 0.9, y0: decks.main, z1: POOP_Z + 0.1, y1: decks.poop });
  P.steepLadder(b, { x: -3.0, z0: 14.7, y0: decks.main, z1: 15.5, y1: decks.fore });
  return b.finish();
}

/** Her helm's clips over the Rudder Wheel Controller, ten steps a side. */
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
        heldCurve('CarrackWhelWell/CarrackWheel', 'rotation', quatEuler(0, 0, turn * 270)),
        heldCurve('CarrackRudder', 'euler', [0, turn * 35, 0]),
      ]);
      swap.push([`Rudder Wheel Sailing ${side} ${step}`, n]);
    }
  return { clips: out, override: { base: 'Rudder Wheel Controller', clips: swap } };
}

/** The carrack's prefab. */
export function buildCarrack(k, anim) {
  const root = String(CARRACK_ID);
  const stations = CARRACK_STATIONS,
    decks = CARRACK_DECKS;
  const overrideName = 'own/carrack/Rudder';
  const helm = helmClips(overrideName);
  Object.assign(anim.clips, helm.clips);
  anim.overrides[overrideName] = helm.override;
  // the doors' and the hatch's swings: a leaf hung the other way, and the two hatch leaves turned up off the deck
  for (const [name, deg, axis] of [
    ['Door Reverse', -90, 1],
    ['Door Horizontal', 120, 2],
    ['Door Horizontal Reverse', -120, 2],
  ]) {
    const [shut, open] = doorClips(`own/carrack/${name}`, deg, axis);
    anim.clips[shut.name] = shut;
    anim.clips[open.name] = open;
    anim.overrides[name] = {
      base: 'Door Controller',
      clips: [
        ['Door Closed', shut.name],
        ['Door Opened', open.name],
      ],
    };
  }
  const animator = (controller) =>
    k.comp({ type: 'Animator', m_Enabled: true, m_Controller: { controller }, m_ApplyRootMotion: false });
  const leaf = (name, place, side, controller) =>
    k.part(name, `own:door:${LEAF.w}:${LEAF.h}:${side}`, () => P.doorGeometry(LEAF.w, LEAF.h, 0.1, side), {
      p: place,
      collider: true,
      c: [animator(controller)],
      kids: [nodeOf('DoorTrigger')],
    });
  const hatch = (name, x, side, controller) =>
    k.part(name, `own:hatch:${side}`, () => P.hatchGeometry(HATCH.w, HATCH.d, 0.12, side), {
      p: [x, HATCH.y, HATCH.z],
      collider: true,
      c: [animator(controller)],
      kids: [nodeOf('DoorTrigger')],
    });
  const sailMaker = sailBench(k, 'own/carrack');
  const square = (boom, sail, at, poses, yardY = 0, span = poses.foot + 0.3) =>
    k.part(boom, `own:carrack:${boom}`, () => P.sparGeometry([-span, yardY, 0.25], [span, yardY, 0.25], 0.3), {
      p: at,
      kids: [Object.assign(sailMaker.sail(sail, squarePoses(poses)), { position: [0, yardY, 0] })],
    });
  const mast = (name, spec) =>
    k.part(name, `own:carrack:${name}`, () => P.sparGeometry([0, 0, 0], [0, spec.h, spec.rake ?? 0], 0.5), {
      p: spec.at,
      collider: true,
    });
  const outside = (z, y, pad) => P.outerWidth(stations, z, y) + pad;
  const ladder = (name, side) =>
    k.part(name, `own:ladder:6.4:${side}`, () => P.ladderGeometry(6.4, 0.6, side * 0.12), {
      p: [side * outside(2.83, 7.8, 0.02), 8.6, 2.8326],
    });
  const anchorAt = [outside(11.14, 6.9, 0.5), 6.9376, 11.1379];
  const kids = [
    nodeOf('DrivePosition', { p: [-0.5459, 10.876, -19.53] }),
    nodeOf('DriveTrigger', { p: [0, 10.883, -18.399] }),
    nodeOf('IdleObject', {
      p: [0, -0.8, 0],
      kids: [
        ladder('CarrackLeftRopeLadder', -1),
        ladder('CarrackRightRopeLadder', 1),
        letGoAnchor(k, 'CarrackAnchorDeployed', stations, anchorAt[2], anchorAt[1]),
      ],
    }),
    nodeOf('ActiveObject', {
      kids: [fishedAnchor(k, 'CarrackAnchor', stations, anchorAt[2], anchorAt[1], { stock: 0.8, alongX: true })],
    }),
    nodeOf('RudderObject', {
      p: [0.0058, 0.0039, -5.7304],
      c: [animator(overrideName)],
      kids: [
        k.part('CarrackRudder', 'own:carrack:rudder', () => P.rudderBladeGeometry(7.6, 2.8, 0.26, 4.6), {
          p: [-0.0058, 1.1561 + 3.4, -17.7234],
        }),
        k.part('CarrackWhelWell', 'own:pedestal', () => P.pedestalGeometry(0.95), {
          p: [-0.0058, 9.9288, -12.0354],
          kids: [k.part('CarrackWheel', 'own:wheel', () => P.helmWheelGeometry(0.75), { p: [0, 0.95, -0.428] })],
        }),
      ],
    }),
    hatch('CarrackCargoDoor', HATCH.x[0], 1, 'Door Horizontal'),
    hatch('CarrackCargoDoor1', HATCH.x[1], -1, 'Door Horizontal Reverse'),
    k.part('CarrackCargoHoldLadder', 'own:ladder:3.2:0', () => P.ladderGeometry(3.2, 0.7, 0), {
      p: [-1.2062, decks.lower - 0.05, 1.0136],
      r: yaw(90),
    }),
    // her hold's ramp up to her cargo hatch, its head 0.7 m under her doors: a hand reaches up to them, no floor under them
    k.part(
      'CarrackCargoRamp',
      'own:carrack:ramp',
      () => {
        const b = P.bench();
        P.stairFlight(b, {
          x: 0,
          w: 2.8,
          z0: HATCH.z + HATCH.d / 2 - 0.1,
          y0: decks.hold,
          z1: HATCH.z - HATCH.d / 2 + 0.1,
          y1: decks.lower - 0.7,
          steps: 10,
        });
        return b.finish();
      },
      { collider: true },
    ),
    leaf('CarrackDoor.003', [-1.3991, 7.8528, POOP_Z], 1, 'Door Controller'),
    leaf('CarrackDoor.004', [1.4052, 7.8528, POOP_Z], -1, 'Door Reverse'),
    leaf('CarrackDoor.005', [0.6781, 7.8528, CABIN_Z], -1, 'Door Reverse'),
    leaf('CarrackDoor.006', [0.6781, 4.7295, LOWER_Z[0]], -1, 'Door Reverse'),
    leaf('CarrackDoor.007', [0.6781, 4.7295, LOWER_Z[1]], -1, 'Door Reverse'),
    k.part('CarrackBowstern', 'own:carrack:bowsprit', () => P.sparGeometry([0, 0, -0.4], MASTS.bowsprit.end, 0.45), {
      p: MASTS.bowsprit.at,
    }),
    mast('CarrackMast', MASTS.fore),
    mast('CarrackMast1', MASTS.main),
    mast('CarrackMast3', MASTS.mizzen),
    square('CarrackSmallSquareBoom', 'CarrackSmallSquareSail', [0.0256, 18.8602, 31.5714], {
      head: 5.8,
      foot: 6.2,
      drop: 6.2,
      d: 0.2,
      belly: 1.0,
    }),
    square(
      'CarrackLargeSquareBoom1',
      'CarrackLargeSquareSail1',
      MASTS.main.at,
      { head: 15.2, foot: 16.2, drop: 18.6, d: 0.6, belly: 2.6 },
      28.16,
    ),
    square('CarrackLargeSquareBoom', 'CarrackLargeSquareSail', [0.0231, 39.1275, 15.748], {
      head: 13.2,
      foot: 14.2,
      drop: 19.5,
      d: 0.6,
      belly: 2.4,
    }),
    square('CarrackMediumSquareBoom', 'CarrackMediumSquareSail', [0, 45.0458, -3.6261], {
      head: 9.6,
      foot: 10.4,
      drop: 11.4,
      d: 0.5,
      belly: 1.6,
    }),
    k.part(
      'CarrackMediumLateenBoom1',
      'own:carrack:lateenYard',
      () => P.sparGeometry([0, 5.8, 9.2], [0, 30.2, -10.2], 0.22),
      {
        p: MASTS.mizzen.at,
        kids: [
          sailMaker.sail(
            'CarrackMediumLateenSail1',
            foreAftPoses({
              throat: [0, 6.0, 9.0],
              peak: [0, 30.0, -10.0],
              tack: [0, 6.0, 9.0],
              clew: [0, 4.0, -9.5],
              belly: 1.6,
              furl: 'head',
            }),
          ),
        ],
      },
    ),
    nodeOf('FireObject', { p: [-5.309, 3.6592, -9.6676], r: [0, 0.6088, 0, 0.7934], active: false }),
    nodeOf('BedObject', { p: [4.3708, 6.7192, -15.43], r: yaw(-90), active: false }),
  ];
  Object.assign(anim.clips, sailMaker.clips);
  Object.assign(anim.overrides, sailMaker.overrides);
  const hull = k.part('Carrack', 'own:carrack:hull', hullGeometry, { collider: true, kids });
  return nodeOf(root, {
    kids: [
      wakeObject(k, {
        at: [0, -0.8, 0],
        s: 20,
        bow: [0, 0, 0.377],
        wave: { s: [2, 2, 2], speed: 0.1, size: [0.06, 0.12] },
      }),
      modifiers([
        ['HandlingOar', { p: [0.5, 0.25, 0], s: [0.5, 0.25, 1] }],
        ['HandlingSail', { p: [1, 1, 0], s: [1, 0.75, 1] }],
        ['Crewed', {}],
        ['HandlingAnimation', { p: [0.6, 0, 0] }],
        ['HandlingRudder', { p: [0.75, 0, 0] }],
        ['Audio', { p: [1, 2, 1] }],
      ]),
      nodeOf('CargoTrigger', { p: [-3.1725, 0.1525, -3.3995] }),
      boardTrigger([7.4123, 0.8001, 2.8388], [-0.5161, 1.3151, -0.097], yaw(-90)),
      boardTrigger([-7.4123, 0.8001, 2.8388], [0.5161, 1.3151, -0.097], yaw(90)),
      hull,
    ],
  });
}
