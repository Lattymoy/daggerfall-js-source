# Patch Notes: Wilderness camps and spawned dungeons

## Wilderness camps and packs spawn further away
- Enemy camps and packs now appear 100 to 150 metres from you, instead of 14 to 26. Walking into a new chunk no longer drops a group right behind you.
- They still appear just outside your field of view, so nothing pops in on screen. You come across them; they do not land on you.
- The chance (15% per chunk entered), the group sizes, the shared "one member wakes the rest" behaviour and the online rules are unchanged.
- Camps are placed on the terrain's own surface, so they spawn reliably on hills and slopes at that range.

## Spawned dungeons (online): one pixel, one line, in metres
- You are only told about a spawned dungeon on the map pixel you just walked into. Dungeons on neighbouring pixels are announced when you enter their pixel.
- The message now gives the distance and direction from where you stand, for example: **"You see a Dungeon 410 metres to the North!"**
- A spawned dungeon always sits in the middle of its pixel, so on walking in you are at least 300 metres from it (about 360 metres for the usual one-block dungeon).
- Only dungeons with a one- or two-block exterior are cloned as spawns now. Larger ones would break the 300-metre rule, so they are never picked.
- Where dungeons appear, and for how long, is unchanged: same pixels for every player, same 2-day and 7-day expiry.

## Notes
- The 300-metre rule holds for walking into a pixel. Loading a save or teleporting onto a spawn's pixel can land you closer.
- Offline play is unaffected by the dungeon change (spawned dungeons are online only).
