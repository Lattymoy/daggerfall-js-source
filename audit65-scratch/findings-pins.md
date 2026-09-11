All mutants restored; tree is clean. Here are the findings.

```json
[
  {
    "id": "PN-1",
    "lens": "pins",
    "title": "WATER1's six tuning constants are pinned against themselves - the whole 7047-test suite stays green with the water lifted 10x, made near-transparent, given a mirror-bright Fresnel and a red sky",
    "severity": "high",
    "files": ["test/water.test.js", "src/render/waterSurface.js"],
    "claim": "test/water.test.js:79 claims 'the uniforms - the eased wind on the row's scale, null as calm, the sky's two colours, the classic scroll'. Line 93/98 are the only assertions that touch WATER_LIFT, WATER_OPACITY, WATER_F0, SHORE_SOFTNESS, DEFAULT_SKY_ZENITH and DEFAULT_SKY_HORIZON - and each compares waterUniforms()'s output to the very constant waterUniforms() read.",
    "evidence": "TAUTOLOGY at test/water.test.js:93 `assert.equal(u.lift, WATER_LIFT); assert.equal(u.opacity, WATER_OPACITY); assert.equal(u.f0, WATER_F0); assert.equal(u.shoreSoft, SHORE_SOFTNESS);` and :98 `assert.equal(calm.zenith, DEFAULT_SKY_ZENITH); assert.equal(calm.horizon, DEFAULT_SKY_HORIZON);`. MUTANTS RUN (each edited in place, restored after): src/render/waterSurface.js:52 `WATER_LIFT = 0.08` -> `0.8`; :54 `WATER_OPACITY = 0.82` -> `0.12`; :60 `WATER_F0 = 0.02` -> `0.5`; :62 `SHORE_SOFTNESS = 0.16` -> `0.9`; :69 `DEFAULT_SKY_ZENITH [0.17,0.35,0.72]` -> `[1,0,0]`; :70 `DEFAULT_SKY_HORIZON [0.66,0.78,0.92]` -> `[0,1,0]`. Every one SURVIVED `node --test test/water.test.js` (10 pass / 0 fail). Four of them were then run together under the FULL suite (`npm test`): 7047 tests, 0 fail. `grep -rn 'WATER_LIFT|WATER_OPACITY|SHORE_SOFTNESS|WATER_F0|DEFAULT_SKY_ZENITH' test/` returns nothing outside test/water.test.js. Only WATER_SCROLL_TILES_PER_SEC has a literal pin (:101, `=== 0.05`) - so one of the seven constants in the file is actually held.",
    "proposedFix": "Give each constant the shape WATER_SCROLL_TILES_PER_SEC already has - a literal, beside the reason: `assert.equal(WATER_LIFT, 0.08, 'the z-fight lift above the ground the water is built from');` `assert.equal(WATER_OPACITY, 0.82);` `assert.equal(WATER_F0, 0.02, 'water\\'s normal-incidence Fresnel');` `assert.equal(SHORE_SOFTNESS, 0.16);` `assert.deepEqual([...DEFAULT_SKY_ZENITH], [0.17, 0.35, 0.72]);` `assert.deepEqual([...DEFAULT_SKY_HORIZON], [0.66, 0.78, 0.92]);` - then keep the existing identity lines as the wiring check (that waterUniforms actually forwards them). WATER_LIFT in particular also wants a consequence pin: `assert.ok(WATER_LIFT > 0 && WATER_LIFT < 0.2, 'above the ground but below a step')`, since the visible defect is water floating over a shore.",
    "pinShape": "tautology - expected value read from the module under test"
  },
  {
    "id": "PN-2",
    "lens": "pins",
    "title": "VC3's quality tiers, sweep length and cloud profile table are held only by inequalities and range checks - the exact shape Home.md's 'A PIN MUST FAIL' names",
    "severity": "high",
    "files": ["test/volumetricClouds.test.js", "test/clockArc.test.js", "src/render/volumetricClouds.js"],
    "claim": "test/volumetricClouds.test.js:19 'the profile - one row per weather, eased on the weather ease's own exponential' and :63 'the map, the sweep, the drift - the numbers the rest of the outdoors already keeps'. Neither test holds a single number of QUALITY, SWEEP_FRAMES or VC_PROFILE; they hold orderings ('three tiers, rising', 'a lid is flat, a storm dark') and 0..1 range checks.",
    "evidence": "MUTANT src/render/volumetricClouds.js:66 `default: { width: 1024, height: 256, steps: 56, light: 5, shadow: 512, shadowSteps: 12 }` -> `{ width: 640, height: 128, steps: 40, light: 5, shadow: 256, shadowSteps: 10 }` (the default cloud map halved in every dimension) - SURVIVED test/volumetricClouds.test.js + test/clockArc.test.js + test/ds2_cloudsUnderMod.test.js (14 pass / 0 fail), because :64 only asserts `QUALITY.lo.width < QUALITY.default.width < QUALITY.hi.width` and `q.height % SWEEP_FRAMES === 0`. MUTANT :70 `SWEEP_FRAMES = 8` -> `4` - SURVIVED (the modulo still holds for 128/256/512). MUTANT :112 `sunny: { ..., density: 0.60, ..., shear: 0.35 }` -> `density: 0.95, shear: 0.95` (a clear sky given thunderhead density) - SURVIVED, because :22-24 only checks `p.base>0 && p.top>p.base` and `0<=p[k]<=1`. All three were then run together under the FULL suite (`npm test`): 7047 tests, 0 fail. The same shape is in the neighbouring table: test/enhancedSky.test.js:81-86 holds WEATHER_SKY entirely by `<` and `>`, and test/clockArc.test.js:39 by `Math.hypot(...wind) < 0.1`.",
    "proposedFix": "Add one deepEqual per table, against the literals the arc doc settles: `assert.deepEqual(QUALITY.default, { width: 1024, height: 256, steps: 56, light: 5, shadow: 512, shadowSteps: 12 });` (and lo/hi), `assert.equal(SWEEP_FRAMES, 8, 'a full re-march every eight frames');` and `assert.deepEqual(VC_PROFILE.sunny, { base: 1400, top: 3200, density: 0.60, dark: 0.00, flat: 0.10, shear: 0.35 });` for at least sunny / overcast / thunder / fog. Keep the existing inequalities - they say why the numbers are what they are - but a table with no literal anywhere cannot redden.",
    "pinShape": "inequality / relational pin with no absolute anchor"
  },
  {
    "id": "PN-3",
    "lens": "pins",
    "title": "ECV1's concealment alphas are pinned against themselves - a concealed foe drawn at 0.95 opacity, or a hit-reveal that lasts nine seconds, keeps the suite green",
    "severity": "high",
    "files": ["test/combatVisuals.test.js", "src/systems/combatVisuals.js"],
    "claim": "test/combatVisuals.test.js:38 'the law - plain, hidden, and the three concealed draws' and :56 'the hit reveal - a landed blow flashes any concealed foe ... fading over REVEAL_SECONDS'. Every assertion about how VISIBLE a concealed foe is compares concealVisual()'s alpha to the constant concealVisual() read.",
    "evidence": "TAUTOLOGY at test/combatVisuals.test.js:44 `assert.equal(b.alpha, BLEND_ALPHA)`, :52 `assert.deepEqual(s, { mode: CONCEAL_MODE.shade, alpha: SHADE_ALPHA, t: 2, phase: 0.3 })`, :59 `assert.equal(at.alpha, REVEAL_ALPHA)`, :62 `Math.abs(half.alpha - REVEAL_ALPHA/2) < 1e-9`. MUTANTS: src/systems/combatVisuals.js:53 `BLEND_ALPHA = 0.22` -> `0.95` (a chameleoned imp drawn all but solid) SURVIVED (7 pass / 0 fail); :58 `SHADE_ALPHA = 0.55` -> `0.02` (a shade drawn invisible) SURVIVED; :61 `REVEAL_SECONDS = 0.35` -> `9` (one hit reveals a concealed foe for nine seconds) SURVIVED. All three, plus SHADE_DARK, were then run under the FULL suite: exactly ONE test failed - the SHADE_DARK one. Re-run isolated: MUTANT :59 `SHADE_DARK = 0.12` -> `0.9` was KILLED. So the file already contains the fix shape for one of its six constants and not the other five.",
    "proposedFix": "Anchor each alpha with a literal beside its existing identity line, e.g. `assert.equal(BLEND_ALPHA, 0.22, 'a chameleon shimmers at a fifth opacity');` `assert.equal(BLEND_SHIMMER, 0.08);` `assert.equal(BLEND_HZ, 1.3);` `assert.equal(SHADE_ALPHA, 0.55);` `assert.equal(REVEAL_ALPHA, 0.8);` `assert.equal(REVEAL_SECONDS, 0.35, 'a third of a second, not a tell that outlives the swing');`. Additionally pin the consequences that make them load-bearing: `assert.ok(BLEND_ALPHA + BLEND_SHIMMER < 0.5, 'a concealed foe is never more than half visible')` and `assert.ok(REVEAL_SECONDS < 1, 'the flash is shorter than a swing')`.",
    "pinShape": "tautology - expected value read from the module under test"
  },
  {
    "id": "PN-4",
    "lens": "pins",
    "title": "AUDIT 64 F18's arrival-landing pin says 'a tenth of a block outside the rectangle' but computes the tenth from the port's own EXTRA_DISTANCE",
    "severity": "medium",
    "files": ["test/audit64_travel.test.js", "src/world/locationEntrance.js"],
    "claim": "test/audit64_travel.test.js:117 'the hint reaches the landing, and the landing is an EDGE, not a centre' - StreamingWorld.cs:1532-1565 puts the arriving player one RMBSide*0.1 outside the town rectangle.",
    "evidence": "TAUTOLOGY at test/audit64_travel.test.js:133 `assert.deepEqual(at.pos, [origin[0] + half - (half + EXTRA_DISTANCE), origin[1], origin[2] + half], 'a tenth of a block OUTSIDE the rectangle, not its centre')` - the message says 'a tenth of a block' and the expression says 'whatever locationEntrance.js currently exports'. MUTANT src/world/locationEntrance.js:45 `EXTRA_DISTANCE = RMB_SIDE * 0.1` -> `RMB_SIDE * 0.5` (fast-travel arrivals dropped half a block off the town edge instead of a tenth) SURVIVED `node --test test/audit64_travel.test.js` (7 pass / 0 fail). Re-run with the pre-existing test/prisonrelease.test.js added: KILLED - that file's :54 `assert.equal(EXTRA_DISTANCE, RMB_SIDE * 0.1)` is the only thing in the tree holding the number, and it is not part of the delta.",
    "proposedFix": "Either state the number where the claim is made - `const half = 2 * 0.5 * RMB_SIDE; const tenth = RMB_SIDE * 0.1; assert.equal(EXTRA_DISTANCE, tenth, 'StreamingWorld.cs:1560-1563'); assert.deepEqual(at.pos, [origin[0] - tenth, origin[1], origin[2] + half]);` - or drop `EXTRA_DISTANCE` from the expression entirely and write `origin[0] + half - (half + RMB_SIDE * 0.1)`. A pin whose expected value imports the thing it is testing cannot fail on that thing.",
    "pinShape": "tautology - expected value read from the module under test (backstopped only by a pre-delta file)"
  },
  {
    "id": "PN-5",
    "lens": "pins",
    "title": "AUDIT 63 F48's 'shopliftAttempt is DoSteal's ARITHMETIC' pin never states DoSteal's arithmetic - it re-runs the port's own formula",
    "severity": "medium",
    "files": ["test/audit63_windows.test.js", "src/combat/formulas.js"],
    "claim": "test/audit63_windows.test.js:471 'AUDIT 63 F48: shopliftAttempt is DoSteal's arithmetic, not AttemptPrivatePropertyTheft's' - DaggerfallTradeWindow.cs:912, chance = (100 - Pickpocket) + shopQuality + weightAndNumItems.",
    "evidence": "TAUTOLOGY at test/audit63_windows.test.js:485 `assert.equal(out.chance, calculateShopliftingChance(40, 12, out.weightAndNumItems))`, and again at :376/:400/:463 where the expected roll threshold is itself `calculateShopliftingChance(...)`. MUTANT src/combat/formulas.js:833 `const chance = (100 - pickpocketSkill) + shopQuality + weightAndNumItems;` -> `... - weightAndNumItems;` (a full basket now makes you HARDER to catch, inverting the law the finding is about) SURVIVED `node --test test/audit63_windows.test.js` (19 pass / 0 fail). Re-run against the pre-existing test/theft.test.js: KILLED by its :43 `assert.equal(calculateShopliftingChance(40, 10, 6), 76)`. The delta's own new law - shopliftingLoad's C# `(int)` cast - IS pinned: MUTANT src/systems/theft.js:66 `Math.trunc` -> `Math.round` was KILLED by :480 `assert.equal(out.weightAndNumItems, 2)`.",
    "proposedFix": "Replace :485 with the reference arithmetic spelled out, as the file already does for the load: `assert.equal(out.chance, Math.max(5, Math.min(95, (100 - 40) + 12 + out.weightAndNumItems)), 'DaggerfallTradeWindow.cs:912');` and give the three roll-threshold helpers at :376/:400/:463 a literal too (e.g. `const chance = 62; assert.equal(calculateShopliftingChance(50, 10, load), chance);`) so the window tests fail if the formula moves under them.",
    "pinShape": "tautology - expected value computed by the function under test"
  },
  {
    "id": "PN-6",
    "lens": "pins",
    "title": "AUDIT 64 F34's caller sweep counts call SITES, so a refusal that has been switched off still counts - the pin cannot see a dead wire",
    "severity": "medium",
    "files": ["test/audit64_hud.test.js", "src/scenes/townTalk.js"],
    "claim": "test/audit64_hud.test.js:246 'every SetMidScreenText caller speaks to the label, and the two PopupMessage siblings do not' - PlayerActivate.cs:780/:790/:834's three youAreTooFarAway refusals must all reach the mid-screen label.",
    "evidence": "SHAPE PIN at test/audit64_hud.test.js:253 `assert.equal((src('scenes/townTalk.js').match(/setMidScreenText\\(TOO_FAR_AWAY_TEXT\\)/g) ?? []).length, 3)` - a count over the file's text, not over what runs. MUTANT src/scenes/townTalk.js:612 `if (getInteractionMode() !== 'steal' && bestDist > MOBILE_NPC_ACTIVATION_DISTANCE) { setMidScreenText(TOO_FAR_AWAY_TEXT); return true; }` -> `if (false && getInteractionMode() ...` (the whole distance refusal on talking to a townsperson switched off; the text still reads 3) SURVIVED `node --test test/audit64_hud.test.js` (18 pass / 0 fail). Run across the eight other files that mention the distance, only the PRE-DELTA test/audit23_ui.test.js killed it. The same shape covers the whole family of host-wiring pins in this file (:494-503, :369-378, :547-552) and every pin in test/fixc_firstStart.test.js, test/fixe_deathMenu.test.js and test/water.test.js:161 - scenes/world.js, scenes/exterior.js, scenes/worldModes.js and scenes/dungeonContext.js are the four files no test boots, so a source pin is all that is available there.",
    "proposedFix": "Where a behavioural door already exists, use it: townTalk is constructible in node (test/audit63_quests_talk.test.js:56 builds one), so add `const t = talkHost(50); t.activateAt(farAway); assert.equal(midScreenText.text, TOO_FAR_AWAY_TEXT);` for at least one of the three arms and keep the count pin for the other two. Where the host genuinely cannot be booted, anchor the fragment to its GUARD rather than to the call alone - `assert.match(s, /if \\(getInteractionMode\\(\\) !== 'steal' && bestDist > MOBILE_NPC_ACTIVATION_DISTANCE\\) \\{ setMidScreenText\\(TOO_FAR_AWAY_TEXT\\); return true; \\}/)` - so a disabled condition changes the matched text.",
    "pinShape": "shape pin - source-text count that a dead call site still satisfies"
  },
  {
    "id": "PN-7",
    "lens": "pins",
    "title": "FIX-C pins rebuildRoadless's DEFINITION but neither of the two arms that call it - the spawn-in-the-sky fix can be disarmed without reddening its own file",
    "severity": "medium",
    "files": ["test/fixc_firstStart.test.js", "src/scenes/world.js"],
    "claim": "test/fixc_firstStart.test.js:22 'the roads sweep RE-QUEUES what it tears down' - Mac's report 'Players on first start either spawn in the ground or the sky'. Line 32: `assert.match(world, /function rebuildRoadless\\(\\) \\{ roadsSweepDue = true; \\}/, 'the network's arrival marks the sweep')`.",
    "evidence": "MUTANT src/scenes/world.js:442 - removed the `rebuildRoadless();` call from the `if (his)` arm of `loadModRoads().then(...)`, i.e. a retail Basic Roads install lands its network and never arms the sweep, which is exactly the first-start race the fix is for. SURVIVED `node --test test/fixc_firstStart.test.js` (3 pass / 0 fail): the pin only requires the one-line function body to exist. Isolated across the roads lane, the mutant was KILLED by test/roads.test.js (not by the FIX-C file). For contrast, the sibling pin at :34 IS tight: MUTANT world.js:7612 `if (roadsSweepDue && !building) {...}` -> `if (false && roadsSweepDue && !building) {...}` was KILLED, because :34 matches the whole line `tickSeason();\\n if (roadsSweepDue && !building) { roadsSweepDue = false; sweepRoadless(); }`.",
    "proposedFix": "Pin the two ARMS the way :34 pins the frame: `assert.equal((world.match(/rebuildRoadless\\(\\);/g) ?? []).length, 3, 'the declaration and BOTH arms of loadModRoads().then - the mod arm and the generated-network arm');` plus `assert.match(world, /road pixels \\(Hazelnut\\)[^\\n]*\\)\\); rebuildRoadless\\(\\); return; \\}/, 'the Basic Roads arm arms the sweep before it returns');` and `assert.match(world, /terrainGen\\.setRoads\\(settlementsOf\\(maps\\), logRoads, roadSwitches\\);\\s*\\n\\s*rebuildRoadless\\(\\);/, 'and so does the generated-network arm');`.",
    "pinShape": "shape pin - the producer is pinned, its callers are not"
  },
  {
    "id": "PN-8",
    "lens": "pins",
    "title": "FIX-E's death-video watchdog is held by a 15s..60s range, so the number itself is free",
    "severity": "low",
    "files": ["test/fixe_deathMenu.test.js", "src/scenes/shared.js"],
    "claim": "test/fixe_deathMenu.test.js:32 'a video that never settles is a BOUNDED wait - the watchdog navigates' - Mac's 'When dying and returning to the main menu, the game bugs and you're unable to make selections'.",
    "evidence": "Reported WITHOUT running (the surrounding behaviour - the hold, the release, the finally - is genuinely pinned and the watchdog value is arbitrary port policy). test/fixe_deathMenu.test.js:36 `assert.ok(DEATH_VIDEO_WATCHDOG_MS >= 15000 && DEATH_VIDEO_WATCHDOG_MS <= 60000)` is a 45-second-wide band: any value in it - including one that makes a dead player stare at a frozen frame for a minute - passes. Same class as Home.md's `assert.ok(bows >= 8)`.",
    "proposedFix": "`assert.equal(DEATH_VIDEO_WATCHDOG_MS, <the chosen value>, 'a real DIE.VID ends well inside this');` and keep the band as a second, explanatory assertion.",
    "pinShape": "inequality / range pin with no absolute anchor"
  }
]
```

```json
{
  "coverage": {
    "mutantsRun": 57,
    "killed": 41,
    "survivors": 16,
    "note": "12 of the 16 survivors survive the FULL `npm test` suite (7047 tests, 0 fail) - PN-1 (6), PN-2 (3), PN-3 (3). The other 4 survive only the delta's own pin and are killed by an older file: EXTRA_DISTANCE (test/prisonrelease.test.js), the shoplifting-chance sign (test/theft.test.js), the townTalk too-far-away wire-break (test/audit23_ui.test.js), the rebuildRoadless arm (test/roads.test.js). Two full-suite runs were used as authority; every mutant was applied in place with perl and reverted with `git checkout --`, and `git status --short` is empty for src/, tools/ and test/.",
    "filesTouched": [
      "src/ui/midScreenText.js",
      "src/ui/hudShortcuts.js",
      "src/render/waterSurface.js",
      "src/render/volumetricClouds.js",
      "src/world/worldClock.js",
      "src/systems/holidays.js",
      "src/player/motor.js",
      "src/player/lookFilter.js",
      "src/player/exteriorSurface.js",
      "src/world/flatDistance.js",
      "src/systems/armorMaterials.js",
      "src/world/staticBuildings.js",
      "src/world/cityGate.js",
      "src/world/rmbFlats.js",
      "src/world/locationEntrance.js",
      "src/world/actionSystem.js",
      "src/world/roadPainter.js",
      "src/ui/enhancedControls.js",
      "src/ui/nativeInventory.js",
      "src/ui/chargenArt.js",
      "src/ui/videoPlayer.js",
      "src/systems/combatVisuals.js",
      "src/systems/theft.js",
      "src/systems/court.js",
      "src/systems/modSettings.js",
      "src/systems/dynamicSkies.js",
      "src/systems/quest/quest.js",
      "src/systems/quest/place.js",
      "src/combat/formulas.js",
      "src/formats/mwBsaFile.js",
      "src/scenes/townTalk.js",
      "src/scenes/world.js",
      "tools/citeShift.mjs"
    ],
    "unmeasurable": [
      "src/render/renderer.js - drawWaterSurface's blend/polygon-offset/depth state and its uniform uploads (277 new lines); node has no GL, so test/water.test.js:136 can only regex the function body",
      "src/render/waterSurface.js shader halves - WATER_SURFACE_VS and waterSurfaceFs() (the Schlick term, the three wave trains, the coverage feather); pinned only by assert.match over the GLSL string",
      "src/render/volumetricClouds.js - MARCH_FS / COMPOSITE_FS / SHADOW_FS (594 new lines); only the uniform-name set and a handful of source lines are checkable",
      "src/render/cloudNoise.js - NOISE_GLSL / SHAPE_FS / DETAIL_FS / SLICE_FS (200 new lines), pictures deferred to tools/cloudNoiseProbe.mjs on SwiftShader",
      "src/render/renderTarget.js, src/render/dynamicSkiesRenderer.js, src/render/farRing.js - GL object lifetimes and framebuffer law",
      "THE FOUR HOSTS - src/scenes/world.js (950 new lines), src/scenes/exterior.js, src/scenes/worldModes.js, src/scenes/dungeonContext.js: no test in the tree boots one, so every wiring pin over them (audit63 F46, audit64 F36/F37/F38, WATER1's slot order, FIX-C, FIX-E, OT1, MAC1 D/H/J, ROAD-H's four-host sweeps) is necessarily a source-text pin. PN-6 and PN-7 are what that costs; the mitigation is to anchor the fragment to its guard/order rather than to the bare call, which the tighter pins in the same files already do."
    ]
  }
}
```