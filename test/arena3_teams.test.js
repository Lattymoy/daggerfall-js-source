// ARENA3 (2026-10-02, Mac: "join a team (red and blue)"): THE BANNERS AND THEIR SEASON, offline
// (systems/arenaLeague.js; bible/11-Multiplayer/Arena.md "3. The teams"). Pinned here: the season is the game's year and
// its day the day of the year; joining is free and changing costs a season (quit at once, the other banner only next
// season, the same banner again at once); team points 1 / 3 / 10 to the banner worn and to none unworn; the season
// closed on the first read past it - its winner, the laurel to the winning banner's fighters, a level season none;
// the roster - 24 a banner, named by the bouts' own law, climbing the same ten tiers, the same on every read; the
// recruiters' choice (join, quit asked twice, the window, leave - every refusal a line); the driver's banners on the
// versus bar and the laurel's favour; the bout kept for the Records page; the save's round trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as LG from '../src/systems/arenaLeague.js';
import { recruiterChoice, quitAsk } from '../src/systems/arenaHerald.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { createArenaBouts, YOU } from '../src/scenes/arenaBouts.js';
import { newArenaLadder, nextLadderBout, exhibitionFor, LADDER_TIERS } from '../src/systems/arenaLadder.js';
import { arenaHudModel } from '../src/ui/arenaHud.js';
import { MINUTES_PER_DAY, DAYS_PER_YEAR } from '../src/systems/gameDate.js';
import { createArenaGate, RECRUITER_BANNER } from '../src/scenes/arenaGate.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const YEAR = DAYS_PER_YEAR * MINUTES_PER_DAY;
/** 3E 405, the new game's day 4 - and a minute `d` days on. */
const START = 523530;
const at = (d = 0) => START + d * MINUTES_PER_DAY;

test('ARENA3 season: the game\'s year is the season and its day the day of the year', () => {
  assert.equal(LG.seasonOf(START), 405, 'a new game stands in 3E 405');
  assert.equal(LG.seasonDayOf(START), 4);
  assert.equal(LG.seasonOf(START + YEAR), 406);
  const lastOf405 = (405 - 404 + 1) * YEAR - 1;
  assert.deepEqual([LG.seasonOf(lastOf405), LG.seasonDayOf(lastOf405)], [405, 360]);
  assert.deepEqual([LG.seasonOf(lastOf405 + 1), LG.seasonDayOf(lastOf405 + 1)], [406, 1]);
  assert.equal(LG.otherBanner('red'), 'blue');
  assert.equal(LG.otherBanner('blue'), 'red');
});

test('ARENA3 banners: joining is free; quitting is at once; the other banner waits a season; the same banner does not', () => {
  const L0 = LG.newArenaLeague();
  assert.equal(LG.joinRefusal(L0, 'green', at()), 'banner');
  assert.equal(LG.joinRefusal(L0, 'red', at()), null);
  const j = LG.joinBanner(L0, 'red', at());
  assert.equal(j.ok, true);
  assert.equal(j.league.team, 'red');
  assert.equal(j.league.joinedAt, at());
  assert.equal(L0.team, null, 'a new record - the old untouched');
  assert.equal(LG.joinRefusal(j.league, 'red', at()), 'already');
  assert.equal(LG.joinRefusal(j.league, 'blue', at()), 'other', 'quit the one you wear first');
  assert.equal(LG.joinBanner(j.league, 'blue', at()).ok, false);
  const q = LG.quitBanner(j.league, at(10));
  assert.equal(q.ok, true);
  assert.equal(q.league.team, null);
  assert.deepEqual(q.league.left, { banner: 'red', season: 405 });
  assert.equal(LG.quitBanner(q.league, at(10)).reason, 'none');
  assert.equal(LG.joinRefusal(q.league, 'blue', at(11)), 'season', 'changing costs a season');
  assert.equal(LG.joinRefusal(q.league, 'blue', at(355)), 'season', 'all of it');
  assert.equal(LG.joinRefusal(q.league, 'red', at(11)), null, 'rejoining the banner quit is no change');
  const next = 406 * 0 + at(360);   // the first day of 3E 406
  assert.equal(LG.seasonOf(next), 406);
  assert.equal(LG.joinRefusal(q.league, 'blue', next), null, 'the new season opens the other banner');
  const back = LG.joinBanner(q.league, 'red', at(12)).league;
  assert.equal(back.left, null, 'a rejoin clears the quit');
});

