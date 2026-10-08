// AUDIT LOOT (2026-10-01; bible/06-Systems/Loot-Arc.md section 16, Mac: "let's do a deep comprehensive audit on this and
// ensure it's perfection") - the whole Loot arc read end to end in seven lanes: the depth (LOOT1-3), the powers (LOOT4-5
// and the champions' traits), the chase (LOOT6-8), the loop (LOOT9-11), online (the item's fields, the relay, the mod
// records, the seeded doors), the bible against the code, and the screens and keys. Every finding fixed is pinned here,
// driven where it can be:
//   F1 an imprint offers, and the wire takes, only a power its piece can use - Chain Lightning off an arrow, Earthshaker
//      off a melee blow
//   F2 a made piece never salvages - its quality's `rarity` broke for shards; shards come from what was found
//   F3 a reforged or imprinted made piece stays off the market - the record mints neither, and the buyer had neither
//   F4 a weapon's power rides every weapon of mine that carries it - a Legendary in one hand and a Rare imprinted with
//      its power in the other were one entry, and the second hand's blows rode nothing
//   F6 the Reforge's window laid: its tabs (the chosen one brass), the Codex's rows of words alone, the salvage's Keep,
//      a card's line with its press - on both skins; the imprint's press said
//   F7 the Codex over the pack has the keys - Back closed the pack under it
//   F8 every Legendary a power, and in the codex - the Thunderlock's Last Lock had none, and its find was said but never
//      listed (the count ran past the rows)
//   F9 a champion's Rare takes the door's last pass - its chance at a line that does something

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as CX from '../src/systems/lootCodex.js';
import { createThunderlock } from '../src/systems/thunderlock.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { validLootItem } from '../src/systems/loot.js';
import { salvageShards, salvageRefusal, salvagePiece } from '../src/systems/reforge.js';
import { mintPiece, asMinted } from '../src/systems/smithItems.js';
import { lootBlow, wornPowers, _resetLootPowersForTests } from '../src/systems/lootPowers.js';
import { equipItem, equipTableOf } from '../src/systems/equip.js';
import { welkyndShards } from '../src/systems/gateSpoils.js';
import { withDom } from './invdrag.mjs';
import { mountReforgeWindow, REFORGE_SKIN_STYLE_ID } from '../src/ui/reforgeWindow.js';
import { REFORGE_CSS } from '../src/ui/enhancedPlusStyle.js';
import { BROKER_SKIN_STYLE_ID } from '../src/ui/brokerWindow.js';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { reforgeDoorOpen, closeReforgeDoor } from '../src/ui/reforgeDoor.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); CX._resetCodexForTests(); _resetLootPowersForTests(); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const known = (it) => Object.assign(it, { isIdentified: true });
const legend = (id, base = null) => {
  const rec = LR.legendaryById(id);
  return known(LR.applyRarity(base ?? createWeapon(rec.templates?.[0] ?? 113, 1), 'legendary', lcg(1), [rec]));
};
const rareOf = (base, seed = 5) => known(LR.applyRarity(base, 'rare', lcg(seed)));
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const PV = '00000000000000a2';

