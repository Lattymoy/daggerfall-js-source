# FIELD BUGS 2026-09-27h - the escape menu's doors, the sea's deathloop, the street's shield, the map a load greyed

Mac, with eight Discord threads as screenshots: six bug reports and two suggestions. This page is the batch's record;
each fix has its own section below. Mutants: `tools/mutants/fieldbugs27h.json` (45, all dead). The batch's audit, before
it merged, is ## AUDIT at the end (`tools/mutants/audit27h.json`, 45, all dead).

The list, as it came:

1. **Equipment sprites too big for the boxes** (kurkku) - a screenshot of a shop list: a pauldron's and a dai-katana's
   pictures hanging out of their framed boxes into the rows beneath, the spellbook's fitting.
2. **Underwater Deathloop** (Yugi): *"My character just autoran into the ocean, stuck at the bottom because of my loot.
   No more puddles does nothing"*.
3. **Escape Menue Discrepencies** (Eterna): *"if one goes to the escape manue and attempts to navigate tp the notes or
   quests, via the butttons there, player will be told thers no links to that info from this menue space, so one must
   use keybinds exlusivly to open both the note book and quest log...."*
4. **Stuck Spell Book Screen** (Eterna): *"if u enter the spellbook via the escape menue, instead of the chosen
   keybind, the spellbook willopen and stay persistent, behind all screens, making it unable to exit or play ( ctrl,
   alt, del ) desktop app"*.
5. **Shield Widget show as broken outdoors** (SlipperyPeasant): *"My shield is fully repaired and looks as such
   inside, but once I'm out in the open world it visually appears as if its broken."*
6. **3D Map Unfilling areas mid-dungeon** (Flylighter): *"Parts of the map previously filled out will randomly
   disappear from the 3D map ... just about every dungeon. Using desktop client!"* (a video link, and a message cut off
   at "It may be, on second glance, that...").
7. **Extremely long buffs :(** (suggestions - Leafen): *"Could there be a way to dispel magic for non-magic users?"* -
   a Shield Group at 11397 rounds - *"Or maybe have a hard limit for the number of ticks"*; Zerofyre: *"An option to
   right click cancel buffs on yourself like most RPGs would be incredibly nice"*.
8. **hold mouse button to keep repeating button action** (suggestions - Skeptikali): *"hold a + or - button in for
   example spell making to increase values instead of clicking hundred times"*; Tabitha: *"add a field to type in the
   value !!"*.

## ESC-BOOK: the F5 page's doors, and the escape menu's Notes and Quests (3, 4)

On the enhanced skin F5 opens the pause window on its Stats page (PX27) - the same window as Escape's, tabs and all,
which is why both reports say "the escape menu". Its Pack, Spellbook and Chronicle doors called the SHEET's hooks,
closed the page and dropped what they returned - and those hooks are FACTORIES: the classic sheet pushes what they
build as its own child. So on the F5 page:

- **Spellbook** built the enhanced book, which mounts its screen the moment it is built (z-index 11), and no host slot
  held it. The pointer relocked and the game ran on under it; Escape opened the pause OVER it (13), and it stood
  behind every screen - report 4, word for word.
- **Pack** (and F6's crossover from the page) did the same with the pack.
- **Chronicle** - the notebook's door - built the CLASSIC journal, which nothing drew: the page closed and nothing
  opened. With the Quests tab's "The journal is not wired into this place yet" (F5-QUESTS fixed that tab a day
  earlier, which a desktop app a day old still showed), that is report 3.

The page's three doors are the HOST's arms now (`ui/charSheetDoor.js` sheetPageDoors) - the ones each host's pause bag
has always handed the Escape window, which open each window in that host's own slot. The page goes down first, then
the arm; a host with no arm gets no door. A building's F5 page used to be handed the STREET's bag with the street's
sheet builder; it is handed the building's own now (`scenes/worldModes.js` interiorPauseHooks, the bag its pause door
spreads), whose doors mount in the building's slot. And a door that opens another window HANDS OFF rather than resumes
(`ui/pauseDoor.js` pauseMenuAct 'handoff'): nothing relocks under the window about to open, and a pause window opened
from the classic pause's Controls button does not bounce back to it first. `test/ui/escbook.test.js` (3).

## SEA-RISE: the sea's deathloop (2)

The sink is DFU's own rule - an over-encumbered swimmer takes `Vector3.down` instead of the float keys
(LevitateMotor.Update :83-85), which Iliac Puddle No More's forged water level carries to the sea - and it stands.
What made it a LOOP was the port's own:

