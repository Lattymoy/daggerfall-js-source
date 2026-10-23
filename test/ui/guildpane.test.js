// GUILD-PANE slice 1 (2026-10-23, Travis: "we should be able to view items in the guild storage similar to the wagon,
// guild stores should be shared in a similar manner to a players own stores so people can easily add and remove items they
// want to share with the guild"; "plan out steps 1 and 2 for now, and also allowing a guild-entry caravan the ability to
// open the guild vault"; decided, "View-only pane" below ground): THE VAULT PANE, READ-ONLY.
//
// A Guild Vault button on the enhanced pack, beside Wagon and Materials Bag, opens the guild's vault as a pane like the
// wagon's - icons, wear, weight, stack counts, the filter, item cards - and moves nothing yet. This file mounts the REAL
// pane (`mountEnhancedInventory`, under the repo's fake DOM, test/invdrag.mjs) over a REAL `GuildBook` whose door is the
// REAL account Worker on its real migrations (test/accountDb.mjs standService): the vault's rows are the service's own.
// The host door (scenes/guildVaultHost.js) and the session law (systems/inventorySession.js) are the code under test,
// never a stand-in for it.
import '../modsOff.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from '../accountDb.mjs';
import { seatRealm, realmActOver } from '../realmSeat.mjs';
import { withDomAsync } from '../invdrag.mjs';
import { SESSION_KEY, accountGuilds } from '../../src/net/accountClient.js';
import { GuildBook } from '../../src/net/guild/guildBook.js';
import { mountEnhancedInventory, inventoryQuickAct } from '../../src/ui/enhanced/enhancedInventory.js';
import * as session from '../../src/systems/inventorySession.js';
import { setItemFields } from '../../src/systems/item/itemTemplates.js';
import { itemLine } from '../../src/ui/enhanced/enhancedInventory.js';
import { stolenLine } from '../../src/systems/stolenGoods.js';
import { newWagonItem } from '../../src/systems/wagon/wagonKinds.js';
import * as storeFilter from '../../src/ui/storeFilter.js';
import { GUILD_VAULT_SLOTS } from '../../src/net/guild/guildVaultLaw.js';
import { parseStringTableCsv } from '../../src/systems/textManager.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The host door - a module a host wires (scenes/guildVaultHost.js). Loaded by name so a tree without it fails at the
 *  assertion that names it, not at an import. */
const hostModule = await import('../../src/scenes/guildVaultHost.js').catch(() => null);
const doorOf = (book) => {
  assert.equal(typeof hostModule?.createGuildVaultDoor, 'function', 'src/scenes/guildVaultHost.js exports createGuildVaultDoor');
  return hostModule.createGuildVaultDoor({ book });
};

const realNow = Date.now;
Date.now = () => T0 * 1000;
after(() => { Date.now = realNow; });

const tick = () => new Promise((r) => setImmediate(r));
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await tick(); };

// ─── THE RIG: a service, a guild with a vault, a pack over a real book ────────────────────────────────────────────

const SWORD = { group: 'Weapons', templateIndex: 115, material: 1, name: 'Steel Longsword', value: 300, currentCondition: 800, maxCondition: 1000 };
const ARROWS = (n) => ({ group: 'Weapons', templateIndex: 131, name: 'Arrow', value: 1, stackCount: n });
const STOLEN = { ...SWORD, name: 'Steel Longsword', stolen: true, material: 3, currentCondition: 500 };
const RARE = { group: 'Weapons', templateIndex: 113, material: 4, name: 'Silver Dagger', value: 900, rarity: 'rare', currentCondition: 700, maxCondition: 700 };
const ring = () => ({ group: 'Jewellery', templateIndex: 0, name: 'Gold Ring', value: 40 });

