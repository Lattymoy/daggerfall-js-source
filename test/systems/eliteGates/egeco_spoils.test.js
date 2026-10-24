// EG-E (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 19, REWARDS AND THE ECONOMY): A
// REDOUBT'S SPOILS - the lords' named Legendaries (systems/eliteGates/egLordArms.js) and the lords' own cards (net/iliac/iliacCards.js,
// systems/bossCards.js BOSS_CARDS by lord key).
import test from 'node:test';
import assert from 'node:assert/strict';
import { EG_LORD_ARMS, egLordArm } from '../../../src/systems/eliteGates/egLordArms.js';
import { BOSS_CARDS, BOSS_CARD_PER_MILLE, bossCardRoll } from '../../../src/systems/bossCards.js';
import { cardById } from '../../../src/net/iliac/iliacCards.js';
import { EG_LORDS } from '../../../src/net/eliteGates/egLaw.js';
import { templateByIndex } from '../../../src/systems/item/itemTemplates.js';
import { validLootItem } from '../../../src/systems/loot/loot.js';
import { seededRng } from '../../../src/systems/wind/wind.js';
import { egPanoplyHit, EG_PANOPLY_IDS } from '../../../src/net/eliteGates/egPay.js';
import { rollEgSpoils, egSpoilsList, egSpoilsGold, egSpoilsDay, egSpoilsOf } from '../../../src/systems/eliteGates/egSpoils.js';

const LORDS = Object.keys(EG_LORDS);

test('EG-E THE LORDS\' NAMED LEGENDARIES (section 19): each of the thirteen lords one piece, its fixed base and name - Legendary, known, a weapon of its own template, the name over the ladder\'s, a crash record\'s door takes it; a champion none (mutants: the ladder\'s name kept; a lesser tier; a base swapped)', () => {
  assert.deepEqual(Object.keys(EG_LORD_ARMS).sort(), [...LORDS].sort(), 'every lord its piece');
  const base = (k) => templateByIndex(EG_LORD_ARMS[k].template)?.name;
  assert.deepEqual(LORDS.map((k) => [EG_LORD_ARMS[k].name, base(k)]), [
    ['The Houndfang', 'Saber'], ["The Examiner's Staff", 'Staff'], ['The Last Lesson', 'Longsword'], ['Conquest', 'War Axe'],
    ['Tithe', 'Mace'], ['Rivalry', 'Dai-katana'], ['Soulchain', 'Flail'], ['Duskwing', 'Long Bow'], ['Bloodmoon', 'Tanto'],
    ['Mirrorshard', 'Shortsword'], ["The Engine's Heart", 'Warhammer'], ['Wyrmbreath', 'Claymore'], ['The Clan-Breaker', 'Battle Axe'],
  ]);
  for (const k of LORDS) {
    for (let s = 1; s <= 6; s++) {
      const it = egLordArm(k, 20, seededRng(s * 7919 + k.length));
      assert.ok(it, k);
      assert.equal(it.name, EG_LORD_ARMS[k].name);
      assert.equal(it.templateIndex, EG_LORD_ARMS[k].template);
      assert.equal(it.group, 'Weapons');
      assert.equal(it.rarity, 'legendary', `${k}: Legendary`);
      assert.equal(it.isIdentified, true);
      assert.ok(validLootItem(JSON.parse(JSON.stringify(it))), `${k}: the crash record's door takes it`);
    }
  }
  assert.equal(egLordArm('kynreeve', 20, seededRng(1)), null, 'a champion drops none');
});

