// KG-SET (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md section 10.3 and "KG-SET"): THE NINE PAINTED INTO THE SET,
// AND THE SET'S WORDS IN THE PLAYER'S LANGUAGE. Driven: the nine cards as the record writes them - their numbers, tags,
// pictures, effects and words - and their foes dropping them; the relay's catalog holding no word and the words module
// covering the set exactly; every place a card's rules and flavor are shown - the face painter, the binder's look and
// its tiles, a card item's lines, the table panel's card title - saying them in the language chosen, and English again,
// byte for byte, once English is chosen; a face cached under one language painted again under another; the balance
// tool's decks lawful and its games played to their end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ILIAC_CARDS, ILIAC_LOCATIONS, CARD_EMBLEMS, cardById } from '../../src/net/iliac/iliacCards.js';
import { fxText, fxRefusal, deckValid } from '../../src/net/iliac/iliacHand.js';
import { cardRules, cardFlavor, cardWords, CARD_WORD_IDS } from '../../src/systems/iliac/iliacCardWords.js';
import { paintIliacCard, EMBLEM_KEYS, wrapCardText } from '../../src/render/iliacCardFaces.js';
import { cardCanvas, _clearCardFacesForTests, drawCardsPart, resetCardsPart } from '../../src/ui/card/cardBinderPage.js';
import { iliacFace } from '../../src/ui/iliacTableHud.js';
import { iliacCardLines, mintIliacCard, giveBinder } from '../../src/systems/iliac/iliacItems.js';
import { FOE_CARDS } from '../../src/systems/card/cardSources.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import { seededUnit } from '../../src/systems/iliac/iliacPatrons.js';
import { randomDeck, measureRandom, measureRegulars } from '../../tools/iliacBalance.mjs';
import * as tm from '../../src/systems/textManager.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ALL = [...ILIAC_CARDS, ...ILIAC_LOCATIONS];
const camel = (id) => id.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
const keyOf = (id, part) => `cards.iliacSet.${camel(id)}.${part}`;
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();

/** The nine as section 10.3 writes them: [name, cost, power, tier, tags, emblem, foe, rules, flavor]. */
const NINE = {
  'grizzly-bear': ['Grizzly Bear', 3, 5, 'common', ['beast'], 'bear', 'GrizzlyBear', 'End of turn: this loses 1 power.', 'It comes down the Wrothgarian pass at a charge, and it does not charge twice.'],
  'sabretooth-tiger': ['Sabretooth Tiger', 3, 4, 'common', ['beast'], 'cat', 'SabertoothTiger', 'Reveal: the strongest enemy unit here loses 1 power.', 'It goes for the biggest throat in the hall.'],
  spider: ['Spider', 2, 2, 'common', ['beast'], 'spider', 'Spider', 'Ongoing: enemy units here that cost 1 or 2 have -1 power.', 'The small walk into its web; the large walk through it.'],
  slaughterfish: ['Slaughterfish', 1, 3, 'common', ['beast', 'sea'], 'fish', 'Slaughterfish', 'End of turn: this loses 1 power.', 'Out of the water, it has one good bite in it.'],
  mummy: ['Mummy', 4, 4, 'magic', ['undead'], 'mummy', 'Mummy', 'End of turn: your weakest undead unit here gains +1 power.', 'Wrapped for the long dark, and patient in it.'],
  'frost-daedra': ['Frost Daedra', 5, 6, 'rare', ['daedra'], 'frost', 'FrostDaedra', 'Reveal: enemy units here lose 1 power.', 'Where it walks, the ale freezes in the cup.'],
  'fire-daedra': ['Fire Daedra', 5, 6, 'rare', ['daedra'], 'fire', 'FireDaedra', 'Reveal: the strongest enemy unit here loses 2 power.', 'Its blade was forged in the Deadlands, and it is burning still.'],
  archer: ['Archer', 2, 2, 'common', ['human', 'warrior'], 'bow', 'Archer', 'Reveal: the weakest enemy unit here loses 1 power.', 'One arrow, for the one who cannot dodge it.'],
  ranger: ['Ranger', 3, 3, 'magic', ['human', 'warrior'], 'bow', 'Ranger', 'Reveal: the strongest enemy beast unit here loses 2 power.', 'The wilds have one law, and the ranger keeps it.'],
};