/** A service, a guildmaster Aldric (a realm character) and a member Brenna in one guild; `items` the guildmaster's record. */
async function stand({ gmItems = [SWORD, ARROWS(40), STOLEN] } = {}) {
  const s = await standService({ MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const gm = await s.registered('Aldric', { renown: 10 });
  gm.realm = await seatRealm(s.env, gm.secret, 'Aldric', { name: 'Aldric', level: 5, goldPieces: 20_000, items: gmItems, bankAccounts: [{ accountGold: 0 }] });
  gm.character = gm.realm.id;
  raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(gm.id, gm.character, 'Aldric', 1_000_000, T0, T0);
  const found = await s.call('/v1/guilds/found', { character: gm.character, name: 'The Iron Oath', tag: 'IRON', realm: gm.realm.at(), region: 0 }, gm.secret);
  assert.equal(found.status, 200, JSON.stringify(found.body));
  const gid = found.body.guild.id;
  const member = await s.registered('Brenna');
  member.realm = await seatRealm(s.env, member.secret, 'Brenna', { name: 'Brenna', level: 3, goldPieces: 50, items: [{ ...SWORD, name: 'Brenna\'s Blade' }, ARROWS(10)], bankAccounts: [{ accountGold: 0 }] });
  member.character = member.realm.id;
  assert.equal((await s.call('/v1/guilds/invite', { character: gm.character, handle: 'Brenna' }, gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/answer', { character: member.character, guild: gid, accept: true }, member.secret)).status, 200);
  const record = (who) => {
    const row = raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character);
    return JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj)));
  };
  /** The record's piece at `pick` put into the vault (count of its stack) - through the real route. */
  const putIn = async (who, pick, count = null) => {
    const item = record(who).items[pick];
    const r = await s.call('/v1/guilds/vault/put', { character: who.character, realm: who.realm.at(), pick, item, ...(count ? { count } : {}) }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  return { ...s, raw, gm, member, gid, record, putIn };
}

/** The vault the plan names: a sword, 20 of a stack of arrows, and a stolen piece. */
async function stood(opts) {
  const s = await stand(opts);
  await s.putIn(s.gm, 0);        // the sword
  await s.putIn(s.gm, 0, 20);    // 20 of the arrows (now first)
  await s.putIn(s.gm, 1);        // the stolen piece
  return s;
}

/**
 * A pack over a real book for `who`: the entity's items (the record's, as the save holds them), the real `GuildBook` over
 * the real Worker, and the host's door. `reach` is the host's word for the vault being reached; `gate` holds the vault
 * route's answer until released.
 */
async function rig(svc, who, { reach = true, realm = true, items = null, door: withDoor = true, whenAsked = null } = {}) {
  const entity = { name: who.handle, stats: { strength: 50 }, items: (items ?? svc.record(who).items).map((i) => setItemFields(i)), goldPieces: 0, bankAccounts: [{ accountGold: 0 }] };
  const gate = { reads: 0, hold: null, fail: null };
  const fetch = async (url, init) => {
    if (String(url).endsWith('/v1/guilds/vault')) {
      gate.reads++;
      const mine = gate.reads;
      whenAsked?.(mine);
      if (gate.fail && gate.fail(mine)) return new Response(JSON.stringify({ error: 'server' }), { status: 500, headers: { 'content-type': 'application/json' } });
      const answer = await svc.fetch(url, init);
      const hold = gate.hold?.(mine);
      if (hold) await hold;
      return answer;
    }
    return svc.fetch(url, init);
  };
  const state = { reach, character: who.character };
  const pack = { items: () => entity.items, add: (rec) => entity.items.push(setItemFields({ ...rec })), changed() {}, reach: () => state.reach };
  const book = new GuildBook({
    door: accountGuilds({ fetch, storage: sessionStorageOf(SESSION_KEY, who) }), character: () => state.character,
    wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), pack, realm: realm ? realmActOver(() => who.realm.at()) : null,
  });
  await book.refresh();
  return { entity, book, gate, state, door: withDoor ? doorOf(book) : null, pack };
}

// ─── THE PANE'S HANDS ────────────────────────────────────────────────────────────────────────────────────────────

const named = (row) => row.querySelector('.itemname')?.children?.[0]?.textContent ?? '';
const actsOf = (host) => host.querySelectorAll('.act').map((b) => b.textContent);
const actBtn = (host, label) => host.querySelectorAll('.act').find((b) => b.textContent === label);
// the fake DOM reads one compound selector, not a descendant one: a node is asked for what it sits in
const inside = (host, sel, cls) => host.querySelectorAll(sel).filter((n) => n.closest(cls));
const remoteRows = (host) => inside(host, '.itemrow', '.loot-win');
const packRows = (host) => inside(host, '.itemrow', '.pack-dock');
const remoteEmpty = (host) => inside(host, '.packempty', '.loot-win')[0] ?? null;
const remoteMeta = (host) => host.querySelector('.remotewho').querySelector('.meta').textContent;
const remoteKind = () => JSON.parse(globalThis.__pack()).remoteKind;

/** Mount the pack over `r`, run `fn`, and always unmount. `deps` are more of the host's hands. */
async function pane(dom, r, fn, deps = {}) {
  const host = dom.mk('div');
  dom.body.append(host);
  const view = mountEnhancedInventory(host, {
    entity: r.entity, items: () => r.entity.items, wagonItems: () => (r.entity.wagonItems ??= []), bagItems: () => (r.entity.bagItems ??= []),
    ...(r.door ? { guildVault: () => r.door } : {}), onExit() {}, ...deps,
  });
  try { return await fn({ host, view, dom }); } finally { view.unmount(); }
}
/** Open the vault from its door and wait for the read's answer to paint. */
async function openVault(host, r) {
  const b = actBtn(host, 'Guild Vault');
  assert.ok(b, 'the Guild Vault button is drawn');
  b.onclick();
  await settle();
  return b;
}
/** The pane's poll, captured: every interval set while `fn` runs, whether it is still set, and a way to fire it. */
function capturePoll() {
  const real = { set: globalThis.setInterval, clear: globalThis.clearInterval };
  const live = new Map();
  let n = 0;
  globalThis.setInterval = (fn, ms) => { const id = ++n; live.set(id, { fn, ms }); return id; };
  globalThis.clearInterval = (id) => { live.delete(id); };
  return { live, fire: () => { for (const { fn } of [...live.values()]) fn(); }, restore: () => { globalThis.setInterval = real.set; globalThis.clearInterval = real.clear; } };
}

// ─── THE SESSION LAW (inventorySession.js) ──────────────────────────────────────────────────────────────────────

test('GUILD-PANE 1 THE SESSION: the vault is a list beside the wagon and the bag - it outranks them while it shows, its rows are the door\'s own, and it is none of ground, theft or capacity; its toggle refuses with no door, over a reward tray, and hides the wagon and the bag as they hide it (mutants: the vault below the bag; a weight limit on the shelves; the ground\'s refusal asked of the vault)', () => {
  assert.equal(typeof session.planVaultToggle, 'function', 'inventorySession.js exports planVaultToggle');
  const rows = [{ name: 'a' }, { name: 'b' }];
  const door = { shown: () => true, items: () => rows };
  const deps = { guildVault: () => door, bagItems: () => ['bag'], wagonItems: () => ['wagon'], loot: { items: () => ['loot'], stolenFrom: new Set([1]), capacity: () => ({ kg: 10, name: 'x' }), playerOwned: true }, dropRefusal: () => ({ text: 'no drop' }) };
  assert.deepEqual(session.remoteTarget(deps, { usingVault: true, usingBag: true, usingWagon: true }), rows, 'first of the claims');
  assert.deepEqual(session.remoteTarget({}, { usingVault: true }), [], 'no door: nothing');
  assert.deepEqual(session.remoteTarget(deps, { usingBag: true }), ['bag'], 'unchanged without the vault');
  assert.equal(session.groundRefusalOf(deps, { usingVault: true }), null, 'the vault is no floor');
  assert.equal(session.storeCapacityOf(deps, { usingVault: true }), null, 'the vault has no weight limit');
  assert.equal(session.remoteTargetType(deps, { usingVault: true }), session.REMOTE_TARGET_TYPES.Vault);
  assert.notEqual(session.REMOTE_TARGET_TYPES.Vault, session.REMOTE_TARGET_TYPES.Bag);
  assert.equal(session.theftTarget(deps, { usingVault: true }), null, 'never a theft target, though the loot target beside it is one');
  assert.ok(session.theftTarget(deps, {}) instanceof Set, 'and the loot target still is, without the vault');
  // the toggle
  const no = session.planVaultToggle({}, {});
  assert.deepEqual([no.ok, no.refusal.reason], [false, 'noVault'], 'no door');
  const hidden = session.planVaultToggle({ guildVault: () => ({ shown: () => false }) }, {});
  assert.deepEqual([hidden.ok, hidden.refusal.reason], [false, 'noVault'], 'a door with no vault to show');
  const tray = session.planVaultToggle(deps, { chooseOne: { items: [] } });
  assert.deepEqual([tray.ok, tray.refusal.reason], [false, 'reward'], 'never over a reward tray');
  assert.equal(typeof tray.refusal.text, 'string');
  assert.deepEqual(session.planVaultToggle(deps, { usingBag: true, usingWagon: false }), { ok: true, usingVault: true, usingWagon: false, usingBag: false }, 'showing it hides the bag');
  assert.deepEqual(session.planVaultToggle(deps, { usingWagon: true }), { ok: true, usingVault: true, usingWagon: false, usingBag: false }, 'and the wagon');
  assert.deepEqual(session.planVaultToggle(deps, { usingVault: true }), { ok: true, usingVault: false, usingWagon: false, usingBag: false }, 'showing, it hides');
  assert.equal(session.planVaultToggle(deps, { usingVault: true, chooseOne: { items: [] } }).ok, true, 'a tray that arrives over an open vault does not trap it open');
});

test('GUILD-PANE 1 THE FILTER\'S KINDS: the vault carries the filter bar and nothing else of a store\'s - Take all, Stash all and the shift-stow keep their own set (mutants: the vault in the bulk set; the bar not served)', () => {
  const { STORE_FILTER_KINDS, STORE_BULK_KINDS } = storeFilter;
  assert.ok(STORE_BULK_KINDS instanceof Set, 'storeFilter.js exports STORE_BULK_KINDS');
  assert.equal(STORE_FILTER_KINDS.has('vault'), true);
  assert.equal(STORE_BULK_KINDS.has('vault'), false);
  assert.deepEqual([...STORE_BULK_KINDS].sort(), ['bag', 'container', 'storage', 'wagon'], 'the old four, unmoved');
  for (const k of STORE_BULK_KINDS) assert.equal(STORE_FILTER_KINDS.has(k), true, `${k} keeps its bar`);
});

// ─── THE DOOR (scenes/guildVaultHost.js) ────────────────────────────────────────────────────────────────────────

test('GUILD-PANE 1 THE DOOR: shown for a guild, a realm character playing, online - never for a book with no realm, no guild, no character or no pack; its rows are the vault\'s views, one object a row between repaints, a new one when the row changed; slotOf names the slot; the view and the error are this character\'s and this guild\'s alone (mutants: the realm unread; identity lost between reads; a stale error shown)', async () => {
  const s = await stood();
  const r = await rig(s, s.gm);
  const door = r.door;
  assert.equal(door.shown(), true);
  assert.deepEqual([door.view(), door.items()], [null, []], 'unread: no view, no rows');
  assert.equal(door.error(), null);
  await door.read();
  const first = door.items();
  assert.equal(first.length, 3);
  assert.equal(door.items(), first, 'the same list while the view stands');
  assert.deepEqual(first.map((it) => door.slotOf(it)), [0, 1, 2], 'each row\'s slot');
  assert.equal(door.slotOf({ name: 'not mine' }), null);
  assert.equal(first[1].stackCount, 20, 'the count the shelf holds');
  await door.read({ again: true });
  const second = door.items();
  assert.notEqual(second, first, 'a new read, a new list');
  assert.ok(second.every((it, i) => it === first[i]), 'but every row is the very object it was');
  // a row that changed is a new object: take 5 arrows out through the real route, read again
  const slot = door.view().items.find((x) => x.name === 'Arrow');
  const taken = await s.call('/v1/guilds/vault/take', { character: s.gm.character, realm: s.gm.realm.at(), slot: slot.slot, count: 5, at: slot.at }, s.gm.secret);
  assert.equal(taken.status, 200, JSON.stringify(taken.body));
  await door.read({ again: true });
  const third = door.items();
  assert.equal(third[0], first[0], 'the sword unchanged');
  assert.notEqual(third[1], first[1], 'the arrows changed: a new view');
  assert.equal(third[1].stackCount, 15);
  assert.equal(door.slotOf(third[1]), slot.slot);
  const slots = door.slots();
  assert.deepEqual(slots, { used: 3, max: GUILD_VAULT_SLOTS });
  assert.deepEqual(door.standing(), { level: 'withdraw', limit: 0, granted: false, taken: 1 }, 'this member\'s standing, with the one take counted');
  assert.equal(door.reach(), true);
  r.state.reach = false;
  assert.equal(door.reach(), false);
  assert.equal(door.busy(), false);
  // isolation: another guild's or character's view is never this door's
  r.book.guild = { ...r.book.guild, id: 'gOTHER000000' };
  assert.deepEqual([door.view(), door.items()], [null, []], 'another guild: no view');
  r.book.guild = { ...r.book.guild, id: s.gid };
  assert.equal(door.items().length, 3, 'and back');
  r.state.character = 'rSOMEONEELSE';
  assert.deepEqual([door.view(), door.items(), door.error()], [null, [], null], 'another character: no view, no stale error');
  assert.equal(door.slots().used, 0);
  // shown() needs all of it
  assert.equal(doorOf((await rig(s, s.gm, { realm: false })).book).shown(), false, 'no realm: not a realm character');
  const noGuild = await rig(s, s.member);
  noGuild.book.guild = null;
  assert.equal(noGuild.door.shown(), false, 'no guild');
  const noChar = await rig(s, s.gm);
  noChar.state.character = null;
  assert.equal(noChar.door.shown(), false, 'no character');
  const noPack = await rig(s, s.gm);
  noPack.book.pack = null;
  assert.equal(noPack.door.shown(), false, 'no pack');
  assert.equal(doorOf(null).shown(), false, 'no book at all');
  assert.deepEqual([doorOf(null).items(), doorOf(null).slots(), doorOf(null).view()], [[], { used: 0, max: 0 }, null]);
});

test('GUILD-PANE 1 THE DOOR\'S READ: one read in flight is the one a second ask joins, unless asked again; a refused read is an error in the account\'s words with no view, and Try again reads again (mutants: a read asked twice at once; the error unworded)', async () => {
  const s = await stood();
  let release = null;
  const r = await rig(s, s.gm);
  r.gate.hold = (n) => (n === 1 ? new Promise((res) => { release = res; }) : null);
  const a = r.door.read();
  const b = r.door.read();
  assert.equal(a, b, 'the same read');
  await settle();
  assert.equal(r.gate.reads, 1, 'asked of the service once');
  release();
  await a;
  assert.equal(r.door.items().length, 3);
  r.gate.fail = () => true;
  await r.door.read({ again: true });
  assert.equal(r.door.view(), null);
  assert.equal(r.door.error(), 'server');
  assert.match(r.door.errorText(), /\S/, 'in words');
  assert.notEqual(r.door.errorText(), 'server');
  r.gate.fail = null;
  await r.door.read({ again: true });
  assert.equal(r.door.error(), null);
  assert.equal(r.door.items().length, 3);
});

// ─── THE BUTTON ─────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD-PANE 1 THE BUTTON: Guild Vault stands on the pack for a realm character in a guild, online; absent offline (no door), for a character that is no realm\'s, with no guild, and over a reward tray; the dungeon\'s pack has it too, view-only, with the reach note (mutants: the realm unread; the guild unread; the tray unread)', async () => {
  const s = await stood();
  await withDomAsync(async (dom) => {
    const r = await rig(s, s.gm);
    await pane(dom, r, ({ host }) => assert.ok(actBtn(host, 'Guild Vault'), 'in a guild, a realm character: the footer button'));
    const offline = await rig(s, s.gm, { door: false });
    await pane(dom, offline, ({ host }) => assert.equal(actBtn(host, 'Guild Vault'), undefined, 'offline: none'));
    const norealm = await rig(s, s.gm, { realm: false });
    await pane(dom, norealm, ({ host }) => assert.equal(actBtn(host, 'Guild Vault'), undefined, 'no realm character: none'));
    const none = await rig(s, s.gm);
    none.book.guild = null;
    await pane(dom, none, ({ host }) => assert.equal(actBtn(host, 'Guild Vault'), undefined, 'no guild: none'));
    const tray = await rig(s, s.gm);
    await pane(dom, tray, ({ host }) => assert.equal(actBtn(host, 'Guild Vault'), undefined, 'over a reward tray: none'),
      { chooseOne: { items: [setItemFields({ group: 'Weapons', templateIndex: 113, material: 0 })], onChoose() {} } });
    // the dungeon's pack: the reach is false there (neither a town nor a caravan), the button and the note are still there
    const below = await rig(s, s.gm, { reach: false });
    await pane(dom, below, async ({ host }) => {
      await openVault(host, below);
      assert.equal(remoteKind(), 'vault');
      assert.ok(host.querySelectorAll('.vaultreach').length === 1, 'the reach note');
      assert.equal(remoteRows(host).length, 3, 'the rows are shown all the same');
    });
  });
  // the dungeon host hands its pack the same door (by source: a dungeon's context is not built here)
  const dun = read('src/scenes/dungeonContext.js');
  assert.match(dun, /guildVault: heldGuildVaultDoor,/);
  assert.match(dun, /import \{ heldGuildVaultDoor \} from '\.\/guildVaultHost\.js';/);
});

