// EM4 - THE TOWN SHEET AND ITS INK (2026-09-21, Mac: "we're going to
// put our own spin on the automap and town map themselves, enhancing
// the look like how we did we the world map").
//
// The shipped town map paints the FLD bytes as four flat colours and
// rotates the result under a camera. That is faithful, and it is a
// bitmap. THE PLAN IS TRACED HERE: the built-up pixels are an island
// whose sea is the street, and its shore is boundarySegments +
// linkSegments - the same two functions that ink the Iliac Bay's coast
// and the dungeon's walls. Three sheets, one hand.
//
// These pins hold the ORIENTATION (the field is laid in
// nameplate-anchor space, so the plan and the names cannot mirror
// against each other - the one thing about a picture a test CAN
// settle), the two weights, and the NAME LADDER, which is the
// discovery law rather than a presentation choice and is therefore
// kept whole from the shipped window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BLOCK_PX, TOWN_PEN, TOWN_WALL_PEN, TOWN_WALL_PEN_MIN, CARET_R, QUEST_R,
  QUARTER_WASH, QUARTER_INK, ANCHOR_R, LEAD_AT,
  townBytes, townChains, quarterChains, townReader, isBuilt, isEnterable, isQuarter,
  paintTownStatic, paintTownOverlay, sheetY,
} from '../src/ui/inkTown.js';
import {
  QUARTERS, quarterOf, quarterOfType, isShowAllByte, CLASSIC_ARGB, CLASSIC_SETTING, argbChannels,
  TEMPLE_SET, SHOP_SET, TAVERN_BYTE, HOUSE_SET, SHOWALL_SET, GROUND_FLAT_BYTE, STREET_BYTE,
} from '../src/ui/townQuarters.js';
import {
  createTownSheet, NAME_ZOOM_MIN, NAME_SIZE, NAME_SIZE_MIN, NAME_SIZE_MAX, FIT_MARGIN,
  NAME_WEIGHT, QUEST_WEIGHT,
} from '../src/ui/townSheet.js';
import { isSheet, SHEET_MEMBERS } from '../src/ui/mapStrip.js';
import {
  PEN, HALO_PEN, boundarySegments, linkSegments, toPaper, scaleMinOf,
  INK_RGB, PARCHMENT_RGB, quarterWash, quarterInk, mixRgb, rgba,
  QUARTER_WASH_A, QUARTER_INK_MIX, QUARTER_WASH_DE, QUARTER_INK_DE, QUARTER_INK_PAPER_DE,
} from '../src/ui/inkMap.js';
import { nameplateAnchor, WORLD_PER_PX } from '../src/ui/nameplateLayout.js';
import { buildExteriorLayout } from '../src/ui/exteriorAutomapWindow.js';   // EM-BUG3: the shipped map's own composition, so the two sheets are checked against each other
import { RMB_DIMENSION } from '../src/formats/blocksFile.js';   // EM-BUG3: the anchor's own divisor, so the pin builds a z rather than copying a row number

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle, lineWidth: state.lineWidth, font: state.font }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}

/** CIE76 over sRGB - enough to ask whether two colours are colours a
 *  person tells apart, which is the only question these pins put to it.
 *  Test scaffolding: nothing at runtime needs to measure a colour, and
 *  a palette module that could would be a palette module with opinions. */
function deltaE(p, q) {
  const lin = (v) => { const u = v / 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const lab = ([r, g, b]) => {
    const [R, G, B] = [lin(r), lin(g), lin(b)];
    const X = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
    const Y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
    const Z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  };
  const [a, b] = [lab(p), lab(q)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** A block's 64x64 FLD grid with `fill` stamped over [x0,x1)x[y0,y1)
 *  in the block's OWN (bottom-up) row order. */
function blockGrid(stamps) {
  const g = new Uint8Array(BLOCK_PX * BLOCK_PX);
  for (const [x0, y0, x1, y1, byte] of stamps) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * BLOCK_PX + x] = byte;
  }
  return g;
}

const SHOP = SHOP_SET[0];
const HOUSE = HOUSE_SET[0];
const TEMPLE = TEMPLE_SET[0];

test('EM4: the town is drawn in the BAY\'s pen - not one colour is invented here', () => {
  for (const [name, value] of Object.entries(TOWN_PEN)) {
    assert.ok(Object.values(PEN).includes(value), `TOWN_PEN.${name} is a colour inkMap does not have`);
  }
  const text = src('src/ui/inkTown.js');
  assert.match(text, /PEN, HALO_PEN, NAME_FACE, toPaper, paintCaret, CARET_R, quarterWash, quarterInk,\n\} from '\.\/inkMap\.js';/);
  assert.doesNotMatch(text, /rgba?\(/, 'a colour written out here is a colour that drifts');
  assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/);
  // and the three sheets share the pen by VALUE, not by coincidence
  assert.equal(TOWN_PEN.wall, PEN.line);
  assert.equal(TOWN_PEN.wash, PEN.wash);
  assert.equal(TOWN_PEN.caret, PEN.player);
});

test('EM4: the byte groups are DFU\'s own, and a ground flat is NOT a building', () => {
  // the byte is BuildingType + 1; the shipped window's own five sets
  const buildings = [...TEMPLE_SET, ...SHOP_SET, TAVERN_BYTE, ...HOUSE_SET];
  assert.equal(new Set(buildings).size, buildings.length, 'a byte in two groups is a byte drawn two ways');
  assert.equal(STREET_BYTE, 0);
  assert.equal(GROUND_FLAT_BYTE, 0xfb);
  for (const b of buildings) assert.equal(isBuilt(b), true, `byte ${b} is a building`);
  assert.equal(isBuilt(STREET_BYTE), false, 'the street is what makes the town a town');

  // THE SHOWALL SET IS NOT DRAWN, and 0xfb is why. The shipped map has
  // three view modes and only the last draws those bytes; the first two
  // strip them, and the GROUND FLAT is one of them - so folding SHOWALL
  // into the built set drew every patch of scenery as a building. A pin
  // asked whether a ground flat is built-up, got "yes", and that is how
  // this was found.
  assert.ok(SHOWALL_SET.includes(GROUND_FLAT_BYTE), 'the collision is real, not hypothetical');
  assert.equal(isBuilt(GROUND_FLAT_BYTE), false, 'scenery is not architecture');
  for (const b of SHOWALL_SET) assert.equal(isBuilt(b), false, `byte ${b} is the town's furniture`);

  // a player can walk into a shop, a tavern and a temple, and not a house
  for (const b of [...TEMPLE_SET, ...SHOP_SET, TAVERN_BYTE]) assert.equal(isEnterable(b), true, `byte ${b}`);
  for (const b of HOUSE_SET) assert.equal(isEnterable(b), false, `byte ${b} is somebody's home`);
  assert.equal(isEnterable(STREET_BYTE), false);
  // ...and the enterable set is a SUBSET of the built one, or the wash
  // would land outside the wall
  for (const b of [...TEMPLE_SET, ...SHOP_SET, TAVERN_BYTE]) assert.ok(isBuilt(b));
});

