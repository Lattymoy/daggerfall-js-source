// @ts-check
// STAR7 (2026-10-20): A HELD STAR'S REWARDS ON THIS DEVICE - the receipts carried to the account service, the spoils given
// when it says this claim is theirs, and the Renown it pays adopted by the character that held the star. The sea serpent's
// three (scenes/world.js serpentClaims, serpentSpoils, grantSerpentSpoils), made by the Starfall's host (scenes/starfall/
// starfallHost.js) on the world's bindings by name, so the world host keeps none of it (HOST-SPLIT). Design:
// bible/11-Multiplayer/Starfall.md section 6.
//
//   the receipts    net/starfall/starClaims.js - kept on the device with the character that held the star, offered to
//                   `/v1/star/claim` until counted; a counted one notes the questline's act for that character alone
//                   (`who` - owed it until it stands, AUDIT STARFALL 7)
//   the spoils      scenes/spoilsPool.js under the star's own keys (systems/starfall/starSpoils.js STAR_SPOILS_KEYS) - no floor,
//                   no word to the hub; into the pack through the world's one door (`takeSpoil`), one tab at a time
//                   (spoilsLock); the crash's records cleared by the save that holds them (onSlotSaved, the realm's
//                   `landed`), and handed back at a character's stand-up (`recover`)
//   the Renown      the one plan every Renown answer takes (net/renownTracker.js renownAnswer): the bar, the level, the order
//                   carried to the rooms, the rise said once - for the character that held the star, no other
//   the silver      the strike's cards and lines (ui/haulCards.js claimHauls, net/marksBook.js claimLines), as a raid's
//
// THE WORLD'S BINDINGS IT READS (the host's adapter): `takeSpoil`, `relayNowS`, `marksBook`, `renownXpAdopt`,
// `renownAdopt`, `renownRose`, `renownSaid`, `online`, `chatNotice` - and, for the tests, `starAccount` (the account
// service's door, `{ claim, me }`) and `rewardsStorage` (the device's store).
//
// Not a DFU member. Ledger A (STARFALL).
import { createStarClaims } from '../../net/starfall/starClaims.js';
import { readStarReceipt } from '../../net/starfall/starReceipt.js';
import { accountStars } from '../../net/accountClient.js';
import { renownAnswer } from '../../net/renownTracker.js';
import { appStorage } from '../../systems/appStorage.js';
import { characterIdOf } from '../../systems/characterId.js';
import { onSlotSaved, onSlotLoaded, enumerateSaves } from '../../systems/save/saveSlots.js';
import { starSpoilsList, starSpoilsDay, STAR_SPOILS_KEYS, STAR_SPOILS_TEXT, STAR_SPOILS_RECORDS_MAX } from '../../systems/starfall/starSpoils.js';
import { playerEntity } from '../../characters/playerEntity.js';
import { setMidScreenText } from '../../ui/midScreenText.js';
import { showHaul } from '../../ui/pickupFeed.js';
import { claimHauls } from '../../ui/haulCards.js';
import { createSpoilsPool, spoilsStore, recoverSpoils, spoilsLevel, spoilsLock } from '../spoilsPool.js';

/**
 * THE REWARDS: `{ receipt(r), tick(), recover(who, inSave), held(who), saved(who, ids), claims, spoils }`.
 * @param {any} host the Starfall host's bindings by name
 */
