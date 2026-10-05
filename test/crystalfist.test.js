// CRYSTAL-FIST — FLYLIGHTER'S OWN: THE CRYSTAL FIST, ITS GLYPH, AND THE CRYSTAL RESONANCE (2026-10-05).
//
// The owner, for Flylighter: "Title: Crystal Fist", "Glyph: Referenced above" - a picture of three purple slashes falling
// down to the right, the middle one the longest - and "Aura: Aura, also purple, would be a circle of tiny purple squares
// going up and down out of the ground. Something similar to what you see here, but the color 'gradient' would be
// unnecessary" (Octavia's in Warframe: a ring of a music visualiser's bars). The handle list grants all three together
// (TIER_LISTS, TIER_GLYPH and TIER_AURA); the title, the glyph and the aura are the reference's one purple, #a349a4;
// the aura is the sixth look of the aura pass (render/auraRing.js AURA_LOOK) - its shader RUN here, square by square,
// against the columns' one law (resonanceLevel).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { TITLES, GLYPHS, AURAS, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import {
  TITLE_TEXT, AURA_TEXT, AURA_PAINT, TITLE_RGBA, TITLE_GRADIENT, TITLE_EDGE, GLYPH_RGBA, GLYPH_GRADIENT, GLYPH_DETAIL,
  GLYPH_MARK, GLYPH_PATH, GLYPH_STROKE, FONT_GLYPH_MIN, FONT_GLYPH_MAX, cssRgba, titleBadge, glyphBadges, glyphSvgNode,
  titlePaint, badgeCss,
} from '../src/ui/playerBadge.js';
import { GLYPH_LABEL } from '../src/ui/enhancedAccount.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { isStaff } from '../src/net/staffCommands.js';
import {
  titlesHeld, glyphsOf, equipRefusal, titleWorn, aurasHeld, auraWorn, auraRefusal, wardrobeOf, TIER_LISTS, TIER_GLYPH, TIER_AURA,
} from '../server-account/src/titles.js';
import { readBadge, readAura, badged, RELAY_VERSION } from '../src/net/wire.js';
import { createNameLayer } from '../src/ui/nameLayer.js';
import { RemotePlayers, PEER_HEIGHT } from '../src/net/remotePlayers.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';
import { standService } from './accountDb.mjs';
import {
  AURA_LOOK, auraLookOf, AURA_RING_R, AURA_GROUND_R, AURA_LIFT_M, AURA_STEPS, AURA_CLOCK_PERIOD, AURA_VS, AURA_FS,
  RESONANCE_R, RESONANCE_COLUMNS, RESONANCE_CELLS, RESONANCE_PITCH_M, RESONANCE_SQUARE_M, RESONANCE_H, RESONANCE_HZ,
  RESONANCE_CRESTS, RESONANCE_RGB, resonanceRatesWhole, resonanceLevel, resonanceLit, AuraRingRenderer, RADIANCE_R, RADIANCE_H,
} from '../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from './glsl.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
/** The Worker's config as it reads it: every handle list. */
const ENV = Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
const AFTER = 1_900_000_000;      // first played long after Founder's cutoff, so no row below holds Founder by accident
const LATER = AFTER + 30 * 86_400;   // past the sprout's two weeks, so the only glyphs are the grants'
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });

/** A colour's hue in degrees, HSV. */
const hueOf = ([r, g, b]) => {
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 0;
  return max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
};
/** A purple: red and blue alike and both over green - its hue between a violet and a magenta. */
const purple = (c) => c[1] < c[0] && c[1] < c[2] && hueOf(c) > 280 && hueOf(c) < 320;

// ── the fake document (primarch.test.js's shape) ──
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

// ── THE VOCABULARY AND ITS FACE ─────────────────────────────────────

