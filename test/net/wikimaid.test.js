// WIKIMAID — SYLVIABUN'S OWN: THE WIKIMAID, ITS GLYPH, AND THE LILAC WARREN (2026-10-17).
//
// For SylviaBun: "Honestly as dumb as this is gonna sound the WikiMaid title and a purple aura with bunnies would be dope
// as hell" - and "Lets go all out for this". The handle list grants all three together (TIER_LISTS, TIER_GLYPH and
// TIER_AURA, CRYSTAL-FIST's law); the title is drawn amethyst into lilac into a rabbit's blush, the glyph is a rabbit's
// head in a maid's headdress, and the aura is the aura pass's twelfth look (render/auraRing.js AURA_LOOK) - rabbits
// hopping round the feet on a ring of lilac light, their tracks behind them - its law node's (warrenBunny), its shader
// RUN here against it.
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
  glyphDetails, titlePaint, badgeCss, WARREN_AMETHYST, WARREN_LILAC, WARREN_BLUSH, WARREN_FRILL, WARREN_PLUM,
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
  RADIANCE_R, RADIANCE_H, glyphEdges,
  WARREN_R, WARREN_RING_M, WARREN_RING_IN, WARREN_H, WARREN_BUNNIES, WARREN_BUNNY_M, WARREN_BUNNY, WARREN_FOOT, WARREN_LEAN, WARREN_GAIT_S,
  WARREN_HOPS, WARREN_HOP_S, WARREN_CROUCH, WARREN_HOP_H, WARREN_LAPS, WARREN_BINKY_EVERY, WARREN_BINKY_H, WARREN_BINKY_S,
  WARREN_BINKY_AT, WARREN_BINKY_TURN, WARREN_OFFSET_S, WARREN_HOP_RAD, WARREN_EMERGE, WARREN_EMERGE_STEP, WARREN_PRINTS,
  WARREN_PRINT_S, WARREN_SPARKLES, WARREN_TWINKLES, WARREN_RGB, warrenRatesWhole, warrenStride, warrenBunny, warrenClock,
  warrenBunniesInto, warrenDepthOrder, warrenPrintsInto, resonanceClock, AuraRingRenderer,
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
/** A purple: red and blue both over green, the blue at least the red's - a hue from a violet to an orchid. */
const purple = (c) => c[1] < c[0] && c[1] < c[2] && hueOf(c) > 255 && hueOf(c) < 300;
const apart = (a, b) => Math.hypot(...[0, 1, 2].map((i) => (a[i] - b[i]) * 255));

// ── the fake document (crystalfist.test.js's shape) ──
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

test('WIKIMAID vocabulary: the title and the glyph join the closed lists last, the aura joins AURAS last; "WikiMaid" and "Lilac Warren" in words, the glyph named on the account card; the title a gradient - the amethyst into the lilac into a rabbit\'s blush, #9d5cff, #c390ff, #ffb8de - edged in black, its one colour the lilac, apart from every purple; the glyph in the lilac, filled; `V` on the classic face; the warren\'s button in the WikiMaid\'s paint; the wire keeps all three (mutants: the gradient\'s stops, its order, the edge, the one colour, the glyph\'s colour, the mark, the fill, the button\'s paint, the words)', () => {
  assert.equal(TITLES.at(-9) /* PIN MOVED (WITCH1): Witchwarden and Hearthkeeper joined the list last */ /* PIN MOVED (STAR8): the Starwarden joined the list after the questlines' five, before the festival's two */, 'wikimaid', 'the vocabulary\'s newest when it came');   // PIN MOVED (QL12): the questlines' five joined the list last, after the WikiMaid
  assert.equal(GLYPHS.at(-1), 'wikimaid');
  assert.equal(AURAS.at(-2) /* PIN MOVED (WITCH1): Witchfire joined the list last */, 'lilacwarren');
  assert.equal(TITLE_TEXT.wikimaid, 'WikiMaid', 'spelled as SylviaBun spelled it: "the WikiMaid title"');
  assert.equal(AURA_TEXT.lilacwarren, 'Lilac Warren');
  assert.equal(GLYPH_LABEL.wikimaid, 'WikiMaid', 'named on the account card');
  assert.deepEqual(TITLE_GRADIENT.wikimaid.map(cssRgba), ['#9d5cff', '#c390ff', '#ffb8de'], 'the amethyst, the lilac, the blush - in that order, left to right');
  assert.deepEqual(TITLE_GRADIENT.wikimaid, [WARREN_AMETHYST, WARREN_LILAC, WARREN_BLUSH], 'the family named once (ui/playerBadge.js WARREN_*)');
  assert.ok(purple(WARREN_AMETHYST) && purple(WARREN_LILAC), `"Wiki" in purples (${hueOf(WARREN_AMETHYST).toFixed(0)}, ${hueOf(WARREN_LILAC).toFixed(0)} degrees)`);
  assert.ok(hueOf(WARREN_BLUSH) > 300 && WARREN_BLUSH[0] === 1, `"Maid" into a rabbit's blush, a pink (${hueOf(WARREN_BLUSH).toFixed(0)} degrees)`);
  assert.deepEqual(TITLE_EDGE.wikimaid, [0, 0, 0, 1], 'its blush end is pale: edged in black, as every gradient title with a light end');
  assert.equal(TITLE_RGBA.wikimaid, WARREN_LILAC, 'its one colour the lilac - the gradient\'s middle');
  assert.equal(new Set(TITLES.map((t) => cssRgba(TITLE_RGBA[t]))).size, TITLES.length, 'no two titles share a colour');
  for (const t of TITLES.filter((x) => x !== 'wikimaid')) assert.ok(apart(TITLE_RGBA.wikimaid, TITLE_RGBA[t]) > 40, `apart from the ${t}'s (${cssRgba(TITLE_RGBA[t])}, ${apart(TITLE_RGBA.wikimaid, TITLE_RGBA[t]).toFixed(0)} apart)`);
  assert.equal(GLYPH_RGBA.wikimaid, TITLE_RGBA.wikimaid, 'the rabbit in the title\'s lilac; the two halves of one grant cannot drift');
  assert.equal(GLYPH_GRADIENT.wikimaid, undefined, 'one colour, its details over it');
  assert.equal(GLYPH_STROKE.wikimaid, false, 'filled');
  assert.equal(GLYPH_MARK.wikimaid, 'V', 'the rabbit\'s two ears, up');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, marks.length, 'a classic mark of its own');
  assert.ok(GLYPH_MARK.wikimaid.charCodeAt(0) >= FONT_GLYPH_MIN && GLYPH_MARK.wikimaid.charCodeAt(0) <= FONT_GLYPH_MAX, 'inside the font');
  for (const a of AURAS) assert.ok(AURA_TEXT[a] && TITLES.includes(AURA_PAINT[a]), `every aura has a word and a title's paint for its button: ${a}`);
  assert.equal(AURA_PAINT.lilacwarren, 'wikimaid', 'the warren in the WikiMaid\'s own paint');
  const badge = titleBadge({ title: 'wikimaid' });
  assert.deepEqual({ text: badge.text, rgba: badge.rgba, gradient: badge.gradient, edge: badge.edge }, { text: 'WikiMaid', rgba: WARREN_LILAC, gradient: TITLE_GRADIENT.wikimaid, edge: TITLE_EDGE.wikimaid });
  assert.deepEqual(readBadge({ title: 'wikimaid', glyphs: ['wikimaid'] }), { title: 'wikimaid', glyphs: ['wikimaid'] }, 'the wire keeps it');
  assert.equal(readAura({ au: 'lilacwarren' }), 'lilacwarren', 'and the aura');
  assert.deepEqual(badged({ id: 'p1' }, { title: 'wikimaid', au: 'lilacwarren' }), { id: 'p1', title: 'wikimaid', au: 'lilacwarren' });
  assert.deepEqual(glyphBadges({ glyphs: ['wikimaid', 'sprout'] }).map((b) => b.key), ['sprout', 'wikimaid'], 'drawn in the vocabulary\'s order');
});

