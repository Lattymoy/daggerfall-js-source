// LOOT17 - THE HONE (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 9; Mac: "what could we do to make it even more
// amazing, while also balancing everyrhing?", then "Lets go all in").
//
// At the Reforge, beside each line's Reforge: HONE - the line rolled again within its own band, from one above its value
// to the band's top: never lower and never the same, its kind and its param kept, so its name stands. The price doubles
// with every hone the piece has taken - a Magic's first 1 Welkynd Shard and 50 gold, a Rare's 2 and 150, an Exalted's
// line 4 and 500 - and a line at its top is honed no more. A Perfect Rare becomes a chase with a price: measured through
// the law over 4,000 seeded Rares, a median of 7 hones (254 shards, 19,050 gold) to the top; a Magic's, 2.
//
// Pinned by execution: which lines a hone takes; the hone itself over many seeds (up, within the band, every value
// above reached, the name, the price, the count, a Perfect at the top); the price and its doubling; every refusal, the
// press paid at the price before it and nothing taken when refused; the window's presses, its note and its words; the
// host's hook; the wire's field.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as RF from '../src/systems/reforge.js';
import { welkyndShards } from '../src/systems/gateSpoils.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { equipItem } from '../src/systems/equip.js';
import { validLootItem } from '../src/systems/loot.js';
import { withDom } from './invdrag.mjs';
import { mountReforgeWindow, HONED, HONE_NOTE, REFORGE_REFUSALS, reforgePriceText } from '../src/ui/reforgeWindow.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const known = (it) => Object.assign(it, { isIdentified: true });
const graded = (tier, seed = 1) => known(LR.applyRarity(createWeapon(120, 1), tier, lcg(seed)));
/** A piece with at least one line under its band's top (most are). */
const underTop = (tier, from = 1) => {
  for (let seed = from; seed < from + 200; seed++) { const it = graded(tier, seed); if (LR.honeableLines(it).length === it.affixes.length) return it; }
  throw new Error('no piece wholly under its tops');
};
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;

test('LOOT17: the lines a hone takes - every rolled line of a Magic or a Rare under its band\'s top, an Exalted\'s own line; never a record\'s, a plain Legendary\'s or a Common\'s', () => {
  on();
  const rare = underTop('rare');
  assert.deepEqual(LR.honeableLines(rare), rare.affixes.map((_, i) => i));
  const [, hi] = LR.affixBand(rare, 0);
  rare.affixes[0].value = hi;
  assert.ok(!LR.honeableLines(rare).includes(0), 'a line at its top takes none');
  const magic = underTop('magic');
  assert.deepEqual(LR.honeableLines(magic), magic.affixes.map((_, i) => i), 'a Magic\'s every line');
  const leg = LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(3));
  assert.deepEqual(LR.honeableLines(leg), [], 'a Legendary\'s record lines are its signature');
  LR.exaltLegendary(leg, lcg(4));
  const own = LR.legendaryById(leg.legendary).affixes.length;
  const exalted = leg.affixes[own];
  const [, top] = LR.AFFIX_RANGES[exalted.id].legendary;
  assert.deepEqual(LR.honeableLines(leg), exalted.value < top ? [own] : [], 'an Exalted\'s own line');
  const cursed = LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(3));
  LR.cursePiece(cursed, lcg(5));
  assert.deepEqual(LR.honeableLines(cursed), [], 'a cursed Legendary is no Exalted');
  assert.deepEqual(LR.honeableLines(createWeapon(120, 1)), []);
  assert.deepEqual(LR.honeableLines(null), []);
});