test('CRYSTAL-FIST vocabulary: the title and the glyph join the closed lists last, the aura joins AURAS last; "Crystal Fist" and "Crystal Resonance" in words; the title ONE colour - the reference\'s own purple, #a349a4 - no gradient, no edge; the glyph in it, filled; `\\` on the classic face; the resonance\'s button in the Crystal Fist\'s purple; the wire keeps all three (mutants: the colour, the glyph\'s colour, the mark, the fill, the button\'s paint, the words)', () => {
  assert.equal(TITLES.at(-1), 'crystalfist', 'the vocabulary\'s newest');
  assert.equal(GLYPHS.at(-1), 'crystalfist');
  assert.equal(AURAS.at(-1), 'resonance');
  assert.equal(TITLE_TEXT.crystalfist, 'Crystal Fist', 'the owner: "Title: Crystal Fist"');
  assert.equal(AURA_TEXT.resonance, 'Crystal Resonance');
  assert.equal(GLYPH_LABEL.crystalfist, 'Crystal Fist', 'named on the account card');
  assert.equal(cssRgba(TITLE_RGBA.crystalfist), '#a349a4', 'the reference\'s purple - every pixel of the glyph Flylighter sent');
  assert.ok(purple(TITLE_RGBA.crystalfist), `a purple: ${hueOf(TITLE_RGBA.crystalfist).toFixed(1)} degrees`);
  assert.equal(TITLE_GRADIENT.crystalfist, undefined, 'one colour - "the color \'gradient\' would be unnecessary"');
  assert.equal(TITLE_EDGE.crystalfist, undefined, 'and so no edge of its own: every face\'s black text shadow');
  assert.equal(new Set(TITLES.map((t) => cssRgba(TITLE_RGBA[t]))).size, TITLES.length, 'no two titles share a colour');
  for (const other of ['aegis', 'protector', 'apostle', 'hierophant']) {
    const d = Math.hypot(...[0, 1, 2].map((i) => (TITLE_RGBA.crystalfist[i] - TITLE_RGBA[other][i]) * 255));
    assert.ok(d > 30, `apart from the ${other}'s (${cssRgba(TITLE_RGBA[other])}, ${d.toFixed(0)} apart)`);
  }
  assert.equal(GLYPH_RGBA.crystalfist, TITLE_RGBA.crystalfist, 'the slashes in the title\'s own purple; the two halves of one grant cannot drift');
  assert.equal(GLYPH_GRADIENT.crystalfist, undefined);
  assert.equal(GLYPH_DETAIL.crystalfist, undefined, 'one shape, one colour');
  assert.equal(GLYPH_STROKE.crystalfist, false, 'filled, as the reference is');
  assert.equal(GLYPH_MARK.crystalfist, '\\', 'a slash falling down to the right, as the three do');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, marks.length, 'a classic mark of its own');
  assert.ok(GLYPH_MARK.crystalfist.charCodeAt(0) >= FONT_GLYPH_MIN && GLYPH_MARK.crystalfist.charCodeAt(0) <= FONT_GLYPH_MAX, 'inside the font');
  for (const a of AURAS) assert.ok(AURA_TEXT[a] && TITLES.includes(AURA_PAINT[a]), `every aura has a word and a title's paint for its button: ${a}`);
  assert.equal(AURA_PAINT.resonance, 'crystalfist', 'the resonance in the Crystal Fist\'s own purple');
  const badge = titleBadge({ title: 'crystalfist' });
  assert.deepEqual({ text: badge.text, rgba: badge.rgba, gradient: badge.gradient, edge: badge.edge }, { text: 'Crystal Fist', rgba: TITLE_RGBA.crystalfist, gradient: null, edge: null });
  assert.deepEqual(readBadge({ title: 'crystalfist', glyphs: ['crystalfist'] }), { title: 'crystalfist', glyphs: ['crystalfist'] }, 'the wire keeps it');
  assert.equal(readAura({ au: 'resonance' }), 'resonance', 'and the aura');
  assert.deepEqual(badged({ id: 'p1' }, { title: 'crystalfist', au: 'resonance' }), { id: 'p1', title: 'crystalfist', au: 'resonance' });
  assert.deepEqual(glyphBadges({ glyphs: ['crystalfist', 'disciple', 'sprout'] }).map((b) => b.key), ['sprout', 'disciple', 'crystalfist'], 'drawn in the vocabulary\'s order - beside Flylighter\'s Disciple flame');
});

