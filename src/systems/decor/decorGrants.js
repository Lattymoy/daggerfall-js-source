// @ts-check
// DECOR-ACCESS: the room's answer for who may use a chest or a station, and a shared chest's own window.
// The window changes the pack only after the service has moved the good.

import { t } from '../textManager.js';

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
const PEEK_MS = 8000;

/** The last list a glance or an open chest already has. A refusal is remembered as nothing, so the plaque stays a name. */
export function noteDecorBin(id, items) {
  if (typeof id !== 'string' || !id) return;
  peeked.set(id, { at: Date.now(), items: Array.isArray(items) ? items : null });
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

/** A chest whose goods the service holds. The window moves them locally. Closing sends the whole difference once. */
export async function openSharedChest(id) {
  const d = door;
  if (!d?.use || typeof d.open !== 'function') { d?.say?.(t('decor.grants.shut', 'The chest stays shut.')); return false; }
  const at = { mapId: d.mapId, buildingKey: d.buildingKey, character: d.character?.() ?? d.character, id };
  const listed = await d.use({ ...at, op: 'list', hold: true });
  if (!listed?.ok) { chestShut(d, listed?.error); return false; }
  const goods = [...(listed.data?.items ?? [])];
  noteDecorBin(id, goods);
  const draft = [...(d.items?.() ?? [])];   // the window's pack; the character's own list waits for the close
  const put = new Set();
  const take = new Set();
  const takenOf = new Map();
  const note = (dir, item) => {
    const uid = item.uid;
    if (dir === 'put') {
      if (take.has(uid)) { take.delete(uid); takenOf.delete(uid); }
      else put.add(uid);
    } else if (put.has(uid)) put.delete(uid);
    else { take.add(uid); takenOf.set(uid, item); }
  };
  const commit = (dir, item, amount, go) => {
    const stack = item?.stackCount ?? 1;
    if (amount != null && amount !== stack) { d.say?.(t('decor.grants.whole', 'The chest takes the whole stack.')); return false; }
    if (!item?.uid) { d.say?.(dir === 'put' ? t('decor.grants.badItem', 'That cannot be stored.') : t('decor.grants.stays', 'It stays in the chest.')); return false; }
    if (typeof go !== 'function') return false;
    go();
    note(dir, item);
    return true;
  };
  let sent = false;
  const closed = () => {
    if (sent) return;
    sent = true;
    const putting = [...put];
    const taking = [...take];
    if (!putting.length && !taking.length) { noteDecorBin(id, goods); d.use({ ...at, op: 'release' }).catch(() => {}); return; }
    const act = d.realm?.();
    if (typeof act !== 'function') { d.use({ ...at, op: 'release' }).catch(() => {}); chestShut(d, null); return; }
    act({
      needsAnswer: true,
      apply: () => {
        for (const uid of putting) d.take(uid);
        for (const uid of taking) {
          const it = takenOf.get(uid);
          const have = d.items?.() ?? [];
          if (it && !have.some((x) => x?.uid === uid)) d.give(it);
        }
      },
      call: (realm) => d.use({ ...at, op: 'settle', put: putting, take: taking, realm }),
    }).then((res) => { if (!res?.ok) { peeked.delete(id); chestShut(d, res?.error); } else noteDecorBin(id, goods); }, () => { peeked.delete(id); chestShut(d, null); });
  };
  const vaultPour = listed.data?.master ? async () => {
    const res = await d.use({ ...at, op: 'vault' });
    if (!res?.ok) { chestShut(d, res?.error); return null; }
    const items = res.data?.items ?? [];
    if (!items.length) { d.say?.(t('decor.grants.vaultEmpty', 'The vault is empty.')); return []; }
    for (const it of items) if (!goods.some((g) => g?.uid === it.uid)) goods.push(it);
    return items;
  } : null;
  d.open({
    loot: { items: () => goods, storage: true, title: 'Chest', commit, closed, ...(vaultPour ? { vaultPour } : {}) },
    items: () => draft,
    onDrop: (items) => { for (const it of items ?? []) draft.push(it); d.say?.(t('decor.grants.noDrop', 'Shut the chest before you drop that.')); return null; },
  });
  return true;
}
