// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PEER-ACTS (GATHER-FEEL II, 2026-10-13, Mac: "Do the not done" - GATHER-FEEL's open "a peer neither sees an act ... nor
// hears one"; bible/06-Systems/Professions-Arc.md 5.1 "Others see it" and section 45) - ANOTHER PLAYER'S GATHERING, SEEN
// AND HEARD.
//
// THE WIRE. The pose carries the act (net/wire.js validPose, world200): `ga` its code - GATHER_POSE_ACTS' index + 1, what
// the hands are doing (the axe at a trunk, the pick at a stone, a kneel by hand, with the sickle, with the Basket, with
// the knife, the net wound, flying, waiting, tugged, hauled) - for as long as the hand is on it: the act playing, and a
// finished one whose last swing is still in the air (GATHER-FEEL's `follow` - the tool the gatherer's own hand holds);
// `gm` the net's throw in whole metres while it is out; and `gb` the beats - a count, round and round past 255, times 16
// with the last beat's kind under it (GATHER_POSE_BEATS: a blow, a clean one, a bruise, the herb pulled, a find, a miss,
// the knife going in, its stroke, its tear, the pelt off, the net in - and a blow taken back, its act let go while it was
// still in the air: AUDIT GATHER-FEEL W2, the gatherer's own ear drops it). The count rides on its own, as the landed blows'
// does (`hk`): a beat counted as its act ends - the herb pulled, the pelt off, the net in - rides the pose that ends it,
// and the count runs on across acts, so a peer that missed a pose between two acts never hears an old beat again. All
// three absent until a player gathers.
//
// THE SENDER (createGatherPose): the act's beats are the ear's own law (systems/gatherSounds.js actBeats, run on its own
// last state), each one the pose names counted - so the others hear what the gatherer hears, on the same beats; and the
// host counts a blow taken back where its ear drops one (scenes/gatherHost.js letGo).
//
// THE RECEIVER. Every lane that draws a peer reads the same fields:
//   - the Morrowind body (net/peer/peerBodies.js) holds the act's tool - the classic lane's own stand-in weapon, the War Axe,
//     the Warhammer, the Tanto, the Dagger (GATHER_POSE_TOOLS) - drawn, swings it on each blow with the strike the hand
//     draws it with (GATHER_POSE_STRIKES), and crouches (its camera's sneak: the rig's crouched idle - Morrowind has no
//     kneel) while the act kneels;
//   - the class sprite (net/remotePlayers.js) strikes on each blow and on the throw, and kneels as a yielding foe kneels
//     (REVENANT-FATE's held hurt frame);
//   - Eye Of The Beholder's walker (net/peer/peerRiders.js) stands ready while a tool is out and plays its melee clip on each
//     blow and on the throw;
//   - every lane hears it (PeerGatherSounds): the kneel among the leaves, the tool's swing and its blow on DFU's hit
//     frame, the herb pulled, the knife going in and each stroke, the net thrown, landing where it was thrown, the water
//     while it waits, the tug, the catch fighting, the net in - at the act's place before the body (the net's where it
//     was thrown), with the peers' own falloff, behind the swings' switch (uiPrefs `peerAttackSounds`) and the ear's:
//     the port's own clips on the enhanced skin, the DFU cue the HUD said for each beat on the classic one
//     (systems/professions/profSounds.js), as the ear says the gatherer's own. The knife's strokes are one pitch: the climb along
//     the line is the gatherer's (the line's length is not on the wire).
// The node itself is each character's own (section 6): a tree another fells still stands for you, and its fall, its
// logs, a vein's cracks, chunks and rubble are theirs alone - never seen or heard here.
// ═══════════════════════════════════════════════════════════════════
import { actBeats, GATHER_SAY, GATHER_SOUND, gatherClip, installGatherSounds } from '../../systems/gatherSounds.js';
import { PROF_CUES } from '../../systems/professions/profSounds.js';
import { enhancedSoundsOn } from '../../systems/enhancedSounds.js';
import { MELEE_HIT_SHARE } from '../../characters/weaponStates.js';
import { CHOP_ACT, MINE_ACT } from '../professionLaw.js';
import { POSE_GATHER_THROW_MAX } from '../wire.js';

