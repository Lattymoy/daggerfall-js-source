// PORT4: THE PORTED WINDOWS - what each classic service window shows
// and does, in the enhanced skin (the mechanism is ui/enhancedPort.js).
//
// Each spec is `view(win) -> view model`, read off the LIVE classic
// window every frame. A button's act is, wherever the window has one,
// its own click(vx, vy) at the classic button's centre - the window's
// sound, guard and ordering all run - and otherwise the very method the
// classic hit-test calls (an item slot, a list row). Nothing here
// decides anything the classic window would not.
//
// ONLY WHAT HAS NO ENHANCED FACE. The windows the settings let a player
// choose classic for (the travel map and its popups) are not here.

import { isEnhancedPlus } from '../systems/uiSkin.js';   // PLUS1: the ported windows are Enhanced Plus's
import { isOnlinePage } from '../systems/onlineLane.js';   // EMPIRE-BANK
import { EMPIRE_BANK_OF } from '../world/buildingNames.js';
import { portWindow, centreOf } from './enhancedPort.js';
import { itemIconUrl, itemName, spellIconUrl, paintFrame } from './enhancedArt.js';
import { serviceLabel } from '../systems/guildServiceFlow.js';
import { GUILD_RECTS, PANEL_X as GUILD_X, PANEL_Y as GUILD_Y, REFORGE_ROW } from './guildServiceWindow.js';
import { COVEN_RECTS, COVEN_PANEL_X, COVEN_PANEL_Y } from './covenWindow.js';
import { BANK_RECTS, BANK_PANEL_X, BANK_PANEL_Y, MARKS_ENTRY } from './bankWindow.js';
import { MARKS_BANK, MARKS_COMBAT, marksText } from '../net/marksLaw.js';   // MARKS1: the Bank's Marks, online; SILVER-WAYS: the day's combat cap
import { TRANSACTION_TYPE, goldRegion, EMPIRE_ACCOUNT_REGION } from '../systems/banking.js';   // EMPIRE-ACCOUNT: online, the one account
import { REGION_NAMES } from '../formats/mapsFile.js';   // BANK-REGION: the account's region, by the index its row reads
import { PURCHASE_RECTS, PURCHASE_PANEL_X, PURCHASE_PANEL_Y } from './bankPurchaseWindow.js';
import { TRANSPORT_MODES } from '../systems/transport.js';
import { POTION_RECTS } from './potionMakerWindow.js';
import { ITEM_RECTS, TAB_PAGES } from './itemMakerWindow.js';
import { enchantmentName, enchantmentParams, enchantmentParamName, PARAM_NONE } from '../systems/enchantmentCatalogue.js';
import {
  SPELL_MAKER_RECTS, SPELL_MAKER_TIPS, EFFECT_NAME_PANELS, TARGET_BUTTONS, ELEMENT_BUTTONS,
  EDITOR_RECTS, SPINNER_UP, SPINNER_DOWN, spinnerPart,
} from './spellMakerWindow.js';
import { flagOfIndex, spinnerRange } from '../systems/spellMaker.js';   // HOLD-STEP: a typed value's range, said on its field
import { SPELLBOOK_RECTS, spellPointCost, spellEffects } from './spellbookWindow.js';   // SHOP-PLUS: the spell shop is the book in buy mode
import { effectWords, spellFrame } from './enhancedSpellbook.js';        // ...and says a spell in the enhanced book's own words
import { totalGoldAmount } from '../systems/court.js';
import { SPELL_ICON_COUNT } from './spellIcons.js';

/** Press the classic window at a rect's centre (panel-relative rects take their panel's origin). */
const at = (win, rect, ox = 0, oy = 0) => () => { const [x, y] = centreOf(rect, ox, oy); win.click(x, y); };

// ── GUILD ──────────────────────────────────────────────────────────
const guild = {
  kind: 'guild',
  view(w) {
    const member = !!w.hooks.member?.();
    const press = (r) => at(w, r, GUILD_X, GUILD_Y);
    return {
      title: w.hooks.title?.() ?? 'Guild Hall', sub: member ? 'Member' : 'Not a member', size: 'narrow',
      blocks: [{ type: 'actions', layout: 'column', items: [
        ...(member ? [] : [{ label: 'Join guild', act: press(GUILD_RECTS.join), primary: true }]),
        { label: 'Talk', act: press(GUILD_RECTS.talk) },
        { label: serviceLabel(w.hooks.service?.()) || 'Service', act: press(GUILD_RECTS.service), primary: member },
        ...(w.hooks.reforge ? [{ label: REFORGE_ROW, act: () => w._reforge() }] : []),   // LOOT9: the Mages Guild's Reforge, beside its Identify
      ] }],
      foot: [{ label: 'Exit', act: press(GUILD_RECTS.exit) }],
    };
  },
};

