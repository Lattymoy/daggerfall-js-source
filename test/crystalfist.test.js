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
  RESONANCE_R, RESONANCE_COLUMNS, RESONANCE_CELLS, RESONANCE_PITCH_M, RESONANCE_SQUARE_M, RESONANCE_H,
  RESONANCE_CRESTS, RESONANCE_RGB, resonanceRatesWhole, resonanceLevel, resonanceLit, resonanceLitInto, resonanceClock, AuraRingRenderer,
  RADIANCE_R, RADIANCE_H,
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
  assert.deepEqual(TITLES.slice(-9, -5), ['crystalfist', 'hourbreaker', 'hoursfirst', 'iliacchampion'], 'the vocabulary\'s newest when it came - SD9b\'s Hourbreaker after it, HOURS-FIRST\'s Hour\'s First after that (PIN MOVED), CARDS10\'s Iliac Champion after that at the merge (PIN MOVED) - the Chapters\' five after them (CHAP4c, CHAP6e, PIN MOVED)');
  assert.equal(GLYPHS.at(-1), 'crystalfist');
  assert.deepEqual(AURAS.slice(-3), ['resonance', 'turninghour', 'firsthour'], 'the vocabulary\'s newest when it came - SD9c\'s Turning Hour after it, HOURS-FIRST\'s First Hour after that (PIN MOVED)');
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

