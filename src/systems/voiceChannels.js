// VOICE-CUT1: client-side speech playback ownership.
//
// Network voice frames are already validated by net/online.js. This tiny controller
// answers a different question: which sound source is allowed to remain audible for
// a given speaker. One speaker gets one generation and one interruptible handle.
// Replacing a generation stops the old handle before any async asset load begins;
// attaching a stale handle stops it immediately instead of letting an old Morrowind
// decode start after a newer line.

import { getPref } from './uiPrefs.js';

/** VOICE-RANGE1/2: speech carries farther than incidental peer sounds.
 * Keep footsteps/swings/riding on PEER_SOUND_PROFILE (6 -> 30 m); spoken lines
 * default to 45 m and the listener may tune that range from 15..100 m. */
export const VOICE_DISTANCE_MIN = 15;
export const VOICE_DISTANCE_MAX = 100;
export const VOICE_DISTANCE_DEFAULT = 45;
export const VOICE_VOLUME_MIN = 0;
export const VOICE_VOLUME_MAX = 2;
export const VOICE_VOLUME_DEFAULT = 1;
const clampNumber = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};
export const voiceDistance = () => clampNumber(getPref('voiceDistance'), VOICE_DISTANCE_MIN, VOICE_DISTANCE_MAX, VOICE_DISTANCE_DEFAULT);
export const voiceVolume = () => clampNumber(getPref('voiceVolume'), VOICE_VOLUME_MIN, VOICE_VOLUME_MAX, VOICE_VOLUME_DEFAULT);
export const voiceSoundProfile = () => Object.freeze({ refDistance: 8, maxDistance: voiceDistance(), distanceModel: 'linear' });
export const voiceInEarshot = (at, eye) => !(eye && eye.length === 3)
  || Math.hypot(at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]) < voiceDistance();

export class VoiceChannels {
  constructor() { this._speakers = new Map(); }

  /** Cut the current line for id and begin a new generation. */
  replace(id) {
    const old = this._speakers.get(id);
    old?.stop?.();
    const generation = (old?.generation ?? 0) + 1;
    this._speakers.set(id, { generation, stop: null, move: null });
    return generation;
  }

  /** Is generation still the newest request for this speaker? */
  current(id, generation) {
    return this._speakers.get(id)?.generation === generation;
  }

  /** Give the current generation its interruptible AudioEngine handle.
   * A stale async completion is stopped immediately and never becomes current. */
  attach(id, generation, handle) {
    if (!handle?.stop) return false;
    const slot = this._speakers.get(id);
    if (!slot || slot.generation !== generation) {
      handle.stop();
      return false;
    }
    this._speakers.set(id, { generation, stop: handle.stop, move: typeof handle.move === 'function' ? handle.move : null });
    return true;
  }

  /** VOICE-MOVE1: keep active positional lines on the speaker's live interpolated body.
   * Flat self-echo handles have no move function and are deliberately ignored. A remote
   * speaker that leaves the roster takes their still-playing line with them. */
  syncPositions(peers, positionOf) {
    for (const [id, slot] of this._speakers) {
      if (!slot.move) continue;
      const peer = peers?.get?.(id);
      if (!peer?.shown) {
        slot.stop?.();
        this._speakers.delete(id);
        continue;
      }
      slot.move(positionOf(peer.shown));
    }
  }

  stop(id) {
    const slot = this._speakers.get(id);
    if (!slot) return false;
    slot.stop?.();
    this._speakers.delete(id);
    return true;
  }

  clear() {
    for (const slot of this._speakers.values()) slot.stop?.();
    this._speakers.clear();
  }
}
