// RAM-RETURN (2026-10-26, the owner: "So players are complaining about ship ramming being removed. So I would like to
// reintegrate it in a thoughtful way. The major issue was that you could easily instability ships just by ramming";
// bible/03-World/Naval-Refit.md RAM-RETURN and AUDIT RAM-RETURN, the owner: "Audit this") - THE RAM BACK, BOUNDED: the
// law's own numbers (systems/naval/navalRam.js: the face, the closing way toward it, the blow, the line, what pays for
// it); THE BOUND driven through the rams' own module (scenes/naval/navalRams.js) over every player's hull against every
// class, every way to a storm's and three angles - one ram takes GALLEY_SHARE of the lesser hull at the most, none takes
// a fighting ship under her line, a battered stem rams only as hard as it can pay for, and no recoil brings the rammer to
// her own line - and a galley's rams on every player's hull the same; my helm's and a galley's rules on the module alone;
// and on the real naval host over Come Sail Away's real pool (test/navalSea.mjs): my stem's ram as AUDIT NAV1 H11 found
// it, a lawful ship at peace bumped and never rammed (AUDIT A1), a ship rammed to her line then boarded by the grapples,
// a galley's ram on the ship she fights, online the ram said as a ram and taken by her stander to her own line (AUDIT
// A3), and a booked ship's master who never rams (FERRY-CLEAR). tools/mutants/ramreturn.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RAM_SPEED, RAM_FULL_SPEED, RAM_SHARE, GALLEY_SHARE, RAM_GLANCE, RAM_RECOIL, BOW_RECOIL, GALLEY_RAM, RAM_A_MAN, RAM_REACH, RAM_MEMORY_S, RAM_COOLDOWN_S,
  ramContact, ramClosing, ramBlow, ramLine, ramRoom, recoilRoom, recoilShare, ramPaid, ramMen, ramMenSaid,
} from '../../../src/systems/naval/navalRam.js';
import { HULL, SHIP_CLASSES, hullBuild, classById, flatHull } from '../../../src/systems/naval/navalShips.js';
import { SHIP_STATES, STRUCK_AT, BRACE_TAKEN, createShipDamage } from '../../../src/systems/naval/navalDamage.js';
import { hullBoxOf } from '../../../src/scenes/naval/navalHost.js';
import { createNavalRams } from '../../../src/scenes/naval/navalRams.js';
import { navalHitData, validNavalHit, navalWireRecord } from '../../../src/systems/naval/navalWire.js';
import { sea, freshPool } from '../../navalSea.mjs';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A hull's box on the flat, as hullBoxOf stands it (`c` at her middle, `ax` her beam, `az` her keel). */
function boxOf(pos, yaw, hull) {
  const f = flatHull(pos, yaw, hull);
  return { c: [f.c[0], 0, f.c[1]], ax: [f.r[0], 0, f.r[1]], ay: [0, 1, 0], az: [f.f[0], 0, f.f[1]], h: [f.hw, 6, f.hl] };
}

test('RAM-RETURN the law: its numbers; the face a stem meets and its outward normal, none out of reach; the closing way toward it - a scrape along her side closes on nothing, a ship sailing on ahead takes her own way off, one coming on adds it; the blow - the stem\'s share of the LESSER hull, times the pace (never past whole) and the face (RAM_GLANCE into her bow or stern), none under RAM_SPEED; her line, her room down to it and the recoil\'s a whole point short; what a stem pays for (mutants: the lesser hull, the pace unbounded, the face unread, the galley\'s share, the normal, the room, the recoil\'s room, the price)', () => {
  assert.deepEqual([RAM_SPEED, RAM_FULL_SPEED, RAM_SHARE, GALLEY_SHARE, RAM_GLANCE], [1.6, 8, 0.15, 0.3, 0.4]);
  assert.deepEqual([RAM_RECOIL, BOW_RECOIL, GALLEY_RAM, RAM_A_MAN, RAM_REACH, RAM_MEMORY_S, RAM_COOLDOWN_S], [0.3, 2, 3, 40, 1.2, 0.6, 3]);
  // the face: a Small Ship lying across +z (her keel along +x), a stem coming up the z axis from the origin
  const across = boxOf([0, 0, 50], Math.PI / 2, HULL.SmallShip);
  const near0 = across.c[2] - across.h[0];   // her near side
  const side = ramContact(across, [0, 1, near0 - 0.6]);
  assert.equal(side.side, true, 'into her side');
  near(side.normal[2], -1, 1e-9, 'its normal outward, toward the stem');
  assert.equal(ramContact(across, [0, 1, near0 - RAM_REACH - 0.01]), null, 'out of reach');
  assert.ok(ramContact(across, [0, 1, near0 + 0.4]).side, 'a stem in her planking meets the face it is least inside');
  const astern = boxOf([0, 0, 50], 0, HULL.SmallShip);   // her keel along +z: my stem at her stern
  const end = ramContact(astern, [0, 1, astern.c[2] - astern.h[2] - 0.5]);
  assert.equal(end.side, false, 'into her stern');
  near(end.normal[2], -1, 1e-9);
  // the closing way toward the face
  near(ramClosing([[0, 0, 6]], [0, 0, 0], side.normal), 6, 1e-9, 'square: all of it');
  near(ramClosing([[6, 0, 0]], [0, 0, 0], side.normal), 0, 1e-9, 'a scrape along her side: none');
  near(ramClosing([[0, 0, 6]], [0, 0, 5], end.normal), 1, 1e-9, 'a ship sailing on ahead: the difference');
  near(ramClosing([[0, 0, 6]], [0, 0, -2], end.normal), 8, 1e-9, 'one coming on: hers added');
  near(ramClosing([[0, 0, 2], [0, 0, 7], [0, 0, 0.1]], [0, 0, 0], side.normal), 7, 1e-9, 'the most of the way remembered');
  // the blow: a galleon (672) into a merchant galleon (538)
  const r = (o) => ramBlow({ closing: 8, side: true, mine: 672, hers: 538, ...o });
  assert.equal(r({ closing: RAM_SPEED - 0.01 }), 0, 'a bump');
  assert.equal(r({ closing: RAM_SPEED }), Math.round(0.15 * 538 * (1.6 / 8)), 'RAM_SPEED rams');
  assert.equal(r({}), Math.round(0.15 * 538), 'whole at RAM_FULL_SPEED: 81');
  assert.equal(r({ closing: 38.9 }), r({}), 'a storm\'s way rams no harder');
  assert.equal(r({ closing: 4 }), Math.round(0.15 * 538 * 0.5), 'half the way, half the blow');
  assert.equal(r({ side: false }), Math.round(0.15 * 538 * RAM_GLANCE), 'into her bow or stern: RAM_GLANCE of it');
  assert.equal(r({ galley: true }), Math.round(0.3 * 538), 'a galley\'s ram: 161');
  assert.equal(r({ mine: 96, hers: 896 }), Math.round(0.15 * 96), 'a rowboat into a Carrack: its own weight');
  assert.equal(r({ mine: 896, hers: 96 }), Math.round(0.15 * 96), 'a Carrack into a rowboat: the rowboat\'s');
  // the line and the room: a fractional line is hers exactly, landed as the floor
  const d = createShipDamage({ hullHp: 538, sailHp: 144, crew: 14 });
  assert.equal(ramLine(d), 538 * STRUCK_AT);
  assert.equal(ramRoom(d), 538 - 134.5);
  d.apply({ hull: 1000, sail: 0, crew: 0 }, 0, { floor: ramLine(d) });
  assert.deepEqual([d.hull, d.state, ramRoom(d)], [134.5, SHIP_STATES.struck, 0], 'a blow of any size lands at her line, and she strikes there');
  // the recoil's room: whole points, a point short of her line
  const p = createShipDamage({ hullHp: 672, sailHp: 256, crew: 24, player: true });
  assert.equal(recoilRoom(p), 672 - 168 - 1);
  p.apply({ hull: 672 - 168, sail: 0, crew: 0 }, 0);
  p.repair({ hull: 1.5 });   // 169.5: a point and a half over her line
  assert.equal(recoilRoom(p), 0, 'her own ram never brings her to strike');
  p.repair({ hull: 1 });
  assert.equal(recoilRoom(p), 1);
  // the recoil and what pays for it
  assert.deepEqual([recoilShare(), recoilShare(true)], [RAM_RECOIL * BOW_RECOIL, RAM_RECOIL / GALLEY_RAM]);
  assert.equal(ramPaid(81, 1000, 0.6), 81, 'a sound stem pays in full');
  assert.equal(ramPaid(81, 30, 0.6), 50, 'a battered one rams as hard as its room pays for');
  assert.equal(ramPaid(81, 0, 0.6), 0, 'a hull at its line rams nothing');
  assert.equal(ramPaid(81, 0, 0), 81);
  assert.deepEqual([ramMenSaid(79), ramMenSaid(81), ramMenSaid(161)], [2, 2, 4]);
  assert.equal(ramMen(80, 0.5, 1), 2);
});

