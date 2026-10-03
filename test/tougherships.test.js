// TOUGHER-SHIPS, QUICK-REPAIRS, SALVAGE (2026-10-03, Mac: "For naval combat and such I want to buff health of ships,
// allow for more streamlined repairs, allow sunken vessels to provide nessecary materials so you dont have to rely on
// the port"): every ship stands SHIP_TOUGHNESS times the punishment - her hull, her canvas and her men (a ball's, a
// fire's, a ram's) - with the yard's prices and a store's work moved so a wreck costs what it did, the casks afloat and a
// pirate's run as long in seconds as they were, and a save on her first build's scale that every build reads right; her
// hands spend her stores on their own once a fight is over (past the free mending, and a boat with no hand aboard only
// under her captain's own) and the order MAKE REPAIRS works with an enemy near (DAMAGE CONTROL); a sunk ship leaves her
// wreckage afloat - carpenter's stores and powder for whoever hauls it in. AUDIT TOUGHER-SHIPS (Mac: "Lets audit this.
// Must be perfect") pinned each of the audit's findings here.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea } from './navalSea.mjs';
import { HULL, HULL_BUILDS, SHIP_CLASSES, SHIP_TOUGHNESS, hullBuild, firstBuildOf, classById, BARREL } from '../src/systems/naval/navalShips.js';
import { createShipDamage, shotDamage, shotMen, ballMen, repairCost, REPAIR_PRICE, FIRE_CREW_S, FIRE_SECONDS, FIRE_HP, SHIP_STATES, STRUCK_AT } from '../src/systems/naval/navalDamage.js';
import { storesToWhole, paidDamage, STORE_POINTS, STORE_PRICE, FIELD_QUIET_S, FIELD_MEND_CAP, FIELD_MEND_PER_S, SEA_REPAIR_PER_S, SEA_REPAIR_UNDER_FIRE } from '../src/systems/naval/navalYard.js';
import { salvageOf, flotsamKeys, isSalvage, SALVAGE_LOT, SALVAGE_SHARE, SALVAGE_BARRELS, LOT_KEYS } from '../src/systems/naval/navalPlunder.js';
import { navalWireRecord, validNavalRecord, navalHitData, NAVAL_HIT_MAX } from '../src/systems/naval/navalWire.js';
import { FLOTSAM_LIFE } from '../src/systems/naval/navalShots.js';
import { PIRATE_RUNS_AT } from '../src/systems/naval/navalAI.js';
import { mintStores, storesIn, spendStore, isStores } from '../src/systems/naval/navalStores.js';
import { savedHurts, savedRecord, ramMen, ramMenSaid, RAM_A_MAN, STRUCK_GRACE_S } from '../src/scenes/navalHost.js';
import { CREW_ORDERS, mendScaleOf } from '../src/systems/naval/shipCrew.js';
import { FEATURES } from '../src/systems/features.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} (${a} against ${b})`);
const small = HULL_BUILDS[HULL.SmallShip];
/** The mean of `f(roll)` over a fine even grid of rolls. */
const mean = (f) => { let s = 0; for (let i = 0; i < 1000; i++) s += f((i + 0.5) / 1000); return s / 1000; };

/** A boat of mine at sea (a Small Ship unless said), crewed when her hull carries a crew, her hurts a record on her own
 *  scale (her whole said), `stores` in her hold - the hold the yard, the repairs and a wreck's salvage all stow into. */
