// ═══════════════════════════════════════════════════════════════════
// MAP1 — THE HELD MAP: the enhanced travel map is a parchment in the
// player's own hands.
//
// Mac (2026-09-18): "A complete replacement of the current enhanced
// map. Using the sprite, players should be able to open the map showing
// on the sprite itself in a hand drawn format, with roads and all. The
// player should be able to scale around, zoom in and out, and select
// their destination." The arc is bible/10-UI/Held-Map-Arc.md.
//
// THE SPRITE IS THE WINDOW. public/art/held-map.png - Mac's own
// painting of two gauntleted hands holding a blank sheet - fills the
// screen (a 4:3 stage, letterboxed into its own black), and the Iliac
// Bay is inked onto the sheet at runtime by ui/inkMap.js: a 2D canvas
// laid exactly over the parchment's rectangle. The hands and the paper
// never move; the MAP moves under the pen - drag to pan, wheel to zoom
// toward the cursor, clamped so the sheet is never blank at an edge
// (inkMap clampView). Where the thumbs rest ON the paper, the sprite's
// own pixels are keyed back over the ink (the thumb zones below), so
// the map reads as lying under the hands rather than printed on them.
//
// ── WHAT THIS WINDOW IS TO THE HOST ──────────────────────────────
//
// The classic map's own mount, verbatim (ui/travelMapDoor.js): a
// townTalk-slot overlay - isChoiceWindow (raw key codes), tick/draw per
// frame, done when finished, gotoPlace / activateTeleportationTravel /
// getTravelMapSaveData as one-shots. DOM only: draw() touches no GL,
// and the host's native-coordinate click/hover/wheel arms are no-ops
// BY DESIGN because the stage owns the pointer at full resolution.
//
// ── WHAT IS LAW HERE (unchanged from the map this replaces) ─────
//
// Every number the player commits to is the classic module's own:
// calculateTravelTime / calculateTripCost / travelDays over
// walkTravelPath; the guild blessing between them; the two-sided gold
// gate (letters of credit cannot pay the inn); the disease box BEFORE
// the gold check; transports snapshot at panel open; toggles
// round-tripping through travelMapPopUpState; the live
// travelMapFilters() object; discovery through checkLocationDiscovered
// and buckets through getPixelColorIndex (both inside buildMarkerModel);
// the pick handed to onTravel is {pixel, name, region, mapId,
// regionIndex, locationIndex}; Travel Options' three pure laws
// (isPlayerControlledTravel, enforceShipRestriction, shipTravelRefusal)
// and its teleport fee. The party is polled off the `party` dep and
// inked in the party green (SOC6), stacked on a shared pixel (AUDIT SOC
// D2), with the hover line that names every member on it.
//
// RECORDED DEPARTURES (bible/10-UI/Held-Map-Arc.md): the 3D relief, the
// cloud veil and the camera flight are gone - a journey begins the
// moment Begin is pressed, the sheet lowers, and the host's own travel
// runs; the filter chip row is gone (the store's flags still decide what
// is inked, and the classic window's chips still set them); the province
// pages and the region picker have no meaning on one sheet.
//
// ── MAP2: TRAVEL OPTIONS ON THE SHEET ─────────────────────────────
//
// Everything the mod adds to the classic map (TO1) lands here through
// the functions the classic window itself calls: the PORTS filter
// (portsFilterAllows over hasPort - a place without a harbour is not on
// the map at all while it is on; a harbour glyph beside every port
// while the mod restricts ship travel to ports; per-open, departure 6),
// the MARK (the middle click, travelMapMarkedMapId in the shared store,
// drawn in MarkLocationColor at every band), the I key's building list
// (locationInfoRows, in a box over the sheet that any key or click
// closes), the H help (the host's helpRows in the same box), the
// COORDINATES click (a bare pixel is a destination when the mod allows
// it and the host can honour it; the mod's own walked estimate, no fare,
// onTravelToCoords), the RESUME prompt (resumePrompt on the first tick
// when a destination is pending; Yes resumes and lowers the sheet, No
// stays on the map - AUDIT-TO1 G3), and the walked-trip estimate on the
// card (TravelOptionsPopUp.cs UpdateLabels: hours and minutes and no
// fare when the trip is player-controlled). The teleport fee is MAP1's.
//
// AUDIT-MAP (2026-09-18, bible/10-UI/Held-Map-Arc.md): the fare is the
// mod's SCALED one (scaleTripCost, the popup's own export); a walked
// trip hands its walked minutes to the host's ETA; No on the fee closes
// the map; online no inn is billed and the arrival is now; the static
// ink is a kept layer and the rings an overlay. Its recorded departures:
// the coordinates click refuses a teleport visit, H works under the
// panel, a bare pixel's ship laws see no destination, the resume prompt
// answers Enter and E, the fee is asked with the pick.
// ═══════════════════════════════════════════════════════════════════

import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';
import { REGION_NAMES, longitudeLatitudeToMapPixel, getPixelFromPixelID, patchRegionIndex } from '../formats/mapsFile.js';
import { locationSummaryAt } from '../systems/mapDirectory.js';
import { calculateTravelTime, calculateTripCost, travelDays } from '../systems/travel.js';
import { guildFastTravel } from '../systems/guildVariants.js';   // TP1: GuildManager.FastTravel
import {
  travelMapFilters, travelMapPopUpState, setTravelMapPopUpState, travelMapSaveData,
  travelMapMarkedMapId, setTravelMapMarkedMapId,   // MAP2: the mod's mark outlives the window (AUDIT-TO1 G4)
} from '../systems/travelMapState.js';
// AUDIT-TO1 C1/C2/C3: the mod's laws on the DEFAULT skin, as the pure
// functions the popup itself calls, so the two skins cannot drift.
import { isPlayerControlledTravel, enforceShipRestriction, shipTravelRefusal, scaleTripCost, SHIP_REFUSAL_TEXT, ONLINE_TRAVEL_LINE } from './travelPopUp.js';
// MAP2: the mod's map additions, through the SAME functions the classic
// window calls (ui/travelMapOptions.js), so the two skins cannot drift.
import { teleportCost, teleportCostPrompt, portsFilterAllows, locationInfoRows, resumePrompt } from './travelMapOptions.js';
import { hasPort } from '../systems/travelPorts.js';
import { noticeHold, noticeRelease } from './enhancedNotice.js';   // ENH-NOTICE3: this window's own click-anywhere boxes, as the enhanced panel
import { TRAVEL_OPTIONS_TEXT as TO_TEXT, format as toFormat } from '../systems/travelOptionsText.js';
import { getDaggerfallDistance, MatchesCutOff } from '../systems/editDistance.js';
import { checkLocationDiscovered } from './travelMapWindow.js';
import {
  buildInkModel, buildInkMarks, paintInkStatic, paintInkOverlay, zoomBand, clampView, scaleMinOf, SCALE_MAX,   // MAP-FIELD2: placeNames is inkMap's law still, but this sheet no longer inks the names
  viewCentredOn, zoomAt, toPaper, toMap, BAND_MARKS, PARTY_LABEL_STACK,
} from './inkMap.js';
// SOC6: the party's marks, read the one way both maps read them.
import {
  readPartyMarks, partyMarksKey, partyHoverText, partyLabelText,
  PARTY_MARK_CSS, PARTY_OFFLINE_CSS, PARTY_LEGEND_TEXT,
} from './partyMapMarks.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { quadPlacement } from './quadMap.js';   // MAP3: the sheet over the held paper's corners
import { bindings } from './input.js';
import { actionForCode } from '../systems/inputActions.js';
import { smoothstep } from '../systems/mathf.js';   // MAP-FIELD7: the ONE easing, so the sheet travels like everything else in the port

// ── THE SPRITE (Mac's, public/art/held-map.png) ──────────────────
// THE SITE ROOT lives in systems/appRoot.js now (AUDIT-THUNDERLOCK
// F7: the port's own weapon needed the same law and could not import
// this module to get it). Re-exported here, where MAP-FIELD put it.
export { appRootFrom, APP_ROOT } from '../systems/appRoot.js';
import { APP_ROOT } from '../systems/appRoot.js';

export const HELD_MAP_URL = new URL('art/held-map.png', APP_ROOT ?? globalThis.document?.baseURI ?? 'https://invalid.invalid/').href;
/** Its own pixels, and the stage's aspect. */
export const SPRITE = Object.freeze({ w: 1448, h: 1086 });
/** MAP-FIELD4 (2026-09-19, Mac: "Try this instead"): THE SECOND
 *  PAINTING, and it changes the rules this module was built on.
 *
 *  It carries a real ALPHA CHANNEL - 857,265 of its pixels are exactly
 *  transparent and nothing is matted - where the first was a fully
 *  opaque picture on its own black. So the black key is gone (see the
 *  departure recorded where that key used to live, in
 *  bible/10-UI/Held-Map-Arc.md): the painting says what is picture and
 *  what is not, and this module no longer has to guess it from
 *  brightness. Guessing it here would now be actively wrong, because
 *  the gauntlets in this painting are grey and run down to luma 0 - a
 *  black key would have punched holes straight through them.
 *
 *  It is also far kinder to the thumb key. The gloves are desaturated
 *  pewter against cream parchment, and the two part cleanly: over the
 *  middle of the sheet only 0.26% of pixels fall under luma 154, while
 *  the two thumb boxes are 45% under it. The first painting had no such
 *  line anywhere (bronze up to 148, shaded parchment down to 130). */
/** The parchment's rectangle, as fractions of the sprite: the largest
 *  upright rectangle that lies WHOLLY on the sheet.
 *
 *  MAP-FIELD3 (Mac: "the ingame map on the map appears going off the
 *  edge") - the ink canvas is laid EXACTLY here, so a rectangle larger
 *  than the sheet prints the map onto the torn edge and out over the
 *  sky. That bug predates both new paintings: on the ORIGINAL art this
 *  constant sat about 10 px left and 12 px above the sheet's real edge.
 *
 *  Measured by tools/heldMapArtProbe.mjs, which reads the sheet's own
 *  sides off the rows ABOVE the thumbs (where the sheet is the only
 *  opaque thing on the row, so alpha alone gives the edge) and its top
 *  and bottom down the middle columns, then shrinks until no row or
 *  column overhangs. The sheet measures x 270-1189, y 210-766; these
 *  are inset a few thousandths inside that for the ragged border. */
export const PAPER = Object.freeze({ x0: 0.192, x1: 0.818, y0: 0.198, y1: 0.703 });
/** Where the thumbs rest ON the sheet, as fractions of the sprite. In
 *  each zone the sprite's own thumb is found and keyed back OVER the
 *  ink (keyThumbPixels); the rest of the zone is paper and lets the ink
 *  through. `side` names the edge the thumb reaches in from - the one
 *  nearer its own hand - which is what the search is seeded on, so each
 *  zone is drawn to START on that hand, outside the sheet.
 *
 *  The zones are drawn GENEROUSLY on purpose. Under a bare threshold a
 *  wide zone was a liability, because every dark speck it swept up
 *  landed on the map; under the blob key an island is dropped however
 *  dark it is, so the only cost of a wide zone is the work, and the
 *  only cost of a narrow one is a clipped thumb. */
export const THUMB_ZONES = Object.freeze([
  Object.freeze({ x0: 0.165, x1: 0.295, y0: 0.410, y1: 0.725, side: 'left' }),
  Object.freeze({ x0: 0.710, x1: 0.845, y0: 0.410, y1: 0.725, side: 'right' }),
]);
/** What a pixel's RED minus its BLUE must be under to SEED the thumb's
 *  blob. NOT a brightness - MAP-FIELD4's measurement is that brightness
 *  cannot do this job on any of the three paintings, and that on this
 *  one colour can.
 *
 *  The sheet is parchment: warm all the way through, from its cream
 *  middle to its burnt border, so red runs well ahead of blue
 *  everywhere on it. The gauntlets are steel under a warm light: warmed
 *  at their highlights but neutral, and at times cold, in their body.
 *
 *  Measured by tools/heldMapArtProbe.mjs over the two THUMBS - the only
 *  part of the glove this key ever sees - and over 340,918 pixels of
 *  sheet, its burnt border all round included: under this line sit 36%
 *  of the thumb and 5 pixels of the sheet. Five in three hundred
 *  thousand, and each of them a speck in a crack, which the flood in
 *  keyThumbPixels drops as an island. So what this line claims is glove
 *  very nearly always IS glove, and the two thirds of the thumb it
 *  misses are recovered by shape rather than by loosening it.
 *
 *  (An earlier draft of this comment claimed 61% and ZERO. Both came
 *  from a narrower sample - it took in the forearms, which are darker
 *  than the thumbs, and missed the cracks. The probe measures the
 *  population the key actually works on.)
 *
 *  A luma cut cannot do this at all: measured on the same art, the
 *  sheet's burnt border falls to 37 while the glove's lit ridges reach
 *  212. That is not a near miss, it is a total overlap - which is why
 *  three paintings of brightness-keying left parchment on the map. */
export const HAND_CHROMA = 75;
/** The radius of the CLOSE in step 3 of keyThumbPixels, in sprite
 *  pixels: a gap of at most twice this is bridged, and the thumb's
 *  outline is left where it was - except against a zone's own edge,
 *  where the erode treats off-zone as kept and so cannot pull the blob
 *  back, so a blob within `grow` of an edge keeps its bulge. */
export const THUMB_GROW = 4;
/** MAP-FIELD2 (Mac, 2026-09-18): "...and is full screen with a BLACK
 *  BACKGROUND" - and MAP-FIELD4, which ended that law.
 *
 *  The first painting was fully opaque and carried its own black matte,
 *  so this module keyed the black out by brightness to put hands on the
 *  world rather than a black rectangle. Mac's second painting carries a
 *  real alpha channel instead: 857,265 pixels exactly transparent, no
 *  matte at all. So the key is GONE, not merely unused - on this art it
 *  would be a bug, because these gauntlets are grey and reach luma 0,
 *  and a brightness key would punch holes through them. The painting
 *  states its own silhouette now; nothing here guesses it.
 *
 *  Recorded as a departure in bible/10-UI/Held-Map-Arc.md. If a
 *  matted painting is ever supplied again it comes back from there,
 *  keyed to that file - it must not be revived by feel. */