/** The glyph's outline: each subpath (M L Z, absolute) as its corners, in order. */
const subpathsOf = (d) => d.split(/(?=M)/).map((sub) => [...sub.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((m) => [+m[1], +m[2]]));
/** A closed outline's signed area (the shoelace) - its sign is which way round it is wound. */
const areaOf = (pts) => pts.reduce((s, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + (x * y2 - x2 * y); }, 0) / 2;

test('CRYSTAL-FIST the glyph\'s shape: Flylighter\'s three slashes - each a band falling down to the right at the reference\'s 45 degrees, its ends cut square to it, all three parallel and one thickness, a gap of one width between them; the middle the longest, corner to corner; the upper and the lower two thirds its length, each beside its middle; every outline wound the same way round; inside the box (mutants: a slash turned, the middle as short as the others, a slash thicker, a slash wound the other way)', () => {
  const parts = subpathsOf(GLYPH_PATH.crystalfist);
  assert.equal(parts.length, 3, 'three slashes');
  for (const [x, y] of parts.flat()) assert.ok(x >= 0 && x <= 16 && y >= 0 && y <= 16, `inside the box: ${x},${y}`);
  // in the slash's own frame: s along it (down to the right), d across it (up to the right)
  const bands = parts.map((p) => {
    assert.equal(p.length, 4, 'four corners each');
    const s = p.map(([x, y]) => (x + y) / Math.SQRT2), d = p.map(([x, y]) => (x - y) / Math.SQRT2);
    // a band of the frame: two corners at each end (one s), two along each side (one d)
    const sv = [...new Set(s.map((q) => q.toFixed(1)))], dv = [...new Set(d.map((q) => q.toFixed(1)))];
    assert.equal(sv.length, 2, `its ends cut square to it: ${s.map((q) => q.toFixed(2))}`);
    assert.equal(dv.length, 2, `its two sides along it, at 45 degrees down to the right: ${d.map((q) => q.toFixed(2))}`);
    return { s0: Math.min(...s), s1: Math.max(...s), d0: Math.min(...d), d1: Math.max(...d), area: areaOf(p) };
  }).sort((a, b) => a.d0 - b.d0);   // lower-left, middle, upper-right
  const [lower, middle, upper] = bands;
  const width = (b) => b.d1 - b.d0, len = (b) => b.s1 - b.s0;
  for (const b of bands) assert.ok(Math.abs(width(b) - width(middle)) < 0.02, 'one thickness');
  assert.ok(width(middle) > 1.5 && width(middle) < 2.2, `a stroke a name's size can read (${width(middle).toFixed(2)} units)`);
  const gapLo = middle.d0 - lower.d1, gapHi = upper.d0 - middle.d1;
  assert.ok(Math.abs(gapLo - gapHi) < 0.02 && gapLo > 0.75 * width(middle) && gapLo < width(middle), `even gaps, a little under a stroke wide - the reference's six pixels to its seven (${gapLo.toFixed(2)}, ${gapHi.toFixed(2)})`);
  assert.ok(middle.s0 < 2 && middle.s1 > 20 && len(middle) > 0.8 * 16 * Math.SQRT2, `the middle corner to corner - from the box's top left to its bottom right (${middle.s0.toFixed(2)} to ${middle.s1.toFixed(2)} of ${(16 * Math.SQRT2).toFixed(2)})`);
  for (const b of [lower, upper]) {
    const r = len(b) / len(middle);
    assert.ok(Math.abs(r - 48 / 72) < 0.03, `two thirds the middle's length, the reference's 48 to 72 pixels (${r.toFixed(3)})`);
    assert.ok(b.s0 > middle.s0 && b.s1 < middle.s1, 'beside the middle\'s middle, inside its length');
  }
  assert.ok(upper.s0 > lower.s0, 'the upper a little further down the slash than the lower, as the reference\'s');
  assert.equal(new Set(bands.map((b) => Math.sign(b.area))).size, 1, 'every outline wound the same way round');
});

// ── THE GRANT ───────────────────────────────────────────────────────

test('CRYSTAL-FIST grant: CRYSTAL_FIST_HANDLES names Flylighter, and the list grants the title, its glyph AND the Crystal Resonance together, case-folded; Flylighter stays a Disciple - two titles held, one worn; worn while held, read off the config alone; off the list all three go and the Disciple stays, a guest holds none, and nobody else holds any (mutants: the handle, the list\'s key, the glyph\'s word, the aura\'s grant)', () => {
  assert.equal(v('CRYSTAL_FIST_HANDLES'), 'Flylighter', 'the owner: "For Flylighter"');
  assert.equal(TIER_LISTS.crystalfist, 'CRYSTAL_FIST_HANDLES');
  assert.equal(TIER_GLYPH.crystalfist, 'crystalfist');
  assert.equal(TIER_AURA.crystalfist, 'resonance');
  for (const h of ['Flylighter', 'flylighter', 'FLYLIGHTER']) {
    const p = row(h);
    assert.deepEqual(titlesHeld(p, ENV), ['disciple', 'crystalfist'], `${h}: the Disciple as before, and the Crystal Fist, by name, case-folded`);
    assert.deepEqual(glyphsOf(p, ENV, LATER), ['disciple', 'crystalfist'], 'and both glyphs');
    assert.deepEqual(aurasHeld(p, ENV), ['resonance'], 'and the resonance');
    assert.equal(equipRefusal('crystalfist', p, ENV), null);
    assert.equal(equipRefusal('disciple', p, ENV), null, 'either worn, one at a time');
    assert.equal(auraRefusal('resonance', p, ENV), null, 'theirs to wear');
  }
  const fl = row('Flylighter', { title: 'crystalfist', aura: 'resonance' });
  assert.equal(titleWorn(fl, ENV), 'crystalfist');
  assert.equal(auraWorn(fl, ENV), 'resonance');
  assert.equal(auraWorn(fl), undefined, 'without the config, the Broker\'s alone - the resonance is a list\'s');
  const w = wardrobeOf(fl, ENV, LATER);
  assert.deepEqual([w.titles, w.title, w.glyphs, w.auras, w.aura], [['disciple', 'crystalfist'], 'crystalfist', ['disciple', 'crystalfist'], ['resonance'], 'resonance'], 'the account card\'s whole answer');
  const off = { ...ENV, CRYSTAL_FIST_HANDLES: '' };
  assert.deepEqual([titlesHeld(fl, off), glyphsOf(fl, off, LATER), aurasHeld(fl, off)], [['disciple'], ['disciple'], []], 'off the list, all three go - the Disciple stays');
  assert.equal(titleWorn(fl, off), undefined, 'and the title is not worn by a row nobody cleared');
  assert.equal(auraWorn(fl, off), undefined);
  assert.equal(auraRefusal('resonance', fl, off), 'not-held');
  assert.deepEqual(titlesHeld({ ...fl, handle: null }, ENV), [], 'a guest holds none');
  assert.deepEqual(aurasHeld({ ...fl, handle: null }, ENV), []);
  for (const h of ['Dutchess', 'Satranath', 'Sureme', 'GA00250', 'SirMcMobdon', 'Flylighte', 'Flylighters']) {
    assert.ok(!titlesHeld(row(h), ENV).includes('crystalfist'), `${h} does not hold it`);
    assert.ok(!aurasHeld(row(h), ENV).includes('resonance'), `nor the resonance: ${h}`);
    assert.equal(auraRefusal('resonance', row(h), ENV), 'not-held');
  }
  assert.equal(isStaff(['crystalfist']), false, 'a title, a glyph and an aura - not the staff\'s commands');
});

test('CRYSTAL-FIST the service end to end: Flylighter registers, holds the title, the glyph and the resonance; wears the title and the resonance through their doors; the token signs all three; a stranger is refused the resonance; off the list, the next token carries none', async () => {
  const { env, call, registered, identityPublic } = await standService({ CRYSTAL_FIST_HANDLES: 'Flylighter' });
  const me = await registered('Flylighter');
  const mint = async () => {
    const r = await call('/v1/auth/token', {}, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const got = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(got.ok, got.why);
    return { answer: r.body, claims: got.claims };
  };
  let m = await mint();
  assert.ok(m.claims.g.includes('crystalfist'), 'the glyph is true from the first token');
  assert.equal('au' in m.claims, false, 'held and not worn: no aura signed');
  let r = await call('/v1/account/title', { title: 'crystalfist' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call('/v1/account/aura', { aura: 'resonance' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.auras, r.body.aura, r.body.title], [['resonance'], 'resonance', 'crystalfist'], 'the wardrobe answers it worn');
  m = await mint();
  assert.deepEqual([m.claims.t, m.claims.au, m.claims.g.includes('crystalfist')], ['crystalfist', 'resonance', true], 'all three signed');
  assert.equal(m.answer.aura, 'resonance', 'and said beside the token, for my own feet');
  const other = await registered('Stranger');
  r = await call('/v1/account/aura', { aura: 'resonance' }, other.secret);
  assert.equal(r.body.error, 'not-held', 'a stranger is refused the resonance');
  env.CRYSTAL_FIST_HANDLES = '';
  m = await mint();
  assert.deepEqual(['t' in m.claims, 'au' in m.claims, (m.claims.g ?? []).includes('crystalfist')], [false, false, false], 'off the list: the next token carries none of the three');
});

test('CRYSTAL-FIST token and relay: a token may carry the title, the glyph and the resonance and verifies; every glyph at once still fits; the relay - world170, the one that knows the words - reads all three out of the signature onto the peer\'s row (mutants: the vocabulary\'s aura)', async () => {
  assert.equal(RELAY_VERSION, 'world170', 'CRYSTAL-FIST moved it on (world170): the vocabulary rides the relay\'s bundle');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-fly', n: 'Flylighter', k: 'linked', t: 'crystalfist', g: ['disciple', 'crystalfist'], au: 'resonance' }, kp.privateKey, { subtle, nowS });
  const got = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(got.ok, got.why);
  assert.deepEqual([got.claims.t, got.claims.g, got.claims.au], ['crystalfist', ['disciple', 'crystalfist'], 'resonance']);
  assert.equal(claimsValid({ s: 'acct-fly', n: 'Flylighter', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS] }), true, 'every glyph at once still fits');
  assert.equal(claimsValid({ s: 'acct-fly', n: 'Flylighter', k: 'linked', i: nowS, e: nowS + 60, au: 'crystalresonance' }), false, 'a word the vocabulary does not hold is refused');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'Flylighter', title: 'crystalfist', glyphs: ['disciple', 'crystalfist'], au: 'resonance' });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((msg) => msg.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.deepEqual([seen.title, seen.glyphs, seen.au], ['crystalfist', ['disciple', 'crystalfist'], 'resonance']);
});

// ── THE FACES ───────────────────────────────────────────────────────

test('CRYSTAL-FIST drawn: over a head the word in the purple, plain - no gradient clipped to it; the glyph FILLED in currentColor - the purple, inline - one shape; the account card\'s rules for the title, the glyph and the resonance\'s button in the purple, and every one of them in the skin', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  layer.render({ points: [{ id: 'peer-0001', name: 'Flylighter', x: 400, y: 300, scale: 1, title: 'crystalfist', glyphs: ['crystalfist'] }] });
  const node = layer.tagFor('peer-0001').node;
  const title = find(node, 'dfname-title');
  assert.equal(title.textContent, 'Crystal Fist');
  assert.equal(title.style.color, '#a349a4');
  assert.equal(title.style.backgroundImage, '', 'one colour: no gradient');
  assert.equal(title.style.webkitTextFillColor, '', 'the letters filled in their own colour');
  assert.deepEqual(titlePaint(titleBadge({ title: 'crystalfist' })).color, '#a349a4');
  assert.equal(find(node, 'dfname-glyphs').children.length, 1, 'the slashes beside the name');
  const [g] = glyphBadges({ glyphs: ['crystalfist'] });
  const svg = glyphSvgNode(doc, g, 'x-glyph', 1.6);
  assert.equal(svg.style.color, '#a349a4');
  assert.equal(svg.children.length, 1, 'one shape');
  assert.deepEqual([svg.children[0].attrs.d, svg.children[0].attrs.fill, svg.children[0].attrs.stroke], [GLYPH_PATH.crystalfist, 'currentColor', undefined], 'filled');
  for (const rule of [
    '.card button.acttitle.tl-crystalfist { color: #a349a4; }',
    '.card .acctglyph.gl-crystalfist .acctglyphart { color: #a349a4; }',
    '.card button.acttitle.actaura.aura-resonance { color: #a349a4; }',
  ]) {
    assert.ok(badgeCss().includes(rule), rule);
    assert.ok(ENHANCED_CSS.includes(rule), `and it reached the skin: ${rule}`);
  }
  assert.ok(!badgeCss().includes('.tl-crystalfist .acttitleword'), 'no gradient word rule for a one-colour title');
});

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
const recorder = () => {
  const runs = [];
  return { runs, drawScreenQuad: () => {}, drawScreenQuadRun: (tex, qs, color) => runs.push({ quads: qs, color }) };
};

test('CRYSTAL-FIST the classic face: the name run carries the slash\'s mark, and the word is drawn whole in the purple (mutants: the mark dropped)', () => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'Flylighter', title: 'crystalfist', glyphs: ['crystalfist'], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }],
    (q) => [q.x, q.y, q.z], { bodyHeight: () => PEER_HEIGHT });
  const r = recorder();
  const drawn = rp.drawNames(r, FONT, mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)), lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]), 1600, 900, [0, 1.7, 0], 1, (q) => [q.x, q.y, q.z]);
  assert.equal(drawn, 2, 'the name and the title');
  assert.equal(r.runs[0].quads.length, 'Flylighter\\'.length, 'the name run carries the slash\'s mark');
  // a space is advance, not a quad: the word's run is its eleven letters
  const word = r.runs.find((run) => run.quads.length === 'CrystalFist'.length && run.color && cssRgba(run.color) === '#a349a4');
  assert.ok(word, 'the word drawn whole, in the purple');
});