// ── the module ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A stand-in sea for the rams' module alone (scenes/naval/navalRams.js): ships as the host keeps them, each hull's box
 *  on the flat (`boxOf`), my boat at the origin heading +z at `o.way` m/s, every seam recorded. */
function standIn(hull = HULL.SmallShip) {
  const boat = { hull, GameObject: {} };
  const build = hullBuild(hull);
  const me = { damage: createShipDamage({ hullHp: build.hullHp, sailHp: build.sailHp, crew: build.crew, player: true }), guns: { braced: false } };
  const ships = new Map();
  const log = { struck: [], mid: [], charged: [], sent: [] };
  const o = { now: 0, way: 0, due: 1, fair: () => true, boarding: null };
  const ship = (id, cls, s = {}) => {
    const c = typeof cls === 'string' ? classById(cls) : cls;
    const e = { id, n: ships.size + 1, owner: s.owner ?? null, boat: {}, ship: { hull: c.hull, pos: [0, 0, 0], yaw: 0, speed: 0, mode: 'cruise', target: null, boarded: false, damage: createShipDamage(c), ...s.ship } };
    ships.set(id, e);
    return e;
  };
  const shipOf = (b) => [...ships.values()].find((e) => e.boat === b).ship;
  const rams = createNavalRams({
    ships: () => ships.values(), get: (id) => ships.get(id), myBoats: () => [boat], myId: () => 'me', now: () => o.now, seaY: () => 0, random: () => 0.5,
    boatPose: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, o.way] }),
    hullBox: (b) => { const s = b === boat ? { pos: [0, 0, 0], yaw: 0, hull } : shipOf(b); return boxOf(s.pos, s.yaw, s.hull); },
    state: () => me, boarding: () => o.boarding, called: () => 'A galley', fair: (e) => o.fair(e),
    strike: (e, hurt, by) => { log.struck.push([e.id, hurt.hull, by]); e.ship.damage.apply(hurt, o.now, { floor: hurt.floor ?? 0 }); },
    sendHit: (d) => log.sent.push(d), charge: (e) => log.charged.push(e.id),
    hit: () => {}, sound: () => {}, mid: (x) => log.mid.push(x), due: () => ({ hull: o.due }),
  });
  const stem = [0, 1, build.bowZ];
  /** `e` lying with her keel at `yaw`, her middle on my keel's line, her near face `gap` past my stem. */
  const before = (e, gap = 0.4, yaw = Math.PI / 2) => {
    e.ship.yaw = yaw;
    const x = -boxOf([0, 0, 0], yaw, e.ship.hull).c[0];
    let lo = 0, hi = 400;
    for (let i = 0; i < 60; i++) { const z = (lo + hi) / 2; if (ramContact(boxOf([x, 0, z], yaw, e.ship.hull), stem, 0)) lo = z; else hi = z; }
    e.ship.pos = [x, 0, lo + gap];
  };
  /** A galley's stem `inside` m into the side of `x` lying across her bow. */
  const stemInto = (g, x, inside = 0.5) => { const b = boxOf(x.ship.pos, x.ship.yaw, x.ship.hull); g.ship.pos = [b.c[0], 0, b.c[2] - b.h[0] + inside - hullBuild(g.ship.hull).bowZ]; g.ship.yaw = 0; };
  /** A galley's stem `inside` m into my stern from astern. */
  const galleyInto = (g, inside = 0.3) => { const b = boxOf([0, 0, 0], 0, hull); g.ship.pos = [0, 0, b.c[2] - b.h[2] + inside - hullBuild(g.ship.hull).bowZ]; g.ship.yaw = 0; };
  /** My helm at `way` m/s, past the cooldown: a ram's stretch. */
  const helm = (way) => { o.now += RAM_COOLDOWN_S + 0.1; o.way = way; return rams.helm(boat); };
  return { rams, boat, me, ship, log, o, before, stemInto, galleyInto, helm, step: (dt = 0.1) => { o.now += dt; rams.galleys(); } };
}

