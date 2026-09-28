// TOUCH-BUTTONS (2026-09-27, Discord - jessman212, playing on Android: "I haven't been able to remap the android
// "buttons" on the bottom right of the screen. I would much rather use a button to attack rather than the touchscreen
// personally."). THE BOTTOM RIGHT IS THE PLAYER'S.
//
// TI1 fixed that corner at two buttons, Jump and Ready Weapon, and took the sword away in favour of the swipe - the
// press-hold-and-stroke that is the mouse's own swing (touchGestures.js). Both stay the defaults. What changes is
// that the corner is now THREE SLOTS, each one any action from this table (or none), chosen on the Touch card
// (enhancedMenu.js portRowsControls) and re-laid live while the layer is up (touch.js's poll). One of the choices is
// ATTACK: a press is a swing - the same attack seam the swipe feeds (hooks.attack, so a readied spell fires first,
// exactly as the swipe's press does), with a stroke drawn at random from DFU's click-to-attack table (AUDIT A7), which is what
// DFU's click-to-attack swing modes do with a press that carries no drag (WeaponManager, WeaponSwingMode 1 and 2).
//
// This module is the law and nothing else - no DOM. Each action says how the corner presses it:
//   hold    the action's key is down while the finger is (Jump, Run, Crouch - touch.js downAction/upCode);
//   tap     one press of the action's key (the windows, the spellbook - touch.js tapAction);
//   attack  the swing above.
// Every key is the REGISTRY's (touch.js codeFor): a rebind in Controls moves what the button presses (AUDIT 62 F8).

import { CLICK_ATTACK_DIRECTIONS } from '../characters/weaponStates.js';   // AUDIT TOUCH-BUTTONS A7: DFU's click draw - one table

/** The choices, in the order the Touch card walks them. `glyph` is what the button wears; `w` its width in px. */
export const TOUCH_BUTTON_ACTIONS = Object.freeze([
  { id: 'none', label: 'None', glyph: '', kind: 'none' },
  { id: 'Jump', label: 'Jump', glyph: '↑↑', kind: 'hold', w: 64 },
  { id: 'ReadyWeapon', label: 'Ready or sheathe weapon', glyph: 'Z', kind: 'hold', w: 52 },
  { id: 'Attack', label: 'Attack', glyph: '⚔', kind: 'attack', w: 64 },
  { id: 'CastSpell', label: 'Spellbook', glyph: 'Cast', kind: 'tap', w: 60 },
  { id: 'RecastSpell', label: 'Ready the last spell', glyph: 'Recast', kind: 'tap', w: 72 },
  { id: 'UseMagicItem', label: 'Use magic item', glyph: 'Item', kind: 'tap', w: 60 },
  { id: 'Crouch', label: 'Crouch', glyph: 'Crouch', kind: 'hold', w: 72 },
  { id: 'Sneak', label: 'Sneak', glyph: 'Sneak', kind: 'hold', w: 68 },
  { id: 'Run', label: 'Run', glyph: 'Run', kind: 'hold', w: 60 },
  { id: 'AutoRun', label: 'Auto run', glyph: 'Auto', kind: 'tap', w: 60 },
  { id: 'SwitchHand', label: 'Switch hand', glyph: 'Hand', kind: 'tap', w: 60 },
  { id: 'Rest', label: 'Rest', glyph: 'Rest', kind: 'tap', w: 60 },
  { id: 'Inventory', label: 'Inventory', glyph: 'Pack', kind: 'tap', w: 60 },
  { id: 'CharacterSheet', label: 'Character sheet', glyph: 'Char', kind: 'tap', w: 60 },
  { id: 'AutoMap', label: 'Map', glyph: 'Map', kind: 'tap', w: 60 },
  { id: 'TravelMap', label: 'Travel map', glyph: 'Travel', kind: 'tap', w: 68 },
  { id: 'LogBook', label: 'Journal', glyph: 'Log', kind: 'tap', w: 60 },
  { id: 'Transport', label: 'Transport', glyph: 'Ride', kind: 'tap', w: 60 },
]);
const BY_ID = new Map(TOUCH_BUTTON_ACTIONS.map((a) => [a.id, a]));

/** The three slots, right to left from the corner, and what TI1 put there. */
export const TOUCH_BUTTON_SLOTS = Object.freeze(['touchButton1', 'touchButton2', 'touchButton3']);
export const TOUCH_BUTTON_DEFAULTS = Object.freeze({ touchButton1: 'Jump', touchButton2: 'ReadyWeapon', touchButton3: 'none' });

