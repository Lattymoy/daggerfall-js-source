// STAR5 (bible/11-Multiplayer/Starfall.md section 4): THE DEFENSE'S LAW ON THE CLIENT - what the coven sends by band
// (only foes a band's players can hurt), its masters and their circles, where they stand, the word a defender says; the
// star as a body only its own coven's monsters hunt; the circle's ward on the master, through the foe pool's one door;
// and the star's sites on the camps' law. tools/mutants/star5.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STAR_ROSTERS, STAR_MEMBERS, MEMBER, STAR_MASTERS, STAR_MASTER_TABLE, covenFemale, starWaveFoes, starMasterOf, starCircleFoes,
} from '../../../src/systems/starfall/starCoven.js';
import {
  starClockPhase, starStandPlaces, starCirclePlaces, starWordOf, starWordKey, STAR_STAND_R, STAR_CIRCLE_R, STAR_SAY_M,
} from '../../../src/systems/starfall/starfallClient.js';
import { starTimes, starRoll, STAR_WAVES, STAR_REACH_M, STAR_CIRCLE_SHARE } from '../../../src/net/starfall/starfallLaw.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { MOBILE_TYPES as M } from '../../../src/characters/mobile/mobileTypes.js';
import { getTargets, huntsStar, STAR_HUNT_PRIORITY, PLAYER_TARGET } from '../../../src/characters/enemy/enemyTargets.js';
import { EnemyAI } from '../../../src/characters/enemy/enemyMotor.js';
import { Collider } from '../../../src/player/collider.js';
import { createExteriorFoes } from '../../../src/scenes/exteriorFoes.js';
import { WOD_SITE_RE, starSiteId, wodSiteId } from '../../../src/world/worldOfDaggerfall/wodShared.js';
import { starSiteKey } from '../../../src/systems/starfall/starfallSites.js';
import { STAR_BARE_R } from '../../../src/world/starfall/starModel.js';

const N = 493_210;
/** Daggerfall's weapon metals (WeaponMaterialTypes): iron 0, silver 2, mithril 5. */
const IRON = 0, SILVER = 2, MITHRIL = 5;
const metal = (career) => ENEMY_BASICS[career]?.minMetalToHit ?? -1;

test('STAR5 THE ROSTERS: four waves a band, each a foe its players can hurt - the first band nothing past iron, the second nothing past silver, the third the Daedra and the dead that want mithril; the first wave the coven\'s own hands; no Imp (mutants: a roster\'s foe, a bound)', () => {
  const bound = { 1: IRON, 2: SILVER, 3: MITHRIL };
  for (const b of [1, 2, 3]) {
    assert.equal(STAR_ROSTERS[b].length, STAR_WAVES);
    assert.deepEqual([...STAR_ROSTERS[b][0]], [MEMBER], 'the first wave the coven\'s own');
    for (const w of STAR_ROSTERS[b]) for (const c of w) {
      const careers = c === MEMBER ? STAR_MEMBERS : [c];
      for (const k of careers) assert.ok(metal(k) <= bound[b], `band ${b}: ${k} wants metal ${metal(k)}`);
    }
  }
  assert.ok(STAR_ROSTERS[3].flat().some((c) => metal(c) === MITHRIL), 'the third band wants mithril');
  assert.ok(!Object.values(STAR_ROSTERS).flat(2).includes(M.Imp), 'no Imp: it wants steel');
  assert.deepEqual(STAR_MEMBERS, [M.Mage, M.Sorcerer, M.Battlemage, M.Nightblade]);
  for (const c of STAR_MEMBERS) assert.equal(covenFemale(c), true);
  assert.equal(covenFemale(M.DaedraSeducer), true);
  assert.equal(covenFemale(M.Spider), false);
  assert.equal(covenFemale(M.DaedraLord), false);
});

