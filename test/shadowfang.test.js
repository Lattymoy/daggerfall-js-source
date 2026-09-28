// SHADOW-FANG — ONE PLAYER'S OWN TITLE AND GLYPH (2026-09-26).
//
// Mac: "SirMcMobdon gets a brand new title/glyph. Remove them from Apostle. The glyph needs to be like the reference
// shown" - a snarling wolf's head in profile, black, with a red eye - and "Black and crimson graident for the
// title/glyph with the title name being Shadow Fang".
//
// The grant is TITLE-N's law (a handle list in the account service's config grants the title and its glyph, never to
// a guest). What is new is the PAINT: a title and a glyph drawn as a GRADIENT, on every face that draws one - the name
// over a head, the chat line, the profile card, the account card and the classic bitmap pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { TITLES, GLYPHS, RENOWN_MAX, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import {
  TITLE_TEXT, TITLE_RGBA, TITLE_GRADIENT, GLYPH_RGBA, GLYPH_GRADIENT, GLYPH_DETAIL, GLYPH_EDGE_W, GLYPH_MARK, GLYPH_PATH,
  GLYPH_STROKE, FONT_GLYPH_MIN, FONT_GLYPH_MAX, cssRgba, cssGradient, titleBadge, glyphBadges, glyphSvgNode, glyphArtNode,
  titlePaint, TITLE_PAINT_KEYS, paintTitle, gradientAt, badgeCss, badgeClass,
} from '../src/ui/playerBadge.js';
import { GLYPH_LABEL } from '../src/ui/enhancedAccount.js';
import { PROFILE_CSS } from '../src/ui/profileWindow.js';
import { renameGhostIds } from '../src/ui/windowMotion.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { titlesHeld, glyphsOf, equipRefusal, titleWorn, wardrobeOf, TIER_LISTS, TIER_GLYPH } from '../server-account/src/titles.js';
import { readBadge, NAME_MAX } from '../src/net/wire.js';
import { createNameLayer } from '../src/ui/nameLayer.js';
import { RemotePlayers, PEER_HEIGHT } from '../src/net/remotePlayers.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];

// ── the fake document (acc3badge's shape) ──
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

