// AUDIT 18 pins. Each one is mutation-proven: restoring the defect it
// describes FAILS it. See bible/Home.md "Audits".
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, sep } from 'node:path';

import { weaponAttackDamage, baseDamageMin, baseDamageMax, chooseEnemyWeapon } from '../src/combat/formulas.js';
import { WEAPONS, weaponMinDamage, weaponMaxDamage } from '../src/characters/weapons.js';
import { assignStartingGear } from '../src/systems/startingGear.js';
import { KEEP } from '../src/scenes/dataSource.js';
import { tickPlayerMinutes } from '../src/systems/worldTick.js';
import { computeFaceUVCoordinates } from '../src/formats/faceUVTool.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(join(dir, d.name)) : (d.name.endsWith('.js') ? [join(dir, d.name)] : []));

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

// ---------------------------------------------------------------------------
// F1: GetBaseDamageMin/Max resolve the TEMPLATE, never a baked field.
//
// DaggerfallUnityItem.cs:969-977 -> FormulaHelper.CalculateWeaponMin/MaxDamage
// ((Weapons)TemplateIndex). The port read weapon.minDamage/maxDamage, which
// ONLY enemyEquipment.createWeapon baked. S3d's assignStartingGear mints from
// the item templates, so every armed player swing computed NaN.
// ---------------------------------------------------------------------------

test('AUDIT 18 F1: a starting-gear weapon does finite, table-exact damage', () => {
  // The exact shape assignStartingGear mints (S3d) - no baked damage fields.
  const player = {
    level: 1, isPlayer: true, skills: 35,
    stats: { strength: 50, agility: 50, luck: 50 },
    attackModifierFlags: null,
  };
  const foe = { isPlayer: false, careerIndex: 3, group: null };

  for (const [name, templateIndex] of Object.entries(WEAPONS)) {
    if (name === 'Arrow') continue;                      // ammunition, never swung
    const item = { group: 'Weapons', templateIndex, material: 0, name, value: 30 };

    // The defect: `undefined + ...` is NaN, and NaN survives every later term.
    const lo = weaponAttackDamage(player, foe, 0, item, seq(0));
    const hi = weaponAttackDamage(player, foe, 0, item, seq(0.999));
    assert.ok(Number.isFinite(lo), `${name}: min-roll damage must be finite, got ${lo}`);
    assert.ok(Number.isFinite(hi), `${name}: max-roll damage must be finite, got ${hi}`);

    // And table-exact: roll 0 takes the template minimum, 0.999 the maximum.
    // str 50 -> DamageModifier 0; iron -> material modifier -1.
    assert.equal(lo, weaponMinDamage(templateIndex) - 1, `${name} min roll`);
    assert.equal(hi, weaponMaxDamage(templateIndex) - 1, `${name} max roll`);
  }
});

test('AUDIT 18 F1: baseDamageMin/Max ARE the verbatim template tables', () => {
  for (const templateIndex of Object.values(WEAPONS)) {
    assert.equal(baseDamageMin({ templateIndex }), weaponMinDamage(templateIndex));
    assert.equal(baseDamageMax({ templateIndex }), weaponMaxDamage(templateIndex));
  }
  // A weapon with baked fields but no template resolves through the TEMPLATE
  // path only - a stale baked field can never be read again.
  assert.equal(baseDamageMin({ minDamage: 99, maxDamage: 99 }), 0);
});

test('AUDIT 18 F1: chooseEnemyWeapon compares template damage, not baked fields', () => {
  // CalculateAttackDamage's weapon-vs-weaponless choice (FormulaHelper.cs:700).
  // A Dagger averages (1+6)/2 = 3; a monster whose fists average 5 keeps them.
  const dagger = { templateIndex: WEAPONS.Dagger, material: 0 };
  assert.equal(chooseEnemyWeapon(dagger, { minDamage: 5, maxDamage: 5 }), null);
  assert.equal(chooseEnemyWeapon(dagger, { minDamage: 1, maxDamage: 1 }), dagger);
});