test('RAM-RETURN THE BOUND, through the rams\' own module: every player\'s hull rams every class from whole, at every closing way from RAM_SPEED to a storm\'s 40 m/s, into her side, at 45 degrees and into her stern - one ram takes GALLEY_SHARE of the lesser hull at the most and never past her line; none sinks her; a stem rams only as hard as its recoil room pays for, so no rammer comes to her own line and a small or battered one runs out of rams; it takes three rams at the fewest to strike a ship; and every galley class\'s rams on every player\'s hull take it to its line, never under nor wrecked (mutants: the room, the price, the recoil\'s room, the lesser hull, the pace)', () => {
  let cases = 0, least = Infinity, spent = 0;
  for (const mineHull of [0, 1, 2, 3, 4]) {
    for (const cls of SHIP_CLASSES) {
      for (const yaw of [Math.PI / 2, Math.PI / 4, 0]) {
        for (let way = RAM_SPEED; way <= 40; way += 2.3) {
          const t = standIn(mineHull);
          const e = t.ship('x', cls);
          t.before(e, 0.3, yaw);
          const her = e.ship.damage, mine = t.me.damage, lesser = Math.min(mine.maxHull, her.maxHull);
          let rams = 0;
          for (let i = 0; i < 60 && her.state === SHIP_STATES.afloat; i++) {
            const was = her.hull;
            if (!t.helm(way)) break;
            rams++;
            assert.ok(was - her.hull <= GALLEY_SHARE * lesser + 0.5, `one ram: ${was - her.hull} of ${lesser}`);
            assert.ok(her.hull >= ramLine(her) - 1e-9, `never under her line (${her.hull})`);
            assert.ok(mine.hull > ramLine(mine), `the rammer over her own line (${mine.hull})`);
          }
          assert.notEqual(her.state, SHIP_STATES.sinking, 'never sunk by a ram');
          if (her.state === SHIP_STATES.struck) {
            cases++; least = Math.min(least, rams);
            if (her.hull > ramLine(her) + 1e-9) assert.equal(her.crew, 0, `struck over her line only with every hand down (${her.hull})`);   // a ram's men (ramMen): a coaster's five
            else near(her.hull, ramLine(her), 1e-9, 'struck at her line exactly');
          } else if (rams) spent++;
        }
      }
    }
  }
  assert.ok(cases > 1000, `${cases} struck by rams`);
  assert.ok(spent > 100, `${spent} runs where the rammer's room ran out first`);
  assert.equal(least, 3, 'three of a galley\'s rams at the fewest');
  for (const mineHull of [0, 1, 2, 3, 4]) {
    for (const cls of SHIP_CLASSES.filter((c) => hullBuild(c.hull).ram)) {
      const t = standIn(mineHull);
      const g = t.ship('g', cls, { ship: { speed: 9, mode: 'engage', target: 'me' } });
      t.galleyInto(g);
      for (let i = 0; i < 40; i++) {
        const was = t.me.damage.hull;
        t.step(RAM_COOLDOWN_S + 0.1);
        assert.ok(was - t.me.damage.hull <= GALLEY_SHARE * Math.min(t.me.damage.maxHull, g.ship.damage.maxHull) + 0.5);
      }
      assert.equal(t.me.damage.state, SHIP_STATES.afloat, `${cls.id} on hull ${mineHull}: never wrecked`);
      assert.ok(t.me.damage.hull >= ramLine(t.me.damage) - 1e-9 && t.me.damage.hull < ramLine(t.me.damage) + 1, `at my line (${t.me.damage.hull})`);
      assert.ok(g.ship.damage.state === SHIP_STATES.afloat && g.ship.damage.hull > ramLine(g.ship.damage), 'her own ram never strikes her');
    }
  }
});

