# AUDIT 28 - THE POST-26 SWEEP (2026-08-30 to 2026-08-31; the SETTINGS LENS CLOSED, lens 3 open)

Mac's call after WM4 and CR1 closed: keep pushing the 1:1. The ledger's
own restock (LR1, 2026-08-29) names a fresh systematic audit as the one
source a session can start alone, and this is it. AUDIT 26 read the
whole of `src/` at `4fdccc57`; since then 240 modules changed and
40,368 lines landed (`git diff --stat 4fdccc57..HEAD -- src`). This
audit reads that surface against the DFU checkout in the container
(`Interkarma/daggerfall-unity`, `Assets/Scripts`, sparse), one lens at a
time, and records refutations as well as findings - a claim the port
already handles is worth writing down so nobody chases it twice.

## Method

No surveyor pool this time: one reader, main loop, DFU source open
beside the port. Three lenses, in order of expected yield:

1. **Cross-cutting sweeps that a script can seed** - the shapes that
   have historically produced the bugs here (a host that fell behind
   its siblings; a law ported with its setting named and never read).
2. **The four-hosts diff** over the foe stacks: what `dungeonContext`
   calls that `exteriorFoes` does not, and the reverse.
3. **Module reads** of the largest post-26 DFU-cited modules.

Every confirmed finding ships with a fix and a pin in the same wave;
every refuted claim is recorded under the wave that raised it.

## W1 - SETTINGS DFU READS THAT THE PORT ANSWERED WITH THE DEFAULT

**The sweep.** `settings.js` tiers every one of DFU's 171 keys as live,
stored or unavailable. A `stored` key is, by definition, one whose DFU
consumer the port has not wired - so the stored list IS a list of
unported laws, and it is checkable key by key. 103 keys are stored.
Of those, 68 are the Unity renderer's and the post-processing stack's
(Video/Effects/Spells shadows, antialiasing, bloom, DoF, vignette,
colour boost, texture arrays, retro mode, mipmaps, VSync, quality) -
the WebGL2 renderer is a Ledger A departure and those keys have no law
to answer to here. The remaining 35 are GAMEPLAY keys with a DFU
consumer, and each was checked for a port consumer.

### Confirmed and CLOSED in W1 - four laws ported with the setting named in their own comment and never read

| Key | DFU reads it at | The port's consumer | What it did |
|---|---|---|---|
| GUI/QuestRumorWeight | TalkManager.WeightedRandomRumor :1452, GetInt 1..100 | `systems/rumorMill.js` - took `deps.questRumorWeight` and no host ever passed it | quest rumors weighed 50 whatever the slider said |
| GUI/DisableEnemyDeathAlert | EnemyDeath :82 | `scenes/corpseMarker.sayEnemyDied` - quoted the `if` in its header, had no `if` | every kill spoke |
| Enhancements/DungeonAmbientLightScale | PlayerAmbientLight :89 (the plain-dungeon arm only) | `world/dungeonLights.dungeonAmbientFor` - quoted the multiply, returned the constant | dungeons lit at 1.0 |
| Enhancements/NightAmbientLightScale | PlayerAmbientLight :123 | `worldClock.exteriorAmbient(minute, nightAmbientScale)` - both exterior hosts passed the literal `1` | nights lit at 1.0 |

Each read now sits at DFU's own site with DFU's getter range; the four
keys are LIVE at the module that reads them; a shape guard pins that a
consumer naming a Settings key reads it. `test/audit28_settings.test.js`,
6 pins; 5 mutants, 5 killed.

### The rest of the 35, classified

**Ported with a considered reason not to read** (no action):
`Enhancements/PlayerTorchLightScale` - `playerTorch.js` records why a
0..1 brightness must not be mapped onto the port's radius model.

**Default-ON DFU features the port does not have - the W2 queue, in
this order:**

- `GUI/EnableArrowCounter` (True) - DaggerfallHUD :272-292: with an
  unsheathed bow, the arrow stack count beside the compass, in the
  conjured colour when the arrows are summoned. NOT PORTED; hud.js
  mentions only that the large HUD drops it.
- `MeleeAttacks/MeleeAttackFriendlyProtection` (True) - WeaponManager
  :933: a melee swing does not land on a non-hostile. The port's swing
  has no hostility gate.
- `GUI/DungeonExitWagonPrompt` (True) - PlayerActivate :654: the
  "bring the wagon?" box on a dungeon exit when the player owns one.
- `Enhancements/NearDeathWarning` (True) - HUDFlickerController: the
  HUD flicker as health falls. Nothing in `src/ui` flickers.

