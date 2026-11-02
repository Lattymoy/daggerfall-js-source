// APPEARANCES (2026-10-27; bible/10-UI/Collections.md section 9): THE APPEARANCES PART of the Collections page - its tile
// (the character's looks over every look there is, the kit's meter of it), how a look is had, its filters, each kind's group
// under its divider with its own count and meter, a row a look (Worn, Held, or dimmed), and a row opened saying how it is
// had and where it is worn for how much.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawCollectionsPage, resetCollectionsPage, setCollectionsPart, partCount, collectionParts } from '../../src/ui/collectionsPage.js';
import { LOOK_WORDS } from '../../src/ui/collections/appearancesPart.js';
import { noteHeldLooks, wardrobeFee, wearAppearance } from '../../src/systems/appearances.js';
import { lookOfKey } from '../../src/net/appearanceLaw.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { equipItem } from '../../src/systems/equip.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';

function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, dataset: {}, style: {}, title: '', type: '',
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    classList: { contains: (c) => classes.has(c) },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const all = (root, f) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (f(c)) out.push(c); walk(c); } }; walk(root); return out; };
const cls = (root, c) => all(root, (x) => x.classList?.contains(c));
const focus = (root, key) => all(root, (x) => x.attrs?.['data-focus'] === key)[0];
const heads = (root) => all(root, (x) => x.tag === 'h4').map((h) => h.textContent);
function page(player) {
  const box = { root: null };
  const draw = () => {
    box.root = el('div');
    drawCollectionsPage(box.root, draw, { el, divider: (t) => el('h4', 'px-divider', t), meter: (n, m) => el('i', 'px-meter', `${n}/${m}`), player, picture: null });
  };
  draw();
  return box;
}
const armour = (templateIndex, material, variant = 0) => mintCondition(setItemFields({ group: 'Armor', templateIndex, material, variant }));

test('APPEARANCES THE PART: a tile of its own after the account\'s four, every character\'s, its count the character\'s looks over the 473 there are and the kit\'s meter of it; it opens on what is held, by kind, each group its count and meter; Not held and All list the rest; a look worn says so; a row opened says how it is had and where it is worn for its fee (mutants: the tile missing; the count the account\'s; a group\'s count the filter\'s; the fee unsaid; the dimming lost)', () => {
  _resetForTests(); setPref('lootRarity', false);
  resetCollectionsPage();
  const sword = createWeapon(WEAPONS.Longsword, 1), katana = createWeapon(WEAPONS.Katana, 7), chest = armour(102, ARMOR_MATERIAL.Steel, 2);
  const me = { items: [sword, katana, chest], goldPieces: 5000 };
  for (const it of [sword, chest]) equipItem(me, it);
  noteHeldLooks(me);
  wearAppearance(me, sword, lookOfKey('121.7.0'));
  assert.deepEqual(collectionParts(me).map(([id]) => id), ['titles', 'auras', 'armory', 'icons', 'glyphs', 'appearances', 'trophies', 'fish', 'tunes', 'annals'], 'every character\'s, after the account\'s five');   // PIN MOVED (HUNTERS-MARK, at the merge): the gathered parts after it, always shown; PIN MOVED (ARMORY): the Aura Armory's part after Auras
  // PIN MOVED (AUDIT HORIZONTAL E3): 473 looks - chain boots' second style is none
  assert.deepEqual(partCount('appearances', null, me), { held: 3, total: 473 }, 'the character\'s - no account read');
  setCollectionsPart('appearances');
  let p = page(me);
  const tile = focus(p.root, 'coll-part-appearances');
  assert.equal(tile.attrs['aria-pressed'], 'true');
  assert.equal(cls(tile, 'coll-pcount')[0].textContent, '3 / 473');
  assert.equal(cls(tile, 'px-meter')[0].textContent, '3/473', 'the kit\'s meter, held of all');
  assert.equal(cls(p.root, 'coll-looks-how')[0].textContent, LOOK_WORDS.how());
  assert.deepEqual(heads(p.root), ['Chest - 1 / 32', 'Long blades - 2 / 40'], 'Held: the groups with a look held, each its whole count');
  assert.deepEqual(cls(p.root, 'coll-looks-meter').map((m) => m.textContent), ['1/32', '2/40']);
  const rows = cls(p.root, 'coll-row');
  assert.deepEqual(rows.map((r) => cls(r, 'coll-nm')[0].textContent), ['Steel Cuirass, style 2', 'Steel Longsword', 'Ebony Katana']);
  assert.deepEqual(rows.map((r) => cls(r, 'coll-tag').map((x) => x.textContent).join()), ['Held', 'Held', 'Worn'], 'the katana\'s look is worn over the longsword');
  assert.ok(rows.every((r) => r.classList.contains('held')));
  // a row opened
  rows[2].onclick();
  p = { root: null }; p = page(me);
  const whole = cls(p.root, 'coll-whole')[0];
  assert.ok(whole, 'opened under its row');
  assert.deepEqual(all(whole, (x) => x.tag === 'p').map((x) => x.textContent), ['Ebony Katana', LOOK_WORDS.heldLine(), LOOK_WORDS.wearAt('Long blades', wardrobeFee(lookOfKey('121.7.0')))]);
  assert.equal(LOOK_WORDS.wearAt('Long blades', 480), 'Over any piece of its kind (Long blades), at a Clothing Store, an Armorer or a Weaponsmith, for 480 gold.');
  // Not held
  focus(p.root, 'looks-filter-missing').onclick();
  p = page(me);
  const missing = cls(p.root, 'coll-row');
  assert.equal(missing.length, 470, 'every look not held');   // PIN MOVED (AUDIT HORIZONTAL E3): of 473
  assert.ok(missing.every((r) => !r.classList.contains('held')), 'each dimmed');
  assert.equal(heads(p.root).length, 19, 'every kind, its whole count');
  assert.equal(heads(p.root)[0], 'Head - 0 / 72');
  missing[0].onclick();
  p = page(me);
  // PIN MOVED (AUDIT HORIZONTAL E4): no "Hold a" before a name, and a shop's style said as the shop's
  assert.equal(all(cls(p.root, 'coll-whole')[0], (x) => x.tag === 'p')[1].textContent, 'To collect Leather Helm, style 1: buy it, find it or make it.');
  focus(p.root, 'looks-filter-all').onclick();
  p = page(me);
  assert.equal(cls(p.root, 'coll-row').length, 473);
  resetCollectionsPage();
  setCollectionsPart('appearances');
  p = page({ items: [] });
  assert.equal(focus(p.root, 'looks-filter-held').attrs['aria-pressed'], 'true', 'a new visit opens on Held');
  assert.deepEqual(cls(p.root, 'coll-acct').map((x) => x.textContent), [LOOK_WORDS.how(), LOOK_WORDS.none()], 'nothing held: said');
});
