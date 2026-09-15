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
const parsedAmount = (text, max) => {
  const count = Number.parseInt(String(text), 10);
  return Number.isInteger(count) && count >= 1 && count <= max ? count : null;
};

export class NativeInventoryWindow extends BaseInventoryWindow {
  constructor(hooks) {
    super(hooks);
    this.splitBox = null;
  }

  _openSplit(max, perform) {
    this.splitBox = new InputMessageBoxWindow({
      label: HOW_MANY_ITEMS(max),
      value: String(max),
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

    // Ask without side effects first. If no split is needed, let the
    // base run the one real plan. If a split IS needed, run the real
    // plan now: DFU's quest-item rung executes before the popup opens.
    const remote = this._remote();
    const dry = planStore(it, {
      remote, usingWagon: this.usingWagon, chooseOne: this.chooseOne,
      getQuest: this.hooks.getQuest ?? null, dryRun: true,
    });
    if (!dry.ok || dry.map || dry.amount >= amountOf(it)) return super._pick(slot, mode);

    const plan = planStore(it, {
      remote, usingWagon: this.usingWagon, chooseOne: this.chooseOne,
      getQuest: this.hooks.getQuest ?? null,
    });
    if (!plan.ok) { this._refuse(plan.refusal); return; }
    this._openSplit(plan.amount, (count) => {
      audio.playOneShot(SOUND.ButtonClick, 1);   // DoTransferItem (:1583)
      applyTransfer(it, { ...plan, amount: count }, this.hooks.items(), remote,
        { entity: this.hooks.entity, fromLocal: true });
    });
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
    if (!dry.ok || dry.map || dry.amount >= amountOf(it)) return super._pickRemote(slot, mode);

    // RemoteItemListScroller marks a quest item clicked before
    // TransferItem. Preserve that edge here because the base arm will
    // not run once we own the partial move.
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
    });
  }

  input(code, e = null) {
    if (this.splitBox) {
      this.splitBox.input(code, e);
      if (this.splitBox.done) this.splitBox = null;
      return;
    }
    super.input(code, e);
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
