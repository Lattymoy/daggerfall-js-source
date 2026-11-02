// BLOOD-OF-COLDHARBOUR — TRAKEL'S OWN: BLOOD OF COLDHARBOUR, ITS ROSE, AND THE VAMPIRIC HAZE (2026-10-30).
//
// For Trakel, a $200 patron (the owner: "All $200 patrons ingame have custom stuff"). Trakel's own words: the title
// "Blood of Coldharbour", "I really like violet and crimson as colors, especially when blended together", a rose glyph
// after their reference, and "a dark violet, smokey haze that drifts around the sprite with more pronounced particles of
// crimson like blood that bubble up from the ground and drift off into daedric runes". The handle list grants all three
// together (TIER_LISTS, TIER_GLYPH and TIER_AURA); the aura is Sage's Smoke's way in Coldharbour's colours - its shader
// RUN here. tools/mutants/coldharbour.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { TITLES, GLYPHS, AURAS, verifyToken } from '../../src/net/identityToken.js';
import {
  TITLE_TEXT, AURA_TEXT, AURA_PAINT, TITLE_RGBA, TITLE_GRADIENT, TITLE_EDGE, GLYPH_RGBA, GLYPH_GRADIENT, GLYPH_DETAIL, GLYPH_MARK,
  GLYPH_PATH, GLYPH_STROKE, FONT_GLYPH_MIN, FONT_GLYPH_MAX, cssRgba, titleBadge, glyphBadges, glyphDetails,
  COLD_LAVENDER, COLD_VIOLET, COLD_CRIMSON, COLD_BLOOD, COLD_ROSE, COLD_SMOKE, COLD_MAGENTA,
} from '../../src/ui/playerBadge.js';
import { GLYPH_LABEL } from '../../src/ui/enhanced/enhancedAccount.js';
import { isStaff } from '../../src/net/staffCommands.js';
import { titlesHeld, glyphsOf, equipRefusal, titleWorn, aurasHeld, auraWorn, auraRefusal, wardrobeOf, TIER_LISTS, TIER_GLYPH, TIER_AURA } from '../../server-account/src/titles.js';
import { readBadge, readAura, badged } from '../../src/net/wire.js';
import { standService } from '../accountDb.mjs';
import {
  AURA_LOOK, AURA_GROUND_R, AURA_CLOCK_PERIOD, AURA_FS, AURA_VS, glyphEdges, SAGE_CARDS,
  HAZE_RUNE_R, HAZE_RUNES, HAZE_RUNE_SCALE, HAZE_WALL_H, HAZE_SCRIPT, HAZE_PUFFS, HAZE_PUFF_A, HAZE_EMBERS, HAZE_EMBER_LIFE, HAZE_EMBER_R,
  HAZE_EMBER_H, HAZE_EMBER_M, HAZE_RUNE_AT, HAZE_CARDS, HAZE_NEAR, HAZE_RGB, hazeRatesWhole, hazePuff, hazeEmber, hazeCardsInto,
} from '../../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
/** The Worker's config as it reads it: every handle list. */
const ENV = Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
const AFTER = 1_900_000_000;
const LATER = AFTER + 30 * 86_400;   // past the sprout's two weeks, so the only glyphs are the grants'
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });
const apart = (a, b) => Math.hypot(...[0, 1, 2].map((i) => (a[i] - b[i]) * 255));
/** A crimson: red well over green and blue. A violet: blue over green, red between. */
const crimson = (c) => c[0] > 0.3 && c[0] > 2.5 * c[1] && c[0] > 1.5 * c[2];
const violet = (c) => c[2] > c[1] && c[0] > c[1] && c[2] >= c[0] * 0.9;

