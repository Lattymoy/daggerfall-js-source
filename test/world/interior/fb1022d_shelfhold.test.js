// SHELF-HOLD (FIELD BUGS 2026-10-22d, bible/01-Overview/bugs/Field-Bugs-2026-10-22d.md): A SHOP'S SHELF SAYS ONLY WHAT
// THE RECORD BACKS. A private report: a piece sold to a shop, the game closed before it saved, and on the next join the
// piece was in the pack again AND on the shop's shelf for gold - and the reverse, a piece bought and the game closed,
// took it off the shelf for nothing. The shelf's word reached the relay (the window's close, the seat's memory, the
// farewell as the page hid) while the record waited for a checkpoint the close cut off.
//
// Executed over the real doors (world/interior/interiorShared.js, the ledger in shelfHold.js) on a bare context: every
// word the room can hear of a shelf - the window's open and close (the act), the seat's memory (and so the farewell), a
// refused act's heal - is read after each step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT: the host WHOLE
import {
  mintInteriorShared, interiorLocationKey, composeInteriorShared, interiorActionRecords, interiorLootOpen, interiorLootFrame,
  interiorLootLeave, interiorShelfDealt,
} from '../../../src/world/interior/interiorShared.js';
import { createShelfHold, SHELF_HOLD_RETRY_MS } from '../../../src/world/interior/shelfHold.js';
import { checkpointLanded } from '../../../src/systems/online/onlineCheckpoint.js';
import * as homes from '../../../src/systems/online/onlineHomes.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const KEY = interiorLocationKey(187853213, 4);
const settle = () => new Promise((r) => { setImmediate(r); });

/** A promise held open: `ok()` lands it, `no()` refuses it - and one never answered is a page killed before its put. */
function deferred() {
  let ok, no;
  const p = new Promise((res) => { ok = () => res({ ok: true, seq: 9 }); no = () => res({ ok: false, error: 'offline' }); });
  return { p, ok, no };
}

/** A shop: one shelf of the merchant's own stock, a bag with the host's wiring and a checkpoint the test answers. */
function shop({ checkpoint = undefined } = {}) {
  const dagger = { name: 'Dagger', templateIndex: 1, value: 30 };
  const arrows = { name: 'Arrow', templateIndex: 131, value: 1, stackCount: 5 };
  const ctx = {
    shelves: [{ items: [dagger, arrows], stockedDate: 12 }, { items: [{ name: 'Mace', templateIndex: 5 }], stockedDate: 12 }],
    containers: [],
    actions: { collectSaveData: () => [], restoreSaveData() {}, applyRemote: () => 0 },
  };
  const sent = [];
  const asked = [];
  let claimed = 0;
  let clock = 1000;
  const net = {
    selfId: () => null, seat: () => null, now: () => clock, wallNow: () => null, say() {}, entity: () => ({ items: [] }), carried: () => null,
    send: (d) => { sent.push(d); return true; },
    claimed: () => { claimed++; },
    ...(checkpoint === undefined ? {} : { checkpoint: () => { asked.push(clock); return checkpoint(); } }),
  };
  const bag = mintInteriorShared(KEY, { net });
  return {
    ctx, bag, sent, asked, dagger, arrows, shelf: ctx.shelves[0],
    get claimed() { return claimed; },
    tick: (ms) => { clock += ms; },
    now: () => clock,
    /** The words the room can hear of shelf 0 right now: the memory's, the heal's - names with their counts. */
    memory: () => said(composeInteriorShared(ctx, bag).world.loot),
    heal: () => said(interiorActionRecords(ctx, ['shelf:0'], { locationKey: bag.locationKey, tooBig: bag.tooBig, home: bag.home, room: bag.room, hold: bag.hold }).l),
    lastSent: () => said(sent.at(-1)?.l ?? []),
  };
}
const said = (loot) => {
  const rec = (loot ?? []).find((r) => r.k === 'shelf:0');
  return rec ? rec.r.map((it) => `${it.name}${it.stackCount > 1 ? ` x${it.stackCount}` : ''}`) : null;
};
const win = () => ({ done: false });

