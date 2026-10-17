// FIELD BUGS 2026-10-15d WAGON-STABLED (Fay, 2026-10-14: "Wagon appears outside of buildings/dungeons when stabled - I
// keep sending my wagon away, but every time I enter a building or dungeon it appears outside again"). HOLDINGS' Send
// away (systems/horse/horseCart.js sendTransportAway, 10155e299a) put the pair in the mod's WithPlayer - the same record as a
// pair beside a player on foot - and Horse Cart and Cargo's HandlePreTransition [IL_98f0] parks a WithPlayer wagon at
// the next door and stands a WithPlayer horse behind the player there. The record now carries two words of the port's
// own (WagonStabled, HorseStabled - horseCartLaw.js newSaveData): set by Send away, let go by a summon, a park, a mount,
// a record laid afresh, a new game or a load. All through the REAL runtime over test/hccWorld.mjs, the Stable page's
// words off its real view, the save round-tripped as JSON. bible/03-World/Holdings.md section 2 (WAGON-STABLED).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld } from '../../hccWorld.mjs';
import { WAGON_MODE, HORSE_MODE, TRANSPORT, HCC_TEXT, newSaveData, normalizeSaveData } from '../../../src/systems/horse/horseCartLaw.js';
import { stableWords, stableProviderFor } from '../../../src/ui/holdingsPages.js';
import { horseWhereOf } from '../../../src/systems/upkeep/upkeepRuntime.js';

/** Through a door and out again, as worldModes.js's interiorTransition / dungeonTransition and their exits call the
 *  runtime: the pre-transition before the dismount, the landing inside, the step back out. Answers the record as it
 *  stood inside. */
function door(h, kind = 'building') {
  const { w, rt, step, state } = h;
  const type = kind === 'dungeon' ? 'ToDungeonInterior' : 'ToBuildingInterior';
  rt.handlePreTransition({ type, door: [w.pos[0], 0, w.pos[2] + 2] });
  w.mode = TRANSPORT.Foot; w.inside = true;   // TransportManager.HandleTransition's dismount
  if (kind === 'dungeon') w.dungeon = true; else w.building = true;
  rt.handleSuccessfulInteriorTransition(kind === 'dungeon' ? { type, dungeonId: 99 } : { type, buildingKey: 7 });
  step();
  const inside = { ...state() };
  w.inside = false; w.dungeon = false; w.building = false;
  rt.handleExteriorTransition();
  step();
  return inside;
}
const sentAway = (o) => { const h = makeWorld(o); h.step(); h.rt.summonTransport(); h.step(5); assert.equal(h.rt.sendTransportAway().ok, true); h.step(); return h; };
const words = (h) => stableWords({ hcc: true, hasHorse: h.w.items.horse, hasCart: h.w.items.cart, view: h.rt.stableView() });
const saved = (rt) => JSON.parse(JSON.stringify(rt.getSaveData()));

test('WAGON-STABLED the report: summoned, sent away, then a building door and a dungeon door - the wagon is never parked outside and the horse never left waiting; the record, the Stable page and the keep all say stabled (mutants: either skip in the pre-transition, either word not set by Send away)', () => {
  const h = sentAway();
  assert.deepEqual([h.state().WagonStabled, h.state().HorseStabled], [true, true], 'Send away stables the pair');
  for (const kind of ['building', 'dungeon', 'building']) {
    const inside = door(h, kind);
    assert.equal(inside.Mode, WAGON_MODE.WithPlayer, `${kind}: the wagon stays at the stable - never Deployed at the door`);
    assert.equal(inside.HorseMode, HORSE_MODE.WithPlayer, `${kind}: the horse stays at the stable - never LooseStationary behind the player`);
    assert.equal(h.rt.view().deployed, null, `${kind}: nothing parked is drawn`);
    h.walk(25);
  }
  assert.deepEqual([h.state().WagonStabled, h.state().HorseStabled], [true, true], 'still stabled');
  const v = h.rt.stableView();
  assert.equal(v.out, false, 'nothing out to send');
  assert.deepEqual(h.rt.sendTransportAway(), { ok: false, text: HCC_TEXT.alreadyAway });
  assert.deepEqual([words(h).horse.state, words(h).wagon.state], ['Stabled', 'Stabled']);
  assert.equal(horseWhereOf(v), 'stabled', 'the keep: fed at the stable');
  // the horse alone, and the wagon alone, are stabled each by its own word
  const horse = sentAway({ cart: false });
  assert.equal(door(horse, 'dungeon').HorseMode, HORSE_MODE.WithPlayer, 'a lone horse sent away stays away');
  const cart = sentAway({ horse: false });
  assert.equal(door(cart, 'building').Mode, WAGON_MODE.WithPlayer, 'a lone wagon sent away stays away');
});

