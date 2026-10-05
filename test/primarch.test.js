// PRIMARCH — GA00250'S OWN: THE PRIMARCH, ITS GLYPH, AND THE GOLDEN RADIANCE (2026-10-04).
//
// GA00250, relayed by the owner ("The details here are for a custom title, glyph, and aura for ga00250"): "the title
// will be Primarch, the color will be that light gold color that you guys use in some places in the game menu" - over a
// screenshot of their own name in the pause menu's pixel face, "that color" - and "can the aura be a golden light around
// the character? like i've seen some rare mobs with it" (the elite foes' glow); and after the first push, a picture of a
// three-barred cross: "i'd like to that be the glyph design if possible. with the same color of the name". The handle
// list grants all three together (TIER_LISTS,
// TIER_GLYPH and TIER_AURA - the second list to grant an aura); the title is the menu's own #d8cfae, one colour as
// asked; the aura is the third look of the aura pass (render/auraRing.js AURA_LOOK) - its shader RUN here.
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
import { CAPSULE_HEIGHT } from '../src/player/motor.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';
import { standService } from './accountDb.mjs';
import {
  AURA_LOOK, auraLookOf, AURA_RING_R, AURA_GROUND_R, AURA_LIFT_M, AURA_STEPS, AURA_CLOCK_PERIOD, AURA_VS, AURA_FS,
  RADIANCE_R, RADIANCE_H, RADIANCE_POOL_R, RADIANCE_RAYS, RADIANCE_MOTES, RADIANCE_ROUND, RADIANCE_HZ, RADIANCE_FLOW,
  RADIANCE_RGB, radianceRatesWhole, AuraRingRenderer, WARD_RING_R, WARD_WALL_H, WARD_GLYPHS,
} from '../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from './glsl.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
/** The Worker's config as it reads it: every handle list. */
const ENV = Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
const AFTER = 1_900_000_000;      // first played long after Founder's cutoff, so no row below holds Founder by accident
const LATER = AFTER + 30 * 86_400;   // past the sprout's two weeks, so the only glyph is the grant's
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });

/** A colour's hue in degrees, HSV. */
const hueOf = ([r, g, b]) => {
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 0;
  return max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
};
/** A gold: red the most, green over blue, its hue between an orange and a yellow. */
const gold = (c) => c[0] >= c[1] && c[1] > c[2] && hueOf(c) > 30 && hueOf(c) < 55;

// ── the fake document (aegis.test.js's shape) ──
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