test('BLOOD-OF-COLDHARBOUR vocabulary: the title, the glyph and the aura each join their closed list last; "Blood of Coldharbour" and "Vampiric Haze" in words, the glyph named on the account card; the title crimson into magenta into lavender, edged in black, its one colour the magenta between them, apart from every title\'s; the rose in the lavender, filled; `R` on the classic face; the haze\'s button in the title\'s paint; the wire keeps all three (mutants: the gradient\'s order, the one colour, the mark, the fill, the paint)', () => {
  assert.equal(TITLES.at(-1), 'coldharbour');
  assert.equal(GLYPHS.at(-1), 'coldharbour');
  assert.equal(AURAS.at(-1), 'vampirichaze');
  assert.equal(TITLE_TEXT.coldharbour, 'Blood of Coldharbour', 'Trakel\'s own word for it');
  assert.equal(AURA_TEXT.vampirichaze, 'Vampiric Haze');
  assert.equal(GLYPH_LABEL.coldharbour, 'Blood of Coldharbour', 'named on the account card');
  assert.deepEqual(TITLE_GRADIENT.coldharbour, [COLD_CRIMSON, COLD_MAGENTA, COLD_LAVENDER], '"Blood" in the crimson, "Coldharbour" into the violet');
  assert.ok(crimson(COLD_CRIMSON) && crimson(COLD_BLOOD), 'the blood\'s crimsons');
  assert.ok(violet(COLD_LAVENDER) && violet(COLD_VIOLET) && violet(COLD_SMOKE), 'the violets');
  assert.ok(COLD_MAGENTA[0] > COLD_MAGENTA[1] && COLD_MAGENTA[2] > COLD_MAGENTA[1], 'the magenta between them - red and blue over green');
  assert.ok(COLD_ROSE[0] > 0.9 && COLD_ROSE[2] > COLD_ROSE[1] * 1.1, 'the rose a pale crimson');
  assert.deepEqual(TITLE_EDGE.coldharbour, [0, 0, 0, 1], 'edged in black, as every gradient title');
  assert.equal(TITLE_RGBA.coldharbour, COLD_MAGENTA, 'its one colour the gradient\'s middle, the two blended');
  for (const t of TITLES.filter((x) => x !== 'coldharbour')) assert.ok(apart(TITLE_RGBA.coldharbour, TITLE_RGBA[t]) > 40, `apart from the ${t}'s (${cssRgba(TITLE_RGBA[t])})`);
  assert.equal(GLYPH_RGBA.coldharbour, COLD_LAVENDER, 'the ring in the lavender, the petals its details');
  assert.equal(GLYPH_GRADIENT.coldharbour, undefined);
  assert.equal(GLYPH_STROKE.coldharbour, false, 'filled');
  assert.equal(GLYPH_MARK.coldharbour, 'R', 'the rose');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, marks.length, 'a classic mark of its own');
  assert.ok(GLYPH_MARK.coldharbour.charCodeAt(0) >= FONT_GLYPH_MIN && GLYPH_MARK.coldharbour.charCodeAt(0) <= FONT_GLYPH_MAX, 'inside the font');
  assert.equal(AURA_PAINT.vampirichaze, 'coldharbour', 'the haze in the title\'s own paint');
  const badge = titleBadge({ title: 'coldharbour' });
  assert.deepEqual({ text: badge.text, rgba: badge.rgba, gradient: badge.gradient, edge: badge.edge }, { text: 'Blood of Coldharbour', rgba: COLD_MAGENTA, gradient: TITLE_GRADIENT.coldharbour, edge: TITLE_EDGE.coldharbour });
  assert.deepEqual(readBadge({ title: 'coldharbour', glyphs: ['coldharbour'] }), { title: 'coldharbour', glyphs: ['coldharbour'] }, 'the wire keeps it');
  assert.equal(readAura({ au: 'vampirichaze' }), 'vampirichaze', 'and the aura');
  assert.deepEqual(badged({ id: 'p1' }, { title: 'coldharbour', au: 'vampirichaze' }), { id: 'p1', title: 'coldharbour', au: 'vampirichaze' });
  assert.deepEqual(glyphBadges({ glyphs: ['coldharbour', 'sprout'] }).map((b) => b.key), ['sprout', 'coldharbour'], 'drawn in the vocabulary\'s order');
});

/** A path's figures (absolute M, L and Z) as their points, in order. */
const figuresOf = (d) => d.split(/(?=M)/).map((sub) => [...sub.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]));
/** Inside a shape filled even-odd over its edges (the shader's own rule). */
const insideOf = (edges, [x, y]) => edges.reduce((n, [ax, ay, bx, by]) => n + ((ay <= y) !== (by <= y) && x < ax + ((y - ay) * (bx - ax)) / (by - ay) ? 1 : 0), 0) % 2 === 1;
const CENTRE = [8, 7.3];
const at = (r, deg) => [CENTRE[0] + r * Math.sin((deg * Math.PI) / 180), CENTRE[1] - r * Math.cos((deg * Math.PI) / 180)];

