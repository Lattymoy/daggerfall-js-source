// NAME1 (2026-09-16, Mac: "Player names clip and cut off the top of the sprite head and additionally grow in size
// the further away + are able to be seen through walls") and
// BUBBLE1 (2026-09-16, Mac: "I want to introduce chat bubbles above the player when they chat"):
// THE NAMES OVER THE OTHERS AND WHAT THEY SAY, driven headless.
//
// THREE LAWS AND A FACE. The anchor (a label's BOTTOM edge sits a fixed gap above the head point, at every
// distance), the size (perspective, clamped both ends) and the sight (a wall between the eye and the head hides the
// name) all belong to net/remotePlayers.js namePoints, so they are driven there with plain numbers - and the sight
// one is driven against the REAL player/collider.js with a real wall in it, because the whole claim is that the
// name obeys the same triangles the player cannot walk through. The DOM layer (src/ui/nameLayer.js) is driven over
// a fake document of this file's own - test/soc4_partyhud.test.js's shape, COPIED rather than shared, with the same
// write counter, because "one element per peer, moved and never rebuilt" is a claim only a counter can hold.
//
// THE BUBBLES are driven the same way: a line into a real ChatLog, the layer pumped, the bubble read off the DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RemotePlayers, nameScaleFor, sightBlockedBy, createSightCache,
  nameLensScale, nameViewportScale, namePixelSize,
  NAME_GAP_PX, NAME_BASE_PX, NAME_SCALE_REF, NAME_SCALE_MIN, NAME_SCALE_MAX, NAME_SIGHT_SKIN, NAME_RANGE, PEER_HEIGHT,
  NAME_REF_H, NAME_REF_FOV, NAME_PX_MIN, NAME_PX_MAX, NAME_SIGHT_MS, NAME_SIGHT_HOLD_MS,
  NAME_MARK, NAME_MARK_GAP_PX,
} from '../src/net/remotePlayers.js';
import {
  createNameLayer, injectNameStyle, cssRgba, bubbleAlpha, bubbleText, bubbleSaid, bubbleLineOk, nameLayerWanted,
  NAME_STYLE_ID, NAME_CSS, BUBBLE_TAB, BUBBLE_MS, BUBBLE_HOLD, BUBBLE_MAX, BUBBLE_CHARS, BUBBLE_ELLIPSIS,
} from '../src/ui/nameLayer.js';
import { Collider } from '../src/player/collider.js';
import { ChatLog } from '../src/net/chat.js';
import { SocialState, PARTY_GREEN, PARTY_GREEN_CSS } from '../src/net/social.js';
import { PIXEL_STACK } from '../src/ui/pixelifyFive.js';
import { projectToScreen } from '../src/player/tapRay.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';
import { hasGlyph, FNT_SPACE_CODE } from '../src/ui/text.js';   // ACC1d-MARK: the font's own glyph range, so the badge is checked against the face that draws it

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ── THE FAKE DOCUMENT (test/soc4_partyhud.test.js's shape, copied - not shared) ────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, id: '', attrs: {}, writes: 0,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } doc.structure++; },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.writes++; doc.writes++; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); n.writes++; doc.writes++; } });
  n.style = new Proxy({}, { set(t, k, v) { t[k] = v; n.writes++; doc.writes++; return true; } });
  return n;
}
function fakeDocument() {
  const doc = { writes: 0, structure: 0, built: 0 };
  doc.createElement = (tag) => { doc.built++; return fakeNode(tag, doc); };
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  doc.zero = () => { doc.writes = 0; doc.structure = 0; doc.built = 0; };
  return doc;
}

// ── THE STUBS THE NAME PASS DRAWS THROUGH (PERF-ON's own shape) ────────────────────────────────────

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
const recorder = () => {
  const runs = [], quads = [];
  return {
    runs, quads,
    drawScreenQuad: (tex, dst, src, color) => quads.push({ tex, dst, src, color }),
    drawScreenQuadRun: (tex, qs, color) => runs.push({ tex, quads: qs, color }),
  };
};
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
const VIEW = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
const EYE = [0, 1.7, 0];
const W = 1600, H = 900;

/** Peers standing in Morrowind bodies (the MWBODY1 arm: no doll composed, the name still rides). */
const stand = (rows) => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  const heights = new Map(rows.map((r) => [r.id, r.height ?? PEER_HEIGHT]));
  // ACC1d-MARK: `v` is EXPLICIT in the fixture, and the default is NOT
  // VOUCHED - the plain label, which is what every one of these pins is
  // written about (the anchor, the size, the sight test, the two faces)
  // and what an ordinary peer is today, since the account window is an
  // offer rather than a gate. A row that wants the badge asks for it
  // (`v: true`); the mark's own pin is the one that does.
  rp.sync(rows.map((r) => ({ id: r.id, name: r.name ?? r.id.toUpperCase(), v: r.v === true, shown: { x: r.at[0], y: r.at[1], z: r.at[2], yaw: 0 }, look: null })),
    (p) => [p.x, p.y, p.z], { bodyHeight: (id) => heights.get(id) ?? 0 });
  return rp;
};

// ── THE ANCHOR ────────────────────────────────────────────────────────────────────────────────────

test('NAME1 (2026-09-16, Mac: "Player names clip and cut off the top of the sprite head"): the point is the HEAD TOP - feet + the body\'s own height, with no world lift of its own - and the label\'s BOTTOM edge lands NAME_GAP_PX above it, never over it, at every distance (mutants: the old + 0.25 lift back; the label drawn from its top at the point; the gap dropped or negated; the body height read as the doll\'s)', () => {
  // the head point itself: feet + height and nothing else, for a body and for a doll alike
  const rp = stand([{ id: 'a', at: [0, 0, -10], height: 2.2 }, { id: 'b', at: [3, 0, -10], height: PEER_HEIGHT }]);
  const pts = rp.namePoints(PROJ, VIEW, W, H, EYE, (p) => [p.x, p.y, p.z]);
  assert.deepEqual(pts.map((n) => n.id), ['a', 'b']);
  const headA = projectToScreen([0, 2.2, -10], W, H, PROJ, VIEW, null);
  const headB = projectToScreen([3, PEER_HEIGHT, -10], W, H, PROJ, VIEW, null);
  assert.ok(Math.abs(pts[0].y - headA.y) < 1e-9, 'the body\'s own capsule head, exactly');
  assert.ok(Math.abs(pts[1].y - headB.y) < 1e-9, 'and the doll\'s own h, exactly');
  assert.ok(Math.abs(pts[0].y - projectToScreen([0, 2.2 + 0.25, -10], W, H, PROJ, VIEW, null).y) > 1, 'the + 0.25 world lift is GONE - it was the clip\'s other half');

  // the drawn label: its bottom edge is the gap above the head, at TWO very different depths
  for (const z of [-4, -28]) {
    const one = stand([{ id: 'x', at: [0, 0, z], height: 1.8 }]);
    const [p] = one.namePoints(PROJ, VIEW, W, H, EYE, (q) => [q.x, q.y, q.z]);
    const r = recorder();
    assert.equal(one.drawNames(r, FONT, PROJ, VIEW, W, H, EYE, 1, (q) => [q.x, q.y, q.z]), 1);
    const q = r.runs[0].quads;
    const top = Math.min(...q.map((g) => g.dst.y));
    const bottom = Math.max(...q.map((g) => g.dst.y + g.dst.h));
    assert.ok(bottom <= p.y - NAME_GAP_PX + 1, `at z=${z} the label ends ${p.y - bottom} px above the head, which is at least the gap`);
    assert.ok(top < bottom, 'and it has a height');
    assert.ok(bottom < p.y, 'nothing of the label is ever at or below the head point');
    // centred on the head, not hung off it to the right
    const left = Math.min(...q.map((g) => g.dst.x));
    const right = Math.max(...q.map((g) => g.dst.x + g.dst.w));
    assert.ok(Math.abs((left + right) / 2 - p.x) < 4, 'centred over the head');
  }
});

// ── THE SIZE ──────────────────────────────────────────────────────────────────────────────────────

