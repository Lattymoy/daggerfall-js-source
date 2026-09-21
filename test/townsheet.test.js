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
  TEMPLE_SET, SHOP_SET, TAVERN_BYTE, HOUSE_SET, SHOWALL_SET, GROUND_FLAT_BYTE, STREET_BYTE,
  townBytes, townChains, townReader, isBuilt, isEnterable, paintTownStatic, paintTownOverlay,
} from '../src/ui/inkTown.js';
import { createTownSheet, NAME_ZOOM_MIN, NAME_SIZE_MIN, NAME_SIZE_MAX, FIT_MARGIN } from '../src/ui/townSheet.js';
import { isSheet, SHEET_MEMBERS } from '../src/ui/mapStrip.js';
import { PEN, HALO_PEN, boundarySegments, linkSegments, toPaper, scaleMinOf } from '../src/ui/inkMap.js';
import { nameplateAnchor } from '../src/ui/nameplateLayout.js';

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

test('EM4: the town is drawn in the BAY\'s pen - not one colour is invented here', () => {
  for (const [name, value] of Object.entries(TOWN_PEN)) {
    assert.ok(Object.values(PEN).includes(value), `TOWN_PEN.${name} is a colour inkMap does not have`);
  }
  const text = src('src/ui/inkTown.js');
  assert.match(text, /import \{ PEN, HALO_PEN, NAME_FACE, toPaper, paintCaret, CARET_R \} from '\.\/inkMap\.js';/);
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

test('EM4: the field is laid in NAMEPLATE-ANCHOR space, so the plan and the names cannot mirror', () => {
  // THE ONE ORIENTATION LAW THIS SHEET HAS. The shipped town map flips
  // twice - once inside the block and once across the block grid - and
  // its net effect DISAGREES with nameplateAnchor across blocks: higher
  // blockY is a lower row in that texture and a HIGHER row in the
  // anchor. It gets away with it because the two reach the screen down
  // different paths. This sheet draws them as one picture, so they have
  // to agree, and the anchor is the one obeyed: it is the names, and
  // the names are the point.
  //
  // What a pin CANNOT settle is whether the picture is the right way up
  // against the world - that is one composed rotation either way and
  // nothing here renders anything. It is a browser probe's question and
  // Mac's eyes', and it is written down rather than assumed.
  const one = blockGrid([[0, 0, 1, 1, SHOP]]);
  const f = townBytes(2, 2, [{ x: 1, y: 1, autoMap: one }]);
  assert.equal(f.w, 128);
  assert.equal(f.h, 128);
  const at = (x, y) => f.bytes[y * f.w + x];
  // block (1,1)'s local (0,0) lands at layout pixel (64, 64) - exactly
  // where nameplateAnchor puts a building at that block's origin
  assert.equal(at(BLOCK_PX, BLOCK_PX), SHOP);
  assert.equal(at(0, 0), 0, 'and nowhere else');
  const [ax, ay] = nameplateAnchor(1, 1, [0, 0, 0]);
  assert.equal(ax, BLOCK_PX, 'the anchor agrees about the column');
  assert.equal(ay, BLOCK_PX, 'and about the row');

  // the block's own rows run DOWN the field, as the anchor's z does
  const col = townBytes(1, 1, [{ x: 0, y: 0, autoMap: blockGrid([[0, 5, 1, 6, SHOP]]) }]);
  assert.equal(col.bytes[5 * col.w], SHOP, 'local y 5 is field row 5');

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

test('EM4: the WASH goes under the WALL, and a house is outline alone', () => {
  const f = townBytes(1, 1, [{ x: 0, y: 0, autoMap: blockGrid([[2, 2, 6, 6, SHOP], [30, 30, 40, 40, HOUSE]]) }]);
  const plan = {
    chains: townChains(f, { segments: boundarySegments, link: linkSegments }),
    wash: townChains(f, { segments: boundarySegments, link: linkSegments, pick: isEnterable }),
  };
  const ctx = recordingCtx();
  const view = { ox: 0, oy: 0, scale: 4 };
  paintTownStatic(ctx, plan, view, { paperW: 400, paperH: 300, dpr: 1 });
  const fills = ctx.calls.filter((c) => c.fn === 'fill');
  const strokes = ctx.calls.filter((c) => c.fn === 'stroke');
  assert.equal(fills.length, 1, 'one fill for the whole wash');
  assert.equal(fills[0].fillStyle, TOWN_PEN.wash);
  assert.deepEqual(fills[0].args, ['evenodd'], 'a courtyard inside a temple reads as a courtyard');
  assert.equal(strokes.length, 1, 'and one stroke for the whole wall');
  assert.equal(strokes[0].strokeStyle, TOWN_PEN.wall);
  assert.ok(ctx.calls.indexOf(fills[0]) < ctx.calls.indexOf(strokes[0]), 'the wash is under the wall');
  // every path is CLOSED - these are footprints, not open lines
  assert.ok(ctx.calls.filter((c) => c.fn === 'closePath').length >= 3);
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
});

// ── THE SHEET ───────────────────────────────────────────────────────

const GRID = blockGrid([[2, 2, 10, 10, SHOP], [30, 30, 40, 40, HOUSE]]);
const summary = (key, over = {}) => ({
  buildingKey: key, blockX: 0, blockY: 0, position: [10 * key, 0, 10 * key],
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
  const [ax, ay] = nameplateAnchor(0, 0, [10, 0, 10]);
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
  const [ax, ay] = nameplateAnchor(0, 0, [20, 0, 20]);
  assert.deepEqual(s.quests()[0], { x: ax, y: ay });
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
  const [ax, ay] = nameplateAnchor(0, 0, [10, 0, 10]);
  const [px, py] = toPaper(view, ax, ay);
  assert.equal(rows[0].x, px, 'x is the anchor, through the view');
  assert.ok(rows[0].y >= py, 'y is the anchor, or below it where the solver stepped it down');
  // two names on ONE anchor: the solver separates them rather than
  // letting them smear, and neither is dropped
  const stacked = sheet({
    buildings: () => [summary(1), summary(3, { position: [10, 0, 10], name: 'Canonical 3' })],
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
  const [cx, cy] = toPaper(VIEW, 20, 20);
  const tip = ctx.calls.find((c) => c.fn === 'moveTo');
  assert.ok(Math.abs(tip.args[0] - cx) < 1e-9);
  assert.ok(Math.abs((cy - tip.args[1]) - CARET_R) < 1e-9, 'facing north is straight up, CARET_R long');
  const far = recordingCtx();
  s.paintOverlay(far, { view: { ox: 0, oy: 0, scale: 0.2 }, ...PAPER, pulse: 0 });
  const [fx, fy] = toPaper({ ox: 0, oy: 0, scale: 0.2 }, 20, 20);
  const ft = far.calls.find((c) => c.fn === 'moveTo');
  assert.ok(Math.abs((fy - ft.args[1]) - CARET_R) < 1e-9, 'a cursor, not a building');
  assert.ok(Math.abs(ft.args[0] - fx) < 1e-9);
  // a host with no player draws none, rather than one at the origin
  const nobody = sheet({ player: () => null });
  const none = recordingCtx();
  nobody.paintOverlay(none, { view: VIEW, ...PAPER, pulse: 0 });
  assert.equal(none.calls.some((c) => c.fn === 'fill'), false);
});

test('EM4: at rest the whole town is on the sheet, centred on the player', () => {
  const s = sheet();
  const limits = { mapW: s.size().width, mapH: s.size().height, paperW: 400, paperH: 300 };
  const home = s.homeView(limits);
  assert.equal(home.scale, scaleMinOf(limits) / FIT_MARGIN);
  assert.ok(Math.abs((home.ox + limits.paperW / (2 * home.scale)) - 20) < 1e-6);
  assert.ok(Math.abs((home.oy + limits.paperH / (2 * home.scale)) - 20) < 1e-6);
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
