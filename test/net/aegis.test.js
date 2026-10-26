// AEGIS — SUREME'S OWN: THE AEGIS OF OBLIVION, ITS GLYPH, AND THE OBLIVION WARD (2026-10-03).
//
// The owner: "For the account named Sureme ... We are going to develop a title, glyph and new custom aura for this
// user. Title: Aegis of Oblivion. Theme: Purple" - with Sureme's three references: a Path of Exile sigil for the glyph
// ("this symble is from path of exile, i play that game alot" - three pillars through a ring over a black splash), and
// two Path of Exile ground marks for the aura ("i want one that is a full circle", "but with some stuff like this one" -
// a whole violet circle, and broken arcs of runic script). The handle list grants all three together (TIER_LISTS,
// TIER_GLYPH and TIER_AURA, the first aura held by a list rather than bought); the title is a violet gradient
// (ui/playerBadge.js says what was tried beside it), the glyph is the reference drawn after it, and the aura is the
// second look of the aura pass (render/auraRing.js AURA_LOOK) - its shader RUN here, as the fire's is.
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
  titlePaint, badgeCss,
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
  AURA_LOOK, auraLookOf, AURA_RING_R, AURA_FLAME_H, AURA_GROUND_R, AURA_LIFT_M, AURA_STEPS, AURA_CLOCK_PERIOD, AURA_VS,
  AURA_FS, WARD_RING_R, WARD_RUNE_R, WARD_WALL_H, WARD_RUNES, WARD_SIGILS, WARD_TICKS, WARD_MOTES, WARD_HZ, WARD_FLOW,
  WARD_SCRIPT, WARD_RGB, wardRatesWhole, AuraRingRenderer, WARD_GLYPHS, WARD_GLYPH_LIFE, WARD_GLYPH_RISE, WARD_GLYPH_W,
  WARD_GLYPH_H, auraGlyphCards,
} from '../../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
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
const lumOf = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
/** A violet: blue the most, red over green, its hue between the Apostle's periwinkle and the Hierophant's rose. */
const violet = (c) => c[2] >= c[0] && c[0] > c[1] && hueOf(c) > 260 && hueOf(c) < 300;

// ── the fake document (herald.test.js's shape) ──
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

test('AEGIS vocabulary: the title and the glyph join the closed lists last, the aura joins AURAS after Dagon\'s Fire; "Aegis of Oblivion" and "Oblivion Ward" in words; a gradient out of the void into the ward\'s light - three violets, darkest first - edged in black, its middle the title\'s one colour and the glyph\'s; no other title\'s colour, apart from the Apostle\'s and the Protector\'s purples; the tendrils darker than the word; a classic mark of its own (mutants: the gradient turned round; the glyph in another colour; the edge dropped; a mark another glyph has)', () => {
  assert.deepEqual(TITLES.slice(-37, -31) /* PIN MOVED (KETCH): the Skyfarer joined the list last */ /* PIN MOVED (WITCH1): Witchwarden and Hearthkeeper joined the list last */ /* PIN MOVED (STAR8): the Starwarden joined the list after the questlines' five, before the festival's two */,   /* PIN MOVED (QL12): the questlines' five joined the list last, after the WikiMaid */   /* PIN MOVED (EG-E2, the merges of main): the Spire's thirteen after the Coilbreaker */   /* PIN MOVED (SERPENT5): Coilbreaker joined the list last */   /* PIN MOVED (KG6): the Grandmaster after it */   /* PIN MOVED (LAMP-KEEPER II): I Love Lamp joined the list last, after them */ ['aegis', 'primarch', 'crystalfist', 'hourbreaker', 'hoursfirst', 'iliacchampion'], 'the vocabulary\'s newest when it came - PRIMARCH\'s after it, CRYSTAL-FIST\'s after that, SD9b\'s Hourbreaker, then HOURS-FIRST\'s Hour\'s First (PIN MOVED), CARDS10\'s Iliac Champion after that at the merge (PIN MOVED) - the Chapters\' five after them (CHAP4c, CHAP6e, PIN MOVED)');   // PIN MOVED (WIKIMAID): the WikiMaid joined the list last
  assert.deepEqual(GLYPHS.slice(-4, -1), ['aegis', 'primarch', 'crystalfist']);   // PIN MOVED (WIKIMAID): the WikiMaid's rabbit joined the list last
  assert.deepEqual([...AURAS], ['dagonfire', 'oblivionward', 'radiance', 'shadowcloak', 'seraphwings', 'resonance', 'turninghour', 'firsthour', 'maelstrom', 'beaconlight', 'burningstair', 'firstlight', 'lilacwarren', 'witchfire'], /* PIN MOVED (WITCH1): Witchfire joined the list last */ 'the Broker\'s fire, then the ward - PRIMARCH\'s radiance after it, SHADOW-CLOAK\'s cloak after that, SERAPH-WINGS\' wings after that, CRYSTAL-FIST\'s resonance after them (PIN MOVED) (PIN MOVED: SD9c\'s Turning Hour last) (PIN MOVED: EG-E2\'s three, the Spire\'s, after it)');   // PIN MOVED (WIKIMAID): the Lilac Warren joined the list last
  assert.equal(TITLE_TEXT.aegis, 'Aegis of Oblivion', 'the owner: "Title: Aegis of Oblivion"');
  assert.equal(AURA_TEXT.oblivionward, 'Oblivion Ward');
  assert.equal(GLYPH_LABEL.aegis, 'Aegis of Oblivion', 'named on the account card');
  const stops = TITLE_GRADIENT.aegis;
  assert.deepEqual(stops.map(cssRgba), ['#7030e0', '#b24dff', '#ecdcff'], 'the void\'s violet, the ward\'s, the light at the aegis\'s edge');
  for (const s of stops) assert.ok(violet(s), `every stop a violet - "Theme: Purple": ${cssRgba(s)} at ${hueOf(s).toFixed(1)} degrees`);
  assert.ok(lumOf(stops[0]) < lumOf(stops[1]) && lumOf(stops[1]) < lumOf(stops[2]), 'out of the void into the light: darkest first');
  assert.equal(TITLE_RGBA.aegis, stops[1], 'the colour a face that cannot draw a gradient uses is the middle');
  assert.deepEqual(TITLE_EDGE.aegis, [0, 0, 0, 1], 'edged in black - its lilac end is bright');
  assert.equal(new Set(TITLES.map((t) => cssRgba(TITLE_RGBA[t]))).size, TITLES.length, 'no two titles share a colour');
  for (const other of ['apostle', 'protector', 'hierophant']) {
    assert.ok(Math.abs(hueOf(TITLE_RGBA.aegis) - hueOf(TITLE_RGBA[other])) > 6, `apart from the ${other}'s purple`);
  }
  assert.ok(Math.max(...TITLE_RGBA.aegis.slice(0, 3)) > Math.max(...TITLE_RGBA.protector.slice(0, 3)), 'brighter than the Protector\'s royal purple');
  assert.equal(GLYPH_RGBA.aegis, TITLE_RGBA.aegis, 'the pillars and the ring in the title\'s own violet - the two halves of one grant cannot drift');
  assert.equal(GLYPH_GRADIENT.aegis, undefined, 'a stroked glyph, not a filled gradient');
  assert.equal(GLYPH_STROKE.aegis, true);
  assert.ok(violet(GLYPH_DETAIL.aegis.rgba), 'the tendrils a violet too');
  assert.ok(stops.every((s) => lumOf(GLYPH_DETAIL.aegis.rgba) < lumOf(s)), 'and darker than any stop of the word - the reference\'s black splash');
  assert.equal(GLYPH_MARK.aegis, 'O', 'the ring - and Oblivion\'s initial');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, marks.length, 'a classic mark of its own');
  assert.ok(GLYPH_MARK.aegis.charCodeAt(0) >= FONT_GLYPH_MIN && GLYPH_MARK.aegis.charCodeAt(0) <= FONT_GLYPH_MAX, 'inside the font');
  for (const a of AURAS) assert.ok(AURA_TEXT[a] && TITLES.includes(AURA_PAINT[a]), `every aura has a word and a title's paint for its button: ${a}`);
  assert.equal(AURA_PAINT.oblivionward, 'aegis', 'the ward in the Aegis of Oblivion\'s own violets');
  assert.equal(AURA_PAINT.dagonfire, 'gatebreaker', 'the fire in the Gatebreaker\'s, as before');
  const badge = titleBadge({ title: 'aegis' });
  assert.deepEqual({ text: badge.text, rgba: badge.rgba, gradient: badge.gradient, edge: badge.edge }, { text: 'Aegis of Oblivion', rgba: stops[1], gradient: stops, edge: TITLE_EDGE.aegis });
  assert.deepEqual(readBadge({ title: 'aegis', glyphs: ['aegis'] }), { title: 'aegis', glyphs: ['aegis'] }, 'the wire keeps it');
  assert.equal(readAura({ au: 'oblivionward' }), 'oblivionward', 'and the aura');
  assert.deepEqual(badged({ id: 'p1' }, { title: 'aegis', au: 'oblivionward' }), { id: 'p1', title: 'aegis', au: 'oblivionward' });
  assert.deepEqual(glyphBadges({ glyphs: ['aegis', 'sprout'] }).map((b) => b.key), ['sprout', 'aegis'], 'drawn in the vocabulary\'s order');
});