test('RAM-RETURN my helm on the module alone: the blow and its recoil, braced and under the Captain\'s Due (AUDIT A6); a battered stem rams as hard as it can pay for, and a hull at its line or a wreck rams nothing (AUDIT A4); a scrape along her side is no ram (AUDIT A1); a ship not fair game is bumped (AUDIT A1); the ship I am boarding is not rammed; a ram on a ship another player stands is said as a ram, its hull to her room on my copy (mutants: the price, the wreck, the brace, the Due, the closing along my keel, the fair gate, the boarding, the peer\'s blow, the ram unsaid)', () => {
  const t = standIn();
  const x = t.ship('x', 'pirateBrig');
  t.before(x);
  const k = recoilShare();
  const blow = ramBlow({ closing: 8, side: true, mine: 672, hers: x.ship.damage.maxHull });
  let mine = t.me.damage.hull, hers = x.ship.damage.hull;
  assert.equal(t.helm(8), x);
  assert.deepEqual([hers - x.ship.damage.hull, mine - t.me.damage.hull], [blow, Math.round(blow * k)], 'the blow, and its recoil');
  assert.deepEqual(t.log.charged, ['x'], 'an act of fire');
  t.me.guns.braced = true; t.o.due = 0.5;
  x.ship.damage.repair({});
  mine = t.me.damage.hull;
  t.helm(8);
  assert.equal(mine - t.me.damage.hull, Math.round(blow * k * BRACE_TAKEN * 0.5), 'braced, and the Captain\'s Due');
  t.me.guns.braced = false; t.o.due = 1;
  // battered: 31 points over my line - a recoil room of 30 - pays for 30 / k of a ram
  x.ship.damage.repair({});
  t.me.damage.repair({});
  t.me.damage.apply({ hull: t.me.damage.hull - ramLine(t.me.damage) - 31, sail: 0, crew: 0 }, 0);
  hers = x.ship.damage.hull;
  t.helm(8);
  assert.equal(hers - x.ship.damage.hull, Math.floor(30 / k), 'as hard as it pays for');
  assert.ok(t.me.damage.hull > ramLine(t.me.damage));
  // under my line: no ram at all, nothing said
  t.me.damage.apply({ hull: 100, sail: 0, crew: 0 }, 0);
  const said = t.log.mid.length;
  hers = x.ship.damage.hull;
  assert.equal(t.helm(8), null, 'a hull under its line rams nothing');
  assert.deepEqual([x.ship.damage.hull, t.log.mid.length], [hers, said]);
  // a wreck: its recoil room gone, and refused by its state besides
  t.me.damage.apply({ hull: 10000, sail: 0, crew: 0 }, 0);
  t.me.damage.repair({ hull: 400 }, { refloat: Infinity });   // mended under fire: over her line, a wreck still
  assert.deepEqual([t.me.damage.state, t.me.damage.hull > ramLine(t.me.damage) + 30], [SHIP_STATES.wrecked, true]);
  assert.equal(t.helm(8), null, 'a wreck rams nothing, mended or not');
  // a ship struck by her hands, her hull over her line: no ram
  const q = standIn();
  const qx = q.ship('q', 'merchantCoaster');
  q.before(qx);
  qx.ship.damage.apply({ hull: 0, sail: 0, crew: 1000 }, 0);
  assert.deepEqual([qx.ship.damage.state, ramRoom(qx.ship.damage) > 100], [SHIP_STATES.struck, true], 'struck with every hand down, her hull whole');
  assert.equal(q.helm(8), null, 'a struck ship is not rammed, whatever her room');
  assert.equal(qx.ship.damage.hull, qx.ship.damage.maxHull);
  // a scrape: her keel along mine, her side 0.6 m off my stem, my way along it
  const w = standIn();
  const s = w.ship('s', 'pirateBrig');
  const sb = boxOf([0, 0, 0], 0, s.ship.hull);
  s.ship.pos = [0.6 + sb.h[0] - sb.c[0], 0, hullBuild(HULL.SmallShip).bowZ - sb.c[2]];
  assert.ok(ramContact(boxOf(s.ship.pos, 0, s.ship.hull), [0, 1, hullBuild(HULL.SmallShip).bowZ])?.side, 'my stem at her side');
  assert.equal(w.helm(3), null, 'a scrape along her side closes on nothing');
  assert.equal(s.ship.damage.hull, s.ship.damage.maxHull);
  // not fair game: a bump; the ship I am boarding: none
  const u = standIn();
  const y = u.ship('y', 'merchantGalleon');
  u.before(y);
  u.o.fair = () => false;
  assert.equal(u.helm(8), null, 'not fair game: a bump');
  assert.deepEqual([y.ship.damage.hull, u.log.mid.length, u.log.charged.length], [y.ship.damage.maxHull, 0, 0], 'no blow, no word, no act of fire');
  u.o.fair = () => true; u.o.boarding = { shipId: 'y' };
  assert.equal(u.helm(8), null, 'the ship I am boarding');
  u.o.boarding = null;
  assert.equal(u.helm(8), y, 'fair game, rammed');
  assert.equal(u.log.mid.at(-1), 'You ram the ship!');
  // a ship another player stands: said as a ram, to her room as my copy has her
  const v = standIn();
  const z = v.ship('z', 'merchantGalleon', { owner: 'ann' });
  v.before(z);
  z.ship.damage.apply({ hull: Math.round(z.ship.damage.maxHull * 0.7), sail: 0, crew: 0 }, 0);
  const room = ramRoom(z.ship.damage), copy = z.ship.damage.hull;
  v.helm(8);
  const sent = validNavalHit(v.log.sent[0]);
  assert.deepEqual([v.log.sent[0].to, sent.ram, sent.zone], ['ann', true, 'holed'], 'a ram, to her stander');
  assert.equal(sent.hull, Math.ceil(room), 'bounded by her room as my copy has her');
  assert.equal(z.ship.damage.hull, copy, 'my copy hers to say');
});