- **The respawn searched only the death's region.** An open-sea pixel is politic 64, region 31, whose table holds a
  crux and two moorings - no temple, town or graveyard - so the online respawn stood the player where they fell: the
  carved seafloor, with the loot that sank them and one breath, to drown and rise there again. A region with none now
  searches every region for the nearest (`systems/deathRespawn.js` nearestSafeLocationAnywhere; one region resident at
  a time, the one before put back, roadsProducer's sweep).
- **The autorun latch survived the respawn** and walked the risen player back into the water. The respawn drops it
  (`player/motor.js` stopAutorun - the two latches a held MoveBackwards drops).
- **The sea's breath ran on under an open pack**, so emptying the pack drowned the player doing it. It waits under a
  window now, as the dungeon's breathTick and this host's own calendar always have (DFU's windows pause the game) -
  the dungeon's under its OWN windows only, it turned out; AUDIT S1 gave it the street slot's too.

"No More Puddles does nothing": its switch is the ROOM's online (forced on, the Mods pane greys it "On (online)") and
offline it reaches the next world load - it never drained a sea under a swimmer, and it never touched the weight rule.
Dropping to 62.5 kg (the pack now waits for you), Levitate, Water Walking or Water Breathing gets a sinking swimmer up.
`test/player/searise.test.js` (3).

## SHIELD-OUT: the street's shield (5)

The Shield Widget mod has ONE component; the port builds one per weapon rig, and only the host on screen steps its
rig. The street's widget sat out the whole visit to the smith and resumed on the sprite it last read: its template key
had not moved, and only a DOWNWARD crossing (hitShield) repoints the sheet. The mod's one component sees the shield come
off for the repair (DFU repairs nothing equipped) and re-reads it when it goes back on. The widgets count their steps
together now, and a widget that missed any re-reads its shield on its next frame (`combat/shieldWidget.js`
`_widgetSteps`, `stale`): repaired indoors is repaired outside, and a shield battered indoors is battered outside. A
widget that never looked away keeps the mod's own law. `test/combat/shieldout.test.js` (3).

## LIST-FIT: the list tile holds its picture (1)

The shop's list rows (a player trade's too - it is a trade-shell) frame each picture in a 34px tile, and a tiered
item's picture is capped at `max-height: 100%` inside the tier's 2px frame (AUDIT MERGE-PLUS D2). The base tile is a
GRID, and a grid's auto row gives that percentage nothing to resolve against: only the width was held, and a tall
picture hung out of its box. The trade tile is a flex room now, centred, as the loot window's has been since UI1
(`ui/enhanced/enhancedPlusStyle.js`) - never `overflow: hidden`, which would clip the sigil rune and the padlock standing past
the edge. Measured in Chromium over the injected sheets (a pauldron, a dai-katana, a staff, a spellbook; fitted,
Morrowind-square, grid-sized and raw 2x pictures): eight tiered trade rows overflowed before, none after. The UI pass's
fit law (UI1, merged the same day) had already sized each picture under the box, so the report's build may have been
the one before it; the tile now holds whatever it is handed. `test/ui/enhanced/listfit.test.js` (1).

## MAP-KEEP: a load greyed the map (6)

The reveal store only ever grows while a player stands in a dungeon: its keys are the block and the RDB offset, the
draw list it filters is the whole level, and no stream, sync or cap removes a key mid-visit. What took the map away
was the LOAD - and the players who report this die in dungeons and load:

- The world host builds a saved dungeon through the door's own build, and that build entered the restored record on
  the FRESH-ENTRY arm: the colour tier (visited this run) reset, so every step of the run went gray; the record
  stamped; the store pruned. DFU's load arm (initFromLoadingSave, Automap.cs:2492-2493) touches none of it. The load
  passes `fromLoad` through (`startInDungeon` -> `dungeonTransition` -> `automapFromLoad` -> `enterDungeonAutomap`).
- The save was restored BEFORE the scene being left was torn down, and that teardown's exit stamped the dungeon it left
  - in the SAVE's store - with the clock being left, and at "remember 0 dungeons" cleared the whole store it had just
  restored. A restored store names no live dungeon now (`systems/automap/automap.js` restoreAutomap), so the teardown writes
  nothing into it; walking out still forgets, as the vanilla law says.

What this does not answer, and says so: the 3D map's own cut plane. Above the player's height a dungeon's upper storeys
are drawn transparent (the dungeon default) or cut away (Cutout, which Return cycles to and F2 forces), and seen from
below an upper floor's faces point away - DFU's own presentation, which the port draws as DFU does. A player moving
between storeys sees "parts disappear" and reappear with no data lost. The video and the cut-off second message were
not readable here; if the parts come back when the player returns to their height, that is the slice.
`test/systems/automap/mapkeep.test.js` (3).

## BUFF-END: ending a spell of your own (7)

Never DFU's: its one way off is Dispel Magic, a spell a warrior has none of. The Shield Group's 11397 rounds are DFU's
own stacking (Shield.AddState adds a recast's rounds - the port's `inc.roundsRemaining += rounds`), many maximum casts
deep; the stacking law and every duration stand, and no cap is laid on anyone's cast. What the player gets is the
choice to end one:

- **The law** (`systems/mysticism.js` canEndBundle / endBundle): a SPELL of the kinds that only help - every duration
  buff but Silence, Shield, Fortify Attribute, Regenerate, the elemental resistances, Spell Absorption, Reflection and
  Resistance, Comprehend Languages and the heals (ENDABLE_KINDS). Never a held item's magic (back the moment the item is
  read again), a duel's, an armed Open or Lock, a disease or a poison (neither is a bundle), and never a bundle with a
  harmful kind in it - a foe's Drain merges into the incumbent it finds, so the caster is not enough and every entry's
  kind is asked. Ending takes that bundle's entries alone (Dispel Magic's self-cast arm, no roll) and says
  "<name> ends.". Who cast it is not asked (AUDIT B4): the player's own, a mate's or a stranger's gift, a potion's, a
  worn set's timed proc (Eventide) - each ended is only a benefit given up.