// ── COVEN ──────────────────────────────────────────────────────────
const coven = {
  kind: 'coven',
  view(w) {
    const press = (r) => at(w, r, COVEN_PANEL_X, COVEN_PANEL_Y);
    return {
      title: "Witches' Coven", sub: 'The daedra answer here', size: 'narrow',
      blocks: [{ type: 'actions', layout: 'column', items: [
        { label: 'Talk', act: press(COVEN_RECTS.talk) },
        { label: 'Summon daedra', act: press(COVEN_RECTS.summon), primary: true },
        { label: 'Quest', act: press(COVEN_RECTS.quest) },
      ] }],
      foot: [{ label: 'Exit', act: press(COVEN_RECTS.exit) }],
    };
  },
};

// ── BANK ───────────────────────────────────────────────────────────
const BANK_FIELD_LABEL = Object.freeze({
  [TRANSACTION_TYPE.Depositing_gold]: 'Amount to deposit',
  [TRANSACTION_TYPE.Withdrawing_gold]: 'Amount to withdraw',
  [TRANSACTION_TYPE.Withdrawing_Letter]: 'Letter of credit for',
  [TRANSACTION_TYPE.Repaying_loan]: 'Amount to repay',
  [TRANSACTION_TYPE.Borrowing_loan]: 'Amount to borrow',
  [MARKS_ENTRY]: 'Silver to sell',   // MARKS1
});
const bank = {
  kind: 'bank',
  view(w) {
    const press = (name) => at(w, BANK_RECTS[name], BANK_PANEL_X, BANK_PANEL_Y);
    const L = w.labels();
    const busy = w.transactionType !== TRANSACTION_TYPE.None;
    const btn = (name, label, extra = {}) => ({ label, act: press(name), disabled: busy || (w.enabled ? w.enabled(name) === false : false), ...extra });
    const city = w.hooks.cityName?.();
    // EMPIRE-BANK: online, every bank is the Empire's - the branch's town beneath it
    const empire = isOnlinePage();
    // BANK-REGION (FIELD BUGS 2026-09-30b, Guppy in #support: "is it normal when u become a werewolf you loose the gold
    // in your bank"): the Empire is one name and one lender, but a deposit stays in its region's account (systems/
    // banking.js, THE STORE IS PER REGION), and nothing online said so - the teller in another region read "Account
    // balance 0" under "Bank of the Empire". The row names the region whose account it is, and each other region that
    // holds gold stands beneath it (CreateBankingStatusBox's list, which only the classic sheet's gold button opens).
    // EMPIRE-ACCOUNT (2026-10-01): online every branch keeps ONE account, the Empire's - the row is that account, and
    // beneath it only a branch a character has not yet folded into it (banking.js foldEmpireAccounts, at its next boot)
    const here = REGION_NAMES[w.region];
    const gold = goldRegion(w.accounts ?? [], w.region), one = empire && gold === EMPIRE_ACCOUNT_REGION;
    const elsewhere = (w.accounts ?? []).flatMap((a, i) => (i !== gold && a?.accountGold > 0 ? [[`Banked in ${REGION_NAMES[i] ?? 'another region'}`, String(a.accountGold)]] : []));
    return {
      title: empire ? `Bank of ${EMPIRE_BANK_OF}` : city ? `Bank of ${city}` : 'The Bank', sub: (empire ? city || w.hooks.regionName?.() : w.hooks.regionName?.()) ?? '', size: 'medium',
      blocks: [
        { type: 'stats', items: [
          [one ? 'Empire account' : here ? `Account in ${here}` : 'Account balance', L.account], ...elsewhere, ['Gold carried', L.inventory],
          ['Loan owed', L.loanDue, Number(L.loanDue) > 0 ? 'warn' : ''], [empire ? 'Loan due' : 'Loan due by', L.loanByFull ?? L.loanBy],   // AUDIT LIVED1b U4 (O1): AUDIT LIVED1 S's "Loan due" is the online row's (a time left, not a date) - offline the row reads a date, as it always did
        ] },
        { type: 'cols', cols: [
          [{ type: 'group', title: 'Gold', blocks: [{ type: 'actions', layout: 'column', items: [
            btn('depositGold', 'Deposit gold'), btn('withdrawGold', 'Withdraw gold'),
            btn('depositLetters', 'Deposit letters'), btn('withdrawLetter', 'Letter of credit'),
          ] }] }],
          [{ type: 'group', title: 'Loans & property', blocks: [{ type: 'actions', layout: 'column', items: [
            btn('loanRepay', 'Repay loan'), btn('loanBorrow', 'Borrow'),
            btn('buyHouse', 'Buy house'), btn('sellHouse', 'Sell house'),
            btn('buyShip', 'Buy ship'), btn('sellShip', 'Sell ship'),
          ] }] }],
        ] },
        // MARKS1 (PROF0 10.5): online, the Bank of the Empire buys Marks - 8 gold each, 300 a day, paid into this account
        w.hooks.marks && w.hooks.marks.open() === true ? { type: 'group', title: 'Silver', blocks: [
          { type: 'stats', items: [
            ['Silver held', marksText(w.hooks.marks.balance() ?? 0)],
            ['Sold today', `${(w.hooks.marks.today()?.exchanged ?? 0)} of ${MARKS_BANK.perDay}`],
            ['From gates and raids today', `${(w.hooks.marks.today()?.combat ?? 0)} of ${w.hooks.marks.today()?.combatMax ?? MARKS_COMBAT.perDay}`],   // SILVER-WAYS
            ['The Bank pays', `${MARKS_BANK.goldPerMark} gold for each silver`],
          ] },
          { type: 'actions', layout: 'column', items: [
            { label: w.hooks.marks.pending() ? 'Counting a sale...' : 'Sell silver', act: () => w._button('sellMarks'), disabled: !w.enabled('sellMarks') },
          ] },
        ] } : null,
        busy ? { type: 'field', label: BANK_FIELD_LABEL[w.transactionType] ?? 'Amount', value: w.value, active: true } : null,
      ],
      foot: busy
        ? [{ label: 'Confirm', key: 'Enter', primary: true, act: () => w.input('Enter') },
          { label: 'Cancel', act: () => { w.transactionType = TRANSACTION_TYPE.None; w.value = ''; } }]   // DROPS-AUDIT F8: no 'Esc' chip - Escape closes the bank, it does not cancel the entry
        : [{ label: 'Exit', act: press('exit') }],
    };
  },
};

