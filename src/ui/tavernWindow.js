// U39 - THE TAVERN WINDOW: DFU's DaggerfallTavernWindow (MIT,
// Daggerfall Workshop / Hazelnut) on real ARENA2 art. The four-button
// panel every innkeeper puts in front of you: rent a room, talk, eat,
// leave.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the panel is TVRN00I0.IMG (:47), which ships 130x44 - exactly
//   mainPanel.Size (:100). Read with the port's own ImgFile rather
//   than assumed, because I3 learned that lesson on OPTN00I0.
// - mainPanel is HorizontalAlignment.Center + VerticalAlignment.Middle
//   (:96-97), so BaseScreenComponent :1217/:1234 make both alignments
//   ignore the declared `Position = new Vector2(0, 50)` (:99) exactly
//   as they do for the guild popup. The panel sits at
//   ((320-130)/2, (200-44)/2) = (95, 78).
// - the four buttons are panel-CHILD rects (:23-26), all 120 wide and
//   7 tall, stacked on a 9-pixel stride: room (5,5), talk (5,14),
//   food (5,23), exit (5,32). Unlike the guild popup's, the exit
//   button is a full-width row, not a small centred one.
// - the window draws NO TEXT of its own. Every word is in the art.
//
// The LAW is systems/tavern.js's (the rental ladder, the room cost's
// Heart's Day span, the menu prices and their two holiday arms); this
// file owns the panel, the hit rects and the box CHAIN, and it borrows
// U24's ServiceFlowWindow for that chain rather than growing a second
// one - the room flow is field -> YesNo -> message and the food flow
// is picker -> message, which is exactly what that window already is.
//
// THE ORDER-OF-CLOSING QUIRKS, which are the reason the chain is not
// just "open a box":
// - DoFoodAndDrink (:283) calls CloseWindow FIRST and only THEN tests
//   the hunger gate, so "You are not hungry." appears with the tavern
//   panel already gone. Verbatim.
// - ConfirmRenting_OnButtonClick (:212) likewise closes the tavern
//   window before it looks at the button, so declining the price
//   closes the tavern too rather than returning to the panel.
// - the gold test happens at the YES, not at the offer: DFU shows you
//   a price you cannot afford and tells you so only after you agree
//   to it (:214-222).
//
// The three clauses that stood here are all closed (D1):
// - the TALK button routes to TalkManager.TalkToStaticNPC (:263):
//   worldModes.js:2298 supplies `onTalk: () => openStaticNpc(pn,
//   { forceTalk: true })`, which this file consumes at :256 and :265.
// - AddPermanentScene (:246) shipped at P1 - systems/tavern.js:143
//   addPermanentScene / :93 removePermanentScene, with this window
//   handing rentRoom its sceneCache at :223. A rented room's CONTENTS
//   survive now, not just the rental.
// - the HOTKEYS: DaggerfallShortcut is indeed a SECOND binding table
//   next to I1's input registry, but it is a text database and not a
//   player keybind file (DaggerfallShortcut.cs:307-326 reads
//   StreamingAssets/Text/DialogShortcuts.txt), and A8 ported it to
//   systems/dialogShortcuts.js. The four bindings (:106, :111, :117,
//   :123) are the table's answers now. The correction the flag hid:
//   its "-- Taverns menu" block (:175-179) puts EXIT on G, not on the
//   E the port had assumed.

import { loadImg, nativeMetrics, drawImg } from './nativePanel.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { ServiceFlowWindow, macroRows } from './guildServiceWindows.js';
import { goldAmount, totalGoldAmount, deductGold } from '../systems/court.js';
import { dayOfYearFromMinutes } from '../systems/gameDate.js';
import { raceDisplayName, honorificOf } from '../systems/talkSession.js';
import { audio } from '../systems/audio.js';   // F145: the ButtonClick roster
import { SOUND } from '../systems/soundClips.js';
import { firstHotkey } from '../systems/dialogShortcuts.js';   // A8: the DaggerfallShortcut table
import {
  TOO_MANY_DAYS_ID, OFFER_PRICE_ID, NOT_ENOUGH_GOLD_ID,
  HOW_MANY_DAYS_ID, HOW_MANY_ADDITIONAL_DAYS_ID,
  ROOM_FREE_FOR_KNIGHT, ROOM_FREE_HEARTS_DAY, YOU_ARE_NOT_HUNGRY,
  TAVERN_MENU, removeExpiredRooms, findRentedRoom, roomRemainingHours,
  rentalDecision, rentRoom, canEat, eatOrDrink,
} from '../systems/tavern.js';

