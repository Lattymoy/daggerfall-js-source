# FIELD BUGS 2026-09-21 — three from Discord

Mac, three screenshots and two words: *"3 bugs"*.

1. SquidKam: *"Guards kill the framerate too / I think thats a sound
   issue right? cause the guards have some null sounds / its an issue in
   current DF / So the fix is easy. Guards are trying to use their 2nd
   and 3rd sounds which are null."*
2. LostMyLeg (maintainer-hub): *"Everytime you go into a dungeon you can
   see 2 Watertiles/textures floating around per player, the console says
   2 Water in every dungeon those need to be excluded for all dungeons.
   Spawned dungeons already have this guard in so it doesnt happen in
   them right now."*
3. Dracula/Valentin: *"yo i got expelled from the mages for some reason /
   could that be a bug / it says i dont have reputation"*

Two of the three carried a diagnosis with them, and both diagnoses were
wrong in the same way: the symptom was real, the named cause was the
nearest thing the reporter could see. The third is not a bug.

---

## PERF-COL1 — the guards, and it was not the sounds

**Read first, measured second.** The watch's sounds are DFU's own row
and a missing clip is cached null once (`audio.js` `_buffer`), so a
null sound costs one Map hit every 3-9 seconds. `tools/guardCostProbe.mjs`
then stood five watchmen on the real AI over the real collider in a
synthetic town and profiled the frame: **85% of 5.5 ms a frame in the
collider's sphere resolve**, which walked every bucket in the world for
every sample with no bounds test - the ray had one since AUDIT NAME1 F2,
the sphere never did. The fix is that test, exact, in both sphere walks;
the probe reads 0.7 ms after it, and the cut reaches every body the
collider moves. The record, the numbers and the differential pin are in
`07-Rendering/Performance-Town.md`.

## WATER-D1 — the water, and the level was never wrong

DFU's water law was fetched and re-read (`SetRDBResourceData`,
`FindMarkers`, `AddWater`) and matches the port line for line; the "2
water" the console prints is the right count. What was wrong was the
ORDER: both dungeon hosts drew the plane after `drawFoes`, whose weapon
overlay is the screen quad that resolves the enhanced-lighting lane's
frame, so from EL3 on the plane landed on the canvas against an empty
depth buffer and showed through every wall - "floating around", and
AIWATER's "well below the floor, in patches" the day before. The draw
lives inside `drawFoes` now, one home for both hosts. Mac's AIWATER skip
for a spawned dungeon stands as he wrote it; its cause is this one, so
whether a spawn gets its water back is his call. The record is in
`07-Rendering/Water-Arc.md`.

## GUILD-REP1 — the expulsion, which is Daggerfall

**No change.** Every law on the path was read against DFU's source,
fetched fresh:

- `Guild.UpdateRank` / `CalculateNewRank` (Guild.cs:74-116): on a guild
  visit 28 days or more after the last rank change, a reputation below
  zero is rank -1, and rank -1 is expulsion with the membership removed.
  `systems/guilds.js` `updateRank` / `baseCalculateNewRank`, verbatim,
  called from `guildServiceFlow.onPushEffects` on every service push.
- `Guild.IsEligibleToJoin` (Guild.cs:319-325): rejoining needs reputation
  at or above zero and the rank-0 skills. `isEligibleToJoin`, verbatim,
  and the refusal a negative reputation earns is the Mages Guild's text
  612 - "it says i dont have reputation".
- What drives a guild's reputation below zero: `Quest.EndQuest`
  (Quest.cs:381-385) bills **-2, propagating** to the questor faction on
  every quest that ends without success - an expired timer included -
  and +5 on success (`quest.js` `endQuest`, QUEST_FAILURE_REP -2); quest
  scripts' own `change repute` lines; and crimes, which reach only the
  region's People faction (`PlayerEntity.LowerRepForCrime` :2291-2299,
  `court.js` `lowerRepForCrime`). `PersistentFactionData.ChangeReputation`
  (:390-435) and `factionRep.js` `changeReputation` agree to the integer
  division (`Math.trunc`, C#'s `/`). `NormalizeReputations` (:2223-2243)
  decays every reputation toward zero once per 161,280 minutes and can
  never cross it (`court.js`, driven from `worldTick.js`'s catch-up).

So a fresh member at reputation 0 who lets ONE guild quest expire sits
at -2, and the next time they push a service 28 days or more after
joining they are expelled and cannot rejoin until the decay or a
successful quest for an allied faction lifts them back to zero. That is
Daggerfall's, and DFU's. Online the world clock runs at twelve times
wall time, so the 28-day gate passes in 56 real hours of the shared
clock and the guild quest timers charge played time (QT-LIVE1) - which
makes an expired quest the likeliest cause for a player who logged out
mid-quest and came back later.

**What to check in his save** if he wants the reason named: the
notebook's finished-quest entries for a Mages Guild quest that ended
without success, and `factionRep` 40 (The Mages Guild) in the envelope,
which will read below zero.

**Console:** not in this build - Mac already answered him.