test('BLOOD-OF-COLDHARBOUR the rose (Trakel\'s reference): a ring of thorns - its band filled, its middle open, hooked thorns out from it but none at its foot; five details in order, each inside the box - the violet outer petals, five round lobes inside the ring; the crimson inner petals, five points between them; the heart in the blood; its spiral in the rose; the drop in the crimson, hanging from the ring\'s foot (mutants: the ring\'s inside not wound back, a detail out of order, the drop lost)', () => {
  const ring = glyphEdges(GLYPH_PATH.coldharbour);
  for (const fig of figuresOf(GLYPH_PATH.coldharbour)) for (const [x, y] of fig) assert.ok(x >= 0 && x <= 16 && y >= 0 && y <= 16, `inside the box: ${x},${y}`);
  assert.equal(figuresOf(GLYPH_PATH.coldharbour).length, 2, 'the ring\'s two edges');
  for (let deg = 0; deg < 360; deg += 15) {
    assert.ok(insideOf(ring, at(6, deg)), `the band at ${deg} degrees`);
    assert.ok(!insideOf(ring, at(4.5, deg)), `open inside at ${deg} degrees`);
  }
  const thorny = [...Array(360).keys()].filter((deg) => insideOf(ring, at(6.9, deg)));
  const clusters = thorny.filter((deg, i) => i === 0 || deg - thorny[i - 1] > 3);
  assert.equal(clusters.length, 8, `eight thorns out from it (${thorny})`);
  assert.ok(!thorny.some((deg) => deg > 165 && deg < 195), 'none at its foot, where the drop hangs');
  for (const deg of clusters) assert.ok(!insideOf(ring, at(6.9, deg - 4)) && insideOf(ring, at(6.9, deg + 1)), `hooked: rising slowly, falling sharp (${deg})`);
  const dets = GLYPH_DETAIL.coldharbour;
  assert.deepEqual(glyphDetails(dets), dets, 'a list');
  assert.deepEqual(dets.map((d) => cssRgba(d.rgba)), [COLD_VIOLET, COLD_CRIMSON, COLD_BLOOD, COLD_ROSE, COLD_CRIMSON].map(cssRgba), 'the outer petals, the inner, the heart, its spiral, the drop');
  for (const d of dets) for (const fig of figuresOf(d.path)) for (const [x, y] of fig) assert.ok(x >= 0 && x <= 16 && y >= 0 && y <= 16, `a detail inside the box: ${x},${y}`);
  const [outer, inner, heart, , drop] = dets.map((d) => glyphEdges(d.path));
  const lobes = [0, 72, 144, 216, 288].filter((deg) => insideOf(outer, at(4.4, deg)));
  const gaps = [36, 108, 180, 252, 324].filter((deg) => insideOf(outer, at(4.4, deg)));
  assert.deepEqual([lobes.length, gaps.length], [5, 0], 'five round lobes, one up, open between them');
  for (const fig of figuresOf(dets[0].path)) for (const p of fig) assert.ok(!insideOf(ring, p) && Math.hypot(p[0] - CENTRE[0], p[1] - CENTRE[1]) < 5.6, `the petals inside the ring (${p})`);
  const points = [36, 108, 180, 252, 324].filter((deg) => insideOf(inner, at(3, deg)));
  assert.equal(points.length, 5, 'five crimson points between the lobes');
  assert.ok(insideOf(heart, CENTRE) && !insideOf(heart, at(1.6, 0)), 'the heart at the middle');
  assert.ok(insideOf(drop, [8, 15]) && insideOf(drop, [8, 13]) && !insideOf(drop, [6, 15]), 'the drop at the foot, over the ring');
});

// ── THE GRANT ───────────────────────────────────────────────────────