test('GUILD-PANE 1 OPENING: the vault opens beside the pack and hides the wagon and the bag, and each of those hides it; refused over a reward tray; closed by its own Close vault (mutants: the wagon left up; the bag left up; the tray unread)', async () => {
  const s = await stood();
  await withDomAsync(async (dom) => {
    const r = await rig(s, s.gm, { items: [...s.record(s.gm).items, setItemFields({ group: 'UselessItems2', templateIndex: 600 }), newWagonItem('cart')] });
    await pane(dom, r, async ({ host }) => {
      const kinds = [];
      const kind = () => { kinds.push(remoteKind()); return kinds.at(-1); };
      assert.equal(kind(), 'ground');
      actBtn(host, 'Materials Bag').onclick();
      assert.equal(kind(), 'bag');
      actBtn(host, 'Guild Vault').onclick();   // the bag's side window carries the vault's button too
      await settle();
      assert.equal(kind(), 'vault', 'the vault replaces the bag');
      assert.ok(actBtn(host, 'Close vault'), 'its button now closes it');
      assert.ok(actBtn(host, 'Materials Bag'), 'and the bag\'s door is there to swap back');
      actBtn(host, 'Materials Bag').onclick();
      assert.equal(kind(), 'bag', 'the bag hides the vault');
      actBtn(host, 'Guild Vault').onclick();
      await settle();
      assert.equal(kind(), 'vault');
      actBtn(host, 'Wagon').onclick();
      assert.equal(kind(), 'wagon', 'the wagon hides the vault');
      assert.equal(actBtn(host, 'Guild Vault')?.textContent, 'Guild Vault');
      actBtn(host, 'Guild Vault').onclick();
      await settle();
      assert.equal(kind(), 'vault');
      assert.equal(JSON.parse(globalThis.__pack()).usingWagon, false, 'the wagon is hidden');
      actBtn(host, 'Close vault').onclick();
      assert.equal(kind(), 'ground', 'Close vault closes it');
      assert.equal(actBtn(host, 'Guild Vault')?.textContent, 'Guild Vault', 'and the door is back on the footer');
    });
  });
});

