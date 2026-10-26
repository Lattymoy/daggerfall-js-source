// POTION-DOOR (2026-10-25, SaberGGaming's report: "potions from recipes give no XP"; the owner: "No band aids") - ONE DOOR.
// DFU's potion maker minted its potion on the client and asked no service, so it earned nothing, while the Stores page's
// brew paid; and the Mages Guild's Make Potions was no alchemy station. Now, online at an alchemy station - an
// Alchemist's, a Mages Guild hall, a home's - the maker's grid holds the Stores' ingredients and a mix DFU's recipe law
// accepts is the station's brew, paid by the service (scenes/potionMakerHost.js over ui/professions/profPages.js
// potionMakerDoor); away from a station the mix stays the client's and says it earns nothing; offline the maker is DFU's
// as it is. Built from the producers: the real Worker (test/accountDb.mjs), a book that reads it (net/profBook.js), DFU's
// own window (ui/potionMakerWindow.js) and DFU's own items (profItems.js mintMaterialItem). bible/06-Systems/
// Professions-Arc.md 52.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

import { standService, T0, sessionStorageOf } from '../accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { ALCHEMY_FEE, ENCHANT_FEE, INGREDIENT_KEYS, PLANT_GROUP_TEMPLATES, keyTemplate, professionName } from '../../src/net/professionLaw.js';
import { potionById } from '../../src/net/alchemyLaw.js';
import { POTION_RECIPES } from '../../src/systems/potions.js';
import { brewItems, brewedText } from '../../src/systems/alchemyItems.js';
import { addItem } from '../../src/systems/inventory.js';
import { mintMaterialItem } from '../../src/systems/professions/profItems.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { GUILD_GROUPS } from '../../src/formats/factionFile.js';
import { PotionMakerWindow, POTION_MIXED, POTION_FAILED } from '../../src/ui/potionMakerWindow.js';
import { potionMakerHooks, cauldronKey, POTION_DOOR_WORDS } from '../../src/scenes/potionMakerHost.js';
import { setProfessionsPages, resetProfPages, potionMakerDoor } from '../../src/ui/professions/profPages.js';
import { utcDay } from '../../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const recipe = (name) => POTION_RECIPES.find((r) => r.name === name);
const HEALING = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];
const carried = (keys) => keys.map((k) => mintMaterialItem(k));
const rows = (w) => (w.box?.rows ?? []).map((r) => r.text);
const settled = async (w) => { for (let i = 0; i < 400 && w._brewing; i++) await new Promise((r) => setTimeout(r, 5)); };

/** A character on the real Worker, a book reading it, the Stores page's provider as world.js hands it (its brew through
 *  the book, the potions minted into the pack on the answer) and the maker's window on the hooks the host builds. */
async function stand({ station = true, rank = 0 } = {}) {
  resetProfPages();
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const give = (m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, qty);
  const stored = (m) => raw.prepare('SELECT COALESCE(SUM(qty), 0) AS n FROM prof_stores WHERE player = ? AND material = ?').get(mac.id, m).n;
  if (rank) raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, \'provisioning\', ?, 1)').run(mac.id, mac.character, 10 * rank * rank);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  const player = { items: [], wagonItems: [], goldPieces: 500 };
  const asked = [];
  setProfessionsPages({
    book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), purse: () => player.goldPieces,
    alchemy: () => (station ? { kind: 'shop', fee: 0 } : null),
    brew: async (potion, keys) => {
      asked.push([potion, keys]);
      const r = await book.brew(potion, keys, { fee: 0 }, (data) => { for (const it of brewItems(data)) addItem(player.items, it, 'back'); });
      return r.ok ? { ok: true, text: `${brewedText(r.data)} (+${r.data.xp} ${professionName('alchemy')} XP).` } : { ok: false, text: accountRefusalText(r.error) };
    },
  });
  const open = () => new PotionMakerWindow(potionMakerHooks({ player, icons: ICONS }));
  return { s, raw, mac, give, stored, book, player, asked, open };
}

// ─── THE DONE-WHEN ───────────────────────────────────────────────────

