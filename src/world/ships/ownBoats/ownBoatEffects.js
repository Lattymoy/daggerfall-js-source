// OWN-WORK4 (2026-10-31): THE BOATS' OWN EFFECTS - the wake, the bow waves, the oars' and the rudders' drops and their
// splashes, and the pennant, as the particle systems world/unityParticles.js plays. Come Sail Away's runtime
// (systems/comeSailAway/comeSailAway.js) finds them by the names its walk reads (WakeObject, FlagObject, OarEffect,
// RudderEffect), plays and stops them, and sets the wake's life, size and drift and the pennant's speed each frame - so
// each is the module set those calls reach, with values of our own. Not a DFU member.
import { constantCurve, twoConstantsCurve, SHAPE, SPACE, SCALING, RENDER_MODE } from '../../unityParticles.js';

const xyz = (x = 0, y = 0, z = 0) => ({ x, y, z });
/** A curve of keys `[time, value]`, flat at each (an AnimationCurve). */
const curveOf = (scalar, keys) => ({
  minMaxState: 1,
  scalar,
  minScalar: scalar,
  maxCurve: { m_Curve: keys.map(([time, value]) => ({ time, value, inSlope: 0, outSlope: 0 })) },
  minCurve: { m_Curve: [] },
});
const off = Object.freeze({ enabled: false });
/** A burst of `n` at the loop's start. */
const burst = (n) => [{ time: 0, countCurve: constantCurve(n), cycleCount: 1, repeatInterval: 0.01 }];

/**
 * One system's record: `main` its lifetime, speed and size (each a constant or [min, max]), `space`, `loop`,
 * `awake`, `emit` { time, distance, bursts }, `shape`, `sizeCurve` (a curve over life) or `sizeAxes` (one an axis),
 * `force`, `collide` (its planes' node paths), `sub` (its collision sub-emitter's node path).
 */
function system({
  life,
  speed,
  size,
  space = SPACE.Local,
  loop = true,
  awake = false,
  emit = {},
  shape = null,
  sizeCurve = null,
  sizeAxes = null,
  force = false,
  collide = null,
  sub = null,
  spin = true,
  size3D = null,
}) {
  const minMax = (value) => (Array.isArray(value) ? twoConstantsCurve(value[0], value[1]) : constantCurve(value));
  return {
    type: 'ParticleSystem',
    lengthInSec: 5,
    looping: loop,
    prewarm: false,
    playOnAwake: awake,
    startDelay: constantCurve(0),
    moveWithTransform: space,
    scalingMode: SCALING.Local,
    InitialModule: {
      enabled: true,
      startLifetime: minMax(life),
      startSpeed: minMax(speed),
      startSize: minMax(size),
      startSizeY: minMax(size3D ? size3D[1] : 1),
      startSizeZ: minMax(size3D ? size3D[2] : 1),
      startRotation: spin ? twoConstantsCurve(0, Math.fround(Math.PI)) : constantCurve(0),
      startRotationX: constantCurve(0),
      startRotationY: constantCurve(0),
      maxNumParticles: 1000,
      size3D: !!size3D,
      rotation3D: !!size3D,
    },
    EmissionModule: {
      enabled: true,
      rateOverTime: constantCurve(emit.time ?? 0),
      rateOverDistance: constantCurve(emit.distance ?? 0),
      m_Bursts: emit.bursts ?? [],
    },
    ShapeModule: shape ? { enabled: true, ...shape } : off,
    SizeModule: sizeAxes
      ? { enabled: true, separateAxes: true, curve: sizeAxes[0], y: sizeAxes[1], z: sizeAxes[2] }
      : sizeCurve
        ? { enabled: true, separateAxes: false, curve: sizeCurve }
        : off,
    ForceModule: force
      ? { enabled: true, inWorldSpace: false, x: constantCurve(0), y: constantCurve(0), z: constantCurve(0) }
      : off,
    CollisionModule: collide
      ? {
          enabled: true,
          type: 0,
          ...Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [`plane${i}`, collide[i] ? { node: collide[i] } : null])),
          m_Dampen: constantCurve(0),
          m_Bounce: constantCurve(1),
          m_EnergyLossOnCollision: constantCurve(1),
          radiusScale: 1,
        }
      : off,
    SubModule: sub
      ? {
          enabled: true,
          subEmitters: [
            { emitter: { node: sub, component: 'ParticleSystem' }, type: 1, properties: 0, emitProbability: 1 },
          ],
        }
      : off,
  };
}
/** A system's renderer: `mode` and the material it wears. */
const rendererOf = (mode, material, max = 5) => ({
  type: 'ParticleSystemRenderer',
  m_Enabled: true,
  m_RenderMode: mode,
  m_Materials: [{ material }],
  m_MaxParticleSize: max,
  m_SortMode: 1,
  m_RenderAlignment: 0,
  m_Mesh: mode === RENDER_MODE.Mesh ? { builtin: 'Cube' } : null,
});
const point = { type: SHAPE.Box, m_Position: xyz(), m_Rotation: xyz(), m_Scale: xyz(0, 0, 0) };
const fan = (yaw, at = xyz()) => ({
  type: SHAPE.Cone,
  angle: 24,
  radius: { value: 0.0001 },
  radiusThickness: 1,
  arc: { value: 360 },
  m_Position: at,
  m_Rotation: xyz(0, yaw, 0),
  m_Scale: xyz(1, 0.01, 1),
});