/** The glyph's strokes: each subpath of M, V and A (the ring's two half-ellipses), as points. */
const strokesOf = (d) => d.split(/(?=M)/).map((sub) => {
  const pts = [];
  let x = 0, y = 0;
  for (const [, cmd, args] of sub.matchAll(/([MVA])([^MVA]*)/g)) {
    const n = args.trim().split(/[\s,]+/).map(Number);
    if (cmd === 'M') [x, y] = n;
    else if (cmd === 'V') [y] = n;
    else { pts.push({ arc: n.slice(0, 2) }); [x, y] = n.slice(5); }
    pts.push([x, y]);
  }
  return pts;
});
/** A path's corner and control points, every number pair in it - the tendrils' outline. */
const pairsOf = (d) => { const n = d.match(/-?\d*\.?\d+/g).map(Number); const out = []; for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]); return out; };

test('AEGIS the glyph\'s shape: Sureme\'s reference - a tall pillar up the middle, a short pillar each side, a wide ring lying across all three below the middle with the side pillars at its two ends, all inside the box with the stroke round it; and the void\'s tendrils hung below the ring, mirrored, reaching out past the side pillars and down to the box\'s foot (mutants: the middle pillar no taller than the sides; the ring off the pillars\' ends; the tendrils over the ring)', () => {
  const strokes = strokesOf(GLYPH_PATH.aegis);
  assert.equal(strokes.length, 4, 'three pillars and the ring');
  const [mid, left, right, ring] = strokes;
  const half = 1.8 / 2;   // the widest stroke any face draws (the chat's 1.8)
  for (const s of [mid, left, right]) {
    assert.equal(s[0][0], s[1][0], 'a pillar stands upright');
    for (const [x, y] of s) assert.ok(x - half >= 0 && x + half <= 16 && y - half >= 0 && y + half <= 16, `inside the box with its stroke: ${x},${y}`);
  }
  assert.equal(mid[0][0], 8, 'the middle pillar on the middle');
  assert.equal(8 - left[0][0], right[0][0] - 8, 'the side pillars either side of it alike');
  const topOf = (s) => Math.min(s[0][1], s[1][1]), footOf = (s) => Math.max(s[0][1], s[1][1]);
  assert.ok(topOf(mid) < topOf(left) - 4 && topOf(left) === topOf(right), 'the middle pillar risen well over the two short ones');
  // the ring: two half-ellipses from its left end to its right and back, its radii the arcs'
  const [rx, ry] = ring[1].arc;
  const [l, r] = [ring[0], ring[2]];
  assert.deepEqual([ring.at(-1)[0], ring.at(-1)[1]], [...l], 'the ring closes on itself');
  const cx = (l[0] + r[0]) / 2, cy = l[1];
  assert.equal(r[1], cy, 'lying level');
  assert.equal(cx, 8, 'centred on the middle pillar');
  assert.ok(rx > 1.5 * ry, 'a ring seen lying down - well wider than it is tall');
  assert.deepEqual([l[0], r[0]], [left[0][0], right[0][0]], 'the side pillars stand at its two ends');
  assert.ok(cy > 8 && topOf(left) < cy && footOf(left) > cy, 'below the middle, across the side pillars');
  assert.ok(footOf(mid) > cy - ry && footOf(mid) <= cy + ry, 'the middle pillar runs down through it');
  assert.ok(cx - rx - half >= 0 && cx + rx + half <= 16 && cy + ry + half <= 16, 'the ring inside the box too');
  // the tendrils: below the ring's middle, mirrored about the middle, out past the side pillars, down to the foot
  const t = pairsOf(GLYPH_DETAIL.aegis.path);
  assert.ok(t.every(([, y]) => y > cy), 'hung below the ring\'s middle - never over the aegis');
  assert.ok(t.every(([x, y]) => x >= 0 && x <= 16 && y <= 16), 'inside the box');
  const key = ([x, y]) => `${(Math.round(x * 10) / 10).toFixed(1)},${y.toFixed(2)}`;
  const set = new Set(t.map(key));
  for (const [x, y] of t) assert.ok(set.has(key([16 - x, y])), `mirrored about the middle: ${x},${y}`);
  assert.ok(Math.min(...t.map(([x]) => x)) < left[0][0] && Math.max(...t.map(([x]) => x)) > right[0][0], 'reaching out past the side pillars');
  assert.ok(Math.max(...t.map(([, y]) => y)) > 15.5, 'and down to the foot');
});

// ── THE GRANT ───────────────────────────────────────────────────────

test('AEGIS grant: AEGIS_HANDLES names Sureme, and the list grants the title, its glyph AND the Oblivion Ward together, case-folded - the ward first among the auras held, before any the Broker sold; worn while held, and only read off the config (a caller without it reads the Broker\'s alone); a guest and everyone else hold none; no staff command rides it (mutants: the list renamed; the ward without the list; the Broker\'s first)', () => {
  assert.equal(v('AEGIS_HANDLES'), 'Sureme', 'the owner: "For the account named Sureme"');
  assert.equal(TIER_LISTS.aegis, 'AEGIS_HANDLES');
  assert.equal(TIER_GLYPH.aegis, 'aegis');
  assert.deepEqual({ ...TIER_AURA }, { aegis: 'oblivionward', primarch: 'radiance', shadowfang: 'shadowcloak', crystalfist: 'resonance', wikimaid: 'lilacwarren' }, 'the first list that grants an aura - PRIMARCH\'s the second, SHADOW-CLOAK\'s the third, CRYSTAL-FIST\'s the fourth (PIN MOVED)');   // PIN MOVED (WIKIMAID): the WikiMaid's list grants the Lilac Warren
  for (const h of ['Sureme', 'sureme', 'SUREME']) {
    const p = row(h);
    assert.deepEqual(titlesHeld(p, ENV), ['aegis'], `${h}: the title, by name, case-folded`);
    assert.deepEqual(glyphsOf(p, ENV, LATER), ['aegis'], 'and its glyph');
    assert.deepEqual(aurasHeld(p, ENV), ['oblivionward'], 'and the ward');
    assert.equal(equipRefusal('aegis', p, ENV), null);
    assert.equal(auraRefusal('oblivionward', p, ENV), null, 'theirs to wear');
  }
  const sureme = row('Sureme', { title: 'aegis', aura: 'oblivionward' });
  assert.equal(titleWorn(sureme, ENV), 'aegis');
  assert.equal(auraWorn(sureme, ENV), 'oblivionward');
  assert.equal(auraWorn(sureme), undefined, 'without the config, the Broker\'s alone - the ward is a list\'s');
  const both = row('Sureme', { insignia: 'aura:dagonfire', aura: 'dagonfire' });
  assert.deepEqual(aurasHeld(both, ENV), ['oblivionward', 'dagonfire'], 'the list\'s first, then what the Broker sold');
  assert.equal(auraWorn(both, ENV), 'dagonfire', 'a bought fire still worn beside it');
  assert.deepEqual(aurasHeld(both), ['dagonfire']);
  const w = wardrobeOf(sureme, ENV, LATER);
  assert.deepEqual([w.titles, w.title, w.glyphs, w.auras, w.aura], [['aegis'], 'aegis', ['aegis'], ['oblivionward'], 'oblivionward'], 'the account card\'s whole answer');
  const off = { ...ENV, AEGIS_HANDLES: '' };
  assert.deepEqual([titlesHeld(sureme, off), glyphsOf(sureme, off, LATER), aurasHeld(sureme, off)], [[], [], []], 'off the list, all three go');
  assert.equal(auraWorn(sureme, off), undefined, 'and the ward is not worn by a row nobody cleared');
  assert.equal(auraRefusal('oblivionward', sureme, off), 'not-held');
  assert.deepEqual(titlesHeld({ ...sureme, handle: null }, ENV), [], 'a guest holds none');
  assert.deepEqual(aurasHeld({ ...sureme, handle: null }, ENV), []);
  for (const h of ['Diggleborf', 'SirMcMobdon', 'Dutchess', 'SquidKamer', 'Surem', 'Suremee']) {
    assert.ok(!titlesHeld(row(h), ENV).includes('aegis'), `${h} does not hold it`);
    assert.deepEqual(aurasHeld(row(h), ENV), h === 'SirMcMobdon' ? ['shadowcloak', 'seraphwings'] : [], `nor the ward: ${h}`);   // SHADOW-CLOAK (PIN MOVED): the Shadow Fang's list holds its own cloak, and still not the ward; STAFF-PANEL1 (PIN MOVED): and the developer's wings, mob being one (mob, 06:33Z)
    assert.equal(auraRefusal('oblivionward', row(h), ENV), 'not-held');
  }
  assert.equal(isStaff(['aegis']), false, 'a title, a glyph and an aura - not the staff\'s commands');
});

