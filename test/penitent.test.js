// PENITENT — DIGGLEBORF'S OWN TITLE AND GLYPH (2026-09-29).
//
// Mac: "This new custom title/glyph is for the user Diggleborf". Diggleborf's own ask, on the Discord: "Looking to do a
// Trinimac themed one, so maybe "Penitent" for the title starting gold and ending a sky blue", and a rough sketch for
// the glyph - a tall lozenge, point up and point down, a sword in it with its point at the lozenge's lowest corner.
//
// The grant is TITLE-N's law and the paint is SHADOW-FANG's (a gradient title on every face). What is new is the EDGE:
// Shadow Fang's letters are edged in its own crimson, and edged in its own gold Penitent's sky half was lost - so a
// gradient title may name the edge it wears (TITLE_EDGE). And the glyph is the tiers' kind - a stroked shape in one
// colour - with a detail of its own: the gold lozenge round a sky-blue sword.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { TITLES, GLYPHS, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import {
  TITLE_TEXT, TITLE_RGBA, TITLE_GRADIENT, TITLE_EDGE, GLYPH_RGBA, GLYPH_GRADIENT, GLYPH_DETAIL, GLYPH_MARK, GLYPH_PATH,
  GLYPH_STROKE, FONT_GLYPH_MIN, FONT_GLYPH_MAX, cssRgba, cssGradient, titleBadge, glyphBadges, glyphSvgNode, glyphArtNode,
  titlePaint, TITLE_PAINT_KEYS, gradientAt, badgeCss, badgeClass,
} from '../src/ui/playerBadge.js';
import { GLYPH_LABEL } from '../src/ui/enhancedAccount.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { isStaff } from '../src/net/staffCommands.js';
import { titlesHeld, glyphsOf, equipRefusal, titleWorn, wardrobeOf, TIER_LISTS, TIER_GLYPH, FOUNDER_UNTIL } from '../server-account/src/titles.js';
import { readBadge } from '../src/net/wire.js';
import { createNameLayer } from '../src/ui/nameLayer.js';
import { RemotePlayers, PEER_HEIGHT } from '../src/net/remotePlayers.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];

// ── the fake document (shadowfang.test.js's shape) ──
function fakeNode(tag, doc, ns = null) {
  const n = {
    tagName: tag.toUpperCase(), ns, children: [], parent: null, attrs: {}, writes: 0,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, val) { n.attrs[k] = val; },
    remove() { n.removed = true; },
  };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (x) => { text = String(x); n.children.length = 0; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (x) => { cls = String(x); } });
  n.style = new Proxy({}, { set(t, k, x) { t[k] = x; n.writes++; doc.writes++; return true; } });
  return n;
}
function fakeDocument() {
  const doc = { writes: 0 };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.createElementNS = (ns, tag) => fakeNode(tag, doc, ns);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls) => {
  if ((n.className ?? '').split(' ').includes(cls)) return n;
  for (const c of n.children) { const f = find(c, cls); if (f) return f; }
  return null;
};

