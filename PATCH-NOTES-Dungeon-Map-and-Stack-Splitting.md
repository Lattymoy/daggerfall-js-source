# Patch Notes: The dungeon map, stack splitting and Discord fixes

## Enhanced dungeon map
- Fewer, fuller floors. Levels that never lie over one another now share one page, so a dungeon no longer breaks into a dozen scraps. Privateer's Hold goes from 13 floors to 9, the Crypts of Gharcen from 8 to 3. Where a dungeon really does stack, it stays stacked.
- Stairs are drawn. Each flight shows three treads and an arrow pointing up it. A stair to another floor is labelled, for example "up to Floor 3" or "down to Floor 1". If the label would land under a hand or on another label, it only shows when you hover.
- Click a stair to go to the floor it leads to. The view stays where it is, so the other end of the stair is under your pointer.
- Stairs no longer have a wall drawn across them.
- Long ramps no longer skip a floor. Each patch of floor goes on the level its own surface is nearest.
- The floor list stops above your right hand. If there are more floors than fit, click the chevron row to scroll to the next one. The list marks the floor you are on and the floor with the way out, and shows floors you haven't explored yet in faint ink.
- The bottom of the map lists the controls: drag to pan, scroll to zoom, PgUp/PgDn for floors, click a stair to take it, Esc to close. The arrow keys still pan.
- A note you add on a split level goes on the floor under your pointer.

## Retro mode
- The held map and the hands holding it now stay inside the 4:3 picture. They no longer spill over the black bars.

## Stack splitting
- Enhanced inventory and enhanced shop: a "how many" box sits beside the button that moves a stack. It starts at the full amount, so a plain click still moves the whole stack. Change the number to move only part of it. This works for buying, selling and taking back items.
- Classic inventory and classic shop: hold Ctrl while moving a stack to be asked "Pick how many items (max N)?", as in Daggerfall Unity. You are also asked when only part of a stack can move, for example because of your weight limit.
- If you enter a number that isn't valid, nothing moves.

## Letters
- While you write a letter, your keys no longer move or jump your character, and pressing F no longer closes the letter.

## Online
- If a shared quest is refused because you're in the wrong guild, the message now names the guild the quest needs, for example: "are not a member of the Mages Guild, which this quest requires."
- The Online settings page no longer says that quest clocks stand still. It now explains that a quest waiting for a set hour waits for that hour on the shared world clock, and that quest timers run while you play.

## Notes
- Guard the Guild online: the thieves do spawn, but only between 00:00 and 03:00 game time. On the shared clock that is about 15 real minutes out of every 2 real hours, and loitering can't skip ahead online. A way to fast-forward is still being decided.
- Guild missing from standings: we couldn't reproduce this. Temple memberships do show under Guilds on the Standing page. A screenshot would help us track it down.
- Discord Rich Presence isn't in this update. It needs a Discord application set up for the game first.