test('ARENA3 points: a ladder bout won 1, a tier champion 3, the Grand Champion 10 - to the banner worn, none unworn', () => {
  assert.deepEqual(LG.TEAM_POINTS, { bout: 1, champion: 3, grand: 10 });
  assert.equal(LG.boutPoints({ won: true }), 1);
  assert.equal(LG.boutPoints({ won: true, champion: true }), 3);
  assert.equal(LG.boutPoints({ won: true, champion: true, grand: true }), 10);
  assert.equal(LG.boutPoints({ won: false, champion: true }), 0);
  let L = LG.leagueAfterBout(LG.newArenaLeague(), { gameMinutes: at(1), tier: 0, label: 'bout 1 of 3', opp: 'Aldo', won: true, how: 'fall', purse: 52 });
  assert.deepEqual(L.points, { red: 0, blue: 0 }, 'no banner, no points');
  assert.equal(L.bouts.length, 1, 'the bout kept all the same');
  assert.equal(L.bouts[0].points, 0);
  assert.equal(L.firstBoutAt, at(1));
  L = LG.joinBanner(L, 'blue', at(2)).league;
  L = LG.leagueAfterBout(L, { gameMinutes: at(3), tier: 0, opp: 'Bran', won: true, how: 'yield', purse: 50 });
  L = LG.leagueAfterBout(L, { gameMinutes: at(4), tier: 0, opp: 'Cyr', won: true, how: 'fall', purse: 200, champion: true });
  L = LG.leagueAfterBout(L, { gameMinutes: at(5), tier: 1, opp: 'Dun', won: false, how: 'yield' });
  assert.deepEqual(L.points, { red: 0, blue: 4 });
  assert.deepEqual(L.bouts.map((b) => [b.opp, b.won, b.points, b.team]), [['Dun', false, 0, 'blue'], ['Cyr', true, 3, 'blue'], ['Bran', true, 1, 'blue'], ['Aldo', true, 0, null]], 'newest first');
  L = LG.leagueAfterBout(L, { gameMinutes: at(9), tier: 9, opp: 'the Iron Atronach', won: true, how: 'fall', champion: true, grand: true });
  assert.equal(L.points.blue, 14);
  assert.equal(L.grandAt, at(9));
  for (let i = 0; i < 30; i++) L = LG.leagueAfterBout(L, { gameMinutes: at(10 + i), tier: 9, won: false });
  assert.equal(L.bouts.length, LG.BOUTS_KEPT, 'the Records page keeps twenty');
  L = LG.leagueAfterBout(L, { gameMinutes: at(50), tier: 9, won: true, champion: true, grand: true });
  assert.equal(L.grandAt, at(9), 'stamped once');
});

