// LOOT10 - THE CODEX, AND THE IMPRINT (2026-10-01; bible/06-Systems/Loot-Arc.md section 12, Mac: "Do you wanna turn
// this into an arc and do all of the above?" - "Legendary codex: a collection log of every Legendary you've found ...
// a reason to keep hunting"). The laws pinned here:
//   - THE CODEX: every Legendary record and every Aetheric piece taken, with the day first found; the first find said
//     and heard, once; a take seen at the take, everything else at the round's sweep; a save without the codex filled
//     silently; the character's mod record, a forged one cleaned.
//   - THE PAGE: the thirty, a found one whole and an unfound one by its hint; the Aetheric sets piece by piece.
//   - THE IMPRINT: a Rare (known, not worn, not imprinted) takes the power of a found Legendary of its own group for
//     20 shards and 5,000 gold; its card says so, its power works as the Legendary's, and the wire refuses a forged one.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as CX from '../src/systems/lootCodex.js';
import { AETHERIC_RECORDS, mintAetheric } from '../src/systems/aetheric.js';
import { welkyndShards } from '../src/systems/gateSpoils.js';
import { shardsHeld } from '../src/systems/reforge.js';
import { takeOneInto } from '../src/systems/inventory.js';
import { modSaveRecords, restoreModSaveRecords, newGameModSaveRecords } from '../src/systems/modSaveData.js';
import { registerPresenter } from '../src/systems/notify.js';
import { setOneShotObserver } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { validLootItem } from '../src/systems/loot.js';
import { wornPowers } from '../src/systems/lootPowers.js';
import { equipItem } from '../src/systems/equip.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { withDom } from './invdrag.mjs';
import { mountReforgeWindow, CODEX_TITLE, IMPRINTED, IMPRINT_NONE } from '../src/ui/reforgeWindow.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); CX._resetCodexForTests(); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const known = (it) => Object.assign(it, { isIdentified: true });
const legend = (id) => {
  const rec = LR.legendaryById(id);
  return known(LR.applyRarity(createWeapon(rec.templates?.[0] ?? 113, 1), 'legendary', lcg(1), [rec]));
};
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
/** The HUD's lines and the sounds while `fn` runs. */
function heard(fn) {
  const lines = [], sounds = [];
  const off = registerPresenter({ priority: 99, hudText: (t) => { lines.push(t); return true; } });
  setOneShotObserver((i) => sounds.push(i));
  try { fn(); } finally { off(); setOneShotObserver(null); }
  return { lines, sounds };
}

test('LOOT10: a find - a Legendary\'s record or an Aetheric piece, first found once, said and heard; the day the world\'s', () => {
  on();
  const w = legend('wyrmbane');
  assert.deepEqual(CX.codexKey(w), { kind: 'legendary', id: 'wyrmbane' });
  const ae = mintAetheric(AETHERIC_RECORDS[0]);
  assert.deepEqual(CX.codexKey(ae), { kind: 'aetheric', id: AETHERIC_RECORDS[0].id });
  assert.equal(CX.codexKey(LR.applyRarity(createWeapon(113, 1), 'rare', lcg(2))), null, 'a Rare is no record');
  assert.equal(CX.codexKey({ rarity: 'legendary', legendary: 'no-such' }), null);
  const a = heard(() => assert.equal(CX.noteFind(w), true));
  assert.deepEqual(a.lines, ['Wyrmbane - a Legendary! It joins your codex.']);
  assert.deepEqual(a.sounds, [SOUND.LevelUp], 'the level-up\'s fanfare');
  assert.ok(Number.isInteger(CX.foundDay('legendary', 'wyrmbane')));
  const b = heard(() => assert.equal(CX.noteFind(legend('wyrmbane')), false));
  assert.deepEqual([b.lines, b.sounds], [[], []], 'once');
  const c = heard(() => CX.noteFind(ae));
  assert.deepEqual(c.lines, [`${AETHERIC_RECORDS[0].name} - an Aetheric piece! It joins your codex.`]);
  _resetForTests(); setPref('lootRarity', false);
  assert.equal(CX.noteFind(legend('nightwhisper')), false, 'off: nothing');
});