test('SHADOW-FANG vocabulary: the title and the glyph join the closed lists, with the word Mac named, a black-to-crimson gradient for each (the glyph\'s read from the title\'s and turned round, so the wolf\'s face is the black its eye burns in), a crimson edge, a red eye, a wolf that fits its box and a classic mark of its own (mutants: the glyph\'s gradient its own copy; the stops swapped; the eye the gradient\'s red; a mark another glyph has)', () => {
  assert.ok(TITLES.includes('shadowfang'));
  assert.ok(GLYPHS.includes('shadowfang'));
  assert.equal(TITLE_TEXT.shadowfang, 'Shadow Fang', 'Mac: "the title name being Shadow Fang"');
  const [black, crimson] = TITLE_GRADIENT.shadowfang;
  assert.equal(TITLE_GRADIENT.shadowfang.length, 2);
  assert.equal(cssRgba(black), '#0d0709', 'black - "Shadow" is drawn in it');
  assert.equal(cssRgba(crimson), '#d3193c', 'crimson - "Fang" is drawn in it');
  assert.ok(black[0] + black[1] + black[2] < 0.2, 'the black is black');
  assert.ok(crimson[0] > 0.7 && crimson[1] < 0.2 && crimson[2] < 0.3, 'the crimson is crimson');
  assert.equal(TITLE_RGBA.shadowfang, crimson, 'the one colour a face with no gradient draws is the crimson end, read from it');
  assert.equal(GLYPH_RGBA.shadowfang, TITLE_RGBA.shadowfang, 'the glyph\'s edge is the title\'s colour');
  assert.equal(GLYPH_GRADIENT.shadowfang[0], crimson, 'the glyph\'s gradient is the title\'s own stops...');
  assert.equal(GLYPH_GRADIENT.shadowfang[1], black, '...turned round: the mane crimson, the face black');
  assert.equal(GLYPH_STROKE.shadowfang, false, 'the wolf is a filled shape');
  assert.ok(GLYPH_EDGE_W > 0 && GLYPH_EDGE_W < 1, 'a hairline edge, in the box\'s units');
  const eye = GLYPH_DETAIL.shadowfang;
  assert.ok(eye.rgba[0] > 0.9 && eye.rgba[1] < 0.3 && eye.rgba[2] < 0.3, 'a red eye');
  assert.notEqual(cssRgba(eye.rgba), cssRgba(crimson), 'and not the gradient\'s own red - it has to burn out of the black');
  for (const d of [GLYPH_PATH.shadowfang, eye.path]) {
    const nums = d.match(/-?\d*\.?\d+/g).map(Number);
    assert.ok(nums.length >= 6 && nums.every((x) => x >= 0 && x <= 16), `inside the 16x16 box: ${d.slice(0, 24)}...`);
    assert.match(d, /^M[\s\S]*Z$/, 'a closed shape');
  }
  const nums = GLYPH_PATH.shadowfang.match(/-?\d*\.?\d+/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  assert.ok(Math.max(...xs) > 15.5 && Math.min(...xs) < 1.5, 'the muzzle reaches the right edge and the mane the left - the head in profile, facing right');
  assert.ok((GLYPH_PATH.shadowfang.match(/Q/g) ?? []).length >= 10, 'the mane and the ruff are swept blades, not a saw');
  // AUDIT F9: THE EYE IS ON THE HEAD - every corner of it inside the wolf's outline (its vertices, a curve's end point
  // standing for the curve), toward the muzzle and above the jaw; "inside the box" alone let it sit on the ruff
  const outline = [];
  for (const [, cmd, args] of GLYPH_PATH.shadowfang.matchAll(/([MLQ])([^MLQZ]*)/g)) {
    const v = args.trim().split(/[\s,]+/).map(Number);
    outline.push(v.slice(cmd === 'Q' ? 2 : 0, cmd === 'Q' ? 4 : 2));
  }
  const inside = ([x, y]) => {
    let hit = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [xi, yi] = outline[i], [xj, yj] = outline[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const eyeAt = [...eye.path.matchAll(/[ML]\s*([\d.]+)\s+([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(eyeAt.length >= 3 && eyeAt.every(inside), `the eye inside the head: ${JSON.stringify(eyeAt)}`);
  assert.ok(eyeAt.every(([x, y]) => x > 8 && y < 8), 'toward the muzzle, above the jaw');
  assert.equal(GLYPH_MARK.shadowfang, '>');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, marks.length, 'a classic mark of its own');
  assert.ok(GLYPH_MARK.shadowfang.charCodeAt(0) >= FONT_GLYPH_MIN && GLYPH_MARK.shadowfang.charCodeAt(0) <= FONT_GLYPH_MAX, 'inside the font');
  assert.equal(GLYPH_LABEL.shadowfang, 'Shadow Fang', 'named on the account card');
  assert.equal(new Set(TITLES.map((t) => cssRgba(TITLE_RGBA[t]))).size, TITLES.length, 'no two titles share a colour');
  // the badge records carry the paint
  assert.equal(titleBadge({ title: 'shadowfang' }).gradient, TITLE_GRADIENT.shadowfang);
  assert.equal(titleBadge({ title: 'developer' }).gradient, null, 'a one-colour title has none');
  const [g] = glyphBadges({ glyphs: ['shadowfang'] });
  assert.equal(g.gradient, GLYPH_GRADIENT.shadowfang);
  assert.equal(g.detail, eye);
  assert.equal(glyphBadges({ glyphs: ['sprout'] })[0].gradient, null);
});

// ── THE GRANT ───────────────────────────────────────────────────────

test('SHADOW-FANG grant: SirMcMobdon alone holds it, case-folded, title and glyph together - and is no longer an Apostle, the stored Apostle title lapsing off the next token (mutants: the list crossed with the Apostle\'s; a guest granted; the glyph without the title)', () => {
  assert.equal(v('SHADOW_FANG_HANDLES'), 'SirMcMobdon', 'Mac: "SirMcMobdon gets a brand new title/glyph"');
  assert.equal(v('APOSTLE_HANDLES'), '', 'Mac: "Remove them from Apostle"');
  assert.equal(TIER_LISTS.shadowfang, 'SHADOW_FANG_HANDLES');
  assert.equal(TIER_GLYPH.shadowfang, 'shadowfang');
  // the whole config, as the Worker reads it
  const env = Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
  const row = (handle, over = {}) => ({ handle, created_at: 1_800_000_000, registered_at: 1_900_000_000, ...over });   // FOUNDER3: first played after the cutoff too, so no Founder
  const nowS = 1_900_000_000;
  for (const h of ['SirMcMobdon', 'sirmcmobdon', 'SIRMCMOBDON']) {
    assert.deepEqual(titlesHeld(row(h), env), ['shadowfang'], `${h}: Shadow Fang and nothing else`);
    assert.deepEqual(glyphsOf(row(h), env, nowS), ['shadowfang'], `${h}: its glyph and no Apostle's`);
  }
  assert.equal(titleWorn(row('SirMcMobdon', { title: 'apostle' }), env), undefined, 'the Apostle title they wore lapses - held no longer, worn no longer');
  assert.equal(titleWorn(row('SirMcMobdon', { title: 'shadowfang' }), env), 'shadowfang');
  assert.equal(equipRefusal('shadowfang', row('SirMcMobdon'), env), null, 'theirs to wear');
  assert.equal(equipRefusal('apostle', row('SirMcMobdon'), env), 'not-held');
  assert.deepEqual(wardrobeOf(row('sirmcmobdon', { title: 'shadowfang' }), env, nowS), { titles: ['shadowfang'], title: 'shadowfang', glyphs: ['shadowfang'] });
  for (const h of ['Dutchess', 'SquidKamer', 'Lattymoy', 'Stranger']) {
    assert.ok(!titlesHeld(row(h), env).includes('shadowfang'), `${h} does not hold it`);
    assert.ok(!glyphsOf(row(h), env, nowS).includes('shadowfang'));
    assert.equal(equipRefusal('shadowfang', row(h), env), 'not-held');
  }
  assert.deepEqual(titlesHeld({ handle: null, created_at: 0 }, { SHADOW_FANG_HANDLES: 'SirMcMobdon' }), [], 'a guest holds none');
});

test('SHADOW-FANG token and relay: a token may carry the title and the glyph and verifies; the relay reads both out of the signature onto the peer\'s row, and a hello that only types them gets neither (mutants: the vocabulary without it, so the relay refuses the token)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-sf', n: 'SirMcMobdon', k: 'linked', t: 'shadowfang', g: ['shadowfang'] }, kp.privateKey, { subtle, nowS });
  const r = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(r.ok, r.why);
  assert.equal(r.claims.t, 'shadowfang');
  assert.deepEqual(r.claims.g, ['shadowfang']);
  assert.equal(claimsValid({ v: 1, s: 'acct-sf', n: 'SirMcMobdon', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS] }), true, 'every glyph at once still fits');
  // AUDIT B8: THE WIDEST TOKEN STILL PASSES THE HELLO - every glyph, the longest title, the longest name and account
  // id, a mute and the Renown cap - inside wire.js's TOKEN_RE (a 512-character body) and the verifier's 1024; and
  // (the merge) GUILD1c's three guild claims at their shapes' bounds (guildLaw.js GUILD_ID_RE, GUILD_TAG_RE, GUILD_MEMBER_RE)
  const TOKEN_RE = new RegExp(/const TOKEN_RE = \/(.+)\/;/.exec(rd('src/net/wire.js'))[1]);
  const longest = TITLES.reduce((a, t) => (t.length > a.length ? t : a), '');
  const guild = { gi: `g${'z'.repeat(10)}`, gt: 'WWWW', gm: `m${'9'.repeat(15)}` };
  const wide = await mintToken({ s: 'a'.repeat(40), n: 'W'.repeat(NAME_MAX), k: 'linked', t: longest, g: [...GLYPHS], mu: nowS + 10 ** 9, lv: RENOWN_MAX, ...guild }, kp.privateKey, { subtle, nowS });
  assert.equal(JSON.parse(Buffer.from(wide.split('.')[1], 'base64url').toString()).gm, guild.gm, 'the guild rides it');
  assert.ok(TOKEN_RE.test(wide), `the widest token passes the hello (${wide.split('.')[1].length} of 512)`);
  assert.ok(wide.length <= 1024);
  assert.ok((await verifyToken(wide, pub, { subtle, nowS })).ok);
  assert.deepEqual(readBadge({ title: 'shadowfang', glyphs: ['sprout', 'shadowfang'] }), { title: 'shadowfang', glyphs: ['sprout', 'shadowfang'] });

  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'SirMcMobdon', title: 'shadowfang', glyphs: ['shadowfang'] });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.equal(seen.title, 'shadowfang');
  assert.deepEqual(seen.glyphs, ['shadowfang']);
});