const f = Object.freeze;

/** The acts the pose names, by `ga` - 1: an act machine's state kind, a net's by its phase. */
export const GATHER_POSE_ACTS = f(['chop', 'mine', 'hand', 'steady', 'basket', 'trace', 'wind', 'fly', 'wait', 'tug', 'haul']);
/** The beats the pose names, by `gb` & 15 (sixteen at most - the wire's POSE_GATHER_BEAT_MAX). AUDIT GATHER-FEEL W2:
 *  `stop` - the blow counted just before it taken back (its act let go while it was in the air), dropped by every peer
 *  before it lands, as the gatherer's own ear drops it. */
export const GATHER_POSE_BEATS = f(['blow', 'clean', 'bruise', 'pluck', 'find', 'miss', 'knife', 'slice', 'tear', 'peel', 'out', 'stop']);
/** The ear's beats (systems/gatherSounds.js actBeats' names) that are the pose's: the tool's blows, the hand's and the
 *  knife's moments, the net in. The rest are the act's own (a swing comes with its blow, a kneel and a throw with the act
 *  itself) or the gatherer's alone (the glint's sparkle, the tree's creak - its node is theirs). */
const POSE_BEAT_OF = f({ chop: 'blow', chopClean: 'clean', pick: 'blow', pickGlint: 'clean', bruise: 'bruise', pluck: 'pluck', find: 'find', miss: 'miss', knife: 'knife', slice: 'slice', tear: 'tear', peel: 'peel', netOut: 'out' });

/** An act machine's state as the pose's `ga` (0 for none, or an act cancelled). A finished act is still its act: the
 *  host hands the one its hand is on - the act playing, or the last swing of one finished - and none once it lets go.
 *  Pure. */
export function gatherActCode(st) {
  if (!st || st.cancelled) return 0;
  const i = GATHER_POSE_ACTS.indexOf(st.kind === 'fish' ? st.phase : st.kind);
  return i < 0 ? 0 : i + 1;
}

/**
 * THE SENDER: `frame(act)` every frame of the gathering host - the act machine playing, or null - counts the beats the
 * pose names (the ear's own law, on its own last state); `stop()` counts a blow taken back (the host's, as it lets an
 * act go with its blow in the air); `fields(act)` the pose's fields for the act the hand is on (the one playing, or a
 * finished one's last swing - null for none): `ga` and the net's `gm` for it, and the beats' `gb` whatever it is - the
 * count is the session's, run on across acts and riding past their end.
 */
export function createGatherPose() {
  let heard = null, prev = {}, n = 0, gb = 0;
  const count = (kind) => { n = (n % 255) + 1; gb = n * 16 + GATHER_POSE_BEATS.indexOf(kind); };
  return {
    frame(act) {
      if (act !== heard) { heard = act; prev = {}; }
      if (!act?.state) return;
      for (const b of actBeats(prev, act.state, 0)) {
        const kind = POSE_BEAT_OF[/** @type {keyof typeof POSE_BEAT_OF} */ (b.name)];
        if (kind !== undefined) count(kind);
      }
    },
    stop() { count('stop'); },
    fields(act) {
      const out = /** @type {{ ga?: number, gb?: number, gm?: number }} */ ({});
      const ga = gatherActCode(act?.state);
      if (ga) {
        out.ga = ga;
        const st = act.state;
        if (st.kind === 'fish' && st.phase !== 'wind' && Number(st.throwM) > 0) out.gm = Math.max(1, Math.min(POSE_GATHER_THROW_MAX, Math.round(st.throwM)));
      }
      if (gb) out.gb = gb;
      return out;
    },
  };
}

// ---- the receiver: what a peer's act is -----------------------------------------------------------------------------

