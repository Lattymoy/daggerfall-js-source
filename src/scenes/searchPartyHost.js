// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
//
// GRAVE-PARTY (FIELD BUGS 2026-10-16b, bible/01-Overview/bugs/Field-Bugs-2026-10-16b.md; the Discord's "graveyard loot on
// headstones are able to be looted by others"; Mac's SEARCH1-PARTY: "When one player in the party interacted with it no
// one else can again for 5 hours"): THE STREAMING HOST'S HALF OF A SEARCH'S PARTY. A Graveyard location's headstone
// (SEARCH1, the activateGrave moved here) was searched in its searcher's game alone - its five hours on this save's
// ledger, its find a pile at this player's feet - so every partymate searched the same stone again. Now:
//   - THE PARTY LENS (systems/searchables.js setSearchParty), registered here once: my account, my party's seats and
//     their names, the account behind a peer - the hub's picture (net/social.js), read live. The dungeon's searchables
//     read it too (scenes/searchRoom.js), so a stranger's search locks nothing of mine there either.
//   - THE STONE SAID TO THE CELL: a search owes `[px, py, n]` to my cell's overworld ledger (net/overworldLaw.js
//     owFoldGraves - the relay stamps its minute and my verified account), said a second apart at most until the cell
//     takes it; and the cell's rows HEARD - every one kept in a small book, and the ones my party's (or mine, on another
//     tab or an earlier visit) landed on the ledger's five hours with the searcher's name. The book is read again at the
//     stone, so a partymate who searched before I joined the party still locks it for me.
//   - "Already searched by <name>." (systems/searchables.js searchedText) for a stone a partymate searched.
// NOT SHARED, above ground: the FIND - the searcher's pile stays theirs (the cell keeps no container); a partymate is
// told who searched it. Recorded in bible/06-Systems/Searchables.md, SEARCH1-PARTY.
import { ActionTextBox } from '../ui/actionText.js';
import { droppedLootHooks } from './droppedLoot.js';
import { dungeonFamily, dungeonRarityTier } from '../systems/loot/lootRarity.js';
import { effectiveLevel } from '../systems/mentorMode.js';
import { enemyDisplayName } from '../characters/enemy/enemyBasics.js';
import { liveStat } from '../systems/statMods.js';
import { markSearched, mintSearchFind, pickSearchUndead, rollSearchElite, rollSearchOutcome, SEARCH_FOE_SPACING, SEARCH_FOES_PER_PLAYER, searchCooldownLeft, searchKey, searchMessage, searchedText, setSearchParty, searchKinOf, searchToldBy, SEARCH_COOLDOWN_MINUTES } from '../systems/searchables.js';
import { playerEntity } from '../characters/playerEntity.js';
import { randomEpitaph } from '../systems/gravestoneLore.js';
import { setMidScreenText } from '../ui/midScreenText.js';
import { silverFindAt } from '../systems/silverFinds.js';
import { worldMinutes, sharedClockOn } from '../systems/worldTick.js';
import { isCellRoom } from '../net/wire.js';

/** GRAVE-PARTY: how often what is owed to the cell is said (the session's own bucket is OW_HZ_MAX a second). */
export const GRAVE_SAY_MS = 1000;
/** ...a stone owed longer than this is let go (its hours are half run; my own ledger keeps it). */
export const GRAVE_OWED_KEEP_MS = 10 * 60 * 1000;
/** ...and never more owed, or kept heard, than these - the oldest out first. GRAVE_OWED_MAX is the cell's own bound on one
 *  searcher's rows (net/wire.js OW_GRAVE_ACCT_ROWS_MAX - pinned equal; AUDIT GRAVE-PARTY G3). */
export const GRAVE_OWED_MAX = 32;
export const GRAVE_BOOK_MAX = 256;
/** A stone's place - `g<px>,<py>`, world.js graveTargets' `loc` - read back to its map pixel. */
const GRAVE_LOC_RE = /^g(\d{1,3}),(\d{1,3})$/;