test('SHELF-HOLD, THE REPORT: a piece sold and the game closed before its checkpoint landed - the room never hears it, on the window\'s close, in the seat\'s memory (the farewell) or in a heal; the checkpoint is asked AT the deal', () => {
  const answers = deferred();   // never answered: the page is gone before the put lands
  const s = shop({ checkpoint: () => answers.p });
  const w = win();
  s.bag.seen.add('shelf:0');
  interiorLootOpen(s.ctx, 'shelf:0', w, s.bag);
  const sword = { name: 'Daedric Longsword', templateIndex: 115, material: 9, value: 9000, uid: 'u1' };
  s.shelf.items.push(sword);   // worldModes.js commitTrade's Sell arm: landSold
  assert.equal(interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Sell', [sword]), true);
  assert.equal(s.asked.length, 1, 'the deal asks its checkpoint at once - it waited for the five-minute one');
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5'], 'the seat\'s memory (and the farewell as the page hides) holds the sale out');
  assert.deepEqual(s.heal(), ['Dagger', 'Arrow x5'], 'a refused act\'s heal too');
  w.done = true;
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => false });
  assert.deepEqual(s.lastSent(), ['Dagger', 'Arrow x5'], 'the window\'s close too - the word that put the copy on sale');
  assert.deepEqual(s.shelf.items.map((it) => it.name), ['Dagger', 'Arrow', 'Daedric Longsword'], 'this player\'s own shelf still shows it - it is the room that waits');
});

test('SHELF-HOLD: the checkpoint lands - the shelf is said whole at once (its window shut) and the memory goes out this frame; a window still open says it at its close', async () => {
  const answers = deferred();
  const s = shop({ checkpoint: () => answers.p });
  const w = win();
  interiorLootOpen(s.ctx, 'shelf:0', w, s.bag);
  const sword = { name: 'Daedric Longsword', templateIndex: 115, value: 9000 };
  s.shelf.items.push(sword);
  interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Sell', [sword]);
  w.done = true;
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => false });
  const before = s.sent.length, claims = s.claimed;   // the open's first word already pushed the memory once (AUDIT WORLD4 D5)
  answers.ok();
  await settle();
  assert.deepEqual(s.lastSent(), ['Dagger', 'Arrow x5', 'Daedric Longsword'], 'said whole once the record holds the sale');
  assert.equal(s.sent.length, before + 1);
  assert.equal(s.claimed, claims + 1, 'and the memory pushed (the seat\'s publish clock reset)');
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5', 'Daedric Longsword']);

  const t = deferred();
  const o = shop({ checkpoint: () => t.p });
  const ow = win();
  interiorLootOpen(o.ctx, 'shelf:0', ow, o.bag);
  const ring = { name: 'Ring', templateIndex: 133, value: 500 };
  o.shelf.items.push(ring);
  interiorShelfDealt(o.ctx, o.bag, o.shelf, 'Sell', [ring]);
  const sentOpen = o.sent.length;
  t.ok();
  await settle();
  assert.equal(o.sent.length, sentOpen, 'the open window is not said over - its close is the word');
  ow.done = true;
  interiorLootFrame(o.ctx, o.bag, { now: o.now(), open: () => false });
  assert.deepEqual(o.lastSent(), ['Dagger', 'Arrow x5', 'Ring']);
});

