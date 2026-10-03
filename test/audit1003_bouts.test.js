// AUDIT PRE-MERGE 1003 (2026-10-03, PR 545 read before it merges) - lens B, the offline bout engine and the arena's
// economy: the law's clock held while the world is (B1); a stranger's blow on an exhibition fighter kept nothing (B2);
// the book on a bout walked away from, the Herald's Watch and an hour already seen (B3); no price shorter than the
// bookmaker's shortest rung (B4); my 1 HP spare held from the word to the healers (B5); a crowd half-built when its bout
// went (B6). The record: bible/01-Overview/Audit-PreMerge-1003.md; the design, bible/11-Multiplayer/Arena.md.
//
// Each test failed on the unfixed tree for its finding's reason: 200 s under an open window and the Grand Champion bout
// was the judges' at the 3-minute mark, 9,900 paid (B1); my one blow for the favourite's whole health felled it and the
// verdict was told (B2); a wager on a fighter seen losing, walked away from, stood open for the house's coin - and the
// Herald still offered Watch, the book still took a wager on an hour seen to its verdict (B3); 1 to 5 laid on a 0.85
// favourite, 1.02 back for every 1 staked (B4); an arrow after my yield at 12 HP took me to 0 (B5); three billboard
// batches made and never destroyed (B6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createArenaBouts, YOU } from '../src/scenes/arenaBouts.js';
import { createArenaGate } from '../src/scenes/arenaGate.js';
import { newArenaLadder, nextLadderBout, exhibitionFor } from '../src/systems/arenaLadder.js';
import { boutFighter, STALL_MS, BOUT_LIMIT_MS, END_HOLD_MS } from '../src/systems/arenaBout.js';
import * as BK from '../src/systems/arenaBook.js';
import * as LG from '../src/systems/arenaLeague.js';
import { fighterIdentity } from '../src/systems/arenaFighters.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));
const START = 523530;
/** Noon of day `d` from the new game's day (an hour whose exhibition is open at its minute 0). */
const noon = (d = 1) => START - (START % MINUTES_PER_DAY) + d * MINUTES_PER_DAY + 12 * 60;

/** test/arena2_driver.test.js's rig (the fake stage, the driver's doors logged), with the exhibition's verdict told, the
 *  gate wired as both hosts wire it (scenes/world.js, scenes/exterior.js: the verdict seen settles the book, `liveHour`
 *  the driver's hour, `begun` the host's arenaBoutBegun) and a frame's `dt` of the test's own choosing. */
function rig({ kind = 'floor', foeHealth = 60, player = {}, gm = noon(2), extra = {} } = {}) {
  let t = 1000;
  const log = { say: [], notice: [], pay: [], heal: 0, crime: 0, hud: [], bouts: [], cues: [], removed: [], verdicts: [], acts: [], shown: [] };
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), goldPieces: 5000, items: [], arenaLeague: null, ...player };
  const foes = [];
  const stage = {
    kind, centre: () => [50, 0, 40],
    spawn: async (mobile, feet, o) => { const f = { mobile, o, entity: { health: foeHealth, maxHealth: foeHealth, bout: o.bout, items: [{ name: 'loot' }] }, ai: { feet: [...feet], target: null, isHostile: true } }; foes.push(f); return f; },
    remove: (f) => log.removed.push(f),
    heightAt: () => null,
  };
  let gate = null;
  const A = createArenaBouts({
    now: () => t, rng: () => 0.99, playerEntity: P, setPlayerBout: (b) => log.bouts.push(b),
    say: (l) => log.say.push(l), notice: (ls) => log.notice.push(...ls), pay: (g) => log.pay.push(g), heal: () => { log.heal++; P.health = P.maxHealth; },
    crime: () => log.crime++, drawHud: (m) => log.hud.push(m), sound: { cue: (l) => log.cues.push(...l.map((c) => c.s)), bed: () => {}, stop: () => {} },
    gameMinutes: () => gm,
    exhibitionVerdict: (hour, side) => { log.verdicts.push([hour, side]); gate.verdictSeen(hour, side); },
    ...extra,
  });
  const begun = () => { const b = A.bout(); return A.hour() != null && !!b && !['call', 'walk', 'count'].includes(b.phase); };
  gate = createArenaGate({
    playerEntity: P, gameMinutes: () => gm, showOverlay: (w) => log.shown.push(w), say: (l) => log.say.push(l), openWindow: null,
    liveHour: () => A.hour(), begun, heraldAct: (a) => log.acts.push(a), atGate: () => true, onSand: () => A.onSand(),
  });
  const step = (ms, o = {}, dt = ms / 1000) => { t += ms; A.frame(dt, { playerFeet: [44, 0, 40], sheathed: false, ...o }); };
  return { A, P, foes, stage, log, step, gate, gm, ex: exhibitionFor(gm), now: () => t };
}
/** Run the clock until the fight (the call's beats, the marks, the count). */
const toFight = (r) => { for (let i = 0; i < 200 && r.A.bout()?.phase !== 'fight'; i++) r.step(100); };
/** A blow on a bout fighter IN THE DOOR'S OWN ORDER (scenes/exteriorFoes.js damageFoe, scenes/dungeonContext.js's twin):
 *  my blow on a fighter not my opponent first tells the bout of an intruder (handleAttackFromPlayer -> `intrude`), the
 *  health is taken, the blow is told (`hurt`), and then the floor is read (`floor`, held at 1). (In my own live bout the
 *  door's boutGate passes my blow without `intrude`; told it anyway, the hook says nothing then.) test/arena2_driver's
 *  `strike` reads the floor BEFORE the hurt hook - the door does not. */
