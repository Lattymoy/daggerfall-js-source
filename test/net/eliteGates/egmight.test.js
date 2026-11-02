// EG-MIGHT (2026-10-31, the owner: "Address DMG cap in Elite Breach. It's not engaging to see 45 DMG when you're well
// geared"; asked, "Gear-aware purse"; bible/11-Multiplayer/Elite-Gates.md section 21.1). The trust law's purse refilled at
// 3 x (5 + level) a second whatever a member wore - 45 at level 10 - and the screen says what lands. Now the account
// service's judge reads a kit's might off its judged kit worn at once and its sky (net/kitMight.js), the mint signs it
// (`mg`, net/mightLaw.js), and the Spire's purse grows by it while a member's share of a body's health grows by its root
// (net/eliteGates/egMight.js). Pinned here: the law, the kit's parts, the numbers it reads equal to the client's homes, the
// judge, the mint's sum, the token, the relay's socket and the director's own breach.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MIGHT_NONE, MIGHT_MOST, mightOk, mightX, mightOf, mightSigned } from '../../../src/net/mightLaw.js';
import { kitMightParts, kitMightOf } from '../../../src/net/kitMight.js';
import { POWER_BLOW, SET_TIER_BLOW, WEAPON_GEAR_PER_POINT, WEAPON_GEAR_PCT_MOST, WEAPON_POTENCY_PER_POINT, WEAPON_HALF_PER_POINT, POTENCY_CAP, SPELL_POWER_MOST } from '../../../src/systems/powerBlows.js';
import * as WM from '../../../src/systems/weaponMastery.js';
import * as LP from '../../../src/systems/loot/lootPowers.js';
import { setById, tierValues } from '../../../src/systems/sigil/sigilSets.js';
import { sigilPercent } from '../../../src/systems/sigil/sigil.js';
import { ENCHANTMENT_TYPES, ENHANCE_SKILL_MOD } from '../../../src/systems/enchantments.js';
import { HEIRLOOM_DAMAGE_PER_GEN, HEIRLOOM_GEN_MAX, BLESSING_POINTS, BLESSING_SKILL_MAX } from '../../../src/systems/legacy/heirloom.js';
import { SCHOOL_POTENCY_PER_POINT } from '../../../src/systems/spell/spellPower.js';
import { PATH_SPELL_MOST } from '../../../src/systems/arcanePaths.js';
import { blowPct, treeStats, packTree, pathTo } from '../../../src/net/firmament/firmamentLaw.js';
import { FIRM_NODES, START_KEYS } from '../../../src/net/firmament/firmamentTree.js';
import { EG_MIGHT_HEALTH_EXP, egPurseX, egHealthRef, egTokenAtt } from '../../../src/net/eliteGates/egMight.js';
import { BLOW_TOPS } from '../../../src/systems/powerCeiling.js';
import { powerOf } from '../../../src/systems/loot/lootRarity.js';
import { GILDED_RECORDS } from '../../../src/systems/gilded.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { effectiveSkill, SKILL_SOFT_CAP } from '../../../src/systems/skillSoftcap.js';
import { SIGIL_SET_IDS } from '../../../src/systems/sigil/sigil.js';
import { applyRarity } from '../../../src/systems/loot/lootRarity.js';
import { mintGilded } from '../../../src/systems/gilded.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { TOKEN_MIGHT_MIN, TOKEN_MIGHT_MAX, mightIssuable, mintToken, verifyToken } from '../../../src/net/identityToken.js';
import { judgeSave } from '../../../server-account/src/judge.js';
import { egHallOf, egFirstHallOf, egCirclePlan, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsAwake, egLordsOf, egTtkRef, egLordsShare, egLordsFight, EG_SEAM } from '../../../src/net/eliteGates/egLords.js';
import { EG_FL, egHas } from '../../../src/net/eliteGates/egBodies.js';
import { HIT_KINDS, dpsRef, BUCKET_RATE_X, BUCKET_DEPTH_X } from '../../../src/net/gate/gateBrain.js';
import { STAND_IN_WHOLE, EG_STAND_IN_WHOLE } from '../../../src/world/gate/gateBoss.js';
import { readFileSync } from 'node:fs';
import { standService, T0 as ACCT_T0 } from '../../accountDb.mjs';
import { seatRealm } from '../../realmSeat.mjs';
import { realmMintFacts } from '../../../server-account/src/realm.js';

