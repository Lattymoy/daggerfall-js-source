// AUDIT 26 - THE RENDER CLUSTER (F001/F002, F033, F034, F183). Four
// laws the port computed, stated in a header, or held live in a
// predicate, and then never applied to a frame.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WINDOW_STYLES, windowEmissionRGB } from '../src/render/windowEmission.js';
import { IMPACT_FPS } from '../src/render/flatAnimation.js';
import { IMPACT_RECORD, BLOOD_ARCHIVE, BLOOD_FPS } from '../src/scenes/hitEffects.js';
import { missileArchive } from '../src/systems/spellcast.js';
import {
  DUNGEON_AMBIENT, CASTLE_AMBIENT, SPECIAL_AREA_AMBIENT,
  SPECIAL_AREA_BLOCK, dungeonAmbientFor,
} from '../src/world/dungeonLights.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

// ---------------------------------------------------------------
// F001/F002: DaggerfallInterior lays out EVERY interior mesh with
// WindowStyle.Disabled — individual models (:473), the combined batch
// (:517), action doors (:1270) — and Disabled is EmissionColor
// Color.black outright (MaterialReader.cs:933-935).
// ---------------------------------------------------------------
test('audit26 F001: Disabled is black OUTRIGHT, and an unknown style still falls back to day', () => {
  assert.deepEqual(WINDOW_STYLES.disabled, { color: [0, 0, 0], intensity: 0 });
  assert.deepEqual([...windowEmissionRGB('disabled')], [0, 0, 0]);
  // the fallback is what made a missing entry dangerous rather than
  // merely absent: windowEmissionRGB('disabled') used to answer DAY.
  assert.deepEqual([...windowEmissionRGB('nosuchstyle')], [...windowEmissionRGB('day')]);
  // and day is emphatically not black, so the two cannot be confused
  assert.notDeepEqual([...windowEmissionRGB('day')], [0, 0, 0]);
});

test('audit26 F001: every non-exterior host writes its OWN window style, so none inherits', () => {
  // The tint is ONE renderer global uploaded per frame, so a host that
  // never writes it draws with whatever the last host left behind.
  // That is the whole defect: before this, only the two exterior hosts
  // and main.js's boot ever wrote it.
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /renderer\.setWindowEmission\(windowEmissionRGB\('disabled'\)\);/, 'the interior branch');
  assert.match(wm, /renderer\.setWindowEmission\(windowEmissionRGB\('day'\)\);/, 'the dungeon branch');
  // the dev interior route draws the same Disabled interiors (F002)
  assert.match(src('src/scenes/interior.js'), /setWindowEmission\(windowEmissionRGB\('disabled'\)\)/);
  // ...and the standalone dungeon host keeps GetMaterial's Day default:
  // SetDungeonTextures (DaggerfallMesh.cs:153-169) calls GetMaterial
  // with NO window style, and a window material is BORN
  // DayWindowColor * DayWindowIntensity (MaterialReader.cs:456-461).
  assert.match(src('src/scenes/dungeon.js'), /setWindowEmission\(windowEmissionRGB\('day'\)\)/);
});

// ---------------------------------------------------------------
// F183: UpdateAmbientLight (PlayerAmbientLight.cs:82-90) tests the
// castle block FIRST, then the special area, and only the plain arm
// is scaled.
// ---------------------------------------------------------------
test('audit26 F183: castle beats special area beats plain dungeon, and both are 0.58', () => {
  assert.deepEqual([...CASTLE_AMBIENT], [0.58, 0.58, 0.58]);
  assert.deepEqual([...SPECIAL_AREA_AMBIENT], [0.58, 0.58, 0.58]);
  assert.deepEqual([...DUNGEON_AMBIENT], [0.12, 0.12, 0.12]);

  assert.equal(dungeonAmbientFor({ inCastle: true, inSpecialArea: false }), CASTLE_AMBIENT);
  assert.equal(dungeonAmbientFor({ inCastle: false, inSpecialArea: true }), SPECIAL_AREA_AMBIENT);
  assert.equal(dungeonAmbientFor({ inCastle: false, inSpecialArea: false }), DUNGEON_AMBIENT);
  // PRECEDENCE: the castle arm is tested first, so it wins outright.
  assert.equal(dungeonAmbientFor({ inCastle: true, inSpecialArea: true }), CASTLE_AMBIENT);
  // and an empty call is the plain dungeon, not a throw
  assert.equal(dungeonAmbientFor(), DUNGEON_AMBIENT);

  // roughly five times brighter - the row's own measure of the gap
  assert.ok(CASTLE_AMBIENT[0] / DUNGEON_AMBIENT[0] > 4.8);
});

