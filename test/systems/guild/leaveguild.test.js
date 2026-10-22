// LEAVE-GUILD (2026-10-22) - A MEMBER LEAVES A GUILD BY CHOICE.
//
// Daggerfall has no way out of a guild but an expulsion (GuildManager.RemoveMembership, GuildManager.cs:128-144), and a
// character keeps one temple and one knightly order - so a player in the wrong one stayed there. The Discord asked
// ("Leave Guild/Faction Option"), and standalone DFU's answer is a mod, Leave Guild (Nexus, Daggerfall Unity mod 588):
// a row on the guild NPC's popup, no penalty. bible/06-Systems/Leave-Guild.md; the mutants are tools/mutants/leaveguild.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  leaveRowLabel, leaveOffered, leaveDecision, leaveGuildText, leaveGuildHooks, LEAVE_KEY,
} from '../../../src/systems/guild/leaveGuild.js';
import { GUILDS, joinGuild, hasJoined, membershipOf, activeMemberships } from '../../../src/systems/guild/guilds.js';
import { templeOf, orderOf } from '../../../src/systems/guild/guildVariants.js';
import { rollPaceOf } from '../../../src/net/npcRollTracker.js';
import { GuildServiceWindow, PANEL_X, PANEL_Y, _setGuildServiceArtForTests } from '../../../src/ui/guildServiceWindow.js';
import { PORT_SPECS } from '../../../src/ui/enhanced/enhancedPorts.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const DAY = { year: 405, month: 0, day: 0 };
/** A fresh character's active book, a member of each guild given. */
function bookWith(...guilds) {
  const book = activeMemberships({});
  for (const g of guilds) joinGuild(book, g, DAY);
  return book;
}

test('LEAVE-GUILD the row: a member of THIS guild that takes members at its door - never another temple\'s member, never the Thieves Guild or the Dark Brotherhood; a temple and an order are not called guilds (mutants: any member of the group offered; the underworld offered)', () => {
  const arkay = templeOf('Arkay'), mara = templeOf('Mara'), dragon = orderOf('Dragon');
  const book = bookWith(arkay, GUILDS.MagesGuild, dragon, GUILDS.ThievesGuild, GUILDS.DarkBrotherhood);
  assert.equal(leaveOffered(book, arkay), true);
  assert.equal(leaveOffered(book, mara), false, 'an Arkay priest at Mara\'s temple is not Mara\'s to let go (the group\'s slot is Arkay\'s)');
  assert.equal(leaveOffered(book, GUILDS.MagesGuild), true);
  assert.equal(leaveOffered(book, GUILDS.FightersGuild), false, 'no membership, no row');
  assert.equal(leaveOffered(book, dragon), true);
  assert.equal(leaveOffered(book, GUILDS.ThievesGuild), false, 'INVITATION_ONLY: no door in, no door out here');
  assert.equal(leaveOffered(book, GUILDS.DarkBrotherhood), false);
  assert.equal(leaveOffered(book, null), false);
  assert.deepEqual([leaveRowLabel(arkay), leaveRowLabel(dragon), leaveRowLabel(GUILDS.MagesGuild), leaveRowLabel(GUILDS.FightersGuild)],
    ['Leave Temple', 'Leave Order', 'Leave Guild', 'Leave Guild']);
  assert.equal(LEAVE_KEY, 'KeyQ');
});

test('LEAVE-GUILD the decision: offline nothing holds a member back; online a chair of the guild does, and a Roll not yet heard is not yet a no (mutants: a chair ignored; the unheard Roll read as no chair)', () => {
  const book = bookWith(GUILDS.FightersGuild);
  const f = GUILDS.FightersGuild;
  assert.equal(leaveDecision(book, f, null), 'ok', 'offline: no Roll, no chair');
  assert.equal(leaveDecision(book, f, { seated: false }), 'ok');
  assert.equal(leaveDecision(book, f, { seated: true }), 'seated');
  assert.equal(leaveDecision(book, f, { seated: null }), 'unheard');
  assert.equal(leaveDecision(book, f, {}), 'unheard', 'a pace that says nothing of the chairs is not a no');
  assert.equal(leaveDecision(book, GUILDS.MagesGuild, null), 'notMember');
});

