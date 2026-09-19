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
import { weaponTypeForItem, WEAPON_TYPES, getWeaponAnims, THUNDERLOCK_ANIMS, ALIGN } from '../src/combat/fpsWeapon.js';
import {
  THUNDERLOCK_NUM_FRAMES, MELEE_NUM_FRAMES, BOW_NUM_FRAMES,
  createWeaponMachine, machineAttack, machineStep,
} from '../src/characters/weaponStates.js';
import { isBowWeapon, attackSkillOf, WEAPON_SKILL_BY_TEMPLATE } from '../src/scenes/hostCombat.js';
import { spendAmmoFor, ammoCountFor } from '../src/systems/inventory.js';
import { playerArchiveFor } from '../src/characters/paperdollArt.js';
import { shimmer, NATIVE_WIDTH } from '../src/combat/thunderlockArt.js';
import { uniqueFinds, uniqueFindChance, rollLootRarity, legendariesFor, rarityEligible } from '../src/systems/lootRarity.js';
// FIELD-GUN: the two the audit could not see, because every pin it
// wrote asked about REGISTRATION and none of them picked the thing up.
import { equipItem, getEquipSlot, getItemHands, EQUIP_SLOTS, ITEM_HANDS } from '../src/systems/equip.js';
import { installThunderlockIcons, ICON_FILES } from '../src/systems/thunderlock.js';
import { isVendorArchive, vendorRecordCount, clearVendorTextures } from '../src/systems/textureReplacement.js';
import { inventoryItemImage } from '../src/systems/itemTemplates.js';
import { loadThunderlockArt } from '../src/combat/thunderlockArt.js';   // FIELD-GUN3
import { SHEET_GRID, cellRect } from '../src/combat/gunSheet.js';
import { vendorTextureStandIn, preloadTextureArchive } from '../src/systems/textureReplacement.js';   // FIELD-GUN4
import { paperdollItemImage, PAPERDOLL_ORIGIN } from '../src/ui/paperDoll.js';
import { PAPERDOLL_OFFSET } from '../src/systems/thunderlock.js';
import { createRecoil, createScreenShake, GUN_FEEL, GUN_TICK_SECONDS, GUN_COOLDOWN_SECONDS } from '../src/combat/gunFeel.js';   // FIELD-GUN6
import { createGunMachine, placeSprite } from '../src/tools/gunLab.js';
import { unionDrawRect } from '../src/combat/gunSheet.js';   // FIELD-GUN11: the one home both sides read
import { widgetTransformRect } from '../src/combat/weaponWidgetMotion.js';   // FIELD-GUN7/10: the PROTOTYPE's own machine and its placement, as the oracle
import { drawFpsWeapon } from '../src/combat/fpsWeapon.js';   // FIELD-GUN10
import { gunPitch } from '../src/combat/gunFeel.js';   // FIELD-GUN8
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

// ── FIELD-GUN (2026-09-19): TWO BUGS THE AUDIT WALKED PAST ──────────
//
// Mac, the first time he held one: "1. the inventory sprites dont have
// their sprites 2. It doesnt let me equip".
//
// Both are the SAME SPECIES as the audit's own F1-F6 - a DFU table or
// a pipeline flag with no row for the port's own weapon - and the
// audit missed them for one reason worth writing down: every pin it
// added asked whether something was REGISTERED. None of them picked
// the weapon up, put it in a hand, or asked a door to draw it. A
// registration pin cannot fail for a weapon that registers perfectly
// and then cannot be held.
//
// So these two drive the ACTIONS, not the wiring.

