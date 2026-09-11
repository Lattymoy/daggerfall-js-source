# AUDIT 65 findings ledger (pre-refutation)

| id | lens | sev (finder) | primary file | one line |
|---|---|---|---|---|
| SL-1 | saveload | medium | systems/weatherSim.js | restoreWeather never lowers _climateWeathersValid; in-session load lets CLK2 evolution drain the restored sky |
| SL-2 | saveload | medium | scenes/worldModes.js | interior weapon rig (sheath/hand) never in the envelope; world host composes from exterior rig |
| SL-3 | saveload | low | scenes/dungeonContext.js | pickpocketAttempted survives dungeon load (applyWorld patches foes in place) |
| SL-4 | saveload | low | systems/save.js | reactionMods restore not padded to SOCIAL_GROUP_COUNT; REP_ARRAYS comment mis-cites |
| UI-1 | ui-input | high | ui/spellbookWindow.js | click(vx,vy,now) receives the hosts' right-button boolean as `now`; every second click casts/buys |
| UI-2 | ui-input | high | (= HP-1) | relock hook missing from dungeonContext/exterior + classic pauseWindow |
| UI-3 | ui-input | medium | ui/enhancedControls.js | no waitingForInput guard while capture armed |
| UI-4 | ui-input | medium | ui/hudLarge.js | middle/4th/5th button runs the LEFT panel action |
| UI-5 | ui-input | low | ui/nativeInventory.js | wheel dead until pointer moves (_mouse seeded [-1,-1]) |
| RS-1 | render-state | medium | render/renderTarget.js | withTarget/finishVolume no try/finally |
| RS-2 | render-state | medium | render/renderer.js | renderCharacterSprite finally omits FBO/viewport/clearColor restores |
| RS-3 | render-state | medium | render/renderer.js | cloud-shadow unit 7 collides with DS _MoonTex slot 7; markForeignPass does not clear _csUploaded |
| RS-4 | render-state | medium | scenes/world.js | farFlatVisible options object per batch per frame |
| RS-5 | render-state | low | render/renderer.js | drawWaterSurface re-uploads pass constants per pixel |
| RS-6 | render-state | low | render/enhancedSky.js | per-frame scratch objects in the deck chain |
| RS-7 | render-state | medium | render/volumetricClouds.js | no dispose on VolumetricClouds/CloudNoise |
| RS-8 | render-state | low | render/volumetricClouds.js | BLEND disable asymmetric; blendFuncSeparate residue |
| RS-9 | render-state | medium | render/volumetricClouds.js | loop ceilings 96/8 unpinned vs QUALITY.steps/light |
| RS-10 | render-state | medium | scenes/exterior.js | body drawn BEFORE opaque sky pass in exterior.js |
| RS-11 | render-state | low | render/volumetricClouds.js | _shiftShadowMap texSubImage2D in-frame + unit clobber |
| XL-1 | cross-lane | critical | scenes/world.js + exterior.js | OT1 swim write lands on the motor's levitate gate: exterior swimmer frozen |
| XL-2 | cross-lane | high | world/flatDistance.js | SIB 3.1x flats defeat TALL_FLAT_HEIGHT three seasons of four |
| XL-3 | cross-lane | medium | (= HP-1) | relock |
| XL-4 | cross-lane | medium | player/mwCamera.js | third-person camera built from raw feet: no EV1/MAC1 smoothing |
| XL-5 | cross-lane | medium | player/motor.js | player.standing not written on the climb return |
| XL-6 | cross-lane | low | scenes/dataSource.js | boot-menu registerMorrowindData migrates legacy ArrayBuffers via assetBlob |
| PN-1 | pins | high | test/water.test.js | six WATER constants pinned against themselves |
| PN-2 | pins | high | test/volumetricClouds.test.js | QUALITY/SWEEP_FRAMES/VC_PROFILE held only by inequalities |
| PN-3 | pins | high | test/combatVisuals.test.js | concealment alphas pinned against themselves |
| PN-4 | pins | medium | test/audit64_travel.test.js | EXTRA_DISTANCE tautology |
| PN-5 | pins | medium | test/audit63_windows.test.js | shoplift chance tautology |
| PN-6 | pins | medium | test/audit64_hud.test.js | call-site count survives a disabled guard |
| PN-7 | pins | medium | test/fixc_firstStart.test.js | rebuildRoadless callers unpinned |
| PN-8 | pins | low | test/fixe_deathMenu.test.js | watchdog range pin |
| HP-1 | hosts-parity | medium | scenes/exterior.js + dungeonContext.js | relock hook in 2 of 6 pause flows |
| HP-2 | hosts-parity | high | scenes/worldModes.js | dungeon-arm pickpocket modal mounted into the interior slot (orphan) |
| HP-3 | hosts-parity | low | scenes/worldModes.js | dungeon-arm hud line goes to townTalk queue not dungeon's |
| CV-1 | constants | medium | ui/charsheet.js + enhancedCharSheet.js | skills dialog prints permanent skill, not GetLiveSkillValue |
| CV-2 | constants | medium | systems/spellcast.js | player capsule measured at enemy 0.45 radius (player is 0.35) |
| CV-3 | constants | low | render/waterSurface.js | water scroll rate spelled three times (= MC-5) |
| CV-4 | constants | low | scenes/worldModes.js | closed-building line invented vs guildClosed/storeClosed records |
| RC-1 | ref-cites | medium | ui/enhancedControls.js | ReservedKeys cite → InputManager.cs:73 |
| RC-2 | ref-cites | medium | scenes/worldModes.js | IsAlreadyPlaced → IsAlreadyInjected, :917 → :926 |
| RC-3 | ref-cites | low | scenes/dungeonContext.js, ui/chargen.js, scenes/exteriorFoes.js | five off-by-one cites |
| MC-1 | missing-caller | medium | scenes/exterior.js | hudMessageSink never fed in exterior.js |
| MC-2 | missing-caller | medium | player/activate.js | six of eleven youAreTooFarAway refusals unreachable (pre-gated pick) |
| MC-3 | missing-caller | low | scenes/shared.js | dynamicMoonlight has no caller |
| MC-4 | missing-caller | low | scenes/interior.js | keyboard look not in standalone interior host |
| MC-5 | missing-caller | low | (= CV-3) | water literals |
| MC-6 | missing-caller | low | render/waterSurface.js | tilemapHasWater / waterCoverage dead exports |

Refuter pairs: saveload (2), ui+hosts (2), render-state (2), cross-lane (2), pins (2), constants+cites (2), missing-caller (2) = 14.
