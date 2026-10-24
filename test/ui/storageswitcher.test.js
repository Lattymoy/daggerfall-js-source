// STORAGE (2026-10-24, part of GUILD-PANE; Travis: "I think we could just have that materials bag appear as "Storage" and
// have it show that pane on the right where you can select Wagon, Materials Bag, or Guild Vault right?"; "I think we
// should do it as part of this since we're trying to improve UX around this guild vault in general"): ONE DOOR FOR THE
// WAGON, THE MATERIALS BAG AND THE GUILD VAULT.
//
// While no side window stands the pack's footer shows ONE Storage button; the side window's header shows a strip of tabs
// (Wagon, Materials Bag, Guild Vault). This file mounts the REAL pane (`mountEnhancedInventory`, under the repo's fake
// DOM, test/invdrag.mjs) and presses the REAL buttons: the switching law is `planWagonToggle` / `planBagToggle` /
// `planVaultToggle` (inventorySession.js), never a stand-in. The vault tab runs over a REAL `GuildBook` whose door is the
// REAL account Worker on its real migrations (test/accountDb.mjs standService), as test/ui/guildpane.test.js does.
//
// ORDER MATTERS in one place: the pane remembers the storage used last in its module (`lastStorage`), and a test file is
// one process. The cases below that rely on a memory set it themselves, by opening what they need first.
import '../modsOff.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from '../accountDb.mjs';
import { seatRealm, realmActOver } from '../realmSeat.mjs';
import { withDomAsync } from '../invdrag.mjs';
import { SESSION_KEY, accountGuilds } from '../../src/net/accountClient.js';
import { GuildBook } from '../../src/net/guild/guildBook.js';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { WAGON_REFUSAL, planBagToggle, planVaultToggle } from '../../src/systems/inventorySession.js';
import { setItemFields } from '../../src/systems/item/itemTemplates.js';
import { packTradeRefusal } from '../../src/systems/tradePack.js';
import { newWagonItem } from '../../src/systems/wagon/wagonKinds.js';
import { BAG_WORDS } from '../../src/net/bagLaw.js';
import { parseStringTableCsv } from '../../src/systems/textManager.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
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

// ─── THE RIG ─────────────────────────────────────────────────────────────────────────────────────────────────────

const SWORD = { group: 'Weapons', templateIndex: 115, material: 1, name: 'Steel Longsword', value: 300, currentCondition: 800, maxCondition: 1000 };
const DAGGER = () => setItemFields({ group: 'Weapons', templateIndex: 113, material: 0 });
const bagItem = () => setItemFields({ group: 'UselessItems2', templateIndex: 600 });
const cartItem = () => newWagonItem('cart');

/** A service with a guildmaster in a guild whose vault holds a sword - built once, read by every vault test. */
let standing = null;
async function stand() {
  if (standing) return standing;
  const s = await standService({ MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const gm = await s.registered('Aldric', { renown: 10 });
  gm.realm = await seatRealm(s.env, gm.secret, 'Aldric', { name: 'Aldric', level: 5, goldPieces: 20_000, items: [SWORD], bankAccounts: [{ accountGold: 0 }] });
  gm.character = gm.realm.id;
  s.env.DB._raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(gm.id, gm.character, 'Aldric', 1_000_000, T0, T0);
  const found = await s.call('/v1/guilds/found', { character: gm.character, name: 'The Iron Oath', tag: 'IRON', realm: gm.realm.at(), region: 0 }, gm.secret);
  assert.equal(found.status, 200, JSON.stringify(found.body));
  const row = s.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(gm.character);
  const item = JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj))).items[0];
  const put = await s.call('/v1/guilds/vault/put', { character: gm.character, realm: gm.realm.at(), pick: 0, item }, gm.secret);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  return (standing = { ...s, gm });
}

/**
 * A pack for the guildmaster: `items` the pack holds (a cart, a bag, ...), and with `vault` a real book over the real
 * Worker and the host's door - without it, the pack of a player with no guild.
 */
async function rig({ items = [], vault = false } = {}) {
  const entity = { name: 'Aldric', stats: { strength: 50 }, items: items.map((i) => setItemFields(i)), goldPieces: 0, bankAccounts: [{ accountGold: 0 }] };
  if (!vault) return { entity, door: null };
  const s = await stand();
  const who = s.gm;
  const pack = { items: () => entity.items, add: (rec) => entity.items.push(setItemFields({ ...rec })), changed() {}, reach: () => true, refuses: (it) => packTradeRefusal(it, entity) };
  const book = new GuildBook({
    door: accountGuilds({ fetch: (url, init) => s.fetch(url, init), storage: sessionStorageOf(SESSION_KEY, who) }), character: () => who.character,
    wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), pack, realm: realmActOver(() => who.realm.at()),
  });
  await book.refresh();
  return { entity, book, door: doorOf(book) };
}

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

