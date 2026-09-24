# FIELD BUGS 2026-09-24 — DISC16, six from Discord and the city watch

Mac, with the Discord screenshots: *"I want to fix these issues + enhance
guard interaction"*.

1. *"leaving the game undoes your lycanthropy/vampirism"* - "i became a
   werewolf, tried joining into online (made a backup save beforehand) and
   when i loaded in, i had my old stats. i went back into the regular game
   and on both save files (new and old) i had my old stats" / "ive still
   got the spell in my inventory it just doesnt do anything"
2. *"Playing online makes my vampire character human again"* - "i turned
   my character into vampire twice now and it keeps reverting it"
3. *"rested while poisoned put me into an infinite death loop"* - "trying
   to respawn just loads me in and kills me instantly. it overwrote all my
   saves as i respawned too"
4. *"Light spell does not work in dungeons"*
5. *"In a dungeon that I cant hurt enemy's"* - "Ruin of tower yeomham"
6. *"Cant enter Mannimarcos room"* - "I went to scourg barrow but the door
   to his room wont open in online, offline and even if i bash it doesnt
   make a sound" (a second player: "Same problem here")
7. *"Guards are lazy..."* - "guards will arrest and attack me for resting
   within city limits but will not protect me from 5 angry centaur
   invaders who wanna beat me to death in town?"

Every report was reproduced in node before it was touched, except where a
section says it could not be. The pins are `test/disc16.test.js`, and the
mutant set is `tools/mutants/disc16.json`.

---

## DISC16-A: the curse that a load took away (reports 1 and 2)

**Cause.** DFU keeps a racial override alive with
`forcedRoundsRemaining = 1`: `RoundsRemaining` always answers it and
`RemoveRound` never counts it down (RacialOverrideEffect.cs:28, :71-80). A
cure sets it to 0 (LycanthropyEffect.cs:485, VampirismEffect.cs:306), and
the next `DoMagicRound` removes the bundle (EntityEffectManager.cs:1727-1759).
`DiseaseEffect` does the same (DiseaseEffect.cs:32, :67-77), and the two
infections inherit it.

The port's word for that is `permanent: true`, which every disease and
poison entry carries. The two curse entries (`createLycanthropyCurse`,
`createVampirismCurse`) and the infection entry (`createInfection`) carried
neither `permanent` nor a round count. So `tickActiveEffects` ran them as
timed effects:
- Each live round took the absent `roundsRemaining` to `NaN`. `NaN <= 0` is
  false, so the curse lived on in the session and nothing looked wrong.
- The save's JSON wrote the `NaN` as `null`.
- The first magic round after ANY load read `null <= 0` and dropped the
  entry. A werewolf or a vampire came back human, and the spell stayed in
  the book with nothing behind it.

Going online is a load (the online door boots `?load`), which is why both
reports name it. The same path cured a bite that had not yet turned.

The node repro: a werewolf and a vampire, a few rounds, snapshot, JSON,
restore, three rounds. Before the fix both curses were gone after the first
round. After it both stand, offline and after the online arrival's clock
shift.

**Fix.**
- The three constructors mint `permanent: true`, DFU's forcedRoundsRemaining.
  The cure's `ended` is its `forcedRoundsRemaining = 0`, and the entry
  leaves the list at the next round, as DFU's bundle does.
- `restorePlayer` sets the flag on every racial-override and infection entry
  it restores. The entries were saved whole, so a save written before this
  fix (the reporters' own) gives the player the curse back.

This is a 1:1 correction; no departure.

## DISC16-B: the Light spell underground (report 4)

**Cause.** DFU's `LightNormal.StartLight` hangs a MagicCandle 1.4 units in
front of the player (LightNormal.cs:80-103, with DFU's own comment that the
short distance is for dungeons), wherever the player stands. The port gives
every casting host its own engine and candle. The dungeon context builds its
own (`dungeonContext.js`), and the casts underground (the spellbook and the
click) go through it, which is why the candle's flame is drawn.

The world host's dungeon frame (`worldModes.js`, the `mode === 'dungeon'`
branch) built its point-light list with `magic?.candleLight()`. That is the
WORLD host's engine, and nothing updates it underground:
- the branch returns before any `magic.update`;
- the host's own update runs only in exterior mode.

So a Light cast in a dungeon drew its flame and lit nothing. A Light cast
outdoors before going down stood lit at the street's coordinates for the
whole visit. The standalone `?dungeon` host read the context's candle and
was correct. That host is the only one the X11 probe loads, which is how
this shipped.

**Fix.** The dungeon frame reads `dungeonCtx.candleLight()`, the accessor
the standalone host already used. The note on it that said "?world reads
magic.candleLight() directly off its own engine" is corrected.

This is a 1:1 correction. Not seen on a GPU. The node repro (two real
engines, a Light cast through the dungeon's, the branch's light list
replayed) put the candle in slot 0 after the fix and nowhere before it.

## DISC16-C: the death loop that wrote itself into every slot (report 3)

**Not the rest.** A poison that kills a sleeping player is DFU's own law.
- Effects run through a rest (EntityEffectBroker.cs:204-236, "e.g. rest").
- A poison catches up minute by minute (PoisonEffect.cs:183-201).
- The rest ends with "youNeverAwaken" (DaggerfallRestWindow.cs:217-220).
- DFU makes no poison check before a rest.

The port does the same, and that part stands.

**Cause.** Two port-only save paths turned one death into dead saves.

1. **ONLINE-AUTOSAVE1** (`scenes/world.js`, the `beforeunload` handler)
   writes the QuickSave and every slot the character already has when an
   online page closes (the tab, a reload, Back, quit to menu). It asked
   only for a live session and a spawned player. Closing on the death
   screen wrote the corpse, still poisoned, into every slot. DFU never
   writes during a death: PlayerDeath pauses the game and ends in
   TitleMenuFromDeath.
