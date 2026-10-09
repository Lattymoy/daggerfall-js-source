// AUDIT HOLDINGS (2026-10-03, Mac: "Audit this, ensure its perfection", of PR #549's HOLDINGS arc - the Holdings tab,
// the Stable, the Fleet, refits, names, crew roles and the ports' quays; bible/01-Overview/Audit-Holdings.md). Every
// finding re-run before it was fixed, and pinned here: each pin fails on the build it fixes.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene, terrain } from './csaScene.mjs';
import { sea, readyPool } from './navalSea.mjs';
import {
  titleDeed, titleOf, fleetBook, fleetShip, knowShip, retitle, forgetShip, loanOwed, settleCredit, restoreFleetSaveData, _resetFleetForTests,
} from '../src/systems/fleet.js';
import { mintDeed, mintBoatItem, BOAT_PARTS_TEMPLATE } from '../src/systems/comeSailAwayItems.js';
import { PARTS_STANDING_TEXT } from '../src/systems/comeSailAway.js';
import { createFleetHost } from '../src/scenes/fleetHost.js';
import { Boat } from '../src/systems/comeSailAwayBoat.js';
import { createShipCrew } from '../src/systems/naval/shipCrew.js';
import { createCrewLife, LOOKOUT_YIELD } from '../src/systems/naval/crewLife.js';
import { MOBILE } from '../src/systems/naval/navalBoarding.js';
import { FRAME_ROLES } from '../src/ui/enhancedFrame.js';
import { stableProviderFor } from '../src/ui/holdingsPages.js';
import { findHarbour, alongside, stepErrand, createWaterGrid, BERTH_SNAP_M } from '../src/systems/naval/shipLife.js';
import { quatOfYaw, createSeaShip } from '../src/systems/naval/navalAI.js';
import {
  dockFor, gangwayFoot, planQuay, quayFrame, sceneToQuay, DOCK_REFUSED, GANGWAY_SLOPE, GANGWAY_ASHORE, GANGWAY_FACING, GANGWAY_CLEAR, GANGWAY_BACK,
  GANGWAY_LANE, QUAY_GAP, QUAY_WIDTH, QUAY_DECK_UP, QUAY_KERB_W, QUAY_KERB_H,
} from '../src/systems/naval/quays.js';
import { buildQuayModel } from '../src/world/quayModel.js';
import { trs } from '../src/world/mat4.js';
import { Collider } from '../src/player/collider.js';
import { raycastColliders, BUILTIN_COLLIDER_MESHES } from '../src/world/prefabColliders.js';
import { createQuayPool, QUAY_RETRY_S } from '../src/scenes/quayPool.js';
import { hullBoxOf } from '../src/scenes/navalHost.js';
import { whereWords } from '../src/ui/fleetPage.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const AT = [100, 34, 200], DIR = [0, 0, 1];

/** Come Sail Away's real runtime with the world host's item seams - the pack, the Fleet's book and its retitle. */
function csaWithBook() {
  _resetFleetForTests();
  const s = scene({ terrains: [terrain(10, 20), terrain(11, 20)] });
  const pack = [];
  let uid = 7000;
  s.deps.items = {
    create: (t) => mintBoatItem(t, ++uid), addToPlayer: (it) => pack.push(it), player: () => pack,
    titles: () => fleetBook(), retitle: (boat, parts) => { knowShip(boat.uid, boat.hull, boat.variant, parts?.value); return !!retitle(boat.uid); },
  };
  s.deps.cargoWeight = (items) => items.reduce((a, it) => a + (it.weightInKg ?? 0), 0);
  s.deps.isPortTown = () => true;
  return Object.assign(s, { pack });
}
/** The Fleet's host half over it, a berth or none, every refusal open. */
function fleetOver(s, berth = { position: [300, 34, 300], direction: [1, 0, 0], harbour: 'Sentinel' }, accounts = []) {
  return createFleetHost({
    csa: () => s.rt, naval: () => ({ fleetStatus: () => null, hostileNear: () => false, freeBerth: () => berth, boatInPlay: () => null }),
    pack: () => s.pack, gold: () => 0, accounts: () => accounts, where: () => ({ inside: false, pixel: { X: 10, Y: 20 }, feet: [100, 34, 190] }),
    nearPort: () => true, nearestPort: () => ({ name: 'Daggerfall' }), terrainAt: () => s.terrains[0],
  });
}

// ── THE FLEET ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT HOLDINGS F1: a ship picked up has her title leave the book with her - her parts anywhere but the pack draw no card and Summon stands none, so her parts placed are the one boat of her number; parts whose boat already stands are refused (StartPlacing says so, LaunchFromParts stands none)', () => {
  const s = csaWithBook();
  titleDeed(mintDeed(2, 0, 600, 100000));
  const b = s.rt.LaunchFromDeed(titleOf(600), () => fleetBook(), AT, DIR, s.terrains[0]);
  assert.equal(s.rt.PackBoat(b, true), true);
  assert.equal(titleOf(600), null, 'her title went with her');
  const parts = s.pack.pop();   // sold, chested, dropped
  const host = fleetOver(s);
  assert.deepEqual(host.model().ships.map((r) => r.where), [], 'no card: her parts are her');
  assert.equal(host.act(600, 'summon').ok, false, 'Summon stands no second');
  assert.equal(s.rt.AllBoats.filter((x) => x.uid === 600).length, 0);
  const one = s.rt.LaunchFromParts(parts, () => [parts], AT, DIR, s.terrains[0]);
  assert.ok(one, 'her parts placed');
  assert.ok(titleOf(600), 'her title back in the book');
  const copy = { ...parts };
  assert.equal(s.rt.LaunchFromParts(copy, () => [copy], [400, 34, 400], DIR, s.terrains[0]), null, 'a copy of her parts stands none');
  s.rt.StartPlacing(copy, [copy]);
  assert.equal(s.rt.placing, false, 'nor starts a placing');
  assert.equal(s.out.mid.at(-1)[0], PARTS_STANDING_TEXT);
  assert.equal(s.rt.AllBoats.filter((x) => x.uid === 600).length, 1, 'one boat of her number');
});