test('WAGON-STABLED the mod\'s own rule stands for a pair never sent away: on foot beside the player (WithPlayer), the next door parks the wagon outside it and leaves the horse waiting there - and the Stable page says so, With you, and offers Send away, which stables it', () => {
  const h = makeWorld();
  h.step();
  assert.deepEqual([h.state().Mode, h.state().HorseMode, h.state().WagonStabled, h.state().HorseStabled], [WAGON_MODE.WithPlayer, HORSE_MODE.WithPlayer, false, false]);
  assert.deepEqual([words(h).horse.state, words(h).wagon.state], ['With you', 'With you']);
  assert.equal(horseWhereOf(h.rt.stableView()), 'with', 'the keep: beside its owner, not the stable\'s');
  assert.equal(h.rt.stableView().out, true, 'out of the stable: Send away is offered');
  const inside = door(h, 'building');
  assert.equal(inside.Mode, WAGON_MODE.Deployed, 'parked at the door (IL_98f0)');
  assert.equal(inside.HorseMode, HORSE_MODE.LooseStationary, 'the horse waits behind the player there');
  // Send away from WithPlayer itself stables the pair
  const fresh = makeWorld();
  fresh.step();
  assert.deepEqual(fresh.rt.sendTransportAway(), { ok: true, text: HCC_TEXT.sentBoth });
  assert.equal(door(fresh, 'dungeon').Mode, WAGON_MODE.WithPlayer);
  // ...but never while riding: the horse is the seat
  const riding = makeWorld({ cart: false });
  riding.step(); riding.rt.tryUseTransport(TRANSPORT.Horse); riding.step();
  assert.equal(riding.rt.stableView().out, false, 'riding: nothing to send');
});

test('WAGON-STABLED summoned again - from the Stable page, or the summon key - the pair is out of the stable: the record lets the words go, and the next door finds the team as the mod leaves it (mutants: a summon that keeps the wagon\'s word, the horse\'s word kept by a summon with the wagon, or by one without)', () => {
  // the Stable page's Summon (the hosts' one seam, stableProviderFor)
  const h = sentAway();
  const page = stableProviderFor({ runtime: h.rt, on: () => true, hasHorse: () => true, hasCart: () => true });
  assert.equal(page.stableAct('summon').ok, true);
  assert.equal(h.state().Mode, WAGON_MODE.Deployed);
  const rec = saved(h.rt);
  assert.deepEqual([rec.WagonStabled, rec.HorseStabled], [false, false], 'the saved record: neither stabled');
  h.step(3);
  assert.deepEqual([words(h).horse.state, words(h).wagon.state], ['Hitched', 'Parked']);
  // driven off from where it was summoned, and through a door: the mod's by-cart rule - parked there, hitched
  h.rt.tryUseTransport(TRANSPORT.Cart); h.step(); h.walk(10);
  const inside = door(h, 'building');
  assert.deepEqual([inside.Mode, inside.HorseMode], [WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon]);
  // the summon key: a lone horse comes to stand behind the player
  const k = sentAway({ cart: false });
  k.w.keys.add('HorseSummon'); k.step();
  assert.equal(k.w.said.at(-1), HCC_TEXT.summonedHorse);
  assert.equal(k.state().HorseMode, HORSE_MODE.LooseStationary);
  assert.equal(saved(k.rt).HorseStabled, false, 'a lone horse summoned is not stabled');
});

