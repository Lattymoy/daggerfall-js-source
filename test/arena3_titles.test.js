// ARENA3 (2026-10-02, Mac: "Being a top rank PvE fighter comes with it's own title"; bible/11-Multiplayer/Arena.md "6.
// Titles and the laurel"): THE TITLES OFFLINE AND THE HALL. Pinned here: the Hall of Champions reads this save's
// Grand Champions - mine first, then the banners' fighters who took the title, season by season, the newest first, each
// with the banner they fought for - and with none handed in reads as it always did; the character sheet's Arena lines
// carry the banner worn (and show for a fighter of a banner who has not fought yet); the Herald cries me by my title on
// the sand; the title on the window's card and on the leaderboard is the ladder's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hallOfChampions, newArenaLadder, ladderAfter, nextLadderBout, LADDER_TIERS } from '../src/systems/arenaLadder.js';
import * as LG from '../src/systems/arenaLeague.js';
import * as AB from '../src/systems/arenaBoard.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { createArenaBouts } from '../src/scenes/arenaBouts.js';
import { heraldChoice } from '../src/systems/arenaHerald.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const START = 523530;
const U = ARENA_TEXT.undercroft;
const grandLadder = () => ({ ...newArenaLadder(), grand: true, tier: 9, won: 3, champs: Array(10).fill(true) });

test('ARENA3 the Hall: this save\'s Grand Champions - mine, then the banners\' by season, the newest first; none handed in, the old wall', () => {
  // a save that has seen three seasons close
  const L = { ...LG.newArenaLeague(), season: 405, since: 405 };
  const gm = START + 3 * 360 * MINUTES_PER_DAY;
  const theirs = LG.rosterGrandChampions(L, gm);
  const want = [];
  for (let s = 408; s >= 405; s--) want.push(...LG.leagueRoster(s, s === 408 ? LG.seasonDayOf(gm) : 360).filter((f) => f.grand).sort((a, b) => a.grandDay - b.grandDay).map((f) => f.name));
  assert.deepEqual(theirs.map((c) => c.name), want, 'every season since the save first saw the arena, the newest first');
  assert.ok(theirs.every((c) => c.season >= 405 && c.season <= 408 && (c.banner === 'red' || c.banner === 'blue')));
  assert.ok(theirs.length >= 1, 'four seasons see a Grand Champion or more');
  const none = hallOfChampions(newArenaLadder(), 'Aldo', theirs);
  assert.deepEqual(none.slice(0, 7), [U.hallTitle, '', U.hallIntro, '', U.hallNotYou, '', U.hallTheirs], 'not "no name is cut here" - theirs are');
  assert.equal(none.length, 7 + theirs.length);
  const c0 = theirs[0];
  assert.equal(none[7], `3E ${c0.season} - ${c0.name} of ${c0.home}, for ${ARENA_TEXT.teams.the[c0.banner]}`);
  const mine = hallOfChampions(grandLadder(), 'Aldo', theirs);
  assert.equal(mine[4], U.hallGrand('Aldo'), 'mine first');
  assert.ok(mine.indexOf(U.hallTheirs) > mine.indexOf(U.hallYours(10)), 'then theirs');
  // none handed in: the wall as ARENA-FIX cut it
  assert.deepEqual(hallOfChampions(newArenaLadder(), 'Aldo'), [U.hallTitle, '', U.hallIntro, '', U.hallNone]);
  assert.deepEqual(hallOfChampions(newArenaLadder(), 'Aldo', []), [U.hallTitle, '', U.hallIntro, '', U.hallNone]);
  // the keeper reads it with the league's champions
  const W = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(W, /hallOfChampions\(playerEntity\.arenaLadder, playerEntity\.name \|\| 'You', rosterGrandChampions\(playerEntity\.arenaLeague, Math\.floor\(worldMinutes\(\)\)\)\)/);
  // a save that never saw a season close sees only this season's
  const fresh = LG.rosterGrandChampions(LG.newArenaLeague(), START);
  assert.deepEqual(fresh, [], 'day 4 of 3E 405: nobody yet');
});