test('AUDIT HOLDINGS F2: a small boat afloat elsewhere called with no berth is placed from a deed of the moment in its own list - the book never takes a title for her while she stands; the page\'s sweep never enters the deed a placing holds', () => {
  const s = csaWithBook();
  titleDeed(mintDeed(1, 2, 610, 8000));
  const b = s.rt.LaunchFromDeed(titleOf(610), () => fleetBook(), [1000, 34, 200], DIR, s.terrains[1]);
  assert.equal(titleOf(610), null, 'a small boat\'s title spent on her placing');
  b.GameObject.activeSelf = false; b.MapPixel = { X: 15, Y: 20 };
  const host = fleetOver(s, null);
  const r = host.act(610, 'summon');
  assert.ok(r.ok && typeof r.door === 'function', 'the placing\'s door');
  r.door();
  assert.ok(s.rt.placing && s.rt.state.placeItem.UID === 610);
  assert.equal(titleOf(610), null, 'never minted into the book');
  s.rt.StopPlacing();   // a click on land, a fast travel
  assert.equal(titleOf(610), null, 'nor left there');
  // a deed placed from the pack while the page sweeps
  const deed = mintDeed(1, 0, 620, 9000);
  s.pack.push(deed);
  s.rt.StartPlacing(deed, () => s.pack);
  host.model();
  assert.ok(s.pack.includes(deed) && !titleOf(620), 'the placing\'s deed left where it lies');
});

test('AUDIT HOLDINGS F3: a Large Boat\'s rig picked again is hers - her record and her title follow it as she stands, and she is laid up and called back in it', () => {
  const s = csaWithBook();
  titleDeed(mintDeed(1, 1, 630, 8000));
  const b = s.rt.LaunchFromDeed(titleOf(630), () => fleetBook(), [100, 34, 220], DIR, s.terrains[0]);
  b.variant = 5;   // the picker's
  const host = fleetOver(s);
  host.model();
  assert.equal(fleetShip(630).variant, 5, 'the sweep reads her rig');
  b.variant = 3;   // picked again with the page open - no sweep between
  assert.equal(host.act(630, 'away').ok, true);
  assert.equal(titleOf(630).message, 13, 'sent away in the rig she stands in - her title her rig');
  knowShip(630, 1, 9, 1);
  assert.equal(fleetShip(630).variant, 3, 'a rig no Large Boat has is no rig');
});

test('AUDIT HOLDINGS F4: the bank\'s claim - a small boat\'s, restored from a save made while SHIP-CREDIT stood (F5: bought as parts on credit), cleared once her bank is owed nothing (settleCredit) - and the page\'s own sweep settles it (SHIP-CREDIT WITHDRAWN 2026-10-08: no purchase stamps one now)', () => {
  _resetFleetForTests();
  const parts = (uid) => ({ uid, hull: 0, variant: 0, value: 300, name: '', upgrades: {}, credit: { region: 3, due: 50 }, port: null, title: false });
  restoreFleetSaveData({ v: 1, ships: [parts(640)] });
  const r = fleetShip(640);
  const accounts = Array.from({ length: 62 }, () => ({ loanTotal: 0, loanDueDate: 0 }));
  accounts[3] = { loanTotal: 300, loanDueDate: 50 };
  assert.deepEqual(loanOwed(r, accounts), { region: 3, owed: 300 });
  accounts[3].loanTotal = 0;
  assert.equal(settleCredit(accounts), 1);
  assert.equal(r.credit, null);
  // the page's own sweep settles it: owed, kept; owed nothing, cleared
  const s = csaWithBook();
  restoreFleetSaveData({ v: 1, ships: [parts(641)] });
  const owed = fleetShip(641);
  accounts[3].loanTotal = 300;
  const host = fleetOver(s, undefined, accounts);
  host.model();
  assert.deepEqual(owed.credit, { region: 3, due: 50 }, 'owed: kept');
  accounts[3].loanTotal = 0;
  host.model();
  assert.equal(owed.credit, null, 'owed nothing: cleared at the sweep');
});

test('AUDIT HOLDINGS F6: a boat called out of a dungeon\'s water to a port is shown outdoors', () => {
  const s = csaWithBook();
  titleDeed(mintDeed(2, 0, 650, 1));
  const b = s.rt.LaunchFromDeed(titleOf(650), () => fleetBook(), AT, DIR, s.terrains[0]);
  b.inside = true;
  s.rt.SummonBoat(650, titleOf(650), fleetBook(), [300, 34, 300], [1, 0, 0], s.terrains[0]);
  assert.equal(b.inside, false);
  assert.equal(b.GameObject.activeSelf, true);
});

test('AUDIT HOLDINGS F8: a claim that failed forgets her record with her title; the Fleet\'s port reach is the setting\'s; a deed off the keyed shelf goes to the book', () => {
  _resetFleetForTests();
  titleDeed(mintDeed(2, 0, 660, 1));
  forgetShip(660);
  assert.deepEqual([fleetShip(660), titleOf(660)], [null, null]);
  const host = read('src/scenes/navalHost.js'), world = read('src/scenes/world.js'), modes = read('src/scenes/worldModes.js');
  assert.match(host, /if \(!boat\) \{ const list = pack\(\), i = list\.indexOf\(deed\); if \(i >= 0\) list\.splice\(i, 1\); deps\.board\?\.forgetDeed\?\.\(deed\); return false; \}/);
  assert.match(world, /nearPort: \(\) => !!csaRuntime\.IsNearPort\(csaPortRange\(\)\),/);
  assert.match(world, /const csaPortRange = \(\) => \{ try \{ return Number\(modSetting\(COME_SAIL_AWAY_VENDOR, 'Controls\.PortLocationSearchRange'\) \?\? 3\) \| 0; \} catch \{ return 3; \} \};/);
  assert.match(modes, /else if \(!\(it\?\.templateIndex === FLEET_DEED_TEMPLATE && titleDeed\(it, \{ port: buildingDirectory\?\.\(\)\?\.locationName \? \{ name: buildingDirectory\(\)\.locationName \} : null \}\)\)\) addItem\(playerEntity\.items, it\);/);
});