test('EM-BUG3: the field is laid in SHEET space, and a grid row runs AGAINST +Z, so the plan and the names cannot mirror', () => {
  // THE ONE ORIENTATION LAW THIS SHEET HAS, and the pin that used to
  // stand here asserted the arithmetic as written rather than the law,
  // so it agreed with the bug for as long as the bug was there. Two
  // things were wrong and this states both as EQUALITIES between the
  // two modules, not as numbers copied out of either.
  //
  //   1. `autoMapData` is an FLD grid and its rows run AGAINST +Z, the
  //      same way `buildGroundTilemap` reads `groundTiles[x][15 - y]`
  //      (world/rmbLayout.js:270). Source row `y` is z-row 63 - y.
  //   2. The sheet draws +Z UPWARD, as the shipped window does once its
  //      two flips are composed, so an anchor row crosses over by
  //      `sheetY`.
  //
  // Put together: wherever a building's anchor lands after `sheetY`,
  // the byte for that same spot must be in that row of the field. That
  // is the whole law, and it is checked across BLOCKS (where a block
  // flip would show) and WITHIN one (where the grid's row order would).
  const rowOf = (f, bx, by, gx, gy) => {
    // the anchor of the building standing on grid cell (gx, gy) of block
    // (bx, by): its z within the block is the z-row the grid row means
    const div = RMB_DIMENSION * 0.025;
    const zRow = BLOCK_PX - 1 - gy;
    const [ax, ay] = nameplateAnchor(bx, by, [(gx / BLOCK_PX) * div, 0, (zRow / BLOCK_PX) * div]);
    return [ax, sheetY(f.h, ay)];
  };
  for (const [gx, gy] of [[0, 0], [0, 63], [7, 5], [63, 63]]) {
    for (const [bx, by] of [[0, 0], [1, 1], [0, 1], [1, 0]]) {
      const f = townBytes(2, 2, [{ x: bx, y: by, autoMap: blockGrid([[gx, gy, gx + 1, gy + 1, SHOP]]) }]);
      const [ax, ay] = rowOf(f, bx, by, gx, gy);
      assert.equal(f.bytes[ay * f.w + ax], SHOP,
        `block (${bx},${by}) grid (${gx},${gy}): the byte is where the anchor puts the building`);
      assert.equal([...f.bytes].filter((b) => b === SHOP).length, 1, 'and in exactly one place');
    }
  }

  const one = blockGrid([[0, 0, 1, 1, SHOP]]);
  const f = townBytes(2, 2, [{ x: 1, y: 1, autoMap: one }]);
  assert.equal(f.w, 128);
  assert.equal(f.h, 128);
  const at = (x, y) => f.bytes[y * f.w + x];
  // block (1,1) is the FAR block in +Z, so it is the TOP half of the
  // sheet - the shipped window's `(gridH-1-b.y)` (exteriorAutomapWindow
  // .js:299), which before this fix was the bottom half
  assert.equal(at(BLOCK_PX, 0), SHOP);
  assert.equal(at(BLOCK_PX, BLOCK_PX), 0, 'and not where the unflipped block order put it');

  // WITHIN a block the grid's rows run against +Z, so source row 5 is
  // five rows from the block's own FAR edge, not from its near one
  const col = townBytes(1, 1, [{ x: 0, y: 0, autoMap: blockGrid([[0, 5, 1, 6, SHOP]]) }]);
  assert.equal(col.bytes[5 * col.w], SHOP, 'local grid y 5 is sheet row 5');
  assert.equal(sheetY(col.h, nameplateAnchor(0, 0, [0, 0, ((BLOCK_PX - 1 - 5) / BLOCK_PX) * (RMB_DIMENSION * 0.025)])[1]), 5,
    'and that is the row the anchor for the same z lands on');

  // A BLOCK OFF ITS OWN GRID IS SKIPPED rather than written anywhere -
  // a location whose block list disagrees with its width is a thing the
  // data does, not a thing that should corrupt the field.
  //
  // THE CASE THAT MATTERS IS THE NEGATIVE ONE, which a mutant taught
  // this pin: a block PAST the right or bottom edge writes past the
  // typed array's end and JavaScript drops it in silence, so dropping
  // the guard looks harmless. A block at a NEGATIVE column does not -
  // `(by + y) * w + bx` lands in the PREVIOUS row and stamps a
  // building into a street sixty-four pixels away.
  const off = townBytes(1, 1, [{ x: 5, y: 5, autoMap: one }]);
  assert.deepEqual([...off.bytes], new Array(BLOCK_PX * BLOCK_PX).fill(0), 'nothing past the end');
  const neg = townBytes(2, 2, [{ x: -1, y: 1, autoMap: blockGrid([[0, 0, BLOCK_PX, BLOCK_PX, SHOP]]) }]);
  assert.deepEqual([...neg.bytes], new Array(neg.w * neg.h).fill(0),
    'and nothing smeared into the row before a negative column');

  // a block with no grid at all is skipped rather than throwing
  assert.doesNotThrow(() => townBytes(1, 1, [{ x: 0, y: 0, autoMap: null }]));
  assert.doesNotThrow(() => townBytes(1, 1, [{ x: 0, y: 0, autoMap: new Uint8Array(4) }]));
  assert.doesNotThrow(() => townBytes(0, 0, null));
});

test('EM-BUG3: the plan, the plates, the rings and the caret all stand in ONE space - the bug Mac saw was them standing in two', () => {
  // Mac, from play (2026-09-21): "enhanced local town maps are rotated
  // wrong... I was in the corner of town and It thinks entirely
  // different buildings are there."
  //
  // This is the pin the slice is FOR, and it is deliberately not about
  // arithmetic: it puts a building and the player on the SAME spot in
  // the world and asks whether they come out on the same spot on the
  // paper. Under the old law they did not - the plan had crossed the
  // grid's row order and the sheet's own flip, and the names, the
  // rings and the caret had crossed neither - so a caret in the corner
  // of town sat on somebody else's roof.
  const div = RMB_DIMENSION * 0.025;
  // one shop, one pixel, at grid (4, 2) of block (1, 0) of a 2x2 town
  const BX = 1, BY = 0, GX = 4, GY = 2;
  const zRow = BLOCK_PX - 1 - GY;                     // the grid's rows run against +Z
  const pos = [(GX / BLOCK_PX) * div, 0, (zRow / BLOCK_PX) * div];
  const s = createTownSheet({
    gridW: 2, gridH: 2,
    blocks: [{ x: BX, y: BY, autoMap: blockGrid([[GX, GY, GX + 1, GY + 1, SHOP]]) }],
    buildings: () => [{ buildingKey: 9, blockX: BX, blockY: BY, position: pos, name: 'The Sign of the Cart', isResidence: false, questName: '' }],
    discovered: () => [{ buildingKey: 9, displayName: 'The Sign of the Cart' }],
    // the player standing AT that building: the host's own conversion,
    // world units in the location frame over WORLD_PER_PX
    player: () => ({ x: (BX * div + pos[0]) / WORLD_PER_PX, y: (BY * div + pos[2]) / WORLD_PER_PX, yaw: 0 }),
  });

  const f = s.field;
  // 1. THE PIXEL. The one built byte is somewhere on the field.
  const lit = [...f.bytes].reduce((acc, b, i) => (b === SHOP ? [...acc, i] : acc), []);
  assert.equal(lit.length, 1, 'one shop, one pixel');
  const px = lit[0] % f.w, py = Math.floor(lit[0] / f.w);

  // 2. THE NAME stands on it.
  const [name] = s.names();
  assert.equal(name.text, 'The Sign of the Cart');
  assert.equal(name.x, px, 'the plate is over its own building, across the block grid');
  assert.equal(name.y, py, 'and in the same row as its own pixels');

  // 3. THE CARET stands on it too - through paintOverlay, which is the
  // path that actually runs, not a getter beside it.
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view: { ox: 0, oy: 0, scale: 1 }, paperW: 4000, paperH: 4000, dpr: 1, pulse: 0 });
  const tip = ctx.calls.filter((c) => c.fn === 'moveTo').at(-1);
  const [ex, ey] = toPaper({ ox: 0, oy: 0, scale: 1 }, px, py);
  assert.ok(Math.abs(tip.args[0] - ex) < 1, 'the caret is on the building the player is standing in');
  assert.ok(Math.abs((ey - tip.args[1]) - CARET_R) < 1e-6, 'and its nose is north, which is UP on this sheet');

  // 4. AND THE SHEET AGREES WITH THE SHIPPED ONE. buildExteriorLayout
  // composes the same two flips ExteriorAutomap.cs does; the two maps
  // of one town must not be mirrors of each other.
  const classic = buildExteriorLayout(2, 2, [{ x: BX, y: BY, autoMap: blockGrid([[GX, GY, GX + 1, GY + 1, SHOP]]) }],
    'original', { tavern: 1, temple: 2, shop: 3, house: 4 });
  const cLit = [...classic.colors].reduce((acc, c, i) => (c !== 0 ? [...acc, i] : acc), []);
  assert.equal(cLit.length, 1);
  assert.equal(cLit[0] % classic.width, px, 'the shipped map puts the same shop in the same column');
  assert.equal(Math.floor(cLit[0] / classic.width), py, 'and the same row');
});

