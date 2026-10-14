// @ts-check
// Decides who may HEAR whom - never a client's own volume knob. A publisher is heard only by listeners who named
// it back within the stale window (mutual), so lying about position can only widen your own hearing, never others'.

import { VOICE_PLACE_MS } from '../../src/voice/voiceProximity.js';

/** A listener's place frame older than this says nothing - its holder is heard by nobody and hears nobody. */
export const VOICE_PLACE_STALE_MS = 6 * VOICE_PLACE_MS;
/** A room with no frame this long is forgotten. */
export const VOICE_ROOM_IDLE_MS = 10 * 60_000;

export class ProximityPolicy {
  constructor({ now = () => Date.now() } = {}) {
    this._now = now;
    /** @type {Map<string, Map<string, { near: Set<string>, at: number }>>} room -> identity -> its word */
    this.rooms = new Map();
  }

  /** A listener's word: the identities near it now. */
  place(room, identity, near) {
    let r = this.rooms.get(room);
    if (!r) { r = new Map(); this.rooms.set(room, r); }
    r.set(identity, { near: new Set(near.filter((id) => id !== identity)), at: this._now() });
  }

  /** The listener leaves: its word gone, and nobody's list names it. */
  leave(room, identity) {
    const r = this.rooms.get(room);
    if (!r) return;
    r.delete(identity);
    if (!r.size) this.rooms.delete(room);
  }

  /** The listeners allowed PUBLISHER's voice: mutual and fresh. Sorted, so a test can deepEqual it. */
  allowFor(room, publisher) {
    const r = this.rooms.get(room);
    const me = r?.get(publisher);
    const now = this._now();
    if (!r || !me || now - me.at > VOICE_PLACE_STALE_MS) return [];
    const out = [];
    for (const id of me.near) {
      const them = r.get(id);
      if (them && now - them.at <= VOICE_PLACE_STALE_MS && them.near.has(publisher)) out.push(id);
    }
    return out.sort();
  }

  /** Is LISTENER allowed PUBLISHER's voice now - the same law, asked the other way. */
  mayHear(room, listener, publisher) { return this.allowFor(room, publisher).includes(listener); }

  /** The stale words and the idle rooms, dropped. Answers how many words went. */
  sweep() {
    const now = this._now();
    let gone = 0;
    for (const [room, r] of this.rooms) {
      for (const [id, w] of r) if (now - w.at > VOICE_ROOM_IDLE_MS) { r.delete(id); gone++; }
      if (!r.size) this.rooms.delete(room);
    }
    return gone;
  }
}
