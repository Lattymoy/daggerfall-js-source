// @ts-check
// ONE-SEAT (2026-09-27, Mac: "Can we also make it where the player can only have one character only at a time. Like
// they shouldnt be able to open multiple tabs and join as different characters").
//
// ONE TAB ONLINE, TWO WAYS OF KNOWING WHICH. The relay's hub decides it for an ACCOUNT (net/wire.js ONE-SEAT: a hub
// hello that claims closes the account's other tabs; server/src/index.js), and that covers a player on two devices, or
// two tabs signed in as one player. It cannot cover two tabs of ONE BROWSER signed in as two players - the stored
// session is the browser's, so a player who signs out in the second tab and continues as a guest is a second account
// to the relay. The browser can tell: every tab of this page's origin hears a BroadcastChannel, so a tab going online
// says so on it, and any other tab of this browser that is online gives its seat up - the same way it gives it up to
// the hub, through the session's own `supersede()`.
//
// THE NEWEST WINS, on both arms, because the tab a player just opened is the one they are looking at - and a tab the
// seat was taken from waits for its player, never for a clock: "Play online here" (world.js) claims again, and the
// other tab gives the seat up in turn. A browser without BroadcastChannel (or a node test that hands none in) has the
// hub's arm alone, which is the one that matters for an account.
//
// Pure of the DOM: the channel class is handed in.

/** The channel every tab of this origin shares. */
export const SEAT_CHANNEL = 'dagger.online.seat';
/** The line said in the chat when this tab gives the seat up. */
export const SEAT_NOTICE = 'You went online in another tab, window or device, so this one is offline now. Press "Play online here" to play in this one instead.';
/** The same, short, over the screen (ui/midScreenText.js) - what a player coming back to the tab reads first. */
export const SEAT_MID_TEXT = 'Online in another tab or device - this one is offline.';
/** The button under the chat while this tab is out: it takes the seat back. */
export const PLAY_HERE_LABEL = 'Play online here';

const mintNonce = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * The browser's arm of the seat: `claim()` when this tab goes online (and again on "Play online here"); `onLost` is
 * called once when another tab of this browser claims while this one holds the seat.
 *
 * AUDIT ONESEAT C4: EVERY CLAIM IS STAMPED, and the NEWER one holds. Two tabs that claimed before either heard the
 * other both gave the seat up - no tab online, both telling the player "you went online in another tab". A claim's
 * stamp is after every claim this tab has heard (one tab's clock, since the tabs share the browser's); a holder that
 * hears an OLDER claim says its own again rather than giving way, and a tie goes by the page's nonce.
 *
 * @param {{ Channel?: any, name?: string, nonce?: string, onLost?: () => void, now?: () => number }} [o]
 */
export function createSeatLock({ Channel = globalThis.BroadcastChannel, name = SEAT_CHANNEL, nonce = mintNonce(), onLost = () => {}, now = () => Date.now() } = {}) {
  /** @type {any} */
  let ch = null;
  try { ch = typeof Channel === 'function' ? new Channel(name) : null; } catch { ch = null; }
  let held = false, at = 0, seen = 0;   // this tab's claim's stamp, and the newest stamp heard on the channel
  const say = () => { try { ch?.postMessage({ t: 'seat', n: nonce, at }); } catch { /* a closed channel says nothing */ } };
  if (ch) {
    ch.onmessage = (/** @type {any} */ ev) => {
      const m = ev?.data;
      // a PAGE's word, not a peer id's: a duplicated tab carries its original's id (sessionStorage is copied with it)
      if (!m || m.t !== 'seat' || m.n === nonce || !Number.isFinite(m.at)) return;
      if (m.at > seen) seen = m.at;
      if (!held) return;
      if (m.at < at || (m.at === at && String(m.n) < nonce)) { say(); return; }   // the older claim gives way - the other tab's
      held = false;
      try { onLost(); } catch { /* the host's own */ }
    };
  }
  return {
    /** This tab goes online: the seat is this tab's, and every other tab of the browser is told. */
    claim() {
      held = true;
      at = seen = Math.max(now(), seen + 1);   // after every claim this tab has heard, whatever the clock says
      say();
    },
    /** This tab is out (the hub took the seat, or it left): it holds nothing, so another tab's claim tells it nothing. */
    release() { held = false; },
    /** Whether this tab holds the seat as far as this browser knows. */
    get held() { return held; },
    close() {
      held = false;
      try { ch?.close?.(); } catch { /* already closed */ }
      ch = null;
    },
  };
}
