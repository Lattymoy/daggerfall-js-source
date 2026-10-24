// W1-ii: THE TRAVEL POPUP - DaggerfallTravelPopUp.cs (MIT,
// Daggerfall Workshop; original author Lypyl) on the real
// TRAV0I04.IMG. The F-slice collected these three choices on single
// keys over a text panel; this is the classic window itself, laid
// out rect for rect, with the LAWS still living in
// systems/travel/travel.js exactly as C# leaves them in
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
// `keyup` below is that edge; ui/travel/travelMapWindow.js routes it and the
// townTalk overlay seam forwards it from the hosts' existing keyup
// listeners, which had bound the edge and never used it.

import { loadImg, nativeMetrics, drawImg, drawRect, shadowText, NATIVE_W } from '../native/nativePanel.js';   // OL2: the online line, centred under the panel
import { hudFade } from '../fadeLayer.js';   // D4: FadeBehaviour
import { layoutMessageBox, drawMessageBox, messageBoxHit, MB_BUTTONS, messageBoxArtLoaded, fitBoxRows } from '../messageBox.js';
import { drawText } from '../text.js';
import { calculateTravelTime, calculateTripCost, travelDays } from '../../systems/travel/travel.js';
import { guildFastTravel } from '../../systems/guild/guildVariants.js';   // TP1: GuildManager.FastTravel
import { audio } from '../../systems/audio.js';
import { SOUND } from '../../systems/soundClips.js';
import { firstHotkey } from '../../systems/dialogShortcuts.js';   // A8: the DaggerfallShortcut table
// TO1: Travel Options' own popup - TravelOptionsPopUp.cs. Which of the
// two journeys a trip takes is decided HERE, by the three toggles
// against the player's settings, and the fare is scaled here too.
import { TRAVEL_OPTIONS_TEXT as TO_TEXT, format as toFormat } from '../../systems/travel/travelOptionsText.js';
import { hasPortFor as hasPort } from '../../systems/travel/travelPorts.js';   // SEAT2b part two: HasPort, or a members' Harbour at a seat (travelPorts.js hasPortFor)
import { calculateTradePrice, essentialPrice } from '../../systems/shopStock.js';   // TravelTimeCalculatorTO's FormulaHelper.CalculateTradePrice
import { isOnlinePage } from '../../systems/online/onlineLane.js';   // ESSENTIALS-HALF: online, a fare costs half
import { liveStat } from '../../systems/statMods.js';
import { skillValue, SKILLS } from '../../systems/skills.js';   // TO-FARE: GetLiveSkillValue(Mercantile)
import { IT_POPUP, IT_TEXT, itPopUpDefaults, itTogglePress, itTrip, playerPopUpRefusal } from '../../systems/immersiveTravel.js';   // IT1: the mod's ImmersiveTravelPopUp and SeafarersPopUp

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
/** OL2: the line under the panel while the world's clock stands. LIVED1: the journey's days are the traveller's own
 *  time (worldTick.js ownMinutes) - they pass for the body and its contracts, and the world is where it was. */
/** AUDIT LIVED1b U1: ...in TWO rows on the classic panel, one sentence each - whole, the line measured about 348 native
 *  px against a 320-px screen, and its first letters ("Onli") were off the canvas at 16:10 and 5:4 (centring measures
 *  a space a pixel wider than it draws, so the whole loss fell at the left). The enhanced skin says the line whole. */
export const ONLINE_TRAVEL_ROWS = Object.freeze(['Online, the trip\'s days pass only for you.', 'The world\'s time does not move.']);
export const ONLINE_TRAVEL_LINE = ONLINE_TRAVEL_ROWS.join(' ');
const ONLINE_TRAVEL_ROW_H = 9;
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
/** TO1 - TravelTimeCalculatorTO.cs:24-40, CalculateTripCost, as a pure
 *  law over the mod's settings and the player entity: the two halves of
 *  the fare scaled SEPARATELY (FastTravelCostScaleFactor over the inn
 *  nights, ShipTravelCostScaleFactor over the passage) and each put
 *  through the shop-price formula at quality 10 afterwards. A factor of
 *  1 - the shipped default - leaves its half untouched, formula and all.
 *  No mod (`settings` null) leaves the fare as DFU billed it.
 *
 *  TO-FARE (FIELD BUGS 2026-09-29f): the formula is FormulaHelper's
 *  CalculateTradePrice, which reads the player's live Mercantile SKILL
 *  (GetLiveSkillValue, FormulaHelper.cs:1992/1998) - the fare read
 *  `liveStat(e, 'mercantile')`, a stat no entity has, so every scaled
 *  fare haggled at Mercantile 0 and a trained haggler paid a novice's. */