/** A 2D context that keeps the words written on it and measures a letter 5 px wide; every other call is a no-op. */
const wordsCtx = (texts) => new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 5 });
    if (k === 'fillText') return (s) => { texts.push(String(s)); };
    return k in t ? t[k] : () => {};
  },
  set(t, k, v) { t[k] = v; return true; },
});
/** What a large face of `card` writes, in order. */
const faceWords = (card) => { const texts = []; paintIliacCard(wordsCtx(texts), card, 260, 371); return texts; };
/** A page enough for cardCanvas: canvases that keep their document and a recording context. */
const canvasDoc = () => {
  const doc = { createElement: () => ({ ownerDocument: doc, width: 0, height: 0, getContext: () => wordsCtx([]) }) };
  return doc;
};
/** The binder's own DOM, as cards8_binder drives it: elements with children, classes, a dataset and their text. */
function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, dataset: {}, title: '', value: '', type: '', disabled: false, maxLength: 0,
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    classList: { contains: (c) => classes.has(c) },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const all = (root, f) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (f(c)) out.push(c); walk(c); } }; walk(root); return out; };
/** The binder's look at `id` after a press on its tile: the words under the large card. */
function binderLook(id) {
  globalThis.document = undefined;
  resetCardsPart();
  const me = { items: [] };
  giveBinder(me);
  let root = el('div');
  const draw = () => { root = el('div'); drawCardsPart(root, draw, { el, divider: (t) => el('h4', 'px-divider', t), player: me }); };
  draw();
  all(root, (c) => c.dataset?.card === id && c.classList.contains('binder-tile'))[0].onclick();
  const look = all(root, (c) => c.classList?.contains('binder-look-text'))[0];
  const tile = all(root, (c) => c.dataset?.card === id && c.classList.contains('binder-tile'))[0];
  return { words: look.children.map((c) => c.textContent), title: tile.title };
}

test('KG-SET the nine, as the record writes them: their numbers, tags, pictures and effects, their words the effects\' own, their foes dropping them', () => {
  for (const [id, [name, cost, power, tier, tags, emblem, foe, rules, flavor]] of Object.entries(NINE)) {
    const c = cardById(id);
    assert.ok(c && c.kind === 'unit', `${id} is a unit of the set`);
    assert.deepEqual([c.name, c.cost, c.power, c.tier, [...c.tags], c.emblem], [name, cost, power, tier, tags, emblem], id);
    assert.ok(c.fx.every((f) => fxRefusal(f, 'unit') === null), `${id}: its effects are the engine's language`);
    assert.equal(fxText(c.fx, c.kind), rules, `${id}: its effects say its rules`);
    assert.deepEqual([cardRules(c), cardFlavor(c)], [rules, flavor], `${id}: its words`);
    assert.equal(FOE_CARDS[MOBILE_TYPES[foe]], id, `${foe} drops its own card`);
  }
  assert.deepEqual(CARD_EMBLEMS.slice(-8, -2) /* PIN MOVED (WITCH1): the witch and the candle joined the list last */, ['bear', 'cat', 'spider', 'fish', 'mummy', 'bow'], 'six pictures of their own');
  assert.deepEqual([...EMBLEM_KEYS], [...CARD_EMBLEMS], 'each one painted');
});

test('KG-SET the relay\'s catalog keeps no word; the words cover the set exactly, in its order', () => {
  for (const c of ALL) assert.ok(!Object.hasOwn(c, 'text') && !Object.hasOwn(c, 'flavor'), `${c.id}: its words are the display's`);
  assert.deepEqual([...CARD_WORD_IDS], ALL.map((c) => c.id), 'every card and holding has its words, and nothing else has any');
  assert.ok(Object.isFrozen(CARD_WORD_IDS));
  for (const nobody of [null, undefined, {}, { id: 'no-such-card' }, { id: 'toString' }, { id: '__proto__' }]) assert.deepEqual(cardWords(nobody), { rules: '', flavor: '' });
  assert.doesNotMatch(read('src/net/iliac/iliacCards.js'), /\btext: '|\bflavor: '/, 'no card writes its words into the relay\'s catalog');
  assert.doesNotMatch(read('src/net/iliac/iliacCards.js'), /^import /m, 'and the catalog still imports nothing - the relay carries it whole');
});

