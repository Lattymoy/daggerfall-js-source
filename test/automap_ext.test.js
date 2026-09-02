// A2 / ROAD-C c2/S10: THE AUTOMAP'S SECOND HALF - the exterior town map
// (ExteriorAutomap.cs + DaggerfallExteriorAutomapWindow.cs) and the
// grayscale prior-run presentation (DaggerfallAutomap.shader). The
// bitmap colour law byte for byte, the copy law (the cached block
// array feeds the navgrid and must never be mutated), DFU's
// nameplate collision solver, the zoom band with its memory, the
// M-outside dispatch, and the renderer's uAutomapMode seam.
//
// c2/S10 RE-BASELINED TWO FAMILIES OF PIN HERE, both deliberately:
//  - HALF A made the window native and the camera real, so the control
//    pins moved off A2's stepped stand-ins (PAN_FRACTION, ZOOM_FACTOR)
//    onto DFU's own per-second speeds and ComputeZoom;
//  - HALF B moved the plate ANCHOR off the discovered exterior door
//    onto the building subrecord's own Position, which moves EVERY
//    PLATE IN EVERY TOWN. The solver itself is untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ExteriorAutomapWindow, buildExteriorLayout, VIEW_MODES,
  BLOCK_PX, ZOOM_MIN, ZOOM_MAX, _resetZoomForTests,
  toPanelScreen, layoutQuadRotation, playerMarkerLayoutPos,
  MARKER_TILE_SCALE, MARKER_REF_SPAN, CUSTOM_LOCATION_OFFSET, BACKGROUNDS,
} from '../src/ui/exteriorAutomapWindow.js';
import { nameplatesIntersect, resolveNameplates, nameplateAnchor } from '../src/ui/nameplateLayout.js';
import { CAPTION_STRIP, CAPTION_SWATCHES } from '../src/ui/automapChrome.js';
import { EXT_ZOOM_SPEED, EXT_SCROLL_UP_DOWN_SPEED } from '../src/ui/automapCamera.js';
import { rasterizeTopDown, rasterizeDisc, STAMP_INK } from '../src/ui/meshStamp.js';
import { buildingSummaries, buildingPosition } from '../src/world/buildingSummaries.js';
import {
  discoverBuilding, discoveredBuildings, setDiscoveredBuildingCustomName,
  snapshotDiscovery, restoreDiscovery,
} from '../src/systems/discovery.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

const COLOURS = { temple: 0xffc37d45, shop: 0xff1855be, tavern: 0xff307555, house: 0xff283c45 };
const at = (bmp, x, yTop) => bmp.colors[yTop * bmp.width + x];
// one block whose byte grid is all zero except chosen cells
const block = (cells) => {
  const data = new Uint8Array(64 * 64);
  for (const [x, y, b] of cells) data[y * 64 + x] = b;
  return data;
};

const FONT = { fnt: { fixedWidth: 6, fixedHeight: 6, glyphWidth: () => 5 } };

/** The deps every window pin opens with: a 2x2-block town whose player
 *  stands one block in on each axis. */
const deps = (id) => ({
  locationName: 'T', locationId: id, gridW: 2, gridH: 2,
  blocks: [], playerPos: () => [102.4, 0, 102.4], playerYaw: () => 0,
  locOrigin: [0, 0, 0], isCustomLocation: false,
  arrowMesh: () => null, compassArt: null,
  buildings: () => [], directory: () => [], discovered: () => [],
});

/** A two-triangle quad in the XZ plane, for the stamp path. */
const TRI_MESH = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

/** A block instance with TWO subrecords - a shop and a house - so the
 *  plate walk has something with and something without a name. */
const FAKE_BLOCK = {
  x: 1,
  y: 0,
  dfBlock: {
    rmbBlock: {
      fldHeader: {
        numBlockDataRecords: 2,
        buildingDataList: [
          { buildingType: 9, nameSeed: 1, factionId: 0, quality: 10 },
          { buildingType: 17, nameSeed: 2, factionId: 0, quality: 4 },
        ],
      },
      subRecords: [
        { xPos: 2048, zPos: 1024, yRotation: 0, exterior: { block3dObjectRecords: [] }, interior: {} },
        { xPos: 512, zPos: 3072, yRotation: 0, exterior: { block3dObjectRecords: [] }, interior: {} },
      ],
    },
  },
};

/** A call-recording stand-in for the renderer. The window only ever
 *  asks it for textures, screen quads and the scissor bracket - which
 *  is the point of the CPU composition, and is what lets the paint
 *  ORDER be pinned at all. */
function stubRenderer(log) {
  return {
    uploadTexture: (arch, key) => `tex:${arch}:${key}`,
    releaseTexture: () => {},
    screenScissor(rect, body) {
      log.push({ kind: 'scissor', rect });
      try { return body(); } finally { log.push({ kind: 'unscissor' }); }
    },
    drawScreenQuad(tex, dst, srcRect, color, opts) {
      log.push({ kind: 'quad', tex: tex ?? null, dst, color, opts });
    },
  };
}