test('ARENA3 the sheet: the Arena lines carry the banner - shown for a fighter of a banner who has not fought yet', async () => {
  const { sheetModel } = await import('../src/ui/enhancedCharSheet.js');
  const hero = { name: 'A', race: 'Breton', level: 2, career: { name: 'Knight', primarySkills: [], majorSkills: [], minorSkills: [] },
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    activeEffects: [], skills: {}, health: 10, maxHealth: 10, magicka: 0, maxMagicka: 0, fatigue: 100, goldPieces: 0, items: [] };
  assert.equal(sheetModel(hero).arena, null);
  const joined = LG.joinBanner(LG.newArenaLeague(), 'blue', START).league;
  const line = sheetModel({ ...hero, arenaLeague: joined }).arena;
  assert.deepEqual(line, { title: null, record: '0 won, 0 lost', banner: 'The Blue Banner' });
  const g = sheetModel({ ...hero, arenaLadder: { ...grandLadder(), record: { ...newArenaLadder().record, wins: 40, losses: 2 } }, arenaLeague: joined }).arena;
  assert.deepEqual(g, { title: 'Grand Champion', record: '40 won, 2 lost', banner: 'The Blue Banner' });
  assert.equal(sheetModel({ ...hero, arenaLadder: ladderAfter(newArenaLadder(), { won: true }).ladder }).arena.banner, null, 'no banner, no line for it');
  assert.match(readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8'), /\.\.\.\(m\.arena\.banner \? \[\['Banner', m\.arena\.banner\]\] : \[\]\)/, 'the pause window\'s sheet draws it');
});

test('ARENA3 on the sand: the Herald cries me by my title; the title on the window\'s card and the leaderboard', async () => {
  let L = newArenaLadder();
  for (let i = 0; i < 8; i++) L = ladderAfter(L, { won: true }).ladder;   // two champions beaten: Bloodied
  let t = 1000;
  const said = [];
  const P = { name: 'Aldric', health: 100, maxHealth: 100, arenaLadder: L, arenaLeague: null };
  const A = createArenaBouts({ now: () => t, rng: () => 0.99, playerEntity: P, say: (l) => said.push(l), gameMinutes: () => START });
  A.setStage({ kind: 'floor', centre: () => [0, 0, 0], spawn: async (mobile, feet, o) => ({ mobile, entity: { health: 30, maxHealth: 30, bout: o.bout, items: [] }, ai: { feet: [...feet] } }), remove: () => {}, heightAt: () => null });
  A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(L) });
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 80; i++) { t += 100; A.frame(0.1, { playerFeet: [0, 0, 0] }); }
  assert.ok(said.includes(ARENA_TEXT.call.fighter('Aldric, Bloodied', '')), said.join(' | '));
  // a fighter with no title is cried by name alone
  let t2 = 1000;
  const said2 = [];
  const B = createArenaBouts({ now: () => t2, rng: () => 0.99, playerEntity: { ...P, arenaLadder: newArenaLadder() }, say: (l) => said2.push(l) });
  B.setStage({ kind: 'floor', centre: () => [0, 0, 0], spawn: async (mobile, feet, o) => ({ mobile, entity: { health: 30, maxHealth: 30, bout: o.bout, items: [] }, ai: { feet: [...feet] } }), remove: () => {}, heightAt: () => null });
  B.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(newArenaLadder()) });
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 80; i++) { t2 += 100; B.frame(0.1, { playerFeet: [0, 0, 0] }); }
  assert.ok(said2.includes(ARENA_TEXT.call.fighter('Aldric', '')));
  // the window: the card's title, the leaderboard's Title column
  const gm = START + 100 * MINUTES_PER_DAY;
  const o = { ladder: grandLadder(), league: LG.joinBanner(LG.newArenaLeague(), 'red', gm).league, gameMinutes: gm, name: 'Aldric' };
  assert.equal(AB.arenaHeader(o).title, 'Grand Champion');
  const me = AB.boardsPage(o).pve.rows.find((r) => r.you);
  assert.ok(me, 'a Grand Champion is on the first page of the board');
  assert.equal(me.cells[0], 'Grand Champion');
  assert.equal(me.cells[1], W().allTen);
  assert.deepEqual(AB.ladderPage(o).titles, ARENA_TEXT.titles.slice(0, LADDER_TIERS.length));
  // the Herald names the banner I fight under, or the laurel I wear
  const hc = heraldChoice({ gameMinutes: gm, ladder: grandLadder(), league: o.league });
  assert.ok(hc.lines.includes(ARENA_TEXT.herald.title('Grand Champion')) && hc.lines.includes(ARENA_TEXT.teams.under('the Red Banner')));
  const lau = heraldChoice({ gameMinutes: gm, ladder: grandLadder(), league: { ...o.league, laurel: { banner: 'red', season: 405 } } });
  assert.ok(lau.lines.includes(ARENA_TEXT.teams.laurelYou));
  assert.ok(!heraldChoice({ gameMinutes: gm, ladder: grandLadder() }).lines.some((l) => /Banner|laurel/.test(l)), 'no banner, no word of one');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /healthShare: \(playerEntity\.health \?\? 0\) \/ Math\.max\(1, playerEntity\.maxHealth \?\? 1\), league: playerEntity\.arenaLeague \}\);   \/\/ ARENA3: and the banner/, f);
});
const W = () => ARENA_TEXT.window;
