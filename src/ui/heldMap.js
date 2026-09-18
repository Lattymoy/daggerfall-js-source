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
// ═══════════════════════════════════════════════════════════════════

import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';
import { REGION_NAMES, longitudeLatitudeToMapPixel, getPixelFromPixelID, patchRegionIndex } from '../formats/mapsFile.js';
import { locationSummaryAt } from '../systems/mapDirectory.js';
import { calculateTravelTime, calculateTripCost, travelDays, walkTravelPath } from '../systems/travel.js';
import { guildFastTravel } from '../systems/guildVariants.js';   // TP1: GuildManager.FastTravel
import {
  travelMapFilters, travelMapPopUpState, setTravelMapPopUpState, travelMapSaveData,
  travelMapMarkedMapId, setTravelMapMarkedMapId,   // MAP2: the mod's mark outlives the window (AUDIT-TO1 G4)
} from '../systems/travelMapState.js';
// AUDIT-TO1 C1/C2/C3: the mod's laws on the DEFAULT skin, as the pure
// functions the popup itself calls, so the two skins cannot drift.
import { isPlayerControlledTravel, enforceShipRestriction, shipTravelRefusal, SHIP_REFUSAL_TEXT } from './travelPopUp.js';
// MAP2: the mod's map additions, through the SAME functions the classic
// window calls (ui/travelMapOptions.js), so the two skins cannot drift.
import { teleportCost, teleportCostPrompt, portsFilterAllows, locationInfoRows, resumePrompt } from './travelMapOptions.js';
import { hasPort } from '../systems/travelPorts.js';
import { TRAVEL_OPTIONS_TEXT as TO_TEXT, format as toFormat } from '../systems/travelOptionsText.js';
import { getDaggerfallDistance, MatchesCutOff } from '../systems/editDistance.js';
import { checkLocationDiscovered } from './travelMapWindow.js';
import {
  buildInkModel, buildInkMarks, paintInk, placeNames, zoomBand, clampView, scaleMinOf,
  viewCentredOn, zoomAt, toPaper, toMap, BAND_MARKS, PARTY_LABEL_STACK,
} from './inkMap.js';
// SOC6: the party's marks, read the one way both maps read them.
import {
  readPartyMarks, partyMarksKey, partyHoverText, partyLabelText,
  PARTY_MARK_CSS, PARTY_OFFLINE_CSS, PARTY_LEGEND_TEXT,
} from './partyMapMarks.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { bindings } from './input.js';
import { actionForCode } from '../systems/inputActions.js';

// ── THE SPRITE (Mac's, public/art/held-map.png) ──────────────────
export const HELD_MAP_URL = 'art/held-map.png';
/** Its own pixels, and the stage's aspect. */
export const SPRITE = Object.freeze({ w: 1448, h: 1086 });
/** The parchment's rectangle, as fractions of the sprite - measured
 *  off the painting (the sheet's outermost non-black column and row on
 *  each side, thumbs excluded). The ink canvas is laid exactly here. */
export const PAPER = Object.freeze({ x0: 0.123, x1: 0.870, y0: 0.138, y1: 0.755 });
/** Where the thumbs rest ON the sheet, as fractions of the sprite. In
 *  these two zones a sprite pixel darker than HAND_LUM is a gauntlet
 *  and is keyed back OVER the ink; anything lighter is paper and lets
 *  the ink through. Measured: the sheet's pixels sit at luminance
 *  144-192 (its creases 112-160), the thumbs almost wholly under 144. */
export const THUMB_ZONES = Object.freeze([
  Object.freeze({ x0: 0.10, x1: 0.29, y0: 0.42, y1: 0.76 }),
  Object.freeze({ x0: 0.71, x1: 0.90, y0: 0.42, y1: 0.76 }),
]);
export const HAND_LUM = 144;