// ── THE CREW ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const ROSTER = [{ mobile: MOBILE.Warrior, gender: 'male' }, { mobile: MOBILE.Bard, gender: 'female' }, { mobile: MOBILE.Archer, gender: 'male' }, { mobile: MOBILE.Monk, gender: 'female' }];

test('AUDIT HOLDINGS C2: with none named Lookout her bow goes to a hand with no post, else to the one whose post matters least (a Gunner before her Cook, her Carpenter, her Bosun) - the Small Ship\'s dealt Bosun keeps his mainmast; never a First Mate made from her hands while another will do; no roles, her first hand past her captain as ever', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const c = createShipCrew({ seed: 4 });
  c.sync(ROSTER);
  const roles = c.hands.map((h) => h.role);
  assert.deepEqual(roles, ['First Mate', 'Bard', 'Bosun', 'Gunner'], 'the Small Ship\'s four as dealt');
  const life = createCrewLife({ deck, roster: ROSTER, seed: 3 });
  life.step(0.05, { roles });
  assert.equal(life.lookout().i, 3, 'her Gunner keeps the bow');
  assert.ok(life.postOf(2), 'her Bosun his post');
  assert.deepEqual([...LOOKOUT_YIELD], ['Gunner', 'Cook', 'Carpenter', 'Bosun']);
  const life2 = createCrewLife({ deck, roster: ROSTER, seed: 3 });
  life2.step(0.05, { roles: ['Deckhand', 'Bard', 'First Mate', 'Bosun'] });
  assert.equal(life2.lookout().i, 3, 'her Bosun before a First Mate made from her hands');
  const life3 = createCrewLife({ deck, roster: ROSTER, seed: 3 });
  life3.step(0.05, { roles: ['First Mate', 'Bard', 'Bosun', 'Deckhand'] });
  assert.equal(life3.lookout().i, 3, 'a hand with no post first');
  const plain = createCrewLife({ deck, roster: ROSTER, seed: 3 });
  plain.step(0.05, {});
  assert.equal(plain.lookout().i, 2, 'no roles: her first hand past her captain who can look (never her Bard)');
});

test('AUDIT HOLDINGS C3: a Bard keeps no lookout - refused, never "her Lookout now" while another keeps her bow', () => {
  const c = createShipCrew({ seed: 4 });
  c.sync(ROSTER);
  const bard = c.hands.find((h) => h.mobile === MOBILE.Bard);
  assert.deepEqual(c.assign(bard.name, 'Lookout'), { ok: false, text: `${bard.name} leads her songs - he keeps no lookout.` });
  assert.equal(bard.role, 'Bard');
});

test('AUDIT HOLDINGS C8: a Gunner past her guns stands beside one, never on its man\'s spot; a holder gone holds no place - the next stands at the post', async () => {
  const pool = await readyPool();
  const deck = pool.deckOf(4, 0);
  const roster = Array.from({ length: 11 }, () => ({ mobile: MOBILE.Warrior, gender: 'male' }));
  const roles = ['First Mate', ...Array(9).fill('Gunner'), 'Deckhand'];   // nine Gunners at her six guns
  const life = createCrewLife({ deck, roster, seed: 5 });
  life.step(0.05, { roles, lookout: -1 });
  assert.equal(life.lookout().i, 10, 'her Deckhand at her bow');
  const spots = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => life.postOf(i)?.at).filter(Boolean);
  assert.equal(spots.length, 9, 'every Gunner a place');
  for (let a = 0; a < spots.length; a++) for (let b = a + 1; b < spots.length; b++) assert.ok(Math.hypot(spots[a][0] - spots[b][0], spots[a][2] - spots[b][2]) > 0.5, `gunners ${a} and ${b} apart`);
  // two Bosuns, the first gone: the second at the post
  const roles2 = ['First Mate', 'Bosun', 'Bosun', 'Deckhand'];
  const r4 = roster.slice(0, 4);
  const l2 = createCrewLife({ deck, roster: r4, seed: 5 });
  l2.step(0.05, { roles: roles2, lookout: 3 });
  const first = l2.postOf(1).at, second = l2.postOf(2).at;
  assert.notDeepEqual(first, second);
  l2.members[1].gone = true;
  assert.deepEqual(l2.postOf(2).at, first, 'the post his now');
});

// ── THE TAB AND THE STABLE ────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT HOLDINGS C1: no note in FRAME_ROLES swallows a selector - every selector the source names is a selector the kit dresses (the Companions page\'s slots, faces and chips, the HUD\'s quick chips, the Features search, the cards)', () => {
  const src = read('src/ui/enhancedFrame.js');
  const a = src.indexOf('export const FRAME_ROLES'), b = src.indexOf('\n});', a);
  const text = src.slice(a, b);
  for (const line of text.split('\n')) {
    if (!line.includes('//')) continue;
    assert.doesNotMatch(line.slice(line.indexOf('//')), /'[.#a-z][^']*',/, `a selector inside a note: ${line.trim().slice(0, 100)}`);
  }
  for (const [role, sel] of [['chip', '.hud-qspell'], ['chip', '.px-sys .cmp-mood'], ['well', '.px-sys .cmp-slot'], ['well', '.shell .ft-search'], ['panel', '.px-sys .card'], ['panel', '.hmcard'], ['panel', '.px-sys .hld-row']]) {
    assert.ok(FRAME_ROLES[role].includes(sel), `${role}: ${sel}`);
  }
});