test('STAR5 A WAVE\'S FOES: its size, each off its own roster by the star\'s own roll, a member\'s place a member\'s career; the same star the same foes on every screen; a band or a wave out of range clamped (mutants: the roll\'s seed, the clamp, the member\'s pick)', () => {
  for (const b of [1, 2, 3]) for (let w = 1; w <= STAR_WAVES; w++) {
    const fs = starWaveFoes(N, 1, w, 7, b);
    assert.equal(fs.length, 7);
    const roster = STAR_ROSTERS[b][w - 1];
    for (const c of fs) assert.ok(roster.includes(c) || (roster.includes(MEMBER) && STAR_MEMBERS.includes(c)), `band ${b} wave ${w}: ${c}`);
    assert.deepEqual(starWaveFoes(N, 1, w, 7, b), fs, 'the same everywhere');
  }
  assert.ok(new Set(starWaveFoes(N, 0, 1, 40, 1)).size > 1, 'the first wave\'s members of more than one career');
  assert.notDeepEqual(starWaveFoes(N, 0, 2, 9, 2), starWaveFoes(N, 1, 2, 9, 2), 'each star its own');
  assert.deepEqual(starWaveFoes(N, 1, 2, 5, 0), starWaveFoes(N, 1, 2, 5, 1));
  assert.deepEqual(starWaveFoes(N, 1, 2, 5, 9), starWaveFoes(N, 1, 2, 5, 3));
  assert.deepEqual(starWaveFoes(N, 1, 2, -3, 1), []);
  assert.ok(starWaveFoes(N, 1, 9, 5, 1).every((c) => STAR_ROSTERS[1][STAR_WAVES - 1].includes(c)), 'a wave past the last is the last');
});

test('STAR5 THE MASTERS: the Coven Mother in the first band; in the second the coven\'s Flesh Atronach for the second star; in the third a Daedra Lord, Mephala\'s Seducer, an Ancient Lich - each by name and its own call; the circle off the fourth wave\'s roster, its own rolls (mutants: the table, a call, the circle\'s roster)', () => {
  assert.deepEqual(STAR_MASTER_TABLE, { 1: ['mother', 'mother', 'mother'], 2: ['mother', 'flesh', 'mother'], 3: ['lord', 'seducer', 'lich'] });
  assert.equal(starMasterOf(1, 2).career, M.Sorcerer);
  assert.equal(starMasterOf(2, 1).career, M.FleshAtronach);
  assert.deepEqual([0, 1, 2].map((k) => starMasterOf(3, k).career), [M.DaedraLord, M.DaedraSeducer, M.AncientLich]);
  assert.equal(starMasterOf(0, 9), starMasterOf(1, 2), 'clamped');
  assert.equal(starMasterOf(1, 0).name(), 'The Coven Mother');
  assert.equal(starMasterOf(1, 0).call(), 'The Coven Mother comes for the star!');
  for (const m of Object.values(STAR_MASTERS)) {
    assert.ok(typeof m.name() === 'string' && m.name().length > 3, m.id);
    assert.ok(m.call().endsWith('!'), `${m.id}: a call`);
    assert.equal(m.female, covenFemale(m.career) || m.id === 'mother', m.id);
    assert.ok(metal(m.career) <= (m.id === 'mother' || m.id === 'flesh' ? SILVER : MITHRIL), `${m.id}: its band can hurt it`);
  }
  for (const b of [1, 2, 3]) {
    const c0 = starCircleFoes(N, 2, 0, 6, b), c1 = starCircleFoes(N, 2, 1, 6, b);
    assert.equal(c0.length, 6);
    for (const c of [...c0, ...c1]) assert.ok(STAR_ROSTERS[b][STAR_WAVES - 1].includes(c), `band ${b}: ${c}`);
    assert.deepEqual(starCircleFoes(N, 2, 0, 6, b), c0);
  }
});

test('STAR5 THE CLOCK: a star is none before its omen, the omen, the streak, fallen to its deadline, after it, gone - each edge its own (mutants: an edge)', () => {
  const T = starTimes(N, 2);
  assert.equal(starClockPhase(N, 2, T.omenAt - 1), 'none');
  assert.equal(starClockPhase(N, 2, T.omenAt), 'omen');
  assert.equal(starClockPhase(N, 2, T.streakAt - 1), 'omen');
  assert.equal(starClockPhase(N, 2, T.streakAt), 'streak');
  assert.equal(starClockPhase(N, 2, T.fallAt - 1), 'streak');
  assert.equal(starClockPhase(N, 2, T.fallAt), 'fallen');
  assert.equal(starClockPhase(N, 2, T.endAt - 1), 'fallen');
  assert.equal(starClockPhase(N, 2, T.endAt), 'after');
  assert.equal(starClockPhase(N, 2, T.goneAt - 1), 'after');
  assert.equal(starClockPhase(N, 2, T.goneAt), 'gone');
  assert.equal(starClockPhase(N, 2, NaN), 'none');
});