test('PRIMARCH vocabulary: the title and the glyph join the closed lists last, the aura joins AURAS after the ward; "Primarch" and "Golden Radiance" in words; the title ONE colour - the pixel menu\'s own light gold, #d8cfae, held to the menu\'s rule - no gradient, no edge; the glyph in it, filled; `Y` on the classic face; the radiance\'s button in the Primarch\'s gold; the wire keeps all three (mutants: the colour, the glyph\'s colour, the mark, the fill, the button\'s paint, the words)', () => {
  assert.equal(TITLES.at(-1), 'primarch', 'the vocabulary\'s newest');
  assert.equal(GLYPHS.at(-1), 'primarch');
  assert.deepEqual([...AURAS], ['dagonfire', 'oblivionward', 'radiance', 'shadowcloak', 'seraphwings'], 'the Broker\'s fire, the ward, then the radiance - SHADOW-CLOAK\'s cloak after it, SERAPH-WINGS\' wings after that (PIN MOVED)');
  assert.equal(TITLE_TEXT.primarch, 'Primarch', 'GA00250: "the title will be Primarch"');
  assert.equal(AURA_TEXT.radiance, 'Golden Radiance');
  assert.equal(GLYPH_LABEL.primarch, 'Primarch', 'named on the account card');
  assert.equal(cssRgba(TITLE_RGBA.primarch), '#d8cfae', '"that light gold color that you guys use in some places in the game menu"');
  const mname = /\.px-mname \{[^}]*color: (#[0-9a-f]{6});/.exec(ENHANCED_CSS)?.[1];
  assert.equal(mname, cssRgba(TITLE_RGBA.primarch), 'the very colour the pause menu draws a name in - the screenshot\'s - and it cannot drift from it');
  assert.ok(gold(TITLE_RGBA.primarch), `a gold: ${hueOf(TITLE_RGBA.primarch).toFixed(1)} degrees`);
  assert.equal(TITLE_GRADIENT.primarch, undefined, 'one colour, as asked - no gradient');
  assert.equal(TITLE_EDGE.primarch, undefined, 'and so no edge of its own: every face\'s black text shadow');
  assert.equal(new Set(TITLES.map((t) => cssRgba(TITLE_RGBA[t]))).size, TITLES.length, 'no two titles share a colour');
  for (const other of ['founder', 'crowned', 'champion', 'penitent']) {
    const d = Math.hypot(...[0, 1, 2].map((i) => (TITLE_RGBA.primarch[i] - TITLE_RGBA[other][i]) * 255));
    assert.ok(d > 30, `apart from the ${other}'s (${cssRgba(TITLE_RGBA[other])}, ${d.toFixed(0)} apart)`);
  }
  assert.equal(GLYPH_RGBA.primarch, TITLE_RGBA.primarch, 'the cross in the title\'s own gold - "with the same color of the name"; the two halves of one grant cannot drift');
  assert.equal(GLYPH_GRADIENT.primarch, undefined);
  assert.equal(GLYPH_DETAIL.primarch, undefined, 'one shape, one colour');
  assert.equal(GLYPH_STROKE.primarch, false, 'filled, as the reference is');
  assert.equal(GLYPH_MARK.primarch, 't', 'a cross with its foot turned');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, marks.length, 'a classic mark of its own');
  assert.ok(GLYPH_MARK.primarch.charCodeAt(0) >= FONT_GLYPH_MIN && GLYPH_MARK.primarch.charCodeAt(0) <= FONT_GLYPH_MAX, 'inside the font');
  for (const a of AURAS) assert.ok(AURA_TEXT[a] && TITLES.includes(AURA_PAINT[a]), `every aura has a word and a title's paint for its button: ${a}`);
  assert.equal(AURA_PAINT.radiance, 'primarch', 'the radiance in the Primarch\'s own gold');
  assert.deepEqual({ ...AURA_PAINT }, { dagonfire: 'gatebreaker', oblivionward: 'aegis', radiance: 'primarch', shadowcloak: 'shadowfang', seraphwings: 'founder' }, 'the fire and the ward as before - SERAPH-WINGS\' wings in the Founder\'s gold (PIN MOVED) - SHADOW-CLOAK\'s cloak in the Shadow Fang\'s paint after them (PIN MOVED)');
  const badge = titleBadge({ title: 'primarch' });
  assert.deepEqual({ text: badge.text, rgba: badge.rgba, gradient: badge.gradient, edge: badge.edge }, { text: 'Primarch', rgba: TITLE_RGBA.primarch, gradient: null, edge: null });
  assert.deepEqual(readBadge({ title: 'primarch', glyphs: ['primarch'] }), { title: 'primarch', glyphs: ['primarch'] }, 'the wire keeps it');
  assert.equal(readAura({ au: 'radiance' }), 'radiance', 'and the aura');
  assert.deepEqual(badged({ id: 'p1' }, { title: 'primarch', au: 'radiance' }), { id: 'p1', title: 'primarch', au: 'radiance' });
  assert.deepEqual(glyphBadges({ glyphs: ['primarch', 'aegis', 'sprout'] }).map((b) => b.key), ['sprout', 'aegis', 'primarch'], 'drawn in the vocabulary\'s order');
});