/** A path's figures (absolute M, L, Q and Z) as their corners and control points, in order. */
const figuresOf = (d) => d.split(/(?=M)/).map((sub) => [...sub.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]));
/** A closed outline's signed area (the shoelace over its corners and control points - its sign is its winding). */
const areaOf = (pts) => pts.reduce((s, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + (x * y2 - x2 * y); }, 0) / 2;

test('WIKIMAID the glyph\'s shape: a rabbit\'s head, front on - one outline, inside the box, its own mirror about the middle; two ears up past the head\'s top, their tips near the box\'s; the head widest at its cheeks, below the middle; its details a list of three, in order - the ears\' insides in the blush, inside the ears; the maid\'s lace, five scallops of the white, across the crown; its band, two eyes either side of the middle and a nose on it, in the plum - each a figure the shader\'s edges could cut (mutants: an ear lowered, the outline lopsided, the lace dropped, the lace in the lilac, the details out of order, a single detail where three are)', () => {
  const [outline, ...more] = figuresOf(GLYPH_PATH.wikimaid);
  assert.equal(more.length, 0, 'one outline');
  for (const [x, y] of outline) assert.ok(x >= 0 && x <= 16 && y >= 0 && y <= 16, `inside the box: ${x},${y}`);
  const key = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  const points = (ps) => [...new Set(ps)].sort();   // the figure's first point is its last as well
  assert.deepEqual(points(outline.map((p) => key([16 - p[0], p[1]]))), points(outline.map(key)), 'its own mirror about x = 8: the right ear the left\'s, the right cheek the left\'s');
  const tips = outline.filter(([, y]) => y < 1);
  assert.ok(tips.some(([x]) => x < 8) && tips.some(([x]) => x > 8), `an ear up each side, its tip near the box's top (${tips.map(key)})`);
  const crown = outline.filter(([x]) => x === 8).map(([, y]) => y).sort((a, b) => a - b);
  assert.ok(crown[0] > 5.5 && crown[0] < 7, `the crown between the ears, under their tips by more than a third of the box (${crown[0]})`);
  const widest = outline.reduce((w, p) => (p[0] < w[0] ? p : w));
  assert.ok(widest[1] > 8 && widest[0] < 3, `the head widest at its cheeks, below the middle (${key(widest)})`);
  assert.equal(GLYPH_PATH.wikimaid.split('Z').length - 1, 1, 'closed');
  assert.doesNotThrow(() => glyphEdges(GLYPH_PATH.wikimaid), 'in M, L, Q and Z alone - the shader\'s edges can cut it');
  const dets = GLYPH_DETAIL.wikimaid;
  assert.ok(Array.isArray(dets) && dets.length === 3, 'three details, a list');
  assert.deepEqual(glyphDetails(dets), dets, 'walked as they are');
  assert.deepEqual(dets.map((d) => cssRgba(d.rgba)), [cssRgba(WARREN_BLUSH), cssRgba(WARREN_FRILL), cssRgba(WARREN_PLUM)], 'the ears\' blush, the lace\'s white, the band\'s and the face\'s plum - in that order, the lace over the ears\' roots and the band over the lace\'s foot');
  const [ears, lace, face] = dets.map((d) => figuresOf(d.path));
  assert.equal(ears.length, 2, 'an inside to each ear');
  for (const e of ears) for (const [x, y] of e) assert.ok(y < 6.5 && (x < 7 || x > 9), `inside an ear, above the crown (${x},${y})`);
  assert.equal(lace.length, 1, 'the lace one piece');
  assert.equal(GLYPH_DETAIL.wikimaid[1].path.match(/Q/g).length - 1, 5, 'five scallops along its top, over its curved foot');
  const lx = lace[0].map(([x]) => x);
  assert.ok(Math.min(...lx) > 3.6 && Math.max(...lx) < 12.4, 'narrower than the head - across the crown, never the froth of a mug the head\'s whole width');
  assert.equal(face.length, 4, 'the band, two eyes and a nose');
  const mid = (pts) => pts.reduce((s, [x, y]) => [s[0] + x / pts.length, s[1] + y / pts.length], [0, 0]);
  const [, eyeL, eyeR, nose] = face.map(mid);
  assert.ok(Math.abs(eyeL[0] + eyeR[0] - 16) < 1e-6 && eyeL[1] === eyeR[1] && eyeL[0] < 8, 'two eyes either side of the middle');
  assert.ok(Math.abs(nose[0] - 8) < 1e-6 && nose[1] > eyeL[1], 'and a nose on the middle, under them');
  for (const d of dets) assert.doesNotThrow(() => glyphEdges(d.path));
  assert.ok(Math.abs(areaOf(outline)) > 60, 'a head, not a sliver');
  assert.deepEqual(glyphDetails(GLYPH_DETAIL.shadowfang), [GLYPH_DETAIL.shadowfang], 'one detail is a list of one');
  assert.deepEqual(glyphDetails(undefined), [], 'none, none');
});

// ── THE GRANT ───────────────────────────────────────────────────────

test('WIKIMAID grant: WIKIMAID_HANDLES names SylviaBun, and the list grants the title, its glyph AND the Lilac Warren together, case-folded; worn while held, read off the config alone; off the list all three go, a guest holds none, every other list\'s holder and a near name hold none; no staff command rides it (mutants: the handle, the list\'s key, the glyph\'s word, the aura\'s grant)', () => {
  assert.equal(v('WIKIMAID_HANDLES'), 'SylviaBun', 'for the in-game account SylviaBun');
  assert.equal(TIER_LISTS.wikimaid, 'WIKIMAID_HANDLES');
  assert.equal(TIER_GLYPH.wikimaid, 'wikimaid');
  assert.equal(TIER_AURA.wikimaid, 'lilacwarren');
  for (const h of ['SylviaBun', 'sylviabun', 'SYLVIABUN']) {
    const p = row(h);
    assert.deepEqual(titlesHeld(p, ENV), ['wikimaid'], `${h}: the WikiMaid, by name, case-folded`);
    assert.deepEqual(glyphsOf(p, ENV, LATER), ['wikimaid'], 'and its glyph');
    assert.deepEqual(aurasHeld(p, ENV), ['lilacwarren'], 'and the warren');
    assert.equal(equipRefusal('wikimaid', p, ENV), null);
    assert.equal(auraRefusal('lilacwarren', p, ENV), null, 'hers to wear');
  }
  const sb = row('SylviaBun', { title: 'wikimaid', aura: 'lilacwarren' });
  assert.equal(titleWorn(sb, ENV), 'wikimaid');
  assert.equal(auraWorn(sb, ENV), 'lilacwarren');
  assert.equal(auraWorn(sb), undefined, 'without the config, the Broker\'s alone - the warren is a list\'s');
  const w = wardrobeOf(sb, ENV, LATER);
  assert.deepEqual([w.titles, w.title, w.glyphs, w.auras, w.aura], [['wikimaid'], 'wikimaid', ['wikimaid'], ['lilacwarren'], 'lilacwarren'], 'the account card\'s whole answer');
  const off = { ...ENV, WIKIMAID_HANDLES: '' };
  assert.deepEqual([titlesHeld(sb, off), glyphsOf(sb, off, LATER), aurasHeld(sb, off)], [[], [], []], 'off the list, all three go');
  assert.equal(titleWorn(sb, off), undefined, 'and the title is not worn by a row nobody cleared');
  assert.equal(auraWorn(sb, off), undefined);
  assert.equal(auraRefusal('lilacwarren', sb, off), 'not-held');
  assert.deepEqual(titlesHeld({ ...sb, handle: null }, ENV), [], 'a guest holds none');
  assert.deepEqual(aurasHeld({ ...sb, handle: null }, ENV), []);
  for (const h of ['Flylighter', 'Sureme', 'GA00250', 'SirMcMobdon', 'Diggleborf', 'SylviaB', 'SylviaBunny', 'Sylvia Bun']) {
    assert.ok(!titlesHeld(row(h), ENV).includes('wikimaid'), `${h} does not hold it`);
    assert.ok(!aurasHeld(row(h), ENV).includes('lilacwarren'), `nor the warren: ${h}`);
    assert.equal(auraRefusal('lilacwarren', row(h), ENV), 'not-held');
  }
  assert.equal(isStaff(['wikimaid']), false, 'a title, a glyph and an aura - not the staff\'s commands');
});

