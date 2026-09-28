// SET7 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 7; Mac: "Sigil stones become a currency to
// trade for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate"): THE SIGIL BROKER'S LAW
// (systems/sigilBroker.js) - the day of the shared clock and when it turns; the day's stock, the same for every player
// and minted from fixed tables (a piece of each world set, a set weapon, a piece of the Regalia), every piece known,
// fresh, a valid loot item; the prices in Sigil Stones; what an offer asks and the sale it plans; and the one-a-day
// record in the character's save.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BROKER_DAY_MS, BROKER_PRICES, BROKER_LEGENDARY_IN, BROKER_ARMOR_PLACES, BROKER_SHIELDS, BROKER_WEAPONS,
  BROKER_ARMOR_MATERIALS, BROKER_WEAPON_MATERIALS, BROKER_SAVE_VENDOR, BROKER_REFUSALS, brokerDay, brokerTurnsIn, brokerStock,
  stonesIn, brokerOfferState, brokerSale, brokerBought, markBrokerBought, validBrokerRecord, offerSetName, _resetBrokerForTests,
  spendableStonesIn, lockedStonesIn, makeBrokerSale, stoneCount, stonesToTake,
} from '../src/systems/sigilBroker.js';
import { modSaveRecords, restoreModSaveRecords, newGameModSaveRecords } from '../src/systems/modSaveData.js';
import { sigilStone, SIGIL_STONE_TEMPLATE } from '../src/systems/gateSpoils.js';
import { validSigil, sigilHasBlow, SIGIL_BANDS } from '../src/systems/sigil.js';
import { WORLD_SET_IDS, setIdOf } from '../src/systems/sigilSets.js';
import { REGALIA } from '../src/systems/aetheric.js';
import { LEGENDARIES, registerLegendary } from '../src/systems/lootRarity.js';
import { validLootItem } from '../src/systems/loot.js';
import { isDeclaredItemField } from '../src/systems/itemFields.js';
import { isAmmunition, templateByIndex } from '../src/systems/itemTemplates.js';
import { withDom, fakeDom } from './invdrag.mjs';
import { mountBrokerWindow, brokerTurnText, stonesText, purseText, buyLabel, brokerSkinCss, scopeRules, BROKER_SKIN_STYLE_ID, BROKER_SOLD, BROKER_REPAINT_MS } from '../src/ui/brokerWindow.js';
import { setPref, _resetForTests as _resetPrefsForTests } from '../src/systems/uiPrefs.js';
import { createBrokerOverlay, brokerDoorOpen, closeBrokerDoor, repaintBrokerDoor } from '../src/ui/brokerDoor.js';
import { overlayOpen, clearOverlays } from '../src/ui/enhancedOverlays.js';
import { setLocked } from '../src/systems/itemLock.js';

const DAY = brokerDay(Date.parse('2026-09-27T12:00:00Z'));
/** SS1: a stack of `n` Sigil Stones - one record, as addItem makes it. */
const stack = (n) => Object.assign(sigilStone(), { stackCount: n });
/** SS1: a pack after a sale's take (`[{ item, count }]`): a stack it empties gone, one it draws on at what it keeps. */
const spend = (pack, take) => pack.flatMap((x) => {
  const t = take.find((e) => e.item === x);
  if (!t) return [x];
  const left = (x.stackCount ?? 1) - t.count;
  return left > 0 ? [Object.assign(x, { stackCount: left })] : [];
});

test('SET7 the day: the UTC day of the shared clock\'s time, turning at midnight UTC, and the milliseconds left in it (mutants: the day off the local clock\'s hours; the turn off by one)', () => {
  assert.equal(BROKER_DAY_MS, 86_400_000);
  assert.equal(brokerDay(Date.parse('2026-09-27T00:00:00Z')), brokerDay(Date.parse('2026-09-27T23:59:59.999Z')), 'one day, midnight to midnight UTC');
  assert.equal(brokerDay(Date.parse('2026-09-28T00:00:00Z')), brokerDay(Date.parse('2026-09-27T23:59:59.999Z')) + 1);
  assert.equal(brokerDay(0), 0);
  assert.equal(brokerTurnsIn(Date.parse('2026-09-27T23:00:00Z')), 3_600_000, 'an hour to midnight');
  assert.equal(brokerTurnsIn(Date.parse('2026-09-27T00:00:00Z')), BROKER_DAY_MS, 'a whole day at midnight');
  assert.equal(brokerTurnsIn(-1), 1, 'before the epoch too');
});