function door(f, d, { fromPlayer = false, striker = null } = {}) {
  const bout = f.entity.bout;
  if (fromPlayer) bout.hooks.intrude?.(f);
  f.entity.health -= d;
  if (d > 0) bout.hooks.hurt?.(f, d, { fromPlayer, striker });
  if (f.entity.health <= 0) { f.entity.health = 1; if (!bout.out) { bout.out = true; bout.hooks.floor?.(f, { fromPlayer, striker }); } }
}
const ladderRig = async (ladder, o = {}) => {
  const r = rig({ player: { arenaLadder: ladder }, ...o });
  r.A.setStage(r.stage);
  r.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(r.P.arenaLadder) });
  await settle();
  return r;
};
const cityRig = async (o = {}) => {
  const r = rig({ kind: 'city', ...o });
  r.A.setStage(r.stage);
  r.A.ask({ where: 'city', kind: 'exhibition', ex: r.ex });
  await settle();
  return r;
};

// ── B1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 1003 B1: the law\'s clock is the world\'s - 200 s under an open window and the Grand Champion bout stands, its clock unmoved, nothing judged or paid; a hidden tab is one clamped frame; the limit comes after 180 s of play from the word', async () => {
  const r = await ladderRig({ tier: 9, won: 3 });   // the Grand Champion's bout: 10,000 gold
  toFight(r);
  assert.equal(r.A.bout().phase, 'fight');
  let played = 0;   // ms of the world's play since the frame that gave the word
  door(r.foes[0], 1, { fromPlayer: true }); r.step(16); played += 16;   // one blow of mine: the judges' card is mine
  const timer = r.log.hud.at(-1).timer;
  // the inventory open: the hosts hand the bout `gamePaused() ? 0 : dt` (scenes/world.js, scenes/exterior.js arenaFrame),
  // and the floor's foes stand frozen (scenes/worldModes.js returns before drawFoes under a window)
  for (let i = 0; i < 12_500; i++) r.step(16, { hidden: true }, 0);
  assert.equal(r.A.bout().phase, 'fight', '200 s paused: still the fight');
  assert.equal(r.A.bout().result, null, 'no timeout, no judges');
  assert.equal(r.log.hud.at(-1).timer, timer, 'the bout\'s clock unmoved');
  assert.equal(r.A.bout().stallSaid, false, 'no stall said for a pause');
  assert.deepEqual(r.log.pay, [], 'nothing paid');
  // a hidden tab: one frame three minutes after the last, the hosts' dt clamped to 0.1 s
  r.step(180_000, {}, 0.1); played += 100;
  assert.equal(r.A.bout().phase, 'fight', 'a hidden tab is not three minutes of fight');
  // play on, unpaused: the judges at 180 s of the world's play from the word
  while (r.A.bout().phase === 'fight' && played < BOUT_LIMIT_MS + 5000) { r.step(100); played += 100; }
  assert.equal(r.A.bout().result?.how, 'judges');
  assert.ok(played >= BOUT_LIMIT_MS && played < BOUT_LIMIT_MS + 100, `the limit after ${played} ms of play`);
});

