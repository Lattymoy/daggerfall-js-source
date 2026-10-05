// AUDIT ARENA-LADDER (2026-10-05, the owner: "Before we merge this. Can you do a comprehensive audit on the new arena?
// Ensure AI enemies sometimes recieve telegraphed attacks, ensure climbing the PvE ladder isnt an easy feat, and look at
// where we can make improvements"; asked, "Lose the tier's run", "No cheese spells or potions", "Elite champions",
// "Relay and service"). Every finding of bible/01-Overview/Audit-Arena-Ladder.md pinned here: the telegraphs between
// fighters (the brain's and the relay's), the climb's cost (the run, the elites, the judges' floor, the kit law, the
// ticket), and the bout's holes (the sand's collapse, a dispelled champion, the player's live tag, a blow from the side).
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { setTacticsClock, resetTactics, tacticsStep, noteLocalPlayer, LOCAL_TARGET } from '../src/ai/tactics.js';
import {
  resetBlows, makeBlow, setLiveBlow, drawableBlows, blowConnects, blowScaled, registerBlowDodgedListener, SAND_DRAW_RANGE, liveBlows,
  BLOW_TIER_LEVEL, BLOW_COOLDOWN_MIN, BLOW_COOLDOWN_MAX, BLOW_CHANCE, blowShapesOf as foeShapesOf, inBlow as foeInBlow, BLOW as FOE_BLOW,
} from '../src/ai/foeBlows.js';
import { BLOW, BLOW_FAMILY, BLOW_CASTERS, blowShapesOf, inBlow } from '../src/ai/blowShapes.js';
import { setPlayerBout, playerBoutOf, boutGate, inBout } from '../src/characters/enemyTargets.js';
import { LADDER_TIERS, ladderAfter, arenaLadderRestore, BOUTS_PER_TIER, nextLadderBout, arenaLadderSnapshot, BOUT_PURSE } from '../src/systems/arenaLadder.js';
import { boutPoints } from '../src/systems/arenaLeague.js';
import { revenantCandidate } from '../src/systems/revenant.js';
import { createArenaBouts } from '../src/scenes/arenaBouts.js';
import { createArenaClaims } from '../src/net/arenaClaims.js';
import { newBout, boutTick, boutHit, boutAtMarks, takeBoutEvents, callMs, COUNT_MS, BOUT_LIMIT_MS } from '../src/systems/arenaBout.js';
import { SAND_BARRED_EFFECTS, SAND_BARRED_KINDS, SAND_CEILING_M, onTheSand, sandPotionRefusal, sandSpellRefusal, stripSandBarred, restoreSandHeld } from '../src/systems/arenaKit.js';
import { PlayerMotor, JUMP_SPEED } from '../src/player/motor.js';
import { JUMP_SPELL_MULTIPLIER, ATHLETICISM_MULTIPLIER, IMPROVED_ATHLETICISM_MULTIPLIER } from '../src/systems/skills.js';
import { useItem, TEMPLATES } from '../src/systems/useItem.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { ELITE_FOE_HEALTH_MULT, ELITE_FOE_DAMAGE_MULT } from '../src/systems/eliteFoes.js';
import {
  arenaFoeStats, arenaLadderBout, ARENA_CLASS_SPEED, ARENA_BEAST_SPEED, ARENA_ELITE_HP_MULT, ARENA_ELITE_DMG_MULT, ARENA_BLOW_TIER_LEVEL,
  ARENA_BLOW_CHANCE, ARENA_BLOW_COOLDOWN_MIN_MS, ARENA_BLOW_COOLDOWN_MAX_MS, ARENA_BLOW_SHAPES, LADDER_JUDGES_SHARE, ARENA_TICKET_RE,
  validArenaIn, validArenaOut, ARENA_NO_TEXT, ARENA_FLOOR_CENTRE, arenaBoutRoom, ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES, ARENA_PAIR_SEASON_MAX,
  ARENA_PAIR_DAY_MAX, ladderKey, ARENA_ATTEMPT_LIFE_S, ARENA_KEEP_MS,
} from '../src/net/arenaLaw.js';
import { openBout, joinBout, stepBout } from '../src/net/arenaBrain.js';
import { mintArenaReceipt, readArenaReceipt, arenaReceiptValid } from '../src/net/arenaReceipt.js';
import { fakeRooms } from './fakeRoom.mjs';
import { standService } from './accountDb.mjs';
import { laurelWorthy, laurelOfBoard, ARENA_ATTEMPTS_KEEP_S } from '../server-account/src/arena.js';
import { createArenaOnline } from '../src/scenes/arenaOnline.js';
import { arenaLadderOf } from '../src/net/arenaLaw.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); setPlayerBout(null); });

// ── THE TELEGRAPHS: the owner's "Ensure AI enemies sometimes recieve telegraphed attacks" ──────────────────────

test('AUDIT ARENA-LADDER T1: the families moved to the leaf by MobileTypes number - every number the kind it names, the brain\'s law unchanged, one home handed on (mutants: a number off by one; a caster left throwing; the re-export a copy)', () => {
  const named = {
    GrizzlyBear: 'lunge', SabertoothTiger: 'lunge', Spider: 'lunge', Werewolf: 'lunge', Wereboar: 'lunge', GiantScorpion: 'lunge', Dragonling: 'lunge', Dragonling_Alternate: 'lunge',
    Giant: 'slam', OrcWarlord: 'slam', Daedroth: 'slam', DaedraLord: 'slam', IronAtronach: 'slam', FleshAtronach: 'slam', Gargoyle: 'slam', Dreugh: 'slam',
    Centaur: 'sweep', Orc: 'sweep', OrcSergeant: 'sweep', SkeletalWarrior: 'sweep', Mummy: 'sweep', Vampire: 'sweep', VampireAncient: 'sweep', FrostDaedra: 'sweep', FireDaedra: 'sweep', DaedraSeducer: 'sweep', Lamia: 'sweep',
  };
  const fam = { lunge: ['lunge'], slam: ['slam', 'sweep'], sweep: ['sweep', 'lunge'] };
  for (const [k, first] of Object.entries(named)) {
    assert.ok(Number.isInteger(M[k]), k);
    assert.deepEqual([...BLOW_FAMILY.get(M[k])], fam[first], `${k} (${M[k]})`);
  }
  assert.equal(BLOW_FAMILY.size, Object.keys(named).length, 'no number the table names that the kinds do not');
  assert.deepEqual([...BLOW_CASTERS].sort(), [M.Mage, M.Sorcerer, M.Healer].sort());
  for (const c of [M.Mage, M.Sorcerer, M.Healer]) assert.deepEqual(blowShapesOf(c), [], 'a caster throws none');
  assert.deepEqual([...blowShapesOf(M.Knight)], ['sweep', 'lunge'], 'a class with a blade');
  assert.deepEqual(blowShapesOf(M.Rat), [], 'the small');
  assert.deepEqual(blowShapesOf(M.None), []);
  assert.equal(foeShapesOf, blowShapesOf, 'ai/foeBlows.js hands the leaf\'s own on');
  assert.equal(foeInBlow, inBlow);
  assert.equal(FOE_BLOW, BLOW);
  assert.doesNotMatch(rd('src/ai/blowShapes.js'), /^import /m, 'a leaf: the relay\'s graph reaches it and nothing past it');
});

/** A fighter on the sand, of `bout` and `side`, at `feet`, as the brain reads one (an entity, its feet, its target). */
function fighter({ feet, side, bout = 'b1', level = 12, type = M.Orc, out = false, hold = false } = {}) {
  const body = { health: 100, maxHealth: 100, mobileType: type, level, bout: { id: bout, side, ...(out ? { out } : {}), ...(hold ? { hold } : {}) } };
  const ai = { inSight: true, detected: true, _dist: 1.6, feet: [...feet], stopDistance: 2.25, yaw: 0, canAct: true, _armedTargeting: true, collider: new Collider(() => 0), vitals: () => body, flee() {} };
  return { ai, entity: body };
}
const targetOf = (f) => ({ isPlayer: false, entity: f.entity, ai: f.ai, dead: false });
/** `a` engaged on `b` with its token, the roll the wind-up's. */
function windUp(a, b) {
  a.ai.target = targetOf(b);
  const rnd = Math.random;
  Math.random = () => 0;
  try { tacticsStep(a.ai, b.ai.feet[0] - a.ai.feet[0], b.ai.feet[2] - a.ai.feet[2]); } finally { Math.random = rnd; }
  return a.ai._tac;
}

