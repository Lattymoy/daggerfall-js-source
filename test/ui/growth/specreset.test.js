// SPEC-RESET (2026-10-18, the owner: "Lets allow players to reset their ingame builds for a high cost"; asked, the owner
// chose the specialisations and 200k; bible/10-UI/Growth.md section 10). Pinned here:
//   the law     a family's path given up for SPEC_RESET_GOLD (systems/specReset.js) - paid as the Firmament's respec is
//               (court.js payUndoable: the coins, else the letters and then the coins, online the Empire's account after),
//               refused short of it or with nothing held; the masteries, the other family and the spellbook untouched; its
//               one ask stays made, and the mods fold at once
//   the save    a reset path saves as none and loads as none - and stays none across an older build's carry (the arcane
//               mirror, AUDIT SPEC-RESET L2-1)
//   the guide   the chosen path's Reset (ui/growth/specGuide.js): its ask, what it leaves, its refusals, driven in the
//               pause window over the fake document (last: its globals stand for the rest of the file)
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { playerEntity } from '../../../src/characters/playerEntity.js';
import { createCharacter } from '../../../src/systems/chargen.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { masterSkill } from '../../../src/systems/masterSkills.js';
import { letterOfCredit } from '../../../src/systems/inventory.js';
import { totalGoldAmount } from '../../../src/systems/court.js';
import { createBankAccounts, EMPIRE_ACCOUNT_REGION } from '../../../src/systems/banking.js';
import { computeEntityMods, entityStatMod } from '../../../src/systems/entityMods.js';
import '../../../src/systems/arcanePowers.js';   // the passives' folds, registered at import
import { raisePlayerSkills } from '../../../src/scenes/shared.js';
import * as AP from '../../../src/systems/arcanePaths.js';
import * as MP from '../../../src/systems/martialPaths.js';
import { specResetRefusal, resetSpec, resetHeld, resetGold } from '../../../src/systems/specReset.js';
import { signatureSpell } from '../../../src/systems/signatureSpells.js';
import { snapshotPlayer, restorePlayer } from '../../../src/systems/save/save.js';
import { specGuideModel, stateLine, SPEC_GUIDE_CSS } from '../../../src/ui/growth/specGuide.js';
import { growthDue } from '../../../src/ui/growth/growthTab.js';
import { dropStage } from '../../../src/ui/growth/growthStage.js';
import { _resetForTests } from '../../../src/systems/uiPrefs.js';

const { LongBlade: LB, ShortBlade: SB, Archery: AR, Axe: AX, Destruction: DES, Restoration: RES, Alteration: ALT, Mysticism: MYS, Illusion: ILL, Thaumaturgy: THA, HandToHand: HH, BluntWeapon: BL } = SKILLS;

/** A made character of the given career groups, every skill at 30, `mastered` mastered (growth1_tab's hero). */
function hero({ primary, major, minor, mastered = [] }) {
  const p = structuredClone(playerEntity);
  createCharacter(p, { name: 'Tester', hp: 12, primarySkills: primary, majorSkills: major, minorSkills: minor,
    stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } }, -1, { rolls: () => 0.5 });
  p.career = { ...p.career, primarySkills: primary, majorSkills: major, minorSkills: minor };
  p._online = true; p.level = 20;
  p.skills = p.skills.map(() => 30);
  for (const s of mastered) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true, `master ${s}`); }
  return p;
}
/** A spellsword: Long Blade, Archery and Destruction primary; Restoration, Alteration and Axe major; Mysticism, Illusion
 *  and Short Blade minor - so with the two primaries and two majors mastered, the one minor slot left still reaches a
 *  second path of each family (Restoration and Mysticism; Long Blade and Short Blade). */
