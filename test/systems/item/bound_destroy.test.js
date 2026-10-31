// BOUND-DESTROY (FIELD FEEDBACK 2026-10-31, #feature-feedback: "Soulbound items need to be disposable, certain aetheric
// sets and hearth offerings."): a bound piece nothing else takes is destroyed, asked first (src/systems/item/itemDiscard.js)
// - the law over every bound row and the pieces the producers mint, the enhanced card's Destroy and its question, the
// classic Remove's Yes/No over the ground, the batch salvage's words for an Aetheric piece the Broker never priced, and
// the Soul Cakes and Hearth Offerings let go through the account service (festivalClient.js discardFaces).
import '../../modsOff.js';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  discardRefusal, discardable, discardItem, destroyPiece, setCountedDiscard, countedKind, COUNTED_FACES,
  destroyAct, destroyAsk, destroyInstead, destroyedText, destroyRefusalText,
} from '../../../src/systems/item/itemDiscard.js';
import { BOUND_TEMPLATES } from '../../../src/net/realm/realmTradeLaw.js';
import { sigilStone, welkyndShards, portalStones } from '../../../src/systems/gate/gateSpoils.js';
import { mintWallet } from '../../../src/systems/walletItem.js';
import { mintBinder } from '../../../src/systems/iliac/iliacItems.js';
import { weirKeys } from '../../../src/systems/eliteGates/weirKey.js';
import { newDragonMount } from '../../../src/systems/dragon/dragonMount.js';
import { soulCakes, hearthOffering, isHearthOffering, isSoulCake } from '../../../src/systems/festival/soulCake.js';
import { brokerStock, brokerSale, brokerDay, dismantleStones, DISMANTLE_INSTEAD } from '../../../src/systems/sigil/sigilBroker.js';
import { wareItem, discardFaces, bindFestival, DISCARD_FINAL, _resetFestivalClientForTests } from '../../../src/systems/festival/festivalClient.js';
import { festivalRefusalText } from '../../../src/systems/festival/festivalWords.js';
import { wareById, FESTIVALS, SOUL_CAKE_TEMPLATE, HEARTH_OFFERING_TEMPLATE } from '../../../src/net/festivalLaw.js';
import { SESSION_KEY } from '../../../src/net/accountClient.js';
import { isBound, setRealmLocked, boundText, packOnlyText } from '../../../src/systems/item/itemBound.js';
import { lockedText } from '../../../src/systems/item/itemLock.js';
import { equipItem } from '../../../src/systems/equip.js';
import { applyRarity } from '../../../src/systems/loot/lootRarity.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../../../src/systems/item/itemTemplates.js';
import { itemLongName } from '../../../src/systems/item/itemInfo.js';
import { mountEnhancedInventory, batchRefusal, BATCH_LABEL } from '../../../src/ui/enhanced/enhancedInventory.js';
import { NativeInventoryWindow, tabAccepts } from '../../../src/ui/native/nativeInventory.js';
import { YesNoBoxWindow } from '../../../src/ui/yesNoBox.js';
import { destroyEnhancedNotice } from '../../../src/ui/enhanced/enhancedNotice.js';
import { CHEST_ACT_REFUSAL } from '../../../src/systems/inventorySession.js';
import { fakeDom } from '../../invdrag.mjs';
import { _resetForTests as _resetPrefsForTests, setPref } from '../../../src/systems/uiPrefs.js';

const DAY = brokerDay(Date.parse('2026-09-27T12:00:00Z'));
const ruby = () => mintCondition(setItemFields({ group: 'Gems', templateIndex: 0 }));
/** A Broker ware as his sale hands it over (priced, `stonesPaid`), and one bought before SS5 priced them. */
const ware = (slot = 0) => brokerSale(brokerStock(DAY)[slot], { items: [Object.assign(sigilStone(), { stackCount: 20 })], bought: [], day: DAY }).give;
const unpricedWare = (slot = 0) => { const w = ware(slot); delete w.stonesPaid; return w; };
/** A Wyrd's Raiment piece as the festival's sale mints it (festivalClient.js wareItem). */
const wyrd = (id = 'wyrd-hood') => wareItem(wareById(`piece:${id}`));
const tick = () => new Promise((r) => setTimeout(r, 0));