test('SHELF-HOLD: a checkpoint refused (a duel, a journey, the service away) keeps the hold, and the frame asks again - never faster than SHELF_HOLD_RETRY_MS', async () => {
  let answer = false;
  const s = shop({ checkpoint: () => answer });
  const sword = { name: 'Sword', templateIndex: 114 };
  interiorLootOpen(s.ctx, 'shelf:0', win(), s.bag);
  s.shelf.items.push(sword);
  interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Sell', [sword]);
  assert.equal(s.asked.length, 1);
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5'], 'refused: held');
  s.tick(SHELF_HOLD_RETRY_MS - 1);
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => true });
  assert.equal(s.asked.length, 1, 'not before its time - a put is a write');
  s.tick(1);
  answer = true;   // a slot's `true`
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => true });
  assert.equal(s.asked.length, 2, 'asked again');
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5', 'Sword'], 'and let go');
  s.tick(SHELF_HOLD_RETRY_MS * 3);
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => true });
  assert.equal(s.asked.length, 2, 'nothing waits - nothing asked');

  const r = deferred();
  const o = shop({ checkpoint: () => r.p });
  interiorLootOpen(o.ctx, 'shelf:0', win(), o.bag);
  const cup = { name: 'Cup', templateIndex: 200 };
  o.shelf.items.push(cup);
  interiorShelfDealt(o.ctx, o.bag, o.shelf, 'Sell', [cup]);
  r.no();
  await settle();
  assert.deepEqual(o.memory(), ['Dagger', 'Arrow x5'], 'a put the service refused: still held');
});

test('SHELF-HOLD: a second sale while the first checkpoint is out is held until a checkpoint composed AFTER it lands - the one out never lets it go', async () => {
  const outs = [];
  const s = shop({ checkpoint: () => { const d = deferred(); outs.push(d); return d.p; } });
  interiorLootOpen(s.ctx, 'shelf:0', win(), s.bag);
  const a = { name: 'Axe', templateIndex: 111 }, b = { name: 'Bow', templateIndex: 121 };
  s.shelf.items.push(a);
  interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Sell', [a]);
  s.shelf.items.push(b);
  interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Sell', [b]);
  assert.equal(outs.length, 1, 'one at a time');
  outs[0].ok();
  await settle(); await settle();
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5', 'Axe'], 'the checkpoint out held the first sale, not the second');
  assert.equal(outs.length, 2, 'and the second is asked as the first is answered');
  outs[1].ok();
  await settle();
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5', 'Axe', 'Bow']);
});

test('SHELF-HOLD: a purchase is said at once, as it always was, and checkpointed at once; a shelf no room hears (a street merchant\'s, a home) holds and asks nothing', () => {
  const s = shop({ checkpoint: () => deferred().p });
  interiorLootOpen(s.ctx, 'shelf:0', win(), s.bag);
  s.shelf.items.splice(s.shelf.items.indexOf(s.dagger), 1);   // commitTrade's Buy arm
  assert.equal(interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Buy', [s.dagger]), true);
  assert.equal(s.asked.length, 1, 'the purchase in the record a round trip later, and in the hidden page\'s device copy');
  assert.deepEqual(s.memory(), ['Arrow x5'], 'the take is said - never the copy a held take would leave once the purchase lands');
  assert.equal(interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Repair', []), false, 'a repair moves nothing on the shelf');
  assert.equal(interiorShelfDealt(s.ctx, s.bag, { items: [] }, 'Sell', []), false, 'a street merchant\'s throwaway shelf');
  const home = mintInteriorShared(KEY, { home: true, net: { checkpoint: () => { throw new Error('asked'); } } });
  assert.equal(interiorShelfDealt(s.ctx, home, s.shelf, 'Sell', []), false, 'a home\'s cupboards are its owner\'s');
  assert.equal(interiorShelfDealt(s.ctx, mintInteriorShared(KEY, { owned: true }), s.shelf, 'Sell', []), false, 'an owned house keeps no room');
  assert.equal(s.asked.length, 1);
});

test('SHELF-HOLD: a stolen piece sold is the merchant\'s to be rid of - never shelved, never held; a piece bought back before the landing is simply not there to say', async () => {
  const d = deferred();
  const s = shop({ checkpoint: () => d.p });
  interiorLootOpen(s.ctx, 'shelf:0', win(), s.bag);
  const hot = { name: 'Hot', templateIndex: 7, stolen: true };
  interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Sell', [hot]);   // landSold put nothing on the shelf
  assert.equal(s.bag.hold.withheld(hot), 0);
  const ring = { name: 'Ring', templateIndex: 133 };
  s.shelf.items.push(ring);
  interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Sell', [ring]);
  s.shelf.items.splice(s.shelf.items.indexOf(ring), 1);   // bought back
  d.ok();
  await settle();
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5']);
});

test('SHELF-HOLD, THE SHUT SHOP: a piece left on a shut shelf (the stealing window - no basket, the pack beside it) is held as a sale is, and asks its checkpoint from the frame', async () => {
  const d = deferred();
  const s = shop({ checkpoint: () => d.p });
  const w = win();
  interiorLootOpen(s.ctx, 'shelf:0', w, s.bag, { watchPuts: true });
  const sword = { name: 'Sword', templateIndex: 114 };
  s.shelf.items.push(sword);   // the inventory window's transfer
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5'], 'held the moment anything hears the shelf - before the frame looked');
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => true });
  assert.equal(s.asked.length, 1, 'the frame asks the checkpoint the put needs');
  w.done = true;
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => false });
  assert.deepEqual(s.lastSent(), ['Dagger', 'Arrow x5'], 'its close holds it');
  assert.equal(s.bag.hold.watching, null, 'and the window let go');
  d.ok();
  await settle();
  assert.deepEqual(s.lastSent(), ['Dagger', 'Arrow x5', 'Sword'], 'landed: said');
});

