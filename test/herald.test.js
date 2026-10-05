// HERALD — THE PATREON TIER BETWEEN DISCIPLE AND HIEROPHANT (2026-10-01).
//
// Mac, sending his Patreon tiers for PATREON-LINK: "Herald doesnt exist ingame yet", then "you'll need to develop the
// herald title/glyph". No colour or shape was named, so it is the tiers' kind - TITLE-N's law: one flat colour, the
// glyph a stroked shape in that colour - in AZURE, heraldry's own blue, with the herald's trumpet and its swallowtail
// banner for the glyph (ui/playerBadge.js says what was tried beside it). It is held by its pledge (PATREON_TIERS maps
// Mac's Herald tier to it) and by HERALD_HANDLES for a Herald Mac names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { TITLES, GLYPHS, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import {
  TITLE_TEXT, TITLE_RGBA, TITLE_GRADIENT, TITLE_EDGE, GLYPH_RGBA, GLYPH_GRADIENT, GLYPH_DETAIL, GLYPH_MARK, GLYPH_PATH,
  GLYPH_STROKE, FONT_GLYPH_MIN, FONT_GLYPH_MAX, cssRgba, titleBadge, glyphBadges, glyphSvgNode, titlePaint, badgeCss,
} from '../src/ui/playerBadge.js';
import { GLYPH_LABEL } from '../src/ui/enhancedAccount.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { isStaff } from '../src/net/staffCommands.js';
import { titlesHeld, glyphsOf, equipRefusal, titleWorn, TIER_LISTS, TIER_GLYPH } from '../server-account/src/titles.js';
import { PATREON_TITLES, patreonTierMap } from '../server-account/src/patreon.js';
import { readBadge, RELAY_VERSION } from '../src/net/wire.js';
import { createNameLayer } from '../src/ui/nameLayer.js';
import { RemotePlayers, PEER_HEIGHT } from '../src/net/remotePlayers.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
/** The Worker's config as it reads it: every handle list, and the Patreon tiers. */
const ENV = { ...Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]])), PATREON_TIERS: v('PATREON_TIERS') };
const HERALD_TIER = '29666234';   // Mac's Herald tier: its Join link's `rid`
const AFTER = 1_900_000_000;      // first played long after Founder's cutoff, so no row below holds Founder by accident
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });
const LATER = AFTER + 30 * 86_400;   // past the sprout's two weeks, so the only glyph is the grant's