test('FIELD-GUN2: the gun can actually be EQUIPPED - it takes both hands and lands in the right one', () => {
  const gun = createThunderlock();
  // The bug: WEAPON_HANDS is keyed over DFU's 113-130, so index 560
  // fell past it to ITEM_HANDS.None - and GetEquipSlot's weapon arm
  // maps None to EQUIP_SLOTS.None, which equipItem refuses on its
  // first line. Not a wrong hand: no hand at all.
  assert.equal(getItemHands(gun), ITEM_HANDS.Both, 'a gun this heavy is two-handed');
  const entity = { items: [gun] };
  assert.equal(getEquipSlot(entity, gun), EQUIP_SLOTS.RightHand, 'and two hands route to the right one');
  const unequipped = equipItem(entity, gun);
  assert.ok(unequipped, 'equipItem did not refuse it');
  assert.equal(gun.equipSlot, EQUIP_SLOTS.RightHand, 'it is really in the hand');
  assert.equal(entity.equip.slots[EQUIP_SLOTS.RightHand], gun);

  // ...and being two-handed means it clears the other hand, the same
  // way a claymore does - pinned because the arm above could have
  // answered RightOnly and passed every line up to here.
  const shield = { group: 'Armor', templateIndex: 109 };   // a Buckler - SHIELD_INDICES' first, LeftOnly
  const e2 = { items: [shield] };
  equipItem(e2, shield);
  assert.equal(e2.equip.slots[EQUIP_SLOTS.LeftHand], shield, 'the shield is up first');
  const gun2 = createThunderlock();
  e2.items.push(gun2);
  equipItem(e2, gun2);
  assert.equal(e2.equip.slots[EQUIP_SLOTS.LeftHand], null, 'and the gun takes that hand back');

  // The departure is written where the other two are, ahead of the
  // verbatim table rather than as a row inside it.
  const src = readFileSync('src/characters/equipTable.js', 'utf8');
  assert.ok(src.indexOf('THUNDERLOCK_TEMPLATE') < src.indexOf('const w = WEAPON_HANDS[item.templateIndex];'),
    'the arm stands AHEAD of the generated DFU table, which stays what it is');
});

test('FIELD-GUN1: the icons register as STAND-IN archives, so the doors that gate on recordCount will draw them', async () => {
  clearVendorTextures();
  const seen = [];
  const n = await installThunderlockIcons({ fetchBytes: async (f) => { seen.push(f); return new Uint8Array([0]); } });
  assert.equal(n, ICON_FILES.length, 'both icons registered');

  // THE BUG, and it is not the URL the audit's F7 fixed. Archives 560
  // and 561 exist ONLY as this art - there is no TEXTURE.560 - and
  // `standIn` is the flag that says so. Without it isVendorArchive
  // answers false (the pipeline goes looking for an ARENA2 file that
  // cannot exist) and vendorRecordCount answers 0 - and every icon
  // door in the port gates on `record < tex.recordCount` before it
  // uploads. The icon resolved correctly and then nothing drew it.
  for (const archive of [THUNDERLOCK_ARCHIVE, PELLET_TEMPLATE]) {
    assert.equal(isVendorArchive(archive), true, `archive ${archive} is vendor-only art`);
    assert.ok(vendorRecordCount(archive) > 0, `...and the doors can see a record in ${archive}`);
  }

  // the record each door will ask for is the one that is registered
  const gun = createThunderlock();
  const shot = createPellets(5);
  for (const [item, archive] of [[gun, THUNDERLOCK_ARCHIVE], [shot, PELLET_TEMPLATE]]) {
    const img = inventoryItemImage(item);
    assert.equal(img.archive, archive, 'the icon resolves to the weapon\'s own archive');
    assert.ok(img.record < vendorRecordCount(archive),
      'and the record is INSIDE what the doors will let through - the gate that was failing');
  }
  clearVendorTextures();
});

/** A synthetic sheet in the real grid, painted so that WHICH WAY UP it
 *  is can be read off one pixel: every cell is white (the background
 *  the key eats) with a two-row opaque mark at the TOP of the cell's
 *  content and a one-row mark at the BOTTOM, in different colours. A
 *  gun is a picture with a top and a bottom; this is the smallest
 *  thing that has the same property. */
function orientedSheet(cellW = 40, cellH = 30) {
  const width = cellW * SHEET_GRID.cols, height = cellH * SHEET_GRID.rows;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);   // white, opaque
  const put = (x, y, [r, g, b]) => { const o = (y * width + x) * 4; data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255; };
  for (let i = 0; i < SHEET_GRID.cols * SHEET_GRID.rows; i++) {
    const c = cellRect(i, width, height);
    for (let x = c.x + 2; x < c.x + c.w - 2; x++) {
      put(x, c.y + 2, [255, 0, 0]); put(x, c.y + 3, [255, 0, 0]);   // TOP mark: red, two rows
      put(x, c.y + c.h - 3, [0, 0, 255]);                            // BOTTOM mark: blue, one row
    }
  }
  return { width, height, data };
}