/** MAP-FIELD2, Mac's second look: "there's still a gap at the bottom of
 *  the arms, any way you can author the gap?"
 *
 *  There is, and cropping alone could not close it. The cuffs are CUT
 *  BY THE FRAME - the painting simply stops partway down the forearms -
 *  but not on one row: measured by column (tools/heldMapArtProbe.mjs),
 *  the cut ends run from 0.866 to 0.893 of the file. HELD_MAP_BITE
 *  carries the lowest of them off the bottom edge on its own, which is
 *  why the first fix looked right and Mac still saw a gap; the ones
 *  that end higher leave notches bitten out of the arms, and no further
 *  crop closes those - pushing the sprite down far enough to bury them
 *  takes the paper off the screen with it.
 *
 *  So the pixels are AUTHORED. A column whose art ends in the CUFF BAND
 *  - at or below `foot`, which is to say a column the frame cut - has
 *  its lowest opaque pixel carried straight down to the foot of the
 *  sprite. The arms read as continuing off the bottom edge, which is
 *  what a held thing does.
 *
 *  MAP-FIELD4: the test is WHERE THE COLUMN ENDS, and the band is the
 *  measurement that makes it safe. Two other tests were tried on this
 *  painting and both were wrong. Asking whether the column falls
 *  outside PAPER's x range smears the sheet's own torn edge, because
 *  PAPER is inset a few pixels inside the parchment. Asking whether it
 *  ends below the sheet smears the whole parchment, because the sheet's
 *  ragged bottom (to 0.7330) hangs lower than PAPER's foot.
 *
 *  AUDIT MAP-FIELD: THE BAND'S MARGIN IS SMALL, and the first draft of
 *  this comment said the opposite. It claimed every column under the
 *  sheet ends by 0.737, every cuff at 0.866, and NOTHING in between -
 *  then contradicted itself in its own next sentence, which named what
 *  does end in between. Measured: 64 columns end between the sheet's
 *  lowest row (0.7330) and the highest cut cuff (0.8656), running up
 *  to 0.8435. They are the HAND'S OWN SILHOUETTE - the arm beside the
 *  sheet, drawn to end where it ends, which a streak would ruin.
 *
 *  So the empty band is 0.8435 to 0.8656 - twenty-three rows, not a
 *  hundred and forty-five - and CUFF_BAND sits in it with about six
 *  rows of headroom above and seventeen below. Enough for this
 *  painting; not enough to be casual about, since a repainted arm
 *  eight pixels lower puts silhouette columns under the band and
 *  streaks them. The art probe measures the gap and pins the band
 *  inside it, which is the only reason to trust the number.
 *
 *  `alphaMin` is MORE THAN HALF OPAQUE, not merely visible. A column's
 *  foot has to be a pixel the painter put there: the anti-aliased
 *  fringe below it is half air, and carrying a fringe pixel's colour
 *  down the screen at full opacity paints a streak the arm never had.
 *
 *  Pure, in place, over RGBA bytes - the same shape as the key. */