test('SET7 the stock: six offers the same for every call on a day and another the next - a piece of each world set (Malacath, Dagon, Nocturnal, Mora), a set weapon, a piece of the Regalia - each at its price, every item known, fresh at Faint, won in a fight of one, a valid loot item of declared fields, a set piece of its offer\'s set (mutants: a day\'s stock unlike itself; a set left out; a price off; an unknown piece; the Regalia at a world price)', () => {
  const a = brokerStock(DAY), b = brokerStock(DAY);
  assert.equal(a.length, 6);
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b), 'the day alone: every machine mints the same stock');
  assert.notEqual(a[0].item, b[0].item, 'a fresh item every call - nothing shared between buyers');
  assert.notEqual(JSON.stringify(brokerStock(DAY + 1).map((o) => o.item)), JSON.stringify(a.map((o) => o.item)), 'the next day, another');
  assert.deepEqual(a.map((o) => o.id), [0, 1, 2, 3, 4, 5].map((i) => `${DAY}:${i}`));
  assert.deepEqual(a.map((o) => o.slot), [0, 1, 2, 3, 4, 5]);
  assert.ok(a.every((o) => o.day === DAY));
  assert.deepEqual(a.slice(0, 4).map((o) => [o.kind, o.set]), WORLD_SET_IDS.map((s) => ['armour', s]));
  assert.equal(a[4].kind, 'weapon');
  assert.ok(WORLD_SET_IDS.includes(a[4].set));
  assert.deepEqual([a[5].kind, a[5].set, a[5].price], ['regalia', 'ruhn', BROKER_PRICES.regalia]);
  assert.deepEqual(BROKER_PRICES, { rare: 4, legendary: 6, weapon: 6, regalia: 12 }, 'SS2: twice SET7\'s 2 / 3 / 3 / 6');
  for (const o of a) {
    const it = o.item;
    assert.equal(it.isIdentified, true, `${o.id}: known`);
    assert.ok(validSigil(it.sigil) && it.sigil.xp === 0 && it.sigil.party === 1, `${o.id}: fresh, a fight of one`);
    assert.equal(setIdOf(it), o.set, `${o.id}: a piece of its offer's set`);
    assert.ok(validLootItem(it), `${o.id} is a valid loot item`);
    for (const k of Object.keys(it)) assert.ok(isDeclaredItemField(k), `${o.id}: '${k}' declared`);
    assert.ok(it.maxCondition > 0 && it.currentCondition === it.maxCondition, `${o.id}: whole`);
    assert.ok(templateByIndex(it.templateIndex));
    assert.equal(offerSetName(o).length > 0, true);
  }
  assert.equal(offerSetName(null), '');
});

test('SET7 the stock over a year of days: armour by place (a shield one place in eight), the finer makes, Rare or a Legendary one time in four off the BASE game\'s records alone, priced by its tier; the weapon never an arrow, Rare, its blow in the Rare band; every Regalia piece reachable (mutants: shields by template; a Legendary off a registered record; the weapon\'s blow off its band)', () => {
  let shields = 0, legendaries = 0, armour = 0;
  const regalia = new Set();
  const base = new Set(LEGENDARIES.map((l) => l.id));
  for (let d = DAY; d < DAY + 366; d++) {
    for (const o of brokerStock(d)) {
      const it = o.item;
      if (o.kind === 'armour') {
        armour++;
        assert.equal(it.group, 'Armor');
        assert.ok(BROKER_ARMOR_MATERIALS.includes(it.material), `a finer make: ${it.material}`);
        if (BROKER_SHIELDS.includes(it.templateIndex)) shields++;
        else assert.ok(BROKER_ARMOR_PLACES.includes(it.templateIndex));
        assert.ok(['rare', 'legendary'].includes(it.rarity));
        if (it.rarity === 'legendary') { legendaries++; assert.ok(base.has(it.legendary), `a base record: ${it.legendary}`); }
        assert.equal(o.price, it.rarity === 'legendary' ? BROKER_PRICES.legendary : BROKER_PRICES.rare);
        assert.equal(sigilHasBlow(it.sigil), false, 'armour: no blow');
      } else if (o.kind === 'weapon') {
        assert.equal(it.group, 'Weapons');
        assert.ok(!isAmmunition(it) && BROKER_WEAPONS.includes(it.templateIndex));
        assert.ok(BROKER_WEAPON_MATERIALS.includes(it.material));
        assert.equal(it.rarity, 'rare');
        assert.ok(it.sigil.power >= SIGIL_BANDS.rare[0] && it.sigil.power <= SIGIL_BANDS.rare[1], `the Rare band: ${it.sigil.power}`);
        assert.equal(o.price, BROKER_PRICES.weapon);
      } else {
        assert.equal(it.rarity, 'aetheric');
        regalia.add(it.aetheric);
      }
    }
  }
  assert.ok(Math.abs(shields / armour - 1 / 8) < 0.035, `a shield one place in eight (${shields} of ${armour})`);
  const fitting = legendaries / armour;
  assert.ok(fitting > 0.12 && fitting < 1 / BROKER_LEGENDARY_IN + 0.04, `a Legendary about one time in four where a record fits (${legendaries} of ${armour})`);
  assert.equal(regalia.size, REGALIA.length, 'every piece of the Regalia comes round');
  // a mod's own record, registered on THIS machine: the day's stock never draws it (another machine may not have it)
  const before = JSON.stringify(brokerStock(DAY + 7).map((o) => o.item));
  registerLegendary({ id: 'set7-probe-plate', name: 'A Machine\'s Own Plate', group: 'Armor', templates: [102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112],
    affixes: [{ id: 'armor', value: 12 }], enchantment: { type: 0, param: 0 }, lore: 'Registered here alone.' });
  for (let d = DAY; d < DAY + 60; d++) for (const o of brokerStock(d)) assert.notEqual(o.item.legendary, 'set7-probe-plate', `day ${d}: a registered record drawn`);
  assert.equal(JSON.stringify(brokerStock(DAY + 7).map((o) => o.item)), before, 'the stock is what it was before the registration');
});

