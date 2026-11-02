// RPT1026-MARKET STORES-SAID (private reports 2026-10-26: the Stores' newer materials, Arcane Essence and Cured Leather
// among them, and most of the rest, missing from the market's List form and from the guild Stores' Put in; AUDIT RPT1026
// D4: paraphrased, the report's own words were quoted here). The walls are the service's and stand: a silver listing, a writ and the
// guild Stores take only own and silver-bought units (net/bagLaw.js WRIT_ORIGINS, GOLD-MARKET), a gold listing own and
// gold-bought ones, and no market takes a station's loose units (BAG-CRAFT A1; FB1020h ESSENCE-LOOSE: a disenchant of a
// piece made of loose goods). What changed is that the List form and the guild Stores now say what the Stores hold behind
// them, and why. The Stores counts are the service's own (server-account/src/professions.js storeOf, the shape the
// professions' book keeps), over the real database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { d1 } from '../accountDb.mjs';
import { storeOf } from '../../server-account/src/professions.js';
import { walledText, walledUnits, WALLED_SAID } from '../../src/ui/storesWalled.js';
import { listableUnits } from '../../src/ui/marketTab.js';
import { CURED_LEATHER, ARCANE_ESSENCE } from '../../src/net/professionLaw.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const NAMES = { [CURED_LEATHER.key]: CURED_LEATHER.name, [ARCANE_ESSENCE.key]: ARCANE_ESSENCE.name, 'metal:iron': 'Iron' };
const nameOf = (k) => NAMES[k] ?? k;

/** A character's Stores as the service counts them: Cured Leather cured from looted hides (loose) beside some of its own,
 *  Arcane Essence of a piece bought with gold (gold), Iron gathered (own). */
async function stores() {
  const db = d1();
  db._raw.exec('PRAGMA foreign_keys = OFF');   // the Stores' rows alone: no account behind them is read
  const put = db._raw.prepare('INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)');
  put.run('p1', 'c1', CURED_LEATHER.key, 'loose', 40);
  put.run('p1', 'c1', CURED_LEATHER.key, 'own', 3);
  put.run('p1', 'c1', ARCANE_ESSENCE.key, 'gold', 12);
  put.run('p1', 'c1', 'metal:iron', 'own', 20);
  const m = new Map();
  for (const k of [CURED_LEATHER.key, ARCANE_ESSENCE.key, 'metal:iron']) m.set(k, await storeOf(db, 'p1', 'c1', k));
  return m;
}

test('RPT1026-MARKET STORES-SAID: the units each sale may not take are the walls\' own - a silver sale and the guild Stores never gold\'s or loose, a gold sale never silver-bought or loose - and the List form and the guild Stores name each such material with its count and why (mutants: gold\'s units let through the silver line; loose units unsaid; the guild said as a sale)', async () => {
  const st = await stores();
  // what lists, and what does not, partition the Stores in each currency (the List form's own listableUnits)
  for (const s of st.values()) for (const cur of ['marks', 'gold']) {
    assert.equal(listableUnits(s, cur) + walledUnits(s, cur), s.own + s.bought + (s.gold | 0) + (s.loose | 0), `${s.material} ${cur}`);
  }
  assert.equal(walledText(st, 'marks', nameOf), 'Not for a silver sale: Cured Leather (40), Arcane Essence (12). Goods bought with gold sell only for gold, and goods from your pack, or made from them, only go to crafting stations.');
  assert.equal(walledText(st, 'gold', nameOf), 'Not for a gold sale: Cured Leather (40). Goods bought with silver sell only for silver, and goods from your pack, or made from them, only go to crafting stations.');
  assert.equal(walledText(st, 'guild', nameOf), 'Not for the guild Stores: Cured Leather (40), Arcane Essence (12). The guild takes only what you gathered or bought with silver. Goods bought with gold or from your pack stay in your own Stores.');
  assert.equal(walledText(new Map([['metal:iron', st.get('metal:iron')]]), 'marks', nameOf), '', 'nothing walled: nothing said');
  // a long Stores: WALLED_SAID named, the rest counted
  const many = new Map(Array.from({ length: WALLED_SAID + 3 }, (_, i) => [`k${i}`, { material: `k${i}`, own: 0, bought: 0, loose: 1 }]));
  assert.match(walledText(many, 'marks', nameOf), /k7 \(1\) and 3 more\. Goods bought with gold/);
});

test('RPT1026-MARKET STORES-SAID: both places a player looks say it - the market\'s List form for its currency, the guild Stores\' Put in for the guild (mutants: the List form\'s note dropped; the guild\'s dropped)', () => {
  assert.match(src('src/ui/marketTab.js'), /const walled = walledText\(m\.stores\(\), gold \? 'gold' : 'marks', m\.name\);[^\n]*\n\s+if \(walled\) notes\.append\(el\('p', 'notice-tip market-refused', walled\)\);/);
  assert.match(src('src/ui/socialPanel.js'), /const walled = walledText\(stores, 'guild', \(k\) => ps\.name\(k, 2\)\);\n\s+if \(walled\) form\.append\(el\('p', 'dfsocial-note', walled\)\);/);
});