/** The glyph's outline: each subpath (M L H V Z, absolute) as its corners, in order. */
const subpathsOf = (d) => d.split(/(?=M)/).map((sub) => {
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
const span = (pts, i) => [Math.min(...pts.map((p) => p[i])), Math.max(...pts.map((p) => p[i]))];
/** A closed outline's signed area (the shoelace) - its sign is which way round it is wound. */
const areaOf = (pts) => pts.reduce((s, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + (x * y2 - x2 * y); }, 0) / 2;

test('PRIMARCH the glyph\'s shape: GA00250\'s three-barred cross - the shaft the full height up the middle; a short bar at its head; the long crossbar under it, the glyph\'s widest; low down a footrest as wide as the head bar, slanting down to the right as the reference\'s does; each bar across the shaft and centred on it; every outline wound the same way round, so the fill is whole where they cross; inside the box (mutants: the slant turned, the head bar as long as the crossbar, the shaft off the middle, a bar wound the other way)', () => {
  const parts = subpathsOf(GLYPH_PATH.primarch);
  assert.equal(parts.length, 4, 'the shaft and three bars');
  for (const [x, y] of parts.flat()) assert.ok(x >= 0 && x <= 16 && y >= 0 && y <= 16, `inside the box: ${x},${y}`);
  const [shaft, head, cross, foot] = parts;
  const [sx0, sx1] = span(shaft, 0), [sy0, sy1] = span(shaft, 1);
  assert.equal((sx0 + sx1) / 2, 8, 'the shaft on the middle');
  assert.ok(sy0 < 1 && sy1 > 15 && sx1 - sx0 < 2, 'upright, the full height, narrow');
  for (const [name, bar] of [['the head bar', head], ['the crossbar', cross]]) {
    const [x0, x1] = span(bar, 0);
    assert.ok(Math.abs((x0 + x1) / 2 - 8) < 1e-9, `${name} centred on the shaft`);
    assert.ok(x0 < sx0 && x1 > sx1, `${name} across it`);
    assert.ok(bar.length === 4 && new Set(bar.map(([, y]) => y)).size === 2, `${name} level: four corners on two heights`);
  }
  const w = (bar) => span(bar, 0)[1] - span(bar, 0)[0];
  assert.ok(span(head, 1)[1] < span(cross, 1)[0], 'the head bar over the crossbar');
  assert.ok(w(cross) > 2 * w(head), 'the head bar short, the crossbar long (the reference\'s 10.1 to 4.0)');
  assert.equal(Math.max(...parts.map(w)), w(cross), 'the crossbar the glyph\'s widest');
  // the footrest: low down, as wide as the head bar, centred, across the shaft, slanting down to the right
  const [fx0, fx1] = span(foot, 0);
  assert.ok(Math.abs((fx0 + fx1) / 2 - 8) < 1e-9 && fx0 < sx0 && fx1 > sx1 && Math.abs(w(foot) - w(head)) < 1e-9, 'the footrest centred across the shaft, the head bar\'s width');
  assert.ok(span(foot, 1)[0] > 8 && span(foot, 1)[1] < sy1, 'low down the shaft, above its foot');
  const leftY = foot.filter(([x]) => x === fx0).map(([, y]) => y), rightY = foot.filter(([x]) => x === fx1).map(([, y]) => y);
  assert.ok(Math.min(...leftY) + 2 < Math.min(...rightY), `slanting down to the right, as the reference's does (left ${leftY}, right ${rightY})`);
  assert.ok(Math.abs((Math.max(...leftY) - Math.min(...leftY)) - (Math.max(...rightY) - Math.min(...rightY))) < 1e-9, 'a bar of one thickness');
  // one way round: under the nonzero rule a bar wound against the shaft would cut a hole where it crosses it
  const signs = new Set(parts.map((p) => Math.sign(areaOf(p))));
  assert.equal(signs.size, 1, 'every outline wound the same way round');
});

// ── THE GRANT ───────────────────────────────────────────────────────

test('PRIMARCH grant: PRIMARCH_HANDLES names GA00250, and the list grants the title, its glyph AND the Golden Radiance together, case-folded; worn while held, read off the config alone; off the list all three go, a guest holds none, Sureme holds the ward and not the radiance, and nobody else holds any (mutants: the handle, the list\'s key, the glyph\'s word, the aura\'s grant)', () => {
  assert.equal(v('PRIMARCH_HANDLES'), 'GA00250', 'the owner: "a custom title, glyph, and aura for ga00250"');
  assert.equal(TIER_LISTS.primarch, 'PRIMARCH_HANDLES');
  assert.equal(TIER_GLYPH.primarch, 'primarch');
  assert.deepEqual({ ...TIER_AURA }, { aegis: 'oblivionward', primarch: 'radiance', shadowfang: 'shadowcloak' }, 'the lists that grant an aura - SHADOW-CLOAK\'s the third (PIN MOVED)');
  for (const h of ['GA00250', 'ga00250', 'Ga00250']) {
    const p = row(h);
    assert.deepEqual(titlesHeld(p, ENV), ['primarch'], `${h}: the title, by name, case-folded`);
    assert.deepEqual(glyphsOf(p, ENV, LATER), ['primarch'], 'and its glyph');
    assert.deepEqual(aurasHeld(p, ENV), ['radiance'], 'and the radiance');
    assert.equal(equipRefusal('primarch', p, ENV), null);
    assert.equal(auraRefusal('radiance', p, ENV), null, 'theirs to wear');
  }
  const ga = row('GA00250', { title: 'primarch', aura: 'radiance' });
  assert.equal(titleWorn(ga, ENV), 'primarch');
  assert.equal(auraWorn(ga, ENV), 'radiance');
  assert.equal(auraWorn(ga), undefined, 'without the config, the Broker\'s alone - the radiance is a list\'s');
  const both = row('GA00250', { insignia: 'aura:dagonfire', aura: 'dagonfire' });
  assert.deepEqual(aurasHeld(both, ENV), ['radiance', 'dagonfire'], 'the list\'s first, then what the Broker sold');
  assert.equal(auraWorn(both, ENV), 'dagonfire', 'a bought fire still worn beside it');
  const w = wardrobeOf(ga, ENV, LATER);
  assert.deepEqual([w.titles, w.title, w.glyphs, w.auras, w.aura], [['primarch'], 'primarch', ['primarch'], ['radiance'], 'radiance'], 'the account card\'s whole answer');
  const off = { ...ENV, PRIMARCH_HANDLES: '' };
  assert.deepEqual([titlesHeld(ga, off), glyphsOf(ga, off, LATER), aurasHeld(ga, off)], [[], [], []], 'off the list, all three go');
  assert.equal(auraWorn(ga, off), undefined, 'and the radiance is not worn by a row nobody cleared');
  assert.equal(auraRefusal('radiance', ga, off), 'not-held');
  assert.deepEqual(titlesHeld({ ...ga, handle: null }, ENV), [], 'a guest holds none');
  assert.deepEqual(aurasHeld({ ...ga, handle: null }, ENV), []);
  assert.deepEqual(aurasHeld(row('Sureme'), ENV), ['oblivionward'], 'Sureme holds the ward and not the radiance');
  assert.equal(auraRefusal('radiance', row('Sureme'), ENV), 'not-held');
  for (const h of ['Diggleborf', 'SirMcMobdon', 'Dutchess', 'SquidKamer', 'GA0025', 'GA002500', 'GA00251']) {
    assert.ok(!titlesHeld(row(h), ENV).includes('primarch'), `${h} does not hold it`);
    assert.ok(!aurasHeld(row(h), ENV).includes('radiance'), `nor the radiance: ${h}`);
    assert.equal(auraRefusal('radiance', row(h), ENV), 'not-held');
  }
  assert.equal(isStaff(['primarch']), false, 'a title, a glyph and an aura - not the staff\'s commands');
});

test('PRIMARCH the service end to end: GA00250 registers, holds the title, the glyph and the radiance; wears the title and the radiance through their doors; the token signs all three; a stranger is refused the radiance; off the list, the next token carries none', async () => {
  const { env, call, registered, identityPublic } = await standService({ PRIMARCH_HANDLES: 'GA00250' });
  const me = await registered('GA00250');
  const mint = async () => {
    const r = await call('/v1/auth/token', {}, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const got = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(got.ok, got.why);
    return { answer: r.body, claims: got.claims };
  };
  let m = await mint();
  assert.ok(m.claims.g.includes('primarch'), 'the glyph is true from the first token');
  assert.equal('au' in m.claims, false, 'held and not worn: no aura signed');
  let r = await call('/v1/account/title', { title: 'primarch' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call('/v1/account/aura', { aura: 'radiance' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.auras, r.body.aura, r.body.title], [['radiance'], 'radiance', 'primarch'], 'the wardrobe answers it worn');
  m = await mint();
  assert.deepEqual([m.claims.t, m.claims.au, m.claims.g.includes('primarch')], ['primarch', 'radiance', true], 'all three signed');
  assert.equal(m.answer.aura, 'radiance', 'and said beside the token, for my own feet');
  const other = await registered('Stranger');
  r = await call('/v1/account/aura', { aura: 'radiance' }, other.secret);
  assert.equal(r.body.error, 'not-held', 'a stranger is refused the radiance');
  env.PRIMARCH_HANDLES = '';
  m = await mint();
  assert.deepEqual(['t' in m.claims, 'au' in m.claims, (m.claims.g ?? []).includes('primarch')], [false, false, false], 'off the list: the next token carries none of the three');
});

test('PRIMARCH token and relay: a token may carry the title, the glyph and the radiance and verifies; every glyph at once still fits; the relay - world162, the one that knows the words - reads all three out of the signature onto the peer\'s row (mutants: the vocabulary\'s aura)', async () => {
  assert.equal(RELAY_VERSION, 'world170', 'PRIMARCH moved it on (world162): the vocabulary rides the relay\'s bundle; SUNBABY1 after it (world163, a live event\'s word - PIN MOVED); PARTY-LEAD after that (world164, the hub\'s party.lead act - PIN MOVED); SERPENT1 after it (world165, the serpent frame - PIN MOVED); SERPENT2 after that (world166, the serpent herald - PIN MOVED); SHADOW-CLOAK after it (world167, the cloak\'s word - PIN MOVED); SERAPH-WINGS after it (world168, the wings word - PIN MOVED); AUDIT ARENA-LADDER after that (world169, the arena ladder audit - PIN MOVED); FEUD after that (world170, the foe record\'s wind-ups and a revenant\'s fields - PIN MOVED)');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-ga00250', n: 'GA00250', k: 'linked', t: 'primarch', g: ['sprout', 'primarch'], au: 'radiance' }, kp.privateKey, { subtle, nowS });
  const got = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(got.ok, got.why);
  assert.deepEqual([got.claims.t, got.claims.g, got.claims.au], ['primarch', ['sprout', 'primarch'], 'radiance']);
  assert.equal(claimsValid({ s: 'acct-ga00250', n: 'GA00250', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS] }), true, 'every glyph at once still fits');
  assert.equal(claimsValid({ s: 'acct-ga00250', n: 'GA00250', k: 'linked', i: nowS, e: nowS + 60, au: 'goldenradiance' }), false, 'a word the vocabulary does not hold is refused');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'GA00250', title: 'primarch', glyphs: ['primarch'], au: 'radiance' });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((msg) => msg.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.deepEqual([seen.title, seen.glyphs, seen.au], ['primarch', ['primarch'], 'radiance']);
});

// ── THE FACES ───────────────────────────────────────────────────────

test('PRIMARCH drawn: over a head the word in the menu\'s gold, plain - no gradient clipped to it; the glyph FILLED in currentColor - the gold, inline - one shape; the account card\'s rules for the title, the glyph and the radiance\'s button in the gold, and every one of them in the skin', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  layer.render({ points: [{ id: 'peer-0001', name: 'GA00250', x: 400, y: 300, scale: 1, title: 'primarch', glyphs: ['primarch'] }] });
  const node = layer.tagFor('peer-0001').node;
  const title = find(node, 'dfname-title');
  assert.equal(title.textContent, 'Primarch');
  assert.equal(title.style.color, '#d8cfae');
  assert.equal(title.style.backgroundImage, '', 'one colour: no gradient');
  assert.equal(title.style.webkitTextFillColor, '', 'the letters filled in their own colour');
  assert.deepEqual(titlePaint(titleBadge({ title: 'primarch' })).color, '#d8cfae');
  assert.equal(find(node, 'dfname-glyphs').children.length, 1, 'the cross beside the name');
  const [g] = glyphBadges({ glyphs: ['primarch'] });
  const svg = glyphSvgNode(doc, g, 'x-glyph', 1.6);
  assert.equal(svg.style.color, '#d8cfae');
  assert.equal(svg.children.length, 1, 'one shape');
  assert.deepEqual([svg.children[0].attrs.d, svg.children[0].attrs.fill, svg.children[0].attrs.stroke], [GLYPH_PATH.primarch, 'currentColor', undefined], 'filled');
  for (const rule of [
    '.card button.acttitle.tl-primarch { color: #d8cfae; }',
    '.card .acctglyph.gl-primarch .acctglyphart { color: #d8cfae; }',
    '.card button.acttitle.actaura.aura-radiance { color: #d8cfae; }',
    '.card button.acttitle.actaura.aura-oblivionward { color: #b24dff; }',
  ]) {
    assert.ok(badgeCss().includes(rule), rule);
    assert.ok(ENHANCED_CSS.includes(rule), `and it reached the skin: ${rule}`);
  }
  assert.ok(!badgeCss().includes('.tl-primarch .acttitleword'), 'no gradient word rule for a one-colour title');
});

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
const recorder = () => {
  const runs = [];
  return { runs, drawScreenQuad: () => {}, drawScreenQuadRun: (tex, qs, color) => runs.push({ quads: qs, color }) };
};

test('PRIMARCH the classic face: the name run carries the cross\'s mark, and the word is drawn whole in the gold (mutants: the mark dropped)', () => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'GA00250', title: 'primarch', glyphs: ['primarch'], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }],
    (q) => [q.x, q.y, q.z], { bodyHeight: () => PEER_HEIGHT });
  const r = recorder();
  const drawn = rp.drawNames(r, FONT, mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)), lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]), 1600, 900, [0, 1.7, 0], 1, (q) => [q.x, q.y, q.z]);
  assert.equal(drawn, 2, 'the name and the title');
  assert.equal(r.runs[0].quads.length, 'GA00250t'.length, 'the name run carries the cross\'s mark');
  const word = r.runs.find((run) => run.quads.length === 'Primarch'.length && run.color && cssRgba(run.color) === '#d8cfae');
  assert.ok(word, 'the word drawn whole, in the gold');
});