2. **The online load's revival** (ONLINE-DEATH-FIX + DEATHLOOP1,
   `restorePlayer`) ran right after the entity fields were copied. That is
   BEFORE the save's `survival` and `activeEffects` are restored, so it
   ended the drains and the exposure of the entity being replaced. The save's
   poison and cold were then put back over the revival. Each slot loaded at
   half health with the poison on and died again, and each quit from that
   death wrote the corpse into every slot once more. DEATHLOOP1's pin checks
   only that the call exists. Its test save had no effects, so the order
   never showed.

On top of that, the death screen told an online player "ENTER end   F11
load". Online, ENTER respawns and loading is refused, so the hint sent
players to quit from the death screen, which is exactly when (1) fired.

The same player's report 1 ("on both save files (new and old) i had my
old stats") is (1) as well. Leaving online wrote the curse-less player of
DISC16-A over the backup save made beforehand.

**Fix.**
- `saveSlots.exitAutosaveNames` answers the handler's slots and returns
  NONE while the player is dead or any host's death screen is up (the
  exterior's, a building's, a dungeon's).
- `restorePlayer` decides the revival on the save's own health but runs it
  after the effects and survival are restored. The dead save comes back
  at the respawn health, without the poison or the cold, and stays alive.
- An online page's death screen says `ENTER respawn` (`ONLINE_DEATH_HINT`).

**Recorded, not changed.**
- Offline, a dead save still loads at 0 HP (ONLINE-DEATH-FIX's pinned
  "OFFLINE is unchanged"). The reporter's overwritten slots load alive
  online. The exit autosave writes no new corpse.
- Online, a rest outdoors or in a building runs only the shared clock's real
  minutes through the magic rounds, while a dungeon's rest runs the rested
  minutes. So online a poisoned rest kills only underground. It is not
  this loop, and it is left for the online arc.

## DISC16-F: the watch and the town (report 7, and Mac's "enhance guard interaction")

**The arrest for resting is DFU's law, and it stays.**
- `CanRest` asks `IsPlayerInTown(true, true)` (DaggerfallRestWindow.cs:549).
- That test is outdoors, one of the seven town types, and inside the
  town's rect widened by a full block (PlayerGPS.cs:504-527, :671-691). The
  widening is why the outskirts count.
- A player inside it commits Vagrancy and the watch spawns (:558-559). The
  While and Healed buttons first show the IllegalRestWarning Yes/No box
  (:642-682), and "No" commits nothing.
- The port matches it: `restSession.canRest`, `_isPlayerInTownStrict`, the
  warning in both skins. A rented room, an owned house or ship, and a
  guild's privilege are all respected.

**Why five centaurs were in town.** Centaurs come only from DFU's "not in
location" encounter tables, and DFU's own town spawns are one foe at a time,
at night. Five of them together is a CAMP1 camp, the port's own group
encounter (`systems/campEncounters.js`, 3-5 foes). Its gate ("camps are a
wilderness thing") had two holes:
- **The roll's frame.** The chunk-load roll fires on the frame a new map
  pixel is entered and asked `_musicInLocationRect()`. That tests the
  location syncTopics resolved LAST, which on that frame is still the
  previous pixel's. Walking into a town's pixel read "not in a town".
- **The placement.** The gate tested the player alone. The group is placed
  14-26 units away, so a player at the rect's edge could have a camp
  pitched inside the town.

**Fix (the camp).** `_inAnyLocationRect` tests a point against the widened
rect of every location in its pixel and the eight around it (a rect widened
by a block can cross its own pixel's edge). The chunk roll asks it for the
player, and the placement rejects an anchor or a member inside any rect.

**Enhancement: the watch defends the town** (`systems/townWatch.js`,
`scenes/cityGuards.js` `summonDefenders` / `dismissDefenders`, the Features
row `town-watch`, on by default). DFU's combat watch exists only for a
crime, so nothing in DFU ever put a guard between a monster and the player.
The port's own rule:
- **When.** A hostile monster of this client's own is hunting the player
  inside the town's widened rect. The player is not wanted and not a
  transformed lycanthrope. Quest foes, pacified foes, the player's allies
  and a peer's puppets never count.
- **After.** DFU's witnessed-crime arrival countdown, Random.Range(5, 11)
  seconds. A player who leaves the pixel inside the window is not followed.
- **Where.** The crime response's own places: the wandering guards within
  77.5 of the player first (converted where they stand), else 2-5 at the
  spawner's band, out of view. They share the watch's cap of five.
- **As what.** The player's ALLIES: team PlayerAlly on both per-instance
  fields, the allied summon's shape, sent at the nearest threat. DFU's own
  target chain then picks the monster and never the player, and the watch's
  existing guard-vs-monster melee fights it.
- **Until.** Ten quiet seconds, the player leaving town, or the switch going
  off, and they walk away with no body. They are not saved; a load that
  restores the monsters raises the answer again.
- **A crime** (a blow on a defender is one) makes them the ordinary watch
  on the spot, hunting the player.
- **The player's swing** spares them. The host resolves the watch's pool
  before the monsters', so a defender in reach beside the centaur took the
  swing meant for it. Friendly protection now runs across the two pools:
  the watch, then the monsters, then a defender alone, then the townsfolk.

Port-Ledger A records the departure: THE WATCH DEFENDS THE TOWN. Online,
each player's own monsters bring that player's defenders, who ride the
watch's stream as puppets. The wire's watch record carries no team, so a
peer sees a watchman. Not seen in a browser.