test('AEGIS the service end to end: Sureme registers, holds the title, the glyph and the ward; wears the title and the ward through their doors; the token signs all three; a stranger is refused the ward; off the list, the next token carries none (mutants: the mint reads the aura without the config; the aura door without it; the wardrobe without it)', async () => {
  const { env, call, registered, identityPublic } = await standService({ AEGIS_HANDLES: 'Sureme' });
  const me = await registered('Sureme');
  const mint = async () => {
    const r = await call('/v1/auth/token', {}, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const got = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(got.ok, got.why);
    return { answer: r.body, claims: got.claims };
  };
  let m = await mint();
  assert.ok(m.claims.g.includes('aegis'), 'the glyph is true from the first token');
  assert.equal('au' in m.claims, false, 'held and not worn: no aura signed');
  let r = await call('/v1/account/title', { title: 'aegis' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call('/v1/account/aura', { aura: 'oblivionward' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.auras, r.body.aura, r.body.title], [['oblivionward'], 'oblivionward', 'aegis'], 'the wardrobe answers it worn');
  m = await mint();
  assert.deepEqual([m.claims.t, m.claims.au, m.claims.g.includes('aegis')], ['aegis', 'oblivionward', true], 'all three signed');
  assert.equal(m.answer.aura, 'oblivionward', 'and said beside the token, for my own feet');
  const other = await registered('Stranger');
  r = await call('/v1/account/aura', { aura: 'oblivionward' }, other.secret);
  assert.equal(r.body.error, 'not-held', 'a stranger is refused the ward');
  env.AEGIS_HANDLES = '';
  m = await mint();
  assert.deepEqual(['t' in m.claims, 'au' in m.claims, (m.claims.g ?? []).includes('aegis')], [false, false, false], 'off the list: the next token carries none of the three');
});

test('AEGIS token and relay: a token may carry the title, the glyph and the ward and verifies; every glyph at once still fits; the relay - world160, the one that knows the words - reads all three out of the signature onto the peer\'s row (mutants: the vocabulary without the ward, so the relay refuses the token)', async () => {
  assert.equal(RELAY_VERSION, 'world266', 'PIN MOVED: world266, AUDIT KETCH II (the airship raid: the whole state word carries the wave to five, a sweep by the ship says sw, the number of a voyage is a receipt bound, the last minutes of her crews forty-five, a fight lost after two minutes, the receipts of a fall told before her record goes; world265 on its branch, renumbered past GATE-COURTS at the merge; NOT YET DEPLOYED); PIN MOVED: world265, GATE-COURTS (the night of a gate held in courts of fifty, each seated by the book of the first; NOT YET DEPLOYED); PIN MOVED: world264, REWARD-KILLS (a staff event reward is earned by three kills alone; world258 then world262 on its branch, renumbered past world258-world263 at the merges; NOT YET DEPLOYED); PIN MOVED: world263, HIBERNATE (a quiet cell sleeps, a freeze or mute asks its lease with the door off; world260/world261 on its branch, renumbered past THE FOLD\'s world260, #1281\'s world261 and #1238\'s world262 at the merges); PIN MOVED: world261, EVENT-RULES, BOSS-TRAITS and RAID5 (a realm keeps a death down two minutes for a Resurrect by a friend, SD_REZ_MS; a foe record carries its boss traits bt, its wrath bw and the leader of a raid rl; NOT YET DEPLOYED); PIN MOVED: world259, ASK-LONGER (the word of the company open 30 s, net/eliteGates/egRun.js EG_ASK_MS; world257 on its branch, renumbered past STAFF-EVENT BOSS and KETCH-LONGER at the merge; NOT YET DEPLOYED); PIN MOVED: world258, KETCH-LONGER (the raid retuned: five Watch waves, the wire takes a wave to five; world257 on its branch, renumbered past STAFF-EVENT BOSS at the merge; NOT YET DEPLOYED); PIN MOVED: world257, STAFF-EVENT BOSS (the mini boss stood again when lost, called each time the meter fills, an exact health hp; NOT YET DEPLOYED); PIN MOVED: world256, STAFF-EVENT (staff events: the hub book, a place kill meter, the mini boss; world255 on its branch, renumbered past KETCH at the merge; NOT YET DEPLOYED); PIN MOVED: world255, KETCH (the sky-ketch frame kt in the room of a crew ship, validKetchIn and validKetchOut; world253 on its branch, renumbered past ROCKET1\'s world253 and AUDIT FOE-KEEPS\' world254 at the merge; NOT YET DEPLOYED); PIN MOVED: world254, AUDIT FOE-KEEPS (the open zone kill credit: the word of a fighter that left the zone dying, dd; NOT YET DEPLOYED); PIN MOVED: world253, ROCKET1 (the live event word `rocket`; NOT YET DEPLOYED); PIN MOVED: world252, DECK-POSE (a pose carries its place aboard a boat, validPose `ab`; NOT YET DEPLOYED); PIN MOVED: world251, AUDIT MIXED-PAIR / SPELL-HAND (world249 on its branch, renumbered past STAFF-PANEL5-MONSTERS and HERALD-CARDS at the merge - validPose carries `ah`, the left hand of a pair struck last, so the peers draw a pair in both hands); PIN MOVED: world250, HERALD-CARDS (world243 on its branch, renumbered past PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES, STAFF-PANEL5, AUDIT EG-FALL and STAFF-PANEL5-MONSTERS at the merge - every herald post one card of its family - its title, its facts as fields, its colour - and each family a thread of its own in the world events channel, the relay settings gateThread, serpentThread, sdThread and egThread; net/herald/heraldCard.js joins the bundle); PIN MOVED: world249, STAFF-PANEL5-MONSTERS (the staff panel Monster watch counts monsters whatever grantStrip says, and its batch says measured; NOT YET DEPLOYED; world248 on its branch, renumbered past AUDIT EG-FALL at the merge); PIN MOVED: world248, AUDIT EG-FALL (world240 on its branch, renumbered past GUILD-CAP, SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN, AUDIT PISTOLET, SEA VENTURES and STAFF-PANEL5 at the merge - a felled Elite Breach lord lies where it fell - net/eliteGates/egLords.js egLordHit stops its walk at its fall, egStop; no word changed); PIN MOVED: world247, STAFF-PANEL5 (the staff panel relay release: follow, Message on screen, the feeds, the staff cut, hidden staff, freeze and the staff chat; NOT YET DEPLOYED); PIN MOVED: world246, SEA VENTURES (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges - the Eltheric Ocean ventures, one relay: the hub reads a vault of the deep by its cell, a fall signs its room, the referee judges a broadside); PIN MOVED: world245, AUDIT PISTOLET (the siege referee knows the top of the Dwarven Pistolet - SIEGE_PISTOLET - and a duel shot from the off hand of a pair carries the DUAL terms, `off` on a shot as on a swing; world242 on its branch, renumbered past LEASE1, PARTY-PING and SPAWN-THIN at the merge); PIN MOVED: world244, SPAWN-THIN (the overworld keep drops a quarter of the spawn band; world242 on its branch, renumbered past PARTY-PING world243 at the merge); PIN MOVED: world243, PARTY-PING (validPartyPose carries pg); PIN MOVED: world242, LEASE1 (the hub hands each socket a signed lease, its mute and freeze, and the game hands it to every other room it holds; a lease room takes the hub word from one newer than its own); PIN MOVED: world241, SD-THROUGH (a Hollow realm tells the hub its first soul through the Rift, the record keeps `inAt` - the Way Through; world239 then world240 on its branch, renumbered past FOES-FIRST and GUILD-CAP at the merges); PIN MOVED: world240, GUILD-CAP (a guild holds 75 - net/guild/guildLaw.js GUILD_MEMBERS_MAX - and the who-of-my-guild list of the hub 100, net/hubShards.js HUB_GUILD_WHO_MAX, both in the bundle of the relay); PIN MOVED: world239, FIELD BUGS 2026-10-21c FOES-FIRST (a foes room spends its budget on full frames first - a delta keeps a reserve, a full frame may borrow a bounded debt, each sender one first a second and its next frame first once unheard four seconds - and counts the blows its hit funnels drop, HIT-DROPS); PIN MOVED: world237, FIELD BUGS 2026-10-20f (an Elite Breach room tells a striker what each blow landed, eland, and a member at the door why it will not take them, efair; the fair trail sees a member standing still - egStillGap; a held lord answers what it lost; world236 on its branch, renumbered past the LONE-HERALD world236 at the merge); PIN MOVED: world236, FIELD BUGS 2026-10-20d LONE-HERALD (the herald news of a Valkynaz Redoubt carries the size of its company and an entrant to lead it, so a company of one is posted alone; world235 on its branch, renumbered past the Witches Festival and the Starfall world235 at the merge); PIN MOVED: world235, WITCH1 (the Witches Festival words in the token - two titles, an aura, a profile icon pi, the festival cards) and STAR3 (the Starfall: a word at a fallen star, the ledger and receipts its cell keeps, the held stars the hub keeps; world233 on its branch, renumbered past world233 (SD-SEA) and world234 (DEX1) at the merge), one release; PIN MOVED: world234, DEX1 (a foe kind on the wire is a u16, FOE_TYPE_MAX, so the enemy mod 256-398 cross; the enemy table in the relay graph takes a mod rows, customEnemies.js joining it; world225 on its branch, renumbered past the world225-world233 of main at the merges); PIN MOVED: world233, SD-SEA (the Abyss Dungeon census never chooses a region with no town to rise by - the sea above all; world226 on its branch); PIN MOVED: world232, FIELD BUGS 2026-10-19f GAUNTLET-PLATES (each Gauntlet plate said one by one; world224 on its branch, renumbered past world224 to world231 on main at the merges); PIN MOVED: world231, NAME-WORDS (net/nameFilter.js reads `prostitute` and `strangler` anywhere in a word); PIN MOVED: world230, OW-CHASE-RANGE (the chase words beside a traveller mark, bd and sr; world224, then world225, on its branch, renumbered past world224 to world229 of main at the merges); PIN MOVED: world229, WB14 (the Breach portents - the portents of a night on the fight and in its state, `pt`; its crossings by walkway, `xa`; GATE_BRAIN_V 6; the new arsenal, the Vanguard and the Sundering; world223, world224, world225, world226, world227, then world228, on its branch, renumbered past FOE-BOUNDS and GRANT-DOOR, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES, PLAIN-SWEEP, and QL12 at the merges); PIN MOVED: world228, QL12 (the five questline titles join the vocabulary, net/identityToken.js TITLES; world222 on its branch, renumbered past GATE-DOOR, FOE-BOUNDS, LAYERED-GEAR and VOICE2, GAUNTLET-SLAIN, LORD-SHARES and PLAIN-SWEEP, world222 to world227, at the merges); PIN MOVED: world227, PLAIN-SWEEP (words only - the player-facing lines in the relay\'s bundle said plainly; world224 on its branch, renumbered past LAYERED-GEAR\'s world224, GAUNTLET-SLAIN\'s world225 and LORD-SHARES\' world226 at the merges); PIN MOVED: world226, FIELD BUGS 2026-10-19e LORD-SHARES (a Spire lord is stood for the company on the plate of its hall and keeps what the fallen leave; world225 on its branch, renumbered past the world225 of GAUNTLET-SLAIN at the merge; no word on the wire changed); PIN MOVED: world225, GAUNTLET-SLAIN (a slain Gauntlet Caster silences its pillar); PIN MOVED: world224, LAYERED-GEAR and VOICE2 (validLook keeps a look\'s `lg`, the On foot Layered Gearing Skin; the voice pass\'s words in the relay\'s own text; world218 in the package, renumbered past world218-world223 at the merge); PIN MOVED: world223, FOE-BOUNDS and GRANT-DOOR (world219 on its branch, renumbered past the world219 to world222 of main at the merges; a tally says stats, the relay counts what no builder could give, a hello says its spawn grants, and a door asks for them); PIN MOVED: world222, GATE-DOOR and COURT-WATCH (a gate court and its copies admit GATE_HELLO_HZ_MAX hellos a second, a full court keeps its watchers; world218 on its branch, renumbered past GRANT2, EG-PERFECT and FIELD BUGS 2026-10-18d and 2026-10-18f at the merge); PIN MOVED: world221, FIELD BUGS 2026-10-18f (the strike rule one law on both ends, a woken lord said at once, each body with its radius beside its row; world219 on its branch, renumbered past EG-PERFECT and FIELD BUGS 2026-10-18d at the merge); PIN MOVED: world220, FIELD BUGS 2026-10-18d (TWIN-REKINDLE: a Sapper never feeds a fallen lord; BANNER-SHAFT: a shaft or a spell lands on a body of another storey through open air; DUEL-RING: a Challenge in the open said as one); PIN MOVED: world219, EG-PERFECT (the lords\' blows fair and whole, spec law 10 THE BROKEN WAY, the ways as proven); PIN MOVED: world218, GRANT2 (the spawn grant asked of a cell, minted and measured); PIN MOVED: world217, GROUND-GATE (a hello on an older ground refused in a ground room while groundGate is on); PIN MOVED: world215, SAFE (the chat safety arc and its audit - every chat line stamped, a new voice paced, the reviewer feed, the ban order that closes and refuses, the law door; world214 on its branch, renumbered past WIKIMAID at the merge); PIN MOVED: world214, WIKIMAID (the WikiMaid title, its glyph and the Lilac Warren join the token vocabulary); PIN MOVED: world213, EG-PLAY (the room of an Elite Breach - the hub opening it and calling its company, its halls and their director, its own fight, its receipts; world195 on its branch, renumbered past COATS1, CHAT-LANG, BAL8, SPAWN-REBIRTH, AUDIT ETHER-OW, PEER-ACTS, CHAT-TRADE, FIVE-ASKS, KG-SET, KG5, PVP-LOOT + QUEST-HOME, SERPENT5, ONE-BODY, INSTANCES, WEAPON-GLOW1, HUB-PULL + DO-ASK, TIDY2 and REZ-BLOODLINE + GRAVE-PARTY at the merges); PIN MOVED: world212, REZ-BLOODLINE + GRAVE-PARTY (FIELD BUGS 2026-10-16b; world211 on its branch, renumbered past the TIDY2 world211 of main at the merge - a party pose says a body fallen for good, `fg`, and a Resurrect at it is refused before the caster spends; a cell keeps the graves searched in it, the overworld ledger kind gr, so a party shares a headstone search; world208 on each branch, then world210 on this one, renumbered past main\'s INSTANCES world208, WEAPON-GLOW1 world209 and HUB-PULL + DO-ASK world210 at the merges); PIN MOVED: world211, TIDY2 (the relay files into feature folders - no behaviour moved; bible/01-Overview/Code-Map.md; world209 on its branch, renumbered past the WEAPON-GLOW1 world209 and the HUB-PULL + DO-ASK world210 of main at the merge); PIN MOVED: world210, HUB-PULL + DO-ASK (the bus never calls a shard - each shard polls its bus; the Worker asks a room reset before it ran once more; world208 then world209 on its branch, renumbered past the INSTANCES world208 and the WEAPON-GLOW1 world209 of main at the merges); PIN MOVED: world209, WEAPON-GLOW1 (a weapon in a hand carries its glow on the look, a word; world208 on its branch, renumbered past the INSTANCES world208 of main at the merge); PIN MOVED: world208, INSTANCES (an instance is a world room of its own - a dungeon whole or a building, its owner and epoch after it, admitted to its owner, staff and the party of its owner alone; world206 then world207 on its branch, renumbered past SERPENT5 and ONE-BODY at the merges); PIN MOVED: world207, ONE-BODY (FIELD BUGS 2026-10-15c - one body an account in a cell or a dungeon, the older socket closed as replaced; world206 on its branch, renumbered past the SERPENT5 world206 of main at the merge); PIN MOVED: world206, SERPENT5 (Coilbreaker and The Maelstrom join the token vocabulary; world205 on its branch, renumbered past PVP-LOOT + QUEST-HOME world205 of main at the merge); PIN MOVED: world205, PVP-LOOT + QUEST-HOME (the friend law is the law of the drop alone - the worn piece a killer picks is theirs whoever the guild or party of the fallen counts them; the hub fans a home the service signed as moved to every page online and holds its word for a page that joins after; bible/01-Overview/bugs/Field-Bugs-2026-10-14.md QUEST-HOME; world201 on each branch, one bump past FIVE-ASKS at the merge, world203 on the integration, renumbered past KG-SET world203 and KG5 world204 at the merge of main); PIN MOVED: world204, KG5 (the relay runs The King\'s Gambit - a gambit frame, four files more in the bundle; KG6: the gold table\'s stakes and a rated game\'s signed result; world203 on its branch, renumbered past FIVE-ASKS\'s world202 at the merge); PIN MOVED: world203, KG-SET (the Iliac catalog without its words, and nine cards more - Kings-Gambit.md section 10.3; world201 then world202 on its branch, renumbered past CHAT-TRADE\'s world201 and FIVE-ASKS\'s world202 at the merges); PIN MOVED: world202, FIVE-ASKS (the dungeon respawn half an hour, I Love Lamp a title the relay knows; world201 on its branch, renumbered past the CHAT-TRADE world201 of main at the merge); PIN MOVED: world201, CHAT-TRADE (the Trade and LFG channels joined CHAT_ROOMS); PIN MOVED: world200, PEER-ACTS (the pose carries a gathering act - the act, its beats and the throw of the net; world199 on its branch, renumbered past the AUDIT ETHER-OW world199 of main at the merge); PIN MOVED: world199, AUDIT ETHER-OW C2-1 (one home for the ground the Watch mints on - watchPixelOk, its answers as they were); PIN MOVED: world198, SPAWN-REBIRTH (a cell keeps the row of a spawned dungeon until it stands again, never sixty real days); PIN MOVED: world197, BAL8 (the PvP referee and its one harm ceiling - every fighter, blows and casts together at most 180 in any 5 s); PIN MOVED: world196, CHAT-LANG (the language channels joined the whitelist) over world195, COATS1 (the horse look: rc on a mounted pose, hc on a parked word; world194 on its branch, renumbered past SLIM-FRAME at the merge); PIN MOVED: world194, SLIM-FRAME (the place on the second wire in its own units - every height in meters to the centimetre, the x and z of a dungeon, a town and a building too, those of a cell in whole world units); PIN MOVED: world193, SERPENT4 (the sea serpent reworked - its waters open until it dives, hands strike it with their own weapons, a party shares the kill, its girth; its law version 3 - world192 on its branch, renumbered past SCALE5c at the merge); PIN MOVED: world192 (past WARDEN1, world191 on main, at the merge), SCALE5c (the hub split sixteen ways - the shards hold the sockets, the bus runs every law over a virtual socket for each; a search of everyone online by name, and the guild online on every shard); PIN MOVED: world191, SCALE5b (the second wire - batched slim poses, a channel roster and a beat in one frame - the relay hygiene, its metrics and run-time settings, the halo referee word); PIN MOVED: world190, AUDIT MW-NPC II (the foe look on the wire - world188, then world189, on its branch, renumbered past INT11-INT14 and SCALE5a at the merges); PIN MOVED: world189, SCALE5a (the hub\'s hello and leave without a walk of every socket; a busy refusal\'s token unread); PIN MOVED: world188, INT11-INT14 (the INTEGRITY arc\'s lane 3 - world186 on its branch, renumbered past SD-HERALD\'s world186 and WAGONS1\'s world187 at the merge); PIN MOVED: world185, INT7-INT10 (the INTEGRITY arc\'s lane 2 - world183, then world184, on its branch, renumbered past CHAP4c\'s world183 and PERF-RELAY1\'s world184 at the merges); PIN MOVED: world183, CHAP4c (the chapters\' seats\' titles on the token - past THE WROTHGARIAN ZONE\'s world177, TAVERN CARDS\' world178, HOURS-FIRST\'s world179, TAVERN-TABLES\' world180, TV-BEYOND\'s world181 and CARDS10\'s world182 at the merges); AEGIS moved it on (world160): the vocabulary rides the relay\'s bundle; GUILD2 after it (world161, no wire change - PIN MOVED); PRIMARCH after that (world162, the Primarch\'s words - PIN MOVED); SUNBABY1 after it (world163, the sun baby\'s live-event word - PIN MOVED); PARTY-LEAD after that (world164, the hub\'s party.lead act - PIN MOVED); SERPENT1 after it (world165, the serpent frame - PIN MOVED); SERPENT2 after that (world166, the serpent herald - PIN MOVED); SHADOW-CLOAK after it (world167, the cloak\'s word - PIN MOVED); SERAPH-WINGS after it (world168, the wings word - PIN MOVED); AUDIT ARENA-LADDER after that (world169, the arena ladder audit - PIN MOVED); FEUD after that (world170, the foe record\'s wind-ups and a revenant\'s fields - PIN MOVED); CRYSTAL-FIST after it (world171, the Crystal Fist\'s words - world170 on its branch, renumbered past FEUD\'s at the merge - PIN MOVED); WATCH-FIX after it (world172, the watch record names its resident - PIN MOVED); SERPENT3 after that (world173, the sea serpent brain - world171 on its branch, renumbered past CRYSTAL-FIST\'s and WATCH-FIX\'s at the merges - PIN MOVED); LEGACY7 after that (world174, the house on the token and the row - world172 on its branch, renumbered past WATCH-FIX\'s and SERPENT3\'s at the merge - PIN MOVED); TEXT-F1 after that (world175, the words a player types starred - PIN MOVED); SUPER-DUNGEONS after that (world176, a re-laid dungeon\'s room of its own - world171 on its branch, renumbered past CRYSTAL-FIST\'s at one merge and past WATCH-FIX\'s, SERPENT3\'s and LEGACY7\'s at the next - PIN MOVED)');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-sureme', n: 'Sureme', k: 'linked', t: 'aegis', g: ['sprout', 'aegis'], au: 'oblivionward' }, kp.privateKey, { subtle, nowS });
  const got = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(got.ok, got.why);
  assert.deepEqual([got.claims.t, got.claims.g, got.claims.au], ['aegis', ['sprout', 'aegis'], 'oblivionward']);
  assert.equal(claimsValid({ s: 'acct-sureme', n: 'Sureme', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS] }), true, 'every glyph at once still fits');
  assert.equal(claimsValid({ s: 'acct-sureme', n: 'Sureme', k: 'linked', i: nowS, e: nowS + 60, au: 'oblivion' }), false, 'a word the vocabulary does not hold is refused');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'Sureme', title: 'aegis', glyphs: ['aegis'], au: 'oblivionward' });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.deepEqual([seen.title, seen.glyphs, seen.au], ['aegis', ['aegis'], 'oblivionward']);
});