test('AUDIT HOLDINGS C4: four tabs never cut on a narrow window - the strip wraps as a last resort, tighter under 900 px and 660 px (the diamonds gone); measured in Chromium over 320-1280 px, one row from 320', () => {
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.px-tabs \{ display: flex; flex-wrap: wrap; justify-content: center; gap: 4px;/);
  assert.match(css, /@media \(max-width: 900px\) \{\n  \.px-tabs button \{ font-size: 18px; letter-spacing: 0\.1em; text-indent: 0\.1em; padding: 6px 10px; gap: 6px; \}\n\}/);
  assert.match(css, /@media \(max-width: 660px\) \{\n  \.px-tabs button \{ font-size: 15px; letter-spacing: 0\.06em; text-indent: 0\.06em; padding: 6px 6px; gap: 0; \}\n  \.px-tabs button \.px-c \{ display: none; \}\n\}/);
});

test('AUDIT HOLDINGS C5/C6: a horse never named, renamed with nothing, keeps no name - said as his, never "You do not own a horse"; an empty Holdings rail says so, never the Stable\'s "you own no horse"', () => {
  let name = '';
  const runtime = { renameHorse: (v) => (owns ? (name = String(v ?? '').trim() || name) : null), stableView: () => ({}) };
  let owns = true;
  const p = stableProviderFor({ runtime, on: () => true, hasHorse: () => owns, hasCart: () => false });
  assert.deepEqual(p.stableAct('rename', '  '), { ok: false, text: 'Your horse keeps no name - give him one.' });
  assert.deepEqual(p.stableAct('rename', 'Shadowmere'), { ok: true, text: 'Your horse is called Shadowmere.' });
  owns = false;
  assert.deepEqual(p.stableAct('rename', 'X'), { ok: false, text: 'You do not own a horse.' });
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /if \(!secs\.length\) \{\n    detail\.append\(el\('div', 'px-qverdict', 'Nothing here to hold'\)/);
});

// ── THE QUAYS ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The coast: land north of z = 200, and a headland x 300-400 reaching south to z = -300 (quays.test.js's). */
const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
const HARBOUR = findHarbour({ rect: TOWN, isWater: coast });
const DEG = Math.PI / 180;

/** The real naval host over the coast, my boat (`hull`) at the helm, the port near - quays.test.js's dockSea. */
async function dockSea(o = {}) {
  const h = await sea({ hull: o.hull ?? 2, water: coast, settings: { ShipsAtSea: o.ships ?? 'off', ...(o.settings ?? {}) } });
  h.log.docked = [];
  h.deps.harbourNear = () => ({ key: 'port:1', name: 'Sentinel', rect: TOWN });
  h.deps.dockedPort = (b, port) => h.log.docked.push([b.uid, port]);
  h.deps.shipName = () => 'Sea Witch';
  h.boat.GameObject.position = [5000, 0, 5000];
  h.view.feet = [5000, 0, 5000];
  h.run(0.2);
  const hb = h.host.harbourList();
  assert.equal(hb.length, 1, 'the harbour found');
  return { ...h, harbour: hb[0].harbour };
}
/** Lay my boat `d` m off berth `i`'s alongside place for her hull, turned `off` from its line. */
function layOff(h, i, d, off = 0) {
  const b = h.harbour.berths[i], at = alongside(b, h.boat.hull, h.harbour.hull);
  h.boat.GameObject.position = [at[0] + b.normal[0] * d, 0, at[1] + b.normal[1] * d];
  h.boat.GameObject.rotation = quatOfYaw(b.yaw + off);
  return b;
}
/** Come Sail Away's half of the warp: the host's step laid on her for `seconds`. */
function warpFor(h, seconds) {
  for (let t = 0; t < seconds; t += 0.1) {
    const w = h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 });
    if (!w) return;
    h.boat.GameObject.position = [w.pos[0], h.boat.GameObject.position[1], w.pos[1]];
    h.boat.GameObject.rotation = w.rotation;
  }
}

test('AUDIT HOLDINGS O1: a harbour is sounded only once every pixel its scan reads is built (the world\'s `ready`) - never off a half-streamed shore, where a pixel not built reads as land and two players coming by different roads found different berths', async () => {
  const h = await sea({ hull: 2, water: coast, settings: { ShipsAtSea: 'off' } });
  let ready = false;
  h.deps.harbourNear = () => ({ key: 'port:1', name: 'Sentinel', rect: TOWN, ready: () => ready });
  h.boat.GameObject.position = [5000, 0, 5000]; h.view.feet = [5000, 0, 5000];
  h.run(0.5);
  assert.deepEqual(h.host.harbourList(), [], 'not sounded while its shore streams');
  ready = true;
  h.run(0.2);
  assert.deepEqual(h.host.harbourList().map((x) => x.harbour.berths.map((b) => b.pos)), [HARBOUR.berths.map((b) => b.pos)], 'sounded once it is built - the berths every client finds');
  const world = read('src/scenes/world.js');
  assert.match(world, /for \(let i = 0; i <= nx; i\+\+\) for \(let k = 0; k <= nz; k\+\+\) if \(!csaPixelAt\(x0 \+ \(sx \* i\) \/ nx, z0 \+ \(sz \* k\) \/ nz\)\) return false;/);
  assert.match(world, /return \{ key: `port:\$\{t\.id\}`, name: t\.name, rect, ready \};/);
});

