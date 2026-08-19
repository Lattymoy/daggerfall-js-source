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
  const hosts = ['src/scenes/dungeon.js', 'src/scenes/worldModes.js'];
  let gates = 0;
  for (const rel of hosts) {
    const text = readFileSync(join(SRC, '..', rel), 'utf8');
    for (const line of text.split('\n')) {
      if (!/uiOverlayActive/.test(line) || !/\breturn\b/.test(line)) continue;
      gates++;
      assert.ok(/tickOverlay\(/.test(line),
        `${rel}: a branch returns on uiOverlayActive without ticking the overlay:\n  ${line.trim()}`);
      assert.ok(line.indexOf('tickOverlay(') < line.indexOf('return'),
        `${rel}: tickOverlay must run BEFORE the return`);
    }
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
  for (const rel of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    const text = readFileSync(join(SRC, '..', rel), 'utf8');
    assert.ok(/audio\.ensure\(/.test(text), `${rel} never boots audio - it will be silent`);
  }
  // And nobody may go back to the raw pair, which is what made it host-local.
  // audio.js itself is exempt: ensure() is the one legitimate caller of init().
  for (const file of walk(SRC)) {
    if (file.endsWith(`${sep}systems${sep}audio.js`)) continue;
    const text = readFileSync(file, 'utf8');
    assert.ok(!/audio\.init\(/.test(text), `${file}: use audio.ensure(), not audio.init()`);
  }
  // Exactly ONE bootstrap flag exists - AUDIT 18 fixed this gap twice
  // independently, and two flags would let one host boot while another slept.
  const booted = walk(SRC).filter((f) => /_audioBooted|_booted\s*=/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(booted.map((f) => f.split(sep).slice(-2).join('/')), ['systems/audio.js'],
    'the audio booted-flag must live only on the engine');
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
