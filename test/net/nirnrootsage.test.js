// NIRNROOT-SAGE — BLOB-MARLEY'S OWN: THE NIRNROOT SAGE, ITS GLYPH, AND SAGE'S SMOKE (2026-10-26).
//
// For Blob-Marley, an Immortal backer - his custom aura, worked out with SirMcMobdon: "a cloud of billowing smoke with
// nirnroots circling around me", and his final idea, "billowing smoke, circling nirn roots around midsection, small
// glowing green runes encircling feet". The owner named the title Nirnroot Sage and its glyph a nirnroot sprig. The
// handle list grants all three together (TIER_LISTS, TIER_GLYPH and TIER_AURA, WIKIMAID's law); the title is drawn a
// nirnroot's leaf into its glow into the smoke's haze, the glyph is a nirnroot - its leaves, its stem and its glowing bulb
// - and the aura is the aura pass's fifteenth look (render/auraRing.js AURA_LOOK): green runes round the feet, smoke
// billowing up about the body, and the glyph's own nirnroots circling the waist, every card where node's law has it
// (sageCardsInto), its shader RUN here against it.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from '../fakeRoom.mjs';
import { TITLES, GLYPHS, AURAS, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../../src/net/identityToken.js';
import {
  TITLE_TEXT, AURA_TEXT, AURA_PAINT, TITLE_RGBA, TITLE_GRADIENT, TITLE_EDGE, GLYPH_RGBA, GLYPH_GRADIENT, GLYPH_DETAIL,
  GLYPH_MARK, GLYPH_PATH, GLYPH_STROKE, FONT_GLYPH_MIN, FONT_GLYPH_MAX, cssRgba, titleBadge, glyphBadges, glyphSvgNode,
  glyphDetails, titlePaint, badgeCss, NIRN_LEAF, NIRN_GLOW, NIRN_HAZE, NIRN_DEEP, NIRN_SMOKE,
} from '../../src/ui/playerBadge.js';
import { GLYPH_LABEL } from '../../src/ui/enhanced/enhancedAccount.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { isStaff } from '../../src/net/staffCommands.js';
import {
  titlesHeld, glyphsOf, equipRefusal, titleWorn, aurasHeld, auraWorn, auraRefusal, wardrobeOf, TIER_LISTS, TIER_GLYPH, TIER_AURA,
} from '../../server-account/src/titles.js';
import { readBadge, readAura, badged, RELAY_VERSION } from '../../src/net/wire.js';
import { createNameLayer } from '../../src/ui/nameLayer.js';
import { RemotePlayers, PEER_HEIGHT } from '../../src/net/remotePlayers.js';
import { perspective, mirrorProjectionX, lookAt } from '../../src/world/mat4.js';
import { standService } from '../accountDb.mjs';
import {
  AURA_LOOK, auraLookOf, AURA_RING_R, AURA_GROUND_R, AURA_LIFT_M, AURA_STEPS, AURA_CLOCK_PERIOD, AURA_VS, AURA_FS, AURA_CARDS,
  RADIANCE_R, glyphEdges, AuraRingRenderer,
  SAGE_RUNE_R, SAGE_RUNES, SAGE_RUNE_SCALE, SAGE_BAND_M, SAGE_WALL_H, SAGE_SCRIPT, SAGE_ROOTS, SAGE_ROOT_R, SAGE_ROOT_Y,
  SAGE_ROOT_M, SAGE_ROOT_PAD, SAGE_ROOT_BOB, SAGE_ROOT_SWAY, SAGE_ROOT_TILT, SAGE_EMERGE, SAGE_EMERGE_STEP, SAGE_PUFFS,
  SAGE_PUFF_LIFE, SAGE_PUFF_M, SAGE_SMOKE_H, SAGE_PUFF_R, SAGE_PUFF_DRIFT, SAGE_PUFF_A, SAGE_NEAR, SAGE_CARDS, SAGE_HZ,
  SAGE_RGB, sageRatesWhole, sagePuff, sageRoot, sageClock, sageCardsInto,
} from '../../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
/** The Worker's config as it reads it: every handle list. */
const ENV = Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
const AFTER = 1_900_000_000;      // first played long after Founder's cutoff, so no row below holds Founder by accident
const LATER = AFTER + 30 * 86_400;   // past the sprout's two weeks, so the only glyphs are the grants'
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });
const TAU = Math.PI * 2;

/** A colour's hue in degrees, HSV. */
const hueOf = ([r, g, b]) => {
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 0;
  return max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
};
/** A green: green over red and over blue, its hue between a yellow-green and a teal. */
const green = (c) => c[1] > c[0] && c[1] > c[2] && hueOf(c) > 90 && hueOf(c) < 165;
const apart = (a, b) => Math.hypot(...[0, 1, 2].map((i) => (a[i] - b[i]) * 255));

// ── the fake document (wikimaid.test.js's shape) ──
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

test('NIRNROOT-SAGE vocabulary: the title and the glyph join the closed lists last, the aura joins AURAS last; "Nirnroot Sage" and "Sage\'s Smoke" in words, the glyph named on the account card; the title a gradient - the leaf into the glow into the haze, #2e9e57, #7affb0, #e2f0e8 - edged in black, its one colour the glow, apart from every title\'s; the glyph in the glow, filled; `Y` on the classic face; the smoke\'s button in the Sage\'s paint; the wire keeps all three (mutants: the gradient\'s stops, its order, the edge, the one colour, the glyph\'s colour, the mark, the fill, the button\'s paint, the words)', () => {
  assert.equal(TITLES.at(-1), 'nirnrootsage', 'the vocabulary\'s newest');
  assert.equal(GLYPHS.at(-1), 'nirnrootsage');
  assert.equal(AURAS.at(-1), 'sagesmoke');
  assert.equal(TITLE_TEXT.nirnrootsage, 'Nirnroot Sage', 'the owner\'s word for it');
  assert.equal(AURA_TEXT.sagesmoke, 'Sage\'s Smoke');
  assert.equal(GLYPH_LABEL.nirnrootsage, 'Nirnroot Sage', 'named on the account card');
  assert.deepEqual(TITLE_GRADIENT.nirnrootsage.map(cssRgba), ['#2e9e57', '#7affb0', '#e2f0e8'], 'the leaf, the glow, the haze - in that order, left to right');
  assert.deepEqual(TITLE_GRADIENT.nirnrootsage, [NIRN_LEAF, NIRN_GLOW, NIRN_HAZE], 'the family named once (ui/playerBadge.js NIRN_*)');
  assert.ok(green(NIRN_LEAF) && green(NIRN_GLOW) && green(NIRN_DEEP), `a nirnroot's greens (${[NIRN_LEAF, NIRN_GLOW, NIRN_DEEP].map((c) => hueOf(c).toFixed(0))} degrees)`);
  assert.ok(NIRN_HAZE[1] > NIRN_HAZE[0] && NIRN_HAZE[0] > 0.85 && NIRN_SMOKE[1] > NIRN_SMOKE[0] && Math.max(...NIRN_SMOKE.slice(0, 3)) - Math.min(...NIRN_SMOKE.slice(0, 3)) < 0.1, 'the haze a pale, the smoke a grey - each a breath of the green in it');
  assert.deepEqual(TITLE_EDGE.nirnrootsage, [0, 0, 0, 1], 'its haze end is pale: edged in black, as every gradient title with a light end');
  assert.equal(TITLE_RGBA.nirnrootsage, NIRN_GLOW, 'its one colour the glow - the gradient\'s middle');
  assert.equal(new Set(TITLES.map((t) => cssRgba(TITLE_RGBA[t]))).size, TITLES.length, 'no two titles share a colour');
  for (const t of TITLES.filter((x) => x !== 'nirnrootsage')) assert.ok(apart(TITLE_RGBA.nirnrootsage, TITLE_RGBA[t]) > 40, `apart from the ${t}'s (${cssRgba(TITLE_RGBA[t])}, ${apart(TITLE_RGBA.nirnrootsage, TITLE_RGBA[t]).toFixed(0)} apart)`);
  assert.equal(GLYPH_RGBA.nirnrootsage, TITLE_RGBA.nirnrootsage, 'the nirnroot in the title\'s glow; the two halves of one grant cannot drift');
  assert.equal(GLYPH_GRADIENT.nirnrootsage, undefined, 'one colour, its details over it');
  assert.equal(GLYPH_STROKE.nirnrootsage, false, 'filled');
  assert.equal(GLYPH_MARK.nirnrootsage, 'Y', 'a sprig: its stem and a leaf up each side');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, marks.length, 'a classic mark of its own');
  assert.ok(GLYPH_MARK.nirnrootsage.charCodeAt(0) >= FONT_GLYPH_MIN && GLYPH_MARK.nirnrootsage.charCodeAt(0) <= FONT_GLYPH_MAX, 'inside the font');
  for (const a of AURAS) assert.ok(AURA_TEXT[a] && TITLES.includes(AURA_PAINT[a]), `every aura has a word and a title's paint for its button: ${a}`);
  assert.equal(AURA_PAINT.sagesmoke, 'nirnrootsage', 'the smoke in the Nirnroot Sage\'s own paint');
  const badge = titleBadge({ title: 'nirnrootsage' });
  assert.deepEqual({ text: badge.text, rgba: badge.rgba, gradient: badge.gradient, edge: badge.edge }, { text: 'Nirnroot Sage', rgba: NIRN_GLOW, gradient: TITLE_GRADIENT.nirnrootsage, edge: TITLE_EDGE.nirnrootsage });
  assert.deepEqual(readBadge({ title: 'nirnrootsage', glyphs: ['nirnrootsage'] }), { title: 'nirnrootsage', glyphs: ['nirnrootsage'] }, 'the wire keeps it');
  assert.equal(readAura({ au: 'sagesmoke' }), 'sagesmoke', 'and the aura');
  assert.deepEqual(badged({ id: 'p1' }, { title: 'nirnrootsage', au: 'sagesmoke' }), { id: 'p1', title: 'nirnrootsage', au: 'sagesmoke' });
  assert.deepEqual(glyphBadges({ glyphs: ['nirnrootsage', 'sprout'] }).map((b) => b.key), ['sprout', 'nirnrootsage'], 'drawn in the vocabulary\'s order');
});

