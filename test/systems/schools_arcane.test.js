// SCHOOLS - ARCANE SPECIALISATIONS (2026-10-13; bible/06-Systems/Arcane-Specialisations.md). The Patreon chat, through the
// owner: "making mage characters recently ... they all kind of end up the same ... specialisation based on the two master
// skills you pick ... Restoration and Mysticism could be the requirements for a Necromancer sub-class". Asked, the owner
// chose: the pair chosen once among the mastered schools, permanent; a signature spell, a passive and every school paying
// past 100 in its own way; nothing below 100 changed; all of it at once.
// Pinned by execution through the real producers: the law (systems/arcanePaths.js), the records (systems/
// signatureSpells.js), the save (systems/save/save.js), the price (systems/spellcost.js), the one spell door (systems/
// effects.js applySpell), the cast engine's landing doors (scenes/hostMagic.js), every power's seam (systems/
// arcanePowers.js) and the judge (server-account/src/judge.js).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as AP from '../../src/systems/arcanePaths.js';
import * as POW from '../../src/systems/arcanePowers.js';
import { signatureSpell, signatureOffers } from '../../src/systems/signatureSpells.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill, setMasterSkills } from '../../src/systems/masterSkills.js';
import { SKILLS, MAGIC_SKILLS, skillValue } from '../../src/systems/skills.js';
import { liveStat } from '../../src/systems/statMods.js';
import { playerEntity, hurtPlayer } from '../../src/characters/playerEntity.js';
import { applySpell } from '../../src/systems/effects.js';
import { PORTED_KEYS } from '../../src/systems/spell/spellEffects.js';
import { calculateCastCost, castSchool, effectSchool, EFFECT_COST_TABLE } from '../../src/systems/spellcost.js';
import { spellPowerMult, spellPierce, schoolPotency, schoolMult } from '../../src/systems/spell/spellPower.js';
import { castRate } from '../../src/systems/castSpeed.js';
import { tryAbsorption } from '../../src/systems/absorption.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import { setStruck, _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setSigilDueling } from '../../src/systems/sigil/sigil.js';
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { computeEntityMods } from '../../src/systems/entityMods.js';
import { _resetPlayerHealForTests } from '../../src/systems/playerHeal.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { validCastData } from '../../src/net/wire.js';
import { characterFindings, judgeSave } from '../../server-account/src/judge.js';

const { Destruction: DES, Restoration: RES, Illusion: ILL, Alteration: ALT, Thaumaturgy: THA, Mysticism: MYS } = SKILLS;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The page's own switch (onlineLane.js isOnlinePage), for the doors that read it themselves. */
function page(online, fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: online ? '?online' : '' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}
const STATS = { strength: 50, intelligence: 80, willpower: 60, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
// primary Destruction, Restoration, Alteration; major Mysticism, Illusion, Thaumaturgy - every pair of the six reachable
const career = buildCustomCareer({ name: 'Mage', hp: 8, stats: STATS,
  skills: [DES, RES, ALT, MYS, ILL, THA, SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking] });
/** A chargen'd mage, online (Master Skills in force), level 20, with `schools` mastered and standing at `raw`. */
function mage(schools = [], raw = 150) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true; p.level = 20; p.activeEffects = [];
  p.health = p.maxHealth = 200; p.magicka = 0; p.maxMagicka = 300;
  for (const s of schools) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true, `master ${s}`); p.skills[s] = raw; }
  return p;
}
/** A mage of path `id`: its two schools mastered at `raw`, the path chosen. */
function pathMage(id, raw = 150) {
  const p = mage(AP.PATH_BY_ID[id].schools, raw);
  assert.equal(AP.choosePath(p, id).ok, true);
  return p;
}
/** Every power's memory fresh, and every test hook a test may have left set (AUDIT SCHOOLS L5 M5: the heal's carried
 *  fraction, the clock, the dice and the duel's word - a failing assertion left them for the next test). */
const reset = () => {
  POW._resetArcanePowersForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests();
  POW._setArcanePowersClockForTests(null); POW._setArcanePowersRandForTests(null);
  setSigilDueling(false); setPlayerDoor(null);
};
/** My cast's wrapper as the cast engine mints it - the token carrying what the cast took (hostMagic.js newCast). */
const castBy = (p, cost = 0) => ({ entity: p, cast: { cost } });
/** A foe that saves at 50 (Willpower 0), which a roll of 0.999 always fails. */
const foeEnt = (over = {}) => ({ isPlayer: false, career: {}, stats: { willpower: 0 }, activeEffects: [], level: 21, health: 100, maxHealth: 100, careerIndex: 1, ...over });
const eff = (type, subType, o = {}) => ({ type, subType, durationBase: 1, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
  magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, ...o });
const SELF = (...effects) => ({ name: 'Self', rangeType: 0, element: 4, effects });
const AT = (...effects) => ({ name: 'At', rangeType: 2, element: 4, effects });
/** A door: foe records (each `{ name, entity, ai: { feet } }`), the hurts it takes and the bundles cast on me. */
function door(foes = [], me = null) {
  const d = { hurts: [], cast: [] };
  setPlayerDoor({ foes: () => foes.filter((f) => !f.dead), feet: () => [0, 0, 0], hurtFoe: (f, n) => d.hurts.push([f.name, n]), castOnPlayer: (b) => d.cast.push(b), player: () => me });
  return d;
}
/** The real cast engine (scenes/hostMagic.js) for `p`, with the hosts' seams stubbed - its two landing doors are real. */
function engine(p, foes = [], rolls = () => 0.999) {
  return createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity }, playerEntity: p,
    playerSinks: { hurt() {}, heal(n) { p.health = Math.min(p.maxHealth, p.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {}, foes: () => foes, foeSinks: (t) => ({ hurt(n) { t.entity.health -= n; }, heal() {} }), absorbCtx: () => ({ inside: true, day: false }),
    rolls, startCastAnim: null,
  });
}
const rec = (name, entity, feet) => ({ name, entity, ai: { feet } });

