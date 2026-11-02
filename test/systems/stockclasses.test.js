// CLASS-USE (2026-10-21): the eighteen stock classes' revised skill lists (src/systems/stockClasses.js,
// bible/04-Characters/Stock-Classes.md). The rules are pinned as rules, so a revision that breaks one fails here
// whatever class it touches, and the producers' wiring runs on records the real reader mints, so CI holds it without
// ARENA2; the real-data half holds the copied restrictions to the files and drives the classic skin's own art load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { STOCK_CLASS_REVISIONS, reviseStockCareer, reviseClassDescription, revisionSkills, isWholeRevision } from '../../src/systems/stockClasses.js';
import { SKILLS, SKILL_NAMES, MAGIC_SKILLS } from '../../src/systems/skills.js';
import { PROFICIENCY_BITS } from '../../src/systems/specialAdvantages.js';
import { loadCareers, applyHeadlessChargen } from '../../src/systems/chargenSession.js';
import { attachChargenText } from '../../src/ui/enhanced/enhancedChargen.js';
import { CLASS_CAREERS } from '../../src/systems/chargen.js';
import { ClassFile } from '../../src/formats/classFile.js';
import { TextRsc } from '../../src/formats/textRsc.js';
import { DFPalette } from '../../src/formats/dfPalette.js';
import { preloadChargenArt, classDescriptionLines } from '../../src/ui/chargenArt.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const fetchBytes = async (name) => new Uint8Array(readFileSync(join(ARENA2, name)));

const S = SKILLS;
const LANGUAGES = [S.Orcish, S.Harpy, S.Giantish, S.Dragonish, S.Nymph, S.Daedric, S.Spriggan, S.Centaurian, S.Impish];
const MOVEMENT = [S.Jumping, S.Running, S.Swimming, S.Climbing];
/** Rule 2's exceptions: the movement skills that ARE the class. */
const MOVEMENT_THAT_IS_THE_CLASS = { Acrobat: [S.Jumping, S.Running], Burglar: [S.Climbing], Monk: [S.Running], Barbarian: [S.Running] };
/** A weapon skill's ProficiencyFlags bit, the bit weaponArmorShieldsBitfield forbids it by. */
const WEAPON_BIT = {
  [S.ShortBlade]: PROFICIENCY_BITS.shortBlade, [S.LongBlade]: PROFICIENCY_BITS.longBlade, [S.HandToHand]: PROFICIENCY_BITS.handToHand,
  [S.Axe]: PROFICIENCY_BITS.axe, [S.BluntWeapon]: PROFICIENCY_BITS.bluntWeapon, [S.Archery]: PROFICIENCY_BITS.missileWeapon,
};

/** A CLASS*.CFG record as the reader takes it - 74 bytes, built so the career comes out of ClassFile itself. */
function cfgBytes({ name, weaponArmorShields = 0, skills = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], hp = 12 }) {
  const b = new Uint8Array(74);
  const v = new DataView(b.buffer);
  b[13] = (weaponArmorShields >>> 16) & 0xff; b[14] = weaponArmorShields & 0xff; b[15] = (weaponArmorShields >>> 8) & 0xff;
  skills.forEach((id, i) => { b[16 + i] = id; });
  for (let i = 0; i < name.length; i++) b[28 + i] = name.charCodeAt(i);
  v.setUint16(52, hp, true);
  v.setUint32(54, 0x10000, true);
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
  return b;
}
const minted = (opts) => { const cf = new ClassFile(); cf.load(cfgBytes(opts)); return cf.career; };

/** CLASS00..17.CFG's weaponArmorShieldsBitfield, as ClassFile reads them - the restrictions rule 1 is held against.
 *  Copied so the rule runs without ARENA2 (CI); the real-data pin below holds the copy to the files. */
const FILE_WEAPON_ARMOR_SHIELDS = Object.freeze([
  0x1daa, 0x1100, 0x1980, 0x1f00, 0x192a, 0x1d80, 0x1100, 0x1ec0, 0x1100,
  0x1f88, 0x1d90, 0x1f80, 0x1fc0, 0x201f00, 0x1000, 0x100, 0x0, 0x40,
]);
/** A fetchBytes that serves each CLASSnn.CFG as a record the real reader takes, with the file's restrictions and
 *  skill lists that are none of the revision's - so a career that comes back revised was revised on the way. */
