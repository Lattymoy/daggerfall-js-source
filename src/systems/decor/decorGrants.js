// @ts-check
// DECOR-ACCESS: the room's answer for who may use a chest or a station, and a shared chest's own window.
// The window changes the pack only after the service has moved the good.

import { t } from '../textManager.js';
import { ITEM_UID_RE } from '../item/itemLaw.js';
import { mintItemId } from '../item/itemIds.js';
import { absorbStack } from '../inventory.js';

let storage = new Set();
let station = new Set();
let bin = new Set();
let shared = new Set();
let known = false;
let door = null;
// HOME-SHARE-WAIT: the room the grants are asked for (an answer for an earlier room is not this room's), whether that
// ask is out, and how to ask it again after a refusal or no answer
let asked = 0;
let asking = false;
let again = null;

/** Asked when the room's list stands. The service says which of these pieces this player may use. */
export function noteDecorGrants(homeDecor, mapId, buildingKey, character) {
  storage = new Set();
  station = new Set();
  bin = new Set();
  shared = new Set();
  known = false;
  const ask = ++asked;
  again = () => noteDecorGrants(homeDecor, mapId, buildingKey, character);
  if (!homeDecor?.use) { asking = false; known = true; return; }   // no service to say a chest is shared: none is
  asking = true;
  Promise.resolve(homeDecor.use({ mapId, buildingKey, character, op: 'grants' })).then((res) => {
    if (ask !== asked) return;
    asking = false;
    if (!res?.ok) return;
    storage = new Set(res.data.storage ?? []);
    station = new Set(res.data.station ?? []);
    bin = new Set(res.data.bin ?? []);
    const use = new Set((res.data.use ?? []).map((row) => row?.id));
    shared = new Set([...(res.data.storage ?? []).filter((id) => use.has(id)), ...(res.data.bin ?? [])]);
    known = true;
  }, () => { if (ask === asked) asking = false; });
}

export const decorMayStorage = (id) => storage.has(id);
export const decorMayStation = (id) => station.has(id);
/** A hall station the service has named as shut to this player. Until the list arrives, a member still may. */
export const decorStationShut = (id) => known && !station.has(id);
/** The owner's shared chest opens the service's bin, not the save's window. */
export const decorIsShared = (id) => shared.has(id);
export function noteDecorShared(id, on) {
  if (typeof id !== 'string') return;
  if (on) shared.add(id);
  else shared.delete(id);
}

/**
 * HOME-SHARE-WAIT: THE OWNER'S OWN CHEST, PRESSED. A shared chest's goods are in the service's bin, and its list in the
 * save is empty. So in an online home (`online`), until the service has said which chests are shared, neither window
 * opens: the save's window would show a shared chest empty, and what went into it there was hidden behind the bin.
 * The chest stays shut, and the answer is asked again if it is not already out. Elsewhere the save's window opens.
 * @param {string} id @param {boolean} online @param {() => void} openSave
 */
export function openOwnChest(id, online, openSave) {
  if (online && !known) {
    door?.say?.(t('decor.grants.shut', 'The chest stays shut.'));
    if (!asking) again?.();
    return false;
  }
  if (online && shared.has(id)) {
    void openSharedChest(id);
    return true;
  }
  openSave();
  return true;
}

/** What the shared chest's window needs. `items` is the pack array. `realm` is the record's act, or null. */
export function bindDecorHouse(next) { door = next; }

const peeked = new Map();

/** The last list an open chest already has. A refusal is remembered as nothing. */
export function noteDecorBin(id, items, master = false) {
  if (typeof id !== 'string' || !id) return;
  peeked.set(id, { at: Date.now(), items: Array.isArray(items) ? items : null, master: !!master });
}

/** The host's door, in one call: the service, the pack, and where the record stands. */
export function bindDecorHouseFrom(host, player, say, refusal, mapId, buildingKey, open = null) {
  bindDecorHouse({
    doc: typeof document !== 'undefined' ? document : null,
    use: (body) => host.homeDecor?.use?.(body),
    realm: () => host.realmAct ?? null,
    mapId, buildingKey,
    character: () => host.decorCharacter?.() ?? null,
    items: () => player?.items ?? [],
    take(uid) { const list = player?.items ?? []; const i = list.findIndex((it) => it?.uid === uid); if (i >= 0) list.splice(i, 1); },
    give(it) { if (player) (player.items ??= []).push(it); },
    say, refusal, open,
  });
}

/** The room's storage window, built outside the host so the host only hands the list across. */
export const openDecorChest = (make, spec) => make?.(spec?.loot ? spec : { loot: spec }) ?? null;

const chestShut = (d, error) => d.say?.(error === 'decor-busy' ? (d.refusal?.('decor-busy') ?? t('decor.grants.busy', 'Someone else is using this chest.')) : (d.refusal?.(error) ?? t('decor.grants.shut', 'The chest stays shut.')));