// ═══ the account service's door, this page's half ═══
const store = new Map();
const mem = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const seat = (kind = 'linked') => store.set(SESSION_KEY, JSON.stringify({ secret: 'sekrit', id: 'acct-alice', name: 'Alice', kind }));
function festivalPage(answers, { online = true } = {}) {
  globalThis.localStorage = mem;
  store.clear();
  seat();
  _resetFestivalClientForTests();
  const asked = [];
  const entity = { isPlayer: true, items: [] };
  const saved = { n: 0 };
  const api = {
    discard: async (...a) => { asked.push(a); const r = answers.shift(); return typeof r === 'function' ? r(...a) : r ?? { ok: false, error: 'offline' }; },
    mine: async () => ({ ok: false, error: 'offline' }),
    me: () => JSON.parse(store.get(SESSION_KEY) ?? 'null')?.id ?? null,
  };
  bindFestival({ online: () => online, entity: () => entity, say: () => {}, selfId: () => 'me', saved: () => { saved.n++; }, api });
  return { asked, entity, saved };
}

// FIRST, before any test here sets the door by hand
test('BOUND-DESTROY the festival\'s door is the pack\'s: festivalClient.js sets it at import, so a face\'s Destroy reaches the service (mutants: the door never set)', async () => {
  const p = festivalPage([{ ok: true, data: { cakes: 0, bowls: 2 } }]);
  try {
    const bowls = hearthOffering(3);
    p.entity.items.push(bowls);
    assert.deepEqual(await destroyPiece(bowls, { items: p.entity.items }), { ok: true });
    assert.deepEqual(p.asked.map(([k, n]) => [k, n]), [['bowls', 3]]);
    assert.equal(p.entity.items.filter(isHearthOffering)[0]?.stackCount, 2, 'the pack is the answer');
  } finally { _resetFestivalClientForTests(); delete globalThis.localStorage; }
});


test('BOUND-DESTROY the law: gear bound by its own mark and the two festival faces are destroyed; every row-bound token is kept - coin, keepsake, key; a priced ware is dismantled instead; a worn, locked or quest piece, an unbound piece and a realm-locked copy are refused (mutants: the row ignored; the mark ignored; the dismantle preferred no more; the faces kept; worn, locked or quest let through)', () => {
  const raiment = wyrd();
  assert.equal(raiment.bound, true, 'the Raiment is bound at its sale');
  assert.equal(raiment.rarity, 'aetheric');
  assert.equal(discardRefusal(raiment), null, 'the Wyrd\'s Raiment: destroyed');
  assert.equal(discardRefusal(unpricedWare()), null, 'a ware bought before SS5: no dismantle, so destroyed');
  assert.ok(dismantleStones(ware()) > 0);
  assert.equal(discardRefusal(ware()), 'dismantle', 'a priced ware: Dismantle pays, offered instead');
  assert.equal(discardRefusal(soulCakes(4)), null, 'Soul Cakes');
  assert.equal(discardRefusal(hearthOffering(2)), null, 'Hearth Offerings');
  // every row that binds: the tokens kept, the two faces let go
  const rowMinted = {
    570: sigilStone(), 571: welkyndShards(3), 572: portalStones(2), 575: weirKeys(2), 580: mintWallet(), 582: mintBinder(),
    1820: newDragonMount({ id: 'dg0123456789abcdef' }), 2000: soulCakes(1), 2001: hearthOffering(1),
  };
  assert.deepEqual(Object.keys(rowMinted).map(Number), [...BOUND_TEMPLATES], 'every bound row has its piece here');
  assert.deepEqual(BOUND_TEMPLATES.map((i) => [i, discardRefusal(rowMinted[i])]), BOUND_TEMPLATES.map((i) => [i, [SOUL_CAKE_TEMPLATE, HEARTH_OFFERING_TEMPLATE].includes(i) ? null : 'kept']));
  assert.equal(discardRefusal({ ...sigilStone(), bound: true }), 'kept', 'a stone carrying the mark is still the row\'s');
  assert.equal(discardRefusal(ruby()), 'not', 'an unbound gem has its own ways out');
  assert.equal(discardRefusal(null), 'not');
  // the refusals that stand on any piece
  assert.equal(discardRefusal(Object.assign(wyrd(), { questItem: true })), 'quest');
  assert.equal(discardRefusal(Object.assign(wyrd(), { equipSlot: 0 })), 'worn');
  assert.equal(discardRefusal(Object.assign(wyrd(), { locked: true })), 'locked');
  assert.equal(discardRefusal(Object.assign(hearthOffering(1), { locked: true })), 'locked', 'a locked bowl too');
  // a copy the realm locked is bound by its lock, not its nature
  const copy = Object.assign(ruby(), { uid: 'aaaaaaaaaaaaaaaa', rarity: 'rare' });
  setRealmLocked(['aaaaaaaaaaaaaaaa']);
  try {
    assert.equal(isBound(copy), true);
    assert.equal(discardRefusal(copy), 'not', 'the ledger holds it while it reads it');
  } finally { setRealmLocked(null); }
  assert.equal(discardable(raiment), true);
  assert.equal(discardable(ware()), false);
  assert.deepEqual(COUNTED_FACES, { 2000: 'cakes', 2001: 'bowls' });
  assert.deepEqual([countedKind(soulCakes(1)), countedKind(hearthOffering(1)), countedKind(raiment), countedKind({ templateIndex: 2001, group: 'Gems' })], ['cakes', 'bowls', null, null]);
});

