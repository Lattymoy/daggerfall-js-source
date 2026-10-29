// DRAGON5c (bible/11-Multiplayer/Dwarven-Dragon.md section 10; the owner: "upkeep using the same horse care system"): THE
// TAMED DRAGON'S CARE - horse care's own law (systems/steedCare.js) on the dragon item: four stats born of its tame's id,
// its bond and hunger on the item (`horseBond`, `horseFed`, lawful on it), Dwarven Oil its one food (a Stable sells it,
// online behind its own switch - REST6), its breath spent galloping and flying (systems/upkeep/upkeepRuntime.js); winded
// it will not gallop or take off, and aloft it glides (player/dragonRide.js). Its care on its Stable card.
// tools/mutants/dragon5c.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newDragonMount, dragonSeedOf } from '../../../src/systems/dragon/dragonMount.js';
import { steedStats, horseBornStats, feedHorse, tendSteed, eatsFood, STEED_FOODS, NEW_HORSE_FED, STARVING_AFTER, hungerOf, fedUntil, breathMax } from '../../../src/systems/steedCare.js';
import { UPKEEP_ITEM, newUpkeepItem, DWARVEN_OIL_ONLINE, dwarvenOilAvailable } from '../../../src/systems/upkeep/upkeepItemRows.js';
import { createUpkeep } from '../../../src/systems/upkeep/upkeepRuntime.js';
import { HORSE_CARE_HARD } from '../../../src/systems/upkeep/upkeepTiers.js';
import { setDragonKeepDoor, KEEP, DRAGON_CARE_TEXT } from '../../../src/systems/dragon/dragonKeep.js';
import { dragonRideStep, dragonAloft, _resetDragonFlight } from '../../../src/player/dragonRide.js';
import { TAKEOFF_HOLD_S, DRAGON_GLIDE_SINK } from '../../../src/systems/dragon/dragonFlight.js';
import { flySink } from '../../../src/player/motor.js';
import { yardStock } from '../../../src/systems/merchantYards.js';
import { itemFindings } from '../../../src/systems/item/itemLaw.js';
import { templateByIndex, itemUseHandler } from '../../../src/systems/item/itemTemplates.js';
import { registerUpkeepUses } from '../../../src/systems/upkeep/upkeepRuntime.js';
import { drawStablePage, setHoldingsProvider, stableProviderFor, resetHoldingsPages, _setHoldingsIconForTests } from '../../../src/ui/holdingsPages.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ID = 'dg0123456789abcdef';
const OIL = UPKEEP_ITEM.DwarvenOil;

test('DRAGON5c the dragon on horse care\'s law: its seed its tame id\'s last four hex, its four stats born of it as a horse\'s are; the oil its one food, a day of it a flask, never a horse\'s (mutants: the seed unread, a horse fed oil)', () => {
  const d = newDragonMount({ id: ID });
  assert.equal(dragonSeedOf(d), 0xcdef);
  assert.equal(dragonSeedOf({ templateIndex: 94, dragonId: ID }), 0, 'a horse\'s is its own');
  assert.equal(dragonSeedOf(newDragonMount({ id: 'dg0000000000000000' })), 1, 'never nought: a seed the law knows');
  const st = steedStats(d, 0);
  assert.deepEqual(st.born, horseBornStats(d));
  assert.ok(Object.values(st.born).every((v) => v >= 20 && v <= 80));
  assert.equal(templateByIndex(OIL)?.name, 'Dwarven Oil');
  const oil = STEED_FOODS[OIL];
  assert.deepEqual([oil.key, oil.hours, oil.dragon], ['oil', 24, true]);
  assert.equal(eatsFood(d, oil), true);
  assert.equal(eatsFood({ templateIndex: 94, horseSeed: 5 }, oil), false, 'a horse never drinks it');
  assert.equal(eatsFood(d, STEED_FOODS[1710]), false, 'nor the dragon oats');
  const horse = { group: 'Transportation', templateIndex: 94, horseSeed: 7 };
  const pack = [horse, d, newUpkeepItem(OIL, 2), newUpkeepItem(1710, 2)];
  assert.equal(feedHorse(pack, horse, 'oil', 0).ok, false);
  const r = feedHorse(pack, d, 'oil', 0, 'Ember');
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, /^Ember eats a flask of Dwarven Oil/);
  assert.equal(fedUntil(d), 24 * 60);
  assert.ok(d.horseBond > 0, 'the bond grows by hand');
  assert.equal(pack.find((it) => it.templateIndex === OIL).stackCount ?? 1, 1);
  assert.equal(feedHorse(pack, d, 'oats', 0).ok, false, 'never oats');
});

