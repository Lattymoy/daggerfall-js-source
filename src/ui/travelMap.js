// FAST TRAVEL, the window (F-slice). DFU's DaggerfallTravelMapWindow
// + DaggerfallTravelPopUp compressed into the port's keyed native
// idiom: a typeahead over the WHOLE map directory replaces the
// region-map click surface (the classic TRAV0I00 art window is a
// ledger residue row), and the popup's three toggle pairs ride
// single keys. The LAWS - time, cost, clamps - live in
// systems/travel.js; this window only collects the choices and
// shows the numbers, exactly the popup's split.
//
// Keys: type to search, Up/Down select, Enter -> options;
// options: c cautiously / r recklessly, i inns / t camp out,
// s ship toggle (routes with ocean), Enter travels (gold-gated),
// Escape back / close.

import { drawText, measureText } from './text.js';
import { calculateTravelTime, calculateTripCost, travelDays } from '../systems/travel.js';

const GOLD = [0.85, 0.72, 0.35, 1], WHITE = [0.9, 0.9, 0.85, 1], HOT = [1, 0.95, 0.6, 1], DIM = [0.5, 0.5, 0.45, 1];
// DFRegion.LocationTypes, the display names only.
const TYPE_NAMES = ['City', 'Hamlet', 'Village', 'Farm', 'Labyrinth', 'Temple', 'Tavern', 'Keep',
  'Manor', 'Cult', 'Ruin', 'Home', 'Graveyard', 'Coven'];

export class TravelMapWindow {
  /** index: [{ name, region, pixel:{x,y}, type }] - the host's map
   *  directory. deps: { getPlayerPixel, getClimateIndex, gold(),
   *  hasHorse, hasCart, hasShip, onTravel(pick, opts, computed) }. */
  constructor(index, deps) {
    this.index = index;
    this.deps = deps;
    this.search = '';
    this.matches = [];
    this.cursor = 0;
    this.mode = 'search';        // 'search' | 'options'
    this.pick = null;
    // DaggerfallTravelPopUp defaults: cautious, inns, no ship.
    this.speedCautious = true;
    this.sleepModeInn = true;
    this.travelShip = false;
    this.notice = null;
    this.done = false;
  }

  _refilter() {
    const q = this.search.trim().toLowerCase();
    // the classic find matches from the START of the name
    // (DaggerfallTravelMapWindow's find box), case-blind.
    this.matches = q.length < 2 ? []
      : this.index.filter((e) => e.name.toLowerCase().startsWith(q)).slice(0, 12);
    if (this.cursor >= this.matches.length) this.cursor = Math.max(0, this.matches.length - 1);
  }

  _compute() {
    const { getPlayerPixel, getClimateIndex, hasHorse = false, hasCart = false, hasShip = false } = this.deps;
    const t = calculateTravelTime(getPlayerPixel(), this.pick.pixel, {
      speedCautious: this.speedCautious, sleepModeInn: this.sleepModeInn,
      travelShip: this.travelShip, hasHorse, hasCart,
    }, getClimateIndex);
    const c = calculateTripCost(t.minutes, t.oceanPixels, {
      sleepModeInn: this.sleepModeInn, hasShip, travelShip: this.travelShip,
    });
    return { ...t, ...c };
  }