/** A path's figures (absolute M, L, Q and Z) as their corners and control points, in order. */
const figuresOf = (d) => d.split(/(?=M)/).map((sub) => [...sub.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]));
/** Whether two segments cross (each's ends strictly either side of the other's line). */
const crosses = ([ax, ay, bx, by], [cx, cy, dx, dy]) => {
  const side = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
  return side(ax, ay, bx, by, cx, cy) * side(ax, ay, bx, by, dx, dy) < 0 && side(cx, cy, dx, dy, ax, ay) * side(cx, cy, dx, dy, bx, by) < 0;
};
/** Inside a shape filled even-odd over its edges (the shader's own rule, cloakCross). */
const insideOf = (edges, [x, y]) => edges.reduce((n, [ax, ay, bx, by]) => n + ((ay <= y) !== (by <= y) && x < ax + ((y - ay) * (bx - ax)) / (by - ay) ? 1 : 0), 0) % 2 === 1;

test('NIRNROOT-SAGE the glyph\'s shape: a nirnroot - one outline, inside the box, NEVER CROSSING ITSELF (the aura\'s nirnroots fill it even-odd); the bulb at its top in the middle; a broad leaf out to each side low down, and a narrower pair up the stem, the right one higher; its details a list of two - the four leaves\' veins in the deep green, inside the leaves and none crossing another; the bulb\'s heart in the haze, inside the bulb - each a figure the shader\'s edges can cut (mutants: a leaf dropped, the outline crossing itself, the heart out of the bulb, the details out of order)', () => {
  const [outline, ...more] = figuresOf(GLYPH_PATH.nirnrootsage);
  assert.equal(more.length, 0, 'one outline');
  for (const [x, y] of outline) assert.ok(x >= 0 && x <= 16 && y >= 0 && y <= 16, `inside the box: ${x},${y}`);
  assert.equal(GLYPH_PATH.nirnrootsage.split('Z').length - 1, 1, 'closed');
  assert.match(GLYPH_PATH.nirnrootsage, /^M[\d. MLQZ]+$/, 'in M, L, Q and Z alone');
  const edges = glyphEdges(GLYPH_PATH.nirnrootsage);
  for (let i = 0; i < edges.length; i++) for (let j = i + 2; j < edges.length; j++) {
    if (i === 0 && j === edges.length - 1) continue;   // the closing edge meets the first
    assert.ok(!crosses(edges[i], edges[j]), `never crossing itself: edges ${i} and ${j}`);
  }
  const top = outline.reduce((t, p) => (p[1] < t[1] ? p : t));
  assert.ok(top[1] < 1 && Math.abs(top[0] - 8) < 1, `the bulb at the top, in the middle (${top})`);
  assert.ok(insideOf(edges, [8.3, 2.8]) && insideOf(edges, [8.3, 12]), 'the bulb and the stem filled');
  assert.ok(insideOf(edges, [2.5, 12]) && insideOf(edges, [13.5, 12]), 'a broad leaf out to each side, low down');
  assert.ok(insideOf(edges, [4, 8.8]) && insideOf(edges, [11.5, 7]), 'a narrower pair up the stem');
  assert.ok(!insideOf(edges, [4, 4]) && !insideOf(edges, [12, 3]) && !insideOf(edges, [5.5, 11]), 'open air between the leaves and beside the bulb');
  const tips = outline.filter(([x]) => x < 1.5 || x > 14.5);
  assert.ok(tips.some(([x]) => x < 1.5) && tips.some(([x]) => x > 14.5) && tips.every(([, y]) => y > 9), `the broad leaves the glyph's widest, low (${tips.map((p) => p.join(','))})`);
  const leftMid = outline.filter(([x, y]) => x < 3 && y < 9), rightMid = outline.filter(([x, y]) => x > 13 && y < 9);
  assert.ok(leftMid.length && rightMid.length && Math.min(...rightMid.map(([, y]) => y)) < Math.min(...leftMid.map(([, y]) => y)), 'the right of the upper pair higher than the left, as a plant grows');
  const dets = GLYPH_DETAIL.nirnrootsage;
  assert.ok(Array.isArray(dets) && dets.length === 2, 'two details, a list');
  assert.deepEqual(glyphDetails(dets), dets, 'walked as they are');
  assert.deepEqual(dets.map((d) => cssRgba(d.rgba)), [cssRgba(NIRN_DEEP), cssRgba(NIRN_HAZE)], 'the veins\' deep green, then the heart\'s haze');
  const veins = figuresOf(dets[0].path);
  assert.equal(veins.length, 4, 'a vein to each leaf');
  for (const vein of veins) for (const p of vein) assert.ok(insideOf(edges, p), `a vein inside its leaf (${p})`);
  const veinEdges = glyphEdges(dets[0].path);
  for (let i = 0; i < veinEdges.length; i++) for (let j = i + 1; j < veinEdges.length; j++) assert.ok(!crosses(veinEdges[i], veinEdges[j]), `no vein crossing another (${i}, ${j})`);
  const [heart] = figuresOf(dets[1].path);
  for (const p of heart) assert.ok(insideOf(edges, p) && p[1] < 5, `the heart inside the bulb (${p})`);
  for (const d of dets) assert.doesNotThrow(() => glyphEdges(d.path));
});

// ── THE GRANT ───────────────────────────────────────────────────────

