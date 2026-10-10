// TECH-CARD (2026-10-10, the owner, of the card's two technique lines: "it needs its own unique glyph as its own
// element. Like how set pieces and sigils get their own sections") - bible/05-Combat/Weapon-Techniques.md "The card's
// block". The parts (combat/techniqueRoster.js techniqueParts), the view (systems/lootRarity.js techniqueCardView), the
// tier list that leaves the line to the block, the block in its two dresses (ui/techniqueCard.js) on the fake document
// (test/invdrag.mjs), the glyph (ui/techniqueGlyph.js), and the pack's card, its Info box and the HUD's chip EXECUTED.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withDom } from './invdrag.mjs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as RO from '../src/combat/techniqueRoster.js';
import { TECHNIQUE_ACTION } from '../src/combat/techniques.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { setSigilDueling, _resetSigilForTests } from '../src/systems/sigil.js';
import { techniqueCard, TECH_HOW, TECH_UNBOUND, TECH_DUEL_NOTE } from '../src/ui/techniqueCard.js';
import { TECHNIQUE_GLYPH_ROWS, TECHNIQUE_GLYPH_SVG, TECHNIQUE_GLYPH_BLUE, techniqueGlyphTileSrc } from '../src/ui/techniqueGlyph.js';
import { SIGIL_RUNE_SVG, sigilRuneTileSrc } from '../src/ui/sigilRune.js';
import { TECH_BLOCK_CSS, PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { bindings } from '../src/ui/input.js';
import { getBinding } from '../src/systems/inputActions.js';
import { tagText } from '../src/ui/quickslotTags.js';

const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const on = () => { _resetForTests(); setPref('lootRarity', true); LR._setTechniqueForTests(null); _resetSigilForTests(); };
/** A piece of `template` at `tier` with a chosen technique line at `value`, known. */
const withTech = (template, id, value = 23, tier = 'rare') => {
  const it = LR.applyRarity(createWeapon(template, 1), tier, lcg(7));
  LR.addTechniqueLine(it, () => 0.5, { id });
  LR.techniqueLineOf(it).value = value;
  it.isIdentified = true;
  return it;
};
const kids = (n, cls) => (n.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
/** The fake document's words in a node: its own and its children's (its textContent is a plain field). */
const text = (n) => String(n.textContent ?? '') + (n.children ?? []).map(text).join('');

test('TECH-CARD the parts: what a press does, its multiplier, its price and whether it aims - and the classic line is the same parts in one line; the key\'s action lives in the leaf (mutants: every technique aims; the line off its parts)', () => {
  const AIMS = ['volley', 'pierce', 'leap', 'shadowstep', 'lunge', 'kick'];
  for (const id of RO.TECHNIQUE_IDS) {
    for (const value of [0, 23, 50]) {
      const t = RO.TECHNIQUES[id];
      const p = RO.techniqueParts(id, value);
      assert.equal(p.mult, RO.techniqueMult(t.base, value), id);
      assert.deepEqual([p.fatigue, p.cooldown, p.aims], [t.fatigue, t.cooldown, AIMS.includes(id)], id);
      assert.equal(RO.techniqueBrief(id, value), `${p.what}. ${p.fatigue} fatigue, ${p.cooldown}s`, id);
    }
  }
  assert.deepEqual(RO.techniqueParts('leap', 23), { what: 'Aim: leap 9 m, strike all in 2.5 m, 172%', mult: 1.4 * 1.23, fatigue: 5, cooldown: 12, aims: true });
  assert.equal(RO.techniqueParts('whirlwind', 23).aims, false, 'a technique that does not aim goes on the press');
  assert.equal(RO.techniqueParts('nonesuch', 10), null);
  assert.equal(RO.techniqueBrief('nonesuch', 10), '');
  assert.equal(RO.TECHNIQUE_ACTION, 'WeaponTechnique');
  assert.equal(TECHNIQUE_ACTION, RO.TECHNIQUE_ACTION, 'the runner answers the leaf\'s action');
});

test('TECH-CARD the view: the line techniqueLineOf answers with its roll, its band and its parts - none where the tier list says nothing of it: the ladder off, a Common, a piece not yet known, or no line (mutants: the unknown piece told; the ladder off told; a Common told; the band off another line)', () => {
  on();
  const sword = withTech(120, 'leap', 23);
  const v = LR.techniqueCardView(sword);
  assert.deepEqual(v, { id: 'leap', name: 'Leap Strike', value: 23, band: [15, 30], base: 1.4, what: 'Aim: leap 9 m, strike all in 2.5 m, 172%', mult: 1.4 * 1.23, fatigue: 5, cooldown: 12, aims: true });
  assert.deepEqual(LR.techniqueCardView(withTech(120, 'leap', 41, 'legendary')).band, [30, 50], 'a Legendary\'s line reads its band');
  sword.isIdentified = false;
  assert.equal(LR.techniqueCardView(sword), null, 'a piece not yet identified hides it, as its "Unidentified" hides every line');
  sword.isIdentified = true;
  assert.equal(LR.techniqueCardView({ ...sword, rarity: 'common' }), null, 'a Common has no lines');
  assert.equal(LR.techniqueCardView(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(7))), null, 'no technique, no block');
  assert.equal(LR.techniqueCardView(null), null);
  setPref('lootRarity', false);
  assert.equal(LR.techniqueCardView(sword), null, 'the ladder off says no line at all');
  _resetForTests();
});

test('TECH-CARD the tier list: `technique: false` leaves out exactly the line the block draws and what a press does - every other line where it was; the default keeps them, for the classic tooltip, the Reforge and the trade strip (mutants: every affix dropped; a held line dropped)', () => {
  on();
  const bow = withTech(130, 'volley', 22);
  const all = LR.rarityLines(bow);
  const at = all.indexOf('Volley +22% [15-30]');
  assert.ok(at > 0, all.join(' | '));
  assert.equal(all[at + 1], 'Aim: 6 arrows rain on 3.5 m, 61% each. 6 fatigue, 16s');
  assert.deepEqual(LR.rarityLines(bow, { technique: false }), [...all.slice(0, at), ...all.slice(at + 2)]);
  const plain = LR.applyRarity(createWeapon(130, 1), 'rare', lcg(7));
  plain.isIdentified = true;
  assert.deepEqual(LR.rarityLines(plain, { technique: false }), LR.rarityLines(plain), 'no technique: nothing left out');
  // a record with an empty slot keeps its (empty) line either way - the skip is the block's line alone
  const holed = { ...plain, affixes: [...plain.affixes, null] };
  assert.equal(LR.rarityLines(holed).length, LR.rarityLines(plain).length + 1);
  assert.deepEqual(LR.rarityLines(holed, { technique: false }), LR.rarityLines(holed));
  bow.isIdentified = false;
  assert.deepEqual(LR.rarityLines(bow, { technique: false }), ['Rare', 'Unidentified']);
  _resetForTests();
});

test('TECH-CARD the block: the glyph, the word and the name, the roll and its band; what a press does whole on its line; the key, how it is pressed, the fatigue and the recovery - the Info box\'s dress adds the roll on its blow and the press in words; no key says so; a duel sleeps it (mutants: the key named when none is bound; the hold for a press; the power off its base; the duel ignored)', () => {
  on();
  withDom(() => {
    const sword = withTech(120, 'leap', 23);
    const box = techniqueCard(sword, { keyWord: 'MOUSE3' });
    assert.equal(box.tagName, 'SECTION');
    assert.equal(box.className, 'techbox compact');
    assert.deepEqual([box.dataset.state, box.dataset.technique, box.getAttribute('aria-label')], ['ready', 'leap', 'Technique, Leap Strike']);
    const glyph = one(box, 'tech-glyph');
    assert.equal(glyph.getAttribute('aria-hidden'), 'true');
    assert.deepEqual(one(box, 'tech-head').children.map((c) => c.className), ['tech-glyph', 'tech-word', 'tech-roll', 'tech-name'], 'the word and the roll on one row, the name the whole width under them');
    assert.equal(one(box, 'tech-word').textContent, 'Technique');
    assert.equal(one(box, 'tech-name').textContent, 'Leap Strike');
    assert.equal(text(one(box, 'tech-roll')), '+23% [15-30]');
    assert.equal(one(box, 'tech-roll').title, 'Rolled in 15-30');
    assert.equal(one(box, 'tech-effect').textContent, 'Aim: leap 9 m, strike all in 2.5 m, 172%', 'whole, never cut by the price');
    assert.deepEqual(one(box, 'tech-foot').children.map((c) => [c.className, c.textContent]), [
      ['tech-key', 'MOUSE3'], ['tech-how', TECH_HOW.aims], ['tech-cost', '5 fatigue'], ['tech-every', '12s'],
    ]);
    assert.equal(one(box, 'tech-power'), null, 'the card\'s dress: what a glance needs');
    assert.equal(one(box, 'tech-note'), null);
    // the Info box's: the two numbers tied together, and the press in words
    const full = techniqueCard(sword, { full: true, keyWord: 'MOUSE3' });
    assert.equal(full.className, 'techbox');
    assert.equal(one(full, 'tech-power').textContent, '+23% rolled (15-30) on its 140% blow: 172% of a plain blow.');
    assert.equal(one(full, 'tech-press').textContent, 'Hold MOUSE3 to aim its mark, and let go to strike; a tap strikes where you look.');
    // a technique that does not aim goes on the press
    const spin = techniqueCard(withTech(120, 'whirlwind', 15), { full: true, keyWord: 'G' });
    assert.equal(one(spin, 'tech-how').textContent, TECH_HOW.press);
    assert.equal(one(spin, 'tech-press').textContent, 'Press G to strike.');
    assert.equal(one(spin, 'tech-power').textContent, '+15% rolled (15-30) on its 100% blow: 115% of a plain blow.');
    // nothing bound: the foot says so, and the Info box says where to bind it
    const loose = techniqueCard(sword, { full: true });
    assert.equal(one(loose, 'tech-key').className, 'tech-key unbound');
    assert.equal(one(loose, 'tech-key').textContent, TECH_UNBOUND);
    assert.equal(one(loose, 'tech-press').textContent, 'Bind Weapon technique in Controls to use it.');
    // law 3: never at a player - a duel sleeps it, and the block says why
    setSigilDueling(true);
    const duel = techniqueCard(sword, { keyWord: 'MOUSE3' });
    assert.equal(duel.dataset.state, 'asleep');
    assert.equal(one(duel, 'tech-note').textContent, TECH_DUEL_NOTE);
    setSigilDueling(false);
    // no technique, an unknown piece, the ladder off: no block
    assert.equal(techniqueCard(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(7))), null);
    sword.isIdentified = false;
    assert.equal(techniqueCard(sword), null);
  });
  assert.equal(techniqueCard(withTech(120, 'leap', 23)), null, 'no document, no block');
  _resetForTests(); _resetSigilForTests();
});

