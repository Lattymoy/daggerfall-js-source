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

/** Asked when the room's list stands. The service says which of these pieces this player may use. */
export function noteDecorGrants(homeDecor, mapId, buildingKey, character) {
  storage = new Set();
  station = new Set();
  bin = new Set();
  shared = new Set();
  known = false;
  if (!homeDecor?.use) return;
  Promise.resolve(homeDecor.use({ mapId, buildingKey, character, op: 'grants' })).then((res) => {
    if (!res?.ok) return;
    storage = new Set(res.data.storage ?? []);
    station = new Set(res.data.station ?? []);
    bin = new Set(res.data.bin ?? []);
    const use = new Set((res.data.use ?? []).map((row) => row?.id));
    shared = new Set([...(res.data.storage ?? []).filter((id) => use.has(id)), ...(res.data.bin ?? [])]);
    known = true;
    for (const id of bin) decorBinPreview(id);
  }, () => {});
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

/** What the shared chest's window needs. `items` is the pack array. `realm` is the record's act, or null. */
export function bindDecorHouse(next) { door = next; }

const peeked = new Map();
const peeking = new Set();
const PEEK_MS = 2000;

/** The last list a glance or an open chest already has. A refusal is remembered as nothing, so the plaque stays a name. */
export function noteDecorBin(id, items, master = false) {
  if (typeof id !== 'string' || !id) return;
  peeked.set(id, { at: Date.now(), items: Array.isArray(items) ? items : null, master: !!master });
}

/** A hall chest's goods, from the service's list. Null until that answer stands, and again when this player may not open it. */
export function decorBinPreview(id) {
  if (typeof id !== 'string' || !id || typeof door?.use !== 'function') return null;
  const hit = peeked.get(id);
  if (!hit || Date.now() - hit.at >= PEEK_MS) {
    if (!peeking.has(id)) {
      peeking.add(id);
      const at = { mapId: door.mapId, buildingKey: door.buildingKey, character: door.character?.() ?? door.character, id, op: 'list' };
      Promise.resolve(door.use(at)).then((res) => {
        peeking.delete(id);
        noteDecorBin(id, res?.ok ? (res.data?.items ?? []) : null);
      }, () => { peeking.delete(id); noteDecorBin(id, null); });
    }
  }
  return Array.isArray(hit?.items) ? hit.items : null;
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
  const waited = settling.get(id);
  if (waited) await waited.catch(() => {});
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
  const commit = async (dir, item, amount, go) => {
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
  let sent = false;
  const closed = () => {
    if (sent) return;
    sent = true;
    const job = (async () => {
      if (pending) await idle;
      const putting = [...put];
      const taking = [...take];
      const cutting = cuts.map(({ uid, leave }) => ({ uid, leave }));
      if (!putting.length && !taking.length && !cutting.length) { noteDecorBin(id, goods); await d.use({ ...at, op: 'release' }).catch(() => {}); return; }
      const act = d.realm?.();
      if (typeof act !== 'function') { await d.use({ ...at, op: 'release' }).catch(() => {}); chestShut(d, null); return; }
      const res = await act({
        needsAnswer: true,
        apply: () => {
          for (const uid of putting) d.take(uid);
          const have = d.items?.() ?? [];
          for (const uid of taking) {
            const it = takenOf.get(uid);
            if (it && !coins(it) && !have.some((x) => x?.uid === uid)) d.give(it);
          }
          for (const cut of cuts) if (cut.give && !coins(cut.give) && !have.some((x) => x?.uid === cut.give.uid)) d.give(cut.give);
        },
        call: (realm) => d.use({ ...at, op: 'settle', put: putting, take: taking, ...(cutting.length ? { cut: cutting } : {}), realm }),
      }).catch(() => null);
      if (!res?.ok) { peeked.delete(id); chestShut(d, res?.error); }
      else noteDecorBin(id, goods, master);
    })();
    settling.set(id, job.finally(() => { if (settling.get(id) === job) settling.delete(id); }));
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
  const loot = { items: () => goods, storage: true, title: 'Chest', commit, closed, ...(master ? { vaultPour } : {}) };
  ready.then((listed) => { if (listed?.data?.master) loot.vaultPour = vaultPour; }, () => {});
  d.open({
    loot,
    items: () => draft,
    onDrop: (items) => { for (const it of items ?? []) draft.push(it); d.say?.(t('decor.grants.noDrop', 'Shut the chest before you drop that.')); return null; },
  });
  return true;
}
