// @ts-check
// SCALE2c (2026-10-10, Mac: "lets now tackle the bigger work ... really future proof our archetecture while also
// increasing performance"; bible/11-Multiplayer/Scale-Arc.md SCALE2c): A RELAY DEPLOY'S RECONNECT, SPREAD BY THE ROOM'S
// OWN COUNT. A relay deploy closes every socket of every player at once, and each page's first retry was uniform over
// [1 s, 2 s] - so every player online asked the account service for a token inside the same second or two. #755's own
// deploy measured what that does at about 500 online: the one D1 primary overloaded 23 s in (SCALE4e). A page that sees
// such a wave now waits one offset, drawn once for the wave and shared by every socket the page holds (so they still
// share one token, TOKEN_REUSE_MS), uniform over a window as long as the hub takes to admit everyone online at its own
// gate (CHAT_HELLO_HZ_MAX): the hub could not welcome them faster anyway, and the mints arrive at that rate, not at once.
//
// WHAT IS A WAVE: two or more of this page's open sockets dropped within WAVE_WINDOW_MS of each other while the browser
// says it is online. A relay deploy closes them all in the same instant; one room's object restarting closes one; a
// lost network takes the browser offline first. A page that knows no count (no hub link yet) spreads nothing.
import { CHAT_HELLO_HZ_MAX } from './wire.js';

/** The mints a second a wave is spread to: the hub's own hello gate, so the spread costs no player a welcome. */
export const WAVE_MINTS_PER_S = CHAT_HELLO_HZ_MAX;
/** The longest spread: under the minter's TOKEN_REUSE_MS (60 s), so a page's sockets still share one token. */
export const WAVE_SPREAD_MAX_MS = 40_000;
/** How close together two drops must be to read as one wave. */
export const WAVE_WINDOW_MS = 2_000;
/** How many drops make a wave. */
export const WAVE_DROPS = 2;

/** The window a wave is spread over, for `online` players: as long as the hub takes to admit them, at most the cap. */
export function waveSpreadMs(online) {
  const n = Number(online);
  if (!Number.isFinite(n) || n <= 1) return 0;
  return Math.min(WAVE_SPREAD_MAX_MS, Math.round((n / WAVE_MINTS_PER_S) * 1000));
}

/** One page's view of the waves: the hub's count noted, each unexpected drop of an open socket noted, and asked at a
 *  socket's first retry how much later than planned it should be. Every time is the asking session's own clock (the
 *  page's sessions share one, online.js steadyNow). `online()` is the browser's word (navigator.onLine). */
export function reconnectWave({ rand = Math.random, online = () => globalThis.navigator?.onLine !== false } = {}) {
  let count = 0;
  const drops = [];   // when each recent drop happened (pruned past the window of the newest)
  let wave = null;    // { at, offset } - the wave in hand: its first drop, and this page's one offset for it
  return {
    /** The hub's count of everyone online (the hub link's welcome, joins and leaves). */
    noteOnline(n) { if (Number.isSafeInteger(n) && n >= 0) count = n; },
    get online() { return count; },
    /** An open socket of this page closed at `t`, not by us and not refused: a drop. Answers `t`, its retry's key. */
    dropped(t) {
      if (!online()) return t;   // the browser lost its network - a blip, not the relay's wave
      while (drops.length && t - drops[0] > WAVE_WINDOW_MS) drops.shift();
      drops.push(t);
      if (drops.length >= WAVE_DROPS && !(wave && t - wave.at <= WAVE_WINDOW_MS)) wave = { at: drops[0], offset: rand() * waveSpreadMs(count) };
      return t;
    },
    /** A socket that dropped at `droppedAt` is about to retry at `t`: the time it should retry instead, or null to go
     *  now. Only a drop inside the wave is held, and only until the wave's own offset. */
    holdUntil(droppedAt, t) {
      if (!wave || droppedAt == null || Math.abs(droppedAt - wave.at) > WAVE_WINDOW_MS) return null;
      const at = wave.at + wave.offset;
      return at > t ? at : null;
    },
  };
}

/** The page's one: the world host hands it to every session it makes (the presence session and each chat link), as
 *  they share the page's token minter. A session made without one weighs only its own sockets, and knows no count. */
export const pageWave = reconnectWave();
