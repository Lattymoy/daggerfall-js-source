// W1-ii: THE TRAVEL POPUP - DaggerfallTravelPopUp.cs (MIT,
// Daggerfall Workshop; original author Lypyl) on the real
// TRAV0I04.IMG. The F-slice collected these three choices on single
// keys over a text panel; this is the classic window itself, laid
// out rect for rect, with the LAWS still living in
// systems/travel.js exactly as C# leaves them in
// TravelTimeCalculator.
//
// THE NATIVE-WINDOW RULE, element by element:
// - the art panel is TRAV0I04.IMG at (49, 28, 223, 97) (:54).
// - three TOGGLE PANELS, 4.75x4.75 virtual px of flat (85,117,48)
//   green, parked over whichever option is live (:64-71, :261-275).
//   DFU prefers a "GreenCheckbox" texture out of its own Resources
//   folder and falls back to that colour when it is missing
//   (:155-161); the port has no DFU asset bundle, so the colour arm
//   is the only arm - recorded, not a departure of behaviour.
// - the three labels at their own anchors (:133-139): available
//   gold (148,97), trip cost (117,107), travel time in DAYS
//   (129,117), all DaggerfallUI.AddTextLabel - which means the
//   DEFAULT shadowed style (TextLabel.cs:40-42), not a plain draw.
// - six option buttons in two columns (:57-62) and BEGIN/EXIT at
//   the right (:55-56); the hotkeys are DialogShortcuts' own - B
//   begin, E exit, S speed, T transport, N inn/camp out.
//
// THE FLOW, law for law:
// - defaults are cautious / SHIP / inns (:85-87). The F-slice window
//   defaulted travelShip false; DFU's field is true and the toggle
//   panel starts on the ship row.
// - a CLICK on one of a pair picks that pair member (sender ==
//   button, :382-425); the HOTKEY toggles instead (:387-391 and the
//   scroll handlers), so S/T/N flip and the clicks assign.
// - BEGIN refreshes, then warns when the player carries a disease or
//   poison (a random TEXT.RSC 1010 variant behind Yes/No, :351-364)
//   before the gold check; not enough gold shows TEXT.RSC 454 and
//   refuses (:388-403, :458-468).
// - travel then runs DFU's countdown: one day per 0.05s of REAL
//   time ticked off the days label, and only when it empties does
//   the trip happen (:229-246, :305-320).
// - the ARRIVAL is the host's (scenes/world.js fastTravelTo) - the
//   F-slice put performFastTravel's order there and it stays there.
//
// THE GOLD IS TWO POOLS, not one. GetGoldAmount is coins plus every
// letter of credit in the pack (PlayerEntity.cs:1313-1316 over
// ItemCollection.GetCreditAmount), and DeductFastTravelGold takes
// the INN NIGHTS out of coins alone before letting the rest reach
// the letters (:469-473) - "Taverns only accept gold pieces". The
// port has letters as real tender (court.js's DeductGoldAmount
// spends them), so both halves are live here and in the host's
// deduction; the label above shows the COINS, as DFU's does.
//
// FLAGGED, each idling loudly: the HUD smash-to-black/fade
// (:242, :382 - no fade layer in the port), GuildManager
// .FastTravel's membership discount (:280 - no guild perk seam),
// RaiseSkills on arrival (:380), and EXIT's key-UP deferral
// (:482-495: DFU plays the click on key-down and pops the window on
// key-up, so holding E keeps the popup; the port's overlay seam has
// no key-up edge, so E closes on the down stroke).

import { loadImg, nativeMetrics, drawImg, drawRect, shadowText } from './nativePanel.js';
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS, messageBoxArtLoaded } from './messageBox.js';
import { drawText } from './text.js';
import { calculateTravelTime, calculateTripCost, travelDays } from '../systems/travel.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

/** nativePanelRect and the button rects (:54-62). */
export const POPUP_RECTS = Object.freeze({
  native: [49, 28, 223, 97],
  exit: [222, 112, 48, 10],
  begin: [222, 98, 48, 10],
  cautious: [50, 51, 108, 9],
  reckless: [50, 61, 108, 9],
  footHorse: [163, 51, 108, 9],
  ship: [163, 61, 108, 9],
  inns: [50, 83, 108, 9],
  campout: [163, 83, 108, 9],
});

