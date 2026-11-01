// @ts-check
// OWN-WORK4 (2026-10-31): THE BOATS' ANIMATORS - the five controllers Come Sail Away 2.1's runtime drives (its
// parameters, states, blends and timings: the interface the C# reads, kept as the mod plays them) and the clips our own
// boats play over them. world/unityAnimator.js plays them; systems/comeSailAway/comeSailAway.js asks them only through
// CrossFade, SetBool, SetFloat and the rowing clips' three events. Every clip's curves are ours: a pose held, or an
// oar's stroke made here from a sine. Not a DFU member.
import { pathHash } from '../../unityAnimator.js';

const fround = Math.fround;

// ── the controllers ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A leaf of a state's motion: its clip, a second long as the base's placeholders are. */
const leaf = (clip) => ({
  type: 0,
  param: null,
  paramY: null,
  duration: 1,
  clip,
  children: [],
  thresholds: [],
  positions: [],
  timeScale: 0,
  mirror: false,
});
/** A blend over `param` (`type` 0 by thresholds, 1 Simple Directional 2D by `paramY` too) of its leaves. */
const blend = (type, param, paramY, clips, thresholds = [], positions = []) => [
  {
    type,
    param,
    paramY,
    duration: 0,
    clip: null,
    children: clips.map((_, i) => i + 1),
    thresholds,
    positions,
    timeScale: 0,
    mirror: false,
  },
  ...clips.map(leaf),
];
/** A transition to `to` on its conditions. */
const to = (dest, conditions, { duration = 0.25, exitTime = 0.75, hasExitTime = true } = {}) => ({
  to: dest,
  duration,
  offset: 0,
  exitTime,
  hasExitTime,
  hasFixedDuration: true,
  interruption: 0,
  orderedInterruption: true,
  canTransitionToSelf: true,
  conditions: conditions.map(([mode, param]) => ({ mode, param, threshold: 0, exitTime: 0 })),
});
const state = (name, motion, transitions = [], speedParam = null) => ({
  name,
  fullPath: `Base Layer.${name}`,
  tag: null,
  speed: 1,
  speedParam,
  cycleOffset: 0,
  loop: true,
  mirror: false,
  writeDefaults: true,
  motion,
  transitions,
});
const controller = (name, params, defaultState, states) => ({
  name,
  params: params.map(([n, type, initial]) => ({ name: n, type, default: initial })),
  layers: [{ name: 'Base Layer', weight: 0, defaultState, anyState: [], states }],
  clips: [...new Set(states.flatMap((state) => (state.motion ?? []).map((motion) => motion.clip).filter(Boolean)))],
});

const ROW = [
  'clips/Rudder Rowing Forward',
  'clips/Rudder Rowing Backward',
  'clips/Rudder Rowing Center',
  'clips/Rudder Rowing Right',
  'clips/Rudder Rowing Left',
];
const ROW_AT = [
  [0, 1],
  [0, -1],
  [0, 0],
  [1, 0],
  [-1, 0],
];
const rowing = (speedParam) =>
  state('Rowing', blend(1, 'RowX', 'RowZ', ROW, [], ROW_AT), [to('Sailing', [['If', 'Sailing']])], speedParam);
/** The wheel's ten turns, hard to port (Left 4) to hard to starboard (Right 4). */
const WHEEL = [
  ...[4, 3, 2, 1, 0].map((k) => `Rudder Wheel Sailing Left ${k}`),
  ...[0, 1, 2, 3, 4].map((k) => `Rudder Wheel Sailing Right ${k}`),
];
const WHEEL_AT = [-1, -0.8, -0.6, -0.4, -0.2, 0.2, 0.4, 0.6, 0.8, 1].map(fround);