test('SCHOOLS1 THE FIFTEEN: one path for each pair of the six schools, each id and index its own, each signature spell a classic record the wire carries, every effect one the library acts on and the price knows (mutants: a pair twice; an index shared; a fourth slot)', () => {
  assert.equal(AP.PATHS.length, 15);
  assert.deepEqual(AP.PATHS.map((p) => p.id), ['battlemage', 'trickster', 'riftwalker', 'warden', 'wardwright', 'shadowcaster', 'spellbreaker',
    'bloodmage', 'elementalist', 'seer', 'lightbringer', 'enchanter', 'necromancer', 'soulbinder', 'hierophant']);
  const pairs = new Set();
  for (let i = 0; i < MAGIC_SKILLS.length; i++) for (let j = i + 1; j < MAGIC_SKILLS.length; j++) {
    const p = AP.pathOfPair(MAGIC_SKILLS[i], MAGIC_SKILLS[j]);
    assert.ok(p, `${MAGIC_SKILLS[i]}+${MAGIC_SKILLS[j]} names a path`);
    assert.equal(AP.pathOfPair(MAGIC_SKILLS[j], MAGIC_SKILLS[i]), p, 'either order');
    pairs.add(p.id);
  }
  assert.equal(pairs.size, 15, 'every pair its own path');
  assert.equal(AP.pathOfPair(RES, RES), null, 'one school is no pair');
  assert.equal(AP.pathOfPair(RES, MYS).id, 'necromancer', 'the post\'s own: Restoration and Mysticism');
  assert.deepEqual(AP.PATHS.map((p) => p.spell.index), AP.PATHS.map((_, i) => AP.SIGNATURE_INDEX_BASE - 1 - i), 'their own band, -46101..-46115');
  for (const p of AP.PATHS) {
    const sp = signatureSpell(p.id);
    assert.equal(sp.path, p.id);
    assert.equal(sp.index, p.spell.index);
    assert.equal(sp.custom, true, 'saved whole, as every made spell');
    assert.equal(sp.effects.length, 3, 'the classic record\'s three slots');
    assert.ok(AP.isSignatureSpell(sp));
    assert.equal(AP.pathOfSignatureIndex(sp.index), p);
    for (const e of sp.effects.filter((x) => x.type > -1)) {
      const key = `${e.type},${e.subType & 0xff}`;
      assert.ok(PORTED_KEYS.has(key), `${p.id}: ${key} acts`);
      assert.ok(EFFECT_COST_TABLE[key], `${p.id}: ${key} is priced`);
    }
    // on the wire: a cast frame (a touch or a ranged single target) and a duel frame carry it as any spell
    assert.ok(validCastData({ to: 'peer-0002', level: 20, spell: { ...sp, rangeType: sp.rangeType === 0 ? 1 : sp.rangeType, effects: sp.effects.filter((x) => x.type > -1) } }), `${p.id} rides the cast frame`);
    assert.notEqual(signatureSpell(p.id), signatureSpell(p.id), 'a fresh record each call');
  }
  assert.equal(signatureSpell('nobody'), null);
  assert.equal(AP.isSignatureSpell({ ...signatureSpell('necromancer'), index: -46102 }), false, 'another path\'s index is no signature');
  assert.equal(AP.isSignatureSpell({ ...signatureSpell('necromancer'), path: 'nobody' }), false);
});

test('SCHOOLS1 THE CHOICE: two mastered schools open their path, three open three; Master Skills off, one school, or a path already chosen open none; the choice is PERMANENT and refused with a reason (mutants: one school opens; the choice undone; off still opens)', () => {
  assert.deepEqual(AP.pathChoices(mage([RES])), [], 'one school is no pair');
  const two = mage([RES, MYS]);
  assert.deepEqual(AP.pathChoices(two).map((p) => p.id), ['necromancer']);
  const three = mage([ALT, RES, MYS]);
  assert.deepEqual(AP.pathChoices(three).map((p) => p.id), ['riftwalker', 'warden', 'necromancer']);
  assert.equal(AP.pathRefusal(three, 'seer'), 'Master Illusion and Mysticism first.');
  assert.equal(AP.choosePath(three, 'seer').ok, false);
  assert.equal(AP.pathRefusal(three, 'nobody'), 'No such specialization.');
  const r = AP.choosePath(three, 'warden');
  assert.deepEqual(r, { ok: true, text: 'Specialization chosen: Warden.' });   // PIN MOVED (AUDIT MARTIAL L4 M1): one line the screen holds - where it is sold is the card's
  assert.equal(three.arcanePath, 'warden');
  assert.deepEqual(AP.pathChoices(three), [], 'chosen: nothing more open');
  assert.deepEqual(AP.choosePath(three, 'necromancer'), { ok: false, text: 'Your specialization is already chosen: Warden.' });
  assert.equal(three.arcanePath, 'warden', 'permanent');
  // offline the switch: off opens nothing and refuses
  const off = mage([RES, MYS]);
  off._online = false; off.masterSkills = false;
  assert.deepEqual(AP.pathChoices(off), []);
  assert.equal(AP.pathRefusal(off, 'necromancer'), 'Master Skills is off.');
  off.masterSkills = true;
  assert.deepEqual(AP.pathChoices(off).map((p) => p.id), ['necromancer'], 'offline with the switch on, as a mastery');
  // the ask, once a character
  const ask = mage([RES, MYS]);
  assert.equal(AP.nextPathChoice(ask)?.id, 'necromancer');
  ask.pathPrompted = true;
  assert.equal(AP.nextPathChoice(ask), null, 'asked once - the skill screen keeps it');
  // the box: what it does, and what undoing it costs
  const rows = AP.pathChoiceRows(mage([ALT, RES, MYS]), 'necromancer');
  assert.deepEqual(rows, ['Specialize as Necromancer?', 'Restoration and Mysticism', '',   // PIN MOVED (VOICE2): American spelling
    'Death\'s Due: Each kill restores 5% of your health and 5% of your magicka.',
    'Siphon Life (signature spell): Heals you for 50% of the damage dealt.', '', 'Resetting it later costs 200,000 gold.',   // PIN MOVED (SPEC-RESET)
    '2 other specializations are open to you.']);   // PIN MOVED (VOICE2): specialization (Voice.md rule 8)
  assert.equal(AP.pathChoiceRows(mage([ALT, RES, MYS]), 'necromancer', { others: false }).length, 7);
});

