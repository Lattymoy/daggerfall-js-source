// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 9; bible/06-Systems/Gilded.md section 10): THE KETCHMASTER'S
// HOLD - one member's share rolled off the receipt's seed: gold by its level, a Legendary or Rare piece and one more by
// the source, the Ketch's own foundry's Pellets always, THE DWARVEN THUNDERLOCK and THE DWARVEN PISTOLET each its own rare
// draw (the one door that mints either), and last of all the Ketch's two Gilded guns at their rarer chance; the same seed
// the same share; every piece lawful; the pool's keys. tools/mutants/ketch_spoils.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rollKetchSpoils, ketchSpoilsList, ketchSpoilsDay, ketchSpoilsOf, KT_SPOILS_GOLD_PER_LEVEL, KT_SPOILS_LEGENDARY, KT_SPOILS_PELLETS,
  KT_THUNDERLOCK_CHANCE, KT_PISTOLET_CHANCE, KT_SPOILS_KEYS, KT_SPOILS_GATHERED, KT_SPOILS_TEXT,
} from '../../../src/systems/ketch/ketchSpoils.js';
import { KETCH_GILDED_CHANCE, VOLENDRUNGS_ECHO, KETCHMASTERS_WORD, GILDED_CHANCE } from '../../../src/systems/gilded.js';
import { validLootItem } from '../../../src/systems/loot/loot.js';
import { SPOILS_KEYS } from '../../../src/scenes/spoilsPool.js';
import { SD_SPOILS_KEYS } from '../../../src/systems/superDungeon/sdSpoils.js';
import { readFileSync } from 'node:fs';

const N = 4000;
const rolls = Array.from({ length: N }, (_, c) => rollKetchSpoils(c * 2654435761 >>> 0, 30));

test('KETCH THE SHARE: gold 450 a level the seed varying it a fifth either way; two pieces - the first Legendary a quarter of the time else Rare, the second Rare or better; the foundry\'s 20 to 40 Pellets always; the same seed the same share (mutants: the gold unvaried; the first piece Rare always; the Pellets one short)', () => {
  assert.equal(KT_SPOILS_GOLD_PER_LEVEL, 450);
  for (const s of rolls) {
    assert.ok(s.gold >= 450 * 30 * 0.8 - 1 && s.gold <= 450 * 30 * 1.2 + 1);
    assert.equal(s.pieces.length, 2);
    assert.ok(['legendary', 'rare'].includes(s.pieces[0].tier), s.pieces[0].tier);
    assert.ok(['rare', 'legendary'].includes(s.pieces[1].tier), s.pieces[1].tier);
    assert.ok(s.pellets >= KT_SPOILS_PELLETS.min && s.pellets <= KT_SPOILS_PELLETS.max);
  }
  assert.ok(new Set(rolls.map((s) => s.gold)).size > 500, 'the seed varies the gold');
  const leg = rolls.filter((s) => s.pieces[0].tier === 'legendary').length / N;
  assert.ok(Math.abs(leg - KT_SPOILS_LEGENDARY) < 0.03, `legendary ${leg}`);
  const ps = new Set(rolls.map((s) => s.pellets));
  assert.ok(ps.has(KT_SPOILS_PELLETS.min) && ps.has(KT_SPOILS_PELLETS.max), 'the whole band');
  const a = rollKetchSpoils(77, 30), b = rollKetchSpoils(77, 30);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), 'the seed\'s own');
});

test('KETCH THE GUNS: the Thunderlock one share in ten, the Pistolet one in eight, each its own draw - and the Ketch\'s Gilded pair, Volendrung\'s Echo and the Ketchmaster\'s Word, one in a hundred each, rarer than the Gilded rung\'s others (mutants: the two guns one draw; the Gilded at the old chance; a gun every share)', () => {
  assert.deepEqual([KT_THUNDERLOCK_CHANCE, KT_PISTOLET_CHANCE, KETCH_GILDED_CHANCE], [1 / 10, 1 / 8, 1 / 100]);
  assert.ok(KETCH_GILDED_CHANCE <= GILDED_CHANCE, 'never likelier than the Hour\'s');
  const tl = rolls.filter((s) => s.guns.some((g) => /Thunderlock/.test(g.name))).length / N;
  const pi = rolls.filter((s) => s.guns.some((g) => /Pistolet/.test(g.name))).length / N;
  const both = rolls.filter((s) => s.guns.length === 2).length / N;
  assert.ok(Math.abs(tl - 0.1) < 0.02, `thunderlock ${tl}`);
  assert.ok(Math.abs(pi - 0.125) < 0.02, `pistolet ${pi}`);
  assert.ok(Math.abs(both - 0.1 * 0.125) < 0.008, `both ${both} - two draws`);
  const echo = rolls.filter((s) => s.gilded.some((g) => g.name === VOLENDRUNGS_ECHO.name)).length / N;
  const word = rolls.filter((s) => s.gilded.some((g) => g.name === KETCHMASTERS_WORD.name)).length / N;
  assert.ok(echo > 0 && echo < 0.025, `echo ${echo}`);
  assert.ok(word > 0 && word < 0.025, `word ${word}`);
});

