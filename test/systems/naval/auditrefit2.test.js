// AUDIT NAVAL-REFIT 2 (2026-10-17, the owner: "Please once more audit everything and ensure perfection"; bible/03-World/
// Naval-Refit.md AUDIT 2) - what the second audit of the refit found, each on the real module it lives in: the Fleet's
// stars over a ship laid up, conjured steel, a keystone's price in the fight, the stores taken in the order that pays, the
// captain's sky asked before the QuickDial key lets it go, the exchange never buying at what it sells; the word's men
// rounded on the ball's roll, the wheel's quiet, a near miss told where it passed nearest, the tally's men as her stander
// reckons them, the blow's side and the drench's jar the boat in play's, a copy first seen going down kept quiet; a
// hidden boat's name boards, a fitting's model pinned, the flags' cap, a sea ship's paint only on
// the meshes it repaints, the word said again for a name board, another's cabin as built, a fitting's whole box; a packed
// hold's weight and her parts never lost in it, a Rowboat's plunder, the hold key's fallback, the peace bonus while a
// ship gives chase, the hold's pad binding. tools/mutants/auditrefit2.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createFleetHost } from '../../../src/scenes/fleetHost.js';
import { knowShip, meltable, upgradeCost, materialsFor, takeAllMaterials, takeMaterials, meltCounts, _resetFleetForTests } from '../../../src/systems/fleet.js';
import { exchangeOf, priceOf, TRADE_MOST, GOODS } from '../../../src/systems/naval/tradeGoods.js';
import { dialCloser } from '../../../src/ui/naval/navalPlunderDoor.js';
import { registerOverlay, closeTopOverlay, clearOverlays, overlayOpen } from '../../../src/ui/enhanced/enhancedOverlays.js';
import { createNavalLoads, SHOT_WHEEL_S } from '../../../src/scenes/naval/navalLoads.js';
import { createVolleyTally } from '../../../src/scenes/naval/navalTally.js';
import { createNavalFeel, NEAR_SHAKE, DRENCH_FEET_M } from '../../../src/scenes/naval/navalFeel.js';
import { createShotField, NEAR_MISS_M, BALL_LIFE } from '../../../src/systems/naval/navalShots.js';
import { shotPosition } from '../../../src/systems/naval/navalBallistics.js';
import { navalWireRecord } from '../../../src/systems/naval/navalWire.js';
import { NAVAL_CLASSIC, NAVAL_SFX } from '../../../src/systems/naval/navalSounds.js';
import { MAGAZINE_DELAY, magazineOf } from '../../../src/scenes/naval/navalFeel.js';
import { HULL, hullBuild } from '../../../src/systems/naval/navalShips.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { createShipFlagHost } from '../../../src/scenes/shipFlagHost.js';
import { FLAGS_MAX } from '../../../src/render/shipFlagPass.js';
import { FLAG_DEFAULT } from '../../../src/systems/naval/shipFlag.js';
import { createLiveryPaint } from '../../../src/scenes/comeSailAway/shipLiveryPaint.js';
import { csaRecordKey } from '../../../src/systems/comeSailAway/comeSailAwayWire.js';
import { placeRefusal, fittingCorners } from '../../../src/ui/deckPlanWindow.js';
import { boxesMeet } from '../../../src/systems/naval/shipLife.js';
import { fitBoats } from '../../../src/scenes/comeSailAway/deckFittingsHost.js';
import { fittingsOf } from '../../../src/systems/naval/deckFittings.js';
import { createHoldDoor } from '../../../src/scenes/holdDoor.js';
import { PLUS_BIND_ROWS } from '../../../src/ui/plus/plusPadBinds.js';
import { sea, freshPool } from '../../navalSea.mjs';
import { hostText } from '../../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

