// SHIP-CLAIM (2026-10-01, Mac: "provide more accessibility options to acquiring" ships - and of the choices put to him,
// "Claim captured prizes - Keep a ship you take by boarding as your own boat, instead of scuttling her or casting her
// adrift") - A PRIZE'S THIRD FATE: claimed, she is my boat. The shelf's own deed for her hull and variant, at a quarter of
// her price, in my pack; her boat stood where she lies by Come Sail Away's own placing and linked to that deed; her hold
// aboard her; her hurts as shares and no hand aboard; let go from the sea unsunk; and kept by both saves
// (bible/03-World/Naval-Combat.md SHIP-CLAIM). The host over the sea of test/navalSea.mjs with COME SAIL AWAY'S REAL
// RUNTIME for its boats (test/csaScene.mjs - the real SpawnBoat, placing and save) over the sea's own pool; the window
// on the suite's minimal DOM; the room of test/navalRoom.mjs.
import { byClass, Node_ } from './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea } from './navalSea.mjs';
import { room } from './navalRoom.mjs';
import { scene, terrain } from './csaScene.mjs';
import { HARBOUR_LEAVE, SHIP_FADE_S } from '../src/scenes/navalHost.js';
import { PRIZE_DEED_SHARE, prizeDeedValue } from '../src/systems/naval/navalPlunder.js';
import { mintDeed, mintBoatItem, BOAT_DEED_TEMPLATE, BOAT_PARTS_TEMPLATE } from '../src/systems/comeSailAwayItems.js';
import { HULL_PRICES } from '../src/systems/comeSailAwayBoat.js';
import { hullBuild, classById, firstBuildOf } from '../src/systems/naval/navalShips.js';
import { GRAPPLE_S } from '../src/systems/naval/navalBoarding.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { forwardOfYaw, quatOfYaw } from '../src/systems/naval/navalAI.js';
import { MORALE_START } from '../src/systems/naval/shipCrew.js';
import { FIELD_QUIET_S } from '../src/systems/naval/navalYard.js';
import { NAVAL_CLASSIC } from '../src/systems/naval/navalSounds.js';
import { quatRotate } from '../src/world/quat.js';
import { plunderText, mountNavalPlunderWindow } from '../src/ui/navalPlunderWindow.js';

// The suite's minimal DOM as nav_f_ui drives the window: the `disabled` and `hidden` attributes reflected onto their
// properties, `removeAttribute`, `dataset`.
{
  const proto = Node_.prototype;
  const setAttr = proto.setAttribute;
  proto.setAttribute = function (k, v) { setAttr.call(this, k, v); if (k === 'disabled' || k === 'hidden') this[k] = true; };
  proto.removeAttribute = function (k) { delete this.attrs[k]; if (k === 'disabled' || k === 'hidden') this[k] = false; };
  if (!Object.getOwnPropertyDescriptor(proto, 'dataset')) Object.defineProperty(proto, 'dataset', { get() { return (this._dataset ??= {}); } });
}
const press = (n) => n.dispatch('click', { stopPropagation() {}, preventDefault() {} });

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const closeV = (a, b, eps, msg) => assert.ok(a.length === b.length && a.every((v, i) => close(v, b[i], eps)), `${msg}: ${a} against ${b}`);

/**
 * A sea whose boats are COME SAIL AWAY'S OWN: the runtime of test/csaScene.mjs (two pixels' terrains) over the sea's own
 * pool - my boat, if I have one, on its list and at its helm, the board's helm doors its StartSailing and StopSailing -
 * and the world host's claim seams as scenes/world.js gives them: the mint (9001, 9002 ...), a pack the deed goes into
 * with no gate (the live list answered), the terrain under a point (the second pixel's), the deck's bodies re-decked
 * (said); a hold into the boat it is given; the law said.
 */
function withRuntime(s) {
  const sc = scene({ terrains: [terrain(10, 20), terrain(11, 20)] });
  sc.deps.pool = s.pool;
  const rt = sc.rt;
  if (s.boat) { rt.state.AllBoats.push(s.boat); rt.StartSailing(s.boat); }
  s.deps.csa = () => rt;
  const pack = [];
  let uid = 9000;
  s.log.redecked = [];
  s.log.law = [];
  Object.assign(s.deps.board, {
    leaveHelm: () => { s.log.left++; if (rt.isSailing()) rt.StopSailing(); },
    takeHelm: (b) => { s.log.helm.push(b); rt.StartSailing(b); },
    giveItems: (items, b) => { s.log.given.push([items.length, b]); (b?.Cargo?.Items ?? pack).push(...items); return { left: [] }; },
    mintUid: () => ++uid,
    packDeed: (item) => { pack.push(item); return () => pack; },
    terrainAt: () => sc.terrains[1],
    redeck: (from, to) => s.log.redecked.push([from, to]),
  });
  s.deps.law = { crime: (...a) => s.log.law.push(['crime', ...a]), legal: (...a) => s.log.law.push(['legal', ...a]), faction: (...a) => s.log.law.push(['faction', ...a]) };
  return Object.assign(s, { rt, sc, pack });
}
const claimSea = async (o = {}) => withRuntime(await sea({ hull: 2, ...o }));
/**
 * A ship of `classId` stood abeam of my helm (`variant` her hull's; my boat turned to `yaw` first - she is hauled to lie
 * along my keel), struck - `hull` and `sail` the shares of each she has lost - grappled from my helm, her crew cut down
 * and taken: her entry, and her window's model.
 */
