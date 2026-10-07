// CRAFT2 (2026-10-07, Mac: "How could we enhance the profession element of the game while reducing complexity and
// making crafting more viable"; then "Lets do it") - PATTERNS, NOT A MATRIX: a station lists the pieces it makes, each
// once whatever it is made of, and the material is chosen from what is held (ui/profPages.js patternRows, pickedOf,
// materialRow); the first-make 500 is a pattern's at a tier (net/recipeLaw.js firstCraftKey, firstCraftKin), the
// service's recipes as they were. The done-when: an Adamantium Longsword pays its first, an Ebony one after it none (one
// pattern, one tier), a Mithril one its own - through the real Worker. bible/06-Systems/Professions-Arc.md 41.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { xpForRank } from '../src/net/professionLaw.js';
import {
  RECIPES, recipeById, recipeInputs, patternOf, patternsOf, firstCraftKey, firstCraftKin, firstCraftPays, FIRST_CRAFT_XP, craftXp,
  COOKING_RECIPES,
} from '../src/net/recipeLaw.js';
import { mintPieces } from '../src/systems/smithItems.js';

const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('CRAFT2 DONE WHEN: the first-make 500 is a pattern\'s at a tier, through the real Worker - an Adamantium Longsword its first, an Ebony Longsword after it none (tier 6 both), a Mithril Longsword its own (tier 5), an Ebony Broadsword its own (another pattern); a Ghostwood Wand none after an Ironwood one (tier 6 both)', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  for (const prof of ['smithing', 'jewelcrafting']) raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)').run(mac.id, mac.character, prof, xpForRank(70));
  const stock = { 'ingot:adamantium': 3, 'ingot:ebony': 6, 'ingot:mithril': 3, 'metal:copper': 4, 'leather:cured': 4, 'plank:ironwood': 2, 'plank:ghostwood': 2, 'gem:ruby': 2 };
  for (const [m, n] of Object.entries(stock)) raw.prepare('INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, \'own\', ?)').run(mac.id, mac.character, m, n);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const made = [];
  for (const id of ['longsword:adamantium', 'longsword:ebony', 'longsword:mithril', 'broadsword:ebony', 'wand:ironwood:ruby', 'wand:ghostwood:ruby']) {
    const r = await book.craft(id, { clean: false, name: 'Mac' }, (data) => mintPieces(data));
    assert.equal(r.ok, true, `${id}: ${JSON.stringify(r)}`);
    made.push([id, r.data.first, r.data.xp]);
  }
  const t6 = craftXp(6, 70, false), t5 = craftXp(5, 70, false);
  assert.deepEqual(made, [
    ['longsword:adamantium', true, t6 + FIRST_CRAFT_XP], ['longsword:ebony', false, t6], ['longsword:mithril', true, t5 + FIRST_CRAFT_XP],
    ['broadsword:ebony', true, t6 + FIRST_CRAFT_XP], ['wand:ironwood:ruby', true, t6 + FIRST_CRAFT_XP], ['wand:ghostwood:ruby', false, t6],
  ]);
  assert.deepEqual(raw.prepare('SELECT recipe FROM prof_crafts WHERE player = ? ORDER BY at, rowid').all(mac.id).map((x) => x.recipe),
    made.map(([id]) => id), 'the service\'s recipes as they were - a craft still asks its material');
});

// ─── THE LAW ─────────────────────────────────────────────────────────

const station = (prof, family = null, group = null) => RECIPES.filter((r) => r.profession === prof && (family == null || r.family === family) && (group == null || r.group === group));