test('RAM-RETURN a galley\'s ram on the module alone: it rams the ship she fights - engaged on her or closing to board - and only while she fights; a galley fleeing me with her stem in my hull, one another player stands, one being boarded and one under RAM_SPEED ram nothing; on my boat its law (her blow by the lesser hull, braced, half, under the Captain\'s Due), said, and a GALLEY_RAM-th back on her; to my line and no further, a bump at it; a wreck of mine is not rammed; a galley near her own line rams as hard as she pays for; on a ship of my sea she fights, to her line exactly and never again once struck; the ship I am boarding never (mutants: a fleeing galley rams, the brace, the Due, the cooldown, the room on mine, the room on another\'s, a struck ship rammed, the recoil\'s room, the galley\'s price, a boarded galley, another\'s galley)', () => {
  const t = standIn();
  const g = t.ship('g', 'pirateGalley', { ship: { speed: 6, mode: 'flee', target: 'me' } });
  t.galleyInto(g);
  const whole = t.me.damage.hull;
  t.step();
  assert.equal(t.me.damage.hull, whole, 'fleeing: no ram');
  for (const o of [{ owner: 'peer' }, { ship: { boarded: true } }, { ship: { speed: RAM_SPEED - 0.1 } }]) {
    Object.assign(g, o.owner ? { owner: o.owner } : {}); Object.assign(g.ship, { mode: 'engage', ...(o.ship ?? {}) });
    t.step();
    assert.equal(t.me.damage.hull, whole, JSON.stringify(o));
    g.owner = null; g.ship.boarded = false; g.ship.speed = 6;
  }
  g.ship.mode = 'board';
  t.step();
  const blow = ramBlow({ closing: 6, side: false, mine: g.ship.damage.maxHull, hers: 672, galley: true });
  assert.equal(whole - t.me.damage.hull, blow, 'closing to board, she rams my stern');
  assert.equal(t.log.mid.at(-1), 'A galley rams you!');
  assert.equal(g.ship.damage.maxHull - g.ship.damage.hull, Math.round(blow * recoilShare(true)), 'a GALLEY_RAM-th back');
  const after = t.me.damage.hull;
  t.step(RAM_COOLDOWN_S - 0.2);
  assert.equal(t.me.damage.hull, after, 'once a stretch');
  t.me.guns.braced = true; t.o.due = 0.5;
  t.step(0.3);
  assert.equal(after - t.me.damage.hull, Math.round(blow * BRACE_TAKEN * 0.5), 'braced, and the Captain\'s Due');
  t.me.guns.braced = false; t.o.due = 1;
  for (let i = 0; i < 20; i++) t.step(RAM_COOLDOWN_S + 0.1);
  assert.equal(t.me.damage.hull, ramLine(t.me.damage), 'my boat at its line exactly');
  const quiet = [t.log.mid.length, g.ship.damage.hull];
  t.step(RAM_COOLDOWN_S + 0.1);
  assert.deepEqual([t.log.mid.length, g.ship.damage.hull], quiet, 'at my line: a bump - no word, no recoil');
  assert.ok(g.ship.damage.hull > ramLine(g.ship.damage), 'her own ram never strikes her');
  t.me.damage.apply({ hull: 10000, sail: 0, crew: 0 }, 0);
  assert.equal(t.me.damage.state, SHIP_STATES.wrecked);
  const wreck = [t.me.damage.crew, g.ship.damage.hull, t.log.mid.length];
  t.step(RAM_COOLDOWN_S + 0.1);
  assert.deepEqual([t.me.damage.crew, g.ship.damage.hull, t.log.mid.length], wreck, 'a wreck is not rammed: no men, no recoil, no word');
  t.me.damage.repair({ hull: 400 }, { refloat: Infinity });   // mended under fire: over its line, a wreck still
  assert.equal(t.me.damage.state, SHIP_STATES.wrecked);
  const mended = t.me.damage.hull;
  t.step(RAM_COOLDOWN_S + 0.1);
  assert.equal(t.me.damage.hull, mended, 'a wreck is not rammed, mended or not');
  // a galley near her own line: her ram as hard as she pays for
  const t3 = standIn();
  const g3 = t3.ship('g', 'pirateGalley', { ship: { speed: 8, mode: 'engage', target: 'me' } });
  t3.galleyInto(g3);
  g3.ship.damage.apply({ hull: g3.ship.damage.hull - ramLine(g3.ship.damage) - 3.5, sail: 0, crew: 0 }, 0);
  const room3 = recoilRoom(g3.ship.damage), m3 = t3.me.damage.hull;
  assert.ok(room3 >= 1 && room3 <= 3, `a galley a few points over her line (${room3})`);
  t3.step();
  assert.equal(m3 - t3.me.damage.hull, Math.floor(room3 / recoilShare(true)), 'a few points of her room pay for ten times as many of mine');
  // on a ship of the sea she fights: to her line exactly; struck, never again
  const t2 = standIn();
  const g2 = t2.ship('g', 'pirateGalley', { ship: { speed: 6, mode: 'engage', target: 'c' } });
  const c = t2.ship('c', 'merchantCoaster', { ship: { pos: [0, 0, 400], yaw: Math.PI / 2 } });
  for (let i = 0; i < 20 && c.ship.damage.state === SHIP_STATES.afloat; i++) { t2.stemInto(g2, c); t2.step(RAM_COOLDOWN_S + 0.1); }
  assert.equal(c.ship.damage.state, SHIP_STATES.struck);
  assert.equal(c.ship.damage.hull, ramLine(c.ship.damage), 'at her line exactly');
  const n = t2.log.struck.length;
  assert.ok(n >= 3 && t2.log.struck.every(([id, , by]) => id === 'c' && by === 'g'), `${n} rams, the galley's`);
  t2.stemInto(g2, c);
  t2.step(RAM_COOLDOWN_S + 0.1);
  assert.equal(t2.log.struck.length, n, 'struck: never rammed again');
  // the ship I am boarding is no galley's to ram
  const t4 = standIn();
  const g4 = t4.ship('g', 'pirateGalley', { ship: { speed: 6, mode: 'engage', target: 'c' } });
  const c4 = t4.ship('c', 'merchantCoaster', { ship: { pos: [0, 0, 400], yaw: Math.PI / 2 } });
  t4.o.boarding = { shipId: 'c' };
  t4.stemInto(g4, c4);
  t4.step();
  assert.deepEqual(t4.log.struck, [], 'the ship I board');
});

// ── the real host ───────────────────────────────────────────────────────────────────────────────────────────────────

/** She has had my fire - provoked by me for good (navalAI.js hostile's first arm): fair game for my stem. */
const provoke = (e, id = 'local') => e.ship.provoked.set(id, Infinity);
async function helm(o = {}) {
  const h = await sea({ hull: o.hull ?? HULL.SmallShip, ...o, settings: { ShipsAtSea: 'off', Boarders: false, ...(o.settings ?? {}) } });
  const e = h.host._sea.get(h.host.spawnShip(o.ship ?? 'merchantGalleon', { range: 900 }));
  if (o.provoke !== false) provoke(e);
  return { ...h, e };
}
/** Frames with each ship held where the test put her (navaudit_helm.test.js's). */
function frames(h, held, n = 1, opts = {}) {
  for (let i = 0; i < n; i++) {
    for (const [e, p] of held) { e.ship.pos = [...p.pos]; e.ship.yaw = p.yaw ?? 0; e.ship.speed = p.speed ?? 0; e.ship.yawRate = 0; }
    h.host.frame(0.1, opts);
  }
}
/** Her keel at `yaw`, her near face `gap` past my stem as I lie at the origin facing +z (H11's `across`, any heading). */
function before(h, e, gap, yaw = Math.PI / 2, hull = h.boat.hull) {
  frames(h, [[e, { pos: [0, 0, 90], yaw }]]);
  const b = hullBoxOf(e.boat, h.pool.models);
  const ext = Math.abs(b.ax[2]) * b.h[0] + Math.abs(b.ay[2]) * b.h[1] + Math.abs(b.az[2]) * b.h[2];
  return { pos: [0, 0, 90 + hullBuild(hull).bowZ + gap - (b.c[2] - ext)], yaw };
}
/** Rammed at `v` m/s: my way on with her 30 m off, then her side under my stem (the collider having taken the way). */
function ram(h, e, v = 6, yaw = Math.PI / 2, opts = {}) {
  const touching = before(h, e, RAM_REACH / 2, yaw);
  h.runtime.state.velocityCurrent = [0, 0, v];
  frames(h, [[e, before(h, e, 30, yaw)]], 1, opts);
  h.runtime.state.velocityCurrent = [0, 0, 0.1];
  frames(h, [[e, touching]], 1, opts);
  return touching;
}
/** Past the cooldown, my way off, her well clear. */
function rest(h, e) {
  h.runtime.state.velocityCurrent = [0, 0, 0];
  frames(h, [[e, { pos: [0, 0, 600], yaw: 0 }]], Math.ceil(RAM_COOLDOWN_S * 10) + 1);
}
const mine = (h) => h.host.hudModel().ship.hull * hullBuild(h.boat.hull).hullHp;