test('BOUND-DESTROY discardItem and destroyPiece: the piece or the whole stack out, all or nothing; a refusal moves nothing; a face goes only through the service\'s door, with its whole count (mutants: a refusal that moves; a stack split; a face removed here alone)', async () => {
  const raiment = wyrd(), gem = ruby();
  const pack = [gem, raiment];
  assert.deepEqual(discardItem(raiment, { items: pack }), { ok: true, count: 1 });
  assert.deepEqual(pack, [gem], 'the piece gone, the rest untouched');
  const two = Object.assign(unpricedWare(1), { stackCount: 2 });
  const p2 = [two];
  assert.deepEqual(discardItem(two, { items: p2 }), { ok: true, count: 2 });
  assert.deepEqual(p2, [], 'the stack whole');
  const refused = (item, list, reason) => {
    const before = list.slice();
    assert.deepEqual(discardItem(item, { items: list }), { ok: false, reason });
    assert.deepEqual(list, before, `${reason}: nothing moved`);
  };
  const locked = Object.assign(wyrd(), { locked: true });
  refused(locked, [locked], 'locked');
  const priced = ware();
  refused(priced, [priced], 'dismantle');
  const stones = sigilStone();
  refused(stones, [stones], 'kept');
  refused(wyrd(), [gem], 'gone');
  const bowls = hearthOffering(3);
  refused(bowls, [bowls], 'counted');
  assert.deepEqual(discardItem(raiment, { items: null }), { ok: false, reason: 'gone' });
  // the face's door: none set, refused in the festival's words; set, asked with the count, the pack its answer's
  const asked = [];
  try {
    setCountedDiscard(null);
    assert.deepEqual(destroyPiece(bowls, { items: [bowls] }), { ok: false, reason: 'offline', text: festivalRefusalText('offline') });
    setCountedDiscard(async (kind, n) => { asked.push([kind, n]); return { ok: true, text: '' }; });
    const cakes = soulCakes(7), list = [cakes, bowls];
    const r = destroyPiece(cakes, { items: list });
    assert.ok(r instanceof Promise, 'a face answers when the service has');
    assert.deepEqual(await r, { ok: true });
    assert.deepEqual(await destroyPiece(bowls, { items: list }), { ok: true });
    assert.deepEqual(asked, [['cakes', 7], ['bowls', 3]]);
    assert.deepEqual(list, [cakes, bowls], 'the pack is the answer\'s to restack, never this side\'s');
    setCountedDiscard(async () => ({ ok: false, text: 'You hold fewer than that now.' }));
    assert.deepEqual(await destroyPiece(bowls, { items: list }), { ok: false, reason: 'service', text: 'You hold fewer than that now.' });
    const lockedBowl = Object.assign(hearthOffering(1), { locked: true });
    assert.deepEqual(destroyPiece(lockedBowl, { items: [lockedBowl] }), { ok: false, reason: 'locked' }, 'the lock asks no service');
    assert.deepEqual(destroyPiece(soulCakes(1), { items: [] }), { ok: false, reason: 'gone' });
    const g = wyrd(), gl = [g];
    assert.deepEqual(destroyPiece(g, { items: gl }), { ok: true, count: 1 }, 'gear answers at once');
    assert.deepEqual(gl, []);
  } finally { setCountedDiscard(discardFaces); }
});