const all = () => true;
const seededRng = (seed) => { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
const sword = (o = {}) => ({ group: 'Weapons', templateIndex: 120, material: 0, ...o });
const skills = (v = 50, at = {}) => Array.from({ length: 35 }, (_, i) => at[i] ?? v);
const setPiece = (templateIndex = 102) => ({ group: 'Armor', templateIndex, material: 0, sigil: { party: 1, xp: 0, set: SIGIL_SET_IDS[0] } });
const BLOW_SIGIL = Object.freeze({ party: 1, xp: 0, power: 5 });

test('EG-MIGHT THE LAW: a might is a whole per cent from 100 (none) to 1000 (ten times), its factor the purse\'s; per cents compose by product and clamp; the token\'s bounds are the law\'s (mutants: the top widened; a might under none taken; per cents added)', () => {
  assert.deepEqual([MIGHT_NONE, MIGHT_MOST], [100, 1000]);
  assert.deepEqual([TOKEN_MIGHT_MIN, TOKEN_MIGHT_MAX], [MIGHT_NONE, MIGHT_MOST], 'pinned equal (the token is a leaf)');
  for (const v of [99, 100, 101, 999, 1000, 1001, 250.5, '300', null, undefined, NaN]) assert.equal(mightIssuable(v), mightOk(v), String(v));
  assert.deepEqual([mightOk(100), mightOk(1000), mightOk(99), mightOk(1001), mightOk(150.5)], [true, true, false, false, false]);
  assert.deepEqual([mightX(400), mightX(null), mightX(5000)], [4, 1, 1]);
  assert.equal(mightOf([]), 100);
  assert.equal(mightOf([100, 50]), 300, '2 x 1.5');
  assert.equal(mightOf([900, 900]), 1000, 'clamped at the top');
  assert.equal(mightOf([-50]), 100, 'a price never lowers a might under none');
});

// PIN MOVED (AUDIT POTION-MIGHT A1-A6, bible/01-Overview/audits/Audit-Potion-Might.md): the kit is what is WORN AT ONCE,
// each power by what it adds, the sets together, a mastered skill's climb, the sky read from the tree - never the pack summed
const BLOW_SIGIL_PCT = sigilPercent(BLOW_SIGIL, Number.MAX_SAFE_INTEGER);
const legendOf = (id, group, templateIndex, o = {}) => ({ group, templateIndex, material: 0, rarity: 'legendary', legendary: id, ...o });

test('EG-MIGHT THE KIT\'S PARTS, WORN AT ONCE: one weapon in hand - its damage lines, its slayer lines of one foe\'s kind and its power; every worn power by what it adds to a blow (a guard power none), each once; a place\'s best piece alone; a ledger key\'s copies once (mutants: the slayer\'s kinds summed; a guard power counted; a power twice; a bag of rings counted; copies counted)', () => {
  assert.equal(kitMightOf({ items: [sword()], skills: skills() }, all), 100, 'a plain sword');
  assert.equal(kitMightOf({}, all), 100, 'no pack');
  const legend = sword({ rarity: 'legendary', legendary: 'nightwhisper', affixes: [{ id: 'damage', value: 30 }, { id: 'slayer', param: 'undead', value: 20 }, { id: 'slayer', param: 'humanoid', value: 10 }] });
  const silent = POWER_BLOW[powerOf('nightwhisper').kind].pct(powerOf('nightwhisper'));
  const p = kitMightParts({ items: [legend, { ...legend }] }, all);
  assert.deepEqual([p.roll, p.loot], [30, 20 + silent], 'its own roll; the slayer of one kind; one held, its copy in the bag nothing');
  assert.equal(kitMightOf({ items: [legend], skills: skills() }, all), Math.round(100 * 1.3 * (1 + (20 + silent) / 100)));
  // worn powers: a guard Legendary adds nothing; a blow one its blow, once for two copies
  const guard = legendOf('the-warden', 'Armor', 102);
  assert.equal(kitMightParts({ items: [guard, legendOf('mountains-root', 'Armor', 104), legendOf('witch-sisters-ring', 'Jewellery', 135)] }, all).loot, 0, 'three guard powers: no blow');
  const vamb = (uid) => legendOf('duelists-vambrace', 'Jewellery', 134, { uid });
  const fb = powerOf('duelists-vambrace').pct, ex = powerOf('night-mothers-embrace').pct;
  assert.equal(kitMightParts({ items: [vamb('0123456789abcdef'), vamb('1123456789abcdef')] }, all).loot, fb, 'one power, whatever carries it');
  assert.equal(kitMightParts({ items: [vamb('0123456789abcdef'), legendOf('night-mothers-embrace', 'Armor', 102)] }, all).loot, fb + ex, 'two worn powers on one blow (a fresh foe\'s)');
  const two = sword({ rarity: 'legendary', legendary: 'nightwhisper', affixes: [{ id: 'slayer', param: 'undead', value: 20 }, { id: 'slayer', param: 'undead', value: 20 }] });
  assert.equal(kitMightParts({ items: [two, vamb('0123456789abcdef'), legendOf('night-mothers-embrace', 'Armor', 102)] }, all).loot, BLOW_TOPS.loot, `${silent + 40 + fb + ex} held to the loot's top`);
  // a Rare's imprint is the Legendary's power (AUDIT POTION-MIGHT D1)
  assert.equal(kitMightParts({ items: [sword({ rarity: 'rare', imprint: 'nightwhisper' })] }, all).loot, silent);
  // a place holds one piece: twelve skill rings are two rings' lines
  const skillRing = (i) => ({ group: 'Jewellery', templateIndex: 135, uid: `a${String(i).padStart(15, '0')}`, affixes: [{ id: 'skill', param: SKILLS.LongBlade, value: 20 }] });
  assert.ok(Math.abs(kitMightParts({ items: Array.from({ length: 12 }, (_, i) => skillRing(i)) }, all).mastery - 40 * WEAPON_GEAR_PER_POINT) < 1e-9, 'two rings worn');
  // a ledger key's copies: one piece
  const one = { ...skillRing(0), templateIndex: 133, rarity: 'rare' };
  assert.ok(Math.abs(kitMightParts({ items: [one, { ...one }, { ...one }] }, all).mastery - 20 * WEAPON_GEAR_PER_POINT) < 1e-9, 'one amulet, three copies');
  assert.equal(kitMightOf({ items: [legend], skills: skills() }, (it) => it !== legend), 100, 'a piece the law refuses arms nothing');
  // the shapes the producers mint: a rolled Legendary and a Gilded record carry their power
  const rolled = applyRarity(createWeapon(120, 1), 'legendary', seededRng(7));
  assert.equal(typeof rolled.legendary, 'string', 'a rolled Legendary names its record');
  assert.equal(kitMightParts({ items: [rolled] }, all).loot >= 0, true);
  const g = mintGilded(GILDED_RECORDS[0]);
  assert.ok(kitMightParts({ items: [g] }, all).loot + kitMightParts({ items: [g] }, all).roll > 0, 'a Gilded record\'s power or lines read');
});

test('EG-MIGHT THE KIT\'S PARTS, THE REST: a Master\'s work carries no power; sets together at the places they fill, at their pieces\' stage; a weapon\'s sigil; an heirloom\'s generations; a mastered skill\'s climb (a sword\'s and a bow\'s a point, an axe\'s and a hammer\'s two, a short blade\'s none) and its gear\'s points, Enhances Skill\'s +15 among them; a martial path held with both skills mastered (mutants: a Master\'s work a power; the largest set alone; the stage past its pieces\'; an unmastered climb; a short blade\'s climb paid; any path a path)', () => {
  assert.equal(kitMightParts({ items: [sword({ rarity: 'common', provenance: 'p'.repeat(24), quality: 5 })] }, all).loot, 0);
  // sets: Nocturnal at four and the Thieftaker at four fill eight places - both sets' tiers, at Faint (their pieces' stage)
  const piece = (set, templateIndex, xp = 0) => ({ group: 'Armor', templateIndex, material: 0, sigil: { party: 1, xp, set } });
  const four = (set, ts) => ts.map((t) => piece(set, t));
  const tierAt = (set, key, stage) => { const t = setById(set).tiers.find((x) => x.key === key); return SET_TIER_BLOW[key](tierValues(t, stage)); };
  const both = kitMightParts({ items: [...four('nocturnal', [102, 103, 104, 105]), ...four('thieftaker', [106, 107, 108, 109])] }, all).sets;
  assert.ok(Math.abs(both - (tierAt('nocturnal', 'nightfall', 0) + tierAt('thieftaker', 'run-them-down', 0))) < 1e-9, `every set worn (${both})`);
  assert.equal(kitMightParts({ items: Array.from({ length: 6 }, () => piece('nocturnal', 107)) }, all).sets, 0, 'six helms are one place');
  const bright = [...four('nocturnal', [102, 103, 104]), piece('nocturnal', 105, 12_500)].map((x) => ({ ...x, sigil: { ...x.sigil, xp: 12_500 } }));
  assert.ok(Math.abs(kitMightParts({ items: bright }, all).sets - tierAt('nocturnal', 'nightfall', 2)) < 1e-9, 'four Bright pieces: Bright');
  assert.ok(Math.abs(kitMightParts({ items: [...bright.slice(0, 3), piece('nocturnal', 105)] }, all).sets - tierAt('nocturnal', 'nightfall', 0)) < 1e-9, 'one Faint piece holds the set at Faint');
  assert.equal(kitMightParts({ items: [sword({ sigil: BLOW_SIGIL })] }, all).sigil, BLOW_SIGIL_PCT, 'a weapon\'s sigil');
  assert.equal(kitMightParts({ items: [{ ...piece('nocturnal', 107), sigil: BLOW_SIGIL }] }, all).sigil, 0, 'never an armour\'s');
  assert.equal(kitMightParts({ items: [sword({ heirloom: { line: 'L1', house: 'Hlaalu', of: 1, from: 'p1', gen: 9 } })] }, all).heirloom, HEIRLOOM_DAMAGE_PER_GEN * HEIRLOOM_GEN_MAX);
  const climb = effectiveSkill(200) - SKILL_SOFT_CAP;
  const at = (skill, mastered = [skill]) => kitMightParts({ skills: skills(50, { [skill]: 200 }), masteredSkills: mastered }, all).mastery;
  assert.deepEqual([at(SKILLS.LongBlade), at(SKILLS.Archery), at(SKILLS.Axe), at(SKILLS.BluntWeapon), at(SKILLS.ShortBlade), at(SKILLS.Axe, [])],
    [climb * WEAPON_POTENCY_PER_POINT * 100, climb * WEAPON_POTENCY_PER_POINT * 100, climb * WEAPON_HALF_PER_POINT * 100, climb * WEAPON_HALF_PER_POINT * 100, 0, 0]);
  const ring = { group: 'Jewellery', templateIndex: 133, affixes: [{ id: 'skill', param: SKILLS.Axe, value: 30 }, { id: 'skill', param: SKILLS.Axe, value: 20 }],
    enchantments: [{ type: ENCHANTMENT_TYPES.EnhancesSkill, param: SKILLS.Axe }] };
  assert.ok(Math.abs(kitMightParts({ items: [ring] }, all).mastery - (50 + ENHANCE_SKILL_MOD) * WEAPON_GEAR_PER_POINT) < 1e-9, 'its lines and its enchantment');
  const enchanted = (n) => ({ ...ring, enchantments: Array.from({ length: n }, () => ({ type: ENCHANTMENT_TYPES.EnhancesSkill, param: SKILLS.Axe })) });
  assert.equal(kitMightParts({ items: [enchanted(60)] }, all).mastery, WEAPON_GEAR_PCT_MOST, 'gear at its most');
  assert.equal(kitMightParts({ skills: skills(50, { [SKILLS.Axe]: 200 }), masteredSkills: [SKILLS.Axe], items: [enchanted(60)] }, all).mastery, BLOW_TOPS.mastery, 'mastery at its top');
  // the gear's other points: the sky's, a set tier's, the line's blessings (to their most), a Legendary once in its place
  assert.ok(Math.abs(kitMightParts({}, all, { firm: { 'skill.LongBlade': 15 } }).mastery - 15 * WEAPON_GEAR_PER_POINT) < 1e-9, 'the sky\'s Long Blade');
  const keen = tierValues(setById('thieftaker').tiers.find((x) => x.key === 'keen-eyed'), 0).archery;
  assert.ok(Math.abs(kitMightParts({ items: four('thieftaker', [102, 103]).slice(0, 2) }, all).mastery - keen * WEAPON_GEAR_PER_POINT) < 1e-9, 'Keen-Eyed\'s Archery');
  const blessed = kitMightParts({ legacyBlessings: Array.from({ length: 5 }, () => ({ skill: SKILLS.Axe, value: BLESSING_POINTS })) }, all).mastery;
  assert.ok(Math.abs(blessed - BLESSING_SKILL_MAX * WEAPON_GEAR_PER_POINT) < 1e-9, 'the blessings, to their most');
  const nine = (uid) => ({ group: 'Jewellery', templateIndex: 133, rarity: 'legendary', legendary: 'amulet-of-the-nine', uid, affixes: [{ id: 'skill', param: SKILLS.Axe, value: 20 }] });
  assert.ok(Math.abs(kitMightParts({ items: [nine('c000000000000000'), nine('c000000000000001')] }, all).mastery - 20 * WEAPON_GEAR_PER_POINT) < 1e-9, 'two of one Legendary: its lines once');
  // the other hand's mark: a one-handed blade with the Ketchmaster's Word in the off hand, at a foe it struck
  const ketch = GILDED_RECORDS.find((r) => r.power?.kind === 'broadside');
  assert.equal(kitMightParts({ items: [sword(), mintGilded(ketch)] }, all).loot, ketch.power.pct);
  assert.equal(kitMightParts({ items: [mintGilded(ketch)] }, all).loot, 0, 'the pistol\'s own shot rides no mark of its own');
  const path = (id, mastered) => kitMightParts({ martialPath: id, masteredSkills: mastered }, all).martial;
  assert.deepEqual([path('warblade', [SKILLS.LongBlade, SKILLS.Axe]), path('warblade', [SKILLS.LongBlade]), path('no-such-path', [SKILLS.LongBlade, SKILLS.Axe])], [BLOW_TOPS.martial, 0, 0]);
});

test('EG-MIGHT THE SKY AND THE SPELL: the sky\'s part is its tree\'s own blow (firmamentLaw.js blowPct) at its best moment; a spell\'s whole is its mastered school past 100, the worn potency and Surge, the sky\'s spell power and a path\'s - and the might is the more of the blow\'s and the spell\'s (mutants: the sky unread; the spell unread; the blow alone)', () => {
  const firm = { weaponDmg: 10, meleeDmg: 5, unawareDmg: 10, spellPower: 10 };
  assert.equal(kitMightParts({}, all, { firm }).firmament, blowPct(firm, { skill: 'LongBlade', group: null, unaware: true, wounded: true }));
  assert.equal(kitMightParts({}, all).firmament, 0, 'no sky');
  const wand = (templateIndex) => ({ group: 'Jewellery', templateIndex, affixes: [{ id: 'potency', value: 15 }] });
  const mage = { items: [wand(133), wand(135), wand(136)], skills: skills(50, { [SKILLS.Destruction]: 200 }), masteredSkills: [SKILLS.Destruction, SKILLS.Alteration], arcanePath: 'battlemage' };
  const school = 1 + (effectiveSkill(200) - SKILL_SOFT_CAP) * SCHOOL_POTENCY_PER_POINT;
  const spell = school * (1 + (POTENCY_CAP + 10 + PATH_SPELL_MOST.battlemage) / 100);   // three pieces' 45, held to the cap's 30
  assert.ok(Math.abs(kitMightParts(mage, all, { firm }).spell - spell) < 1e-9, `the spell's whole (${spell})`);
  assert.equal(kitMightOf(mage, all, { firm }), Math.round(100 * spell), 'the spell\'s, more than the blow\'s');
  assert.equal(kitMightParts({ ...mage, masteredSkills: [] }, all).spell, 1 + (POTENCY_CAP + PATH_SPELL_MOST.battlemage) / 100, 'no school mastered: no climb');
  assert.deepEqual(PATH_SPELL_MOST, { battlemage: 15, shadowcaster: 25, bloodmage: 25, elementalist: 15, lightbringer: 20 });
});

test('EG-MIGHT THE NUMBERS IT READS ARE THE CLIENT\'S: one home each (systems/powerBlows.js) - WEAPON-GEAR\'s and MARTIAL2\'s rates the client\'s own bindings, BAL9c\'s caps the loot\'s (mutant: a rate drifted)', () => {
  assert.deepEqual([WM.WEAPON_GEAR_PER_POINT, WM.WEAPON_GEAR_PCT_MOST, WM.WEAPON_POTENCY_PER_POINT, WM.WEAPON_HALF_PER_POINT], [WEAPON_GEAR_PER_POINT, WEAPON_GEAR_PCT_MOST, WEAPON_POTENCY_PER_POINT, WEAPON_HALF_PER_POINT]);
  assert.deepEqual([LP.POTENCY_CAP, LP.SPELL_POWER_MOST], [POTENCY_CAP, SPELL_POWER_MOST]);
});

test('EG-MIGHT THE JUDGE AND THE MINT: a judged save carries its kit\'s might, its sky handed in; a refused piece left out; the mint signs the judged might as it is - in bounds, nothing for no judged kit (mutants: the might not judged; the sky not handed; the top passed)', () => {
  const gilded = mintGilded(GILDED_RECORDS[0]);
  const judged = judgeSave({ items: [gilded], skills: skills() });
  assert.equal(judged.might, kitMightOf({ items: [gilded], skills: skills() }, all));
  const forged = { ...gilded, affixes: [...gilded.affixes, { id: 'damage', value: 400 }] };
  assert.equal(judgeSave({ items: [forged], skills: skills() }).might, MIGHT_NONE, 'the law refuses the forged line, and its power with it');
  assert.equal(judgeSave(null).might, MIGHT_NONE);
  const firm = { weaponDmg: 20 };
  assert.equal(judgeSave({ items: [] }, null, { firm }).might, mightOf([blowPct(firm, { skill: 'LongBlade', unaware: true, wounded: true })]), 'the sky handed in');
  assert.deepEqual([mightSigned(100), mightSigned(325), mightSigned(1000), mightSigned(null), mightSigned(50), mightSigned(2000), mightSigned(250.5)], [100, 325, 1000, null, null, null, null]);
  const src = readFileSync(new URL('../../../server-account/src/index.js', import.meta.url), 'utf8');
  assert.match(src, /const mg = rc \? mightSigned\(facts\.km\) : null;/);
  assert.match(src, /\.\.\.\(mg != null \? \{ mg \} : \{\}\)/);
});

test('EG-MIGHT THE MINT, THROUGH THE ACCOUNT WORKER: a judged checkpoint keeps its kit\'s might on the row, its sky read in the checkpoint\'s own batch, and the token signs it; a forged piece adds nothing, a kit the law holds signs none (AUDIT POTION-MIGHT A2), a rollback clears it (A4); none before a judged checkpoint, none to another account, none named (mutants: the verdict not writing it; the sky not read; a held kit signed; the rollback keeping it)', async (t) => {
  t.mock.method(Date, 'now', () => ACCT_T0 * 1000);
  const { subtle } = globalThis.crypto;
  const S = await standService({ FIRMAMENT_OPEN: 'on', DEVELOPER_HANDLES: 'mac' });
  const raw = S.env.DB._raw;
  const mac = await S.registered('mac');
  const who = await S.registered('Aldric');
  const R = await seatRealm(S.env, who.secret, 'Aldric');
  const checkpoint = async (items) => {
    const at = R.at();
    const put = await S.fetch(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) },
      body: JSON.stringify({ name: 'Aldric', level: 1, goldPieces: 100, items }),
    });
    assert.equal(put.status, 200);
    return put.json();
  };
  const claimsOf = async (body, secret = who.secret) => {
    const r = await S.call('/v1/auth/token', body, secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v = await verifyToken(r.body.token, S.identityPublic, { subtle, nowS: ACCT_T0 });
    assert.ok(v.ok, v.why);
    return v.claims;
  };
  const row = () => raw.prepare('SELECT might FROM realm_characters WHERE id = ?').get(R.id).might;
  const gilded = mintGilded(GILDED_RECORDS[0]);
  await checkpoint([gilded]);
  const kit = row();
  assert.equal(kit, kitMightOf({ items: [gilded] }, all), 'the judged kit\'s might, on the row');
  assert.ok(kit > MIGHT_NONE);
  assert.equal((await claimsOf({ character: R.id })).mg, kit, 'signed as judged');
  // the sky: a tree with a blow's star, read in the checkpoint's own batch
  let tree = null;
  for (const k of FIRM_NODES.keys()) { const tr = { start: START_KEYS[0], keys: pathTo({ start: START_KEYS[0], keys: [] }, k) }; if (tr.keys.length && blowPct(treeStats(tr), { skill: 'LongBlade', unaware: true, wounded: true }) > 0) { tree = tr; break; } }
  assert.ok(tree, 'a star that grows a blow');
  raw.prepare('INSERT INTO firmament (player, char_id, tree, updated_at) VALUES (?, ?, ?, ?)').run(who.id, R.id, packTree(tree), ACCT_T0);
  await checkpoint([gilded]);
  assert.equal(row(), kitMightOf({ items: [gilded] }, all, { firm: treeStats(tree) }), 'the sky in the might');
  assert.ok(row() > kit);
  await checkpoint([{ ...gilded, affixes: [...gilded.affixes, { id: 'damage', value: 400 }] }]);
  assert.equal(row(), null, 'a forged piece: the law holds the kit, and no might is signed');
  assert.equal('mg' in (await claimsOf({ character: R.id })), false);
  raw.prepare('UPDATE realm_characters SET might = 400 WHERE id = ?').run(R.id);
  const rb = await S.call('/v1/mod/realm-rollback', { id: R.id }, mac.secret);
  assert.equal(rb.status, 200, JSON.stringify(rb.body));
  assert.equal(row(), null, 'a rollback clears the might the rolled-away save was judged with');
  assert.equal((await S.call('/v1/realm/join', { id: R.id }, who.secret)).status, 200);
  assert.equal('mg' in (await claimsOf({ character: R.id })), false, 'and the next join signs none');
  raw.prepare('UPDATE realm_characters SET might = 400 WHERE id = ?').run(R.id);
  const B = await S.registered('Bran');
  assert.equal('mg' in (await claimsOf({ character: R.id }, B.secret)), false, 'another account naming it');
  assert.equal((await realmMintFacts({ db: S.env.DB }, B.id, R.id)).km, null);
  assert.equal((await realmMintFacts({ db: S.env.DB }, who.id, R.id)).km, 400);
  assert.equal('mg' in (await claimsOf({})), false, 'none named');
});