test('BLOOD-OF-COLDHARBOUR grant: COLDHARBOUR_HANDLES names trakel, and the list grants the title, its glyph AND the Vampiric Haze together, case-folded; worn while held, read off the config alone; off the list all three go; a guest, every other list\'s holder and a near name hold none; no staff command rides it (mutants: the handle, the list\'s key, the glyph\'s word, the aura\'s grant)', () => {
  assert.equal(v('COLDHARBOUR_HANDLES'), 'trakel', 'for the in-game account trakel');
  assert.equal(TIER_LISTS.coldharbour, 'COLDHARBOUR_HANDLES');
  assert.equal(TIER_GLYPH.coldharbour, 'coldharbour');
  assert.equal(TIER_AURA.coldharbour, 'vampirichaze');
  for (const h of ['trakel', 'Trakel', 'TRAKEL']) {
    const p = row(h);
    assert.deepEqual(titlesHeld(p, ENV), ['coldharbour'], `${h}: by name, case-folded`);
    assert.deepEqual(glyphsOf(p, ENV, LATER), ['coldharbour'], 'and its glyph');
    assert.deepEqual(aurasHeld(p, ENV), ['vampirichaze'], 'and the haze');
    assert.equal(equipRefusal('coldharbour', p, ENV), null);
    assert.equal(auraRefusal('vampirichaze', p, ENV), null);
  }
  const tk = row('trakel', { title: 'coldharbour', aura: 'vampirichaze' });
  assert.equal(titleWorn(tk, ENV), 'coldharbour');
  assert.equal(auraWorn(tk, ENV), 'vampirichaze');
  const w = wardrobeOf(tk, ENV, LATER);
  assert.deepEqual([w.titles, w.title, w.glyphs, w.auras, w.aura], [['coldharbour'], 'coldharbour', ['coldharbour'], ['vampirichaze'], 'vampirichaze']);
  const off = { ...ENV, COLDHARBOUR_HANDLES: '' };
  assert.deepEqual([titlesHeld(tk, off), glyphsOf(tk, off, LATER), aurasHeld(tk, off)], [[], [], []], 'off the list, all three go');
  assert.equal(auraWorn(tk, off), undefined);
  assert.deepEqual(titlesHeld({ ...tk, handle: null }, ENV), [], 'a guest holds none');
  for (const h of ['Blob-Marley', 'SylviaBun', 'Sureme', 'trakel2', 'Trake', 'tra kel']) {
    assert.ok(!titlesHeld(row(h), ENV).includes('coldharbour'), `${h} does not hold it`);
    assert.equal(auraRefusal('vampirichaze', row(h), ENV), 'not-held');
  }
  assert.equal(isStaff(['coldharbour']), false);
});

test('BLOOD-OF-COLDHARBOUR the service end to end: trakel registers, holds all three; wears the title and the haze; the token signs all three, and verifies', async () => {
  const { call, registered, identityPublic } = await standService({ COLDHARBOUR_HANDLES: 'trakel' });
  const me = await registered('trakel');
  assert.equal((await call('/v1/account/title', { title: 'coldharbour' }, me.secret)).status, 200);
  assert.equal((await call('/v1/account/aura', { aura: 'vampirichaze' }, me.secret)).status, 200);
  const r = await call('/v1/auth/token', {}, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const got = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
  assert.ok(got.ok, got.why);
  assert.equal(got.claims.t, 'coldharbour');
  assert.equal(got.claims.au, 'vampirichaze');
  assert.ok(got.claims.g.includes('coldharbour'), 'the rose signed');
});

// ── THE HAZE'S LAW ──────────────────────────────────────────────────

test('BLOOD-OF-COLDHARBOUR the haze\'s look: its own kind (20), premultiplied; its runes clear of the boots; its cards in the Sage\'s uniforms - no more than they hold; every rate and life whole over the clock; its colours the title\'s (mutants: the kind, the share of cards, a rate off whole, a colour drifted)', () => {
  const look = AURA_LOOK.vampirichaze;
  assert.deepEqual({ kind: look.kind, ringR: look.ringR, flameH: look.flameH, glyphs: look.glyphs, shade: look.shade }, { kind: 20, ringR: HAZE_RUNE_R, flameH: HAZE_WALL_H, glyphs: HAZE_CARDS, shade: true });
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, Object.keys(AURA_LOOK).length, 'a kind of its own');
  for (const a of AURAS) assert.ok(AURA_LOOK[a], `a look for every aura: ${a}`);
  assert.ok(HAZE_CARDS <= SAGE_CARDS, `in the Sage's uniforms (${HAZE_CARDS} of ${SAGE_CARDS})`);
  assert.equal(HAZE_CARDS, HAZE_PUFFS + HAZE_EMBERS);
  assert.ok(HAZE_RUNE_R >= 0.5 && HAZE_RUNE_R < AURA_GROUND_R, 'clear of the boots, on the ground');
  assert.equal(HAZE_SCRIPT.length, HAZE_RUNES);
  for (const b of HAZE_SCRIPT) assert.ok(Number.isInteger(b) && b >= 0 && b < 64, `a rune of the ward's alphabet: ${b}`);
  assert.ok(hazeRatesWhole(), 'every rate whole over the clock');
  for (const l of HAZE_EMBER_LIFE) assert.ok(Number.isInteger(AURA_CLOCK_PERIOD / l), `a drop's life divides the clock: ${l}`);
  assert.deepEqual(HAZE_RGB, {
    lavender: COLD_LAVENDER.slice(0, 3), violet: COLD_VIOLET.slice(0, 3), crimson: COLD_CRIMSON.slice(0, 3), blood: COLD_BLOOD.slice(0, 3),
    rose: COLD_ROSE.slice(0, 3), smoke: COLD_SMOKE.slice(0, 3), magenta: COLD_MAGENTA.slice(0, 3),
  }, 'one family with the title and the rose');
});

