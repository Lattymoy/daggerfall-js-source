// RVN2 - ADAPTATIONS (bible/12-Enhanced-AI/Feud-Arc.md section 13; Mac, 2026-10-04: "more complex, less easy to
// accomplish and more detailed", then "Go"). At each deed a revenant LEARNS one lesson of the fight - the first of its
// scars (its leading source first) that teaches something it does not hold - and keeps its rank's worth (three at most),
// the oldest forgotten. What it learned stands with it (`entity.revenant.edge`, systems/revenantFeud.js adaptEdge):
// a weapon class taken less (never below x0.6), an element resisted on the saving throw (+25 - the arc's +50 was
// immunity), silver's double gone, its poise heavier, its blows iron, its wind-ups patient, never unaware, faster at
// range, relentless, a creature of the night. Nothing touches its weakness.
// Pinned: the law of learning; the fold at the real deed; each adaptation's effect through its REAL seam - the formulas'
// tail (DFU's core and PCAAO's), the saving throw, both cores' silver double, the brain's table (poise, iron, the
// wind-up), the real brain (a feint, the tracking, the charge), the motor's speed, the doors (a backstab, the back on
// the poise), the stand (Speed, the night's blows), the return by night; the page's line.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/revenant.js');
const L = await import('../src/systems/feudLedger.js');
const F = await import('../src/systems/revenantFeud.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { calculateAttackDamage, weaponAttackDamage, silverDoubles } = await import('../src/combat/formulas.js');
const { pcaaoWeaponAttackDamage, pcaaoModules } = await import('../src/combat/pcaao.js');
const { createWeapon } = await import('../src/combat/enemyEquipment.js');
const { makeEnemyEntity } = await import('../src/characters/enemyEntity.js');
const { ENEMY_BASICS } = await import('../src/characters/enemyBasics.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { WEAPONS: W } = await import('../src/characters/weapons.js');
const { savingThrow, EFFECT_FLAGS } = await import('../src/systems/spellcast.js');
const { computeEntityMods, entityResistMod } = await import('../src/systems/entityMods.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { setSeed } = await import('../src/formats/dfRandom.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { TELL, poiseOf, blowGuard, windupSeconds, feintChance, trackShare } = await import('../src/ai/tells.js');
const { setTacticsClock, resetTactics, noteLocalPlayer } = await import('../src/ai/tactics.js');
const { liveBlows, resetBlows } = await import('../src/ai/foeBlows.js');
const { windupDoor, backstabChanceOf } = await import('../src/scenes/hostCombat.js');
const { foeUnaware } = await import('../src/combat/playerWeapon.js');
const { Collider } = await import('../src/player/collider.js');
const { EnemyAI, enemyMoveSpeed } = await import('../src/characters/enemyMotor.js');
const { EnemyAttack } = await import('../src/characters/enemyAttack.js');
const { MobileUnit } = await import('../src/characters/mobileUnit.js');
const { SKILLS } = await import('../src/systems/skills.js');
const { learnedWords, drawRevenantsPage } = await import('../src/ui/revenantPage.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const me = () => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: 'char-rvn2', level: 5, stats: stats(), skills: new Array(35).fill(40), skillUses: new Array(35).fill(0), career: {}, activeEffects: [], items: [], health: 50, maxHealth: 60, magicka: 0, maxMagicka: 100, armorValues: new Array(7).fill(100) });
const foe = ({ mobileType = M.Orc, level = 6, plain = false } = {}) => {
  const e = makeEnemyEntity(mobileType, ENEMY_BASICS[mobileType], { ...stats(), attackModifierFlags: 0 }, level, () => 0.5);
  if (!plain) e.champion = 'mighty';
  return e;
};
/** A stand-in revenant: `learned` stood on it as a stand does (systems/revenant.js revenantStamp's shape). */
const adapted = (learned, { weak = null, ...o } = {}) => { const e = foe(o); e.revenant = { id: 'x', name: 'X', rank: 3, learned, weak, edge: F.adaptEdge(learned, weak) }; return e; };

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true); setPref('enhancedAI', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null);
  setWorldMinutes(12 * 60);
});

// ── learning ────────────────────────────────────────────────────────

test('RVN2 THE LESSON: the first of the fight\'s scars that teaches what it does not hold - its leading source first; one held passes to the next; mixed, other and a plain deed teach nothing; silver only where its kind\'s double is; an element its career resists never; a kill by night the Night-stalker, being run from the Relentless (mutants: the leading scar skipped; a held one relearned; silver anywhere; the career unread; the night\'s kill untaught)', () => {
  assert.equal(F.lessonOf(['blade', 'staggered', 'fled'], [], M.Orc), 'mailed');
  assert.equal(F.lessonOf(['blade', 'staggered', 'fled'], ['mailed'], M.Orc), 'steadfast', 'held: the next');
  assert.equal(F.lessonOf(['mixed', 'dodged'], [], M.Orc), 'patient');
  assert.equal(F.lessonOf(['mixed', 'fled'], [], M.Orc), null);
  assert.equal(F.lessonOf(['other', 'slew'], [], M.Orc), null);
  assert.equal(F.lessonOf(['blade', 'silver'], ['mailed'], M.Orc), null, 'an orc\'s silver is no double');
  assert.equal(F.lessonOf(['blade', 'silver'], ['mailed'], M.SkeletalWarrior), 'silverScarred');
  assert.equal(F.lessonOf(['blade', 'silver'], ['mailed'], M.Ghost), 'silverScarred', 'one of PCAAO\'s six');
  assert.equal(F.lessonOf(['fire', 'back'], [], M.FireDaedra, { resistanceFlags: 8 }), 'watchful', 'fire it shrugs off already');
  assert.equal(F.lessonOf(['fire'], [], M.Orc, { immunityFlags: 8 }), null);
  assert.equal(F.lessonOf(['fire'], [], M.Orc), 'fireproof');
  assert.deepEqual(['frost', 'shock', 'poison', 'magic', 'axe', 'blunt', 'h2h', 'arrow'].map((k) => F.lessonOf([k], [], M.Orc)),
    ['rimebound', 'grounded', 'venomBlooded', 'spellScarred', 'hewnHard', 'braced', 'unflinching', 'arrowWise']);
  assert.equal(F.lessonOf(['mixed', 'night', 'slew'], [], M.Orc), 'nightStalker');
  assert.equal(F.lessonOf(['mixed', 'night', 'fled'], [], M.Orc), null, 'a night it ran from teaches nothing');
  assert.equal(F.lessonOf(['mixed', 'routed'], [], M.Orc), 'relentless');
  assert.equal(F.lessonOf(['back'], [], M.Orc), 'watchful');
  assert.deepEqual(F.withLesson(['a'], 'b', 1), ['b'], 'rank 1 holds one');
  assert.deepEqual(F.withLesson(['a', 'b'], 'c', 2), ['b', 'c'], 'the oldest forgotten');
  assert.deepEqual(F.withLesson(['a', 'b', 'c'], 'd', 5), ['b', 'c', 'd'], 'three at most');
  assert.equal(F.ADAPT_MAX, 3);
});

test('RVN2 THE FOLD AT THE REAL DEED: one lesson a deed, at most its rank\'s, the oldest forgotten; the foe that did it stands with it at once (mutants: no lesson; two a deed; the cap ignored; the stamp stale)', () => {
  const p = me();
  const o = foe();
  o._voiceId = 'rvn2-fold-0';   // its id, so its weakness (shock) is none of the fights' below
  const fight = (cls, n = 10, extra = []) => { L.noteFeudHarm(o, cls, n); for (const c of extra) { L.noteFeud(o, c); L.noteFeud(o, c); L.noteFeud(o, c); } };
  fight('blade', 10, ['staggers', 'dodged']);
  const r = N.revenantDeed(p, o, 'fled', { rolls: () => 0.5 });
  assert.deepEqual(r.learned, ['mailed'], 'one, its leading source\'s - never the stagger and the dodges too');
  assert.deepEqual(o.revenant.learned, ['mailed']);
  assert.equal(o.revenant.edge.taken.blade, 0.7, 'the stamp carries what it does');
  fight('arrow');
  N.revenantDeed(p, o, 'fled', { rolls: () => 0.5 });
  assert.deepEqual(r.learned, ['mailed', 'arrowWise'], 'rank 2: two');
  fight('blunt');
  N.revenantDeed(p, o, 'fled', { rolls: () => 0.5 });
  fight('fire');
  N.revenantDeed(p, o, 'fled', { rolls: () => 0.5 });
  assert.equal(r.rank, 4);
  assert.deepEqual(r.learned, ['arrowWise', 'braced', 'fireproof'], 'three at most, the oldest forgotten');
  assert.deepEqual(o.revenant.learned, r.learned);
  // a stand carries it too
  const stood = foe();
  N.applyRevenant(stood, r);
  assert.deepEqual(stood.revenant.learned, r.learned);
  assert.equal(stood.revenant.edge.poise, 1.4);
  // an element its career shrugs off teaches the next lesson, at the real deed
  const d = foe({ mobileType: M.FireDaedra, level: 12 });
  d.career = { ...(d.career ?? {}), resistanceFlags: 8 };
  L.noteFeudHarm(d, 'fire', 30);
  L.noteFeud(d, 'dodged'); L.noteFeud(d, 'dodged'); L.noteFeud(d, 'dodged');
  assert.deepEqual(N.revenantDeed(p, d, 'fled', { rolls: () => 0.5 }).learned, ['patient'], 'fire it already resists: the dodges teach');
  // a record read back holds its rank's
  const [old] = N.mergeRevenants([{ id: 'rvn2-old', mobileType: M.Orc, given: 'G', epithet: 'the Scarred', rank: 1, learned: ['mailed', 'braced', 'patient'] }], []);
  assert.deepEqual(old.learned, ['patient']);
});

// ── through the real seams ──────────────────────────────────────────

test('RVN2 A WEAPON CLASS, through the REAL formulas\' tail: Mailed blades x0.7, Hewn-hard axes x0.7, Braced blunt x0.75, Unflinching bare hands x0.6, Arrow-wise a bow\'s x0.7 - nothing else touched, a monster\'s own body none of them; never a blow of its weakness, a class\'s or a metal\'s (mutants: the mod unregistered; a class crossed; the weakness touched; a metal weakness touched; claws counted as fists)', () => {
  const p = me();
  const hit = (target, weapon, attacker = p) => calculateAttackDamage(attacker, target, { weapon, rolls: () => 0.2 });
  const cases = [['mailed', W.Longsword, 0.7], ['hewnHard', W.Battle_Axe, 0.7], ['braced', W.Warhammer, 0.75], ['unflinching', null, 0.6], ['arrowWise', W.Short_Bow, 0.7]];
  for (const [a, tpl, m] of cases) {
    const w = tpl == null ? null : createWeapon(tpl, 1, () => 0.5);
    const plain = hit(foe(), w);
    assert.ok(plain > 1, `${a}: a blow worth weighing (${plain})`);
    assert.equal(hit(adapted([a]), w), Math.max(1, Math.round(plain * m)), a);
    // the others take it whole
    const other = cases.find(([b]) => b !== a)[0];
    assert.equal(hit(adapted([other]), w), plain, `${other} leaves ${a}'s class alone`);
  }
  const sword = createWeapon(W.Longsword, 1, () => 0.5);
  const plain = hit(foe(), sword);
  // PIN MOVED (RVN3: its weakness's blow is x1.5 - and no adaptation takes from it)
  assert.equal(hit(adapted(['mailed'], { weak: 'blade' }), sword), Math.max(1, Math.round(plain * 1.5)), 'its weakness\'s class: untouched by Mailed (x1.5, RVN3)');
  const dwarven = createWeapon(W.Longsword, 4, () => 0.5);
  assert.equal(hit(adapted(['mailed'], { weak: 'dwarven' }), dwarven), Math.max(1, Math.round(hit(foe(), dwarven) * 1.5)), 'its weakness\'s metal: untouched by Mailed (x1.5, RVN3)');
  assert.equal(hit(adapted(['mailed'], { weak: 'silver' }), dwarven), Math.max(1, Math.round(hit(foe(), dwarven) * 0.7)), 'another metal: mailed');
  // a monster's own body (a bear's claws) is no fist - its damage rides the shared DFRandom, so each blow from one seed
  const rat = foe({ mobileType: M.GrizzlyBear, level: 10, plain: true });
  const bite = (t, seed) => { setSeed(seed); return calculateAttackDamage(rat, t, { rolls: () => 0.05 }); };
  let seen = 0;
  for (let seed = 1; seed < 40; seed++) {
    const a = bite(foe(), seed), b = bite(adapted(['unflinching']), seed);
    assert.equal(b, a, `claws are not fists (seed ${seed})`);
    if (a > 2) seen++;
  }
  assert.ok(seen > 0, 'claws landed, worth weighing');
  for (const [, [, m]] of Object.entries(F.ADAPT.TAKEN)) assert.ok(m >= F.ADAPT.TAKEN_FLOOR, 'never under x0.6');
  assert.equal(F.ADAPT.TAKEN_FLOOR, 0.6);
});

test('RVN2 AN ELEMENT, on the REAL saving throw: +25 (DFU\'s own Resistant) for its learned element and no other - never immunity; never its weakness\'s element (mutants: the fold unregistered; +50, immunity; the weakness resisted)', () => {
  assert.equal(F.ADAPT.RESIST, 25);
  const e = adapted(['fireproof', 'grounded']);
  computeEntityMods(e);
  assert.equal(entityResistMod(e, ['fire']), 25);
  assert.equal(entityResistMod(e, ['shock']), 25);
  assert.equal(entityResistMod(e, ['frost']), 0);
  const plainE = foe();
  computeEntityMods(plainE);
  // the saving throw at a fixed roll: a plain orc fails it whole, the fireproof one saves part
  const roll = (v) => () => v;
  assert.equal(savingThrow(0, EFFECT_FLAGS.Fire, plainE, 0, roll(0.7)), 100, 'a plain body: the full burn');
  const kept = savingThrow(0, EFFECT_FLAGS.Fire, e, 0, roll(0.7));
  assert.ok(kept < 100 && kept > 0, `fireproof: part of it (${kept})`);
  for (const v of [0, 0.1, 0.3, 0.5, 0.9, 0.99]) assert.notEqual(savingThrow(0, EFFECT_FLAGS.Fire, e, 0, roll(v)) === 0 && v > 0.95, true);
  assert.ok(savingThrow(0, EFFECT_FLAGS.Fire, e, 0, roll(0.99)) > 0, 'a high roll still burns it: never immune');
  const weak = adapted(['fireproof'], { weak: 'fire' });
  computeEntityMods(weak);
  assert.equal(entityResistMod(weak, ['fire']), -50, 'nothing touches its weakness (its -50, RVN3)');   // PIN MOVED (RVN3)
});

test('RVN2 SILVER-SCARRED, in BOTH cores: the Skeletal Warrior\'s double gone in DFU\'s, a Ghost\'s in PCAAO\'s; another metal untouched; a silver weakness keeps the double (mutants: the veto unregistered; the stock core ignores it; PCAAO\'s ignores it; a silver weakness scarred)', () => {
  const p = me();
  const silver = createWeapon(W.Longsword, 2, () => 0.5);
  const skel = (learned, weak = null) => { const e = adapted(learned, { mobileType: M.SkeletalWarrior, weak }); return e; };
  assert.equal(silverDoubles(skel([])), true);
  assert.equal(silverDoubles(skel(['silverScarred'])), false);
  assert.equal(silverDoubles(skel(['silverScarred'], 'silver')), true, 'a silver weakness keeps its double');
  const roll = () => 0.5;
  const dfu = (t) => weaponAttackDamage(p, t, 0, silver, roll);
  const pc = (t) => pcaaoWeaponAttackDamage(p, t, 0, 0, silver, roll, pcaaoModules(() => false));
  const plainSkel = dfu(skel([])), scarredSkel = dfu(skel(['silverScarred']));
  assert.ok(plainSkel > scarredSkel, `DFU's core: the double gone (${plainSkel} > ${scarredSkel})`);
  const ghost = (learned) => adapted(learned, { mobileType: M.Ghost });
  assert.ok(pc(ghost([])) > pc(ghost(['silverScarred'])), 'PCAAO\'s six');
  const steel = createWeapon(W.Longsword, 1, () => 0.5);
  assert.equal(weaponAttackDamage(p, skel(['silverScarred']), 0, steel, roll), weaponAttackDamage(p, skel([]), 0, steel, roll), 'steel: as ever');
});

test('RVN2 THE BRAIN\'S TABLE: Braced x1.4 and Steadfast x1.5 on its poise; Steadfast iron one blow in two (the larger share beside an elite\'s, one roll); Patient\'s wind-ups U(0.85, 1.35) (mutants: either poise dropped; iron never; the band TELL\'s)', () => {
  const ent = (learned) => ({ maxHealth: 100, healthMult: 1, revenant: { rank: 0, edge: F.adaptEdge(learned) } });
  const base = poiseOf(ent([]), 300);
  assert.ok(Math.abs(poiseOf(ent(['braced']), 300) - base * 1.4) < 1e-9);
  assert.ok(Math.abs(poiseOf(ent(['steadfast']), 300) - base * 1.5) < 1e-9);
  assert.ok(Math.abs(poiseOf(ent(['braced', 'steadfast']), 300) - base * 2.1) < 1e-9);
  assert.equal(blowGuard('lunge', 300, ent(['steadfast']), 0.49), 'iron');
  assert.equal(blowGuard('lunge', 300, ent(['steadfast']), 0.5), 'poise');
  assert.equal(blowGuard('lunge', 300, ent([]), 0.01), 'poise');
  assert.equal(blowGuard('lunge', 300, { ...ent(['steadfast']), eliteFoe: true }, 0.45), 'iron', 'beside an elite\'s third: the half');
  assert.equal(windupSeconds(1, ent(['patient']), { roll: 0 }), 0.85);
  assert.ok(Math.abs(windupSeconds(1, ent(['patient']), { roll: 1 }) - 1.35) < 1e-9);
  assert.equal(windupSeconds(1, ent([]), { roll: 0 }), TELL.WINDUP_VARY[0]);
});

// ── the real brain and motor ────────────────────────────────────────

const DT = 1 / 60;
const CAM = [0, 1.6, -5];
let T = 0;
setTacticsClock(() => T);
function brainFoe(learned, { mobileType = M.Orc, at = [0, 0, 8], rank = 2 } = {}) {
  const c = new Collider(() => 0);
  const ent = { health: 100, maxHealth: 100, mobileType, level: 12, revenant: { id: 'b', name: 'B', rank, learned, edge: F.adaptEdge(learned) } };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => ent, liveSpeed: () => 50 });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  const mobile = new MobileUnit(mobileType, ENEMY_BASICS[mobileType], () => 8, () => 0.99);
  return { ai, atk, ent, mobile, entity: ent, _seq: 0 };
}
function run(f, secs, player) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    f.ai.update(DT, player);
    f.atk.update(DT, f.ai, player);
    const edge = f.atk.swingSeq !== f._seq;
    f._seq = f.atk.swingSeq;
    f.mobile.update(DT, { striking: edge && !f.atk.firedRanged, hold: f.ai._blowHold, hurting: f.ai.hurtKnock || f.ai.staggered }, f.ai.yaw, f.ai.feet, CAM);
    if (f.mobile.doMeleeDamage) f.mobile.doMeleeDamage = false;
  }
}
function firstWindup(f, player, secs = 60) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    run(f, DT, player);
    if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai) ?? null;
  }
  return null;
}
/** Math.random held at `v` for `fn` (the brain's draws are Math.random's). */
function withRandom(v, fn) { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } }

test('RVN2 PATIENT: a blade feints one wind-up in three (TELL5\'s one in five otherwise) - the brain draws against it; and on the REAL brain a lunge tracks through 0.7 of its wind-up, not TELL5\'s half (mutants: the feint TELL\'s; the brain\'s draw TELL\'s; the tracking TELL\'s)', () => {
  const ent = (learned) => ({ revenant: { rank: 2, edge: F.adaptEdge(learned) } });
  assert.equal(feintChance(ent(['patient'])), 1 / 3);
  assert.equal(feintChance(ent([])), TELL.FEINT_CHANCE);
  assert.equal(feintChance(null), TELL.FEINT_CHANCE);
  assert.equal(trackShare(ent(['patient'])), 0.7);
  assert.equal(trackShare(ent([])), TELL.TRACK_SHARE);
  assert.match(read('src/ai/tactics.js'), /&& Math\.random\(\) < feintChance\(ent\)\) \{/, 'the brain draws against it');
  // live: a beast's lunge (TELL5's own rig - Math.random pinned at 0.05), looked at between half and 0.7 of its wind-up
  const turnedLate = (learned) => {
    resetTactics(); resetBlows(); T = 0;
    const f = brainFoe(learned, { mobileType: M.GrizzlyBear, at: [0, 0, 2.5] });   // in reach: its lunge, not its charge
    const player = [0, 0, 0];
    const b = withRandom(0.05, () => firstWindup(f, player));
    assert.equal(b?.kind, 'lunge');
    run(f, b.start + 0.55 * (b.land - b.start) - T, player);
    const y = b.yaw;
    player[0] += 3;   // a sidestep after half-way
    run(f, b.start + 0.68 * (b.land - b.start) - T, player);
    return Math.abs(b.yaw - y) > 1e-6;
  };
  assert.equal(turnedLate(['patient']), true, 'a Patient one still turns after me');
  assert.equal(turnedLate([]), false, 'TELL5\'s locked from half-way');
});