/** A choice by id; anything unknown (an old or hand-edited store) reads as its slot's default. */
export const touchButtonAction = (id) => BY_ID.get(id) ?? null;

/** The slots' actions, corner first: the stored choice where it is one of the table's, the slot's default else. */
export function touchButtonSlots(getPref) {
  return TOUCH_BUTTON_SLOTS.map((slot) => touchButtonAction(getPref?.(slot)) ?? BY_ID.get(TOUCH_BUTTON_DEFAULTS[slot]));
}

/** The Touch card's list: [id, label], in the table's order. */
export const touchButtonChoices = () => TOUCH_BUTTON_ACTIONS.map((x) => [x.id, x.label]);

/** The next choice after `id` (or before, with step -1), wrapping - the Touch card's steppers. */
export function nextTouchButton(id, step = 1) {
  const i = Math.max(0, TOUCH_BUTTON_ACTIONS.findIndex((a) => a.id === id));
  const n = TOUCH_BUTTON_ACTIONS.length;
  return TOUCH_BUTTON_ACTIONS[(((i + step) % n) + n) % n].id;
}

/** The Attack button's stroke: far enough past the attack threshold on any screen (WeaponAttackThreshold is 0.005 of
 *  the longest side - five pixels on a phone) to read as the swing it is. AUDIT TOUCH-BUTTONS A7: DFU'S CLICK-TO-ATTACK
 *  DRAW, one table (combat/playerWeapon.js CLICK_ATTACK_DIRECTIONS - WeaponManager.cs:343's six) - the first cut drew
 *  eight ways, and the gesture folds three of them into StrikeUp: three in eight, where DFU's click swings it one in
 *  six. Each way is the stroke the gesture reads back as it (screen y down). */
export const ATTACK_STROKE_PX = 40;
const STROKE_OF = Object.freeze({ UpRight: [1, -1], Left: [-1, 0], Right: [1, 0], DownLeft: [-1, 1], Down: [0, 1], DownRight: [1, 1] });
export function attackStroke(rolls = Math.random) {
  const way = CLICK_ATTACK_DIRECTIONS[Math.min(CLICK_ATTACK_DIRECTIONS.length - 1, Math.floor(rolls() * CLICK_ATTACK_DIRECTIONS.length))];
  const [x, y] = STROKE_OF[way];
  const n = Math.hypot(x, y);
  return { dx: Math.round((x / n) * ATTACK_STROKE_PX), dy: Math.round((y / n) * ATTACK_STROKE_PX) };
}

/** THE CORNER'S LAYOUT, one home for every control in it: the slots from the corner in, then the mode cycle and the
 *  F button where the host hands their hooks in (touch.js), each `right` px from the screen's right edge with a
 *  12 px gap - which puts TI1's default corner (Jump, Ready Weapon, the mode cycle, F) at exactly the 16..280 px
 *  RENOWN4b's model keeps the HUD clear of, Jump and F where they always stood. A 'none' slot takes no room.
 *  Answers {slots: [{action, right}], mode, social, extent}. */
export const TOUCH_CORNER_GAP = 12;
export const MODE_BUTTON_W = 64;
export const SOCIAL_BUTTON_W = 48;
export function layoutTouchCorner(actions, { mode = false, social = false, start = 16, gap = TOUCH_CORNER_GAP } = {}) {
  const slots = [];
  let right = start;
  for (const a of actions) {
    if (!a || a.kind === 'none') continue;
    slots.push({ action: a, right });
    right += (a.w ?? 60) + gap;
  }
  const modeAt = mode ? right : null;
  if (mode) right += MODE_BUTTON_W + gap;
  const socialAt = social ? right : null;
  if (social) right += SOCIAL_BUTTON_W + gap;
  return { slots, mode: modeAt, social: socialAt, extent: right - gap };
}
/** The widest the corner can grow - the widest choice in all three slots, the mode cycle and F: what the HUD's
 *  layout model keeps its rows clear of (test/renown4b.test.js). */
export const TOUCH_CORNER_MAX = (() => {
  const widest = TOUCH_BUTTON_ACTIONS.reduce((a, b) => ((b.w ?? 0) > (a.w ?? 0) ? b : a));
  return layoutTouchCorner([widest, widest, widest], { mode: true, social: true }).extent;
})();