test('SHELF-HOLD, THE SHUT SHOP: a second piece left a moment after the first landed asks its own checkpoint at once - the retry\'s clock is for a refusal, not for a put', () => {
  const outs = [];
  const s = shop({ checkpoint: () => { const d = deferred(); outs.push(d); return d.p; } });
  interiorLootOpen(s.ctx, 'shelf:0', win(), s.bag, { watchPuts: true });
  s.shelf.items.push({ name: 'Sword', templateIndex: 114 });
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => true });
  assert.equal(outs.length, 1);
  outs[0].ok();
  return settle().then(() => {
    s.tick(1000);
    s.shelf.items.push({ name: 'Ring', templateIndex: 133 });
    interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => true });
    assert.equal(outs.length, 2, 'asked on the frame that found it, not SHELF_HOLD_RETRY_MS later');
  });
});

test('SHELF-HOLD, THE SHUT SHOP: a stack a put merged into is said at its count before the put - a whole piece is not the only shape a put takes', async () => {
  const d = deferred();
  const s = shop({ checkpoint: () => d.p });
  interiorLootOpen(s.ctx, 'shelf:0', win(), s.bag, { watchPuts: true });
  s.arrows.stackCount = 15;   // ten of the pack's arrows dropped onto the shop's stack (addItem merges)
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5']);
  s.arrows.stackCount = 12;   // three taken back off it
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x2'], 'a take below the put is said - never more than the record backs');
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => true });
  d.ok();
  await settle();
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x12']);
});

test('SHELF-HOLD, THE SHUT SHOP: a piece taken, a save pressed (F9 is a checkpoint online), the piece put back - the put is held; the room never holds the piece the record holds', () => {
  const s = shop({ checkpoint: () => false });
  interiorLootOpen(s.ctx, 'shelf:0', win(), s.bag, { watchPuts: true });
  s.shelf.items.splice(s.shelf.items.indexOf(s.dagger), 1);   // stolen into the pack
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => true });   // the frame looks - and F9 lands the pack with it
  s.shelf.items.push(s.dagger);   // put back
  assert.deepEqual(s.memory(), ['Arrow x5'], 'held: on the record\'s word the dagger is the thief\'s');
  assert.equal(s.bag.hold.withheld(s.dagger), 1);
});