test('SCHOOLS1 AWAKE AND ASLEEP: a path acts for my own entity with Master Skills in force and both schools mastered - never a peer\'s stand-in, never while mentoring, never offline with the switch off, never with a school unmastered, never in a refereed fight (mutants: a peer\'s wakes; mentoring wakes; the duel wakes)', () => {
  reset();
  const p = pathMage('necromancer');
  assert.equal(AP.pathAwake(p)?.id, 'necromancer');
  assert.equal(POW.awakePathId(p), 'necromancer');
  assert.equal(AP.pathAwake({ ...p, peer: true }), null, 'a peer\'s stand-in');
  assert.equal(AP.pathAwake({ ...p, isPlayer: false }), null);
  assert.equal(AP.pathAwake({ ...p, _mentor: { level: 5 } }), null, 'mentoring');
  assert.equal(AP.pathAwake({ ...p, masteredSkills: [RES] }), null, 'a school not mastered (a forged save)');
  const offline = { ...p, _online: false, masterSkills: false };
  assert.equal(AP.pathAwake(offline), null, 'offline, the switch off');
  assert.equal(AP.pathAwake({ ...offline, masterSkills: true })?.id, 'necromancer', 'offline, the switch on');
  setSigilDueling(true);
  assert.equal(POW.awakePathId(p), null, 'a refereed fight');
  assert.equal(AP.pathAwake(p)?.id, 'necromancer', 'the law reads no duel - the powers do');
  setSigilDueling(false);
  // Master Skills switched off offline keeps the path - nothing is lost
  const kept = pathMage('necromancer');
  kept._online = false; kept.masterSkills = true;
  setMasterSkills(kept, false);
  assert.equal(kept.arcanePath, 'necromancer');
  assert.equal(AP.pathAwake(kept), null);
});

test('SCHOOLS1 THE SAVE: the path and its one ask round-trip; an id no table holds reads as none; the signature spell is carried whole (mutants: the path dropped on save; an unknown id kept)', () => {
  const p = pathMage('seer');
  p.pathPrompted = true;
  p.spells = [signatureSpell('seer')];
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p)));
  assert.equal(snap.arcanePath, 'seer');
  assert.equal(snap.pathPrompted, true);
  const back = structuredClone(playerEntity);
  restorePlayer(back, snap);
  assert.equal(back.arcanePath, 'seer');
  assert.equal(back.pathPrompted, true);
  assert.equal(back.spells.length, 1);
  assert.equal(back.spells[0].path, 'seer');
  assert.ok(AP.isSignatureSpell(back.spells[0]), 'the record comes back a signature spell');
  const forged = structuredClone(playerEntity);
  restorePlayer(forged, { ...snap, arcanePath: 'archlich' });
  assert.equal(forged.arcanePath, null, 'no such path');
  const old = structuredClone(playerEntity);
  const { arcanePath: _a, pathPrompted: _b, ...before } = snap;
  before.career = { ...before.career }; delete before.career.arcaneMirror;   // PIN MOVED (AUDIT SPEC-RESET L2-1): a save from before the arc carries no mirror either
  restorePlayer(old, { ...before, spells: [] });   // and no book to bear witness (an older build's save with one: audit_schools)
  assert.equal(old.arcanePath, null, 'a save from before the arc');
  assert.equal(old.pathPrompted, false);
});

test('SCHOOLS3 THE SHELF AND THE PRICE: the Buy Spells shelf offers my awake path\'s signature spell to me alone; it is priced and taught by the path\'s two schools - Siphon Life\'s Damage Health by the stronger of Restoration and Mysticism, not a Destruction never chosen - and by its own school again when the path sleeps (mutants: the shelf offers asleep; the pair ignored; the weaker of the pair)', () => {
  const p = pathMage('necromancer');
  assert.deepEqual(signatureOffers(p).map((s) => [s.name, s.path]), [['Siphon Life', 'necromancer']]);
  assert.deepEqual(signatureOffers(mage([RES, MYS])), [], 'no path chosen');
  assert.deepEqual(signatureOffers({ ...p, peer: true }), []);
  assert.match(src('src/scenes/worldModes.js'), /offered: \(\) => \[\.\.\.sbi\.values\(\), [^\n]*\.\.\.signatureOffers\(playerEntity\)\]/, 'the shelf asks for it');
  const sp = signatureSpell('necromancer');
  const dh = sp.effects[0];
  assert.equal(effectSchool(dh), DES, 'Damage Health is Destruction\'s');
  // a mastery is never undone, and a value may fall below it: under 100 no cap muddles the price
  p.skills[RES] = 90; p.skills[MYS] = 60; p.skills[DES] = 20;
  assert.equal(castSchool(p, sp, dh), RES, 'cast in the stronger of the pair');
  p.skills[MYS] = 95;
  assert.equal(castSchool(p, sp, dh), MYS);
  p.skills[MYS] = 60;
  assert.equal(castSchool(p, { ...sp, path: undefined }, dh), DES, 'a spell no signature: its own school');
  assert.equal(castSchool(p, signatureSpell('seer'), dh), DES, 'another path\'s signature: its own school');
  // the price, through the real calculateCastCost (offline: DFU's own price term, so the skill shows plainly)
  const priced = (who) => page(false, () => calculateCastCost(sp, who, { portMods: false }).sp);
  const asRes = structuredClone(p); asRes.skills[DES] = asRes.skills[RES];
  const plainPrice = page(false, () => calculateCastCost({ ...sp, path: undefined }, asRes, { portMods: false }).sp);
  const offP = { ...p, _online: false, masterSkills: true };
  assert.equal(priced(offP), plainPrice, 'priced as if Destruction stood at Restoration\'s 90');
  const asleep = { ...p, _online: false, masterSkills: false };
  assert.ok(priced(asleep) > priced(offP), 'asleep, Destruction\'s 20 prices it again');
  // the tally: the cast engine teaches the school it is cast in
  assert.match(src('src/scenes/hostMagic.js'), /tallySkill\(playerEntity, castSchool\(playerEntity, sp, e\), 1\);/);
});

