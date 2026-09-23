// PARTY8-B (2026-09-23, Mac, shown three renders of the party HUD and asked "how can we really push the fidelity
// and reduce clutter": "B"): QUIET ROWS - each fact on a seat's row is DRAWN ONLY WHEN IT IS ACTIONABLE.
//
// SOC4's fixture (test/soc4_partyhud.test.js: the fake document with a write counter on every node) is copied
// here rather than shared, the way every chat-shaped test carries its own; the laws pinned are the ones the
// redesign added and SOC4's file does not know: the health digits drawn only under half (HP_DIGITS_BELOW) and in
// the health's red; the place line drawn only for a seat that is NOT where I am (`withMe`, over the host's `here`
// seam - the pose scenes/world.js partyFrame last SENT, never one composed here), and following MY place on the
// live pass without a version moving; a DROP in health flaring the fill (a heal, a first pose and an away seat's
// stale pose do not); the sheet with no plate behind a card; the plate sized to the widest head record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SocialState } from '../src/net/social.js';
import { createPartyPanel, withMe, placeText, PARTY_CSS, HP_DIGITS_BELOW, FACE_BOX_W, FACE_BOX_H, VITALS_BLANK } from '../src/ui/partyPanel.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');


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

const POSE = Object.freeze({ px: 100, py: 200, loc: 'Daggerfall', in: 0, h: 50, hm: 60, f: 1000, fm: 2000, m: 10, mm: 20, race: 'Nord', gender: 'male', face: 2 });
const member = (n, over = {}) => ({ acct: `acct-${n}`, name: n, online: true, seen: 1e12, peers: [`peer-${n}`], p: null, ...over });
const party = (members, leader) => ({ id: 'q-party-1', leader: leader ?? members[0].acct, members });
const stateFrame = (over = {}) => ({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', friends: [], in: [], out: [], party: null, invites: [], ...over });

/** A panel over a party of me, Bran and Cyl, with `here` a box this test moves. */
function stand({ here = { p: null } } = {}) {
  const clock = { t: 1e12 };
  const social = new SocialState({ now: () => clock.t });
  social.apply(stateFrame({ party: party([member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran'), member('Cyl')]) }));
  const doc = fakeDocument();
  const panel = createPartyPanel({ social, doc, faceLoader: async () => null, touch: false, here: () => here.p });
  return { social, panel, doc, clock, here };
}

test('PARTY8-B: the health digits are DRAWN only under half - written for every pose, shown (dfparty-hp, no `off`) when the bar is short, hidden again when it is not, and never for a seat without a pose or away (mutants: the digits always drawn - SOC4\'s clutter back; the threshold at 0, so only the dead say a number; the digits kept up on an away seat\'s stale pose)', () => {
  const { social, panel } = stand();
  panel.render({});
  const bran = panel.cardFor('acct-Bran');
  assert.equal(HP_DIGITS_BELOW, 50, 'half: "is my healer about to die" is a question about the bottom half of the bar');
  assert.equal(bran.hp.className, 'dfparty-hp off', 'no pose: nothing to say, and nothing drawn');
  assert.equal(bran.hp.textContent, VITALS_BLANK);
  social.applyParty('acct-Bran', { ...POSE, h: 50 });
  panel.render({});
  assert.equal(bran.hp.textContent, '50 / 60', 'written...');
  assert.equal(bran.hp.className, 'dfparty-hp off', '...and not drawn: 83% is a bar that says enough on its own');
  social.applyParty('acct-Bran', { ...POSE, h: 29 });
  panel.render({});
  assert.equal(bran.hp.className, 'dfparty-hp', '48%: drawn');
  assert.equal(bran.hp.textContent, '29 / 60');
  social.applyParty('acct-Bran', { ...POSE, h: 30 });
  panel.render({});
  assert.equal(bran.hp.className, 'dfparty-hp off', 'exactly half: the bar is not short yet');
  // away with a stale low pose: the row greys and says when; the digits are not a live reading and are not drawn
  social.applyParty('acct-Bran', { ...POSE, h: 5 });
  panel.render({});
  assert.equal(bran.hp.className, 'dfparty-hp');
  social.apply({ t: 'social', k: 'party', party: party([member('me', { acct: 'acct-me', name: 'Mac' }), member('Bran', { online: false, seen: 1e12 - 60_000, peers: [] }), member('Cyl')]) });
  panel.render({});
  assert.equal(bran.node.className, 'dfparty-card away');
  assert.equal(bran.hp.className, 'dfparty-hp off', 'an away seat\'s last pose is history, not a reading');
  assert.equal(bran.where.className, 'dfparty-where', 'and the place line carries when they were last seen');
  assert.equal(bran.where.textContent, 'Last online 1 min ago');
  // the sheet: the digits sit at the head's right edge in the health's own red, and `off` is display: none
  assert.match(PARTY_CSS, /\.dfparty-hp \{ margin-left: auto; flex: none; font-size: 10px; line-height: 1\.2; color: #e2554c;/);
  assert.match(PARTY_CSS, /\.dfparty-hp\.off \{ display: none; \}/);
  assert.match(PARTY_CSS, /\.dfparty-num \{ display: none; \}/, 'the bars\' own digits stay undrawn (PARTY8)');
});

test('PARTY8-B: the place line is DRAWN only for a seat that is not where I am - `withMe` over placeText\'s words (the name AND the kind), no word for my own place drawing every line, the line following MY place on the live pass with no version moved and written only where it differs (mutants: the place always drawn; the kind ignored, so a companion outside my shop reads as with me; `here` read once at build; the live pass rewriting every seat\'s class per frame)', () => {
  assert.equal(withMe({ ...POSE }, 'Daggerfall'), true);
  assert.equal(withMe({ ...POSE, in: 2 }, 'Daggerfall'), false, 'inside a building in the town I am walking: somewhere else');
  assert.equal(withMe({ ...POSE, loc: 'Wayrest' }, 'Daggerfall'), false);
  assert.equal(withMe({ ...POSE }, ''), false, 'no word for my place: nothing can be said to be with me, so the line is drawn');
  assert.equal(withMe(null, 'Daggerfall'), false);
  assert.equal(placeText({ ...POSE, in: 2 }), 'Daggerfall - inside', 'the words `withMe` compares are the line\'s own');
  const here = { p: null };
  const { social, panel, doc } = stand({ here });
  panel.render({});
  const bran = panel.cardFor('acct-Bran'), cyl = panel.cardFor('acct-Cyl');
  assert.equal(bran.where.className, 'dfparty-where off', 'no pose, no place: not drawn');
  social.applyParty('acct-Bran', { ...POSE });
  social.applyParty('acct-Cyl', { ...POSE, loc: "Privateer's Hold", in: 1 });
  panel.render({});
  assert.equal(bran.where.textContent, 'Daggerfall');
  assert.equal(bran.where.className, 'dfparty-where', 'the host has composed no pose yet: every place is drawn');
  assert.equal(cyl.where.className, 'dfparty-where');
  // the host's first pose lands - in Daggerfall, where Bran is - and NO version moves: the live pass follows it
  here.p = { ...POSE };
  doc.zero();
  panel.render({});
  assert.equal(bran.where.className, 'dfparty-where off', 'Bran is with me: the line goes');
  assert.equal(cyl.where.className, 'dfparty-where', 'Cyl is down a dungeon: hers stays');
  assert.equal(doc.writes, 1, 'exactly the one class whose word moved (Cyl\'s was already right)');
  assert.equal(doc.built, 0); assert.equal(doc.structure, 0);
  // the frames in between, with my place unchanged, write nothing
  doc.zero();
  for (let i = 0; i < 60; i++) panel.render({});
  assert.equal(doc.writes, 0, 'sixty quiet frames: one string compare each, no write');
  // I walk into Cyl's dungeon: her line goes, Bran's comes back
  here.p = { ...POSE, loc: "Privateer's Hold", in: 1 };
  doc.zero();
  panel.render({});
  assert.equal(bran.where.className, 'dfparty-where');
  assert.equal(cyl.where.className, 'dfparty-where off');
  assert.equal(doc.writes, 2);
  // a repaint (a version moved) reads my place as it writes each line - the same answer, by the same rule
  social.applyParty('acct-Bran', { ...POSE, loc: "Privateer's Hold", in: 1 });
  panel.render({});
  assert.equal(bran.where.className, 'dfparty-where off', 'Bran followed me down: with me again');
  assert.match(PARTY_CSS, /\.dfparty-where\.off \{ display: none; \}/);
  // the host: `here` is the pose partyFrame last SENT, stashed beside the send - never composed a second time
  const w = rd('src/scenes/world.js');
  assert.match(w, /_partyPose = composePartyPose\(\);\s*socialLink\(\)\?\.sendParty\(_partyPose\);/, 'one compose, stashed, sent');
  assert.match(w, /here: \(\) => _partyPose \}\);/, 'and read by the panel through the seam');
  assert.equal((w.match(/composePartyPose\(\)/g) ?? []).length, 1, 'composed in exactly one place (AUDIT SOC B18)');
});

test('PARTY8-B: a DROP in health flares the fill - the class flips between two names so a second hit restarts the animation, and a heal, a first pose, an unchanged pose and an away seat\'s pose do not flare (mutants: the flare on every pose; the flare on a heal; one class name, so the second hit in a second is silent)', () => {
  const { social, panel } = stand();
  panel.render({});
  const bran = panel.cardFor('acct-Bran'), fill = bran.vitals[0].fill;
  assert.equal(fill.className, 'dfparty-fill');
  social.applyParty('acct-Bran', { ...POSE, h: 50 });
  panel.render({});
  assert.equal(fill.className, 'dfparty-fill', 'a first pose is not a hit');
  social.applyParty('acct-Bran', { ...POSE, h: 40 });
  panel.render({});
  assert.equal(fill.className, 'dfparty-fill hit', 'a drop: the flare');
  social.applyParty('acct-Bran', { ...POSE, h: 40 });
  panel.render({});
  assert.equal(fill.className, 'dfparty-fill hit', 'the same pose again: nothing new (and nothing written - the class is equal)');
  social.applyParty('acct-Bran', { ...POSE, h: 45 });
  panel.render({});
  assert.equal(fill.className, 'dfparty-fill hit', 'a heal does not flare, and does not clear the name either - the animation has long run out');
  social.applyParty('acct-Bran', { ...POSE, h: 20 });
  panel.render({});
  assert.equal(fill.className, 'dfparty-fill hit2', 'the next hit takes the OTHER name, which restarts the animation with no reflow forced');
  social.applyParty('acct-Bran', { ...POSE, h: 10 });
  panel.render({});
  assert.equal(fill.className, 'dfparty-fill hit');
  assert.match(PARTY_CSS, /@keyframes dfparty-hit \{ 0% \{ filter: brightness\(2\.6\); \} 100% \{ filter: brightness\(1\); \} \}/);
  assert.match(PARTY_CSS, /\.dfparty-fill\.hit \{ animation: dfparty-hit \.6s ease-out; \}\s*\.dfparty-fill\.hit2 \{ animation: dfparty-hit2 \.6s ease-out; \}/);
});

test('PARTY8-B: the sheet - no plate behind a card (no border, fill, blur or radius), the portrait framed 1px with a hard shadow and sized to the widest head record, the health the one 5px bar and stamina/magicka 2px hairlines side by side, the head and the place line under the HUD\'s hard shadow (mutants: the boxed card back; a blurred shadow; the hairlines as tall as the health)', () => {
  const card = PARTY_CSS.match(/\.dfparty-card \{([^}]*)\}/)[1];
  assert.doesNotMatch(card, /border|background|backdrop-filter|border-radius/, 'the card is a row, not a box: ' + card.trim());
  assert.deepEqual([FACE_BOX_W, FACE_BOX_H], [32, 34], 'the widest head record in FACE##I0.CIF measures 31x32: 1x fits, and the plate is no bigger than the face');
  assert.match(PARTY_CSS, /\.dfparty-face \{[^}]*border: 1px solid var\(--iron, #2b323b\);\s*box-shadow: 2px 2px 0 rgba\(0,0,0,0\.6\); \}/, 'a paper-doll cutout: a thin frame and a hard shadow');
  assert.match(PARTY_CSS, /\.dfparty-track \{ flex: 1; min-width: 0; height: 5px; overflow: hidden;/);
  assert.match(PARTY_CSS, /\.dfparty-thin \{ display: flex; gap: 3px; \}\s*\.dfparty-thin \.dfparty-vital \{ flex: 1; min-width: 0; \}\s*\.dfparty-thin \.dfparty-track \{ height: 2px; \}/);
  assert.match(PARTY_CSS, /\.dfparty-head \{[^}]*text-shadow: 2px 2px 0 rgba\(0,0,0,0\.85\); \}/);
  assert.match(PARTY_CSS, /\.dfparty-where \{[^}]*text-shadow: 2px 2px 0 rgba\(0,0,0,0\.85\);/);
  // the structure the sheet dresses: the digits in the head, the two hairlines in one row, the place under the bars
  const { social, panel } = stand();
  panel.render({});
  const bran = panel.cardFor('acct-Bran');
  const body = bran.node.children[1];
  assert.deepEqual(body.children.map((c) => c.className), ['dfparty-head', 'dfparty-bars', 'dfparty-where off']);
  assert.deepEqual(body.children[0].children.map((c) => c.className), ['dfparty-name', 'dfparty-lead off', 'dfparty-hp off']);
  assert.deepEqual(body.children[1].children.map((c) => c.className), ['dfparty-vital health', 'dfparty-thin']);
  assert.deepEqual(body.children[1].children[1].children.map((c) => c.className), ['dfparty-vital fatigue', 'dfparty-vital magicka']);
  assert.equal(find(bran.node, 'dfparty-foot').length, 0, 'PARTY8\'s foot line is gone');
  void social;
});