test('SET7 what an offer asks: the stones counted over their stacks (SS1 - a stack counts whole), one of each a day, too few refused, another day\'s offer gone; the sale takes the first stones its price asks - a stack whole, then what the price still asks of the next - and gives the offer\'s piece minted again - the same piece, never the one the window shows (mutants: a bought offer sold again; a short purse served; the sale taking one stone too many; the sale handing over the shown piece itself; SS1: the purse counted by record; a stack taken whole)', () => {
  const [o] = brokerStock(DAY);
  const four = { ...o, price: 4 };
  const stone = () => sigilStone();
  assert.equal(stone().templateIndex, SIGIL_STONE_TEMPLATE);
  const purse = [stack(3), { name: 'Ruby', group: 'Gems', templateIndex: 0 }, stone(), stack(2)];
  assert.equal(stonesIn(purse).length, 3, 'three records');
  assert.equal(stoneCount(purse), 6, 'six stones: a stack counts whole');
  assert.equal(stoneCount([stone(), purse[1]]), 1, 'a record without a count is one stone');
  assert.deepEqual(stonesIn(null), []);
  assert.equal(stoneCount(null), 0);
  assert.deepEqual(brokerOfferState(four, { items: purse, bought: [], day: DAY }), { ok: true, reason: null, price: 4, have: 6 });
  assert.deepEqual(brokerOfferState(four, { items: purse, bought: [o.id], day: DAY }).reason, 'bought');
  assert.deepEqual(brokerOfferState(four, { items: [stack(3)], bought: [], day: DAY }).reason, 'stones', 'three stones: short');
  assert.equal(brokerOfferState(four, { items: purse, bought: [], day: DAY + 1 }).reason, 'gone');
  assert.equal(brokerOfferState(null, { items: purse }).reason, 'gone');
  assert.equal(brokerOfferState({ ...o, price: 6 }, { items: purse, day: DAY }).ok, true, 'exactly enough');
  assert.equal(brokerOfferState({ ...o, price: 7 }, { items: purse, day: DAY }).reason, 'stones', 'one short');
  const at = (take) => take.map((e) => [purse.indexOf(e.item), e.count]);
  assert.deepEqual(at(stonesToTake(purse, 4)), [[0, 3], [2, 1]], 'the first stones its price asks: the first stack whole, then one of the next record');
  assert.equal(stonesToTake(purse, 4).reduce((n, e) => n + e.count, 0), 4, 'the price, and not a stone more');
  assert.deepEqual(at(stonesToTake(purse, 2)), [[0, 2]], 'a price one stack covers draws on that stack alone');
  const sale = brokerSale(o, { items: purse, bought: [], day: DAY });
  assert.equal(sale.ok, true);
  assert.deepEqual(at(sale.take), at(stonesToTake(purse, o.price)), 'the sale takes what its own price asks');
  assert.deepEqual([purse[0].stackCount, purse[3].stackCount], [3, 2], 'a plan moves nothing');
  // AUDIT SS: the offer is the stock's own - a price, an id or a slot written by hand buys nothing
  for (const forged of [four.price === o.price ? { ...o, price: o.price - 1 } : four, { ...o, id: `${DAY}:9` }, { ...o, slot: 5 }]) {
    assert.deepEqual(brokerSale(forged, { items: purse, bought: [], day: DAY }), { ok: false, reason: 'gone' }, JSON.stringify({ id: forged.id, slot: forged.slot, price: forged.price }));
  }
  assert.notEqual(sale.give, o.item, 'a fresh mint: nothing the buyer does to theirs reaches back into the list');
  assert.deepEqual(sale.give, o.item, 'and the same piece');
  assert.deepEqual(brokerSale(o, { items: [], day: DAY }), { ok: false, reason: 'stones' });
  assert.deepEqual(Object.keys(BROKER_REFUSALS), ['bought', 'stones', 'gone', 'heavy']);
});