const spellsword = (o = {}) => hero({ primary: [LB, AR, DES], major: [RES, ALT, AX], minor: [MYS, ILL, SB], ...o });
const letter = (value) => letterOfCredit(value);   // the game's own maker (inventory.js)
const family = (m, id) => m.families.find((f) => f.id === id);
/** A spellsword holding the Warden (Restoration and Alteration) and the Ranger (Long Blade and Archery), `gold` coins. */
function held(gold, o = {}) {
  const e = spellsword({ mastered: [LB, AR, RES, ALT], ...o });
  assert.equal(AP.choosePath(e, 'warden').ok, true);
  assert.equal(MP.chooseMartialPath(e, 'ranger').ok, true);
  e.goldPieces = gold;
  e.items = [];
  return e;
}

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('SPEC-RESET THE PRICE: 200,000 gold a family, one constant both laws\' boxes name - the arcane box, the martial box and both several-open boxes say it where they said "cannot be undone" (mutants: the price moved; a box\'s words left permanent)', () => {
  assert.equal(AP.SPEC_RESET_GOLD, 200000);
  const e = spellsword({ mastered: [LB, AR, RES, ALT] });
  assert.equal(AP.pathChoiceRows(e, 'warden').at(-1), 'Resetting it later costs 200,000 gold.');
  assert.equal(MP.martialChoiceRows(e, 'ranger').at(-1), 'Resetting it later costs 200,000 gold.');
  for (const rows of [AP.pathChoiceRows(e, 'warden'), MP.martialChoiceRows(e, 'ranger'), AP.pathsOpenRows([AP.PATH_BY_ID.warden]), MP.martialOpenRows([MP.MARTIAL_BY_ID.ranger], { growth: true })]) {
    assert.ok(!rows.join(' ').includes('cannot be undone'), rows.join(' | '));
  }
  // AUDIT SPEC-RESET L4-5: the several-open boxes say the price on a row of its own (the classic parchment box is 288 px)
  assert.deepEqual(AP.pathsOpenRows([AP.PATH_BY_ID.warden]).slice(-2), ['Choose one in your skill screen.', 'Resetting it later costs 200,000 gold.']);
  assert.deepEqual(MP.martialOpenRows([MP.MARTIAL_BY_ID.ranger], { growth: true }).slice(-2), ['See them all and choose one on the Growth tab of the pause menu.', 'Resetting it later costs 200,000 gold.']);
});

test('SPEC-RESET THE LAW: a held path given up for exactly the price - the coins first, then a letter of credit and the coins after (court.js deductGold\'s order); the family\'s path cleared and nothing else: the other family, the masteries and the spellbook stand; the Growth rail counts the choice open again (mutants: the price unpaid; the wrong family cleared; the masteries taken)', () => {
  const e = held(200000);
  e.spells = [signatureSpell('warden')];
  const mastered = [...e.masteredSkills];
  assert.equal(specResetRefusal(e, 'arcane'), null);
  assert.deepEqual(resetSpec(e, 'arcane'), { ok: true, text: 'Warden is reset.' });
  assert.equal(e.arcanePath, null);
  assert.equal(e.goldPieces, 0, 'every coin of the price');
  assert.equal(e.martialPath, 'ranger', 'the other family stands');
  assert.deepEqual(e.masteredSkills, mastered, 'the masteries stand');
  assert.deepEqual(e.spells.map((s) => s.path), ['warden'], 'the signature spell stays in the book');
  assert.equal(AP.pathCastSchool(e, e.spells[0], ILL), ILL, '...as an ordinary spell, cast in its own schools');
  assert.deepEqual(AP.pathChoices(e).map((p) => p.id), ['warden'], 'its pair still mastered: open again');
  assert.equal(growthDue({ entity: e }).specs, 1, 'the rail counts the choice waiting');
  // the martial family, paid with a letter and coins: the letter first (DFU's order when the purse alone falls short)
  e.goldPieces = 60000; e.items = [letter(150000)];
  assert.equal(totalGoldAmount(e), 210000);
  assert.equal(resetSpec(e, 'martial').ok, true);
  assert.equal(e.martialPath, null);
  assert.equal(e.items.length, 0, 'the letter spent whole');
  assert.equal(e.goldPieces, 10000, 'the coins pay what the letter left');
});

test('SPEC-RESET THE REFUSALS: short of the price by one (coins and letters together), nothing held, no such family - each refused with nothing moved (mutants: the gold unasked; the purse alone counted; a refusal that still clears or charges)', () => {
  const e = held(99999);
  e.items = [letter(100000)];
  assert.equal(specResetRefusal(e, 'arcane'), 'Resetting costs 200,000 gold. You have 199,999.');
  assert.deepEqual(resetSpec(e, 'arcane'), { ok: false, text: 'Resetting costs 200,000 gold. You have 199,999.' });
  assert.deepEqual([e.arcanePath, e.goldPieces, e.items[0].value], ['warden', 99999, 100000], 'nothing moved');
  e.goldPieces = 100000;
  assert.equal(specResetRefusal(e, 'arcane'), null, 'a letter is legal tender');
  const none = spellsword({ mastered: [LB, AR] });
  none.goldPieces = 500000;
  assert.equal(resetHeld(none, 'martial'), null);
  assert.equal(resetSpec(none, 'martial').text, 'You have no specialization of this kind to reset.');
  assert.equal(none.goldPieces, 500000);
  assert.equal(resetSpec(none, 'firmament').text, 'No such specialization.');
  // offline the refusal says what pays (no bank account stands in the pause window)
  const away = held(5);
  away._online = false;
  assert.equal(specResetRefusal(away, 'arcane'), 'Resetting costs 200,000 gold, paid in coins or letters of credit. You have 5.');
});