test('AUDIT LOOT F1: an imprint offers, and the wire takes, only a power its piece can use - Chain Lightning off an arrow (a bow, the Thunderlock), Earthshaker off a melee blow', () => {
  on();
  const sword = rareOf(createWeapon(120, 1));
  const bow = rareOf(createWeapon(130, 1));
  const gun = rareOf(createThunderlock());
  const chain = LR.powerOf('stormcaller');
  const quake = LR.powerOf('orsiniums-anvil');
  assert.deepEqual([chain.kind, quake.kind], ['chain', 'quake']);
  assert.deepEqual([LR.powerFits(sword, chain), LR.powerFits(bow, chain), LR.powerFits(gun, chain)], [false, true, true], 'an arrow arcs');
  assert.deepEqual([LR.powerFits(sword, quake), LR.powerFits(bow, quake), LR.powerFits(gun, quake)], [true, false, false], 'a melee blow quakes');
  for (const id of ['nightwhisper', 'direnni-staff', 'glenmoril-bow', 'warp-edge']) assert.ok(LR.powerFits(sword, LR.powerOf(id)) && LR.powerFits(bow, LR.powerOf(id)), `${id}: any weapon`);
  assert.equal(LR.powerFits(null, chain), false);
  assert.equal(LR.powerFits(sword, null), false);
  for (const id of ['stormcaller', 'orsiniums-anvil', 'nightwhisper']) CX.noteFind(legend(id), { quiet: true });
  assert.deepEqual(CX.imprintChoices(sword).map((r) => r.id).sort(), ['nightwhisper', 'orsiniums-anvil'], 'a sword: never the arrows\' arc');
  assert.deepEqual(CX.imprintChoices(bow).map((r) => r.id).sort(), ['nightwhisper', 'stormcaller'], 'a bow: never the ground\'s shake');
  const me = { isPlayer: true, items: [sword, welkyndShards(25)], goldPieces: 6000 };
  assert.equal(CX.imprintRefusal(sword, 'stormcaller', me), 'unfound', 'refused as a power it cannot carry');
  assert.equal(validLootItem({ ...sword, imprint: 'stormcaller' }), null, 'the wire: a sword with the arc');
  assert.equal(validLootItem({ ...bow, imprint: 'orsiniums-anvil' }), null, 'a bow with the quake');
  assert.equal(validLootItem({ ...bow, imprint: 'stormcaller' })?.imprint, 'stormcaller', 'a bow with the arc');
  assert.equal(validLootItem({ ...sword, imprint: 'orsiniums-anvil' })?.imprint, 'orsiniums-anvil', 'a sword with the quake');
});

test('AUDIT LOOT F2: a made piece never salvages - a Masterwork\'s Rare and a Superior\'s Magic are worth no shard, refused with nothing taken', () => {
  on();
  const mw = mintPiece({ recipe: 'longsword:mithril', quality: 4, seed: 9, maker: 'Silverthorn' }, PV);
  const sup = mintPiece({ recipe: 'longsword:mithril', quality: 3, seed: 9 }, '00000000000000a3');
  assert.deepEqual([mw.rarity, sup.rarity], ['rare', 'magic'], 'the quality\'s roll is the ladder\'s');
  assert.deepEqual([salvageShards(mw), salvageShards(sup)], [0, 0]);
  assert.equal(salvageRefusal(mw), 'not');
  const items = [mw];
  assert.deepEqual(salvagePiece(mw, { items }), { ok: false, reason: 'not' });
  assert.deepEqual(items, [mw], 'nothing taken, no shard made');
  const found = { ...mw };
  delete found.provenance;
  assert.equal(salvageShards(found), 3, 'the same Rare found breaks as one');
});