test('FIELD-GUN3: the sprite is not upside down - a screen quad keeps a PNG\'s rows', async () => {
  // Mac, from play: "The sprite is upside down". The third time this
  // port has paid HT3's law. `toColor32` is a FLIP - right for a Unity
  // texture, whose rows are stored bottom-up - and WRONG for a decoded
  // PNG, whose row 0 already IS the picture's top. drawFpsWeapon ends
  // in drawScreenQuad, which hands the rect's TOP the pair v0 with no
  // flip at upload, so this art wants its rows exactly as they came.
  const uploads = [];
  const renderer = { uploadTexture: (kind, key, img) => { uploads.push({ key, img }); return key; } };
  const art = await loadThunderlockArt(renderer, {
    fetch: async () => new Uint8Array([1]),
    decode: async () => orientedSheet(),
  });
  assert.ok(art, 'the art loaded');
  assert.equal(uploads.length, 6, 'six frames uploaded');

  // Read the mark off row 0 of what was handed to the GPU. Right way
  // up, the first row of the uploaded picture is the TOP mark (red);
  // flipped, it is the bottom one (blue). This fails on toColor32 and
  // passes on toScreenOrder, which is the whole difference.
  const { img } = uploads[0];
  const at = (x, y) => { const o = (y * img.width + x) * 4; return [img.colors[o], img.colors[o + 1], img.colors[o + 2]]; };
  const mid = Math.floor(img.width / 2);
  assert.deepEqual(at(mid, 0), [255, 0, 0], 'row 0 of the upload is the picture\'s TOP');
  assert.deepEqual(at(mid, img.height - 1), [0, 0, 255], '...and the last row is its bottom');

  // and the shape the upload path reads, which is the other half of
  // what toScreenOrder answers
  assert.ok(img.colors instanceof Uint8ClampedArray, 'the upload gets `colors`, not `data`');

  // HT3's list, by membership: this door is a SCREEN sprite door.
  const src = readFileSync('src/combat/thunderlockArt.js', 'utf8');
  assert.match(src, /toScreenOrder/, 'it takes the screen-order door');
  // the prose above the call names toColor32 to say why it is wrong,
  // so this asks what is IMPORTED rather than what is mentioned
  assert.ok(!/^import .*\btoColor32\b/m.test(src), 'and does not import the world billboard\'s flip');
});

test('FIELD-GUN4: the paperdoll layer gets PIXELS and a place to put them', async () => {
  // Mac, from play: "The paperdoll doesn't equip the texture". The
  // doll's item layer blits palette INDICES through the doll's own
  // palette, and the vendor stand-in answered `data: null` under the
  // comment "a bitmap the swap arm never reads" - true of every door
  // that existed when SURV-ART wrote it, because that mod's art is
  // never WORN. This weapon is the first vendor-only archive to reach
  // composeDoll, and it got null and drew nothing.
  clearVendorTextures();
  // a 4x3 picture whose TOP row is distinct, so the orientation the
  // doll composites in can be read rather than assumed
  const png = { width: 4, height: 3, data: new Uint8ClampedArray(4 * 3 * 4) };
  for (let x = 0; x < 4; x++) {
    const t = (0 * 4 + x) * 4; png.data[t] = 255; png.data[t + 3] = 255;               // top: red
    const b = (2 * 4 + x) * 4; png.data[b + 2] = 255; png.data[b + 3] = 255;           // bottom: blue
  }
  await installThunderlockIcons({ fetchBytes: async () => new Uint8Array([1]) });
  await preloadTextureArchive(THUNDERLOCK_ARCHIVE, { decode: async () => png });

  const tex = vendorTextureStandIn(THUNDERLOCK_ARCHIVE);
  const bmp = tex.getDFBitmap(0);
  assert.ok(bmp.rgba, 'the stand-in hands the doll real pixels');
  assert.equal(bmp.width, 4);
  // TOP-DOWN, because the doll's composite is - `_decoded` holds the
  // bottom-up color32 order and the doll ends on a screen quad. Same
  // HT3 fork as the sprite, one pipeline over.
  assert.deepEqual([...bmp.rgba.slice(0, 4)], [255, 0, 0, 255], 'row 0 is the picture\'s TOP');
  assert.deepEqual([...bmp.rgba.slice((2 * 4) * 4, (2 * 4) * 4 + 4)], [0, 0, 255, 255], 'and the last row its bottom');

  // ...and a PLACE. A classic weapon record carries its offset inside
  // its CIF; this one has none, so the registration supplies it - and
  // the doll blits at `offset - paperDollOrigin`, so a zero offset
  // puts the sprite off the panel's left edge entirely, which is the
  // other half of drawing nothing.
  const off = tex.getOffset(0);
  assert.deepEqual(off, PAPERDOLL_OFFSET, 'the registration\'s offset reaches the doll');
  const [orgX, orgY] = PAPERDOLL_ORIGIN;
  assert.ok(off.x - orgX >= 0 && off.y - orgY >= 0, 'and it lands ON the panel, not off its top-left');

  // the doll asks for the weapon's own archive and record 0
  const res = paperdollItemImage(createThunderlock(), { gender: 'male', race: 'Breton' });
  assert.equal(res.archive, THUNDERLOCK_ARCHIVE);
  assert.equal(res.record, 0);
  assert.ok(res.record < tex.recordCount, 'and the record is inside what loadRecord will let through');

  // the ammunition is never worn, so it needs no place and gets none
  assert.deepEqual(vendorTextureStandIn(PELLET_TEMPLATE).getOffset(0), { x: 0, y: 0 });
  clearVendorTextures();
});

