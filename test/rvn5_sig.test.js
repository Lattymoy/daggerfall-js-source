// RVN5 - SIGNATURE BLOWS (bible/12-Enhanced-AI/Feud-Arc.md section 16; Mac, 2026-10-04: "more complex, less easy to
// accomplish and more detailed", then "Go"). From rank 2 a revenant has one signature, drawn on its id from the shapes
// its family reaches past its ordinary set (a blade a slam or a charge, a beast a charge or a leap, a brute a ring or a
// charge; a caster, a spectral, a small kind or a flyer the PYRE - a disc at its target's feet that lands as a blast of
// its element through the one cast engine, so the saving throw answers it). x2.0, its own cooldown of 12-18 s, iron
// from rank 3, drawn in its ember, its WIND deeper, called out the first time a stand. Its name: "<given>'s <noun>".
// Needs the Enhanced AI switch; off, the page says so.
// Pinned: the law and the pyre's shape (the brain's verdict, the ground's field, its quad); the names (each bank whole,
// drawn on the id, the shared DFRandom unmoved, the pyre's by its kind's element); the pyre's spell; on the REAL brain
// the signature ahead of every other blow (its numbers, its cooldown, its ember, no feint), the pyre wound up in melee
// and as a shooter's turn, landing a blast only on me and missing into the overreach; the switch; the WIND's pitch and
// no LAND for a pyre; on the REAL street pool the callout once a stand and the pyre's blast through the host's door
// with its cast sound; the dungeon's seam, the hosts' doors and the engine's caster; the wire; the page.
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
const F = await import('../src/systems/revenantFeud.js');
const RC = await import('../src/systems/revenantCompanions.js');
const S = await import('../src/systems/companionSlots.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { setRevenantPresenter } = await import('../src/systems/revenantVoice.js');
const { createExteriorFoes } = await import('../src/scenes/exteriorFoes.js');
const { TELL } = await import('../src/ai/tells.js');
const { setTacticsClock, resetTactics, noteLocalPlayer, signatureReaches } = await import('../src/ai/tactics.js');
const { liveBlows, resetBlows, makeBlow, inBlow, BLOW_CHANCE, IRON_COLOR, BLOW_COLOR } = await import('../src/ai/foeBlows.js');
const { BLOW } = await import('../src/ai/blowShapes.js');
const { BLOW_KIND, quadHalf, blowField } = await import('../src/render/foeTelegraph.js');
const { blowWire } = await import('../src/ai/puppetBlows.js');
const { tellCues } = await import('../src/scenes/hostCombat.js');
const { Collider } = await import('../src/player/collider.js');
const { EnemyAI } = await import('../src/characters/enemyMotor.js');
const { EnemyAttack } = await import('../src/characters/enemyAttack.js');
const { MobileUnit } = await import('../src/characters/mobileUnit.js');
const { ENEMY_BASICS } = await import('../src/characters/enemyBasics.js');
const { MOBILE_TYPES: M } = await import('../src/characters/mobileTypes.js');
const { setWorldMinutes } = await import('../src/systems/worldTick.js');
const { getSeed, setSeed } = await import('../src/formats/dfRandom.js');
const { rollMagnitude } = await import('../src/systems/spellcast.js');
const { SPELL_CAST_SOUND } = await import('../src/systems/enemySpells.js');
const { SOUND } = await import('../src/systems/soundClips.js');
const { signatureWords } = await import('../src/ui/revenantPage.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const me = (id = 'char-rvn5') => ({ isPlayer: true, name: 'Ayla Stormwind', characterId: id, level: 10, reflexes: 2, stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(40).fill(40), skillUses: new Array(40).fill(0), career: {}, activeEffects: [], items: [], health: 100, maxHealth: 100, crimeCommitted: 4 });
let shown = [];
let T = 0;
setTacticsClock(() => T);

beforeEach(() => {
  _resetForTests(); setPref('lootRarity', true); setPref('enhancedAI', true);
  N._resetRevenantForTests(); RC._resetRetinueForTests(); S._resetCompanionSlotsForTests(); _store.clear();
  S.registerCompanionCount('revenant', () => RC.revenantsWithYou().length);
  setPlayerDoor(null); setWorldMinutes(1440 + 120); shown = []; T = 0; resetTactics(); resetBlows();
  setRevenantPresenter((ev) => { shown.push(ev); return true; });
});

const rec = (sig, rank = 2, mobileType = M.Orc, o = {}) => ({ id: `rvn5-${sig}-${rank}`, given: 'Grushnak', sig, rank, mobileType, ...o });

// ── the law ─────────────────────────────────────────────────────────

test('RVN5 THE LAW: from rank 2; x2.0, 12-18 s, iron from rank 3, its ember, its WIND 0.7; the pyre a 2.2 m disc at its target\'s feet out to 12 m, a 1.2 s wind-up; the stand\'s stamp frozen, none under rank 2 or for a shape that is no signature (mutants: any number moved; the rank floors moved; the stamp unfrozen)', () => {
  assert.equal(F.SIG_RANK, 2);
  assert.deepEqual({ ...F.SIG, COOLDOWN: [...F.SIG.COOLDOWN], COLOR: [...F.SIG.COLOR], PYRE_BASE: [...F.SIG.PYRE_BASE] }, { MULT: 2.0, COOLDOWN: [12, 18], IRON_RANK: 3, COLOR: [0.95, 0.25, 0.04], WIND_PITCH: 0.7, PYRE_BASE: [3, 6], PYRE_PER: 1 });
  assert.ok(Object.isFrozen(F.SIG) && Object.isFrozen(F.SIG.COOLDOWN) && Object.isFrozen(F.SIG.COLOR));
  assert.notDeepEqual([...F.SIG.COLOR], [...BLOW_COLOR], 'its ember is not TELL\'s amber');
  assert.notDeepEqual([...F.SIG.COLOR], [...IRON_COLOR], 'nor its iron red');
  assert.deepEqual({ ...BLOW.pyre }, { windup: 1.2, r: 2.2, mult: 1, range: 12 });
  assert.deepEqual(F.SIGNATURES, ['slam', 'charge', 'leap', 'ring', 'pyre']);
  assert.equal(F.signatureStamp(rec('slam', 1)), null, 'rank 1: none');
  assert.equal(F.signatureStamp(rec('sweep', 3)), null, 'no signature shape: none');
  assert.equal(F.signatureStamp(null), null);
  const two = F.signatureStamp(rec('slam', 2)), three = F.signatureStamp(rec('slam', 3));
  assert.ok(Object.isFrozen(two));
  assert.deepEqual({ ...two }, { kind: 'slam', iron: false, mult: 2.0, cooldown: F.SIG.COOLDOWN, color: F.SIG.COLOR, windPitch: 0.7, name: F.signatureName(rec('slam', 2)), noun: F.signatureNoun(rec('slam', 2)), element: 4 });
  assert.equal(two.name, `Grushnak's ${two.noun}`);
  assert.equal(three.iron, true, 'rank 3: iron');
  // the stand carries it: the deed's and the return's stamp
  const p = me();
  const r = N.revenantDeed(p, { mobileType: M.Orc, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Orc, rolls: () => 0 });
  assert.equal(r.rank, 1);
  const e1 = { mobileType: M.Orc, level: 6, health: 50, maxHealth: 50 };
  N.applyRevenant(e1, r);
  assert.equal(e1.revenant.sigBlow, null, 'rank 1: no signature on its stand');
  r.rank = 2; r.sig = F.drawSignature(r.id, r.mobileType);   // as its rank-up draws it (RVN1's pin)
  const e2 = { mobileType: M.Orc, level: 6, health: 50, maxHealth: 50 };
  N.applyRevenant(e2, r);
  assert.equal(e2.revenant.sigBlow.kind, r.sig);
  assert.equal(e2.revenant.sigBlow.name, F.signatureName(r));
});

test('RVN5 THE PYRE\'S SHAPE: the brain\'s verdict a disc about its locked point, the ground\'s field the same, its quad by its point; the slam\'s branch of the shader (mutants: the disc at the foe\'s feet; the radius the leap\'s; the quad the longest\'s)', () => {
  const b = makeBlow('pyre', [0, 0, 0], 0, 0);
  b.ahead = 8;
  assert.equal(inBlow(b, 0, 8), true, 'its point');
  assert.equal(inBlow(b, 2.15, 8), true, 'inside its rim');
  assert.equal(inBlow(b, 2.25, 8), false, 'past its rim');
  assert.equal(inBlow(b, 0, 5.7), false, 'short of it');
  assert.equal(inBlow(b, 0, 0), false, 'the foe\'s own feet are safe');
  assert.equal(blowField('pyre', 0, 8, 8).inside, true);
  assert.equal(blowField('pyre', 2.15, 8, 8).inside, true);
  assert.equal(blowField('pyre', 2.25, 8, 8).inside, false);
  assert.equal(blowField('pyre', 0, 0, 8).inside, false);
  assert.ok(blowField('pyre', 2.1, 8, 8).rim, 'its rim');
  assert.equal(BLOW_KIND.pyre, BLOW_KIND.slam);
  const tg = read('src/render/foeTelegraph.js');
  assert.match(tg, /else if \(b\.kind === 'leap' \|\| b\.kind === 'pyre'\) gl\.uniform4f\(U\.uP, P\.r, b\.ahead \?\? 0, 0, 0\);/, 'the shader: its radius and its point');
  assert.match(tg, /const P = BLOW\[b\.kind\]/, 'its own numbers');
  assert.ok(Math.abs(quadHalf('pyre', 8) - (8 + 2.2 + 0.6)) < 1e-9);
  assert.ok(Math.abs(quadHalf('pyre') - (12 + 2.2 + 0.6)) < 1e-9, 'unplaced: its farthest');
});

// ── the names ───────────────────────────────────────────────────────

test('RVN5 THE NAMES: "<given>\'s <noun>", the noun drawn on its id from its shape\'s bank - each bank whole, every noun reached, one id the same twice, the shared DFRandom unmoved; a pyre\'s by its kind\'s element; derived, never stored (mutants: a bank\'s noun moved; the draw off its id; the last noun unreachable; an element moved)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(F.SIG_NOUNS)), {
    slam: ['Skullsplitter', 'Gravefall', 'Anvil', 'Hammerfall', 'Bonebreaker', 'Mountainfall'],
    sweep: ['Widowmaker', 'Red Harvest', 'Reaping', 'Crescent', 'Scythe-Wind'],
    lunge: ['Heartseeker', "Viper's Kiss", 'Spite', 'Last Word'],
    charge: ['Bloodrush', 'Stampede', "Bull's Folly", 'Avalanche'],
    leap: ['Skyfall', "Raptor's Drop", 'Pounce of Ruin'],
    ring: ['Earthbreaker', 'Quake', 'Ruin-Circle'],
  });
  assert.deepEqual([...F.PYRE_NOUNS], ['Pyre', 'Rimefall', 'Blight', 'Stormcall', 'Unmaking']);
  for (const sig of ['slam', 'charge', 'leap', 'ring']) {
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const n = F.signatureName({ id: `id-${i}`, given: 'Grushnak', sig });
      assert.ok(n.startsWith("Grushnak's "), n);
      seen.add(n.slice("Grushnak's ".length));
    }
    assert.deepEqual([...seen].sort(), [...F.SIG_NOUNS[sig]].sort(), `${sig}: every noun reached, none else`);
  }
  setSeed(777);
  const a = F.signatureName({ id: 'rvn5-same', given: 'Varis', sig: 'slam' });
  assert.equal(getSeed(), 777, 'the shared DFRandom unmoved');
  assert.equal(F.signatureName({ id: 'rvn5-same', given: 'Varis', sig: 'slam' }), a, 'one id, one name');
  assert.ok(a.startsWith("Varis' "), 'the possessive of a name in s');
  assert.ok(F.SIG_NOUNS.slam.includes(F.signatureName({ id: 'x', sig: 'slam', given: null })), 'no given name: the noun alone');
  assert.equal(F.signatureName({ id: 'x', given: 'V' }), null, 'no signature, no name');
  assert.equal(F.signatureName(null), null);
  // the pyre's element, by its kind
  const el = (k) => F.pyreElement(M[k]);
  assert.deepEqual(['FireAtronach', 'Imp'].map(el), [0, 0]);
  assert.deepEqual(['IceAtronach', 'Lich', 'AncientLich'].map(el), [1, 1, 1]);
  assert.deepEqual(['Rat', 'GiantBat', 'Spriggan', 'Zombie', 'Slaughterfish'].map(el), [2, 2, 2, 2, 2]);
  assert.deepEqual(['Harpy'].map(el), [3]);
  assert.deepEqual(['Ghost', 'Wraith', 'Nymph', 'OrcShaman', 'Mage', 'Sorcerer', 'Healer'].map(el), [4, 4, 4, 4, 4, 4, 4]);
  assert.equal(F.signatureName({ id: 'q', given: 'Varis', sig: 'pyre', mobileType: M.Lich }), "Varis' Rimefall");
  assert.equal(F.signatureName({ id: 'q', given: 'Varis', sig: 'pyre', mobileType: M.Imp }), "Varis' Pyre");
  assert.equal(F.signatureName({ id: 'q', given: 'Varis', sig: 'pyre', mobileType: M.Rat }), "Varis' Blight");
  assert.equal(F.signatureName({ id: 'q', given: 'Varis', sig: 'pyre', mobileType: M.Harpy }), "Varis' Stormcall");
  assert.equal(F.signatureName({ id: 'q', given: 'Varis', sig: 'pyre', mobileType: M.Ghost }), "Varis' Unmaking");
  // every kind that draws the pyre has an element; none is stored on the record
  for (const [k, v] of Object.entries(M)) if (F.signatureFamily(v) === null && v !== M.None) assert.ok([0, 1, 2, 3, 4].includes(F.pyreElement(v)), k);
  assert.equal('sigName' in F.feudFields({ sig: 'slam' }, { id: 'x', mobileType: M.Orc, rank: 2 }), false, 'never stored');
});

