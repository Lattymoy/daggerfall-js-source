// TO1: THE JUNCTION MINI-MAP - the overlay Travel Options puts on the
// HUD when a followed path reaches a fork, "to allow quick easy
// selection of the next direction from a planned route and avoids the
// need to constantly open the travel map while travelling" (the mod's
// own readme, v1.4).
//
// It is twenty map pixels square around the player, drawn by the SAME
// routine the travel map's region page uses (ui/travelPathsOverlay.js
// drawMapSection, which is TravelOptionsMapWindow.DrawMapSection) - the
// mod calls straight into its map window for it
// (TravelOptionsMod.cs:911-928) and the port keeps that one home. Over
// it go two texels in the player's colour: where the player stands and
// which way they are facing.
//
// The panel itself is a Unity `Panel` on the HUD's native panel
// (TravelOptionsMod.cs:349-351) whose rect comes from three settings,
// optionally with an opaque background; here it is a texture the host's
// HUD pass draws, which is the same place and the same moment.
//
// THE TEXTURE DISCIPLINE is the travel map's own (ui/travelMapWindow.js
// :285-286, :1381-1389): a generated texture memoizes forever under its
// key, so every upload carries a monotonic version and the panel
// releases what it replaces. A junction map redrawn on every facing
// change would otherwise leak one cache entry per turn of the head.

import {
  JUNCTION_MAP_WIDTH, JUNCTION_MAP_HEIGHT, JUNCTION_MAP_W2, JUNCTION_MAP_H2,
  JUNCTION_HERE_PT, junctionDirectionIndex, drawMapSection, DOT_SCALE, packRGBA,
} from './travelPathsOverlay.js';
import { nativeMetrics } from './nativePanel.js';

/** TravelOptionsMod.cs:172-179 - the buffer is twenty by twenty map
 *  pixels at five texels each. */
export const JUNCTION_TEX_W = JUNCTION_MAP_WIDTH * DOT_SCALE;
export const JUNCTION_TEX_H = JUNCTION_MAP_HEIGHT * DOT_SCALE;

/** :182 - the three filter modes the setting indexes. The port's
 *  renderer has nearest and linear; trilinear is linear with mips,
 *  which a 100x100 HUD texture never samples, so it maps to linear and
 *  the bible records it. */
export const FILTER_MODES = Object.freeze(['Point', 'Bilinear', 'Trilinear']);
export const filterModeName = (i) => (i === 0 ? 'nearest' : 'linear');

let _texVer = 0;

export class TravelJunctionMap {
  /** `deps`: { roads, mapDict, locationColorOf, discovered, settings,
   *  markedMapId }. Every one is a function the host owns - the panel
   *  reads the world through them and nothing else. */
  constructor(deps = {}) {
    this.deps = deps;
    this.enabled = false;
    this.buf = new Uint32Array(JUNCTION_TEX_W * JUNCTION_TEX_H);
    this._tex = null;
    this._key = null;
    this._dirty = false;
    this.lastDrawn = null;   // { x, y, direction } - what the buffer holds
  }

  /** The panel's rect on the 320x200 screen: ScreenPositionX/Y and
   *  ScreenSize, as :344-347 reads them. */
  rect() {
    const s = this.deps.settings?.() ?? {};
    return [s.junctionMapX ?? 235, s.junctionMapY ?? 10, s.junctionMapSize ?? 75, s.junctionMapSize ?? 75];
  }

  /** :911-928, DrawJunctionMap. The section is centred on the player's
   *  pixel - `currMapPixel - width/2` - and the two player texels are
   *  written over it afterwards, which is why the pip can sit on a road
   *  and still be seen. */
  draw(mapPixel, direction = 0) {
    const s = this.deps.settings?.() ?? {};
    const originX = mapPixel.x - JUNCTION_MAP_W2;
    const originY = mapPixel.y - JUNCTION_MAP_H2;
    drawMapSection(this.buf, {
      originX, originY, width: JUNCTION_MAP_WIDTH, height: JUNCTION_MAP_HEIGHT,
      circular: s.junctionMapCircular !== false,
    }, {
      pathsAt: (x, y, type) => this.deps.pathsAt?.(x, y, type) ?? 0,
      locationAt: (x, y) => this.deps.locationAt?.(x, y) ?? null,
      colorOf: (t) => this.deps.locationColorOf?.(t) ?? null,
      onlyLargeDots: !(s.variableSizeDots ?? false),
      markedMapId: this.deps.markedMapId?.() ?? -1,
      markColor: s.markLocationColor ? packRGBA(...s.markLocationColor) : null,
      showPaths: [true, true, false, false],
    });
    const player = s.playerColor ? packRGBA(...s.playerColor) : packRGBA(255, 0, 0, 255);
    this.buf[JUNCTION_HERE_PT] = player;
    const pip = junctionDirectionIndex(direction);
    if (pip > 0 && pip < this.buf.length) this.buf[pip] = player;
    this.lastDrawn = { x: mapPixel.x, y: mapPixel.y, direction };
    this._dirty = true;
  }

  /** :954-962, UpdateJunctionMap - redrawn only when the facing
   *  CHANGED, which is what keeps a x50 journey from rebuilding a
   *  hundred-texel texture every frame. */
  update(mapPixel, direction) {
    if (this.lastDrawn && this.lastDrawn.x === mapPixel.x && this.lastDrawn.y === mapPixel.y
      && this.lastDrawn.direction === direction) return false;
    this.draw(mapPixel, direction);
    return true;
  }

  /** The HUD pass. `renderer` is the port's; the texture is uploaded
   *  under a versioned key and the old one released, the travel map's
   *  own discipline. */
  drawPanel(renderer, canvas) {
    if (!this.enabled || !renderer) return;
    const m = nativeMetrics(canvas);
    const [x, y, w, h] = this.rect();
    const s = this.deps.settings?.() ?? {};
    if (this._dirty || !this._tex) {
      if (this._key) renderer.releaseTexture?.('travelto', this._key);
      // bottom-up to top-down, as every generated texture in this port
      // is flipped at upload (ui/travelMapWindow.js:1381-1389)
      const flipped = new Uint32Array(this.buf.length);
      for (let row = 0; row < JUNCTION_TEX_H; row++) {
        flipped.set(this.buf.subarray((JUNCTION_TEX_H - row - 1) * JUNCTION_TEX_W, (JUNCTION_TEX_H - row) * JUNCTION_TEX_W), row * JUNCTION_TEX_W);
      }
      this._key = `junction-${++_texVer}`;
      this._tex = renderer.uploadTexture('travelto', this._key, { width: JUNCTION_TEX_W, height: JUNCTION_TEX_H, colors: flipped });
      this._dirty = false;
    }
    // :356-357 - an opaque panel paints its background colour first
    if (s.junctionMapOpaque && s.junctionMapBackground) {
      const [r, g, b, a] = s.junctionMapBackground;
      renderer.drawScreenQuad?.(null, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: w * m.s, h: h * m.s },
        { color: [r / 255, g / 255, b / 255, a / 255] });
    }
    if (this._tex) {
      renderer.drawScreenQuad?.(this._tex, { x: m.ox + x * m.s, y: m.oy + y * m.s, w: w * m.s, h: h * m.s },
        { filter: filterModeName(s.junctionMapFilterMode ?? 0) });
    }
  }

  dispose(renderer) {
    if (this._key && renderer) renderer.releaseTexture?.('travelto', this._key);
    this._key = null; this._tex = null;
  }
}

export function createTravelJunctionMap(deps = {}) { return new TravelJunctionMap(deps); }