- **The HUD, right-click** - with the mouse freed (the FreeMouse key, Y; Enter too where the chat does not take it -
  online it does, AUDIT B3): the enhanced status widget's tile for
  a spell that may be ended takes the pointer (only then - the HUD stays pointer-transparent) and a right-click ends it;
  its press goes no further (no swing). The classic HUD's icon the same, through the HUD click door every host already
  calls (`ui/hud/hudLarge.js` routeSpellIconClick): the pointerdown is cancelled, so neither the swing nor an armed cast
  hears it; and the classic icon's name now shows with the mouse freed too (DFU's tooltip gate, which the hosts'
  paused flag had halved).
- **The pause window's Stats page, Effects** - every spell on you with its rounds, and an End on each that may be
  ended: the door a pad, a finger or a player who never frees the mouse can use. It is the Enhanced Plus pause
  window's (AUDIT B5): the classic pause has no tabs - its Controls button opens the enhanced menu, where Stats is one.

`test/ui/hud/buffend.test.js` (5). Port-Ledger A.

## HOLD-STEP: hold to repeat, and a typed value (8)

The Enhanced Plus spell maker's effect editor (the port of DFU's window, `ui/enhanced/enhancedPort.js`'s spinner block):

- **Hold** a + or - button: the first repeat after 400 ms, then one every 100 ms, every 40 after ten - a 1 to 100 field
  in under five seconds. Every step rebuilds the port's DOM under the finger, so the hold is keyed by the button's
  PLACE among the spinner buttons, each repeat running the latest view's act for the button at that place; a view
  with no such button (the editor shut mid-hold) ends the hold rather than pressing whatever stands at that index
  now. The release is heard anywhere, a hold that stepped swallows its release's click, and a window taken down
  mid-hold stops.
- **Type** the value: the number between the buttons is a field (the numeric keypad; one to three digits). Enter or
  leaving it sets it, by the step's own law - clamped to the spinner's range, the magnitude pair rule, the cost
  (`systems/spell/spellMaker.js` setSetting, the editor's `setValue`, refused where the spinner is off); Escape or anything not
  a number puts the value back. The hosts already step aside for a typed field.

Measured in Chromium over the port (a scratch probe): a 1.2 s hold is nine repeats and its release adds none, a 0.2 s
press one step, 42 and 7 typed set, "abc" and Escape put the value back, a disabled spinner has no field, and a view
changed under a held button stops the hold and presses nothing of the new view. The classic
window keeps DFU's click-per-step. `test/ui/enhanced/holdstep.test.js` (4). Port-Ledger A.

## THE FOUR HOSTS

ESC-BOOK: world.js, exterior.js and dungeonContext.js hand their sheet their own pause bag, as since F5-QUESTS; the
building (worldModes) hands its own bag through the outer host's builder, which takes it - world.js's, and since AUDIT
A2 exterior.js's - and its pack crosses over to that page (A1). SEA-RISE: the respawn and the sea's breath are world.js's
(the only host with an online respawn and the carved sea); the autorun latch drops at every rise and load in world.js,
worldModes.js and dungeon.js, and a world-hosted dungeon's breath takes worldModes' street-slot hold (AUDIT S1, S2). SHIELD-OUT: every
rig's widget counts in the one module. MAP-KEEP: the load's arm is world.js's (the dungeon context's own quickLoad
already entered on the load arm); the store fix is the module's, and the Burning Court's detached record the dungeon
context's (AUDIT M1). BUFF-END: the enhanced widget and the Stats page are
host-free; the classic icon rides `routeLargeHudClick`, which all four hosts' pointerdowns already call, each now
handing it the event. LIST-FIT and HOLD-STEP are the skin's.