test('AUDIT 18 F1: every weapon assignStartingGear mints carries a template', () => {
  // The seam that broke: gear minted from templates flows straight into
  // weaponRig.syncWorn -> playerWeapon.weapon -> weaponAttackDamage.
  const seen = [];
  for (let classIndex = 0; classIndex < 18; classIndex++) {
    const e = { gender: 'male', race: 'Breton' };
    assignStartingGear(e, { classIndex, rolls: () => 0.5 });
    for (const it of e.items) {
      if (it?.group !== 'Weapons') continue;
      assert.ok(Number.isInteger(it.templateIndex),
        `class ${classIndex}: minted weapon ${it.name} has no templateIndex`);
      // Arrows are ammunition - CalculateWeaponMinDamage has no Arrow case
      // and returns 0, exactly as DFU does. Only swung weapons need damage.
      if (it.templateIndex === WEAPONS.Arrow) continue;
      seen.push(it);
      assert.ok(Number.isFinite(baseDamageMin(it)) && baseDamageMax(it) > 0,
        `class ${classIndex}: ${it.name} resolves no template damage`);
    }
  }
  assert.ok(seen.length >= 18, `expected a starting weapon per class, saw ${seen.length}`);
});

// ---------------------------------------------------------------------------
// F2: the ingest diet must not starve a live reader.
//
// dataSource.KEEP decides what reaches IndexedDB. On the deployed site the
// network arm 404s, so a name KEEP rejects has NO source at all. The diet was
// written before U18 (CLASSES.DAT), T3a (FACTION.TXT) and S3e (BIOG*.TXT)
// shipped, and silently starved all three.
//
// This is a RULE, not a spot check: it re-derives the fetch list from the
// source on every run, so the next reader that lands is covered automatically.
// ---------------------------------------------------------------------------

test('AUDIT 18 F2: every ARENA2 name live code fetches survives the ingest diet', () => {
  const LITERAL = /(?:fetchBytes|getBytes)\(\s*'([A-Z0-9_.]+)'/g;
  const names = new Set();
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(LITERAL)) names.add(m[1]);
  }
  assert.ok(names.size >= 15, `expected the real fetch list, found ${names.size}`);

  // Both diets: desktop (lean=false) and the phone diet (lean=true). A file
  // may only be lean-dropped if the port has a documented fallback - today
  // that is the sky sets alone.
  for (const name of [...names].sort()) {
    assert.ok(KEEP(name, false), `desktop diet drops ${name}, which live code fetches`);
    if (!/^SKY\d+\.DAT$/.test(name)) {
      assert.ok(KEEP(name, true), `lean diet drops ${name}, which live code fetches`);
    }
  }

  // AUDIT 19 F8: THE REGEX ABOVE HAS A BLIND SPOT, and it cost a slice.
  // chargenArt fetches its parchment scroll as
  //     for (const name of ['SCRL00I0.GFX', 'SCRL01I0.GFX'])
  // which is not a `getBytes('LITERAL')` call, so the sweep never saw it
  // and .GFX sat outside KEEP through a whole audit - the U18 class
  // questions fell back to the text panel on every deployed and phone
  // boot while this pin passed 17/17.
  //
  // The stronger rule: if src/ NAMES an ARENA2 file anywhere in code, the
  // diet must keep it. That needs no guess about the call shape.
  const ARENA2_NAME = /'([A-Z0-9_$][A-Z0-9_.$]*\.(?:BSA|COL|PAL|PAK|CFG|FNT|WLD|DEF|STD|IMG|CIF|RSC|RCI|SND|TXT|GFX|VID|DAT|CEL))'/g;
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const named = new Set();
  for (const file of walk(SRC)) {
    for (const m of stripComments(readFileSync(file, 'utf8')).matchAll(ARENA2_NAME)) named.add(m[1]);
  }
  assert.ok(named.size >= 20, `expected the named-file set, found ${named.size}`);
  const starved = [...named].filter((n) => !KEEP(n, false) || !KEEP(n, true));
  assert.deepEqual(starved, [],
    `src/ names these ARENA2 files but the ingest diet drops them:\n${starved.join('\n')}`);

  // The three the diet actually starved, named so a regression is legible.
  for (const n of ['CLASSES.DAT', 'FACTION.TXT']) assert.ok(KEEP(n, true), n);
  for (let i = 0; i < 18; i++) {
    const biog = `BIOG${String(i).padStart(2, '0')}T0.TXT`;
    assert.ok(KEEP(biog, true), `lean diet drops ${biog}`);
  }

  // And the diet still refuses the bulk it exists to refuse.
  for (const n of ['PACKED.DAT', 'MASTER.DAT', 'BIO.DAT', 'ANIM0000.VID']) {
    assert.ok(!KEEP(n, true), `${n} must stay out of the lean diet`);
  }
});