/** colorPanelSize and the six toggle anchors (:64-71). */
export const TOGGLE_SIZE = 4.75;
export const TOGGLE_POS = Object.freeze({
  cautious: [52.25, 53],
  reckless: [52.25, 63.25],
  inn: [52.25, 85.5],
  campout: [165, 85.5],
  foot: [165, 53],
  ship: [165, 63.25],
});
/** toggleColor (:34) - named for the window because the pause
 *  screen owns the plain TOGGLE_COLOR (the one-home rule). */
export const TRAVEL_TOGGLE_COLOR = Object.freeze([85 / 255, 117 / 255, 48 / 255, 1]);
/** The three label anchors (:133-139). */
export const LABEL_POS = Object.freeze({ gold: [148, 97], cost: [117, 107], time: [129, 117] });
/** secondsCountdownTickFastTravel (:31). */
export const COUNTDOWN_TICK = 0.05;
/** notEnoughGoldTextId (:396) and the diseased warning's record (:422). */
export const NOT_ENOUGH_GOLD_TEXT_ID = 454;
export const DISEASED_WARNING_TEXT_ID = 1010;

const inRect = ([rx, ry, rw, rh], x, y) => x >= rx && y >= ry && x < rx + rw && y < ry + rh;

let _art = null;
export async function preloadTravelPopUpArt(deps) {
  if (!_art) _art = { travel: await loadImg(deps, 'TRAV0I04.IMG') };
  return _art;
}
export const travelPopUpArtLoaded = () => !!_art;
/** Tests reach the loaded art through the same door the window does. */
export function _setTravelPopUpArtForTests(art) { _art = art; }

export class TravelPopUpWindow {
  /** endPos: the destination MAP PIXEL {x, y}. deps:
   *  { getPlayerPixel, getClimateIndex, gold, goldPieces, hasHorse,
   *    hasCart, hasShip, diseaseCount, textRsc, pick, onTravel,
   *    onExit }. */
  constructor(endPos, deps = {}) {
    this.endPos = endPos;
    this.deps = deps;
    this.done = false;
    this.isChoiceWindow = true;
    // OnPush (:212-223) reads the transport the player owns, ONCE, as
    // the window is pushed - a horse bought mid-trip is not a thing.
    const own = (v) => !!(typeof v === 'function' ? v() : v);
    this.hasHorse = own(deps.hasHorse);
    this.hasCart = own(deps.hasCart);
    this.hasShip = own(deps.hasShip);
    // (:85-87)
    this.speedCautious = true;
    this.travelShip = true;
    this.sleepModeInn = true;
    this.travelTimeTotalMins = 0;
    this.countdownValueTravelTimeDays = 0;
    this.doFastTravel = false;
    this.waitTimer = 0;
    this.trip = { piecesCost: 0, totalCost: 0, minutes: 0, oceanPixels: 0 };
    this.lastMousePos = [-1, -1];
    this.top = null;          // 'diseased' | 'gold' - the two pushed boxes
    this._box = null;
    this.refresh();
  }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  /** Refresh -> UpdateTogglePanels + UpdateLabels (:254-258). The
   *  toggle panels are positional state, so only the labels compute. */
  refresh() {
    const t = calculateTravelTime(this.deps.getPlayerPixel(), this.endPos, {
      speedCautious: this.speedCautious,
      sleepModeInn: this.sleepModeInn,
      travelShip: this.travelShip,
      hasHorse: this.hasHorse,
      hasCart: this.hasCart,
    }, this.deps.getClimateIndex);
    this.travelTimeTotalMins = t.minutes;   // GuildManager.FastTravel (:284) FLAGGED
    const c = calculateTripCost(this.travelTimeTotalMins, t.oceanPixels, {
      sleepModeInn: this.sleepModeInn,
      hasShip: this.hasShip,
      travelShip: this.travelShip,
    });
    this.trip = { ...t, ...c };
    this.countdownValueTravelTimeDays = travelDays(this.travelTimeTotalMins);
  }

  /** enoughGoldCheck (:388-392). BOTH halves: GetGoldAmount (coins
   *  plus letters of credit) must cover the whole trip, and the
   *  COINS alone must cover the inn nights - "Taverns only accept
   *  gold pieces" is the comment above it and the reason the test is
   *  two-sided. */
  enoughGoldCheck() {
    const total = this.deps.gold?.() ?? 0;
    const pieces = this.deps.goldPieces?.() ?? total;
    return total >= this.trip.totalCost && pieces >= this.trip.piecesCost;
  }

