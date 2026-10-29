# AUDIT HELM-SIGHT - FIELD BUGS 2026-10-27 read cold, 2026-10-27

The owner: *"Audit this"*, of `b56296490` - FIELD BUGS 2026-10-27 (`../bugs/Field-Bugs-2026-10-27.md`): the report
"Sailing Vessels Sometimes Have No Propulsion" read again, found already fixed by SAIL-WIND, and HELM-SIGHT, a second way
to the same stop. Three cold lanes read the commit at its head, each in its own worktree, each given the files and one
brief (what to hunt, how to prove it), never a conclusion. Each finding was proven on the real code - a probe on the real
runtime, a test that fails at the head, or quoted lines and their order - before it was reported, and proven again here.

| Lane | Read | Found |
|---|---|---|
| A | the runtime law: every flow that reaches OnWorldReanchored or a helm's let-go, from `world.js` - fast travel alone and as a party's follower, both landings; jumps, loads, deaths, the ether crossing - and every reader of a boat's sight and pixel (the wire, the pool, the naval host, the compass, the loops' frame), head against base | 4 |
| B | the report again, cold: every way a boat with her sails set makes no way while her oars row, at the head; SAIL-WIND and HELM-SIGHT tested as claims on every load path; a drive of its own | 1 |
| C | the pins, the mutants and the record: what each assertion holds, mutants the pins let live, every number re-measured at head and base, every quoted claim against the code, the gates | 7 |

Twelve found, two of them twice (A2 is C3, A4 is C4). Every defect is fixed or its record corrected. Each fix in code
carries an `AUDIT HELM-SIGHT <id>` comment and is pinned by a test that fails on the code as it stood
(`test/systems/comeSailAway/audit_helmsight.test.js`, `test/scenes/audit_helmsight_world.test.js`), with mutants the
pins kill in `tools/mutants/audit_helmsight.json` (11, all dead, after the fold below). The commit's own lists were re-aimed and run again:
`fb1027_helmsight.json` 5 of 5 dead, `field_csa1.json` 14 of 14. Lane C's four survivors, re-aimed, die (3, 1, 6 and 4
failing).

Lane B's verdict stands first: nothing at the head can still make the screenshots. They are SAIL-WIND's - under the
Responsive helm only a wind of exactly nought leaves her sails set and drawing nothing while her oars row - and SAIL-WIND
covers every load path (`worldQuickLoad`, the online wake below ground, a restore held until the models load, the exit
save). Its own scratch drive found nothing at the head, and on the base it found HELM-SIGHT; the counts kept here are the
committed drive's (below).

## Lane A - the runtime law

**A1 (should-fix; at the base too). A party's journey to a pixel this client does not stream never let the helm go.**
The leader stands where the follower's world does not stream (TAMRIEL2's land is each player's own setting), and
`_teleportToPixel` takes the landing's word away there
(`world.js:"if (unstreamed) { px = unstreamed.px; py = unstreamed.py; localPos = null; resolveArrival = null; }"`) - the
only place a party's journey lets go. The fare was paid, and when the arrival's hold lifted the helm pinned the player
back at the departure. The teleport core's one `csaPreJump` and its pins stand. The fix stands in the runtime (below,
THE FOLD).

