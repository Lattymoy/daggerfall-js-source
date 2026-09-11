```json
[
  {
    "id": "MC-1",
    "lens": "missing-caller",
    "title": "The fixed-city host never feeds `townTalk.hudMessageSink`, so AUDIT 64 F34's new `midScreenText.onMessage` tail — and PopupText's — have no sink there and the Notebook's Messages page is permanently empty",
    "severity": "medium",
    "files": [
      "src/scenes/exterior.js",
      "src/scenes/world.js",
      "src/scenes/townTalk.js",
      "src/ui/midScreenText.js",
      "src/ui/hudText.js"
    ],
    "claim": "The delta widened townTalk's `hudMessageSink` setter to arm BOTH HUD text surfaces — `set hudMessageSink(fn) { hud.onMessage = fn; midScreenText.onMessage = fn; }` (townTalk.js:1246, AUDIT 64 F34) — because DFU carries the same `Notebook.AddMessage` tail on PopupText.AddText and on SetMidScreenText. Only `src/scenes/world.js:6438` ever calls that setter. `src/scenes/exterior.js` builds its own townTalk (:971) and, in the very block where the AUDIT 63 F5 lane added the sibling sink (`townTalk.notebookSink = ...` at :2896, whose comment even points at \"world.js:6422's line for this host\"), it never assigns `hudMessageSink`. So on the ?exterior route `hud.onMessage` and `midScreenText.onMessage` both stay null: every HUD line the host says and every mid-screen label it sets is dropped from the player's message ring. This is not an inert seam on that route — exterior.js:1094 wires `notebook: () => questBridge.notebook ?? null` into the quest journal, so the Messages page (questJournal.js:236 `nb?.getMessages()`) is reachable and permanently empty. It is a four-hosts miss of the delta's own new law: worldModes feeds it at :4937 and dungeonContext at :1349/:1354; the second walkable outdoor host does not.",
    "evidence": "src/scenes/townTalk.js:1246 `set hudMessageSink(fn) { hud.onMessage = fn; midScreenText.onMessage = fn; },   // AUDIT 64 F34: SetMidScreenText carries the SAME Notebook.AddMessage tail (DaggerfallHUD.cs:371)`  |  src/scenes/world.js:6438 `townTalk.hudMessageSink = (t) => questBridge?.notebook?.addMessage(t);`  |  src/scenes/exterior.js:2896 `townTalk.notebookSink = (tokens) => questBridge?.notebook?.addNoteTokens(tokens);` — the only sink handed down in that block; `grep -n 'hudMessageSink' src/scenes/exterior.js` returns nothing  |  src/ui/midScreenText.js:56 `this.onMessage = null;` and :98 `this.onMessage?.(message);`  |  src/ui/hudText.js:43/:53 the same pair  |  src/scenes/exterior.js:1094 `notebook: () => questBridge.notebook ?? null,`. DFU: `Game/UserInterfaceWindows/DaggerfallHUD.cs:371` `GameManager.Instance.PlayerEntity.Notebook.AddMessage(message);` inside `SetMidScreenText` (:353-372), and `Game/UserInterface/PopupText.cs:123` `GameManager.Instance.PlayerEntity.Notebook.AddMessage(pgText);` inside `AddText`. Both read the Notebook off `GameManager.Instance.PlayerEntity`, a global — there is no host in DFU that can fail to file a message.",
    "proposedFix": "Add the missing line beside exterior.js:2896, in the same post-questBridge block: `townTalk.hudMessageSink = (t) => questBridge?.notebook?.addMessage(t);`. No other change: the setter already arms both surfaces.",
    "pinShape": "Two halves. (a) Behavioural, over the seam: build a townTalk double (or call the real `createTownTalk` with stub deps), assign `hudMessageSink` to a spy, call `setMidScreenText('x')` and `townTalk.say('y')`, and assert the spy saw both — this reddens if the setter drops either arm. (b) Host wiring, the half a mutant actually reverts: read both `src/scenes/world.js` and `src/scenes/exterior.js` and assert EACH contains an assignment to `townTalk.hudMessageSink` (naming the file in the assertion message). Deleting the new exterior line turns (b) red; today (b) is red before the fix, which is the point."
  },
  {
    "id": "MC-2",
    "lens": "missing-caller",
    "title": "`setMidScreenText` was ported with eleven DFU too-far callers named in its header and five wired; the other six are silent because `pickActivatableHit` drops the target instead of speaking the refusal",
    "severity": "medium",
    "files": [
      "src/ui/midScreenText.js",
      "src/player/activate.js",
      "src/scenes/dungeon.js",
      "src/scenes/worldModes.js",
      "src/scenes/world.js",
      "src/scenes/exterior.js"
    ],
    "claim": "The delta's new `src/ui/midScreenText.js` header enumerates its DFU callers, including \"the eleven `youAreTooFarAway` refusals (:330/:503/:688/:711/:763/:780/:790/:834/:852/:872/:940)\". Grepping the tree, only FIVE of those eleven have a port site: the bulletin board (worldModes.js:2131 = :711), the static/mobile NPC arms (townTalk.js:612/:619/:630 = :763/:780/:790) and the mobile enemy pickpocket (mobileEnemyActivate.js:109 = :834). The remaining six — the quest-resource click (:330), the static door (:503), the action door (:688), ladders and shelves (:852), the loot container (:872) and the corpse (:940) — have no port caller at all, and they cannot be reached: `pickActivatableHit` drops every target beyond its own reach (`activate.js:246 if (d > (target.distance ?? DEFAULT_ACTIVATION_DISTANCE)) continue;`), so the ladders in dungeon.js:240, worldModes.js and both exterior hosts never see the hit DFU refuses out loud. DFU rays to `RayDistance` (76.8 units, PlayerActivate.cs:76) and gates INSIDE each handler; the port pre-gates the pick at 3.2/3.75 and answers with silence. The tree has already recorded this exact failure once and fixed it for one family — townTalk.js:605-610: \"the ray itself reaches RayDistance (76.8); each MODE's distance gates inside with the 'youAreTooFarAway' line... The old 6.4 pre-gate answered a person down a long street with SILENCE\" — and AUDIT 63 F33 built the near/far double-call pattern (`_enemyArm(reach, nearerThan)` then `_enemyArm(RAY_DISTANCE)`) for the foe arm. The six door/loot/ladder arms never got it.",
    "evidence": "src/ui/midScreenText.js:9-12 (the header's own caller list)  |  src/player/activate.js:239-247 `export function pickActivatableHit(eye, dir, targets, collider) { ... if (d > (target.distance ?? DEFAULT_ACTIVATION_DISTANCE)) continue;` — a target beyond reach is not returned, so no caller can speak  |  src/scenes/dungeon.js:238-253 the whole ladder: `const _pick = pickActivatableHit(...); ... if (key) ctx.actions.activate(key, ...); else _enemyArm(RAY_DISTANCE);` — the FAR call exists for foes only  |  `grep -rn 'TOO_FAR_AWAY_TEXT' src` returns exactly five speaking sites (worldModes.js:2131, townTalk.js:612/:619/:630, mobileEnemyActivate.js:109)  |  contrast src/scenes/townTalk.js:610 `if (!best || bestDist > RAY_DISTANCE) return false;` then :612 `setMidScreenText(TOO_FAR_AWAY_TEXT)`. DFU: `Game/PlayerActivate.cs:76` `const float RayDistance = 3072 * MeshReader.GlobalScale;`, :81-85 the 128/150-unit activation distances, and the six unported refusals at :330 (QuestResourceBehaviourCheck, `hit.distance > DefaultActivationDistance`), :503 (`StaticDoor` / `DoorActivationDistance`), :688 (`ActivateActionDoor`), :852 (`ActivateLaddersAndShelves`), :872 (`ActivateLootContainer`, `TreasureActivationDistance`), :940 (corpse, `CorpseActivationDistance`).",
    "proposedFix": "Give each activation ladder the far arm townTalk already has, once, in the shared helper rather than six times: add `pickActivatableHitFar(eye, dir, targets, collider)` beside `pickActivatableHit` in `src/player/activate.js` that picks at RAY_DISTANCE and returns `{key, distance, reach}`; where the near pick answers null, run the far pick and, when it hits a target whose `distance > reach`, call `setMidScreenText(TOO_FAR_AWAY_TEXT)` and consume the activation (DFU's `return`/`break`). Keep DFU's two exceptions verbatim: the corpse INFO arm speaks its `youSeeADead` line with no distance gate (:935-940), and the already-attempted mobile arm stays silent at any range (the F048 nesting).",
    "pinShape": "Behavioural, over the real helper: build a target list with `{ key: 'door:1', aabb, distance: DOOR_ACTIVATION_DISTANCE }` whose box sits 8 units down the ray (past 3.2, inside 76.8) and a null collider; assert the near pick answers null AND that the ladder arm calls a spy `midScreen` with `TOO_FAR_AWAY_TEXT` exactly once and consumes. Reverting the far arm (or restoring the pre-gate) makes the spy see zero calls and reddens it; a one-character mutation of the reach comparison flips consume/refuse and reddens it too."
  },
  {
    "id": "MC-3",
    "lens": "missing-caller",
    "title": "DS2's `dynamicMoonlight` has no caller anywhere — not in src, not in a test — while `shared.js` keeps the inline copy the helper was written to replace",
    "severity": "low",
    "files": [
      "src/render/dynamicSkiesBridge.js",
      "src/scenes/shared.js"
    ],
    "claim": "The delta's DS2 commit (`d2c35fe8`) created `src/render/dynamicSkiesBridge.js` as \"THE BRIDGE FROM THE MOD'S STATE TO THE PORT'S READERS ... One home\", and its last export is `dynamicMoonlight`, documented as \"The world's moon term off the mod's moons - DS1's moonlight()\". Nothing calls it. `grep -rn 'dynamicMoonlight' src test` returns only the declaration; the one site the helper names — `shared.js`'s `moonlight()` — still carries the identical expression inline. Its two siblings in the same file (`cloudsStateUnderMod`, `dynamicMoonState`) ARE imported by shared.js:18 on the line above, so this is not a module nobody reached: the lane wired two of three exports and left the third with its inline twin standing. Under the port's own ONE DFU MEMBER, ONE EXPORT rule (Home.md, 17e) that is the exact shape — a helper declared the one home while the sibling site keeps the literal.",
    "evidence": "src/render/dynamicSkiesBridge.js:60 `export const dynamicMoonlight = (moons) => (moons ? moonlightTerm(moons) : null);`  |  src/scenes/shared.js:441 `return dynamicMoons ? moonlightTerm(dynamicMoons) : null;` — byte-for-byte the helper's body, in the function the helper's doc names  |  src/scenes/shared.js:18 `import { cloudsStateUnderMod, dynamicMoonState } from '../render/dynamicSkiesBridge.js';` — the third export is not on the import list  |  `grep -rn 'dynamicMoonlight' src test --include=*.js` → one line. This is a port-side presentation helper, not a DFU member, so the cite is the port's own law rather than a C# one: Home.md's \"ONE DFU MEMBER, ONE EXPORT (17e) ... If two files legitimately need it, one exports and the other imports - never two literals.\"",
    "proposedFix": "One of two, not both: either add `dynamicMoonlight` to the shared.js:18 import and make :441 `return dynamicMoonlight(dynamicMoons);`, or delete the export (OT1 c's treatment of F301's eleven dead exports). Wiring is preferable — the helper's null-guard is the arm a future host will forget.",
    "pinShape": "Assert one home: read `src/scenes/shared.js` and assert `moonlightTerm(` appears exactly once in it (the enhanced-dome arm at :437) and that `dynamicMoonlight(` appears in the mod arm. Re-inlining the mod arm makes the count two and reddens it. Pair it with a behavioural pin on the helper itself (`dynamicMoonlight(null) === null`, and a non-null state returns the same object `moonlightTerm` gives) so the export is not merely name-checked."
  },
  {
    "id": "MC-4",
    "lens": "missing-caller",
    "title": "FIX-F's keyboard look is wired in three of the four look hosts; the standalone interior host — the one a previous slice was already caught missing — has the look filter and the keys set and no arm",
    "severity": "low",
    "files": [
      "src/scenes/interior.js",
      "src/scenes/world.js",
      "src/scenes/exterior.js",
      "src/scenes/dungeon.js",
      "src/ui/input.js",
      "src/ui/lookSettings.js"
    ],
    "claim": "The delta's FIX-F added `keyboardLook(keys)` (input.js:315) and `keyboardLookRate()` (lookSettings.js:48) — InputManager.FindKeyboardActions' TurnLeft/TurnRight/LookUp/LookDown arms, paid into the same LookFilter the mouse feeds. Three hosts take it: world.js:7031-7032, exterior.js:3469-3470, dungeon.js:592-593. `src/scenes/interior.js` does not, although it is a full look host by the port's own reckoning: it owns a `LookFilter` it ticks every frame, it feeds that filter from the pointer lock and from touch through `lookScale()/lookInvert()`, and it maintains a `keys` Set of `e.code` — exactly the two arguments the arm needs. The file even carries the scar: its import line reads `import { lookScale, lookInvert } from '../ui/lookSettings.js';   // AUDIT: the FOURTH host the SETT slice missed`. FIX-F repeated the miss in the same file, on the same seam, one slice later. Under THE FOUR HOSTS RULE this host is neither wired nor flagged by name in FIX-F's own record.",
    "evidence": "src/scenes/world.js:7031-7032 `const kb = keyboardLook(keys); if (kb.x || kb.y) lookFilter.add(kb.x * keyboardLookRate() * dt, kb.y * keyboardLookRate() * dt * lookInvert());` (identical at exterior.js:3469-3470 and dungeon.js:592-593)  |  src/scenes/interior.js:27 `import { lookScale, lookInvert } from '../ui/lookSettings.js';   // AUDIT: the FOURTH host the SETT slice missed` — no `keyboardLook`, no `keyboardLookRate`  |  src/scenes/interior.js:169 `const keys = new Set();`, :195 `keys.add(e.code);`, :256 `lookFilter.add(e.movementX * lookScale(), -e.movementY * lookScale() * lookInvert());`, :294 `lookFilter.tick(dt, cam);` — every dependency present, no consumer. DFU: `Game/InputManager.cs:1854-1865` sets `keyboardLookX/keyboardLookY` off the four Actions, and `UpdateLook` (:1510-1511) `lookX = (keyboardLookX == 0) ? mouseX : keyboardLookX;` hands them to PlayerMouseLook — one InputManager for the whole game, so no scene in DFU can lack the arm.",
    "proposedFix": "Extract the three-line arm the three hosts repeat into one exported helper — `applyKeyboardLook(lookFilter, keys, dt)` in `src/ui/lookSettings.js` (it already owns `keyboardLookRate` and `lookInvert`) — replace the three inline copies with a call, and add the same call to `interior.js`'s frame inside its existing `if (!gamePaused())` block, immediately after `lookFilter.tick(dt, cam)`.",
    "pinShape": "Behavioural on the helper: a fake LookFilter recording `add()` calls, a keys Set holding the default TurnRight code, `applyKeyboardLook(f, keys, 1/60)` — assert the yaw delta equals `keyboardLookRate() / 60` and that both keys held cancels to zero. Then the four-hosts half: read all four host files and assert each contains `applyKeyboardLook(`, with the file name in the assertion message. Removing the interior call, or reverting any host to its inline copy, reddens the second half; a one-character sign flip in the helper reddens the first."
  },
  {
    "id": "MC-5",
    "lens": "missing-caller",
    "title": "WATER1 exported `WATER_SCROLL_TILES_PER_SEC` and `WATER_OPACITY` naming the dungeon hosts as the shared source, and both dungeon hosts still carry their own literals — three copies of 0.05 and three of 0.82",
    "severity": "low",
    "files": [
      "src/render/waterSurface.js",
      "src/scenes/dungeon.js",
      "src/scenes/worldModes.js"
    ],
    "claim": "The delta's WATER1 lane added `export const WATER_SCROLL_TILES_PER_SEC = 0.05;` to `src/render/waterSurface.js` with a doc comment that names the other site as the origin — \"the dungeon water's own rate (scenes/dungeon.js), so a river and a dungeon pool crawl alike\" — and `export const WATER_OPACITY = 0.82;` beside it. Neither dungeon host imports either. `src/scenes/dungeon.js:71-72` declares its own `WATER_COLOR = [1, 1, 1, 0.82]` and `WATER_SCROLL_TILES_PER_SEC = 0.05` (the same identifier, locally shadowed), and `src/scenes/worldModes.js:250-251` declares a third pair under different names, `DUNGEON_WATER_COLOR` / `DUNGEON_WATER_SCROLL`. So the constant the new module claims as the one home has two sibling literals under three names, and the new export has no importer outside waterSurface.js's own uniform builder. This is the seam-bypass shape: the lane wrote the single source and adopted it nowhere, and the comment asserting agreement is the only thing holding the three numbers together.",
    "evidence": "src/render/waterSurface.js:64-66 `/** The classic texel's slow flow, in tiles per second - the dungeon water's own rate (scenes/dungeon.js), so a river and a dungeon pool crawl alike. */ export const WATER_SCROLL_TILES_PER_SEC = 0.05;` and :54 `export const WATER_OPACITY = 0.82;`  |  src/scenes/dungeon.js:71 `const WATER_COLOR = [1, 1, 1, 0.82];` :72 `const WATER_SCROLL_TILES_PER_SEC = 0.05;`  |  src/scenes/worldModes.js:250 `const DUNGEON_WATER_COLOR = [1, 1, 1, 0.82];` :251 `const DUNGEON_WATER_SCROLL = 0.05;`  |  the two draw sites that spend them: dungeon.js:905-907 and worldModes.js:5720-5722. Port law rather than a C# cite (this is presentation the port owns under Port-Doctrine): Home.md 17e, \"ONE DFU MEMBER, ONE EXPORT ... If two files legitimately need it, one exports and the other imports - never two literals.\"",
    "proposedFix": "Delete the local declarations at dungeon.js:71-72 and worldModes.js:250-251 and import `WATER_SCROLL_TILES_PER_SEC` and `WATER_OPACITY` from `../render/waterSurface.js`, building the colour as `[1, 1, 1, WATER_OPACITY]` at both sites (or export a `DUNGEON_WATER_COLOR` from waterSurface.js beside them, since both hosts want the same array).",
    "pinShape": "The import-shape pin the tree already uses for one-export laws: read `src/scenes/dungeon.js` and `src/scenes/worldModes.js` and assert neither contains a `const ...SCROLL... = 0.05` or a `[1, 1, 1, 0.82]` literal, and that each imports the names from `render/waterSurface.js`. Re-introducing either literal reddens it. Do NOT pin `assert.equal(WATER_SCROLL_TILES_PER_SEC, 0.05)` — that restates the port and survives the drift this finding is about."
  },
  {
    "id": "MC-6",
    "lens": "missing-caller",
    "title": "Two WATER1/WATER-AUDIT exports have no production caller: `tilemapHasWater` was superseded by its own rect twin and `waterCoverage` is a JS mirror of the shader that only its test reads",
    "severity": "low",
    "files": [
      "src/render/waterSurface.js",
      "src/scenes/world.js",
      "src/scenes/exterior.js"
    ],
    "claim": "`tilemapHasWater(bytes, table)` (waterSurface.js:115) — \"Does this tilemap (converted bytes) carry any water at all? A pixel without water never enters the pass\" — has zero references in `src/` outside its own declaration. The two hosts that were meant to ask it took other routes: the fixed city uses the WATER-AUDIT L1 replacement `tilemapRectHasWater` (exterior.js:678, because zero padding converts to water), and the streaming host asks implicitly by letting `buildWaterIndices` return null (world.js:838/:1359). `waterCoverage(mask, fx, fy)` (waterSurface.js:168) — \"The bilinear coverage the shader computes at (fx, fy) inside a tile\" — likewise has no production caller; its only reader is `test/water.test.js:67-71`, i.e. it is a CPU restatement of GLSL asserted against itself, which is the shape Home.md's A PIN MUST FAIL warns about. Neither was on OT1's F301 dead-export sweep, which ran over an older list and predates WATER1's landing.",
    "evidence": "src/render/waterSurface.js:113-118 `export function tilemapHasWater(bytes, table = WATER_MASK_TABLE) { for (let i = 0; i < bytes.length; i++) if (table[bytes[i]]) return true; return false; }` — `grep -rn 'tilemapHasWater' src --include=*.js` returns only this line  |  src/render/waterSurface.js:168 `export function waterCoverage(mask, fx, fy) {` — `grep -rn 'waterCoverage' src` returns only this line; `test/water.test.js:12,67-71` is its only reader  |  the routes that replaced it: src/scenes/exterior.js:677-678 `... && tilemapRectHasWater(tilemapBytes, tilemapDim, loc.width * GROUND_TILE_DIM, loc.height * GROUND_TILE_DIM);` and src/scenes/world.js:838 `const waterIndices = waterOn ? buildWaterIndices(tilemapBytes, stride) : null;` with waterSurface.js:161 `return out.length ? Uint32Array.from(out) : null;`.",
    "proposedFix": "Delete both exports (OT1 c's treatment: re-grep to zero callers first, then remove, and drop them from `test/water.test.js`'s import list). If `waterCoverage` is wanted as a shader oracle, keep it but make its test a real oracle rather than a mirror: assert it against framebuffer bytes read back from the water program at known tile fractions, the screen-projection ground-truth method Home.md prescribes.",
    "pinShape": "This is a deletion, so the pin is the sweep, not an assertion about the deleted body: extend the existing dead-export sweep (the F301/OT1 c style) to assert that every `export function`/`export const` in `src/render/waterSurface.js` is referenced by at least one non-test file under `src/`. Re-introducing an export with no caller reddens it; deleting a LIVE export reddens the callers' own suites."
  }
]
```

```json
{
  "coverage": {
    "read": [
      "bible/Home.md:1-130 (the doc laws: FOUR HOSTS, ONE DFU MEMBER ONE EXPORT, A PIN MUST FAIL, THE MODAL CONTRACT, TEST THE SHAPE THE PRODUCER MINTS)",
      "bible/01-Overview/Audit-63.md and Audit-64.md whole, including both 'What was refuted' and 'What was left, and by whose decision' sections",
      "bible/01-Overview/Audit-65.md (the stub), bible/07-Rendering/Water-Arc.md",
      "git log/diff 0fe2c05b..HEAD over src (83 commits, 199 files); mechanical sweep of all 292 export identifiers ADDED in the delta plus all 1,246 exports in delta-touched files, each grepped for callers outside its defining file and outside src/tools",
      "the four-hosts sweep over the delta's per-frame laws: holiday text, city gates, static buildings, far-flat culling, interior treasure, weather evolution, synthetic time, HUD shortcuts / renderHUD, hudCovered, keyboard look, exterior swim, mobile-enemy activation, mid-screen text, collision triggers",
      "hook/option sweep: every `hooks.X` added under src/ui in the delta, every `{ a = x } = {}` option added in the delta, every `deps./opts./ctx.` read added in the delta, each checked for a feeder",
      "field sweep: every `X.y =` property write added in the delta, checked for a reader (onExteriorWater, standing, playerTeleportedIntoDungeon, wabbajackActive, usingRightHand, mobileTeam, isComponentDestroyed, restOnlyTrigger, isOverrideName, cloudsExternal, pendingShift, primed, _insideSince)",
      "DFU reference on disk: PlayerActivate.cs (the six Hit Checks and all eleven youAreTooFarAway sites, RayDistance and the activation distances), DaggerfallHUD.cs:353-372, PopupText.cs:112-127, InputManager.cs:1505-1515/:1850-1866, DaggerfallBankingWindow.cs / DaggerfallCharacterSheetWindow.cs (CreateBankingStatusBox callers), StreamingWorld's reposition callers as enumerated in world/locationEntrance.js"
    ],
    "notFound": [
      "AUDIT 63 F33's ActivateMobileEnemy — all five activation ladders wired (world.js:7443, exterior.js:3796, worldModes.js:4626 and :5107, dungeon.js:229) and every dep (hud/modal/makeEnemiesHostile/playerFeet/nothingText/nearerThan) fed at each",
      "AUDIT 64 F34's mid-screen label draw path — drawHud is called by all four hosts (world.js:8314, exterior.js:4399, worldModes.js:6001, dungeonContext.js:4135) and midScreenText.tick/draw ride it; only the notebook SINK is unfed (MC-1)",
      "AUDIT 64 F36/F37's F10 / Shift-F10 — reaches all four hosts (world.js:4948 and exterior.js:2334 direct, worldModes.js and dungeon.js through ui/input.js:441's routeKey), and hudRenderEnabled is read by hud.js, dungeonContext.js and townTalk.js",
      "AUDIT 64 F35's hudCovered — computed and passed in all four hosts",
      "AUDIT 64 F14 city gates, F10 holiday text, F11 static buildings — both outdoor hosts build and tick; the interior/dungeon hosts are correctly out of scope",
      "AUDIT 63 F13 synthetic time — all three DFU raise sites have a port caller (arrestFlow.js:389 prison, world.js:3964/:3997 travel, shared.js:1637 vampirism), claimed once in worldTick.js:151 and read by the three enchantment arms",
      "AUDIT 63 F14 Soul Bound — enumerateFilledTraps reaches the item maker and the Enchanted payload reaches removeFilledTrap through enchanting.js:240 -> enchantments.js:525",
      "AUDIT 63 F5 copyToNotebook / notebookSink — fed by BOTH outdoor hosts (world.js:6443, exterior.js:2896)",
      "AUDIT 64 F41 video mute — music.setMuted and muteAmbientForVideo both called on the open and on all three close paths",
      "AUDIT 64 audio's PARRY_VOLUME — the three sibling sites' inline 1.1 is argued in place (FPSWeapon.cs:304 is the player's miss arm, not EnemySounds.PlayMissSound) and pinned as deliberately not one constant",
      "WATER-AUDIT M4's index set — NOT a four-hosts miss: the fixed city's ground is a 2-triangle quad (exterior.js:679-686), so there is no grid to subset",
      "the exterior host's absent isBuildingQuestResource arm and its behaviour-less street StaticNPCs — both argued in place at exterior.js:2210-2226 and :820-837, so out of scope as recorded",
      "startDisease's `specialInfection` and doEnchantedPayloads' `collection` — unfed options, each flagged in place as the reference's clause with no current producer",
      "arrestFlow's `positionPlayerAtLocationEntrance` unfed in exterior.js — real, but the dep and the gap predate 0fe2c05b (WIND1), so outside this audit's delta",
      "makeScrollerBar, activeLightCurveKeys, loadIcon, openSaveWindow, toggleMount, messageBoxWheel — dead or test-only exports confirmed, but all predate the delta (F301's open sweep, which OT1 c only partly closed)"
    ]
  }
}
```