/** One settle at a time for a chest. A second open waits, so a take still in flight cannot be granted again. */
const settling = new Map();
const stampUid = (item) => { if (!ITEM_UID_RE.test(item?.uid)) item.uid = mintItemId(); return item; };
/** Gold is a purse count (inventory.js isGoldPieces). A chest take already paid the purse, so the close must not also hand the pile back as an item. */
const coins = (it) => it?.group === 'Currency' && it?.templateIndex === 276;

/** A chest whose goods the service holds. The window moves them locally. Closing sends the whole difference once. */
export async function openSharedChest(id) {
  const d = door;
  if (!d?.use || typeof d.open !== 'function') { d?.say?.(t('decor.grants.shut', 'The chest stays shut.')); return false; }
  const waited = [...settling.values()];
  if (waited.length) await Promise.all(waited.map((job) => Promise.resolve(job).catch(() => {})));
  const at = { mapId: d.mapId, buildingKey: d.buildingKey, character: d.character?.() ?? d.character, id };
  const cached = peeked.get(id);
  const goods = [...(Array.isArray(cached?.items) ? cached.items : [])];
  Object.defineProperty(goods, 'unstacked', { value: true });
  let touched = false;
  const ready = Promise.resolve(d.use({ ...at, op: 'list', hold: true })).then((listed) => {
    if (listed?.ok && !touched) {
      // The window already drew the peeked rows. A fresh parse is new objects, and the first
      // click's transfer refuses a row the list no longer holds (itemTransfer.js).
      const byUid = new Map();
      for (const it of goods) if (it?.uid) byUid.set(it.uid, it);
      const used = new Set();
      const merged = [];
      for (let i = 0; i < (listed.data?.items ?? []).length; i++) {
        const it = listed.data.items[i];
        let prev = it?.uid ? byUid.get(it.uid) : null;
        const atRow = goods[i];
        if (!prev && atRow && !used.has(atRow) && !atRow.uid && !it?.uid && atRow.templateIndex === it.templateIndex) prev = atRow;
        if (prev) {
          if (Number.isInteger(it?.stackCount) && prev.stackCount !== it.stackCount) prev.stackCount = it.stackCount;
          used.add(prev); merged.push(prev);
        }
        else merged.push(it);
      }
      goods.splice(0, goods.length, ...merged);
      noteDecorBin(id, goods, !!listed.data?.master);
    }
    return listed;
  }, () => null);
  let master = !!cached?.master;
  if (!Array.isArray(cached?.items)) {
    const listed = await ready;
    if (!listed?.ok) { chestShut(d, listed?.error); return false; }
    master = !!listed.data?.master;
  }
  const draft = [...(d.items?.() ?? [])];   // the window's pack; the character's own list waits for the close
  Object.defineProperty(draft, 'unstacked', { value: true });   // a take must not add its count onto a stack the pack still holds
  const put = new Set();
  const take = new Set();
  const takenOf = new Map();
  const cuts = [];
  const note = (dir, item) => {
    const uid = item.uid;
    if (dir === 'put') {
      if (take.has(uid)) { take.delete(uid); takenOf.delete(uid); }
      else put.add(uid);
    } else if (put.has(uid)) {
      put.delete(uid);
      // The put had parked the pile on the pack so the save could carry it. Taking it back spends that park.
      if (coins(item)) { const real = d.items?.() ?? []; const atPile = real.indexOf(item); if (atPile >= 0) real.splice(atPile, 1); }
    } else { take.add(uid); takenOf.set(uid, item); }
  };
  let pending = 0;
  let idle = Promise.resolve();
  let wake = null;
  const cutOf = (item, landed) => {
    const leave = item.stackCount ?? 1;
    const at = cuts.findIndex((c) => c.uid === item.uid);
    if (at < 0) { cuts.push({ uid: item.uid, leave, give: landed }); return; }
    const prior = cuts[at];
    if (landed && prior.give && landed !== prior.give) {
      absorbStack(prior.give, landed);
      const from = draft.indexOf(landed);
      if (from >= 0) draft.splice(from, 1);
    } else if (landed && !prior.give) prior.give = landed;
    prior.leave = leave;
  };
  const takeWhole = (item) => {
    const at = cuts.findIndex((c) => c.uid === item.uid);
    if (at >= 0) {
      const prior = cuts.splice(at, 1)[0];
      if (prior.give && prior.give !== item) {
        absorbStack(item, prior.give);
        const from = draft.indexOf(prior.give);
        if (from >= 0) draft.splice(from, 1);
      }
    }
    note('take', item);
  };
  let sent = false;
  let job = null;
  let loot = null;
  const commit = async (dir, item, amount, go) => {
    if (sent) return false;
    pending += 1;
    if (!wake) idle = new Promise((resolve) => { wake = resolve; });
    try {
    const listed = await ready;
    if (!listed?.ok) { chestShut(d, listed?.error); return false; }
    const stack = item?.stackCount ?? 1;
    const n = amount == null ? stack : amount;
    if (!Number.isInteger(n) || n < 1 || n > stack || typeof go !== 'function') { d.say?.(t('decor.grants.whole', 'The chest takes the whole stack.')); return false; }
    if (!item || typeof item !== 'object') { d.say?.(dir === 'put' ? t('decor.grants.badItem', 'That cannot be stored.') : t('decor.grants.stays', 'It stays in the chest.')); return false; }
    touched = true;
    const before = item?.stackCount ?? 1;
    const moved = go();
    // A gold click pays the purse and answers nothing (itemTransfer.js). The chest row still has to leave.
    if ((!moved || moved === item) && dir === 'take' && coins(item) && ITEM_UID_RE.test(item?.uid)) {
      if (!goods.includes(item)) { takeWhole(item); return true; }
      const leave = item.stackCount ?? 1;
      if (leave < before && leave >= 1) { cutOf(item, null); return true; }
      if (!moved) return false;
    }
    if (!moved) return false;
    const real = d.items?.() ?? [];
    const landed = moved === item && dir === 'put' && goods.at(-1) && goods.at(-1) !== item && !real.includes(goods.at(-1)) ? goods.at(-1) : (moved === item && dir === 'take' && draft.at(-1) && draft.at(-1) !== item && (item.stackCount ?? 1) < before ? draft.at(-1) : moved);
    stampUid(landed);
    if (dir === 'put') {
      // One copy stays in the pack until the close. The window spliced its own list, which is not this one.
      for (let i = real.length - 1; i >= 0; i--) if (real[i] === landed || (landed?.uid && real[i]?.uid === landed.uid && real[i] !== item)) real.splice(i, 1);
      if (!real.includes(landed)) real.push(landed);
      note('put', landed);
    } else if (landed !== item && ITEM_UID_RE.test(item?.uid)) cutOf(item, landed);
    else takeWhole(landed);
    return true;
    } finally {
      pending -= 1;
      if (pending === 0 && wake) { const done = wake; wake = null; done(); }
    }
  };
  const closed = () => {
    if (job) return job;
    sent = true;
    if (loot) loot.busy = t('decor.grants.saving', 'Saving the chest...');
    job = (async () => {
      if (pending) await idle;
      const putting = [...put];
      const taking = [...take];
      const cutting = cuts.map(({ uid, leave }) => ({ uid, leave }));
      if (!putting.length && !taking.length && !cutting.length) { noteDecorBin(id, goods); await d.use({ ...at, op: 'release' }).catch(() => {}); return; }
      const act = d.realm?.();
      if (typeof act !== 'function') { await d.use({ ...at, op: 'release' }).catch(() => {}); chestShut(d, null); return; }
      // The moves are already this window's. A lost answer whose record moved one step is this close, and the pack takes it.
      const res = await act({
        apply: () => {
          for (const uid of putting) d.take(uid);
          const have = d.items?.() ?? [];
          for (const uid of taking) {
            const it = takenOf.get(uid);
            if (it && !coins(it) && !have.includes(it) && !have.some((x) => x?.uid === uid)) d.give(it);
          }
          for (const cut of cuts) if (cut.give && !coins(cut.give) && !have.includes(cut.give) && !have.some((x) => x?.uid === cut.give.uid)) d.give(cut.give);
        },
        call: (realm) => d.use({ ...at, op: 'settle', put: putting, take: taking, ...(cutting.length ? { cut: cutting } : {}), realm }),
      }).catch(() => null);
      if (!res?.ok) { peeked.delete(id); chestShut(d, res?.error); }
      else noteDecorBin(id, goods, master);
    })();
    settling.set(id, job.finally(() => { if (settling.get(id) === job) settling.delete(id); }));
    return job;
  };
  const vaultPour = async () => {
    const res = await d.use({ ...at, op: 'vault' });
    if (!res?.ok) { chestShut(d, res?.error); return null; }
    const items = res.data?.items ?? [];
    if (!items.length) { d.say?.(t('decor.grants.vaultEmpty', 'The vault is empty.')); return []; }
    for (const it of items) if (!goods.some((g) => g?.uid === it.uid)) goods.push(it);
    touched = true;
    return items;
  };
  loot = { items: () => goods, storage: true, title: 'Chest', busy: null, commit, closed, finish: () => closed(), ...(master ? { vaultPour } : {}) };
  ready.then((listed) => { if (listed?.data?.master) loot.vaultPour = vaultPour; }, () => {});
  d.open({
    loot,
    items: () => draft,
    onDrop: (items) => { for (const it of items ?? []) draft.push(it); d.say?.(t('decor.grants.noDrop', 'Shut the chest before you drop that.')); return null; },
  });
  return true;
}