test('FIELD-GUN6: the lab\'s feel is the GAME\'s - one home, and it reaches both draws', () => {
  // Mac, from play: "This isn't 1 to 1 with the prototype". It was
  // not: the lab drove a recoil spring, a trauma shake and a reload
  // lower, and NONE of the three was ever carried into weaponRig.js -
  // the sprite arrived, the sounds arrived, and the weapon sat dead
  // still while it fired.

  // ONE HOME. The lab re-exports the machines rather than keeping a
  // second copy, which is what stops the numbers drifting apart.
  const lab = readFileSync('src/tools/gunLab.js', 'utf8');
  assert.match(lab, /export \{[^}]*createRecoil[^}]*\} from '\.\.\/combat\/gunFeel\.js'/,
    'the lab reads the game\'s home, not its own copy');
  assert.ok(!/^export function createRecoil/m.test(lab), 'and does not still define one');
  assert.ok(!/^export function createScreenShake/m.test(lab), 'nor the shake');

  // MAC'S NUMBERS, which is the whole point of the lab having existed
  assert.equal(GUN_FEEL.kick, 5);
  assert.equal(GUN_FEEL.back, 0);
  assert.equal(GUN_FEEL.stiff, 400);
  assert.equal(GUN_FEEL.damp, 36);
  assert.equal(GUN_FEEL.reloadMs, 1700);
  assert.deepEqual([GUN_FEEL.shake, GUN_FEEL.shakeRot, GUN_FEEL.shakeFreq, GUN_FEEL.shakeDecay], [30, 4, 60, 5]);

  // THE SPRING RISES AND SETTLES. A displacement, not an impulse -
  // the barrel is already up on the frame the trigger breaks, which
  // is the thing the lab's probe caught when it was an impulse.
  const r = createRecoil();
  assert.deepEqual(r.step(0.001), { x: 0, y: -0 }, 'at rest it moves nothing');
  r.punch();
  const first = r.step(1 / 60);
  assert.ok(first.y < -1, `the kick is there on the very next frame (${first.y.toFixed(2)})`);
  let last = first.y;
  for (let i = 0; i < 120; i++) last = r.step(1 / 60).y;
  assert.ok(Math.abs(last) < 0.05, `and it settles (${last.toFixed(3)})`);

  // ...and a shot fired into the recovery STACKS, which is the reason
  // it is a spring rather than a curve keyed to the frame.
  const a = createRecoil(); a.punch(); for (let i = 0; i < 4; i++) a.step(1 / 60);
  const b = createRecoil(); b.punch(); for (let i = 0; i < 4; i++) b.step(1 / 60);
  b.punch();
  assert.ok(Math.abs(b.step(1 / 60).y) > Math.abs(a.step(1 / 60).y), 'the second shot rides the first');

  // TRAUMA SQUARED: half the trauma is a QUARTER of the shake, which
  // is what makes a single shot read differently from a stacked pair.
  const s1 = createScreenShake(); s1.punch(1); s1.step(0.0001);
  const s2 = createScreenShake(); s2.punch(0.5); s2.step(0.0001);
  const mag = (v) => Math.hypot(v.x, v.y);
  const full = mag(s1.step(0.016)), half = mag(s2.step(0.016));
  assert.ok(full > 0 && half > 0, 'both shake');
  assert.ok(full > half * 3, `squared, not linear (${full.toFixed(2)} vs ${half.toFixed(2)})`);
  // and it decays to nothing rather than ringing forever
  for (let i = 0; i < 120; i++) s1.step(1 / 60);
  assert.deepEqual(s1.step(1 / 60), { x: 0, y: 0, rot: 0 }, 'the trauma runs out');

  // FIELD-GUN12: IT REACHES THE ONE DRAW. The gun takes the
  // prototype's own frame now - not the classic rect-builder and not
  // the mod's clone - so there is no longer a second path for the
  // kick to be missing from.
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /if \(tlArt\?\.anchor && tlArt\.unionBox\) \{ drawThunderlock\(tlArt, c, fpTint\); return; \}/,
    'the gun\'s own frame stands ahead of both classic paths');
  assert.match(rig, /kick: _tlKick/, 'and the draw reads the spring');
  assert.match(rig, /_tlRecoil\.punch\(\);/, 'the shot kicks');
  assert.match(rig, /_tlShake\.punch\(\);/, 'and shakes');
  assert.match(rig, /betterAmbience\.weaponKick\?\./, 'the ROOM moves, through the one camera shaker the port has');
  // ...and the two 1:1 ports it no longer goes through are UNTOUCHED
  // by it, which is the other half of what this bought.
  // (fpsWeapon.js still ROUTES the weapon's anim table - that is the
  // one thing it has always done for it. Its DRAW does not know.)
  const fw = readFileSync('src/combat/fpsWeapon.js', 'utf8');
  const drawFn = fw.slice(fw.indexOf('export function drawFpsWeapon'));
  assert.ok(!/_tlAdjust|unionDrawRect|adjust/.test(drawFn), 'drawFpsWeapon is the classic draw again');
  assert.ok(!/_tlAdjust|unionDrawRect|Thunderlock/.test(readFileSync('src/combat/weaponWidget.js', 'utf8')),
    "the mod's clone knows nothing about the port's own weapon");
});