test('AUDIT PRE-MERGE 1003 B1: the doors\' hooks are on the law\'s clock - after a pause the stall is said 8 s of play after a blow, and a fall\'s verdict comes END_HOLD_MS of play after it', async () => {
  const r = await ladderRig({ tier: 0, won: 0 });
  toFight(r);
  for (let i = 0; i < 1000; i++) r.step(100, { hidden: true }, 0);   // 100 s paused
  assert.equal(r.A.bout().phase, 'fight');
  assert.equal(r.A.bout().stallSaid, false, 'no stall said under the window');
  door(r.foes[0], 5, { fromPlayer: true });   // the window shut, the first blow
  let played = 0;
  while (!r.A.bout().stallSaid && played < STALL_MS + 2000) { r.step(100); played += 100; }
  assert.equal(r.A.bout().stallSaid, true, 'the stall said');
  assert.ok(played >= STALL_MS && played < STALL_MS + 200, `the stall after ${played} ms of play`);
  for (let i = 0; i < 300; i++) r.step(100, { hidden: true }, 0);   // and another 30 s under a window
  door(r.foes[0], 100, { fromPlayer: true });   // to the floor
  assert.equal(r.A.bout().result?.how, 'fall');
  played = 0;
  while (r.A.bout().phase === 'end' && played < END_HOLD_MS + 2000) { r.step(100); played += 100; }
  assert.equal(r.A.bout().phase, 'verdict');
  assert.ok(played >= END_HOLD_MS && played < END_HOLD_MS + 200, `the verdict after ${played} ms of play`);
});

// ── B2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 1003 B2: my blow on an exhibition fighter is made good through the door\'s own order - its whole health kept nothing, no fall, no verdict, the Herald\'s warning; the second is the watch\'s; the fighters\' own blows count', async () => {
  const r = await cityRig();
  toFight(r);
  const [f0, f1] = r.foes;
  door(f0, 75, { fromPlayer: true });   // the favourite struck for its whole health and more
  r.step(100);
  assert.equal(f0.entity.health, 60, 'made good, whole');
  assert.equal(f0.entity.bout.out, false, 'never floored');
  assert.equal(r.A.bout().result, null);
  assert.equal(r.A.bout().phase, 'fight');
  assert.ok(r.log.say.includes(ARENA_TEXT.herald.intrude), 'the Herald\'s warning');
  for (let i = 0; i < 80; i++) r.step(100);
  assert.deepEqual(r.log.verdicts, [], 'no exhibition verdict told');
  door(f0, 20, { fromPlayer: true }); r.step(100);
  assert.equal(f0.entity.health, 60, 'made good again');
  assert.equal(r.log.crime, 1, 'the second: the watch');
  // the fighters' own blows are the bout's
  door(f0, 20, { striker: f1 }); r.step(100);
  assert.equal(f0.entity.health, 40);
  assert.equal(boutFighter(r.A.bout(), 'f1').dealt, 20);
});

// ── B3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 1003 B3: an exhibition walked away from after its word - the stake is the house\'s whichever fighter led (no verdict of the moment, no house coin later); a result already standing is told', async () => {
  // the fighter I backed seen losing: walked away from
  const a = await cityRig();
  assert.equal(a.gate.wager(a.ex.hour, 0, 100).ok, true);
  toFight(a);
  door(a.foes[0], 58, { striker: a.foes[1] }); a.step(100);   // my fighter at 2 of 60
  a.A.setStage(null);   // a door, the stair, 260 m: the stage goes
  assert.equal(a.A.bout(), null);
  assert.equal(a.P.arenaLeague.book.wagers[0].status, 'lost', 'walked away from: the house\'s');
  assert.deepEqual(a.log.verdicts, [[a.ex.hour, BK.BOUT_LEFT]]);
  // ...and seen winning: no judges' card locked in at the moment I chose
  const b = await cityRig();
  assert.equal(b.gate.wager(b.ex.hour, 0, 100).ok, true);
  toFight(b);
  door(b.foes[1], 58, { striker: b.foes[0] }); b.step(100);   // my fighter ahead on every count
  b.A.setStage(null);
  assert.equal(b.P.arenaLeague.book.wagers[0].status, 'lost', 'no lead locked in by leaving');
  assert.equal(b.P.arenaLeague.book.owed, 0);
  // the hour out: nothing settled again by the house's record
  assert.equal(BK.settleBook(b.P.arenaLeague.book, (b.ex.hour + 1) * 60).settled.length, 0);
  // a fall already standing (its verdict not yet said) is the verdict
  const c = await cityRig();
  assert.equal(c.gate.wager(c.ex.hour, 1, 100).ok, true);
  toFight(c);
  door(c.foes[0], 100, { striker: c.foes[1] }); c.step(100);
  assert.equal(c.A.bout().phase, 'end');
  c.A.setStage(null);
  assert.deepEqual(c.log.verdicts, [[c.ex.hour, 1]]);
  assert.equal(c.P.arenaLeague.book.wagers[0].status, 'won');
  // before the word, nothing seen: the house's record as ever, at the hour's end
  const d = await cityRig();
  assert.equal(d.gate.wager(d.ex.hour, 0, 100).ok, true);
  d.step(100);
  d.A.setStage(null);
  assert.deepEqual(d.log.verdicts, [], 'nothing told for a bout gone before its word');
  assert.equal(d.P.arenaLeague.book.wagers[0].status, 'open');
});

