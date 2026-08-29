// ═══════════════════════════════════════════════════════════════════
// U61 — THE OVERWORLD: the enhanced travel map is the world itself.
//
// Press the travel key outside and the view climbs through cloud;
// above the deck is the whole Iliac Bay as a live relief - the same
// WOODS.WLD bytes the streamed terrain is sampled from, the same
// CLIMATE.PAK bytes the travel calculator charges. Pan, zoom, search,
// pick a destination, choose how you travel, and the camera FLIES the
// route - the exact pixel walk the time law charges - then drops back
// through cloud into first person at the far end. The clouds are
// load-bearing: they hide both LOD swaps (live streamed world below,
// one-vertex-per-pixel relief above), which is why the ascent and
// descent draw a veil over the HOST's still-live frame instead of
// pretending to render 800km of streamed terrain.
//
// ── WHAT THIS WINDOW IS TO THE HOST ──────────────────────────────
//
// A townTalk-slot overlay, the classic map's own mount: isChoiceWindow
// (raw key codes), tick/draw per frame, done when finished. Its draw()
// opens a SECOND beginFrame with its own camera - the automap's
// precedent - and the relief pass is a self-contained renderer class
// that restores every piece of state it touches. The DOM chrome layer
// (labels, search, filters, the decision panel) is TRANSPARENT, so
// this screen deliberately breaks the enhanced peer rule of an opaque
// #0e1013 div: the picture IS the GL frame beneath. The chrome owns
// the pointer at full resolution, so the host's native-coord
// click/hover/wheel arms are no-ops BY DESIGN.
//
// ── WHAT IS LAW HERE ─────────────────────────────────────────────
//
// Every number the player commits to is the classic module's own:
// calculateTravelTime / calculateTripCost / travelDays over
// walkTravelPath; the two-sided gold gate (letters of credit cannot
// pay the inn); the disease box BEFORE the gold check; transports
// snapshot at panel open; toggles round-tripping through
// travelMapPopUpState so the save envelope never changes shape; the
// live travelMapFilters() object edited in place; discovery through
// checkLocationDiscovered and buckets through getPixelColorIndex;
// gotoPlace and teleport as one-shots; teleport = arrival WITHOUT the
// journey, so it gets the veil and NO flight; and the pick handed to
// onTravel is {pixel, name, region, mapId, regionIndex,
// locationIndex} - fastTravelTo's own shape. The flight is seconds of
// real time; the CLOCK advances by computed.minutes inside
// fastTravelTo, exactly as it always has.
//
// RECORDED DEPARTURES (the skin, not the law): the whole bay replaces
// the province/FMAP page flow, so the page arrows, right-click zoom
// crop, identify flash, MBRD border and the dots-outline setting have
// no meaning here; search is bay-wide (the discovery gate and the
// weighted-edit-distance ranking are the classic find box's own, run
// per region); the climate/dot palettes are ours (no data color table
// exists in DFU - the classic terrain is baked art); notices use
// literal strings where the classic popups read TEXT.RSC 454/1010;
// vertical relief is exaggerated by one documented constant.
// ═══════════════════════════════════════════════════════════════════

import { perspective, lookAt, mirrorProjectionX } from '../world/mat4.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../formats/woodsFile.js';
import { REGION_NAMES, longitudeLatitudeToMapPixel, getPixelFromPixelID, patchRegionIndex } from '../formats/mapsFile.js';
import { locationSummaryAt } from '../systems/mapDirectory.js';
import { calculateTravelTime, calculateTripCost, travelDays, walkTravelPath } from '../systems/travel.js';
import { travelMapFilters, travelMapPopUpState, setTravelMapPopUpState, travelMapSaveData } from '../systems/travelMapState.js';
import { getDaggerfallDistance, MatchesCutOff } from '../systems/editDistance.js';
import { checkLocationDiscovered } from './travelMapWindow.js';
import {
  buildOverworldGrid, buildMarkerModel, routePoints, overworldHeight,
  OVERWORLD_DOT_COLORS, OVERWORLD_DOT_SIZES,
} from './overworldModel.js';
import { OverworldRenderer } from '../render/overworldRenderer.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { bindings } from './input.js';
import { actionForCode } from '../systems/inputActions.js';

// ── THE CAMERA'S SHAPE (skin) ────────────────────────────────────
const FOV_Y = 50 * Math.PI / 180;
const PITCH = 57 * Math.PI / 180;     // down-tilt from horizontal; north stays up
const DIST_START = 30;                // where the rise begins, over the player
const DIST_REST = 175;                // the map at rest
const DIST_CRUISE = 115;              // the flight's altitude
const DIST_MIN = 15, DIST_MAX = 1500;
const CLOUD_LIFT = 26;                // deck height over the sea, scene units
const CLOUD_REST_ALPHA = 0.2;         // the thin drifting deck at rest
// ── THE PHASES' CLOCKS (skin) ────────────────────────────────────
const VEIL_IN = 0.55, RISE = 1.8, RISE_VEIL_OUT = 0.9;
const DESCEND = 0.8, HOLD_AFTER_COMMIT = 1.6, VEIL_OUT = 1.0;
const SKIP_HOLD = 0.35;               // hold to skip, Mac's call
const FLIGHT_MIN = 2.2, FLIGHT_MAX = 6.5;
const VEIL_RGB = [0.855, 0.878, 0.914];

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

