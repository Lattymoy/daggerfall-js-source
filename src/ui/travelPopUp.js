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
//   begin, E exit, S speed, T transport, N inn/camp out - and since
//   A8 they are READ from that table (systems/dialogShortcuts.js)
//   rather than transcribed into this file.
//
// THE FLOW, law for law:
// - defaults are cautious / SHIP / inns (:85-87). The F-slice window
//   defaulted travelShip false; DFU's field is true and the toggle
//   panel starts on the ship row.
// - a CLICK on one of a pair picks that pair member (sender ==
//   button: :501, :521, :541 inside the handler block :497-556);
//   the HOTKEY toggles instead (:505-509, :525-529, :545-549), so
//   S/T/N flip where the clicks assign.
// - BEGIN refreshes, then warns when the player carries a disease or
//   poison (a random TEXT.RSC 1010 variant behind Yes/No, :421-427)
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
// TP1 landed two of these: GuildManager.FastTravel's membership
// discount (:284 - the Temple of Akatosh's, the only one in the game)
// and RaiseSkills on arrival (:380), both of whose "no seam yet"
// blockers had retired without the sentence moving.
//
// D4 CLOSED BOTH OF THIS WINDOW'S LAST TWO SENTENCES.
//
// THE SMASH AND THE FADE (:242, :381). ui/fadeLayer.js is
// FadeBehaviour.cs whole; the smash is where Update puts it - the
// frame the countdown reaches zero, immediately before
// performFastTravel - and the fade from black is the last thing
// performFastTravel does (:381), which is the host's half of that
// method (scenes/world.js `fastTravelTo`) exactly as the arrival order
// has been since the F-slice. So the days tick down, the screen
// smashes black on the last one, and the new pixel fades up.
//
// EXIT'S KEY-UP DEFERRAL (:482-495). A DFU Button raises
// OnKeyboardEvent for BOTH edges of its Hotkey and only falls back to
// a faked click on key-down when nothing is subscribed
// (Button.cs:79-92). Four of this window's buttons subscribe. THREE of
// them - speed, transport, inn/camp - act on KeyDown only (:504-508,
// :524-528, :544-548), which is what the port already did. EXIT is
// the one that splits: KeyDown plays ButtonClick and arms
// `isCloseWindowDeferred`, KeyUP clears the flag, kills doFastTravel
// and pops the window. So E held down is a popup that stays open with
// its click already played, and the window closes on the release.
// `keyup` below is that edge; ui/travelMapWindow.js routes it and the
// townTalk overlay seam forwards it from the hosts' existing keyup
// listeners, which had bound the edge and never used it.

import { loadImg, nativeMetrics, drawImg, drawRect, shadowText, NATIVE_W } from './nativePanel.js';   // OL2: the online line, centred under the panel
import { hudFade } from './fadeLayer.js';   // D4: FadeBehaviour
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS, messageBoxArtLoaded } from './messageBox.js';
import { drawText } from './text.js';
import { calculateTravelTime, calculateTripCost, travelDays } from '../systems/travel.js';
import { guildFastTravel } from '../systems/guildVariants.js';   // TP1: GuildManager.FastTravel
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';
import { firstHotkey } from '../systems/dialogShortcuts.js';   // A8: the DaggerfallShortcut table
// TO1: Travel Options' own popup - TravelOptionsPopUp.cs. Which of the
// two journeys a trip takes is decided HERE, by the three toggles
// against the player's settings, and the fare is scaled here too.
import { TRAVEL_OPTIONS_TEXT as TO_TEXT, format as toFormat } from '../systems/travelOptionsText.js';
import { hasPort } from '../systems/travelPorts.js';
import { calculateTradePrice } from '../systems/shopStock.js';   // TravelTimeCalculatorTO's FormulaHelper.CalculateTradePrice
import { liveStat } from '../systems/statMods.js';

/** The five Hotkey assignments this window makes, in DFU's own setup
 *  order (:167, :171, :176, :188, :200) - Panel.ProcessHotkeySequences
 *  walks a screen's buttons in order and stops at the first hit. */
const TRAVEL_BUTTONS = Object.freeze([
  'TravelBegin', 'TravelExit', 'TravelSpeedToggle',
  'TravelTransportModeToggle', 'TravelInnCampOutToggle',
]);

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
/** OL2: the line under the panel while the trip takes no world time. */
export const ONLINE_TRAVEL_LINE = 'Online: the world\'s clock does not wait. You arrive now, and no inn is paid.';
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

