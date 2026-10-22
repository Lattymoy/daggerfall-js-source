// THE EIGHTEEN STOCK CLASSES, REVISED (CLASS-USE, 2026-10-21, the owner: "Can you update the premade classes to be
// more useful?"). Record: bible/04-Characters/Stock-Classes.md; Port-Ledger section A, CLASS-USE.
//
// DFU's CreateCharClassSelect (:59-61) hands the player each CLASSnn.CFG career as the file has it, and several of
// those careers spend their skill groups badly: the Barbarian's three majors are Jumping, Running and Swimming, the
// Acrobat's primaries are Jumping, Dodging and Running and nothing it can hit with, the Mage and the Sorcerer spend two
// minors on Dragonish and Daedric, the Archer's second primary is Hand-to-Hand, the Healer's only weapon is a minor.
// Here each stock career's three skill lists are re-chosen by four rules, and the class keeps everything else the
// file gives it - its attributes, hit points a level, advancement multiplier, magery, advantages and disadvantages:
//
//   1. A class can fight from the first level: a primary or major in a weapon it may use, or in Destruction.
//   2. A movement skill (Jumping, Running, Swimming, Climbing) holds a primary or major only where it is the class
//      itself - the Acrobat's Jumping and Running, the Burglar's Climbing, the Monk's Running, the Barbarian's Running.
//   3. No language skill takes a group slot: every one of them is still learnt, as a miscellaneous skill.
//   4. A pure fighter's three primaries are two weapons and Critical Strike, which serves whichever one it carries,
//      rather than three weapons of which it swings one.
//
// One equipment fix rides along: CLASS07.CFG forbids the Burglar leather and chain and leaves it plate (its armour bits
// read 3, where the Mage's, the Battlemage's, the Nightblade's and the Thief's read 6), so a burglar could climb a wall in plate and not in leather. It is
// forbidden chain and plate instead.
//
// THE READER STAYS EXACT (Port-Doctrine, Scope): formats/classFile.js still reads every byte as DFU does; this is a
// layer over its career, applied where the player's stock careers are made (chargenSession.js `loadCareers`, the
// headless `?class=N`). Class ENEMIES keep the file's career (enemyEntity.js reads its own CLASSnn.CFG), and a saved
// character keeps the career it was made with (save.js keeps the career whole).

import { SKILLS, SKILL_COUNT, SKILL_NAMES } from './skills.js';
import { ARMOR_BITS, ARMOR_BITS_SHIFT } from './specialAdvantages.js';
import { t } from './textManager.js';   // the rewritten list's joins, in the player's language

const S = SKILLS;
const revision = (name, primary, major, minor, extra = {}) => Object.freeze({
  name, primary: Object.freeze(primary), major: Object.freeze(major), minor: Object.freeze(minor), ...extra,
});

