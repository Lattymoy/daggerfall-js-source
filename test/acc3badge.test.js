// ACC3b — THE TITLE AND THE GLYPHS, ON A PLAYER'S SCREEN (2026-09-22).
//
// Mac: "Player titles appear above a player name... 1st title is
// Founder with a gold color, 2nd title is Developer with a red color",
// and "name glyphs... appear on the right side of the player name."
//
// ACC3a proved the badge is GRANTED and SIGNED; nothing in it reached a
// screen. These pins are the other half, and they are about the two
// things that go wrong when one label is drawn by two faces:
//
//   THE FACES DISAGREE. The enhanced DOM layer can draw a sprouting
//   plant; the classic bitmap pass draws through a Daggerfall font and
//   puts NOTHING on screen for a glyph that font lacks - ACC1d-MARK
//   learned that with a tick one slice ago. So the two spellings are
//   held together here: both read ui/playerBadge.js, the classic
//   marks are held inside the font's own range, and neither face may
//   name a title the other does not draw.
//
//   THE LABEL DRIFTS OFF THE SKULL. A badge beside a name widens the
//   run the label is centred on, and a run measured without it puts
//   every badged peer's name half a badge to the left of their own
//   head - which is NAME1's entire complaint, re-made by the fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RemotePlayers, PEER_HEIGHT } from '../src/net/remotePlayers.js';
import { measureText } from '../src/ui/text.js';   // the draw's own ruler: the expected edge is DERIVED through it, not a second copy of the arithmetic
import { createNameLayer, NAME_CSS, cssRgba } from '../src/ui/nameLayer.js';
import {
  TITLE_TEXT, TITLE_RGBA, GLYPH_RGBA, GLYPH_MARK, GLYPH_PATH, GLYPH_STROKE,
  FONT_GLYPH_MIN, FONT_GLYPH_MAX, titleBadge, glyphBadges, glyphMarks,
} from '../src/ui/playerBadge.js';
import { TITLES, GLYPHS, GLYPHS_MAX } from '../src/net/identityToken.js';
import { readBadge, badged } from '../src/net/wire.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ── the fake document (name1_bubbles.test.js's shape, plus the SVG door) ──

function fakeNode(tag, doc, ns = null) {
  const n = {
    tagName: tag.toUpperCase(), ns, children: [], parent: null, id: '', attrs: {}, writes: 0,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } doc.structure++; },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.children.length = 0; n.writes++; doc.writes++; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); n.writes++; doc.writes++; } });
  n.style = new Proxy({}, { set(t, k, v) { t[k] = v; n.writes++; doc.writes++; return true; } });
  return n;
}
function fakeDocument() {
  const doc = { writes: 0, structure: 0, built: 0 };
  doc.createElement = (tag) => { doc.built++; return fakeNode(tag, doc); };
  // THE SVG DOOR. A glyph is a shape, so the layer asks for one in the
  // SVG namespace - and a document that cannot make one must draw NO
  // glyph rather than throw under somebody's name, which the last pin
  // in this file drives with this door taken away.
  doc.createElementNS = (ns, tag) => { doc.built++; return fakeNode(tag, doc, ns); };
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  doc.zero = () => { doc.writes = 0; doc.structure = 0; doc.built = 0; };
  return doc;
}
const find = (n, cls) => {
  if ((n.className ?? '').split(' ').includes(cls)) return n;
  for (const c of n.children) { const f = find(c, cls); if (f) return f; }
  return null;
};
const all = (n, cls, out = []) => {
  if ((n.className ?? '').split(' ').includes(cls) || n.attrs?.class === cls) out.push(n);
  for (const c of n.children) all(c, cls, out);
  return out;
};

// ── the classic face's stubs (name1_bubbles.test.js's) ──

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
const recorder = () => {
  const runs = [], quads = [];
  return { runs, quads,
    drawScreenQuad: (tex, dst, src, color) => quads.push({ tex, dst, src, color }),
    drawScreenQuadRun: (tex, qs, color) => runs.push({ tex, quads: qs, color }) };
};
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
const VIEW = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
const EYE = [0, 1.7, 0];
const W = 1600, H = 900;