/** A colour's hue in degrees and its saturation, HSV - what the eye reads a letter's tint as. */
const hsv = ([r, g, b]) => {
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return { hue: 0, sat: 0 };
  const hue = max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { hue, sat: d / max };
};
/** Does a tint read GREEN - a hue between yellow-green and cyan-green, with colour enough to see it? */
const readsGreen = (rgba) => { const { hue, sat } = hsv(rgba); return hue > 70 && hue < 160 && sat > 0.12; };
/** How light a colour reads (Rec. 709's weights). */
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A path's corners, a curve's end point standing for the curve (shadowfang.test.js's reading), one list per shape. */
const shapesOf = (d) => d.split(/(?=M)/).map((sub) => {
  const pts = [];
  let x = 0, y = 0;
  for (const [, cmd, args] of sub.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
    const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === 'M' || cmd === 'L') [x, y] = n;
    else if (cmd === 'H') [x] = n;
    else if (cmd === 'V') [y] = n;
    else continue;
    pts.push([x, y]);
  }
  return pts;
});
const insidePoly = (poly) => ([x, y]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

// ── THE VOCABULARY AND ITS FACE ─────────────────────────────────────

test('PENITENT vocabulary: the title and the glyph join the closed lists last, with the word Diggleborf named; a gradient that starts gold and ends sky blue - CSS\'s own gold and skyblue - with a warm light between them, so no letter reads green, as a straight mix of the two ends does; edged in black, not its own gold; a classic mark of its own (mutants: the ends swapped; the light dropped; the edge its own gold; a mark another glyph has)', () => {
  assert.deepEqual(TITLES.slice(7, 10), ['penitent', 'gatebreaker', 'herald'], 'the vocabulary\'s newest, last - then WB9g\'s Gatebreaker, the Broker\'s, which has no glyph, then HERALD\'s (SEAT1c\'s five after them, ARENA4\'s two after those: the pin reads past them)');
  assert.deepEqual(GLYPHS.slice(8, 10), ['penitent', 'herald'], 'and its glyph, HERALD\'s trumpet after it (SEAT1c\'s four after them, ARENA4\'s laurel after those: the pin reads past it)');
  assert.equal(TITLE_TEXT.penitent, 'Penitent', 'Diggleborf: "maybe "Penitent" for the title"');
  const stops = TITLE_GRADIENT.penitent;
  assert.equal(stops.length, 3);
  const [gold, light, sky] = stops;
  assert.equal(cssRgba(gold), '#ffd700', '"starting gold" - the web\'s own gold');
  assert.equal(cssRgba(sky), '#87ceeb', '"ending a sky blue" - the web\'s own skyblue');
  assert.equal(cssRgba(light), '#fff3d6');
  assert.ok(gold[0] > 0.9 && gold[1] > 0.7 && gold[2] < 0.2, 'the gold is gold');
  assert.ok(sky[2] > sky[1] && sky[1] > sky[0] && sky[0] > 0.4, 'the sky is a light blue');
  assert.ok(luma(light) > luma(gold) && luma(light) > luma(sky), 'the middle is lighter than either end - the light between them');
  assert.ok(light[0] >= light[1] && light[1] >= light[2], 'and warm, not green');
  // THE REASON FOR THE LIGHT: a gold and a sky blue both lean green, so the straight mix reads lime then sage
  const straight = Array.from({ length: 101 }, (_, i) => gradientAt([gold, sky], i / 100));
  assert.ok(straight.some(readsGreen), 'two stops straight: a green band in the word\'s middle');
  const along = Array.from({ length: 101 }, (_, i) => gradientAt(stops, i / 100));
  const green = along.map((c, i) => [i, c]).filter(([, c]) => readsGreen(c));
  assert.deepEqual(green, [], 'with the light between them no point along the word reads green');
  // the one colour, and the edge
  assert.equal(TITLE_RGBA.penitent, gold, 'the one colour a face with no gradient draws is the gold end, read from it');
  assert.deepEqual([...TITLE_EDGE.penitent], [0, 0, 0, 1], 'edged in black - its ends are both bright');
  assert.equal(TITLE_EDGE.shadowfang, undefined, 'Shadow Fang keeps its own crimson edge');
  assert.deepEqual(Object.keys(TITLE_EDGE).filter((t) => !TITLE_GRADIENT[t]), [], 'an edge is a gradient title\'s alone');
  assert.equal(new Set(TITLES.map((t) => cssRgba(TITLE_RGBA[t]))).size, TITLES.length, 'no two titles share a colour');
  // the badge records carry the paint
  const badge = titleBadge({ title: 'penitent' });
  assert.equal(badge.text, 'Penitent');
  assert.equal(badge.gradient, stops);
  assert.equal(badge.edge, TITLE_EDGE.penitent);
  assert.equal(titleBadge({ title: 'shadowfang' }).edge, null, 'a title with no edge of its own names none');
  assert.equal(titleBadge({ title: 'founder' }).edge, null);
  // the glyph's colours ARE the title's two ends - the two halves of one grant cannot drift apart
  assert.equal(GLYPH_RGBA.penitent, gold, 'the lozenge in the gold, read from the title');
  assert.equal(GLYPH_DETAIL.penitent.rgba, sky, 'the sword in the sky, read from the title');
  assert.equal(GLYPH_GRADIENT.penitent, undefined, 'the glyph is not a gradient: at a name\'s size a gold-to-blue stroke is one lime line');
  assert.equal(GLYPH_STROKE.penitent, true, 'the lozenge is a stroked outline, as in the sketch');
  assert.equal(GLYPH_MARK.penitent, '|');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, marks.length, 'a classic mark of its own');
  assert.ok(GLYPH_MARK.penitent.charCodeAt(0) >= FONT_GLYPH_MIN && GLYPH_MARK.penitent.charCodeAt(0) <= FONT_GLYPH_MAX, 'inside the font');
  assert.equal(GLYPH_LABEL.penitent, 'Penitent', 'named on the account card');
  const [g] = glyphBadges({ glyphs: ['penitent'] });
  assert.equal(g.gradient, null);
  assert.equal(g.detail, GLYPH_DETAIL.penitent);
});