test('EM4: the plan is TRACED - the built-up pixels are an island and the street is its sea', () => {
  // a ten-by-ten shop inside one block
  const g = blockGrid([[10, 10, 20, 20, SHOP]]);
  const f = townBytes(1, 1, [{ x: 0, y: 0, autoMap: g }]);
  const chains = townChains(f, { segments: boundarySegments, link: linkSegments });
  assert.equal(chains.length, 1, 'one building, one shore');
  const xs = chains[0].map((p) => p.x), ys = chains[0].map((p) => p.y);
  assert.equal(Math.min(...xs), 10);
  assert.equal(Math.max(...xs), 20, 'the outline runs along the pixel EDGES, so a ten-wide shop spans 10..20');
  // the chain is CLOSED - it is a coastline
  assert.deepEqual(chains[0][0], chains[0][chains[0].length - 1]);
  assert.ok(Math.min(...ys) >= 0 && Math.max(...ys) <= f.h);
  // two buildings are two shores
  const two = townBytes(1, 1, [{ x: 0, y: 0, autoMap: blockGrid([[2, 2, 6, 6, SHOP], [30, 30, 40, 40, HOUSE]]) }]);
  assert.equal(townChains(two, { segments: boundarySegments, link: linkSegments }).length, 2);
  // and the WASH picks only what you can walk into
  const wash = townChains(two, { segments: boundarySegments, link: linkSegments, pick: isEnterable });
  assert.equal(wash.length, 1, 'the shop, not the house');
  assert.equal(Math.min(...wash[0].map((p) => p.x)), 2);
  // no pair handed in is no chains, rather than a throw
  assert.deepEqual(townChains(f, {}), []);
  assert.deepEqual(townChains(null, { segments: boundarySegments, link: linkSegments }), []);
  // THE READER IS BOUNDED ON ALL FOUR SIDES, and the reason is that
  // `boundarySegments` asks one past every edge. An unbounded reader
  // computes `bytes[y * w + x]` at x = w, which is the NEXT ROW's first
  // pixel - so a building against the right edge of one row reads as
  // present at the left edge of the next and the shore runs off into
  // the wrong street. A mutant taught this pin the fixture it needed:
  // a building that actually touches the edge.
  const r = townReader(f);
  assert.equal(r(-1, 0), false);
  assert.equal(r(0, -1), false);
  assert.equal(r(f.w, 0), false);
  assert.equal(r(0, f.h), false);
  // The fixture has to put a building at the right edge of one row AND
  // at the LEFT edge of the next - a shop that merely touches the edge
  // is not enough, because the pixel an unbounded read wraps onto would
  // be street anyway and the two answers agree by luck. A mutant
  // survived the first version of this for exactly that reason.
  const edge = townBytes(1, 1, [{
    x: 0, y: 0,
    autoMap: blockGrid([[BLOCK_PX - 4, 8, BLOCK_PX, 9, SHOP], [0, 9, 4, 10, SHOP]]),
  }]);
  const er = townReader(edge);
  assert.equal(er(BLOCK_PX - 1, 8), true, 'the building reaches the right edge');
  assert.equal(er(0, 9), true, 'and another sits at the left edge of the row below');
  assert.equal(er(BLOCK_PX, 8), false,
    'one past the right edge is OUTSIDE - an unbounded read finds the row below and joins two streets');
  // ...and the shore it traces closes on the field's own edge
  const ec = townChains(edge, { segments: boundarySegments, link: linkSegments });
  assert.equal(ec.length, 2, 'two buildings, two shores - not one wrapped round the field');
  assert.equal(Math.max(...ec.flat().map((p) => p.x)), BLOCK_PX, 'the shore runs to the edge and stops');
  // ...and there it is OPEN, which is the right answer: a building
  // flush against the town's edge has no shore on that side. The
  // dungeon's plan grows a rim for its coastline to close against; the
  // town's field CANNOT, because a rim would shift its origin out of
  // nameplate-anchor space and break the one law this sheet has. The
  // painter closes every footprint instead (`closePath` per chain), so
  // the straight line it draws along the town's edge is the building's
  // own edge, which is the picture a reader wants anyway.
  const touching = ec.find((c) => c.some((p) => p.x === BLOCK_PX));
  assert.notDeepEqual(touching[0], touching[touching.length - 1], 'an edge-touching shore is open');
  assert.match(src('src/ui/inkTown.js'), /ctx\.closePath\(\);/, 'and the painter closes it');
});

test('EM7: the four QUARTERS go under the WALL, each in classic\'s own hue for it', () => {
  // Mac (2026-09-21): "keep our own version of the colored buildings
  // that classic uses".
  //
  // The first cut washed every ENTERABLE pixel in one flat sepia and
  // left a house as outline alone. Legible, and it threw away the one
  // thing classic's town map has always had: a tavern is green, a
  // temple is tan, a shop is blue, a house is slate, and you find the
  // smith without reading a word.
  const f = townBytes(1, 1, [{ x: 0, y: 0, autoMap: blockGrid([
    [2, 2, 6, 6, SHOP], [10, 10, 14, 14, TEMPLE],
    [20, 20, 24, 24, TAVERN_BYTE], [30, 30, 40, 40, HOUSE],
  ]) }]);
  const plan = {
    chains: townChains(f, { segments: boundarySegments, link: linkSegments }),
    quarters: quarterChains(f, { segments: boundarySegments, link: linkSegments }),
  };
  const ctx = recordingCtx();
  const view = { ox: 0, oy: 0, scale: 4 };
  paintTownStatic(ctx, plan, view, { paperW: 400, paperH: 300, dpr: 1 });
  const fills = ctx.calls.filter((c) => c.fn === 'fill');
  const strokes = ctx.calls.filter((c) => c.fn === 'stroke');

  // ONE FILL PER QUARTER, in the ladder's own order, each in its own
  // hue - and every one of the four present, houses included.
  assert.equal(fills.length, 4, 'one fill per quarter that has any pixels');
  assert.deepEqual(fills.map((c) => c.fillStyle), QUARTERS.map((q) => QUARTER_WASH[q]));
  assert.equal(new Set(fills.map((c) => c.fillStyle)).size, 4, 'four quarters, four colours');
  for (const c of fills) assert.deepEqual(c.args, ['evenodd'], 'a courtyard inside a temple reads as a courtyard');

  // ...and ONE stroke for the whole footprint OVER them. A stroke per
  // quarter would draw a wall two quarters share twice, and it would
  // read heavier than a wall against the street.
  assert.equal(strokes.length, 1, 'one stroke for the whole wall');
  assert.equal(strokes[0].strokeStyle, TOWN_PEN.wall);
  for (const c of fills) {
    assert.ok(ctx.calls.indexOf(c) < ctx.calls.indexOf(strokes[0]), 'every wash is under the wall');
  }

  // A QUARTER WITH NO PIXELS IS NOT PAINTED - a village with no temple
  // must not cost a fill over an empty path.
  const noTemple = townBytes(1, 1, [{ x: 0, y: 0, autoMap: blockGrid([[2, 2, 6, 6, SHOP]]) }]);
  const thin = recordingCtx();
  paintTownStatic(thin, {
    chains: townChains(noTemple, { segments: boundarySegments, link: linkSegments }),
    quarters: quarterChains(noTemple, { segments: boundarySegments, link: linkSegments }),
  }, view, { paperW: 400, paperH: 300, dpr: 1 });
  assert.equal(thin.calls.filter((c) => c.fn === 'fill').length, 1);
  assert.equal(thin.calls.find((c) => c.fn === 'fill').fillStyle, QUARTER_WASH.shop);

  // every path is CLOSED - these are footprints, not open lines
  assert.ok(ctx.calls.filter((c) => c.fn === 'closePath').length >= 5);
  // the wall thins with the zoom, bounded at both ends
  const widthAt = (scale) => {
    const c = recordingCtx();
    paintTownStatic(c, plan, { ox: 0, oy: 0, scale }, { paperW: 400, paperH: 300, dpr: 1 });
    return c.calls.find((x) => x.fn === 'stroke').lineWidth;
  };
  assert.equal(widthAt(0.01), TOWN_WALL_PEN_MIN);
  assert.ok(widthAt(4) > widthAt(1));
  assert.ok(widthAt(1000) <= TOWN_WALL_PEN * 1.6);
  // and the painters are guarded, as every painter in this lane is
  for (const bad of [null, undefined, {}]) {
    assert.doesNotThrow(() => paintTownStatic(bad, plan, view, { paperW: 1, paperH: 1 }));
    assert.doesNotThrow(() => paintTownOverlay(bad, view, { paperW: 1, paperH: 1 }));
  }
  assert.doesNotThrow(() => paintTownStatic(recordingCtx(), null, view, { paperW: 1, paperH: 1 }));
  // a plan from BEFORE the quarters existed paints its wall and no
  // wash, rather than throwing on a field it does not have
  assert.doesNotThrow(() => paintTownStatic(recordingCtx(), { chains: plan.chains }, view, { paperW: 1, paperH: 1 }));
});