## AUDIT (2026-09-28, before the merge)

Mac: *"Lets audit before merging"*. The branch was first merged with main (#412, the Sigil Stones: every conflict a cite
number both sides had moved, `tools/citeMerge.mjs` on the merged tree), then read in five lanes - the F5 page's doors;
the sea and the shield; the map and the list tile; ending a spell; the spell maker's hold and field. Every finding was
checked against the code before anything moved, and the port's in Chromium over the real `SpellMakerWindow` (scratch
probes). Pinned in `test/ui/enhanced/audit27h.test.js` (11) and the slices' own suites; `tools/mutants/audit27h.json` (45, all
dead), and the 130 older records whose killers or sites the fixes touched re-run - all dead but the two recorded as
equivalent.

### The F5 page's doors

- **A1** (the batch's claim, half kept): a building's F5 page got the building's bag, but the enhanced PACK's F5 crossover
  still built the STREET's page (world.js `makeInventoryWindow`'s `openCharSheet`, which `interiorInventory` never
  overrode), whose Pack was the street's: a drop inside a shop or a visitor's home went to the street's pool, past
  HOUSE-DROP's refusal. One door now, `openInteriorSheet`, for F5, the pause bag's crossover (which no pack ever read)
  and the pack's own bag. The batch's comment gave the wrong harm ("nothing a building draws" - the street slot IS
  drawn indoors) and says the right one.
- **A2**: ?exterior's builder ignored the doors a building handed it; it takes them, as world.js's does.
- **A3**: the building's bag carried no `playerId`, so its F5 page (the street's bag had one) lost CHARID1's by-id Save
  list to name matching.
- **A4**: a door is a handoff (no relock), so a door whose window could not open left no page, no window and the pointer
  free over a running game. Every host's arms answer whether they opened, and the Stats door resumes on a `false`,
  inside the click. Two such doors were real: the dungeon's Chronicle with no quest bridge (withheld now - PX14's drawn
  door) and the world's classic journal on its first press (LGBK00I0 was never warmed at the world's boot, so the L and
  N keys' first press opened nothing either; warmed now, exterior.js's U43 line).
- **A5**: the Stats page's Ascend (a level owed) still resumed - a relock under the level-up, and from the classic
  Controls route a throwaway classic pause first. A handoff now.

### The sea and the shield