test('SET7 the one-a-day record rides the character\'s save: marked for its day, a new day starting a new record, written with the save and read back, a forged or broken record read as none, a new game starting clean (mutants: the record never saved; yesterday\'s marks kept; a forged record trusted)', () => {
  _resetBrokerForTests();
  const st = brokerStock(DAY);
  assert.deepEqual(brokerBought(DAY), []);
  markBrokerBought(st[0]); markBrokerBought(st[5]); markBrokerBought(st[0]);
  assert.deepEqual(brokerBought(DAY), [st[0].id, st[5].id], 'each once');
  assert.deepEqual(brokerBought(DAY + 1), [], 'another day\'s list is empty');
  const saved = modSaveRecords()[BROKER_SAVE_VENDOR];
  assert.deepEqual(saved, { day: DAY, ids: [st[0].id, st[5].id] }, 'the save writes it');
  markBrokerBought(brokerStock(DAY + 1)[2]);
  assert.deepEqual(brokerBought(DAY), [], 'a new day starts a new record');
  assert.deepEqual(brokerBought(DAY + 1), [`${DAY + 1}:2`]);
  restoreModSaveRecords({ [BROKER_SAVE_VENDOR]: saved });
  assert.deepEqual(brokerBought(DAY), [st[0].id, st[5].id], 'a load reads it back');
  restoreModSaveRecords({ [BROKER_SAVE_VENDOR]: { day: DAY, ids: ['<script>'] } });
  assert.deepEqual(brokerBought(DAY), [], 'a forged id: none');
  restoreModSaveRecords({ [BROKER_SAVE_VENDOR]: { day: DAY, ids: new Array(40).fill(`${DAY}:1`) } });
  assert.deepEqual(brokerBought(DAY), [], 'more ids than a day holds: none');
  restoreModSaveRecords({});
  assert.deepEqual(brokerBought(DAY), [], 'a save from before the Broker: none');
  restoreModSaveRecords({ [BROKER_SAVE_VENDOR]: saved });
  newGameModSaveRecords();
  assert.deepEqual(brokerBought(DAY), [], 'a new game starts clean');
  assert.deepEqual(validBrokerRecord({ day: 3, ids: ['3:1', '3:1', '3:4'] }), { day: 3, ids: ['3:1', '3:4'] });
  assert.deepEqual(validBrokerRecord({ day: 1.5, ids: [] }), { day: -1, ids: [] });
  assert.deepEqual(validBrokerRecord(null), { day: -1, ids: [] });
  _resetBrokerForTests();
});

test('SET7 the sale, made on a pack: the unlocked stones out (a locked stone is never spent - LOCK1), a fresh mint of the piece in, the offer marked; refused whole - nothing moved, nothing marked - when bought, short, gone or too heavy to carry, the carry gate asked of the pack as the stones leave it; SS1: over the stacks - a stack the price empties goes, one it draws on keeps the rest, and the carry gate weighs that rest (mutants: a locked stone spent; a heavy sale half made; a sale left unmarked; the carry gate asked of the pack with the stones still in it; SS1: the drawn stack left whole; the carry gate asked with the drawn stack whole; an emptied stack kept in the load)', () => {
  _resetBrokerForTests();
  const st = brokerStock(DAY);
  const o = st.find((x) => x.price === BROKER_PRICES.rare) ?? st[0];
  assert.equal(o.price, 4, 'a Rare set piece, at four');
  const locked = stack(2); setLocked(locked, true);
  const a = stack(3), b = stack(4), c = sigilStone();
  const ruby = { name: 'Ruby', group: 'Gems', templateIndex: 0 };
  assert.deepEqual(spendableStonesIn([locked, a, ruby]), [a]);
  assert.deepEqual(lockedStonesIn([locked, a, ruby]), [locked]);
  // too heavy: nothing moves, nothing is marked - and the gate was asked of the pack as the stones leave it: the first
  // stack (3) gone, one of the next (4) spent and three kept, the locked stack and the last stone untouched
  const pack = [locked, a, ruby, b, c];
  let seen = null;
  let r = makeBrokerSale(o, { items: pack, day: DAY, canCarry: (item, rest) => { seen = { item, rest: rest.map((x) => ({ ...x })) }; return false; } });
  assert.deepEqual(r, { ok: false, reason: 'heavy' });
  assert.deepEqual(pack, [locked, a, ruby, b, c], 'nothing moved');
  assert.deepEqual([locked.stackCount, a.stackCount, b.stackCount, c.stackCount ?? 1], [2, 3, 4, 1], 'not a stone of a stack spent');
  assert.deepEqual(brokerBought(DAY), [], 'nothing marked');
  assert.deepEqual(seen.rest, [{ ...locked }, { ...ruby }, { ...b, stackCount: 3 }, { ...c }], 'the pack as the stones leave it - the emptied stack out, the drawn one at what it keeps, the locked one in');
  assert.deepEqual(seen.item, o.item, 'the piece it asks about is the offer\'s');
  // made: the first unlocked stones its price asks, the piece in, marked
  r = makeBrokerSale(o, { items: pack, day: DAY });
  assert.equal(r.ok, true);
  assert.ok(!pack.includes(a), 'the stack the price emptied is gone');
  assert.equal(b.stackCount, 3, 'the stack it drew on keeps the rest');
  assert.ok(pack.includes(locked) && locked.stackCount === 2, 'the locked stack stays, whole');
  assert.equal(stoneCount(spendableStonesIn(pack)), 8 - o.price, 'the price, in stones');
  assert.ok(pack.includes(r.item) && r.item !== o.item, 'a fresh mint in the pack');
  assert.deepEqual(r.item, o.item);
  assert.deepEqual(brokerBought(DAY), [o.id], 'marked');
  // once a day
  const before = [...pack];
  assert.deepEqual(makeBrokerSale(o, { items: pack, day: DAY }), { ok: false, reason: 'bought' });
  assert.deepEqual(pack, before);
  // a purse of locked stones alone is no purse - twelve of them, the Regalia's price, and not one spendable
  const regalia = st[5];
  const allLocked = [stack(BROKER_PRICES.regalia)]; setLocked(allLocked[0], true);
  assert.deepEqual(makeBrokerSale(regalia, { items: allLocked, day: DAY }), { ok: false, reason: 'stones' });
  assert.equal(allLocked[0].stackCount, BROKER_PRICES.regalia);
  // another day's offer, or no pack at all
  assert.deepEqual(makeBrokerSale(regalia, { items: [stack(BROKER_PRICES.regalia)], day: DAY + 1 }), { ok: false, reason: 'gone' });
  assert.deepEqual(makeBrokerSale(regalia, { items: null, day: DAY }), { ok: false, reason: 'gone' });
  _resetBrokerForTests();
});

