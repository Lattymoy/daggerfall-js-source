# AUDIT 66 - HANDHELD TORCHES (HT1), RE-READ AGAINST ITS OWN IL, 2026-09-14

Mac, the morning HT1 merged: "Do an audit on this."

HT1 shipped RedRoryOTheGlen's Handheld Torches 1.4.1 as
`systems/handheldTorches.js` and `scenes/droppedTorches.js`, read off the
mod's compiled IL method by method, with 19 pins and a green gate. This
audit read the same IL again against the same two modules, the five hosts
that own a pool, and - separately - the 19 pins against the laws their
own names claim. **Twelve findings, all paid**, each with a pin in
`test/audit66_handheldtorches.test.js` that fails on the code as HT1
shipped it.

The shape of the twelve is worth naming before the list: **one is
arithmetic, two are clocks, and nine are lifetimes.** The port's
arithmetic survived a second reading almost whole - the hand law, the
five actions, the three placements, `GetSpriteRect`, the projectile's
step, the burn's divisor and the foe's fire all stood. What did not
survive was every question of the form *when does this thing end, and
who ends it* - the teardown lists it never joined, the transition it ran
on the wrong side of, the switch that could strand it, the recenter that
moved half of it.

## Why the audit took this shape

HT1 was a mod port, and a mod port has a reference the audit can hold it
to: the IL. So the first pass was mechanical - every method in the dump
against its home in the port, with the port's own comments (which cite
IL offsets) as the index. That pass found **one** thing (F1), because
the arithmetic had already been read carefully once.

The second pass asked the question the first cannot: *what does the port
own that the mod does not?* A Unity MonoBehaviour is destroyed with its
GameObject; a `createX()` closure in this port is destroyed by whoever
remembers to destroy it. Every one of F4-F8, F11 and F12 lives in that
gap. The mod has no "teardown list" to forget, because Unity is its
teardown list.

The third pass read the 19 pins as an adversary: for each, what mutation
of the source would it survive? That pass found no new bugs but a long
list of laws asserted in a test's NAME and nowhere in its body; the
strongest of those are pinned now (below, "The pins that pinned
nothing").

## What was refuted

Four things that looked like findings and were not. They are recorded
because a later reader will suspect them again.

- **The two gravities.** `DrawTrajectory` integrates with **9.8**
  (0x1d9d) and the projectile's `.ctor` sets `gravityAccel` to
  **-9.81** (0x4be5). This is not a transcription error in the port, and
  not a bug in the mod: the arc accumulates `9.8 x 0.05 x Gravity` as a
  **velocity** and multiplies the sum by `fixedDeltaTime` (0x1dbb),
  while the flight accumulates `9.81 x 0.05 x Gravity x fixedDeltaTime`
  as a **displacement** (0x47c3) - `0.49 x 0.02 = 0.0098` against
  `0.00981`, the same curve by two roads. Both numbers are kept, both
  are pinned.
- **The paused gate.** `Update` returns on `GameManager.IsGamePaused`
  (0x13b0) and the port's component has no such gate - but the port
  gates one level up and harder: a key under an open overlay never
  enters the host's key set at all (`world.js`'s keydown ladder returns
  on `townTalk.keydown(e)` before `keys.add`), so the three bindings
  cannot fire into a window. Typing an `X` into a save-name box does not
  throw a torch.