- **S1**: the batch said the sea's breath waits under a window "as the dungeon's does". The dungeon's did under its OWN
  windows only: a street-slot window over a world-hosted dungeon (Recall's prompt) held the motor while the breath ran
  on. worldModes hands the dungeon `breathHeld`.
- **S2**: the latch dropped at the online respawn alone. A mate's Resurrect, the Privateer's Hold rise and a load (F11
  off an offline death screen - a save facing the water walked the player back in) came up running. Every rise and every
  load drops it now; the load's is the port's own rule - a loaded character inherits no latch, as it inherits no camera
  reel (CameraRecoiler's reset beside it).
- **S3**: the widgets' step counter moved only while the Shield Widget was ON, so a shield repaired with the switch off
  came back battered when it was switched on ("takes effect at once"). A rig's frame with the switch off counts the step
  (`offFrame`).
- **S3b** (found finishing the audit): S3's count was the `else` of the shield's own lateUpdate, INSIDE the rig's shared
  mod frame (`widgetOn() || _torchesOn || shieldOn() || thunderlockHeld()`) - and a profile with the Shield Widget
  alone, SW1-FEED's, shuts that whole block when the switch goes off. Nothing counted, and switched back on the widget
  drew the shield it last read: on the real rig a repaired kite came back as sprite 410 (battered), not 310; with the
  Weapon Widget on beside it the block stayed open and it re-read. The count is at the gate now - every rig frame that
  reaches it with the switch off is one the widget would have stepped. S3's rig pin was a regex over the source, and it
  matched the placement that failed (SW1's lesson, paid again); S3b's drives the real rig, alone and beside another mod.

### The map and the list tile

- MAP-KEEP and LIST-FIT stand as written: every load path carries `fromLoad` and no fresh entry does; the restore's
  reset is reached only from `restorePlayer`; "remember 0" is DFU's law; no mid-visit path removes a revealed cell. The
  trade tile's flex reaches the shop and the player trade only (the loot window's and the pack's tiles were flex
  already), measured at 1400 and 390 px with nothing else moved.
- **M1** (pre-existing, WB3b): the Burning Court entered the automap store on the fresh arm - a record of a level whose
  M is refused, stamped the newest, and the store pruned against it, so each region's court cost the oldest remembered
  dungeon its map. The court binds a detached record now (`detachedAutomapRecord`).

### Ending a spell

- **B1**: the widget swallowed a mouseup wherever it landed on an endable tile, so a right press begun on the world (a
  gap, a click-through tile) and let go over one never reached the host: `rightHeld` stayed up (the look frozen), a
  held swing (WeaponSwingMode 2) swung on, and on Windows, where the menu comes with the release, the tile's spell ended
  too. `endingGesture`: a tile owns its press and that press's release only, every press anywhere clears it first (the
  window's capture), and the menu ends only the spell whose tile took the right press. The hotbar's sockets in mouse
  mode (HB1c, on main) had the same hole, and the same fix.
- **B2**: the classic HUD's icon rects stood from the last frame drawn, so with the HUD hidden (Shift-F10) a freed
  right-click still ended a spell. The hidden returns empty them, and a placement not drawn for a second answers none.
- **B3-B5** (words): online the chat takes Enter, so the FreeMouse key (Y) is the way; `canEndBundle` never asks who
  cast it (a potion's, a stranger's gift, a set's Eventide end too - benefits given up, nothing more), where the notes
  said "your own and party members'"; and the Effects page is the Enhanced Plus pause window's. The notes say so now.

### The spell maker's hold and field

- **H1**: each repeat ran the LAST DRAWN view's acts, which click the classic window at fixed points. Escape shut the
  editor mid-hold and, under a 30 fps cap, the next repeat landed before a draw - on the main window's Buy spell (4 of
  25 trials bought the spell and spent the gold). Each repeat reads the live view first, and every spinner act is its
  own editor's (`live`), so a stale act presses nothing: 0 of 30 at 30 fps after.
- **H2**: the field stopped every key, so the hosts' swallow never heard F5, F6 or F11 - F5 typed there reloaded the
  page (online, after the exit autosave). It swallows them itself (chatPanel.js's own guard).
- **H3**: a value clamped to the one already set changed no view, and "999" stood in the field; the field repaints.
- **H4**: a rebuild dropped the field's focus - a Tab into the next field, whose commit changed the view, sent the next
  keys to the classic editor. The focused field keeps its focus (by place), its uncommitted text and its selection.
- **H5** (pre-existing): every rebuild put a phone's scrolled editor back at the top, the held button out from under the
  finger. The body keeps its scroll, per view.
- **H6** (found probing H1): the Plus pad's release falls back to the node its press went down on, which the first
  repeat had rebuilt away - an event on a detached node never reaches the document, and the hold stepped on to the
  limit. The pressed node hears it too.
- **H7** (found fixing H1): a button's press keeps the focus where it was, so Done shut the editor with a typed value
  still in the field, and the commit that came with the field's removal found the editor gone (H1's guard) - the value
  was lost. A typed value commits at a button's click, before its act.

### What stands, and why

- ?exterior's building Save and Load panes offer doors that do nothing: `pauseMenuHooks` makes quickSave and quickLoad
  functions whatever the host handed, which defeats the panes' own "no hook, no button" test (F5-QUESTS). A dev route,
  and not this batch's; recorded.
- A held spinner keeps stepping when the pointer leaves the button, as Chromium's own number spinner does; a design
  choice.
- The 3D map's cut plane (MAP-KEEP's note) stands as DFU's.
- The all-region sweep decodes each region in turn (11-21 ms on classic-sized data, once, behind the death screen); the
  boot's pixel index could answer it without the decode - a cost, not a fault.

### Finishing the audit (2026-09-28)

Mac: *"I just wanna finish up the audit"*. The branch as the five lanes left it, before it merged: lint and the types
clean, the suite green, `fieldbugs27h.json` and `audit27h.json` all dead. The audit's own fixes were read again against
the code each one leans on - the resume after a handoff (`close` is spent, `relock` still runs), the street slot's
`overlayActive` (the stack's latch), the HUD drawn every frame (AUDIT 39's unconditional call), the pack's `...extra`
after its default door, the court's save refused on every route (the exit autosave's `quickSaveNow` included), the
hotbar's capture press, the pad's release - and they stand, but for S3 (S3b above). One hole beside S2, older than
the batch, was fixed as its own slice: DIAL-LOAD, below. The patch notes were cut to one Discord post, the audit's fixes folded in.