/** The act a drawn pose names, or null off one. */
export const gatherActOf = (shown) => GATHER_POSE_ACTS[(shown?.ga | 0) - 1] ?? null;
/** The kind of the beat a `gb` names, or null for none. */
export const gatherBeatOf = (gb) => ((gb | 0) > 0 ? GATHER_POSE_BEATS[(gb | 0) & 15] ?? null : null);
/** The acts the body kneels for: a herb by hand or with the sickle, the Basket's search, the knife at a body. */
const KNEELS = new Set(['hand', 'steady', 'basket', 'trace']);
/** Whether a drawn pose kneels at its act. */
export const peerKneeling = (shown) => KNEELS.has(/** @type {string} */ (gatherActOf(shown)));
/** The tool the act holds, as a weapon the bodies can hold: the classic lane's own stand-ins for the hand (scenes/
 *  treeHost.js AXE_HAND, mineHost.js PICK_HAND, herbHost.js SICKLE_HAND, huntHost.js KNIFE_HAND - pinned equal, not
 *  imported: the peer layer takes no gathering host). The bare hand, the Basket and the net hold no weapon. */
export const GATHER_POSE_TOOLS = f({
  chop: f({ group: 'Weapons', templateIndex: 128, material: 0 }),
  mine: f({ group: 'Weapons', templateIndex: 126, material: 0 }),
  steady: f({ group: 'Weapons', templateIndex: 114, material: 0 }),
  trace: f({ group: 'Weapons', templateIndex: 113, material: 0 }),
});
/** The tool a drawn pose holds for its act, or null (no act, or a hand that holds none). */
export const peerGatherTool = (shown) => GATHER_POSE_TOOLS[/** @type {keyof typeof GATHER_POSE_TOOLS} */ (gatherActOf(shown))] ?? null;
/** The strike a tool's blow is drawn with - the hand's own (scenes/treeHost.js axeHandFrame's StrikeDownRight, mineHost.js
 *  pickHandFrame's StrikeDown). */
export const GATHER_POSE_STRIKES = f({ chop: 'StrikeDownRight', mine: 'StrikeDown' });

/**
 * A lane's own record of a peer's act (`seen`, an empty object at first sight): answers what this pose begins - 'blow' a
 * tool's blow (a new beat that is a blow or a clean one), 'throw' the net thrown (the act turned to its flight), or null -
 * and keeps the pose as seen. The first sight begins nothing (an old act is not replayed); the beats' count is kept
 * across an act's absence, so an old beat seen again is no new one.
 * @param {{ init?: boolean, ga?: number, gb?: number }} seen @param {any} shown @returns {'blow'|'throw'|null}
 */
export function peerGatherSwing(seen, shown) {
  const ga = shown?.ga | 0, gb = shown?.gb | 0;
  if (!seen.init) { seen.init = true; seen.ga = ga; seen.gb = gb; return null; }
  let out = /** @type {'blow'|'throw'|null} */ (null);
  if (gb > 0 && gb !== seen.gb) { const k = gatherBeatOf(gb); if (k === 'blow' || k === 'clean') out = 'blow'; }
  if (!out && ga !== seen.ga && GATHER_POSE_ACTS[ga - 1] === 'fly') out = 'throw';
  seen.ga = ga;
  if (gb > 0) seen.gb = gb;
  return out;
}

// ---- the receiver: what a peer's act sounds like ---------------------------------------------------------------------

/** The least time between two of one peer's beats (ms): three quarters of a pose at the pose's top rate (net/online.js
 *  POSE_HZ, pinned - AUDIT GATHER-FEEL R7: it is no floor of the climb's). The wire carries an honest act's beats one a pose
 *  at most - a tool's a swing apart (0.45 s), the knife's strokes and the Basket's finds as often as a pose goes - and a
 *  pose stream that flips its fields every pose would ask a one-shot of every drawn frame. A blow taken back is no cue:
 *  it is heard under the floor. AUDIT GATHER F8 (Professions-Arc section 55): it was a whole pose (100), and the receiver
 *  measures a pose's gap on its own frames - a frame either side of 100 ms - so an honest beat a pose was dropped as often
 *  as not (100 of 199 heard at 75 Hz, 333 of 399 at 60 with a frame's jitter): a quarter of a pose below it, every one is
 *  heard at any refresh, and a flipping stream is still held to one a 75 ms. */