// ── THE FLEET ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT 2 the stars over a ship laid up: an accepted sky reads EVERY ship of the Fleet again - the boats standing, and a laid-up or packed one by her number (her sea state is kept by it from the page\'s first read); on the real naval host her state takes her new whole, and a keystone\'s price under 1 is paid in the fight as its gain is (mutants: the standing alone, the price ignored)', async () => {
  _resetFleetForTests();
  knowShip(41, 2, 0, 100); knowShip(42, 3, 0, 100);
  const standing = { uid: 41, hull: 2 };
  const called = [];
  const host = createFleetHost({ csa: () => ({ AllBoats: [standing], state: {} }), naval: () => ({ refitBoat: (b) => called.push(b) }), pack: () => [] });
  host.restat();
  assert.deepEqual(called.map((b) => b.uid).sort(), [41, 42], 'every ship of mine');
  assert.equal(called.find((b) => b.uid === 41), standing, 'the standing boat herself');
  assert.equal(called.find((b) => b.uid === 42).hull, 3, 'the laid-up one by her number and hull');
  // the real host: her state read on the page, then a sky accepted
  const s = await sea({ hull: HULL.SmallShip, pool: await freshPool(), settings: { ShipsAtSea: 'off' } });
  let k = 1;
  s.deps.refit = () => ({ hull: k, guns: 1 });
  const laid = { uid: 77, hull: HULL.SmallShip, crewed: true, Cargo: { Items: [] }, laidUp: true };
  const whole = s.host.fleetStatus(laid).maxHull;
  assert.equal(whole, hullBuild(HULL.SmallShip).hullHp);
  k = 1.36;
  s.host.refitBoat({ uid: 77, hull: HULL.SmallShip });
  assert.equal(s.host.fleetStatus(laid).maxHull, Math.round(hullBuild(HULL.SmallShip).hullHp * 1.36), 'her whole made again while she lies up');
  k = 0.9;
  s.host.refitBoat({ uid: 77, hull: HULL.SmallShip });
  assert.equal(s.host.fleetStatus(laid).maxHull, Math.round(hullBuild(HULL.SmallShip).hullHp * 0.9), 'Boarders Away\'s price: her hull under her build\'s');
  assert.match(hostText('src/scenes/naval/navalHost.js'), /const k = \(Number\.isFinite\(refit\) && refit > 0 \? refit : 1\) \* captainsDue\(\)\.guns;[^\n]*\n\s*if \(k === 1\) return;\n\s*if \(Number\.isFinite\(hurt\.hull\)\) hurt\.hull \*= k;/, 'Merchant Prince\'s price on her guns\' harm');   // PIN MOVED (SEA-SET): the refit's factor and the Tidemail's Captain's Due, one product
});

test('AUDIT 2 the stores: conjured steel is never melted; a store\'s OWN ingots go before one another counts too (iron before steel for Iron); a tier\'s stores are taken in the order that pays - the ingots-only first, so 10 steel ingots and 4 steel swords pay a Small Ship\'s Guns Steel (Steel and Iron together); the melt said is the joint take\'s (mutants: the summoned guard, the ingots\' order, the stores\' order, the joint melt)', () => {
  const sword = (o = {}) => ({ group: 'Weapons', templateIndex: 115, material: 1, stackCount: 1, ...o });
  assert.equal(meltable(sword()), true);
  assert.equal(meltable(sword({ timeForItemToDisappear: 600 })), false, 'Create Item\'s steel');
  // Iron's own ingots first
  const pack = [{ templateIndex: 621, stackCount: 4 }, { templateIndex: 620, stackCount: 10 }];
  assert.equal(takeMaterials([pack], 'iron', 10), true);
  assert.deepEqual(pack, [{ templateIndex: 621, stackCount: 4 }], 'the steel ingots left for Steel');
  // the order that pays
  const cost = upgradeCost(HULL.SmallShip, 'guns', 3);
  assert.deepEqual(cost.mats.map((m) => m.kind), ['steel', 'iron'], 'the ore first in the tier\'s list');
  const steelN = cost.mats[0].n, ironN = cost.mats[1].n;
  const lists = () => [[{ templateIndex: 621, stackCount: ironN }, ...Array.from({ length: steelN }, () => sword())]];
  assert.equal(materialsFor(lists(), cost.mats), true, `${ironN} steel ingots for Iron, ${steelN} swords melted for Steel`);
  assert.deepEqual(meltCounts(lists(), cost.mats), [steelN, 0], 'the melt said: the swords');
  const l = lists();
  assert.equal(takeAllMaterials(l, cost.mats), true);
  assert.deepEqual(l, [[]], 'all of it taken');
  const short = [[{ templateIndex: 621, stackCount: ironN }]];
  assert.equal(takeAllMaterials(short, cost.mats), false, 'one store will not serve for two');
  assert.deepEqual(short, [[{ templateIndex: 621, stackCount: ironN }]], 'none taken');
  assert.match(hostText('src/scenes/fleetHost.js'), /takeAllMaterials\(lists, row\.next\.mats\);/);
  assert.match(hostText('src/scenes/fleetHost.js'), /const melts = cost \? meltCounts\(lists, cost\.mats\) : \[\];/);
});

