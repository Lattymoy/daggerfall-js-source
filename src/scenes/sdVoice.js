// @ts-check
// AUDIT SD II (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's SD11d): THE
// HOUR'S VOICE - every line the arc says over the middle of the screen, paced. DFU's label (ui/midScreenText.js) holds one
// line, and each write replaced the last: at the kill three lines took it within 1.2 s (the fall, the collapse's first
// readout, the spoils) and the arc's climax was never read; the second Echo's fall stood 250 ms under the Last Moment's;
// and every line stood DFU's 1.5 s whatever its length (the Dragon Break's order needs 4.9).
//
// The law (the gate's WB13e, made one door): a line stands for its length (gateCourt.js courtSaySeconds) and is never
// replaced inside it by a line no more urgent; a line said while another stands waits its turn - the fight's turns first
// (`turn`: the kill, a phase, an order, a refusal, a way out), then what the floor says (`note`), then the readouts
// (`readout`), each rank in the order said; a line more urgent than the one standing cuts it, and the cut line goes
// back to the head of its rank to be read whole (AUDIT SD IV, T2). A line that has waited past its life is let go (a
// readout's moment passes); the same line waiting twice waits once. A line of a THREAD (`key`
// - the Reset's Hearts: its call, then each one broken and how many stand) says the thread anew: it takes the place of
// the thread's line standing or waiting, never queued behind it - five Hearts broken in a second queued five counts, and
// the stun's "Strike now!" stood seven seconds late, as the stun ran out.
//
// `createSdVoice` is pure but for `show` and the clock it is handed. Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { courtSaySeconds } from './gateCourt.js';

/** The ranks, the most urgent first. */
export const SD_VOICE_RANK = Object.freeze({ turn: 0, note: 1, readout: 2 });
/** How long a line may wait for the screen before it is let go, ms - a turn's or a note's, and a readout's (it says a time). */
export const SD_VOICE_WAIT_MS = Object.freeze([8000, 8000, 5000]);
/** AUDIT SD IV (T2): a line cut with less than this left of its time was read (ms); one cut sooner goes back. */
export const SD_VOICE_READ_MS = 1000;

/**
 * @param {{ show: (text: string, seconds: number) => void, now: () => number, seconds?: (text: string) => number }} o
 *   `show` the label's door (world.js setMidScreenText); `now` a clock in ms (the page's own)
 */
export function createSdVoice({ show, now, seconds = courtSaySeconds }) {
  /** the line standing: its rank, when it has stood its time, and its thread */
  let standing = null;
  /** @type {{ text: string, rank: number, at: number, key: string|null }[]} */
  const waiting = [];
  const put = (text, rank, t, key) => { show(text, seconds(text)); standing = { text, rank, until: t + seconds(text) * 1000, key }; };
  /** AUDIT SD IV (T2): A LINE CUT IS SAID AGAIN - back at the head of its rank, to be read whole, its wait begun anew: the
   *  way home's rising cut the collapse's first readout (its count, and where the way home is) 0.5 s into its 3.7, and
   *  a no-spoils note was cut the frame it was said - each lost for good. Not a thread's line its newer word replaced. */
  const back = (w, t) => {
    if (w.until - t < SD_VOICE_READ_MS || waiting.some((x) => x.text === w.text)) return;
    let i = 0;
    while (i < waiting.length && waiting[i].rank < w.rank) i++;
    waiting.splice(i, 0, { text: w.text, rank: w.rank, at: t, key: w.key });
  };
  function pump(t) {
    if (standing && t < standing.until) return;
    standing = null;
    while (waiting.length) {
      const w = waiting.shift();
      if (t - w.at <= SD_VOICE_WAIT_MS[w.rank]) { put(w.text, w.rank, t, w.key); return; }
    }
  }
  return {
    /** A line said - at once if nothing stands (or what stands is less urgent, or its own thread's), else in its turn;
     *  `key` its thread, if it has one. */
    say(text, rank = SD_VOICE_RANK.turn, key = null) {
      if (typeof text !== 'string' || !text) return;
      const r = Number.isInteger(rank) && rank >= 0 && rank < SD_VOICE_WAIT_MS.length ? rank : SD_VOICE_RANK.turn;
      const k = typeof key === 'string' && key ? key : null;
      const t = now();
      pump(t);
      if (!standing || r < standing.rank || (k !== null && standing.key === k)) {
        if (k !== null) { const j = waiting.findIndex((w) => w.key === k); if (j >= 0) waiting.splice(j, 1); }
        if (standing && r < standing.rank && (k === null || standing.key !== k)) back(standing, t);
        put(text, r, t, k);
        return;
      }
      if (k !== null) {
        const j = waiting.findIndex((w) => w.key === k);
        if (j >= 0 && waiting[j].rank === r) { waiting[j] = { text, rank: r, at: t, key: k }; return; }   // its place, the newer word
        if (j >= 0) waiting.splice(j, 1);
      }
      if (waiting.some((w) => w.text === text)) return;
      let i = waiting.length;
      while (i > 0 && waiting[i - 1].rank > r) i--;
      waiting.splice(i, 0, { text, rank: r, at: t, key: k });
    },
    /** One frame: the next line waiting, once the one standing has stood its time. */
    frame() { pump(now()); },
    /** Nothing more to say: what waits is let go; what stands, stands. */
    clear() { waiting.length = 0; },
    /** The Hour left: what waits for it - its readouts and the floor's notes (a collapse I am out of) - is let go, and its
     *  turns still come in their order: AUDIT SD III (H5) - the way out's own words waited behind a turn still standing
     *  ("The way home carries you out of the Hour" behind "The way home stands open.") and were let go unread. */
    leave() { for (let i = waiting.length - 1; i >= 0; i--) if (waiting[i].rank !== SD_VOICE_RANK.turn) waiting.splice(i, 1); },
    /** What waits, for the tests. */
    waiting: () => waiting.map((w) => w.text),
  };
}