test('A2 layout: the byte -> colour-group law digit for digit (ExteriorAutomap.cs:1482-1541)', () => {
  // bytes on row 0 (which lands at the TOP - byte row 0 is the north
  // edge through the per-block flip, :1481 = the navgrid law)
  const data = block([[0, 0, 12], [1, 0, 15], [2, 0, 1], [3, 0, 14], [4, 0, 16], [5, 0, 2], [6, 0, 24], [7, 0, 99], [8, 0, 25], [9, 0, 0xfb]]);
  const bmp = buildExteriorLayout(1, 1, [{ x: 0, y: 0, autoMap: data }], 'original', COLOURS);
  assert.equal(bmp.width, BLOCK_PX);
  assert.equal(at(bmp, 0, 0), COLOURS.temple, 'guildhall byte 12 takes the temple colour');
  assert.equal(at(bmp, 1, 0), COLOURS.temple, 'temple 15');
  assert.equal(at(bmp, 2, 0), COLOURS.shop, 'alchemist 1');
  assert.equal(at(bmp, 3, 0), COLOURS.shop, 'weaponsmith 14');
  assert.equal(at(bmp, 4, 0), COLOURS.tavern, 'tavern 16');
  assert.equal(at(bmp, 5, 0), COLOURS.house, 'house-for-sale 2');
  assert.equal(at(bmp, 6, 0), COLOURS.house, 'town23 24');
  // the unknown-byte arm decomposed into DFU's own channels
  // (r=255, g=0, b=the raw byte, a=255) rather than restating the
  // port's packing expression
  const dbg = at(bmp, 7, 0);
  assert.equal(dbg & 0xff, 255, 'debug red: r = 255');
  assert.equal((dbg >>> 8) & 0xff, 0, 'debug red: g = 0');
  assert.equal((dbg >>> 16) & 0xff, 99, 'debug red: b = the raw byte');
  assert.equal((dbg >>> 24) & 0xff, 255, 'debug red: opaque');
  assert.equal(at(bmp, 8, 0), 0, 'ship 25 hides outside showAll (:1519-1528)');
  assert.equal(at(bmp, 9, 0), 0, 'ground flat 0xfb strips in Original');
  assert.equal(at(bmp, 10, 0), 0, 'byte 0 is transparent');
  // the All view: showAll set colours as house, ground flats kept
  const all = buildExteriorLayout(1, 1, [{ x: 0, y: 0, autoMap: data }], 'all', COLOURS);
  assert.equal(at(all, 8, 0), COLOURS.house, 'ships colour in All');
  assert.equal(at(all, 9, 0), COLOURS.house, '0xfb (251) is IN the showAll set - kept in All');
  // THE COPY LAW: the cached block bytes are untouched (cityNavigation
  // carves the navgrid from this same array)
  assert.equal(data[9], 0xfb, 'the retained autoMapData is never mutated');
});

test('A2 layout: block grid placement + the double row flip lands north at the top', () => {
  // a 2x1 grid; block (1,0) gets a byte at its LAST row (y=63), which
  // the per-block flip sends to the block's world-southmost row -
  // for a 1-block-tall grid that is the BOTTOM of the drawn bitmap
  const bmp = buildExteriorLayout(2, 1, [
    { x: 0, y: 0, autoMap: block([[0, 0, 16]]) },
    { x: 1, y: 0, autoMap: block([[5, 63, 16]]) },
  ], 'original', COLOURS);
  assert.equal(bmp.width, 128);
  assert.equal(at(bmp, 0, 0), COLOURS.tavern, 'block (0,0) byte row 0 -> top-left');
  assert.equal(at(bmp, 64 + 5, 63), COLOURS.tavern, 'block (1,0) byte row 63 -> bottom row');
  assert.equal(buildExteriorLayout(1, 1, [{ x: 0, y: 0, autoMap: null }], 'original', COLOURS).colors[0], 0, 'a block without bytes stays transparent');
});

test('A2 nameplates: the intersect predicate with its exact boundaries (CheckIntersectionOfNameplates :993-1010)', () => {
  const P = (x, y, w = 40, h = 10) => ({ x, y, w, h, offY: 0 });
  assert.equal(nameplatesIntersect(P(0, 0), P(10, 5)), true, 'overlapping');
  assert.equal(nameplatesIntersect(P(0, 0), P(10, 10)), false, '|dy| == ySize misses (strict <)');
  assert.equal(nameplatesIntersect(P(0, 0), P(40, 5)), false, '|dx| == leftmost width misses');
  assert.equal(nameplatesIntersect(P(0, 0, 20), P(30, 0, 60)), false, 'the LEFTMOST width rules: 30 >= 20');
  assert.equal(nameplatesIntersect(P(30, 0, 60), P(0, 0, 20)), false, 'argument order does not change the leftmost');
});

test('A2 nameplates: the solver parts a pair, shoves off a crowd, and surrenders a "*" (ComputeNameplateOffsets :1147-1377)', () => {
  // a clean pair at the same spot: half-shifted apart, no stars
  const pair = resolveNameplates([{ x: 0, y: 100, w: 40, h: 10 }, { x: 0, y: 100, w: 40, h: 10 }]);
  assert.equal(Math.abs(pair[0].offY - pair[1].offY), 10, 'parted by exactly ySize (the half-bias each)');
  assert.equal(pair.some((p) => p.replaced), false);
  // untouched plates stay put
  const calm = resolveNameplates([{ x: 0, y: 0, w: 40, h: 10 }, { x: 0, y: 50, w: 40, h: 10 }]);
  assert.deepEqual(calm.map((p) => p.offY), [0, 0]);
  // a middle plate entangled with two placed neighbours moves clear
  const trio = resolveNameplates([
    { x: 0, y: 0, w: 40, h: 10 },
    { x: 0, y: 7, w: 40, h: 10 },   // overlaps both neighbours
    { x: 0, y: 15, w: 40, h: 10 },
  ]);
  const ys = trio.map((r, i) => [0, 7, 15][i] + r.offY).sort((a, b) => a - b);
  assert.ok(ys[1] - ys[0] >= 10 - 1e-9 && ys[2] - ys[1] >= 10 - 1e-9, `all three clear after the solve: ${ys}`);
  assert.equal(trio.some((p) => p.replaced), false);
  // five plates on one spot: two escape by the whole-height hop, the
  // rest surrender as "*" (:1365-1376)
  const five = resolveNameplates(Array.from({ length: 5 }, () => ({ x: 0, y: 100, w: 40, h: 10 })));
  assert.equal(five.filter((p) => p.replaced).length, 3);
});