test('BOUND-DESTROY the words', () => {
  assert.equal(destroyAct(), 'Destroy');
  assert.deepEqual(destroyAsk('Wyrd Hood', 1), ['Destroy Wyrd Hood?', 'It is gone for good. This cannot be undone.']);
  assert.deepEqual(destroyAsk('Hearth Offering', 3), ['Destroy Hearth Offering?', 'All 3 are gone for good. This cannot be undone.']);
  assert.equal(destroyInstead(1), 'Destroy it instead? It is gone for good.');
  assert.equal(destroyInstead(4), 'Destroy all 4 instead? They are gone for good.');
  assert.equal(destroyedText('Wyrd Hood'), 'Destroyed: Wyrd Hood.');
  assert.equal(destroyRefusalText('Wyrd Hood', 'locked'), lockedText('Wyrd Hood'));
  assert.equal(destroyRefusalText('Wyrd Hood', 'worn'), 'Take off Wyrd Hood before destroying it.');
  assert.equal(destroyRefusalText('Wyrd Hood', 'kept'), null);
});

test('BOUND-DESTROY the batch salvage: an Aetheric piece the Broker never priced is not said to be his to dismantle; a priced ware still is (mutants: the Broker\'s words for every Aetheric piece)', () => {
  const raiment = wyrd();
  assert.equal(batchRefusal('Wyrd Hood', 'aetheric', raiment), 'Wyrd Hood is Aetheric, and the Reforge never breaks it.');
  assert.equal(batchRefusal('Wyrd Hood', 'aetheric'), 'Wyrd Hood is Aetheric, and the Reforge never breaks it.');
  assert.equal(batchRefusal('Ruhn\'s Helm', 'aetheric', ware()), 'Ruhn\'s Helm is Aetheric - the Sigil Broker dismantles it, not the Reforge.');
});