test('ARENA3 season close: the standings closed with my points, the winner kept, the laurel to its banner, mine if I wore it', () => {
  // find a season the roster leaves close enough for my points to swing it
  let season = 405;
  let L = LG.joinBanner(LG.newArenaLeague(), 'red', at()).league;
  const fin = LG.seasonFinal(405);
  const behind = fin.blue - fin.red;
  L.points.red = Math.max(5, behind + 5);   // enough to win
  const rolled = LG.rollLeague(L, at(360));
  assert.equal(rolled.season, 406);
  assert.equal(rolled.since, 405, 'the Hall\'s first season');
  assert.equal(rolled.seasons.length, 1);
  const s0 = rolled.seasons[0];
  assert.deepEqual([s0.season, s0.mine, s0.gave], [season, 'red', L.points.red]);
  assert.equal(s0.red, fin.red + L.points.red);
  assert.equal(s0.winner, 'red');
  assert.deepEqual(rolled.laurel, { banner: 'red', season: 406 });
  assert.deepEqual(rolled.points, { red: 0, blue: 0 }, 'a new season begins at nothing');
  assert.equal(LG.laurelWorn(rolled, at(360)), true);
  assert.equal(LG.laurelBanner(rolled, at(360)), 'red');
  assert.equal(LG.laurelWorn(LG.quitBanner(rolled, at(361)).league, at(361)), false, 'quit, the laurel is not yours');
  assert.equal(LG.laurelWorn(rolled, at(720)), false, 'one season');
  assert.equal(LG.rollLeague(rolled, at(360)), rolled, 'a read inside the season moves nothing');
  // the blue's laurel is not mine
  const blueWins = LG.joinBanner(LG.newArenaLeague(), 'red', at()).league;
  blueWins.points.blue = fin.red - fin.blue + 5 > 0 ? fin.red - fin.blue + 5 : 0;
  const b = LG.rollLeague(blueWins, at(360));
  assert.equal(b.seasons[0].winner, 'blue');
  assert.equal(LG.laurelBanner(b, at(360)), 'blue');
  assert.equal(LG.laurelWorn(b, at(360)), false);
  // a level season: no laurel
  const lev = LG.newArenaLeague();
  lev.season = 405; lev.since = 405;
  if (fin.red > fin.blue) lev.points.blue = fin.red - fin.blue; else lev.points.red = fin.blue - fin.red;
  const l = LG.rollLeague(lev, at(360));
  assert.equal(l.seasons[0].winner, null);
  assert.equal(l.laurel, null);
  // seasons passed unread: each closed, mine only in the first
  const far = LG.rollLeague(L, at(360 * 3));
  assert.deepEqual(far.seasons.map((x) => x.season), [407, 406, 405]);
  assert.deepEqual(far.seasons.map((x) => x.gave), [0, 0, L.points.red]);
  assert.deepEqual(far.laurel, far.seasons[0].winner ? { banner: far.seasons[0].winner, season: 408 } : null);
});

test('ARENA3 roster: 24 a banner, named by the bouts\' law, climbing the ten tiers - the same on every read, growing with the season', () => {
  const r = LG.leagueRoster(405, 200);
  assert.equal(r.length, LG.ROSTER_PER_BANNER * 2);
  assert.equal(r.filter((f) => f.banner === 'red').length, 24);
  assert.equal(new Set(r.map((f) => f.id)).size, 48);
  for (const f of r) {
    assert.ok(f.name && f.home && !/undefined|null/.test(f.name), f.name);
    assert.ok(LG.ROSTER_CLASSES.includes(f.mobile));
    assert.ok(f.tier >= 0 && f.tier < LADDER_TIERS.length);
    assert.ok(f.points >= f.wins && f.points <= f.wins * 10);
  }
  assert.deepEqual(LG.leagueRoster(405, 200).map((f) => f.points), r.map((f) => f.points), 'the same day, the same board');
  const t1 = LG.rosterTotals(405, 30), t2 = LG.rosterTotals(405, 200), t3 = LG.rosterTotals(405, 360);
  assert.ok(t1.red < t2.red && t2.red < t3.red && t1.blue < t2.blue && t2.blue < t3.blue, 'points grow through the season');
  assert.deepEqual(LG.rosterTotals(405, 3), LG.rosterTotals(405, 3));
  // the Grand Champion is rare - a handful a season at most, over many seasons
  let grands = 0;
  for (let s = 405; s < 415; s++) grands += LG.leagueRoster(s, 360).filter((f) => f.grand).length;
  assert.ok(grands >= 1 && grands <= 25, `${grands} Grand Champions in ten seasons`);
  const g = LG.leagueRoster(405, 360).find((f) => f.grand);
  if (g) assert.equal(g.title, 'Grand Champion');
  // the win chance falls with the tier and rises with talent
  assert.ok(LG.rosterWinChance(0.5, 0, false) > LG.rosterWinChance(0.5, 5, false));
  assert.ok(LG.rosterWinChance(0.9, 5, false) > LG.rosterWinChance(0.5, 5, false));
  assert.ok(LG.rosterWinChance(0.6, 5, true) < LG.rosterWinChance(0.6, 5, false), 'a champion is harder');
  assert.equal(LG.rosterWinChance(0, 9, true), 0.04, 'never hopeless');
  assert.equal(LG.rosterWinChance(1, 0, false), 0.96, 'never certain');
  // standings: the roster's and mine
  const L = LG.joinBanner(LG.newArenaLeague(), 'blue', at(100)).league;
  L.points.blue = 7;
  const st = LG.leagueStandings(L, at(100));
  const rt = LG.rosterTotals(405, LG.seasonDayOf(at(100)));
  assert.deepEqual([st.red, st.blue, st.given, st.mine], [rt.red, rt.blue + 7, 7, 'blue']);
});