test('RVN5 THE PYRE\'S SPELL: one Damage Health of its element at range (never CasterOnly - the save answers it), DFU\'s magnitude - 3-6 plus 1 a level - x its mult; its name the signature\'s (mutants: a number moved; the mult unread; CasterOnly)', () => {
  const s = F.pyreSpell("Varis' Rimefall", 1, 2);
  assert.ok(Object.isFrozen(s));
  assert.equal(s.name, "Varis' Rimefall");
  assert.equal(s.element, 1);
  assert.equal(s.rangeType, 2);
  const e = s.effects[0];
  assert.deepEqual([e.type, e.subType], [4, 0], 'Damage Health');
  assert.deepEqual([e.magnitudeBaseLow, e.magnitudeBaseHigh, e.magnitudeLevelBase, e.magnitudeLevelHigh, e.magnitudePerLevel], [6, 12, 2, 2, 1]);
  assert.deepEqual([e.durationBase, e.chanceBase], [0, 100]);
  assert.deepEqual(s.effects.slice(1).map((x) => x.type), [-1, -1]);
  assert.equal(rollMagnitude(e, 6, () => 0), 6 + 12);
  assert.equal(rollMagnitude(e, 6, () => 0.999), 12 + 12);
  const plain = F.pyreSpell(null, null, 1).effects[0];
  assert.deepEqual([plain.magnitudeBaseLow, plain.magnitudeBaseHigh, plain.magnitudeLevelBase], [3, 6, 1]);
  assert.equal(F.pyreSpell(null, null).effects[0].magnitudeBaseHigh, 12, 'the default mult the signature\'s');
  assert.equal(F.pyreSpell(null, 'x').element, 4, 'no element: magic');
  assert.equal(F.pyreSpell(null, 0).name, 'Pyre');
});