test('BLOOD-OF-COLDHARBOUR the blood (Trakel: "particles of crimson like blood that bubble up from the ground and drift off into daedric runes"): each drop rises off the ground round the feet to past the crown, a rune of the script once past HAZE_RUNE_AT of its rise; the drops spread round the feet; one flight wraps whole with the clock; none before the haze kindles; the wisps drift about the body and climb (mutants: the drop not rising, the rune not the script\'s, the kindle unread)', () => {
  const angles = new Set();
  for (let j = 0; j < HAZE_EMBERS; j++) {
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t < 30; t += 0.05) {
      const e = hazeEmber(j, t);
      const r = Math.hypot(e.x, e.z);
      assert.ok(r >= HAZE_EMBER_R[0] - 0.09 && r <= HAZE_EMBER_R[1] + 0.09, `drop ${j} round the feet (${r.toFixed(2)})`);
      assert.ok(e.age >= 0 && e.age < 1 && Number.isInteger(e.rune) && e.rune >= 0 && e.rune < HAZE_RUNES);
      assert.equal(e.size, HAZE_EMBER_M);
      lo = Math.min(lo, e.y); hi = Math.max(hi, e.y);
      angles.add(Math.floor(((Math.atan2(e.z, e.x) + Math.PI) / (2 * Math.PI)) * 8));
      const later = hazeEmber(j, t + 0.04);
      if (later.age > e.age) assert.ok(later.y > e.y, `drop ${j} rises`);
    }
    assert.ok(lo < 0.15 && hi > 1.8 && hi <= HAZE_EMBER_H + 0.05, `drop ${j} off the ground to past the crown (${lo.toFixed(2)}..${hi.toFixed(2)})`);
  }
  assert.ok(angles.size >= 7, `spread round the feet (${angles.size} of 8)`);
  const same = (a, b) => Object.keys(a).every((k) => Math.abs(a[k] - b[k]) < 1e-9);
  for (let j = 0; j < HAZE_EMBERS; j++) assert.ok(same(hazeEmber(j, 3.3), hazeEmber(j, 3.3 + AURA_CLOCK_PERIOD)), `drop ${j} whole at the wrap`);
  assert.ok([...Array(HAZE_EMBERS).keys()].every((j) => hazeEmber(j, 5, 0).size === 0), 'none before the haze kindles');
  for (let m = 0; m < HAZE_PUFFS; m++) {
    const a = hazePuff(m, 2.2), b = hazePuff(m, 2.2 + AURA_CLOCK_PERIOD);
    assert.ok(same(a, b), `wisp ${m} whole at the wrap`);
    assert.ok(Math.hypot(a.x, a.z) < 1.1 && a.y >= 0 && a.y < 2.2 && a.age >= 0 && a.age < 1, `wisp ${m} about the body`);
  }
  // node's law hands the cards farthest first: every wisp a 0, every drop a 2 and its rune's share
  const cards = new Float32Array(SAGE_CARDS * 4), looks = new Float32Array(SAGE_CARDS * 4);
  const eye = [3, 1.6, 2];
  hazeCardsInto(cards, looks, 7.7, 1, [0, 0, 0], eye);
  const kinds = [...Array(HAZE_CARDS).keys()].map((i) => looks[i * 4]);
  assert.deepEqual([kinds.filter((k) => k === 0).length, kinds.filter((k) => k === 2).length], [HAZE_PUFFS, HAZE_EMBERS]);
  const dist = [...Array(HAZE_CARDS).keys()].map((i) => Math.hypot(cards[i * 4] - eye[0], cards[i * 4 + 1] - eye[1], cards[i * 4 + 2] - eye[2]));
  for (let i = 1; i < dist.length; i++) assert.ok(dist[i] <= dist[i - 1] + 1e-5, 'farthest first');
  for (let i = 0; i < HAZE_CARDS; i++) if (looks[i * 4] === 2) assert.ok(Math.abs(looks[i * 4 + 3] * HAZE_RUNES % 1 - 0.5) < 1e-4, 'a drop\'s rune, its share of the script');
  hazeCardsInto(cards, looks, 7.7, 1, [0, 0, 0], [0, 1.2, 0]);
  for (let i = 0; i < HAZE_CARDS; i++) {
    const d = Math.hypot(cards[i * 4], cards[i * 4 + 1] - 1.2, cards[i * 4 + 2]);
    if (d < HAZE_NEAR[0]) assert.equal(looks[i * 4 + 2], 0, 'none near the wearer\'s own eye');
  }
});