// ─── THE PANE'S HANDS ────────────────────────────────────────────────────────────────────────────────────────────

const remoteKind = () => JSON.parse(globalThis.__pack()).remoteKind;
const noticeOf = () => JSON.parse(globalThis.__pack()).notice;
const actBtn = (host, label) => host.querySelectorAll('.act').find((b) => b.textContent === label);
const footerStorage = (host) => host.querySelectorAll('.storagebtn');
const tabs = (host) => host.querySelectorAll('.storagetab');
const tabWords = (host) => tabs(host).map((b) => b.textContent);
const tab = (host, label) => {
  const b = tabs(host).find((x) => x.textContent === label);
  assert.ok(b, `the ${label} tab is drawn (drawn: ${JSON.stringify(tabWords(host))})`);
  return b;
};
const selected = (host) => tabs(host).filter((b) => b.getAttribute('aria-selected') === 'true').map((b) => b.textContent);
const dimmed = (b) => b.getAttribute('aria-disabled') === 'true';
/** The Storage button on the footer, asserted drawn. */
const storage = (host) => {
  const b = footerStorage(host)[0];
  assert.ok(b, 'the footer\'s Storage button is drawn');
  return b;
};
/** The inside of a dungeon: the wagon is not at hand (planWagonToggle's exitTooFar - the real plan). */
const DUNGEON = { dungeon: { inside: true } };
/** The pane's poll, captured: every interval set while `fn` runs, whether it is still set. */
function capturePoll() {
  const real = { set: globalThis.setInterval, clear: globalThis.clearInterval };
  const live = new Map();
  let n = 0;
  globalThis.setInterval = (fn, ms) => { const id = ++n; live.set(id, { fn, ms }); return id; };
  globalThis.clearInterval = (id) => { live.delete(id); };
  return { live, restore: () => { globalThis.setInterval = real.set; globalThis.clearInterval = real.clear; } };
}

// ─── 1. THE FOOTER ───────────────────────────────────────────────────────────────────────────────────────────────

test('STORAGE 1 THE FOOTER: one Storage button while any of the wagon, the bag or the vault exists - and none with none; the Materials Bag and Guild Vault buttons are gone from it; open, the side window carries the way back (mutants: the old buttons kept; the condition dropped; the button over a side window)', async () => {
  await withDomAsync(async (dom) => {
    const all = await rig({ items: [cartItem(), bagItem()], vault: true });
    await pane(dom, all, ({ host }) => {
      assert.equal(footerStorage(host).length, 1, 'ONE Storage button for the three');
      const b = storage(host);
      assert.equal(b.textContent, 'Storage');
      assert.ok(b.classList.contains('act'), 'an .act, as the footer\'s other buttons');
      assert.ok(b.parent?.classList.contains('packbar'), 'on the pack\'s footer');
      assert.equal(actBtn(host, 'Materials Bag'), undefined, 'no Materials Bag button on the footer any more');
      assert.equal(actBtn(host, 'Guild Vault'), undefined, 'no Guild Vault button on the footer any more');
      assert.equal(actBtn(host, 'Wagon'), undefined, 'nor a Wagon one');
      assert.equal(host.querySelectorAll('.bagbtn').length + host.querySelectorAll('.vaultbtn').length, 0, 'the old classes are drawn nowhere');
      assert.equal(host.querySelector('.loot-win'), null, 'nothing beside the pack yet');
    });
    // each alone is enough
    for (const [what, r] of [['a cart', await rig({ items: [cartItem()] })], ['a bag', await rig({ items: [bagItem()] })], ['a vault', await rig({ vault: true })]]) {
      await pane(dom, r, ({ host }) => assert.equal(footerStorage(host).length, 1, `${what} alone: the Storage button`));
    }
    // none: nothing to store in
    const none = await rig({ items: [DAGGER()] });
    await pane(dom, none, ({ host }) => assert.equal(footerStorage(host).length, 0, 'no cart, no bag and no vault: no button'));
    // open, the side window stands and the footer's button gives way to the tabs
    await pane(dom, all, async ({ host }) => {
      storage(host).onclick();
      await settle();
      assert.ok(host.querySelector('.loot-win'), 'the side window stands');
      assert.equal(footerStorage(host).length, 0, 'and the footer\'s Storage button is gone while it stands');
      assert.ok(tabs(host).length > 0, 'the tabs are its way back');
    });
    // a body's side window: the same
    const body = await rig({ items: [cartItem()] });
    await pane(dom, body, ({ host }) => {
      assert.equal(footerStorage(host).length, 0, 'beside a body\'s items: no footer button (no pack footer)');
      assert.ok(tabs(host).length > 0, 'the tabs stand in the body\'s header');
    }, { loot: { items: () => [DAGGER()] } });
  });
});