const stand = (rows) => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  rp.sync(rows.map((r) => ({ id: r.id, name: r.name ?? r.id.toUpperCase(), title: r.title ?? null, glyphs: r.glyphs ?? [],
    shown: { x: r.at[0], y: r.at[1], z: r.at[2], yaw: 0 }, look: null })),
  (p) => [p.x, p.y, p.z], { bodyHeight: () => PEER_HEIGHT });
  return rp;
};

// ── THE TABLES, derived from the vocabulary ──

test('ACC3b: every title and every glyph the TOKEN can carry has a face - the tables are walked from the vocabulary, so a third one cannot reach a screen as a blank', () => {
  // DERIVED OVER ENUMERATED, with the enumeration kept honest by a
  // walk. identityToken.js owns what EXISTS (it is in the relay
  // bundle, where a word of presentation costs a deploy); this module
  // owns what it looks like, and this is the pin that binds them.
  for (const t of TITLES) {
    assert.equal(typeof TITLE_TEXT[t], 'string', `${t} has no word`);
    assert.ok(TITLE_TEXT[t], `${t}'s word is empty`);
    assert.ok(Array.isArray(TITLE_RGBA[t]) && TITLE_RGBA[t].length === 4, `${t} has no colour`);
    assert.ok(titleBadge({ title: t }), `${t} does not read back`);
  }
  for (const g of GLYPHS) {
    assert.equal(typeof GLYPH_MARK[g], 'string', `${g} has no classic mark`);
    assert.equal(GLYPH_MARK[g].length, 1, `${g}'s mark is not one character`);
    assert.ok(GLYPH_PATH[g], `${g} has no shape`);
    assert.ok(Array.isArray(GLYPH_RGBA[g]), `${g} has no colour`);
  }
  // THE CLASSIC MARKS MUST BE IN THE FONT'S OWN RANGE, or drawText
  // puts nothing on screen at all and the classic face silently drops
  // a badge the DOM face shows - ACC1d-MARK's finding, with a tick.
  // THE LIMIT SAID OUT LOUD: this container has no ARENA2, so the real
  // FONT0003 is not read here; the range is held instead.
  for (const g of GLYPHS) {
    const c = GLYPH_MARK[g].charCodeAt(0);
    assert.ok(c >= FONT_GLYPH_MIN && c <= FONT_GLYPH_MAX, `${g}'s mark ${JSON.stringify(GLYPH_MARK[g])} is outside the classic font's range`);
  }
  // Mac's colours: Founder gold, Developer red - held by their channels
  // rather than by a hex string, so a nudge to the shade is allowed and
  // a swap of the two is not.
  const [fr, fg, fb] = TITLE_RGBA.founder;
  assert.ok(fr > 0.85 && fg > 0.6 && fb < 0.45, 'Founder is gold');
  const [dr, dg, db] = TITLE_RGBA.developer;
  assert.ok(dr > 0.7 && dg < 0.45 && db < 0.45, 'Developer is red');
  const [sr, sg, sb] = GLYPH_RGBA.sprout;
  assert.ok(sg > 0.6 && sg > sr && sg > sb, 'the sprout is green');
  // ONE GRANT, TWO FACES: the dev glyph takes the Developer title's own
  // red rather than a second copy of it.
  assert.equal(GLYPH_RGBA.dev, TITLE_RGBA.developer, 'the dev glyph reads the title\'s colour rather than repeating it');
});

test('ACC3b: the glyph order is the VOCABULARY\'s and not the wire\'s - a glyph is true of a player, not chosen by one', () => {
  const forward = glyphBadges({ glyphs: ['sprout', 'dev'] }).map((g) => g.key);
  const backward = glyphBadges({ glyphs: ['dev', 'sprout'] }).map((g) => g.key);
  assert.deepEqual(forward, backward, 'two players with the same glyphs show them the same way round');
  assert.deepEqual(forward, GLYPHS.filter((g) => forward.includes(g)));
  assert.deepEqual(glyphBadges({}), []);
  assert.deepEqual(glyphBadges({ glyphs: 'sprout' }), [], 'a string is not a list of glyphs');
  assert.deepEqual(glyphBadges({ glyphs: ['emperor'] }), [], 'and a glyph nobody has heard of draws nothing');
  assert.equal(titleBadge({ title: 'emperor' }), null);
  assert.equal(titleBadge({ title: 42 }), null);
  assert.equal(titleBadge({}), null);
});

