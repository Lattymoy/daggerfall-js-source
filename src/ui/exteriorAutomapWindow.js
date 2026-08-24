// A2: THE EXTERIOR AUTOMAP - the town map on M, outdoors. The laws
// are ExteriorAutomap.cs + DaggerfallExteriorAutomapWindow.cs (MIT,
// Daggerfall Workshop; original author Nystul). Verbatim: the layout
// bitmap (64x64 px per RMB block, the per-block row flip :1481, the
// byte -> colour-group law :1482-1541 with the four Map colour
// settings, ground flats stripped except in the All view :318-337),
// the three view modes, the zoom band (orthographicSize 25..250 with
// the ExteriorMapDefaultZoomLevel start clamped 4..31, x8 blocks
// :1004-1014), zoom memory across reopen + the reset-on-new-location
// setting (:513-533), the player marker trio's colours and sizes
// (:1604-1649), discovery-gated nameplates in the classic yellow
// (243,239,44) with DFU's own collision solver (nameplateLayout.js)
// and the "*" surrender, and the M-outside dispatch (DaggerfallUI.cs
// :633-650 - only when the pixel carries a location). DEPARTURES
// (recorded): a keyed overlay in the travelMap idiom instead of the
// native AMAP00I0/TOWN00I0 art window - stepped pan/zoom, no mouse
// drag, no rotation (so north is always up and the corner-vector
// machinery reduces to rotation 0), no HUDCompass, no border-jump
// keys, no plate renaming; the player arrow mesh becomes a
// circle-and-nose marker (the map is a 2D composite here, not a
// second 3D scene); the residence-with-active-quest plate arm
// (:682-709) is FLAGGED - the port's directory carries named
// buildings only.
//
// THE COPY LAW: getBlockAutoMap's removeGroundFlats mutates the
// CACHED block array in place, and cityNavigation carves the navgrid
// from that same array - so this window never touches it: bytes are
// read straight from the retained autoMapData and 0xfb is dropped
// per-pixel during the paint.

import { drawText, measureText } from './text.js';
import { getBool, getInt, getString } from '../systems/settings.js';
import { hexColor32 } from './automapWindow.js';
import { resolveNameplates } from './nameplateLayout.js';

export const BLOCK_PX = 64;                      // blockSizeWidth/Height (ExteriorAutomap.cs:153-154)
const WORLD_PER_PX = 102.4 / BLOCK_PX;           // 1.6 world units per layout pixel (RMBDimension * GlobalScale / 64)
export const ZOOM_MIN = 25.0, ZOOM_MAX = 250.0;  // maxZoom/minZoom - DFU's names invert the meaning (window :39-40)
const ZOOM_FACTOR = 1.25;                        // stepped stand-in for zoomSpeed 50/s held (recorded)
const PAN_FRACTION = 0.25;                       // pan step = a quarter of the visible half-height per press (stepped stand-in for 100/s)
const NAMEPLATE_YELLOW = [243 / 255, 239 / 255, 44 / 255, 1];   // DaggerfallDefaultTextColor (DaggerfallUI.cs:52)
const MARKER_CIRCLE = 0xffb5b5bf;                // (0.75, 0.71, 0.71) - the marker circle (:1646)
const MARKER_NOSE = 0xff16165a;                  // (0.353, 0.086, 0.086) - the stamp arrow's dark red (:1624)
const CIRCLE_PX = 12;                            // cylinder scale (12,1,12) (:1647)
const NOSE_PX = 4;                               // the 2.5-unit arrow's stand-in nose dot
// the byte groups (ExteriorAutomap.cs:1482-1541; byte = BuildingType + 1)
const TEMPLE_SET = new Set([12, 15]);
const SHOP_SET = new Set([1, 3, 4, 6, 7, 9, 10, 11, 13, 14]);
const TAVERN_BYTE = 16;
const HOUSE_SET = new Set([2, 5, 8, 17, 18, 19, 20, 21, 22, 23, 24]);
const SHOWALL_SET = new Set([25, 117, 224, 250, 251]);
export const VIEW_MODES = ['original', 'extra', 'all'];   // (showAll, removeGroundFlats) = (f,t) (t,t) (t,f) (:318-337)