test('AUDIT HOLDINGS Q1: the gangway runs square to her side at her waist and touches nothing but where it rests - every edge, face and rope of it clear of her colliders and of the quay\'s, a ship\'s climbing from the deck at GANGWAY_SLOPE, a boat\'s stepping down from the kerb\'s edge onto her gunwale over the water; the cargo never in its lane', async () => {
  for (const hull of [0, 1, 2, 4]) {
    const h = await dockSea({ hull });
    const b = layOff(h, 0, 0);
    h.runtime.sailing = false;
    const g = h.host.gangways()[0];
    assert.ok(g, `hull ${hull}: run out`);
    const seaY = h.deps.seaY();
    const plan = planQuay({ berth: b, hull: h.harbour.hull, key: 'port:1', index: 0, seaY, groundAt: (x, z) => (coast(x, z) ? seaY - 8 : seaY + 3) });
    const col = new Collider();
    const model = buildQuayModel(plan);
    col.addMesh('quay', model.positions, model.indices, trs(b.pos[0], seaY, b.pos[1], 0, plan.frame.theta / DEG, 0));
    const geometry = (c) => (c.m_Mesh?.mesh ? h.pool.models?.geometry(c.m_Mesh.mesh) ?? null : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] ?? null : null);
    const d = [0, 1, 2].map((k) => g.head[k] - g.foot[k]), L = Math.hypot(...d), dir = d.map((v) => v / L), flat = Math.hypot(dir[0], dir[2]);
    const lat = [dir[2] / flat, 0, -dir[0] / flat], up = [-dir[0] * dir[1] / flat, flat, -dir[2] * dir[1] / flat];
    // its underside and top at both edges and its middle, and its ropes - from its foot to its head and back
    for (const [off, rise] of [[-0.45, 0.004], [0, 0.004], [0.45, 0.004], [-0.45, 0.078], [0.45, 0.078], [-0.42, 0.75], [0.42, 0.75]]) {
      for (const [from, way] of [[g.foot, dir], [g.head, dir.map((v) => -v)]]) {
        const o = [0, 1, 2].map((k) => from[k] + lat[k] * off + up[k] * rise + way[k] * 0.03);
        assert.equal(raycastColliders(h.boat.GameObject, o, way, L - 0.06, { triggers: false, geometry }), null, `hull ${hull}: clear of her (${off}, ${rise})`);
        assert.equal(col.raycast(o, way, L - 0.06), Infinity, `hull ${hull}: clear of the quay (${off}, ${rise})`);
      }
    }
    const f = quayFrame(b, h.harbour.hull), x0 = f.halfWidth + QUAY_GAP;
    const [fx, fz] = sceneToQuay(f, g.foot[0], g.foot[2]), [hx, hz] = sceneToQuay(f, g.head[0], g.head[2]);
    assert.ok(Math.abs(fz - hz) < 1e-9, `hull ${hull}: square to her`);
    // PIN MOVED (SHIPS-2, 2026-10-07): hull 1 is Mac's Tiny Ship - her gunwale 2.25 m over the sea, over the quay's kerb
    // (1.75), so her plank climbs from the deck as a ship's (onto her cap's outer edge: quays.js GANGWAY_SIDE)
    if (hull >= 1) {
      // PIN MOVED (GALLEON-HOLDINGS): a ship's climbs from the deck at GANGWAY_SLOPE - but a head too high for that on the
      // quay (Mac's galleon's at 6.7 m wants 8.8 m of run, and the quay is 4.5 m deep) stops GANGWAY_BACK short of its back
      // and climbs steeper: hers alone of the hulls that dock
      // (SHIPS-2: a head as low as the Tiny Ship's, 0.66 m over the deck, wants 1.14 m of run - its foot GANGWAY_CLEAR in
      // from the face, the plank gentler)
      const slope = Math.atan2(g.head[1] - g.foot[1], fx - hx) / DEG, back = Math.abs(fx - (x0 + QUAY_WIDTH - GANGWAY_BACK)) < 1e-9;
      const clear = Math.abs(fx - (x0 + GANGWAY_CLEAR)) < 1e-9;
      // (SHIPS-2: Mac's carrack's entry port too, its sill 7.94 m up)
      assert.equal(back, hull === 2 || hull === 4, `hull ${hull}: ${back ? 'stopped at' : 'clear of'} the quay's back`);
      assert.equal(clear, hull === 1, `hull ${hull}: ${clear ? 'held at' : 'past'} GANGWAY_CLEAR`);
      assert.ok((back ? slope > GANGWAY_SLOPE : clear ? slope < GANGWAY_SLOPE : Math.abs(slope - GANGWAY_SLOPE) < 1e-6) && Math.abs(g.foot[1] - seaY - QUAY_DECK_UP) < 1e-9, `hull ${hull}: up from the deck at GANGWAY_SLOPE, steeper from GANGWAY_BACK or gentler from GANGWAY_CLEAR (${slope.toFixed(2)} degrees)`);
    } else {
      assert.ok(Math.abs(fx - x0) < 1e-9 && Math.abs(g.foot[1] - seaY - QUAY_DECK_UP - QUAY_KERB_H) < 1e-9 && g.head[1] < g.foot[1], `hull ${hull}: down from the kerb's edge`);
    }
    const foot = gangwayFoot(hx, g.head[1] - seaY, x0, x0 + QUAY_WIDTH);
    assert.ok(Math.abs(foot.x - fx) < 1e-9 && Math.abs(foot.y - (g.foot[1] - seaY)) < 1e-9, `hull ${hull}: gangwayFoot's`);
  }
  // the cargo never in the gangway's lane, across the ports and their berths
  for (let k = 0; k < 24; k++) for (const i of [0, 1, 2]) {
    const q = planQuay({ berth: HARBOUR.berths[i], hull: HARBOUR.hull, key: `port:${k}`, index: i, seaY: 34, groundAt: (x, z) => (coast(x, z) ? 26 : 37) });
    for (const c of q.cargo) assert.ok(Math.abs(c.z) >= GANGWAY_LANE, `port:${k} berth ${i}: clear of the gangway's lane (${c.z.toFixed(2)})`);
  }
  assert.deepEqual([GANGWAY_CLEAR, GANGWAY_BACK, GANGWAY_LANE, QUAY_KERB_W, QUAY_KERB_H], [2, 1, 1.6, 0.3, 0.15]);
});

