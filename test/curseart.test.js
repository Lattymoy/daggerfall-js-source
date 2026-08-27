// V5 - THE CURSE ART + THE VAMPIRE'S VOICE, pinned against
// GetCustomHeadImageData / GetCustomPaperDollBackgroundTexture /
// SuppressPaperDollBodyAndItems (both effects) and
// GetCustomRaceGenderAttackSoundData (VampirismEffect :149-187),
// with the consumers' order greppable at all three sites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createVampirismCurse, cureVampirism, racialOverrideHeadArt,
  racialPaperDollBackground, racialSuppressPaperDollBodyAndItems,
  vampireAttackVoice,
} from '../src/systems/vampirism.js';
import { createLycanthropyCurse, morphSelf } from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES, VAMPIRE_CLANS } from '../src/systems/infection.js';
import { setRacialQuestHost } from '../src/systems/racialQuests.js';
import { SOUND } from '../src/systems/soundClips.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = (race = 'Breton', gender = 'male') => ({
  isPlayer: true, level: 5, activeEffects: [], race, gender,
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, items: [], spells: [],
});

test('V5: the override head - beast heads transformed only, the vampire\'s clanless face by gender + BIRTH race', () => {
  setRacialQuestHost(null);
  assert.equal(racialOverrideHeadArt(P()), null, 'a mortal wears their own face');
  const w = P();
  createLycanthropyCurse(w, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
  assert.equal(racialOverrideHeadArt(w), null, 'an untransformed lycanthrope wears their own face too');
  morphSelf(w, { force: true, nowMinutes: 10 });
  assert.deepEqual(racialOverrideHeadArt(w), { file: 'WERE01I0.IMG', record: 0 }, 'the wolf head (:307)');
  const b = P();
  createLycanthropyCurse(b, LYCANTHROPY_TYPES.Wereboar, { now: 0 });
  morphSelf(b, { force: true, nowMinutes: 10 });
  assert.deepEqual(racialOverrideHeadArt(b), { file: 'WERE00I0.IMG', record: 0 }, 'the boar head (:306)');
  // the vampire: females 0-7, males 8-15, BirthRaceTemplate.ID - 1
  const nord = P('Nord', 'male');
  createVampirismCurse(nord, VAMPIRE_CLANS.Khulari, { now: 0 });
  assert.deepEqual(racialOverrideHeadArt(nord), { file: 'VAMP00I0.CIF', record: 8 + 3 - 1 }, 'male Nord: 8 + ID - 1');
  assert.equal(nord.race, 'Nord', 'the curse overrides the NAME, never the birth race the head keys on');
  const khajiit = P('Khajiit', 'female');
  createVampirismCurse(khajiit, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  assert.deepEqual(racialOverrideHeadArt(khajiit), { file: 'VAMP00I0.CIF', record: 7 - 1 }, 'female Khajiit: ID - 1');
  cureVampirism(nord, {});
  assert.equal(racialOverrideHeadArt(nord), null, 'the cure hands the face back');
});

test('V5: the paperdoll background and the whole-body suppression', () => {
  assert.equal(racialPaperDollBackground(P()), null);
  const w = P();
  createLycanthropyCurse(w, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
  assert.equal(racialPaperDollBackground(w), null, 'untransformed: the context SCBG rules');
  assert.equal(racialSuppressPaperDollBodyAndItems(w), false);
  morphSelf(w, { force: true, nowMinutes: 10 });
  assert.equal(racialPaperDollBackground(w), 'WOLF00I0.IMG');
  assert.equal(racialSuppressPaperDollBodyAndItems(w), true, 'the panel is the beast alone (PaperDollRenderer:165)');
  const b = P();
  createLycanthropyCurse(b, LYCANTHROPY_TYPES.Wereboar, { now: 0 });
  morphSelf(b, { force: true, nowMinutes: 10 });
  assert.equal(racialPaperDollBackground(b), 'BOAR00I0.IMG');
  const v = P();
  createVampirismCurse(v, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  assert.equal(racialPaperDollBackground(v), 'SCBG08I0.IMG', 'the vampire\'s crypt, whatever the location context');
  assert.equal(racialSuppressPaperDollBodyAndItems(v), false, 'the vampire\'s body and items still draw');
});

test('V5: the vampire\'s gendered attack voice - 20% bark else attack, ALWAYS a clip, inside the grunt\'s clip pick', () => {
  assert.equal(vampireAttackVoice(P(), () => 0), null, 'a mortal grunts as their race');
  const m = P('Breton', 'male');
  createVampirismCurse(m, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  assert.equal(vampireAttackVoice(m, () => 0.1), SOUND.EnemyVampireBark, 'roll 10 < 20: the bark (205)');
  assert.equal(vampireAttackVoice(m, () => 0.5), SOUND.EnemyVampireAttack, 'else the attack cry (206) - never silence');
  const f = P('Breton', 'female');
  createVampirismCurse(f, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  assert.equal(vampireAttackVoice(f, () => 0.1), SOUND.EnemyFemaleVampireBark);
  assert.equal(vampireAttackVoice(f, () => 0.5), SOUND.EnemyFemaleVampireAttack);
  assert.deepEqual(
    [SOUND.EnemyFemaleVampireBark, SOUND.EnemyFemaleVampireAttack, SOUND.EnemyVampireBark, SOUND.EnemyVampireAttack],
    [199, 200, 205, 206], 'SoundClips.cs, verbatim');
  // the consumer keeps DFU's split: the 20% FIRE chance is the
  // caller's, the override picks the CLIP (DaggerfallEntity:979-988)
  const hc = read('src/scenes/hostCombat.js');
  const fire = hc.indexOf('if (!dice100(ATTACK_VOICE_CHANCE, rolls())) return null;');
  const pick = hc.indexOf('const vamp = vampireAttackVoice(playerEntity, rolls);');
  assert.ok(fire > 0 && pick > fire, 'the override rides AFTER the fire gate, replacing only the clip');
});

test('V5: the three consumers order the override FIRST, as DFU does', () => {
  const hl = read('src/ui/hudLarge.js');
  const ov = hl.indexOf('racialOverrideHeadArt(entity)');
  assert.ok(ov > 0 && ov < hl.indexOf('headArchiveFor(entity);', ov), 'hudLarge: the override head before the racial one');
  assert.ok(hl.includes('const headKeyFor = (entity)') && hl.includes('${ov ? `${ov.file}#${ov.record}` : \'\'}'),
    'the head KEY carries the override - a morph swaps the face the next frame, DFU\'s null-and-re-read');
  const pd = read('src/ui/paperDoll.js');
  assert.ok(pd.includes('const bg = (bgOverride ?? _art.bg).bmp;'), 'the compose fills from the override background');
  assert.ok(pd.includes('for (const slot of suppress ? [] : [EQUIP_SLOTS.Cloak2, EQUIP_SLOTS.Cloak1])'), 'suppression skips the cloaks');
  assert.ok(pd.includes('if (!suppress) {\n      blit(out, _art.nude);'), 'and the body');
  assert.ok(pd.includes('const ordered = suppress ? [] : paperdollOrder('), 'and the items - the click mask empties with them');
  assert.ok(pd.includes('blit(out, headArt ?? _art.head);'), 'the vampire head replaces the racial blit');
});