/** The enhanced pack over the ground, on a fake page the test keeps up across awaits. */
async function withPack(items, fn, { before = null, loot = null } = {}) {
  _resetPrefsForTests();
  destroyEnhancedNotice();
  globalThis.location = { search: '?skin=enhanced' };
  const dom = fakeDom();
  const saved = { doc: globalThis.document, add: globalThis.addEventListener, rem: globalThis.removeEventListener, raf: globalThis.requestAnimationFrame };
  globalThis.document = dom.doc;
  globalThis.addEventListener = dom.win.addEventListener;
  globalThis.removeEventListener = dom.win.removeEventListener;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.innerWidth = dom.w; globalThis.innerHeight = dom.h;
  const docKeys = new Set();   // the fake document lays no listener: the question's keys are laid on it, so keep them here
  dom.doc.addEventListener = (type, fn) => { if (type === 'keydown') docKeys.add(fn); };
  dom.doc.removeEventListener = (type, fn) => { if (type === 'keydown') docKeys.delete(fn); };
  const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
  const host = dom.mk('div');
  dom.body.append(host);
  const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items, goldPieces: 10 };
  before?.(e);
  const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {}, ...(loot ? { loot } : {}) });
  let t = 0;
  try {
    const rowOf = (name) => host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(name)) ?? null;
    const actOf = (label) => host.querySelectorAll('.act').find((b) => b.textContent === label) ?? null;
    const open = (name) => {
      for (const tab of host.querySelectorAll('.packtab')) {
        tab.onclick();
        if (rowOf(name)) { rowOf(name).onclick({ timeStamp: (t += 5000), detail: 1 }); if (!actOf('Info')) rowOf(name).onclick({ timeStamp: (t += 5000), detail: 1 }); return; }
      }
      assert.fail(`${name} is on no page`);
    };
    const onAnyPage = (name) => host.querySelectorAll('.packtab').some((tab) => { tab.onclick(); return !!rowOf(name); });
    const dialog = () => dom.doc.querySelectorAll('.inv-destroy')[0] ?? null;
    const dialogAct = (label) => dialog()?.querySelectorAll('.act').find((b) => b.textContent === label) ?? null;
    const press = (b) => b.onclick({ timeStamp: (t += 5000), detail: 1, stopPropagation() {} });
    const key = (code) => { for (const fn of [...docKeys]) fn({ key: code.replace('Key', '').toLowerCase(), code, repeat: false, preventDefault() {}, stopPropagation() {} }); };
    return await fn({ dom, host, e, open, onAnyPage, actOf, dialog, dialogAct, press, key, said: () => textOf(dom.body) });
  } finally {
    view.unmount();
    globalThis.document = saved.doc; globalThis.addEventListener = saved.add; globalThis.removeEventListener = saved.rem; globalThis.requestAnimationFrame = saved.raf;
  }
}

test('BOUND-DESTROY the enhanced pack: the Raiment\'s card offers Destroy, which asks first - Keep keeps it, Destroy takes it out and the pack says so; a priced ware offers Dismantle and no Destroy; a stone, the Wallet and an unbound gem offer neither; a locked piece says why and asks nothing; a worn piece offers none (mutants: the card without Destroy; Destroy beside a paying Dismantle; the question skipped; the lock unsaid; the pages left stale)', async () => {
  const raiment = wyrd(), priced = ware(5), gem = ruby(), wallet = mintWallet(), stones = Object.assign(sigilStone(), { stackCount: 2 });   // slot 5: a name its row shows whole
  const name = itemLongName(raiment);
  await withPack([raiment, priced, gem, stones], ({ e, open, onAnyPage, actOf, dialog, dialogAct, press, said }) => {
    open(name);
    assert.ok(actOf('Destroy'), 'the card offers it');
    assert.equal(actOf('Dismantle'), null, 'the Broker never priced it');
    press(actOf('Destroy'));
    assert.ok(dialog(), 'and asks first');
    assert.equal(dialog().attrs.role, 'alertdialog');
    assert.ok(destroyAsk(name, 1).every((line) => said().includes(line)), 'the question and its warning');
    assert.equal(e.items.includes(raiment), true, 'nothing moves before the answer');
    press(dialogAct('Keep'));
    assert.equal(dialog(), null, 'Keep puts the question away');
    assert.ok(e.items.includes(raiment), 'and the piece stays');
    press(actOf('Destroy'));
    press(dialogAct('Destroy'));
    assert.equal(dialog(), null, 'the question goes with the answer');
    assert.equal(e.items.includes(raiment), false, 'the piece is gone');
    assert.ok(said().includes(destroyedText(name)), 'and the pack says so');
    assert.equal(onAnyPage(name), false, 'no page lists it');
    assert.deepEqual(e.items, [priced, gem, stones], 'nothing else moved');
    open(itemLongName(priced));
    assert.ok(actOf('Dismantle'), 'a priced ware: Dismantle');
    assert.equal(actOf('Destroy'), null, 'and no Destroy beside it');
    for (const it of [gem, stones]) {
      open(itemLongName(it));
      assert.equal(actOf('Destroy'), null, `${itemLongName(it)}: no Destroy`);
    }
  });
  await withPack([wallet], ({ open, actOf }) => {   // a wallet holds the pack's embers, so it stands on its own here
    open(itemLongName(wallet));
    assert.equal(actOf('Destroy'), null, 'the Wallet: no Destroy');
  });
  const locked = Object.assign(wyrd('wyrd-gloves'), { locked: true });
  await withPack([locked], ({ e, open, actOf, dialog, press, said }) => {
    open(itemLongName(locked));
    press(actOf('Destroy'));
    assert.equal(dialog(), null, 'a locked piece asks nothing');
    assert.ok(said().includes(lockedText(itemLongName(locked))), 'and says why');
    assert.ok(e.items.includes(locked));
  });
  const worn = wyrd('wyrd-boots');
  await withPack([worn], ({ host, actOf, press }) => {
    assert.equal(worn.equipSlot != null, true, 'worn');
    const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
    press(host.querySelectorAll('.wornrow').find((r) => r.onclick && textOf(r).includes(itemLongName(worn))));
    assert.ok(actOf('Take off'), 'its card is up, and takes it off');
    assert.equal(actOf('Destroy'), null, 'a worn piece: taken off first');
  }, { before: (e) => { equipItem(e, worn); } });
});