test('STAR-TUNE A WAVE OF TWENTY-FOUR STANDS ON ROLLS OF ITS OWN: each place\'s jitter on the ring is its own roll - never the next wave\'s, which a stride of sixteen shared past sixteen places (mutants: STAR-TUNE-the-rolls-shared)', () => {
  const TAU = 2 * Math.PI;
  const jitters = (w, count) => starStandPlaces(N, 1, w, count).map(([dx, dz], i) => {
    const a0 = (starRoll(N, 1, 700 + w) / 4294967296) * TAU;
    let j = Math.atan2(dx, dz) - a0 - (i / count) * TAU;
    j = ((j % TAU) + TAU + Math.PI) % TAU - Math.PI;
    return j;
  });
  for (let w = 1; w < STAR_WAVES; w++) {
    const a = jitters(w, 24), b = jitters(w + 1, 24);
    assert.ok(a.every((j) => Math.abs(j) <= 0.25 + 1e-9), 'a quarter-radian either side');
    for (let i = 0; i < 8; i++) assert.ok(Math.abs(a[16 + i] - b[i]) > 1e-9, `wave ${w} place ${16 + i} and wave ${w + 1} place ${i}: their own rolls`);
  }
});

test('STAR5 WHERE THEY STAND: a wave on a ring 14 to 20 metres out from the heart, just past the crater\'s thrown earth (STAR-TUNE: "The time between waves is too long" - from 25 to 35, a walk in), each facing the star, the star\'s own places; the circle 6 metres about its master (mutants: the ring, the facing, STAR-TUNE-the-coven-out-far)', () => {
  assert.deepEqual(STAR_STAND_R, [14, 20]);
  assert.ok(STAR_STAND_R[0] > STAR_BARE_R, 'out of the crater and its rim');
  for (let w = 1; w <= STAR_WAVES; w++) {
    const ps = starStandPlaces(N, 1, w, 8);
    assert.equal(ps.length, 8);
    for (const [dx, dz, yaw] of ps) {
      const r = Math.hypot(dx, dz);
      assert.ok(r >= STAR_STAND_R[0] - 1e-9 && r <= STAR_STAND_R[1] + 1e-9, `${r}`);
      // the motor's facing: forward (sin yaw, cos yaw) points back to the heart
      assert.ok(Math.abs(Math.sin(yaw) * r + dx) < 1e-6 && Math.abs(Math.cos(yaw) * r + dz) < 1e-6, 'facing the star');
    }
    assert.deepEqual(starStandPlaces(N, 1, w, 8), ps);
  }
  assert.notDeepEqual(starStandPlaces(N, 1, 1, 4), starStandPlaces(N, 1, 2, 4), 'each wave its own');
  const c = starCirclePlaces(5);
  assert.equal(c.length, 5);
  for (const [dx, dz] of c) assert.ok(Math.abs(Math.hypot(dx, dz) - STAR_CIRCLE_R) < 1e-9);
  assert.deepEqual(starCirclePlaces(0), []);
});