**Default-OFF DFU features the port does not have** (recorded; each a
candidate slice when Mac wants the setting real):
`Video/RandomDungeonTextures` (modes 1-4; the port passes the world
climate where DFU passes the MODE and has no main-story gate and no
`RandomTextureTableAlternate` - the classic mode 0 it ships is right),
`Enhancements/AlternateRandomEnemySelection` (RDBLayout :512),
`Experimental/SmallerDungeons` (Quest :284 + SerializablePlayer :224 -
`quest.js` carries the field at 0), `Controls/ToggleSneak`
(StartGameBehaviour :277), `GUI/HelmAndShieldMaterialDisplay`
(ItemHelper :833 - `itemInfo.js` hard-codes 0 with a "the port has no
settings layer" note that U29 made stale), `Enhancements/
BowLeftHandWithSwitching`, `GUI/EnableModernConversationStyleInTalkWindow`,
`GUI/EnableInventoryInfoPanel`, `GUI/EnableEnhancedItemLists`,
`GUI/EnableGeographicBackgrounds`, `GUI/HideLoginName`,
`GUI/DimAlphaStrength`, `GUI/LargeHUDUndockedOffsetWeapon`,
`GUI/LargeHUDOffsetHorse`, `GUI/ShopQualityHUDDelay` (the HUD line's
duration - the presentation mode is live, its delay is not),
`GUI/AccelerateUICopyTexture`, `GUI/SDFFontRendering`,
`GUI/EnableQuestDebugger`, `Controls/HeadBobbing`, `Controls/Handedness`,
`Controls/WeaponAttackThreshold`, `Controls/WeaponSensitivity`,
`Controls/MovementAcceleration`, `Controls/WeaponSwingMode`,
`Controls/CameraRecoilStrength`, `Controls/BowDrawback`,
`Controls/MouseLookSmoothingFactor`, `MeleeAttacks/MeleeAttackDetection`,
`Enhancements/LypyL_GameConsole`, `Experimental/AssetCacheThreshold`,
`Experimental/TerrainHeightmapPixelError`, `Audio/SoundFont`,
`Video/AmbientLitInteriors`, `GUI/GUIFilterMode`, `GUI/VideoFilterMode`.

## W2 - THE DEFAULT-ON ABSENTEES

### W2a CLOSED: the arrow counter (DaggerfallHUD.cs:270-292)

With a bow drawn, DFU prints the arrow stack count left of the compass
(grey; the translucent blue when the stack is conjured; "0" when the
quiver is empty), and the port had never drawn it - `hud.js` mentioned
the counter only to say the large HUD drops it. `hud.arrowCountLabel`
is the pure half, three gates in DFU's order (the setting, the weapon
drawn, a bow in the hand `BowLeftHandWithSwitching` names) over the
same `GetItem(Arrow, allowQuestItem: false, priorityToConjured: true)`
the bow spends from; the draw is :281-284's placement in the classic
compass arm. All four hosts hand `drawHud` the drawn state.

FOUND ON THE WAY: `worldModes`' interior frame had never handed `drawHud`
a font, so nothing text-shaped on the classic HUD could draw indoors -
the interaction-mode word included - while DFU draws its one HUD
everywhere. It carries `townTalk.font` now. `EnableArrowCounter` and
`BowLeftHandWithSwitching` are LIVE. 4 pins; 5 mutants, 5 killed.

### W2b CLOSED: melee friendly protection (WeaponManager.cs:930-944, :1057-1064)

`MeleeDamage` has two arms. The bounding-box pass strikes every entity
in reach and, under `MeleeAttackFriendlyProtection` (ships True), skips
a PlayerAlly, a foe whose motor is not hostile, and a MobilePersonNPC.
Only when NOTHING was struck does the vanilla SphereCast fall through
"for bashing and hitting pacified NPCs and wandering commoners" - so a
pacified foe or a townsperson can be hit only when it is the sole thing
in front of the player. The port's `resolveHit` (all three foe pools)
had no team or hostility filter: a pacified foe beside a hostile one
took the swing, and the setting sat stored.

`friendlyProtected` is the filter; `resolveHit` keeps the protected foes
it passed over and, if the box pass struck nobody, strikes the NEAREST
of them. That last word is the one departure and it is recorded: DFU's
fallback is a ray down the look direction and the port's `canSee` is an
FOV + LOS test with no ray, so "first collider on the ray" becomes
"nearest in reach". Townspeople are not in any pool; the world host's
civilian arm already runs only after the pools miss, which is :1057's
order. 5 pins; 5 mutants, 5 killed - one of them survived a `deepEqual`
over structurally identical fixtures until the pin was rewritten on
identity, which is worth remembering.

### W2c CLOSED: the exit-door wagon prompt (PlayerActivate.cs:649-664)

A dungeon exit with a Small_cart in the pack and
`DungeonExitWagonPrompt` (ships True) raises TEXT.RSC 38 as a YesNo box
and RETURNS: No leaves the dungeon, Yes calls
`AllowDungeonWagonAccess()` and opens the inventory - whose
`CheckWagonAccess` FIRST arm selects Remove and shows the wagon
wherever the player stands - and Escape closes the box with nothing
done (`allowCancel`). The port had the second half waiting:
`inventorySession`'s NT3 note recorded "a producer the port does not
have yet; when it lands it must pass a flag that forces Remove". It
landed: `deps.dungeon.wagonPrompt` is that flag, `tryExitDungeon` asks
first, `exitDungeonNow` is the exit split out so No can take it, and
`ServiceFlowWindow` grew an `onEscape` a box may name. The `isBash`
gate (:651) has no counterpart here - the exit door is not a bash
target in this host. 3 pins; 4 mutants, 4 killed.

### W2d CLOSED: the near-death warning (HUDFlickerController.cs)

`Enhancements/NearDeathWarning` ships True and the port had nothing
behind it. `ui/hudFlicker.js` is the four classes whole and pure:
below 40% health a fast red flicker (7/s to alpha 0.4, seven reversals
and out, restarted by every new HealthLost), below 20% a slow throb
(0.1..0.4 at 0.2/s, never timing out on its own) between bursts. The
colour is the HUD's PARENT PANEL background, so it draws as a screen
quad under the bars in both HUD branches, off the detector's HealthLost
the vitals rig just computed. Two gates read DFU's fade system
(`FadeInProgress`, the parent's alpha > 0.9) and this HUD had no fade
to read; they answered false, recorded - CLOSED by D4 (2026-09-02),
which ported `FadeBehaviour.cs` into `ui/fadeLayer.js` and feeds both
from it. They were never decoration: DFU's fade targets the very panel
this controller writes (`DaggerfallUI.cs:409` vs
`HUDFlickerController.cs:81-82`), so without them a healthy frame's
`new Color()` would strip a smashed-to-black screen. The tint is
written INTO that panel now rather than painted beside it. One
equivalence proven rather
than pinned: the `condition != Wounded` guard on the gain arm is
overwritten by the Wounded arm every frame in DFU as here. 6 pins;
6 mutants, 5 killed + 1 equivalent.

## W3 - THE DEFAULT-OFF KEYS, as they are cheap and real

### W3a CLOSED: HelmAndShieldMaterialDisplay (ItemHelper.cs:822-848)

`itemInfo.armorShouldShowMaterial` read a constant 0 under a note that
"the port has no settings layer", stale since U29. It reads the setting
at the point of use now, all four values: 0 classic (a helm or shield
never shows its material), 1 all but leather and chain, 2 all but
leather, 3 all; an artifact never. `item.material` IS DFU's raw
nativeMaterialValue, so the `>=` compares hold.

### W3b CLOSED: AlternateRandomEnemySelection (RDBLayout.cs:512, :1290-1346)

The classic arm - the 256-entry lists off DFRandom seeded with the
LocationId - was ported since C3; the alternate arm was not, and the
setting sat stored. `alternateRandomEnemyType` is AddRandomRDBEnemy:
per flat, the table by water, base index `(int)(len * clamp01(level /
20))`, +/- RandomMonsterVariance 4 clamped, `Random.Range(min, max+1)`.
Unity's stream is the locationId xorshift the slot reroll already uses
(Ledger A - DFU seeds it with `DateTime.Now.Ticks`). The `(int)` cast is
pinned on a synthetic table, because on the shipped 20-entry tables the
product is an integer at every level and a round-for-trunc mutant
survived until it was.

### W3c CLOSED: RandomDungeonTextures (DaggerfallDungeon.cs:174-196)

The port called `randomTextureTableClassic` bare - always mode 0 - and
the setting sat stored. The whole fork is in `dungeonTextures.js` now:
the five modes; `isMainStoryDungeon` on the RAW MapId (Summary.ID :104,
fourteen ids), which takes the PLAIN classic table unless the mode is
2 or 4; `randomTextureTableAlternate` - six draws from the 24-archive
pool with slot 5 forced onto a sewer archive only when it is not one -
seeded per dungeon on the MapId through the same xorshift that stands
in for Unity's seeded stream everywhere else (Ledger A: the sequence
differs from Unity's Xorshift128, the per-dungeon determinism does
not). `dungeonLayout` routes through the fork.

## THE SELF-AUDIT (2026-08-30, Mac: "a comprehensive audit on everything so far")

Every commit of the session re-read against its own claims, every DFU
citation re-opened, and the sweeps AUDIT 27 runs pointed at the day's
own work. Verified sound: all fourteen getter ranges against
SettingsManager.cs itself; the arrow counter's colours and both
placement axes (:281-284); the wagon prompt's record 38, its button
handler and allowCancel (:653-664, :1133-1145); friendly protection's
exact three exclusions and the unconditional box arm (:930-944); the
night-scale lerp (`ExteriorNightAmbientLight * scale` as the lerp's
START, :123); ROTOR_SIGN re-derived from the shipped code; both
windmill bakes regenerate byte-identical; the string teams; LIVE's 63
keys each named in their module. Six findings, all fixed in this
commit:

- **F-A1** `GUI/QuestRumorWeight` went LIVE in W1 and the settings
  SCREEN still showed a dead readout - a number with no stated range
  stays text, and this one's range IS stated (GetInt 1..100). It has
  its NUMBER_LAW row now - which surfaced **its own find**: a law with
  no unit printed "50 undefined". A bare number reads as itself.
- **F-A3** the arrow counter's 8px gap shipped as `8 * s`; :282 adds 8
  RAW screen pixels after the scaled sizes. Raw now, pinned raw.
- **F-A5** (the serious one) the wagon prompt's No called
  `exitDungeonNow()` from INSIDE the dungeon ctx's own `overlayInput`
  dispatch, which goes on to run `surfacePlayer()` on the ctx the exit
  just destroyed - the 2026-08-29 crash's shape wearing a new coat, and
  the split function's comment had even promised "a frame later"
  without delivering it. No sets `pendingDungeonExit`; the dungeon
  frame takes it first thing, outside any dispatch.
- **F-A6** the flicker stepped on raw dt under an open window; DFU's
  steps on Time.deltaTime, which pause holds at 0. It freezes with the
  bars now (`cursorActive ? 0 : dt`, both branches).
- **F-A2/A4** five dead exports of the session's own making - the F301
  shape - unexported (`ALPHA_DIRECTION`, `MAIN_STORY_DUNGEON_IDS`,
  `VALID_SEWER_ARCHIVES`, `makeSeededRng`) or removed
  (`_resetNearDeathFlicker`, a test door no test used).

4 self-audit mutants (exit inside the dispatch, flag never taken, the
scaled gap back, raw dt while paused), 4 killed.

## W4 CLOSED: SmallerDungeons (MapsFile.cs:766-797, :1366-1444)

`Experimental/SmallerDungeons` ships False and the port carried only the
quest save field, at NotSet. `world/smallerDungeons.js` is the law
whole: over five blocks, the dungeon regenerates as a plus of five - a
random interior block centred and starting, four random border blocks
(`^B`, case-insensitive) around it - from its OWN list, DFRandom seeded
on the raw MapId, so the small dungeon is the same one every visit.
Main-story dungeons never shrink, and both of DFU's throws are
verbatim. `UseSmallerDungeon` consults a live quest's FROZEN state
through its first Dungeon SiteLink before the setting - `Quest.Start`
stamps it (Quest.cs:284), the quest save carries it, an old envelope
restores NotSet. The entry seam sizes the location BEFORE the context
is built, on a CLONE - the one deliberate shape departure, recorded in
the module header: DFU regenerates a struct copy inside GetLocation,
and the port's locations are cached objects the exterior shares.
The dungeon save stamps the raw setting (SerializablePlayer :224) and a
load under the other setting warps to the start marker with a HUD line;
story dungeons and old envelopes never (:462-472). 7 pins; 9 mutants,
9 killed.

## SELF-AUDIT 2 (2026-08-30, Mac: "a comprehensive audit on everything so far", again)

The W4 commit and the whole session re-read once more. Verified sound:
the quest layer touches exactly six maps methods and the F-B2 wrap
covers the two that answer locations; `setSeed` wraps a negative int32
MapId through uint exactly as the C# cast; `randomRange(0, n)` IS
DFU's one-arg `random_range(n)`; the GenerateRDBBlock spread keeps
waterLevel and the rest as the C# struct copy does; `quest.start()` is
called by the machine at :486; there is exactly ONE quest bridge and
one questWorld, so the wrap covers every quest-layer fetch. Three
findings, fixed here:

- **F-B1** the load-time warp set the RAW start-marker position while
  every other spawn goes through the entry law (`floorLanding` over
  `m.y + 1.08`) - a raw marker y can stand the player in the floor.
  The warp is `startSpawn({ preferEnterMarker: false })` now, which is
  also DFU's member: :470 names StartMarker explicitly.
- **F-B2** (the real one) quest dungeon marker enumeration walked the
  UNSIZED location. DFU's law lives INSIDE MapsFile.GetLocation, so
  quests pick markers from the five-block dungeon - the frozen state
  exists precisely so those five blocks come back. A quest set up under
  the setting could aim at a block the build does not have. The quest
  world's `maps` now wraps `getLocation`/`getLocationByName` through
  `dungeonLocationFor`, late-binding the bridge's machine - and DFU's
  GetLocation consults the global machine the same way, so another
  quest's link on the same dungeon winning is DFU behaviour too.
- **F-B3** DFU's QuestSmallerDungeonsState is NotSet, DISABLED,
  ENABLED (DaggerfallUnityEnums.cs:758-763); the port shipped
  Enabled=1/Disabled=2 - internally consistent and numerically
  backwards, and these values are the save format. Enum, save stamp
  (`? 2 : 1`) and warp compare corrected; the enum is pinned by value.

4 self-audit-2 mutants (enter marker preferred, quest sees the full
dungeon, enum backwards, stamp backwards) + the three W4 warp mutants
re-run; all killed.

## W5 CLOSED: ToggleSneak (PlayerSpeedChanger.cs:75-78)

The port's sneak was held-only at all four host input sites and the
setting sat stored. The capture is the motor's now, every frame: under
`Controls/ToggleSneak` the mode is `sneakingMode ^= ActionStarted(Sneak)`
- a press flips it, release keeps it - and the held key otherwise. P15's
grounded latch still decides when the mode takes effect; running still
beats sneaking and the toggled mode survives the run. 3 pins; 4 mutants,
4 killed.

## W6 CLOSED: ShopQualityHUDDelay (PlayerActivate.cs:1382)

The HUD presentation mode was live since BG1 and its DURATION was not:
every shop-quality line popped on hudText's default clock. The HUD arm
passes the setting (GetInt 1..10) through `townTalk.say`'s new delay
argument to `hudText.add`'s `delayInSeconds` - AddHUDText's own second
argument. Key LIVE, with its NUMBER_LAW row on the screen.

## W7 CLOSED: MouseLookSmoothingFactor (PlayerMouseLook.cs:154-166)

The first of the camera-feel controls, and the one that changes the
DEFAULT feel: the setting ships 0.5, so DFU's look is smoothed out of
the box, and the port applied raw deltas straight to the camera on the
event at all eight sites (mouse + touch, four hosts). `player/
lookFilter.js` keeps the residual owed to the camera and pays DFU's
frame-rate-scaled fraction of it each frame - the same arithmetic as
lookCurrent/lookTarget, proven frame for frame, with the property the
hosts need: an external write to the camera (a door's facing, a load, a
teleport) needs no resync because the residual is a delta. The pitch
clamp lands on the target as :142 has it. The settings screen's range
was "ours: 0..1"; it is DFU's clamp (0..0.9) now. The controller minimum
(:159-160) has no controller to read and is not ported. 6 pins; 5
mutants, 5 killed.

## SELF-AUDIT 3 (2026-08-30, Mac: "a comprehensive audit on everything so far", the third)

W5, W6 and W7 re-read against the C#; the LIVE and dead-export sweeps
re-run clean. Three findings, all fixed here - two against W7's own
framing, one against a W5 pin that had asserted the opposite of the
law:

- **F-C1** PlayerMouseLook.Update returns before ApplyLook while the
  game is paused (`enableMouseLook = !IsGamePaused`, :241-244): the
  owed look WAITS under a window. The port's filter ticked every frame.
  All four hosts gate the tick on the same expression their lookGate
  reads.
- **F-C2** while the swing action is held (WeaponSwingMode 0, not a
  bow, :248-253) DFU takes the ELSE arm - `SetFacing(lookCurrent)`,
  whose Init sets target = current - so the look a swing interrupted is
  DROPPED, never paid out afterwards. `LookFilter.settle()` is that;
  the three swinging hosts track the raw right button (HasAction, on
  the window, ungated) and settle while it is held with a non-bow in
  hand; the dungeon ctx exposes `weaponIsBow` for its standalone host.
- **F-C3** ApplyInputSpeedAdjustment CLEARS `sneakingMode` while
  running (:121-125, "switch sneaking off if was previously sneaking"):
  under ToggleSneak a run ENDS the toggled sneak. The W5 pin had
  asserted "the toggled mode survives the run and comes back" - an
  assumption written as a law. Motor and pin corrected; the held mode
  is unchanged because it re-latches from the key next frame, as DFU's
  does.

4 mutants (settle always, pays while paused, run keeps the toggle,
settle keeps the pitch), 4 killed.

## W8 CLOSED: MovementAcceleration (InputManager.cs:1445-1497)

The second camera-feel control, default OFF. The hosts produced the
movement axes as the bare held-key difference; `player/moveAxes.js` is
one InputManager Update - a force per held action climbing the axis at
9.8/s toward +/-1 (or the axis IS the key without acceleration), then
friction decaying an axis whose impulse was not raised at 9.8/s to 0.
All four producers hand the motor the axes and advance them only on
frames the motor runs (a held overlay is timeScale 0). Two things worth
knowing: under acceleration a reversal moves two steps a frame while the
axis is still on the old side (force AND friction - DFU's own
arithmetic), and in classic mode DFU's answer to two opposing keys
depends on keybind dictionary order, so the port keeps its neutral
difference there. 5 pins; 5 mutants, 4 killed + 1 proven equivalent.

## W9 CLOSED: CameraRecoilStrength (CameraRecoiler.cs, whole)

The second default-feel one: the setting ships 3 (High), so DFU's
camera reels on every hit above 2% of max health, and the port's never
did. `player/cameraRecoiler.js` is the class whole - the timer of
(5 + floor(pct*5))*PI falling at 2*PI/s, the rotation scalar dying with
it, the random unit axis, the ADDITIVE rotate on the camera (x pitches
down in Unity's frame, y turns right) - a PER-FRAME OFFSET on the look (self-audit 4 corrected the first cut,
which accumulated) - driven by the same per-frame HealthLost the
near-death flicker reads. Three hosts run it after the
look on the same paused gate; interior.js is a fly camera with no
entity and has nothing to reel from. Unity's `insideUnitCircle` is
`rolls` (Ledger A). 5 pins; 5 mutants, 5 killed.

## W10 CLOSED: HeadBobbing (HeadBobber.cs, whole)

The third default-feel one: the setting ships True, so DFU's camera bobs
and nods with every step, dips on a landing, and the port's never did.
`player/headBobber.js` is the class whole - the style table, the timer
at velocity * bobSpeed, the cos/|sin| path with its begin blend, the
0.5 s release lerp, the landing bounce with its water speeds. Two
port-shape decisions, both recorded in the module: the POSITION rides
`player.eye` as a world-space offset the motor adds (every camera and
every ray in the port reads player.eye, exactly as every DFU ray reads
the bobbed camera transform), and the NOD is a per-frame offset on the
look, removed before re-applied, because PlayerMouseLook writes absolute
angles each Update and the bobber's Rotate sits on top. One DFU quirk
kept verbatim: Update returns while airborne, so the landing bounce only
ever arms through the swimming arm. 7 pins; 6 mutants, 6 killed.

## W11 CLOSED: WeaponAttackThreshold + WeaponSwingMode (WeaponManager.cs:306-350, :808)

The threshold is the FIND of the wave: StartGameBehaviour :263 writes
`Settings.WeaponAttackThreshold` over WeaponManager's 0.05 field default,
and DFU's shipped ini says 0.005 - so the port, gating on the field
constant since the gesture first shipped, demanded ten times the mouse
travel DFU does before a swing fires. If swings ever felt like they
needed a shove, this is why. The gesture reads the setting at the point
of use now; the field constant stays what it is; the AUDIT 24 trail
pins pass it explicitly. WeaponSwingMode's other two arms are ported:
1 click, 2 click-or-hold, a random direction of six, no gesture
tracked, bows exempt. Both keys LIVE with screen rows.

`Controls/WeaponSensitivity` is REFUTED as a consumer: SettingsManager
:535 and WeaponManager :196 both have it commented out - DFU reads it
nowhere. It stays stored, and this is why.

## SELF-AUDIT 4 (2026-08-30, Mac: "a comprehensive audit on everything so far", the fourth)

W8-W11 re-read against the C#; the LIVE (72 keys) and dead-export
sweeps clean. One finding, fixed here, and a correction to the record:

- **F-D1** the camera recoil ACCUMULATED. `CameraRecoiler` calls
  `Transform.Rotate` on the camera, and I wrote it as an additive step
  on cam.pitch/cam.yaw, with a pin asserting the view "does not return
  exactly to rest, as DFU's doesn't". PlayerMouseLook.cs:257-263 says
  otherwise: it OVERWRITES the camera's localEulerAngles every Update,
  so the reel is a per-frame offset on the look - the same shape the
  head bobber's nod was given a wave later, and the same reasoning
  should have been applied to the recoiler. The view returns exactly to
  the mouselook heading when the sway ends. Fixed and re-pinned; the W9
  record below is corrected.
- **Verified sound** with the frame-order caveat recorded: the bobber
  and recoiler read the motor's previous-frame moveSpeed/HealthLost
  (the camera block runs at the top of the frame, the motor later);
  DFU's own Update/FixedUpdate ordering between those MonoBehaviours is
  no tighter. The axes keep accumulating under paralysis while the motor
  ignores them, as InputManager does under FrictionMotor's cancel.
- **Also verified:** the swing-mode fork's click edge, hold re-attack
  and six-direction range against :316-350; the `gesture` signature's
  fifth-arg callers; the trail pins' explicit field constant.

1 mutant (accumulation), killed.

## W12 CLOSED: BowDrawback (WeaponManager.cs:341, :353-360)

The machine had carried the draw-and-hold half since FX1 - StrikeUp to
the hold frame, the 10 s undraw, the StrikeUp -> StrikeDown release -
with a comment saying it becomes live "the moment the drawback path
does, with nothing here to change". That was exactly true. The gesture's
bow arm reads the setting now: a press draws, letting go at the hold
frame looses, ActivateCenterObject held un-draws (the full cooldown
charged, as a cancelled draw costs what an arrow costs). The activate
key reaches every rig through a new `activateHeld` dep - the dungeon ctx
threads its host's - which is the one seam the old comment did not
foresee. 5 pins; 3 mutants, 3 killed.

## W13 CLOSED: Handedness (FPSWeapon.FlipHorizontal)

`fpsWeapon.js`'s header had recorded the left-hand flip as unimplemented
"until a settings surface exists" - the surface has existed since U29.
Setting 1 (DFU's one checkbox; 2 and 3 sit in GetInt's range and do
nothing, `== 1`) mirrors the art and swaps AlignRight for AlignLeft on
Idle, StrikeDown and StrikeUp only; a side strike keeps its side and
AlignLeft is never swapped. The camera-feel and weapon-input set is
CLOSED with this. 3 pins; 3 mutants, 3 killed.

## THE CLOSING SWEEP (2026-08-31): every module that names a Settings key

W1's shape - a law ported with its setting named in a comment and never
read - run over the WHOLE tree, not just the stored list: for every one
of DFU's keys (8+ characters, to skip the noise), every module that
mentions it without a matching `getX('Section', 'Key')` read. Result:
every hit is a comment pointing at the module that DOES read the key
(the hosts naming the camera-feel keys the player/ modules read; the
equip rules naming BowLeftHandWithSwitching, read in hud.js), except
two stored keys, both recorded here as the last of the classification:

- `MeleeAttacks/MeleeAttackDetection` (ships 0, "Basic"). Setting 1
  ("Quality", WeaponManager.cs:958-972 and :997-1030) adds four extra
  sample points to the box pass's in-view test - centre plus or minus a
  quarter of the controller's height along camera-up, plus or minus half
  its radius along camera-right - and, when the centre ray is
  obstructed, casts to the head and feet points as well. The port's
  `canSee` is host-built on the centre alone, so the Quality arm needs
  the three pool hosts' canSee to take the extra points. A real slice,
  default off, queued, not started.
- `Audio/SoundFont` (ships empty). DaggerfallSongPlayer.cs:237 loads a
  named .sf2 from StreamingAssets/SoundFonts; the port's synth is its
  own (hmiFile.js) and has no file to load. Stays stored; this is why.

With these two named, the settings sweep is COMPLETE: 103 stored keys
at the start, 68 renderer/post-fx with no law to answer, 35 gameplay -
22 closed as waves, 1 refuted (WeaponSensitivity, read nowhere), 6
UI-only handed to the UI arc, 2 recorded above, and 4 (EnableQuestDebugger,
LypyL_GameConsole, AssetCacheThreshold, TerrainHeightmapPixelError)
that are tooling or Unity-internal.

## SELF-AUDIT 5 AND THE CLOSE (2026-08-31, Mac: "a comprehensive audit and bible update")

W12 and W13 re-read against the C# (the frame-3 gate, the activate
un-draw, the `== 1` handedness and its two flip sites) - sound. The LIVE
sweep: 74 keys, every one named in its module. Two of the "next
checkable list" candidates were run as part of the audit:

- **DFU constants vs the port's same-named constants.** Every
  `const int/float NAME = value` in the checkout against every
  `export const SCREAMING_NAME = value` in `src/`: 184 shared names, 8
  mismatches, ALL EIGHT name collisions across different DFU classes
  (EnemyBasics' MoveAnimSpeed 6 vs MobilePersonBillboard's 4;
  PlayerNotebook's MaxMessageCount 50 vs UserInterfaceManager's 10;
  MapsFile's MaxMapPixelX 1000 vs TerrainHelper's 998; and so on) -
  each port constant matches its OWN cited source. Zero real
  mismatches. A useful list to keep in `tools/` for the next audit.
- **Dead exports over every module AUDIT 28 touched:** 17, none of them
  AUDIT 28's own (GENERAL_ANIMS, STAFF_ANIMS, wrapRows,
  COMPASS_BOX_OUTLINE, activeSpellIconsPlaced, _resetActiveSpellHud,
  swapHealthAndFatigueColors, DUNGEON_LIGHT_INTENSITY, TABLE_LENGTH,
  TONE_NAMES, PERSON_HIT_RADIUS, PERSON_HIT_HEIGHT, loadSettings,
  MATERIAL_NAMES, getPaintFile, QUEST_SUCCESS_REP, QUEST_FAILURE_REP).
  Candidates for AUDIT 27's F301 treatment, not approvals; some are
  documentary constants a reader wants exported. Recorded, not touched.

### The close, in numbers

103 `stored` keys at the start. 68 renderer/post-fx with no law to
answer. 35 gameplay: **22 closed as waves** (W1 four named-and-never-read
reads; W2a arrow counter, W2b melee friendly protection, W2c the exit-door
wagon prompt, W2d the near-death flicker; W3a HelmAndShieldMaterialDisplay,
W3b the alternate random-enemy arm, W3c RandomDungeonTextures whole; W4
SmallerDungeons whole; W5 ToggleSneak; W6 ShopQualityHUDDelay; W7 mouse
look smoothing; W8 movement acceleration; W9 camera recoil; W10 head
bobbing; W11 the swing threshold - ten times too strict since the gesture
shipped - and the swing modes; W12 bow drawback; W13 handedness), **1
refuted** (WeaponSensitivity, read nowhere), 6 UI-only handed to the UI
arc, 2 recorded (MeleeAttackDetection Quality queued; SoundFont has no
file), 4 tooling. Five self-audits, thirteen corrections - every one in a
seam around a correct transcription, three of them (F-A5, F-B2, F-C3)
serious. Three DFU default-feel behaviours restored: the smoothed look,
the recoil on a hit, the walk bob.

**The rule the audit produced:** a `Transform.Rotate` on a transform
PlayerMouseLook rewrites is a per-frame offset, never an accumulation.

**Lens 3 stays open** - the module reads over the post-26 surfaces -
with this note: three spot-reads (EnemyBlood, the wagon capacity law,
RoundToInt's tie) came back equal, and the productive vein was the
checkable list. The next audit should find its list first.

## THE UI-ONLY KEYS (2026-08-31, open)

The six the settings sweep handed to the UI arc, taken one at a time:

- **UI3 CLOSED: `GUI/EnableGeographicBackgrounds`** (PaperDoll
  :203-230). It ships FALSE, so DFU's default backdrop is the RACE's -
  and the port has passed `context = 'town'` since U8f, the geographic
  answer, so every player has seen the town backdrop. The law is the
  setting's now, with DFU's 62-char region table and its
  guard-before-the-arms order. The world host supplies
  `GetPoliticIndex - 128`.
- **REFUTED: `GUI/DimAlphaStrength`.** DaggerfallPopupWindow's own line
  is `this.screenDimColor.a = 0; //DaggerfallUnity.Settings
  .DimAlphaStrength;` (:58) - commented out. DFU reads it NOWHERE, the
  same shape as WeaponSensitivity. It stays stored, and this is why.
- **NOT APPLICABLE: `GUI/HideLoginName`.** Its only consumer is
  DaggerfallUnitySetupGameWizard, DFU's first-run setup wizard, which
  the port does not have and is not porting (Ledger A).
- **UI4 CLOSED: `GUI/EnableInventoryInfoPanel`** (DaggerfallInventory
  Window :303-307). Setup only ADDS the panel when it is on; the port
  drew it unconditionally, which ships-True made invisible. Gated, with
  the cutout and the label both inside the gate. The TRADE window's own
  panel (:217-223) does not exist in the port yet and its pin fails the
  day it appears.
- **UI5 SCOPED, NOT STARTED: `GUI/EnableEnhancedItemLists`**
  (ItemListScroller :195-210). Read from source so the next session
  does not have to: enhanced replaces the FOUR 50x38 cells with SIXTEEN
  25x19 ones - `listDisplayUnits` 8, `listWidth` 2,
  `itemButtonRects16`, `itemButtonMargin` 1 (from 2), `textScale` 0.75
  (from 1). Its blast radius is bigger than the geometry:
  - the port's `itemScroller.js` publishes the classic numbers as
    MODULE CONSTANTS (`LIST_SLOTS`, `CELL_X`, `CELL_W`, `SLOT_H`,
    `CELL_MARGIN`), and three windows import them - `nativeInventory`,
    `nativeTrade`, `itemMakerWindow` - for slicing, drawing AND hit
    testing. Enhanced needs a per-scroller layout object, not a
    constant, so this is a small refactor before it is a feature.
  - only some scrollers take it. DFU builds enhanced scrollers in the
    INVENTORY window (both lists) and the ITEM MAKER; the POTION MAKER
    uses the explicit-geometry constructor (4x3 and 4x2) and is never
    enhanced, and the TRADE window has no ItemListScroller at all.
  - the ITEM MAKER additionally covers two background seams with
    panels when enhanced (:385-387), because the 16-cell list exposes
    parts of the base art the 4-cell one hid.
  It is a proper slice, not a gate.

  **STARTED AND PARKED (2026-08-31), with three findings worth more
  than the code was:**
  1. **It ships TRUE.** `EnableEnhancedItemLists` is `"True"` in the
     shipped ini, so the 16-cell grid is DFU's DEFAULT and the port has
     been showing the classic 4-cell list all along. UI5 is a PARITY
     FIX, not an optional extra.
  2. **The scrollbar counts ROWS, not items.** `TotalUnits =
     (items.Count + listWidth - 1) / listWidth` (:412) and the index is
     converted with `scrollIndex *= listWidth` (:416) just before the
     cells fill. An item-indexed scroll is right at one column and
     wrong at two.
  3. **`itemCutoutRects16` is a whole feature, not a detail** (:73-83,
     :516-523). In enhanced mode every cell gets a BACKGROUND cut from
     **INVE00I0.IMG** - not the window's own ITEM00I0 - because the base
     art has no 16-cell grid drawn on it. Sixteen entries, not a grid
     walk, and the last four repeat earlier rects.

  The first cut of this slice was built from the CONSTRUCTOR's five
  assignments without reading the class body: it derived cell rects
  arithmetically instead of using `itemButtonRects16`, used an
  item-indexed scroll, and missed the cell backgrounds entirely. Mac
  caught it. The code was reverted rather than committed half-built;
  these three findings are the part worth keeping.
- **UI6 CLOSED: `GUI/EnableModernConversationStyleInTalkWindow`**
  (DaggerfallTalkWindow :53-60 and the three label arms). Smaller text
  (0.8), a narrower wrap (0.75 of the panel) and a per-speaker
  background block behind each line. Found while building it:
  `shadowText` had no `scale` option, so the first cut passed one that
  would have been silently ignored - it takes a real one now, with the
  shadow offset staying one native pixel because DFU's ShadowPosition
  is in the label's own space.

With UI6 the six UI-only keys are DONE: UI3 and UI4 closed, UI6 closed,
DimAlphaStrength refuted, HideLoginName not applicable, and UI5
(`EnableEnhancedItemLists`) scoped above as the one real slice left.

### Refuted on the way

- **LycanthropyEffect's `Mathf.RoundToInt(urgeDuration * 24f/1440)`
  vs the port's `Math.round`** - raised because Unity's RoundToInt is
  half-to-even and JS's is half-up. Refuted: `24f/1440f` is
  `0.016666668` in float32, so every product that lands on `.5` in
  float64 lands a hair ABOVE it in float32 and rounds up on both
  sides; the tie never occurs. Not a finding.
- **VampirismEffect** - the +20 on seven stats with the Anthotis
  Intelligence, the +30 on six skills, silver always, the `<=`
  satiation, the 20% bark by gender: all verified equal.
- **EnemySenses.GetTargets** (`enemyTargets.js`) - the three-arm ally
  chain, the static-vs-live team reads (:776 `MobileEnemy.Team`,
  :784/:792 `Team`, :801 `MobileEnemy.Team`), the quest-foe gates: all
  verified equal.
- **The four-hosts diff over the foe stacks** - `exteriorFoes.js`
  imports every combat law `dungeonContext` calls (disease-on-hit,
  soul trap, poison, blood, voices, loot); the one-sided names are
  host-level (automap, rest, save, chargen) or exterior-only
  (corpse markers). No gap.