test('RAM-RETURN my helm\'s ram on the real host (AUDIT NAV1 H11\'s finding kept): from my own stem within RAM_REACH of her box, at the way I came in with - the most of the last RAM_MEMORY_S - toward the face it meets, less hers; the blow her hull takes and the recoil mine takes, said, an act of fire; the way spent on the first; once a stretch; out of reach, a way long spent and a ship sailing on ahead nothing; into her stern RAM_GLANCE of it; braced, half the recoil; a galley\'s ram GALLEY_SHARE, a GALLEY_RAM-th back (mutants: the ram unchecked, the way forgotten, her way ignored, the way unspent, the cooldown, the recoil, the act unsaid, the face)', async () => {
  const h = await helm();
  const hers = () => h.e.ship.damage.hull;
  const full = hers(), mine0 = mine(h);
  h.runtime.state.velocityCurrent = [0, 0, 0];
  frames(h, [[h.e, before(h, h.e, RAM_REACH / 2)]], 2);
  assert.equal(hers(), full, 'lying still at her side: nothing');
  const touching = ram(h, h.e, 6);
  const blow = ramBlow({ closing: 6, side: true, mine: 672, hers: full });
  assert.equal(full - hers(), blow, 'the blow');
  near(mine(h), mine0 - Math.round(blow * recoilShare()), 0.01, 'BOW_RECOIL x RAM_RECOIL back');
  assert.equal(h.log.mid.at(-1), 'You ram the ship!');
  assert.ok(h.e.charged?.has('fire'), 'an act of fire');
  assert.equal(h.e.ship.damage.state, SHIP_STATES.afloat, 'a sound ship rammed fights on - no boarding');
  assert.equal(h.host.hudModel().board, null);
  const other = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 900 }));
  provoke(other);
  frames(h, [[h.e, { pos: [0, 0, 400], yaw: 0 }], [other, { pos: [0, 0, 500], yaw: 0 }]], 2);
  frames(h, [[h.e, { pos: [0, 0, 400], yaw: 0 }], [other, touching]]);
  assert.equal(other.ship.damage.hull, other.ship.damage.maxHull, 'the way spent on the first');
  h.runtime.state.velocityCurrent = [0, 0, 6];
  frames(h, [[h.e, touching], [other, { pos: [0, 0, 500], yaw: 0 }]], Math.floor(RAM_COOLDOWN_S * 10) - 5);
  assert.equal(full - hers(), blow, 'once a stretch');
  const h2 = await helm();
  h2.runtime.state.velocityCurrent = [0, 0, 6];
  frames(h2, [[h2.e, before(h2, h2.e, RAM_REACH + 0.6)]], 3);
  assert.equal(h2.e.ship.damage.hull, h2.e.ship.damage.maxHull, 'her planking out of the stem\'s reach');
  frames(h2, [[h2.e, before(h2, h2.e, 30)]]);
  h2.runtime.state.velocityCurrent = [0, 0, 0.1];
  frames(h2, [[h2.e, before(h2, h2.e, 30)]], Math.ceil(RAM_MEMORY_S * 10) + 1);
  frames(h2, [[h2.e, before(h2, h2.e, RAM_REACH / 2)]]);
  assert.equal(h2.e.ship.damage.hull, h2.e.ship.damage.maxHull, 'a way long spent is no ram');
  const h3 = await helm();
  const ahead = { ...before(h3, h3.e, RAM_REACH / 2, 0), speed: 5 };
  h3.runtime.state.velocityCurrent = [0, 0, 6];
  frames(h3, [[h3.e, ahead]], 3);
  assert.equal(h3.e.ship.damage.hull, h3.e.ship.damage.maxHull, 'closing at 1 m/s: a bump');
  const h5 = await helm();
  const f5 = h5.e.ship.damage.hull;
  ram(h5, h5.e, 6, 0);
  assert.equal(f5 - h5.e.ship.damage.hull, Math.round(0.15 * Math.min(672, f5) * 0.75 * RAM_GLANCE), 'into her stern: RAM_GLANCE');
  const h4 = await helm();
  const m4 = mine(h4);
  ram(h4, h4.e, 6, Math.PI / 2, { brace: true });
  near(mine(h4), m4 - Math.round(blow * recoilShare() * BRACE_TAKEN), 0.01, 'braced for it');
  const g = await helm({ hull: HULL.LargeGalley });
  const gm = mine(g), gfull = g.e.ship.damage.hull;
  ram(g, g.e, 6);
  const gd = ramBlow({ closing: 6, side: true, mine: hullBuild(HULL.LargeGalley).hullHp, hers: gfull, galley: true });
  assert.equal(gfull - g.e.ship.damage.hull, gd, 'GALLEY_SHARE');
  near(mine(g), gm - Math.round(gd * recoilShare(true)), 0.01, 'a GALLEY_RAM-th back');
  assert.equal(g.log.mid.at(-1), 'Your ram smashes into the hull!');
});