function taken(h, classId = 'pirateBrig', { hull = 0.8, sail = 0.4, variant = 0, yaw = 0 } = {}) {
  h.boat.GameObject.rotation = quatOfYaw(yaw);
  const x = hullBuild(h.boat.hull).beam + hullBuild(classById(classId).hull).beam + 12;
  const e = h.host._sea.get(h.host.spawnShip(classId, { range: x, bearing: yaw + Math.PI / 2, yaw }));
  e.ship.variant = variant;
  h.host.frame(0.1);
  assert.ok(e.boat, 'built');
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * hull), sail: Math.ceil(e.ship.damage.maxSail * sail), crew: 0 });
  assert.equal(e.ship.damage.state, SHIP_STATES.struck);
  h.host.frame(0.1);
  assert.equal(h.host.activate(), true, 'the grapples');
  h.run(GRAPPLE_S + 0.3);
  for (const f of h.log.foes.filter((x) => x.side === 'enemy')) f.dead = true;
  h.run(0.3);
  assert.equal(e.ship.damage.state, SHIP_STATES.prize, 'taken');
  return { e, m: h.log.plunder.at(-1) };
}
/** The boat a deed of mine stands for, and her state as a boat of mine. */
const claimed = (h, deed = h.pack[0]) => { const b = h.rt.GetPlacedBoatWithUID(deed.UID); return { b, st: b ? h.host._myState(b) : null }; };

// ── her papers (systems/naval/navalPlunder.js, systems/comeSailAwayItems.js) ────────────────────────────────────────

test('SHIP-CLAIM her papers: a claimed prize\'s deed is worth PRIZE_DEED_SHARE - a quarter - of her hull\'s price on the shelf, in whole gold; minted as the shelf mints a deed - the deed row, the UID it is given, her hull and variant in its message and its name, that value (mutants: the full price, another hull\'s price, the message, the name, the value, the UID)', () => {
  assert.equal(PRIZE_DEED_SHARE, 0.25);
  assert.deepEqual([0, 1, 2, 3, 4].map(prizeDeedValue), HULL_PRICES.map((p) => Math.round(p * 0.25)));
  const d = mintDeed(1, 4, 77, 625);
  assert.deepEqual({ templateIndex: d.templateIndex, group: d.group, UID: d.UID, message: d.message, name: d.name, value: d.value, stackCount: d.stackCount },
    { templateIndex: BOAT_DEED_TEMPLATE, group: 'UselessItems2', UID: 77, message: 14, name: "Deed to Large Boat 'V'", value: 625, stackCount: 1 });
  assert.equal(mintDeed(4, 0, 78, 9).name, "Deed to Carrack 'I'");
  assert.throws(() => mintDeed(5, 0, 79, 1), RangeError, 'a hull the C#\'s array would throw on');
});

// ── Come Sail Away's placing (systems/comeSailAway.js LaunchFromDeed) ─────────────────────────────────────────────

