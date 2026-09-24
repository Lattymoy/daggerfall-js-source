# FIELD BUGS 2026-09-24 — DISC19, six from Discord and the city watch

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
section says it could not be. The pins are `test/disc19.test.js`, and the
mutant set is `tools/mutants/disc19.json`. The batch's audit (AUDIT DISC19,
the last section) has its own: `test/auditdisc19.test.js` and
`tools/mutants/auditdisc19.json`.

---

## DISC19-A: the curse that a load took away (reports 1 and 2)

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
  it restores. A save written before the curse's first load still holds the
  entry whole, and the flag gives that save its curse back. A save written
  after that load holds no entry to mend: the old build had already dropped
  it, and every later save (the exit autosave's overwrite of every slot
  among them) was written without it.
- **At the merge:** main landed the same fix the same day as CURSE-PERSIST1
  (the contributor's, ported), and the merge keeps main's lines. Main's
  CURSE-REPAIR1 (`systems/curseRepair.js`) also answers the saves above: a
  curse spell left in the book with no curse behind it gives the curse
  back, the vampire's clan read off its spells, without replaying its
  onset. That is what the reporters lost, so the audit's own answer (S1,
  which loaded those saves as mortals and cleared the residue) is
  withdrawn.

This is a 1:1 correction; no departure.

## DISC19-B: the Light spell underground (report 4)

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

## DISC19-C: the death loop that wrote itself into every slot (report 3)

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
DISC19-A over the backup save made beforehand.

**Fix.**
- `saveSlots.exitAutosaveNames` answers the handler's slots and returns
  NONE while the player is dead or any host's death screen is up (the
  exterior's, a building's, a dungeon's).
- `restorePlayer` decides the revival on the save's own health but runs it
  after the effects and survival are restored. The dead save comes back
  at the respawn health, without the poison or the cold, and stays alive.
- An online page's death screen no longer names keys that do nothing. This
  batch said `ENTER respawn`; at the merge, main's own death screen (DEATH4,
  DEATH6, AUDIT CONTRIB A5) already counted the online respawn down in the
  hint's place ("RISING IN n   ENTER now"), and this batch's hint was
  folded into it.

**Recorded, not changed.**
- Offline, a dead save still loads at 0 HP (ONLINE-DEATH-FIX's pinned
  "OFFLINE is unchanged"). The reporter's overwritten slots load alive
  online. The exit autosave writes no new corpse.
- Online, a rest outdoors or in a building runs only the shared clock's real
  minutes through the magic rounds, while a dungeon's rest runs the rested
  minutes. So online a poisoned rest kills only underground. It is not
  this loop, and it is left for the online arc.

## DISC19-D: the enemies no blow could reach (report 5)

"Ruins of Yeomham Tower" is a small DungeonRuin, map pixel (532,123)
(`Internal_Locations.csv:1974`, MapId 750903948). Its dungeon type and its
fixed monsters are in MAPS.BSA. No combat rule in DFU or the port keys on
the location type, and the report says nothing about the character, the
weapon or the switches. So this section names what the code can do, not
what that player saw.

**Found and fixed: a deploy turned every enemy of a dungeon into a picture.**
- The dungeon's foe subsystem loads its modules through one lazy
  `Promise.all`. Every module in it had a static importer elsewhere, so it
  was already on the page, except `ai/enhancedMotor.js`, which nothing else
  imports. The build gave it a lazy-only chunk (checked on the live site: a
  hashed `enhancedMotor-*.js` fetched by `import()`).
- Every deploy renames chunks, and GitHub Pages deletes the old ones
  (`systems/staleChunk.js`). A tab opened before a deploy asked for a file
  that was gone when it first entered a dungeon.
- The import failed and the whole subsystem was skipped. `buildFoeAt` fell
  back to a static flat for every marker. `resolvePlayerHit` found no foe,
  and spells and arrows walked the same empty list. The log said "without
  class enemies", which was every enemy, and nothing was shown on screen.
  The stale-chunk reload covers only the boot.
- **The symptoms:** enemies stand still, never attack, and cannot be hurt;
  a page reload fixes it. Seven merges reached main between 17:32 and
  21:11 EDT on 09-23, and the report came at 20:44.