test('SHELF-HOLD: a counter\'s window is never watched - Buy\'s basket puts the merchant\'s own pieces back on the shelf, and those are no puts', () => {
  const s = shop({ checkpoint: () => false });
  interiorLootOpen(s.ctx, 'shelf:0', win(), s.bag);
  s.shelf.items.splice(s.shelf.items.indexOf(s.dagger), 1);   // staged into the basket
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => true });
  s.shelf.items.push(s.dagger);   // the basket cleared
  interiorLootFrame(s.ctx, s.bag, { now: s.now(), open: () => true });
  assert.deepEqual(s.memory(), ['Arrow x5', 'Dagger']);
  assert.equal(s.asked.length, 0, 'and no checkpoint asked for it');
});

test('SHELF-HOLD: no checkpoint door is no hold (checkpointLanded\'s `undefined`) - a bare bag says what it always said; after the visit a landing re-says nothing', async () => {
  const s = shop();
  interiorLootOpen(s.ctx, 'shelf:0', win(), s.bag);
  const sword = { name: 'Sword', templateIndex: 114 };
  s.shelf.items.push(sword);
  interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Sell', [sword]);
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5', 'Sword']);

  const d = deferred();
  const o = shop({ checkpoint: () => d.p });
  const ring = { name: 'Ring', templateIndex: 133 };
  o.shelf.items.push(ring);
  interiorShelfDealt(o.ctx, o.bag, o.shelf, 'Sell', [ring]);
  interiorLootLeave(o.ctx, o.bag);
  assert.equal(o.bag.left, true);
  const n = o.sent.length, claims = o.claimed;
  d.ok();
  await settle();
  assert.equal(o.sent.length, n, 'the farewell said the shelf as the record then backed it');
  assert.equal(o.claimed, claims);
});

test('SHELF-HOLD, THE LEDGER: puts are numbered, a landing backs every put up to the number its checkpoint covered, and a shelf is let go only once its every put is backed', () => {
  const h = createShelfHold();
  const a = { name: 'A' }, b = { name: 'B', stackCount: 4 };
  h.put(a, 1, 'shelf:0');
  const first = h.covers();
  h.put(b, 3, 'shelf:0');
  h.put(b, 1, 'shelf:1');
  assert.equal(h.withheld(a), 1); assert.equal(h.withheld(b), 4);
  assert.deepEqual(h.heard({ items: [a, b] }, 'shelf:0'), []);
  assert.deepEqual(h.landed(first), [], 'shelf 0 has a later put');
  assert.equal(h.withheld(a), 0); assert.equal(h.withheld(b), 4);
  assert.equal(h.waiting, true);
  assert.deepEqual(h.landed(first), [], 'an older answer backs nothing more');
  assert.deepEqual(h.landed(h.covers()).sort(), ['shelf:0', 'shelf:1']);
  assert.equal(h.withheld(b), 0); assert.equal(h.waiting, false);
  assert.deepEqual(h.heard({ items: [a, b] }, 'shelf:0'), [a, b], 'backed pieces are said as they are, never copied');
  h.put(null, 1, 'shelf:0'); h.put(a, 0, 'shelf:0'); h.put(a, 1, 7);
  assert.equal(h.waiting, false, 'nothing to hold: no put');
  const k = createShelfHold(), x = { name: 'X' }, y = { name: 'Y' };
  k.put(x, 1, 'shelf:0');
  const one = k.covers();
  k.put(y, 1, 'shelf:0');
  k.landed(k.covers());
  k.landed(one);   // an answer that came late
  assert.equal(k.withheld(y), 0, 'a landing never moves back: what a newer checkpoint backed stays backed');
});