test('POTION-DOOR DONE WHEN: at an alchemy station, online, the potion maker lists the Stores\' Red Berries, Troll\'s Blood, Elixir Vitae and Mercury beside the pack, its Healing filled from them and mixed IS the brew - asked of the real Worker, its 20 XP and its first\'s 3,155 credited to Provisioning, two potions into the pack, the four out of the Stores, the cauldron emptied, the answer said (mutants: the Stores unlisted; the mix minted on the client; the brew\'s keys the herb\'s other group; the cauldron kept)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { give, stored, book, player, asked, open } = await stand();
  for (const k of HEALING) give(k, 1);
  assert.equal((await book.refresh()).ok, true);
  const w = open();
  assert.deepEqual(w.ingredients().map((it) => [it.stores, it.name, it.stackCount]), [
    ['p1:16', 'Red Berries', 1], ['metal:mercury', 'Mercury', 1], ['reagent:troll-blood', 'Troll\'s Blood', 1], ['reagent:elixir-vitae', 'Elixir Vitae', 1],
  ], 'the Stores\' ingredients, DFU\'s own items, each its key');
  w._fillFrom(recipe('healing'));
  assert.equal(w.cauldron.length, 4);
  assert.deepEqual(w.ingredients(), [], 'every unit in the pot');
  w._mix();
  assert.equal(w._brewing, true, 'asked');
  assert.deepEqual(rows(w), ['Brewing...']);
  w._mix();
  assert.equal(asked.length, 1, 'a press while it is asked is that one');
  w._removeFromCauldron(0);
  w._fillFrom(recipe('healing'));
  assert.equal(w.cauldron.length, 4, 'the pot it brews is not touched while it is asked');
  await settled(w);
  assert.deepEqual(asked, [['healing', ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury']]], 'the cauldron as the Stores hold it');
  assert.equal(book.track('alchemy').xp, 20 + 3155, 'the brew\'s XP and Provisioning\'s first-make share, the service\'s');
  assert.deepEqual([player.items.length, player.items[0].stackCount], [1, 2], 'two potions, one stack, minted on the answer');
  assert.equal(player.items[0].potionRecipeKey, potionById('healing').key);
  assert.deepEqual(HEALING.map(stored), [0, 0, 0, 0], 'the four out of the Stores');
  assert.deepEqual(w.cauldron, [], 'the cauldron emptied');
  assert.deepEqual(rows(w), [POTION_MIXED, `You brewed 2 Potions of Healing (+3175 ${professionName('alchemy')} XP).`]);
});

// ─── THE DOOR'S LAW ──────────────────────────────────────────────────

test('POTION-DOOR the door: a failed cauldron holding the Stores\' goods is refused, nothing spent; a carried cauldron at a station is the brew too (BAG-CRAFT puts it in), its keys each unit\'s own - a southern herb its group\'s; a potion past the rank mixed as DFU mixes it, said so; a fee the purse cannot meet the same (mutants: a failed Stores cauldron spent; the rank unread; the fee unread; a carried herb\'s group lost)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { give, stored, book, player, asked, open } = await stand();
  give('p1:16', 1);
  assert.equal((await book.refresh()).ok, true);
  player.items.push(mintMaterialItem('p1:16'));   // a carried Red Berries beside the Stores' one
  const w = open();
  assert.deepEqual(w.ingredients().map((it) => [it.stores ?? 'carried', it.stackCount]), [['carried', 1], ['p1:16', 1]], 'each its own source');
  w._addToCauldron(w.ingredients()[1]);
  assert.deepEqual(w.ingredients().map((it) => [it.stores ?? 'carried', it.stackCount]), [['carried', 1]], 'the Stores\' unit in the pot, the carried one still on the grid');
  w._mix();
  assert.deepEqual(rows(w), [POTION_FAILED], 'no recipe answers it - the window\'s own word');
  assert.deepEqual([w.cauldron.length, stored('p1:16'), asked.length, player.items.length], [1, 1, 0, 1], 'nothing spent - not the Stores\', not the pack\'s twin - nothing asked');
  player.items = [];
  // a carried cauldron at a station: the brew, its keys the units' own
  player.items.push(...carried(['p2:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury']));
  const h = potionMakerHooks({ player, icons: ICONS });
  const pot = carried(['p2:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury']);
  const door = h.brew({ kind: 'mixed', recipe: recipe('healing') }, pot);
  assert.equal(door.wait, 'Brewing...');
  await door.answer;
  assert.deepEqual(asked.at(-1), ['healing', ['p2:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury']], 'the southern Red Berries its own key');
  assert.deepEqual([cauldronKey(pot[0]), cauldronKey(mintMaterialItem('p1:16')), cauldronKey({ templateIndex: 9999 })], ['p2:16', 'p1:16', null]);
  // Invisibility is rank 70: carried, it is mixed as the classic maker mixes it and says why
  const inv = carried(['gem:diamond', 'reagent:ectoplasm', 'reagent:rain-water', 'reagent:nectar']);
  assert.deepEqual(h.brew({ kind: 'mixed', recipe: recipe('invisibility') }, inv), { classic: true, word: POTION_DOOR_WORDS.rank('Invisibility', 70) });
  assert.equal(POTION_DOOR_WORDS.rank('Invisibility', 70), `Mixed as the classic potion maker mixes, it earns no ${professionName('alchemy')} experience: Invisibility is brewed from ${professionName('alchemy')} rank 70.`);
  // from the Stores it cannot be mixed by the client: refused, said
  const fromStores = inv.map((it, i) => ({ ...it, stores: ['gem:diamond', 'reagent:ectoplasm', 'reagent:rain-water', 'reagent:nectar'][i] }));
  assert.deepEqual(h.brew({ kind: 'mixed', recipe: recipe('invisibility') }, fromStores), { ok: false, text: POTION_DOOR_WORDS.stored('Invisibility', 70) });
  // a station's fee the purse cannot meet: the classic mix, said
  setProfessionsPages({ book, name: (k) => k, withdraw: async () => ({ ok: true }), alchemy: () => ({ kind: 'shop', fee: ALCHEMY_FEE }), brew: async () => ({ ok: true, text: '' }) });
  player.goldPieces = ALCHEMY_FEE - 1;
  assert.deepEqual(h.brew({ kind: 'mixed', recipe: recipe('healing') }, pot), { classic: true, word: POTION_DOOR_WORDS.fee(ALCHEMY_FEE) });
  player.goldPieces = ALCHEMY_FEE;
  assert.ok(h.brew({ kind: 'mixed', recipe: recipe('healing') }, pot).answer, 'met: the brew');
  resetProfPages();
});

test('POTION-DOOR away from a station, online: the maker lists no Stores, its mix is the client\'s - DFU\'s potion minted, the pack spent, no XP - and it says it earns no Provisioning experience and where it would; offline it is DFU\'s maker as it is, nothing said (mutants: the word unsaid; the word offline; the Stores listed away from a station)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { give, book, player, asked, open } = await stand({ station: false });
  give('p1:16', 5);
  assert.equal((await book.refresh()).ok, true);
  player.items.push(...carried(HEALING));
  const w = open();
  assert.deepEqual(w.ingredients().map((it) => it.stores ?? 'carried'), ['carried', 'carried', 'carried', 'carried'], 'no Stores away from a station');
  w._fillFrom(recipe('healing'));
  w._mix();
  assert.equal(w._brewing, undefined);
  assert.deepEqual(rows(w), [POTION_MIXED, POTION_DOOR_WORDS.away()]);
  assert.match(POTION_DOOR_WORDS.away(), /^A potion mixed here earns no Provisioning experience\. At an alchemy station \(an Alchemist's, a Mages Guild hall or your own home\)/);
  assert.deepEqual([player.items.length, player.items[0].potionRecipeKey, asked.length, book.track('alchemy')?.xp ?? 0], [1, potionById('healing').key, 0, 0], 'DFU\'s own potion, the pack\'s four spent, nothing asked, no XP');
  // offline: no door, DFU's maker as it is
  setProfessionsPages(null);
  assert.equal(potionMakerDoor(), null);
  player.items = carried(HEALING);
  const off = open();
  off._fillFrom(recipe('healing'));
  off._mix();
  assert.deepEqual(rows(off), [POTION_MIXED], 'nothing said offline');
  assert.equal(player.items.length, 1);
  assert.equal(potionMakerHooks({ player: { items: [] }, icons: ICONS }).stocked(), false, 'MakePotionService\'s refusal: nothing carried, no Stores');
});

test('POTION-DOOR the Stores the maker lists: every Stores key that holds a DFU ingredient - each group\'s herbs, the metals, the gems, the Pearl, the parts and the Apothecaries\' sixteen - and none else; at a station an empty-handed player with Stores ingredients is let in (mutants: a group dropped; the reagents dropped; the gate the pack\'s alone)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  assert.deepEqual([INGREDIENT_KEYS.length, PLANT_GROUP_TEMPLATES.p1.length, PLANT_GROUP_TEMPLATES.p2.length], [74, 15, 19], 'the herbs of both groups, and forty rows');
  for (const k of INGREDIENT_KEYS) assert.notEqual(keyTemplate(k), null, `${k} holds a DFU ingredient`);
  assert.equal(new Set(INGREDIENT_KEYS).size, INGREDIENT_KEYS.length);
  for (const k of [...PLANT_GROUP_TEMPLATES.p1.map((x) => `p1:${x}`), ...PLANT_GROUP_TEMPLATES.p2.map((x) => `p2:${x}`), 'metal:mercury', 'gem:diamond', 'reagent:nectar', 'reagent:troll-blood']) assert.ok(INGREDIENT_KEYS.includes(k), k);
  const { give, book, player } = await stand();
  give('reagent:nectar', 3);
  assert.equal((await book.refresh()).ok, true);
  const h = potionMakerHooks({ player, icons: ICONS });
  assert.equal(h.stocked(), true, 'the Stores\' Nectar lets the maker open');
  assert.deepEqual(h.storeItems().map((it) => [it.stores, it.stackCount]), [['reagent:nectar', 3]]);
  resetProfPages();
});

// ─── THE MAGES GUILD, AN ALCHEMY STATION ─────────────────────────────

const M = src('src/scenes/worldModes.js');
const AST = parse(M, { ecmaVersion: 'latest', sourceType: 'module' });
/** A method of the object createWorldModes returns, by name, as source. */
function method(name) {
  const walk = (n) => {
    if (!n || typeof n !== 'object') return null;
    if (n.type === 'Property' && n.key?.name === name && n.method) return `function ${M.slice(n.value.start, n.value.end)}`;
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) { for (const c of v) { const f = walk(c); if (f) return f; } } else if (v && typeof v === 'object') { const f = walk(v); if (f) return f; }
    }
    return null;
  };
  const f = walk(AST);
  assert.ok(f, `worldModes.js has ${name}`);
  return f;
}