test('AUDIT ARENA-LADDER T2: ON THE SAND A FIGHTER WINDS UP AT ITS BOUT-MATE - a token holder of the tier, at a fighter of the same live bout on another side; the blow marked for it and drawn for the stands (mutants: the mark the player alone; the bout\'s id unread; the side unread; the stands\' range off)', () => {
  noteLocalPlayer([40, 0, 40], [0, 0, 1]);
  const a = fighter({ feet: [0, 0, 0], side: 0 }), b = fighter({ feet: [0, 0, 1.6], side: 1 });
  const s = windUp(a, b);
  assert.equal(s.state, 'windup', 'a wind-up at the other fighter');
  assert.equal(s.blow.tg, a.ai.target, 'marked for the one it was wound up at');
  assert.equal(s.blow.sand, true);
  // and none where the mark is no bout-mate
  for (const [why, other] of [
    ['the same side', fighter({ feet: [0, 0, 1.6], side: 0 })],
    ['another bout', fighter({ feet: [0, 0, 1.6], side: 1, bout: 'b2' })],
    ['a fighter out', fighter({ feet: [0, 0, 1.6], side: 1, out: true })],
    ['a bout on hold', fighter({ feet: [0, 0, 1.6], side: 1, hold: true })],
  ]) {
    resetTactics(); resetBlows();
    const x = fighter({ feet: [0, 0, 0], side: 0 });
    assert.notEqual(windUp(x, other).state, 'windup', why);
  }
  resetTactics(); resetBlows();
  const street = fighter({ feet: [0, 0, 0], side: 0 }), mark = fighter({ feet: [0, 0, 1.6], side: 1 });
  street.entity.bout = null;
  assert.notEqual(windUp(street, mark).state, 'windup', 'a street\'s infighting: no telegraph (TACT4\'s law kept)');
  // the stands see a sand's blow from the far tier; a street's stays within its 40 m
  T = 1;
  const sand = makeBlow('lunge', [0, 0, 0], 0, T); sand.sand = true;
  const road = makeBlow('lunge', [0, 0, 0], 0, T);
  const ka = {}, kb = {};
  setLiveBlow(ka, sand); setLiveBlow(kb, road);
  assert.equal(SAND_DRAW_RANGE, 100);
  const far = drawableBlows(T, [90, 0, 0]);
  assert.deepEqual(far.map((x) => x.blow), [sand], '90 m off: the sand\'s alone');
  assert.equal(drawableBlows(T, [30, 0, 0]).length, 2);
});

test('AUDIT ARENA-LADDER T3: the bout-mate\'s blow lands by its shape - the verdict where the mark stands, the shape\'s weight on the damage, a dodge a miss told to the listeners; a wind-up whose foe turned lands on no one (mutants: the verdict read at my feet; the weight dropped; the dodge untold)', () => {
  noteLocalPlayer([40, 0, 40], [0, 0, 1]);
  const told = [];
  registerBlowDodgedListener('t3', (ai) => told.push(ai));
  try {
    const a = fighter({ feet: [0, 0, 0], side: 0 }), b = fighter({ feet: [0, 0, 1.6], side: 1 });
    const s = windUp(a, b);
    const mult = s.blow.mult;
    T = s.blow.land + 0.01;
    tacticsStep(a.ai, 0, 1.6);
    assert.equal(a.ai._blowVerdict, true, 'the mark stood in its shape');
    assert.equal(a.ai._blowMult, mult, 'its weight carried to the swing');
    assert.ok(mult > 1);
    assert.equal(blowConnects(a.ai, false, T), true, 'the shape decides, not the classic reach');
    assert.equal(blowScaled(a.ai, 10), Math.round(10 * mult), 'weighed by its shape');
    assert.equal(told.length, 0);
    // stepped out of it: a dodge
    resetTactics(); resetBlows(); T = 0;
    const c = fighter({ feet: [0, 0, 0], side: 0 }), d = fighter({ feet: [0, 0, 1.6], side: 1 });
    const s2 = windUp(c, d);
    d.ai.feet = [8, 0, 1.6];   // out of any shape's reach
    T = s2.blow.land + 0.01;
    tacticsStep(c.ai, 8, 1.6);
    assert.equal(c.ai._blowVerdict, false);
    assert.equal(blowConnects(c.ai, true, T), false, 'stepped out of: no blow, whatever the classic reach said');
    assert.deepEqual(told, [c.ai], 'and the dodge told (the judges\' miss)');
    // turned on another before it landed: no one
    resetTactics(); resetBlows(); T = 0;
    const e = fighter({ feet: [0, 0, 0], side: 0 }), f = fighter({ feet: [0, 0, 1.6], side: 1 }), g = fighter({ feet: [0, 0, -1.6], side: 2 });
    const s3 = windUp(e, f);
    e.ai.target = targetOf(g);
    T = s3.blow.land + 0.01;
    tacticsStep(e.ai, 0, -1.6);
    assert.equal(e.ai._blowVerdict ?? null, null, 'turned: no verdict');
  } finally { registerBlowDodgedListener('t3', null); }
  // the local player's blows as they were: one wound up without a mark lands on me
  resetTactics(); resetBlows(); T = 0;
  noteLocalPlayer([0, 0, 2], [0, 0, 1]);
  const ai = { inSight: true, detected: true, _dist: 2, feet: [0, 0, 0], stopDistance: 2.25, yaw: 0, canAct: true, _armedTargeting: false, target: null, flee() {} };
  ai._tac = { key: LOCAL_TARGET, kind: 'melee', state: 'windup', until: 0, slot: 0, hp: [], fled: false, seen: 0, swung: 0, shot: 0, kiting: false, meleeUntil: 0, leased: 0, blow: makeBlow('lunge', [0, 0, 0], 0, -1) };
  tacticsStep(ai, 0, 2);
  assert.equal(ai._blowVerdict, true, 'TACT4\'s law: a blow with no mark is mine');
});