test('AUDIT SPEC-RESET L1-1/L2-2 THE BANK, ONLINE: online the Empire\'s account pays what the coins and letters leave, as the Firmament\'s respec does - 200,000 coins weigh 500 kg, no purse carries them; a loan is not gold; offline no account pays (mutants: the account unread; the account read offline; a loan counted; the coins skipped)', () => {
  const e = held(5000);
  e.bankAccounts = createBankAccounts();
  e.bankAccounts[EMPIRE_ACCOUNT_REGION].accountGold = 1000000;
  assert.equal(resetGold(e), 1005000);
  assert.equal(specResetRefusal(e, 'arcane'), null);
  assert.equal(resetSpec(e, 'arcane').ok, true);
  assert.deepEqual([e.goldPieces, e.bankAccounts[EMPIRE_ACCOUNT_REGION].accountGold], [0, 805000], 'the coins first, the account the rest');
  // a loan is no gold to pay with
  const loan = held(150000);
  loan.bankAccounts = createBankAccounts();
  loan.bankAccounts[EMPIRE_ACCOUNT_REGION].accountGold = -40000;
  assert.equal(resetGold(loan), 150000);
  assert.equal(specResetRefusal(loan, 'arcane'), 'Resetting costs 200,000 gold. You have 150,000.');
  // offline: the region's account is not reached from the pause window
  const away = held(5000);
  away._online = false;
  away.bankAccounts = createBankAccounts();
  away.bankAccounts[EMPIRE_ACCOUNT_REGION].accountGold = 1000000;
  assert.equal(resetGold(away), 5000);
  assert.equal(resetSpec(away, 'arcane').ok, false);
  assert.equal(away.bankAccounts[EMPIRE_ACCOUNT_REGION].accountGold, 1000000);
});

test('AUDIT SPEC-RESET L1-2 THE ONE ASK STAYS MADE: a path chosen on the guide (no ask ever made), then reset - the next quiet pass asks nothing, so it never offers back the path just paid away (mutants: the flag left; the wrong family\'s flag)', () => {
  const e = spellsword({ mastered: [LB, AR, RES, ALT] });
  e.masterSkillsInfoSeen = true; e.masteryPrompted = [...e.masteredSkills];
  assert.equal(AP.choosePath(e, 'warden').ok, true);
  assert.equal(MP.chooseMartialPath(e, 'ranger').ok, true);
  assert.equal(e.pathPrompted, undefined, 'the guide\'s Choose makes no ask');
  e.goldPieces = 400000; e.items = [];
  assert.equal(resetSpec(e, 'arcane').ok, true);
  assert.equal(resetSpec(e, 'martial').ok, true);
  assert.deepEqual([e.pathPrompted, e.martialPrompted], [true, true]);
  assert.equal(AP.nextPathChoice(e), null);
  assert.equal(MP.nextMartialChoice(e), null);
  const asked = [];
  raisePlayerSkills(e, { ask: (rows) => asked.push(rows), say: () => {} });
  assert.equal(asked.length, 0, 'no box on the next quiet pass');
});

