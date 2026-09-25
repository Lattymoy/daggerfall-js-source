// DISC25-D (2026-09-25, Sir McMobdon on Discord, the general chat: "Assumed it was cause I wasn't a part of same guild I
// couldn't receive the quest. But I checked i am In guild. Still cant get quest shared"; and "Guard the guild quest -
// Can't be done online", Malentor: "They did for me, but I had to wait the entire duration of time that the quest
// mentions - fast forwarding by loitering isn't a possibility in online mode").
//
// "Guard the Guild" is N0B10Y03, a MAGES GUILD quest; the player is a member of the Temple of Julianos. QUEST1's gate
// refused them rightly and said only "not a member of the guild this quest requires" - no use to someone who IS in a
// guild. The refusal names the guild now. And the Online pane still said "the quest clocks stand still", false since
// WORLD7; the rest of the report (a quest that waits for an hour of the day, under a clock a rest cannot move) is the
// shared clock's own law, said plainly now on the pane - the fast-forward itself is Mac's call (RESTX2 decided it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canReceiveSharedQuest, shareRefusalText, SHARE_REFUSAL_TEXT, SHARE_GUILD_NAMES } from '../src/systems/questShare.js';
import { GUILDS } from '../src/systems/guilds.js';
import { MEMBERSHIP_STATUS } from '../src/systems/quest/questLists.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const machine = { hasFinishedSharedCopy: () => false, hasFinishedSharedQuestNamed: () => false, hasActiveQuestNamed: () => false, hasSharedQuestNamed: () => false };
/** The catalog row a guild quest has: its scope, its group, its membership column (QuestList-Classic's own shape). */
const listsFor = (guild) => ({
  findQuestMeta: () => ({ scope: 'guild', group: guild.guildGroup, quest: { membership: MEMBERSHIP_STATUS.Member, oneTime: false } }),
  hasAcceptedOneTime: () => false,
});

test('DISC25-D: a guild quest refused to a non-member names the guild - a temple member is told it is the Mages Guild\'s', () => {
  // N0B10Y03's row: a Mages Guild quest. The receiver has joined the Temple of Julianos and nothing else.
  const temple = { 'Temple:Julianos': { guild: 'Temple:Julianos', rank: 0 } };
  const r = canReceiveSharedQuest(machine, listsFor(GUILDS.MagesGuild), 'N0B10Y03', { memberships: temple });
  assert.deepEqual(r, { ok: false, reason: 'guild', guild: 'MagesGuild' });
  assert.equal(shareRefusalText(r), 'are not a member of the Mages Guild, which this quest requires.');
  // every guild a catalog row can name has a name to be said by
  for (const g of Object.values(GUILDS)) assert.ok(SHARE_GUILD_NAMES[g.name], `${g.name} is said`);
  // a member passes, as before
  const mage = { [GUILDS.MagesGuild.guildGroup]: { guild: 'MagesGuild', rank: 1 } };
  assert.equal(canReceiveSharedQuest(machine, listsFor(GUILDS.MagesGuild), 'N0B10Y03', { memberships: mage }).ok, true);
  // every other refusal is the fragment it always was; a guild refusal with no guild falls back to it
  assert.equal(shareRefusalText({ reason: 'active' }), SHARE_REFUSAL_TEXT.active);
  assert.equal(shareRefusalText({ reason: 'guild' }), SHARE_REFUSAL_TEXT.guild);
  assert.equal(shareRefusalText({ reason: 'nonsense' }), null);
  // and the receiver's line is built from it
  assert.match(rd('src/scenes/world.js'), /const why = shareRefusalText\(result\);/);
  assert.doesNotMatch(rd('src/scenes/world.js'), /const why = SHARE_REFUSAL_TEXT\[result\.reason\];/);
});

test('DISC25-D: the Online pane says what the shared clock does to a quest - and no longer that the quest clocks stand still', () => {
  const menu = rd('src/ui/enhancedMenu.js');
  assert.doesNotMatch(menu, /the quest clocks stand still/, 'false since WORLD7: quest clocks count played time');
  assert.match(menu, /a quest that waits for an hour of the day waits for that hour of the world\. Quest timers run while you play\./);
  // the law the sentence says: online a quest clock charges played time (WORLD7), and a rest moves no world time
  assert.match(rd('src/systems/quest/clock.js'), /export const PLAYED_STEP_MAX_SECONDS = 30 \* 60;/);
});
