```json
[
  {
    "id": "HP-1",
    "lens": "hosts-parity",
    "title": "MAC1's pause-door `relock` reached two of six pause flows: the fixed-city host and BOTH dungeon hosts still need two clicks to resume",
    "severity": "medium",
    "files": [
      "src/scenes/world.js",
      "src/scenes/worldModes.js",
      "src/scenes/exterior.js",
      "src/scenes/dungeonContext.js",
      "src/ui/pauseDoor.js",
      "test/mac1_playreport.test.js"
    ],
    "claim": "MAC1 item J made the pause screen relock the pointer inside the resume gesture by way of a `hooks.relock` the commit message says 'every host hands it'. The hook was wired into world.js's exterior pause flow and into world.js's `createWorldModes` host bag (which worldModes forwards as `relock: host.relock`). It was NOT wired into (a) exterior.js's own `hudCtx.togglePause`, (b) exterior.js's `createWorldModes` host bag — so worldModes' `relock: host.relock` resolves to `undefined` in the ?exterior host's interior pause — or (c) dungeonContext.js's `togglePause`, which is the pause door for BOTH dungeon hosts (dungeon.js standalone AND worldModes' dungeon mode, which is where the classic start into Privateer's Hold lives). In those four flows `hooks.relock?.()` is a no-op and MAC1's bug is unchanged: the first click after Resume/Escape is spent re-grabbing pointer lock (and takes SetClickDelay with it), the second reaches the world.",
    "evidence": {
      "present_world_exterior_arm": "src/scenes/world.js:4816 — `relock: () => requestLook(canvas),   // MAC1: the pointer comes back with the resume gesture (ui/pauseDoor.js)` (inside `togglePause` at :4806)",
      "present_world_modes_bag": "src/scenes/world.js:6721 — `relock: () => requestLook(canvas),   // MAC1: the interior arm's pause door relocks through this host's canvas` (inside `createWorldModes({...})` at :6488)",
      "present_worldmodes_forward": "src/scenes/worldModes.js:6824 — `relock: host.relock,   // MAC1: the resume gesture relocks the pointer (ui/pauseDoor.js)` (inside `interiorKeyCtx.togglePause` at :6808)",
      "absent_exterior_own_pause": "src/scenes/exterior.js:2166-2192 — `togglePause: (opts = {}) => { ... openPauseFlow((w) => townTalk.showOverlay(w), { at, openPack, openSpellbook, openChronicle, savingPrevented, exitToMenu, textLines, questMessages, questLog }); }` — no `relock` key. (exterior.js:2378/:2449 do use `requestLook(canvas)`, so the host has the canvas and the same next-frame relock problem.)",
      "absent_exterior_modes_bag": "src/scenes/exterior.js:2910-3120 — the `createWorldModes({...})` bag carries canvas/renderer/player/cam/keys/.../buildingDataForDoor and no `relock`, so worldModes.js:6824's `host.relock` is undefined in this host",
      "absent_dungeon_context": "src/scenes/dungeonContext.js:4336-4396 — `togglePause(setPlayerPos = null, opts = {}) { ... openPauseFlow((w) => { activeOverlay = w; }, { at, openPack, openSpellbook, openChronicle, questMessages, questLog, quickSave, quickLoad, playerName, saveAs, loadKey, pushWindow, exitToMenu, textLines }); }` — no `relock`",
      "reachability_of_the_dungeon_flow": "src/scenes/world.js:4928 gates the world host's own key ladder on `(modes?.mode ?? 'exterior') === 'exterior'`, so Escape below ground falls to src/scenes/worldModes.js:7027 `routeKey(e, dungeonCtx, ...)` -> src/ui/input.js:524 `case 'Escape': return ctx.togglePause ? (ctx.togglePause(setPlayerPos), true) : false` -> dungeonContext.togglePause. The most-played pause door is the un-wired one.",
      "consumer": "src/ui/pauseDoor.js:165 — `if (action !== 'exit') hooks.relock?.();` (the header at :155-164 states the whole law)",
      "pin_that_claims_four_and_checks_two": "test/mac1_playreport.test.js:247 — test name: 'MAC1 J: the pause door relocks the pointer inside the resume gesture, and every host hands it the canvas'; its host assertions are only :252 (world.js exterior arm), :253 (world.js modes bag) and :254 (worldModes forward). exterior.js and dungeonContext.js are never asserted.",
      "csharp_owner": "No C# clause — this is a browser transient-activation law the port owns; the DFU anchors are DaggerfallPauseOptionsWindow.cs:302/:308 (the window this door replaces) and PlayerMouseLook.cursorActive, both scene-agnostic in DFU, which is why the port's own `hooks.relock` is host-supplied."
    },
    "proposedFix": "Add `relock: () => requestLook(canvas),` to (1) exterior.js's `hudCtx.togglePause` hooks bag beside `savingPrevented`, (2) exterior.js's `createWorldModes({...})` host bag beside `magic`/`townTalk` (so worldModes.js:6824's forward resolves), and (3) dungeonContext.js's `togglePause` hooks bag beside `quickSave` — dungeonContext already holds `canvas` and imports nothing new is needed if it reuses the host's look-request seam (dungeon.js:339 / worldModes' canvas both call `requestLook(canvas)`; dungeonContext should take a `relock` dep from `opts` so each dungeon host hands its own canvas, matching how `hudMessageSink` is threaded).",
    "pinShape": "Extend test/mac1_playreport.test.js:247 so its four-hosts claim bites: assert the `relock:` line in each of the four remaining pause-hook literals by source regex AND, better than a regex, build the hooks bag from each host's real composer in a headless harness and assert `typeof hooks.relock === 'function'` for all six flows (world exterior, world interior, exterior exterior, exterior interior, dungeon standalone, world-hosted dungeon). Mutation check: deleting any one `relock:` line must redden."
  },
  {
    "id": "HP-2",
    "lens": "hosts-parity",
    "title": "AUDIT 63 F33's pickpocket MessageBox in the world-hosted DUNGEON is mounted into the interior slot, which the dungeon frame never draws, ticks, keys or clicks",
    "severity": "high",
    "files": [
      "src/scenes/worldModes.js",
      "src/scenes/dungeon.js",
      "src/scenes/dungeonContext.js",
      "src/scenes/world.js",
      "src/scenes/exterior.js"
    ],
    "claim": "The delta added `tryMobileEnemyActivate` to all five activation ladders (AUDIT 63 F33). Four of them hand the `modal:` sink a window door their own frame owns. The DUNGEON arm of worldModes hands it `mountInterior`, the INTERIOR slot's door — the one door this file's own header calls 'a slot no frame draws' outside interior mode. worldModes' `frame()` returns at :5724 for the dungeon arm, before the `interiorOverlay` tick/draw block at :6038; the key dispatch is gated `if (mode === 'interior')` at :7022; the pointer seam returns `if (mode !== 'interior' || !interiorOverlay)` at :7081; and `overlayHeld` (:5355-5357) and `modeHudCovered` (:1029) both omit the interior slot in dungeon mode. So a SUCCESSFUL pickpocket in a world-hosted dungeon (the classic-start context) awards the gold and then: (a) the 'You pinched N gold pieces.' / 8999 box is never seen; (b) an ActionTextBox — which has no timer, only `input()`/`click()` — is pushed onto `interiorWindows` and orphans there; (c) `interiorOverlay` stays truthy for the rest of the session, so `mountSpellWindow` refuses (`if (interiorOverlay) return false`, :1062) and `interiorKeyCtx.uiOverlayActive` reads true; (d) the orphan surfaces on the next building entry, exactly the failure worldModes.js:7069-7073 already records for the pre-fix exterior case. This is the only dungeon-mode-reachable `mountInterior` call in the file; every other one is behind an interior-mode gate or on `interiorKeyCtx` (which routeKey reaches only in interior mode).",
    "evidence": {
      "the_added_clause_dungeon_arm": "src/scenes/worldModes.js:5107-5115 — `const _enemyArm = (reach, nearerThan = Infinity) => (dungeonCtx ? tryMobileEnemyActivate(eye, dir, dungeonCtx.foes, dungeonCtx.collider, reach, getInteractionMode(), playerEntity, { nearerThan, hud: (t) => say(t), modal: (t) => mountInterior(new ActionTextBox(String(t).split('\\n'))), ... })` — line :5111 is the modal sink",
      "sibling_standalone_dungeon": "src/scenes/dungeon.js:233 — `modal: (t) => ctx.hudBox?.(String(t).split('\\n')),` -> src/scenes/dungeonContext.js:4274 `hudBox: (rows) => pushDungeonWindow(new ActionTextBox(rows)),   // AUDIT 63 F33: DaggerfallUI.MessageBox, for the enemy arm's success boxes` — the dungeon's OWN window stack",
      "sibling_interior_arm_correct": "src/scenes/worldModes.js:4630 — `modal: (t) => mountInterior(new ActionTextBox(String(t).split('\\n'))),` (correct: this ladder only runs in interior mode)",
      "sibling_exterior_hosts": "src/scenes/world.js:7448 and src/scenes/exterior.js:3800 — `modal: (t) => townTalk.showOverlay(new ActionTextBox(String(t).split('\\n'))),` — the slot both outdoor hosts draw",
      "never_drawn_in_dungeon_mode": "src/scenes/worldModes.js:5724 — `return true;` closes the dungeon arm of `frame()` (opened :5239); the only `interiorOverlay` tick/drain/draw is at :6038-6076 (`const w = interiorOverlay; w.tick?.(dt); ... interiorOverlay.draw(...)`), below that return",
      "never_keyed_in_dungeon_mode": "src/scenes/worldModes.js:7022-7028 — `if (mode === 'interior') { if (routeKey(e, interiorKeyCtx, null, keys)) e.preventDefault(); return; } ... if (routeKey(e, dungeonCtx, ...))` — dungeonCtx's overlayInput reads its OWN slot",
      "never_clicked_in_dungeon_mode": "src/scenes/worldModes.js:7081 — `if (mode !== 'interior' || !interiorOverlay) return false;` (the pointer seam)",
      "never_pauses_or_covers_hud": "src/scenes/worldModes.js:5355-5357 — `const overlayHeld = !!townTalk?.overlayActive || (mode === 'interior' && interiorPaused()) || (mode === 'dungeon' && !!dungeonCtx?.uiOverlayActive);` and :1029 `const modeHudCovered = () => (mode === 'interior' && ...) || (mode === 'dungeon' && !!dungeonCtx?.hudCovered);`",
      "the_box_has_no_timer": "src/ui/actionText.js:48-84 — `ActionTextBox` sets `this.done` only in `input()` / `click()`; there is no tick-based expiry",
      "the_right_door_already_exists": "src/scenes/worldModes.js:1112-1118 — `function mountServiceWindow(win) { if (mode === 'dungeon') { dungeonCtx?.showOverlay?.(win); return win; } if (mode === 'interior') { interiorOverlay = win; return win; } townTalk?.showOverlay?.(win); return win; }` (and `mountSpellWindow` at :1059 has the same three arms)",
      "the_file_already_records_this_exact_shape": "src/scenes/worldModes.js:7069-7073 — '...without the gate every panel click above ground reached interiorKeyCtx and mounted a window into `interiorOverlay` - a slot the frame never draws and the keydown arm never feeds. The orphan then sat there until the player walked through a door.'",
      "csharp_owner": "PlayerActivate.cs:1640 `DaggerfallUI.MessageBox(gotGold);` and :1646 `DaggerfallUI.MessageBox(noGoldFound, true);` inside `Pickpocket()` (:1611), reached from ActivateMobileEnemy's steal arm (:830-838). DaggerfallUI.MessageBox builds the box on `Instance.uiManager.TopWindow` (DaggerfallUI.cs:1330/:1339/:1348/:1357), i.e. the CURRENT scene's own window stack — which underground is the dungeon's, never a building's."
    },
    "proposedFix": "In src/scenes/worldModes.js:5111 replace `mountInterior(...)` with the mode-general door: `modal: (t) => mountServiceWindow(new ActionTextBox(String(t).split('\\n'))),` — in dungeon mode that routes to `dungeonCtx.showOverlay`, which is the same stack dungeon.js reaches through `ctx.hudBox`. (Do not change the interior arm at :4630; `mountServiceWindow`'s interior arm is the same slot.)",
    "pinShape": "A test that drives worldModes into dungeon mode with a stub dungeonCtx, calls the dungeon activate ladder against a class enemy in steal mode with a forced-success roll, and asserts (a) `dungeonCtx.showOverlay` was called with an ActionTextBox carrying the pinched-gold row and (b) the interior slot is still empty (`__shopOverlay()` / `interiorOverlay` null). Mutation check: putting `mountInterior` back must redden BOTH assertions. Add the standing structural pin too: assert no `mountInterior(` appears inside the `mode === 'dungeon'` activate ladder, since the slot-vs-mode rule is what keeps recurring."
  },
  {
    "id": "HP-3",
    "lens": "hosts-parity",
    "title": "The same dungeon arm sends AUDIT 63 F33's PopupMessage lines to townTalk's HUD queue instead of the dungeon's, so two PopupText columns overprint underground",
    "severity": "low",
    "files": [
      "src/scenes/worldModes.js",
      "src/scenes/dungeon.js",
      "src/scenes/dungeonContext.js"
    ],
    "claim": "The `hud:` half of the same delta-added `_enemyArm` in worldModes' dungeon ladder is `hud: (t) => say(t)`, i.e. `townTalk.say` — the OUTDOOR host's PopupText queue. Every other HUD line in a world-hosted dungeon goes through `dungeonCtx.hudSay` -> dungeonContext's `hudText`, which is what dungeon.js's sibling clause uses. Both queues are drawn on a dungeon frame (dungeonContext's inside `drawFoes`, src/scenes/dungeonContext.js:4152; townTalk's from the outer host after `modes.frame` returns true, src/scenes/world.js:8335 via :7131 and src/scenes/exterior.js:3567), and both anchor at the same native rows — so the 'You see a <foe>' line and the 'You are not successful.' line stack on a second, independent seven-row column over the dungeon's own. DFU has exactly one PopupText per HUD. worldModes.js:5110 is the only `say()` reachable from dungeon-mode code in the file, so this queue split is new with the delta.",
    "evidence": {
      "the_added_clause": "src/scenes/worldModes.js:5110 — `hud: (t) => say(t),` inside the DUNGEON `_enemyArm` (:5107); `say` is defined at :360 as `const say = (l, delay) => { if (townTalk?.say) townTalk.say(l, delay); else console.warn('[interior]', l); };`",
      "sibling_standalone_dungeon": "src/scenes/dungeon.js:232 — `hud: (t) => ctx.hudSay?.(t),` -> src/scenes/dungeonContext.js:4273 `hudSay: (t) => hudText.add(t),   // R1: the host's one-line channel (the F1-F4 mode line)`",
      "sibling_interior_arm_correct": "src/scenes/worldModes.js:4629 — `hud: (t) => say(t),` (correct: in interior mode townTalk's queue IS the host's queue — it is ticked and drawn at :6035 `townTalk?.hudFrame?.(dt, _shopFont)`)",
      "both_queues_paint_underground": "src/scenes/dungeonContext.js:4152 `if (hudFont && hudRenderEnabled()) hudText.draw(renderer, canvas, hudFont, hudScaleFor(...));` (inside drawFoes, called from worldModes.js:5718) and src/scenes/world.js:7131 `townTalk.frame(dt);` (run after `modes.frame(dt, now)` returns true, :7110)",
      "only_say_in_the_dungeon_path": "grep of `say(`/`hudSay` over src/scenes/worldModes.js:5080-5240 returns exactly one hit: :5110",
      "csharp_owner": "PlayerActivate.cs:814-826 (the Info/Grab/Talk line) and :1651 `DaggerfallUI.Instance.PopupMessage(notSuccessfulMessage);` — PopupMessage is `dfHUD.PopupText.AddText`, a single per-HUD queue (PopupText.cs:123), never a second column."
    },
    "proposedFix": "Change src/scenes/worldModes.js:5110 to route through the dungeon's own channel, mirroring dungeon.js: `hud: (t) => dungeonCtx?.hudSay?.(t) ?? say(t),` (or make it unconditional `dungeonCtx.hudSay(t)`, since the arm already short-circuits on a null `dungeonCtx`). Leave the interior arm at :4629 alone.",
    "pinShape": "In the same dungeon-mode harness as HP-2, run the enemy arm in Info mode against a live foe and assert the line landed on `dungeonCtx.hudSay` and NOT on the townTalk stub's `say`. Mutation check: reverting to `say(t)` must redden. Pair it with a structural assertion that both halves of the dungeon `_enemyArm` name `dungeonCtx` sinks, so the sink family cannot drift again."
  }
]
```

```json
{
  "coverage": {
    "read": [
      "bible/Home.md (lines 1-130, the doc laws incl. THE FOUR HOSTS RULE, THE MODAL CONTRACT, THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD)",
      "bible/01-Overview/Audit-65.md (the stub / the question)",
      "bible/01-Overview/Audit-64.md:300-380 ('What was left, and by whose decision' — F5, F0, F13's standalone-dungeon flag, the two F25 drops)",
      "git log 0fe2c05b..HEAD (84 commits) and git diff --stat 0fe2c05b..HEAD -- src/scenes (21 files, +3877/-725)",
      "Full diffs: src/scenes/interior.js, src/scenes/dungeon.js, src/scenes/interiorContext.js, src/scenes/hostMagic.js, src/scenes/hostCombat.js, src/scenes/questFoeHost.js, src/scenes/cityGuards.js, src/scenes/arrestFlow.js, src/scenes/questBridge.js, src/scenes/townTalk.js, src/scenes/shared.js",
      "Added-line extracts + hunk headers for src/scenes/world.js, src/scenes/exterior.js, src/scenes/worldModes.js, src/scenes/dungeonContext.js",
      "Read in place: world.js:2810-2845, 3045-3065, 4790-4835, 4870-5010, 6488-6800, 7008-7140, 7205-7250, 7443-7453; exterior.js:1493-1510, 2166-2215, 2575-2600, 2910-3230, 3093-3125, 3595-3625; worldModes.js:1040-1130, 4636-4700, 5107-5117, 5239-5300, 5350-5365, 5410-5560, 5700-5730, 6030-6082, 6118-6180, 6620-6660, 6780-6800, 6800-6845, 7010-7100; dungeonContext.js:2105-2140, 3385-3415, 4095-4160, 4320-4398; dungeon.js:221-260, 282-292, 425-442, 582-600, 660-790, 900-910",
      "src/ui/pauseDoor.js:140-175, src/ui/hudShortcuts.js:1-82, src/ui/hud.js:490-600, src/ui/midScreenText.js:1-60, src/ui/actionText.js:48-108, src/ui/input.js:425-470, :524-540, src/ui/windowStack.js (via call sites)",
      "src/player/mobileEnemyActivate.js:60-125, src/player/activate.js:118-140, src/player/motor.js:295-345/:508-520/:960-990, src/world/actionSystem.js:546-612/:885-912, src/systems/talk.js:325-350, src/systems/combatVisuals.js:50-125, src/scenes/hostCombat.js:566-575",
      "test/mac1_playreport.test.js:247-256, test/audit64_hud.test.js:488-505",
      "DFU: PlayerActivate.cs:326-339/:800-841/:1424/:1611-1660, DaggerfallUI.cs:783-789, DaggerfallHUD.cs:295-326/:347-371, SerializablePlayer.cs:190/:404, grep of SetMidScreenText/playerTeleportedIntoDungeon across tools/parity/dfu/Assets/Scripts",
      "Cross-host greps for: setMidScreenText, isEnhancedJumping, tryMobileEnemyActivate, pickActivatableHit, isSwingButton, swingHeld, keyboardLook/keyboardLookRate, onExteriorWater/exteriorSwimming, toggleAutorun, player.standing, player.height/2, runningTally, playerCrouching, hudShortcutKey, hudRenderEnabled, recastSpell/abortSpell, npcTargets, hudMessageSink, midScreenText, relock/requestLook, togglePause/openPauseFlow, questBuildingSource, giveItemToPlayer, suppressTalk, notebookSink, undiscoverBuilding, reviveQuestBehaviour, farFlatVisible, objectAabb/hasActionCollision, isActionDoor/openDoorsStep, combatVisualsOn/foeDraw, areEnemiesNearby, preloadMessageBoxArt, getPref, eyeAt, drawHud, hover"
    ],
    "notFound": [
      "No parity gap in AUDIT 64 F36/F37 (hudShortcutKey): src/ui/input.js:441 carries it inside routeKey, which dungeon.js and BOTH worldModes arms route through; world.js:4948 and exterior.js:2334 carry it themselves because they never call routeKey. test/audit64_hud.test.js:490 enumerates exactly that split.",
      "No parity gap in AUDIT 64 F34's mode line: world.js and exterior.js reach it through townTalk.js:323 `setMode` (their keydown calls `townTalk.keydown(e)` first, world.js:4882 / exterior.js:2271, and that ladder is NOT mode-gated), dungeon.js:287 has its own call, and `midScreen` defaults to `setMidScreenText` inside src/player/mobileEnemyActivate.js:93 so no host can drop the too-far refusal.",
      "No parity gap in AUDIT 64 F0/F1/F2/F3/F4/F7, ROAD-H H1b/H1c/H2/tail, OT1's exteriorSwimming, MAC1's render-eye and standing-still term: all present in every host that owns a PlayerMotor (world.js, exterior.js, worldModes' two arms, dungeon.js). interior.js owns no motor (no `PlayerMotor`, no `player.` reads at all), so it is correctly untouched.",
      "MAC1's far-flat rule (world/flatDistance.js) is world.js-only and correctly so — the commit scopes it to 'the streaming host's flat walk'; exterior.js has no pixel rings, and everything in a fixed city sits in the two nearest rings where `farFlatVisible` is unconditionally true.",
      "exterior.js's missing questBuildingSource, giveItemToPlayer, suppressTalk, npcSession/talkSave/onQuestRestored, quickSave/quickLoad/playerName/saveAs/loadKey and capturePendingScreenshot are all covered by that host's own recorded charter (exterior.js:2575-2597 'what is deliberately absent here, and why'; :1678 'this dev host has no save path'; :2215 'isBuildingQuestResource ... needs a topic tree, and this route runs no rumor mill or topic tree at all'). `relock` is not on that list and is not a save door — hence HP-1.",
      "The standalone dungeon's absent `person:` activation target is Audit-64.md:334's named flag (F13), unchanged by the delta.",
      "`actions.onLockedDoor` being wired only in dungeonContext.js:1363 is NOT a live gap: interiorContext.js:415 mints its doors with `addDoor(cpu, matrix)` and no `startingLockValue`, so `currentLockValue` is 0 (actionSystem.js:579-580) and the LookAtInteriorLock branch (actionSystem.js:902-904) is unreachable in a building. Also pre-existing, not delta.",
      "The dungeon-only action-collision walk (dungeonContext.js:3397-3410, AUDIT 63 F38/F45) has no interior twin to be out of step with — interiors run no collision-trigger pass at all (COLLISION_TIMEOUT_S has one consumer). Pre-existing scope, not a delta divergence.",
      "ECV1 reaches every foe pool: exteriorFoes.js, cityGuards.js and dungeonContext.js each import combatVisualsOn/foeDraw/markConcealedHit, and worldModes' interior pools are built from those same two modules (worldModes.js:736 `createExteriorFoes`, :909 `createCityGuards`).",
      "hostMagic's ROAD-H H2 `playerHeight` reaches all four cast engines: world.js:8198, exterior.js:4311, worldModes.js:5897, dungeonContext.js:3708 all pass `player.height`.",
      "I did not exercise anything in a browser; HP-2 and HP-3 are read from the frame's control flow and the mode gates, not observed."
    ]
  }
}
```