  /** BeginButtonOnClickHandler (:413-433). */
  begin() {
    this.refresh();
    this._click();
    // DiseaseCount > 0 || PoisonCount > 0 (:419-420)
    if ((this.deps.diseaseCount?.() ?? 0) > 0 || (this.deps.poisonCount?.() ?? 0) > 0) {
      this.top = 'diseased';
      return;
    }
    this.callFastTravelGoldCheck();
  }

  /** CallFastTravelGoldCheck (:458-468). */
  callFastTravelGoldCheck() {
    if (!this.enoughGoldCheck()) { this.top = 'gold'; return; }
    this.doFastTravel = true;
  }

  /** ExitButtonOnClickHandler / CancelWindow (:475-480, :435-441). */
  exit() {
    this._click();
    this.doFastTravel = false;
    this.done = true;
    this.deps.onExit?.();
  }

  input(code, e = null) {
    const key = typeof code === 'string' ? code : '';
    if (this.top === 'diseased') {
      // ConfirmTravelPopupDiseasedButtonClick (:445-457)
      if (key === 'KeyY') { this._click(); this.top = null; this.callFastTravelGoldCheck(); return; }
      if (key === 'KeyN' || key === 'Escape') { this._click(); this.top = null; }
      return;
    }
    if (this.top === 'gold') { this.top = null; return; }   // ClickAnywhereToClose (:403)
    if (key === 'Escape') { this.exit(); return; }
    switch (key) {
      case 'KeyB': this.begin(); return;                                            // TravelBegin
      case 'KeyE': this.exit(); return;                                             // TravelExit
      case 'KeyS': this._click(); this.speedCautious = !this.speedCautious; this.refresh(); return;
      case 'KeyT': this._click(); this.travelShip = !this.travelShip; this.refresh(); return;
      case 'KeyN': this._click(); this.sleepModeInn = !this.sleepModeInn; this.refresh(); return;
      default: break;   // DFU offers no other accelerator on this window
    }
    void e;
  }

  click(vx, vy) {
    if (this.top === 'diseased') {
      const hit = this._box ? messageBoxHit(this._box, vx, vy) : null;
      if (hit === MB_BUTTONS.Yes) this.input('KeyY');
      else if (hit === MB_BUTTONS.No) this.input('KeyN');
      return true;
    }
    if (this.top === 'gold') { this.top = null; return true; }
    if (inRect(POPUP_RECTS.begin, vx, vy)) { this.begin(); return true; }
    if (inRect(POPUP_RECTS.exit, vx, vy)) { this.exit(); return true; }
    // The click handlers ASSIGN (sender == button); only the hotkeys
    // toggle (:497-556).
    if (inRect(POPUP_RECTS.cautious, vx, vy)) { this._click(); this.speedCautious = true; this.refresh(); return true; }
    if (inRect(POPUP_RECTS.reckless, vx, vy)) { this._click(); this.speedCautious = false; this.refresh(); return true; }
    if (inRect(POPUP_RECTS.ship, vx, vy)) { this._click(); this.travelShip = true; this.refresh(); return true; }
    if (inRect(POPUP_RECTS.footHorse, vx, vy)) { this._click(); this.travelShip = false; this.refresh(); return true; }
    if (inRect(POPUP_RECTS.inns, vx, vy)) { this._click(); this.sleepModeInn = true; this.refresh(); return true; }
    if (inRect(POPUP_RECTS.campout, vx, vy)) { this._click(); this.sleepModeInn = false; this.refresh(); return true; }
    return true;
  }

  /** The cursor, for the wheel below. */
  hover(vx, vy) { this.lastMousePos = [vx, vy]; }

  /** Every one of the six option buttons carries OnMouseScrollUp and
   *  OnMouseScrollDown, and all three handlers TOGGLE the pair
   *  (:497-556) - so a wheel notch over either member of a pair
   *  flips it, in either direction. */
  wheel(dir) {
    if (!dir || this.top) return;
    const [vx, vy] = this.lastMousePos;
    if (inRect(POPUP_RECTS.cautious, vx, vy) || inRect(POPUP_RECTS.reckless, vx, vy)) {
      this._click(); this.speedCautious = !this.speedCautious; this.refresh();
    } else if (inRect(POPUP_RECTS.footHorse, vx, vy) || inRect(POPUP_RECTS.ship, vx, vy)) {
      this._click(); this.travelShip = !this.travelShip; this.refresh();
    } else if (inRect(POPUP_RECTS.inns, vx, vy) || inRect(POPUP_RECTS.campout, vx, vy)) {
      this._click(); this.sleepModeInn = !this.sleepModeInn; this.refresh();
    }
  }

