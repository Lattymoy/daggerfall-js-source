// CARDS4 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 14): THE TABLE'S PANEL AND ITS HOST. Driven: a card's
// face as the panel writes it; the panel's model at the buy-in (affordable or not, gold or a friendly game's chips), in
// play (every seat's state, the cards it may see, the pot, the buttons the law allows with their amounts) and at the
// evening's end; the log's lines; the painted panel on a fake page - its buttons hand their presses back, a press and a
// key on it never reach the game, and it goes once. Held by source: the interior host opens the table on the seat,
// takes the buy-in from the purse only off the online lane, ticks the evening under any window, and every road off the
// seat cashes it out with the slot emptied first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCard } from '../src/net/cardLaw.js';
import { SUIT_GLYPHS, cardFace, cardHudModel, eventLine, createCardTableHud } from '../src/ui/cardTableHud.js';
import { CardTableSession } from '../src/systems/cardTableSession.js';
import { fakeDoc, all, text } from './decorFakes.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
const TABLE_STAKES = { sb: 5, bb: 10 };

test('CARDS4 a card as the panel writes it', () => {
  assert.deepEqual(SUIT_GLYPHS, ['♣', '♦', '♥', '♠']);
  assert.deepEqual(['As', 'Td', '2h', 'Kc'].map((c) => cardFace(parseCard(c))), [
    { text: 'A♠', red: false }, { text: '10♦', red: true }, { text: '2♥', red: true }, { text: 'K♣', red: false },
  ]);
  assert.deepEqual(cardFace(-1), { text: '', red: false, back: true }, 'face down');
});

test('CARDS4 the panel at the buy-in: gold or chips, affordable or not', () => {
  const gold = cardHudModel({ phase: 'buyin', buyIn: { min: 200, max: 1000 }, stakes: TABLE_STAKES });
  assert.equal(gold.title, 'Card table - 5/10 gold');
  assert.equal(gold.note, null);
  assert.deepEqual(gold.buyIn, { min: 200, max: 1000, value: 400 }, 'forty big blinds to start');
  assert.deepEqual(gold.actions, [{ id: 'deal', label: 'Deal me in', enabled: true }, { id: 'stand', label: 'Stand up', enabled: true }]);
  assert.equal(cardHudModel({ phase: 'buyin', buyIn: { min: 200, max: 250 }, stakes: TABLE_STAKES }).buyIn.value, 250, 'never past the purse');
  const poor = cardHudModel({ phase: 'buyin', buyIn: null, stakes: TABLE_STAKES });
  assert.equal(poor.message, 'You need 200 gold to sit in at these stakes.');
  assert.equal(poor.actions[0].enabled, false);
  const friendly = cardHudModel({ phase: 'buyin', buyIn: { min: 200, max: 1000 }, stakes: TABLE_STAKES, friendly: true });
  assert.equal(friendly.title, 'Card table - 5/10 chips');
  assert.match(friendly.note, /online, no gold changes hands/);
});

test('CARDS4 the panel in play: the seats, the cards each may see, the pot, the buttons the law allows', () => {
  const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: [{ id: 'patron:0', name: 'Ana', temper: 'tight', stack: 500 }, { id: 'patron:1', name: 'Bors', temper: 'loose', stack: 500 }], stakes: TABLE_STAKES, rand32: seeded(4), now: 0 });
  s.tick(0);
  // Seats in table order: you (button, first hand), Ana (small blind), Bors (big blind) - you are first to act.
  const m = cardHudModel({ phase: 'playing', view: s.view(), legal: s.legal(), stakes: TABLE_STAKES });
  assert.deepEqual(m.seats.map((x) => [x.name, x.you, x.button, x.stack, x.bet, x.state, x.cards.length]), [
    ['You', true, true, 500, 0, 'to act', 2], ['Ana', false, false, 495, 5, '', 2], ['Bors', false, false, 490, 10, '', 2],
  ]);
  assert.ok(m.seats[0].cards.every((c) => !c.back), 'your own cards face up');
  assert.ok(m.seats[1].cards.every((c) => c.back), 'the others\' face down');
  assert.equal(m.pot, 15);
  assert.deepEqual(m.board, []);
  assert.deepEqual(m.actions, [
    { id: 'fold', label: 'Fold', enabled: true }, { id: 'call', label: 'Call 10', enabled: true },
    { id: 'raise', label: 'Raise to', enabled: true, min: 20, max: 500, step: 5 }, { id: 'allin', label: 'All in (500)', enabled: true, to: 500 },
    { id: 'stand', label: 'Stand up', enabled: true },
  ]);
  assert.equal(m.message, 'Your turn.');
  // Not your turn: the buttons are only the stand, and the panel names who it waits on.
  s.playerAct({ type: 'call' }, 10);
  const w = cardHudModel({ phase: 'playing', view: s.view(), legal: s.legal(), stakes: TABLE_STAKES });
  assert.deepEqual(w.actions.map((a) => a.id), ['stand']);
  assert.equal(w.message, 'Waiting on Ana...');
  // The evening's end.
  assert.equal(cardHudModel({ phase: 'over', view: s.view(), stakes: TABLE_STAKES, why: 'broke' }).message, 'You are out of chips.');
  assert.equal(cardHudModel({ phase: 'over', view: s.view(), stakes: TABLE_STAKES, why: 'empty' }).actions.at(-1).label, 'Leave the table');
});