test('AUDIT 2 the QuickDial key over the captain\'s sky: a window that asks is asked - refused, its closer stands on the overlay stack again; let go, the window\'s own close runs; one that does not ask, or none mounted yet, is closed (mutants: the ask, the stand again)', () => {
  clearOverlays();
  let asked = 0, closed = [], fired = false;
  const view = { tryClose: () => (++asked === 1 ? false : (fired = true)) };
  registerOverlay(dialCloser(() => view, () => fired, (why) => closed.push(why), (c) => registerOverlay(c)));
  assert.equal(closeTopOverlay(), true);
  assert.equal(asked, 1);
  assert.equal(overlayOpen(), true, 'refused: up again');
  assert.equal(closeTopOverlay(), true);
  assert.deepEqual([asked, fired, closed], [2, true, []], 'let go by the window\'s own close');
  assert.equal(overlayOpen(), false);
  registerOverlay(dialCloser(() => null, () => false, (why) => closed.push(why), () => assert.fail('never again')));
  closeTopOverlay();
  assert.deepEqual(closed, ['close'], 'none mounted: closed');
  clearOverlays();
  assert.match(rd('src/ui/naval/navalPlunderDoor.js'), /unregister = registerOverlay\(dialCloser\(\(\) => view, \(\) => fired, close, \(closer\) => \{ unregister = registerOverlay\(closer\); \}\)\);/);
});

test('AUDIT 2 the exchange: never buying at what it sells - at the tree\'s most every good\'s buying price stands under its selling; with no stars the board as it was (mutants: the floor)', () => {
  for (let day = 0; day < 60; day++) for (const key of ['10,20', '300,40', '77,88', 'Veilhaven']) for (const crown of ['Daggerfall', 'Wayrest', 'Sentinel', null]) {
    for (const r of exchangeOf({ key, crown }, day, {}, TRADE_MOST)) assert.ok(r.buy < r.sell, `${key} ${day} ${r.id}: ${r.buy} under ${r.sell}`);
    for (const r of exchangeOf({ key, crown }, day, {}, 0)) { const p = priceOf({ key, crown }, r.id, day); assert.deepEqual([r.sell, r.buy], [p.sell, p.buy], 'no stars: the price as it stood'); }
  }
  assert.ok(GOODS.length > 0);
});