// ─── 2. STORAGE OPENS THE LAST USED, ELSE THE FIRST USABLE ───────────────────────────────────────────────────────

test('STORAGE 2 THE FIRST USABLE: with a cart that cannot be reached and a bag, Storage opens the bag; with none usable it says the first existing one\'s refusal and opens nothing (mutants: the wagon opened past its refusal; the bag skipped; the refusal unsaid)', async () => {
  await withDomAsync(async (dom) => {
    const r = await rig({ items: [cartItem(), bagItem()] });
    await pane(dom, r, ({ host }) => {
      storage(host).onclick();
      assert.equal(remoteKind(), 'bag', 'the wagon is out of reach: the bag is the first usable');
    }, DUNGEON);
    const cartOnly = await rig({ items: [cartItem()] });
    await pane(dom, cartOnly, ({ host }) => {
      storage(host).onclick();
      assert.equal(remoteKind(), 'ground', 'none usable: nothing opens');
      assert.equal(noticeOf(), WAGON_REFUSAL.exitTooFar.text, 'and the first existing one\'s refusal is said');
    }, DUNGEON);
  });
});

test('STORAGE 2 THE LAST USED: Storage opens the one used last - the vault after the vault was used - and the memory lasts across a remount; a last one that is gone falls back to the first usable in the order Wagon, Materials Bag, Guild Vault (mutants: no memory; the memory read as the first; the memory not kept across a mount; a gone one opened; the order changed)', async () => {
  await withDomAsync(async (dom) => {
    const all = await rig({ items: [cartItem(), bagItem()], vault: true });
    await pane(dom, all, async ({ host }) => {
      storage(host).onclick();
      await settle();
      tab(host, 'Guild Vault').onclick();
      await settle();
      assert.equal(remoteKind(), 'vault');
      tab(host, 'Guild Vault').onclick();   // the current tab closes
      assert.equal(remoteKind(), 'ground');
      storage(host).onclick();
      await settle();
      assert.equal(remoteKind(), 'vault', 'the vault was used last: Storage opens it, not the wagon that comes first');
    });
    // a remount in the same module: the memory is the session's, not the pane's
    await pane(dom, all, async ({ host }) => {
      assert.equal(remoteKind(), 'ground', 'a fresh pack: nothing open');
      storage(host).onclick();
      await settle();
      assert.equal(remoteKind(), 'vault', 'remembered across the remount');
      tab(host, 'Materials Bag').onclick();
      assert.equal(remoteKind(), 'bag');
    });
    await pane(dom, all, ({ host }) => {
      storage(host).onclick();
      assert.equal(remoteKind(), 'bag', 'the bag was used last now');
    });
    // the vault used, then a pack with no vault (another character, no guild): the memory is gone from under it
    await pane(dom, all, async ({ host }) => {
      storage(host).onclick();
      await settle();
      tab(host, 'Guild Vault').onclick();
      await settle();
      assert.equal(remoteKind(), 'vault');
    });
    const noVault = await rig({ items: [cartItem(), bagItem()] });
    await pane(dom, noVault, ({ host }) => {
      storage(host).onclick();
      assert.equal(remoteKind(), 'wagon', 'the vault is not there: the first usable, the wagon');
    });
    // and a last one that cannot be opened now falls back too: the wagon used (just above), then out of reach
    await pane(dom, noVault, ({ host }) => {
      storage(host).onclick();
      assert.equal(remoteKind(), 'bag', 'the wagon was used last but is out of reach: the first usable, the bag');
    }, DUNGEON);
  });
});

// ─── 3. THE SELECTOR ─────────────────────────────────────────────────────────────────────────────────────────────