const syntheticFetch = async (name) => {
  const m = /^CLASS(\d\d)\.CFG$/.exec(name);
  if (!m || Number(m[1]) >= CLASS_CAREERS.length) throw new Error(`no ${name} here`);
  const i = Number(m[1]);
  return cfgBytes({ name: CLASS_CAREERS[i], weaponArmorShields: FILE_WEAPON_ARMOR_SHIELDS[i], skills: [4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 1, 2] });
};
const listsOf = (c) => [c.primarySkills, c.majorSkills, c.minorSkills];
const revisedLists = (r) => [[...r.primary], [...r.major], [...r.minor]];

test('stock classes: one revision per stock career, in CLASS00..17 order, each 3/3/6 distinct real skills', () => {
  assert.deepEqual(STOCK_CLASS_REVISIONS.map((r) => r.name), [...CLASS_CAREERS]);
  for (const r of STOCK_CLASS_REVISIONS) assert.ok(isWholeRevision(r), `${r.name}'s lists are not 3/3/6 distinct skills`);
});

test('stock classes: rule 3 - no language skill takes a group slot', () => {
  for (const r of STOCK_CLASS_REVISIONS) {
    const langs = revisionSkills(r).filter((id) => LANGUAGES.includes(id)).map((id) => SKILL_NAMES[id]);
    assert.deepEqual(langs, [], `${r.name} spends a slot on a language`);
  }
});

test('stock classes: rule 2 - a movement skill is primary or major only where it is the class', () => {
  for (const r of STOCK_CLASS_REVISIONS) {
    const held = [...r.primary, ...r.major].filter((id) => MOVEMENT.includes(id)).sort((a, b) => a - b);
    assert.deepEqual(held, [...(MOVEMENT_THAT_IS_THE_CLASS[r.name] ?? [])].sort((a, b) => a - b), r.name);
  }
});

test('stock classes: rule 4 - a pure fighter carries Critical Strike as a primary', () => {
  for (const name of ['Warrior', 'Barbarian']) {
    const r = STOCK_CLASS_REVISIONS.find((x) => x.name === name);
    assert.ok(r.primary.includes(S.CriticalStrike), name);
    assert.equal(r.primary.filter((id) => WEAPON_BIT[id] !== undefined).length, 2, `${name}'s primaries are two weapons`);
  }
});

test('stock classes: the revision replaces the three lists and nothing else, on the career ClassFile mints', () => {
  const career = minted({ name: 'Barbarian', weaponArmorShields: 0x100, hp: 25 });
  const before = structuredClone(career);
  const out = reviseStockCareer(15, career);
  const r = STOCK_CLASS_REVISIONS[15];
  assert.deepEqual([out.primarySkills, out.majorSkills, out.minorSkills], [[...r.primary], [...r.major], [...r.minor]]);
  const strip = (c) => { const { primarySkills, majorSkills, minorSkills, ...rest } = c; return rest; };
  assert.deepEqual(strip(out), strip(before), 'a field other than the skill lists moved');
  assert.deepEqual(career, before, 'the reader\'s career was written');
  assert.equal(reviseStockCareer(18, career), career, 'an index with no revision comes back as it went in');
  assert.equal(reviseStockCareer(0, null), null);
});

test('stock classes: the Burglar is forbidden chain and plate, not leather and chain - its shields and weapons as the file has them', () => {
  const career = minted({ name: 'Burglar', weaponArmorShields: 0x1ec0 });   // CLASS07.CFG's bitfield
  assert.equal((career.weaponArmorShieldsBitfield >>> 6) & 7, 3, 'the fixture is the file\'s leather + chain');
  const out = reviseStockCareer(7, career);
  assert.equal((out.weaponArmorShieldsBitfield >>> 6) & 7, 6);
  assert.equal((out.weaponArmorShieldsBitfield >>> 9) & 0xf, (career.weaponArmorShieldsBitfield >>> 9) & 0xf);
  assert.equal(out.weaponArmorShieldsBitfield & 0x3f, career.weaponArmorShieldsBitfield & 0x3f);
  assert.equal(reviseStockCareer(16, minted({ name: 'Warrior' })).weaponArmorShieldsBitfield, 0, 'another class\'s armour is the file\'s');
});