test('AUDIT PRE-MERGE 1003 B3: the Herald\'s Watch never fights an hour again once it has had its word here - not offered, refused at the window\'s press, and both hosts ask before they dismiss', async () => {
  const r = await cityRig();
  let ch = r.gate.heraldChoice({ cityBout: r.A.onSand() });
  assert.ok(ch.options.some((o) => o.act === 'watch'), 'before the word: Watch');
  assert.equal(r.gate.watchRefusal?.(r.ex.hour) ?? null, null);
  toFight(r);
  ch = r.gate.heraldChoice({ cityBout: r.A.onSand() });
  assert.ok(!ch.options.some((o) => o.act === 'watch'), 'past the word: no Watch');
  assert.ok(ch.lines.includes(ARENA_TEXT.herald.underWay), 'his lines say why');
  assert.deepEqual(r.gate.windowAct('watch'), { ok: false, text: ARENA_TEXT.herald.watchSeen }, 'the window\'s press refused');
  assert.deepEqual(r.log.acts, [], 'the host\'s Watch never asked');
  // to the verdict, the crowd gone home: the hour still open, and still no Watch
  door(r.foes[1], 100, { striker: r.foes[0] });
  for (let i = 0; i < 400 && r.A.bout(); i++) r.step(100);
  assert.equal(r.A.bout(), null);
  assert.ok(r.ex.open);
  ch = r.gate.heraldChoice({ cityBout: null });
  assert.ok(!ch.options.some((o) => o.act === 'watch'), 'seen to its verdict: no Watch this hour');
  assert.ok(ch.lines.includes(ARENA_TEXT.herald.noWatch));
  assert.equal(r.gate.watchRefusal(r.ex.hour), ARENA_TEXT.herald.watchSeen);
  // the hosts: Watch asks the gate before it dismisses anything or asks the hour again
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(f), /const no = arenaGate\.watchRefusal\(ex\.hour\); if \(no\) \{ townTalk\.say\(no\); return; \}[^\n]*\n\s*_arenaHourRun = ex\.hour;\n\s*arenaBouts\.dismiss\(\);\n\s*arenaBouts\.ask\(\{ where: 'floor', kind: 'exhibition', ex \}\);/, f);
  }
});