test('c2/S10: ComputeZoom, the zoom band, the remembered level and the reset-on-new-location setting (window :1004-1015, :513-533)', () => {
  _resetForTests(); _resetZoomForTests();
  try {
    const w = new ExteriorAutomapWindow(deps('r:A'));
    assert.equal(w.cam.orthoSize, 64, 'ComputeZoom: ExteriorMapDefaultZoomLevel(8) x numMaxBlocks(8) x layoutMultiplier(1)');
    // OnPush ends at ActionFocusPlayerPosition (:544): the camera sits
    // on the player MARKER, which is DFU's own map-pixel modulo and not
    // the location-local position the A2 window used.
    assert.deepEqual(w.cam.center, [...playerMarkerLayoutPos([102.4, 0, 102.4]).slice(0, 1), 0, playerMarkerLayoutPos([102.4, 0, 102.4])[2]]);
    assert.equal(w.cam.yawDeg, 0);
    // ActionZoom is `orthographicSize += speed`, and the stairs buttons
    // ARE the zoom (:1135-1148) - one second of it is exactly zoomSpeed.
    w.runVerb('ActionMoveDownstairs', 1);
    assert.equal(w.cam.orthoSize, 64 + EXT_ZOOM_SPEED);
    w.runVerb('ActionMoveUpstairs', 1);
    assert.equal(w.cam.orthoSize, 64, 'and it is symmetric');
    for (let i = 0; i < 10; i++) w.runVerb('ActionMoveDownstairs', 1);
    assert.equal(w.cam.orthoSize, ZOOM_MAX, 'the far clamp (minZoom 250 - DFU names invert the meaning)');
    for (let i = 0; i < 10; i++) w.runVerb('ActionMoveUpstairs', 1);
    assert.equal(w.cam.orthoSize, ZOOM_MIN, 'the near clamp (maxZoom 25)');
    // the stairs' RIGHT button jumps the band's ends (:1166-1181)
    w.runVerb('ActionApplyMinZoom', 1);
    assert.equal(w.cam.orthoSize, ZOOM_MAX);
    w.runVerb('ActionApplyMaxZoom', 1);
    assert.equal(w.cam.orthoSize, ZOOM_MIN);
    w.tick(0);   // OnPop stores the level (:551)
    // reopen in the SAME location: the level is remembered
    assert.equal(new ExteriorAutomapWindow(deps('r:A')).cam.orthoSize, ZOOM_MIN);
    // a NEW location with the reset setting (default True) recomputes
    assert.equal(new ExteriorAutomapWindow(deps('r:B')).cam.orthoSize, 64);
    // with the reset setting off, the level carries across locations
    const b = new ExteriorAutomapWindow(deps('r:B'));
    b.runVerb('ActionMoveDownstairs', 1); b.tick(0);
    setValue('Map', 'ExteriorMapResetZoomLevelOnNewLocation', false);
    assert.equal(new ExteriorAutomapWindow(deps('r:C')).cam.orthoSize, 64 + EXT_ZOOM_SPEED);
    // view modes cycle original -> extra -> all -> original
    const v = new ExteriorAutomapWindow(deps('r:C'));
    assert.equal(v.mode, 'original');
    for (const mode of ['extra', 'all', VIEW_MODES[0]]) {
      v.runVerb('ActionSwitchToNextExteriorAutomapViewMode', 1);
      assert.equal(v.mode, mode);
    }
    // ActionMoveForward pans along the camera's UP at 100 units/SECOND
    const c0 = [...v.cam.center];
    v.runVerb('ActionMoveForward', 1);
    assert.equal(v.cam.center[2] - c0[2], EXT_SCROLL_UP_DOWN_SPEED, 'at yaw 0 forward is +z, at DFU\'s per-second speed');
    assert.equal(v.cam.center[0] - c0[0], 0);
    v.input('char:m');
    assert.equal(v.done, true, 'M closes, as the AutoMap binding toggles');
  } finally { _resetForTests(); _resetZoomForTests(); }
});

test('c2/S10: the screen transform - the camera lands on the panel centre at ANY yaw and zoom, and matches a hand-computed orthographic WorldToScreenPoint', () => {
  const rect = { x: 3, y: 3, w: 318 * 3, h: 169 * 3 };
  for (const yawDeg of [0, 37, 90, -145, 359]) {
    for (const orthoSize of [25, 64, 250]) {
      const cam = { center: [12.5, 0, -40.25], yawDeg, orthoSize };
      const [cx, cy] = toPanelScreen(cam, rect, cam.center[0], cam.center[2]);
      assert.ok(Math.abs(cx - (rect.x + rect.w / 2)) < 1e-9, `centre x at yaw ${yawDeg}`);
      assert.ok(Math.abs(cy - (rect.y + rect.h / 2)) < 1e-9, `centre y at yaw ${yawDeg}`);
    }
  }
  // Unity's WorldToScreenPoint for an ORTHOGRAPHIC camera is
  //   viewX = dot(p-c, right)/(orthoSize*aspect), viewY = dot(p-c, up)/orthoSize
  //   screen = centre + (viewX * w/2, viewY * h/2)
  // and with aspect = w/h both axes come out at h/(2*orthoSize) pixels
  // per world unit. Hand-computed here rather than restated.
  const cam = { center: [0, 0, 0], yawDeg: 90, orthoSize: 50 };
  const k = rect.h / (2 * 50);
  // at yaw 90 the camera's screen-right is world (cos90, -sin90) = (0,-1)
  // and its screen-up is (sin90, cos90) = (1, 0)
  const [sx, sy] = toPanelScreen(cam, rect, 10, 0);
  assert.ok(Math.abs(sx - (rect.x + rect.w / 2)) < 1e-9, 'world +x is edge-on to screen-right at yaw 90');
  assert.ok(Math.abs(sy - (rect.y + rect.h / 2 - 10 * k)) < 1e-9, 'and lands fully on screen-up');
  const [tx, ty] = toPanelScreen(cam, rect, 0, 10);
  assert.ok(Math.abs(tx - (rect.x + rect.w / 2 - 10 * k)) < 1e-9);
  assert.ok(Math.abs(ty - (rect.y + rect.h / 2)) < 1e-9);
  // a world point one unit east of the centre at yaw 0 is k pixels right
  const flat = { center: [0, 0, 0], yawDeg: 0, orthoSize: 50 };
  assert.ok(Math.abs(toPanelScreen(flat, rect, 1, 0)[0] - (rect.x + rect.w / 2 + k)) < 1e-9);
  assert.ok(Math.abs(toPanelScreen(flat, rect, 0, 1)[1] - (rect.y + rect.h / 2 - k)) < 1e-9, '+z is screen UP');
  // and the layout quad's turn is the same rotation in a y-DOWN screen
  assert.equal(layoutQuadRotation({ yawDeg: 90 }), -Math.PI / 2);
  assert.equal(Math.abs(layoutQuadRotation({ yawDeg: 0 })), 0);
});