test('TECH-CARD the glyph: its own pixels on the 16px grid - not the sigil\'s rune - in the text\'s colour on the card and outlined in a colour on a tile; the technique\'s blue is the chip\'s and the block\'s, and the Plus sheet lays the block (mutants: a bad colour taken; the block\'s sheet never laid)', () => {
  assert.equal(TECHNIQUE_GLYPH_ROWS.length, 16);
  assert.ok(TECHNIQUE_GLYPH_ROWS.every((r) => /^[.#]{16}$/.test(r)), 'the grid');
  const lit = TECHNIQUE_GLYPH_ROWS.join('').split('').filter((c) => c === '#').length;
  assert.equal(lit, 74, 'the three strokes');
  assert.match(TECHNIQUE_GLYPH_SVG, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="M14 1h1v1h-1z/);
  assert.notEqual(TECHNIQUE_GLYPH_SVG, SIGIL_RUNE_SVG);
  // every pixel of the rows is in the path, and nothing else
  const cells = new Set();
  for (const m of TECHNIQUE_GLYPH_SVG.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) for (let x = +m[1]; x < +m[1] + +m[3]; x++) cells.add(`${x},${m[2]}`);
  const want = new Set(TECHNIQUE_GLYPH_ROWS.flatMap((r, y) => [...r].flatMap((c, x) => (c === '#' ? [`${x},${y}`] : []))));
  assert.deepEqual([...cells].sort(), [...want].sort());
  const tile = decodeURIComponent(techniqueGlyphTileSrc().slice('data:image/svg+xml;utf8,'.length));
  assert.match(tile, /viewBox="-1 -1 18 18".*<path fill="#59c7ff" stroke="#050608" stroke-width="2" paint-order="stroke" d="M14 1h1v1h-1z/);
  assert.match(decodeURIComponent(techniqueGlyphTileSrc('#FF0000')), /fill="#ff0000"/);
  assert.equal(techniqueGlyphTileSrc('red'), techniqueGlyphTileSrc(), 'a colour that is not #rrggbb is the technique\'s blue');
  assert.equal(techniqueGlyphTileSrc('#59c7ff'), techniqueGlyphTileSrc(), 'made once a colour');
  assert.equal(TECHNIQUE_GLYPH_BLUE, RO.TECH_CHIP_COLOUR, 'the glyph\'s blue is the chip\'s, which is the marks\'');
  assert.ok(TECH_BLOCK_CSS.startsWith(`.techbox { --tech: ${RO.TECH_CHIP_COLOUR};`), 'and the block\'s');
  assert.ok(PLUS_CSS.includes(TECH_BLOCK_CSS), 'laid by the Plus sheet');
  assert.ok(PLUS_CSS.indexOf(TECH_BLOCK_CSS) > PLUS_CSS.indexOf('.setbox { position: relative;'), 'after the set\'s block, as the card lays the blocks');
});

test('TECH-CARD the pack, executed: a technique piece\'s card draws the block under its tier list and before the other blocks, the list no longer carrying its two lines, the key off the live bindings; its Info box draws it whole and its tier list leaves it out too (mutants: the lines left on the card; the block never drawn; the Info box without it; the Info box saying it twice)', () => {
  on();
  const prev = globalThis.location;
  globalThis.location = { search: '?skin=enhanced' };
  try {
    withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const sword = withTech(120, 'leap', 23);
      const e = { name: 'Aelwyn', stats: { strength: 50, endurance: 48 }, items: [sword], goldPieces: 10 };
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
      try {
        const code = getBinding(bindings(), TECHNIQUE_ACTION);
        const key = code ? tagText(code) : '';
        assert.equal(key, 'MOUSE3', 'the default key, the mouse\'s back side button');
        kids(host, 'packtab').find((t) => /magic/i.test(text(t))).onclick();   // a laddered piece is the Magic tab's (filterByTab)
        host.querySelector('.pack-dock').querySelectorAll('.itemrow')[0].onclick();
        const tip = kids(host, 'packtip')[0];
        const card = tip && kids(tip, 'card')[0];
        assert.ok(card, 'the card is up');
        const lines = kids(card, 'rarity')[0].children.map((li) => li.textContent);
        assert.ok(lines.length > 1 && lines[0] === 'Rare', lines.join(' | '));
        assert.ok(!lines.includes('Leap Strike +23% [15-30]') && !lines.some((l) => l.startsWith('Aim: leap')), 'the list leaves the technique to its block');
        const body = kids(card, 'card-body')[0] ?? card;
        const order = body.children.map((c) => String(c.className ?? ''));
        const tb = order.indexOf('techbox compact');
        assert.ok(tb > 0 && order[tb - 1] === 'rarity', `the block right under the tier list: ${order.join(' | ')}`);
        const box = body.children[tb];
        assert.equal(one(box, 'tech-name').textContent, 'Leap Strike');
        assert.equal(one(box, 'tech-key').textContent, key || TECH_UNBOUND, 'the key the live bindings name');
        // the Info box: the block whole, the tier list without the line
        const info = kids(tip, 'act').find((b) => b.textContent === 'Info');
        info.onclick();
        const box2 = kids(dom.body, 'inv-info')[0];
        assert.ok(box2, 'the Info box is up');
        const full = kids(box2, 'techbox');
        assert.equal(full.length, 1);
        assert.equal(full[0].className, 'techbox', 'whole');
        assert.ok(one(full[0], 'tech-power'));
        const said = kids(box2, 'inv-info-box').flatMap((b) => b.children.map((p) => p.textContent));
        assert.ok(said.includes('Rare'), said.join(' | '));
        assert.ok(!said.includes('Leap Strike +23% [15-30]') && !said.some((l) => l.startsWith('Aim: leap')), 'said once, in the block');
      } finally { view.unmount(); }
    });
  } finally { globalThis.location = prev; _resetForTests(); }
});

const mkEl = (tag = 'div') => ({
  tag, className: '', textContent: '', id: '', rel: '', href: '', src: '', alt: '', children: [], dataset: {},
  style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
  classList: {
    _s: new Set(),
    add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); },
    toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); },
  },
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); },
  getAttribute(k) { return this.attrs[k]; },
  removeAttribute(a) { delete this.attrs[a]; this[a] = ''; }, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...c) { this.children = c; }, addEventListener(type, fn) { (this._on ??= {})[type] = fn; },
});
const find = (node, cls) => {
  if (String(node.className ?? '').split(/\s+/).includes(cls)) return node;
  for (const c of node.children ?? []) { const got = find(c, cls); if (got) return got; }
  return null;
};