test('STORAGE 3 THE SELECTOR: a tablist of the tabs that exist, in the order Wagon, Materials Bag, Guild Vault; the current one selected; another switches and the side window follows; the current one closes the pane (mutants: a tab drawn for what does not exist; the selection unmarked; a switch that closes; the current tab left open)', async () => {
  await withDomAsync(async (dom) => {
    const all = await rig({ items: [cartItem(), bagItem()], vault: true });
    await pane(dom, all, async ({ host }) => {
      storage(host).onclick();
      await settle();
      const list = host.querySelector('.storagetabs');
      assert.ok(list, 'the selector stands in the side window\'s header');
      assert.equal(list.getAttribute('role'), 'tablist');
      assert.ok(list.closest('.remotehead'), 'in the header');
      assert.deepEqual(tabWords(host), ['Wagon', 'Materials Bag', 'Guild Vault']);
      for (const b of tabs(host)) {
        assert.equal(b.getAttribute('role'), 'tab');
        assert.equal(b.tagName, 'BUTTON');
      }
      const opened = remoteKind();
      assert.deepEqual(selected(host), [{ wagon: 'Wagon', bag: 'Materials Bag', vault: 'Guild Vault' }[opened]], 'the one the side window shows is the selected tab');
      tab(host, 'Wagon').onclick();
      assert.equal(remoteKind(), 'wagon');
      assert.deepEqual(selected(host), ['Wagon']);
      tab(host, 'Materials Bag').onclick();
      assert.equal(remoteKind(), 'bag', 'another tab switches, and the remote kind follows');
      assert.deepEqual(selected(host), ['Materials Bag']);
      assert.equal(JSON.parse(globalThis.__pack()).usingWagon, false, 'the wagon is hidden by the bag');
      tab(host, 'Guild Vault').onclick();
      await settle();
      assert.equal(remoteKind(), 'vault');
      assert.deepEqual(selected(host), ['Guild Vault']);
      tab(host, 'Guild Vault').onclick();
      assert.equal(remoteKind(), 'ground', 'the current tab closes the storage pane');
      assert.equal(host.querySelector('.loot-win'), null, 'no side window');
      assert.equal(footerStorage(host).length, 1, 'and the footer\'s button is back');
      // the wagon and the bag close the same way
      storage(host).onclick();
      tab(host, 'Wagon').onclick();
      tab(host, 'Wagon').onclick();
      assert.equal(remoteKind(), 'ground', 'the wagon tab closes the wagon');
      storage(host).onclick();
      tab(host, 'Materials Bag').onclick();
      tab(host, 'Materials Bag').onclick();
      assert.equal(remoteKind(), 'ground', 'the bag tab closes the bag');
    });
    // only what exists is drawn
    const noCart = await rig({ items: [bagItem()], vault: true });
    await pane(dom, noCart, ({ host }) => {
      storage(host).onclick();
      assert.deepEqual(tabWords(host), ['Materials Bag', 'Guild Vault'], 'no cart: no Wagon tab');
    });
    const cartOnly = await rig({ items: [cartItem()] });
    await pane(dom, cartOnly, ({ host }) => {
      storage(host).onclick();
      assert.deepEqual(tabWords(host), ['Wagon'], 'a cart alone: its tab alone');
    });
    const bagVault = await rig({ items: [bagItem()] });
    await pane(dom, bagVault, ({ host }) => {
      storage(host).onclick();
      assert.deepEqual(tabWords(host), ['Materials Bag'], 'no guild: no Guild Vault tab');
    });
  });
});

// ─── 4. DIMMED ───────────────────────────────────────────────────────────────────────────────────────────────────

