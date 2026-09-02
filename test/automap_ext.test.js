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
  EXT_HOTKEYS_DOWN, EXT_HOTKEYS_HELD, EXT_HOTKEY_VERBS, EXT_BACKGROUND_HOTKEYS,
  residenceQuestName, stampResidenceQuestNames,
} from '../src/ui/exteriorAutomapWindow.js';
import { EXTERIOR_AUTOMAP_STRINGS, exteriorAutomapTooltipFor } from '../src/ui/automapText.js';
import { TopicTree, QUEST_INFO_RESOURCE_TYPE, BUILDING_HINT_TYPE } from '../src/systems/topicTree.js';
import { shortcutBinding, sequenceString } from '../src/systems/dialogShortcuts.js';
import { nameplatesIntersect, resolveNameplates, nameplateAnchor } from '../src/ui/nameplateLayout.js';
import { CAPTION_STRIP, CAPTION_SWATCHES, CHROME_RECTS } from '../src/ui/automapChrome.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { EXT_ZOOM_SPEED, EXT_SCROLL_UP_DOWN_SPEED } from '../src/ui/automapCamera.js';
import { rasterizeTopDown, rasterizeDisc, STAMP_INK } from '../src/ui/meshStamp.js';
import { measureText } from '../src/ui/text.js';
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
    // THE TOGGLE-CLOSE IS TWO-PHASE (:586-597): the AutoMap binding's
    // key DOWN only raises the latch, and the close lands where DFU's
    // key UP would be - so the press that opened the map cannot also
    // close it on the same frame.
    v.input(v.automapBinding, { code: v.automapBinding });
    assert.equal(v.done, false, 'the down raises isCloseWindowDeferred and nothing else');
    assert.equal(v.isCloseWindowDeferred, true);
    v.tick(1 / 60);
    assert.equal(v.done, true, 'M closes on the LATER frame, as the AutoMap binding toggles');
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
    // the four keys are DFU'S OWN - F5/F6/F7/F8, read out of the
    // ExtAutomap rows of DialogShortcuts.txt:273-276 rather than
    // spelled as literals here
    const bgKey = (button) => shortcutBinding(button).code;
    assert.deepEqual(
      EXT_HOTKEYS_DOWN.filter((b) => EXT_BACKGROUND_HOTKEYS[b]).map(bgKey),
      ['F5', 'F6', 'F7', 'F8'],
    );
    w.input(bgKey('ExtAutomapSwitchToExteriorAutomapBackgroundAlternative2'),
      { code: bgKey('ExtAutomapSwitchToExteriorAutomapBackgroundAlternative2') });
    assert.equal(w.background, 'alt2');
    w.draw(r, canvas, null, 3);
    const fill = log.find(isPanelFill);
    assert.ok(fill, 'an alternative fills the panel rect');
    assert.deepEqual([...fill.color], [0.2, 0.1, 0.3, 1]);
    w.input('F5', { code: 'F5' });
    assert.equal(w.background, 'original', 'and the original key comes back');
    // ...and A2's invented digits are gone: 7/8/9/0 do nothing at all
    for (const ch of ['char:7', 'char:8', 'char:9', 'char:0']) w.input(ch, null);
    assert.equal(w.background, 'original', 'the invented digit table is dead');
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
    // THE PROMPT OPENS ON THE NAME THE PLAYER IS LOOKING AT. DFU fills
    // the box's EDITABLE text from the label - `mb.TextBox.Text =
    // renamingLabelRef.Text` (ExteriorAutomap.cs:888), which
    // DaggerfallExteriorAutomapWindow.cs:882-885 set to the custom name
    // whenever one exists - and keeps the canonical only as
    // TextBox.Name/DefaultText (:887, :889), the fallback for an
    // emptied box (:923). The hover plate is the REAL row, which
    // carries both, so the pin cannot pass by reading a fixture that
    // only has one of them.
    w._hoverPlate = turned[0];
    assert.equal(turned[0].text, 'My Smith');
    assert.equal(turned[0].name, 'The Odd Blades');
    w._renameAt(0, 0);
    assert.deepEqual(renames, [[shop.buildingKey, 'My Smith']],
      'the box is pre-filled with the DISPLAYED name - confirming it unchanged must not revert the rename');
    // ...and with no custom name the label's Text IS the canonical, so
    // that is what the box opens on
    assert.equal(setDiscoveredBuildingCustomName('r:plate', shop.buildingKey, ''), true);
    w._hoverPlate = w.buildPlates(FONT, m)[0];
    w._renameAt(0, 0);
    assert.deepEqual(renames[1], [shop.buildingKey, 'The Odd Blades'],
      'an un-renamed building still opens on its canonical name');
  } finally { _resetForTests(); _resetZoomForTests(); restoreDiscovery(null); }
});

