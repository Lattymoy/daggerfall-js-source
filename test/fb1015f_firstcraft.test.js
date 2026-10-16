// CRAFT-FIRST-SHOWN (FIELD BUGS 2026-10-15f; the Discord, 2026-10-13: "Outfitting xp (first-time craft bonus): The first
// time craft bonus is not applying to the outfitting. I got somehow it once from...Fishing net? Then never after.") -
// AUDIT 32 S1 KEPT, AND SAID. The +500 first-make XP (recipeLaw FIRST_CRAFT_XP) is withheld from a pattern made wholly of
// goods only a counter sells (recipeLaw firstCraftPays over professionLaw COUNTER_ONLY - the Weavers' Linen and Wool),
// and nothing in the game said so. Now every station's box says its pattern's XP and its first's, or that the Weavers'
// cloth earns none (ui/craftXpWords.js craftXpLine, read by ui/profPages.js), and the craft's word says a first, and why
// none came (craftXpText, read by scenes/world.js's `craft`). Built from the producers: the recipe tables, the account
// service's craft answer through the real Worker (test/accountDb.mjs), and a book that reads it (net/profBook.js).
// bible/06-Systems/Professions-Arc.md 41.9.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { RECIPES, COOKING_RECIPES, recipeById, firstCraftPays, SCULPTOR } from '../src/net/recipeLaw.js';
import { MASON_RECIPES, WEAVERS_STOCK, xpForRank } from '../src/net/professionLaw.js';
import { craftXpLine, craftXpText } from '../src/ui/craftXpWords.js';
import { setProfessionsPages, drawStoresPage, resetProfPages } from '../src/ui/profPages.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const NOON = utcDay(T0) * 86_400 + 12 * 3600;
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };

/** A character on the real Worker, its Stores and tracks written as the service keeps them, and a book reading it. */
async function standBook() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  const give = (m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, origin, qty);
  const track = (prof, xp, spec100 = null) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec100 = excluded.spec100`).run(mac.id, mac.character, prof, xp, spec100, NOON);
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  return { s, raw, mac, give, track, book };
}

// ─── THE LAW THE WORDS SAY ───────────────────────────────────────────

test('CRAFT-FIRST-SHOWN the law the words say: the patterns whose first lays on nothing are the loom\'s 152 made wholly of the Weavers\' Linen and Wool, the Fishing-Net among them - so the line and the word that say so name that cloth; both mason\'s works and every dish pay a first; a box\'s line is the craft\'s XP at the rank (a quarter past two tiers) and the 500 (mutants: the line\'s two branches swapped either way; the quarter, the 500 read whole)', () => {
  const none = RECIPES.filter((r) => !firstCraftPays(r));
  const cloth = WEAVERS_STOCK.map((x) => x.key);
  assert.equal(none.length, 152);
  assert.deepEqual([...new Set(none.map((r) => r.profession))], ['outfitting']);
  assert.deepEqual(none.filter((r) => !r.inputs.every((i) => cloth.includes(i.key))).map((r) => r.id), [], 'every one wholly the Weavers\' cloth - the words name it');
  assert.equal(none.some((r) => r.id === 'fishingnet:linen'), true, 'the Fishing-Net, the report\'s, never paid');
  assert.deepEqual(MASON_RECIPES.map((w) => [w.id, !!w.act && firstCraftPays(w)]), [['cut:stone', true], ['mix:mortar', true]], 'the bench\'s line says both');
  assert.deepEqual(COOKING_RECIPES.filter((r) => !firstCraftPays(r)).map((r) => r.id), [], 'the fire\'s line stands for every dish');
  // the box's line, at the rank the craft is read at
  assert.equal(craftXpLine(recipeById('garment-165:linen'), 0, 'Outfitting'), '20 Outfitting XP. Made only of cloth from the Weavers, it earns no first-time bonus.');
  assert.equal(craftXpLine(recipeById('fishingnet:linen'), 0, 'Outfitting'), '20 Outfitting XP. Made only of cloth from the Weavers, it earns no first-time bonus.');
  assert.equal(craftXpLine(recipeById('garment-149:linen'), 0, 'Outfitting'), '20 Outfitting XP, and 500 more the first time you make this piece at this tier.', 'a bolt and a Cured Leather: the 500');
  assert.equal(craftXpLine(recipeById('longsword:daedric'), 90, 'Smithing'), '140 Smithing XP, and 500 more the first time you make this piece at this tier.');
  assert.equal(craftXpLine(recipeById('dagger:iron'), 70, 'Smithing'), '5 Smithing XP, and 500 more the first time you make this piece at this tier.', 'tier 1 at rank 70: a quarter; the 500 whole');
});

// ─── THE CRAFT'S WORD, FROM THE SERVICE'S ANSWER ─────────────────────

test('CRAFT-FIRST-SHOWN the craft\'s word, from the real Worker\'s answer through the book: Linen Straps\' first says it was a first and that the Weavers\' cloth earns no first-time bonus; Linen Boots\' first (a bolt and a Cured Leather) says the bonus came with it; a second of either its XP alone; in French the French; world.js says it with one call (mutants: the first unread; the cloth\'s why on every first or on none; the host\'s old word)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  const { give, book } = await standBook();
  give('cloth:linen', 'bought', 10);
  give('leather:cured', 'own', 5);
  assert.equal((await book.refresh()).ok, true);
  const word = async (id) => {
    const r = await book.craft(id, { clean: false, name: 'Mac' }, () => {});
    assert.equal(r.ok, true, JSON.stringify(r));
    return [r.data.xp, r.data.first, craftXpText(recipeById(id), r.data, 'Outfitting')];
  };
  assert.deepEqual(await word('garment-141:linen'), [20, true, '(+20 Outfitting XP - your first, but cloth from the Weavers earns no first-time bonus)']);
  assert.deepEqual(await word('garment-149:linen'), [520, true, '(+520 Outfitting XP, with the first-time bonus)']);
  assert.deepEqual(await word('garment-149:linen'), [20, false, '(+20 Outfitting XP)'], 'once');
  assert.deepEqual(await word('garment-141:linen'), [20, false, '(+20 Outfitting XP)'], 'and the cloth\'s second says nothing of a first');
  // in the player's language: the drafts, read when said
  const tm = await import('../src/systems/textManager.js');
  const rows = tm.loadStringTableCsv(src('locales/fr/Port_Strings.csv'));
  tm.patchLocaleTable('fr', 'Port_Strings', rows);
  const fr = new Map(rows);
  try {
    tm.setLocale('fr');
    const shop = craftXpText(recipeById('garment-141:linen'), { xp: 20, first: true }, 'Outfitting');
    assert.equal(shop, tm.formatMessage(fr.get('prof.craft.xpFirstShop'), { xp: 20, profession: 'Outfitting' }));
    assert.match(shop, /Tisserands/);
    assert.equal(craftXpLine(recipeById('garment-149:linen'), 0, 'Outfitting'), tm.formatMessage(fr.get('prof.page.craft.xpFirst'), { xp: 20, more: 500, profession: 'Outfitting' }));
  } finally {
    tm.setLocale('en');
  }
  // THE HOSTS DO NOT GROW: world.js's craft says its XP through the module, one call
  const w = src('src/scenes/world.js');
  assert.match(w, /^import \{ craftXpText \} from '\.\.\/ui\/craftXpWords\.js';/m);
  assert.match(w, /const rec = recipeById\(recipe\);\n.*\n\s+return \{ ok: true, text: `\$\{chain \? `\$\{chain\} ` : ''\}\$\{made\} \$\{craftXpText\(rec, r\.data, st\.xp\)\}\$\{paid \?/);
  assert.doesNotMatch(w, /\(\+\$\{r\.data\.xp\} \$\{st\.xp\} XP\)/, 'the old word, which left `first` unread, is gone');
});