test('ARENA3 recruiters: the pitch and the standing; join where it will take you, quit asked twice, every refusal a line', () => {
  const R = ARENA_TEXT.recruiter;
  const L0 = LG.newArenaLeague();
  const red = recruiterChoice({ banner: 'red', league: L0, gameMinutes: at(10) });
  assert.ok(red.lines.includes(R.pitch) && red.lines.includes(R.rule));
  assert.ok(red.lines.some((l) => l.startsWith('The season of 3E 405, day 14 of 360')));
  assert.deepEqual(red.options.map((o) => o.act), ['join', 'window', 'leave', 'leave']);
  assert.equal(red.options[0].label, 'J - Join the Red Banner');
  const L1 = LG.joinBanner(L0, 'red', at(10)).league;
  const mine = recruiterChoice({ banner: 'red', league: L1, gameMinutes: at(10) });
  assert.deepEqual(mine.options.map((o) => o.act), ['quit', 'window', 'leave', 'leave']);
  assert.ok(mine.lines.includes(R.yours('the Red Banner')));
  const theirs = recruiterChoice({ banner: 'blue', league: L1, gameMinutes: at(10) });
  assert.deepEqual(theirs.options.map((o) => o.act), ['window', 'leave', 'leave'], 'nothing to join while you wear the Red');
  assert.ok(theirs.lines.includes(R.theirs('the Red Banner')));
  const quit = LG.quitBanner(L1, at(11)).league;
  const wait = recruiterChoice({ banner: 'blue', league: quit, gameMinutes: at(11) });
  assert.ok(wait.lines.includes(R.wait('the Red Banner')), 'the season, said');
  assert.ok(!wait.options.some((o) => o.act === 'join'));
  assert.ok(recruiterChoice({ banner: 'red', league: quit, gameMinutes: at(11) }).options.some((o) => o.act === 'join'), 'the banner quit takes you back');
  assert.ok(!recruiterChoice({ banner: 'red', league: L0, gameMinutes: at(10), window: false }).options.some((o) => o.act === 'window'), 'no window, no button');
  const ask = quitAsk('blue');
  assert.deepEqual(ask.options.map((o) => [o.code, o.act]), [['KeyY', 'quit'], ['KeyN', 'stay'], ['Escape', 'stay']]);
  for (const o of [...red.options, ...mine.options, ...ask.options].filter((x) => x.label)) assert.match(o.label, /^[A-Z] - [A-Z]/);
  for (const l of [...red.lines, ...mine.lines, ...wait.lines, ...ask.lines]) assert.ok(l.length <= 90, l);
});