// ── the real brain ──────────────────────────────────────────────────

const DT = 1 / 60;
const CAM = [0, 1.6, -5];
function brainFoe(sig, { mobileType = M.Orc, at = [0, 0, 2], rank = 2, shooter = false } = {}) {
  const c = new Collider(() => 0);
  const r = rec(sig, rank, mobileType);
  const ent = { health: 100, maxHealth: 100, mobileType, level: 12, revenant: { id: r.id, name: 'G', rank, learned: [], edge: F.adaptEdge([]), sigBlow: F.signatureStamp(r) } };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => ent, liveSpeed: () => 50 });
  if (shooter) ai.canCastRangedSpell = () => true;
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  const mobile = new MobileUnit(mobileType, ENEMY_BASICS[mobileType], () => 8, () => 0.99);
  return { ai, atk, ent, mobile, entity: ent, mobileType, _seq: 0 };
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
function firstWindup(f, player, secs = 30) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    run(f, DT, player);
    if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai) ?? null;
  }
  return null;
}
function withRandom(v, fn) { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } }

test('RVN5 ON THE REAL BRAIN: its signature ahead of every other blow - x2.0, its ember, its WIND, no feint, iron from rank 3, called (`_sigCall`), its cooldown drawn 12-18 s; inside it the plain blows (mutants: the signature unpicked; its numbers unread; a feint; its cooldown unset or not drawn)', () => {
  for (const rank of [2, 3]) {
    resetTactics(); resetBlows(); T = 0;
    const f = brainFoe('slam', { rank });
    const player = [0, 0, 0];
    const b = withRandom(0.05, () => firstWindup(f, player));
    assert.equal(b?.kind, 'slam', `rank ${rank}: its signature`);
    assert.equal(b.sig, true);
    assert.equal(b.mult, 2.0);
    assert.deepEqual([...b.color], [...F.SIG.COLOR]);
    assert.equal(b.windPitch, 0.7);
    assert.equal(b.guard, rank >= 3 ? 'iron' : 'poise');
    assert.equal(b.feint, undefined, 'a signature never feints');
    assert.ok(Math.abs(f.ai._tac.sigReady - (b.start + 12 + 6 * 0.05)) < 1e-9, 'its cooldown drawn');
    assert.ok(Math.abs(f.ai._sigCall - b.start) < 1e-9, 'called');
  }
  // its cooldown: the next blows inside it are the plain ones (a blade's: a lunge or a sweep), past it the signature again
  resetTactics(); resetBlows(); T = 0;
  const f = brainFoe('slam');
  const player = [0, 0, 0];
  const first = withRandom(0.05, () => firstWindup(f, player));
  assert.equal(first.sig, true);
  run(f, first.land - T + 0.3, player);
  const seen = new Set([first]);
  const next = () => {
    f.ai._tac.blowReady = T;   // its plain cooldown spent by hand: the signature's own gate alone decides
    for (let i = 0; i < 120; i++) {
      const b = withRandom(0.05, () => firstWindup(f, player, 0.5));
      if (b && !seen.has(b)) { seen.add(b); return b; }
      if (f.ai._tac.state !== 'windup') f.ai._tac.blowReady = Math.min(f.ai._tac.blowReady ?? T, T);
    }
    return null;
  };
  assert.ok(f.ai._tac.sigReady > T + 10, 'its cooldown still running');
  const plain = next();
  assert.ok(plain, 'a plain blow inside its cooldown');
  assert.notEqual(plain.sig, true);
  assert.notEqual(plain.mult, 2.0);
  run(f, plain.land - T + 0.3, player);
  f.ai._tac.sigReady = T;   // past its cooldown: its signature again
  const again = next();
  assert.equal(again?.sig, true, 'past it, the signature again');
  // the roll: BLOW_CHANCE's, as every blow's - a draw past it winds nothing
  resetTactics(); resetBlows(); T = 0;
  assert.equal(withRandom(0.99, () => firstWindup(brainFoe('slam'), [0, 0, 0], 3)), null, 'no roll, no signature');
  assert.equal(BLOW_CHANCE, 0.1);
  // the source: no feint on a signature, nor on a pyre
  assert.match(read('src/ai/tactics.js'), /if \(chain === 0 && !sig && shape !== 'aimed' && shape !== 'pyre' && !GAP_CLOSERS\.includes\(shape\)/);
});

test('RVN5 THE PYRE on the REAL brain: wound up at my feet (locked, out to 12 m), iron from rank 3, no held swing; standing in it its blast is asked of the pool (`_blowPyre`, x2.0) and the foe waits - no swing; stepped off, nothing, and it overreaches (mutants: aimed at its own feet; unlocked; a swing held; the blast asked on a miss; no overreach)', () => {
  const land = (stay, rank = 2) => {
    resetTactics(); resetBlows(); T = 0;
    const f = brainFoe('pyre', { mobileType: M.Lich, at: [0, 0, 6], rank });
    const player = [0, 0, 0];
    const b = withRandom(0.05, () => firstWindup(f, player));
    assert.equal(b?.kind, 'pyre');
    assert.ok(Math.abs(b.ahead - Math.hypot(f.ai.feet[0], f.ai.feet[2])) < 0.05, `its point my feet (${b.ahead})`);
    assert.equal(b.guard, rank >= 3 ? 'iron' : 'poise');
    assert.equal(f.ai._blowHold, false, 'no held swing');
    assert.ok(Math.abs((b.land - b.start) - 1.2) < 0.35, 'its wind-up about 1.2 s');
    if (!stay) player[0] += 4;
    run(f, b.land - T + 0.05, player);   // the brain's next turn past its landing
    return f;
  };
  const hit = land(true);
  assert.deepEqual({ ...hit.ai._blowPyre, at: 0 }, { at: 0, mult: 2.0 });
  assert.equal(hit.ai._tac.state, 'wait', 'its landing was its blow');
  assert.equal(hit.ai._blowSwing, false, 'no swing on top');
  const miss = land(false);
  assert.equal(miss.ai._blowPyre ?? null, null, 'stepped off: no blast');
  assert.equal(miss.ai._tac.state, 'overreach');
  assert.equal(land(true, 3).ai._blowPyre.mult, 2.0);
});

test('RVN5 THE PYRE as a shooter\'s turn: a caster that fights at range winds it up with its token - the casters\' first tell; out of range, out of sight or at another than me, never (mutants: the shooter\'s branch unwired; any gate dropped)', () => {
  resetTactics(); resetBlows(); T = 0;
  const f = brainFoe('pyre', { mobileType: M.Lich, at: [0, 0, 10], shooter: true });
  const player = [0, 0, 0];
  const b = withRandom(0.05, () => firstWindup(f, player));
  assert.equal(f.ai._tac.kind, 'ranged', 'it fights as a shooter');
  assert.equal(b?.kind, 'pyre');
  assert.equal(b.sig, true);
  // its cooldown gates the shooter's turn too: landed, its plain cooldown spent, no second pyre inside it
  run(f, b.land - T + 0.3, player);
  f.ai._tac.blowReady = T;
  assert.equal(withRandom(0.05, () => firstWindup(f, player, 3)), null, 'none inside its cooldown');
  f.ai._tac.sigReady = T; f.ai._tac.blowReady = T;
  assert.equal(withRandom(0.05, () => firstWindup(f, player, 3))?.kind, 'pyre', 'past it, again');
  // with its token, as its shot goes (TACT's ranged token)
  assert.match(read('src/ai/tactics.js'), /if \(has && sig\?\.kind === 'pyre' && _me && ai\.canAct !== false && now >= \(s\.blowReady \?\? 0\) && now >= \(s\.sigReady \?\? 0\)/);
  // the gates
  const ai = { inSight: true, _armedTargeting: false };
  assert.equal(signatureReaches(ai, {}, 'pyre', 12, false, 0, 12), true);
  assert.equal(signatureReaches(ai, {}, 'pyre', 12.1, false, 0, 12.1), false, 'past its range');
  assert.equal(signatureReaches({ ...ai, inSight: false }, {}, 'pyre', 5, false, 0, 5), false, 'out of sight');
  assert.equal(signatureReaches({ inSight: true, _armedTargeting: true, target: { isPlayer: true, isPeer: true, peerId: 'p2' } }, {}, 'pyre', 5, false, 0, 5), false, 'at a peer: never (RVN13)');
  assert.equal(signatureReaches({ inSight: true, _armedTargeting: true, target: { mobileType: 7 } }, {}, 'pyre', 5, false, 0, 5), false, 'at a foe: never');
  assert.equal(signatureReaches(ai, {}, 'slam', 2, true, 0, 2), true, 'a shape of reach in reach');
  assert.equal(signatureReaches(ai, {}, 'slam', 6, false, 0, 6), false, 'and never out of it');
  assert.equal(signatureReaches(ai, {}, 'charge', 2, true, 0, 2), false, 'a gap-closer never in reach');
  const bear = brainFoe('charge', { mobileType: M.GrizzlyBear, at: [0, 0, 6] });
  assert.equal(signatureReaches(bear.ai, bear.ent, 'charge', 6, false, 0, -6), true, 'its lane free, out of reach: it charges');
  assert.equal(signatureReaches(bear.ai, bear.ent, 'charge', 6, true, 0, -6), false, 'the same lane in reach (a long arm): never');
});

test('RVN5 THE SWITCH: off, the brain never winds a signature (a telegraph is the Enhanced AI\'s) (mutants: a signature without the switch)', () => {
  setPref('enhancedAI', false);
  const f = brainFoe('slam');
  const b = withRandom(0.05, () => firstWindup(f, [0, 0, 0], 3));
  assert.equal(b, null);
  assert.equal(f.ai._sigCall ?? null, null);
});

test('RVN5 THE CUES: a signature\'s WIND at 0.7 (a person\'s low swing as deep, by the same share); a pyre plays no LAND - its blast is its cast\'s sound (mutants: the pitch unread; the LAND struck)', () => {
  const plays = [];
  const audio = { play3d: (clip, at, vol, o) => plays.push([clip, o.pitch]) };
  const cue = (mobileType, blow) => {
    plays.length = 0;
    const f = { mobileType, ai: { feet: [0, 0, 0], _tac: { state: 'windup', blow, key: 'local' } }, mobile: { meleeSeq: 0 } };
    tellCues(f, audio, 1, blow.start);
    return f;
  };
  const sig = { ...makeBlow('slam', [0, 0, 0], 0, 0), windPitch: 0.7 };
  cue(M.Orc, sig);
  assert.deepEqual(plays, [[ENEMY_BASICS[M.Orc].barkSound, 0.7]]);
  cue(M.Spellsword, sig);
  assert.equal(plays[0][0], SOUND.SwingMediumPitch);
  assert.ok(Math.abs(plays[0][1] - TELL.WIND_CLASS_PITCH * (0.7 / TELL.WIND_PITCH)) < 1e-9);
  cue(M.Orc, makeBlow('slam', [0, 0, 0], 0, 0));
  assert.deepEqual(plays, [[ENEMY_BASICS[M.Orc].barkSound, TELL.WIND_PITCH]], 'a plain blow TELL\'s');
  // the pyre: landed, its sprite's next strike sounds nothing of it
  const pyre = makeBlow('pyre', [0, 0, 0], 0, 0);
  const f = cue(M.Lich, pyre);
  f.ai._tac = { state: 'wait' }; f.ai._blowLandedAt = pyre.land; f.ai._blowHold = false;
  tellCues(f, audio, 1, pyre.land);
  assert.equal(f._tellCue.land, false, 'no LAND for a pyre');
});

// ── the pools and the hosts ─────────────────────────────────────────

const careers = (() => {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  const NAME_FIELD = 14, ENTRY = 18, out = new Uint8Array(4 + b.length + ENTRY), dv = new DataView(out.buffer);
  dv.setInt16(0, 1, true); dv.setUint16(2, 0x0100, true); out.set(b, 4);
  const name = 'ENEMY002.CFG';
  for (let i = 0; i < name.length; i++) out[4 + b.length + i] = name.charCodeAt(i);
  dv.setInt32(4 + b.length + NAME_FIELD, b.length, true);
  return out;
})();
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20, getFrameCount: () => 5 };
function rig(p, strikes, ids) {
  const renderer = {
    createBillboardBatch: (archive, record, size) => ({ archive, record, size, conceal: undefined, dissolve: undefined, origin: null }),
    destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map(), uploadTexture: () => ({}), uploadEmissionTexture: () => ({}),
  };
  return createExteriorFoes({
    renderer, collider: new Collider(() => 0),
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 1000, currentPixelKey: () => '3,12', inLocation: () => true,
    playerEntity: p, audio: { play3dId: (...a) => ids.push(a) }, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
    fates: true, dropLoot: () => {}, shake: () => {},
    magicHooks: { strikePlayer: (spell, level, foe) => strikes.push({ spell, level, foe }) },
  });
}
const frame = (pool) => { T += 0.016; pool.update(0.016, [0, 0, 3], [0, 1.6, 3]); };

test('RVN5 ON THE REAL STREET POOL: its signature called once a stand - the card\'s Signature kicker, "<given> readies <name>!"; a pyre that landed on me its blast through the host\'s door (its spell, its level, its foe) with its element\'s cast sound; a signature of reach none (mutants: the call every wind-up; the card unsaid; the blast not cast; the wrong element\'s sound; a slam cast)', async () => {
  setPref('enhancedAI', false);   // the brain held: the seam alone, its words set by hand
  const p = me();
  const strikes = [], ids = [];
  const pool = rig(p, strikes, ids);
  const r = N.revenantDeed(p, { mobileType: M.Spriggan, level: 6, champion: 'mighty', health: 5, maxHealth: 50, team: 'Monster' }, 'fled', { mobileType: M.Spriggan, rolls: () => 0 });
  r.rank = 2; r.sig = F.drawSignature(r.id, r.mobileType);   // as its rank-up draws it (RVN1's pin)
  assert.equal(r.sig, 'pyre', 'a spriggan\'s signature the pyre');
  const f = await pool.spawnFoe(M.Spriggan, [0, 0, 0], { feetGiven: true, level: 6, revenant: r });
  frame(pool);
  const sb = f.entity.revenant.sigBlow;
  assert.equal(sb.kind, 'pyre');
  assert.equal(sb.element, 2);
  shown = [];
  f.ai._sigCall = T;
  frame(pool);
  assert.equal(f.ai._sigCall, null, 'spent');
  const calls = shown.filter((ev) => ev.kind === 'signature');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kicker, 'Signature');
  assert.equal(calls[0].body, `${r.given} readies ${sb.noun}!`);
  assert.equal(sb.noun, 'Blight');
  f.ai._sigCall = T;
  frame(pool);
  assert.equal(shown.filter((ev) => ev.kind === 'signature').length, 1, 'once a stand');
  // the blast
  f.ai._blowPyre = { at: T, mult: 2 };
  frame(pool);
  assert.equal(f.ai._blowPyre, null, 'spent');
  assert.equal(strikes.length, 1);
  assert.equal(strikes[0].spell.name, sb.name);
  assert.equal(strikes[0].spell.element, 2);
  assert.equal(strikes[0].spell.effects[0].magnitudeBaseHigh, 12, 'x its mult');
  assert.equal(strikes[0].level, f.entity.level);
  assert.equal(strikes[0].foe, f);
  assert.deepEqual(ids.at(-1).slice(0, 1), [SPELL_CAST_SOUND[2]]);
  // a signature of reach: no blast, whatever is asked
  f.entity.revenant = { ...f.entity.revenant, sigBlow: F.signatureStamp({ ...r, sig: 'slam' }) };
  f.ai._blowPyre = { at: T, mult: 2 };
  frame(pool);
  assert.equal(strikes.length, 1, 'a slam casts nothing');
});