test('EG-MIGHT THE TOKEN AND THE SOCKET: `mg` is signed and read beside the realm\'s yes alone, in bounds; a breach member\'s socket carries it with its level, and nothing out of bounds (mutants: `mg` without the realm; out of bounds signed; the socket dropping it)', async () => {
  const { subtle } = globalThis.crypto;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_800_000_000;
  const base = { s: 'acct-0001', n: 'Mac', k: 'linked', rc: 1, ci: 'r0123456789abcdef0123' };
  const tok = await mintToken({ ...base, mg: 325 }, kp.privateKey, { subtle, nowS });
  const v = await verifyToken(tok, kp.publicKey, { subtle, nowS });
  assert.equal(v?.claims?.mg ?? v?.mg, 325);
  await assert.rejects(mintToken({ ...base, rc: 0, ci: undefined, mg: 325 }, kp.privateKey, { subtle, nowS }), /refused/);
  await assert.rejects(mintToken({ ...base, mg: 1001 }, kp.privateKey, { subtle, nowS }), /refused/);
  assert.deepEqual(egTokenAtt({ cl: 10, mg: 325 }), { cl: 10, mg: 325 });
  assert.deepEqual(egTokenAtt({ cl: 0, mg: 50 }), {});
  assert.deepEqual(egTokenAtt({ mg: 1000 }), { mg: 1000 });
  const relay = readFileSync(new URL('../../../server/src/index.js', import.meta.url), 'utf8');
  assert.match(relay, /ci: c\.ci, wa: c\.wa, mg: c\.mg \};/, 'the verified token\'s claim read');
  assert.match(relay, /if \(egRoom\) Object\.assign\(charLv, egTokenAtt\(who\)\);/, 'onto a breach member\'s socket');
  assert.match(relay, /const w = egEnter\(B, a\.sub, r\.claims\.ez, lv, now, a\.mg\);/, 'and into its admission');
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
/** A solo member at level `lv` with might `mg` woken in the Court of circle `c` of `seed`, its lord awake; `cast` lands a
 *  spell of `d` on a body from beside it, one blow every 250 ms (the blow rate's four a second). */
function court(seed, c, lv, mg) {
  const h = egFirstHallOf(c) + egCirclePlan(seed, c).findIndex((p) => p.kind === 'court'), rng = seeded(seed), co = [['acct-0', 'M0', 1]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = ''; B.dc = [];
  let now = T0 + EG_SEALED_MS + 100;
  egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), lv, now, mg);
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 60 * 60_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  let pos = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z, y: spec.arrive.y ?? 0 };
  const step = () => { now += 250; egStep(B, now, [{ sub: 'acct-0', ...pos, dead: false, at: now }], rng); };
  for (let k = 0; k < 4 * 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  for (let k = 0; k < 4 * 30 && !egLordsAwake(B.F); k++) { pos = { sx: spec.x0 + spec.ring.x, z: spec.ring.z, y: spec.ring.y ?? 0 }; step(); }
  assert.ok(egLordsAwake(B.F), 'the lord woke in its ring');
  const lord = egLordsOf(B.F).find((L) => !egHas(L, EG_FL.mirror));
  let q = 1;
  const cast = (b, d) => { pos = { sx: spec.x0 + b.x + 1.5, z: b.z, y: b.y ?? 0 }; now += 250; return egBlow(B, 'acct-0', { k: 'hit', i: b.i, q: q++, d, r: HIT_KINDS.Spell }, pos, now).filter((f) => f.k === 'eland').reduce((s, f) => s + f.d, 0); };
  return { B, lord, cast, now: () => now };
}
/** What a member lands a second once its purse's depth is spent: the last 40 blows' words over their 10 s - on its lord made
 *  too big to fall or turn a phase in the while, so the purse alone decides. */