test('NIRNROOT-SAGE grant: NIRNROOT_SAGE_HANDLES names Blob-Marley, and the list grants the title, its glyph AND Sage\'s Smoke together, case-folded; worn while held, read off the config alone; off the list all three go, a guest holds none, every other list\'s holder and a near name hold none; no staff command rides it (mutants: the handle, the list\'s key, the glyph\'s word, the aura\'s grant)', () => {
  assert.equal(v('NIRNROOT_SAGE_HANDLES'), 'Blob-Marley', 'for the in-game account BLOB-MARLEY');
  assert.equal(TIER_LISTS.nirnrootsage, 'NIRNROOT_SAGE_HANDLES');
  assert.equal(TIER_GLYPH.nirnrootsage, 'nirnrootsage');
  assert.equal(TIER_AURA.nirnrootsage, 'sagesmoke');
  for (const h of ['Blob-Marley', 'BLOB-MARLEY', 'blob-marley']) {
    const p = row(h);
    assert.deepEqual(titlesHeld(p, ENV), ['nirnrootsage'], `${h}: the Nirnroot Sage, by name, case-folded`);
    assert.deepEqual(glyphsOf(p, ENV, LATER), ['nirnrootsage'], 'and its glyph');
    assert.deepEqual(aurasHeld(p, ENV), ['sagesmoke'], 'and the smoke');
    assert.equal(equipRefusal('nirnrootsage', p, ENV), null);
    assert.equal(auraRefusal('sagesmoke', p, ENV), null, 'his to wear');
  }
  const bm = row('Blob-Marley', { title: 'nirnrootsage', aura: 'sagesmoke' });
  assert.equal(titleWorn(bm, ENV), 'nirnrootsage');
  assert.equal(auraWorn(bm, ENV), 'sagesmoke');
  assert.equal(auraWorn(bm), undefined, 'without the config, the Broker\'s alone - the smoke is a list\'s');
  const w = wardrobeOf(bm, ENV, LATER);
  assert.deepEqual([w.titles, w.title, w.glyphs, w.auras, w.aura], [['nirnrootsage'], 'nirnrootsage', ['nirnrootsage'], ['sagesmoke'], 'sagesmoke'], 'the account card\'s whole answer');
  const off = { ...ENV, NIRNROOT_SAGE_HANDLES: '' };
  assert.deepEqual([titlesHeld(bm, off), glyphsOf(bm, off, LATER), aurasHeld(bm, off)], [[], [], []], 'off the list, all three go');
  assert.equal(titleWorn(bm, off), undefined, 'and the title is not worn by a row nobody cleared');
  assert.equal(auraWorn(bm, off), undefined);
  assert.equal(auraRefusal('sagesmoke', bm, off), 'not-held');
  assert.deepEqual(titlesHeld({ ...bm, handle: null }, ENV), [], 'a guest holds none');
  assert.deepEqual(aurasHeld({ ...bm, handle: null }, ENV), []);
  for (const h of ['SylviaBun', 'Flylighter', 'Sureme', 'GA00250', 'SirMcMobdon', 'Nirnroot', 'BlobMarley', 'Blob-Marley2', 'Blob Marley']) {
    assert.ok(!titlesHeld(row(h), ENV).includes('nirnrootsage'), `${h} does not hold it`);
    assert.ok(!aurasHeld(row(h), ENV).includes('sagesmoke'), `nor the smoke: ${h}`);
    assert.equal(auraRefusal('sagesmoke', row(h), ENV), 'not-held');
  }
  assert.equal(isStaff(['nirnrootsage']), false, 'a title, a glyph and an aura - not the staff\'s commands');
});

test('NIRNROOT-SAGE the service end to end: Blob-Marley registers, holds the title, the glyph and the smoke; wears the title and the smoke through their doors; the token signs all three; a stranger is refused the smoke; off the list, the next token carries none', async () => {
  const { env, call, registered, identityPublic } = await standService({ NIRNROOT_SAGE_HANDLES: 'Blob-Marley' });
  const me = await registered('Blob-Marley');
  const mint = async () => {
    const r = await call('/v1/auth/token', {}, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const got = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(got.ok, got.why);
    return { answer: r.body, claims: got.claims };
  };
  let m = await mint();
  assert.ok(m.claims.g.includes('nirnrootsage'), 'the glyph is true from the first token');
  assert.equal('au' in m.claims, false, 'held and not worn: no aura signed');
  let r = await call('/v1/account/title', { title: 'nirnrootsage' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call('/v1/account/aura', { aura: 'sagesmoke' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.auras, r.body.aura, r.body.title], [['sagesmoke'], 'sagesmoke', 'nirnrootsage'], 'the wardrobe answers it worn');
  m = await mint();
  assert.deepEqual([m.claims.t, m.claims.au, m.claims.g.includes('nirnrootsage')], ['nirnrootsage', 'sagesmoke', true], 'all three signed');
  assert.equal(m.answer.aura, 'sagesmoke', 'and said beside the token, for his own feet');
  const other = await registered('Stranger');
  r = await call('/v1/account/aura', { aura: 'sagesmoke' }, other.secret);
  assert.equal(r.body.error, 'not-held', 'a stranger is refused the smoke');
  env.NIRNROOT_SAGE_HANDLES = '';
  m = await mint();
  assert.deepEqual([m.claims.t, m.claims.au, (m.claims.g ?? []).includes('nirnrootsage')], [undefined, undefined, false], 'off the list, the next token carries none of the three');
});

test('NIRNROOT-SAGE token and relay: a token may carry the title, the glyph and the smoke and verifies; every glyph at once still fits; a word the vocabulary lacks is refused; the relay - world268 and after, the ones that know the words - reads all three out of the signature onto the peer\'s row (mutants: the vocabulary\'s words)', async () => {
  assert.equal(RELAY_VERSION, 'world268', 'NIRNROOT-SAGE moved it on: the vocabulary rides the relay\'s bundle (world267 on its branch, renumbered past KETCH-WORDS at the merge; NOT YET DEPLOYED)');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-blob', n: 'Blob-Marley', k: 'linked', t: 'nirnrootsage', g: ['nirnrootsage'], au: 'sagesmoke' }, kp.privateKey, { subtle, nowS });
  const got = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(got.ok, got.why);
  assert.deepEqual([got.claims.t, got.claims.g, got.claims.au], ['nirnrootsage', ['nirnrootsage'], 'sagesmoke']);
  assert.equal(claimsValid({ s: 'acct-blob', n: 'Blob-Marley', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS] }), true, 'every glyph at once still fits');
  assert.equal(claimsValid({ s: 'acct-blob', n: 'Blob-Marley', k: 'linked', i: nowS, e: nowS + 60, au: 'sagesmokes' }), false, 'an aura the vocabulary does not hold is refused');
  assert.equal(claimsValid({ s: 'acct-blob', n: 'Blob-Marley', k: 'linked', i: nowS, e: nowS + 60, t: 'nirnroot' }), false, 'and a title');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'Blob-Marley', title: 'nirnrootsage', glyphs: ['nirnrootsage'], au: 'sagesmoke' });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((msg) => msg.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.deepEqual([seen.title, seen.glyphs, seen.au], ['nirnrootsage', ['nirnrootsage'], 'sagesmoke']);
});

// ── THE FACES ───────────────────────────────────────────────────────

test('NIRNROOT-SAGE drawn: over a head the words in their gradient clipped to the letters, their black edge out from each; the glyph FILLED in its glow, inline, and over it its two details in their own colours, in order; the account card\'s rules for the title (and its gradient word), the glyph and the smoke\'s button, every one of them in the skin (mutants: the details dropped, the edge dropped)', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  layer.render({ points: [{ id: 'peer-0001', name: 'Blob-Marley', x: 400, y: 300, scale: 1, title: 'nirnrootsage', glyphs: ['nirnrootsage'] }] });
  const node = layer.tagFor('peer-0001').node;
  const title = find(node, 'dfname-title');
  assert.equal(title.textContent, 'Nirnroot Sage');
  assert.equal(title.style.backgroundImage, 'linear-gradient(90deg, #2e9e57, #7affb0, #e2f0e8)', 'the gradient, left to right');
  assert.equal(title.style.webkitTextFillColor, 'transparent', 'clipped to the letters');
  assert.ok(title.style.filter.includes('drop-shadow(1px 0 0 #000000)'), `its black edge (${title.style.filter})`);
  assert.equal(find(node, 'dfname-glyphs').children.length, 1, 'the nirnroot beside the name');
  const [g] = glyphBadges({ glyphs: ['nirnrootsage'] });
  const svg = glyphSvgNode(doc, g, 'x-glyph', 1.6);
  assert.equal(svg.style.color, '#7affb0');
  assert.equal(svg.children.length, 3, 'the nirnroot and its two details');
  assert.deepEqual([svg.children[0].attrs.d, svg.children[0].attrs.fill, svg.children[0].attrs.stroke], [GLYPH_PATH.nirnrootsage, 'currentColor', undefined], 'the nirnroot, filled');
  assert.deepEqual(svg.children.slice(1).map((c) => [c.attrs.d, c.attrs.fill]), GLYPH_DETAIL.nirnrootsage.map((d) => [d.path, cssRgba(d.rgba)]), 'its veins and the bulb\'s heart over it, each in its own colour, in order');
  for (const rule of [
    '.card button.acttitle.tl-nirnrootsage { color: #7affb0; }',
    '.card .acctglyph.gl-nirnrootsage .acctglyphart { color: #7affb0; }',
    '.card button.acttitle.actaura.aura-sagesmoke { color: #7affb0; }',
  ]) {
    assert.ok(badgeCss().includes(rule), rule);
    assert.ok(ENHANCED_CSS.includes(rule), `and it reached the skin: ${rule}`);
  }
  assert.ok(badgeCss().includes('.tl-nirnrootsage .acttitleword { background-image: linear-gradient(90deg, #2e9e57, #7affb0, #e2f0e8);'), 'the title\'s words in their gradient on the card');
  assert.ok(badgeCss().includes('.aura-sagesmoke .actauraword { background-image: linear-gradient(90deg, #2e9e57, #7affb0, #e2f0e8);'), 'and the smoke\'s word, the Sage\'s paint');
  assert.deepEqual(titlePaint(titleBadge({ title: 'nirnrootsage' })).color, '#7affb0', 'the button keeps the plain glow');
});

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
const recorder = () => {
  const runs = [];
  return { runs, drawScreenQuad: () => {}, drawScreenQuadRun: (tex, qs, color) => runs.push({ quads: qs, color }) };
};