/** The five controllers, as Come Sail Away 2.1's runtime drives them (their parameters, states and timings). */
export const CONTROLLERS = Object.freeze({
  'Door Controller': controller('Door Controller', [['Opened', 'Bool', false]], 'Closed', [
    state('Closed', [leaf('Door Closed')], [to('Opened', [['If', 'Opened']], { duration: 1, hasExitTime: false })]),
    state('Opened', [leaf('Door Opened')], [to('Closed', [['IfNot', 'Opened']], { duration: 1, hasExitTime: false })]),
  ]),
  'Rudder Controller': controller(
    'Rudder Controller',
    [
      ['Sailing', 'Bool', false],
      ['TurnAngle', 'Float', 0],
      ['RowZ', 'Float', 0],
      ['RowX', 'Float', 0],
      ['RowSpeed', 'Float', 1],
    ],
    'Disembarked',
    [
      state('Disembarked', [leaf('clips/Rudder Disembarked')]),
      state(
        'Sailing',
        blend(
          0,
          'TurnAngle',
          null,
          ['clips/Rudder Sailing Left', 'clips/Rudder Sailing Right'],
          [fround(-0.8972973), 1],
        ),
        [to('Rowing', [['IfNot', 'Sailing']])],
      ),
      rowing('RowSpeed'),
    ],
  ),
  'Sail Controller': controller(
    'Sail Controller',
    [
      ['Wind', 'Float', 1],
      ['Stowed', 'Bool', true],
    ],
    'Stowed',
    [
      state('Stowed', [leaf('Sail Stowed')]),
      state(
        'Unstowed',
        blend(0, 'Wind', null, ['Sail Unstowed Left', 'Sail Unstowed Center', 'Sail Unstowed Right'], [-1, 0, 1]),
      ),
    ],
  ),
  'Staysail Controller': controller(
    'Staysail Controller',
    [
      ['Wind', 'Float', 1],
      ['Stowed', 'Bool', true],
    ],
    'Stowed',
    [
      state('Stowed', [leaf('Sail Stowed')]),
      state(
        'Unstowed',
        blend(
          0,
          'Wind',
          null,
          [
            'Staysail Unstowed Left',
            'Staysail Unstowed Center Left',
            'Staysail Unstowed Center',
            'Staysail Unstowed Center Right',
            'Staysail Unstowed Right',
          ],
          [-1, -0.5, 0, 0.5, 1],
        ),
      ),
    ],
  ),
  'Rudder Wheel Controller': controller(
    'Rudder Wheel Controller',
    [
      ['Sailing', 'Bool', false],
      ['TurnAngle', 'Float', 0],
      ['RowZ', 'Float', 0],
      ['RowX', 'Float', 0],
    ],
    'Disembarked',
    [
      state('Disembarked', null),
      state('Sailing', blend(0, 'TurnAngle', null, WHEEL, WHEEL_AT), [to('Rowing', [['IfNot', 'Sailing']])]),
      rowing(null),
    ],
  ),
});
// the Rudder Wheel Controller's Disembarked has no motion; `controller` reads clips off motions, so it lists none there

// ── the clips ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A clip: `name`, `length` s, its curves, its events (`[time s, functionName]`). */
export const clip = (name, curves, { length = 0, loop = true, rate = 60, events = [], dense = 0 } = {}) => ({
  name,
  start: 0,
  stop: length,
  sampleRate: rate,
  loop,
  wrapMode: 0,
  denseRate: dense,
  denseBegin: 0,
  events: events.map(([time, functionName]) => ({ time: fround(time), functionName, data: '', float: 0, int: 0 })),
  curves,
});
/** A curve held: a node's (`path` from the Animator's node) euler angles, position, scale or rotation. */
export const heldCurve = (path, attribute, value) => ({
  path: pathHash(path),
  attribute,
  components: value.map((x) => ({ constant: fround(x) })),
});
/** A door's leaf, shut and swung open: a quarter turn about its hinge (the leaf's own node, +y) - the turn the port's
 *  ships hang their leaves by (world/ships/galleonModel.js, carrackModel.js) - or `axis` z for a hatch's. */
export const doorClips = (name, deg, axis = 1) => {
  const e = [0, 0, 0];
  e[axis] = deg;
  return [
    clip(`${name} Closed`.trim(), [heldCurve('', 'euler', [0, 0, 0])]),
    clip(`${name} Opened`.trim(), [heldCurve('', 'euler', e)]),
  ];
};
/** The controllers' own clips: each a second of nothing, as the base controllers' placeholders are (an override swaps
 *  in a boat's own) - but the Door Controller's, which swing a leaf shut and open. */
export function baseClips() {
  const out = {};
  for (const controller of Object.values(CONTROLLERS))
    for (const name of controller.clips) out[name] = clip(name.split('/').pop(), [], { length: 1, loop: false });
  for (const doorClip of doorClips('Door', 90)) out[doorClip.name] = doorClip;
  return out;
}
/** A curve sampled `rate` times a second over `length` s (dense - linear between two samples). */
export const sampled = (path, attribute, length, rate, fn) => {
  const n = Math.round(length * rate) + 1;
  const comps = [0, 1, 2].map(() => []);
  for (let i = 0; i < n; i++) {
    const value = fn(i / rate);
    for (let k = 0; k < 3; k++) comps[k].push(fround(value[k]));
  }
  return { path: pathHash(path), attribute, components: comps.map((dense) => ({ dense: dense })) };
};

/**
 * An oar's euler angles at `time` of a `period`-second stroke: its blade in the water from `catchAt` (a share of the stroke)
 * for `inWater` of it, swept from forward to aft while it is in, back over the water while it is out. `dip` is how far
 * the blade falls (degrees about the oar's own z), `sweep` how far it swings fore and aft (degrees about y), `sx` the
 * side's sign (an oar runs along -x to port); `dir` -1 rows astern, 0 holds the oar at rest.
 */
export function strokeAt(time, period, { dip, sweep, sx: side, dir = 1, catchAt = 0, inWater = 0.5, rest = 0 }) {
  if (!dir) return [0, 0, -side * rest];
  const phase = (((time / period - catchAt) % 1) + 1) % 1;
  const wet = phase < inWater;
  const share = wet ? phase / inWater : (phase - inWater) / (1 - inWater);
  const along = wet ? Math.cos(Math.PI * share) : -Math.cos(Math.PI * share);
  const fall = wet ? dip * Math.sin(Math.PI * share) : -0.3 * dip * Math.sin(Math.PI * share);
  return [0, -side * dir * sweep * along, -side * (fall + rest)];
}