export function extendCuffs(data, w, h, foot = CUFF_BAND, alphaMin = 128) {
  const band = foot * h;
  for (let x = 0; x < w; x++) {
    let last = -1;
    for (let y = h - 1; y >= 0; y--) if (data[((y * w) + x) * 4 + 3] > alphaMin) { last = y; break; }
    if (last < band || last >= h - 1) continue;   // not a column the frame cut
    const i = ((last * w) + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    for (let y = last + 1; y < h; y++) {
      const j = ((y * w) + x) * 4;
      data[j] = r; data[j + 1] = g; data[j + 2] = b; data[j + 3] = 255;
    }
  }
  return data;
}

/** MAP-FIELD2 (Mac, 2026-09-18): "the held map should be at the bottom
 *  of the screen, arms should sit slighty below where there is no gap".
 *
 *  The sheet was fitted to the whole viewport and CENTRED, letterboxed
 *  into the root's own black - a picture of hands, not hands. It is a
 *  HELD sprite now, on the law every other held thing in this port
 *  takes: anchored to the BOTTOM edge, the world behind it, and pushed
 *  a little further down so the arms leave the frame instead of ending
 *  in mid-air above it. `HELD_MAP_BITE` is that push, as a fraction of the
 *  sprite's own height, so it is the same crop at every size.
 *
 *  `HEIGHT` is the sprite's height as a fraction of the viewport's.
 *  It is what the paper's size follows from - PAPER is 0.626 of the
 *  sprite wide and 0.505 of it tall - so it is the one number to turn
 *  if the map reads too small to use or too big to see past. (AUDIT
 *  MAP-FIELD: it read 0.617, a PAPER two paintings old.) */
export const HELD_MAP_HEIGHT = 0.92;
// MAP-FIELD5 (2026-09-19, Mac: "Can you lower it on the screen more").
// 0.03 to 0.11 - about 60px further down a 720p screen. This is the
// number to turn for that, and the only one: HEIGHT sets how big the
// sheet is, BITE sets how far down it sits, and neither disturbs the
// other. One consequence is recorded at the cuff pins - the bite now
// carries the cut cuffs well past the bottom edge rather than by half a
// pixel, so extendCuffs is a guarantee against a future change rather
// than the thing standing between this art and a notch.
export const HELD_MAP_BITE = 0.11;
/** Where the PAINTING's content ends, as a fraction of the sprite's own
 *  height - measured off the file, not guessed: below this line every
 *  row is empty, so the bottom tenth of `held-map.png` is nothing.
 *  Anchoring the FILE to the foot of the screen would leave the arms
 *  ending in mid-air with that tenth of the screen empty under them,
 *  which is the gap Mac named at MAP-FIELD2. The anchor is taken on
 *  this line instead, and `HELD_MAP_BITE` carries it a little past so
 *  the cuffs are cropped by the edge rather than stopping at it.
 *
 *  MAP-FIELD4: measured off the alpha channel now (the lowest row with
 *  an opaque pixel is 971 of 1086), where on the matted paintings it
 *  had to be read off the brightness. */
export const SPRITE_ART_FOOT = 0.895;
/** Where the CUFF BAND begins, as a fraction of the sprite's height:
 *  the line above which a column's art ends because it was DRAWN to end
 *  there, and below which it ends because the frame cut it. It is what
 *  tells extendCuffs an arm to carry off the screen from a silhouette
 *  to leave alone.
 *
 *  Measured: the hand's silhouette columns end as low as 0.8435 and
 *  the cut cuffs begin at 0.8656, so the gap this sits in is 23 rows
 *  and this line has about six rows of headroom. See extendCuffs for
 *  why that margin is smaller than it first looks. */
export const CUFF_BAND = 0.85;

// ── THE CLOCKS (skin) ────────────────────────────────────────────
/** MAP-FIELD7 (2026-09-19, Mac: "when you open or close your map, I
 *  want the sprite to come in and go out at the bottom of the screen
 *  instead of fading in"). These two always SAID the sheet rises and
 *  lowers - the comment was the intent and the code was a fade. It
 *  really moves now (`_setRaise`), and it takes a little longer than
 *  the fade did, because a fade of a third of a second reads as instant
 *  while a travelling thing reads as hurried. */
const OPEN_S = 0.42;     // the sheet rises into view
const CLOSE_S = 0.36;    // ...and lowers on a commit or a close, a touch quicker: leaving is not a flourish
// SOC6: how often the window ASKS the host for its party, in seconds -
// well under the eye's patience and well over the pose rate the hub
// relays at (net/wire.js PARTY_SEND_MS). The classic window polls at
// its own half second (ui/travelMapWindow.js PARTY_POLL_S); this sheet
// repaints cheaply, so it asks twice as often.
const PARTY_POLL_S = 0.25;
/** The scale a search or a journal click-through zooms to. */
const FOCUS_SCALE = 6;
/** How often the breathing rings repaint the sheet while one is up. */
const PULSE_HZ = 10;
const HANDS_LOST_TICKS = 45;   // AUDIT-MAP2: ticks without corners before the hands lane gives the sheet back to the sprite
const OFF_SHEET = Object.freeze([-1e9, -1e9]);   // a pointer that is not over the sheet at all

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

// The chains are built once per data set and kept - the bay does not
// change shape between opens. Keyed on the height bytes; the roads
// reference rides in the record so a network that lands later rebuilds.
const _chainCache = new WeakMap();

export class HeldMapWindow {
  /** deps: the classic map's own bag (ui/travelMapDoor.js lists it)
   *  plus `woods` (only heightMapBuffer is read), `roads()` (the
   *  network, inked only when it is the mod's), and optional `mapSize`
   *  {width, height} so a pin can stand up a small synthetic bay.
   *
   *  SOC6: and an optional `party: () => [{acct, name, px, py, in,
   *  loc, online, leader}]` - a FUNCTION, read on this window's own
   *  poll rather than snapshot at open, because members travel, go
   *  indoors and drop offline while the map is up. */
  constructor(deps = {}) {
    this.deps = deps;
    this.done = false;
    this.isChoiceWindow = true;
    // MAP-WEAPON: the scene's tick tag, this file's own idiom
    // (`isRestWindow`, `isVirtueLevelUp`): the weapon rig asks whether
    // a map holds the screen and must not import a UI class to ask.
    this.isTravelMap = true;
    // MAP-FIELD2: the vitals and the status icons go while the sheet is
    // out - it is held in the player's own hands, and a bar drawn over
    // the knuckles is not a HUD under a window (windowStack.hidesHud).
    this.hidesHud = true;
    this.filters = travelMapFilters();   // the LIVE store object, edited in place (the classic law)
    this.teleportationTravel = false;    // one-shot, cleared on close
    this._gotoPlace = null;              // one-shot, consumed on first tick
    this._ticked = false;

    this._size = deps.mapSize ?? { width: MAP_WIDTH, height: MAP_HEIGHT };
    const p = deps.getPlayerPixel?.() ?? { x: this._size.width >> 1, y: this._size.height >> 1 };
    this._player = { x: p.x, y: p.y };

    this._phase = 'opening';
    this._t = 0;
    this._clock = 0;
    this._commit = null;    // { kind, pick, opts, computed }

    // MAP3: THE LANE. 'sprite' is Mac's painting (MAP1); 'hands' is the
    // Morrowind arm holding the sheet, entered when the host's `holder`
    // says the arm is drawn and takes the sheet - the ink canvas then
    // goes transparent-backed and is laid over the paper piece's
    // projected corners by a CSS matrix3d (ui/quadMap.js), the pointer
    // mapped back through the inverse. Decided on the first tick (the
    // sheet needs its size, which the layout gives), retried for a few
    // ticks while the rig has not been posed yet.
    this._lane = 'sprite';
    this._placement = null;    // quadPlacement, in the hands lane
    this._cornersKey = null;   // the last corners placed ('' = none); null forces a re-place
    this._handsTries = 0;
    this._handsLost = 0;       // AUDIT-MAP2: ticks in the hands lane without corners
    this._model = null;     // the ink model, minted on the first layout
    this._marksDirty = true;
    this._marksVersion = 0;
    this._layer = null;         // the kept static ink (a canvas), and its key
    this._staticKey = '';
    this._dirty = true;     // the canvas wants a repaint
    this._layoutKey = '';
    this._paper = { w: 1, h: 1, dpr: 1 };
    this._view = { ox: 0, oy: 0, scale: 1 };
    this._goal = { ox: 0, oy: 0, scale: 1 };

    // SOC6: the party, as marks. A separate list from the model's marks
    // on purpose: a friend walking one pixel east must never cost a
    // rebuild of the whole bay's dots.
    this._party = [];
    this._partyKey = '';
    this._partyPoll = 0;
    this._selected = null;  // { summary, name, x, y } - or { coords: true, ... } for a bare pixel (MAP2)
    this._panel = null;     // 'travel' | 'teleport' | null
    this._panelState = null;
    this._searchIndex = null;
    this._dead = false;
    // MAP2: the mod itself (null when it is off), read ONCE per open the
    // way the classic window reads it; the ports filter is per-open (the
    // one field that does not outlive the window, departure 6); the mark
    // rides the shared store like the eight filters (AUDIT-TO1 G4).
    this._to = deps.travelOptions?.() ?? null;
    this.portsFilter = false;
    Object.defineProperty(this, 'markedMapId', {
      get: () => travelMapMarkedMapId(),
      set: (v) => setTravelMapMarkedMapId(v),
      enumerable: true,
    });
    this._info = null;          // the I key's box, or the H key's
    this._top = null;           // 'resume' | null - the mod's Yes/No over the sheet
    this._resumeAsked = false;  // once per open
    /** ENH-NOTICE3: the I/H box's own notice OWNER, separate from the
     *  window itself (which owns the card's refusal line). Two owners
     *  because the two boxes are independent - the card can be holding
     *  a ship refusal while the I key raises the building list over it -
     *  and one owner means one panel, so the second raise would blank
     *  the first. */
    this._infoOwner = {};

    this._mountChrome();
    this._tornDown = false;
    this._probeFn = () => JSON.stringify({
      phase: this._phase,
      view: { ox: Math.round(this._view.ox * 10) / 10, oy: Math.round(this._view.oy * 10) / 10, scale: Math.round(this._view.scale * 100) / 100 },
      band: zoomBand(this._view.scale),
      paper: { w: Math.round(this._paper.w), h: Math.round(this._paper.h) },
      lane: this._lane, placed: !!this._placement,   // MAP3
      marks: this._model?.marks.length ?? 0,
      party: this._party.map((m) => `${m.name}@${m.px},${m.py}${m.in ? `/${m.in}` : ''}${m.online ? '' : '-off'}`),
      selected: this._selected?.name ?? null,
      panel: this._panel,
      armed: this.teleportationTravel,
      portsFilter: this.portsFilter, marked: this.markedMapId, info: !!this._info, top: this._top,   // MAP2
      filters: { ...this.filters },
      trip: this._panelState?.trip ?? null,
      notice: this._panelState?.notice ?? null,
      save: this.getTravelMapSaveData(),
    });
    globalThis.__heldMap = this._probeFn;
  }

  // ── THE CLASSIC WINDOW'S CONTRACT, kept ────────────────────────

  /** ActivateTeleportationTravel: armed BEFORE the window shows,
   *  lasts exactly one visit. */
  activateTeleportationTravel() { this.teleportationTravel = true; }

  /** GotoPlace: pending, consumed on the first tick. */
  gotoPlace(place) { this._gotoPlace = place; }

  /** GetTravelMapSaveData: a LIVE open panel's toggles win, exactly
   *  as the classic window hands its live popup. */
  getTravelMapSaveData() {
    const o = this._panelState?.opts;
    return travelMapSaveData(o
      ? { speedCautious: o.speedCautious, sleepModeInn: o.sleepModeInn, travelShip: o.travelShip }
      : null);
  }

  // ── HOST ARMS ──────────────────────────────────────────────────

  input(code, e) {
    // The search field stops its own keydown propagation, so a key
    // arriving here was never meant for a text box.
    if (this._phase !== 'closing') {
      // MAP2 (:449-453): the info box is ClickAnywhereToClose, so ANY key
      // closes it and nothing else happens that press.
      if (this._info) { e?.preventDefault?.(); this._closeInfo(); return; }
      // MAP2 (:326-345): the resume prompt. YES resumes the journey and
      // lowers the sheet; NO pops the box alone and leaves the player ON
      // the map to pick somewhere else (AUDIT-TO1 G3).
      if (this._top === 'resume') {
        e?.preventDefault?.();
        if (code === 'KeyY' || code === 'Enter' || code === 'NumpadEnter') { this._top = null; this._renderBox(); this.deps.onResumeTravel?.(); this._beginClose(null); }
        else if (code === 'KeyN' || code === 'Escape' || code === 'KeyE') { this._top = null; this._renderBox(); }
        return;
      }
    }
    if (code === 'Escape' || actionForCode(bindings(), code) === 'TravelMap') {
      e?.preventDefault?.();
      if (this._phase !== 'map') return;      // the sheet is moving: let it land
      // the diseased box steps back to the PANEL, not out of it - the
      // classic popup's No arm
      if (this._panelState?.confirm) { this._confirmDiseased(false); return; }
      // AUDIT-MAP2: Escape on the teleport box IS its No - the classic's
      // fee box takes N and Escape in one arm (:1507) and closes the map;
      // DFU's own TeleportPopUp takes Escape as No and leaves the map armed
      if (this._panel === 'teleport') { this._confirmTeleport(false); return; }
      if (this._panel) { this._closePanel(); return; }
      if (this._selected) { this._select(null); return; }
      this._beginClose(null);
      return;
    }
    if (this._phase !== 'map') return;
    if (this._panelState?.confirm) {
      if (code === 'KeyY') { this._confirmDiseased(true); return; }
      if (code === 'KeyN') { this._confirmDiseased(false); return; }
      return;
    }
    if (this._panel === 'teleport') {
      // the teleport box answers keys exactly as the classic one does:
      // Y/Enter yes, N/E no (Escape is the ladder above)
      if (code === 'KeyY' || code === 'Enter' || code === 'NumpadEnter') { this._confirmTeleport(true); return; }
      if (code === 'KeyN' || code === 'KeyE') { this._confirmTeleport(false); return; }
      return;
    }
    // MAP2 (:360-370): I over a selected place, H anywhere - the mod's
    // two keys, on the popup and off it alike; P is this sheet's own
    // spelling of the ports button (recorded).
    if (this._to) {
      if (code === 'KeyI' && this._selected && !this._selected.coords) { this._displayLocationInfo(); return; }
      if (code === 'KeyH') { this._displayHelp(); return; }
      if (code === 'KeyP' && this._portsShown()) { this._togglePorts(); return; }
    }
    if (this._panel === 'travel' && this._panelState) {
      // The classic popup's own hotkeys: S/T/N toggle their pair.
      if (code === 'KeyS') { this._toggleOpt('speedCautious'); return; }
      if (code === 'KeyT') { this._toggleOpt('travelShip'); return; }
      if (code === 'KeyN') { this._toggleOpt('sleepModeInn'); return; }
      if (code === 'KeyB') { this._begin(); return; }
      return;
    }
    // the keyboard's own pan and zoom, about the paper's centre
    const step = 40 / this._view.scale;
    if (code === 'ArrowLeft') this._nudge(-step, 0);
    else if (code === 'ArrowRight') this._nudge(step, 0);
    else if (code === 'ArrowUp') this._nudge(0, -step);
    else if (code === 'ArrowDown') this._nudge(0, step);
    else if (code === 'Equal' || code === 'NumpadAdd') this._zoomBy(1.35, this._paper.w / 2, this._paper.h / 2);
    else if (code === 'Minus' || code === 'NumpadSubtract') this._zoomBy(1 / 1.35, this._paper.w / 2, this._paper.h / 2);
  }

  click() { /* the stage div owns the pointer at full resolution; native-coord clicks never happen */ }
  hover() { /* the stage div owns the pointer; see click */ }
  wheel() { /* the stage div owns the wheel - zoom needs the cursor position anyway */ }

  tick(dt) {
    if (this.done) return;   // a torn-down window has no chrome to drive
    this._clock += dt;
    const first = !this._ticked;
    if (first) {
      this._ticked = true;
      this._layout();
      this._tryHands();   // MAP3: the Morrowind arm takes the sheet, if it is drawn
      if (this._gotoPlace) { this._consumeGotoPlace(); this._gotoPlace = null; }
      // MAP2 (TravelOptionsMapWindow.cs:322-345): opened during a journey,
      // the sheet centres on the player; opened with a destination still
      // pending, the mod asks whether to resume it. Once per open.
      if (!this._resumeAsked) {
        this._resumeAsked = true;
        if (this._to) {
          if (this._to.isTravelActive) this._focusOn(this._player.x + 0.5, this._player.y + 0.5, this._view.scale);
          else if (this._to.destinationName) { this._top = 'resume'; this._renderBox(); }
        }
      }
    }
    // SOC6: the party is POLLED, on this window's own cadence, from the
    // first tick to the last - never snapshot at open.
    this._partyPoll -= dt;
    if (this._partyPoll <= 0) { this._partyPoll = PARTY_POLL_S; this._refreshParty(); }
    this._layout();
    // MAP3: the hands lane follows the arm every frame; the sprite lane
    // keeps asking for a few ticks in case the rig had not posed yet
    if (this._lane === 'hands' && this._phase !== 'closing') {   // closing: the sheet was let go at _beginClose
      this._placeOnHands();
      // AUDIT-MAP2: an arm that stops drawing (paralysed, hidden, unloaded,
      // third person) leaves no corners; after HANDS_LOST_TICKS of none the
      // painting comes back, for the rest of this open
      if (this._placement) this._handsLost = 0;
      else if (this._phase === 'map' && ++this._handsLost > HANDS_LOST_TICKS) this._leaveHands();
    // AUDIT MAP-FIELD: ...and NOT while the sheet is leaving. The guard
    // on the first arm said "closing: the sheet was let go at
    // _beginClose", but it only guarded that arm - the retry fell
    // through to here at any phase. Taking the arm mid-close hid the
    // painting on the spot and, since _setRaise leaves the hands lane
    // untransformed, SNAPPED the lowering sheet back to its held place.
    } else if (!first && this._phase !== 'closing' && this._handsTries > 0 && this._handsTries < 30) { this._handsTries++; this._tryHands(); }
    this._t += dt;
    switch (this._phase) {
      case 'opening': {
        this._setRaise(clamp(this._t / OPEN_S, 0, 1));
        if (this._t >= OPEN_S) { this._phase = 'map'; this._t = 0; this._renderCard(); }
        break;
      }
      case 'map': break;
      case 'closing': {
        this._setRaise(clamp((this._closeFrom ?? 1) * (1 - this._t / CLOSE_S), 0, 1));
        if (this._t >= CLOSE_S) {
          // THE COMMIT, with the sheet down: the hooks are read while
          // this window is still alive (the pack's lesson), and the
          // host's own travel runs from here.
          this._fireCommit();
          this._close();
          return;
        }
        break;
      }
      default: break;
    }
    // the view eases toward its goal - a search or a click-through
    // glides rather than cuts
    const v = this._view, g = this._goal;
    const k = Math.min(1, dt * 9);
    if (Math.abs(v.ox - g.ox) > 1e-3 || Math.abs(v.oy - g.oy) > 1e-3 || Math.abs(v.scale - g.scale) > 1e-4) {
      v.ox += (g.ox - v.ox) * k; v.oy += (g.oy - v.oy) * k; v.scale += (g.scale - v.scale) * k;
      if (Math.abs(v.ox - g.ox) < 1e-3 && Math.abs(v.oy - g.oy) < 1e-3 && Math.abs(v.scale - g.scale) < 1e-4) Object.assign(v, g);
      // AUDIT-MAP A8: every step of the glide is a view the clamp allows -
      // the straight line between a centred rest view and a zoomed goal
      // ran through views with blank parchment above the map
      Object.assign(v, clampView(v, this._limits()));
      this._dirty = true;
    }
    // the rings breathe, so the sheet is repainted while one is up - at
    // PULSE_HZ, not per frame: a paint is the whole bay's ink (AUDIT-MAP A2)
    if (this._selected || this._party.length) {
      const beat = Math.floor(this._clock * PULSE_HZ);
      if (beat !== this._beat) { this._beat = beat; this._dirty = true; }
    }
    if (this._dirty) this._paint();
  }

  draw() { /* DOM only: the sheet is a canvas laid over the sprite, painted from tick(); nothing here touches the renderer */ }

  dispose() {
    this._dead = true;
    // AUDIT MAP-FIELD: THE JOURNEY SURVIVES A TEARDOWN. The commit only
    // ever fired from tick()'s closing arm, so a host that disposed the
    // window while the sheet was still lowering - a mode change, an
    // overlay cleared, closeTravelWindows from anywhere - dropped the
    // travel the player had already paid for and committed to, with no
    // sign that anything had happened. It is fired here instead, one
    // shot, before _close() tears the window down.
    //
    // It fires BEFORE _close() rather than inside it so re-entry is
    // safe: a host whose onTravel disposes us again runs the whole of
    // _close() on that inner call, and the outer _close() then sees
    // `done` and returns - so onClose is still owed exactly once.
    this._fireCommit();
    this._close();
  }

  /** The commit the player made, fired once and then forgotten. ONE
   *  HOME for the three hooks: the closing arm and dispose() both come
   *  here, so a journey cannot be committed down one path and lost down
   *  the other. A second call is a no-op. */
  _fireCommit() {
    const c = this._commit;
    this._commit = null;
    if (c?.kind === 'travel') this.deps.onTravel?.(c.pick, c.opts, c.computed);
    else if (c?.kind === 'teleport') this.deps.onTeleport?.(c.pick);
    else if (c?.kind === 'coords') this.deps.onTravelToCoords?.(c.pick, c.opts);   // MAP2: a bare pixel, the mod's own journey
  }

  /** Everything the window holds, released once - in close() rather
   *  than dispose() alone, so a window closed from inside (Escape, a
   *  commit) tears its DOM down the same breath, whichever mount holds
   *  it (worldModes' interiorOverlay for the guild's teleport map, the
   *  townTalk slot outdoors). Torn down BEFORE done reads true. */
  _teardown() {
    if (this._tornDown) return;
    this._tornDown = true;
    this.deps.holder?.release?.();   // MAP3: the arms let the sheet go, whichever lane stood
    // ENH-NOTICE3 / EVERY ALLOCATION HAS AN OWNER: both held panels
    // (the card's refusal, the I/H box's) arm no watchdog, so this is
    // the only thing that can take them down. `_teardown` and not
    // `_close` because it is the one home every way out comes through -
    // Escape, the Close button, a commit, dispose() from a host that
    // took the slot - and it runs before `done` reads true.
    noticeRelease(this);
    noticeRelease(this._infoOwner);
    this._unmountChrome();
    // ownership-checked: a second window minted after this one owns
    // the surface now, and an unconditional delete would blind it
    if (globalThis.__heldMap === this._probeFn) delete globalThis.__heldMap;
  }

  /** closeTravelWindows' tail: teardown, done, one-shots cleared,
   *  onClose owed - once, whichever door closed it. */
  _close() {
    if (this.done) return;
    if (this._panelState) this._rememberPanel();
    this.teleportationTravel = false;
    this._teardown();
    this.done = true;
    this.deps.onClose?.();
  }

  /** The sheet lowers, then the commit (if any) fires and the window
   *  closes. A close from dispose() skips the fade - there is no frame
   *  left to fade in. */
  _beginClose(commit) {
    if (this._phase === 'closing') return;
    // AUDIT-MAP B1: the toggles are remembered on EVERY way out - the Close
    // button and the resume prompt's Yes came through here with a panel
    // open and dropped its state, where Escape and Begin had kept it
    if (this._panelState) this._rememberPanel();
    this._commit = commit;
    this._panel = null;
    this._panelState = null;
    this._info = null;
    this._top = null;
    this._renderBox();
    // AUDIT-MAP2: in the hands lane the arms let the sheet go NOW, with
    // the ink, rather than holding a blank parchment through the fade and
    // dropping it at teardown; the chrome fades on its own
    if (this._lane === 'hands') {
      this.deps.holder?.release?.();
      this._placement = null;
      this._cornersKey = '';
      if (this._chrome?.ink) this._chrome.ink.style.opacity = '0';
    }
    // the close starts from where the sheet IS - one answered while it
    // is still rising must lower from there, not snap up first
    this._closeFrom = Number.isFinite(this._raise) ? this._raise : 1;
    this._phase = 'closing';
    this._t = 0;
    this._renderCard();
  }

  /** MAP-FIELD7: HOW FAR UP THE SHEET IS, 0 (clear off the bottom edge)
   *  to 1 (held). The stage is carried on its OWN height - `translateY`
   *  of 100% - which needs no viewport number and is right at every
   *  size: the stage's top sits at `vh - (SPRITE_ART_FOOT -
   *  HELD_MAP_BITE) * h`, so moving it down by a full `h` always puts
   *  its top past the bottom edge and the whole painting with it.
   *
   *  Eased rather than linear, because a held thing has weight - it is
   *  smoothstep, the port's own (systems/mathf.js), so the sheet leaves
   *  and arrives slowly and crosses quickly.
   *
   *  The chrome does NOT travel. The top bar and the card are anchored
   *  to the viewport's edges, and sliding them up from the floor reads
   *  as a mistake; they keep the fade the sheet used to have, through
   *  the one CSS rule that excludes the stage.
   *
   *  IN THE HANDS LANE (MAP3) NOTHING SLIDES. The arm brings the sheet
   *  in itself, and a transform on the stage would drag the ink's own
   *  matrix3d off the paper the rig is holding. */
  _setRaise(a) {
    this._raise = a;
    const c = this._chrome;
    if (!c?.root) return;
    // the chrome fades where it stands, child by child. NOT through the
    // root: the root carries the stage, so its opacity would fade the
    // sprite - the very thing this replaced. Walking the children keeps
    // the law in JS where a pin can read it, and covers a box or a card
    // appended later, which the next tick reaches.
    const o = String(Math.round(a * 100) / 100);
    for (const n of c.root.children ?? []) { if (n !== c.stage) n.style.opacity = o; }
    if (!c.stage) return;
    if (this._lane === 'hands') { c.stage.style.transform = ''; return; }
    const e = smoothstep(0, 1, a);
    c.stage.style.transform = e >= 1 ? '' : `translateY(${Math.round((1 - e) * 1000) / 10}%)`;
  }

  // ── THE SHEET ──────────────────────────────────────────────────

  /** MAP-FIELD2: the stage is the sprite's 4:3, sized so the PAINTING
   *  (not the file - a fifth of the file is matte, SPRITE_ART_FOOT)
   *  stands HELD_MAP_HEIGHT of the viewport, centred across it, and
   *  anchored so the painting's own foot sits HELD_MAP_BITE past the
   *  bottom edge: the arms are cropped by the screen rather than ending
   *  above it. On a viewport too narrow to hold that width the height
   *  gives way instead, because a sprite wider than the screen would cut
   *  the paper's own sides off. The paper is PAPER of the stage; the
   *  canvas is the paper at device resolution. Re-run each tick and a
   *  no-op unless the viewport moved. */
  _layout() {
    const root = this._chrome?.root;
    if (!root) return;
    const vw = root.clientWidth || globalThis.innerWidth || 1024;
    const vh = root.clientHeight || globalThis.innerHeight || 768;
    const dpr = globalThis.devicePixelRatio || 1;
    const key = `${vw}x${vh}@${dpr}`;
    if (key === this._layoutKey) return;
    this._layoutKey = key;
    let sh = vh * HELD_MAP_HEIGHT / SPRITE_ART_FOOT, sw = sh * SPRITE.w / SPRITE.h;
    if (sw > vw) { sw = vw; sh = sw * SPRITE.h / SPRITE.w; }
    const sx = (vw - sw) / 2, sy = vh - (SPRITE_ART_FOOT - HELD_MAP_BITE) * sh;
    const c = this._chrome;
    Object.assign(c.stage.style, { left: `${sx}px`, top: `${sy}px`, width: `${sw}px`, height: `${sh}px` });
    const pw = sw * (PAPER.x1 - PAPER.x0), ph = sh * (PAPER.y1 - PAPER.y0);
    Object.assign(c.ink.style, { left: `${sw * PAPER.x0}px`, top: `${sh * PAPER.y0}px`, width: `${pw}px`, height: `${ph}px` });
    c.ink.width = Math.max(1, Math.round(pw * dpr));
    c.ink.height = Math.max(1, Math.round(ph * dpr));
    const firstLayout = this._paper.w === 1;
    this._paper = { w: pw, h: ph, dpr };
    this._stage = { x: sx, y: sy, w: sw, h: sh };
    if (this._lane === 'hands') {
      // MAP3: the sheet keeps the size the 4:3 fit gives it, but sits at
      // the root's origin under its matrix. AUDIT-MAP2: the aspect is
      // PAPER of a 4:3 stage - the same at any size - so the rig is NOT
      // re-asked (a hold repacks the whole arm mesh); the placement is
      // recomputed for the new sheet size on the next tick.
      Object.assign(c.stage.style, { left: '0px', top: '0px', width: '100%', height: '100%' });
      Object.assign(c.ink.style, { left: '0px', top: '0px' });
      this._cornersKey = null;
    }
    if (firstLayout) {
      // at rest the whole bay is on the sheet, centred
      const scale = scaleMinOf(this._limits());
      this._view = clampView({ ox: 0, oy: 0, scale }, this._limits());
      this._goal = { ...this._view };
    } else {
      this._view = clampView(this._view, this._limits());
      this._goal = clampView(this._goal, this._limits());
    }
    this._dirty = true;
  }

  _limits() {
    return { mapW: this._size.width, mapH: this._size.height, paperW: this._paper.w, paperH: this._paper.h };
  }

  // ── MAP3: THE HANDS LANE ───────────────────────────────────────

  /** Ask the host's holder for the arm. On yes the sprite and its keyed
   *  thumbs go, the root goes clear (the world and the arm show through)
   *  and the ink canvas is placed by the sheet's corners from now on. */
  _tryHands() {
    const h = this.deps.holder;
    if (this._lane === 'hands') { this._handsTries = 0; return false; }
    // AUDIT-FIELD F2: THE RETRY IS ARMED BY THE FIRST ASK, NOT BY THE
    // FIRST ANSWER. This counter is the whole reason the sprite lane
    // keeps asking for thirty ticks - "in case the rig had not posed
    // yet" - and the ask that arms it used to ZERO it whenever
    // `available()` said no, which is precisely the case it exists for.
    // `armsAvailable()` wants `fpArm.active()`, which wants a mesh, and
    // the mesh is nulled by `releaseMesh()` on every piece rebuild (an
    // equip, a body swap) and is not up at all in a world's first
    // frames - so a map opened in any of those moments was latched to
    // the painted sprite for the whole open, with the retry written to
    // prevent exactly that doing nothing. MAP-FIELD made this
    // reachable: before it `available` was `armsDrawn()`, which a
    // sheathed player could never answer yes to anyway.
    if (this._handsTries === 0) this._handsTries = 1;
    if (!h?.available?.()) return false;
    if (!h.hold?.(null, { aspect: this._paper.w / this._paper.h })) return false;
    this._lane = 'hands';
    this._handsTries = 0;
    this._handsLost = 0;
    const c = this._chrome;
    c.root.classList.toggle('hmlanehands', true);   // AUDIT-MAP2: NOT 'hmhands' - that is the thumbs canvas's class, and its rule is pointer-events: none
    c.sheet.style.display = 'none';   // MAP-FIELD2: the canvas is what the stage shows
    c.hands.style.display = 'none';
    Object.assign(c.ink.style, { left: '0px', top: '0px', transformOrigin: '0 0', opacity: '0' });
    Object.assign(c.stage.style, { left: '0px', top: '0px', width: '100%', height: '100%' });
    this._cornersKey = null;
    this._dirty = true;
    return true;
  }

  /** AUDIT-MAP2: the way back. The sheet is given up, the painting and its
   *  thumbs return, the layout is redone from scratch; the rig is not asked
   *  again this open. */
  _leaveHands() {
    if (this._lane !== 'hands') return;
    this.deps.holder?.release?.();
    this._lane = 'sprite';
    this._handsTries = 30;
    this._placement = null;
    this._cornersKey = null;
    const c = this._chrome;
    c.root.classList.toggle('hmlanehands', false);
    c.sheet.style.display = '';   // MAP-FIELD2
    c.hands.style.display = '';
    Object.assign(c.ink.style, { transform: '', transformOrigin: '', opacity: '' });
    this._layoutKey = '';
    this._layout();
    this._dirty = true;
  }

  /** The sheet follows the arm: the holder's four corners, into a
   *  homography from the canvas's own rectangle, into the matrix3d the
   *  browser lays the canvas with; hidden while the arm has not drawn. */
  _placeOnHands() {
    const c = this.deps.holder?.corners?.() ?? null;
    const key = c ? c.map((p) => `${Math.round(p[0] * 10) / 10},${Math.round(p[1] * 10) / 10}`).join(';') : '';
    if (key === this._cornersKey) return;
    this._cornersKey = key;
    const q = c ? quadPlacement(this._paper.w, this._paper.h, c) : null;
    this._placement = q;
    const ink = this._chrome.ink;
    if (q) { ink.style.transform = q.css; ink.style.opacity = '1'; } else { ink.style.opacity = '0'; }
  }

  /** Whether a paper point lies on the sheet (with a small margin for a
   *  finger's edge). Off the sheet nothing is hovered, picked or marked. */
  _onSheet(p) {
    return p[0] >= -8 && p[1] >= -8 && p[0] <= this._paper.w + 8 && p[1] <= this._paper.h + 8;
  }

  /** The ink model: chains once per data set (cached on the bytes and
   *  the network reference), marks whenever a filter or the discovery
   *  set moved. */
  _ensureModel() {
    const bytes = this.deps.woods?.heightMapBuffer;
    if (!bytes) return null;
    const net = this.deps.roads?.() ?? null;
    const maps = this.deps.maps;
    const regionCount = maps?.regionCount ?? 0;
    // AUDIT-MAP2: the INK's region read is the maps file's own
    // getRegionIndexAt where the host hands a real MapsFile - it carries
    // the two fixups (politic 64 is the High Rock sea coast, region 31;
    // the bad byte 105 is the Wrothgarian Mountains) that a bare -128
    // turns into "nameless", and a nameless pixel erases the border on
    // its neighbour's side too. The hover and the coordinates name keep
    // the classic window's own bare read, as the classic does.
    const regionAt = (x, y) => {
      const r = typeof maps?.getRegionIndexAt === 'function' ? maps.getRegionIndexAt(x, y) : (maps?.getPoliticIndex?.(x, y) ?? -1) - 128;
      return r >= 0 && r < regionCount ? r : -1;
    };
    let rec = _chainCache.get(bytes);
    if (!rec || rec.net !== net || rec.width !== this._size.width || rec.height !== this._size.height) {
      const m = buildInkModel({
        width: this._size.width, height: this._size.height, heightBytes: bytes,
        climateAt: (x, y) => this.deps.getClimateIndex?.(x, y) ?? -1,
        regionAt, regionCount, roads: net,
      });
      rec = { net, width: this._size.width, height: this._size.height, chains: m };
      _chainCache.set(bytes, rec);
      this._marksDirty = true;
    }
    if (this._model?.coast !== rec.chains.coast) this._model = { ...rec.chains, marks: [] };
    if (this._marksDirty) {
      this._marksDirty = false;
      this._marksVersion = (this._marksVersion ?? 0) + 1;
      this._model.marks = buildInkMarks({
        summaries: this.deps.mapDict?.values() ?? [],
        filters: this.filters,
        isDiscovered: (s) => this._discovered(s),   // MAP2: the ports arm before DFU's own test
        isPort: (s) => hasPort(s?.mapID ?? s?.mapId),
        nameOf: (s) => this._summaryName(s),
      });
    }
    return this._model;
  }

  /** Paint the sheet. Guarded on a real 2D context: node drives this
   *  window against a stub document whose canvas has none, and the
   *  view, the marks and every law above are exercised without it. */
  _paint() {
    this._dirty = false;
    const canvas = this._chrome?.ink;
    const ctx = canvas?.getContext?.('2d');
    const model = this._ensureModel();
    if (!ctx || !model) return;
    const band = zoomBand(this._view.scale);
    const { w: paperW, h: paperH, dpr } = this._paper;
    // AUDIT-MAP (perf): THE STATIC INK IS KEPT. The coast, the carets, the
    // borders, the roads, the marks and the names change only with the
    // view, the band, the sheet, the marks or the mod's state; the rings
    // that breathe are an overlay. So the static half is painted onto a
    // kept layer when its key moves, and a pulse frame is one drawImage
    // and a few arcs - not the whole bay's ink rasterised again.
    const key = [this._view.ox, this._view.oy, this._view.scale, band, paperW, paperH, dpr,
      this._marksVersion, this._portsShown() ? 1 : 0, this.markedMapId,
      this.filters.roads ? 1 : 0, this.filters.tracks ? 1 : 0].join('|');
    const layer = this._layer ?? (this._layer = document.createElement('canvas'));
    const lctx = layer.getContext?.('2d');
    if (key !== this._staticKey || !lctx) {
      this._staticKey = key;
      const target = lctx ?? ctx;
      // AUDIT-MAP2: assigning a canvas's width RESETS its bitmap even to the
      // same value - the kept layer was being freed and re-zeroed on every
      // pan frame; paintInkStatic clears it itself
      if (lctx && (layer.width !== canvas.width || layer.height !== canvas.height)) { layer.width = canvas.width; layer.height = canvas.height; }
      // MAP-FIELD2 (Mac, 2026-09-18): "all the town names need to be
      // taken off the map, since its too cluttered". The sheet inks the
      // GLYPHS alone now - a place is its mark, and its name is read off
      // the label under the pointer and off the search, which is where a
      // hand-drawn map puts it anyway. The PROVINCE names stay: they are
      // far/mid only, a handful of words across the whole bay, and they
      // are what makes the sheet readable when it is zoomed out.
      //
      // `placeNames` itself is NOT deleted - it is inkMap's law and its
      // own pin stands (test/heldmap.test.js): what went is this sheet's
      // use of it, and the measure cache it needed. Nothing else on the
      // sheet measures text, so the cache goes with it.
      paintInkStatic(target, model, this._view, {
        paperW, paperH, dpr, band,
        filters: this.filters, names: null, regionNames: REGION_NAMES,
        // MAP2: the harbours while the mod restricts ships to ports, and the mark in the mod's colour
        ports: this._portsShown(),
        markedMapId: this.markedMapId,
        markColor: rgbaCss(this._to?.settings?.markLocationColor),
      });
    }
    if (lctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(layer, 0, 0);
    }
    const pulse = 0.5 + 0.5 * Math.sin(this._clock * 3);
    paintInkOverlay(ctx, this._view, {
      paperW, paperH, dpr, clear: false,
      player: this._player,
      selected: this._selected ? { x: this._selected.x, y: this._selected.y, coords: !!this._selected.coords } : null,
      party: this._party.map((m) => ({
        x: m.x, y: m.y, name: partyLabelText(m), online: m.online, stack: m.stack,
        // the colour is DATA, not a theme: online is the party green the
        // rest of the slice draws a member's name in, offline is that
        // green with the life out of it
        color: m.online ? PARTY_MARK_CSS : PARTY_OFFLINE_CSS,
      })),
      pulse,
    });
    if (this._bandShown !== band) { this._bandShown = band; this._chrome.band.textContent = band; }
  }

  _setView(v) {
    this._view = clampView(v, this._limits());
    this._goal = { ...this._view };
    this._dirty = true;
  }
  _nudge(dx, dy) { this._setView({ ox: this._view.ox + dx, oy: this._view.oy + dy, scale: this._view.scale }); }
  /** Zoom by `factor` about paper point (px, py). The scale is clamped
   *  FIRST and the anchor computed for the scale that will actually be
   *  set: anchoring at an over-the-ceiling scale and clamping afterwards
   *  let the point under the cursor drift at the ends of the range (the
   *  browser probe caught it at SCALE_MAX). */
  _zoomBy(factor, px, py) {
    const lim = this._limits();
    const target = clamp(this._view.scale * factor, scaleMinOf(lim), SCALE_MAX);
    this._setView(zoomAt(this._view, target / this._view.scale, px, py));
  }
  /** Glide to map pixel (x, y) at least this close. */
  _focusOn(x, y, scale = FOCUS_SCALE) {
    const s = Math.max(this._view.scale, scale);
    this._goal = clampView(viewCentredOn(x, y, s, this._limits()), this._limits());
    this._dirty = true;
  }

  /** Client coordinates to paper pixels - through the inverse homography
   *  in the hands lane (MAP3), where the canvas is laid at an angle. */
  _paperPoint(clientX, clientY) {
    if (this._lane === 'hands') {
      const r = this._chrome.root.getBoundingClientRect?.() ?? { left: 0, top: 0 };
      const p = this._placement?.toSheet(clientX - r.left, clientY - r.top);
      // AUDIT-MAP2: the stage is the whole viewport here; a point that is
      // not on the sheet (the world around it, or beyond the paper's
      // vanishing line) is nowhere on the map
      return p && this._onSheet(p) ? p : OFF_SHEET;
    }
    const r = this._chrome.ink.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    return [clientX - r.left, clientY - r.top];
  }

  // ── SOC6: THE PARTY ON THE MAP ─────────────────────────────────

  /** The host's party, read and placed. Returns whether anything the
   *  player can see changed - the caller repaints on true and does
   *  nothing on false, which is the ordinary answer four times a second
   *  while nobody moves. Never dirties the location marks. */
  _refreshParty() {
    // AUDIT-MAP2: the player's own pixel is polled on the same cadence -
    // opened during a journey, the cross keeps up with the rings
    const p = this.deps.getPlayerPixel?.();
    if (p && (p.x !== this._player.x || p.y !== this._player.y)) { this._player = { x: p.x, y: p.y }; this._dirty = true; }
    const marks = readPartyMarks(this.deps.party, this._size);
    const key = partyMarksKey(marks);
    if (key === this._partyKey) return false;
    this._partyKey = key;
    // AUDIT SOC D2: `stack` is how many members were already standing on
    // this member's map pixel - the i-th drops i labels further down, in
    // the hub's own seat order, so a party sharing a town reads as a
    // list rather than as one smeared name.
    const onPixel = new Map();
    this._party = marks.map((m) => {
      const key2 = `${m.px},${m.py}`;
      const stack = onPixel.get(key2) ?? 0;
      onPixel.set(key2, stack + 1);
      return { ...m, x: m.px + 0.5, y: m.py + 0.5, stack };
    });
    this._renderLegend();
    this._dirty = true;
    return true;
  }

  /** The legend: the map grew a mark the art never explained, so the
   *  mark explains itself - and only while there is one to explain. */
  _renderLegend() {
    const leg = this._chrome?.legend;
    if (!leg) return;
    leg.innerHTML = '';
    if (!this._party.length) { leg.classList.toggle('open', false); leg.style.display = 'none'; return; }
    const dot = el('span', 'hmlegdot');
    dot.style.background = this._party.some((m) => m.online) ? PARTY_MARK_CSS : PARTY_OFFLINE_CSS;
    leg.append(dot, el('span', 'hmlegtext', PARTY_LEGEND_TEXT));
    leg.classList.toggle('open', true);
    leg.style.display = 'flex';
  }

  /** The member under the cursor, by a paper-space radius of 18 - two
   *  pixels WIDER than the location markers' own 16 (`_markerAt`), and
   *  deliberately so: a member's ring is drawn smaller than a city's
   *  but it is the answer the player is reaching for when they point
   *  at one, so it is the easier of the two to hit. */
  _partyAt(sx, sy) {
    let best = null, bestD = 18 * 18;
    for (const m of this._party) {
      const [x, y] = toPaper(this._view, m.x, m.y);
      const d = (x - sx) * (x - sx) + (y - sy) * (y - sy);
      if (d < bestD) { best = m; bestD = d; }
    }
    return best;
  }

  /** The inked mark under the cursor - only a mark the current band
   *  shows can be picked, because a mark that is not on the sheet is
   *  not a thing the player pointed at. */
  _markerAt(sx, sy) {
    let best = null, bestD = 16 * 16;
    const model = this._ensureModel();
    if (!model) return null;
    const shown = BAND_MARKS[zoomBand(this._view.scale)] ?? BAND_MARKS.near;
    for (const m of model.marks) {
      if (!shown.has(m.colorIndex)) continue;
      const [x, y] = toPaper(this._view, m.x, m.y);
      const d = (x - sx) * (x - sx) + (y - sy) * (y - sy);
      if (d < bestD) { best = m; bestD = d; }
    }
    return best;
  }

  // ── MAP2: THE MOD'S ADDITIONS ──────────────────────────────────

  /** TO1 (:828-844): with the PORTS filter on, a place without a
   *  harbour is not on the map at all - the mod's override answers false
   *  before DFU's own discovery test is even reached. Marks, the search
   *  and the journal's click-through all ask this, as the classic
   *  window's override is asked by all three. */
  _discovered(summary) {
    if (!portsFilterAllows(this.portsFilter, summary?.mapID ?? summary?.mapId)) return false;
    return checkLocationDiscovered(summary);
  }

  /** The ports button shows only while the mod restricts ship travel to
   *  ports (:148). */
  _portsShown() { return !!this._to?.settings?.shipTravelPortsOnly; }

  _togglePorts() {
    this.portsFilter = !this.portsFilter;
    this._marksDirty = true;
    this._dirty = true;
    this._renderPorts();
  }

  _renderPorts() {
    const b = this._chrome?.ports;
    if (!b) return;
    const shown = this._portsShown();
    b.style.display = shown ? 'inline-block' : 'none';
    b.classList.toggle('on', this.portsFilter);
    b.textContent = this.portsFilter ? 'Ports only' : 'Ports';
  }

  /** TO1 (:532-550), MarkLocationHandler - the MIDDLE click marks the
   *  place under the cursor, or clears the mark when it is already this
   *  one. The ring is inked by paintInk in MarkLocationColor. */
  _markLocationHandler(sx, sy) {
    if (!this._onSheet([sx, sy])) return;   // AUDIT-MAP2: off the paper is off the map
    const m = this._markerAt(sx, sy);
    if (!m) return;
    const id = m.mapId ?? -1;
    this.markedMapId = this.markedMapId === id ? -1 : id;
    this._dirty = true;
  }

  /** TO1 (:374-464), DisplayLocationInfo - the I key over a selected
   *  place. The rows are ui/travelMapOptions.js's; this holds the box. */
  _displayLocationInfo() {
    if (!this._selected || this._selected.coords || this._info) return;
    const summary = this._selected.summary;
    const info = locationInfoRows(summary?.locationType,
      this.deps.discoveredBuildings?.(summary) ?? null,
      (t) => this.deps.buildingTypeName?.(t) ?? String(t));
    const title = this._selected.name;
    if (!info) {
      this._info = { title: '', rows: [toFormat(TO_TEXT.MsgNoKnowledge, title)], cells: [] };
    } else {
      this._info = {
        title,
        rows: info.guilds ? [info.guilds] : [],
        // :437-441 - two columns; the grid below is the sheet's own two
        cells: info.rows.map((r) => `${r.name}  ${r.count}`),
      };
    }
    this._renderBox();
  }

  /** AUDIT-TO1 H1: the help in this window's own box, one row per line
   *  as DisplayHelpInfo's Split('\n') gives it. */
  _displayHelp() {
    if (this._info) return;
    const rows = this.deps.helpRows?.();
    if (rows?.length) { this._info = { title: '', rows: rows.slice(), cells: [] }; this._renderBox(); }
    else this.deps.onHelp?.();
  }

  _closeInfo() {
    this._info = null;
    this._renderBox();
  }

  /** ENH-NOTICE3: the I/H box's words, as the panel carries rows. The
   *  two-column grid of building counts becomes one row per cell - the
   *  panel is a column at the screen's edge and has no second column to
   *  give - and the title rides a highlighted row rather than an <h3>.
   *  No "any key or click to close" row: the panel says
   *  ClickAnywhereToClose in its own hint (enhancedNotice.js's
   *  NOTICE_HINT), so a second copy would be two captions. */
  _infoNoticeRows() {
    const i = this._info;
    if (!i) return null;
    const out = [];
    if (i.title) out.push({ text: i.title, center: true, highlight: true });
    for (const r of i.rows) out.push({ text: r, center: false });
    for (const c of i.cells) out.push({ text: c, center: false });
    return out.length ? out : null;
  }

  /** The box over the sheet: the I/H box, or the resume prompt. */
  _renderBox() {
    const box = this._chrome?.box;
    if (!box) return;
    box.innerHTML = '';
    // ENH-NOTICE3 - WHICH OF THE TWO IS A NOTICE, off the mod's own
    // source. The I key's building list and the H help are
    // `infoBox.ClickAnywhereToClose = true`
    // (TravelOptionsMapWindow.cs:452-453) and the "no knowledge"
    // answer is `DaggerfallUI.MessageBox(MsgNoKnowledge)` (:462),
    // which is ClickAnywhereToClose by construction
    // (DaggerfallUI.cs:1328-1336) - so both are the panel's. The
    // RESUME prompt is a
    // `DaggerfallMessageBox(..., CommonMessageBoxButtons.YesNo, ...)`
    // (:334-338): a DECISION, and it keeps the box, because Yes and No
    // have to stand under the words the player is answering.
    const onPanel = noticeHold(this._infoOwner, this._infoNoticeRows());
    const modal = !!this._info || this._top === 'resume';
    // The box itself only opens for what it still has to draw. With the
    // info on the panel it stays display:none and the ROOT keeps
    // `hmmodal` on its own: the words moved, the modality did not, and
    // an empty .hmbox would paint a bordered blank over the bay
    // (ui/enhancedStyle.js:1308 - the frame is the box's, not its
    // children's).
    const open = modal && !(this._info && onPanel);
    box.classList.toggle('open', open);
    box.style.display = open ? 'block' : 'none';
    // AUDIT-MAP H6: a box holds the WHOLE sheet - the search, the Close
    // button, the ports button and the card go pointer-dead under it, or
    // a search pick under the resume prompt could begin a second journey.
    // Read off `modal`, never `open`: the dismissing press is the ROOT's
    // capture listener (_mountChrome below), not the box's, so the panel
    // arm must keep the chrome dead exactly as the drawn box did.
    this._chrome.root.classList.toggle('hmmodal', modal);
    if (!open) return;
    if (this._info) {
      if (this._info.title) box.append(el('h3', 'hmbox-title', this._info.title));
      for (const r of this._info.rows) box.append(el('p', 'hmbox-row', r));
      if (this._info.cells.length) {
        const grid = el('div', 'hmbox-grid');
        for (const c of this._info.cells) grid.append(el('span', 'hmbox-cell', c));
        box.append(grid);
      }
      box.append(el('p', 'hmbox-hint', 'any key or click to close'));
      return;
    }
    box.append(el('p', 'hmbox-row hmbox-prompt', resumePrompt(this._to?.destinationName ?? '')));
    const row = el('div', 'hmacts');
    const yes = el('button', 'act', 'Resume');
    yes.onclick = () => this.input('KeyY');
    const no = el('button', 'act hmghost', 'Not now');
    no.onclick = () => this.input('KeyN');
    row.append(yes, no);
    box.append(row);
  }

  /** MAP2: the mod's coordinates click - a bare pixel becomes the
   *  destination when the mod allows it (:1375, targetCoordsAllowed) and
   *  the host can honour it (AUDIT-TO1 I4, coordsAllowed: never online).
   *  Never on a teleport visit: a bare pixel is no place to appear. */
  _coordsAllowedHere() {
    return !!this._to?.settings?.targetCoordsAllowed && (this.deps.coordsAllowed?.() ?? true) && !this.teleportationTravel;
  }

  _regionNameAt(px, py) {
    const politic = this.deps.maps?.getPoliticIndex?.(px, py) ?? -1;
    const region = politic - 128;
    return (region >= 0 && region < (this.deps.maps?.regionCount ?? 0)) ? (REGION_NAMES[region] ?? '') : '';
  }

  // ── SELECTION, TRAVEL, TELEPORT ────────────────────────────────

  _summaryName(summary) {
    // AUDIT-MAP A9: a summary with no region index (a stub, a malformed
    // row) names nothing rather than throwing out of every paint
    if (!Number.isInteger(summary?.regionIndex)) return '';
    const region = this.deps.maps?.getRegion?.(summary.regionIndex);
    return region?.mapNames?.[summary.mapIndex] ?? '';
  }

  /** The classic wrapper's own pick shape, verbatim - and for a bare
   *  pixel (MAP2), the coordinates popup's own {pixel, name}. */
  _pickOf(selected) {
    if (selected.coords) return { pixel: { x: Math.floor(selected.x), y: Math.floor(selected.y) }, name: selected.name };
    const { summary } = selected;
    const pos = getPixelFromPixelID(summary.id);
    return {
      pixel: pos,
      name: selected.name,
      region: REGION_NAMES[summary.regionIndex] ?? '',
      mapId: summary.mapID,
      regionIndex: summary.regionIndex,
      locationIndex: summary.mapIndex,
    };
  }

  _select(mark) {
    this._closePanel();
    if (!mark) { this._selected = null; this._dirty = true; this._renderCard(); return; }
    this._selected = { ...mark, name: mark.name || (mark.summary ? this._summaryName(mark.summary) : '') };
    this._dirty = true;
    this._renderCard();
    // the decision is one press away, and in teleport mode the pick IS
    // the decision, so the confirm opens itself
    if (this.teleportationTravel) this._openPanel('teleport');
  }

  _openPanel(kind) {
    if (!this._selected) return;
    // AUDIT-MAP2: the guild's teleport map has NO travel arm - the classic's
    // _createPopUpWindow returns the TeleportPopUp whenever the map is
    // armed (:1162-1182), so a fast-travel panel here would commit into an
    // onTravel the teleport host never hands over
    if (kind === 'travel' && this.teleportationTravel) kind = 'teleport';
    this._panel = kind;
    if (kind === 'travel') {
      const d = this.deps;
      const readOnce = (v) => (typeof v === 'function' ? !!v() : !!v);
      this._panelState = {
        // the three remembered choices open the panel (the classic
        // popup's Object.assign from the store)
        opts: { ...travelMapPopUpState() },
        // transports are SNAPSHOT at open - a horse bought mid-trip is
        // not a thing (DFU OnPush)
        hasHorse: readOnce(d.hasHorse), hasCart: readOnce(d.hasCart), hasShip: readOnce(d.hasShip),
        trip: null, confirm: false, notice: null,
        // AUDIT-TO1 C2: the mod, for its ship laws
        to: d.travelOptions?.() ?? null,
      };
      this._refreshTrip();
      // AUDIT-TO1 C2: OnPush's guard (TravelOptionsPopUp.cs:53-67) over
      // the remembered toggles, with the trip now billed.
      const st = this._panelState;
      if (st.to) enforceShipRestriction(st.to.settings, st.opts, this._shipCtx());
    } else if (kind === 'teleport') {
      // AUDIT-TO1 C3: ChargeForTeleport (TravelOptionsMapWindow.cs
      // :470-503) on the default skin - the fee below the rank the
      // service is free at, paid on Yes and the map closed on No or on
      // an empty purse. RECORDED DEPARTURE (AUDIT-MAP D3): the C# asks
      // the fee ONCE as the map opens, before any pick, and deducts on
      // Yes whether or not the player then teleports; this sheet asks
      // with the pick and deducts only with the teleport.
      const to = this.deps.travelOptions?.() ?? null;
      let fee = null;
      if (to?.settings?.teleportCost) {
        const cost = teleportCost(this.deps.magesGuildRank?.() ?? 0);
        if (cost > 0) fee = { cost, canPay: (this.deps.gold?.() ?? 0) >= cost, paid: false };
      }
      this._panelState = { opts: null, trip: null, confirm: false, notice: null, fee };
    } else {
      this._panelState = { opts: null, trip: null, confirm: false, notice: null };
    }
    this._renderCard();
  }

  /** AUDIT-TO1 C2: what the ship laws ask of the world, in the popup's
   *  own names. The destination's MAP id (MapSummary.MapID). */
  _shipCtx() {
    const d = this.deps;
    const summary = this._selected?.summary ?? {};
    return {
      currentLocationMapId: d.currentLocationMapId?.() ?? null,
      isOnShip: !!d.isOnShip?.(),
      destinationMapId: summary.mapID ?? summary.mapId ?? null,
      oceanPixels: this._panelState?.trip?.oceanPixels ?? 0,
    };
  }

  _closePanel() {
    if (this._panelState) this._rememberPanel();
    this._panel = null;
    this._panelState = null;
    this._renderCard();
  }

  /** _rememberPopUpState: the store learns the toggles when the panel
   *  goes, however it goes. */
  _rememberPanel() {
    const o = this._panelState?.opts;
    if (o) setTravelMapPopUpState(o);
  }

  /** ONE JOURNEY for the card's bill: the walk priced once by
   *  calculateTravelTime (which walks walkTravelPath itself). AUDIT-MAP2:
   *  the `path` and `byRoad` the relief map's route line read went with
   *  it - nothing on the card reads them, and the second walk was a
   *  thousand objects per toggle. Memoised on the inputs, because the
   *  card re-renders on every toggle. */
  _journey(dest, opts) {
    const start = this.deps.getPlayerPixel();
    const key = `${start.x},${start.y}>${dest.x},${dest.y}|${JSON.stringify(opts)}`;
    if (this._journeyKey === key) return this._journeyVal;
    const j = { ...calculateTravelTime(start, dest, opts, this.deps.getClimateIndex) };
    this._journeyKey = key;
    this._journeyVal = j;
    return j;
  }

  _refreshTrip() {
    const st = this._panelState;
    if (!st?.opts || !this._selected) return;
    const sel = this._selected;
    const dest = sel.coords ? { x: Math.floor(sel.x), y: Math.floor(sel.y) } : getPixelFromPixelID(sel.summary.id);
    const time = this._journey(dest, {
      speedCautious: st.opts.speedCautious,
      sleepModeInn: st.opts.sleepModeInn,
      travelShip: st.opts.travelShip,
      hasHorse: st.hasHorse, hasCart: st.hasCart,
    });
    // TP1 - GuildManager.FastTravel (DaggerfallTravelPopUp.cs:284),
    // BETWEEN CalculateTravelTime and CalculateTripCost exactly as DFU
    // orders them, so the Temple of Akatosh's blessing shortens the
    // fare and the days as well as the journey. The classic popup
    // folds it at ui/travelPopUp.js; this is the same fold on the same
    // deps, and everything the card bills or commits reads the blessed
    // minutes.
    const minutes = guildFastTravel(this.deps.playerEntity?.() ?? null, time.minutes);
    // OL2 / AUDIT-MAP H1: online the world's clock does not wait - no
    // nights, so no inn is paid and the arrival is now; the popup's own
    // `sleepModeInn && !noWorldTime()` and its zero days
    const nwt = !!this.deps.noWorldTime?.();
    const cost = calculateTripCost(minutes, time.oceanPixels, {
      sleepModeInn: st.opts.sleepModeInn && !nwt, hasShip: st.hasShip, travelShip: st.opts.travelShip,
      // TravelTimeCalculator.cs:163 - the same Knightly Order consult
      // the native popup makes; the enhanced skin bills the same fare.
      freeTavernRooms: !!this.deps.freeTavernRooms?.(),
    });
    // AUDIT-MAP D2: the mod's fare scaling (TravelTimeCalculatorTO.cs
    // :24-40), the popup's own export - the enhanced skin had billed
    // and CHARGED the unscaled fare since the relief map
    const scaled = scaleTripCost(cost, st.to?.settings, this.deps.playerEntity?.() ?? null);
    st.trip = { ...time, minutes, ...scaled, days: nwt ? 0 : travelDays(minutes), online: nwt };
    // MAP2 (TravelOptionsPopUp.cs:104-137, UpdateLabels): a WALKED trip -
    // a bare pixel's, or a place's when the mod's fork says the player
    // drives it - has no fare and its own estimate: the classic one
    // asked with the two settings the mod has taken over inverted, then
    // divided by TWICE the speed multiplier, truncated. Verbatim what
    // ui/travelPopUp.js computes for its own labels.
    const s = st.to?.settings;
    if (s && (sel.coords || isPlayerControlledTravel(s, st.opts))) {
      const w = calculateTravelTime(this.deps.getPlayerPixel(), dest, {
        speedCautious: st.opts.speedCautious && !s.cautiousTravel,
        sleepModeInn: st.opts.sleepModeInn && !s.stopAtInnsTravel,
        travelShip: st.opts.travelShip,
        hasHorse: st.hasHorse, hasCart: st.hasCart,
      }, this.deps.getClimateIndex);
      const mins = guildFastTravel(this.deps.playerEntity?.() ?? null, w.minutes);
      const mult = ((st.opts.speedCautious && s.cautiousTravel) ? s.cautiousTravelMultiplier : s.recklessTravelMultiplier) * 2;
      st.trip.walked = true;
      st.trip.walkedMinutes = Math.trunc(mins / mult);
    }
    st.notice = null;
    this._renderCard();
  }

  _toggleOpt(key) {
    const st = this._panelState;
    if (!st?.opts) return;
    const settings = st.to?.settings;
    // AUDIT-TO1 C2 (TravelOptionsPopUp.cs:182-189, the ship click): under
    // the ports restriction, SELECTING the ship is refused with the
    // mod's own message instead of toggling.
    if (key === 'travelShip' && !st.opts.travelShip && settings?.shipTravelPortsOnly) {
      const refusal = shipTravelRefusal({ settings, ...this._shipCtx() });
      if (refusal) { st.notice = SHIP_REFUSAL_TEXT[refusal]; this._renderCard(); return; }
    }
    st.opts[key] = !st.opts[key];
    st.notice = null;
    // :215-224 - choosing CAMP OUT knocks the transport back to foot
    // when the trip cannot sail
    if (key === 'sleepModeInn' && !st.opts.sleepModeInn && settings?.shipTravelPortsOnly
      && shipTravelRefusal({ settings, ...this._shipCtx() })) st.opts.travelShip = false;
    this._refreshTrip();
  }

  /** Begin: the disease box comes BEFORE the gold check - DFU's own
   *  order - and the gold gate is two-sided: letters of credit count
   *  toward the total but taverns only accept gold pieces. */
  _begin() {
    const st = this._panelState;
    if (!st?.trip) return;
    if (!st.confirm && ((this.deps.diseaseCount?.() ?? 0) > 0 || (this.deps.poisonCount?.() ?? 0) > 0)) {
      st.confirm = true;
      this._renderCard();
      return;
    }
    this._confirmDiseased(true);
  }

  _confirmDiseased(yes) {
    const st = this._panelState;
    if (!st?.trip) return;
    st.confirm = false;
    if (!yes) { this._renderCard(); return; }
    // MAP2: a walked trip pays no fare, so it never reaches the gold
    // check - the mod's own order (CallFastTravelGoldCheck's first arm)
    if (!st.trip.walked) {
      const total = this.deps.gold?.() ?? 0;
      const pieces = this.deps.goldPieces?.() ?? total;
      if (total < st.trip.totalCost || pieces < st.trip.piecesCost) {
        st.notice = 'You do not have enough gold. Taverns only accept gold pieces.';
        this._renderCard();
        return;
      }
    }
    if (this._selected.coords) {
      // MAP2: the coordinates popup's own hand-off - {pixel, name} and the
      // toggles with `playerControlled: true`, to onTravelToCoords
      const opts = { speedCautious: st.opts.speedCautious, sleepModeInn: st.opts.sleepModeInn, travelShip: st.opts.travelShip, playerControlled: true };
      this._rememberPanel();
      this._beginClose({ kind: 'coords', pick: this._pickOf(this._selected), opts });
      return;
    }
    const opts = {
      speedCautious: st.opts.speedCautious,
      sleepModeInn: st.opts.sleepModeInn,
      travelShip: st.opts.travelShip,
      // AUDIT-TO1 C1: the popup's own word for a WALKED trip
      // (TravelOptionsPopUp.cs:80-83), which world.js forks on
      playerControlled: isPlayerControlledTravel(st.to?.settings, st.opts),
    };
    const computed = {
      // AUDIT-MAP D1: a walked trip hands its WALKED estimate - the popup's
      // `{ ...this.trip, minutes: this.travelTimeTotalMins }` - which is what
      // the host's ETA runs down (world.js estimateMinutes -> minutesLeft)
      minutes: st.trip.walked ? st.trip.walkedMinutes : st.trip.minutes,
      oceanPixels: st.trip.oceanPixels,
      piecesCost: st.trip.piecesCost, totalCost: st.trip.totalCost,
    };
    this._rememberPanel();
    // the sheet lowers and the journey begins - there is no flight to
    // fly: the host's own travel (DFU's, or the mod's walked trip) is
    // the journey
    this._beginClose({ kind: 'travel', pick: this._pickOf(this._selected), opts, computed });
  }

  _confirmTeleport(yes) {
    if (!yes) {
      // AUDIT-MAP D3: on the FEE prompt (TravelOptionsMapWindow.cs:483-499)
      // No and an empty purse close the MAP, as the classic window's
      // 'teleportcost'/'teleportpoor' arms do; without a fee it is DFU's
      // own TeleportPopUp, whose No closes only the box - the map stays
      // ARMED for another pick
      if (this._panelState?.fee) { this._beginClose(null); return; }
      this._closePanel();
      return;
    }
    // AUDIT-TO1 C3: Yes on the fee prompt DEDUCTS (:487-489) and goes.
    // AUDIT-MAP2: with no purse for the fee there IS no yes - the classic's
    // 'teleportpoor' box closes the map on any key (:1510); Y had teleported
    // an empty-pursed mage for free.
    const fee = this._panelState?.fee ?? null;
    if (fee && !fee.canPay) { this._beginClose(null); return; }
    if (fee && !fee.paid) { fee.paid = true; this.deps.payTeleport?.(fee.cost); }
    this._beginClose({ kind: 'teleport', pick: this._pickOf(this._selected) });
  }

  /** The journal's click-through: patch the legacy region index (both
   *  sides of the seam do), resolve the place by name, select it, glide
   *  to it and put the decision on screen. */
  _consumeGotoPlace() {
    const site = this._gotoPlace?.siteDetails ?? this._gotoPlace ?? {};
    patchRegionIndex(site.regionIndex ?? -1, site.regionName ?? '');
    const region = this.deps.maps?.getRegionByName?.(site.regionName ?? '');
    const index = region?.mapNameLookup?.get(site.locationName ?? '');
    if (index == null) return;
    const row = region.mapTable[index];
    const pos = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
    const summary = locationSummaryAt(this.deps.mapDict, pos.x, pos.y);
    if (!summary || !this._discovered(summary)) return;
    this._focusOn(pos.x + 0.5, pos.y + 0.5);
    this._select({ x: pos.x + 0.5, y: pos.y + 0.5, colorIndex: 11, kind: 'city', name: '', summary });
    if (!this.teleportationTravel) this._openPanel('travel');
  }

  // ── SEARCH (the find box's laws, bay-wide) ─────────────────────

  _ensureSearchIndex() {
    if (this._searchIndex) return this._searchIndex;
    const byName = new Map();   // display name -> [entry]
    const maps = this.deps.maps;
    const count = maps?.regionCount ?? 0;
    for (let r = 0; r < count; r++) {
      const region = maps.getRegion(r);
      if (!region) continue;
      region.mapNames.forEach((name, i) => {
        const row = region.mapTable[i];
        if (!row) return;
        const pos = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
        const summary = locationSummaryAt(this.deps.mapDict, pos.x, pos.y);
        if (!summary) return;
        const list = byName.get(name) ?? [];
        list.push({ name, regionIndex: r, regionName: REGION_NAMES[r] ?? region.name, summary, pos });
        byName.set(name, list);
      });
    }
    const distance = getDaggerfallDistance();
    distance.setDictionary([...byName.keys()]);
    this._searchIndex = { byName, distance };
    return this._searchIndex;
  }

  /** FindLocation's own ladder per candidate: ranked by the weighted
   *  edit distance, gated by discovery, cut off at half the best
   *  relevance - only the dictionary is the whole bay instead of one
   *  region (recorded departure). */
  _findLocations(name, max = 12) {
    if (!name) return [];
    const { byName, distance } = this._ensureSearchIndex();
    const matches = distance.findBestMatches(name, 200);   // AUDIT-MAP2: the box shows twelve; a thousand kept every name in the bay through the full DP per keystroke
    const out = [];
    let cutoff = null;
    for (const match of matches) {
      const entries = byName.get(match.text) ?? [];
      for (const entry of entries) {
        if (!this._discovered(entry.summary)) continue;
        if (cutoff === null) cutoff = new MatchesCutOff(match.relevance);
        else if (!cutoff.keep(match.relevance)) return out;
        out.push(entry);
        if (out.length >= max) return out;
      }
    }
    return out;
  }

  _searchPick(entry) {
    this._focusOn(entry.pos.x + 0.5, entry.pos.y + 0.5);
    this._select({ x: entry.pos.x + 0.5, y: entry.pos.y + 0.5, colorIndex: 11, kind: 'city', name: entry.name, summary: entry.summary });
    this._chrome.searchInput.value = '';
    this._renderSearch([]);
  }

  // ── THE CHROME (the sprite, the sheet, the card) ───────────────

  _mountChrome() {
    injectEnhancedStyle();
    injectEnhancedFonts();
    const root = el('div', 'hmroot');
    root.id = 'enhanced-travelmap';
    // MAP-FIELD7: the sheet starts DOWN (on the stage, below) and the
    // chrome starts clear - each child is given its 0 as it is appended,
    // by the _setRaise(0) at the end of the mount. The root itself never
    // carries an opacity again: it carries the stage, and fading it is
    // what faded the sprite.

    // the stage: the sprite, the ink canvas over its paper, the hands
    // keyed back over the ink
    const stage = el('div', 'hmstage');
    const sprite = el('img');   // MAP-FIELD2: the LOADER - never appended; `sheet` below is what the stage shows
    sprite.alt = '';
    sprite.draggable = false;
    const ink = el('canvas', 'hmink');
    const hands = el('canvas', 'hmhands');
    // MAP-FIELD2: the sprite the player SEES is a canvas, because the
    // painting's own black matte has to come off before it is drawn -
    // the <img> stays as the loader and never enters the document.
    const sheet = el('canvas', 'hmsprite');
    stage.append(sheet, ink, hands);
    // the handler BEFORE the source, so a cached picture cannot land first
    sprite.onload = () => { this._paintSheet(sprite, sheet); this._keyHands(sprite, hands); };
    sprite.src = HELD_MAP_URL;

    const top = el('div', 'hmtop');
    const label = el('div', 'hmlabel', '');
    const search = el('div', 'hmsearch');
    const searchInput = el('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Find a place…';
    searchInput.maxLength = 32;   // FIND_MAX_CHARACTERS, the find box's own cap
    const results = el('ul', 'hmresults');
    search.append(searchInput, results);
    const close = el('button', 'act hmclose', 'Close');
    close.onclick = () => { if (this._phase === 'map') this._beginClose(null); };
    top.append(label, search, close);

    const card = el('div', 'hmcard');
    const foot = el('div', 'hmfoot');
    const hint = el('div', 'hmhint', 'drag to pan · scroll to zoom · Esc to close');
    const band = el('div', 'hmband', '');
    // SOC6: the legend, beside the hint, only while there is a mark to explain
    const legend = el('div', 'hmlegend');
    // MAP2: the ports button (the classic page's TO1 button, :191-197),
    // shown only while the mod restricts ship travel to ports
    const ports = el('button', 'act hmports', 'Ports');
    ports.onclick = () => { if (this._phase === 'map') this._togglePorts(); };
    foot.append(hint, band, legend, ports);
    // MAP2: the box over the sheet - the I/H box, or the resume prompt
    const box = el('div', 'hmbox');

    root.append(stage, top, card, foot, box);
    document.body.append(root);
    this._chrome = { root, stage, sprite, sheet, ink, hands, label, search, searchInput, results, close, card, hint, band, legend, ports, box };
    // MAP-FIELD7: down and clear before the first tick, or the sheet
    // shows for one frame in its held place and then jumps to the floor
    // to start travelling.
    this._setRaise(0);
    this._renderPorts();
    this._refreshParty();   // SOC6: the marks stand with the window, not a quarter second after it
    // the names are inked in the web display face; the first paint may
    // run before it lands, so the sheet is repainted once when it does
    try {
      const fonts = document.fonts;
      const landed = () => { if (!this.done) { this._staticKey = ''; this._dirty = true; } };
      (fonts?.load?.("14px 'Cormorant'") ?? fonts?.ready)?.then?.(landed);
      fonts?.ready?.then?.(landed);
    } catch { /* no font set */ }

    // MAP2 (:449): the info box is ClickAnywhereToClose - a pointer down
    // ANYWHERE closes it and goes no further, ahead of the stage's own
    // handlers (capture), so the click neither pans nor picks
    root.addEventListener('pointerdown', (e) => {
      if (!this._info) return;
      e.stopPropagation?.();
      e.preventDefault?.();   // and no focus for the search field under it
      this._closeInfo();
      // AUDIT-MAP D4: the CLICK that follows this pointer down still fires
      // on its target - the Close button, Begin, the ports button - so it
      // is swallowed too: the box eats the whole press (C# :453)
      this._swallowClick = true;
    }, { capture: true });
    root.addEventListener('click', (e) => {
      if (!this._swallowClick) return;
      this._swallowClick = false;
      e.stopPropagation?.(); e.preventDefault?.();
    }, { capture: true });

    // the search field owns its keys - the host must never route a
    // typed character into the map's own bindings
    searchInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { searchInput.value = ''; this._renderSearch([]); searchInput.blur(); }
    });
    searchInput.addEventListener('input', () => {
      this._renderSearch(this._findLocations(searchInput.value));
    });

    // the middle button's browser autoscroll is a MOUSE default, which a
    // cancelled pointerdown does not reach; auxclick is where it is shut
    stage.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault?.(); });
    stage.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault?.(); });
    // pointer: pan, zoom to cursor, pick - on the stage, which is the
    // sprite and the sheet together. ONE finger pans; a SECOND pinches
    // (AUDIT-MAP B3: the sheet is a touch surface too - TI3), zooming
    // about the fingers' midpoint and panning with it; a third is ignored.
    let downAt = null, panned = false;
    let second = null;   // { id, x, y }: the pinching finger
    let pinch = null;    // { dist, mx, my, ox, oy, scale }: the pinch's anchor
    // AUDIT-MAP2: the fingers' distance is measured ON THE SHEET (through
    // the inverse in the hands lane, the plain offset in the sprite lane),
    // so foreshortening does not read as a pinch
    const pinchState = (a, b) => {
      const A = this._paperPoint(a.x, a.y), B = this._paperPoint(b.x, b.y);
      return { dist: Math.hypot(B[0] - A[0], B[1] - A[1]), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };
    stage.addEventListener('pointerdown', (e) => {
      if (this._phase !== 'map') return;
      if (this._top) return;   // the resume prompt holds the sheet
      // MAP2 (:532-550): the MIDDLE button marks the place under the cursor
      if (e.button === 1) { e.preventDefault?.(); this._markLocationHandler(...this._paperPoint(e.clientX, e.clientY)); return; }
      // AUDIT-MAP2: in the hands lane a press off the sheet is a press on
      // the world, not on the map - no pan, no pick, no pinch from it
      if (this._lane === 'hands' && this._paperPoint(e.clientX, e.clientY) === OFF_SHEET) return;
      if (downAt && !second && e.pointerId !== downAt.id) {
        second = { id: e.pointerId, x: e.clientX, y: e.clientY };
        const p = pinchState({ x: downAt.cx, y: downAt.cy }, second);
        pinch = { ...p, ox: this._view.ox, oy: this._view.oy, scale: this._view.scale };
        panned = true;   // a pinch is never a pick
        stage.setPointerCapture?.(e.pointerId);
        return;
      }
      if (downAt) return;
      downAt = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, ox: this._view.ox, oy: this._view.oy };
      panned = false;
      stage.setPointerCapture?.(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (this._phase !== 'map') return;
      if (second && e.pointerId === second.id) { second.x = e.clientX; second.y = e.clientY; }
      else if (downAt && e.pointerId === downAt.id) { downAt.cx = e.clientX; downAt.cy = e.clientY; }
      else if (downAt) return;
      if (downAt && second && pinch) {
        // the fingers' distance scales, their midpoint pans: the map point
        // under the midpoint at the pinch's start stays under it
        const p = pinchState({ x: downAt.cx, y: downAt.cy }, second);
        const scale = clamp(pinch.scale * (p.dist / Math.max(1, pinch.dist)), scaleMinOf(this._limits()), SCALE_MAX);
        const [ax, ay] = this._paperPoint(pinch.mx, pinch.my);
        const [bx, by] = this._paperPoint(p.mx, p.my);
        const anchor = { ox: pinch.ox, oy: pinch.oy, scale: pinch.scale };
        const [mx, my] = toMap(anchor, ax, ay);
        this._setView({ ox: mx - bx / scale, oy: my - by / scale, scale });
        return;
      }
      if (downAt) {
        const dx = e.clientX - downAt.x, dy = e.clientY - downAt.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) panned = true;
        // the drag in SHEET pixels (MAP3: in the hands lane the sheet lies
        // at an angle, so a screen pixel is not a sheet pixel; in the
        // sprite lane the two are the same offset)
        const A = this._paperPoint(downAt.x, downAt.y);
        const B = this._paperPoint(e.clientX, e.clientY);
        if (A === OFF_SHEET || B === OFF_SHEET) return;   // dragged off the sheet: the pan waits where it was
        this._setView({ ox: downAt.ox - (B[0] - A[0]) / this._view.scale, oy: downAt.oy - (B[1] - A[1]) / this._view.scale, scale: this._view.scale });
      } else {
        this._hoverLabel(...this._paperPoint(e.clientX, e.clientY));
      }
    });
    const lift = (e) => {
      if (second && e.pointerId === second.id) { second = null; pinch = null; if (downAt) { downAt.x = downAt.cx; downAt.y = downAt.cy; downAt.ox = this._view.ox; downAt.oy = this._view.oy; } return true; }
      if (downAt && e.pointerId === downAt.id) {
        if (second) {
          // the first finger left first: the second carries on as the pan
          downAt = { id: second.id, x: second.x, y: second.y, cx: second.x, cy: second.y, ox: this._view.ox, oy: this._view.oy };
          second = null; pinch = null;
          return true;
        }
        return false;
      }
      return true;   // a finger this sheet never adopted
    };
    stage.addEventListener('pointerup', (e) => {
      if (this._phase !== 'map') { downAt = null; second = null; pinch = null; return; }
      if (lift(e)) return;
      if (downAt && !panned) this._pickAt(...this._paperPoint(e.clientX, e.clientY));
      downAt = null;
    });
    stage.addEventListener('pointercancel', (e) => {
      if (lift(e)) return;
      downAt = null;
    });
    stage.addEventListener('wheel', (e) => {
      if (this._phase !== 'map') return;
      if (this._top || this._info) return;   // AUDIT-MAP2: a box holds the sheet still under the wheel too
      e.preventDefault();
      // zoom toward the cursor: the map point under it stays still. The
      // delta is PIXELS; a line-mode wheel (Firefox, some mice) reports
      // lines and a page-mode one pages - normalised (AUDIT-MAP H8)
      const [px, py] = this._paperPoint(e.clientX, e.clientY);
      this._zoomBy(Math.exp(-wheelPixels(e, this._paper.h) * 0.0012), px, py);
    }, { passive: false });
    // AUDIT-MAP H4: iOS Safari page-pinches under touch-action: none; only
    // a cancelled touchmove holds a live gesture (INV3's lesson)
    stage.addEventListener('touchmove', (e) => { e.preventDefault?.(); }, { passive: false });

    // mouselook's lock never survives a map - the wizard's law
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* no lock to drop */ }
  }

  _unmountChrome() {
    this._chrome?.root?.remove();
    this._chrome = null;
  }

  /** The thumbs, keyed back over the ink: inside each of THUMB_ZONES
   *  the sprite's own thumb is found as one blob reaching in from that
   *  hand's side (keyThumbPixels) and copied onto the hands canvas,
   *  everything else left clear. The painting's matte is keyed here too
   *  Runs once, when the sprite has loaded; a document with no 2D
   *  context (node) skips it. */
  /** The sprite as the stage actually shows it: the painting, with the
   *  arms carried off the bottom edge. The <img> is only the loader.
   *
   *  MAP-FIELD4: this used to key the first painting's black matte out
   *  here as well. That art is gone and so is the key - Mac's second
   *  painting carries its own alpha, and keying grey gauntlets by
   *  brightness would punch holes through them. A failure here leaves
   *  the canvas blank rather than putting a slab over the world, which
   *  is the safer of the two. */
  _paintSheet(sprite, sheet) {
    try {
      const w = sprite.naturalWidth || SPRITE.w, h = sprite.naturalHeight || SPRITE.h;
      const ctx = sheet.getContext?.('2d');
      if (!ctx) return;
      sheet.width = w; sheet.height = h;
      ctx.drawImage(sprite, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      extendCuffs(img.data, w, h);   // MAP-FIELD2: the arms run off the bottom edge instead of ending above it
      ctx.putImageData(img, 0, 0);
    } catch (e) {
      console.warn('[heldmap] the sheet would not paint', e);
    }
  }

  _keyHands(sprite, hands) {
    try {
      const w = sprite.naturalWidth || SPRITE.w, h = sprite.naturalHeight || SPRITE.h;
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const octx = off.getContext?.('2d');
      const hctx = hands.getContext?.('2d');
      if (!octx || !hctx) return;
      hands.width = w; hands.height = h;
      octx.drawImage(sprite, 0, 0, w, h);
      for (const z of THUMB_ZONES) {
        const x0 = Math.floor(z.x0 * w), y0 = Math.floor(z.y0 * h);
        const zw = Math.ceil((z.x1 - z.x0) * w), zh = Math.ceil((z.y1 - z.y0) * h);
        const img = octx.getImageData(x0, y0, zw, zh);
        keyThumbPixels(img.data, zw, zh, z.side);
        hctx.putImageData(img, x0, y0);
      }
    } catch (e) {
      console.warn('[heldmap] the hands would not key', e);
    }
  }

  _hoverLabel(sx, sy) {
    if (!this._onSheet([sx, sy])) { this._chrome.label.textContent = ''; return; }   // AUDIT-MAP2: off the paper is off the map
    // SOC6: a party member wins the label over the place they are
    // standing in - the player pointed at the green ring, and "who"
    // is the answer they asked for.
    const pm = this._partyAt(sx, sy);
    if (pm) {
      // AUDIT SOC D2: every member ON THAT PIXEL, not the nearest of them.
      this._chrome.label.textContent = this._party
        .filter((m) => m.px === pm.px && m.py === pm.py)
        .map(partyHoverText).join(' / ');
      this._chrome.stage.style.cursor = 'pointer';
      return;
    }
    const m = this._markerAt(sx, sy);
    if (m) {
      const name = m.name || this._summaryName(m.summary);
      const region = REGION_NAMES[m.summary.regionIndex] ?? '';
      // UpdateRegionLabel's own "Region : Location" reading
      this._chrome.label.textContent = region && name ? `${region} : ${name}` : name;
      this._chrome.stage.style.cursor = 'pointer';
      return;
    }
    this._chrome.stage.style.cursor = '';
    const [mx, my] = toMap(this._view, sx, sy);
    const px = Math.floor(mx), py = Math.floor(my);
    if (px < 0 || py < 0 || px >= this._size.width || py >= this._size.height) { this._chrome.label.textContent = ''; return; }
    // the raw politic read, range-checked - the classic window's own
    // region-under-cursor law; the sea answers nothing
    const politic = this.deps.maps?.getPoliticIndex?.(px, py) ?? -1;
    const region = politic - 128;
    this._chrome.label.textContent =
      (region >= 0 && region < (this.deps.maps?.regionCount ?? 0)) ? (REGION_NAMES[region] ?? '') : '';
  }

  _pickAt(sx, sy) {
    if (!this._onSheet([sx, sy])) return;   // AUDIT-MAP2: off the paper is off the map (the sprite's hands, the world)
    const m = this._markerAt(sx, sy);
    if (m) { this._select(m); return; }
    // MAP2 (:1375): a bare pixel opens the coordinates decision when the
    // mod allows it - the classic page's own click, on the sheet.
    // AUDIT-MAP2: "bare" is the DATA's word (the classic's locationSelected
    // - a discovered place on the pixel - not whether this band inks it):
    // a click dead on a hamlet the far band hides is not a nameless walk
    // to its pixel. The band still hides it from the pick (MAP1's law).
    if (this._coordsAllowedHere()) {
      const [mx, my] = toMap(this._view, sx, sy);
      const px = Math.floor(mx), py = Math.floor(my);
      const marks = this._ensureModel()?.marks ?? [];
      const placeHere = marks.some((k) => Math.floor(k.x) === px && Math.floor(k.y) === py);
      if (!placeHere && px >= 0 && py >= 0 && px < this._size.width && py < this._size.height) {
        this._select({ coords: true, x: px + 0.5, y: py + 0.5, colorIndex: -1, kind: 'coords', name: toFormat(TO_TEXT.MsgTargetCoords, px, py), summary: null, mapId: null });
        this._openPanel('travel');
        return;
      }
    }
    if (this._selected) this._select(null);
  }

  _renderSearch(entries) {
    const ul = this._chrome.results;
    ul.innerHTML = '';
    for (const entry of entries) {
      const li = el('li');
      const b = el('button', 'hmresult');
      b.append(el('span', 'hmresult-name', entry.name), el('span', 'hmresult-region', entry.regionName));
      b.onclick = () => this._searchPick(entry);
      li.append(b);
      ul.append(li);
    }
    ul.classList.toggle('open', entries.length > 0);
  }

  _renderCard() {
    const card = this._chrome?.card;
    if (!card) return;
    card.innerHTML = '';
    card.classList.toggle('open', !!this._selected && this._phase === 'map');
    // ENH-NOTICE3 - THE CARD'S `notice` IS A CLICK-ANYWHERE BOX in both
    // of its two writers, and on the enhanced skin it is the panel's:
    //
    //   - the ship refusal (_toggleOpt below) is one of
    //     TravelOptionsPopUp.cs:168-180's three message boxes, which the
    //     classic twin still draws as a buttonless parchment
    //     (ui/travelPopUp.js:611-617, `this.top` with no MB_BUTTONS)
    //   - "not enough gold" (_confirmDiseased below) is
    //     DaggerfallTravelPopUp.cs:394-406, showNotEnoughGoldPopup,
    //     `messageBox.ClickAnywhereToClose = true` over TEXT.RSC 454
    //
    // The card's other lines are NOT notices and stay: the diseased
    // warning is DaggerfallTravelPopUp.cs:421-426's Yes/No, the teleport
    // fee is TravelOptionsMapWindow.cs:480-484's Yes/No, and the toggles
    // and the trip's own figures are the popup's labels, not a box.
    // Raised before the early return below so a card that goes away -
    // the selection cleared, the sheet lowering - takes its panel with
    // it rather than leaving one held over the world.
    // ...and the teleport FEE REFUSAL is a third: TravelOptionsMapWindow
    // .cs:497-500's `DaggerfallUI.MessageBox(notEnoughGoldId)`, the same
    // click-anywhere box - the card keeps its Close, which is the map's
    // own exit (:498 CloseWindow), under a panel that carries the words.
    const fee = this._panel === 'teleport' ? (this._panelState?.fee ?? null) : null;
    const feeRefused = !!(fee && !fee.canPay);
    // ...and only while the CARD is up: a selection cleared or a phase
    // turned closes the card, and a refusal still in its state must not
    // stand on the panel over a card that is gone (re-audit B6).
    const cardUp = !!this._selected && this._phase === 'map';
    const cardNotice = cardUp ? ((this._panel === 'travel' && this._panelState?.notice) || (feeRefused ? 'You do not have enough gold.' : null) || null) : null;
    // (The `!onPanel` arms of this window - the info block drawn into
    // .hmbox, the card's own hmnotice/hmprompt lines - are its
    // classic-skin fork and unreachable in the shipping game:
    // ui/travelMapDoor.js mounts it only under the enhanced skin with a
    // document. Kept so the fork is one place, unit-testable on both
    // skins. AUDIT ENH-NOTICE3 B19.)
    // No hint (AUDIT ENH-NOTICE3 B4): the card's refusals clear on the
    // next toggle, the next attempt or the map's own close - never on a
    // click or a key - so the panel makes no promise. The I/H box above
    // keeps the default: any key and any press really do close it.
    const onPanel = noticeHold(this, cardNotice ? [{ text: cardNotice, center: true }] : null, { hint: false });
    if (!this._selected || this._phase !== 'map') return;
    const { summary } = this._selected;
    card.append(el('h3', 'hmname', this._selected.name || 'Unknown place'));
    card.append(el('p', 'hmmeta', this._selected.coords
      ? this._regionNameAt(Math.floor(this._selected.x), Math.floor(this._selected.y))
      : (REGION_NAMES[summary.regionIndex] ?? '')));

    if (this._panel === 'teleport') {
      // AUDIT-TO1 C3: the fee first. No purse for it: the mod's
      // notEnoughGold box, and the map closes (:497-500). ENH-NOTICE3:
      // the words are the panel's above; the card keeps the Close.
      if (feeRefused) {
        if (!onPanel) card.append(el('p', 'hmprompt', 'You do not have enough gold.'));
        const row = el('div', 'hmacts');
        const ok = el('button', 'act hmghost', 'Close');
        ok.onclick = () => this._confirmTeleport(false);
        row.append(ok);
        card.append(row);
        return;
      }
      card.append(el('p', 'hmprompt', fee ? teleportCostPrompt(fee.cost) : `Teleport to ${this._selected.name}?`));
      const row = el('div', 'hmacts');
      const yes = el('button', 'act', fee ? `Pay ${fee.cost} gold` : 'Teleport');
      yes.onclick = () => this._confirmTeleport(true);
      const no = el('button', 'act hmghost', 'Not there');
      no.onclick = () => this._confirmTeleport(false);
      row.append(yes, no);
      card.append(row);
      return;
    }

    if (this._panel === 'travel' && this._panelState) {
      const st = this._panelState;
      if (st.confirm) {
        // the diseased box, BEFORE the gold check - the literal body
        // stands in for TEXT.RSC 1010 (recorded)
        card.append(el('p', 'hmprompt', 'You are ill. Are you sure you wish to travel?'));
        const row = el('div', 'hmacts');
        const yes = el('button', 'act', 'Travel anyway');
        yes.onclick = () => this._confirmDiseased(true);
        const no = el('button', 'act hmghost', 'Stay');
        no.onclick = () => this._confirmDiseased(false);
        row.append(yes, no);
        card.append(row);
        return;
      }
      const pairs = [
        ['Speed', 'speedCautious', 'Cautiously', 'Recklessly'],
        ['Passage', 'travelShip', 'By ship', 'By land'],
        ['Rest', 'sleepModeInn', 'At inns', 'Camp out'],
      ];
      for (const [name, key, onLabel, offLabel] of pairs) {
        const row = el('div', 'hmpair');
        row.append(el('span', 'hmpair-k', name));
        for (const [label, value] of [[onLabel, true], [offLabel, false]]) {
          const b = el('button', `hmpick${st.opts[key] === value ? ' on' : ''}`, label);
          // a click ASSIGNS its member; the hotkeys toggle - the
          // popup's own asymmetry
          b.onclick = () => { if (st.opts[key] !== value) this._toggleOpt(key); };
          row.append(b);
        }
        card.append(row);
      }
      const t = st.trip;
      if (t) {
        const dl = el('dl', 'stats hmtrip');
        const add = (k, v) => { dl.append(el('dt', null, k), el('dd', null, v)); };
        if (t.walked) {
          // MAP2: the popup's own two labels for a walked trip - hours and
          // minutes, and the mod's words in the cost row
          const hours = Math.trunc(t.walkedMinutes / 60), mins = t.walkedMinutes % 60;
          add('Journey', toFormat(TO_TEXT.MsgTimeFormat, hours, mins).trim());
          add('Cost', TO_TEXT.MsgPlayerControlled);
          add('Purse', `${this.deps.goldPieces?.() ?? 0} gold`);   // AUDIT-MAP U5: the popup still shows the coins
        } else {
          add('Journey', t.online ? 'now' : `${t.days} ${t.days === 1 ? 'day' : 'days'}`);   // OL2: online the arrival is now
          add('Cost', `${t.totalCost} gold`);
          // the label shows COINS, never the letters-of-credit total -
          // the popup's own reading
          add('Purse', `${this.deps.goldPieces?.() ?? 0} gold`);
        }
        card.append(dl);
      }
      if (t?.online && !t.walked) card.append(el('p', 'hmmeta', ONLINE_TRAVEL_LINE));   // OL2: the popup's own line   // TO-ONLINE: and not over a walked trip, which online is a real ride now and not an arrival at once
      // TO-FIELD (2026-09-18, Mac: "it... doesn't travel on the road"):
      // THE FOLLOW KEY, SAID WHERE THE TRIP IS BOUGHT. Travel Options
      // does not route along roads to a destination - it beelines, and
      // road following is a MODE the player starts with a key mid-
      // journey (the mod's own readme: "The key used to start/stop path
      // following", and its junction map "pops up when path following
      // stops at a junction"). The port had to move that key off the
      // mod's own F, which this skin spends on the social card, so the
      // one place it was named was the H help INSIDE a running journey -
      // which is no use to a player who has never started one.
      const _fk = this._to?.settings?.followKey;
      if (_fk && _fk !== 'None' && this._to?.settings?.roadsIntegration) {
        card.append(el('p', 'hmmeta', `On the road, press ${_fk} to follow it.`));
      }
      if (st.notice && !onPanel) card.append(el('p', 'hmnotice', st.notice));
      const row = el('div', 'hmacts');
      const go = el('button', 'act', 'Begin journey');
      go.onclick = () => this._begin();
      const cancel = el('button', 'act hmghost', 'Cancel');
      cancel.onclick = () => this._closePanel();
      row.append(go, cancel);
      card.append(row);
      return;
    }

    const row = el('div', 'hmacts');
    const armed = this.teleportationTravel;   // AUDIT-MAP2: the armed map's only offer is the teleport
    const travel = el('button', 'act', armed ? 'Teleport here' : 'Travel here');
    travel.onclick = () => this._openPanel(armed ? 'teleport' : 'travel');
    row.append(travel);
    card.append(row);
  }
}