// ── THE PAINT ───────────────────────────────────────────────────────

test('SHADOW-FANG paint: a gradient title is its gradient clipped to its letters, in the loaded 500 face, the text shadow off (a text shadow paints OVER a clipped background) and its edge OUTSIDE the letters - a crimson pixel right and below, a black one under (AUDIT A4: a stroke ON the letters read crimson in the world); a one-colour title is its colour and clears every gradient key; no title clears everything (mutants: the shadow left on; the edge dropped; the edge back on the letters; a solid title leaving a gradient behind)', () => {
  const sf = titlePaint(titleBadge({ title: 'shadowfang' }));
  assert.deepEqual(Object.keys(sf), [...TITLE_PAINT_KEYS]);
  assert.equal(sf.backgroundImage, 'linear-gradient(90deg, #0d0709, #d3193c)');
  assert.equal(sf.backgroundImage, cssGradient(TITLE_GRADIENT.shadowfang));
  assert.equal(sf.webkitBackgroundClip, 'text');
  assert.equal(sf.backgroundClip, 'text');
  assert.equal(sf.webkitTextFillColor, 'transparent');
  assert.equal(sf.webkitTextStroke, '', 'nothing painted ON the letters - the gradient is the letter (AUDIT A4)');
  assert.equal(sf.filter, 'drop-shadow(1px 0 0 #d3193c) drop-shadow(0 1px 0 #d3193c) drop-shadow(0 1px 0 #000)',
    'every letter edged outside itself, right and below, so the black half reads over a night sky');
  assert.equal(sf.fontWeight, '500', 'a face the game loads (enhancedStyle requests 400 and 500) - 700 was synthesised (AUDIT A5)');
  assert.equal(sf.textShadow, 'none');
  assert.equal(sf.color, '#d3193c');
  const dev = titlePaint(titleBadge({ title: 'developer' }));
  assert.equal(dev.color, '#e2453a');
  for (const k of TITLE_PAINT_KEYS) if (k !== 'color') assert.equal(dev[k], '', `a one-colour title clears ${k}`);
  for (const k of TITLE_PAINT_KEYS) assert.equal(titlePaint(null)[k], '', `no title clears ${k}`);
  const doc = fakeDocument();
  const span = paintTitle(doc.createElement('span'), titleBadge({ title: 'shadowfang' }));
  for (const k of TITLE_PAINT_KEYS) assert.equal(span.style[k], sf[k]);
  // the classic face's tint for one letter
  assert.deepEqual(gradientAt(TITLE_GRADIENT.shadowfang, 0), [...TITLE_GRADIENT.shadowfang[0]]);
  assert.deepEqual(gradientAt(TITLE_GRADIENT.shadowfang, 1), [...TITLE_GRADIENT.shadowfang[1]]);
  const mid = gradientAt(TITLE_GRADIENT.shadowfang, 0.5);
  assert.ok(Math.abs(mid[0] - (TITLE_GRADIENT.shadowfang[0][0] + TITLE_GRADIENT.shadowfang[1][0]) / 2) < 1e-9);
});