test('CARDS4 the log\'s lines', () => {
  const names = ['You', 'Ana', 'Bors'];
  assert.deepEqual([
    { t: 'hand', hand: 3, button: 1 }, { t: 'act', seat: 2, type: 'raise', to: 40, paid: 30 }, { t: 'act', seat: 0, type: 'call', paid: 30 },
    { t: 'act', seat: 1, type: 'fold' }, { t: 'act', seat: 0, type: 'check' }, { t: 'street', street: 'turn' },
    { t: 'showdown', seats: [0, 2], result: { shown: false, pots: [{ amount: 90, eligible: [1], winners: [1] }], payouts: [0, 90] } }, { t: 'showdown', seats: [0, 2], result: { shown: true, pots: [{ amount: 90, eligible: [0, 1], winners: [0, 1] }], payouts: [45, 45], hands: {} } },
    { t: 'leave', name: 'Bors' }, { t: 'over', why: 'empty' },
  ].map((e) => eventLine(e, names, 0)), [
    'Hand 3: Ana deals.', 'Bors raises to 40.', 'You call 30.', 'Ana folds.', 'You check.', 'The turn.',
    'Bors takes the pot.', 'You and Bors split the pot.', 'Bors is broke and leaves for the night.', 'The table has emptied.',
  ]);   // AUDIT CARDS-2 L10: the player in the second person
});

test('CARDS4 the painted panel: presses handed back, never reaching the game; gone once', () => {
  const doc = fakeDoc();
  const pressed = [];
  const hud = createCardTableHud({ onPress: (id, v) => pressed.push([id, v]), doc });
  assert.equal(doc.head.children.filter((c) => c.id === 'dfcards-style').length, 1, 'the style, once');
  hud.render(cardHudModel({ phase: 'buyin', buyIn: { min: 200, max: 1000 }, stakes: TABLE_STAKES }));
  const buttons = all(hud.root, '').filter((n) => n.tag === 'button');
  assert.deepEqual(buttons.map((b) => b.textContent), ['Deal me in', 'Stand up']);
  buttons[0].fire('click');
  buttons[1].fire('click');
  assert.deepEqual(pressed, [['deal', 400], ['stand', undefined]]);
  // A press on the panel stops there (a key only when it is the slider's - AUDIT CARDS-2 L8, auditcards2_host).
  for (const t of ['pointerdown', 'mousedown', 'click', 'wheel']) {
    let stopped = false;
    hud.root.fire(t, { stopPropagation() { stopped = true; } });
    assert.ok(stopped, `${t} stops at the panel`);
  }
  assert.match(text(hud.root), /Buy in for 200-1000 gold/);
  hud.destroy();
  assert.equal(hud.root.removed, true);
  hud.render(cardHudModel({ phase: 'buyin', buyIn: null, stakes: TABLE_STAKES }));
  assert.match(text(hud.root), /Buy in for 200-1000/, 'a destroyed panel paints nothing more');
});

test('CARDS4 the interior host: the table on the seat, the purse only off the online lane, the evening under any window, the cash-out on every road off the seat', () => {
  const src = read('src/scenes/worldModes.js');
  const has = (s, why) => assert.ok(src.includes(s), why ?? s);
  has("    say('You take a seat at the card table.');\n    if (cardSeat.free.length || host.cardOnline?.ok?.()) openCardGame(cardSeat.free.length + 1);", 'sitting opens the table - sized to the free chairs; online the relay\'s table needs none');
  has('    closeCardGame({ cashOut });   // CARDS4: every road off the seat cashes the table out', 'standing closes it - press, step, swing, Escape, a hit, the forced exit and the door all stand through standFromCardTable');
  has('    const friendly = !!host.realmAct || isOnlinePage();', 'a realm character, or any online page, plays a friendly game');
  has('    const buyIn = buyInRange(friendly ? FRIENDLY_CHIPS_BB * stakes.bb : goldAmount(playerEntity), stakes);');
  has("      if (!game.friendly && amount > goldAmount(playerEntity)) { paintCardGame(); return; }", 'the buy-in from the purse, never more than it holds, never online');
  has("      if (!game.friendly) deductGold(playerEntity, amount);");
  has("    else if (chips > 0 && !g.friendly) { addGold(playerEntity, chips); say(`You leave the table with ${chips} gold.`); }", 'the chips back into gold, never online, never on a load');
  has("    if (mode === 'interior') cardGameFrame(performance.now());   // CARDS4", 'the patrons play on under any window');
  has('    const stakes = stakesFor(interiorBuilding?.quality ?? 10);', 'the tavern\'s quality sets the stakes');
  has("    if (game !== cardGame) return;   // a press from a panel already gone");
  // THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD: the game slot is null before the session leaves and the panel goes.
  const close = src.slice(src.indexOf('  function closeCardGame({ cashOut = true } = {}) {'), src.indexOf('  function closeCardGame({ cashOut = true } = {}) {') + 1600);
  assert.ok(close.indexOf('cardGame = null;') < close.indexOf('g.session.leave(') && close.indexOf('cardGame = null;') < close.indexOf('g.hud?.destroy();'));
  has('  const cardRand32 = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0];', 'the table\'s own source');
  // Every road that drops the seat goes through standFromCardTable, never a bare clear that would keep the gold.
  assert.deepEqual(src.match(/^\s*cardSeat = null;/gm)?.length, 1, 'one bare clear - the stand\'s own; the door, a new room and the forced exit stand up through it');
});