test('WIKIMAID the service end to end: SylviaBun registers, holds the title, the glyph and the warren; wears the title and the warren through their doors; the token signs all three; a stranger is refused the warren; off the list, the next token carries none', async () => {
  const { env, call, registered, identityPublic } = await standService({ WIKIMAID_HANDLES: 'SylviaBun' });
  const me = await registered('SylviaBun');
  const mint = async () => {
    const r = await call('/v1/auth/token', {}, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const got = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(got.ok, got.why);
    return { answer: r.body, claims: got.claims };
  };
  let m = await mint();
  assert.ok(m.claims.g.includes('wikimaid'), 'the glyph is true from the first token');
  assert.equal('au' in m.claims, false, 'held and not worn: no aura signed');
  let r = await call('/v1/account/title', { title: 'wikimaid' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call('/v1/account/aura', { aura: 'lilacwarren' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.auras, r.body.aura, r.body.title], [['lilacwarren'], 'lilacwarren', 'wikimaid'], 'the wardrobe answers it worn');
  m = await mint();
  assert.deepEqual([m.claims.t, m.claims.au, m.claims.g.includes('wikimaid')], ['wikimaid', 'lilacwarren', true], 'all three signed');
  assert.equal(m.answer.aura, 'lilacwarren', 'and said beside the token, for her own feet');
  const other = await registered('Stranger');
  r = await call('/v1/account/aura', { aura: 'lilacwarren' }, other.secret);
  assert.equal(r.body.error, 'not-held', 'a stranger is refused the warren');
  env.WIKIMAID_HANDLES = '';
  m = await mint();
  assert.deepEqual(['t' in m.claims, 'au' in m.claims, (m.claims.g ?? []).includes('wikimaid')], [false, false, false], 'off the list: the next token carries none of the three');
});

test('WIKIMAID token and relay: a token may carry the title, the glyph and the warren and verifies; every glyph at once still fits; a word the vocabulary lacks is refused; the relay - world214 and after, the ones that know the words - reads all three out of the signature onto the peer\'s row (mutants: the vocabulary\'s words)', async () => {
  assert.equal(RELAY_VERSION, 'world254', 'WIKIMAID moved it on: the vocabulary rides the relay\'s bundle - PIN MOVED: world254, AUDIT FOE-KEEPS (the open zone kill credit: the word of a fighter that left the zone dying, dd; NOT YET DEPLOYED); PIN MOVED: world253, ROCKET1 (the live event word `rocket`; NOT YET DEPLOYED); PIN MOVED: world252, DECK-POSE (a pose carries its place aboard a boat, validPose `ab`; NOT YET DEPLOYED); PIN MOVED: world251, AUDIT MIXED-PAIR / SPELL-HAND (world249 on its branch, renumbered past STAFF-PANEL5-MONSTERS and HERALD-CARDS at the merge - validPose carries `ah`, the left hand of a pair struck last, so the peers draw a pair in both hands); PIN MOVED: world250, HERALD-CARDS (world243 on its branch, renumbered past PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES, STAFF-PANEL5, AUDIT EG-FALL and STAFF-PANEL5-MONSTERS at the merge - every herald post one card of its family - its title, its facts as fields, its colour - and each family a thread of its own in the world events channel, the relay settings gateThread, serpentThread, sdThread and egThread; net/herald/heraldCard.js joins the bundle); PIN MOVED: world249, STAFF-PANEL5-MONSTERS (the staff panel Monster watch counts monsters whatever grantStrip says, and its batch says measured; NOT YET DEPLOYED; world248 on its branch, renumbered past AUDIT EG-FALL at the merge); PIN MOVED: world248, AUDIT EG-FALL (world240 on its branch, renumbered past GUILD-CAP, SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES and STAFF-PANEL5 at the merge - a felled Elite Breach lord lies where it fell - net/eliteGates/egLords.js egLordHit stops its walk at its fall, egStop; no word changed); PIN MOVED: world247, STAFF-PANEL5 (the staff panel relay release: follow, Message on screen, the feeds, the staff cut, hidden staff, freeze and the staff chat; NOT YET DEPLOYED); PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay\'s bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR\'s world224, GAUNTLET-SLAIN\'s world225 and LORD-SHARES\' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords\' blows fair and whole, spec law 10 THE BROKEN WAY, the ways as proven); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit; world214 on its branch, renumbered past WIKIMAID at the merge)');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-bun', n: 'SylviaBun', k: 'linked', t: 'wikimaid', g: ['wikimaid'], au: 'lilacwarren' }, kp.privateKey, { subtle, nowS });
  const got = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(got.ok, got.why);
  assert.deepEqual([got.claims.t, got.claims.g, got.claims.au], ['wikimaid', ['wikimaid'], 'lilacwarren']);
  assert.equal(claimsValid({ s: 'acct-bun', n: 'SylviaBun', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS] }), true, 'every glyph at once still fits');
  assert.equal(claimsValid({ s: 'acct-bun', n: 'SylviaBun', k: 'linked', i: nowS, e: nowS + 60, au: 'bunnywarren' }), false, 'an aura the vocabulary does not hold is refused');
  assert.equal(claimsValid({ s: 'acct-bun', n: 'SylviaBun', k: 'linked', i: nowS, e: nowS + 60, t: 'wikimaiden' }), false, 'and a title');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'SylviaBun', title: 'wikimaid', glyphs: ['wikimaid'], au: 'lilacwarren' });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((msg) => msg.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.deepEqual([seen.title, seen.glyphs, seen.au], ['wikimaid', ['wikimaid'], 'lilacwarren']);
});

// ── THE FACES ───────────────────────────────────────────────────────

test('WIKIMAID drawn: over a head the word in its gradient clipped to the letters, its black edge out from each; the glyph FILLED in its lilac, inline, and over it its three details in their own colours, in order; the account card\'s rules for the title (and its gradient word), the glyph and the warren\'s button, every one of them in the skin (mutants: the details dropped, the edge dropped)', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  layer.render({ points: [{ id: 'peer-0001', name: 'SylviaBun', x: 400, y: 300, scale: 1, title: 'wikimaid', glyphs: ['wikimaid'] }] });
  const node = layer.tagFor('peer-0001').node;
  const title = find(node, 'dfname-title');
  assert.equal(title.textContent, 'WikiMaid');
  assert.equal(title.style.backgroundImage, 'linear-gradient(90deg, #9d5cff, #c390ff, #ffb8de)', 'the gradient, left to right');
  assert.equal(title.style.webkitTextFillColor, 'transparent', 'clipped to the letters');
  assert.ok(title.style.filter.includes('drop-shadow(1px 0 0 #000000)'), `its black edge (${title.style.filter})`);
  assert.equal(find(node, 'dfname-glyphs').children.length, 1, 'the rabbit beside the name');
  const [g] = glyphBadges({ glyphs: ['wikimaid'] });
  const svg = glyphSvgNode(doc, g, 'x-glyph', 1.6);
  assert.equal(svg.style.color, '#c390ff');
  assert.equal(svg.children.length, 4, 'the rabbit and its three details');
  assert.deepEqual([svg.children[0].attrs.d, svg.children[0].attrs.fill, svg.children[0].attrs.stroke], [GLYPH_PATH.wikimaid, 'currentColor', undefined], 'the rabbit, filled');
  assert.deepEqual(svg.children.slice(1).map((c) => [c.attrs.d, c.attrs.fill]), GLYPH_DETAIL.wikimaid.map((d) => [d.path, cssRgba(d.rgba)]), 'its ears, its lace and its face over it, each in its own colour, in order');
  const one = glyphSvgNode(doc, glyphBadges({ glyphs: ['shadowfang'] })[0], 'x-glyph', 1.6);
  assert.deepEqual(one.children.at(-1).attrs.d, GLYPH_DETAIL.shadowfang.path, 'a single detail still drawn - the wolf\'s eye');
  for (const rule of [
    '.card button.acttitle.tl-wikimaid { color: #c390ff; }',
    '.card .acctglyph.gl-wikimaid .acctglyphart { color: #c390ff; }',
    '.card button.acttitle.actaura.aura-lilacwarren { color: #c390ff; }',
  ]) {
    assert.ok(badgeCss().includes(rule), rule);
    assert.ok(ENHANCED_CSS.includes(rule), `and it reached the skin: ${rule}`);
  }
  assert.ok(badgeCss().includes('.tl-wikimaid .acttitleword { background-image: linear-gradient(90deg, #9d5cff, #c390ff, #ffb8de);'), 'the title\'s word in its gradient on the card');
  assert.ok(badgeCss().includes('.aura-lilacwarren .actauraword { background-image: linear-gradient(90deg, #9d5cff, #c390ff, #ffb8de);'), 'and the warren\'s word, the WikiMaid\'s paint');
  assert.deepEqual(titlePaint(titleBadge({ title: 'wikimaid' })).color, '#c390ff', 'the button keeps the plain lilac');
});

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
const recorder = () => {
  const runs = [];
  return { runs, drawScreenQuad: () => {}, drawScreenQuadRun: (tex, qs, color) => runs.push({ quads: qs, color }) };
};