test('LOOT10: how a find is seen - at the take, at the round\'s sweep (the pack and what it wears), and a save from before the codex filled silently', () => {
  on();
  const me = { items: [] };
  const n = legend('nightwhisper');
  heard(() => takeOneInto(me, [n], n));
  assert.ok(CX.foundDay('legendary', 'nightwhisper') != null, 'the take tells it');
  const worn = legend('wyrmbane');
  const e = { isPlayer: true, items: [legend('graveward')] };
  equipItem(e, worn);   // worn, and on the table alone - the sweep reads what it wears too
  const s = heard(() => assert.equal(CX.sweepCodex(e), 2));
  assert.equal(s.lines.length, 2, 'each said');
  assert.match(read('src/systems/lootCodex.js'), /registerMagicRoundHook\(CODEX, \(entity\) => \{ if \(entity\?\.isPlayer\) sweepCodex\(entity\); \}\);/, 'the round sweeps the player\'s own');
  assert.match(read('src/systems/lootCodex.js'), /registerTakeListener\(CODEX, \(item\) => \{ noteFind\(item\); \}\);/);
  // a save from before the codex: what was carried is the codex's, and nothing is announced
  restoreModSaveRecords({});
  const q = heard(() => assert.equal(CX.sweepCodex({ isPlayer: true, items: [legend('worms-tooth')] }), 1));
  assert.deepEqual(q.lines, [], 'silently');
  const next = heard(() => CX.sweepCodex({ isPlayer: true, items: [legend('gortwogs-cleaver')] }));
  assert.equal(next.lines.length, 1, 'and the next find is said');
  assert.match(read('src/scenes/world.js'), /import '\.\.\/systems\/lootCodex\.js';/, 'the game registers it');
});

test('LOOT10: the record - saved, restored, a forged one cleaned, a new game none', () => {
  on();
  CX.noteFind(legend('wyrmbane'), { quiet: true });
  const rec = modSaveRecords()[CX.CODEX_SAVE_VENDOR];
  assert.deepEqual(Object.keys(rec.legendary), ['wyrmbane']);
  CX._resetCodexForTests();
  restoreModSaveRecords({ [CX.CODEX_SAVE_VENDOR]: { legendary: { wyrmbane: 40, 'no-such': 3, nightwhisper: -1, graveward: 2.5 }, aetheric: { [AETHERIC_RECORDS[1].id]: 7, x: 1 } } });
  assert.equal(CX.foundDay('legendary', 'wyrmbane'), 40);
  assert.deepEqual(CX.foundIds('legendary'), ['wyrmbane'], 'an unknown id, a negative day and a fraction dropped');
  assert.deepEqual(CX.foundIds('aetheric'), [AETHERIC_RECORDS[1].id]);
  restoreModSaveRecords({ [CX.CODEX_SAVE_VENDOR]: 'junk' });
  assert.deepEqual(CX.foundIds('legendary'), []);
  CX.noteFind(legend('wyrmbane'), { quiet: true });
  newGameModSaveRecords?.();
  assert.deepEqual(CX.foundIds('legendary'), [], 'a new game: none');
});

test('LOOT10: the page - every record (the thirty, and AUDIT LOOT F8 a registered one), a found one whole and an unfound one by its hint; the Aetheric sets piece by piece; the count', () => {
  on();
  CX.noteFind(legend('nightwhisper'), { quiet: true });
  const rows = CX.codexRows();
  assert.equal(rows.length, LR.allLegendaries().length, 'every record the tables hold');
  assert.ok(LR.LEGENDARIES.every((r) => rows.some((x) => x.id === r.id)), 'the thirty among them');
  const nw = rows.find((r) => r.id === 'nightwhisper');
  assert.deepEqual([nw.found, nw.name, nw.power?.name, !!nw.lore], [true, 'Nightwhisper', 'Silent Death', true]);
  const wb = rows.find((r) => r.id === 'wyrmbane');
  assert.deepEqual([wb.found, wb.name, wb.power, wb.lore], [false, null, null, null], 'an unfound one names nothing');
  assert.equal(wb.hint, CX.FAMILY_HINT[LR.foundAmong('wyrmbane')], 'but where it is said to be');
  for (const r of rows) assert.ok(r.hint, `${r.id}: a hint`);
  const sets = CX.codexSets();
  assert.equal(sets.reduce((n, s) => n + s.pieces.length, 0), AETHERIC_RECORDS.length);
  assert.deepEqual(CX.codexCount(), { legendary: 1, legendaries: LR.allLegendaries().length, aetheric: 0, aetherics: AETHERIC_RECORDS.length });
});