// ── THE FACES ───────────────────────────────────────────────────────

test('AEGIS drawn: over a head the word in its gradient clipped to the letters, edged in black; the glyph\'s pillars and ring stroked in currentColor - the violet, inline - at the face\'s own stroke, the tendrils filled over them in the abyss\'s violet; the account card\'s title, glyph and aura buttons in the violets, each from the skin (mutants: the glyph filled; the ward\'s button in the fire)', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  layer.render({ points: [{ id: 'peer-0001', name: 'Sureme', x: 400, y: 300, scale: 1, title: 'aegis', glyphs: ['aegis'] }] });
  const node = layer.tagFor('peer-0001').node;
  const title = find(node, 'dfname-title');
  assert.equal(title.textContent, 'Aegis of Oblivion');
  assert.equal(title.style.backgroundImage, 'linear-gradient(90deg, #7030e0, #b24dff, #ecdcff)');
  assert.equal(title.style.webkitTextFillColor, 'transparent', 'the gradient clipped to the letters');
  assert.equal(title.style.filter, 'drop-shadow(1px 0 0 #000000) drop-shadow(0 1px 0 #000000) drop-shadow(0 1px 0 #000)', 'edged in black outside each letter');
  assert.deepEqual(titlePaint(titleBadge({ title: 'aegis' })), titlePaint(titleBadge({ title: 'aegis' })), 'one paint');
  assert.equal(find(node, 'dfname-glyphs').children.length, 1, 'the aegis beside the name');
  const [g] = glyphBadges({ glyphs: ['aegis'] });
  const svg = glyphSvgNode(doc, g, 'x-glyph', 1.6);
  assert.equal(svg.style.color, '#b24dff');
  assert.equal(svg.children.length, 2, 'the aegis, and its tendrils');
  const [path, tendrils] = svg.children;
  assert.deepEqual([path.attrs.d, path.attrs.fill, path.attrs.stroke, path.attrs['stroke-width']], [GLYPH_PATH.aegis, 'none', 'currentColor', '1.6'], 'stroked');
  assert.deepEqual([tendrils.attrs.d, tendrils.attrs.fill], [GLYPH_DETAIL.aegis.path, '#4d1a94'], 'the tendrils filled in the abyss');
  for (const rule of [
    '.card button.acttitle.tl-aegis { color: #b24dff; }',
    '.card button.acttitle.tl-aegis .acttitleword { background-image: linear-gradient(90deg, #7030e0, #b24dff, #ecdcff);',
    '.card .acctglyph.gl-aegis .acctglyphart { color: #b24dff; }',
    '.card button.acttitle.actaura.aura-oblivionward { color: #b24dff; }',
    '.card button.acttitle.actaura.aura-oblivionward .actauraword { background-image: linear-gradient(90deg, #7030e0, #b24dff, #ecdcff);',
    '.card button.acttitle.actaura.aura-dagonfire { color: #ff6b14; }',
  ]) {
    assert.ok(badgeCss().includes(rule), rule);
    assert.ok(ENHANCED_CSS.includes(rule), `and it reached the skin: ${rule}`);
  }
});

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
const recorder = () => {
  const runs = [];
  return { runs, drawScreenQuad: () => {}, drawScreenQuadRun: (tex, qs, color) => runs.push({ quads: qs, color }) };
};