// ── THE SEA FIGHT ─────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT 2 a ball on a ship another player stands says her men rounded on its own roll - chain shot\'s share of a man is a man as often as it is owed, never none; my volley\'s tally counts them as her stander reckons them, summed whole and rounded once (mutants: the cut, the toughness, the round)', async () => {
  const sent = [];
  const h = await sea({ hull: HULL.SmallShip, seed: 3, online: { id: () => 'b-player', peers: () => [{ id: 'a-player', feet: [0, 0, 120] }], sendHit: (d) => { sent.push(d); return true; } }, pool: await freshPool(), settings: { ShipsAtSea: 'off', Boarders: false } });
  const w = navalWireRecord({ ships: [{ n: 4, classId: 'merchantGalleon', variant: 0, pos: [0, 0, 120], yaw: Math.PI / 2, speed: 0, sails: 0, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 99, fire: false, gen: 0, region: 17 }] });
  h.host.applyWord('a-player', w, (p) => p);
  h.run(0.3);
  for (let i = 0; i < 60; i++) {
    h.host.applyWord('a-player', w, (p) => p);
    h.host._shots.fireVolley({ id: `c${i}`, shooter: 'me:42', launches: [{ gun: 'long', shot: 'chain', p0: [0, 2, 70], v0: [0, 0.6, 150], delay: 0 }] });
    for (let f = 0; f < 10; f++) h.host.frame(0.05);
  }
  const hull = sent.filter((d) => d?.nv && d.to === 'a-player' && d.nv.z === 0);
  assert.ok(hull.length >= 20, `her hull struck (${hull.length})`);
  const men = hull.reduce((n, d) => n + d.nv.c, 0) / hull.length;
  assert.ok(men > 0.3 && men < 0.9, `chain shot\'s men a hull hit: ${men.toFixed(2)} (the gun\'s 0.6)`);
  // the tally
  const tally = createVolleyTally({ clock: () => 1, onSea: () => true });
  tally.fired('v', 2);
  tally.men({ volley: 'v' }, 0.4); tally.men({ volley: 'v' }, 0.4);
  tally.count({ type: 'hit', volley: 'v', target: 's', zone: 'hull' }); tally.count({ type: 'hit', volley: 'v', target: 's', zone: 'hull' });
  assert.equal(tally.shown(1, 5).men, 1, 'two shares of a man, one man');
  assert.match(hostText('src/scenes/naval/navalHost.js'), /if \(byMe\) tallies\.men\(e, shotMen\(gun, zone\) \/ SHIP_TOUGHNESS\);/);
});

test('AUDIT 2 the wheel: a turn of it steps the load once - a trackpad\'s stream of notches steps once however long it runs, and again only after SHOT_WHEEL_S of quiet; the quiet on the real clock (mutants: the throttle, the clock)', () => {
  let now = 0;
  const loads = [];
  const deck = { load: () => 'round', setLoad: (side, shot) => loads.push(shot) };
  const l = createNavalLoads({ boat: () => ({ hull: HULL.SmallShip }), deck: () => deck, side: () => 'starboard', aiming: () => true, now: () => now });
  for (let i = 0; i < 48; i++) { assert.equal(l.wheel(1), true); now += 1 / 60; }   // 0.8 s of an inertial swipe
  assert.equal(loads.length, 1, `one step, not ${loads.length}`);
  now += SHOT_WHEEL_S + 0.01;
  l.wheel(1);
  assert.equal(loads.length, 2, 'a fresh turn after the quiet');
  assert.match(hostText('src/scenes/naval/navalHost.js'), /aiming: \(\) => aiming, say: \(x, sec\) => deps\.say\?\.\(x, sec\), now: \(\) => realClock \}\);/);
});

