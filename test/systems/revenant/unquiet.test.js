// UNQUIET (bible/06-Systems/Revenants.md section 46; the owner, 2026-10-17: "With revenants becoming a full fledge game
// loop. They need to become harder, rarer, revenants need more of a chance to flee instead of relying on player death, we
// need to go deeper on the experience and make it something insanely deep."). One special foe in four carries THE MARK
// (systems/revenant/unquietMark.js, drawn on its voice id - no die moved) and only it may rise, while fewer than three
// hunt the player; it breaks and runs at the young line on three in four; a revenant climbs at every getting-away and at
// every second kill; from rank II it breaks away in its own way (smoke, a blink, a sink, a bolt), keeps a wound by the
// blow that broke it, wants what its personality wants (vengeance, mastery, plunder), and a rank-V one that gets away
// once more becomes THE DREAD - at home in its lair for good. Pinned: every number; the mark and its gate; the cap; the
// blood rule through the real deed; each craft through the real flee law (and each answer to it); the wounds on the
// stand and its edge; each ambition's due day, return share, festering and hoard; the Dread's ascent, its home, its two
// stands, its kneel, its rumour, its hunt, its drop; the page's lines and the card's kind; the doors that mark.
import '../../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../../../src/systems/revenant/revenant.js');
const U = await import('../../../src/systems/revenant/revenantUnquiet.js');
const K = await import('../../../src/systems/revenant/unquietMark.js');
const F = await import('../../../src/systems/revenant/revenantFeud.js');
const FATE = await import('../../../src/systems/revenant/revenantFate.js');
const PG = await import('../../../src/ui/revenant/revenantPage.js');
const { REVENANT_CARD_CSS } = await import('../../../src/ui/revenant/revenantCard.js');
const { foeTitle } = await import('../../../src/systems/foeTitle.js');
const { promoteEliteFoe } = await import('../../../src/systems/eliteFoes.js');
const { applyChampion } = await import('../../../src/systems/champions.js');
const { feudOf, noteFeudHarm } = await import('../../../src/systems/feudLedger.js');
const { hasActiveEffect, assignModBundle } = await import('../../../src/systems/effects.js');
const { setPref, _resetForTests } = await import('../../../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../../../src/systems/playerDoor.js');
const { setWorldMinutes } = await import('../../../src/systems/worldTick.js');
const { MOBILE_TYPES: M, KNIGHT_CITY_WATCH } = await import('../../../src/characters/mobile/mobileTypes.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../../../src/systems/modSaveData.js');

const DAY = 1440;
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const me = (id = 'char-unquiet') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, stats: {}, skills: [], career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100 });
const foe = (over = {}) => ({ mobileType: M.Orc, level: 6, champion: 'mighty', unquiet: true, health: 5, maxHealth: 50, team: 'Monster', ...over });
const LAIR = Object.freeze({ px: 106, py: 100, name: 'Tomb of Vaness', region: 3 });

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true);
  N._resetRevenantForTests(); _store.clear(); setPlayerDoor(null); setWorldMinutes(DAY * 10);
  K._forceUnquietForTests(null);
});

/** A revenant born of `deedName` (a marked orc), its personality set (its ambition), its lair given. */
function made(p, { deedName = 'fled', personality = 'brutal', mobileType = M.Orc, now = DAY * 10, lair = LAIR, room = false } = {}) {
  if (room) for (const x of N.livingRevenants().slice(0, Math.max(0, N.livingRevenants().length - N.REVENANT_MAX + 1))) N.revenantSlain(p, { revenant: { id: x.id } });   // room made
  const r = N.revenantDeed(p, foe({ mobileType }), deedName, { mobileType, rolls: () => 0, now });
  assert.ok(r, 'born');
  r.personality = personality;
  r.lair = lair ? { ...lair } : null;
  return r;
}
/** Its next deed, as the pools do it (its body wearing its name; `last` the class of the last blow that reached it). */
function again(p, r, deedName, { now = DAY * 11, last = null, rolls = () => 0 } = {}) {
  const e = foe({ mobileType: r.mobileType, revenant: { id: r.id } });
  if (last) { const l = feudOf(e); assert.ok(l, 'its ledger opens'); l.last = last; }
  return N.revenantDeed(p, e, deedName, { mobileType: r.mobileType, rolls, now });
}

// ── the mark ────────────────────────────────────────────────────────

test('UNQUIET THE MARK: one in four, drawn on its voice id (no die moved) - the same id the same answer, kept on the body once drawn; the force seam (mutants: the share moved; drawn on a die; redrawn; the seam ignored)', () => {
  assert.equal(K.UNQUIET_MARK, 0.25);
  const n = 4000;
  let marked = 0;
  for (let i = 0; i < n; i++) if (K.unquietId(`id-${i}`)) marked++;
  assert.ok(Math.abs(marked / n - 0.25) < 0.03, `one in four (${marked} of ${n})`);
  assert.equal(K.unquietId('id-7'), K.unquietId('id-7'), 'the same id, the same answer');
  assert.equal(K.unquietId(''), false);
  assert.equal(K.unquietId(null), false);
  const yes = Array.from({ length: 64 }, (_, i) => `v-${i}`).find((id) => K.unquietId(id));
  const no = Array.from({ length: 64 }, (_, i) => `v-${i}`).find((id) => !K.unquietId(id));
  const e = foe({ unquiet: undefined, _voiceId: yes });
  const dice = Math.random;
  Math.random = () => { throw new Error('a die was rolled'); };
  try { assert.equal(K.markUnquiet(e), true, 'on its voice id'); } finally { Math.random = dice; }
  assert.equal(e.unquiet, true);
  e._voiceId = no;
  assert.equal(K.markUnquiet(e), true, 'kept - never redrawn');
  assert.equal(K.markUnquiet(foe({ unquiet: undefined, _voiceId: no })), false);
  const fresh = foe({ unquiet: undefined });
  K.markUnquiet(fresh);
  assert.equal(typeof fresh._voiceId, 'string', 'a body with no voice id is given one - the id its name and voice are drawn on');
  assert.equal(fresh.unquiet, K.unquietId(fresh._voiceId));
  K._forceUnquietForTests(true);
  assert.equal(K.markUnquiet(foe({ unquiet: undefined, _voiceId: no })), true, 'forced');
  K._forceUnquietForTests(false);
  assert.equal(K.markUnquiet(foe({ unquiet: undefined, _voiceId: yes })), false, 'forced off');
  assert.equal(K.isUnquiet({ unquiet: true }), true);
  assert.equal(K.isUnquiet({ unquiet: 1 }), false);
  assert.equal(K.isUnquiet(null), false);
});

