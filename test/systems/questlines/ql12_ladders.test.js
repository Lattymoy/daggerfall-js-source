// QL12 (bible/06-Systems/Questlines-Arc.md section 4.4): THE GUILDS' LADDERS - each guild the player is a member of, read
// as a line of its own quests by the rank that opens them (systems/questlines/qlLadders.js): read off the membership
// book, the classic list's rows and the layer's record of what finished well - nothing new kept. And the window's page
// (ui/questlines/qlJournal.js qlLadderDetail) says what a ladder is, strikes what is done and marks a choice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ladders, guildOfMembership } from '../../../src/systems/questlines/qlLadders.js';
import { qlLadderDetail } from '../../../src/ui/questlines/qlJournal.js';
import { GUILD_GROUPS } from '../../../src/formats/factionFile.js';
import { fakePage } from '../../hudPage.mjs';

const FG = GUILD_GROUPS.FightersGuild;
const pools = new Map([[FG, [
  { name: 'M0B00Y06', membership: 'M', minReq: 0 },
  { name: 'M0B00Y16', membership: 'M', minReq: 0 },
  { name: 'M0B20Y02', membership: 'M', minReq: 2 },
  { name: 'M0B60Y10', membership: 'M', minReq: 6 },
  { name: 'M0C00Y11', membership: 'N', minReq: 0 },    // a non-member's - no rung of a member's ladder
  { name: 'M0B11Y18', membership: 'M', minReq: 15 },   // a reputation floor - no rung
]]]);

test('QL12 a guild\'s ladder: a member\'s rows by rank, promotions reached, the finished struck, the flagship marked', () => {
  const memberships = { [FG]: { guild: 'FightersGuild', rank: 2 } };
  const [l] = ladders({ memberships, pools, history: { M0B00Y06: 'done' } });
  assert.equal(l.key, 'FightersGuild');
  assert.equal(l.factionId, 41);
  assert.equal(l.rank, 2);
  assert.deepEqual(l.rungs.map((r) => [r.rank, r.reached]), [[0, true], [2, true], [6, false]]);
  assert.deepEqual(l.rungs[0].quests.map((q) => [q.name, q.done, q.flagship]), [['M0B00Y06', true, false], ['M0B00Y16', false, true]]);
  assert.ok(l.rungs.every((r) => r.title && typeof r.title === 'string'), 'each rung its rank\'s title');
  assert.equal(l.rankTitle, l.rungs[1].title);
});

test('QL12 no ladder for a guild the player only knows, nor for a book that is empty', () => {
  assert.deepEqual(ladders({ memberships: {}, pools }), []);
  assert.deepEqual(ladders({ memberships: { [FG]: { guild: 'FightersGuild', rank: -1 } }, pools }), [], 'not a member');
  assert.equal(guildOfMembership({ guild: 'Temple:Arkay' })?.name, 'Temple:Arkay');
  assert.equal(guildOfMembership({ guild: 'Nobody' }), null);
});

test('QL12 the ladder\'s page: what a ladder is, the rank held, each rung, the done struck and the choice explained', () => {
  const doc = fakePage();
  const box = qlLadderDetail(doc, { name: 'The Fighters Guild', rankTitle: 'Apprentice', rungs: [
    { rank: 0, title: 'Initiate', reached: true, quests: [{ name: 'M0B00Y06', title: 'Wild Animal', done: true, flagship: false }] },
    { rank: 6, title: 'Guardian', reached: false, quests: [{ name: 'M0B60Y10', title: 'Summoner', done: false, flagship: true }] },
  ] });
  const text = box.textContent;
  assert.match(text, /A guild.s own quests, by the rank that opens them/);
  assert.match(text, /Your rank: Apprentice/);
  assert.match(text, /Guardian \(not yet\)/);
  const rows = box.querySelectorAll('.px-qobj-row');
  assert.deepEqual(rows.map((r) => r.className.split(' ')[1]), ['done', 'next']);
  // AUDIT QUESTLINES UI-12 (PIN MOVED): the mark explained on a hover alone - no press, no pad; the page says it once
  assert.equal(rows[1].querySelector('.px-qobj-tag').textContent, 'a choice');
  assert.match(text, /A quest marked “a choice” asks you to choose, and ends differently for each choice\./);
});

test('AUDIT QUESTLINES LINES-5, LINES-14, LINES-15, LINES-16: a rung is reached while the guild OFFERS it - by level for the Mages Guild and the knightly orders (questRankFor), by rank for the rest; a knightly order\'s ladder; a temple\'s own divine\'s quests on its ladder; an adult row only while the setting allows one (mutants: the level; the orders\' prefix; the divine\'s rows; the adult filter)', () => {
  const MG = GUILD_GROUPS.MagesGuild;
  const KO = GUILD_GROUPS.KnightlyOrder;
  const HO = GUILD_GROUPS.HolyOrder;
  const mpools = new Map([
    [MG, [{ name: 'N0B00Y08', membership: 'M', minReq: 0 }, { name: 'N0B40Y07', membership: 'M', minReq: 4 }, { name: 'N0B60Y01', membership: 'M', minReq: 6 }]],
    [KO, [{ name: 'B0B00Y00', membership: 'M', minReq: 0 }, { name: 'B0B40Y08', membership: 'M', minReq: 4 }]],
    [HO, [{ name: 'C0B00Y02', membership: 'M', minReq: 0 }, { name: 'D0B00Y00', membership: 'T', minReq: 0 }, { name: 'D0B00Y01', membership: 'A', minReq: 0 }]],
    [FG, [{ name: 'M0B00Y06', membership: 'M', minReq: 0 }, { name: 'M0B1XY01', membership: 'M', minReq: 1, adult: true }]],
  ]);
  // the Mages Guild offers by level: an Apprentice (rank 1) of level 5 reaches the rank-4 rung, not the rank-6 one
  const [mg] = ladders({ memberships: { [MG]: { guild: 'MagesGuild', rank: 1 } }, pools: mpools, level: 5 });
  assert.deepEqual(mg.rungs.map((r) => [r.rank, r.reached]), [[0, true], [4, true], [6, false]], 'level 5 offers rank 4');
  const [fg] = ladders({ memberships: { [FG]: { guild: 'FightersGuild', rank: 0 } }, pools: mpools, level: 30 });
  assert.deepEqual(fg.rungs.map((r) => [r.rank, r.reached]), [[0, true]], 'the Fighters Guild by rank alone - and its adult row left out');
  const [fga] = ladders({ memberships: { [FG]: { guild: 'FightersGuild', rank: 0 } }, pools: mpools, level: 30, adult: true });
  assert.deepEqual(fga.rungs.map((r) => [r.rank, r.reached, r.quests.map((q) => q.name)]), [[0, true, ['M0B00Y06']], [1, false, ['M0B1XY01']]], 'the setting on: the adult row');
  // a knightly order: its own ladder, by level too
  const [ko] = ladders({ memberships: { [KO]: { guild: 'Order:Raven', rank: 0 } }, pools: mpools, level: 4 });
  assert.equal(ko?.key, 'Order:Raven', 'an order\'s ladder');
  assert.deepEqual(ko.rungs.map((r) => [r.rank, r.reached]), [[0, true], [4, true]]);
  // a temple of Akatosh: its members' rows and Akatosh's own, never Arkay's
  const [ho] = ladders({ memberships: { [HO]: { guild: 'Temple:Akatosh', rank: 0 } }, pools: mpools });
  assert.deepEqual(ho.rungs[0].quests.map((q) => q.name), ['C0B00Y02', 'D0B00Y00']);
});