// ── THE RESONANCE (render/auraRing.js) ──────────────────────────────

test('CRYSTAL-FIST the resonance\'s law: a look for every aura - the resonance the sixth kind, its ring inside the fire\'s and clear of the body, its wall the tallest column, no symbols; a column on each face of the strip; tiny squares, square, with room between them; every rate whole over the clock, every wave a whole number of crests round; its light the Crystal Fist\'s own purple - one colour (mutants: the kind, the radius, a rate off whole, the colour)', () => {
  for (const a of AURAS) assert.ok(Object.hasOwn(AURA_LOOK, a), `a look for ${a}`);
  assert.deepEqual({ ...AURA_LOOK.resonance }, { kind: 5, ringR: RESONANCE_R, flameH: RESONANCE_H, glyphs: 0 }, 'the sixth kind, at its own radius and height, no symbols');
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  assert.equal(auraLookOf('resonance'), AURA_LOOK.resonance);
  assert.ok(RESONANCE_R > RADIANCE_R && RESONANCE_R < AURA_RING_R + 0.05 && RESONANCE_R < AURA_GROUND_R - 0.3, 'a circle about the feet, clear of the body, inside the ground quad');
  assert.equal(RESONANCE_COLUMNS, AURA_STEPS, 'a column on each face of the strip the wall is drawn on');
  assert.ok(Math.abs(RESONANCE_H - RESONANCE_CELLS * RESONANCE_PITCH_M) < 1e-12, 'the wall the tallest column');
  assert.ok(RESONANCE_SQUARE_M < 0.06, `tiny (${RESONANCE_SQUARE_M} m)`);
  assert.ok(RESONANCE_SQUARE_M < RESONANCE_PITCH_M * 0.8 && RESONANCE_SQUARE_M < (2 * Math.PI * RESONANCE_R / RESONANCE_COLUMNS) * 0.6, 'room between them, up a column and round the ring');
  assert.ok(resonanceRatesWhole(), 'every resonance rate whole over the clock');
  for (const r of Object.values(RESONANCE_HZ)) assert.ok(Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6), `whole: ${r}`);
  for (const c of Object.values(RESONANCE_CRESTS)) assert.ok(Number.isInteger(c) && c > 0, `whole crests round the ring: ${c}`);
  const rgb = (c) => [...c].slice(0, 3).map((x) => +x.toFixed(3));
  assert.deepEqual(Object.keys(RESONANCE_RGB), ['purple'], 'one colour - "the color \'gradient\' would be unnecessary"');
  assert.deepEqual(rgb(RESONANCE_RGB.purple), rgb(TITLE_RGBA.crystalfist), 'the title\'s purple - "Aura, also purple"');
});