test('UNQUIET THE GATE: drawn only with the arc on, room for another, on a foe that could ever rise - never the watch, an ally, a band\'s follower, a zone foe, a bout\'s, one under level 3 or a revenant; a closed gate stores nothing (mutants: each gate dropped; a closed gate\'s false kept)', () => {
  K._forceUnquietForTests(true);
  const p = me();
  const drawn = (over) => { const e = foe({ unquiet: undefined, ...over }); K.markUnquiet(e); return e.unquiet; };
  assert.equal(drawn({}), true);
  for (const [why, over] of [['the watch', { mobileType: KNIGHT_CITY_WATCH }], ['an ally', { team: 'PlayerAlly' }], ['an ally kind', { mobileTeam: 'PlayerAlly' }],
    ['a follower', { retinueOf: 'x' }], ['the zone', { wildFoe: true }], ['a giant', { wildGiant: true }], ['a bout', { bout: {} }], ['level 2', { level: 2 }], ['a revenant', { revenant: { id: 'r' } }]]) {
    assert.equal(drawn(over), undefined, why);
  }
  setPref('lootRarity', false);
  assert.equal(drawn({}), undefined, 'the switch off');
  setPref('lootRarity', true);
  K._forceUnquietForTests(null);
  for (let i = 0; i < 3; i++) made(p, { now: DAY * 10 + i });
  assert.equal(N.livingRevenants().length, N.REVENANT_MAX);
  K._forceUnquietForTests(true);
  const full = foe({ unquiet: undefined });
  assert.equal(K.markUnquiet(full), false, 'three hunt me: no mark drawn');
  assert.equal(full.unquiet, undefined, 'and none stored - nothing decided');
});

test('UNQUIET THE DOORS: an elite\'s promotion and a champion\'s draw mark their own - never a puppet\'s; the street pool hands a puppet\'s champion `own: false`; the title says it - "Unquiet Elite Orc" (mutants: a door unmarked; a puppet marked; the title\'s word)', () => {
  K._forceUnquietForTests(true);
  const own = { mobileType: M.Orc, level: 8, health: 50, maxHealth: 50, team: 'Monster', stats: {} };
  const a = { ...own }, b = { ...own };
  promoteEliteFoe(a);
  promoteEliteFoe(b, { own: false });
  assert.equal(a.unquiet, true, 'an elite of its own');
  assert.equal(b.unquiet, undefined, 'a puppet - its owner\'s word');
  const c = { ...own }, d = { ...own };
  assert.equal(applyChampion(c, 0), true);
  applyChampion(d, 0, { own: false });
  assert.equal(c.unquiet, true, 'a champion of its own');
  assert.equal(d.unquiet, undefined);
  assert.match(read('src/scenes/exteriorFoes.js'), /applyChampion\([^\n]*\{ own: !puppet \}\);/);
  assert.equal(foeTitle({ eliteFoe: true, unquiet: true }, 'Orc'), 'Unquiet Elite Orc');
  assert.equal(foeTitle({ champion: 'mighty', unquiet: true }, 'Orc'), 'Unquiet Mighty Orc');
  assert.equal(foeTitle({ champion: 'mighty', unquiet: false }, 'Orc'), 'Mighty Orc');
  assert.equal(foeTitle({ eliteFoe: true, unquiet: true, revenant: { name: 'Grushnak the Butcher' } }, 'Orc'), 'Grushnak the Butcher', 'a revenant by its name alone');
});

// ── rarer ───────────────────────────────────────────────────────────

test('UNQUIET RARER: three at most - none rises while three hunt me (none buried for it); an unmarked special foe never rises, whatever it does; one already a revenant is no newcomer; it comes back in two to four days (mutants: the cap moved; the mark unread; a newcomer past the cap; the days)', () => {
  assert.equal(N.REVENANT_MAX, 3);
  assert.deepEqual([N.REVENANT_RETURN_MIN_MINUTES, N.REVENANT_RETURN_MAX_MINUTES], [2880, 5760]);
  const p = me();
  assert.equal(N.revenantCandidate(foe({ unquiet: false })), false, 'unmarked');
  assert.equal(N.revenantCandidate(foe({ unquiet: undefined })), false, 'never drawn');
  assert.equal(N.revenantDeed(p, foe({ unquiet: false }), 'slew', { rolls: () => 0 }), null, 'it killed me and is nothing');
  assert.equal(N.revenantCandidate(foe()), true, 'marked');
  const three = [0, 1, 2].map((i) => made(p, { now: DAY * 10 + i }));
  assert.equal(N.revenantCandidate(foe()), false, 'three hunt me');
  assert.equal(N.revenantDeed(p, foe(), 'fled', { rolls: () => 0 }), null);
  assert.deepEqual(N.livingRevenants().map((r) => r.id), three.map((r) => r.id), 'none buried for it');
  assert.equal(N.revenantCandidate(foe({ unquiet: false, revenant: { id: three[0].id } })), true, 'one of the three still is');
  N.revenantSlain(p, { revenant: { id: three[0].id } });
  assert.equal(N.revenantCandidate(foe()), true, 'room again');
  const r = three[1];
  r.personality = 'cold';   // mastery: the plain days
  assert.ok(again(p, r, 'fled', { now: DAY * 20 }));
  assert.ok(r.dueAt >= DAY * 20 + 2880 && r.dueAt <= DAY * 20 + 5760, 'two to four days');
});

test('UNQUIET THE FLIGHT: a marked foe breaks at 35% on one in two (AUDIT UNQUIET - it was three in four); an unmarked never; a rank-1 revenant on 80%; from rank II (its will) on 35%; the Dread never (mutants: each number; the mark unread; the Dread running)', () => {
  assert.deepEqual([N.REVENANT_FLEE_CHANCE, N.REVENANT_FLEE_CHANCE_YOUNG, N.REVENANT_FLEE_CHANCE_REVENANT, F.WILL_RANK], [0.5, 0.8, 0.35, 2]);   // PIN MOVED (AUDIT UNQUIET, section 49): 0.5 - it was 0.75
  const runs = (e, roll) => N.rollRevenantFlee(e, () => roll);
  assert.deepEqual([runs(foe(), 0.499), runs(foe(), 0.5)], [true, false]);
  assert.equal(runs(foe({ unquiet: false }), 0), false);
  const p = me();
  const r = made(p);
  const body = (over = {}) => foe({ revenant: { id: r.id, rank: r.rank }, ...over });
  assert.deepEqual([runs(body(), 0.799), runs(body(), 0.8)], [true, false], 'rank I');
  r.rank = 2;
  assert.deepEqual([runs(body({ revenant: { id: r.id, rank: 2 } }), 0.349), runs(body({ revenant: { id: r.id, rank: 2 } }), 0.35)], [true, false], 'rank II');
  r.rank = 5; r.dread = true;
  assert.equal(runs(body({ revenant: { id: r.id, rank: 5, dread: true } }), 0), false, 'the Dread never runs');
  const under = (e, share) => N.revenantFleeHealth({ ...e, health: e.maxHealth * share });
  assert.deepEqual([under(foe(), 0.34), under(foe(), 0.36)], [true, false], 'a marked foe: the young line');
});