test('AEGIS the classic face: the word a letter at a time along the gradient - the void\'s violet first, the light last - over one run of its black edge a pixel down and right, and the name run carries the ring\'s mark (mutants: the mark dropped)', () => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'SUREME', title: 'aegis', glyphs: ['aegis'], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }],
    (q) => [q.x, q.y, q.z], { bodyHeight: () => PEER_HEIGHT });
  const r = recorder();
  const drawn = rp.drawNames(r, FONT, mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)), lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]), 1600, 900, [0, 1.7, 0], 1, (q) => [q.x, q.y, q.z]);
  assert.equal(drawn, 2, 'the name and the title');
  const [name, edge, ...rest] = r.runs;
  assert.equal(name.quads.length, 'SUREME0'.length, 'the name run carries the ring\'s mark');
  assert.deepEqual(edge.color, [0, 0, 0, 1], 'the edge, in black');
  const letters = rest.filter((run) => run.quads.length);
  assert.equal(letters.length, 'AegisofOblivion'.length, 'one run a letter');
  assert.deepEqual(letters[0].color.map((c) => +c.toFixed(3)), [...TITLE_GRADIENT.aegis[0]], '"A" in the void\'s violet');
  assert.deepEqual(letters.at(-1).color.map((c) => +c.toFixed(3)), [...TITLE_GRADIENT.aegis[2]], 'the last "n" in the light');
  for (const l of letters) assert.ok(violet(l.color), `every letter a violet: ${l.color.map((c) => c.toFixed(2))}`);
  assert.ok(edge.quads[0].dst.x > letters[0].quads[0].dst.x && edge.quads[0].dst.y > letters[0].quads[0].dst.y, 'the edge sits down and right of the word');
});