// ─── THE ROWS ───────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD-PANE 1 THE ROWS: a vault holding a sword, a stack of 20 arrows and a stolen piece shows three rows - icon, wear, weight, the stack\'s count - under its own title and "3 of 50 slots", or "of 100" with a hall; a card on a press, the stolen piece\'s with its mark (mutants: the slot count; the hall unread; the count dropped; the mark unshown)', async () => {
  const s = await stood();
  await withDomAsync(async (dom) => {
    const r = await rig(s, s.gm);
    await pane(dom, r, async ({ host }) => {
      await openVault(host, r);
      assert.equal(host.querySelector('.remotewho').children[0].textContent, 'Guild Vault', 'its own title');
      const rows = remoteRows(host);
      assert.equal(rows.length, 3);
      const items = r.door.items();
      assert.deepEqual(rows.map(named), items.map((it) => itemLine(it).name + (itemLine(it).stack ? ` ×${itemLine(it).stack}` : '')), 'each row\'s name, the arrows with ×20');
      assert.match(named(rows[1]), /×20$/);
      for (const row of rows) assert.ok(row.querySelector('.tile'), 'an icon in each row');
      assert.ok(rows[0].querySelector('.tile').querySelector('.wear'), 'the sword wears a bar');
      assert.equal(rows[1].querySelector('.tile').querySelector('.wear'), null, 'the arrows do not');
      assert.deepEqual(rows.map((row) => row.querySelector('.itemwt')?.textContent), items.map((it) => `${itemLine(it).weight.toFixed(2)} kg`), 'each row\'s weight');
      const total = items.reduce((n, it) => n + itemLine(it).weight, 0);
      const meta = remoteMeta(host);
      assert.match(meta, /^3 of 50 slots · \d+\.\d\d kg$/);
      assert.ok(Math.abs(Number(/· ([\d.]+) kg/.exec(meta)[1]) - total) < 0.011, `the shelf's weight (${meta} against ${total})`);
      // the card of the stolen piece shows its mark
      rows[2].onclick({});
      const tip = host.querySelector('.packtip');
      assert.ok(tip, 'a press shows the card');
      assert.ok(tip.querySelectorAll('.boundline').some((p) => p.textContent === stolenLine()), 'the stolen mark');
      assert.equal(dom.all(tip).find((n) => n.tagName === 'H3')?.textContent, itemLine(items[2]).name);
      assert.ok(tip.querySelectorAll('dd').some((d) => d.textContent === 'Guild Vault'), 'Where: Guild Vault');
      rows[0].onclick({});
      assert.equal(host.querySelector('.packtip').querySelectorAll('.boundline').length, 0, 'the sword is clean');
    });
    // a hall adds fifty shelves
    s.raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, guild_id)
      VALUES (1, 1, ?, ?, 'The Iron Oath', 17, 'guild', 20000, ?, 20000, ?)`).run(s.gm.id, `g:${s.gid}`, T0, s.gid);
    const hall = await rig(s, s.gm);
    await pane(dom, hall, async ({ host }) => {
      await openVault(host, hall);
      assert.match(remoteMeta(host), /^3 of 100 slots/);
    });
  });
});

test('GUILD-PANE 1 THE NOTES: the standing, "k of N taken today" for a limited withdrawer, the reach note away from a town, and an empty vault said (mutants: the standing unsaid; the limit unsaid)', async () => {
  const s = await stand();
  await withDomAsync(async (dom) => {
    const gm = await rig(s, s.gm);
    await pane(dom, gm, async ({ host }) => {
      await openVault(host, gm);
      assert.equal(host.querySelector('.vaultstanding')?.textContent, 'Your standing: Takes out, any number.');
      assert.equal(host.querySelector('.vaultreach'), null, 'reached: no note');
      assert.equal(remoteEmpty(host)?.textContent, 'The vault is empty.');
      assert.equal(remoteMeta(host), '0 of 50 slots · 0.00 kg');
    });
    const m = `m${s.raw.prepare('SELECT rowid AS rid FROM guild_members WHERE char_id = ?').get(s.member.character).rid}`;
    assert.equal((await s.call('/v1/guilds/vault/grant', { character: s.gm.character, member: m, level: 'withdraw', limit: 3 }, s.gm.secret)).status, 200);
    const mem = await rig(s, s.member, { reach: false });
    await pane(dom, mem, async ({ host }) => {
      await openVault(host, mem);
      assert.equal(host.querySelector('.vaultstanding')?.textContent, 'Your standing: Takes out, 3 a day - 0 of 3 taken today.');
      assert.equal(host.querySelector('.vaultreach')?.textContent, 'You can use the vault in any town or a guild caravan. View it here; put items in and take them out in town or in a guild caravan.');
    });
  });
});

// ─── READING AND ERRORS ─────────────────────────────────────────────────────────────────────────────────────────

test('GUILD-PANE 1 READING: "Reading the vault..." until the read answers; a refused read shows its error and Try again, and Try again reads again; the last read asked is the one shown (K14) (mutants: no reading line; Try again not reading; an earlier read shown over a later)', async () => {
  const s = await stood();
  await withDomAsync(async (dom) => {
    const r = await rig(s, s.gm);
    let release = null;
    r.gate.hold = (n) => (n === 1 ? new Promise((res) => { release = res; }) : null);
    await pane(dom, r, async ({ host }) => {
      actBtn(host, 'Guild Vault').onclick();
      await settle();
      assert.equal(remoteRows(host).length, 0);
      assert.equal(remoteEmpty(host)?.textContent, 'Reading the vault...');
      release();
      await settle();
      assert.equal(remoteRows(host).length, 3, 'the answer paints the rows with no further press');
      assert.equal(remoteEmpty(host), null);
    });
    // a refused read
    const bad = await rig(s, s.gm);
    bad.gate.fail = () => true;
    await pane(dom, bad, async ({ host }) => {
      actBtn(host, 'Guild Vault').onclick();
      await settle();
      assert.equal(remoteRows(host).length, 0);
      assert.match(remoteEmpty(host).textContent, /^The vault cannot be read now: \S/);
      const again = host.querySelector('.vaultagain');
      assert.ok(again, 'Try again');
      assert.equal(again.textContent, 'Try again');
      const asked = bad.gate.reads;
      bad.gate.fail = null;
      again.onclick();
      await settle();
      assert.equal(bad.gate.reads, asked + 1, 'Try again reads again');
      assert.equal(remoteRows(host).length, 3);
      assert.equal(host.querySelector('.vaultagain'), null);
    });
    // K14: the first read is held; a take lands; a second read asked after it answers first - the held one answers last
    const k = await rig(s, s.gm);
    let hold = null;
    k.gate.hold = (n) => (n === 1 ? new Promise((res) => { hold = res; }) : null);
    await pane(dom, k, async ({ host }) => {
      actBtn(host, 'Guild Vault').onclick();   // read 1: held
      await settle();
      const slot = (await k.book.readVault()).data.vault.items.find((x) => x.name === 'Arrow');   // read 2: answers at once
      const taken = await s.call('/v1/guilds/vault/take', { character: s.gm.character, realm: s.gm.realm.at(), slot: slot.slot, at: slot.at }, s.gm.secret);
      assert.equal(taken.status, 200);
      await k.book.readVault();   // read 3: the vault after the take
      hold();   // read 1 answers now, last, with the vault from before the take
      await settle();
      const caps = remoteRows(host).map(named);
      assert.equal(caps.length, 2, 'the later read wins: the arrows are gone from the pane');
      assert.equal(caps.some((n) => /Arrow/.test(n)), false);
    });
  });
});

// ─── THE FILTER ─────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD-PANE 1 THE FILTER: the bar narrows the vault by search, category and rarity, and is fresh when the pane is opened again (mutants: the bar not served; the search unread; a kept filter)', async () => {
  const s = await stand({ gmItems: [SWORD, ARROWS(40), RARE, ring()] });
  await s.putIn(s.gm, 0); await s.putIn(s.gm, 0, 20); await s.putIn(s.gm, 1); await s.putIn(s.gm, 1);
  await withDomAsync(async (dom) => {
    const r = await rig(s, s.gm);
    await pane(dom, r, async ({ host }) => {
      await openVault(host, r);
      assert.equal(remoteRows(host).length, 4);
      const search = host.querySelector('.storesearch');
      assert.ok(search, 'the search field');
      search.value = 'arrow'; search.oninput();
      assert.deepEqual(remoteRows(host).map(named).map((n) => n.replace(/ ×\d+$/, '')), ['Arrow'], 'narrowed by name');
      search.value = ''; search.oninput();
      assert.equal(remoteRows(host).length, 4);
      const cat = host.querySelector('.storecat');
      cat.value = 'weapons'; cat.onchange();
      assert.equal(remoteRows(host).length, 3, 'narrowed by category: the weapons');
      const rar = host.querySelector('.storerarity');
      assert.ok(rar, 'the rarity menu');
      rar.value = 'rare'; rar.onchange();
      assert.equal(remoteRows(host).length, 1, 'and by rarity');
      assert.match(named(remoteRows(host)[0]), /Dagger/);
      actBtn(host, 'Close vault').onclick();
      await openVault(host, r);
      assert.equal(remoteRows(host).length, 4, 'fresh when opened again');
      assert.equal(host.querySelector('.storesearch').value, '');
      assert.equal(host.querySelector('.storecat').value, 'all');
    });
  });
});

// ─── READ-ONLY ──────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD-PANE 1 READ-ONLY: every way a piece could leave the vault or enter it moves nothing - a row\'s click, the card, the right-click menu, the pad\'s quick act, Take all, Stash all, shift-click, a drag in, Stow, the gold button; the pane items are frozen and the pack and the book\'s view stand as they were (mutants: a click that takes; Stow offered; a shift that puts or drops; a drag that stows; the gold field; the bulk buttons)', async () => {
  const s = await stood();
  await withDomAsync(async (dom) => {
    const r = await rig(s, s.gm, { items: [{ ...SWORD, name: 'Pack Sword' }, { ...RARE, name: 'Pack Dagger' }] });
    r.entity.goldPieces = 500;
    const dropped = [];
    await pane(dom, r, async ({ host }) => {
      await openVault(host, r);
      const frozen = r.door.items();
      for (const it of frozen) Object.freeze(it);
      Object.freeze(frozen);
      const packBefore = JSON.stringify(r.entity.items);
      const viewBefore = JSON.stringify(r.book.vaultNow());
      const guard = () => {
        assert.equal(JSON.stringify(r.entity.items), packBefore, 'the pack is as it was');
        assert.equal(JSON.stringify(r.book.vaultNow()), viewBefore, 'the book\'s view is as it was');
        assert.equal(r.entity.goldPieces, 500, 'the purse too');
        assert.equal(dropped.length, 0, 'nothing dropped in the world');
        assert.equal(r.gate.reads, reads, 'no read, no act asked of the service');
      };
      const reads = r.gate.reads;
      // the controls
      const acts = actsOf(host);
      for (const bad of ['Take all', 'Stash all', 'Drop gold', 'Stow gold', 'Store gold']) assert.equal(acts.includes(bad), false, `no ${bad}`);
      assert.equal(host.querySelector('.goldbtn'), null, 'no gold button over the vault');
      assert.equal(host.querySelector('.stashfoot'), null, 'no Stash all foot');
      assert.equal(host.querySelectorAll('.storehint').some((p) => /^Shift-click/.test(p.textContent)), false, 'no shift-click hint: it does nothing yet');
      // a remote row's click: only the card
      remoteRows(host)[0].onclick({});
      guard();
      let tip = host.querySelector('.packtip');
      assert.ok(tip, 'the card shows');
      const cardActs = tip.querySelectorAll('.act').map((b) => b.textContent);
      for (const bad of ['Take', 'Take this one', 'Use', 'Stow', 'Put in the guild vault']) assert.equal(cardActs.includes(bad), false, `no ${bad} on the vault's card`);
      assert.ok(cardActs.includes('Info'), 'its Info stands');
      // quick act (the pad's X) on a vault row
      const row = remoteRows(host)[1];
      row.isConnected = true;   // the fake document keeps no connectedness
      assert.equal(inventoryQuickAct(row), true);
      guard();
      // the right-click menu
      const hadWindow = 'window' in globalThis, was = globalThis.window;
      globalThis.window = { innerWidth: dom.w, innerHeight: dom.h, getComputedStyle: () => ({ position: 'absolute' }) };   // the menu is placed against the window
      try { remoteRows(host)[2].oncontextmenu({ preventDefault() {}, clientX: 10, clientY: 10 }); } finally { if (hadWindow) globalThis.window = was; else delete globalThis.window; }
      const menu = dom.doc.querySelectorAll('.inv-menu-item').map((b) => b.textContent);
      assert.ok(menu.includes('Info'), 'the menu opened: its Info stands');
      for (const bad of ['Take', 'Use', 'Stow']) assert.equal(menu.includes(bad), false, `no ${bad} in the vault row's menu`);
      guard();
      // a pack piece: the card has no Stow, shift-click does nothing, a drag over the vault is refused
      const pack = packRows(host);
      assert.ok(pack.length >= 2);
      pack[0].onclick({});
      tip = host.querySelector('.packtip');
      assert.ok(tip, 'the pack piece\'s card');
      assert.equal(tip.querySelectorAll('.act').some((b) => /^(Stow|Store|Put in|Drop)/.test(b.textContent)), false, 'no Stow on the card');
      guard();
      pack[1].onclick({ shiftKey: true });
      guard();
      // a drag from the pack onto the vault window, and off the panel
      const win = dom.doc.querySelectorAll('.loot-win')[0];
      const at = (n) => { dom.doc.elementFromPoint = () => n; };
      const p0 = packRows(host)[0];
      at(win); p0.onpointerdown({ pointerId: 7, button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 });
      dom.win.fire('pointermove', { pointerId: 7, clientX: 80, clientY: 80 });
      assert.equal(dom.doc.querySelectorAll('.dragghost')[0]?.querySelector('.ghostact')?.textContent, '', 'no verb for a release over the vault');
      assert.ok(dom.doc.querySelectorAll('.dragghost')[0].classList.contains('refused'), 'shown as refused');
      dom.win.fire('pointerup', { pointerId: 7, clientX: 80, clientY: 80 });
      guard();
      at(dom.body);
      packRows(host)[0].onpointerdown({ pointerId: 8, button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 });
      dom.win.fire('pointermove', { pointerId: 8, clientX: 300, clientY: 300 });
      dom.win.fire('pointerup', { pointerId: 8, clientX: 300, clientY: 300 });
      guard();
    }, { physicalDropOn: () => true, physicalDrop: (list) => dropped.push(...list), dropItem: (it) => dropped.push(it), onDrop: (list) => dropped.push(...list) });
  });
});