// ── ranked by surviving ─────────────────────────────────────────────

test('UNQUIET RANKED BY SURVIVING: every getting-away ranks it (an escape, the player\'s flight); a kill or a felling only every second time - its blood since its last rank, kept through the save (mutants: blood ranking each time; never; the count kept past a rank; unsaved)', () => {
  assert.equal(U.BLOOD_RANK, 2);
  assert.deepEqual([...U.SURVIVING_DEEDS], ['fled', 'routed']);
  assert.deepEqual([...U.BLOOD_DEEDS], ['slew', 'felled']);
  assert.deepEqual(['fled', 'routed', 'returned', 'festered', 'laststand'].map((d) => U.deedRanks(d, 0)), [true, true, false, false, false]);
  assert.deepEqual([U.deedRanks('slew', 1), U.deedRanks('slew', 2), U.deedRanks('felled', 1), U.deedRanks('felled', 2)], [false, true, false, true]);
  assert.deepEqual([U.sanitizeBlood(1), U.sanitizeBlood(2), U.sanitizeBlood(-1), U.sanitizeBlood(0.5), U.sanitizeBlood('1')], [1, 1, 0, 0, 0]);
  const p = me();
  const r = made(p, { deedName: 'slew' });
  assert.equal(r.rank, 1);
  assert.equal(r.blood, 0, 'born of a kill: no blood counted yet');
  again(p, r, 'slew');
  assert.deepEqual([r.rank, r.blood, r.kills], [1, 1, 2], 'one kill: no rank');
  restoreModSaveRecords(modSaveRecords());
  const back = N.revenantsFor(p).find((x) => x.id === r.id);
  assert.equal(back.blood, 1, 'saved');
  again(p, back, 'slew');
  assert.deepEqual([back.rank, back.blood], [2, 0], 'the second: a rank, its blood spent');
  again(p, back, 'fled');
  assert.deepEqual([back.rank, back.blood], [3, 0], 'an escape: a rank');
  again(p, back, 'routed');
  assert.equal(back.rank, 4, 'my flight: a rank');
  again(p, back, 'slew');
  assert.deepEqual([back.rank, back.blood], [4, 1]);
  again(p, back, 'fled');
  assert.deepEqual([back.rank, back.blood], [5, 0], 'a rank by surviving spends its blood too');
});

test('UNQUIET HARDER: its rank weighs more - +40% health, +15% blows and three class levels a rank; a sworn one keeps its old weight (mutants: each moved; the sworn the new)', async () => {
  assert.deepEqual([N.REVENANT_HEALTH_PER_RANK, N.REVENANT_DAMAGE_PER_RANK, N.REVENANT_LEVEL_PER_RANK], [0.4, 0.15, 3]);
  const RC = await import('../../../src/systems/revenant/revenantCompanions.js');
  assert.deepEqual([RC.SWORN_HEALTH_PER_RANK, RC.SWORN_DAMAGE_PER_RANK], [0.25, 0.1]);
  const p = me();
  const r = made(p, { personality: 'cold' });
  r.rank = 3;
  const e = { mobileType: M.Orc, level: 6, health: 100, maxHealth: 100 };
  N.applyRevenant(e, r, { now: DAY * 10 });
  assert.equal(e.maxHealth, 220);
  assert.ok(Math.abs(e.damageScale - 1.45) < 1e-9);
  assert.equal(N.revenantSpawnOptions({ ...r, mobileType: M.Thief }, 10).level, 19);
});

// ── the flight craft ────────────────────────────────────────────────

const fleer = (mobileType, rank, over = {}) => {
  const asked = [];
  const f = {
    mobileType, entity: { mobileType, level: 8, health: 10, maxHealth: 100, team: 'Monster', activeEffects: [], revenant: { id: 'craft', rank }, ...over },
    ai: { feet: [0, 0, 0], isHostile: true, fleeLeft: 0, flee(...a) { asked.push(a); this.fleeLeft = a[1]; } },
  };
  return { f, asked };
};
function standing(p, mobileType, rank) {
  const r = made(p, { mobileType, room: true });
  r.rank = rank;
  const x = fleer(mobileType, rank);
  x.f.entity.revenant.id = r.id;
  return x;
}

test('UNQUIET THE CRAFT BY KIND: a caster, a spirit, a lich, a daedra blinks; the dead and the spriggan sink; any other person throws down smoke; a beast bolts - from rank II, a plain run before; a bolt at 2.5 times its walk, a sink standing (mutants: a kind moved; the rank; the paces)', () => {
  assert.deepEqual({ ...U.CRAFT }, { RANK: 2, BOLT_PACE: 2.5, BLINK_PACE: 0.5, SINK_PACE: 0.05, SMOKE_ROUNDS: 2, BLINK_DELAY: 0.8, BLINK_MS: 600, SINK_DELAY: 200, SINK_MS: 1400 });   // PIN MOVED (AUDIT UNQUIET, section 49): BLINK_PACE
  assert.deepEqual([...U.CRAFTS], ['smoke', 'blink', 'sink', 'bolt']);
  for (const k of [M.Mage, M.Sorcerer, M.Healer, M.Battlemage, M.Ghost, M.Wraith, M.Lich, M.AncientLich, M.Nymph, M.OrcShaman, M.FireDaedra, M.DaedraLord, M.IronAtronach]) assert.equal(U.fleeCraftOf(k), 'blink', `blink ${k}`);
  assert.equal(U.fleeCraftOf(M.Imp), 'bolt', 'PIN MOVED (AUDIT UNQUIET, section 49): no blinker - under REVENANT_MIN_LEVEL, it never rises');
  for (const k of [M.SkeletalWarrior, M.Zombie, M.Mummy, M.Vampire, M.VampireAncient, M.Spriggan]) assert.equal(U.fleeCraftOf(k), 'sink', `sink ${k}`);
  for (const k of [M.Thief, M.Knight, M.Barbarian, M.Assassin]) assert.equal(U.fleeCraftOf(k), 'smoke', `smoke ${k}`);
  for (const k of [M.Orc, M.Rat, M.GiantBat, M.Werewolf, M.OrcWarlord]) assert.equal(U.fleeCraftOf(k), 'bolt', `bolt ${k}`);
  assert.equal(U.fleeCraftOf(undefined), 'bolt');
  assert.deepEqual([U.revenantCraft(M.Mage, 1), U.revenantCraft(M.Mage, 2), U.revenantCraft(M.Orc, 5)], [null, 'blink', 'bolt']);
  assert.deepEqual([U.craftPace('bolt', 2), U.craftPace('sink', 2), U.craftPace('smoke', 2), U.craftPace(null, 2)], [2.5, 0.05, 2, 2]);
  const p = me();
  const young = standing(p, M.Orc, 1);
  assert.equal(N.revenantFleeStep(young.f, [0, 0, 0], { rolls: () => 0, now: 0 }), 'start');
  assert.equal(young.asked[0][2], N.REVENANT_FLEE_PACE, 'rank I: its plain run');
  assert.equal(young.f._craft, undefined);
  const bolt = standing(p, M.Orc, 2);
  N.revenantFleeStep(bolt.f, [0, 0, 0], { rolls: () => 0, now: 0 });
  assert.equal(bolt.asked[0][2], U.CRAFT.BOLT_PACE, 'a bolt');
  assert.equal(bolt.f.entity._craft, 'bolt', 'its flee card reads it');
});