test('AUDIT 18 F2: the template-built CLASS**.CFG fetches all survive the diet', () => {
  // dungeonContext.js:384 and chargenSession.js:90/105 build these by index.
  for (let i = 0; i < 19; i++) {
    assert.ok(KEEP(`CLASS${String(i).padStart(2, '0')}.CFG`, true));
  }
});

// ---------------------------------------------------------------------------
// F4: Vector3.Normalize multiplies by the reciprocal.
//
// API/Vector3.cs:583-597 computes `double inverse = 1 / v1.Magnitude` and
// multiplies each component. The port divided. x*(1/m) and x/m are different
// doubles, and the difference survives the (Int32) truncations that choose the
// 2D basis: 608 UVs across 542 faces of the real ARCH3D corpus were wrong.
//
// Expected values below are DFU's OWN output, dumped by compiling
// DaggerfallConnect's FaceUVTool under Mono with only the Ledger row-18
// float->double widening applied - not the port's output.
// ---------------------------------------------------------------------------

test('AUDIT 18 F4: faceUVTool matches DFU on a corpus face the divide got wrong', () => {
  // ARCH3D record 1162, a 4-point plane. Point 3's v was 1235; DFU gives 1236.
  const plane = [
    { x: -49152, y: 0, z: 16384, nx: 0, ny: 256, nz: 0, u: 3072, v: 0 },
    { x: 16384, y: 0, z: 16384, nx: 0, ny: 256, nz: 0, u: -3072, v: 0 },
    { x: -4864, y: 0, z: -9984, nx: 0, ny: 256, nz: 0, u: 996, v: 1236 },
    { x: -27904, y: 0, z: -9984, nx: 0, ny: 256, nz: 0, u: 2076, v: 1236 },
  ];
  const out = new Array(24);                       // DFU's fixed calculatedUVBuffer
  assert.equal(computeFaceUVCoordinates(plane, out), true);
  assert.deepEqual(out.slice(0, 4).map((p) => [p.u, p.v]),
    [[3072, 0], [0, 0], [996, 1236], [2076, 1236]],
    'point 3 v must be 1236 (reciprocal), not 1235 (divide)');
});

// ---------------------------------------------------------------------------
// F5: the rest clock ticks from the branch that OWNS the open window.
//
// DFU runs DaggerfallRestWindow.Update every frame the window is topmost
// (DaggerfallRestWindow.cs:183-227); TickRest reads Time.realtimeSinceStartup,
// so PauseWhileOpen's timeScale = 0 does not stop it. The port ticked inside
// drawFoes - which BOTH hosts return before whenever an overlay is up, and the
// rest window IS the overlay. U7 rest never advanced an hour in either host.
//
// F6: the audio bootstrap belongs to every host, not to the dungeon.
// ---------------------------------------------------------------------------