/** mainPanel.Size (:100) - and the size TVRN00I0.IMG actually ships. */
export const TAVERN_PANEL_W = 130, TAVERN_PANEL_H = 44;
/** Center/Middle on the 320x200 native panel (:96-97). */
export const TAVERN_PANEL_X = Math.round((320 - TAVERN_PANEL_W) / 2);   // 95
export const TAVERN_PANEL_Y = Math.round((200 - TAVERN_PANEL_H) / 2);   // 78

/** #region UI Rects (:23-26), panel-relative. */
export const TAVERN_RECTS = Object.freeze({
  room: [5, 5, 120, 7],
  talk: [5, 14, 120, 7],
  food: [5, 23, 120, 7],
  exit: [5, 32, 120, 7],
});

/** D1: the window's DaggerfallShortcut.Buttons in ctor ADD order
 *  (:103-124) - the order Panel.ProcessHotkeySequences asks them in.
 *  DialogShortcuts.txt:175-179 binds R / T / F / G. */
export const TAVERN_BUTTONS = Object.freeze([
  'TavernRoom', 'TavernTalk', 'TavernFood', 'TavernExit',
]);

/** TextBox.Numeric, MaxCharacters 3, Text "1" (:166-168). Three
 *  characters is not an accident: the ceiling is 350 days, so the
 *  field cannot even be typed past four digits. */
export const DAYS_FIELD = Object.freeze({ numeric: true, maxCharacters: 3, initial: '1' });

let _art = null;
export async function preloadTavernArt(deps) {
  if (_art) return;
  try {
    _art = await loadImg(deps, 'TVRN00I0.IMG');
  } catch { console.warn('[tavern] TVRN00I0 unavailable; the tavern popup stays text'); }
}
export const tavernArtLoaded = () => !!_art;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx + TAVERN_PANEL_X && y >= ry + TAVERN_PANEL_Y
  && x < rx + TAVERN_PANEL_X + rw && y < ry + TAVERN_PANEL_Y + rh;

/** A plain string as one centred row - the chain's own idiom. */
const line = (text) => [{ text, center: true }];

/**
 * hooks:
 *   entity            the player (gold, health, the rooms and the clock live on it)
 *   rows(textId)      -> [{text,center}]   the host's TEXT.RSC reader
 *   now()             -> classic minutes (the ONE clock; the day of
 *                        year for the room formula is derived from it)
 *   mapId(), buildingKey(), buildingName(), quality(), bedCount()
 *   freeRooms()       -> KnightlyOrder.FreeTavernRooms
 *   skills()          -> { mercantile, personality } for CalculateTradePrice
 *   heal(amount)      the host's SetHealth (clamped by the entity's law)
 *   onTalk(), onClose()
 *   rolls()           the bed-marker roll
 */
export class TavernWindow {
  constructor(hooks) {
    this.hooks = hooks;
    this.done = false;
    this.isChoiceWindow = true;   // raw codes through the overlay seam
    this.flow = null;             // the box chain, when one is up
  }

  _close() { this.done = true; this.hooks.onClose?.(); }

  /** TavernMacroDataSource (:369-386): Amount() is the trade price and
   *  RoomHoursLeft() is GetRemainingHours on THIS inn's room. Both go
   *  through the shared expander so the tavern's TEXT.RSC reads the
   *  same way every other service window's does. */
  _rows(id, { amount = null, room = null, now = 0 } = {}) {
    return macroRows(this.hooks.rows, id, {
      amount,
      roomHours: room ? roomRemainingHours(room, now) : null,
      gold: goldAmount(this.hooks.entity),
      playerName: this.hooks.entity?.name ?? '',
      race: raceDisplayName(this.hooks.entity?.race),
      honorific: honorificOf(this.hooks.entity?.gender),
    });
  }