/** A colour's hue in degrees, HSV. */
const hueOf = ([r, g, b]) => {
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 0;
  return max === r ? 60 * (((g - b) / d + 6) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
};

/** A path's corners, one list per shape (penitent.test.js's reading, for M L H V Z). */
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

// ── the fake document (penitent.test.js's shape) ──
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

test('HERALD vocabulary: the title and the glyph join the closed lists last, the word "Herald"; one flat AZURE - blue, apart from the moderator\'s shield and the Apostle\'s violet, no other title\'s colour - and the glyph in the title\'s own colour, read from it; no gradient, no edge, no detail; a classic mark of its own (mutants: the glyph in another colour; a mark another glyph has; the colour the shield\'s)', () => {
  assert.equal(TITLES[9], 'herald', 'the vocabulary\'s newest of main\'s, after the Gatebreaker - the seats\' five after it since the merge of the Seats arc (SEAT1c), and ARENA4\'s Grand Champion and Arena Champion after those (the pin reads past them)');
  assert.equal(GLYPHS[9], 'herald', 'after the penitent\'s - the seats\' four after it (SEAT1c), and ARENA4\'s laurel after those');
  assert.equal(TITLE_TEXT.herald, 'Herald');
  const azure = TITLE_RGBA.herald;
  assert.equal(cssRgba(azure), '#4f7dff');
  assert.ok(azure[2] > azure[1] && azure[1] > azure[0], 'blue, then green, then red: an azure');
  const hue = hueOf(azure);
  assert.ok(hue > 215 && hue < 240, `an azure's hue: ${hue.toFixed(1)}`);
  assert.ok(Math.abs(hue - hueOf(GLYPH_RGBA.mod)) > 10, 'not the moderator\'s shield blue');
  assert.ok(Math.abs(hue - hueOf(TITLE_RGBA.apostle)) > 10, 'nor the Apostle\'s violet');
  assert.equal(new Set(TITLES.map((t) => cssRgba(TITLE_RGBA[t]))).size, TITLES.length, 'no two titles share a colour');
  assert.equal(GLYPH_RGBA.herald, azure, 'the trumpet in the title\'s own azure - the two halves of one grant cannot drift');
  assert.equal(TITLE_GRADIENT.herald, undefined, 'a tier\'s one flat colour, as TITLE-N\'s');
  assert.equal(TITLE_EDGE.herald, undefined);
  assert.equal(GLYPH_GRADIENT.herald, undefined);
  assert.equal(GLYPH_DETAIL.herald, undefined);
  assert.equal(GLYPH_STROKE.herald, true, 'a stroked shape, as the tiers\' flame, book and crown');
  assert.equal(GLYPH_MARK.herald, '<', 'the bell\'s flare');
  const marks = GLYPHS.map((g) => GLYPH_MARK[g]);
  assert.equal(new Set(marks).size, marks.length, 'a classic mark of its own');
  assert.ok(GLYPH_MARK.herald.charCodeAt(0) >= FONT_GLYPH_MIN && GLYPH_MARK.herald.charCodeAt(0) <= FONT_GLYPH_MAX, 'inside the font');
  assert.equal(GLYPH_LABEL.herald, 'Herald', 'named on the account card');
  const badge = titleBadge({ title: 'herald' });
  assert.deepEqual({ text: badge.text, rgba: badge.rgba, gradient: badge.gradient, edge: badge.edge }, { text: 'Herald', rgba: azure, gradient: null, edge: null });
  assert.deepEqual(titlePaint(badge).color, '#4f7dff', 'painted in its one colour');
  assert.deepEqual(readBadge({ title: 'herald', glyphs: ['herald'] }), { title: 'herald', glyphs: ['herald'] }, 'the wire keeps it');
  assert.deepEqual(glyphBadges({ glyphs: ['herald', 'disciple'] }).map((b) => b.key), ['disciple', 'herald'], 'drawn in the vocabulary\'s order');
});

test('HERALD the glyph\'s shape: the herald\'s trumpet - a mouthpiece, the tube, the bell flaring right - and the swallowtail banner hanging from the tube, all inside the box with the stroke round it (mutants: the bell flaring back; the banner above the tube; the notch filled)', () => {
  const shapes = shapesOf(GLYPH_PATH.herald);
  assert.equal(shapes.length, 4, 'mouthpiece, tube, bell, banner');
  const [mouth, tube, bell, banner] = shapes;
  const half = 1.8 / 2;   // the widest stroke any face draws (the chat's 1.8)
  for (const s of shapes) for (const [x, y] of s) assert.ok(x - half >= 0 && x + half <= 16 && y - half >= 0 && y + half <= 16, `inside the 16x16 box with its stroke: ${x},${y}`);
  const xs = (s) => s.map((p) => p[0]), ys = (s) => s.map((p) => p[1]);
  const tubeY = tube[0][1];
  assert.equal(tube[1][1], tubeY, 'the tube is level');
  assert.ok(Math.min(...ys(mouth)) < tubeY && Math.max(...ys(mouth)) > tubeY && Math.max(...xs(mouth)) <= Math.min(...xs(tube)), 'the mouthpiece across the tube\'s left end');
  // the bell: its apex at the tube's right end, its mouth a vertical edge further right, taller than the mouthpiece
  const apex = bell[0];
  assert.deepEqual(apex, tube[1], 'the bell grows out of the tube\'s end');
  const mouthEdge = bell.slice(1);
  assert.ok(mouthEdge.every(([x]) => x > apex[0] + 4), 'flaring RIGHT, away from the mouthpiece');
  assert.equal(mouthEdge[0][0], mouthEdge[1][0], 'its mouth an upright edge');
  assert.ok(span(ys(mouthEdge)) > 2 * span(ys(mouth)), 'the bell\'s mouth wider than the mouthpiece - a trumpet, not a pipe');
  assert.ok(Math.min(...ys(mouthEdge)) < tubeY && Math.max(...ys(mouthEdge)) > tubeY, 'centred on the tube');
  // the banner hangs below the tube, between the mouthpiece and the bell, with the swallowtail notch at its foot
  assert.ok(banner.every(([, y]) => y >= tubeY), 'hanging from the tube, never above it');
  assert.ok(Math.min(...xs(banner)) > Math.max(...xs(mouth)) && Math.max(...xs(banner)) < apex[0], 'between the mouthpiece and the bell');
  const foot = banner.filter(([, y]) => y > tubeY + 4);
  assert.equal(foot.length, 3, 'two tails and the notch between them');
  const [left, notch, right] = foot;
  assert.equal(left[1], right[1], 'the tails level');
  assert.ok(notch[1] < left[1] - 1, 'the notch cut up into the banner');
  assert.equal(notch[0], (left[0] + right[0]) / 2, 'in the banner\'s middle');
  assert.ok(left[1] - tubeY > 1.5 * (right[0] - left[0]), 'a banner that hangs: longer than it is wide');
});
const span = (a) => Math.max(...a) - Math.min(...a);

// ── THE GRANT ───────────────────────────────────────────────────────

test('HERALD grant: a Herald pledge holds the title and its glyph by PATREON_TIERS (Mac\'s Herald tier), and HERALD_HANDLES grants both by name - empty, nobody yet; a guest, a lapsed pledge and every other tier hold none; no staff command rides it (mutants: the glyph without the title; the Herald tier unmapped; the list crossed with Penitent\'s)', () => {
  assert.equal(TIER_LISTS.herald, 'HERALD_HANDLES');
  assert.equal(TIER_GLYPH.herald, 'herald');
  assert.equal(v('HERALD_HANDLES'), '', 'nobody by name yet');
  assert.ok(PATREON_TITLES.includes('herald'), 'a Patreon tier may grant it');
  assert.equal(patreonTierMap(ENV).get(HERALD_TIER), 'herald', 'Mac\'s Herald tier grants it');
  const pledged = row('Herold', { patreon_user: '777', patreon_tiers: HERALD_TIER, patreon_status: 'active_patron' });
  assert.deepEqual(titlesHeld(pledged, ENV), ['herald'], 'a Herald patron holds Herald, and nothing else');
  assert.deepEqual(glyphsOf(pledged, ENV, LATER), ['herald'], 'with its trumpet');
  assert.equal(equipRefusal('herald', pledged, ENV), null, 'theirs to wear');
  assert.equal(titleWorn({ ...pledged, title: 'herald' }, ENV), 'herald');
  assert.equal(titleWorn({ ...pledged, title: 'herald', patreon_status: 'former_patron' }, ENV), undefined, 'a pledge that ended stops being worn');
  assert.deepEqual(titlesHeld({ ...pledged, patreon_tiers: '29666211' }, ENV), ['disciple'], 'the Disciple tier is the Disciple\'s');
  for (const tier of ['29701293', '29666221']) assert.deepEqual(titlesHeld({ ...pledged, patreon_tiers: tier }, ENV), [], `tier ${tier} holds no Herald`);
  assert.deepEqual(titlesHeld({ ...pledged, handle: null }, ENV), [], 'a guest holds none');
  const named = { ...ENV, HERALD_HANDLES: 'Crier' };
  for (const h of ['Crier', 'crier', 'CRIER']) {
    assert.deepEqual(titlesHeld(row(h), named), ['herald'], `${h}: by name, case-folded`);
    assert.deepEqual(glyphsOf(row(h), named, LATER), ['herald']);
  }
  for (const h of ['Diggleborf', 'Dutchess', 'SirMcMobdon', 'SquidKamer', 'Stranger']) {
    assert.ok(!titlesHeld(row(h), named).includes('herald'), `${h} does not hold it`);
    assert.equal(equipRefusal('herald', row(h), named), 'not-held');
  }
  assert.equal(isStaff(['herald']), false, 'a title and a glyph, not the staff\'s commands');
});

test('HERALD token and relay: a token may carry the title and the glyph and verifies, every glyph at once still fits, and the relay - world138, the one that knows the word - reads both out of the signature onto the peer\'s row (mutants: the vocabulary without it, so the relay refuses the token)', async () => {
  assert.equal(RELAY_VERSION, 'world170', 'HERALD moved it on (world138; LOOT7 after it, world139; WB11 and GATE-HEAL after that, world140; CLIMB5 and CLIMB6, world141 - missed here at that bump; FRIENDS-SYNC, world142; ELITE FOES, world143; the Seats arc\'s seven after it, world144-world150; WB12 after them, world151; GLYPH-WEAR, world152; REVENANT-WIRE, world153; BROKER-CAGE, world154; ARENA4 after them, world155 - world142 on its branch, renumbered past main\'s at the merge; AEGIS, world160; GUILD2, world161 - no wire change, past the DFO integration\'s world157-world159 and AEGIS\'s world160; PRIMARCH, world162; SUNBABY1, world163 - a live event\'s word; PARTY-LEAD, world164 - the hub\'s party.lead act; SERPENT1, world165 - the serpent frame; SERPENT2, world166 - the serpent herald; SHADOW-CLOAK, world167 - the cloak\'s word; SERAPH-WINGS, world168 - the wings word; AUDIT ARENA-LADDER, world169 - the arena ladder audit; FEUD, world170 - the foe record\'s wind-ups and a revenant\'s fields): an older relay refuses a token carrying the word');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-hd', n: 'Herold', k: 'linked', t: 'herald', g: ['sprout', 'herald'] }, kp.privateKey, { subtle, nowS });
  const r = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(r.ok, r.why);
  assert.equal(r.claims.t, 'herald');
  assert.deepEqual(r.claims.g, ['sprout', 'herald']);
  assert.equal(claimsValid({ v: 1, s: 'acct-hd', n: 'Herold', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS] }), true, 'every glyph at once still fits');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'Herold', title: 'herald', glyphs: ['herald'] });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.equal(seen.title, 'herald');
  assert.deepEqual(seen.glyphs, ['herald']);
});