test('STORAGE 4 DIMMED: a tab that exists but cannot open now is drawn dimmed - aria-disabled, its refusal words as its title - and pressing it says the refusal and changes nothing; the draw never opens it (mutants: a dimmed tab that opens; the refusal unsaid; the title missing; a usable tab dimmed; the draw writing the session)', async () => {
  await withDomAsync(async (dom) => {
    const r = await rig({ items: [cartItem(), bagItem()] });
    await pane(dom, r, ({ host }) => {
      storage(host).onclick();   // the bag: the wagon is out of reach
      assert.equal(remoteKind(), 'bag');
      const wagon = tab(host, 'Wagon');
      assert.equal(dimmed(wagon), true, 'the wagon is out of reach: dimmed');
      assert.equal(wagon.title, WAGON_REFUSAL.exitTooFar.text, 'its refusal words as its title');
      assert.equal(dimmed(tab(host, 'Materials Bag')), false, 'the bag is usable (and current)');
      assert.equal(JSON.parse(globalThis.__pack()).usingWagon, false, 'drawing it dimmed opened nothing');
      wagon.onclick();
      assert.equal(remoteKind(), 'bag', 'pressing it changes nothing: the bag stays');
      assert.deepEqual(selected(host), ['Materials Bag']);
      assert.equal(noticeOf(), WAGON_REFUSAL.exitTooFar.text, 'and says the refusal as a notice');
    }, DUNGEON);
    // over a body's items: the dimmed Wagon tab is pressed, the refusal said, the loot stays
    const body = await rig({ items: [cartItem()] });
    await pane(dom, body, ({ host }) => {
      const loot = remoteKind();
      const wagon = tab(host, 'Wagon');
      assert.equal(dimmed(wagon), true, 'out of reach over loot too');
      wagon.onclick();
      assert.equal(noticeOf(), WAGON_REFUSAL.exitTooFar.text, 'the refusal said');
      assert.equal(remoteKind(), loot, 'and the loot stays');
    }, { ...DUNGEON, loot: { items: () => [DAGGER()] } });
    // a reachable wagon is not dimmed, and wears no refusal
    await pane(dom, r, ({ host }) => {
      storage(host).onclick();
      for (const b of tabs(host)) {
        assert.equal(dimmed(b), false, `${b.textContent} is usable`);
        assert.ok(!b.title, `${b.textContent} wears no refusal`);
      }
    });
    // the horse-cart runtime's own refusal is the title (its answer, read: the real plan asks it)
    const asked = [];
    const horseCart = () => ({ canAccessWagonStorage: (ctx) => { asked.push(ctx); return { allowed: false, denialMessage: 'Your wagon is not within 5 meters.' }; } });
    await pane(dom, r, ({ host }) => {
      storage(host).onclick();
      assert.equal(remoteKind(), 'bag');
      const wagon = tab(host, 'Wagon');
      assert.equal(dimmed(wagon), true);
      assert.equal(wagon.title, 'Your wagon is not within 5 meters.', 'the runtime\'s denial is the title');
      assert.ok(asked.length > 0, 'asked of the runtime');
    }, { horseCart });
  });
});

// ─── 5. OVER LOOT ────────────────────────────────────────────────────────────────────────────────────────────────

test('STORAGE 5 OVER LOOT: with a container open the selector stands in its header with no tab selected; picking Wagon shows the wagon, and closing the Wagon tab shows the container again (mutants: no selector over loot; a tab selected over loot; the loot lost on the way back)', async () => {
  await withDomAsync(async (dom) => {
    const pile = [DAGGER(), DAGGER()];
    const r = await rig({ items: [cartItem()] });
    r.entity.wagonItems = [DAGGER()];
    await pane(dom, r, ({ host }) => {
      const loot = remoteKind();
      assert.notEqual(loot, 'wagon');
      assert.equal(host.querySelectorAll('.itemrow').filter((x) => x.closest('.loot-win')).length, 2, 'the body\'s two pieces');
      assert.ok(host.querySelector('.storagetabs')?.closest('.remotehead'), 'the selector in the body\'s header');
      assert.deepEqual(tabWords(host), ['Wagon']);
      assert.deepEqual(selected(host), [], 'no tab selected over loot');
      tab(host, 'Wagon').onclick();
      assert.equal(remoteKind(), 'wagon', 'the wagon replaces the loot list');
      assert.equal(host.querySelectorAll('.itemrow').filter((x) => x.closest('.loot-win')).length, 1, 'the wagon\'s one piece');
      assert.deepEqual(selected(host), ['Wagon']);
      tab(host, 'Wagon').onclick();
      assert.equal(remoteKind(), loot, 'closing the Wagon tab shows the container again');
      assert.equal(host.querySelectorAll('.itemrow').filter((x) => x.closest('.loot-win')).length, 2, 'with its pieces');
      assert.deepEqual(selected(host), []);
    }, { loot: { items: () => pile } });
  });
});

// ─── 6. THE REWARD TRAY ──────────────────────────────────────────────────────────────────────────────────────────