test('STAR5 THE WORD: the star and its pixel, the level 1 to 60, the flags as 0 and 1, every count held to the wire\'s bound; the deaths said only with the wave they belong to (`kw`); its key moves with each field; said from inside the relay\'s reach (mutants: a clamp, a key field, deaths of no wave said, the wave no news)', () => {
  const star = { n: N, k: 1, px: 300, py: 200 };
  const w = starWordOf(star, { struck: true, own: false, kw: 9, kn: 150, wc: 9, hb: 20_000, mf: true }, 99);
  assert.deepEqual(w, { n: N, k: 1, px: 300, py: 200, lv: 60, s: 1, o: 0, kw: STAR_WAVES, kn: 99, wc: STAR_WAVES, hb: 9999, mf: 1 });
  assert.deepEqual(starWordOf(star, { struck: false, own: true, kw: -2, kn: -4, wc: -1, hb: -9, mf: false }, 0), { n: N, k: 1, px: 300, py: 200, lv: 1, s: 0, o: 1, kw: 0, kn: 0, wc: 0, hb: 0, mf: 0 });
  assert.equal(starWordOf(star, { struck: false, own: true, kw: 0, kn: 3, wc: 0, hb: 0, mf: false }, 10).kn, 0, 'deaths of no wave stood are said as none');
  assert.equal(starWordOf(star, { struck: false, own: true, kw: 2, kn: 3, wc: 0, hb: 0, mf: false }, 10).kn, 3);
  const base = starWordOf(star, { struck: false, own: false, kw: 0, kn: 0, wc: 0, hb: 0, mf: false }, 10);
  const keys = new Set([starWordKey(base)]);
  for (const over of [{ struck: true }, { own: true }, { kw: 1 }, { kw: 1, kn: 1 }, { wc: 1 }, { hb: 1 }, { mf: true }]) keys.add(starWordKey(starWordOf(star, { struck: false, own: false, kw: 0, kn: 0, wc: 0, hb: 0, mf: false, ...over }, 10)));
  assert.equal(keys.size, 8);
  assert.equal(starWordKey(starWordOf(star, { struck: false, own: false, kn: 0, wc: 0, hb: 0, mf: false }, 30)), starWordKey(base), 'the level is no news');
  assert.ok(STAR_SAY_M < STAR_REACH_M);
});

// ── the target machine (WATCH-PROTECTS's rig) ──
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const floored = () => { const c = new Collider(() => -100); c.addMesh('floor', new Float32Array([-80, 0, -80, 80, 0, -80, 80, 0, 80, -80, 0, 80]), new Uint32Array([0, 1, 2, 0, 2, 3]), I4); return c; };
const COL = floored();
const foe = (feet, team, { hostile = true, ranged = false, ...over } = {}) => {
  const ai = Object.assign(new EnemyAI(COL, feet, 0, { liveSpeed: 50, height: 1.8, centreOffset: 0.9 }), { wouldBeSpawned: true });
  ai.isHostile = hostile;
  return { ai, entity: { team, mobileTeam: team }, mobile: { basics: { hasRangedAttack1: ranged } }, ...over };
};
/** The star as its owner's host stands it (scenes/starfall/starfallHost.js makeWard). */
const ward = (feet, site) => ({
  starWard: true, site, living: true,
  ai: { feet: [...feet], height: 2.5, centreOffset: 1.25, target: null, isHostile: false, wouldBeSpawned: true, yaw: 0 },
  entity: { team: 'Civilian', mobileTeam: 'Civilian', health: 1000, maxHealth: 1000 },
  hurtFromFoe: () => 1,
});

test('STAR5 THE STAR\'S HUNTERS: its own coven\'s hand-to-hand monsters go for the star before the player beside it, until a defender\'s blow turns one; any other foe - another star\'s, a camp\'s, a class, an archer, the watch, an ally - passes it by (mutants: the site, the turn, the priority, the team chain)', () => {
  const SITE = starSiteId(300, 200, N, 1), OTHER = starSiteId(300, 200, N, 2);
  const star = ward([0, 0, 12], SITE);
  const spider = foe([0, 0, 0], 'Spiders', { starSite: SITE });
  assert.equal(huntsStar(spider, star), true);
  assert.equal(getTargets(spider, [star], [0, 0, 3], { infighting: false }).target, star, 'the star over the player four times nearer');
  spider.starTurned = true;
  assert.equal(getTargets(spider, [star], [0, 0, 3], { infighting: false }).target, PLAYER_TARGET, 'turned: the nearer');
  assert.ok(STAR_HUNT_PRIORITY > 0);
  for (const [why, f] of [
    ['another star\'s', foe([0, 0, 0], 'Spiders', { starSite: OTHER })], ['a camp\'s', foe([0, 0, 0], 'Spiders')],
    ['an archer', foe([0, 0, 0], 'Orcs', { starSite: SITE, ranged: true })], ['the watch', foe([0, 0, 0], 'CityWatch', { starSite: SITE })],
    ['an ally', foe([0, 0, 0], 'PlayerAlly', { starSite: SITE })], ['a caster', foe([0, 0, 0], 'Imps', { starSite: SITE, caster: {} })],
    ['a class', foe([0, 0, 0], 'Witches', { starSite: SITE, entity: { team: 'Witches', mobileTeam: 'Witches', isClass: true } })],
  ]) {
    assert.equal(huntsStar(f, star), false, why);
    assert.notEqual(getTargets(f, [star], [0, 0, 30], { infighting: true }).target, star, why);
  }
  assert.equal(huntsStar(spider, null), false);
});

