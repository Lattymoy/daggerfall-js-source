import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STATE_TABLES, RECORD_OFFSETS, MIRRORED, ORIENTATIONS, ANGLE_PER_ORIENTATION,
  ARCHIVE_FOOT, ARCHIVE_HORSE, ARCHIVE_LYCAN, lycanArchive, tableArchive,
  stateFor, roundToInt, orientationFor, signedAngleY, frameTime,
  FRAME_TIME_ON_FOOT, FRAME_TIME_RIDING, FOOTSTEP_FRAMES, chooseTable, attackTable, spriteKey,
} from '../src/player/eotbBillboard.js';

// ═══ EOTB3: THE PLAYER BILLBOARD ══════════════════════════════════
//
// The body you see in third person when you have no Morrowind data
// (Mac: "This is moreso for those who opt out of using morrowind").

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = JSON.parse(readFileSync(join(root, 'vendor/eye-of-the-beholder/states.json'), 'utf8'));

test('EOTB3: the GENERATED table is the mod’s own - all 168 states, checked not claimed', () => {
  // THE PIN THIS SLICE EXISTS FOR. The port carries 21 base records and
  // one wheel; the mod carries 168 written-out states. The claim that
  // those are the same thing is worth exactly nothing as a sentence in
  // a comment, so the mod's table is vendored out of the IL and the
  // port's is generated and compared, state for state, forever.
  const names = Object.keys(bundle.tables);
  assert.equal(names.length, 21, 'the bundle builds 21 tables');
  assert.deepEqual(names.sort(), Object.keys(STATE_TABLES).sort(), 'and the port knows the same 21');

  let checked = 0;
  for (const [table, states] of Object.entries(bundle.tables)) {
    assert.equal(states.length, ORIENTATIONS, `${table} has eight orientations`);
    for (let i = 0; i < states.length; i++) {
      const got = stateFor(table, i);
      assert.equal(got.record, states[i].record, `${table}[${i}] record`);
      assert.equal(got.mirror, states[i].mirror, `${table}[${i}] mirror`);
      assert.equal(got.frames, states[i].frames, `${table}[${i}] frames`);
      checked++;
    }
  }
  assert.equal(checked, 168, 'every state the bundle ships was compared, not a sample');
});

test('EOTB3: the wheel is the CLASSIC one - five records, the right half flipped', () => {
  // Stated once here so the shape is legible, and so a change to it
  // reddens on its own rather than only through the 168 above.
  assert.deepEqual([...RECORD_OFFSETS], [0, 1, 2, 3, 4, 3, 2, 1], 'front to back, then back out the other side');
  assert.deepEqual([...MIRRORED], [false, true, true, true, false, false, false, false],
    'the LEFT half is drawn flipped; forward and backward are drawn straight');
  // the two that face square on are never mirrored, and every mirrored
  // orientation has an unmirrored twin on the same record - which is
  // what "five records, eight ways" means
  for (let i = 1; i < 4; i++) {
    const twin = ORIENTATIONS - i;
    assert.equal(RECORD_OFFSETS[i], RECORD_OFFSETS[twin], `${i} and ${twin} draw the same record`);
    assert.notEqual(MIRRORED[i], MIRRORED[twin], '...one flipped, one not');
  }
  assert.equal(ANGLE_PER_ORIENTATION, 45);
});