test('BOUND-DESTROY the enhanced pack: the keys answer as the dismantle\'s do - Y destroys, N keeps; a chest window\'s copy of the pack is refused before any question (mutants: the chest act let through)', async () => {
  const a = wyrd(), b = wyrd();
  await withPack([a, b], async ({ e, open, actOf, dialog, press, key }) => {
    open(itemLongName(a));
    press(actOf('Destroy'));
    await tick();   // the question's keys are laid a tick after it is asked
    key('KeyN');
    assert.equal(dialog(), null);
    assert.ok(e.items.includes(a), 'N keeps');
    press(actOf('Destroy'));
    await tick();
    key('KeyY');
    assert.equal(e.items.includes(a), false, 'Y destroys');
  });
  await withPack([b], ({ e, open, actOf, dialog, press, said }) => {
    open(itemLongName(b));
    press(actOf('Destroy'));
    assert.equal(dialog(), null, 'no question over a chest');
    assert.ok(said().includes(CHEST_ACT_REFUSAL.text), 'and the chest\'s words');
    assert.ok(e.items.includes(b));
  }, { loot: { items: () => [], storage: true, title: 'Chest', commit: async () => false, closed: () => {} } });   // a chest that settles its own pieces
});

test('BOUND-DESTROY the enhanced pack: a Hearth Offering\'s stack is let go through the account service, and the pack is the answer\'s (mutants: the face removed here alone; the count not the stack\'s)', async () => {
  const asked = [];
  const bowls = hearthOffering(3);
  try {
    await withPack([bowls], async ({ e, open, actOf, dialogAct, press, said }) => {
      setCountedDiscard(async (kind, n) => { asked.push([kind, n]); e.items.splice(e.items.indexOf(bowls), 1); return { ok: true, text: '' }; });
      open('Hearth Offering');
      assert.ok(actOf('Destroy'));
      press(actOf('Destroy'));
      assert.ok(destroyAsk('Hearth Offering', 3).every((line) => said().includes(line)), 'the whole stack, said');
      press(dialogAct('Destroy'));
      await tick();
      assert.deepEqual(asked, [['bowls', 3]]);
      assert.ok(said().includes(destroyedText('Hearth Offering')));
      assert.equal(e.items.some(isHearthOffering), false, 'the answer\'s restack');
    });
    await withPack([soulCakes(5)], async ({ e, open, actOf, dialogAct, press, said }) => {
      setCountedDiscard(async () => ({ ok: false, text: 'You hold fewer than that now.' }));
      open('Soul Cake');
      press(actOf('Destroy'));
      press(dialogAct('Destroy'));
      await tick();
      assert.ok(said().includes('You hold fewer than that now.'), 'the service\'s refusal, said');
      assert.equal(e.items.some(isSoulCake), true);
    });
  } finally { setCountedDiscard(discardFaces); }
});