test('SHIP-CLAIM Come Sail Away\'s placing: LaunchFromDeed stands a deed\'s boat at the pose given - her hull and variant the deed\'s, her bow along the direction, the pixel of the terrain under her - linked to the deed by its UID (GetPlacedBoatWithUID); a crewed hull\'s deed kept, a small boat\'s spent from the live pack as the mod spends one on placing; never for parts, never a second boat (nor a move) for a deed whose boat stands - the port\'s rule; what the click was placing let go (mutants: the deed check, the standing boat, the link, the pose, the placing kept)', () => {
  const sc = scene({ terrains: [terrain(10, 20), terrain(11, 20)] });
  const pack = [];
  const ship = mintDeed(2, 0, 501, 6250);
  pack.push(ship);
  const at = [1000, 34, 50], dir = [Math.SQRT1_2, 0, Math.SQRT1_2];
  const b = sc.rt.LaunchFromDeed(ship, () => pack, at, dir, sc.terrains[1]);
  assert.ok(b, 'placed');
  assert.deepEqual([b.hull, b.variant, b.uid, b.crewed], [2, 0, 501, true]);
  assert.ok(sc.rt.GetPlacedBoatWithUID(501) === b, 'the deed answers her');
  assert.ok(sc.rt.state.AllBoats.includes(b));
  closeV(b.GameObject.position, at, 1e-9, 'where she was put');
  closeV(quatRotate(b.GameObject.rotation, [0, 0, 1]), dir, 1e-6, 'her bow along the direction');
  assert.deepEqual(b.MapPixel, { X: 11, Y: 20 }, 'the pixel she lies on, not the player\'s');
  assert.deepEqual(pack, [ship], 'a crewed hull\'s deed is kept - it calls her to a port');
  // a small boat: the mod spends her deed on placing
  const small = mintDeed(1, 3, 502, 625);
  pack.push(small);
  const lb = sc.rt.LaunchFromDeed(small, () => pack, at, dir, sc.terrains[0]);
  assert.deepEqual([lb.hull, lb.variant, lb.uid, lb.crewed], [1, 3, 502, false]);
  assert.deepEqual(pack, [ship], 'spent');
  // refused
  const boats = sc.rt.state.AllBoats.length;
  assert.ok(sc.rt.LaunchFromDeed(mintBoatItem(BOAT_PARTS_TEMPLATE, 503), () => pack, at, dir) === null, 'parts are LaunchFromParts\'');
  const p0 = [...b.GameObject.position];
  assert.ok(sc.rt.LaunchFromDeed(ship, () => pack, [0, 34, 0], dir) === null, 'a deed whose boat stands');
  assert.deepEqual(b.GameObject.position, p0, 'never moved: a bought deed\'s boat is the port\'s to move');
  assert.equal(sc.rt.state.AllBoats.length, boats, 'nothing stood');
  // the click's placing let go
  sc.rt.StartPlacing(mintDeed(2, 0, 504, 1), pack);
  assert.equal(sc.rt.placing, true);
  assert.ok(sc.rt.LaunchFromDeed(mintDeed(2, 0, 505, 1), () => pack, at, dir));
  assert.equal(sc.rt.placing, false);
  assert.equal(sc.rt.state.placeItem, null);
});

// ── the claim, by the real host ─────────────────────────────────────────────────────────────────────────────────

test('SHIP-CLAIM claimed, she is my boat: her deed (the shelf\'s, a fresh UID off the mint, her hull and variant, a quarter of her price) in my pack; her boat - Come Sail Away\'s, not the sea\'s - where she lay, heading as she lay, on the terrain under her, linked to that deed; her hold aboard her; her hull and canvas as the shares she had and no hand aboard; she leaves the sea unsunk - no bell, no cask, no charge, her dead re-decked onto my hull; I am back at my own helm, and told; after, nobody aboard, her spirits untouched and nothing mended alone (mutants: the deed\'s value, the pose, the terrain, the hold, the shares, the crew, the hands she never had, the sinking, the helm, the words)', async () => {
  const h = await claimSea();
  const { e, m } = taken(h, 'pirateBrig', { yaw: 0.7 });
  const d = e.ship.damage;
  const was = { hull: d.hullShare(), sail: d.sailShare(), pos: [...e.ship.pos], yaw: e.ship.yaw, hold: [...e.prize.hold], name: e.ship.names.name, hers: e.boat, barrels: e.ship.guns.barrels };
  assert.ok(was.hold.length > 0 && was.hull < 0.25 && was.sail < 0.7, 'a battered prize with a hold');
  assert.ok(Math.abs(Math.sin(was.yaw)) > 0.5, `hauled alongside my turned keel: a heading of her own (${was.yaw})`);
  const sounds = h.log.sounds.length, law = h.log.law.length, says = h.log.say.length;
  assert.deepEqual(m.claimOffer(), { detail: 'Keep her as your own Small Ship: her deed to your pack, her hold aboard her. She has no crew.' });
  assert.equal(m.fate('claim'), true);
  assert.equal(m.fated(), 'claim');
  // her deed
  assert.equal(h.pack.length, 1);
  const deed = h.pack[0];
  assert.deepEqual({ templateIndex: deed.templateIndex, UID: deed.UID, message: deed.message, name: deed.name, value: deed.value },
    { templateIndex: BOAT_DEED_TEMPLATE, UID: 9001, message: 20, name: "Deed to Small Ship 'I'", value: HULL_PRICES[2] * 0.25 });
  // her boat
  const { b, st } = claimed(h);
  assert.ok(b && b !== h.boat && h.rt.state.AllBoats.includes(b), 'a boat of mine');
  assert.deepEqual([b.hull, b.variant, b.uid], [2, 0, 9001]);
  assert.ok(h.pool.boats.includes(b) && !h.pool.seaBoats.includes(was.hers), 'mine in the water, her sea hull gone');
  closeV(b.GameObject.position, [was.pos[0], 0, was.pos[2]], 1e-4, 'where she lay (a transform\'s float32)');
  closeV(quatRotate(b.GameObject.rotation, [0, 0, 1]), forwardOfYaw(was.yaw), 1e-6, 'heading as she lay');
  assert.deepEqual(b.MapPixel, { X: 11, Y: 20 }, 'the pixel under her');
  // her hold, aboard her
  assert.deepEqual(b.Cargo.Items, was.hold);
  assert.equal(e.prize.hold.length, 0);
  // her hurts as shares; nobody aboard
  assert.ok(close(st.damage.hullShare(), was.hull, 1e-9) && close(st.damage.sailShare(), was.sail, 1e-9), `${st.damage.hullShare()} ${st.damage.sailShare()} against ${was.hull} ${was.sail}`);
  assert.deepEqual([st.damage.crew, st.damage.state, st.guns.barrels], [0, SHIP_STATES.afloat, was.barrels]);
  // let go from the sea, never sunk
  assert.equal(h.host._sea.has(e.id), false);
  assert.deepEqual(h.log.sounds.slice(sounds).filter(([k]) => k === NAVAL_CLASSIC.bell || k === NAVAL_CLASSIC.bubbles), [], 'no bell, no bubbles');
  assert.equal(h.host._shots.floaters().filter((f) => f.kind === 'flotsam').length, 0, 'no cask');
  assert.deepEqual(h.log.law.slice(law), [], 'no reward for a sinking');
  assert.ok(h.log.redecked.length === 1 && h.log.redecked[0][0] === was.hers && h.log.redecked[0][1] === b, 'her dead lie on her deck - mine now');
  // back at my helm, and told
  assert.ok(h.rt.state.CurrentBoat === h.boat && h.log.helm.at(-1) === h.boat, 'at my own wheel');
  assert.deepEqual(h.log.say.slice(says), [`${was.name} is yours - her deed is in your pack. She has no crew: hire hands at a shipwright.`]);
  // her days after
  h.run(FIELD_QUIET_S + 5, 0.5);
  assert.equal(st.crew.hands.length, 0, 'no hand aboard her');
  assert.equal(st.crew.morale, MORALE_START, 'no hand of hers lost to her spirits - she never had one');
  assert.ok(close(st.damage.hullShare(), was.hull, 1e-9), 'a crewed hull with nobody aboard mends nothing alone: the shipwright\'s');
  assert.ok(!h.log.say.some((t) => t.endsWith('is going down!')));
});