test('PENITENT the glyph\'s shape: Diggleborf\'s sketch - a tall lozenge, point up and point down, widest a little below its middle; the sword inside it, point down, a small pommel, the grip, the guard its widest part, and a blade twice the hilt that tapers to the lozenge\'s lowest corner (mutants: the sword point up; the guard through the lozenge\'s sides)', () => {
  const [loz] = shapesOf(GLYPH_PATH.penitent);
  assert.match(GLYPH_PATH.penitent, /^M[^M]*Z$/, 'one closed shape');
  assert.equal(loz.length, 4, 'a lozenge: four corners');
  for (const [x, y] of loz) assert.ok(x >= 0 && x <= 16 && y >= 0 && y <= 16, 'inside the 16x16 box');
  const [top, right, bottom, left] = loz;
  assert.ok(top[0] === 8 && bottom[0] === 8, 'point up and point down, on the box\'s middle');
  assert.ok(top[1] < 1.5 && bottom[1] > 14.5, 'the box\'s whole height');
  assert.equal(left[1], right[1], 'level sides');
  assert.equal(8 - left[0], right[0] - 8, 'and symmetric');
  assert.ok(bottom[1] - top[1] > 1.3 * (right[0] - left[0]), 'tall - taller than it is wide');
  assert.ok(left[1] > 8 && left[1] < 9.5, 'widest a little below its middle, as the sketch\'s');
  // the sword
  const sword = shapesOf(GLYPH_DETAIL.penitent.path);
  assert.equal(sword.length, 4, 'pommel, grip, guard, blade');
  const [pommel, grip, guard, blade] = sword;
  const inLoz = insidePoly(loz);
  for (const s of sword) for (const p of s) assert.ok(inLoz(p) || (p[0] === 8 && Math.abs(p[1] - bottom[1]) < 1.5), `inside the lozenge: ${p}`);
  const ys = (s) => s.map((p) => p[1]), xs = (s) => s.map((p) => p[0]);
  const span = (a) => Math.max(...a) - Math.min(...a);
  assert.ok(Math.max(...ys(pommel)) <= Math.min(...ys(grip)) + 1e-9, 'the pommel above the grip');
  assert.ok(Math.max(...ys(grip)) <= Math.min(...ys(guard)) + 1e-9, 'the grip above the guard');
  assert.ok(Math.max(...ys(guard)) <= Math.min(...ys(blade)) + 1e-9, 'the guard above the blade - the point is DOWN');
  const tip = blade.reduce((a, p) => (p[1] > a[1] ? p : a));
  assert.equal(tip[0], 8, 'the tip on the middle');
  assert.ok(bottom[1] - tip[1] < 1.5, 'reaching the lozenge\'s lowest corner, where the sketch\'s meets it');
  assert.ok(span(ys(blade)) > 2 * (Math.max(...ys(grip)) - Math.min(...ys(pommel))), 'the blade twice the hilt - a sword, not a cross');
  assert.ok(span(xs(guard)) > span(xs(blade)) && span(xs(guard)) > span(xs(grip)) && span(xs(guard)) > span(xs(pommel)), 'the guard is the widest part');
  // the guard clears the lozenge's sides by more than the stroke's half, measured across (the name's stroke is 1.6 of
  // the box; the chat's 1.8): a guard that met the sides would draw the lozenge cut in two, not a sword in it
  const halfW = (y) => (y <= left[1] ? (y - top[1]) / (left[1] - top[1]) : (bottom[1] - y) / (bottom[1] - left[1])) * (right[0] - 8);
  const across = 0.9 / Math.cos(Math.atan((right[0] - 8) / (left[1] - top[1])));
  for (const [x, y] of guard) assert.ok(halfW(y) - Math.abs(x - 8) > across, `the guard clear of the sides at ${x},${y}`);
  for (const sh of sword) for (const [x, y] of sh) assert.ok(sh.some(([px, py]) => Math.abs(px - (16 - x)) < 1e-9 && Math.abs(py - y) < 1e-9), `the sword symmetric about the middle: ${x},${y}`);
});