test('SCHOOLS2 THE SCHOOLS PAST 100: online, each school\'s climb past 100 is 1% a point of what it does, to x1.4 - Restoration\'s heals, Alteration\'s Shield, Illusion\'s concealments and Thaumaturgy\'s wards on me, Mysticism\'s chances at a foe; never offline, while mentoring, on another or in a refereed fight (mutants: offline too; on another; in a duel; a heal unscaled; the shield unscaled; the rounds unscaled; the ward\'s chance unscaled; Silence\'s chance unscaled)', () => {
  reset();
  const at = (raw) => mage([RES, ALT, ILL, MYS, THA].slice(0, 2), raw);
  // the law itself: any school, the same ladder as BAL9b's Destruction
  const r200 = mage([RES], 200);
  assert.deepEqual([100, 150, 200].map((v) => page(true, () => schoolPotency(mage([RES], v), { school: RES }))), [1, 1.17, 1.4]);
  assert.equal(page(false, () => schoolPotency(r200, { school: RES })), 1, 'offline: none');
  assert.equal(page(true, () => schoolMult(r200, r200, RES, { self: true })), 1.4);
  assert.equal(page(true, () => schoolMult(r200, { ...r200 }, RES, { self: true })), 1, 'another body');
  setSigilDueling(true);
  assert.equal(page(true, () => schoolMult(r200, r200, RES, { self: true })), 1, 'a refereed fight');
  setSigilDueling(false);
  assert.equal(at(100).skills[RES], 100);
  // Restoration: Heal Health on myself
  const heal = SELF(eff(10, 8, { magnitudeBaseLow: 50, magnitudeBaseHigh: 50 }));
  const healed = (who, online, target = who) => page(online, () => applySpell(heal, 20, target, { heal() {} }, () => 0.5, { entity: who }).healed);
  assert.equal(healed(r200, true), 70, 'x1.4');
  assert.equal(healed(r200, false), 50, 'offline');
  assert.equal(healed(mage([RES], 100), true), 50, 'at 100');
  assert.equal(healed({ ...r200, _mentor: { level: 4 } }, true), 50, 'mentoring');
  assert.equal(healed(r200, true, { ...r200, activeEffects: [] }), 50, 'on another');
  // Regenerate: fixed at the cast, every round
  const regen = SELF(eff(18, 255, { durationBase: 3, magnitudeBaseLow: 10, magnitudeBaseHigh: 10 }));
  let got = 0;
  page(true, () => applySpell(regen, 20, r200, { heal: (n) => { got += n; }, say() {} }, () => 0.5, { entity: r200 }));
  assert.equal(got, 14, 'the first round x1.4');
  assert.equal(r200.activeEffects.find((a) => a.kind === 'regenerate').school, RES, 'its school, read each round (AUDIT SCHOOLS L2 F3)');
  // Alteration: the Shield's pool
  const a200 = mage([ALT], 200);
  const shield = SELF(eff(35, 255, { durationBase: 5, magnitudeBaseLow: 50, magnitudeBaseHigh: 50 }));
  page(true, () => applySpell(shield, 20, a200, {}, () => 0.5, { entity: a200 }));
  assert.equal(a200.activeEffects.find((a) => a.kind === 'shield').startingShield, 70);
  const a100 = mage([ALT], 100);
  page(true, () => applySpell(shield, 20, a100, {}, () => 0.5, { entity: a100 }));
  assert.equal(a100.activeEffects.find((a) => a.kind === 'shield').startingShield, 50);
  // Illusion: a concealment's rounds on me
  const i200 = mage([ILL], 200);
  page(true, () => applySpell(SELF(eff(13, 0, { durationBase: 10 })), 20, i200, {}, () => 0.5, { entity: i200 }));
  assert.equal(i200.activeEffects.find((a) => a.kind === 'invisNormal').roundsRemaining + 1, 14, '10 rounds x1.4');
  const i100 = mage([ILL], 100);
  page(true, () => applySpell(SELF(eff(13, 0, { durationBase: 10 })), 20, i100, {}, () => 0.5, { entity: i100 }));
  assert.equal(i100.activeEffects.find((a) => a.kind === 'invisNormal').roundsRemaining + 1, 10);
  // Thaumaturgy: a ward's chance on me
  const t200 = mage([THA], 200);
  page(true, () => applySpell(SELF(eff(21, 255, { durationBase: 5, chanceBase: 50 })), 20, t200, {}, () => 0.5, { entity: t200 }));
  assert.equal(t200.activeEffects.find((a) => a.kind === 'spellReflection').chance, 70);
  const t200r = mage([THA], 200);
  page(true, () => applySpell(SELF(eff(22, 255, { durationBase: 5, chanceBase: 80 })), 20, t200r, {}, () => 0.5, { entity: t200r }));
  assert.equal(t200r.activeEffects.find((a) => a.kind === 'spellResistance').chance, 100, 'never past 100');
  // Mysticism: a chance at a foe - Silence lands at a roll Mysticism 100 misses
  const silence = AT(eff(19, 255, { durationBase: 5, chanceBase: 50 }));
  const silenced = (who) => { const f = foeEnt(); page(true, () => applySpell(silence, 20, f, {}, () => 0.6, { entity: who }, { bypassSavingThrows: true })); return f.activeEffects.some((a) => a.kind === 'silenced'); };
  assert.equal(silenced(mage([MYS], 200)), true, '70 against a roll of 60');
  assert.equal(silenced(mage([MYS], 100)), false, '50 against 60');
  // Soul Trap's chance, and Dispel's sweep
  const m200 = mage([MYS], 200);
  const f = foeEnt({ mobileType: 3 });   // a monster: a trap holds on no humanoid (SoulTrap.cs BecomeIncumbent)
  page(true, () => applySpell(AT(eff(12, 255, { durationBase: 5, chanceBase: 50 })), 20, f, {}, () => 0.999, { entity: m200 }));
  assert.equal(f.activeEffects.find((a) => a.kind === 'soulTrap').chance, 70);
  const dispel = page(true, () => applySpell(SELF(eff(6, 1, { chanceBase: 50 })), 20, m200, {}, () => 0.5, { entity: m200 }));
  assert.equal(dispel.dispel.chance, 70);
});

test('SCHOOLS3 A SIGNATURE SPELL\'S POTENCY READS ITS CAST SCHOOL: a Necromancer\'s Siphon Life strikes harder with Restoration past 100, and a spell of no path reads Destruction (mutants: the school dropped)', () => {
  reset();
  const p = pathMage('necromancer', 200);
  p.skills[DES] = 20;
  const sp = signatureSpell('necromancer');
  const landed = (spell) => { let d = 0; page(true, () => applySpell(spell, 20, foeEnt(), { hurt: (n) => { d += n; } }, () => 0.999, { entity: p })); return d; };
  const plainBolt = { ...sp, path: undefined };
  assert.equal(landed(sp), Math.max(1, Math.round(landed(plainBolt) * 1.4)), 'Restoration\'s 140 strikes');
  assert.match(src('src/systems/effects.js'), /casterDamageScaled\(magnitude\(e\), caster\?\.entity, target, schoolOf\(e\)\)/);
});