test('WIKIMAID the classic face: the name run carries the ears\' mark; the word a letter at a time along the gradient - "W" in the amethyst, the last "d" in the blush - over one run of its black edge a pixel down and right (mutants: the mark dropped)', () => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'SylviaBun', title: 'wikimaid', glyphs: ['wikimaid'], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }],
    (q) => [q.x, q.y, q.z], { bodyHeight: () => PEER_HEIGHT });
  const r = recorder();
  const drawn = rp.drawNames(r, FONT, mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)), lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]), 1600, 900, [0, 1.7, 0], 1, (q) => [q.x, q.y, q.z]);
  assert.equal(drawn, 2, 'the name and the title');
  const [name, edge, ...rest] = r.runs;
  assert.equal(name.quads.length, 'SylviaBunV'.length, 'the name run carries the ears\' mark');
  assert.deepEqual(edge.color, [0, 0, 0, 1], 'the edge, in black');
  const letters = rest.filter((run) => run.quads.length);
  assert.equal(letters.length, 'WikiMaid'.length, 'one run a letter');
  assert.deepEqual(letters[0].color.map((c) => +c.toFixed(3)), [...WARREN_AMETHYST], '"W" in the amethyst');
  assert.deepEqual(letters.at(-1).color.map((c) => +c.toFixed(3)), [...WARREN_BLUSH], 'the last "d" in the blush');
  assert.ok(edge.quads[0].dst.x > letters[0].quads[0].dst.x && edge.quads[0].dst.y > letters[0].quads[0].dst.y, 'the edge sits down and right of the word');
});

// ── THE LILAC WARREN (render/auraRing.js) ────────────────────────────

test('WIKIMAID the warren\'s look: a look for every aura - the warren the twelfth kind, drawn premultiplied (a rabbit COVERS, so it stays lilac), its ring clear of the body and inside the fire\'s, its rabbits the third draw; the rabbits a rabbit\'s size, the box\'s ground their feet; every rate whole over the clock, the gait, its laps and its binkies too; its colours the WikiMaid\'s own (mutants: the kind, the radius, added not covered, a rate off whole, a colour drifted)', () => {
  for (const a of AURAS) assert.ok(Object.hasOwn(AURA_LOOK, a), `a look for ${a}`);
  assert.deepEqual({ ...AURA_LOOK.lilacwarren }, { kind: 12, ringR: WARREN_R, flameH: WARREN_H, glyphs: WARREN_BUNNIES, shade: true }, 'the twelfth kind, at its own radius and height, its rabbits the third draw, premultiplied');
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  assert.equal(auraLookOf('lilacwarren'), AURA_LOOK.lilacwarren);
  assert.ok(AURA_CARDS >= WARREN_BUNNIES, 'the third draw has a card for every rabbit');
  assert.ok(WARREN_R > RADIANCE_R && WARREN_R < AURA_RING_R, 'a ring about the feet, clear of the body, inside the fire\'s');
  assert.ok(WARREN_R + WARREN_BUNNY_M / 2 < AURA_GROUND_R, 'its rabbits and their tracks on the ground quad');
  assert.ok(WARREN_BUNNY_M > 0.2 && WARREN_BUNNY_M < 0.35, `a rabbit's size (${WARREN_BUNNY_M} m)`);
  assert.equal(WARREN_FOOT, (16 - WARREN_BUNNY.ground) / 16, 'its feet where its picture\'s are');
  assert.equal(Math.max(...figuresOf(WARREN_BUNNY.path)[0].map(([, y]) => y)), WARREN_BUNNY.ground, 'the picture\'s ground its lowest point');
  assert.ok(warrenRatesWhole(), 'every warren rate whole over the clock, its gait, laps and binkies too');
  assert.ok(Number.isInteger(AURA_CLOCK_PERIOD / WARREN_GAIT_S) && Number.isInteger(AURA_CLOCK_PERIOD / WARREN_GAIT_S / WARREN_BINKY_EVERY), 'gaits and binkies whole over the clock');
  assert.ok(Math.abs(WARREN_HOP_RAD * WARREN_HOPS * (AURA_CLOCK_PERIOD / WARREN_GAIT_S) - TAU * WARREN_LAPS) < 1e-9, 'the hops carry it its laps round over the clock exactly');
  const rgb = (c) => [...c].slice(0, 3).map((x) => +x.toFixed(3));
  assert.deepEqual(Object.fromEntries(Object.entries(WARREN_RGB).map(([k, c]) => [k, rgb(c)])), { amethyst: rgb(WARREN_AMETHYST), lilac: rgb(WARREN_LILAC), blush: rgb(WARREN_BLUSH), frill: rgb(WARREN_FRILL), plum: rgb(WARREN_PLUM) }, 'the WikiMaid\'s own five');
  assert.ok(purple(WARREN_RGB.lilac) && purple(WARREN_RGB.amethyst), '"a purple aura"');
  assert.ok(WARREN_SPARKLES > 0 && WARREN_TWINKLES > 0 && WARREN_RING_M < 0.04, 'sparkles, twinkles and a fine ring');
});

/** The gait's law at recorded moments - [k, t, its angle, its height, its stretch, its facing] - so a hop retimed, a
 *  rabbit moved, the stretch dropped or a binky lost moves these. */
const GAIT = [[0, 0.3, 0.190959553, 0.13348712, 1.094315443, 1], [1, 0.95, 1.832595715, 0, 0.983333333, 1], [2, 1.15, 2.722713633, 0, 1, 1], [3, 2, 3.926990817, 0, 0.912715163, 1], [4, 7.42, 6.677424385, 0.04047674, 1.024391372, 1], [5, 13.3, 9.709163962, 0.108129352, 1.07320535, 1], [0, 1.95, 0.942477796, 0.213333333, 1.069282032, -1], [2, 61.25, 21.572269555, 0, 1, 1], [5, 119.6, 43.092179232, 0, 1, 1]];