test('DRAGON5c its keep: first seen it comes fed; with its owner across a span skipped it drinks the pack\'s oil, then its saddlebags\'; waiting or away it hunts - hungry at worst, never starving (mutants: the oil not drunk on the road, a waiting dragon starved)', () => {
  const d = newDragonMount({ id: ID }), pack = [d];
  assert.equal(tendSteed(d, pack, 100).changed, true);
  assert.equal(fedUntil(d), 100 + NEW_HORSE_FED);
  const bags = [newUpkeepItem(OIL, 3)];
  const r = tendSteed(d, pack, 100 + 3 * 24 * 60, { since: 100, stores: bags });
  assert.ok(r.ate >= 2, `drank ${r.ate}`);
  assert.equal(hungerOf(d, 100 + 3 * 24 * 60) === 'starving', false);
  const w = newDragonMount({ id: ID });
  w.horseFed = 10;
  tendSteed(w, [w], 10 + 10 * 24 * 60, { since: 10, where: 'waiting' });
  assert.notEqual(hungerOf(w, 10 + 10 * 24 * 60), 'starving', 'it hunts for itself');
  assert.ok(STARVING_AFTER > 0);
});

/** The upkeep over a dragon in the pack, its keep's door a fake (`where`, `near`). */
function care({ where = KEEP.Ridden, near = true, items = null } = {}) {
  const pack = items ?? [newDragonMount({ id: ID }), newUpkeepItem(OIL, 4)];
  const bags = [newUpkeepItem(OIL, 2)];
  setDragonKeepDoor({ model: () => ({ where, near, title: 'Ember' }), bags: () => bags });
  let t = 1000;
  const said = [];
  const up = createUpkeep({ items: () => pack, now: () => t, horseCare: () => HORSE_CARE_HARD, say: (l) => said.push(l) });
  return { up, pack, bags, said, clock: (m) => { t += m; }, now: () => t };
}

test('DRAGON5c the runtime\'s keep: waiting or away, ten days on, it hunts and never starves; ridden with no oil it does (mutants: a waiting dragon starved)', () => {
  for (const [where, starves] of [[KEEP.Waiting, false], [KEEP.Away, false], [KEEP.Ridden, true]]) {
    const c = care({ where, near: false, items: [newDragonMount({ id: ID })] });
    c.up.tick(0.1, { mode: 'Foot' });   // first seen: it comes fed
    c.clock(10 * 24 * 60);
    c.up.tick(0.1, { mode: 'Foot' });
    assert.equal(hungerOf(c.pack[0], c.now()) === 'starving', starves, where);
  }
});