test('KG-SET a card\'s words are read when they are shown - French chosen, French said on the face, the binder, the item and the table; English again, byte for byte', () => {
  const en = Object.fromEntries(ALL.map((c) => [c.id, { rules: cardRules(c), flavor: cardFlavor(c) }]));
  const enFace = faceWords(cardById('grizzly-bear'));
  const enLines = iliacCardLines(mintIliacCard('spider'));
  const enTitle = iliacFace({ id: 'rat' }).title;
  const enLook = binderLook('mummy');
  _clearCardFacesForTests();
  const doc = canvasDoc();
  const enCanvas = cardCanvas(doc, cardById('archer'), 300);
  assert.equal(cardCanvas(doc, cardById('archer'), 300), enCanvas, 'a face painted once a language');
  try {
    const fr = Object.fromEntries(tm.parseStringTableCsv(read('locales/fr/Port_Strings.csv')));
    tm.patchLocaleTable('fr', 'Port_Strings', Object.entries(fr));
    const relaid = cardCanvas(doc, cardById('archer'), 300);
    assert.notEqual(relaid, enCanvas, 'a translation\'s table laid: the face painted again');
    assert.deepEqual(ALL.map((c) => cardRules(c)), ALL.map((c) => en[c.id].rules), 'English stands until French is chosen');
    tm.setLocale('fr');
    for (const c of ALL) {
      for (const part of ['rules', 'flavor']) assert.ok(typeof fr[keyOf(c.id, part)] === 'string' && fr[keyOf(c.id, part)].length > 0, `the French table has ${keyOf(c.id, part)}`);
      assert.equal(cardRules(c), fr[keyOf(c.id, 'rules')], `${c.id}'s rules in French`);
      assert.equal(cardFlavor(c), fr[keyOf(c.id, 'flavor')], `${c.id}'s flavor in French`);
    }
    const bear = cardById('grizzly-bear');
    const frFace = faceWords(bear);
    assert.ok(squash(frFace.join(' ')).includes(squash(fr[keyOf('grizzly-bear', 'rules')])), 'the face writes the French rules');
    assert.ok(!squash(frFace.join(' ')).includes(squash(en['grizzly-bear'].rules)), 'and not the English');
    assert.ok(frFace.includes('Grizzly Bear'), 'its name is the catalog\'s (Daggerfall\'s, shown through its own tables by a later batch)');
    assert.deepEqual(iliacCardLines(mintIliacCard('spider')).slice(1), [fr[keyOf('spider', 'rules')], fr[keyOf('spider', 'flavor')]], 'the item\'s lines');
    assert.equal(iliacFace({ id: 'rat' }).title, `Rat - ${fr[keyOf('rat', 'rules')]}`, 'the table panel\'s card title');
    const look = binderLook('mummy');
    assert.deepEqual(look.words, ['Mummy', fr[keyOf('mummy', 'rules')], fr[keyOf('mummy', 'flavor')]], 'the binder\'s look');
    assert.equal(look.title, `Mummy - ${fr[keyOf('mummy', 'rules')]}`, 'and the tile\'s title');
    const frCanvas = cardCanvas(doc, cardById('archer'), 300);
    assert.notEqual(frCanvas, relaid, 'French chosen: the face painted again');
    assert.equal(cardCanvas(doc, cardById('archer'), 300), frCanvas, 'and kept while French stands');
    tm.setLocale('en');
    assert.deepEqual(Object.fromEntries(ALL.map((c) => [c.id, { rules: cardRules(c), flavor: cardFlavor(c) }])), en, 'English again, every card');
    assert.deepEqual(faceWords(bear), enFace, 'the face, byte for byte');
    assert.deepEqual(iliacCardLines(mintIliacCard('spider')), enLines);
    assert.equal(iliacFace({ id: 'rat' }).title, enTitle);
    assert.deepEqual(binderLook('mummy'), enLook);
    assert.notEqual(cardCanvas(doc, cardById('archer'), 300), frCanvas, 'and the face painted in English again');
  } finally { tm._resetTextManagerForTests(); _clearCardFacesForTests(); }
});

test('KG-SET a no-break space is no place to break a card\'s words, and is kept - the French tables set one before every colon, and no French rules line breaks there (mutant: the words split on every white space)', () => {
  const ctx = { measureText: (t) => ({ width: [...String(t)].length * 10 }) };
  assert.deepEqual(wrapCardText(ctx, 'Continu\u00a0: vos unit\u00e9s', 90), ['Continu\u00a0:', 'vos', 'unit\u00e9s'], 'the colon stays with its word, the no-break space with them');
  assert.deepEqual(wrapCardText(ctx, 'a\u202fb c', 30), ['a\u202fb', 'c'], 'the narrow no-break space too');
  assert.deepEqual(wrapCardText(ctx, 'aaa bbb\tccc', 70), ['aaa bbb', 'ccc'], 'a tab still breaks');
  const fr = Object.fromEntries(tm.parseStringTableCsv(read('locales/fr/Port_Strings.csv')));
  const rules = ALL.map((c) => fr[keyOf(c.id, 'rules')]).filter((x) => typeof x === 'string');
  assert.ok(rules.filter((x) => /\u00a0:/.test(x)).length >= 50, 'the French rules set their no-break spaces');
  for (const text of rules) for (const w of [60, 90, 120, 180]) {
    for (const line of wrapCardText(ctx, text, w)) assert.doesNotMatch(line, /^[:;!?]/, `no line opens on a colon: ${text} at ${w}`);
  }
});

test('KG-SET the balance tool: its random decks lawful, every game played to its end and counted once', () => {
  const unit = seededUnit(13);
  for (let i = 0; i < 25; i++) assert.equal(deckValid(randomDeck(unit)), null);
  const r = measureRandom(12, 7);
  assert.equal(r.won[0] + r.won[1] + r.drawn, 12);
  assert.equal(r.by.holdings + r.by.power + r.by.draw, 12);
  assert.equal(r.by.draw, r.drawn, 'a game drawn is one decided on nothing');
  assert.deepEqual(measureRandom(12, 7), r, 'the same seed, the same numbers');
  const g = measureRegulars(1, 7);
  assert.deepEqual(Object.keys(g), ['tight', 'loose', 'bluffer']);
  for (const rows of Object.values(g)) {
    assert.equal(rows.length, 3, 'a village, a town and a city');
    for (const x of rows) assert.ok(x.games === 1 && x.won + x.drawn <= 1 && x.rate === x.won);
  }
});
