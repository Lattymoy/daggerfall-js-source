// CARDS8 (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md sections 6.2 and 8): THE CATALOG OF ILIAC HAND. Driven:
// every card's shape (the one the face painter and the binder read), its ids, its tier against the loot's, its tags and
// its emblem against the painter's list (every emblem drawn by some card), the Princes legendary or higher and ruling
// the whole board, every effect record one the engine reads and every card's text EXACTLY what its records do, the
// holdings each with a rule, the set's count by kind and tier (so a card added is a card meant), the order of things
// the game knows (a Lich outranks an Orc), and the starter deck clean.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ILIAC_CARDS, ILIAC_LOCATIONS, ILIAC_TIERS, ILIAC_TAGS, CARD_EMBLEMS, STARTER_DECK, cardById } from '../src/net/iliacCards.js';
import { deckValid, fxText, fxRefusal, ILIAC_VERBS, ILIAC_TRIGGERS, ILIAC_TARGETS, ILIAC_PICKS, ILIAC_TURNS } from '../src/net/iliacHand.js';
import { RARITY_ORDER } from '../src/systems/lootRarity.js';

const ALL = [...ILIAC_CARDS, ...ILIAC_LOCATIONS];
const KEYS = ['id', 'name', 'kind', 'cost', 'power', 'tier', 'tags', 'emblem', 'fx', 'text', 'flavor'].sort();
const rank = (tier) => ILIAC_TIERS.indexOf(tier);

test('CARDS8 the tiers are the loot\'s, and the painter\'s emblems are the list he was given', () => {
  assert.deepEqual(ILIAC_TIERS, RARITY_ORDER);
  assert.deepEqual(CARD_EMBLEMS, ['beast', 'insect', 'undead', 'ghost', 'vampire', 'lich', 'were', 'orc', 'giant', 'centaur',
    'harpy', 'nymph', 'dreugh', 'daedra', 'atronach', 'dragon', 'knight', 'mage', 'thief', 'assassin', 'priest', 'warrior',
    'noble', 'prince', 'artifact', 'fire', 'frost', 'shock', 'heal', 'shadow', 'city', 'desert', 'fortress', 'dungeon', 'sea']);
  for (const list of [ILIAC_TIERS, ILIAC_TAGS, CARD_EMBLEMS, ILIAC_CARDS, ILIAC_LOCATIONS, STARTER_DECK]) assert.ok(Object.isFrozen(list));
  const used = new Set(ALL.map((c) => c.emblem));
  assert.deepEqual(CARD_EMBLEMS.filter((e) => !used.has(e)), [], 'every emblem the painter draws is some card\'s');
});

test('CARDS8 every card\'s shape: its keys, a lowercase-hyphen id unique across the set, its kind, cost, power, tier, tags, emblem', () => {
  const seen = new Set();
  for (const c of ALL) {
    assert.deepEqual(Object.keys(c).sort(), KEYS, c.id);
    assert.match(c.id, /^[a-z]+(-[a-z]+)*$/, c.id);
    assert.ok(!seen.has(c.id), `${c.id} twice`);
    seen.add(c.id);
    assert.equal(cardById(c.id), c);
    assert.ok(typeof c.name === 'string' && c.name.length > 0 && c.name.length <= 28, c.id);
    assert.ok(ILIAC_TIERS.includes(c.tier), `${c.id}: ${c.tier}`);
    assert.ok(CARD_EMBLEMS.includes(c.emblem), `${c.id}: ${c.emblem}`);
    assert.ok(Array.isArray(c.tags) && c.tags.every((t) => ILIAC_TAGS.includes(t)), `${c.id}: ${c.tags}`);
    assert.equal(new Set(c.tags).size, c.tags.length, c.id);
    assert.ok(typeof c.flavor === 'string' && c.flavor.length > 0 && c.flavor.length <= 80, `${c.id}'s flavour`);
    assert.ok(Object.isFrozen(c) && Object.isFrozen(c.fx) && Object.isFrozen(c.tags) && c.fx.every(Object.isFrozen), `${c.id} frozen`);
    if (c.kind === 'unit' || c.kind === 'prince') assert.ok(Number.isInteger(c.power) && c.power >= 1, `${c.id} stands power`);
    else assert.equal(c.power, 0, `${c.id}: a ${c.kind} has no power`);
  }
  for (const c of ILIAC_CARDS) {
    assert.ok(['unit', 'spell', 'prince'].includes(c.kind), c.id);
    // Every card is playable in a game without a gift of magicka: no cost past the last turn's.
    assert.ok(Number.isInteger(c.cost) && c.cost >= 1 && c.cost <= ILIAC_TURNS, `${c.id} costs ${c.cost}`);
  }
  for (const c of ILIAC_LOCATIONS) {
    assert.equal(c.kind, 'location', c.id);
    assert.equal(c.cost, 0, c.id);
    assert.equal(c.tier, 'common', c.id);
  }
  assert.equal(cardById('nobody'), null);
  assert.equal(cardById(undefined), null);
});