test('EG-E THE LORDS\' CARDS (section 19): each lord its own aetheric unit card by its key in BOSS_CARDS, at the gate\'s rate (200 per mille), one draw whatever it answers; a champion\'s key draws once and finds none (mutants: a lord\'s rate; a card past the tier)', () => {
  for (const k of LORDS) {
    const id = BOSS_CARDS[k];
    assert.ok(id, `${k}: its card`);
    const c = cardById(id);
    assert.equal(c.tier, 'aetheric', id);
    assert.equal(c.kind, 'unit', id);
    assert.equal(BOSS_CARD_PER_MILLE[k], 200, `${k}: the gate's rate`);
    let n = 0;
    const yes = () => { n++; return 0.1999; };
    assert.equal(bossCardRoll(k, yes)?.card, id);
    assert.equal(bossCardRoll(k, () => { n++; return 0.2; }), null);
    assert.equal(n, 2, 'one draw each');
  }
  assert.equal(new Set(LORDS.map((k) => BOSS_CARDS[k])).size, LORDS.length, 'thirteen cards, no two the same');
  let n = 0;
  assert.equal(bossCardRoll('kynreeve', () => { n++; return 0; }), null);
  assert.equal(n, 1);
});

test('EG-E A REDOUBT\'S SPOILS (section 19): gold that grows a tenth a Redoubt to three times; one Rare or Legendary piece (the Legendary 20% at Redoubt 1 to 65%); one to three magicOrBetter; the same seed the same spoils; a Valkynaz\'s twice on two seeds; a Redoubt taken again this week its gold alone (mutants: the second pass on the first\'s seed; the gold-only roll still throwing pieces; a fourth magicOrBetter)', () => {
  const at = (w, o) => rollEgSpoils(0x9e3779b9, 20, w, o);
  assert.equal(at(1).length, 1); assert.equal(at(5).length, 2, 'a Valkynaz\'s Redoubt rolls twice');
  assert.deepEqual(JSON.stringify(at(3, { lord: 'hound' })), JSON.stringify(at(3, { lord: 'hound' })), 'the same seed, the same spoils');
  const [p0, p1] = at(10, { lord: 'morvayn' });
  assert.notEqual(p0.gold, p1.gold, 'two seeds, not one');
  assert.equal(egSpoilsGold(20, 1), 4000); assert.equal(egSpoilsGold(20, 11), 8000); assert.equal(egSpoilsGold(20, 40), 12000);
  let legendary = 0, n = 0;
  for (let s = 1; s <= 300; s++) {
    const [p] = rollEgSpoils((s * 2654435761) >>> 0, 20, 1, { lord: 'hound' });
    assert.ok(p.gold >= Math.floor(4000 * 0.8) && p.gold <= Math.ceil(4000 * 1.2));
    const graded = p.pieces.filter((x) => !x.item.aetheric && x.item.name !== EG_LORD_ARMS.hound.name);
    assert.ok(graded.length >= 2 && graded.length <= 4, `one and one to three (${graded.length})`);
    if (graded[0].tier === 'legendary') legendary++;
    n++;
  }
  assert.ok(legendary / n > 0.1 && legendary / n < 0.32, `about a fifth Legendary at Redoubt 1 (${legendary / n})`);
  const gold = rollEgSpoils(77, 20, 5, { lord: 'ilthys', goldOnly: true });
  assert.equal(gold.length, 2);
  assert.ok(gold.every((p) => p.pieces.length === 0 && p.card === null && p.gems.length === 0 && p.gold > 0), 'its gold alone');
  assert.deepEqual(egSpoilsList(77, 20, 5, { goldOnly: true }).map((x) => x.kind), ['gold', 'gold']);
});

