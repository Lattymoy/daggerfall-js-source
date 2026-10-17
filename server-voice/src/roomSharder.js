// @ts-check
// A packed game room splits across several SFU rooms so no one room holds more than VOICE_ROOM_MAX - sticky per
// identity so two players already sharing a shard are never moved apart mid-session by a later reconnect.
//
// Per-isolate, like ProximityPolicy beside it - a multi-isolate deploy would see one isolate's count alone, which
// can only ever UNDER-count (two isolates could each think a shard has room and both fill it), never over-admit
// past what the SFU's own max_participants enforces as the hard backstop.
//
// LIMITATION: shards fill by arrival order, not position - two players standing side by side in an overflowing
// room can land in different shards and be unable to hear each other. True spatial sharding would need position
// at mint time and a consistent spatial key instead of first-fit; this is simple overflow capacity, not that.

import { VOICE_ROOM_MAX } from '../../src/voice/voiceWire.js';

/** Shards per base room - 16 * VOICE_ROOM_MAX seats, enough headroom for "a few hundred" with the hard cap intact. */
export const VOICE_ROOM_SHARDS_MAX = 16;
/** An identity unheard-from this long gives its shard seat back - mirrors ProximityPolicy's own idle window. */
export const VOICE_SHARD_IDLE_MS = 10 * 60_000;

export class RoomSharder {
  constructor({ now = () => Date.now() } = {}) {
    this._now = now;
    /** @type {Map<string, { counts: number[], seats: Map<string, { shard: number, at: number }> }>} base room -> live shard occupancy, kept running so assign() never rescans the room */
    this.rooms = new Map();
  }

  /** The shard index for IDENTITY in BASEROOM - first with room on a cold ask, then sticks until idle; O(1) at the cost of a bounded overcount from stale-but-unswept seats (never an undercount). */
  assign(baseRoom, identity) {
    let r = this.rooms.get(baseRoom);
    if (!r) { r = { counts: new Array(VOICE_ROOM_SHARDS_MAX).fill(0), seats: new Map() }; this.rooms.set(baseRoom, r); }
    const now = this._now();
    const mine = r.seats.get(identity);
    if (mine && now - mine.at <= VOICE_SHARD_IDLE_MS) { mine.at = now; return mine.shard; }
    if (mine) r.counts[mine.shard]--;   // a stale seat of this SAME identity's own - its old slot is given back before a new one is taken
    let shard = r.counts.findIndex((n) => n < VOICE_ROOM_MAX);
    if (shard === -1) shard = VOICE_ROOM_SHARDS_MAX - 1;   // every shard full: the SFU's own cap is the last word
    r.counts[shard]++;
    r.seats.set(identity, { shard, at: now });
    return shard;
  }

  /** IDENTITY's current shard if it has one and it is still fresh (and touches it) - null asks assign() instead. */
  shardOf(baseRoom, identity) {
    const mine = this.rooms.get(baseRoom)?.seats.get(identity);
    if (!mine || this._now() - mine.at > VOICE_SHARD_IDLE_MS) return null;
    mine.at = this._now();
    return mine.shard;
  }

  /** The identity leaves: its seat is given back at once rather than waiting out the idle window. */
  leave(baseRoom, identity) {
    const r = this.rooms.get(baseRoom);
    const mine = r?.seats.get(identity);
    if (!r || !mine) return;
    r.counts[mine.shard]--;
    r.seats.delete(identity);
    if (!r.seats.size) this.rooms.delete(baseRoom);
  }

  /** The stale seats and the idle rooms, dropped - the one place a full scan is paid, and only periodically. */
  sweep() {
    const now = this._now();
    let gone = 0;
    for (const [room, r] of this.rooms) {
      for (const [id, w] of r.seats) if (now - w.at > VOICE_SHARD_IDLE_MS) { r.counts[w.shard]--; r.seats.delete(id); gone++; }
      if (!r.seats.size) this.rooms.delete(room);
    }
    return gone;
  }
}

/** The physical SFU room name for a shard index - shard 0 is the base room itself, unchanged for old deploys. */
export function shardRoomName(baseRoom, shard) {
  return shard > 0 ? `${baseRoom}_s${shard}` : baseRoom;
}