const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const key = (k) => ({ key: k, code: k, metaKey: false, ctrlKey: false, altKey: false, target: null, preventDefault() {}, stopPropagation() {} });

test('SET7 the window: the purse (and its locked stones) and the turn of the day in its header; the day\'s six offers - the piece in its tier\'s frame with its set\'s rune, its name, its set and tier, its price, a Buy that says why it cannot in a word that fits it (the whole reason in its title) - and the pressed offer shown whole beside them (its tier\'s lines, its sigil\'s block, its set\'s); a sale through the host re-draws the list and says so under the header, a refusal says why; the back key and Close leave through the door; unmounted, it leaves nothing behind (mutants: a refused offer\'s Buy pressable; the purse miscounted; the card of another offer; the host\'s refusal unsaid; a listener left on the window)', () => {
  assert.equal(brokerTurnText(5 * 3_600_000), '5h 00m');
  assert.equal(brokerTurnText(38 * 60_000 - 1), '38m');
  assert.equal(brokerTurnText(-5), '0m');
  assert.deepEqual([stonesText(1), stonesText(3)], ['1 Sigil Stone', '3 Sigil Stones']);
  assert.deepEqual([purseText(3), purseText(3, 1)], ['3 Sigil Stones', '3 Sigil Stones · 1 locked']);
  assert.equal(BROKER_REPAINT_MS, 30_000);
  assert.deepEqual([buyLabel({ ok: true }), buyLabel({ ok: false, reason: 'stones', price: 6, have: 1 }), buyLabel({ ok: false, reason: 'bought' }), buyLabel({ ok: false, reason: 'gone' })],
    ['Buy', 'Need 5 more', 'Bought', 'Gone'], 'the Buy\'s word fits the button');
  withDom((dom) => {
    const stock = brokerStock(DAY);
    const now = (DAY + 1) * BROKER_DAY_MS - 5 * 3_600_000;
    let purse = [stack(5), sigilStone(), sigilStone()];   // SS1: seven stones in three records
    const bought = [stock[1].id];
    let exits = 0;
    const sales = [];
    let refuseNext = null;
    const host = document.createElement('div');
    document.body.append(host);
    const view = mountBrokerWindow(host, {
      stock: () => stock, day: () => DAY, now: () => now, items: () => purse, bought: () => bought, locked: () => 1,
      buy: (o) => {
        if (refuseNext) { const r = refuseNext; refuseNext = null; return r; }
        const sale = brokerSale(o, { items: purse, bought, day: DAY });
        if (sale.ok) { purse = spend(purse, sale.take); bought.push(o.id); sales.push(o.id); }
        return sale;
      },
      picture: () => null, wearer: null, nameOf: (it) => it.name, onExit: () => { exits++; },
    });
    try {
      const shell = one(host, 'broker-shell');
      assert.ok(shell, 'the window stands in the door\'s host');
      assert.equal(shell.attrs.role, 'dialog');
      assert.equal(one(shell, 'broker-purse').textContent, '7 Sigil Stones · 1 locked', 'SS1: the purse counts its stacks whole');
      assert.equal(one(shell, 'broker-sub').textContent, 'Sigil Stones buy the day\'s stock · it turns in 5h 00m');
      const noteLine = one(shell, 'broker-note');
      assert.equal(noteLine.textContent, '', 'no word before a press');
      assert.equal(noteLine.attrs.hidden, '', 'and the line hidden');
      assert.equal(noteLine.attrs['aria-live'], 'polite', 'AUDIT U14: a live region standing the whole time, so a sale is heard');
      let rows = kids(shell, 'broker-offer');
      assert.equal(rows.length, 6);
      assert.deepEqual(rows.map((r) => r.dataset.slot), ['0', '1', '2', '3', '4', '5']);
      assert.equal(one(rows[0], 'broker-name').textContent, stock[0].item.name);
      assert.equal(one(rows[0], 'broker-set').textContent, `Malacath's Bulwark · ${stock[0].item.rarity === 'legendary' ? 'Legendary' : 'Rare'}`);
      assert.equal(one(rows[0], 'broker-price').textContent, stonesText(stock[0].price));
      assert.equal(one(rows[0], 'broker-frame').dataset.set, 'malacath', 'the set\'s rune');
      assert.equal(one(rows[0], 'broker-frame').dataset.rarity, stock[0].item.rarity);
      assert.equal(one(rows[0], 'tile').textContent.length, 2, 'no picture: its initials');
      const buys = rows.map((r) => one(r, 'broker-buy'));
      assert.equal(buys[1].textContent, 'Bought');
      assert.equal(buys[1].attrs.title, 'Bought today', 'the whole reason in its title');
      assert.equal(buys[1].attrs.disabled, '', 'a refused offer cannot be pressed');
      assert.ok(rows[1].classList.contains('no-bought'));
      assert.equal(buys[5].textContent, 'Need 5 more', 'the Regalia at twelve, a purse of seven');
      assert.equal(buys[5].attrs.title, 'Not enough Sigil Stones');
      assert.equal(buys[5].attrs.disabled, '');
      assert.equal(buys[0].attrs.title, undefined, 'a Buy that may be pressed needs no reason');
      assert.equal(buys[0].textContent, 'Buy');
      assert.equal(buys[0].attrs.disabled, undefined);
      assert.equal(buys[0].attrs.type, 'button');
      // the card: the first offer, whole
      let card = one(shell, 'broker-card');
      assert.equal(kids(card, 'setbox').length, 1, 'its set');
      assert.equal(kids(card, 'sigilbox').length, 1, 'its sigil');
      assert.equal(card.children.find((c) => c.tagName === 'H3').textContent, stock[0].item.name);
      // press the Regalia's row: its card
      rows[5].onclick();
      rows = kids(shell, 'broker-offer');
      card = one(shell, 'broker-card');
      assert.equal(card.children.find((c) => c.tagName === 'H3').textContent, stock[5].item.name);
      assert.ok(rows[5].classList.contains('on'));
      // the host refuses (the pack too full): the list stands, the word says why
      refuseNext = { ok: false, reason: 'heavy', text: 'You cannot carry any more stuff.' };
      one(rows[0], 'broker-buy').onclick({ stopPropagation() {} });
      assert.deepEqual(sales, []);
      assert.equal(one(shell, 'broker-note').textContent, 'You cannot carry any more stuff.');
      assert.ok(!one(shell, 'broker-note').classList.contains('ok'));
      // buy the first offer: the host's sale, the word, the list re-drawn
      rows = kids(shell, 'broker-offer');
      one(rows[0], 'broker-buy').onclick({ stopPropagation() {} });
      assert.deepEqual(sales, [stock[0].id]);
      assert.equal(one(shell, 'broker-note').textContent, BROKER_SOLD(stock[0].item.name, stock[0].price));
      assert.equal(one(shell, 'broker-note'), noteLine, 'the same line, said again');
      assert.equal(BROKER_SOLD('Ebony Cuirass', 2), 'Bought: Ebony Cuirass, for 2 Sigil Stones.');
      assert.equal(BROKER_SOLD('The Warden', 3), 'Bought: The Warden, for 3 Sigil Stones.', 'AUDIT U6: never "the The Warden"');
      assert.ok(one(shell, 'broker-note').classList.contains('ok'));
      rows = kids(shell, 'broker-offer');
      assert.equal(one(rows[0], 'broker-buy').textContent, 'Bought');
      assert.equal(one(shell, 'broker-purse').textContent, purseText(7 - stock[0].price, 1));
      assert.equal(one(shell, 'broker-card').children.find((c) => c.tagName === 'H3').textContent, stock[0].item.name, 'the pressed offer is the one shown');
      // the back key and Close leave through the door
      assert.equal(dom.win.count('keydown'), 1, 'the window owns the keyboard while it stands');
      dom.win.fire('keydown', key('a'));
      assert.equal(exits, 0, 'another key is not the way out');
      dom.win.fire('keydown', key('Escape'));
      assert.equal(exits, 1, 'the back key');
      one(shell, 'broker-close').onclick({ stopPropagation() {} });
      assert.equal(exits, 2, 'Close');
      view.repaint();
      assert.equal(kids(host, 'broker-offer').length, 6, 'a repaint draws the same list');
      // AUDIT U4: the window's bones stand through every repaint - the scroll container is the same one, its scroll kept
      const body = one(shell, 'broker-body');
      body.scrollTop = 520;
      rows = kids(shell, 'broker-offer');
      rows[3].onclick();
      view.repaint();
      assert.equal(one(shell, 'broker-body'), body, 'the same body after a press and a repaint');
      assert.equal(body.scrollTop, 520, 'its scroll kept');
      assert.equal(kids(shell, 'broker-card').length, 1, 'one card, the pressed one');
      assert.equal(one(shell, 'broker-card').children.find((c) => c.tagName === 'H3').textContent, stock[3].item.name);
      // AUDIT U10: a row is a control - the pad and the keyboard reach it
      rows = kids(shell, 'broker-offer');
      assert.equal(rows[2].attrs.role, 'button');
      assert.equal(rows[2].attrs.tabindex, '0');
      assert.equal(rows[3].attrs['aria-pressed'], 'true', 'the pressed row says so');
      assert.equal(rows[2].attrs['aria-pressed'], 'false');
      assert.match(rows[2].attrs['aria-label'], new RegExp(`^${stock[2].item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, .+, \\d+ Sigil Stones?$`));
      let prevented = 0;
      rows[2].onkeydown({ key: 'Enter', target: rows[2], preventDefault() { prevented++; } });
      assert.equal(prevented, 1);
      assert.equal(one(shell, 'broker-card').children.find((c) => c.tagName === 'H3').textContent, stock[2].item.name, 'Enter on a row shows it');
      rows = kids(shell, 'broker-offer');
      rows[4].onkeydown({ key: ' ', target: rows[4], preventDefault() {} });
      assert.equal(one(shell, 'broker-card').children.find((c) => c.tagName === 'H3').textContent, stock[4].item.name, 'and Space');
      rows = kids(shell, 'broker-offer');
      rows[1].onkeydown({ key: 'Enter', target: one(rows[1], 'broker-buy'), preventDefault() {} });
      assert.equal(one(shell, 'broker-card').children.find((c) => c.tagName === 'H3').textContent, stock[4].item.name, 'a key on the Buy inside is the Buy\'s, never the row\'s');
      // U14: the Buy says whose it is
      assert.equal(one(kids(shell, 'broker-offer')[1], 'broker-buy').attrs['aria-label'], `${stock[1].item.name}: Bought today`);
    } finally { view.unmount(); }
    assert.equal(one(host, 'broker-shell'), null, 'unmounted: gone from the page');
    assert.equal(dom.win.count('keydown'), 0, 'and its key listener with it');
    view.unmount();   // twice is once
    view.repaint();   // and a repaint after it draws nothing
    assert.equal(one(host, 'broker-shell'), null);
  });
});