test('CRAFT2 law: a station\'s patterns - the anvil 39 (15 weapons, 18 armour, 5 tools, the Repair Kit), the workbench 13, the loom 7 leathers, 41 men\'s and 35 women\'s garments, 9 furnishings and the Fishing-Net, the fire 4; every recipe in one pattern, its materials in the table\'s order; no product id two professions\'', () => {
  const count = (prof, fams) => fams.map((f) => patternsOf(station(prof, f)).length);
  assert.deepEqual(count('smithing', ['weapons', 'armour', 'tools', 'kits']), [15, 18, 5, 1]);
  assert.deepEqual(count('carpentry', ['staves', 'bows', 'arrows', 'furniture', 'tools', 'siege']), [1, 2, 1, 7, 1, 1]);
  assert.deepEqual(count('outfitting', ['leather', 'furnishings', 'tools']), [7, 9, 1]);
  assert.deepEqual([patternsOf(station('outfitting', 'clothing', 'MensClothing')).length, patternsOf(station('outfitting', 'clothing', 'WomensClothing')).length], [41, 35]);
  assert.deepEqual(patternsOf(COOKING_RECIPES).map((p) => [p.name, p.recipes.map((r) => r.madeOf)]), [
    ['Hunter\'s Stew', ['northern Root Bulb', 'southern Root Bulb']], ['Fisherman\'s Supper', ['northern Green Leaves', 'southern Green Leaves']],
    ['Orchard Tart', ['northern Yellow Berries', 'southern Yellow Berries']], ['Feast of the Hearth', ['']],
  ]);
  const sword = patternsOf(station('smithing', 'weapons')).find((p) => p.id === 'longsword');
  assert.deepEqual([sword.name, sword.recipes.map((r) => r.madeOf)], ['Longsword', ['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric', 'Warforged']]);
  assert.deepEqual(patternsOf(station('carpentry', 'arrows'))[0].recipes.map((r) => [r.id, r.madeOf]), [['arrows:north', 'northern Twigs'], ['arrows:south', 'southern Twigs'], ['arrows:harpy', 'Harpy Feathers']]);
  assert.equal(patternsOf(RECIPES).reduce((n, p) => n + p.recipes.length, 0), RECIPES.length, 'every recipe in one pattern');
  const profsOf = new Map();
  for (const r of RECIPES) profsOf.set(patternOf(r), new Set([...(profsOf.get(patternOf(r)) ?? []), r.profession]));
  assert.deepEqual([...profsOf.values()].filter((s) => s.size > 1), [], 'FACT: no product id two professions\'');
  assert.equal(patternOf(null), null);
  for (const r of RECIPES) assert.ok(typeof r.pattern === 'string' && r.pattern && typeof r.madeOf === 'string', r.id);
});

test('CRAFT2 law: the first-make 500 a pattern\'s at a tier - Adamantium, Ebony, Orcish and Warforged one Longsword (tier 6), Steel (2) and Silver (3) each their own; J7\'s piece and base and R2-S7\'s dish both held; the 561 firsts that paid become 446; no pattern at a tier both pays and is wholly the counter\'s; at most 18 kin', () => {
  assert.deepEqual(firstCraftKin(recipeById('longsword:ebony')), ['longsword:adamantium', 'longsword:ebony', 'longsword:orichalcum', 'longsword:warforged']);
  assert.deepEqual([firstCraftKin(recipeById('longsword:steel')), firstCraftKin(recipeById('longsword:silver'))], [['longsword:steel'], ['longsword:silver']], 'MEASURED: Steel is tier 2, Silver 3 - 41.2\'s example named two tiers');
  assert.deepEqual(firstCraftKin(recipeById('ring:gold:ruby')), ['ring:gold', ...['ruby', 'emerald', 'sapphire', 'diamond', 'jade', 'turquoise', 'malachite', 'amber', 'pearl'].map((g) => `ring:gold:${g}`)], 'J7: a jewel\'s piece and base');
  assert.deepEqual(firstCraftKin(recipeById('stew:south')), ['stew:north', 'stew:south'], 'R2-S7: a dish either herb\'s way');
  assert.equal(firstCraftKin(recipeById('wand:ghostwood:ruby')).length, 18, 'the two woods share tier 6');
  assert.deepEqual([firstCraftKey(recipeById('kit:ebony')), firstCraftKey(null), firstCraftKin(null)], ['kit@6', null, []]);
  const kin = RECIPES.map((r) => firstCraftKin(r));
  assert.equal(Math.max(...kin.map((k) => k.length)), 18);
  for (const r of RECIPES) assert.ok(firstCraftKin(r).includes(r.id) && firstCraftKin(r).every((id) => firstCraftKey(recipeById(id)) === firstCraftKey(r)), r.id);
  const paying = RECIPES.filter(firstCraftPays);
  // the key as it stood (AUDIT PROF-541 J7 and R2-S7 - a jewel's piece and base, a dish its dish, every other recipe its id)
  const before = (r) => (r.kind === 'jewel' ? r.id.split(':').slice(0, 2).join(':') : r.kind === 'dish' ? r.product : r.id);
  assert.deepEqual([paying.length, new Set(paying.map(before)).size, new Set(paying.map(firstCraftKey)).size], [663, 561, 446], 'MEASURED: the recipes that pay a first, the firsts they paid, and the patterns\' at a tier');
  const mixed = [...new Set(RECIPES.map(firstCraftKey))].filter((k) => { const pays = RECIPES.filter((r) => firstCraftKey(r) === k).map(firstCraftPays); return pays.includes(true) && pays.includes(false); });
  assert.deepEqual(mixed, [], 'FACT: AUDIT 32 S1 stands beside it - no pattern at a tier mixes the world\'s goods and the counter\'s');
  // D1 binds at most 100 parameters a statement: the craft's decision binds 16, two an input (a Heartwood's or a cracked
  // gem's spend at most one more), and its kin
  const binds = Math.max(...RECIPES.map((r) => 16 + 2 * Math.max(recipeInputs(r).length, recipeInputs(r, { heartwood: true, cracked: true }).length) + firstCraftKin(r).length));
  assert.ok(binds < 100, `the decision's binds: ${binds}`);
});