test('CRYSTAL-FIST the columns\' law: each column\'s level between nothing and its top, at least its foot lit; columns differ round the ring; each goes UP AND DOWN over time; the shader\'s level IS node\'s - the same arithmetic, run; the wrap whole (mutants: the bounce frozen, the beat dropped, the shader\'s level drifted from node\'s)', () => {
  const f = glslFunctions(AURA_FS, { uTime: 0, uKindle: 1, uRingR: RESONANCE_R, uFlameH: RESONANCE_H });
  const times = Array.from({ length: 40 }, (_, i) => 0.37 + i * 0.29);
  for (let k = 0; k < RESONANCE_COLUMNS; k++) {
    const lits = times.map((t) => resonanceLit(k, t));
    for (const n of lits) assert.ok(n >= 1 && n <= RESONANCE_CELLS, `column ${k}: from its foot to its top (${n})`);
    let ups = 0, downs = 0;
    for (let i = 1; i < lits.length; i++) { if (lits[i] > lits[i - 1]) ups++; else if (lits[i] < lits[i - 1]) downs++; }
    assert.ok(ups >= 4 && downs >= 4, `column ${k} goes up and down (${ups} up, ${downs} down: ${lits.join(' ')})`);
    for (const t of [0, 1.3, 7.77, 59.5, 118.2]) assert.ok(Math.abs(f.resonanceLevel(k, t) - resonanceLevel(k, t)) < 1e-12, `the shader's level is node's: column ${k} at ${t}`);
    assert.ok(Math.abs(resonanceLevel(k, 0) - resonanceLevel(k, AURA_CLOCK_PERIOD)) < 1e-9, `the wrap whole: column ${k}`);
  }
  for (const t of times) {
    const ring = Array.from({ length: RESONANCE_COLUMNS }, (_, k) => resonanceLit(k, t));
    assert.ok(Math.max(...ring) - Math.min(...ring) >= 3, `the ring's columns differ at ${t.toFixed(2)}: ${ring.join(' ')}`);
  }
  const all = times.flatMap((t) => Array.from({ length: RESONANCE_COLUMNS }, (_, k) => resonanceLit(k, t)));
  assert.ok(all.includes(RESONANCE_CELLS) && Math.min(...all) <= 2, `from a square or two to the column's top (${Math.min(...all)} to ${Math.max(...all)})`);
  assert.equal(resonanceLit(3, 5, 0), 0, 'unkindled: none');
  assert.ok(times.every((t) => resonanceLit(7, t, 0.4) <= resonanceLit(7, t, 1)), 'kindling, lower than whole');
});