test('audit26 F183: the special area is the ONE block SpecialAreaCheck names, and both hosts read the selector', () => {
  // PlayerEnterExit.cs:1230 — the switch has exactly one case.
  assert.equal(SPECIAL_AREA_BLOCK, 'S0000161.RDB');
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /return b\.name === SPECIAL_AREA_BLOCK;/, 'matched on the block NAME');
  assert.match(dc, /inCastle: castleBlockAt\(feet\[0\], feet\[2\]\),/);
  assert.match(dc, /inSpecialArea: specialAreaBlockAt\(feet\[0\], feet\[2\]\),/);
  // both hosts apply the per-block ambient, and neither spells the
  // plain constant into its lighting call any more
  assert.match(src('src/scenes/worldModes.js'), /renderer\.setLighting\(new Float32Array\(dungeonCtx\.ambient\), 0\);/);
  assert.match(src('src/scenes/dungeon.js'), /renderer\.setLighting\(new Float32Array\(ctx\.ambient\), 0\);/);
});

// ---------------------------------------------------------------
// F033: DoCollision swaps the billboard to record 1 of the missile's
// own element archive, one-shot at ImpactBillboardFramesPerSecond
// (:364-370), parented at localPosition Vector3.zero (:602).
// ---------------------------------------------------------------
test('audit26 F033: the flash is record 1 of the MISSILE\'s archive at 15fps, with no nudge', () => {
  assert.equal(IMPACT_RECORD, 1);
  assert.equal(IMPACT_FPS, 15);
  // the archive is the missile's own, per element (375..379)
  assert.equal(missileArchive(0), 375);
  assert.equal(missileArchive(4), 379);
  // the pool takes them per-spawn, and the blood defaults are untouched
  const he = src('src/scenes/hitEffects.js');
  assert.match(he, /function spawn\(record, pos, facing = null, \{ archive = BLOOD_ARCHIVE, fps = BLOOD_FPS \} = \{\}\)/);
  assert.match(he, /showImpactFlash: \(archive, pos\) => spawn\(IMPACT_RECORD, pos, null, \{ archive, fps: IMPACT_FPS \}\)/);
  assert.equal(BLOOD_ARCHIVE, 380);
  assert.equal(BLOOD_FPS, 10);
  // facing MUST be null - localPosition Vector3.zero means no
  // FORWARD_NUDGE, unlike a blood splash.
  assert.match(he, /spawn\(IMPACT_RECORD, pos, null,/);
  // the entry carries archive/fps so a recenter can REBUILD the batch
  assert.match(he, /const entry = \{ batch: null, anim: null, dead: false, record, pos: at, size: null, archive, fps \};/);
  assert.match(he, /e\.batch = renderer\.createBillboardBatch\(e\.archive, e\.record, e\.size, \[e\.pos\]\);/);
  // ...and the ANIM is built on the entry's archive too. That is
  // unobservable today - flatFps overrides only ANIMALS (201) and
  // LIGHTS (210), so the blood archive and the five missile archives
  // all fall through to the fps passed in - which is exactly why the
  // pin has to read the source: the day this pool spawns an archive
  // WITH an override, a hard-coded BLOOD_ARCHIVE would silently pick
  // the wrong rate.
  assert.match(he, /\? new FlatAnim\(archive, frameCount, true, fps\)/);
});

test('audit26 F033: both missile hosts flash, gated on element None and ByTouch, at every impact', () => {
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/hostMagic.js']) {
    const s = src(f);
    // ONE gate per host, not three copies of it
    assert.match(s, /if \(!m\.spell \|\| m\.spell\.element == null \|\| m\.spell\.rangeType === 1\) return;/,
      `${f} gates on element None and ByTouch`);
    // three impacts: the wall and the two body hits
    // three CALLS - the lookbehind drops the helper's own declaration
    assert.equal((s.match(/(?<!function )showImpactFlash\(m, /g) ?? []).length, 3,
      `${f} flashes at all three impacts`);
    // the wall flash is OUTSIDE the AoE branch - DFU flashes on any
    // wall hit, so hoisting `impact` out of it is the point.
    // `impact` is computed OUTSIDE the AoE branch and the flash reads
    // it - DFU flashes on any wall hit, AoE or not. Read as an order
    // pin rather than by distance, so a comment either side cannot
    // break it.
    const decl = s.indexOf('const impact = [m.pos[0] + m.dir[0] * hitWall');
    const aoe = s.indexOf('rangeType === 4', decl);
    const flash = s.indexOf('showImpactFlash(m, impact);', decl);
    assert.ok(decl > 0 && aoe > decl && flash > aoe,
      `${f} must compute impact before the AoE branch and flash after it`);
  }
  // the exterior host had no pool at all; it mints one and, like the
  // candle, follows an 819.2-unit recenter.
  const hm = src('src/scenes/hostMagic.js');
  assert.match(hm, /const impacts = createHitEffects\(\{/);
  assert.match(hm, /impacts\.tick\(dt\);/);
  assert.match(hm, /impacts\.offsetAll\(offset\);/);
});

// ---------------------------------------------------------------
// F034: port-internal GL state. The clear colour is global; beginFrame
// clears without setting one.
// ---------------------------------------------------------------
test('audit26 F034: renderCharacterSprite borrows the clear colour and returns it', () => {
  // EV6 moved the MECHANISM, not the law: the restore now reads the
  // renderer's own _clearColor shadow (kept true by the constructor
  // and every borrower) instead of a synchronous
  // gl.getParameter(COLOR_CLEAR_VALUE) round-trip per sprite frame -
  // the query class EV2 killed in precipitation. The borrow-and-return
  // shape itself is unchanged: sprite clear set, then restored after
  // the draw. The clear is also SCISSORED to the sprite's own corner.
  const s = src('src/render/renderer.js');
  const fn = s.slice(s.indexOf('renderCharacterSprite(mesh'), s.indexOf('renderCharacterSpriteImage(mesh'));
  const set = fn.indexOf('gl.clearColor(0, 0, 0, 0);');
  const restore = fn.indexOf('gl.clearColor(cc[0], cc[1], cc[2], cc[3]);');
  assert.ok(set > 0, 'the sprite clear is set');
  assert.ok(restore > set && fn.indexOf('const cc = this._clearColor;') > set,
    'and restored from the shadow after the draw');
  assert.equal(/gl\.getParameter\(/.test(fn), false, 'no synchronous driver query survives in the pass');
  assert.ok(fn.indexOf('gl.scissor(0, 0, pw, ph);') > 0 && fn.indexOf('gl.scissor(0, 0, pw, ph);') < set + 200,
    'the clear is scissored to the sprite corner, not the whole RT');
  // the shadow is born beside the one constructor clearColor it mirrors
  assert.match(s, /gl\.clearColor\(0\.53, 0\.7, 0\.92, 1\.0\);[^]{0,400}this\._clearColor = new Float32Array\(\[0\.53, 0\.7, 0\.92, 1\.0\]\);/,
    'the shadow and the real clear colour are set together');
  // PIN MOVED, ROAD-C c2/S2. The bank model preview used to keep its
  // OWN borrow idiom out in worldModes.js, and it borrowed with a
  // synchronous gl.getParameter(COLOR_CLEAR_VALUE) every frame -
  // exactly the driver-query class EV2 killed in precipitation, done
  // outside the renderer where the shadow was "not visible". It now
  // rides renderer.panelFrame, which reads the shadow like every
  // other borrower and returns it in a finally. The law this pin
  // guards - a borrowed clear colour is always returned - is now
  // pinned as BEHAVIOUR in test/roadc_panelframe.test.js rather than
  // as the text of a second copy.
  assert.equal(/getParameter\(gl\.COLOR_CLEAR_VALUE\)/.test(src('src/scenes/worldModes.js')), false,
    'the second copy of the borrow idiom is gone - it goes through the renderer now');
  assert.match(src('src/scenes/worldModes.js'), /renderer\.panelFrame\(\{/);
  // beginFrame still sets NO colour, which is why the restore is the
  // fix rather than a defensive set there.
  const begin = s.slice(s.indexOf('beginFrame('), s.indexOf('beginFrame(') + 900);
  assert.equal(/clearColor/.test(begin), false, 'beginFrame sets no clear colour of its own');
});
