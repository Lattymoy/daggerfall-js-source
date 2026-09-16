// SOC4 (2026-09-16, Mac: "Party system: Upon joining a party, the players name who are in a party together should
// turn green. Theyre character portrait + health/stamins/magicia stats displayed on a new party UI element"):
// THE PARTY HUD AND THE GREEN NAMES, driven headless.
//
// TWO SURFACES, ONE PICTURE. The panel (src/ui/partyPanel.js) is DOM and is driven over a fake document of this
// file's own - the chat1.test.js shape, grown a canvas with a 2D context, and a WRITE COUNTER on every node, because
// the whole of this panel's per-frame budget is the promise that a frame where nothing changed writes NOTHING. A pin
// that greps for a class name cannot tell a bar that moves from one built and never written again, and a pin that
// cannot COUNT cannot tell a repaint from a rebuild.
//
// The names (src/net/remotePlayers.js drawNames) are driven over the same stub renderer and stub font PERF-ON's pins
// use, so the colour that reaches `drawText` is read rather than assumed - and the DEFAULT path, with no colour
// function at all, is pinned white byte for byte, because every caller written before the party existed passes
// nothing and must keep the names it always drew (test/online.test.js and test/perfon_text_run.test.js both ride it).
//
// THE PORTRAIT IS THE GAME'S OWN ART and this file proves it twice: once through an injected loader seam (so the
// cache, the async landing and the failure arm can be driven without a data file), and once through
// `createFaceLoader` over a CIF SYNTHESIZED IN MEMORY - a real IMG-record header, real indexed pixels, the real
// CifRciFile walk and the real bitmapToColor32 - so "the same CIF the paper doll reads" is a fact and not a comment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SocialState, PARTY_GREEN, PARTY_GREEN_CSS } from '../src/net/social.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import {
  createPartyPanel, createFaceLoader, injectPartyStyle, placeText, barPercent, vitalsText, faceKeyOf,
  PARTY_STYLE_ID, PARTY_CSS, PARTY_VITALS, LEADER_MARK, VITALS_BLANK, FACE_BLANK_MARK,
} from '../src/ui/partyPanel.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
const quiet = async (fn) => { const warn = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = warn; } };

// ── THE FAKE DOCUMENT (test/chat1.test.js's shape, with a canvas and a write counter) ──────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, textContent: '', id: '', value: '',
    attrs: {}, listeners: new Map(), writes: 0, width: 0, height: 0,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } doc.structure++; },
    replaceChildren(...cs) { n.children = []; for (const c of cs) { c.parent = n; n.children.push(c); } doc.structure++; },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  // Every property a repaint can write is COUNTED - here and on the document - so a pin can say "that frame wrote
  // nothing" and mean it. `_text`/`_class` hold the value; the accessors are the till.
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.writes++; doc.writes++; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); n.writes++; doc.writes++; } });
  n.style = new Proxy({}, { set(t, k, v) { t[k] = v; n.writes++; doc.writes++; return true; } });
  if (n.tagName === 'CANVAS') {
    n.puts = [];
    const ctx = {
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (img, x, y) => n.puts.push({ width: img.width, height: img.height, data: img.data.slice(), x, y }),
    };
    n.getContext = (kind) => (kind === '2d' ? ctx : null);
  }
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null, writes: 0, structure: 0, built: 0 };
  doc.createElement = (tag) => { doc.built++; return fakeNode(tag, doc); };
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  doc.zero = () => { doc.writes = 0; doc.structure = 0; doc.built = 0; };
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
const texts = (n, cls) => find(n, cls).map((x) => x.textContent);

// ── THE PICTURE (net/social.js), driven with plain frames ─────────────────────────────────────────