test('DRAGON5c its breath: a gallop on the ground spends it, and so does flight; winded it will not gallop, the HUD shows it short, and it says so; its Speed paces its ride (mutants: flight free, the gallop gate deaf to the dragon)', () => {
  _resetDragonFlight();
  const { up, said } = care();
  up.tick(0.1, { mode: 'Dragon' });
  const st = steedStats(up.model().dragon ? { templateIndex: 1820, dragonId: ID } : null, 1000, HORSE_CARE_HARD);
  assert.ok(st);
  assert.equal(up.gallopGate('Dragon', null), true);
  assert.equal(up.rideWalks('Dragon'), true, 'it walks unless it gallops, as a horse');
  assert.ok(Math.abs(up.rideScale('Dragon') - Math.max(0.85, Math.min(1.15, 0.85 + 0.003 * st.stats.speed))) < 1e-9);
  assert.equal(up.riderPaysGallop('Dragon'), false, 'the dragon pays it in breath');
  up.tick(1, { mode: 'Dragon', galloping: true, moving: true });
  assert.ok(up.dragonBreathOf().spent > 0, 'a gallop spends');
  const spent = up.dragonBreathOf().spent;
  // aloft: the flight's own state (mounted, jump held past the takeoff)
  dragonRideStep(TAKEOFF_HOLD_S + 0.1, { transportMode: 'Dragon', grounded: true }, { jump: true });
  dragonRideStep(0.016, { transportMode: 'Dragon', grounded: true }, { jump: true });
  assert.equal(dragonAloft(), true);
  up.tick(1, { mode: 'Dragon', galloping: false, moving: true });
  assert.ok(up.dragonBreathOf().spent > spent, 'flight spends, whatever the run key');
  for (let i = 0; i < 200 && !up.dragonBreathOf().winded; i++) up.tick(1, { mode: 'Dragon', moving: true });
  assert.equal(up.dragonBreathOf().winded, true);
  assert.ok(said.includes(DRAGON_CARE_TEXT.winded));
  assert.equal(up.gallopGate('Dragon', null), false);
  assert.equal(up.bar('Dragon').low, true);
  assert.ok(breathMax(st.stats) > 0);
});

test('DRAGON5c winded it will not take off, and aloft it glides down; a flown journey does not lift it (mutants: a winded takeoff, no glide)', () => {
  _resetDragonFlight();
  const { up } = care();
  dragonRideStep(TAKEOFF_HOLD_S + 0.1, { transportMode: 'Dragon', grounded: true }, { jump: true });
  assert.equal(dragonAloft(), true, 'up');
  for (let i = 0; i < 400 && !up.dragonBreathOf().winded; i++) up.tick(1, { mode: 'Dragon', moving: true });   // flown till winded
  assert.equal(up.dragonBreathOf().winded, true);
  dragonRideStep(0.016, { transportMode: 'Dragon', grounded: false }, {});   // the flight hears it
  assert.equal(dragonAloft(), true);
  assert.equal(flySink(), DRAGON_GLIDE_SINK, 'it glides down');
  // on the ground, winded: jump held never takes it up
  _resetDragonFlight();
  const again = care();
  for (let i = 0; i < 400 && !again.up.dragonBreathOf().winded; i++) again.up.tick(1, { mode: 'Dragon', moving: true, galloping: true });
  dragonRideStep(TAKEOFF_HOLD_S + 0.5, { transportMode: 'Dragon', grounded: true }, { jump: true });
  dragonRideStep(TAKEOFF_HOLD_S + 0.5, { transportMode: 'Dragon', grounded: true }, { jump: true });
  assert.equal(dragonAloft(), false);
  assert.match(src('src/player/dragonRide.js'), /if \(_cruise === 'cruise' && mounted && !winded && !flight\.aloft\(\) && flight\.lift\(\)\)/);
});