// ── HOUSES AND SHIPS FOR SALE ──────────────────────────────────────
const bankPurchase = {
  kind: 'bankpurchase',
  view(w) {
    const press = (r) => at(w, r, PURCHASE_PANEL_X, PURCHASE_PANEL_Y);
    const items = w.items();
    return {
      title: w.isShips ? 'Ships for sale' : 'Houses for sale', size: 'narrow',
      blocks: [{ type: 'rows', key: 'sale', maxHeight: 320, empty: 'Nothing is for sale here.',
        items: items.map((it, i) => ({ label: w.priceText(it), on: i === w.selected, act: () => { w.selected = i; } })) }],
      foot: [
        { label: 'Buy', key: 'B', primary: true, disabled: w.selected < 0, act: press(PURCHASE_RECTS.buy) },
        { label: 'Exit', act: press(PURCHASE_RECTS.exit) },
      ],
    };
  },
};

// ── TRANSPORT ──────────────────────────────────────────────────────
const transport = {
  kind: 'transport',
  view(w) {
    const pick = (mode) => () => w._pick(mode);
    return {
      title: 'Transport', sub: 'How will you travel?', size: 'narrow',
      blocks: [{ type: 'actions', layout: 'column', items: [
        { label: 'On foot', act: pick(TRANSPORT_MODES.Foot) },
        { label: 'Horse', act: pick(TRANSPORT_MODES.Horse), disabled: !w.enabled.horse, title: w.enabled.horse ? '' : 'You own no horse' },
        { label: 'Cart', act: pick(TRANSPORT_MODES.Cart), disabled: !w.enabled.cart, title: w.enabled.cart ? '' : 'You own no cart' },
        { label: 'Ship', act: pick(TRANSPORT_MODES.Ship), disabled: !w.enabled.ship, title: w.enabled.ship ? '' : 'No ship is at hand' },
      ] }],
      foot: [{ label: 'Exit', act: () => w.input('Escape') }],
    };
  },
};