// ── THE WIRE'S READER ──

test('ACC3b: `readBadge` is the inverse of `badged`, and it CHECKS - a relay sending a title nobody has heard of paints nothing', () => {
  // The pair, round-tripped: what the relay writes is what a client
  // reads, and the check is in ONE place rather than spelled twice.
  const row = badged({ id: 'p' }, { title: 'founder', glyphs: ['sprout', 'dev'] });
  assert.deepEqual(readBadge(row), { title: 'founder', glyphs: ['sprout', 'dev'] });
  // ALWAYS A SHAPE, so nothing downstream has to tell absent from none.
  assert.deepEqual(readBadge({}), { title: null, glyphs: [] });
  assert.deepEqual(readBadge(null), { title: null, glyphs: [] });
  // AND IT IS A STRANGER'S WORD. The relay only sends what a signature
  // carried, so anything else is a relay that is older, newer, or not
  // ours - and a name layer that trusts an unknown string is a name
  // layer somebody paints text with.
  assert.deepEqual(readBadge({ title: 'emperor', glyphs: ['crown'] }), { title: null, glyphs: [] });
  assert.deepEqual(readBadge({ title: { toString: () => 'founder' } }), { title: null, glyphs: [] });
  assert.deepEqual(readBadge({ glyphs: ['sprout', 'sprout', 'sprout'] }), { title: null, glyphs: ['sprout'] });
  assert.equal(readBadge({ glyphs: [...GLYPHS, ...GLYPHS] }).glyphs.length, GLYPHS_MAX, 'the run is cut at the vocabulary\'s own size');
  assert.deepEqual(readBadge({ glyphs: 'sprout' }), { title: null, glyphs: [] });
});

// ── THE CLASSIC FACE ──

test('ACC3b: the classic pass draws the title on its OWN LINE ABOVE the name, in its own colour, and the glyphs INSIDE the centred run (mutant: the run measured without them, which walks every badged name off its own skull)', () => {
  const rp = stand([{ id: 'peer-0001', name: 'MACK', title: 'founder', glyphs: ['sprout'] }].map((r) => ({ ...r, at: [0, 0, -10] })));
  const [p] = rp.namePoints(PROJ, VIEW, W, H, EYE, (q) => [q.x, q.y, q.z]);
  assert.equal(p.title, 'founder', 'the badge rides the POINT, so both faces read one answer');
  assert.deepEqual(p.glyphs, ['sprout']);

  const r = recorder();
  const drawn = rp.drawNames(r, FONT, PROJ, VIEW, W, H, EYE, 1, (q) => [q.x, q.y, q.z]);
  assert.equal(drawn, 2, 'the name run and the title line');
  assert.equal(r.runs.length, 2);
  const [name, title] = r.runs;
  // THE TITLE IS ABOVE. Its quads sit a whole line higher than the
  // name's - Mac's own word, "above a player name".
  const topOf = (run) => Math.min(...run.quads.map((q) => q.dst.y));
  assert.ok(topOf(title) < topOf(name), 'the title stands above the name');
  assert.ok(Math.max(...title.quads.map((q) => q.dst.y + q.dst.h)) <= topOf(name) + 1, 'and clear of it');
  // IN ITS OWN COLOUR, which is the one thing on this label colorOf
  // does not get an opinion on: gold IS the Founder title, and a
  // party's green over it would erase the distinction Mac asked for.
  assert.deepEqual(title.color, TITLE_RGBA.founder);
  const green = [0, 1, 0, 1];
  const r2 = recorder();
  rp.drawNames(r2, FONT, PROJ, VIEW, W, H, EYE, 1, (q) => [q.x, q.y, q.z], null, () => green);
  assert.deepEqual(r2.runs[0].color, green, 'the NAME takes the party colour, as SOC4 says');
  assert.deepEqual(r2.runs[1].color, TITLE_RGBA.founder, 'and the title does not');

  // THE GLYPH IS IN THE RUN, and the run is what the label is centred
  // on. Measured against the same peer WITHOUT a badge: the name's own
  // glyphs must sit at the same place relative to the whole run, which
  // is only true if the marks were measured with it.
  assert.equal(glyphMarks({ glyphs: ['sprout'] }), GLYPH_MARK.sprout);
  const bare = stand([{ id: 'peer-0001', name: 'MACK', at: [0, 0, -10] }]);
  const rb = recorder();
  bare.drawNames(rb, FONT, PROJ, VIEW, W, H, EYE, 1, (q) => [q.x, q.y, q.z]);
  // THE LEFT EDGE, DERIVED FROM THE WHOLE RUN. The first cut of this
  // pin compared two centres with a four-pixel tolerance and the
  // mutant walked straight through it - a pin about drift that
  // tolerated the drift. The law is exact and so is this: a centred
  // label starts half of THE WHOLE RUN's width left of the head, and
  // the badge is part of the run, so the two widths must be the run's
  // and never the name's. Measured through the same `measureText` the
  // draw uses, which is what makes this a derivation rather than a
  // second copy of the arithmetic.
  const leftOf = (run) => Math.min(...run.quads.map((q) => q.dst.x));
  // ...at the POINT'S OWN SCALE, which is the perspective term the
  // draw multiplies every width by - a prediction that forgets it is
  // a prediction about a label at one metre.
  const px = (t) => measureText(FNT, t) * p.scale;
  const whole = px(`MACK ${GLYPH_MARK.sprout}`);
  const nameOnly = px('MACK');
  assert.ok(whole > nameOnly, 'the badge really widens the run');
  assert.equal(leftOf(name), Math.round(p.x - whole / 2), 'the badged label starts half the WHOLE run left of the head');
  assert.notEqual(leftOf(name), Math.round(p.x - nameOnly / 2), 'and not half the NAME - that is the drift');
  assert.equal(leftOf(rb.runs[0]), Math.round(p.x - nameOnly / 2), 'the unbadged control, by the same arithmetic');

  // NO BADGE, NO EXTRA DRAW: an ordinary peer's label is exactly the
  // one draw it has always been, which is what every peer is today.
  assert.equal(bare.drawNames(recorder(), FONT, PROJ, VIEW, W, H, EYE, 1, (q) => [q.x, q.y, q.z]), 1);
});

