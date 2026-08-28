// Morrowind keyframe animation - slice 3 of the import arc. Three jobs,
// all pure data: pull the text-key ANIMATION GROUPS out of a NIF
// ("Idle: Start" ... "Idle: Stop"), pull per-bone keyframe TRACKS out of
// either an inline-animated NIF (base_anim.nif style - controllers on
// the bones) or an external .kf (xbase_anim.kf style -
// NiSequenceStreamHelper pairing a NiStringExtraData bone-name chain
// with a controller chain), and SAMPLE a track at a time.
//
// Interpolation, matching the OpenMW reference behavior:
//   - linear/constant: lerp (slerp for quaternions)
//   - quadratic: cubic Hermite on the stored forward/backward tangents
//     (quaternion quadratic keys carry no tangents - slerp)
//   - TBC: Kochanek-Bartels tangents GENERATED from tension/continuity/
//     bias, then the same Hermite (quaternions: slerp, the reference's
//     own approximation)
//   - XYZ: three float tracks composed as rotations about X, Y, Z

import { deref, KEY_TYPE } from './mwNifFile.js';

// --- text keys and groups --------------------------------------------------

/** Every text key in the file, sorted by time. */
export function collectTextKeys(nif) {
  const keys = [];
  for (const rec of nif.records) {
    if (rec.type === 'NiTextKeyExtraData') keys.push(...rec.keys);
  }
  return keys.slice().sort((a, b) => a.time - b.time);
}

/**
 * Parse "Group: marker" text keys into named groups. One key's text can
 * carry several lines (retail packs "SoundGen: Left\nGroupname: Stop"
 * style bundles); every line is its own marker.
 * @returns {Map<string, {start:number, stop:number, loopStart:number|null,
 *   loopStop:number|null}>}
 */
export function parseAnimGroups(textKeys) {
  const groups = new Map();
  for (const { time, text } of textKeys) {
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([^:]+?)\s*:\s*(.+?)\s*$/.exec(line);
      if (!m) continue;
      const name = m[1];
      const marker = m[2].toLowerCase();
      let g = groups.get(name);
      if (!g) {
        g = { start: null, stop: null, loopStart: null, loopStop: null };
        groups.set(name, g);
      }
      if (marker === 'start') g.start = time;
      else if (marker === 'stop') g.stop = time;
      else if (marker === 'loop start') g.loopStart = time;
      else if (marker === 'loop stop') g.loopStop = time;
    }
  }
  // Only groups that actually bracket time are playable.
  for (const [name, g] of groups) {
    if (g.start == null || g.stop == null) groups.delete(name);
  }
  return groups;
}

// --- tracks ----------------------------------------------------------------

function trackFromController(nif, ctrl) {
  const data = deref(nif, ctrl.data);
  if (!data || data.type !== 'NiKeyframeData') return null;
  return {
    startTime: ctrl.startTime,
    stopTime: ctrl.stopTime,
    frequency: ctrl.frequency,
    phase: ctrl.phase,
    rotationType: data.rotationType,
    rotationKeys: data.rotationKeys,
    xyzRotations: data.xyzRotations,
    translations: data.translations,
    scales: data.scales,
  };
}

/**
 * Per-bone tracks, keyed by LOWERCASED bone name. Handles both shapes:
 * a .kf's NiSequenceStreamHelper root, and inline controllers on named
 * nodes anywhere in the record list.
 * @returns {Map<string, object>}
 */
export function extractTracks(nif) {
  const tracks = new Map();
  const helper = nif.roots.map((r) => deref(nif, r)).find(
    (r) => r && r.type === 'NiSequenceStreamHelper',
  );
  if (helper) {
    // Extra chain: [text keys] then one NiStringExtraData per controller.
    const names = [];
    for (let e = deref(nif, helper.extra); e; e = deref(nif, e.next)) {
      if (e.type === 'NiStringExtraData') names.push(e.string);
    }
    let i = 0;
    for (let c = deref(nif, helper.controller); c; c = deref(nif, c.next)) {
      if (c.type !== 'NiKeyframeController') continue;
      const name = names[i++];
      const track = trackFromController(nif, c);
      if (name && track) tracks.set(name.toLowerCase(), track);
    }
    return tracks;
  }
  for (const rec of nif.records) {
    if (!rec.name || rec.controller == null || rec.controller < 0) continue;
    for (let c = deref(nif, rec.controller); c; c = deref(nif, c.next)) {
      if (c.type === 'NiKeyframeController') {
        const track = trackFromController(nif, c);
        if (track) tracks.set(rec.name.toLowerCase(), track);
        break;
      }
    }
  }
  return tracks;
}

// --- sampling --------------------------------------------------------------

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
 * Kochanek-Bartels outgoing/incoming tangents for key i of a scalar
 * track. With t=c=b=0 this is Catmull-Rom; endpoints use the one-sided
 * difference.
 */