test('AUDIT PRE-MERGE 1003 B3: the book keeps every verdict seen here, wagered or not, and takes no wager on an hour already seen', async () => {
  const gm = noon(7);
  const ex = exhibitionFor(gm);
  const seen = BK.bookVerdict(BK.newArenaBook(), ex.hour, 0);
  assert.deepEqual(seen.seen, [{ hour: ex.hour, side: 0 }], 'kept with no wager on it');
  assert.equal(BK.wagerRefusal(seen, ex, 50, { gold: 500 }), 'closed');
  assert.equal(BK.placeWager(seen, ex, 1, 50, { gold: 500 }).reason, 'closed');
  assert.equal(BK.exhibitionCard({ book: seen }, ex, gm, { gold: 300 }).why, ARENA_TEXT.book.whyClosed);
  const ch = BK.bookmakerChoice({ league: { ...LG.newArenaLeague(), book: seen }, gameMinutes: gm, gold: 300 });
  assert.ok(!ch.options.some((o) => /^back/.test(o.act)) && ch.lines.includes(ARENA_TEXT.book.whyClosed));
  assert.deepEqual(BK.settleBook(seen, gm + 600).book.seen, seen.seen, 'kept through a settling');
  const left = BK.bookRestore(JSON.parse(JSON.stringify(BK.bookVerdict(BK.newArenaBook(), ex.hour, BK.BOUT_LEFT))));
  assert.deepEqual(left.seen, [{ hour: ex.hour, side: BK.BOUT_LEFT }], 'a bout left rides the save');
  // through the gate: the hour's bout seen to its verdict with nothing on it, its crowd gone - the book on it stays shut
  const r = await cityRig();
  toFight(r);
  door(r.foes[0], 100, { striker: r.foes[1] });
  for (let i = 0; i < 400 && r.A.bout(); i++) r.step(100);
  assert.equal(r.A.bout(), null);
  assert.deepEqual(r.log.verdicts, [[r.ex.hour, 1]]);
  assert.deepEqual(r.gate.wager(r.ex.hour, 1, 50), { ok: false, text: ARENA_TEXT.book.whyRefused.closed }, 'its winner is known');
  assert.equal(r.P.goldPieces, 5000, 'nothing taken');
});

// ── B4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 1003 B4: no price shorter than his shortest rung - every price laid is under the fair one, with the house\'s draw too; a favourite past it is refused and said', async () => {
  let laid = 0, refused = 0;
  for (let i = 10; i <= 990; i++) {
    const p = i / 1000;
    const pr = BK.priceFor(p);
    if (!pr) { refused++; continue; }
    laid++;
    const back = 1 + pr[0] / pr[1];
    assert.ok(p * back <= 1 + 1e-9, `${p}: ${pr.join(' to ')} pays ${(p * back).toFixed(3)} for 1`);
    assert.ok(0.96 * p * back + BK.HOUSE_DRAW <= 1 + 1e-9, `${p}: with the house's draw ${(0.96 * p * back + 0.04).toFixed(3)}`);
  }
  assert.ok(laid > 700 && refused > 100, `${laid} laid, ${refused} refused`);
  assert.deepEqual(BK.priceFor(0.81), [1, 5], 'the shortest rung where it is under the fair price');
  assert.equal(BK.priceFor(0.9), null);
  // an hour whose favourite is past the line
  let h = Math.floor(noon(1) / 60);
  for (; h < Math.floor(noon(1) / 60) + 24 * 60; h++) { const e = exhibitionFor(h * 60); if (e && Math.max(...BK.exhibitionOdds(e)) > 0.85) break; }
  const gm = h * 60, ex = exhibitionFor(gm), odds = BK.exhibitionOdds(ex);
  const fav = odds[0] > odds[1] ? 0 : 1, dog = 1 - fav;
  assert.equal(BK.placeWager(BK.newArenaBook(), ex, fav, 1000, { gold: 1000 }).reason, 'price', 'the favourite not laid');
  assert.equal(BK.wagerRefusal(BK.newArenaBook(), ex, 50, { gold: 500, side: fav }), 'price');
  assert.equal(BK.placeWager(BK.newArenaBook(), ex, dog, 50, { gold: 500 }).ok, true, 'the other side is');
  const names = ex.opponents.map((o, i) => fighterIdentity(ex.seed, i, o.mobile).name);
  const ch = BK.bookmakerChoice({ league: LG.newArenaLeague(), gameMinutes: gm, gold: 300 });
  assert.deepEqual(ch.options.filter((o) => /^back/.test(o.act)).map((o) => o.act), [`back${dog}`], 'only the side he lays');
  assert.ok(ch.lines.includes(ARENA_TEXT.book.notLaid(names[fav])), 'and he says why');
  const card = BK.exhibitionCard(LG.newArenaLeague(), ex, gm, { gold: 300 });
  assert.equal(card.prices[fav], null);
  assert.equal(card.odds[fav], ARENA_TEXT.book.noPrice);
  assert.ok(card.lines.includes(ARENA_TEXT.book.notLaid(names[fav])));
  const P = { goldPieces: 400, items: [], arenaLeague: null };
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: () => {}, begun: () => false, openWindow: null });
  assert.deepEqual(gate.wager(ex.hour, fav, 100), { ok: false, text: ARENA_TEXT.book.whyRefused.price });
  assert.equal(P.goldPieces, 400);
});