test('UNQUIET SMOKE: a person throws down smoke - DFU\'s Chameleon on it for two rounds, the door\'s puff where it stood - and runs (mutants: no Chameleon; the rounds; no puff)', () => {
  const p = me();
  const puffs = [];
  setPlayerDoor({ fx: (recipe, at) => puffs.push([recipe, at]) });
  const { f, asked } = standing(p, M.Thief, 2);
  assert.equal(N.revenantFleeStep(f, [0, 0, 0], { rolls: () => 0, now: 0 }), 'start');
  assert.equal(asked[0][2], N.REVENANT_FLEE_PACE, 'its run, as any');
  assert.ok(hasActiveEffect(f.entity, 'chameleonNormal'), 'it blends');
  assert.equal(f.entity.activeEffects.find((x) => x.kind === 'chameleonNormal').roundsRemaining, U.CRAFT.SMOKE_ROUNDS - 1, 'two rounds - its first run as it lands (DFU\'s AssignBundle)');
  assert.deepEqual(puffs, [['vanish', [0, 0, 0]]]);
  assert.equal(N.revenantFleeStep(f, [0, 0, 3], { now: 5000 }), 'run', 'it runs on - the distance decides');
});

test('UNQUIET BLINK: a caster runs, and 0.8 s on tears open a rift - its body fading over 600 ms, then gone (an escape); a blow as it fades breaks it (it runs on); silenced or held it never blinks (mutants: the delay; the fade; the blow unread; the silence unread)', () => {
  const p = me();
  const puffs = [];
  setPlayerDoor({ fx: (recipe) => puffs.push(recipe) });
  const { f } = standing(p, M.Mage, 2);
  assert.equal(N.revenantFleeStep(f, [0, 0, 0], { rolls: () => 0, now: 1000 }), 'start');
  assert.equal(N.revenantFleeStep(f, [0, 0, 1], { now: 1799 }), 'run', 'running, the rift not yet open');
  assert.equal(f.portalFx ?? null, null);
  assert.equal(N.revenantFleeStep(f, [0, 0, 1], { now: 1800 }), 'run', 'the rift opens');
  assert.deepEqual({ dir: f.portalFx.dir, at: f.portalFx.at, ms: f.portalFx.ms, tint: f.portalFx.tint }, { dir: 'out', at: 1800, ms: 600, tint: U.CRAFT_TINT.blink });
  assert.deepEqual(puffs, ['vanish']);
  f.ai.fleeLeft = 0;   // its run spent, me at its side: a plain run would be cornered here
  assert.equal(N.revenantFleeStep(f, [0, 0, 1], { now: 2399 }), 'run', 'fading - the distance waits');
  assert.equal(N.revenantFleeStep(f, [0, 0, 1], { now: 2400 }), 'escape', 'through');
  // struck as it fades: it runs on, the rift closed
  const b = standing(p, M.Mage, 2).f;
  N.revenantFleeStep(b, [0, 0, 0], { rolls: () => 0, now: 0 });
  N.revenantFleeStep(b, [0, 0, 1], { now: 800 });
  b.entity.health -= 1;
  assert.equal(N.revenantFleeStep(b, [0, 0, 1], { now: 900 }), 'run');
  assert.equal(b.portalFx, null, 'the rift closed');
  assert.equal(b._craft.kind, 'run');
  assert.equal(N.revenantFleeStep(b, [0, 0, 1], { now: 5000 }), 'run', 'never through - the distance decides now');
  // silenced at the moment: it never blinks
  const s = standing(p, M.Mage, 2).f;
  N.revenantFleeStep(s, [0, 0, 0], { rolls: () => 0, now: 0 });
  assignModBundle(s.entity, { name: 'Silence', kind: 'silenced', rounds: 3 });
  N.revenantFleeStep(s, [0, 0, 1], { now: 800 });
  assert.equal(s._craft.kind, 'run', 'silenced');
  assert.equal(s.portalFx ?? null, null);
  const h = standing(p, M.Mage, 2).f;
  N.revenantFleeStep(h, [0, 0, 0], { rolls: () => 0, now: 0 });
  assignModBundle(h.entity, { name: 'Paralysis', kind: 'paralyze', rounds: 3 });
  N.revenantFleeStep(h, [0, 0, 1], { now: 800 });
  assert.equal(h._craft.kind, 'run', 'held');
});

test('UNQUIET SINK: the dead stand and go into the ground - 200 ms then 1400 ms in the earth\'s tint, then gone (an escape); a blow as it sinks breaks it - cornered, it fights to the end (mutants: the timings; the blow unread; the tint)', () => {
  const p = me();
  const { f, asked } = standing(p, M.Zombie, 2);
  assert.equal(N.revenantFleeStep(f, [0, 0, 0], { rolls: () => 0, now: 0 }), 'start');
  assert.equal(asked[0][2], U.CRAFT.SINK_PACE, 'it stands');
  assert.deepEqual({ dir: f.portalFx.dir, delay: f.portalFx.delay, ms: f.portalFx.ms, tint: [...f.portalFx.tint] }, { dir: 'out', delay: 200, ms: 1400, tint: [0.5, 0.36, 0.2] });
  assert.equal(N.revenantFleeStep(f, [0, 0, N.REVENANT_ESCAPE_DISTANCE + 1], { now: 1599 }), 'run', 'sinking - however far I am (a plain run there is an escape)');
  assert.equal(N.revenantFleeStep(f, [0, 0, 1], { now: 1600 }), 'escape', 'under');
  const b = standing(p, M.Zombie, 2).f;
  N.revenantFleeStep(b, [0, 0, 0], { rolls: () => 0, now: 0 });
  b.entity.health -= 1;
  assert.equal(N.revenantFleeStep(b, [0, 0, 1], { now: 700 }), 'cornered');
  assert.equal(b.fleeing, false);
  assert.equal(b.portalFx, null, 'it rises whole');
  assert.equal(b.ai.fleeLeft, 0);
});