function tcbTangents(keys, i, dim, axis) {
  const val = (k) => (dim === 1 ? k.value : k.value[axis]);
  const prev = keys[i - 1];
  const cur = keys[i];
  const next = keys[i + 1];
  const [t, c, b] = cur.tbc || [0, 0, 0];
  const dPrev = prev ? val(cur) - val(prev) : next ? val(next) - val(cur) : 0;
  const dNext = next ? val(next) - val(cur) : dPrev;
  const out =
    ((1 - t) * (1 + b) * (1 + c) * 0.5) * dPrev + ((1 - t) * (1 - b) * (1 - c) * 0.5) * dNext;
  const inn =
    ((1 - t) * (1 + b) * (1 - c) * 0.5) * dPrev + ((1 - t) * (1 - b) * (1 + c) * 0.5) * dNext;
  return [out, inn];
}

/** Find the key segment bracketing time; returns [i0, i1, u]. */
function segment(keys, time) {
  if (time <= keys[0].time) return [0, 0, 0];
  const last = keys.length - 1;
  if (time >= keys[last].time) return [last, last, 0];
  let i = 0;
  while (keys[i + 1].time < time) i++;
  const span = keys[i + 1].time - keys[i].time;
  return [i, i + 1, span > 0 ? (time - keys[i].time) / span : 0];
}

function sampleGroup(group, dim, time) {
  const { keys, type } = group;
  if (!keys.length) return null;
  const [i0, i1, u] = segment(keys, time);
  const k0 = keys[i0];
  const k1 = keys[i1];
  const comp = (axis) => {
    const v0 = dim === 1 ? k0.value : k0.value[axis];
    const v1 = dim === 1 ? k1.value : k1.value[axis];
    if (i0 === i1 || type === KEY_TYPE.constant) return v0;
    if (type === KEY_TYPE.quadratic) {
      const out0 = dim === 1 ? k0.forward : k0.forward[axis];
      const in1 = dim === 1 ? k1.backward : k1.backward[axis];
      return hermite(v0, out0, v1, in1, u);
    }
    if (type === KEY_TYPE.tbc) {
      const [out0] = tcbTangents(keys, i0, dim, axis);
      const [, in1] = tcbTangents(keys, i1, dim, axis);
      return hermite(v0, out0, v1, in1, u);
    }
    return v0 + (v1 - v0) * u;
  };
  if (dim === 1) return comp(0);
  return [comp(0), comp(1), comp(2)];
}

/** Quaternion slerp on [w,x,y,z]. */
function slerp(a, b, u) {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bw = b;
  if (dot < 0) {
    bw = [-b[0], -b[1], -b[2], -b[3]];
    dot = -dot;
  }
  if (dot > 0.9995) {
    const out = [
      a[0] + u * (bw[0] - a[0]),
      a[1] + u * (bw[1] - a[1]),
      a[2] + u * (bw[2] - a[2]),
      a[3] + u * (bw[3] - a[3]),
    ];
    const n = Math.hypot(...out);
    return out.map((v) => v / n);
  }
  const theta = Math.acos(dot);
  const s = Math.sin(theta);
  const wa = Math.sin((1 - u) * theta) / s;
  const wb = Math.sin(u * theta) / s;
  return [
    wa * a[0] + wb * bw[0],
    wa * a[1] + wb * bw[1],
    wa * a[2] + wb * bw[2],
    wa * a[3] + wb * bw[3],
  ];
}

function axisQuat(axis, angle) {
  const h = angle / 2;
  const s = Math.sin(h);
  const q = [Math.cos(h), 0, 0, 0];
  q[1 + axis] = s;
  return q;
}

function quatMul(a, b) {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

function sampleRotation(track, time) {
  if (track.rotationType === KEY_TYPE.xyz) {
    const [gx, gy, gz] = track.xyzRotations;
    const ax = sampleGroup(gx, 1, time) ?? 0;
    const ay = sampleGroup(gy, 1, time) ?? 0;
    const az = sampleGroup(gz, 1, time) ?? 0;
    // Composed as Z * Y * X (apply X first), the MW axis-order-0 default.
    return quatMul(axisQuat(2, az), quatMul(axisQuat(1, ay), axisQuat(0, ax)));
  }
  const keys = track.rotationKeys;
  if (!keys || !keys.length) return null;
  const [i0, i1, u] = segment(keys, time);
  if (i0 === i1) return keys[i0].value.slice();
  return slerp(keys[i0].value, keys[i1].value, u);
}

/**
 * Sample a bone track at a time (already inside the clip's range).
 * @returns {{rotation:number[]|null, translation:number[]|null,
 *   scale:number|null}}
 */
export function sampleTrack(track, time) {
  return {
    rotation: sampleRotation(track, time),
    translation: sampleGroup(track.translations, 3, time),
    scale: sampleGroup(track.scales, 1, time),
  };
}