test('AUDIT SPEC-RESET L1-3 THE MODS NOW: a passive\'s stats leave with the reset and come with a choice at once, not at the next magic round - the Enchanter\'s Glamour (mutants: no fold on the reset; none on the guide\'s Choose, the one ask\'s Yes or the classic sheet\'s)', () => {
  const e = hero({ primary: [ILL, THA, LB], major: [DES, SB, AX], minor: [AR, HH, BL], mastered: [ILL, THA, DES] });
  const enchanter = family(specGuideModel(e), 'arcane').paths.find((p) => p.id === 'enchanter');
  assert.equal(enchanter.choose().ok, true);
  const glamour = entityStatMod(e, 'personality');
  assert.ok(glamour > 0, 'the guide\'s Choose folds at once');
  e.goldPieces = 200000; e.items = [];
  assert.equal(resetSpec(e, 'arcane').ok, true);
  assert.equal(entityStatMod(e, 'personality'), 0, 'the reset folds at once');
  computeEntityMods(e);
  assert.equal(entityStatMod(e, 'personality'), 0);
  // the one ask's Yes (scenes/shared.js raisePlayerSkills) folds at once too
  const asked = hero({ primary: [ILL, THA, LB], major: [DES, SB, AX], minor: [AR, HH, BL], mastered: [ILL, THA] });
  asked.masterSkillsInfoSeen = true; asked.masteryPrompted = [...asked.masteredSkills]; asked.martialPrompted = true;
  raisePlayerSkills(asked, { ask: (rows, onYes) => onYes?.(), say: () => {} });
  assert.equal(asked.arcanePath, 'enchanter');
  assert.equal(entityStatMod(asked, 'personality'), glamour, 'the ask\'s Yes folds at once');
  // and the classic sheet's two Yes boxes (DFU's Yes/No - driven in the classic sheet's own suites), by source
  const sheet = readFileSync(new URL('../../../src/ui/charsheet.js', import.meta.url), 'utf8');
  assert.match(sheet, /const r = choosePath\(e, p\.id\); if \(r\.ok\) computeEntityMods\(e\);/);
  assert.match(sheet, /const r = chooseMartialPath\(e, p\.id\); if \(r\.ok\) computeEntityMods\(e\);/);
});

test('SPEC-RESET THE SAVE: a reset path saves as none and loads as none - the martial mirror goes with it, the arcane mirror says none, and the old signature spell in the book is no witness to a newer save\'s own null (mutants: the mirror kept; the witness read)', () => {
  const e = held(400000);
  e.spells = [signatureSpell('warden')];
  assert.equal(resetSpec(e, 'arcane').ok, true);
  assert.equal(resetSpec(e, 'martial').ok, true);
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(e)));
  assert.deepEqual([snap.arcanePath, snap.martialPath, snap.goldPieces], [null, null, 0]);
  assert.equal(snap.career.martialMirror, undefined, 'no mirror of a path given up');
  assert.deepEqual(snap.career.arcaneMirror, { path: null, prompted: true, of: snap.characterId });
  const back = structuredClone(playerEntity);
  restorePlayer(back, snap);
  assert.deepEqual([back.arcanePath, back.martialPath], [null, null]);
  assert.equal(back.career.arcaneMirror, undefined, 'the mirror is the save\'s, never the live career\'s');
});

test('AUDIT SPEC-RESET L2-1 AN OLDER BUILD\'S CARRY: a save that lost its `arcanePath` key is read by the career\'s arcane mirror, never the book - a path given up stays given up, a newer choice stays chosen; a mirror another character wrote, or a path its schools no longer back, is no mirror, and the book is read as before (mutants: the mirror unwritten; unread; read past the book\'s witness; the character\'s id unread)', () => {
  const carried = (e) => { const s = JSON.parse(JSON.stringify(snapshotPlayer(e))); delete s.arcanePath; delete s.pathPrompted; return s; };
  const load = (s) => { const b = structuredClone(playerEntity); restorePlayer(b, s); return b; };
  // reset, carried: none - the 200,000 is not paid for nothing
  const e = held(450000);
  e.spells = [signatureSpell('warden')];
  assert.equal(resetSpec(e, 'arcane').ok, true);
  const a = load(carried(e));
  assert.deepEqual([a.arcanePath, a.pathPrompted, a.goldPieces], [null, true, 250000]);
  // reset, a newer path chosen without its spell, carried: the newer path - never the old one back for free
  const n = held(250000, { mastered: [LB, AR, RES, ALT, MYS] });
  n.spells = [signatureSpell('warden')];
  assert.equal(resetSpec(n, 'arcane').ok, true);
  assert.equal(AP.choosePath(n, 'necromancer').ok, true);
  assert.equal(load(carried(n)).arcanePath, 'necromancer');
  // another character's mirror (an heir's inherited career): the book is read, as AUDIT SCHOOLS L3 F2 reads it
  const heir = carried(e);
  heir.career.arcaneMirror.of = 'someone-else';
  assert.equal(load(heir).arcanePath, 'warden', 'no mirror of its own: the witness');
  // a mirror whose path its schools no longer back (the judge's pathFindings): no mirror
  const bare = carried(n);
  bare.masteredSkills = bare.masteredSkills.filter((s) => s !== MYS);
  bare.spells = [];
  assert.equal(load(bare).arcanePath, null);
});