// AUDIT-TO1 C2: THE SHIP LAWS AS PURE FUNCTIONS, so the enhanced map's
// travel card (ui/heldMap.js, the DEFAULT skin) runs exactly the
// ones the classic popup runs. Before this the ports restriction did
// not exist on the default skin at all.

/** :85-89, IsNotAtPort. `here == null` is the C#'s `!location.Loaded`
 *  - open wilderness is not a port. */
export function isNotAtPort(currentLocationMapId) {
  return currentLocationMapId == null || !hasPort(currentLocationMapId);
}
/** :91-94, HasNoOceanTravel. */
export function hasNoOceanTravel(oceanPixels, isOnShip, destinationMapId) {
  return (oceanPixels ?? 0) === 0 && !isOnShip && !hasPort(destinationMapId);
}
/** :96-99, IsDestNotValidPort. */
export function isDestNotValidPort(settings, destinationMapId) {
  return !!settings?.shipTravelDestinationPortsOnly && !hasPort(destinationMapId);
}
/** :168-180, IsShipTravelValid's three refusals in the mod's order:
 *  'noport' | 'nodestport' | 'nosailing' | null. */
export function shipTravelRefusal({ settings, currentLocationMapId, isOnShip = false, destinationMapId, oceanPixels = 0 }) {
  if (isNotAtPort(currentLocationMapId)) return 'noport';
  if (isDestNotValidPort(settings, destinationMapId)) return 'nodestport';
  if (hasNoOceanTravel(oceanPixels, isOnShip, destinationMapId)) return 'nosailing';
  return null;
}
/** :80-83, IsPlayerControlledTravel over three toggles - the whole fork
 *  between a walked trip and DFU's fast travel, shared with the
 *  enhanced map so both skins answer the same word. */
export function isPlayerControlledTravel(settings, { speedCautious, sleepModeInn, travelShip }) {
  if (!settings) return false;
  return (settings.cautiousTravel || !speedCautious) && (settings.stopAtInnsTravel || !sleepModeInn) && !travelShip;
}
/** :55-67, OnPush's guard: under the ports restriction a trip that
 *  cannot sail does not START on the ship toggle. Returns the opts. */
