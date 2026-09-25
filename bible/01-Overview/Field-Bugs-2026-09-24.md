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

## DISC22-C: quick loot on the classic skins, on Mac's parchment

Satranath (*"no hotbar or quickloot on grimoire either, i think i will
stick with the enhanced ui"*) and Mac, with a parchment image (*"a
spritesheet to be used for the loot menu (grimoire UI)"*).

**Cause.** Quick loot's law has no DOM in it
(`systems/quickLoot.js`, `systems/worldHover.js`). But the one gate over
the whole hover resolve, `worldPlaqueOn` (enhanced and not touch), was
the DOM plaque's own. So on the classic skins no frame was resolved and no
row was ever lit, and the wheel, P, J and the take all fell through to the
inventory window.

**Fix.** `worldHoverFrame` resolves and folds on the classic skins too,
while quick loot is on (`classicPlaqueOn`). The DOM plaque stays
enhanced-only (AUDIT 39's law: a classic page never injects the enhanced
style). The frame is left in `quickLoot.js` (`classicLootFrame`), held
with the frame mark it was resolved in so a stale one is never drawn. It lives in a leaf module (`systems/classicLootFrame.js`, no imports), because the first cut read it from `quickLoot.js`: that closed an import ring from `hud.js` into the item graph, which initialised `itemTransfer.js` before its own constants, and four test files failed to load.
`drawHud` draws it on both classic branches through
`ui/classicLootPanel.js`, beside the crosshair, with the lit row banded.

The panel has two faces:

- **Under the GrimoireUI pack, Mac's parchment**
  (`public/art/grimoire-loot-parchment.png`, 106 x 180, a
  PUBLIC_ALLOWLIST row). The two gold rules at rows 38 and 141 cut it
  into three:
  - the top piece, with the title band and the first rule;
  - the body, stretched to the rows;
  - the bottom piece, with the second rule, "and N more" and the curl.
  The scroll grows and shrinks with the pile.
- **Without the pack, DFU's tooltip box** (ToolTip.cs's two colours,
  a bare DrawText).

It appears for a loot list only. The classic HUD still names nothing else
in the world, which is DFU's.

The classic HOTBAR is not in this slice. See the open question in the
report.

