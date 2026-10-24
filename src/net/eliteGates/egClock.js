// @ts-check
// EG-H1 (EG8d, 2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 10.8, "The shared
// clock is corrected"): THE BREACH'S SHARED CLOCK, KEPT AS NTP KEEPS IT. A client set its shared clock from the welcome
// alone (net/online.js `clockOffsetMs = m.now - Date.now()`), so it ran late by the welcome's one-way latency: a member
// saw every blow land and every platform stand that much after the relay had them there. In an `eg:` room the client
// pings (`clk`, a number), the room answers at once with its clock (`clk`, the number and `now`), and each answer is a
// sample: the relay's `now` less the midpoint of the ping's send and its answer's arrival - half the round trip. The
// offset is the median of the last EG_CLOCK_SAMPLES, taken in a burst EG_CLOCK_SPACING_MS apart and again every
// EG_CLOCK_EVERY_MS; an answer slower than EG_CLOCK_RTT_MAX_MS is no sample.
//
// Each ping says the one-way delay this clock measured (`h`, half its median round trip - egClockHalfRtt): the room reads
// a pose's send time by it (net/eliteGates/egFair.js egPoseShared - THE TIME LAW), so a dodge sent in a landing's last round trip is
// never counted. Pure but for its own record: `egClockDue` names the ping to send now (or null), `egClockHeard` folds an
// answer, and `egClockOffset` is the offset to add to this machine's wall clock (null until a sample). Not a DFU member.
// Ledger A (ELITE-GATES).

/** Samples kept (the median of them is the offset), the burst's spacing, how often the burst is taken again (ms). */
export const EG_CLOCK_SAMPLES = 5;
export const EG_CLOCK_SPACING_MS = 250;
export const EG_CLOCK_EVERY_MS = 30_000;
/** An answer slower than this is no sample (ms); a ping unanswered this long is forgotten. */
export const EG_CLOCK_RTT_MAX_MS = 5000;

/** A breach's shared clock, new: no samples, its first burst due at once. */
export const egClockNew = () => ({ seq: 0, sent: /** @type {Map<number, number>} */ (new Map()), samples: /** @type {number[]} */ ([]), rtts: /** @type {number[]} */ ([]), burst: 0, nextAt: 0 });
/**
 * The ping due at `wall` (this machine's clock, ms): its number, or null. A burst of EG_CLOCK_SAMPLES pings
 * EG_CLOCK_SPACING_MS apart, then the next burst EG_CLOCK_EVERY_MS on. The ping's send time is kept against its number.
 * @param {ReturnType<typeof egClockNew>} C @param {number} wall
 */
export function egClockDue(C, wall) {
  for (const [c, at] of C.sent) if (wall - at > EG_CLOCK_RTT_MAX_MS) C.sent.delete(c);
  if (wall < C.nextAt) return null;
  C.seq = (C.seq + 1) & 0x7fffffff;
  C.sent.set(C.seq, wall);
  C.burst++;
  if (C.burst >= EG_CLOCK_SAMPLES) { C.burst = 0; C.nextAt = wall + EG_CLOCK_EVERY_MS; } else C.nextAt = wall + EG_CLOCK_SPACING_MS;
  return C.seq;
}
/**
 * An answer heard at `wall`: ping `c`, the relay's `now` - a sample (the relay's clock less the midpoint of send and
 * arrival), kept to the last EG_CLOCK_SAMPLES. Answers whether it was one.
 * @param {ReturnType<typeof egClockNew>} C @param {number} c @param {number} now @param {number} wall
 */
export function egClockHeard(C, c, now, wall) {
  const at = C.sent.get(c);
  if (at == null || !Number.isFinite(now)) return false;
  C.sent.delete(c);
  const rtt = wall - at;
  if (!(rtt >= 0) || rtt > EG_CLOCK_RTT_MAX_MS) return false;
  C.samples.push(now - (at + wall) / 2);
  C.rtts.push(rtt);
  if (C.samples.length > EG_CLOCK_SAMPLES) C.samples.shift();
  if (C.rtts.length > EG_CLOCK_SAMPLES) C.rtts.shift();
  return true;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
/** The offset to add to this machine's wall clock for the relay's (ms): the median of the samples, null before any. */
export const egClockOffset = (C) => (C.samples.length ? median(C.samples) : null);
/** The one-way delay this clock measured (ms, whole): half the median round trip - said with each ping, so the room places
 *  this member's poses at the instant they were sent (net/eliteGates/egFair.js egPoseShared). 0 before any answer. */
export const egClockHalfRtt = (C) => (C.rtts.length ? Math.round(median(C.rtts) / 2) : 0);