// ── THE SHADER, RUN ─────────────────────────────────────────────────

const hazeAt = (kind, vP, { t = 13.3, kindle = 1, vS = [0, 0, 0], world = [0, 0, 0], eye = [0, 1.2, 5], px = 0.001 } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vS, vWorld: world, uKind: kind, uAura: 20, uTime: t, uSeed: 0, uKindle: kindle, uRingR: HAZE_RUNE_R, uGroundR: AURA_GROUND_R,
    uFlameH: HAZE_WALL_H, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: eye, uAt: [0, 0, 0], uFocus: [0, 0, 0, 0],
    dFdx: () => [px, 0, 0], dFdy: () => [0, px, 0],
  });
  try { f.main(); } catch (e) { if (e instanceof GlslDiscard) return null; throw e; }
  return f.globals.o;
};
const rgbOf = (c) => (c[3] > 1e-6 ? c.slice(0, 3).map((x) => x / c[3]) : c.slice(0, 3));

test('BLOOD-OF-COLDHARBOUR the shader RUN: a drop of blood covers in the crimson, its heart lighter; past HAZE_RUNE_AT it is a rune, its light added in the crimson and nothing covered; a wisp covers in the violet, nothing past its round; the ground\'s runes glow crimson on the ring, the violet shade at the feet; nothing past the ground (mutants: the drop in another colour, the rune covering, the wisp not violet)', () => {
  const drop = (uv, age = 0.3) => hazeAt(2, uv, { vS: [2 + 0.35, age, 1] });
  const bead = drop([0.5, 0.5]);
  assert.ok(bead[3] > 0.7, `the drop covers (${bead[3].toFixed(3)})`);
  assert.ok(crimson(rgbOf(bead)) && bead[0] > bead[2] * 1.5, `in the crimson - red over blue (${bead.map((x) => x.toFixed(3))})`);
  assert.deepEqual(drop([0.02, 0.02]).map((x) => Math.round(x * 1e3)), [0, 0, 0, 0], 'nothing at its card\'s corner');
  const k = Math.floor(0.35 * HAZE_RUNES);
  let lit = 0, covered = 0;
  for (let i = 0; i < 40; i++) {
    const c = drop([0.5 + (i - 20) / 40 * 0.9, 0.5], HAZE_RUNE_AT + 0.15);
    covered = Math.max(covered, c[3]);
    if (c[0] > 0.2 && c[0] > c[1] * 1.6) lit++;
  }
  assert.ok(lit >= 3 && covered < 0.05, `past HAZE_RUNE_AT, rune ${HAZE_SCRIPT[k]} lit in the crimson, added (${lit} lit, cover ${covered.toFixed(3)})`);
  const wisp = hazeAt(2, [0.5, 0.55], { vS: [0.15, 0.4, 1] });
  assert.ok(wisp[3] > 0.05 && wisp[3] <= HAZE_PUFF_A + 1e-9, `a wisp covers (${wisp[3].toFixed(3)})`);
  const wc = rgbOf(wisp);
  assert.ok(wc[2] > wc[1] && wc[0] > wc[1] && wc[2] > wc[0] * 0.8, `in the violet - its blue near its red (${wc.map((x) => x.toFixed(3))})`);
  for (const uv of [[0, 0.5], [0.97, 0.97], [0.5, 1]]) assert.deepEqual(hazeAt(2, uv, { vS: [0.15, 0.4, 1] }), [0, 0, 0, 0], `nothing past its round (${uv})`);
  let rune = 0;
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2, c = hazeAt(0, [Math.cos(a) * HAZE_RUNE_R, Math.sin(a) * HAZE_RUNE_R]);
    if (c && c[0] > 0.25 && c[0] > c[1] * 2) rune++;
  }
  assert.ok(rune >= 10, `the ground's runes crimson on the ring (${rune} of 120)`);
  const feet = hazeAt(0, [0.08, 0.05]);
  assert.ok(feet[3] > 0.05, 'the haze\'s shade at the feet, covering');
  assert.equal(hazeAt(0, [AURA_GROUND_R + 0.05, 0]), null, 'nothing past the ground');
  const wall = hazeAt(1, [0.3, 0.2], { world: [0.6, 0.1, 0] });
  assert.ok(wall[0] >= wall[1], 'the wall\'s foot warm with the blood');
});