test('WIKIMAID the rabbits\' law: the gait at recorded moments; each goes round the way it faces, never back, its laps over the clock and whole at the wrap; never two closer than a rabbit\'s length; WARREN_HOPS hops and a sit each gait - a crouch on the ground, the air stretched, the landing taken; one sit in WARREN_BINKY_EVERY a binky, turned about through its middle and back; they come up out of the ground one after another as it kindles; every rabbit at once, farthest first; a wearer\'s own clock (mutants: a hop retimed, the sit dropped, the stretch dropped, no binky, the binky not turned, the rabbits all up at once, the depth order nearest first)', () => {
  for (const [k, t, a, y, sq, face] of GAIT) {
    const b = warrenBunny(k, t);
    assert.ok(Math.abs(b.a - a) < 1e-7 && Math.abs(b.y - y) < 1e-7 && Math.abs(b.sq - sq) < 1e-7 && b.face === face, `rabbit ${k} at ${t}: ${JSON.stringify(b)} (the law records ${[a, y, sq, face]})`);
  }
  for (let k = 0; k < WARREN_BUNNIES; k++) {
    let prev = warrenBunny(k, 0).a, hopsUp = 0, binkies = 0, wasBinky = false;
    for (let t = 0.01; t < AURA_CLOCK_PERIOD; t += 0.01) {
      const b = warrenBunny(k, t);
      assert.ok(b.a >= prev - 1e-12, `rabbit ${k} never hops back (${t.toFixed(2)})`);
      prev = b.a;
      if (b.y > WARREN_HOP_H * 0.9 && b.y <= WARREN_HOP_H) hopsUp++;
      if (b.face < 0 && !wasBinky) binkies++;
      wasBinky = b.face < 0;
    }
    assert.ok(Math.abs(warrenBunny(k, AURA_CLOCK_PERIOD).a - warrenBunny(k, 0).a - TAU * WARREN_LAPS) < 1e-9, `rabbit ${k}: ${WARREN_LAPS} laps over the clock, the wrap whole`);
    for (const f of ['y', 'sq', 'face']) assert.equal(warrenBunny(k, AURA_CLOCK_PERIOD)[f], warrenBunny(k, 0)[f], `and its ${f}`);
    assert.ok(hopsUp > 0, `rabbit ${k} hops`);
    assert.ok(binkies >= AURA_CLOCK_PERIOD / WARREN_GAIT_S / WARREN_BINKY_EVERY && binkies <= AURA_CLOCK_PERIOD / WARREN_GAIT_S / WARREN_BINKY_EVERY + 1, `rabbit ${k}: a binky every ${WARREN_BINKY_EVERY} gaits (${binkies}, one perhaps across the wrap)`);
  }
  let gap = Infinity;
  for (let t = 0; t < AURA_CLOCK_PERIOD; t += 0.05) {
    const as = Array.from({ length: WARREN_BUNNIES }, (_, k) => warrenBunny(k, t).a);
    for (let k = 0; k < WARREN_BUNNIES; k++) gap = Math.min(gap, as[(k + 1) % WARREN_BUNNIES] + (k === WARREN_BUNNIES - 1 ? TAU : 0) - as[k]);
  }
  assert.ok(gap * WARREN_R > WARREN_BUNNY_M * 2, `never two closer than two rabbits' lengths round the ring (${(gap * WARREN_R).toFixed(2)} m)`);
  // one gait of rabbit 0, its own time (rabbit 0's gait starts on the clock's): its three hops, then its sit
  const at = (t) => warrenBunny(0, t);
  for (let j = 0; j < WARREN_HOPS; j++) {
    const t0 = j * WARREN_HOP_S;
    assert.ok(at(t0 + WARREN_HOP_S * WARREN_CROUCH / 2).y === 0 && at(t0 + WARREN_HOP_S * WARREN_CROUCH / 2).sq < 0.9, `hop ${j}: first a crouch on the ground, gathered`);
    const top = at(t0 + WARREN_HOP_S * (WARREN_CROUCH + (1 - WARREN_CROUCH) / 2));
    assert.ok(Math.abs(top.y - WARREN_HOP_H) < 1e-9 && top.sq > 1.05, `then the air, at its top WARREN_HOP_H, stretched (${top.y}, ${top.sq})`);
    assert.ok(Math.abs(at(t0 + WARREN_HOP_S).a - at(t0).a - WARREN_HOP_RAD) < 1e-9, `and WARREN_HOP_RAD round in it`);
  }
  const sit = WARREN_HOPS * WARREN_HOP_S;
  assert.ok(at(sit + 0.05).sq < 0.97 && at(sit + 0.05).y === 0, 'the landing taken');
  assert.equal(at(sit + 0.2).a, at(WARREN_GAIT_S - 0.01).a, 'then the sit, still');
  // rabbit 0's first sit is a binky ((0 + 0) % WARREN_BINKY_EVERY): turned about through its middle, back again
  const bk = (b) => at(sit + WARREN_BINKY_AT + b * WARREN_BINKY_S);
  assert.ok(Math.abs(bk(0.5).y - WARREN_BINKY_H) < 1e-9 && bk(0.5).face === -1, 'a binky: up WARREN_BINKY_H, turned about at its top');
  assert.ok(bk(WARREN_BINKY_TURN[0] - 0.05).face === 1 && bk(WARREN_BINKY_TURN[1] + 0.05).face === 1 && bk(0.95).y > 0, 'and back the way it was before it lands');
  assert.equal(warrenBunny(0, WARREN_GAIT_S + sit + WARREN_BINKY_AT + WARREN_BINKY_S / 2).y, 0, 'the next gait\'s sit no binky');
  assert.equal(warrenBunny(1, WARREN_GAIT_S * 3 - WARREN_OFFSET_S + sit + WARREN_BINKY_AT + WARREN_BINKY_S / 2).face, -1, 'rabbit 1\'s in its own turn');
  // coming up out of the ground as it kindles, one after another
  const ups = (kindle) => Array.from({ length: WARREN_BUNNIES }, (_, k) => warrenBunny(k, 5, kindle).up);
  assert.deepEqual(ups(0), Array(WARREN_BUNNIES).fill(0), 'unkindled: none up');
  assert.deepEqual(ups(1), Array(WARREN_BUNNIES).fill(1), 'kindled: all up');
  const half = ups(WARREN_EMERGE_STEP * 2 + WARREN_EMERGE / 2);
  for (let k = 1; k < WARREN_BUNNIES; k++) assert.ok(half[k] <= half[k - 1], `rabbit ${k} comes up after rabbit ${k - 1} (${half.map((x) => x.toFixed(2))})`);
  assert.ok(half[0] > 0 && half[WARREN_BUNNIES - 1] === 0, 'one after another, not all at once');
  assert.ok(warrenBunny(0, 5, 0).y < -WARREN_BUNNY_M * 0.4, 'under the ground before it comes up');
  // every rabbit at once, and farthest first
  const out = new Float32Array(WARREN_BUNNIES * 4);
  assert.equal(warrenBunniesInto(out, 13.3, 0.7), out, 'into the list it is handed');
  assert.deepEqual([...out], Array.from({ length: WARREN_BUNNIES }, (_, k) => { const b = warrenBunny(k, 13.3, 0.7); return [b.a, b.y, b.sq, b.face * b.up]; }).flat().map(Math.fround));
  const eye = [3, 1.6, 0.5], at0 = [0, 0, 0];
  warrenDepthOrder(out, at0, eye);
  const dist = (k) => Math.hypot(Math.cos(out[k * 4]) * WARREN_R - eye[0], Math.sin(out[k * 4]) * WARREN_R - eye[2]);
  for (let k = 1; k < WARREN_BUNNIES; k++) assert.ok(dist(k) <= dist(k - 1), `farthest first: ${k}`);
  assert.deepEqual([...out].length, WARREN_BUNNIES * 4, 'every rabbit still there');
  assert.ok(Math.abs(warrenClock(13.3 + AURA_CLOCK_PERIOD, 0.25) - resonanceClock(13.3, 0.25)) < 1e-9, 'a wearer\'s own clock, the resonance\'s law');
  assert.ok(Math.abs(warrenStride(0.7) - warrenStride(0.7 + WARREN_GAIT_S)) < 1e-12 && Math.abs(warrenStride(0)) < 1e-12, 'the stride periodic over the gait');
});

