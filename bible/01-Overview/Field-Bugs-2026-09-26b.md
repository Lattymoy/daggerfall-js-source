# FIELD BUGS 2026-09-26 (b) — seven from the Discord's bug-reports

Mac, seven threads from the Discord's `#bug-reports`, sent as screenshots
the day the sixteen (`Field-Bugs-2026-09-26.md`) merged:

1. *"Floating sprites"* (Ilvi): *"I encountered a lot of floating sprites
   across Illiac Bay, and I thought if there is a way to drop all of them to
   0 z position in some script that will be added to them?"* - a screenshot
   of flats (a berry bush among them) standing over the grass by a ruin.
2. *"the mages kicked me out before my quest was done"* (KimNix, "Protect an
   Honored Mage": guard Perastyr Baerston at the Mages Guild for 3 hours):
   *"was it because I died or a bug I'm unsure"*; *"the assassins from the
   mission now attack me everywhere i go and spawn every few mins"*; *"the
   quest keeps resting its time"* (35 min left, then 4 days 22 hours).
3. *"Nothing is being credited to my account online"* (DragynDance): *"I
   didn't get credit for closing the oblivion gate in my profile, and I never
   got a founder title despite playing DFE before the cutoff and creating my
   account before the cutoff."*
4. *"Items with vanilla enchants buggy"* (DragynDance): *"Reloading a save
   with an enchanted item equipped makes you lose the enchantment until you
   take it off and put it on again."*
5. *"Rogue imp unable to kill hes in the floorboards"* (Triage, the Mages
   Guild of Wayrest's "Rogue Imp" in Palace of Vanlech Court): *"was able to
   fireball the floor, but it spawns in the floorboards"*.
6. *"quest monster in dungeon disspearing"* (Ashley): *"have to kill a giant,
   its disappearing after a basically random amount of time entering the
   dungeon"*; *"eventually got it after brute forcing it still didnt work
   tho, doesnt count as killed for the quest"*.
7. *"Nudity OFF still shows nudity in some areas"* (Twoddle): *"'show
   Nudity' off still has a few nude characters around, i dont know all the
   areas but temples of kynareth is one. This can be an issue for people
   wanting to stream."*

## ROGUE-IMP: a flying quest foe stands on a building's floor (report 5)

N0B30Y15 (`vendor/dfu-quests/Quests/N0B30Y15.txt`) places its imp - a
FLYING foe - at a QuestSpawn marker of a palace: `place foe _imp_ at
_palace_`. A building's marker is its flat's BASE on the floor
(`world/interiorLayout.js` - an RMB flat stands on its y; the people, the
quest items and the treasure piles all stand on theirs). The building's
marker stand handed it to the pool as a sprite CENTRE - the dungeon's RDB
convention, where a marker is the centre and a flyer's feet hang half its
idle sprite below it (the 2026-09-04 ceiling bats) - so the imp's feet went
half a sprite under the palace floor. A hovering flyer runs no collision, so
nothing lifted it; a blade's line to its middle crossed the floor, and the
quest's shield spells ate the rest.

The building's stand hands the marker over as FEET now, the pool's own
walker hair above it (`scenes/worldModes.js` the interior quest adapter's
standFoe, `INTERIOR_MARKER_FEET_LIFT`): a flyer hangs on the floor, where
DFU's controller recovery leaves it; a walker stands exactly where it did.
The dungeon's stand and CreateFoe's (true centres) are unchanged. The same
fix stands M0B00Y06's and Q0C0XY02's harpies (a house, a tavern).

A save made inside the palace before this keeps the sunk imp (the save holds
its feet); leaving and entering again stands it anew at the marker.

`test/rogueimp.test.js` (2); `tools/mutants/rogueimp.json` 4, 4 dead.
`test/interiorfoes.test.js`'s stand pin re-aimed.

## DEAD-CLOCK: the journal counts down a deadline, not a leftover clock (report 2, the time)

What the player met is N0B20Y02's own script (`vendor/dfu-quests/Quests/N0B20Y02.txt`):

- **The trap.** A click on the sleeping mage is `_S.04_`. It shows message 1012 ("Fool! ... Leave this guild hall now"), hides him, costs 10 reputation, and places a shielded hostile Mage in the hall. That message is the "kicked out". An online death inside the hall also sends a player to the town's edge (D-ONLINE1's respawn).
- **The punishment.** Killing that Mage is `_S.07_`. It creates Knights, Battle-mages and Assassins around the player wherever they are (DFU's `create foe` is never tied to a place) and starts `_S.09_`, seven days that end the quest failed. That is Daggerfall's script, faithfully run.

The port's part is the time. The journal's "Time remains" counts down the tightest running clock, and N0B20Y02 runs three:
- the trance's three hours (`_S.12_`);
- a day and three hours nothing reads (`_oneday_`: `variable _oneday_`, no `when`, no `until`);
- the punishment's seven days (`_S.09_`).

Between the trance and the punishment, the line counted the leftover down, so the time seemed to reset twice.

The line now counts only a clock whose end can change something (`systems/quest/clock.js clockCounts`): the task a finished clock sets (its own name) acts, or a `when` reads it, or an `until ... performed` waits on it. An action the registry could not read counts as an action (`scenes/questBridge.js questLog`).

Open: online, the punishment's seven days are game days PLAYED. The shared clock lets no rest and no travel skip them, so it is about fourteen real hours, with the waves themselves spent after about four. Whether to shorten it online, as Guard the Guild's watch was, is Mac's call.

`test/deadclock.test.js` (3, the real script parsed); `tools/mutants/deadclock.json` 8, 8 dead. Re-aimed: `test/questbridge.test.js` (MAC-K2's mount takes `clockCounts`, and pins a dead clock skipped) and `test/enhancedPause.test.js` (PX22).

## ENCHANT-LOAD: a load keeps what a worn item's enchantments give (report 4)

A quest reward or an item-maker piece carries Daggerfall's own enchantments. Their CONSTANT half is a fold (`systems/enchantments.js computeEnchantmentMods`): EnhancesSkill, StrengthensArmor and WeakensArmor, ExtraSpellPts, AbsorbsSpells, IncreasedWeightAllowance, ImprovesTalents, BadReactionsFrom. The fold is derived state and never saved. Equipping computes it, and so does the magic round.

A load rebuilt the equip table without it (`systems/equip.js rebuildEquipState` fires the listeners, not the enchantment hook), and re-made only the Cast-When-Held bundles (`restartHeldEnchantments`). DFU's constant pass runs every frame; the port's first came at the first magic round, a game minute of unpaused play, which never runs while a window is up. So a player who loaded and opened the sheet saw every such item bare, and taking it off and on was the one thing that folded it. The port's own rarity loot was unaffected: its affixes fold through an equip listener.

`restartHeldEnchantments` now folds the constant effects too, WITHOUT DFU's clamp of magicka to the new maximum. The fold runs before the world has the save's clock back, so an ExtraSpellPts condition (a season, a moon, the undead nearby) can read wrong for that moment, and a clamp there would cut the magicka the save holds. The first round's fold, at the live clock, clamps as DFU does.

Two more of the load's losses, found on the way and fixed with it:
- **Only an item's last Cast-When-Held power stood.** `assignHeldSpell` stripped every pin of the item before casting, once per ROW, so each power took the one before it off, on equip, reroll and load alike. DFU's AssignBundle strips nothing, and RerollItemEffects strips once per item before every row recasts. The port does the same now: the strip is the reroll's and the restore's, once per item.
- **The reroll clock.** `timeEffectsLastRerolled` is saved with the item, and DFU's load keeps it. The restore's recast stamped the host clock instead, read before the load sets the world's, so loading an earlier save held the six-hour reroll back by however long had been played since.

`test/enchantload.test.js` (5); `tools/mutants/enchantload.json` 10, 10 dead. Two SURVTIERS3 cite mutants re-aimed at the lines the cites moved to.

## NATURE-GROUND: a location's trees and bushes stand on the ground (report 1)

A location stands on its pixel's average height: its models, its flats, its people (`scenes/world.js` `locLocal`). The ground is flattened to that height only inside the location's rect (`world/terrainTiles.js` `setLocationTiles`: the tiles under record 56, plus two, three for a city). The band past the rect, out to the pixel's edge, is only EASED toward it (`blendLocationTerrain`). The block's ground scenery and nature flats - trees, bushes, rocks - are laid on every tile, band included, at the plane. Where the ground in the band fell away they hung over it, and where it rose they sank into it. That covers every small location, the ruins and graveyards included, and is worst at the online spawned dungeons, whose pixels were never smoothed. This is DFU's own layout (`RMBLayout.AddNatureFlats` reads no terrain). JAN1 met the same band for the walkers.

A nature flat of the block now stands on the DRAWN ground: the same surface the wilderness's own flats and the grass read (`world/terrainSurface.js` `groundOffPlane`, `buildPixelNow`). The plane is read as the Float32 sample the blend wrote, so inside the rect the lift is exactly 0 and nothing there moves. Everything else a block stands keeps the plane, since a lamp, a sign or an animal may stand on a model. A Ledger A row records the departure.

Not this: World of Daggerfall's ruins place some flats above the ground by the mod's own data (124 of 203 visible flats are authored with a height). Those stand where the mod puts them.

`test/natureground.test.js` (2); `tools/mutants/natureground.json` 6, 6 dead. Two SURVTIERS3 cite mutants re-aimed at the lines the cites moved to.

## SQUEEZE1: a giant taller than its room stands on its floor (report 6)

A foe's capsule is its idle sprite's height (`characters/enemyAnchor.js` `enemyControllerHeight`, SetupDemoEnemy's law), and a giant's is about 3.4 m. A quest giant stands at one of the dungeon's QuestSpawn markers, which are laid for a body the player's size. Under a ceiling lower than itself, the collider's head push had the last word on every pass (`player/collider.js` `_resolveCapsule`). It dragged the lower sphere under the floor, and the too-tight revert (P14's clamp on a rise into a ceiling) sent the body back to where gravity had put it. So the giant sank a hair a frame, for as long as it stood there, and fell out of the level: measured, a 3.6 body under a 3.0 ceiling was at -18 after ten seconds. A doorway's lintel already stopped such a body, like DFU's CharacterController, which never depenetrates through a floor. Only a body already under a low ceiling sank, from the moment it was stood, so whether the player found it depended on how soon they got there.

A body taller than any stance the player takes (`RIDE_HEIGHT`, 2.6) now keeps the floor its lower sphere was set on while its head is held down. Its head stays in the ceiling and it stands, stuck, where it is. The player's four stances never reach the new arm, so their resolve is byte for byte what it was. Every collider, motor and stairs suite passes unchanged (61 files, 690 tests).

What this does not settle: GiantStronghold (dungeon13, B0B40Y09's "Killing a Giant") fills its level with layout giants, and only the quest's one counts ("get the one with the bear claw" - message 1011 shows on the right kill). Online, a joiner's layout foes are the host's, rebuilt when the host's record arrives. B0B40Y09 also ends silently when its clock (2.5x the travel time) runs out. Whether Ashley played online, in a party or offline, and whether the bear-claw message ever showed, is asked.

`test/squeeze1.test.js` (2); `tools/mutants/squeeze1.json` 7, 7 dead.

## GATE-KEYS: the gate's receipt pair is minted by the deploy (report 3, the gate)

An Oblivion Gate's kill is counted by a signature. The relay signs a receipt for each account that earned the kill (`GATE_SIGNING_KEY`, a secret on the relay's Worker), and the account service verifies it with the public half (`GATE_PUBLIC_KEY`) before it writes the row. WB5b left both halves to a person: a tool to mint them (`tools/mintGateKeys.mjs`) and a var shipped empty in `server-account/wrangler.toml`. Nobody minted them. So every receipt went out unsigned, the device drops an unsigned receipt, and no gate anyone closed was ever counted - DragynDance's included. That receipt is gone.

Mac, asked whether the deploy should set the pair: "Yes, add it". The account deploy (`.github/workflows/account-deploy.yml`, "Mint the gate receipt pair if either Worker lacks its half") now asks both Workers for their half. When both are there it leaves them alone, since re-minting would orphan the receipts in flight. Otherwise it mints ONE pair and puts both halves, the relay's first, the private half through a pipe only, as the identity pair's step does. The public half is a secret, not a var: every deploy rewrites a var from the toml, the job cannot commit one, and Cloudflare refuses a secret the name of a bound var. So the toml names none. A later step, "Verify the service holds the gate's public half", claims with a receipt no relay signed and fails the deploy unless the answer is 400 `receipt` rather than 503 `no-gate-key`.

The run that mints redeploys the relay, which drops every connected player once. It runs on the first account deploy after the merge; later deploys find both halves and do nothing.

Open: the Founder title. Its rule is a REGISTERED account (not a guest) with `registered_at` before 2026-09-25T00:00Z. Mac to check DragynDance's row, and to decide whether a guest created before the cutoff and registered after it, or a registration on the evening of 24 September in the Americas, should count.

Answered (FOUNDER3, 2026-09-27, Mac: "we still need to grant everyone the founder title befire the original cut off date"): a guest created before the cutoff and registered after it counts. Founder is read off when the account first played (`created_at`), so every registered account first seen by 2026-09-25T00:00Z holds it. The instant did not move, so an account first seen on the evening of 24 September in the Americas (after 00:00Z) still does not. `06-Systems/Accounts-And-Cloud-Saves-Arc.md` FOUNDER3.

`test/accountdeploy.test.js` (+1: GATE-KEYS), `test/wb5b_gate_claim.test.js` (the toml pin re-aimed: no var of the public half); `tools/mutants/gatekeys.json` 8, 8 dead.

## NUDE-FLATS: Show Nudity reaches the world's people (report 7)

Show Nudity (`ChildGuard/PlayerNudity`) gated the paperdoll's censor welds and the adult quests, which are DFU's only two readers of it. The people Daggerfall stands in the world were never behind it. A Temple of Kynareth stands two of its own (faction 36) as TEXTURE.184 records 11 and 12, "naked blonde woman" and "naked brunette"; Dibella's temples, taverns, houses, the Dark Brotherhood's halls and the witch covens stand more. DFU draws them whatever the setting says. Classic hid them under ChildGard, and FLATS.CFG still marks such a flat with a leading "?"; DFU never ported that half.

A nude figure now draws a clothed stand-in while Show Nudity is off (`characters/nudeFlats.js`). The table is every nude or topless figure in the thirteen NPC archives, found by looking at every record rather than by the mark: the mark misses 179.3 (a coven dancer naked but for a black cowl) and marks seven that are dressed (a halter, a bikini, a corset, blouses), which stay as they are. The stand-in is a dressed adult of the same sex, from the same archive where one fits the role. Only the picture changes. The person keeps the flat they were born as (faction, name, face, caption), the way RR2's variants do, because these are people a player clicks: the Kynareth pair talk, a coven's witches summon Daedra, Azura is a quest's. Every host that draws a person asks: an interior's people, the streaming and one-location exteriors' flats and street NPCs, a dungeon's (on the figure's own feet, since an RDB flat's pivot is its centre), and a quest's stand, including a questor who kept a nude figure's billboard indices from the click. [NUDE-HOSTS, FIELD BUGS 2026-10-05b: two hosts made after this one did not ask - the decorator's Vendors and the Arena's tiers; both ask now, and every billboard host of src/ is named by a sweep (`01-Overview/Field-Bugs-2026-10-05b.md`).] The Kynareth pair also stand in taverns, houses and shops (148 placements between them); 182.34, 182.41 and 182.48 make 340 more, mostly houses.

The Morrowind body had the same hole. Morrowind's own female chest is bare, so a woman in the Morrowind layer (the player's figure and every peer) wore nothing above the waist without a shirt. While Show Nudity is off, a woman whose worn composition leaves the chest skin showing now wears the plainest shirt (`formats/mwItemMap.js` `composeWornModest`): DFU's upper weld, in Morrowind's terms. A man, and a chest a shirt, dress, cloak's robe or cuirass already covers, compose as before. Each body is drawn by the viewer's own setting, as the classic doll is. Pinned against fixtures; not yet seen on a retail Morrowind install.

The setting is read when a scene is built: flipping it redraws the next room or area, not the one standing.

`test/nudeflats.test.js` (6; the FLATS.CFG half under ARENA2_PATH); `tools/mutants/nudeflats.json` 19, 19 dead. Re-aimed: `test/rr2_realism.test.js` (the interior person's draw) and `test/fparm.test.js` (MW-D29's composition call).