**AUDIT RETRO1 G5 (found by its second pass; fixed 2026-09-24, Mac: "Take
care of those").** "Beside the crosshair" held only on the plain HUD. The
panel was centred on the native screen's middle, but over a DOCKED large
HUD the crosshair is re-centred into the strip the bar leaves (ROAD-E E5).
At 1920x1080 the crosshair stands at y 402 and the panel stood at 540,
and a four-row parchment reached y 835, over the bar's top at 804 - the
bar is drawn before it. The panel now asks `hudReticle` where the
crosshair is, as the enhanced plaque does, and stands clear of the large
HUD's bar, docked or not: an undocked bar at LargeHUDUndockedScale 1
still overlapped the tallest list by 25 px (`lootPanelBounds`; the plain
HUD's layout is unchanged). Pinned in `test/auditretro2.test.js` through
`drawHud` itself, both faces.

## DISC22-G: the enhanced dungeon map, mended and made the better map

Mac: *"enhanced dungeon automap is broken and doesn't work properly. This
needs to be a better enhancement compared to the 3d automap"*. Six defects,
each reproduced with closed rooms. EM2's pins were all bare floor quads,
with no ceiling and no stair, which is how they passed over every one:

- **D1, a ceiling was a floor.** `floorTriangles` took the geometric
  normal's `Math.abs`, recorded as "the port's meshes are not reliably
  wound". One ceilinged room came out as two storeys, and a two-storey level
  as four ("Floor 2" was Floor 1's ceiling, drawn again). The world pass
  back-face culls, so the winding is reliable, but the ARCH3D file's own
  plane normal is better than either. It is what the face is lit by, and
  meshReader flips its y with the positions'. The reveal rows now carry
  `normals` (dungeon and interior hosts), and a face counts as a floor by
  its file normal turned by the placement. A row with no normals keeps the
  old reading.
- **D2, a stair joined two storeys.** The voters were chained, and a
  flight of stairs is a chain of flat steps, each well inside the headroom
  of the one below. Two floors twelve metres apart came back as one storey
  at the steps' mean height. `deriveFloors` now works in three steps:
  - It gathers the voters into levels (`LEVEL_TOL`).
  - It chains the levels into runs by the old rule.
  - Inside a run, each level carrying a room's floor (`STOREY_MIN_AREA`,
    12 m²) at least a headroom from a bigger one anchors a storey, biggest
    first. A run with no anchor is still one storey, so EM2's "stair of
    ledges" pin stands unchanged.
- **D3, the map opened on Floor 1** whatever storey the player stood on.
  A new frame now sets the storey from the player's feet.
- **D4, it opened on the whole level fitted to the sheet**, a corridor
  three pixels wide. The window's first layout never asked the sheet it
  opened on. It asks now. The sheet's rest view fits the revealed floor of
  the storey, never zoomed out past `READABLE_SCALE` (4 px a metre), and
  centres on the player or on what has been seen.
- **D5, a doorway into a room not yet seen was inked as wall.**
  `splitEdges` partitions the outline by what lies across each edge. Real
  floor on the storey, revealed or not (`storeyOccupancy`, once per level
  and storey), makes an opening, drawn light and broken.
- **D6, every open re-derived the level.** A row's triangles are cached on
  the row, and a level's storeys on its row list, so every sheet shares
  them.

**What the 3D map had and this lacked, now drawn.**

- The middle button writes a note on revealed floor through DFU's own law
  (`tryAddOrEditUserNote`, the metre rule, AddNext ids). On a note it
  edits that note, and an empty answer removes it. The words go in the
  window's box (`_askText`).
- Teleporter ends on one storey are joined by a broken line. An end whose
  partner is on another storey names that storey ("to Floor 2").
- The way in breathes: the window repaints on its beat while the beacon
  is on the sheet.
- Home brings the storey and the view back to the player.

## DISC23-A: party members on the town and dungeon maps

Starempire42, *"Being able to see players on your town/dungeon map"*: *"It
would be really nice to be able to see your party members on the town and
dungeon maps. This would make it much easier to figure out where everyone is
and find each other."*

**Cause.** The party was on the bay only (SOC6), read off the hub's travel
pixel, and a pixel is the whole town or the whole dungeon. The town and
dungeon plans took no party at all. Both doors (`ui/automapDoor.js`,
`ui/townMapDoor.js`) build their sheet's bag key by key, so nothing a host
handed could reach them, and neither sheet had anywhere to draw a member.

**Fix.** A plan needs metres. The only metres this client has for another
player are their body's (`scenes/world.js peersNear`, the reading trade's 5 m
and party rest's 15 m already measure by).

- **The host.** `partyNear()` lists the party members whose peer bodies stand
  in my room, each with their feet in this scene's frame, their eased facing
  and their name. A member with no tracked body here is left out, not guessed
  at: they are still on the bay.
- **The dungeon and the building.** It reaches their plans through
  `worldModes` and the automap door.
- **The town.** It reaches the street plan through the town door. There,
  each member's feet go through the player's own subtraction (the pixel's
  translation and the location's origin, read at open, which the held motor
  keeps true).
- **One reading.** `ui/partyMapMarks.js readPartyBodies` validates each row.
  It drops a body with no finite feet and names a nameless one.
- **The dungeon sheet** draws a member only on their own storey (the player
  caret's law). The floor strip puts a party-green dot beside every storey a
  member stands on, so a friend on Floor 2 is one press away.
- **The street plan** draws members through EM-BUG3's one seam (`sheetY`).
- **The mark.** Both plans draw a member as the player's own caret in the
  party's green, facing where they face, with the name under it, and before
  the player's caret. A member under the pointer answers their name.
- **Repainting.** A plan breathes while any member is in the level, on any
  storey, so a member climbing onto the shown storey appears within a beat.

The fixed-city host (`scenes/exterior.js`) has no online, and owned houses
and ships have no room, so no member is drawn there.

## DISC23-B: Eye of the Beholder's sprites, chosen and seen

Gryphoth and Scratchie, *"Eye of the Beholder third person sprites"*: *"EOTB
comes with 16 ground models and different mounted models, it would be nice to
be able to change our models like in the original mod ... Also just a way to
change our sprite in general instead of it defaulting depending on the
class"* / *"the game is not allowing us to choose between the different index
slots"*.

**Causes.**

1. **The choice was on no screen.** The mod's two sprite sliders,
   `Graphics.OnFoot` (0-15) and `Graphics.OnHorse` (0-4), were declared, and
   the body read them. But the curated list's comment sent everything else to
   "the mod's own pane", and FT14 removed that pane. Every player was the
   first set.
2. **Online, a peer was their class.** A peer with no Morrowind body on my
   screen stood as their class's enemy sprite (`classMobileType`). The set
   they chose was on nobody's screen but their own.

**Fix.**

- **The sets are named.** They are still the mod's sliders, with each index
  labelled (`labels` on the two keys). The names are the mod's own preset
  titles (modpresets.json). The art gives the rest, checked by eye on a
  contact sheet: every even set is a woman and every odd set a man, and the
  five riders are the fighters by helm and boots (green-booted women,
  cyan-booted men, as on foot).
- **They are a SKIN, on the player's profile** (DISC23-B2, Mac: *"I want to
  utilize it and make it a choosable skin system in the menu player profile
  system itself instead of it being hidden in the feature menu"*). The
  profile window the door's profile mark opens carries a Skin card under the
  account card (`ui/skinCard.js`):
  - every set is its own picture, the front-on standing frame out of the
    bundle the body draws from, with its name under it;
  - the worn one takes the worn title's doubled brass edge;
  - a press writes the mod's own key, so there is one choice that the body,
    the look and the card all read;
  - until one is chosen the card says the others see the class;
  - with the mod off it offers the switch instead of a grid that would
    change nothing.
  Who you are drawn as is a fact about the player, so it is not a Features
  dial: the two keys are not curated on the tile.
- **The look carries the chosen set.** The field is `eo`, 0-15, and it is
  sent only for a set the player CHOSE (`storedModSetting`). The mod ships
  on, so a set read off its default would have dressed every player who never
  opened the dial as the first set. It is omitted while the mod is off, and
  omitted means the old bytes.
- **The relay.** It projects `eo` through `validLook`, clamped as every field
  is. RELAY_VERSION goes to world106, which the relay deploy workflow ships on
  merge.
- **Others draw it** (`net/peerRiders.js createPeerWalkers`, beside the
  riders and sharing one art store, `createEotbArt`):
  - The set is drawn off the shown pose, with the same eight views and tables
    as the player's own body. The move bit walks it, a drawn weapon or
    readied spell stands it ready, and each new swing, loosed shaft or cast
    plays its clip once. First sight of a peer is not a swing.
  - Precedence: the rider, then the viewer's own Morrowind body (skipped),
    then the chosen set, then the class sprite, then the doll. A beast and
    the fallen keep their own layers.
  - The walker hands the name pass its height. It follows the Other players
    card: on the paperdoll side, the doll.
  - A peer's swing is timed at Speed 50 (DFU's line), because a peer's Speed
    is not on the wire.
- **Not done.** A player who wants no Morrowind models already has that:
  Morrowind arms ship off, and EOTB is the body without them.
- **Known limit.** The look is sent with a room's hello, so a set changed
  mid-room reaches the others at the next room change, as a change of gear
  does.

## DISC23-C: the Features switches, green on and red off

Skeptikali, over an ENHANCED tile's Off | On bar: *"if a feature would be
enabled, the ON button would turn Green, and if a feature would be disabled,
the OFF button would turn Red, it would help a lot for people with darker
screens or smaller resolutions"*.

**Cause.** A pressed segment was a grey block with only its letters tinted,
so On and Off read alike on a dark or small screen. Underneath that, FT14
read "off" by position, the first segment. That is wrong wherever Off is not
first: Grass Density runs Full, Half, Quarter, Off, so at Full its tile read
off, and at Off it read on.

**Fix.**

- **The Off is the segment labelled Off** (`barReading`). The rule is the
  same across a boolean, a pref's tiers and a DFU enum.
- **A bar with an Off is a switch.** Its pressed segment is filled:
  - emerald (`#2c7341`) while the feature is on;
  - cinnabar (`#bf2a1f`) on its Off.
  Both keep the bone label at 4.5:1 or better and stand off the bar's ink at
  3:1 or better. They read the same on the shell as on the pause window, and
  on a forced switch (the brass edge and the tag say it is forced).
- **A bar with no Off is a choice** (Pixel / Smooth, a filter mode). It keeps
  the plain press, and its feature is never "off".
- **The tile's state stripe** follows the same reading, and its on colour is
  the same emerald.

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
- `test/disc22g_automap.test.js` (8):
  - D1 to D6, each on closed rooms: a ceilinged room is one storey, and
    stacked rooms are two; a placement turns the normal; a flight of
    stairs leaves two storeys, a landing is a third, and a dais is none;
    the sheet opens on the player's storey; the rest view is readable on
    a 400 m level; the opening is the shared edge and not wall, and is
    dashed; triangles and storeys are shared;
  - notes written, edited, removed, cancelled and refused off revealed
    floor;
  - teleporter links and names, the breathing beacon and Home.
- `test/automapsheet.test.js`'s rest-view and mark pins follow the new
  laws (they held the whole-level fit and a teleporter end with no name).


- `test/disc22c_classic_loot.test.js` (5), through the real hover seam,
  selection and panel, with Mac's PNG decoded off disk:
  - the classic skin resolves a loot frame with no DOM, lights a row,
    and the wheel moves it;
  - quick loot off resolves nothing;
  - a later frame draws nothing stale;
  - under GrimoireUI, three pieces cut at rows 40 and 140, the body as
    tall as the rows, the lit row banded, and the body growing with the
    pile;
  - without the pack, the tooltip box even with the sheet loaded, and
    nothing for a name frame;
  - drawHud draws it on both classic branches.

- `test/disc23a_party_plans.test.js` (6), through the real sheets and ink:
  - a member where the player stands drawn on the player, three metres east
    twelve pixels east and facing east, named, hovered, under the player's
    caret;
  - a member upstairs absent from Floor 1, the strip dotted beside Floor 2,
    drawn there;
  - the beat kept while anyone is in the level, and a party-less sheet
    unchanged;
  - the street plan through the host's conversion;
  - the reader's drops;
  - the hosts and both doors, by source.
- `test/disc23b_eotb_sprites.test.js` (7):
  - the names against the mod's presets and the art's rule, and not on the
    Features tile;
  - the real Skin card: 21 pictures, each key a file in the bundle, the
    front view, the worn marked, a press worn and carried by the look, the
    hint until chosen, the switch while the mod is off, and the profile
    window drawing it;
  - the look sending a chosen set only, nothing while the mod is off, and
    the relay's clamp;
  - the walker standing the set at the peer's feet with its stances;
  - each one-shot played once, with first sight no swing;
  - who is not a walker;
  - the host's order, by source.
- `test/disc23c_features_colour.test.js` (5), through the real tile builder
  and the real ENHANCED_CSS cascade:
  - an Off / On switch;
  - Grass Density's last-segment Off;
  - a choice;
  - both fills on both paints and forced;
  - the contrast of both tokens.
- The pins that follow: `townsheet.test.js` and `inkautomap.test.js` (the ink's
  import line), `mwbody1.test.js` (the peer layers' order, the dead's
  and the page-hide's sweep), the RELAY_VERSION pins in ten files (world106), and
  `relayversion.test.js`'s world106 row for the relay's new bytes.

Mutants: `tools/mutants/disc22.json`, 25, `tools/mutants/disc22g.json`, 20, and `tools/mutants/disc22c.json`, 11, all dead. `tools/mutants/disc23a.json`, 16, `tools/mutants/disc23b.json`, 24, and `tools/mutants/disc23c.json`, 11, all dead.
EM2's floor records (`em2.json`) are aimed at the new model. They
still die, 26 of them, except EM2-16 (the `len > 0` guard). The facing
test is now written `!(up >= FLOOR_NY)` and rejects a NaN facing on its
own, so EM2-16 is recorded as equivalent. EM2-2 (a ramp votes) is pinned
by a 40 m ramp between floors 20 m apart. EM3-17 follows the openings
into plan units.
`AUDITDW-F1-the-list-drawer-uploads-before-the-record-is-decoded`
(`dw1.json`) follows the call's new form.


---

## PR-WW1: the werewolf the others saw (player report)

The report: *"Werewolf morrowind sprite not showing online"*.

**What the player sees.** A transformed player with no Morrowind body is
drawn in third person by Eye Of The Beholder's billboard (`mwView.js:79`
`eotbLane`, `:334`). Its table rule puts the transformed form first, riding
included (`eotbBillboard.js:329` `chooseTable`, `:335`), and it draws the
mod's lycan archives: 112380 for the werewolf, 112381 for the wereboar
(`eotbBillboard.js:75` `lycanArchive`, `:142` `tableArchive`). That art is a
hunched, dark-furred, Bloodmoon-style beast, and it is the "Morrowind sprite"
of the report. The Morrowind rig has no werewolf body (`fpArm.js:178`), so
this is the only Morrowind-looking werewolf in the port.

**Cause.** No other player ever saw it. The only layer that draws another
player in EOTB's art is `net/peerRiders.js`, and it took a peer only when
`rd` said a horse or a cart. A peer whose pose said `wb` alone fell through
to DISC12's branch in `remotePlayers.js` (`:795`, `:800`). That branch draws
MOBILE_TYPES.Werewolf / Wereboar, the classic enemy sprite (archive 264 /
269). So the transformed player saw EOTB's beast on themselves, and everyone
else saw Daggerfall's pixel werewolf. A transformed rider was worse: the
rider layer ran first and drew a person on a horse (112382 + the rider's
set), where the player saw their beast.

The wire was never at fault. `wb` goes out on its edge (`wire.js:1051`),
through the door (`:1051`) and the easing (`online.js:206`), from the sender
at `world.js:12495`.

**Fix.** `peerRiders.js` takes a peer whose pose says `wb`, as it takes a
rider:
- The loop table is EOTB's own `chooseTable`, transformed first
  (`beastTable`). A beast in the saddle is the beast.
- The form picks the archive (`spriteFor` gets `lycanthropyType: wb`), at
  the transformed size (`sizeMod`).
- The frame clock is the saddle's for a mounted beast and EOTB's `speedMod`
  run halving on foot.
- A new swing count plays `AttackMeleeLycan` once, forward, at LYCAN_TICK,
  as the local body's `playLycanAttack` does (`eotbBody.js:498`). The count
  first seen is no swing.

The hand-off is RIDE's: `isRiding` is true only once the art is up, so while
it loads or has failed, and in a build without it, DISC12's enemy sprite
still stands for them. A beast is never nothing.

The modal passes (`worldModes.js:7604` the dungeon, `:7800` the interior)
draw only `host.extraBillboards`. That was `remotePlayers.batches()` alone,
so a beast drawn by the rider layer would have been nothing indoors and
underground. It hands over both layers' batches now (`world.js:12660`). A
rider never reaches those passes: a door dismounts. The eye the layer turns
its sprites to (`cam.pos`) is live in every mode, because worldModes shares
world.js's `cam` and sets it each modal frame.

**The local body, beside it.** `eotbBody.js` asked for every sprite with
the mod's settings (`cfg`), which never carry the form. So a wereboar saw the
werewolf on themselves, while the others now draw the boar. The draw and the
placement take the live form now (`lookNow`, `eotbBody.js:365`). The preload
fetches the live form's lycan set, and fetches it again when the form
changes (`:270`, `:713`).

**Hosts.** `OnlineSession` is built only in `world.js`. `exterior.js` and
`dungeonContext.js` hold no peer drawing, and `worldModes.js` reaches peers
only through the hook above. So the fix has one host. No relay change:
`wb`, `mv`, `wd`, `an`, `yaw` and `rv` were already on the wire.

The pins are `test/prww1_werewolf.test.js`: six tests, all failing on the
unfixed code. The mutants are `tools/mutants/prww1.json`.

---

## PR-BOW1: the bow that made the body bigger (player report)

The report: *"Equipping a bow enlarges your character"*.

**What the player sees.** In third person the Morrowind body is not drawn
into the world directly. It is rendered as a true-size ortho picture, which
is then drawn on an upright quad facing the camera
(`characterSprite.js:61` `drawRigSpriteBox`). Because the picture is true
size, where the quad stands decides how big the body looks on screen: a
quad set back from the camera draws the body smaller. So the same body
looked a different size depending on what was in its hand. With a longsword
drawn it was about 12% smaller than bare-handed (x0.88 at mwCamera's
default reach, level). With a long bow drawn it was about 11% bigger than
with the sword (x1.11). Going from the sword to the bow is the "enlarges"
of the report.

**Cause.** The quad stood at the centre of a box over every piece the rig
carried, hidden pieces included. Weapon Sheathing's iron longsword runs
y 2.9..59.5 out from its grip. On the weapon bone that moved the box's
centre about a third of a metre off the body, away from a camera standing
behind it, and the body drew small. The long bow is gripped mid-stave
(-38.5..46), so it moved the centre only a few centimetres. The box also
counted what rule 57 hides but keeps the vertices of: a sheathed blade,
the holster twin while the blade is out, an arrow off the string and an
unlit torch.

**Fix.** The picture is now of the BODY, and the box only sets how much of
the scene the picture takes in:
- `drawRigSpriteBox` takes an optional `anchor`. The picture is taken along
  the eye's ray to the anchor, still centred on the box so the gear stays in
  it. The quad stands where the anchor's own image lands on the anchor
  (`characterSprite.js:109` `landAnchor`). Every point then draws at a place
  that does not depend on the box. The voxel rigs pass no anchor and draw as
  they did.
- `drawThird` (`fpArm.js:4647`) anchors on the actor's own axis (MW x = y =
  0, where the root stands at `feet`), at the body's mid-height. That
  height is read off the drawn ranges less `CARRIED_SLOTS` (`fpArm.js:676`:
  the hand's weapon and round, the torch, the held sheet, Weapon Sheathing's
  three), so gear moves neither coordinate.
- The box is folded only over the ranges the pass draws (`fpArm.js:686`
  `visibleRangeBounds`), off a box kept per range (`fpArm.js:660`
  `foldRangeBoxes`, refolded at every upload, `:2808`).

**Hosts.** Every Morrowind body in the port goes through `drawThird`. The
local player's goes through `mwView.mwViewDrawBody` (`mwView.js:329`,
`:339`), which four files call: `world.js:14626`, `exterior.js:5117`,
`worldModes.js:7597` and `:7694` (the dungeon and the interior passes),
and `dungeon.js:1066`. `dungeonContext.js`, the fourth motor host, builds
the dungeon for those hosts and draws no body of its own. The other players'
bodies go through `peerBodies.js:377` (`PeerBodies.draw`). The open world
calls it at `world.js:14627`, and the modal passes reach it through
`host.drawPeerBodies` (`worldModes.js:7598`, `:7695`). The fix therefore
sits in one place and reaches every host.

