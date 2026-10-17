// @ts-check
// HOST-SPLIT (2026-10-15, EG-LOOK - bible/11-Multiplayer/Elite-Gates-Look.md; AUDIT EG V's owed cut, Audit-EG-V.md
// "Still owed": "the circle's cut to a module the host wires"): AN ELITE BREACH'S CIRCLE ON THIS SCREEN - its halls' mesh,
// its band's dress, its waystones, its Ramparts' portcullises, its occluders and THE SWAP, moved verbatim out of
// createWorldModes (scenes/worldModes.js), which constructs it where the code stood and reads its seams. The mode
// machine's `mode`, `dungeonCtx` and `dungeonLoc` are read live through `wm` (they change under it); the renderer and the
// outer host are the host's own, handed once. Every look the Spire's ground grows (EG-LOOK) stands here, never in the host.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { identity } from '../../world/mat4.js';
import { SD_REALM_ARCHIVE } from '../../world/superDungeon/sdRealm.js';
import { realmArt } from '../../world/superDungeon/sdRealmArt.js';
import { isEgHall, buildEgCircleModel, egCircleColliderTris, egCircleLights, egGateParts } from '../../world/eliteGates/egHall.js';
import { egCircleSpecs, egBandOfCircle, egSpecGive, EG_TEXT } from '../../net/eliteGates/egLaw.js';
import { createEgSwap } from './egSwap.js';
import { createEgOccluders } from './egOcclude.js';
import { EG_BAND_RECORDS, egBandArt, egBandArchive } from '../../world/eliteGates/egBandArt.js';
import { egBeatTellDown } from './egSpan.js';
import { buildEgLookModel } from '../../world/eliteGates/egLook.js';
import { createEgGroundLook } from './egGroundLook.js';   // EG-LOOK (Elite-Gates-Look.md sections 3-4): THE RUIN and THE WRECK

/**
 * @param {{ renderer: any, host: any, wm: { readonly mode: string, readonly dungeonCtx: any, readonly dungeonLoc: any } }} deps
 */