test('ARENA3 the gate: a recruiter\'s choice joins, quits after asking, opens the window - one home for both hosts', () => {
  assert.deepEqual(RECRUITER_BANNER, { redRecruiter: 'red', blueRecruiter: 'blue' });
  const P = { arenaLeague: null };
  const shown = [], said = [], opened = [];
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => at(20), showOverlay: (w) => shown.push(w), say: (l) => said.push(l), openWindow: (p) => opened.push(p) });
  assert.equal(gate.recruiter('herald'), false);
  assert.equal(gate.recruiter('blueRecruiter'), true);
  shown.at(-1).input('KeyJ');
  assert.equal(P.arenaLeague.team, 'blue');
  assert.deepEqual(said, [ARENA_TEXT.recruiter.joined('the Blue Banner')]);
  assert.deepEqual(opened, ['team'], 'joining opens the Team page');
  gate.recruiter('blueRecruiter');
  shown.at(-1).input('KeyQ');
  assert.equal(P.arenaLeague.team, 'blue', 'asked first');
  shown.at(-1).input('KeyN');
  assert.equal(P.arenaLeague.team, 'blue', 'no keeps it');
  gate.recruiter('blueRecruiter');
  shown.at(-1).input('KeyQ');
  shown.at(-1).input('KeyY');
  assert.equal(P.arenaLeague.team, null);
  assert.equal(said.at(-1), ARENA_TEXT.recruiter.quitDone('the Blue Banner'));
  gate.recruiter('redRecruiter');
  assert.ok(!shown.at(-1).options.some((o) => o.code === 'KeyJ'), 'the Red waits a season');
  shown.at(-1).input('KeyA');
  assert.deepEqual(opened, ['team', 'team']);
  // the hosts: both hand the recruiters to the gate; the click finds them by office
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const W = rd(f);
    assert.match(W, /arenaRecruiter: \(role\) => arenaGate\.recruiter\(role\)/, f);
    assert.match(W, /gameMinutes: \(\) => worldMinutes\(\),   \/\/ ARENA3/, `${f}: the driver reads the clock`);
  }
  assert.match(rd('src/scenes/worldModes.js'), /if \(\(gateRole === 'redRecruiter' \|\| gateRole === 'blueRecruiter'\) && host\.arenaRecruiter\?\.\(gateRole\)\) return;/);
});

const settle = () => new Promise((r) => setTimeout(r, 0));
function rig(P) {
  let t = 1000;
  const log = { notice: [], hud: [] };
  const foes = [];
  const stage = {
    kind: 'floor', centre: () => [0, 0, 0],
    spawn: async (mobile, feet, o) => { const f = { mobile, o, entity: { health: 40, maxHealth: 40, bout: o.bout, items: [] }, ai: { feet: [...feet], target: null } }; foes.push(f); return f; },
    remove: () => {}, heightAt: () => null,
  };
  const A = createArenaBouts({ now: () => t, rng: () => 0.99, playerEntity: P, gameMinutes: () => at(40), notice: (ls) => log.notice.push(...ls), drawHud: (m) => log.hud.push(m), pay: () => {}, heal: () => {} });
  const step = (ms) => { t += ms; A.frame(ms / 1000, { playerFeet: [0, 0, 0], sheathed: false }); };
  return { A, foes, stage, log, step };
}