test('FIELD-GUN7: the game\'s machine and the LAB\'s run the same cycle, frame for frame', () => {
  // Mac, after FIELD-GUN6 shipped: "It still doesn't feel like the
  // proto at all."
  //
  // He was right and GUN6 was the wrong layer. The recoil and the
  // shake are decoration on top of a CADENCE, and the cadence was
  // never carried: in the game a weapon's frame clock and its ranged
  // cooldown are both SPD-DRIVEN, so the gun ran at about five frames
  // a second at average speed where the lab runs fourteen, reloaded
  // in 1.33s where the lab takes 1.7, and landed its damage on the
  // melee hit frame - one after the muzzle flash the lab fires on.
  // Nothing bolted on top can disguise a cycle three times too slow.
  //
  // So this pin is a DIFFERENTIAL against the prototype itself: the
  // lab's machine is the oracle, and the game's has to agree with it
  // frame for frame. It is the only pin in this file that can fail
  // for "it doesn't feel right", because feel IS the timeline.
  const lab = createGunMachine({ fps: GUN_FEEL.fps, cooldownMs: GUN_FEEL.reloadMs, hitFrame: GUN_FEEL.hitFrame });
  const game = createWeaponMachine(false);
  game.ranged = true;
  game.frames = THUNDERLOCK_NUM_FRAMES;
  game.tick = GUN_TICK_SECONDS;
  game.cooldown = GUN_COOLDOWN_SECONDS;
  game.hitFrame = GUN_FEEL.hitFrame;

  lab.fire();
  machineAttack(game, 'StrikeDown');
  const dt = 1 / 60;
  const labFrames = [], gameFrames = [];
  let labHit = null, gameHit = null, labReady = null, gameReady = null;
  // SPEED 100 - the FASTEST a character can be, which is where the
  // classic formulas are furthest from the lab. If the two agree
  // here they agree everywhere, because the gun no longer asks.
  for (let i = 1; i <= 200; i++) {
    const t = i * dt;
    const ev = lab.step(dt);
    if (ev === 'hit' && labHit === null) labHit = i;
    if (ev === 'ready' && labReady === null) labReady = i;
    labFrames.push(lab.state === 'Firing' ? lab.frame : -1);

    const evs = machineStep(game, dt, 100);
    if (evs.includes('hit') && gameHit === null) gameHit = i;
    if (game.state === 'Idle' && game.now >= game.cooldownUntil && gameReady === null && i > 1) gameReady = i;
    gameFrames.push(game.state !== 'Idle' ? game.frame : -1);
    void t;
  }

  // the SHOT: the same six frames on the same ticks
  const labShot = labFrames.filter((f) => f >= 0);
  const gameShot = gameFrames.filter((f) => f >= 0);
  assert.equal(labShot.length, gameShot.length,
    `the shot is ${gameShot.length} frames long in the game and ${labShot.length} in the lab`);
  assert.ok(labShot.length >= 20, 'six frames at 14fps is about 26 ticks of a 60Hz frame - a sanity floor');

  // the HIT lands on the same tick, which is the muzzle flash
  assert.equal(gameHit, labHit, `the damage lands on tick ${gameHit} in the game and ${labHit} in the lab`);

  // and the weapon is READY again at the same moment
  assert.ok(labReady && gameReady, 'both finish their reload inside the window');
  assert.ok(Math.abs(gameReady - labReady) <= 1,
    `ready at tick ${gameReady} in the game and ${labReady} in the lab`);

  // THE SPEED INDEPENDENCE that makes the above true: a gun's
  // mechanism does not care how agile you are. Run the same shot at
  // the slowest and fastest a character can be and get the same
  // timeline - which the SPD-driven formulas could never do.
  const run = (speed) => {
    const m = createWeaponMachine(false);
    m.ranged = true; m.frames = THUNDERLOCK_NUM_FRAMES;
    m.tick = GUN_TICK_SECONDS; m.cooldown = GUN_COOLDOWN_SECONDS; m.hitFrame = GUN_FEEL.hitFrame;
    machineAttack(m, 'StrikeDown');
    const out = [];
    for (let i = 0; i < 200; i++) { machineStep(m, dt, speed); out.push(m.state !== 'Idle' ? m.frame : -1); }
    return out;
  };
  assert.deepEqual(run(10), run(100), 'the gun fires the same at any speed');

  // ...while the CLASSIC weapons still ask, which is the other half:
  // this departure must not have leaked into the tables.
  const melee = (speed) => {
    const m = createWeaponMachine(false);
    machineAttack(m, 'StrikeDown');
    let n = 0;
    for (let i = 0; i < 200; i++) { machineStep(m, dt, speed); if (m.state !== 'Idle') n++; }
    return n;
  };
  assert.ok(melee(10) > melee(100), 'a sword is still slower in slow hands');
});