async function atSea({ hull = small.hullHp, sail = small.sailHp, crew = 24, fire = 0, state = 'afloat', stores = 0, barrels = 4, settings = {}, boatHull = HULL.SmallShip } = {}) {
  const b = hullBuild(boatHull);
  const h = await sea({ hull: boatHull, settings: { ShipsAtSea: 'off', Boarders: false, ...settings } });
  h.boat.crewed = b.crew > 0;
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull, maxHull: b.hullHp, sail, maxSail: b.sailHp, crew, fire, state, barrels } }, notoriety: {}, day: 1, raids: [] });
  const hold = stores ? [mintStores(stores)] : [];
  h.deps.stores = { count: () => storesIn(hold), spend: () => spendStore(hold), add: (_b, n) => { hold.push(mintStores(n)); return true; } };
  h.deps.board.giveItems = (items, to) => { h.log.given.push([items.length, to]); if (to === h.boat) hold.push(...items); else (h.pack ??= []).push(...items); return { left: [] }; };
  h.hold = hold;
  return h;
}
const frames = (h, seconds) => { for (let t = 0; t < seconds - 1e-9; t += 0.1) h.host.frame(0.1); };
const hullOf = (h) => h.host._myState(h.boat).damage.hull;
/** A peer's blow, past one hit's most as several. */
function blow(h, e, from, hull, o = {}) {
  let left = Math.max(0, hull), first = true;
  do {
    const n = Math.min(left, NAVAL_HIT_MAX);
    h.host.applyPeerHit(from, navalHitData('local', first ? { n: e.n, hull: n, ...o } : { n: e.n, hull: n }));
    left -= n; first = false;
  } while (left > 0);
}
function place(h, classId, pos) {
  const e = h.host._sea.get(h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]) }));
  e.ship.pos = [...pos];
  h.host.frame(0.1);
  return e;
}
/** A ship of the sea sunk by me: struck, then past the grace her hull broken. */
function sink(h, e) {
  blow(h, e, 'local', Math.floor(e.ship.damage.hull - 1));
  frames(h, STRUCK_GRACE_S + 1);
  blow(h, e, 'local', Math.ceil(e.ship.damage.hull + 1));
  frames(h, 0.5);
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
}
/** A pirate held where she lies, `at` off my boat, for `seconds`. */
function heldNear(h, id, seconds, at = [0, 0, 200]) {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) { const p = h.host._sea.get(id); p.ship.pos = [...at]; p.ship.speed = 0; h.host.frame(0.1); }
}

// ── TOUGHER-SHIPS ────────────────────────────────────────────────────────────────────────────────────────────────

test('TOUGHER-SHIPS every hull stands SHIP_TOUGHNESS times her first build\'s timbers and canvas; a ball\'s men, a ram\'s and a fire\'s her old loss over the toughness (on the roll, or a fire\'s carried from fire to fire - never nobody); the yard\'s whole for a wreck what it was; the casks afloat and a pirate\'s run as long in seconds as they were (mutants: a hull untoughened, the men untoughened, a fire\'s loss let go, the ram unrolled)', () => {
  assert.equal(SHIP_TOUGHNESS, 1.6);
  for (const [i, b] of HULL_BUILDS.entries()) {
    assert.equal(b.hullHp, Math.round(firstBuildOf(i).hullHp * SHIP_TOUGHNESS), `hull ${i}`);
    assert.equal(b.sailHp, Math.round(firstBuildOf(i).sailHp * SHIP_TOUGHNESS), `canvas ${i}`);
  }
  assert.deepEqual(HULL_BUILDS.map((b) => b.hullHp), [96, 240, 672, 832, 896]);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => firstBuildOf(i).hullHp), [60, 150, 420, 520, 560], 'the numbers they were built with');
  for (const c of SHIP_CLASSES) assert.ok(c.hullHp > firstBuildOf(c.hull).hullHp, `${c.id} toughened with her hull`);
  // a ball's men: the gun's (shotMen - the wire's), whole men, over the toughness on the average of the roll
  const long = { hull: 14, sail: 3, crew: 1 }, swivel = { hull: 5, sail: 2, crew: 2 };
  assert.deepEqual([shotMen(long, 'hull'), shotMen(long, 'holed'), shotMen(swivel, 'hull'), shotMen(swivel, 'rig'), shotMen({ crew: 0 }, 'rig')], [1, 1, 2, 1, 0]);
  for (const men of [0, 1, 2, 3]) {
    near(mean((r) => ballMen(men, r)), men / SHIP_TOUGHNESS, 1e-3, `${men} a ball`);
    assert.ok(Number.isInteger(ballMen(men, 0.37)));
  }
  assert.deepEqual([ballMen(1, 0), ballMen(1, 0.999)], [0, 1], 'the roll decides the odd man');
  near(mean((r) => shotDamage(swivel, 'hull', { roll: r }).crew), 2 / SHIP_TOUGHNESS, 1e-3, 'a swivel ball\'s men');
  near(mean((r) => shotDamage(long, 'rig', { roll: r }).crew), 1 / SHIP_TOUGHNESS, 1e-3, 'a ball through the rigging\'s man aloft');
  // a ram's: a man every RAM_A_MAN of the hull dealt said on the wire, over the toughness on the roll where she is stood
  assert.equal(RAM_A_MAN, 40);
  assert.deepEqual([ramMenSaid(22), ramMenSaid(120)], [1, 3]);
  near(mean((r) => ramMen(22, r)), 22 / RAM_A_MAN / SHIP_TOUGHNESS, 1e-3, 'a bow\'s light ram: a man now and then, never always none');
  near(mean((r) => ramMen(235, r)), 235 / RAM_A_MAN / SHIP_TOUGHNESS, 1e-3, 'a galley\'s');
  // a fire's: a man's worth each FIRE_CREW_S of burning, the toughness's share of a man carried from fire to fire
  assert.equal(FIRE_CREW_S, 10);
  const d = createShipDamage({ hullHp: 5000, sailHp: 0, crew: 40 });
  const lost = [];
  for (let i = 0; i < 8; i++) { d.apply({ hull: 0, sail: 0, crew: 0, fire: true }, 0); d.step(FIRE_SECONDS + 1, 0); lost.push(40 - d.crew); }
  const worth = Math.floor(FIRE_SECONDS / FIRE_CREW_S);   // a man's worth a fire, as it took before
  assert.deepEqual(lost, lost.map((_, i) => Math.floor(((i + 1) * worth) / SHIP_TOUGHNESS)), 'each fire\'s share carried: 0, 1, 1, 2, 3, 3, 4, 5');
  assert.equal(lost[1], 1, 'two fires take a man - one alone never took nobody for ever');
  // the yard and the stores: a wreck costs what it did, and takes as many stores
  assert.deepEqual([REPAIR_PRICE.hull, REPAIR_PRICE.sail, REPAIR_PRICE.crew], [7, 4, 30]);
  const wreck = (b) => ({ hull: 0, maxHull: b.hullHp, sail: 0, maxSail: b.sailHp, crew: 0, maxCrew: 0 });
  const was = 420 * 12 + 160 * 6;
  const now = repairCost(wreck(small));
  assert.ok(now <= was && now >= was * 0.9, `a wrecked Small Ship whole for ${now} (${was} before)`);
  assert.equal(now, 5728);
  assert.equal(STORE_POINTS, 64);
  assert.equal(STORE_PRICE, 314);
  assert.deepEqual([1, 2, 3, 4].map((i) => storesToWhole(wreck(HULL_BUILDS[i]))), [5, 13, 15, 18], 'a Large Boat 5, a Small Ship 13, a galley 15 as before; a Carrack 18 (17 before - canvas at 4 gold to a hull point\'s 7)');
  // what lasts as long as it did in seconds: the casks afloat, a pirate's band between running and striking
  assert.equal(FLOTSAM_LIFE, Math.round(150 * SHIP_TOUGHNESS));
  near((PIRATE_RUNS_AT - STRUCK_AT) * SHIP_TOUGHNESS, 0.33 - 0.25, 1e-9, 'her band as many balls as it was');
});