test('EM7: the quarters and their colours have ONE HOME, and BOTH skins read it there', () => {
  // The sets used to sit in ui/inkTown.js AND in
  // ui/exteriorAutomapWindow.js at once, which is how the same building
  // could have come to be drawn as a shop on one map and a house on the
  // next. The ladder answers for both now.
  const classic = src('src/ui/exteriorAutomapWindow.js');
  assert.match(classic, /from '\.\/townQuarters\.js'/, 'the classic window asks the one home');
  for (const dead of [/const TEMPLE_SET = new Set/, /const SHOP_SET = new Set/,
    /const HOUSE_SET = new Set/, /const SHOWALL_SET = new Set/, /const TAVERN_BYTE = /]) {
    assert.doesNotMatch(classic, dead, 'a second copy of the groups is a second answer');
  }
  // ...and not one of DFU's four defaults is typed there any more - the
  // paint, the three caption swatches and the enhanced sheet all read
  // the same table.
  for (const argb of Object.values(CLASSIC_ARGB)) {
    assert.doesNotMatch(classic, new RegExp(`0x${argb.toString(16)}`), 'a fourth copy of a colour');
  }
  assert.equal(Object.keys(CLASSIC_ARGB).length, QUARTERS.length);
  assert.equal(Object.keys(CLASSIC_SETTING).length, QUARTERS.length);
  for (const q of QUARTERS) assert.match(CLASSIC_SETTING[q], /^Automap\w+Color$/);

  // THE LADDER IS THE ONE THING isBuilt AND isEnterable ARE MADE OF -
  // derived, not a pair of sets kept beside it, so a byte regrouped
  // moves every answer at once.
  const inkSrc = src('src/ui/inkTown.js');
  assert.match(inkSrc, /isBuilt = \(byte\) => quarterOf\(byte\) !== null/);
  assert.doesNotMatch(inkSrc, /new Set\(\[/, 'a set here is a set that can drift from the ladder');
  for (const b of [...TEMPLE_SET, ...SHOP_SET, TAVERN_BYTE, ...HOUSE_SET]) {
    assert.equal(isBuilt(b), quarterOf(b) !== null);
  }
  assert.equal(quarterOf(TEMPLE_SET[0]), 'temple');
  assert.equal(quarterOf(SHOP_SET[0]), 'shop');
  assert.equal(quarterOf(TAVERN_BYTE), 'tavern');
  assert.equal(quarterOf(HOUSE_SET[0]), 'house');
  assert.equal(quarterOf(STREET_BYTE), null);
  for (const b of SHOWALL_SET) {
    assert.equal(quarterOf(b), null, 'the town\'s furniture is not a quarter');
    assert.equal(isShowAllByte(b), true);
  }
  assert.equal(isShowAllByte(SHOP_SET[0]), false);

  // AND THE PLUS-ONE IS WRITTEN ONCE. A summary carries buildingType;
  // the grid carries that type PLUS ONE. Two spellings of that offset
  // is how a tavern's name comes to be lettered over a temple.
  for (const b of [...TEMPLE_SET, ...SHOP_SET, TAVERN_BYTE, ...HOUSE_SET]) {
    assert.equal(quarterOfType(b - 1), quarterOf(b), `type ${b - 1} is byte ${b}`);
  }
  assert.equal(quarterOfType(null), null);
  assert.equal(quarterOfType(undefined), null);
});

test('EM7: every quarter\'s wash and ink are DERIVED from classic\'s own colour for it', () => {
  // Not picked by eye. A pin can therefore ask whether the tavern's
  // wash is still the tavern's GREEN rather than merely whether it is
  // still some string, and a change to either law moves all four.
  for (const q of QUARTERS) {
    const c = argbChannels(CLASSIC_ARGB[q]);
    assert.equal(QUARTER_WASH[q], quarterWash(c), `${q}'s wash is the law's answer`);
    assert.equal(QUARTER_INK[q], quarterInk(c), `${q}'s ink is the law's answer`);
    // the wash IS classic's hue, channel for channel, at a
    // watercolour's strength - the paper reads through it
    assert.equal(QUARTER_WASH[q], `rgba(${c.r}, ${c.g}, ${c.b}, ${QUARTER_WASH_A})`);
    assert.ok(QUARTER_WASH_A > 0 && QUARTER_WASH_A < 0.5, 'a wash, not a fill');
    // the ink is that hue walked most of the way to the PEN: dark
    // enough to letter with, tinted enough to tell a temple from a
    // smith without reading either
    assert.equal(QUARTER_INK[q], rgba(mixRgb([c.r, c.g, c.b], INK_RGB, QUARTER_INK_MIX), 0.95));
    assert.ok(QUARTER_INK_MIX > 0.5 && QUARTER_INK_MIX < 1, 'ink, and still its own hue');
  }
  // FOUR QUARTERS, FOUR COLOURS A PERSON CAN TELL APART - and that is
  // MEASURED, not asserted by inequality. Four different strings is
  // what the first cut checked, and it passed at a wash alpha where
  // the tavern's green and the house's slate composited to within 9.8
  // of each other over the parchment: a difference you can find when
  // you look for it and not one you READ. A wash pulls every hue
  // toward the paper, so the only honest question is what comes out
  // the other side.
  assert.equal(new Set(Object.values(QUARTER_WASH)).size, QUARTERS.length);
  assert.equal(new Set(Object.values(QUARTER_INK)).size, QUARTERS.length);
  const washed = (q) => {
    const c = argbChannels(CLASSIC_ARGB[q]);
    return mixRgb([...PARCHMENT_RGB], [c.r, c.g, c.b], QUARTER_WASH_A);   // over the paper
  };
  const inked = (q) => {
    const c = argbChannels(CLASSIC_ARGB[q]);
    return mixRgb([c.r, c.g, c.b], [...INK_RGB], QUARTER_INK_MIX);
  };
  for (let i = 0; i < QUARTERS.length; i++) {
    for (let j = i + 1; j < QUARTERS.length; j++) {
      const [a, b] = [QUARTERS[i], QUARTERS[j]];
      assert.ok(deltaE(washed(a), washed(b)) >= QUARTER_WASH_DE,
        `${a} and ${b} wash to within ${deltaE(washed(a), washed(b)).toFixed(1)} of each other`);
      assert.ok(deltaE(inked(a), inked(b)) >= QUARTER_INK_DE,
        `${a} and ${b} letter to within ${deltaE(inked(a), inked(b)).toFixed(1)} of each other`);
    }
    // ...and an ink stands off the PAPER, or it is a wash
    assert.ok(deltaE(inked(QUARTERS[i]), [...PARCHMENT_RGB]) >= QUARTER_INK_PAPER_DE,
      `${QUARTERS[i]}'s ink is too near the parchment to letter with`);
  }
  // the alpha is the SMALLEST that clears the floor, not the largest
  // the sheet can bear - a wash that passes by being opaque is a fill
  const quieter = (a) => (q) => {
    const c = argbChannels(CLASSIC_ARGB[q]);
    return mixRgb([...PARCHMENT_RGB], [c.r, c.g, c.b], a);
  };
  const minPair = (f) => Math.min(...QUARTERS.flatMap((a, i) =>
    QUARTERS.slice(i + 1).map((b) => deltaE(f(a), f(b)))));
  assert.ok(minPair(quieter(QUARTER_WASH_A - 0.04)) < QUARTER_WASH_DE,
    'the alpha has room to come down, so it is not the smallest that works');
  // THE STATIC KEY NAMES WHAT IS INKED, quarters included - EM3
  // learned this on the other sheet, where a key that read the cache
  // made a storey change answer "none" and the kept ink layer showed
  // the old plan under the new rule. A key that names only the
  // footprint keeps an old wash under a new outline the same way.
  const plain = createTownSheet({
    gridW: 1, gridH: 1,
    blocks: [{ x: 0, y: 0, autoMap: blockGrid([[2, 2, 10, 10, SHOP]]) }],
  });
  const mixed = createTownSheet({
    gridW: 1, gridH: 1,
    blocks: [{ x: 0, y: 0, autoMap: blockGrid([[2, 2, 6, 6, SHOP], [6, 2, 10, 6, TAVERN_BYTE]]) }],
  });
  plain.ensure(); mixed.ensure();
  assert.notEqual(plain.staticKey(), mixed.staticKey(),
    'two towns with the same footprint and different quarters ink differently');

  // and none of it is written out in the ink module
  assert.doesNotMatch(src('src/ui/inkTown.js'), /rgba?\(/);
  assert.doesNotMatch(src('src/ui/townQuarters.js'), /rgba?\(/);
  // the mixing law is the one home for the strings
  assert.equal(rgba([1.4, 2.6, 3], 0.5), 'rgba(1, 3, 3, 0.5)');
  assert.deepEqual(mixRgb([0, 0, 0], [10, 20, 30], 0.5), [5, 10, 15]);
  assert.deepEqual(mixRgb([4, 4, 4], [8, 8, 8], 0), [4, 4, 4]);
});

// ── THE SHEET ───────────────────────────────────────────────────────

const GRID = blockGrid([[2, 2, 10, 10, SHOP], [30, 30, 40, 40, HOUSE]]);
const summary = (key, over = {}) => ({
  buildingKey: key, blockX: 0, blockY: 0, position: [20 + 30 * key, 0, 20 + 30 * key],
  name: `Canonical ${key}`, isResidence: false, questName: '', ...over,
});
const townDeps = (over = {}) => ({
  gridW: 1, gridH: 1, blocks: [{ x: 0, y: 0, autoMap: GRID }],
  buildings: () => [summary(1), summary(2, { isResidence: true })],
  discovered: () => [{ buildingKey: 1, displayName: 'The Rusty Nail' }],
  player: () => ({ x: 20, y: 20, yaw: 0 }),
  title: 'Daggerfall',
  ...over,
});
const sheet = (over = {}) => createTownSheet(townDeps(over));
const PAPER = { paperW: 400, paperH: 300, dpr: 1 };
const VIEW = { ox: 0, oy: 0, scale: 4 };

test('EM4: the town answers the whole sheet contract, from OUTSIDE the window', () => {
  const s = sheet();
  assert.equal(s.id, 'town');
  assert.ok(isSheet(s), 'a member of the contract is missing');
  for (const m of SHEET_MEMBERS) assert.ok(m in s, `${m} is not even a key`);
  const text = src('src/ui/townSheet.js')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.doesNotMatch(text, /\bdocument\b|\bglobalThis\b|heldMap|renderer/);
});

test('EM4: the space is LAYOUT PIXELS and already starts at zero', () => {
  const s = sheet();
  assert.deepEqual(s.size(), { width: BLOCK_PX, height: BLOCK_PX });
  const big = sheet({ gridW: 3, gridH: 2 });
  assert.deepEqual(big.size(), { width: 3 * BLOCK_PX, height: 2 * BLOCK_PX });
  // every chain lies inside it, so the window's clamp needs no shifting
  for (const chain of s.plan.chains) {
    for (const p of chain) {
      assert.ok(p.x >= 0 && p.x <= s.size().width, `x ${p.x} is off the field`);
      assert.ok(p.y >= 0 && p.y <= s.size().height, `y ${p.y} is off the field`);
    }
  }
  // ...and so does a nameplate anchor, by construction
  const [ax, ay] = nameplateAnchor(0, 0, [50, 0, 50]);
  assert.ok(ax >= 0 && ay >= 0);
  // a town with no blocks is a quiet nothing
  const empty = createTownSheet({ gridW: 0, gridH: 0, blocks: [] });
  assert.deepEqual(empty.size(), { width: BLOCK_PX, height: BLOCK_PX });
  assert.equal(empty.ensure(), null, 'nothing to ink');
  assert.doesNotThrow(() => empty.paintStatic(recordingCtx(), { view: VIEW, ...PAPER }));
  assert.doesNotThrow(() => empty.paintOverlay(recordingCtx(), { view: VIEW, ...PAPER, pulse: 0 }));
  assert.ok(createTownSheet().hoverLabel(0, 0));
});

test('EM4: THE NAME LADDER is the shipped map\'s own - it is the discovery law, not a style', () => {
  // a discovered shop shows its discovered name
  assert.deepEqual(sheet().names().map((n) => n.text), ['The Rusty Nail']);
  // the player's own name for it WINS over the canonical one
  const custom = sheet({ discovered: () => [{ buildingKey: 1, displayName: 'The Rusty Nail', customUserDisplayName: 'my smith' }] });
  assert.deepEqual(custom.names().map((n) => n.text), ['my smith']);
  // an UNDISCOVERED building shows nothing at all...
  const dark = sheet({ discovered: () => [] });
  assert.deepEqual(dark.names(), []);
  // ...unless the console has been told to reveal them
  const revealed = sheet({ discovered: () => [], revealAll: () => true });
  assert.deepEqual(revealed.names().map((n) => n.text).sort(), ['Canonical 1', 'Canonical 2']);
  // A DISCOVERED RESIDENCE IS NAMED ONLY BY A QUEST
  const home = sheet({
    buildings: () => [summary(2, { isResidence: true, questName: '' })],
    discovered: () => [{ buildingKey: 2, displayName: 'Someone\'s House' }],
  });
  assert.deepEqual(home.names(), [], 'a home you have found is still nobody\'s business');
  const wanted = sheet({
    buildings: () => [summary(2, { isResidence: true, questName: 'Ser Kithlan' })],
    discovered: () => [{ buildingKey: 2, displayName: 'Someone\'s House' }],
  });
  assert.deepEqual(wanted.names().map((n) => n.text), ['Ser Kithlan']);
  assert.equal(wanted.names()[0].quest, true, 'and it is marked as a quest\'s');
  // ...and an OVERRIDDEN residence name is shown like any other building
  const renamed = sheet({
    buildings: () => [summary(2, { isResidence: true })],
    discovered: () => [{ buildingKey: 2, displayName: 'The Safe House', isOverrideName: true }],
  });
  assert.deepEqual(renamed.names().map((n) => n.text), ['The Safe House']);
  // a building with no name at all gets no plate
  const nameless = sheet({ buildings: () => [summary(1, { name: '' })], discovered: () => [{ buildingKey: 1 }] });
  assert.deepEqual(nameless.names(), []);
});

test('EM4: a quest-marked residence gets a RING, named or not', () => {
  const s = sheet({
    buildings: () => [summary(2, { isResidence: true, questName: 'Ser Kithlan' })],
    discovered: () => [{ buildingKey: 2 }],
  });
  assert.equal(s.quests().length, 1);
  const [ax, ay] = nameplateAnchor(0, 0, [80, 0, 80]);
  // EM-BUG3: a ring crosses into SHEET space with the plates and the
  // caret - the one transform, or the ring hangs over the wrong roof
  assert.deepEqual(s.quests()[0], { x: ax, y: sheetY(s.field.h, ay) });
  // an UNDISCOVERED quest residence is not rung - the map does not give
  // the quest away before the player has found the door
  const hidden = sheet({
    buildings: () => [summary(2, { isResidence: true, questName: 'Ser Kithlan' })],
    discovered: () => [],
  });
  assert.deepEqual(hidden.quests(), []);
  // and the ring is inked in the pen the world map rings a choice in
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view: VIEW, ...PAPER, pulse: 1 });
  const ring = ctx.calls.find((c) => c.fn === 'arc');
  assert.ok(ring);
  assert.equal(ring.strokeStyle, TOWN_PEN.quest);
  assert.equal(ring.args[2], QUEST_R + 2, 'and it breathes');
});

test('EM4: the names are haloed, in the sheet\'s own hand, and a quest\'s is in its own pen', () => {
  const s = sheet({
    buildings: () => [summary(1), summary(2, { isResidence: true, questName: 'Ser Kithlan' })],
    discovered: () => [{ buildingKey: 1, displayName: 'The Rusty Nail' }, { buildingKey: 2 }],
  });
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view: VIEW, ...PAPER, pulse: 0 });
  const ink = ctx.calls.filter((c) => c.fn === 'fillText');
  const halo = ctx.calls.filter((c) => c.fn === 'strokeText');
  assert.equal(ink.length, 2);
  assert.equal(halo.length, 2, 'every name is haloed first (MAP-FIELD6)');
  for (const h of halo) { assert.equal(h.strokeStyle, TOWN_PEN.halo); assert.equal(h.lineWidth, 2 * HALO_PEN); }
  assert.ok(ctx.calls.indexOf(halo[0]) < ctx.calls.indexOf(ink[0]));
  const by = Object.fromEntries(ink.map((c) => [c.args[0], c.fillStyle]));
  assert.equal(by['The Rusty Nail'], TOWN_PEN.name);
  assert.equal(by['Ser Kithlan'], TOWN_PEN.quest, 'a quest\'s name is in the quest\'s pen');
  for (const c of ink) assert.match(c.font, /Cormorant/, 'in the sheet\'s own hand');
});