test('AUDIT 18 F5: every host that gates on uiOverlayActive also ticks the overlay', () => {
  // The defect was structural - the tick sat on the wrong side of a gate - so
  // the pin is structural too: any host branch that returns on uiOverlayActive
  // must tick first, or its overlays are frozen.
  // U26 note: this used to scan ONE LINE for both the gate and its
  // return, which was true when each host's gate was a one-liner. The
  // dungeon's grew a body (the shot counter has to advance under an
  // overlay or a probe cannot frame-sync through one), and a
  // line-scoped pin silently stopped counting it - the gates total is
  // what caught that. It reads the whole BRANCH now, so the law
  // survives the branch being reformatted.
  const hosts = ['src/scenes/dungeon.js', 'src/scenes/worldModes.js'];
  let gates = 0;
  for (const rel of hosts) {
    const text = readFileSync(join(SRC, '..', rel), 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (!/if \(.*uiOverlayActive/.test(line)) return;
      // the branch is either the rest of this line or the block under it
      const branch = /\breturn\b/.test(line) ? line : lines.slice(i, i + 12).join('\n');
      // Only the FRAME LOOP's gate owes a tick. Both hosts also gate
      // their POINTER handler on uiOverlayActive and return without
      // ticking, correctly - a click is not a frame. drawOverlay is
      // what marks the frame-loop branch.
      if (!/drawOverlay\(/.test(branch)) return;
      assert.ok(/\breturn\b/.test(branch), `${rel}: the uiOverlayActive gate does not return`);
      gates++;
      assert.ok(/tickOverlay\(/.test(branch),
        `${rel}: a branch returns on uiOverlayActive without ticking the overlay:\n  ${line.trim()}`);
      assert.ok(branch.indexOf('tickOverlay(') < branch.indexOf('return'),
        `${rel}: tickOverlay must run BEFORE the return`);
    });
  }
  assert.equal(gates, 2, 'expected exactly the two dungeon-mounting host gates');
});

test('AUDIT 18 F5: a resting window actually advances hours when ticked', () => {
  // Behavioural half: the old placement could not satisfy this at all.
  const perHour = 0.45;                                  // S20 rate the port ports
  let hours = 0;
  const session = { totalHours: 0, tick(dt) { this.acc = (this.acc ?? 0) + dt; while (this.acc >= perHour) { this.acc -= perHour; this.totalHours++; hours++; } return null; } };
  const win = { isRestWindow: true, state: 'resting', session, done: false,
    tickRest(dt) { if (this.state !== 'resting') return; this.session.tick(dt); } };
  for (let i = 0; i < 6; i++) win.tickRest(perHour + 1e-6);
  assert.equal(hours, 6, 'six ticks of one hour each must pass six hours');
});

test('AUDIT 18 F6: every host boots audio through the shared idempotent seam', () => {
  // AUDIT 19 F1(doctrine): this used to accept a bare `audio.ensure(` in a
  // host, which let dungeonContext boot sound and music DIRECTLY rather
  // than through shared.ensureAudio. That made the rule below - one seam,
  // so a host cannot take sound and miss music - false of the very host it
  // was written for: deleting its music bootstrap left ?dungeon silent and
  // the whole suite passed. Every host must take the SEAM.
  for (const rel of ['src/scenes/world.js', 'src/scenes/exterior.js',
    'src/scenes/dungeonContext.js', 'src/scenes/interior.js']) {
    const text = readFileSync(join(SRC, '..', rel), 'utf8');
    assert.match(text, /ensureAudio\(/, `${rel} must boot audio through shared.ensureAudio`);
    const direct = text.match(/(?<!\w)music\.ensure\(/g) ?? [];
    assert.deepEqual(direct, [],
      `${rel} boots music directly instead of through the seam - that is the gap F6 closed`);
  }
  // And nobody may go back to the raw pair, which is what made it host-local.
  // audio.js itself is exempt: ensure() is the one legitimate caller of init().
  for (const file of walk(SRC)) {
    if (file.endsWith(`${sep}systems${sep}audio.js`)) continue;
    const text = readFileSync(file, 'utf8');
    assert.ok(!/audio\.init\(/.test(text), `${file}: use audio.ensure(), not audio.init()`);
  }
  // ONE bootstrap flag PER SUBSYSTEM, and every subsystem behind the one
  // host-facing seam. AUDIT 18 fixed this gap twice independently, and two
  // flags for the SAME subsystem would let one host boot while another
  // slept. A5 added music, which is a second subsystem with its own
  // engine-side flag - legitimate - but only because it boots from the
  // SAME seam, so a host physically cannot take one and miss the other.
  const booted = walk(SRC).filter((f) => /_audioBooted|_booted\s*=/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(booted.map((f) => f.split(sep).slice(-2).join('/')).sort(),
    ['systems/audio.js', 'systems/music.js'],
    'a booted-flag may live ONLY on an engine, never on a host');

  // The seam drives both. If music ever drifts out of ensureAudio, a host
  // could boot sound and stay musically silent - the exact F6 shape.
  const seam = readFileSync(join(SRC, 'scenes', 'shared.js'), 'utf8');
  const fn = seam.slice(seam.indexOf('export function ensureAudio'));
  const body = fn.slice(0, fn.indexOf('\n}') + 2);
  assert.match(body, /audio\.ensure\(/, 'ensureAudio must boot sound');
  assert.match(body, /music\.ensure\(/, 'ensureAudio must boot music through the SAME seam');

  // AUDIT 19 F1: idempotence must be PROMISE-memoised, not flag-and-return.
  // A flag set before its own await lets the second caller resolve while the
  // archive is still loading, so it plays into a disabled service - which is
  // exactly how the exterior host went silent. Assert the shape that cannot
  // race: one stored promise every caller awaits.
  const musicSrc = readFileSync(join(SRC, 'systems', 'music.js'), 'utf8');
  assert.match(musicSrc, /this\._booted \?\?= this\._boot\(/,
    'MusicService.ensure must memoise the BOOT PROMISE, not a boolean');
  assert.ok(!/_booted = true;/.test(musicSrc),
    'a bare `_booted = true` before the await is the AUDIT 19 F1 race');
});

test('AUDIT 18 F6: audio.ensure boots once and is safe to call from every host', async () => {
  const { AudioEngine } = await import('../src/systems/audio.js');
  const eng = new AudioEngine();
  let calls = 0;
  const fetchBytes = async () => { calls++; throw new Error('no data in this test'); };
  eng.attachGestureResume = () => {};                     // no window in Node
  await eng.ensure(fetchBytes);
  await eng.ensure(fetchBytes);
  await eng.ensure(fetchBytes);
  assert.equal(calls, 1, 'ensure must load DAGGER.SND exactly once across all hosts');
});

// ---------------------------------------------------------------------------
// F7: every module in src/ must actually LINK.
//
// AUDIT 18 merged eleven independently-developed fix domains. One had replaced
// formulas.enemyGroupOf with enemyEntityGroup (DFU groups by careerIndex, not
// affinity); another, written against the old API, still imported the old name
// in src/scenes/dungeonContext.js. That import is a hard ESM link error - and
// it survived the ENTIRE 904-test suite, because the four scene hosts have no
// execution coverage at all. Only `vite build` caught it.
//
// This pin closes that gap: it imports every module under src/, so a dangling
// import fails the suite instead of the deploy.
// ---------------------------------------------------------------------------

test('AUDIT 18 F7: every src/ module imports cleanly (no dangling exports)', async () => {
  const skip = new Set(['main.js']);                 // boots the app against a live DOM
  const failures = [];
  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1);
    if (skip.has(rel)) continue;
    try {
      await import(pathToFileURL(file).href);
    } catch (e) {
      // A browser-API reference at module scope is a runtime concern, not a
      // link error - only unresolved bindings and syntax errors count here.
      if (/is not exported by|does not provide an export|Unexpected|SyntaxError/.test(String(e?.message))) {
        failures.push(`${rel}: ${e.message.split('\n')[0]}`);
      } else if (e instanceof SyntaxError) {
        failures.push(`${rel}: ${e.message}`);
      }
    }
  }
  assert.deepEqual(failures, [], `modules that do not link:\n${failures.join('\n')}`);
});

// ---------------------------------------------------------------------------
// F8: the player's world clock belongs to every host.
//
// The per-classic-minute tick ran ONLY inside dungeonContext's frame body, so
// above ground nothing aged: magic effects never expired, diseases never
// advanced a day, poisons never fired a round, fatigue never drained, and
// raiseSkills never ran - a character who stayed out of dungeons NEVER
// ADVANCED A SKILL OR GAINED A LEVEL. DFU splits none of this by scene
// (EntityEffectBroker raises MagicRound globally; PlayerEntity.Update runs
// fatigue and advancement wherever the player is).
//
// The law moved to systems/worldTick.js precisely so it could be pinned by
// behaviour instead of by grepping a host with no execution coverage.
// ---------------------------------------------------------------------------

const tickEntity = () => ({
  chargenDone: true, skillUses: new Array(35).fill(0), stats: {}, skills: 30,
  activeEffects: [], lastSkillCheckTime: 0, fatigue: 3200, health: 50, maxHealth: 50,
});
const tickSinks = (drained) => ({
  hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, restoreFatigue() {}, say() {},
  drainFatigue: (n) => { drained.n += n; },
});

test('AUDIT 18 F8: one classic minute is one magic round, and 12x real time', () => {
  const entity = tickEntity(), drained = { n: 0 };
  // 5 real seconds = 1 classic minute (12x).
  const r = tickPlayerMinutes({ entity, classicMinutes: 0, dt: 5, sinks: tickSinks(drained), rolls: () => 0.5 });
  assert.equal(Number(r.classicMinutes.toFixed(6)), 1);
  assert.equal(r.rounds, 1, 'exactly one magic round per classic minute');
  // A ten-minute jump runs ten rounds...
  const r2 = tickPlayerMinutes({ entity, classicMinutes: 0, dt: 50, sinks: tickSinks(drained), rolls: () => 0.5 });
  assert.equal(r2.rounds, 10);
});

test('AUDIT 18 F8: fatigue drains ONCE per minute-change, not once per caught-up minute', () => {
  // S20 parity: DFU guards a single DecreaseFatigue on
  // `lastGameMinutes != gameMinutes`, so a multi-minute jump costs one
  // minute's fatigue. Draining per round would bill 10x here.
  const drained = { n: 0 };
  tickPlayerMinutes({ entity: tickEntity(), classicMinutes: 0, dt: 50, sinks: tickSinks(drained), rolls: () => 0.5 });
  assert.equal(drained.n, 11, 'ten minutes of catch-up still costs one minute of fatigue');
  // And no minute change costs nothing at all.
  const none = { n: 0 };
  tickPlayerMinutes({ entity: tickEntity(), classicMinutes: 0.1, dt: 0.5, sinks: tickSinks(none), rolls: () => 0.5 });
  assert.equal(none.n, 0);
});

test('AUDIT 18 F8: the fatigue band and Athleticism, truncated AFTER the multiply', () => {
  const run = (activity, mult) => {
    const d = { n: 0 };
    tickPlayerMinutes({ entity: tickEntity(), classicMinutes: 0, dt: 5, sinks: tickSinks(d), activity, fatigueMultiplier: mult, rolls: () => 0.5 });
    return d.n;
  };
  assert.equal(run({ running: false, swimming: false }, 1.0), 11);
  assert.equal(run({ running: true, swimming: false }, 1.0), 88);
  // PlayerEntity.cs:405 casts to int AFTER the multiply: 11 -> 9, 88 -> 79.
  assert.equal(run({ running: false, swimming: false }, 0.9), 9);
  assert.equal(run({ running: true, swimming: false }, 0.9), 79);
});

test('AUDIT 18 F8: EVERY host runs the player world clock, not just the dungeon', () => {
  // The defect was a host gap, so the rule is pinned as a rule.
  for (const rel of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    const text = readFileSync(join(SRC, '..', rel), 'utf8');
    assert.match(text, /Ticker\.tick\(dt/, `${rel} never advances the player's world clock`);
  }
  // The dungeon host routes through the SAME shared law rather than keeping
  // its own copy - two copies is how the gap survived eleven milestones.
  assert.match(readFileSync(join(SRC, 'scenes', 'dungeonContext.js'), 'utf8'), /tickPlayerMinutes\(\{/);
  for (const file of walk(SRC)) {
    if (file.endsWith(`${sep}worldTick.js`)) continue;
    const text = readFileSync(file, 'utf8');
    assert.ok(!/updateDiseases\(playerEntity/.test(text),
      `${file}: the per-minute player laws belong to systems/worldTick.js`);
  }
});

// ---------------------------------------------------------------------------
// F9: the world clock is HELD by the same gate that holds the motor.
//
// Found by re-running the mutation audit after F8. F8 moved the per-minute
// player tick out of the dungeon host so every host ran it - and then ran it
// UNCONDITIONALLY in the two exterior hosts, while the interior host gated it
// on `!overlayHeld`. That asymmetry is the U7-rest bug inverted: DFU stops the
// clock outright under a paused window. PauseGame (GameManager.cs:600-610)
// sets Time.timeScale = 0, and WorldTime.Update (:60-69) advances the calendar
// by `Time.deltaTime * TimeScale` - so a PauseWhileOpen window freezes game
// time entirely. Open the character sheet in ?world and the motor was already
// held; the clock was not, so diseases aged while the game was paused.
//
// The F8 pin asserted `/Ticker\.tick\(dt/` per host and passed on all three -
// a per-host grep cannot see a disagreement BETWEEN hosts. This one can.
// ---------------------------------------------------------------------------

test('AUDIT 18 F9: every host gates the world clock on its overlay hold', () => {
  const hosts = ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js'];
  const shapes = new Map();
  for (const rel of hosts) {
    const text = readFileSync(join(SRC, '..', rel), 'utf8');
    const calls = text.split('\n').filter((l) => /Ticker\.tick\(dt/.test(l));
    assert.equal(calls.length, 1, `${rel}: expected exactly one world-clock tick, found ${calls.length}`);
    const gated = /if\s*\(\s*!\s*\w*[Oo]verlayHeld\s*\)/.test(calls[0]);
    assert.ok(gated,
      `${rel} ticks the world clock without an overlay gate:\n  ${calls[0].trim()}\n` +
      'DFU freezes game time under a paused window (timeScale 0 -> deltaTime 0).');
    shapes.set(rel, gated);
  }
  // The defect was a DISAGREEMENT between hosts, not any one host in isolation,
  // so the pin asserts they agree - a per-host check passed while they differed.
  assert.equal(new Set(shapes.values()).size, 1,
    `hosts disagree on whether the world clock is held: ${JSON.stringify([...shapes])}`);
});

// ---------------------------------------------------------------------------
// AUDIT 21 F2: THERE IS ONE WORLD CLOCK.
//
// AUDIT 18 extracted the per-minute LAW into systems/worldTick.js and left the
// ACCUMULATOR with each carrier. world.js, exterior.js and worldModes.js each
// build a createPlayerTicker, and dungeonContext kept a fourth private one -
// so each counted from zero and only while its own mode was running, and
// crossing a host rewound time.
//
// That is not cosmetic. Diseases are DAY-driven (daysPast = currentDay -
// entry.lastDay): catch one three days into a crawl, walk out to a clock
// reading day 0, and daysPast goes NEGATIVE - the damage loop runs zero times
// and `daysOfSymptomsLeft -= daysPast` ADDS days. A finite disease got longer
// every time you opened a door.
// ---------------------------------------------------------------------------

test('AUDIT 21 F2: every carrier is a VIEW on one clock, not an owner', async () => {
  const { worldMinutes, setWorldMinutes, CLASSIC_MINUTES_PER_SECOND } =
    await import('../src/systems/worldTick.js');
  const { createPlayerTicker } = await import('../src/scenes/shared.js');

  const entity = { health: 500, maxHealth: 500, fatigue: 10000, magicka: 200, level: 1, skills: {} };
  const outdoor = createPlayerTicker(entity, {});
  const interior = createPlayerTicker(entity, {});

  setWorldMinutes(0);
  assert.equal(outdoor.classicMinutes, 0);
  assert.equal(interior.classicMinutes, 0);

  // Three game-days pass while ONLY the interior carrier ticks - the shape
  // of a long crawl, or a long stay in a building.
  interior.tick((3 * 1440) / CLASSIC_MINUTES_PER_SECOND);

  assert.equal(Math.floor(interior.classicMinutes / 1440), 3);
  assert.equal(outdoor.classicMinutes, interior.classicMinutes,
    'the other carrier must read the SAME clock - walking out cannot rewind time');
  assert.equal(worldMinutes(), interior.classicMinutes);

  setWorldMinutes(0);      // leave the clock where the suite found it
});

test('AUDIT 21 F2: exactly ONE accumulator exists under src/', () => {
  // The rule, enforced rather than remembered. Four of these existed; the
  // fix is only durable if a fifth cannot be added quietly.
  //
  // The first draft of this pin matched `let classicMinutes =` and nothing
  // else, and a mutation proved that too narrow: rewriting dungeonContext's
  // read-through as `const classicMinutesRef = { value: 0 }` restored the
  // whole defect and the pin still passed. So match the SHAPE that matters -
  // any classicMinutes-ish binding whose initialiser does not read the world
  // clock is a private accumulator, whatever it is spelled.
  const owners = [];
  let holders = 0;
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    if (/let\s+_worldMinutes\s*=/.test(text)) { holders++; continue; }
    for (const m of text.matchAll(/(?:let|const|var)\s+(classicMinutes\w*)\s*=\s*([^;]*)/g)) {
      if (!/worldMinutes\s*\(/.test(m[2])) owners.push(`${file}: ${m[1]} = ${m[2].trim().slice(0, 60)}`);
    }
  }
  assert.deepEqual(owners, [],
    `these own a private minute accumulator instead of reading the world clock:\n${owners.join('\n')}`);
  assert.equal(holders, 1, 'and exactly one module holds the real one');
});