test('SET7 AUDIT U1: on the classic skin the window lays its OWN sheet - its layout, the tiers\' colours under its shell, the sigil\'s and the set\'s blocks, the kit\'s rules cut to its own selectors (every rule valid) - once, and never a rule for another surface; on Enhanced Plus it lays none, the Plus sheet carrying all of it (mutants: no sheet on classic; the kit uncut; a sheet laid twice; the Plus page given a second sheet)', () => {
  // the cut: a list cut to what it keeps, an @media round what it keeps (and gone with nothing), an :is() whole, a comment gone
  assert.equal(scopeRules('/* c { } */ .a, .broker-x { c: 1 } @media (x) { .b { d: 2 } .broker-y:is(.p, .q) { e: 3 } } @media (y) { .z { f: 4 } } @keyframes k { from { o: 1 } }', (x) => x.includes('broker')),
    '.broker-x { c: 1 }\n@media (x) {\n.broker-y:is(.p, .q) { e: 3 }\n}\n@keyframes k { from { o: 1 } }\n');
  const sheet = brokerSkinCss();
  for (const want of ['.broker-shell [data-rarity="rare"]', '.broker-shell [data-rarity="aetheric"]', '.setbox {', '.sigilbox {', '.broker-offer {', 'body .broker-win', 'body .broker-shell .act', '@keyframes sigil-breathe']) {
    assert.ok(sheet.includes(want), `the sheet carries ${want}`);
  }
  for (const not of ['.itemrow', '.wornsock', '.dfpeer-card', '.hb-slot', '.hud-q', '.px-win', '.setstrip', '.setline', '.dragghost']) assert.ok(!sheet.includes(not), `and nothing for ${not}`);
  // every rule's subject is the window's, a block's, or nothing (`:not(*)`) - an ancestor such as `.pack-shell .card` may
  // scope a block's paragraph, never dress the pack itself
  const subjects = [...sheet.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].flatMap((m) => m[1].split(',')).map((x) => x.trim()).filter((x) => x && !x.startsWith('@') && !/^(from|to|\d+%)$/.test(x));
  const stray = subjects.filter((x) => !/(broker|setbox|\.set-|sigil|^:root$)/.test(x));
  assert.deepEqual(stray, [], 'a rule that stands outside the window and its blocks');
  assert.ok(!/(^|\n|,)\s*\{/.test(sheet), 'no rule without a selector');
  assert.ok(!/,\s*,/.test(sheet) && !/,\s*\{/.test(sheet), 'no selector list with a hole');
  const stock = brokerStock(DAY);
  const deps = { stock: () => stock, day: () => DAY, now: () => DAY * BROKER_DAY_MS, items: () => [], bought: () => [], buy: () => ({ ok: false, reason: 'stones' }), picture: () => null, nameOf: (it) => it.name };
  const sheets = (dom) => dom.doc.head.children.filter((c) => c.id === BROKER_SKIN_STYLE_ID);
  _resetPrefsForTests();
  try {
    setPref('skin', 'classic');
    withDom((dom) => {
      const host = document.createElement('div');
      const a = mountBrokerWindow(host, deps);
      assert.equal(sheets(dom).length, 1, 'classic: its own sheet');
      assert.equal(sheets(dom)[0].textContent, sheet);
      a.unmount();
      const b = mountBrokerWindow(host, deps);
      assert.equal(sheets(dom).length, 1, 'once');
      b.unmount();
    });
    setPref('skin', 'enhanced');
    withDom((dom) => {
      const v = mountBrokerWindow(document.createElement('div'), deps);
      assert.equal(sheets(dom).length, 0, 'Enhanced Plus: none - the Plus sheet carries it');
      v.unmount();
    });
  } finally { _resetPrefsForTests(); }
});

/** withDom for an async body: the fake document stands until the body's promise settles (withDom's own `finally` runs
 *  at its first await - a door's lazy chunk lands after that). */
async function withDomAsync(fn) {
  const dom = fakeDom();
  const saved = { doc: globalThis.document, hadDoc: 'document' in globalThis, add: globalThis.addEventListener, rem: globalThis.removeEventListener };
  globalThis.document = dom.doc;
  globalThis.addEventListener = dom.win.addEventListener;
  globalThis.removeEventListener = dom.win.removeEventListener;
  try { return await fn(dom); } finally {
    if (saved.hadDoc) globalThis.document = saved.doc; else delete globalThis.document;
    globalThis.addEventListener = saved.add;
    globalThis.removeEventListener = saved.rem;
  }
}
const until = async (ok, what) => { for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 5)); assert.ok(ok(), what); };