test('GUILD-PANE 1 READ-ONLY (a map\'s use): a treasure map in the vault is never read out of it - the card has no Use, and its row\'s click only shows the card (mutants: Use offered on the vault side; a map intercepted)', async () => {
  const s = await stand({ gmItems: [{ group: 'MiscItems', templateIndex: 164, name: 'Map', value: 10 }] });
  await s.putIn(s.gm, 0);
  await withDomAsync(async (dom) => {
    const r = await rig(s, s.gm);
    const revealed = [];
    await pane(dom, r, async ({ host }) => {
      await openVault(host, r);
      assert.equal(remoteRows(host).length, 1);
      remoteRows(host)[0].onclick({});
      const tip = host.querySelector('.packtip');
      assert.ok(tip);
      assert.equal(tip.querySelectorAll('.act').some((b) => b.textContent === 'Use'), false);
      assert.equal(revealed.length, 0);
      assert.equal(r.book.vaultNow().items.length, 1, 'the map is still on the shelf');
    }, { revealMap: (...a) => revealed.push(a) });
  });
});

// ─── THE REPAINT ────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD-PANE 1 THE REPAINT: an open vault pane repaints when the book\'s version moves and closes itself when its vault is gone - one poll, set when the pane opens, cleared when it is hidden and when the pack closes (mutants: no poll; a poll left running; the vault kept open on another character)', async () => {
  const s = await stood();
  await withDomAsync(async (dom) => {
    const poll = capturePoll();
    try {
      const r = await rig(s, s.gm);
      await pane(dom, r, async ({ host, view }) => {
        assert.equal(poll.live.size, 0, 'no poll while the vault is shut');
        await openVault(host, r);
        assert.equal(poll.live.size, 1, 'one poll while it shows');
        // a read that lands elsewhere (the Social page's, an act's) moves the version: the pane follows at the next tick
        const slot = r.door.view().items.find((x) => x.name === 'Arrow');
        const taken = await s.call('/v1/guilds/vault/take', { character: s.gm.character, realm: s.gm.realm.at(), slot: slot.slot, at: slot.at }, s.gm.secret);
        assert.equal(taken.status, 200);
        assert.equal(remoteRows(host).length, 3, 'not yet: nothing has read the vault');
        await r.book.readVault();
        assert.equal(remoteRows(host).length, 3, 'a read alone repaints nothing - the poll does');
        poll.fire();
        assert.equal(remoteRows(host).length, 2, 'the tick repaints it');
        // the reach moves as the player walks out of town
        assert.equal(host.querySelector('.vaultreach'), null);
        r.state.reach = false;
        poll.fire();
        assert.ok(host.querySelector('.vaultreach'), 'the reach note appears with no press');
        // hiding clears it
        actBtn(host, 'Close vault').onclick();
        assert.equal(poll.live.size, 0, 'cleared when the vault is hidden');
        await openVault(host, r);
        assert.equal(poll.live.size, 1);
        // the character is another now: the vault is gone from under the pane, and the pane closes it
        r.state.character = null;
        poll.fire();
        assert.equal(remoteKind(), 'ground', 'no vault to show: the pane lets go of it');
        assert.equal(poll.live.size, 0);
        r.state.character = s.gm.character;
        view.repaint();   // the pack redraws (the door was drawn away with the vault)
        await openVault(host, r);
        assert.equal(poll.live.size, 1);
        view.unmount();
        assert.equal(poll.live.size, 0, 'cleared when the pack closes');
      });
    } finally { poll.restore(); }
  });
});

