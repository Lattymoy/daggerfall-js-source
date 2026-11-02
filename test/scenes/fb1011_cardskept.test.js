// CARDS-KEPT and CARDS-PANEL (2026-10-11, bible/11-Multiplayer/Tavern-Cards.md section 36). A live report: "You have too
// many stakes waiting to be settled" at the FIRST gold table, on every character. The stakes book (net/card/cardStakes.js)
// reads and writes JSON by `get`/`set`; the host handed it the device's bare Storage (`getItem`/`setItem`), so every
// write threw into the book's own catch, the stake read back unkept, and every buy-in was refused as 'cards-kept-full'.
// Every suite built the book over a `{get, set}` Map - the shape no host minted. Driven here: the HOST'S OWN expression,
// lifted from world.js and run over the real spoilsStore and a device Storage, stakes, keeps and lets go; a bare Storage
// is the report, refused. And the panel's enhancements: the line's tone, the buy-in's and the raise's quick picks
// (a press sets the slider, never deals or raises), the slider's unit, the fold that puts the table away, the log a line
// a sentence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCardStakes, CARD_STAKES_KEY } from '../../src/net/card/cardStakes.js';
import { spoilsStore } from '../../src/scenes/spoilsPool.js';
import { cardHudModel, createCardTableHud, buyInPicks, raisePicks } from '../../src/ui/card/cardTableHud.js';
import { CardTableSession } from '../../src/systems/card/cardTableSession.js';
import { fakeDoc, all, text } from '../decorFakes.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const STAKES = { sb: 5, bb: 10 };

/** A device's Storage, as localStorage is: strings in, strings out. */
const deviceStorage = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
};
/** The book over `storage`, its door and the record's act answering every stake. */
const bookOver = (storage) => {
  const purse = { gold: 2000 };
  const book = createCardStakes({
    door: { stake: async (q) => ({ ok: true, data: { stake: `order-${q.rid}`, id: `id-${q.rid}` } }), cashout: async () => ({ ok: false }) },
    realm: { act: async ({ reserve, call }) => { reserve?.(); return call({ id: 'R' }); } },
    wallet: () => ({ gold: () => purse.gold, pay: (n) => { purse.gold -= n; return () => { purse.gold += n; }; }, bank: () => {} }),
    character: () => 'CH1', region: () => 17, storage, now: () => 1_000_000, rand: () => 0.5,
  });
  return { book, purse };
};
/** The store world.js hands the stakes book - its own text, lifted and run over `_spoilsStore`. */
const hostLine = () => read('src/scenes/world.js').split('\n').find((l) => l.includes('? createCardStakes({ door: accountCards('));
const hostStore = (spoils) => {
  const line = hostLine();
  assert.ok(line, 'the host builds the book');
  const m = /\}\), storage: (.+?),\s*$/.exec(line);   // the book's own storage, after its door's
  assert.ok(m, `the book's storage named: ${line}`);
  return new Function('_spoilsStore', 'appStorage', `return (${m[1]});`)(spoils, () => spoils.__device);
};

test('CARDS-KEPT the host\'s own store: a buy-in stakes, is kept on the device as JSON, and the order lands on it', async () => {
  const device = deviceStorage();
  const spoils = spoilsStore(device);
  spoils.__device = device;
  const { book, purse } = bookOver(hostStore(spoils));
  const r = await book.stake({ room: 'interior:m1.2', table: 1, bb: 10, amount: 1000 });
  assert.equal(r.ok, true, `staked - was ${JSON.stringify(r)}`);
  assert.equal(purse.gold, 1000, 'held out of the purse');
  const kept = JSON.parse(device.m.get(CARD_STAKES_KEY));
  assert.deepEqual(kept.map((x) => [x.room, x.table, x.amount, x.order, x.c]), [['interior:m1.2', 1, 1000, r.stake, 'CH1']], 'on the device, the order with it');
  book.seated(r.id);
  assert.deepEqual(book.owed(), [{ room: 'interior:m1.2', amount: 1000, at: 1_000_000 }], 'sat: owed at its room');
  // a second table, a second stake - never "too many"
  assert.equal((await book.stake({ room: 'interior:m9.4', table: 1, bb: 10, amount: 200 })).ok, true);
});