test('BOUND-DESTROY the batch salvage\'s press names the piece: the Raiment is the Reforge\'s to refuse, the Regalia the Broker\'s to dismantle (mutants: the press names no piece)', async () => {
  const raiment = wyrd(), regalia = ware(5);
  assert.equal(regalia.rarity, 'aetheric');
  let seed = 7;
  const breaks = Object.assign(applyRarity(createWeapon(113, 1), 'rare', () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; }), { isIdentified: true });   // a piece that breaks, so the pack offers the batch
  await withPack([raiment, regalia, breaks], ({ host, actOf, press, said }) => {
    const rowOf = (item) => {
      for (const tab of host.querySelectorAll('.packtab')) { tab.onclick(); const r = host.querySelectorAll('.itemrow').find((x) => x._padItem === item); if (r) return r; }
      return null;
    };
    press(actOf(BATCH_LABEL));
    press(rowOf(raiment));
    assert.ok(said().includes(`${itemLongName(raiment)} is Aetheric, and the Reforge never breaks it.`));
    press(rowOf(regalia));
    assert.ok(said().includes(`${itemLongName(regalia)} is Aetheric - the Sigil Broker dismantles it, not the Reforge.`));
  }, { before: () => { setPref('lootRarity', true); } });
});

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const pageOf = (item) => ['weapons', 'magic', 'clothing', 'ingredients'].find((tb) => tabAccepts(item, tb));
/** The classic pack in Remove mode, `it` picked over the ground (or `loot`). */
function classicPick(it, { loot = null } = {}) {
  const bag = [it, ruby()];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: { items: bag, activeEffects: [] }, ...(loot ? { loot } : {}) });
  w.mode = 'remove';
  w.tab = pageOf(it);
  w._pick(w._filtered().indexOf(it));
  return { w, bag };
}

test('BOUND-DESTROY the classic pack: Remove over the ground offers a bound piece\'s destroy in DFU\'s own Yes/No box, beside its refusal - Yes destroys and says so, No keeps; a priced ware is offered its dismantle still; a chest and a stone get the plain refusal (mutants: the classic ground never offers it; the offer into a chest; the dismantle displaced)', async () => {
  const raiment = wyrd(), name = itemLongName(raiment);
  const yes = classicPick(raiment);
  assert.ok(yes.w.inputBox instanceof YesNoBoxWindow, 'the question');
  assert.deepEqual(yes.w.inputBox.rows.map((r) => r.text), [boundText(name), destroyInstead(1)]);
  assert.ok(yes.bag.includes(raiment), 'nothing moves before the answer');
  yes.w.input('KeyY');
  assert.equal(yes.w.inputBox, null);
  assert.equal(yes.bag.includes(raiment), false, 'Yes: destroyed');
  assert.deepEqual(yes.w.boxes, [{ rows: [{ text: destroyedText(name), center: true }] }]);
  const no = classicPick(wyrd());
  no.w.input('KeyN');
  assert.equal(no.w.inputBox, null);
  assert.equal(no.bag.length, 2, 'No: kept');
  const priced = ware(2);
  const pw = classicPick(priced);
  assert.deepEqual(pw.w.inputBox.rows.map((r) => r.text)[1], DISMANTLE_INSTEAD(dismantleStones(priced)), 'a priced ware: the dismantle');
  const chest = [];
  const inChest = classicPick(wyrd(), { loot: { items: () => chest, playerOwned: false, textureArchive: 380, textureRecord: 1 } });
  assert.equal(inChest.w.inputBox, null, 'into a chest: no offer');
  assert.deepEqual(inChest.w.boxes, [{ rows: [{ text: boundText(itemLongName(wyrd())), center: true }] }]);
  const stone = sigilStone();
  const st = classicPick(stone);
  assert.equal(st.w.inputBox, null, 'a stone: kept, the plain refusal');
  assert.deepEqual(st.w.boxes, [{ rows: [{ text: boundText(itemLongName(stone)), center: true }] }]);
  const wallet = mintWallet();
  const wl = classicPick(wallet);
  assert.equal(wl.w.inputBox, null, 'the Wallet: kept');
  assert.deepEqual(wl.w.boxes, [{ rows: [{ text: packOnlyText(itemLongName(wallet)), center: true }] }]);
  // a pack-only face over the ground: its own refusal and the offer; Yes asks the service, and says its answer
  const asked = [];
  try {
    setCountedDiscard(async (kind, n) => { asked.push([kind, n]); return { ok: true, text: '' }; });
    const bowls = hearthOffering(2);
    const face = classicPick(bowls);
    assert.deepEqual(face.w.inputBox.rows.map((r) => r.text), [packOnlyText(itemLongName(bowls)), destroyInstead(2)]);
    face.w.input('KeyY');
    await tick();
    assert.deepEqual(asked, [['bowls', 2]]);
    assert.deepEqual(face.w.boxes, [{ rows: [{ text: destroyedText(itemLongName(bowls)), center: true }] }]);
  } finally { setCountedDiscard(discardFaces); }
});