// ─── THE STATIONS' BOXES ─────────────────────────────────────────────

test('CRAFT-FIRST-SHOWN the stations say it, read off the real book: the loom\'s Straps, Fishing-Net and Wool rug the cloth\'s no-bonus line, its Boots and Leather Cuirass the 500; the anvil\'s Dagger and the jeweller\'s Silver Ring (its odds no longer carrying the XP) the 500 at Smithing\'s rank, a metal past the rank no line; the workbench\'s Staff and a Sculptor\'s Stone Column at Building 100 a quarter and the 500; the mason\'s works their first; the fire\'s stew its first; a counter-only potion why it pays none (mutants: each station\'s line gone; the rank\'s guard; the profession named)', async (t) => {
  t.mock.method(Date, 'now', () => NOON * 1000);
  resetProfPages();
  setPref('gentleActs', false);
  const { track, book } = await standBook();
  track('smithing', 0);
  track('outfitting', xpForRank(10));
  track('building', xpForRank(100), SCULPTOR);
  track('provisioning', xpForRank(25));
  assert.equal((await book.refresh()).ok, true);
  const home = () => ({ kind: 'home', fee: 0 });
  const stub = async () => ({ ok: true, text: '' });
  setProfessionsPages({
    book, name: (k) => k, withdraw: stub, smelt: stub, craft: stub, brew: stub, stock: stub, clothing: () => 'MensClothing',
    forge: home, workbench: home, loom: home, mason: home, fire: home, jeweller: home, alchemy: home,
  });
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  const station = (title) => {
    const s = [...root.querySelectorAll('.prof-station')].find((x) => x.querySelector('h3')?.textContent === title);
    assert.ok(s, `the station ${title}`);
    return s;
  };
  const press = (title, label, exact = false) => {
    const b = [...station(title).querySelectorAll('button')].find((x) => (exact ? x.textContent === label : x.textContent.startsWith(label)));
    assert.ok(b, `${title}: ${label}`);
    b.onclick();
  };
  /** the picked pattern's box at a station, its head and its notes */
  const box = (title) => {
    const b = station(title).querySelector('.prof-craft');
    assert.ok(b, `${title}: a box`);
    return [b.children[0].textContent, [...b.querySelectorAll('p')].map((p) => p.textContent)];
  };
  const FIRST = (xp, prof) => `${xp} ${prof} XP, and 500 more the first time you make this piece at this tier.`;
  const SHOP = (xp) => `${xp} Outfitting XP. Made only of cloth from the Weavers, it earns no first-time bonus.`;
  try {
    draw();
    // THE LOOM, Outfitting 10: the Weavers' cloth alone says it earns none; a boot's Cured Leather and the leathers the 500
    press('The Loom', 'Clothing', true);
    press('The Loom', 'Straps');
    assert.deepEqual([box('The Loom')[0], box('The Loom')[1].slice(-2)], ['Linen Straps - rank 0', ['Your rank 10, margin 10: Standard 50 | Fine 40 | Superior 10. A clean stitch is a step better.', SHOP(20)]], 'under the odds');
    press('The Loom', 'Boots');
    assert.equal(box('The Loom')[0], 'Linen Boots - rank 0');
    assert.equal(box('The Loom')[1].at(-1), FIRST(20, 'Outfitting'));
    press('The Loom', 'Tools', true);
    press('The Loom', 'Fishing-Net');
    assert.equal(box('The Loom')[1].at(-1), SHOP(20), 'the report\'s Fishing-Net: none, and said');
    press('The Loom', 'Furnishings', true);
    press('The Loom', 'Small Plain Rug');
    assert.deepEqual([box('The Loom')[0], box('The Loom')[1].at(-1)], ['Small Plain Rug - rank 10', SHOP(40)]);
    press('The Loom', 'Leather', true);
    press('The Loom', 'Cuirass');
    assert.deepEqual([box('The Loom')[0], box('The Loom')[1].at(-1)], ['Leather Cuirass - rank 10', FIRST(40, 'Outfitting')]);
    // THE ANVIL, Smithing 0: the Iron Dagger's 20 and the 500; the Silver Dagger past the rank, no line
    press('The Anvil', 'Dagger');
    assert.deepEqual(box('The Anvil')[0], 'Iron Dagger - rank 0');
    assert.equal(box('The Anvil')[1].filter((p) => / XP/.test(p)).join('|'), FIRST(20, 'Smithing'));
    press('The Anvil', 'Silver - rank 25', true);
    assert.equal(box('The Anvil')[0], 'Silver Dagger - rank 25');
    assert.deepEqual(box('The Anvil')[1].filter((p) => / XP/.test(p)), [], 'a recipe past the rank says no XP');
    // THE JEWELLER'S BENCH, a jewel on Smithing's track: the odds without the XP, the XP its own line beside the first's
    press('The Jeweller\'s Bench', 'Silver Ring');
    const jewel = box('The Jeweller\'s Bench');
    assert.equal(jewel[0], 'Silver Ring - rank 0');
    assert.ok(jewel[1].includes('Your rank 0, margin 0: Crude 20 | Standard 60 | Fine 20. A clean facet is a step better.'), jewel[1].join('|'));
    assert.equal(jewel[1].at(-1), FIRST(20, 'Smithing'));
    // THE WORKBENCH, Building 100: a Pine Staff, tier 1, is a quarter - 5 - and its first still the 500
    press('The Workbench', 'Staff');
    assert.deepEqual([box('The Workbench')[0], box('The Workbench')[1].at(-1)], ['Pine Staff - rank 0', FIRST(5, 'Building')]);
    // THE MASON'S BENCH: the works' first, and a Sculptor's carving
    assert.ok(station('The Mason\'s Bench').querySelectorAll('p').some((p) => p.textContent === 'Your first cut and your first mix each earn 500 more Building XP.'));
    press('The Mason\'s Bench', 'Stone Column');
    assert.deepEqual([box('The Mason\'s Bench')[0], box('The Mason\'s Bench')[1].at(-1)], ['Stone Column - a Sculptor\'s', FIRST(10, 'Building')]);
    // THE FIRE: a dish's first, beside the pans' XP
    press('The Fire', 'Hunter\'s Stew');
    assert.equal(box('The Fire')[1].at(-1), 'The first time you cook this dish: 500 more Provisioning XP.');
    // THE ALCHEMY STATION: a potion wholly of the Apothecaries' goods says why it pays no first (AUDIT 32 S1's law, brewFirstPays)
    press('The Alchemy Station', 'Water Breathing');
    assert.match(box('The Alchemy Station')[1].join('|'), /60 Provisioning XP\. Made only of the Apothecaries' goods, it earns no first-time bonus\./);
  } finally {
    setProfessionsPages(null);
    root?.remove?.();
  }
});