test('AUDIT 2 a near miss is told where the ball passed nearest - half a metre, two, four and a half off her side heard at those gaps, not where it first came within NEAR_MISS_M; once a ball (mutants: told at its entry, the kept one never told)', () => {
  const box = { c: [0, 0, 0], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h: [3, 3, 10] };
  for (const lateral of [3.5, 5, 7.5]) {
    const ev = [];
    const f = createShotField({ seaY: () => -50, targets: () => [{ id: 'me', box, ear: true }], onEvent: (e) => ev.push(e), random: () => 0.5 });
    f.fireVolley({ id: 'v', shooter: 'ship', launches: [{ p0: [lateral, 0, -40], v0: [0, 3.27, 60], gun: 'long', index: 0, delay: 0 }] });
    for (let i = 0; i < 400; i++) f.step(1 / 60);
    const passes = ev.filter((e) => e.type === 'pass');
    assert.equal(passes.length, 1, 'once');
    assert.ok(Math.abs(passes[0].gap - (lateral - 3)) < 0.3, `${lateral - 3} m off: told at ${passes[0].gap.toFixed(2)}`);
    assert.ok(Math.abs(passes[0].point[2]) <= 10.5, 'alongside her, not astern');
  }
  // one still closing on her as its life runs out: told as it goes
  {
    const ev2 = [];
    const near = { c: [0, 0, 0], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h: [1, 1, 1] };
    const f2 = createShotField({ seaY: () => -1e6, targets: () => [{ id: 'me', box: near, ear: true }], onEvent: (e) => ev2.push(e), random: () => 0.5 });
    const fall = shotPosition([0, 0, 0], [0, 0, 0], BALL_LIFE)[1];   // her fall over the ball's whole life
    f2.fireVolley({ id: 'v', shooter: 'ship', launches: [{ p0: [2.5, -fall, -3 - 20 * BALL_LIFE], v0: [0, 0, 20], gun: 'long', index: 0, delay: 0 }] });
    for (let i = 0; i < 9.5 * 60; i++) f2.step(1 / 60);
    assert.ok(ev2.some((e) => e.type === 'gone'), 'its life out');
    assert.equal(ev2.filter((e) => e.type === 'pass').length, 1, 'the pass it was still making, told');
  }
  // one that strikes her is no pass
  const ev = [];
  const f = createShotField({ seaY: () => -50, targets: () => [{ id: 'me', box, ear: true }], onEvent: (e) => ev.push(e), random: () => 0.5 });
  f.fireVolley({ id: 'v', shooter: 'ship', launches: [{ p0: [-40, 0, 0], v0: [80, 1, 0], gun: 'long', index: 0, delay: 0 }] });
  for (let i = 0; i < 200; i++) f.step(1 / 60);
  assert.equal(ev.filter((e) => e.type === 'pass').length, 0);
  assert.equal(ev.filter((e) => e.type === 'hit').length, 1);
  assert.ok(NEAR_MISS_M > 4.5);
});

test('AUDIT 2 the blow\'s side and the drench\'s jar are the boat in play\'s - a ball into a moored boat of mine flashes no side on my plate (one into the boat at my helm does); a fall beside a boat I stand on jars me, one beside a boat across the water does not (mutants: any boat\'s blow, any boat\'s jar)', async () => {
  const h = await sea({ hull: HULL.SmallShip, pool: await freshPool(), settings: { ShipsAtSea: 'off', Boarders: false } });
  const moored = h.pool.spawnNow(Object.assign(new (h.boat.constructor)(HULL.SmallShip, 0), { uid: 43 }), { position: [300, 0, 0], rotation: [0, 0, 0, 1] });
  moored.GameObject.position = [300, 0, 0];
  h.runtime.state.AllBoats.push(moored);
  h.run(0.3);
  const st = h.host._myState(moored), whole = st.damage.hull;
  h.log.shake.length = 0;
  h.host._shots.fireVolley({ id: 'm', shooter: 'pirate:9', launches: [{ gun: 'long', p0: [300, 1.5, -60], v0: [0, 0.6, 150], delay: 0 }] });
  for (let i = 0; i < 20; i++) h.host.frame(0.05);
  assert.ok(st.damage.hull < whole, 'the moored boat struck');
  assert.equal(h.host._feel.blow(), null, 'a moored boat struck: no side flashed');
  assert.deepEqual(h.log.shake, [], 'nor my eye jarred');
  h.host._shots.fireVolley({ id: 'h', shooter: 'pirate:9', launches: [{ gun: 'long', p0: [0, 1.5, -60], v0: [0, 0.6, 150], delay: 0 }] });
  for (let i = 0; i < 20; i++) h.host.frame(0.05);
  assert.notEqual(h.host._feel.blow(), null, 'the boat at my helm struck: her side flashed');
  assert.ok(h.log.shake.length > 0, 'and her deck jarred under me');
  const shakes = [];
  let feet = [0, 0, 0];
  const feel = createNavalFeel({ effects: { drench() {} }, sound() {}, shake: (k) => shakes.push(k), feet: () => feet, mine: () => false,
    myHulls: () => [{ id: 'me:1', box: { c: [0, 0, 0], ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], h: [2, 2, 6] } }], myBoats: () => [] });
  feel.splashed([3, 0, 0]);
  assert.equal(shakes.length, 1, 'aboard her');
  assert.ok(shakes[0] <= NEAR_SHAKE);
  feet = [0, 0, 6 + DRENCH_FEET_M + 1];
  feel.splashed([3, 0, 0]);
  assert.equal(shakes.length, 1, 'off her: her deck is not mine');
});