// The relief is built once per WOODS buffer and kept - the world map
// does not change shape between opens.
const _gridCache = new WeakMap();

export class OverworldMapWindow {
  /** deps: the classic map's own bag - maps, mapDict, getPlayerPixel,
   *  getClimateIndex, gold, goldPieces, hasHorse, hasCart, hasShip,
   *  diseaseCount, poisonCount, onTravel, onTeleport, onClose - plus
   *  `woods` (the loaded WoodsFile; only heightMapBuffer is read) and
   *  optional `mapSize` {width, height} so the probe can stand up a
   *  small synthetic bay. `pick` (the disease-text RNG) is unused
   *  here - the notice is a literal string, recorded above. */
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
    this._cam = { tx: p.x + 0.5, tz: -(p.y + 0.5), dist: DIST_START };
    this._camGoal = { tx: this._cam.tx, tz: this._cam.tz, dist: DIST_REST };

    this._phase = 'veilin';
    this._t = 0;
    this._clock = 0;
    this._veil = 0;
    this._cameraLive = false;
    this._flight = null;    // { pts:[{x,z,y}...], dur, t }
    this._commit = null;    // { kind, pick, opts, computed }
    this._skipHold = 0;

    this._ov = null;        // OverworldRenderer, minted on first draw
    this._grid = null;
    this._markers = [];
    this._markersDirty = true;
    this._selected = null;  // { summary, name, x, z, y }
    this._panel = null;     // 'travel' | 'teleport' | null
    this._panelState = null;
    this._searchIndex = null;
    this._dead = false;

    this._mountChrome();
    this._tornDown = false;
    this._probeFn = () => JSON.stringify({
      phase: this._phase, veil: Math.round(this._veil * 100) / 100,
      cam: { tx: Math.round(this._cam.tx), tz: Math.round(this._cam.tz), dist: Math.round(this._cam.dist) },
      markers: this._markers.length,
      selected: this._selected?.name ?? null,
      panel: this._panel,
      armed: this.teleportationTravel,
      filters: { ...this.filters },
      trip: this._panelState?.trip ?? null,
      notice: this._panelState?.notice ?? null,
      save: this.getTravelMapSaveData(),
    });
    globalThis.__overworld = this._probeFn;
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
    if (code === 'Escape' || actionForCode(bindings(), code) === 'TravelMap') {
      e?.preventDefault?.();
      if (this._phase !== 'map') return;      // mid-transition: hold-to-skip is the only out
      // the diseased box steps back to the PANEL, not out of it - the
      // classic popup's No arm (the review caught Escape eating the
      // whole panel)
      if (this._panelState?.confirm) { this._confirmDiseased(false); return; }
      if (this._panel) { this._closePanel(); return; }
      if (this._selected) { this._select(null); return; }
      this._close();
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
    if (this._panel === 'travel' && this._panelState) {
      // The classic popup's own hotkeys: S/T/N toggle their pair.
      if (code === 'KeyS') { this._toggleOpt('speedCautious'); return; }
      if (code === 'KeyT') { this._toggleOpt('travelShip'); return; }
      if (code === 'KeyN') { this._toggleOpt('sleepModeInn'); return; }
      if (code === 'KeyB') { this._begin(); return; }
    }
  }

  click() { /* the chrome div owns the pointer at full resolution; native-coord clicks never happen */ }
  hover() { /* the chrome div owns the pointer; see click */ }
  wheel() { /* the chrome div owns the wheel - zoom needs the cursor position anyway */ }

