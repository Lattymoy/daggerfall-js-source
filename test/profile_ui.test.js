// PROFILE-UI (2026-10-07, Mac: "Lets only organize and polish the player profile. Its a mess"): THE INSPECT CARD, IN
// ORDER. INSPECT1's card had gathered a part from every arc that touched a player - a Renown, a tag, a house, a duelling
// record, the gates, the towns, the serpents - each one more line or one more mark beside the name, and a player showing
// the eighteen glyphs the token can carry squeezed their name to a letter a line. Now: the name keeps its line, the
// glyphs stand on a row of their own under it, the record is a row of plaques, the waiting or the silence is said under
// the head, and what they wear stands in its parts - in hand, armour, clothing, jewellery - a pair one row under the
// plural. tools/profileProbe.mjs stands it in Chromium. The record: bible/06-Systems/Online-Arc.md PROFILE-UI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProfileWindow, profileView, gearRows, gearGroups, gearPartOf, GEAR_PARTS, PROFILE_CSS } from '../src/ui/profileWindow.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { GLYPHS } from '../src/net/identityToken.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** inspect1.test.js's own document for this card: nodes with a class (an SVG's as its attribute), children, a dataset. */
function fakeNode(tag, doc) {
  const n = {
    tag, doc, children: [], attrs: {}, style: {}, dataset: {}, listeners: {}, className: '', textContent: '', id: '',
    append(...cs) { for (const c of cs) if (c) n.children.push(c); },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; },
    addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); },
    focus() { doc.focused = n; }, remove() { n.removed = true; },
  };
  return n;
}
function fakeDoc() {
  const doc = {};
  doc.createElement = (t) => fakeNode(t, doc);
  doc.createElementNS = (ns, t) => fakeNode(t, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = (id) => doc.head.children.find((c) => c.id === id) ?? null;
  return doc;
}
const byClass = (n, cls, out = []) => { if (`${n.className} ${n.attrs?.class ?? ''}`.split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) byClass(c, cls, out); return out; };
const S = EQUIP_SLOTS;
/** A look worn in every part: a sword and a shield in hand, a helm and a cuirass, a cloak twice, two rings. */
const LOOK = { race: 'DarkElf', gender: 'female', faceIndex: 3, class: 'Nightblade', items: [
  { templateIndex: 115, group: 'Weapons', equipSlot: S.RightHand, material: 1 },
  { templateIndex: 109, group: 'Armor', equipSlot: S.LeftHand, material: 0 },
  { templateIndex: 102, group: 'Armor', equipSlot: S.Head, material: 0 },
  { templateIndex: 103, group: 'Armor', equipSlot: S.ChestArmor, material: 0 },
  { templateIndex: 141, group: 'MensClothing', equipSlot: S.Cloak1 },
  { templateIndex: 141, group: 'MensClothing', equipSlot: S.Cloak2 },
  { templateIndex: 135, group: 'Jewellery', equipSlot: S.Ring0 },
  { templateIndex: 135, group: 'Jewellery', equipSlot: S.Ring1 },
] };

test('PROFILE-UI what they wear in its parts - in hand (the shield with the sword), armour, clothing, jewellery, each piece by its own group, a part with nothing in it left out; a pair worn in two slots of one name one row under the plural (mutants: nothing in hand; the parts out of order; a pair two rows; the plural unsaid)', () => {
  assert.deepEqual(GEAR_PARTS.map(([, head]) => head), ['In hand', 'Armour', 'Clothing', 'Jewellery']);
  assert.deepEqual([gearPartOf(S.LeftHand, { group: 'Armor' }), gearPartOf(S.Head, { group: 'Armor' }), gearPartOf(S.Feet, { group: 'MensClothing' }), gearPartOf(S.Ring0, { group: 'Jewellery' })],
    ['hand', 'armour', 'clothing', 'jewellery'], 'a shield in hand; shoes are clothes, by the piece\'s own group');
  const groups = gearGroups(gearRows(LOOK));
  assert.deepEqual(groups.map((g) => [g.head, g.rows.map((r) => [r.slot, r.names.length])]), [
    ['In hand', [['Right hand', 1], ['Left hand', 1]]],
    ['Armour', [['Head', 1], ['Chest', 1]]],
    ['Clothing', [['Cloaks', 2]]],
    ['Jewellery', [['Rings', 2]]],
  ]);
  assert.deepEqual(gearGroups(gearRows({ items: [LOOK.items[2]] })).map((g) => g.head), ['Armour'], 'a part with nothing in it is left out');
  assert.deepEqual(gearGroups([]), []);
});

test('PROFILE-UI the card: the name on its own line, the glyphs on a row of their own under it; the record\'s plaques in one row, each its own words; the waiting said under the head, before the body; the gear in its parts, a pair\'s names one under the other (mutants: the glyphs beside the name; the record as lines; the waiting unsaid)', () => {
  const w = createProfileWindow({ doc: fakeDoc(), win: { addEventListener() {}, removeEventListener() {} } });
  const peer = { id: 'peer-0002', name: 'Bran', title: 'founder', glyphs: [...GLYPHS], lv: 12, gt: 'HND' };
  w.show('peer-0002', profileView({ name: 'Bran', peer, look: LOOK, state: 'asking', record: { wins: 4, losses: 2, gates: { closed: 3 }, raids: { defended: 2 }, serpents: { slain: 1 } } }));
  const card = byClass(w.root, 'dfprofile-card')[0];
  const head = byClass(card, 'dfprofile-head')[0];
  const name = byClass(head, 'dfprofile-name')[0];
  assert.deepEqual(name.children.map((c) => c.className), ['dfprofile-renown', 'dfprofile-nametext', 'dfprofile-guild'], 'the name line: Renown, name, tag - no glyph');
  const row = byClass(head, 'dfprofile-glyphs')[0];
  assert.ok(row, 'the glyphs\' own row');
  assert.equal(head.children.indexOf(row), head.children.indexOf(name) + 1, 'under the name');
  assert.equal(row.children.length, GLYPHS.length, 'every glyph a player shows');
  const record = byClass(head, 'dfprofile-facts')[0];
  assert.deepEqual(record.children.map((f) => [f.className, f.textContent]), [
    ['dfprofile-fact dfprofile-duels', 'Duels: 4 won, 2 lost (K/D 2.00)'],
    ['dfprofile-fact dfprofile-gates', 'Breaches closed: 3'],
    ['dfprofile-fact dfprofile-raids', 'Towns defended: 2'],
    ['dfprofile-fact dfprofile-serpents', 'Serpents slain: 1'],
  ]);
  assert.equal(byClass(head, 'dfprofile-line').length, 1, 'one line under the name: the level, race and class - the record is the plaques\'');
  const note = byClass(card, 'dfprofile-note')[0];
  const body = byClass(card, 'dfprofile-body')[0];
  assert.ok(note && card.children.indexOf(note) === card.children.indexOf(head) + 1 && card.children.indexOf(note) < card.children.indexOf(body), 'the waiting said under the head, before the body');
  const gear = byClass(card, 'dfprofile-gear')[0];
  assert.deepEqual(byClass(gear, 'dfprofile-sub').map((s) => s.textContent), ['In hand', 'Armour', 'Clothing', 'Jewellery']);
  const rings = byClass(gear, 'dfprofile-row').find((r) => r.children[0].textContent === 'Rings');
  assert.deepEqual(rings.children.map((c) => c.className), ['dfprofile-slot', 'dfprofile-items']);
  assert.equal(byClass(rings, 'dfprofile-item').length, 2, 'a pair\'s names one under the other');
  // a peer with no glyph has no glyphs' row; one answered, no record, no plaques
  w.update('peer-0002', profileView({ name: 'Bran', peer: { title: null, glyphs: [] }, look: LOOK, card: { level: 30, attrs: Array(8).fill(50), vitals: [1, 2, 3], look: LOOK }, state: 'answered' }));
  const again = w.root.children[0];
  assert.equal(byClass(again, 'dfprofile-glyphs').length, 0);
  assert.equal(byClass(again, 'dfprofile-facts').length, 0);
  assert.equal(byClass(again, 'dfprofile-note').length, 0, 'answered: nothing to wait on');
  w.destroy();
});

test('PROFILE-UI the sheet: the card wider for what they wear, the name line breaking between its parts and never inside the name, the glyphs\' row wrapping and centred, the plaques, a part\'s name in brass; the probe stands the widest card in a browser (mutants: the name line unwrapped; the card narrow)', () => {
  for (const rule of [
    /\.dfprofile \{[^}]*width: min\(560px, calc\(100vw - 28px\)\);/,
    /\.dfprofile-name \{ display: inline-flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 2px 6px;/,
    /\.dfprofile-glyphs \{ display: flex; flex-wrap: wrap; justify-content: center;/,
    /\.dfprofile-facts \{ display: flex; flex-wrap: wrap; justify-content: center;/,
    /\.dfprofile-sub \{ font-size: 11px;[^}]*color: var\(--brass, #c08a3e\);/,
    /\.dfprofile-items \{ display: flex; flex-direction: column; min-width: 0; \}/,
  ]) assert.match(PROFILE_CSS, rule);
  const probe = src('tools/profileProbe.mjs');
  assert.match(probe, /glyphs: \[\.\.\.GLYPHS\], lv: RENOWN_MAX, gt: 'WWWW'/, 'the widest name line a player can be shown');
  assert.match(probe, /the widest name stands on one line, its glyphs on a row of their own under it/);
  assert.match(probe, /&nointro'\);/, 'the front door\'s film kept out - it took Escape before the card');
});
