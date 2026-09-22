// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ACC4 — TIME PLAYED, and why the CLIENT only knocks.
//
// Mac (2026-09-22): "Lets add an account registered date and time
// played to the icon profile."
//
// ═══ THE SERVICE'S CLOCK MEASURES IT, NOT THIS ONE ═════════════════
//
// The obvious build is a counter in the tab that posts "I played 300
// seconds". That is a number the client ASSERTS, and ACC1g/ACC3 have
// already settled what this project does with a client's word about
// itself: nothing. A patched tab could post a year.
//
// So the client sends a BEAT with no number in it, and the account
// service credits the gap between this beat and the account's last one
// BY ITS OWN CLOCK, capped at PLAY_GRACE_S. A beat can therefore never
// credit more than the wall-clock time that really passed, however it
// is forged - and TWO TABS (or two devices) beating the one account
// each credit the gap since the OTHER's beat, so time is counted once
// rather than once per tab. `creditPlay` in server-account/src/
// accounts.js is the other half, and it is one atomic UPDATE for that
// reason.
//
// A GAP LONGER THAN THE GRACE IS A NEW SITTING and credits nothing:
// the tab was closed, the machine slept, the page sat hidden. The cost
// is the tail of each sitting - under one beat - which is the honest
// price of never believing a client about a duration.
//
// ═══ WHY THIS FILE IS IN `src/` ════════════════════════════════════
//
// Both ends read these numbers, and imports run one way in this repo
// (src/net/handleShape.js says why). The account Worker bundles this
// file, and account-deploy.yml's path filter is held to the Worker's
// real import graph by test/accountdeploy.test.js.
// ═══════════════════════════════════════════════════════════════════

/** How often a tab in the world knocks. Five minutes: the grace has to
 *  be wider than this, and D1 pays a write per knock per player. */
export const PLAY_BEAT_S = 300;

/** The widest gap one beat may credit. TWICE the beat, so one late or
 *  dropped knock (a throttled timer, a network blip) does not cost the
 *  sitting, and two do. Derived, so moving the beat moves it too. */
export const PLAY_GRACE_S = 2 * PLAY_BEAT_S;

/**
 * Knock once now, then every PLAY_BEAT_S while the page is visible.
 * A hidden page does not knock, so its gap outgrows the grace and the
 * service opens a new sitting when it comes back - a tab left in the
 * background overnight is not eight hours played.
 *
 * Every clock and every side effect is an argument, so node drives it.
 * Returns `stop`.
 *
 * @param {{ beat: () => unknown, visible?: () => boolean,
 *   setInterval?: (fn: () => void, ms: number) => unknown,
 *   clearInterval?: (id: unknown) => void }} io
 */
export function startPlayClock({ beat, visible = () => true, setInterval = globalThis.setInterval, clearInterval = globalThis.clearInterval }) {
  // A BEAT THAT THROWS OR REJECTS IS DROPPED. It is a counter, and a
  // counter must never be the thing that breaks the world it counts.
  const knock = () => {
    if (!visible()) return;
    try { Promise.resolve(beat()).catch(() => {}); } catch { /* next beat */ }
  };
  knock();
  const id = setInterval(knock, PLAY_BEAT_S * 1000);
  return () => clearInterval(id);
}