test('SCHOOLS3 THE RIDERS, through the cast engine\'s landing door: each signature spell of MY awake path that lands on a foe does its own - and none for a plain spell, another path\'s, a peer\'s or asleep (mutants: Siphon Life heals nothing; the half; Rift Lance reaches far; Chain Lightning a third foe; Blood Boil above the line; the Seer\'s mark forgotten; the refund dropped; a rider asleep)', () => {
  reset();
  // Necromancer: half of what it lands heals me
  const n = pathMage('necromancer', 100);
  n.health = 50;
  const lich = rec('lich', foeEnt({ careerIndex: 15, health: 500, maxHealth: 500 }), [0, 0, 5]);
  door([lich], n);
  const m1 = engine(n, [lich]);
  const r1 = m1.applySpellToFoe(signatureSpell('necromancer'), 20, lich, { entity: n });
  assert.ok(r1.damage > 0);
  assert.equal(n.health, 50 + Math.floor(r1.damage / 2), 'half of it, healed');
  const h = n.health;
  m1.applySpellToFoe({ ...signatureSpell('necromancer'), path: undefined }, 20, lich, { entity: n });
  assert.equal(n.health, h, 'a plain bolt heals nothing');
  m1.applySpellToFoe(signatureSpell('seer'), 20, lich, { entity: n });
  assert.equal(n.health, h, 'another path\'s spell');
  m1.applySpellToFoe(signatureSpell('necromancer'), 20, lich, { entity: { level: 20 } }, { peerCaster: 'peer-0002' });
  assert.equal(n.health, h, 'a peer\'s strike spell');
  n._online = false; n.masterSkills = false;
  m1.applySpellToFoe(signatureSpell('necromancer'), 20, lich, { entity: n });
  assert.equal(n.health, h, 'asleep');
  // Riftwalker: every other foe within 4 m takes a third; one at 5 m none
  reset();
  const rw = pathMage('riftwalker', 100);
  const a = rec('a', foeEnt({ health: 500, maxHealth: 500 }), [0, 0, 0]);
  const near = rec('near', foeEnt(), [3, 0, 0]);
  const far = rec('far', foeEnt(), [5, 0, 0]);
  const d1 = door([a, near, far], rw);
  const r2 = engine(rw, [a, near, far]).applySpellToFoe(signatureSpell('riftwalker'), 20, a, { entity: rw });
  assert.deepEqual(d1.hurts, [['near', Math.round(r2.damage / 3)]]);
  // Elementalist: the two nearest others within 8 m, half each
  reset();
  const el = pathMage('elementalist', 100);
  const t0 = rec('t0', foeEnt({ health: 500, maxHealth: 500 }), [0, 0, 0]);
  const o = [rec('o1', foeEnt(), [2, 0, 0]), rec('o2', foeEnt(), [6, 0, 0]), rec('o3', foeEnt(), [7, 0, 0]), rec('o4', foeEnt(), [9, 0, 0])];
  const d2 = door([t0, ...o], el);
  const r3 = engine(el, [t0, ...o]).applySpellToFoe(signatureSpell('elementalist'), 20, t0, { entity: el });
  assert.deepEqual(d2.hurts, [['o1', Math.round(r3.damage / 2)], ['o2', Math.round(r3.damage / 2)]]);
  // Bloodmage: a foe left under 30% boils again for as much; one above, never
  reset();
  const bm = pathMage('bloodmage', 100);
  const probe = rec('probe', foeEnt({ health: 1e6, maxHealth: 1e6 }), [0, 0, 0]);
  door([probe], bm);
  const bolt = engine(bm, [probe]).applySpellToFoe(signatureSpell('bloodmage'), 20, probe, { entity: bm }).damage;
  const low = rec('low', foeEnt({ health: bolt + 100, maxHealth: 1000 }), [0, 0, 0]);
  const d3 = door([low], bm);
  const r4 = engine(bm, [low]).applySpellToFoe(signatureSpell('bloodmage'), 20, low, { entity: bm });
  assert.ok(low.entity.health > 0 && low.entity.health < 300, 'the bolt left it under the line (30% of 1000)');
  assert.deepEqual(d3.hurts, [['low', r4.damage]]);
  const high = rec('high', foeEnt({ health: 1000, maxHealth: 1000 }), [0, 0, 0]);
  const d4 = door([high], bm);
  engine(bm, [high]).applySpellToFoe(signatureSpell('bloodmage'), 20, high, { entity: bm });
  assert.deepEqual(d4.hurts, [], 'above the line');
  // Seer: the struck foe laid open - my damage spells at it meet its throw 20 lower, for 12 seconds
  reset();
  let now = 100;
  POW._setArcanePowersClockForTests(() => now);
  const se = pathMage('seer', 100);
  const mark = rec('mark', foeEnt({ health: 500, maxHealth: 500 }), [0, 0, 0]);
  door([mark], se);
  assert.equal(spellPierce(se, mark.entity), 0);
  engine(se, [mark]).applySpellToFoe(signatureSpell('seer'), 20, mark, { entity: se });
  assert.equal(spellPierce(se, mark.entity), 20);
  assert.equal(spellPierce(se, foeEnt()), 0, 'that foe alone');
  now += 13;
  assert.equal(spellPierce(se, mark.entity), 0, 'gone after 12 seconds');
  POW._setArcanePowersClockForTests(null);
  // Spellbreaker: a third of its magicka back; Soulbinder: a quarter of what it lands
  reset();
  const sb = pathMage('spellbreaker', 100);
  const t1 = rec('t1', foeEnt({ health: 500, maxHealth: 500 }), [0, 0, 0]);
  door([t1], sb);
  const cost = calculateCastCost(signatureSpell('spellbreaker'), sb).sp;
  engine(sb, [t1]).applySpellToFoe(signatureSpell('spellbreaker'), 20, t1, castBy(sb, cost));
  assert.equal(sb.magicka, Math.floor(cost / 3), 'a third of what the cast took');
  reset();
  const so = pathMage('soulbinder', 100);
  door([t1], so);
  const r5 = engine(so, [t1]).applySpellToFoe(signatureSpell('soulbinder'), 20, t1, { entity: so });
  assert.equal(so.magicka, Math.floor(r5.damage / 4));
  // Lightbringer: a fifth heals me; undead burn again for half, a humanoid does not
  reset();
  const lb = pathMage('lightbringer', 100);
  lb.health = 10;
  const ghost = rec('ghost', foeEnt({ careerIndex: 15, health: 500, maxHealth: 500 }), [0, 0, 0]);
  const man = rec('man', foeEnt({ careerIndex: 1, health: 500, maxHealth: 500 }), [0, 0, 0]);
  const d5 = door([ghost, man], lb);
  const eng = engine(lb, [ghost, man]);
  const r6 = eng.applySpellToFoe(signatureSpell('lightbringer'), 20, ghost, { entity: lb });
  assert.equal(lb.health, 10 + Math.floor(r6.damage / 5));
  assert.deepEqual(d5.hurts, [['ghost', Math.round(r6.damage / 2)]]);
  eng.applySpellToFoe(signatureSpell('lightbringer'), 20, man, { entity: lb });
  assert.equal(d5.hurts.length, 1, 'a humanoid burns once');
});

