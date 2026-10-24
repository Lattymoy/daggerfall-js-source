// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GATHER-FEEL (2026-10-13, Mac: "I want to improve gathering, add
// gathering sounds and overall make the experience more palatable") -
// THE GATHERING'S EAR (bible/06-Systems/Professions-Arc.md section 44).
//
// The acts' sounds were DAGGER.SND's combat and window clips (systems/
// profSounds.js: a blow's Hit1-5 for a chop, the parry's ring for an
// ore, the lock's click for a clean finish, the button's click for a
// find and a knife's stroke), said by the HUD as it drew the reticle,
// flat, the frame the press counted - a whole swing before the blow
// the hand draws lands. And most of an act said nothing: a herb pulled,
// the tree's creak at half its chops (the act raised `creaked` for a
// sound nobody played), the tree's fall, the logs taken, a vein worked
// out, the net's wait and its whole haul, the goods and a rank.
//
// The ear hears them all, off the act machines' own states (systems/
// chopAct.js, mineAct.js, herbAct.js, traceAct.js, fishAct.js - their
// rules untouched): thirty-six clips of the port's own (tools/
// gatherSfx.mjs -> public/sfx/gather-*.wav, provenance in public/sfx/
// SOURCES.md), registered on the bus under string keys the climb's way
// (player/climb/climbSounds.js), each at the node in the world (a node in
// reach at its full volume), the net's where it landed, a hand's and a
// chime at the ear. A blow sounds as it LANDS - the tool's swing is
// DFU's melee strike, and its blow lands on the strike's hit frame
// (the machines' `landsIn`) - and a sound of several clips is never the
// one just heard, its pitch moved a little.
//
// Off with the port's own sounds (systems/enhancedSounds.js - the
// enhanced skin's ES1 switch), the ear says what the HUD said before
// it: profSounds' DFU cue for each beat that had one, on the blow's
// time, and nothing for the rest.
//
// One owner: the gathering host builds it (scenes/gatherHost.js), feeds
// it every frame, and lets it go with the page.
// ═══════════════════════════════════════════════════════════════════
import { APP_ROOT } from './appRoot.js';
import { enhancedSoundsOn } from './enhancedSounds.js';
import { profCue } from './professions/profSounds.js';
import { DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';

/** The sounds, each its clips' keys (a sound of several is never the one just heard). */
export const GATHER_SFX = Object.freeze({
  swing: Object.freeze(['gather:swing-1', 'gather:swing-2']),
  chop: Object.freeze(['gather:chop-1', 'gather:chop-2', 'gather:chop-3']),
  chopClean: Object.freeze(['gather:chop-clean']),
  creak: Object.freeze(['gather:creak']),
  fall: Object.freeze(['gather:fall']),
  logs: Object.freeze(['gather:logs']),
  pick: Object.freeze(['gather:pick-1', 'gather:pick-2', 'gather:pick-3']),
  pickGlint: Object.freeze(['gather:pick-glint']),
  rubble: Object.freeze(['gather:rubble']),
  rustle: Object.freeze(['gather:rustle-1', 'gather:rustle-2']),
  pluck: Object.freeze(['gather:pluck']),
  bruise: Object.freeze(['gather:bruise']),
  find: Object.freeze(['gather:find']),
  sparkle: Object.freeze(['gather:sparkle']),
  slice: Object.freeze(['gather:slice-1', 'gather:slice-2', 'gather:slice-3']),
  tear: Object.freeze(['gather:tear']),
  peel: Object.freeze(['gather:peel']),
  throw: Object.freeze(['gather:throw']),
  netLand: Object.freeze(['gather:net-land']),
  plip: Object.freeze(['gather:plip-1', 'gather:plip-2']),
  tug: Object.freeze(['gather:tug']),
  thrash: Object.freeze(['gather:thrash-1', 'gather:thrash-2']),
  netOut: Object.freeze(['gather:net-out']),
  clean: Object.freeze(['gather:clean']),
  haul: Object.freeze(['gather:haul']),
  rank: Object.freeze(['gather:rank']),
});
/** Each key's file under public/sfx (`gather:chop-1` -> gather-chop-1.wav). */
export const GATHER_SFX_FILES = Object.freeze(Object.fromEntries(
  Object.values(GATHER_SFX).flat().map((key) => [key, `${key.replace(':', '-')}.wav`]),
));

/** The ear's numbers: the pitch's variety, the water's beats while the net waits and hauls, the slice's climb, the
 *  creak's lag behind its blow, the net's place's reach, and the gap a burst of answers keeps. */
export const GATHER_SOUND = Object.freeze({
  PITCH_JITTER: 0.05,      // a clip's pitch moved by up to this, either way (none for a chime - a note keeps its pitch)
  PICK_SWING_PITCH: 0.85,  // the pick's swing, a heavier head than the axe's
  MISS_PITCH: 0.85,        // a find missed: the rustle, lower and quieter
  SLICE_FROM: 0.92,        // the knife's first stroke...
  SLICE_TO: 1.22,          // ...and its last: the pitch climbs along the line
  CREAK_AFTER_S: 0.12,     // the tree groans this long after the blow that bent it lands
  PLIP_MIN_S: 2.2,         // the water by the floats while the net waits: a plip every this...
  PLIP_MAX_S: 5.5,         // ...to this
  THRASH_MIN_S: 0.5,       // the haul: the catch fights in the mesh every this...
  THRASH_MAX_S: 1.1,       // ...to this
  THRASH_SLIP_S: 0.32,     // ...and this often while it slips outside the band
  THRASH_SLIP_GAIN: 1.35,  // ...louder
  NET_REF_M: 8,            // the net's sounds at their full volume out to this (the throw is 3-12 m - professionLaw FISH_ACT)
});

/**
 * HOW EACH BEAT IS SAID: its sound (GATHER_SFX), volume (the bus's 0..1, under the player's Sound volume - levelled by
 * the clips' own loudness, tools/gatherSfx.mjs's measures: a blow near -15 dB, a big event near -8, the water's plip near
 * -28), where (`node` the node's place, `net` where the net landed, `ear` flat), its pitch, a jitter of its own (a chime
 * none), the shortest gap between two of it (a burst of kept answers rings once), how long after it is asked it sounds
 * (a rank's chime after the goods' bag), and its DFU stand-in on the classic skin - the cue the HUD said there before
 * GATHER-FEEL (systems/professions/profSounds.js PROF_CUES), or none.
 * @type {Readonly<Record<string, Readonly<{ sfx: string, volume: number, where: 'node'|'net'|'ear', pitch?: number, jitter?: number, gap?: number, after?: number, classic: string|null }>>>}
 */
export const GATHER_SAY = Object.freeze({
  swing: Object.freeze({ sfx: 'swing', volume: 0.2, where: 'ear', classic: null }),
  chop: Object.freeze({ sfx: 'chop', volume: 0.52, where: 'node', classic: 'strike' }),
  chopClean: Object.freeze({ sfx: 'chopClean', volume: 0.53, where: 'node', classic: 'glint' }),
  creak: Object.freeze({ sfx: 'creak', volume: 0.9, where: 'node', classic: null }),
  fall: Object.freeze({ sfx: 'fall', volume: 0.65, where: 'node', classic: null }),
  logs: Object.freeze({ sfx: 'logs', volume: 0.35, where: 'ear', classic: null }),
  pick: Object.freeze({ sfx: 'pick', volume: 0.69, where: 'node', classic: 'strike' }),
  pickGlint: Object.freeze({ sfx: 'pickGlint', volume: 0.64, where: 'node', classic: 'glint' }),
  rubble: Object.freeze({ sfx: 'rubble', volume: 0.46, where: 'node', classic: null }),
  kneel: Object.freeze({ sfx: 'rustle', volume: 0.47, where: 'node', classic: null }),
  pluck: Object.freeze({ sfx: 'pluck', volume: 0.74, where: 'node', classic: null }),
  bruise: Object.freeze({ sfx: 'bruise', volume: 0.47, where: 'node', classic: 'slip' }),
  sparkle: Object.freeze({ sfx: 'sparkle', volume: 0.2, where: 'ear', jitter: 0, classic: null }),
  find: Object.freeze({ sfx: 'find', volume: 0.6, where: 'node', classic: 'tick' }),
  miss: Object.freeze({ sfx: 'rustle', volume: 0.3, where: 'node', pitch: GATHER_SOUND.MISS_PITCH, classic: 'slip' }),
  knife: Object.freeze({ sfx: 'slice', volume: 0.44, where: 'node', pitch: GATHER_SOUND.SLICE_FROM, classic: null }),
  slice: Object.freeze({ sfx: 'slice', volume: 0.44, where: 'node', classic: 'tick' }),
  tear: Object.freeze({ sfx: 'tear', volume: 0.75, where: 'node', classic: 'slip' }),
  peel: Object.freeze({ sfx: 'peel', volume: 0.73, where: 'node', classic: null }),
  throw: Object.freeze({ sfx: 'throw', volume: 0.43, where: 'ear', classic: 'swing' }),
  netLand: Object.freeze({ sfx: 'netLand', volume: 0.58, where: 'net', classic: 'splash' }),
  plip: Object.freeze({ sfx: 'plip', volume: 0.15, where: 'net', classic: null }),
  tug: Object.freeze({ sfx: 'tug', volume: 0.59, where: 'net', classic: 'tug' }),
  hauling: Object.freeze({ sfx: 'thrash', volume: 0.56, where: 'net', classic: 'tick' }),
  thrash: Object.freeze({ sfx: 'thrash', volume: 0.4, where: 'net', classic: null }),
  netOut: Object.freeze({ sfx: 'netOut', volume: 0.57, where: 'ear', classic: null }),
  clean: Object.freeze({ sfx: 'clean', volume: 0.42, where: 'ear', jitter: 0, classic: 'clean' }),
  haul: Object.freeze({ sfx: 'haul', volume: 0.37, where: 'ear', gap: 0.3, classic: null }),
  rank: Object.freeze({ sfx: 'rank', volume: 0.53, where: 'ear', jitter: 0, gap: 1, after: 0.35, classic: null }),
});

// ---- the clips' loading: once, the first frame the sounds are on ----------------------------------------------------

export const gatherSfxUrl = (file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

let _install = null;
/** Register the thirty-six clips, once. Answers how many took; a clip that will not load is silence, never a stopped act. */
export function installGatherSounds(audio, { fetchBytes = null } = {}) {
  if (!audio?.registerSound) return Promise.resolve(0);
  return (_install ??= (async () => {
    const load = fetchBytes ?? (async (file) => {
      const r = await fetch(gatherSfxUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    let n = 0;
    for (const [key, file] of Object.entries(GATHER_SFX_FILES)) {
      try { if (await audio.registerSound(key, await load(file))) n++; } catch { /* the act goes on, silently */ }
    }
    return n;
  })());
}
/** Test seam. */
export function _resetGatherSounds() { _install = null; }

/** One of `sfx`'s clips - never `prev` while it has another. Null for a sound with none. */
export function gatherClip(sfx, prev, rand) {
  const keys = GATHER_SFX[/** @type {keyof typeof GATHER_SFX} */ (sfx)];
  if (!keys?.length) return null;
  let key = keys[Math.floor(rand() * keys.length) % keys.length];
  if (keys.length > 1 && key === prev) key = keys[(keys.indexOf(key) + 1) % keys.length];
  return key;
}

// ---- the beats: what an act's frame says ---------------------------------------------------------------------------

/** A beat: `name` (GATHER_SAY's), `delay` seconds from this frame, a `pitch` and a `gain` of its own; `after` - a beat
 *  that rides a blow in the air (the blow itself, the creak it raises): the seconds after that blow LANDS, the ear holding
 *  it for its machine to count it landed (AUDIT GATHER-FEEL LANDING: one clock, the act's) - null for one that rides
 *  none. */
const beat = (name, delay = 0, pitch = 1, gain = 1, after = null) => ({ name, delay, pitch, gain, after });
/** Every machine's state as it begins (systems/chopAct.js, mineAct.js, herbAct.js, traceAct.js, fishAct.js): an act is
 *  heard from here, so its first frame says what that frame did - a net thrown on the frame it was cast (a tapped E
 *  never winds), a blow struck on the frame it began. */
const BEGUN = Object.freeze({ chops: 0, creaked: false, strikes: 0, bruised: false, done: false, spot: -1, hits: 0, tracing: false, reached: 0, slips: 0, phase: 'wind' });

/**
 * THE BEATS an act's frame says, read off its state against the last frame's (`prev`, mutated to this one); `landsIn`
 * the act's blow still in the air (the machines' own - 0 for an act that swings nothing): a beat that rides it says how
 * long after it lands (`after`), its `delay` the whole wait as this frame reckons it. An act's first frame (`prev`
 * empty) says its start - the kneel among the leaves - and is read against the machine's beginning (BEGUN).
 *   chop   - every chop: the swing at once, the blow as it lands (a Clean Cut its own), the creak that half its chops
 *            raise just after it (none on the chop that fells it - the fall groans its own);
 *   mine   - every strike: the swing (the pick's, lower), the blow as it lands (on the glint, the ore's ring);
 *   hand, steady - the kneel; a bruise; the herb pulled at the end;
 *   basket - the kneel; a glint showing; a find, or the glint gone unfound;
 *   trace  - the knife going in, each point passed (the pitch climbing along the line), a slip; the pelt off at the end;
 *   fish   - the throw, the net landing, the tug, the haul begun, the net in at the end.
 * Pure.
 * @param {any} prev @param {any} st @param {number} [landsIn] @returns {Array<{ name: string, delay: number, pitch: number, gain: number }>}
 */
export function actBeats(prev, st, landsIn = 0) {
  const out = [];
  if (!st) return out;
  const lands = Number(landsIn) > 0 ? Number(landsIn) : 0;
  const rides = (after) => (lands > 0 ? after : null);   // a beat on a blow in the air lands with it
  if (prev.kind == null) {
    Object.assign(prev, BEGUN);
    if (st.kind === 'hand' || st.kind === 'steady' || st.kind === 'basket') out.push(beat('kneel'));
  }
  if (st.kind === 'chop' && st.chops > (prev.chops ?? 0)) {
    out.push(beat('swing'));
    out.push(beat(st.last === 'clean' ? 'chopClean' : 'chop', lands, 1, 1, rides(0)));
    if (st.creaked && !prev.creaked && !st.done) out.push(beat('creak', lands + GATHER_SOUND.CREAK_AFTER_S, 1, 1, rides(GATHER_SOUND.CREAK_AFTER_S)));
  }
  if (st.kind === 'mine' && st.strikes > (prev.strikes ?? 0)) {
    out.push(beat('swing', 0, GATHER_SOUND.PICK_SWING_PITCH));
    out.push(beat(st.last === 'glint' ? 'pickGlint' : 'pick', lands, 1, 1, rides(0)));
  }
  if (st.kind === 'steady' && st.bruised && !prev.bruised) out.push(beat('bruise'));
  if ((st.kind === 'hand' || st.kind === 'steady') && st.done && !prev.done) out.push(beat('pluck'));
  if (st.kind === 'basket') {
    if (st.spot >= 0 && !(prev.spot >= 0)) out.push(beat('sparkle'));
    if (st.hits.length > (prev.hits ?? 0)) out.push(beat(st.hits[st.hits.length - 1] ? 'find' : 'miss'));
  }
  if (st.kind === 'trace') {
    if (!st.gentle) {
      if (st.tracing && !prev.tracing) out.push(beat('knife'));
      if (st.tracing && st.reached > (prev.reached ?? 0)) {
        const share = st.reached / Math.max(1, (st.points?.length ?? 2) - 1);
        out.push(beat('slice', 0, GATHER_SOUND.SLICE_FROM + (GATHER_SOUND.SLICE_TO - GATHER_SOUND.SLICE_FROM) * share));
      }
      if (st.slips > (prev.slips ?? 0)) out.push(beat('tear'));
    }
    if (st.done && !prev.done) out.push(beat('peel'));
  }
  if (st.kind === 'fish') {
    if (st.phase !== prev.phase) {
      const name = { fly: 'throw', wait: 'netLand', tug: 'tug', haul: 'hauling' }[/** @type {string} */ (st.phase)];
      if (name) out.push(beat(name));
    }
    if (st.done && !prev.done && !st.cancelled) out.push(beat('netOut'));
  }
  prev.kind = st.kind; prev.chops = st.chops; prev.creaked = st.creaked; prev.strikes = st.strikes; prev.bruised = st.bruised;
  prev.done = st.done; prev.spot = st.spot; prev.hits = st.hits?.length; prev.tracing = st.tracing;
  prev.reached = st.tracing ? st.reached : 0; prev.slips = st.slips; prev.phase = st.phase;
  return out;
}

/** Where the net lands: `metres` from the eye along the bearing to the cast's point (scenes/fishHost.js castAt), at its
 *  height - or null where either is unknown. Pure. */
export function netLanding(eye, at, metres) {
  if (!isVec3(eye) || !isVec3(at) || !(Number(metres) > 0)) return null;
  const dx = at[0] - eye[0], dz = at[2] - eye[2];
  const l = Math.hypot(dx, dz);
  if (!(l > 1e-6)) return null;
  return [eye[0] + (dx / l) * metres, at[1], eye[2] + (dz / l) * metres];
}

const isVec3 = (v) => v != null && typeof v === 'object' && v.length >= 3 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);

// ---- the ear --------------------------------------------------------------------------------------------------------

/**
 * THE GATHERING'S EAR. `frame(dt, act, at, eye)` every frame of the host - the act machine playing (null for none), its
 * node's place in the scene and the eye's: it hears the act's beats (actBeats) and the water's own while the net waits
 * and hauls, and says each on its time - a blow as its machine LANDS it (AUDIT GATHER-FEEL LANDING: the machine's
 * count of blows landed, `landed`, passing the one it was struck as - the hand's hit frame; the host steps every
 * machine whose swing still runs before it frames the ear, so the blow, the view's kick, the chunks and the node's going
 * are one frame - one clock, the act's).
 * `say(name, at, { delay, of, voice })` - a beat the act's state cannot hear: a tree's fall and a vein's rubble as their
 * node goes (kept by the node's key, `voice`), the logs taken, a clean finish (as its last blow lands), the goods and a
 * rank. `hush(voice)` - a node's going taken back (a refused harvest stands it again): its sound fades and stops
 * (AUDIT GATHER-FEEL F7). `stop(act)` - an act let go before its end: its blows still in the air are dropped with the
 * hand that swung them. `rebase(offset)` - the floating origin moved: the places held move with the land.
 * @param {{ audio?: any, on?: () => boolean, rand?: () => number, cue?: (name: string) => any, install?: boolean }} [o]
 *   `audio` the bus (playOneShot, play3d, registerSound); `on` the switch (the port's own sounds); `rand` the variety's
 *   dice (the pins' seam; Math.random bare - the port's own variety, no DFU draw); `cue` the classic skin's voice
 *   (systems/professions/profSounds.js profCue); `install` false keeps the clips unloaded (a pin's bus has none).
 */
export function createGatherEar({ audio = null, on = enhancedSoundsOn, rand = Math.random, cue = profCue, install = true } = {}) {
  /** the act last heard and its state as last heard; its node's place; where its net landed */
  let heard = null, node = null, net = null;
  let prev = {};
  /** beats waiting for their time: `{ due, b, place, of, blow }` - `place` where it was heard (its own copy - null at
   *  the ear), `of` the act machine it was heard from or rides (null for one said alone); a beat riding a blow in the air
   *  waits on its machine (`due` Infinity) until that machine counts `blow` landed, and is due its `after` then */
  let pending = [];
  let clock = 0;
  /** the water's next beat: seconds to the next plip while the net waits, to the next thrash while it hauls */
  let plipIn = 0, thrashIn = 0;
  /** sfx -> the key last played; name -> the clock it last sounded */
  const last = new Map(), saidAt = new Map();
  /** AUDIT GATHER-FEEL F7: a node's going still sounding, by its key - the bus's own handle (play3dVoice), let go as it ends */
  const voices = new Map();

  const placeOf = (where) => (where === 'node' ? node : where === 'net' ? (net ?? node) : null);
  function fire(b, place = null, voice = null) {
    const say = GATHER_SAY[b.name];
    if (!say) return false;
    if (say.gap && clock - (saidAt.get(b.name) ?? -Infinity) < say.gap) return false;
    saidAt.set(b.name, clock);
    if (!on()) {   // the classic skin: the DFU cue the HUD said here before, or nothing
      if (say.classic) { try { cue(say.classic); } catch { /* a cue never stops an act */ } }
      return !!say.classic;
    }
    if (!audio) return false;
    const key = gatherClip(say.sfx, last.get(say.sfx) ?? null, rand);
    if (!key) return false;
    last.set(say.sfx, key);
    const jitter = say.jitter ?? GATHER_SOUND.PITCH_JITTER;
    const pitch = (say.pitch ?? 1) * (b.pitch ?? 1) * (1 + jitter * (2 * rand() - 1));
    const volume = say.volume * (b.gain ?? 1);
    const at = place ?? placeOf(say.where);
    try {
      if (say.where !== 'ear' && isVec3(at) && audio.play3d) {
        const o = { refDistance: say.where === 'net' ? GATHER_SOUND.NET_REF_M : DEFAULT_ACTIVATION_DISTANCE, pitch };
        if (voice != null && audio.play3dVoice) {   // AUDIT GATHER-FEEL F7: kept, to be taken back
          const h = audio.play3dVoice(key, at, volume, { ...o, onEnd: () => { if (voices.get(voice) === h) voices.delete(voice); } });
          if (h) voices.set(voice, h);
        } else audio.play3d(key, at, volume, o);
      } else audio.playOneShot?.(key, volume, pitch);
    } catch { return false; }   // a sound never stops an act
    return true;
  }
  /** A beat on its time: now, or held until its delay has run - or, riding `of`'s blow in the air, until that blow
   *  lands and its `after` has run - at the place it was heard at (a last blow still in the air when the next act begins
   *  lands on its own node, not the next one). */
  function queue(b, place = null, of = null, voice = null) {
    const rides = !!of && b.after != null;
    const aloft = rides && Number(of.landsIn) > 0;   // its blow in the air: the next its machine lands
    const wait = aloft ? Infinity : rides ? b.after : b.delay;
    if (!(wait > 0)) { fire(b, place, voice); return; }
    const at = place ?? placeOf(GATHER_SAY[b.name]?.where);
    pending.push({ due: clock + wait, b, place: at ? [at[0], at[1], at[2]] : null, of, blow: aloft ? (of.state?.landed | 0) + 1 : 0, voice });
  }

  return {
    /**
     * Every frame of the host. @param {number} dt @param {any} act the act machine playing, or null
     * @param {number[]|null} [at] its node's place in the scene @param {number[]|null} [eye] the eye's
     */
    frame(dt, act = null, at = null, eye = null) {
      const step = Math.max(0, Number(dt) || 0);   // the frame's own time, whole: a blow is due when the hand lands it (chopAct's swing runs on the same unclamped time)
      clock += step;
      if (install && audio?.registerSound && on()) installGatherSounds(audio);   // the first frame the sounds are on loads them, once
      if (act !== heard) { heard = act; prev = {}; net = null; plipIn = 0; thrashIn = 0; }
      if (act) {
        if (isVec3(at)) node = [at[0], at[1], at[2]];
        const st = act.state;
        const wasPhase = prev.phase;
        for (const b of actBeats(prev, st, act.landsIn ?? 0)) {
          if (b.name === 'throw') net = netLanding(eye, at, st.throwM) ?? (isVec3(at) ? [at[0], at[1], at[2]] : null);   // the net's own place, from its throw on
          queue(b, null, act);
        }
        // the water's own beats: a plip by the floats while the net waits, the catch fighting while it hauls - more
        // often and louder while it slips outside the band
        if (st?.kind === 'fish' && !st.done && !st.cancelled) {
          if (st.phase === 'wait') {
            if (wasPhase !== 'wait') plipIn = GATHER_SOUND.PLIP_MIN_S + rand() * (GATHER_SOUND.PLIP_MAX_S - GATHER_SOUND.PLIP_MIN_S);
            else if ((plipIn -= step) <= 0) { queue(beat('plip')); plipIn = GATHER_SOUND.PLIP_MIN_S + rand() * (GATHER_SOUND.PLIP_MAX_S - GATHER_SOUND.PLIP_MIN_S); }
          }
          if (st.phase === 'haul') {
            const slipping = !(st.weight >= st.bandAt && st.weight <= st.bandAt + st.bandW);
            const span = () => (slipping ? GATHER_SOUND.THRASH_SLIP_S : GATHER_SOUND.THRASH_MIN_S + rand() * (GATHER_SOUND.THRASH_MAX_S - GATHER_SOUND.THRASH_MIN_S));
            if (wasPhase !== 'haul') thrashIn = span();
            else if ((thrashIn -= step) <= 0) { queue(beat('thrash', 0, 1, slipping ? GATHER_SOUND.THRASH_SLIP_GAIN : 1)); thrashIn = span(); }
          }
        }
      }
      // the beats whose time has come, in the order they were held - a blow's once its machine has landed it
      if (pending.length) {
        for (const p of pending) if (p.due === Infinity && (p.of?.state?.landed | 0) >= p.blow) p.due = clock + (p.b.after ?? 0);
        if (pending.some((p) => p.due <= clock)) {
          const due = pending.filter((p) => p.due <= clock);
          pending = pending.filter((p) => p.due > clock);
          for (const p of due) fire(p.b, p.place, p.voice);
        }
      }
    },
    /** A beat the act's state cannot hear, at `at` (a node's place) or its own place, now or after `delay` s - or, `of`
     *  an act machine, `delay` s after its blow in the air lands (a clean finish rings with the last blow), let go with
     *  it. `voice` - a node's key: the sound kept under it while it sounds, for `hush` (AUDIT GATHER-FEEL F7). */
    say(name, at = null, { delay = 0, of = null, voice = null } = {}) {
      const say = GATHER_SAY[name];
      if (!say) return;
      const wait = Math.max(0, Number(delay) || 0) + (say.after ?? 0);
      queue(beat(name, wait, 1, 1, of ? wait : null), isVec3(at) ? [at[0], at[1], at[2]] : null, of, voice);
    },
    /** AUDIT GATHER-FEEL F7: a node's going taken back (its harvest refused, the node stood again): the sound said under
     *  its key fades and stops (a node's going is said at once - never held). */
    hush(voice) {
      if (voice == null) return;
      const h = voices.get(voice);
      voices.delete(voice);
      try { h?.stop(); } catch { /* a sound never stops an act */ }
    },
    /** An act let go before its end (Escape, walked off, a window, the dungeon left, the professions shut) - the one
     *  playing (the act heard, unnamed) or a finished one's last swing: its beats in the air (its blow, what rides it)
     *  go with the hand that swung it - every other act's, and a beat said alone, land all the same. */
    stop(act = heard) {
      if (act) pending = pending.filter((p) => p.of !== act);
      if (act === heard) { heard = null; prev = {}; }
    },
    /** The floating origin moved (world.js's recentre: `offset` added to every scene point) - the places held (the
     *  node's, the net's where it landed, each beat's in the air) stand where they stood on the land. */
    rebase(offset) {
      if (!isVec3(offset)) return;
      for (const p of [node, net, ...pending.map((q) => q.place)]) if (p) { p[0] += offset[0]; p[1] += offset[1]; p[2] += offset[2]; }
    },
    /** The beats still held, for the pins. */
    get pending() { return pending.map((p) => p.b.name); },
  };
}
