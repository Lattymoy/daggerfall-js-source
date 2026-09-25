// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DISC25-F - THE HOW-MANY FIELD: DFU's split popup, on an enhanced card.
//
// Satranath, crediting Starempire42, on Discord: "It doesn't appear
// possible to split stacks currently, either in inventory or in shops
// when making a purchase."
//
// DFU asks "Pick how many items (max N)?" in a popup whenever a stack
// will not all fit, or under Control (TransferItem, DaggerfallInventory
// Window.cs:1515-1539), and the trade window inherits the member
// (DaggerfallTradeWindow.cs:31). The classic windows push that box (CM5
// for the pack). The enhanced pack and the enhanced counter never asked:
// a partial fit silently took what fit, and a stack otherwise moved
// whole. Both write the question as a field on the item's own card now,
// beside the button that moves it - ONE constructor for both (AUDIT
// 17i), the law (the words, the cap, the parse) in systems/itemTransfer.js.
// ═══════════════════════════════════════════════════════════════════

import { HOW_MANY_ITEMS, SPLIT_INPUT_MAX } from '../systems/itemTransfer.js';

/**
 * A labelled numeric field: "How many [text] of max". `onInput(text)` hears every keystroke; the window keeps the text
 * and parses it (parseSplitAmount) when the button is pressed, as DFU parses the popup's answer.
 * @param {{max:number, text:string, onInput:(text:string) => void}} opts
 */
export function howManyField({ max, text, onInput }) {
  const doc = globalThis.document;
  const wrap = doc.createElement('label');
  wrap.className = 'qtyfield';
  const lead = doc.createElement('span');
  lead.textContent = 'How many';
  const input = doc.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.maxLength = SPLIT_INPUT_MAX;
  input.value = text;
  input.setAttribute('aria-label', HOW_MANY_ITEMS(max));
  input.oninput = () => onInput(input.value);
  const of = doc.createElement('span');
  of.className = 'meta';
  of.textContent = `of ${max}`;
  wrap.append(lead, input, of);
  return wrap;
}
