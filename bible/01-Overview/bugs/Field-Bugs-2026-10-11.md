# FIELD BUGS 2026-10-11 - four Discord threads, and the card table's panel

Four threads from the Discord's bug-reports, handed over as screenshots, and the owner's own ask beside them: "Also the
card tables UI needs to be enhanced".

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "I would love to Poker but..." - "You have too many stakes waiting to be settled - visit the tables they were staked at first", at the first gold table, "Tried on multiple characters Same Problem everywhere" (Shortstori) | the stakes book reads and writes JSON by `get`/`set`, and the host handed it the device's bare Storage (`getItem`/`setItem`): every write threw into the book's own catch, the stake read back unkept, and every first buy-in was refused as `cards-kept-full`. No gold moved | fixed (CARDS-KEPT) |
| 2 | "Soul Trap Dragonling is not giving -5000 ep value" (Paofrenetico) | DFU's own law: Daggerfall has two Dragonlings. The one every encounter and dungeon spawns (34) has no soul and prices Soul Bound at 0; the one with a soul (40, Dragonling_Alternate) is the quest B0B70Y16's alone, and it is the -5000. Both are named "Dragonling" | fixed (DRAGON-SOUL), a departure - the owner: "Fuck matching DFU." |
| 3 | "Hotkey Bug" - a key set for "Overworld (the travel view)" in the Windows group "shows that my selected key is set" but does nothing, and is gone from the page after (Woodland) | nothing in the Overworld's road was broken: the key pane STAGES until Confirm (FIX-F's law), and the player never saw a Confirm owed - a staged key drew exactly as a saved one, and the sticky head that carries Confirm stood under Settings' sticky toolbar (and, on a phone, over the row just bound) | fixed (UNSAVED-MARK) |
| 4 | "If you recall from the helm of a ship, you get sent to the void" - "You can unstuck to get out but then you're trapped at sea with no boat" (Cruor) | a Recall is a jump DFU raises neither the travel nor the load event for, so the Come Sail Away helm never heard it: every frame its sail stood the player back at the drive position of the boat the jump had left - and hidden - at sea. An unstuck from the helm, the same | fixed (HELM-JUMP), a departure |
| 5 | the owner: "the card tables UI needs to be enhanced" | the panel: a refusal said in the line's plain words, a slider with no unit and no quick stakes, the log a run of sentences cut off at its newest | done (CARDS-PANEL) |

## CARDS-KEPT: the stakes book kept on the device's own store (1)

`net/card/cardStakes.js` keeps a realm character's stakes and receipts as JSON through `storage.get`/`storage.set` - the
`{get, set}` store every suite built it over. `scenes/world.js` handed it `appStorage()`, the device's localStorage, which
has `getItem`/`setItem` and neither of those: `read` threw and answered `[]`, `write` threw into its catch, and `stake`'s
check that the request was KEPT before it is asked (AUDIT CARDS-4 C6 - a lost answer must have a record to void it by)
found nothing, and refused as `cards-kept-full` - the panel's "too many stakes waiting to be settled". Every gold table,
every character, every device, since CARDS6 (2026-10-08); the realm was never asked and no gold moved. CARDS-SAID's
report the night after the gold tables opened ("Shes clicking deal me in but nothing happens") is this one's twin: that
section left the refusal's words on the panel so "the next report names them", and this one did.

The book is handed AUDIT WB A6's one store now (`spoilsPool.js` `spoilsStore`, reached at stake time as the Marks book
and the Iliac claims reach it), JSON over the device's Storage, its memory standing in for a storage that refuses writes.
TEST THE SHAPE THE PRODUCER MINTS: the pin lifts the host's own expression out of world.js and runs the real book over it
and a device Storage - a buy-in stakes, is kept as JSON, sits and is owed at its room - and a bare Storage handed to the
book is the report, refused. `11-Multiplayer/Tavern-Cards.md` section 36. Pinned by `test/scenes/fb1011_cardskept.test.js`;
`tools/mutants/fb1011_cardskept.json` (11, all dead).

## CARDS-PANEL: the card table's panel (5)

`ui/card/cardTableHud.js`, the port's own panel (no DFU window behind it). The model decides each new thing and the painter
draws it: the line's TONE (a refusal or a purse too thin to sit is a warning, a stake being asked a wait, your turn the
line to look at); the buy-in's quick stakes (its floor and its ceiling) and the raise's (half the pot and the pot, as a
raise TO on the slider's step, strictly inside the law's range - the floor is where the slider starts, the ceiling is
All in) - a pick moves the slider and its words and never deals or raises; the slider's amount with the table's unit;
the deal and the call drawn heavier, the stand lighter; a fold in the header that puts the seats, the board, the note
and the log away so the cloth shows, kept across repaints; and the log a line a sentence, the newest last and in view
(the run of sentences in one box cut the newest off). `11-Multiplayer/Tavern-Cards.md` section 36. Pinned by
`test/scenes/fb1011_cardskept.test.js`; PIN MOVED: `cards4_hud` - the buy-in's and the raise's models carry their picks.

## DRAGON-SOUL: the Dragonling the world spawns binds at -5000 (2)

