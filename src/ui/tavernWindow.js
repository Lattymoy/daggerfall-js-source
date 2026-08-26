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
// just "open a box". CloseWindow() is uiManager.PopWindow()
// (UserInterfaceWindow.cs:127-130) - it pops whatever is on TOP, not
// the instance that called it, and that is what decides each ending:
// - DoFoodAndDrink (:283) calls CloseWindow FIRST, while the tavern
//   IS the top window, and only THEN tests the hunger gate - so "You
//   are not hungry." and the whole food chain run with the tavern
//   panel already gone. Verbatim.
// - the ROOM chain never closes the tavern at all. RoomButton
//   (:153-171) only pushes the input box; that box CLOSES ITSELF
//   before it raises OnGotUserInput (DaggerfallInputMessageBox.cs
//   :298-301), so the refusals at :176-178 and :188-191 land with the
//   tavern topmost. ConfirmRenting_OnButtonClick's CloseWindow()
//   (:214) pops the price box pushed at :208 - DaggerfallMessageBox
//   does NOT self-close, it only raises the event (:479-484) - so it
//   too leaves the tavern standing. Rent, decline, over-rent or
//   mistype, the player lands back on the four-button panel.
// - the gold test happens at the YES, not at the offer: DFU shows you
//   a price you cannot afford and tells you so only after you agree
//   to it (:216-224).
//
// FLAGGED, with the slices they wait on:
// - the TALK button routes to TalkManager.TalkToStaticNPC (:263); the
//   host supplies that hook, exactly as the guild popup's does.
// - DFU binds each button to a DaggerfallShortcut hotkey (:103-121)
//   read from the player's own keybind file. I1 built the registry but
//   DaggerfallShortcut is a SECOND, separate binding table; the
//   accelerators here are the port's own (Ledger A).
// - AddPermanentScene (:246) keeps a rented room's interior loaded
//   across a save. The port has no permanent-scene set, so a rented
//   room's CONTENTS are not preserved - the rental is.

import { loadImg, nativeMetrics, drawImg } from './nativePanel.js';
import { drawScreenDimBackdrop } from './chargenArt.js';
import { ServiceFlowWindow, macroRows } from './guildServiceWindows.js';
import { goldAmount, totalGoldAmount, deductGold } from '../systems/court.js';
import { dayOfYearFromMinutes } from '../systems/gameDate.js';
import { raceDisplayName, honorificOf } from '../systems/talkSession.js';
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
    this._flowOverPanel = false;  // ...and whether the panel is still under it
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
   *  WHICH WINDOW OUTLIVES IT is the button's, not the chain's:
   *  DoFoodAndDrink popped the tavern before its first box existed
   *  (:283), so the FOOD chain's end is the end of the tavern; the
   *  ROOM chain was only ever pushed OVER the tavern, so its end
   *  hands the four-button panel back (see the header). */
  _chain(boxes, { closesTavern = true } = {}) {
    if (!boxes?.length) { if (closesTavern) this._close(); return; }
    // A chain the tavern outlives is a chain pushed OVER it, so the
    // panel is what its boxes are drawn on top of.
    this._flowOverPanel = !closesTavern;
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
    }], { closesTavern: false });
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
      onNo: () => null,      // the chain empties back onto the panel (:214)
    };
    return d.heartsDay ? [{ rows: line(ROOM_FREE_HEARTS_DAY) }, offer] : [offer];
  }

  /** ConfirmRenting_OnButtonClick's Yes arm (:213-223). */
  _confirm(room, d) {
    const h = this.hooks;
    // GetGoldAmount (:218) - coins PLUS letters of credit
    // (PlayerEntity.cs:1313-1316), not GoldPieces. DeductGoldAmount
    // on the next line spends letters, so a coins-only gate refuses a
    // room the very next line could pay for.
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
      this._chain([{ rows: line(YOU_ARE_NOT_HUNGRY) }]);
      return;
    }
    this._chain([{
      picker: [...TAVERN_MENU],
      onPick: (i) => {
        // FoodAndDrink_OnItemPicked's gate is GetGoldAmount too (:324),
        // and its DeductGoldAmount (:331) spends the same letters.
        const r = eatOrDrink(i, { gold: totalGoldAmount(h.entity), gameMinutes: now });
        if (r.kind === 'ignore') return null;
        if (r.kind === 'poor') return [{ rows: this._rows(NOT_ENOUGH_GOLD_ID) }];
        if (r.spend) deductGold(h.entity, r.spend);
        h.heal?.(r.heal);
        h.entity.lastTimePlayerAteOrDrankAtTavern = now;
        return null;             // DFU shows nothing at all on a meal
      },
      onCancel: () => null,
    }]);
  }

  input(code, e = null) {
    if (this.flow) { this.flow.input(code, e); return; }
    // The port's own accelerators (Ledger A - DFU reads DaggerfallShortcut).
    if (code === 'Escape' || code === 'Enter' || code === 'KeyE') { this._close(); return; }
    if (code === 'KeyR') { this._room(); return; }
    if (code === 'KeyT') { this.hooks.onTalk?.(); this._close(); return; }
    if (code === 'KeyF') this._food();
  }

  click(vx, vy) {
    if (this.flow) return this.flow.click(vx, vy);
    if (inRect(TAVERN_RECTS.room, vx, vy)) { this._room(); return true; }
    if (inRect(TAVERN_RECTS.talk, vx, vy)) { this.hooks.onTalk?.(); this._close(); return true; }
    if (inRect(TAVERN_RECTS.food, vx, vy)) { this._food(); return true; }
    if (inRect(TAVERN_RECTS.exit, vx, vy)) { this._close(); return true; }
    return false;
  }

  draw(renderer, canvas, font) {
    if (!_art) { this._close(); return; }
    const m = nativeMetrics(canvas);
    // This window's OWN constructor overrides DaggerfallBaseWindow's
    // black parent panel: `ParentPanel.BackgroundColor = Color.clear;`
    // (:84). The inn behind the 130x44 panel stays visible.
    drawScreenDimBackdrop(renderer, canvas);
    // The FOOD chain's boxes stand alone - DoFoodAndDrink popped the
    // tavern before the first of them existed (:283). The ROOM
    // chain's are pushed OVER the tavern, and DaggerfallPopupWindow
    // .Draw (:77-84) draws its previousWindow first, so the panel is
    // still there underneath.
    if (this.flow) {
      if (this._flowOverPanel) drawImg(renderer, _art, m, TAVERN_PANEL_X, TAVERN_PANEL_Y);
      this.flow.draw(renderer, canvas, font);
      return;
    }
    drawImg(renderer, _art, m, TAVERN_PANEL_X, TAVERN_PANEL_Y);
  }
}