test('NIRNROOT-SAGE the classic face: the name run carries the sprig\'s mark; the words a letter at a time along the gradient - "N" in the leaf, the last "e" in the haze - over one run of their black edge a pixel down and right (mutants: the mark dropped)', () => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'Blob-Marley', title: 'nirnrootsage', glyphs: ['nirnrootsage'], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }],
    (q) => [q.x, q.y, q.z], { bodyHeight: () => PEER_HEIGHT });
  const r = recorder();
  const drawn = rp.drawNames(r, FONT, mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)), lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]), 1600, 900, [0, 1.7, 0], 1, (q) => [q.x, q.y, q.z]);
  assert.equal(drawn, 2, 'the name and the title');
  const [name, edge, ...rest] = r.runs;
  assert.equal(name.quads.length, 'Blob-MarleyY'.length, 'the name run carries the sprig\'s mark');
  assert.deepEqual(edge.color, [0, 0, 0, 1], 'the edge, in black');
  const letters = rest.filter((run) => run.quads.length);
  assert.equal(letters.length, 'NirnrootSage'.length, 'one run a letter (the space draws none)');
  assert.deepEqual(letters[0].color.map((c) => +c.toFixed(3)), [...NIRN_LEAF], '"N" in the leaf');
  assert.deepEqual(letters.at(-1).color.map((c) => +c.toFixed(3)), [...NIRN_HAZE], 'the last "e" in the haze');
  assert.ok(edge.quads[0].dst.x > letters[0].quads[0].dst.x && edge.quads[0].dst.y > letters[0].quads[0].dst.y, 'the edge sits down and right of the words');
});

// ── SAGE'S SMOKE (render/auraRing.js) ───────────────────────────────

test('NIRNROOT-SAGE the smoke\'s look: a look for every aura - Sage\'s Smoke the fifteenth kind, drawn premultiplied (the smoke and the nirnroots COVER), its runes round the feet inside the fire\'s ring and clear of the boots, its wall to the knee, its puffs and its nirnroots the third draw; the nirnroots round the waist, clear of the body; every rate whole over the clock, every puff\'s life too; its colours the Sage\'s own (mutants: the kind, the radius, added not covered, a rate off whole, a colour drifted)', () => {
  for (const a of AURAS) assert.ok(Object.hasOwn(AURA_LOOK, a), `a look for ${a}`);
  assert.deepEqual({ ...AURA_LOOK.sagesmoke }, { kind: 14, ringR: SAGE_RUNE_R, flameH: SAGE_WALL_H, glyphs: SAGE_CARDS, shade: true }, 'the fifteenth kind, at its own radius and height, its cards the third draw, premultiplied');
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  assert.equal(auraLookOf('sagesmoke'), AURA_LOOK.sagesmoke);
  assert.equal(SAGE_CARDS, SAGE_PUFFS + SAGE_ROOTS);
  assert.ok(AURA_CARDS >= SAGE_CARDS, 'the third draw has a card for every puff and every nirnroot');
  assert.ok(SAGE_RUNE_R > RADIANCE_R - 0.05 && SAGE_RUNE_R + SAGE_BAND_M < AURA_RING_R, 'the runes round the feet, inside the fire\'s ring');
  assert.ok(SAGE_RUNE_R + SAGE_BAND_M < AURA_GROUND_R - 0.2, 'on the ground quad, short of its fading edge');
  assert.ok(SAGE_WALL_H <= 0.55, 'its wall gone by the knee');
  assert.ok(SAGE_ROOT_Y > 0.85 && SAGE_ROOT_Y < 1.15 && SAGE_ROOT_R > 0.45 && SAGE_ROOT_R < 0.7, `the nirnroots round the midsection (${SAGE_ROOT_Y} m up, ${SAGE_ROOT_R} m out)`);
  assert.ok(SAGE_ROOT_M / SAGE_ROOT_PAD > 0.2 && SAGE_ROOT_M / SAGE_ROOT_PAD < 0.3, 'a nirnroot a nirnroot\'s size');
  assert.ok(SAGE_SMOKE_H > 1.8 && SAGE_PUFF_M[1] > SAGE_PUFF_M[0], 'the smoke climbing past the crown, billowing out as it goes');
  assert.ok(sageRatesWhole(), 'every rate whole over the clock');
  for (const l of SAGE_PUFF_LIFE) assert.ok(Number.isInteger(AURA_CLOCK_PERIOD / l), `a puff's life (${l} s) whole over it`);
  assert.equal(SAGE_SCRIPT.length, SAGE_RUNES);
  assert.ok(SAGE_SCRIPT.every((b) => Number.isInteger(b) && b >= 0 && b < 64), 'each rune the ward\'s alphabet\'s');
  const rgb = (c) => [...c].slice(0, 3).map((x) => +x.toFixed(3));
  assert.deepEqual(Object.fromEntries(Object.entries(SAGE_RGB).map(([k, c]) => [k, rgb(c)])), { leaf: rgb(NIRN_LEAF), glow: rgb(NIRN_GLOW), haze: rgb(NIRN_HAZE), deep: rgb(NIRN_DEEP), smoke: rgb(NIRN_SMOKE) }, 'the Sage\'s own five');
  assert.ok(green(SAGE_RGB.glow), '"small glowing green runes"');
});