test('ARENA3 driver: my banner on the versus bar, an exhibition the Red against the Blue, the laurel\'s favour, the bout kept and its points', async () => {
  // my ladder bout under the Blue, with last season's laurel
  const L = LG.joinBanner(LG.newArenaLeague(), 'blue', at(40)).league;
  L.laurel = { banner: 'blue', season: 405 };
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: L };
  const r = rig(P);
  r.A.setStage(r.stage);
  r.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(P.arenaLadder) });
  await settle();
  for (let i = 0; i < 200 && r.A.bout()?.phase !== 'fight'; i++) r.step(100);
  const hud = r.log.hud.filter(Boolean).at(-1);
  assert.equal(hud.left[0].team, 'blue', 'my pennant');
  assert.equal(hud.right[0].team, '', 'the house\'s fighter wears none');
  assert.ok(r.A.crowd().favour[YOU] >= LG.LAUREL_FAVOUR - 1e-9, 'the laurel - the crowd with me from the first bell');
  const f = r.foes[0];
  f.entity.health = 1; f.entity.bout.out = true; f.entity.bout.hooks.floor(f);
  for (let i = 0; i < 100 && r.A.bout().phase !== 'done'; i++) r.step(100);
  assert.equal(P.arenaLeague.bouts.length, 1, 'kept for the Records page');
  assert.deepEqual([P.arenaLeague.bouts[0].won, P.arenaLeague.bouts[0].points, P.arenaLeague.points.blue], [true, 1, 1]);
  assert.ok(P.arenaLeague.bouts[0].opp.length > 0, 'the opponent named');
  assert.ok(r.log.notice.includes(ARENA_TEXT.ladder.points(1, 'the Blue Banner')));
  // an exhibition: the Red's fighter against the Blue's; the laurel's banner favoured
  const P2 = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: { ...LG.newArenaLeague(), season: 405, since: 405, laurel: { banner: 'red', season: 405 } } };
  const r2 = rig(P2);
  r2.A.setStage(r2.stage);
  const ex = exhibitionFor(at(40) - (at(40) % MINUTES_PER_DAY) + 12 * 60);
  r2.A.ask({ where: 'floor', kind: 'exhibition', ex });
  await settle();
  for (let i = 0; i < 200 && r2.A.bout()?.phase !== 'fight'; i++) r2.step(100);
  const h2 = r2.log.hud.filter(Boolean).at(-1);
  assert.deepEqual([h2.left[0].team, h2.right[0].team], ['red', 'blue']);
  const fav = r2.A.crowd().favour;
  assert.ok(fav.f0 - fav.f1 >= LG.LAUREL_FAVOUR - 0.31, 'the Red, last season\'s winner, favoured');
  // the pure model: a team only where named
  const m = arenaHudModel(r2.A.bout(), r2.A.crowd(), 0, {});
  assert.deepEqual([m.left[0].team, m.right[0].team], ['', '']);
});

test('ARENA3 save: the league through save.js - every field back; any older or broken shape a fighter of no banner', () => {
  const fresh = LG.newArenaLeague();
  assert.deepEqual(LG.arenaLeagueRestore(undefined), fresh, 'a save from before ARENA3');
  assert.deepEqual(LG.arenaLeagueRestore('junk'), fresh);
  const odd = LG.arenaLeagueRestore({ team: 'green', left: { banner: 'red' }, points: { red: -3, blue: 'x' }, laurel: { banner: 'blue', season: 'no' }, seasons: [null, { season: 404, winner: 'pink' }], bouts: [5, { won: 'yes', tier: 99 }] });
  assert.deepEqual([odd.team, odd.left, odd.points, odd.laurel], [null, null, { red: 0, blue: 0 }, null]);
  assert.deepEqual(odd.seasons, [{ season: 404, red: 0, blue: 0, winner: null, mine: null, gave: 0 }]);
  assert.deepEqual([odd.bouts.length, odd.bouts[0].won, odd.bouts[0].tier], [1, false, 9]);
  let L = LG.joinBanner(fresh, 'red', at(5)).league;
  L = LG.leagueAfterBout(L, { gameMinutes: at(6), tier: 0, label: 'bout 1 of 3', opp: 'Aldo', won: true, how: 'fall', purse: 60 });
  L = LG.rollLeague(L, at(400));
  L = LG.quitBanner(L, at(401)).league;
  const entity = { name: 'Hero', items: [], arenaLeague: L };
  const snap = snapshotPlayer(entity, {});
  assert.equal(snap.arenaLeague.v, LG.ARENA_LEAGUE_VERSION, 'versioned inside its own shape');
  const back = {};
  restorePlayer(back, JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(back.arenaLeague, LG.arenaLeagueRestore(L));
  assert.deepEqual([back.arenaLeague.left, back.arenaLeague.seasons.length, back.arenaLeague.bouts[0].opp, back.arenaLeague.since], [{ banner: 'red', season: 406 }, 1, 'Aldo', 405]);
  const snapCopy = LG.arenaLeagueSnapshot(L);
  snapCopy.points.red = 99;
  assert.notEqual(L.points.red, 99, 'a copy, never the live record');
  const old = JSON.parse(JSON.stringify(snap));
  delete old.arenaLeague;
  const back2 = {};
  restorePlayer(back2, old);
  assert.deepEqual(back2.arenaLeague, fresh, 'an envelope from before ARENA3 wears no banner');
});