/** The resonance's colour at a point - the shader's own main(), run, with `uAura` the resonance's. */
const resAt = (kind, vP, { t = 13.3, kindle = 1, world = [0, 0, 0], fog = null, eye = [0, 1.2, 5] } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vWorld: world, uKind: kind, uAura: 5, uTime: t, uSeed: 0.37, uKindle: kindle, uRingR: RESONANCE_R, uGroundR: AURA_GROUND_R,
    uFlameH: RESONANCE_H, uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uFogRange: [0, 1], uCamPos: eye, uAt: [0, 0, 0], uFocus: [0, 0, 0, 0],
  });
  f.main();
  return f.globals.o;
};
const lum = (c) => c[0] + c[1] + c[2];
const near3 = (c, want) => [0, 1, 2].every((i) => Math.abs(c[i] - want[i]) < 1e-3);
/** Square j of column k on the wall: its middle in (u, v), and a point across the gap beside it. */
const square = (k, j) => [(k + 0.5) / RESONANCE_COLUMNS, ((j + 0.5) * RESONANCE_PITCH_M) / RESONANCE_H];

test('CRYSTAL-FIST the resonance\'s wall, the shader RUN: every square the law stands lit is lit, in the purple itself and nothing else; every square over a column\'s top dark; the gaps between squares dark, up a column and round the ring; another moment, other squares; added onto the frame; unkindled nothing, half kindled lower; the wrap whole; the vertex half stands it at its radius to its height (mutants: the count off by one, the gap filled, the colour drifted, the kindle dropped)', () => {
  const P = RESONANCE_RGB.purple;
  let litN = 0, darkN = 0;
  for (const t of [3.3, 13.3, 47.9]) {
    for (const k of [0, 5, 11, 23, 30, 47]) {
      const n = resonanceLit(k, t);
      for (let j = 0; j < RESONANCE_CELLS; j++) {
        const c = resAt(1, square(k, j), { t });
        if (j < n) { assert.ok(near3(c, P), `column ${k} square ${j} lit at ${t}: ${c.slice(0, 3).map((x) => x.toFixed(3))}`); litN++; }
        else { assert.equal(lum(c), 0, `column ${k} square ${j} dark over its top (${n}) at ${t}`); darkN++; }
      }
    }
  }
  assert.ok(litN > 40 && darkN > 40, `both judged (${litN} lit, ${darkN} dark)`);
  assert.equal(resAt(1, square(5, 0))[3], 1, 'alpha 1 under ONE, ONE: the light is ADDED');
  // the gaps: between two squares of a lit column, and between two columns, darker than a square by far
  const k = 0, t = 13.3, n = resonanceLit(k, t);
  assert.ok(n >= 2, 'a column with two squares to judge between');
  const between = resAt(1, [(k + 0.5) / RESONANCE_COLUMNS, RESONANCE_PITCH_M / RESONANCE_H], { t });
  const beside = resAt(1, [(k + 1) / RESONANCE_COLUMNS, (0.5 * RESONANCE_PITCH_M) / RESONANCE_H], { t });
  assert.ok(lum(between) < 0.25 * lum(P) && lum(beside) < 0.25 * lum(P), `squares, not bars: up the column ${lum(between).toFixed(3)}, round the ring ${lum(beside).toFixed(3)}`);
  // another moment, other squares
  let moved = 0;
  for (let kk = 0; kk < RESONANCE_COLUMNS; kk += 4) for (let j = 0; j < RESONANCE_CELLS; j++) if ((lum(resAt(1, square(kk, j), { t: 3.3 })) > 0) !== (lum(resAt(1, square(kk, j), { t: 3.8 })) > 0)) moved++;
  assert.ok(moved >= 6, `up and down out of the ground (${moved} squares changed in half a second)`);
  // kindling
  assert.equal(lum(resAt(1, square(5, 0), { kindle: 0 })), 0, 'unkindled: nothing');
  const tall = [...Array(RESONANCE_COLUMNS).keys()].find((kk) => resonanceLit(kk, 13.3) >= 4);
  assert.ok(tall !== undefined, 'a tall column to judge');
  const top = resonanceLit(tall, 13.3) - 1;
  assert.ok(lum(resAt(1, square(tall, top))) > 0 && lum(resAt(1, square(tall, top), { kindle: 0.3 })) === 0, 'half kindled, the column not yet at its top');
  // the wrap
  for (let i = 0; i < 12; i++) {
    const p = square((i * 7) % RESONANCE_COLUMNS, i % RESONANCE_CELLS);
    assert.ok(Math.abs(lum(resAt(1, p, { t: 0 })) - lum(resAt(1, p, { t: AURA_CLOCK_PERIOD }))) < 1e-6, 'the wall at the wrap is the wall at zero');
  }
  assert.ok(lum(resAt(1, square(5, 0), { world: [0, 0, 400], fog: { density: 0.01 } })) < lum(resAt(1, square(5, 0))) * 0.1, 'the fog thins it');
  // the vertex half: the strip's foot on the ring, its top the tallest column's
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const vs = (aP) => { const f = glslFunctions(AURA_VS, { aP, uVP: I, uKind: 1, uAura: 5, uAt: [10, 2, -4], uGroundR: AURA_GROUND_R, uRingR: RESONANCE_R, uFlameH: RESONANCE_H, uLift: AURA_LIFT_M }); f.main(); return f.globals.vWorld; };
  const near = (p, q) => p.every((x, i) => Math.abs(x - q[i]) < 1e-9);
  assert.ok(near(vs([0.25, 0]), [10, 2 + AURA_LIFT_M, -4 + RESONANCE_R]), 'the wall\'s foot on the ring');
  assert.ok(near(vs([0.25, 1]), [10, 2 + AURA_LIFT_M + RESONANCE_H, -4 + RESONANCE_R]), 'its top the tallest column\'s');
});

