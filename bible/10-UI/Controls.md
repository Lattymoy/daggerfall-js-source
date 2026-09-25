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
   for when it is switched back on. No gameplay code reads a bound key by its raw code except the reservations the
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
  `ToggleConsole` and `Slide` ship unbound and off the page, freeing `` ` `` and Left Ctrl. The dungeon's
  diagnostics readout, a raw F8 that answered only while F8 was unbound, is the `DebugOverlay` action, unbound.

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

## The defaults

Generated from `ACTION_GROUPS` and the two default tables; the enhanced pane draws exactly these groups.

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
| `Jump` | SPACE | `JoystickButton5` | Jump |
| `Crouch` | C | `JoystickButton4` | Crouch |
| `Run` | LSHIFT | `JoystickButton8` | Run |
| `AutoRun` | MIDDLE CLICK |  | Auto run |
| `Sneak` | LALT |  | Sneak |
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
| `Interact` | E |  | Interact |
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