test('NIRNROOT-SAGE the smoke\'s law: each puff rises off the ground and climbs past the crown, faster at first; billows out as it climbs; drifts out from the body and curls round it; its age 0..1 over its life, and its next flight off another place round the feet; the clock\'s wrap the same smoke; a wearer\'s own clock (mutants: the rise, the growth, the drift, the flight never moving, the wrap)', () => {
  for (let m = 0; m < SAGE_PUFFS; m++) {
    const life = SAGE_PUFF_LIFE[m % SAGE_PUFF_LIFE.length];
    for (const t of [0.3, 13.3, 47.9, 119.7]) {
      const p = sagePuff(m, t), q = sagePuff(m, t + AURA_CLOCK_PERIOD);
      assert.deepEqual([p.x, p.y, p.z, p.size, p.age].map((x) => +x.toFixed(9)), [q.x, q.y, q.z, q.size, q.age].map((x) => +x.toFixed(9)), `puff ${m} at ${t}: the same a clock later`);
      assert.ok(p.age >= 0 && p.age < 1 && p.seed >= 0 && p.seed < 1);
      const r = Math.hypot(p.x, p.z);
      assert.ok(r >= SAGE_PUFF_R[0] - 1e-9 && r <= SAGE_PUFF_R[1] + SAGE_PUFF_DRIFT + 1e-9, `about the body (${r.toFixed(3)} m out)`);
      assert.ok(p.y >= 0.05 - 1e-9 && p.y <= 0.05 + SAGE_SMOKE_H + 1e-9 && p.size >= SAGE_PUFF_M[0] - 1e-9 && p.size <= SAGE_PUFF_M[1] + 1e-9);
    }
    // within one flight: rising, faster at first, growing, drifting out
    const t0 = 20 - sagePuff(m, 20).age * life + 0.001;   // the flight's start
    const at = (s) => sagePuff(m, t0 + s * life * 0.98);
    const [a, b, c] = [at(0), at(0.5), at(1)];
    assert.ok(a.age < 0.01 && c.age > 0.97, 'one flight');
    assert.ok(a.y < 0.07 && c.y > 0.05 + SAGE_SMOKE_H * 0.95, `off the ground and past the crown (${a.y.toFixed(3)} to ${c.y.toFixed(3)} m)`);
    assert.ok(b.y - a.y > c.y - b.y, 'faster at first, slowing as it spreads');
    assert.ok(a.size < b.size && b.size < c.size, 'billowing out as it climbs');
    assert.ok(Math.hypot(c.x, c.z) - Math.hypot(a.x, a.z) > SAGE_PUFF_DRIFT * 0.9, 'drifting out from the body');
    const turned = Math.abs(Math.atan2(Math.sin(Math.atan2(c.z, c.x) - Math.atan2(a.z, a.x)), Math.cos(Math.atan2(c.z, c.x) - Math.atan2(a.z, a.x))));
    assert.ok(turned > 0.5, `curling round the body (${turned.toFixed(2)} rad)`);
    const next = sagePuff(m, t0 + life + 0.001);
    assert.ok(next.age < 0.01 && Math.hypot(next.x - a.x, next.z - a.z) > 1e-3, 'the next flight off another place');
  }
  assert.equal(sageClock(10, 0.25), 10 + 0.25 * AURA_CLOCK_PERIOD, 'a wearer\'s own clock - the frame\'s, offset by its seed');
  assert.equal(sageClock(10, NaN), 10);
});

test('NIRNROOT-SAGE the nirnroots\' law: SAGE_ROOTS of them, evenly round the waist on their orbit, turning round it a whole number of times over the clock; bobbing about the waist; swaying about their stems, never edge on; tilting as they bob; coming up one after another as it kindles (mutants: the orbit\'s radius, the spacing, the bob, the emergence)', () => {
  for (const t of [0, 7.3, 61.25]) {
    const rs = Array.from({ length: SAGE_ROOTS }, (_, k) => sageRoot(k, t));
    for (const r of rs) {
      assert.ok(Math.abs(Math.hypot(r.x, r.z) - SAGE_ROOT_R) < 1e-9, 'on its orbit');
      assert.ok(Math.abs(r.y - SAGE_ROOT_Y) <= SAGE_ROOT_BOB + 1e-9, 'about the waist');
      assert.equal(r.size, SAGE_ROOT_M, 'kindled, whole');
      assert.ok(r.turn >= Math.cos(SAGE_ROOT_SWAY) - 1e-9 && r.turn <= 1 + 1e-9, `swaying, never edge on (${r.turn})`);
      assert.ok(Math.abs(r.tilt) <= SAGE_ROOT_TILT + 1e-9);
    }
    for (let k = 1; k < SAGE_ROOTS; k++) {
      const d = Math.atan2(rs[k].z, rs[k].x) - Math.atan2(rs[k - 1].z, rs[k - 1].x);
      assert.ok(Math.abs(Math.cos(d) - Math.cos(TAU / SAGE_ROOTS)) < 1e-9, 'evenly round');
    }
  }
  const a = sageRoot(0, 0), b = sageRoot(0, AURA_CLOCK_PERIOD);
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.turn - b.turn) < 1e-9, 'whole at the wrap');
  assert.ok(Number.isInteger(SAGE_HZ.orbit * AURA_CLOCK_PERIOD) && SAGE_HZ.orbit * AURA_CLOCK_PERIOD >= 6, 'round the waist a whole number of times over the clock');
  const q = sageRoot(0, 2.5);
  assert.ok(Math.abs(Math.atan2(q.z, q.x) - TAU * SAGE_HZ.orbit * 2.5) < 1e-9, 'turning round it at its rate');
  assert.ok(sageRoot(0, 1).y !== sageRoot(0, 2).y, 'bobbing');
  const sizes = (kindle) => Array.from({ length: SAGE_ROOTS }, (_, k) => sageRoot(k, 3, kindle).size);
  assert.deepEqual(sizes(0), Array(SAGE_ROOTS).fill(0), 'unkindled: none up');
  const mid = sizes(SAGE_EMERGE + SAGE_EMERGE_STEP);
  assert.ok(mid[0] === SAGE_ROOT_M && mid[1] === SAGE_ROOT_M && mid[2] > 0 && mid[2] < SAGE_ROOT_M && mid.at(-1) < mid[2], `one after another (${mid.map((x) => x.toFixed(3))})`);
});