test('AUDIT LOOT F3: a made piece the Reforge rolled again, or one imprinted, is not as its record mints it - the market takes neither', () => {
  on();
  const fresh = () => mintPiece({ recipe: 'longsword:mithril', quality: 4, seed: 9 }, PV);
  const a = fresh();
  assert.equal(asMinted(a), true, 'as made');
  assert.ok(LR.reforgeAffix(a, 0, lcg(3)));
  assert.equal(asMinted(a), false, 'a line rolled again');
  const b = fresh();
  CX.noteFind(legend('nightwhisper'), { quiet: true });
  const me = { isPlayer: true, items: [b, welkyndShards(25)], goldPieces: 6000 };
  assert.deepEqual(CX.imprintPiece(b, 'nightwhisper', me), { ok: true });
  assert.equal(asMinted(b), false, 'a power imprinted');
  assert.match(read('src/scenes/world.js'), /\.filter\(\(it\) => it\?\.provenance && asMinted\(it\) && !tradeRefusal\(it\)/, 'the market\'s pieces ask it');
});

test('AUDIT LOOT F4: a Legendary in one hand and a Rare imprinted with its power in the other - both hands\' blows ride it, whichever the table lists first', () => {
  on();
  const nw = legend('nightwhisper');
  const rare = rareOf(createWeapon(113, 1), 2);
  rare.affixes = rare.affixes.filter((a) => a.id !== 'slayer' && a.id !== 'elemental');
  rare.imprint = 'nightwhisper';
  const foe = { affinity: 'Monster', careerIndex: 0, health: 100, maxHealth: 100 };
  for (const order of [[nw, rare], [rare, nw]]) {
    _resetLootPowersForTests();
    const me = { isPlayer: true, items: [...order], health: 50, maxHealth: 100 };
    for (const it of order) equipItem(me, it);
    assert.equal(equipTableOf(me).filter(Boolean).length, 2, 'both in hand');
    assert.equal(wornPowers(me).filter((p) => p.id === 'nightwhisper').length, 1, 'one power, counted once');
    assert.deepEqual([lootBlow(nw, 100, me, foe, { unaware: true }), lootBlow(rare, 100, me, foe, { unaware: true })], [200, 200], 'Silent Death on either hand\'s blow');
    assert.equal(lootBlow(rare, 100, me, foe, { unaware: false }), 100, 'and only where it says');
  }
  const plain = rareOf(createWeapon(113, 1), 2);
  plain.affixes = rare.affixes;
  const me = { isPlayer: true, items: [nw, plain], health: 50, maxHealth: 100 };
  equipItem(me, nw); equipItem(me, plain);
  assert.equal(lootBlow(plain, 100, me, foe, { unaware: true }), 100, 'a weapon that carries it not: nothing');
  const stray = { ...plain, legendary: 'nightwhisper' };
  assert.equal(lootBlow(stray, 100, me, foe, { unaware: true }), 100, 'an id on a piece that is no Legendary wakes nothing');
});

test('AUDIT LOOT F6: the Reforge\'s window laid - its tabs, the Codex\'s rows, the salvage\'s Keep (a phone\'s too), a card\'s press - on both skins; the chosen tab brass; the imprint\'s card its own (its tier\'s line, its word, said)', () => {
  for (const rule of [
    /\.reforge-tabs \{ display: flex;/, /\.reforge-tabs\[hidden\] \{ display: none; \}/,
    /\.broker-offer\.codex-row, \.broker-offer\.codex-set \{ grid-template-columns: minmax\(0, 1fr\); \}/,
    /\.broker-offer\.codex-row \.broker-set, \.broker-offer\.codex-set \.broker-set \{ white-space: normal; \}/,
    /\.broker-offer > \.reforge-keep \{ grid-column: 4; \}/, /\.broker-offer > \.reforge-keep \{ grid-column: 3; grid-row: 3; \}/,
    /\.reforge-card \.reforge-line, \.imprint-card \.imprint-choice \{ display: flex;/,
    /\.reforge-card \.reforge-press, \.imprint-card \.imprint-press \{ width: auto;/,
  ]) assert.match(REFORGE_CSS, rule);
  assert.match(read('src/ui/enhancedPlusStyle.js'), /\$\{BROKER_CSS\}\n\$\{REFORGE_CSS\}\n/, 'the Plus sheet carries it');
  on();
  const prev = globalThis.location;
  globalThis.location = { search: '?skin=classic' };
  try {
    withDom((dom) => {
      const broker = dom.mk('style');
      broker.id = BROKER_SKIN_STYLE_ID;
      dom.doc.head.append(broker);   // the Broker's window laid his first
      const host = dom.mk('div');
      dom.body.append(host);
      CX.noteFind(legend('nightwhisper'), { quiet: true });
      const rare = rareOf(createWeapon(120, 1));
      const me = { items: [rare, welkyndShards(25)], goldPieces: 6000 };
      const view = mountReforgeWindow(host, { items: () => me.items, payer: () => me, gold: () => me.goldPieces, picture: () => null, nameOf: (it) => it.name, reforge: () => ({ ok: false }), salvage: () => ({ ok: false }), imprint: () => ({ ok: false }) });
      try {
        const ids = dom.doc.head.children.map((c) => c.id);
        assert.deepEqual([ids.filter((i) => i === BROKER_SKIN_STYLE_ID).length, ids.filter((i) => i === REFORGE_SKIN_STYLE_ID).length], [1, 1], 'the window\'s own rules beside his, once');
        assert.equal(dom.doc.head.children.find((c) => c.id === REFORGE_SKIN_STYLE_ID).textContent, REFORGE_CSS);
        const shell = one(host, 'reforge-shell');
        const tab = (p) => kids(shell, 'reforge-tab').find((t) => t.dataset.page === p);
        assert.deepEqual([tab('reforge').classList.contains('on'), tab('codex').classList.contains('on')], [true, false], 'the page it opened on, brass');
        tab('imprint').onclick({ stopPropagation() {} });
        assert.deepEqual([tab('reforge').classList.contains('on'), tab('imprint').classList.contains('on')], [false, true], 'the chosen page, brass');
        const press = kids(shell, 'imprint-press')[0];
        assert.equal(press.attrs['aria-label'], `Imprint Silent Death on ${rare.name} for 20 Welkynd Shards and 5000 gold`, 'said, as the Reforge\'s press is');
        assert.equal(press.textContent, 'Imprint', 'its word its own - it said Reforge');
        const lines = one(one(shell, 'imprint-card'), 'rarity').children;
        assert.deepEqual([lines[0].textContent, lines[1].classList.contains('imprint-choice')], ['Rare', true], 'the tier\'s line first, the choices under it');
      } finally { view.unmount(); }
    });
  } finally { globalThis.location = prev; _resetForTests(); }
});

test('AUDIT LOOT F7: the Codex over the pack has the keys - Back puts the Codex away and keeps the pack; the pack hears nothing while it stands', () => {
  const prev = globalThis.location;
  on();
  globalThis.location = { search: '?skin=enhanced' };
  let exits = 0;
  try {
    withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const e = { name: 'Aelwyn', stats: { strength: 50, endurance: 48 }, items: [{ name: 'Dagger', templateIndex: 113, group: 'Weapons', stackCount: 1, material: 0 }], goldPieces: 10 };
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => { exits++; }, dropItem: () => {} });
      try {
        const key = (k, code = k) => dom.win.fire('keydown', { key: k, code, target: dom.body, repeat: false, preventDefault() {}, stopPropagation() {} });
        host.querySelector('.codexbtn').onclick();
        assert.equal(reforgeDoorOpen(), true, 'the Codex up, over the pack');
        key('F6');
        assert.deepEqual([exits, reforgeDoorOpen()], [0, true], 'the pack hears no key under it');
        key('Escape');
        assert.deepEqual([exits, reforgeDoorOpen()], [0, false], 'Back: the Codex away, the pack kept');
        key('Escape');
        assert.equal(exits, 1, 'a second Back closes the pack');
      } finally { closeReforgeDoor(); view.unmount(); }
    });
  } finally { globalThis.location = prev; _resetForTests(); }
});