test('SET7 the door: the window a lazy chunk in a host of its own, the overlay\'s shape every host drives (done, dispose), on the overlay stack while it stands; the back key shuts it through the door - done, the host told, the page and the stack clean; the host\'s close answers whether one was up; one at a time; no document, no door (mutants: the stack left holding a shut window; the host never told; done read true while the window stands; a second door left standing under a new one)', async () => {
  assert.equal(createBrokerOverlay({}), null, 'no document: no door');
  await withDomAsync(async (dom) => {
    clearOverlays();
    const stock = brokerStock(DAY);
    let closed = 0;
    const deps = {
      stock: () => stock, day: () => DAY, now: () => DAY * BROKER_DAY_MS, items: () => [], bought: () => [],
      buy: () => ({ ok: false, reason: 'stones' }), picture: () => null, nameOf: (it) => it.name, onClose: () => { closed++; },
    };
    assert.equal(closeBrokerDoor(), false, 'nothing up: nothing shut');
    const w = createBrokerOverlay(deps);
    assert.ok(w && w.isChoiceWindow === true, 'the overlay\'s shape');
    for (const m of ['input', 'click', 'wheel', 'hover', 'tick', 'draw', 'dispose']) assert.equal(typeof w[m], 'function', m);
    assert.equal(w.done, false);
    assert.equal(brokerDoorOpen(), true);
    assert.equal(overlayOpen(), true, 'on the overlay stack');
    const host = dom.body.children.find((c) => c.attrs?.id === 'broker-host' || c.id === 'broker-host');
    assert.ok(host, 'its own host');
    await until(() => kids(host, 'broker-shell').length === 1, 'the chunk lands and mounts in the host');
    assert.equal(kids(host, 'broker-offer').length, 6);
    assert.equal(w.done, false, 'up, and not done');
    assert.equal(brokerDoorOpen(), true);
    repaintBrokerDoor();
    assert.equal(kids(host, 'broker-offer').length, 6);
    dom.win.fire('keydown', key('Escape'));
    assert.equal(w.done, true, 'the back key shuts it through the door');
    assert.equal(closed, 1, 'the host is told');
    assert.equal(brokerDoorOpen(), false);
    assert.equal(overlayOpen(), false, 'off the stack');
    assert.ok(!dom.body.children.includes(host), 'the host gone from the page');
    assert.equal(dom.win.count('keydown'), 0, 'no key listener left');
    w.dispose();
    assert.equal(closed, 1, 'a second close is no close');
    // one at a time, and the host's own close
    const a = createBrokerOverlay(deps);
    const b = createBrokerOverlay(deps);
    assert.equal(a.done, true, 'a new door shuts the one standing');
    assert.equal(b.done, false);
    await until(() => dom.body.children.filter((c) => c.id === 'broker-host').length === 1 && kids(dom.body, 'broker-shell').length === 1, 'one window');
    assert.equal(closeBrokerDoor(), true, 'the host\'s close: one was up');
    assert.equal(b.done, true);
    assert.equal(closed, 3);
    assert.equal(overlayOpen(), false);
    clearOverlays();
  });
});