// ── THE SUMMONED DAEDRA ────────────────────────────────────────────
const daedra = {
  kind: 'daedra',
  view(w) {
    const asking = w.lastChunk && !w.answerGiven;
    const last = w.lastChunk && w.answerGiven;
    return {
      title: w.hooks.daedraName?.() ?? 'A daedra answers', size: 'wide',
      blocks: [
        { type: 'canvas', paint: (cv) => paintFrame(cv, w.player?.frame) },
        { type: 'text', center: true, rows: w.chunk ?? [] },
      ],
      foot: asking
        ? [{ label: 'Accept', key: 'Y', primary: true, act: () => w.input('KeyY') }, { label: 'Refuse', key: 'N', act: () => w.input('KeyN') }]
        : [{ label: last ? 'Close' : 'Continue', primary: true, act: () => w.click(0, 0) }],
    };
  },
};

// ── THE POTION MAKER ───────────────────────────────────────────────
const tile = (item, act, extra = {}) => ({
  label: itemName(item), icon: itemIconUrl(item), badge: (item?.stackCount ?? 1) > 1 ? item.stackCount : '', act, ...extra,
});
const potionMaker = {
  kind: 'potion',
  view(w) {
    const pot = w.cauldron ?? [];
    const cauldron = pot.map((it, i) => tile(it, () => w._removeFromCauldron(i), { sub: 'Take out' }));
    return {
      title: 'Potion Maker', sub: w.nameLabel ? `Recipe: ${w.nameLabel}` : 'Choose ingredients, or a known recipe', size: 'wide',
      blocks: [
        { type: 'stats', items: [['Gold', String(w.hooks.gold?.() ?? 0)], ['In the cauldron', `${pot.length} / 8`]] },
        { type: 'cols', template: 'minmax(0, 3fr) minmax(0, 2fr)', cols: [
          [{ type: 'tiles', title: 'Your ingredients', key: 'ingr', maxHeight: 300, empty: 'You carry no ingredients.',
            items: w.ingredients().map((it) => tile(it, () => w._addToCauldron(it), { disabled: pot.length >= 8 })) }],
          [{ type: 'tiles', title: 'Cauldron', key: 'pot', maxHeight: 300, empty: 'The cauldron is empty.', items: cauldron },
            { type: 'actions', layout: 'row', items: [
              { label: 'Recipes', key: 'R', act: at(w, POTION_RECTS.recipes) },
              { label: 'Mix', key: 'M', primary: true, disabled: !pot.length, act: at(w, POTION_RECTS.mix) },
            ] }],
        ] },
      ],
      foot: [{ label: 'Exit', act: at(w, POTION_RECTS.exit) }],
    };
  },
};