test('EG-E THE LORD\'S ARM AND CARD IN THE SPOILS (section 19): the named Legendary about 1 in 8 at its lord\'s Redoubt, the card about 1 in 5, each thrown after the pieces; a list\'s card after its pass\'s items and before its gold (mutants: the arm every time; the card before the pieces)', () => {
  let arms = 0, cards = 0;
  const N = 800;
  for (let s = 1; s <= N; s++) {
    const [p] = rollEgSpoils((s * 2246822519) >>> 0, 20, 2, { lord: 'twins' });
    if (p.pieces.some((x) => x.item.name === EG_LORD_ARMS.twins.name)) arms++;
    if (p.card) { cards++; assert.equal(p.card.card, BOSS_CARDS.twins); }
  }
  assert.ok(Math.abs(arms / N - 1 / 8) < 0.04, `about 1 in 8 (${arms / N})`);
  assert.ok(Math.abs(cards / N - 0.2) < 0.05, `about 1 in 5 (${cards / N})`);
  for (let s = 1; s <= 60; s++) {
    const seed = (s * 97) >>> 0, list = egSpoilsList(seed, 20, 2, { lord: 'twins' }), [p] = rollEgSpoils(seed, 20, 2, { lord: 'twins' });
    assert.equal(list.at(-1).kind, 'gold', 'its gold last');
    if (p.card) assert.equal(list[p.pieces.length].item.card, BOSS_CARDS.twins, 'the card right after the pieces');
    for (const x of list) if (x.kind === 'item') assert.ok(validLootItem(JSON.parse(JSON.stringify(x.item))), 'the crash record\'s door takes each');
  }
  assert.deepEqual(egSpoilsOf(egSpoilsDay('0123456789abcdef', 12)), { b: '0123456789abcdef', w: 12 });
  assert.equal(egSpoilsOf('sd:12'), null, 'never an Hour\'s');
});

test('EG-E THE PANOPLY IN THE SPOILS (section 19): a piece exactly when the Panoply\'s own draw says so (net/eliteGates/egPay.js egPanoplyHit - the stream the account service reads its pity by) or the service forced the pass; its choice one draw always taken, so a forced piece moves nothing before it; never at a Rehearsal\'s pay (mutants: the hit read off the spoils\' stream; the pity ignored; the choice\'s draw taken only on a hit)', () => {
  let agreed = 0;
  for (let s = 1; s <= 400; s++) {
    const seed = (s * 40503 + 17) >>> 0;
    for (const w of [1, 5, 16]) {
      const passes = rollEgSpoils(seed, 20, w, { lord: 'hound' });
      passes.forEach((p, k) => {
        const has = p.pieces.some((x) => typeof x.item.aetheric === 'string' && x.item.aetheric.startsWith('panoply-'));
        assert.equal(has, egPanoplyHit(seed, w, k), `seed ${seed} Redoubt ${w} pass ${k}`);
        agreed++;
      });
    }
  }
  assert.ok(agreed > 1000);
  // the pity: a pass with no piece by its draw is given one, and nothing before the piece moves
  let seed = 1;
  while (egPanoplyHit(seed, 3, 0)) seed++;
  const plain = rollEgSpoils(seed, 20, 3, { lord: 'hound' })[0], forced = rollEgSpoils(seed, 20, 3, { lord: 'hound', pity: [0] })[0];
  const panoply = forced.pieces.filter((x) => String(x.item.aetheric ?? '').startsWith('panoply-'));
  assert.equal(panoply.length, 1, 'the pity\'s piece');
  assert.equal(plain.gold, forced.gold);
  assert.deepEqual(plain.pieces.filter((x) => !x.item.aetheric).slice(0, 2).map((x) => x.item.name), forced.pieces.filter((x) => !x.item.aetheric).slice(0, 2).map((x) => x.item.name), 'the pieces before it as they were');
  assert.ok(EG_PANOPLY_IDS.includes(panoply[0].item.aetheric));
  // WHICH piece is the spoils' own draw, taken every time: the forced pieces over many seeds are many pieces, never one
  const which = new Set();
  for (let k = 1; k <= 60; k++) for (const x of rollEgSpoils((k * 2654435761) >>> 0, 20, 3, { lord: 'hound', pity: [0] })[0].pieces) if (String(x.item.aetheric ?? '').startsWith('panoply-')) which.add(x.item.aetheric);
  assert.ok(which.size >= 6, `the nine pieces by the draw (${[...which].join(', ')})`);
});