test('RVN2 ARROW-WISE: +20 Speed while its target is past 8 m (the REAL motor), and out of reach its charge with no roll (the REAL brain: a draw that passes every plain foe by) (mutants: the speed unread; at any range; the charge rolled)', () => {
  const near = brainFoe(['arrowWise']);
  near.ai._dist = 5;
  assert.equal(near.ai.speed, enemyMoveSpeed(50));
  near.ai._dist = 9;
  assert.equal(near.ai.speed, enemyMoveSpeed(70));
  const plain = brainFoe([]);
  plain.ai._dist = 20;
  assert.equal(plain.ai.speed, enemyMoveSpeed(50));
  for (const [learned, charges] of [[['arrowWise'], true], [[], false]]) {
    resetTactics(); resetBlows(); T = 0;
    const f = brainFoe(learned, { mobileType: M.GrizzlyBear, at: [0, 0, 8] });
    const player = [0, 0, 0];
    const b = withRandom(0.99, () => firstWindup(f, player, 3));
    assert.equal(b?.kind === 'charge', charges, `${learned}: ${b?.kind ?? 'nothing'}`);
  }
});

test('RVN2 WATCHFUL: no backstab (and no tally), never unaware, and no back multiplier on its poise - its blow at its back still in the ledger (mutants: the backstab kept; unaware kept; the back weighed)', () => {
  const p = me();
  const w = { entity: adapted(['watchful']), ai: { detected: false } };
  const plain = { entity: adapted([]), ai: { detected: false } };
  const tallied = () => p.skillUses[SKILLS.Backstabbing];
  assert.ok(backstabChanceOf(p, true, plain) > 0);
  const before = tallied();
  assert.equal(backstabChanceOf(p, true, w), 0);
  assert.equal(tallied(), before, 'no tally');
  assert.equal(foeUnaware(plain), true);
  assert.equal(foeUnaware(w), false);
  // every backstab door hands the foe over: the shaft, the dungeon's swing, the street's, the watch's
  assert.match(read('src/combat/arrowFlight.js'), /backstabChance: backstabChanceOf\(playerEntity, back, foe\),/);
  assert.match(read('src/scenes/dungeonContext.js'), /\(f\) => backstabChanceOf\(playerEntity, !!f\._backFacing, f\)/);
  assert.match(read('src/scenes/exteriorFoes.js'), /\(f\) => backstabChanceOf\(playerEntity, isBackFacing\(f\.ai\.yaw, f\.ai\.feet, eye\), f\)/);
  assert.match(read('src/scenes/cityGuards.js'), /\(g\) => backstabChanceOf\(playerEntity, isBackFacing\(g\.ai\.yaw, g\.ai\.feet, eye\), g\)/);
  // the poise door: a blow from behind weighs its front's on a Watchful one
  const weigh = (learned) => {
    resetTactics(); resetBlows(); T = 0;
    const f = brainFoe(learned);
    const player = [0, 0, 0];
    const b = withRandom(0.05, () => firstWindup(f, player));
    assert.ok(b);
    const back = [b.origin[0] - Math.sin(b.yaw) * 2, 0, b.origin[2] - Math.cos(b.yaw) * 2];
    windupDoor(f, 1, { kind: 'melee', weapon: createWeapon(W.Longsword, 1, () => 0.5), from: back, weight: 300 });
    return f.ai._tac.blow?.taken ?? b.taken;
  };
  const plainBack = weigh([]), watchBack = weigh(['watchful']);
  assert.ok(Math.abs(plainBack - watchBack * TELL.POISE_BACK) < 1e-9, `the back x1.5 on a plain one only (${plainBack} vs ${watchBack})`);
});