test('EM8: a name is lettered in ITS OWN QUARTER\'S ink - the same ladder its pixels went through', () => {
  // Mac (2026-09-21): "let's enhance the location names on the
  // buildings more."
  //
  // A town plan is read to FIND something. The wash already says a
  // tavern is green; the WORD saying so too is what lets a player pick
  // the tavern out of a dense quarter without reading every plate in
  // it. The ladder is the one the building's own PIXELS went through,
  // reached through quarterOfType, so the word and the wash under it
  // cannot come to disagree about what the building is.
  // EM-BUG3: a 2x2 town, because `summary`'s positions walk out past
  // one block's own 102.4 world units by key 3 - inside a 1x1 town
  // those three buildings stand OUTSIDE it, and a sheet that draws +Z
  // upward correctly puts them off the top of the paper rather than
  // off the bottom where they used to be drawn anyway.
  const s = sheet({
    gridW: 2,
    gridH: 2,
    blocks: [{ x: 0, y: 0, autoMap: GRID }, { x: 1, y: 1, autoMap: GRID }],
    buildings: () => [
      summary(1, { buildingType: TAVERN_BYTE - 1 }),
      summary(2, { buildingType: TEMPLE - 1 }),
      summary(3, { buildingType: SHOP - 1 }),
      summary(4, { buildingType: HOUSE - 1, isResidence: true, questName: 'Ser Kithlan' }),
      summary(5, {}),   // a summary with no type at all
    ],
    discovered: () => [1, 2, 3, 4, 5].map((k) => ({ buildingKey: k })),
  });
  const rows = Object.fromEntries(s.names().map((n) => [n.key, n]));
  assert.equal(rows[1].quarter, 'tavern');
  assert.equal(rows[2].quarter, 'temple');
  assert.equal(rows[3].quarter, 'shop');
  assert.equal(rows[4].quarter, 'house');
  assert.equal(rows[5].quarter, null, 'a summary with no type is not guessed at');

  // a sheet of paper big enough to hold all five, so what is missing
  // below is missing because of the INK law and not because it ran off
  const WIDE = { paperW: 4000, paperH: 4000, dpr: 1 };
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view: VIEW, ...WIDE, pulse: 0 });
  const drawn = ctx.calls.filter((c) => c.fn === 'fillText');
  assert.equal(drawn.length, 5, 'all five are on the paper');
  const by = Object.fromEntries(drawn.map((c) => [c.args[0], c.fillStyle]));
  assert.equal(by['Canonical 1'], QUARTER_INK.tavern);
  assert.equal(by['Canonical 2'], QUARTER_INK.temple);
  assert.equal(by['Canonical 3'], QUARTER_INK.shop);
  // A QUEST STILL OVERRIDES. A quest is why the map is open at all, and
  // it outranks knowing that the building is somebody's house.
  assert.equal(by['Ser Kithlan'], TOWN_PEN.quest);
  // ...and a name whose quarter is unknown is still INKED, in the
  // sheet's plain name pen - an unknown type is not a missing name.
  assert.equal(by['Canonical 5'], TOWN_PEN.name);

  // THE SIZE SAYS IT TOO. The landmarks a player steers off stand a
  // little proud of the run of shops, and a quest stands proud of
  // everything - as a RATIO of the zoom's size, so the band still
  // bounds every plate.
  const at = Object.fromEntries(s.platesAt({ ox: 0, oy: 0, scale: 4 }, 4000, 4000, null).map((r) => [r.text, r]));
  assert.ok(at['Canonical 1'].size > at['Canonical 3'].size, 'a tavern is a landmark, a shop is a shop');
  assert.ok(at['Canonical 2'].size > at['Canonical 3'].size, 'and so is a temple');
  assert.equal(at['Canonical 1'].size, at['Canonical 2'].size, 'both landmarks, one weight');
  assert.ok(at['Ser Kithlan'].size > at['Canonical 1'].size, 'and a quest over both');
  assert.equal(QUEST_WEIGHT, Math.max(QUEST_WEIGHT, ...Object.values(NAME_WEIGHT)));
  assert.equal(NAME_WEIGHT.shop, 1, 'the run of shops is the baseline, not a shrunk one');
  for (const w of Object.values(NAME_WEIGHT)) assert.ok(w >= 1 && w < 1.5, 'a nudge, not a headline');
  // THE BAND BOUNDS THE BASELINE AND THE WEIGHT RIDES ON TOP, and that
  // order is load-bearing: multiplying INSIDE the clamp looked right
  // and quietly threw the hierarchy away at both ends of the zoom -
  // past scale 2.4 every plate is already at NAME_SIZE_MAX, so a
  // landmark and the shop beside it came out identical exactly where
  // the map is most read. A weight is a RATIO against the names beside
  // it, so it holds at every zoom, and the true ceiling is the band's
  // own times the largest weight there is.
  const huge = Object.fromEntries(
    s.platesAt({ ox: 0, oy: 0, scale: 400 }, 40000, 40000, null).map((r) => [r.text, r]));
  for (const r of Object.values(huge)) assert.ok(r.size <= NAME_SIZE_MAX * QUEST_WEIGHT);
  assert.equal(huge['Canonical 3'].size, NAME_SIZE_MAX, 'the baseline is what the band bounds');
  assert.equal(huge['Canonical 1'].size, NAME_SIZE_MAX * NAME_WEIGHT.tavern,
    'and a landmark is still proud of it at the top of the zoom');
  const tiny = Object.fromEntries(
    s.platesAt({ ox: 0, oy: 0, scale: NAME_ZOOM_MIN }, 40000, 40000, null).map((r) => [r.text, r]));
  assert.ok(tiny['Canonical 1'].size > tiny['Canonical 3'].size, 'and at the bottom of the zoom too');
  assert.equal(tiny['Canonical 1'].size / tiny['Canonical 3'].size, NAME_WEIGHT.tavern,
    'the same ratio at the bottom as at the top - that is what a ratio is for');
  // ...AND NAME_SIZE_MIN IS A FLOOR THE ZOOM GATE ALREADY KEEPS THEM
  // ABOVE, which is worth knowing rather than assuming: the baseline
  // only reaches it below scale (NAME_SIZE_MIN/NAME_SIZE)^2, and no
  // name is laid at all under NAME_ZOOM_MIN, which is higher. It is a
  // guard against a future band, not a size anything is lettered at.
  assert.ok(tiny['Canonical 3'].size > NAME_SIZE_MIN);
  assert.ok((NAME_SIZE_MIN / NAME_SIZE) ** 2 < NAME_ZOOM_MIN, 'the floor sits below the gate');
});