// ── THE RADIANCE (render/auraRing.js) ───────────────────────────────

test('PRIMARCH the radiance\'s law: a look for every aura - the radiance the third kind, its column the body\'s width (clear of the shoulders, inside the fire\'s ring) and standing past the crown, its pool inside the ground quad; no symbols; every rate whole over the clock; its heart the Primarch\'s own gold and its glow a gold (mutants: the kind, the radius, the height, a rate off whole, the heart)', () => {
  for (const a of AURAS) assert.ok(Object.hasOwn(AURA_LOOK, a), `a look for ${a}`);
  assert.deepEqual({ ...AURA_LOOK.radiance }, { kind: 2, ringR: RADIANCE_R, flameH: RADIANCE_H, glyphs: 0 }, 'the third kind, at its own radius and height, no symbols');
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  assert.equal(auraLookOf('radiance'), AURA_LOOK.radiance);
  assert.ok(RADIANCE_R > 0.4 && RADIANCE_R < AURA_RING_R, 'the body\'s width: clear of the shoulders, inside the fire\'s ring');
  assert.ok(RADIANCE_H > CAPSULE_HEIGHT + 0.2, 'standing past the crown');
  assert.ok(RADIANCE_POOL_R > RADIANCE_R + 0.3 && RADIANCE_POOL_R < AURA_GROUND_R, 'its pool reaching past the column, inside the ground quad');
  assert.deepEqual([RADIANCE_RAYS, RADIANCE_MOTES, RADIANCE_ROUND], [12, 18, 24]);
  assert.ok(radianceRatesWhole(), 'every radiance rate whole over the clock');
  for (const r of [...Object.values(RADIANCE_HZ), ...Object.values(RADIANCE_FLOW)]) assert.ok(Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6), `whole: ${r}`);
  const rgb = (c) => [...c].slice(0, 3).map((x) => +x.toFixed(3));
  assert.deepEqual(rgb(RADIANCE_RGB.heart), rgb(TITLE_RGBA.primarch), 'its heart the title\'s light gold');
  assert.ok(gold(RADIANCE_RGB.gold), `its glow a gold: ${hueOf(RADIANCE_RGB.gold).toFixed(1)} degrees`);
  assert.ok(Math.max(...RADIANCE_RGB.gold) - Math.min(...RADIANCE_RGB.gold) > Math.max(...RADIANCE_RGB.heart) - Math.min(...RADIANCE_RGB.heart), 'a deeper gold than the heart - the light round it, warm');
});