test('TECH-CARD the HUD\'s chip, executed: a technique\'s tile wears the technique\'s own glyph in its blue - the block\'s - and a set power\'s still its set\'s rune (mutant: the chip in the sigil\'s rune)', async () => {
  const prev = globalThis.document;
  globalThis.document = {
    createElement: (t) => mkEl(t), createElementNS: (ns) => Object.assign(mkEl(), { ns }),
    getElementById: () => null, head: mkEl(), body: mkEl(), querySelector: () => null, querySelectorAll: () => [],
  };
  const { drawEnhancedHud, destroyEnhancedHud, setHudSetChips, setHudTechniqueChips } = await import('../src/ui/enhancedHud.js');
  const { setHudRenown } = await import('../src/ui/hudRenown.js');
  setHudSetChips(() => [{ key: 'wrath', set: 'ruhn', name: 'Wrath', text: '45s', state: 'active' }]);
  setHudTechniqueChips(() => [{ key: 'technique', set: 'technique', name: 'Leap Strike', text: 'MOUSE3', state: 'active' }]);
  const entity = { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null, activeEffects: [] };
  try {
    setHudRenown(null);
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    const root = document.body.children.find((n) => n.className === 'hud');
    const stat = find(root, 'hud-stat');
    const cells = stat.children.filter((c) => c.dataset.set);
    assert.deepEqual(cells.map((c) => c.dataset.set), ['ruhn', 'technique']);
    assert.equal(find(cells[1], 'hst-pic').src, techniqueGlyphTileSrc(RO.TECH_CHIP_COLOUR), 'the technique\'s own glyph');
    assert.notEqual(find(cells[1], 'hst-pic').src, sigilRuneTileSrc(RO.TECH_CHIP_COLOUR));
    assert.equal(find(cells[1], 'hst-name').textContent, 'Leap Strike');
    assert.equal(find(cells[0], 'hst-pic').src, sigilRuneTileSrc('#ffae45'), 'a set power keeps its set\'s rune');
  } finally {
    setHudSetChips(null); setHudTechniqueChips(null);
    destroyEnhancedHud();
    globalThis.document = prev;
  }
});