`systems/enchantmentCatalogue.js` SoulBound's costs were DFU's `classicParamCosts` verbatim: index 34 `0` ("Dragonling
(no soul, general spawn)") and index 40 `-5000` ("Dragonling_Alternate (has soul, quest spawn only)"). The encounter
tables (`characters/encounterTables.js`, DFU's RandomEncounters) draw 34 and never 40; 40 comes only as quest B0B70Y16's
foe (`vendor/dfu-quests/Tables/Quests-Foes.txt`: 34 is `Dragonling_souless`, 40 `Dragonling`). The trap writes the foe's
own mobile id and the item maker reads it, and both are named "Dragonling" (ENEMY_NAMES) - so the soul a player could
actually trap was offered at nothing, beside a name worth five thousand. The owner, offered the choice of keeping DFU's
law, renaming the soul, refusing the trap or pricing it: "Fuck matching DFU."

A departure (Port-Ledger A, DRAGON-SOUL): index 34 binds at -5000, the quest Dragonling's own worth - one name, one
worth. The binding alone moved. A soul's SoulPts (the gold it adds to a shop's soul gem and to a soul-bound item's
price, `enchantments.js` `legacyEnchantmentValue`) stay DFU's - 0 for 34 - so a monster every encounter spawns is no
500,000-gold gem; and the shops' filled traps still never draw 34 (`shopStock.js` `SOULLESS_DRAWS`, DFU's veto). Pinned
by `test/systems/fb1011_dragonsoul.test.js` (the service's empty trap filled by the soul trap's own roll with a general-spawn
Dragonling, enumerated from the pack, offered by the picker at -5000; its SoulPts and the soulless cells untouched);
PIN MOVED: `enchantmentcatalogue` - 34's cost, the table's sum (99680 -> 94680), SoulBound's (-23440 -> -28440) and the
side effects' (-55160 -> -60160). `tools/mutants/fb1011_dragonsoul.json` (2, both dead).

## UNSAVED-MARK: a key a Confirm still owes says so (3)

The Overworld's action is `TravelView`; it is in every list it must be in, saves by name, loads, and is read by the world
host's ladder (`worldKeyAction`) - driven in the real pane over a fake page, a key bound and Confirmed is in the live
registry and survives `loadOrCreateBindings` (not driven in a live game: the Overworld needs ARENA2). Its row is
the one in the Windows group that ships with no key, so it is the first a player sets from nothing. The pane stages until
Confirm and drops what was staged on every walk away (FIX-F; the head says so) - kept. What the player could not see:

- a staged key drew exactly as a saved one, on a Settings page whose every other row saves as it is set. A row whose
  staged key the registry does not hold yet is marked now - `ctl-unsaved`, "Not saved yet - press Confirm." - and the
  head counts what a Confirm owes ("1 change not saved yet - press Confirm to keep it.") and lights the Confirm
  (`systems/controlsConfig.js` `unsavedEdits`, both dicts, against the live registry);
- the head that carries Confirm is sticky (TORCH-BIND), and ORG2's Settings toolbar is sticky at the top of the same
  scroll, above it: measured in Chromium at 1366 x 768 the head was 312 px, its top 131 px behind the bar; at 390 x 844
  it was 462 px and covered the Overworld row itself. The head sticks UNDER the toolbar now, at its measured height
  (`ui/enhanced/enhancedMenu.js` `stickUnderToolbar`, `--opt-tools-h`), and is the law's line and its buttons alone - the how-to
  is the page's first card (`ctl-intro`), read once: 138 px on the desktop, and on a phone (where the law's line is the
  intro's to say) one row of buttons and the owed line, 90 px.

Pinned by `test/ui/enhanced/fb1011_unsavedmark.test.js`; `tools/mutants/fb1011_unsavedmark.json` (11, all dead). Not changed, and
the owner's if it should be: leaving the page commits a staging with no clash, as DFU's own window does (OnPop applies on
leave) - a reversal of FIX-F's "leaving discards".

## HELM-JUMP: a jump leaves the helm (4)

Come Sail Away's helm holds the player to the boat's drive position every frame (`systems/comeSailAway/comeSailAway.js`
`updateSailing`) and is let go by the events the mod hears: a load's start, a fast travel, a death. A Recall
(`scenes/world.js` `recallToAnchor`), a guild's teleport, an unstuck, a quest's respawn and the staff's jumps raise none
of those - the C# hears OnTeleportToCoordinates, which is its waves. So the jump landed the player, the re-anchor left the
boat at its old place at sea (and hid it, its pixel no longer near), and the next frame's sail stood the player back at
its drive position - on no deck, in a ring the streamer then rebuilt around the sea: the void. The unstuck from there
went the same way, and its cooldown ran anyway. The Warm Ashes raid had met the same law and let go first (AUDIT OW5b S1).

A departure, the port's own event: `OnPreJump` - a disembark in flight ended as a load's start ends it, then the helm let
go as a fast travel lets it go (`OnPreFastTravel`: the sail stopped, a packable boat packed, so the boat comes home in
the pack rather than lying hidden at sea). The teleport core raises it (`_teleportToPixel`, `csaPreJump`) for every jump
that names no event of its own - before anything the jump awaits; a load (OnStartLoad), the travel map (OnPreFastTravel)
and a party's journey (its helm let go only once the arrival is certain) release it as they did. THE FOUR HOSTS: the
helm is `world.js`'s (the streaming host runs Come Sail Away and owns every jump); `exterior.js`, `worldModes.js` and
`dungeonContext.js` run no helm and no teleport core - an interior's or a dungeon's Recall jumps through world.js's.

Not changed: an anchor set ON a deck is the deck's world point at that moment (DFU's anchor knows no boat), so a Recall to
it lands where the boat was, in the water. Pinned by `test/systems/comeSailAway/csa_sailing.test.js` (the runtime: unreleased, the landing is
pinned back; released, it stands, the skiff packed, a disembark's hold ended) and `test/scenes/fb1011_helmjump.test.js` (the
host); `tools/mutants/fb1011_helmjump.json` (6, all dead).