test('SHIP-CLAIM offered only for a prize I stand, where Come Sail Away can place her: one another stands (theirs to settle), the mod off (no runtime that places her) or the host\'s mint or pack wanting - no offer, the claim refused, nothing packed, placed or let go; ALL OR NOTHING - a placing that throws or stands no boat takes her deed back and leaves her a prize; a voyage raid\'s window offers none (mutants: the owner unread, the runtime unread, the mint unread, the pack unread, the claim unguarded, a throw let through, the deed kept on a failure)', async () => {
  const h = await claimSea();
  const { e, m } = taken(h, 'merchantGalleon');
  const nothing = (why) => {
    assert.deepEqual(h.pack, [], `${why}: nothing packed`);
    assert.ok(h.rt.state.AllBoats.length === 1 && h.rt.state.AllBoats[0] === h.boat, `${why}: nothing placed`);
    assert.ok(h.host._sea.has(e.id) && !e.retiring && e.prize.fate === null, `${why}: she lies a prize`);   // AUDIT BAY A15: never fading
  };
  assert.ok(m.claimOffer(), 'mine, the mod here');
  e.owner = 'zed';
  assert.equal(m.claimOffer(), null, 'another stands her');
  assert.equal(m.fate('claim'), false);
  nothing('another\'s');
  e.owner = null;
  const real = h.deps.csa;
  h.deps.csa = () => h.runtime;   // the harness's own stand-in: a helm, no placing
  assert.equal(m.claimOffer(), null, 'the mod off');
  assert.equal(m.fate('claim'), false);
  nothing('the mod off');
  h.deps.csa = real;
  for (const seam of ['mintUid', 'packDeed']) {
    const was = h.deps.board[seam];
    delete h.deps.board[seam];
    assert.equal(m.claimOffer(), null, `no ${seam}`);
    assert.equal(m.fate('claim'), false);
    nothing(`no ${seam}`);
    h.deps.board[seam] = was;
  }
  assert.ok(m.claimOffer(), 'offered again');
  // ALL OR NOTHING: a placing that fails - it throws, or stands no boat - takes her deed back; she lies a prize still
  const place = h.rt.LaunchFromDeed, warn = console.warn;
  console.warn = () => {};
  try {
    for (const fails of [() => { throw new Error('no water under her'); }, () => null]) {
      h.rt.LaunchFromDeed = fails;
      assert.equal(m.fate('claim'), false);
      nothing('a placing that failed');
    }
  } finally { h.rt.LaunchFromDeed = place; console.warn = warn; }
  assert.equal(m.fate('claim'), true, 'and claimed when it stands her');
  // a voyage raid's plunder (Warm Ashes' ambush beaten): no claim in its model
  const v = await claimSea();
  assert.equal(v.host.leaveShipGate({ uid: 5 }), 'wait');
  const rm = v.log.plunder.at(-1);
  assert.equal(rm.raid, true);
  assert.equal(rm.claimOffer, undefined);
});

