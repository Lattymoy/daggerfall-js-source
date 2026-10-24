// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA-SEASON (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected"; bible/03-World/
// Eltheric-Ocean.md SEA-SEASON) - THE SEA'S SEASON BOARDS, the page's half: the harbourmaster's tab's section of the
// season's captains (ui/naval/navalYardWindow.js seasonText) over the service's boards (server-account/src/seaSeason.js,
// net/accountClient.js accountSeaSeason). Built by the sea's host (scenes/seaVenturesHost.js) - HOST-SPLIT: the world
// wires it there. The figures themselves go with the record: the captain's ledger keeps them (systems/naval/
// captainLedger.js `ether.season`) and each clean checkpoint carries them.
//
// THE BOARDS are read when the tab is shown and again SEA_SEASON_FRESH_MS on, once at a time, and the tab painted when
// they come (navalPlunderDoor.js repaintNavalYard). Online with a realm character alone: offline, or a character the
// service does not keep, no section.
//
// deps = {
//   live() -> bool          online, at a relay that raises the open sea
//   session                 the realm session (world.js realmSession - null: no realm character)
//   character() -> id       the realm character
//   door?                   the service's door (accountSeaSeason) - its own, when none is given
//   now?() -> ms            the clock (the relay's, online)
// }
// ═══════════════════════════════════════════════════════════════════
import { accountSeaSeason, accountRefusalText } from '../net/accountClient.js';
import { appStorage } from '../systems/appStorage.js';
import { readSeaSeasonBoard } from '../net/sea/seaSeasonLaw.js';
import { repaintNavalYard } from '../ui/naval/navalPlunderDoor.js';

/** The boards are read again when they are this old and the tab is shown (ms). */
export const SEA_SEASON_FRESH_MS = 60_000;
/** AUDIT SEA VENTURES E1: refused boards are asked again this long on, doubling to SEA_SEASON_FRESH_MS (ms) - as the
 *  bounty board's (seaBountyHost.js SEA_BOARD_READ_RETRY_MS). */
export const SEA_SEASON_RETRY_MS = 5_000;

/** @param {any} deps */
export function createSeaSeason(deps) {
  const now = () => Number(deps.now?.()) || Date.now();
  let door = deps.door ?? null;
  const doorNow = () => (door ??= accountSeaSeason({ fetch: (u, i) => globalThis.fetch(u, i), storage: appStorage() }));
  let board = null, nextAt = -Infinity, fails = 0, reading = false, line = null;
  const on = () => !!deps.live?.() && !!deps.session;
  const repaint = () => { try { repaintNavalYard(); } catch { /* no window: nothing to paint */ } };
  /** The boards read from the service (once at a time) - painted when they come. */
  async function read() {
    if (reading || !on()) return;
    reading = true;
    try {
      const r = await doorNow().board({ character: deps.character?.() }).catch(() => null);
      const b = r?.ok ? readSeaSeasonBoard(r.data) : null;
      if (b) { board = b; line = null; fails = 0; nextAt = now() + SEA_SEASON_FRESH_MS; }
      else { line = { text: accountRefusalText(r?.error), warn: true }; nextAt = now() + Math.min(SEA_SEASON_FRESH_MS, SEA_SEASON_RETRY_MS * 2 ** fails++); }
    } finally { reading = false; repaint(); }
  }
  /**
   * THE TAB'S SEASON SECTION (ui/naval/navalYardWindow.js seasonText): null offline or with no realm character; else the
   * boards as last read - `{ asking, season, daysLeft, deep, legends, mine, last, line }` - read again when they are
   * SEA_SEASON_FRESH_MS old.
   */
  function office() {
    if (!on()) return null;
    if (!reading && now() >= nextAt) void read();
    // AUDIT SEA VENTURES E7: boards never read are still being asked for - never an empty season's lists
    if (!board) return { asking: true, season: 0, daysLeft: 0, deep: [], legends: [], mine: { deep: null, legends: null }, last: { deep: [], legends: [] }, line };
    return { asking: false, ...board, daysLeft: Math.max(0, Math.ceil((board.ends * 1000 - now()) / 86_400_000)), line };
  }
  return { office, read };
}