test('AUDIT 2 a copy first seen already going down is heard as nothing and blows no magazine - one seen going down is, once (mutants: the fresh copy unheeded)', async () => {
  let seed = 1;
  while (magazineOf(seed) == null) seed++;
  const h = await sea({ hull: HULL.SmallShip, online: { id: () => 'b-player', peers: () => [], sendHit: () => true }, pool: await freshPool(), settings: { ShipsAtSea: 'off', Boarders: false } });
  const word = (state) => navalWireRecord({ ships: [{ n: 1, classId: 'pirateBrig', variant: 0, pos: [0, 0, 120], yaw: 0, speed: 0, sails: 0, hull: 0, sail: 1, crew: 1, state, heel: 0, seed, fire: true, gen: 0, region: 17 }] });
  h.log.sounds.length = 0;
  for (let t = 0; t < MAGAZINE_DELAY[1] + 1; t += 0.5) { h.host.applyWord('a-player', word('sinking'), (p) => p); h.run(0.5); }
  const said = (k) => h.log.sounds.filter(([key]) => key === k).length;
  assert.deepEqual([said(NAVAL_CLASSIC.bubbles), said(NAVAL_SFX.blast)], [0, 0], 'sailed into sight of her going down: nothing heard');
});

// ── HOW SHE LOOKS ─────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT 2 a flag past the pass\'s cap: the boat flies her pennant - only the flags handed to the pass leave their pennants out; and each flag carries her fade, its cloth dissolving with her hull (mutants: the cap, the fade)', () => {
  const boat = (uid, fade) => ({ uid, hull: 2, fade, GameObject: { activeSelf: true }, FlagObject: { position: [uid, 10, 0], forward: [0, 0, 1] } });
  const mine = Array.from({ length: 8 }, (_, i) => boat(i + 1, i === 0 ? 0.5 : undefined));
  const peers = Array.from({ length: 22 }, (_, i) => ({ boat: boat(100 + i), flag: FLAG_DEFAULT }));
  const h = createShipFlagHost({ myBoats: () => mine, coloursOf: () => FLAG_DEFAULT, peerFlags: () => peers, shown: () => true });
  h.frame();
  const all = [...mine, ...peers.map((p) => p.boat)];
  assert.equal(h.draws().length, FLAGS_MAX);
  assert.equal(all.filter((b) => h.flies(b)).length, FLAGS_MAX, 'the rest fly their pennants');
  assert.equal(h.draws()[0].fade, 0.5, 'her fade');
  assert.equal(h.draws()[1].fade, 1);
  assert.match(rd('src/render/shipFlagPass.js'), /if \(t\.a < 0\.5\) discard;   \/\/ the shape's cut\n\s*dissolveCut\(\);/);
  assert.match(rd('src/render/shipFlagPass.js'), /gl\.uniform1f\(U\.uDissolveCut, 1 - Math\.max\(0, Math\.min\(1, Number\.isFinite\(f\.fade\) \? f\.fade : 1\)\)\);/);
});