test('c2/S10: the player marker is DFU\'s map-pixel modulo, custom-location offsets included (UpdatePlayerMarker :1379-1417)', () => {
  assert.equal(MARKER_TILE_SCALE, 32768 * 0.025, 'WorldMapTerrainDim x GlobalScale');
  assert.equal(MARKER_REF_SPAN, 512, 'blockSize 64 x numMaxBlocks 8 x layoutMultiplier 1 - NOT the location\'s own size');
  // dead centre of the map pixel is dead centre of the 512-unit reference
  const centre = playerMarkerLayoutPos([MARKER_TILE_SCALE / 2, 0, MARKER_TILE_SCALE / 2]);
  assert.ok(Math.abs(centre[0]) < 1e-9 && centre[1] === 0 && Math.abs(centre[2]) < 1e-9, `${centre}`);
  // the tile origin is the reference's south-west corner
  assert.deepEqual(playerMarkerLayoutPos([0, 0, 0]), [-256, 0, -256]);
  const q = playerMarkerLayoutPos([MARKER_TILE_SCALE * 0.25, 0, MARKER_TILE_SCALE * 0.75]);
  assert.ok(Math.abs(q[0] - (128 - 256)) < 1e-9);
  assert.ok(Math.abs(q[2] - (384 - 256)) < 1e-9);
  // the modulo wraps a position past one whole tile
  const wrapped = playerMarkerLayoutPos([MARKER_TILE_SCALE * 3.5, 0, MARKER_TILE_SCALE / 2]);
  const inside = playerMarkerLayoutPos([MARKER_TILE_SCALE * 0.5, 0, MARKER_TILE_SCALE / 2]);
  assert.ok(wrapped.every((v, i) => Math.abs(v - inside[i]) < 1e-9), `${wrapped} vs ${inside}`);
  // the custom-location correction: -64 on x, +3 on z, and ONLY there
  assert.deepEqual([...CUSTOM_LOCATION_OFFSET], [-64, 3]);
  const plain = playerMarkerLayoutPos([100, 0, 200], false);
  const cust = playerMarkerLayoutPos([100, 0, 200], true);
  assert.ok(Math.abs((cust[0] - plain[0]) - -64) < 1e-9);
  assert.ok(Math.abs((cust[2] - plain[2]) - 3) < 1e-9);
});

test('c2/S10: THE PAINT ORDER through a stub renderer - circle, stamp, layout, arrow (the see-through detail)', () => {
  _resetForTests(); _resetZoomForTests();
  try {
    const log = [];
    const r = stubRenderer(log);
    const w = new ExteriorAutomapWindow({ ...deps('r:paint'), arrowMesh: () => TRI_MESH });
    const canvas = { width: 320 * 3, height: 200 * 3 };
    w.draw(r, canvas, null, 3);
    // the four map layers are the quads drawn INSIDE the scissor
    const open = log.findIndex((l) => l.kind === 'scissor');
    const close = log.findIndex((l) => l.kind === 'unscissor');
    const layers = log.slice(open + 1, close).filter((l) => l.kind === 'quad');
    assert.equal(layers.length, 4, 'circle, stamp, layout, arrow - and nothing else inside the panel');
    // the CIRCLE and the STAMP come first, so they show through the
    // layout's transparent street pixels. That order IS the feature.
    assert.deepEqual([...layers[0].color], [0.75, 0.71, 0.71, 1], '1. the marker circle (:1646)');
    assert.deepEqual([...layers[1].color], [0.353, 0.086, 0.086, 1], '2. the dark stamp (:1624)');
    assert.equal(layers[2].tex, 'tex:amap:ext-1', '3. the layout bitmap');
    assert.deepEqual([...layers[3].color], [1, 1, 1, 1], '4. the arrow, over everything');
    // the layout is a ROTATED screen quad turning about its own centre
    assert.ok(layers[2].opts?.rotate, 'the rotate option is the one new GL of the stage');
    assert.equal(Math.abs(layers[2].opts.rotate.rad), 0, 'at yaw 0 it is unturned');
    assert.equal(layers[2].opts.rotate.px, layers[2].dst.x + layers[2].dst.w / 2, 'the pivot is the quad centre');
    // and the arrow and stamp carry the SAME map turn plus the player's
    assert.ok(layers[1].opts?.rotate && layers[3].opts?.rotate);
    // NOTHING here asks for the mesh path's handedness mirror
    assert.equal(log.some((l) => 'mirrorProjectionX' in (l.opts ?? {})), false);
    // the scissor bracket clips the map to dummyPanelAutomap (:335-336)
    assert.deepEqual(log[open].rect, { x: 3, y: 3, w: 318 * 3, h: 169 * 3 });
    // ...and a rotated map keeps the same four layers in the same order
    log.length = 0;
    w.cam = { ...w.cam, yawDeg: 42 };
    w.draw(r, canvas, null, 3);
    const o2 = log.findIndex((l) => l.kind === 'scissor');
    const c2 = log.findIndex((l) => l.kind === 'unscissor');
    const turned = log.slice(o2 + 1, c2).filter((l) => l.kind === 'quad');
    assert.equal(turned.length, 4);
    assert.deepEqual([...turned[0].color], [0.75, 0.71, 0.71, 1]);
    assert.ok(Math.abs(turned[2].opts.rotate.rad - (-42 * Math.PI / 180)) < 1e-12,
      'the layout turns by -yaw, because the screen y axis points DOWN');
  } finally { _resetForTests(); _resetZoomForTests(); }
});