test('WAGON-STABLED a mount takes the pair out of the stable: the horse ridden from the Transport window leaves the stabled wagon at the stable (never parked behind, never on a journey) and is left at the door it is ridden through; the wagon driven from it is parked at its door, hitched; a door gone through mounted is a mount (mutants: the mount leaves the word - set, observed, first seen, at the door; the wagon laid behind a horse mounted; the stabled wagon on the journey)', () => {
  const h = sentAway();
  assert.equal(h.rt.tryUseTransport(TRANSPORT.Horse).succeeded, true, 'mounted from the Transport window, as the mod\'s WithPlayer always was');
  assert.equal(h.state().Mode, WAGON_MODE.WithPlayer, 'the stabled wagon is not laid behind the mount');
  assert.deepEqual([h.state().WagonStabled, h.state().HorseStabled], [true, false]);
  assert.equal(h.rt.wagonGoesOnJourney(), false, 'a fast travel leaves the stabled wagon at the stable (its wear, its seats)');
  h.step(); h.walk(10);
  const inside = door(h, 'building');
  assert.equal(inside.Mode, WAGON_MODE.WithPlayer, 'ridden through the door: the stabled wagon stays away');
  assert.equal(inside.HorseMode, HORSE_MODE.LooseStationary, 'the horse ridden is left at the door');
  // the game's own set (the classic picker, a script), taken through a door before the runtime's frame observes it
  const g = sentAway();
  g.w.mode = TRANSPORT.Horse;
  assert.equal(door(g, 'building').HorseMode, HORSE_MODE.LooseStationary, 'ridden: left at the door, the word or no');
  const c = sentAway();
  c.w.mode = TRANSPORT.Cart;
  const driven = door(c, 'building');
  assert.deepEqual([driven.Mode, driven.HorseMode], [WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon], 'driven: parked at the door, hitched');
  // ...and once observed, the game's set is a mount like any other - a change of mode, or the first the runtime sees (the
  // mod's switch turned back on over a horse the classic window mounted meanwhile: AUDIT HCC H4's suspend)
  const o = sentAway();
  o.w.mode = TRANSPORT.Horse; o.step();
  assert.deepEqual([o.state().WagonStabled, o.state().HorseStabled, o.state().Mode], [true, false, WAGON_MODE.WithPlayer]);
  const f = sentAway();
  f.rt.suspend(); f.w.mode = TRANSPORT.Horse; f.step();
  assert.deepEqual([f.state().WagonStabled, f.state().HorseStabled, f.state().Mode], [true, false, WAGON_MODE.WithPlayer], 'first seen riding: the horse out, the stabled wagon not laid behind it');
  // driven from the Transport window: both out of the stable
  const d = sentAway();
  assert.equal(d.rt.tryUseTransport(TRANSPORT.Cart).succeeded, true);
  assert.deepEqual([d.state().WagonStabled, d.state().HorseStabled], [false, false]);
  assert.equal(d.rt.wagonGoesOnJourney(), true, 'driven, the wagon goes');
  d.step(); d.walk(10);
  assert.deepEqual([door(d, 'dungeon').Mode, d.state().HorseMode], [WAGON_MODE.Deployed, HORSE_MODE.HitchedToWagon]);
});

test('WAGON-STABLED the words go with the record: a wagon or a horse sold while stabled, and another bought, is the mod\'s WithPlayer - beside the player, parked at the next door; a wagon parked with its horse still at the stable keeps the horse\'s word (mutants: the wagon\'s or the horse\'s record laid afresh keeping the word, a park letting a horse go that stayed with the player)', () => {
  const h = sentAway();
  h.w.items.cart = false; h.w.items.horse = false; h.step();
  assert.deepEqual([h.state().Mode, h.state().HorseMode], [WAGON_MODE.None, HORSE_MODE.None]);
  h.w.items.cart = true; h.w.items.horse = true; h.step();
  assert.deepEqual([h.state().WagonStabled, h.state().HorseStabled], [false, false]);
  const inside = door(h, 'building');
  assert.deepEqual([inside.Mode, inside.HorseMode], [WAGON_MODE.Deployed, HORSE_MODE.LooseStationary], 'the new pair is parked at the door, as the mod parks one');
  // a wagon bought while the horse is stabled: the wagon is parked at the door, the horse stays at the stable - at that
  // door and every one after
  const lone = sentAway({ cart: false });
  lone.w.items.cart = true; lone.step();
  assert.deepEqual([lone.state().Mode, lone.state().WagonStabled, lone.state().HorseStabled], [WAGON_MODE.WithPlayer, false, true]);
  const first = door(lone, 'building');
  assert.deepEqual([first.Mode, first.HorseMode, first.HorseStabled], [WAGON_MODE.Deployed, HORSE_MODE.WithPlayer, true], 'the wagon parked with no horse in its shafts: the horse still stabled');
  lone.walk(25);
  assert.equal(door(lone, 'dungeon').HorseMode, HORSE_MODE.WithPlayer, 'and the next door leaves it there too');
});

