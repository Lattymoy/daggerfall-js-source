// AUDIT NAV2 (2026-09-30, Mac: "Let's do a deep comprehensive audit on everything developed thus far") - BOARDING, of
// the sea's second pass (bible/01-Overview/audits/Audit-NAV2.md): the boarding's bodies shared with the room (Mac's call:
// "Share it now") and never a save's; a Warm Ashes raid fought by my hands too; each man of hers stood as himself on a
// spot of his own, and never on another body or the landing; a repel's boarders thrown back leaving her struck; a
// raid's waves over my rail first; a hand that falls stays fallen. The real naval host over Come Sail Away's real pool
// (test/navalSea.mjs), and world.js's boarding door lifted over the real exterior foe pool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea } from '../navalSea.mjs';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { isShipmate } from '../../src/combat/friendlyFire.js';
import { DECK_SPOTS } from '../../src/scenes/naval/navalHost.js';
import { GRAPPLE_S, CREW_PER_HAND, MOBILE } from '../../src/systems/naval/navalBoarding.js';
import { SHIP_STATES } from '../../src/systems/naval/navalDamage.js';

const WORLD = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const WRECKED = { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] };
const raidQuest = (uid) => (name) => ({ uid, name, tasks: new Map() });
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function place(h, classId, pos, yaw = 0) {
  const e = h.host._sea.get(h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]), yaw }));
  e.ship.pos = [...pos];
  h.host.frame(0.1);
  assert.ok(e.boat, 'built');
  return e;
}
/** A pirate alongside my wrecked boat, grappled and the fight begun - a raid's quest when `quest`. */
async function repelled(classId, o = {}) {
  const h = await sea({ hull: o.hull ?? 2, save: WRECKED, raidQuest: o.quest ? raidQuest(o.quest) : undefined });
  if (o.before) o.before(h);
  const p = place(h, classId, [16, 0, 0], 0);
  h.run(0.5);
  assert.equal(h.host.boarding?.kind, 'repel');
  h.run(GRAPPLE_S + 0.2);
  return { h, p };
}
/** I board a struck merchantman - `before(h, e)` sets the world's doors first. */
async function boardHer(before = null) {
  const h = await sea({ hull: 2 });
  const e = place(h, 'merchantGalleon', [7.4 + 7.4 + 12, 0, 0], 0);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  before?.(h, e);
  h.host.frame(0.1);
  assert.equal(h.host.activate(), true, 'the grapples');
  h.run(GRAPPLE_S + 0.3);
  assert.equal(h.host.boarding?.phase, 'fight');
  return { h, e };
}
const stoodAt = (h) => h.log.foes.map((f) => f.pos);
function leastGap(points) {
  let least = Infinity;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) least = Math.min(least, flat(points[i], points[j]));
  return least;
}

// ── the real exterior foe pool (test/systems/naval/deckwalk.test.js's crafted MONSTER.BSA and CLASS cfgs) ─────────────────────────
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  [40, 50, 50, 85, 50, 50, 90, 55].forEach((a, i) => v.setUint16(58 + i * 2, a, true));
  return b;
}
function craftMonsterBsa() {
  const bytes = craftCfg(), out = new Uint8Array(4 + bytes.length + 18); const v = new DataView(out.buffer);
  v.setInt16(0, 1, true); v.setUint16(2, 0x0100, true);
  out.set(bytes, 4);
  const at = 4 + bytes.length;
  for (const [i, c] of [...'ENEMY000.CFG'].entries()) out[at + i] = c.charCodeAt(0);
  v.setInt32(at + 14, bytes.length, true);
  return out;
}
const BSA = craftMonsterBsa();
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = () => new Promise((r) => setTimeout(r, 0));
function foesPool(self) {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return BSA; if (/^CLASS\d\d\.CFG$/.test(n)) return craftCfg(); throw new Error(`no ${n}`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: { isPlayer: true, level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) },
    audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  return p;
}
/** world.js's boarding door (navalSpawnFoe) and its deck mark (navalDeckBody), lifted whole over a pool. */
function spawnDoor(exteriorFoes) {
  const i = WORLD.indexOf('  const navalSpawnFoe = (mobile, feet, yaw, side,');
  const src = WORLD.slice(i, WORLD.indexOf('\n  };\n', i) + 6);
  const d = WORLD.indexOf('  const navalDeckBody = (f, boat) =>');
  const body = `const _deckBodies = new Set();\n${WORLD.slice(d, WORLD.indexOf('\n', d) + 1)}\nconst navalStandDown = () => {};\n${src}\nreturn navalSpawnFoe;`;
  // eslint-disable-next-line no-new-func
  return new Function('exteriorFoes', body)(exteriorFoes);
}

