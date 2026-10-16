// AUDIT 68 S11-colorkey-tbc (2026-09-24): THE KEYGROUP SAMPLER, ONE HOME.
//
// A NIF KeyGroup - {type, keys: [{time, value, inTan?, outTan?, tbc?}]},
// readKeyGroupOf's shape (mwNifFile.js) - is sampled by one law, the
// reference's ValueInterpolator::interpKey + interpolate()
// (nifosg/controller.hpp:99-179), whoever holds it: a bone's translation
// and scale tracks (mwAnim.js) and a particle system's colour ramp
// (mwParticles.js). The ramp carried its own copy, which never generated
// TCB tangents (generateTCBTangents, nifkey.hpp:172-204) and so bent a
// TCB-keyed NiColorData on the linear curve. A leaf on purpose: mwAnim
// sits in mwFirstPerson's import cycle, and the particles must not.

import { KEY_TYPE } from './mwNifFile.js';

function hermite(v0, out0, v1, in1, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const h1 = 2 * t3 - 3 * t2 + 1;
  const h2 = -2 * t3 + 3 * t2;
  const h3 = t3 - 2 * t2 + t;
  const h4 = t3 - t2;
  return h1 * v0 + h2 * v1 + h3 * out0 + h4 * in1;
}

/**
 * MW-D33: TCB tangents for key i, exactly generateTCBTangents
 * (nifkey.hpp:172-204) on the per-key coefficients readTCBKey derives
 * from tension/continuity/bias (nifkey.hpp:165-168):
 *
 *   A = (1-t)(1-c)(1+b)   B = (1-t)(1+c)(1-b)
 *   C = (1-t)(1+c)(1+b)   D = (1-t)(1-c)(1-b)
 *
 * FIRST and LAST keys take the half-sum of the one neighbouring delta -
 * inTan = delta*((A+B)*0.5), outTan = delta*((C+D)*0.5) (:178-182,
 * :198-203). INTERIOR keys weight by TIME SPAN, not 0.5 - the port had
 * flattened both sides to 0.5 and lost the asymmetry of unevenly spaced
 * keys:
 *
 *   timeSpan = next.mTime - prev.mTime
 *   inTan  = (prevDelta*A + nextDelta*B) * ((cur - prev) / timeSpan)
 *   outTan = (prevDelta*C + nextDelta*D) * ((next - cur) / timeSpan)
 *
 * A ZERO span `continue`s (:189-190), leaving the struct's
 * zero-initialised tangents (mInTan{}/mOutTan{}, nifkey.hpp:38-40) - so
 * the answer there is 0, not a computed slope. A single-key list also
 * keeps zero tangents (`keys.size() <= 1`, :174-175).
 *
 * @returns {[number, number]} [inTan, outTan]
 */
function tcbTangents(keys, i, dim, axis) {
  const val = (k) => (dim === 1 ? k.value : k.value[axis]);
  if (keys.length <= 1) return [0, 0];
  const [t, c, b] = keys[i].tbc || [0, 0, 0];
  const A = (1 - t) * (1 - c) * (1 + b);
  const B = (1 - t) * (1 + c) * (1 - b);
  const C = (1 - t) * (1 + c) * (1 + b);
  const D = (1 - t) * (1 - c) * (1 - b);
  if (i === 0 || i === keys.length - 1) {
    const delta = i === 0 ? val(keys[1]) - val(keys[0]) : val(keys[i]) - val(keys[i - 1]);
    return [delta * ((A + B) * 0.5), delta * ((C + D) * 0.5)];
  }
  const prev = keys[i - 1];
  const cur = keys[i];
  const next = keys[i + 1];
  const timeSpan = next.time - prev.time;
  if (timeSpan === 0) return [0, 0];
  const prevDelta = val(cur) - val(prev);
  const nextDelta = val(next) - val(cur);
  return [
    (prevDelta * A + nextDelta * B) * ((cur.time - prev.time) / timeSpan),
    (prevDelta * C + nextDelta * D) * ((next.time - cur.time) / timeSpan),
  ];
}

/** Find the key segment bracketing time; returns [i0, i1, u]. */
export function segment(keys, time) {
  if (time <= keys[0].time) return [0, 0, 0];
  const last = keys.length - 1;
  if (time >= keys[last].time) return [last, last, 0];
  // AUDIT 68 S10-mwanim-linear-segment: binary search for the first key at
  // or after `time` (keys are time-sorted). The linear walk from 0 cost
  // every channel of every bone the whole .kf timeline per frame.
  let lo = 1;
  let hi = last;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (keys[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  const i = lo - 1;
  const span = keys[i + 1].time - keys[i].time;
  return [i, i + 1, span > 0 ? (time - keys[i].time) / span : 0];
}

/** One KeyGroup at `time`: a number for `dim` 1, else an array of `dim`
 *  components (3 for a translation, 4 for a colour). Null for no keys. */
export function sampleKeyGroup(group, dim, time) {
  const { keys, type } = group;
  if (!keys.length) return null;
  const [i0, i1, u] = segment(keys, time);
  const k0 = keys[i0];
  const k1 = keys[i1];
  const comp = (axis) => {
    const v0 = dim === 1 ? k0.value : k0.value[axis];
    const v1 = dim === 1 ? k1.value : k1.value[axis];
    if (i0 === i1) return v0;
    // MW-D33: Constant answers by WHICH HALF of the segment the playhead
    // is in - `fraction > 0.5f ? b.mValue : a.mValue` (controller.hpp:
    // 140-141) - not "always the left key", which the port had.
    if (type === KEY_TYPE.constant) return u > 0.5 ? v1 : v0;
    if (type === KEY_TYPE.quadratic) {
      // f(t) = a.mValue*b1 + b.mValue*b2 + a.mOutTan*b3 + b.mInTan*b4
      // (controller.hpp:150-158): the LEFT key's OUT tangent, the RIGHT
      // key's IN tangent.
      const out0 = dim === 1 ? k0.outTan : k0.outTan[axis];
      const in1 = dim === 1 ? k1.inTan : k1.inTan[axis];
      return hermite(v0, out0, v1, in1, u);
    }
    if (type === KEY_TYPE.tbc) {
      const [, out0] = tcbTangents(keys, i0, dim, axis);
      const [in1] = tcbTangents(keys, i1, dim, axis);
      return hermite(v0, out0, v1, in1, u);
    }
    return v0 + (v1 - v0) * u;
  };
  if (dim === 1) return comp(0);
  const out = new Array(dim);
  for (let axis = 0; axis < dim; axis++) out[axis] = comp(axis);
  return out;
}
