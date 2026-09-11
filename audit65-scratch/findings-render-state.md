I've read the delta's render lane. Here are my findings.

```json
[
  {
    "id": "RS-1",
    "lens": "render-state",
    "title": "renderTarget.js's draw paths restore nothing on a throw - the module's own contract sentence is false on that path",
    "severity": "medium",
    "files": ["src/render/renderTarget.js", "src/render/volumetricClouds.js", "src/render/cloudNoise.js", "src/render/renderer.js"],
    "claim": "`withTarget` (renderTarget.js:59-66), `withVolumeLayer` (:71-76) and `finishVolume` (:80-86) call the caller's `draw()` (or a loop of them) with no try/finally. If anything inside throws, the framebuffer stays bound to the offscreen target and the viewport stays at the target's size, so the whole rest of the frame - terrain, flats, water, HUD - renders into the 1024x1024 shadow map or the 128^3 volume layer, on a canvas that shows the last good frame. The module's docstring asserts the opposite: renderTarget.js:12-14 says every draw path here 'leaves the default framebuffer bound and the viewport as the caller asked when it returns.'",
    "evidence": "src/render/renderTarget.js:59-66 `export function withTarget(gl, target, restoreViewport, draw) { gl.bindFramebuffer(...); ...; gl.viewport(0,0,target.width,target.height); draw(); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(restoreViewport[0], ...); }` - no finally. Callers that can throw inside the closure: src/render/volumetricClouds.js:525-528 and :544-547 (the two stripe marches), src/render/cloudNoise.js:172-177 (160 layer draws through withVolumeLayer, then finishVolume at :179). The tree already knows this law and states it one file over: src/render/renderer.js:2139-2142 - 'The ONLY sanctioned way to run a panel pass: the return happens in a `finally`, so a throw inside the body cannot leave the session's one shared renderer holding a scissor (which silently blanks the next host frame's clear rather than erroring).'",
    "proposedFix": "Wrap the body of `withTarget` in try/finally with the two restore calls in the finally; same for `finishVolume`'s bindFramebuffer/viewport pair, and give `withVolumeLayer`'s caller (`CloudNoise._fill`) a try/finally around the layer loop so `finishVolume` always runs.",
    "pinShape": "Proxy-GL: call `withTarget(gl, t, [0,0,W,H], () => { throw new Error('x'); })` inside assert.throws, then assert the last `bindFramebuffer(FRAMEBUFFER, ...)` argument recorded is null and the last `viewport` recorded is [0,0,W,H]. Mutation-check: deleting the finally must fail it."
  },
  {
    "id": "RS-2",
    "lens": "render-state",
    "title": "renderCharacterSprite's new try/finally guards the JS caches and leaves the GL state - the FBO, the viewport and the clear colour - outside it",
    "severity": "medium",
    "files": ["src/render/renderer.js"],
    "claim": "VC5's review added a try/finally around `drawCharacter` in `renderCharacterSprite`, but it covers only `_proj`/`_view`/`_fogMode`/`_cloudShadow`. The three GL restores that follow - unbinding the 512x512 sprite framebuffer, `_restoreWorldViewport()`, and putting the clear colour back from the `_clearColor` shadow - sit AFTER the try and do not run on a throw. That leaves exactly the three leaks the comments immediately above them document as shipped bugs (AUDIT 26 F034 for the clear colour, ROAD-E E5 for the viewport), plus an offscreen framebuffer bound for the rest of the frame. It also makes the `_clearColor` JS shadow a lie, which EV6 (renderer.js:1031-1036) exists to prevent.",
    "evidence": "src/render/renderer.js:1377-1386: `const sd = lensLocal ? this._cloudShadow : null; if (sd) {...} this._proj = proj; ...; try { this.drawCharacter(mesh, modelMatrix); } finally { this._proj = sp; this._view = sv; this._fogMode = sf; if (sd) {...} }` then OUTSIDE the finally at :1387 `gl.bindFramebuffer(gl.FRAMEBUFFER, null);`, :1395 `this._restoreWorldViewport();`, :1396-1397 `const cc = this._clearColor; gl.clearColor(cc[0], cc[1], cc[2], cc[3]);`. The FBO/viewport/clearColor were set at :1338-1339 and :1352-1357. Contrast src/render/renderer.js:2139-2142's panelFrame doctrine, and src/render/renderer.js:1429-1437 where renderCharacterSpriteImage does put its whole restore in a finally.",
    "proposedFix": "Move `gl.bindFramebuffer(gl.FRAMEBUFFER, null)`, `this._restoreWorldViewport()` and the clearColor restore into the same finally block, above the existing JS-cache restores.",
    "pinShape": "Proxy-GL: stub `drawCharacter` to throw, call `renderCharacterSprite` inside assert.throws, then assert the recorded call log ends with `bindFramebuffer(FRAMEBUFFER,null)`, a `viewport` equal to the world rect, and `clearColor` equal to `renderer._clearColor`."
  },
  {
    "id": "RS-3",
    "lens": "render-state",
    "title": "The cloud-shadow map lives on texture unit 7, which the Dynamic Skies pass also writes (_MoonTex = slot 7), and the per-program stamp cache is not invalidated by markForeignPass",
    "severity": "medium",
    "files": ["src/render/renderer.js", "src/render/dynamicSkiesRenderer.js", "src/systems/dynamicSkies.js", "src/scenes/exterior.js", "src/scenes/world.js"],
    "claim": "`_uploadCloudShadow` binds the shadow map to TEXTURE7 and then refuses to rebind it while `_csUploaded[key] === _csStamp`. Under DS2 (Dynamic Skies + volumetric clouds, both live in the same frame - shared.js:536-539 assigns `clouds.shadow` into `dynamicDeck`), the mod's own pass walks nine texture slots as `TEXTURE0 + i`, so `_MoonTex` lands on unit 7 and `_SecundaTex` on unit 8, clobbering the shadow map for every program that has already uploaded at this stamp. `markForeignPass()` - the seam both hosts call right after the sky - resets `_lastProgram`/`_lastVao` and NOT `_csUploaded`, so the renderer has no way to know unit 7 moved. Today it self-heals only because in both hosts the first draw after the sky is `drawTerrain`, whose key ('terrain') has not uploaded yet this stamp and so rebinds unit 7 for everyone. That is luck in the pass order, not a rule: reorder anything after the sky mark, or add a draw whose program key already uploaded, and the ground samples the moon texture as its cloud transmittance.",
    "evidence": "src/render/renderer.js:2607-2618 `_uploadCloudShadow(key) { const loc = this._csLoc?.[key]; if (!loc || this._csUploaded[key] === this._csStamp) return; ... gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, cs?.map ?? this._blackTex); gl.uniform1i(mapLoc, 7); ... }`. src/render/dynamicSkiesRenderer.js:822-829 `for (let i = 0; i < TEXTURE_SLOTS.length; i++) { ... gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, ...); gl.uniform1i(u[slot], i); }` over src/systems/dynamicSkies.js:432-435's NINE slots, `_MoonTex` at index 7. src/render/renderer.js:1125-1129 `markForeignPass() { this.gl.bindVertexArray(null); this._lastProgram = null; this._lastVao = null; }` - `_csUploaded` untouched. The order that saves it: src/scenes/exterior.js:4032 sky.draw -> :4033 markForeignPass -> :4039 drawTerrain; src/scenes/world.js:7749 sky.draw -> :7781 markForeignPass -> :7817 drawTerrain.",
    "proposedFix": "Either (a) reserve unit 7 by moving the mod's slot loop to a base above the reserved units (e.g. `TEXTURE0 + i` where the renderer publishes a `FIRST_FREE_UNIT`), or (b) make `markForeignPass()` also do `this._csUploaded = {}` - a foreign pass may have moved any unit, which is exactly what that method already means for programs and VAOs.",
    "pinShape": "Proxy-GL: count texture-unit writes. Assert `renderer.markForeignPass()` empties `_csUploaded` (or: after a simulated foreign bind to unit 7, the next drawMesh re-issues `activeTexture(TEXTURE7)` + `bindTexture`). Separately, a pure test: `assert.ok(TEXTURE_SLOTS.length <= CLOUD_SHADOW_UNIT)` so the two files can never overlap again."
  },
  {
    "id": "RS-4",
    "lens": "render-state",
    "title": "MAC1's far-flat gate mints an options object per batch per pixel per frame - inside the loop the slice was written to make cheaper",
    "severity": "medium",
    "files": ["src/scenes/world.js", "src/world/flatDistance.js"],
    "claim": "The MAC1 fix that skips small far flats builds a fresh `{ ring, height, animated }` literal for EVERY batch of EVERY streamed pixel, every frame, and hands it to a destructuring signature with a default. With TerrainDistance 3 that is 49 pixels' worth of batches per frame - on the order of a thousand short-lived objects a frame at 60 Hz - added to the hot path by a slice whose stated purpose is FPS. EV2's law for this loop is 'one scratch, refilled - not three allocations a frame' (world.js:7872, the camRight scratch, four lines below). Positional arguments cost nothing and pin identically.",
    "evidence": "src/scenes/world.js:7863-7869: `const ring = Math.max(...); for (const b of p.batches) { if (!pixelVisible || (cullOn && aabbOutside(...))) continue; if (!farFlatVisible({ ring, height: b.size?.h ?? 0, animated: b.frame != null })) continue;   // MAC1\\n b.origin = t; allBatches.push(b); }`. Signature: src/world/flatDistance.js:46 `export function farFlatVisible({ ring, height, animated = false }) {`. The EV2 sentence it sits under: src/scenes/world.js:7871-7872 `_camRight[0] = ...; const camRight = _camRight;   // EV2: one scratch, refilled - not three allocations a frame`. Note the shape is currently source-pinned verbatim by test/mac1_playreport.test.js:118, so the pin must move with the fix.",
    "proposedFix": "Change `farFlatVisible(ring, height, animated)` to positional args (keep the same three inputs and the same body), update the one call site and the source-shape regex in test/mac1_playreport.test.js:118.",
    "pinShape": "Node, no GL: a counting harness that wraps `farFlatVisible` and asserts the exported arity is 3 (not 1), plus a source-sweep on world.js's flat walk asserting no `{` follows `farFlatVisible(`. A heap-delta pin over 1000 calls is the stronger form if the suite has one."
  },
  {
    "id": "RS-5",
    "lens": "render-state",
    "title": "drawWaterSurface re-uploads ~28 pass-constant uniforms - two mat4s, the sixteen point lights and the whole light/sky/water block - once per water pixel, against a comment that says 'One uniform set a frame'",
    "severity": "low",
    "files": ["src/render/renderer.js", "src/scenes/world.js"],
    "claim": "Everything in `drawWaterSurface` except `uModel`, `uTileSize`, `uTileDim`, `uTileArr` and `uTilemap` is constant across the whole water pass: proj, view, lift, time, windDir, windStrength, rain, scroll, zenith, horizon, tint, opacity, f0, shoreSoft, the fog block, lightDir, ambient, sunScale, sunColor, moonDir, moonScale, moonColor, pointCount, pointLights, pointColors, indirect, indirectColor. world.js draws one of these per water-carrying streamed pixel (up to 49), so a coastal frame issues ~1300 uniform calls that could be ~130, plus one `_pointColorData(count)` `subarray` view allocated per pixel. The host's own comment on the loop asserts the opposite - 'One uniform set a frame' - so the intent is already the split.",
    "evidence": "src/render/renderer.js:2700-2737 (the whole uniform block, unconditional), :2735 `if (count > 0) gl.uniform3fv(L.pointColors, this._pointColorData(count));` with `_pointColorData` at :2355-2362 returning `s.subarray(0, count * 3)` - a fresh view per call. The pass loop and its claim: src/scenes/world.js:7873-7885, `// ... One uniform set a frame: the clock, the eased wind ... and the dome's own two colours to reflect.` then `for (const p of built.values()) { if (!p._visible || !p.water) continue; renderer.drawWaterSurface(...); }`. drawTerrain (:2624-2651) has the same shape, so this is the tree's convention, not a regression - but the water pass added the largest instance of it.",
    "proposedFix": "Split into `beginWaterPass(u)` (program bind, cloud shadow, fog, lights, sky, water constants, proj/view) and `drawWaterSurface(surface, modelMatrix, arrayTex, tilemapTex, tileSize, tileDim)` for the per-pixel five; both hosts call begin once. Keep the state bracket where it is.",
    "pinShape": "Proxy-GL counting: draw N=8 water surfaces in one pass and assert the recorded `uniform*` call count is `perPass + N * perDraw` with perDraw <= 6, and that `uniformMatrix4fv` is called exactly 2 + N times (proj, view, then N models)."
  },
  {
    "id": "RS-6",
    "lens": "render-state",
    "title": "The deck-and-water chain mints five short-lived objects/arrays per frame on the render path",
    "severity": "low",
    "files": ["src/render/enhancedSky.js", "src/render/volumetricClouds.js", "src/render/renderer.js", "src/render/waterSurface.js", "src/scenes/shared.js"],
    "claim": "Per exterior frame the delta adds: a fresh `cloudShadow` object plus two `Float32Array`s in `EnhancedSkyRenderer.setState`; a fresh `{map, rect:[...]}` (two objects) from `VolumetricClouds.get shadow`; a fresh `this.drift = [...]` and a fresh `shadowOrigin(...)` array in `setState`; a fresh `waterUniforms()` object plus its `windDir` array; and a fresh array from the `worldViewportPx` getter's spread (plus the `?? [0,0,w,h]` literal at each host call site). None is large, and the deck's per-frame identity is load-bearing for `setCloudShadow`'s `d !== this._cloudShadow` stamp - but the honest fix is a stamp counter rather than object identity, which then lets every one of these be a refilled scratch.",
    "evidence": "src/render/enhancedSky.js:803-804 `this.clearColor = new Float32Array(state.clearColor); this.fillColor = new Float32Array(state.fillColor);` and :811-819 `this.cloudShadow = { cover: ..., wind: ..., drift: ..., amount: 0.62 };`. src/render/volumetricClouds.js:485-488 `get shadow() { ... return { map: this.shadowMap.tex, rect: [this.mapOrigin[0], this.mapOrigin[1], 1 / SHADOW_EXTENT, SHADOW_AMOUNT] }; }`, :437 `this.drift = [wrapField(...), wrapField(...)];`, :440 `const o = shadowOrigin(this.cam[0], this.cam[1]);` (src/render/volumetricClouds.js:150-152 returns a new array). src/render/waterSurface.js:198-211 `return { time: t, windDir: [dx, dz], ... }` called at src/scenes/world.js:7880 and src/scenes/exterior.js:4201. src/render/renderer.js:1080 `get worldViewportPx() { return this._worldViewportPx ? [...this._worldViewportPx] : null; }` called at src/scenes/world.js:7749 and src/scenes/exterior.js:4032.",
    "proposedFix": "Give the deck an explicit `gen` counter that `setCloudShadow` compares instead of object identity, then make each of the six sites refill a module-owned scratch: `_deck`, `_shadowOut`/`_rect`, `_drift`, `_origin`, `_waterU`/`_windDir`, and a `worldViewportInto(out)` reader beside the getter.",
    "pinShape": "Node: call the producer twice and assert the second call returns the SAME object/array identity (`assert.strictEqual(a, b)`) with refilled values, for each of `sky.cloudShadow`, `clouds.shadow`, `waterUniforms(...)`. Plus a stamp test: two `setCloudShadow` calls with the same object but a bumped `gen` must move `_csStamp`."
  },
  {
    "id": "RS-7",
    "lens": "render-state",
    "title": "VolumetricClouds and CloudNoise have no teardown - ~20 MB of GPU objects and a 4 MB JS buffer with no owner",
    "severity": "medium",
    "files": ["src/render/volumetricClouds.js", "src/render/cloudNoise.js", "src/scenes/shared.js"],
    "claim": "The arc allocates, per instance: two 3D volumes (128^3 and 32^3 RGBA, ~8.1 MB) each with a framebuffer, three RGBA8 render targets each with a framebuffer (the sky map up to 2048x512, two shadow maps up to 1024x1024 - ~12 MB at `hi`), seven linked programs, two VAOs, two array buffers, and `this.white`, a `Uint8Array(shadow*shadow*4)` kept alive for the crossing blits (4 MB at `hi`). Neither class has a `dispose`/`destroy`, and `createSkyController` returns no teardown for them, so every host boot that builds a controller adds another set. AUDIT 17e's law is 'EVERY ALLOCATION HAS AN OWNER ... every createBillboardBatch / uploadTexture needs a matching free in the owning module's teardown, and that teardown must be reachable from the path that ends the object's life.' The older sky renderers leak the same way, so this is the tree's existing shape - but VC is a step change in size.",
    "evidence": "src/render/volumetricClouds.js:373-416 (constructor: `createVolume` x2 via CloudNoise, `createRenderTarget` x3 at :377/:382/:383, `this.white = new Uint8Array(this.q.shadow * this.q.shadow * 4).fill(255)` at :381, `link()` x4 at :392-395, VAO + buffer at :384-391); src/render/cloudNoise.js:143-164 (VAO + buffer + 3 programs + 2 volumes). No `dispose`, `destroy` or `free` in either file. Construction site: src/scenes/shared.js:209-210 `const clouds = enhancedLane && cloudsDoor !== 'off' ? new VolumetricClouds(gl, ..., [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]) : null;` - `createSkyController` (src/scenes/shared.js:163) exposes no teardown at all.",
    "proposedFix": "Add `dispose()` to both classes (deleteTexture / deleteFramebuffer / deleteProgram / deleteVertexArray / deleteBuffer, and null `this.white`), expose a `dispose()` on the object `createSkyController` returns that calls it plus the sky renderers', and call it from the hosts' teardown path.",
    "pinShape": "Proxy-GL: build a VolumetricClouds against a counting stub, call dispose(), and assert deleteTexture/deleteFramebuffer counts equal the createTexture/createFramebuffer counts, and deleteProgram equals the link count. Plus a source-sweep that `createSkyController`'s returned object has a `dispose` key."
  },
  {
    "id": "RS-8",
    "lens": "render-state",
    "title": "The cloud passes disable BLEND and never re-enable it, and the composite leaves blendFuncSeparate(ONE, SRC_ALPHA, ZERO, ONE) standing as the frame's blend func",
    "severity": "low",
    "files": ["src/render/volumetricClouds.js", "src/render/cloudNoise.js"],
    "claim": "Four cloud draw paths disable BLEND on entry and restore only depthMask/DEPTH_TEST/CULL_FACE on exit, so the restore is asymmetric with the save. Separately, the composite is the only pass in the tree that uses `blendFuncSeparate`, and it leaves those four factors as the standing GL blend function - anything that later did `gl.enable(gl.BLEND)` without its own func would inherit 'sky * T + cloud'. I swept every `enable(gl.BLEND)` in src/ and each is immediately followed by a `blendFunc` (which overwrites both RGB and alpha factors), so nothing is wrong today; this is a trap, not a live bug, and the trap is a new one - before VC nothing in the tree touched blendFuncSeparate.",
    "evidence": "src/render/volumetricClouds.js:509 `gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);` vs :557 `gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);` - no BLEND. Same pair at :586 / :592 (drawShadowView), and src/render/cloudNoise.js:169 / :180 (_fill) and :189 / :198 (drawSlice). The func: src/render/volumetricClouds.js:568 `gl.blendFuncSeparate(gl.ONE, gl.SRC_ALPHA, gl.ZERO, gl.ONE);` with only `gl.disable(gl.BLEND)` at :577 to close it. The sweep that keeps it benign: every `enable(gl.BLEND)` in src/render/{precipitation,renderer,labGrass,overworldRenderer}.js is on the same line as, or one line above, a `gl.blendFunc(...)`.",
    "proposedFix": "Have `draw()` restore `gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)` after disabling BLEND (the tree's baseline), and make the four disable/enable BLEND pairs symmetric.",
    "pinShape": "Proxy-GL: record the func state; after `clouds.draw(...)` assert the last blend-func call is the renderer's baseline pair, and assert every pass's entry/exit disable/enable sets are equal as multisets."
  },
  {
    "id": "RS-9",
    "lens": "render-state",
    "title": "Two unpinned shader/JS constant twins in the cloud march: the hard loop ceilings 96 and 8 against QUALITY.steps and QUALITY.light",
    "severity": "medium",
    "files": ["src/render/volumetricClouds.js", "test/volumetricClouds.test.js"],
    "claim": "GLSL ES 300 needs constant loop bounds, so both marches are written as `for (int i = 0; i < CONST; i++) { if (i >= uSteps) break; }`. The shadow march's ceiling of 24 IS pinned against `QUALITY.*.shadowSteps` (the shader even clamps with `min(24, ...)` and the test asserts the range). The other two are not: the sky march's outer loop caps at 96 and its light march at 8, and nothing anywhere asserts `QUALITY.*.steps <= 96` or `QUALITY.*.light <= 8`. Raising a tier past either ceiling does not error - the march silently truncates and the sky quietly gets thinner, which is the class of failure VC3/VC5 pinned the third program for.",
    "evidence": "src/render/volumetricClouds.js:250 `for (int i = 0; i < 96; i++) { if (i >= uSteps) break;` against QUALITY at :64-68 (`hi.steps = 80`); :231-233 `float ds = (uTop - uBase) / float(uLightSteps) * 0.5; for (int i = 0; i < 8; i++) { if (i >= uLightSteps) break;` against `hi.light = 6`. The pinned sibling: src/render/volumetricClouds.js:299-300 `int steps = min(24, max(uSteps, int(ceil((t1 - t0) / 150.0)))); ... for (int i = 0; i < 24; i++)`, pinned at test/volumetricClouds.test.js:132-133 (`assert.match(SHADOW_FS, /int steps = min\\(24, .../)` and `for (const q of Object.values(QUALITY)) assert.ok(q.shadowSteps >= 8 && q.shadowSteps <= 24, ...)`). test/volumetricClouds.test.js:61 pins only the ORDER of `.steps`, never a ceiling, and `light` appears nowhere in the file.",
    "proposedFix": "Interpolate the ceilings from JS the way EXTINCTION and the four period constants already are (`for (int i = 0; i < ${MARCH_MAX_STEPS}; i++)`), export them, and add `for (const q of Object.values(QUALITY)) { assert.ok(q.steps <= MARCH_MAX_STEPS); assert.ok(q.light <= LIGHT_MAX_STEPS); }` beside the shadowSteps pin.",
    "pinShape": "Pure node, no GL: parse the two literals out of MARCH_FS with a regex and assert every QUALITY tier's `steps`/`light` is <= them. Mutation check: setting `hi.steps = 128` must fail it."
  },
  {
    "id": "RS-10",
    "lens": "render-state",
    "title": "The two exterior hosts disagree on where the third-person body sits in the pass order - exterior.js draws it BEFORE a sky pass that paints every pixel",
    "severity": "medium",
    "files": ["src/scenes/exterior.js", "src/scenes/world.js", "src/render/enhancedSky.js", "src/render/dynamicSkiesRenderer.js"],
    "claim": "world.js draws the sky (and the far ring), marks the foreign pass, installs the deck, and THEN draws the player's body. exterior.js installs the deck, draws the body, and THEN draws the sky. Both enhanced sky passes run with DEPTH_TEST disabled, depthMask off, blending off, and write an opaque full-screen colour - so in exterior.js the third-person body is painted out by the dome every frame. The delta did not create the ordering, but it put `renderer.setCloudShadow(...)` directly above the body call with the comment 'for the body and everything before the terrain', which asserts the body is a live draw at that point. I cannot run GL here, so I cannot confirm the body is visibly missing under `?exterior` - but the two hosts cannot both be right, and world.js is the one that matches the depth contract.",
    "evidence": "src/scenes/exterior.js:4026-4034: `renderer.beginFrame(...)` / :4027 `renderer.setCloudShadow(sky?.cloudShadow ?? null);   // VC4: the frame's deck, for the body and everything before the terrain` / :4028 `mwViewDrawBody(canvas, { proj, view, eye, feet: player.pos, yaw: cam.yaw });   // MW-D24` / :4032 `sky.draw(...)` / :4033 `renderer.markForeignPass();`. Against src/scenes/world.js:7748 `renderer.beginFrame(...)` / :7749 `sky.draw(...)` / :7781 `renderer.markForeignPass();` / :7783 `renderer.setCloudShadow(...)` / :7784 `mwViewDrawBody(...)`. The sky's contract: src/render/enhancedSky.js:827-829 `gl.useProgram(this.program); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);` with an opaque write at :748 `outColor = vec4(out3, 1.0);` and no BLEND; src/render/dynamicSkiesRenderer.js:798 + the FS's `outColor = vec4(enc, 1.0);`. The body does draw when third person is on: src/player/mwView.js:81-84 `if (!mwCamera.thirdPerson()) return false; return fpArm.drawThird(...)`.",
    "proposedFix": "Move exterior.js's `mwViewDrawBody` call to after the `markForeignPass()` at :4033, matching world.js, and keep the `setCloudShadow` immediately before it. If a GL run shows the body IS visible today (i.e. drawThird composites later than I read), the finding reduces to naming the divergence in a comment. NEEDS A GL RUN to settle which.",
    "pinShape": "Source-sweep both hosts (the audit18_hosts_outer.test.js idiom): assert in each exterior host that the index of `mwViewDrawBody(` is greater than the index of `markForeignPass()` that follows `sky.draw(`. A GL probe would be: `?exterior` in third person, frame-synced on `__frame`, read the pixel at the body's projected centre against the sky colour."
  },
  {
    "id": "RS-11",
    "lens": "render-state",
    "title": "The shadow map's pixel-crossing blit does a texSubImage2D upload inside a frame, and clobbers the active unit's TEXTURE_2D binding to do it",
    "severity": "low",
    "files": ["src/render/volumetricClouds.js"],
    "claim": "`_shiftShadowMap` runs from `update()`, i.e. inside the frame, and refills the uncovered strips with a `texSubImage2D` upload rather than a clear or a draw - up to `shadow/16` texels wide at full height, which at the `hi` tier is 64 x 1024 x 4 = 262 KB per crossing (a crossing every 819.2 m of travel). It also binds `dst.tex` to whatever unit is currently active and then binds NULL there, so it destroys the caller's unit-0 binding as a side effect. Neither is a correctness bug in the current order (the strip logic is exactly complementary to the blit's covered rect, and the next pass rebinds unit 0), but a texture upload on the hot path is the shape the lens asks for, and the unbind is a leak with no note.",
    "evidence": "src/render/volumetricClouds.js:455-475, called from :511 `if (this.pendingShift) this._shiftShadowMap(this.pendingShift[0], this.pendingShift[1], viewport);` inside `update()`. The uploads: :461-464 `gl.bindTexture(gl.TEXTURE_2D, dst.tex); if (dx !== 0) gl.texSubImage2D(...this.white.subarray(0, Math.abs(dx) * n * 4)); if (dz !== 0) gl.texSubImage2D(...); gl.bindTexture(gl.TEXTURE_2D, null);` - no `activeTexture` before either bind, so it acts on whatever unit the last pass left active. The strip geometry itself checks out against the blit's rect at :468-469.",
    "proposedFix": "Precede the pair with `gl.activeTexture(gl.TEXTURE0)` and drop the `bindTexture(null)` (or restore what was there); optionally replace the strip upload with a scissored clear inside the `withTarget` at :459, which is one GL call instead of two uploads.",
    "pinShape": "Proxy-GL: record `texSubImage2D` calls during `update()`; assert zero on a non-crossing frame and at most two on a crossing frame, and assert every `bindTexture` in `_shiftShadowMap` is preceded by an `activeTexture`."
  }
]
```

**coverage**

```json
{
  "read": [
    "src/render/renderer.js (full delta diff; pass entry points 1228-1530, 1780-1935, 2318-2400, 2530-2875, 2985-3040)",
    "src/render/waterSurface.js (whole)",
    "src/render/volumetricClouds.js (whole)",
    "src/render/renderTarget.js (whole)",
    "src/render/cloudNoise.js (whole)",
    "src/render/dynamicSkiesBridge.js (whole)",
    "src/render/dynamicSkiesRenderer.js (delta + the texture-slot loop 795-838)",
    "src/render/enhancedSky.js (delta + setState/draw 795-861)",
    "src/scenes/shared.js (createSkyController 163-620)",
    "src/scenes/world.js frame 7740-7900 + the water build/teardown 838-852, 1355-1373, the season reskin driver 1505-1542, the seasonal atlas upload 1145-1175",
    "src/scenes/exterior.js frame 4010-4210 + the water gate 670-690",
    "src/world/flatDistance.js, src/world/seasonReskin.js, src/formats/color32Order.js (whole)",
    "src/player/motor.js eyeAt/_smoothEyeFeet + its full delta diff",
    "src/ui/midScreenText.js (whole)",
    "src/systems/dynamicSkies.js TEXTURE_SLOTS, src/scenes/magicCandle.js withPlayerLights",
    "tree-wide greps: every gl.enable(BLEND)/blendFunc, gl.viewport, gl.activeTexture, depthFunc/polygonOffset/depthMask/cullFace/colorMask/scissor, markForeignPass, setCloudShadow, uploadTexture call sites",
    "test/volumetricClouds.test.js, test/water.test.js, test/mac1_playreport.test.js (to separate pinned from unpinned)"
  ],
  "clean": [
    "drawWaterSurface's GL state bracket: BLEND/blendFunc, depthMask, CULL_FACE, POLYGON_OFFSET_FILL and depthFunc are each set and each put back (renderer.js:2745-2775), and the bracket is already source-pinned both ways at test/water.test.js:149-157. polygonOffset(0,-2) and depthFunc are touched by no other pass in the tree, so the residual values are unreachable.",
    "The blendFuncSeparate residue from the cloud composite: every enable(gl.BLEND) in src/ is paired with its own gl.blendFunc, which overwrites both RGB and alpha factors. Latent only (RS-8), not live.",
    "Texture unit discipline apart from unit 7: the delta's passes use 0/1/2/3 and 7 only; unit 7 is written by exactly one door. march()/draw()/drawShadowView() each return the active unit to TEXTURE0 and unbind their 3D/2D samplers.",
    "withTarget's first-draw attach: handled, and _shiftShadowMap explicitly forces the scratch target's attach with an empty withTarget before blitting from it (volumetricClouds.js:459). There is no resize path to verify - every render target and volume is fixed-size at construction, so the attach happens exactly once per target.",
    "The stripe marches' inner gl.viewport override inside withTarget is restored by withTarget's own restore; both hosts pass renderer.worldViewportPx, so a docked large HUD's reduced rect survives the cloud pass.",
    "The cloud-shadow stamp cache is correct across frames: beginFrame nulls the deck and bumps (renderer.js:1918), the host's setCloudShadow bumps again, so each program re-uploads once per frame; the lensLocal and studio borrows bump on both sides.",
    "MAC1's far-flat skip vs allBatches: nothing else in world.js reads allBatches (only :7789, :7868, :7886) and b.origin is read only by drawBillboards' drawOne and the ECV1 blended sort - both of which see only batches that were pushed. b.origin aliases the pixel's own refilled _t scratch, so a skipped batch's stale reference stays live and correct.",
    "The water pass's visibility gate matches EV3's: p._visible is written for every entry of built in the same frame's main loop (world.js:7811) and is the same pixel-level frustum verdict the terrain draw takes.",
    "The upload law across the delta's new doors: both PNG-shaped doors convert once at the door and hand the {colors, width, height} shape (seasonsIliacBayAssets.js:196/:211 via toColor32Order, textureReplacement.js:224 via toColor32), toColor32 builds the Uint8ClampedArray from buffer+byteOffset+byteLength so uploadTexture's asBytes view law holds, and the seasonal atlas keys apart from the classic record (`${record}#season${installedSeason}`), so no upload is a silent cache no-op.",
    "The point-light arrays can never overrun the shaders' [16]: setPointLights subarrays to 16*4 / 16*3 (renderer.js:2318-2322) and withPlayerLights caps at 16 (magicCandle.js:158).",
    "packWaterMask's nibble packing and the shader's waterCorners decode agree bit for bit (word = i>>3, uvec4 = i>>5, component = (i>>3)&3, nibble = (i&7)*4).",
    "The clouds' construction is a draw path run at boot, before any renderer entry point, so it needs no markForeignPass - the comment at shared.js:195-200 states the reason and it holds.",
    "AUDIT 64's HUD lane (midScreenText) adds no GL state: it early-returns on empty text and goes through the shared drawText path."
  ],
  "needsAGl": [
    "RS-10: whether the third-person body is actually painted out under ?exterior. The pass order is unambiguous in the source and enhancedSky's FS is an opaque full-screen write, but confirming it needs a frame-synced pixel read at the body's projected centre - a shot-mode probe on the __frame counter, never a sleep.",
    "RS-3: whether the DS2 unit-7 collision ever shows. It is masked today by drawTerrain being the first post-sky draw; proving the mask holds (or fails) under a reordering needs a real GL context with the mod's textures bound. A Proxy-GL counting test can pin the invariant without one.",
    "RS-5's actual cost: how many water-carrying pixels a real coastal frame draws, and whether the redundant uniform traffic is measurable, needs a running frame with renderer.stats.",
    "RS-1/RS-2: the throw paths are unreachable in normal play; the leak is provable in node with a Proxy-GL stub, but the visible consequence (a frame rendered into the sprite target) would need a GL run to see.",
    "Whether createSkyController is ever called twice in one page life (RS-7's severity turns on it) - that needs the title-menu / new-game path exercised in a browser."
  ]
}
```