test('CRAFT2 law: what a picked pattern is made of - the last craft\'s material where it can be made; else the highest tier made now, then made from raw; else the open one holding most of its inputs; else the last\'s, else the first', async () => {
  const { pickedOf, patternLead, heldShare, standings } = await import('../src/ui/profPages.js');
  const sword = patternsOf(station('smithing', 'weapons')).find((p) => p.id === 'longsword');
  const at = (o) => (r) => ({ open: true, can: false, raw: false, share: 0, ...(o[r.madeOf] ?? {}) });
  assert.equal(pickedOf(sword, at({ Iron: { can: true }, Ebony: { can: true } }), 'Iron').madeOf, 'Iron', 'the last craft\'s, made now');
  assert.equal(pickedOf(sword, at({ Iron: { raw: true }, Ebony: { can: true } }), 'Iron').madeOf, 'Iron', 'the last craft\'s, from raw');
  assert.equal(pickedOf(sword, at({ Iron: { can: true }, Ebony: { can: true }, Steel: { raw: true } }), 'Silver').madeOf, 'Ebony', 'else the highest tier made now');
  assert.equal(pickedOf(sword, at({ Daedric: { can: true }, Warforged: { can: true } })).madeOf, 'Daedric', 'tier 7 over the Warforged\'s 6, though the table stands it last');
  assert.equal(pickedOf(sword, at({ Iron: { raw: true }, Steel: { raw: true } })).madeOf, 'Steel', 'then the highest made from raw');
  assert.equal(pickedOf(sword, at({ Iron: { share: 0.2 }, Mithril: { share: 0.6 }, Daedric: { share: 0.6, open: false } })).madeOf, 'Mithril', 'then the open one holding most');
  assert.equal(pickedOf(sword, at({}), 'Ebony').madeOf, 'Ebony', 'nothing held: the last craft\'s');
  assert.equal(pickedOf(sword, at({})).madeOf, 'Iron', 'and else the first');
  assert.equal(patternLead(sword, at({ Iron: { can: false }, Ebony: { raw: true }, Steel: { can: true } })).madeOf, 'Steel', 'a row speaks for the furthest');
  assert.equal(patternLead(sword, (r) => ({ open: false, can: false, raw: false, share: 0, rank: r.rank })).madeOf, 'Iron', 'none open: the lowest rank');
  assert.deepEqual([heldShare([{ key: 'a', n: 3 }, { key: 'b', n: 1 }], (k) => (k === 'a' ? 9 : 0)), heldShare([], () => 1)], [0.75, 0], 'a part of the units, each input at most its own');
  let reads = 0;
  const once = standings(() => { reads++; return { open: true, can: true, raw: false, share: 1 }; });
  once(sword.recipes[0]); once(sword.recipes[0]);
  assert.equal(reads, 1, 'read once a recipe a draw');
});

// ─── THE STATIONS ────────────────────────────────────────────────────

/** The Stores page over a stub book at a home's anvil or (`at`) workbench or loom, `held` its goods, every track at `rank`. */
async function pageAt(heldIn, rank = 70, at = 'forge') {
  const { setProfessionsPages, drawStoresPage, resetProfPages } = await import('../src/ui/profPages.js');
  const { setPref } = await import('../src/systems/uiPrefs.js');
  resetProfPages();
  setPref('gentleActs', true);
  const held = new Map(Object.entries(heldIn));
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks: new Map(), today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
    held: (k) => held.get(k) ?? 0, store: (k) => ({ material: k, own: held.get(k) ?? 0, bought: 0 }),
    track: (p) => ({ profession: p, xp: xpForRank(rank), rank, specs: { 50: null, 100: null } }), materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,
  };
  const crafted = [];
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), forge: () => (at === 'forge' ? { kind: 'home', fee: 0 } : null), workbench: () => (at === 'workbench' ? { kind: 'home', fee: 0 } : null),
    loom: () => (at === 'loom' ? { kind: 'home', fee: 0 } : null), clothing: () => 'MensClothing', stitchBand: () => 1,
    smelt: async () => ({ ok: true, text: '' }), craft: async (recipe) => { crafted.push(recipe); return { ok: true, text: 'made' }; }, stock: async () => ({ ok: true, text: '' }),
    heatBand: () => 1, planeBand: () => 1,
  });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  const buttons = () => [...root.querySelectorAll('button')];
  return {
    crafted, text: () => root.textContent, buttons,
    rows: () => buttons().filter((b) => b.className.includes('prof-recipe')),
    made: () => buttons().filter((b) => b.parentNode?.className?.includes('prof-made')),
    press: (label) => buttons().find((b) => b.textContent.startsWith(label)).onclick(),
    done: () => { setProfessionsPages(null); setPref('gentleActs', false); resetProfPages(); root.remove(); },
  };
}