/** By career index (CLASS00..17.CFG, CLASS_CAREERS' order). */
export const STOCK_CLASS_REVISIONS = Object.freeze([
  revision('Mage', [S.Destruction, S.Alteration, S.Mysticism], [S.Illusion, S.Thaumaturgy, S.Restoration],
    [S.Medical, S.ShortBlade, S.BluntWeapon, S.Dodging, S.Etiquette, S.Mercantile]),
  revision('Spellsword', [S.LongBlade, S.Restoration, S.Alteration], [S.Axe, S.BluntWeapon, S.Destruction],
    [S.Illusion, S.Thaumaturgy, S.Mysticism, S.ShortBlade, S.Dodging, S.Archery]),
  revision('Battlemage', [S.Destruction, S.LongBlade, S.Axe], [S.Thaumaturgy, S.Alteration, S.Restoration],
    [S.Illusion, S.Mysticism, S.Dodging, S.Archery, S.ShortBlade, S.BluntWeapon]),
  revision('Sorcerer', [S.Destruction, S.Mysticism, S.Alteration], [S.Thaumaturgy, S.Illusion, S.BluntWeapon],
    [S.Restoration, S.ShortBlade, S.Dodging, S.Medical, S.Mercantile, S.Streetwise]),
  revision('Healer', [S.Restoration, S.Medical, S.Dodging], [S.BluntWeapon, S.Alteration, S.Mysticism],
    [S.Thaumaturgy, S.Destruction, S.Illusion, S.Etiquette, S.Streetwise, S.ShortBlade]),
  revision('Nightblade', [S.Illusion, S.Stealth, S.ShortBlade], [S.Destruction, S.Backstabbing, S.Dodging],
    [S.Alteration, S.Thaumaturgy, S.CriticalStrike, S.Lockpicking, S.Restoration, S.Mysticism]),
  revision('Bard', [S.Etiquette, S.Streetwise, S.ShortBlade], [S.Illusion, S.Mercantile, S.Stealth],
    [S.Pickpocket, S.Lockpicking, S.Alteration, S.Restoration, S.Destruction, S.Archery]),
  revision('Burglar', [S.Lockpicking, S.Stealth, S.ShortBlade], [S.Climbing, S.Backstabbing, S.Dodging],
    [S.CriticalStrike, S.Pickpocket, S.Mercantile, S.Streetwise, S.Archery, S.Running],
    { forbiddenArmor: Object.freeze(['chain', 'plate']) }),
  revision('Rogue', [S.LongBlade, S.Stealth, S.Dodging], [S.Pickpocket, S.Backstabbing, S.Streetwise],
    [S.CriticalStrike, S.ShortBlade, S.Lockpicking, S.Archery, S.BluntWeapon, S.Running]),
  revision('Acrobat', [S.Dodging, S.Jumping, S.ShortBlade], [S.Running, S.Archery, S.Stealth],
    [S.Climbing, S.HandToHand, S.CriticalStrike, S.Backstabbing, S.Pickpocket, S.Swimming]),
  revision('Thief', [S.Pickpocket, S.Stealth, S.ShortBlade], [S.Backstabbing, S.Lockpicking, S.Dodging],
    [S.CriticalStrike, S.Climbing, S.Running, S.Streetwise, S.Mercantile, S.Archery]),
  revision('Assassin', [S.ShortBlade, S.CriticalStrike, S.Stealth], [S.Backstabbing, S.LongBlade, S.Archery],
    [S.Dodging, S.Lockpicking, S.Climbing, S.Pickpocket, S.Streetwise, S.BluntWeapon]),
  revision('Monk', [S.HandToHand, S.CriticalStrike, S.Dodging], [S.Medical, S.BluntWeapon, S.Running],
    [S.Archery, S.ShortBlade, S.Stealth, S.Jumping, S.Climbing, S.Swimming]),
  revision('Archer', [S.Archery, S.Dodging, S.CriticalStrike], [S.ShortBlade, S.LongBlade, S.Stealth],
    [S.Axe, S.BluntWeapon, S.HandToHand, S.Running, S.Climbing, S.Swimming]),
  revision('Ranger', [S.Archery, S.LongBlade, S.Stealth], [S.Axe, S.CriticalStrike, S.Dodging],
    [S.Climbing, S.Swimming, S.Running, S.Medical, S.ShortBlade, S.BluntWeapon]),
  revision('Barbarian', [S.Axe, S.BluntWeapon, S.CriticalStrike], [S.LongBlade, S.Dodging, S.Running],
    [S.Medical, S.Climbing, S.Jumping, S.Swimming, S.Archery, S.HandToHand]),
  revision('Warrior', [S.LongBlade, S.Axe, S.CriticalStrike], [S.BluntWeapon, S.Archery, S.Dodging],
    [S.ShortBlade, S.HandToHand, S.Medical, S.Climbing, S.Running, S.Swimming]),
  revision('Knight', [S.LongBlade, S.BluntWeapon, S.Etiquette], [S.Axe, S.CriticalStrike, S.Medical],
    [S.Archery, S.ShortBlade, S.Dodging, S.Mercantile, S.Running, S.Swimming]),
]);

