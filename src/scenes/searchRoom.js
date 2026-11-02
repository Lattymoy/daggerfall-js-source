// @ts-check
// GRAVE-PARTY (FIELD BUGS 2026-10-16b, bible/01-Overview/bugs/Field-Bugs-2026-10-16b.md; the Discord's "objects in tombs are un
// lootable"; Mac's SEARCH1-PARTY: "When one player in the party interacted with it no one else can again for 5 hours ...
// visible for everyone in the party the same the looter sees"): A DUNGEON'S SEARCHED OBJECT IS ITS SEARCHER'S PARTY'S.
//
// SEARCH1-PARTY said every search to the WHOLE ROOM as its container (`srch:<i>`, WORLD4's word - scenes/dungeonContext.js
// publishLoot), whatever it rolled, and every client that heard it started its five hours and took the find as its own -
// a stranger who happened to stand in the same crypt too. In a Graveyard's Cemetery (dungeonType 18) every coffin and
// sarcophagus a stranger had touched answered "You have already searched here." for five game hours, to a player who had
// never seen it. Now the word names its SEARCHER (`by`, the account - net/social.js's, the token's subject), and a
// client lands it - its five hours, its find - only when the searcher is itself (another tab, an earlier visit) or of its
// party (systems/searchables.js searchKinOf, the streaming host's party lens). A stranger's word is KEPT, unlanded, and
// carried on in the room's memory when this client is the one that publishes it, so the stranger's own partymates who
// come in later still hear it; and it is read again at the object, so a search made before the party was formed - or
// before the hub's picture came - locks it for the party then. A word with no `by` (an older build's) is its speaker's
// (the peer id's account, a partymate's tab - net/social.js accountOfPeer); one with neither, a stranger's.
//
// THE ONE HOME for whose a `srch:` word is: the dungeon host constructs it once and asks it at applyLoot, at the search,
// at its memory's composition and at its records.
//
// AUDIT GRAVE-PARTY (2026-10-16): G4 - a stranger's word kept is stamped NEVER AHEAD OF NOW (the WORLD7/8 C2 law
// applyLoot keeps for a landed word): its forged far-future `t` was kept as said, so it was never let go at the room's
// hour and its 24 slots rode the room's memory for good. G5 - the word names its searching CHARACTER too (`bn`, the
// session's issued name): the five hours are the account's, and another character of it is told whose search it was
// (systems/searchables.js searchToldBy), no longer "You have already searched here." of an object it never touched.
import { searchKinOf, searchAcctOfPeer, searchSelfAcct, searchSelfName, searchToldBy, SEARCH_ACCT_MAX, SEARCH_LOOT_MAX } from '../systems/searchables.js';
import { validLootList } from '../systems/loot/loot.js';
import { isRoomWord, validRoomWord } from '../systems/roomLoot.js';
import { peerHanded } from '../systems/peerWord.js';
import { NAME_MAX, sanitizeName } from '../net/wire.js';   // AUDIT GRAVE-PARTY G5: a searching character's name is a name the wire would carry

/** The most strangers' words one client keeps (each about one object, by one searcher), the oldest out first - and the
 *  most about any one object. They ride the room's memory this client publishes (WORLD_FRAME_MAX, 512 KB a dungeon), so
 *  they are bounded hard: */
export const SEARCH_FOREIGN_MAX = 24;
export const SEARCH_FOREIGN_PER_OBJECT = 4;
/** ...and one is kept only as an honest find can be: SEARCH_LOOT_MAX pieces at most, each through the wire's own
 *  projection, its record under this many bytes - a word past either is no search's, and is kept by nobody. */
export const SEARCH_FOREIGN_BYTES = 4096;