test('SCHOOLS3 THE RIDERS THAT WRAP ME: Aegis Bolt\'s Shield of twice what it landed (at most a fifth of my health), Fleeting Hold\'s Chameleon when it holds, Shadow Bolt\'s Shadow, Sanctify\'s Spell Resistance, Living Aegis\'s guard, Prismatic Ward\'s absorbing - and Beguile\'s magicka when it calms (mutants: the Shield uncapped; the Chameleon on a miss; the guard forgotten; the ward forgotten)', () => {
  reset();
  const bt = pathMage('battlemage', 100);
  const t = rec('t', foeEnt({ health: 900, maxHealth: 900 }), [0, 0, 0]);
  const d = door([t], bt);
  const r = engine(bt, [t]).applySpellToFoe(signatureSpell('battlemage'), 20, t, { entity: bt });
  const sh = d.cast.find((b) => b.effects[0].type === 35);
  assert.ok(sh, 'a Shield on me');
  assert.equal(sh.effects[0].magnitudeBaseLow, Math.min(r.damage * 2, 40), 'twice it, at most a fifth of 200');
  assert.equal(sh.effects[0].durationBase, 9, '8 rounds, one more as Eventide\'s');
  // Trickster: the hold takes - Chameleon; it misses - nothing
  reset();
  const tr = pathMage('trickster', 100);
  const t2 = rec('t2', foeEnt(), [0, 0, 0]);
  const d2 = door([t2], tr);
  const held = engine(tr, [t2], () => 0.1).applySpellToFoe(signatureSpell('trickster'), 20, t2, { entity: tr }, { bypassSavingThrows: true });
  assert.ok(held.paralyzed > 0);
  assert.deepEqual(d2.cast.map((b) => [b.effects[0].type, b.effects[0].subType, b.effects[0].durationBase]), [[23, 0, 7]]);
  const miss = createPlayerMagic({ ...{}, renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({}), uploadRecord() {}, uploadRecordFrame() {}, collider: { raycast: () => Infinity }, playerEntity: tr,
    playerSinks: {}, say() {}, surfacePlayer() {}, foes: () => [], foeSinks: () => ({ hurt() {} }), absorbCtx: () => ({}), rolls: () => 0.999, startCastAnim: null });
  const t3 = rec('t3', foeEnt(), [0, 0, 0]);
  const d3 = door([t3], tr);
  const chanceless = { ...signatureSpell('trickster') };
  chanceless.effects = chanceless.effects.map((e) => (e.type === 0 ? { ...e, chanceBase: 0, chanceMod: 0 } : e));
  miss.applySpellToFoe(chanceless, 20, t3, { entity: tr });
  assert.deepEqual(d3.cast, [], 'a hold that never took: no fade');
  // Shadowcaster: Shadow when it lands
  reset();
  const sc = pathMage('shadowcaster', 100);
  const d4 = door([t], sc);
  engine(sc, [t]).applySpellToFoe(signatureSpell('shadowcaster'), 20, t, { entity: sc });
  assert.deepEqual(d4.cast.map((b) => [b.effects[0].type, b.effects[0].subType, b.effects[0].durationBase]), [[24, 0, 4]]);
  // Enchanter: a foe it calms gives the magicka back whole
  reset();
  const en = pathMage('enchanter', 100);
  const knight = rec('knight', foeEnt({ mobileType: 130 }), [0, 0, 0]);   // an enemy class: Charm's own
  door([knight], en);
  en.magicka = 0;
  const paid = calculateCastCost(signatureSpell('enchanter'), en).sp;
  const calm = engine(en, [knight], () => 0.1).applySpellToFoe(signatureSpell('enchanter'), 20, knight, castBy(en, paid), { bypassSavingThrows: true });
  assert.equal(calm.pacify, true);
  assert.equal(en.magicka, Math.min(en.maxMagicka, paid), 'its whole price back (never past the pool)');
  assert.ok(en.magicka > 0);
  en.magicka = 0;
  const unmoved = engine(en, [knight], () => 0.999).applySpellToFoe(signatureSpell('enchanter'), 20, knight, castBy(en, paid), { bypassSavingThrows: true });
  assert.equal(unmoved.pacify, undefined);
  assert.equal(en.magicka, 0, 'a foe it never calmed gives nothing back');
  // the self-casts: Hierophant's Spell Resistance; Warden's guard; Wardwright's ward
  reset();
  const hi = pathMage('hierophant', 100);
  const d6 = door([], hi);
  engine(hi).applySpellToPlayer(signatureSpell('hierophant'), 20, { entity: hi });
  assert.deepEqual(d6.cast.map((b) => [b.effects[0].type, b.effects[0].chanceBase, b.effects[0].durationBase]), [[22, 30, 7]]);
  reset();
  let now = 50;
  POW._setArcanePowersClockForTests(() => now);
  const wa = pathMage('warden', 100);
  wa.health = wa.maxHealth = 1000;
  door([], wa);
  const orc = foeEnt();
  setStruck(orc, wa, 100); hurtPlayer(wa, 100);
  assert.equal(wa.health, 900, 'before the Aegis, whole');
  engine(wa).applySpellToPlayer(signatureSpell('warden'), 20, { entity: wa });
  const shielded = wa.activeEffects.find((a) => a.kind === 'shield');
  if (shielded) shielded.shieldRemaining = 0;   // the pool aside: the guard alone
  const before = wa.health;
  setStruck(orc, wa, 100); hurtPlayer(wa, 100);
  assert.equal(before - wa.health, 80, '20% lighter');
  const b2 = wa.health;
  hurtPlayer(wa, 100);
  assert.equal(b2 - wa.health, 100, 'a fall is no blow');
  now += 31;
  const b3 = wa.health;
  setStruck(orc, wa, 100); hurtPlayer(wa, 100);
  assert.equal(b3 - wa.health, 100, 'the guard ends after 30 seconds');
  reset();
  POW._setArcanePowersClockForTests(() => now);
  const ww = pathMage('wardwright', 100);
  ww.magicka = 0;
  door([], ww);
  assert.equal(POW.pathAbsorbChance(ww), 0);
  engine(ww).applySpellToPlayer(signatureSpell('wardwright'), 20, { entity: ww });
  assert.equal(POW.pathAbsorbChance(ww), 40);
  ww.magicka = 0;   // room for what it drinks (DFU's own second gate: a one-point bolt costs the floor)
  assert.ok(tryAbsorption(eff(4, 0, { magnitudeBaseLow: 1, magnitudeBaseHigh: 1 }), 2, ww, { rolls: () => 0.1 }) > 0, 'a Destruction bolt absorbed');
  assert.equal(tryAbsorption(eff(4, 0, { magnitudeBaseLow: 1, magnitudeBaseHigh: 1 }), 2, ww, { rolls: () => 0.5 }), 0, '40 against a roll of 50');
  now += 31;
  assert.equal(POW.pathAbsorbChance(ww), 0, 'for 30 seconds');
  POW._setArcanePowersClockForTests(null);
});

