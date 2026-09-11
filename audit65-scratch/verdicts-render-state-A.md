```json
[
  {
    "id": "RS-1",
    "upheld": false,
    "confidence": "high",
    "reasoning": "The structural claim is accurate at HEAD: src/render/renderTarget.js:59-66 (withTarget), :71-76 (withVolumeLayer) and :80-86 (finishVolume) have no try/finally, and the header at :12-14 does assert the restore. But the consequence is unreachable: every closure handed to these functions contains only GL calls - src/render/volumetricClouds.js:525-528 and :544-547 are `gl.viewport` + `gl.drawArrays`, src/render/cloudNoise.js:173-176 is `gl.uniform1f` + `gl.drawArrays` - and WebGL2 signals errors through getError flags and context-lost no-ops, never exceptions. The header's own wording is 'when it returns', which a throw is not, so even the cited sentence is not falsified. Contrast RS-2, where the guarded body is a JS deref (`mesh.vao`) that genuinely can throw and sits under a caught-throw path.",
    "corrections": "The finder names 'callers that can throw inside the closure' and lists three that cannot. renderer.js:2139-2142's panelFrame doctrine is about a body that is arbitrary caller JS (`body()`), not three GL primitives - it is a precedent for the shape, not a law this file breaks. The pinShape is also under-specified: test/cloudNoise.test.js:40-41 source-pins withTarget's exact statement sequence, so the proposed fix reddens two existing assertions and the finder does not say so.",
    "fixShape": "Optional hardening only, and cheapest folded into the RS-2 lane: wrap src/render/renderTarget.js:60-65 as `try { ...bind/attach/viewport/draw... } finally { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(...restoreViewport); }`, same for :81-85 in finishVolume, and give src/render/cloudNoise.js:166-181 `_fill` a try/finally so finishVolume always runs. If it lands, test/cloudNoise.test.js:40 and :41 must be re-written to the new statement shape in the same commit, or the suite reddens.",
    "severity": "info",
    "laneKey": "src/render/renderTarget.js"
  },
  {
    "id": "RS-2",
    "upheld": true,
    "confidence": "high",
    "reasoning": "Re-derived at HEAD: src/render/renderer.js:1381-1385 is the try/finally and it covers only `_proj`/`_view`/`_fogMode`/`_cloudShadow`; :1386 `gl.bindFramebuffer(gl.FRAMEBUFFER, null)`, :1394 `this._restoreWorldViewport()` and :1395-1396 the clearColor restore all sit after it, against the state set at :1339-1340 and :1352-1357. `git blame -L 1377,1397` puts the try/finally at 5116ce43e (VC5, 2026-09-07), inside the delta - so the slice added a throw guard at this exact site and drew its boundary short of the three GL restores whose own comments (:1341-1345 AUDIT 26 F034, :1387-1393 ROAD-E E5) record them as shipped bugs. The throw path is REACHABLE and CAUGHT, which the finder did not establish: drawCharacter dereferences `mesh.vao` at :1250 and `mesh.ranges`/`mesh.count` at :1262/:1279, and the icon path src/combat/fpArm.js:1976 calls renderCharacterSpriteImage inside a try/finally that only releases the mesh, under itemIcon's own `catch { img = null; }` - so the throw is swallowed and play continues. The residue is worse than 'a frame renders offscreen': `_clearColor` still reads sky blue while GL holds (0,0,0,0), and setClearColor at :1907-1911 is idempotent AGAINST that shadow, so the true clear colour can never be re-issued for the rest of the session.",
    "corrections": "'renderCharacterSpriteImage does put its whole restore in a finally' (:1429-1437) is wrong - that finally restores JS light state only; its own `bindFramebuffer`/`readPixels` at :1439-1443 are equally outside, and on a rethrow from renderCharacterSprite they never run. The finder also calls the throw path unreachable in its needsAGl block ('unreachable in normal play'); the itemIcon catch makes it reachable and makes the damage permanent rather than one-frame, which is the strongest part of the finding and is missing from it.",
    "fixShape": "src/render/renderer.js: move :1386, :1394 and :1395-1396 into the existing finally at :1382-1385, ordered GL-first (bindFramebuffer(null), _restoreWorldViewport(), clearColor from `this._clearColor`) then the JS-cache restores, leaving `return cs.tex;` at :1397 outside. Do NOT widen the try to include `_charSpriteRT()` at :1338 - a throw there has bound nothing. Check no other caller depends on the current ordering: the four world-space callers are src/render/characterSprite.js:57 and :112, src/combat/fpArm.js:3253 (lensLocal) and :3491 via renderCharacterSpriteImage; none reads GL state between. No existing pin source-matches this block (test/glstate.test.js and test/enhancedSky.test.js do not), so no test needs moving.",
    "severity": "medium",
    "laneKey": "src/render/renderer.js"
  },
  {
    "id": "RS-3",
    "upheld": true,
    "confidence": "high",
    "reasoning": "Both halves re-derived: src/render/renderer.js:2607-2619 binds the shadow map on `gl.TEXTURE7` and short-circuits on `this._csUploaded[key] === this._csStamp`, and src/render/dynamicSkiesRenderer.js:822-829 walks `gl.activeTexture(gl.TEXTURE0 + i)` over the nine names at src/systems/dynamicSkies.js:432-435, so `_MoonTex` lands on unit 7 and `_SecundaTex` on unit 8. markForeignPass at renderer.js:1125-1129 resets `_lastProgram`/`_lastVao` and leaves `_csUploaded` alone - which contradicts its own header at :1122-1124 and EV6's stated half at :1045-1046 ('an entry point may only trust a binding it can account for'). The live path is in exterior.js, not world.js: world.js is safe because its stamp MOVES after the sky (beginFrame nulls the deck and bumps at renderer.js:1921, then world.js:7783 sets it and bumps, both after sky.draw at :7749), whereas exterior.js:4027 bumps BEFORE sky.draw at :4032 and the second call at :4038 hands back the same object, which setCloudShadow (:2603) refuses to re-stamp - so 'char' uploaded by the body at :4028 stays marked valid across the clobber and every later charProgram draw (the rig at exterior.js:4104) samples _MoonTex as its cloud transmittance.",
    "corrections": "The finder's mechanism for why it is benign today is wrong. It is not 'drawTerrain happens to be the first post-sky draw' - it is that world.js bumps the stamp after the sky, which invalidates every key at once; and exterior.js does NOT have that property, so the collision is live there under ?sky=dynamic in third person, not merely latent. Proposed fix (a) is infeasible as written: nine slots based above unit 7 needs 17 fragment texture units and WebGL2 only guarantees MAX_TEXTURE_IMAGE_UNITS >= 16.",
    "fixShape": "Two lines, both in renderer.js. (1) src/render/renderer.js:1125-1129: add `this._csUploaded = {};` to markForeignPass - a foreign pass may have moved any unit, which is exactly what the method already means for programs and VAOs; this costs one re-upload per key per seam (3 seams in world.js, 2 in exterior.js per test/glstate.test.js:113-118) and changes no call count, so the markForeignPass-count pins at test/glstate.test.js:116 and test/farring.test.js:184 stay green. (2) export a named `CLOUD_SHADOW_UNIT = 7` beside the literal at :2612/:2614 and add a pure pin `assert.ok(TEXTURE_SLOTS.length <= CLOUD_SHADOW_UNIT)` so the two files can never overlap silently again. RS-10's reorder independently removes the exterior manifestation; keep both - (1) is the structural fix, RS-10 is the ordering fix.",
    "severity": "medium",
    "laneKey": "src/render/renderer.js"
  },
  {
    "id": "RS-4",
    "upheld": false,
    "confidence": "high",
    "reasoning": "The shape is as quoted (src/scenes/world.js:7866 passes a fresh literal to the destructuring signature at src/world/flatDistance.js:46), but the cost is not material and no law forbids it. I measured it in node: 600,000 calls of the object form run in 9.2 ms with a 0.9 MB heap delta - at the finder's own worst case of ~1000 calls a frame that is 0.015 ms/frame, 0.09% of a 16.7 ms budget, because V8 scalar-replaces a literal that is destructured and never escapes. EV2's sentence at world.js:7871-7872 and its fuller statement at :7791-7796 is about cached `Float32Array(16)`s minted per model per frame that DO escape into `m._world`; a non-escaping options bag is not the same class, and the slice trades it for a skipped draw call, which is a large net win in the direction MAC1 was written for.",
    "corrections": "'on the order of a thousand short-lived objects a frame' is the right count and the wrong conclusion - it is 15 microseconds. The fix's blast radius is also understated: test/mac1_playreport.test.js calls farFlatVisible in the object form at :104, :105, :109, :110, :111 and :112 as well as source-pinning it at :118, so it is seven assertions to move, not one, for no measurable gain.",
    "fixShape": "No lane. If a future slice touches flatDistance.js for another reason it may switch to `farFlatVisible(ring, height, animated)` and update test/mac1_playreport.test.js:104-112 and :118 together, but do not open a lane for this alone.",
    "severity": "none",
    "laneKey": "src/world/flatDistance.js"
  },
  {
    "id": "RS-5",
    "upheld": false,
    "confidence": "high",
    "reasoning": "The uniform inventory at src/render/renderer.js:2700-2737 is accurate, but the claimed law does not exist. src/scenes/world.js:7876's 'One uniform set a frame' introduces the clause 'the clock, the eased wind ... and the dome's own two colours to reflect' and describes the `wu` OBJECT built once at :7880 and reused across pixels at :7881-7884 - it is not a claim about GL uniform calls, so the comment does not assert the opposite of the code, it asserts what the code does. Nor is this the largest instance of the shape: drawTerrain (renderer.js:2622-2654) uploads the same ~20-uniform block for every one of the up-to-49 streamed pixels, while drawWaterSurface only runs on pixels whose `p.water` is non-null. The `_pointColorData` subarray per call (:2355-2362) is real - the exterior hosts call setPointLights with two arguments so `colors` is null at :2321 - but drawMesh and drawCharacter (:1245) mint the same ~100-byte view hundreds of times a frame already, so the water pass adds noise to an established shape.",
    "corrections": "'The host's own comment on the loop asserts the opposite' is a misreading of world.js:7873-7878. 'the water pass added the largest instance of it' is false - drawTerrain is larger by pixel count. The finder's own needsAGl block concedes the cost is unmeasured; with no law and no measurement this is a suggestion, not a finding.",
    "fixShape": "No lane. A begin/draw split is a legitimate future optimisation but it must be measured first (renderer.stats on a real coastal frame) and it should be done for drawTerrain and drawWaterSurface together or not at all, since they are the same convention.",
    "severity": "none",
    "laneKey": "src/render/renderer.js"
  },
  {
    "id": "RS-6",
    "upheld": false,
    "confidence": "high",
    "reasoning": "Every cited site is real but every one is ONCE PER FRAME, not per draw, so the total is roughly eight small objects a frame. src/render/enhancedSky.js:803-804 and :811-818 run from setState once a frame; src/render/volumetricClouds.js:437 and :440 likewise; the `get shadow` object at :485-488 is read exactly twice in the tree, src/scenes/shared.js:538 and :555, each once a frame; src/render/waterSurface.js:198-211 is called once per host frame (world.js:7880, exterior.js:4201); the renderer.js:1080 spread once per host frame (world.js:7749, exterior.js:4032). EV2's recorded target was two Float32Array(16)s per model per frame, three orders of magnitude away from this, and nothing in the tree forbids a per-frame literal.",
    "corrections": "The finder's own premise refutes the fix: shared.js:538/:555 Object.assign INTO the stable per-frame deck precisely so `sky.cloudShadow` keeps one identity across a frame, which is what makes the per-pixel setCloudShadow at world.js:7816 a no-op. Replacing that working identity contract with a `gen` counter is churn against a seam whose stamp discipline is already pinned (test/enhancedSky.test.js:501) - and it would have to be got exactly right in the presence of the lensLocal borrow at renderer.js:1379/:1384 and the studio borrow at :1423/:1436.",
    "fixShape": "No lane. Do not introduce the `gen` counter: it trades a correct identity contract for a second source of truth in the same seam RS-3 already shows is fragile.",
    "severity": "none",
    "laneKey": "src/render/enhancedSky.js"
  },
  {
    "id": "RS-7",
    "upheld": false,
    "confidence": "high",
    "reasoning": "The allocation inventory checks out (src/render/volumetricClouds.js:376-395, src/render/cloudNoise.js:145-163, no dispose/destroy/free in either file), but the 17e law the finder cites qualifies itself: 'that teardown must be reachable from the path that ends the object's life.' I settled the open question the finder left in its own needsAGl block. createSkyController is called exactly twice in the tree, at src/scenes/world.js:500 and src/scenes/exterior.js:327, both at host mount; the only exit-to-title path is src/scenes/shared.js:1708-1711 `exitToTitleMenu`, which does `location.href = location.pathname` - a full page navigation - and endRunToTitleMenu at :1544-1557 ends in that same call. The lab's second construction site guards with `??=` (src/tools/skyLab.js:88, :111). So a host boot is a page load, the GL context dies with it, and no second set can ever accumulate in one page life.",
    "corrections": "'every host boot that builds a controller adds another set' is false - a host boot IS a page load. The severity was therefore inflated on an assumption the finder flagged as unverified and could have settled from source in two greps.",
    "fixShape": "No lane. If multiplayer or an in-page scene switch ever lands a host remount without navigation, this becomes real on that day - the right place for that is a note in the remount slice, not a dispose() written now against a path that does not exist.",
    "severity": "none",
    "laneKey": "src/render/volumetricClouds.js"
  },
  {
    "id": "RS-8",
    "upheld": false,
    "confidence": "high",
    "reasoning": "The finder refutes itself in its own claim field ('nothing is wrong today; this is a trap, not a live bug'), and I reproduced the sweep that makes it inert: every `gl.enable(gl.BLEND)` in src/ - precipitation.js:488/:530/:568, renderer.js:1702/:2285/:2676/:2745/:2855, labGrass.js:509, overworldRenderer.js:429/:445 - is followed within one line by a `gl.blendFunc`, which overwrites the RGB and alpha factors the separate func at volumetricClouds.js:568 left. The asymmetry framing is also wrong in kind: `gl.disable(gl.BLEND)` on entry is not a save, it is the pass forcing the tree's baseline (renderer.js:2128 states that baseline), so leaving BLEND off on exit is the correct end state, not a missing restore.",
    "corrections": "One of the four cited pairs is misquoted. src/render/cloudNoise.js:189 (drawSlice) reads `gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);` - it never touches BLEND, so its :189/:198 pair is already symmetric and there are three pairs, not four.",
    "fixShape": "No lane on its own. If the VC file is opened for RS-3 or RS-9, adding `gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);` after the `gl.disable(gl.BLEND)` at src/render/volumetricClouds.js:577 is a one-line courtesy; do not touch the three disable/enable pairs, they are correct as they stand.",
    "severity": "info",
    "laneKey": "src/render/volumetricClouds.js"
  },
  {
    "id": "RS-9",
    "upheld": false,
    "confidence": "high",
    "reasoning": "The facts are exactly as claimed - src/render/volumetricClouds.js:257 `for (int i = 0; i < 96; i++) { if (i >= uSteps) break;` and :230 `for (int i = 0; i < 8; i++) { if (i >= uLightSteps) break;` against QUALITY at :64-68 where hi.steps = 80 and hi.light = 6, while the shadow march's twin at :301/:305 is pinned at test/volumetricClouds.test.js:132-133 and test/volumetricClouds.test.js:61 pins only the ordering of `.steps`. But there is no defect at HEAD: every tier is inside both ceilings, QUALITY is Object.freeze'd with three literal tiers, and this lens is render-state, not pins - the brief's bar is a real defect with an observable consequence, and a ceiling nobody has crossed has none.",
    "corrections": "'Raising a tier past either ceiling does not error' is true but hypothetical; the finder presents a missing pin as a render-state finding. The interpolation precedent it cites is real (:175-179 interpolate EXT and the four period constants from JS), which makes the hardening cheap - but cheap is not the same as a finding.",
    "fixShape": "Cheap hardening, fold into whichever lane opens volumetricClouds.js: export `MARCH_MAX_STEPS = 96` and `LIGHT_MAX_STEPS = 8`, interpolate them into MARCH_FS at :230 and :257 the way EXT is at :175, and add `for (const q of Object.values(QUALITY)) { assert.ok(q.steps <= MARCH_MAX_STEPS); assert.ok(q.light <= LIGHT_MAX_STEPS); }` next to the shadowSteps pin at test/volumetricClouds.test.js:133. Mutation-check it by setting hi.steps = 128.",
    "severity": "info",
    "laneKey": "src/render/volumetricClouds.js"
  },
  {
    "id": "RS-10",
    "upheld": true,
    "confidence": "high",
    "reasoning": "I re-read the depth/blend contract from the shaders and the draw functions as asked, and it settles WITHOUT a GL run. All three sky lanes draw a full-screen triangle with `gl.depthMask(false); gl.disable(gl.DEPTH_TEST)` and an opaque write: enhancedSky.js:828-829 with `outColor = vec4(out3, 1.0)` at :748, dynamicSkiesRenderer.js:798-799, skyRenderer.js:270-271 - and alpha 1.0 means the write lands whatever the blend state, so the sky repaints every pixel of the body drawn at exterior.js:4028 before it at :4032. Worse than the finder says: drawCharacterSpriteQuad (renderer.js:1451-1531) changes neither depthMask nor DEPTH_TEST, so the body's alpha-cut silhouette WRITES depth against the buffer beginFrame cleared at :1950, and the sky does not overwrite that depth - so drawTerrain at :4039 and everything after it fail the LESS test inside the silhouette and the player sees a body-shaped sky-coloured hole in the world, not merely a missing body. world.js has the correct order (sky :7749, markForeignPass :7781, setCloudShadow :7783, body :7784), and src/player/mwView.js:78-79's own docstring says the body is 'the third-person body composite, after the host's world draw'.",
    "corrections": "'NEEDS A GL RUN to settle which' is wrong - the shader is an opaque full-screen write with no depth test and the quad is depth-writing; source settles it, and a GL probe would only be confirmation. The finding also understates the damage by describing it as the body being 'painted out'; the depth silhouette makes it a hole in the terrain. Note also that this ordering is what makes RS-3's unit-7 collision live in this host rather than latent.",
    "fixShape": "src/scenes/exterior.js: delete :4027 and :4028 and re-insert them, in that order, directly after the block that closes at :4034, merging with the existing `renderer.setCloudShadow(sky?.cloudShadow ?? null);` at :4038 so the run reads markForeignPass -> the EE5 comment -> setCloudShadow -> mwViewDrawBody -> drawTerrain, byte-for-byte world.js's shape at :7781-7784. Two existing pins constrain this and both stay green under that exact shape: test/volumetricClouds.test.js:145 requires setCloudShadow's line to be immediately followed by `mwViewDrawBody(`, and test/enhancedSky.test.js:519 requires drawTerrain within 400 chars of setCloudShadow. Update :4027's comment ('for the body and everything before the terrain') since the body is no longer before the sky, and add the ordering sweep in the audit18_hosts_outer idiom: in each exterior host, index of `mwViewDrawBody(` > index of the `markForeignPass()` that follows `sky.draw(`. Do not touch world.js, and do not add or remove a markForeignPass call - test/glstate.test.js:116 pins the counts at 3 and 2.",
    "severity": "medium",
    "laneKey": "src/scenes/exterior.js"
  },
  {
    "id": "RS-11",
    "upheld": false,
    "confidence": "high",
    "reasoning": "Both halves are real and both are immaterial, which the finder concedes ('Neither is a correctness bug in the current order'). The upload at src/render/volumetricClouds.js:461-464 fires only when `pendingShift` is set at :511, i.e. once per shadowOrigin change, and shadowOrigin (:150-152) snaps to the 819.2 m pixel grid - so it is 16x256x4 = 16 KB at the default tier per 819.2 m travelled, roughly a minute of walking, not a per-frame cost. The unbind is provably harmless: the active unit at that point is TEXTURE0 on every path (beginFrame ends with `gl.activeTexture(gl.TEXTURE0)` at renderer.js:1981, dynamicSkiesRenderer.js:830 restores it, drawCharacterSpriteQuad leaves it at :1519, and _uploadCloudShadow restores it at :2618), and unit 0's TEXTURE_2D slot conflicts with nothing - _fieldUniforms binds TEXTURE_3D there at :492.",
    "corrections": "'262 KB per crossing' is the hi tier only; the shipping default is 256, so 16 KB. 'a texture upload on the hot path' overstates a once-per-819-metres event. The scissored-clear alternative in the proposed fix is not free either - the renderer keeps a JS shadow of the clear colour (renderer.js:1036, :1907-1911) and :378-380 records that these targets are born all-light by UPLOAD precisely so nothing has to clear here.",
    "fixShape": "No lane. If volumetricClouds.js is opened for RS-3 or RS-9, prefix src/render/volumetricClouds.js:461 with `gl.activeTexture(gl.TEXTURE0);` as a one-line statement of intent. Do NOT take the scissored-clear suggestion - it re-opens the clear-colour shadow the file's own :378-380 comment was written to avoid.",
    "severity": "info",
    "laneKey": "src/render/volumetricClouds.js"
  }
]
```