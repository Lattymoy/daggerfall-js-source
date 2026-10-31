// @ts-check
// DRAGON4 (bible/11-Multiplayer/Dwarven-Dragon.md section 8): A SLAIN DRAGON'S REWARDS ON THIS DEVICE - the receipts carried to
// the account service (net/dragon/dragonClaims.js), the hoard given when it says this claim is theirs (scenes/spoilsPool.js
// under the dragon's own keys, systems/dragon/dragonSpoils.js), and a tame the service drew kept on the device until it is
// bound (DRAGON_TAMES_KEY). The Starfall's rewards' shape (scenes/starfall/starRewards.js), made by the dragon's host
// (scenes/dragonHost.js) on the world's bindings - `takeSpoil`, `relayNowS`, `chatNotice` - so the world host keeps none
// of it (HOST-SPLIT); `dragonAccount` and `rewardsStorage` for the tests. Not a DFU member. Ledger A (DRAGON).
import { createDragonClaims } from '../net/dragon/dragonClaims.js';
import { readDragonReceipt } from '../net/dragon/dragonReceipt.js';
import { accountDragons } from '../net/accountClient.js';
import { appStorage } from '../systems/appStorage.js';
import { characterIdOf } from '../systems/characterId.js';
import { onSlotSaved, onSlotLoaded, enumerateSaves } from '../systems/save/saveSlots.js';
import { dragonSpoilsList, dragonSpoilsDay, DRAGON_SPOILS_KEYS, DRAGON_SPOILS_TEXT, DRAGON_SPOILS_RECORDS_MAX } from '../systems/dragon/dragonSpoils.js';
import { playerEntity } from '../characters/playerEntity.js';
import { setMidScreenText } from '../ui/midScreenText.js';
import { newDragonMount, isDragonMount, hasDragon, DRAGON_MOUNT_ONLINE } from '../systems/dragon/dragonMount.js';   // DRAGON5: the tame bound
import { DRAGON_CLAIM_TEXT } from '../systems/dragon/dragonWords.js';
import { createSpoilsPool, spoilsStore, recoverSpoils, spoilsLevel, spoilsLock } from './spoilsPool.js';

/** The tames the service drew for this device's accounts, not yet bound: `[{ id, look, character, w }]`. */
export const DRAGON_TAMES_KEY = 'dragon4.tamed';
export const DRAGON_TAMES_MAX = 8;
const TAME_ID_RE = /^dg[0-9a-f]{16}$/;

/**
 * THE REWARDS: `{ receipt(r), tick(), recover(who, inSave), held(who), saved(who, ids), tames(), boundTame(id), bind(who), recall(who), claims, spoils }`.
 * @param {any} host the dragon host's bindings by name
 */