test('SCHOOLS4 THE PASSIVES, each through its own seam: Spellsteel, Unseen Strike, Sanguine Tide, Conflux and Dawn\'s Ward onto a damage spell; Sunder off the throw; Attuned Wards off the price; Between Moments onto the hands; Glamour folded; Foresight and the kills, the hurts and the round (mutants: each number moved; each asleep)', () => {
  reset();
  const pow = (p, target = foeEnt()) => page(true, () => spellPowerMult(p, target, { online: false }));
  // Spellsteel: while my Shield holds
  const bt = pathMage('battlemage', 100);
  assert.equal(pow(bt), 1);
  bt.activeEffects.push({ kind: 'shield', shieldRemaining: 10, startingShield: 10, roundsRemaining: 5 });
  assert.equal(pow(bt), 1.15);
  bt.activeEffects[0].shieldRemaining = 0;
  assert.equal(pow(bt), 1, 'a busted pool holds nothing');
  // Unseen Strike: concealed
  const sc = pathMage('shadowcaster', 100);
  assert.equal(pow(sc), 1);
  sc.activeEffects.push({ kind: 'shadeNormal', roundsRemaining: 3 });
  assert.equal(pow(sc), 1.25);
  // Sanguine Tide: 1% a 2% missing, at most 25%
  const bm = pathMage('bloodmage', 100);
  assert.equal(pow(bm), 1);
  bm.health = bm.maxHealth * 0.8;
  assert.equal(pow(bm), 1.1);
  bm.health = 1;
  assert.equal(pow(bm), 1.25);
  // Conflux: a stack a landing, 3% each, five at most, gone after 10 seconds
  let now = 10;
  POW._setArcanePowersClockForTests(() => now);
  const el = pathMage('elementalist', 100);
  const t = foeEnt({ health: 1e6, maxHealth: 1e6 });
  POW.pathLanded({ caster: el, target: t, spell: AT(eff(4, 0)), r: { damage: 0 } });
  assert.equal(pow(el), 1, 'a spell that landed nothing builds nothing');
  POW.pathLanded({ caster: el, target: t, spell: AT(eff(4, 0)), r: { damage: 5 } });
  assert.equal(pow(el), 1.03, 'one stack');
  for (let i = 0; i < 6; i++) POW.pathLanded({ caster: el, target: t, spell: AT(eff(4, 0)), r: { damage: 5 } });
  assert.equal(pow(el), 1.15, 'five at most');
  now += 11;
  assert.equal(pow(el), 1);
  POW._setArcanePowersClockForTests(null);
  // Dawn's Ward: undead and daedra
  const lb = pathMage('lightbringer', 100);
  assert.equal(pow(lb, foeEnt({ careerIndex: 15 })), 1.2, 'undead');
  assert.equal(pow(lb, foeEnt({ careerIndex: 25 })), 1.2, 'daedra');
  assert.equal(pow(lb, foeEnt({ careerIndex: 1 })), 1, 'a humanoid');
  // never at a player, never asleep
  assert.equal(pow(sc, { ...foeEnt(), isPlayer: true }), 1, 'a duel\'s stand-in');
  sc._mentor = { level: 3 };
  assert.equal(pow(sc), 1, 'mentoring');
  // Sunder
  assert.equal(spellPierce(pathMage('spellbreaker', 100), foeEnt()), 10);
  assert.equal(spellPierce(pathMage('necromancer', 100), foeEnt()), 0);
  // Attuned Wards: an Alteration or Thaumaturgy spell, every effect of it
  const ww = pathMage('wardwright', 100);
  const shield = SELF(eff(35, 255, { durationBase: 20, durationMod: 2, magnitudeBaseLow: 40, magnitudeBaseHigh: 60, magnitudeLevelBase: 4, magnitudeLevelHigh: 6 }));
  const nobody = mage([ALT, THA], 100);
  const full = page(false, () => calculateCastCost(shield, nobody).sp);
  assert.equal(page(false, () => calculateCastCost(shield, ww).sp), Math.max(1, Math.round((full * 80) / 100)));
  const mixed = SELF(shield.effects[0], eff(10, 8, { magnitudeBaseLow: 10, magnitudeBaseHigh: 10 }));
  assert.equal(page(false, () => calculateCastCost(mixed, ww).sp), page(false, () => calculateCastCost(mixed, nobody).sp), 'a heal in it: no Alteration spell');
  // Between Moments: the hands 20% faster
  assert.equal(Math.round((castRate(pathMage('riftwalker', 100)) - castRate(mage([ALT, MYS], 100))) * 100), 20);
  // Glamour: folded - on the next magic round, as every fold is (entityMods.js computeEntityMods: an equip change and
  // every round)
  const en = pathMage('enchanter', 100);
  const plainEn = mage([ILL, THA], 100);
  computeEntityMods(en); computeEntityMods(plainEn);
  assert.equal(skillValue(en, SKILLS.Etiquette) - skillValue(plainEn, SKILLS.Etiquette), 15);
  assert.equal(skillValue(en, SKILLS.Streetwise) - skillValue(plainEn, SKILLS.Streetwise), 15);
  assert.equal(liveStat(en, 'personality') - liveStat(plainEn, 'personality'), 10);
  // Foresight: one foe blow in eight, to nothing - a blow, never a fall
  reset();
  const se = pathMage('seer', 100);
  se.health = se.maxHealth = 1000;
  door([], se);
  POW._setArcanePowersRandForTests(() => 0.1);
  const orc = foeEnt();
  setStruck(orc, se, 50); hurtPlayer(se, 50);
  assert.equal(se.health, 1000, 'foreseen');
  hurtPlayer(se, 50);
  assert.equal(se.health, 950, 'a fall is never foreseen');
  POW._setArcanePowersRandForTests(() => 0.2);
  setStruck(orc, se, 50); hurtPlayer(se, 50);
  assert.equal(se.health, 900, 'seven in eight land');
  POW._setArcanePowersRandForTests(null);
  // Slip Away: a hurt across a third - Invisible 5 rounds, ready again after 2 minutes
  reset();
  now = 0;
  POW._setArcanePowersClockForTests(() => now);
  const tr = pathMage('trickster', 100);
  tr.health = tr.maxHealth = 300;
  const d = door([], tr);
  hurtPlayer(tr, 150);
  assert.deepEqual(d.cast, [], 'still over a third');
  hurtPlayer(tr, 60);
  assert.deepEqual(d.cast.map((b) => [b.effects[0].type, b.effects[0].subType, b.effects[0].durationBase]), [[13, 0, 6]]);
  tr.health = 300; hurtPlayer(tr, 250);
  assert.equal(d.cast.length, 1, 'recovering');
  now += 121; tr.health = 300; hurtPlayer(tr, 250);
  assert.equal(d.cast.length, 2, 'ready again');
  // Absolution: under 30% - a quarter of my health, ready after 3 minutes
  reset();
  POW._setArcanePowersClockForTests(() => now);
  const hi = pathMage('hierophant', 100);
  hi.health = hi.maxHealth = 400;
  door([], hi);
  hurtPlayer(hi, 300);
  assert.equal(hi.health, 200, 'under 30%: a quarter back');
  hi.health = 400; hurtPlayer(hi, 300);
  assert.equal(hi.health, 100, 'recovering');
  POW._setArcanePowersClockForTests(null);
  // Steadfast: 1% a round while my Shield holds
  const wa = pathMage('warden', 100);
  wa.health = 100; wa.maxHealth = 1000;
  POW.pathRound(wa);
  assert.equal(wa.health, 100, 'no Shield');
  wa.activeEffects.push({ kind: 'shield', shieldRemaining: 5, startingShield: 5, roundsRemaining: 5 });
  POW.pathRound(wa);
  assert.equal(wa.health, 110);
  // the kills: Death's Due, Soul Well (a fifth when my trap held it)
  reset();
  const ne = pathMage('necromancer', 100);
  ne.health = 100; ne.maxHealth = 1000; ne.magicka = 0;
  const nm = ne.maxMagicka;   // the career's own, read live
  door([], ne);
  reportPlayerKill(foeEnt());
  assert.deepEqual([ne.health, ne.magicka], [150, Math.floor(nm * 0.05)]);
  reportPlayerKill(foeEnt({ team: 'PlayerAlly' }));
  assert.deepEqual([ne.health, ne.magicka], [150, Math.floor(nm * 0.05)], 'never an ally');
  const sb = pathMage('soulbinder', 100);
  sb.magicka = 0;
  const sm = sb.maxMagicka;
  door([], sb);
  POW._resetArcanePowersForTests();
  const gained = (fn) => { const b = sb.magicka; fn(); return sb.magicka - b; };
  const tenth = gained(() => reportPlayerKill(foeEnt()));
  assert.ok(Math.abs(tenth - sm * 0.1) < 1, '10%');
  sb.magicka = 0;
  const fifth = gained(() => reportPlayerKill(foeEnt({ activeEffects: [{ kind: 'soulTrap', chance: 50, roundsRemaining: 3 }] })));
  assert.ok(Math.abs(fifth - sm * 0.2) < 1, 'my trap held it: 20%');
  sb.magicka = 0;
  const peer = gained(() => reportPlayerKill(foeEnt({ activeEffects: [{ kind: 'soulTrap', chance: 50, roundsRemaining: 3, by: 'peer-0002' }] })));
  assert.ok(Math.abs(peer - sm * 0.1) < 1, 'a peer\'s trap is not mine: 10%');
});

