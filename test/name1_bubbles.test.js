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
  RemotePlayers, nameScaleFor, sightBlockedBy,
  NAME_GAP_PX, NAME_BASE_PX, NAME_SCALE_REF, NAME_SCALE_MIN, NAME_SCALE_MAX, NAME_SIGHT_SKIN, NAME_RANGE, PEER_HEIGHT,
} from '../src/net/remotePlayers.js';
import {
  createNameLayer, injectNameStyle, cssRgba, bubbleAlpha, bubbleText, bubbleLineOk,
  NAME_STYLE_ID, NAME_CSS, BUBBLE_TAB, BUBBLE_MS, BUBBLE_HOLD, BUBBLE_MAX, BUBBLE_CHARS, BUBBLE_ELLIPSIS,
} from '../src/ui/nameLayer.js';
import { Collider } from '../src/player/collider.js';
import { ChatLog } from '../src/net/chat.js';
import { SocialState, PARTY_GREEN, PARTY_GREEN_CSS } from '../src/net/social.js';
import { PIXEL_STACK } from '../src/ui/pixelifyFive.js';
import { projectToScreen } from '../src/player/tapRay.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';

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
  rp.sync(rows.map((r) => ({ id: r.id, name: r.name ?? r.id.toUpperCase(), shown: { x: r.at[0], y: r.at[1], z: r.at[2], yaw: 0 }, look: null })),
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
  assert.equal(near.scale, nameScaleFor(near.depth));
  assert.equal(far.scale, nameScaleFor(far.depth));
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
  assert.match(w, /const blocked = \(head\) => sightBlockedBy\(player\.collider, eye, head\);/, 'the host casts against player.collider - the LIVE one worldModes re-points at every door');
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
  assert.match(NAME_CSS, /\.dfnames \{ position: fixed; inset: 0; z-index: 4; pointer-events: none;/, 'over the world, taking no click');
  assert.match(NAME_CSS, /transform: translate\(-50%, -100%\);/, 'THE ANCHOR: the stack grows UP from the point, so its bottom edge is on it');
  assert.match(NAME_CSS, /color: var\(--bone, #d8cfae\)/, 'bone');
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
  assert.equal(bran.node.style.fontSize, `${NAME_BASE_PX.toFixed(1)}px`);
  assert.equal(layer.tagFor('zed').node.style.fontSize, `${(NAME_BASE_PX * 0.5).toFixed(1)}px`, 'half the scale, half the face');
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

test('NAME1 + BUBBLE1: the wiring in scenes/world.js - the layer is made ONCE beside the peers and only where there is a document, driven from the one name pass with the sight test, the chat log and the picture\'s colour, and the classic bitmap pass is the fallback where no document exists (mutants: the layer made per frame; both faces drawn at once; the sight test dropped at the host; the bubbles fed from a tab that is not the world\'s)', () => {
  const w = rd('src/scenes/world.js');
  const bare = w.replace(/\/\/[^\n]*/g, ' ');
  assert.match(w, /import \{ createNameLayer \} from '\.\.\/ui\/nameLayer\.js';/);
  assert.match(w, /import \{ RemotePlayers, composeLook, sightBlockedBy \} from '\.\.\/net\/remotePlayers\.js';/);
  assert.match(bare, /let online = null, remotePlayers = null, peerBodies = null, nameLayer = null,/, 'one handle, held for the session');
  assert.match(bare, /if \(typeof document !== 'undefined'\) nameLayer = createNameLayer\(\{\}\);/, 'made where there is a document to put it in');
  assert.equal((w.match(/createNameLayer\(/g) ?? []).length, 1, 'called in exactly one place - never per frame');
  assert.match(bare, /const blocked = \(head\) => sightBlockedBy\(player\.collider, eye, head\);/);
  assert.match(bare, /const points = covered \? \[\] : remotePlayers\.namePoints\(proj, view, canvas\.clientWidth, canvas\.clientHeight, eye, onlineToScene, largeHudViewportRect\(canvas\.clientHeight\), blocked\);/,
    'CSS pixels for a style attribute, the docked HUD\'s rect, and the sight test');
  assert.match(bare, /nameLayer\.render\(\{ points, log: chatLog, covered, colorOf: \(id\) => social\?\.colorOf\(id\) \?\? null \}\);/,
    'the points, the log the bubbles come from, the window\'s word and the picture\'s colour');
  assert.match(bare, /if \(!nameLayer\) remotePlayers\.drawNames\(/, 'ONE face a frame: the bitmap pass runs only where there is no layer');
  assert.doesNotMatch(bare, /PARTY_GREEN/, 'the host still never carries the colour itself');
  // the bubbles ride the log the chat panel shows - the chat wiring itself is untouched (CHAT1's pin still holds it)
  assert.match(w, /link\.onChat = \(line\) => chatLog\.push\(tab\.id, line\);/, 'a PULL from the log, so CHAT1\'s five lines are exactly as they were');
  assert.equal(BUBBLE_TAB, 'world');
});