test('NIRNROOT-SAGE every card at once: every puff and every nirnroot, FARTHEST FIRST from the eye, each where the law has it; a puff its age, its seed and its cover - the kindle\'s, and none near the eye, so the wearer\'s own first person is never smoked out; a nirnroot its turn and its tilt (mutants: the order nearest first, the near fade dropped, the kindle ignored, a card lost)', () => {
  const cards = new Float32Array(SAGE_CARDS * 4), looks = new Float32Array(SAGE_CARDS * 4);
  const at = [3, 1, -2], eye = [3, 2.6, 4], t = 13.3;
  assert.equal(sageCardsInto(cards, looks, t, 1, at, eye), cards, 'into the list it is handed');
  const dist = (i) => Math.hypot(at[0] + cards[i * 4] - eye[0], at[1] + cards[i * 4 + 1] - eye[1], at[2] + cards[i * 4 + 2] - eye[2]);
  for (let i = 1; i < SAGE_CARDS; i++) assert.ok(dist(i - 1) >= dist(i) - 1e-5, `farthest first (${i})`);
  const kinds = [...Array(SAGE_CARDS).keys()].map((i) => looks[i * 4]);
  assert.deepEqual([kinds.filter((k) => k === 0).length, kinds.filter((k) => k === 1).length], [SAGE_PUFFS, SAGE_ROOTS], 'every puff and every nirnroot');
  const f32 = (x) => Math.fround(x);
  for (let m = 0; m < SAGE_PUFFS; m++) {
    const p = sagePuff(m, t), i = [...Array(SAGE_CARDS).keys()].find((j) => looks[j * 4] === 0 && looks[j * 4 + 3] === f32(p.seed) && cards[j * 4 + 1] === f32(p.y));
    assert.ok(i !== undefined, `puff ${m} handed`);
    assert.deepEqual([cards[i * 4], cards[i * 4 + 2], cards[i * 4 + 3], looks[i * 4 + 1]], [f32(p.x), f32(p.z), f32(p.size), f32(p.age)], `puff ${m} where the law has it`);
    assert.equal(looks[i * 4 + 2], 1, 'far from the eye, its cover whole');
  }
  for (let k = 0; k < SAGE_ROOTS; k++) {
    const r = sageRoot(k, t), i = [...Array(SAGE_CARDS).keys()].find((j) => looks[j * 4] === 1 && cards[j * 4] === f32(r.x) && cards[j * 4 + 2] === f32(r.z));
    assert.ok(i !== undefined, `nirnroot ${k} handed`);
    assert.deepEqual([cards[i * 4 + 1], cards[i * 4 + 3], looks[i * 4 + 1], looks[i * 4 + 2]], [f32(r.y), f32(r.size), f32(r.turn), f32(r.tilt)]);
  }
  // the wearer's own eye, in the middle of the smoke: the puffs about the head gone, those at the feet still there
  let near = 0, feet = 0;
  for (const tt of [t, 47.9, 88.1]) {
    sageCardsInto(cards, looks, tt, 1, [0, 0, 0], [0, 1.7, 0]);
    for (let i = 0; i < SAGE_CARDS; i++) {
      if (looks[i * 4] !== 0) continue;
      const d = Math.hypot(cards[i * 4], cards[i * 4 + 1] - 1.7, cards[i * 4 + 2]);
      if (d < SAGE_NEAR[0]) { near++; assert.equal(looks[i * 4 + 2], 0, `a puff ${d.toFixed(2)} m from the eye: none of it`); }
      if (d > SAGE_NEAR[1]) assert.equal(looks[i * 4 + 2], 1, `a puff ${d.toFixed(2)} m from the eye: all of it`);
      if (d > SAGE_NEAR[0] && d < SAGE_NEAR[1]) assert.ok(looks[i * 4 + 2] > 0 && looks[i * 4 + 2] < 1, 'between, between');
      if (cards[i * 4 + 1] < 0.6) { feet++; assert.ok(looks[i * 4 + 2] > 0.5, `a puff at the feet (${cards[i * 4 + 1].toFixed(2)} m up) more than half there`); }
    }
  }
  assert.ok(near > 0 && feet > 0, `the smoke about the head gone and at the feet kept (${near} near, ${feet} at the feet)`);
  sageCardsInto(cards, looks, t, 0.5, at, eye);
  for (let i = 0; i < SAGE_CARDS; i++) if (looks[i * 4] === 0) assert.equal(looks[i * 4 + 2], 0.5, 'half kindled, half the cover');
  sageCardsInto(cards, looks, t, 0, at, eye);
  for (let i = 0; i < SAGE_CARDS; i++) assert.equal(looks[i * 4] === 0 ? looks[i * 4 + 2] : cards[i * 4 + 3], 0, 'unkindled: no smoke, no nirnroot');
});

// ── THE SHADER, RUN ─────────────────────────────────────────────────

/** Sage's Smoke's colour at a point - the shader's own main(), run, with `uAura` its own. `px` the metres a pixel spans
 *  there. Premultiplied: rgb, cover. */
const sageAt = (kind, vP, { t = 13.3, kindle = 1, vS = [0, 0, 0], world = [0, 0, 0], fog = null, eye = [0, 1.2, 5], px = 0.001 } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vS, vWorld: world, uKind: kind, uAura: 14, uTime: t, uSeed: 0, uKindle: kindle, uRingR: SAGE_RUNE_R, uGroundR: AURA_GROUND_R,
    uFlameH: SAGE_WALL_H, uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uFogRange: [0, 1], uCamPos: eye, uAt: [0, 0, 0], uFocus: [0, 0, 0, 0],
    dFdx: () => [px, 0, 0], dFdy: () => [0, px, 0],
  });
  f.main();
  return f.globals.o;
};
const near3 = (c, want, tol = 1e-3) => [0, 1, 2].every((i) => Math.abs(c[i] - want[i]) < tol);
/** A point in the nirnroot's box (x right, y down) as its card's uv - the box in the card's middle, SAGE_ROOT_PAD of room. */
const uvOf = ([x, y]) => [(x - 8) / (16 * SAGE_ROOT_PAD) + 0.5, 0.5 - (y - 8) / (16 * SAGE_ROOT_PAD)];
const lum = (c) => c[0] + c[1] + c[2];

test('NIRNROOT-SAGE a nirnroot, the shader RUN: inside the badge\'s own outline it covers whole - leaf green at its foot, its glow at the bulb; its veins the deep green; the bulb\'s heart the haze; about it its glow, added, gone before the card\'s edge; nothing far from it (mutants: the veins, the heart, the cover, the halo covering)', () => {
  const root = (g, opts = {}) => sageAt(2, uvOf(g), { vS: [1, 0, 0], px: 0.0004, ...opts });
  const stem = root([8.2, 13.5]), bulb = root([8.3, 0.9]);
  assert.ok(Math.abs(stem[3] - 1) < 1e-9 && Math.abs(bulb[3] - 1) < 1e-9, 'covering whole');
  assert.ok(green(stem) && green(bulb), 'green');
  assert.ok(bulb[1] > stem[1] + 0.15 && near3(bulb, SAGE_RGB.glow, 0.02), `its glow at the bulb (${bulb.map((x) => x.toFixed(3))}), the leaf\'s green lower (${stem.map((x) => x.toFixed(3))})`);
  assert.ok(near3(root([8.3, 2.8]), SAGE_RGB.haze), 'the bulb\'s heart, the haze');
  assert.ok(near3(root([5.025, 8.78]), SAGE_RGB.deep, 0.02), 'a vein, the deep green');
  const leaf = root([5.0, 9.45]);
  assert.ok(leaf[3] === 1 && !near3(leaf, SAGE_RGB.deep, 0.05), 'beside the vein, the leaf');
  const glow = root([4, 4]);
  assert.ok(glow[3] === 0 && glow[1] > 0.005 && green(glow), `beside it, its glow - added, no cover (${glow.map((x) => x.toFixed(4))})`);
  const far = sageAt(2, [0.01, 0.99], { vS: [1, 0, 0] });
  assert.ok(far[3] === 0 && lum(far) < 1e-3, 'at the card\'s corner, nothing');
  assert.ok(near3(root([8.2, 13.5], { world: [0, 0, 400], fog: { density: 0.01 } }), [0, 0, 0], 0.1), 'the fog thins it');
});

