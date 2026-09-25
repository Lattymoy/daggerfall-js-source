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
import { portWindow, centreOf } from './enhancedPort.js';
import { itemIconUrl, itemName, spellIconUrl, paintFrame } from './enhancedArt.js';
import { serviceLabel } from '../systems/guildServiceFlow.js';
import { GUILD_RECTS, PANEL_X as GUILD_X, PANEL_Y as GUILD_Y } from './guildServiceWindow.js';
import { COVEN_RECTS, COVEN_PANEL_X, COVEN_PANEL_Y } from './covenWindow.js';
import { BANK_RECTS, BANK_PANEL_X, BANK_PANEL_Y } from './bankWindow.js';
import { TRANSACTION_TYPE } from '../systems/banking.js';
import { PURCHASE_RECTS, PURCHASE_PANEL_X, PURCHASE_PANEL_Y } from './bankPurchaseWindow.js';
import { TRANSPORT_MODES } from '../systems/transport.js';
import { POTION_RECTS } from './potionMakerWindow.js';
import { ITEM_RECTS, TAB_PAGES } from './itemMakerWindow.js';
import { enchantmentName, enchantmentParams, enchantmentParamName, PARAM_NONE } from '../systems/enchantmentCatalogue.js';
import {
  SPELL_MAKER_RECTS, SPELL_MAKER_TIPS, EFFECT_NAME_PANELS, TARGET_BUTTONS, ELEMENT_BUTTONS,
  EDITOR_RECTS, SPINNER_UP, SPINNER_DOWN, spinnerPart,
} from './spellMakerWindow.js';
import { flagOfIndex } from '../systems/spellMaker.js';
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
});
const bank = {
  kind: 'bank',
  view(w) {
    const press = (name) => at(w, BANK_RECTS[name], BANK_PANEL_X, BANK_PANEL_Y);
    const L = w.labels();
    const busy = w.transactionType !== TRANSACTION_TYPE.None;
    const btn = (name, label, extra = {}) => ({ label, act: press(name), disabled: busy || (w.enabled ? w.enabled(name) === false : false), ...extra });
    const city = w.hooks.cityName?.();
    return {
      title: city ? `Bank of ${city}` : 'The Bank', sub: w.hooks.regionName?.() ?? '', size: 'medium',
      blocks: [
        { type: 'stats', items: [
          ['Account balance', L.account], ['Gold carried', L.inventory],
          ['Loan owed', L.loanDue, Number(L.loanDue) > 0 ? 'warn' : ''], ['Loan due by', L.loanBy],
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
        busy ? { type: 'field', label: BANK_FIELD_LABEL[w.transactionType] ?? 'Amount', value: w.value, active: true } : null,
      ],
      foot: busy
        ? [{ label: 'Confirm', key: 'Enter', primary: true, act: () => w.input('Enter') },
          { label: 'Cancel', key: 'Esc', act: () => { w.transactionType = TRANSACTION_TYPE.None; w.value = ''; } }]
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
  return { label: enchantmentName(e.type), sub: secondary, muted: forced, hint: forced ? 'Added with its power' : 'Remove',
    act: forced ? null : () => w._removeRow(e) };
});
const itemMaker = {
  kind: 'itemmaker',
  view(w) {
    const L = w.labels();
    const sel = w.selected;
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
            [{ type: 'rows', title: 'Powers', key: 'pow', maxHeight: 170, empty: 'No powers yet.', items: enchantRows(w, w.powers) },
              { type: 'actions', layout: 'row', items: [{ label: 'Add power', act: at(w, ITEM_RECTS.powersButton), disabled: !sel }] }],
            [{ type: 'rows', title: 'Side effects', key: 'side', maxHeight: 170, empty: 'No side effects.', items: enchantRows(w, w.sideEffects) },
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
  const spin = (field, label) => ({ type: 'spinner', label, value: slot?.settings?.[field] ?? 0, disabled: !ed.enabled(field),
    down: at(w, spinnerPart(EDITOR_RECTS[field], SPINNER_DOWN)), up: at(w, spinnerPart(EDITOR_RECTS[field], SPINNER_UP)) });
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

export const PORT_SPECS = Object.freeze({ guild, coven, bank, bankPurchase, transport, daedra, potionMaker, itemMaker, spellMaker });

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