// zoom memory across close/reopen; recomputed on a new location when
// the reset setting holds (window :513-533)
let _zoomLevel = -1;
let _zoomLocation = null;
let _texVer = 0;   // module-level, the A1 lesson: versioned keys never collide across instances
export function _resetZoomForTests() { _zoomLevel = -1; _zoomLocation = null; }

/** The layout bitmap as an uploadTexture color32. blocks =
 *  [{ x, y, autoMap }] (grid coords + the retained 64x64 bytes);
 *  colours = { temple, shop, tavern, house } packed ABGR. Data row 0
 *  lands at the TOP of the drawn quad; north (+z, descending byte
 *  rows through the per-block flip) is up. Pure. */
export function buildExteriorLayout(gridW, gridH, blocks, mode, colours) {
  const showAll = mode !== 'original';
  const removeGroundFlats = mode !== 'all';
  const w = gridW * BLOCK_PX, h = gridH * BLOCK_PX;
  const colors = new Uint32Array(w * h);   // cleared transparent, byte 0's own colour (:1529-1534)
  for (const b of blocks) {
    const data = b.autoMap;
    if (!data) continue;
    for (let y = 0; y < BLOCK_PX; y++) {
      for (let x = 0; x < BLOCK_PX; x++) {
        let byte = data[y * BLOCK_PX + x];
        if (removeGroundFlats && byte === 0xfb) byte = 0;   // the copy-side strip (BlocksFile.cs:434-440; never in place here)
        if (byte === 0) continue;
        let c;
        if (TEMPLE_SET.has(byte)) c = colours.temple;
        else if (SHOP_SET.has(byte)) c = colours.shop;
        else if (byte === TAVERN_BYTE) c = colours.tavern;
        else if (HOUSE_SET.has(byte)) c = colours.house;
        else if (SHOWALL_SET.has(byte)) { if (!showAll) continue; c = colours.house; }   // ships + specials (:1519-1528)
        else c = (0xff000000 | (byte << 16) | 0x0000ff) >>> 0;   // the debug red (255, 0, byte) (:1535-1540)
        // per-block row flip (:1481) = the navgrid's own law; then
        // whole-map flip so north lands at data row 0 (drawn top)
        const worldRow = b.y * BLOCK_PX + (BLOCK_PX - 1 - y);
        colors[(h - 1 - worldRow) * w + b.x * BLOCK_PX + x] = c;
      }
    }
  }
  return { width: w, height: h, colors };
}