// ── THE GRANT ───────────────────────────────────────────────────────

test('PENITENT grant: Diggleborf alone holds it, case-folded, title and glyph together; a Founder too wears the one pressed, and a guest and everyone else hold none; the glyph opens no staff command (mutants: the list crossed with Shadow Fang\'s; the glyph without the title; the grant to another account)', () => {
  assert.equal(v('PENITENT_HANDLES'), 'Diggleborf', 'Mac: "This new custom title/glyph is for the user Diggleborf"');
  assert.equal(TIER_LISTS.penitent, 'PENITENT_HANDLES');
  assert.equal(TIER_GLYPH.penitent, 'penitent');
  // the whole config, as the Worker reads it
  const env = Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
  const row = (handle, over = {}) => ({ handle, created_at: 1_800_000_000, registered_at: 1_900_000_000, ...over });   // FOUNDER3: first played after the cutoff, so no Founder
  const nowS = 1_900_000_000;
  for (const h of ['Diggleborf', 'diggleborf', 'DIGGLEBORF']) {
    assert.deepEqual(titlesHeld(row(h), env), ['penitent'], `${h}: Penitent and nothing else`);
    assert.deepEqual(glyphsOf(row(h), env, nowS), ['penitent'], `${h}: its glyph`);
  }
  assert.equal(equipRefusal('penitent', row('Diggleborf'), env), null, 'theirs to wear');
  assert.equal(titleWorn(row('Diggleborf', { title: 'penitent' }), env), 'penitent');
  assert.deepEqual(wardrobeOf(row('diggleborf', { title: 'penitent' }), env, nowS), { titles: ['penitent'], title: 'penitent', glyphs: ['penitent'], auras: [], aura: null, insignia: [] });   // WB9g: and no aura, no insignia bought
  // a Founder holds both, and wears the one stored until they press the other on the account card
  const founder = row('Diggleborf', { created_at: FOUNDER_UNTIL - 86_400, title: 'founder' });
  assert.deepEqual(titlesHeld(founder, env), ['founder', 'penitent']);
  assert.equal(titleWorn(founder, env), 'founder', 'nothing wears the new one for them');
  for (const h of ['SirMcMobdon', 'Dutchess', 'valenvalarys', 'SquidKamer', 'Lattymoy', 'Stranger']) {
    assert.ok(!titlesHeld(row(h), env).includes('penitent'), `${h} does not hold it`);
    assert.ok(!glyphsOf(row(h), env, nowS).includes('penitent'));
    assert.equal(equipRefusal('penitent', row(h), env), 'not-held');
  }
  assert.deepEqual(titlesHeld({ handle: null, created_at: 0 }, { PENITENT_HANDLES: 'Diggleborf' }), [], 'a guest holds none');
  assert.equal(isStaff(['penitent']), false, 'a title and a glyph, not the staff\'s commands - STAFF1\'s groups are Mac\'s own choice');
});