// ── the foe pool (AUDIT WB12d's rig) ──
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const pool = () => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (/^CLASS\d\d\.CFG$/.test(n)) return craftCfg(); throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => '300,200',
  playerEntity: { isPlayer: true, level: 10, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
});

test('STAR5 THE CIRCLE\'S WARD: while its circle stands the master takes a quarter of every blow, at least 1, through the pool\'s one door; the circle broken, the whole blow; a kill is no blow and is never warded (mutants: the share, the floor, the kill\'s exemption)', async () => {
  const p = pool();
  const f = await p.spawnFoe(0, [0, 0, 5], { placed: true, groundAlign: { hitDist: 0.2 }, site: starSiteId(300, 200, N, 1, 'm'), transient: true });
  assert.ok(f, 'stood');
  f.entity.maxHealth = 1000; f.entity.health = 1000;
  let circle = 2;
  f.circleWard = () => circle > 0;
  p.damageFoe(f, 100, [0, 0, 0], null, { fromPlayer: false });
  assert.equal(f.entity.health, 1000 - Math.round(100 * STAR_CIRCLE_SHARE), 'a quarter');
  p.damageFoe(f, 1, [0, 0, 0], null, { fromPlayer: false });
  assert.equal(f.entity.health, 1000 - 25 - 1, 'never nothing');
  circle = 0;
  p.damageFoe(f, 100, [0, 0, 0], null, { fromPlayer: false });
  assert.equal(f.entity.health, 1000 - 26 - 100, 'broken: the whole blow');
  circle = 3;
  p.damageFoe(f, f.entity.health, [0, 0, 0], null, { fromPlayer: false, whole: true });
  assert.equal(f.entity.health <= 0 || f.dead, true, 'a kill is a kill');
});

test('STAR5 ONE BLOW: a monster\'s landed blow on a fallen star is one blow, its light\'s, as on a townsperson - the pool\'s melee arm hands it QUARRY_BLOW (mutants: the star dropped from the arm)', () => {
  assert.match(readFileSync(new URL('../../../src/scenes/exteriorFoes.js', import.meta.url), 'utf8'), /calculateAttackDamage: _foeTarget\.civilian \|\| _foeTarget\.starWard \? QUARRY_BLOW : calculateAttackDamage,/);
});

test('STAR5 THE SITES: a star\'s coven, its master and its circle are three sites on the camps\' law, each its own, every one a site the frames carry; anything else of the form refused (mutants: the part, the star\'s index)', () => {
  const base = starSiteId(300, 200, N, 1), m = starSiteId(300, 200, N, 1, 'm'), c = starSiteId(300, 200, N, 1, 'c');
  assert.deepEqual([base, m, c], [`300,200:star.${N}.1`, `300,200:star.${N}.1.m`, `300,200:star.${N}.1.c`]);
  for (const s of [base, m, c, starSiteId(-12, -4, 1, 0), starSiteId(300, 200, N, 2, 'c')]) assert.match(s, WOD_SITE_RE, s);
  for (const s of [`300,200:star.${N}.3`, `300,200:star.${N}.1.x`, `300,200:star.${N}`, `300,200:star.${N}.1.mc`, `300,200:star..1`]) assert.doesNotMatch(s, WOD_SITE_RE, s);
  assert.equal(starSiteKey({ px: 300, py: 200, n: N, k: 1 }), base, 'the sites\' key the camps\'');
  assert.match(wodSiteId(300, 200, 7), WOD_SITE_RE, 'the camps\' own unchanged');
});