  /** Every chain the two buttons raise runs in ONE ServiceFlowWindow.
   *  AUDIT 26 F143: only FOOD closes the tavern with its chain -
   *  DoFoodAndDrink calls CloseWindow FIRST (:286). The ROOM button
   *  never does: its input box closes ITSELF before the handler runs
   *  (DaggerfallInputMessageBox.cs:298-304), invalid input and the
   *  350-day refusal just return (:176-178, :188-191), and
   *  ConfirmRenting's CloseWindow (:212) pops the just-pushed price
   *  box - UserInterfaceWindow.CloseWindow pops the stack's TOP
   *  (:127-132) - so every ending of the rental chain lands back on
   *  the four-button panel. The old header claimed both buttons
   *  close-before-chain, and every rental ending tore the tavern down. */
  _chain(boxes, { closesTavern = false } = {}) {
    if (!boxes?.length) { this.flow = null; if (closesTavern) this._close(); return; }
    this.flow = new ServiceFlowWindow(boxes, {
      onClose: () => { this.flow = null; if (closesTavern) this._close(); },
    });
  }

  /** RoomButton_OnMouseClick (:153-171). The expiry sweep runs FIRST,
   *  so a room that ran out reads as a fresh rental (a different
   *  prompt: 5102 "how many days" rather than 5100 "how many
   *  additional days") instead of silently extending nothing. */
  _room() {
    const h = this.hooks;
    const now = h.now();
    h.entity.rentedRooms = removeExpiredRooms(h.entity.rentedRooms ?? [], now, h.sceneCache?.());
    const room = findRentedRoom(h.entity.rentedRooms, h.mapId(), h.buildingKey());
    this._chain([{
      // 5100 quotes the hours left (%dwr); 5102 has no room to quote.
      rows: this._rows(room ? HOW_MANY_ADDITIONAL_DAYS_ID : HOW_MANY_DAYS_ID, { room, now }),
      field: DAYS_FIELD,
      onInput: (text) => this._decide(text, room, now),
    }]);
  }

  /** InputMessageBox_OnGotUserInput (:173-208), through the law. */
  _decide(text, room, now) {
    const h = this.hooks;
    // The day of year comes off the SAME classic-minute counter as
    // everything else here rather than from a second `date()` hook -
    // DFU reads one WorldTime, and two clocks is how a room's Heart's
    // Day and a meal's holiday end up disagreeing.
    const d = rentalDecision(text, {
      room, nowMinutes: now, date: { dayOfYear: dayOfYearFromMinutes(now) },
      quality: h.quality?.() ?? 0, free: !!h.freeRooms?.(), skills: h.skills?.(),
    });
    if (d.kind === 'ignore') return null;          // int.TryParse: nothing at all
    if (d.kind === 'tooMany') return [{ rows: this._rows(TOO_MANY_DAYS_ID, { room, now }) }];
    if (d.kind === 'free') {
      this._rent(room, d.days);
      return [{ rows: line(ROOM_FREE_FOR_KNIGHT) }];
    }
    // The Heart's Day free room is a box DFU pops from INSIDE
    // CalculateRoomCost (:1871), i.e. BEFORE the price offer - so the
    // player sees it and is then still asked to confirm a 0-gold room.
    const offer = {
      rows: this._rows(OFFER_PRICE_ID, { amount: d.price, room, now }),
      buttons: 'YesNo',
      onYes: () => this._confirm(room, d),
      onNo: () => null,      // the chain empties, which closes the tavern (:212)
    };
    return d.heartsDay ? [{ rows: line(ROOM_FREE_HEARTS_DAY) }, offer] : [offer];
  }

  /** ConfirmRenting_OnButtonClick's Yes arm (:213-223). */
  _confirm(room, d) {
    const h = this.hooks;
    // AUDIT 26 F103: both tavern gates read GetGoldAmount - coins plus
    // letters (DaggerfallTavernWindow.cs:218, :324); the payment
    // spends letters through deductGold either way.
    if (totalGoldAmount(h.entity) < d.price) return [{ rows: this._rows(NOT_ENOUGH_GOLD_ID, { amount: d.price }) }];
    deductGold(h.entity, d.price);
    this._rent(room, d.days);
    return null;
  }