test('c2/S10: the four backgrounds - "original" draws NO fill, and the three alternatives are the EXTERIOR window\'s own (:283-327)', () => {
  assert.equal(BACKGROUNDS.original, null, 'AMAP00I0\'s own map-area art shows through');
  assert.deepEqual([...BACKGROUNDS.alt1], [0, 0, 0, 1]);
  assert.deepEqual([...BACKGROUNDS.alt2], [0.2, 0.1, 0.3, 1]);
  // NOT the dungeon window's third - the exterior's is the gold
  assert.deepEqual([...BACKGROUNDS.alt3], [0.7, 0.52, 0.18, 1]);
  _resetForTests(); _resetZoomForTests();
  try {
    const log = [];
    const r = stubRenderer(log);
    const w = new ExteriorAutomapWindow(deps('r:bg'));
    const canvas = { width: 320 * 3, height: 200 * 3 };
    const isPanelFill = (l) => l.kind === 'quad' && l.tex === null && l.dst.w === 318 * 3 && l.dst.h === 169 * 3;
    w.draw(r, canvas, null, 3);
    assert.equal(log.some(isPanelFill), false, 'the original arm fills nothing at all');
    log.length = 0;
    w.input('char:9');
    assert.equal(w.background, 'alt2');
    w.draw(r, canvas, null, 3);
    const fill = log.find(isPanelFill);
    assert.ok(fill, 'an alternative fills the panel rect');
    assert.deepEqual([...fill.color], [0.2, 0.1, 0.3, 1]);
    w.input('char:7');
    assert.equal(w.background, 'original', 'and the original key comes back');
  } finally { _resetForTests(); _resetZoomForTests(); }
});

test('c2/S10: the four border jumps move ONE axis each (GetLocationBorderPos :347-368, window :1184-1220)', () => {
  _resetForTests(); _resetZoomForTests();
  try {
    const w = new ExteriorAutomapWindow(deps('r:border'));   // 2x2 blocks = 128 x 128 layout px
    w.cam = { ...w.cam, center: [7, 0, -9] };
    w.runVerb('ActionMoveToNorthLocationBorder', 1);
    assert.deepEqual(w.cam.center, [7, 0, +64], 'north sets z alone, at half the layout height');
    w.runVerb('ActionMoveToSouthLocationBorder', 1);
    assert.deepEqual(w.cam.center, [7, 0, -64]);
    w.runVerb('ActionMoveToWestLocationBorder', 1);
    assert.deepEqual(w.cam.center, [-64, 0, -64], 'west sets x alone, and z stays where the last jump left it');
    w.runVerb('ActionMoveToEastLocationBorder', 1);
    assert.deepEqual(w.cam.center, [+64, 0, -64]);
  } finally { _resetForTests(); _resetZoomForTests(); }
});

test('c2/S10: the caption strip and its three swatches are STRIP-LOCAL (window :271-273, :466-476)', () => {
  assert.deepEqual({ ...CAPTION_STRIP }, { x: 0, y: 190, w: 320, h: 10 });
  assert.deepEqual({ ...CAPTION_SWATCHES.temple }, { x: 97, y: 2, w: 5, h: 5 });
  assert.deepEqual({ ...CAPTION_SWATCHES.shop }, { x: 141, y: 2, w: 5, h: 5 });
  assert.deepEqual({ ...CAPTION_SWATCHES.tavern }, { x: 183, y: 2, w: 5, h: 5 });
});

test('c2/S10: the mesh stamp rasteriser, pixel for pixel, on a synthetic mesh', () => {
  // ONE triangle covering the lower-left half of a unit square in XZ,
  // seen from above: x east, z north, and +z lands at the TOP row
  const mesh = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
  };
  const bmp = rasterizeTopDown(mesh, 8, { pad: 0 });
  assert.equal(bmp.width, 8);
  assert.equal(bmp.height, 8);
  assert.equal(bmp.span, 1, 'the fitted XZ span');
  assert.equal(bmp.worldPerPx, 1 / 8, 'so the whole bitmap covers exactly the span');
  const px = (x, y) => bmp.colors[y * 8 + x] >>> 0;
  assert.equal(px(0, 0), STAMP_INK >>> 0, '+z is the TOP row - the north-west vertex is drawn');
  assert.equal(px(7, 0), 0, 'the north-east corner is outside the hypotenuse');
  assert.equal(px(0, 7), STAMP_INK >>> 0, 'the south-west corner is inside');
  assert.equal(px(7, 7), STAMP_INK >>> 0, 'and so is the south-east');
  // row y (from the top) holds exactly y+1 inked pixels
  for (let y = 0; y < 8; y++) {
    const inked = [...Array(8).keys()].filter((x) => px(x, y) !== 0).length;
    assert.equal(inked, y + 1, `row ${y}`);
  }
  // a two-triangle quad fills the WHOLE square
  const quad = rasterizeTopDown(TRI_MESH, 8, { pad: 0 });
  assert.equal(quad.colors.every((c) => (c >>> 0) === (STAMP_INK >>> 0)), true);
  // a degenerate or absent mesh rasterises to nothing rather than throwing
  const none = rasterizeTopDown(null, 4);
  assert.equal(none.span, 0);
  assert.equal(none.colors.every((c) => c === 0), true);
  // and the circle really is a disc
  const disc = rasterizeDisc(8);
  assert.equal(disc.colors[0], 0, 'the corner is outside');
  assert.notEqual(disc.colors[4 * 8 + 4], 0, 'the centre is inside');
});