export function enforceShipRestriction(settings, opts, ctx) {
  if (!settings?.shipTravelPortsOnly || !opts.travelShip) return opts;
  if (shipTravelRefusal({ settings, ...ctx })) opts.travelShip = false;
  return opts;
}
/** The refusal messages, by key - the mod's own words. */
export const SHIP_REFUSAL_TEXT = Object.freeze({ noport: TO_TEXT.MsgNoPort, nodestport: TO_TEXT.MsgNoDestPort, nosailing: TO_TEXT.MsgNoSailing });

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
    this.isCloseWindowDeferred = false;   // :83, EXIT's key-up flag
    this.top = null;          // 'diseased' | 'gold' - the two pushed boxes
    this._box = null;
    // TO1: the mod, read once as the popup is built (DFU's
    // `TravelOptionsMod.Instance`), and the mod's own coordinate arm -
    // a destination with no location, which can only be walked to.
    this._to = deps.travelOptions?.() ?? null;
    this.coordsOnly = !!deps.coordsOnly;
    this.refresh();
  }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  /** GuildManager.GetGuild(KnightlyOrder).FreeTavernRooms() - a host
   *  that answers nothing pays like everyone else, which is the base
   *  Guild.FreeTavernRooms (false). */
  freeTavernRooms() { return !!this.deps.freeTavernRooms?.(); }

  /** OL2 (AUDIT WORLD5's sixth recorded item, paid): ONLINE THE TRIP
   *  TAKES NO WORLD TIME - the clock is the world's (WORLD5) and the
   *  arrival is now. The host says so through `deps.noWorldTime`
   *  (world.js: sharedClockOn); a host that says nothing travels as
   *  DFU does. While it is true the day countdown is empty (the trip
   *  begins on the next tick), no inn night is paid (there are no
   *  nights - DFU's "always at least one stay" is a night too), and the
   *  window says it under the panel; the fare for a ship's passage
   *  stands, because a crossing is a crossing. */
  noWorldTime() { return !!this.deps.noWorldTime?.(); }

  /** Refresh -> UpdateTogglePanels + UpdateLabels (:254-258). The
   *  toggle panels are positional state, so only the labels compute. */
  /** TravelOptionsPopUp.cs:80-83, IsPlayerControlledTravel - the whole
   *  decision. A trip is WALKED when the mod owns the speed the player
   *  picked, owns the sleep mode they picked, and they are not sailing:
   *
   *    (CautiousTravel || !SpeedCautious)
   *      && (StopAtInnsTravel || !SleepModeInn)
   *      && !TravelShip
   *
   *  Read it as: "cautious is mine, or you did not choose cautious" -
   *  so with the two Player Controlled settings OFF the only walked
   *  trip is reckless, on foot, camping out, which is the readme's
   *  "recklessly by foot/horse with camp out options will ALWAYS
   *  initiate time accelerated travel". A ship is never walked. */
  isPlayerControlledTravel() {
    return isPlayerControlledTravel(this._to?.settings, this);
  }

  /** :85-89, IsNotAtPort - the place the player stands in must be a
   *  port for a ship to sail from it. */
  isNotAtPort() { return isNotAtPort(this.deps.currentLocationMapId?.()); }

  /** :91-94, HasNoOceanTravel - a crossing with no ocean in it and no
   *  ship under the player and no port at the far end needs no ship. */
  hasNoOceanTravel() { return hasNoOceanTravel(this.trip.oceanPixels, !!this.deps.isOnShip?.(), this._destinationMapId()); }

  /** :96-99, IsDestNotValidPort. */
  isDestNotValidPort() { return isDestNotValidPort(this._to?.settings, this._destinationMapId()); }

  _destinationMapId() { return this.deps.locationSummary?.()?.mapID ?? this.deps.locationSummary?.()?.mapId ?? null; }

  /** :168-180, IsShipTravelValid - and the three message boxes it puts
   *  up, in the mod's own order. Returns the box key, or null when the
   *  ship is allowed. */
  shipTravelRefusal() {
    return shipTravelRefusal({
      settings: this._to?.settings, currentLocationMapId: this.deps.currentLocationMapId?.(),
      isOnShip: !!this.deps.isOnShip?.(), destinationMapId: this._destinationMapId(), oceanPixels: this.trip.oceanPixels,
    });
  }

  /** :55-70, OnPush's own guard: with the ports restriction on, a trip
   *  that cannot sail does not START on the ship toggle. */
  enforceShipRestriction() {
    if (!this._to?.settings?.shipTravelPortsOnly) return;
    if (this.isNotAtPort() || this.hasNoOceanTravel() || this.isDestNotValidPort()) {
      if (this.travelShip) { this.travelShip = false; this.refresh(); }
    }
  }

  refresh() {
    const t = calculateTravelTime(this.deps.getPlayerPixel(), this.endPos, {
      speedCautious: this.speedCautious,
      sleepModeInn: this.sleepModeInn,
      travelShip: this.travelShip,
      hasHorse: this.hasHorse,
      hasCart: this.hasCart,
    }, this.deps.getClimateIndex);
    this.travelTimeTotalMins = t.minutes;
    // TP1 - GuildManager.FastTravel (:284), between CalculateTravelTime
    // and CalculateTripCost exactly as DFU orders them, so the Temple
    // of Akatosh's blessing shortens the FARE as well as the days.
    // `guildMemberships` is the host's own entity read; a host that
    // hands none gets the identity, which is every guild but Akatosh's
    // anyway (Guild.FastTravel is `return duration`).
    this.travelTimeTotalMins = guildFastTravel(this.deps.playerEntity?.() ?? null,
      this.travelTimeTotalMins);
    // OL2: no nights online (noWorldTime), so no inn - the toggle stands, the cost ignores it
    const c0 = calculateTripCost(this.travelTimeTotalMins, t.oceanPixels, {
      sleepModeInn: this.sleepModeInn && !this.noWorldTime(),   // OL2
      hasShip: this.hasShip,
      travelShip: this.travelShip,
      // TravelTimeCalculator.cs:163 consults the Knightly Order's
      // FreeTavernRooms right here. Read LIVE, not at OnPush like the
      // transport trio above: DFU asks GuildManager inside the
      // formula, so it re-answers on every toggle.
      freeTavernRooms: this.freeTavernRooms(),
    });
    const c = this._scaleTripCost(c0);
    this.trip = { ...t, ...c };
    // TO1 (TravelOptionsPopUp.cs:104-137, UpdateLabels): a WALKED trip
    // has no fare and its own estimate.
    //
    // The estimate is the classic one asked with the two settings the
    // mod has TAKEN OVER inverted - `SpeedCautious && !CautiousTravel`,
    // `SleepModeInn && !StopAtInnsTravel` - so a cautious walk is not
    // also charged classic's cautious penalty, and then divided by
    // TWICE the speed multiplier, the mod's own "manually controlled is
    // roughly twice as fast, depending on player speed". The division
    // truncates (`(int)`).
    if (this.isPlayerControlledTravel() || this.coordsOnly) {
      const s = this._to.settings;
      const w = calculateTravelTime(this.deps.getPlayerPixel(), this.endPos, {
        speedCautious: this.speedCautious && !s.cautiousTravel,
        sleepModeInn: this.sleepModeInn && !s.stopAtInnsTravel,
        travelShip: this.travelShip,
        hasHorse: this.hasHorse,
        hasCart: this.hasCart,
      }, this.deps.getClimateIndex);
      let mins = guildFastTravel(this.deps.playerEntity?.() ?? null, w.minutes);
      const mult = ((this.speedCautious && s.cautiousTravel) ? s.cautiousTravelMultiplier : s.recklessTravelMultiplier) * 2;
      this.travelTimeTotalMins = Math.trunc(mins / mult);
      this.walkedTrip = true;
      this.countdownValueTravelTimeDays = 0;   // a walked trip counts no days down: it starts at once
      return;
    }
    this.walkedTrip = false;
    this.countdownValueTravelTimeDays = this.noWorldTime() ? 0 : travelDays(this.travelTimeTotalMins);   // OL2: online the arrival is now
  }

  /** TO1 - TravelTimeCalculatorTO.cs:24-40, CalculateTripCost. The mod
   *  scales the two halves of the fare SEPARATELY and puts each through
   *  the shop-price formula at quality 10 afterwards, which is what
   *  keeps a scaled fare a plausible price rather than a multiple:
   *  "suggest x4-x6 for Climate & Calories" (modsettings.json).
   *  A factor of 1 - the shipped default - leaves its half untouched,
   *  formula and all. */
  _scaleTripCost(c) {
    const s = this._to?.settings;
    if (!s) return c;
    const inns = s.fastTravelCostScaleFactor | 0, ships = s.shipTravelCostScaleFactor | 0;
    if (inns <= 1 && ships <= 1) return c;
    const e = this.deps.playerEntity?.() ?? null;
    const trade = (cost) => calculateTradePrice(cost, 10, {
      mercantile: e ? (liveStat(e, 'mercantile') ?? 0) : 0,
      personality: e ? (liveStat(e, 'personality') ?? 50) : 50,
    }, false);
    let piecesCost = c.piecesCost;
    let shipCost = c.totalCost - c.piecesCost;
    if (inns > 1) piecesCost = trade(piecesCost * inns);
    if (ships > 1) shipCost = trade(shipCost * ships);
    return { piecesCost, totalCost: piecesCost + shipCost };
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

  /** CallFastTravelGoldCheck (:458-468), and TO1's override of it
   *  (TravelOptionsPopUp.cs:139-166).
   *
   *  THE FORK IS HERE and nowhere else. A destination with no location
   *  (the coordinates arm) is always walked; a location the mod's three
   *  toggles say is player-controlled is walked; everything else falls
   *  to DFU's own gold check and its day countdown. A walked trip pays
   *  no fare, so it never reaches `enoughGoldCheck` - which is the
   *  mod's own order, not an omission. */
  callFastTravelGoldCheck() {
    if (this.coordsOnly || this.isPlayerControlledTravel()) {
      this.doFastTravel = false;
      this.done = true;
      this.deps.onTravel?.(this.endPos, {
        speedCautious: this.speedCautious,
        sleepModeInn: this.sleepModeInn,
        travelShip: this.travelShip,
        playerControlled: true,
      }, { ...this.trip, minutes: this.travelTimeTotalMins });
      return;
    }
    if (!this.enoughGoldCheck()) { this.top = 'gold'; return; }
    this.doFastTravel = true;
  }

  /** ExitButtonOnClickHandler (:475-480) and CancelWindow (:435-440),
   *  which are the same three statements in the same order: the click
   *  sound, doFastTravel off, the window popped. Both are MOUSE-side
   *  or window-side and act at once. */
  exit() {
    this._click();
    this._exitNow();
  }

  /** The half without the sound - ExitButton_OnKeyboardEvent's KeyUp
   *  arm (:490-494) does not play a second ButtonClick, because its
   *  KeyDown arm already played the first one. */
  _exitNow() {
    this.doFastTravel = false;
    this.done = true;
    this.deps.onExit?.();
  }

  /** ExitButton_OnKeyboardEvent (:482-495), the KeyUP half. DFU's flag
   *  is `isCloseWindowDeferred`, and the release only closes the window
   *  when the matching press armed it - a key released over a window
   *  that was raised while it was already down does nothing. */
  keyup(code, e = null) {
    if (this.top) return;   // a pushed message box owns the keyboard
    if (!this.isCloseWindowDeferred) return;
    if (firstHotkey(['TravelExit'], typeof code === 'string' ? code : '', e) !== 'TravelExit') return;
    this.isCloseWindowDeferred = false;
    this._exitNow();
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
    if (this.top === 'noport' || this.top === 'nodestport' || this.top === 'nosailing') { this.top = null; return; }   // TO1: the three ship refusals, likewise
    if (key === 'Escape') { this.exit(); return; }
    // AUDIT-TO1 I5 (TravelOptionsPopUp.cs:69-80): the popup's OWN Update
    // polls I - `travelWindowTO.LocationSelected && infoBox == null` -
    // because only the top window updates in DFU, so with this popup
    // pushed the map's own I handler cannot run. The map window supplies
    // the door (`displayLocationInfo`) and draws the box ABOVE the popup.
    if (key === 'KeyI' && !this.coordsOnly) { this.deps.displayLocationInfo?.(); return; }
    // A8: the five buttons' Hotkeys, from the table rather than from
    // five literals (DaggerfallTravelPopUp.cs:167/171/176/188/200).
    // The letters do not move - B/E/S/T/N were right - but they are
    // now the table's answer, so a table edit reaches them and a
    // modifier held with them is masked out exactly as DFU masks it.
    switch (firstHotkey(TRAVEL_BUTTONS, key, e)) {
      case 'TravelBegin': this.begin(); return;
      // ExitButton_OnKeyboardEvent's KeyDown arm (:484-488): the click
      // sound plays NOW and the close waits for the release. The
      // begin button subscribes no keyboard handler at all, so B stays
      // Button.cs's "legacy support fallback" faked click on key-down.
      case 'TravelExit': this._click(); this.isCloseWindowDeferred = true; return;
      case 'TravelSpeedToggle': this._click(); this.speedCautious = !this.speedCautious; this.refresh(); return;
      case 'TravelTransportModeToggle': this._click(); this.travelShip = !this.travelShip; this.refresh(); return;
      case 'TravelInnCampOutToggle': this._click(); this.sleepModeInn = !this.sleepModeInn; this.refresh(); return;
      default: break;   // DFU offers no other accelerator on this window
    }
  }

  click(vx, vy) {
    if (this.top === 'diseased') {
      const hit = this._box ? messageBoxHit(this._box, vx, vy) : null;
      if (hit === MB_BUTTONS.Yes) this.input('KeyY');
      else if (hit === MB_BUTTONS.No) this.input('KeyN');
      return true;
    }
    if (this.top === 'gold') { this.top = null; return true; }
    if (this.top === 'noport' || this.top === 'nodestport' || this.top === 'nosailing') { this.top = null; return true; }
    if (inRect(POPUP_RECTS.begin, vx, vy)) { this.begin(); return true; }
    if (inRect(POPUP_RECTS.exit, vx, vy)) { this.exit(); return true; }
    // The click handlers ASSIGN (sender == button); only the hotkeys
    // toggle (:497-556).
    if (inRect(POPUP_RECTS.cautious, vx, vy)) { this._click(); this.speedCautious = true; this.refresh(); return true; }
    if (inRect(POPUP_RECTS.reckless, vx, vy)) { this._click(); this.speedCautious = false; this.refresh(); return true; }
    // TO1 (:182-189, TransportModeButtonOnClickHandler): with the ports
    // restriction on, the SHIP button refuses with a message instead of
    // toggling - the mod checks before it lets the base handler run.
    if (inRect(POPUP_RECTS.ship, vx, vy)) {
      const refusal = this._to?.settings?.shipTravelPortsOnly ? this.shipTravelRefusal() : null;
      if (refusal) { this._click(); this.top = refusal; return true; }
      this._click(); this.travelShip = true; this.refresh(); return true;
    }
    if (inRect(POPUP_RECTS.footHorse, vx, vy)) { this._click(); this.travelShip = false; this.refresh(); return true; }
    if (inRect(POPUP_RECTS.inns, vx, vy)) { this._click(); this.sleepModeInn = true; this.refresh(); return true; }
    if (inRect(POPUP_RECTS.campout, vx, vy)) {
      this._click(); this.sleepModeInn = false;
      // AUDIT-TO1 D3 (:215-224, SleepModeButtonOnClickHandler): under the
      // ports restriction, choosing CAMP OUT knocks the transport back to
      // foot when the trip cannot sail - the camp-out choice is the mod's
      // way into a walked trip, and a ship is never walked.
      if (this._to?.settings?.shipTravelPortsOnly && this.shipTravelRefusal()) this.travelShip = false;
      this.refresh(); return true;
    }
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
      // AUDIT-TO1 D4 (:207-213, ToggleTransportModeButtonOnScrollHandler):
      // a notch that would SELECT the ship is refused under the ports
      // restriction exactly as the click is, box and all - the wheel was
      // a complete bypass of the check the click enforces.
      if (this._to?.settings?.shipTravelPortsOnly && this.travelShip === false) {
        const refusal = this.shipTravelRefusal();
        if (refusal) { this._click(); this.top = refusal; return; }
      }
      this._click(); this.travelShip = !this.travelShip; this.refresh();
    } else if (inRect(POPUP_RECTS.inns, vx, vy) || inRect(POPUP_RECTS.campout, vx, vy)) {
      this._click(); this.sleepModeInn = !this.sleepModeInn;
      // AUDIT-TO1 D3 (:226-232, ToggleSleepModeButtonOnScrollHandler): the
      // scroll arm clears the ship UNCONDITIONALLY - but only over the
      // CAMP OUT button (`sender == campOutToggleButton`); a notch over
      // INNS leaves it, which is why the two rects are told apart here.
      if (this._to?.settings?.shipTravelPortsOnly && inRect(POPUP_RECTS.campout, vx, vy)) this.travelShip = false;
      this.refresh();
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
    // Update's else arm (:240-244): doFastTravel down, SmashHUDToBlack,
    // THEN performFastTravel - the screen is black before the journey
    // is resolved, and the host's arrival ends with the fade from
    // black (:381).
    hudFade.smashHUDToBlack();
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
    // TO1 (:169-180) - the three ship refusals, the mod's own words
    if (this.top === 'noport') return [{ text: TO_TEXT.MsgNoPort, center: true }];
    if (this.top === 'nodestport') return [{ text: TO_TEXT.MsgNoDestPort, center: true }];
    if (this.top === 'nosailing') return [{ text: TO_TEXT.MsgNoSailing, center: true }];
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
    // TO1 (TravelOptionsPopUp.cs:121-134): a WALKED trip has no fare -
    // the cost row says so in the mod's own words - and its time row
    // is HOURS AND MINUTES rather than a count of days, because the
    // journey starts now and the days are the ones you will live
    // through. `MsgTimeFormat` is the SDF spelling (the port's text is
    // neither of DFU's two fonts - systems/travelOptionsText.js).
    if (this.walkedTrip) {
      shadowText(renderer, font, TO_TEXT.MsgPlayerControlled, m, LABEL_POS.cost[0], LABEL_POS.cost[1]);
      const hours = Math.trunc(this.travelTimeTotalMins / 60), mins = this.travelTimeTotalMins % 60;
      shadowText(renderer, font, toFormat(TO_TEXT.MsgTimeFormat, hours, mins), m, LABEL_POS.time[0], LABEL_POS.time[1]);
    } else {
      shadowText(renderer, font, String(this.trip.totalCost), m, LABEL_POS.cost[0], LABEL_POS.cost[1]);
      shadowText(renderer, font, this.noWorldTime() ? 'now' : String(this.countdownValueTravelTimeDays), m, LABEL_POS.time[0], LABEL_POS.time[1]);   // OL2: the days label says "now" online
    }
    if (this.noWorldTime()) shadowText(renderer, font, ONLINE_TRAVEL_LINE, m, 0, POPUP_RECTS.native[1] + POPUP_RECTS.native[3] + 4, { align: 'center', w: NATIVE_W });
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