test('CARDS8 a Prince is legendary or higher and rules the whole board; an artifact is a spell of the artifact tier', () => {
  const princes = ILIAC_CARDS.filter((c) => c.kind === 'prince');
  assert.ok(princes.length >= 9);
  for (const c of princes) {
    assert.ok(rank(c.tier) >= rank('legendary'), `${c.id}: ${c.tier}`);
    assert.ok(c.tags.includes('prince') && c.tags.includes('daedra'), c.id);
    assert.equal(c.emblem, 'prince', c.id);
    const rule = c.fx.filter((f) => f.on === 'ongoing');
    assert.ok(rule.length >= 1, `${c.id} has an ongoing rule`);
    assert.ok(rule.every((f) => f.to === undefined || f.to.startsWith('all.')), `${c.id}'s rule is the whole board's`);
  }
  assert.deepEqual(ALL.filter((c) => c.tags.includes('prince')).map((c) => c.kind).filter((k) => k !== 'prince'), []);
  for (const c of ILIAC_CARDS.filter((x) => x.tier === 'artifact')) {
    assert.equal(c.kind, 'spell', c.id);
    assert.equal(c.emblem, 'artifact', c.id);
    assert.ok(c.tags.includes('artifact'), c.id);
  }
  assert.deepEqual(ILIAC_CARDS.filter((c) => c.tags.includes('artifact') && c.tier !== 'artifact').map((c) => c.id), []);
});

test('CARDS8 every effect record is the engine\'s language, and every card says exactly what its records do', () => {
  for (const c of ALL) {
    assert.ok(Array.isArray(c.fx) && c.fx.length >= 1, `${c.id} has a rule`);
    for (const f of c.fx) {
      assert.equal(fxRefusal(f, c.kind), null, `${c.id}: ${JSON.stringify(f)}`);
      assert.ok(ILIAC_VERBS.includes(f.do), `${c.id}: ${f.do}`);
    }
    assert.equal(c.text, fxText(c.fx, c.kind), c.id);
    assert.ok(c.text.length > 0 && c.text.length <= 120, `${c.id}'s text is a short line: ${c.text}`);
    assert.ok(!c.text.includes('?'), `${c.id}'s text names a card the catalog has`);
  }
  // A spell acts when revealed and leaves; a holding's rule is aimed at both its sides.
  for (const c of ILIAC_CARDS.filter((x) => x.kind === 'spell')) assert.ok(c.fx.every((f) => f.on === 'reveal'), c.id);
  // The catalog speaks the whole language: every trigger, verb, target and pick is some card's.
  const fx = ALL.flatMap((c) => c.fx);
  assert.deepEqual(ILIAC_TRIGGERS.filter((t) => !fx.some((f) => f.on === t)), []);
  assert.deepEqual(ILIAC_VERBS.filter((v) => !fx.some((f) => f.do === v)), []);
  assert.deepEqual(ILIAC_TARGETS.filter((t) => !fx.some((f) => f.to === t)), []);
  assert.deepEqual(ILIAC_PICKS.filter((p) => !fx.some((f) => f.pick === p)), []);
});