test('AUDIT 2 a sea ship\'s paint only on the meshes it repaints - a shared model none of whose pictures it changes is drawn by the host\'s own remap (the renderer\'s cache keyed on it), one it repaints by her paint; asked once a mesh and a paint (mutants: every mesh painted)', () => {
  const p = createLiveryPaint({ renderer: null, pipeline: null, log: { warn() {} } });
  const base = new Map([['1_1', '1_2']]), own = new Map([['67_0', '38191_5']]), joined = new Map([...base, ...own]);
  const plank = { subMeshes: [{ textureArchive: 67, textureRecord: 0 }] }, lantern = { subMeshes: [{ textureArchive: 210, textureRecord: 3 }] };
  assert.equal(p.remapFor(plank, own, base), own, 'her planks: her paint');
  assert.equal(p.remapFor(lantern, own, base), base, 'a lantern she does not paint: the host\'s');
  assert.equal(p.remapFor(lantern, base, base), base);
  assert.equal(p.remapFor(plank, joined, base), joined, 'a map the shop did not join: read whole - her planks in it');
  assert.equal(p.remapFor(lantern, joined, base), base, 'and a lantern none of it repaints but the host\'s own keys: the host\'s');
  assert.match(rd('src/scenes/comeSailAway/comeSailAwayPool.js'), /if \(texRemap !== drawRemap\) texRemap = paints\.remapFor\(gpu, texRemap, drawRemap\);/);
});

test('AUDIT 2 the boats\' word is said again for a name board shown or taken down; another\'s cabin is as built (her stain her captain\'s ledger\'s); a hidden boat shows no name boards (mutants: the key, the guest, the hidden)', () => {
  const rec = { b: [[2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]], n: ['Gull'] };
  assert.notEqual(csaRecordKey({ ...rec, p: [1] }), csaRecordKey(rec), 'her board: a new word');
  assert.notEqual(csaRecordKey({ b: rec.b, p: [1] }), csaRecordKey({ b: rec.b }));
  assert.match(rd('src/scenes/sailingCabin.js'), /restyle: cabinRestyle\(guest \? 0 : fleetShip\(cabin\.uid\)\?\.cabin \?\? 0\)/);
  assert.match(hostText('src/scenes/worldModes.js'), /sailingCabinEntry\(blocks, saved, host\.sailingCabin\.fromNative, typeof visit\?\.cabinOwner === 'string'\)/);
  assert.match(rd('src/scenes/comeSailAway/comeSailAwayPool.js'), /const shown = boat\.GameObject\?\.activeSelf && boat\.MeshObject\?\.activeSelf \? plaqueNameOf\(boat\) : null;/);
});

test('AUDIT 2 a fitting\'s whole box on the plan: its turned corners on her deck and clear of every other\'s - a crate over her rail, or set into another, refused; the centre\'s own law kept for a model still loading; and every fitting\'s model asked, loaded or not (the ask pins it) (mutants: the corners, the overlap, the turn, the pin)', () => {
  const deck = { walkable: (x, z) => Math.abs(x) <= 2 && Math.abs(z) <= 6 };
  const fp = () => [1, 1];
  assert.equal(placeRefusal(deck, [1.8, 0], [], { m: 41815, yaw: 0 }, fp) != null, true, 'hung over her rail');
  assert.equal(placeRefusal(deck, [1.4, 0], [], { m: 41815, yaw: 0 }, fp), null, 'flush with it');
  assert.equal(placeRefusal(deck, [1.8, 0], []), null, 'no box known: the centre alone');
  assert.equal(placeRefusal(deck, [0, 0], [{ m: 41815, x: 0.8, z: 0, yaw: 0 }], { m: 41815, yaw: 0 }, fp) != null, true, 'set into another');
  assert.equal(placeRefusal(deck, [0, 0], [{ m: 41815, x: 1.1, z: 0, yaw: 0 }], { m: 41815, yaw: 0 }, fp), null, 'beside it');
  const long = () => [0.6, 2.4];
  assert.equal(placeRefusal(deck, [1.4, 0], [], { m: 41815, yaw: 0 }, long), null, 'a long crate fore and aft');
  assert.equal(placeRefusal(deck, [1.4, 0], [], { m: 41815, yaw: 4 }, long) != null, true, 'turned a quarter, over her rail');
  const a = fittingCorners(0, 0, 2, [1, 1]), b = fittingCorners(1.2, 0, 2, [1, 1]);
  assert.equal(boxesMeet(a, b), true, 'two turned an eighth, their corners in each other');
  assert.equal(boxesMeet(fittingCorners(0, 0, 0, [1, 1]), fittingCorners(1.2, 0, 0, [1, 1])), false);
  assert.match(rd('src/ui/deckPlanWindow.js'), /const why = placeRefusal\(deck, \[f\.x, f\.z\], list\.filter\(\(_, i\) => i !== picked\), \{ m: f\.m, yaw \}, footprint\);\n\s*if \(why\) \{ tell\(why, true\); return; \}/, 'turned as it is set');
  const asked = [];
  const boat = { hull: 2, MeshObject: { children: [], addChild() {}, worldMatrix: () => new Float32Array(16) } };
  fitBoats([boat], () => fittingsOf([{ m: 41812, x: 0, z: 0 }]), { ctx: { modelBounds: () => ({ min: [0, 0, 0], max: [1, 1, 1] }) }, deckOf: () => null, load: (m) => asked.push(m) });
  assert.deepEqual(asked, [41812], 'a loaded one asked too');
});

