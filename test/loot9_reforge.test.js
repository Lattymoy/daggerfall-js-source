// LOOT9 - SALVAGE, AND THE REFORGE (2026-10-01; bible/06-Systems/Loot-Arc.md section 11, Mac: "Do you wanna turn this
// into an arc and do all of the above?" - "Salvage and reroll: break unwanted Magic+ items into a crafting material ...
// spend it at the Mages Guild to reroll one affix"). The laws pinned here:
//   - THE SHARD: template 571 beside the Sigil Stone - stacking with its own kind, BOUND (the realm's list names it).
//   - SALVAGE: Magic 1, Rare 3, Legendary 8, Exalted 15 - only a piece the ladder graded; never an Aetheric piece, an
//     artifact, a quest's, a bound, worn or locked one; all of it or none of it.
//   - THE REFORGE: a Magic's or Rare's every line, an Exalted Legendary's own extra line, never a record's; once reforged,
//     that line alone. The line rolled again from its tier's pool - never a kind or param another line carries, a proc
//     a proc, a Rare's slot kept - the name and the price following; paid in shards then gold, nothing taken when refused.
//   - THE FACES: the window (both pages), the pack card's Salvage, the Mages Guild Identify popup's fourth row on both
//     skins, and the host's hook.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as RF from '../src/systems/reforge.js';
import { WELKYND_SHARD_TEMPLATE, WELKYND_SHARD_TEMPLATES, welkyndShards, isWelkyndShard, SIGIL_STONE_TEMPLATE } from '../src/systems/gateSpoils.js';
import { BOUND_TEMPLATES } from '../src/net/realmTradeLaw.js';
import { isBound } from '../src/systems/itemBound.js';
import { setLocked } from '../src/systems/itemLock.js';
import { addItem, LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { validLootItem } from '../src/systems/loot.js';
import { equipItem } from '../src/systems/equip.js';
import { withDom } from './invdrag.mjs';
import { mountReforgeWindow, reforgeLabel, reforgePurseText, reforgePriceText, REFORGED, SALVAGED, REFORGE_REFUSALS } from '../src/ui/reforgeWindow.js';
import { GuildServiceWindow, REFORGE_RECT, REFORGE_ROW, REFORGE_KEY, PANEL_X, PANEL_Y, _setGuildServiceArtForTests } from '../src/ui/guildServiceWindow.js';
import { destroyEnhancedNotice } from '../src/ui/enhancedNotice.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { mountEnhancedInventory, SALVAGE_ASK } from '../src/ui/enhancedInventory.js';
import { _resetForTests as _resetPrefsForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); };
const off = () => { _resetForTests(); setPref('lootRarity', false); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const known = (it) => Object.assign(it, { isIdentified: true });
const graded = (tier, seed = 1, template = 113) => known(LR.applyRarity(createWeapon(template, 1), tier, lcg(seed)));
const shards = (n) => welkyndShards(n);
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;

test('LOOT9: the Welkynd Shard - template 571 beside the Stone, stacking with its own kind, bound everywhere', () => {
  assert.equal(WELKYND_SHARD_TEMPLATE, 571);
  assert.equal(WELKYND_SHARD_TEMPLATE, SIGIL_STONE_TEMPLATE + 1, 'beside the Stone');
  const row = templateByIndex(WELKYND_SHARD_TEMPLATE);
  assert.equal(row?.name, 'Welkynd Shard');
  assert.deepEqual([row.stackable, row.bound, row.worldTextureArchive, row.worldTextureRecord], [true, true, 254, 2], 'stacks, bound, the Sapphire\'s art');
  assert.deepEqual(WELKYND_SHARD_TEMPLATES.map((t) => t.index), [571]);
  const s = welkyndShards(3);
  assert.deepEqual([s.templateIndex, s.group, s.stackCount, isWelkyndShard(s), isBound(s)], [571, 'Gems', 3, true, true]);
  assert.deepEqual([welkyndShards(0).stackCount, welkyndShards(-2).stackCount], [1, 1], 'at least one');
  assert.ok(BOUND_TEMPLATES.includes(WELKYND_SHARD_TEMPLATE), 'the realm\'s service refuses it too');
  const pack = [welkyndShards(2)];
  addItem(pack, welkyndShards(5));
  assert.deepEqual(pack.map((it) => it.stackCount), [7], 'one stack');
});

test('LOOT9: salvage - Magic 1, Rare 3, Legendary 8, Exalted 15; only a graded piece; never the Aetheric, an artifact, a quest\'s, a bound, worn or locked one; off nothing', () => {
  on();
  assert.deepEqual(RF.SALVAGE_SHARDS, { magic: 1, rare: 3, legendary: 8, exalted: 15 });
  const leg = graded('legendary', 2);
  const ex = graded('legendary', 3);
  LR.exaltLegendary(ex, lcg(4));
  assert.deepEqual([graded('magic'), graded('rare'), leg, ex].map(RF.salvageShards), [1, 3, 8, 15]);
  assert.equal(RF.salvageShards(createWeapon(113, 1)), 0, 'a Common');
  assert.equal(RF.salvageShards({ ...createWeapon(113, 1), magic: true, enchantments: [{ type: 1, param: 2 }] }), 0, 'DFU\'s own magic - never graded');
  assert.equal(RF.salvageRefusal(createWeapon(113, 1)), 'not');
  assert.equal(RF.salvageRefusal({ ...graded('rare'), rarity: 'aetheric' }), 'aetheric');
  assert.equal(RF.salvageRefusal({ ...graded('rare'), rarity: 'gilded' }), 'gilded', 'GILDED1: a static roll never breaks');
  assert.equal(RF.salvageRefusal({ ...graded('rare'), artifact: true }), 'artifact');
  assert.equal(RF.salvageRefusal({ ...graded('rare'), questItem: true }), 'quest');
  assert.equal(RF.salvageRefusal({ ...graded('rare'), bound: true }), 'bound');
  const locked = graded('rare');
  setLocked(locked, true);
  assert.equal(RF.salvageRefusal(locked), 'locked');
  const worn = graded('rare');
  const e = { items: [worn] };
  equipItem(e, worn);
  assert.equal(RF.salvageRefusal(worn), 'worn');
  // made: the piece out, its shards in - onto the pack's unlocked stack, never a locked one
  const piece = graded('rare', 5);
  const kept = shards(2);
  setLocked(kept, true);
  const pack = [piece, kept, shards(1)];
  assert.deepEqual(RF.salvagePiece(piece, { items: pack }), { ok: true, shards: 3 });
  assert.ok(!pack.includes(piece));
  assert.deepEqual(pack.filter(isWelkyndShard).map((s) => [s.stackCount, !!s.locked]), [[2, true], [4, false]]);
  const none = [locked];
  assert.deepEqual(RF.salvagePiece(locked, { items: none }), { ok: false, reason: 'locked' });
  assert.deepEqual(none, [locked], 'all or nothing');
  assert.deepEqual(RF.salvagePiece(graded('magic'), { items: [] }), { ok: false, reason: 'gone' });
  off();
  const p2 = graded('rare');
  assert.deepEqual(RF.salvagePiece(p2, { items: [p2] }), { ok: false, reason: 'off' });
});

test('LOOT9: the purse - unlocked shards alone; a spend takes from the stacks, an emptied one out; short, nothing taken', () => {
  const locked = shards(9);
  setLocked(locked, true);
  const pack = [shards(2), locked, shards(3)];
  assert.equal(RF.shardsHeld(pack), 5, 'a locked stack is the player\'s word to keep it');
  assert.equal(RF.spendShards(pack, 6), false);
  assert.equal(RF.shardsHeld(pack), 5, 'short: nothing taken');
  assert.equal(RF.spendShards(pack, 4), true);
  assert.deepEqual(pack.map((s) => s.stackCount), [1, 9], 'the last stack spent first and gone, the first one less');
  assert.equal(RF.spendShards(pack, 0), true);
  assert.deepEqual([RF.shardsText(1), RF.shardsText(3)], ['1 Welkynd Shard', '3 Welkynd Shards']);
});

test('LOOT9: the lines the Reforge may take - a Magic\'s or Rare\'s every line, an Exalted\'s extra line, never a record\'s; once reforged, that line', () => {
  on();
  const m = graded('magic', 1), r = graded('rare', 2), leg = graded('legendary', 3);
  assert.deepEqual(LR.reforgeableLines(m), m.affixes.map((_, i) => i));
  assert.deepEqual(LR.reforgeableLines(r), r.affixes.map((_, i) => i));
  assert.deepEqual(LR.reforgeableLines(leg), [], 'a record\'s lines never');
  LR.exaltLegendary(leg, lcg(9));
  assert.deepEqual(LR.reforgeableLines(leg), [leg.affixes.length - 1], 'its own extra line');
  assert.deepEqual(LR.reforgeableLines(createWeapon(113, 1)), []);
  r.reforged = 1;
  assert.deepEqual(LR.reforgeableLines(r), [1], 'once reforged, that line alone');
  assert.equal(validLootItem(r)?.reforged, 1, 'the mark rides the wire and the save');
  for (const bad of ['1', -1, 16, 1.5]) assert.equal(validLootItem({ ...r, reforged: bad }), null, `a forged mark (${bad}) refused`);
});

test('LOOT9: the roll - never a kind or param another line carries; a proc stays a proc; a Rare keeps its slot and its name both parts; an Exalted line from the top half; the name and the price follow', () => {
  on();
  const slot = (a) => LR.AFFIX_KINDS[a.id].slot;
  let sameKind = 0, changed = 0;
  for (let seed = 1; seed <= 300; seed++) {
    for (const tier of ['magic', 'rare']) {
      const it = graded(tier, seed, seed % 2 ? 113 : 120);
      LR.addProcLine?.(it, lcg(seed + 7));
      const i = seed % it.affixes.length;
      const old = it.affixes[i];
      const others = it.affixes.filter((_, k) => k !== i).map((a) => ({ ...a }));
      const before = it.value;
      const line = LR.reforgeAffix(it, i, lcg(seed * 3));
      assert.ok(line && LR.validAffix(line), `${tier} ${seed}`);
      assert.deepEqual(it.affixes.filter((_, k) => k !== i), others, 'the other lines untouched');
      for (const a of others) assert.ok(!(a.id === line.id && (LR.AFFIX_KINDS[a.id].params ? a.param === line.param : true)), 'never a kind or param another line carries');
      assert.equal(!!LR.AFFIX_KINDS[line.id].proc, !!LR.AFFIX_KINDS[old.id].proc, 'a proc stays a proc, a number a number');
      const [lo, hi] = LR.AFFIX_RANGES[line.id][tier];
      assert.ok(line.value >= lo && line.value <= hi, 'its tier\'s range');
      if (tier === 'rare') {
        assert.equal(slot(line), slot(old), 'a Rare\'s slot kept');
        const named = (sl) => it.affixes.some((a) => slot(a) === sl && !LR.AFFIX_KINDS[a.id].proc);
        assert.ok(named('prefix') && named('suffix'), 'its name keeps both parts');
      }
      assert.equal(it.name, LR.rarityName(it, tier, it.affixes), 'the name follows');
      assert.equal(it.value, before - LR.affixesWorth([old]) + LR.affixesWorth([line]), 'the price follows');
      assert.equal(it.reforged, i);
      if (line.id === old.id) sameKind++; else changed++;
    }
  }
  assert.ok(sameKind > 50 && changed > 50, `the same kind may come back, and often another (${sameKind}, ${changed})`);
  for (let seed = 1; seed <= 60; seed++) {
    const leg = graded('legendary', seed);
    const name = leg.name;
    if (!LR.exaltLegendary(leg, lcg(seed + 1))) continue;
    const i = leg.affixes.length - 1;
    const line = LR.reforgeAffix(leg, i, lcg(seed + 2));
    const [lo, hi] = LR.AFFIX_RANGES[line.id].legendary;
    assert.ok(line.value >= Math.ceil((lo + hi) / 2) && line.value <= hi, 'the top half of the Legendary band');
    assert.equal(leg.name, name, 'a Legendary keeps its record\'s name');
    assert.equal(LR.reforgeAffix(leg, 0, lcg(1)), null, 'a record\'s line never');
  }
});

test('LOOT9: the price and the press - Magic 2 and 100, Rare 4 and 400, Exalted 10 and 2,000; refused in words with nothing taken; paid shards then gold', () => {
  on();
  assert.deepEqual(RF.REFORGE_PRICE, { magic: { shards: 2, gold: 100 }, rare: { shards: 4, gold: 400 }, exalted: { shards: 10, gold: 2000 } });
  const ex = graded('legendary', 3);
  LR.exaltLegendary(ex, lcg(4));
  assert.deepEqual([graded('magic'), graded('rare'), ex, graded('legendary', 5)].map(RF.reforgePrice), [RF.REFORGE_PRICE.magic, RF.REFORGE_PRICE.rare, RF.REFORGE_PRICE.exalted, null]);
  const piece = graded('rare', 7);
  const me = { items: [piece, shards(3)], goldPieces: 1000 };
  const was = JSON.stringify(piece);
  assert.deepEqual(RF.reforgePiece(piece, 0, me, lcg(1)), { ok: false, reason: 'shards' });
  me.items.push(shards(5));
  me.goldPieces = 399;
  assert.deepEqual(RF.reforgePiece(piece, 0, me, lcg(1)), { ok: false, reason: 'gold' });
  assert.equal(JSON.stringify(piece), was, 'refused: the piece as it was');
  assert.deepEqual([RF.shardsHeld(me.items), me.goldPieces], [8, 399], 'and nothing taken');
  me.goldPieces = 1000;
  const unknown = Object.assign(LR.applyRarity(createWeapon(113, 1), 'rare', lcg(8)), { isIdentified: false });
  me.items.push(unknown);
  assert.equal(RF.reforgeRefusal(unknown, 0, me), 'unknown', 'the guild identifies it first');
  const r = RF.reforgePiece(piece, 2, me, lcg(2));
  assert.equal(r.ok, true);
  assert.deepEqual([RF.shardsHeld(me.items), me.goldPieces], [4, 600], 'four shards and four hundred gold');
  assert.deepEqual(RF.reforgePiece(piece, 0, me, lcg(3)), { ok: false, reason: 'line' }, 'once reforged, only that line');
  assert.equal(RF.reforgePiece(piece, 2, me, lcg(3)).ok, true, 'that line again');
  const worn = graded('magic', 2);
  const w = { items: [worn, shards(9)], goldPieces: 999 };
  equipItem(w, worn);
  assert.equal(RF.reforgeRefusal(worn, 0, w), 'worn');
  assert.deepEqual(RF.reforgePiece(graded('magic'), 0, w, lcg(1)), { ok: false, reason: 'gone' });
  assert.equal(RF.reforgeRefusal(graded('legendary', 9), 0, w), 'not');
  // a letter of credit pays as gold does (court.deductGold, DFU's purse-then-letters law)
  const m2 = graded('magic', 4);
  const letters = { items: [m2, shards(2), { templateIndex: LETTER_OF_CREDIT_TEMPLATE, group: 'MiscItems', value: 500, name: 'Letter of Credit' }], goldPieces: 0 };
  assert.equal(RF.reforgeRefusal(m2, 0, letters), null, 'a letter is gold to the purse');
  assert.equal(RF.reforgePiece(m2, 0, letters, lcg(5)).ok, true);
  assert.equal(letters.items.find((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE)?.value, 400, 'the letter pays');
  off();
  assert.equal(RF.reforgeRefusal(graded('magic'), 0, me), 'off');
});

test('LOOT9: the window - the purse, both pages, a piece whole with a press on each line it may roll, why not in a word; a salvage asked before it breaks', () => {
  on();
  withDom((dom) => {
    const rare = graded('rare', 11);
    const magic = graded('magic', 12);
    const plain = createWeapon(113, 1);
    const unknown = Object.assign(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(13)), { isIdentified: false });
    const me = { items: [rare, magic, plain, shards(5), unknown], goldPieces: 450 };
    const calls = [];
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, {
      items: () => me.items, payer: () => me, gold: () => me.goldPieces, picture: () => null, nameOf: (it) => it.name,
      reforge: (it, line) => { calls.push(['reforge', line]); return RF.reforgePiece(it, line, me, lcg(4)); },
      salvage: (it) => { calls.push(['salvage']); return RF.salvagePiece(it, { items: me.items }); },
    });
    try {
      const shell = one(host, 'reforge-shell');
      assert.ok(shell);
      assert.equal(shell.attrs.role, 'dialog');
      assert.equal(one(shell, 'broker-purse').textContent, reforgePurseText(5, 450));
      let rows = kids(shell, 'broker-offer');
      assert.equal(rows.length, 3, 'the three the Reforge takes - never a Common');
      rows[2].onclick();
      const hidden = one(shell, 'reforge-card');
      assert.ok(textOf(hidden).includes('Unidentified'), 'an unknown piece says so');
      assert.equal(kids(hidden, 'reforge-line').length, 0, 'and not one of its lines');
      assert.equal(kids(hidden, 'reforge-press').length, 0);
      rows[0].onclick();
      assert.equal(one(rows[0], 'broker-price').textContent, reforgePriceText(RF.REFORGE_PRICE.rare));
      const card = one(shell, 'reforge-card');
      const lines = kids(card, 'reforge-line');
      assert.equal(lines.length, rare.affixes.length, 'every line, each with its press');
      const presses = kids(card, 'reforge-press');
      assert.equal(presses[0].textContent, 'Reforge');
      presses[0].onclick({ stopPropagation() {} });
      assert.deepEqual(calls, [['reforge', 0]]);
      assert.equal(one(shell, 'broker-note').textContent, REFORGED(rare.name, LR.affixLine(rare, 0)));
      assert.equal(one(shell, 'broker-purse').textContent, reforgePurseText(1, 50), 'paid');
      const after = kids(one(shell, 'reforge-card'), 'reforge-press');
      assert.equal(after.length, 1, 'only the line it was reforged on');
      assert.equal(after[0].textContent, 'Need 3 more shards');
      assert.equal(after[0].attrs.disabled, '');
      assert.equal(after[0].attrs.title, REFORGE_REFUSALS.shards);
      // the salvage page: asked before it breaks
      kids(shell, 'reforge-tab').find((t) => t.dataset.page === 'salvage').onclick({ stopPropagation() {} });
      rows = kids(shell, 'broker-offer');
      assert.equal(rows.length, 3);
      const btn = one(rows[1], 'broker-buy');
      assert.equal(btn.textContent, 'Salvage');
      btn.onclick({ stopPropagation() {} });
      assert.deepEqual(calls.length, 1, 'the first press only asks');
      rows = kids(shell, 'broker-offer');
      assert.equal(one(rows[1], 'broker-buy').textContent, 'Break it');
      one(rows[1], 'broker-buy').onclick({ stopPropagation() {} });
      assert.deepEqual(calls[1], ['salvage']);
      assert.ok(!me.items.includes(magic), 'broken');
      assert.equal(one(shell, 'broker-note').textContent, SALVAGED(magic.name, 1));
    } finally { view.unmount(); }
  });
  assert.deepEqual([reforgeLabel(null), reforgeLabel('shards', { shards: 4, gold: 400 }, { shards: 1, gold: 0 }), reforgeLabel('gold', { shards: 4, gold: 400 }, { shards: 9, gold: 150 }), reforgeLabel('unknown'), reforgeLabel('worn')],
    ['Reforge', 'Need 3 more shards', 'Need 250 more gold', 'Not identified', 'Worn']);
});

