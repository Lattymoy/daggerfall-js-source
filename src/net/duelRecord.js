// @ts-check
// DUEL1 (2026-09-24, Mac: "Add a dueling K/D to the profile menu and player inspect profile"; asked where it lives:
// per account, on the main menu's account card): THE DUELLING RECORD, AS WORDS AND AS ASKS. Pure - the account service
// is handed in - so the pins drive it without a network.
//
// WHOSE WORD IT IS. The account service's (server-account/src/accounts.js reportDuelLoss): a duel that named a loser is
// reported by the LOSER's own signed-in client naming the winner's account as the relay verified it, so nobody's record
// is their own word. The main menu's card reads the player's own off `/v1/account`; the Inspect card reads another
// player's by the account the relay stamped on the card they answered with - never by anything the card claims.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A (ONLINE).

/** The K/D a record shows: wins over losses, and a record with no losses reads its wins (as a kill count over no deaths
 *  does). Two decimals. */
export function duelKd(wins, losses) {
  const w = Number.isFinite(wins) && wins > 0 ? Math.trunc(wins) : 0;
  const l = Number.isFinite(losses) && losses > 0 ? Math.trunc(losses) : 0;
  return l ? w / l : w;
}

/** A record as the cards say it - "3 won, 1 lost (K/D 3.00)" - or "No duels yet" for none; null for no record at all
 *  (not asked, or not known). */
export function duelRecordText(rec) {
  if (!rec || typeof rec !== 'object') return null;
  const w = Number.isSafeInteger(rec.wins) && rec.wins > 0 ? rec.wins : 0;
  const l = Number.isSafeInteger(rec.losses) && rec.losses > 0 ? rec.losses : 0;
  if (!w && !l) return 'No duels yet';
  return `${w} won, ${l} lost (K/D ${duelKd(w, l).toFixed(2)})`;
}

/** AUDIT DUEL1: the line a loss the account service did not count says, by the service's `why`
 *  (server-account/src/accounts.js reportDuelLoss) - null for nothing to add: a draw was said by the duel itself. */
export function duelUncountedText(why) {
  switch (why) {
    case 'draw': return null;
    case 'guest': return 'This duel did not count toward your record: only duels between registered accounts count.';
    case 'gap': return 'This duel did not count toward your record (too soon after your last).';
    case 'pair': return 'This duel did not count toward your record: you have fought them enough times today.';
    case 'winner': return 'This duel did not count toward your record: they have won enough duels today.';
    default: return 'This duel did not count toward your record.';
  }
}

/** How long a record read for the Inspect card is kept before it is asked again, ms - a card opened twice in a minute
 *  asks once, and a result the player just saw lands in the next (DUEL_RECORD_TTL_MS is the most it can be behind). */
export const DUEL_RECORD_TTL_MS = 60_000;

/**
 * The Inspect card's reads, kept: `read(id)` is the account service's `/v1/duel/record` (accountClient.js accountDuels
 * `record`), answering `{ ok, data: { wins, losses } }`. `get(id)` answers what is known now - a record, 'asking' while a
 * read is out, or null (nothing known, or the service could not say) - and starts a read when the kept one is stale;
 * `onRecord(id, rec)` is told when one lands. `forget(id)` drops one (the player's own, after a duel of theirs).
 * @param {{ read: (id: string) => Promise<any>, now?: () => number, onRecord?: (id: string, rec: any) => void, ttlMs?: number }} o
 */
export function createDuelRecords({ read, now = () => Date.now(), onRecord = () => {}, ttlMs = DUEL_RECORD_TTL_MS }) {
  /** @type {Map<string, { rec: any, at: number, asking: boolean }>} */
  const kept = new Map();
  const fetchOne = (id) => {
    const e = kept.get(id) ?? { rec: null, at: -Infinity, asking: false };
    e.asking = true;
    kept.set(id, e);
    Promise.resolve().then(() => read(id)).then((r) => {
      const d = r?.ok ? r.data : null;
      const rec = d && Number.isSafeInteger(d.wins) && Number.isSafeInteger(d.losses) ? { wins: d.wins, losses: d.losses } : null;
      e.rec = rec; e.at = now(); e.asking = false;
      onRecord(id, rec);
    }, () => { e.at = now(); e.asking = false; onRecord(id, e.rec); });
  };
  return {
    get(id) {
      if (typeof id !== 'string' || !id) return null;
      const e = kept.get(id);
      if (!e || (!e.asking && now() - e.at >= ttlMs)) fetchOne(id);
      const cur = kept.get(id);
      return cur?.rec ?? (cur?.asking ? 'asking' : null);
    },
    forget(id) { kept.delete(id); },
  };
}