// ── THE WARD (render/auraRing.js) ───────────────────────────────────

test('AEGIS the ward\'s law: a look for every aura in the vocabulary - the fire\'s as it was, the ward\'s wider ring and its veil low; a wearer naming none, or a word no aura has, is the fire; the ward\'s rates whole over the clock; its script twelve runes no two alike, inside its six ornaments; its light the Aegis of Oblivion\'s own (mutants: the script repeating; the ward\'s violet drifted from the title\'s)', () => {
  for (const a of AURAS) assert.ok(Object.hasOwn(AURA_LOOK, a), `a look for ${a}`);
  assert.deepEqual({ ...AURA_LOOK.dagonfire }, { kind: 0, ringR: AURA_RING_R, flameH: AURA_FLAME_H, glyphs: 0 }, 'the fire as it was - no symbols');
  assert.deepEqual({ ...AURA_LOOK.oblivionward }, { kind: 1, ringR: WARD_RING_R, flameH: WARD_WALL_H, glyphs: WARD_GLYPHS }, 'the ward, and its floating symbols');
  assert.equal(auraLookOf(undefined), AURA_LOOK.dagonfire, 'a wearer naming none is the fire - the only aura before');
  assert.equal(auraLookOf('constructor'), AURA_LOOK.dagonfire, 'and never a word off the prototype');
  assert.equal(auraLookOf('oblivionward'), AURA_LOOK.oblivionward);
  assert.ok(WARD_RING_R > AURA_RING_R && WARD_RING_R + 0.2 < AURA_GROUND_R, 'a wider ring than the fire\'s - the reference\'s circle clear of the feet - with its bezel inside the ground quad');
  assert.ok(WARD_RUNE_R < WARD_RING_R - 0.1 && WARD_RUNE_R > WARD_RING_R * 0.7, 'the runes on a ring within it');
  assert.ok(WARD_WALL_H < AURA_FLAME_H, 'a veil to the shins, lower than the fire\'s flames');
  assert.deepEqual([WARD_RUNES, WARD_SIGILS, WARD_TICKS, WARD_MOTES], [12, 4, 48, 14]);
  assert.ok(wardRatesWhole(), 'every ward rate whole over the clock');
  for (const r of [...Object.values(WARD_HZ), ...Object.values(WARD_FLOW)]) assert.ok(Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6), `whole: ${r}`);
  assert.equal(WARD_SCRIPT.length, WARD_RUNES);
  assert.equal(new Set(WARD_SCRIPT).size, WARD_RUNES, 'no two runes alike - writing, not a pattern');
  assert.ok(WARD_SCRIPT.every((b) => Number.isInteger(b) && b >= 0 && b < 64), 'inside the six ornaments');
  for (let k = 0; k < WARD_RUNES; k++) assert.notEqual(WARD_SCRIPT[k], WARD_SCRIPT[(k + 1) % WARD_RUNES], 'no rune beside its twin');
  const rgb = (c) => [...c].slice(0, 3).map((x) => +x.toFixed(3));
  assert.deepEqual(rgb(WARD_RGB.violet), rgb(TITLE_RGBA.aegis), 'the ward\'s violet is the title\'s');
  assert.deepEqual(rgb(WARD_RGB.heart), rgb(TITLE_GRADIENT.aegis[2]), 'its heart the title\'s light');
  assert.deepEqual(rgb(WARD_RGB.abyss), rgb(GLYPH_DETAIL.aegis.rgba), 'its mist the glyph\'s abyss');
});

/** The ward's colour at a point - the shader's own main(), run, with `uAura` the ward's. */
const wardAt = (kind, vP, { t = 13.5, kindle = 1, world = [0, 0, 0], fog = null } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vWorld: world, uKind: kind, uAura: 1, uTime: t, uSeed: 0.37, uKindle: kindle, uRingR: WARD_RING_R, uGroundR: AURA_GROUND_R,
    uFlameH: WARD_WALL_H, uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0],
  });
  f.main();
  return f.globals.o;
};
const lum = (c) => c[0] + c[1] + c[2];
const at = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

test('AEGIS the ward\'s light, the shader RUN: its ring WHOLE - lit at every bearing round the feet - and violet; added onto the frame; dark under the feet and past its bezel, the quad\'s corners round; the runes on their ring broken into words with gaps between, brighter than the stone between the runes and the ring; a claw at each diagonal and none on the axes; no seam behind the wearer; the wrap is zero; unkindled nothing, half kindled half drawn round from behind; the fog thins it (mutants: a gap in the ring; the claws on the axes; the centre\'s mist unfaded; the sweep dropped; a rounded rate)', () => {
  const R = WARD_RING_R;
  const ring = Array.from({ length: 48 }, (_, i) => wardAt(0, at(R, (i / 48) * Math.PI * 2)));
  assert.ok(ring.every((c) => lum(c) > 1.2), `whole: every bearing lit (${Math.min(...ring.map(lum)).toFixed(2)} the dimmest)`);
  let sum = [0, 0, 0];
  for (const c of ring) sum = sum.map((s, i) => s + c[i]);
  assert.ok(violet(sum), `violet round the ring: ${sum.map((x) => (x / 48).toFixed(2))}`);
  const glow = wardAt(0, at(R + 0.02, 1.0));
  assert.ok(violet(glow), `and in the glow beside its white heart: ${glow.map((x) => x.toFixed(2))}`);
  assert.equal(ring[0][3], 1, 'alpha 1 under ONE, ONE: the light is ADDED');
  for (const r of [0, 0.03, 0.06]) assert.ok(lum(wardAt(0, at(r, 0.7))) < 0.02, `dark under the feet (${r} m) - the mist gone where the angle pinches`);
  for (let i = 0; i < 12; i++) assert.ok(lum(wardAt(0, at(R + 0.3, (i / 12) * Math.PI * 2))) < 0.03, 'dark past the bezel');
  assert.throws(() => wardAt(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8]), GlslDiscard, 'the quad\'s corners are round');
  // the runes: their ring broken into words - bright strokes and dark gaps round it - brighter than the stone between
  const runes = Array.from({ length: 360 }, (_, i) => lum(wardAt(0, at(WARD_RUNE_R, (i / 360) * Math.PI * 2))));
  const lit = runes.filter((x) => x > 1).length, dark = runes.filter((x) => x < 0.3).length;
  assert.ok(lit > 360 * 0.5 && dark > 360 * 0.08, `words with gaps between (${lit} lit, ${dark} dark of 360)`);
  const between = Array.from({ length: 36 }, (_, i) => lum(wardAt(0, at((WARD_RUNE_R + R) / 2 + 0.01, (i / 36 + 1 / 72) * Math.PI * 2))));
  assert.ok(Math.max(...runes) > 3 * (between.reduce((a, b) => a + b, 0) / 36), 'the script brighter than the stone between it and the ring');
  // the claws hang inward from the ring at the diagonals, never on the axes
  for (let q = 0; q < 4; q++) {
    const diag = lum(wardAt(0, at(R - 0.035, Math.PI / 4 + (q * Math.PI) / 2))), axis = lum(wardAt(0, at(R - 0.035, (q * Math.PI) / 2)));
    assert.ok(diag > 1.5 * axis && diag > 1, `a claw at the diagonal ${q} (${diag.toFixed(2)} vs the axis's ${axis.toFixed(2)})`);
  }
  // the seam behind the wearer, either side of the angle's closing, on every band
  for (const r of [R, R + 0.05, WARD_RUNE_R, WARD_RUNE_R + 0.03, 0.4]) {
    const a = wardAt(0, [-r, 1e-7]), b = wardAt(0, [-r, -1e-7]);
    assert.ok(Math.abs(lum(a) - lum(b)) < 1e-3, `no seam at ${r}: ${lum(a)} vs ${lum(b)}`);
  }
  assert.ok(Math.abs(lum(wardAt(1, [1e-7, 0.1])) - lum(wardAt(1, [1 - 1e-7, 0.1]))) < 1e-3, 'the veil closes round the ring');
  // the wrap: every band and the veil at the clock's end as at zero
  for (let i = 0; i < 24; i++) {
    const p = at([0.3, 0.6, WARD_RUNE_R, R - 0.03, R, R + 0.05, R + 0.09][i % 7], i * 0.61);
    assert.ok(Math.abs(lum(wardAt(0, p, { t: 0 })) - lum(wardAt(0, p, { t: AURA_CLOCK_PERIOD }))) < 1e-6, `the ground at the wrap is the ground at zero (${p.map((x) => x.toFixed(2))})`);
    const q = [i / 24, (i % 5) / 5];
    assert.ok(Math.abs(lum(wardAt(1, q, { t: 0 })) - lum(wardAt(1, q, { t: AURA_CLOCK_PERIOD }))) < 1e-6, 'and the veil');
  }
  // the veil: standing at the ring's foot, gone by its top
  let root = 0, tip = 0;
  for (let i = 0; i < 32; i++) { root += lum(wardAt(1, [i / 32, 0.04])); tip += lum(wardAt(1, [i / 32, 0.96])); }
  assert.ok(root > 32 * 0.2 && root > tip * 6, `the veil stands off the ring (${(root / 32).toFixed(3)} at the root, ${(tip / 32).toFixed(3)} at the top)`);
  // kindling: nothing, then drawn round from behind the wearer (-x) - the reached half lit, the rest dark
  assert.equal(lum(wardAt(0, at(R, 1.0), { kindle: 0 })), 0, 'unkindled: nothing');
  assert.ok(lum(wardAt(0, at(R, -2.6), { kindle: 0.5 })) > 0.5, 'half kindled: the half it has reached is drawn');
  assert.equal(lum(wardAt(0, at(R, 0.6), { kindle: 0.5 })), 0, 'and the half it has not, not yet');
  const share = (a) => ((a / (2 * Math.PI)) % 1 + 1) % 1;   // the wall's `u`: the ground's angle as a share of a turn
  assert.equal(lum(wardAt(1, [share(0.6), 0.05], { kindle: 0.5 })), 0, 'the veil drawn round with it - not yet over the ground not yet drawn');
  assert.ok(lum(wardAt(1, [share(-2.6), 0.05], { kindle: 0.5 })) > 0.1, 'and standing over the ground that is');
  assert.ok(lum(wardAt(0, at(R, 1.0), { world: [0, 0, 400], fog: { density: 0.01 } })) < lum(wardAt(0, at(R, 1.0))) * 0.1, 'the fog thins it');
  // the vertex half: the veil's foot on the ward's ring, its top WARD_WALL_H up
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const vs = (aP) => { const f = glslFunctions(AURA_VS, { aP, uVP: I, uKind: 1, uAt: [10, 2, -4], uGroundR: AURA_GROUND_R, uRingR: WARD_RING_R, uFlameH: WARD_WALL_H, uLift: AURA_LIFT_M }); f.main(); return f.globals.vWorld; };
  const near = (p, q) => p.every((x, i) => Math.abs(x - q[i]) < 1e-9);
  assert.ok(near(vs([0.25, 0]), [10, 2 + AURA_LIFT_M, -4 + WARD_RING_R]), 'the veil\'s foot on the ward\'s ring');
  assert.ok(near(vs([0.25, 1]), [10, 2 + AURA_LIFT_M + WARD_WALL_H, -4 + WARD_RING_R]), 'its top over it');
});