test('AUDIT LOOT F8: every Legendary a power - the Thunderlock\'s Last Lock too, its shots at the daedra; and every record in the codex, the count the rows\'', () => {
  on();
  for (const r of LR.allLegendaries()) {
    const p = LR.powerOf(r.id);
    assert.ok(p?.name && p.kind && p.brief && p.brief.length <= 32, `${r.id}: a power, briefed inside the card's 32`);
  }
  const p = LR.powerOf('the-last-lock');
  assert.deepEqual([p.name, p.kind, p.pct, [...p.foes]], ['Dwemer Defiance', 'bane', 50, [...LR.FOE_FAMILIES.daedra]]);
  const lock = legend('the-last-lock', createThunderlock());
  assert.equal(lock.legendary, 'the-last-lock');
  const me = { isPlayer: true, items: [lock], health: 50, maxHealth: 100 };
  equipItem(me, lock);
  const daedra = { affinity: 'Daedra', careerIndex: 26, health: 100, maxHealth: 100 };   // a Fire Daedra
  const rat = { affinity: 'Monster', careerIndex: 0, health: 100, maxHealth: 100 };
  assert.deepEqual([lootBlow(lock, 100, me, daedra, {}), lootBlow(lock, 100, me, rat, {})], [150, 100], 'its shots at the daedra, +50%');
  const row = () => CX.codexRows().find((r) => r.id === 'the-last-lock');
  assert.deepEqual([row().found, row().name, row().hint], [false, null, 'Said to turn up anywhere, once in a great while'], 'listed, unfound, by its own hint');
  for (const r of CX.codexRows()) assert.ok(r.hint, `${r.id}: a hint`);
  CX.noteFind(lock, { quiet: true });
  assert.deepEqual([row().found, row().name, row().power?.name], [true, 'The Last Lock', 'Dwemer Defiance'], 'found, whole');
  assert.deepEqual(CX.codexCount(), { legendary: 1, legendaries: CX.codexRows().length, aetheric: 0, aetherics: CX.codexCount().aetherics, gilded: 0, gildeds: CX.codexGilded().length }, 'the count, the rows\'');
  assert.ok(CX.imprintChoices(rareOf(createWeapon(120, 1))).some((r) => r.id === 'the-last-lock'), 'its power a found one to imprint');
});