// ── the guide ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('SPEC-RESET THE GUIDE\'S MODEL: a held path\'s Reset - none with nothing held; its ask names the price, what goes, what stays and the paths then open (the held one among them); refused short of the gold, or where no other path of the family could ever open (mutants: the ask\'s lines; the only-path guard dropped; the guard read on the held path)', () => {
  const e = held(250000);
  const m = specGuideModel(e);
  assert.equal(family(specGuideModel(spellsword({ mastered: [LB, AR] })), 'arcane').reset, null, 'nothing held, no reset');
  const arc = family(m, 'arcane');
  assert.equal(arc.reset.refusal, null);
  // AUDIT SPEC-RESET L1-5: no signature spell bought - none stays; one bought - it stays, an ordinary spell
  assert.deepEqual(arc.reset.rows(), ['Reset Warden for 200,000 gold?', '',
    'You lose its passive, and its signature spell is no longer sold to you.', 'Your mastered skills stay mastered.', '',
    'Open to you after the reset: Warden.', 'More paths unlock as you master more skills.']);
  e.spells = [signatureSpell('warden')];
  assert.equal(family(specGuideModel(e), 'arcane').reset.rows()[2], 'You lose its passive. Its signature spell stays in your spellbook as an ordinary spell.');
  e.spells = [signatureSpell('necromancer')];
  assert.equal(family(specGuideModel(e), 'arcane').reset.rows()[2], 'You lose its passive, and its signature spell is no longer sold to you.', 'another path\'s spell is not this one\'s');
  // the closed paths point to the Reset
  const closed = family(m, 'arcane').paths.find((p) => p.state === 'closed');
  assert.equal(stateLine(family(m, 'arcane'), closed, true), 'You already chose Warden. You can have only one path of each kind; reset Warden to choose another.');
  // AUDIT SPEC-RESET L5-1: the martial half whole
  assert.deepEqual(family(m, 'martial').reset.rows(), ['Reset Ranger for 200,000 gold?', '',
    'You lose its passive and its signature technique.', 'Your mastered skills stay mastered.', '',
    'Open to you after the reset: Ranger.', 'More paths unlock as you master more skills.']);
  assert.equal(family(m, 'martial').reset.refusal, null);
  // the minor slot spent on Mysticism: Short Blade can never be mastered, so a martial reset buys back the Ranger
  assert.equal(family(specGuideModel(held(250000, { mastered: [LB, AR, RES, ALT, MYS] })), 'martial').reset.refusal,
    'No other martial path can open for you, so a reset would only let you choose Ranger again.');
  // AUDIT SPEC-RESET L5-2: a skill at 100 with a slot left ('ready', a Master Skills press away) is within reach
  const ready = hero({ primary: [LB, AR, DES], major: [RES, ALT, AX], minor: [MYS, SB, HH], mastered: [LB, AR, RES, ALT] });
  assert.equal(AP.choosePath(ready, 'warden').ok, true);
  ready.skills[MYS] = 100; ready.goldPieces = 250000; ready.items = [];
  const rr = family(specGuideModel(ready), 'arcane').reset;
  assert.equal(rr.refusal, null, 'Mysticism ready to master: another path is within reach');
  assert.deepEqual(rr.rows().slice(-2), ['Open to you after the reset: Warden.', 'More paths unlock as you master more skills.']);
  // AUDIT SPEC-RESET L5-5, then L3-1: the reset that can never help says so first, short of the gold too - else the
  // player saves 200,000 for it
  const never = held(5, { mastered: [LB, AR, RES, ALT, SB] });
  assert.equal(family(specGuideModel(never), 'arcane').reset.refusal, 'No other arcane path can open for you, so a reset would only let you choose Warden again.');
  assert.equal(family(specGuideModel(held(5)), 'arcane').reset.refusal, 'Resetting costs 200,000 gold. You have 5.', 'a reset that can help: the gold');
  // AUDIT SPEC-RESET L3-1: a path the class can never master, or whose slots are spent, is never 'closed' - a reset opens
  // only what its masteries can reach
  const st = (e, fam, id) => family(specGuideModel(e), fam).paths.find((p) => p.id === id).state;
  const thaPath = AP.PATHS.find((p) => p.schools.includes(THA) && p.schools.includes(RES)).id;
  assert.equal(st(never, 'arcane', thaPath), 'never', 'Thaumaturgy: no class skill');
  const minors = AP.PATHS.find((p) => p.schools.includes(MYS) && p.schools.includes(ILL)).id;
  assert.equal(st(never, 'arcane', minors), 'slots', 'two minor schools, the minor slot spent');
  assert.equal(st(held(5), 'arcane', AP.PATHS.find((p) => p.schools.includes(RES) && p.schools.includes(MYS)).id), 'closed', 'within reach after a reset: closed');
  // three schools mastered (every slot spent): the other two paths open at once, and none left to reach
  const three = held(250000, { mastered: [LB, AR, RES, ALT, MYS] });
  assert.equal(family(specGuideModel(three), 'arcane').reset.rows().at(-1), 'Open to you after the reset: Riftwalker, Warden, Necromancer.');
  assert.equal(three.arcanePath, 'warden', 'the model read it with nothing held, and wrote nothing');
  // the last slot spent on Short Blade: no other school can be mastered, so an arcane reset buys back the same path -
  // refused, and says so; the martial family, its third weapon mastered, may reset
  const spent = held(250000, { mastered: [LB, AR, RES, ALT, SB] });
  assert.equal(family(specGuideModel(spent), 'arcane').reset.refusal, 'No other arcane path can open for you, so a reset would only let you choose Warden again.');
  assert.equal(family(specGuideModel(spent), 'martial').reset.refusal, null);
  assert.equal(resetSpec(spent, 'arcane').ok, true, 'the guard is the guide\'s: the law itself pays and clears');
  // Master Skills off (offline): allowed, and the ask says how to choose again
  const off = held(250000);
  off._online = false; off.masterSkills = false;
  assert.equal(family(specGuideModel(off), 'arcane').reset.refusal, null);
  assert.equal(family(specGuideModel(off), 'arcane').reset.rows().at(-1), 'Master Skills is off. Turn it on to choose a specialization again.');
  // short of the gold: the law's refusal
  const poor = held(5);
  assert.equal(family(specGuideModel(poor), 'arcane').reset.refusal, 'Resetting costs 200,000 gold. You have 5.');
  // the reset itself is the law's
  assert.equal(arc.reset.go().ok, true);
  assert.equal(e.arcanePath, null);
  assert.equal(e.goldPieces, 50000);
});