test('stock classes: the description lists the revised primaries then majors, keeping the record\'s sentence around them', () => {
  const rows = [
    { text: 'Fighters of the far marches.', center: true },
    { text: 'The skills they use most are: Axe, Jumping,', center: true },
    { text: ' Running, Swimming, and more.', center: true },
    { text: ' Do you wish your character to be one?', center: true },
  ];
  const out = reviseClassDescription(15, rows);
  const r = STOCK_CLASS_REVISIONS[15];
  const n = (id) => SKILL_NAMES[id];
  assert.deepEqual(out.map((x) => x.text), [
    'Fighters of the far marches.',
    'The skills they use most are:',
    `${r.primary.map(n).join(', ')},`,
    `${n(r.major[0])}, ${n(r.major[1])}, and ${n(r.major[2])}.`,
    ' Do you wish your character to be one?',
  ]);
  assert.ok(out.every((x) => x.center === true), 'a written row lost its alignment');
  const wide = [{ text: 'x'.repeat(80) }, ...rows];
  assert.equal(reviseClassDescription(15, wide)[2].text, `The skills they use most are: ${r.primary.map(n).join(', ')},`,
    'the lead-in shares the primaries\' row when the record is wide enough');
  const bare = [{ text: 'A record that names no skills.' }, { text: 'Do you wish: one?' }];
  assert.equal(reviseClassDescription(15, bare), bare, 'a record with no colon before its question comes back as it is');
  assert.equal(reviseClassDescription(18, rows), rows, 'the custom class row has no revision');
});

test('stock classes: loadCareers hands the wizard every revised career, the file\'s restrictions kept and the Burglar\'s armour fixed', async () => {
  const careers = await loadCareers(syntheticFetch);
  assert.equal(careers.length, STOCK_CLASS_REVISIONS.length);
  careers.forEach(({ career }, i) => {
    assert.deepEqual(listsOf(career), revisedLists(STOCK_CLASS_REVISIONS[i]), STOCK_CLASS_REVISIONS[i].name);
    const armourFree = (bf) => bf & ~(0x7 << 6);
    assert.equal(armourFree(career.weaponArmorShieldsBitfield), armourFree(FILE_WEAPON_ARMOR_SHIELDS[i]), `${STOCK_CLASS_REVISIONS[i].name}'s weapons and shields moved`);
  });
  assert.equal((careers[7].career.weaponArmorShieldsBitfield >>> 6) & 7, 6, 'the Burglar: chain and plate');
});

test('stock classes: rule 1 - every class can fight from the first level with a skill its career allows', async () => {
  const careers = await loadCareers(syntheticFetch);
  careers.forEach(({ career }, i) => {
    const forbidden = career.weaponArmorShieldsBitfield & 0x3f;
    const fights = [...career.primarySkills, ...career.majorSkills].filter((id) =>
      id === S.Destruction || (WEAPON_BIT[id] !== undefined && (WEAPON_BIT[id] & forbidden) === 0));
    assert.ok(fights.length > 0, `${STOCK_CLASS_REVISIONS[i].name} has no primary or major it can fight with`);
    const listsForbidden = [...career.primarySkills, ...career.majorSkills, ...career.minorSkills].filter((id) => WEAPON_BIT[id] & forbidden);
    assert.deepEqual(listsForbidden.map((id) => SKILL_NAMES[id]), [], `${STOCK_CLASS_REVISIONS[i].name} trains a weapon it may not use`);
  });
});

test('stock classes (real data): the files are the restrictions the pins hold, and the reader still reads them exactly', { skip: skipReal }, async () => {
  for (let i = 0; i < CLASS_CAREERS.length; i++) {
    const raw = new ClassFile();
    raw.load(await fetchBytes(`CLASS${String(i).padStart(2, '0')}.CFG`));
    assert.equal(raw.career.weaponArmorShieldsBitfield, FILE_WEAPON_ARMOR_SHIELDS[i], `CLASS${i}.CFG's restrictions`);
  }
  const raw = new ClassFile();
  raw.load(await fetchBytes('CLASS15.CFG'));
  assert.deepEqual(raw.career.majorSkills, [S.Jumping, S.Running, S.Swimming], 'ClassFile must still read CLASS15.CFG exactly');
  const careers = await loadCareers(fetchBytes);
  careers.forEach(({ career }, i) => assert.deepEqual(listsOf(career), revisedLists(STOCK_CLASS_REVISIONS[i]), STOCK_CLASS_REVISIONS[i].name));
  assert.equal((careers[7].career.weaponArmorShieldsBitfield >>> 6) & 7, 6, 'the real Burglar: chain and plate');
});