test('RVN5 THE DUNGEON AND THE HOSTS: the dungeon\'s seam is the street\'s, through its own engine; every host\'s door through the engine\'s strikePlayerFrom (fireMissile\'s gates), whose caster is a missile\'s - its entity and its sinks, so my reflection sends it back (mutants: any unwired; the caster bare)', () => {
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /if \(f\.ai\._sigCall \|\| f\.ai\._blowPyre\) signatureDungeonFrame\(f\);/);
  assert.match(d, /const r = sb && !f\._sigCalled \? revenantById\(f\.entity\.revenant\.id\) : null;\n\s*if \(r\) \{ f\._sigCalled = true; revenantSay\(revenantSignatureEvent\(r, sb\.noun, \{ archive: f\.mobileArchive(?:, playerName: playerEntity\?\.name)? \}\), \(l\) => hudText\.add\(l\)\); \}/);
  assert.match(d, /if \(sb\?\.kind === 'pyre'\) \{\n\s*audio\.play3dId\?\.\(SPELL_CAST_SOUND\[sb\.element\] \?\? SPELL_CAST_SOUND\[4\], \[f\.ai\.feet\[0\], f\.ai\.feet\[1\], f\.ai\.feet\[2\]\], 1, \{ maxDistance: 16 \}\);\n\s*magic\.strikePlayerFrom\(pyreSpell\(sb\.name, sb\.element, p\.mult\), f\.entity\.level \?\? 1, f\);/);
  assert.match(read('src/scenes/exteriorFoes.js'), /magicHooks\?\.strikePlayer\?\.\(pyreSpell\(sb\.name, sb\.element, p\.mult\), f\.entity\.level \?\? 1, f\);/);
  assert.match(read('src/scenes/world.js'), /strikePlayer: \(spell, casterLevel, foe\) => \{ if \(walkMode && playerSpawned\) magic\.strikePlayerFrom\(spell, casterLevel, foe\); \},/);
  assert.match(read('src/scenes/exterior.js'), /strikePlayer: \(spell, casterLevel, foe\) => \{ if \(walkMode\) magic\.strikePlayerFrom\(spell, casterLevel, foe\); \},/);
  assert.match(read('src/scenes/worldModes.js'), /strikePlayer: \(spell, casterLevel, foe\) => magic\.strikePlayerFrom\(spell, casterLevel, foe\),/);
  assert.match(read('src/scenes/hostMagic.js'), /strikePlayerFrom: \(spell, casterLevel, foe\) => applySpellToPlayer\(spell, casterLevel, foe\?\.entity \? \{ entity: foe\.entity, sinks: foeSinks\(foe\), foe \} : null\),/);
});