// ── THE ITEM ENCHANTER ─────────────────────────────────────────────
const TAB_WORDS = Object.freeze({ WeaponsAndArmor: 'Weapons & armor', MagicItems: 'Magic items', ClothingAndMisc: 'Clothing & misc', Ingredients: 'Ingredients' });
const enchantRows = (w, list) => list.map((e) => {
  const secondary = enchantmentParams(e.type).length > 0 && e.param !== PARAM_NONE ? enchantmentParamName(e.type, e.param) : '';
  const forced = (e.parentEnchantment ?? 0) !== 0;
  const kept = e.kept === true;   // AUDIT PROF-541 J3: a crafted piece's own row (itemMakerWindow.js _lists) - shown, costed, never removed
  return { label: enchantmentName(e.type), sub: secondary, muted: forced || kept, hint: kept ? 'The piece\'s own' : forced ? 'Added with its power' : 'Remove',
    act: forced || kept ? null : () => w._removeRow(e) };
});
const itemMaker = {
  kind: 'itemmaker',
  view(w) {
    const L = w.labels();
    const sel = w.selected;
    const shown = w._lists();   // AUDIT PROF-541 J3: the lists as the classic window draws them - a crafted piece's kept rows at their head
    return {
      title: 'Item Enchanter', sub: sel ? `Enchanting ${w.itemName || itemName(sel)}` : 'Choose an item to enchant', size: 'wide',
      blocks: [
        { type: 'stats', items: [['Gold', L.availableGold], ['Gold cost', L.goldCost], ['Enchantment points', L.enchantmentCost]] },
        { type: 'cols', template: 'minmax(0, 5fr) minmax(0, 6fr)', cols: [
          [{ type: 'chips', items: TAB_PAGES.map((t, i) => ({ label: TAB_WORDS[t] ?? t, on: w.tab === t,
            act: at(w, ITEM_RECTS[['weaponsAndArmor', 'magicItems', 'clothingAndMisc', 'ingredients'][i]]) })) },
          { type: 'tiles', key: 'items', maxHeight: 300, empty: 'Nothing of that kind in your pack.',
            items: w.items().map((it) => tile(it, () => w._selectItem(it), { on: it === sel })) }],
          [{ type: 'group', cls: 'port-card', blocks: [
            sel ? { type: 'tiles', list: true, key: 'sel', items: [tile(sel, () => w._deselect(), { sub: 'Put it back' })] }
              : { type: 'text', center: true, rows: ['No item chosen.'] },
            { type: 'field', label: 'Name', value: w.itemName, placeholder: sel ? itemName(sel) : '', button: { label: 'Rename', disabled: !sel, act: at(w, ITEM_RECTS.nameItem) } },
          ] },
          { type: 'cols', cols: [
            [{ type: 'rows', title: 'Powers', key: 'pow', maxHeight: 170, empty: 'No powers yet.', items: enchantRows(w, shown.powers) },
              { type: 'actions', layout: 'row', items: [{ label: 'Add power', act: at(w, ITEM_RECTS.powersButton), disabled: !sel }] }],
            [{ type: 'rows', title: 'Side effects', key: 'side', maxHeight: 170, empty: 'No side effects.', items: enchantRows(w, shown.sideEffects) },
              { type: 'actions', layout: 'row', items: [{ label: 'Add side effect', act: at(w, ITEM_RECTS.sideEffectsButton), disabled: !sel }] }],
          ] }],
        ] },
      ],
      foot: [
        { label: 'Enchant', primary: true, disabled: !sel, act: at(w, ITEM_RECTS.enchant) },
        { label: 'Exit', act: at(w, ITEM_RECTS.exit) },
      ],
    };
  },
};