test('SHIP-CLAIM her fate answers a boolean from every exit (THE MODAL CONTRACT): decided - true; asked again, the claim among them - false, and nothing claimed (mutants: a fate answering nothing, a decided fate decided again)', async () => {
  const h = await claimSea();
  const { m } = taken(h, 'merchantGalleon');
  assert.equal(m.fate('adrift'), true);
  assert.equal(m.fate('scuttle'), false);
  assert.equal(m.fate('claim'), false);
  assert.equal(m.fated(), 'adrift');
  assert.deepEqual(h.pack, []);
  const s = await claimSea();
  assert.equal(taken(s, 'merchantGalleon').m.fate('scuttle'), true);
});

test('SHIP-CLAIM what was taken from her is gone from her: her timber that made good my hull and canvas is out of hers (her shares less those points), never under one point of hull - she floats, no wreck; her powder taken, she comes with no fire barrels, else with what she has left (mutants: the timber unread, the floor, the powder unread, her own barrels unread)', async () => {
  // a little of my hull and canvas made good: that much less of hers
  const a = await claimSea();
  a.host._myState(a.boat).damage.apply({ hull: 30, sail: 20, crew: 0 });
  const { e, m } = taken(a, 'merchantGalleon');
  const d = e.ship.damage, her = { hull: d.hull, sail: d.sail };
  assert.equal(m.choose('repair'), true);
  assert.equal(m.fate('claim'), true);
  const { st } = claimed(a);
  assert.ok(close(st.damage.hullShare(), (her.hull - 30) / d.maxHull, 1e-9), `hull ${st.damage.hullShare()}`);
  assert.ok(close(st.damage.sailShare(), (her.sail - 20) / d.maxSail, 1e-9), `canvas ${st.damage.sailShare()}`);
  // more of mine made good than she had: one point, afloat
  const f = await claimSea();
  f.host._myState(f.boat).damage.apply({ hull: 400, sail: 0, crew: 0 });
  const { m: fm } = taken(f, 'merchantGalleon', { hull: 0.9 });
  assert.equal(fm.choose('repair'), true);
  assert.equal(fm.fate('claim'), true);
  const { st: fst } = claimed(f);
  assert.deepEqual([fst.damage.hull, fst.damage.state], [1, SHIP_STATES.afloat], 'she floats');
  // her powder taken: none left in her
  const p = await claimSea();
  const { e: pe, m: pm } = taken(p, 'merchantGalleon');
  pe.ship.guns.barrels = 2;
  assert.equal(pm.choose('powder'), true);
  assert.equal(pm.fate('claim'), true);
  assert.equal(claimed(p).st.guns.barrels, 0);
  // untouched: what she has
  const n = await claimSea();
  const { e: ne, m: nm } = taken(n, 'merchantGalleon');
  ne.ship.guns.barrels = 1;
  assert.equal(nm.fate('claim'), true);
  assert.equal(claimed(n).st.guns.barrels, 1);
});

test('SHIP-CLAIM a small boat: a Large Boat taken (a pirate sloop, her variant hers) is placed and linked as any, her deed the mod\'s to spend - as it spends every small boat\'s on placing (not `crewed`): none left in my pack; no crew to hire, and the words say so (mutants: the pack the spend reads, the variant, a small boat\'s words)', async () => {
  const h = await claimSea();
  const { e, m } = taken(h, 'pirateSloop', { variant: 3 });
  const name = e.ship.names.name;
  assert.deepEqual(m.claimOffer(), { detail: 'Keep her as your own Large Boat where she lies, her hold aboard her.' });
  assert.equal(m.fate('claim'), true);
  assert.deepEqual(h.pack, [], 'spent on placing');
  const b = h.rt.state.AllBoats.find((x) => x !== h.boat);
  assert.deepEqual([b.hull, b.variant, b.crewed, b.uid], [1, 3, false, 9001], 'her deed\'s UID on her still');
  assert.equal(h.host._myState(b).damage.maxCrew, 0);
  assert.equal(h.log.say.at(-1), `${name} is yours - she lies where you took her.`);
});