// ── THE DOM FACE ──

test('ACC3b: the DOM layer puts the title above and the glyphs right of the name, and an UNBADGED label is exactly the element it was before this existed', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  const pt = (over) => ({ id: 'peer-0001', name: 'Mack', x: 400, y: 300, scale: 1, title: null, glyphs: [], ...over });

  layer.render({ points: [pt({ title: 'developer', glyphs: ['sprout', 'dev'] })] });
  const node = layer.tagFor('peer-0001').node;
  const title = find(node, 'dfname-title');
  assert.equal(title.textContent, TITLE_TEXT.developer);
  assert.equal(title.style.color, cssRgba(TITLE_RGBA.developer));
  // THE ORDER IN THE DOM IS THE ORDER ON SCREEN: the title is a sibling
  // ABOVE the name row (`.dfname` is a column), and the glyphs are
  // INSIDE it, after the name.
  assert.ok(node.children.indexOf(title) < node.children.indexOf(find(node, 'dfname-tag')), 'the title stands above the name row');
  const tag = find(node, 'dfname-tag');
  // RENOWN1: Renown's plate stands FIRST in the row, left of the name - empty (and so taking no room,
  // `.dfname-renown:empty`) for a point that carries no level, which is this one
  assert.equal(tag.children[0].className, 'dfname-renown');
  assert.equal(tag.children[0].textContent, '', 'no level on the point, no words on the plate');
  assert.equal(tag.children[1].className, 'dfname-who');
  assert.equal(tag.children[2].className, 'dfname-glyphs');
  const svgs = all(node, 'dfname-glyph');
  assert.equal(svgs.length, 2, 'one shape per glyph');
  assert.equal(svgs[0].ns, 'http://www.w3.org/2000/svg', 'a shape, not a letter - an emoji is whatever colour font the machine happens to have');
  assert.equal(svgs[0].children[0].attrs.d, GLYPH_PATH.sprout);
  assert.equal(svgs[0].style.color, cssRgba(GLYPH_RGBA.sprout));
  assert.equal(svgs[0].children[0].attrs.stroke, GLYPH_STROKE.sprout ? 'currentColor' : undefined);
  assert.equal(svgs[1].children[0].attrs.d, GLYPH_PATH.dev);

  // AN UNBADGED PEER: both elements are there and BOTH ARE EMPTY, and
  // the sheet takes them out of the flow rather than the layer taking
  // them out of the tree - one element per peer, moved and never
  // rebuilt, is this layer's whole discipline.
  const plain = createNameLayer({ doc: fakeDocument(), now: () => 1000 });
  plain.render({ points: [pt({})] });
  const pn = plain.tagFor('peer-0001').node;
  assert.equal(find(pn, 'dfname-title').textContent, '');
  assert.equal(all(pn, 'dfname-glyph').length, 0);
  assert.match(NAME_CSS, /\.dfname-title:empty \{ display: none; \}/, 'an empty title takes no room');
  assert.match(NAME_CSS, /\.dfname-glyphs:empty \{ display: none; \}/);
});