test('c2/S10 HALF B: the plate ANCHOR is the building subrecord\'s own Position (ExteriorAutomap.cs:664-665)', () => {
  // a subrecord dead centre of its own 4096-unit block
  assert.deepEqual(nameplateAnchor(0, 0, buildingPosition({ xPos: 2048, zPos: 2048 })), [32, 32]);
  // the block's grid cell is layout.rect.xpos/ypos = the cell x 64
  assert.deepEqual(nameplateAnchor(2, 3, buildingPosition({ xPos: 2048, zPos: 2048 })), [2 * 64 + 32, 3 * 64 + 32]);
  // Position.z is RMBDimension - ZPos (RMBLayout.cs:570), so ZPos 0 is
  // the block's NORTH edge
  assert.deepEqual(nameplateAnchor(0, 0, buildingPosition({ xPos: 0, zPos: 0 })), [0, 64]);
  assert.deepEqual(nameplateAnchor(0, 0, buildingPosition({ xPos: 0, zPos: 4096 })), [0, 0]);
  // the cast is C#'s (int) - TRUNCATION, not a floor: 4095/4096*64 is
  // 63.98..., which lands on 63
  assert.deepEqual(nameplateAnchor(0, 0, buildingPosition({ xPos: 4095, zPos: 4096 })), [63, 0]);
  // and the walk itself keys and places EVERY building of EVERY block
  const rows = buildingSummaries(
    [{ buildingType: 9, nameSeed: 1, factionId: 0, quality: 10 }], [FAKE_BLOCK], { locationName: 'T', regionName: 'R' });
  assert.equal(rows.length, 2, 'BOTH subrecords - not just the one an exterior door reaches');
  assert.deepEqual(rows.map((b) => b.blockX), [1, 1]);
  assert.deepEqual(rows.map((b) => b.recordIndex), [0, 1]);
  assert.deepEqual(rows[0].position, [2048 * 0.025, 0, (4096 - 1024) * 0.025]);
  assert.equal(rows[0].isResidence, false);
  assert.equal(rows[1].isResidence, true, 'House1 is a residence - the plate arm gates on it');
  assert.notEqual(rows[0].buildingKey, rows[1].buildingKey);
});

test('c2/S10 HALF B: the plates - the discovery gate, the residence arm, the rename, and axis-aligned corners at a non-zero yaw', () => {
  _resetForTests(); _resetZoomForTests();
  restoreDiscovery(null);
  try {
    const summaries = buildingSummaries(
      [{ buildingType: 9, nameSeed: 1, factionId: 0, quality: 10 }], [FAKE_BLOCK], {});
    const shop = summaries[0], house = summaries[1];
    const renames = [];
    const w = new ExteriorAutomapWindow({
      ...deps('r:plate'),
      buildings: () => summaries,
      discovered: () => discoveredBuildings('r:plate'),
      rename: (k, n) => renames.push([k, n]),
    });
    const m = { s: 3, ox: 0, oy: 0 };
    // UNDISCOVERED: no plate at all - the default name is "" (:670) and
    // an empty name never becomes a nameplate (:786)
    assert.deepEqual(w.buildPlates(FONT, m), []);
    // ...unless revealUndiscoveredBuildings, which names them off the
    // BuildingNames table (:711-719, map_revealbuildings)
    w.revealUndiscoveredBuildings = true;
    // ...and note it is ONE, not two: BuildingNames.GetName answers the
    // EMPTY STRING for a residence, and an empty name never becomes a
    // nameplate (:786). DFU's own reveal command shows named buildings
    // only, for exactly that reason.
    assert.equal(w.buildPlates(FONT, m).length, 1);
    w.revealUndiscoveredBuildings = false;
    // DISCOVERED non-residence: its displayName
    discoverBuilding('r:plate', { buildingKey: shop.buildingKey, name: 'The Odd Blades', buildingType: 9 });
    let plates = w.buildPlates(FONT, m);
    assert.equal(plates.length, 1, 'the discovered shop, and NOT the residence beside it');
    assert.equal(plates[0].text, 'The Odd Blades');
    // DISCOVERED residence: still silent, because no quest marked it
    discoverBuilding('r:plate', { buildingKey: house.buildingKey, name: 'House', buildingType: 17 });
    assert.equal(w.buildPlates(FONT, m).length, 1,
      'a residence shows a plate only when an active quest marked it (:682-709)');
    // THE RENAME: the custom name is DRAWN and the tooltip keeps the
    // canonical one (:880-885), and it rides the save envelope
    assert.equal(setDiscoveredBuildingCustomName('r:plate', shop.buildingKey, '  My Smith  '), true);
    plates = w.buildPlates(FONT, m);
    assert.equal(plates[0].text, 'My Smith', 'trimmed, and drawn in the label\'s place');
    assert.equal(plates[0].name, 'The Odd Blades', 'the tooltip keeps the canonical name');
    restoreDiscovery(snapshotDiscovery());
    assert.equal(w.buildPlates(FONT, m)[0].text, 'My Smith', 'and it survives a save round trip');
    // a rename of a building that is NOT discovered changes nothing
    assert.equal(setDiscoveredBuildingCustomName('r:plate', 999999, 'nope'), false);
    // THE CORNERS STAY AXIS-ALIGNED at a non-zero yaw: what reaches the
    // solver is still (x, y, w, h) with no rotated corner vectors, and
    // the box keeps its size however the map is turned.
    w.cam = { ...w.cam, yawDeg: 61 };
    const turned = w.buildPlates(FONT, m);
    assert.equal(turned.length, 1);
    assert.deepEqual(Object.keys(turned[0]).filter((k) => /corner/i.test(k)), [],
      'no rotated corner vectors reach the solver - RotateBuildingNameplates is dead in DFU');
    assert.equal(turned[0].w, plates[0].w);
    assert.equal(turned[0].h, plates[0].h);
    // ...but the plate really did MOVE with the turn
    assert.notEqual(turned[0].x, plates[0].x);
    // the residence refuses the rename gesture entirely (:876-878)
    w._hoverPlate = { buildingKey: house.buildingKey, name: 'House', isResidence: true };
    w._renameAt(0, 0);
    assert.deepEqual(renames, [], 'a residence cannot be renamed - its name is quest-generated and temporary');
    w._hoverPlate = { buildingKey: shop.buildingKey, name: 'The Odd Blades', isResidence: false };
    w._renameAt(0, 0);
    assert.deepEqual(renames, [[shop.buildingKey, 'The Odd Blades']],
      'and the prompt is pre-filled with the CANONICAL name, never the custom one');
  } finally { _resetForTests(); _resetZoomForTests(); restoreDiscovery(null); }
});