test('EOTB3: every sprite the table asks for is a sprite the bundle actually ships', () => {
  // GENERATIVE, and the one that would catch a base record off by one
  // the moment it was typed: sweep every table, every orientation, and
  // ask the vendored art for the file. Nothing here is listed - the
  // question is asked of the tree.
  const missing = [];
  let asked = 0;
  for (const table of Object.keys(STATE_TABLES)) {
    for (let o = 0; o < ORIENTATIONS; o++) {
      const { record } = stateFor(table, o);
      const archive = tableArchive(table, { onFoot: 0, onHorse: 0, lycanthropyType: 1 });
      const f = join(root, 'vendor/eye-of-the-beholder/Textures', String(archive),
        `${spriteKey(archive, record, 0)}.png`);
      asked++;
      if (!existsSync(f)) missing.push(`${table}[${o}] -> ${spriteKey(archive, record, 0)}`);
    }
  }
  assert.equal(asked, 168, 'the sweep really ran over every state');
  assert.deepEqual(missing, [], 'states whose first frame the bundle does not ship');

  // ...and the sweep can FAIL: a record past the end of the archive has
  // no file, which is what an off-by-one base record would look like.
  assert.equal(existsSync(join(root, 'vendor/eye-of-the-beholder/Textures/112364/112364_60-0.png')), false,
    'record 60 is past the on-foot set - the existence check is not vacuous');
});

test('EOTB3: every on-foot and horse archive the settings can pick is present', () => {
  // `Graphics.OnFoot` is a 0..15 slider and `OnHorse` a 0..4, so the
  // port can ask for any of those archives; each must exist or the
  // slider has dead stops. Derived from the settings' own bounds.
  const need = [
    ...Array.from({ length: 16 }, (_, i) => ARCHIVE_FOOT + i),
    ...Array.from({ length: 5 }, (_, i) => ARCHIVE_HORSE + i),
    ARCHIVE_LYCAN, ARCHIVE_LYCAN + 1,
  ];
  assert.equal(need.length, 23, 'sixteen on foot, five mounted, two transformed');
  const absent = need.filter((a) => !existsSync(join(root, 'vendor/eye-of-the-beholder/Textures', String(a))));
  assert.deepEqual(absent, [], 'archives the settings can select and the tree does not carry');
  assert.deepEqual(bundle.archives, { foot: ARCHIVE_FOOT, horse: ARCHIVE_HORSE, lycan: ARCHIVE_LYCAN },
    'and the three bases are the bundle’s own');
});

test('EOTB3: the wereboar is the SECOND lycan archive, and everything else is the first', () => {
  // DFU's LycanthropyTypes: None 0, Werewolf 1, Wereboar 2. The mod
  // tests `== 2`, so the werewolf shares the default with "none" - a
  // `>= 1` reading would look just as sensible and be wrong.
  assert.equal(lycanArchive(0), ARCHIVE_LYCAN, 'none');
  assert.equal(lycanArchive(1), ARCHIVE_LYCAN, 'werewolf');
  assert.equal(lycanArchive(2), ARCHIVE_LYCAN + 1, 'wereboar');
  assert.equal(lycanArchive(3), ARCHIVE_LYCAN, 'anything else falls to the first');
  // and the tables route by their own names
  assert.equal(tableArchive('Idle', { onFoot: 7 }), ARCHIVE_FOOT + 7);
  assert.equal(tableArchive('GallopHorse', { onHorse: 3 }), ARCHIVE_HORSE + 3);
  assert.equal(tableArchive('AttackMeleeLycan', { lycanthropyType: 2 }), ARCHIVE_LYCAN + 1);
  assert.equal(tableArchive('MoveHorse', { onFoot: 9, onHorse: 1 }), ARCHIVE_HORSE + 1,
    'a horse table never reads the on-foot index');
});