// ─── ISOLATION ──────────────────────────────────────────────────────────────────────────────────────────────────

test('GUILD-PANE 1 ISOLATION (M3): another guild\'s view is never drawn, and switching character with the pane open empties it (mutants: a stale view shown under a new guild)', async () => {
  const s = await stood();
  await withDomAsync(async (dom) => {
    const poll = capturePoll();
    try {
      const r = await rig(s, s.gm);
      await pane(dom, r, async ({ host }) => {
        await openVault(host, r);
        assert.equal(remoteRows(host).length, 3);
        r.book.guild = { ...r.book.guild, id: 'gOTHER000000' };
        poll.fire();
        assert.equal(remoteRows(host).length, 0, 'another guild: none of this one\'s rows');
        assert.equal(host.querySelector('.packtip'), null);
        r.book.guild = { ...r.book.guild, id: s.gid };
        poll.fire();
        r.state.character = s.member.character;   // the same book, another character playing
        poll.fire();
        assert.equal(remoteRows(host).length, 0, 'another character: the pane holds none of the last one\'s pieces');
        assert.equal((host.querySelector('.loot-win').children.length > 0 && JSON.stringify(inside(host, '.itemname', '.loot-win').map((n) => n.textContent)).includes('Longsword')), false, 'nor their names');
      });
    } finally { poll.restore(); }
  });
});