test('STORAGE 6 THE REWARD TRAY: over a choose-one tray the bag and vault tabs are not drawn (AUDIT BAG1 H1: a piece taken from them beside a tray would be the reward chosen), the wagon\'s is, and the plans still refuse in their own words (mutants: the bag tab over a tray; the vault tab over a tray)', async () => {
  await withDomAsync(async (dom) => {
    const r = await rig({ items: [cartItem(), bagItem()], vault: true });
    const reward = [setItemFields({ group: 'Armor', templateIndex: 102, material: 0 })];
    await pane(dom, r, async ({ host }) => {
      assert.equal(footerStorage(host).length, 0, 'beside a tray the pack draws no footer door');
      const list = host.querySelector('.storagetabs');
      assert.ok(list, 'the wagon is still allowed beside a tray (gold goes into it): the selector stands');
      assert.deepEqual(tabWords(host), ['Wagon'], 'but the bag and the vault are not on it');
      await settle();
    }, { chooseOne: { items: reward, onChoose() {} } });
    const bagOnly = await rig({ items: [bagItem()] });
    await pane(dom, bagOnly, ({ host }) => {
      assert.equal(footerStorage(host).length, 0, 'a bag alone over a tray: no door at all');
      assert.equal(tabs(host).length, 0);
      assert.equal(host.querySelector('.storagetabs'), null, 'and no empty selector');
    }, { chooseOne: { items: reward, onChoose() {} } });
    // the refusals stand through the plans the tabs press
    assert.deepEqual(planBagToggle({ items: () => [bagItem()] }, { chooseOne: { items: [] } }).refusal, { reason: 'reward', text: BAG_WORDS.reward });
    assert.equal(planVaultToggle({ guildVault: () => r.door }, { chooseOne: { items: [] } }).refusal.reason, 'reward');
  });
});

// ─── 7. THE VAULT POLL ───────────────────────────────────────────────────────────────────────────────────────────

test('STORAGE 7 THE VAULT POLL: starts when the vault tab opens, stops when another tab or the close is pressed, and on unmount (mutants: the poll left running after a switch; not started by the tab; not stopped by the close; kept past the pack)', async () => {
  await withDomAsync(async (dom) => {
    const poll = capturePoll();
    try {
      const r = await rig({ items: [cartItem(), bagItem()], vault: true });
      await pane(dom, r, async ({ host, view }) => {
        assert.equal(poll.live.size, 0, 'nothing open: no poll');
        storage(host).onclick();
        await settle();
        tab(host, 'Guild Vault').onclick();
        await settle();
        assert.equal(remoteKind(), 'vault');
        assert.equal(poll.live.size, 1, 'the vault tab starts the poll');
        tab(host, 'Wagon').onclick();
        assert.equal(remoteKind(), 'wagon');
        assert.equal(poll.live.size, 0, 'another tab stops it');
        tab(host, 'Guild Vault').onclick();
        await settle();
        assert.equal(poll.live.size, 1);
        tab(host, 'Materials Bag').onclick();
        assert.equal(poll.live.size, 0, 'the bag tab stops it too');
        tab(host, 'Guild Vault').onclick();
        await settle();
        assert.equal(poll.live.size, 1);
        tab(host, 'Guild Vault').onclick();
        assert.equal(remoteKind(), 'ground');
        assert.equal(poll.live.size, 0, 'the close stops it');
        storage(host).onclick();   // the vault, remembered
        await settle();
        assert.equal(remoteKind(), 'vault');
        assert.equal(poll.live.size, 1, 'the footer\'s Storage starts it as the tab does');
        view.unmount();
        assert.equal(poll.live.size, 0, 'cleared when the pack closes');
      });
    } finally { poll.restore(); }
  });
});

// ─── 8. THE WORDS ────────────────────────────────────────────────────────────────────────────────────────────────

test('STORAGE 8 THE WORDS: each new string goes through t() with its English row in the catalog, and the old toggles\' words are not drawn (mutants: a key unrouted; a row missing; a toggle label left)', () => {
  const rows = new Map(parseStringTableCsv(read('locales/en/Port_Strings.csv')));
  const want = {
    'inventory.storage.wagon': 'Wagon',
    'inventory.storage.bag': 'Materials Bag',
    'inventory.storage.vault': 'Guild Vault',
    'inventory.storage.open': 'Storage',
  };
  for (const [k, en] of Object.entries(want)) assert.equal(rows.get(k), en, k);
  const pane = read('src/ui/enhanced/enhancedInventory.js');
  for (const [k, en] of Object.entries(want)) assert.ok(pane.includes(`t('${k}', '${en}')`), `${k} is read by the pane with its English`);
  for (const dead of ["'Leave wagon'", "'Close bag'", "inventory.vault.close"]) assert.ok(!pane.includes(dead), `${dead} is drawn nowhere`);
});