  input(action) {
    const ch = typeof action === 'string' && action.startsWith('char:') ? action.slice(5) : null;
    this.notice = null;
    if (this.mode === 'search') {
      if (ch != null) { this.search += ch; this._refilter(); }
      else if (action === 'backspace') { this.search = this.search.slice(0, -1); this._refilter(); }
      else if (action === 'up' && this.matches.length) this.cursor = (this.cursor + this.matches.length - 1) % this.matches.length;
      else if (action === 'down' && this.matches.length) this.cursor = (this.cursor + 1) % this.matches.length;
      else if (action === 'confirm' && this.matches[this.cursor]) { this.pick = this.matches[this.cursor]; this.mode = 'options'; }
      else if (action === 'back') this.done = true;
      return;
    }
    // options
    const c = ch?.toLowerCase();
    if (c === 'c') this.speedCautious = true;
    else if (c === 'r') this.speedCautious = false;
    else if (c === 'i') this.sleepModeInn = true;
    else if (c === 't') this.sleepModeInn = false;
    else if (c === 's') this.travelShip = !this.travelShip;
    else if (action === 'back') { this.mode = 'search'; this.pick = null; }
    else if (action === 'confirm') {
      const computed = this._compute();
      // enoughGoldCheck - one pool today; the pieces split waits on
      // letters of credit (systems/travel.js note).
      if ((this.deps.gold?.() ?? 0) < computed.totalCost) {
        this.notice = 'You do not have enough gold.';   // TEXT.RSC 454 pends a text source
        return;
      }
      this.deps.onTravel?.(this.pick, {
        speedCautious: this.speedCautious, sleepModeInn: this.sleepModeInn, travelShip: this.travelShip,
      }, computed);
      this.done = true;
    }
  }

  draw(renderer, canvas, font, s) {
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.04, 0.03, 0.02, 0.92]);
    const title = 'TRAVEL MAP';
    drawText(renderer, font, title, (canvas.width - measureText(font.fnt, title) * s) / 2, 16 * s, s, GOLD);
    if (this.mode === 'search') {
      drawText(renderer, font, `Destination: ${this.search}_`, 20 * s, 34 * s, s, WHITE);
      if (this.search.trim().length < 2) {
        drawText(renderer, font, '(type a location name - two letters or more)', 20 * s, 48 * s, s, DIM);
      } else if (!this.matches.length) {
        drawText(renderer, font, '(no places match)', 20 * s, 48 * s, s, DIM);
      }
      this.matches.forEach((e, i) => drawText(renderer, font,
        `${i === this.cursor ? '> ' : '  '}${e.name}  (${e.region}, ${TYPE_NAMES[e.type] ?? 'Place'})`,
        20 * s, (48 + i * 10) * s, s, i === this.cursor ? HOT : WHITE));
      drawText(renderer, font, 'ENTER choose   ESC close', 20 * s, canvas.height - 20 * s, s, DIM);
      return;
    }
    const t = this._compute();
    const lines = [
      [`To ${this.pick.name} (${this.pick.region})`, GOLD],
      [``, WHITE],
      [`Speed:  ${this.speedCautious ? 'Cautiously' : 'Recklessly'}   (c/r)`, WHITE],
      [`Sleep:  ${this.sleepModeInn ? 'Inns' : 'Camp Out'}   (i/t)`, WHITE],
      [`Ship:   ${this.travelShip ? 'Yes' : 'No'}   (s)${t.oceanPixels === 0 ? '  - no water on this route' : ''}`, WHITE],
      [``, WHITE],
      [`Time:  ${travelDays(t.minutes)} day${travelDays(t.minutes) === 1 ? '' : 's'}`, HOT],
      [`Cost:  ${t.totalCost} gold`, HOT],
    ];
    lines.forEach(([l, col], i) => drawText(renderer, font, l, 20 * s, (36 + i * 10) * s, s, col));
    if (this.notice) drawText(renderer, font, this.notice, 20 * s, canvas.height - 32 * s, s, HOT);
    drawText(renderer, font, 'ENTER travel   ESC back', 20 * s, canvas.height - 20 * s, s, DIM);
  }
}

/** The searchable directory off a loaded MapsFile: every exterior
 *  location's name, region, map pixel and type. */
export function buildTravelIndex(maps, longitudeLatitudeToMapPixel) {
  const out = [];
  for (let r = 0; r < maps.regionCount; r++) {
    const region = maps.getRegion(r);
    if (!region) continue;
    for (let l = 0; l < region.locationCount; l++) {
      const loc = maps.getLocation(r, l);
      if (!loc || !loc.exterior || !loc.exterior.exteriorData) continue;
      const td = loc.mapTableData;
      out.push({
        name: loc.name, region: region.name,
        pixel: longitudeLatitudeToMapPixel(td.longitude, td.latitude),
        type: td.locationType ?? 0,
        regionIndex: r, locationIndex: l,
      });
    }
  }
  return out;
}