// ─── THE CLASSIC SKIN, THE FOUR HOSTS, THE WORDS ────────────────────────────────────────────────────────────────

test('GUILD-PANE 1 THE CLASSIC SKIN is unchanged - its window draws no vault (a source pin: nativeInventory gains none) - and the hosts: world.js hands the pack the door (the building\'s and the street\'s alike, through worldModes\' makeInventory), exterior.js does not (the dev host has no online guild), the world host holds its book where the door reads it', () => {
  const native = read('src/ui/native/nativeInventory.js');
  assert.doesNotMatch(native, /guildVault|vault/i, 'the classic window knows no vault');
  const w = read('src/scenes/world.js');
  assert.match(w, /guildVault: heldGuildVaultDoor,/);
  assert.match(w, /guildBook = holdGuildBook\(new GuildBook\(\{/);
  assert.match(w, /import \{ holdGuildBook, heldGuildVaultDoor \} from '\.\/guildVaultHost\.js';/);
  assert.match(read('src/scenes/worldModes.js'), /host\.makeInventory\?\.\(\{/, 'the interiors open world\'s own pack');
  assert.doesNotMatch(read('src/scenes/exterior.js'), /guildVault/, 'FLAGGED: the dev host has no online guild');
  assert.doesNotMatch(read('src/scenes/worldModes.js'), /guildVault/, 'worldModes builds no pack of its own: it takes world.js\'s');
});

test('GUILD-PANE 1 THE WORDS: each new string of the pane goes through t() with its English row in the catalog (mutants: a key unrouted; a row missing)', () => {
  const rows = new Map(parseStringTableCsv(read('locales/en/Port_Strings.csv')));
  const want = {
    'inventory.vault.title': 'Guild Vault',
    'inventory.vault.close': 'Close vault',
    'inventory.vault.meta': '{used} of {max} slots · {kg} kg',
    'inventory.vault.standing': 'Your standing: {standing}.',
    'inventory.vault.standingLimit': 'Your standing: {standing} - {taken} of {limit} taken today.',
    'inventory.vault.reading': 'Reading the vault...',
    'inventory.vault.error': 'The vault cannot be read now: {why}',
    'inventory.vault.again': 'Try again',
    'inventory.vault.empty': 'The vault is empty.',
    'inventory.vault.reward': 'Choose your reward first, then open the guild vault.',
    'social.vault.reach': 'You can use the vault in any town or a guild caravan. View it here; put items in and take them out in town or in a guild caravan.',
  };
  for (const [k, en] of Object.entries(want)) assert.equal(rows.get(k), en, k);
  const pane = read('src/ui/enhanced/enhancedInventory.js') + read('src/systems/inventorySession.js');
  for (const k of Object.keys(want)) assert.ok(pane.includes(`'${k}'`), `${k} is read by the pane`);
  assert.match(read('src/ui/socialPanel.js'), /GUILD_VAULT_REACH_TEXT = '(You can use the vault in any town or a guild caravan\. View it here; put items in and take them out in town or in a guild caravan\.)'/);
});