test('SPEC-RESET THE GUIDE, DRIVEN: the chosen path\'s Reset press names the price; it asks in the window\'s Yes/No card, No keeps the path and the gold, Yes resets and says so, and the family\'s paths stand open again; short of the gold the press stands disabled and says why (mutants: the press drawn for a path not held; no ask; the refusal undrawn)', async () => {
  const { keydown } = await import('../../chargenDom.mjs');
  _resetForTests();
  const { mountEnhancedMenu } = await import('../../../src/ui/enhanced/enhancedMenu.js');
  const kept = { ...playerEntity };
  const restore = () => { for (const k of Object.keys(playerEntity)) if (!(k in kept)) delete playerEntity[k]; Object.assign(playerEntity, kept); };
  try {
    Object.assign(playerEntity, held(200500));
    const host = globalThis.document.createElement('div');
    globalThis.document.body.append(host);   // in the document, as the game's window is: the focus is given back to what stands there
    const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: () => {}, at: 'specs:martial' });
    const btn = (text) => host.querySelectorAll('button').find((b) => b.textContent.startsWith(text));
    const bar = (name) => host.querySelectorAll('button').find((b) => String(b.className).includes('gr-pathbar') && b.textContent.includes(name));
    const ask = () => globalThis.document.body.querySelectorAll('div').find((d) => String(d.className).includes('px-master-ask'));
    try {
      assert.ok(host.textContent.includes('Resetting one costs 200,000 gold.'), 'the lead names the price (AUDIT SPEC-RESET L5-4)');
      bar('Blademaster').onclick();
      assert.equal(btn('Reset\u00a0· 200,000 gold'), undefined, 'a path not held has no Reset');
      bar('Ranger').onclick();
      const reset = btn('Reset\u00a0· 200,000 gold');
      assert.ok(reset, 'the chosen path\'s Reset');
      assert.equal(reset.disabled, false);
      reset.focus();
      reset.onclick();
      assert.match(ask().textContent, /Reset Ranger for 200,000 gold\?/);
      // AUDIT SPEC-RESET L3-3: modal - named by its rows, the window under it inert, the focus on No; L3-4: a key held
      // down before it stood answers nothing by its repeat
      const card = ask().querySelectorAll('div').find((d) => d.getAttribute?.('role') === 'alertdialog');
      assert.equal(card.getAttribute('aria-modal'), 'true');
      assert.ok(card.getAttribute('aria-labelledby'), 'named by its rows');
      assert.equal(host.hasAttribute('inert'), true, 'the window under the card is out of reach');
      assert.equal(globalThis.document.activeElement?.textContent, 'No', 'the focus on No, the default');
      keydown('KeyY', globalThis.document.activeElement, { repeat: true, stopImmediatePropagation() { this.stopped = true; } });
      assert.ok(ask(), 'a held key\'s repeat answers nothing');
      assert.deepEqual([playerEntity.martialPath, playerEntity.goldPieces], ['ranger', 200500]);
      ask().querySelectorAll('button').find((b) => b.textContent === 'No').onclick();
      assert.equal(host.hasAttribute('inert'), false, 'the window back');
      assert.equal(globalThis.document.activeElement, btn('Reset\u00a0· 200,000 gold'), 'the focus back on its opener');
      assert.deepEqual([playerEntity.martialPath, playerEntity.goldPieces], ['ranger', 200500], 'No keeps both');
      btn('Reset\u00a0· 200,000 gold').onclick();
      const yes = ask().querySelectorAll('button').find((b) => b.textContent === 'Yes');
      yes.onclick();
      yes.onclick();   // L3-4: answered once, however many doors call it
      assert.deepEqual([playerEntity.martialPath, playerEntity.goldPieces], [null, 500]);
      assert.ok(host.textContent.includes('Ranger is reset.'), 'the note says so - the reset\'s, never a second answer\'s refusal');
      // L3-2: a status line, brought into view and focused once drawn
      const note = host.querySelectorAll('div').find((d) => String(d.className).includes('px-master-note'));
      assert.equal(note.getAttribute('role'), 'status');
      await Promise.resolve();
      assert.equal(globalThis.document.activeElement, note, 'the focus on the answer');
      assert.equal(btn('Reset\u00a0· 200,000 gold'), undefined, 'nothing held: no Reset');
      bar('Ranger').onclick();
      assert.ok(btn('Choose Ranger'), 'open again');
      // the arcane family's Reset, short of the gold now
      host.querySelectorAll('button').find((b) => String(b.className).includes('gr-fam') && b.textContent.startsWith('Arcane')).onclick();
      bar('Warden').onclick();
      assert.equal(btn('Reset\u00a0· 200,000 gold').disabled, true);
      const why = host.querySelectorAll('p').find((el) => el.textContent === 'Resetting costs 200,000 gold. You have 500.');
      assert.ok(why, 'the press says why');
      assert.match(String(why.className), /\bgr-reset-why\b/);
      assert.equal(btn('Reset\u00a0· 200,000 gold').getAttribute('aria-describedby'), why.id, 'the reason read with the press (L3-5)');
      assert.match(SPEC_GUIDE_CSS, /\.px-sys \.gr-reset-why \{/, 'its own dress (AUDIT SPEC-RESET L5-7)');
      // L3-6: the Grimoire fades the guide's refused press as it fades the pack's (by source - the dress is CSS)
      assert.match(readFileSync(new URL('../../../src/ui/grimoireDress.js', import.meta.url), 'utf8'), /\$\{G\} \.px-sys \.gr-acts \.act:is\(:disabled, \[disabled\]\) \{ color: rgba\(43,26,12,0\.35\) !important; \}/);
      btn('Reset\u00a0· 200,000 gold').onclick();
      assert.equal(ask(), undefined, 'a refused press asks nothing');
    } finally { menu.unmount(); host.remove(); }
    // AUDIT SPEC-RESET L5-6: a new visit drops the last one's note
    const host2 = globalThis.document.createElement('div');
    const menu2 = mountEnhancedMenu(host2, { mode: 'pause', hooks: {}, onAction: () => {}, at: 'specs:martial' });
    try { assert.ok(!host2.textContent.includes('Ranger is reset.'), 'the note is the visit\'s'); } finally { menu2.unmount(); }
  } finally { restore(); dropStage(); }
});