/** The wake laid behind a boat as she moves: foam flats born where she was, fading as they grow. */
export const wake = () => [
  system({
    life: 1,
    speed: 0,
    size: 2.5,
    space: SPACE.World,
    emit: { distance: 0.6 },
    shape: { type: SHAPE.Box, m_Position: xyz(), m_Rotation: xyz(), m_Scale: xyz(0, 0.01, 0) },
    sizeCurve: curveOf(1, [
      [0, 0.3],
      [0.45, 1],
      [1, 0],
    ]),
    force: true,
  }),
  rendererOf(RENDER_MODE.HorizontalBillboard, 'WakeMaterial'),
];
/** A bow wave thrown out to one side (`yaw` degrees) as she moves: `speed` and `size` its spray's. */
export const bowWave = (yaw, { speed = 1.2, size = [1, 1.8], at = xyz() } = {}) => [
  system({
    life: 0.9,
    speed,
    size,
    emit: { distance: 1.6 },
    shape: fan(yaw, at),
    sizeCurve: curveOf(1, [
      [0, 0],
      [0.3, 1],
      [1, 0],
    ]),
  }),
  rendererOf(RENDER_MODE.HorizontalBillboard, 'WakeMaterial'),
];
/** Drops off an oar's blade or a rudder: shot down, dying on the water (`plane`), each a splash (`splash`) where it
 *  lands. `perMetre` sheds them as the rudder moves; an oar's are one burst a stroke. */
export const drops = (plane, splash, { size = 0.12, perMetre = 0, loop = false } = {}) => [
  system({
    life: 0.12,
    speed: 60,
    size,
    loop,
    emit: perMetre ? { distance: perMetre } : { bursts: burst(1) },
    shape: point,
    collide: [plane],
    sub: splash,
    spin: false,
  }),
  rendererOf(RENDER_MODE.Billboard, 'Default-Particle', 0.5),
];
/** A splash's ring of foam where a drop lands, spreading and gone. */
export const splash = (size = [3, 6]) => [
  system({
    life: 4,
    speed: 0.8,
    size,
    space: SPACE.World,
    loop: false,
    emit: { bursts: burst(1) },
    shape: fan(0),
    sizeCurve: curveOf(1, [
      [0, 0],
      [0.2, 1],
      [1, 0],
    ]),
  }),
  rendererOf(RENDER_MODE.HorizontalBillboard, 'WakeMaterial'),
];
/** The pennant: thin slips streamed off the masthead at the wind's speed (comeSailAway.js sets it), each narrowing to
 *  nothing as it goes, so the run of them tapers like a pennant. */
export const pennant = () => [
  system({
    life: 0.45,
    speed: 1,
    size: 0.03,
    awake: true,
    emit: { time: 45 },
    shape: { type: SHAPE.Box, m_Position: xyz(), m_Rotation: xyz(), m_Scale: xyz(0.02, 0, 0) },
    spin: false,
    size3D: [0.03, 0.55, 0.1],
    sizeAxes: [
      constantCurve(1),
      curveOf(1, [
        [0, 1],
        [1, 0],
      ]),
      constantCurve(1),
    ],
  }),
  { ...rendererOf(RENDER_MODE.Mesh, 'FlagMaterial', 1) },
];