test('CARDS-KEPT the report: a bare Storage handed to the book refuses the first stake - and the host no longer hands one', async () => {
  const device = deviceStorage();
  const { book, purse } = bookOver(device);
  assert.equal((await book.stake({ room: 'interior:m1.2', table: 1, bb: 10, amount: 1000 })).error, 'cards-kept-full', 'every write threw: the first stake read back unkept');
  assert.equal(purse.gold, 2000, 'and nothing was taken');
  assert.equal(device.m.size, 0);
  assert.ok(!/\}\), storage: appStorage\(\),\s*$/.test(hostLine()), 'the book is not handed the bare Storage');
  // a storage that refuses (a private window, a full quota): the spoils' memory keeps the stake for the session
  const refusing = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const spoils = spoilsStore(refusing);
  spoils.__device = refusing;
  assert.equal((await bookOver(hostStore(spoils)).book.stake({ room: 'interior:m1.2', table: 1, bb: 10, amount: 300 })).ok, true, 'kept in memory, staked');
});

test('CARDS-PANEL the quick picks: the buy-in\'s floor and ceiling; the raise\'s half pot and pot on the step, inside the law', () => {
  assert.deepEqual(buyInPicks({ min: 200, max: 1000 }), [{ label: 'Min', value: 200 }, { label: 'Max', value: 1000 }]);
  assert.deepEqual(buyInPicks({ min: 200, max: 200 }), [], 'one amount, no pick');
  assert.deepEqual(buyInPicks(null), []);
  // facing 40 with 10 in (call 30), 55 in the pot, step 5: the pot raise is 40 + 85 = 125, the half 40 + 42 = 82 -> 80
  assert.deepEqual(raisePicks({ min: 70, max: 500 }, 40, 30, 55, 5), [{ label: '½ pot', to: 80 }, { label: 'Pot', to: 125 }]);
  // an opening bet (nothing faced): the pot and its half
  assert.deepEqual(raisePicks({ min: 10, max: 900 }, 0, 0, 120, 5), [{ label: '½ pot', to: 60 }, { label: 'Pot', to: 120 }]);
  // at or past the ceiling is All in's; at the floor is where the slider starts; one per amount
  assert.deepEqual(raisePicks({ min: 70, max: 100 }, 40, 30, 55, 5), [{ label: '½ pot', to: 80 }], 'the pot is past the stack - All in says it');
  assert.deepEqual(raisePicks({ min: 120, max: 500 }, 40, 30, 55, 5), [{ label: 'Pot', to: 125 }], 'the half is under the floor');
  assert.deepEqual(raisePicks({ min: 20, max: 60 }, 0, 0, 40, 20), [{ label: 'Pot', to: 40 }], 'the half snaps to the floor: dropped');
});

test('CARDS-PANEL the line\'s tone: a refusal and a thin purse warn, a stake asked waits, your turn shows', () => {
  const base = { phase: 'buyin', buyIn: { min: 200, max: 1000 }, stakes: STAKES, gold: true };
  assert.equal(cardHudModel(base).tone, null);
  assert.equal(cardHudModel({ ...base, refused: 'The realm said no.' }).tone, 'warn');
  assert.equal(cardHudModel({ ...base, buyIn: null }).tone, 'warn');
  assert.equal(cardHudModel({ ...base, staking: true, refused: 'x' }).tone, 'wait', 'asking again: the wait, not the old refusal');
  assert.equal(cardHudModel(base).unit, 'gold');
  assert.equal(cardHudModel({ ...base, friendly: true }).unit, 'chips');
  const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: [{ id: 'p0', name: 'Ana', temper: 'tight', stack: 500 }, { id: 'p1', name: 'Bors', temper: 'loose', stack: 500 }], stakes: STAKES, rand32: (() => { let x = 4; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; })(), now: 0 });
  s.tick(0);
  assert.equal(cardHudModel({ phase: 'playing', view: s.view(), legal: s.legal(), stakes: STAKES }).tone, 'turn');
  assert.equal(cardHudModel({ phase: 'playing', view: s.view(), legal: null, stakes: STAKES, online: { waiting: false, clock: 0, error: 'busy' } }).tone, 'warn');
  assert.equal(cardHudModel({ phase: 'playing', view: s.view(), legal: null, stakes: STAKES }).tone, null);
});