- Reproduced in node (the investigator's harness): the real dungeon context
  over a one-block dungeon with a Giant Bat marker, the weapon rig swinging,
  and only that one import failed with Chrome's own words. Normally, 40
  swings landed 10 blows. With the import failed, `foes` was empty, the bat
  was a flat, and no swing touched anything.

**Fix.**
- `enhancedMotor.js` is a static import. Its own imports were static
  elsewhere already, so the lazy gate never saved their bytes.
- The failure log says what really fails.
- A stale chunk found mid-session is said on screen
  (`STALE_CHUNK_IN_PLAY_TEXT`, "Game updated - reload the page for
  enemies.", on the level's first frame for 12 seconds). There is no
  automatic reload here, because that would throw away unsaved progress.
- A pin holds the law: every module the foe block loads lazily is in the
  world host's static closure, so the page already holds it. The standalone
  `?dungeon` host still loads five of them late (AUDIT DISC19, D2).

**Mac's call: a hit chance with no floor, now clamped.** Two mods ship on
by default (MO1): Physical Combat And Armor Overhaul and Meaner Monsters.
- PCAAO's hit chance had no 3..97 clamp. The mod computes
  `Mathf.Clamp(chanceToHit, 3, 97)` and throws the result away, and the port
  kept that bug for bug (`05-Combat/Physical-Combat-Overhaul.md`).
- Dodging counts half, and a monster's Dodging is 5 x level + 30.
- Its soft-material rule means DFU's "ineffective" refusal never fires.
  The mod's own warning appears only when the damage multiplier is 0.45 or
  below.
- Measured for a skill-30 character with steel: 0 of 2000 blows landed on
  a Vampire or a Lich, 30 of 2000 on a Wraith, and nothing was said.
- Stock DFU refuses those blows with a message on every swing. Quests of
  the first rank send players at these monsters.

The choices were the mod author's intended clamp (a Ledger A departure that
also caps monster hits on the player at 97%), the bug as shipped, or both
mods off by default (reversing MO1). **Mac chose the clamp (2026-09-24,
option 1).** `pcaaoSuccessfulHit` applies `Mathf.Clamp(num, 3, 97)` - DFU's
own FormulaHelper clamp, which the stock core already applies - in both
directions. The same character now lands 55 of 2000 on a Vampire and 51 on
a Lich; a monster's certain blow on the player misses 3 in 100. The other
three clamps the mod discards stay discarded. Recorded on Ledger A's PCO1
row; pinned in `test/pcaao.test.js`.

## DISC19-E: the King of Worms' door (report 6)

**Not the door.** The throne room's entrance is S0000205 object 20251, model
55000.
- Its raw TriggerFlag_StartingLock byte is 0x1a, which decodes to lock 2
  with trigger None, plus a DoorText record that never holds the door
  (RDBLayout.cs:878, :1175-1176; DaggerfallActionDoor.cs:259-265).
- Lock 2 can be picked, opened with Open, or bashed at 18% a swing
  (DaggerfallActionDoor.cs:91-94, :208-217).
- The matching door of the neighbouring block, 1.2 m away, is removed as an
  overlap by DFU and by the port alike.
- Nothing in DFU special-cases Scourg Barrow. The King of Worms is placed
  from the block data, and no quest opens a door.

A silent bash also rules out every lock case. DFU and the port both play the
bash sound BEFORE any lock check, so no sound means no door was ever struck.

**Cause.** The corridor piece in front of the door (object 15785, model
63107) carries a DoorText record on Collision01, a walk-on trigger. The
port registers it by its placement AABB, and the door's face stands 5 cm
inside that box.
- **The press.** `nearestActivatableHit` takes the nearest box entry, which
  is the relay's. CASTLE1's surface rule ("a surface another target owns is
  that target's") ran only when the eye stood INSIDE a box, and the player
  stands outside this one. The relay refuses a Direct, so nothing answered
  and nothing was said. Lockpicking and an armed Open spell ride the same
  pick, so they failed too.
- **The swing.** `envAttack` is a plain nearest-box pick. The relay refuses
  an Attack, the pick was not a door, and so `attemptBash`, where the sound
  plays, never ran.

In DFU the corridor's collider is its own mesh, open at the doorway
(GameObjectHelper.cs:196-206), and the door's is a box sized to its bounds
(RDBLayout.cs:1147-1155). The ray and the sphere cast meet the door.

**Fix.** CASTLE1's rule, extended to a box the ray merely enters.
- `hasMeshCollider` names the targets DFU gives a MeshCollider: movers,
  special doors, and relays and effects minted from a placed model. An
  action door's and an acting flat's box IS their collider.
- When such a box is entered but the first surface the ray meets is ANOTHER
  target's own bucket, the ray never struck this object. The press
  (`nearestActivatableHit`) and the swing (`envAttack`) both skip it.
- A surface in the static bucket names nobody, so there the box decides, as
  before.

**Evidence.** It was checked on the game's own data, in scratch and never
in the repo, through the port's own layout, action system, collider, pick
and swing:
- From 3 m, 2 m, 1.2 m and 0.6 m out, before the fix the press picked the
  relay and the swing made no sound. After it, the lock speaks from all
  four, and the swing rings from every one inside the weapon's 2.5 m reach
  (at 3 m the door's box is 3.05 m off, and no swing reaches it in DFU
  either).
- A scan of all 187 dungeon blocks, every door head-on from both sides,
  found 22 presses and 101 swings stolen the same way. The Scourg block and
  the castle blocks of Daggerfall, Sentinel, Wayrest and Orsinium were among
  them. The fix leaves 0, with 0 regressions.

The pins rebuild the Scourg geometry synthetically. This is a 1:1
correction that narrows the port's box picking back toward DFU's single
raycast. Not seen in a browser.

## DISC19-F: the watch and the town (report 7, and Mac's "enhance guard interaction")

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

It covers cities, not hamlets (AUDIT DISC19). The roll fires on the frame
the player crosses into a pixel, at its edge, and a town's widened rect
reaches that edge only for a location six or more blocks wide on that axis:
a 1x1 to 5x5 location starts 256 down to 51 units inside it. So a camp at a
small town's pixel edge is still legal, as it always was, and can follow
the player in. The town watch is the answer there.

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
- **Where.** Two of the crime response's places: the wandering guards
  within 77.5 of the player first (converted where they stand), else 2-5 at
  the spawner's band, out of view. Not its third, the townsperson behind the
  player (PlayerEntity.cs:675-680): a defender is a guard who came. They
  share the watch's cap of five, and a summon still loading counts.
- **As what.** The player's ALLIES: team PlayerAlly on both per-instance
  fields, the allied summon's shape, sent at the nearest threat. DFU's own
  target chain then picks the monster and never the player, and the watch's
  existing guard-vs-monster melee fights it.
- **Until.** Ten quiet seconds, the player leaving town, or the switch going
  off, and they walk away with no body. A monster fighting a defender is
  not quiet. They are not saved; a load that restores the monsters raises
  the answer again.
- **How often.** At most three squads an incident; the count starts over
  once the town has been quiet ten seconds. A defender a monster kills
  carries nothing.
- **A crime** makes them the ordinary watch on the spot, hunting the player.
  A blow on a defender is Assault, the crime a blow on the wandering guard
  he was would be, and it enlists the whole squad at once.
- **The player's swing** spares them. The host resolves the watch's pool
  before the monsters', so a defender in reach beside the centaur took the
  swing meant for it. Friendly protection now runs across the two pools:
  the watch, then the monsters, then a defender alone, then the townsfolk.
  With MeleeAttackFriendlyProtection off, the first pass strikes them like
  anything else.
- **The player's spells, shafts and thrown torches** pass them by: the
  blast, the area, the missile and the touch, the arrow, the torch. A
  monster's still land.

Port-Ledger A records the departure: THE WATCH DEFENDS THE TOWN. Only the
world host runs it; the fixed-city host (`exterior.js`) has no watch.
Online, each player's own monsters bring that player's defenders, who ride
the watch's stream as puppets, and that has limits (AUDIT DISC19, recorded):
- the wire's watch record carries no team, so a peer sees a hostile
  watchman, with no ally protection: their swing at my monster can land on
  my defender;
- another player's monster hunting me brings no defenders unless its owner
  is in the town too, and my defenders never engage it (a puppet is no
  target).

Not seen in a browser.

---

## AUDIT DISC19

Mac: *"Do an audit on this"*. Four lenses read the batch: the watch, the
saves, the Light / chunk / door fixes, and the pins themselves. Each
confirmed finding was reproduced in node, fixed at its root and pinned in
`test/auditdisc19.test.js`; the mutants are `tools/mutants/auditdisc19.json`.

**The watch (F).**
- **W1, HIGH: the squad walked away mid-melee.** `isTownThreat` counted a
  monster only while it hunted the player. Once it turned on a defender
  (the player loses the tie), the town read quiet and the squad was
  dismissed ten seconds later, over and over. A monster fighting a live
  defender is a threat now.
- **W2, HIGH: a blow on a defender levied no crime and made a rogue.** The
  player's door reset `team` alone: the struck defender hunted the player
  for a second, then the other defenders, and read as a standing watch with
  no crime, which turned every wandering guard in town. A blow on a
  defender is Assault now (`handleAttackFromPlayer`), the whole squad is
  enlisted at once, and `anyWatchStanding` never counts a defender.
- **W3, HIGH: an armour farm.** A defender a monster killed kept the
  watch's kit, and a monster the squad could not beat drew a fresh one
  every countdown: 56 bodies and 70 items off one centaur in two minutes.
  Such a body carries nothing now (the WATCH1 peer-kill law), and an
  incident brings at most three squads (`TOWN_WATCH_MAX_WAVES`).
- **W4: the player's own harm struck them.** A Fireball at the centaur the
  squad was fighting hit the squad. The player's blast, area, missile,
  touch, arrow and thrown torch pass defenders by now; a monster's still
  land (`hostMagic.js` `sparedFromPlayer`, `arrowFlight.js`, the torch pool).
- **W5, LOW.** The attack grunt rolled once per pool, up to three times a
  swing; every host that offers one swing to several pools hands them one
  token now. The cross-pool sparing ignored MeleeAttackFriendlyProtection;
  it honours it. A summon still loading read as no defenders, so a cold
  load could summon twice past the cap; the in-flight mints count.
- **W6: the host wiring was unpinned.** Six one-token breaks of
  `_townWatchFrame` survived the suite. The frame is
  `townWatch.runTownWatchFrame` now, run by the pins, and the host's
  remaining lines are pinned whole.
- Doc corrections: the camp fix covers cities only; the online limits and
  the unwired fixed-city host are written down (DISC19-F above).

**The saves (A, C).**
- **S1, HIGH: the repair missed the saves the bug had already rewritten.**
  Those carry no curse but kept its residue: Silver as the lowest metal
  that hurts the player (a mortal immune to iron and steel), and the
  curse's spells, which cannot be deleted and refuse to cast. The audit
  loaded them as mortals and cleared both; at the merge, main's
  CURSE-REPAIR1 gives them their curse back from those spells instead,
  which is what the reporters lost, and the audit's strip is withdrawn
  with its two pins. The overclaims ("gives the player the curse back")
  were corrected.
- **S2: an exit autosave under the vampire's death video stranded the
  infection** for ever once DISC19-A kept it across loads: the close never
  comes in the loaded game. A live, undeployed infection restores
  `deathScheduled` false, and the video comes again.
- **S3, LOW: the exit autosave named a namesake's slots** (by name, where
  `saveSlot` matches by id) and minted them for this character. It names
  this character's own now, by id, as `findSave` does.
- **S4, LOW: the revival left fatigue at zero,** so a player who died of
  exhaustion collapsed again beside the same foes. It restores the same
  fraction of fatigue when there is none.

**The Light, the chunk and the door (B, D, E).**
- **E1, MED: the swing's first-surface cast stopped at the reach.** A door
  whose box is inside the 2.5 m reach can have its mesh just past it
  (Orsinium, door 12631 behind relay 12080: box 2.35 m, mesh 2.57 m), and
  the relay kept the swing. The cast runs as far as the press's now.
- **E2: pins for the clauses the batch left open** (a mover met at its own
  mesh, a flat lever before a door), and special doors joined
  `hasMeshCollider` (standalone models in DFU; no corpus case changes).
- **D1, LOW: the stale-chunk notice was unlikely to be read.** Set mid-build
  at 1.5 s, it expired before the level drew, and its 143 characters ran
  off the classic panel. It is said on the level's first frame, for 12 s,
  in 43 characters.
- **D2, LOW: the pin's law was too loose.** "Some file under `src/` imports
  it" is not "the page holds it". The pin now walks the world host's static
  closure. The MT-iv comment that a static import would defeat the lazy
  gate is corrected: the gate saved nothing.
- **B1, LOW: the candle burned the dungeon's shared colour** (0.8 grey, or
  the lane's flame). The dungeon arm rides the per-light colour channel now,
  as the interior arm does: the candle burns MagicCandle.prefab's white and
  every other light keeps the dungeon's colour. The standalone `?dungeon`
  host keeps the shared colour.

**The pins.** A pin that could not fail ("standing defenders are not
summoned twice" ticked once, where a countdown needs many) is rewritten, and
a tautological one (the hint compared with its own constant) went with the
hint into main's death screen at the merge; the old-save infection repair,
the action and effect arms of `hasMeshCollider`, the QuickSave in the exit
list and the summon's fallback, townsperson and range arms are pinned. The
cite shifter was blind to `world.js` (over git's default 1 MiB buffer;
main's DISC17 gave `tools/citeShift.mjs` the large buffer the same day, and
this batch makes its catch fail loud on anything but a new file), and the
cites it missed were moved. Six quotations it had rewritten are restored.

**Recorded, not changed.** Two other entries still carry no `permanent`
flag, so a load drops them too: the survival needs' (`needs.js`), rewritten
every minute, and the Mace of Molag Bal's bonus (`artifactEffects.js`),
which decays within twelve minutes anyway.

---

# DISC22 — five from Discord and one of Mac's (2026-09-24)

Mac: *"repair magical items should be enabled by default and required
online"*, with the screenshots: kurkku (*"could replace the controls button
here with the full settings menu"*, over the classic pause window; *"Steel
light flail sprite doesn't show up"*), Tony H. (*"When using Classic UI or
GrimoirUI I'm not able to increase the speed from 10x in accelerated travel
... online"*) and Skibbster (*"Unable to share quests with players if
you've previously completed the same quest"*). Satranath's hotbar and quick
loot on the classic skins, GrimoireUI's parchment loot sheet (DISC22-C) and
the enhanced dungeon map (DISC22-G) are their own slices.

## DISC22-A: enchanted items mended, and online the room's rule

DFU ships `Controls/AllowMagicRepairs` False: a smith turns an enchanted
item away (`repairService.js` `repairRefusal`, the magic arm). The port's
default is True now (`settings.js` `PORT_DEFAULTS.Controls`, over the
generated DFU table, which stays exactly as DFU ships it). Online it is
forced: `onlineLane.js` `ONLINE_FORCED_SETTINGS` is the lane's fourth read
path beside `uiSkin`, `getPref` and `modSetting`. `settings.js` `getData`
asks it first, so the store is neither read nor written online and a
player's own False returns offline. `effectiveSettings` overlays it, so the
settings screen draws what the game reads, and the row is locked with its
reason (`enhancedMenu.js` `ONLINE_SETTING_NOTE`), as every forced row is.

## DISC22-B: the classic pause window's Controls button opens Settings

DFU's CONTROLS button opens its controls grid alone, and on the classic
skin that grid was the only settings screen a game in progress could reach.
`pauseDoor.js` `classicPauseWithSettings` hands the classic window an
`openSettings` hook. `pauseWindow.js` wires it to CONTROLS, falling back to
the grid on a node host with no document. It opens the port's whole
settings screen on its Settings page (`enhancedMenu.js`: a landing may name
a rail section now; Controls is one of its categories, FT16). That screen's
Resume comes back to the classic pause window with its button live again,
as DFU's controls window pops back to the window it was opened from.

## DISC22-D: the Steel Light Flail drew nothing

**Cause.** The Light Flail is Roleplay Realism Items' template 514, an
archive that exists only as the mod's PNGs, one per metal
(`514_0-0_Steel.png`), registered **lazy**: decoded when drawn, as DFU's
`GetItemImage` imports it (ItemHelper.cs:458). AUDIT-DW F1 made that decode
an *optional* hook on the host's icons object (`icons.preloadRecord?.`),
and none of the seven scenes that build that object passed it. Nothing was
decoded, the mod-only archive's upload threw on an empty image, the list
drawer's `.catch(() => {})` swallowed it, and its warm set never asked
again. Every RRI weapon and armour icon failed the same way on the classic
and Grimoire skins, and Diverse Weapons' fell back to the classic art. The
enhanced door failed separately. It preloaded the whole archive, which
skips a lazy entry, and read the record with no dye, which asks for the
bare name (`514_0-0.png`, not the metal's file).

**Fix.** The door that draws owns the decode (`itemScroller.js`
`preloadIconRecord`, used by both list drawers), as the paper doll's
already did. `icons.preloadRecord` is kept only as a test's spy, and the
pipeline's handout, which no scene took, is gone. `textureCanvas.js`'s
vendor arm decodes this record by its dye (`preloadTextureRecord`), and the
two enhanced trade screens pass the dye as the pack does.

## DISC22-E: accelerated travel stuck at 10x on the classic skins

**Cause.** 10x is not a cap. It is the spinner's start value, and the
spinner never heard the click. AUDIT-TO1 I2 gated the classic strip's
clicks on DFU's `cursorActive` flag, but the port frees the pointer without
that flag:

- the chat and the social panels release it with the flag down
  (`world.js` `surfaceOpen`);
- online, Enter opens the chat instead of toggling the flag (KB1);
- Escape releases it;
- a finger never holds it.

The gate refused, and the click relocked the pointer. Map, Camp and Exit
have keys, but the spinner is mouse-only, so only it looked broken. The
enhanced strip is DOM and was never affected.

**Fix.** `travelControlUI.js` `stripTakesClick` gates on the lock itself
(`document.pointerLockElement === canvas`). What I2 guarded against, a
locked click whose frozen coordinates land on a parked control, is still
refused. A click with the pointer free reaches the strip.

## DISC22-F: a quest finished once could never be shared again

**Cause.** AUDIT DROPS A2 remembers a quest finished under a share, so a
partner who is behind cannot re-send it and pay its rewards twice. It
remembered the quest's *name*. So once a repeatable quest (every guild and
faction quest) had been finished with the party, every later share of that
name was refused as "done" for the rest of the session, and the memory
outlived even a load. The refusal also read *"... but you already has this
quest"*: the fragments were third person under world.js's "but you".

**Fix.** The copy carries an identity. `Quest.shareId` is minted the first
time a quest is shared (`machine.js` `getShareableQuestData`), carried in
its envelope and its save, and restored on receipt, so both ends of a share
hold the same id. The finished memory is keyed on it
(`finishedShareIds`, `hasFinishedSharedCopy`). An envelope from a client
that stamps no id falls back to A2's name. `clearState` empties the share
memory with the game it belonged to. The refusal fragments are second
person. (The "already have" refusal Skibbster saw for a quest finished
before, and still standing as a week's tombstone, was AUDIT 68's
S29-share-name-tombstoned, already on main.)

## Pins

- `test/disc22a_magic_repairs.test.js` (4), through the real store and the
  real repair law:
  - the port's default, with DFU's table untouched;
  - a stored Off standing offline;
  - online, forced over a stored Off, with the screen's value and the
    store untouched;
  - the locked row.
- `test/disc22b_pause_settings.test.js` (3):
  - the classic window's CONTROLS opens the enhanced screen;
  - the grid stands with no document;
  - the landing and the Resume back, by source.
- `test/disc22d_flail_icon.test.js` (3), over the real pipeline, the real
  drawer with the icons object exactly as the scenes build it, the
  renderer's real colour gate and the mod's real PNGs:
  - the Steel file fetched, uploaded as `514_0#ui_Steel` at 48x76, and
    drawn;
  - the enhanced door drawing a Daedric one from its own file;
  - the trade screens' dye.
- `test/disc22e_travel_click.test.js` (4):
  - the predicate's arms;
  - the real strip stepping 10 to 25 and back;
  - the host asking the lock.
- `test/disc22f_share_copy.test.js` (4), through the real machine and share
  path:
  - the finished copy refused;
  - the next copy and a third player's received;
  - the id stamped once and saved;
  - an id-less envelope answered by name;
  - a load forgetting the memory;
  - the second-person refusal.
- `test/auditdw.test.js` and `test/to1_travelOptions.test.js` follow the
  new shapes.

Mutants: `tools/mutants/disc22.json`, 25, all dead.
`AUDITDW-F1-the-list-drawer-uploads-before-the-record-is-decoded`
(`dw1.json`) follows the call's new form.