test('LOOT10: the imprint - a known, unworn Rare takes a found power of its group, once, for 20 shards and 5,000 gold; its card and its power', () => {
  on();
  const rare = known(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(5)));
  const me = { isPlayer: true, items: [rare, welkyndShards(25)], goldPieces: 6000 };
  assert.deepEqual(CX.imprintChoices(rare), [], 'nothing found, nothing to take');
  assert.equal(CX.imprintRefusal(rare, 'nightwhisper', me), 'unfound');
  CX.noteFind(legend('nightwhisper'), { quiet: true });
  CX.noteFind(legend('graveward'), { quiet: true });
  assert.ok(CX.imprintChoices(rare).every((r) => r.group === 'Weapons'), 'its own group\'s');
  assert.ok(CX.imprintChoices(rare).some((r) => r.id === 'nightwhisper'));
  me.goldPieces = 4999;
  assert.deepEqual(CX.imprintPiece(rare, 'nightwhisper', me), { ok: false, reason: 'gold' });
  me.goldPieces = 6000;
  const before = JSON.stringify(rare);
  assert.deepEqual(CX.imprintPiece(rare, 'nightwhisper', { ...me, items: [rare, welkyndShards(19)] }), { ok: false, reason: 'shards' });
  assert.equal(JSON.stringify(rare), before, 'refused: nothing changed');
  assert.deepEqual(CX.imprintPiece(rare, 'nightwhisper', me), { ok: true });
  assert.deepEqual([rare.imprint, rare.rarity, shardsHeld(me.items), me.goldPieces], ['nightwhisper', 'rare', 5, 1000], 'it stays Rare; paid');
  assert.equal(CX.imprintRefusal(rare, 'graveward', me), 'imprinted', 'once');
  assert.equal(LR.imprintLine(rare), 'Imprint: Silent Death (of Nightwhisper) - +100% to a foe unaware');
  assert.ok(LR.rarityLines(rare).includes(LR.imprintLine(rare)), 'its card says so');
  equipItem(me, rare);
  assert.ok(wornPowers(me).some((p) => p.id === 'nightwhisper' && p.power.name === 'Silent Death' && p.item === rare), 'its power works as the Legendary\'s');
  const unknown = Object.assign(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(6)), { isIdentified: false });
  assert.equal(CX.imprintRefusal(unknown, 'nightwhisper', { ...me, items: [unknown, welkyndShards(25)] }), 'unknown');
  const worn2 = known(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(7)));
  const w = { items: [worn2, welkyndShards(25)], goldPieces: 9000 };
  equipItem(w, worn2);
  assert.equal(CX.imprintRefusal(worn2, 'nightwhisper', w), 'worn');
  assert.equal(CX.imprintRefusal(known(LR.applyRarity(createWeapon(120, 1), 'magic', lcg(8))), 'nightwhisper', w), 'not', 'a Rare alone');
  assert.deepEqual(CX.IMPRINT_PRICE, { shards: 20, gold: 5000 });
  _resetForTests(); setPref('lootRarity', false);
  assert.equal(CX.imprintRefusal(worn2, 'nightwhisper', w), 'off');
});

test('LOOT10: the wire - an imprint only as the Reforge makes one', () => {
  on();
  const rare = known(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(5)));
  assert.equal(validLootItem({ ...rare, imprint: 'nightwhisper' })?.imprint, 'nightwhisper');
  assert.equal(validLootItem({ ...rare, imprint: 'no-such' }), null, 'a record that is not');
  const other = LR.LEGENDARIES.find((r) => r.group !== 'Weapons' && LR.powerOf(r.id));
  assert.equal(validLootItem({ ...rare, imprint: other.id }), null, `another group's (${other.id})`);
  const magic = known(LR.applyRarity(createWeapon(120, 1), 'magic', lcg(5)));
  assert.equal(validLootItem({ ...magic, imprint: 'nightwhisper' }), null, 'never on a Magic piece');
  assert.equal(validLootItem({ ...rare, imprint: 7 }), null);
});