test('NIRNROOT-SAGE a puff, the shader RUN: a round billow of the smoke, covering - thickest in its middle, nothing past its round; lit from above, the haze on its crown over the smoke\'s grey; young, the runes\' green on its belly; thinning to nothing as it ages; its cover the law\'s (mutants: the puff added not covered, the cover ignored, lit from below)', () => {
  const puff = (uv, age = 0.4, cover = 1, seed = 0.3) => sageAt(2, uv, { vS: [seed * 0.5, age, cover] });
  const mid = puff([0.5, 0.5]);
  assert.ok(mid[3] > 0.15 && mid[3] <= SAGE_PUFF_A + 1e-9, `covering in its middle (${mid[3].toFixed(3)})`);
  for (const uv of [[0, 0.5], [0.5, 1], [0.95, 0.95], [0.1, 0.1]]) assert.deepEqual(puff(uv), [0, 0, 0, 0], `nothing past its round (${uv})`);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; assert.ok(puff([0.5 + Math.cos(a) * 0.49, 0.5 + Math.sin(a) * 0.49])[3] < 0.01, 'and next to nothing at it - no cut edge'); }
  let crown = 0, belly = 0, n = 0;
  for (let i = 0; i < 9; i++) {
    const x = 0.38 + i * 0.03;
    const c = puff([x, 0.72]), b = puff([x, 0.28]);
    if (c[3] > 0.02 && b[3] > 0.02) { crown += c[0] / c[3]; belly += b[0] / b[3]; n++; }
  }
  assert.ok(n > 3 && crown > belly, `lit from above - lighter on its crown than its belly (${(crown / n).toFixed(3)}, ${(belly / n).toFixed(3)})`);
  const young = puff([0.5, 0.35], 0.15), grey = puff([0.5, 0.35], 0.85);
  assert.ok(young[1] / young[3] - young[0] / young[3] > grey[1] / grey[3] - grey[0] / grey[3] + 0.03, 'young, greener on its belly - the runes\' light');
  assert.ok(puff([0.5, 0.5], 0.999)[3] < 0.01 && puff([0.5, 0.5], 0.001)[3] < 0.01, 'thinning to nothing at either end of its life');
  assert.deepEqual(puff([0.5, 0.5], 0.4, 0), [0, 0, 0, 0], 'no cover, nothing - near the eye, or unkindled');
  const half = puff([0.5, 0.5], 0.4, 0.5);
  assert.ok(Math.abs(half[3] - mid[3] / 2) < 1e-9, 'its cover the law\'s');
});

test('NIRNROOT-SAGE the ground, the shader RUN: small green runes round the feet on the ring, glowing - added, no cover; a fine line of the glow out from them and one in; the shade the smoke lays at the feet, covering, rolling; dark between the runes and the shade\'s edge; the middle, where the angle is no number, no NaN; the quad\'s corners round; unkindled no runes and no shade (mutants: the runes dropped, the band dropped, the shade added not covered, the kindle ignored)', () => {
  const R = SAGE_RUNE_R;
  let runes = 0;
  const ring = Array.from({ length: 360 }, (_, i) => { const a = (i / 360) * TAU; return sageAt(0, [Math.cos(a) * R, Math.sin(a) * R]); });
  for (const c of ring) if (c[1] > 0.4 && green(c)) runes++;
  assert.ok(runes > 30, `the runes on the ring, glowing green (${runes} of 360 bearings bright)`);
  assert.ok(ring.every((c) => c[3] < 0.25) && ring.filter((c) => c[1] > c[3] + 0.3).length >= runes, 'the runes added - brighter than any cover could make them, over no more than the smoke\'s thin shade');
  const band = sageAt(0, [R + SAGE_BAND_M, 0.001]), beside = sageAt(0, [R + SAGE_BAND_M + 0.03, 0.001]);
  assert.ok(band[1] > beside[1] + 0.2 && green(band), `a fine line of the glow out from them (${band[1].toFixed(3)} against ${beside[1].toFixed(3)})`);
  const inner = sageAt(0, [R - SAGE_BAND_M, 0.001]);
  assert.ok(inner[1] > sageAt(0, [R - SAGE_BAND_M - 0.03, 0.001])[1] + 0.2, 'and one in from them');
  const feet = sageAt(0, [0.12, 0.1]);
  assert.ok(feet[3] > 0.1 && feet[3] < 0.6 && feet[1] < 0.2, `at the feet the smoke's shade, covering (${feet.map((x) => x.toFixed(3))})`);
  const shades = Array.from({ length: 12 }, (_, i) => sageAt(0, [0.1 + i * 0.01, 0.15 - i * 0.008])[3]);
  assert.ok(Math.max(...shades) - Math.min(...shades) > 0.01, 'rolling - never one flat shade');
  assert.ok(sageAt(0, [1.25, 0.1])[3] < 0.01, 'thinned out past the runes');
  for (const p of [[0, 0], [1e-9, 0], [0.02, 0.01]]) {
    const c = sageAt(0, p);
    assert.ok(c.every((x) => Number.isFinite(x)), `the middle: no NaN (${c})`);
  }
  assert.throws(() => sageAt(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8]), GlslDiscard, 'the quad\'s corners are round');
  const cold = Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * TAU; return sageAt(0, [Math.cos(a) * R, Math.sin(a) * R], { kindle: 0 }); });
  assert.ok(cold.every((c) => lum(c) < 1e-6 && c[3] === 0), 'unkindled: nothing on the ring');
  assert.deepEqual(sageAt(0, [0.12, 0.1], { kindle: 0 }), [0, 0, 0, 0], 'and no shade');
  assert.ok(SAGE_RUNE_SCALE < 1, 'smaller runes than the Oblivion Ward\'s');
});

test('NIRNROOT-SAGE the wall, the shader RUN: low smoke rolling round the feet, covering - thickest where the eye looks along the strip, thin across the boots; the runes\' light rising off the ring, added; gone by the knee; half kindled nothing above the line; the vertex half stands the strip on the runes\' ring to the knee (mutants: the smoke added not covered, the rim dropped, the kindle ignored)', () => {
  let covered = 0;
  for (let i = 0; i < 200; i++) {
    const c = sageAt(1, [(i * 0.6180339) % 1, ((i * 0.381966) % 1) * 0.3], { world: [0, 0.1, 0] });
    if (c[3] > 0.02) covered++;
    assert.ok(c[3] <= 0.39, 'never a wall of smoke');
  }
  assert.ok(covered > 20, `smoke on it, covering (${covered} of 200)`);
  // from an eye out along +z: the strip's sides (u 0 and 0.5, facing x) are looked along, its front (u 0.25) across
  const eye = [0, 0.3, 5], side = (u) => [Math.cos(u * TAU) * SAGE_RUNE_R, 0.05, Math.sin(u * TAU) * SAGE_RUNE_R];
  let along = 0, across = 0;
  for (let i = 0; i < 30; i++) {
    const v = 0.02 + (i % 10) * 0.02, du = (i - 15) * 0.0007;
    along += sageAt(1, [0 + du + 1, v], { eye, world: side(0) })[3];
    across += sageAt(1, [0.25 + du, v], { eye, world: side(0.25) })[3];
  }
  assert.ok(along > across * 1.5, `thickest along the strip, thin across the boots (${along.toFixed(3)} against ${across.toFixed(3)})`);
  const foot = sageAt(1, [0.37, 0.01]), knee = sageAt(1, [0.37, 0.99]);
  assert.ok(foot[1] > 0.1 && green(foot), 'the runes\' light at the foot');
  assert.ok(knee[3] < 0.01 && lum(knee) < 0.01, 'gone by the knee');
  const half = sageAt(1, [0.37, 0.01], { kindle: 0.5 }), over = sageAt(1, [0.37, 0.8], { kindle: 0.5 });
  assert.ok(half[1] > 0.05 && over.every((x) => x === 0), 'half kindled: lit at the foot, nothing above the line');
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const vs = (aP) => { const f = glslFunctions(AURA_VS, { aP, uVP: I, uKind: 1, uAura: 14, uAt: [10, 2, -4], uGroundR: AURA_GROUND_R, uRingR: SAGE_RUNE_R, uFlameH: SAGE_WALL_H, uLift: AURA_LIFT_M }); f.main(); return f.globals.vWorld; };
  const nearP = (p, q) => p.every((x, i) => Math.abs(x - q[i]) < 1e-9);
  assert.ok(nearP(vs([0.25, 0]), [10, 2 + AURA_LIFT_M, -4 + SAGE_RUNE_R]), 'the wall\'s foot on the runes\' ring');
  assert.ok(nearP(vs([0.25, 1]), [10, 2 + AURA_LIFT_M + SAGE_WALL_H, -4 + SAGE_RUNE_R]), 'its top at the knee');
});