test('RVN2 THE STAND: a Relentless one +25 Speed on its stats; a Night-stalker\'s blows x1.15 by night, and it comes only by night; a Relentless one hunting me is never culled (mutants: the Speed dropped; the night\'s blows dropped; a Night-stalker by day; the cull kept)', () => {
  const p = me();
  const o = foe();
  const r = N.revenantDeed(p, o, 'fled', { rolls: () => 0.5 });
  r.learned = ['relentless', 'nightStalker'];
  r.dueAt = 0;
  setWorldMinutes(12 * 60);
  assert.equal(N.revenantToReturn(p, { now: 99999, rolls: () => 0 }), null, 'by day: never');
  setWorldMinutes(1440 + 60);
  const back = N.revenantToReturn(p, { now: 99999, rolls: () => 0 });
  assert.equal(back, r, 'by night');
  const e = foe();
  const speed = e.stats.speed;
  const scale = e.damageScale ?? 1;
  N.applyRevenant(e, r);
  assert.equal(e.stats.speed, speed + 25);
  assert.ok(Math.abs(e.damageScale - scale * (1 + N.REVENANT_DAMAGE_PER_RANK * r.rank) * 1.15) < 1e-9, 'x1.15 by night');
  const plainR = N.revenantDeed(p, foe(), 'fled', { rolls: () => 0.5 });
  const e2 = foe();
  const s2 = e2.stats.speed;
  N.applyRevenant(e2, plainR);
  assert.equal(e2.stats.speed, s2, 'none without it');
  assert.match(read('src/scenes/exteriorFoes.js'), /const _relentless = f\.entity\?\.revenant\?\.edge\?\.relentless === true && f\.ai\.isHostile;[\s\S]{0,400}&& !_relentless\) \{/, 'the cull passes it by');
});