test('TOUGHER-SHIPS the save keeps a boat on her first build\'s scale - an older build reads her points as they always were, this one the share they are - and a record from before reads as the share of her old whole, her part-spent store\'s credit with it (mutants: the record read as points, the credit unscaled, the save on the toughened scale)', async () => {
  const b = hullBuild(HULL.SmallShip), first = firstBuildOf(HULL.SmallShip);
  const whole = { maxHull: b.hullHp, maxSail: b.sailHp };
  assert.deepEqual(savedHurts({ hull: 210, sail: 80, crew: 20, credit: 30 }, HULL.SmallShip, whole), { hull: b.hullHp / 2, sail: b.sailHp / 2, crew: 20, credit: 30 * SHIP_TOUGHNESS }, 'a record from before: shares of her first build, the credit in her work now');
  assert.deepEqual(savedHurts({ hull: 336, maxHull: 672, sail: 256, maxSail: 256 }, HULL.SmallShip, whole), { hull: 336, maxHull: 672, sail: 256, maxSail: 256 }, 'one that says its whole: as said, no credit made up');
  assert.equal(savedHurts({ hull: 0, sail: 0, state: 'wrecked' }, HULL.SmallShip, whole).hull, 0, 'a wreck a wreck');
  assert.equal(savedHurts({ hull: 60, sail: 0 }, HULL.Rowboat, { maxHull: 96, maxSail: 0 }).sail, 0, 'a rowboat\'s no canvas');
  // the record: her first build's points, to the hundredth
  const dmg = createShipDamage({ hullHp: b.hullHp, sailHp: b.sailHp, crew: 24, player: true });
  dmg.apply({ hull: 336, sail: 64, crew: 0 }, 0);
  const rec = savedRecord(dmg, HULL.SmallShip, 32);
  assert.deepEqual([rec.hull, rec.maxHull, rec.sail, rec.maxSail, rec.credit], [210, first.hullHp, 120, first.sailHp, 20], 'half her hull is 210 of 420 to an older build, as it always was');
  assert.deepEqual(savedHurts(rec, HULL.SmallShip, whole), { ...rec, hull: 336, sail: 192, credit: 32 }, 'and back, the same');
  const nick = createShipDamage({ hullHp: b.hullHp, sailHp: b.sailHp, crew: 24, player: true });
  nick.apply({ hull: b.hullHp - 1, sail: 0, crew: 0 }, 0);
  near(savedHurts(savedRecord(nick, HULL.SmallShip, 0), HULL.SmallShip, whole).hull, 1, 0.02, 'a sliver of hull is still a sliver: never read back a wreck');
  // the host: an older save's whole Small Ship stands whole, and is saved back on her first build's scale
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off' } });
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull: 420, sail: 160, crew: 24, fire: 0, state: 'afloat', barrels: 4, credit: 30 } }, notoriety: {}, day: 1, raids: [] });
  h.host.frame(0.1);
  assert.equal(h.host.hudModel().ship.hull, 1, 'whole, never 62% of a toughened hull');
  assert.equal(h.host._myState(h.boat).credit, 30 * SHIP_TOUGHNESS, 'her part-spent store as much work as it was');
  const back = h.host.getSaveData().boats[42];
  assert.deepEqual([back.hull, back.maxHull, back.sail, back.maxSail, back.credit], [first.hullHp, first.hullHp, first.sailHp, first.sailHp, 30]);
});

// ── SALVAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('SALVAGE a sunk ship\'s wreckage: her stores SALVAGE_SHARE of her hull in a store\'s work (one at least), her powder SALVAGE_BARRELS; never a hold\'s lot; on the wire a key of its own, so a word without it (an older build\'s) reads no wreckage and a word of wreckage alone is still said (mutants: the stores unscaled, the lot among LOT_KEYS, the key unread)', () => {
  assert.equal(SALVAGE_SHARE, 0.4);
  assert.equal(SALVAGE_BARRELS, 2);
  for (const c of SHIP_CLASSES) {
    const s = salvageOf(c);
    assert.equal(s.stores, Math.max(1, Math.round((c.hullHp * SALVAGE_SHARE) / STORE_POINTS)), c.id);
    assert.equal(s.barrels, SALVAGE_BARRELS, `${c.id}: every class carries guns`);
  }
  assert.deepEqual(SHIP_CLASSES.map((c) => salvageOf(c).stores), [2, 4, 4, 6, 1, 3, 5, 4, 5], 'a sloop 2, a brig or a cutter 4, a flagship 6');
  assert.deepEqual(salvageOf(null), { stores: 0, barrels: 0 });
  assert.equal(isSalvage(SALVAGE_LOT), true);
  assert.equal(LOT_KEYS.includes(SALVAGE_LOT), false, 'a lot past an older build\'s LOT_KEYS would fail its door, and the word with it');
  const word = navalWireRecord({ casks: [{ id: 7, pos: [10, 0, 20], from: 'pirateBrig', lot: SALVAGE_LOT }, { id: 8, pos: [12, 0, 20], from: 'pirateBrig', lot: 'S' }] });
  assert.deepEqual(word.w, [[7, 10, 0, 20, SHIP_CLASSES.findIndex((c) => c.id === 'pirateBrig')]]);
  assert.equal(word.f.length, 1);
  const back = validNavalRecord(JSON.parse(JSON.stringify(word)));
  assert.deepEqual(back.casks.map((c) => [c.id, c.lot, c.from]), [[8, 'S', 'pirateBrig'], [7, SALVAGE_LOT, 'pirateBrig']]);
  assert.ok(navalWireRecord({ casks: [{ id: 9, pos: [0, 0, 0], from: 'navyCutter', lot: SALVAGE_LOT }] })?.w, 'a word of wreckage alone');
  assert.equal(validNavalRecord({ ...word, w: [[7, 10, 0, 20, 1, 0]] }), null, 'a malformed piece fails the word');
  const older = { ...word };
  delete older.w;
  assert.equal(validNavalRecord(older).casks.length, 1, 'a word without `w`: no wreckage');
});