test('NAME1 (Mac: "additionally grow in size the further away"): the size is PERSPECTIVE - NAME_SCALE_REF / depth, clamped at both ends, so a peer twice as far wears a name half as big and the far name is never the bigger one (mutants: a constant scale; depth / REF; the clamps dropped or swapped; the clamp order inverted)', () => {
  // the law, by value
  assert.equal(nameScaleFor(NAME_SCALE_REF), 1, 'scale 1 at the reference depth');
  assert.equal(nameScaleFor(24), NAME_SCALE_REF / 24);
  assert.equal(nameScaleFor(30), NAME_SCALE_REF / 30);
  assert.equal(nameScaleFor(NAME_SCALE_REF / NAME_SCALE_MAX), NAME_SCALE_MAX, 'the near clamp bites exactly at REF / MAX');
  assert.equal(nameScaleFor(1), NAME_SCALE_MAX, 'and holds all the way in');
  assert.equal(nameScaleFor(NAME_SCALE_REF / NAME_SCALE_MIN), NAME_SCALE_MIN, 'the far clamp bites exactly at REF / MIN');
  assert.equal(nameScaleFor(NAME_RANGE), NAME_SCALE_MIN, 'and holds out to the edge of NAME_RANGE');
  assert.equal(nameScaleFor(0), NAME_SCALE_MAX, 'a point on the lens is as near as a point can be, not infinitely large');
  assert.equal(nameScaleFor(NaN), NAME_SCALE_MAX);
  assert.ok(NAME_SCALE_MIN < 1 && 1 < NAME_SCALE_MAX, 'the band straddles 1, or the reference means nothing');
  // HALF AT DOUBLE, inside the band - the whole of "perspective"
  for (const d of [12.5, 14, 16]) assert.ok(Math.abs(nameScaleFor(2 * d) - nameScaleFor(d) / 2) < 1e-12, `${d} -> ${2 * d}: half`);   // both ends inside the band, which runs REF/MAX .. REF/MIN
  // monotone non-increasing across the whole drawable range, and strictly decreasing inside the band
  let prev = Infinity;
  for (let d = 0.5; d <= NAME_RANGE; d += 0.5) { const s = nameScaleFor(d); assert.ok(s <= prev + 1e-12, `not monotone at ${d}`); prev = s; }
  assert.ok(nameScaleFor(13) > nameScaleFor(26) && nameScaleFor(26) > nameScaleFor(31), 'strictly smaller the further out, inside the band');

  // the point carries it, off its own projected depth
  const rp = stand([{ id: 'near', at: [0, 0, -6], height: 1.8 }, { id: 'far', at: [0, 0, -30], height: 1.8 }]);
  const [near, far] = rp.namePoints(PROJ, VIEW, W, H, EYE, (p) => [p.x, p.y, p.z]);
  assert.ok(Math.abs(near.depth - 6) < 1e-4 && Math.abs(far.depth - 30) < 1e-4, 'the depth is the lens\' own clip w');
  // AUDIT NAME1 F3: the point's scale is the depth law TIMES the frame's lens term, and this frame's lens IS the
  // reference one (60 degrees) - so these are equal to the precision a Float32Array projection can hold it in.
  assert.ok(Math.abs(near.scale - nameScaleFor(near.depth)) < 1e-6);
  assert.ok(Math.abs(far.scale - nameScaleFor(far.depth)) < 1e-6);
  assert.ok(far.scale < near.scale, 'THE BUG, inverted: the far name is the SMALL one');

  // and the drawn label is actually smaller on screen
  const r = recorder();
  rp.drawNames(r, FONT, PROJ, VIEW, W, H, EYE, 1, (p) => [p.x, p.y, p.z]);
  const widthOf = (run) => Math.max(...run.quads.map((g) => g.dst.x + g.dst.w)) - Math.min(...run.quads.map((g) => g.dst.x));
  assert.ok(widthOf(r.runs[1]) < widthOf(r.runs[0]) * 0.75, 'five times the distance, well under three quarters the width');
  assert.ok(r.runs[0].quads[0].dst.h === FNT.fixedHeight * near.scale, 'the host scale (1 here) times the point\'s own');
});

// ── THE WALL ──────────────────────────────────────────────────────────────────────────────────────

