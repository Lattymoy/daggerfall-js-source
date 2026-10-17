// @ts-check
// Pure proximity math (no audio/transport deps) so voiceClient.js and tests can drive it directly.

/** Full volume inside this distance (scene units). */
export const VOICE_FULL_RANGE = 6;
/** Past here a peer is unsubscribed outright - a silent gain alone is never the access control. */
export const VOICE_SILENT_RANGE = 40;
/** Wider than SILENT so a peer pacing the edge isn't flapped on/off the SFU every frame. */
export const VOICE_RESUB_RANGE = 44;
/** How often membership is re-read and pushed to the server (ms) - a rate limit, not a precision knob. */
export const VOICE_PLACE_MS = 500;
/** Caps subscriptions in a crowd (nearest win) so one client never opens more than this many decoders. */
export const VOICE_SUBS_MAX = 8;

/** Linear falloff, 1 at `full` down to 0 at `silent`.
 * @param {number} d @param {number} [full] @param {number} [silent] */
export function voiceGainAt(d, full = VOICE_FULL_RANGE, silent = VOICE_SILENT_RANGE) {
  if (!Number.isFinite(d) || d < 0) return 0;
  if (d <= full) return 1;
  if (d >= silent) return 0;
  return (silent - d) / (silent - full);
}

/** Ground-plane distance (y ignored) between two feet; NaN when either is unplaceable. */
export function feetDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return NaN;
  const dx = Number(b[0]) - Number(a[0]), dz = Number(b[2]) - Number(a[2]);
  return Math.hypot(dx, dz);
}

/** Stereo pan of a speaker relative to a listener's heading (-1 left, +1 right, 0 centred).
 * @param {number[]} listener @param {number[]} speaker @param {number} yaw */
export function panFor(listener, speaker, yaw) {
  const dx = Number(speaker?.[0]) - Number(listener?.[0]), dz = Number(speaker?.[2]) - Number(listener?.[2]);
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || !Number.isFinite(yaw)) return 0;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return 0;
  // project onto the listener's right vector (forward is -Z at yaw 0)
  const rx = Math.cos(yaw), rz = Math.sin(yaw);
  const pan = (dx * rx + dz * rz) / len;
  return Math.max(-1, Math.min(1, pan));
}

/** @typedef {{ id: string, feet: number[], here?: boolean }} VoicePeer  `here: false` means another place - never eligible */

/** Eligible peers within range, nearest first, capped at `max`, with hysteresis for ones already held.
 * @param {number[]|null} here @param {VoicePeer[]} peers @param {Set<string>|Iterable<string>} held
 * @param {{ full?: number, silent?: number, resub?: number, max?: number }} [law]
 * @returns {{ id: string, d: number, gain: number }[]} */
export function proximitySet(here, peers, held, { full = VOICE_FULL_RANGE, silent = VOICE_SILENT_RANGE, resub = VOICE_RESUB_RANGE, max = VOICE_SUBS_MAX } = {}) {
  if (!Array.isArray(here) || !Array.isArray(peers)) return [];
  const kept = held instanceof Set ? held : new Set(held ?? []);
  const rows = [];
  for (const p of peers) {
    if (!p || typeof p.id !== 'string' || p.here === false) continue;
    const d = feetDistance(here, p.feet);
    if (!Number.isFinite(d)) continue;
    const edge = kept.has(p.id) ? resub : silent;   // hysteresis: a held peer gets the wider edge
    if (d >= edge) continue;
    rows.push({ id: p.id, d, gain: voiceGainAt(d, full, silent) });
  }
  rows.sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));   // tie-break by id: deterministic across listeners
  return rows.slice(0, max);
}

/** The subscribe/unsubscribe diff between what's held and what the law wants now.
 * @param {Iterable<string>} held @param {{ id: string }[]} want */
export function subscriptionDiff(held, want) {
  const have = new Set(held ?? []);
  const next = new Set(want.map((w) => w.id));
  const open = [], drop = [];
  for (const id of next) if (!have.has(id)) open.push(id);
  for (const id of have) if (!next.has(id)) drop.push(id);
  return { open, drop };
}