export const PEER_GATHER_CUE_MS = 75;
/** Where a peer's act is heard: this far before the body (metres, along its facing - a node is worked within DFU's
 *  activation distance), this high off its feet. */
export const PEER_ACT_REACH_M = 1;
export const PEER_ACT_HIGH_M = 0.8;
/** A peer's blow lands this long after the beat that swung it (s): DFU's melee hit frame of the tool's own swing (the
 *  acts' `landsIn`, GATHER-FEEL) - the axe's and the pick's swing are one length (CHOP_ACT, MINE_ACT). */
export const PEER_BLOW_DELAY_S = Object.freeze({ chop: CHOP_ACT.swingS * MELEE_HIT_SHARE, mine: MINE_ACT.swingS * MELEE_HIT_SHARE });
/** The beats a pose's beat says, by its kind and the act (the tool's blow its own clip). */
const BLOW_SAYS = f({ chop: f({ blow: 'chop', clean: 'chopClean' }), mine: f({ blow: 'pick', clean: 'pickGlint' }) });
const BEAT_SAYS = f({ bruise: 'bruise', pluck: 'pluck', find: 'find', miss: 'miss', knife: 'knife', slice: 'slice', tear: 'tear', peel: 'peel', out: 'netOut' });

/** A peer's act's place: PEER_ACT_REACH_M before its feet along its facing, PEER_ACT_HIGH_M up. */
export const peerActAt = (feet, yaw, reach = PEER_ACT_REACH_M, high = PEER_ACT_HIGH_M) => [feet[0] + Math.sin(yaw) * reach, feet[1] + high, feet[2] + Math.cos(yaw) * reach];
/** The acts a net is out for (its water heard where it landed). */
const NET_OUT = new Set(['wait', 'tug', 'haul']);
/** Where a peer's net landed: its throw (`gm`, whole metres) before its feet along its facing, at their height - null
 *  with no throw on the pose. */
const peerNetAt = (shown, feet, yaw) => (feet && (shown?.gm | 0) > 0 ? [feet[0] + Math.sin(yaw) * shown.gm, feet[1], feet[2] + Math.cos(yaw) * shown.gm] : null);