function sustained(C) {
  C.lord.max = C.lord.hp = 1e12;
  for (let k = 0; k < 120; k++) C.cast(C.lord, 50_000);   // the depth spent (30 s at four blows a second)
  let landed = 0;
  for (let k = 0; k < 40; k++) landed += C.cast(C.lord, 50_000);
  return landed / 10;
}

test('EG-MIGHT THE REPORT, ON THE DIRECTOR\'S OWN BREACH: a level-10 member with no might lands 45 a second once its purse is spent (3 x (5 + 10) - the report\'s 45); with a signed might of 400 it lands four times that, its purse full at its might\'s depth, and its lord holds twice the health (the might\'s root) - so the kill is twice as fast, never four times; the first entry\'s might is kept, as the level is (mutants: the might never reaching the purse; the health at the might\'s whole; the depth not grown; a re-entry taking the newest might)', () => {
  const lv = 10, ref = dpsRef(lv);
  const plain = court(1, 1, lv, null), geared = court(1, 1, lv, 400);
  const pl = plain.lord.max, gl = geared.lord.max;
  assert.ok(Math.abs(sustained(plain) - BUCKET_RATE_X * ref) <= 1, `${BUCKET_RATE_X * ref} a second at level ${lv}, whatever was claimed`);
  assert.ok(Math.abs(sustained(geared) - BUCKET_RATE_X * ref * 4) <= 2, 'four times, at a might of 400');
  const fresh = court(1, 1, lv, 400);
  assert.ok(fresh.B.mem['acct-0'].bucket <= BUCKET_DEPTH_X * ref * 4 + 1e-6 && fresh.B.mem['acct-0'].bucket > BUCKET_DEPTH_X * ref * 2, 'its purse filled at its might\'s depth');
  assert.equal(EG_MIGHT_HEALTH_EXP, 0.5);
  assert.ok(Math.abs(pl - egTtkRef(1) * ref) < 1, 'the plain member\'s lord holds circle 1\'s reference');
  assert.ok(Math.abs(gl / pl - 2) < 1e-6, `the geared member's twice (${gl} of ${pl})`);
  assert.deepEqual([egPurseX(400), egHealthRef(lv, 400) / ref, egHealthRef(lv, null) / ref], [4, 2, 1]);
  // PIN MOVED (AUDIT POTION-MIGHT B1): a re-entry (a reload, the next circle's room) keeps the might of the first, as the
  // level - a newer token's grew the purse of a hall sized by the one before; a first entry out of bounds is none
  egEnter(geared.B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), lv, geared.now(), 1000);
  assert.equal(geared.B.mem['acct-0'].mg, 400, 'the first entry\'s might kept');
  egEnter(geared.B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), lv, geared.now(), null);
  assert.equal(geared.B.mem['acct-0'].mg, 400, 'and never dropped');
  assert.equal(court(1, 1, lv, 5000).B.mem['acct-0'].mg, null, 'out of bounds is none');
});