  tick(dt) {
    if (this.done) return;   // a torn-down window has no chrome to drive
    this._clock += dt;
    if (!this._ticked) {
      this._ticked = true;
      if (this._gotoPlace) { this._consumeGotoPlace(); this._gotoPlace = null; }
    }
    this._t += dt;
    switch (this._phase) {
      case 'veilin': {
        this._veil = clamp(this._t / VEIL_IN, 0, 1);
        if (this._t >= VEIL_IN) { this._cameraLive = true; this._phase = 'rise'; this._t = 0; }
        break;
      }
      case 'rise': {
        const s = easeInOut(clamp(this._t / RISE, 0, 1));
        this._cam.dist = DIST_START + (this._camGoal.dist - DIST_START) * s;
        this._cam.tx += (this._camGoal.tx - this._cam.tx) * Math.min(1, dt * 3);
        this._cam.tz += (this._camGoal.tz - this._cam.tz) * Math.min(1, dt * 3);
        this._veil = clamp(1 - this._t / RISE_VEIL_OUT, 0, 1);
        if (this._t >= RISE) {
          this._phase = 'map'; this._t = 0; this._veil = 0;
          // a gotoPlace consumed during the veil selected and opened
          // its panel while _renderCard was phase-gated shut - the
          // review caught the card never appearing. Render on entry.
          this._renderCard();
        }
        break;
      }
      case 'map': {
        this._veil = 0;
        this._cam.tx += (this._camGoal.tx - this._cam.tx) * Math.min(1, dt * 6);
        this._cam.tz += (this._camGoal.tz - this._cam.tz) * Math.min(1, dt * 6);
        this._cam.dist += (this._camGoal.dist - this._cam.dist) * Math.min(1, dt * 6);
        break;
      }
      case 'flight': {
        const f = this._flight;
        f.t += dt;
        if (this._skipHold > 0) {
          this._skipHold += dt;
          if (this._skipHold >= SKIP_HOLD) f.t = f.dur;   // hold to skip
        }
        const s = easeInOut(clamp(f.t / f.dur, 0, 1));
        const i = s * (f.pts.length - 1);
        const a = f.pts[Math.floor(i)], b = f.pts[Math.min(f.pts.length - 1, Math.ceil(i))];
        const fr = i - Math.floor(i);
        this._cam.tx = a.x + (b.x - a.x) * fr;
        this._cam.tz = a.z + (b.z - a.z) * fr;
        const lift = Math.min(1, f.t / (f.dur * 0.25), (f.dur - f.t) / (f.dur * 0.3));
        this._cam.dist += ((DIST_CRUISE + (1 - clamp(lift, 0, 1)) * -30) - this._cam.dist) * Math.min(1, dt * 2.5);
        this._chrome.skip.classList.toggle('on', true);
        if (f.t >= f.dur) { this._phase = 'descend'; this._t = 0; this._chrome.skip.classList.remove('on'); }
        break;
      }
      case 'descend': {
        this._veil = clamp(this._t / DESCEND, 0, 1);
        this._cam.dist += (DIST_START - this._cam.dist) * Math.min(1, dt * 2);
        if (this._t >= DESCEND) {
          // THE COMMIT, at full white: the hooks are read while this
          // window is still alive (the pack's lesson), and the host's
          // streamer rebuilds at the destination under the veil.
          this._cameraLive = false;
          const c = this._commit;
          this._commit = null;
          this._phase = 'hold';
          this._t = 0;
          if (c?.kind === 'travel') this.deps.onTravel?.(c.pick, c.opts, c.computed);
          else if (c?.kind === 'teleport') this.deps.onTeleport?.(c.pick);
        }
        break;
      }
      case 'hold': {
        this._veil = 1;
        if (this._t >= HOLD_AFTER_COMMIT) { this._phase = 'veilout'; this._t = 0; }
        break;
      }
      case 'veilout': {
        this._veil = clamp(1 - this._t / VEIL_OUT, 0, 1);
        if (this._t >= VEIL_OUT) this._close();
        break;
      }
      default: break;
    }
  }

