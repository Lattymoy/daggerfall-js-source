# Controls - the keybinding standard (KB1, 2026-09-23)

Mac, 2026-09-23: "We have a lot of mods, a lot of keybinds. I really want to formalize a solid solution. Like what
does need keybinds, what does, and ensuring keybinds are organized and working as intended."

This page is the standard. The code that holds it is `src/systems/inputActions.js` (the registry: `ACTIONS`,
`DEFAULT_BINDINGS`, `ACTION_GROUPS`, `MOD_ACTIONS`, `HIDDEN_ACTIONS`, `actionLive`, `migrateKeyBinds`),
`src/ui/input.js` (the readers every key goes through), and the three controls windows (the enhanced pane
`src/ui/enhancedControls.js`, the classic grid `src/ui/controlsWindow.js` and its ADVANCED popup
`src/ui/mouseControlsWindow.js`). The laws are pinned by execution in `test/kb1_keybinds.test.js`; the Ledger A row
THE KEYBINDING STANDARD records every departure from DFU's table.

## The six laws

1. **One registry owns every world key.** DFU's actions; the port's own (the F-menu, the quickslots, the loot
   plaque, the mouse toggle, E's `Interact`, the pixel dial as `QuickDial`, the hotbar's slots); and every vendored
   mod's keys, which each mod used to read off its own TextKey where no binding table could see them. Controls draws
   them in groups a player looks under, a mod's group under the mod's name while that mod is on.
2. **A window's own keys are the window's.** Escape and Enter (back and confirm), the arrows and `+`/`-` on the
   maps, `Y`/`N` on a message box, the letters a DFU window binds through its own DaggerfallShortcut table
   (`systems/dialogShortcuts.js`), the travel panel's `M`/`C`/`H` while a journey runs, the dial's WASD and arrows
   while it is up. They answer only while their window is the top one, so they share nothing with the world's
   keys. A window that closes on "its own key" closes on that action's BINDING (the pause on Escape's, the pack on
   Inventory's, the spellbook on CastSpell's), plus the back button, as DFU's toggle-closed binding does.