/** The radiance's colour at a point - the shader's own main(), run, with `uAura` the radiance's. */
const radAt = (kind, vP, { t = 13.5, kindle = 1, world = [0, 0, 0], fog = null, eye = [0, 1.2, 5], at = [0, 0, 0] } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vWorld: world, uKind: kind, uAura: 2, uTime: t, uSeed: 0.37, uKindle: kindle, uRingR: RADIANCE_R, uGroundR: AURA_GROUND_R,
    uFlameH: RADIANCE_H, uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uFogRange: [0, 1], uCamPos: eye, uAt: at, uFocus: [0, 0, 0, 0],
  });
  f.main();
  return f.globals.o;
};
const lum = (c) => c[0] + c[1] + c[2];
const at = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
/** The wall's point at (u, v) about feet at the origin, in the scene - where the vertex half puts it. */
const wallPoint = (u, v) => [Math.cos(u * 2 * Math.PI) * RADIANCE_R, AURA_LIFT_M + v * RADIANCE_H, Math.sin(u * 2 * Math.PI) * RADIANCE_R];
const wallAt = (u, v, opts = {}) => radAt(1, [u, v], { world: wallPoint(u, v), ...opts });

test('PRIMARCH the radiance\'s ground, the shader RUN: its ring whole at the column\'s foot - lit at every bearing - and golden; added onto the frame; a pool bright at the feet and dark past its reach; rays out across it, beams and gaps; no seam behind the wearer; the wrap whole; the quad\'s corners round; unkindled nothing, the fog thins it (mutants: the rays dropped, the rays a seam)', () => {
  const R = RADIANCE_R;
  const ring = Array.from({ length: 48 }, (_, i) => radAt(0, at(R, (i / 48) * Math.PI * 2)));
  assert.ok(ring.every((c) => lum(c) > 1.2), `whole: every bearing lit (${Math.min(...ring.map(lum)).toFixed(2)} the dimmest)`);
  for (const c of ring) assert.ok(gold(c), `golden round the ring: ${c.slice(0, 3).map((x) => x.toFixed(2))}`);
  assert.equal(ring[0][3], 1, 'alpha 1 under ONE, ONE: the light is ADDED');
  assert.ok(lum(radAt(0, at(0.1, 0.4))) > 0.6, 'the pool bright at the feet');
  for (let i = 0; i < 12; i++) assert.ok(lum(radAt(0, at(RADIANCE_POOL_R + 0.05, (i / 12) * Math.PI * 2))) < 0.05, 'dark past the pool\'s reach');
  assert.throws(() => radAt(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8]), GlslDiscard, 'the quad\'s corners are round');
  // the rays: round the pool past the ring, beams and gaps
  const rays = Array.from({ length: 240 }, (_, i) => lum(radAt(0, at(R + 0.22, (i / 240) * Math.PI * 2))));
  assert.ok(Math.max(...rays) > 2.5 * Math.min(...rays), `beams and gaps round the pool (${Math.min(...rays).toFixed(3)} to ${Math.max(...rays).toFixed(3)})`);
  let crossings = 0; const mid = (Math.max(...rays) + Math.min(...rays)) / 2;
  for (let i = 0; i < 240; i++) if ((rays[i] - mid) * (rays[(i + 1) % 240] - mid) < 0) crossings++;
  assert.equal(crossings, 2 * RADIANCE_RAYS, `${RADIANCE_RAYS} beams round`);
  for (const r of [R, R + 0.05, R + 0.22, 0.3]) {
    const a = radAt(0, [-r, 1e-7]), b = radAt(0, [-r, -1e-7]);
    assert.ok(Math.abs(lum(a) - lum(b)) < 1e-3, `no seam at ${r}: ${lum(a)} vs ${lum(b)}`);
  }
  for (let i = 0; i < 12; i++) {
    const p = at([0.2, R, R + 0.1, R + 0.25][i % 4], i * 0.61);
    assert.ok(Math.abs(lum(radAt(0, p, { t: 0 })) - lum(radAt(0, p, { t: AURA_CLOCK_PERIOD }))) < 1e-6, `the ground at the wrap is the ground at zero (${p.map((x) => x.toFixed(2))})`);
  }
  assert.equal(lum(radAt(0, at(R, 1.0), { kindle: 0 })), 0, 'unkindled: nothing');
  assert.ok(lum(radAt(0, at(R, 1.0), { world: [0, 0, 400], fog: { density: 0.01 } })) < lum(radAt(0, at(R, 1.0))) * 0.1, 'the fog thins it');
});