test('SHADOW-FANG over a head: the name layer paints the title once when it CHANGES - never every frame (a browser reads a colour back normalised, so a diff against it would rewrite the gradient for ever) - and the next title clears what this one set (mutants: the paint written every frame; a key skipped on the change)', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  const pt = (over) => ({ id: 'peer-0001', name: 'SirMcMobdon', x: 400, y: 300, scale: 1, title: null, glyphs: [], ...over });
  layer.render({ points: [pt({ title: 'shadowfang', glyphs: ['shadowfang'] })] });
  const title = find(layer.tagFor('peer-0001').node, 'dfname-title');
  assert.equal(title.textContent, 'Shadow Fang');
  const sf = titlePaint(titleBadge({ title: 'shadowfang' }));
  for (const k of TITLE_PAINT_KEYS) assert.equal(title.style[k], sf[k], k);
  title.writes = 0;
  for (let i = 0; i < 8; i++) layer.render({ points: [pt({ title: 'shadowfang', glyphs: ['shadowfang'] })] });
  assert.equal(title.writes, 0, 'eight frames, not one write to the title');
  layer.render({ points: [pt({ title: 'founder' })] });
  assert.equal(title.style.color, cssRgba(TITLE_RGBA.founder));
  for (const k of TITLE_PAINT_KEYS) if (k !== 'color') assert.equal(title.style[k], '', `the gradient's ${k} is cleared`);
  layer.render({ points: [pt({})] });
  for (const k of TITLE_PAINT_KEYS) assert.equal(title.style[k], '', 'no title, no paint');
  // the chat line and the profile card paint through the same law
  assert.match(rd('src/ui/chatPanel.js'), /const titleSpan = \(badge, cls\) => paintTitle\(el\('span', cls, badge\.text\), badge\);/);
  assert.match(rd('src/ui/profileWindow.js'), /head\.append\(paintTitle\(el\('div', 'dfprofile-title', v\.title\.text\), v\.title\)\);/);
});