  /** Update (:229-246) - the countdown, then the trip. */
  tick(dt) {
    if (!this.doFastTravel) return;
    this.waitTimer += dt;
    if (this.countdownValueTravelTimeDays > 0) {
      if (this.waitTimer > COUNTDOWN_TICK) {
        this.waitTimer = 0;
        this.countdownValueTravelTimeDays--;
      }
      return;
    }
    this.doFastTravel = false;
    this.done = true;
    this.deps.onTravel?.(this.endPos, {
      speedCautious: this.speedCautious,
      sleepModeInn: this.sleepModeInn,
      travelShip: this.travelShip,
    }, { ...this.trip, minutes: this.travelTimeTotalMins });
  }

  /** The two pushed boxes' rows, off TEXT.RSC. */
  _boxRows() {
    const t = this.deps.textRsc;
    if (this.top === 'diseased') {
      return t?.variantLinesById?.(DISEASED_WARNING_TEXT_ID, this.deps.pick ?? Math.random)
        ?? ['You are diseased. Travel anyway?'];
    }
    return t?.linesById?.(NOT_ENOUGH_GOLD_TEXT_ID) ?? ['You do not have enough gold.'];
  }

  draw(renderer, canvas, font) {
    const m = nativeMetrics(canvas);
    if (_art) {
      drawImg(renderer, _art.travel, m, POPUP_RECTS.native[0], POPUP_RECTS.native[1],
        POPUP_RECTS.native[2], POPUP_RECTS.native[3]);
    } else {
      drawRect(renderer, m, ...POPUP_RECTS.native, [0.05, 0.04, 0.03, 0.95]);
    }
    // UpdateTogglePanels (:261-275)
    const speed = this.speedCautious ? TOGGLE_POS.cautious : TOGGLE_POS.reckless;
    const sleep = this.sleepModeInn ? TOGGLE_POS.inn : TOGGLE_POS.campout;
    const transport = this.travelShip ? TOGGLE_POS.ship : TOGGLE_POS.foot;
    for (const [x, y] of [speed, sleep, transport]) {
      drawRect(renderer, m, x, y, TOGGLE_SIZE, TOGGLE_SIZE, TRAVEL_TOGGLE_COLOR);
    }
    if (!font) return;
    // UpdateLabels (:278-303)
    // availableGoldLabel is PlayerEntity.GoldPieces (:280) - the
    // COINS, not GetGoldAmount's coins-plus-letters total.
    const pieces = this.deps.goldPieces?.() ?? this.deps.gold?.() ?? 0;
    shadowText(renderer, font, String(pieces), m, LABEL_POS.gold[0], LABEL_POS.gold[1]);
    shadowText(renderer, font, String(this.trip.totalCost), m, LABEL_POS.cost[0], LABEL_POS.cost[1]);
    shadowText(renderer, font, String(this.countdownValueTravelTimeDays), m, LABEL_POS.time[0], LABEL_POS.time[1]);
    if (!_art) {
      // art-less fallback: the option rows the classic art labels
      const rows = [
        [`Cautiously ${this.speedCautious ? '*' : ''}`, POPUP_RECTS.cautious],
        [`Recklessly ${this.speedCautious ? '' : '*'}`, POPUP_RECTS.reckless],
        [`Foot/horse ${this.travelShip ? '' : '*'}`, POPUP_RECTS.footHorse],
        [`Ship ${this.travelShip ? '*' : ''}`, POPUP_RECTS.ship],
        [`Inns ${this.sleepModeInn ? '*' : ''}`, POPUP_RECTS.inns],
        [`Camp out ${this.sleepModeInn ? '' : '*'}`, POPUP_RECTS.campout],
        ['Begin (B)', POPUP_RECTS.begin], ['Exit (E)', POPUP_RECTS.exit],
      ];
      for (const [label, r] of rows) shadowText(renderer, font, label, m, r[0] + 8, r[1]);
    }
    if (this.top) {
      const buttons = this.top === 'diseased' ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : [];
      this._box = layoutMessageBox(font, this._boxRows(), buttons);
      if (!messageBoxArtLoaded() || !drawMessageBox(renderer, m, font, this._box)) {
        const rows = this._box.rows ?? [];
        rows.forEach((r, i) => drawText(renderer, font, r.text ?? r,
          m.ox + 20 * m.s, m.oy + (20 + i * 10) * m.s, m.s, [0.9, 0.9, 0.75, 1]));
      }
    } else this._box = null;
  }
}
