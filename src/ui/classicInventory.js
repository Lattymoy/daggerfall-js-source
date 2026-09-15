// CM5 - THE INVENTORY'S PARTIAL-STACK INPUT MESSAGE BOX.
//
// TransferItem already computed the exact max amount that fits, but the
// classic canvas window immediately moved that amount. DFU does not: if
// maxAmount < stackCount it pushes DaggerfallInputMessageBox, defaulted
// to maxAmount, and only SplitStackPopup_OnGotUserInput performs the
// transfer. This subclass restores that modal without duplicating the
// transfer law itself.

import { NativeInventoryWindow as BaseInventoryWindow } from './nativeInventory.js';
import { InputMessageBoxWindow } from './inputMessageBox.js';
import { planStore, planTake, applyTransfer } from '../systems/itemTransfer.js';
import { equipItem } from '../systems/equip.js';
import { refreshPaperDoll } from './paperDoll.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

export const HOW_MANY_ITEMS = (max) => `Pick how many items (max ${max})?`;
export const SPLIT_INPUT_MAX = 8;

const amountOf = (item) => item?.stackCount ?? 1;
const isControlCode = (code, e = null) =>
  code === 'ControlLeft' || code === 'ControlRight'
  || e?.code === 'ControlLeft' || e?.code === 'ControlRight'
  || e?.key === 'Control';
const parsedAmount = (text, max) => {
  const count = Number.parseInt(String(text), 10);
  return Number.isInteger(count) && count >= 1 && count <= max ? count : null;
};

// Same declaration rule as classicCharSheet.js: the audited base window
// remains the declared export. This runtime presentation wrapper keeps
// the constructor name the hosts already probe without creating a second
// direct declaration for audit24_onehome to treat as a competing home.
class NativeInventoryWindow extends BaseInventoryWindow {
  constructor(hooks) {
    super(hooks);
    this.splitBox = null;
    // TransferItem polls LeftControl/RightControl at the moment the
    // item is clicked. The hosts already deliver both keyboard edges
    // to their overlay slot, so this wrapper can hold the same state
    // without widening every host's pointer signature.
    this._controlDown = false;
  }

  _openSplit(max, perform, value = String(max)) {
    this.splitBox = new InputMessageBoxWindow({
      label: HOW_MANY_ITEMS(max),
      value,
      maxCharacters: SPLIT_INPUT_MAX,
      numeric: true,
      onSubmit: (text) => {
        const count = parsedAmount(text, max);
        if (count !== null) perform(count);
      },
    });
  }

  /** LocalItemListScroller Remove -> TransferItem. Only intercept the
   *  arm that DFU routes into SplitStackPopup; every other mode and a
   *  whole-stack move stays in the audited base window. */
  _pick(slot, mode = this.mode) {
    if (mode !== 'remove') return super._pick(slot, mode);
    this._clampScroll();
    const it = this._filtered()[this.scroll + slot];
    if (!it) return;

    // Ask without side effects first. A capacity-limited move opens
    // the popup automatically; holding Control forces the SAME popup
    // for an otherwise-whole stack (TransferItem :1515-1539).
    const remote = this._remote();
    const dry = planStore(it, {
      remote, usingWagon: this.usingWagon, chooseOne: this.chooseOne,
      getQuest: this.hooks.getQuest ?? null, dryRun: true,
    });
    const forceSplit = this._controlDown && amountOf(it) > 1;
    if (!dry.ok || dry.map || (!forceSplit && dry.amount >= amountOf(it))) return super._pick(slot, mode);

    // Run the real plan before opening the field: DFU's quest-item rung
    // executes above the split decision, even when the popup follows.
    const plan = planStore(it, {
      remote, usingWagon: this.usingWagon, chooseOne: this.chooseOne,
      getQuest: this.hooks.getQuest ?? null,
    });
    if (!plan.ok) { this._refuse(plan.refusal); return; }
    this._openSplit(plan.amount, (count) => {
      audio.playOneShot(SOUND.ButtonClick, 1);   // DoTransferItem (:1583)
      applyTransfer(it, { ...plan, amount: count }, this.hooks.items(), remote,
        { entity: this.hooks.entity, fromLocal: true });
    }, forceSplit ? '0' : String(plan.amount));
  }

  /** Remote Remove/Equip -> TransferItem. Same popup, plus the tail
   *  DoTransferItem owns after the split: optional equip and the
   *  choose-one claim. */
  _pickRemote(slot, mode = this.mode) {
    if (mode !== 'remove' && mode !== 'equip') return super._pickRemote(slot, mode);
    this._clampScroll();
    const remote = this._remote();
    const it = remote[this.remoteScroll + slot];
    if (!it) return;

    const bag = this.hooks.items();
    const args = {
      bag, entity: this.hooks.entity, mode,
      chooseOne: this.chooseOne, usingWagon: this.usingWagon,
      getQuest: this.hooks.getQuest ?? null,
    };
    const dry = planTake(it, { ...args, dryRun: true });
    const forceSplit = this._controlDown && amountOf(it) > 1;
    if (!dry.ok || dry.map || (!forceSplit && dry.amount >= amountOf(it))) return super._pickRemote(slot, mode);

    // RemoteItemListScroller marks a quest item clicked before
    // TransferItem. Preserve that edge here because the base arm will
    // not run once we own the split move.
    if (it.questItem) this.hooks.getQuest?.(it.questUID)?.getItem?.(it.questSymbol)?.setPlayerClicked();
    const plan = planTake(it, args);
    if (!plan.ok) { this._refuse(plan.refusal); return; }

    this._openSplit(plan.amount, (count) => {
      audio.playOneShot(plan.sound === 'gold' ? SOUND.GoldPieces : SOUND.ButtonClick, 1);
      const taken = applyTransfer(it, { ...plan, amount: count }, remote, bag,
        { entity: this.hooks.entity, toPlayer: true });
      // The gold interception returns before equip/choose-one in DFU.
      if (taken === null) return;
      if (plan.equip && this.hooks.entity) {
        if (this._refuseForbidden(taken)) return;
        if (equipItem(this.hooks.entity, taken) !== null) refreshPaperDoll(this.hooks.entity);
      }
      if (plan.claimsChoice) {
        const cb = this.chooseOne?.onChoose;
        this.chooseOne = null;
        this._closeSilently();
        cb?.(taken);
      }
    }, forceSplit ? '0' : String(plan.amount));
  }

  input(code, e = null) {
    // Input.GetKey(Control) is state, not an event modifier. Record the
    // down edge here and the matching up edge below so a later mouse
    // click sees exactly the state TransferItem polls.
    if (isControlCode(code, e)) this._controlDown = true;
    if (this.splitBox) {
      this.splitBox.input(code, e);
      if (this.splitBox.done) this.splitBox = null;
      return;
    }
    super.input(code, e);
  }

  keyup(code, e = null) {
    if (isControlCode(code, e)) this._controlDown = false;
  }

  click(vx, vy, right = false, middle = false) {
    if (this.splitBox) { this.splitBox.click(vx, vy); return true; }
    return super.click(vx, vy, right, middle);
  }

  hover(vx, vy) {
    if (this.splitBox) return true;
    return super.hover(vx, vy);
  }

  wheel(dir, vx, vy) {
    if (this.splitBox) return;
    super.wheel(dir, vx, vy);
  }

  draw(renderer, canvas, font) {
    super.draw(renderer, canvas, font);
    if (this.splitBox) this.splitBox.draw(renderer, canvas, font);
  }
}

export { NativeInventoryWindow };