/** @param {{ respawnDue: (t: unknown, now: number|null) => boolean, wallNow: () => number|null }} host */
export function createSearchRoom(host) {
  /** `${canon}|${searcher}` -> { rec, from } - the words this client heard and did not land (a stranger's search) */
  const foreign = new Map();
  /** The searcher a word names: its own `by`, else its live speaker's account (an older build's word), else null. */
  const searcherOf = (rec, from) => (typeof rec?.by === 'string' && rec.by.length > 0 && rec.by.length <= SEARCH_ACCT_MAX ? rec.by : searchAcctOfPeer(from));
  /** The searching character's name a word carries (`bn`), or null - a name the wire would carry, else none. */
  const nameOf = (rec) => (typeof rec?.bn === 'string' && rec.bn.length > 0 && rec.bn.length <= NAME_MAX && sanitizeName(rec.bn) === rec.bn ? rec.bn : null);
  /** Whose search a room word about a searched object is to me: `{ acct, kin, who, name }` - 'me' or 'party', `who` the
   *  name it is told by (searchToldBy: a partymate's, or another character of my account's - null for this one's) and
   *  `name` the searching character's the word carried - or null: a stranger's, or nobody's I can tell. */
  function whose(rec, from = null) {
    const acct = searcherOf(rec, from);
    const kin = searchKinOf(acct);
    const name = nameOf(rec);
    return kin ? { acct, kin, who: searchToldBy(acct, name), name } : null;
  }
  /** A stranger's words past the room's hour let go (WORLD8's respawnDue on their stamp), then the oldest past the cap. */
  function prune() {
    const now = host.wallNow();
    for (const [k, e] of [...foreign]) if (host.respawnDue(e.rec.t, now)) foreign.delete(k);
    while (foreign.size > SEARCH_FOREIGN_MAX) foreign.delete(foreign.keys().next().value);
  }
  /** applyLoot's question about a `srch:` word: whose it is - `{ acct, kin, who }` when it is to be landed here, else null,
   *  and then it is KEPT unlanded (the room's memory carries it on; the object reads it again). */
  function ours(canon, rec, from = null) {
    const w = whose(rec, from);
    if (w) return w;
    const acct = searcherOf(rec, from), name = nameOf(rec);
    // OUTDOOR-LOOT slice 3: a find's word is now its BIRTH and its takes (PARTY-LOOT's, with the searcher's roll carried in `b`), not WORLD4's
    // list `r`. What is kept is the birth alone - its terms and its base - the one thing a late partymate needs to hold the find; the takes
    // (and the claims) it hears live after it lands. An older build's whole list is kept as ever, and landed as a birth or a diff.
    const room = isRoomWord(rec) ? validRoomWord(rec) : null;
    const items = room ? (room.b ? peerHanded(room.b) : null) : peerHanded(validLootList(rec?.r));
    if (!items || items.length > SEARCH_LOOT_MAX || (room && items.length !== room.b?.length)) return null;   // no search's find: kept by nobody
    const now = host.wallNow();
    const t = Number.isFinite(rec.t) ? (Number.isFinite(now) ? Math.min(rec.t, /** @type {number} */ (now)) : rec.t) : now;   // AUDIT GRAVE-PARTY G4: never AHEAD of now (WORLD7/8 C2), an unstamped word now - every one let go at the room's hour
    const kept = room
      ? { k: canon, g: room.g, lv: room.lv, ...(room.n > 1 ? { n: room.n } : {}), tm: room.tm, h: room.h, b: items, ...(Number.isFinite(t) ? { t } : {}), ...(acct ? { by: acct } : {}), ...(name ? { bn: name } : {}) }
      : { k: canon, r: items, ...(Number.isFinite(t) ? { t } : {}), ...(acct ? { by: acct } : {}), ...(name ? { bn: name } : {}) };
    if (JSON.stringify(kept).length > SEARCH_FOREIGN_BYTES) return null;
    const k = `${canon}|${acct ?? (typeof from === 'string' ? `peer:${from}` : '?')}`;
    const had = foreign.get(k)?.rec;
    if (room && had && /** @type {any} */ (had).h === /** @type {any} */ (kept).h && /** @type {any} */ (had).g === /** @type {any} */ (kept).g) return null;   // the same birth again (a claim word, a verdict): the first stands, with the stamp of the search itself
    foreign.delete(k);
    foreign.set(k, { rec: kept, from });
    const about = [...foreign.keys()].filter((x) => x.startsWith(`${canon}|`));
    for (const x of about.slice(0, Math.max(0, about.length - SEARCH_FOREIGN_PER_OBJECT))) foreign.delete(x);
    prune();
    return null;
  }
  /** At the object: the words kept about `srch:<i>`, read again against my party as it stands now - each that is mine or
   *  my party's now is let go and handed to `land` (applyLoot's own door). */
  function adopt(i, land) {
    const head = `srch:${i}|`;
    for (const [k, e] of [...foreign]) {
      if (!k.startsWith(head) || !whose(e.rec, e.from)) continue;
      foreign.delete(k);
      land(e.rec, e.from);
    }
  }
  /** The searcher a search of MINE names, as the searchable keeps it: `by` my account and `bn` my character's name (AUDIT
   *  GRAVE-PARTY G5) - each null where the lens has none. */
  const mine = () => ({ by: searchSelfAcct(), bn: searchSelfName() });
  /** The fields a `srch:` record carries for the searchable holding it: its searcher's account and character's name. */
  const fields = (sb) => ({ ...(typeof sb?.by === 'string' && sb.by ? { by: sb.by } : {}), ...(nameOf(sb) && sb.by ? { bn: sb.bn } : {}) });
  /** The strangers' words, for the room's memory this client publishes (every one still inside the room's hour) - but a find this
   *  client holds a state for (`judged(canon)`: its own party's) rides the memory as that state, one find an object. */
  function records(/** @type {(canon: string) => boolean} */ judged = () => false) { prune(); return [...foreign.values()].filter((e) => !judged(e.rec.k)).map((e) => ({ ...e.rec })); }
  return { whose, ours, adopt, mine, fields, records };
}