test('LOOT9: the Mages Guild\'s fourth row - the classic popup\'s port-drawn row and its key, the Plus face\'s row, the host\'s hook for the Identify NPC alone', () => {
  _setGuildServiceArtForTests({ base: { w: 130, h: 51 }, member: { w: 130, h: 51 } });
  let asked = 0, closed = 0;
  const hooks = (reforge) => ({ member: () => true, service: () => 'Identify', rows: () => [], reforge, onClose: () => { closed++; } });
  const w = new GuildServiceWindow(hooks(() => { asked++; return { dispatched: true }; }));
  const [rx, ry, rw, rh] = REFORGE_RECT;
  assert.equal(w.click(PANEL_X + rx + rw / 2, PANEL_Y + ry + rh / 2), true);
  assert.deepEqual([asked, closed, w.done], [1, 1, true], 'a dispatch closes the popup, as a service\'s does');
  const k = new GuildServiceWindow(hooks(() => { asked++; return { dispatched: true }; }));
  k.input(REFORGE_KEY);
  assert.equal(asked, 2, 'its key');
  const bare = new GuildServiceWindow(hooks(null));
  assert.equal(bare.click(PANEL_X + rx + rw / 2, PANEL_Y + ry + rh / 2), false, 'no hook, no row');
  bare.input(REFORGE_KEY);
  assert.equal(asked, 2);
  assert.equal(REFORGE_ROW, 'Reforge');
  assert.ok(ry >= 51, 'under DFU\'s panel, never over its art');
  assert.match(read('src/ui/enhancedPorts.js'), /\.\.\.\(w\.hooks\.reforge \? \[\{ label: REFORGE_ROW, act: \(\) => w\._reforge\(\) \}\] : \[\]\)/, 'the Plus face lists it beside the service');
  assert.match(read('src/scenes/worldModes.js'), /reforge: route\.guildGroup === GUILD_GROUPS\.MagesGuild && service === 'Identify' && lootRarityOn\(\) \? \(\) => shutBox\(\) \?\? \(openReforge\(\) \? \{ dispatched: true \} : null\) : null,/, 'the Mages Guild\'s Identify NPC alone, the row on');   // PIN MOVED (AUDIT CHAP5 D2): a shut hall's row refused on the popup
  assert.match(read('src/scenes/worldModes.js'), /reforge: \(item, line\) => reforgePiece\(item, line, playerEntity\),\s*salvage: \(item\) => salvagePiece\(item, \{ items: \(playerEntity\.items \?\?= \[\]\) \}\),/, 'the law\'s, on the player\'s own pack and purse');
  _setGuildServiceArtForTests(null);
});