test('EM8: a plate TICKS its building, and leads back to it only once it has been moved', () => {
  // The solver displaces plates vertically to untangle them, which
  // means a name's own position is not reliably its building's. A dot
  // at the anchor says which footprint the words belong to, always; a
  // LEADER is drawn only when the words have gone far enough to be read
  // against the wrong building. The line is information, not
  // decoration, so a plate that did not move gets none.
  const view = { ox: 0, oy: 0, scale: 4 };
  const s = sheet({
    buildings: () => [summary(1, { buildingType: SHOP - 1 })],
    discovered: () => [{ buildingKey: 1 }],
  });
  const rows = s.platesAt(view, 400, 300, null);
  assert.equal(rows.length, 1);
  // EVERY PLATE CARRIES ITS ANCHOR, whether it moved or not
  const [ax, ay] = nameplateAnchor(0, 0, summary(1).position);
  const [px, py] = toPaper(view, ax, sheetY(s.field.h, ay));   // EM-BUG3: through sheet space, as the plate is
  assert.ok(Math.abs(rows[0].x - px) < 1e-9);
  assert.ok(Math.abs(rows[0].anchorY - py) < 1e-9, 'the anchor is where the BUILDING is');
  assert.equal(rows[0].y, rows[0].anchorY, 'and this one had nothing to be untangled from');

  // A LONE PLATE GETS A TICK AND NO LEADER.
  const ctx = recordingCtx();
  paintTownOverlay(ctx, view, { ...PAPER, plates: rows, pulse: 0 });
  const arcs = ctx.calls.filter((c) => c.fn === 'arc');
  assert.equal(arcs.length, 1, 'one tick');
  assert.equal(arcs[0].args[2], ANCHOR_R);
  assert.ok(Math.abs(arcs[0].args[0] - rows[0].x) < 1e-9);
  assert.ok(Math.abs(arcs[0].args[1] - rows[0].anchorY) < 1e-9, 'the tick is on the building');
  assert.equal(arcs[0].fillStyle, QUARTER_INK.shop, 'and in the building\'s own ink');
  assert.equal(ctx.calls.filter((c) => c.fn === 'moveTo').length, 0, 'it did not move, so nothing points at it');

  // A DISPLACED PLATE GETS BOTH, and the leader stops SHORT of the
  // lettering rather than running into it.
  const moved = [{ ...rows[0], y: rows[0].anchorY - rows[0].size * 4 }];
  const led = recordingCtx();
  paintTownOverlay(led, view, { ...PAPER, plates: moved, pulse: 0 });
  // ...AND ITS TICK IS STILL ON THE BUILDING. Held HERE and not on
  // the lone plate above, because a lone plate's words ARE at its
  // anchor - a mutant that ticked p.y instead of the anchor walked
  // straight past that pin, and this is the fixture that can see it.
  const ledArc = led.calls.find((c) => c.fn === 'arc');
  assert.ok(Math.abs(ledArc.args[1] - moved[0].anchorY) < 1e-9, 'the tick does not follow the words');
  assert.ok(Math.abs(ledArc.args[1] - moved[0].y) > 1, 'and the two are far apart here, so the pin can tell');
  const from = led.calls.find((c) => c.fn === 'moveTo');
  const to = led.calls.find((c) => c.fn === 'lineTo');
  assert.ok(Math.abs(from.args[1] - moved[0].anchorY) < 1e-9, 'the leader starts at the building');
  assert.ok(to.args[1] > moved[0].y, 'and stops short of the words');
  assert.ok(to.args[1] < moved[0].anchorY, 'without reaching back past them');
  assert.equal(led.calls.find((c) => c.fn === 'stroke').strokeStyle, TOWN_PEN.lead);

  // THE THRESHOLD IS THE PLATE'S OWN HEIGHT, so it rides the lettering
  // rather than needing a number per zoom - and it is a real threshold:
  // a nudge smaller than it draws nothing.
  const nudged = [{ ...rows[0], y: rows[0].anchorY + rows[0].size * LEAD_AT * 0.5 }];
  const quiet = recordingCtx();
  paintTownOverlay(quiet, view, { ...PAPER, plates: nudged, pulse: 0 });
  assert.equal(quiet.calls.filter((c) => c.fn === 'moveTo').length, 0, 'a nudge is not a displacement');

  // ...AND THE TICKS AND LEADERS GO DOWN FIRST, so a name is never
  // crossed by the line that points at it.
  assert.ok(led.calls.findIndex((c) => c.fn === 'stroke') < led.calls.findIndex((c) => c.fn === 'fillText'));
  assert.ok(led.calls.findIndex((c) => c.fn === 'arc') < led.calls.findIndex((c) => c.fn === 'strokeText'));
});