export function createDragonRewards(host) {
  const storage = host.rewardsStorage !== undefined ? host.rewardsStorage : appStorage();
  const store = spoilsStore(storage);
  const account = host.dragonAccount ?? accountDragons({ fetch: (u, i) => globalThis.fetch(u, i), storage });
  const who = () => characterIdOf(playerEntity);
  const spoils = createSpoilsPool({
    ray: () => null, now: () => Date.now() + (host._sharedOffsetMs ?? 0), take: (p) => host.takeSpoil?.(p), say: (text) => setMidScreenText(text),
    store, who, keys: DRAGON_SPOILS_KEYS, recordsMax: DRAGON_SPOILS_RECORDS_MAX,
  });
  onSlotSaved((characterId) => { try { spoils.saved(characterId); } catch (e) { console.warn('[dragon] spoils', e?.message ?? e); } });
  onSlotLoaded((characterId) => { try { spoils.loaded(characterId); } catch (e) { console.warn('[dragon] spoils', e?.message ?? e); } });
  /** A receipt's hoard into the pack, once (the pool's spent mark), never past the level the fight admitted nor the
   *  standing character's own (AUDIT SERPENT D2's law). Its promise is the carrier's. */
  function grant(entry) {
    const c = readDragonReceipt(entry?.r);
    if (!c) return undefined;
    const level = spoilsLevel(entry.ch === who() ? playerEntity.level ?? 1 : Number(entry.lv) || c.l || 1, c.l);
    return spoilsLock(() => spoils.grant({
      day: dragonSpoilsDay(c.q, c.p), acct: c.s, roll: () => dragonSpoilsList(c.c, level, c.x), text: DRAGON_SPOILS_TEXT.granted(c.b),
      owner: entry.ch, kept: DRAGON_SPOILS_TEXT.kept(entry.nm),
    }));
  }
  const readTames = () => { let v; try { v = store.get(DRAGON_TAMES_KEY); } catch { v = null; } return Array.isArray(v) ? v.filter((x) => x && TAME_ID_RE.test(x.id)) : []; };
  const writeTames = (list) => { try { store.set(DRAGON_TAMES_KEY, list.slice(-DRAGON_TAMES_MAX)); } catch { /* the service tells it again at the next claim */ } };
  /** A tame the service drew: kept until it is bound, once by its id. */
  function tamed(t, entry) {
    if (!t || !TAME_ID_RE.test(t.id) || readTames().some((x) => x.id === t.id)) return;
    const c = readDragonReceipt(entry?.r);
    writeTames([...readTames(), { id: t.id, look: t.look === 1 ? 1 : 0, character: typeof t.character === 'string' ? t.character : entry?.ch ?? null, w: c?.q ?? null }]);
    host.onTamed?.(t);
    bind(who());
  }
  /** DRAGON5: THE TAME BOUND - the standing character's tame into its pack as its dragon (one a character), and let go
   *  once the pack holds it. Waits while DRAGON_MOUNT_ONLINE is off (REST6's law); `dragonMountOnline` for the tests. */
  function bind(characterId) {
    if (!(host.dragonMountOnline ?? DRAGON_MOUNT_ONLINE) || !characterId || characterId !== who()) return false;
    const items = playerEntity.items ?? [];
    let bound = false;
    for (const t of readTames().filter((x) => !x.character || x.character === characterId)) {
      if (!hasDragon(items)) { host.takeSpoil?.({ kind: 'item', item: newDragonMount(t) }); bound = true; }
      if (items.some((it) => isDragonMount(it))) writeTames(readTames().filter((x) => x.id !== t.id));
    }
    if (bound) host.chatNotice?.(DRAGON_CLAIM_TEXT.bound());
    return bound;
  }
  /** AUDIT DRAGON: THE SERVICE IS THE RECORD - its tames for a character joined to the device's copy, so a tame drawn while
   *  the mount waited is never lost with a device's storage. Asked only while the mount is on. */
  async function recall(characterId) {
    if (!(host.dragonMountOnline ?? DRAGON_MOUNT_ONLINE) || !characterId || !account.tames) return;
    const r = await account.tames().catch(() => null);
    const list = r?.ok && Array.isArray(r.data?.tames) ? r.data.tames : [];
    const have = new Set(readTames().map((x) => x.id));
    const add = list.filter((m) => m && TAME_ID_RE.test(m.id) && m.character === characterId && !have.has(m.id))
      .map((m) => ({ id: m.id, look: m.look === 1 ? 1 : 0, character: m.character, w: Number.isSafeInteger(m.watch) ? m.watch : null }));
    if (add.length) writeTames([...readTames(), ...add]);
  }
  const claims = createDragonClaims({
    claim: account.claim, me: account.me, nowS: () => host.relayNowS?.() ?? null, store,
    say: (text) => host.chatNotice?.(text), onSpoils: (entry) => grant(entry), onTamed: (t, entry) => tamed(t, entry),
  });
  return {
    /** A receipt the relay handed this socket: kept with the character standing here and offered. */
    receipt: (r) => claims.add(r, who(), typeof playerEntity?.name === 'string' ? playerEntity.name : null, playerEntity.level ?? 1),
    /** A frame: what is kept, offered again in its time. */
    tick: () => claims.tick(),
    /** A character's stand-up (the crash's door): its hoard no save holds handed back, said once. */
    recover(characterId, inSave = null) {
      try {
        if (recoverSpoils(store, (p) => host.takeSpoil?.(p), { who: characterId, saves: enumerateSaves().info.values(), onHanded: (rec) => spoils.adopt(rec), key: DRAGON_SPOILS_KEYS.store, inSave })) setMidScreenText(DRAGON_SPOILS_TEXT.recovered());
      } catch (e) { console.warn('[dragon] spoils', e?.message ?? e); }
      recall(characterId).then(() => bind(characterId)).catch((e) => console.warn('[dragon] bind', e?.message ?? e));   // DRAGON5: a tame drawn while another stood; AUDIT DRAGON: or kept only by the service
    },
    /** The realm save's hooks: the records whose pieces are in the pack, and those a landed checkpoint holds. */
    held: (characterId) => { try { return spoils.heldIds?.(characterId) ?? []; } catch { return []; } },
    saved(characterId, ids) { try { spoils.saved(characterId, ids); } catch (e) { console.warn('[dragon] spoils', e?.message ?? e); } },
    /** The tames not yet bound, and one bound (let go). */
    tames: () => readTames(),
    boundTame(id) { writeTames(readTames().filter((x) => x.id !== id)); },
    bind,
    recall,
    claims,
    spoils,
  };
}