test('A2 wiring pins: the M-outside dispatch in both exterior hosts, gated on a location (DaggerfallUI.cs:633-650)', () => {
  // I2: the dispatch reads the ACTION, not the raw code - M is its
  // registry default (inputActions ResetDefaults :1027) and rebinding
  // it moves the town map with it, as DFU's does.
  // U43 collapsed the per-arm guards into ONE gate per host - the
  // ladder and the large HUD's panels now open the same windows
  // through one hudCtx - so the pin follows the law to its new shape
  // rather than to the line it used to sit on. The gate and the arm
  // are checked separately, and the arm must be INSIDE the gate.
  const GATE = "if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {";
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = src(host);
    const g = h.indexOf(GATE);
    assert.ok(g > 0, `${host}: the ladder is gated once, on the overlay AND the mode`);
    const arm = h.indexOf("if (act === 'AutoMap') { hudCtx.toggleAutomap(); return; }");
    assert.ok(arm > g, `${host}: and M-outside sits inside that gate`);
  }
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(!dfLoc \|\| !b\?\.locBlocks \|\| !b\.locOrigin\) return;/, 'empty wilderness opens nothing');
  const e = src('src/scenes/exterior.js');
  assert.match(e, /new ExteriorAutomapWindow\(/);
  assert.match(src('src/systems/inputActions.js'), /\['KeyM', 'AutoMap'\]/, 'and M is that action\'s default');
});