// ── THE SPELL MAKER ────────────────────────────────────────────────
const EDITOR_ROWS = Object.freeze([
  ['Duration', [['durationBase', 'Base'], ['durationMod', 'Plus'], ['durationPerLevel', 'Per level']]],
  ['Chance', [['chanceBase', 'Base'], ['chanceMod', 'Plus'], ['chancePerLevel', 'Per level']]],
  ['Magnitude', [['magnitudeBaseLow', 'Base min'], ['magnitudeBaseHigh', 'Base max'], ['magnitudeLevelBase', 'Plus min'],
    ['magnitudeLevelHigh', 'Plus max'], ['magnitudePerLevel', 'Per level']]],
]);
function spellEditorView(w) {
  const ed = w.editor;
  const slot = ed.deps.slot;
  // AUDIT 27h H1: an act of an editor since shut does nothing - its +/- click the classic window at fixed points, and
  // with the editor gone those points are the main window's (Buy spell, Add effect, a slot)
  const live = (fn) => (...a) => (w.editor === ed ? fn(...a) : undefined);
  const spin = (field, label) => ({ type: 'spinner', label, value: slot?.settings?.[field] ?? 0, disabled: !ed.enabled(field),
    down: live(at(w, spinnerPart(EDITOR_RECTS[field], SPINNER_DOWN))), up: live(at(w, spinnerPart(EDITOR_RECTS[field], SPINNER_UP))),
    // HOLD-STEP (Tabitha on Discord: "add a field to type in the value"): the value typed, by the step's own law
    set: live((v) => ed.setValue(field, v)), min: spinnerRange(field, slot?.key)?.[0], max: spinnerRange(field, slot?.key)?.[1] });   // ABSORB-NERF: the effect's own range
  return {
    title: ed.deps.effect?.name ?? 'Effect', sub: 'Effect settings', size: 'medium',
    blocks: [
      { type: 'text', rows: ed.descriptionRows().map((r) => (typeof r === 'string' ? r : r?.text ?? '')) },
      ...EDITOR_ROWS.map(([title, fields]) => ({ type: 'group', title, cls: 'port-spins', blocks: fields.map(([f, l]) => spin(f, l)) })),
      { type: 'stats', items: [['Spell point cost', String(ed.cost())]] },
    ],
    foot: [{ label: 'Done', primary: true, act: at(w, EDITOR_RECTS.exit) }],
  };
}
function iconPickerView(w) {
  const p = w.picker;
  const choose = (i) => () => { p.selectedIcon = { key: null, index: i }; p._close(); };
  return {
    title: 'Choose an icon', size: 'medium',
    blocks: [{ type: 'iconGrid', key: 'icons', items: Array.from({ length: SPELL_ICON_COUNT }, (_, i) => ({
      icon: spellIconUrl(i), label: String(i + 1), on: i === w.icon, act: choose(i), title: `Icon ${i + 1}` })) }],
    foot: [{ label: 'Cancel', key: 'Esc', act: () => p.cancel() }],
  };
}
const spellMaker = {
  kind: 'spellmaker',
  view(w) {
    if (w.editor) return spellEditorView(w);
    if (w.picker && w.picker === w.iconPicker) return iconPickerView(w);
    const L = w.labels();
    const R = SPELL_MAKER_RECTS;
    const slots = [0, 1, 2].map((i) => {
      const eff = w.effectOf(w.slots[i]);
      return { label: eff ? eff.name : 'Empty slot', sub: eff ? 'Edit or remove' : '', muted: !eff,
        act: eff ? at(w, EFFECT_NAME_PANELS[i]) : null };
    });
    const full = w.firstFreeSlot() === -1;
    return {
      title: 'Spellmaker', sub: w.name ? `\u201c${w.name}\u201d` : 'An unnamed spell', size: 'wide',
      blocks: [
        { type: 'stats', items: [['Gold', L.money], ['Gold cost', L.goldCost], ['Spell point cost', L.spellPointCost], ['Your max spell points', L.maxSpellPoints]] },
        { type: 'cols', template: 'minmax(0, 3fr) minmax(0, 2fr)', cols: [
          [{ type: 'rows', title: 'Effects', key: 'fx', items: slots },
            { type: 'actions', layout: 'row', items: [{ label: 'Add effect', primary: !full, disabled: full, act: at(w, R.addEffect) }] },
            { type: 'field', label: 'Name', value: w.name, placeholder: 'Unnamed', button: { label: 'Name spell', act: at(w, R.nameSpell) } }],
          [{ type: 'chips', label: 'Target', items: TARGET_BUTTONS.map((k, i) => ({ label: SPELL_MAKER_TIPS[k], on: w.rangeType === i,
            disabled: !(w.allowedTargets & flagOfIndex(i)), act: at(w, R[k]) })) },
          { type: 'chips', label: 'Element', items: ELEMENT_BUTTONS.map((k, i) => ({ label: SPELL_MAKER_TIPS[k].replace(' based', ''), on: w.element === i,
            disabled: !(w.allowedElements & flagOfIndex(i)), act: at(w, R[k]) })) },
          { type: 'group', title: 'Icon', cls: 'port-iconrow', blocks: [
            { type: 'picture', src: spellIconUrl(w.icon), alt: String(w.icon + 1), cls: 'port-spellicon' },
            { type: 'actions', layout: 'row', items: [
              { label: '\u2039', act: at(w, R.previousIcon), title: 'Previous icon' },
              { label: 'Choose', act: at(w, R.selectIcon) },
              { label: '\u203a', act: at(w, R.nextIcon), title: 'Next icon' },
            ] },
          ] }],
        ] },
      ],
      foot: [
        { label: 'Buy spell', primary: true, act: at(w, R.buySpell) },
        { label: 'New spell', act: at(w, R.newSpell) },
        { label: 'Exit', act: at(w, R.exit) },
      ],
    };
  },
};