test('AUDIT HOLDINGS Q2: no quay takes a Large Galley - half again a Carrack\'s berth - she is never warped in (dockFor) and a galley summoned has no berth (freeBerth: the placing click), as the sea\'s own galleys never moor', async () => {
  assert.deepEqual([...DOCK_REFUSED], [3]);
  const b = HARBOUR.berths[0], at = alongside(b, 3, HARBOUR.hull), at2 = alongside(b, 2, HARBOUR.hull);
  const berths = [{ key: 'port:1', index: 0, berth: b, hull: HARBOUR.hull, free: true }];
  assert.equal(dockFor({ pos: [at[0], 0, at[1]], yaw: b.yaw, hull: 3 }, berths), null, 'a galley alongside: no dock');
  assert.ok(dockFor({ pos: [at2[0], 0, at2[1]], yaw: b.yaw, hull: 2 }, berths), 'a Small Ship there: docks');
  const h = await dockSea({ hull: 3 });
  h.view.feet = [b.pos[0], 0, b.pos[1] + 30];
  assert.equal(h.host.freeBerth(3), null, 'no berth for a galley');
  assert.ok(h.host.freeBerth(2), 'one for a ship');
  layOff(h, 0, 6, 5 * DEG);
  assert.equal(h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 }), null, 'never warped in');
});

test('AUDIT HOLDINGS Q4: the gangway takes no press the ray gives her own helm, hold or door (`boatTrigger` - Come Sail Away\'s trigger first under it); ashore only by her rail there (GANGWAY_ASHORE), never from anywhere on a small deck, and the look square to the land (GANGWAY_FACING)', async () => {
  const h = await dockSea();
  layOff(h, 0, 0);
  h.runtime.sailing = false;
  const g = h.host.gangways()[0];
  const toShip = [-g.landward[0], 0, -g.landward[1]], toLand = [g.landward[0], 0, g.landward[1]];
  const stand = (at, dir) => { h.view.feet = [...at]; h.view.look = { origin: [at[0], at[1] + 1.6, at[2]], dir }; };
  stand(g.foot, toShip);
  assert.equal(h.host.takesActivate(), true);
  assert.equal(h.host.takesActivate({ boatTrigger: true }), false, 'her own trigger under the ray');
  const placed = h.log.placed.length;
  assert.equal(h.host.activate({ boatTrigger: true }), false);
  assert.equal(h.log.placed.length, placed, 'never went aboard over it');
  // ashore: by her rail there, looking at the land
  stand(g.deckAt, toLand);
  assert.equal(h.host.takesActivate(), true, 'at her rail');
  const inboard = (m) => [g.deckAt[0] + toShip[0] * m, g.deckAt[1], g.deckAt[2] + toShip[2] * m];
  assert.deepEqual([GANGWAY_ASHORE, GANGWAY_FACING], [1.5, 0.7]);
  stand(inboard(1.3), toLand);
  assert.equal(h.host.takesActivate(), true, 'within GANGWAY_ASHORE');
  stand(inboard(1.8), toLand);
  assert.equal(h.host.takesActivate(), false, 'past it - her deck\'s, not the gangway\'s (it was 4 m: all of a small deck)');
  const turn = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), 0, -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
  stand(g.deckAt, turn(toLand, 42 * DEG));
  assert.equal(h.host.takesActivate(), true, 'square enough');
  stand(g.deckAt, turn(toLand, 50 * DEG));
  assert.equal(h.host.takesActivate(), false, 'looking along her (it was 60 degrees)');
  assert.match(read('src/scenes/world.js'), /naval\?\.activate\(\{ boatTrigger: !!_race\.boatWins \}\)/);
});

test('AUDIT HOLDINGS Q5: a ship coming in looks at her berth again on the way - taken since she chose it, another free berth, else out to sea (shipLife.js arrive); the berth my ship is warped in to is taken from the warp\'s first step, though she lies past BERTH_SNAP_M of it', async () => {
  const grids = new Map();
  const grid = (hl) => grids.get(hl) ?? (grids.set(hl, createWaterGrid({ isWater: coast, hull: hl })), grids.get(hl));
  const ctxOf = (taken) => ({ harbour: (k) => (k === 'port' ? HARBOUR : null), grid, free: (_k, i) => !taken.has(i), harbours: () => [] });
  const b0 = HARBOUR.berths[0];
  const comer = () => { const s = createSeaShip({ id: 's', seed: 5, classId: 'navyCutter', pos: [b0.approach[0], 0, b0.approach[1] - 60], yaw: 0 }); s.errand = { kind: 'arrive', harbour: 'port', berth: 0, path: null, i: 0 }; return s; };
  let ship = comer();
  stepErrand(ship, 0.1, ctxOf(new Set([0])));
  assert.deepEqual([ship.errand.kind, ship.errand.berth !== 0], ['arrive', true], 'another free berth');
  ship = comer();
  stepErrand(ship, 0.1, ctxOf(new Set(HARBOUR.berths.map((_, i) => i))));
  assert.notEqual(ship.errand?.kind, 'arrive', 'every one taken: out');
  ship = comer();
  stepErrand(ship, 0.1, ctxOf(new Set()));
  assert.deepEqual([ship.errand.kind, ship.errand.berth], ['arrive', 0], 'free: hers still');
  // the host: the warp's berth taken while she is still DOCK_REACH_M off it
  const h = await dockSea();
  const b = layOff(h, 0, BERTH_SNAP_M + 4);
  h.view.feet = [b.pos[0], 0, b.pos[1] + 20];
  const near0 = (fb) => fb && Math.hypot(fb.position[0] - alongside(b, 2, h.harbour.hull)[0], fb.position[2] - alongside(b, 2, h.harbour.hull)[1]) < 1;
  assert.ok(near0(h.host.freeBerth(2)), 'free before the warp');
  assert.ok(h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 }), 'warped in');
  assert.ok(!near0(h.host.freeBerth(2)), 'taken from the warp\'s first step');
  // a ship of the sea coming in is never put off her berth by her own errand (berthFree's `except`)
  const h2 = await dockSea();
  h2.view.feet = [0, 0, 150];
  const id = h2.host.spawnShip('navyCutter', { range: 400, bearing: Math.PI });
  const e = h2.host._sea.get(id);
  const b1 = h2.harbour.berths[1];
  e.ship.pos = [b1.approach[0], 0, b1.approach[1] - 80];
  e.ship.errand = { kind: 'arrive', harbour: 'port:1', berth: 1, path: null, i: 0 };
  h2.run(0.5);
  assert.deepEqual([e.ship.errand?.kind, e.ship.errand?.berth], ['arrive', 1], 'her own berth still');
});