test('UNQUIET THE CRAFT PUT DOWN: a last stand, a kneel or a tear-away mid-flight ends its craft and its dissolve; its flee card says its craft (mutants: a craft kept; the card\'s words)', () => {
  const p = me();
  const { f } = standing(p, M.Zombie, 3);
  N.revenantFleeStep(f, [0, 0, 0], { rolls: () => 0, now: 0 });
  U.endCraft(f);
  assert.deepEqual([f._craft, f.portalFx], [null, null]);
  const src = read('src/systems/revenant/revenantFate.js');
  for (const fn of ['beginLastStand', 'beginTearAway', 'beginYield']) {
    const at = src.indexOf(`export function ${fn}(`);
    assert.ok(at >= 0 && src.slice(at, src.indexOf('\n}', at)).split('\n').slice(1, 5).some((l) => l.trim().startsWith('endCraft(f);')), fn);
  }
  const ev = N.revenantFleeEvent({ ...f.entity, _craft: 'sink', revenant: { id: f.entity.revenant.id } }, 'Zombie', { rolls: () => 0 });
  const r = N.revenantById(f.entity.revenant.id);
  assert.equal(ev.body, `${r.given} sinks into the earth. Strike it before it is under!`);
  assert.deepEqual(['smoke', 'blink', 'bolt'].map((c) => U.craftFleeWords(c, 'Grushnak')), ['Grushnak throws down smoke and is lost to sight!', 'Grushnak tears open a rift. Strike it before it is through!', 'Grushnak bolts!']);   // PIN MOVED (AUDIT UNQUIET): the classic skin draws it not at all
});

// ── wounds ──────────────────────────────────────────────────────────

test('UNQUIET WOUNDS: the blow that broke it leaves its wound - a blade bleeds it, a hammer or a fist cracks it, an axe maims it, an arrow lames it, an element sears it; three kept, the oldest healing; a wound taken again the newest (mutants: a class moved; the cap; the order)', () => {
  assert.deepEqual({ ...U.WOUND }, { MAX: 3, RESIST: -15, HEAL_DAYS: 5 });   // PIN MOVED (AUDIT UNQUIET, section 49): five days - it was three
  assert.deepEqual(['blade', 'blunt', 'h2h', 'axe', 'arrow', 'fire', 'frost', 'shock', 'poison', 'magic', 'silver', null].map(U.woundOf),
    ['bled', 'cracked', 'cracked', 'maimed', 'lamed', 'burned', 'frostbitten', 'stormstruck', 'blighted', 'hexed', null, null]);
  assert.deepEqual(U.withWound(['bled', 'lamed', 'burned'], 'hexed'), ['lamed', 'burned', 'hexed']);
  assert.deepEqual(U.withWound(['bled', 'lamed'], 'bled'), ['lamed', 'bled']);
  assert.deepEqual(U.withWound(['bled'], 'nope'), ['bled']);
  assert.deepEqual(U.sanitizeWounds(['bled', 'bled', 'x', 'lamed', 'burned', 'hexed']), ['lamed', 'burned', 'hexed']);
  assert.deepEqual(U.sanitizeWounds('bled'), []);
  const p = me();
  const r = made(p);
  again(p, r, 'fled', { last: 'arrow' });
  assert.deepEqual(r.wounds, ['lamed'], 'an escape keeps one');
  const ev = N.revenantEscapeEvent(r, 'Ayla', { rolls: () => 0 });
  assert.ok(ev.body.includes(' It bears the wound you left: Lamed.'), ev.body);   // PIN MOVED (AUDIT UNQUIET): "your mark" was THE MARK's word
  assert.ok(!N.revenantEscapeEvent(r, 'Ayla', { rolls: () => 0 }).body.includes('the wound you left'), 'said once');
  again(p, r, 'slew', { last: 'blade' });
  assert.deepEqual(r.wounds, ['lamed'], 'a kill leaves none - it was never broken');
  again(p, r, 'routed', { last: 'blade' });
  assert.deepEqual(r.wounds, ['lamed'], 'nor my flight');
  restoreModSaveRecords(modSaveRecords());
  assert.deepEqual(N.revenantsFor(p).find((x) => x.id === r.id).wounds, ['lamed'], 'saved');
  // the ledger names the class of the last harm that reached it
  const e = foe();
  noteFeudHarm(e, 'axe', 5);
  noteFeudHarm(e, 'fire', 5);
  assert.equal(feudOf(e)?.last, 'fire', 'the last harm\'s class');
  noteFeudHarm(e, 'nope', 5);
  assert.equal(feudOf(e).last, 'other');
});

test('UNQUIET WHAT A WOUND DOES: at its stand - Bled 90% health, Maimed 90% blows, Lamed -15 Speed; Cracked 70% poise and an element\'s wound -15 on that saving throw, on its edge (mutants: each share; the edge unread)', () => {
  const w = U.woundEffects(['bled', 'maimed', 'lamed']);
  assert.deepEqual({ health: w.health, blows: w.blows, poise: w.poise, speed: w.speed }, { health: 0.9, blows: 0.9, poise: 1, speed: -15 });
  assert.deepEqual({ ...U.woundEffects(['cracked', 'burned', 'hexed']).resist }, { fire: -15, magic: -15 });
  assert.equal(U.woundEffects(['cracked']).poise, 0.7);
  const edge = Object.freeze({ poise: 1.2, resist: Object.freeze({ fire: 10 }) });
  assert.equal(U.woundedEdge(edge, []), edge, 'unwounded: its own edge');
  const we = U.woundedEdge(edge, ['cracked', 'burned', 'frostbitten']);
  assert.ok(Math.abs(we.poise - 0.84) < 1e-9);
  assert.deepEqual({ ...we.resist }, { fire: -5, frost: -15 });
  const p = me();
  const plain = made(p, { personality: 'cold' });
  const hurt = made(p, { personality: 'cold' });
  hurt.wounds = ['bled', 'maimed', 'lamed'];
  const stand = (r) => { const e = { mobileType: M.Orc, level: 6, health: 100, maxHealth: 100, stats: { speed: 50 } }; N.applyRevenant(e, r, { now: DAY * 10 }); return e; };
  const a = stand(plain), b = stand(hurt);
  assert.equal(b.maxHealth, Math.round(a.maxHealth * 0.9));
  assert.ok(Math.abs(b.damageScale - a.damageScale * 0.9) < 1e-9);
  assert.equal(b.stats.speed, a.stats.speed - 15);
  hurt.wounds = ['cracked', 'burned'];
  const c = stand(hurt);
  assert.ok(Math.abs(c.revenant.edge.poise - a.revenant.edge.poise * 0.7) < 1e-9, 'cracked: its poise');
  assert.equal(c.revenant.edge.resist.fire, (a.revenant.edge.resist?.fire ?? 0) - 15, 'burned: fire');
});