test('stock classes (real data): every class description is re-written to name its own six skills', { skip: skipReal }, async () => {
  const rsc = new TextRsc();
  rsc.load(await fetchBytes('TEXT.RSC'));
  STOCK_CLASS_REVISIONS.forEach((r, i) => {
    const rows = rsc.linesById(2100 + i);
    const out = reviseClassDescription(i, rows);
    assert.notEqual(out, rows, `${r.name}'s record was not re-written`);
    const text = out.map((x) => x.text).join(' ');
    for (const id of [...r.primary, ...r.major]) assert.ok(text.includes(SKILL_NAMES[id]), `${r.name}: ${SKILL_NAMES[id]} missing`);
    for (const id of r.minor) assert.ok(!text.includes(`${SKILL_NAMES[id]},`) && !text.includes(`${SKILL_NAMES[id]}.`), `${r.name}: minor ${SKILL_NAMES[id]} listed`);
    assert.ok(/Do you wish/.test(out.at(-1).text), `${r.name}: the question is gone`);
    const widest = Math.max(...rows.map((x) => x.text.length));
    assert.ok(out.every((x) => x.text.length <= widest), `${r.name}: a row is wider than the record's own`);
  });
});

test('stock classes: the magic classes keep a school as a primary', () => {
  for (const name of ['Mage', 'Sorcerer', 'Healer', 'Battlemage', 'Spellsword', 'Nightblade']) {
    const r = STOCK_CLASS_REVISIONS.find((x) => x.name === name);
    assert.ok(r.primary.some((id) => MAGIC_SKILLS.includes(id)), name);
  }
});

test('stock classes: the headless ?class=N character is made from the revised career', async () => {
  const entity = { stats: {}, skills: 30, items: [] };
  const warn = console.warn;
  console.warn = () => {};   // no FACTION.TXT here: the path parks the faction store, as it says
  try { await applyHeadlessChargen(entity, 15, { fetchBytes: syntheticFetch }); } finally { console.warn = warn; }
  assert.deepEqual(listsOf(entity.career), revisedLists(STOCK_CLASS_REVISIONS[15]));
});

test('stock classes (real data): the classic skin\'s description box reads the revised description', { skip: skipReal }, async () => {
  const renderer = {
    uploadTexture: (g, name) => `tex:${name}`, releaseTexture: () => {}, drawScreenQuad: () => {},
    setScreenScissor: () => {}, clearScreenScissor: () => {}, gl: { drawingBufferWidth: 320, drawingBufferHeight: 200 },
  };
  const palette = new DFPalette();
  palette.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  await preloadChargenArt({ renderer, palette, fetchBytes });
  const r = STOCK_CLASS_REVISIONS[15];
  const text = classDescriptionLines(15).map((x) => x.text).join(' ');
  assert.ok(text.includes(`${SKILL_NAMES[r.major[0]]}, ${SKILL_NAMES[r.major[1]]}, and ${SKILL_NAMES[r.major[2]]}.`), text);
  assert.ok(!text.includes('Swimming'), 'the file\'s list is still shown');
});

test('stock classes: the enhanced skin\'s describeClass reads the revised description', () => {
  const rows = [{ text: 'The skills they use most are: Axe,' }, { text: ' Do you wish your character to be one?' }];
  const f = attachChargenText({}, { linesById: (id) => (id === 2115 ? rows : []) });
  const r = STOCK_CLASS_REVISIONS[15];
  assert.deepEqual(f.describeClass(15).map((x) => x.text), [
    'The skills they use most are:', `${r.primary.map((id) => SKILL_NAMES[id]).join(', ')},`,
    `${SKILL_NAMES[r.major[0]]}, ${SKILL_NAMES[r.major[1]]}, and ${SKILL_NAMES[r.major[2]]}.`, ' Do you wish your character to be one?',
  ]);
});