test('DRAGON5c its card and its feed: the Stable card\'s care - bond, hunger, its breath ridden, a press of oil from the pack then its bags - only with it at hand; the oil\'s Use feeds it (mutants: fed from afar, the bags never drunk from)', () => {
  const { up, pack, bags, clock } = care();
  up.tick(0.1, { mode: 'Dragon' });
  const m = up.model();
  assert.ok(m.dragon && m.dragon.near);
  assert.equal(m.oil, 4 + 2, 'the pack\'s and its bags\'');
  const r = up.act('feedDragon', 0);
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, /^Ember eats/);
  assert.equal(pack[1].stackCount, 3, 'the pack\'s first');
  pack.splice(1, 1);
  clock(24 * 60);   // a day on: hungry for more
  assert.equal(up.act('feedDragon', 0).ok, true);
  assert.equal(bags[0].stackCount ?? 1, 1, 'then its saddlebags\'');
  const far = care({ where: KEEP.Waiting, near: false });
  far.up.tick(0.1, { mode: 'Foot' });
  assert.equal(far.up.act('feedDragon', 0).ok, false);
  assert.equal(far.up.act('feedDragon', 0).text, DRAGON_CARE_TEXT.notHere);
  // the oil's Use
  const used = care();
  registerUpkeepUses(used.up, { reach: () => ({}), pass: () => {}, horseCare: () => HORSE_CARE_HARD, wagonUpkeep: () => null });
  used.up.tick(0.1, { mode: 'Dragon' });
  const out = itemUseHandler(OIL)(used.pack[1], used.pack);
  assert.match(out.text, /^Ember eats/);
  // the card
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  const fe = (tag) => { const n = { tag, children: [], attrs: {}, title: '', isConnected: true, classes: '', _t: '', get textContent() { return n._t + n.children.map((c) => c.textContent).join(''); }, set textContent(v) { n._t = String(v); }, set className(v) { n.classes = v; }, get className() { return n.classes; }, append(...c) { n.children.push(...c); }, setAttribute(k, v) { n.attrs[k] = v; } }; return n; };
  const el = (t, cls, text) => { const n = fe(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const shown = care();
  shown.up.tick(0.1, { mode: 'Dragon' });
  setDragonKeepDoor({ model: () => ({ where: 'ridden', near: true, title: 'Ember', name: 'Ember', look: 0, coming: false, far: null, bags: { count: 0, kg: 0, max: 1000 } }), bags: () => [] });
  setHoldingsProvider(stableProviderFor({ runtime: null, on: () => false, hasHorse: () => false, hasCart: () => false, upkeep: shown.up }));
  resetHoldingsPages();
  const d = el('div');
  drawStablePage(d, () => {}, { el, divider: (x) => el('h4', null, x), meter: (now, max) => el('div', null, `${now}/${max}`) });
  assert.match(d.textContent, /Ember/);
  assert.match(d.textContent, /bond 0 of 100/);
  assert.match(d.textContent, /Breath/);
  assert.match(d.textContent, /Feed Dwarven Oil \(4\)/);
  assert.match(d.textContent, /Stats/);
  setDragonKeepDoor(null);
});

test('DRAGON5c the oil at the Stable and in the law: every Stable sells it offline; online not until its own switch (REST6); a dragon\'s bond and food lawful on it, never on another piece (mutants: the oil sold online, the bond refused on the dragon)', () => {
  assert.equal(DWARVEN_OIL_ONLINE, false);
  assert.equal(dwarvenOilAvailable(false), true);
  assert.equal(dwarvenOilAvailable(true), false);
  assert.ok(yardStock('stable').some((it) => it.templateIndex === OIL && it.stackCount === 10));
  assert.ok(!yardStock('stable', { online: true }).some((it) => it.templateIndex === OIL));
  const d = { ...newDragonMount({ id: ID }), horseBond: 120, horseFed: 5000 };
  assert.deepEqual([...itemFindings(d)].filter((f) => f === 'horse'), []);
  assert.ok(itemFindings({ group: 'Weapons', templateIndex: 113, horseBond: 5 }).has?.('horse') ?? [...itemFindings({ group: 'Weapons', templateIndex: 113, horseBond: 5 })].includes('horse'));
  assert.ok([...itemFindings({ ...newDragonMount({ id: ID }), horseCoat: 2 })].includes('horse'), 'a horse\'s look never on it');
  assert.match(src('src/scenes/world.js'), /const galloping = !_overlayHeld && \(mode === TRANSPORT_MODES\.Horse \|\| mode === TRANSPORT_MODES\.Dragon\)/);
  assert.match(src('src/scenes/exterior.js'), /const galloping = !_overlayHeld && \(mode === TRANSPORT_MODES\.Horse \|\| mode === TRANSPORT_MODES\.Dragon\)/);
});