// ── B5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** From the bout's end to its healers, a blow at every phase (an arrow loosed before, a spell, a poison's round - through
 *  the dungeon's door, hurtEntity(playerEntity, dmg, opts.playerSpare?.() ?? {})) at 12 HP: never below 1. */
function blowsToHealers(r, why) {
  const seen = [];
  for (let i = 0; i < 300 && r.A.bout().phase !== 'done'; i++) {
    const ph = r.A.bout().phase;
    if (!seen.includes(ph)) {
      seen.push(ph);
      r.P.health = Math.min(r.P.health, 12);
      hurtPlayer(r.P, 50, r.A.playerSpare() ?? {});
      assert.ok(r.P.health >= 1, `${why}, ${ph}: health ${r.P.health}`);
    }
    r.step(100);
  }
  for (const ph of ['end', 'verdict', 'heal']) assert.ok(seen.includes(ph), `${why}: ${ph} passed through`);
  assert.equal(r.A.bout().phase, 'done');
  assert.equal(r.A.playerSpare(), null, `${why}: no spare once done`);
}

test('AUDIT PRE-MERGE 1003 B5: my spare holds from the word to the healers - a blow after my yield, after my fall, after my fall in a Grand Melee fought on, leaves me at a breath of life', async () => {
  // the yield at 12 HP
  const y = await ladderRig({ tier: 1, won: 2 });
  toFight(y);
  y.P.health = 12; y.step(100, { sheathed: false }); y.step(100, { sheathed: true });
  assert.equal(y.A.bout().result?.how, 'yield');
  blowsToHealers(y, 'after the yield');
  // the fall at 1 HP
  const f = await ladderRig({ tier: 1, won: 2 });
  toFight(f);
  f.P.health = 5;
  hurtPlayer(f.P, 200, f.A.playerSpare() ?? {});
  f.step(100);
  assert.deepEqual([f.P.health, f.A.bout().result?.how, f.A.bout().result?.side], [1, 'fall', 1]);
  blowsToHealers(f, 'after the fall');
  // a Grand Melee: I fall, the three fight on - their missiles and their spells still fly
  const g = await ladderRig({ tier: 9, won: 0 });
  toFight(g);
  assert.equal(g.foes.length, 3);
  g.P.health = 5;
  hurtPlayer(g.P, 200, g.A.playerSpare() ?? {});
  g.step(100);
  assert.equal(boutFighter(g.A.bout(), YOU).out, 'fall');
  assert.equal(g.A.bout().phase, 'fight', 'the melee fights on');
  for (let i = 0; i < 3; i++) {
    hurtPlayer(g.P, 50, g.A.playerSpare() ?? {});
    g.step(100);
    assert.equal(g.P.health, 1, 'out of the melee, still on the sand: a breath of life');
  }
  assert.equal(g.A.bout().result, null, 'the spare says nothing to the law of one already out');
});

// ── B6 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT PRE-MERGE 1003 B6: a bout gone while its crowd\'s pictures load leaves no billboard batch made and not destroyed', async () => {
  let made = 0, destroyed = 0, gets = 0, A = null;
  const renderer = { createBillboardBatch: () => ({ id: ++made }), destroyBillboardBatch: () => { destroyed++; } };
  const getTexture = async () => {
    gets++;
    if (gets === 4) A.dismiss();   // the stage goes (a door, 260 m) while the fourth picture loads
    return { getSize: () => ({ width: 20, height: 40 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 };
  };
  const r = rig({ kind: 'city', extra: { renderer, getTexture } });
  A = r.A;
  r.stage.heightAt = (x, z) => (Math.hypot(x - 50, z - 40) > 20 ? 8 : null);   // tiers past 20 m (crowdSeats' down-ray)
  r.A.setStage(r.stage);
  r.A.ask({ where: 'city', kind: 'exhibition', ex: r.ex });
  for (let i = 0; i < 50; i++) await settle();
  assert.equal(r.A.bout(), null);
  assert.ok(made >= 3, `${made} made before the bout went`);
  assert.equal(destroyed, made, `${made} made, ${destroyed} destroyed`);
});