test('CARDS8 the holdings: the Iliac Bay\'s places, each with its own rule', () => {
  assert.deepEqual(ILIAC_LOCATIONS.map((c) => [c.id, c.text]), [
    ['daggerfall', 'Knight units here have +2 power.'],
    ['sentinel', 'Units here that cost 1 or 2 have +1 power.'],
    ['wayrest', 'Each side holds only 3 cards here.'],
    ['shornhelm', 'End of turn: the weakest unit on each side here loses 1 power.'],
    ['orsinium', 'Orc units here have +2 power.'],
    ['betony', 'After a card is revealed here, its owner draws a card.'],
    ['evermor', 'After a card is revealed here, its owner gains +1 magicka next turn.'],
    ['castle-daggerfall', 'Spells cannot be played here.'],
    ['privateers-hold', 'Cards here are played face down and unveiled when the game ends. Spells cannot be played here.'],
    ['mages-guild-hall', 'Spells played here cost 1 less.'],
    ['vampire-crypt', 'Undead units here have +2 power.'],
  ]);
  assert.ok(ILIAC_LOCATIONS.length >= 8 && ILIAC_LOCATIONS.length <= 12);
});

test('CARDS8 the first set, counted by kind and tier - a card added is a card meant', () => {
  const by = (key) => ILIAC_CARDS.reduce((m, c) => ({ ...m, [c[key]]: (m[c[key]] ?? 0) + 1 }), {});
  assert.deepEqual(by('kind'), { unit: 57, spell: 14, prince: 11 });
  assert.deepEqual(by('tier'), { common: 26, magic: 23, rare: 13, legendary: 12, aetheric: 2, artifact: 6 });
  assert.equal(ILIAC_CARDS.length, 82);
});

test('CARDS8 power and cost follow what the thing is in the game', () => {
  const p = (id) => cardById(id).power, c = (id) => cardById(id).cost;
  assert.equal(c('rat'), 1);
  assert.ok(p('lich') > p('orc') && c('lich') > c('orc'), 'a Lich outranks an Orc');
  assert.ok(p('ancient-lich') > p('lich'));
  assert.ok(p('ancient-vampire') > p('vampire'));
  assert.ok(p('orc-warlord') > p('orc-sergeant') && p('orc-sergeant') > p('orc'));
  assert.ok(p('iron-atronach') > p('flesh-atronach'));
  assert.ok(p('giant') === Math.max(...ILIAC_CARDS.map((x) => x.power)), 'nothing stands taller than a giant');
  assert.deepEqual(ILIAC_CARDS.filter((x) => x.cost === 1 && x.kind !== 'spell').map((x) => x.id).sort(),
    ['giant-bat', 'imp', 'mages-guild-apprentice', 'rat', 'thieves-guild-filcher']);
  // The legendary-or-higher cards: the Princes, the artifacts, and the Bay's few legends.
  assert.deepEqual(ILIAC_CARDS.filter((x) => rank(x.tier) >= rank('legendary') && x.kind === 'unit').map((x) => x.id), ['ancient-vampire', 'ancient-lich', 'king-gothryd']);
});

test('CARDS8 the starter deck: thirty, clean by the deck\'s law, common and magic alone', () => {
  assert.equal(STARTER_DECK.length, 30);
  assert.equal(deckValid(STARTER_DECK), null);
  assert.deepEqual(STARTER_DECK.filter((id) => !['common', 'magic'].includes(cardById(id).tier)), []);
  assert.deepEqual(STARTER_DECK.filter((id) => cardById(id).kind === 'location'), []);
  // Playable from the first turn: a one-cost card or more in it, nothing past four.
  assert.ok(STARTER_DECK.filter((id) => cardById(id).cost === 1).length >= 6);
  assert.ok(STARTER_DECK.every((id) => cardById(id).cost <= 4));
});