  draw(renderer, canvas) {
    if (this._dead || this.done) return;
    try {
      if (this._cameraLive) {
        this._ensureScene(renderer);
        const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
        const aspect = w / Math.max(1, h);
        // THE MIRROR RIDES HERE, like every world pass. The relief
        // keeps the streamed world's axis labels (east +x, north +z,
        // up +y) and that triple is LEFT-handed - east x up = south -
        // which is exactly the frame mat4's HANDEDNESS LAW mirrors at
        // the projection. The review's verifiers proved the "our data
        // is right-handed" first draft numerically wrong: without the
        // mirror the bay drew east-west FLIPPED and _groundAt fought
        // the picture. Winding flips with it; the pass brackets
        // CULL_FACE off itself, so nothing else moves.
        const proj = mirrorProjectionX(perspective(FOV_Y, aspect, 0.5, 6000));
        const eye = this._eye();
        const view = lookAt(eye, [this._cam.tx, this._groundY(), this._cam.tz], [0, 1, 0]);
        renderer.beginFrame(proj, view, [0, 1, 0]);
        this._ov.draw(proj, view, {
          time: this._clock,
          cloudY: overworldHeight(0) + CLOUD_LIFT,
          cloudAlpha: this._cloudAlpha(),
          markerScale: clamp(220 / this._cam.dist, 0.35, 2.4),
          rings: this._rings(),
        });
        this._proj = proj; this._view = view; this._vw = w; this._vh = h;
      }
      if (this._veil > 0.001) {
        renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined,
          [VEIL_RGB[0], VEIL_RGB[1], VEIL_RGB[2], Math.min(1, this._veil)]);
      }
    } catch (e) {
      // never trap the motor: a relief that cannot stand up costs the
      // map, not the game
      console.warn('[overworld] the relief would not draw', e);
      this._close();
    }
  }

  dispose() {
    this._dead = true;
    this._close();
  }

  /** Everything the window holds, released once. In close() rather
   *  than dispose() alone because the guild-teleport mount lives in
   *  worldModes' interiorOverlay, whose drain drops a done window
   *  WITHOUT a dispose call - the review caught the chrome outliving
   *  a key-closed teleport map, dead controls floating over the guild
   *  hall. Torn down BEFORE done reads true, the done-after-DOM-down
   *  ordering every door keeps. */
  _teardown() {
    if (this._tornDown) return;
    this._tornDown = true;
    this._ov?.dispose();
    this._ov = null;
    this._unmountChrome();
    // ownership-checked: a second window minted after this one owns
    // the surface now, and an unconditional delete would blind it
    if (globalThis.__overworld === this._probeFn) delete globalThis.__overworld;
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

  // ── THE SCENE ──────────────────────────────────────────────────

  _ensureScene(renderer) {
    if (!this._ov) {
      this._ov = new OverworldRenderer(renderer.gl);
      const bytes = this.deps.woods?.heightMapBuffer;
      if (!bytes) throw new Error('no heightmap');
      let grid = _gridCache.get(bytes);
      if (!grid) {
        grid = buildOverworldGrid({
          heightBytes: bytes,
          width: this._size.width,
          height: this._size.height,
          climateAt: (x, y) => this.deps.getClimateIndex?.(x, y) ?? -1,
        });
        _gridCache.set(bytes, grid);
      }
      this._grid = grid;
      this._ov.setTerrain(grid);

    }
    if (this._markersDirty) {
      this._markersDirty = false;
      this._markers = buildMarkerModel(this.deps.mapDict?.values() ?? [], this.filters);
      const n = this._markers.length;
      const positions = new Float32Array(n * 3);
      const colors = new Uint8Array(n * 3);
      const sizes = new Float32Array(n);
      this._markers.forEach((m, i) => {
        m.y = this._heightAt(m.x, m.z) + 0.3;
        positions[i * 3] = m.x; positions[i * 3 + 1] = m.y; positions[i * 3 + 2] = m.z;
        const c = OVERWORLD_DOT_COLORS[m.colorIndex];
        colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
        sizes[i] = OVERWORLD_DOT_SIZES[m.colorIndex];
      });
      this._ov.setMarkers({ positions, colors, sizes });
    }
  }

  _heightAt(x, z) {
    const { width, height } = this._size;
    const px = clamp(Math.floor(x), 0, width - 1);
    const py = clamp(Math.floor(-z), 0, height - 1);
    return overworldHeight(this.deps.woods?.heightMapBuffer?.[py * width + px] ?? 0);
  }

  _groundY() { return this._heightAt(this._cam.tx, this._cam.tz); }

  _eye() {
    const gy = this._groundY();
    return [
      this._cam.tx,
      gy + Math.sin(PITCH) * this._cam.dist,
      this._cam.tz - Math.cos(PITCH) * this._cam.dist,
    ];
  }

  _cloudAlpha() {
    if (this._phase === 'veilin' || this._phase === 'rise' || this._phase === 'descend') return 0.9;
    // the resting deck thins as you dive toward the ground
    return CLOUD_REST_ALPHA * clamp((this._cam.dist - 40) / 80, 0, 1);
  }

  _rings() {
    const rings = [];
    const py = this._heightAt(this._player.x + 0.5, -(this._player.y + 0.5)) + 0.3;
    const pulse = 0.5 + 0.5 * Math.sin(this._clock * 3);
    rings.push({
      center: [this._player.x + 0.5, py, -(this._player.y + 0.5)],
      size: 22 + pulse * 4, color: [1, 1, 1, 0.9], thickness: 0.4,
    });
    if (this._selected) {
      rings.push({
        center: [this._selected.x, this._selected.y, this._selected.z],
        size: 26 + pulse * 6, color: [1, 0.86, 0.45, 0.95], thickness: 0.42,
      });
    }
    return rings;
  }

  /** Screen position of a scene point, or null behind the camera. */
  _project(x, y, z) {
    if (!this._proj || !this._view) return null;
    const v = this._view, pr = this._proj;
    const vx = v[0] * x + v[4] * y + v[8] * z + v[12];
    const vy = v[1] * x + v[5] * y + v[9] * z + v[13];
    const vz = v[2] * x + v[6] * y + v[10] * z + v[14];
    const cw = pr[3] * vx + pr[7] * vy + pr[11] * vz + pr[15];
    if (cw <= 0.0001) return null;
    const cx = pr[0] * vx + pr[4] * vy + pr[8] * vz + pr[12];
    const cy = pr[1] * vx + pr[5] * vy + pr[9] * vz + pr[13];
    return [(cx / cw * 0.5 + 0.5) * this._vw, (1 - (cy / cw * 0.5 + 0.5)) * this._vh];
  }

  /** The cursor's map pixel, by ray against the sea plane - close
   *  enough for a region label and the zoom-to-cursor anchor. */
  _groundAt(sx, sy) {
    if (!this._vw || !this._vh) return null;
    const eye = this._eye();
    const cy = Math.cos(PITCH), sp = Math.sin(PITCH);
    // camera basis: forward pitched down toward +z (north), right = +x
    const fwd = [0, -sp, cy];
    const right = [1, 0, 0];
    const up = [0, cy, sp];
    const tan = Math.tan(FOV_Y / 2);
    const ndcX = (sx / this._vw) * 2 - 1;
    const ndcY = 1 - (sy / this._vh) * 2;
    const aspect = this._vw / this._vh;
    const dir = [
      fwd[0] + right[0] * ndcX * tan * aspect + up[0] * ndcY * tan,
      fwd[1] + right[1] * ndcX * tan * aspect + up[1] * ndcY * tan,
      fwd[2] + right[2] * ndcX * tan * aspect + up[2] * ndcY * tan,
    ];
    if (dir[1] >= -0.0001) return null;
    const t = (overworldHeight(0) - eye[1]) / dir[1];
    return { x: eye[0] + dir[0] * t, z: eye[2] + dir[2] * t };
  }

  // ── SELECTION, TRAVEL, TELEPORT ────────────────────────────────

  _summaryName(summary) {
    const region = this.deps.maps?.getRegion?.(summary.regionIndex);
    return region?.mapNames?.[summary.mapIndex] ?? '';
  }

  /** The classic wrapper's own pick shape, verbatim. */
  _pickOf(selected) {
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

  _select(marker) {
    this._closePanel();
    if (!marker) { this._selected = null; this._renderCard(); return; }
    this._selected = { ...marker, name: this._summaryName(marker.summary) };
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
      };
      this._refreshTrip();
    } else {
      this._panelState = { opts: null, trip: null, confirm: false, notice: null };
    }
    this._renderCard();
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

  /** ONE JOURNEY, THREE CONSUMERS: the card's bill, the drawn route
   *  line and the camera flight. R4W's promise, and it outlives the
   *  road system that prompted it - before it, the card called
   *  calculateTravelTime over walkTravelPath and the flight called
   *  walkTravelPath AGAIN, two computations that agreed only by
   *  coincidence. One walk, priced once, drawn and flown.
   *
   *  This is verbatim what planJourney answered with no network, which
   *  is the only arm left now that roads are gone:
   *  `{ path: walkTravelPath(...), byRoad: false, ...calculate(...) }`.
   *  byRoad stays and stays false - the trip card reads it, and a
   *  journey by road is a thing this port no longer has.
   *
   *  Memoised on the journey's inputs, because the card re-renders on
   *  every toggle. */
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
    const dest = getPixelFromPixelID(this._selected.summary.id);
    const time = this._journey(dest, {
      speedCautious: st.opts.speedCautious,
      sleepModeInn: st.opts.sleepModeInn,
      travelShip: st.opts.travelShip,
      hasHorse: st.hasHorse, hasCart: st.hasCart,
    });
    const cost = calculateTripCost(time.minutes, time.oceanPixels, {
      sleepModeInn: st.opts.sleepModeInn, hasShip: st.hasShip, travelShip: st.opts.travelShip,
    });
    st.trip = { ...time, ...cost, days: travelDays(time.minutes) };
    st.notice = null;
    this._renderCard();
  }

  _toggleOpt(key) {
    const st = this._panelState;
    if (!st?.opts) return;
    st.opts[key] = !st.opts[key];
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
    const total = this.deps.gold?.() ?? 0;
    const pieces = this.deps.goldPieces?.() ?? total;
    if (total < st.trip.totalCost || pieces < st.trip.piecesCost) {
      st.notice = 'You do not have enough gold. Taverns only accept gold pieces.';
      this._renderCard();
      return;
    }
    const opts = {
      speedCautious: st.opts.speedCautious,
      sleepModeInn: st.opts.sleepModeInn,
      travelShip: st.opts.travelShip,
    };
    const computed = {
      minutes: st.trip.minutes, oceanPixels: st.trip.oceanPixels,
      piecesCost: st.trip.piecesCost, totalCost: st.trip.totalCost,
    };
    this._commit = { kind: 'travel', pick: this._pickOf(this._selected), opts, computed };
    this._rememberPanel();
    this._panel = null;
    this._panelState = null;
    this._beginFlight();
  }

  _confirmTeleport(yes) {
    if (!yes) {
      // NO closes only the box - the map stays ARMED for another pick,
      // the teleport popup's own law
      this._closePanel();
      return;
    }
    this._commit = { kind: 'teleport', pick: this._pickOf(this._selected) };
    this._panel = null;
    this._panelState = null;
    // teleportation skips the journey, so it skips the flight too:
    // straight down through the cloud
    this._phase = 'descend';
    this._t = 0;
    this._renderCard();
  }

  _beginFlight() {
    const start = this.deps.getPlayerPixel();
    const dest = getPixelFromPixelID(this._selected.summary.id);
    // R4W: the SAME journey the card billed, not a second walk.
    const st = this._panelState;
    const path = this._journey(dest, {
      speedCautious: st?.opts?.speedCautious,
      sleepModeInn: st?.opts?.sleepModeInn,
      travelShip: st?.opts?.travelShip,
      hasHorse: st?.hasHorse, hasCart: st?.hasCart,
    }).path;
    const bytes = this.deps.woods?.heightMapBuffer;
    const ptsF32 = routePoints(start, path, {
      heightBytes: bytes, width: this._size.width, height: this._size.height,
    });
    this._ov?.setRoute(ptsF32);
    const pts = [];
    for (let i = 0; i < ptsF32.length; i += 3) {
      pts.push({ x: ptsF32[i], y: ptsF32[i + 1], z: ptsF32[i + 2] });
    }
    this._flight = {
      pts, t: 0,
      dur: clamp(1.2 + path.length / 90, FLIGHT_MIN, FLIGHT_MAX),
    };
    this._skipHold = 0;
    this._phase = 'flight';
    this._t = 0;
    this._renderCard();
  }

  /** The journal's click-through: patch the legacy region index (both
   *  sides of the seam do), resolve the place by name, select it and
   *  put the decision on screen - the enhanced reading of "open the
   *  region, find the location, pop the confirm". */
  _consumeGotoPlace() {
    const site = this._gotoPlace?.siteDetails ?? this._gotoPlace ?? {};
    patchRegionIndex(site.regionIndex ?? -1, site.regionName ?? '');
    const region = this.deps.maps?.getRegionByName?.(site.regionName ?? '');
    const index = region?.mapNameLookup?.get(site.locationName ?? '');
    if (index == null) return;
    const row = region.mapTable[index];
    const pos = longitudeLatitudeToMapPixel(row.longitude, row.latitude);
    const summary = locationSummaryAt(this.deps.mapDict, pos.x, pos.y);
    if (!summary || !checkLocationDiscovered(summary)) return;
    const marker = { x: pos.x + 0.5, z: -(pos.y + 0.5), y: 0, colorIndex: 0, summary };
    marker.y = this._heightAt(marker.x, marker.z) + 0.3;
    this._camGoal.tx = marker.x; this._camGoal.tz = marker.z;
    this._select(marker);
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
        if (!checkLocationDiscovered(entry.summary)) continue;
        if (cutoff === null) cutoff = new MatchesCutOff(match.relevance);
        else if (!cutoff.keep(match.relevance)) return out;
        out.push(entry);
        if (out.length >= max) return out;
      }
    }
    return out;
  }

  _searchPick(entry) {
    const marker = {
      x: entry.pos.x + 0.5, z: -(entry.pos.y + 0.5), y: 0,
      colorIndex: 0, summary: entry.summary,
    };
    marker.y = this._heightAt(marker.x, marker.z) + 0.3;
    this._camGoal.tx = marker.x;
    this._camGoal.tz = marker.z;
    this._camGoal.dist = Math.min(this._camGoal.dist, 90);
    this._select(marker);
    this._chrome.searchInput.value = '';
    this._renderSearch([]);
  }

  // ── THE CHROME (DOM at full resolution) ────────────────────────

  _mountChrome() {
    injectEnhancedStyle();
    injectEnhancedFonts();
    const root = el('div', 'ovroot');
    root.id = 'enhanced-travelmap';

    const top = el('div', 'ovtop');
    const label = el('div', 'ovlabel', '');
    const search = el('div', 'ovsearch');
    const searchInput = el('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Find a place…';
    searchInput.maxLength = 32;   // FIND_MAX_CHARACTERS, the find box's own cap
    const results = el('ul', 'ovresults');
    search.append(searchInput, results);
    const close = el('button', 'act ovclose', 'Close');
    close.onclick = () => { if (this._phase === 'map') this._close(); };
    top.append(label, search, close);

    const chips = el('div', 'ovfilters');
    for (const key of ['dungeons', 'temples', 'homes', 'towns']) {
      const b = el('button', 'ovchip', key[0].toUpperCase() + key.slice(1));
      b.dataset.key = key;
      b.onclick = () => {
        // the LIVE store object, edited in place - the classic law
        this.filters[key] = !this.filters[key];
        this._markersDirty = true;
        this._renderChips();
      };
      chips.append(b);
    }

    const card = el('div', 'ovcard');
    const skip = el('div', 'ovskip', 'hold to skip');
    const hint = el('div', 'ovhint', 'drag to pan · scroll to zoom · Esc to close');

    root.append(top, chips, card, skip, hint);
    document.body.append(root);
    this._chrome = { root, label, search, searchInput, results, card, skip, close };
    this._renderChips();

    // the search field owns its keys - the host must never route a
    // typed character into the map's own bindings
    searchInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { searchInput.value = ''; this._renderSearch([]); searchInput.blur(); }
    });
    searchInput.addEventListener('input', () => {
      this._renderSearch(this._findLocations(searchInput.value));
    });

    // pointer: pan, zoom to cursor, pick - and the flight's hold-to-skip
    let downAt = null, panned = false;
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    root.addEventListener('pointerdown', (e) => {
      if (e.target !== root) return;   // controls keep their own pointer
      if (this._phase === 'flight') { this._skipHold = 0.0001; return; }
      if (this._phase !== 'map') return;
      // ONE finger pans; a second is ignored rather than adopted - the
      // review caught two thumbs making the camera oscillate at event
      // rate as each move diffed against the other finger's anchor
      if (downAt) return;
      downAt = { id: e.pointerId, x: e.clientX, y: e.clientY, tx: this._cam.tx, tz: this._cam.tz };
      panned = false;
      root.setPointerCapture(e.pointerId);
    });
    root.addEventListener('pointermove', (e) => {
      if (downAt && e.pointerId !== downAt.id) return;
      if (this._phase === 'map') {
        if (downAt) {
          const dx = e.clientX - downAt.x, dy = e.clientY - downAt.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) panned = true;
          const per = this._worldPerPixel();
          this._cam.tx = downAt.tx - dx * per;
          this._cam.tz = downAt.tz + dy * per;
          this._camGoal.tx = this._cam.tx;
          this._camGoal.tz = this._cam.tz;
          this._clampTarget();
        } else {
          this._hoverLabel(e.clientX, e.clientY);
        }
      }
    });
    root.addEventListener('pointerup', (e) => {
      if (this._phase === 'flight') { this._skipHold = 0; return; }
      if (downAt && e.pointerId !== downAt.id) return;
      if (this._phase !== 'map') { downAt = null; return; }
      if (downAt && !panned && e.target === root) this._pickAt(e.clientX, e.clientY);
      downAt = null;
    });
    root.addEventListener('pointercancel', (e) => {
      if (downAt && e.pointerId !== downAt.id) return;
      downAt = null; this._skipHold = 0;
    });
    root.addEventListener('wheel', (e) => {
      // the chrome's own scrollables keep their wheel - the review
      // caught the search dropdown scrolling nothing while the map
      // zoomed behind it
      if (e.target !== root) return;
      if (this._phase !== 'map') return;
      e.preventDefault();
      const before = this._groundAt(e.clientX, e.clientY);
      const factor = Math.exp(e.deltaY * 0.0012);
      this._camGoal.dist = clamp(this._camGoal.dist * factor, DIST_MIN, DIST_MAX);
      this._cam.dist = clamp(this._cam.dist * factor, DIST_MIN, DIST_MAX);
      const after = this._groundAt(e.clientX, e.clientY);
      if (before && after) {
        // zoom toward the cursor: keep the ground point under it still
        this._cam.tx += before.x - after.x;
        this._cam.tz += before.z - after.z;
        this._camGoal.tx = this._cam.tx;
        this._camGoal.tz = this._cam.tz;
        this._clampTarget();
      }
    }, { passive: false });

    // a key held during the flight is the other half of hold-to-skip;
    // optional-chained because the node tests construct this window
    // against a stub document and no window global at all
    this._keyup = (e) => { if (this._phase === 'flight' && !e.repeat) this._skipHold = 0; };
    this._keydownSkip = (e) => {
      if (this._phase === 'flight' && this._skipHold === 0) this._skipHold = 0.0001;
    };
    globalThis.addEventListener?.('keydown', this._keydownSkip, { capture: true });
    globalThis.addEventListener?.('keyup', this._keyup, { capture: true });
    // mouselook's lock never survives a map - the wizard's law
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* no lock to drop */ }
  }

  _unmountChrome() {
    globalThis.removeEventListener?.('keydown', this._keydownSkip, { capture: true });
    globalThis.removeEventListener?.('keyup', this._keyup, { capture: true });
    this._chrome?.root?.remove();
    this._chrome = null;
  }

  _worldPerPixel() {
    return (2 * this._cam.dist * Math.tan(FOV_Y / 2)) / Math.max(1, this._vh ?? 1);
  }

  _clampTarget() {
    this._cam.tx = clamp(this._cam.tx, 0, this._size.width);
    this._cam.tz = clamp(this._cam.tz, -this._size.height, 0);
    this._camGoal.tx = clamp(this._camGoal.tx, 0, this._size.width);
    this._camGoal.tz = clamp(this._camGoal.tz, -this._size.height, 0);
  }

  _hoverLabel(sx, sy) {
    const m = this._markerAt(sx, sy);
    if (m) {
      const name = this._summaryName(m.summary);
      const region = REGION_NAMES[m.summary.regionIndex] ?? '';
      // UpdateRegionLabel's own "Region : Location" reading
      this._chrome.label.textContent = region && name ? `${region} : ${name}` : name;
      this._chrome.root.style.cursor = 'pointer';
      return;
    }
    this._chrome.root.style.cursor = '';
    const g = this._groundAt(sx, sy);
    if (!g) { this._chrome.label.textContent = ''; return; }
    const px = Math.floor(g.x), py = Math.floor(-g.z);
    // the raw politic read, range-checked - the classic window's own
    // region-under-cursor law; the sea answers nothing
    const politic = this.deps.maps?.getPoliticIndex?.(px, py) ?? -1;
    const region = politic - 128;
    this._chrome.label.textContent =
      (region >= 0 && region < (this.deps.maps?.regionCount ?? 0)) ? (REGION_NAMES[region] ?? '') : '';
  }

  _markerAt(sx, sy) {
    let best = null, bestD = 16 * 16;
    for (const m of this._markers) {
      const p = this._project(m.x, m.y, m.z);
      if (!p) continue;
      const d = (p[0] - sx) * (p[0] - sx) + (p[1] - sy) * (p[1] - sy);
      if (d < bestD) { best = m; bestD = d; }
    }
    return best;
  }

  _pickAt(sx, sy) {
    const m = this._markerAt(sx, sy);
    if (m) this._select(m);
    else if (this._selected) this._select(null);
  }

  _renderChips() {
    for (const b of this._chrome.root.querySelectorAll('.ovchip')) {
      // a filter flag TRUE means the bucket is HIDDEN - the classic
      // window's own inversion
      b.classList.toggle('off', !!this.filters[b.dataset.key]);
    }
  }

  _renderSearch(entries) {
    const ul = this._chrome.results;
    ul.innerHTML = '';
    for (const entry of entries) {
      const li = el('li');
      const b = el('button', 'ovresult');
      b.append(el('span', 'ovresult-name', entry.name), el('span', 'ovresult-region', entry.regionName));
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
    card.append(el('h3', 'ovname', this._selected.name || 'Unknown place'));
    card.append(el('p', 'ovmeta', REGION_NAMES[summary.regionIndex] ?? ''));

    if (this._panel === 'teleport') {
      card.append(el('p', 'ovprompt', `Teleport to ${this._selected.name}?`));
      const row = el('div', 'ovacts');
      const yes = el('button', 'act', 'Teleport');
      yes.onclick = () => this._confirmTeleport(true);
      const no = el('button', 'act ovghost', 'Not there');
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
        card.append(el('p', 'ovprompt', 'You are ill. Are you sure you wish to travel?'));
        const row = el('div', 'ovacts');
        const yes = el('button', 'act', 'Travel anyway');
        yes.onclick = () => this._confirmDiseased(true);
        const no = el('button', 'act ovghost', 'Stay');
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
        const row = el('div', 'ovpair');
        row.append(el('span', 'ovpair-k', name));
        for (const [label, value] of [[onLabel, true], [offLabel, false]]) {
          const b = el('button', `ovpick${st.opts[key] === value ? ' on' : ''}`, label);
          // a click ASSIGNS its member; the hotkeys toggle - the
          // popup's own asymmetry
          b.onclick = () => { if (st.opts[key] !== value) this._toggleOpt(key); };
          row.append(b);
        }
        card.append(row);
      }
      const t = st.trip;
      if (t) {
        const dl = el('dl', 'stats ovtrip');
        const add = (k, v) => { dl.append(el('dt', null, k), el('dd', null, v)); };
        add('Journey', `${t.days} ${t.days === 1 ? 'day' : 'days'}`);
        add('Cost', `${t.totalCost} gold`);
        // the label shows COINS, never the letters-of-credit total -
        // the popup's own reading
        add('Purse', `${this.deps.goldPieces?.() ?? 0} gold`);
        card.append(dl);
      }
      if (st.notice) card.append(el('p', 'ovnotice', st.notice));
      const row = el('div', 'ovacts');
      const go = el('button', 'act', 'Begin journey');
      go.onclick = () => this._begin();
      const cancel = el('button', 'act ovghost', 'Cancel');
      cancel.onclick = () => this._closePanel();
      row.append(go, cancel);
      card.append(row);
      return;
    }

    const row = el('div', 'ovacts');
    const travel = el('button', 'act', 'Travel here');
    travel.onclick = () => this._openPanel('travel');
    row.append(travel);
    card.append(row);
  }
}