test('PRIMARCH the radiance\'s column, the shader RUN: light ROUND the body - faint where the eye looks across it, bright at its two edges, from every side; whole to the chest and gone at its top; shafts climbing it; motes rising at their places; never from inside it (the wearer\'s first person: no gold veil, only motes, dimmer); kindled UP from the feet; the wrap whole and no seam; the vertex half stands it at the column\'s radius to its height (mutants: the edge law turned round, the inside fade dropped, the kindling dropped, the motes dropped)', () => {
  // the rim: an eye in front (+z) - the column's face across the body (u 0.25, its normal toward the eye) against its
  // two edges (u 0 and 0.5, normal square to the line of sight), at the chest; and the same from the side and behind
  for (const [eye, across, edges] of [[[0, 1.2, 5], 0.25, [0, 0.5]], [[5, 1.2, 0], 0, [0.25, 0.75]], [[0, 1.2, -5], 0.75, [0, 0.5]]]) {
    let face = 0, rim = 0;
    for (const t of [1.5, 4.5, 8.5, 33.5]) {
      face += lum(wallAt(across, 0.5, { eye, t }));
      rim += Math.min(...edges.map((u) => lum(wallAt(u, 0.5, { eye, t }))));
    }
    assert.ok(rim > 3 * face, `bright at its edges, faint across the body, from ${eye} (${(rim / 4).toFixed(3)} vs ${(face / 4).toFixed(3)})`);
  }
  // up the column at an edge: whole to the chest, gone at the top - summed round both edges and four moments
  const upAt = (v) => [1.5, 4.5, 8.5, 33.5].reduce((s, t) => s + lum(wallAt(0, v, { t })) + lum(wallAt(0.5, v, { t })), 0);
  assert.ok(upAt(0.5) > 0.6 * upAt(0.05), `whole to the chest (${upAt(0.5).toFixed(2)} vs ${upAt(0.05).toFixed(2)} at the foot)`);
  assert.ok(upAt(0.995) < 0.05 * upAt(0.05), `gone at the top (${upAt(0.995).toFixed(3)})`);
  // shafts: round an edge's band the light varies - streaks, not a sheet
  const band = Array.from({ length: 48 }, (_, i) => lum(wallAt(i / 480 - 0.05, 0.3, { t: 6.25 })));
  assert.ok(Math.max(...band) > 1.4 * Math.min(...band), `shafts in it (${Math.min(...band).toFixed(3)} to ${Math.max(...band).toFixed(3)})`);
  // the motes: each where the law puts it - the shader's hashes in JS - bright on its point against a hand's breadth
  // beside it, on the column's face across the body, where the glow is faint
  const fract = (x) => x - Math.floor(x);
  const t = 7.75;
  let shown = 0;
  for (let m = 0; m < RADIANCE_MOTES; m++) {
    const h1 = fract(Math.sin(m * 63.71 + 2.3) * 43758.5453), h2 = fract(Math.sin(m * 27.13 + 5.9) * 24634.6345);
    const mv = fract(t * RADIANCE_HZ.mote * (1 + (m % 3)) + h2);
    if (mv < 0.15 || mv > 0.85) continue;   // kindling off the ground or all but gone: not judged
    const on = lum(wallAt(h1, mv, { t })), beside = lum(wallAt(h1 + 0.03, mv, { t }));
    assert.ok(on > beside + 0.25, `mote ${m} lit at its place (${on.toFixed(3)} vs ${beside.toFixed(3)} a hand beside)`);
    shown++;
  }
  assert.ok(shown >= 6, `enough motes aloft to judge (${shown})`);
  // from inside it: the eye on the axis - the column's glow gone, the motes dimmer
  const inside = { eye: [0, 1.65, 0] }, out = { eye: [0, 1.65, 4] };
  let veil = 0, seen = 0;
  for (const [u, vv] of [[0.25, 0.5], [0.3, 0.4], [0.2, 0.7], [0.75, 0.5], [0, 0.3], [0.5, 0.6]]) { veil += lum(wallAt(u, vv, inside)); seen += lum(wallAt(u, vv, out)); }
  assert.ok(veil < 0.15 * seen, `no gold veil from inside it (${veil.toFixed(3)} against ${seen.toFixed(3)} from outside)`);
  // AUDIT 3 (2026-10-05): inside is INSIDE - over its axis but high above its top (a balcony, a high camera), the eye is
  // outside it, and the column shows; it faded by the distance across the ground alone
  let over = 0;
  for (const [u, vv] of [[0.25, 0.5], [0.3, 0.4], [0.2, 0.7], [0.75, 0.5], [0, 0.3], [0.5, 0.6]]) over += lum(wallAt(u, vv, { eye: [0, 7, 0.05] }));
  assert.ok(over > 4 * veil + 0.05, `seen from high over it (${over.toFixed(3)} against ${veil.toFixed(3)} from inside)`);
  // kindled up: nothing, then the column to the waist and not past it
  assert.equal(lum(wallAt(0, 0.3, { kindle: 0 })), 0, 'unkindled: nothing');
  assert.ok(lum(wallAt(0, 0.2, { kindle: 0.5 })) > 0.15, 'half kindled: the column at the knee');
  assert.equal(lum(wallAt(0, 0.8, { kindle: 0.5 })), 0, 'and not yet at the shoulder');
  // the wrap and the seam
  for (let i = 0; i < 12; i++) {
    const [u, vv] = [i / 12 + 0.013, (i % 5) / 5 + 0.05];
    assert.ok(Math.abs(lum(wallAt(u, vv, { t: 0 })) - lum(wallAt(u, vv, { t: AURA_CLOCK_PERIOD }))) < 1e-6, 'the column at the wrap is the column at zero');
  }
  assert.ok(Math.abs(lum(wallAt(1e-7, 0.3, { eye: [5, 1.2, 0.001] })) - lum(wallAt(1 - 1e-7, 0.3, { eye: [5, 1.2, 0.001] }))) < 1e-3, 'the column closes round itself');
  // the vertex half: the column's foot on its radius, its top RADIANCE_H up
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const vs = (aP) => { const f = glslFunctions(AURA_VS, { aP, uVP: I, uKind: 1, uAt: [10, 2, -4], uGroundR: AURA_GROUND_R, uRingR: RADIANCE_R, uFlameH: RADIANCE_H, uLift: AURA_LIFT_M }); f.main(); return f.globals.vWorld; };
  const near = (p, q) => p.every((x, i) => Math.abs(x - q[i]) < 1e-9);
  assert.ok(near(vs([0.25, 0]), [10, 2 + AURA_LIFT_M, -4 + RADIANCE_R]), 'the column\'s foot on its radius');
  assert.ok(near(vs([0.25, 1]), [10, 2 + AURA_LIFT_M + RADIANCE_H, -4 + RADIANCE_R]), 'its top past the crown');
});