test('RVN5 ON THE WIRE: a signature of reach rides as its shape (iron as it is); the pyre not at all - its blast is mine alone until RVN13 (mutants: the pyre on the wire)', () => {
  const pyre = makeBlow('pyre', [0, 0, 0], 0, 0); pyre.ahead = 6;
  assert.deepEqual(blowWire({ _tac: { state: 'windup', blow: pyre } }, 0.1), {});
  const slam = makeBlow('slam', [0, 0, 0], 0, 0, F.SIG.COLOR, 'iron'); slam.sig = true;
  const w = blowWire({ _tac: { state: 'windup', blow: slam } }, 0.1);
  assert.equal(w.wk & 7, 2, 'a slam');
  assert.ok(w.wk & 8, 'iron');
});

// ── the page ────────────────────────────────────────────────────────

test('RVN5 the page: from rank 2 its signature - its name and what it does, "unstoppable" where it is iron, "(with Enhanced AI)" with the switch off; none under rank 2 (mutants: shown at rank 1; the switch unread; the iron unsaid; the shape unsaid)', () => {
  const r = rec('slam', 2);
  const name = F.signatureName(r);
  assert.equal(signatureWords({ ...r, rank: 1 }, true), '');
  assert.equal(signatureWords(r, true), `Signature: ${name} - an overhead slam.`);
  assert.equal(signatureWords(r, false), `Signature: ${name} - an overhead slam (with Enhanced AI).`);
  assert.equal(signatureWords({ ...r, rank: 3 }, true), `Signature: ${name} - an overhead slam, unstoppable.`);
  for (const [sig, what] of [['charge', 'a charge'], ['leap', 'a leap'], ['ring', 'a ring about it']]) {
    assert.ok(signatureWords(rec(sig), true).endsWith(` - ${what}.`), sig);
  }
  assert.equal(signatureWords({ id: 'q', given: 'Varis', sig: 'pyre', mobileType: M.Lich, rank: 2 }, true), "Signature: Varis' Rimefall - a blast of frost at your feet.");
  assert.equal(signatureWords({ id: 'q', given: 'Varis', sig: 'pyre', mobileType: M.Ghost, rank: 2 }, true), "Signature: Varis' Unmaking - a blast of magic at your feet.");
  setPref('enhancedAI', false);
  assert.ok(signatureWords(r).endsWith('(with Enhanced AI).'), 'the switch read by default');
  setPref('enhancedAI', true);
  assert.ok(!signatureWords(r).includes('Enhanced AI'));
  assert.match(read('src/ui/revenantPage.js'), /const sig = fallen \? '' : signatureWords\(r\);   \/\/ RVN5\n\s*if \(sig\) text\.append\(el\('span', 'rvn-will', sig\)\);/);
});