test('AUDIT HOLDINGS Q8: the Fleet\'s word of where she lies is "nowhere" only where it is known - a harbour forgotten (a door, a jump) leaves her port standing; under way, she sailed', async () => {
  const h = await dockSea();
  layOff(h, 0, 6, 5 * DEG);
  warpFor(h, 30);
  assert.equal(h.host.dockedAt(h.boat), 'Sentinel');
  h.run(1.2);
  assert.deepEqual(h.log.docked.at(-1), [42, 'Sentinel']);
  h.host.clear();   // through a door and back: the harbours forgotten
  h.deps.harbourNear = () => null;
  const said = h.log.docked.length;
  h.run(2.5);
  assert.deepEqual(h.log.docked.slice(said).filter(([, p]) => p == null), [], 'her port kept');
  h.runtime.state.velocityCurrent = [0, 0, 3];
  h.run(1.2);
  assert.deepEqual(h.log.docked.at(-1), [42, null], 'under way: she sailed');
});

test('AUDIT HOLDINGS Q9: a quay\'s lay that failed is laid again QUAY_RETRY_S later; the gangway\'s mesh made again when it would not build, freed with the quays; no gangway onto a quay not laid; the warp and the gangway\'s word forgotten with the sea; the word said once a coming, though the look swings; an unnamed port\'s quay reads made fast', async () => {
  const log = { made: [], destroyed: [] };
  let fail = 1, now = 0;   // the next `fail` meshes asked for will not build
  const w = { gangways: [] };
  const renderer = {
    createMesh: (m) => { if (fail-- > 0) throw new Error('no mesh'); const g = { m }; log.made.push(g); return g; },
    destroyMesh: (g) => log.destroyed.push(g), drawMesh: () => {},
  };
  const col = { addMesh() {}, removeBucket() {} };
  const pool = createQuayPool({
    renderer, prepare: async () => {}, collider: () => col, harbours: () => [{ key: 'port:1', name: 'Sentinel', harbour: HARBOUR }], seaY: () => 34,
    groundAt: (x, z) => (coast(x, z) ? 26 : 37), feet: () => [0, 34, 150], mode: () => 'exterior', gangways: () => w.gangways, now: () => now,
  });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  pool.frame(); await settle();
  const n = HARBOUR.berths.length;
  assert.equal(log.made.length, n - 1, 'one berth\'s mesh would not build');
  assert.equal(pool.laid('port:1', 0), false);
  now = QUAY_RETRY_S - 0.1; pool.frame(); await settle();
  assert.equal(log.made.length, n - 1, 'not before QUAY_RETRY_S');
  now = QUAY_RETRY_S + 0.1; pool.frame(); await settle();
  assert.equal(log.made.length, n, 'laid again');
  assert.equal(pool.laid('port:1', 0), true);
  w.gangways = [{ foot: [0, 35.6, 190], head: [0, 38, 186] }];
  fail = 1;
  pool.draw(); await settle();
  assert.equal(log.made.length, n, 'the gangway would not build');
  pool.draw(); await settle();
  const way = log.made[n];
  assert.ok(way, 'made again');
  pool.destroyAll();
  assert.ok(log.destroyed.includes(way), 'freed with the quays');
  // the host: no gangway onto a quay not laid
  const h = await dockSea();
  layOff(h, 0, 0);
  h.runtime.sailing = false;
  h.deps.quayLaid = () => false;
  assert.deepEqual(h.host.gangways(), [], 'not laid: none');
  h.deps.quayLaid = () => true;
  const g = h.host.gangways()[0];
  assert.ok(g);
  // the word: once a coming, though the look swings away and back
  const toShip = [-g.landward[0], 0, -g.landward[1]];
  h.view.feet = [...g.foot];
  h.log.say.length = 0;
  for (const dir of [toShip, [g.landward[0], 0, g.landward[1]], toShip]) { h.view.look = { origin: [g.foot[0], g.foot[1] + 1.6, g.foot[2]], dir }; h.run(0.3); }
  assert.equal(h.log.say.filter((s) => /The gangway to the Sea Witch/.test(s)).length, 1, 'said once');
  // the warp forgotten with the sea: said again as she is next taken in
  h.runtime.sailing = true;
  layOff(h, 0, 10, 5 * DEG);
  h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 });
  h.host.clear();
  h.run(0.2);
  h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 });
  assert.equal(h.log.say.filter((s) => /warp her in/.test(s)).length, 2, 'said again after the sea was cleared');
  assert.deepEqual(whereWords({ where: 'away', docked: '', metres: null }), { state: 'Made fast', tone: 'is-away', line: 'Made fast at a quay.' });
});

