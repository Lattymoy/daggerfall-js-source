# Leave Guild (LEAVE-GUILD, 2026-10-22)

Asked on the Discord's suggestions channel ("Leave Guild/Faction Option", from 2026-09-30, 27 votes): a way to leave a
guild, a temple or a knightly order by choice. A character keeps one membership a guild group (`guilds.js`
`membershipKey`: one temple, one order), so a player who joined the Knights of the Dragon, or a temple, could never
take another. One player ran their standing with an order down to -92, and the order still kept them. Others asked for
it so they could change temples.

## DFU, and the mod that answers it

Daggerfall Unity has no door out. Its one way out of a guild is `GuildManager.RemoveMembership`
(GuildManager.cs:128-144), and it calls it only at an expulsion (`Guild.UpdateRank`). The port has it as `leaveGuild`
(`guilds.js`), and `updateRank` calls it in the same place (`06-Systems/Systems-Arc.md`, EXPULSION REMOVES THE
MEMBERSHIP).

Standalone DFU answers with a mod: **Leave Guild** (Nexus Mods, Daggerfall Unity mod 588). Its page says it puts a
button on the guild NPC's popup ("talk to a guild member and there you'll find a new improvised button"), with no
penalty by default. A setting can take reputation, and is off by default. It remembers the rank, and gives it back
when the player joins again. Its author did not test it with the Thieves Guild or the Dark Brotherhood.

## The law (`systems/guild/leaveGuild.js`)

- **The row stands for a member of THIS guild** (`leaveOffered`: `membershipOf`, not the guild group's slot). A priest
  of Arkay's temple standing at Mara's popup is not offered Mara's way out. The row is on the service popup, on both
  skins: on the classic skin under every other row the port draws there (`leaveRect`, the Reforge's shape and dress -
  `ui/guildServiceWindow.js`), its key Q; on the Enhanced Plus face, last of the actions
  (`ui/enhanced/enhancedPorts.js`). Its words are "Leave Temple", "Leave Order" or "Leave Guild" (`leaveRowLabel`).
- **A Yes/No box asks** (`leaveGuildText.ask`). Its Yes is `leaveGuild`: the membership is dropped exactly as an
  expulsion drops it, and nothing else happens. There is no record 668 and no squad (RR1's `_onExpelled` is the
  expulsion's alone). A farewell box says it, and closes the popup.
- **The reputation stays**, as the mod's default. The guild can be joined again at its door, by DFU's own Join
  (`joinDecision`, `joinGuild`): rank 0, today's date.
- **The Thieves Guild and the Dark Brotherhood are not left this way.** They take nobody at the door
  (`INVITATION_ONLY`), so their halls have no door out either.
- **Online, a chair holds a member** (ranks 8 and 9, the chapters' chairs, won at the Turning -
  `11-Multiplayer/Chapters-Arc.md` 3.5). `rollPaceOf` (`net/npcRollTracker.js`) now also says `seated`: the character
  holds a chair of the guild in any region (true), none (false), or the Roll has not said yet (null). A chair refuses
  the leave (`leaveGuildText.seated`), and an unheard Roll asks the player to try again (`unheard`). The Yes asks
  again, so a chair given while the box stood still counts. Offline there is no Roll and no chair.
- **The Roll learns it the usual way.** A claim carries the memberships the book holds (`rollMembersOf`), and the
  service ends the tenure of one that is gone (`server-account/src/npcRoll.js`, "ended when it leaves") - the path an
  expulsion already takes. Nothing new goes on the wire.

What it does not touch: the active book alone is changed (the vampire-aware one, `activeMemberships` - the book the
join writes); quests the guild gave stay as they are, as at an expulsion; nothing a rank gave is taken back (a knightly
order's armour and house, as at an expulsion).

## The departures (Ledger A, the LEAVE-GUILD row)

1. **A member can leave a guild by choice.** DFU has no such door. The shape is DFU's Leave Guild mod's.
2. **The rank is not given back on a return.** The mod remembers it. The port joins by DFU's own Join, at rank 0.
3. **No reputation setting.** The mod's default (no penalty) is the port's law.
4. **Not the underworld guilds, and online not while a chair is held.** The mod offers it everywhere it finds a
   membership.

## THE FOUR HOSTS

`scenes/worldModes.js` is wired: the guild popup's one line (`leaveGuildHooks`, positional, so the host grows one
logical line). It is the popup's only home, and both `scenes/world.js` (the streamed world, with the Roll) and
`scenes/exterior.js` (the fixed city, offline: no Roll, so no chair) reach it through `createWorldModes`.
`scenes/dungeonContext.js` is FLAGGED and needs nothing: it stands no guild hall.

## Pins

- `test/systems/guild/leaveguild.test.js` (6): the row and its words, the decision, the Roll's word on the chairs,
  the box and its Yes, the classic popup's row and key and the Plus face, and the host's line.
- `tools/mutants/leaveguild.json`: 18, all dead.
- Moved on purpose: `test/ui/audit26_uiwindows.test.js` F141 (the popup's click sounds, seven to eight, the leave
  row's pinned beside the others); `tools/mutants/loot16.json` LOOT16-popup-key-over-dfu re-aimed by content (the
  hotkey line now ends in the leave key).

The words are the text core's (`guild.leave.*`, L10N4): `locales/en` is read off the source, and the thirteen whole
languages carry drafts through `tools/l10nInSession.mjs`, recorded as machine drafts.