// ── THE SPELL SHOP ─────────────────────────────────────────────────
// SHOP-PLUS (Mac: "the buy spells vendors UI in guild halls is still in classic this must be reworked to enhanced
// plus"). The guilds' and temples' Buy Spells is DFU's spellbook in BUY MODE (worldModes guildServiceSpellbook) -
// ported, not rewritten: every price is the window's own tradePrice (the building's quality against the player's
// Mercantile and Personality, the Witches Festival half), the buy is its own buyButton (the spellbook check, the
// gold check, the haggle line and the Yes/No, which take their enhanced faces), and an effect's full description is
// its own effect panel's click. The offer is the shelf on the left with each spell's price; the right is the chosen
// spell: its icon, what it costs to cast, its target and element, and every effect with its numbers.
const SB_X = (320 - SPELLBOOK_RECTS.main[2]) / 2, SB_Y = (200 - SPELLBOOK_RECTS.main[3]) / 2;
/** The price of offer row i, as the window prices its selection (it reads the selection, so it is asked with it). */
function priceOfRow(w, i) {
  const was = w.selectedIndex;
  w.selectedIndex = i;
  try { return w.tradePrice(); } finally { w.selectedIndex = was; }
}
const spellShop = {
  kind: 'spellshop',
  view(w) {
    const rows = w._rows ?? [];
    const gold = totalGoldAmount(w.deps.entity);
    const shelf = rows.map((r, i) => {
      const price = priceOfRow(w, i);
      return { label: r.spell?.name ?? '', value: `${price} gp`, on: i === w.selectedIndex, muted: price > gold,
        hint: price > gold ? 'More than you have' : '',
        act: () => { if (w.selectedIndex !== i) { w.selectedIndex = i; w._click?.(); } } };
    });
    const sp = w.selected;
    const fr = spellFrame(sp);
    const fx = sp ? effectRowsOf(w, sp) : [];
    const price = sp ? w.tradePrice() : 0;
    const castSp = sp ? spellPointCost(sp, w.deps.castCost) : 0;
    const canPay = price <= gold;
    return {
      title: 'Buy Spells', sub: w.deps.shopName?.() || 'The guild\u2019s spells for sale', size: 'wide',
      blocks: [
        { type: 'stats', items: [['Your gold', `${gold} gp`], ['Spells on offer', String(rows.length)], ['Price', sp ? `${price} gp` : '-', canPay ? '' : 'port-warn']] },
        { type: 'cols', template: 'minmax(0, 5fr) minmax(0, 6fr)', cols: [
          [{ type: 'rows', title: 'On the shelf', key: 'offer', items: shelf, maxHeight: 360, empty: 'Nothing for sale here.' }],
          sp ? [
            { type: 'group', title: sp.name, cls: 'port-iconrow', blocks: [
              { type: 'picture', src: spellIconUrl(sp.icon ?? 0), alt: sp.name, cls: 'port-spellicon' },
              { type: 'stats', items: [['Casting cost', `${castSp} spell points`], ['Target', fr.target ?? '-'], ['Element', fr.element ?? '-']] },
            ] },
            { type: 'rows', title: 'Effects', key: 'fx', items: fx, empty: 'This spell has no effects.' },
            { type: 'text', rows: [canPay ? `${price} gold to learn it.` : `It costs ${price} gold - you have ${gold}.`] },
          ] : [{ type: 'text', center: true, rows: ['Choose a spell on the shelf.'] }],
        ] },
      ],
      foot: [
        { label: sp ? `Buy for ${price} gp` : 'Buy', key: 'B', primary: true, disabled: !sp, act: () => w.buyButton() },
        { label: 'Leave', key: 'E', act: at(w, SPELLBOOK_RECTS.exit, SB_X, SB_Y) },
      ],
    };
  },
};
/** The chosen spell's effects as rows: the effect's name, and its numbers under it; a press opens the effect's own
 *  description, the classic panel's click. */
function effectRowsOf(w, sp) {
  // the book's own list of the effects (empty slots dropped) - the same indexing its three panels click by
  return spellEffects(sp).slice(0, 3).map((e, k) => {
    const wd = effectWords(e);
    const name = wd ? [wd.group, wd.subgroup].filter(Boolean).join(' ') : 'Effect';
    return { label: name, sub: wd?.parts?.join(' \u00b7 ') ?? '', hint: 'What it does',
      act: at(w, SPELLBOOK_RECTS.effect[k], SB_X, SB_Y) };
  });
}

export const PORT_SPECS = Object.freeze({ guild, coven, bank, bankPurchase, transport, daedra, potionMaker, itemMaker, spellMaker, spellShop });

/**
 * The one call a host makes: under the enhanced skin (and a document to
 * draw in) the window is ported; otherwise it is handed back untouched,
 * so the classic skin is the classic window, byte for byte.
 */
export function enhancedWindow(win, kind) {
  const spec = PORT_SPECS[kind];
  if (!spec || !win || typeof document === 'undefined' || !isEnhancedPlus()) return win;
  return portWindow(win, spec);
}