test('LOOT9: the pack card offers Salvage for a graded piece - asked first, Keep keeps it, Salvage breaks it into shards and says so; none for a worn or bound piece', () => {
  on();
  _resetPrefsForTests();
  setPref('lootRarity', true);
  destroyEnhancedNotice();
  globalThis.location = { search: '?skin=enhanced' };
  const piece = graded('rare', 21);
  const name = itemLongName(piece);
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [piece, createWeapon(120, 1)], goldPieces: 10 };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
    let t = 0;
    const press = (b) => b.onclick({ timeStamp: (t += 5000), detail: 1, stopPropagation() {} });
    try {
      const rowOf = (n) => host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(n)) ?? null;
      const actOf = (label) => host.querySelectorAll('.act').find((b) => b.textContent === label) ?? null;
      for (const tab of host.querySelectorAll('.packtab')) { tab.onclick(); if (rowOf(piece.name)) break; }   // the row says its name, the make under it
      rowOf(piece.name).onclick({ timeStamp: (t += 5000), detail: 1 });
      if (!actOf('Info')) rowOf(piece.name).onclick({ timeStamp: (t += 5000), detail: 1 });
      assert.ok(actOf('Salvage'), 'the card offers it');
      press(actOf('Salvage'));
      const dialog = () => dom.doc.querySelectorAll('.inv-salvage')[0] ?? null;
      assert.ok(dialog(), 'asked first');
      assert.ok(SALVAGE_ASK(name, 3).every((l) => textOf(dom.body).includes(l)));
      press(dialog().querySelectorAll('.act').find((b) => b.textContent === 'Keep'));
      assert.equal(dialog(), null);
      assert.ok(e.items.includes(piece), 'Keep keeps it');
      press(actOf('Salvage'));
      press(dialog().querySelectorAll('.act').find((b) => b.textContent === 'Salvage'));
      assert.ok(!e.items.includes(piece), 'broken');
      assert.equal(RF.shardsHeld(e.items), 3, 'into its shards');
    } finally { view.unmount(); }
  });
  assert.match(read('src/ui/enhancedInventory.js'), /if \(side === 'local' && !line\.equipped && salvageShards\(picked\) > 0 && !\['off', 'aetheric', 'gilded', 'artifact', 'quest', 'bound'\]\.includes\(salvageRefusal\(picked\) \?\? ''\)\) \{/, 'never a worn piece, never one that will not break');
});
