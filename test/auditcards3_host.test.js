// AUDIT CARDS-3 (2026-10-08, bible/01-Overview/Audit-Cards-3.md): THE HOSTS' SEAMS. The relay's frames on the cloth's
// own clock (D1); the panel's message rewritten in place, its slider and its buttons kept (B5); the next hand waiting
// for the cloth (C4); a friendly game never refusing a save (E-N5); the comments back on their own lines (D11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDoc } from './decorFakes.mjs';
import { createCardTableHud } from '../src/ui/cardTableHud.js';
import { CardScene, tablePlaces } from '../src/world/cardScene.js';
import { tableFrame, cardTableSeats } from '../src/world/cardTables.js';
import { PUSH_S } from '../src/world/cardMotion.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('AUDIT CARDS-3 D1: the relay\'s card frames reach the host stamped with the cloth\'s clock, never the session\'s epoch', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /online\.onHoldem = \(f\) => modes\?\.cardOnlineFrame\?\.\(\{ \.\.\.f, at: performance\.now\(\) \}\);/);
  assert.match(w, /welcomes: \(\) => online\?\.holdemWelcomes \?\? 0 \}/, 'B1: and the primary socket\'s welcomes');
  assert.match(read('src/net/online.js'), /if \(primary\) \{ this\.holdemOk = relaySupportsHoldem\(relayV\); this\.holdemWelcomes\+\+; \}/);
});

test('AUDIT CARDS-3 B5: a model that differs only in its message rewrites the message - the slider and the buttons are the same nodes', () => {
  const doc = fakeDoc();
  const hud = createCardTableHud({ onPress: () => {}, doc });
  const model = (message) => ({ phase: 'playing', title: 'T', note: null, seats: [], pot: 0, board: [], street: null, message, log: [],
    actions: [{ id: 'fold', label: 'Fold', enabled: true }, { id: 'raise', label: 'Raise to', enabled: true, min: 20, max: 400, step: 5 }] });
  hud.render(model('Your turn - 30 s.'));
  const kids = [...hud.root.children];
  hud.render(model('Your turn - 29 s.'));
  assert.deepEqual([...hud.root.children], kids, 'the same nodes');
  assert.ok(kids.some((n) => n.className === 'msg' && n.textContent === 'Your turn - 29 s.'), 'the message rewritten');
  hud.render({ ...model('Your turn - 28 s.'), pot: 30 });
  assert.notDeepEqual([...hud.root.children], kids, 'anything else rebuilds');
  const again = [...hud.root.children];
  hud.resetSlider();
  hud.render({ ...model('x'), pot: 30 });
  assert.notDeepEqual([...hud.root.children], again, 'a reset slider rebuilds at the law\'s own value');
});

test('AUDIT CARDS-3 C4: the cloth says when it is still - the last turned card, the last share home - and the host holds the deal for it', () => {
  const table = { aabb: { min: [10, 0, 20], max: [12, 0.8, 21] } };
  const seats = cardTableSeats(table, () => true);
  const scene = new CardScene({ places: tablePlaces(tableFrame(table), seats, [0, 1]), playerSeat: 0 });
  scene.onEvent({ t: 'hand', hand: 1, button: 0, seats: [0, 1], at: 0 }, () => -1);
  const dealt = scene.settledAt();
  scene.onEvent({ t: 'street', street: 'river', board: [1, 2, 3, 4, 5], at: 2000 }, () => -1);
  assert.ok(scene.settledAt() > Math.max(dealt, 2), 'a run-out still turning');
  scene.onEvent({ t: 'showdown', hand: 1, seats: [0, 1], result: { shown: false, pots: [{ amount: 40, seats: [0] }], payouts: [40, 0] }, board: [1, 2, 3, 4, 5], holes: [null, null], at: 2000 }, () => -1);
  const push = scene.pushes.at(-1);
  assert.equal(scene.settledAt(), Math.max(scene.busyUntil, push.t0 + PUSH_S), 'the pot\'s share home last');
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /if \(!g\.session\.hand && g\.scene\) g\.session\.nextDealAt = Math\.max\(g\.session\.nextDealAt, g\.scene\.settledAt\(\) \* 1000 \+ CARD_CLOTH_REST_MS\);\n\s*g\.session\.tick\(now\);/);
});

test('AUDIT CARDS-3 E-N5 and D11: a friendly game\'s chips refuse no save; the comments back on the lines they speak of', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /cardTableLive: \(\) => !!cardGame\?\.session && !cardGame\.friendly,   \/\/ AUDIT CARDS-2 H1/);
  assert.match(wm, /cardOnlineFrame,   \/\/ CARDS5: the relay's card table's frames \(world\.js online\.onHoldem\)\n\s*\/\*\* CARDS2b: the seat the pose says/);
  const w = read('src/scenes/world.js');
  assert.match(w, /from '\.\.\/systems\/livingWorld\/livingTown\.js';   \/\/ LW2: the living world's streets/);
  assert.match(w, /from '\.\.\/world\/cardRegulars\.js';   \/\/ CARDS4b: a seated regular's line over his head\n/);
  const online = read('src/net/online.js');
  assert.match(online, /rate, or no open socket\. \*\/\n\s*sendRoll\(spec/, 'sendRoll\'s doc over sendRoll');
});