test('AUDIT ARENA-LADDER T4: the hosts resolve a fighter\'s blow on a fighter by its shape and tell the arena a dodge (mutants: the classic reach alone between foes; the weight dropped; the listener unregistered)', () => {
  const dc = rd('src/scenes/dungeonContext.js'), ef = rd('src/scenes/exteriorFoes.js');
  assert.match(dc, /if \(blowConnects\(f\.ai, foeDeps\.meleeHitConnects\(/);
  assert.match(dc, /dealDamage: \(tt, d\) => tt\.hurtFromFoe\?\.\(blowScaled\(f\.ai, d\), fwd, f\)/);
  assert.match(ef, /if \(blowConnects\(f\.ai, meleeHitConnects\(/);
  assert.match(ef, /d = blowScaled\(f\.ai, d\);/);
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(h), /registerBlowDodgedListener\('arena', \(ai\) => arenaBouts\.blowDodged\(ai\)\);/, h);
  const ab = rd('src/scenes/arenaBouts.js');
  assert.match(ab, /function blowDodged\(ai\) \{[\s\S]*?recordStrike\(C\.rec, t, from\);\s*boutMiss\(C\.b, \{ from, now: t \}\);/);
  // a relay's telegraph drawn off its word, where it was wound up (AUDIT ARENA-LADDER 2: at the relay's moment - R2 below)
  assert.match(ab, /if \(w\.s && foe\?\.ai\?\.feet\) \{\s*const land = relayLandLocal\(C, w, t\);\s*const p = relayToStage\(C, w\.ox, w\.oz\);/);
});

/** A relay's ladder bout of `tier`/`bout`, its fighter on the sand and the law fighting at `t`. */
function relayLadder(tier, bout, { cl = 20 } = {}) {
  let t = 1_000_000;
  const st = openBout({ o: '00000000000000c1', kind: 'pve', f: [{ sub: 'acct-x', name: 'Ceryn', lv: cl, cl, tk: 'feedc0de00000009' }], tier, bout, now: t });
  joinBout(st, 'acct-x', 'f', t);
  const C = ARENA_FLOOR_CENTRE;
  st.last.p0 = [C[0], C[2], t];
  t += callMs(st.b);
  stepBout(st, t, () => 0.9);
  for (const x of st.b.fighters) boutAtMarks(st.b, x.id, t);
  t += COUNT_MS;
  stepBout(st, t, () => 0.9);
  assert.equal(st.b.phase, 'fight');
  return { st, t, C };
}

test('AUDIT ARENA-LADDER T5: THE RELAY\'S FIGHTERS TELEGRAPH TOO - of the tier (level 10 up, or a champion), its cooldown spent, the roll: the `atk` word carries the shape, its facing and where it was wound up; it lands by the shape and its weight, and a step out of it is a miss (mutants: the tier unread; the shape\'s verdict the reach\'s; the weight dropped; the cooldown unset)', () => {
  assert.equal(ARENA_BLOW_TIER_LEVEL, BLOW_TIER_LEVEL, 'the brain\'s tier');
  assert.deepEqual([ARENA_BLOW_COOLDOWN_MIN_MS, ARENA_BLOW_COOLDOWN_MAX_MS], [BLOW_COOLDOWN_MIN * 1000, BLOW_COOLDOWN_MAX * 1000], 'the brain\'s cooldown');
  assert.ok(ARENA_BLOW_CHANCE > BLOW_CHANCE && ARENA_BLOW_CHANCE < 1, 'rolled once a blow, not a tick: more often a roll, sometimes');
  assert.deepEqual([...ARENA_BLOW_SHAPES].sort(), Object.keys(BLOW).sort());
  const { st, t, C } = relayLadder(6, 0);   // the Knight, level 13
  const a = st.ai[0];
  a.pos = [C[0], C[2] + 1.6]; a.mv = null;
  const words = stepBout(st, t, () => 0);
  const atk = words.find((w) => w.k === 'atk');
  assert.ok(atk?.s, 'a telegraphed blow');
  assert.deepEqual(validArenaOut(atk), atk, 'its word as the wire carries it');
  assert.equal(atk.tg, 'p0');
  assert.ok(atk.at - t >= BLOW[atk.s].windup * 1000 - 1, 'its wind-up the shape\'s');
  assert.ok(a.blowAt >= t + ARENA_BLOW_COOLDOWN_MIN_MS, 'its cooldown set');
  const hp0 = st.b.fighters.find((f) => f.id === 'p0').health;
  const land = stepBout(st, atk.at, () => 0);
  const blow = land.find((w) => w.k === 'blow');
  assert.ok(blow, 'stood in its shape: struck');
  assert.equal(blow.d, Math.max(1, Math.round(a.dmg[0] * BLOW[atk.s].mult)), 'the roll weighed by the shape');
  assert.equal(st.b.fighters.find((f) => f.id === 'p0').health, hp0 - blow.d);
  // the next telegraph (past its cooldown), stepped out of
  a.nextAt = 0; a.blowAt = 0;
  const w2 = stepBout(st, atk.at + 10, () => 0).find((w) => w.k === 'atk');
  assert.ok(w2?.s);
  st.last.p0 = [C[0], C[2] + 3.1, atk.at + 10];   // behind it: in the plain blow's reach, out of every shape
  const missBefore = st.b.fighters.find((f) => f.id === 'a0')?.misses ?? 0;
  const l2 = stepBout(st, w2.at, () => 0);
  assert.equal(l2.find((w) => w.k === 'blow'), undefined, 'out of its shape: no blow, though in its reach');
  assert.equal((st.b.fighters.find((f) => f.id === 'a0')?.misses ?? 0), missBefore + 1, 'a miss for the judges');
  // under the tier, never
  const low = relayLadder(0, 0);
  const la = low.st.ai[0];
  la.pos = [low.C[0], low.C[2] + 1.6]; la.mv = null;
  const lw = stepBout(low.st, low.t, () => 0).find((w) => w.k === 'atk');
  assert.ok(lw && lw.s === undefined, 'the Pit\'s thief swings plainly');
  // and the champion, under the tier by level, is of it as an elite
  const ch = relayLadder(0, 3);
  const ca = ch.st.ai[0];
  assert.equal(ca.elite, true);
  ca.pos = [ch.C[0], ch.C[2] + 1.6]; ca.mv = null;
  assert.ok(stepBout(ch.st, ch.t, () => 0).find((w) => w.k === 'atk')?.s, 'the Pit\'s champion telegraphs');
});

// ── THE CLIMB: the owner's "ensure climbing the PvE ladder isnt an easy feat" ──────────────────────────────

test('AUDIT ARENA-LADDER L1: A LOSS BREAKS THE TIER\'S RUN - back to its first bout, said; a champion beaten stays beaten; a loss at the run\'s start loses nothing more; a draw is a loss (mutants: the run kept; runLost always said; the champion\'s tier taken back)', () => {
  let L = arenaLadderRestore(null);
  L = ladderAfter(L, { won: true }).ladder;
  L = ladderAfter(L, { won: true }).ladder;
  assert.equal(L.won, 2);
  const lost = ladderAfter(L, { won: false, how: 'fall' });
  assert.equal(lost.ladder.won, 0, 'back to the first bout');
  assert.equal(lost.runLost, true);
  assert.equal(lost.ladder.tier, 0);
  assert.equal(lost.ladder.record.losses, 1);
  const again = ladderAfter(lost.ladder, { won: false, how: 'yield' });
  assert.equal(again.runLost, false, 'nothing to lose at the start');
  // three wins, the champion: the next tier, kept through a loss there
  let M2 = lost.ladder;
  for (let i = 0; i < BOUTS_PER_TIER; i++) M2 = ladderAfter(M2, { won: true }).ladder;
  const champ = ladderAfter(M2, { won: true });
  assert.equal(champ.tierUp, true);
  const l2 = ladderAfter(ladderAfter(champ.ladder, { won: true }).ladder, { won: false, how: 'judges' });
  assert.deepEqual([l2.ladder.tier, l2.ladder.won, l2.runLost], [1, 0, true], 'a judges\' loss in the second tier: its run, never the first tier\'s title');
  assert.equal(ladderAfter(champ.ladder, { won: false, how: 'draw' }).ladder.record.losses, champ.ladder.record.losses + 1, 'a draw counts as a loss');
  assert.match(ARENA_TEXT.ladder.runLost('the Pit'), /run in the Pit is over/);
  assert.match(rd('src/scenes/arenaBouts.js'), /else if \(out\.runLost\) lines\.push\(ARENA_TEXT\.ladder\.runLost\(ARENA_TEXT\.tiers\[out\.ladder\.tier\]\)\);/);
});

test('AUDIT ARENA-LADDER L2: EVERY TIER\'S CHAMPION FIGHTS AS AN ELITE - offline (spawned elite on both floors) and on the relay (its body the elite multipliers\'); no other bout\'s foe is (mutants: a champion plain; a bout\'s foe elite; the spawn\'s elite dropped)', () => {
  for (const t of LADDER_TIERS) {
    assert.ok(t.champion.length && t.champion.every((c) => c.elite === true), 'the champion elite');
    assert.ok(t.bouts.every((b) => b.every((c) => !c.elite)), 'its bouts plain');
  }
  const wm = rd('src/scenes/worldModes.js');
  assert.equal((wm.match(/bout: o\.bout \?\? null, eliteFoe: !!o\.elite \}/g) ?? []).length, 2, 'both floors\' stage spawns');
  assert.match(rd('src/scenes/arenaBouts.js'), /stage\.spawn\(f\.spec\.mobile, feet, \{ level: f\.spec\.level, elite: !!f\.spec\.elite,/);
  assert.deepEqual([ARENA_ELITE_HP_MULT, ARENA_ELITE_DMG_MULT], [ELITE_FOE_HEALTH_MULT, ELITE_FOE_DAMAGE_MULT], 'the relay\'s elite is the world\'s');
  const plain = arenaFoeStats(M.Knight, 5), el = arenaFoeStats(M.Knight, 5, { elite: true });
  assert.equal(el.hp, plain.hp * 5);
  assert.deepEqual(el.dmg, plain.dmg.map((d) => d * 3));
  const beast = arenaFoeStats(M.GrizzlyBear, null), eb = arenaFoeStats(M.GrizzlyBear, null, { elite: true });
  assert.equal(eb.hp, beast.hp * 5);
  for (let tier = 0; tier < 10; tier++) {
    assert.ok(arenaLadderBout(tier, 3).foes.every((f) => f.elite), `tier ${tier}'s champion`);
    for (let b = 0; b < 3; b++) assert.ok(arenaLadderBout(tier, b).foes.every((f) => !f.elite), `tier ${tier} bout ${b}`);
  }
});

test('AUDIT ARENA-LADDER L3: THE RELAY\'S FIGHTERS RUN - faster than any character\'s walk (mutants: the old 3.2 and 3.6)', () => {
  assert.equal(ARENA_CLASS_SPEED, 5.0);
  assert.equal(ARENA_BEAST_SPEED, 6.0);
  assert.equal(arenaFoeStats(M.Knight, 5).speed, ARENA_CLASS_SPEED);
  assert.equal(arenaFoeStats(M.GrizzlyBear, null).speed, ARENA_BEAST_SPEED);
});

/** A bout of player `p` (side 0) and an AI (side 1), to its fight. */
function judged(judgesFloor) {
  const b = newBout({ id: 'j', kind: 'ladder', fighters: [{ id: 'p', name: 'Me', side: 0, maxHealth: 100, ai: false }, { id: 'a', name: 'Foe', side: 1, maxHealth: 200, ai: true }], ring: { centre: [0, 0], radius: 14 }, now: 0, judgesFloor });
  boutTick(b, callMs(b));
  for (const f of b.fighters) boutAtMarks(b, f.id, callMs(b));
  const t = callMs(b) + COUNT_MS;
  boutTick(b, t);
  takeBoutEvents(b);
  return { b, t };
}

test('AUDIT ARENA-LADDER L4: THE LADDER\'S JUDGES\' FLOOR - at the time limit a player\'s side short of half its opponents\' whole health wins no card; the relay\'s ladder alone sets it (mutants: the floor unread; read off the player\'s own health; the relay passing none)', () => {
  assert.equal(LADDER_JUDGES_SHARE, 0.5);
  // one blow and the clock walked away from
  const { b, t } = judged(LADDER_JUDGES_SHARE);
  boutHit(b, { from: 'p', to: 'a', dmg: 30, now: t + 1 });
  boutTick(b, t + BOUT_LIMIT_MS);
  assert.equal(b.result.how, 'judges');
  assert.equal(b.result.side, 1, 'short of the floor: the card is the fighter\'s');
  // the same, past the floor (100 of 200)
  const x = judged(LADDER_JUDGES_SHARE);
  boutHit(x.b, { from: 'p', to: 'a', dmg: 100, now: x.t + 1 });
  boutTick(x.b, x.t + BOUT_LIMIT_MS);
  assert.equal(x.b.result.side, 0, 'past it: mine');
  // no floor: the judges as they always were
  const y = judged(0);
  boutHit(y.b, { from: 'p', to: 'a', dmg: 30, now: y.t + 1 });
  boutTick(y.b, y.t + BOUT_LIMIT_MS);
  assert.equal(y.b.result.side, 0);
  assert.match(rd('src/net/arenaBrain.js'), /judgesFloor: st\.kind === 'pve' \? LADDER_JUDGES_SHARE : 0 \}\);/);
});

test('AUDIT ARENA-LADDER L5: THE SAND\'S KIT LAW - in a bout of one\'s own no potion is drunk (the bottle kept), no Invisibility, Levitate, Chameleon, Shadow, Charm or Teleport is cast, and those already on the fighter come off; outside a bout, all as before (mutants: a barred type dropped; the bottle eaten; the strip unread)', () => {
  assert.deepEqual([...SAND_BARRED_EFFECTS], [13, 14, 23, 24, 33, 34, 43]);   // AUDIT ARENA-LADDER 2: Pacify (the Calms) too
  const table = rd('src/systems/spellEffects.js');
  for (const [type, name] of [[13, 'Invisibility'], [14, 'Levitate'], [23, 'Chameleon'], [24, 'Shadow'], [33, 'Pacify'], [34, 'Charm'], [43, 'Teleport']]) assert.match(table, new RegExp(`\\[${type}, \\d+, '${name}'`), `${type} is ${name}`);
  const potion = { name: 'Potion', group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, stackCount: 1 };
  const pack = [potion];
  assert.equal(onTheSand(), false);
  assert.equal(sandPotionRefusal(), null);
  assert.equal(sandSpellRefusal({ effects: [{ type: 14 }] }), null, 'off the sand: Levitate as ever');
  setPlayerBout({ id: 'b1', side: 0 });
  assert.equal(onTheSand(), false, 'AUDIT ARENA-LADDER 2: a bout between players is not the ladder\'s - its kit as ever');
  setPlayerBout({ id: 'b1', side: 0, kit: true });
  assert.equal(onTheSand(), true);
  const r = useItem(potion, pack, { drinkPotion: () => { throw new Error('drunk'); } });
  assert.equal(r.kind, 'refused');
  assert.equal(r.refused, true, 'a refusal the quick slot reads as one');
  assert.equal(r.text, ARENA_TEXT.refuse.potion);
  assert.deepEqual(pack, [potion], 'the bottle kept');
  for (const type of SAND_BARRED_EFFECTS) assert.equal(sandSpellRefusal({ effects: [{ type: 3 }, { type }] }), ARENA_TEXT.refuse.magic, `type ${type}`);
  assert.equal(sandSpellRefusal({ effects: [{ type: 3 }, { type: 10 }] }), null, 'fighting magic stands');
  assert.equal(sandSpellRefusal(null), null);
  const P = { activeEffects: [...SAND_BARRED_KINDS.map((kind) => ({ kind, roundsRemaining: 9 })), { kind: 'shield', roundsRemaining: 9 }] };
  assert.equal(stripSandBarred(P), SAND_BARRED_KINDS.length);
  assert.deepEqual(P.activeEffects.map((e) => e.kind), ['shield'], 'a Shield stays');
  assert.match(rd('src/scenes/hostMagic.js'), /why = spellRefusal\?\.\(sp\) \?\? sandSpellRefusal\(sp\);/, 'every host\'s one cast engine asks');
  const ab = rd('src/scenes/arenaBouts.js');
  assert.match(ab, /if \(boutLive\(C\.b\)\) stripSandBarred\(P\);/, 'the floor\'s frame takes them off');
  assert.match(ab, /if \(C\.you && P && kitBout\(C\) && boutLive\(C\.b\)\) stripSandBarred\(P\);/, 'and the relay\'s ladder\'s');
  assert.match(ab, /function kitBout\(C\) \{ return C\?\.relay \? C\.relay\.kind === 'pve' && !!C\.you : !!C\?\.ladder; \}/, 'a ladder or practice bout, or the relay\'s ladder I fight');
});

test('AUDIT ARENA-LADDER L6: A CEILING OVER THE SAND - my bout\'s ring holds the body under SAND_CEILING_M, its rise taken away; over any honest jump; a ring that names none (the duel\'s) is never touched in height (mutants: the ceiling unread; the rise kept; the ring naming none)', () => {
  const g = 20, top = (JUMP_SPEED * (1.5 + JUMP_SPELL_MULTIPLIER + ATHLETICISM_MULTIPLIER + IMPROVED_ATHLETICISM_MULTIPLIER)) ** 2 / (2 * g);
  assert.ok(SAND_CEILING_M > top, `over the highest honest jump (${top.toFixed(2)} m)`);
  const body = (y, velY) => ({ arena: null, pos: new Float32Array([0, y, 0]), velY, _airVelX: 0, _airVelZ: 0, _putBack: PlayerMotor.prototype._putBack });
  const up = body(12, 3);
  up.arena = { centre: [0, 5, 0], radius: 14, ceilAbove: SAND_CEILING_M };
  PlayerMotor.prototype._keepInArena.call(up);
  assert.equal(up.pos[1], 5 + SAND_CEILING_M, 'held under it');
  assert.equal(up.velY, 0, 'its rise taken away');
  const low = body(6, 3);
  low.arena = up.arena;
  PlayerMotor.prototype._keepInArena.call(low);
  assert.deepEqual([low.pos[1], low.velY], [6, 3], 'under it: untouched');
  const duel = body(12, 3);
  duel.arena = { centre: [0, 5, 0], radius: 14 };
  PlayerMotor.prototype._keepInArena.call(duel);
  assert.equal(duel.pos[1], 12, 'a duel\'s ring: height never touched');
  assert.match(rd('src/scenes/arenaBouts.js'), /radius: cur\.ring \?\? RING_R, \.\.\.\(kitBout\(cur\) \? \{ ceilAbove: SAND_CEILING_M \} : \{\}\) \}/, 'my ladder bout\'s ring names it');
});

// ── THE BOUT'S HOLES ─────────────────────────────────────────────────────────────────────────────────────

test('AUDIT ARENA-LADDER A1: the sand\'s collapse is the bout\'s fall - 1 health, a breath of fatigue, no death and no rest (mutants: the spare unread; the fatigue left at 0)', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /const sandSpare = opts\.playerSpare\?\.\(\) \?\? null;\s*if \(sandSpare\) \{ hurtEntity\(playerEntity, playerEntity\.health, \{ bypassShield: true, \.\.\.sandSpare \}\); playerEntity\.fatigue = Math\.max\(playerEntity\.fatigue \?\? 0, 1\); surfacePlayer\(\); return; \}/);
  const h = dc.indexOf('function onExhausted()');
  assert.ok(h > 0 && dc.indexOf('const sandSpare', h) < dc.indexOf('opts.csaOnPlayerDeath?.()', h) && dc.indexOf('const sandSpare', h) < dc.indexOf('advanceOwnMinutes(60)', h), 'asked before the death and the rest are acted on');
  // AUDIT ARENA-LADDER 2: in my bout before its fight (no spare yet) a breath, never an hour of rest in the Herald's call
  assert.match(dc, /   if \(foeDeps\?\.playerBoutOf\?\.\(\)\) \{ playerEntity\.fatigue = Math\.max\(playerEntity\.fatigue \?\? 0, 1\); surfacePlayer\(\); return; \}/);
});

test('AUDIT ARENA-LADDER A2: a fighter on the sand is its bout\'s - no dispel or Wabbajack takes it, and a body gone without falling voids my bout (healed, nothing won or lost) where it was a champion beaten (mutants: the dispel unfiltered; the Wabbajack unguarded; the gone body a fall; the import a comment)', () => {
  assert.equal(inBout({ entity: { bout: { id: 'x', side: 1 } } }), true);
  assert.equal(inBout({ entity: {} }), false);
  assert.equal(inBout(null), false);
  // the streaming host imports it; the dungeon's reaches it on the lazy foe subsystem (MT-iv: never static there)
  const w = rd('src/scenes/world.js'), dc = rd('src/scenes/dungeonContext.js'), ex = rd('src/scenes/exterior.js');
  assert.match(w, /dispelNearby\(list\.map\(\(no\) => no\.ref\)\.filter\(\(f\) => !inBout\(f\)\),/);
  assert.match(w, /^(?:(?!\/\/).)*import \{[^}\n]*inBout[^}\n]*\} from '\.\.\/characters\/enemyTargets\.js';/m, 'world.js: imported in code, not in a comment');
  assert.match(dc, /dispelNearby\(list\.map\(\(no\) => no\.ref\)\.filter\(\(f\) => !foeDeps\?\.inBout\?\.\(f\)\),/);
  assert.match(dc, /arrowAimDirection, bumpAtkCount, inBout, playerBoutOf \}\] = await Promise\.all\(\[/, 'the dungeon: taken off the lazy module');
  assert.match(dc, /resetAllyTeamOnPlayerAttack, boutGate, bumpAtkCount, inBout, playerBoutOf,/, '...and published on foeDeps');
  for (const [h, s] of [['world.js', w], ['exterior.js', ex]]) assert.match(s, /if \(inBout\(f\)\) return;   \/\/ AUDIT ARENA-LADDER A2: the Wabbajack/, h);
  assert.match(dc, /if \(foeDeps\?\.inBout\?\.\(f\)\) return;   \/\/ AUDIT ARENA-LADDER A2: the Wabbajack/);
  const ab = rd('src/scenes/arenaBouts.js');
  assert.match(ab, /if \(foe\.dead\) \{\s*if \(boutLive\(C\.b\) && !boutFighter\(C\.b, fid\)\?\.out\) \{ if \(!C\.ex && !boutFighter\(C\.b, YOU\)\?\.out\) \{ voidBout\(C\); return; \} boutFell\(C\.b, fid, t\); \}/);   // AUDIT ARENA-LADDER 2: never once I am out
  assert.match(ab, /function voidBout\(C\) \{\s*deps\.say\?\.\(ARENA_TEXT\.verdict\.void\);\s*if \(C\.ladder\) \{ deps\.heal\?\.\(\); refundMine\(C\); \}\s*dismiss\(\);/);
});

test('AUDIT ARENA-LADDER A3: the player\'s tag is the driver\'s own, held live - an `out` or a `hold` written as the bout runs is the gate\'s at once; a blow of mine after I am out is made good (mutants: a copy taken at the bell; the out-striker\'s blow counted)', () => {
  const tag = { id: 'b9', side: 0 };
  setPlayerBout(tag);
  assert.deepEqual(playerBoutOf(), { id: 'b9', side: 0, out: false });
  const foe = { entity: { bout: { id: 'b9', side: 1 } } };
  assert.notEqual(boutGate(foe, { isPlayer: true }, true), false, 'in the fight: a mark');
  tag.out = true;
  assert.equal(playerBoutOf().out, true, 'the driver\'s write, read live');
  assert.equal(boutGate(foe, { isPlayer: true }, true), false, 'out: no fighter\'s mark any more');
  tag.out = false; tag.hold = true;
  assert.equal(playerBoutOf().hold, true);
  assert.match(rd('src/scenes/arenaBouts.js'), /if \(boutFighter\(C\.b, from\)\?\.out\) \{ if \(foe\?\.entity\) foe\.entity\.health = Math\.min\(foe\.entity\.maxHealth \?\? foe\.entity\.health, foe\.entity\.health \+ dmg\); return; \}/);
});

test('AUDIT ARENA-LADDER A4: my damage is the striker\'s the formula named a moment ago, never the nearest fighter facing me; a fighter is taken off the stage it stood on (mutants: the told striker unread; the host\'s stage read)', () => {
  const ab = rd('src/scenes/arenaBouts.js');
  assert.match(ab, /if \(to === YOU\) C\.hitMe = \{ from, at: t \};/);
  assert.match(ab, /const told = C\.hitMe;\s*C\.hitMe = null;\s*if \(told && lawNow\(\) - told\.at <= RESOLUTION_MS && !boutFighter\(C\.b, told\.from\)\?\.out\) return told\.from;/);
  assert.equal((ab.match(/\(C\.stage \?\? stage\)\?\.remove\?\.\(foe\)/g) ?? []).length, 4, 'all four removals');
  assert.doesNotMatch(ab, /[^?)] stage\?\.remove\?\.\(foe\)/, 'no removal off the host\'s stage alone');
});

test('AUDIT ARENA-LADDER A5: no Recall off the sand - my bout holds me as its doors do (mutants: either host\'s refusal dropped)', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(h), /if \(arenaBouts\.holds\(\)\) \{ townTalk\.say\(ARENA_TEXT\.refuse\.travel\); return; \}/, h);
});

// ── ONLINE: the relay and the service ────────────────────────────────────────────────────────────────────

test('AUDIT ARENA-LADDER O1: the `in` word\'s ticket and the `atk` word\'s shape on the wire; the receipt signs `z` on a ladder bout alone (mutants: a ticket of any shape; a shape not one of the three; `z` on a players\' receipt)', async () => {
  assert.equal(ARENA_TICKET_RE.test('feedc0de00000001'), true);
  for (const z of ['FEEDC0DE00000001', 'feedc0de0000001', 'feedc0de000000011', 'zzzzzzzzzzzzzzzz']) assert.equal(validArenaIn({ k: 'in', r: 'f', tier: 0, bout: 0, z }), null, z);
  assert.deepEqual(validArenaIn({ k: 'in', r: 'f', tier: 0, bout: 0, z: 'feedc0de00000001' }), { k: 'in', r: 'f', tier: 0, bout: 0, z: 'feedc0de00000001' });
  const atk = { k: 'atk', i: 'a0', at: 5, x: 1, z: 2, tg: 'p0' };
  assert.deepEqual(validArenaOut({ ...atk, s: 'slam', yw: 1.2, ox: 3, oz: 4 }), { ...atk, s: 'slam', yw: 1.2, ox: 3, oz: 4 });
  assert.equal(validArenaOut({ ...atk, s: 'kick', yw: 1, ox: 3, oz: 4 }), null);
  assert.equal(validArenaOut({ ...atk, s: 'slam', ox: 3, oz: 4 }), null, 'a shape with no facing');
  assert.deepEqual(validArenaOut(atk), atk, 'a plain blow as it was');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const r = await mintArenaReceipt({ a: 'l', j: '00000000000000c1', s: 'acct-x', q: 0, u: 1, r: 0, h: 'fall', z: 'feedc0de00000001' }, kp.privateKey, { subtle, nowS: 1_800_000_000 });
  assert.equal(readArenaReceipt(r).z, 'feedc0de00000001', 'signed in');
  assert.equal(arenaReceiptValid({ a: 'l', j: '00000000000000c1', s: 'acct-x', q: 0, u: 1, r: 0, h: 'fall', z: 'nope', i: 1, e: 2 }), false);
  assert.equal(arenaReceiptValid({ a: 'p', j: '00000000000000c1', f: ['acct-a', 'acct-b'], r: 0, h: 'fall', z: 'feedc0de00000001', i: 1, e: 2 }), false, 'never on a players\' receipt');
  // the relay's own: a bout's receipt carries its fighter's ticket
  const { st } = relayLadder(0, 0);
  st.b.result = { side: 1, how: 'fall', winners: ['a0'], losers: ['p0'], judges: null };
  stepBout(st, 2_000_000, () => 0.9);
  assert.equal(st.owed[0].z, 'feedc0de00000009');
});

test('AUDIT ARENA-LADDER O1b: the relay opens a ladder bout only for a ticket - one without (an older build\'s) is told the bout is over, a word that build ends its bout on (mutants: the ticket unrequired)', async () => {
  const W = fakeRooms();
  const R = W.room(arenaBoutRoom('00000000000000ad'));
  const p = R.connect();
  const C = ARENA_FLOOR_CENTRE;
  await R.hello(p, 'fight-x', { x: C[0], y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Ceryn', kind: 'linked', tokenSub: 'acct-x', charLevel: 5 });
  await R.raw(p, JSON.stringify({ t: 'arena', k: 'in', r: 'f', tier: 0, bout: 0, lv: 5 }));
  const no = p.sent.filter((m) => m.t === 'arena' && m.k === 'no').at(-1);
  assert.equal(no?.m, 'no bout', 'AUDIT ARENA-LADDER 2: a word an older build ends its bout on');
  assert.equal(ARENA_NO_TEXT['no bout'], 'That bout is over.');
  assert.match(rd('src/scenes/arenaOnline.js'), /const over = w\.k === 'no' && \(w\.m === 'no bout' \|\|/, 'and every build ends its bout on it');
  assert.equal(await R.room._boutOf?.() ?? null, null, 'no bout opened');
});

const T0 = Math.floor(Date.now() / 1000);
let _j = 0;
const jid = () => (0xc000 + ++_j).toString(16).padStart(16, '0');
const ticketReceipt = (S, who, tier, step, won, z, h = 'fall', j = jid(), nowS = T0) => mintArenaReceipt({ a: 'l', j, s: who.id, q: tier, u: step, r: won ? 1 : 0, h, z }, S.gatePriv, { subtle, nowS });
/** AUDIT ARENA-LADDER 2: an attempt asked for a room of its own (the bout's id - the receipt's `j`). */
const attempt = (S, who, tier, bout, room = jid()) => S.call('/v1/arena/attempt', { tier, bout, room }, who.secret);
/** A claim - with the fighting character named when `who.fighting` (a won bout's Renown is that character's). */
const claim = (S, who, receipt) => S.call('/v1/arena/claim', { receipt, ...(who.fighting ? { character: who.character, name: who.handle } : {}) }, who.secret);
/** Fight and claim the account's next bout - an attempt, its receipt carried. */
async function fight(S, who, won, h = 'fall') {
  const board = await S.call('/v1/arena/board', {}, who.secret);
  const L = board.body.me.ladder;
  const next = L.tier * 4 + (L.champs?.[L.tier] ? 4 : L.won);
  const tier = Math.floor(next / 4), bout = L.won;
  const a = await attempt(S, who, tier, bout);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  return claim(S, who, await ticketReceipt(S, who, tier, bout, won, a.body.ticket, h, a.body.room));
}

test('AUDIT ARENA-LADDER O2: THE SERVICE\'S ATTEMPTS - a ticket for the account\'s next bout alone; a loss claimed breaks the tier\'s run; an attempt left open is FORFEIT at the next (a loss, its run broken), and its win carried after is refused; another account\'s ticket takes nothing (mutants: the order unchecked; the run kept; the forfeit unwritten; the ticket\'s owner unread)', async () => {
  const S = await standService();
  const A = await S.registered('Ilsa'), B = await S.registered('Orrin');
  assert.equal((await attempt(S, A, 0, 1)).status, 409, 'not my next bout');
  assert.equal((await attempt(S, A, 0, 1)).body.error, 'order');
  assert.equal((await fight(S, A, true)).body.recorded, true);
  assert.equal((await fight(S, A, true)).body.recorded, true);
  let me = (await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder;
  assert.deepEqual([me.tier, me.won], [0, 2]);
  // a loss claimed: the run broken
  const lost = await fight(S, A, false);
  assert.equal(lost.body.recorded, true);
  me = (await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder;
  assert.deepEqual([me.tier, me.won], [0, 0], 'back to the first bout');
  // two won again, then an attempt never claimed: forfeit at the next ask
  await fight(S, A, true); await fight(S, A, true);
  const open = await attempt(S, A, 0, 2);
  assert.equal(open.status, 200);
  const next = await attempt(S, A, 0, 0);
  assert.equal(next.status, 200, 'the forfeit broke the run: the first bout is next');
  assert.equal(next.body.forfeits, 1);
  const late = await claim(S, A, await ticketReceipt(S, A, 0, 2, true, open.body.ticket, 'fall', open.body.room));
  assert.deepEqual([late.body.recorded, late.body.why], [false, 'forfeit'], 'its win carried after: refused');
  // another account's ticket
  const mine = await attempt(S, B, 0, 0);
  const stolen = await claim(S, A, await ticketReceipt(S, A, 0, 0, true, mine.body.ticket, 'fall', mine.body.room));
  assert.deepEqual([stolen.body.recorded, stolen.body.why], [false, 'reused']);
  // the record keeps every bout: two losses (one forfeit), four wins out of the climb's two... and the board's reach
  const r = S.env?.DB?._raw ?? null;
  if (r) {
    const rows = r.prepare('SELECT won, voided, how FROM arena_pve WHERE player = ? ORDER BY at, rowid').all(A.id);
    assert.equal(rows.filter((x) => x.won === 0).length, 2);
    assert.ok(rows.some((x) => x.how === 'forfeit'));
    assert.equal(rows.filter((x) => x.won === 1 && x.voided === 1).length, 4, 'the broken runs\' wins kept, out of the climb');
  }
});

test('AUDIT ARENA-LADDER O3: a champion beaten stays beaten - a loss in the next tier breaks that tier\'s run alone (mutants: the champion\'s step voided)', async () => {
  const S = await standService();
  const A = await S.registered('Wenna');
  for (let i = 0; i < 4; i++) assert.equal((await fight(S, A, true)).body.recorded, true);
  let me = (await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder;
  assert.deepEqual([me.tier, me.won, me.champs[0]], [1, 0, true]);
  await fight(S, A, true);
  await fight(S, A, false, 'judges');
  me = (await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder;
  assert.deepEqual([me.tier, me.won, me.champs[0]], [1, 0, true], 'the Pit\'s title kept');
  assert.equal(ladderKey(1, 0), 4);
});

test('AUDIT ARENA-LADDER O3b: the whole climb on tickets - forty attempts, the Grand Champion said on its claim (mutants: the ticketed claim\'s grand unsaid)', async () => {
  const S = await standService();
  const A = await S.registered('Brisa');
  let last = null;
  for (let i = 0; i < 40; i++) { last = await fight(S, A, true); assert.equal(last.body.recorded, true, `step ${i}`); }
  assert.equal(last.body.grand, true, 'the Grand Champion');
  assert.equal((await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder.grand, true);
  assert.equal((await attempt(S, A, 9, 3)).status, 409, 'nothing past the summit');
});

test('AUDIT ARENA-LADDER O4: THE LAUREL TAKES TEN RATED BOUTS AGAINST FIVE ACCOUNTS, and a pair\'s rated bouts are capped a season (mutants: the foes unread; the old three bouts; the season cap off)', () => {
  assert.deepEqual([ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES, ARENA_PAIR_SEASON_MAX], [10, 5, 10]);
  assert.ok(ARENA_PAIR_SEASON_MAX >= ARENA_PAIR_DAY_MAX);
  assert.equal(laurelWorthy({ bouts: 10, foes: 5 }), true);
  assert.equal(laurelWorthy({ bouts: 30, foes: 4 }), false, 'thirty bouts against four second accounts');
  assert.equal(laurelWorthy({ bouts: 9, foes: 9 }), false);
  assert.equal(laurelOfBoard([{ player: 'a', bouts: 3, foes: 1 }, { player: 'b', bouts: 20, foes: 8 }]), null, 'the #1 short of it holds the top, and nobody wears the laurel over them');
  assert.equal(laurelOfBoard([{ player: 'b', bouts: 20, foes: 8 }]), 'b');
  assert.match(rd('server-account/src/arena.js'), /const rated = Number\(pair\?\.n \?\? 0\) < ARENA_PAIR_DAY_MAX && Number\(pairSeason\?\.n \?\? 0\) < ARENA_PAIR_SEASON_MAX;/);
});

/** The online arena's client over stubs: `attempt` answers as `attemptAnswer(tier, bout, room)` does (the real
 *  accountClient's shapes), `enterFloor` as `entering` does; the calls kept in `order`. */
function onlineClient({ attemptAnswer, entering = () => true, guest = false } = {}) {
  const order = [], said = [], boutSent = [], entered = [];
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: (w) => { boutSent.push(w); return true; } };
  const board = { me: { ladder: arenaLadderOf([]) } };
  const A = createArenaOnline({
    now: () => 0, session: () => session, say: (l) => said.push(l), guest: () => guest, makeHall: () => ({ status: 'open', join() {}, leave() {}, sendArena: () => true }),
    bouts: { ask() {}, relayWord: () => true, dismiss() {}, holds: () => false, relay: () => null },
    account: { board: async () => { order.push('board'); return { ok: true, data: board }; }, claim: async () => { order.push('claim'); return { ok: true, data: {} }; },
      attempt: async (tier, bout, room) => { order.push(['attempt', tier, bout, room]); return attemptAnswer(tier, bout, room); }, me: () => null },
    enterFloor: async (k, o) => { order.push('enter'); entered.push([k, o]); return entering(); }, level: () => 4, maxHealth: () => 60,
  });
  return { A, order, said, boutSent, entered, session };
}
const settle = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

test('AUDIT ARENA-LADDER O5: the client asks its ticket once the floor is entered, for the room it fights in - every receipt answered first, the `in` waiting for it; no ticket and the bout is let go, said (mutants: the ticket asked before the floor; the room unsent; the `in` sent without the ticket; the failure silent)', async () => {
  const c = onlineClient({ attemptAnswer: (tier, bout, room) => ({ ok: true, data: { ticket: 'feedc0de0000000a', tier, bout, room } }) });
  c.A.model();
  await settle();
  assert.equal(c.A.fightLadder().ok, true);
  c.session.room = arenaBoutRoom(c.entered.at(-1)[1]);
  c.A.tick();
  assert.equal(c.boutSent.length, 0, 'the `in` waits for its ticket');
  await settle();
  c.A.tick();
  assert.equal(c.boutSent.at(-1)?.z, 'feedc0de0000000a');
  assert.match(rd('src/scenes/arenaOnline.js'), /try \{ await claims\.flush\(\); await claims\.idle\?\.\(\); \} catch \{[^}]*\}\s*if \(bout !== b\) return;\s*if \(claims\.ladderKept/, 'every receipt carried and answered before the ask');
  const ask = c.order.find((x) => Array.isArray(x) && x[0] === 'attempt');
  assert.ok(c.order.indexOf('enter') < c.order.indexOf(ask), 'asked once the floor is entered');
  assert.equal(ask[3], c.entered.at(-1)[1], 'for the room it is fought in');
  // a refusal: said, let go
  const d = onlineClient({ attemptAnswer: () => ({ ok: false, error: 'busy' }) });
  d.A.model();
  await settle();
  assert.equal(d.A.fightLadder().ok, true);
  await settle();
  assert.ok(d.said.includes(ARENA_TEXT.online.ticketFail), 'said');
  d.A.tick();
  assert.equal(d.boutSent.length, 0, 'and let go: no `in`');
});

// ── AUDIT ARENA-LADDER 2: the audit of the audit ─────────────────────────────────────────────────────────

test('AUDIT ARENA-LADDER 2 S1: A LATE LOSS NEVER BRICKS A CLIMB - a loss of a tier carried after its champion fell breaks no run there; the climb goes on (mutants: the champion guard dropped)', async () => {
  const S = await standService();
  const A = await S.registered('Teodor');
  for (let i = 0; i < 3; i++) await fight(S, A, true);
  // the champion lost on a relay before tickets (a receipt kept on another device), then beaten
  const lost = await mintArenaReceipt({ a: 'l', j: jid(), s: A.id, q: 0, u: 3, r: 0, h: 'fall' }, S.gatePriv, { subtle, nowS: T0 });
  assert.equal((await fight(S, A, true)).body.recorded, true, 'the champion beaten');
  assert.equal((await claim(S, A, lost)).body.recorded, true, 'the old loss carried after');
  const me = (await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder;
  assert.deepEqual([me.tier, me.won, me.champs[0]], [1, 0, true], 'nothing of the Pit voided under its champion');
  assert.equal((await fight(S, A, true)).body.recorded, true, 'and the next tier\'s first bout counts');
});

test('AUDIT ARENA-LADDER 2 S2: ONE TICKET, ONE BOUT - a receipt of another room, or signed past the ticket\'s life, keeps nothing; a room is ticketed once; an attempt already done records nothing more (mutants: the room unread; the life unread; the room twice; done unread)', async () => {
  assert.equal(ARENA_ATTEMPT_LIFE_S * 1000, ARENA_KEEP_MS, 'the life is the relay\'s keep of a finished bout');
  const S = await standService();
  const A = await S.registered('Hesta');
  const a = await attempt(S, A, 0, 0);
  const elsewhere = await claim(S, A, await ticketReceipt(S, A, 0, 0, true, a.body.ticket, 'fall', jid()));
  assert.deepEqual([elsewhere.body.recorded, elsewhere.body.why], [false, 'reused'], 'fought in another room on it');
  const raw = S.env?.DB?._raw;
  const at0 = raw.prepare('SELECT at FROM arena_attempts WHERE id = ?').get(a.body.ticket).at;
  raw.prepare('UPDATE arena_attempts SET at = ? WHERE id = ?').run(T0 - ARENA_ATTEMPT_LIFE_S - 60, a.body.ticket);
  const late = await claim(S, A, await ticketReceipt(S, A, 0, 0, true, a.body.ticket, 'fall', a.body.room));
  raw.prepare('UPDATE arena_attempts SET at = ? WHERE id = ?').run(at0, a.body.ticket);
  assert.deepEqual([late.body.recorded, late.body.why], [false, 'reused'], 'its room again, a keep later');
  assert.equal((await claim(S, A, await ticketReceipt(S, A, 0, 0, true, a.body.ticket, 'fall', a.body.room))).body.recorded, true, 'its own bout counts');
  const twice = await attempt(S, A, 0, 1, a.body.room);
  assert.deepEqual([twice.status, twice.body.error], [503, 'busy'], 'a room is ticketed once');
  // an out-of-order win done, carried again: nothing
  const b = await attempt(S, A, 0, 1);
  raw.prepare('UPDATE arena_attempts SET done = 1 WHERE id = ?').run(b.body.ticket);
  const again = await claim(S, A, await ticketReceipt(S, A, 0, 1, true, b.body.ticket, 'fall', b.body.room));
  assert.deepEqual([again.body.recorded, again.body.why], [false, 'order'], 'an attempt done records nothing more');
});

test('AUDIT ARENA-LADDER 2 S3: A STEP WON AGAIN PAYS NOTHING - no banner points, no Renown, and the ladder the board answers says so before the bout (`paid`); a guest is refused the ladder online; done attempts of a week ago let go (mutants: the repeat unread; its Renown paid; paid unsaid; a guest\'s attempt minted; nothing pruned)', async () => {
  const S = await standService();
  const A = await S.registered('Rudd', { renown: 10 });
  A.fighting = true;
  await S.call('/v1/arena/team', { banner: 'red' }, A.secret);
  const first = await fight(S, A, true);
  assert.equal(first.body.recorded, true);
  assert.ok(first.body.banner === 'red' && first.body.points > 0 && !first.body.repeat, 'the first win of a step pays');
  assert.ok(first.body.renown, 'its Renown too');
  await fight(S, A, false);
  const me = (await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder;
  assert.deepEqual([me.won, me.paid], [0, 1], 'the board tells the step was won before');
  assert.equal(nextLadderBout(me).repeat, true);
  assert.equal(nextLadderBout(me).purse, 0, 'so the client holds no purse for it');
  const again = await fight(S, A, true);
  assert.equal(again.body.recorded, true, 'the climb moves');
  assert.equal(again.body.repeat, true);
  assert.deepEqual([again.body.points, again.body.banner, again.body.renown ?? null], [0, null, null], 'no points, no banner, no Renown');
  const next = await fight(S, A, true);
  assert.ok(!next.body.repeat && next.body.points > 0, 'a step never won before pays again');
  // a guest
  const G = await S.guest();
  const g = await S.call('/v1/arena/attempt', { tier: 0, bout: 0, room: jid() }, G.secret);
  assert.deepEqual([g.status, g.body.error], [403, 'ladder-needs-account']);
  // the done attempts of a week ago
  const raw = S.env?.DB?._raw;
  raw.prepare('UPDATE arena_attempts SET at = at - ? WHERE player = ? AND done = 1').run(ARENA_ATTEMPTS_KEEP_S + 60, A.id);
  const before = raw.prepare('SELECT COUNT(*) AS n FROM arena_attempts WHERE player = ?').get(A.id).n;
  await attempt(S, A, 0, 2);
  const after = raw.prepare('SELECT COUNT(*) AS n FROM arena_attempts WHERE player = ?').get(A.id).n;
  assert.ok(before >= 4 && after === 1, `pruned (${before} -> ${after})`);
});

test('AUDIT ARENA-LADDER 2 S4: the client - a guest is told the ladder takes a registered account; a floor not entered asks no ticket; a 409 asks the board again and says why; a ticketed receipt still kept asks nothing (mutants: the guest asked; the ticket before the floor; the board not asked; the kept receipt unread)', async () => {
  const g = onlineClient({ guest: true, attemptAnswer: () => ({ ok: true, data: { ticket: 'feedc0de0000000b' } }) });
  g.A.model();
  await settle();
  assert.deepEqual(g.A.fightLadder(), { ok: false, text: ARENA_TEXT.online.guestLadder });
  // a floor that loads slowly and fails: no ticket was asked meanwhile
  const f = onlineClient({ entering: () => new Promise((r) => setTimeout(() => r(false), 40)), attemptAnswer: () => ({ ok: true, data: { ticket: 'feedc0de0000000c' } }) });
  f.A.model();
  await settle();
  f.A.fightLadder();
  await new Promise((r) => setTimeout(r, 80));
  await settle();
  assert.ok(!f.order.some((x) => Array.isArray(x) && x[0] === 'attempt'), 'no floor, no ticket - nothing forfeit');
  const o = onlineClient({ attemptAnswer: () => ({ ok: false, error: 'order' }) });
  o.A.model();
  await settle();
  const boards = o.order.filter((x) => x === 'board').length;
  o.A.fightLadder();
  await settle(6);
  assert.ok(o.order.filter((x) => x === 'board').length > boards, 'the board asked again');
  assert.ok(o.said.some((l) => /not your next ladder bout/i.test(l)), 'and the service\'s reason said');
  assert.match(rd('src/scenes/arenaOnline.js'), /if \(claims\.ladderKept\?\.\(\)\) \{ say\(O\.stillRecording\); endBout\(\); return; \}/);
  // the queue: a flush asked mid-flight waits for it, and a kept ticketed ladder receipt is told
  let release; const gate = new Promise((r) => { release = r; });
  const calls = [];
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const rc = await mintArenaReceipt({ a: 'l', j: '00000000000000d1', s: 'acct-q', q: 0, u: 0, r: 1, h: 'fall', z: 'feedc0de000000d1' }, kp.privateKey, { subtle, nowS: Math.floor(Date.now() / 1000) });
  const Q = createArenaClaims({ claim: async (r) => { calls.push(r); await gate; return { ok: false, error: 'offline' }; }, me: () => 'acct-q' });
  Q.add(rc);
  const second = Q.flush();
  let done = false; void second.then(() => { done = true; });
  await settle();
  assert.equal(done, false, 'a flush asked mid-flight is the running one\'s answer - not a quiet 0 at once');
  assert.equal(Q.ladderKept(), true, 'a ticketed ladder receipt of mine still kept');
  release();
  await Q.idle();
  assert.ok(calls.length >= 2, 'and the one asked behind it ran too');
});

test('AUDIT ARENA-LADDER 2 B1: the kit law\'s holes - every fighter is pacify-immune (a Calm through a weapon refused too), an elite fighter never flees as a revenant, a held ring\'s stripped effect comes back after the bout (mutants: the immunity unset; the revenant gate dropped; the held effect unmarked)', () => {
  assert.match(rd('src/scenes/arenaBouts.js'), /foe\.entity\.bout = tags\.get\(f\.id\); foe\.entity\.items = \[\]; foe\.entity\.pacifyImmune = true; \}/);
  assert.match(rd('src/systems/effects.js'), /if \(target\.pacifyImmune\) \{ out\.swayRefused = /, 'the one sway door refuses an immune target, whatever cast it');
  const elite = { level: 12, eliteFoe: true, mobileType: M.Barbarian };
  assert.equal(revenantCandidate(elite), true, 'an elite in the street may come back');
  assert.equal(revenantCandidate({ ...elite, bout: { id: 'b', side: 1 } }), false, 'never one on the sand');
  const ring = { name: 'Ring' };
  const P = { activeEffects: [{ kind: 'chameleonNormal', roundsRemaining: 9, heldItem: ring }] };
  assert.equal(stripSandBarred(P), 1);
  assert.equal(P._sandHeld, true, 'a held item\'s effect marked');
  assert.equal(restoreSandHeld(P), true, 'restarted at the bout\'s end');
  assert.equal(P._sandHeld, undefined);
  assert.equal(restoreSandHeld(P), false, 'once');
  const ab = rd('src/scenes/arenaBouts.js');
  assert.equal((ab.match(/restoreSandHeld\(P\)/g) ?? []).length, 3, 'the healers (both) and a bout let go');
});

test('AUDIT ARENA-LADDER 2 B2: A BOUT WON AGAIN AFTER A LOST RUN PAYS NO PURSE AND NO POINTS - offline as online; a bout never won before pays; a new tier starts unpaid (mutants: paid unkept; the repeat purse paid; the points paid)', () => {
  let L = arenaLadderRestore(null);
  L = ladderAfter(L, { won: true }).ladder;
  L = ladderAfter(L, { won: true }).ladder;
  L = ladderAfter(L, { won: false }).ladder;
  assert.deepEqual([L.won, L.paid], [0, 2]);
  const n = nextLadderBout(L);
  assert.deepEqual([n.repeat, n.purse], [true, 0]);
  assert.equal(boutPoints({ won: true, repeat: true }), 0);
  assert.ok(boutPoints({ won: true }) > 0);
  L = ladderAfter(ladderAfter(L, { won: true }).ladder, { won: true }).ladder;
  const third = nextLadderBout(L);
  assert.deepEqual([third.bout, third.repeat, third.purse], [2, false, BOUT_PURSE[0]], 'the bout never won pays');
  L = ladderAfter(ladderAfter(L, { won: true }).ladder, { won: true }).ladder;
  assert.deepEqual([L.tier, L.won, L.paid], [1, 0, 0], 'a new tier unpaid');
  assert.equal(arenaLadderRestore({ tier: 0, won: 2 }).paid, 2, 'a save before it: what is won was paid');
  assert.equal(arenaLadderSnapshot(L).paid, 0);
  const ab = rd('src/scenes/arenaBouts.js');
  assert.match(ab, /: C\.next\.repeat \? ARENA_TEXT\.purse\.repeat :/);
  assert.match(ab, /purse, repeat: !!C\.next\.repeat, champion:/);
  assert.match(rd('src/scenes/arenaOnline.js'), /if \(d\?\.recorded === true\) won = d\.won === true && d\.repeat !== true;/);
});

test('AUDIT ARENA-LADDER 2 R1: the relay - one telegraph on the sand at a time (a pair of elite champions never lands two at once); fighters level on the card are a draw (mutants: the one-at-a-time gate dropped; the first fighter\'s card)', () => {
  const { st, t, C } = relayLadder(4, 3);   // two elite Warriors
  for (const a of st.ai) { a.pos = [C[0], C[2] + 1.6]; a.mv = null; }
  const words = stepBout(st, t, () => 0);
  const tele = words.filter((w) => w.k === 'atk' && w.s);
  assert.equal(tele.length, 1, 'one wind-up');
  assert.equal(words.filter((w) => w.k === 'atk').length, 2, 'the other swings plainly');
  // the card: the player short of the floor, two fighters level - a draw
  const b = newBout({ id: 'j', kind: 'ladder', fighters: [{ id: 'p', name: 'Me', side: 0, maxHealth: 100, ai: false }, { id: 'a', name: 'A', side: 1, maxHealth: 100, ai: true }, { id: 'c', name: 'C', side: 2, maxHealth: 100, ai: true }], ring: { centre: [0, 0], radius: 14 }, now: 0, judgesFloor: LADDER_JUDGES_SHARE });
  boutTick(b, callMs(b));
  for (const f of b.fighters) boutAtMarks(b, f.id, callMs(b));
  const t0 = callMs(b) + COUNT_MS;
  boutTick(b, t0);
  boutHit(b, { from: 'p', to: 'a', dmg: 10, now: t0 + 1 });
  boutTick(b, t0 + BOUT_LIMIT_MS);
  assert.deepEqual([b.result.how, b.result.side], ['judges', null], 'a draw - never the first fighter\'s');
});

test('AUDIT ARENA-LADDER 2 R2: a relay\'s telegraph on this screen - its mark lands at the relay\'s moment (`at` on this clock), the fighter swings at the landing, not the word; a plain blow swings at once; a ladder champion stands elite (mutants: the clock unread; the swing at the word; the elite unsent)', async () => {
  let TT = 100, now = 5000;
  setTacticsClock(() => TT);
  const spawned = [];
  const c = [ARENA_FLOOR_CENTRE[0], ARENA_FLOOR_CENTRE[1], ARENA_FLOOR_CENTRE[2]];
  const stage = { kind: 'floor', centre: () => c, remove: () => {}, heightAt: () => null,
    spawn: async (mobile, feet, o) => { const foe = { mobile, o, entity: { health: 20, maxHealth: 20 }, ai: { feet: [...feet], yaw: o.yaw ?? 0, isHostile: true }, attack: { swingSeq: 0 } }; spawned.push(foe); return foe; } };
  const D = createArenaBouts({ now: () => now, playerEntity: { name: 'Alva', health: 80, maxHealth: 80 }, say() {}, notice() {}, drawHud() {}, heal() {}, pay() {} });
  D.setStage(stage);
  const O = '0123456789abcdef';
  D.startRelay({ o: O, kind: 'pve', me: 'p0', next: { tier: 0, bout: 3, purse: 50, champion: true, grand: false }, names: (i) => ({ name: `R${i}`, home: 'W', epithet: '' }), send: { hit: () => true, yield: () => true }, myHealth() {} });
  D.relayWord({ k: 'mv', i: 'a0', x: c[0] + 2, z: c[2], tx: c[0] + 2, tz: c[2], v: 0, at: 5000 });
  D.relayWord({ k: 'st', o: O, kind: 'pve', ph: 'call', pa: 5000, fa: null, lim: 180000, tier: 0, bout: 3, f: [['p0', 'Alva', 0, 90, 90, '', 0, -1, 0, '', ''], ['a0', '-', 1, 26, 26, '', 1, 136, 50, '', '']], me: 'p0', sp: 2 });
  await settle();
  const foe = spawned[0];
  assert.equal(foe.o.elite, true, 'the champion stands elite');
  D.relayWord({ k: 'ev', e: [{ k: 'fight', at: 9000 }] });
  now = 6000;   // the relay's 10000 (its fight at 9000 heard at my 5000)
  D.relayWord({ k: 'atk', i: 'a0', at: 10_500, x: c[0], z: c[2], tg: 'p0', s: 'lunge', yw: -1.57, ox: c[0] + 2, oz: c[2] });
  const b = liveBlows().get(foe.ai);
  assert.ok(b, 'the mark drawn');
  assert.ok(Math.abs((b.land - TT) - 0.5) < 1e-6, `landing at the relay's moment, 0.5 s on (${(b.land - TT).toFixed(3)})`);
  assert.notEqual(foe._pup.strike, 'melee', 'no swing at the word');
  now = 6400; D.frame(0.4, {});
  assert.notEqual(foe._pup.strike, 'melee', 'nor before the landing');
  now = 6500; D.frame(0.1, {});
  assert.equal(foe._pup.strike, 'melee', 'the swing at the landing');
  foe._pup.strike = null;
  D.relayWord({ k: 'atk', i: 'a0', at: 11_000, x: c[0], z: c[2], tg: 'p0' });
  assert.equal(foe._pup.strike, 'melee', 'a plain blow swings at once');
  setTacticsClock(() => T);
});

test('AUDIT ARENA-LADDER 2 T1: A LANDED VERDICT IS ITS MARK\'S ALONE - a fighter whose target changed between the landing and its damage frame swings classically, unweighed (mutants: the mark unread at the resolution)', () => {
  noteLocalPlayer([40, 0, 40], [0, 0, 1]);
  const a = fighter({ feet: [0, 0, 0], side: 0 }), b = fighter({ feet: [0, 0, 1.6], side: 1 });
  const s = windUp(a, b);
  T = s.blow.land + 0.01;
  tacticsStep(a.ai, 0, 1.6);
  assert.equal(a.ai._blowVerdict, true);
  a.ai._armedTargeting = false;   // the motor turns on the player at once - the brain only at its next tick
  assert.equal(blowConnects(a.ai, false, T), false, 'the classic answer for the player, never the bout-mate\'s verdict');
  assert.equal(blowScaled(a.ai, 10), 10, 'and no weight');
});