test('EG-MIGHT THE SHARES: a lord\'s shares are counted at each member\'s might\'s root - the hall\'s own as the team was, a newcomer\'s through the seam and by the law, each at the lord\'s fraction (mutants: a share without it; a newcomer without it; the seam dropping it)', () => {
  const lv = 10;
  const G = court(1, 1, lv, 400), L = G.lord, F = G.B.F;
  const max0 = L.max;
  egLordsShare(F, 'acct-n', lv, true, 400);
  assert.ok(Math.abs(L.fs['acct-0'].share - L.per * egHealthRef(lv, 400)) < 1e-6, 'the hall\'s own member, at its might\'s root');
  assert.ok(Math.abs(L.fs['acct-0'].share - max0) < 1e-6, 'its share is the whole it was stood for');
  assert.ok(Math.abs(L.max - max0 - L.per * egHealthRef(lv, 400)) < 1e-6, 'a newcomer of might 400 brings twice the reference');
  const max1 = L.max;
  EG_SEAM.join(egLordsFight(F, null, {}, G.now()), 'acct-m', 'Mm', lv, G.now(), null, { admits: true, mg: 900 });
  assert.ok(Math.abs(L.max - max1 - L.per * egHealthRef(lv, 900)) < 1e-6, 'through the seam: three times the reference at 900');
  const max2 = L.max;
  EG_SEAM.join(egLordsFight(F, null, {}, G.now()), 'acct-z', 'Zz', lv, G.now(), null, { admits: true });
  assert.ok(Math.abs(L.max - max2 - L.per * dpsRef(lv)) < 1e-6, 'and none: the reference alone');
});

test('EG-MIGHT THE STAND-IN\'S WHOLE: a breach\'s grown by the most a might grows its purse, so a geared spell is never held under it - 9,750; PIN MOVED (AUDIT POTION-MIGHT B2): its own, every other stand-in\'s 975 as before (mutant: the whole not grown)', () => {
  assert.equal(EG_STAND_IN_WHOLE, STAND_IN_WHOLE * (MIGHT_MOST / MIGHT_NONE));
  assert.deepEqual([STAND_IN_WHOLE, EG_STAND_IN_WHOLE], [975, 9750]);
});