test('AEGIS the ward\'s draw: each wearer in its own aura\'s look - the fire for one naming none, the ward for the ward - its kind, its ring\'s radius and its wall\'s height set beside its place, and the ward\'s floating symbols a third draw of its own, the fire none; one program for both; the fire\'s pins hold (mutants: the look set once for the frame; the kind never set; the symbols never drawn)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const r = new AuraRingRenderer(gl);
  // PIN MOVED (AURA-SPLIT, #1143): a look is its own program - no program at the build, each look's at its first draw, and a wearer's look the program bound (kindOf)
  assert.equal(calls.filter((c) => c[0] === 'createProgram').length, 0, 'no program at the build');
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  r.draw([{ at: [1, 0, 1] }, { at: [5, 0, 5], aura: 'oblivionward' }, { at: [9, 0, 9], aura: 'dagonfire' }], I, I, [0, 0, 0], 10);
  assert.equal(r.drawn, 3);
  const per = (name, kind) => calls.filter((c) => c[0] === kind && c[1] === name).map((c) => c[2]);
  assert.deepEqual(calls.filter((c) => c[0] === 'useProgram').map((c) => r.kindOf(c[1])), [0, 1, 0], 'the fire, the ward, the fire');
  assert.deepEqual(per('uRingR', 'uniform1f'), [AURA_RING_R, WARD_RING_R, AURA_RING_R], 'each ring at its own radius');
  assert.deepEqual(per('uFlameH', 'uniform1f'), [AURA_FLAME_H, WARD_WALL_H, AURA_FLAME_H], 'each wall at its own height');
  const draws = calls.filter((c) => c[0] === 'drawArrays').map((c) => c[3]);
  assert.deepEqual(draws, [6, AURA_STEPS * 6, 6, AURA_STEPS * 6, WARD_GLYPHS * 6, 6, AURA_STEPS * 6], 'the ground, then the wall, each wearer - and the ward\'s symbols after its wall');
  // what each draw was drawn with: the newest uAura and uRingR set before it
  const seen = []; let kind = null, ringR = null;
  for (const c of calls) {
    if (c[0] === 'useProgram') kind = r.kindOf(c[1]);
    if (c[0] === 'uniform1f' && c[1] === 'uRingR') ringR = c[2];
    if (c[0] === 'drawArrays') seen.push([kind, ringR]);
  }
  assert.deepEqual(seen, [[0, AURA_RING_R], [0, AURA_RING_R], [1, WARD_RING_R], [1, WARD_RING_R], [1, WARD_RING_R], [0, AURA_RING_R], [0, AURA_RING_R]], 'each wearer\'s ground, wall and symbols drawn in its own look');
  const kinds = calls.filter((c) => (c[0] === 'uniform1i' && c[1] === 'uKind') || c[0] === 'drawArrays').map((c) => (c[0] === 'drawArrays' ? `draw${c[3]}` : c[2]));
  assert.deepEqual(kinds, [0, 'draw6', 1, `draw${AURA_STEPS * 6}`, 0, 'draw6', 1, `draw${AURA_STEPS * 6}`, 2, `draw${WARD_GLYPHS * 6}`, 0, 'draw6', 1, `draw${AURA_STEPS * 6}`], 'the symbols drawn as the third kind');
  // PIN MOVED (AURA-SPLIT, #1143): a program a look - bound where the look changes, and handed the frame's uniforms once each
  const boundLooks = calls.filter((c) => c[0] === 'useProgram').map((c) => r.kindOf(c[1]));
  assert.equal(calls.filter((c) => c[0] === 'uniformMatrix4fv' && c[1] === 'uVP').length, new Set(boundLooks).size, 'each look\'s program handed the frame once');
});

// ── THE FLOATING SYMBOLS (the owner: "Can you add like symbols that float and dissipate") ──

/** The symbols' flight, the vertex half's own functions run. */
const flightFns = (bind = {}) => glslFunctions(AURA_VS, { uRingR: WARD_RING_R, uLift: AURA_LIFT_M, uGroundR: AURA_GROUND_R, uFlameH: WARD_WALL_H, ...bind });
/** One symbol card's corner as the vertex half places it: its world point and what it hands the light (`vS`). */
const cardCorner = (k, u, v, { t = 7.5, at = [10, 2, -4], eye = [10, 1.6, 0] } = {}) => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const f = flightFns({ aP: [k * 2 + u, v], uVP: I, uKind: 2, uAt: at, uTime: t, uCamPos: eye });
  f.main();
  return { w: f.globals.vWorld, uv: f.globals.vP, s: f.globals.vS };
};