test('RAM-RETURN AUDIT A1 on the real host: a lawful ship at peace with me is bumped, never rammed - a merchantman and a crown\'s cutter under my stem at docking way and at a ram\'s way take nothing, nothing is said, no piracy is charged and nobody is provoked; a pirate is fair game unprovoked, and a merchantman once she has had my fire (mutants: the fair gate)', async () => {
  for (const cls of ['merchantGalleon', 'navyCutter']) {
    for (const v of [1.7, 6]) {
      const h = await helm({ ship: cls, provoke: false });
      ram(h, h.e, v);
      frames(h, [[h.e, before(h, h.e, RAM_REACH / 2)]], 2);
      assert.equal(h.e.ship.damage.hull, h.e.ship.damage.maxHull, `${cls} at ${v} m/s: bumped`);
      assert.deepEqual([h.log.mid.length, h.e.charged?.has('fire') ?? false, h.e.ship.provoked.has('local')], [0, false, false], 'no word, no charge, no feud');
      assert.ok(!h.log.say.some((x) => /Piracy/.test(x)), 'no piracy');
    }
  }
  const p = await helm({ ship: 'pirateBrig', provoke: false });
  ram(p, p.e, 6);
  assert.ok(p.e.ship.damage.hull < p.e.ship.damage.maxHull, 'a pirate is fair game');
  const m = await helm({ ship: 'merchantGalleon' });
  ram(m, m.e, 6);
  assert.ok(m.e.ship.damage.hull < m.e.ship.damage.maxHull, 'a merchantman once she has had my fire');
});

test('RAM-RETURN rammed to her line and no further, on the real host: a galley\'s rams on a Coasting Trader - each GALLEY_SHARE of her hull at the most, none sinking her - and a galleon\'s plain stem\'s, RAM_SHARE, bring her colours down exactly at her line; struck, she is not rammed again and the grapples are the key\'s, "E: board" (BOARD-MAGNET); my own hull over its line (mutants: the room, a struck ship rammed)', async () => {
  const toStrike = (h, most = 12) => {
    const d = h.e.ship.damage, blows = [];
    for (let i = 0; i < most && d.state === SHIP_STATES.afloat; i++) {
      const was = d.hull;
      ram(h, h.e, 8);
      blows.push(was - d.hull);
      assert.notEqual(d.state, SHIP_STATES.sinking, 'never sunk by a ram');
      if (d.state === SHIP_STATES.afloat) rest(h, h.e);
    }
    return blows;
  };
  const g = await helm({ hull: HULL.LargeGalley, ship: 'merchantCoaster' });
  const d = g.e.ship.damage;
  const blows = toStrike(g);
  assert.equal(d.state, SHIP_STATES.struck, `struck after ${blows.join(', ')}`);
  assert.equal(blows[0], Math.round(GALLEY_SHARE * d.maxHull), 'a whole ram of a galley\'s');
  assert.ok(blows.length >= 3 && blows.every((x) => x <= blows[0]), `each a share: ${blows}`);
  assert.equal(d.hull, ramLine(d), 'at her line exactly');
  assert.ok(mine(g) > hullBuild(HULL.LargeGalley).hullHp * STRUCK_AT, 'mine over its line');
  const struckHull = d.hull, said = g.log.mid.length;
  rest(g, g.e);
  ram(g, g.e, 8);
  assert.deepEqual([d.hull, g.log.mid.length], [struckHull, said], 'a struck ship is not rammed, nor any ram said');
  const h = await helm({ ship: 'merchantCoaster' });
  const plain = toStrike(h);
  assert.equal(h.e.ship.damage.state, SHIP_STATES.struck, `struck after ${plain.join(', ')}`);
  assert.equal(plain[0], Math.round(RAM_SHARE * h.e.ship.damage.maxHull));
  assert.ok(plain.length >= 5, `${plain.length} rams`);
  frames(h, [[h.e, before(h, h.e, RAM_REACH / 2)]]);
  assert.equal(h.host.hudModel().board?.kind, 'board', 'E: board');
});

test('RAM-RETURN a galley rams the ship she fights, on the real host: a corsair galley engaged on me, her stem at my stern - my hull takes her ram on its law (braced, half) and she a GALLEY_RAM-th back; a War Galley under the same stem, fighting no one, rams nothing; a galley engaged on a merchantman rams her to strike exactly at her line, and a sister ship under her stem never (mutants: the galleys unchecked, a friend rammed)', async () => {
  const b = hullBuild(HULL.LargeGalley);
  const run = async (brace, cls = 'pirateGalley') => {
    const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
    const gal = h.host._sea.get(h.host.spawnShip(cls, { range: 200, bearing: 0 }));
    const mb = hullBoxOf(h.boat, h.pool.models);
    gal.ship.pos = [0, 0, mb.c[2] - mb.h[2] - 0.2 - b.bowZ]; gal.ship.yaw = 0; gal.ship.speed = 5.6; gal.ship.course = [0, 5000];
    const h0 = mine(h);
    h.host.frame(0.1, { brace });
    return { h, gal, took: h0 - mine(h) };
  };
  const { h, gal, took } = await run(false);
  assert.equal(gal.ship.mode, 'engage');
  const at = (closing) => ramBlow({ closing, side: false, mine: gal.ship.damage.maxHull, hers: 672, galley: true });
  assert.ok(took >= at(5) && took <= at(5.6), `her ram into my stern: ${took} in ${at(5)}..${at(5.6)}`);
  assert.equal(h.log.mid.at(-1), 'A galley rams you!');
  assert.ok(gal.ship.damage.hullShare() < 1, 'she takes a share back');
  near((await run(true)).took, took * BRACE_TAKEN, 1.01, 'braced: half');
  const navy = await run(false, 'navyGalley');
  assert.notEqual(navy.gal.ship.mode, 'engage');
  assert.equal(navy.took, 0, 'a War Galley fighting no one rams nothing');
  const s = await sea({ hull: null });
  const g = s.host._sea.get(s.host.spawnShip('pirateGalley', { range: 400, bearing: 0, temper: 'bold' }));
  const c = s.host._sea.get(s.host.spawnShip('merchantCoaster', { range: 700, bearing: 0 }));
  const by = s.host._sea.get(s.host.spawnShip('pirateSloop', { range: 700, bearing: 90 }));   // her own trade's: never hers to fight
  for (let i = 0; i < 20 && !(g.boat && c.boat && by.boat); i++) s.host.frame(0.1);
  assert.ok(g.boat && c.boat && by.boat, 'the hulls built');
  const place = (x, speed) => {
    x.ship.pos = [0, 0, 400]; x.ship.yaw = Math.PI / 2; x.ship.speed = 0;
    g.ship.pos = [0, 0, 400 - hullBuild(HULL.LargeBoat).halfWidth - 0.3 - b.bowZ]; g.ship.yaw = 0; g.ship.speed = speed;
  };
  const engage = (x) => { g.ship.mode = 'engage'; g.ship.target = x.id; };
  c.ship.pos = [-300, 0, 700];
  place(by, 0); engage(c); s.host.frame(0.1);
  place(by, RAM_SPEED + 4); engage(c); s.host.frame(0.1);
  assert.notEqual(g.ship.target, by.id);
  assert.equal(by.ship.damage.hullShare(), 1, 'a ship she does not fight - her own trade\'s, under her stem - is bumped, never rammed');
  by.ship.pos = [300, 0, 700];
  for (let i = 0; i < 300 && c.ship.damage.state === SHIP_STATES.afloat; i++) { by.ship.pos = [300, 0, 700]; place(c, RAM_SPEED + 4); engage(c); s.host.frame(0.1); }
  assert.equal(c.ship.damage.state, SHIP_STATES.struck, `struck, not ${c.ship.damage.state}`);
  assert.equal(c.ship.damage.hull, ramLine(c.ship.damage), 'at her line exactly');
});

