# AUDIT 28 - THE POST-26 SWEEP (2026-08-30, in progress)

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
(`FadeInProgress`, the parent's alpha > 0.9) and this HUD has no fade
to read; they answer false, recorded. One equivalence proven rather
than pinned: the `condition != Wounded` guard on the gain arm is
overwritten by the Wounded arm every frame in DFU as here. 6 pins;
6 mutants, 5 killed + 1 equivalent.

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