test('LOOT17: a hone takes a line up its band - from one above its value to its top, never lower or the same, every value above it reached; its kind, param and the name kept; the price by its worth; the piece counts it; a Rare honed to every top is Perfect', () => {
  on();
  const base = underTop('rare', 7);
  const i = 0;
  const [lo, hi] = LR.affixBand(base, i);
  base.affixes[i].value = lo;
  const seen = new Set();
  for (let seed = 1; seed < 600; seed++) {
    const it = JSON.parse(JSON.stringify(base));
    const before = { ...it.affixes[i] };
    const line = LR.honeAffix(it, i, lcg(seed));
    assert.ok(line.value > before.value && line.value <= hi, `seed ${seed}: ${before.value} -> ${line.value} in (${before.value}, ${hi}]`);
    assert.deepEqual([line.id, line.param], [before.id, before.param]);
    assert.equal(it.name, base.name, 'the name stands');
    assert.equal(it.value, base.value - LR.affixesWorth([before], it) + LR.affixesWorth([line], it));
    assert.equal(it.honed, 1);
    assert.deepEqual(it.affixes.filter((_, k) => k !== i), base.affixes.filter((_, k) => k !== i), 'the other lines untouched');
    seen.add(line.value);
  }
  assert.equal(seen.size, hi - lo, `every value above ${lo} reached, to ${hi}`);
  // a line one under its top goes to its top; then no more
  const near = JSON.parse(JSON.stringify(base));
  near.affixes[i].value = hi - 1;
  assert.equal(LR.honeAffix(near, i, () => 0).value, hi);
  assert.equal(LR.honeAffix(near, i, () => 0), null, 'at its top: nothing');
  assert.equal(near.honed, 1, 'and nothing counted');
  // honed to every top: Perfect
  const chase = underTop('rare', 30);
  let n = 0;
  while (LR.honeableLines(chase).length) { LR.honeAffix(chase, LR.honeableLines(chase)[0], lcg(++n)); }
  assert.ok(LR.isPerfect(chase));
  assert.equal(LR.tierLabel(chase), 'Perfect Rare');
  assert.equal(chase.honed, n);
  // an Exalted's line, from the Legendary band
  const leg = LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(3));
  LR.exaltLegendary(leg, lcg(4));
  const own = LR.legendaryById(leg.legendary).affixes.length;
  leg.affixes[own].value = LR.affixBand(leg, own)[0];
  const up = LR.honeAffix(leg, own, lcg(2));
  assert.ok(up.value > LR.affixBand(leg, own)[0] && up.value <= LR.AFFIX_RANGES[up.id].legendary[1]);
  assert.equal(LR.honeAffix(leg, 0, lcg(2)), null, 'a record line: nothing');
});

test('LOOT17: the price - a Magic\'s 1 shard and 50, a Rare\'s 2 and 150, an Exalted\'s 4 and 500, doubled with every hone; every refusal; the press paid at the price before it, the shards then the gold, nothing taken when refused', () => {
  on();
  assert.deepEqual(RF.HONE_PRICE, { magic: { shards: 1, gold: 50 }, rare: { shards: 2, gold: 150 }, exalted: { shards: 4, gold: 500 } });
  const rare = underTop('rare', 11);
  assert.deepEqual(RF.honePrice(rare), { shards: 2, gold: 150 });
  assert.deepEqual(RF.honePrice({ ...rare, honed: 1 }), { shards: 4, gold: 300 });
  assert.deepEqual(RF.honePrice({ ...rare, honed: 3 }), { shards: 16, gold: 1200 });
  assert.deepEqual(RF.honePrice(underTop('magic')), { shards: 1, gold: 50 });
  const leg = LR.applyRarity(createWeapon(120, 1), 'legendary', lcg(3));
  assert.equal(RF.honePrice(leg), null, 'a Legendary that is no Exalted');
  LR.exaltLegendary(leg, lcg(4));
  assert.deepEqual(RF.honePrice(leg), { shards: 4, gold: 500 });
  assert.equal(RF.honePrice(createWeapon(120, 1)), null);
  // the refusals
  const me = { items: [rare, welkyndShards(1)], goldPieces: 100 };
  assert.equal(RF.honeRefusal(rare, 0, me), 'shards');
  me.items.push(welkyndShards(5));
  assert.equal(RF.honeRefusal(rare, 0, me), 'gold');
  me.goldPieces = 10000;
  assert.equal(RF.honeRefusal(rare, 0, me), null);
  rare.isIdentified = false;
  assert.equal(RF.honeRefusal(rare, 0, me), 'unknown');
  known(rare);
  const atTop = JSON.parse(JSON.stringify(rare));
  atTop.affixes[1].value = LR.affixBand(atTop, 1)[1];
  me.items.push(atTop);
  assert.equal(RF.honeRefusal(atTop, 1, me), 'top');
  me.items.push(leg); known(leg);
  assert.equal(RF.honeRefusal(leg, 0, me), 'line', 'a record\'s line');
  assert.equal(RF.honeRefusal(createWeapon(120, 1), 0, me), 'not');
  const worn = { isPlayer: true, items: [], skills: new Array(35).fill(30), stats: {}, career: {} };
  const wornPiece = underTop('rare', 40);
  worn.items.push(wornPiece); equipItem(worn, wornPiece);
  assert.equal(RF.honeRefusal(wornPiece, 0, { ...worn, goldPieces: 99999 }), 'worn');
  // the press: paid at the price before it
  const shardsBefore = RF.shardsHeld(me.items);
  const done = RF.honePiece(rare, 0, me, lcg(6));
  assert.equal(done.ok, true);
  assert.deepEqual(done.price, { shards: 2, gold: 150 });
  assert.equal(RF.shardsHeld(me.items), shardsBefore - 2);
  assert.equal(me.goldPieces, 10000 - 150);
  assert.equal(rare.honed, 1);
  assert.deepEqual(RF.honePrice(rare), { shards: 4, gold: 300 }, 'the next, twice');
  // refused, nothing taken
  const poor = { items: [rare, welkyndShards(3)], goldPieces: 5000 };
  const lines = JSON.stringify(rare.affixes);
  assert.deepEqual(RF.honePiece(rare, 1, poor, lcg(6)), { ok: false, reason: 'shards' });
  assert.deepEqual([JSON.stringify(rare.affixes), rare.honed, RF.shardsHeld(poor.items), poor.goldPieces], [lines, 1, 3, 5000]);
  assert.deepEqual(RF.honePiece(rare, 1, { items: [], goldPieces: 99999 }), { ok: false, reason: 'gone' });
  off();
  assert.equal(RF.honeRefusal(rare, 1, me), 'off');
  on();
  // the wire carries the count, and no other shape of it
  assert.ok(validLootItem(JSON.parse(JSON.stringify(rare))));
  for (const bad of [0, -1, 64, 1.5, 'two']) assert.equal(validLootItem({ ...JSON.parse(JSON.stringify(rare)), honed: bad }), null, `honed ${bad}`);
});