test('LEAVE-GUILD the Roll\'s word on the chairs: a chair of the guild in any region; none; or not yet heard (mutants: the chair matched by region; the unheard Roll answered)', () => {
  const tracker = (held, seats) => ({ stopped: null, held, seats, standing: () => (held ? { rep: 40, since: 1 } : null) });
  const F = GUILDS.FightersGuild.factionId, M = GUILDS.MagesGuild.factionId;
  const seats = [{ f: F, region: 17, seat: 'officer' }];
  assert.equal(rollPaceOf(tracker(true, seats), F, 100).seated, true, 'a chair in another region is still a chair of the guild');
  assert.equal(rollPaceOf(tracker(true, seats), M, 100).seated, false, 'another guild\'s chair is not this one\'s');
  assert.equal(rollPaceOf(tracker(true, []), F, 100).seated, false);
  assert.equal(rollPaceOf(tracker(false, undefined), F, 100).seated, null, 'before the Roll\'s first word');
  assert.equal(rollPaceOf(null, F, 100), null, 'offline: no pace at all');
});

test('LEAVE-GUILD the box: a Yes/No question, the membership dropped on its Yes and nothing else - the farewell closes the popup, the guild may be joined again at rank 0; a chair won while the box stood still holds; the refusals said (mutants: the Yes not dropping it; the Yes not asking again; the farewell not closing)', () => {
  const dragon = orderOf('Dragon');
  const entity = {};
  const book = activeMemberships(entity);
  joinGuild(book, dragon, DAY).rank = 6;
  let seated = false;
  const hooks = leaveGuildHooks(book, dragon, 'The Knights of the Dragon', () => ({ seated }));
  assert.equal(hooks.leaveRow(), 'Leave Order');
  const ask = hooks.leave();
  assert.equal(ask.buttons, 'YesNo');
  assert.deepEqual(ask.rows.map((r) => r.text), leaveGuildText.ask('The Knights of the Dragon'));
  assert.equal(ask.rows[0].text, 'Do you wish to leave the Knights of the Dragon?', 'the faction\'s name, mid-sentence');
  assert.ok(!ask.closesWindow, 'the question keeps the popup');
  // a chair given while the box stood (a Turning's word): the Yes asks again
  seated = true;
  assert.deepEqual(ask.onYes().rows.map((r) => r.text), [leaveGuildText.seated('The Knights of the Dragon')]);
  assert.equal(hasJoined(book, dragon), true, 'still a member');
  seated = false;
  const bye = ask.onYes();
  assert.deepEqual(bye.rows.map((r) => r.text), ['You are no longer a member of the Knights of the Dragon.']);
  assert.equal(bye.closesWindow, true);
  assert.equal(hasJoined(book, dragon), false, 'the membership is gone');
  assert.equal(membershipOf(book, dragon), null);
  assert.equal(hooks.leaveRow(), null, 'the row goes with it');
  assert.deepEqual(hooks.leave().rows.map((r) => r.text), ['You are not a member of the Knights of the Dragon.']);
  assert.equal(joinGuild(book, dragon, DAY).rank, 0, 'joined again: DFU\'s own Join, rank 0');
  // the refusals as boxes
  seated = true;
  assert.deepEqual(hooks.leave().rows.map((r) => r.text), ['You hold a chair of the Knights of the Dragon. You cannot leave while you hold it.']);
  seated = null;
  assert.deepEqual(hooks.leave().rows.map((r) => r.text), [leaveGuildText.unheard()]);
  // no name off the faction file: "this guild"
  const anon = leaveGuildHooks(bookWith(GUILDS.MagesGuild), GUILDS.MagesGuild);
  assert.equal(anon.leave().rows[0].text, 'Do you wish to leave this guild?');
});