/** @param {any} host */
export function createSearchParty(host) {
  const {
    dropFeet, droppedLoot, exteriorFoes, makeInventoryWindow, player, playerTravelPixel, townTalk
  } = host;
  // THE PARTY LENS - the hub's picture, read at each question (it changes under the session)
  setSearchParty({
    self: () => host.social?.acct ?? null,
    selfName: () => host.online?.name || host.social?.name || null,   // AUDIT GRAVE-PARTY G5: my character's name, the issued one the relay stamps
    inParty: (acct) => !!host.social?.inMyParty?.(acct),
    nameOf: (acct) => host.social?.party?.members?.find((m) => m.acct === acct)?.name ?? null,
    acctOfPeer: (id) => host.social?.accountOfPeer?.(id) ?? null,
  });
  const owed = new Map();   // `${px},${py}|${n}` -> { row: [px, py, n], since } - my searches the cell has not taken
  const book = new Map();   // `${px},${py}|${n}|${acct}` -> [px, py, n, minute, acct] - the cell's rows, as heard
  let saidAt = -Infinity;
  /** A stone's wire row `[px, py, n]`, or null (a stone no graveyard pixel built). */
  function rowOf(g) {
    const m = GRAVE_LOC_RE.exec(typeof g?.loc === 'string' ? g.loc : '');
    const n = Number(g?.key);
    return m && Number.isInteger(n) && n >= 0 ? [Number(m[1]), Number(m[2]), n] : null;
  }
  /** A cell's row on my ledger, when its searcher is mine or my party's - from the relay's minute (the shared clock's),
   *  never ahead of now - answering whether it landed. A stranger's row locks nothing of mine. Told by the searcher's
   *  name - a partymate's, or (AUDIT GRAVE-PARTY G5) another character of my account's, the row's own (searchToldBy). */
  function land(g) {
    if (!searchKinOf(g[4])) return false;
    const now = worldMinutes();
    markSearched(searchKey(`g${g[0]},${g[1]}`, String(g[2])), sharedClockOn() ? Math.min(g[3], now) : now, searchToldBy(g[4], g[5]));
    return true;
  }
  /** THE CELL'S WORD (`ow` `gr`, net/online.js onOverworld) - its welcome's rows or a change: each kept, and landed. */
  function heard(msg) {
    if (msg?.k !== 'gr' || !Array.isArray(msg.rows)) return;
    const now = worldMinutes();
    for (const [k, g] of [...book]) if (sharedClockOn() && now - g[3] >= SEARCH_COOLDOWN_MINUTES) book.delete(k);
    for (const g of msg.rows) {
      const k = `${g[0]},${g[1]}|${g[2]}|${g[4]}`;
      book.delete(k); book.set(k, g);
      land(g);
    }
    while (book.size > GRAVE_BOOK_MAX) book.delete(book.keys().next().value);
  }
  /** At the stone: the cell's rows about it read against my party AS IT STANDS NOW - a partymate who searched it before
   *  the party was made, or before the hub's picture came, locks it for me too. */
  function adopt(row) {
    if (!row) return;
    const head = `${row[0]},${row[1]}|${row[2]}|`;
    for (const [k, g] of book) if (k.startsWith(head)) land(g);
  }
  /** My search, owed to my cell until it takes it. */
  function owe(row) {
    if (!row) return;
    const k = `${row[0]},${row[1]}|${row[2]}`;
    owed.delete(k); owed.set(k, { row, since: performance.now() });
    while (owed.size > GRAVE_OWED_MAX) owed.delete(owed.keys().next().value);
  }
  /** THE FRAME: what is owed, said a second apart at most - down my primary cell's socket, at a relay that keeps the
   *  graves (net/online.js sendOverworld 'gr'); what it took no longer owed. Underground (a dungeon's room) it waits. */
  function frame(now) {
    const online = host.online;
    if (!owed.size || !online?.owGraveOk || now - saidAt < GRAVE_SAY_MS) return;
    saidAt = now;
    for (const [k, o] of [...owed]) if (now - o.since > GRAVE_OWED_KEEP_MS) owed.delete(k);
    if (!owed.size || !isCellRoom(online.room)) return;
    for (const r of online.sendOverworld('gr', [...owed.values()].map((o) => o.row))) owed.delete(`${r[0]},${r[1]}|${r[2]}`);
  }
  function activateGrave(g, mode = 'grab') {
    if (!g) return false;
    if (mode === 'info') { townTalk.say(randomEpitaph()); return true; }
    const key = searchKey(g.loc, g.key);
    const now = worldMinutes();
    const row = rowOf(g);
    adopt(row);   // GRAVE-PARTY: the cell's word about this stone, read against my party now
    if (searchCooldownLeft(key, now) > 0) { setMidScreenText(searchedText(key)); return true; }   // GRAVE-PARTY: and by whom, a partymate's
    markSearched(key, now);
    owe(row);   // GRAVE-PARTY: the cell hears it - my party's games lock the stone
    const outcome = rollSearchOutcome({ graveyard: true });
    const level = effectiveLevel(playerEntity);
    let rows, onClose = null;
    if (outcome === 'foe') {
      const type = pickSearchUndead(level);
      const elite = rollSearchElite();
      const count = SEARCH_FOES_PER_PLAYER * (1 + host.partyNear().length);   // SEARCH1-PARTY: two for every player of the party here
      rows = searchMessage('tombstone', 'foe', { foeName: enemyDisplayName(type) ?? 'creature', elite, count });
      onClose = () => {
        // a ring about the stone, opening toward the player (a graveyard is open ground - no room to run out of)
        const feet = player.pos;
        const c = [(g.min[0] + g.max[0]) / 2, Math.min(g.min[1], feet[1]), (g.min[2] + g.max[2]) / 2];
        const half = Math.max(g.max[0] - g.min[0], g.max[2] - g.min[2]) / 2;
        const toward = Math.atan2(feet[0] - c[0], feet[2] - c[2]);
        for (let n = 0; n < count; n++) {
          const a = toward + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * (Math.PI / 5);
          const r = half + 0.7 + Math.floor(n / 10) * SEARCH_FOE_SPACING;
          const at = [c[0] + Math.sin(a) * r, c[1] + 0.05, c[2] + Math.cos(a) * r];
          exteriorFoes.spawnFoe(type, at, { yaw: Math.atan2(-(feet[0] - at[0]), -(feet[2] - at[2])), feetGiven: true, loose: true, eliteFoe: elite && n === 0 })
            .catch((e) => console.warn('[search] a grave\'s foe would not stand', e));
        }
      };
    } else if (outcome === 'loot') {
      const items = mintSearchFind('tombstone', { level, gender: playerEntity.gender, tier: dungeonRarityTier(18), family: dungeonFamily(18), luck: liveStat(playerEntity, 'luck') });   // a Cemetery's tier and family (DFRegion.DungeonTypes 18)
      rows = searchMessage('tombstone', 'loot');
      onClose = () => {
        const pile = droppedLoot.dropPile(items, dropFeet(), `${playerTravelPixel().x},${playerTravelPixel().y}`);
        if (!pile) return;
        silverFindAt('search', items);   // SILVER-FINDS: this search's find rolls its silver once (the stone searched again after its hours, again)
        const w = makeInventoryWindow({ onClose: () => droppedLoot.releaseEmptied(), loot: droppedLootHooks(pile) });
        if (w) townTalk.showOverlay(w);   // a refused pack is null - the find stays on the ground
      };
    } else rows = searchMessage('tombstone', 'nothing');
    townTalk.showOverlay(new ActionTextBox(rows, { onClose }));
    return true;
  }
  return { activateGrave, frame, heard };
}