test('BLOOD-OF-COLDHARBOUR the card\'s vertex, RUN: a drop stands square to the eye at its place about the feet, upright; a wisp the same, turned as it billows; the card\'s look reaches the fragment (mutants: the drop turned, the look not handed on)', () => {
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const uSage = Array.from({ length: SAGE_CARDS }, () => [0, 0, 0, 0]), uSageLook = Array.from({ length: SAGE_CARDS }, () => [0, 0, 0, 0]);
  uSage[0] = [0.3, 1.2, 0, HAZE_EMBER_M];
  uSageLook[0] = [2, 0.4, 1, 0.75];
  const run = (aP) => { const f = glslFunctions(AURA_VS, { aP, uVP: I, uKind: 2, uAura: 20, uAt: [10, 0, -4], uGroundR: AURA_GROUND_R, uRingR: HAZE_RUNE_R, uFlameH: HAZE_WALL_H, uLift: 0, uCamPos: [10.3, 1.2, 6], uSage, uSageLook }); f.main(); return f.globals; };
  const lo = run([0, 0]), hi = run([0, 1]), right = run([1, 0]);
  assert.ok(Math.abs(hi.vWorld[1] - lo.vWorld[1] - HAZE_EMBER_M) < 1e-6, 'upright, its height the card\'s');
  assert.ok(Math.abs(hi.vWorld[0] - lo.vWorld[0]) < 1e-6 && Math.abs(hi.vWorld[2] - lo.vWorld[2]) < 1e-6, 'not turned');
  assert.ok(Math.abs(right.vWorld[0] - lo.vWorld[0] - HAZE_EMBER_M) < 1e-6, 'square to the eye down the z');
  const mid = run([0.5, 0.5]);
  assert.ok(Math.abs(mid.vWorld[0] - 10.3) < 1e-6 && Math.abs(mid.vWorld[1] - 1.2) < 1e-6 && Math.abs(mid.vWorld[2] + 4) < 1e-6, 'at its place about the feet');
  assert.deepEqual(mid.vS.map((x) => Math.round(x * 1e4) / 1e4), [2.75, 0.4, 1], 'the drop\'s look handed on');
});

test('AUDIT lane 3 F3, F4: a drop\'s card is dark at its edge - a rune\'s glow shows no square - and a rising drop\'s tail is drawn below its bead, the card\'s top being up (mutants: the edge unfaded, the tail above)', () => {
  const lit = (c) => (c ? Math.max(...c.slice(0, 3)) * 255 : 0);
  let worst = 0;
  for (let k = 0; k < HAZE_RUNES; k++) {
    const vS = [2 + (k + 0.5) / HAZE_RUNES, 0.78, 1];   // a drop opened into rune k
    for (let i = 0; i <= 20; i++) {
      const s = i / 20;
      for (const uv of [[s, 0.0005], [s, 0.9995], [0.0005, s], [0.9995, s]]) worst = Math.max(worst, lit(hazeAt(2, uv, { vS })));
    }
  }
  assert.ok(worst < 2, `the brightest texel at a card's edge: ${worst.toFixed(1)} / 255`);
  const bead = [2.35, 0.3, 1];
  const above = lit(hazeAt(2, [0.5, 0.8], { vS: bead })), below = lit(hazeAt(2, [0.5, 0.2], { vS: bead }));
  assert.ok(below > 2 * above, `the tail below (${below.toFixed(0)}), not above (${above.toFixed(0)})`);
});