test('SHIP-CLAIM and SHIP-PACK a claimed ship picked up and placed again is the same ship: her deed goes with her into her parts - her number, her papers\' worth (a quarter); placed again, her deed back; her hurts and her empty crew kept by her number - the pick-up never mends nor crews her (mutants: a new number, the shelf\'s price, the deed kept)', async () => {
  const h = await claimSea();
  const { m } = taken(h, 'pirateBrig');
  assert.equal(m.fate('claim'), true);
  const { b, st } = claimed(h);
  const deed = h.pack[0];
  const was = { hull: st.damage.hullShare(), sail: st.damage.sailShare() };
  let mint = 7000;
  h.sc.deps.items = { create: (t) => mintBoatItem(t, ++mint), addToPlayer: (it) => h.pack.push(it), player: () => h.pack };
  assert.equal(h.rt.PackBoat(b, true), true);
  const parts = h.pack.at(-1);
  assert.ok(!h.pack.includes(deed), 'her deed went with her');
  assert.deepEqual([parts.templateIndex, parts.UID, parts.value], [BOAT_PARTS_TEMPLATE, deed.UID, HULL_PRICES[2] * 0.25]);
  const again = h.rt.LaunchFromParts(parts, () => h.pack, [2000, 0, 300], [0, 0, 1], h.sc.terrains[1]);
  assert.deepEqual(h.pack.map((it) => [it.templateIndex, it.UID, it.value]), [[BOAT_DEED_TEMPLATE, deed.UID, HULL_PRICES[2] * 0.25]], 'her deed back');
  const st2 = h.host._myState(again);
  assert.ok(st2 === st, 'her own state, by her number');
  assert.ok(close(st2.damage.hullShare(), was.hull, 1e-9) && close(st2.damage.sailShare(), was.sail, 1e-9), 'not mended');
  assert.deepEqual([st2.damage.crew, st2.crew.hands.length], [0, 0], 'nobody aboard');
});

test('SHIP-CLAIM and SHIP-PACK a claimed Large Boat picked up packs at her papers\' worth - a quarter of her hull\'s price - never at the shelf\'s, so a prize is no fortune in parts (the review before the merge; mutants: the shelf\'s price)', async () => {
  const h = await claimSea();
  const { m } = taken(h, 'pirateSloop');
  assert.equal(m.fate('claim'), true);
  assert.deepEqual(h.pack, [], 'her deed spent on placing');
  const b = h.rt.state.AllBoats.find((x) => x !== h.boat);
  let mint = 7000;
  h.sc.deps.items = { create: (t) => mintBoatItem(t, ++mint), addToPlayer: (it) => h.pack.push(it), player: () => h.pack };
  assert.equal(h.rt.PackBoat(b, true), true);
  assert.deepEqual([h.pack[0].templateIndex, h.pack[0].value], [BOAT_PARTS_TEMPLATE, prizeDeedValue(1)]);
  assert.equal(prizeDeedValue(1), HULL_PRICES[1] / 4);
});

test('SHIP-CLAIM kept by both saves: the naval save holds her hurts and her empty crew by her deed\'s UID, Come Sail Away\'s her boat - hull, place, heading and hold; loaded, the deed\'s UID answers her and her state is hers again (mutants: the UID unminted, the link)', async () => {
  const h = await claimSea();
  const { e, m } = taken(h, 'pirateBrig', { yaw: -1.1 });
  const was = { pos: [...e.ship.pos], yaw: e.ship.yaw, hold: e.prize.hold.map((it) => it.name) };
  assert.ok(Math.abs(Math.sin(was.yaw)) > 0.5, `a heading of her own (${was.yaw})`);
  assert.equal(m.fate('claim'), true);
  const uid = h.pack[0].UID;
  const { st } = claimed(h);
  const navalSave = JSON.parse(JSON.stringify(h.host.getSaveData()));
  const csaSave = JSON.parse(JSON.stringify(h.rt.getSaveData()));
  const rec = navalSave.boats[uid];
  assert.ok(rec, 'her record by her UID');
  // PIN MOVED (TOUGHER-SHIPS): her hurts saved on her first build's scale, to the hundredth (navalHost.js savedRecord)
  const first = firstBuildOf(2), onFirst = (v, whole, then) => Math.round((v / whole) * then * 100) / 100;
  assert.deepEqual([rec.hull, rec.sail, rec.maxHull, rec.maxSail, rec.crew, rec.state, rec.mates.hands],
    [onFirst(st.damage.hull, st.damage.maxHull, first.hullHp), onFirst(st.damage.sail, st.damage.maxSail, first.sailHp), first.hullHp, first.sailHp, 0, SHIP_STATES.afloat, []]);
  assert.ok(csaSave.placedBoats.some((p) => p.UID === uid && p.Hull === 2));
  // a new game loads it
  const g = await claimSea({ save: navalSave });
  g.rt.restoreSaveData(csaSave);
  const back = g.rt.GetPlacedBoatWithUID(uid);
  assert.ok(back, 'the deed\'s UID answers her');
  assert.deepEqual([back.hull, back.variant], [2, 0]);
  closeV(back.GameObject.position, [was.pos[0], 0, was.pos[2]], 1e-3, 'where she lay');
  closeV(quatRotate(back.GameObject.rotation, [0, 0, 1]), forwardOfYaw(was.yaw), 1e-5, 'heading as she lay');
  assert.deepEqual(back.Cargo.Items.map((it) => it.name), was.hold, 'her hold aboard her');
  const st2 = g.host._myState(back);
  assert.ok(Math.abs(st2.damage.hull - st.damage.hull) < 0.02 && Math.abs(st2.damage.sail - st.damage.sail) < 0.02, `her hurts as she was (${st2.damage.hull} ${st.damage.hull})`);   // PIN MOVED (TOUGHER-SHIPS): read back by her share
  assert.deepEqual([st2.damage.crew, st2.crew.hands.length], [0, 0]);
});