test('PENITENT token and relay: a token may carry the title and the glyph and verifies; the relay reads both out of the signature onto the peer\'s row (mutants: the vocabulary without it, so the relay refuses the token)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-pn', n: 'Diggleborf', k: 'linked', t: 'penitent', g: ['sprout', 'penitent'] }, kp.privateKey, { subtle, nowS });
  const r = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(r.ok, r.why);
  assert.equal(r.claims.t, 'penitent');
  assert.deepEqual(r.claims.g, ['sprout', 'penitent']);
  assert.equal(claimsValid({ v: 1, s: 'acct-pn', n: 'Diggleborf', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS] }), true, 'every glyph at once still fits (the widest token is shadowfang.test.js\'s AUDIT B8, walked from the vocabulary)');
  assert.deepEqual(readBadge({ title: 'penitent', glyphs: ['penitent'] }), { title: 'penitent', glyphs: ['penitent'] });

  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'Diggleborf', title: 'penitent', glyphs: ['penitent'] });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.equal(seen.title, 'penitent');
  assert.deepEqual(seen.glyphs, ['penitent']);
});

// ── THE PAINT ───────────────────────────────────────────────────────

test('PENITENT paint: the gradient clipped to the letters, gold into the light into the sky, edged OUTSIDE each letter in black - right, below, and under - where Shadow Fang\'s edge stays its crimson; over a head the name layer writes it once and the next title clears it (mutants: the edge back to the title\'s own colour; the paint written every frame)', () => {
  const p = titlePaint(titleBadge({ title: 'penitent' }));
  assert.deepEqual(Object.keys(p), [...TITLE_PAINT_KEYS]);
  assert.equal(p.backgroundImage, 'linear-gradient(90deg, #ffd700, #fff3d6, #87ceeb)');
  assert.equal(p.backgroundImage, cssGradient(TITLE_GRADIENT.penitent));
  assert.equal(p.webkitBackgroundClip, 'text');
  assert.equal(p.webkitTextFillColor, 'transparent');
  assert.equal(p.filter, 'drop-shadow(1px 0 0 #000000) drop-shadow(0 1px 0 #000000) drop-shadow(0 1px 0 #000)', 'black round the letters, as every title\'s text shadow is');
  assert.equal(p.color, '#ffd700');
  assert.equal(p.fontWeight, '500');
  assert.equal(p.textShadow, 'none');
  assert.equal(titlePaint(titleBadge({ title: 'shadowfang' })).filter, 'drop-shadow(1px 0 0 #d3193c) drop-shadow(0 1px 0 #d3193c) drop-shadow(0 1px 0 #000)', 'Shadow Fang\'s edge is still its crimson');
  // over a head
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  const pt = (over) => ({ id: 'peer-0001', name: 'Diggleborf', x: 400, y: 300, scale: 1, title: null, glyphs: [], ...over });
  layer.render({ points: [pt({ title: 'penitent', glyphs: ['penitent'] })] });
  const title = find(layer.tagFor('peer-0001').node, 'dfname-title');
  assert.equal(title.textContent, 'Penitent');
  for (const k of TITLE_PAINT_KEYS) assert.equal(title.style[k], p[k], k);
  title.writes = 0;
  for (let i = 0; i < 8; i++) layer.render({ points: [pt({ title: 'penitent', glyphs: ['penitent'] })] });
  assert.equal(title.writes, 0, 'eight frames, not one write to the title');
  layer.render({ points: [pt({ title: 'shadowfang' })] });
  assert.equal(title.style.filter, titlePaint(titleBadge({ title: 'shadowfang' })).filter, 'the next gradient title writes its own edge');
  layer.render({ points: [pt({})] });
  for (const k of TITLE_PAINT_KEYS) assert.equal(title.style[k], '', 'no title, no paint');
});