test('FIELD-GUN7: the POSE is the lab\'s too - size 49, and the raise rides the HUD bar', () => {
  // The other two the lab settled and the game answered for itself.
  assert.equal(GUN_FEEL.widthPct, 0.49, 'Mac\'s last word was "Size: 49"');
  assert.equal(NATIVE_WIDTH, 0.49 * 320, 'and the art reads it rather than carrying a copy');
  assert.equal(GUN_FEEL.raise, -8);
  // the raise is ADDED to the classic offset rather than replacing
  // it, so the weapon still clears the large HUD's bar
  // FIELD-GUN12: the raise is the VIEWMODEL's, applied by the
  // prototype's own frame function, so there is no longer a channel
  // it can be missing from.
  const vm = readFileSync('src/combat/gunViewmodel.js', 'utf8');
  assert.match(vm, /const offsetHeight = raise \* \(canvasH \/ 200\);/,
    'native units into screen pixels, once, where the rect is built');
});

/** FIELD-GUN8: THE PANEL, READ OFF THE LAB'S OWN SOURCE.
 *
 *  Every control in gun-proto.html's `state` is a decision somebody
 *  made about how this weapon feels. The four rounds of "it still
 *  isn't the proto" were each one of them found by hand, one at a
 *  time, after shipping - so this walks the WHOLE panel and makes the
 *  game account for every knob on it.
 *
 *  A knob is accounted for when it is either carried (the game has
 *  the same number) or DELIBERATELY not (it is on the list below with
 *  a reason). Adding a control to the lab and not deciding which it
 *  is turns this red, which is the point. */
const PANEL_NOT_CARRIED = Object.freeze({
  idleSrc: 'a lab switch between the idle PNG and the sheet\'s first cell; the game always slices the sheet',
  flip: 'the player\'s own Controls/Handedness, which the classic draw already reads',
  auto: 'a lab convenience for holding the trigger down; the game fires on the attack gesture',
  walk: 'the lab\'s fake motor - the game has a real one', run: 'as walk', crouch: 'as walk', spd: 'as walk',
  key: 'the background key threshold, baked into combat/gunSheet.js at load rather than live',
  chroma: 'as key',
  light: 'the lab\'s muzzle-light preview; the game lights the room through its own renderer',
  room: 'the lab backdrop\'s brightness - there is no backdrop in the game',
  grid: 'the lab\'s alignment grid',
  sfxFire: 'which CANDIDATE clip is auditioned; the weapon\'s three picks are systems/thunderlock.js SFX',
  sfxOpen: 'as sfxFire', sfxClose: 'as sfxFire',
  sfxOn: 'a lab mute',
  offsetSpeed: 'the mod\'s own Offset.Speed - the game reads the player\'s setting',
  modOffset: 'the mod\'s own module switch', modBob: 'as modOffset',
  bobLength: 'the mod\'s own Bob setting', bobSizeX: 'as bobLength', bobSizeY: 'as bobLength',
  bobSpeedMove: 'as bobLength', bobSpeedState: 'as bobLength', bobShape: 'as bobLength', bobIdle: 'as bobLength',
  inScale: 'the mod\'s own Inertia setting', inSpeed: 'as inScale', inFwd: 'as inScale', inFwdSpeed: 'as inScale',
});

