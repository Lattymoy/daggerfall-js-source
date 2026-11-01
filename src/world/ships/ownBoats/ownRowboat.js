// OUR ROWBOAT - Come Sail Away's hull 0 (prefab 112410), built here. The nodes its runtime
// walks keep the names and the places Come Sail Away 2.1 gave them (its helm, its triggers, its oarlocks, its lantern,
// its Modifiers - the interface its C# reads); the boat itself is ours: a lofted clinker hull with its floorboards and
// three thwarts, a pair of oars, a lantern on a short pole at her stem. Not a DFU member.
import * as P from './ownBoatParts.js';
import { nodeOf, yaw, modifiers, wakeObject, waterPlane, waterCull, poleShort, oar } from './ownBoatKit.js';
import { clip, sampled, heldCurve, strokeAt } from './ownBoatAnimation.js';

export const ROWBOAT_ID = 112410;
/** Her stations aft to fore (her node's frame: `b` half-beam at the gunwale, `g` the gunwale, `k` the keel). */
export const ROWBOAT_STATIONS = Object.freeze([
  { z: -2.14, b: 0.64, g: 0.74, k: 0.02, f: 0.5 },
  { z: -1.6, b: 0.94, g: 0.7, k: -0.16, f: 0.5 },
  { z: -0.6, b: 1.03, g: 0.67, k: -0.21, f: 0.5 },
  { z: 0.4, b: 1.04, g: 0.67, k: -0.22, f: 0.5 },
  { z: 1.4, b: 0.96, g: 0.69, k: -0.2, f: 0.55 },
  { z: 2.3, b: 0.6, g: 0.74, k: -0.1, f: 0.65 },
  { z: 2.94, b: 0.02, g: 0.74, k: 0.28, f: 0.8 },
]);
const THICKNESS = 0.04;
/** Her floorboards' height and her thwarts' (their z). */
export const ROWBOAT_FLOOR = 0.1;
export const ROWBOAT_THWARTS = Object.freeze({ y: 0.5, z: Object.freeze([-1.25, 0, 0.72]) });
/** Her oars: each pivot's place (the rowing clips turn it), its reach outboard, its rest and its stroke (degrees). */
const OARS = Object.freeze({ out: 2.1, rest: 16, dip: 8, sweep: 34 });
/** Her stroke's clock (the mod's: a second, the blade in from 0.8667 to 0.3333 of the next, its three events). */
const STROKE = Object.freeze({ T: 1, catchAt: 0.8667, inWater: 0.4667 });
export const ROWBOAT_EVENTS = Object.freeze([
  [0.1667, 'OarEvent_Sweep'],
  [0.3333, 'OarEvent_Out'],
  [0.8667, 'OarEvent_In'],
]);

function hullGeometry() {
  const b = P.bench();
  P.hullSkin(b, ROWBOAT_STATIONS, THICKNESS);
  P.deck(b, ROWBOAT_STATIONS, THICKNESS, { y: ROWBOAT_FLOOR, z0: -1.75, z1: 2.15, under: null });
  for (const z of ROWBOAT_THWARTS.z)
    P.thwart(b, P.innerWidth(ROWBOAT_STATIONS, THICKNESS, z, ROWBOAT_THWARTS.y), ROWBOAT_THWARTS.y, z, 0.24);
  return b.finish();
}

/** Her rudder's clips (the rowboat's: two oars rowed, held or shipped), over the Rudder Controller. */
function rudderClips(prefix) {
  const out = {};
  const side = (sign) => (sign < 0 ? 'OarL' : 'OarR');
  const stroke = (name, dirs) => {
    const n = `${prefix} ${name}`;
    out[n] = clip(
      n,
      [-1, 1].map((sign, i) =>
        sampled(side(sign), 'euler', STROKE.T, 30, (time) =>
          strokeAt(time, STROKE.T, {
            ...OARS,
            sx: sign,
            dir: dirs[i],
            catchAt: STROKE.catchAt,
            inWater: STROKE.inWater,
          }),
        ),
      ),
      { length: STROKE.T, dense: 30, events: ROWBOAT_EVENTS },
    );
    return n;
  };
  const pose = (name, e) => {
    const n = `${prefix} ${name}`;
    out[n] = clip(
      n,
      [-1, 1].map((sign) => heldCurve(side(sign), 'euler', e(sign))),
    );
    return n;
  };
  const swap = [
    ['clips/Rudder Rowing Forward', stroke('Rowing Forward', [1, 1])],
    ['clips/Rudder Rowing Backward', stroke('Rowing Backward', [-1, -1])],
    ['clips/Rudder Rowing Left', stroke('Rowing Left', [0, 1])],
    ['clips/Rudder Rowing Right', stroke('Rowing Right', [1, 0])],
    ['clips/Rudder Rowing Center', pose('Rowing Center', (sign) => [0, 0, -sign * OARS.rest])],
    ['clips/Rudder Disembarked', pose('Disembarked', (sign) => [0, sign * 76, sign * 4])],
  ];
  return { clips: out, override: { base: 'Rudder Controller', clips: swap } };
}