test('RVN2 THE EDGE: frozen, from its adaptations and its weakness - nothing touches the weakness; a sworn one and a puppet carry none; the page names what it learned (mutants: the weakness touched; a page unnamed)', () => {
  const e = F.adaptEdge(['mailed', 'fireproof', 'silverScarred'], 'blade');
  assert.ok(Object.isFrozen(e));
  assert.equal(e.taken.blade, undefined, 'its weakness\'s class untouched');
  assert.equal(e.resist.fire, 25);
  assert.equal(F.adaptEdge(['fireproof'], 'fire').resist.fire, undefined);
  assert.equal(F.adaptEdge(['silverScarred'], 'silver').silverScarred, false);
  assert.equal(e.weak, 'blade');
  assert.match(read('src/systems/revenantCompanions.js'), /entity\.revenant = \{ id: r\.id, name: r\.name, rank, sworn: true \};/, 'a sworn one: learned against me, none of it for me');
  assert.equal(learnedWords({ learned: ['arrowWise', 'nightStalker', 'hewnHard'] }), 'Learned: Arrow-wise, Night-stalker, Hewn-hard.');
  assert.equal(learnedWords({ learned: [] }), '');
  // on a real drawn page
  const p = me();
  const o = foe();
  L.noteFeudHarm(o, 'axe', 20);
  N.revenantDeed(p, o, 'fled', { rolls: () => 0.5 });
  const made = [];
  const el = (tag, cls = '', text = '') => {
    const n = { tag, cls, text, kids: [], append(...k) { this.kids.push(...k); }, insertBefore(k) { this.kids.unshift(k); }, setAttribute() {}, get firstChild() { return this.kids[0] ?? null; }, querySelector: () => null, isConnected: true };
    made.push(n);
    return n;
  };
  drawRevenantsPage(el('div'), () => {}, { el, divider: () => el('hr'), player: p, kindName: () => 'Orc' });
  // PIN MOVED (RVN12b, bible/12-Enhanced-AI/Feud-Arc.md 24.1): as chips, each with what it does
  assert.ok(made.some((n) => n.cls === 'rvn-chip' && n.text === 'Hewn-hard'), 'the row says it');
  assert.ok(made.some((n) => n.cls === 'rvn-effects' && n.text === 'Hewn-hard - your axes bite less.'), 'and what it does');
});
