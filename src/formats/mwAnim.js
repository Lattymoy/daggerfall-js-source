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
import { allWeaponShortGroups } from './mwFirstPerson.js';

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
        g = { start: null, stop: null, loopStart: null, loopStop: null, markers: new Map() };
        groups.set(name, g);
      }
      // Every marker is kept - attack sub-segments ("chop start",
      // "chop hit"...) live here for the first-person layer.
      g.markers.set(marker, time);
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

/**
 * MWAUDIT: THE CASE-INSENSITIVE DOOR onto that map, and the reason it
 * has to exist.
 *
 * parseAnimGroups above lowercases every MARKER (`m[2].toLowerCase()`)
 * and keeps the GROUP name exactly as written - an inconsistency
 * inside one function, and the consumer that matters looks groups up
 * by a hard-coded capitalisation ('Idle1h', 'WeaponOneHand'). A file
 * that writes `idle1h:` therefore resolves nothing, and a first-person
 * rig with no group to play freezes in its bind pose. OpenMW
 * lowercases group names on the way in for exactly this reason: real
 * data and mods do not agree on case.
 *
 * The map itself stays keyed by the ORIGINAL name, because the mesh
 * viewer is a coverage scout and must show what the file actually
 * says. This is the lookup, not a second store.
 */
export function findAnimGroup(groups, name) {
  if (!groups || !name) return null;
  const direct = groups.get(name);
  if (direct) return direct;
  const want = String(name).toLowerCase();
  for (const [key, g] of groups) if (key.toLowerCase() === want) return g;
  return null;
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
    axisOrder: data.axisOrder ?? 0,
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

// Application order per NIF axis-order code, matching the reference's
// getXYZRotation table exactly (each triple applied left to right).
const AXIS_ORDERS = [
  [0, 1, 2], // XYZ
  [0, 2, 1], // XZY
  [1, 2, 0], // YZX
  [1, 0, 2], // YXZ
  [2, 0, 1], // ZXY
  [2, 1, 0], // ZYX
  [0, 1, 0], // XYX
  [1, 2, 1], // YZY
  [2, 0, 2], // ZXZ
];

function sampleRotation(track, time) {
  if (track.rotationType === KEY_TYPE.xyz) {
    const [gx, gy, gz] = track.xyzRotations;
    const angles = [
      sampleGroup(gx, 1, time) ?? 0,
      sampleGroup(gy, 1, time) ?? 0,
      sampleGroup(gz, 1, time) ?? 0,
    ];
    const order = AXIS_ORDERS[track.axisOrder ?? 0] ?? AXIS_ORDERS[0];
    // Apply order[0] first: q = q2 x q1 x q0 in Hamilton terms.
    let q = axisQuat(order[0], angles[order[0]]);
    q = quatMul(axisQuat(order[1], angles[order[1]]), q);
    q = quatMul(axisQuat(order[2], angles[order[2]]), q);
    return q;
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

// --- the clip law ----------------------------------------------------------
//
// MW-D7. Four OpenMW members that had no JS home, ported here beside the
// text keys they read:
//
//   TextKeyMap::emplace          normalise + register groups (rules 44, 45, 21)
//   Animation::reset             pick the clip's time range      (rules 22, 23, 49)
//   AnimState::shouldLoop        the loop predicate              (rule 49)
//   Animation::runAnimation      advance the playhead            (rule 50)
//
// WHY THIS IS NOT parseAnimGroups. parseAnimGroups above is the group
// LISTING - what the viewer's dropdown shows, keyed by the name the file
// wrote, with a marker map beside it. It is not reset(). It diverges from
// the rules in ways that matter to a PLAYER and not at all to a listing:
// it splits on /\r?\n/ where rule 44 splits on the CHARACTER SET [\r\n];
// it accepts "Sneak:Start" where rule 21 requires colon-plus-one-space; it
// compares the stop marker exactly where rule 22 truncates; and it takes
// the last marker in file order where rule 22 walks backwards from the
// group's LAST key. Re-basing it would move three MWAUDIT pins that
// deliberately assert its present behaviour, and mixing that into the
// first slice that animates anything would make a failure ambiguous - the
// same reasoning assembleFirstPersonArm used to keep rest and clip apart.
// So: two homes for two different questions, and resetClip takes a KEY
// ARRAY where parseAnimGroups takes one too but answers with a map - a
// call site cannot confuse them, because neither accepts the other's
// output. The divergence is shown on the page, side by side, and booked.

/** RULE 45's fold: a 256-entry ASCII table, A-Z only. NOT
 *  String.prototype.toLowerCase, which is Unicode-aware and would fold
 *  U+0130 and U+212A into ASCII - a byte the reference leaves alone. */
export function asciiLower(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out += c >= 65 && c <= 90 ? String.fromCharCode(c + 32) : s[i];
  }
  return out;
}

/** RULE 44, verbatim: split the blob on the CHARACTER SET [\r\n] - not on
 *  the two-character sequence - trim, ASCII-lowercase, drop empties, and
 *  keep every survivor AT THE SAME TIME. A CRLF blob yields an empty piece
 *  between each pair, which is why the drop has to come after the split
 *  and not instead of it.
 *
 *  Duplicate times are legal and load-bearing: "Idle: Stop\r\nIdle2: Start"
 *  is two keys at one time, and rule 22 reads them in order. */
export function normalizeTextKeys(textKeys) {
  const out = [];
  for (const { time, text } of textKeys ?? []) {
    for (const piece of String(text ?? '').split(/[\r\n]/)) {
      const line = asciiLower(piece.trim());
      if (line) out.push({ time, text: line });
    }
  }
  return out;
}

/** RULE 21: the group is everything before the FIRST ": " - colon plus
 *  exactly one space. A key with no ": " registers no group at all; it is
 *  still a key, it just never names an animation. */
export function textKeyGroup(text) {
  const s = String(text ?? '');
  const at = s.indexOf(': ');
  return at < 0 ? null : s.slice(0, at);
}

/** RULE 21's mGroups: the engine's list of available animations, which is
 *  literally "does some key begin with '<name>: '". Sorted, deduplicated. */
export function clipGroups(keys) {
  const set = new Set();
  for (const k of keys ?? []) {
    const g = textKeyGroup(k.text);
    if (g) set.add(g);
  }
  return [...set].sort();
}

/**
 * RULE 46's TWO LOOKUPS, which are easy to conflate and are not the same
 * search (animation.cpp:827-854).
 *
 * getTextKeyTime is a PREFIX test - `iterKey->second.starts_with(textKey)`
 * - forward in time, first match wins, and it does NOT require an exact
 * key. That is what lets `"weapononehand: chop min attack"` be asked for
 * by a caller that never sees the key list.
 *
 * -1 IS THE NOT-FOUND VALUE, not null and not undefined, because the
 * callers do ARITHMETIC on it. The recorded caveat on rule 46 is exactly
 * this: two of the nine call sites never test the sentinel and instead
 * let the ORDERING comparison filter it (character.cpp:1879-1882 guards
 * `startTime <= currentTime && currentTime < minAttackTime` before
 * dividing). A port that returned null here would turn those comparisons
 * into `false` by coercion in some and NaN in others, and the arithmetic
 * would stop matching.
 */
export function getTextKeyTime(keys, textKey) {
  const want = String(textKey ?? '');
  for (const k of keys ?? []) if (k.text.startsWith(want)) return k.time;
  return -1;
}

/**
 * CALCANIMVELOCITY (animation.cpp:180-224) - the distance a movement
 * clip's ACCUM ROOT travels over the clip, per second, which is what
 * the played animation speed is scaled by (character.cpp:2400-2408).
 *
 * The reference's own quirks, kept: the LAST "group: start"/"group:
 * loop start" key and the LAST "loop stop" (falling back over plain
 * "stop"s until one appears) are taken in REVERSE scan - the comment
 * cites AshVampire.nif's doubled Loop Stop keys, whose broken velocity
 * "must be replicated". The displacement is masked by the accumulate
 * vector (1,1,0) - character.cpp:925 - so only the HORIZONTAL travel
 * counts; MW's z is the vertical and never accumulates for walking.
 * Matching is equalsParts' exact concatenation, not a prefix test.
 */
export function animVelocity(keys, track, group) {
  if (!keys || !keys.length || !track) return 0;
  const g = String(group || '').toLowerCase();
  let starttime = null;
  let stoptime = null;
  for (let i = keys.length - 1; i >= 0; i--) {
    const t = keys[i].text;
    if (t === `${g}: start` || t === `${g}: loop start`) { starttime = keys[i].time; break; }
  }
  for (let i = keys.length - 1; i >= 0; i--) {
    const t = keys[i].text;
    if (t === `${g}: stop`) stoptime = keys[i].time;
    else if (t === `${g}: loop stop`) { stoptime = keys[i].time; break; }
  }
  if (starttime == null || stoptime == null || !(stoptime > starttime)) return 0;
  // The accum root's TRANSLATION channel alone - getTranslation() is
  // all the reference samples here (animation.cpp:218-219).
  const a = track.translations ? sampleGroup(track.translations, 3, starttime) : null;
  const b = track.translations ? sampleGroup(track.translations, 3, stoptime) : null;
  if (!a || !b) return 0;
  // accumulate (1,1,0): the third component is MW's vertical.
  return Math.hypot(a[0] - b[0], a[1] - b[1]) / (stoptime - starttime);
}

/**
 * ANIMATION::ISLOOPINGANIMATION (animation.cpp:792-826), RULE 51's
 * second data fact - the hardcoded set, verbatim, all forty-four names.
 * The reference's own comment: "In Morrowind, a some animation groups
 * are always considered looping, regardless of loop start/stop keys."
 *
 * WHO CONSULTS IT is rule 51's recorded caveat and it matters here: the
 * player BODY's movement/idle/weapon paths hardcode their loopFallback
 * (fpArm does the same - character.cpp:757 et al.), and this function
 * is the SCRIPTED path's producer - playGroup (character.cpp:2631),
 * unpersistAnimationState (:2589), playGroupLua (:2708). A viewer page
 * playing whatever group the user picked IS that path, which is why the
 * mesh viewer rides this and fpArm does not.
 */
export const LOOPING_ANIMATIONS = Object.freeze([
  'walkforward', 'walkback', 'walkleft', 'walkright',
  'swimwalkforward', 'swimwalkback', 'swimwalkleft', 'swimwalkright',
  'runforward', 'runback', 'runleft', 'runright',
  'swimrunforward', 'swimrunback', 'swimrunleft', 'swimrunright',
  'sneakforward', 'sneakback', 'sneakleft', 'sneakright',
  'turnleft', 'turnright', 'swimturnleft', 'swimturnright',
  'spellturnleft', 'spellturnright', 'torch',
  'idle', 'idle2', 'idle3', 'idle4', 'idle5', 'idle6', 'idle7',
  'idle8', 'idle9', 'idlesneak', 'idlestorm', 'idleswim', 'jump',
  'inventoryhandtohand', 'inventoryweapononehand', 'inventoryweapontwohand',
  'inventoryweapontwowide',
]);
const LOOPING_SET = new Set(LOOPING_ANIMATIONS);

/**
 * Three steps, in the reference's order:
 *  1. a real "<group>: loop start" key anywhere loops, full stop - and
 *     the test is getTextKeyTime's PREFIX match, not an exact key.
 *  2. strip the LONGEST weapon short group that is a SUFFIX of the
 *     group ("so e.g. 'bow' doesn't get picked over 'crossbow' when the
 *     shortgroup is crossbow" - the reference's own comment), because
 *     most looping groups have a variant per short group; nothing
 *     stripped when none matches.
 *  3. membership of what remains in the hardcoded set.
 *
 * The group is asciiLower-ed at the door - the reference's callers hand
 * it already-normalised names, and this port folds once at each entry
 * point (resetClip's own convention) instead of trusting every caller.
 */
export function isLoopingAnimation(keys, group) {
  const g = asciiLower(String(group ?? ''));
  if (getTextKeyTime(keys, `${g}: loop start`) >= 0) return true;
  let suffixLength = 0;
  for (const suffix of allWeaponShortGroups()) {
    if (suffix.length > suffixLength && g.endsWith(suffix)) suffixLength = suffix.length;
  }
  return LOOPING_SET.has(suffixLength ? g.slice(0, g.length - suffixLength) : g);
}

/** getStartTime (animation.cpp:827-840) with findGroupStart's predicate
 *  (components/sceneutil/textkeymap.hpp): the group's EARLIEST key
 *  whatever its action, which is not the same as its "start" key. The
 *  ": " test is what stops "idle" matching "idle2: start". */
export function getStartTime(keys, group) {
  const g = asciiLower(String(group ?? ''));
  for (const k of keys ?? []) {
    if (k.text.startsWith(g) && k.text.slice(g.length, g.length + 2) === ': ') return k.time;
  }
  return -1;
}

/** RULE 22's `equalsParts`: starts_with then ==, i.e. exact equality with
 *  the parts joined. Kept as its own function because the stop key uses it
 *  on a TRUNCATED candidate and the start key does not. */
const equalsParts = (s, ...parts) => s === parts.join('');

/**
 * ANIMATION::RESET - the clip's time range, and the refusal.
 *
 * RULE 22, four steps and one refusal:
 *  1. `groupend` - walk the time-ordered keys IN REVERSE for the LAST key
 *     of this group. That reverse scan is the whole point: undeadwolf_2.nif
 *     carries two separate walkforward blocks and the later one wins.
 *  2. the start key - backwards from groupend for an EXACT
 *     "<group>: <start>".
 *  3. if that missed AND the caller asked for "loop start", retry
 *     backwards from groupend for "<group>: start".
 *  4. the stop key - backwards from groupend, comparing only the first
 *     group.length + 2 + stop.length characters, which is what tolerates
 *     the Scrib's "Idle3: Stop." with its trailing period.
 *  REFUSE when either key is missing or start > stop. Do NOT substitute 0,
 *  the file duration, or the last key: `Animation::play` moves on to the
 *  next anim source, and a page that guesses instead prints a plausible
 *  wrong clip with no error. `getStartTime` (rule 46) is the forward,
 *  any-action search that does exactly that - it is not this.
 *
 * RULES 23 + 49, the loop window, in reset's own three stages:
 *  - loopStartTime := the start key's time, in BOTH branches.
 *  - loopStopTime  := the stop key's time when `loopFallback`, else
 *    +Infinity. That default is why a clip with no "loop stop" key plays
 *    once and stops rather than looping: shouldLoop can never fire.
 *  - then the playhead moves to start + (stop - start) * startPoint, and
 *    reset RE-SCANS backwards applying any real "<group>: loop start" /
 *    "loop stop" key AT OR BEFORE it. This third stage is the half rule 49
 *    states as unconditional and its own caveat corrects: a resumed clip
 *    can leave reset with a finite loopStopTime even with loopFallback
 *    false. Everything later is discovered by CROSSING, in advanceClip.
 *
 * @returns {{ok:false, reason:string} | {ok:true, ...ClipState}}
 */
export function resetClip(keys, group, opts = {}) {
  const {
    loopFallback = false, startPoint = 0,
    loopCount = Infinity, loopingEnabled = true, start = 'start', stop = 'stop',
  } = opts;
  const g = asciiLower(String(group ?? ''));
  const list = keys ?? [];
  if (!g) return { ok: false, reason: 'no group name given' };

  let groupend = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    if (textKeyGroup(list[i].text) === g) { groupend = i; break; }
  }
  if (groupend < 0) return { ok: false, reason: `no key of group "${g}" - the file names no such animation` };

  let startAt = -1;
  for (let i = groupend; i >= 0; i--) {
    if (equalsParts(list[i].text, g, ': ', start)) { startAt = i; break; }
  }
  if (startAt < 0 && start === 'loop start') {
    for (let i = groupend; i >= 0; i--) {
      if (equalsParts(list[i].text, g, ': start')) { startAt = i; break; }
    }
  }
  if (startAt < 0) return { ok: false, reason: `group "${g}" has no "${g}: ${start}" key` };

  // THE TRUNCATED COMPARE. C++ takes a string_view substr, which returns
  // the whole string when it is shorter than the length asked for; JS
  // slice does the same, so "idle: sto" stays "idle: sto" and still fails.
  const checkLength = g.length + 2 + stop.length;
  let stopAt = -1;
  for (let i = groupend; i >= 0; i--) {
    if (equalsParts(list[i].text.slice(0, checkLength), g, ': ', stop)) { stopAt = i; break; }
  }
  if (stopAt < 0) return { ok: false, reason: `group "${g}" has no "${g}: ${stop}" key` };

  const startTime = list[startAt].time;
  const stopTime = list[stopAt].time;
  if (startTime > stopTime) {
    return { ok: false, reason: `group "${g}" starts at ${startTime} and stops at ${stopTime}` };
  }

  const state = {
    ok: true,
    group: g,
    startTime,
    stopTime,
    loopStartTime: startTime,
    loopStopTime: loopFallback ? stopTime : Infinity,
    time: startTime + (stopTime - startTime) * startPoint,
    playing: true,
    loopCount,
    loopingEnabled,
    nextKey: 0,
  };

  // Reset's THIRD stage: loop keys already behind the playhead.
  for (let i = groupend; i >= 0; i--) {
    const k = list[i];
    if (k.time > state.time) continue;
    if (equalsParts(k.text, g, ': loop start')) state.loopStartTime = k.time;
    else if (equalsParts(k.text, g, ': loop stop')) state.loopStopTime = k.time;
  }
  state.nextKey = lowerBound(list, state.time);
  return state;
}

/** The cursor into the key array, and it is `std::multimap::lower_bound`
 *  verbatim: the first key whose time is AT OR AFTER `time`. Both the
 *  reset seed and the wrap re-seed use it, so a key sitting exactly on the
 *  playhead still fires - which is how the "<group>: start" key at the
 *  clip's own start time reaches the listener on the first advance. */
function lowerBound(keys, time) {
  let i = 0;
  while (i < keys.length && keys[i].time < time) i++;
  return i;
}

/** ANIMSTATE::SHOULDLOOP, verbatim. All three terms matter: the +Infinity
 *  loopStopTime of rule 49's default makes the first one unsatisfiable,
 *  which is how a clip with no "loop stop" key plays exactly once. */
export function shouldLoop(state) {
  return !!state && state.time >= state.loopStopTime
    && state.loopingEnabled && state.loopCount > 0;
}

/**
 * ANIMATION::RUNANIMATION's stepping, rule 50.
 *
 * Time advances in TEXT-KEY-SIZED STEPS: the playhead never jumps over a
 * key, it lands exactly on it, fires it, and continues with the time it
 * has left. `onKey(text, time)` is called for every key crossed.
 *
 * The two halves are NOT an if/else - rule 50's own caveat is that the
 * second `if (shouldLoop())` runs in the SAME iteration that just set
 * `playing = false`, re-arming it and rewinding the playhead. A port that
 * writes `else` there stops a looping clip dead at its stop key.
 *
 * The `break` after the rewind is the only guard against a degenerate
 * window (loopStart >= loopStop) spinning forever, because timepassed
 * never decreases on that branch.
 *
 * KEY FIRING IS SCOPED TO THIS GROUP. The key array is the whole file -
 * both idle blocks, every other group - where OpenMW's handleTextKey
 * discards a key whose group is not the playing one (rule 47). Unscoped,
 * a wrap would report the other groups' keys as if this clip had crossed
 * them. Only this group's loop keys narrow the window.
 */
export function advanceClip(state, keys, dt, onKey = null) {
  const list = keys ?? [];
  let timepassed = dt;
  // ANIMATION::HANDLETEXTKEY, and it is TWO functions, not one.
  //
  //   Animation::handleTextKey (animation.cpp:856-873) narrows the loop
  //     window from a "<playing group>: loop start"/"loop stop" key - THAT
  //     half is group-checked - and then forwards the key to the listener
  //     UNCONDITIONALLY.
  //   CharacterController::handleTextKey (character.cpp:1012-1073) is the
  //     listener, and it is where rule 47 lives: "sound: " and
  //     "soundgen: " are handled and RETURN before any group test, so they
  //     fire for a foreign group too; everything else not beginning with
  //     "<playing group>: " is dropped with "Not ours, skip it".
  //
  // So the listener sees every key crossed and decides. `onKey` is the
  // listener, and `mine` is the group test it would apply - a caller that
  // wants rule 47 has what it needs, and one that wants the raw crossing
  // is not lied to. Collapsing these into one group filter here would hide
  // that a foreign group's key was crossed at all.
  const fireTo = () => {
    while (state.nextKey < list.length && list[state.nextKey].time <= state.time) {
      const k = list[state.nextKey++];
      // The loop-window assignment carries the group in its own compare
      // ("<group>: loop start"), so it needs no separate group guard - one
      // would be a branch no fixture could ever take. `mine` exists for the
      // LISTENER's flag, which is a different question with a different
      // answer for sound keys.
      if (equalsParts(k.text, state.group, ': loop start')) state.loopStartTime = k.time;
      else if (equalsParts(k.text, state.group, ': loop stop')) state.loopStopTime = k.time;
      if (onKey) onKey(k.text, k.time, textKeyGroup(k.text) === state.group);
    }
  };
  while (state.playing) {
    if (!shouldLoop(state)) {
      const target = state.time + timepassed;
      const next = list[state.nextKey];
      state.time = !next || next.time > target ? Math.min(target, state.stopTime) : next.time;
      state.playing = state.time < state.stopTime;
      timepassed = target - state.time;
      fireTo();
    }
    if (shouldLoop(state)) {
      state.loopCount--;
      state.time = state.loopStartTime;
      state.playing = true;
      // The re-fire is lowerBound(newTime) then "while <= newTime", so it
      // is the keys sitting exactly ON the loop-start time and nothing
      // else. Re-firing the whole [startTime, loopStartTime] range would
      // report the clip's intro keys on every wrap, which is the opposite
      // of what a loop start means.
      state.nextKey = lowerBound(list, state.time);
      fireTo();
      if (state.time >= state.loopStopTime) break;
    }
    if (timepassed <= 0) break;
  }
  return state;
}