test('NIRNROOT-SAGE a card, the vertex half RUN: a puff about its place, square to the eye whole, its size the law\'s, turned in its own plane as it billows; a nirnroot about its place, upright and square to the eye about the vertical, its width its turn, tilted; a card the law gives no size draws nothing (mutants: the puff not facing the eye, the nirnroot leaning, the turn ignored)', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const at = [10, 2, -4];
  const run = (aP, card, look, eye, k = 3) => {
    const uSage = Array(SAGE_CARDS).fill([0, 0, 0, 0]), uSageLook = Array(SAGE_CARDS).fill([0, 0, 0, 0]);
    uSage[k] = card; uSageLook[k] = look;
    const f = glslFunctions(AURA_VS, { aP: [k * 2 + aP[0], aP[1]], uVP: I, uKind: 2, uAura: 14, uAt: at, uGroundR: AURA_GROUND_R, uRingR: SAGE_RUNE_R, uFlameH: SAGE_WALL_H, uLift: AURA_LIFT_M, uCamPos: eye, uSage, uSageLook });
    f.main();
    return f.globals;
  };
  const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  // a puff
  const pc = [0.3, 1.4, 0.2], pe = [14, 5, 3];
  const centre = [at[0] + pc[0], at[1] + pc[1], at[2] + pc[2]];
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map((uv) => run(uv, [...pc, 0.6], [0, 0.4, 1, 0.3], pe).vWorld);
  const mid = corners.reduce((s, c) => s.map((x, i) => x + c[i] / 4), [0, 0, 0]);
  assert.ok(mid.every((x, i) => Math.abs(x - centre[i]) < 1e-9), 'a puff about its place');
  const toEye = sub(pe, centre);
  for (const [a, b] of [[0, 1], [1, 2]]) assert.ok(Math.abs(dot(sub(corners[b], corners[a]), toEye)) < 1e-9, 'square to the eye whole');
  assert.ok(Math.abs(Math.hypot(...sub(corners[1], corners[0])) - 0.6) < 1e-9, 'its size the law\'s');
  const vS = run([0.5, 0.5], [...pc, 0.6], [0, 0.4, 0.7, 0.3], pe).vS;
  assert.ok(Math.abs(vS[0] - 0.15) < 1e-9 && vS[1] === 0.4 && vS[2] === 0.7, 'its seed\'s half, its age and its cover handed on');
  const turnedA = run([1, 0], [...pc, 0.6], [0, 0.0, 1, 0.3], pe).vWorld, turnedB = run([1, 0], [...pc, 0.6], [0, 0.5, 1, 0.3], pe).vWorld;
  assert.ok(Math.hypot(...sub(turnedA, turnedB)) > 0.05, 'turned in its own plane as it billows');
  // a nirnroot
  const rc = [SAGE_ROOT_R, SAGE_ROOT_Y, 0], re = [10, 2.9, 1];
  const rr = [0, 1].map((u) => run([u, 0.5], [...rc, SAGE_ROOT_M], [1, 1, 0, 0], re).vWorld);
  const up = [0, 1].map((y) => run([0.5, y], [...rc, SAGE_ROOT_M], [1, 1, 0, 0], re).vWorld);
  assert.ok(Math.abs(up[1][1] - up[0][1] - SAGE_ROOT_M) < 1e-9 && Math.abs(up[1][0] - up[0][0]) < 1e-9 && Math.abs(up[1][2] - up[0][2]) < 1e-9, 'upright, a card tall');
  const span = sub(rr[1], rr[0]), rEye = sub(re, [at[0] + rc[0], 0, at[2] + rc[2]]);
  assert.ok(Math.abs(span[1]) < 1e-9 && Math.abs(span[0] * rEye[0] + span[2] * rEye[2]) < 1e-9 && Math.abs(Math.hypot(...span) - SAGE_ROOT_M) < 1e-9, 'square to the eye about the vertical, a card wide');
  const swayed = [0, 1].map((u) => run([u, 0.5], [...rc, SAGE_ROOT_M], [1, 0.8, 0, 0], re).vWorld);
  assert.ok(Math.abs(Math.hypot(...sub(swayed[1], swayed[0])) - SAGE_ROOT_M * 0.8) < 1e-9, 'its width its turn');
  const tilted = [0, 1].map((y) => run([0.5, y], [...rc, SAGE_ROOT_M], [1, 1, 0.15, 0], re).vWorld);
  assert.ok(Math.abs(Math.acos((tilted[1][1] - tilted[0][1]) / SAGE_ROOT_M) - 0.15) < 1e-6, 'tilted');
  assert.deepEqual(run([0.5, 0.5], [...rc, SAGE_ROOT_M], [1, 1, 0, 0], re).vS, [1, 0, 0], 'a nirnroot said so');
  const none = [[0, 0], [1, 1]].map((uv) => run(uv, [...rc, 0], [1, 1, 0, 0], re).vWorld);
  assert.ok(Math.hypot(...sub(none[1], none[0])) < 1e-12, 'no size, no card');
});

test('NIRNROOT-SAGE the smoke\'s draw: drawn premultiplied and the blend handed back; node\'s cards - farthest first - handed over on the wearer\'s own clock and kindle, for Sage\'s Smoke alone; its ground, its strip and a card for every puff and nirnroot; its own program (mutants: the cards not handed, the seed ignored, added not covered)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13 }, {
    get(tg, k) {
      if (k in tg) return tg[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const r = new AuraRingRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  const eye = [4, 1.6, 2];
  r.draw([{ at: [1, 0, 1], aura: 'sagesmoke', seed: 0.3, kindle: 0.7 }, { at: [5, 0, 5], aura: 'radiance' }], I, I, eye, 10);
  assert.equal(r.drawn, 2);
  assert.deepEqual(calls.filter((c) => c[0] === 'useProgram').map((c) => r.kindOf(c[1])), [2, 14], 'farthest first: the radiance, then the smoke');
  const per = (name, kind) => calls.filter((c) => c[0] === kind && c[1] === name).map((c) => c[2]);
  assert.deepEqual(per('uRingR', 'uniform1f'), [RADIANCE_R, SAGE_RUNE_R], 'each at its own radius');
  const handed = calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uSage'), looks = calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uSageLook');
  assert.equal(handed.length, 1, 'the cards handed for the smoke alone');
  assert.equal(looks.length, 1);
  const wantC = new Float32Array(SAGE_CARDS * 4), wantL = new Float32Array(SAGE_CARDS * 4);
  sageCardsInto(wantC, wantL, sageClock(10, 0.3), 0.7, [1, 0, 1], eye);
  assert.deepEqual([...handed[0][2]], [...wantC], 'node\'s cards on the wearer\'s own clock and kindle, farthest first from the eye');
  assert.deepEqual([...looks[0][2]], [...wantL]);
  const blends = calls.filter((c) => c[0] === 'blendFunc' || c[0] === 'useProgram').map((c) => (c[0] === 'blendFunc' ? c.slice(1).join('/') : `aura${r.kindOf(c[1])}`));
  assert.deepEqual(blends.slice(0, 5), ['10/10', 'aura2', 'aura14', '10/13', '10/10'], 'added for the radiance; the smoke premultiplied (ONE, ONE_MINUS_SRC_ALPHA) and the blend handed back');
  const draws = calls.filter((c) => c[0] === 'drawArrays').map((c) => c[3]);
  assert.deepEqual(draws, [6, AURA_STEPS * 6, 6, AURA_STEPS * 6, SAGE_CARDS * 6], 'the smoke\'s ground, its strip and a card for every puff and nirnroot');
});