test('ACC3b: the glyph run is rebuilt only when it CHANGES - a fact about an account, read every frame for every visible peer', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  const pt = (over) => ({ id: 'peer-0001', name: 'Mack', x: 400, y: 300, scale: 1, ...over });
  layer.render({ points: [pt({ glyphs: ['sprout'] })] });
  doc.zero();
  for (let i = 0; i < 12; i++) layer.render({ points: [pt({ glyphs: ['sprout'] })] });
  assert.equal(doc.built, 0, 'twelve frames and not one element built - the frame MOVES a name, it does not make one');
  assert.equal(all(layer.tagFor('peer-0001').node, 'dfname-glyph').length, 1);

  // ...and it DOES change when the badge does, which is the other half:
  // a peer who reconnects without their sprout must lose it here.
  layer.render({ points: [pt({ glyphs: [] })] });
  assert.equal(all(layer.tagFor('peer-0001').node, 'dfname-glyph').length, 0);
  layer.render({ points: [pt({ glyphs: ['dev'] })] });
  const now = all(layer.tagFor('peer-0001').node, 'dfname-glyph');
  assert.equal(now.length, 1);
  assert.equal(now[0].children[0].attrs.d, GLYPH_PATH.dev);
});

test('ACC3b: a document that cannot make a shape draws NO glyph rather than throwing under somebody\'s name', () => {
  // ONCRASH1's law on this surface: the name layer runs inside the
  // frame, so a throw here is not a missing glyph, it is the world
  // stopping. An old WebView without createElementNS is the case.
  const doc = fakeDocument();
  delete doc.createElementNS;
  const layer = createNameLayer({ doc, now: () => 1000 });
  assert.doesNotThrow(() => layer.render({ points: [{ id: 'peer-0001', name: 'Mack', x: 400, y: 300, scale: 1, title: 'founder', glyphs: ['sprout'] }] }));
  const node = layer.tagFor('peer-0001').node;
  assert.equal(all(node, 'dfname-glyph').length, 0, 'no shape');
  assert.equal(find(node, 'dfname-title').textContent, TITLE_TEXT.founder, 'and the TITLE is still there - it is a word, and a word needs no namespace');
});

// ── THE SESSION'S PEER ──

test('ACC3b: a peer WEARS THE NEWEST HELLO\'S badge, including none - and the client reads it through the wire\'s own checker', () => {
  // A peer that kept the FIRST badge it was ever seen with would be
  // wearing a grant the relay has stopped vouching for, which is the
  // same stored-fact trap ACC3a took out of the service.
  const src = rd('src/net/online.js');
  assert.match(src, /const \{ title, glyphs \} = readBadge\(p\);/, 'the peer is built through the one reader');
  assert.match(src, /\(\{ title: p\.title, glyphs: p\.glyphs \} = readBadge\(m\)\);/, 'and a second hello replaces it');
  assert.match(src, /this\._known\.set\(id, \{ name: p\.name, title: p\.title, glyphs: p\.glyphs,[^}]* look: p\.look \}\);/, 'the remembered introduction keeps it, so a socket blip does not strip a title');   // MOD1: `sub` rides beside it
  assert.doesNotMatch(src, /title: m\.title/, 'nothing takes a badge off a frame without the check');
});