// ── THE FACES ───────────────────────────────────────────────────────

test('HERALD drawn: over a head the word in its azure and the trumpet beside the name; the glyph stroked in currentColor at the face\'s own stroke; the account card\'s button and chip in the azure from the skin (mutants: the trumpet filled)', () => {
  const doc = fakeDocument();
  const layer = createNameLayer({ doc, now: () => 1000 });
  layer.render({ points: [{ id: 'peer-0001', name: 'Herold', x: 400, y: 300, scale: 1, title: 'herald', glyphs: ['herald'] }] });
  const node = layer.tagFor('peer-0001').node;
  const title = find(node, 'dfname-title');
  assert.equal(title.textContent, 'Herald');
  assert.equal(title.style.color, '#4f7dff');
  const glyphs = find(node, 'dfname-glyphs');
  assert.equal(glyphs.children.length, 1, 'the trumpet beside the name');
  const [g] = glyphBadges({ glyphs: ['herald'] });
  const svg = glyphSvgNode(doc, g, 'x-glyph', 1.6);
  assert.equal(svg.style.color, '#4f7dff');
  assert.equal(svg.children.length, 1, 'one shape - no detail, no gradient');
  const [path] = svg.children;
  assert.equal(path.attrs.d, GLYPH_PATH.herald);
  assert.equal(path.attrs.fill, 'none');
  assert.equal(path.attrs.stroke, 'currentColor');
  assert.equal(path.attrs['stroke-width'], '1.6');
  for (const rule of ['.card button.acttitle.tl-herald { color: #4f7dff; }', '.card .acctglyph.gl-herald .acctglyphart { color: #4f7dff; }']) {
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

test('HERALD the classic face: the name run carries the bell\'s mark, and the word is drawn in its azure (mutants: the mark dropped)', () => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-0001', name: 'HEROLD', title: 'herald', glyphs: ['herald'], shown: { x: 0, y: 0, z: -10, yaw: 0 }, look: null }],
    (q) => [q.x, q.y, q.z], { bodyHeight: () => PEER_HEIGHT });
  const r = recorder();
  const drawn = rp.drawNames(r, FONT, mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000)), lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]), 1600, 900, [0, 1.7, 0], 1, (q) => [q.x, q.y, q.z]);
  assert.equal(drawn, 2, 'the name and the title');
  const name = r.runs[0];
  assert.equal(name.quads.length, 'HEROLD<'.length, 'the name run carries the bell\'s mark');
  const word = r.runs.find((run) => run.quads.length === 'Herald'.length && run.color?.[2] === 1);
  assert.ok(word, 'the word drawn');
  assert.deepEqual([...word.color].map((c) => +c.toFixed(2)), [0.31, 0.49, 1, 1], 'in the azure');
});