// ── ambition ────────────────────────────────────────────────────────

test('UNQUIET AMBITION: by who it is - the savage, the zealous and the mad want vengeance; the proud, the cold and the honourable mastery; the rest plunder; derived, never stored (mutants: a personality moved; stored)', () => {
  assert.deepEqual([...U.AMBITIONS], ['vengeance', 'mastery', 'plunder']);
  assert.deepEqual(['brutal', 'zealous', 'unhinged', 'honourable', 'arrogant', 'cold', 'witty', 'humorous', 'craven', 'weary', 'nope'].map(U.ambitionOf),
    ['vengeance', 'vengeance', 'vengeance', 'mastery', 'mastery', 'mastery', 'plunder', 'plunder', 'plunder', 'plunder', 'vengeance']);
  assert.deepEqual({ ...U.AMBITION, VENGEANCE_DUE: [...U.AMBITION.VENGEANCE_DUE] }, { VENGEANCE_DUE: [1440, 2880], VENGEANCE_RETURN: 0.55, FESTER_DAYS: 2, FESTER_EVERY: 2, PLUNDER_PER_DAY: 0.25, PLUNDER_MOST: 3 });
  const p = me();
  const r = made(p);
  restoreModSaveRecords(modSaveRecords());
  assert.equal('ambition' in N.revenantsFor(p).find((x) => x.id === r.id), false);
});

test('UNQUIET VENGEANCE: due in one to two days, and it takes 55% of the return rolls (another the plain 2 to 4 days and its own share) (mutants: the days; the share; the ambition unread)', () => {
  const p = me();
  const v = made(p, { personality: 'brutal' });
  const m = made(p, { personality: 'cold' });
  again(p, v, 'fled', { now: DAY * 20, rolls: () => 0.999 });
  assert.ok(v.dueAt >= DAY * 20 + 1440 && v.dueAt <= DAY * 20 + 2880, `vengeance, the roll's top: ${v.dueAt - DAY * 20}`);
  v.dueAt = DAY * 21; m.dueAt = DAY * 30;
  assert.equal(N.revenantToReturn(p, { now: DAY * 22, rolls: () => 0.549 })?.id, v.id, 'under 55%');
  N.releaseRevenantStand(v);
  assert.equal(N.revenantToReturn(p, { now: DAY * 22, rolls: () => 0.55 }), null);
  v.dueAt = DAY * 30; m.dueAt = DAY * 21;
  assert.equal(N.revenantToReturn(p, { now: DAY * 22, rolls: () => 0.549 }), null, 'mastery: the plain share');
  assert.equal(N.revenantToReturn(p, { now: DAY * 22, rolls: () => N.REVENANT_RETURN_CHANCE - 0.001 })?.id, m.id);
});

test('UNQUIET MASTERY: it trains - a wrath two days past its due day and every two more (another\'s three and three), its rank-up said as training (mutants: the days; the plain law for it; the words)', () => {
  assert.deepEqual([12, 13, 14, 15, 16].map((d) => U.masteryFestersOn(10, d)), [true, false, true, false, true]);
  assert.equal(U.masteryFestersOn(10, 11), false);
  const p = me();
  const r = made(p, { personality: 'cold' });
  r.dueAt = DAY * 10 + 300; r.rank = 1; r.wrath = 0; r.out = false; r.notice = null;
  const at = (d) => ({ now: DAY * d + 60, rolls: () => 0 });
  N.revenantFester(p, at(10));
  N.revenantFester(p, at(12));
  assert.equal(r.wrath, 1, 'day 12');
  N.revenantFester(p, at(14));
  N.revenantFester(p, at(16));
  assert.deepEqual([r.rank, r.wrath], [2, 0], 'three wraths by day 16: a rank');
  assert.equal(N.takeRevenantNotice(p, at(16)).body, `${r.given} grows bolder. It has been training.`);
});

test('UNQUIET PLUNDER: it raids the roads - its hoard a quarter more for each whole day past its due day, three times at most; its drop\'s gold by it (mutants: the share; the cap; the hoard unread)', () => {
  assert.deepEqual([0, 1, 4, 7, 8, 30, -2, 2.9].map(U.plunderGold), [1, 1.25, 2, 2.75, 3, 3, 1, 1.5]);
  const p = me();
  const r = made(p, { personality: 'witty' });
  r.dueAt = DAY * 10;
  const e = { mobileType: M.Orc, level: 6, health: 100, maxHealth: 100 };
  N.applyRevenant(e, r, { now: DAY * 14 + 60 });
  assert.equal(e.revenant.hoard, 2);
  const m = made(p, { personality: 'cold' });
  m.dueAt = DAY * 10;
  const g = { mobileType: M.Orc, level: 6, health: 100, maxHealth: 100 };
  N.applyRevenant(g, m, { now: DAY * 14 + 60 });
  assert.equal(g.revenant.hoard, 1, 'another: none');
  const gold = (ent) => { N.grantRevenantLoot(ent, 10, () => 0.5); return ent.items.find((it) => it.group === 'Currency')?.stackCount; };
  const gp = gold(e), gm = gold(g);
  assert.ok(gp > 0 && gm > 0);
  assert.ok(Math.abs(gp - gm * 2) <= 1, `twice the gold (${gp} of ${gm})`);
});

// ── the Dread ───────────────────────────────────────────────────────

function dreadOf(p, { personality = 'witty' } = {}) {
  const r = made(p, { personality });
  r.rank = 5;
  again(p, r, 'fled', { now: DAY * 30 });
  return r;
}