export function createEgCircleHost({ renderer, host, wm }) {
  /** EG-PLAY: AN ELITE BREACH'S CIRCLE stood into its built context (world/eliteGates/egHall.js), the Hour's way: the Hour's art
   *  uploaded once a session (the Steps' faces wear it) and the circle's band's own dress beside it (EG-G2 - world/
   *  egBandArt.js, once a breach a band - EG-ZN), the circle's mesh made once a circle
   *  and among the context's draws, its floors and walls on the collider (the spawn lands on its first plate), each
   *  Rampart's portcullis its own draw and a moving bucket (sunk once its door opens - the outer host's word), and the
   *  Redoubt's way home a target the press takes. EG-ZN: the circle's occluders handed to their dither pass with it.
   *  EG-ZP: and the whole circle let go with the context it stands in (egCircleDown). */
  const EG_BUCKET = 'eg:hall';
  let _egMesh = null, _egMeshKey = '', _egArt = false, _egLamps = [], _egLookMesh = null;
  const _egBands = new Set();   // EG-G2: the bands whose dress is up this breach (EG-ZN: freed at its end - egBandsDown)
  /** AUDIT EG V (L6-9): the records of each band's dress up this breach, by band - a band is whole once every one of
   *  EG_BAND_RECORDS is (the swap's worker paints it, and the Court's rest puts it up a record a frame - EG-LOOK: the kit's
   *  records with the ground's) */
  const _egBandRecs = new Map();
  /** @type {Array<{ h: number, gpu: any, T: number[], draw: any }>} */
  let _egGates = [];
  /** EG-LOOK (Elite-Gates-Look.md sections 3-4): THE RUIN (the circle's, a mesh a hall) and THE WRECK (the band's). */
  const ground = createEgGroundLook({ renderer });
  /** EG-ZN (section 11.8): THE OCCLUDERS DITHERED - the circle's rock a camera ray to my body crosses (scenes/eliteGates/egOcclude.js),
   *  over the circle's own mesh and its one draw; EG-LOOK (THE RUIN): and the eye's hall's ruin's tall pieces on the same ray
   *  (scenes/eliteGates/egGroundLook.js occluders - one pass, the circle's seams as they were). */
  const egOcc = ground.occluders(createEgOccluders({ renderer }));
  /** EG-ZN: the circle's draw in the context's list - the one the dither pass hides while it draws the circle itself. */
  let _egDraw = null;
  /** EG-ZN: the circle's draw made and pushed, and the dither pass told (a stand's and a swap's alike). */
  function egCircleDraw(ctx) {
    _egDraw = _egMesh ? { gpu: _egMesh, object: { matrix: identity() } } : null;
    if (_egDraw) ctx.dynamicDraws.push(_egDraw);
    egOcc.stand(_egDraw);
  }
  /** EG-ZP (section 29 - EVERY ALLOCATION HAS AN OWNER: "every exit path ... frees the hall's meshes, colliders, riders"):
   *  THE CIRCLE LET GO from context `ctx` - its mesh, its look's mesh (the waystones) and each Rampart's portcullis freed
   *  from the renderer, their draws taken out of the context's list, and its floors' and walls' bucket and each portcullis's
   *  moving one off its collider. Every slot is emptied first and the dither pass told next (it lets the circle's views go
   *  before the mesh under them is freed); the meshes go last, so a second call frees nothing twice. THE SWAP lets the old
   *  circle go through it, and the context's own end runs it - the stand hands it to the context (dungeonContext.js
   *  addTeardown), so the way home, the tear, a fall's walk out, forsaking, a void, a load or a teleport out, an abandoned
   *  build and the old step under the veil each free the circle once, before the band textures' owner frees the dress it
   *  wore (egBandsDown, refused while a circle stands). Answers how many meshes it freed. */
  function egCircleDown(ctx) {
    const mesh = _egMesh, gates = _egGates, gone = new Set([mesh, _egLookMesh, ...gates.map((g) => g.gpu)].filter(Boolean));   // EG-G2: and the look's mesh
    _egMesh = null; _egMeshKey = ''; _egGates = []; _egLookMesh = null; _egLamps = [];
    egOcc.clear(); _egDraw = null;   // EG-ZN: the dither pass lets the old circle go - its views and its draw - before it is freed
    for (let i = ctx.dynamicDraws.length - 1; i >= 0; i--) if (gone.has(ctx.dynamicDraws[i]?.gpu)) ctx.dynamicDraws.splice(i, 1);
    ctx.collider.removeBucket(EG_BUCKET);
    for (const g of gates) ctx.collider.removeBucket(`eg:gate:${g.h}`);
    for (const m of gone) { try { renderer?.destroyMesh?.(m); } catch { /* gone */ } }
    return gone.size + ground.down(ctx.dynamicDraws);   // EG-LOOK: and its ruin, a mesh a hall (its band's wreck stays - egBandsDown frees it)
  }
  /** EG-ZN (section 29 - EVERY ALLOCATION HAS AN OWNER: "band textures are cached per band and freed at the breach's end"):
   *  every band's dress this breach put up (AUDIT EG III lane4 #4: and its Beats' pictures, scenes/eliteGates/egSpan.js egBeatTellDown),
   *  freed - each record's albedo (every variant under it) and its emission - at the
   *  breach's end: the client's word on the first frame out of the Spire that is no swap's or answer's step (scenes/
   *  egClient.js), so a swap in place and the old step under the veil upload nothing. Refused while a circle stands (its
   *  draws still wear them). Answers how many textures it freed. */
  function egBandsDown() {
    if (wm.mode === 'dungeon' && isEgHall(wm.dungeonLoc)) return 0;
    let n = egBeatTellDown(renderer);   // AUDIT EG III (lane4 #4): every Beat's pictures the breach's spans put up (scenes/eliteGates/egSpan.js) - nothing held, nothing done
    ground.release();   // EG-LOOK: the band's wreck (and any ruin left) freed with the dress it wore
    if (!_egBands.size) return n;
    for (const band of _egBands) {
      const arch = egBandArchive(band);
      for (const rec of EG_BAND_RECORDS) { if (renderer?.releaseTexture?.(arch, rec)) n++; if (renderer?.evictEmissionTexture?.(`${arch}_${rec}`)) n++; }
    }
    _egBands.clear(); _egBandRecs.clear();
    return n;
  }
  /** EG-G2: a circle's band's dress uploaded under its own archive, once a breach a band (EG-ZN) - at a circle's stand,
   *  under the veil, and at THE SWAP for whatever of it the Court's rest did not put up (AUDIT EG V L6-9: the swap's worker
   *  paints it - egSwapFeed); painted here only where no worker built the circle. */
  function egBandUp(c) {
    const band = egBandOfCircle(c);
    if (egBandWhole(band) || !renderer?.uploadTexture) return;
    try { for (const [rec, art] of egBandArt(band)) egBandRec(band, rec, art); } catch (e) { console.warn('[eg] the band\'s art would not upload', e?.message ?? e); }
  }
  /** AUDIT EG V (L6-9): one record of band `band`'s dress up (its albedo and its emission), once a breach. */
  function egBandRec(band, rec, art) {
    let up = _egBandRecs.get(band);
    if (!up) _egBandRecs.set(band, (up = new Set()));
    if (up.has(rec) || !renderer?.uploadTexture) return;
    _egBands.add(band); up.add(rec);
    try { renderer.uploadTexture(egBandArchive(band), rec, art.albedo, art.cutout ? { cutout: true } : undefined); renderer.uploadEmissionTexture?.(egBandArchive(band), rec, art.emission, { white: true }); } catch (e) { console.warn('[eg] the band\'s art would not upload', e?.message ?? e); }   // EG-LOOK: a cutout picture (the banner's torn foot, the fixture's flames) asks for its holes
  }
  /** AUDIT EG V (L6-9): is band `band`'s dress up whole this breach? */
  const egBandWhole = (band) => (_egBandRecs.get(band)?.size ?? 0) >= EG_BAND_RECORDS.length;
  /** EG-G2: the look's own mesh for a circle (the waystones lit - world/eliteGates/egLook.js), or null. */
  function egLookBuild(seed, c, geo) {
    try { const lm = buildEgLookModel(seed, c, geo); return lm && renderer?.createMesh ? renderer.createMesh(lm) : null; } catch (e) { console.warn('[eg] the look would not build', e?.message ?? e); return null; }
  }
  function standEgHall(ctx, eh) {
    const key = `${eh.seed}:${eh.c}:${eh.geo ?? 0}`;
    if (!_egArt && renderer?.uploadTexture) {
      _egArt = true;
      const glow = { white: true };
      try { for (const [rec, art] of realmArt()) { renderer.uploadTexture(SD_REALM_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(SD_REALM_ARCHIVE, rec, art.emission, glow); } } catch (e) { console.warn('[eg] the Spire\'s art would not upload', e?.message ?? e); }
    }
    egBandUp(eh.c);   // EG-G2 (section 25.1): the circle's band's dress under its own archive, once a breach a band (EG-ZN)
    if (eh.c > 1) egBandUp(eh.c - 1);   // EG-LOOK (Elite-Gates-Look.md section 1.5): a Brink circle's ruin wears the band above's too (world/eliteGates/egRuin.js egRuinBands) - whole already for any other
    ctx.addTeardown?.(() => egCircleDown(ctx));   // EG-ZP (section 29): the circle let go with the context it stands in - every way that context ends
    if (_egMeshKey !== key) {
      egOcc.clear();   // EG-ZN: the dither pass lets the old circle go before it is freed
      if (_egMesh) { try { renderer?.destroyMesh?.(_egMesh); } catch { /* gone */ } }
      _egMesh = null; _egMeshKey = key;
      try { const model = buildEgCircleModel(eh.seed, eh.c, eh.geo ?? 0); _egMesh = renderer?.createMesh ? renderer.createMesh(model) : null; if (_egMesh) egOcc.set(_egMesh, model); } catch (e) { console.warn('[eg] the circle would not build', e?.message ?? e); _egMesh = null; }   // EG-ZN: its occluders with it
      if (_egLookMesh) { try { renderer?.destroyMesh?.(_egLookMesh); } catch { /* gone */ } }   // EG-G2: the look's own mesh (the waystones), once a circle
      _egLookMesh = egLookBuild(eh.seed, eh.c, eh.geo ?? 0);
      _egLamps = egCircleLights(eh.seed, eh.c, eh.geo ?? 0);
    }
    egCircleDraw(ctx);   // EG-ZN: the circle's one draw, the dither pass's to hide while it draws the circle itself
    for (const d of ground.stand(eh.seed, eh.c, eh.geo ?? 0)) ctx.dynamicDraws.push(d);   // EG-LOOK: the circle's ruin and its band's wreck, built here at a stand
    if (_egLookMesh) ctx.dynamicDraws.push({ gpu: _egLookMesh, object: { matrix: identity() }, noShadow: true });   // EG-G2
    const tris = egCircleColliderTris(eh.seed, eh.c, eh.geo ?? 0), n = tris.length / 3;
    const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    ctx.collider.addMesh(EG_BUCKET, tris, idx, identity());
    for (const g of _egGates) if (g.gpu) { try { renderer?.destroyMesh?.(g.gpu); } catch { /* gone */ } }
    _egGates = [];
    for (const spec of egCircleSpecs(eh.seed, eh.c, eh.geo ?? 0)) {
      const parts = egGateParts(spec);
      if (parts) egGateStand(ctx, spec.h, parts);   // EG-H3: the one gate stand (the swap's too)
    }
    ctx.addActivationNamer((key) => (typeof key === 'string' && key.startsWith('exit:') ? { title: EG_TEXT.wayHome } : null));   // the Redoubt's way home is the level's one exit door, stood by the outer host (before the dungeon exit's own namer)
  }
  /** EG-LOOK: THE CIRCLE'S FRAME - its portcullises (egGatesFrame), and its ruin and its band's wreck placed about `eye`
   *  (the dungeon's frame) on the realm's shared clock (scenes/eliteGates/egGroundLook.js). */
  function egCircleFrame(eye) {
    egGatesFrame();
    ground.frame(eye, host.deadlandsSeconds?.() ?? 0);
  }
  /** EG-PLAY: each Rampart's portcullis stood or sunk as its hall's door stands (the outer host's word), every frame. */
  function egGatesFrame() {
    for (const g of _egGates) {
      const open = !!host.egGateOpen?.(g.h);
      g.T[1] = open ? -400 : 0;
      if (g.draw) g.draw.hidden = open;
    }
  }
  // ── EG-H3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7 and 31, EG10):
  // THE SWAP - a new circle stood IN PLACE from the level its rest built (scenes/eliteGates/egSwap.js, off the main thread - world/
  // egCircleWorker.js): the old circle's mesh, portcullises, floors and spans freed, the new one's uploaded and laid, the
  // circle renamed on the level. No exterior pixel, no landing, no world-cell hello, no new context: the presence socket
  // stays the breach's (`{kind: 'eg', b}`). A build not ready when the step is due leaves the step the old way, out under
  // the veil and in again (scenes/eliteGates/egClient.js swapTo). ─────────────────────────────────────────────────────────────────
  const egSwap = createEgSwap();
  /** A Rampart's portcullis stood into the context (`parts` world/eliteGates/egHall.js egGateParts's): its own draw and a moving
   *  bucket, sunk once its door opens (egGatesFrame). */
  function egGateStand(ctx, h, parts) {
    let gpu = null;
    try { gpu = renderer?.createMesh ? renderer.createMesh(parts.model) : null; } catch { gpu = null; }
    const g = { h, gpu, T: [0, 0, 0], draw: gpu ? { gpu, object: { matrix: identity() } } : null };
    if (g.draw) ctx.dynamicDraws.push(g.draw);
    const gi = new Uint16Array(parts.tris.length / 3);
    for (let i = 0; i < gi.length; i++) gi[i] = i;
    ctx.collider.addMesh(`eg:gate:${h}`, parts.tris, gi, identity(), () => g.T);
    _egGates.push(g);
  }
  /** The next circle's level asked of the swap's build (`r` { b, seed, c, geo, given } - AUDIT EG V, E NEW-2: `given` a breach
   *  of another law's halls, the worker's to build from) - only inside that breach's circle; answers its state ('ready',
   *  'building', or null: none offered - the step will be the old way). */
  function egPrebuild(r) {
    if (wm.mode !== 'dungeon' || !isEgHall(wm.dungeonLoc) || !r || r.b !== wm.dungeonLoc.egBreach || !Number.isSafeInteger(r.c)) return null;
    // EG-G2: the next circle's band's dress up while the Court rests. AUDIT EG V (L6-9): painted in the swap's worker with
    // the circle (never here - a band's paint was a frame of 100-270 ms in the rest, its beacon and hymn running) and put up
    // a record a frame; L6-8: then its halls' specs taken as the worker laid them, a hall a frame (egSwapFeed)
    const band = egBandOfCircle(r.c), st = egSwap.want(r.seed, r.c, r.geo ?? 0, egBandWhole(band) ? -1 : band, r.given, ground.lite);
    if (st === 'ready') egSwapFeed(egSwap.peek(r.seed, r.c, r.geo ?? 0), band, 1);
    return st;
  }
  /** AUDIT EG V (L6-8, L6-9): a built circle's band dress and hall specs fed to the page, `n` of them - a rest frame's one,
   *  THE SWAP's every one left: each record of the dress put up (egBandRec), then each hall's spec taken as given
   *  (net/eliteGates/egLaw.js egSpecGive), so nothing under the veil paints a band or lays a hall again (it laid halls 2-5 there,
   *  17-102 ms). */
  function egSwapFeed(parts, band, n = Infinity) {
    for (let k = 0; k < n && parts; k++) {
      const a = parts.art?.shift?.();
      if (a) { egBandRec(band, a[0], a[1]); continue; }
      const s = parts.specs?.shift?.();
      if (s) { egSpecGive(s); continue; }
      break;
    }
  }
  /** THE SWAP ITSELF (under the veil the client has closed): circle `r.c` stood in this same level from its built parts -
   *  false (nothing touched) when it is not built, or this is not that breach's circle. The slot emptied before what was
   *  in it is freed. */
  function egSwapCircle(r) {
    if (wm.mode !== 'dungeon' || !isEgHall(wm.dungeonLoc) || !wm.dungeonCtx || !r || r.b !== wm.dungeonLoc.egBreach || !Number.isSafeInteger(r.c)) return false;
    const parts = egSwap.take(r.seed, r.c, r.geo ?? 0);
    if (!parts) return false;
    egSwapFeed(parts, egBandOfCircle(r.c));   // AUDIT EG V (L6-8, L6-9): what the rest left of its dress and its halls, before anything reads them
    const ctx = wm.dungeonCtx;
    egCircleDown(ctx);   // EG-ZP: the old circle let go by the one teardown every way out takes - its slots emptied, the dither pass told, its draws, buckets and meshes freed
    try { _egMesh = renderer?.createMesh ? renderer.createMesh(parts.model) : null; if (_egMesh) egOcc.set(_egMesh, parts.model); } catch (e) { console.warn('[eg] the circle would not build', e?.message ?? e); _egMesh = null; }   // EG-ZN: its occluders built with it, off the main thread
    _egMeshKey = parts.key; _egLamps = parts.lamps;
    egCircleDraw(ctx);   // EG-ZN: the circle's one draw, the dither pass's
    for (const d of ground.stand(r.seed >>> 0, r.c, (r.geo ?? 0) | 0, parts.ruins ?? null, parts.vista ?? null)) ctx.dynamicDraws.push(d);   // EG-LOOK: its ruin and its band's wreck, built off the main thread with it
    egBandUp(r.c); _egLookMesh = egLookBuild(r.seed >>> 0, r.c, (r.geo ?? 0) | 0);   // EG-G2: the new circle's band's dress (up already from its build) and its waystones
    if (_egLookMesh) ctx.dynamicDraws.push({ gpu: _egLookMesh, object: { matrix: identity() }, noShadow: true });
    const n = parts.tris.length / 3, idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    ctx.collider.addMesh(EG_BUCKET, parts.tris, idx, identity());
    for (const g of parts.gates) egGateStand(ctx, g.h, g);
    ctx.egRecircle?.({ seed: r.seed >>> 0, c: r.c, geo: r.geo ?? 0 });   // the spans: the old circle's freed, the new one's stood at the next ride
    wm.dungeonLoc.egCircle = r.c; wm.dungeonLoc.egGeo = (r.geo ?? 0) | 0;
    return true;
  }
  // ── EG-H3 end ──────────────────────────────────────────────────────────────────────────────────────────────────────

  return {
    standEgHall, egCircleFrame, egPrebuild, egSwapCircle, egBandsDown, egOcc, egSwap,
    /** The circle's lamps as they stand (the dungeon arm's light list - scenes/worldModes.js). */
    lamps: () => _egLamps,
    /** EG-LOOK: the ruin and the wreck as they stand (probes, tests). */
    ground: () => ground.stats(),
  };
}