test('CRYSTAL-FIST the resonance\'s ground, the shader RUN: a square at each column\'s foot on the ring, purple; dark between them, within the ring and past it; the quad\'s corners round; unkindled nothing (mutants: the feet dropped, the feet off their columns)', () => {
  const R = RESONANCE_R;
  for (let k = 0; k < RESONANCE_COLUMNS; k++) {
    const a = ((k + 0.5) / RESONANCE_COLUMNS) * Math.PI * 2, c = resAt(0, [Math.cos(a) * R, Math.sin(a) * R]);
    assert.ok(lum(c) > 0.6 * lum(RESONANCE_RGB.purple), `column ${k}'s foot lit (${lum(c).toFixed(3)})`);
    assert.ok(purple(c), `in the purple: ${c.slice(0, 3).map((x) => x.toFixed(3))}`);
    const g = (k / RESONANCE_COLUMNS) * Math.PI * 2;
    assert.ok(lum(resAt(0, [Math.cos(g) * R, Math.sin(g) * R])) < 0.5 * lum(c), `dark between column ${k - 1} and ${k}'s feet`);
  }
  assert.ok(lum(resAt(0, [0.1, 0.2])) < 0.02, 'dark within the ring');
  assert.ok(lum(resAt(0, [0, R + 0.35])) < 0.02, 'and past it');
  assert.throws(() => resAt(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8]), GlslDiscard, 'the quad\'s corners are round');
  assert.equal(lum(resAt(0, [R, 0.01], { kindle: 0 })), 0, 'unkindled: nothing');
});