test('POTION-DOOR the Mages Guild hall is an alchemy station (worldModes alchemyHere): its Make Potions\' maker brews there, at the Alchemist\'s fee; another guild\'s hall (a temple\'s) is none; the enchanting station there as it was; the host builds the maker on the module\'s hooks and the empty-handed refusal reads them (mutants: the hall unasked; the fee the enchanter\'s; any guild\'s hall a station)', () => {
  const ask = (q, group, type = BUILDING_TYPES.GuildHall) => Function('mode', 'interiorBuilding', 'BUILDING_TYPES', 'GUILD_GROUPS', 'ALCHEMY_FEE', 'ENCHANT_FEE', 'guildGroupOfFaction', 'townTalk',
    'stationOwnerHere', 'hallMemberHere', 'interiorDecor', 'caravanGuestStation', `return (${method(q)})();`)(
    'interior', { buildingType: type, factionId: 40, insideOpenShop: true }, BUILDING_TYPES, GUILD_GROUPS, ALCHEMY_FEE, ENCHANT_FEE, () => group, { factionDict: {} },
    () => false, () => false, { list: () => [] }, () => null);
  assert.deepEqual(ask('alchemyHere', GUILD_GROUPS.MagesGuild), { kind: 'shop', fee: ALCHEMY_FEE });
  assert.deepEqual(ask('enchantHere', GUILD_GROUPS.MagesGuild), { kind: 'shop', fee: ENCHANT_FEE });
  const other = Object.values(GUILD_GROUPS).find((g) => g !== GUILD_GROUPS.MagesGuild);
  assert.equal(ask('alchemyHere', other), null, 'a temple\'s hall offers Make Potions and is no station');
  assert.deepEqual(ask('alchemyHere', null, BUILDING_TYPES.Alchemist), { kind: 'shop', fee: ALCHEMY_FEE }, 'the Alchemist\'s as it was');
  // the host: the window on the module's hooks, its refusal read off them (HOST-SPLIT: none of the hooks in the host)
  assert.match(M, /const hooks = potionMakerHooks\(\{ player: playerEntity, surface: surfacePlayer, icons: \{ getTexture, uploadRecord, textures: renderer\.textures \}, onClose: \(\) => closeSpellWindow\(potionWin\) \}\);\n\s+if \(!hooks\.stocked\(\)\) return \{ rows: rows\(NO_POTION_INGREDIENTS\), closesWindow: true \};\n\s+potionWin = enhancedWindow\(new PotionMakerWindow\(hooks\), 'potionMaker'\);/);
  assert.doesNotMatch(M, /addPotion: \(recipe, key\) =>|recipeKeys: \(\) =>/, 'the hooks are the module\'s');
});