## DIAL-LOAD: a dungeon's Load through a door that brought no applier (2026-09-28)

Mac: *"Take that load bug on"* - the hole finishing the audit found beside S2, older than this batch (the dial's arm is
DISC17's). A dungeon context owns no motor, so a load's placement came in as an argument, and only routeKey brought one:
F12, Escape and F5 handed the host's applier on (`ui/input.js` routeAction). The context's own doors handed none - the
HUD dial's Skills arm (`openSheetPage`: the pause window on its Stats page, or the sheet when a level is owed), the
level-up's sheet, the Oghma Infinium's, the pack's F5 crossover and the pause bag's - so a Load there of a save made in
the same dungeon restored the character and left them where they stood, the autorun latch still set. The world's own
load never met it (worldQuickLoad places by itself); the standalone ?dungeon and every world-hosted dungeon did.

- **The law is the host's, handed once.** Each dungeon host names its one load law, `placeLoadedPlayer` - P14's spawn (a
  load clears motion state: DFU's CancelMovement and ClearFallingDamage) and S2's latch - and hands it to the context
  when it builds it (`placePlayer`). `restoreSaved`, every load's second half, lands by it when the door brought no
  applier; a door's own still wins (the standalone ?load boot records the position before the motor exists).
- **One copy.** The key route, the world's dungeon-save restore and the CASTLE1 probe hand the same law. S2 had edited
  three copies of it and missed the probe's, which still kept the latch.

`test/scenes/dialload.test.js` (2) runs `restoreSaved`, the pause bag and both hosts' laws out of the live source;
`tools/mutants/dialload.json` (6, all dead). The pins that had copied the applier's text (audit23, mac6, overlayTyping,
AUDIT 27h S2) read the law by name now, and S2's runs it.

### DIAL-LOAD, read before the merge (2026-09-28)

Mac: *"I wanna finish this"*. DIAL-LOAD came in after the five lanes, so it was read on its own before the merge: every
door into the context's Load, both builders, every caller of `quickLoad` and `restoreSaved`. The fix stands, and it
reaches further than its list: the fallback sits in `restoreSaved`, past every door, so it also covers the large HUD's
head and Options panels, which the slice did not name. `routeLargeHudClick` hands `routeAction` no applier in both
dungeon hosts, so a Load reached through either panel had also left the player where they stood. The suite (13,534
tests, none failing), lint, the types and the build are clean on the branch, and `dialload.json` (6), `audit27h.json`
(45) and `fieldbugs27h.json` (45) re-run all dead.

- **The four hosts.** The dungeon context is the one host whose load takes its placement as an argument, and both its
  builders hand it the law (dungeon.js, worldModes.js). world.js's load places the player itself (worldQuickLoad), and a
  building's Load is that one (worldModes hands it the world's `host.quickLoad`); exterior.js's own pause has no Load (a
  dev route; its building's panes are in What stands). None of their doors reads an applier.
- **Recorded, not fixed (older than this batch):** a world-hosted dungeon's own load (F12, or Load underground) leaves
  the camera's recoil sway running. The standalone host resets it at every `quickLoad` (dungeon.js wraps the door) and
  the world's load at its start (CameraRecoiler's OnStartLoad), but a world-hosted context's load reaches neither. It is
  under 0.6 degrees at the default High and gone within five seconds of the hit; the fix is a load-start seam across
  the hosts, its own slice. FIXED in the 2026-09-28 batch's audit (Field-Bugs-2026-09-28 ## AUDIT, Mac: "definitely fix
  everything"): the context raises `onStartLoad` once its own load is under way, and worldModes hands it the world
  host's `cameraRecoilReset`; the standalone host keeps its wrapper. Pinned in `test/scenes/dialload.test.js`.