export class PeerGatherSounds {
  /**
   * @param {{ audio?: any, profile?: any, on?: () => boolean, rand?: () => number, install?: boolean, now?: () => number }} [opts]
   *   `audio` the bus (play3d); `profile` the peers' falloff (remotePlayers.js PEER_SOUND_PROFILE); `on` the port's own
   *   sounds' switch (systems/enhancedSounds.js - off, each beat's DFU cue); `rand` the variety's dice; `install` false
   *   keeps the clips unloaded; `now` the clock (ms) the floor and the held blows read (the pins' seam).
   */
  constructor({ audio = null, profile = null, on = enhancedSoundsOn, rand = Math.random, install = true, now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) } = {}) {
    this.audio = audio;
    this.profile = profile;
    this.on = on;
    this.rand = rand;
    this.install = install;
    this.now = now;
    /** id -> { ga, gb, net, cueAt, plipAt, thrashAt, held: [{ due, name, at, pitch, gain, n }] } - `n` a held blow's count */
    this.peers = new Map();
    /** sound -> the key last played */
    this.last = new Map();
  }

  /**
   * One drawn frame of a peer: `shown` their pose, `feet` their feet in the scene, `heard` whether they are in earshot and
   * the switch lets them be heard (out of it the act's state is kept silently, its held blows dropped).
   */
  update(id, shown, feet, heard = true) {
    const ga = shown?.ga | 0, gb = shown?.gb | 0;
    const yaw = Number.isFinite(shown?.yaw) ? shown.yaw : 0;
    let s = this.peers.get(id);
    if (!s) { this.peers.set(id, { ga, gb, net: null, cueAt: -Infinity, plipAt: Infinity, thrashAt: Infinity, held: [] }); return; }   // first seen: an old act is not replayed
    const fresh = gb > 0 && gb !== s.gb;   // a beat not yet heard (AUDIT GATHER-FEEL W4: none on a pose that names none - a reload's new page, its count not yet begun)
    if (!ga && !s.ga && !fresh && !s.held.length) return;   // gathering nothing, no new beat, nothing in the air: a frame's no work (every peer in the room passes here)
    const t = this.now();
    const doing = GATHER_POSE_ACTS[ga - 1] ?? null, before = GATHER_POSE_ACTS[s.ga - 1] ?? null;   // the act now, and as last seen (named apart from the hosts' key `act` - ROAD-H H5's sweep reads `if (act === ...)` as a key's arm)
    const ok = heard && !!feet && !!this.audio?.play3d;
    if (ok && this.install && this.on()) installGatherSounds(this.audio);
    const place = feet ? peerActAt(feet, yaw) : null;
    // AUDIT GATHER-FEEL W2: a blow taken back - its act let go while it was in the air (the pose's `stop`) - goes before it
    // lands, as the gatherer's own ear drops it: the blow counted just before the stop, under the floor or not
    if (fresh && gatherBeatOf(gb) === 'stop' && s.held.length) { const was = (((gb >> 4) + 253) % 255) + 1; s.held = s.held.filter((h) => h.n !== was); }
    // the held blows whose time has come, first - they were struck before anything this pose begins; dropped with the
    // peer out of earshot
    if (s.held.length) {
      if (!ok) s.held.length = 0;
      else {
        const due = s.held.filter((h) => h.due <= t);
        if (due.length) { s.held = s.held.filter((h) => h.due > t); for (const h of due) this._say(h.name, h.at, h.pitch, h.gain); }
      }
    }
    const cueOk = t - s.cueAt >= PEER_GATHER_CUE_MS;
    let cued = false;
    if (ok && cueOk) {
      // the act turned: the kneel among the leaves, the net thrown, landing, tugged, hauled
      if (doing !== before) {
        if (doing === 'hand' || doing === 'steady' || doing === 'basket') { this._say('kneel', place); cued = true; }
        if (doing === 'fly') { this._say('throw', place); cued = true; }
        if (doing === 'wait') {
          s.net = peerNetAt(shown, feet, yaw) ?? place;
          this._say('netLand', s.net); cued = true;
        }
        if (doing === 'tug') { this._say('tug', s.net ?? place); cued = true; }
        if (doing === 'haul') { this._say('hauling', s.net ?? place); cued = true; }
      }
      // a beat: the tool's swing now and its blow on the hit frame (the tool the act's - or, a last blow come with the
      // pose that let the act go, the act's it ended); the hand's, the knife's and the net's own
      if (fresh) {
        const kind = gatherBeatOf(gb);
        const tool = doing === 'chop' || doing === 'mine' ? doing : before === 'chop' || before === 'mine' ? before : null;
        const blow = (kind === 'blow' || kind === 'clean') && tool ? BLOW_SAYS[tool][kind] : null;
        if (blow && tool && place) {
          this._say('swing', place, tool === 'mine' ? GATHER_SOUND.PICK_SWING_PITCH : 1);
          s.held.push({ due: t + PEER_BLOW_DELAY_S[tool] * 1000, name: blow, at: place, pitch: 1, gain: 1, n: gb >> 4 });
          cued = true;
        } else if (kind && BEAT_SAYS[/** @type {keyof typeof BEAT_SAYS} */ (kind)]) {
          this._say(BEAT_SAYS[/** @type {keyof typeof BEAT_SAYS} */ (kind)], kind === 'out' ? peerActAt(feet, yaw, 0, PEER_ACT_HIGH_M) : place);
          cued = true;
        }
      }
    }
    if (cued) s.cueAt = t;
    // the net's place is state, not a cue (AUDIT GATHER-FEEL W1): found whenever its act is out and none is held - its
    // landing unheard (out of earshot, under the floor, before the first sight) leaves its water at the net, not the body
    if (!NET_OUT.has(/** @type {string} */ (doing))) s.net = null;
    else if (!s.net) s.net = peerNetAt(shown, feet, yaw);
    // the water's own beats: a plip by the floats while the net waits, the catch fighting while it hauls
    if (doing === 'wait') {
      if (before !== 'wait' || !Number.isFinite(s.plipAt)) s.plipAt = t + this._span(GATHER_SOUND.PLIP_MIN_S, GATHER_SOUND.PLIP_MAX_S);
      else if (t >= s.plipAt) { if (ok) this._say('plip', s.net ?? place); s.plipAt = t + this._span(GATHER_SOUND.PLIP_MIN_S, GATHER_SOUND.PLIP_MAX_S); }
    } else s.plipAt = Infinity;
    if (doing === 'haul') {
      if (before !== 'haul' || !Number.isFinite(s.thrashAt)) s.thrashAt = t + this._span(GATHER_SOUND.THRASH_MIN_S, GATHER_SOUND.THRASH_MAX_S);
      else if (t >= s.thrashAt) { if (ok) this._say('thrash', s.net ?? place); s.thrashAt = t + this._span(GATHER_SOUND.THRASH_MIN_S, GATHER_SOUND.THRASH_MAX_S); }
    } else s.thrashAt = Infinity;
    s.ga = ga;
    if (gb > 0) s.gb = gb;
  }

  /** A peer gone (left the room, out of the drawn set): the next sight of them is a first. */
  forget(id) { this.peers.delete(id); }
  /** The floating origin moved (`offset` added to every scene point - world.js's recentre, through remotePlayers.js
   *  rebaseSounds): the places held (a net's where it landed, a blow's in the air) move with the land (AUDIT GATHER-FEEL
   *  W1: dropped, a net's water was heard at the body for the rest of its cast). */
  rebase(offset) {
    if (!offset) return;
    for (const s of this.peers.values()) for (const p of [s.net, ...s.held.map((h) => h.at)]) if (p) { p[0] += offset[0]; p[1] += offset[1]; p[2] += offset[2]; }
  }

  _span(lo, hi) { return (lo + this.rand() * (hi - lo)) * 1000; }

  /** A beat said at `at`: the port's own clip on the enhanced skin (its volume, its pitch and its variety, the ear's -
   *  GATHER_SAY), the DFU cue the HUD said for it on the classic one - positional either way, with the peers' falloff. */
  _say(name, at, pitch = 1, gain = 1) {
    const say = GATHER_SAY[/** @type {keyof typeof GATHER_SAY} */ (name)];
    if (!say || !at) return;
    try {
      if (this.on()) {
        const key = gatherClip(say.sfx, this.last.get(say.sfx) ?? null, this.rand);
        if (!key) return;
        this.last.set(say.sfx, key);
        const jitter = say.jitter ?? GATHER_SOUND.PITCH_JITTER;
        const p = (say.pitch ?? 1) * pitch * (1 + jitter * (2 * this.rand() - 1));
        this.audio.play3d(key, at, Math.min(1, say.volume * gain), { ...(this.profile ?? {}), pitch: p });
        return;
      }
      const cue = say.classic ? PROF_CUES[/** @type {keyof typeof PROF_CUES} */ (say.classic)] : null;
      if (!cue?.clips.length) return;
      const clip = cue.clips[Math.min(cue.clips.length - 1, Math.floor(this.rand() * cue.clips.length))];
      this.audio.play3d(clip, at, cue.volume, { ...(this.profile ?? {}) });
    } catch { /* a peer's sound never stops the frame */ }
  }
}
