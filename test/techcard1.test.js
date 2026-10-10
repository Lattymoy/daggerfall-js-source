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
import { TECHNIQUE_ACTION, TECH_COLOR, CHIP_UNBOUND, techniqueHudChips, _resetTechniquesForTests } from '../src/combat/techniques.js';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { setSigilDueling, _resetSigilForTests } from '../src/systems/sigil.js';
import { techniqueCard, TECH_HOW, TECH_UNBOUND, TECH_DUEL_NOTE } from '../src/ui/techniqueCard.js';
import { TECHNIQUE_GLYPH_ROWS, TECHNIQUE_GLYPH_SVG, TECHNIQUE_GLYPH_BLUE, techniqueGlyphTileSrc } from '../src/ui/techniqueGlyph.js';
import { SIGIL_RUNE_SVG, sigilRuneTileSrc } from '../src/ui/sigilRune.js';
import { TECH_BLOCK_CSS, PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { mountEnhancedInventory, TIP_FITS, CARD_FITS } from '../src/ui/enhancedInventory.js';
import { createBindings, setBinding, clearBinding, actionForCode } from '../src/systems/inputActions.js';
import { actionKeyWord } from '../src/ui/quickslotTags.js';

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

test('TECH-CARD the view: the line techniqueLineOf answers with its roll, its band (a gem\'s line after it or none) and its parts - none where the tier list says nothing of it: the ladder off, a Common, a piece not yet known, or no line (mutants: the unknown piece told; the ladder off told; a Common told; the band off another line; the band off the last line)', () => {
  on();
  const sword = withTech(120, 'leap', 23);
  const v = LR.techniqueCardView(sword);
  assert.deepEqual(v, { id: 'leap', name: 'Leap Strike', value: 23, band: [15, 30], base: 1.4, what: 'Aim: leap 9 m, strike all in 2.5 m, 172%', mult: 1.4 * 1.23, fatigue: 5, cooldown: 12, aims: true });
  assert.deepEqual(LR.techniqueCardView(withTech(120, 'leap', 41, 'legendary')).band, [30, 50], 'a Legendary\'s line reads its band');
  // FINAL AUDIT: a set gem's line stands after the technique's (LOOT20) - the band is the technique line's own, not the last line's
  const gemmed = LR.applyRarity(createWeapon(120, 1), 'rare', lcg(7));
  gemmed.sockets = ['empty'];
  assert.ok(LR.setGem(gemmed, 'flawless-ruby'));
  LR.addTechniqueLine(gemmed, () => 0.5, { id: 'leap' });
  gemmed.isIdentified = true;
  assert.ok(LR.isTechniqueAffix(gemmed.affixes.at(-2)) && gemmed.affixes.at(-1).gem != null, 'the gem\'s line last');
  assert.deepEqual(LR.techniqueCardView(gemmed).band, [15, 30]);
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

test('TECH-CARD the block: the card\'s dress one row at the head - the glyph, the name, the roll and its band - then what a press does whole on its line, then the key, how it is pressed and the price (the fatigue and the recovery, one group); the Info box\'s sets the word over the name and adds the roll on its blow and the press in words; no key says so; a duel sleeps it in both (mutants: the key named when none is bound; the hold for a press; the words swapped; the power off its base; the duel ignored; the Info box awake in a duel)', () => {
  on();
  assert.deepEqual({ ...TECH_HOW }, { aims: 'hold to aim', press: 'press' });
  assert.equal(TECH_UNBOUND, 'no key bound');
  assert.equal(TECH_DUEL_NOTE, 'Sleeps in a duel: never at a player.');
  withDom(() => {
    const sword = withTech(120, 'leap', 23);
    const box = techniqueCard(sword, { keyWord: 'MOUSE3' });
    assert.equal(box.tagName, 'SECTION');
    assert.equal(box.className, 'techbox compact');
    assert.deepEqual([box.dataset.state, box.dataset.technique, box.getAttribute('aria-label')], ['ready', 'leap', 'Technique, Leap Strike']);
    assert.equal(one(box, 'tech-glyph').getAttribute('aria-hidden'), 'true');
    assert.deepEqual(one(box, 'tech-head').children.map((c) => c.className), ['tech-glyph', 'tech-name', 'tech-roll'], 'FINAL AUDIT: one row - the glyph says what it is, as the chip does');
    assert.equal(one(box, 'tech-word'), null, 'the word is the Info box\'s');
    assert.equal(one(box, 'tech-name').textContent, 'Leap Strike');
    assert.equal(text(one(box, 'tech-roll')), '+23% [15-30]');
    assert.equal(one(box, 'tech-roll').title, 'Rolled in 15-30');
    assert.equal(one(box, 'tech-effect').textContent, 'Aim: leap 9 m, strike all in 2.5 m, 172%', 'whole, never cut by the price');
    assert.deepEqual(one(box, 'tech-foot').children.map((c) => [c.className, text(c)]), [
      ['tech-key', 'MOUSE3'], ['tech-how', 'hold to aim'], ['tech-price', '5 fatigue12s'],
    ]);
    assert.deepEqual(one(box, 'tech-price').children.map((c) => [c.className, c.textContent]), [['tech-cost', '5 fatigue'], ['tech-every', '12s']], 'the price one group, so it wraps whole');
    assert.equal(one(box, 'tech-every').title, 'Ready again 12 seconds after a use');
    assert.equal(one(box, 'tech-power'), null, 'the card\'s dress: what a glance needs');
    assert.equal(one(box, 'tech-note'), null);
    // the Info box's: the word over the name, the two numbers tied together, and the press in words
    const full = techniqueCard(sword, { full: true, keyWord: 'MOUSE3' });
    assert.equal(full.className, 'techbox');
    assert.deepEqual(one(full, 'tech-head').children.map((c) => c.className), ['tech-glyph', 'tech-word', 'tech-roll', 'tech-name'], 'the word and the roll on one row, the name the whole width under them (the sheet\'s grid areas)');
    assert.equal(one(full, 'tech-word').textContent, 'Technique');
    assert.equal(one(full, 'tech-power').textContent, '+23% rolled (15-30) on its 140% blow: 172% of a plain blow.');
    assert.equal(one(full, 'tech-press').textContent, 'Hold MOUSE3 to aim its mark, and let go to strike; a tap strikes where you look.');
    // a technique that does not aim goes on the press
    const spin = techniqueCard(withTech(120, 'whirlwind', 15), { full: true, keyWord: 'G' });
    assert.equal(one(spin, 'tech-how').textContent, 'press');
    assert.equal(one(spin, 'tech-press').textContent, 'Press G to strike.');
    assert.equal(one(spin, 'tech-power').textContent, '+15% rolled (15-30) on its 100% blow: 115% of a plain blow.');
    // nothing bound: the foot says so, and the Info box says where to bind it
    const loose = techniqueCard(sword, { full: true });
    assert.equal(one(loose, 'tech-key').className, 'tech-key unbound');
    assert.equal(one(loose, 'tech-key').textContent, 'no key bound');
    assert.equal(one(loose, 'tech-press').textContent, 'Bind Weapon technique in Controls to use it.');
    // law 3: never at a player - a duel sleeps it, and both dresses say why
    setSigilDueling(true);
    try {
      for (const d of [techniqueCard(sword, { keyWord: 'MOUSE3' }), techniqueCard(sword, { full: true, keyWord: 'MOUSE3' })]) {
        assert.equal(d.dataset.state, 'asleep', d.className);
        assert.equal(one(d, 'tech-note').textContent, 'Sleeps in a duel: never at a player.', d.className);
      }
    } finally { setSigilDueling(false); }
    // no technique, an unknown piece: no block (the ladder off is the view's - its own test)
    assert.equal(techniqueCard(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(7))), null);
    sword.isIdentified = false;
    assert.equal(techniqueCard(sword), null);
  });
  assert.equal(techniqueCard(withTech(120, 'leap', 23)), null, 'no document, no block');
  _resetForTests(); _resetSigilForTests();
});

test('TECH-CARD the glyph: its own pixels on the 16px grid - not the sigil\'s rune - drawn into the block in the text\'s colour and outlined in a colour on a tile; the technique\'s blue is the chip\'s and the block\'s, and the Plus sheet lays the block (mutants: the glyph never drawn; a bad colour taken; the block\'s sheet never laid)', () => {
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
  assert.equal(TECHNIQUE_GLYPH_BLUE, RO.TECH_CHIP_COLOUR, 'the glyph\'s blue is the chip\'s');
  assert.ok(TECH_BLOCK_CSS.startsWith(`.techbox { --tech: ${RO.TECH_CHIP_COLOUR};`), 'and the block\'s');
  // FINAL AUDIT: the marks' blue on the ground (combat/techniques.js TECH_COLOR) is the chip's, by value
  const hex = (c) => `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  assert.equal(hex(TECH_COLOR), RO.TECH_CHIP_COLOUR, 'the marks\' blue, the same colour');
  assert.ok(PLUS_CSS.includes(TECH_BLOCK_CSS), 'laid by the Plus sheet');
  assert.ok(PLUS_CSS.indexOf(TECH_BLOCK_CSS) > PLUS_CSS.indexOf('.setbox { position: relative;'), 'the sheet lays it after the set\'s block');
  // FINAL AUDIT: the glyph IS in the block - on a document that keeps what is written into a node (the fake one drops it)
  const prev = globalThis.document;
  globalThis.document = { createElement: (t) => mkEl(t) };
  try {
    on();
    const box = techniqueCard(withTech(120, 'leap', 23), { keyWord: 'MOUSE3' });
    assert.equal(find(box, 'tech-glyph').innerHTML, TECHNIQUE_GLYPH_SVG, 'the block wears the glyph');
    assert.equal(find(techniqueCard(withTech(120, 'leap', 23), { full: true }), 'tech-glyph').innerHTML, TECHNIQUE_GLYPH_SVG, 'both dresses');
  } finally { globalThis.document = prev; _resetForTests(); }
});

test('TECH-CARD the pack, executed: a technique piece\'s hover card and its detail card draw the block right under the tier list and before the sigil\'s block, the list no longer carrying its two lines, the key off the live bindings; its Info box draws it whole after its words and before the sigil, with the key, and its tier list leaves it out too (mutants: the lines left on the card; the block never drawn; the block after the sigil\'s; the hover card without it; the Info box without it, without its key, out of its place, or saying it twice)', () => {
  on();
  const prev = globalThis.location;
  globalThis.location = { search: '?skin=enhanced' };
  try {
    withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const sword = withTech(120, 'leap', 23);
      sword.sigil = { power: 6, party: 3, xp: 7420 };   // a sigil weapon: the order against the sigil's block is a real one
      const e = { name: 'Aelwyn', stats: { strength: 50, endurance: 48 }, items: [sword], goldPieces: 10 };
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
      try {
        assert.equal(actionKeyWord(TECHNIQUE_ACTION), 'MOUSE3', 'the default key, the mouse\'s back side button');
        kids(host, 'packtab').find((t) => /magic/i.test(text(t))).onclick();   // a laddered piece is the Magic tab's (filterByTab)
        const row = host.querySelector('.pack-dock').querySelectorAll('.itemrow')[0];
        /** The block's place among a card's children: right under the tier list, before the sigil's block. */
        const placed = (parent, what) => {
          const order = parent.children.map((c) => String(c.className ?? ''));
          const tb = order.indexOf('techbox compact');
          assert.ok(tb > 0 && order[tb - 1] === 'rarity', `${what}: the block right under the tier list - ${order.join(' | ')}`);
          assert.ok(order.indexOf('sigilbox compact') > tb, `${what}: before the sigil's block - ${order.join(' | ')}`);
          const lines = kids(parent, 'rarity')[0].children.map((li) => li.textContent);
          assert.ok(lines[0] === 'Rare' && !lines.includes('Leap Strike +23% [15-30]') && !lines.some((l) => l.startsWith('Aim: leap')), `${what}: the list leaves the technique to its block - ${lines.join(' | ')}`);
          const box = parent.children[tb];
          assert.equal(one(box, 'tech-name').textContent, 'Leap Strike');
          assert.equal(one(box, 'tech-key').textContent, 'MOUSE3', `${what}: the key the live bindings name`);
        };
        // the hover card (infoCard without a body) - placed beside its row against the window's size
        const hadWindow = 'window' in globalThis;
        if (!hadWindow) globalThis.window = globalThis;
        try { row.onmouseenter(); } finally { if (!hadWindow) delete globalThis.window; }
        const hover = kids(dom.body, 'inv-tip')[0];
        assert.ok(hover, 'the hover card is up');
        placed(kids(hover, 'card')[0], 'the hover card');
        // the detail card (its words in a body)
        row.onclick();
        const tip = kids(host, 'packtip')[0];
        const card = tip && kids(tip, 'card')[0];
        assert.ok(card, 'the card is up');
        placed(kids(card, 'card-body')[0], 'the detail card');
        // the Info box: after its words, before the sigil - whole, with the key - and its tier list without the line
        kids(tip, 'act').find((b) => b.textContent === 'Info').onclick();
        const box2 = kids(dom.body, 'inv-info')[0];
        assert.ok(box2, 'the Info box is up');
        const body = kids(box2, 'inv-info-body')[0];
        const order = body.children.map((c) => String(c.className ?? ''));
        const tb = order.indexOf('techbox');
        assert.ok(tb > order.lastIndexOf('inv-info-box more') && tb > order.indexOf('inv-info-box') && tb < order.indexOf('sigilbox'), `after the words, before the sigil: ${order.join(' | ')}`);
        assert.equal(order.filter((c) => c.startsWith('techbox')).length, 1);
        const full = body.children[tb];
        assert.equal(one(full, 'tech-key').textContent, 'MOUSE3', 'the Info box names the key');
        assert.equal(one(full, 'tech-press').textContent, 'Hold MOUSE3 to aim its mark, and let go to strike; a tap strikes where you look.');
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

test('TECH-CARD the HUD\'s chip, executed: a technique\'s tile wears the technique\'s own glyph in a frame of its blue - the block\'s - and a set power\'s still its set\'s rune (mutants: the chip in the sigil\'s rune; its frame in the kit\'s colour)', async () => {
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
    assert.equal(cells[1].style['--set'], RO.TECH_CHIP_COLOUR, 'in a frame of its blue');
    assert.notEqual(find(cells[1], 'hst-pic').src, sigilRuneTileSrc(RO.TECH_CHIP_COLOUR));
    assert.equal(find(cells[1], 'hst-name').textContent, 'Leap Strike');
    assert.equal(find(cells[0], 'hst-pic').src, sigilRuneTileSrc('#ffae45'), 'a set power keeps its set\'s rune');
  } finally {
    setHudSetChips(null); setHudTechniqueChips(null);
    destroyEnhancedHud();
    globalThis.document = prev;
  }
});

test('FINAL AUDIT the key\'s word: the key that ANSWERS - the primary binding or the secondary (the router answers either), a pad\'s button by its name while a pad is in hand, the key with the keyboard live, a pad\'s button when it is all there is, nothing when nothing is bound (mutants: the primary alone; the pad ignored; the pad\'s code for its name)', () => {
  const store = createBindings();
  const word = (o = {}) => actionKeyWord(TECHNIQUE_ACTION, { bindings: store, controller: false, family: 'xbox', ...o });
  assert.equal(word(), '', 'nothing bound');
  setBinding(store, 'KeyV', TECHNIQUE_ACTION, false);
  assert.equal(actionForCode(store, 'KeyV'), TECHNIQUE_ACTION, 'the secondary answers');
  assert.equal(word(), 'V', 'and is named - the primary alone said "no key bound"');
  setBinding(store, 'Mouse3', TECHNIQUE_ACTION, true);
  assert.equal(word(), 'MOUSE3', 'the primary first');
  setBinding(store, 'JoystickButton2', TECHNIQUE_ACTION, false);
  assert.equal(word(), 'MOUSE3', 'the keyboard live: the key');
  assert.equal(word({ controller: true }), 'X', 'a pad in hand: its button, by name');
  assert.equal(word({ controller: true, family: 'ps' }), 'Square', 'in its family\'s name');
  clearBinding(store, TECHNIQUE_ACTION, true);
  assert.equal(word(), 'X', 'a pad\'s button when it is all there is');
});

test('FINAL AUDIT the chip: with no key bound it says so ("ready" named nothing to press); while a duel sleeps the key it shows none - the set powers\' chips\' law (mutants: the duel ignored; the old word)', () => {
  on(); _resetTechniquesForTests();
  const me = { isPlayer: true, level: 8, items: [], stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(50), fatigue: 6400, health: 100, maxHealth: 100, equip: { slots: [] }, career: {}, activeEffects: [] };
  const pw = new PlayerWeapon({ weapon: withTech(120, 'whirlwind', 20), liveSpeed: 50 });
  pw.sheathed = false; pw.update(0);
  assert.equal(CHIP_UNBOUND, 'unbound');
  assert.deepEqual(techniqueHudChips(me, pw, ''), [{ key: 'technique', set: 'technique', name: 'Whirlwind', text: 'unbound', state: 'active' }]);
  assert.deepEqual(techniqueHudChips(me, pw, () => 'MOUSE3'), [{ key: 'technique', set: 'technique', name: 'Whirlwind', text: 'MOUSE3', state: 'active' }]);
  setSigilDueling(true);
  try { assert.deepEqual(techniqueHudChips(me, pw, 'MOUSE3'), [], 'asleep in a duel: no chip'); } finally { setSigilDueling(false); }
  _resetForTests(); _resetTechniquesForTests();
});

test('FINAL AUDIT the sheet: the card\'s dress one row at the head on the glyph\'s own grid, the Info box\'s two by its areas; the price one group that wraps whole at the right; the asleep grey, the dashed recovery and the rgb the blue\'s; AUDIT SET U9\'s law for the block\'s lines in the pack\'s card; the shrink steps\' share (mutants: the two rows back on the card; the gap on both axes; the glyph at 20px on the card; the price split; a step that sheds nothing; the lines left to the card\'s rule)', () => {
  const body = (sel) => { const at = TECH_BLOCK_CSS.indexOf(`${sel} {`); assert.ok(at >= 0, `the sheet has ${sel}`); return TECH_BLOCK_CSS.slice(at, TECH_BLOCK_CSS.indexOf('}', at)); };
  assert.match(body('.tech-head'), /display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "glyph word roll" "glyph name name";[\s\S]*column-gap: 8px; row-gap: 1px;/);
  assert.match(body('.techbox.compact .tech-head'), /display: flex; align-items: center; flex-wrap: wrap; column-gap: 7px; row-gap: 1px;/);
  assert.doesNotMatch(TECH_BLOCK_CSS, /\.tech-head \{[^}]*[^-]gap: \d+px;/, 'no shorthand gap on a head - on a grid it sets both axes');
  assert.match(body('.techbox.compact .tech-glyph'), /width: 16px; height: 16px;/, 'the card\'s glyph one screen pixel a grid pixel');
  assert.match(body('.techbox.compact .tech-roll'), /margin-left: auto;/);
  assert.match(body('.tech-price'), /margin-left: auto; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;/);
  assert.match(body('.techbox[data-state="asleep"]'), /filter: saturate\(0\.35\);/);
  assert.match(body('.tech-every'), /border: 1px dashed var\(--tech-mid\);/);
  const rgb = RO.TECH_CHIP_COLOUR.slice(1).match(/../g).map((h) => parseInt(h, 16)).join(',');
  assert.ok(TECH_BLOCK_CSS.includes(`--tech-rgb: ${rgb};`), 'the glow is the blue');
  // AUDIT SET U9's law: the pack card's paragraph rule (.pack-shell .card p - centred, 14px, parchment) never dresses the block's lines
  const spec = (sel) => [(sel.match(/#[\w-]+/g) ?? []).length, (sel.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? []).length,
    (sel.replace(/\.[\w-]+|\[[^\]]+\]|#[\w-]+|:[\w-]+/g, ' ').match(/[a-z][\w-]*/gi) ?? []).length];
  const beats = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
  for (const [sel, size, colour] of [['.pack-shell .card .techbox.compact p.tech-effect', '12px', '#e6f6ff'], ['.pack-shell .card .techbox p.tech-note', '11px', '#85a3b5']]) {
    assert.ok(beats(spec(sel), spec('.pack-shell .card p')), `${sel} outranks the card's paragraph`);
    const at = TECH_BLOCK_CSS.indexOf(sel); assert.ok(at >= 0, sel);
    const b = TECH_BLOCK_CSS.slice(at, TECH_BLOCK_CSS.indexOf('}', at));
    assert.match(b, new RegExp(`font-size: ${size};`)); assert.match(b, new RegExp(`color: ${colour};`)); assert.match(b, /text-align: left;/);
  }
  // the shrink steps (CARD-FIT, AUDIT SET U13): how it is pressed and the duel's note first, then the whole foot
  assert.ok(TECH_BLOCK_CSS.includes('.inv-tip.tip-compact .techbox .tech-how, .pack-shell .packtip.packdetail .card.card-compact .techbox .tech-how,\n.inv-tip.tip-compact .techbox .tech-note, .pack-shell .packtip.packdetail .card.card-compact .techbox .tech-note { display: none; }'));
  assert.ok(TECH_BLOCK_CSS.includes('.inv-tip.tip-tight .techbox .tech-foot, .pack-shell .packtip.packdetail .card.card-tight .techbox .tech-foot { display: none; }'));
  assert.deepEqual([...TIP_FITS], ['tip-compact', 'tip-tight']);
  assert.deepEqual([...CARD_FITS], ['card-compact', 'card-tight']);
});