3. **One key, one action - unless the player puts it on more.** No default code ships twice. The hotbar's slots 1-4
   are the diamond's own four actions, so a pad's d-pad reaches them too; what they do follows which bar is in force
   (`uiSkin.js hotbarInForce`). UXB1-S (2026-09-25, a contributor: "I dont care if it goes against daggerfall"): a
   player may SHARE a key between actions (law 4's third answer), and the key then does all of them - every poll
   (`held`, `pressed`, `released`) sees each, and every dispatch (`routeKey`, the two self-routing hosts' ladders, a
   window's own-key close) runs each, the key's first holder first. A departure from DFU, recorded in Ledger A's UXB1
   row; the store keeps DFU's code -> action orientation for the owner and lists the sharers beside it.
4. **A held key is asked for, never taken.** Binding a key another action holds opens "X is used by Y. Give it to
   Z instead?" in every controls window - Yes stages every holder unbound, No (or Escape) stages nothing, and USE FOR
   BOTH (the enhanced page's third button, B in the classic grid and its ADVANCED popup) keeps every holder and puts
   the key here too, wherever every holder holds this very key. "Holds" is
   DFU's own clash law (`getDuplicates`): a combo against a bare modifier is asked for too, and a key moving between
   an action's own two slots says so. A key's auto-repeat answers no prompt. Yes stays Yes across a reboot: the
   apply reads "changed" off the registry as it stood before it (AUDIT KB1 F4), and it writes a staged share as one.
   DFU's duplicate law now finds only a combo against its own modifier bound bare - still red or blue, still
   blocking, never offered as a share; the same key twice is a share, drawn green.
5. **Every key is read through the registry, live.** `held`, `pressed`, `released` and `actionsOf` resolve codes,
   combos included, against the player's bindings at the moment of the read, so a rebind applies at once. A mod
   switched off answers nothing on its keys (`actionLive`, at the one gate every reader takes); its keys stay bound
   for when it is switched back on. A mod that takes effect when the game next loads (Come Sail Away, Travel
   Options) answers as its host latched it at mount - switched off mid-game, its keys work until the next load, as
   its runtime does (AUDIT PRE-MERGE 0928 U7, `modSettings.js` latchModLoaded). No gameplay code reads a bound key by its raw code except the reservations the
   sweep in `test/kb1_keybinds.test.js` names with their reasons (the back-button latch, Alt's preventDefault, the
   travel panel's help, a talk window's confirm alias, the developer fly-cam).
6. **Tests hold it, and old saves come forward.** The file carries `version: 2`. A version-1 file is carried once:
   (1) E, Backquote and Left Ctrl are let go where they still hold DFU's old defaults (AbortSpell, the console,
   Slide), and the two hidden actions let go of any key; (2) the standard's defaults land on every key the player's
   own file left free; (3) a mod key the player SAVED is carried into its action onto a key still free after that (a
   value the port only ever shipped is left to the new default; `None` stays unbound) - a player's old choice never
   takes a key from another action. What could not be carried - an action whose new key the player's own file
   already spends, a mod's old key another action now holds - is TOLD to the player on the HUD once a scene stands
   (`controlsConfig.js keybindCarryNotes`, `notify.js hudTextWhenShown`), a mod's line only while it is on.

## Mac's four calls (2026-09-23)

- **E = Interact.** E activates beside the left mouse button, as the port's own action; `AbortSpell` moves to
  `` ` ``, the key DFU spent on a console this port has not.
- **Enter online = chat.** Online, the chat panel claims ActivateCursor's key (`pointerLock.js claimCursorKey`):
  Enter opens the chat and does not free the mouse; `Y` (FreeMouse) frees it. Offline, Enter frees the mouse as
  DFU's does (PlayerMouseLook.cs:190). The claim is PER PRESS, on the chat's own word: with the chat hidden, or
  unable to open, Enter is the game's again (AUDIT KB1).
- **The digit row is the quickbar/hotbar.** 1-4 are the diamond (and the hotbar's first four); 5-0 the hotbar's
  slots 5-10. Horse Cart and Cargo, which had shipped on 5 and 6, moved to `,` and `.` (the mod's own F7 and F10 are
  the browser's caret browsing and DFU's HUD toggle).
- **DFU's dead rows: build two, hide two.** `CenterView` (Home) levels the view through the look filter;
  `PrintScreen` (F8) saves the game canvas as a PNG (`ui/screenshot.js`, routed by the hosts like every world
  action, so an automap's own F8 - its third background - stays the automap's) - DFU binds both and reads neither.
  LOAD1 (2026-10-05): the same PNG is also kept in the menu's Screenshots gallery (`systems/shotGallery.js`), where
  the loading screens stand on it; the download is the player's switch on that pane (`10-UI/Loading-Screens.md`).
  `ToggleConsole` and `Slide` ship unbound and off the page, freeing `` ` `` and Left Ctrl. The dungeon's
  diagnostics readout, a raw F8 that answered only while F8 was unbound, is the `DebugOverlay` action, unbound.

## Come Sail Away's helm keys (CSA-D, 2026-09-27 - for Mac's read)

The mod reads nine KeyCodes of its own, only at the helm. CSA-D reads two - Disembark and ToggleLight - and both
shipped on keys the table already spends: C is `Crouch` and Period is Horse Cart and Cargo's summon. Law 3 ships no
default twice, so the two are the registry's `BoatDisembark` and `BoatToggleLight` on `'` and `;`, free keys under
the right hand (`/`, beside the Period, is the decorator's own grid key - `decorTool.js` DECOR_FREE_KEYS). The
Transport key still leaves the helm too, as the mod has it (Actions 15). The mod's C and Period stay its `shipped`
values, so an old saved setting of either is left to the new default. The other seven come with the slices that
read them (CSA-E, CSA-G): Space for the sails (Jump's), the keypad's plus (Eye of the Beholder's), minus and enter for
the time scale, the brackets and the backslash for the trim - the last five free.

CSA-E (2026-09-27) reads four more - also for Mac's read. ToggleSail ships on Space, which is Jump's, so the registry's
`BoatToggleSail` ships on End (a player who wants the mod's Space can share it with Jump - law 3's third answer: the
motor is frozen at the helm, so the jump does nothing there). The trim keeps the mod's own keys, which nothing else
holds: `BoatTrimRight` on `]`, `BoatTrimLeft` on `[`, `BoatTrimModifier` on `\` (held with a trim key it trims the
square sails; held with the sails' key, with the sails up and the square-sail assist off, it raises or lowers the square
sails alone). The fixtures that wanted a key no default holds moved off End onto Scroll Lock. The time scale's three
(the keypad) come with CSA-G.

CSA-G (2026-09-27) reads the last three - one for Mac's read. IncreaseTimeScale ships on the keypad's plus, which is Eye
of the Beholder's `AutoPerspective`, so the registry's `BoatTimeScaleUp` ships on the keypad's star beside it
(`NumpadMultiply`; a player who wants the mod's plus can share it with AutoPerspective - law 3's third answer - and at
the helm both then answer). `BoatTimeScaleDown` and `BoatTimeScaleReset` keep the mod's keypad minus and enter, which
nothing else holds. The three answer only at the helm, where the mod's sailing arm reads them - and online only with
why (HELM-TIME-ONLINE, 2026-10-04, Mac: "Remove the time dial from ships online": "Online, time at sea keeps the
world's pace."; `03-World/Come-Sail-Away.md`). The mod's plus, minus and enter stay its `shipped` values.

CSA-I (2026-09-27): the position reading's map reads raw keys of its own, and only while it is up - the number row's
1 to 8 for the marker colour, the left and right mouse buttons, Left Shift held for the thin lines, and Escape's
release to put it away (ShowBoatPositionCoroutine's GetKeyDown / GetKeyUp / GetKey on KeyCodes, none of them the
registry's). The map is a window in the mode's slot, so those keys reach it and nothing else while it stands - the
number row is not the quick slots there, nor Escape the pause menu.

CSA-L (2026-09-28, a player's ask: "instead of an overuse of keybinds, is there a way we can instead develop enhanced
plus UI elements?"): on Enhanced Plus the nine are also a HELM PANEL under the compass (`ui/enhancedHelm.js`) - Raise
or Stow sails, the square sails alone where the modifier's chord would raise them, the trim while it is the player's
(held), Light or Douse lanterns, the time scale's minus, one and plus (offline: HELM-TIME-ONLINE draws no dial online,
and the d-pad's left and right then step nothing, held they only trim), the position reading and Leave the helm - each
button pressing the SAME registry action its key presses, through the mod's own input seam, so the keys stay, and a
button presses with no key bound. The mouse clicks it while the pointer is free (`FreeMouse`, Y); a finger taps it;
and at the helm a pad's bare d-pad is the helm's (up the sails, held the square sails; down the lanterns, held leave
the helm; left and right the time scale, held the trim), none of it a binding - so the table below keeps no Pad row
for the nine, and the prompt bar says what the d-pad does there. Aboard another player's boat (CSA-K) there is no
key and no button: the helm is its owner's.

HELM-KEYS (2026-09-29, the player: "Arrow keys should not only control your ship, but also setting and raising your
sails. I also want to find a way to make the ship controls more intuitive instead of a bunch of buttons and key
binds") - THE ARROWS ARE THE HELM (DECLARED, the Port-Ledger's HELM-KEYS row):

- **Up and down, W and S: one ladder** (HELM-LADDER, 2026-10-04, from the field: "WASD and Arrow keys should function
  the same when controlling") - `MoveForwards` or `BoatSailUp` climbs a rung a press, `MoveBackwards` or `BoatSailDown`
  comes down one (`systems/comeSailAway.js ladderUp, ladderDown`): the oars backing water, at rest, pulling ahead, then
  her sails and, where the square sails are the player's own (the assist's AutoStowSquareSails off, a hull with both
  kinds), all her canvas - More sail and Less sail's steps above the oars. The oars keep their rung with no key held. A
  step with nowhere to go says so. End still toggles all her canvas, the brackets still trim.
- **Left and right steer**: at a helm DFU's `TurnLeft` and `TurnRight` - the arrows - are the RUDDER's, as A and D are
  (`inputActions.js HELM_RUDDER_ACTIONS`, read through the mod's own input seam, its rudder's swing too), and the
  keyboard look does not turn the view with them there. One action, one meaning - a turn - read by whoever the hands
  are on. Under the travel view the look keys stay the view's (TV1).
- **The up arrow is a DEFAULT SHARE** (`inputActions.js DEFAULT_SHARES`): law 3 ships every OWNER once, and the up arrow
  is PROF1's `ActChoice` - so More sail answers it beside its owner (UXB1-S's share, shipped as a default), seated only
  onto the partner's own key (a player's own rebind of the arrow is never shared onto) and, on a saved file, only
  while More sail is keyless and not unbound on purpose. The two are never live together: a helm's hands are on the
  wheel, and the professions read no choice there (`world.js`). The down arrow was free.
- **The helm panel teaches them**: its line under the name is the helm's hand at a glance - her oars and her sails on
  W, S and the arrows, the rudder on A, D and the turn keys, as bound now - and its sails' button is the toggle (End). IN IRONS (her sails up, her bow within IRONS_TELL_DEG of the wind's eye, her way ahead through the water under
  IRONS_TELL_WAY - sternway counts, never the sea's current: AUDIT NAV2 F15) the helm is told once how she comes out -
  under the Classic helm strike sail and row her round, under the Responsive one put the helm over first (AUDIT NAV2
  F18) - and the panel's line says it, with the keys, while it lasts. AUDIT NAV2 F17: while an Overworld journey holds
  the helm (the travel view up) the panel is covered and the arrows' More sail and Less sail, and the sail toggle, stand
  down - the journey sets her sails, and the turn keys were already the view's there.

## The sea fight at the helm (NAV-H, 2026-09-28 - for Mac's read)

The naval arc spends NO key of its own; at a helm with guns three actions the player already has take the sea's
meaning (`03-World/Naval-Combat.md`):

- **SwingWeapon (the attack) is the broadside.** Held, the guns on the side the look is on are laid, the arcs and the
  splash zone drawn; let go, they fire. The drag under the held button and the look while it is held are the AIM's -
  the camera never freezes as a held swing freezes it (lookFilter.js's swing law stands down there) - so the look
  lays the range. A readied spell still eats the press first. A pad (`aimHold`) holds RT plainly at the guns - no
  gesture strokes, and its right stick looks - and the finger's swipe presses once and its drag is the look. At a
  rowboat's helm, which has no guns, the attack is the weapon's swing as ever.
- **Crouch is the BRACE**: ducking behind the rail - hits hurt less and the guns hold fire while it is held. Every
  letter key is spent, and a held Left Ctrl would turn the helm's W into the browser's close-tab; a pad's LB already
  crouches.
- **Interact (Activate)** throws the grapples on a struck ship in reach (the way off her, `BOARD_SPEED`), goes over her
  rail on foot, and opens a prize of yours again.

The readout names the player's own bindings in the Controls page's own words (`controlsConfig.js buttonText` over
`codeForAction`, the travel view's hint's reading); a pad's button, which is no key to print, is named by its action
(CSA-L's helm panel reads its hints the same way), and on a finger's screen the hints are taps and drags - hold and
drag to aim, lift to fire, a tap to board (the host's one activation arm), Crouch the touch table's press. The helm
panel's buttons and the pad's d-pad at the helm are Come Sail Away's nine and nothing of the guns'.

## AUDIT KB1 (2026-09-24, Mac: "Audit this before we merge")

Three lenses over the standard - the registry and the carry, the windows and the pad and the chat, the scene hosts -
found seventeen things; every one is paid and pinned by execution in `test/kb1_audit.test.js` (the pane's Escape in
`test/enhancedControls.test.js`). The ones that change what a player meets:

- **The carry's order** (above, law 6): a torch key saved as E no longer takes E from Interact; an old Travel
  Options key, the mod off, no longer takes the torch's G; a lost key is said, not silent.
- **Enter with the chat hidden** frees the mouse again (the claim stood for the panel's life - a dead key).
- **F8 in an automap** changes its background and nothing else; every routed world action answers the PRESS, not the
  auto-repeat (a held F8 or F9 was a shot or a save per repeat).
- **E closing a shop, a talk or a book window** is not also the next frame's Interact - a key a window takes joins
  no ring (DFU's PollInput never runs under a pausing window).
- **Windows closing on their own key** read the event's own modifiers and both dicts (`input.js eventAction`), so a
  combo closes what it opened and the pad's View / Menu close what they opened; a held key's repeat is swallowed, not
  an open-shut flicker. The classic pause, pack and rest windows take the secondary slot too.
- **The hotbar** presses a slot bound to a mouse button (while the game has the mouse).
- **Escape on the Controls page's prompt** answers No and keeps the staged binds (it left the section and threw
  them all away).
- **The classic grid and mouse popup** no longer offer the two hidden actions' slots.
- Listeners that hold no host ring (the hotbar, the windows) read keys without writing the host's modifier latch.

## TOUCH-HOLD - Interact on a phone and a pad (2026-10-01 part four, Mac: "Interact button + knife Use")

No Interact existed on a phone or in the pad's shipped layouts, and `Interact` (E) is the professions' start and their
hold - so a common herb, a body and the net's haul could not be played there. Now:

- **The pad, classic layer**: B (`JoystickButton1`) is `Interact` in the world - a PAD1 secondary row, filled into an
  old file at the next load like every pad row. B did nothing in the world (DFU's Back answers only while a window is
  up, and a window's press never reaches the world's edge ring - `ui/input.js`); in a window it is Back still.
- **The pad, Enhanced Plus**: LT (`JoystickAxis9Button0`) is `Interact` - every Plus button held a row, and a trigger
  holds while the right thumb draws the knife's line. Recast, which LT held, is the d-pad's right held. Layout 2
  (`ui/plusPad.js` `PLUS_PAD_LAYOUT_VERSION`): a store on layout 1 moves once, taking back layout 1's Recast on LT
  where it still stands (`PLUS_PAD_RETIRED`); a row the player set themselves stands. The Controller bindings window
  has the row.
- **The touch corner**: its third slot is `Interact` by default (`ui/touchButtons.js`, glyph E, held while the finger
  is) - the mode cycle and F a slot further in, the corner 16..344 px, inside the widest the HUD keeps clear of.
- **The prompts**: with a pad in hand the professions' prompts and lines name its button (B, LT, Circle) - the sea's
  readout's law (AUDIT NAV1); else the key.

## SHIFT-STOW - Shift in the pack (2026-10-04, Mac: "shift click to deposit items (like materials) needs to be a thing")

Law 2's: Shift is the pack's own modifier, not a registry action. It is read the way the classic window reads Control
(CM5) - a state from its down edge to its up edge - and, on both skins, off the pointer itself (`shiftKey` on the
click, the classic window's hover). Shift and the LEFT button on a pack item put the whole stack into the player's own
store beside it - the wagon, their storage, and (enhanced) the Materials Bag - in any action mode, with no how-many
popup; Control's popup is DFU's and stays as it was. The ground, a corpse, a container and a reward tray keep the
plain click. A right click stays the mode swap. The classic window's latch is per key (one Shift let go while the
other is held is still Shift), is never trusted across the page losing the keyboard, and a held Shift's repeated down
edge answers no box (AUDIT SHIFT-STOW). Shift is also Run's default key: holding Run while clicking a pack item beside
the wagon deposits it. Port-Ledger A, SHIFT AND A CLICK STOW THE WHOLE STACK.

## The defaults

Generated from `ACTION_GROUPS` and the two default tables; the enhanced pane draws exactly these groups. Held so by `test/audit0928_input.test.js` (AUDIT PRE-MERGE 0928 D2: the Come Sail Away table had shown two of its nine rows).

### Movement

| Action | Key | Pad | What it does |
|---|---|---|---|
| `MoveForwards` | W |  | Move forwards |
| `MoveBackwards` | S |  | Move backwards |
| `MoveLeft` | A |  | Move left |
| `MoveRight` | D |  | Move right |
| `TurnLeft` | LEFT |  | Turn left |
| `TurnRight` | RIGHT |  | Turn right |
| `LookUp` | INS |  | Look up |
| `LookDown` | DEL |  | Look down |
| `CenterView` | HOME |  | Centre the view |
| `TogglePerspective` | MOUSE4 |  | First / third person |
| `Jump` | SPACE | `JoystickButton5` | Jump |
| `Crouch` | C | `JoystickButton4` | Crouch |
| `Run` | LSHIFT | `JoystickButton8` | Run |
| `AutoRun` | MIDDLE CLICK |  | Auto run |
| `Sneak` | LALT |  | Sneak |
| `WalkMode` | (unbound) |  | Walk mode on / off |
| `FloatUp` | PG UP |  | Float up (levitate, swim) |
| `FloatDown` | PG DN |  | Float down (levitate, swim) |

### Combat

| Action | Key | Pad | What it does |
|---|---|---|---|
| `ReadyWeapon` | Z | `JoystickButton9` | Ready or sheathe weapon |
| `SwingWeapon` | RIGHT CLICK | `JoystickAxis10Button0` | Swing weapon |
| `SwitchHand` | H |  | Switch hand |

### Magic

| Action | Key | Pad | What it does |
|---|---|---|---|
| `CastSpell` | BCKSPC | `JoystickAxis9Button0` | Spellbook |
| `RecastSpell` | Q |  | Ready the last spell |
| `AbortSpell` | ` |  | Drop the readied spell |
| `UseMagicItem` | U |  | Use magic item |

### Interaction

| Action | Key | Pad | What it does |
|---|---|---|---|
| `ActivateCenterObject` | LEFT CLICK |  | Activate (mouse) |
| `Interact` | E | `JoystickButton1` | Interact |
| `StealMode` | F1 |  | Steal mode |
| `GrabMode` | F2 |  | Grab mode |
| `InfoMode` | F3 |  | Info mode |
| `TalkMode` | F4 |  | Talk mode |
| `QuickLootAll` | P |  | Take everything |
| `QuickLootOpen` | J |  | Open the container |
| `Transport` | T |  | Transport |
| `Rest` | R |  | Rest |

### Windows

| Action | Key | Pad | What it does |
|---|---|---|---|
| `Escape` | ESCAPE | `JoystickButton7` | Pause menu |
| `CharacterSheet` | F5 |  | Character sheet |
| `Inventory` | F6 | `JoystickButton6` | Inventory |
| `Status` | I |  | Status |
| `LogBook` | L |  | Quest log |
| `NoteBook` | N |  | Notebook |
| `AutoMap` | M |  | Map |
| `TravelMap` | V |  | Travel map |
| `QuickDial` | TAB |  | Quick dial |
| `TravelView` | (unbound) |  | Overworld (the travel view) |

### Quickslots and hotbar

| Action | Key | Pad | What it does |
|---|---|---|---|
| `QuickUse1` | A1 | `JoystickAxis7Button0` | Use quickslot 1 / hotbar slot 1 |
| `QuickUse2` | A2 | `JoystickAxis7Button1` | Use quickslot 2 / hotbar slot 2 |
| `QuickSpell` | A3 | `JoystickAxis6Button1` | Ready quickslot spell (hold to cycle the book) / hotbar slot 3 |
| `QuickOffHand` | A4 | `JoystickAxis6Button0` | Off hand: light, douse or swap / hotbar slot 4 |
| `QuickSwap` | (unbound) |  | Swap weapon |
| `Hotbar5` | A5 |  | Hotbar slot 5 |
| `Hotbar6` | A6 |  | Hotbar slot 6 |
| `Hotbar7` | A7 |  | Hotbar slot 7 |
| `Hotbar8` | A8 |  | Hotbar slot 8 |
| `Hotbar9` | A9 |  | Hotbar slot 9 |
| `Hotbar10` | A0 |  | Hotbar slot 10 |

### Mouse

| Action | Key | Pad | What it does |
|---|---|---|---|
| `ActivateCursor` | ENTER |  | Free the mouse (offline) / open chat (online) |
| `FreeMouse` | Y |  | Free the mouse (press again to look) |

### Online

| Action | Key | Pad | What it does |
|---|---|---|---|
| `SocialInteract` | F |  | Interact with player |

### Professions

| Action | Key | Pad | What it does |
|---|---|---|---|
| `ActChoice` | UP |  | At a profession node: the next of its acts on the list |
| `Professions` | DOWN |  | Open your Professions and Stores (online) |

### Game

| Action | Key | Pad | What it does |
|---|---|---|---|
| `QuickSave` | F9 |  | Quick save |
| `QuickLoad` | F11 |  | Quick load |
| `PrintScreen` | F8 |  | Screenshot |
| `DebugOverlay` | (unbound) |  | Diagnostics readout |

### Handheld Torches (drawn, and answering, while `handheld-torches` is on)

| Action | Key | Pad | What it does |
|---|---|---|---|
| `TorchToggleLight` | O |  | Light or douse |
| `TorchDrop` | G |  | Drop the light |
| `TorchThrow` | X |  | Throw a torch (hold to charge) |

### Eye of the Beholder (drawn, and answering, while `eye-of-the-beholder` is on)

| Action | Key | Pad | What it does |
|---|---|---|---|
| `ShoulderSwitch` | B |  | Switch shoulder |
| `AutoPerspective` | KPADADD |  | Auto perspective on/off |

### Travel Options (drawn, and answering, while `travel-options` is on)

| Action | Key | Pad | What it does |
|---|---|---|---|
| `FollowPaths` | K |  | Follow the road |

### Horse Cart and Cargo (drawn, and answering, while `horse-cart-and-cargo` is on)

| Action | Key | Pad | What it does |
|---|---|---|---|
| `HorseMount` | , |  | Mount or dismount |
| `HorseSummon` | . |  | Summon horse and wagon |

### Come Sail Away (drawn, and answering, while `come-sail-away` is on)

| Action | Key | Pad | What it does |
|---|---|---|---|
| `BoatSailUp` | UP |  | More sail |
| `BoatSailDown` | DOWN |  | Less sail |
| `BoatDisembark` | ' |  | Leave the helm |
| `BoatToggleLight` | ; |  | Light or douse the boat’s lanterns |
| `BoatToggleSail` | END |  | Raise or stow the sails |
| `BoatTrimRight` | ] |  | Trim the sails right |
| `BoatTrimLeft` | [ |  | Trim the sails left |
| `BoatTrimModifier` | \ |  | Trim the square sails (hold) |
| `BoatTimeScaleUp` | KPADMULTIPLY |  | Speed time up at the helm |
| `BoatTimeScaleDown` | KPADSUBTRACT |  | Slow time down at the helm |
| `BoatTimeScaleReset` | KPADENTER |  | Put time back to normal at the helm |


Not on the page: `ToggleConsole` and `Slide` (HIDDEN_ACTIONS). The classic grid still draws DFU's thirty-eight
buttons on its fixed art, Slide's among them, unbound.

## The enhanced page

- Every group above, a vendored mod's only while the mod is on.
- A row's button arms a capture; the next key or mouse button binds (Ctrl, Shift or Alt held binds the combo).
- A held key asks (law 4). The question stands in the page's sticky head, over the list it leaves in place: the row
  the key would go to is edged in brass, the row that holds it in red, and the list is inert until it is answered
  (UXB1-D, 2026-09-25 - it used to replace the list, and a player lost their place in 60 rows).
- Right-click or the row's ✕ CLEARS a binding at once - no question, staged like every other edit, so leaving the
  page still drops it (UXB1-C, 2026-09-25, the UX backlog: "Having to scroll back to your key is bad"). The classic
  grid keeps DFU's own remove prompt.
- A key can do more than one thing (law 3, UXB1-S): the held-key question's third answer, USE FOR BOTH, keeps the
  holder and adds the key here; a shared key is green on every row it answers, and each row names what else it does
  ("Also: Jump"). The case that asked for it ("jump+swim-up") needs no share at all, and the page says so: Float up
  and Float down say, in the live keys, that Jump and Crouch already raise and lower a swimming or levitating body
  (LevitateMotor.cs:86-89), and giving Jump's key to Float up adds "you need neither" (`floatHint`,
  `sharedFloatNote`) beside the three answers - Use for both included (AUDIT UXB1 F10: a share would only take Float
  up off its own key).
- A shared key's actions run owner first, and **a window one of them opens ends the press** (AUDIT UXB1 F1) - above
  ground a chat or menu surface too: the window owns the keys from there, so a key shared by two windows' doors opens
  the first, not both stacked.
- **A newer build's shares ride through** (AUDIT UXB1 F3/F8), as `unknown` carries its owners: a name this build does
  not know, beside a known owner, and the whole list of a key whose owner it does not know (that key is not bound
  here) are written back out while the key's owner is the one they were loaded under. A key rebound, cleared or
  handed on here is this build's, and a full reset takes them with the primary's own shares.
- **Defaults is staged**, as the page's own sentence says ("Nothing is saved until you press Confirm"): DFU's
  SetDefaults reset the live registry and saved on the spot; here Confirm commits the reset (with its joystick
  tail and removal marks) and any edit made after it. Leaving the page drops everything staged. (The button read
  Continue until UXB1-B, 2026-09-25: it commits, and says so.)
- **Keys that do not move** close the page (UXB1-F): DaggerfallShortcut's HUD three (Large HUD, HUD, Retro Mode's
  post-processing) and the Transport window's letters - F, H, C, S behind the Transport key - read off the shortcut
  table, as words and keys with no buttons. A mod's own keys are named on its Features tile too, read-only, with one
  press through to this page.

## PAD-BINDS and PAD-ARRANGE (FIELD BUGS 2026-10-04e)

The Controller bindings window (Enhanced Plus) has an Overworld and a Quick dial row, and both are d-pad tap or hold
choices while the crossbar is in force - the Overworld on no key at all is the host's own door (`padAction`, the
Overworld's alone). Under a window LT raises the hotbar to be arranged: A takes a slot in hand and puts it down on the
press's click (a swap or a move), Y clears one; with the pad in hand "Add to hotbar" puts the new entry in hand and
asks for a slot - A on it, or a bumper and the slot's own button on the crossbar (LB + X places too, never the quick
act); on the row of ten the bumpers stay the tabs'. The mouse taking the hands back lets go of the hand. The record: `01-Overview/Field-Bugs-2026-10-04e.md`.
