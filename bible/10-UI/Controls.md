# Controls

The keybinding standard: which actions have keys, what each default is, and how the controls pages rebind them. Every
world key goes through one registry, `src/systems/inputActions.js` (`ACTIONS`, `DEFAULT_BINDINGS`,
`DEFAULT_SECONDARY_BINDINGS`, `DEFAULT_SHARES`, `ACTION_GROUPS`, `MOD_ACTIONS`, `HIDDEN_ACTIONS`), read through
`src/ui/input.js`. The player rebinds on the enhanced page (`src/ui/enhanced/enhancedControls.js`) or the classic grid
(`src/ui/controlsWindow.js`, with its ADVANCED popup `src/ui/mouseControlsWindow.js`).

## How it works

**Reading keys.** `held`, `pressed`, `released` and `actionsOf` resolve codes, combos included, against the player's
bindings at the moment of the read, so a rebind applies at once. A mod switched off answers nothing on its keys
(`actionLive`); its keys stay bound. A mod that takes effect at the next load answers as its host latched it at mount
(`latchModLoaded`). Windows read the event's own modifiers and both binding slots (`eventAction`); a held key's
auto-repeat is swallowed.

**A window's own keys** are the window's: Escape and Enter, the maps' arrows and +/-, Y/N on a message box, the
letters a DFU window binds through its shortcut table (`src/systems/dialogShortcuts.js`), the dial's WASD. They answer
only while their window is on top. A window that closes on its own key closes on that action's binding, plus the back
button.

**Shared keys.** No default code ships twice, except the declared default shares (`DEFAULT_SHARES`: the up arrow is
`ActChoice` and More sail; K is `FollowPaths` and `Spyglass`), which are never live together. A player may share a key
between actions; it then does all of them, owner first, and a window one of them opens ends the press.

**Binding a held key asks.** In every controls window, binding a key another action holds asks "X is used by Y. Give
it to Z instead?": Yes unbinds the holder, No stages nothing, **Use for both** shares the key. A combo against its own
bare modifier is DFU's clash and still blocks.