test('EM4: the names are lettered for the ZOOM, and not laid at all when the town is fitted whole', () => {
  const s = sheet();
  const big = s.platesAt({ ox: 0, oy: 0, scale: 8 }, 400, 300, null);
  const small = s.platesAt({ ox: 0, oy: 0, scale: 1 }, 400, 300, null);
  assert.ok(big.length && small.length);
  assert.ok(big[0].size > small[0].size, 'a street zoomed into letters its names larger');
  assert.ok(big[0].size <= NAME_SIZE_MAX && small[0].size >= NAME_SIZE_MIN, 'bounded at both ends');
  // at a whole-town fit the names are a grey band rather than words, so
  // none is laid and the solver's work is not spent
  assert.deepEqual(s.platesAt({ ox: 0, oy: 0, scale: NAME_ZOOM_MIN - 0.01 }, 400, 300, null), []);
  assert.ok(s.platesAt({ ox: 0, oy: 0, scale: NAME_ZOOM_MIN }, 400, 300, null).length > 0);
  // only what is ON the paper is solved for
  assert.deepEqual(s.platesAt({ ox: 5000, oy: 5000, scale: 4 }, 400, 300, null), []);
  // EM5: ...AND THE TAB STRIP'S BAND IS NOT THE PAPER, for a name. The
  // browser probe's first town shot had "The Rusty Nail" written
  // straight through "Town". The plan's own lines may still run under a
  // tab - a wall under a word is fine, and the halo carries the word -
  // but a name may not.
  const at = s.platesAt({ ox: 0, oy: 0, scale: 4 }, 400, 300, null);
  assert.ok(at.length > 0);
  const band = Math.max(...at.map((r) => r.y)) + 1;
  assert.deepEqual(s.platesAt({ ox: 0, oy: 0, scale: 4 }, 400, 300, null, band), [],
    'a band that covers them all leaves none');
  assert.equal(s.platesAt({ ox: 0, oy: 0, scale: 4 }, 400, 300, null, 0).length, at.length,
    'and no band leaves them all');
  // and the layout is CACHED on the view - it is the most expensive
  // thing this sheet does and the view moves far more often than the town
  const view = { ox: 0, oy: 0, scale: 4 };
  let asked = 0;
  const counted = sheet({ buildings: () => { asked++; return [summary(1)]; } });
  counted.platesAt(view, 400, 300, null);
  const once = asked;
  for (let i = 0; i < 10; i++) counted.platesAt(view, 400, 300, null);
  assert.equal(asked, once, 'the same view is the same plates');
  counted.platesAt({ ox: 40, oy: 0, scale: 4 }, 400, 300, null);
  assert.ok(asked > once, 'a moved view is laid again');
});