export function scaleTripCost(c, settings, entity, { online = isOnlinePage() } = {}) {
  const scaled = modScaledTripCost(c, settings, entity);
  if (!online) return scaled;
  // ESSENTIALS-HALF (2026-09-30, Discord: "cut the cost of most essential items by half"): online the fare costs half
  // (shopStock.js essentialPrice) - the inn nights and the passage each, after the mod's scaling, so both map skins
  // (this popup and ui/heldMap.js) quote and charge the same half
  const piecesCost = essentialPrice(scaled.piecesCost, { online });
  return { piecesCost, totalCost: piecesCost + essentialPrice(scaled.totalCost - scaled.piecesCost, { online }) };
}
function modScaledTripCost(c, settings, entity) {
  const s = settings;
  if (!s) return c;
  const inns = s.fastTravelCostScaleFactor | 0, ships = s.shipTravelCostScaleFactor | 0;
  if (inns <= 1 && ships <= 1) return c;
  const e = entity ?? null;
  const trade = (cost) => calculateTradePrice(cost, 10, {
    mercantile: e ? skillValue(e, SKILLS.Mercantile) : 0,
    personality: e ? (liveStat(e, 'personality') ?? 50) : 50,
  }, false);
  let piecesCost = c.piecesCost;
  let shipCost = c.totalCost - c.piecesCost;
  if (inns > 1) piecesCost = trade(piecesCost * inns);
  if (ships > 1) shipCost = trade(shipCost * ships);
  return { piecesCost, totalCost: piecesCost + shipCost };
}

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
    // IT1: IMMERSIVE TRAVEL'S POPUPS - `itKind` 'carriage' (ImmersiveTravelPopUp over a driver's map), 'seafarer'
    // (SeafarersPopUp over a captain's) or 'player' (ImmersiveTravelPopUp as the player's own map's, under
    // DisableNormalTravel); null is DFU's popup (with Travel Options' additions). Each is a new popup with its own
    // OnPush defaults (systems/immersiveTravel.js itPopUpDefaults), its own calculator, and none of Travel Options'
    // fork: the mod's popup derives from DFU's, so a trip from it is DFU's fast travel.
    this.itKind = deps.immersive?.kind ?? null;
    this._itSettings = deps.immersive?.settings ?? null;
    this._itText = null;   // the words of the box the mod pushed (`top` 'itPush' or 'itBox')
    if (this.itKind) {
      Object.assign(this, itPopUpDefaults(this.itKind, this._itSettings));
      // ImmersiveTravelPopUp.OnPush (IL_19e4-1aac): over the player's own map, a refusal box at once - its OK pops it
      // AND the popup (IL_1bbb-1bdd); a destination with no location is only logged, and the popup stands
      const refusal = this.itKind === IT_POPUP.player ? playerPopUpRefusal(this._itSettings, deps.locationSummary?.()?.locationType ?? null) : null;
      if (refusal) { this._itText = IT_TEXT[refusal]; this.top = 'itPush'; }
    }
    this.refresh();
  }

  _click() { audio.playOneShot(SOUND.ButtonClick, 1); }

  /** GuildManager.GetGuild(KnightlyOrder).FreeTavernRooms() - a host
   *  that answers nothing pays like everyone else, which is the base
   *  Guild.FreeTavernRooms (false). */
  freeTavernRooms() { return !!this.deps.freeTavernRooms?.(); }

  /** OL2 (AUDIT WORLD5's sixth recorded item, paid): ONLINE THE TRIP
   *  TAKES NO WORLD TIME - the clock is the world's (WORLD5) and the
   *  arrival is the world's now. The host says so through
   *  `deps.noWorldTime` (world.js: sharedClockOn); a host that says
   *  nothing travels as DFU does. While it is true the window says so
   *  under the panel. LIVED1: the days themselves are the traveller's
   *  own - the host's advance moves their clock by the trip - so the
   *  day countdown counts them as DFU's does, online too. [SUPERSEDES
   *  OL2's empty countdown and its "now".]
   *
   *  TRAVEL-FARE (2026-09-22): the FARE is no longer waived. This used
   *  to read "no inn night is paid (there are no nights)", which was
   *  right about the nights and wrong about the unit - DFU bills the
   *  trip's HOURS, and the journey has a length online even though the
   *  clock will not advance over it. The ship clause was always the
   *  correct reading of the same question ("a crossing is a crossing")
   *  and now both halves agree. [LIVED1: the days are counted online too
   *  - they pass on the traveller's own clock.] */
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
    // IT1: the mod's popup - its own calculator (ImmersiveTravelCalculator / SeafarersCalculator) over DFU's
    // UpdateLabels, the guild's blessing folded in as the base folds it; never walked, never Travel Options' fare
    if (this.itKind) {
      const t = itTrip(this.itKind === IT_POPUP.seafarer ? IT_POPUP.seafarer : IT_POPUP.carriage, this._itSettings, {
        start: this.deps.getPlayerPixel(), end: this.endPos,
        opts: { speedCautious: this.speedCautious, sleepModeInn: this.sleepModeInn, travelShip: this.travelShip },
        hasHorse: this.hasHorse, hasCart: this.hasCart, hasShip: this.hasShip, freeTavernRooms: this.freeTavernRooms(),
        getClimateIndex: this.deps.getClimateIndex, playerEntity: this.deps.playerEntity?.() ?? null,
        calc: { calculateTravelTime, guildFastTravel },
      });
      this.travelTimeTotalMins = t.minutes;
      this.trip = t;
      this.walkedTrip = false;
      this.countdownValueTravelTimeDays = travelDays(this.travelTimeTotalMins);
      return;
    }
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
    // TRAVEL-FARE (2026-09-22, kurkku: "really long trips (or journeys
    // of any distance) don't cost anything when player-controlled
    // cautious travel is disabled ... ship travel has the cost it
    // should"): THE INN'S GOLD IS THE PRICE OF THE JOURNEY, NOT RENT
    // ON ELAPSED TIME. This reverses HALF of OL2 and nothing else.
    //
    // OL2 reasoned that online there are no nights, so no night is
    // paid - and it is right about the nights. It is the wrong unit.
    // DFU derives this cost from the trip's HOURS, which the port
    // still computes online: the journey has a length, and only the
    // world's clock declines to advance over it. OL2 already drew
    // that line itself, one clause later, and drew it correctly -
    // "the fare for a ship's passage stands, because a crossing is a
    // crossing". A ride is a ride on the same reading.
    //
    // WHAT IT WAS IN PRACTICE, which is how kurkku found it: turn
    // Travel Options' player-controlled cautious travel OFF, and a
    // trip stops being WALKED and becomes an instant arrival - which
    // online took no time AND no gold. Free teleportation to anywhere
    // in the Bay, from a mod toggle. Ship fare still billed, which is
    // exactly why it read as a bug rather than a rule: one journey
    // cost money and the other did not.
    //
    // MODS-ONLINE-4's lesson, one day old: a thing correct by the
    // letter can still be wrong for the room. The days stay zero and
    // the arrival stays now - that half of OL2 is untouched, and it
    // is the half players asked for.
    const c0 = calculateTripCost(this.travelTimeTotalMins, t.oceanPixels, {
      sleepModeInn: this.sleepModeInn,   // TRAVEL-FARE: billed online too
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
    this.countdownValueTravelTimeDays = travelDays(this.travelTimeTotalMins);   // LIVED1: the days are the traveller's own, online too
  }

  /** TO1 - TravelTimeCalculatorTO.cs:24-40, CalculateTripCost. The mod
   *  scales the two halves of the fare SEPARATELY and puts each through
   *  the shop-price formula at quality 10 afterwards, which is what
   *  keeps a scaled fare a plausible price rather than a multiple:
   *  "suggest x4-x6 for Climate & Calories" (modsettings.json).
   *  A factor of 1 - the shipped default - leaves its half untouched,
   *  formula and all. */
  _scaleTripCost(c) {
    // AUDIT-MAP D2: the law is the pure export below, so the held map's
    // card (ui/heldMap.js) bills the same scaled fare - the enhanced
    // skin had billed calculateTripCost UNSCALED since the relief map.
    return scaleTripCost(c, this._to?.settings, this.deps.playerEntity?.() ?? null);
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
    if (!this.itKind && (this.coordsOnly || this.isPlayerControlledTravel())) {   // IT1: the mod's popup has no walked arm
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

  /** IT1: the mod's own boxes - one OK (AddButton(OK, true)): Return presses the default button, O is OK's key. The
   *  OnPush refusal's OK plays the click and pops the box AND the popup (IL_1bbb-1bdd); a toggle's refusal pops the
   *  box alone (CloseWindow, IL_15d7). */
  _itBoxOk() {
    // AUDIT IT1 C7: the message box's button plays its click (DaggerfallMessageBox's handler), and OnPush's handler
    // plays the mod's own besides (IL_1bbb-1bc5, PlayOneShot 360)
    this._click();
    if (this.top === 'itPush') { this._click(); this.top = null; this._itText = null; this._exitNow(); return; }
    this.top = null; this._itText = null;
  }

  /** IT1: one of the three toggles under the mod's overrides (systems/immersiveTravel.js itTogglePress) - a refusal
   *  pushes the mod's box and plays nothing; the base arm plays the click and refreshes, as DFU's does. */
  _itPress(press, opts) {
    const refusal = itTogglePress(this.itKind, this, this._itSettings, press, opts);
    if (refusal) { this._itText = IT_TEXT[refusal]; this.top = 'itBox'; return; }
    this._click();
    this.refresh();
  }

  input(code, e = null) {
    const key = typeof code === 'string' ? code : '';
    if (this.top === 'itPush' || this.top === 'itBox') {
      if (key === 'Enter' || key === 'NumpadEnter' || key === 'KeyO') this._itBoxOk();
      return;
    }
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
    if (key === 'KeyI' && !this.coordsOnly && this._to) { this.deps.displayLocationInfo?.(); return; }   // AUDIT IT1 C5: Travel Options' popup's alone - not DFU's, not the mod's
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
      // IT1: DFU routes T to the foot/horse button's ToggleTransportModeButtonOnScrollHandler and N to the inn
      // button's ToggleSleepModeButtonOnScrollHandler (DaggerfallTravelPopUp SetupButtons) - the handlers the mod
      // overrides
      case 'TravelTransportModeToggle': if (this.itKind) { this._itPress('transportToggle'); return; } this._click(); this.travelShip = !this.travelShip; this.refresh(); return;
      case 'TravelInnCampOutToggle': if (this.itKind) { this._itPress('sleepToggle', { campOutButton: false }); return; } this._click(); this.sleepModeInn = !this.sleepModeInn; this.refresh(); return;
      default: break;   // DFU offers no other accelerator on this window
    }
  }

  click(vx, vy) {
    if (this.top === 'itPush' || this.top === 'itBox') {   // IT1: the OK button alone answers
      if (this._box && messageBoxHit(this._box, vx, vy) === MB_BUTTONS.OK) this._itBoxOk();
      return true;
    }
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
    // IT1: the mod's popups override all four of these buttons' click handlers (TransportModeButtonOnClickHandler,
    // SleepModeButtonOnClickHandler) - and Travel Options' ports rule is not theirs
    if (this.itKind) {
      if (inRect(POPUP_RECTS.ship, vx, vy) || inRect(POPUP_RECTS.footHorse, vx, vy)) { this._itPress('transportClick', { ship: inRect(POPUP_RECTS.ship, vx, vy) }); return true; }
      if (inRect(POPUP_RECTS.inns, vx, vy) || inRect(POPUP_RECTS.campout, vx, vy)) { this._itPress('sleepClick', { inn: inRect(POPUP_RECTS.inns, vx, vy) }); return true; }
    }
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
    } else if (this.itKind && (inRect(POPUP_RECTS.footHorse, vx, vy) || inRect(POPUP_RECTS.ship, vx, vy))) {
      this._itPress('transportToggle');   // IT1: ToggleTransportModeButtonOnScrollHandler, the mod's
    } else if (this.itKind && (inRect(POPUP_RECTS.inns, vx, vy) || inRect(POPUP_RECTS.campout, vx, vy))) {
      this._itPress('sleepToggle', { campOutButton: inRect(POPUP_RECTS.campout, vx, vy) });   // IT1: ToggleSleepModeButtonOnScrollHandler, the mod's
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
    if (this.top) return;   // AUDIT IT1 C3: under a pushed box the popup is not the top window, and DFU updates that alone
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
      ...(this.itKind ? { immersive: this.itKind } : {}),   // IT1: the host's fork knows a driver's trip
    }, { ...this.trip, minutes: this.travelTimeTotalMins });
  }

  /** The two pushed boxes' rows, off TEXT.RSC. */
  _boxRows() {
    if (this.top === 'itPush' || this.top === 'itBox') return fitBoxRows(this._font, [this._itText ?? '']);   // IT1: the mod's words, SS5's wrap
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
    // neither of DFU's two fonts - systems/travel/travelOptionsText.js).
    if (this.walkedTrip) {
      shadowText(renderer, font, TO_TEXT.MsgPlayerControlled, m, LABEL_POS.cost[0], LABEL_POS.cost[1]);
      const hours = Math.trunc(this.travelTimeTotalMins / 60), mins = this.travelTimeTotalMins % 60;
      shadowText(renderer, font, toFormat(TO_TEXT.MsgTimeFormat, hours, mins), m, LABEL_POS.time[0], LABEL_POS.time[1]);
    } else {
      shadowText(renderer, font, String(this.trip.totalCost), m, LABEL_POS.cost[0], LABEL_POS.cost[1]);
      shadowText(renderer, font, String(this.countdownValueTravelTimeDays), m, LABEL_POS.time[0], LABEL_POS.time[1]);   // LIVED1: the days, online too - the line below says whose
    }
    // TO-ONLINE: ...and NOT over a walked trip. The line said "you
    // arrive now, and no inn is paid" (LIVED1's says whose days they are), which was true of every online
    // trip while Travel Options stood down on the shared clock and the
    // teleport was the only arrival there was. A walked trip online is
    // a real ride now (scenes/world.js beginAcceleratedTravel), so over
    // that one the sentence is simply false - the branch above has
    // already said the mod's own words and an hours:minutes estimate.
    if (this.noWorldTime() && !this.walkedTrip) ONLINE_TRAVEL_ROWS.forEach((row, i) => shadowText(renderer, font, row, m, 0, POPUP_RECTS.native[1] + POPUP_RECTS.native[3] + 4 + i * ONLINE_TRAVEL_ROW_H, { align: 'center', w: NATIVE_W }));   // AUDIT LIVED1b U1
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
    this._font = font;   // IT1: the wrap measures the mod's lines with the face that draws them
    if (this.top) {
      const buttons = this.top === 'diseased' ? [MB_BUTTONS.Yes, MB_BUTTONS.No] : (this.top === 'itPush' || this.top === 'itBox') ? [MB_BUTTONS.OK] : [];
      this._box = layoutMessageBox(font, this._boxRows(), buttons);
      if (!messageBoxArtLoaded() || !drawMessageBox(renderer, m, font, this._box)) {
        const rows = this._box.rows ?? [];
        rows.forEach((r, i) => drawText(renderer, font, r.text ?? r,
          m.ox + 20 * m.s, m.oy + (20 + i * 10) * m.s, m.s, [0.9, 0.9, 0.75, 1]));
      }
    } else this._box = null;
  }
}