/** A real Collider with a real wall in it: a quad at z = -5 spanning x -2..2, y 0..5. */
function walled() {
  const c = new Collider();
  const positions = [-2, 0, -5, 2, 0, -5, 2, 5, -5, -2, 5, -5];
  c.addMesh('wall', positions, [0, 1, 2, 0, 2, 3], new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  return c;
}

test('NAME1 (Mac: "are able to be seen through walls"): a name is not drawn when solid world stands between the eye and the head - the SAME collider raycast the activation ladder rejects a target behind a wall with, driven against a real wall; a peer beside the wall keeps their name; a host with no collider draws every name as it always did (mutants: the sight test dropped; the hit read as a miss; the skin grown past the wall; the test applied before the range cull so a blocked peer still costs a ray)', () => {
  const collider = walled();
  const eye = [0, 1.7, 0];
  assert.equal(sightBlockedBy(collider, eye, [0, 1.8, -10]), true, 'straight through the wall: blocked');
  assert.equal(sightBlockedBy(collider, eye, [8, 1.8, -10]), false, 'the ray passes the wall\'s edge at x = 4: seen');
  assert.equal(sightBlockedBy(collider, eye, [0, 1.8, -3]), false, 'this side of the wall: seen');
  assert.equal(sightBlockedBy(collider, eye, [0, 14, -10]), false, 'over the wall (it is five units tall): seen');
  assert.equal(sightBlockedBy(null, eye, [0, 1.8, -10]), false, 'no collider is no wall - the probe hosts keep every name');
  assert.equal(sightBlockedBy({}, eye, [0, 1.8, -10]), false, 'and neither is an object that cannot cast');
  // THE SKIN: a surface within NAME_SIGHT_SKIN of the head is the head's own ground, not a wall in front of it
  const near = new Collider();
  near.addMesh('lip', [-2, 0, -9.9, 2, 0, -9.9, 2, 5, -9.9, -2, 5, -9.9], [0, 1, 2, 0, 2, 3], new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  assert.ok(NAME_SIGHT_SKIN > 0.1, 'the skin is a head\'s scale, not a hair\'s');
  assert.equal(sightBlockedBy(near, eye, [0, 1.8, -10]), false, 'a surface inside the skin does not blind the name');
  assert.equal(sightBlockedBy(near, eye, [0, 1.8, -10], 0.01), true, '...and with the skin taken away it would - so the skin is doing the work');

  // through namePoints: the blocked peer is dropped and the one beside the wall is kept
  const rp = stand([{ id: 'hidden', at: [0, 0, -10], height: 1.8 }, { id: 'seen', at: [8, 0, -10], height: 1.8 }]);
  const blocked = (head) => sightBlockedBy(collider, eye, head);
  assert.deepEqual(rp.namePoints(PROJ, VIEW, W, H, eye, (p) => [p.x, p.y, p.z], null, blocked).map((n) => n.id), ['seen']);
  assert.deepEqual(rp.namePoints(PROJ, VIEW, W, H, eye, (p) => [p.x, p.y, p.z]).map((n) => n.id), ['hidden', 'seen'], 'no test passed, no test done');
  const r = recorder();
  assert.equal(rp.drawNames(r, FONT, PROJ, VIEW, W, H, eye, 1, (p) => [p.x, p.y, p.z], null, null, blocked), 1, 'the bitmap face takes the same word');
  // THE RAY IS THE LAST CULL: a peer out of NAME_RANGE never costs one
  let rays = 0;
  const counting = (head) => { rays++; return sightBlockedBy(collider, eye, head); };
  const far = stand([{ id: 'miles', at: [0, 0, -(NAME_RANGE + 10)], height: 1.8 }]);
  assert.equal(far.namePoints(PROJ, VIEW, W, H, eye, (p) => [p.x, p.y, p.z], null, counting).length, 0);
  assert.equal(rays, 0, 'out of range is decided before a ray is ever cast');
});

test('NAME1: the sight test is the ENGINE\'S OWN and says what it cannot see - the collider\'s raycast, the live mode-aware one, and the exterior terrain named as the limit (mutants: a second ray law written here; the limit left unsaid)', () => {
  const src = rd('src/net/remotePlayers.js');
  assert.match(src, /collider\.raycast\(\[eye\[0\], eye\[1\], eye\[2\]\], \[dx \/ d, dy \/ d, dz \/ d\], reach\)/, 'one ray, the collider\'s own');
  assert.match(src, /TERRAIN is not one of them/, 'the limit is written down where the law is');
  assert.match(src, /pickActivatableHit|pickFoeAlong/, 'and it cites the two picks that already ask this question');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const blocked = \(head, id\) => nameSight\.blocked\(player\.collider, eye, id, head\);/,
    'the host casts against player.collider - the LIVE one worldModes re-points at every door - through the session\'s own cache (AUDIT NAME1 F2/F5)');
  assert.match(rd('src/scenes/worldModes.js'), /player\.collider = ctx\.collider;/, 'and worldModes really does re-point it (the interior and the dungeon)');
});

// ── THE FACE ──────────────────────────────────────────────────────────────────────────────────────

const pointsOf = (rows) => rows.map((r) => ({ id: r.id, name: r.name ?? r.id.toUpperCase(), x: r.x ?? 100, y: r.y ?? 200, scale: r.scale ?? 1 }));

test('NAME1: the enhanced face - a DOM layer in PIXEL_STACK on bone, one element per visible peer built once and MOVED thereafter, the label anchored by its bottom edge, the party green carried through from the picture\'s own answer, and the whole thing hidden under a window (mutants: the layer rebuilt per frame; the anchor at the top; a second green written down; the layer left up under a window; the layer eating clicks)', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  assert.equal(doc.getElementById(NAME_STYLE_ID)?.tagName, 'STYLE', 'the sheet');
  injectNameStyle(doc);
  assert.equal([doc.head, ...doc.head.children].filter((n) => n.id === NAME_STYLE_ID).length, 1, 'injected once');
  assert.ok(NAME_CSS.includes(`font-family: ${PIXEL_STACK};`), 'the enhanced skin\'s own stack (ui/pixelifyFive.js), never a second spelling of it');
  assert.match(NAME_CSS, /-webkit-font-smoothing: none;/, 'unsmoothed, as every other enhanced surface is');
  // AUDIT NAME1 F4: UNDER the HUD, not level with it - at 4 it tied with .hud and every readout beside it, and a
  // tie goes to the later element, which is this one.
  assert.match(NAME_CSS, /\.dfnames \{ position: fixed; inset: 0; z-index: 3; pointer-events: none;/, 'over the world, under the HUD, taking no click');
  assert.ok(Number(/\.dfnames \{[^}]*z-index: (\d+)/.exec(NAME_CSS)[1]) < 4, 'strictly below the HUD\'s own level');
  assert.match(NAME_CSS, /transform: translate\(-50%, -100%\);/, 'THE ANCHOR: the stack grows UP from the point, so its bottom edge is on it');
  // AUDIT NAME1 F12: --bone's OWN fallback (ui/enhancedStyle.js :root), the one the party and friends panels use.
  assert.match(NAME_CSS, /color: var\(--bone, #e9e4d9\)/, 'bone');
  assert.doesNotMatch(NAME_CSS.replace(/\/\*[\s\S]*?\*\//g, ' '), /#d8cfae/, 'and not .hud\'s ivory, which is a different colour wearing the same word');
  assert.match(rd('src/ui/enhancedStyle.js'), /--bone: #e9e4d9;/, '...which is the token\'s real value');
  assert.match(rd('src/ui/partyPanel.js'), /var\(--bone, #e9e4d9\)/, '...and the sibling panel\'s own fallback');
  assert.match(NAME_CSS, /max-width: 15em;/, 'and the bubble wraps at a bounded width');
  assert.equal(layer.root.attrs['aria-hidden'], 'true');
  assert.equal(layer.root.style.display, 'none', 'nothing before the first frame says there is somebody to label');

  const social = new SocialState();
  social.apply({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', friends: [], in: [], out: [], invites: [],
    party: { id: 'p1', leader: 'acct-me', members: [{ acct: 'acct-me', name: 'Mac', online: true, seen: 1, peers: ['me'] }, { acct: 'acct-b', name: 'Bran', online: true, seen: 1, peers: ['bran'] }] } });
  const colorOf = (id) => social.colorOf(id) ?? null;

  layer.render({ points: pointsOf([{ id: 'bran', x: 100, y: 300, scale: 1 }, { id: 'zed', x: 400, y: 260, scale: 0.5 }]), colorOf });
  assert.equal(layer.tagCount(), 2);
  assert.equal(layer.root.style.display, '');
  const bran = layer.tagFor('bran');
  assert.equal(bran.name.textContent, 'BRAN');
  assert.equal(bran.node.style.left, '100px');
  assert.equal(bran.node.style.top, `${300 - NAME_GAP_PX}px`, 'the element sits the gap ABOVE the head point and grows upward from there');
  assert.equal(bran.node.style.fontSize, `${NAME_BASE_PX.toFixed(1)}px`, 'the reference frame: the base size, exactly');
  // AUDIT NAME1 F3: half the scale is half the face until the legible floor takes over - 8 px is not a word.
  assert.equal(layer.tagFor('zed').node.style.fontSize, `${NAME_PX_MIN.toFixed(1)}px`, 'half the scale, held at the floor');
  assert.equal(namePixelSize(0.5), NAME_PX_MIN, '...which is the law\'s own answer, not this layer\'s');
  assert.equal(namePixelSize(0.75), NAME_BASE_PX * 0.75, 'and inside the band it is simply the base times the scale');
  // THE GREEN IS THE PICTURE'S, converted - not a second constant
  assert.equal(bran.name.style.color, PARTY_GREEN_CSS, 'my party\'s tab, green');
  assert.equal(layer.tagFor('zed').name.style.color, '', 'a stranger keeps the sheet\'s bone');
  assert.equal(cssRgba(PARTY_GREEN), PARTY_GREEN_CSS, 'and the conversion IS the CSS green - one home, in net/social.js');
  assert.equal(cssRgba(null), null);
  assert.equal(cssRgba([2, -1, 0.5]), '#ff0080', 'clamped, not wrapped');

  // MOVED, NOT REBUILT
  doc.zero();
  layer.render({ points: pointsOf([{ id: 'bran', x: 140, y: 300, scale: 1 }, { id: 'zed', x: 400, y: 260, scale: 0.5 }]), colorOf });
  assert.equal(doc.built, 0, 'a frame that moves a name builds nothing');
  assert.equal(doc.structure, 0, 'and re-parents nothing');
  assert.equal(bran.node.style.left, '140px');
  assert.ok(doc.writes > 0 && doc.writes <= 2, 'one write for the one thing that moved');
  doc.zero();
  layer.render({ points: pointsOf([{ id: 'bran', x: 140, y: 300, scale: 1 }, { id: 'zed', x: 400, y: 260, scale: 0.5 }]), colorOf });
  assert.equal(doc.writes, 0, 'a frame where nothing changed writes NOTHING');

  // a peer gone takes their element with them
  layer.render({ points: pointsOf([{ id: 'zed', x: 400, y: 260, scale: 0.5 }]), colorOf });
  assert.equal(layer.tagCount(), 1);
  assert.equal(layer.tagFor('bran'), null);
  assert.equal(bran.node.removed, true);
  // a window over the HUD
  layer.render({ points: pointsOf([{ id: 'zed' }]), covered: true, colorOf });
  assert.equal(layer.root.style.display, 'none');
  layer.render({ points: [], colorOf });
  assert.equal(layer.root.style.display, 'none', 'and nobody in view is nothing to draw');
  layer.destroy();
  assert.equal(layer.root.removed, true);
  assert.equal(layer.render({ points: pointsOf([{ id: 'zed' }]) }), 0, 'a dead layer draws nothing');
});

// ── THE BUBBLES ───────────────────────────────────────────────────────────────────────────────────

const line = (over = {}) => ({ id: 'bran', name: 'Bran', text: 'hello there', at: 1, mine: false, ...over });

test('BUBBLE1 (2026-09-16, Mac: "I want to introduce chat bubbles above the player when they chat"): a WORLD line stands over its peer\'s name for BUBBLE_MS and fades, the newest replaces the one before it, and it is gone after the window (mutants: the bubble over the wrong peer; the window unbounded; the older line winning; the fade inverted)', () => {
  const doc = fakeDocument();
  const clock = { t: 10000 };
  const layer = createNameLayer({ doc, now: () => clock.t });
  const log = new ChatLog({ now: () => clock.t });
  const pts = pointsOf([{ id: 'bran' }, { id: 'zed', x: 400 }]);

  layer.render({ points: pts, log });
  assert.equal(layer.bubbleCount(), 0, 'nobody has said anything');
  assert.equal(layer.tagFor('bran').bubble.className, 'dfname-bubble off');

  log.push(BUBBLE_TAB, line({ text: 'hello there' }));
  assert.equal(layer.render({ points: pts, log }), 1, 'one bubble');
  assert.equal(layer.tagFor('bran').bubble.textContent, 'hello there');
  assert.equal(layer.tagFor('bran').bubble.className, 'dfname-bubble', 'shown');
  assert.equal(layer.tagFor('zed').bubble.className, 'dfname-bubble off', 'over the SPEAKER, and nobody else');
  assert.equal(layer.tagFor('bran').bubble.style.opacity, '1.00', 'full while it holds');

  // the newest replaces the previous
  clock.t += 1000;
  log.push(BUBBLE_TAB, line({ text: 'and another thing' }));
  layer.render({ points: pts, log });
  assert.equal(layer.bubbleCount(), 1, 'one bubble a peer, never a stack');
  assert.equal(layer.tagFor('bran').bubble.textContent, 'and another thing');

  // the fade, then gone
  clock.t += BUBBLE_MS * BUBBLE_HOLD;
  layer.render({ points: pts, log });
  assert.equal(layer.tagFor('bran').bubble.style.opacity, '1.00', 'the last moment of the hold is still full');
  clock.t += BUBBLE_MS * (1 - BUBBLE_HOLD) / 2;
  layer.render({ points: pts, log });
  const mid = Number(layer.tagFor('bran').bubble.style.opacity);
  assert.ok(mid > 0 && mid < 1, `half way through the fade: ${mid}`);
  clock.t += BUBBLE_MS;
  assert.equal(layer.render({ points: pts, log }), 0, 'past the window: gone');
  assert.equal(layer.tagFor('bran').bubble.className, 'dfname-bubble off');

  // the curve itself
  assert.equal(bubbleAlpha(0), 1);
  assert.equal(bubbleAlpha(BUBBLE_MS * BUBBLE_HOLD - 1), 1);
  assert.equal(bubbleAlpha(BUBBLE_MS), 0);
  assert.equal(bubbleAlpha(BUBBLE_MS + 1), 0);
  assert.equal(bubbleAlpha(-1), 0);
  assert.ok(Math.abs(bubbleAlpha(BUBBLE_MS * (BUBBLE_HOLD + (1 - BUBBLE_HOLD) / 2)) - 0.5) < 1e-12, 'linear down the tail');
  assert.ok(bubbleAlpha(BUBBLE_MS * 0.9) < bubbleAlpha(BUBBLE_MS * 0.8), 'and it goes DOWN');
});

test('BUBBLE1: the refusals and the bound - no bubble for a peer nobody is drawing, none for a system line, none for my own line, none for another tab, and at most BUBBLE_MAX at once with the newest kept (mutants: the refusals dropped; the cap lifted; the oldest kept; a refused line read twice)', () => {
  const doc = fakeDocument();
  const clock = { t: 10000 };
  const layer = createNameLayer({ doc, now: () => clock.t });
  const log = new ChatLog({ now: () => clock.t });
  const pts = pointsOf([{ id: 'bran' }]);

  // the law, by itself
  assert.equal(bubbleLineOk(BUBBLE_TAB, line()), true);
  assert.equal(bubbleLineOk(BUBBLE_TAB, { ...line(), system: true }), false, 'the hub\'s own notices say nothing over a head');
  assert.equal(bubbleLineOk(BUBBLE_TAB, { ...line(), mine: true }), false, 'and neither do mine - I have no body in my own view');
  assert.equal(bubbleLineOk('guild', line()), false, 'a later channel tab inherits the refusal');
  assert.equal(bubbleLineOk(BUBBLE_TAB, { ...line(), id: '' }), false, 'a line from nobody is over nobody');
  assert.equal(bubbleLineOk(BUBBLE_TAB, { ...line(), text: '' }), false);
  assert.equal(bubbleLineOk(BUBBLE_TAB, null), false);

  // through the log
  log.push(BUBBLE_TAB, { text: 'Server restarted', system: true });
  log.push(BUBBLE_TAB, line({ id: 'me', mine: true, text: 'my own words' }));
  log.push(BUBBLE_TAB, line({ id: 'ghost', text: 'from somebody out of sight' }));
  assert.equal(layer.render({ points: pts, log }), 0, 'a notice, my own line and a peer nobody is drawing: no bubble');
  assert.equal(layer.tagFor('bran').bubble.className, 'dfname-bubble off');
  log.push(BUBBLE_TAB, line({ text: 'here I am' }));
  assert.equal(layer.render({ points: pts, log }), 1);

  // THE CAP: six speakers, all drawn, and only the newest BUBBLE_MAX wear one
  const many = Array.from({ length: BUBBLE_MAX + 2 }, (_, i) => ({ id: `p${i}`, x: 100 + i * 40 }));
  const layer2 = createNameLayer({ doc: fakeDocument(), now: () => clock.t });
  const log2 = new ChatLog({ now: () => clock.t });
  for (const p of many) log2.push(BUBBLE_TAB, line({ id: p.id, text: `I am ${p.id}` }));
  assert.equal(layer2.render({ points: pointsOf(many), log: log2 }), BUBBLE_MAX, 'the cap holds whatever a crowd says');
  assert.equal(layer2.storedCount(), BUBBLE_MAX, 'and the STORE is the bound - six speakers, four entries');
  assert.equal(layer2.tagFor('p0').bubble.className, 'dfname-bubble off', 'the OLDEST went');
  assert.equal(layer2.tagFor(`p${BUBBLE_MAX + 1}`).bubble.className, 'dfname-bubble', 'the newest stayed');

  // a line is read once: re-rendering does not resurrect a refused one, and an expired bubble does not come back
  clock.t += BUBBLE_MS + 1;
  assert.equal(layer2.render({ points: pointsOf(many), log: log2 }), 0);
  assert.equal(layer2.render({ points: pointsOf(many), log: log2 }), 0, 'the log is read forward from a watermark, never replayed');
});

test('BUBBLE1: the text is the WIRE\'S, cut and never re-sanitized - bounded at BUBBLE_CHARS with a mark, wrapped by the sheet, and the sanitizing law named where it already runs (mutants: sanitizeChat restated here; the cut dropped; the mark dropped; markup written)', () => {
  assert.equal(bubbleText('short'), 'short');
  const long = 'x'.repeat(BUBBLE_CHARS + 40);
  assert.equal(bubbleText(long).length, BUBBLE_CHARS + BUBBLE_ELLIPSIS.length);
  assert.ok(bubbleText(long).endsWith(BUBBLE_ELLIPSIS));
  assert.equal(bubbleText('y'.repeat(BUBBLE_CHARS)), 'y'.repeat(BUBBLE_CHARS), 'exactly at the bound: whole');
  assert.equal(bubbleText(null), '');
  assert.ok(BUBBLE_CHARS < 240, 'smaller than the wire\'s own CHAT_MAX - a bubble is a glance');
  const src = rd('src/ui/nameLayer.js');
  assert.doesNotMatch(src, /sanitizeChat\(|\\p\{Cf\}|0xd800|\\uD800/, 'the chat law has ONE home (net/wire.js) and this is not a second spelling of it - it is NAMED here, never re-run');
  assert.doesNotMatch(src, /^import[^\n]*wire\.js/m, 'and this file does not even reach for it');
  assert.doesNotMatch(src, /innerHTML/, 'a line is text, never markup');
  assert.match(src, /net\/online\.js runs every inbound line through net\/wire\.js sanitizeChat/, 'and it says where the law it relies on runs');
  assert.match(rd('src/net/online.js'), /const text = typeof m\.text === 'string' \? sanitizeChat\(m\.text\) : '';/, '...which it really does');
});

// ── THE HOST ──────────────────────────────────────────────────────────────────────────────────────

test('NAME1 + BUBBLE1: the wiring in scenes/world.js - the layer is made ONCE beside the peers and only for the skin that owns the screen, driven from the one name pass with the sight test, the chat log and the picture\'s colour, and the classic bitmap pass is the fallback where there is no layer (mutants: the layer made per frame; both faces drawn at once; the sight test dropped at the host; the bubbles fed from a tab that is not the world\'s)', () => {
  const w = rd('src/scenes/world.js');
  const bare = w.replace(/\/\/[^\n]*/g, ' ');
  assert.match(w, /import \{ createNameLayer, nameLayerWanted \} from '\.\.\/ui\/nameLayer\.js';/);
  assert.match(w, /import \{ RemotePlayers, composeLook, sightBlockedBy, createSightCache \} from '\.\.\/net\/remotePlayers\.js';/);
  assert.match(bare, /let online = null, remotePlayers = null, peerBodies = null, nameLayer = null, nameSight = null,/, 'one handle each, held for the session');
  // AUDIT NAME1 F7: the SKIN gates the DOM face, exactly as it gates the chat panel the bubbles belong to.
  assert.match(bare, /if \(nameLayerWanted\(enhanced\)\) nameLayer = createNameLayer\(\{\}\);/, 'made for the skin that owns this screen, and where there is a document to put it in');
  assert.match(bare, /if \(enhanced && typeof document !== 'undefined'\) chatStart\(\);/, '...the same gate the chat takes');
  assert.ok(bare.indexOf('const enhanced = isEnhanced();') < bare.indexOf('nameLayerWanted(enhanced)'), 'the skin is read before it is asked about');
  assert.equal((w.match(/createNameLayer\(/g) ?? []).length, 1, 'called in exactly one place - never per frame');
  assert.match(bare, /nameSight = createSightCache\(\);/, 'AUDIT NAME1 F2/F5: and the sight cache is the session\'s, made once beside it');
  assert.equal((w.match(/createSightCache\(/g) ?? []).length, 1, 'never per frame either - a cache rebuilt every frame is no cache');
  assert.match(bare, /const blocked = \(head, id\) => nameSight\.blocked\(player\.collider, eye, id, head\);/);
  // AUDIT NAME1 F1/F14: ONE call, into the pass the test below drives end to end.
  assert.match(bare, /remotePlayers\.nameFrame\(\{/, 'the whole pass in one call');
  assert.match(bare, /w: nameLayer \? canvas\.clientWidth : canvas\.width,/, 'CSS pixels for a style attribute, the buffer\'s for the bitmap pass');
  assert.match(bare, /h: nameLayer \? canvas\.clientHeight : canvas\.height,/);
  assert.match(bare, /rect: largeHudViewportRect\(canvas\.clientHeight\),/, 'the docked HUD\'s own viewport (E5)');
  assert.match(bare, /layer: nameLayer, log: chatLog, colorOf: \(id\) => social\?\.colorOf\(id\) \?\? null, blocked,/,
    'the layer, the log the bubbles come from and the picture\'s colour');
  assert.match(bare, /renderer, font: townTalk\.font, scale, hudScale: enhancedHudScale\(\),/, 'AUDIT NAME1 F3: and the player\'s own HUD scale');
  assert.doesNotMatch(bare, /PARTY_GREEN/, 'the host still never carries the colour itself');
  assert.doesNotMatch(bare, /nameLayer\.render\(/, 'the host does not drive the layer behind the pass\'s back');
  // the bubbles ride the log the chat panel shows - the chat wiring itself is untouched (CHAT1's pin still holds it)
  assert.match(w, /link\.onChat = \(line\) => chatLog\.push\(tab\.id, line\);/, 'a PULL from the log, so CHAT1\'s five lines are exactly as they were');
  assert.equal(BUBBLE_TAB, 'world');
});

// ── THE FIXES (AUDIT NAME1, 2026-09-16: fifteen findings read off the slice, driven here) ──────────

test('AUDIT NAME1 F7: the DOM face is the SKIN\'S, not the document\'s - a classic-skin page (online\'s forcing can fail, MAC-N3) keeps the classic bitmap names it always had, and never gets the enhanced pixel face with no chat panel beside it (mutant: the gate back on the document alone)', () => {
  assert.equal(nameLayerWanted(true, {}), true, 'the enhanced skin, in a browser: the DOM face');
  assert.equal(nameLayerWanted(false, {}), false, 'THE FINDING: a classic skin with a document gets NO layer - so `if (!nameLayer)` draws the bitmap names');
  assert.equal(nameLayerWanted(true, null), false, 'and a Node probe gets none either');
  assert.equal(nameLayerWanted(true, undefined), false);
  assert.equal(nameLayerWanted(undefined, {}), false);
  // and the whole point of the refusal: the classic page still HAS a face, because the fallback is gated on the layer
  const rp = stand([{ id: 'a', at: [0, 0, -10], height: 1.8 }]);
  const r = recorder();
  assert.equal(rp.nameFrame({ proj: PROJ, view: VIEW, w: W, h: H, eye: EYE, layer: null, renderer: r, font: FONT }), 1,
    'no layer, one bitmap name');
  assert.equal(r.runs.length, 1);
});

// ── AUDIT NAME1 F3: THE SIZE IS THE FRAME'S ───────────────────────────────────────────────────────

const PROJ120 = mirrorProjectionX(perspective((120 * Math.PI) / 180, 16 / 9, 0.2, 6000));

test('AUDIT NAME1 F3 (the size law ignored the frame): a name is sized by the VIEWPORT it is drawn into and the LENS it is drawn through - the same peer at the same depth wears 16.0px on a 900-px view at FOV 60 and 9.0px at FOV 120, where the sprite under it is three times smaller, and 10.7px on a 600-px view; the HUD scale multiplies the answer and the legible band holds the ends (mutants: the lens term dropped; the viewport term dropped; the terms inverted; the band dropped; the HUD scale dropped or taken inside the band)', () => {
  // the two terms, by value
  assert.equal(nameViewportScale(NAME_REF_H), 1, 'the reference height is the reference');
  assert.equal(nameViewportScale(450), 0.5, 'half the view, half the size');
  assert.equal(nameViewportScale(0), 1, 'and nothing readable is the reference, not a division');
  assert.equal(nameViewportScale(NaN), 1);
  assert.ok(Math.abs(nameLensScale(PROJ) - 1) < 1e-6, `60 degrees IS the reference lens (${nameLensScale(PROJ)})`);
  assert.ok(Math.abs(nameLensScale(PROJ120) - 1 / 3) < 1e-6, `FOV 120: a third (${nameLensScale(PROJ120)}) - tan(30) / tan(60), the same third the sprite shrank by`);
  assert.equal(nameLensScale(null), 1, 'no matrix is the reference lens');
  assert.equal(nameLensScale([0, 0, 0, 0, 0, 0]), 1, 'and neither is a broken one');
  assert.equal(NAME_REF_FOV, Math.PI / 3, 'the reference lens is the one the port drew with before FieldOfView was wired');

  // the size, by value, through the real law
  assert.equal(namePixelSize(1, 1, 1), NAME_BASE_PX);
  assert.ok(Math.abs(namePixelSize(1, nameViewportScale(600), 1) - NAME_BASE_PX * (600 / 900)) < 1e-9);
  assert.equal(namePixelSize(1, nameViewportScale(400), 1), NAME_PX_MIN, 'a phone at the reference depth: the floor, not seven point one');
  assert.equal(namePixelSize(3, 1, 1), NAME_PX_MAX, 'and the ceiling holds the other end');
  assert.equal(namePixelSize(1, 1, 2), NAME_BASE_PX * 2, 'the player\'s HUD scale is OUTSIDE the band - it is a request, not an accident');
  assert.equal(namePixelSize(3, 1, 2), NAME_PX_MAX * 2);
  assert.equal(namePixelSize(NaN, NaN, NaN), NAME_BASE_PX, 'nothing readable is the reference frame');

  // and through the DOM face, driven: ONE peer, ONE depth, four frames
  const peer = [{ id: 'bran', at: [0, 0, -NAME_SCALE_REF], height: 1.8 }];   // the head point at the reference depth exactly (the view looks down -z)
  const px = (proj, h, hudScale = 1) => {
    const doc = fakeDocument();
    const layer = createNameLayer({ doc, now: () => 1000 });
    const rp = stand(peer);
    const points = rp.namePoints(proj, VIEW, W, h, EYE, (p) => [p.x, p.y, p.z]);
    layer.render({ points, viewport: h, hudScale });
    return layer.tagFor('bran').node.style.fontSize;
  };
  assert.equal(px(PROJ, 900), '16.0px', 'the reference frame: the base size');
  assert.equal(px(PROJ, 600), '10.7px', 'a two-thirds-height view: two thirds of it');
  assert.equal(px(PROJ120, 900), '9.0px', 'THE FINDING: at FOV 120 the sprite is a third the size and the name used to be 16.0px too');
  assert.equal(px(PROJ120, 900), `${NAME_PX_MIN.toFixed(1)}px`, '...held at the legible floor, because a third of 16 is not a word');
  assert.equal(px(PROJ, 900, 2), '32.0px', 'and the HUD scale the player set moves it like every other enhanced surface');
  assert.notEqual(px(PROJ, 900), px(PROJ120, 900), 'the lens is read, not ignored');
  assert.notEqual(px(PROJ, 900), px(PROJ, 600), 'and so is the viewport');

  // and through the HOST's own call, where the docked HUD's rect is the world viewport (E5): the name is sized by
  // the frame it is DRAWN into, not by the page around it
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  const rp = stand(peer);
  // the rect is NORMALISED, as ui/hudLarge.js largeHudViewportRect mints it: a docked bar taking a third of the
  // canvas leaves the world two thirds of 900 px
  rp.nameFrame({ proj: PROJ, view: VIEW, w: W, h: 900, eye: EYE, rect: { x: 0, y: 1 / 3, w: 1, h: 2 / 3 }, layer });
  assert.equal(layer.tagFor('bran').node.style.fontSize, '10.7px', 'the docked HUD shrank the world to 600 px and the name went with it');
  const full = createNameLayer({ doc: fakeDocument(), now: () => 1000 });
  rp.nameFrame({ proj: PROJ, view: VIEW, w: W, h: 900, eye: EYE, rect: null, layer: full });
  assert.equal(full.tagFor('bran').node.style.fontSize, '16.0px', 'and with no docked bar the whole canvas is the frame');
});

// ── AUDIT NAME1 F2: THE RAY'S BUDGET, AND THE BUCKET'S OWN BOX ────────────────────────────────────

/** A brute-force nearest hit over a known triangle list - the answer the grid and its broad phase must not change. */
function brute(tris, o, d, maxDist) {
  let best = Infinity;
  for (const [a, b, c] of tris) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const px = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * px[0] + e1[1] * px[1] + e1[2] * px[2];
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    const t = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
    const u = (t[0] * px[0] + t[1] * px[1] + t[2] * px[2]) * inv;
    if (u < 0 || u > 1) continue;
    const q = [t[1] * e1[2] - t[2] * e1[1], t[2] * e1[0] - t[0] * e1[2], t[0] * e1[1] - t[1] * e1[0]];
    const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
    if (v < 0 || u + v > 1) continue;
    const dist = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
    if (dist >= 0 && dist <= maxDist && dist < best) best = dist;
  }
  return best;
}
const QUAD = (x0, x1, y0, y1, z) => [x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z];
const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const QUAD_TRIS = (x0, x1, y0, y1, z) => [[[x0, y0, z], [x1, y0, z], [x1, y1, z]], [[x0, y0, z], [x1, y1, z], [x0, y1, z]]];

test('AUDIT NAME1 F2 (one ray a peer walked EVERY bucket to maxDist): the collider rejects a bucket the ray never enters with the bucket\'s own box, before a single cell of it is looked at - a town\'s thirty streamed buckets are thirty box tests, not thirty DDAs - and the answer stays the brute-force one (mutants: the box test dropped; the bounds not kept; the reject inverted; the box grown to everything)', () => {
  const c = new Collider();
  const tris = [];
  // the wall the ray really meets, at z = -5
  c.addMesh('wall', QUAD(-2, 2, 0, 5, -5), [0, 1, 2, 0, 2, 3], IDENT);
  tris.push(...QUAD_TRIS(-2, 2, 0, 5, -5));
  // and thirty streamed map pixels standing well off the line, as an exterior collider holds them
  for (let i = 0; i < 30; i++) {
    const x = 200 + i * 40;
    c.addMesh(`px:${i}`, QUAD(x, x + 30, 0, 6, -5 - i), [0, 1, 2, 0, 2, 3], IDENT);
    tris.push(...QUAD_TRIS(x, x + 30, 0, 6, -5 - i));
  }
  // count the CELLS each bucket is asked for: a walk is grid.get calls, a reject is none at all
  const walks = new Map();
  for (const [key, bucket] of c._buckets) {
    const real = bucket.grid.get.bind(bucket.grid);
    walks.set(key, 0);
    bucket.grid.get = (k) => { walks.set(key, walks.get(key) + 1); return real(k); };
  }
  const o = [0, 1.7, 0], d = [0, 0, -1], reach = 40;
  const hit = c.raycast(o, d, reach);
  assert.ok(Math.abs(hit - brute(tris, o, d, reach)) < 1e-6, 'the wall, at the distance the triangles themselves say');
  assert.ok(walks.get('wall') > 0, 'the bucket the ray crosses IS walked');
  let off = 0;
  for (const [key, n] of walks) if (key !== 'wall') off += n;
  assert.equal(off, 0, 'THE FINDING: thirty buckets nowhere near the line, and not one cell of them is looked at');

  // and the box can never hide a hit: a fan of rays agrees with the triangles themselves, near and far
  for (let a = -0.9; a <= 0.9; a += 0.15) {
    for (const len of [3, 6, 40]) {
      const dir = [Math.sin(a), 0, -Math.cos(a)];
      const got = c.raycast(o, dir, len), want = brute(tris, o, dir, len);
      assert.ok((got === Infinity && want === Infinity) || Math.abs(got - want) < 1e-6,
        `a fan ray at ${a.toFixed(2)} over ${len}: ${got} against the triangles' own ${want}`);
    }
  }
  for (const [, ] of walks) break;
  for (const k of walks.keys()) walks.set(k, 0);
  assert.equal(c.raycast(o, d, 1), Infinity, 'a ray that stops short of the box is a reject, and still the right answer');
  assert.equal(walks.get('wall'), 0, '...a REJECT: the box takes the ray\'s reach, so a one-unit ray does not walk a wall five units away');
  // a ray that climbs OVER the wall: the box has a y, so it is rejected on height alone
  assert.equal(c.raycast([0, 1.7, 0], [0, 0.9, -0.43589], 40), Infinity, 'over the top of a five-unit wall');
});

test('AUDIT NAME1 F2: the sight test is CACHED per peer - one ray a peer every NAME_SIGHT_MS however many frames go by, so a crowd costs the frame what a crowd is worth rather than sixty rays a frame each (mutants: the cache bypassed; the interval dropped; the cache keyed by something that is not the peer; the entry never released)', () => {
  const clock = { t: 0 };
  const collider = walled();
  const sight = createSightCache({ now: () => clock.t });
  const rp = stand([{ id: 'a', at: [8, 0, -10], height: 1.8 }, { id: 'b', at: [9, 0, -12], height: 1.8 }, { id: 'c', at: [10, 0, -14], height: 1.8 }]);
  const blocked = (head, id) => sight.blocked(collider, EYE, id, head);
  for (let f = 0; f < 60; f++) {
    assert.equal(rp.namePoints(PROJ, VIEW, W, H, EYE, (p) => [p.x, p.y, p.z], null, blocked).length, 3, `frame ${f}: three names`);
    clock.t += 16;
  }
  // 60 frames of 16 ms is 944 ms: six re-tests a peer (0, 160, 320, 480, 640, 800), eighteen rays for 180 asks
  assert.equal(sight.rays(), 18, `the ray budget over 60 frames and 3 peers: ${sight.rays()} (uncached: 180)`);
  assert.ok(sight.rays() <= 3 * Math.ceil(960 / NAME_SIGHT_MS), 'at most one ray a peer an interval, by the law rather than by the number');
  assert.equal(sight.size(), 3, 'one entry a peer');
  assert.equal(NAME_SIGHT_MS >= 100 && NAME_SIGHT_MS <= 300, true, 'the interval is a glance, not a second');

  // the cache is the PEER'S: a second peer does not read the first one's answer
  const one = createSightCache({ now: () => clock.t });
  const wall = walled();
  assert.equal(one.blocked(wall, EYE, 'hidden', [0, 1.8, -10]), false, 'the first blocked answer is still inside the hold');
  assert.equal(one.rays(), 1);
  one.blocked(wall, EYE, 'hidden', [0, 1.8, -10]);
  assert.equal(one.rays(), 1, 'the same peer inside the interval: no second ray');
  one.blocked(wall, EYE, 'other', [8, 1.8, -10]);
  assert.equal(one.rays(), 2, 'a different peer: their own ray');
  // an id nobody has asked about for the whole TTL is forgotten rather than kept for the session
  clock.t += 60000;
  one.blocked(wall, EYE, 'other', [8, 1.8, -10]);
  assert.equal(one.size(), 1, 'the peer who left took their entry with them');
});

// ── AUDIT NAME1 F5: THE HYSTERESIS ───────────────────────────────────────────────────────────────

test('AUDIT NAME1 F5 (one un-hysteresised ray strobed a name behind a railing and REBUILT its element every flicker): the name goes only once the ray has said "blocked" for NAME_SIGHT_HOLD_MS and comes back the instant it says "seen" - over ten flickering frames the DOM builds nothing and loses nothing, where the raw ray built a dozen nodes and took the name away five times (mutants: the hold dropped; the stamp re-stamped on every blocked answer; the name held for ever once blocked)', () => {
  const clock = { t: 0 };
  // A RAILING: the ray says blocked on every other frame, which is what an upright between two players does.
  let n = 0;
  const flicker = () => (n++ % 2 === 0);
  // TWO peers, because one flickering peer alone empties the point list and the layer simply hides its root: the
  // rebuild the finding measured needs somebody still standing there while the other one blinks.
  const peer = [{ id: 'bran', at: [8, 0, -10], height: 1.8 }, { id: 'zed', at: [-8, 0, -10], height: 1.8 }];
  const onlyBran = (head, fn) => (head[0] > 0 ? fn() : false);

  // THE FIX: through the cache, re-tested every frame so the HOLD alone is doing the work
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => clock.t });
  const rp = stand(peer);
  const sight = createSightCache({ now: () => clock.t, every: 0, cast: (c, eye, head) => onlyBran(head, flicker) });
  layer.render({ points: rp.namePoints(PROJ, VIEW, W, H, EYE, (p) => [p.x, p.y, p.z]) });   // the elements exist before the flicker starts
  doc.zero();
  let gone = 0;
  for (let f = 0; f < 10; f++) {
    const points = rp.namePoints(PROJ, VIEW, W, H, EYE, (p) => [p.x, p.y, p.z], null, (head, id) => sight.blocked(null, EYE, id, head));
    assert.equal(points.length, 2, `frame ${f}: the name is still there`);
    layer.render({ points });
    if (!layer.tagFor('bran')) gone++;
    clock.t += 16;
  }
  assert.equal(doc.built, 0, 'ten flickering frames build NOTHING - the element is moved, as it is on any other frame');
  assert.equal(doc.structure, 0, 'and re-parent nothing');
  assert.equal(gone, 0, 'the name is never taken away');

  // THE COUNTERFACTUAL, same flicker, no hysteresis: the element is destroyed and rebuilt as the ray strobes
  n = 0;
  const doc2 = fakeDocument();
  const layer2 = createNameLayer({ doc: doc2, now: () => clock.t });
  const rp2 = stand(peer);
  doc2.zero();
  let gone2 = 0;
  for (let f = 0; f < 10; f++) {
    layer2.render({ points: rp2.namePoints(PROJ, VIEW, W, H, EYE, (p) => [p.x, p.y, p.z], null, (head) => onlyBran(head, flicker)) });
    if (!layer2.tagFor('bran')) gone2++;
  }
  assert.ok(doc2.built >= 8, `the raw ray rebuilds the element every flicker: ${doc2.built} nodes built against 0`);
  assert.ok(gone2 >= 4, `and the name is simply absent on ${gone2} of the ten frames`);

  // the law still WORKS: a ray that keeps saying blocked takes the name away, one hold later
  const clock2 = { t: 0 };
  const always = createSightCache({ now: () => clock2.t, every: 0, cast: () => true });
  assert.equal(always.blocked(null, EYE, 'p', [0, 1.8, -10]), false, 'the first blocked answer is not yet an answer');
  clock2.t += NAME_SIGHT_HOLD_MS - 1;
  assert.equal(always.blocked(null, EYE, 'p', [0, 1.8, -10]), false, 'a millisecond short of the hold: still shown');
  clock2.t += 1;
  assert.equal(always.blocked(null, EYE, 'p', [0, 1.8, -10]), true, 'and at the hold exactly, it goes');
  clock2.t += 10000;
  assert.equal(always.blocked(null, EYE, 'p', [0, 1.8, -10]), true, 'and stays gone while the wall stays there');
  // ...and a seen answer gives it straight back, with no hold of its own
  const back = createSightCache({ now: () => clock2.t, every: 0, cast: () => false });
  assert.equal(back.blocked(null, EYE, 'p', [0, 1.8, -10]), false, 'seen is answered at once - a name never waits to come back');
  assert.ok(NAME_SIGHT_HOLD_MS >= 100 && NAME_SIGHT_HOLD_MS <= 400, 'the hold is a flicker\'s length, not a mood');
});

// ── AUDIT NAME1 F1 + F14: THE FRAME, DRIVEN END TO END ───────────────────────────────────────────

/** The host's own composition, built the way scenes/world.js builds it: real peers, a real layer over a fake
 *  document, a real Collider with a real wall in it, a real ChatLog, real matrices. */
function hostFrame({ rows = [{ id: 'bran', at: [8, 0, -10], height: 1.8 }, { id: 'zed', at: [9, 0, -12], height: 1.8 }] } = {}) {
  const clock = { t: 10000 };
  const doc = fakeDocument();
  const rp = stand(rows);
  const layer = createNameLayer({ doc, now: () => clock.t });
  const collider = walled();
  const sight = createSightCache({ now: () => clock.t });
  const log = new ChatLog({ now: () => clock.t });
  const frame = (over = {}) => rp.nameFrame({
    proj: PROJ, view: VIEW, w: W, h: H, eye: EYE, toScene: (p) => [p.x, p.y, p.z],
    layer, log, blocked: (head, id) => sight.blocked(collider, EYE, id, head), hudScale: 1, viewport: H,
    ...over,
  });
  return { clock, doc, rp, layer, collider, sight, log, frame };
}

test('AUDIT NAME1 F1 (in a dungeon any open window FROZE the name layer): a covered frame is still a frame - the layer is told, so it takes itself down instead of standing on the glass with the positions of the frame the window opened on, and the bubble pump still runs while it is covered; the pass costs no projection and no ray while it is covered (mutants: the covered frame not passed to the layer; the layer left up under a window; the points projected anyway; the pump skipped)', () => {
  const { layer, sight, log, frame, clock } = hostFrame();
  assert.equal(frame(), 2, 'two names before the window opens');
  assert.equal(layer.root.style.display, '', 'up');
  const rays = sight.rays();

  // THE WINDOW. The dungeon arm used to return before the pass; the layer then kept the frame it last had.
  assert.equal(frame({ covered: true }), 0, 'a covered frame draws no name');
  assert.equal(layer.root.style.display, 'none', 'THE FINDING: the layer comes DOWN, rather than standing on the glass over the overlay');
  assert.equal(sight.rays(), rays, 'and it costs no ray - a covered frame projects nothing');

  // THE PUMP STILL RUNS: a line said while the window is open is a bubble the moment it closes, at its own age
  log.push(BUBBLE_TAB, { id: 'bran', name: 'Bran', text: 'behind you', at: clock.t });
  assert.equal(frame({ covered: true }), 0, 'still nothing drawn');
  clock.t += 1000;
  assert.equal(frame(), 2, 'the window closes');
  assert.equal(layer.bubbleCount(), 1, 'and the line said under it is there');
  assert.equal(layer.tagFor('bran').bubble.textContent, 'behind you');
  assert.equal(layer.root.style.display, '', 'up again');

  // and the host arm that had the early return really does call the pass before it takes it
  const wm = rd('src/scenes/worldModes.js');
  const arm = /if \(dungeonCtx\.uiOverlayActive\) \{[^\n]*\}/.exec(wm)[0];
  assert.match(arm, /host\.drawPeerNames\?\.\(\{ proj, view, eye: mwv\.eye \}\)/, 'the dungeon overlay arm draws the names');
  assert.ok(arm.indexOf('drawPeerNames') < arm.indexOf('return true'), '...before it returns, not after');
  assert.ok(arm.indexOf('drawPeerNames') < arm.indexOf('drawOverlay'), '...and under the overlay, not over it');
  assert.equal((wm.match(/host\.drawPeerNames\?\./g) ?? []).length, 3, 'the dungeon\'s two arms and the interior\'s - every exit of this host');
});

test('AUDIT NAME1 F14 (the host wiring was pinned by regex alone): the whole pass driven - the four culls, the sight test over a REAL collider, the DOM face, the party colour and the bitmap fallback, through the one call scenes/world.js makes (mutants: the culls reordered; the layer and the bitmap face both drawn; the rect ignored; the colour dropped)', () => {
  // a peer behind the wall, a peer beside it, a peer out of range, a peer behind the lens
  const hostFrameClock = hostFrame({ rows: [
    { id: 'hidden', at: [0, 0, -10], height: 1.8 },
    { id: 'seen', at: [8, 0, -10], height: 1.8 },
    { id: 'miles', at: [0, 0, -(NAME_RANGE + 10)], height: 1.8 },
    { id: 'behind', at: [0, 0, 10], height: 1.8 },
  ] });
  const { layer, sight, frame } = hostFrameClock;
  const { clock } = hostFrameClock;
  assert.equal(frame(), 2, 'the two in front and in range are drawn - the wall is not BELIEVED for a hold yet (AUDIT NAME1 F5)');
  clock.t += NAME_SIGHT_HOLD_MS;
  assert.equal(frame(), 1, 'and one hold later the one behind the wall is gone');
  assert.equal(layer.tagCount(), 1);
  assert.equal(layer.tagFor('seen').name.textContent, 'SEEN');
  assert.equal(layer.tagFor('hidden'), null, 'the wall answers for the one behind it');
  assert.equal(sight.rays(), 4, `the ray is the LAST cull: ${sight.rays()} rays over two frames for FOUR peers - out of range and behind the lens cost none`);

  // the party's green rides the same call
  const social = new SocialState();
  social.apply({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', friends: [], in: [], out: [], invites: [],
    party: { id: 'p1', leader: 'acct-me', members: [{ acct: 'acct-me', name: 'Mac', online: true, seen: 1, peers: ['me'] }, { acct: 'acct-b', name: 'Seen', online: true, seen: 1, peers: ['seen'] }] } });
  frame({ colorOf: (id) => social.colorOf(id) ?? null });
  assert.equal(layer.tagFor('seen').name.style.color, PARTY_GREEN_CSS);

  // ONE FACE A FRAME: hand the same call no layer and the bitmap pass answers instead
  const rp = stand([{ id: 'seen', at: [8, 0, -10], height: 1.8 }]);
  const r = recorder();
  assert.equal(rp.nameFrame({ proj: PROJ, view: VIEW, w: W, h: H, eye: EYE, renderer: r, font: FONT, scale: 1 }), 1);
  assert.equal(r.runs.length, 1, 'the bitmap face drew it');
  const r2 = recorder();
  assert.equal(rp.nameFrame({ proj: PROJ, view: VIEW, w: W, h: H, eye: EYE, layer, renderer: r2, font: FONT, scale: 1 }), 1);
  assert.equal(r2.runs.length, 0, 'and with a layer it does NOT - one face a frame, never both');
  // a covered bitmap frame draws nothing at all
  const r3 = recorder();
  assert.equal(rp.nameFrame({ proj: PROJ, view: VIEW, w: W, h: H, eye: EYE, renderer: r3, font: FONT, covered: true }), 0);
  assert.equal(r3.runs.length, 0);
});

// ── AUDIT NAME1 F13: THE TWO FACES AGREE ABOUT THE GAP ───────────────────────────────────────────

test('AUDIT NAME1 F13: the classic face\'s gap takes the HOST scale, like the glyph box over it - at hudScale 4 the clearance is four buffer pixels a CSS pixel, which is the same clearance the DOM face leaves, and it does NOT take the point\'s own depth term, because a clearance that swings with depth is the world lift NAME1 took out (mutants: the gap unscaled; the gap scaled by the depth term too; the gap scaled twice)', () => {
  const rp = stand([{ id: 'x', at: [0, 0, -NAME_SCALE_REF], height: 1.8 }]);
  const [p] = rp.namePoints(PROJ, VIEW, W, H, EYE, (q) => [q.x, q.y, q.z]);
  const bottomAt = (scale) => {
    const r = recorder();
    assert.equal(rp.drawNames(r, FONT, PROJ, VIEW, W, H, EYE, scale, (q) => [q.x, q.y, q.z]), 1);
    return Math.max(...r.runs[0].quads.map((g) => g.dst.y + g.dst.h));
  };
  for (const scale of [1, 2, 4]) {
    const gap = p.y - bottomAt(scale);
    assert.ok(Math.abs(gap - NAME_GAP_PX * scale) <= 1, `at hudScale ${scale} the gap is ${gap} buffer px, which is ${NAME_GAP_PX} screen px`);
  }
  assert.ok(Math.abs((p.y - bottomAt(4)) / 4 - NAME_GAP_PX) <= 0.5, 'four times the scale, four times the pixels, the SAME clearance');
  // the DOM face's own gap, at the same point: NAME_GAP_PX CSS px, measured in CSS px
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  layer.render({ points: [p], viewport: H });
  assert.equal(layer.tagFor('x').node.style.top, `${Math.round(p.y - NAME_GAP_PX)}px`, 'the two faces leave the same clearance in their own pixels');
  // ...and the gap is NOT the depth term: a far peer gets the same screen clearance as a near one
  const far = stand([{ id: 'x', at: [0, 0, -40], height: 1.8 }]);
  const [q] = far.namePoints(PROJ, VIEW, W, H, EYE, (v) => [v.x, v.y, v.z]);
  const r = recorder();
  far.drawNames(r, FONT, PROJ, VIEW, W, H, EYE, 2, (v) => [v.x, v.y, v.z]);
  const farGap = q.y - Math.max(...r.runs[0].quads.map((g) => g.dst.y + g.dst.h));
  assert.ok(Math.abs(farGap - NAME_GAP_PX * 2) <= 1, `forty units out at hudScale 2 the gap is still ${farGap}, not a fraction of it`);
});

// ── AUDIT NAME1 F6 / F8 / F9 / F10 / F11: THE BUBBLE'S OWN CORRECTIONS ───────────────────────────

test('AUDIT NAME1 F6 (a bubble was stamped from the PUMP\'S clock, not the line\'s): a five-minute-old line read for the first time - the pass never ran while a window stood over the HUD - is already gone, not brand new over somebody\'s head, and the stamp is net/chat.js\' own `t`, the one ChatLog.peek fades by (mutants: the stamp taken at the pump; the relay\'s `at` preferred over the local clock; the stamp dropped)', () => {
  const doc = fakeDocument();
  const clock = { t: 1000 };
  const layer = createNameLayer({ doc, now: () => clock.t });
  const log = new ChatLog({ now: () => clock.t });
  const pts = pointsOf([{ id: 'bran' }]);

  log.push(BUBBLE_TAB, { id: 'bran', name: 'Bran', text: 'said five minutes ago' });
  clock.t += 5 * 60 * 1000;   // the window stood open for five minutes and the layer was never rendered
  assert.equal(layer.render({ points: pts, log }), 0, 'THE FINDING: a line this old does not arrive as news');
  assert.equal(layer.tagFor('bran').bubble.className, 'dfname-bubble off');

  // a line said NOW, through the same door, still speaks
  log.push(BUBBLE_TAB, { id: 'bran', name: 'Bran', text: 'said just now' });
  assert.equal(layer.render({ points: pts, log }), 1);
  assert.equal(layer.tagFor('bran').bubble.textContent, 'said just now');

  // the stamp is the LINE's: a line whose local stamp is old fades on that stamp, whatever the relay's `at` says
  const fresh = new ChatLog({ now: () => clock.t });
  const line = fresh.push(BUBBLE_TAB, { id: 'zed', name: 'Zed', text: 'from a clock of its own', at: clock.t + 999999 });
  assert.equal(line.t, clock.t, 'net/chat.js keeps the local stamp as `t` and the relay\'s as `at`');
  const layer2 = createNameLayer({ doc: fakeDocument(), now: () => clock.t + BUBBLE_MS + 1 });
  assert.equal(layer2.render({ points: pointsOf([{ id: 'zed' }]), log: fresh }), 0, 'the local stamp decides, so a future `at` cannot hold a bubble open');
  assert.match(rd('src/ui/nameLayer.js'), /say\(line\.id, line\.text, Number\.isFinite\(line\.t\) \? line\.t : line\.at\)/, 'and the stamp really is the line\'s own');
});

test('AUDIT NAME1 F8 (the seq watermark outlived the log): the watermark belongs to ONE log - a replaced ChatLog starts a new count, where before every line below the old watermark was mute for the rest of the session (mutants: the watermark kept across logs; the watermark reset on every pump, so a line bubbles twice)', () => {
  const doc = fakeDocument();
  const clock = { t: 10000 };
  const layer = createNameLayer({ doc, now: () => clock.t });
  const pts = pointsOf([{ id: 'bran' }]);

  const first = new ChatLog({ now: () => clock.t });
  for (let i = 0; i < 12; i++) first.push(BUBBLE_TAB, { id: 'bran', name: 'Bran', text: `line ${i}` });
  assert.equal(layer.render({ points: pts, log: first }), 1, 'the newest of the first log');
  assert.equal(layer.tagFor('bran').bubble.textContent, 'line 11');

  // the session rejoins and the host builds a NEW log: its line 1 is under the old watermark of 12
  clock.t += BUBBLE_MS + 1;
  const second = new ChatLog({ now: () => clock.t });
  second.push(BUBBLE_TAB, { id: 'bran', name: 'Bran', text: 'the first line of the new log' });
  assert.equal(layer.render({ points: pts, log: second }), 1, 'THE FINDING: it speaks');
  assert.equal(layer.tagFor('bran').bubble.textContent, 'the first line of the new log');
  // and within one log the watermark still holds: nothing is replayed. THE LINE THAT PROVES IT is a line put in
  // by the layer's own door after the pump has read the log - a replay would overwrite it with the log's last line.
  layer.say('bran', 'straight in, not through the log');
  assert.equal(layer.render({ points: pts, log: second }), 1);
  assert.equal(layer.tagFor('bran').bubble.textContent, 'straight in, not through the log', 'the log is read forward from a watermark, never replayed');
  clock.t += BUBBLE_MS + 1;
  assert.equal(layer.render({ points: pts, log: second }), 0, 'read forward, once');
  assert.equal(layer.render({ points: pts, log: second }), 0);
  assert.equal(layer.storedCount(), 0, 'and a line past its window is gone from the STORE as well as from the screen');
});

test('AUDIT NAME1 F9 / F10 / F11: a bubble with nothing to show is not shown - a zero-alpha line (a clock stepped backwards, a stamp from the future) is neither drawn nor counted, whitespace is not a remark, and a point that is not a number draws nothing at all rather than leaving the element where it last was (mutants: alpha ignored; the trim dropped; the finite guards dropped)', () => {
  const doc = fakeDocument();
  const clock = { t: 10000 };
  const layer = createNameLayer({ doc, now: () => clock.t });
  const pts = pointsOf([{ id: 'bran' }]);

  // F9: a stamp from the future is a negative age, which is alpha 0
  assert.equal(layer.say('bran', 'from the future', clock.t + 5000), true, 'the store takes it');
  assert.equal(layer.render({ points: pts }), 0, 'and nothing shows it');
  assert.equal(layer.bubbleCount(), 0, 'nor counts it');
  assert.equal(layer.tagFor('bran').bubble.className, 'dfname-bubble off');
  assert.equal(bubbleAlpha(-1), 0, 'the curve says so too');
  const stamps = createNameLayer({ doc: fakeDocument(), now: () => clock.t });
  assert.equal(stamps.say('bran', 'stamped with nothing', NaN), false, 'and a stamp that is not a time is refused at the door');
  assert.equal(stamps.storedCount(), 0);
  assert.equal(stamps.say('bran', 'stamped with nothing', undefined), true, '...where no stamp at all is simply now');
  assert.equal(stamps.storedCount(), 1, 'one line a peer in the store');

  // F10: whitespace is not a remark
  assert.equal(bubbleSaid('   '), '', 'three spaces is an empty bordered box over somebody\'s head');
  assert.equal(bubbleSaid('\t\n '), '');
  assert.equal(bubbleSaid(' hello '), ' hello ', 'and a line with words in it is the SPEAKER\'S, spaces and all');
  assert.equal(bubbleSaid(''), '');
  assert.equal(layer.say('bran', '   '), false, 'the door refuses it');
  assert.equal(layer.render({ points: pts }), 0);
  assert.equal(layer.say('bran', 'a real line'), true);
  assert.equal(layer.render({ points: pts }), 1, '...and takes a real one');

  // F11: a point that is not a place
  const doc2 = fakeDocument();
  const layer2 = createNameLayer({ doc: doc2, now: () => clock.t });
  layer2.render({ points: pointsOf([{ id: 'bran' }, { id: 'zed', x: 400 }]) });
  assert.equal(layer2.tagCount(), 2);
  const nanPoints = [{ id: 'bran', name: 'BRAN', x: NaN, y: 200, scale: 1 }, { id: 'zed', name: 'ZED', x: 400, y: 260, scale: 0.5 }];
  layer2.render({ points: nanPoints });
  assert.equal(layer2.tagFor('bran'), null, 'THE FINDING: it is not left standing at the last place it was');
  assert.equal(layer2.tagCount(), 1, 'and the peer beside it is untouched');
  for (const bad of [{ x: 0, y: Infinity }, { x: -Infinity, y: 0 }, { x: 'a', y: 0 }, { x: 0, y: null }]) {
    const l = createNameLayer({ doc: fakeDocument(), now: () => clock.t });
    l.render({ points: [{ id: 'q', name: 'Q', scale: 1, ...bad }] });
    assert.equal(l.tagCount(), 0, `a point at (${bad.x}, ${bad.y}) is no place to put a name`);
  }
  // a scale that is not a number is still a readable name, because the size law answers for it
  const l3 = createNameLayer({ doc: fakeDocument(), now: () => clock.t });
  l3.render({ points: [{ id: 'q', name: 'Q', x: 10, y: 20, scale: NaN }] });
  assert.equal(l3.tagFor('q').node.style.fontSize, `${NAME_BASE_PX.toFixed(1)}px`);
});

// ── ACC1d-MARK: THE RELAY'S VERDICT, OVER THE HEAD ────────────────────────────────────────────────
//
// Mac, asked where the verdict ACC1d carries should be drawn: "Should be
// over the head in online how it currently works."
//
// AND THEN, ON THE POLARITY: "Why a question mark since even guests get
// a name?" He is right, and the question takes the first cut apart. The
// verdict does not divide GUEST from ACCOUNT - a guest with a session is
// vouched for like anybody else. It divides a name the player TYPED
// (`onlineName`, "Name over your head", which the relay only sanitises)
// from a name the service ISSUED and signed. So the mark goes on the
// name that was CHECKED: it can only ever appear where the service
// issued the name, so it never becomes wallpaper, and a relay whose key
// will not import badges NOBODY rather than accusing EVERYBODY.

test('ACC1d-MARK: a name the relay CHECKED wears a mark over the head, in BOTH faces, and a name it could not check is the label it always was (mutants: the verdict dropped from the point; the mark drawn for everybody; the mark drawn for nobody; the mark prefixed INTO the name so the label leaves the head; the polarity flipped back onto the unvouched)', () => {
  const rp = stand([{ id: 'ok', at: [0, 0, -10], v: true }, { id: 'no', at: [3, 0, -10], v: false }]);

  // THE POINT CARRIES IT, because it is a fact about the peer rather
  // than a decoration the host supplies - which is the difference
  // between this and `colorOf`, asked for by id.
  const pts = rp.namePoints(PROJ, VIEW, W, H, EYE, (p) => [p.x, p.y, p.z]);
  assert.deepEqual(pts.map((n) => [n.id, n.vouched]), [['ok', true], ['no', false]]);

  // ── THE CLASSIC FACE: a SECOND draw, beside the name, never inside
  // it. One drawText is one quad run (the F7 pin's own reading), so the
  // mark is the run the vouched-for peer does not cost.
  const withMark = recorder();
  rp.drawNamePoints(withMark, FONT, pts, 1);
  assert.equal(withMark.runs.length, 3, 'two names and ONE mark');
  const allBad = recorder();
  rp.drawNamePoints(allBad, FONT, pts.map((n) => ({ ...n, vouched: false })), 1);
  assert.equal(allBad.runs.length, 2, 'a name the relay could not check is the label it always was - no badge, and nothing accusing it either');
  const allOk = recorder();
  rp.drawNamePoints(allOk, FONT, pts.map((n) => ({ ...n, vouched: true })), 1);
  assert.equal(allOk.runs.length, 4, 'and a room where everybody signed in is a room of badges');

  // THE NAME ITSELF IS NOT TOUCHED, and this is the assertion that
  // says so rather than the one that looks like it does. Prefixing the
  // mark into the string leaves the run COUNT alone - the mark is still
  // drawn beside it - and the campaign walked straight through a pin
  // that only checked the point's `name`. What a prefix really does is
  // put an extra GLYPH in the name's own draw while `tw` is still
  // measured off the name alone, so the label slides off the head it
  // belongs to, and only for the peers that are marked.
  // Runs are [ok-name, ok-mark, no-name]: the badged peer's NAME is the
  // same draw it is when nobody is badged.
  assert.equal(withMark.runs[0].quads.length, allBad.runs[0].quads.length,
    'the mark was written INTO the name - its glyphs are in the name\'s own draw');
  assert.equal(withMark.runs[1].quads.length, 1, 'and the mark is its own single-glyph draw');
  assert.deepEqual(pts.map((n) => n.name), ['OK', 'NO']);

  // ── THE DOM FACE: its own element, empty where the relay vouches, so
  // an ordinary label is the element it was before this existed.
  const layer = createNameLayer({ doc: fakeDocument(), now: () => 1000 });
  layer.render({ points: pts });
  assert.equal(layer.tagFor('ok').mark.textContent, NAME_MARK);
  assert.equal(layer.tagFor('no').mark.textContent, '', 'a name the relay could not check carries no mark at all');
  // ...and the mark does NOT take the party's colour: SOC4's green says
  // who somebody is to you, and this says whether the relay could check
  // the name. Two systems, and only one of them owns that pixel.
  layer.render({ points: pts, colorOf: () => PARTY_GREEN });
  assert.equal(layer.tagFor('ok').name.style.color, PARTY_GREEN_CSS, 'the NAME takes the green');
  assert.equal(layer.tagFor('ok').mark.style.color ?? '', '', 'and the mark does not');

  // ── ABSENT IS UNVOUCHED, and this is the arm the campaign asked for.
  // THE RELAY'S WIRE HAS NO `v: false`: server/src/index.js sends
  // `v: who.verified || undefined` and OMITS the field otherwise, so
  // the shape a real unvouched peer arrives in is a peer with no `v` at
  // all. A pin that only ever says `v: false` is testing a frame the
  // relay never sends - read as `!== false` the mark would pass every
  // such pin and appear over nobody in production.
  const relay = rd('server/src/index.js');
  assert.match(relay, /v: who\.verified \|\| undefined/, 'the relay omits the field rather than sending false - the client must read absent as unvouched');
  assert.doesNotMatch(relay, /v: (?:who\.verified|b\.v|a\.v) === false/, 'and nothing on that wire ever spells the false out');
  const bare = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  bare.sync([{ id: 'mute', name: 'MUTE', shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }],
    (p) => [p.x, p.y, p.z], { bodyHeight: () => PEER_HEIGHT });
  const barePts = bare.namePoints(PROJ, VIEW, W, H, EYE, (p) => [p.x, p.y, p.z]);
  assert.deepEqual(barePts.map((n) => n.vouched), [false], 'a peer the relay said nothing about is a peer it did not vouch for');
  const bareDraw = recorder();
  bare.drawNamePoints(bareDraw, FONT, barePts, 1);
  assert.equal(bareDraw.runs.length, 1, 'and it gets NO badge - the name alone, exactly as every build before this slice drew it');

  // the gap is a screen-pixel clearance like NAME_GAP_PX, named once
  assert.ok(Number.isFinite(NAME_MARK_GAP_PX) && NAME_MARK_GAP_PX > 0);
  // ONE GLYPH, and it has to be one the classic font can draw
  assert.equal(NAME_MARK.length, 1);
  assert.ok(/^[\x20-\x7e]$/.test(NAME_MARK), 'the classic face draws through a Daggerfall font - ASCII or it draws nothing');
  // ...and ASCII is necessary, not sufficient: `drawText` draws nothing
  // at all for a glyph of zero width, so a badge the font has no record
  // for is one the classic skin silently never shows. The font's own
  // range is read here; the real FONT0003 is read where ARENA2 exists
  // (test/audit18_ui_chargen.test.js's door), and this states the limit
  // rather than leaving it to be discovered.
  assert.ok(hasGlyph(NAME_MARK.charCodeAt(0)) && NAME_MARK.charCodeAt(0) !== FNT_SPACE_CODE,
    'the mark must be inside the font\'s glyph range and not the space');
});