test('SET7 x UI1 (AUDIT FINAL F4): an offer\'s picture is drawn for its WEARER, as the pack\'s and the shop\'s rows draw theirs - a cuirass on a female Argonian\'s screen is hers, never a Breton man\'s (mutant: the offer drawn for nobody)', async () => {
  const { inventoryItemImage } = await import('../src/systems/itemTemplates.js');
  const { iconName, _fittedKeys } = await import('../src/ui/textureCanvas.js');
  const DAY = 20000;
  const stock = brokerStock(DAY);
  const armour = stock.find((o) => o.item?.group === 'Armor' && inventoryItemImage(o.item)?.archive !== inventoryItemImage(o.item, { gender: 'female', race: 'Argonian' })?.archive);
  assert.ok(armour, 'a day\'s stock carries a piece drawn by race and gender');
  const her = { gender: 'female', race: 'Argonian' };
  const img = inventoryItemImage(armour.item, her), plain = inventoryItemImage(armour.item);
  withDom(() => {
    const host = document.createElement('div');
    document.body.append(host);
    const view = mountBrokerWindow(host, {
      stock: () => stock, day: () => DAY, now: () => DAY * BROKER_DAY_MS, items: () => [], bought: () => [], buy: () => ({ ok: false, reason: 'stones' }),
      wearer: her, nameOf: (it) => it.name,
    });
    try {
      const keys = _fittedKeys().map((k) => k.split('@')[0]);
      assert.ok(keys.includes(iconName(img.archive, img.record, img.dye, img.dyeTarget)), 'her picture asked');
      assert.ok(!keys.includes(iconName(plain.archive, plain.record, plain.dye, plain.dyeTarget)), 'never the default wearer\'s');
    } finally { view.unmount?.(); }
  });
});