test('EOTB3: RoundToInt is UNITY’s, not JavaScript’s - a half goes to the even side', () => {
  // The orientation snap divides by 45 and rounds, so a player standing
  // exactly side-on to the camera lands on a half. Unity rounds a half
  // to the nearest EVEN integer; JavaScript rounds it up. They disagree
  // on precisely the angles that sit on an orientation boundary, and
  // the symptom would be a sprite flipping one orientation early on one
  // side and not the other - which nobody would ever find by looking.
  assert.equal(roundToInt(0.5), 0, 'JS Math.round says 1');
  assert.equal(roundToInt(1.5), 2);
  assert.equal(roundToInt(2.5), 2, 'JS Math.round says 3');
  assert.equal(roundToInt(3.5), 4);
  assert.equal(roundToInt(-0.5), 0, 'JS Math.round says -0');
  assert.equal(roundToInt(-1.5), -2);
  // -2.5 is a case where the two AGREE, and it is kept because it
  // shows the rule is not simply "the opposite of JS": JS rounds a half
  // toward +infinity, so it lands on -2 here too.
  assert.equal(roundToInt(-2.5), -2);
  assert.equal(Math.round(-2.5), -2, 'they agree here, by different routes');
  // and it still rounds normally away from the halves
  assert.equal(roundToInt(1.4), 1);
  assert.equal(roundToInt(1.6), 2);
  assert.equal(roundToInt(-1.4), -1);
  assert.equal(roundToInt(-1.6), -2);
  // the contrast that makes the whole pin a finding rather than a
  // restatement: these are the inputs where JS would differ
  // (not -0.5 or -2.5: JS rounds a half toward +infinity, so it agrees
  // with the even rule on those two by coincidence)
  for (const h of [0.5, 2.5, 4.5, -1.5, -3.5]) {
    assert.notEqual(roundToInt(h), Math.round(h), `${h}: Unity and JS must differ here`);
  }
});

test('EOTB3: the orientation wheel - facing the camera is 0, and it turns the mod’s way', () => {
  const N = [0, 0, 1];   // the sprite faces +z
  assert.equal(orientationFor(N, [0, 0, 1]), 0, 'camera dead ahead: the forward record');
  assert.equal(orientationFor(N, [0, 0, -1]), 4, 'camera behind: the backward record');
  // a quarter turn each way lands on the two side orientations, and on
  // OPPOSITE sides of the wheel - which is what makes the negation in
  // the port real rather than decorative
  const right = orientationFor(N, [1, 0, 0]);
  const left = orientationFor(N, [-1, 0, 0]);
  assert.equal(right, 6);
  assert.equal(left, 2);
  assert.notEqual(right, left);
  assert.equal(stateFor('Idle', right).record, stateFor('Idle', left).record, 'the same record...');
  assert.notEqual(stateFor('Idle', right).mirror, stateFor('Idle', left).mirror, '...drawn the other way round');
  // every angle lands somewhere on the wheel and nowhere off it
  for (let deg = 0; deg < 360; deg += 3) {
    const r = deg * Math.PI / 180;
    const o = orientationFor(N, [Math.sin(r), 0, Math.cos(r)]);
    assert.ok(Number.isInteger(o) && o >= 0 && o < ORIENTATIONS, `${deg} deg -> ${o}`);
  }
  assert.equal(signedAngleY([0, 0, 1], [1, 0, 0]), 90, 'the angle itself is signed about up');
  assert.equal(signedAngleY([0, 0, 1], [-1, 0, 0]), -90);
});

test('EOTB3: the frame clock is four a second on foot, sixteen mounted, and the dial reads forwards', () => {
  assert.equal(frameTime(false, 1), FRAME_TIME_ON_FOOT, 'a quarter second a frame - classic’s own 4 fps');
  assert.equal(frameTime(true, 1), FRAME_TIME_RIDING, 'and 16 a second in the saddle');
  assert.equal(1 / frameTime(false, 1), 4);
  assert.equal(1 / frameTime(true, 1), 16);
  // `(2 - mod)`: a HIGHER WalkCycleSpeed is a SHORTER frame, so the
  // dial speeds the walk up even though the number it scales is a
  // duration. The sign is the finding.
  assert.ok(frameTime(false, 1.5) < frameTime(false, 1), 'a faster setting is a shorter frame');
  assert.ok(frameTime(false, 0.5) > frameTime(false, 1), 'and a slower one a longer frame');
  assert.equal(frameTime(false, 1.5), 0.25 * 0.5);
  assert.deepEqual([...FOOTSTEP_FRAMES], [2, 4], 'the two footfalls of the five-frame cycle');
});