test('BOUND-DESTROY discardFaces: the service lets the count go and its answer restacks the pack; after the festival too; never offline or as a guest; a lost answer asks again by the same id, an answer or a final refusal lets the id go (mutants: the closed festival refused; the id fresh on a retry; the restack skipped; the id kept past an answer)', async () => {
  mock.timers.enable({ apis: ['Date'], now: FESTIVALS[0].toMs + 86_400_000 });
  try {
    const off = festivalPage([], { online: false });
    assert.deepEqual(await discardFaces('bowls', 1), { ok: false, text: festivalRefusalText('offline') });
    assert.deepEqual(off.asked, [], 'nothing asked offline');
    const g = festivalPage([]);
    seat('guest');
    assert.deepEqual(await discardFaces('bowls', 1), { ok: false, text: festivalRefusalText('guest') });
    assert.deepEqual(g.asked, []);
    // after the festival's days: asked, and the answer's counts are the pack
    const p = festivalPage([
      { ok: false, error: 'offline' },
      { ok: true, data: { cakes: 4, bowls: 0 } },
      { ok: false, error: 'count', cakes: 4, bowls: 1 },
      { ok: true, data: { cakes: 0, bowls: 1 } },
    ]);
    p.entity.items.push(hearthOffering(2), soulCakes(4));
    assert.equal((await discardFaces('bowls', 2)).ok, false, 'unheard');
    assert.equal(p.entity.items.filter(isHearthOffering)[0]?.stackCount, 2, 'an unheard answer moves nothing');
    assert.deepEqual(await discardFaces('bowls', 2), { ok: true, text: '' });
    assert.equal(p.asked[0][2], p.asked[1][2], 'the same ask again: the same request id - a lost answer never takes twice');
    assert.match(p.asked[0][2], /^[0-9a-f]{12}$/);
    assert.equal(p.entity.items.some(isHearthOffering), false, 'the answer restacked the pack: no bowls');
    assert.equal(p.entity.items.filter(isSoulCake)[0]?.stackCount, 4);
    assert.ok(p.saved.n >= 1, 'saved');
    assert.deepEqual(await discardFaces('bowls', 2), { ok: false, text: festivalRefusalText('count') });
    assert.notEqual(p.asked[2][2], p.asked[1][2], 'an answered ask let its id go');
    assert.equal(p.entity.items.filter(isHearthOffering)[0]?.stackCount, 1, 'a refusal\'s counts restack too');
    await discardFaces('cakes', 4);
    assert.notEqual(p.asked[3][2], p.asked[2][2], 'a final refusal let its id go');
    assert.deepEqual(p.asked.map(([k, n]) => [k, n]), [['bowls', 2], ['bowls', 2], ['bowls', 2], ['cakes', 4]]);
    assert.equal(p.entity.items.some(isSoulCake), false);
    assert.deepEqual(DISCARD_FINAL, ['rid', 'kind', 'count', 'guest']);
  } finally {
    mock.timers.reset();
    _resetFestivalClientForTests();
    delete globalThis.localStorage;
  }
});