// ── THE REFUSALS AND THE GUNS ─────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT HOLDINGS D2: every refusal the page names is said - Send away: laid up already, another player aboard, fighting, at her helm, packed; Refit and the Shipwright: fighting, away from this port; Repair: her hands fighting her, packed', () => {
  const s = csaWithBook();
  const w = { hostile: false, inFight: false, aboard: 0 };
  const host = createFleetHost({
    csa: () => s.rt,
    naval: () => ({
      fleetStatus: () => ({ hull: 100, maxHull: 200, sail: 50, maxSail: 100, crew: 10, maxCrew: 20, wrecked: false, fire: false, stores: {}, inFight: w.inFight, wants: true, barrels: 0 }),
      hostileNear: () => w.hostile, freeBerth: () => ({ position: [300, 34, 300], direction: [1, 0, 0], harbour: 'Sentinel' }), boatInPlay: () => null,
      repairAway: () => ({ ok: true, text: 'Mended.' }), openYard: () => true,
    }),
    pack: () => s.pack, gold: () => 1e6, accounts: () => [], where: () => ({ inside: false, pixel: { X: 10, Y: 20 }, feet: [100, 34, 190] }),
    nearPort: () => true, nearestPort: () => ({ name: 'Daggerfall' }), terrainAt: () => s.terrains[0], passengersAboard: () => w.aboard,
  });
  titleDeed(mintDeed(2, 0, 700, 1), { port: { name: 'Wayrest' } });
  assert.equal(host.act(700, 'away').text, 'She is laid up already.');
  assert.equal(host.act(700, 'summon').ok, true);
  assert.equal(fleetShip(700).port, null, 'AUDIT HOLDINGS Q8: called away from where she lay - the docking says her port again');
  const boat = s.rt.GetPlacedBoatWithUID(700);
  w.aboard = 1;
  assert.equal(host.act(700, 'away').text, 'Another player is aboard her.');
  w.aboard = 0; w.hostile = true;
  assert.equal(host.act(700, 'away').text, 'Not while she is fighting.');
  assert.equal(host.act(700, 'refit', 'hull').text, 'Not while she is fighting.');
  assert.equal(host.act(700, 'yard').text, 'Not while she is fighting.');
  w.hostile = false; w.inFight = true;
  assert.equal(host.act(700, 'repair').text, 'Her hands are fighting her.');
  w.inFight = false;
  s.rt.StartSailing(boat);
  assert.equal(host.act(700, 'away').text, 'Not while you are at her helm.');
  s.rt.StopSailing();
  boat.GameObject.activeSelf = false; boat.MapPixel = { X: 15, Y: 20 };   // afar
  assert.equal(host.act(700, 'refit', 'hull').text, 'Bring her to this port first.');
  assert.equal(host.act(700, 'yard').text, 'Bring her to this port first.');
  boat.GameObject.activeSelf = true; boat.MapPixel = { X: 10, Y: 20 };
  assert.equal(s.rt.PackBoat(boat, true), true);
  assert.equal(host.act(700, 'repair').text, 'She is in your pack.');
  assert.equal(host.act(700, 'away').text, 'She is in your pack.');
});

test('AUDIT HOLDINGS T1: her Guns refit lands - a ball of hers takes its share more off a ship\'s hull (her refit read by her number off the shooter); a ball of a boat of mine with none, as ever', async () => {
  const loss = async (refit, shooter = 'me:42') => {
    const s = await sea({ hull: 2, settings: { ShipsAtSea: 'off', Boarders: false } });
    s.deps.refit = refit;
    const id = s.host.spawnShip('pirateBrig', { range: 70, bearing: Math.PI / 2, yaw: 0 });
    const e = s.host._sea.get(id);
    e.ship.pos = [70, 0, 0];
    s.host.frame(0.1);
    const h0 = e.ship.damage.hull;
    const box = hullBoxOf(e.boat, s.pool.models);
    s.host._shots.fireVolley({ id: 'v1', shooter, launches: [{ gun: 'long', index: 0, p0: [box.c[0] - 40, 4, box.c[2]], v0: [80, 0.4, 0], delay: 0 }] });
    s.run(1);
    return h0 - e.ship.damage.hull;
  };
  const base = await loss(() => null);
  const better = await loss((b) => (b?.uid === 42 ? { hull: 1, guns: 1.24, cargo: 1, speed: 1 } : null));
  const another = await loss((b) => (b?.uid === 7 ? { hull: 1, guns: 1.24, cargo: 1, speed: 1 } : null));
  const hers7 = await loss((b) => (b?.uid === 7 ? { hull: 1, guns: 1.24, cargo: 1, speed: 1 } : null), 'me:7');   // a second boat of mine, her own refit
  assert.ok(base > 0, 'struck');
  assert.equal(hers7, better, 'each boat of mine by her own number');
  // the harm is counted whole (navalDamage.js apply: `hurt.hull | 0`) - the refit's share more of what the ball took
  assert.ok(better >= Math.floor(base * 1.24) && better <= Math.floor((base + 1) * 1.24), `her share more (${base} -> ${better})`);
  assert.equal(another, base, 'another boat\'s refit is not hers');
});

test('AUDIT HOLDINGS T5: another player\'s boat lying at a berth takes it - my ship is never warped in to it nor brought round to it; no warp with a hostile ship near me', async () => {
  const h = await dockSea();
  const b0 = h.harbour.berths[0];
  h.view.feet = [b0.pos[0], 0, b0.pos[1] + 30];
  const at0 = alongside(b0, 2, h.harbour.hull);
  const to0 = (fb) => !!fb && Math.hypot(fb.position[0] - at0[0], fb.position[2] - at0[1]) < 1;
  assert.ok(to0(h.host.freeBerth(2)), 'free: brought round to it');
  layOff(h, 0, 10);
  assert.ok(h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 }), 'and warped in to it');
  h.boat.GameObject.position = [5000, 0, 5000];
  h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 });   // cast off
  const peer = h.pool.spawnPeerNow(Object.assign(new Boat(2, 0), { uid: 9001 }));
  peer.GameObject.position = [at0[0], 0, at0[1]];
  assert.ok(!to0(h.host.freeBerth(2)), 'another player\'s lies there: never brought round to it');
  layOff(h, 0, 10);
  assert.equal(h.host.warp(h.boat, { struck: true, oars: false, dt: 0.1 }), null, 'nor warped in to it');
  h.pool.remove(peer);
  // a hostile ship near me: her hands at the guns, never the warps
  const h2 = await dockSea();
  layOff(h2, 0, 10);
  assert.ok(h2.host.warp(h2.boat, { struck: true, oars: false, dt: 0.1 }));
  const p = h2.boat.GameObject.position;
  h2.view.feet = [p[0], 0, p[2]];   // at her helm
  const id = h2.host.spawnShip('pirateBrig', { range: 150, bearing: 0 });
  h2.host._sea.get(id).ship.pos = [p[0] + 150, 0, p[2]];
  assert.equal(h2.host.warp(h2.boat, { struck: true, oars: false, dt: 0.1 }), null, 'a pirate by her');
});