/** The rowboat's prefab. @param {ReturnType<import('./ownBoatKit.js').ownBench>} k */
export function buildRowboat(k, anim) {
  const root = String(ROWBOAT_ID);
  const hullPath = `${root}/Dingy`;
  const overrideName = 'own/rowboat/Rudder';
  const rudder = rudderClips(overrideName);
  Object.assign(anim.clips, rudder.clips);
  anim.overrides[overrideName] = rudder.override;
  const oars = [-1, 1].map((sign) =>
    oar(k, {
      name: sign < 0 ? 'OarL' : 'OarR',
      oarName: "T'avaTriremeOar",
      p: [sign < 0 ? -0.9143 : 0.9217, 0.8242, 0.0275],
      out: OARS.out,
      sx: sign,
      rootName: root,
      path: `${hullPath}/RudderObject`,
      lift: 0.14,
      at: 0.8,
      dropSize: 0.1,
      splash: [1.2, 2.4],
    }),
  );
  const hull = k.part('Dingy', 'own:rowboat:hull', hullGeometry, {
    collider: true,
    kids: [
      nodeOf('IdleObject', { p: [0, -0.2, 0] }),
      nodeOf('RudderObject', {
        p: [0, -0.2, 0],
        c: [
          k.comp({
            type: 'Animator',
            m_Enabled: true,
            m_Controller: { controller: overrideName },
            m_ApplyRootMotion: false,
          }),
        ],
        kids: oars,
      }),
      nodeOf('ActiveObject', { p: [0, -1, 0] }),
      nodeOf('DrivePosition', { p: [0, 0.8, 0.5], r: yaw(180) }),
      nodeOf('DriveTrigger', { p: [0, 0.646, 0] }),
      poleShort(k, 'LanternHookStandPoleShort', [0.0025, 0.7502, 2.8618], yaw(180)),
      nodeOf('BoardTrigger', { p: [0.0012, 0.5293, -2.138], kids: [nodeOf('BoardPosition', { p: [0, 0.5, 1] })] }),
      waterCull(k, 'DingyWaterCull', 'own:rowboat:waterCull', 0.84, -2.0, 2.7, { p: [0, 0.6688, 0] }),
    ],
  });
  return nodeOf(root, {
    kids: [
      wakeObject(k, { at: [0, 0.1, 0], s: 1, bow: [0, -0.013, 2.108], wave: { speed: 0.9, size: [0.6, 1.2] } }),
      modifiers([
        ['HandlingOar', { p: [1, 1, 0] }],
        ['HandlingSail', { p: [1, 1, 0] }],
        ['Crewed', { active: false }],
        ['HandlingAnimation', { p: [1, 0, 0] }],
        ['HandlingRudder', { p: [1, 0, 0] }],
        ['Audio', { p: [1, 2, 1] }],
        ['Packable', {}],
        ['Cargo', { p: [0.5, 0, 0] }],
      ]),
      nodeOf('DoorTrigger', { active: false }),
      nodeOf('CargoTrigger', { active: false }),
      nodeOf('BoardTrigger', {
        active: false,
        s: [3, 3, 3],
        kids: [nodeOf('BoardPosition', { s: [1 / 3, 1 / 3, 1 / 3] })],
      }),
      nodeOf('FireObject', { active: false }),
      nodeOf('BedObject', { active: false }),
      hull,
      waterPlane(k),
    ],
  });
}