// ── online ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('RAM-RETURN online, the rammer: a ram on a ship another player stands is sent as a ram (`r`) - holed, its men - bounded by her room as her word has her; my copy of her untouched (mutants: the ram unsaid)', async () => {
  const sent = [];
  const h = await sea({ hull: HULL.SmallShip, online: { id: () => 'a-player', peers: () => [], sendHit: (d) => { sent.push(d); return true; } }, pool: await freshPool(), settings: { ShipsAtSea: 'off', Boarders: false } });
  const w = (pos, hull = 1) => navalWireRecord({ ships: [{ n: 4, classId: 'merchantGalleon', variant: 0, pos, yaw: Math.PI / 2, speed: 0, sails: 0, hull, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 99, fire: false, gen: 0, region: 17 }] });
  h.host.applyWord('b-player', w([0, 0, 200], 0.3), (p) => p);
  h.run(0.3);
  const e = h.host._sea.get('b-player:4');
  assert.ok(e?.boat, 'her copy stands, a hull of her own');
  provoke(e, 'a-player');
  h.runtime.state.velocityCurrent = [0, 0, 6];
  h.host.applyWord('b-player', w([0, 0, 40], 0.3), (p) => p);
  h.run(0.3);
  for (let z = 24; z >= 4 && !sent.length; z -= 1) {
    h.host.applyWord('b-player', w([0, 0, z], 0.3), (p) => p);
    e.ship.pos = [0, 0, z]; e.target = { ...e.target, pos: [0, 0, z], speed: 0 };
    h.host.frame(0.1);
  }
  const blow = sent.find((d) => d?.nv && d.to === 'b-player');
  assert.ok(blow, 'her blow sent to her stander');
  const hit = validNavalHit(blow);
  const room = Math.ceil(e.ship.damage.maxHull * (0.3 - STRUCK_AT));
  assert.ok(hit.hull > 0 && hit.hull <= room, `bounded by her room: ${hit.hull} of ${room}`);
  assert.deepEqual([hit.zone, hit.ram], ['holed', true], 'holed, and a ram');
  near(e.ship.damage.hullShare(), 0.3, 1e-9, 'my copy hers to say');
});

test('RAM-RETURN AUDIT A3 online, the stander: another player\'s ram on a ship I stand lands at her line as I stand her - however stale their copy of her was - and on one struck since it was sent, not at all; a ball\'s blow of the same weight is no ram\'s and takes her past it (mutants: the stander\'s line unread, a struck ship rammed by a word)', async () => {
  const stood = async () => {
    const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false } });
    const e = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 900 }));
    h.run(0.2);
    e.ship.damage.apply({ hull: Math.round(e.ship.damage.maxHull * 0.72), sail: 0, crew: 0 }, 0);   // 28% hers in truth - a rammer's stale copy said 55%
    return { h, e, d: e.ship.damage };
  };
  const { h, e, d } = await stood();
  const ramHit = navalHitData('local', { n: e.n, hull: 161, crew: 4, zone: 'holed', ram: true });
  assert.equal(h.host.applyPeerHit('ann', ramHit), true);
  assert.deepEqual([d.hull, d.state], [ramLine(d), SHIP_STATES.struck], 'to her line exactly, and she strikes');
  assert.equal(h.host.applyPeerHit('ann', ramHit), true);
  assert.equal(d.hull, ramLine(d), 'struck since: the ram lands nothing');
  const hands = await stood();
  hands.d.apply({ hull: 0, sail: 0, crew: 1000 }, 0);   // struck since, every hand down - her hull well over her line
  const was = hands.d.hull;
  hands.h.host.applyPeerHit('ann', navalHitData('local', { n: hands.e.n, hull: 161, crew: 4, zone: 'holed', ram: true }));
  assert.deepEqual([hands.d.state, hands.d.hull], [SHIP_STATES.struck, was], 'a ship struck since takes no ram, whatever her room');
  const ball = await stood();
  ball.h.host.applyPeerHit('ann', navalHitData('local', { n: ball.e.n, hull: 161, crew: 4, zone: 'holed' }));
  assert.ok(ball.d.hull < ramLine(ball.d), 'a ball\'s blow is no ram\'s');
});

// ── a booked ship ───────────────────────────────────────────────────────────────────────────────────────────────────

test('RAM-RETURN FERRY-CLEAR a booked ship\'s master never rams: her stem in a ship\'s side at a ram\'s way deals nothing, takes nothing back, says nothing and charges nobody - the same stem on a boat of mine rams (mutants: the charter unread)', async () => {
  const h = await helm();
  h.boat.charter = { v: 1, ship: 'Sea Hare', to: 'Daggerfall' };
  const full = h.e.ship.damage.hull, m0 = mine(h);
  ram(h, h.e, 6);
  frames(h, [[h.e, before(h, h.e, RAM_REACH / 2)]], 2);
  assert.equal(h.e.ship.damage.hull, full, 'her hull whole');
  assert.equal(mine(h), m0, 'nothing back on the booked ship');
  assert.ok(!h.e.charged?.has('fire'), 'no charge of piracy');
  delete h.boat.charter;
  rest(h, h.e);
  ram(h, h.e, 6);
  assert.ok(h.e.ship.damage.hull < full, 'a boat of mine rams');
});