test('SCHOOLS5 THE JUDGE: a save\'s path a table holds with both its schools mastered - what grants a path\'s powers; a signature spell is never judged (an inert plain bundle without its path - AUDIT SCHOOLS L3 F2); an honest save finds nothing (mutants: the schools unread; an unknown id passes; the judge never asks)', () => {
  const p = pathMage('necromancer', 120);
  p.spells = [signatureSpell('necromancer')];
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p)));
  const save = { ...snap, level: 20, goldPieces: 0 };
  const codes = (s) => characterFindings(s, null).filter((f) => f.code === 'path');
  assert.deepEqual(codes(save), [], 'lawful');
  assert.deepEqual(codes({ ...save, arcanePath: null, spells: [] }), [], 'no path at all');
  assert.deepEqual(codes({ ...save, arcanePath: 'archlich' }), [{ code: 'path', at: 'id' }], 'a path no table holds');
  assert.deepEqual(codes({ ...save, masteredSkills: [RES] }), [{ code: 'path', at: 'schools' }], 'a school unmastered');
  assert.deepEqual(codes({ ...save, masteredSkills: [] }), [{ code: 'path', at: 'schools' }], 'neither');
  // a signature spell is never the judge's: another path's beside mine, one with no path (an older build's save), a
  // record that names a path and is not its spell - each a plain bundle in play, none a power
  assert.deepEqual(codes({ ...save, spells: [...save.spells, signatureSpell('seer')] }), []);
  const { arcanePath: _gone, ...olderBuild } = save;
  assert.deepEqual(codes(olderBuild), [], 'an older build dropped the path and kept the spell: no frozen trade');
  assert.deepEqual(codes({ ...save, spells: [{ ...signatureSpell('necromancer'), index: -1 }] }), []);
  assert.ok(judgeSave(save).findings.every((f) => f.code !== 'path'));
  assert.ok(judgeSave({ ...save, arcanePath: 'archlich' }).findings.some((f) => f.code === 'path'), 'the judge asks the law');
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/systems\/arcanePaths\.js"/, 'the law joins the deploy\'s filter');
});