test('WIKIMAID the tracks\' law: each rabbit\'s last WARREN_PRINTS landings, newest first - each where the rabbit stood as it landed, its age the time since - and a print fades over WARREN_PRINT_S; a binky leaves none (mutants: the order, the age, the place)', () => {
  const out = new Float32Array(WARREN_BUNNIES * WARREN_PRINTS * 2);
  assert.equal(warrenPrintsInto(out, 13.3), out, 'into the list it is handed');
  for (let k = 0; k < WARREN_BUNNIES; k++) {
    let last = -1;
    for (let n = 0; n < WARREN_PRINTS; n++) {
      const a = out[(k * WARREN_PRINTS + n) * 2], age = out[(k * WARREN_PRINTS + n) * 2 + 1];
      assert.ok(age >= 0 && age > last, `rabbit ${k}: newest first (${age})`);
      last = age;
      const landed = warrenBunny(k, 13.3 - age);
      assert.ok(Math.abs(landed.a - a) < 1e-5 && landed.y < 1e-4, `rabbit ${k} print ${n}: where it stood as it landed (${landed.a} vs ${a}, ${landed.y} up)`);   // the age is a float32's
      assert.ok(Math.abs(warrenBunny(k, 13.3 - age - 0.05).a - a) > 0.01, 'and it had come there in the air');
    }
  }
  // rabbit 0 at 13.3 - its own time 13.3, its fifth gait 1.3 in: in its third hop, the second landed 0.4 ago
  assert.deepEqual([out[1], out[3], out[5]].map((x) => +x.toFixed(4)), [0.4, 0.85, 2.95], 'the landings 0.4, 0.85 and 2.95 ago (the last before the sit; the gait before)');
  assert.ok(WARREN_PRINT_S < 2.95 && WARREN_PRINT_S > 0.85, 'the oldest faded, the others not');
  // a binky lands on its own prints and leaves none: rabbit 0's first sit is one - its newest print is still its last hop's
  const mid = new Float32Array(out.length);
  warrenPrintsInto(mid, WARREN_HOPS * WARREN_HOP_S + WARREN_BINKY_AT + WARREN_BINKY_S + 0.1);
  assert.ok(Math.abs(mid[1] - (WARREN_BINKY_AT + WARREN_BINKY_S + 0.1)) < 1e-6, `after the binky, the newest print still the last hop's (${mid[1]})`);
});

// ── THE SHADER, RUN ─────────────────────────────────────────────────

/** The warren's colour at a point - the shader's own main(), run, with `uAura` the warren's and the rabbits and the tracks
 *  node's law hands it. `px` the metres a pixel spans there. Premultiplied: rgb, cover. */
const lawOf = (t, kindle) => {
  const b = warrenBunniesInto(new Float32Array(WARREN_BUNNIES * 4), t, kindle), p = warrenPrintsInto(new Float32Array(WARREN_BUNNIES * WARREN_PRINTS * 2), t);
  return { uWarren: Array.from({ length: WARREN_BUNNIES }, (_, k) => [...b.slice(k * 4, k * 4 + 4)]), uWarrenPrint: Array.from({ length: WARREN_BUNNIES * WARREN_PRINTS }, (_, i) => [...p.slice(i * 2, i * 2 + 2)]) };
};
const warAt = (kind, vP, { t = 13.3, kindle = 1, vS = [0, 0, 0], world = [0, 0, 0], fog = null, eye = [0, 1.2, 5], px = 0.001, law = null } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vS, vWorld: world, uKind: kind, uAura: 12, uTime: t, uSeed: 0, uKindle: kindle, uRingR: WARREN_R, uGroundR: AURA_GROUND_R,
    uFlameH: WARREN_H, uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uFogRange: [0, 1], uCamPos: eye, uAt: [0, 0, 0], uFocus: [0, 0, 0, 0],
    ...(law ?? lawOf(t, kindle)),
    dFdx: () => [px, 0, 0], dFdy: () => [0, px, 0],
  });
  f.main();
  return f.globals.o;
};
const near3 = (c, want, tol = 1e-3) => [0, 1, 2].every((i) => Math.abs(c[i] - want[i]) < tol);
const B = WARREN_BUNNY;
/** A point in the rabbit's box (x right along it, y down) as its card's uv, facing its box's way. */
const uvOf = ([x, y]) => [x / 16, 1 - y / 16];

test('WIKIMAID a rabbit, the shader RUN: inside its outline the lilac, covering whole, lit from above; its cotton tail, its lace, its eye and its nose each in its own colour; outside it nothing; turned about, its mirror; not yet up, nothing at all (mutants: the tail, the eye, the lace in the lilac, the mirror, the cover)', () => {
  const card = (g, face = 1, opts = {}) => warAt(2, uvOf(g), { vS: [face, 0, 0], px: 0.0005, ...opts });
  const body = card([7, 10]);
  assert.ok(Math.abs(body[3] - 1) < 1e-9, `inside, covering whole (${body[3]})`);
  const shade = (y) => 0.8 + 0.26 * ((t) => t * t * (3 - 2 * t))(Math.max(0, Math.min(1, (14 - y) / 11)));
  assert.ok(near3(body, WARREN_RGB.lilac.map((x) => x * shade(10))), `the lilac, lit from above: ${body.map((x) => x.toFixed(3))}`);
  assert.ok(card([7, 8])[0] > card([7, 13])[0] + 0.05, 'lighter on its back than at its belly');
  assert.ok(near3(card(B.tail.slice(0, 2)), WARREN_RGB.frill) && card(B.tail.slice(0, 2))[3] === 1, 'its cotton tail, white');
  assert.ok(near3(card([B.tail[0] - B.tail[2] * 0.7, B.tail[1]]), WARREN_RGB.frill), 'the tail past the haunch - a puff, out of the outline');
  assert.ok(near3(card(B.eye.slice(0, 2).map((x, i) => x - (i ? 0 : 0.25))), WARREN_RGB.plum), 'its eye, plum');
  assert.ok(near3(card(B.glint.slice(0, 2)), WARREN_RGB.frill), 'a glint in it');
  assert.ok(near3(card(B.nose.slice(0, 2)), WARREN_RGB.blush), 'its nose, blush');
  assert.ok(near3(card([(B.ear[0] + B.ear[2]) / 2, (B.ear[1] + B.ear[3]) / 2]), WARREN_RGB.blush), 'its ear\'s inside, blush');
  assert.ok(near3(card([(B.lace[0] + B.lace[2]) / 2, (B.lace[1] + B.lace[3]) / 2]), WARREN_RGB.frill), 'the maid\'s lace on its crown, white');
  assert.ok(near3(card(B.frills[1].slice(0, 2)), WARREN_RGB.frill) && card(B.frills[1].slice(0, 2))[3] === 1, 'its scallops, over the head\'s line');
  assert.ok(near3(card([(B.band[0] + B.band[2]) / 2, (B.band[1] + B.band[3]) / 2]), WARREN_RGB.plum), 'over a plum band');
  for (const g of [[1, 1], [14.5, 2], [6, 3], [6, 5], [15.5, 15.5], [5, 15.6]]) assert.deepEqual(card(g), [0, 0, 0, 0], `outside it nothing (${g})`);
  const flipped = card([16 - 7, 10], -1);
  assert.deepEqual(flipped, body, 'turned about, its mirror');
  assert.deepEqual(card([16 - B.tail[0], B.tail[1]], -1), card(B.tail.slice(0, 2)), 'its tail the other side');
  assert.throws(() => card([7, 10], 0), GlslDiscard, 'not yet up: nothing at all');
  const far = card([7, 10], 1, { px: 0.05 });
  assert.ok(near3(far, body.map((x, i) => (i < 3 ? x : 1)), 0.02), 'far off, still the lilac - its amethyst line gone once a pixel is wider than it');
  assert.ok(near3(card([7, 10], 1, { world: [0, 0, 400], fog: { density: 0.01 } }), [0, 0, 0], 0.1), 'the fog thins it');
});