test('SALVAGE on the host: a ship sunk leaves her wreckage afloat beside her casks; sailed through, her stores go into my hold and her powder fills my stern\'s barrels to their stock; a boat that rolls no barrels takes the stores alone; a swimmer\'s into his pack a store at a time - never a boat of mine across the water - what the pack cannot carry said; the crew stows mine before the sea goes (mutants: no wreckage, the stores unstowed, the barrels past stock, the swimmer\'s to a far boat, the pack all or nothing, the stow skipping it)', async () => {
  const h = await atSea({ barrels: 3 });
  const e = place(h, 'pirateBrig', [300, 0, 0]);
  sink(h, e);
  const afloat = () => h.host._shots.floaters().filter((f) => f.kind === 'flotsam');
  const wrecks = afloat().filter((f) => isSalvage(f.lot));
  assert.equal(wrecks.length, 1, 'her wreckage');
  assert.equal(wrecks[0].from, 'pirateBrig');
  assert.equal(afloat().length, flotsamKeys(e.ship.cls, e.ship.seed).length + 1, 'beside her casks');
  assert.equal(h.host.drawFrame?.(0, [0, 0, 0])?.floaters?.find((f) => f.id === wrecks[0].id)?.wreck ?? true, true);
  const st = h.host._myState(h.boat);
  h.host._shots.floater(wrecks[0].id).pos = [0, 0, 0];
  frames(h, 0.3);
  const got = salvageOf(classById('pirateBrig'));
  assert.equal(storesIn(h.hold), got.stores, 'her stores in my hold');
  assert.equal(st.guns.barrels, BARREL.stock, 'her powder: my barrels to their stock, never past it');
  assert.ok(h.log.say.includes(`You haul her wreckage aboard: ${got.stores} carpenter's stores and 1 fire barrel.`), h.log.say.join(' | '));
  assert.equal(afloat().some((f) => isSalvage(f.lot)), false, 'hauled in');
  // a Large Boat rolls no barrels: the stores alone
  const lb = await atSea({ boatHull: HULL.LargeBoat, hull: hullBuild(HULL.LargeBoat).hullHp, sail: hullBuild(HULL.LargeBoat).sailHp, crew: 0, barrels: 0 });
  lb.host._shots.dropFlotsam({ id: 'w1', pos: [0, 0, 0], lot: SALVAGE_LOT, from: 'pirateSloop' });
  frames(lb, 0.3);
  assert.equal(storesIn(lb.hold), salvageOf(classById('pirateSloop')).stores);
  assert.equal(lb.host._myState(lb.boat).guns.barrels, 0);
  assert.ok(lb.log.say.includes('You haul her wreckage aboard: 2 carpenter\'s stores.'));
  // a swimmer 50 m off a boat of mine: into his pack, a store a piece
  const s = await atSea();
  s.runtime.sailing = false;
  s.deps.swimming = () => true;
  s.view.feet = [50, 0, 0];
  s.host._shots.dropFlotsam({ id: 'w2', pos: [50.3, 0, 0.2], lot: SALVAGE_LOT, from: 'navyCutter' });
  frames(s, 0.3);
  const cutter = salvageOf(classById('navyCutter')).stores;
  assert.deepEqual(s.log.given, [[cutter, null]], 'into the pack, never the boat across the water');
  assert.equal(storesIn(s.pack), cutter);
  assert.ok(s.pack.every(isStores));
  assert.equal(storesIn(s.hold), 0);
  assert.ok(s.log.say.includes(`You pick through the wreckage: ${cutter} carpenter's stores.`), s.log.say.join(' | '));
  // the pack carries two of four: two said lost; none of two: said, and nothing called worthless
  const part = await sea({ hull: null });
  part.deps.swimming = () => true;
  part.deps.board.giveItems = (items) => ({ left: items.slice(2) });
  part.host._shots.dropFlotsam({ id: 'w3', pos: [0.3, 0, 0.2], lot: SALVAGE_LOT, from: 'navyCutter' });
  part.run(0.3);
  assert.deepEqual(part.log.say.filter((t) => /wreckage|too heavy/.test(t)), ['You pick through the wreckage: 2 carpenter\'s stores.', '2 carpenter\'s stores are too heavy to carry and go down with the wreck.']);
  const full = await sea({ hull: null });
  full.deps.swimming = () => true;
  full.deps.board.giveItems = (items) => ({ left: items });
  full.host._shots.dropFlotsam({ id: 'w4', pos: [0.3, 0, 0.2], lot: SALVAGE_LOT, from: 'pirateSloop' });
  full.run(0.3);
  assert.deepEqual(full.log.say.filter((t) => /wreckage/.test(t)), ['You pick through the wreckage, but 2 carpenter\'s stores are too heavy to carry and go down with the wreck.']);
  // the crew stows my wreckage before the sea goes
  const k = await atSea();
  const sunk = place(k, 'merchantGalleon', [300, 0, 0]);
  sink(k, sunk);
  const r = k.host.stowPlunder();
  assert.equal(storesIn(k.hold), salvageOf(classById('merchantGalleon')).stores, 'her wreckage\'s stores stowed');
  assert.equal(r.casks, flotsamKeys(sunk.ship.cls, sunk.ship.seed).length + 1);
  assert.equal(k.host._shots.floaters().filter((f) => f.kind === 'flotsam').length, 0);
});