test('SHIP-CLAIM a harbour\'s ship claimed is not stood at her berth again today - she is mine where I took her (SHIP-LIFE\'s roll notes her gone, as one that sailed); the rest stand again (mutants: her berth kept)', async () => {
  const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
  const PORT = { key: 'port:1', rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 } };
  const h = withRuntime(await sea({ hull: null, water: coast }));
  h.view.feet = [0, 0, 300];
  h.deps.harbourNear = () => PORT;
  h.run(1);
  const moored = () => [...h.host._sea.values()].filter((x) => x.ship.errand?.kind === 'moored');
  const e = moored()[0];
  assert.ok(e && moored().length >= 2, 'ships at their berths');
  // taken (laid open as a boarding lays one) and her window opened by Activate on foot beside her
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  e.ship.damage.takePrize();
  e.prize = { hold: [], boat: null, chosen: null, fate: null };
  const feet = [e.ship.pos[0] + hullBuild(e.ship.hull).beam + 4, 0, e.ship.pos[2]];
  h.view.feet = feet;
  h.view.look = { origin: [feet[0], 1.7, feet[2]], dir: [-1, 0, 0] };
  assert.equal(h.host.activate(), true, 'her window');
  assert.equal(h.log.plunder.at(-1).fate('claim'), true);
  const seed = e.ship.seed;
  h.view.feet = [0, 0, 300 + HARBOUR_LEAVE + 800];
  h.run(1 + SHIP_FADE_S);   // SHIP-FADE (2026-10-02) PIN MOVED: they fade as they go
  h.view.feet = [0, 0, 300];
  h.run(1);
  assert.ok(moored().length >= 1, 'the harbour stood again');
  assert.ok(!moored().some((x) => x.ship.seed === seed), 'never her twin at her berth');
});

test('SHIP-CLAIM online, my own stood prize: claimed, she leaves the room\'s sea as she leaves mine - my word says her no more and the other player lets her go at once, unsunk (no "going down", no cask); her boat is mine, Come Sail Away\'s own word\'s to say - nothing new on the wire (mutants: a sinking for a claim)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = withRuntime(r.get('a').s), B = r.get('b').s;
  B.view.feet = [0, 0, -30];
  const x = hullBuild(2).beam * 2 + 12;
  const e = A.host._sea.get(A.host.spawnShip('merchantGalleon', { range: x, bearing: Math.PI / 2, yaw: 0 }));
  r.run(0.5);
  const theirs = () => [...B.host._sea.values()].find((y) => y.ship.seed === e.ship.seed) ?? null;
  assert.ok(theirs()?.owner === 'a', 'the other player sees her, mine');
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  r.run(0.2);
  assert.equal(A.host.activate(), true);
  r.run(GRAPPLE_S + 0.3);
  for (const f of A.log.foes.filter((y) => y.side === 'enemy')) f.dead = true;
  r.run(0.5);
  assert.equal(theirs()?.ship.damage.state, SHIP_STATES.prize, 'my prize, on their screen');
  assert.equal(A.log.plunder.at(-1).fate('claim'), true);
  r.run(1);
  assert.ok(theirs() === null, 'let go at once');
  assert.ok(!B.log.say.some((t) => t.endsWith('is going down!')));
  assert.equal(B.host._shots.floaters().filter((f) => f.kind === 'flotsam').length, 0);
});

// ── the window (ui/navalPlunderWindow.js) ──────────────────────────────────────────────────────────────────────────