test('AUDIT NAV2 F12/F13 (Mac: "Share it now"): a boarding\'s bodies ride the foes frame - her men and my hands, my hands named my crew (`cw`), so a reader stands her men as foes and my hands as its allies, spared by its own harm - and none of them is a save\'s (mutants: placed kept, transient dropped)', async () => {
  const owner = foesPool('aaa-0001'), reader = foesPool('mmm-0002');
  const navalSpawnFoe = spawnDoor(owner);
  const herBoat = { GameObject: { activeSelf: true } };
  const hand = navalSpawnFoe(MOBILE.Warrior, [100, 0, 100], 0, 'ally', { boat: herBoat });
  const pirate = navalSpawnFoe(MOBILE.Rogue, [102, 0, 100], 0, 'enemy', { boat: herBoat, team: 'Criminals' });
  for (let k = 0; k < 10; k++) await settle();
  assert.ok(hand.foe && pirate.foe, 'both stood');
  assert.equal(isShipmate(hand.foe), true);
  const fr = owner.foesFrame(true);
  const ids = new Set((fr?.f ?? []).map((r) => r.i));
  assert.ok(ids.has(hand.foe.seq) && ids.has(pirate.foe.seq), 'her man and my hand ride');
  assert.deepEqual(fr.cw, [hand.foe.seq], 'my hand named my crew');
  reader.applyFoes('aaa-0001', fr);
  for (let k = 0; k < 10; k++) await settle();
  const puppets = reader.foes.filter((f) => f.puppet === 'aaa-0001');
  assert.equal(puppets.length, 2, 'the reader stands both');
  assert.equal(puppets.filter((f) => isShipmate(f)).length, 1, 'my hand its ally, spared by its harm');
  assert.equal(owner.snapshotWorld((p) => p).length, 0, 'no boarding body is a save\'s (a won prize\'s men stood over open water on a load)');
});

test('AUDIT NAV2 F44/F32: her men stand as themselves on spots of their own - each his own class where he stood; my hands on rail spots no other body holds, never on the landing; a short deck stands no more bodies than it has room for (mutants: the muster\'s class for the man, the rail dealt blind, the dealer\'s round)', async () => {
  const her = [
    { mobile: MOBILE.Spellsword, feet: [30, 5, 0], yaw: 0, gender: 'male' },
    { mobile: MOBILE.Archer, feet: [30, 5, 2], yaw: 0, gender: 'female' },
    { mobile: MOBILE.Barbarian, feet: [30, 5, 4], yaw: 0, gender: 'male' },
    { mobile: MOBILE.Rogue, feet: [30, 5, 4], yaw: 0, gender: 'male' },   // two of hers merged on one spot (the living crew's stacking): one moves
  ];
  const { h } = await boardHer((hh, e) => {
    hh.deps.board.crewOf = (boat, n) => (boat === e.boat ? her.slice(0, Math.min(n, her.length)) : []);
    hh.deps.board.landing = () => [[26, 5, 0], 0];
    // the rail across from me: every spot one her men or my landing holds, then two free
    hh.deps.board.railSpots = (_b, _t, n) => [[[30, 5, 0], 0], [[26, 5, 0], 0], [[30, 5, 2], 0], [[40, 5, 6], 0], [[40, 5, 8], 0]].slice(0, Math.max(n, 5));
    hh.deps.board.deckSpots = (_b, n) => Array.from({ length: n }, (_, i) => [[50 + i, 5, 20], 0]);
  });
  const enemies = h.log.foes.filter((f) => f.side === 'enemy');
  for (let i = 0; i < her.length; i++) assert.equal(enemies[i].mobile, her[i].mobile, `her man #${i} stands as himself`);
  assert.deepEqual(enemies.slice(0, 3).map((f) => f.pos), her.slice(0, 3).map((m) => m.feet), 'where they stood');
  assert.ok(flat(enemies[3].pos, her[3].feet) >= 0.6, 'the second on a held spot stands on one of his own');
  const allies = h.log.foes.filter((f) => f.side === 'ally');
  assert.ok(allies.length > 0);
  const others = [...enemies.map((f) => f.pos), [26, 5, 0]];
  for (const a of allies) assert.ok(Math.min(...others.map((p) => flat(p, a.pos))) >= 0.6, `a hand clear of every body and the landing: ${a.pos}`);
  assert.ok(leastGap(stoodAt(h)) >= 0.6, 'no two bodies on one spot');

  // a short deck: three spots and a rail that repeats one cell - no body stood on another
  const short = await boardHer((hh) => {
    hh.deps.board.crewOf = () => [];
    hh.deps.board.landing = () => [[20, 5, 0], 0];
    hh.deps.board.railSpots = (_b, _t, n) => Array.from({ length: n }, () => [[22, 5, 0], 0]);
    hh.deps.board.deckSpots = () => [[[22, 5, 0], 0], [[23, 5, 0], 0], [[24, 5, 0], 0]];
  });
  assert.ok(leastGap([...stoodAt(short.h), [20, 5, 0]]) >= 0.6, 'every body a spot of its own (AUDIT NAV1 B10), the landing clear');
});

