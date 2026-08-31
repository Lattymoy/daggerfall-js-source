// A1: THE DUNGEON AUTOMAP WINDOW - the port's keyed rendering of
// DaggerfallAutomapWindow.cs + the render half of Automap.cs (MIT,
// Daggerfall Workshop; original author Nystul). What is verbatim:
// the 2D camera lens (FOV 15, the 150-unit view-from-top height, the
// automap camera's 0.7/5000 clip planes), the slice plane (player eye
// Y + bias, default bias 0.2, or maxed out by the setting), the
// revealed-geometry-only pass, the player marker (Daggerfall mesh
// 99900 at the player's own transform), the green entrance beacon
// that shows only once discovered, and the micro-map law digit for
// digit (2 px per block drawn at double size, sizeMin 7, "B"-prefix
// border blocks, half-block green entrance / red player pixels, the
// three Map settings). DEPARTURES (recorded): DFU's window is native
// AMAP00I0.IMG art with mouse-drag pan/rotate/zoom and held-key
// continuous motion rendered through a RenderTexture; the port's A1
// window is a keyed overlay in the travelMap idiom - full-canvas
// second camera pass + text chrome, STEPPED controls (one action per
// press, scaled from DFU's per-second speeds), no mouse. The native
// art window, the 3D view mode, render modes (cutout/wireframe/
// transparent), beacon focus cycling, note markers and teleporter
// portals stay FLAGGED (systems/automap.js keeps the list); A2
// brought the grayscale prior-run presentation here.
//
// THE PASS. The host draws overlays after its own world pass, so this
// window opens a SECOND camera frame: beginFrame with the top-down
// lens (mirrorProjectionX - the mesh pass culls, so it must ride the
// mirrored projection, mat4's law), a black ground quad (the automap
// camera clears SolidColor; the port's clear color is the Iliac sky),
// the revealed-filtered mesh pass under setClipY, then markers and
// chrome. Fog off (DFU's NoFogCamera) and a bright flat ambient (the
// three automap directional lights collapse to ambient - the mesh
// shader has one light; recorded) - both restored to the dungeon
// hosts' own values in a finally, alongside the slice plane.

import { drawText } from './text.js';
import { mirrorProjectionX, perspective, lookAt, trs, UP_Y } from '../world/mat4.js';
import { getBool, getString } from '../systems/settings.js';
import { slicingPositionY, DEFAULT_SLICING_BIAS_Y } from '../systems/automap.js';
import { DUNGEON_AMBIENT } from '../world/dungeonLights.js';
import { RDB_SIDE } from '../world/dungeonLayout.js';

const DEG = Math.PI / 180;
export const FIELD_OF_VIEW_2D = 15.0;             // fieldOfViewCameraMode2D (DaggerfallAutomapWindow.cs:43)
export const CAMERA_HEIGHT_VIEW_FROM_TOP = 150.0; // cameraHeightViewFromTop (:53)
const NEAR_CLIP = 0.7;                            // the automap camera's own planes (Automap.cs:2012-2013);
const FAR_CLIP = 5000.0;                          // NOT the 2D mode's 100 - the shader slice does that job here
// Stepped stand-ins for DFU's held-key per-second speeds (recorded
// departure): pan 50/s, rotate 150/s, zoom 3/s, slice 25/s become one
// step per press. Pan scales with zoom the way DFU's drag compensates
// by camera distance.
const PAN_STEP = 8.0;
const ROTATE_STEP_DEG = 22.5;
const ZOOM_FACTOR = 1.25;
const SLICE_STEP = 2.5;
const HEIGHT_MIN = 20.0, HEIGHT_MAX = 600.0;
export const MICRO_BLOCK_PX = 2;                  // microMapBlockSizeInPixels (Automap.cs:1771)
export const MICRO_SIZE_MIN = 7;                  // sizeMin (:1753)
const MICRO_YELLOW = 0xff00ffff;                  // Color.yellow blocks when QoL is off (:1799), ABGR
const MICRO_GREEN = 0xff00ff00;                   // entrance (:1815)
const MICRO_RED = 0xff0000ff;                     // player (:1828)