/** knob -> the game's answer for it, so the pin compares VALUES. */
const PANEL_CARRIED = Object.freeze({
  align: () => THUNDERLOCK_ANIMS[1].Alignment,
  offset: () => THUNDERLOCK_ANIMS[1].Offset,
  size: () => GUN_FEEL.widthPct * 100,
  raise: () => GUN_FEEL.raise,
  fps: () => GUN_FEEL.fps,
  cool: () => GUN_FEEL.reloadMs,
  hit: () => GUN_FEEL.hitFrame,
  kick: () => GUN_FEEL.kick,
  back: () => GUN_FEEL.back,
  stiff: () => GUN_FEEL.stiff,
  damp: () => GUN_FEEL.damp,
  shake: () => GUN_FEEL.shake,
  shakeRot: () => GUN_FEEL.shakeRot,
  shakeFreq: () => GUN_FEEL.shakeFreq,
  shakeDecay: () => GUN_FEEL.shakeDecay,
  sfxVol: () => GUN_FEEL.sfxVolume,
  sfxVary: () => GUN_FEEL.sfxVary,
  drop: () => GUN_FEEL.hiddenTarget[1],
  modInertia: () => true,   // FIELD-GUN8: forced on for this weapon - see the rig
});

test('FIELD-GUN8: EVERY knob on the lab\'s panel is either carried or deliberately not', () => {
  // Mac, four rounds in: "Yes, 1:1".
  //
  // The three rounds before this each found ONE missing number by
  // hand, after shipping. This reads the lab's own `state` object out
  // of its source and requires the game to account for every key in
  // it - so the next control someone adds to the panel cannot be
  // quietly left behind.
  const lab = readFileSync('gun-proto.html', 'utf8');
  const block = /const state = \{([\s\S]*?)\n\};/.exec(lab);
  assert.ok(block, 'the lab still declares its panel state in one object');
  const keys = [...block[1].matchAll(/(?:^|[\s,{])([A-Za-z][A-Za-z0-9]*)\s*:/g)].map((m) => m[1]);
  assert.ok(keys.length > 30, `only ${keys.length} controls found - the reader lost the panel`);

  const unaccounted = keys.filter((k) => !(k in PANEL_CARRIED) && !(k in PANEL_NOT_CARRIED));
  assert.deepEqual(unaccounted, [],
    `the lab has controls the game has never decided about:\n${unaccounted.join('\n')}`);
  // ...and the lists may not outlive the panel either
  const gone = [...Object.keys(PANEL_CARRIED), ...Object.keys(PANEL_NOT_CARRIED)].filter((k) => !keys.includes(k));
  assert.deepEqual(gone, [], `these name controls the lab no longer has:\n${gone.join('\n')}`);

  // THE VALUES, read off the lab's own literals - not restated here,
  // because a pin that quotes the number it is checking checks nothing.
  const literal = (k) => {
    const m = new RegExp(`(?:^|[\\s,{])${k}\\s*:\\s*([^,\\n]+)`).exec(block[1]);
    return m ? m[1].trim() : null;
  };
  const mismatched = [];
  for (const [k, answer] of Object.entries(PANEL_CARRIED)) {
    const raw = literal(k);
    if (raw === null) { mismatched.push(`${k}: the lab no longer sets it`); continue; }
    const want = raw === 'true' ? true : raw === 'false' ? false
      : raw.startsWith('ALIGN.') ? ALIGN[raw.slice(6)] : Number(raw);
    const got = answer();
    if (want !== got && !(Number.isFinite(want) && Math.abs(want - got) < 1e-9)) {
      mismatched.push(`${k}: the lab says ${raw} and the game says ${got}`);
    }
  }
  assert.deepEqual(mismatched, [], `the game disagrees with the prototype:\n${mismatched.join('\n')}`);
});

test('FIELD-GUN8: the voice and the one module the lab turns on', () => {
  // the clips take the lab's volume and its jitter, not full gain
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /playOneShot\(TL_SFX\.fire, GUN_FEEL\.sfxVolume, gunPitch\(\)\)/);
  assert.match(rig, /playOneShot\(TL_SFX\.open, GUN_FEEL\.sfxVolume \* 0\.9, gunPitch\(\)\)/);
  assert.match(rig, /playOneShot\(TL_SFX\.close, GUN_FEEL\.sfxVolume \* 0\.95, gunPitch\(\)\)/);
  // the jitter is the lab's line, and it is BOUNDED - a pitch that
  // can wander is a clip that stops sounding like the same gun
  for (const r of [0, 0.5, 1]) {
    const p = gunPitch(() => r);
    assert.ok(Math.abs(p - 1) <= GUN_FEEL.sfxVary + 1e-9, `pitch ${p} is inside +/-${GUN_FEEL.sfxVary}`);
  }
  assert.equal(gunPitch(() => 0.5), 1, 'the middle roll is the clip as recorded');

  // INERTIA: the mod ships it off ("requires double-scaled weapon
  // textures") and the lab turns it on because this art IS that case.
  // Forced for THIS WEAPON ONLY and only upward, so no other weapon
  // and no other module stops reading the player's own settings.
  assert.match(rig, /if \(!s\.inertia && thunderlockHeld\(\)\) return \{ \.\.\.s, inertia: true \};/);
  assert.match(rig, /return s;/, 'and everything else is handed back untouched');
  const decl = rig.slice(rig.indexOf('const widget = createWeaponWidget('), rig.indexOf('const widgetOn ='));
  assert.ok(!/Modules\.(Bob|Offset|Step)/.test(decl), 'no other module is touched');
});