test('WIKIMAID the ground, the shader RUN: the ring a crisp line of the lilac, covering; the amethyst light within it and about it, added; a rabbit\'s tracks where it landed, fading, and nothing where it did not; a shadow under a rabbit; the middle, where the angle is no number, no NaN; the quad\'s corners round; unkindled nothing (mutants: the ring added not covered, the tracks dropped, the tracks never fading, the shadows dropped)', () => {
  const R = WARREN_R, RL = WARREN_R - WARREN_RING_IN;
  const on = warAt(0, [RL, 0.0005]);
  assert.ok(Math.abs(on[3] - 1) < 1e-6 && on[0] >= WARREN_RGB.lilac[0] - 1e-3 && on[2] >= WARREN_RGB.lilac[2] - 1e-3, `the ring, the lilac covering whole (${on.map((x) => x.toFixed(3))})`);
  assert.ok(RL > RADIANCE_R && RL + WARREN_RING_M < R - 0.05, 'just inside the rabbits\' lane, clear of the body - they hop round it');
  assert.ok(warAt(0, [R + 0.05, 0.0005], { law: { uWarren: Array(WARREN_BUNNIES).fill([3, 0, 1, 1]), uWarrenPrint: Array(WARREN_BUNNIES * WARREN_PRINTS).fill([3, 99]) } })[3] < 0.01, 'and none of it in their lane, where their tracks are laid');
  const inside = warAt(0, [0.3, 0.1]);
  assert.ok(inside[3] < 1e-9 && inside[2] > 0.03 && inside[2] > inside[1], `within it the amethyst light, added - no cover (${inside.map((x) => x.toFixed(3))})`);
  const law = lawOf(13.3, 1);
  // rabbit 0's newest print (0.4 s old): its hind feet ahead of where it stood, its fore feet behind
  const [pa, page] = law.uWarrenPrint[0];
  assert.ok(Math.abs(page - 0.4) < 1e-6);
  const ground = (along, across, extra = {}) => warAt(0, [Math.cos(pa + along / R) * (R + across), Math.sin(pa + along / R) * (R + across)], { law, ...extra });
  const hind = ground(0.03, 0.022), fore = ground(-0.03, 0);
  const fade = 1 - 0.4 / WARREN_PRINT_S;
  assert.ok(Math.abs(hind[3] - 0.8 * fade) < 0.05 && Math.abs(fore[3] - 0.8 * fade) < 0.05, `its prints - a hind foot, a fore foot - covering, fading (${hind[3].toFixed(3)}, ${fore[3].toFixed(3)} of ${(0.8 * fade).toFixed(3)})`);
  assert.ok(near3(hind.map((x) => x / hind[3]), WARREN_RGB.lilac.map((x) => x), 0.25), 'in the lilac');
  const gap = ground(0, 0.06);
  assert.ok(gap[3] < 0.05, `nothing between them and the ring's edge (${gap[3]})`);
  const old = { ...law, uWarrenPrint: law.uWarrenPrint.map(([a]) => [a, WARREN_PRINT_S + 0.1]) };
  assert.ok(ground(0.03, 0.022, { law: old })[3] < 0.05, 'a print older than WARREN_PRINT_S gone');
  // a shadow under a rabbit standing still
  const still = { uWarren: Array.from({ length: WARREN_BUNNIES }, (_, k) => [k * TAU / WARREN_BUNNIES, 0, 1, 1]), uWarrenPrint: Array(WARREN_BUNNIES * WARREN_PRINTS).fill([0, 99]) };
  const under = warAt(0, [Math.cos(TAU / 12) * R, Math.sin(TAU / 12) * R], { law: still }), shade = warAt(0, [Math.cos(TAU / WARREN_BUNNIES) * R, Math.sin(TAU / WARREN_BUNNIES) * R], { law: still });
  assert.ok(Math.abs(shade[3] - 0.35) < 1e-6 && near3(shade, [0, 0, 0], 0.05) && under[3] < 1e-6, `a shadow under a rabbit, dark - the glow under it dimmed (${shade.map((x) => x.toFixed(3))}), none between them (${under[3].toFixed(3)})`);
  const leaping = { ...still, uWarren: still.uWarren.map(([a]) => [a, 0.3, 1, 1]) };
  assert.ok(warAt(0, [Math.cos(TAU / WARREN_BUNNIES) * R, Math.sin(TAU / WARREN_BUNNIES) * R], { law: leaping })[3] < shade[3] * 0.4, 'softer under a leap');
  for (const p of [[0, 0], [1e-9, 0], [0.02, 0.01]]) {
    const c = warAt(0, p);
    assert.ok(c.every((x) => Number.isFinite(x)) && c[3] < 1e-9, `the middle: no NaN, no cover (${c})`);
  }
  assert.throws(() => warAt(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8]), GlslDiscard, 'the quad\'s corners are round');
  assert.deepEqual(warAt(0, [RL, 0.0005], { kindle: 0 }), [0, 0, 0, 0], 'unkindled: nothing');
});

test('WIKIMAID the wall, the shader RUN: sparkles and a low veil, added - never a cover; the veil at the foot, the light rising as it kindles; the vertex half stands the strip on the ring to the waist (mutants: the sparkles covering, the kindle ignored)', () => {
  let lit = 0;
  for (let i = 0; i < 400; i++) {
    const c = warAt(1, [(i * 0.6180339) % 1, ((i * 0.381966) % 1) * 0.9]);
    assert.equal(c[3], 0, 'added - no cover');
    if (c[0] + c[1] + c[2] > 0.15) lit++;
  }
  assert.ok(lit > 0, `sparkles on it (${lit} of 400 bright)`);
  const foot = warAt(1, [0.37, 0.01]), high = warAt(1, [0.37, 0.95]);
  assert.ok(foot[2] > 0.05, 'the veil at the foot');
  const half = warAt(1, [0.37, 0.01], { kindle: 0.5 }), over = warAt(1, [0.37, 0.8], { kindle: 0.5 });
  assert.ok(half[2] > 0.05 && over.every((x) => x === 0), 'half kindled: lit at the foot, nothing above the line');
  assert.ok(high.every((x) => Number.isFinite(x)));
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const vs = (aP) => { const f = glslFunctions(AURA_VS, { aP, uVP: I, uKind: 1, uAura: 12, uAt: [10, 2, -4], uGroundR: AURA_GROUND_R, uRingR: WARREN_R, uFlameH: WARREN_H, uLift: AURA_LIFT_M, uWarren: Array(WARREN_BUNNIES).fill([0, 0, 1, 1]) }); f.main(); return f.globals.vWorld; };
  const nearP = (p, q) => p.every((x, i) => Math.abs(x - q[i]) < 1e-9);
  assert.ok(nearP(vs([0.25, 0]), [10, 2 + AURA_LIFT_M, -4 + WARREN_R]), 'the wall\'s foot on the ring');
  assert.ok(nearP(vs([0.25, 1]), [10, 2 + AURA_LIFT_M + WARREN_H, -4 + WARREN_R]), 'its top at the waist');
});