/** The armour-type field of weaponArmorShieldsBitfield, whole. */
const ARMOR_MASK = 0x7 << ARMOR_BITS_SHIFT;

/**
 * A stock career as DFO hands it to the player: the CFG's career (ClassFile's, untouched) copied, with the revision's
 * skill lists and armour in place of the file's. An index with no revision, or no career, comes back as it went in.
 * @param {number} index  the career index (CLASS00..17.CFG)
 * @param {import('../formats/classFile.js').ClassCareer|null} career
 */
export function reviseStockCareer(index, career) {
  const r = STOCK_CLASS_REVISIONS[index];
  if (!r || !career) return career;
  const out = { ...career, primarySkills: [...r.primary], majorSkills: [...r.major], minorSkills: [...r.minor] };
  if (r.forbiddenArmor) {
    const bits = r.forbiddenArmor.reduce((m, k) => m | ARMOR_BITS[k], 0);
    out.weaponArmorShieldsBitfield = ((career.weaponArmorShieldsBitfield & ~ARMOR_MASK) | (bits << ARMOR_BITS_SHIFT)) >>> 0;
  }
  return out;
}

/** The skill ids a revision names, in group order - the check that every one is a real, distinct skill. */
export const revisionSkills = (r) => [...r.primary, ...r.major, ...r.minor];
export const isWholeRevision = (r) => {
  const all = revisionSkills(r);
  return r.primary.length === 3 && r.major.length === 3 && r.minor.length === 6
    && all.every((id) => Number.isInteger(id) && id >= 0 && id < SKILL_COUNT) && new Set(all).size === all.length;
};

const DESCRIPTION_ANCHOR = ':';
let _descriptionWarned = false;

/**
 * THE DESCRIPTION SAYS THE CLASS IT DESCRIBES. Each TEXT.RSC 2100+n record ends its account of the class with "the
 * skills most important to a <class> are:" (the Rogue's "relies on these skills most heavily:") and the file's six
 * primary and major skills, and its last row asks "Do you wish ...". With the lists revised those six are re-written
 * from the revision - the primaries, then the majors, each skill's name and the joins in the player's language - and
 * everything to the colon and the last row are the record's own. The lead-in shares the primaries' row when the two
 * fit the record's own widest row. A record with no colon before its last row comes back as it is, with one warning:
 * its list is the file's.
 * @param {number} index  the career index
 * @param {Array<{text: string}>|null} rows  the record's rows, as TextRsc.linesById gives them
 */
export function reviseClassDescription(index, rows) {
  const r = STOCK_CLASS_REVISIONS[index];
  if (!r || !Array.isArray(rows) || !rows.length) return rows;
  const end = rows.length - 1;   // the question
  const at = rows.findIndex((row, i) => i < end && typeof row?.text === 'string' && row.text.includes(DESCRIPTION_ANCHOR));
  if (at < 0) {
    if (!_descriptionWarned) console.warn(`[chargen] class description ${index} has no "${DESCRIPTION_ANCHOR}" list to revise; it reads the file's skills`);
    _descriptionWarned = true;
    return rows;
  }
  const anchor = rows[at];
  const head = anchor.text.slice(0, anchor.text.indexOf(DESCRIPTION_ANCHOR) + DESCRIPTION_ANCHOR.length);
  const names = (ids) => ids.map((id) => SKILL_NAMES[id]);
  const [p1, p2, p3] = names(r.primary);
  const [m1, m2, m3] = names(r.major);
  const primaries = t('chargen.class.skills.primary', '{p1}, {p2}, {p3},', { p1, p2, p3 });
  const widest = Math.max(...rows.map((row) => String(row?.text ?? '').length));
  const lead = `${head} ${primaries}`.length <= widest
    ? [{ ...anchor, text: `${head} ${primaries}` }]
    : [{ ...anchor, text: head }, { ...anchor, text: primaries }];
  return [...rows.slice(0, at), ...lead, { ...anchor, text: t('chargen.class.skills.major', '{m1}, {m2}, and {m3}.', { m1, m2, m3 }) }, ...rows.slice(end)];
}