test('FIELD-GUN12: the lab and the game are the SAME function, not two that agree', async () => {
  // Mac, the sixth time: "Port the god damn prototype verbatim".
  //
  // Every round before this one ended with a NUMERIC pin: drive both
  // implementations, diff the answer, assert it is small. That is the
  // right pin when two implementations must exist. It is the wrong
  // fix when they need not - and each time one passed, the next thing
  // the two composed differently was still waiting.
  //
  // So the pin is IDENTITY now. Not "the lab and the game agree" -
  // "the lab and the game are the same function object", which cannot
  // drift, cannot round differently, and cannot be one path out of
  // two. Everything the numeric pins used to check is true because
  // there is nothing left to compare.
  const lab = await import('../src/tools/gunLab.js');
  const game = await import('../src/combat/gunViewmodel.js');
  const place = await import('../src/combat/gunPlacement.js');
  const sheet = await import('../src/combat/gunSheet.js');
  for (const [labName, mod, gameName] of [
    ['createWidgetRig', game, 'createGunRig'],
    ['widgetRigStep', game, 'gunRigStep'],
    ['labMotion', game, 'gunMotion'],
    ['labWidgetSettings', game, 'gunWidgetSettings'],
    ['gunFrameRect', game, 'gunFrameRect'],
    ['placeSprite', place, 'placeSprite'],
    ['unionDrawRect', sheet, 'unionDrawRect'],
  ]) {
    assert.equal(lab[labName], mod[gameName],
      `the lab's ${labName} is not the game's ${gameName} - two copies again`);
  }

  // ...and the rig really DRAWS through it, rather than importing it
  // and then doing something else.
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /const \{ rect \} = gunFrameRect\(\{/, 'the draw takes the prototype\'s rect');
  assert.match(rig, /gunRigStep\(_tlRig, gunWidgetSettings\(\), dt, \{/, 'and the prototype\'s module step');
  assert.match(rig, /renderer\.drawScreenQuad\(tex, rect, undefined, tint \?\? undefined\)/, 'and puts it on the screen');

  // THE FRAME IS STILL THE PROTOTYPE'S SHAPE: anchor placed and
  // transformed, union derived, kick after the transform (the mod's
  // ends in a floor the rect may not rise above, and a kick rises).
  const vm = readFileSync('src/combat/gunViewmodel.js', 'utf8');
  const order = ['placeSprite(', 'widgetTransformRect(', 'anchorRect.y += kick.y', 'unionDrawRect('];
  let at = -1;
  for (const step of order) {
    const k = vm.indexOf(step, at + 1);
    assert.ok(k > at, `the frame's order changed: ${step} is out of place`);
    at = k;
  }

  // and it runs: a real frame, with the real numbers
  const anchor = { x: 0, y: 21, w: 585, h: 312 };
  const union = { x: 0, y: 0, w: 586, h: 333 };
  const rigState = game.createGunRig();
  game.gunRigStep(rigState, game.gunWidgetSettings({}), 1 / 60, {
    screenRect: { width: 1280, height: 800 }, motion: game.gunMotion({ walking: true }), liveSpeed: 50,
  });
  const { rect, anchorRect } = game.gunFrameRect({
    canvasW: 1280, canvasH: 800, anchor, union, rig: rigState,
  });
  assert.ok(rect.w > 0 && rect.h > 0, 'it draws something');
  assert.ok(rect.h > anchorRect.h, 'the union is taller than the gun - the flash has its room');
  assert.ok(Math.abs((rect.x + rect.w) - (anchorRect.x + anchorRect.w)) < 2,
    'and they share a right edge, which is what AlignRight aligned');
});