const POSE = Object.freeze({ px: 100, py: 200, loc: 'Daggerfall', in: 0, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 });
const member = (n, over = {}) => ({ acct: `acct-${n}`, name: n, online: true, seen: 1e12, peers: [`peer-${n}`], p: null, ...over });
const party = (members, leader) => ({ id: 'q-party-1', leader: leader ?? members[0].acct, members });
const stateFrame = (over = {}) => ({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', friends: [], in: [], out: [], party: null, invites: [], ...over });

/** A picture with me and the members handed in, plus the panel over it. `clock` is the relay's, as the picture reads it. */
function stand({ members = [], leader, doc = fakeDocument(), faceLoader = async () => null, touch = false } = {}) {
  const clock = { t: 1e12 };
  const social = new SocialState({ now: () => clock.t });
  social.apply(stateFrame({ party: members.length ? party(members, leader) : null }));
  const panel = createPartyPanel({ social, doc, faceLoader, touch });
  return { social, panel, doc, clock, root: doc.body.children.at(-1) };
}

// ── THE CARDS ─────────────────────────────────────────────────────────────────────────────────────

test('SOC4: the panel - one card per OTHER member in SEAT ORDER and never my own (my vitals are the HUD\'s); the name in the party green with the leader\'s mark on the leader alone; the sheet injected once; nothing drawn out of a party or alone in one (mutants: my own seat drawn; the cards sorted by name; the mark on the first seat; the panel standing with an empty party)', () => {
  const { social, panel, doc, root } = stand({ members: [member('Bran'), member('me', { acct: 'acct-me', name: 'Mac' }), member('Cyl')], leader: 'acct-Cyl' });
  assert.equal(doc.getElementById(PARTY_STYLE_ID)?.tagName, 'STYLE', 'the sheet');
  createPartyPanel({ social, doc, faceLoader: async () => null }).destroy();
  assert.equal(find(doc.head, '').filter((n) => n.id === PARTY_STYLE_ID).length, 1, 'injected once');
  assert.equal(root.className, 'dfparty');
  assert.equal(root.attrs['aria-label'], 'Party');
  panel.render({});
  // ME is in the middle of the seats, so a panel that simply drew `party.members` would put my own card between them
  assert.deepEqual(texts(root, 'dfparty-name'), ['Bran', 'Cyl'], 'the others, in the hub\'s seat order');
  assert.equal(panel.cardCount(), 2);
  assert.equal(panel.cardFor('acct-me'), null, 'no card for myself - the HUD already draws my three bars');
  const cards = find(root, 'dfparty-card');
  assert.equal(cards.length, 2);
  assert.equal(one(cards[0], 'dfparty-lead').className, 'dfparty-lead off', 'Bran holds the first seat and does not lead');
  assert.equal(one(cards[1], 'dfparty-lead').className, 'dfparty-lead', 'Cyl leads, whatever seat she sits in');
  assert.equal(one(cards[1], 'dfparty-lead').textContent, LEADER_MARK);
  assert.equal(one(cards[1], 'dfparty-lead').attrs['aria-label'], 'Party leader', 'and says so in words, not in a glyph alone');
  assert.equal(root.style.display, '', 'a party with somebody else in it: drawn');
  // the green is the picture's, in one home
  assert.ok(PARTY_CSS.includes(`.dfparty-name { min-width: 0; flex: 0 1 auto; font-weight: 600; font-size: 14px; line-height: 1.2;\n  color: ${PARTY_GREEN_CSS};`), 'the name carries PARTY_GREEN_CSS from net/social.js, never a second green');
  assert.equal(PARTY_GREEN_CSS, '#73ff73');
  // alone in a party, and out of one
  social.apply(stateFrame({ party: party([member('me', { acct: 'acct-me', name: 'Mac' })]) }));
  panel.render({});
  assert.equal(root.style.display, 'none', 'a party of one is nobody to watch: hidden');
  assert.equal(panel.cardCount(), 0, 'and the cards are let go');
  social.apply(stateFrame({ party: null }));
  panel.render({});
  assert.equal(root.style.display, 'none', 'no party at all: hidden');
});

test('SOC4: a card says the three vitals as the pose carries them - health, stamina, magicka, each a bar AND its digits - with the place beneath the name (a dungeon and an inside say so), dashes and empty bars before the first pose, and an away member greyed with the last-online words (mutants: a missing pose drawn as 0/0; the bars unscaled; the dungeon flag dropped; away drawn live)', () => {
  const { social, panel, doc, clock, root } = stand({ members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran')] });
  panel.render({});
  const card = panel.cardFor('acct-Bran');
  assert.ok(card, 'a member with no pose yet still gets a seat');
  assert.deepEqual(card.vitals.map((v) => v.num.textContent), [VITALS_BLANK, VITALS_BLANK, VITALS_BLANK], 'no pose: dashes, never 0 / 0 - which reads as dying');
  assert.deepEqual(card.vitals.map((v) => v.fill.style.width), ['0%', '0%', '0%']);
  assert.equal(card.where.textContent, '', 'and no place is claimed');
  assert.equal(one(card.facebox, 'dfparty-facemark').textContent, FACE_BLANK_MARK);
  social.applyParty('acct-Bran', { ...POSE, h: 30, hm: 60, f: 500, fm: 2000, m: 3, mm: 20 });
  panel.render({});
  assert.deepEqual(card.vitals.map((v) => v.num.textContent), ['30 / 60', '500 / 2000', '3 / 20'], 'the digits the pose carries');
  assert.deepEqual(card.vitals.map((v) => v.fill.style.width), ['50%', '25%', '15%'], 'and the bars in the same proportion');
  assert.deepEqual(PARTY_VITALS.map((v) => [v.key, v.now, v.max]), [['health', 'h', 'hm'], ['fatigue', 'f', 'fm'], ['magicka', 'm', 'mm']], 'health, stamina, magicka - the HUD\'s own order and the wire\'s own field pairs');
  assert.deepEqual(card.vitals.map((v) => v.row.className), ['dfparty-vital health', 'dfparty-vital fatigue', 'dfparty-vital magicka']);
  for (const [k, css] of [['health', '#e2554c'], ['fatigue', '#62d26a'], ['magicka', '#7089f2']]) {
    assert.ok(PARTY_CSS.includes(`.dfparty-vital.${k} .dfparty-fill { background: linear-gradient(180deg, ${css},`), `${k} carries its own colour`);
  }
  assert.equal(card.where.textContent, 'Daggerfall', 'out in a town: the place');
  social.applyParty('acct-Bran', { ...POSE, in: 1, loc: 'Privateer\'s Hold' });
  panel.render({});
  assert.equal(card.where.textContent, 'Privateer\'s Hold - dungeon');
  social.applyParty('acct-Bran', { ...POSE, in: 2, loc: 'The Odd Blades' });
  panel.render({});
  assert.equal(card.where.textContent, 'The Odd Blades - inside');
  // the pure helpers, at their edges
  assert.equal(placeText(null), '');
  assert.equal(placeText({ loc: '', in: 0 }), 'the wilderness', 'a nameless exterior is somebody out between towns');
  assert.equal(placeText({ loc: '', in: 1 }), 'dungeon');
  assert.equal(barPercent(1, 0), 0, 'no maximum is no bar, never a divide by zero');
  assert.equal(barPercent(-5, 60), 0); assert.equal(barPercent(120, 60), 100, 'clamped both ways');
  assert.equal(barPercent(1, 3), 33);
  assert.equal(vitalsText(49.6, 60), '50 / 60'); assert.equal(vitalsText(NaN, 60), VITALS_BLANK);
  // away: the card goes grey and says when, on the RELAY's clock (the hub says a seat's presence in its party view;
  // the pose it already held rides over, which is why the bars still read the last thing they were told)
  social.apply({ t: 'social', k: 'party', party: party([member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran', { online: false, seen: clock.t - 5 * 60_000, peers: [] })]) });
  panel.render({});
  assert.equal(card.node.className, 'dfparty-card away', 'away: the whole card greys - the portrait with it');
  assert.equal(card.where.textContent, 'Last online 5 min ago', 'and the place is replaced by when they were last seen');
  assert.ok(PARTY_CSS.includes('.dfparty-card.away { opacity: .46; filter: grayscale(1); }'), 'the greying is the sheet\'s, on the card and not on one part of it');
  assert.equal(find(root, 'dfparty-card').length, 1);
});

test('SOC4: a repaint is a WRITE, not a REBUILD - a pose moves one card\'s bars in place (the same nodes, no element made, the other card untouched), a frame where the version has not moved writes nothing at all, and a covering window hides the panel and gives it back (mutants: the panel rebuilt per frame; the version compare dropped; covered ignored; covered latching the panel away)', () => {
  const { social, panel, doc } = stand({ members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran'), member('Cyl')] });
  social.applyParty('acct-Bran', { ...POSE });
  social.applyParty('acct-Cyl', { ...POSE, h: 11, hm: 60 });
  panel.render({});
  const bran = panel.cardFor('acct-Bran'), cyl = panel.cardFor('acct-Cyl');
  const branNode = bran.node, branHealth = bran.vitals[0].num, cylHealth = cyl.vitals[0].num;
  // A QUIET FRAME COSTS NOTHING. Sixty of them, and not one property written, not one element made, not one append.
  doc.zero();
  for (let i = 0; i < 60; i++) panel.render({});
  assert.equal(doc.writes, 0, 'the version has not moved: nothing is written');
  assert.equal(doc.built, 0); assert.equal(doc.structure, 0);
  // A POSE MOVES ONE CARD. The nodes are the same nodes; the untouched seat is not written to at all.
  const cylWritesBefore = cylHealth.writes;
  doc.zero();
  social.applyParty('acct-Bran', { ...POSE, h: 12 });
  panel.render({});
  assert.equal(panel.cardFor('acct-Bran').node, branNode, 'the card is the same node - a pose must never rebuild it');
  assert.equal(panel.cardFor('acct-Bran').vitals[0].num, branHealth, 'and so are its parts');
  assert.equal(branHealth.textContent, '12 / 60');
  assert.equal(doc.built, 0, 'no element was made');
  assert.equal(doc.structure, 0, 'and nothing was re-parented: the seat order did not move');
  assert.equal(cylHealth.writes, cylWritesBefore, 'the other seat was not written to - only what changed changes');
  assert.ok(doc.writes > 0 && doc.writes <= 4, `only the moved parts were written (${doc.writes})`);
  // COVERED is the host's word, per frame, and it is not a latch
  doc.zero();
  panel.render({ covered: true });
  assert.equal(panel.root.style.display, 'none', 'a window over the HUD covers the party too');
  panel.render({ covered: true });
  assert.equal(doc.writes, 1, 'and says so once, not once a frame');
  panel.render({ covered: false });
  assert.equal(panel.root.style.display, '', 'the window closes and the party comes back');
  // a change that arrived WHILE covered is drawn on the frame the cover lifts
  panel.render({ covered: true });
  social.applyParty('acct-Cyl', { ...POSE, h: 7, hm: 60 });
  panel.render({ covered: true });
  assert.equal(cylHealth.textContent, '11 / 60', 'nothing is painted under a window');
  panel.render({ covered: false });
  assert.equal(cylHealth.textContent, '7 / 60', 'and the missed change lands the moment it is uncovered');
  // setHidden is the same word said on its own
  panel.setHidden(true);
  assert.equal(panel.root.style.display, 'none');
  panel.setHidden(false);
  assert.equal(panel.root.style.display, '');
  panel.destroy();
  assert.equal(panel.root.removed, true, 'destroy takes the panel off the page');
  panel.render({});
  assert.equal(panel.cardCount(), 0, 'and a frame after it does nothing');
});

test('SOC4: the portrait - loaded off the frame and drawn the moment it lands, CACHED by race|gender|face alone (two seats wearing one face load it once, a face that changes loads once more, a face that comes back loads not at all), the plate standing until then and after a failure that is warned once (mutants: the cache keyed by account; the portrait re-decoded per repaint; a failed load retried every frame; the plate left over a landed face)', async () => {
  const calls = [];
  const img = (w, h, byte) => ({ width: w, height: h, colors: Uint32Array.from({ length: w * h }, () => byte) });
  let fail = false;
  const faceLoader = async (p) => { calls.push(faceKeyOf(p)); if (fail) throw new Error('no FACE00I0.CIF here'); return img(4, 5, 0xff102030); };
  const { social, panel } = stand({
    members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran'), member('Cyl')],
    faceLoader,
  });
  panel.render({});
  await flush();
  assert.deepEqual(calls, [], 'no pose, no face: nothing is fetched for a member we cannot yet draw');
  const bran = panel.cardFor('acct-Bran'), cyl = panel.cardFor('acct-Cyl');
  assert.equal(bran.facebox.className, 'dfparty-face', 'the neutral plate stands');
  social.applyParty('acct-Bran', { ...POSE, race: 'Redguard', gender: 'female', face: 4 });
  social.applyParty('acct-Cyl', { ...POSE, race: 'Redguard', gender: 'female', face: 4 });
  panel.render({});
  assert.deepEqual(calls, [], 'the fetch never runs INSIDE the paint - the frame asks, and waits off it');
  assert.equal(bran.facebox.className, 'dfparty-face', 'and nothing is drawn before the art lands');
  await flush();
  assert.deepEqual(calls, ['Redguard|female|4'], 'two seats, one face, ONE load - the cache is the face, not the person');
  assert.equal(bran.facebox.className, 'dfparty-face has', 'the frame the art lands, the face appears');
  assert.equal(cyl.facebox.className, 'dfparty-face has', 'on both seats, from the one load');
  assert.equal(bran.pix.puts.length, 1);
  assert.deepEqual([bran.pix.width, bran.pix.height], [4, 5], 'the backing store is the record\'s own pixels');
  assert.deepEqual([bran.pix.style.width, bran.pix.style.height], ['64px', '80px'], 'scaled by a WHOLE number - 1996 pixels drawn as pixels');
  assert.deepEqual([...bran.pix.puts[0].data.slice(0, 4)], [0x30, 0x20, 0x10, 0xff], 'the RGBA bytes bitmapToColor32 hands back, in order');
  // a repaint that changes nothing repaints no portrait
  const puts = bran.pix.puts.length;
  social.applyParty('acct-Bran', { ...POSE, race: 'Redguard', gender: 'female', face: 4, h: 1 });
  panel.render({});
  await flush();
  assert.equal(bran.pix.puts.length, puts, 'the same face: not decoded again, not drawn again');
  assert.equal(calls.length, 1);
  // a new face is a new load; the old one is still in hand
  social.applyParty('acct-Bran', { ...POSE, race: 'Redguard', gender: 'female', face: 7 });
  panel.render({});
  assert.equal(bran.facebox.className, 'dfparty-face', 'the plate comes back while the new face is fetched - never the wrong face');
  await flush();
  assert.deepEqual(calls, ['Redguard|female|4', 'Redguard|female|7']);
  assert.equal(bran.pix.puts.length, puts + 1);
  social.applyParty('acct-Bran', { ...POSE, race: 'Redguard', gender: 'female', face: 4 });
  panel.render({});
  await flush();
  assert.equal(calls.length, 2, 'a face that comes back is already in hand');
  // a failure leaves the plate, is said once, and is not asked for again
  fail = true;
  await quiet(async () => {
    social.applyParty('acct-Cyl', { ...POSE, race: 'Khajiit', gender: 'male', face: 1 });
    panel.render({});
    await flush();
    assert.equal(cyl.facebox.className, 'dfparty-face', 'no art, no face - the plate, never a crash');
    for (let i = 0; i < 5; i++) { social.applyParty('acct-Cyl', { ...POSE, race: 'Khajiit', gender: 'male', face: 1, h: 20 + i }); panel.render({}); await flush(); }
  });
  assert.equal(calls.filter((k) => k === 'Khajiit|male|1').length, 1, 'a failed face is remembered as failed - not retried on every repaint');
  assert.equal(faceKeyOf({ race: 'Nord', gender: 'female', face: 99 }), 'Nord|female|9', 'the key clamps the face to the file\'s records');
  assert.equal(faceKeyOf(null), 'Breton|male|0');
});

test('SOC4: createFaceLoader IS the classic path - raceArt names the FACE CIF for the race and gender, the pose\'s index is the RECORD, and the pixels come back through the real CifRciFile walk and bitmapToColor32 (driven over a CIF built byte by byte, no data file and no GL) (mutants: the gender ignored; the record hard-coded; a generated stand-in face)', async () => {
  // A plain CIF is a run of single-frame IMG records: a 12-byte header (xOff, yOff, w, h, compression, length) and
  // then the indexed pixels. Two records, 2x2 each, so the walk has to actually walk to reach the second.
  const rec = (w, h, fill) => {
    const b = new Uint8Array(12 + w * h);
    const v = new DataView(b.buffer);
    v.setInt16(0, 0, true); v.setInt16(2, 0, true); v.setInt16(4, w, true); v.setInt16(6, h, true);
    v.setUint16(8, 0, true); v.setUint16(10, w * h, true);
    b.fill(fill, 12);
    return b;
  };
  const cif = new Uint8Array([...rec(2, 2, 3), ...rec(2, 2, 9)]);
  const asked = [];
  const fetchBytes = async (name) => { asked.push(name); return cif; };
  const palette = { get: (i) => ({ r: i, g: i * 2, b: i * 3 }) };
  const loader = createFaceLoader({ fetchBytes, palette });
  const out = await loader({ race: 'Nord', gender: 'female', face: 1 });
  assert.deepEqual(asked, ['FACE12I0.CIF'], 'systems/races.js raceArt names it: the Nord file, the female set');
  assert.deepEqual([out.width, out.height], [2, 2]);
  assert.deepEqual([...new Uint8Array(out.colors.buffer).slice(0, 4)], [9, 18, 27, 255], 'record 1, through the palette - the SECOND record, so the walk is real');
  const first = await loader({ race: 'Nord', gender: 'female', face: 0 });
  assert.deepEqual([...new Uint8Array(first.colors.buffer).slice(0, 4)], [3, 6, 9, 255], 'record 0');
  assert.equal(asked.length, 1, 'and the file is held: one fetch for every face in it');
  await loader({ race: 'Nord', gender: 'male', face: 0 });
  assert.deepEqual(asked, ['FACE12I0.CIF', 'FACE02I0.CIF'], 'the other gender is the other file');
  assert.equal(await createFaceLoader({})({ race: 'Nord', gender: 'male', face: 0 }), null, 'no art pair handed in: no portrait, and no throw');
  assert.equal(await createFaceLoader({ fetchBytes })({ race: 'Nord', gender: 'male', face: 0 }), null, 'half a pair is no pair either');
  const src = rd('src/ui/partyPanel.js');
  assert.match(src, /import \{ CifRciFile \} from '\.\.\/formats\/cifRciFile\.js';/, 'the paper doll\'s own reader');
  assert.match(src, /import \{ raceArt, FACES_PER_RACE \} from '\.\.\/systems\/races\.js';/);
  assert.match(src, /import \{ bitmapToColor32 \} from '\.\.\/ui\/hud\.js';|import \{ bitmapToColor32 \} from '\.\/hud\.js';/, 'and the HUD\'s own indexed-to-RGBA door');
  assert.match(src, /cif\.getDFBitmap\(record, 0\)/);
  assert.doesNotMatch(src, /innerHTML/, 'a name is text, never markup');
});

// ── THE NAMES OVER THE BODIES ─────────────────────────────────────────────────────────────────────

const FNT = { glyphs: new Map(), ascent: 6, lineHeight: 8, fixedHeight: 8, glyphWidth: () => 5, glyphSpacing: 1 };
const FONT = { fnt: FNT, tex: 'FONT-TEX' };
/** PERF-ON's batched stub: one run a name, and the run carries the colour. */
const recorder = () => {
  const runs = [], quads = [];
  return {
    runs, quads,
    drawScreenQuad: (tex, dst, src, color) => quads.push({ tex, dst, src, color }),
    drawScreenQuadRun: (tex, qs, color) => runs.push({ tex, n: qs.length, color }),
  };
};
const PROJ = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, -1, 0]);
const VIEW = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -10, 1]);
const bodies = (ids) => ids.map((id) => ({ id, name: id.toUpperCase(), shown: { x: 0, y: 0, z: 0, yaw: 0 }, look: null }));

test('SOC4: the names over the bodies - drawNames takes the party colour as its LAST and OPTIONAL argument, so my party\'s tabs are drawn in PARTY_GREEN and everyone else in the white they always were; a caller that passes nothing draws every name white, byte for byte; and a name point carries the PEER id the question is asked of (mutants: the colour applied to everyone; the green leaked to a friend who is not in my party; the default path recoloured; the id dropped from the point)', () => {
  const rp = new RemotePlayers({ renderer: recorder(), deps: null, compose: async () => null });
  // the MWBODY1 arm: a peer standing in a body draws no doll and its name still rides this pass
  rp.sync(bodies(['peer-Bran', 'peer-Stranger']), (p) => [p.x, p.y, p.z], { bodyHeight: () => 1.8 });
  const pts = rp.namePoints(PROJ, VIEW, 1280, 800, [0, 0, 0], (p) => [p.x, p.y, p.z]);
  assert.deepEqual(pts.map((n) => n.id), ['peer-Bran', 'peer-Stranger'], 'the point carries the peer id - the colour is asked about a PEER, not a name');
  // the picture answers: Bran is in my party, the stranger is only a friend
  const social = new SocialState();
  social.apply(stateFrame({
    friends: [{ acct: 'acct-Stranger', name: 'Stranger', online: true, seen: 1e12, peers: ['peer-Stranger'] }],
    party: party([member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran')], 'acct-me'),
  }));
  assert.deepEqual(social.colorOf('peer-Bran'), PARTY_GREEN);
  assert.equal(social.colorOf('peer-Stranger'), null, 'a friend is a list; a party is a formation - only the party is coloured');
  const r = recorder();
  const drawn = rp.drawNames(r, FONT, PROJ, VIEW, 1280, 800, [0, 0, 0], 1, (p) => [p.x, p.y, p.z], null, (id) => social.colorOf(id) ?? null);
  assert.equal(drawn, 2);
  assert.deepEqual(r.runs.map((x) => x.color), [PARTY_GREEN, [1, 1, 1, 1]], 'green over my party\'s body, white over everyone else\'s');
  // THE DEFAULT PATH IS UNTOUCHED: every caller written before the party existed passes nothing
  const plain = recorder();
  assert.equal(rp.drawNames(plain, FONT, PROJ, VIEW, 1280, 800, [0, 0, 0], 1, (p) => [p.x, p.y, p.z]), 2);
  assert.deepEqual(plain.runs.map((x) => x.color), [[1, 1, 1, 1], [1, 1, 1, 1]], 'no colour function, no colour: white, as it always was');
  // a function that answers nothing is the same as no function
  const none = recorder();
  rp.drawNames(none, FONT, PROJ, VIEW, 1280, 800, [0, 0, 0], 1, (p) => [p.x, p.y, p.z], null, () => null);
  assert.deepEqual(none.runs.map((x) => x.color), [[1, 1, 1, 1], [1, 1, 1, 1]]);
  const src = rd('src/net/remotePlayers.js');
  assert.match(src, /drawNames\(renderer, font, proj, view, w, h, eye, scale = 1, toScene = \(p\) => \[p\.x, p\.y, p\.z\], rect = null, colorOf = null\) \{/, 'appended, so every existing call site keeps its meaning');
  assert.match(src, /scale, colorOf\?\.\(n\.id\) \?\? \[1, 1, 1, 1\]\);/, 'and the white is the fallback, not a branch that can be inverted');
  assert.match(src, /out\.push\(\{ id: e\.peer\.id, name: e\.peer\.name \?\? '', x: s\.x, y: s\.y \}\);/, 'the point carries the id');
});

// ── THE HOST ──────────────────────────────────────────────────────────────────────────────────────

test('SOC4: the wiring in scenes/world.js - the panel is made in socialStart over `social` with the ESCORT FACES\' own art pair, driven once a frame from chatFrame after the pose goes out and under the chat\'s own `covered` word, and the name pass asks the picture for the colour (mutants: the panel made per frame; a second fetch door or palette; the panel drawn under a window; the colour hard-coded at the draw)', () => {
  const w = rd('src/scenes/world.js');
  // CHAT1's lesson, taken again: a pin that reads AROUND prose reddens on the prose. The comments come out whole -
  // trailing ones included - so a line of explanation may be written between two lines of law.
  const bare = w.replace(/\/\/[^\n]*/g, ' ');
  assert.match(w, /import \{ createPartyPanel \} from '\.\.\/ui\/partyPanel\.js';/);
  assert.match(bare, /let partyPanel = null;/, 'one handle beside `social`, held for the session');
  assert.match(bare, /partyPanel = createPartyPanel\(\{ social, art: \{ fetchBytes, palette \} \}\);/, 'made ONCE, in socialStart, over the picture');
  assert.match(w, /initEscortFaces\(\{\s*fetchBytes, palette, renderer,/, 'and the pair is the escort faces\' own - one fetch door, one palette');
  assert.equal((w.match(/createPartyPanel\(/g) ?? []).length, 1, 'made in exactly one place - never per frame');
  assert.match(bare, /partyFrame\(performance\.now\(\)\);(?:\s*\w+\?\.render\([^\n]*\);)*\s*partyPanel\?\.render\(\{ covered: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\) \}\);\s*\};/,   // SOC7 integration: SOC3's panel renders on the same line-run, between the pose and this - the tail of the frame is still ours
    'drawn from the chat frame, AFTER the pose goes out, under the same covered word the chat panel takes (CHAT1 pins the lines above it as they stand)');
  assert.match(w, /remotePlayers\.drawNames\(renderer, townTalk\.font, proj, view, canvas\.width, canvas\.height, eye, scale, onlineToScene, largeHudViewportRect\(canvas\.clientHeight\), \(id\) => social\?\.colorOf\(id\) \?\? null\);/,
    'the name pass asks net/social.js for the colour - the host never decides what green means');
  assert.doesNotMatch(bare, /PARTY_GREEN/, 'and the host never carries the colour itself: one home, in the picture');
});

test('SOC4: the panel is a HUD, not a window - fixed at the top-right below the FPS counter, no pointer events, one injected sheet, no markup and no storage key of its own (mutants: the panel over the FPS read-out; the panel eating clicks; a uiPrefs key added without a lane)', () => {
  // AUDIT SOC C6: 92, not 40. The FPS read-out is FOUR LINES with the renderer's counts on - measured at 165x76 in
  // Chromium (top 8, bottom edge 84), not the ~21 this pin used to assume - so the HUD's first portrait was drawn
  // straight through it. 92 clears the read-out by 8; the touch value is untouched, because 76 is the number that
  // clears the touch layer's own top-right buttons and the touch skin never draws the four-line read-out beside it.
  assert.match(PARTY_CSS, /\.dfparty \{ position: fixed; right: calc\(8px \+ env\(safe-area-inset-right, 0px\)\); top: calc\(92px \+ env\(safe-area-inset-top, 0px\)\);/, 'the FPS read-out sits at top 8 and runs to 84 with four lines (ui/fpsCounter.js): 92 clears it');
  assert.match(PARTY_CSS, /pointer-events: none;/, 'the world takes every click that lands on it');
  assert.match(PARTY_CSS, /\.dfparty\.touch \{ top: calc\(76px \+ env\(safe-area-inset-top, 0px\)\); \}/, 'and on touch it clears the layer\'s own top-right buttons (ui/touch.js: top 16, 44 tall)');
  // AUDIT SOC C7: ...and on a PHONE it leaves that corner entirely. At 430x860 with the touch skin the 244px HUD
  // covered 238 of the 402 pixels of every chat peek line - 59% of the conversation - and overlapped the open
  // friends panel besides. 180 wide at the bottom right, above the touch layer's jump column (bottom 16, 48 tall).
  assert.match(PARTY_CSS, /@media \(max-width: 560px\) \{\s*\.dfparty, \.dfparty\.touch \{ width: 180px; top: auto; bottom: calc\(76px \+ env\(safe-area-inset-bottom, 0px\)\); \}/,
    'the phone drops the HUD out of the chat\'s corner rather than merely narrowing it');
  const src = rd('src/ui/partyPanel.js');
  assert.doesNotMatch(src, /getPref|setPref|uiPrefs/, 'the party HUD keeps no setting: it is there when there is a party and gone when there is not');
  assert.doesNotMatch(src, /localStorage|appStorage/);
  assert.match(src, /export const PARTY_STYLE_ID = 'dagger-party-style';/);
  assert.match(src, /if \(doc\.getElementById\?\.\(PARTY_STYLE_ID\)\) return;/, 'the sheet, once');
  // the touch class rides the same flag chatPanel does
  const doc = fakeDocument();
  injectPartyStyle(doc);
  const { panel } = stand({ members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran')], doc, touch: true });
  assert.equal(panel.root.className, 'dfparty touch');
});


// ── THE AUDIT'S OWN PINS ──────────────────────────────────────────────────────────────────────────

test('AUDIT SOC B8/C22: an away seat\'s "last online" TICKS on the live pass, written only where the words changed, and the card\'s name carries its full text as a title (mutants: the sentence computed once inside the version-gated repaint, so a seat that dropped an hour ago still says "just now"; the whole card repainted per frame; an ellipsized name with nowhere to read it whole)', () => {
  const { social, panel, doc, clock } = stand({ members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran'), member('Cyl')] });
  panel.render({});
  const bran = panel.cardFor('acct-Bran'), cyl = panel.cardFor('acct-Cyl');
  // C22: the name node says the whole name, whatever the card's width does to it
  assert.equal(bran.name.attrs.title, 'Bran');
  // a party where EVERYONE is present costs nothing a frame - the live pass has no away seat to re-read
  doc.zero();
  for (let i = 0; i < 60; i++) panel.render({});
  assert.equal(doc.writes, 0, 'sixty quiet frames with nobody away: still not one write');
  // now a seat drops
  social.apply({ t: 'social', k: 'party', party: party([member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran', { online: false, seen: clock.t - 30_000, peers: [] }), member('Cyl')]) });
  panel.render({});
  assert.equal(bran.where.textContent, 'Last online just now');
  const node = bran.where, before = cyl.where.textContent;
  // ...and time passes with NOTHING arriving from the hub: no frame, no version, no repaint
  doc.zero();
  clock.t += 5 * 60_000;
  panel.render({});
  assert.equal(panel.cardFor('acct-Bran').where, node, 'the same node - a write, not a rebuild');
  assert.equal(node.textContent, 'Last online 5 min ago', 'and it says what the clock says');
  assert.equal(doc.built, 0); assert.equal(doc.structure, 0);
  assert.equal(cyl.where.textContent, before, 'the seat that is present was not touched');
  assert.equal(doc.writes, 1, 'exactly the one part whose words moved');
  // and the frames in between write nothing at all
  doc.zero();
  for (let i = 0; i < 30; i++) panel.render({});
  assert.equal(doc.writes, 0, 'thirty frames inside the same minute: the words did not change, so nothing was written');
  // a seat that comes BACK stops being re-read
  social.apply({ t: 'social', k: 'party', party: party([member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran'), member('Cyl')]) });
  panel.render({});
  doc.zero();
  clock.t += 60 * 60_000;
  for (let i = 0; i < 10; i++) panel.render({});
  assert.equal(doc.writes, 0, 'an hour later, and a present member still says where they are');
  // a covered frame re-reads nothing either
  social.apply({ t: 'social', k: 'party', party: party([member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran', { online: false, seen: clock.t, peers: [] }), member('Cyl')]) });
  panel.render({});
  doc.zero();
  panel.render({ covered: true });
  clock.t += 10 * 60_000;
  const under = node.textContent;
  panel.render({ covered: true });
  assert.equal(node.textContent, under, 'nothing is painted under a window');
  panel.render({ covered: false });
  assert.equal(node.textContent, 'Last online 10 min ago', 'and the frame the cover lifts says the truth');
});

test('AUDIT SOC C21: the HUD\'s bar rows carry a ROLE with their label - a bare aria-label on a plain div is dropped, and the digits beside the bar must stay readable (mutants: the role dropped again; role="img", which hides the numbers it labels)', () => {
  const { panel } = stand({ members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran')] });
  panel.render({});
  const card = panel.cardFor('acct-Bran');
  assert.deepEqual(card.vitals.map((v) => v.row.attrs.role), ['group', 'group', 'group']);
  assert.deepEqual(card.vitals.map((v) => v.row.attrs['aria-label']), ['Health', 'Stamina', 'Magicka']);
  assert.ok(card.vitals.every((v) => v.row.attrs.role !== 'img'), 'never img: the digits are the other half of the answer');
  assert.equal(panel.root.attrs.role, 'group');
  assert.equal(panel.root.attrs['aria-label'], 'Party');
});