test('CRYSTAL-FIST the resonance\'s draw: each wearer in its own look - the radiance and the resonance - the resonance\'s kind, radius and height set beside its place, its ground and its wall drawn and no symbols; one program (mutants: the look\'s kind)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12 }, {
    get(tg, k) {
      if (k in tg) return tg[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const r = new AuraRingRenderer(gl);
  assert.equal(calls.filter((c) => c[0] === 'createProgram').length, 1, 'one program for every aura');
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  r.draw([{ at: [1, 0, 1], aura: 'resonance' }, { at: [5, 0, 5], aura: 'radiance' }], I, I, [0, 0, 0], 10);
  assert.equal(r.drawn, 2);
  const per = (name, kind) => calls.filter((c) => c[0] === kind && c[1] === name).map((c) => c[2]);
  assert.deepEqual(per('uAura', 'uniform1i'), [2, 5], 'farthest first: the radiance, then the resonance');
  assert.deepEqual(per('uRingR', 'uniform1f'), [RADIANCE_R, RESONANCE_R], 'each at its own radius');
  assert.deepEqual(per('uFlameH', 'uniform1f'), [RADIANCE_H, RESONANCE_H], 'each wall at its own height');
  const draws = calls.filter((c) => c[0] === 'drawArrays').map((c) => c[3]);
  assert.deepEqual(draws, [6, AURA_STEPS * 6, 6, AURA_STEPS * 6], 'the resonance\'s ground and its wall on the strip, no symbols');
  assert.equal(calls.filter((c) => c[0] === 'useProgram').length, 1, 'the program bound once for the frame');
});