test('WIKIMAID a rabbit\'s card, the vertex half RUN: at its place on the ring at its height, its feet there; square to an eye level with it; facing the way it hops round as the eye sees it, the other way from the far side, turned about in a binky; stretched up and narrowed as it flies; leaned back toward an eye above it, its feet planted; not yet up, half its size and facing nothing (mutants: the facing, the lean dropped, the stretch dropped, the feet off the card\'s ground)', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const run = (aP, b, eye, k = 2) => {
    const uWarren = Array(WARREN_BUNNIES).fill([0, 0, 1, 1]);
    uWarren[k] = b;
    const f = glslFunctions(AURA_VS, { aP: [k * 2 + aP[0], aP[1]], uVP: I, uKind: 2, uAura: 12, uAt: [10, 2, -4], uGroundR: AURA_GROUND_R, uRingR: WARREN_R, uFlameH: WARREN_H, uLift: AURA_LIFT_M, uCamPos: eye, uWarren });
    f.main();
    return f.globals;
  };
  const at = [10, 2, -4], level = (eyeOff) => [at[0] + eyeOff[0], at[1] + AURA_LIFT_M, at[2] + eyeOff[1]];
  const feet = (b, eye) => { const l = run([0.5, WARREN_FOOT], b, eye); return l.vWorld; };
  // the rabbit at angle 0 is at +x of the feet; an eye level with it out along +z sees it hop round toward -x... and a
  // binky turns it
  const b0 = [0, 0, 1, 1];
  assert.ok([10 + WARREN_R, 2 + AURA_LIFT_M, -4].every((x, i) => Math.abs(feet(b0, level([0, 5]))[i] - x) < 1e-6), 'its feet at its place on the ring');
  const hop = [0, 0.1, 1, 1];
  assert.ok(Math.abs(feet(hop, level([0, 5]))[1] - (2 + AURA_LIFT_M + 0.1)) < 1e-6, 'at its hop\'s height');
  const left = run([0, 0.5], b0, level([0, 5])).vWorld, right = run([1, 0.5], b0, level([0, 5])).vWorld;
  const span = [right[0] - left[0], right[1] - left[1], right[2] - left[2]];
  const toEye = [0 - WARREN_R, 0, 5].map((x, i) => (i === 1 ? 0 : x));
  assert.ok(Math.abs(span[0] * toEye[0] + span[2] * toEye[2]) < 1e-6 && Math.abs(span[1]) < 1e-9, 'square to the eye about the vertical');
  assert.ok(Math.abs(Math.hypot(...span) - WARREN_BUNNY_M) < 1e-6, 'a rabbit\'s card wide');
  const faceFrom = (b, eye) => run([0.5, 0.5], b, eye).vS[0];
  // the rabbit at angle 0 hops round toward +z: an eye out along +x, square to its way, sees it hop toward the card's x
  // and face its box's way; an eye across the ring sees it the other way round
  const side = level([5 + WARREN_R, 0]), across = level([-5, 0]);
  const front = faceFrom(b0, side), back = faceFrom(b0, across);
  assert.ok(front === 1 && back === -1, `facing the way it hops as the eye sees it - the other way from across the ring (${front}, ${back})`);
  const sl = run([0, 0.5], b0, side).vWorld, sr = run([1, 0.5], b0, side).vWorld;
  assert.ok(sr[2] - sl[2] > 0.9 * WARREN_BUNNY_M, 'the card\'s x along its way from that eye');
  assert.equal(faceFrom([0, 0.2, 1, -1], side), -front, 'turned about in a binky');
  assert.ok(Math.abs(faceFrom([0, -0.1, 1, 0.3], side) - front) < 1e-9, 'coming up, its facing kept');
  assert.equal(faceFrom([0, -0.1, 1, 0], side), 0, 'not yet up: facing nothing - the fragment half draws nothing');
  const tall = (sq) => { const top = run([0.5, 1], [0, 0, sq, 1], level([0, 5])).vWorld, foot = run([0.5, 0], [0, 0, sq, 1], level([0, 5])).vWorld; return top[1] - foot[1]; };
  const wide = (sq) => { const l = run([0, 0.5], [0, 0, sq, 1], level([0, 5])).vWorld, r = run([1, 0.5], [0, 0, sq, 1], level([0, 5])).vWorld; return Math.hypot(r[0] - l[0], r[2] - l[2]); };
  assert.ok(Math.abs(tall(1.1) / tall(1) - 1.1) < 1e-6 && Math.abs(wide(1.1) / wide(1) - 1 / Math.sqrt(1.1)) < 1e-6, 'stretched up and narrowed as it flies, keeping its bulk');
  assert.ok(Math.abs(tall(1) - WARREN_BUNNY_M) < 1e-6, 'a card tall square to a level eye');
  // from above: leaned back toward the eye, its feet planted
  const aboveEye = [at[0] + WARREN_R, at[1] + 6, at[2] + 2];
  const lean = Math.atan2(aboveEye[1] - (at[1] + AURA_LIFT_M), 2) * WARREN_LEAN;
  const top = run([0.5, 1], b0, aboveEye).vWorld, mid = run([0.5, WARREN_FOOT], b0, aboveEye).vWorld;
  const up = [top[0] - mid[0], top[1] - mid[1], top[2] - mid[2]], ul = Math.hypot(...up);
  assert.ok(Math.abs(Math.acos(up[1] / ul) - lean) < 1e-6 && up[2] > 0, `leaned back toward an eye above it by ${WARREN_LEAN} of its height over it (${(Math.acos(up[1] / ul) * 180 / Math.PI).toFixed(1)} degrees)`);
  assert.ok([10 + WARREN_R, 2 + AURA_LIFT_M, -4].every((x, i) => Math.abs(mid[i] - x) < 1e-6), 'its feet planted');
  const small = run([0, 0.5], [0, 0, 1, 0.0001], level([0, 5])).vWorld, small2 = run([1, 0.5], [0, 0, 1, 0.0001], level([0, 5])).vWorld;
  assert.ok(Math.abs(Math.hypot(small2[0] - small[0], small2[2] - small[2]) - WARREN_BUNNY_M / 2) < 1e-4, 'not yet up: half its size');
});

test('WIKIMAID the warren\'s draw: drawn premultiplied and the blend handed back; node\'s rabbits - farthest first - and their tracks handed over on the wearer\'s own clock and kindle, for the warren alone; its ground, its strip and a card a rabbit; one program (mutants: the rabbits not handed, the depth order dropped, the seed ignored, added not covered)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13 }, {
    get(tg, k) {
      if (k in tg) return tg[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const r = new AuraRingRenderer(gl);
  // PIN MOVED (AURA-SPLIT, #1143): a look is its own program - no program at the build, each look's at its first draw, and a wearer's look the program bound (kindOf)
  assert.equal(calls.filter((c) => c[0] === 'createProgram').length, 0, 'no program at the build');
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  const eye = [4, 1.6, 2];
  r.draw([{ at: [1, 0, 1], aura: 'lilacwarren', seed: 0.3, kindle: 0.7 }, { at: [5, 0, 5], aura: 'radiance' }], I, I, eye, 10);
  assert.equal(r.drawn, 2);
  const per = (name, kind) => calls.filter((c) => c[0] === kind && c[1] === name).map((c) => c[2]);
  assert.deepEqual(calls.filter((c) => c[0] === 'useProgram').map((c) => r.kindOf(c[1])), [2, 12], 'farthest first: the radiance, then the warren');
  assert.deepEqual(per('uRingR', 'uniform1f'), [RADIANCE_R, WARREN_R], 'each at its own radius');
  assert.deepEqual(per('uFlameH', 'uniform1f'), [RADIANCE_H, WARREN_H], 'each wall at its own height');
  const handed = calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uWarren');
  assert.equal(handed.length, 1, 'the rabbits handed for the warren alone');
  const want = warrenDepthOrder(warrenBunniesInto(new Float32Array(WARREN_BUNNIES * 4), warrenClock(10, 0.3), 0.7), [1, 0, 1], eye);
  assert.deepEqual([...handed[0][2]], [...want], 'node\'s rabbits on the wearer\'s own clock and kindle, farthest first from the eye');
  const prints = calls.filter((c) => c[0] === 'uniform2fv' && c[1] === 'uWarrenPrint');
  assert.equal(prints.length, 1, 'and their tracks');
  assert.deepEqual([...prints[0][2]], [...warrenPrintsInto(new Float32Array(WARREN_BUNNIES * WARREN_PRINTS * 2), warrenClock(10, 0.3))]);
  const blends = calls.filter((c) => c[0] === 'blendFunc' || c[0] === 'useProgram').map((c) => (c[0] === 'blendFunc' ? c.slice(1).join('/') : `aura${r.kindOf(c[1])}`));
  assert.deepEqual(blends.slice(0, 5), ['10/10', 'aura2', 'aura12', '10/13', '10/10'], 'added for the radiance; the warren premultiplied (ONE, ONE_MINUS_SRC_ALPHA) and the blend handed back');
  const draws = calls.filter((c) => c[0] === 'drawArrays').map((c) => c[3]);
  assert.deepEqual(draws, [6, AURA_STEPS * 6, 6, AURA_STEPS * 6, WARREN_BUNNIES * 6], 'the warren\'s ground, its strip and a card a rabbit');
  // PIN MOVED (AURA-SPLIT, #1143): a program a look - bound where the look changes, and handed the frame's uniforms once each
  const boundLooks = calls.filter((c) => c[0] === 'useProgram').map((c) => r.kindOf(c[1]));
  assert.equal(calls.filter((c) => c[0] === 'uniformMatrix4fv' && c[1] === 'uVP').length, new Set(boundLooks).size, 'each look\'s program handed the frame once');
});