test('PENITENT the glyph drawn: the lozenge stroked in currentColor - the gold, inline on every DOM face - and the sword filled over it in the sky; no gradient of its own; the account card\'s colourless half leaves the gold to its class (mutants: the sword in the lozenge\'s gold; the sword under the lozenge)', () => {
  const doc = fakeDocument();
  const [g] = glyphBadges({ glyphs: ['penitent'] });
  const svg = glyphSvgNode(doc, g, 'x-glyph', 1.6);
  assert.equal(svg.attrs.viewBox, '0 0 16 16');
  assert.equal(svg.style.color, '#ffd700');
  assert.equal(svg.children.length, 2, 'the lozenge and the sword - no defs, no gradient');
  const [loz, sword] = svg.children;
  assert.equal(loz.attrs.d, GLYPH_PATH.penitent, 'the shape first, as every face and pin reads it');
  assert.equal(loz.attrs.fill, 'none');
  assert.equal(loz.attrs.stroke, 'currentColor');
  assert.equal(loz.attrs['stroke-width'], '1.6', 'at the face\'s own stroke');
  assert.equal(sword.attrs.d, GLYPH_DETAIL.penitent.path);
  assert.equal(sword.attrs.fill, '#87ceeb', 'the sword in the sky, on top');
  const bare = glyphArtNode(doc, g, 'acctglyphart', 1.6);
  assert.equal(bare.style.color, undefined, 'the colourless half sets no colour - the account card\'s class does');
  assert.equal(bare.children[1].attrs.fill, '#87ceeb', 'the sword brings its own');
});

test('PENITENT the account card: the button in the gold, the word inside it in the same paint as over a head, the glyph\'s chip in the gold, each from the skin', () => {
  const p = titlePaint(titleBadge({ title: 'penitent' }));
  const word = `.card button.acttitle.${badgeClass('tl', 'penitent')} .acttitleword { background-image: ${p.backgroundImage}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; font-weight: 500; text-shadow: none; filter: ${p.filter}; }`;
  for (const rule of [
    word,
    `.card button.acttitle.${badgeClass('tl', 'penitent')} { color: #ffd700; }`,
    `.card .acctglyph.${badgeClass('gl', 'penitent')} .acctglyphart { color: #ffd700; }`,
  ]) {
    assert.ok(badgeCss().includes(rule), rule);
    assert.ok(ENHANCED_CSS.includes(rule), `and it reached the skin: ${rule}`);
  }
});

// ── THE CLASSIC FACE ────────────────────────────────────────────────

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
const recorder = () => {
  const runs = [];
  return { runs, drawScreenQuad: () => {}, drawScreenQuadRun: (tex, qs, color) => runs.push({ quads: qs, color }) };
};

test('PENITENT the classic face: the word a letter at a time along the gradient - gold first, the light in the middle, the sky last - over one run of its BLACK edge a pixel down and right, and the name run carries the sword\'s mark (mutants: the edge run in the gold)', () => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'DIGGLEBORF', title: 'penitent', glyphs: ['penitent'], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }],
    (q) => [q.x, q.y, q.z], { bodyHeight: () => PEER_HEIGHT });
  const r = recorder();
  const drawn = rp.drawNames(r, FONT, mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)), lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]), 1600, 900, [0, 1.7, 0], 1, (q) => [q.x, q.y, q.z]);
  assert.equal(drawn, 2, 'the name and the title');
  const [name, edge, ...letters] = r.runs;
  assert.equal(name.quads.length, 'DIGGLEBORF|'.length, 'the name run carries the sword\'s mark');
  assert.deepEqual(edge.color, [...TITLE_EDGE.penitent], 'the edge, in black');
  assert.equal(edge.quads.length, 'Penitent'.length);
  assert.equal(letters.length, 'Penitent'.length, 'one run a letter');
  assert.deepEqual(letters[0].color, [...TITLE_GRADIENT.penitent[0]], '"P" in the gold');
  assert.deepEqual(letters.at(-1).color, [...TITLE_GRADIENT.penitent[2]], 'the last "t" in the sky');
  for (const l of letters) assert.equal(readsGreen(l.color), false, `no letter green: ${l.color.map((c) => c.toFixed(2))}`);
  assert.ok(edge.quads[0].dst.x > letters[0].quads[0].dst.x && edge.quads[0].dst.y > letters[0].quads[0].dst.y, 'the edge sits down and right of the word');
});
