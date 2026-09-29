// REALM phase 0 (2026-09-28, Mac: "I wanna do this as comprehensively as possible. A true separation while allowing
// people to still play offline ... balance the gold economy, eliminate duping, eliminate true overpowered builds
// online"): the hotfixes that need no migration (bible/06-Systems/Realm-Arc.md, "Phases").
//   P0.1 - the URL's powers stay offline: an online boot drops ?shot (and window.__addGold with it), ?fly, ?nofoes and
//          the rest before anything reads them.
//   P0.2 - the balance mods are the room's whole online: every key of Meaner Monsters, PCAAO, Unleveled Loot,
//          Roleplay & Realism (its two cosmetic keys aside), RR: Items and Oblivion leveling's dials reads its shipped
//          default, where only their Enable switch was forced before.
//   P0.3 - the Empire is one lender: one loan a character online, a default anywhere shuts every branch, the Empire
//          takes from every account and every deposit, and a character joining with more debt than the Empire would
//          lend has the rest called in.
//   P0.4 - the faucets: a shop pays at most half what it asks online, a pile's gold is not the level's, the Sigil
//          Broker's stock is bound to its buyer, and a party's shared quest pays one gold reward in shares.
//   P0.5 - the character is saved as it plays online: every two real minutes, and at each change a trade makes to the
//          pack - the giver's loss on disk before the goods leave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ONLINE_REFUSED_FLAGS, refuseOnlinePowerFlags, ONLINE_WHOLE_MODS, ONLINE_ROOM_MOD_KEYS, onlineWholeModKey } from '../src/systems/onlineLane.js';
import { MOD_SETTINGS, modSetting, setModSetting, onlineModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { onlineSyncPlan } from '../src/systems/onlineSync.js';
import {
  TRANSACTION_RESULT as R, createBankAccounts, borrowDecision, borrowLoan, settleOverdueLoan, depositGold, depositAllLetters,
  empireRefusal, empireRefusalLines, callInEmpireDebt, empireCallInLines, calculateMaxBankLoan, LOAN_MAX_PER_LEVEL,
} from '../src/systems/banking.js';
import { empireJoin } from '../src/systems/worldTick.js';
import { deductGold, goldAmount } from '../src/systems/court.js';
import { letterOfCredit, LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';
import { BankWindow, BANK_RECTS, BANK_PANEL_X, BANK_PANEL_Y } from '../src/ui/bankWindow.js';
import { REGION_NAMES } from '../src/formats/mapsFile.js';
import { calculateTradePrice, ONLINE_SALE_SHARE } from '../src/systems/shopStock.js';
import { addPileLootExtras, unlevelPileGold } from '../src/systems/loot.js';
import { goldStack } from '../src/systems/inventory.js';
import { setLocked } from '../src/systems/itemLock.js';
import { isBound, boundRefusesPut, BOUND_KEEPS, BOUND_TRADE_TEXT } from '../src/systems/itemBound.js';
import { validItemField, isDeclaredItemField } from '../src/systems/itemFields.js';
import { brokerStock, makeBrokerSale, _resetBrokerForTests } from '../src/systems/sigilBroker.js';
import { sigilStone } from '../src/systems/gateSpoils.js';
import { shareQuestGold, GivePc } from '../src/systems/quest/actions.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { tradeRefusal, createTradePack } from '../src/systems/tradePack.js';
import { ONLINE_CHECKPOINT_MS, checkpointAllowed, checkpointDue, checkpointedTradePack } from '../src/systems/onlineCheckpoint.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** Runs `fn` as if the page were `search`, then restores the page. */
function onPage(search, fn) {
  const was = globalThis.location;
  globalThis.location = { search };
  try { return fn(); } finally { globalThis.location = was; }
}

test('REALM P0.1: an online boot drops every power flag before anything reads it - offline, F304 stands', () => {
  for (const f of ['shot', 'fly', 'nofoes', 'tp', 'timescale', 'class', 'spell', 'weapon', 'spawn', 'region', 'loc', 'tod', 'weather', 'wseed', 'season']) {
    assert.ok(ONLINE_REFUSED_FLAGS.includes(f), `?${f} is refused online`);
  }
  const all = ONLINE_REFUSED_FLAGS.map((f) => `${f}=1`).join('&');
  const online = new URLSearchParams(`online&load&world&${all}`);
  assert.deepEqual(refuseOnlinePowerFlags(online), [...ONLINE_REFUSED_FLAGS]);
  for (const f of ONLINE_REFUSED_FLAGS) assert.equal(online.has(f), false, `?${f} is gone`);
  assert.ok(online.has('online') && online.has('load') && online.has('world'), 'the doors the Online choice needs stand');
  const offline = new URLSearchParams(`load&world&${all}`);
  assert.deepEqual(refuseOnlinePowerFlags(offline), [], 'offline nothing is dropped');
  for (const f of ONLINE_REFUSED_FLAGS) assert.equal(offline.has(f), true, `?${f} stands offline`);
});

test('REALM P0.1 by source: the world host drops them beside the Test Room refusal - before the start location, the probe seams and the walk mode read them', () => {
  const w = src('src/scenes/world.js');
  const drop = w.indexOf('if (refuseOnlinePowerFlags(params).length) publishBootParams(params);');
  assert.ok(drop > 0, 'the drop is at the boot, and it is published');
  assert.ok(drop > w.indexOf("if (testRoomOffline) { params.delete('online'); publishBootParams(params); }"), 'after the Test Room refusal (which may take `online` itself away)');
  for (const reader of ["const regionName = params.get('region')", "const shotMode = params.has('shot');", "window.__addGold = (n) => addGold(playerEntity, n);"]) {
    const at = w.indexOf(reader);
    assert.ok(at > drop, `${reader} reads after the drop`);
  }
  assert.match(w, /if \(shotMode\) \{/, 'the probe seams stand only in ?shot - which an online page no longer has');
});

test('REALM P0.2: online, every key of a balance mod reads its shipped default - the room\'s own value first, its cosmetic keys still the player\'s', () => {
  let whole = 0;
  for (const [vendor, own] of Object.entries(ONLINE_WHOLE_MODS)) {
    assert.ok(MOD_SETTINGS[vendor], `${vendor} is a vendored mod`);
    for (const k of own) assert.ok(Object.hasOwn(MOD_SETTINGS[vendor].keys, k), `${vendor}/${k} is a real key`);
    for (const [key, def] of Object.entries(MOD_SETTINGS[vendor].keys)) {
      const room = ONLINE_ROOM_MOD_KEYS[vendor] && Object.hasOwn(ONLINE_ROOM_MOD_KEYS[vendor], key);
      const want = room ? ONLINE_ROOM_MOD_KEYS[vendor][key] : own.includes(key) ? undefined : def.default;
      assert.deepEqual(onlineModSetting(vendor, key, '?online=1'), want, `${vendor}/${key} online`);
      assert.equal(onlineModSetting(vendor, key, ''), undefined, `${vendor}/${key} offline is the player's`);
      if (!room && !own.includes(key)) whole++;
    }
  }
  assert.equal(whole, 48, 'forty-eight dials the room now owns beside the thirty-four it did');
  assert.equal(onlineWholeModKey('dynamic-skies', 'Enabled', '?online=1'), false, 'a looks mod is not the room\'s');
  assert.equal(onlineWholeModKey('roleplay-realism', 'variantNpcs', '?online=1'), false, 'who stands behind a counter is looks');
  assert.equal(onlineWholeModKey('oblivion-remaster-leveling', 'Enabled', '?online=1'), false, 'which leveling a character uses stays its own');
  assert.equal(onlineWholeModKey('oblivion-remaster-leveling', 'attributePoints', '?online=1'), true, 'the points a level are the room\'s');
});

test('REALM P0.2: the holes the research found are closed - Iron as Daedric, the strength bonus, the loan dial, sale prices and forty points a level', () => {
  _resetModSettings();
  try {
    setModSetting('unleveledLoot', 'Iron', 9);   // Iron -> Daedric: a 300-gold cuirass rolls as a 153,600-gold one
    setModSetting('pcaao', 'fixedStrengthDamageModifier', false);
    setModSetting('roleplay-realism', 'loanAmountPerLevel', 0);
    setModSetting('roleplay-realism-items', 'conditionBasedPrices', false);
    setModSetting('oblivion-remaster-leveling', 'attributePoints', 60);
    setModSetting('roleplay-realism', 'variantNpcs', false);
    onPage('', () => {
      assert.equal(modSetting('unleveledLoot', 'Iron'), 9, 'offline the player\'s own shelf stands');
      assert.equal(modSetting('oblivion-remaster-leveling', 'attributePoints'), 60);
    });
    onPage('?online=1', () => {
      assert.equal(modSetting('unleveledLoot', 'Iron'), MOD_SETTINGS.unleveledLoot.keys.Iron.default, 'Iron is Iron online');
      assert.equal(modSetting('pcaao', 'fixedStrengthDamageModifier'), true);
      assert.equal(modSetting('roleplay-realism', 'loanAmountPerLevel'), MOD_SETTINGS['roleplay-realism'].keys.loanAmountPerLevel.default, 'the loan dial EMPIRE-BANK reads');
      assert.equal(modSetting('roleplay-realism-items', 'conditionBasedPrices'), true);
      assert.equal(modSetting('oblivion-remaster-leveling', 'attributePoints'), 12, 'the mod\'s own twelve');
      assert.equal(modSetting('roleplay-realism', 'variantNpcs'), false, 'a cosmetic key stays the player\'s');
    });
  } finally { _resetModSettings(); }
});

test('REALM P0.2: the Mods pane locks a room dial as it locks a switch, with the balance reason, and the offline sync copies the dials home', () => {
  const menu = src('src/ui/enhancedMenu.js');
  assert.match(menu, /const ONLINE_BALANCE_NOTE = '[^']*one balance[^']*';/, 'the balance lock has its own words');
  assert.match(menu, /const modLockNote = \(vendor, key\) => \(!Object\.hasOwn\(ONLINE_ROOM_MOD_KEYS\[vendor\] \?\? \{\}, key\) && onlineWholeModKey\(vendor, key, undefined, \{ offline: true \}\) \? ONLINE_BALANCE_NOTE : onlineLockNote\(vendor, key\)\);/);
  assert.match(menu, /if \(\(isChoiceKey\(def\) \|\| isTextKey\(def\) \|\| isTupleKey\(def\) \|\| isFloatKey\(def\) \|\| isIntKey\(def\)\) && onlineModSetting\(vendor, key\) !== undefined\) lockDial\(ctl, modLockNote\(vendor, key\)\);/, 'a dial is locked too');
  assert.match(menu, /function lockDial\(ctl, note\) \{\s*for \(const b of ctl\.querySelectorAll\('button'\)\) \{ b\.disabled = true;/);
  _resetModSettings();
  try {
    setModSetting('unleveledLoot', 'Iron', 9);
    const plan = onPage('', () => onlineSyncPlan({ search: '' }));
    const row = plan.find((r) => r.id === 'mods:unleveledLoot/Iron');
    assert.ok(row, 'the sync names the dial');
    assert.equal(row.online, 0, 'the room\'s value is the shipped Iron');
    assert.equal(row.offline, 9);
    assert.equal(row.same, false);
    assert.ok(!plan.some((r) => r.id === 'mods:roleplay-realism/variantNpcs'), 'a cosmetic key is not the room\'s to copy');
  } finally { _resetModSettings(); }
});

/** Accounts with loans and balances set by region: `{ 3: { loanTotal, accountGold, hasDefaulted } }`. */
function bank(by, due = 500_000) {
  const accounts = createBankAccounts();
  for (const [r, v] of Object.entries(by)) Object.assign(accounts[r], { loanDueDate: v.loanTotal > 0 ? due : 0, ...v });
  return accounts;
}

test('REALM P0.3: online the Empire lends once - another branch\'s loan or default refuses here, in its own words naming the branch; offline each region is its own lender', () => {
  const loan = bank({ 3: { loanTotal: 11_000 } });
  assert.deepEqual(borrowDecision(loan, 17, { online: false }), { kind: 'input', transactionType: 'Borrowing_loan' }, 'offline region 17 lends');
  const d = borrowDecision(loan, 17, { online: true });
  assert.deepEqual(d, { kind: 'refuse', result: R.ALREADY_HAVE_LOAN, empireRegion: 3 });
  assert.deepEqual(empireRefusalLines(d, (i) => REGION_NAMES[i]), ['The Empire lends one loan at a time.', `Yours stands in ${REGION_NAMES[3]}.`]);
  assert.deepEqual(borrowDecision(loan, 3, { online: true }), { kind: 'refuse', result: R.ALREADY_HAVE_LOAN }, 'the loan\'s own branch answers as Daggerfall does');
  assert.equal(borrowLoan(loan, 17, 1_000, { level: 5, online: true }), R.ALREADY_HAVE_LOAN, 'the transaction refuses too, whatever asked');
  assert.equal(borrowLoan(loan, 17, 1_000, { level: 5, online: false }), R.NONE);
  // a default anywhere shuts every branch - even paid off, as Daggerfall's own flag never clears
  const defaulted = bank({ 5: { hasDefaulted: true } });
  const dd = borrowDecision(defaulted, 17, { online: true });
  assert.deepEqual(dd, { kind: 'refuse', result: R.ALREADY_DEFAULTED, empireRegion: 5 });
  assert.deepEqual(empireRefusalLines(dd, (i) => REGION_NAMES[i]), ['The Empire lends nothing to one', `who defaulted on it, in ${REGION_NAMES[5]}.`]);
  assert.equal(borrowLoan(defaulted, 17, 1_000, { level: 5, online: true }), R.ALREADY_DEFAULTED);
  assert.equal(empireRefusal(bank({ 5: { hasDefaulted: true }, 2: { loanTotal: 500 } })).result, R.ALREADY_DEFAULTED, 'a default outranks a loan');
  assert.equal(empireRefusal(createBankAccounts()), null, 'no loan, no default: the Empire lends');
});

test('REALM P0.3: online an overdue loan is paid from every branch before it defaults, and a defaulter\'s deposit is the Empire\'s - gold and letters; offline only the loan\'s own account pays', () => {
  const payer = { deductGold: () => 0 };
  const off = bank({ 3: { loanTotal: 11_000, accountGold: 1_000 }, 7: { accountGold: 4_000 }, 9: { accountGold: 10_000 } });
  assert.equal(settleOverdueLoan(off, 3, payer, { online: false }).kind, 'defaulted', 'offline: 1,000 paid, a default');
  assert.equal(off[7].accountGold, 4_000);
  const on = bank({ 3: { loanTotal: 11_000, accountGold: 1_000 }, 7: { accountGold: 4_000 }, 9: { accountGold: 10_000 } });
  assert.equal(settleOverdueLoan(on, 3, payer, { online: true }).kind, 'settled');
  assert.deepEqual([on[3].accountGold, on[7].accountGold, on[9].accountGold, on[3].loanTotal, on[3].loanDueDate], [0, 0, 4_000, 0, 0], 'own branch, then the rest in region order');

  const entity = { goldPieces: 10_000, items: [letterOfCredit(3_000)] };
  const purse = { gold: () => goldAmount(entity), deductGold: (n) => deductGold(entity, n), takeLetter: () => { const i = entity.items.findIndex((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE); return i < 0 ? null : entity.items.splice(i, 1)[0]; } };
  const garnished = bank({ 3: { loanTotal: 5_000, hasDefaulted: true } });
  assert.equal(depositGold(garnished, 17, 2_000, purse, { online: true }), R.NONE);
  assert.deepEqual([garnished[17].accountGold, garnished[3].loanTotal], [0, 3_000], 'the deposit paid the default');
  assert.equal(depositAllLetters(garnished, 17, purse, { online: true }), R.NONE);
  assert.deepEqual([garnished[17].accountGold, garnished[3].loanTotal, garnished[3].loanDueDate], [0, 0, 0], 'the letters paid the rest');
  assert.equal(depositGold(garnished, 17, 1_000, purse, { online: true }), R.NONE);
  assert.equal(garnished[17].accountGold, 1_000, 'a default paid off takes nothing more');
  const kept = bank({ 3: { loanTotal: 5_000, hasDefaulted: true } });
  depositGold(kept, 17, 2_000, purse, { online: false });
  assert.deepEqual([kept[17].accountGold, kept[3].loanTotal], [2_000, 5_000], 'offline the deposit is the account\'s');
  const standing = bank({ 3: { loanTotal: 5_000 } });
  depositGold(standing, 17, 2_000, purse, { online: true });
  assert.equal(standing[17].accountGold, 2_000, 'a loan not in default takes no deposit');
  const before = bank({ 3: { loanTotal: 5_000, hasDefaulted: true }, 17: { accountGold: 1_000 } });
  depositGold(before, 17, 500, purse, { online: true });
  assert.deepEqual([before[17].accountGold, before[3].loanTotal], [1_000, 4_500], 'the deposit is taken, not the balance before it (that is the sweep\'s)');
});

test('REALM P0.3: the bank window says the Empire\'s refusal and its garnish (mutants: Daggerfall\'s record for another branch; a silent garnish)', () => {
  const was = globalThis.location;
  globalThis.location = { search: '?online=1' };
  try {
    const entity = { level: 5, goldPieces: 5_000, items: [] };
    const accounts = bank({ 3: { loanTotal: 4_000, hasDefaulted: true } });
    const w = new BankWindow({
      accounts: () => accounts, regionIndex: () => 17, level: () => 5, now: () => 1_000,
      player: { gold: () => goldAmount(entity), totalGold: () => goldAmount(entity), deductGold: (n) => deductGold(entity, n), wagonGold: () => 0 },
      rows: (id) => [{ text: `#${id}`, center: true }],
    });
    const click = (key) => { const [x, y, rw, rh] = BANK_RECTS[key]; return w.click(BANK_PANEL_X + x + rw / 2, BANK_PANEL_Y + y + rh / 2); };
    click('loanBorrow');
    assert.deepEqual(w.box.rows.map((r) => r.text), ['The Empire lends nothing to one', `who defaulted on it, in ${REGION_NAMES[3]}.`]);
    w.input('Escape');
    click('depositGold');
    for (const ch of '3000') w.input(`char:${ch}`);
    w.input('Enter');
    assert.deepEqual(w.box?.rows.map((r) => r.text), ['The Empire takes', '3000 gold of it for your default.']);
    assert.deepEqual([accounts[17].accountGold, accounts[3].loanTotal, entity.goldPieces], [0, 1_000, 2_000]);
  } finally { globalThis.location = was; }
});

test('REALM P0.3: a character joining online has the debt past the Empire\'s one loan called in - accounts first, then the purse; unpaid, it defaults at once with the region\'s reputation; offline Daggerfall\'s debt stands', () => {
  // level 10: the Empire lends 50,000 and one loan may owe 55,000
  const cap = Math.floor(10 * LOAN_MAX_PER_LEVEL / 10);
  const paid = bank({ 3: { loanTotal: 22_000 }, 7: { loanTotal: 110_000, accountGold: 30_000 }, 9: { loanTotal: 5_500 }, 12: { accountGold: 40_000 } });
  const rich = { goldPieces: 20_000, items: [letterOfCredit(50_000)] };
  const call = callInEmpireDebt(paid, { deductGold: (n) => deductGold(rich, n) }, { cap, nowMinutes: 900_000 });
  assert.deepEqual(call, { called: 82_500, paid: 82_500, owed: 0, unpaid: [] }, 'the largest loan\'s excess and the other two whole');
  assert.deepEqual([paid[7].loanTotal, paid[7].loanDueDate, paid[3].loanTotal, paid[9].loanTotal, paid[3].loanDueDate], [55_000, 500_000, 0, 0, 0], 'one loan stands - the largest, at the Empire\'s most, due when it was');
  assert.deepEqual([paid[7].accountGold, paid[12].accountGold, rich.goldPieces, rich.items[0].value], [0, 0, 7_500, 50_000], 'its own account, the other branch, then coins before a letter');
  assert.deepEqual(empireCallInLines(call), ['The Empire calls in 82500 gold of your loans.', 'Your accounts and purse have paid it.']);
  assert.deepEqual(empireCallInLines(callInEmpireDebt(bank({ 3: { loanTotal: 55_000 } }), { deductGold: () => 0 }, { cap })), [], 'a loan the Empire would have made is not called');

  onPage('?online=1', () => {
    assert.equal(calculateMaxBankLoan(10), cap);
    // loans not yet due at the join (AUDIT REALM L3-F8: one already due is settled as overdue first - test/auditrealm.test.js)
    const entity = { level: 10, goldPieces: 1_000, items: [], bankAccounts: bank({ 3: { loanTotal: 22_000 }, 7: { loanTotal: 110_000, accountGold: 30_000 }, 9: { loanTotal: 5_500 }, 12: { accountGold: 40_000 } }, 1_000_000) };
    const said = [];
    const joined = empireJoin({ entity, nowMinutes: 900_000.7, say: (l) => said.push(l) });
    assert.deepEqual([joined.owed, joined.unpaid], [11_500, [3, 9]]);
    assert.equal(entity.goldPieces, 0, 'the purse paid what it had');
    assert.deepEqual([entity.bankAccounts[3].loanTotal, entity.bankAccounts[3].loanDueDate], [6_000, 900_000], 'what stands unpaid fell due now');
    for (const r of [3, 9]) {
      assert.equal(entity.bankAccounts[r].hasDefaulted, true, `region ${r} defaulted`);
      assert.ok(entity.legalRep[r] < 0, `region ${r}'s reputation fell`);
    }
    assert.equal(entity.bankAccounts[7].hasDefaulted, false, 'the loan the Empire keeps is in good standing');
    assert.deepEqual(said, ['The Empire calls in 82500 gold of your loans.', '11500 gold is unpaid: you are in default.']);
    assert.equal(borrowDecision(entity.bankAccounts, 20).result, R.ALREADY_DEFAULTED, 'and every branch is shut');
    assert.equal(empireJoin({ entity: { level: 1 }, nowMinutes: 0 }), null, 'a character with no accounts owes nothing');
  });
});

test('REALM P0.3 by source: the join calls the debt in after the markers are aligned to the world\'s clock', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /onlineArrival\(\); empireJoin\(\{ entity: playerEntity, nowMinutes: worldMinutes\(\), say: \(l, d\) => townTalk\.say\(l, d\) \}\);/);
  assert.ok(w.indexOf('empireJoin({') > w.indexOf('const onlineArrival = () => { alignEntityClocks(playerEntity, worldMinutes());'), 'the loan due dates ride the shift first');
});

test('REALM P0.4: online a shop pays at most half what it asks for the same piece - the buy-and-sell-back loop is shut; buying and offline selling are Daggerfall\'s', () => {
  assert.equal(ONLINE_SALE_SHARE, 0.5);
  const loop = { mercantile: 2, personality: 50 };
  const buy = calculateTradePrice(1_000, 1, loop, false, { online: false });
  assert.deepEqual([calculateTradePrice(1_000, 1, loop, true, { online: false }), buy], [488, 484], 'offline a quality-1 shop pays more than it asks');
  // MERC-RISE (Field-Bugs-2026-09-29d): the half is of the LEAST the counter asks - the best haggler's ask (100 in
  // each, or the seller's own past it) - so no skill lowers a sale; flipped from P0.4's half of the seller's own ask
  const best = (k) => ({ mercantile: Math.max(100, k.mercantile), personality: Math.max(100, k.personality) });
  assert.equal(calculateTradePrice(1_000, 1, loop, true, { online: true }), Math.floor(calculateTradePrice(1_000, 1, best(loop), false, { online: false }) / 2), 'online half of what the counter asks the best haggler');
  assert.ok(calculateTradePrice(1_000, 1, loop, true, { online: true }) <= buy / 2, 'and at most half of this seller\'s own ask');
  assert.equal(calculateTradePrice(1_000, 1, loop, false, { online: true }), buy, 'buying is untouched');
  for (const q of [1, 5, 10, 15, 20]) {
    for (const mercantile of [0, 25, 50, 100]) {
      for (const personality of [10, 50, 90]) {
        const k = { mercantile, personality };
        const off = calculateTradePrice(777, q, k, true, { online: false });
        const on = calculateTradePrice(777, q, k, true, { online: true });
        assert.equal(on, Math.min(off, Math.floor(calculateTradePrice(777, q, best(k), false, { online: false }) / 2)), `q${q} m${mercantile} p${personality}`);
        assert.ok(on <= Math.floor(calculateTradePrice(777, q, k, false, { online: false }) / 2), `the buy-back loop stays shut: q${q} m${mercantile} p${personality}`);
      }
    }
  }
  assert.equal(calculateTradePrice(1_000, 20, { mercantile: 0, personality: 10 }, true, { online: true }), calculateTradePrice(1_000, 20, { mercantile: 0, personality: 10 }, true, { online: false }), 'a sale under half stands');
});

test('REALM P0.4: online a pile\'s gold is divided back by the level, every key, never under one piece; offline it is the level\'s', () => {
  const pile = (n) => [goldStack(n), { group: 'Books', templateIndex: 277 }];
  assert.equal(addPileLootExtras(pile(30 * 37), 'A', undefined, { level: 30, online: true })[0].stackCount, 37, 'a key outside J-O too');
  assert.equal(addPileLootExtras(pile(30 * 37), 'A', undefined, { level: 30, online: false })[0].stackCount, 30 * 37);
  assert.equal(unlevelPileGold(pile(5), 30)[0].stackCount, 1, 'never under one');
  assert.equal(unlevelPileGold(pile(40), 0)[0].stackCount, 40, 'no level reads as one');
  assert.equal(unlevelPileGold(pile(40), 4)[1].stackCount, undefined, 'only gold');
  // every pile a host mints hands in the level
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/interiorContext.js', 'src/scenes/world.js']) {
    const calls = [...src(f).matchAll(/addPileLootExtras\(([^\n]*)/g)].map((m) => m[1]);
    assert.ok(calls.length >= 1, `${f} mints a pile`);
    for (const c of calls) assert.match(c, /\{ level(: playerEntity\.level)?(, where: '[a-z]+')? \}\)/, `${f}: ${c}`);   // THE MERGE: main's AUDIT OH-F B3 names the dungeon's own pile (`where`)
  }
});

test('REALM P0.4: the Sigil Broker\'s piece is bound to its buyer - SS4\'s binding (itemBound.js), one law since the merge: no trade, no ground, chest or tray; the wagon and the player\'s own storage still take it, and no unlock unbinds it', () => {
  _resetBrokerForTests();
  try {
    const DAY = 20_000;
    const [offer] = brokerStock(DAY);
    const pack = Array.from({ length: offer.price }, () => sigilStone());
    const sale = makeBrokerSale(offer, { items: pack, day: DAY });
    assert.equal(sale.ok, true);
    assert.equal(isBound(sale.item), true, 'bound as it is bought');
    assert.ok(pack.includes(sale.item));
  } finally { _resetBrokerForTests(); }
  const piece = { name: 'Ebony Cuirass', group: 'Armor', templateIndex: 102, bound: true };
  for (const kind of ['ground', 'container', 'reward']) assert.equal(boundRefusesPut(piece, kind), true, kind);
  for (const kind of BOUND_KEEPS) assert.equal(boundRefusesPut(piece, kind), false, `${kind} is its own place`);
  setLocked(piece, false);
  assert.equal(isBound(piece), true, 'unlocking does not unbind');
  assert.ok(isDeclaredItemField('bound') && validItemField('bound', true) === true, 'the field rides the save and the wire');
  // the trade pack's own law, behind the window's: a bound piece is never reserved for a peer
  assert.equal(tradeRefusal(piece), BOUND_TRADE_TEXT);
  const holder = { items: [piece], goldPieces: 0 };
  assert.equal(createTradePack(holder).take([{ item: piece, count: 1 }], 0), null);
  assert.deepEqual(holder.items, [piece], 'nothing left the pack');
});

test('REALM P0.4: a party\'s shared quest pays its gold in the party\'s shares, never under one piece, and says so; an item, a quest not shared and a lone player are paid whole', () => {
  const said = [];
  const quest = (shares) => ({ hooks: { rewardShares: () => shares, addHUDText: (t) => said.push(t) } });
  const gold = goldStack(1_000);
  assert.equal(shareQuestGold(quest(4), gold), true);
  assert.equal(gold.stackCount, 250);
  assert.deepEqual(said, ['Your share of the party\'s reward: 250 gold.']);
  const sword = { group: 'Weapons', templateIndex: 120, stackCount: 1 };
  assert.equal(shareQuestGold(quest(4), sword), false, 'an item is each partner\'s own');
  const alone = goldStack(1_000);
  assert.equal(shareQuestGold(quest(1), alone), false);
  assert.equal(alone.stackCount, 1_000);
  const crumbs = goldStack(3);
  shareQuestGold(quest(6), crumbs);
  assert.equal(crumbs.stackCount, 1, 'never under one piece');
  // the machine's shares: the party's size, for a quest kept in step with it
  const m = new QuestMachine({ partySize: () => 3 });
  const hooks = m._buildHooks();
  assert.equal(hooks.rewardShares({ questName: 'S0000999' }), 1, 'not shared: whole');
  m.markQuestShared('S0000999');
  assert.equal(hooks.rewardShares({ questName: 'S0000999' }), 3);
  assert.equal(new QuestMachine({})._buildHooks().rewardShares({ questName: 'S0000999' }), 1, 'no party: whole');
  // GivePc itself: the reward offered is the share
  const paid = [];
  const q = {
    hooks: { rewardShares: () => 2, addHUDText: () => {}, offerReward: (_q, it) => paid.push(it.stackCount), releaseQuestItem: () => {} },
    getItem: () => ({ daggerfallUnityItem: goldStack(1_000) }), showMessagePopup: () => {}, questSuccess: false,
  };
  const give = new GivePc(q);
  Object.assign(give, { itemSymbol: { name: '_reward_' }, textId: 0, silently: false, isNothing: false });
  give.update(null);
  assert.deepEqual(paid, [500], 'a party of two: half the purse');
  // by source: the host's party answers
  assert.match(src('src/scenes/world.js'), /partySize: \(\) => social\?\.party\?\.members\?\.length \?\? 1,/);
  assert.match(src('src/scenes/questBridge.js'), /partySize: \(\) => ctx\.partySize\?\.\(\) \?\? 1,/);
});

test('REALM P0.5: a checkpoint is written online, spawned, in the seat and out of a duel - every two real minutes', () => {
  assert.equal(ONLINE_CHECKPOINT_MS, 120_000);
  const ok = { online: true, spawned: true, seatOut: false, duel: false };
  assert.equal(checkpointAllowed(ok), true);
  assert.equal(checkpointAllowed({ ...ok, online: false }), false, 'offline: the player saves');
  assert.equal(checkpointAllowed({ ...ok, spawned: false }), false, 'no character yet');
  assert.equal(checkpointAllowed({ ...ok, seatOut: true }), false, 'a tab another took the seat from');
  assert.equal(checkpointAllowed({ ...ok, duel: true }), false, 'a duel\'s borrowed health is not the character\'s');
  assert.equal(checkpointAllowed(), false);
  assert.equal(checkpointDue(5, -Infinity), true, 'the first online frame');
  assert.equal(checkpointDue(1_000 + 119_999, 1_000), false);
  assert.equal(checkpointDue(1_000 + 120_000, 1_000), true);
  assert.equal(checkpointDue(Number.NaN, 0), false);
});

test('REALM P0.5: a trade\'s every change to the pack is checkpointed - the goods out before the commit frame is queued, back, and in; a refused take writes nothing', () => {
  const dagger = { name: 'Dagger', group: 'Weapons', templateIndex: 113, stackCount: 1 };
  const entity = { items: [dagger], goldPieces: 100 };
  const seen = [];
  const pack = checkpointedTradePack(createTradePack(entity), (why) => seen.push({ why, has: entity.items.includes(dagger), gold: entity.goldPieces }));
  const handle = pack.take([{ item: dagger, count: 1 }], 40);
  assert.ok(handle);
  assert.deepEqual(seen, [{ why: 'trade', has: false, gold: 60 }], 'written with the goods already out');
  pack.restore(handle);
  assert.deepEqual(seen[1], { why: 'trade', has: true, gold: 100 }, 'and with them back');
  pack.give([{ name: 'Ruby', group: 'Gems', templateIndex: 0 }], 5);
  assert.deepEqual([seen.length, seen[2].gold], [3, 105], 'and with the peer\'s in');
  assert.equal(pack.take([{ item: { name: 'Elsewhere' }, count: 1 }], 0), null);
  assert.equal(seen.length, 3, 'a refused take writes nothing');
  assert.equal(pack.gold(), 105, 'the rest of the pack passes through');
  assert.equal(pack.offerable(dagger), null);
  // the session queues its commit only after the take returns (net/tradeSession.js _maybeCommit)
  const ts = src('src/net/tradeSession.js');
  assert.ok(ts.indexOf('const handle = this.pack.take(this.mine.entries, this.mine.gold);') > 0);
  assert.ok(ts.indexOf('const handle = this.pack.take(this.mine.entries, this.mine.gold);') < ts.indexOf("this._enqueue({ k: 'commit'"), 'take, then the frame');
});

test('REALM P0.5 by source: the host checkpoints every slot the exit save writes, quietly, each online frame it is due and through the trade pack', () => {
  const w = src('src/scenes/world.js');
  const frame = w.slice(w.indexOf('const onlineFrame = (now, dt) => {'));
  assert.match(frame, /_rezSeen = null;[^\n]*\n\s*if \(checkpointDue\(now, _checkpointAt\)\) onlineCheckpoint\(\);/, 'each online frame, past the seat\'s and the dead\'s returns');
  assert.match(w, /const tradePack = checkpointedTradePack\(createTradePack\(playerEntity\), \(\) => onlineCheckpoint\(\)\);/);
  assert.match(w, /if \(!checkpointAllowed\(\{ online: !!online, spawned: playerSpawned, seatOut: seatOut\(\), duel: !!duelMgr\?\.duel \}\)\) return false;/);
  assert.match(w, /const names = exitAutosaveNames\(playerEntity, \{ deathUp: townTalk\.overlay instanceof DeathScreen \|\| !!modes\?\.deathUp\?\.\(\) \}\);\n\s*for \(const saveName of names\) \{\n\s*if \(modes\) modes\?\.quickSaveNow\(saveName, \{ quiet: true \}\);[^\n]*\n\s*else worldQuickSave\(saveName, \{ quiet: true \}\);/);
  // quiet: no shot and no "Game saved." - a failure still speaks
  assert.match(w, /if \(r\.ok && !quiet\) requestScreenshot\(r\.key\);\n\s*if \(!r\.ok \|\| !quiet\) townTalk\.say\(r\.ok \? 'Game saved\.' : 'Save failed/);
  assert.match(w, /quickSave: \(saveName, opts\) => worldQuickSave\(saveName, opts\),/);
  assert.match(src('src/scenes/worldModes.js'), /quickSaveNow: \(saveName, opts\) => \(mode === 'dungeon' \? dungeonCtx\?\.quickSave\(saveName, opts\) : host\.quickSave\?\.\(saveName, opts\)\),/);
  const d = src('src/scenes/dungeonContext.js');
  assert.match(d, /if \(isGateArena\(dfLocation\)\) \{ if \(!quiet\) hudText\.add\(COURT_TEXT\.noSave\); return false; \}/);
  assert.match(d, /if \(r\.ok && !quiet\) requestScreenshot\(r\.key\);\n\s*if \(r\.ok && !quiet\) hudText\.add\('Game saved\.'\);\n\s*else if \(!r\.ok\) hudText\.add\('Save failed/);
});