test('SHIP-CLAIM the window: "Claim her" beside Scuttle and Cast adrift while the host offers it, its line under them saying what she becomes; pressed, her fate is the host\'s to decide - claimed, the window leaves; refused, it stays with a word and the press goes; no offer, no claim; a voyage raid\'s window none at all (mutants: the claim always shown, a raid offered it, the press untold, a refusal leaving, the line unsaid)', () => {
  const detail = 'Keep her as your own Small Ship: her deed to your pack, her hold aboard her. She has no crew.';
  const model = (o = {}) => {
    const m = {
      log: [], answer: true, offer: { detail },
      name: 'The Red Wake', classLine: 'Pirate Brigantine', captain: 'Irna Vosk', faction: 'pirate', raid: false, items: [{ name: 'Gold pieces' }],
      mine: () => ({ name: 'Carrack' }), offers: () => [], takeAll: () => ({ taken: 0, left: 0, where: 'hold' }), chosen: () => null,
      claimOffer: () => m.offer, fate: (w) => { m.log.push(w); return m.answer; }, ...o,
    };
    return m;
  };
  // the words
  assert.equal(plunderText(model()).claim, detail);
  assert.equal(plunderText(model({ raid: true })).claim, null, 'never a raid\'s');
  assert.equal(plunderText(model({ claimOffer: undefined })).claim, null);
  assert.equal(plunderText(model({ offer: null })).claim, null);
  const mount = (m) => {
    const host = globalThis.document.createElement('div');
    const exits = [];
    const view = mountNavalPlunderWindow(host, { model: m, onExit: (r) => exits.push(r) });
    return { host, exits, view, claim: byClass(host, 'dfnaval-claim')[0] ?? null, line: byClass(host, 'dfnaval-claimnote')[0] ?? null };
  };
  // offered: beside the two, its line under them
  const m = model();
  const w = mount(m);
  assert.equal(w.claim.textContent, 'Claim her');
  assert.equal(w.claim.parentNode, byClass(w.host, 'dfnaval-scuttle')[0].parentNode, 'beside Scuttle and Cast adrift');
  assert.deepEqual([w.claim.hidden, w.claim.getAttribute('title'), w.line.hidden, w.line.textContent], [false, detail, false, detail]);
  // refused: it stays, says why, and the press goes
  m.answer = false; m.offer = null;
  press(w.claim);
  assert.deepEqual(m.log, ['claim']);
  assert.deepEqual(w.exits, [], 'a refusal stays');
  assert.equal(byClass(w.host, 'dfnaval-note')[0].textContent, 'She cannot be claimed.');
  assert.deepEqual([w.claim.hidden, w.line.hidden], [true, true]);
  w.view.unmount();
  // claimed: the window leaves
  const c = mount(model());
  press(c.claim);
  assert.deepEqual(c.exits, ['fate']);
  c.view.unmount();
  // no offer: none from the first paint
  const n = mount(model({ offer: null }));
  assert.deepEqual([n.claim.hidden, n.line.hidden, n.line.textContent], [true, true, '']);
  n.view.unmount();
  // a voyage raid's window: Sail on alone
  const r = mount(model({ raid: true, mine: () => null }));
  assert.equal(r.claim, null);
  assert.equal(r.line.hidden, true);
  r.view.unmount();
});

// ── the world's seams (scenes/world.js) ───────────────────────────────────────────────────────────────────────────

test('SHIP-CLAIM the world\'s seams - the naval host\'s board in scenes/world.js, the one host with a sea (THE FOUR HOSTS RULE: exterior.js, worldModes.js and dungeonContext.js stand none): the mint the mod\'s items\' own, the deed into the pack with no weight\'s gate answering the live pack, the terrain under her, and her dead re-decked - every body that stood on her hull stands on mine, another hull\'s where it was (mutants: each seam unwired, the redeck re-pointing nothing or every body)', () => {
  assert.match(WORLD, /\n {6}mintUid: \(\) => csaNewItemUid\(\),\n/);
  assert.match(WORLD, /\n {6}packDeed: \(item\) => \{ addItem\(\(playerEntity\.items \?\?= \[\]\), item\); surfacePlayer\(\); return \(\) => playerEntity\.items; \},\n/);
  assert.match(WORLD, /\n {6}terrainAt: \(p\) => csaTerrainOf\(csaPixelAt\(p\[0\], p\[2\]\)\),\n/);
  const line = /\n {6}redeck: (\(from, to\) => \{[^\n]*\}),\n/.exec(WORLD);
  assert.ok(line, 'the redeck seam');
  const bodies = [{ deckBoat: 'hers' }, { deckBoat: 'hers', dead: true, corpse: {} }, { deckBoat: 'another' }];
  const redeck = new Function('_deckBodies', `return ${line[1]};`)(new Set(bodies));
  redeck('hers', 'mine');
  assert.deepEqual(bodies.map((f) => f.deckBoat), ['mine', 'mine', 'another']);
  for (const host of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.ok(!read(host).includes('createNavalHost('), `${host} stands no sea`);
  assert.ok(WORLD.includes('naval = createNavalHost({'));
});