test('AUDIT NAV2 F32: a repel stands no body on me - her party and my hands on spots clear of where I stand (mutant: my feet unheld)', async () => {
  const { h } = await repelled('pirateBrig', { before: (hh) => { hh.deps.board.deckSpots = (_b, n) => Array.from({ length: n }, (_, i) => [[i * 0.3, 5, 0], 0]); } });
  assert.ok(h.log.foes.length > 0);
  for (const f of h.log.foes) assert.ok(flat(f.pos, h.view.feet) >= 0.6, `a body stood on me: ${f.pos}`);
});

test('AUDIT NAV2 F19: boarders thrown back leave her struck by her hull at the share NAV-R set, her fires out - the crew line first struck her unmanned at 95% and burning, and the hull line never ran (mutant: the hull line under the afloat test again)', async () => {
  const { h, p } = await repelled('pirateBrig');
  p.ship.damage.apply({ hull: 0, sail: 0, crew: 0, fire: true }, 0);
  assert.ok(p.ship.damage.fires > 0, 'burning');
  for (const f of h.log.foes.filter((x) => x.side === 'enemy')) f.dead = true;
  h.run(0.3);
  assert.equal(h.host.boarding, null, 'thrown back');
  assert.equal(p.ship.damage.state, SHIP_STATES.struck);
  assert.ok(p.ship.damage.hullShare() <= 0.25, `her hull knocked down: ${p.ship.damage.hullShare()}`);
  assert.equal(p.ship.damage.fires, 0, 'her fires out');
});

test('AUDIT NAV2 F37: a raid\'s waves come over my rail first - the rail spots dealt before the deck\'s, each shuffled in its own (mutant: one shuffle of both)', async () => {
  const { h } = await repelled('pirateBrig', {
    quest: 21,
    before: (hh) => {
      hh.deps.board.railSpots = (_b, _t, n) => Array.from({ length: n }, (_, i) => [[i, 77, 0], 0]);
      hh.deps.board.deckSpots = (_b, n) => Array.from({ length: n }, (_, i) => [[i, 5, 0], 0]);
    },
  });
  const quest = h.host.boarding.quest;
  const first = Array.from({ length: DECK_SPOTS / 2 }, () => h.host.placeQuestFoe(quest));
  assert.ok(first.every((s) => s && s[0][1] === 77), `the first ${DECK_SPOTS / 2} over the rail: ${first.map((s) => s?.[0][1])}`);
});

test('AUDIT NAV2 F49: a hand that falls stays fallen - his CREW_PER_HAND off my boat\'s crew when the fight ends, so my living crew stands one man short, not whole again beside his body (mutant: the fallen uncounted)', async () => {
  const h = await sea({ hull: 2 });
  const e = place(h, 'merchantGalleon', [7.4 + 7.4 + 12, 0, 0], 0);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  h.host.frame(0.1);
  assert.equal(h.host.activate(), true);
  h.run(GRAPPLE_S + 0.3);
  const crew = () => h.host.myCrew(h.boat)?.crew;
  const before = crew();
  const hands = h.log.foes.filter((f) => f.side === 'ally');
  assert.ok(hands.length >= 2);
  hands[0].dead = true;   // one of mine falls
  for (const f of h.log.foes.filter((x) => x.side === 'enemy')) f.dead = true;
  h.run(0.3);
  assert.equal(h.host.boarding, null, 'won');
  assert.equal(crew(), before - CREW_PER_HAND, 'his share of her crew gone with him');
});

test('AUDIT NAV2 F12: a boarding\'s bodies go with their boarder - no foe handover (at a door, a room left, a foe walked away from) names an heir for a body on a deck: an heir stood her men as plain foes on a deck with no leash and no boarding, beside the ship her crew had just been held off (mutant: any one heirOf without the deck test)', () => {
  const heirs = [...WORLD.matchAll(/const heirOf = \(f\) => \{[^]*?return id;/g)].map((m) => m[0]);
  assert.equal(heirs.length, 4, 'the world\'s four foe handovers (AUDIT WB12d C2: a site\'s foes at a teleport and the page\'s going)');
  for (const h of heirs) assert.match(h, /f\.deckBoat != null/, h.slice(0, 120));
});