test('CARDS-PANEL the painted panel: a pick sets the slider and its words, the deal carries it; the fold keeps the buttons; the log a line a sentence', () => {
  const doc = fakeDoc();
  const pressed = [];
  const hud = createCardTableHud({ onPress: (id, v) => pressed.push([id, v]), doc });
  hud.render(cardHudModel({ phase: 'buyin', buyIn: { min: 200, max: 1000 }, stakes: STAKES, gold: true, refused: 'The realm said no.' }));
  const msg = all(hud.root, 'msg')[0];
  assert.equal(msg.className, 'msg warn');
  assert.equal(all(hud.root, 'amt')[0].textContent, '400 gold', 'the slider\'s amount, its unit');
  const picks = all(hud.root, 'pick');
  assert.deepEqual(picks.map((b) => b.textContent), ['Min', 'Max']);
  picks[1].fire('click');
  assert.deepEqual(pressed, [], 'a pick deals nothing');
  assert.equal(all(hud.root, 'amt')[0].textContent, '1000 gold');
  const deal = all(hud.root, '').find((n) => n.tag === 'button' && n.textContent === 'Deal me in');
  assert.equal(deal.dataset.kind, 'primary');
  deal.fire('click');
  assert.deepEqual(pressed, [['deal', 1000]], 'the deal carries the picked stake');
  // the fold: the table put away and back, the panel's own across repaints
  const fold = all(hud.root, 'fold')[0];
  assert.equal(fold.getAttribute('aria-expanded'), 'true');
  fold.fire('click');
  assert.equal(hud.root.className, 'dfcards collapsed');
  hud.render(cardHudModel({ phase: 'buyin', buyIn: { min: 200, max: 1000 }, stakes: STAKES, gold: true, staking: true }));
  assert.equal(hud.root.className, 'dfcards collapsed', 'kept across a repaint');
  assert.equal(all(hud.root, 'fold')[0].getAttribute('aria-expanded'), 'false');
  assert.equal(all(hud.root, 'msg')[0].className, 'msg wait');
  all(hud.root, 'fold')[0].fire('keydown', { key: 'Enter' });
  assert.equal(hud.root.className, 'dfcards');
  // in play: the raise's picks set its slider and its button's words; the raise carries it
  const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: [{ id: 'p0', name: 'Ana', temper: 'tight', stack: 500 }, { id: 'p1', name: 'Bors', temper: 'loose', stack: 500 }], stakes: STAKES, rand32: (() => { let x = 4; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; })(), now: 0 });
  s.tick(0);
  hud.render(cardHudModel({ phase: 'playing', view: s.view(), legal: s.legal(), stakes: STAKES, log: ['You sit down.', 'Hand 1: you deal.'] }));
  const pot = all(hud.root, 'pick').find((b) => b.textContent === 'Pot');
  pot.fire('click');
  const raise = all(hud.root, '').find((n) => n.tag === 'button' && n.textContent.startsWith('Raise to'));
  assert.equal(raise.textContent, 'Raise to 35');
  raise.fire('click');
  assert.deepEqual(pressed.at(-1), ['raise', 35]);
  assert.equal(all(hud.root, 'msg')[0].className, 'msg turn');
  const log = all(hud.root, 'log')[0];
  assert.deepEqual(log.children.map((n) => n.textContent), ['You sit down.', 'Hand 1: you deal.'], 'a line a sentence, the newest last');
  assert.match(text(hud.root), /Pot 15/);
  hud.destroy();
});