test('c2/S10 REVIEW: the rename push must not LATCH the panel drag - the uncovered map comes back released (BaseScreenComponent.cs:642-648)', () => {
  _resetForTests(); _resetZoomForTests();
  restoreDiscovery(null);
  try {
    const summaries = buildingSummaries(
      [{ buildingType: 9, nameSeed: 1, factionId: 0, quality: 10 }], [FAKE_BLOCK], {});
    const shop = summaries[0];
    discoverBuilding('r:latch', { buildingKey: shop.buildingKey, name: 'The Odd Blades', buildingType: 9 });
    const pushes = [];
    const w = new ExteriorAutomapWindow({
      ...deps('r:latch'),
      buildings: () => summaries,
      discovered: () => discoveredBuildings('r:latch'),
      rename: (k, n) => pushes.push([k, n]),
    });
    w._hoverPlate = w.buildPlates(FONT, { s: 1, ox: 0, oy: 0 })[0];
    // the double click is a press ON THE RENDER PANEL, so it arms the
    // pan drag beside the rename - in DFU too (the nameplate label is a
    // CHILD of panelRenderAutomap, so PanelAutomap_OnMouseDown fires as
    // well, window :1332-1341)
    const P = CHROME_RECTS.panel;
    const nx = P.x + 100, ny = P.y + 40;
    w.pointer('down', nx, ny, 0);
    w.pointer('up', nx, ny, 0);
    w.pointer('down', nx, ny, 0);
    assert.deepEqual(pushes, [[shop.buildingKey, 'The Odd Blades']], 'the double click pushed the rename box');
    assert.equal(w.chrome.inDragMode(), true, 'and that press armed the pan drag, exactly as DFU\'s does');
    // THE RELEASE NEVER COMES BACK. townTalk.pointer('up') bails at
    // `if (!overlay?.pointer) return false` because the slot now holds
    // the ServiceFlowWindow, which has no pointer seam - so what must
    // clear the latch is OnReturn, fired on the window the pop
    // uncovers (windowStack.js's RemoveWindow). DFU needs no such hook
    // because its release is polled off the button STATE and lands on
    // the first frame after the box pops.
    assert.match(src('src/ui/windowStack.js'), /const t = top\(\);\n\s*if \(t\) t\.onReturn\?\.\(\);/,
      'the uncovered window really is told');
    assert.equal(/function pointer\(phase, e\) \{\n\s*if \(!overlay\?\.pointer\) return false;/.test(src('src/scenes/townTalk.js')), true,
      'and the release cannot reach a covered window - hence the hook');
    w.onReturn();
    assert.equal(w.chrome.inDragMode(), false, 'the map is released the moment it is uncovered');
    const before = [...w.cam.center];
    w.hover(nx + 20, ny + 8);
    assert.deepEqual([...w.cam.center], before, 'a bare mouse move over the returned map does not pan it');
    // ...and the very next chrome press is not swallowed by
    // `if (this.inDragMode()) return out`
    const G = CHROME_RECTS.grid;
    w.pointer('down', G.x + 2, G.y + 2, 0);
    w.pointer('up', G.x + 2, G.y + 2, 0);
    assert.equal(w.mode, VIEW_MODES[1], 'the grid button answers the FIRST press after the rename');
  } finally { _resetForTests(); _resetZoomForTests(); restoreDiscovery(null); }
});

test('c2/S10 REVIEW: ONE compass drawer (hud.js) at COMPBOX\'s own 69x17, and the plate tooltip is toolTip.js\'s box in DFU\'s two GUI colours', () => {
  _resetForTests(); _resetZoomForTests();
  restoreDiscovery(null);
  try {
    const summaries = buildingSummaries(
      [{ buildingType: 9, nameSeed: 1, factionId: 0, quality: 10 }], [FAKE_BLOCK], {});
    const shop = summaries[0];
    discoverBuilding('r:chrome', { buildingKey: shop.buildingKey, name: 'The Odd Blades', buildingType: 9 });
    // the two colours DFU assigns the nameplate tooltip by hand
    // (window :874-875), and the master switch OFF - DFU's
    // nameplateToolTip is a bare `new ToolTip()` (:870-871) drawn
    // unconditionally (:571-572), so it is not gated by EnableToolTips
    setValue('GUI', 'EnableToolTips', false);
    setValue('GUI', 'ToolTipBackgroundColor', '102030C0');
    setValue('GUI', 'ToolTipTextColor', 'FFEE00FF');
    const log = [];
    const r = stubRenderer(log);
    const F = { ...FONT, tex: 'atlas' };
    const w = new ExteriorAutomapWindow({
      ...deps('r:chrome'),
      compassArt: { compass: { tex: 'COMPASS', w: 322, h: 13 }, compassBox: { tex: 'COMPBOX', w: 69, h: 17 } },
      buildings: () => summaries,
      discovered: () => discoveredBuildings('r:chrome'),
    });
    // park the plate's anchor dead centre of the render panel, so the
    // hover point is exact: anchor (96,48) minus half the 128x128 layout
    w.cam = { ...w.cam, center: [32, 0, -16] };
    // a 320x200 canvas puts nativeMetrics at scale 1 - every recorded
    // rect IS a native rect
    const canvas = { width: 320, height: 200 };
    w.hover(161, 85);   // over the plate, which sits at the panel centre
    w.draw(r, canvas, F, 1);
    const quads = log.filter((l) => l.kind === 'quad');

    // THE COMPASS: dummyPanelCompass gives the POSITION alone (:456
    // `compass.Position = dummyPanelCompass.Rectangle.position`), and
    // HUDCompass sizes the frame from the ART (HUDCompass.cs:132-135) -
    // COMPBOX.IMG is 69x17, NOT the dummy panel's 76x17 (:433).
    const box = quads.find((q) => q.tex === 'COMPBOX');
    assert.ok(box, 'the compass frame drew');
    assert.deepEqual([box.dst.x, box.dst.y, box.dst.w, box.dst.h], [3, 172, 69, 17],
      'the ART\'s size at the dummy panel\'s position - the same rect the dungeon window and the HUD draw');
    const strip = quads.find((q) => q.tex === 'COMPASS');
    assert.deepEqual([strip.dst.x, strip.dst.y, strip.dst.w], [5, 174, 65],
      'the strip window is the box inset by the 2px outline, so 69-4 - never 76-4');
    // and it is the SHARED drawer, not a second home for the scroll law
    const wsrc = src('src/ui/exteriorAutomapWindow.js');
    assert.match(wsrc, /import \{ drawCompassStrip \} from '\.\/hud\.js';/);
    assert.equal(/compassScroll|COMPASS_BOX_OUTLINE|COMPASS_BOX_INTERIOR/.test(wsrc), false,
      'the scroll law and the outline inset live in hud.js and nowhere else');

    // THE PLATE TOOLTIP: ToolTip.Draw's own box (ToolTip.cs:158-179) at
    // the CURSOR plus MouseOffset (0,4) - not at the plate - sized
    // widest+4 by glyph*rows+3, in the two settings colours.
    const bg = [0x10 / 255, 0x20 / 255, 0x30 / 255, 0xc0 / 255];
    const tip = quads.find((q) => q.tex === null && q.color && q.color.length === 4
      && Math.abs(q.color[0] - bg[0]) < 1e-9 && Math.abs(q.color[3] - bg[3]) < 1e-9);
    assert.ok(tip, 'the tooltip drew with tooltips DISABLED - DFU\'s nameplate tooltip is not gated');
    const tw = measureText(F.fnt, 'The Odd Blades') + 4;
    assert.deepEqual([tip.dst.x, tip.dst.y, tip.dst.w, tip.dst.h], [161, 89, tw, 9],
      'cursor + MouseOffset(0,4), widest + 2*margin by glyph*rows + 2*margin - 1');
    const fg = [1, 0xee / 255, 0, 1];
    const glyphs = quads.filter((q) => q.tex === 'atlas' && q.color && Math.abs(q.color[1] - fg[1]) < 1e-9);
    assert.ok(glyphs.length > 0, 'and the text takes GUI/ToolTipTextColor');
    assert.equal(glyphs[0].dst.y, 89 + 2, 'inset by the 2px top margin');
    assert.equal(glyphs.every((g) => g.color[0] === 1 && g.color[2] === 0), true);
    // the canonical name, never the drawn custom one (:878)
    assert.equal(setDiscoveredBuildingCustomName('r:chrome', shop.buildingKey, 'My Smith'), true);
    log.length = 0;
    w.hover(161, 85);
    w.draw(r, canvas, F, 1);
    const tip2 = log.filter((l) => l.kind === 'quad').find((q) => q.tex === null && q.color
      && Math.abs(q.color[3] - bg[3]) < 1e-9);
    assert.equal(tip2.dst.w, tw, 'the tooltip still measures the CANONICAL name');
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

// ── ROAD-C c2 flight-2 review fixes ──────────────────────────────────

test('c2/S10 THE ROTATION SIGN, from ExteriorAutomap.cs\'s camera math: rotate-LEFT turns the town counter-clockwise, and rotate-around-player PINS the marker', () => {
  // THE HAND-COMPUTED DFU VALUE. The camera is Quaternion.Euler(90,0,0)
  // (:1031); ActionRotateLeft is ActionRotate(+rotateSpeed) (:1088-1091)
  // and ActionRotate is RotateAround(pos, -Vector3.up, -amount*dt)
  // (:1103). Unity's AngleAxis(A, -up) == AngleAxis(-A, +up), so the
  // world turn applied is Ry(+amount*dt) and the camera's euler-y is
  // +150 after one second of rotateSpeed 150. Under Euler(90, 150, 0)
  // the camera's right is (cos150, 0, -sin150) and its up is
  // (sin150, 0, cos150) - toPanelScreen's own basis - so world NORTH
  // (+z, distance d) lands at
  //     sx = -sin(150 deg) * d = -0.5 d       (panel LEFT of centre)
  //     sy =  cos(150 deg) * d = -0.866 d     (and BELOW it)
  _resetForTests(); _resetZoomForTests();
  try {
    const w = new ExteriorAutomapWindow(deps('r:rot'));
    w.cam = { ...w.cam, center: [0, 0, 0], orthoSize: 100 };
    w.runVerb('ActionRotateLeft', 1);
    assert.equal(w.cam.yawDeg, 150, 'one second of rotate-LEFT is euler-y +150, not -150');
    assert.equal(new ExteriorAutomapWindow(deps('r:rot')).cam.yawDeg, 0);
    const rect = { x: 0, y: 0, w: 318, h: 169 };
    const k = rect.h / (2 * w.cam.orthoSize);
    const north = toPanelScreen(w.cam, rect, 0, 40);
    assert.ok(Math.abs(north[0] - (rect.w / 2 + (-0.5 * 40) * k)) < 1e-9, 'north lands LEFT of the panel centre');
    assert.ok(Math.abs(north[1] - (rect.h / 2 + (0.8660254037844387 * 40) * k)) < 1e-9, 'and below it');
    assert.ok(north[0] < rect.w / 2, 'counter-clockwise, as DFU turns it - a mirrored map puts north RIGHT');
    // the layout quad and the compass strip ride that same yaw, so the
    // whole picture turns together
    assert.ok(Math.abs(layoutQuadRotation(w.cam) - (-150 * Math.PI / 180)) < 1e-12);

    // THE CONVENTION-FREE HALF (:1124-1126): the camera's POSITION and
    // its BASIS take the same turn about the marker, so the marker's
    // panel position is INVARIANT. No sign argument is needed for this
    // one - a centre turning one way and a basis the other is a
    // self-contradiction inside the port.
    const v = new ExteriorAutomapWindow(deps('r:rot2'));
    const base = { center: [30, 0, -12], yawDeg: 17, orthoSize: 100 };
    const marker = v.markerPos();
    v.cam = { ...base };
    const before = toPanelScreen(v.cam, rect, marker[0], marker[2]);
    for (const verb of ['ActionRotateAroundPlayerPosLeft', 'ActionRotateAroundPlayerPosRight']) {
      v.cam = { ...base };
      v.runVerb(verb, 0.2);
      assert.notEqual(v.cam.yawDeg, base.yawDeg, `${verb} really turned the camera`);
      const after = toPanelScreen(v.cam, rect, marker[0], marker[2]);
      assert.ok(Math.abs(after[0] - before[0]) < 1e-9 && Math.abs(after[1] - before[1]) < 1e-9,
        `the marker never moves when the map turns about it (${verb})`);
    }
  } finally { _resetForTests(); _resetZoomForTests(); }
});

test('c2/S10 THE HOTKEYS ARE DFU\'S OWN ExtAutomap TABLE - every verb bound, resolved through ShortcutOrFallback, and A2\'s invented letters gone', () => {
  _resetForTests(); _resetZoomForTests();
  try {
    // (1) THE TABLE, resolved out of DialogShortcuts.txt:267-296 rather
    // than spelled here: both classes together are DFU's thirty rows,
    // each carries a key, and each names a verb runVerb owns.
    const all = [...EXT_HOTKEYS_DOWN, ...EXT_HOTKEYS_HELD];
    assert.equal(all.length, 30, 'all thirty ExtAutomap rows are live');
    assert.equal(new Set(all).size, 30);
    for (const b of all) assert.ok(shortcutBinding(b).code, `${b} resolves to a key`);
    // (sequenceString prints the port's alphabet - the browser code -
    // where DFU's table names the Unity KeyCode: LeftArrow, PageUp,
    // KeypadPlus.)
    assert.equal(sequenceString(shortcutBinding('ExtAutomapMoveLeft')), 'ArrowLeft');
    assert.equal(sequenceString(shortcutBinding('ExtAutomapRotateLeft')), 'Ctrl-ArrowLeft');
    assert.equal(sequenceString(shortcutBinding('ExtAutomapRotateAroundPlayerPosLeft')), 'Alt-ArrowLeft');
    assert.equal(sequenceString(shortcutBinding('ExtAutomapMoveToWestLocationBorder')), 'Shift-ArrowLeft');
    assert.equal(sequenceString(shortcutBinding('ExtAutomapMaxZoom1')), 'Ctrl-PageUp');
    assert.equal(sequenceString(shortcutBinding('ExtAutomapSwitchToNextExteriorAutomapViewMode')), 'Enter');
    assert.equal(sequenceString(shortcutBinding('ExtAutomapZoomOut')), 'NumpadSubtract');
    const RV = src('src/ui/exteriorAutomapWindow.js');
    for (const b of all) {
      if (EXT_BACKGROUND_HOTKEYS[b]) { assert.equal(EXT_HOTKEY_VERBS[b], undefined, `${b} is a background, not a verb`); continue; }
      const verb = EXT_HOTKEY_VERBS[b];
      assert.ok(verb && RV.includes(`case '${verb}'`), `${b} -> ${verb} has a runVerb arm`);
    }

    // (2) THE KEYS REALLY DRIVE, and one code carries three verbs by
    // its modifier - which the invented letter table could not express.
    const w = new ExteriorAutomapWindow(deps('r:keys'));
    w.cam = { ...w.cam, center: [0, 0, 0], yawDeg: 0, orthoSize: 100 };
    w._dt = 1;
    w.input('ArrowLeft', { code: 'ArrowLeft' });
    assert.equal(w.cam.center[0], -100, 'LeftArrow is ExtAutomapMoveLeft at 100 units/second');
    assert.equal(w.cam.yawDeg, 0, 'and it does not rotate');
    w.input('ArrowLeft', { code: 'ArrowLeft', ctrlKey: true });
    assert.equal(w.cam.yawDeg, 150, 'Ctrl-LeftArrow is ExtAutomapRotateLeft');
    w.cam = { ...w.cam, yawDeg: 0, center: [0, 0, 0] };
    w.input('ArrowLeft', { code: 'ArrowLeft', altKey: true });
    assert.equal(w.cam.yawDeg, 150, 'Alt-LeftArrow is ExtAutomapRotateAroundPlayerPosLeft');
    assert.notDeepEqual(w.cam.center, [0, 0, 0], 'and it swings the centre about the marker');
    w.cam = { ...w.cam, center: [7, 0, -9], yawDeg: 0 };
    w.input('ArrowUp', { code: 'ArrowUp', shiftKey: true });
    assert.deepEqual(w.cam.center, [7, 0, +64], 'Shift-UpArrow is ExtAutomapMoveToNorthLocationBorder, not MoveForward');

    // (3) THE ZOOM, BOTH DIRECTIONS. A2's `case 'minus'` could never
    // fire - ui/input.js returns 'char:-' for the hyphen - so keyboard
    // zoom-OUT did not exist at all. DFU binds PageUp/PageDown and
    // Keypad+/-, and the ZoomIn/ZoomOut arms (:700-708) are the same
    // ActionZoom bodies as Upstairs/Downstairs.
    w.cam = { ...w.cam, orthoSize: 100 };
    w.input('PageDown', { code: 'PageDown' });
    assert.equal(w.cam.orthoSize, 150, 'PageDown is ExtAutomapDownstairs = ActionZoom(+zoomSpeed*dt)');
    w.input('PageUp', { code: 'PageUp' });
    assert.equal(w.cam.orthoSize, 100, 'PageUp is ExtAutomapUpstairs');
    w.input('NumpadSubtract', { code: 'NumpadSubtract' });
    assert.equal(w.cam.orthoSize, 150, 'KeypadMinus is ExtAutomapZoomOut - the arm the hyphen never reached');
    w.input('NumpadAdd', { code: 'NumpadAdd' });
    assert.equal(w.cam.orthoSize, 100, 'KeypadPlus is ExtAutomapZoomIn');
    w.input('PageUp', { code: 'PageUp', ctrlKey: true });
    assert.equal(w.cam.orthoSize, ZOOM_MIN, 'Ctrl-PageUp is ExtAutomapMaxZoom1');
    w.input('PageDown', { code: 'PageDown', ctrlKey: true });
    assert.equal(w.cam.orthoSize, ZOOM_MAX, 'Ctrl-PageDown is ExtAutomapMinZoom1');
    w.input('NumpadAdd', { code: 'NumpadAdd', ctrlKey: true });
    assert.equal(w.cam.orthoSize, ZOOM_MAX, 'Ctrl-KeypadPlus is MinZoom2 - DFU\'s own odd pairing, kept');
    w.input('NumpadSubtract', { code: 'NumpadSubtract', ctrlKey: true });
    assert.equal(w.cam.orthoSize, ZOOM_MIN, 'and Ctrl-KeypadMinus is MaxZoom2');

    // (4) THE THREE DIRECT VIEW MODES (:1235-1262) had no arm anywhere
    // before - F2/F3/F4 SET the mode, they do not cycle to it.
    w.input('F4', { code: 'F4' });
    assert.equal(w.mode, 'all');
    w.input('F2', { code: 'F2' });
    assert.equal(w.mode, 'original');
    w.input('F3', { code: 'F3' });
    assert.equal(w.mode, 'extra');
    w.input('Enter', { code: 'Enter' });
    assert.equal(w.mode, 'all', 'Return is ExtAutomapSwitchToNextExteriorAutomapViewMode');
    w.cam = { ...w.cam, yawDeg: 42, center: [500, 0, 500] };
    w.input('Tab', { code: 'Tab' });
    assert.deepEqual(w.cam.center, [...w.markerPos().slice(0, 1), 0, w.markerPos()[2]], 'Tab is ExtAutomapFocusPlayerPosition');
    w.input('Backspace', { code: 'Backspace' });
    assert.equal(w.cam.yawDeg, 0, 'Backspace is ExtAutomapResetView');

    // (5) A2'S INVENTED VOCABULARY IS GONE. Not one of its letters or
    // digits does anything now. ('up'/'down' are left out: those are
    // ui/input.js's cooked names for the ARROWS, which normalizeCode
    // resolves back to DFU's own MoveForward/MoveBackward rows.)
    const shot = () => JSON.stringify({ cam: w.cam, mode: w.mode, bg: w.background, done: w.done, latch: w.isCloseWindowDeferred });
    const frozen = shot();
    for (const ch of ['char:w', 'char:a', 'char:s', 'char:d', 'char:q', 'char:e',
      'char:n', 'char:b', 'char:h', 'char:l', 'char:v', 'char:f', 'char:c',
      'char:1', 'char:2', 'char:7', 'char:8', 'char:9', 'char:0', 'plus', 'minus']) w.input(ch, null);
    assert.equal(shot(), frozen, 'the WASD/QE/digit table no longer exists');

    // (6) THE SEAM. townTalk hands raw codes only to a window that asks
    // for them, and that one flag is what forced the invention.
    assert.equal(w.isChoiceWindow, true);
    assert.match(src('src/scenes/townTalk.js'), /if \(overlay\.isChoiceWindow\) overlay\.input\(e\.code, e\);/);
  } finally { _resetForTests(); _resetZoomForTests(); }
});

test('c2/S10 the two panel drags run in REAL SCREEN pixels, and the right drag carries ActionRotate\'s own dt', () => {
  _resetForTests(); _resetZoomForTests();
  try {
    const drag = (scale, dt, button) => {
      const w = new ExteriorAutomapWindow(deps(`r:drag-${scale}-${dt}-${button}`));
      w.cam = { ...w.cam, center: [0, 0, 0], yawDeg: 0, orthoSize: 100 };
      w._scale = scale; w._dt = dt;
      w.pointer('down', 160, 85, button);     // inside CHROME_RECTS.panel
      w.pointer('move', 170, 85, button);     // ten NATIVE px
      return w.cam;
    };
    // DFU's bias is InputManager.MousePosition - REAL screen pixels
    // (:731, :744), NOT BaseScreenComponent's localScale-divided
    // ScaledMousePosition - and both speeds are tuned against that
    // space, so the same NATIVE delta must move FOUR times as far on a
    // 4x letterbox. (The dungeon window's `_applyDrag` reads it so.)
    const one = drag(1, 1 / 60, 0);
    assert.ok(Math.abs(one.center[0] - -(0.00345 * 100 * 10)) < 1e-9, 'dragSpeed * orthographicSize * bias');
    const four = drag(4, 1 / 60, 0);
    assert.ok(Math.abs(four.center[0] - one.center[0] * 4) < 1e-9,
      'a drag of N native px at m.s = 4 pans 4x the world distance of the same drag at m.s = 1');

    // THE RIGHT DRAG: :748 hands `dragRotateSpeed * bias.x` to
    // ActionRotate, whose body multiplies by Time.unscaledDeltaTime
    // (:1103) - so the bias is the AMOUNT, not the angle. Ten screen px
    // at 60 fps is 5.0 * 10 / 60 degrees, not 50.
    const r60 = drag(1, 1 / 60, 2);
    assert.ok(Math.abs(r60.yawDeg - (5.0 * 10 / 60)) < 1e-9, 'one frame of it, not a whole second');
    const r30 = drag(1, 1 / 30, 2);
    assert.ok(Math.abs(r30.yawDeg - r60.yawDeg * 2) < 1e-9, 'and a longer frame turns further');
    assert.ok(Math.abs(drag(4, 1 / 60, 2).yawDeg - r60.yawDeg * 4) < 1e-9, 'scaled to screen pixels too');
    // ...while the LEFT drag stays dt-FREE: :733-740 has no dt at all,
    // and the asymmetry is deliberate in the reference.
    assert.deepEqual(drag(1, 1 / 30, 0).center, one.center, 'the pan is not a per-second speed');
  } finally { _resetForTests(); _resetZoomForTests(); }
});

test('c2/S10 the hover sentinel never reaches the drag machine: (-1,-1) freezes the drag, it does not teleport the map', () => {
  _resetForTests(); _resetZoomForTests();
  try {
    const w = new ExteriorAutomapWindow(deps('r:hover'));
    w.cam = { ...w.cam, center: [0, 0, 0], yawDeg: 0, orthoSize: 250 };
    w._scale = 1;
    w.pointer('down', 160, 85, 0);
    w.hover(170, 85);
    const moved = [...w.cam.center];
    assert.ok(Math.abs(moved[0]) > 0, 'a real move drags');
    // townTalk hands (-1,-1) for ANY pointer outside the native rect -
    // its listener is on the window, not the canvas - and that is a
    // FABRICATED coordinate, not a position. DFU never has one: its
    // Update differences two real MousePosition samples.
    w.hover(-1, -1);
    assert.deepEqual(w.cam.center, moved, 'the excursion moves nothing at all');
    w.hover(180, 85);
    assert.ok(Math.abs(w.cam.center[0] - moved[0] * 2) < 1e-9, 'and the drag resumes from the re-entry point');
    assert.match(src('src/scenes/townTalk.js'), /overlay\.hover\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\);/);
  } finally { _resetForTests(); _resetZoomForTests(); }
});

test('c2/S10 the chrome\'s ButtonClick reaches the audio door, so ActionClickSoundOnly means something', () => {
  _resetForTests(); _resetZoomForTests();
  const orig = audio.playOneShot;
  const played = [];
  audio.playOneShot = (i, v) => { played.push([i, v]); return 0.1; };
  try {
    const w = new ExteriorAutomapWindow(deps('r:snd'));
    const G = CHROME_RECTS.grid;
    // GridButton_OnRightMouseClick (:1375-1381) is, IN FULL, the drag
    // guard and one PlayOneShot - the sound is the whole handler.
    w.pointer('down', G.x + 2, G.y + 2, 2);
    assert.deepEqual(played, [], 'nothing on the press of a CLICK button');
    const out = w.pointer('up', G.x + 2, G.y + 2, 2);
    assert.deepEqual(out.verbs, ['ActionClickSoundOnly']);
    assert.deepEqual(played, [[SOUND.ButtonClick, 1]], 'exactly one ButtonClick, and it is the only effect');
    // ...and a HOLD button rings on the PRESS (:1408 and its fifteen twins)
    played.length = 0;
    const F = CHROME_RECTS.forward;
    w.pointer('down', F.x + 2, F.y + 2, 0);
    assert.deepEqual(played, [[SOUND.ButtonClick, 1]]);
    // the render panel is not a button and rings nothing
    played.length = 0;
    w.pointer('up', F.x + 2, F.y + 2, 0);
    w.pointer('down', 160, 85, 0);
    assert.deepEqual(played, []);
  } finally { audio.playOneShot = orig; _resetForTests(); _resetZoomForTests(); }
});

test('c2/S10 the camera ROTATION is remembered across close/reopen, exactly as the zoom is (ExteriorAutomap.cs:88, :263-288)', () => {
  _resetForTests(); _resetZoomForTests();
  try {
    const a = new ExteriorAutomapWindow(deps('r:yaw'));
    assert.equal(a.cam.yawDeg, 0);
    a.runVerb('ActionRotateLeft', 0.2);
    assert.equal(a.cam.yawDeg, 30);
    a.tick(0);   // UpdateAutomapStateOnWindowPop saves the rotation (:285-288)
    // reopen in the SAME location: UpdateAutomapStateOnWindowPush
    // assigns cameraTransformRotationSaved straight back (:263-270)
    assert.equal(new ExteriorAutomapWindow(deps('r:yaw')).cam.yawDeg, 30);
    // a NEW location raises the reset signal, whose ResetCameraPosition
    // -> ResetCameraTransform is Quaternion.Euler(90,0,0) - and that
    // call is NOT behind ExteriorMapResetZoomLevelOnNewLocation, which
    // gates only the zoom recompute beside it (window :513-521)
    setValue('Map', 'ExteriorMapResetZoomLevelOnNewLocation', false);
    assert.equal(new ExteriorAutomapWindow(deps('r:yaw2')).cam.yawDeg, 0, 'a new location resets it either way');
    const b = new ExteriorAutomapWindow(deps('r:yaw2'));
    b.runVerb('ActionRotateRight', 0.2); b.tick(0);
    assert.equal(b.cam.yawDeg, -30);
    assert.equal(new ExteriorAutomapWindow(deps('r:yaw2')).cam.yawDeg, -30);
    // ActionResetView is DFU's other way back to north-up (:1304-1313)
    b.runVerb('ActionResetView', 1); b.tick(0);
    assert.equal(new ExteriorAutomapWindow(deps('r:yaw2')).cam.yawDeg, 0);
  } finally { _resetForTests(); _resetZoomForTests(); }
});

// ── ROAD-D D5: the exterior automap's FLAGGED residue ────────────────

test('D5 the residence-with-active-quest plate arm: ExteriorAutomap.cs:693-709\'s double loop, its three quirks, and the plate it finally raises', () => {
  // ---- the law on its own, with a synthetic QuestMachine/TalkManager
  // pair, so each quirk is isolated from the store and the window ----
  const place = (key, name) => ({ isPlace: true, symbol: { name: `p:${key}:${name}` }, siteDetails: { buildingKey: key, buildingName: name } });
  const calls = [];
  const marked = (over = {}) => ({ isQuestResource: true, locationWasMarkedOnMapByNPC: true, overrideBuildingName: 'from the inner call', ...over });
  const quests = {
    1: { resources: new Map([['a', place(42, 'First House')], ['b', place(99, 'Wrong Key')]]) },
    2: { resources: new Map([['c', place(42, 'Second House')], ['d', { isPerson: true, symbol: { name: 'x' } }]]) },
  };
  const qs = (answer) => ({
    getAllActiveQuestIds: () => [1, 2],
    getQuest: (id) => quests[id] ?? null,
    isBuildingQuestResource: (mapID, key) => { calls.push([mapID, key]); return answer; },
  });
  // QUIRK 1 - NO BREAK: both loops run to the end, so the LAST marked
  // match wins, not the first.
  assert.equal(residenceQuestName(qs(marked()), 100, 42), 'Second House');
  // QUIRK 2 - THE `&&` SHORT-CIRCUITS: IsBuildingQuestResource is never
  // called for the key-99 place, nor for the Person resource.
  assert.deepEqual(calls, [[100, 42], [100, 42]], 'two Place resources carry the key; nothing else asks');
  // QUIRK 3 - the name is the OUTER place's `SiteDetails.buildingName`,
  // NOT the `overrideBuildingName` the inner call answers. The two
  // agree in the common case (the C# comment says so) and part exactly
  // when the outer guard - which tests the buildingKey ALONE - matches
  // a place in another town while IsBuildingQuestResource, which tests
  // mapID AND buildingKey, matches one here.
  assert.notEqual(residenceQuestName(qs(marked()), 100, 42), 'from the inner call');
  // and the two gates the arm really is: the flag, and the resource test
  assert.equal(residenceQuestName(qs(marked({ locationWasMarkedOnMapByNPC: false })), 100, 42), '',
    'directional hints alone name nothing - only LocationWasMarkedOnMap does');
  assert.equal(residenceQuestName(qs({ isQuestResource: false, locationWasMarkedOnMapByNPC: true }), 100, 42), '');
  assert.equal(residenceQuestName({ getAllActiveQuestIds: () => [] }, 100, 42), '', 'no active quests: string.Empty');

  // ---- and the WIRE, through the port's real IsBuildingQuestResource
  // (systems/topicTree.js:394-419) and the real discovery store ----
  _resetForTests(); _resetZoomForTests();
  restoreDiscovery(null);
  try {
    const summaries = buildingSummaries(
      [{ buildingType: 9, nameSeed: 1, factionId: 0, quality: 10 }], [FAKE_BLOCK], {});
    const shop = summaries[0], house = summaries[1];
    assert.equal(house.isResidence, true);
    const site = {
      isPlace: true,
      symbol: { name: '_site_' },
      siteDetails: { mapId: 100, buildingKey: house.buildingKey, buildingName: 'The Marked House', locationName: 'T', regionName: 'R' },
    };
    const quest = { uid: 3, resources: new Map([['_site_', site]]) };
    const tree = new TopicTree({
      getQuest: () => quest,
      getAllActiveQuestIds: () => [3],
      currentRegionIndex: () => 17,
      currentRegionName: () => 'R',
      currentLocationName: () => 'T',
      currentMapId: () => 100,
      isPlayerInside: () => false,
      isPlayerInsideBuilding: () => false,
      isPlayerInsideCastle: () => false,
      currentBuildingKey: () => -1,
      getBuildingList: () => [],
      exteriorBuildings: () => [],
      factionName: () => '',
      addOrReplaceQuestProgressRumor: () => {},
      undiscoverBuilding: () => {},
      talkPartner: () => null,
      onTopicListsUpdated: () => {},
    });
    tree.addQuestTopicWithInfoAndRumors(3, site, '_site_', QUEST_INFO_RESOURCE_TYPE.Location, null, null);
    const source = {
      getAllActiveQuestIds: () => [3],
      getQuest: () => quest,
      isBuildingQuestResource: (mapID, key) => tree.isBuildingQuestResource(mapID, key),
    };
    const w = new ExteriorAutomapWindow({
      ...deps('r:questplate'),
      buildings: () => summaries,
      discovered: () => discoveredBuildings('r:questplate'),
    });
    const m = { s: 3, ox: 0, oy: 0 };
    discoverBuilding('r:questplate', { buildingKey: house.buildingKey, name: 'House', buildingType: 17 });
    // the quest exists and the residence is discovered, but the NPC has
    // not marked it on the map yet: no plate, exactly as before D5
    stampResidenceQuestNames(summaries, discoveredBuildings('r:questplate'), source, 100);
    assert.equal(house.questName, '');
    assert.deepEqual(w.buildPlates(FONT, m), []);
    // ...and now an NPC marks it (BUILDING_HINT_TYPE.LocationWasMarkedOnMap)
    const info = tree.dictQuestInfo.get(3).resourceInfo.get('_site_');
    info.questPlaceResourceHintTypeReceived = BUILDING_HINT_TYPE.LocationWasMarkedOnMap;
    assert.equal(tree.isBuildingQuestResource(100, house.buildingKey).locationWasMarkedOnMapByNPC, true);
    stampResidenceQuestNames(summaries, discoveredBuildings('r:questplate'), source, 100);
    assert.equal(house.questName, 'The Marked House');
    let plates = w.buildPlates(FONT, m);
    assert.equal(plates.length, 1, 'the quest-marked residence is finally named on the town map');
    assert.equal(plates[0].text, 'The Marked House');
    assert.equal(plates[0].isResidence, true);
    // PlayerGPS.CurrentMapID is a real gate: standing in another town,
    // IsBuildingQuestResource never matches and the plate goes away
    house.questName = '';
    stampResidenceQuestNames(summaries, discoveredBuildings('r:questplate'), source, 101);
    assert.equal(house.questName, '');
    assert.deepEqual(w.buildPlates(FONT, m), []);
    // THE GATE IS DFU'S WHOLE LADDER (:676-682), not "is it a
    // residence": an OVERRIDE-NAMED residence takes the display-name
    // arm and is never stamped at all...
    const over = [{ buildingKey: house.buildingKey, displayName: 'The Odd House', isOverrideName: true, customUserDisplayName: '' }];
    house.questName = 'stale';
    stampResidenceQuestNames(summaries, over, source, 100);
    assert.equal(house.questName, 'stale', 'the override arm never reaches the quest walk');
    // ...an UNdiscovered building is not stamped either (its arm is
    // revealUndiscoveredBuildings)...
    house.questName = '';
    stampResidenceQuestNames(summaries, [], source, 100);
    assert.equal(house.questName, '');
    // ...and a NON-residence never is: the shop keeps its displayName
    discoverBuilding('r:questplate', { buildingKey: shop.buildingKey, name: 'The Odd Blades', buildingType: 9 });
    stampResidenceQuestNames(summaries, discoveredBuildings('r:questplate'), source, 100);
    assert.equal(shop.questName, undefined, 'the non-residence arm is `!IsResidence || isOverrideName`, which returns first');
    plates = w.buildPlates(FONT, m);
    assert.deepEqual(plates.map((p) => p.text).sort(), ['The Marked House', 'The Odd Blades']);
    // AND THE FIELD REALLY HAS A PRODUCER NOW. Before D5 `questName`
    // had none anywhere in src/, so this arm could never fire and a
    // quest-marked residence was silently plateless. The stamp lives in
    // the M-outside door of the host that HAS a quest machine, between
    // the summaries walk and the window, on DFU's own three inputs.
    const wsrc = src('src/scenes/world.js');
    const door = wsrc.slice(wsrc.indexOf('const toggleExteriorAutomap'), wsrc.indexOf('SetCustomBuildingName (ExteriorAutomap.cs:867-899)'));
    assert.match(door, /\n {4}stampResidenceQuestNames\(summaries, discoveredBuildings\(locId\), \{/);
    assert.match(door, /getAllActiveQuestIds: activeQuestIds,/, 'QuestMachine.GetAllActiveQuests, the tree\'s own definition');
    assert.match(door, /isBuildingQuestResource: \(mapID, key\) => topicTree\.isBuildingQuestResource\(mapID, key\),/);
    assert.match(door, /\}, dfLoc\.mapTableData\?\.mapId \?\? 0\);/, 'PlayerGPS.CurrentMapID');
    // ...and the OTHER host mounts no quest machine at all, so it
    // stamps nothing and says why (DFU's empty-set answer is the same)
    assert.equal(/stampResidenceQuestNames\(/.test(src('src/scenes/exterior.js')), false);
  } finally { _resetForTests(); _resetZoomForTests(); restoreDiscovery(null); }
});

test('D5 the exterior BUTTON tooltips: Internal_Strings.csv:908-917 with its typos, DFU\'s own {0}.. order, the Home fallback, and the chrome\'s rest clock', () => {
  const seq = (name) => sequenceString(shortcutBinding(name));
  // THE ROWS, byte for byte - including the two misprints a player
  // really reads (an unopened ")" on the zoom-in row, an unclosed "("
  // on the zoom-out row) and the DOUBLE SPACE on rotate-left.
  assert.equal(EXTERIOR_AUTOMAP_STRINGS.exteriorAutomapToolTipUpstairsButton,
    'left click: zoom in (hotkey: {0})\\rright click: apply maximum zoom)');
  assert.equal(EXTERIOR_AUTOMAP_STRINGS.exteriorAutomapToolTipDownstairsButton,
    'left click: zoom out (hotkey: {0}\\rright click: apply minimum zoom)');
  assert.match(EXTERIOR_AUTOMAP_STRINGS.exteriorAutomapToolTipRotateLeftButton, /to the left {2}\(hotkey: \{1\}\)$/);
  assert.equal(EXTERIOR_AUTOMAP_STRINGS.exteriorAutomapToolTipPanelCompass,
    'left click: focus player position (hotkey: {0})\\rright click: reset view (hotkey: {1})');
  // ...and the escape is the CSV's two-character \r, which toolTip.js's
  // UpdateTextRows collapses - nothing here re-spells it
  assert.equal(EXTERIOR_AUTOMAP_STRINGS.exteriorAutomapToolTipForwardButton.includes('\r'), false);

  // THE SLOTS, in the C# argument order (:230-239). The grid row's
  // eight are next-mode, the three DIRECT view modes, then the four
  // backgrounds - the sentence's own order is NOT the argument order.
  assert.equal(exteriorAutomapTooltipFor('grid'),
    `left click: switch to next view mode (hotkey: ${seq('ExtAutomapSwitchToNextExteriorAutomapViewMode')})\\ravailable view modes are:`
    + `\\r- original (hotkey ${seq('ExtAutomapSwitchToExteriorAutomapViewModeOriginal')})`
    + `\\r- extra: includes extra buildings (hotkey ${seq('ExtAutomapSwitchToExteriorAutomapViewModeExtra')})`
    + `\\r- all: includes extra buildings, ground flats (hotkey ${seq('ExtAutomapSwitchToExteriorAutomapViewModeAll')})`
    + `\\rswitch background texture with ${seq('ExtAutomapSwitchToExteriorAutomapBackgroundOriginal')}, ${seq('ExtAutomapSwitchToExteriorAutomapBackgroundAlternative1')}`
    + `, ${seq('ExtAutomapSwitchToExteriorAutomapBackgroundAlternative2')}, ${seq('ExtAutomapSwitchToExteriorAutomapBackgroundAlternative3')}`);
  assert.equal(exteriorAutomapTooltipFor('forward'),
    `left click: move up (hotkey: ${seq('ExtAutomapMoveForward')})\\rright click: move to north location border (hotkey: ${seq('ExtAutomapMoveToNorthLocationBorder')})`);
  assert.equal(exteriorAutomapTooltipFor('compass'),
    `left click: focus player position (hotkey: ${seq('ExtAutomapFocusPlayerPosition')})\\rright click: reset view (hotkey: ${seq('ExtAutomapResetView')})`);
  // THE STAIR ROWS TAKE THE ZOOM ROWS, not the Upstairs/Downstairs rows
  // their BUTTONS are named after (:237-238), and neither row
  // substitutes anything for its right-click max/min zoom.
  assert.equal(exteriorAutomapTooltipFor('upstairs'),
    `left click: zoom in (hotkey: ${seq('ExtAutomapZoomIn')})\\rright click: apply maximum zoom)`);
  assert.notEqual(seq('ExtAutomapZoomIn'), seq('ExtAutomapUpstairs'));
  assert.equal(exteriorAutomapTooltipFor('downstairs'),
    `left click: zoom out (hotkey: ${seq('ExtAutomapZoomOut')}\\rright click: apply minimum zoom)`);
  // the EXIT button, the render panel and the micro-map rect carry none
  for (const name of ['exit', 'panel', 'microMap', 'nope']) assert.equal(exteriorAutomapTooltipFor(name), null);
  // SHORTCUT-OR-FALLBACK, the exterior window's own copy (:217-224) at
  // the SAME KeyCode.Home (:55): a row whose key code is the player's
  // AutoMap binding prints Home instead - the key that opens the map
  // must not also drive a button while it is up.
  assert.match(exteriorAutomapTooltipFor('forward', 'ArrowUp'), /move up \(hotkey: Home\)/);
  assert.match(exteriorAutomapTooltipFor('forward', 'ArrowUp'), /north location border \(hotkey: Shift-Home\)/,
    'the test is the KEY CODE alone - modifiers do not save a sequence');

  // AND THE WINDOW DRAWS THEM, on the chrome clock it was already
  // computing and throwing away.
  _resetForTests(); _resetZoomForTests();
  try {
    setValue('GUI', 'EnableToolTips', true);
    setValue('GUI', 'ToolTipBackgroundColor', '10203040');
    const log = [];
    const r = stubRenderer(log);
    const F = { ...FONT, tex: 'atlas' };
    const w = new ExteriorAutomapWindow(deps('r:tips'));
    const canvas = { width: 320, height: 200 };
    const bgA = 0x40 / 255;
    const box = () => log.filter((l) => l.kind === 'quad')
      .find((q) => q.tex === null && q.color && q.color.length === 4 && Math.abs(q.color[3] - bgA) < 1e-9);
    w.hover(110, 180);          // inside the FORWARD button (105..126 x 171..190)
    w.tick(0.5); log.length = 0; w.draw(r, canvas, F, 1);
    assert.equal(box(), undefined, 'nothing before ToolTipDelay (DaggerfallAutomapWindow.cs:22 - one second)');
    w.tick(0.5); log.length = 0; w.draw(r, canvas, F, 1);
    const shown = box();
    assert.ok(shown, 'the rested button\'s tooltip drew');
    assert.equal(shown.dst.y, 180 + 4, 'at the cursor plus ToolTip.MouseOffset (0,4)');
    // two rows of text, so the box is glyph*2 + 3 tall (toolTip.js) -
    // and this row is WIDER than the 320-px screen, so ToolTip.Draw's
    // right-edge shift is what places it
    assert.equal(shown.dst.h, 6 * 2 + 3);
    assert.ok(shown.dst.w > 320);
    assert.equal(shown.dst.x, 320 - shown.dst.w, 'x -= (x + w) - NATIVE_W');
    // ...and unlike the PLATE tooltip these ride the window's shared
    // defaultToolTip, so EnableToolTips really does gate them
    // (DaggerfallBaseWindow.cs:50-56)
    setValue('GUI', 'EnableToolTips', false);
    log.length = 0; w.draw(r, canvas, F, 1);
    assert.equal(box(), undefined, 'the master switch is honoured for the BUTTON tooltips');
    setValue('GUI', 'EnableToolTips', true);
    // and the render panel carries no tooltip at all - moving off the
    // rect restarts the delay, so a second of rest there shows nothing
    w.hover(160, 100); w.tick(1); log.length = 0; w.draw(r, canvas, F, 1);
    assert.equal(box(), undefined, 'the render panel carries no tooltip');
  } finally { _resetForTests(); _resetZoomForTests(); }
});