**The enhanced page.** A row's button arms a capture; the next key or mouse button binds (a held Ctrl, Shift or Alt
binds the combo). The held-key question stands in a modal tooltip beside the binding. Right-click or the row's ✕
clears a binding at once, staged. A shared key is green on every row it answers ("Also: Jump"). Float up and Float
down say that Jump and Crouch already raise and lower a swimming body (`floatHint`). Defaults is staged, and nothing is
saved until Confirm; an unsaved row says "Not saved yet - press Confirm." and the head counts what Confirm owes
(`unsavedEdits`). Keys that do not move (the HUD shortcuts, the Transport window's letters) are listed without buttons.
A newer build's shares ride through untouched.

**Old files come forward.** The keybinds file carries `KEYBINDS_VERSION` (4). An older file lets go of old defaults
where they still hold them, lands new defaults on keys the player left free, and carries a mod key the player saved
onto a key still free. A player's choice never takes a key from another action. What could not be carried is told on
the HUD once (`keybindCarryNotes` in `src/systems/controlsConfig.js`).

**Notable defaults.**
- E is `Interact`; `AbortSpell` is `` ` ``.
- Online, Enter opens chat (`claimCursorKey`, per press, only when the chat can open); Y (`FreeMouse`) frees the mouse.
  Offline, Enter frees the mouse as DFU does.
- The digit row is the quick slots and hotbar: 1 to 4 the diamond and the hotbar's first four, 5 to 0 hotbar slots 5
  to 10 (`hotbarInForce` decides which bar). Horse Cart and Cargo's keys are `,` and `.`.
- C crouches and sneaks; `Sneak` ships unbound for DFU's held slow walk. Hold Left Alt for the mode wheel
  (`src/ui/modeWheel.js`): flick to Talk, Grab, Steal or Info. F1 to F4 ship unbound.
- `CenterView` (Home) levels the view and `PrintScreen` (F8) saves a screenshot (`10-UI/Loading-Screens.md`); DFU binds
  both and reads neither. `ToggleConsole` and `Slide` ship unbound and hidden. The diagnostics readout is
  `DebugOverlay`, unbound.
- `SaddlePanel` (F2) shows or hides the saddle panel (`10-UI/UI-Calm.md`).
- At a helm, the turn keys and A/D are the rudder (`HELM_RUDDER_ACTIONS`); W/S and the arrows climb and descend one
  ladder of oars and sail; the attack is the broadside, Crouch the brace, Interact the grapples. The helm panel
  (`src/ui/enhanced/enhancedHelm.js`) presses the same registry actions as Come Sail Away's keys, and a pad's d-pad is
  the helm's there.
- Shift and a left click on a pack item put the whole stack into the player's own store beside it (wagon, storage,
  Materials Bag) with no popup; Shift is the pack's modifier, not a registry action.

**Pads and touch.** On the classic pad layer B is `Interact` in the world and Back in a window; on Enhanced Plus LT is
`Interact` (`src/ui/plus/plusPad.js`, `PLUS_PAD_LAYOUT_VERSION` moves an old layout once). The touch corner's third
slot is Interact (`src/ui/touch/touchButtons.js`). Prompts name the pad's button when a pad is in hand. Under a window
LT raises the hotbar to be arranged with the pad.

## Rules

- One solid, organized keybinding standard: what needs keys, and every key working as intended (Mac).
- One registry owns every world key, the ported mods' included; a mod's group shows under its name while the mod
  is on.
- One key, one action by default; a player may share a key.
- A held key is asked for, never taken.
- No gameplay code reads a bound key by its raw code, except the reservations `test/ui/kb1_keybinds.test.js` names.
- E is Interact, Enter online is chat, the digit row is the quick slots and hotbar, and DFU's dead rows CenterView and
  PrintScreen are built while ToggleConsole and Slide are hidden (Mac).
- Shift-click deposits a stack (Mac).
- The tables below are generated from `ACTION_GROUPS` and the default tables, and the enhanced page draws exactly these
  groups (`test/systems/audit0928_input.test.js`).

## Daggerfall Unity

DFU's `InputManager` keeps one code-to-action table (`SetupDefaults`), saved by `SetBinding`, with its own clash law
(`getDuplicates`) and `SetDefaults` saving at once. We keep its actions and orientation, add our own and the mods'
actions, allow shares (a departure: DFU allows one action a key), stage Defaults until Confirm, and replace its remove
prompt with a staged clear on the enhanced page. The classic grid keeps DFU's own prompts and its thirty-eight buttons.

## The defaults

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
| `CenterView` | HOME |  | Center the view |
| `TogglePerspective` | MOUSE4 |  | First / third person |
| `Jump` | SPACE | `JoystickButton5` | Jump |
| `Crouch` | C | `JoystickButton4` | Crouch and sneak |
| `Run` | LSHIFT | `JoystickButton8` | Run |
| `AutoRun` | F3 |  | Auto run |
| `Sneak` | (unbound) |  | Sneak (held, no crouch) |
| `WalkMode` | (unbound) |  | Walk mode on / off |
| `FloatUp` | PG UP |  | Float up (levitate, swim) |
| `FloatDown` | PG DN |  | Float down (levitate, swim) |

### Combat

| Action | Key | Pad | What it does |
|---|---|---|---|
| `ReadyWeapon` | Z | `JoystickButton9` | Ready or sheathe weapon |
| `SwingWeapon` | RIGHT CLICK | `JoystickAxis10Button0` | Swing weapon |
| `SwitchHand` | H |  | Switch hand |
| `WeaponTechnique` | MOUSE3 |  | Weapon technique (hold to aim) |
| `SignatureTechnique` | (unbound) |  | Martial technique (hold to aim) |
| `ShotCycle` | (unbound) |  | Shot (aboard) |

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
| `Decorate` | (unbound) |  | Decorate this room |
| `ModeWheel` | LALT |  | Mode wheel (hold, flick, release) |
| `StealMode` | (unbound) |  | Steal mode |
| `GrabMode` | (unbound) |  | Grab mode |
| `InfoMode` | (unbound) |  | Info mode |
| `TalkMode` | (unbound) |  | Talk mode |
| `QuickLootAll` | P |  | Take everything |
| `QuickLootOpen` | J |  | Open the container |
| `Transport` | T |  | Transport |
| `Rest` | R |  | Rest |
| `SaddlePanel` | F2 |  | Saddle panel: show or hide (riding) |
| `PartyPing` | MIDDLE CLICK |  | Ping |

### Windows

| Action | Key | Pad | What it does |
|---|---|---|---|
| `Escape` | ESCAPE | `JoystickButton7` | Pause menu |
| `CharacterSheet` | F5 |  | Character sheet |
| `Inventory` | F6 | `JoystickButton6` | Inventory |
| `Status` | I |  | Status |
| `LogBook` | L |  | Chronicle: Quests (Enhanced Plus) / logbook (Classic) |
| `NoteBook` | N |  | Chronicle: Notes (Enhanced Plus) / notebook (Classic) |
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
| `PvpFlag` | CAPS |  | PvP on / off |

### Professions

| Action | Key | Pad | What it does |
|---|---|---|---|
| `ActChoice` | UP |  | Next action at a profession node |
| `Professions` | DOWN |  | Open your Professions page, or the Crafting page at a station (online) |

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
| `Spyglass` | K |  | Raise or lower the spyglass (aboard) |
| `ShipHold` | F4 |  | Cargo |

### Project Legacy (drawn, and answering, while `project-legacy` is on)

| Action | Key | Pad | What it does |
|---|---|---|---|
| `LegacyFamily` | KPADDIVIDE |  | Family tree |

Not on the page: `ToggleConsole` and `Slide` (`HIDDEN_ACTIONS`). The classic grid still draws DFU's thirty-eight
buttons on its fixed art, Slide's among them, unbound.

## Code and tests

- `src/systems/inputActions.js` - the registry, defaults, groups and file version
- `src/ui/input.js` - the readers every key goes through
- `src/systems/controlsConfig.js` - the carry, unsaved edits, button text
- `src/ui/enhanced/enhancedControls.js` - the enhanced page
- `test/ui/kb1_keybinds.test.js` - the standard's laws and the raw-code sweep
- `test/ui/kb1_audit.test.js` - carry order, Enter and chat, window closes, the hotbar on mouse buttons
- `test/systems/audit0928_input.test.js` - the tables on this page against the registry

