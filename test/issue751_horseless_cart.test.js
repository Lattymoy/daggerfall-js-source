// ISSUE #751 (2026-10-15): a Small Cart bought with no horse never stands in the world. Pinned over the HCC runtime's
// fake host (test/hccWorld.mjs), physical persistence at its default (on): the cart bought lands WithPlayer, which
// nothing draws (the trailing wagon is drawn only while the cart is driven, and driving takes a horse); the Stable's
// Summon (systems/horseCart.js summonTransport) is what parks it, horseless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAGON_MODE, HORSE_MODE, TRANSPORT, HCC_TEXT } from '../src/systems/horseCartLaw.js';
import { stableWords } from '../src/ui/holdingsPages.js';

import { makeWorld } from './hccWorld.mjs';   // the fake host, one home

test('#751: a Small Cart bought with no horse stays WithPlayer, and nothing draws it', () => {
  const { rt, w, step, walk, state } = makeWorld({ cart: false, horse: false });
  step();
  assert.equal(state().Mode, WAGON_MODE.None, 'nothing owned yet');
  w.items.cart = true;   // the yard's sale: the cart in the pack, still no horse
  step();
  assert.equal(state().Mode, WAGON_MODE.WithPlayer, 'the bought cart is with the player');
  assert.equal(state().HorseMode, HORSE_MODE.None);
  walk(20);
  const v = rt.view();
  assert.equal(state().Mode, WAGON_MODE.WithPlayer, 'walking never parks it');
  assert.equal(v.moving, null, 'no trailing wagon - the player is on foot');
  assert.equal(v.deployed, null, 'no parked wagon - it was never deployed');
  assert.equal(rt.canUseTransport(TRANSPORT.Cart).denialMessage, HCC_TEXT.needHorseToPull, 'and it cannot be driven out');
});

test('#751: summonTransport with no horse parks the cart in the world - Deployed, HORSE_MODE.None', () => {
  const { rt, w, step, state } = makeWorld({ cart: false, horse: false });
  step();
  w.items.cart = true;
  step();
  const r = rt.summonTransport();
  assert.equal(r.ok, true);
  assert.equal(r.text, HCC_TEXT.summonedWagon);
  assert.equal(state().Mode, WAGON_MODE.Deployed);
  assert.equal(state().HorseMode, HORSE_MODE.None);
  step(2);
  assert.ok(rt.view().deployed, 'the parked wagon is drawn');
  assert.equal(rt.view().horse, null, 'and no horse beside it');
});

test('#751: the Stable\'s wagon line points a horseless owner at Summon while the cart is out of the world', () => {
  const { rt, w, step } = makeWorld({ cart: false, horse: false });
  step();
  w.items.cart = true;
  step();
  const view = rt.stableView();   // what the Stable page is handed: the runtime's own read
  assert.equal(view.persistence, true); assert.equal(view.hasCart, true); assert.equal(view.hasHorse, false);
  assert.equal(view.wagonMode, WAGON_MODE.WithPlayer, 'out of the world - neither parked nor following');
  const { wagon } = stableWords({ hcc: true, hasHorse: false, hasCart: true, view });
  assert.equal(wagon.state, 'Stabled');
  assert.match(wagon.line, /Summon/, `the line names Summon: ${wagon.line}`);
});