// AutomapRememberSliceLevel's home: DFU keeps SlicingBiasY on the
// persistent Automap component and the window resets it on open
// unless the setting holds (DaggerfallAutomapWindow.cs:568-572).
let _rememberedBias = DEFAULT_SLICING_BIAS_Y;

// The micro-map version counter is MODULE-level: uploadTexture
// memoizes by key forever, and a window torn down without dispose()
// (the death presenter's forced overwrite) would otherwise leave
// 'micro-1' cached - the next window's per-instance counter would
// re-mint the same key and be handed the dead session's bitmap
// (A1 review).
let _microVer = 0;

/** "RRGGBBAA" -> packed ABGR uint32 (the settings colour law,
 *  settingsLaw.js's widget format). Bad strings answer the fallback. */
export function hexColor32(rrggbbaa, fallback) {
  if (!/^[0-9a-fA-F]{8}$/.test(rrggbbaa ?? '')) return fallback;
  const n = parseInt(rrggbbaa, 16);
  const r = (n >>> 24) & 0xff, g = (n >>> 16) & 0xff, b = (n >>> 8) & 0xff, a = n & 0xff;
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** The micro-map bitmap (UpdateMicroMapTexture, Automap.cs:1739-1832),
 *  as an uploadTexture color32. blocks = [{x, z, name}] in block grid
 *  units; entrance/player = world [x,_,z] or null. Pure - the caller
 *  reads the settings. Data row 0 lands at the TOP of the drawn quad
 *  (the port's IMG convention), so north (+z) rows come first. */
export function buildMicroMap(blocks, entrance, player, { qol = true, inner = 0xffd087d4, border = 0xff03b4fa } = {}) {
  if (!blocks?.length) return null;
  let xMin = Infinity, xMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  for (const b of blocks) {
    xMin = Math.min(xMin, b.x); xMax = Math.max(xMax, b.x);
    zMin = Math.min(zMin, b.z); zMax = Math.max(zMax, b.z);
  }
  // the +1 origin margin and the square max(sizeMin, extents) law (:1752-1769)
  const originX = -xMin + 1, originZ = -zMin + 1;
  const size = Math.max(MICRO_SIZE_MIN, Math.max(xMax + 1 + originX, zMax + 1 + originZ));
  const w = size * MICRO_BLOCK_PX, h = size * MICRO_BLOCK_PX;
  const colors = new Uint32Array(w * h);   // cleared transparent (:1777-1780)
  // put() speaks rows-from-bottom (DFU's SetPixel space) and flips
  const put = (x, yBottom, c) => {
    if (x < 0 || x >= w || yBottom < 0 || yBottom >= h) return;
    colors[(h - 1 - yBottom) * w + x] = c;
  };
  for (const b of blocks) {
    const c = qol ? ((b.name ?? '').startsWith('B') ? border : inner) : MICRO_YELLOW;   // border blocks are "B"-named (:1790-1799)
    const px = (originX + b.x) * MICRO_BLOCK_PX, py = (originZ + b.z) * MICRO_BLOCK_PX;
    for (let i = 0; i < MICRO_BLOCK_PX; i++) for (let j = 0; j < MICRO_BLOCK_PX; j++) put(px + i, py + j, c);
  }
  // entrance + player at half-block resolution, 1 px each (:1805-1830)
  const half = (p) => [Math.floor((p[0] / RDB_SIDE + originX) * 2), Math.floor((p[2] / RDB_SIDE + originZ) * 2)];
  if (entrance) { const [x, y] = half(entrance); put(x, y, MICRO_GREEN); }
  if (player) { const [x, y] = half(player); put(x, y, MICRO_RED); }
  return { width: w, height: h, colors };
}

export class AutomapWindow {
  /** deps: { record() -> the live automap record, drawList,
   *  dynamicDraws, texRemap, player() -> {feet, eye, yaw}, startMarker,
   *  blocks (block-grid [{x,z,name}]), arrowMesh (gpu 99900 or null),
   *  dungeonName, indexSize }. */
  constructor(deps) {
    this.deps = deps;
    this.done = false;
    const p = deps.player?.() ?? null;
    // the 2D reset law: camera straight above the player (:1160-1165)
    this.center = p?.feet ? [p.feet[0], p.feet[2]] : [0, 0];
    this.refY = p?.feet?.[1] ?? 0;
    this.height = CAMERA_HEIGHT_VIEW_FROM_TOP;
    this.yawDeg = 0;
    this.biasY = getBool('Map', 'AutomapRememberSliceLevel') ? _rememberedBias : DEFAULT_SLICING_BIAS_Y;
    this._renderer = null;
    this._micro = null;      // { key, tex, w, h, stamp }
    this._markers = null;    // { entrance, player } billboard batches
  }

  /** Keyed vocabulary only (ui/input.js overlayAction): letters arrive
   *  as char:x. M closes like DFU's own toggle-to-close (:703-714). */
  input(action) {
    const yaw = this.yawDeg * DEG;
    const stepScale = this.height / CAMERA_HEIGHT_VIEW_FROM_TOP;   // drag-speed distance compensation (:883-886), stepped
    const pan = (fx, fz) => { this.center[0] += fx * PAN_STEP * stepScale; this.center[1] += fz * PAN_STEP * stepScale; };
    const up = [Math.sin(yaw), Math.cos(yaw)];        // screen-up in world xz
    const right = [Math.cos(yaw), -Math.sin(yaw)];    // screen-right (the mirrored convention's [cos, 0, -sin])
    switch (action) {
      case 'back': case 'char:m': case 'char:M': this.done = true; this.dispose(); return;
      case 'up': case 'char:w': case 'char:W': pan(up[0], up[1]); return;
      case 'down': case 'char:s': case 'char:S': pan(-up[0], -up[1]); return;
      case 'char:a': case 'char:A': pan(-right[0], -right[1]); return;
      case 'char:d': case 'char:D': pan(right[0], right[1]); return;
      case 'char:q': case 'char:Q': this.yawDeg = (this.yawDeg + ROTATE_STEP_DEG) % 360; return;
      case 'char:e': case 'char:E': this.yawDeg = (this.yawDeg - ROTATE_STEP_DEG + 360) % 360; return;
      case 'plus': this.height = Math.max(HEIGHT_MIN, this.height / ZOOM_FACTOR); return;
      // '-' matches overlayAction's char class and arrives as char:-,
      // never as 'minus'; both spellings accepted so the map cannot
      // depend on which router quirk delivered the key.
      case 'minus': case 'char:-': this.height = Math.min(HEIGHT_MAX, this.height * ZOOM_FACTOR); return;
      case 'char:t': case 'char:T': _rememberedBias = this.biasY += SLICE_STEP; return;
      case 'char:g': case 'char:G': _rememberedBias = this.biasY -= SLICE_STEP; return;
      case 'char:c': case 'char:C': {
        // ActionResetView (:1774-1793): slice, camera and pivot reset
        const p = this.deps.player?.() ?? null;
        if (p?.feet) { this.center = [p.feet[0], p.feet[2]]; this.refY = p.feet[1]; }
        this.height = CAMERA_HEIGHT_VIEW_FROM_TOP;
        this.yawDeg = 0;
        _rememberedBias = this.biasY = DEFAULT_SLICING_BIAS_Y;
        return;
      }
      default: return;
    }
  }

  /** Release the window's GL resources. Idempotent; also called by
   *  the death presenter when it force-replaces the overlay slot. */
  dispose() {
    const r = this._renderer;
    if (!r) return;
    if (this._micro) { r.releaseTexture('amap', this._micro.key); this._micro = null; }
    if (this._markers) {
      r.destroyBillboardBatch(this._markers.entrance);
      r.destroyBillboardBatch(this._markers.player);
      this._markers = null;
    }
  }

  _ensureMarkers(renderer) {
    if (this._markers) return;
    const solid = (name, c) => {
      const colors = new Uint32Array([c]);
      renderer.uploadTexture('amap', name, { width: 1, height: 1, colors });
    };
    solid('entrance', MICRO_GREEN);   // the 0.8 green entrance cube (Automap.cs:1437-1440)
    solid('player', MICRO_RED);       // the red position beacon's stand-in when mesh 99900 is absent
    this._markers = {
      entrance: renderer.createBillboardBatch('amap', 'entrance', { w: 0.8, h: 0.8 }, [[0, 0, 0]]),
      player: renderer.createBillboardBatch('amap', 'player', { w: 0.8, h: 0.8 }, [[0, 0, 0]]),
    };
  }

  draw(renderer, canvas, font, s) {
    this._renderer = renderer;
    const rec = this.deps.record?.() ?? null;
    const p = this.deps.player?.() ?? null;
    this._ensureMarkers(renderer);
    // ---- the second camera pass (real canvas, no letterbox offset) ----
    const off = renderer.screenOffset;
    renderer.setScreenOffset(0, 0);
    const sliceMaxed = getBool('Map', 'AutomapAlwaysMaxOutSliceLevel');   // float.MaxValue arm (Automap.cs:1299-1302)
    renderer.setClipY(sliceMaxed ? null : slicingPositionY(p?.eye?.[1] ?? this.refY, 0, this.biasY));
    renderer.setFog('off');                                      // NoFogCamera (:2017)
    renderer.setLighting(new Float32Array([0.9, 0.9, 0.9]), 0);  // key/fill/back 0.9/0.7/0.5 collapsed to ambient (:2073-2075, recorded)
    try {
      const yaw = this.yawDeg * DEG;
      const upv = [Math.sin(yaw), 0, Math.cos(yaw)];
      const aspect = (renderer.canvas.clientWidth || 1) / (renderer.canvas.clientHeight || 1);
      const proj = mirrorProjectionX(perspective(FIELD_OF_VIEW_2D * DEG, aspect, NEAR_CLIP, FAR_CLIP));   // HANDEDNESS (mat4's law): this pass culls
      const view = lookAt([this.center[0], this.refY + this.height, this.center[1]], [this.center[0], this.refY, this.center[1]], upv);
      renderer.beginFrame(proj, view, UP_Y);
      // SolidColor clear: the port's clear color is the Iliac sky, so
      // paint the map's black ground (depth untouched - drawScreenQuad
      // runs with the depth test off).
      renderer.drawScreenQuad(null, { x: 0, y: 0, w: renderer.canvas.width, h: renderer.canvas.height }, undefined, [0, 0, 0, 1]);
      // the revealed-only pass - MeshRenderer.enabled = discovered,
      // as a filter over the LIVE draw lists (systems/automap.js).
      // A2: two tiers, DFU's RENDER_IN_GRAYSCALE law - visited this
      // run draws in colour (mode 1: the slice-distance dim alone),
      // geometry revealed on a PRIOR run draws grayscale (mode 2) -
      // Automap.cs:60-79's two bits, finally presented.
      if (rec) {
        const run = rec.visitedThisRun;
        renderer.setAutomapMode(1);
        for (const d of this.deps.drawList) if (d.key != null && run.has(d.key)) renderer.drawMesh(d.mesh, d.matrix, this.deps.texRemap);
        for (const d of this.deps.dynamicDraws) if (run.has(d.object.key)) renderer.drawMesh(d.gpu, d.object.matrix, this.deps.texRemap);
        renderer.setAutomapMode(2);
        for (const d of this.deps.drawList) if (d.key != null && rec.revealed.has(d.key) && !run.has(d.key)) renderer.drawMesh(d.mesh, d.matrix, this.deps.texRemap);
        for (const d of this.deps.dynamicDraws) if (rec.revealed.has(d.object.key) && !run.has(d.object.key)) renderer.drawMesh(d.gpu, d.object.matrix, this.deps.texRemap);
      }
      // BEACONS ARE NEVER SLICED (nor dimmed, nor grayed): DFU
      // injects the slicing shader into the duplicated GEOMETRY only
      // (:1906); the arrow and markers live under gameobjectBeacons
      // with Standard materials (:1355-1362), so slicing below your
      // feet must not erase your own position marker (A1 review).
      // Both setters upload immediately.
      renderer.setClipY(null);
      renderer.setAutomapMode(0);
      // the player marker arrow: mesh 99900 at the player's own
      // position + yaw (Automap.cs:1353-1361); red quad fallback
      if (this.deps.arrowMesh && p?.feet) {
        renderer.drawMesh(this.deps.arrowMesh, trs(p.feet[0], p.feet[1], p.feet[2], 0, (p.yaw ?? 0) / DEG, 0), this.deps.texRemap);
      }
      // beacons as floor-plane quads: camUp = map north, camRight =
      // map east, so the camera-facing quad lies flat under the
      // top-down lens. Billboards carry no clip plane - beacons
      // ignore the slice, as DFU's Standard-shader markers do.
      const camR = new Float32Array([Math.cos(yaw), 0, -Math.sin(yaw)]);
      const camU = new Float32Array(upv);
      const batches = [];
      const sm = this.deps.startMarker;
      if (rec?.entranceDiscovered && sm) {   // hidden until discovered (:1447-1448)
        this._markers.entrance.origin = [sm.x, sm.y, sm.z];
        batches.push(this._markers.entrance);
      }
      if (!this.deps.arrowMesh && p?.feet) {
        this._markers.player.origin = [...p.feet];
        batches.push(this._markers.player);
      }
      if (batches.length) renderer.drawBillboards(batches, camR, camU);
    } finally {
      // hand the state back exactly as the dungeon hosts set it
      // (dungeon.js:221-223 / worldModes.js:1662-1663)
      renderer.setClipY(null);
      renderer.setAutomapMode(0);
      renderer.setFog('exp', 0.005, 0, 0, new Float32Array([0, 0, 0]));
      renderer.setLighting(new Float32Array(DUNGEON_AMBIENT), 0);
      renderer.setScreenOffset(off[0], off[1]);
    }
    // ---- chrome, on the virtual screen the host letterboxed ----
    this._drawMicroMap(renderer, p, s);
    renderer.drawScreenQuad(null, { x: 0, y: canvas.height - 22 * s, w: canvas.width, h: 22 * s }, undefined, [0.04, 0.03, 0.02, 0.85]);
    if (font) {
      const pct = this.deps.indexSize ? Math.floor(((rec?.revealed.size ?? 0) / this.deps.indexSize) * 100) : 0;   // ExploredPercentage (:2467-2478)
      drawText(renderer, font, `${this.deps.dungeonName ?? 'Dungeon'} - ${pct}% explored`, 4 * s, canvas.height - 20 * s, s, [0.9, 0.9, 0.75, 1]);
      drawText(renderer, font, 'WASD pan  Q/E rotate  +/- zoom  T/G slice  C reset  ESC exit', 4 * s, canvas.height - 10 * s, s, [0.7, 0.7, 0.6, 1]);
    }
  }

  /** The micro-map panel: DFU pins it at (0,52) native and renders the
   *  texture at double size (Automap.cs:349, window rect :385-386).
   *  Rebuilt only when the player crosses a half-block (the marker's
   *  own resolution); versioned keys because uploadTexture memoizes. */
  _drawMicroMap(renderer, p, s) {
    if (getBool('Map', 'AutomapDisableMicroMap')) return;
    const blocks = this.deps.blocks;
    if (!blocks?.length) return;
    const sm = this.deps.startMarker;
    const feet = p?.feet ?? null;
    const stamp = feet ? `${Math.floor(feet[0] * 2 / RDB_SIDE)},${Math.floor(feet[2] * 2 / RDB_SIDE)}` : 'none';
    if (!this._micro || this._micro.stamp !== stamp) {
      const bmp = buildMicroMap(blocks, sm ? [sm.x, 0, sm.z] : null, feet, {
        qol: getBool('Map', 'DungeonMicMapQoL'),
        inner: hexColor32(getString('Map', 'DunMicMapInnerColor'), 0xffd087d4),
        border: hexColor32(getString('Map', 'DunMicMapBorderColor'), 0xff03b4fa),
      });
      if (!bmp) return;
      if (this._micro) renderer.releaseTexture('amap', this._micro.key);
      const key = `micro-${++_microVer}`;
      this._micro = { key, tex: renderer.uploadTexture('amap', key, bmp), w: bmp.width, h: bmp.height, stamp };
    }
    renderer.drawScreenQuad(this._micro.tex, { x: 2 * s, y: 52 * s, w: this._micro.w * 2 * s, h: this._micro.h * 2 * s });
  }
}