- **The foe's fire never ending.** The port's burning entry is a custom
  `activeEffects` kind, and `runEffectRound` is a no-op for a kind it
  does not know - so the worry was that nothing counts it down. It is
  counted down: `tickActiveEffects` decrements every non-held,
  non-permanent entry whatever its kind, and all four hosts run foe
  magic rounds (`subscribeFoePools` in the three above-ground hosts,
  `dungeonContext`'s own inline arm). The fire ends where it is lit.
- **The projectile outliving a transition.** In the mod it does:
  `DestroyLightSources` walks `billboardsObject`, and a torch in flight
  was never added to that list (0x39dc adds nothing), so a thrown torch
  survives the transition that destroys every dropped one. The port
  retires projectiles in `destroyAll`. **Kept as the port has it** - a
  deliberate departure, recorded here rather than "fixed" back into a
  leak.

One question is **left open**, not refuted: the mod parents the burning
foe's light to the foe's transform at `back*0.4 + up*0.6`
(`StartLight`, 0x449d). Whether that transform's origin is the enemy's
feet or its capsule centre could not be settled from this session's
reference tree (DFU's own source was not reachable), so the port's
reading - the feet, which is what `f.ai.feet` names - stands, and the
question is written down here for whoever next has the tree.

## What was broken

### The arithmetic (F1)

- **F1 - the dropped light sat half a torch too low.**
  `SpawnLightSource` raises the CENTRED billboard by half its texture
  height so its base lands on the drop point (0x37f4), and then hangs
  the light half a unit above **the billboard** (0x38b0-0x38cf): the
  flame is at `point + halfHeight + 0.5`. This port's batches are
  base-aligned, so the drop point already IS the mod's centre - but
  `lights()` read the light off the point alone, putting it at `+0.5`:
  0.425 low for a torch, under the floor of anything the torch stood on.
  Now `pos + |size.h|/2 + 0.5`, off the texture's own height, so the
  candle (19 px) and the holy candle (21 px) differ from the torch
  (34 px) as they should. `droppedTorches.js` `lights()`.

### The clocks (F2, F9)

- **F2 - a world-clock jump burned every torch, and a load is a jump.**
  The mod burns by `TimeScale / 12 x Time.deltaTime` every frame
  (0x1a37) and, after a REST window only, by `elapsed world seconds / 12`
  in one go (`OnRestWindowClose`, 0x45b). HT1 folded those into one law -
  the world-minute delta - which is right for both, and wrong for every
  OTHER way the clock can move: `Time.deltaTime` is not inflated by a
  load, but a world clock is. An in-session load (the pause window's
  Load, F12's envelope) of a save three days ahead destroyed every
  restored torch on the first frame after the restore. The pool now
  re-latches its clock wherever time can pass without the player living
  through it - a restore, a transition sweep, and the first light into
  an empty pool (an empty pool burns nothing, so the hours it slept are
  nobody's). A rest still ages them exactly as the mod's own hook does.
  `droppedTorches.js` `tick` / `restore` / `destroyAll` /
  `spawnLightSource`.
- **F9 - the throw arc was integrated every frame and nothing could draw
  it.** `DrawTrajectory` ran on every frame the throw key was held: up
  to 300 integration steps and 300 raycasts, feeding an array
  (`handheld.trajectory`) that no host, no renderer and no test ever
  read. Nor could they: the mod draws the arc with a `LineRenderer`
  (0x1e4a), and this renderer has no world-space line - `drawMeshWire`
  wants a mesh's own edge buffer and the only other `gl.LINES` is the 2D
  world map's. The law is kept whole as an exported pure function
  (`throwArcPoints`, pinned end to end: the hand offset, the tilt, the
  step, the wall break, the 300), the per-frame call is gone, and
  `Throwing.ShowTrajectory` says on the pane that it is DFU-only, beside
  `EmissionShadows`. A world-space line primitive is the prerequisite
  for lighting it up again; that is a renderer slice, not an audit's.

### The lifetimes (F3-F8, F11, F12)

- **F3 - the thrown torch's sprite flew half a torch above its own
  arc.** The mod sets the projectile's billboard to the flight point
  RAW (0x3a9b) - no half-height raise, unlike the dropped one - so its
  centred quad is centred ON the flight. The port built it base-aligned
  there, lifting the sprite half a height off the path it collides
  along (and off the light, which the mod hangs over the quad's middle).
  Now built and rebuilt, in flight and through a recenter, on a base
  half a height below the point.
- **F4 - the interior entry destroyed the torches its own restore had
  just put back.** `enterInteriorCore` restored the room's scene cache
  (`restoreInteriorScene()`), and thirty-one lines later called
  `interiorTorches.destroyAll()`. A light left in a shop survived
  neither walking out and back in nor a save and load, while the sibling
  pile pool restored correctly beside it. The sweep is the TRANSITION's
  (`OnTransitionInterior`, 0x7d1), so it runs where the transition is -
  at the top of the entry, above the restore.
- **F5 - the dungeon teardown walked past the pool.**
  `dungeonContext.destroy()` frees the foes', the corpses' and the
  missiles' billboard batches, the static wall torches' looping sources
  and the ground piles' batches - and never touched the dropped
  torches. Every dungeon exit leaked one batch and one 3D burning loop
  per torch on the floor, and the loop kept burning in the player's ear
  above ground. It joins the list, with the rig's own component (F8).
- **F6 - the quest-teleport / load exit left the interior pool live.**
  `forceExitToExterior`'s teardown mirrors `tryExit`'s item for item -
  foes, guards, piles, hit effects - and HT1's pool was the one that
  never joined it.
- **F7 - a torch 76 units off ate the click a shop door was owed.** The
  exterior torch arm stands above `modes.tryEnter()` and compared its
  pick against the corpse and the pile alone. Every handler family in
  this port publishes `distance: RAY_DISTANCE` (76.8) with its own
  `reach`, so ANY torch under the crosshair beat a door at arm's length
  and answered "You are too far away". The rival distance the enemy arm
  and townTalk already take carries the door's distance; the torch arm
  reads it now, and the value is read once a frame instead of twice.
  This is AUDIT 65 MC-2's own law - the nearest thing under the one ray
  takes the click - and the torch arm was the one that did not take it.
- **F8 - nothing ever called the component's dispose().** It frees two
  things that outlive a frame: the burning `AudioSource`, and
  PlayerTorch's position override, which is a PROCESS GLOBAL. No caller
  existed outside the tests. So a torch lit at a teardown roared on into
  the next scene, and one Ambidexterity flip welded the player's light
  to the torch hand for the life of the page - across a load, across a
  new character. Worse: `update()` runs only while the mod's switch is
  ON, so turning it off with a torch lit stranded the loop where even
  its own stop arm could not reach. The rig owns the component, so the
  rig owns its end - on the switch's falling edge, and through
  `weaponRig.dispose()`, which `dungeonContext.destroy()` now calls.
- **F11 - the street's torches burned in the player's ear through a
  shop visit.** The exterior sweep sat with the tick at the foot of the
  frame, below the modal early return that every indoor mode takes - so
  walking into a building left the street's dropped torches standing,
  their batches held and their 3D loops playing, swept only on the first
  frame back outside. `DestroyLightSources_OnTransition` is an EVENT in
  the mod, not a frame-tail chore; the sweep sits at the mode branch
  now, above the return, in both exterior hosts.
- **F12 - a burning foe's flame stayed where the world used to be.**
  Found by this audit's own new pin, not by the reading: `offsetAll`
  moved the flame's POSITION on a floating-origin recenter and left its
  quad at the pre-recenter spot - and `tickFlames`' only other rebuild
  compares the (already recentred) foe against the (already recentred)
  position, finds them equal, and never rebuilds. The light followed the
  foe; the fire stayed a kilometre away. The flame's batch is rebuilt
  with the dropped lights' now.

### The settings (F10)

- **F10 - a range multiplied by a brightness, through a dep no host
  passed.** The pool took a `torchLightScale()` and multiplied the
  dropped light's RANGE by it, as the mod multiplies by
  `PlayerTorchLightScale` (0x1bb3). No host ever passed one, so it was
  permanently 1 - and it could not be passed, because this port's own
  lane holds that setting inert on purpose: "it is a 0..1 BRIGHTNESS,
  its default of 1.0 is a no-op, and mapping a brightness slider onto a
  radius would be a worse lie than leaving it alone"
  (`playerTorch.js`). One decision, one place: the dep is gone, and
  `DROPPED_LIGHT_INTENSITY` - exported, read by nothing - with it.

## The pins that pinned nothing

The 19 HT1 pins passed on the broken code above, which is the audit's
other finding. The third pass listed what each would survive; these are
the ones now held by `test/audit66_handheldtorches.test.js`:

- **The masked bow arm.** Every "a bow in the left hand takes both"
  case in the suite had an EMPTY right slot with `usingRightHand` true,
  so the bare-right-hand arm produced the same answer: deleting
  `else if (isBow(left)) w.handRight = false;` passed the whole file.
  Pinned now with a dagger in the right slot and the hand idle.
- **The burning loop's kind gate.** Only the lantern was tested;
  `!isLantern(l)` in place of `isTorch(l)` set candles roaring and the
  suite stayed green.
- **The throw's yaw scatter.** Only `dirStart[1]` was asserted, and the
  second rotation is about the up axis, which preserves y - so deleting
  it was invisible.
- **The two ladders.** The ignite ladder was only ever raced
  lantern-over-torch and the drop ladder only ever ran with one
  candidate in the pack, so either table could be reordered freely.
- **The doused record's load**, asserted by an EMPTY emissions array -
  which passes just as happily if the record never loaded at all.
- **A torch in flight**, whose light and batch were never composed while
  it flew, and whose sprite and 3D loop were never required to follow
  it.
- **The flame's housekeeping** - the recenter (which is how F12 was
  found), the sweep when a foe leaves the pool, and the impact point the
  ignite clip rings at.
- **The wind-up clamp**, compared to the very constants it is built
  from: `THROW_STRENGTH_MIN = 0.9` passed. The IL's literals are the
  pin now.

Recorded and NOT paid (they are gaps in coverage, not defects, and the
list is here so the next pass can take them): the large HUD's floor is 0
in every test, so the three placements' floor term and
`getSpriteRect`'s clamp are unexercised; `LockAspectRatio` cannot be
distinguished at 640x400; `scaleTextureFactor` divides by 1 everywhere;
the relaxed-lantern sprite branch is never reached with
`Modules.Sprite` on; `Throwing.Accuracy` reaches no assertion because
the roll is pinned at a certain hit.

## Integration

One lane, no worktrees - the twelve findings touch six files and the
fixes do not cross. The gate ran green at each step
(`npm run check`: lint, `node --test`, build), and the two pin files
were run together after every change: 19 HT1 pins re-aimed where the law
moved (the arc, the light's height, the sweep's place, the ladder's
rival, dispose's owners) and 16 new ones.

## The cost

Six source files (`systems/handheldTorches.js`,
`scenes/droppedTorches.js`, `combat/weaponRig.js`, `scenes/world.js`,
`scenes/exterior.js`, `scenes/worldModes.js`,
`scenes/dungeonContext.js`, `systems/modSettings.js`), one new pin file,
this record. No new dependency, no new renderer surface, one dep and one
constant removed.

## Lessons

1. **A mod port's arithmetic is the easy half.** The IL is a reference
   you can hold the port to line by line, and this one held: twelve
   findings and exactly one of them was a number. The hard half is
   everything Unity did for the mod that a closure in this port must be
   told to do - and the tell is always the same question: *who ends
   this?* Every teardown list in the tree is a checklist a new pool must
   be added to, and nothing in the language will remind you.
2. **"On a transition" is a place in the frame, not a line in a
   function.** F4 and F11 are the same mistake twice: a sweep that reads
   correctly where it stands, and stands where the transition has
   already happened (after the restore) or where the frame never reaches
   (below the modal return).
3. **A dead consumer is a silent feature loss.** F9's arc was computed
   perfectly, every frame, for nobody. The port had no primitive to draw
   it with and nothing in the build says so - which is exactly why the
   not-carried list in a port's own page has to be written when the gap
   is made, not when it is found.
4. **A pin that re-derives its expectation from the implementation is a
   comment.** `THROW_STRENGTH_MIN` compared to `THROW_STRENGTH_MIN`
   passed for the life of the slice. The IL's literals cost nothing to
   type.
5. **The test that found F12 was written to certify a fix, not to hunt.**
   Writing one pin per finding turned up a thirteenth thing the reading
   had missed. Pins pay twice.