THE FOLD (into #1184, 2026-10-28). The audit first let the helm go in `fastTravelTo`'s party arm, after the jump. Folded
into the Tamriel branch, whose bootWorld had no room for it, the fix moved, and moving it found it had fixed nothing:
StopSailing sets the player down at her helm, as the C# sets a helmsman down, so a let-go after the landing took them
back to the departure all the same, no longer sailing. Its pins could not see it - the transaction stub's StopSailing
moves no one, and the runtime pin stood the player at the landing after the let-go.

Now the runtime lets go: a helm still held from another pixel when the mod's frame runs again is one no landing let go
(`comeSailAway.js:"if (state.CurrentBoat?.helmAfar && isSailing()) OnPreFastTravel();"`), and a let-go from afar leaves the
player where the jump set them (`stopSailingTail`). World.js holds the mod's frame through a party's wait, so a landing
still to come lets go first. Pinned with the player measured after the frame (`audit_helmsight.test.js`), the frame held
through the wait (`audit_helmsight_world.test.js`), and the journey ending with the helm held and the frame free
(`partyArrivalTransaction.test.js`, whose stub runtime now holds a helm).

**A2 (minor; at the base too - C3). A landing one pixel off stamped the landing's pixel on her.** `helmAfar` took the
sight radius (`> 1`); the wrong stamp needs only another pixel. Her save carried it, and she stood or hid by the wrong
pixel. Afar is any pixel but hers now (`> 0`); the let-go still asks her sight, which shows her within one.

**A3 (record-only reach; a regression at the head). A disembark in flight was taken for a held helm.**
StopSailingDelayed lets go at once but keeps `CurrentBoat` to the frame's end; a jump inside that frame kept her in sight
thirty pixels off, her loop playing, the flag stuck on her. Only a party's journey started in the same frame as the
Disembark key reaches it. A disembark in flight is a helm let go now (`state.disembarking`).

**A4 (head against base - C4). The held boat was heard from the departure while the landing was pending.** In sight for
her sails, her loops played at the rolloff's floor through the arrival's build and its wait (`PARTY_ARRIVAL_WAIT_MS`); the
loops' frame has no pause gate. The world host plays no loop of a boat whose helm is held from another pixel
(`csaAudioFrame`, `boat.helmAfar` - in `src/scenes/csaAudio.js` on the Tamriel branch, where HOST-SPLIT moved the loops'
frame); home again or let go, the flag clears.

## Lane B - the report

**B1 (minor; Classic alone; before both commits).** Under the Classic helm the square-sail assist stows all of a Large
Galley's or a Large Boat VII's canvas with the wind ahead of her beam: "Stow sails" at 0 knots with every sail furled, and
from 40 to about 85 degrees off the wind's eye no hint says why (measured here: 45, 60 and 80 degrees, nothing said).
SAIL-WIND's record had put it within the irons hint's 40 degrees; it is corrected there. It cannot make the screenshots:
the sails show furled, and the Classic helm is a player's own choice. A word for that band would be new player text on the
mod's own helm - left to the owner.

## Lane C - the pins and the record

**C1 (should-fix). The success pin's ship was one no producer mints.** It set `packable = false`; every hull is minted
packable (`Crewed`). A ship stays where she lies because PackBoat refuses her - placed by her deed, that deed not in the
pack. A mutant that let go "afar" for unpackable boats alone lived. The pin builds her as the game does (her deed's number
on her, no deed in the pack).

**C2 (should-fix). The afar threshold and its axes were unpinned** - `> 2`, and the X axis alone, lived. Pinned at one and
two pixels east, forty south and one diagonal.

**C5 (minor). The flag's clear at the let-go was unpinned.** With A4 it is no longer near nil: a flag left set would keep
her loops silent for good. Pinned.

**C6 (record).** Three sentences of the record were wrong and are corrected there: a ship stays unpacked when her parts
are too heavy to carry (PARTS-WEIGHT weighs her timbers, not her hold); the Classic stops were sourced to SAIL-WIND where
the Carrack's is HELM-WAY's; and fast travel and loads let the helm go in their own callers, not in `_teleportToPixel`.
The record's drive was a scratch probe; it is `tools/sailDrive.mjs` now, and its counts are this audit's.

**C7 (record).** The let-go's departure from StopSailing is named on `03-World/Come-Sail-Away.md` (The helm), and
FIELD-CSA1's row in `Port-Ledger.md` lists HELM-SIGHT's pins.

## The drive

`tools/sailDrive.mjs` sails every state with her sails set and the player outdoors for 12 seconds (a wind of nought
judged too since FIELD BUGS 2026-10-29d, which found the door's none so) and asks
whether her sails still drive her (the way she is driven to, not the way she carries). Committing it found three faults
of the scratch probe: it took the helm of a boat hidden thirty pixels off, which no ray can reach; it moved the player's
pixel after the re-anchor, where `state.init` moves it first; and it asked the way she carried, which a ship's coast
holds over the line for longer than 12 seconds. The party's wait is sailed as world.js holds it: the mod's frame paused,
its Animators stepping.

Under the Responsive helm, seeds 1, 2 and 3 at 400 runs each: on the base 3 stops in 1,200,
each a helm held across a party's jump; at the head none. Under the Classic helm 11 in 300 (seed 1), each the mod's
model above. A held jump needs her sails set first, so the drive meets it rarely: it is a sweep, and the tests are the
pins.