test('LEAVE-GUILD the classic popup: the row under every other port row, its key Q only where it stands; Yes leaves, the farewell closes; the Plus face lists it last (mutants: the row\'s rect not stacked; the key without the row)', () => {
  _setGuildServiceArtForTests({ base: { w: 130, h: 51 }, member: { w: 130, h: 51 } });
  try {
    const log = [];
    let left = false;
    const ask = { rows: [{ text: 'leave?', center: true }], buttons: 'YesNo', onYes: () => { left = true; log.push('yes'); return { rows: [{ text: 'bye', center: true }], closesWindow: true }; } };
    const hooks = (extra) => ({ member: () => true, service: () => 'Training', rows: () => [], steps: () => [], onClose: () => log.push('close'), leaveRow: () => (left ? null : 'Leave Guild'), leave: () => { log.push('leave'); return ask; }, ...extra });
    // alone: the Reforge's place, y 53 under the panel
    const mid = (y) => [PANEL_X + 5 + 60, PANEL_Y + y + 5];
    const w = new GuildServiceWindow(hooks({}));
    assert.equal(w.click(...mid(53)), true);
    assert.deepEqual(log, ['leave']);
    assert.equal(w.top.buttons, 'YesNo');
    w.input('KeyY');
    assert.deepEqual(log, ['leave', 'yes']);
    assert.equal(w.top.rows[0].text, 'bye');
    assert.equal(w.done, false, 'the farewell stands first');
    w.input('Enter');
    assert.equal(w.done, true, 'and closes the popup');
    assert.deepEqual(log, ['leave', 'yes', 'close']);
    // under the Reforge's row and Heal Curse's: two rows down, 77
    left = false; log.length = 0;
    const stacked = new GuildServiceWindow(hooks({ reforge: () => ({ dispatched: true }), healCurse: () => ({ rows: ['h'] }) }));
    assert.equal(stacked._rowsAbove(), 2);
    stacked.click(...mid(77));
    assert.deepEqual(log, ['leave'], 'the leave row is the third');
    const one = new GuildServiceWindow(hooks({ healCurse: () => ({ rows: ['h'] }) }));
    one.click(...mid(65));
    assert.deepEqual(log, ['leave', 'leave'], 'under Heal Curse alone, the second');
    // the key: Q where the row stands, nothing where it does not
    log.length = 0;
    new GuildServiceWindow(hooks({})).input(LEAVE_KEY);
    assert.deepEqual(log, ['leave']);
    const none = new GuildServiceWindow(hooks({ leaveRow: () => null }));
    none.input(LEAVE_KEY);
    assert.equal(none.click(...mid(53)), false, 'no row, nothing to press');
    assert.deepEqual(log, ['leave']);
    // the Plus face: last of the actions, the row's own words
    const face = (h) => PORT_SPECS.guild.view(new GuildServiceWindow(hooks(h))).blocks.at(-1).items.map((a) => a.label);
    assert.deepEqual(face({}), ['Talk', 'Training', 'Leave Guild']);
    assert.deepEqual(face({ leaveRow: () => 'Leave Temple' }), ['Talk', 'Training', 'Leave Temple']);
    assert.deepEqual(face({ leaveRow: () => null }), ['Talk', 'Training']);
    // the draw: the row under the others, in the Reforge's dress
    const win = read('src/ui/guildServiceWindow.js');
    assert.ok(win.includes('const [lx, ly, lw, lh] = leaveRect(this._rowsAbove());'));
    assert.ok(win.includes('shadowText(renderer, font, leaveRow, m, PANEL_X + lx, PANEL_Y + ly + 2, { align: \'center\', w: lw });'));
  } finally { _setGuildServiceArtForTests(null); }
});

test('LEAVE-GUILD the host: the popup wired in its one line, on the hall\'s active book, the faction\'s name and the Roll\'s word for this guild', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.ok(wm.includes("      ...leaveGuildHooks(memberships, guild, orderName, () => host.rollPace?.(guild.factionId) ?? null),"));
  assert.ok(wm.includes("    const memberships = activeMemberships(playerEntity);   // V2e: the vampire-aware book"), 'the book the join writes');
  assert.ok(read('src/scenes/world.js').includes('    rollPace: (f) => rollPaceOf(rollTracker, f, Math.floor(Date.now() / 1000)),'), 'the Roll\'s pace, chairs and all');
});