test('EOTB3: chooseTable walks the mod’s ladder - dead, transformed, mounted, then what is readied', () => {
  const T = (s) => chooseTable(s);
  // the order is the law: a DEAD transformed player is the lycan death,
  // not the plain one, because transformed is tested first
  assert.equal(T({ died: true }), 'Death');
  assert.equal(T({ died: true, transformed: true }), 'DeathLycan');
  assert.equal(T({ died: true, riding: true }), 'Death', 'death beats the saddle');
  // mounted
  assert.equal(T({ riding: true, stopped: true }), 'IdleHorse');
  assert.equal(T({ riding: true, stopped: false }), 'MoveHorse');
  assert.equal(T({ riding: true, stopped: false, galloping: true }), 'GallopHorse');
  assert.equal(T({ riding: true, stopped: false, sheathed: false }), 'MoveHorse', 'the saddle beats a drawn weapon');
  // on foot, by what is readied
  assert.equal(T({ stopped: true }), 'Idle');
  assert.equal(T({ stopped: false }), 'Move');
  assert.equal(T({ stopped: true, sheathed: false }), 'IdleMelee');
  assert.equal(T({ stopped: false, sheathed: false }), 'MoveMelee');
  assert.equal(T({ stopped: true, sheathed: false, usingBow: true }), 'IdleRanged');
  assert.equal(T({ stopped: true, spellcasting: true }), 'IdleSpell');
  assert.equal(T({ stopped: true, spellcasting: true, sheathed: false }), 'IdleSpell', 'a readied spell beats a drawn blade');
  // transformed
  assert.equal(T({ transformed: true, stopped: true }), 'IdleLycan');
  assert.equal(T({ transformed: true, stopped: false, sheathed: false }), 'MoveMeleeLycan');
});

test('EOTB3: ReadyStance decides WHEN a drawn weapon shows, and 1 really does drop it while moving', () => {
  // 'Never' | 'When Idle' | 'When Idle or Moving', shipped at 2. At 1 a
  // player who draws a sword and walks is drawn walking UNARMED - which
  // looks like a bug and is the setting doing exactly what it says.
  const drawn = { sheathed: false };
  assert.equal(chooseTable({ ...drawn, stopped: true, readyStance: 0 }), 'Idle', 'never');
  assert.equal(chooseTable({ ...drawn, stopped: false, readyStance: 0 }), 'Move');
  assert.equal(chooseTable({ ...drawn, stopped: true, readyStance: 1 }), 'IdleMelee', 'when idle');
  assert.equal(chooseTable({ ...drawn, stopped: false, readyStance: 1 }), 'Move', '...and NOT while moving');
  assert.equal(chooseTable({ ...drawn, stopped: true, readyStance: 2 }), 'IdleMelee', 'idle or moving');
  assert.equal(chooseTable({ ...drawn, stopped: false, readyStance: 2 }), 'MoveMelee');
});

test('EOTB3: the attack table answers the stance that threw the blow', () => {
  assert.equal(attackTable({}), 'AttackMelee');
  assert.equal(attackTable({ usingBow: true }), 'AttackRanged');
  assert.equal(attackTable({ spellcasting: true }), 'AttackSpell');
  assert.equal(attackTable({ spellcasting: true, usingBow: true }), 'AttackSpell', 'a cast beats a bow');
  assert.equal(attackTable({ transformed: true, usingBow: true }), 'AttackMeleeLycan', 'and claws beat everything');
  // every attack table the chooser can reach is a real table
  for (const s of [{}, { usingBow: true }, { spellcasting: true }, { transformed: true }]) {
    assert.ok(STATE_TABLES[attackTable(s)], `${attackTable(s)} is a table`);
  }
});

test('EOTB3: the sprite key is the bundle’s own naming', () => {
  assert.equal(spriteKey(112364, 25, 3), '112364_25-3');
  const { record } = stateFor('AttackMelee', 0);
  assert.equal(spriteKey(ARCHIVE_FOOT, record, 0), '112364_25-0');
  assert.ok(existsSync(join(root, 'vendor/eye-of-the-beholder/Textures/112364/112364_25-0.png')),
    'and it names a file that is really there');
});