test('A2 review: every townTalk overlay drop frees the occupant (the A1 death-presenter lesson on THIS slot)', () => {
  // uploadTexture memoizes forever, so a window replaced or dropped
  // without dispose leaks its texture AND leaves a live cache key -
  // the exact A1 bug, one slot over. All four clear-points covered.
  // THE FOUR CLEAR-POINTS BECAME ONE at the 2026-08-29 recursion fix
  // (townTalk.dropOverlay), so this reads the seam and then checks that
  // every drop still goes through it - which is strictly stronger than
  // the four literals it replaces: those could only fail for the four
  // sites they named, and a FIFTH drop added tomorrow passed them all.
  const t = src('src/scenes/townTalk.js');
  const seam = t.match(/function dropOverlay\([\s\S]*?\n {2}}/)?.[0] ?? '';
  assert.ok(seam.includes('win.dispose?.()'), 'the one drain frees the occupant');
  assert.match(t, /outgoing\?\.dispose\?\.\(\);/, 'showOverlay frees what it replaces');
  // Nothing else in the module may dispose the slot - a drop that
  // sidesteps the seam is both a leak and a way back into the crash.
  const strays = [...t.matchAll(/^.*\boverlay\??\.dispose\?\.\(\).*$/gm)].map((m) => m[0].trim());
  assert.deepEqual(strays, [], `a drop bypasses dropOverlay:\n  ${strays.join('\n  ')}`);
  for (const site of ['if (overlay?.done) dropOverlay();', 'dropOverlay(false)'])
    assert.ok(t.includes(site), `a clear-point stopped going through the seam: ${site}`);
  // and the exterior window really exposes one - which now frees THREE
  // uploaded textures (the layout, the mesh stamp and the disc)
  const w = src('src/ui/exteriorAutomapWindow.js');
  assert.match(w, /dispose\(\) \{/);
  assert.equal((w.match(/releaseTexture\('amap'/g) ?? []).length >= 3, true);
});

test('c2/S10 SOURCE PINS: the rotate option is the only new GL, the chrome is the SHARED module, and the release really is routed', () => {
  const r = src('src/render/renderer.js');
  assert.match(r, /uniform vec4 uRot;/, 'the screen quad gained ONE uniform pair');
  assert.match(r, /if \(uRotOn == 1\) \{/);
  // it must NOT be wired to the mesh path's handedness mirror
  const vs = r.slice(r.indexOf('uniform vec4 uRot;'), r.indexOf('vec2 ndc = vec2(px.x'))
    .replace(/^\s*\/\/.*$/gm, '');   // the comment SAYS mirrorProjectionX; the CODE must not use one
  assert.equal(/mirror/i.test(vs), false, 'screen quads run with culling disabled - no mirrorProjectionX');
  assert.equal(/mirrorProjectionX/.test(src('src/ui/exteriorAutomapWindow.js')), false,
    'and the window never builds a mirrored projection either - it has no mesh pass at all');
  // the scissor-only bracket lives in the RENDERER (EV6's law), and it
  // clears in a finally so a throwing body cannot leak SCISSOR_TEST -
  // which silently blanks the NEXT host frame's clear
  assert.match(r, /screenScissor\(rect, body\) \{/);
  assert.match(r, /try \{ return body\(\); \} finally \{ this\.clearScreenScissor\(\); \}/);
  const w = src('src/ui/exteriorAutomapWindow.js');
  assert.equal(/renderer\.setScreenScissor\(/.test(w), false, 'the window never sets the scissor itself');
  assert.match(w, /from '\.\/automapChrome\.js'/, 'ONE chrome module, two tables');
  assert.match(w, /EXTERIOR_ACTIONS/, 'and the exterior table is this window\'s');
  // no rotated nameplate corners anywhere in the arc. The headers NAME
  // RotateBuildingNameplates to record that it is dead; the CODE must
  // not carry it, so the comments come out before the check.
  const bare = (f) => src(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/upperLeftCorner|AngleAxis|RotateBuildingNameplates/.test(bare('src/ui/exteriorAutomapWindow.js') + bare('src/ui/nameplateLayout.js')), false,
    'RotateBuildingNameplates\' corner rotation is dead code in DFU and is not ported');
  // the three pointer phases reach the slot exactly ONCE each: down on
  // pointerdown, move on hover, up on the window listener. A press
  // delivered twice would arm the press-hold machine twice.
  const t = src('src/scenes/townTalk.js');
  assert.match(t, /function pointer\(phase, e\) \{/);
  assert.match(t, /if \(overlay\.pointer\) overlay\.pointer\('down', v\[0\], v\[1\], e\.button \?\? 0\);\n\s*else overlay\.click/,
    'a window with the three-phase seam never takes the press through click as well');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(host), /townTalk\.pointer\('up', e\)/, `${host} routes the release`);
  }
});

test('A2 grayscale pins: the shader law and the two-tier dungeon pass (DaggerfallAutomap.shader:102-110)', () => {
  const r = src('src/render/renderer.js');
  assert.match(r, /1\.0 - clamp\(sliceDist \/ 20\.0, 0\.0, 0\.6\)/, 'the slice-distance dim, floored at 40%');
  assert.match(r, /dot\(outColor\.rgb, vec3\(0\.3, 0\.59, 0\.11\)\)/, 'the luminance weights digit for digit');
  assert.match(r, /setAutomapMode\(m\) \{/, 'the immediate-upload setter');
  const aw = src('src/ui/automapWindow.js');
  // c2/S6 named the six presentations and moved the two-tier split
  // into _partitionDraws, so the LAW reads through the names now - the
  // draw groups are still issued colour-then-grayscale, and the
  // prior-run predicate is still "revealed but not visited this run".
  assert.match(aw, /AUTOMAP_MODE\.BELOW_COLOUR\);[\s\S]{0,400}AUTOMAP_MODE\.BELOW_GRAY\);/, 'visited draws colour, prior-run grayscale');
  // RE-BASELINED at ROAD-C c2/S8: DFU's two bits are INDEPENDENT -
  // MeshRenderer.enabled says drawn, RENDER_IN_GRAYSCALE says which
  // tier - and HideAll (Automap.cs:2450-2464) clears the first without
  // touching the second, so `revealed` had to become the gate and the
  // tier a choice made inside it. Both halves are pinned, because
  // collapsing them back into one conditional is exactly the mistake.
  assert.match(aw, /if \(!rec\.revealed\.has\(key\)\) return;/, 'revealed IS the draw gate (MeshRenderer.enabled)');
  // RE-BASELINED at ROAD-C c2/S9: `run` is NULL inside a building, which
  // is the always-colour law (AutomapModel.cs:46-72 passes
  // visitedInThisEntering = playerIsInsideBuilding), so the predicate
  // reads through that arm. Both halves stay pinned.
  assert.match(aw, /const run = this\.deps\.insideBuilding \? null : rec\.visitedThisRun;/, 'inside a building there is no prior-run tier');
  assert.match(aw, /const row = \(run === null \|\| run\.has\(key\)\) \? visited : prior;/, 'the prior-run predicate (RENDER_IN_GRAYSCALE)');
  assert.match(aw, /setClipY\(null\);\n\s*renderer\.setAutomapMode\(AUTOMAP_MODE\.OFF\);/, 'beacons ride neither the slice nor the tint');
  // PIN MOVED, ROAD-C c2/S2: the automap mode is one of the globals
  // renderer.panelFrame saves and returns in its own finally, so the
  // window's hand-rolled restore list is gone. The throwing-body
  // proof lives in test/roadc_panelframe.test.js, where it runs
  // against the bracket instead of against this file's text.
  assert.match(aw, /renderer\.panelFrame\(\{/, 'the pass runs inside the renderer\'s bracket');
  assert.match(src('src/render/renderer.js'), /automapMode: this\._automapMode,/, 'and the bracket saves the mode by name');
  assert.match(src('src/render/renderer.js'), /this\.setAutomapMode\(s\.automapMode\);/, 'and hands it back');
});