test('PRIMARCH the radiance\'s draw: each wearer in its own look - the fire, the ward, the radiance - the radiance\'s kind, radius and height set beside its place, its ground and its column drawn and no symbols; one program for the three (mutants: the look\'s kind)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12 }, {
    get(tg, k) {
      if (k in tg) return tg[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const r = new AuraRingRenderer(gl);
  assert.equal(calls.filter((c) => c[0] === 'createProgram').length, 1, 'one program for the three auras');
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  r.draw([{ at: [1, 0, 1], aura: 'radiance' }, { at: [5, 0, 5], aura: 'oblivionward' }, { at: [9, 0, 9], aura: 'dagonfire' }], I, I, [0, 0, 0], 10);
  assert.equal(r.drawn, 3);
  const per = (name, kind) => calls.filter((c) => c[0] === kind && c[1] === name).map((c) => c[2]);
  assert.deepEqual(per('uAura', 'uniform1i'), [0, 1, 2], 'farthest first (SHADOW-CLOAK AUDIT): the fire, the ward, the radiance');
  assert.deepEqual(per('uRingR', 'uniform1f'), [AURA_RING_R, WARD_RING_R, RADIANCE_R], 'each at its own radius');
  assert.deepEqual(per('uFlameH', 'uniform1f'), [0.62, WARD_WALL_H, RADIANCE_H], 'each wall at its own height');
  const draws = calls.filter((c) => c[0] === 'drawArrays').map((c) => c[3]);
  assert.deepEqual(draws, [6, AURA_STEPS * 6, 6, AURA_STEPS * 6, WARD_GLYPHS * 6, 6, AURA_STEPS * 6], 'the fire\'s two; the ward\'s three; the radiance\'s ground and column, no symbols');
  const seen = []; let kind = null;
  for (const c of calls) {
    if (c[0] === 'uniform1i' && c[1] === 'uAura') kind = c[2];
    if (c[0] === 'drawArrays') seen.push(kind);
  }
  assert.deepEqual(seen, [0, 0, 1, 1, 1, 2, 2], 'each wearer\'s draws in its own look');
  assert.ok(calls.some((c) => c[0] === 'uniform3f' && c[1] === 'uAt' && c[2] === 1 && c[4] === 1), 'the radiance\'s feet set - the axis its column stands on');
  assert.equal(calls.filter((c) => c[0] === 'useProgram').length, 1, 'the program bound once for the frame');
});
