import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setInfectionHost } from '../src/systems/infection.js';
import { wireInfectionVideos, holdFrame, frameHeld, claimFrame, frameAlive } from '../src/scenes/shared.js';

// AUDIT 39, the dungeon/shared lane. Five of the eight findings are one
// shape: buildDungeonContext BORROWS a process-global seam and never
// gives it back, so the seam outlives the context it points into. The
// other three are a door that opens nothing, a cull that skips its own
// sweep, and a full-screen video the world keeps running under.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const DC = read('src/scenes/dungeonContext.js');
const destroyBody = DC.slice(DC.indexOf('    destroy() {'));

// ── #35: THE DEATH PRESENTER AND THE AVOID-DEATH HOOK ─────────────
// playerEntity's setters answer the previous holder for exactly this
// purpose ("so a host that mounts another can restore it"), and the
// dungeon discarded both. Nothing above ground takes them back on the
// exit path - worldModes' re-registration lives in its interior-mode
// frame arm, which cannot run in exterior mode - so after one dungeon
// visit every death above ground presented into a torn-down context's
// overlay slot, where no host draws and onReset can never fire.

test('AUDIT 39 #35: the dungeon BORROWS the death seams and hands both back on teardown', () => {
  assert.match(DC, /const _prevDeathPresenter = setDeathPresenter\(\(\) => \{/,
    'the presenter it replaces is captured');
  assert.match(DC, /const _prevAvoidDeath = setAvoidDeathHook\(\(\) => \{/,
    'and so is the avoid-death consult - its hook closes over this context\'s submersion marker');
  assert.match(destroyBody, /setDeathPresenter\(_prevDeathPresenter\);/, 'destroy() restores the presenter');
  assert.match(destroyBody, /setAvoidDeathHook\(_prevAvoidDeath\);/, 'destroy() restores the consult');
  // The sibling seam that always did this is the model, and it is
  // still there - the point is that all of them leave together.
  assert.match(destroyBody, /setPassiveSpecialsHost\(_prevPassiveHost\);/);
});

// ── #37: THE INFECTION HOST ───────────────────────────────────────
// The dungeon registers a STRIPPED set (textAt + showText, no
// factionDict and no transferToCemetery) and the bare assignment used
// to leave it standing for the session: a vampire turn above ground
// then lost its cemetery transfer, its clan lookup and its message box.

test('AUDIT 39 #37: setInfectionHost answers the previous host, and wireInfectionVideos passes it on', () => {
  setInfectionHost(null);
  const first = { messageBox: () => {} };
  assert.equal(setInfectionHost(first), null, 'the first registration replaces nothing');
  const second = { messageBox: () => {} };
  assert.equal(setInfectionHost(second), first, 'and every later one answers who it displaced');
  // the seam the hosts actually call
  const prev = wireInfectionVideos({ canvas: null }, {});
  assert.equal(prev, second, 'wireInfectionVideos hands back the host it mounted over');
  const mounted = setInfectionHost(null);
  assert.notEqual(mounted, second, 'and it really did register its own');
  assert.equal(typeof mounted.playVideo, 'function');
});

test('AUDIT 39 #37: the dungeon\'s leaner infection host leaves with the dungeon', () => {
  assert.match(DC, /const _prevInfectionHost = wireInfectionVideos\(renderer, \{/,
    'the host it mounts over is captured');
  assert.match(destroyBody, /setInfectionHost\(_prevInfectionHost\);/, 'and handed back in destroy()');
  // The stripped set is still the honest one for underground - the fix
  // is the restore, not a richer registration the dungeon cannot make.
  const wire = DC.slice(DC.indexOf('const _prevInfectionHost = wireInfectionVideos('));
  const bag = wire.slice(0, wire.indexOf('});'));
  assert.ok(!bag.includes('factionDict'), 'a dungeon has no FACTION.TXT of its own');
});

// ── #38: THE PAUSE WINDOW'S PACK AND CHRONICLE DOORS ──────────────
// enhancedMenu draws a door for every arm the host hands over, so the
// two arms that read `api.makeInventory` / `api.makeJournal` - members
// this context has never exported - drew two buttons that resumed the
// game and opened nothing.

test('AUDIT 39 #38: the dungeon pause doors call THIS host\'s builders, not members it never had', () => {
  const at = DC.indexOf('openPauseFlow(');
  const call = DC.slice(at, at + 1200);
  assert.match(call, /openPack: \(\) => \{ const w = openInventory\(null\); if \(w\) activeOverlay = w; \},/);
  assert.match(call, /openChronicle: \(\) => \{ const w = makeJournalWindow\('notebook'\); if \(w\) activeOverlay = w; \},/);
  // The names that were never there: the whole file, not just the call.
  assert.ok(!DC.includes('api.makeInventory'), 'no arm reads a member this context does not export');
  assert.ok(!DC.includes('api.makeJournal'));
  // The chronicle now has ONE builder, and the key doors keep their own
  // guard (the pause door cannot use it - its slot still holds the
  // pause overlay it has just closed).
  assert.match(DC, /function makeJournalWindow\(mode\) \{\n\s+if \(!opts\.questBridge\) return null;/);
  assert.match(DC, /_openJournal\(mode\) \{\n\s+if \(activeOverlay \|\| !opts\.questBridge\) return;\n\s+activeOverlay = makeJournalWindow\(mode\);/);
});

// ── #40: THE RESTORE CULL ─────────────────────────────────────────
// dropCandidate's own doc names this site ("the quest teardown, the
// dispel sweep, the RESTORE CULL ... One sweep, called from every
// removal") and it was the one removal that skipped it. A culled foe
// keeps its health, and the target machine's dead-target cull reads
// HEALTH (EnemySenses:315-318), so a survivor outside the spawn band
// held the spliced-out record for ever.

test('AUDIT 39 #40: the post-save foe cull runs dropCandidate, like every other removal', () => {
  const at = DC.indexOf('for (let i = foes.length - 1; i >= (w.foes?.length ?? 0); i--) {');
  assert.ok(at > 0, 'the restore cull is where the doc says it is');
  const loop = DC.slice(at, DC.indexOf('foes.splice(i, 1);', at) + 20);
  assert.match(loop, /f\.dead = true;/);
  assert.match(loop, /f\.questBehaviour\?\.notifyDestroyed\(\);/);
  assert.match(loop, /dropCandidate\(f\);/, 'the stale-target sweep, beside the destroy');
});

// ── #41: THE CROUCHED DEATH IN THE WORLD-HOSTED DUNGEON ───────────
// PlayerDeath.cs reads mainCamera.localPosition.y and
// playerController.height AT the death, and crouching moves both.
// dungeon.js has always passed the live pair; worldModes passed none,
// so every shipped dungeon death sank from the standing eye.

test('AUDIT 39 #41: worldModes hands the dungeon the LIVE eye and capsule', () => {
  const WM = read('src/scenes/worldModes.js');
  const at = WM.indexOf('const ctx = await buildDungeonContext(');
  const opts = WM.slice(at, WM.indexOf('dungeonCtx = ctx;', at));
  assert.match(opts, /motorState: \(\) => \(\{ eyeLevel: player\.eye\[1\] - player\.pos\[1\], capsule: player\.height \}\),/);
  // and the presenter still reads it through the one seam
  assert.match(DC, /const _ms = opts\.motorState\?\.\(\) \?\? null;/);
});

// ── #76: THE INTERIOR RIGS' GROUNDING ─────────────────────────────
// engineRig states the law where it computes the value: liveFootY is
// "the LIVE support point ... the stride arc dips below rest minY".
// interiorContext placed people once, at scene build, off the REST
// footY, and animateChars only drove the rigs - so the feet sank by
// the arc's dip (and the two rigs whose rest low point is fur or scale
// sat above the floor instead).

test('AUDIT 39 #76: interior people are grounded on the live foot, re-seated every frame', () => {
  const IC = read('src/scenes/interiorContext.js');
  assert.match(IC, /charDraws\.push\(\{ mesh: rg\.mesh, rig: rg, at: \[pn\.x, pn\.y, pn\.z\], matrix: trs\(pn\.x, pn\.y - rg\.liveFootY \* rg\.scale,/);
  assert.ok(!/rg\.footY/.test(IC), 'the rest value grounds nobody here any more');
  const anim = IC.slice(IC.indexOf('animateChars = (t, mode ='));
  const body = anim.slice(0, anim.indexOf('\n    };'));
  assert.match(body, /for \(const d of charDraws\) \{/, 'the placement follows the stride');
  assert.match(body, /d\.matrix = trs\(d\.at\[0\], d\.at\[1\] - d\.rig\.liveFootY \* s, d\.at\[2\], 0, 0, 0, s, s, s\);/);
  // the rule the other three hosts already follow
  for (const h of ['src/scenes/dungeonContext.js', 'src/scenes/exterior.js', 'src/render/characterSprite.js']) {
    assert.ok(read(h).includes('liveFootY'), `${h} grounds on the live support point`);
  }
});

// ── #160: THE INFECTION VIDEOS AND THE FRAME ──────────────────────
// DFU pushes a DaggerfallVidPlayerWindow, whose inherited
// pauseWhileOpened stops the game for the window's lifetime. The port
// deferred by a microtask only - the host had already re-armed itself,
// so the world walked, fought and could die under an unskippable
// full-screen video. claimFrame is the wrong tool: it ENDS a loop.

test('AUDIT 39 #160: the hold suspends the loop without killing it, and counts', () => {
  assert.equal(frameHeld(), false, 'nothing holds the frame by default');
  const a = holdFrame();
  assert.equal(frameHeld(), true);
  const b = holdFrame();
  a();
  assert.equal(frameHeld(), true, 'two holders, two releases');
  a();
  assert.equal(frameHeld(), true, 'a holder releasing twice does not release the other');
  b();
  assert.equal(frameHeld(), false);
  // the hold is NOT the unwind: the token a host claimed is still its own
  const token = claimFrame();
  const c = holdFrame();
  assert.equal(frameAlive(token), true, 'the host still owns the frame while it waits');
  c();
});

test('AUDIT 39 #160: the infection seam takes the hold before the video and releases on every path out', async () => {
  setInfectionHost(null);
  wireInfectionVideos({ canvas: null }, {});
  const host = setInfectionHost(null);
  let closed = false;
  host.playVideo('ANIM0002.VID', () => { closed = true; });
  assert.equal(frameHeld(), true, 'taken SYNCHRONOUSLY - a microtask defers past the body, not past the re-arm');
  // No ARENA2 here, so the video is the "unavailable" path - which is
  // exactly the path that must still give the world back.
  for (let i = 0; i < 200 && !closed; i++) await new Promise((r) => setTimeout(r, 0));
  assert.equal(closed, true, 'the lifecycle carried on');
  assert.equal(frameHeld(), false, 'and the hold was released before the close ran');
});

test('AUDIT 39 #160: every rAF host WAITS on the hold instead of drawing under the video', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    const s = read(h);
    // straight after the ownership check, before any state is read
    assert.match(s, /if \(!frameAlive\(_frameToken\)\) return;[\s\S]{0,400}?\n\s+if \(frameHeld\(\)\) \{ last = now; requestAnimationFrame\(frame\); return; \}\n\s+const dt =/,
      `${h} waits out the video and keeps its loop`);
  }
  // the seam's own half
  const SH = read('src/scenes/shared.js');
  const wire = SH.slice(SH.indexOf('export function wireInfectionVideos'));
  assert.match(wire, /const releaseFrame = holdFrame\(\);\n\s+Promise\.resolve\(\)\.then\(async \(\) => \{/);
  assert.match(wire, /\} finally \{[\s\S]{0,200}releaseFrame\(\);\n\s+\}\n\s+onClose\(\);/,
    'released BEFORE the close, whose popup lands in a host slot only a live loop draws');
});

// ── #46: townTalk's DIRECTORY-LESS GREETING ───────────────────────
// The file's own law (showOverlay's successor-first replacement) exists
// to dispose the outgoing occupant and reset the close callback; one
// mount assigned the slot raw and did neither.

test('AUDIT 39 #46: every mount in townTalk goes through the slot\'s door', () => {
  const TT = read('src/scenes/townTalk.js');
  assert.match(TT, /if \(!directory\.length\) \{ showOverlay\(new TalkWindow\(t\)\); return; \}/);
  // dropOverlay and showOverlay are the ONLY writers of the slot.
  const writes = [...TT.matchAll(/^\s*overlay = /gm)].length;
  assert.equal(writes, 2, 'one in dropOverlay (the null), one in showOverlay - and nowhere else');
});