// ── THE HOLD, THE WAY, THE PAD ─────────────────────────────────────────────────────────────────────────────────────

test('AUDIT 2 a packed ship\'s hold: her parts stored in her own hold come back to the pack as it shuts, and nothing weighs on them (PARTS-WEIGHT, FIELD BUGS 2026-10-18e: her timbers alone, open, shut or refused); a Rowboat\'s plunder opens; the hold key passes over a Rowboat with nothing aboard and a ship with no door to her (mutants: the parts, the rowboat, the fallback)', () => {
  const pack = [];
  let opened = null, openOk = true;
  const parts = { templateIndex: 9999, UID: 2, weightInKg: 120 };
  const items = [{ weightInKg: 25 }];
  const ships = [{ uid: 8, hull: 2 }, { uid: 2, hull: 3 }, { uid: 5, hull: 0 }];   // 8 first: no door to her
  const rowboat = { uid: 5, hull: 0, Cargo: { Items: [] } };
  const door = createHoldDoor({
    csa: () => ({ AllBoats: [rowboat], laidUpHold: (u) => (u === 2 ? items : []), isSailing: () => false, state: {} }),
    aboard: () => rowboat, cabin: () => null, ships: () => ships,
    partsOf: (u) => (u === 2 && !items.includes(parts) ? parts : null), toPack: (it) => pack.push(it),
    openHold: (loot) => { opened = loot; return openOk; }, nameOf: () => '', say() {},
  });
  assert.equal(door.openShip(2), true);
  items.push(parts);   // her parts stored into her own hold
  opened.onClose();
  assert.deepEqual(pack, [parts], 'back in the pack');
  assert.equal(items.includes(parts), false);
  assert.equal(parts.weightInKg, 120, 'her timbers alone as it shuts (a Large Galley\'s)');
  openOk = false;
  assert.equal(door.openShip(2), false);
  assert.equal(parts.weightInKg, 120, 'a refused door: her timbers alone');
  // the Rowboat at hand: nothing aboard - the key goes on to a ship with a door (8 has none: not standing, no parts, no title)
  openOk = true; opened = null;
  door.press();
  assert.equal(opened?.items?.(), items, 'the first of mine with a door: the packed galley');
  rowboat.Cargo.Items.push({ name: 'silk' });
  door.press();
  assert.equal(opened.items(), rowboat.Cargo.Items, 'her plunder opens');
  assert.match(hostText('src/scenes/world.js'), /toPack: \(it\) => addItem\(\(playerEntity\.items \?\?= \[\]\), it\),/, 'the world\'s pack');
});

test('AUDIT 2 the peace bonus holds no chase: a ship that has sighted me and comes on past HOSTILE_NEAR_M is a fight; the hold\'s key on a pad button (mutants: the chase unread, the row)', () => {
  assert.match(hostText('src/scenes/world.js'), /peaceWayOf\(\{ enemies: !!this\.enemiesNearby\(\) \|\| !!naval\?\.threats\?\.\(\)\.some\(\(t\) => t\.chasing\),/);
  assert.deepEqual(PLUS_BIND_ROWS.find((r) => r.id === 'hold'), { id: 'hold', label: 'Ship\'s hold', sec: 'ShipHold' });
});