The pins are `test/prbow1_bow.test.js`: seven tests, all failing on the
unfixed code. The mutants are `tools/mutants/prbow1.json`.

### PR-BOW1b: the review's three follow-ups

The review that shipped PR-BOW1 raised three follow-ups, done the same day.

**The second walk.** `foldRangeBoxes` walked every posed vertex again, on
every posed frame, for every body (the local player's and each peer's). It
ran straight after `poseAssembly` had already walked every one of them for
`assembly.bounds`. That is the same kind of repeated walk AUDIT MWBODY A4
removed. The per-piece boxes are now folded inside `poseAssembly`'s own walk
(`mwFirstPerson.js:1795` `foldPieceBounds`, called at `:2450`). Each piece
keeps one box, rewritten each pose. A range copies its piece's six numbers,
and only a piece no pose has touched yet (a part bound since the last pose)
is folded off its positions. The fold's results are unchanged:
`assembly.bounds` is still exactly what `meshBounds` answers, and PR-BOW1's
pins stand.

**The portrait.** `fpArm.figure()` draws the enhanced inventory's model
figure (`enhancedInventory.js:1474`), which is shown in a 110:184 cell with
object-fit: contain (`enhancedStyle.js:3826`). It framed `meshBounds` over
EVERY piece, then hid the unlit torch, the arrow off the string and the
empty holster twin, so gear it did not show still moved the frame. Its width
was the box's azimuth-safe diagonal, so a longsword pointing at the viewer,
or a bow's stave, widened the picture past the cell and shrank the body in
it. On the pin's stand-in the body filled 0.943 of the cell bare-handed,
0.891 with the longsword and 0.774 with the long bow. Turned side-on, the
held longsword also pushed the body 0.61 of the half-width off-centre,
because the frame was centred on the box and the box included the gear.