test('CRAFT2 anvil: the Weapons are fifteen patterns, no metal row before one is picked; Longsword is chosen in the Ebony held (the highest made now), its box\'s eleven metals the one marked, the shut ones naming their rank; Steel pressed makes a Steel one; the next pattern keeps the Steel', async () => {
  const p = await pageAt({ 'ingot:ebony': 3, 'ingot:steel': 6, 'metal:copper': 2, 'leather:cured': 2 }, 70);
  try {
    assert.equal(p.rows().length, 15, 'the Weapons\' patterns - not 165 rows of a piece and a metal');
    assert.equal(p.made().length, 0, 'no metal row before a pattern is picked');
    const sword = p.rows().find((b) => b.textContent.startsWith('Longsword'));
    assert.equal(sword.textContent, 'Longswordcan make now');
    sword.onclick();
    assert.match(p.text(), /Ebony Longsword - rank 70/);
    assert.deepEqual(p.made().map((b) => [b.textContent, b.className.includes(' on'), b.className.includes('prof-locked')]), [
      ['Iron', false, true], ['Steel', false, false], ['Silver', false, true], ['Elven', false, true], ['Dwarven', false, true], ['Mithril', false, true],
      ['Adamantium', false, true], ['Ebony', true, false], ['Orcish', false, true], ['Daedric - rank 90', false, true], ['Warforged', false, true],
    ]);
    p.press('Steel');
    assert.match(p.text(), /Steel Longsword - rank 10/);
    p.press('Quick craft');
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(p.crafted, ['longsword:steel'], 'the craft asks the material chosen');
    p.rows().find((b) => b.textContent.startsWith('Broadsword')).onclick();
    assert.match(p.text(), /Steel Broadsword - rank 10/, 'the last craft\'s metal, held');
    p.press('Armour');
    assert.equal(p.rows().length, 18);
    assert.doesNotMatch(p.text(), /Broadsword - rank/, 'a family turned lets the pattern go');
    p.press('Weapons');
    assert.doesNotMatch(p.text(), /Broadsword - rank/, 'and turned back, nothing picked');
  } finally { p.done(); }
});

test('CRAFT2 workbench: the Arrows one pattern - its fletching chosen from what is held (the Harpy\'s); a single-wood bed no wood row', async () => {
  const p = await pageAt({ 'plank:pine': 4, 'ingot:iron': 2, 'hide:harpy': 1, 'plank:teak': 9, 'cloth:linen': 2 }, 40, 'workbench');
  try {
    p.press('Arrows');
    assert.equal(p.rows().length, 1);
    p.rows()[0].onclick();
    assert.match(p.text(), /Arrows \(Harpy Feathers\) - rank 0/);
    assert.deepEqual(p.made().map((b) => b.textContent), ['northern Twigs', 'southern Twigs', 'Harpy Feathers']);
    p.press('Furniture');
    p.rows().find((b) => b.textContent.startsWith('Fancy Double Bed')).onclick();
    assert.match(p.text(), /Fancy Double Bed - rank 40/);
    assert.equal(p.made().length, 0, 'made one way: no row');
  } finally { p.done(); }
});

test('CRAFT2 loom: a garment one pattern, its cloth chosen from what is held (the Linen); Standard-bearer\'s Silk pressed says where it comes from, and no other cloth does', async () => {
  const p = await pageAt({ 'cloth:linen': 3 }, 60, 'loom');
  try {
    p.press('Clothing');
    p.rows().find((b) => b.textContent.startsWith('Straps')).onclick();
    assert.match(p.text(), /Linen Straps - rank 0/);
    assert.doesNotMatch(p.text(), /comes with the sieges/);
    p.press('Standard-bearer\'s Silk');
    assert.match(p.text(), /Standard-bearer's Silk Straps - rank 55/);
    assert.match(p.text(), /cloth:standard comes with the sieges - a Siege Honour's Spoils\./);
  } finally { p.done(); }
});
