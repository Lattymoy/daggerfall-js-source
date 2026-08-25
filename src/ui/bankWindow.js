// B2 - THE BANKING WINDOW: DaggerfallBankingWindow (MIT, Daggerfall
// Workshop / Lypyl, Hazelnut) on real ARENA2 art.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is BANK00I0.IMG, which ships 225x181 - exactly
//   mainPanel.Size (:77). Read with the port's own ImgFile.
// - Center/Middle on the 320x200 native panel (:78-79), so it sits at
//   ((320-225)/2, (200-181)/2) = (48, 10) with the same half-pixel
//   rounding every other centred panel in the port uses.
// - FOUR LABELS the window keeps live (:81-106): the account total at
//   (150,14), the player's gold at (156,24) - which appends the
//   WAGON's gold in parentheses when the cart carries any - the loan
//   due at (96,34) and the due DATE at (71,44).
// - TEN BUTTONS in two columns of five (:108-183), all 45x8: deposit
//   and withdraw at y58, the two letter-of-credit buttons at y76,
//   repay and borrow at y94, buy/sell house at y112, buy/sell ship at
//   y130. Exit is (92,159,40,19).
// - ONE NUMERIC INPUT at (113,146,103,12), nine characters (:185-190).
//   It is DISABLED until a button opens it, which is the whole
//   interaction model: a button chooses a transaction TYPE, the field
//   takes the amount, Return commits it.
//
// The laws are systems/banking.js's - every refusal, every gate and
// the arithmetic. This file is the panel, the hit rects and the box.
//
// H2 opened the HOUSE half of this: BUY HOUSE reaches
// ui/bankPurchaseWindow.js now, and the refusals above it are the
// law's. The SHIP popup is still FLAGGED - it needs the two fixed
// ship scenes at map pixels (2,2) and (5,5), which is a streaming-
// world seam and not a banking one. DFU binds each button to a
// DaggerfallShortcut hotkey; the accelerators here are the port's own
// (Ledger A).

import { loadImg, nativeMetrics, drawImg, shadowText } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS } from './messageBox.js';
import { typedChar } from './input.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import {
  TRANSACTION_TYPE, TRANSACTION_RESULT,
  bankButtonEnabled, toggleTransactionInput, parseTransactionAmount,
  borrowDecision, buyHouseDecision, buyShipDecision, sellDecision,
  accountTotal, loanedTotal, loanDueDate,
  depositGold, withdrawGold, depositAllLetters, withdrawLetter,
  repayLoan, borrowLoan, shipSellPrice,
} from '../systems/banking.js';

/** mainPanel.Size (:77) - and the size BANK00I0.IMG ships. */
export const BANK_PANEL_W = 225, BANK_PANEL_H = 181;
export const BANK_PANEL_X = Math.round((320 - BANK_PANEL_W) / 2);   // 48
export const BANK_PANEL_Y = Math.round((200 - BANK_PANEL_H) / 2);   // 10

/** The four live labels (:81-106), panel-relative. */
export const BANK_LABELS = Object.freeze({
  account: [150, 14], inventory: [156, 24], loanDue: [96, 34], loanBy: [71, 44],
});

/** The ten buttons, the exit and the field (:108-190), panel-relative.
 *  Two columns at x120 and x172, five rows on an 18-pixel stride. */
export const BANK_RECTS = Object.freeze({
  depositGold: [120, 58, 45, 8], withdrawGold: [172, 58, 45, 8],
  depositLetters: [120, 76, 45, 8], withdrawLetter: [172, 76, 45, 8],
  loanRepay: [120, 94, 45, 8], loanBorrow: [172, 94, 45, 8],
  buyHouse: [120, 112, 45, 8], sellHouse: [172, 112, 45, 8],
  buyShip: [120, 130, 45, 8], sellShip: [172, 130, 45, 8],
  exit: [92, 159, 40, 19],
  input: [113, 146, 103, 12],
});
/** TextBox.Numeric, MaxCharacters 9 (:188-190). */
export const AMOUNT_FIELD = Object.freeze({ numeric: true, maxCharacters: 9 });

/** The button -> transaction type each one opens (:370-396). Three
 *  are NOT here because they decide before they open anything. */
const OPENS = Object.freeze({
  depositGold: TRANSACTION_TYPE.Depositing_gold,
  withdrawGold: TRANSACTION_TYPE.Withdrawing_gold,
  withdrawLetter: TRANSACTION_TYPE.Withdrawing_Letter,
  loanRepay: TRANSACTION_TYPE.Repaying_loan,
});

/** "cannotCarryGold" - the one result that is NOT a TEXT.RSC record,
 *  so the window supplies its own line (:308-309). */
export const CANNOT_CARRY_GOLD = 'You cannot carry that much gold.';

let _art = null;
export async function preloadBankArt(deps) {
  if (_art) return;
  try {
    _art = await loadImg(deps, 'BANK00I0.IMG');
  } catch { console.warn('[bank] BANK00I0 unavailable; the banking window stays closed'); }
}
export const bankArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + BANK_PANEL_X && y >= ry + BANK_PANEL_Y
  && x < rx + BANK_PANEL_X + rw && y < ry + BANK_PANEL_Y + rh;