/** A wheel event's travel in PIXELS whatever its deltaMode: 0 pixels,
 *  1 lines (sixteen a line, the browsers' own figure), 2 pages (the
 *  sheet's height). */
export function wheelPixels(e, pageHeight) {
  const d = Number(e.deltaY) || 0;
  if (e.deltaMode === 1) return d * 16;
  if (e.deltaMode === 2) return d * (pageHeight || 800);
  return d;
}

/** MAP2: a mod colour ([r, g, b, a] bytes, modSettings colorKeyRgba) as
 *  a CSS colour for the pen; null when the setting is absent. */
export function rgbaCss(rgba) {
  if (!Array.isArray(rgba) || rgba.length < 3) return null;
  const a = rgba.length > 3 ? rgba[3] / 255 : 1;
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${Math.round(a * 1000) / 1000})`;
}


/** MAP-FIELD3/4: THE THUMB IS ONE BLOB, AND IT IS FOUND BY COLOUR.
 *
 *  Three paintings in, the lesson is that BRIGHTNESS never parted glove
 *  from parchment. On Mac's first two it could not: bronze up to luma
 *  148 against shaded parchment down to 130, and saturation no better
 *  (sheet 0.45-0.50, glove 0.50-0.68). Keying on it kept slabs of
 *  shadowed sheet and laid them over the ink. On this painting the
 *  sheet's middle is bright enough to cut, but its BURNT BORDER is not
 *  - so a luma cut kept the border instead, in a ragged halo round each
 *  thumb.
 *
 *  What parts them here is WARMTH, and then SHAPE, on four steps:
 *
 *  1. SEED on red-minus-blue under `chroma`. The sheet is parchment and
 *     warm everywhere, border included; the steel is not. Five pixels
 *     of 340,918 of sheet fall under this line - see HAND_CHROMA. An
 *     earlier draft of THIS sentence said none at all, which was the
 *     narrower sample, and is corrected at the constant itself.
 *  2. FLOOD from the zone's outer column - `side` names the one nearer
 *     that thumb's own hand. The thumb reaches in from there, so
 *     whatever the flood cannot reach is sheet and goes clear, however
 *     dark it is. This is what drops the sheet's own cracks and stains.
 *  3. CLOSE by `grow`, which bridges the warm lit bands inside the
 *     steel that step 1 would not claim - grow then shrink by the same,
 *     so a gap of at most twice `grow` is bridged while it is interior
 *     and the outline returns to where the paint put it - bar a zone's
 *     own edge, where it stays out (see THUMB_GROW).
 *     Growing alone does not answer it: it bridges nothing that reaches
 *     the silhouette and leaves a pale rim round the thumb.
 *  4. FILL what is enclosed, which takes the warm highlights left
 *     inside the blob. Without this the thumb's own shine comes out as
 *     pinholes of map showing through the glove.
 *
 *  Pure, in place, over one zone's RGBA bytes - the same shape as the
 *  other key, and pinned the same way. */
export function keyThumbPixels(data, w, h, side = 'left', chroma = HAND_CHROMA, grow = THUMB_GROW) {
  const n = w * h;
  if (n <= 0 || data.length < 4 * n) return data;
  const keep = new Uint8Array(n);
  const stack = [];
  // MAP-FIELD4: OFF THE PAINTING IS NOT GLOVE. A transparent pixel has
  // no colour to read - it comes back as red 0, blue 0, so a difference
  // of 0 - and without this the flood would run out through the clear
  // ground around the hand and call the whole zone thumb.
  const steel = (i) => {
    const j = i * 4;
    return data[j + 3] > 128 && data[j] - data[j + 2] < chroma;
  };
  // 2. the flood, seeded down the column nearest this thumb's own hand
  const col = side === 'right' ? w - 1 : 0;
  for (let y = 0; y < h; y++) { const i = (y * w) + col; if (steel(i)) { keep[i] = 1; stack.push(i); } }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i - x) / w;
    if (x > 0 && !keep[i - 1] && steel(i - 1)) { keep[i - 1] = 1; stack.push(i - 1); }
    if (x < w - 1 && !keep[i + 1] && steel(i + 1)) { keep[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && !keep[i - w] && steel(i - w)) { keep[i - w] = 1; stack.push(i - w); }
    if (y < h - 1 && !keep[i + w] && steel(i + w)) { keep[i + w] = 1; stack.push(i + w); }
  }
  // 3a. the CLOSE: grow by `grow` rings, then shrink by the same. A gap
  // narrower than twice `grow` is bridged by the growing and cannot be
  // reopened by the shrinking - it is interior by then - while the
  // silhouette itself comes back to where it was. Each ring is
  // collected in full BEFORE any of it is taken, so one pass moves the
  // edge by exactly one pixel and not by the width of the zone.
  for (let g = 0; g < grow; g++) {
    const ring = [];
    for (let i = 0; i < n; i++) {
      if (keep[i]) continue;
      const x = i % w, y = (i - x) / w;
      if ((x > 0 && keep[i - 1]) || (x < w - 1 && keep[i + 1])
        || (y > 0 && keep[i - w]) || (y < h - 1 && keep[i + w])) ring.push(i);
    }
    for (const i of ring) keep[i] = 1;
  }
  for (let g = 0; g < grow; g++) {
    const ring = [];
    for (let i = 0; i < n; i++) {
      if (!keep[i]) continue;
      const x = i % w, y = (i - x) / w;
      // off the zone counts as kept: the thumb runs on into the hand,
      // and eating its outer edge would peel the blob off that side
      if ((x > 0 && !keep[i - 1]) || (x < w - 1 && !keep[i + 1])
        || (y > 0 && !keep[i - w]) || (y < h - 1 && !keep[i + w])) ring.push(i);
    }
    for (const i of ring) keep[i] = 0;
  }
  // 3b. the fill: whatever the outside cannot reach is inside the thumb
  const open = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const i = (y * w) + x; if (!keep[i] && !open[i]) { open[i] = 1; stack.push(i); } }
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const i = (y * w) + x; if (!keep[i] && !open[i]) { open[i] = 1; stack.push(i); } }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i - x) / w;
    if (x > 0 && !keep[i - 1] && !open[i - 1]) { open[i - 1] = 1; stack.push(i - 1); }
    if (x < w - 1 && !keep[i + 1] && !open[i + 1]) { open[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && !keep[i - w] && !open[i - w]) { open[i - w] = 1; stack.push(i - w); }
    if (y < h - 1 && !keep[i + w] && !open[i + w]) { open[i + w] = 1; stack.push(i + w); }
  }
  for (let i = 0; i < n; i++) if (open[i]) data[i * 4 + 3] = 0;
  return data;
}