test('LOOT17: the window - a Hone press beside each line under its top, its price on the card; none for a line at its top or an unknown piece; a press hones and says so; a short purse says what it lacks; the host hands the law', () => {
  on();
  withDom((dom) => {
    const rare = underTop('rare', 50);
    const [, hi] = LR.affixBand(rare, 1);
    rare.affixes[1].value = hi;   // one line at its top
    const unknown = Object.assign(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(13)), { isIdentified: false });
    const me = { items: [rare, welkyndShards(3), unknown], goldPieces: 200 };
    const calls = [];
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      items: () => me.items, payer: () => me, gold: () => me.goldPieces, picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: () => ({ ok: false }),
      hone: (it, line) => { calls.push(line); return RF.honePiece(it, line, me, lcg(8)); },
    });
    try {
      const shell = one(host, 'reforge-shell');
      kids(shell, 'broker-offer')[0].onclick();
      let card = one(shell, 'reforge-card');
      const lines = kids(card, 'reforge-line');
      assert.equal(one(lines[1], 'hone-press'), null, 'a line at its top: no press');
      const press = one(lines[0], 'hone-press');
      assert.equal(press.textContent, 'Hone');
      assert.equal(press.attrs['aria-label'], `Hone ${LR.affixLine(rare, 0)} for ${reforgePriceText({ shards: 2, gold: 150 })}`);
      assert.ok(textOf(card).includes(HONE_NOTE({ shards: 2, gold: 150 })), 'the price on the card');
      press.onclick({ stopPropagation() {} });
      assert.deepEqual(calls, [0]);
      assert.equal(one(shell, 'broker-note').textContent, HONED(rare.name, LR.affixLine(rare, 0)));
      card = one(shell, 'reforge-card');
      const next = kids(card, 'hone-press')[0];   // a Rare's third line stands under its top still
      assert.equal(next.textContent, 'Need 3 more shards', 'the next costs 4: one in the pack');
      assert.equal(next.attrs.disabled, '');
      assert.equal(next.attrs.title, REFORGE_REFUSALS.shards);
      assert.ok(textOf(card).includes(HONE_NOTE({ shards: 4, gold: 300 })), 'the next price, twice');
      kids(shell, 'broker-offer')[1].onclick();
      assert.equal(kids(one(shell, 'reforge-card'), 'hone-press').length, 0, 'an unknown piece: none');
    } finally { view.unmount(); }
  });
  assert.match(read('src/scenes/worldModes.js'), /hone: \(item, line\) => honePiece\(item, line, playerEntity\),/, 'the guild\'s window hones on the player\'s own');
  assert.equal(REFORGE_REFUSALS.top, 'At the top of its band');
  const garmentPiece = known(LR.applyRarity(mintCondition({ group: 'MensClothing', templateIndex: 155, name: 'Cloak', flags: 0, variant: 0 }), 'rare', lcg(3)));
  assert.deepEqual(LR.honeableLines(garmentPiece), garmentPiece.affixes.map((_, i) => i).filter((i) => garmentPiece.affixes[i].value < LR.affixBand(garmentPiece, i)[1]), 'a garment\'s lines are a Rare\'s (LOOT14)');
});