/**
 * hooks:
 *   accounts()     -> the per-region account array
 *   regionIndex()  -> PlayerGPS.CurrentRegionIndex
 *   player         the purse seam banking.js's transactions take
 *   level()        -> for CalculateMaxBankLoan
 *   now()          -> classic minutes
 *   wagonGold()    -> the cart's gold, for the parenthesised label
 *   rows(textId)   -> the host's TEXT.RSC reader
 *   dueDateText(minutes) -> GetLoanDueDateString
 *   ownsHouse(), ownsShip(), housesForSale(), isPortTown(), houseSellPrice()
 *   openPurchase()  -> H2: mounts the purchase window; false if it cannot
 *   onClose()
 */
export class BankWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam
    this.transactionType = TRANSACTION_TYPE.None;
    this.value = '';
    this.box = null;
  }

  _close() { this.done = true; this.hooks.onClose?.(); }
  get accounts() { return this.hooks.accounts(); }
  get region() { return this.hooks.regionIndex(); }

  /** UpdateButtons (:252-265), through the law. */
  enabled(button) {
    return bankButtonEnabled(button, {
      transactionType: this.transactionType, accounts: this.accounts, regionIndex: this.region,
    });
  }

  /** GeneratePopup (:299-330). NONE says nothing at all; TOO_HEAVY is
   *  the one result with no record behind it. */
  _popup(result, amount = 0) {
    if (result === TRANSACTION_RESULT.NONE) return;
    const rows = result === TRANSACTION_RESULT.TOO_HEAVY
      ? [{ text: CANNOT_CARRY_GOLD, center: true }]
      : this.hooks.rows?.(result) ?? [];
    // THREE results ask rather than tell (:313-334), not one: the
    // letter deposit and BOTH sell offers. H3 - the two sell arms
    // raised a click-anywhere box and no sale, so a player could
    // accept an offer and keep the house.
    const ASKS = {
      [TRANSACTION_RESULT.DEPOSIT_LOC]: () => depositAllLetters(this.accounts, this.region, this.hooks.player),
      // MakeTransaction(Sell_house / Sell_ship, 0, regionIndex)
      // (:355, :364) - the amount is IGNORED on both, because the
      // price is the deed's, not the player's to name.
      [TRANSACTION_RESULT.SELL_HOUSE_OFFER]: () => this.hooks.sellHouse?.(),
      [TRANSACTION_RESULT.SELL_SHIP_OFFER]: () => this.hooks.sellShip?.(),
    };
    const onYes = ASKS[result] ?? null;
    this.box = {
      rows: rows.length ? rows : [{ text: String(result), center: true }],
      buttons: onYes ? 'YesNo' : null,
      amount,
      onYes,
    };
  }

  _openInput(type) {
    this.transactionType = toggleTransactionInput(this.transactionType, type);
    this.value = '';
  }

  /** HandleTransactionInput -> MakeTransaction (:280-295, :286-336). */
  _commit() {
    const amount = parseTransactionAmount(this.value);
    const type = this.transactionType;
    this._openInput(TRANSACTION_TYPE.None);
    if (amount == null) return;    // int.TryParse: nothing at all
    const a = this.accounts, r = this.region, p = this.hooks.player;
    let result = TRANSACTION_RESULT.NONE;
    switch (type) {
      case TRANSACTION_TYPE.Depositing_gold: result = depositGold(a, r, amount, p); break;
      case TRANSACTION_TYPE.Withdrawing_gold: result = withdrawGold(a, r, amount, p); break;
      case TRANSACTION_TYPE.Withdrawing_Letter: result = withdrawLetter(a, r, amount, p); break;
      case TRANSACTION_TYPE.Repaying_loan: result = repayLoan(a, r, amount, p).result; break;
      case TRANSACTION_TYPE.Borrowing_loan:
        result = borrowLoan(a, r, amount, { level: this.hooks.level?.() ?? 1, nowMinutes: this.hooks.now?.() ?? 0 });
        break;
      default: return;
    }
    this._popup(result, amount);
  }

  _button(name) {
    if (!this.enabled(name)) return;
    audio.playOneShot(SOUND.ButtonClick, 1);
    if (OPENS[name]) { this._openInput(OPENS[name]); return; }
    if (name === 'depositLetters') { this._popup(TRANSACTION_RESULT.DEPOSIT_LOC); return; }
    if (name === 'loanBorrow') {
      const d = borrowDecision(this.accounts, this.region);
      // DFU closes any open input on BOTH refusals (:403, :408)
      if (d.kind === 'refuse') { this._openInput(TRANSACTION_TYPE.None); this._popup(d.result); return; }
      this._openInput(d.transactionType);
      return;
    }
    if (name === 'buyHouse') {
      const d = buyHouseDecision({ ownsHouse: this.hooks.ownsHouse?.(), housesForSale: this.hooks.housesForSale?.() ?? 0 });
      // H2: 'pick' reaches the purchase window at last. The refusals
      // are still the law's - already own one, nothing for sale - and
      // a host with no purchase window falls back to DFU's own answer
      // for a missing directory (:433-434).
      if (d.kind === 'refuse') { this._popup(d.result); return; }
      if (!this.hooks.openPurchase?.()) this._popup(TRANSACTION_RESULT.NO_HOUSES_FOR_SALE);
      return;
    }
    if (name === 'buyShip') {
      const d = buyShipDecision({ ownsShip: this.hooks.ownsShip?.(), isPortTown: this.hooks.isPortTown?.() });
      this._popup(d.kind === 'refuse' ? d.result : TRANSACTION_RESULT.NOT_PORT_TOWN);
      return;
    }
    if (name === 'sellHouse') {
      const d = sellDecision('house', { owns: this.hooks.ownsHouse?.(), price: this.hooks.houseSellPrice?.() ?? 0 });
      if (d.kind === 'offer') this._popup(d.result, d.price);
      return;
    }
    if (name === 'sellShip') {
      const ship = this.hooks.ownedShip?.() ?? -1;
      const d = sellDecision('ship', { owns: ship >= 0, price: shipSellPrice(ship) });
      if (d.kind === 'offer') this._popup(d.result, d.price);
    }
  }

  _dismissBox(button = null) {
    const b = this.box;
    this.box = null;
    if (b?.buttons === 'YesNo' && button === MB_BUTTONS.Yes) b.onYes?.();
  }

  input(code, e = null) {
    if (this.box) {
      if (this.box.buttons === 'YesNo') {
        if (code === 'KeyY') this._dismissBox(MB_BUTTONS.Yes);
        else if (code === 'KeyN' || code === 'Escape') this._dismissBox(MB_BUTTONS.No);
      } else this._dismissBox();
      return;
    }
    // Update (:212-223): Return commits an OPEN transaction and does
    // nothing otherwise - it is not a close.
    if (code === 'Enter') { if (this.transactionType !== TRANSACTION_TYPE.None) this._commit(); return; }
    if (this.transactionType !== TRANSACTION_TYPE.None) {
      if (code === 'Escape') { this._openInput(TRANSACTION_TYPE.None); return; }
      if (code === 'backspace' || code === 'Backspace') { this.value = this.value.slice(0, -1); return; }
      const ch = typedChar(code, e);
      if (ch && /^[0-9]$/.test(ch) && this.value.length < AMOUNT_FIELD.maxCharacters) this.value += ch;
      return;
    }
    if (code === 'Escape' || code === 'KeyE') this._close();
  }

  click(vx, vy) {
    if (this.box) {
      if (this.box.buttons === 'YesNo') {
        const hit = this._boxLayout ? messageBoxHit(this._boxLayout, vx, vy) : null;
        if (hit !== null) this._dismissBox(hit);
      } else this._dismissBox();
      return true;
    }
    if (inRect(BANK_RECTS.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    for (const name of Object.keys(OPENS).concat([
      'depositLetters', 'loanBorrow', 'buyHouse', 'sellHouse', 'buyShip', 'sellShip',
    ])) {
      if (inRect(BANK_RECTS[name], vx, vy)) { this._button(name); return true; }
    }
    return inRect([0, 0, BANK_PANEL_W, BANK_PANEL_H], vx, vy);
  }

  /** UpdateLabels (:239-250). The inventory line appends the WAGON's
   *  gold in parentheses when the cart carries any - one label, two
   *  purses, which is how a player sees at a glance what a deposit
   *  can actually reach. */
  labels() {
    const a = this.accounts, r = this.region;
    const wagon = this.hooks.wagonGold?.() ?? 0;
    return {
      account: String(accountTotal(a, r)),
      inventory: wagon > 0 ? `${this.hooks.player.gold()} (+${wagon})` : String(this.hooks.player.gold()),
      loanDue: String(loanedTotal(a, r)),
      loanBy: this.hooks.dueDateText?.(loanDueDate(a, r)) ?? '',
    };
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    const m = nativeMetrics(canvas);
    // ParentPanel.BackgroundColor = ScreenDimColor (:74), which is
    // Color.clear - the letterbox is NOT painted.
    drawScreenDimBackdrop(renderer, canvas);
    drawImg(renderer, _art, m, BANK_PANEL_X, BANK_PANEL_Y);
    const L = this.labels();
    for (const [key, [x, y]] of Object.entries(BANK_LABELS)) {
      shadowText(renderer, font, L[key], m, BANK_PANEL_X + x, BANK_PANEL_Y + y);
    }
    // the field, when a transaction has opened it
    if (this.transactionType !== TRANSACTION_TYPE.None) {
      const [ix, iy] = BANK_RECTS.input;
      shadowText(renderer, font, `${this.value}_`, m, BANK_PANEL_X + ix + 2, BANK_PANEL_Y + iy + 2);
    }
    if (this.box) {
      const buttons = this.box.buttons === 'YesNo' ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : [];
      this._boxLayout = layoutMessageBox(font, this.box.rows, buttons);
      drawMessageBox(renderer, m, font, this._boxLayout);
    } else this._boxLayout = null;
  }
}