export function createStarRewards(host) {
  const storage = host.rewardsStorage !== undefined ? host.rewardsStorage : appStorage();
  const store = spoilsStore(storage);
  const account = host.starAccount ?? accountStars({ fetch: (u, i) => globalThis.fetch(u, i), storage });
  const who = () => characterIdOf(playerEntity);
  /** THE SPOILS POOL, the star's own keys - the serpent's hoard's shape: no floor, no word to the hub. */
  const spoils = createSpoilsPool({
    ray: () => null, now: () => Date.now() + (host._sharedOffsetMs ?? 0), take: (p) => host.takeSpoil?.(p), say: (text) => setMidScreenText(text),
    store, who, keys: STAR_SPOILS_KEYS, recordsMax: STAR_SPOILS_RECORDS_MAX,
  });
  onSlotSaved((characterId) => { try { spoils.saved(characterId); } catch (e) { console.warn('[star] spoils', e?.message ?? e); } });
  // AUDIT ONLINE2 F3's law: a load in the session is a stand-up - the pool lets go of what it held in the old pack
  onSlotLoaded((characterId) => { try { spoils.loaded(characterId); } catch (e) { console.warn('[star] spoils', e?.message ?? e); } });
  /** A receipt's spoils into the pack, once (the pool's spent mark), at the level the hold admitted and never past the
   *  standing character's own (AUDIT SERPENT D2's law). Its promise is the carrier's: a grant that fails leaves the receipt
   *  unsettled, asked again. */
  function grant(entry) {
    const c = readStarReceipt(entry?.r);
    if (!c) return undefined;
    const level = spoilsLevel(entry.ch === who() ? playerEntity.level ?? 1 : Number(entry.lv) || c.l || 1, c.l);
    return spoilsLock(() => spoils.grant({
      day: starSpoilsDay(c.night, c.star), acct: c.s, roll: () => starSpoilsList(c.c, level, c.night, c.star), text: STAR_SPOILS_TEXT.granted(),
      owner: entry.ch, kept: STAR_SPOILS_TEXT.kept(entry.nm),
    }));
  }
  /** THE RENOWN, the character that held the star's alone (RENOWN-CHAR). */
  function adopt(data) {
    if (data?.renown?.character !== who()) return;
    const a = renownAnswer({ ...data.renown, order: data.order ?? null }, data.renown.credited ?? 0, host.renownSaid ?? null);
    if (a.xp !== null) host.renownXpAdopt?.(a.xp);
    if (a.level !== null) host.renownAdopt?.(a.level);
    if (a.order) host.online?.sendRenownOrder?.(a.order, a.level);
    if (a.announce !== null) host.renownRose?.(a.announce);
  }
  const claims = createStarClaims({
    claim: account.claim, me: account.me, who,   // AUDIT STARFALL 7: a star's act belongs to the character that held it, noted while it stands
    nowS: () => host.relayNowS?.() ?? null,
    store,
    say: (text) => host.chatNotice?.(text),
    onSpoils: (entry) => grant(entry),
    onMarks: (data) => { showHaul(claimHauls(data, 'star')); return host.marksBook?.claimLines?.(data, 'star') ?? null; },
    onRecorded: (data) => adopt(data),
  });
  return {
    /** A receipt the relay handed this socket (the cell at the master's fall, the hub at a hello): kept with the character
     *  standing here and offered. */
    receipt: (r) => claims.add(r, who(), typeof playerEntity?.name === 'string' ? playerEntity.name : null, playerEntity.level ?? 1),
    /** A frame: what is kept, offered again in its time. */
    tick: () => claims.tick(),
    /** A character's stand-up (the crash's door): its spoils no save holds handed back, said once. `inSave` the realm
     *  boot's records its pack already holds (systems/realmSaves.js openRealmBoot `held`). */
    recover(characterId, inSave = null) {
      try {
        if (recoverSpoils(store, (p) => host.takeSpoil?.(p), { who: characterId, saves: enumerateSaves().info.values(), onHanded: (rec) => spoils.adopt(rec), key: STAR_SPOILS_KEYS.store, inSave })) setMidScreenText(STAR_SPOILS_TEXT.recovered());
      } catch (e) { console.warn('[star] spoils', e?.message ?? e); }
    },
    /** The realm save's hooks: the records whose pieces are in the pack, and those a landed checkpoint holds. */
    held: (characterId) => { try { return spoils.heldIds?.(characterId) ?? []; } catch { return []; } },
    saved(characterId, ids) { try { spoils.saved(characterId, ids); } catch (e) { console.warn('[star] spoils', e?.message ?? e); } },
    claims,
    spoils,
  };
}
