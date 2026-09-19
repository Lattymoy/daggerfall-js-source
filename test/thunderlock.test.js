// THE DWARVEN THUNDERLOCK - the port's own weapon, and the first item
// in this port that Daggerfall does not have.
//
// What is pinned here is not "a gun exists". It is the two claims that
// make a departure survivable in a 1:1 port: THE CLASSIC TABLES ARE
// UNTOUCHED, and the new weapon reaches the game through doors that
// already existed. Every arm below is one of those doors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE, THUNDERLOCK_ARCHIVE, ammoTemplateFor,
} from '../src/characters/thunderlockIds.js';
import {
  createThunderlock, createPellets, isThunderlock, isPellet, pelletCount, spendPellet,
  THUNDERLOCK_DAMAGE, THUNDERLOCK_SKILL, THUNDERLOCK_TEMPLATES, ART,
} from '../src/systems/thunderlock.js';
import { weaponSkillUsed, weaponMinDamage, weaponMaxDamage } from '../src/characters/weapons.js';
import { SKILLS } from '../src/systems/skills.js';
import { templateByIndex, ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';
import { weaponTypeForItem, WEAPON_TYPES, getWeaponAnims } from '../src/combat/fpsWeapon.js';
import {
  THUNDERLOCK_NUM_FRAMES, MELEE_NUM_FRAMES, BOW_NUM_FRAMES,
  createWeaponMachine, machineAttack, machineStep,
} from '../src/characters/weaponStates.js';
import { isBowWeapon, attackSkillOf, WEAPON_SKILL_BY_TEMPLATE } from '../src/scenes/hostCombat.js';
import { spendAmmoFor, ammoCountFor } from '../src/systems/inventory.js';
import { playerArchiveFor } from '../src/characters/paperdollArt.js';
import { shimmer } from '../src/combat/thunderlockArt.js';
import { uniqueFinds, uniqueFindChance, rollLootRarity, legendariesFor, rarityEligible } from '../src/systems/lootRarity.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplates.js';
import { FIND_MIN_TIER } from '../src/systems/thunderlock.js';

const GUN = { templateIndex: THUNDERLOCK_TEMPLATE, group: 'Weapons' };
const BOW = { templateIndex: 130, group: 'Weapons' };

test('the classic tables are untouched: the new rows live past the end of DFU’s', () => {
  // itemTemplates.json is DFU's ItemTemplates.txt committed verbatim.
  // The departure is a REGISTRATION, not a row added to that file.
  assert.equal(ITEM_TEMPLATES.length, 288, 'DFU’s 288, unchanged');
  assert.ok(THUNDERLOCK_TEMPLATE > 541 && PELLET_TEMPLATE > 541,
    'past DFU’s 288 AND past Climates & Calories’ 530-541, so neither collides');
  const raw = readFileSync('src/characters/itemTemplates.json', 'utf8');
  assert.ok(!raw.includes('Thunderlock') && !raw.includes('Pellet'), 'and nothing was written into the verbatim file');
  for (const t of THUNDERLOCK_TEMPLATES) {
    const row = templateByIndex(t.index);
    assert.ok(row?.custom, `${t.name} registered as a custom template`);
    assert.equal(row.name, t.name);
  }
  assert.equal(templateByIndex(THUNDERLOCK_TEMPLATE).name, 'Dwarven Thunderlock');
  assert.equal(templateByIndex(PELLET_TEMPLATE).name, 'Dwemer Pellet');
});

test('it is scored on ARCHERY, through the law every host already asks', () => {
  assert.equal(weaponSkillUsed(THUNDERLOCK_TEMPLATE), SKILLS.Archery);
  assert.equal(THUNDERLOCK_SKILL, SKILLS.Archery);
  // the door the hosts actually use: "is this a ranged weapon" is
  // "is it scored on Archery", so naming the skill IS the wiring
  assert.equal(attackSkillOf(GUN), SKILLS.Archery);
  assert.equal(isBowWeapon(GUN), true, 'the hosts’ ranged gate takes it without being told about it');
  assert.equal(isBowWeapon(BOW), true, 'and the bow is untouched');
  assert.equal(isBowWeapon({ templateIndex: 120 }), false, 'a longsword is still not ranged');
  // ONE TABLE. hostCombat.js carried a second copy of the weapon->skill
  // map and answered null here, which is what sent the gun down the
  // melee arc in every host until it was collapsed onto weapons.js.
  assert.equal(WEAPON_SKILL_BY_TEMPLATE[130], SKILLS.Archery);
  assert.equal(WEAPON_SKILL_BY_TEMPLATE[113], SKILLS.ShortBlade);
  const host = readFileSync('src/scenes/hostCombat.js', 'utf8');
  assert.match(host, /from '\.\.\/characters\/weapons\.js'/, 'and it reads the one home rather than restating it');
});

test('its damage span is its own, and the DFU spans are exactly what they were', () => {
  assert.deepEqual([weaponMinDamage(THUNDERLOCK_TEMPLATE), weaponMaxDamage(THUNDERLOCK_TEMPLATE)],
    [THUNDERLOCK_DAMAGE.min, THUNDERLOCK_DAMAGE.max]);
  assert.ok(THUNDERLOCK_DAMAGE.max > 21, 'harder per shot than anything classic - a Dai-Katana is 21');
  // the verbatim tables, spot-checked either side of the new arm
  assert.deepEqual([weaponMinDamage(130), weaponMaxDamage(130)], [4, 18], 'Long Bow');
  assert.deepEqual([weaponMinDamage(123), weaponMaxDamage(123)], [3, 21], 'Dai-Katana');
  assert.deepEqual([weaponMinDamage(113), weaponMaxDamage(113)], [1, 6], 'Dagger');
  assert.equal(weaponMinDamage(999), 0, 'and an unknown template is still nothing');
});

test('it is RANGED but not a BOW - the machine keeps the trigger, the skill keeps Archery', () => {
  const type = weaponTypeForItem(GUN);
  assert.equal(type, WEAPON_TYPES.Thunderlock);
  assert.notEqual(type, WEAPON_TYPES.Bow, 'a bow draws and holds; this has a trigger');
  assert.equal(weaponTypeForItem(BOW), WEAPON_TYPES.Bow, 'the verbatim switch is untouched');
  assert.equal(weaponTypeForItem({ templateIndex: 120 }), WEAPON_TYPES.LongBlade);
  // six frames on every strike direction: a gun does not care which
  // way you dragged
  const anims = getWeaponAnims(type);
  assert.equal(anims.length, 7);
  assert.deepEqual(anims.map((a) => a.NumFrames), [1, 6, 6, 6, 6, 6, 6]);
  assert.deepEqual(anims.map((a) => a.Record), [0, 1, 1, 1, 1, 1, 1], 'record 0 idle, record 1 the fire cycle');
  assert.equal(THUNDERLOCK_NUM_FRAMES.StrikeDown, 6);
  // and the two classic tables are what they were
  assert.equal(MELEE_NUM_FRAMES.StrikeDown, 5);
  assert.equal(BOW_NUM_FRAMES.StrikeDown, 7);
});

test('the shot spends a Dwemer Pellet, and a bow still spends an Arrow', () => {
  const bag = [createPellets(3), { templateIndex: 131, group: 'Weapons', name: 'Arrow', stackCount: 2 }];
  assert.equal(ammoTemplateFor(GUN), PELLET_TEMPLATE);
  assert.equal(ammoTemplateFor(BOW), null, 'the bow’s own answer stays with the bow');
  assert.equal(ammoCountFor(bag, GUN), 3);
  assert.equal(ammoCountFor(bag, BOW), 2, 'and a weapon with no link falls to the Arrow it always spent');
  assert.equal(spendAmmoFor(bag, GUN), true);
  assert.equal(ammoCountFor(bag, GUN), 2, 'the gun took a pellet');
  assert.equal(ammoCountFor(bag, BOW), 2, 'and not an arrow');
  // the weapon's own spender, same law
  const pellets = [createPellets(1)];
  assert.equal(pelletCount(pellets), 1);
  assert.equal(spendPellet(pellets), true);
  assert.equal(pelletCount(pellets), 0);
  assert.equal(spendPellet(pellets), false, 'and it refuses rather than firing a blank');
});

test('the mint: a weapon, an ammunition, and the paperdoll archive that is its own', () => {
  const gun = createThunderlock();
  assert.equal(gun.name, 'Dwarven Thunderlock');
  assert.equal(gun.group, 'Weapons', 'so equip, the doll and the damage laws all treat it as one');
  assert.ok(gun.maxCondition > 0 && gun.value > 0);
  assert.ok(isThunderlock(gun) && !isPellet(gun));
  const ammo = createPellets(20);
  assert.equal(ammo.name, 'Dwemer Pellet');
  assert.equal(ammo.stackCount, 20);
  assert.ok(isPellet(ammo) && !isThunderlock(ammo));
  // A CUSTOM WEAPON HAS NO FEMALE ARCHIVE TO BE OFF BY ONE FROM: the
  // classic pair is 233/234, this one registers a single archive, and
  // subtracting would ask for a texture nobody registered.
  const template = templateByIndex(THUNDERLOCK_TEMPLATE);
  assert.equal(playerArchiveFor(gun, template, { gender: 'male' }), ART.weaponArchive);
  assert.equal(playerArchiveFor(gun, template, { gender: 'female' }), THUNDERLOCK_ARCHIVE);
  // the classic rule is still the classic rule
  const sword = { templateIndex: 120, group: 'Weapons' };
  const swordT = templateByIndex(120);
  assert.equal(playerArchiveFor(sword, swordT, { gender: 'male' }), 234);
  assert.equal(playerArchiveFor(sword, swordT, { gender: 'female' }), 233);
});

test('THE ENCHANTED VARIANT: the promotion classic weapons take, on a sheet that has no second archive', () => {
  const plain = { templateIndex: THUNDERLOCK_TEMPLATE, group: 'Weapons' };
  const enchanted = { ...plain, enchantments: [{ type: 3, param: 20 }] };
  assert.equal(weaponTypeForItem(plain), WEAPON_TYPES.Thunderlock);
  assert.equal(weaponTypeForItem(enchanted), WEAPON_TYPES.Thunderlock_Magic,
    'ConvertItemToAPIWeaponType promotes an enchanted weapon; this one promotes too');
  // there is no WEAPO1xx sheet for it, so the magic art is the SAME
  // frames through a shimmer - which means the same anim table
  assert.equal(getWeaponAnims(WEAPON_TYPES.Thunderlock_Magic), getWeaponAnims(WEAPON_TYPES.Thunderlock));
  // and the classic promotion is exactly what it was
  assert.equal(weaponTypeForItem({ templateIndex: 120, enchantments: [{ type: 3 }] }), WEAPON_TYPES.LongBlade_Magic);
  assert.equal(weaponTypeForItem({ templateIndex: 130, enchantments: [{ type: 3 }] }), WEAPON_TYPES.Bow,
    'a bow has no magic set in DFU and still does not');
});

test('the shimmer cools the metal and lights the highlights, and touches no transparent pixel', () => {
  // brass in shadow, brass lit, the flash's near-white core, and a hole
  const px = new Uint8ClampedArray([
    120, 96, 54, 255,
    210, 178, 104, 255,
    255, 246, 208, 255,
    99, 99, 99, 0,
  ]);
  const before = Uint8ClampedArray.from(px);
  shimmer({ width: 4, height: 1, data: px });
  const warmth = (d, i) => d[i * 4] - d[i * 4 + 2];   // red over blue
  for (const i of [0, 1, 2]) {
    assert.ok(warmth(px, i) < warmth(before, i), `texel ${i} came out cooler than it went in`);
  }
  assert.ok(px[2 * 4 + 2] > before[2 * 4 + 2], 'the flash core gains blue rather than losing it');
  assert.ok(px[1 * 4 + 2] > px[0 * 4 + 2], 'and the lit metal takes more of it than the shadowed');
  assert.deepEqual([...px.slice(12, 16)], [...before.slice(12, 16)], 'a transparent texel is left alone');
  for (let i = 3; i < px.length; i += 4) assert.equal(px[i], before[i], 'alpha is never written');
});

test('THE RAREST THING IN THE GAME: impossible below its tier, and never for sale', () => {
  const find = uniqueFinds().find((f) => f.id === 'dwarven-thunderlock');
  assert.ok(find, 'it registers itself with the loot ladder rather than the ladder naming it');
  // BASE ZERO. A rat in a shallow crypt cannot drop it at any luck -
  // not "rarely", never. That is the difference between rare and
  // gated, and it is the half a probability alone cannot say.
  for (const tier of [0, 1, 2, 3]) {
    for (const luck of [0, 50, 100]) {
      assert.equal(uniqueFindChance(find, { kind: 'pile', tier, boss: true, luck }), 0,
        `tier ${tier} at luck ${luck} is nothing`);
    }
  }
  const qualifying = uniqueFindChance(find, { kind: 'corpse', tier: FIND_MIN_TIER, luck: 50 });
  assert.ok(qualifying > 0 && qualifying < 2, `and at its own tier it is ${qualifying.toFixed(2)} per mille - about 1 in 700`);
  // luck helps, measured BELOW the cap - a maxed boss source is
  // already at the ceiling and nothing can raise it further, which is
  // the point of having one
  assert.ok(uniqueFindChance(find, { kind: 'corpse', tier: 5, luck: 100 })
    > uniqueFindChance(find, { kind: 'corpse', tier: 5, luck: 0 }), 'luck helps');
  assert.ok(uniqueFindChance(find, { kind: 'corpse', tier: 99, boss: true, luck: 100 }) <= 6, 'and the cap holds');

  // IT ARRIVES LOADED: a gun found with no ammunition is a gun that
  // cannot be fired and cannot be bought shot for.
  const minted = find.mint(() => 0.5);
  assert.equal(minted.length, 2);
  assert.ok(isThunderlock(minted[0]) && isPellet(minted[1]));
  assert.ok(minted[1].stackCount >= 6 && minted[1].stackCount <= 18);

  // NOT FOR SALE, and it takes no code: a shelf is built from DFU's
  // own group enum table, and a custom template is not in it.
  const shelf = readFileSync('src/systems/shopStock.js', 'utf8');
  assert.ok(!shelf.includes('Thunderlock') && !shelf.includes('thunderlock'),
    'the shop stock knows nothing about it');
  assert.ok(!GROUP_TEMPLATE_INDICES.Weapons?.includes(THUNDERLOCK_TEMPLATE),
    'and it is not in the Weapons enum a shelf draws from');
});

test('the find adds to a list rather than promoting one, and claims its own legendary', () => {
  // a roll that always lands: the find is added, with its ammunition
  const items = [];
  const always = () => 0;
  rollLootRarity(items, { kind: 'pile', tier: 8, boss: true, luck: 100 }, { rolls: always, luck: 100 });
  assert.ok(items.some(isThunderlock), 'the weapon arrived');
  assert.ok(items.some(isPellet), 'and so did something to fire');
  // a roll that never lands leaves the list exactly as it was
  const none = [];
  rollLootRarity(none, { kind: 'pile', tier: 8, boss: true, luck: 100 }, { rolls: () => 0.999, luck: 100 });
  assert.deepEqual(none, [], 'and otherwise nothing is added at all');
  // THE EXCLUSIVE CLAIM: a gun does not roll up as a blade forged for
  // a dragon hunt, and the classic pairings are untouched.
  assert.deepEqual(legendariesFor({ group: 'Weapons', templateIndex: THUNDERLOCK_TEMPLATE }).map((l) => l.name),
    ['The Last Lock']);
  assert.deepEqual(legendariesFor({ group: 'Weapons', templateIndex: 113 }).map((l) => l.name),
    ['Wyrmbane', 'Nightwhisper'], 'a dagger is still both of its own');
  assert.deepEqual(legendariesFor({ group: 'Weapons', templateIndex: 120 }).map((l) => l.name), ['Wyrmbane']);
});

// ── THE AUDIT'S OWN PINS (2026-09-19) ───────────────────────────────
// Six findings, and the first is the one every test above missed for
// the same reason: they import systems/thunderlock.js, and importing
// the module under test brings its side effects with it. The GAME
// imported nothing, so in the running game the weapon had no template
// row, could never drop, and had no icons - while a green suite said
// otherwise. These pins ask the question the way the game asks it.

test('F1: the weapon EXISTS when the game boots, not only when a test imports it', async () => {
  // A HOST, not the weapon's own module. Nothing below names
  // systems/thunderlock.js - if the wire is pulled, every assertion
  // here fails and the suite finally notices.
  await import('../src/systems/worldTick.js');
  const { templateByIndex } = await import('../src/systems/itemTemplates.js');
  const lr = await import('../src/systems/lootRarity.js');
  assert.equal(templateByIndex(THUNDERLOCK_TEMPLATE)?.name, 'Dwarven Thunderlock', 'the template registered');
  assert.equal(templateByIndex(PELLET_TEMPLATE)?.name, 'Dwemer Pellet');
  assert.ok(lr.uniqueFinds().some((f) => f.id === 'dwarven-thunderlock'), 'the find registered');
  assert.ok(lr.isAmmunition({ templateIndex: PELLET_TEMPLATE }), 'the pellet registered as ammunition');
  assert.ok(lr.legendariesFor({ group: 'Weapons', templateIndex: THUNDERLOCK_TEMPLATE }).length, 'the legendary registered');
  // and the wire itself, named, so deleting it is a decision
  const tick = readFileSync('src/systems/worldTick.js', 'utf8');
  assert.match(tick, /import \{ installThunderlockIcons \} from '\.\/thunderlock\.js'/, 'a host carries the import');
  assert.match(tick, /^installThunderlockIcons\(\);/m, 'and calls it');
});

test('F2: it pays the bow’s cooldown without drawing like a bow', () => {
  const gun = createWeaponMachine(false);
  gun.ranged = true; gun.frames = THUNDERLOCK_NUM_FRAMES;
  assert.equal(machineAttack(gun, 'StrikeDown'), true);
  for (let i = 0; i < 400 && gun.state !== 'Idle'; i++) machineStep(gun, 0.02, 50);
  assert.equal(gun.state, 'Idle');
  assert.ok(gun.cooldownUntil > gun.now, 'the shot leaves a cooldown behind it');
  assert.equal(machineAttack(gun, 'StrikeDown'), false, 'and a second shot inside it is refused');
  // the classic machines are exactly what they were
  const melee = createWeaponMachine(false);
  machineAttack(melee, 'StrikeDown');
  for (let i = 0; i < 400 && melee.state !== 'Idle'; i++) machineStep(melee, 0.02, 50);
  assert.equal(melee.cooldownUntil, 0, 'a melee swing still has no cooldown');
  const bow = createWeaponMachine(true);
  assert.equal(bow.ranged, true, 'and a bow is ranged by construction, so nothing had to be told about it');
});

test('F3/F5: ALL FOUR HOSTS fire it, and it says when it is empty', () => {
  // THE FOUR HOSTS RULE. Three were converted and the fourth was not,
  // which is the exact shape of bug this repo has a rule about: the
  // exterior host kept `=== WEAPON_TYPES.Bow` and spendArrow, so the
  // gun fell to the melee arc in the open world alone.
  for (const host of ['src/scenes/world.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js', 'src/scenes/exterior.js']) {
    const s = readFileSync(host, 'utf8');
    assert.ok(!s.includes('spendArrow('), `${host} does not spend an Arrow by name`);
    assert.match(s, /spendAmmoFor\(/, `${host} asks the weapon what it spends`);
  }
  // and the out-of-ammo guard is not bow-only either
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /WEAPON_TYPES\.Thunderlock/, 'the guard knows the ranged weapons');
  assert.match(rig, /'You have no pellets\.'/, 'and names what it is out of');
  assert.match(rig, /'You have no arrows\.'/, 'without losing the classic line');
});

test('F4: a found stack of ammunition is never promoted, because promoting it would shatter it', () => {
  // an enchanted item does not stack (isStackable refuses one), so a
  // promoted find of twenty becomes twenty rows to carry
  assert.equal(rarityEligible(createPellets(20)), false);
  assert.equal(rarityEligible({ templateIndex: 131, group: 'Weapons' }), false, 'the Arrow’s own rule, unchanged');
  assert.equal(rarityEligible(createThunderlock()), true, 'the weapon itself still rolls');
});

test('F6: the deploy does not point a loaded gun at production', () => {
  const yml = readFileSync('.github/workflows/deploy.yml', 'utf8');
  // checking out a FEATURE BRANCH by name means deleting that branch
  // after the merge fails the step and takes the whole Pages deploy
  // down with it - the game's, not only the lab's
  assert.ok(!/ref:\s*claude\//.test(yml), 'no feature branch is checked out by name');
  assert.match(yml, /Build gun lab[\s\S]*?working-directory: production/, 'the lab builds from the production checkout');
});

test('F8: the game plays the weapon’s own clips - all four hosts, through the mod-sound door', async () => {
  // A SOUND NOBODY HEARS IS NOT A SOUND. The clips were baked,
  // allow-listed, documented and wired into the LAB - and the machine
  // only emits `bowSound` for a bow, so the weapon fired in silence in
  // the game. The lab having them made that harder to notice, not
  // easier.
  const { SFX, SFX_FILES, installThunderlockSounds } = await import('../src/systems/thunderlock.js');
  assert.deepEqual(Object.keys(SFX_FILES).sort(), [SFX.close, SFX.fire, SFX.open].sort());
  for (const file of Object.values(SFX_FILES)) {
    const b = readFileSync(`public/sfx/${file}`);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    assert.equal(dv.getUint32(24, true), 11025, `${file} is the classic rate`);
  }
  // the registration is the MOD-SOUND door (MW-D40), so no new audio
  // path exists and every entry point takes the key
  const registered = new Map();
  const audio = { registerSound: (key, bytes) => { registered.set(key, bytes); return true; } };
  const n = await installThunderlockSounds(audio, { fetchBytes: async (f) => new Uint8Array([102, f.length]) });
  assert.equal(n, 3, 'three clips registered');
  assert.deepEqual([...registered.keys()].sort(), [SFX.close, SFX.fire, SFX.open].sort());
  // and the ONE place all four hosts share plays them
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /thunderlockVoice\(dt\);/, 'the rig has a per-frame voice');
  assert.match(rig, /audio\.playOneShot\(TL_SFX\.fire/, 'the shot');
  assert.match(rig, /audio\.playOneShot\(TL_SFX\.open/, 'the reload opening');
  assert.match(rig, /audio\.playOneShot\(TL_SFX\.close/, 'and the lock-up');
});

test('F7: the art is fetched off the SITE root, not the document - the held map’s own lesson', async () => {
  const { appRootFrom } = await import('../src/systems/appRoot.js');
  // the built game's document is /play/index.html and its chunk is at
  // /assets/ - so the document's base is the wrong root and the
  // module's is the right one. This is not hypothetical: it is
  // MAP-FIELD, four weeks earlier, on Mac's own sprite.
  assert.equal(appRootFrom('https://mac.dev/assets/main-99h17hA7.js'), 'https://mac.dev/');
  assert.equal(appRootFrom('https://mac.dev/src/combat/thunderlockArt.js'), 'https://mac.dev/');
  assert.equal(appRootFrom('blob:nope'), null, 'and an unbaseable URL answers null rather than throwing');
  for (const f of ['src/combat/thunderlockArt.js', 'src/systems/thunderlock.js']) {
    const s = readFileSync(f, 'utf8');
    assert.match(s, /APP_ROOT/, `${f} resolves against the site root`);
    assert.ok(!/new URL\([^)]*globalThis\.document\?\.baseURI\s*\)/.test(s), `${f} does not resolve against the document alone`);
  }
});