The decision: **the frame is the tight box of what the portrait shows, at
the yaw asked** (`fpArm.js` `portraitWindow`, used in `figure()` after the
portrait's hidden flags are set), measured off the posed range boxes'
corners. A held item is always drawn in full, a hidden one does not count at
all, and each side reaches only as far as something drawn on that side. The
first cut stood the frame on the actor's axis and made it symmetric about
it, so a weapon reaching out to one side widened both; the review's yaw
sweep found that at a turned yaw it shrank the body to 0.590 of the cell,
where the old azimuth-safe frame had held 0.891. The tight box is never wider
than that frame, so no yaw draws the body smaller than it stood; the price is
that the body sits off the picture's centre when something reaches out
beside it. The pins sweep eleven yaws and hold the body at or above the old
frame's share (longsword 0.891, long bow 0.773), with every held vertex
inside the picture.

**The record.** This section.

**Still open.**
- At a side yaw a long weapon can still reach past the cell's width, and
  contain then draws the body smaller than bare hands do (never smaller than
  the old frame did). A panel that let the gear overflow the cell would keep
  the body its size. That is a layout change in `enhancedInventory.js` and
  `enhancedStyle.js` that nobody has made yet.
- `figure()` clamps the picture's width to the render target
  (`CHAR_SPRITE_RT_SIZE`, 1024) without lowering its height, so a picture
  wider than 1024:384 is squashed rather than letterboxed. No human-sized
  body reaches that.

The pins are `test/prbow1b_followups.test.js`: eight tests, all failing on
the unfixed code, each on its own assertion. The mutants are
`tools/mutants/prbow1b.json`.

---

# DISC24 — four from Discord (2026-09-24)

Mac, with four Discord screenshots and no text:

1. Quest, "Class selection UI bug": *"When left clicking other classes the
   description stays the same for the original class that was double
   clicked previously but the `Play as a <insertClass>` changes and the
   class name also change at the top. Double clicking works as intended
   though"*.
2. kurkku, "Horse and Wagon don't have sprites in GrimoireUI":
   *"presumably applies to the normal vanilla UI as well"*.
3. icebreyker, "Lights/shadows are still bugged": *"Sorry for being
   annoying, but i am still getting this problem with Enhanced Lighting"*.
   The screenshot is a lit interior with a ceiling lamp, and the player's
   whole silhouette thrown up the wall. DISC13-A was this reporter's
   earlier "The shadows seem to flicker when i move".
4. Lynk, "Stuck in death loop": *"After leveling up to 5 online and putting
   stats in my character had low health so I rested then when I woke up it
   was stuck in a constant death loop"*.

Each was traced to its cause, against the real modules, before it was
touched.

## DISC24-A: the description stayed on the class that was read

**Cause.** DFU's class description is a MODAL message box over the list
(CreateCharClassSelect.cs :70-96), so while it is up the list's selection
cannot move. The classic port keeps that: with the box up, the hit test
answers only Yes and No. The enhanced skin lays the list BESIDE the box,
so a row stayed clickable. A single click moved `classListIndex`, which the
header and "Play as a" read, while `classConfirm`, the text the box was
opened with, stayed on the old row. Yes adopts `classListIndex`, so the
player got the class on the button, not the one they had read.

**Fix.** One door (`ChargenFlow._selectClassRow`) for the list's selection,
which both the pointer path and the enhanced stage's hit go through. The
box belongs to the row it was opened on: moving the selection off that row
is DFU's No (:106-109, the box dismissed, back to the list). The new row is
read the way any row is: a double click, Return or the Read button. A click
on the same row leaves the box open.

## DISC24-B: the Horse and the Small Cart drew nothing

**Cause.** MAC-D2 answered the cart's tomato (its template's 213/1 is the
Wine Rack's world sprite) by giving the WHOLE Transportation group no
picture. That took the Horse with it. The Horse's 201/0 was never borrowed:
it is the animal archive's own horse, the one the world draws. And the cart
was left with nothing, because no TEXTURE archive carries a cart.

**Fix.**

- **The Horse draws its own record again.** `inventoryItemImage` refuses
  only the templates whose columns are borrowed (the cart and the four
  boats).
- **The cart's picture is its model.** `inventoryItemModel` names classic
  model 41214, the wagon Horse Cart and Cargo trails. `ui/modelIcon.js`
  bakes it once on the CPU:
  - textured, three-quarter on, lit from the upper left;
  - cropped to what it drew;
  - in color32 order;
  - loaded through the same data seam and texture reader the DOM icons use
    (a user's replacement of a record first, as the world's wagon wears it).
  It is a CPU bake, not a GPU pass, for the reason `ui/meshStamp.js` gives:
  a GPU bake would borrow the main program's state mid-frame.
- **Every list draws it:**
  - the classic list (vanilla and Grimoire alike, every native window
    through `makeIconDrawer`) uploads it as UI art under `model-icon_41214`
    and draws it through the same V-flipped quad;
  - the enhanced lists (pack, detail card, shop, player trade) read it
    through one new door, `linePictureUrl`, which replaced four copies of
    the same ternary.
- **The boats stay without a picture.** No shelf sells one.
- The two transport template ids have one home now (`itemTemplates.js`).
  `shopStock.js`, which imports it, re-exports them.

## DISC24-C: the player's own shadow, indoors

**Cause.** The player's own sprite body (`player/eotbBody.js`: "Shadows
Only" in first person, the body in third) is the one caster that moves
with the view. The lamps' shadow laws treated it as any flat, and three of
them were wrong for it:

- **Still when the player stopped.** `SHADOW_DYNAMIC_HOLD` frames after a
  pause, the card joined the static cache of every lamp in reach. The next
  step or turn threw it out again: every one of those caches rebuilt in one
  frame, and its shadow jumped between the cache and the dynamic lane's
  cadence.
- **Late in a far lamp's map.** A lamp past the nearest
  `SHADOW_NEAR_CASTERS` redraws every third frame. There the silhouette
  trailed the player by up to two frames and caught up in a jerk. That is
  the flicker.
- **Turned to face each lamp.** The mod's card is never turned. Unity draws
  a ShadowsOnly renderer's shadow in its own transform
  (Eye_Of_The_Beholder.il IL_4e42 sets shadowCastingMode 2), so walking
  round a lamp swung the silhouette through a half turn.

**Fix.** The card carries `selfCard`, and `render/shadowPass.js` gives it
its own law:

- it is always a mover, never baked into a cache;
- it casts only into maps redrawn every frame;
- a lamp that falls out of the nearest two lets it go on that frame;
- it casts in the basis it was drawn with.

The cadence and its cost are EL8's, unchanged: the card adds no redraw
that a lamp was not already making.

## DISC24-D: the death loop after waking

**Cause.** A live stat at 0 kills every 0.2 real seconds, whatever the
health (`killIfAnyLiveStatZero`, DFU's UpdateEntityMods tail). A disease's
daily roll accumulates unbounded negative stat mods (Plague: 3 to 30 a day
off seven stats), and a rest runs no real seconds. So a disease day that
lands in the night leaves a live 0 that kills on the first frame after
waking.

The one revival (`reviveForPlay`, used by all four online revivals)
restored the health and kept the disease, rightly (DEATHLOOP1: dying is no
cure). But it kept the disease's stat damage with it, so the player stood
up and was killed again on the next frame, for ever. Offline, the first
death ends the run, as DFU's does.

The level-up is incidental: it only ever adds points. The cause was traced
by a node reproduction (a Plague entry and two disease days at the maximum
roll: STR 40 to 0, then kill, revive, kill). Lynk did not mention a
disease; the fix covers any live 0 whatever put it there.

**Fix.** `liftZeroedStats`, in the revival, after the drains end. Every
stat found at a live 0 is stood back up at the respawn fraction of its
permanent value (the health's own law). It does this by easing what holds
the stat down: disease damage first, then a drain or a transfer. It lifts
to the fraction and no further. The disease entry and its clock stay, and
a stat not at zero is untouched. It applies on a living release too: a live
0 kills within 0.2 seconds, so handing one over is handing over the death.
The fatigue floor is measured after the lift, since its ceiling is built
from live STR and END.

## Pins

- `test/disc24a_class_describe.test.js` (3):
  - a single click on ANOTHER row closes the open description;
  - Yes gives the class that was read;
  - both paths through the one door.
- `test/disc24b_transport_pictures.test.js` (6):
  - the Horse's 201/0 back, and the cart and the boats still borrowing
    nothing;
  - the bake the right way up in color32 order and cropped;
  - the depth test, the wood fallback and the empty model;
  - the door loading once, waking every list, and caching a miss;
  - the real classic drawer drawing the cart's upload through the
    V-flipped quad, and the Horse from 201/0;
  - the real enhanced line and door at the list's scale, the right way up.
- `test/disc24c_self_shadow.test.js` (6), through the real Renderer and
  shadow pass on the fake GL:
  - never still;
  - never in a third-frame map;
  - a walker's far lamp drawing him and not the card;
  - a rank change on that frame;
  - a fall with a walker at every cadence phase;
  - the drawn basis, with a townsman still facing the lamp.
- `test/disc24d_stat_zero_loop.test.js` (4), through the real disease
  course, the real kill and the real revival:
  - Lynk's loop end to end;
  - the respawn fraction and the fatigue after the lift;
  - diseases eased before drains, two in turn;
  - every revival path, including a living release caught between two
    kill ticks.
- The pins that follow:
  - `audit63_items_loot.test.js` (MAC-D2: the Horse out of the refusal);
  - `disc22d_flail_icon.test.js` (the trade screens through the one door,
    and the door asking by the dye);
  - `sc1_shadowcache.test.js` (the cadence read once off the rank);
  - `eotb_body.test.js` (the card flagged);
  - `deathloop1.test.js` (a disease is kept, and its stat hold eased);
  - `dw3_icons.test.js` and `fparm.test.js` (the pack's tile and detail
    through `linePictureUrl`, the dye and the Morrowind icon's precedence
    kept);
  - `auditdisc7.test.js`, `perfon2_peercull.test.js` and
    `weeds1_flatcasters.test.js` (the rank read once, the self card's
    basis upload, the replay's new last argument);
  - `ledger.test.js` (the FAST TRAVEL row's evidence is the shelving, which
    stays in `shopStock.js`, now that the constant's home is
    `itemTemplates.js`).

Mutants: `tools/mutants/disc24.json`, 30, all dead. Nine records re-aimed
by content: `auditdisc7` C6, `auditlight` sc1-dyn-ignored, `deathloop1`'s
two, `disc22` D22D (now the enhanced door's), `el8` cadence, `fieldgun16`,
`perfon2` PERF-BASIS, `weeds1` the lantern replay, and `macd` MACD2.

---

# PR-WAGON1 — another player's wagon at a door (2026-09-24)

**Report** (a player, relayed by Mac): "Players can grief other players with
the wagon by putting it in front of dungeon entryways and building
entrances". Mac's choice, asked how: "Others' wagons don't block".

**Cause.** AUDIT HCC O3 stood another player's PARKED wagon a collider box in
my world (`hccWagon:<owner>`), and HCC-PARK has the relay keep a parked team
for 72 hours after its owner leaves. A wagon left across a shop door or a
dungeon's mouth was a wall for everyone for days - and its activation box, the
nearest thing on the ray, took the click from the door behind it too.

**Fix.** Another player's wagon stands no collider, live or kept, parked or
moving; mine keeps the mod's BoxCollider. Their wagon and horse YIELD the ray
(`player/activate.js firmFirst`, read by `pickActivatableHit` and by
`player/activationRace.js`): anything firm the ray meets behind them - a door,
a dungeon's mouth, a body, a townsperson, a foe - takes the press and the
plaque; with nothing else on the ray their team is still named and pressed.
Horse-Cart-And-Cargo.md PR-WAGON1 has the law; Online-Arc.md's O3 bullet says
it is reversed.

**Pins.** `test/prwagon1.test.js` (6), every one failing on the base;
`test/hcc_pool.test.js` (O3 reversed), `test/disc20.test.js`,
`test/lootstack.test.js` (the source pin). Mutants `tools/mutants/prwagon1.json`
(7 dead); `hcc.json` and `disc20.json` re-aimed.

---

# WISPS-RETURN — the wind wisps are streaks again (2026-09-25)

**Request** (Mac): "I want to return to the original wind wisps before our
current design".

**What changed.** WIND5's swirl (2026-09-23: each wisp a calligraphic
flourish, a ribbon ending in a curl, drawn on and off along its path) is
retired, and each wisp is WIND3's straight streak along the wind again -
its quad, its length and its fade. DISC17-A's count (120 at a gale, 10 in a
calm) and its doubled opacity stand: those asks were about how many and how
dark, not about the shape. A streak at its darkest is 0.44 in a gale and
0.20 in a calm. The sandstorm is unchanged. The record, and why, is
`07-Rendering/Rendering.md` WISPS-RETURN.

**Pins.** `test/wispsreturn.test.js` (3), every one failing on the base;
`test/disc17.test.js`, `test/wind3_windworld.test.js` and
`test/weather2d_sandstorm.test.js` follow;
`test/wind5_swirls.test.js` RETIRED. Mutants `tools/mutants/wispsreturn.json`
(13 dead); `wind5.json` retired; `auditvc7.json` re-aimed.