test('SHELF-HOLD: a deal on a watched shelf is counted once - the door\'s put is the window\'s too, so the window\'s next look finds nothing new', async () => {
  const d = deferred();
  const s = shop({ checkpoint: () => d.p });
  interiorLootOpen(s.ctx, 'shelf:0', win(), s.bag, { watchPuts: true });
  const sword = { name: 'Sword', templateIndex: 114 };
  s.shelf.items.push(sword);
  interiorShelfDealt(s.ctx, s.bag, s.shelf, 'Sell', [sword]);
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5']);
  d.ok();
  await settle();
  assert.deepEqual(s.memory(), ['Dagger', 'Arrow x5', 'Sword'], 'the deal\'s checkpoint lets it go - no second put waits on another');
});

test('SHELF-HOLD: the landed answer has one home - onlineCheckpoint.js, which the homes\' move reads through onlineHomes.js', () => {
  assert.equal(homes.checkpointLanded, checkpointLanded);
  assert.deepEqual([undefined, true, { ok: true }, false, { ok: false }, null, {}].map(checkpointLanded), [true, true, true, false, false, false, false]);
  assert.doesNotMatch(rd('src/systems/online/onlineHomes.js'), /export const checkpointLanded/);
});

test('SHELF-HOLD, THE WIRING: the bag\'s checkpoint is the realm\'s answer to its put; every deal door at the counter and the shut shelf\'s window reach the hold; every word of a shelf reads it', () => {
  const m = hostText('src/scenes/worldModes.js'), w = hostText('src/scenes/world.js'), pure = rd('src/world/interior/interiorShared.js');
  assert.match(w, /\n {4}checkpointLanded: onlineCheckpointLanded,/, 'bootWorld hands the interior host the LANDED checkpoint - not the one that answers as the save is handed over');
  assert.match(m, /_intShared = mintInteriorShared\([^\n]*net: \{[^\n]*checkpoint: \(\) => host\.checkpointLanded\?\.\(\) \} \}\);/, 'the bag\'s net carries it');
  assert.match(m, /function commitTrade\(shelf, mode, staged, [\s\S]*?\n {4}interiorShelfDealt\(interiorCtx, _intShared, shelf, mode, staged\);[^\n]*\n {4}tallySkill\(playerEntity, SKILLS\.Mercantile, 1\);\n {4}surfacePlayer\(\);\n {2}\}/, 'the counter\'s deal, every mode, after the goods have moved');
  assert.match(m, /function doBuy\(shelf, it\) \{[\s\S]*?restockEndless\(shelf\.items, \[it\]\);[^\n]*\n {4}interiorShelfDealt\(interiorCtx, _intShared, shelf, 'Buy', \[it\]\);/, 'the keyed list\'s purchase');
  assert.match(m, /function doSell\(shelf, it\) \{[\s\S]*?landSold\(shelf\.items, it\);[^\n]*\n {4}setJunk\(it, false\);[^\n]*\n {4}interiorShelfDealt\(interiorCtx, _intShared, shelf, 'Sell', \[it\]\);/, 'the keyed list\'s sale');
  assert.match(m, /if \(b\.insideOpenShop === false\) \{[\s\S]*?interiorLootOpen\(interiorCtx, `shelf:\$\{i\}`, win, _intShared, \{ fresh, watchPuts: true \}\)/, 'the shut shop\'s window is watched');
  assert.equal((m.match(/watchPuts: true/g) ?? []).length, 1, 'and no counter\'s - its basket returns the merchant\'s own pieces');
  assert.match(m, /interiorActionRecords\(interiorCtx, keys, \{[^}]*hold: _intShared\.hold \}\)/, 'the heal');
  assert.match(pure, /function composeInteriorShared\(ctx, \{[^}]*hold = null \} = \{\}\) \{[\s\S]*?interiorLootRecords\(ctx, \[\.\.\.seen\], tooBig, \{ room, hold \}\)/, 'the memory');
  assert.match(pure, /const l = interiorLootRecords\(ctx, \[canon\], bag\.tooBig, \{ hold: bag\.hold \}\);/, 'the window\'s open and close');
  assert.match(pure, /hold: createShelfHold\(\)/, 'every visit\'s bag holds');
});