test('AEGIS the floating symbols\' flight: WARD_GLYPHS cards, each lifting off the ring and climbing to WARD_GLYPH_RISE over it - slowing toward the top, drifting outward, never below the ring - its lives dividing the clock so the flights wrap whole; each flight lifting off a new place round the ring with a new rune, the symbols aloft at once staggered; every card upright and turned to face the eye round the vertical (mutants: the flight not wrapping; every flight from one place; the symbols sinking; the cards facing one way; one rune for every flight)', () => {
  assert.deepEqual([...auraGlyphCards(2)], [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 2, 0, 3, 0, 3, 1, 2, 0, 3, 1, 2, 1], 'two cards: each number twice over plus the corner');
  assert.equal(auraGlyphCards(WARD_GLYPHS).length, WARD_GLYPHS * 12);
  for (const life of WARD_GLYPH_LIFE) assert.equal(AURA_CLOCK_PERIOD % life, 0, `a life of ${life} s divides the clock - the flights wrap whole`);
  assert.ok(WARD_GLYPHS >= 6 && WARD_GLYPH_RISE > 1 && WARD_GLYPH_RISE < 1.6, 'enough aloft to read as many, rising to the chest and no higher');
  const f = flightFns();
  const R = WARD_RING_R;
  for (let k = 0; k < WARD_GLYPHS; k++) {
    // the wrap: the flight is periodic over the clock - a clock past its period is the clock wrapped (auraClock), so the
    // symbol a breath after the wrap is where it would have been had the clock run on
    for (const t of [0.37, 2.9, 61.3, 119.6]) {
      const a = f.wardFlight(k, t), b = f.wardFlight(k, t + AURA_CLOCK_PERIOD);
      assert.ok(a.every((x, i) => Math.abs(x - b[i]) < 1e-6), `symbol ${k} at ${t} s is where it is a clock later: ${a.map((x) => x.toFixed(4))} vs ${b.map((x) => x.toFixed(4))}`);
      assert.equal(f.wardFlightOf(k, t), f.wardFlightOf(k, t + AURA_CLOCK_PERIOD), 'and so is which flight it is');
    }
    // one flight: from the ring up, outward, slowing
    const life = WARD_GLYPH_LIFE[k % 3];
    const t0 = (Math.floor(5 * life) + 1 - ((k * 0.618034) % 1)) * life;   // a flight's first instant (age 0)
    const at = (age) => f.wardFlight(k, t0 + age * life);
    const [x0, y0, z0, w0] = at(0.001), [x1, y1, z1] = at(0.5), [x2, y2, z2, w2] = at(0.99);
    assert.ok(w0 < 0.01 && w2 > 0.98, `the age runs 0 to 1 over the life (${w0}, ${w2})`);
    assert.ok(Math.abs(y0 - AURA_LIFT_M - 0.06) < 0.01, 'it lifts off the ring');
    assert.ok(y0 < y1 && y1 < y2 && Math.abs(y2 - (AURA_LIFT_M + 0.06 + WARD_GLYPH_RISE)) < 0.01, 'and climbs to the top of its flight');
    assert.ok(y1 - y0 > y2 - y1, 'slowing toward the top');
    const r = (x, z) => Math.hypot(x, z);
    assert.ok(Math.abs(r(x0, z0) - 0.9 * R) < 0.01 && r(x0, z0) < r(x1, z1) && r(x1, z1) < r(x2, z2), 'from the ring, drifting outward');
    // its next flights: each from a new place round the ring
    const starts = Array.from({ length: 5 }, (_, n) => { const [x, , z] = f.wardFlight(k, t0 + (n + 0.001) * life); return Math.atan2(z, x); });
    for (let i = 0; i < starts.length; i++) for (let j = i + 1; j < starts.length; j++) assert.ok(Math.abs(Math.atan2(Math.sin(starts[i] - starts[j]), Math.cos(starts[i] - starts[j]))) > 0.05, `symbol ${k}'s flights ${i} and ${j} lift off apart`);
  }
  const ages = Array.from({ length: WARD_GLYPHS }, (_, k) => f.wardFlight(k, 7.5)[3]);
  assert.ok(Math.max(...ages) - Math.min(...ages) > 0.5, `the symbols aloft at once staggered: ${ages.map((x) => x.toFixed(2))}`);
  // the cards: upright, facing the eye round the vertical, at their flight's place, each handing the light its age and rune
  const at = [10, 2, -4];
  for (const eye of [[10, 1.6, 0], [14, 3, -4], [6, 0.5, -9]]) {
    for (let k = 0; k < WARD_GLYPHS; k++) {
      const c00 = cardCorner(k, 0, 0, { at, eye }), c10 = cardCorner(k, 1, 0, { at, eye }), c01 = cardCorner(k, 0, 1, { at, eye }), c11 = cardCorner(k, 1, 1, { at, eye });
      const centre = [0, 1, 2].map((i) => (c00.w[i] + c11.w[i]) / 2);
      const fl = f.wardFlight(k, 7.5);
      assert.ok([0, 1, 2].every((i) => Math.abs(centre[i] - (at[i] + fl[i])) < 1e-9), 'the card centred on its flight\'s place');
      const across = [0, 1, 2].map((i) => c10.w[i] - c00.w[i]), up = [0, 1, 2].map((i) => c01.w[i] - c00.w[i]);
      const toEye = [eye[0] - centre[0], eye[2] - centre[2]], len = Math.hypot(...toEye);
      assert.ok(Math.abs(across[0] * toEye[0] + across[2] * toEye[1]) / len < 1e-9, 'its face turned to the eye: the card runs square across the line to it');
      assert.ok(Math.abs(across[1]) < Math.hypot(across[0], across[2]) * 0.25 && up[1] > Math.hypot(up[0], up[2]) * 3, 'upright, tilting a little');
      const width = Math.hypot(...across), height = Math.hypot(...up);
      assert.ok(width >= WARD_GLYPH_W - 1e-9 && width <= WARD_GLYPH_W * 1.35 + 1e-9 && height >= WARD_GLYPH_H - 1e-9 && height <= WARD_GLYPH_H * 1.35 + 1e-9, 'its size, growing as it fades');
      assert.deepEqual([c00.uv, c11.uv], [[0, 0], [1, 1]], 'the card\'s own uv for the light');
      assert.ok(Math.abs(c00.s[0] - fl[3]) < 1e-9 && c00.s[2] === k && Number.isInteger(c00.s[1]) && c00.s[1] >= 0 && c00.s[1] < WARD_RUNES, 'its age, its rune\'s place in the script, its number');
    }
  }
  const runesNow = new Set(Array.from({ length: WARD_GLYPHS }, (_, k) => cardCorner(k, 0, 0).s[1]));
  assert.ok(runesNow.size >= 4, `many runes aloft at once (${[...runesNow]})`);
  const runesOfOne = new Set(Array.from({ length: 6 }, (_, n) => cardCorner(0, 0, 0, { t: (n + 0.5) * WARD_GLYPH_LIFE[0] }).s[1]));
  assert.ok(runesOfOne.size >= 3, 'and a symbol lifts a new rune each flight');
});

/** A symbol's light at a point of its card - the shader's own main(), run, as the ward's third kind. */
const symbolAt = (uv, age, { rune = 0, k = 3 } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP: uv, vS: [age, rune, k], vWorld: [0, 0, 0], uKind: 2, uAura: 1, uTime: 7.5, uSeed: 0, uKindle: 1, uRingR: WARD_RING_R,
    uGroundR: AURA_GROUND_R, uFlameH: WARD_WALL_H, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0],
  });
  f.main();
  return f.globals.o;
};

test('AEGIS the floating symbols dissipate: the script\'s rune stood on end down the card\'s middle, lit whole as it lifts off and violet; dark at the card\'s edges; faded in from nothing; broken into dust as it climbs - some of the stroke gone and some still lit - and all but gone at the end of its flight; kindled with the ward (mutants: the symbols never fading; no dust)', () => {
  const stroke = Array.from({ length: 13 }, (_, i) => [0.5, 0.2 + i * 0.05]);   // down the rune's baseline, stood on end
  for (const rune of [0, 3, 6]) {
    const young = stroke.map((uv) => lum(symbolAt(uv, 0.2, { rune })));
    assert.ok(young.every((x) => x > 0.6), `rune ${rune} lit whole as it lifts off: ${young.map((x) => x.toFixed(2))}`);
  }
  const c = symbolAt([0.5, 0.5], 0.2);
  assert.ok(violet(c) || (c[2] >= c[0] && c[0] > c[1]), `in the ward's violet: ${c.map((x) => x.toFixed(2))}`);
  for (const uv of [[0.01, 0.01], [0.99, 0.5], [0.5, 0.995], [0.02, 0.98]]) assert.ok(lum(symbolAt(uv, 0.2)) < 0.02, `dark at the card's edge ${uv} - no card seen, only the rune`);
  assert.ok(lum(symbolAt([0.5, 0.5], 0.005)) < 0.1 * lum(symbolAt([0.5, 0.5], 0.2)), 'faded in from nothing as it lifts off');
  // the dust: climbing, the stroke breaks - some of it gone, some still lit
  const mid = stroke.map((uv) => lum(symbolAt(uv, 0.62)));
  assert.ok(mid.some((x) => x < 0.05) && mid.some((x) => x > 0.15), `broken into dust as it climbs: ${mid.map((x) => x.toFixed(2))}`);
  const lastOf = stroke.map((uv) => lum(symbolAt(uv, 0.97)));
  assert.ok(Math.max(...lastOf) < 0.05, `all but gone at the end of its flight: ${Math.max(...lastOf).toFixed(3)}`);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  assert.ok(sum(stroke.map((uv) => lum(symbolAt(uv, 0.2)))) > 2 * sum(mid), 'fading as it goes');
  const f = glslFunctions(AURA_FS, { vP: [0.5, 0.5], vS: [0.2, 0, 3], vWorld: [0, 0, 0], uKind: 2, uAura: 1, uTime: 7.5, uKindle: 0, uRingR: WARD_RING_R, uGroundR: AURA_GROUND_R, uFlameH: WARD_WALL_H, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0] });
  f.main();
  assert.equal(lum(f.globals.o), 0, 'unkindled: no symbols');
});