test('LOOT10: the pages - the Codex alone from the pack, the Imprint at the guild', () => {
  on();
  CX.noteFind(legend('nightwhisper'), { quiet: true });
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountReforgeWindow(host, { pages: ['codex'], items: () => [], payer: () => ({ items: [] }), gold: () => 0, reforge: () => ({ ok: false }), salvage: () => ({ ok: false }), nameOf: (it) => it.name, picture: () => null });
    try {
      const shell = one(host, 'reforge-shell');
      assert.equal(shell.attrs['aria-label'], CODEX_TITLE);
      assert.equal(one(shell, 'reforge-tabs').attrs.hidden, '', 'one page: no tabs');
      const rows = kids(shell, 'codex-row');
      assert.equal(rows.length, LR.allLegendaries().length);
      assert.equal(rows.filter((r) => r.classList.contains('found')).length, 1);
      const nw = rows.find((r) => r.dataset.record === 'nightwhisper');
      assert.equal(one(nw, 'broker-name').textContent, 'Nightwhisper');
      nw.onclick();
      assert.ok(textOf(one(shell, 'codex-card')).includes('Silent Death'), 'a found one whole');
      const wb = kids(shell, 'codex-row').find((r) => r.dataset.record === 'wyrmbane');
      assert.equal(one(wb, 'broker-name').textContent, 'Unfound');
      assert.equal(kids(shell, 'codex-set').length, new Set(AETHERIC_RECORDS.map((r) => r.set)).size, 'a row a set');
    } finally { view.unmount(); }
  });
  withDom((dom) => {
    const rare = known(LR.applyRarity(createWeapon(120, 1), 'rare', lcg(5)));
    const lonely = known(LR.applyRarity({ ...createWeapon(120, 1) }, 'rare', lcg(9)));
    lonely.group = 'Jewellery';
    const me = { items: [rare, welkyndShards(25), lonely], goldPieces: 6000 };
    const host = dom.mk('div');
    dom.body.append(host);
    const calls = [];
    const view = mountReforgeWindow(host, {
      page: 'imprint', items: () => me.items, payer: () => me, gold: () => me.goldPieces, picture: () => null, nameOf: (it) => it.name,
      reforge: () => ({ ok: false }), salvage: () => ({ ok: false }),
      imprint: (it, id) => { calls.push(id); return CX.imprintPiece(it, id, me); },
    });
    try {
      const shell = one(host, 'reforge-shell');
      assert.deepEqual(kids(shell, 'reforge-tab').map((t) => t.dataset.page), ['reforge', 'salvage', 'imprint', 'codex', 'scry', 'sockets'], 'the guild\'s four - PIN MOVED (LOOT19, bible/06-Systems/Loot-II-Arc.md section 11): and its scryers\' page, the fifth; (LOOT20, section 12) its sockets\', the sixth');
      const choice = kids(shell, 'imprint-choice').find((li) => li.dataset.record === 'nightwhisper');
      assert.ok(choice, 'a found power of its group');
      one(choice, 'imprint-press').onclick({ stopPropagation() {} });
      assert.deepEqual(calls, ['nightwhisper']);
      assert.equal(one(shell, 'broker-note').textContent, IMPRINTED(rare.name, 'Nightwhisper', 'Silent Death'));
      assert.ok(textOf(one(shell, 'imprint-card')).includes('Imprint: Silent Death'), 'its card says it now');
      kids(shell, 'broker-offer')[1].onclick();
      assert.ok(textOf(one(shell, 'imprint-card')).includes(IMPRINT_NONE), 'a piece whose kind the codex holds none of');
    } finally { view.unmount(); }
  });
  assert.match(read('src/scenes/worldModes.js'), /imprint: \(item, id\) => imprintPiece\(item, id, playerEntity\),/, 'the guild\'s window imprints on the player\'s own');
  assert.match(read('src/ui/enhancedInventory.js'), /if \(lootRarityOn\(\)\) \{\s*const codex = el\('button', 'act codexbtn', 'Codex'\);/, 'the pack opens the Codex');
  assert.match(read('src/ui/enhancedInventory.js'), /createReforgeOverlay\(\{ pages: \['codex'\], page: 'codex',/);
});