test('KETCH THE LIST THE POOL THROWS: the pieces, the guns, the Gilded, the Pellets, then the gold - each lawful, each dressed in a treasure flat; the receipt\'s spent key its voyage and ship, read back (mutants: the Pellets after the gold)', () => {
  let seen = 0;
  for (let c = 0; c < 600 && seen < 3; c++) {
    const L = ketchSpoilsList(c, 30);
    assert.equal(L.at(-1).kind, 'gold');
    assert.equal(L.at(-2).item.name.includes('Pellet'), true, 'the Pellets before the gold');
    for (const e of L.filter((x) => x.kind === 'item')) assert.ok(validLootItem(e.item), `${e.item.name} lawful`);
    for (const e of L) assert.ok(Array.isArray(e.record) || Number.isFinite(e.record) || typeof e.record === 'object', 'a flat');
    if (L.some((e) => e.kind === 'item' && /Thunderlock|Pistolet/.test(e.item.name))) seen++;
  }
  assert.ok(seen >= 3, 'the guns come through the list');
  assert.equal(ketchSpoilsDay(3, '0123456789abcdef'), 'kt:3.0123456789abcdef');
  assert.deepEqual(ketchSpoilsOf('kt:3.0123456789abcdef'), { d: 3, o: '0123456789abcdef' });
  for (const bad of ['kt:3', 'sd:3.0123456789abcdef', 'kt:x.0123456789abcdef', null]) assert.equal(ketchSpoilsOf(bad), null);
  assert.deepEqual({ ...KT_SPOILS_KEYS }, { store: 'kt.spoils', day: 'kt.spoilsDay' });
  for (const K of [SPOILS_KEYS, SD_SPOILS_KEYS]) assert.ok(K.store !== KT_SPOILS_KEYS.store && K.day !== KT_SPOILS_KEYS.day, 'its own keys - never the gate\'s, never the Hour\'s');
});

test('KETCH THE HOLD THROWS INTO ITS OWN POOL: the client makes the pool with the Ketch\'s keys, its bound and its own gathered word, and no mailbox (the service keeps no kill of a ship\'s); the world host hands it no other pool, and the floor aboard is the Ketch\'s (AUDIT KETCH L2-3, L2-4; mutants: the Hour\'s pool handed again)', () => {
  const client = readFileSync(new URL('../../../src/scenes/ketch/ketchClient.js', import.meta.url), 'utf8');
  const made = client.slice(client.indexOf('const spoils = createSpoilsPool({'), client.indexOf('});', client.indexOf('const spoils = createSpoilsPool({')));
  assert.match(made, /keys: KT_SPOILS_KEYS, recordsMax: KT_SPOILS_RECORDS_MAX, gathered: KT_SPOILS_GATHERED/);
  assert.doesNotMatch(made, /mail:/, 'no leftovers promised to the mailbox');
  const world = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const wired = world.slice(world.indexOf('createKetchClient({'), world.indexOf('}) : null;', world.indexOf('createKetchClient({')));
  assert.doesNotMatch(wired, /spoils: sdSpoilsPool/, 'the Hour\'s pool handed no more');
  assert.match(world, /const floorPool = \(\) => \(modes\?\.ktShip\?\.\(\) != null && ketch \? ketch\.spoils :/);
  assert.notEqual(KT_SPOILS_GATHERED, KT_SPOILS_TEXT.gathered, 'a sentinel, said in the player\'s words when it is said');
});