test('UNQUIET THE DREAD: a rank-V revenant that gets away once more ascends - "the Dread", its lair known, the `ascended` deed and card; with no lair it only gets away; a kill at rank V never; it is kept past the cap (mutants: ascending on a kill; with no lair; the deed; the card\'s kind; buried)', () => {
  assert.deepEqual({ ...U.DREAD }, { HEALTH: 1.5, STANDS: 2, SECOND_STAND: 0.25, GOLD: 3, MAX: 1 });   // PIN MOVED (AUDIT UNQUIET, section 49): one Dread at a time
  const p = me();
  const r = made(p);
  r.rank = 5; r.lairKnown = false;
  again(p, r, 'slew', { now: DAY * 20 });
  again(p, r, 'slew', { now: DAY * 21 });
  assert.equal(r.dread, false, 'killing me twice at rank V: no ascent');
  again(p, r, 'fled', { now: DAY * 30 });
  assert.equal(r.dread, true);
  assert.equal(r.epithet, 'the Dread');
  assert.ok(r.name.endsWith('the Dread'));
  assert.equal(r.lairKnown, true, 'every town knows where');
  assert.equal(r.rank, 5);
  assert.deepEqual(r.history.at(-1), { deed: 'ascended', at: DAY * 30 });
  const ev = N.revenantEscapeEvent(r, 'Ayla', { rolls: () => 0 });
  assert.equal(ev.kind, 'ascended');
  assert.equal(ev.body, `${r.given} will run no more. It is the Dread now, and waits for you in Tomb of Vaness.`);
  assert.equal(ev.kicker, 'The Dread');
  assert.equal(PG.historyWords({ deed: 'ascended', at: 1 }), 'became the Dread');
  assert.match(REVENANT_CARD_CSS, /\.rvncard\.is-ascended \{ border-left-color: #2a0a12; box-shadow: inset 0 0 0 1px #7a1020; \}/);
  restoreModSaveRecords(modSaveRecords());
  assert.equal(N.revenantsFor(p).find((x) => x.id === r.id).dread, true, 'saved');
  // no lair: it only got away
  const q = made(p, { lair: null });
  q.rank = 5;
  again(p, q, 'fled', { now: DAY * 30 });
  assert.equal(q.dread, false);
  assert.equal(U.mayAscend({ rank: 5, lair: LAIR }, 5), true);
  assert.equal(U.mayAscend({ rank: 5, lair: null }, 5), false, 'no lair (AUDIT UNQUIET: q above meets the one-Dread rule first)');
  assert.equal(U.mayAscend({ rank: 4, lair: LAIR }, 5), false);
  assert.equal(U.mayAscend({ rank: 5, lair: LAIR, dread: true }, 5), false);
  // read back: only a rank-V, unsworn record is the Dread
  const raw = modSaveRecords();
  const list = raw[N.REVENANT_SAVE].list;
  list.find((x) => x.id === q.id).dread = true;
  restoreModSaveRecords(raw);
  assert.equal(N.revenantsFor(p).find((x) => x.id === q.id).dread, true, 'rank V');
  list.find((x) => x.id === q.id).rank = 4;
  restoreModSaveRecords(raw);
  assert.equal(N.revenantsFor(p).find((x) => x.id === q.id).dread, false, 'under rank V: none');
});

test('UNQUIET THE DREAD KEPT: a deserter past the cap buries the weakest, oldest of those that hunt - never the Dread, however old, and the Dread is not counted (mutants: the Dread buried; the Dread counted)', () => {
  const p = me();
  const s = made(p, { now: DAY * 1 });
  N.revenantSpared(p, { revenant: { id: s.id } }, { state: 'away' });
  const a = made(p, { now: DAY * 2 });
  a.rank = 5;
  again(p, a, 'fled', { now: DAY * 3 });
  assert.equal(a.dread, true);
  // PIN MOVED (AUDIT UNQUIET, section 49): the Dread hunts no one - three more rise beside it
  const b = made(p, { now: DAY * 4 }), c = made(p, { now: DAY * 5 }), e = made(p, { now: DAY * 5 + 1 });
  assert.ok(e, 'a third rises beside the Dread');
  b.rank = 5; c.rank = 5; e.rank = 5;
  N.revenantDeserts(p, N.revenantById(s.id), { now: DAY * 6 });
  assert.deepEqual(N.livingRevenants().map((x) => x.id).sort(), [a.id, c.id, e.id, s.id].sort(), 'the oldest but the Dread buried');
});

test('UNQUIET THE DREAD AT HOME: it never comes on the road, never festers, is always at home in its lair (known or due or not), and the hunt says go to it (mutants: returning; festering; not at home; the hunt\'s line)', () => {
  const p = me();
  const r = dreadOf(p);
  r.dueAt = 0;
  assert.equal(N.revenantToReturn(p, { now: DAY * 40, rolls: () => 0 }), null, 'never on the road');
  r.wrath = 0;
  for (let d = 30; d <= 60; d++) N.revenantFester(p, { now: DAY * d + 60, rolls: () => 0 });
  assert.equal(r.wrath, 0, 'it festers no more');
  r.dueAt = DAY * 999; r.lairKnown = false;
  assert.equal(N.revenantForLair(p, { px: LAIR.px, py: LAIR.py }, { now: DAY * 40, dueOnly: true })?.id, r.id, 'always at home');
  N.releaseRevenantStand(r);
  r.lairKnown = true;
  const hunt = N.revenantHuntEntries({ px: 100, py: 100 }).find((h) => JSON.stringify(h).includes(r.given));
  assert.ok(JSON.stringify(hunt).includes('The Dread will not come to you again. Go to it.'));
});

test('UNQUIET THE DREAD\'S RUMOUR: every town knows it, however far; each ambition\'s rumour words (another\'s rumour says it - rvn7b_rumor.test.js) (mutants: the reach; the words)', () => {
  const p = me();
  const r = dreadOf(p);
  r.lair = { ...LAIR, px: 400, py: 400, region: 9 };
  const words = N.revenantRumor({ px: 100, py: 100, region: 7 }, { numAnswersGivenTellMeAboutOrRumors: 0 }, { rolls: () => 0 });
  assert.ok(words.startsWith(`They say ${r.name} has gone to ground in Tomb of Vaness, and that nobody who goes in comes out.`), words);
  assert.deepEqual(['vengeance', 'mastery', 'plunder', null].map(U.ambitionRumor),
    ['Word is it asks after you by name.', 'Word is it trains day and night for the day it meets you again.', 'Word is it has been raiding the roads.', '']);
});

test('UNQUIET THE DREAD\'S STAND: half again its health; its will never holds (it kneels - it never runs: THE FLIGHT); two last stands - its rank\'s, then a quarter - and phase two once; its drop its rank\'s and its gold three times over (mutants: each)', async () => {
  const p = me();
  const r = dreadOf(p, { personality: 'cold' });
  const plain = made(p, { personality: 'cold' });
  plain.rank = 5;
  const stand = (x) => { const e = { mobileType: M.Orc, level: 6, health: 100, maxHealth: 100, stats: { speed: 50 } }; N.applyRevenant(e, x, { now: DAY * 40 }); return e; };
  const d = stand(r), o = stand(plain);
  assert.equal(d.maxHealth, Math.round(o.maxHealth * 1.5));
  assert.equal(d.revenant.dread, true);
  assert.equal(d.revenant.hoard, 3);
  const f = { entity: d, ai: { feet: [0, 0, 0], fleeLeft: 0 } };
  assert.equal(FATE.revenantWillHolds(f), false, 'it kneels');
  assert.equal(FATE.revenantLastStandDue(f), true);
  FATE.beginLastStand(p, f, { now: 0, rolls: () => 0 });
  assert.equal(d.health, Math.round(d.maxHealth * F.lastStandHealth(5)), 'its rank\'s');
  const blows = d.damageScale, p2 = d.revenant.p2;
  assert.equal(FATE.revenantLastStandDue(f), true, 'a second');
  FATE.beginLastStand(p, f, { now: 0, rolls: () => 0 });
  assert.equal(d.health, Math.round(d.maxHealth * 0.25), 'a quarter');
  assert.equal(d.damageScale, blows, 'phase two once');
  assert.equal(d.revenant.p2, p2);
  assert.equal(FATE.revenantLastStandDue(f), false, 'no third');
  const g = { entity: o, ai: { feet: [0, 0, 0], fleeLeft: 0 } };
  FATE.beginLastStand(p, g, { now: 0, rolls: () => 0 });
  assert.equal(FATE.revenantLastStandDue(g), false, 'another stands once');
  // PIN MOVED (AUDIT UNQUIET, section 49): its drop is its rank's - its Legendary is its trophy (unquiet2_hunt.test.js
  // THE DREAD'S TROPHY); with one here as well it dropped two. Through the real grant: none where the same rolls give
  // another none, and three times the gold
  const legend = (ent) => ent.items.filter((it) => it.rarity === 'legendary').length;
  const coins = (ent) => ent.items.find((it) => it.group === 'Currency')?.stackCount ?? 0;
  const dd = stand(r), oo = stand(plain);
  N.grantRevenantLoot(dd, 10, () => 0.999);
  N.grantRevenantLoot(oo, 10, () => 0.999);
  assert.deepEqual([legend(dd), legend(oo)], [0, 0]);
  assert.ok(coins(oo) > 0 && Math.abs(coins(dd) - coins(oo) * 3) <= 1, `three times the gold (${coins(dd)} of ${coins(oo)})`);
  // sworn, it is home no longer
  N.revenantSpared(p, { revenant: { id: r.id } }, { state: 'away' });
  assert.equal(N.revenantById(r.id).dread, false);
});

// ── the page ────────────────────────────────────────────────────────

test('UNQUIET THE PAGE: how it gets away (its craft, from rank II), the wounds I left, its ambition, its blood; the Dread\'s home, its two stands, no will; the empty page says who rises (mutants: each line)', () => {
  assert.equal(PG.craftLine({ mobileType: M.Orc, rank: 1 }), 'Its flight: it runs. From rank II it will break away in its own way.');
  assert.equal(PG.craftLine({ mobileType: M.Mage, rank: 2 }), 'Its flight: Blink - it tears open a rift and is gone. Silence it, hold it, or strike it as it fades.');
  // PIN MOVED (AUDIT UNQUIET, section 49): each true on both skins and past its will - a struck sinker's will may still tear it away
  assert.equal(PG.craftLine({ mobileType: M.Zombie, rank: 3 }), 'Its flight: Sink - it sinks into the earth. Strike it before it is under, and it rises, cornered, and runs no more.');
  assert.equal(PG.craftLine({ mobileType: M.Thief, rank: 3 }), 'Its flight: Smoke - it throws down smoke and vanishes as it runs, but a blow can still find it.');
  assert.equal(PG.craftLine({ mobileType: M.Orc, rank: 3 }), 'Its flight: Bolt - it runs faster than anything you have chased. Bring it down from range, and break its will before the killing blow.');
  assert.equal(PG.craftLine({ dread: true }), 'At home it has nowhere to run: it never flees, and kneels at the end.');
  assert.equal(PG.woundLine({ wounds: ['lamed'] }), 'Wounds you left: Lamed (a lamed leg, so it runs slower).');
  assert.equal(PG.woundLine({ wounds: [] }), '');
  assert.equal(PG.ambitionLine({ personality: 'witty' }), 'Its ambition: Plunder - it raids the roads while it waits, and grows richer the longer you leave it.');
  assert.equal(PG.ambitionLine({ personality: 'witty', dread: true }), '');
  assert.equal(PG.bloodLine({ blood: 1, rank: 2 }), 'If it kills you once more, or fells one more companion, it grows bolder.');   // PIN MOVED (AUDIT UNQUIET): a companion is felled
  assert.deepEqual([PG.bloodLine({ blood: 0, rank: 2 }), PG.bloodLine({ blood: 1, rank: 5 })], ['', '']);
  assert.equal(PG.dreadStandLine({ dread: true, rank: 5 }), `Last stands: twice in a fight it rises again, at ${Math.round(F.lastStandHealth(5) * 100)}% and at 25% of its health.`);
  assert.equal(PG.comeWords({ dread: true, lair: { name: 'Tomb of Vaness' }, dueAt: 0 }, 0, false).tag, 'The Dread');
  const src = read('src/ui/revenant/revenantPage.js');
  assert.match(src, /for \(const line of fallen \? \[\] : \[craftLine\(r\), woundLine\(r, now\), ambitionLine\(r\), bloodLine\(r\), tearLine\(r\)\]\) if \(line\)/);
  assert.match(src, /const will = fallen \|\| r\.dread \? '' : willWords\(r\);/);
  assert.match(src, /'An elite or champion marked Unquiet that escapes you, or kills you, will remember you and come back for you\.'/);
});

test('UNQUIET HOST-SPLIT: the craft runs in the flee law both pools share, its look through the pools\' dissolve and the scene\'s door - no host grows (mutants: a host wired)', () => {
  // AUDIT UNQUIET (section 49): the four hosts, each read (the bench is scenes/exterior.js - there was no exteriorBoot.js)
  for (const host of ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/exterior.js']) {
    const s = read(host);
    assert.ok(s.length > 1000, `${host} read`);
    assert.ok(!/revenantUnquiet|unquietMark/.test(s), host);
  }
  assert.match(read('src/scenes/hostMagic.js'), /fx: \(recipe, at, o\) => \{ try \{ fx\.technique\(recipe, at, o\); \} catch/);
});