test('CRYSTAL-FIST the glyph\'s shape: Flylighter\'s three slashes - each a band falling down to the right at the reference\'s 45 degrees, its ends cut square to it and their corners taken off alike (AUDIT), all three parallel and one thickness, a gap of one width between them; the middle the longest, corner to corner; the upper and the lower two thirds its length, each beside its middle; every outline wound the same way round; inside the box (mutants: a slash turned, the middle as short as the others, a slash thicker, a slash wound the other way, a corner left square)', () => {
  const parts = subpathsOf(GLYPH_PATH.crystalfist);
  assert.equal(parts.length, 3, 'three slashes');
  for (const [x, y] of parts.flat()) assert.ok(x >= 0 && x <= 16 && y >= 0 && y <= 16, `inside the box: ${x},${y}`);
  // in the slash's own frame: s along it (down to the right), d across it (up to the right)
  const bands = parts.map((p) => {
    assert.equal(p.length, 8, 'a band with its four corners taken off: eight corners each');
    const s = p.map(([x, y]) => (x + y) / Math.SQRT2), d = p.map(([x, y]) => (x - y) / Math.SQRT2);
    const s0 = Math.min(...s), s1 = Math.max(...s), d0 = Math.min(...d), d1 = Math.max(...d);
    const at = (v, w) => Math.abs(v - w) < 0.02;
    // a band of the frame: two corners on each side along it (one d each - at 45 degrees down to the right), two on each
    // end square to it (one s each)
    for (const [name, vs, w] of [['its upper side along it', d, d1], ['its lower side along it', d, d0], ['its upper end square to it', s, s0], ['its lower end square to it', s, s1]]) {
      assert.equal(vs.filter((q) => at(q, w)).length, 2, `${name}: ${vs.map((q) => q.toFixed(2))}`);
    }
    // AUDIT: each corner taken off by the same cut, back along the slash and in across it alike - the reference's ends
    // rounded two pixels at their corners - and never so deep the end is a point
    const edges = p.map(([x, y], i) => {
      const [x2, y2] = p[(i + 1) % p.length];
      const sa = (x + y) / Math.SQRT2, sb = (x2 + y2) / Math.SQRT2, da = (x - y) / Math.SQRT2, db = (x2 - y2) / Math.SQRT2;
      return { len: Math.hypot(x2 - x, y2 - y), kind: at(da, db) ? 'side' : at(sa, sb) ? 'end' : 'cut' };
    });
    assert.deepEqual(['side', 'end', 'cut'].map((k) => edges.filter((e) => e.kind === k).length), [2, 2, 4], 'two sides along it, two ends square to it, four corners cut on the slant');
    const cut = edges.filter((e) => e.kind === 'cut').map((e) => e.len);
    assert.ok(cut.every((c) => Math.abs(c - cut[0]) < 0.02) && cut[0] > 0.2 && cut[0] < 0.4 * (d1 - d0) * Math.SQRT2, `every corner cut alike, a rounding and not a point (${cut.map((c) => c.toFixed(2))})`);
    return { s0, s1, d0, d1, area: areaOf(p) };
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

test('CRYSTAL-FIST token and relay: a token may carry the title, the glyph and the resonance and verifies; every glyph at once still fits; the relay - world171 and after, the ones that know the words - reads all three out of the signature onto the peer\'s row (mutants: the vocabulary\'s aura)', async () => {
  assert.equal(RELAY_VERSION, 'world186', 'PIN MOVED: world186, INT11-INT14 (the INTEGRITY arc\'s lane 3); PIN MOVED: world185, INT7-INT10 (the INTEGRITY arc\'s lane 2 - world183, then world184, on its branch, renumbered past CHAP4c\'s world183 and PERF-RELAY1\'s world184 at the merges); PIN MOVED: world183, CHAP4c (the chapters\' seats\' titles on the token - past THE WROTHGARIAN ZONE\'s world177, TAVERN CARDS\' world178, HOURS-FIRST\'s world179, TAVERN-TABLES\' world180, TV-BEYOND\'s world181 and CARDS10\'s world182 at the merges); CRYSTAL-FIST moved it on (world171 - world170 on its branch, renumbered past main\'s FEUD at the merge), WATCH-FIX after it (world172, the watch record names its resident - PIN MOVED), SERPENT3 after that (world173, the sea serpent brain - world171 on its branch, renumbered past CRYSTAL-FIST\'s and WATCH-FIX\'s at the merges - PIN MOVED), LEGACY7 after that (world174, the house on the token and the row - world172 on its branch, renumbered past WATCH-FIX\'s and SERPENT3\'s at the merge - PIN MOVED); TEXT-F1 after that (world175, the words a player types starred - PIN MOVED): the vocabulary rides the relay\; s at the merge - PIN MOVED), SUPER-DUNGEONS after that (world176, a re-laid dungeon\'s room of its own - world171 on its branch, renumbered past CRYSTAL-FIST\'s at one merge and past WATCH-FIX\'s, SERPENT3\'s and LEGACY7\'s at the next - PIN MOVED): the vocabulary rides the relay\'s bundle');
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

test('CRYSTAL-FIST the resonance\'s law: a look for every aura - the resonance the sixth kind, drawn premultiplied (it COVERS, so it stays the one purple), its ring inside the fire\'s and clear of the body, no symbols; tiny squares with room between them; every rate whole over the clock and none stopped, every wave a whole number of crests round; its light the Crystal Fist\'s own purple - one colour (mutants: the kind, the radius, a rate off whole, a rate stopped, the colour, added not covered)', () => {
  for (const a of AURAS) assert.ok(Object.hasOwn(AURA_LOOK, a), `a look for ${a}`);
  assert.deepEqual({ ...AURA_LOOK.resonance }, { kind: 5, ringR: RESONANCE_R, flameH: RESONANCE_H, glyphs: 0, shade: true }, 'the sixth kind, at its own radius and height, no symbols - AUDIT: premultiplied, a square over a square or over a bright ground still the purple');
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  assert.equal(auraLookOf('resonance'), AURA_LOOK.resonance);
  assert.ok(RESONANCE_R > RADIANCE_R && RESONANCE_R < AURA_RING_R, 'a circle about the feet, clear of the body, inside the fire\'s ring (AUDIT: strictly)');
  assert.ok(RESONANCE_SQUARE_M < 0.06, `tiny (${RESONANCE_SQUARE_M} m)`);
  assert.ok(RESONANCE_SQUARE_M < RESONANCE_PITCH_M * 0.8 && RESONANCE_SQUARE_M < (2 * Math.PI * RESONANCE_R / RESONANCE_COLUMNS) * 0.6, 'room between them, up a column and round the ring');
  assert.ok(resonanceRatesWhole(), 'every resonance rate whole over the clock, and none stopped');
  for (const c of Object.values(RESONANCE_CRESTS)) assert.ok(Number.isInteger(c) && c > 0, `whole crests round the ring: ${c}`);
  const rgb = (c) => [...c].slice(0, 3).map((x) => +x.toFixed(3));
  assert.deepEqual(Object.keys(RESONANCE_RGB), ['purple'], 'one colour - "the color \'gradient\' would be unnecessary"');
  assert.deepEqual(rgb(RESONANCE_RGB.purple), rgb(TITLE_RGBA.crystalfist), 'the title\'s purple - "Aura, also purple"');
});

/** AUDIT: the level's law at recorded moments - the wave, the counter-wave, each column's bounce and the beat all in
 *  it, so a term dropped, frozen or retimed moves these (float64, node's alone: the GPU is handed the counts). */
const LEVELS = [[0, 0.37, 0.5125467715120549], [5, 3.3, 0.39510160855532445], [11, 13.3, 0.5558466109861463], [23, 47.9, 0.4041532094309946], [30, 61.25, 0.501381747491689], [47, 119.6, 0.15688039438263884], [17, 88.8, 0.5017048053353554], [40, 7.07, 0.7318089849489025]];

test('CRYSTAL-FIST the columns\' law: the level at recorded moments; each column between its foot and its top; columns differ round the ring; each goes UP AND DOWN over time; kindling, every column\'s foot first and the rest rising after; the wrap whole; every count at once, on a wearer\'s own clock - two wearers do not rise as one (mutants: the bounce frozen, the beat dropped, a wave retimed, the rates back on a six-second loop, the foot unlit while kindling, the seed ignored)', () => {
  for (const [k, t, want] of LEVELS) assert.ok(Math.abs(resonanceLevel(k, t) - want) < 1e-9, `column ${k} at ${t}: ${resonanceLevel(k, t)} (the law records ${want})`);
  const times = Array.from({ length: 40 }, (_, i) => 0.37 + i * 0.29);
  for (let k = 0; k < RESONANCE_COLUMNS; k++) {
    const lits = times.map((t) => resonanceLit(k, t));
    for (const n of lits) assert.ok(n >= 1 && n <= RESONANCE_CELLS, `column ${k}: from its foot to its top (${n})`);
    let ups = 0, downs = 0;
    for (let i = 1; i < lits.length; i++) { if (lits[i] > lits[i - 1]) ups++; else if (lits[i] < lits[i - 1]) downs++; }
    assert.ok(ups >= 4 && downs >= 4, `column ${k} goes up and down (${ups} up, ${downs} down: ${lits.join(' ')})`);
    assert.ok(Math.abs(resonanceLevel(k, 0) - resonanceLevel(k, AURA_CLOCK_PERIOD)) < 1e-9, `the wrap whole: column ${k}`);
  }
  for (const t of times) {
    const ring = Array.from({ length: RESONANCE_COLUMNS }, (_, k) => resonanceLit(k, t));
    assert.ok(Math.max(...ring) - Math.min(...ring) >= 3, `the ring's columns differ at ${t.toFixed(2)}: ${ring.join(' ')}`);
  }
  const all = times.flatMap((t) => Array.from({ length: RESONANCE_COLUMNS }, (_, k) => resonanceLit(k, t)));
  assert.ok(all.includes(RESONANCE_CELLS) && Math.min(...all) <= 2, `from a square or two to the column's top (${Math.min(...all)} to ${Math.max(...all)})`);
  // kindling: nothing unkindled; every column's foot from the first moment; the rest rising after
  assert.equal(resonanceLit(3, 5, 0), 0, 'unkindled: none');
  for (let k = 0; k < RESONANCE_COLUMNS; k++) assert.equal(resonanceLit(k, 5, 0.05), 1, `kindling, column ${k}'s foot first - out of the ground`);
  assert.ok(times.every((t) => resonanceLit(7, t, 0.4) <= resonanceLit(7, t, 1)) && times.some((t) => resonanceLit(7, t, 0.4) < resonanceLit(7, t, 1)), 'kindling, lower than whole');
  // every count at once, on the wearer's own clock
  const out = new Float32Array(RESONANCE_COLUMNS);
  assert.equal(resonanceLitInto(out, 13.3, 0.6), out, 'into the list it is handed');
  assert.deepEqual([...out], Array.from({ length: RESONANCE_COLUMNS }, (_, k) => resonanceLit(k, 13.3, 0.6)));
  assert.ok(Math.abs(resonanceClock(13.3, 0) - 13.3) < 1e-9, 'a seed of nothing: the frame\'s clock');
  assert.ok(Math.abs(resonanceClock(13.3 + AURA_CLOCK_PERIOD, 0.25) - (13.3 + 0.25 * AURA_CLOCK_PERIOD)) < 1e-9, 'the frame\'s clock wrapped, then the wearer\'s seed');
  assert.ok(Math.abs(resonanceClock(13.3, undefined) - 13.3) < 1e-9, 'a wearer with no seed on the frame\'s');
  // AUDIT: the ring never repeats inside the clock - at 1/2, 1/3 and 1/2 Hz it repeated every six seconds - so no two
  // seeds rise and fall as one
  const ringAt = (tt) => [...resonanceLitInto(new Float32Array(RESONANCE_COLUMNS), tt)].join(' ');
  for (let d = 0.5; d < AURA_CLOCK_PERIOD; d += 0.5) assert.notEqual(ringAt(13.3 + d), ringAt(13.3), `the ring ${d} s on is another ring`);
  const a = [...resonanceLitInto(new Float32Array(RESONANCE_COLUMNS), resonanceClock(13.3, 0.1))], b = [...resonanceLitInto(new Float32Array(RESONANCE_COLUMNS), resonanceClock(13.3, 0.6))];
  assert.notDeepEqual(a, b, 'two wearers side by side do not rise and fall as one');
});

/** The resonance's colour at a point - the shader's own main(), run, with `uAura` the resonance's and the counts node's
 *  law hands it (`uResLit`). `px` the metres a pixel spans there (the scene's derivatives). Premultiplied: rgb, cover. */
const resAt = (kind, vP, { t = 13.3, kindle = 1, world = [0, 0, 0], fog = null, eye = [0, 1.2, 5], px = 0.001, lits = null } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vWorld: world, uKind: kind, uAura: 5, uTime: t, uSeed: 0, uKindle: kindle, uRingR: RESONANCE_R, uGroundR: AURA_GROUND_R,
    uFlameH: RESONANCE_H, uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uFogRange: [0, 1], uCamPos: eye, uAt: [0, 0, 0], uFocus: [0, 0, 0, 0],
    uResLit: lits ?? [...resonanceLitInto(new Float32Array(RESONANCE_COLUMNS), t, kindle)],
    dFdx: () => [px, 0, 0], dFdy: () => [0, px, 0],
  });
  f.main();
  return f.globals.o;
};
const lum = (c) => c[0] + c[1] + c[2];
const near3 = (c, want) => [0, 1, 2].every((i) => Math.abs(c[i] - want[i]) < 1e-3);
/** Square j of column k on the wall: its middle in (u, v). */
const square = (k, j) => [(k + 0.5) / RESONANCE_COLUMNS, ((j + 0.5) * RESONANCE_PITCH_M) / RESONANCE_H];

test('CRYSTAL-FIST the resonance\'s wall, the shader RUN: every square node\'s count stands lit is lit - the purple itself, covering whole - and every square over a column\'s top is nothing; the gaps between squares nothing, up a column and round the ring; an edge a pixel wide; far off, a cell its average cover and no moire; another moment, other squares; unkindled nothing, kindling only the feet; the vertex half stands it at its radius to its height (mutants: the count off by one, the counts ignored, the gap filled, the colour drifted, the fade dropped)', () => {
  const P = RESONANCE_RGB.purple;
  let litN = 0, darkN = 0;
  for (const t of [3.3, 13.3, 47.9]) {
    for (const k of [0, 5, 11, 23, 30, 47]) {
      const n = resonanceLit(k, t);
      for (let j = 0; j < RESONANCE_CELLS; j++) {
        const c = resAt(1, square(k, j), { t });
        if (j < n) { assert.ok(near3(c, P) && Math.abs(c[3] - 1) < 1e-9, `column ${k} square ${j} lit at ${t}, covering whole: ${c.map((x) => x.toFixed(3))}`); litN++; }
        else { assert.deepEqual(c, [0, 0, 0, 0], `column ${k} square ${j} nothing over its top (${n}) at ${t}`); darkN++; }
      }
    }
  }
  assert.ok(litN > 40 && darkN > 40, `both judged (${litN} lit, ${darkN} dark)`);
  // the counts ARE what it draws: a column handed a count is drawn to it, whatever the clock says
  const lits = Array(RESONANCE_COLUMNS).fill(1); lits[11] = 7;
  assert.ok(lum(resAt(1, square(11, 6), { lits })) > 0 && lum(resAt(1, square(11, 7), { lits })) === 0 && lum(resAt(1, square(12, 1), { lits })) === 0, 'drawn to the count it is handed - node\'s, never a float32 sin\'s');
  // the gaps, and the edge
  const t = 13.3, k = [...Array(RESONANCE_COLUMNS).keys()].find((kk) => resonanceLit(kk, t) >= 2);
  assert.ok(k !== undefined, 'a column with two squares to judge between');
  const between = resAt(1, [(k + 0.5) / RESONANCE_COLUMNS, RESONANCE_PITCH_M / RESONANCE_H], { t });
  const beside = resAt(1, [(k + 1) / RESONANCE_COLUMNS, (0.5 * RESONANCE_PITCH_M) / RESONANCE_H], { t });
  assert.deepEqual([between[3], beside[3]], [0, 0], 'squares, not bars: nothing up the column between them or round the ring between columns');
  const edgeAt = (dx) => resAt(1, [(k + 0.5) / RESONANCE_COLUMNS + dx / (2 * Math.PI * RESONANCE_R), square(k, 0)[1]], { t, px: 0.004 })[3];
  const half = RESONANCE_SQUARE_M / 2;
  assert.ok(Math.abs(edgeAt(half) - 0.5) < 0.02 && edgeAt(half - 0.004) > 0.95 && edgeAt(half + 0.004) < 0.05, `an edge a pixel wide (${edgeAt(half - 0.004).toFixed(2)}, ${edgeAt(half).toFixed(2)}, ${edgeAt(half + 0.004).toFixed(2)})`);
  // far off - a pixel as wide as a cell - every point of a lit cell its average cover: no row to moire
  const pitchX = 2 * Math.PI * RESONANCE_R / RESONANCE_COLUMNS, avg = RESONANCE_SQUARE_M ** 2 / (pitchX * RESONANCE_PITCH_M);
  for (const [du, dv] of [[0, 0], [0.4, 0], [0, 0.45], [0.45, 0.45]]) {
    const c = resAt(1, [(k + 0.5 + du) / RESONANCE_COLUMNS, (0.5 + dv) * RESONANCE_PITCH_M / RESONANCE_H], { t, px: 0.08 });
    assert.ok(Math.abs(c[3] - avg) < 1e-6 && near3(c, P.map((x) => x * avg)), `far off, the cell's average cover everywhere in it (${c[3].toFixed(4)} vs ${avg.toFixed(4)})`);
  }
  // another moment, other squares
  let moved = 0;
  for (let kk = 0; kk < RESONANCE_COLUMNS; kk += 4) for (let j = 0; j < RESONANCE_CELLS; j++) if ((resAt(1, square(kk, j), { t: 3.3 })[3] > 0) !== (resAt(1, square(kk, j), { t: 3.8 })[3] > 0)) moved++;
  assert.ok(moved >= 6, `up and down out of the ground (${moved} squares changed in half a second)`);
  // kindling
  assert.equal(lum(resAt(1, square(5, 0), { kindle: 0 })), 0, 'unkindled: nothing');
  const tall = [...Array(RESONANCE_COLUMNS).keys()].find((kk) => resonanceLit(kk, 13.3) >= 4);
  assert.ok(lum(resAt(1, square(tall, 0), { kindle: 0.05 })) > 0 && lum(resAt(1, square(tall, 1), { kindle: 0.05 })) === 0, 'kindling: its foot lit, nothing over it - rising out of the ground');
  assert.ok(lum(resAt(1, square(5, 0), { world: [0, 0, 400], fog: { density: 0.01 } })) < lum(resAt(1, square(5, 0))) * 0.1, 'the fog thins it');
  // the vertex half: the strip's foot on the ring, its top the tallest column's
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const vs = (aP) => { const f = glslFunctions(AURA_VS, { aP, uVP: I, uKind: 1, uAura: 5, uAt: [10, 2, -4], uGroundR: AURA_GROUND_R, uRingR: RESONANCE_R, uFlameH: RESONANCE_H, uLift: AURA_LIFT_M }); f.main(); return f.globals.vWorld; };
  const near = (p, q) => p.every((x, i) => Math.abs(x - q[i]) < 1e-9);
  assert.ok(near(vs([0.25, 0]), [10, 2 + AURA_LIFT_M, -4 + RESONANCE_R]), 'the wall\'s foot on the ring');
  assert.ok(near(vs([0.25, 1]), [10, 2 + AURA_LIFT_M + RESONANCE_H, -4 + RESONANCE_R]), 'its top the tallest column\'s');
});

test('CRYSTAL-FIST the resonance\'s ground, the shader RUN: a square at each column\'s foot on the ring, the purple covering whole; nothing between them, within the ring and past it - and the middle, where the angle is no number, nothing (AUDIT: it painted white); the quad\'s corners round; unkindled nothing (mutants: the feet dropped, the feet off their columns, the ring\'s guard dropped)', () => {
  const R = RESONANCE_R, P = RESONANCE_RGB.purple;
  for (let k = 0; k < RESONANCE_COLUMNS; k++) {
    const a = ((k + 0.5) / RESONANCE_COLUMNS) * Math.PI * 2, c = resAt(0, [Math.cos(a) * R, Math.sin(a) * R]);
    assert.ok(near3(c, P) && Math.abs(c[3] - 1) < 1e-9, `column ${k}'s foot, the purple covering whole: ${c.map((x) => x.toFixed(3))}`);
    const g = (k / RESONANCE_COLUMNS) * Math.PI * 2;
    assert.equal(resAt(0, [Math.cos(g) * R, Math.sin(g) * R])[3], 0, `nothing between column ${k - 1} and ${k}'s feet`);
  }
  for (const p of [[0, 0], [1e-9, 0], [0.1, 0.2], [0, R - 0.1], [0, R + 0.1], [0, R + 0.35]]) {
    const c = resAt(0, p);
    assert.ok(c.every((x) => x === 0), `nothing off the ring at ${p} - never a NaN (${c})`);
  }
  assert.throws(() => resAt(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8]), GlslDiscard, 'the quad\'s corners are round');
  assert.equal(resAt(0, [R, 0.01], { kindle: 0 })[3], 0, 'unkindled: nothing');
});

test('CRYSTAL-FIST the resonance\'s draw: each wearer in its own look - the radiance added, the resonance premultiplied and handed back added - the resonance\'s kind, radius and height beside its place, node\'s counts on its own clock handed over, its ground and its wall drawn and no symbols; one program (mutants: the look\'s kind, the counts not handed, the seed ignored, added not covered)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13 }, {
    get(tg, k) {
      if (k in tg) return tg[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const r = new AuraRingRenderer(gl);
  assert.equal(calls.filter((c) => c[0] === 'createProgram').length, 1, 'one program for every aura');
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  r.draw([{ at: [1, 0, 1], aura: 'resonance', seed: 0.3, kindle: 0.7 }, { at: [5, 0, 5], aura: 'radiance' }], I, I, [0, 0, 0], 10);
  assert.equal(r.drawn, 2);
  const per = (name, kind) => calls.filter((c) => c[0] === kind && c[1] === name).map((c) => c[2]);
  assert.deepEqual(per('uAura', 'uniform1i'), [2, 5], 'farthest first: the radiance, then the resonance');
  assert.deepEqual(per('uRingR', 'uniform1f'), [RADIANCE_R, RESONANCE_R], 'each at its own radius');
  assert.deepEqual(per('uFlameH', 'uniform1f'), [RADIANCE_H, RESONANCE_H], 'each wall at its own height');
  const handed = calls.filter((c) => c[0] === 'uniform1fv' && c[1] === 'uResLit');
  assert.equal(handed.length, 1, 'the counts handed for the resonance alone');
  assert.deepEqual([...handed[0][2]], [...resonanceLitInto(new Float32Array(RESONANCE_COLUMNS), resonanceClock(10, 0.3), 0.7)], 'node\'s counts, on the wearer\'s own clock and kindle');
  const blends = calls.filter((c) => c[0] === 'blendFunc' || c[0] === 'uniform1i' && c[1] === 'uAura').map((c) => (c[0] === 'blendFunc' ? c.slice(1).join('/') : `aura${c[2]}`));
  assert.deepEqual(blends.slice(0, 5), ['10/10', 'aura2', 'aura5', '10/13', '10/10'], 'added for the radiance; the resonance premultiplied (ONE, ONE_MINUS_SRC_ALPHA) and the blend handed back');
  const draws = calls.filter((c) => c[0] === 'drawArrays').map((c) => c[3]);
  assert.deepEqual(draws, [6, AURA_STEPS * 6, 6, AURA_STEPS * 6], 'the resonance\'s ground and its wall on the strip, no symbols');
  assert.equal(calls.filter((c) => c[0] === 'useProgram').length, 1, 'the program bound once for the frame');
});