test('EM4: the plates land where the nameplate anchors say, and the solver may move one DOWN only', () => {
  const s = sheet();
  const view = { ox: 0, oy: 0, scale: 4 };
  const rows = s.platesAt(view, 400, 300, null);
  assert.equal(rows.length, 1);
  const [ax, ay] = nameplateAnchor(0, 0, [50, 0, 50]);
  const [px, py] = toPaper(view, ax, sheetY(s.field.h, ay));   // EM-BUG3: sheet space
  assert.equal(rows[0].x, px, 'x is the anchor, through the view');
  assert.ok(rows[0].y >= py, 'y is the anchor, or below it where the solver stepped it down');
  // two names on ONE anchor: the solver separates them rather than
  // letting them smear, and neither is dropped
  const stacked = sheet({
    buildings: () => [summary(1), summary(3, { position: [50, 0, 50], name: 'Canonical 3' })],
    discovered: () => [{ buildingKey: 1, displayName: 'One' }, { buildingKey: 3, displayName: 'Two' }],
  });
  const two = stacked.platesAt(view, 400, 300, null);
  assert.equal(two.length, 2, 'both are laid');
  assert.notEqual(two[0].y, two[1].y, 'and they do not sit on top of each other');
});

test('EM4: the caret says which way the player faces, and does not scale with the zoom', () => {
  const s = sheet();
  const ctx = recordingCtx();
  s.paintOverlay(ctx, { view: VIEW, ...PAPER, pulse: 0 });
  // EM-BUG3: the host hands the player in ANCHOR space and the sheet
  // draws +Z upward, so the caret's expected place crosses over the
  // same way the plates do. The HEADING is untouched by that - north
  // was always drawn straight up, which is exactly why it disagreed
  // with a plan that ran +Z downward.
  const [cx, cy] = toPaper(VIEW, 20, sheetY(s.field.h, 20));
  // EM8 put ticks and leaders on this overlay, which also moveTo and
  // fill - the caret is drawn LAST and in its own pen, so ask for it
  // rather than for whatever moved first.
  const tip = ctx.calls.filter((c) => c.fn === 'moveTo').at(-1);
  assert.ok(Math.abs(tip.args[0] - cx) < 1e-9);
  assert.ok(Math.abs((cy - tip.args[1]) - CARET_R) < 1e-9, 'facing north is straight up, CARET_R long');
  const far = recordingCtx();
  s.paintOverlay(far, { view: { ox: 0, oy: 0, scale: 0.2 }, ...PAPER, pulse: 0 });
  const [fx, fy] = toPaper({ ox: 0, oy: 0, scale: 0.2 }, 20, sheetY(s.field.h, 20));
  const ft = far.calls.filter((c) => c.fn === 'moveTo').at(-1);
  assert.ok(Math.abs((fy - ft.args[1]) - CARET_R) < 1e-9, 'a cursor, not a building');
  assert.ok(Math.abs(ft.args[0] - fx) < 1e-9);
  // a host with no player draws none, rather than one at the origin
  const nobody = sheet({ player: () => null });
  const none = recordingCtx();
  nobody.paintOverlay(none, { view: VIEW, ...PAPER, pulse: 0 });
  assert.equal(none.calls.some((c) => c.fn === 'fill' && c.fillStyle === TOWN_PEN.caret), false);
  assert.equal(none.calls.some((c) => c.fn === 'moveTo'), false, 'and no caret path at all');
});

test('EM4: at rest the whole town is on the sheet, centred on the player', () => {
  const s = sheet();
  const limits = { mapW: s.size().width, mapH: s.size().height, paperW: 400, paperH: 300 };
  const home = s.homeView(limits);
  assert.equal(home.scale, scaleMinOf(limits) / FIT_MARGIN);
  assert.ok(Math.abs((home.ox + limits.paperW / (2 * home.scale)) - 20) < 1e-6);
  assert.ok(Math.abs((home.oy + limits.paperH / (2 * home.scale)) - sheetY(s.field.h, 20)) < 1e-6,
    'EM-BUG3: the rest view centres on the caret where the caret actually is');
  const nobody = sheet({ player: () => null });
  assert.deepEqual(nobody.homeView(limits), { ox: 0, oy: 0, scale: scaleMinOf(limits) });
});

test('EM4: a name under the pointer answers itself, and elsewhere the town does', () => {
  const s = sheet();
  const view = { ox: 0, oy: 0, scale: 4 };
  s.paintOverlay(recordingCtx(), { view, ...PAPER, pulse: 0 });
  const row = s.platesAt(view, 400, 300, null)[0];
  assert.deepEqual(s.hoverLabel(row.x, row.y), { label: 'The Rusty Nail', cursor: 'pointer' });
  assert.deepEqual(s.hoverLabel(row.x + 300, row.y + 200), { label: 'Daggerfall', cursor: '' });
});

test('EM4 / EM5: a name is never laid under a gauntlet', () => {
  // THE PAPER'S RECTANGLE IS NOT THE PART OF IT A PLAYER CAN SEE. The
  // hands hold the sheet at its lower corners, and EM5's browser probe
  // zoomed the town in and left the one surviving nameplate squarely
  // under the left glove. The plan's own LINES still run under a thumb
  // - a wall behind a hand is a wall you pan to see - but a word there
  // is a word nobody gets.
  const s = sheet();
  const view = { ox: 0, oy: 0, scale: 4 };
  const all = s.platesAt(view, 400, 300, null);
  assert.ok(all.length > 0);
  // a hand over the whole paper leaves nothing
  const whole = [{ x0: -1e4, y0: -1e4, x1: 1e4, y1: 1e4 }];
  assert.deepEqual(s.platesAt(view, 400, 300, null, 0, whole), []);
  // a hand over nothing leaves them all
  assert.equal(s.platesAt(view, 400, 300, null, 0, []).length, all.length);
  assert.equal(s.platesAt(view, 400, 300, null, 0, null).length, all.length);
  // and a hand over exactly one plate's box leaves the rest
  const one = all[0];
  const box = [{ x0: one.x - 1, y0: one.y - 1, x1: one.x + 1, y1: one.y + 1 }];
  const left = s.platesAt(view, 400, 300, null, 0, box);
  assert.equal(left.length, all.length - 1, 'the covered one, and only it');
  assert.ok(!left.some((r) => r.text === one.text));
});

test('EM4 / EM5: the window puts the sprite\'s own thumb zones into PAPER space', () => {
  // The zones are measured on the SPRITE (MAP-FIELD4 keyed the
  // gauntlets out of it pixel by pixel) and PAPER is measured on the
  // same sprite, so one division carries them over. Held at the source
  // because the arithmetic is the kind that is right or mirrored, and
  // nothing in a harness can see which.
  const held = src('src/ui/heldMap.js');
  assert.match(held, /_handRects\(paperW, paperH\)/, 'the window computes them');
  assert.match(held, /reserveHands: this\._handRects\(paperW, paperH\)/, 'and hands them to the live sheet');
  assert.match(held, /\(v - PAPER\.x0\) \/ \(PAPER\.x1 - PAPER\.x0\)/, 'through PAPER\'s own rectangle');
  assert.match(held, /THUMB_ZONES\.map/, 'over the sprite\'s own measured zones');
  // the zones really do cover the paper's lower corners and not its top
  const fy = (v) => (v - 0.198) / (0.703 - 0.198);
  assert.ok(fy(0.410) > 0.35, 'the hands start below the sheet\'s upper third');
  assert.ok(fy(0.725) > 1, 'and run off its bottom edge');
});