  _rent(room, days) {
    const h = this.hooks;
    h.entity.rentedRooms = h.entity.rentedRooms ?? [];
    rentRoom(h.entity.rentedRooms, {
      room, days, nowMinutes: h.now(),
      mapId: h.mapId(), buildingKey: h.buildingKey(),
      name: h.buildingName?.() ?? '', bedCount: h.bedCount?.() ?? 1,
      rolls: h.rolls ?? Math.random,
      sceneCache: h.sceneCache?.() ?? null,   // P1: the room's interior is HELD while rented
    });
  }

  /** DoFoodAndDrink (:283-300) - note the window is already closing. */
  _food() {
    const h = this.hooks;
    const now = h.now();
    if (!canEat(h.entity.lastTimePlayerAteOrDrankAtTavern, now)) {
      this._chain([{ rows: line(YOU_ARE_NOT_HUNGRY) }], { closesTavern: true });   // F143: food closes (:286)
      return;
    }
    this._chain([{
      picker: [...TAVERN_MENU],
      onPick: (i) => {
        audio.playOneShot(SOUND.ButtonClick, 1);   // F145: FoodAndDrink_OnItemPicked (:307)
        const r = eatOrDrink(i, { gold: totalGoldAmount(h.entity), gameMinutes: now });   // F103: GetGoldAmount (:324)
        if (r.kind === 'ignore') return null;
        if (r.kind === 'poor') return [{ rows: this._rows(NOT_ENOUGH_GOLD_ID) }];
        if (r.spend) deductGold(h.entity, r.spend);
        h.heal?.(r.heal);
        h.entity.lastTimePlayerAteOrDrankAtTavern = now;
        return null;             // DFU shows nothing at all on a meal
      },
      onCancel: () => null,
    }], { closesTavern: true });   // F143: DoFoodAndDrink's CloseWindow-first (:286)
  }

  input(code, e = null) {
    if (this.flow) { this.flow.input(code, e); return; }
    // Escape/Enter are the port host's close keys, not DFU buttons.
    if (code === 'Escape' || code === 'Enter') { this._close(); return; }
    // D1: the four Hotkeys, from the table, in DFU's button ADD order.
    const hit = firstHotkey(TAVERN_BUTTONS, code, e);
    if (hit === null) return;
    // F145 on the KEYBOARD side: Talk/Food/Exit play ButtonClick in
    // their OnKeyboardEvent KeyDown arm, and Room - the one button
    // with no OnKeyboardEvent handler - reaches its OnMouseClick
    // through the faked click (Button.cs:85-90), sound included.
    audio.playOneShot(SOUND.ButtonClick, 1);
    switch (hit) {
      case 'TavernRoom': this._room(); return;
      case 'TavernTalk': this.hooks.onTalk?.(); this._close(); return;
      case 'TavernFood': this._food(); return;
      default: this._close();   // TavernExit
    }
  }

  click(vx, vy) {
    if (this.flow) return this.flow.click(vx, vy);
    // F145: PlayOneShot(SoundClips.ButtonClick) heads all four handlers
    // (Exit :135, Room :155, Talk :264, Food :339).
    if (inRect(TAVERN_RECTS.room, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._room(); return true; }
    if (inRect(TAVERN_RECTS.talk, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this.hooks.onTalk?.(); this._close(); return true; }
    if (inRect(TAVERN_RECTS.food, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._food(); return true; }
    if (inRect(TAVERN_RECTS.exit, vx, vy)) { audio.playOneShot(SOUND.ButtonClick, 1); this._close(); return true; }
    return false;
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    const m = nativeMetrics(canvas);
    // AUDIT 19 F2: DaggerfallBaseWindow's parentPanel is opaque BLACK.
    drawMenuBackdrop(renderer, canvas);
    // Both buttons close the tavern before their chain runs, so the
    // panel is NOT drawn under a live box - DFU's CloseWindow has
    // already taken it off the stack.
    if (this.flow) { this.flow.draw(renderer, canvas, font); return; }
    drawImg(renderer, _art, m, TAVERN_PANEL_X, TAVERN_PANEL_Y);
  }
}