// ── THE CLOCKS (skin) ────────────────────────────────────────────
const OPEN_S = 0.3;      // the sheet rises into view
const CLOSE_S = 0.3;     // ...and lowers on a commit or a close
// SOC6: how often the window ASKS the host for its party, in seconds -
// well under the eye's patience and well over the pose rate the hub
// relays at (net/wire.js PARTY_SEND_MS). The classic window polls at
// its own half second (ui/travelMapWindow.js PARTY_POLL_S); this sheet
// repaints cheaply, so it asks twice as often.
const PARTY_POLL_S = 0.25;
/** The scale a search or a journal click-through zooms to. */
const FOCUS_SCALE = 6;

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

    this._model = null;     // the ink model, minted on the first layout
    this._marksDirty = true;
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

    this._mountChrome();
    this._tornDown = false;
    this._probeFn = () => JSON.stringify({
      phase: this._phase,
      view: { ox: Math.round(this._view.ox * 10) / 10, oy: Math.round(this._view.oy * 10) / 10, scale: Math.round(this._view.scale * 100) / 100 },
      band: zoomBand(this._view.scale),
      paper: { w: Math.round(this._paper.w), h: Math.round(this._paper.h) },
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
    if (!this._ticked) {
      this._ticked = true;
      this._layout();
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
    this._t += dt;
    switch (this._phase) {
      case 'opening': {
        this._setOpacity(clamp(this._t / OPEN_S, 0, 1));
        if (this._t >= OPEN_S) { this._phase = 'map'; this._t = 0; this._renderCard(); }
        break;
      }
      case 'map': break;
      case 'closing': {
        this._setOpacity(clamp(1 - this._t / CLOSE_S, 0, 1));
        if (this._t >= CLOSE_S) {
          // THE COMMIT, with the sheet down: the hooks are read while
          // this window is still alive (the pack's lesson), and the
          // host's own travel runs from here.
          const c = this._commit;
          this._commit = null;
          if (c?.kind === 'travel') this.deps.onTravel?.(c.pick, c.opts, c.computed);
          else if (c?.kind === 'teleport') this.deps.onTeleport?.(c.pick);
          else if (c?.kind === 'coords') this.deps.onTravelToCoords?.(c.pick, c.opts);   // MAP2: a bare pixel, the mod's own journey
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
      this._dirty = true;
    }
    // the rings breathe, so the sheet is repainted while one is up
    if (this._selected || this._party.length) this._dirty = true;
    if (this._dirty) this._paint();
  }

  draw() { /* DOM only: the sheet is a canvas laid over the sprite, painted from tick(); nothing here touches the renderer */ }

  dispose() {
    this._dead = true;
    this._close();
  }

  /** Everything the window holds, released once - in close() rather
   *  than dispose() alone, because the guild-teleport mount lives in
   *  worldModes' interiorOverlay, whose drain drops a done window
   *  WITHOUT a dispose call. Torn down BEFORE done reads true. */
  _teardown() {
    if (this._tornDown) return;
    this._tornDown = true;
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
    this._commit = commit;
    this._panel = null;
    this._panelState = null;
    this._phase = 'closing';
    this._t = 0;
    this._renderCard();
  }

  _setOpacity(a) {
    if (this._chrome?.root) this._chrome.root.style.opacity = String(Math.round(a * 100) / 100);
  }

  // ── THE SHEET ──────────────────────────────────────────────────

  /** The stage is the sprite's 4:3, letterboxed into the viewport; the
   *  paper is PAPER of the stage; the canvas is the paper at device
   *  resolution. Re-run each tick and a no-op unless the viewport moved. */
  _layout() {
    const root = this._chrome?.root;
    if (!root) return;
    const vw = root.clientWidth || globalThis.innerWidth || 1024;
    const vh = root.clientHeight || globalThis.innerHeight || 768;
    const dpr = globalThis.devicePixelRatio || 1;
    const key = `${vw}x${vh}@${dpr}`;
    if (key === this._layoutKey) return;
    this._layoutKey = key;
    const sw = Math.min(vw, vh * SPRITE.w / SPRITE.h), sh = sw * SPRITE.h / SPRITE.w;
    const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
    const c = this._chrome;
    Object.assign(c.stage.style, { left: `${sx}px`, top: `${sy}px`, width: `${sw}px`, height: `${sh}px` });
    const pw = sw * (PAPER.x1 - PAPER.x0), ph = sh * (PAPER.y1 - PAPER.y0);
    Object.assign(c.ink.style, { left: `${sw * PAPER.x0}px`, top: `${sh * PAPER.y0}px`, width: `${pw}px`, height: `${ph}px` });
    c.ink.width = Math.max(1, Math.round(pw * dpr));
    c.ink.height = Math.max(1, Math.round(ph * dpr));
    const firstLayout = this._paper.w === 1;
    this._paper = { w: pw, h: ph, dpr };
    this._stage = { x: sx, y: sy, w: sw, h: sh };
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

  /** The ink model: chains once per data set (cached on the bytes and
   *  the network reference), marks whenever a filter or the discovery
   *  set moved. */
  _ensureModel() {
    const bytes = this.deps.woods?.heightMapBuffer;
    if (!bytes) return null;
    const net = this.deps.roads?.() ?? null;
    const maps = this.deps.maps;
    const regionCount = maps?.regionCount ?? 0;
    const regionAt = (x, y) => {
      const politic = maps?.getPoliticIndex?.(x, y) ?? -1;
      const r = politic - 128;
      return r >= 0 && r < regionCount ? r : -1;
    };
    let rec = _chainCache.get(bytes);
    if (!rec || rec.net !== net || rec.width !== this._size.width) {
      const m = buildInkModel({
        width: this._size.width, height: this._size.height, heightBytes: bytes,
        climateAt: (x, y) => this.deps.getClimateIndex?.(x, y) ?? -1,
        regionAt, regionCount, roads: net,
      });
      rec = { net, width: this._size.width, chains: m };
      _chainCache.set(bytes, rec);
      this._marksDirty = true;
    }
    if (this._model?.coast !== rec.chains.coast) this._model = { ...rec.chains, marks: [] };
    if (this._marksDirty) {
      this._marksDirty = false;
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
    const measure = (text, size) => { ctx.font = `${size}px 'Cormorant', Georgia, serif`; return ctx.measureText(text).width; };
    const names = placeNames(model.marks, this._view, band, { paperW: this._paper.w, paperH: this._paper.h, measure });
    const pulse = 0.5 + 0.5 * Math.sin(this._clock * 3);
    paintInk(ctx, model, this._view, {
      paperW: this._paper.w, paperH: this._paper.h, dpr: this._paper.dpr, band,
      filters: this.filters, names, regionNames: REGION_NAMES,
      player: this._player,
      selected: this._selected ? { x: this._selected.x, y: this._selected.y, coords: !!this._selected.coords } : null,
      // MAP2: the harbours while the mod restricts ships to ports, and the mark in the mod's colour
      ports: this._portsShown(),
      markedMapId: this.markedMapId,
      markColor: rgbaCss(this._to?.settings?.markLocationColor),
      party: this._party.map((m) => ({
        x: m.x, y: m.y, name: partyLabelText(m), online: m.online, stack: m.stack,
        // the colour is DATA, not a theme: online is the party green the
        // rest of the slice draws a member's name in, offline is that
        // green with the life out of it
        color: m.online ? PARTY_MARK_CSS : PARTY_OFFLINE_CSS,
      })),
      pulse,
    });
    this._chrome.band.textContent = band;
  }

  _setView(v) {
    this._view = clampView(v, this._limits());
    this._goal = { ...this._view };
    this._dirty = true;
  }
  _nudge(dx, dy) { this._setView({ ox: this._view.ox + dx, oy: this._view.oy + dy, scale: this._view.scale }); }
  _zoomBy(factor, px, py) { this._setView(zoomAt(this._view, factor, px, py)); }
  /** Glide to map pixel (x, y) at least this close. */
  _focusOn(x, y, scale = FOCUS_SCALE) {
    const s = Math.max(this._view.scale, scale);
    this._goal = clampView(viewCentredOn(x, y, s, this._limits()), this._limits());
    this._dirty = true;
  }

  /** Client coordinates to paper pixels. */
  _paperPoint(clientX, clientY) {
    const r = this._chrome.ink.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    return [clientX - r.left, clientY - r.top];
  }

  // ── SOC6: THE PARTY ON THE MAP ─────────────────────────────────

  /** The host's party, read and placed. Returns whether anything the
   *  player can see changed - the caller repaints on true and does
   *  nothing on false, which is the ordinary answer four times a second
   *  while nobody moves. Never dirties the location marks. */
  _refreshParty() {
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
    this._searchIndex = null;   // the find box's dictionary is gated by the same law
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

  /** The box over the sheet: the I/H box, or the resume prompt. */
  _renderBox() {
    const box = this._chrome?.box;
    if (!box) return;
    box.innerHTML = '';
    const open = !!this._info || this._top === 'resume';
    box.classList.toggle('open', open);
    box.style.display = open ? 'block' : 'none';
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
      // an empty purse.
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

  /** ONE JOURNEY for the card's bill: walkTravelPath priced once by
   *  calculateTravelTime. `byRoad` stays and stays false - the trip
   *  card reads it, and a journey by road is a thing this port does
   *  not have (bible/03-World/Roads.md). Memoised on the inputs,
   *  because the card re-renders on every toggle. */
  _journey(dest, opts) {
    const start = this.deps.getPlayerPixel();
    const key = `${start.x},${start.y}>${dest.x},${dest.y}|${JSON.stringify(opts)}`;
    if (this._journeyKey === key) return this._journeyVal;
    const j = {
      path: walkTravelPath(start, dest),
      byRoad: false,
      ...calculateTravelTime(start, dest, opts, this.deps.getClimateIndex),
    };
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
    const cost = calculateTripCost(minutes, time.oceanPixels, {
      sleepModeInn: st.opts.sleepModeInn, hasShip: st.hasShip, travelShip: st.opts.travelShip,
      // TravelTimeCalculator.cs:163 - the same Knightly Order consult
      // the native popup makes; the enhanced skin bills the same fare.
      freeTavernRooms: !!this.deps.freeTavernRooms?.(),
    });
    st.trip = { ...time, minutes, ...cost, days: travelDays(minutes) };
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
      minutes: st.trip.minutes, oceanPixels: st.trip.oceanPixels,
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
      // NO closes only the box - the map stays ARMED for another pick,
      // the teleport popup's own law
      this._closePanel();
      return;
    }
    // AUDIT-TO1 C3: Yes on the fee prompt DEDUCTS (:487-489) and goes.
    const fee = this._panelState?.fee ?? null;
    if (fee && fee.canPay && !fee.paid) { fee.paid = true; this.deps.payTeleport?.(fee.cost); }
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
    const matches = distance.findBestMatches(name, 1000);
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
    root.style.opacity = '0';

    // the stage: the sprite, the ink canvas over its paper, the hands
    // keyed back over the ink
    const stage = el('div', 'hmstage');
    const sprite = el('img', 'hmsprite');
    sprite.alt = '';
    sprite.draggable = false;
    sprite.src = HELD_MAP_URL;
    const ink = el('canvas', 'hmink');
    const hands = el('canvas', 'hmhands');
    stage.append(sprite, ink, hands);
    sprite.onload = () => this._keyHands(sprite, hands);

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
    this._chrome = { root, stage, sprite, ink, hands, label, search, searchInput, results, close, card, hint, band, legend, ports, box };
    this._renderPorts();
    this._refreshParty();   // SOC6: the marks stand with the window, not a quarter second after it

    // MAP2 (:449): the info box is ClickAnywhereToClose - a pointer down
    // ANYWHERE closes it and goes no further, ahead of the stage's own
    // handlers (capture), so the click neither pans nor picks
    root.addEventListener('pointerdown', (e) => {
      if (!this._info) return;
      e.stopPropagation?.();
      this._closeInfo();
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

    // pointer: pan, zoom to cursor, pick - on the stage, which is the
    // sprite and the sheet together
    let downAt = null, panned = false;
    stage.addEventListener('pointerdown', (e) => {
      if (this._phase !== 'map') return;
      if (this._top) return;   // the resume prompt holds the sheet
      // MAP2 (:532-550): the MIDDLE button marks the place under the cursor
      if (e.button === 1) { e.preventDefault?.(); this._markLocationHandler(...this._paperPoint(e.clientX, e.clientY)); return; }
      // ONE finger pans; a second is ignored rather than adopted
      if (downAt) return;
      downAt = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: this._view.ox, oy: this._view.oy };
      panned = false;
      stage.setPointerCapture?.(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
      if (downAt && e.pointerId !== downAt.id) return;
      if (this._phase !== 'map') return;
      if (downAt) {
        const dx = e.clientX - downAt.x, dy = e.clientY - downAt.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) panned = true;
        this._setView({ ox: downAt.ox - dx / this._view.scale, oy: downAt.oy - dy / this._view.scale, scale: this._view.scale });
      } else {
        this._hoverLabel(...this._paperPoint(e.clientX, e.clientY));
      }
    });
    stage.addEventListener('pointerup', (e) => {
      if (downAt && e.pointerId !== downAt.id) return;
      if (this._phase !== 'map') { downAt = null; return; }
      if (downAt && !panned) this._pickAt(...this._paperPoint(e.clientX, e.clientY));
      downAt = null;
    });
    stage.addEventListener('pointercancel', (e) => {
      if (downAt && e.pointerId !== downAt.id) return;
      downAt = null;
    });
    stage.addEventListener('wheel', (e) => {
      if (this._phase !== 'map') return;
      e.preventDefault();
      // zoom toward the cursor: the map point under it stays still
      const [px, py] = this._paperPoint(e.clientX, e.clientY);
      this._zoomBy(Math.exp(-e.deltaY * 0.0012), px, py);
    }, { passive: false });

    // mouselook's lock never survives a map - the wizard's law
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* no lock to drop */ }
  }

  _unmountChrome() {
    this._chrome?.root?.remove();
    this._chrome = null;
  }

  /** The thumbs, keyed back over the ink: the sprite's pixels inside
   *  THUMB_ZONES darker than HAND_LUM are copied onto the hands canvas,
   *  everything else left clear. Runs once, when the sprite has
   *  loaded; a document with no 2D context (node) skips it. */
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
        keyHandPixels(img.data);
        hctx.putImageData(img, x0, y0);
      }
    } catch (e) {
      console.warn('[heldmap] the hands would not key', e);
    }
  }

  _hoverLabel(sx, sy) {
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
    const m = this._markerAt(sx, sy);
    if (m) { this._select(m); return; }
    // MAP2 (:1375): a bare pixel opens the coordinates decision when the
    // mod allows it - the classic page's own click, on the sheet
    if (this._coordsAllowedHere()) {
      const [mx, my] = toMap(this._view, sx, sy);
      const px = Math.floor(mx), py = Math.floor(my);
      if (px >= 0 && py >= 0 && px < this._size.width && py < this._size.height) {
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
    if (!this._selected || this._phase !== 'map') return;
    const { summary } = this._selected;
    card.append(el('h3', 'hmname', this._selected.name || 'Unknown place'));
    card.append(el('p', 'hmmeta', this._selected.coords
      ? this._regionNameAt(Math.floor(this._selected.x), Math.floor(this._selected.y))
      : (REGION_NAMES[summary.regionIndex] ?? '')));

    if (this._panel === 'teleport') {
      const fee = this._panelState?.fee ?? null;
      // AUDIT-TO1 C3: the fee first. No purse for it: the mod's
      // notEnoughGold box, and the map closes (:497-500).
      if (fee && !fee.canPay) {
        card.append(el('p', 'hmprompt', 'You do not have enough gold.'));
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
        } else {
          add('Journey', `${t.days} ${t.days === 1 ? 'day' : 'days'}`);
          add('Cost', `${t.totalCost} gold`);
          // the label shows COINS, never the letters-of-credit total -
          // the popup's own reading
          add('Purse', `${this.deps.goldPieces?.() ?? 0} gold`);
        }
        card.append(dl);
      }
      if (st.notice) card.append(el('p', 'hmnotice', st.notice));
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
    const travel = el('button', 'act', 'Travel here');
    travel.onclick = () => this._openPanel('travel');
    row.append(travel);
    card.append(row);
  }
}

/** MAP2: a mod colour ([r, g, b, a] bytes, modSettings colorKeyRgba) as
 *  a CSS colour for the pen; null when the setting is absent. */
export function rgbaCss(rgba) {
  if (!Array.isArray(rgba) || rgba.length < 3) return null;
  const a = rgba.length > 3 ? rgba[3] / 255 : 1;
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${Math.round(a * 1000) / 1000})`;
}

/** The key, on RGBA bytes in place: a pixel at or above HAND_LUM is
 *  paper and goes clear; a darker one is gauntlet and stays. Pure, so
 *  the threshold is pinned without a canvas. */
export function keyHandPixels(data, lum = HAND_LUM) {
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (l >= lum) data[i + 3] = 0;
  }
  return data;
}