export class ExteriorAutomapWindow {
  /** deps: { locationName, locationId, gridW, gridH, blocks
   *  [{x,y,autoMap}], playerPos() -> location-local [x,y,z],
   *  playerYaw() -> rad, directory() -> the named-building entries
   *  (position + buildingKey), discovered() -> discovery records
   *  (buildingKey + displayName). */
  constructor(deps) {
    this.deps = deps;
    this.done = false;
    this.mode = VIEW_MODES[0];
    // the start zoom: multiplier clamped 4..31, x the 8-block max
    // grid, clamped to the band (window :1004-1014); remembered
    // across reopen unless a new location + the reset setting
    const reset = getBool('Map', 'ExteriorMapResetZoomLevelOnNewLocation');
    if (_zoomLevel < 0 || (_zoomLocation !== deps.locationId && reset)) {
      const mult = Math.max(4, Math.min(31, getInt('Map', 'ExteriorMapDefaultZoomLevel', 4, 31)));
      _zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, mult * 8));
    }
    _zoomLocation = deps.locationId;
    this.orthoSize = _zoomLevel;
    const p = deps.playerPos?.() ?? null;
    this.center = this._toMapPx(p);   // [layout px x, layout px y (top-down)]
    this._renderer = null;
    this._tex = null;     // { key, tex, w, h, mode }
    this._plates = null;  // cached solver output for the current view
    this._platesKey = '';
  }

  _toMapPx(p) {
    const h = this.deps.gridH * BLOCK_PX;
    if (!p) return [(this.deps.gridW * BLOCK_PX) / 2, h / 2];
    return [p[0] / WORLD_PER_PX, h - p[2] / WORLD_PER_PX];
  }

  input(action) {
    const pan = this.orthoSize * PAN_FRACTION;
    switch (action) {
      case 'back': case 'char:m': case 'char:M': this.done = true; this.dispose(); return;
      case 'up': case 'char:w': case 'char:W': this.center[1] -= pan; return;
      case 'down': case 'char:s': case 'char:S': this.center[1] += pan; return;
      case 'char:a': case 'char:A': this.center[0] -= pan; return;
      case 'char:d': case 'char:D': this.center[0] += pan; return;
      case 'plus': this._zoom(1 / ZOOM_FACTOR); return;
      case 'minus': case 'char:-': this._zoom(ZOOM_FACTOR); return;
      case 'char:v': case 'char:V': this.mode = VIEW_MODES[(VIEW_MODES.indexOf(this.mode) + 1) % VIEW_MODES.length]; return;
      case 'char:c': case 'char:C': {
        // reset view: refocus the player, recompute the start zoom (:1019-1033)
        this.center = this._toMapPx(this.deps.playerPos?.() ?? null);
        const mult = Math.max(4, Math.min(31, getInt('Map', 'ExteriorMapDefaultZoomLevel', 4, 31)));
        _zoomLevel = this.orthoSize = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, mult * 8));
        return;
      }
      default: return;
    }
  }

  _zoom(f) { _zoomLevel = this.orthoSize = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.orthoSize * f)); }

  /** wheel: up zooms in, as DFU's map panel wheel does (window :1322-1330) */
  wheel(dir) { this._zoom(dir > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR); }

  dispose() {
    const r = this._renderer;
    if (r && this._tex) { r.releaseTexture('amap', this._tex.key); this._tex = null; }
  }

  _ensureTexture(renderer) {
    if (this._tex?.mode === this.mode) return;
    const colours = {
      temple: hexColor32(getString('Map', 'AutomapTempleColor'), 0xffc37d45),
      shop: hexColor32(getString('Map', 'AutomapShopColor'), 0xff1855be),
      tavern: hexColor32(getString('Map', 'AutomapTavernColor'), 0xff307555),
      house: hexColor32(getString('Map', 'AutomapHouseColor'), 0xff283c45),
    };
    const bmp = buildExteriorLayout(this.deps.gridW, this.deps.gridH, this.deps.blocks, this.mode, colours);
    if (this._tex) renderer.releaseTexture('amap', this._tex.key);
    const key = `ext-${++_texVer}`;
    this._tex = { key, tex: renderer.uploadTexture('amap', key, bmp), w: bmp.width, h: bmp.height, mode: this.mode };
  }

  draw(renderer, canvas, font, s) {
    this._renderer = renderer;
    this._ensureTexture(renderer);
    // the travelMap shell: full-canvas parchment-dark backdrop
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.04, 0.03, 0.02, 0.92]);
    // the map: scale = screen px per layout px at the DFU ortho band
    // (the canvas quad is 1 world unit per layout px, so a half-view
    // of orthoSize units shows 2*orthoSize px down the screen)
    const k = canvas.height / (2 * this.orthoSize);
    const toScreen = (px, py) => [canvas.width / 2 + (px - this.center[0]) * k, canvas.height / 2 + (py - this.center[1]) * k];
    const [ox, oy] = toScreen(0, 0);
    renderer.drawScreenQuad(this._tex.tex, { x: ox, y: oy, w: this._tex.w * k, h: this._tex.h * k });
    // the player marker: circle + facing nose (the arrow trio's
    // colours; the mesh arrow pends the native window)
    const p = this.deps.playerPos?.() ?? null;
    if (p) {
      const solid = (name, c) => {
        const colors = new Uint32Array([c]);
        return renderer.uploadTexture('amap', name, { width: 1, height: 1, colors });
      };
      const [mx, my] = toScreen(...this._toMapPx(p));
      const cd = CIRCLE_PX * k;
      renderer.drawScreenQuad(solid('ext-circle', MARKER_CIRCLE), { x: mx - cd / 2, y: my - cd / 2, w: cd, h: cd });
      const yaw = this.deps.playerYaw?.() ?? 0;
      const nd = NOSE_PX * k;
      const nx = mx + Math.sin(yaw) * cd * 0.5, ny = my - Math.cos(yaw) * cd * 0.5;   // +z north = screen up
      renderer.drawScreenQuad(solid('ext-nose', MARKER_NOSE), { x: nx - nd / 2, y: ny - nd / 2, w: nd, h: nd });
    }
    this._drawNameplates(renderer, canvas, font, s, toScreen);
    this._drawChrome(renderer, canvas, font, s);
  }

  /** Discovery-gated plates: names from the discovery records (DFU
   *  reads GetDiscoveredBuilding's displayName, :673-681), anchors at
   *  the building's exterior DOOR (recorded substitution - the port
   *  has no building rectangle; the directory's position is the door
   *  the player discovers the building through). */
  _drawNameplates(renderer, canvas, font, s, toScreen) {
    if (!font) return;
    const discovered = this.deps.discovered?.() ?? [];
    if (!discovered.length) return;
    const byKey = new Map((this.deps.directory?.() ?? []).map((d) => [d.buildingKey, d]));
    // TextScale = max(1.4, 60/orthographicSize * scale) (window
    // :26-27, :866), halved for the port's 16px-cell FNT glyphs -
    // the keyed window's own legibility pick, recorded
    const pScale = Math.max(1.4, (60 / this.orthoSize) * s) / 2;
    const lineH = font.fnt.fixedHeight * pScale;
    const plates = [];
    for (const rec of discovered) {
      const dir = byKey.get(rec.buildingKey);
      if (!dir?.position) continue;
      const name = rec.displayName || dir.name;
      if (!name) continue;
      const [sx, sy] = toScreen(...this._toMapPx(dir.position));
      if (sx < -200 || sx > canvas.width + 200 || sy < -50 || sy > canvas.height + 50) continue;
      plates.push({ x: sx, y: sy, w: measureText(font.fnt, name) * pScale, h: lineH, name });
    }
    // the collision solver, cached per view (pan/zoom/count changes re-run it)
    const key = `${this.center[0]},${this.center[1]},${this.orthoSize},${plates.length},${pScale}`;
    if (this._platesKey !== key) {
      this._platesKey = key;
      this._plates = resolveNameplates(plates);
    }
    for (let i = 0; i < plates.length; i++) {
      const p = plates[i], r = this._plates[i] ?? { offY: 0, replaced: false };
      drawText(renderer, font, r.replaced ? '*' : p.name, p.x, p.y + r.offY - p.h / 2, pScale, NAMEPLATE_YELLOW);
    }
  }

  /** The caption strip's keyed stand-in (TOWN00I0's legend, window
   *  :271-279 + the swatches :466-476) + the controls line. */
  _drawChrome(renderer, canvas, font, s) {
    renderer.drawScreenQuad(null, { x: 0, y: canvas.height - 22 * s, w: canvas.width, h: 22 * s }, undefined, [0.04, 0.03, 0.02, 0.85]);
    if (!font) return;
    const colours = [
      ['Temples', hexColor32(getString('Map', 'AutomapTempleColor'), 0xffc37d45)],
      ['Shops', hexColor32(getString('Map', 'AutomapShopColor'), 0xff1855be)],
      ['Taverns', hexColor32(getString('Map', 'AutomapTavernColor'), 0xff307555)],
    ];
    let x = 4 * s;
    const y = canvas.height - 20 * s;
    for (const [label, c] of colours) {
      const rgba = [(c & 0xff) / 255, ((c >> 8) & 0xff) / 255, ((c >> 16) & 0xff) / 255, 1];
      renderer.drawScreenQuad(null, { x, y, w: 5 * s, h: 5 * s }, undefined, rgba);
      drawText(renderer, font, label, x + 7 * s, y, s, [0.9, 0.9, 0.75, 1]);
      x += (9 + measureText(font.fnt, label)) * s;
    }
    drawText(renderer, font, `${this.deps.locationName ?? ''} - ${this.mode} view`, x + 8 * s, y, s, [0.9, 0.9, 0.75, 1]);
    drawText(renderer, font, 'WASD pan  +/- zoom  V view mode  C reset  ESC exit', 4 * s, canvas.height - 10 * s, s, [0.7, 0.7, 0.6, 1]);
  }
}