test('TOUGHER-SHIPS online: a peer\'s blow says its men BEFORE her toughness - a ball\'s gun\'s, a ram\'s a man each RAM_A_MAN - and whoever stands her reckons it, so a ship falls at one pace whichever build fired (mutants: the toughness reckoned by the shooter, the stander taking the word\'s men whole)', async () => {
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off' } });
  const e = place(h, 'navyGalley', [300, 0, 0]);
  const d = e.ship.damage;
  for (let i = 0; i < 40; i++) h.host.applyPeerHit('peer', navalHitData('local', { n: e.n, hull: 0, crew: 1 }));
  near(d.maxCrew - d.crew, 40 / SHIP_TOUGHNESS, 6, 'forty men said, the toughness\'s share of them lost');
  const host = src('src/scenes/navalHost.js');
  assert.match(host, /deps\.sendHit\?\.\(navalHitData\(target\.owner, \{ n: target\.n, hull: hurt\.hull, sail: hurt\.sail, crew: shotMen\(gun, zone\),/, 'a ball on another\'s ship says the gun\'s men');
  assert.match(host, /if \(e\.owner\) deps\.sendHit\?\.\(navalHitData\(e\.owner, \{ n: e\.n, hull: Math\.min\(400, dealt\), crew: ramMenSaid\(dealt\), zone: 'holed' \}\)\);/, 'a ram on another\'s ship says the ram\'s');
});

// ── QUICK-REPAIRS ────────────────────────────────────────────────────────────────────────────────────────────────

test('QUICK-REPAIRS her hands spend her stores on their own once a fight is over - no order, to whole, said once aboard - paid for past the free mending\'s cap alone (her hull at it paid while her canvas still mends free), never with a hostile near or the switch off; a crewed boat\'s hands wherever she lies (unsaid), a boat with no hand aboard only the one I am on (mutants: the stores spent under the cap, the canvas holding the hull, the quiet unread, the switch unread, a crewless boat mended unmanned, the word for a far boat)', async () => {
  // past the cap: her stores at it, at the repairs' pace, to whole
  const h = await atSea({ hull: Math.round(small.hullHp * 0.7), stores: 10 });
  frames(h, 0.2);
  const h0 = hullOf(h);
  frames(h, 2);
  const pace = SEA_REPAIR_PER_S * mendScaleOf(h.host.crewOf(h.boat).morale) * small.hullHp;
  near(hullOf(h) - h0, pace * 2, pace * 0.05, 'at the repairs\' pace, unordered');
  assert.equal(h.host.hudModel().ship.repairing, true, 'REPAIRING on the plate');
  assert.equal(h.host.crewOf(h.boat).order, CREW_ORDERS.stand, 'no order given');
  frames(h, 60);
  assert.equal(hullOf(h), small.hullHp, 'whole');
  assert.equal(h.log.say.filter((l) => /Repairs done/.test(l)).length, 1, 'said once');
  const left = storesIn(h.hold);
  assert.ok(left < 10 && left >= 10 - Math.ceil((small.hullHp * 0.3) / STORE_POINTS), `her stores spent on the work (${left} left)`);
  frames(h, 5);
  assert.equal(h.log.say.filter((l) => /Repairs done/.test(l)).length, 1, 'and never again');
  // under the cap: the free mending's work, her stores kept
  const t = await atSea({ hull: Math.round(small.hullHp * 0.3), stores: 10 });
  frames(t, 10);
  assert.equal(storesIn(t.hold), 10, 'no store on what her hands do for nothing');
  assert.ok(hullOf(t) > small.hullHp * 0.3, 'the free mending at it');
  // her hull past the cap, her canvas under it: the hull paid at once, the canvas mended free alongside
  const c = await atSea({ hull: Math.round(small.hullHp * 0.6), sail: Math.round(small.sailHp * 0.1), stores: 10 });
  frames(c, 0.2);
  const c0 = hullOf(c), s0 = c.host._myState(c.boat).damage.sail;
  frames(c, 2);
  near(hullOf(c) - c0, pace * 2, pace * 0.05, 'her hull at the stores\' pace');
  near(c.host._myState(c.boat).damage.sail - s0, FIELD_MEND_PER_S * mendScaleOf(c.host.crewOf(c.boat).morale) * small.sailHp * 2, 0.05, 'her canvas at the free pace');
  assert.deepEqual(paidDamage({ hull: 300, maxHull: 672, sail: 20, maxSail: 256 }), { hull: 672, maxHull: 672, sail: 20 + 236, maxSail: 256 }, 'under the cap reads whole');
  assert.deepEqual(paidDamage({ hull: 300, maxHull: 672, sail: 20, maxSail: 256 }, { free: false }), { hull: 300, maxHull: 672, sail: 20, maxSail: 256 }, 'with no free mending, all of it owed');
  // a crewed boat with every hand lost (no free mending): her stores from where she lies
  const z = await atSea({ hull: Math.round(small.hullHp * 0.3), crew: 0, stores: 10 });
  frames(z, 3);
  assert.ok(storesIn(z.hold) < 10 || z.host._myState(z.boat).credit > 0, 'her captain alone at the stores');
  // a hostile near: nothing
  const p = await atSea({ hull: Math.round(small.hullHp * 0.7), stores: 10 });
  const pid = p.host.spawnShip('pirateBrig', { range: 200, temper: 'bold' });
  frames(p, 0.2);
  const p0 = hullOf(p);
  heldNear(p, pid, 3);
  assert.ok(hullOf(p) <= p0, 'no repairs with a pirate in the offing, unordered');
  assert.equal(storesIn(p.hold), 10);
  // the switch off
  const off = await atSea({ hull: Math.round(small.hullHp * 0.7), stores: 10, settings: { AutoRepair: false } });
  frames(off, 5);
  assert.equal(hullOf(off), Math.round(small.hullHp * 0.7), 'off: nothing past the free mending');
  assert.equal(storesIn(off.hold), 10);
  // too few: the stores giving out, said once
  const short = await atSea({ hull: Math.round(small.hullHp * 0.6), stores: 1 });
  frames(short, 30);
  assert.equal(storesIn(short.hold), 0);
  assert.equal(short.log.say.filter((l) => /stores are spent/.test(l)).length, 1);
  assert.ok(hullOf(short) < small.hullHp);
  // a crewed boat I am not on: her hands at it, unsaid
  const far = await atSea({ hull: Math.round(small.hullHp * 0.7), stores: 10 });
  far.runtime.sailing = false;
  far.view.feet = [0, 0, 500];
  frames(far, 60);
  assert.equal(hullOf(far), small.hullHp, 'her hands at the work where she lies');
  assert.deepEqual(far.log.say.filter((l) => /Repairs done|stores are spent/.test(l)), [], 'a boat I am not on mends unsaid');
  // a Large Boat with no hand aboard: only under my own hands, at her helm
  const lbHull = hullBuild(HULL.LargeBoat);
  const away = await atSea({ boatHull: HULL.LargeBoat, hull: Math.round(lbHull.hullHp * 0.7), sail: lbHull.sailHp, crew: 0, stores: 5 });
  away.runtime.sailing = false;
  away.view.feet = [0, 0, 500];
  frames(away, 5);
  assert.equal(storesIn(away.hold), 5, 'nobody aboard her: nothing spent');
  const at = await atSea({ boatHull: HULL.LargeBoat, hull: Math.round(lbHull.hullHp * 0.7), sail: lbHull.sailHp, crew: 0, stores: 5 });
  frames(at, 5);
  assert.ok(storesIn(at.hold) < 5 || at.host._myState(at.boat).credit > 0, 'at her helm: my own hands at the stores');
  assert.equal(FIELD_QUIET_S, 15, 'her hands turn to sooner');
});

test('QUICK-REPAIRS DAMAGE CONTROL: the order MAKE REPAIRS works with an enemy near at SEA_REPAIR_UNDER_FIRE of the pace, her fires left burning and a wreck left a wreck until the fight is over; with none near and only a fire aboard, the order waits for the quiet as it did; out of the fight, the full pace (mutants: the fire doused, the full pace under fire, the order under a fire alone, a wreck refloated under fire)', async () => {
  assert.equal(SEA_REPAIR_UNDER_FIRE, 0.125);
  // a fire aboard, nobody near: the order stands, and waits
  const f = await atSea({ hull: Math.round(small.hullHp * 0.5), stores: 10, fire: 10 });
  frames(f, 0.1);
  assert.equal(f.host.giveOrder(f.boat, CREW_ORDERS.repair).ok, true);
  const fd = f.host._myState(f.boat).damage, f0 = fd.hull;
  frames(f, 2);
  assert.equal(f.host.hudModel().ship.repairing, false, 'no stores into a fire with no enemy near');
  near(fd.hull, f0 - FIRE_HP * 2, 0.2, 'she only burns');
  assert.equal(storesIn(f.hold), 10);
  // an enemy near: damage control at its share of the pace, her fire left to burn
  const h = await atSea({ hull: Math.round(small.hullHp * 0.5), stores: 10, fire: 10 });
  frames(h, 0.1);
  h.host.giveOrder(h.boat, CREW_ORDERS.repair);
  const pid = h.host.spawnShip('pirateBrig', { range: 200, temper: 'bold' });
  heldNear(h, pid, 0.2);
  const d = h.host._myState(h.boat).damage, h0 = d.hull;
  heldNear(h, pid, 2);
  assert.ok(d.fire > 0, 'her fire burns on: a patch is no bucket chain');
  assert.equal(h.host.hudModel().ship.repairing, true);
  const pace = SEA_REPAIR_PER_S * mendScaleOf(h.host.crewOf(h.boat).morale) * small.hullHp;
  near(d.hull - h0, (pace * SEA_REPAIR_UNDER_FIRE - FIRE_HP) * 2, pace * 0.03, 'the pace under fire, less what burns');
  // a wreck under fire: her hull made good, never afloat until the fight is over
  const w = await atSea({ hull: 0, state: 'wrecked', stores: 10 });
  frames(w, 0.1);
  w.host.giveOrder(w.boat, CREW_ORDERS.repair);
  const wid = w.host.spawnShip('pirateBrig', { range: 200, temper: 'bold' });
  heldNear(w, wid, 90);   // an eighth of the pace: past the refloat's share in about 80 s
  const wd = w.host._myState(w.boat).damage;
  assert.ok(wd.hull > small.hullHp * 0.15, `her hull past the refloat (${wd.hull.toFixed(0)})`);
  assert.equal(wd.state, SHIP_STATES.wrecked, 'and a wreck still while the enemy is near');
  w.host._sea.delete(wid);
  frames(w, FIELD_QUIET_S + 1);
  assert.equal(wd.state, SHIP_STATES.afloat, 'the fight over: afloat');
  // the fire out and the quiet come: the full pace
  h.host._sea.delete(pid);
  frames(h, 10 + FIELD_QUIET_S);
  assert.equal(d.fire, 0);
  const h1 = d.hull;
  frames(h, 1);
  near(d.hull - h1, pace, pace * 0.05, 'out of the fight, the full pace');
});

// ── the switch ───────────────────────────────────────────────────────────────────────────────────────────────────

test('QUICK-REPAIRS the Features row\'s Crew repairs on their own, each player\'s own, on by default; the world hands it to the sea as AutoRepair; the wreckage drawn as broken timber (mutants: the row missing, the key unwired)', () => {
  const row = FEATURES.find((r) => r.id === 'naval-combat');
  assert.ok(row.control.also.some((a) => a.key === 'naval-auto-repair' && a.initial === true && a.online === 'player'));
  assert.equal(row.control.parts.find((p) => p.key === 'naval-auto-repair')?.label, 'Crew repairs on their own');
  assert.match(src('src/scenes/world.js'), /key === 'AutoRepair' \? getPref\('naval-auto-repair'\) !== false/);
  assert.match(src('src/render/navalRender.js'), /const wreck = f\.kind === 'flotsam' && !!f\.wreck;/);
  assert.match(src('src/scenes/navalHost.js'), /floaters: shots\.floaters\(\)\.map\(\(f\) => \(isSalvage\(f\.lot\) \? \{ \.\.\.f, wreck: true \} : f\)\)/);
});