test('WAGON-STABLED the save: a stabled pair saved and loaded is stabled still and stays away; a save from before the word (no field written) loads not stabled - the mod\'s WithPlayer, parked at the next door; a new game and a load\'s start let it go (mutants: the fields not in the record, not read back)', () => {
  const h = sentAway();
  const rec = saved(h.rt);
  assert.deepEqual([rec.WagonStabled, rec.HorseStabled], [true, true], 'written');
  const b = makeWorld();
  b.rt.handleStartLoad(); b.rt.restoreSaveData(rec); b.step();
  assert.deepEqual([b.state().WagonStabled, b.state().HorseStabled], [true, true], 'read back');
  const inside = door(b, 'dungeon');
  assert.deepEqual([inside.Mode, inside.HorseMode], [WAGON_MODE.WithPlayer, HORSE_MODE.WithPlayer], 'loaded stabled, the door leaves it away');
  // the save as the build before this one wrote it - the mod's fifteen fields, no word
  const old = { ...rec };
  delete old.WagonStabled; delete old.HorseStabled;
  assert.equal(Object.keys(old).length, 15);
  const o = makeWorld();
  o.rt.handleStartLoad(); o.rt.restoreSaveData(old); o.step();
  assert.deepEqual([o.state().Mode, o.state().HorseMode, o.state().WagonStabled, o.state().HorseStabled], [WAGON_MODE.WithPlayer, HORSE_MODE.WithPlayer, false, false]);
  assert.deepEqual([words(o).horse.state, words(o).wagon.state, o.rt.stableView().out], ['With you', 'With you', true], 'With you, and Send away offered');
  const oi = door(o, 'building');
  assert.deepEqual([oi.Mode, oi.HorseMode], [WAGON_MODE.Deployed, HORSE_MODE.LooseStationary], 'not stabled: the mod\'s rule');
  // the load's start and a new game: no word from the character before
  const s = sentAway();
  s.rt.handleStartLoad();
  assert.deepEqual([s.state().WagonStabled, s.state().HorseStabled], [false, false]);
  const n = sentAway();
  n.rt.handleNewGame();
  assert.deepEqual([n.state().WagonStabled, n.state().HorseStabled], [false, false]);
});

test('WAGON-STABLED the record\'s law: the two words are the port\'s own beside the mod\'s fifteen, false new; a load reads a word only as true (a hand-edited or foreign record\'s anything else is not stabled)', () => {
  const d = newSaveData();
  assert.deepEqual([d.WagonStabled, d.HorseStabled], [false, false]);
  assert.deepEqual(Object.keys(d).slice(-2), ['WagonStabled', 'HorseStabled']);
  const n = normalizeSaveData({ ...d, Mode: WAGON_MODE.WithPlayer, HorseMode: HORSE_MODE.WithPlayer, WagonStabled: 'yes', HorseStabled: 1 }, 40);
  assert.deepEqual([n.WagonStabled, n.HorseStabled], [false, false]);
  const t = normalizeSaveData({ ...d, Mode: WAGON_MODE.WithPlayer, HorseMode: HORSE_MODE.WithPlayer, WagonStabled: true, HorseStabled: true }, 40);
  assert.deepEqual([t.WagonStabled, t.HorseStabled], [true, true]);
});