test('SHADOW-FANG the glyph drawn: filled with its own gradient (an id no other glyph node shares), edged in currentColor, the eye on top in its own red - the shape still the first child every face reads; the colourless half leaves the colour to the caller (the account card\'s class) and an ordinary glyph is drawn as it always was (mutants: one shared gradient id; the eye under the head; the edge a fixed colour)', () => {
  const doc = fakeDocument();
  const [g] = glyphBadges({ glyphs: ['shadowfang'] });
  const svg = glyphSvgNode(doc, g, 'x-glyph', 1.6);
  assert.equal(svg.attrs.viewBox, '0 0 16 16');
  assert.equal(svg.style.color, '#d3193c', 'the edge\'s colour, inline, as every DOM face sets a glyph\'s');
  const [head, defs, eye] = svg.children;
  assert.equal(head.tagName, 'PATH');
  assert.equal(head.attrs.d, GLYPH_PATH.shadowfang);
  const id = /^url\(#(.+)\)$/.exec(head.attrs.fill)?.[1];
  assert.ok(id, 'filled with a gradient');
  assert.equal(head.attrs.stroke, 'currentColor');
  assert.equal(head.attrs['stroke-width'], String(GLYPH_EDGE_W));
  assert.equal(defs.tagName, 'DEFS');
  const grad = defs.children[0];
  assert.equal(grad.tagName, 'LINEARGRADIENT');
  assert.equal(grad.attrs.id, id);
  assert.equal(grad.attrs.gradientUnits, 'userSpaceOnUse');
  assert.deepEqual([grad.attrs.x1, grad.attrs.x2], ['0', '16'], 'across the box, left to right');
  assert.deepEqual(grad.children.map((s) => [s.attrs.offset, s.attrs['stop-color']]), [['0', '#d3193c'], ['1', '#0d0709']], 'the mane crimson, the face black');
  assert.equal(eye.attrs.d, GLYPH_DETAIL.shadowfang.path);
  assert.equal(eye.attrs.fill, cssRgba(GLYPH_DETAIL.shadowfang.rgba), 'the eye, on top, in its own red');
  const other = glyphSvgNode(doc, g, 'x-glyph');
  assert.notEqual(/url\(#(.+)\)/.exec(other.children[0].attrs.fill)[1], id, 'every node its own gradient');
  const bare = glyphArtNode(doc, g, 'acctglyphart', 1.6);
  assert.equal(bare.style.color, undefined, 'the colourless half sets no colour - the account card\'s class does');
  const sprout = glyphSvgNode(doc, glyphBadges({ glyphs: ['sprout'] })[0], 'x-glyph', 1.6);
  assert.equal(sprout.children.length, 1, 'an ordinary glyph is one shape, as before');
  assert.equal(sprout.children[0].attrs.stroke, 'currentColor');
  assert.equal((rd('src/ui/playerBadge.js').match(/doc\?\.createElementNS\?\.\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)/g) ?? []).length, 1, 'still ONE svg door');
});

test('SHADOW-FANG the account card: the button keeps the plain crimson (its border is drawn in it) and the word inside it wears the SAME paint as over a head, from the skin; the glyph goes through the one drawing\'s colourless half (mutants: the word unwrapped; the card\'s own svg door back)', () => {
  const p = titlePaint(titleBadge({ title: 'shadowfang' }));
  const rule = `.card button.acttitle.${badgeClass('tl', 'shadowfang')} .acttitleword { background-image: ${p.backgroundImage}; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; font-weight: 500; text-shadow: none; filter: ${p.filter}; }`;
  assert.ok(badgeCss().includes(rule), 'the word\'s rule');
  assert.ok(ENHANCED_CSS.includes(rule), 'and it reached the skin');
  assert.ok(ENHANCED_CSS.includes(`.card button.acttitle.${badgeClass('tl', 'shadowfang')} { color: #d3193c; }`));
  assert.equal((badgeCss().match(/\.acttitleword/g) ?? []).length, 1, 'only a gradient title gets a word rule');
  const js = rd('src/ui/enhancedAccount.js');
  const wardrobe = js.slice(js.indexOf('function wardrobe()'), js.indexOf('function paint()'));
  assert.match(wardrobe, /b\.append\(el\('span', 'acttitleword', TITLE_TEXT\[key\] \?\? key\)\);/);
  assert.match(wardrobe, /const svg = glyphArtNode\(doc, g, 'acctglyphart', 1\.6\);/);
  assert.doesNotMatch(js, /createElementNS/, 'no svg door of the card\'s own');
});

test('SHADOW-FANG (AUDIT A1/A2/A7/A10/B7) every face, round the edges: the profile card\'s title is the WORD\'s width, so its gradient spans the word and not the card; a closing window\'s ghost RENAMES its ids and moves every url(#id) with them (a stripped id folded the wolf away hollow); the wolf\'s edge past its box is drawn, not cut; a name\'s colour is written when it changes (a browser reads a hex back as rgb()); a letter names its sender\'s title in words, and bounds its glyphs as a token does (mutants: the card-wide title; the ids stripped; the diff against a read-back)', () => {
  // A1
  assert.match(PROFILE_CSS, /\.dfprofile-title \{[^}]*width: fit-content; max-width: 100%; margin-inline: auto; \}/, 'the title shrinks to its word, centred');
  // A2
  const el = (id, attrs = {}) => ({ id, attrs: { ...attrs }, getAttribute(k) { return this.attrs[k] ?? null; }, setAttribute(k, x) { this.attrs[k] = x; } });
  const grad = el('dfglyph-grad-7'), wolf = el('', { fill: 'url(#dfglyph-grad-7)', stroke: 'currentColor' }), use = el('', { href: '#dfglyph-grad-7' }), other = el('', { fill: 'url(#elsewhere)' });
  const renamed = renameGhostIds([grad, wolf, use, other], '-wm-ghost3');
  assert.equal(grad.id, 'dfglyph-grad-7-wm-ghost3', 'the ghost\'s own name - the real window keeps its own');
  assert.equal(wolf.attrs.fill, 'url(#dfglyph-grad-7-wm-ghost3)', 'the wolf still finds its gradient');
  assert.equal(use.attrs.href, '#dfglyph-grad-7-wm-ghost3');
  assert.equal(other.attrs.fill, 'url(#elsewhere)', 'a reference out of the ghost is left alone');
  assert.equal(renamed.size, 1);
  assert.doesNotMatch(rd('src/ui/windowMotion.js'), /removeAttribute\('id'\)/, 'no id stripped');
  // A7
  const svg = glyphArtNode(fakeDocument(), glyphBadges({ glyphs: ['shadowfang'] })[0], 'x');
  assert.equal(svg.attrs.overflow, 'visible', 'the nose\'s edge is drawn past the box');
  // A10
  const doc = { writes: 0 };
  const normalising = (tag) => {
    const n = fakeNode(tag, doc);
    const raw = {};
    n.style = new Proxy(raw, {
      set(t, k, x) { t[k] = x; n.writes++; return true; },
      get(t, k) { const x = t[k]; return k === 'color' && /^#[0-9a-f]{6}$/i.test(x ?? '') ? `rgb(${parseInt(x.slice(1, 3), 16)}, ${parseInt(x.slice(3, 5), 16)}, ${parseInt(x.slice(5, 7), 16)})` : x; },
    });
    return n;
  };
  doc.createElement = normalising; doc.createElementNS = (ns, tag) => normalising(tag);
  doc.head = normalising('head'); doc.body = normalising('body');
  doc.getElementById = () => null;
  const layer = createNameLayer({ doc, now: () => 1000 });
  const pt = { id: 'peer-0002', name: 'Tabby', x: 100, y: 100, scale: 1, title: null, glyphs: [] };
  const colorOf = () => [0.2, 0.8, 0.3, 1];
  layer.render({ points: [pt], colorOf });
  const name = layer.tagFor('peer-0002').name;
  assert.equal(name.style.color, 'rgb(51, 204, 77)', 'the party colour, as a browser reads it back');
  name.writes = 0;
  for (let i = 0; i < 8; i++) layer.render({ points: [pt], colorOf });
  assert.equal(name.writes, 0, 'a party mate\'s green, not rewritten every frame');
  layer.render({ points: [pt], colorOf: () => null });
  assert.equal(name.style.color, '', 'and let go when the party is');
  // B7
  assert.match(rd('src/net/mail.js'), /slice\(0, GLYPHS_MAX\)/, 'a letter\'s glyphs bounded as a token\'s');
  assert.match(rd('src/ui/socialPanel.js'), /const titled = titleBadge\(l\)\?\.text \?\? null;/, 'the sender\'s title in words ("Shadow Fang", never "shadowfang")');
});

// ── THE CLASSIC FACE ────────────────────────────────────────────────

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, fixedWidth: 6, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
const recorder = () => {
  const runs = [];
  return { runs, drawScreenQuad: () => {}, drawScreenQuadRun: (tex, qs, color) => runs.push({ quads: qs, color }) };
};

test('SHADOW-FANG the classic face: a bitmap run takes one tint, so the gradient title is drawn a letter at a time along the gradient - black first, crimson last - over one run of its crimson a pixel down and right, its edge (mutants: one tint for the word; the edge run dropped; the letters in the wrong order)', () => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'SIRMCMOBDON', title: 'shadowfang', glyphs: ['shadowfang'], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }],
    (q) => [q.x, q.y, q.z], { bodyHeight: () => PEER_HEIGHT });
  const r = recorder();
  const drawn = rp.drawNames(r, FONT, mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)), lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]), 1600, 900, [0, 1.7, 0], 1, (q) => [q.x, q.y, q.z]);
  assert.equal(drawn, 2, 'the name and the title - one label line each');
  const [name, edge, ...letters] = r.runs;
  assert.equal(name.quads.length, 'SIRMCMOBDON >'.replace(/ /g, '').length, 'the name run carries the wolf\'s mark');
  assert.deepEqual(edge.color, TITLE_RGBA.shadowfang, 'the edge, in the crimson');
  assert.equal(edge.quads.length, 'ShadowFang'.length);
  assert.equal(letters.length, 'ShadowFang'.length, 'one run a letter (the space draws nothing)');
  assert.deepEqual(letters[0].color, [...TITLE_GRADIENT.shadowfang[0]], '"S" in the black');
  assert.deepEqual(letters.at(-1).color, [...TITLE_GRADIENT.shadowfang[1]], '"g" in the crimson');
  for (let i = 1; i < letters.length; i++) assert.ok(letters[i].color[0] > letters[i - 1].color[0], 'redder letter by letter');
  const lx = letters.map((l) => l.quads[0].dst.x);
  for (let i = 1; i < lx.length; i++) assert.ok(lx[i] > lx[i - 1], 'left to right');
  assert.ok(edge.quads[0].dst.x > letters[0].quads[0].dst.x && edge.quads[0].dst.y > letters[0].quads[0].dst.y, 'the edge sits down and right of the word');
  // AUDIT A3: UNDER EVERY LETTER ALIKE. The letters advanced by measureText - a space FixedWidth, where the run draws it
  // FixedWidth - 1 - and each was rounded apart, so the edge sat a pixel right of "Shadow" and flush under "Fang"
  const dx = edge.quads.map((q, i) => q.dst.x - letters[i].quads[0].dst.x);
  const dy = edge.quads.map((q, i) => q.dst.y - letters[i].quads[0].dst.y);
  assert.ok(dx[0] >= 1 && dx.every((d) => Math.abs(d - dx[0]) < 1e-9), `one offset right, "Fang" as "Shadow" (${dx})`);
  assert.ok(dy[0] >= 1 && dy.every((d) => Math.abs(d - dy[0]) < 1e-9), `and one down (${dy})`);
});
