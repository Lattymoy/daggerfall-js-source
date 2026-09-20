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
import { muzzlePoint, MUZZLE_GAIN } from '../src/combat/thunderlockArt.js';   // FIELD-GUN17
import { orbColour, orbColourFrom, noteOrbColour, resetOrbColour } from '../src/characters/thunderlockIds.js';   // FIELD-GUN17
import { playerMuzzleOrigin } from '../src/systems/spellcast.js';   // FIELD-GUN17
import { muzzleRay } from '../src/combat/weaponRig.js';   // FIELD-GUN17
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
// FIELD-GUN13: the three asks - the draw's clip, the flash's light, the sheathe's slide.
import { equipSoundFor } from '../src/characters/weapons.js';
import { SOUND } from '../src/systems/soundClips.js';
import { SFX as TL_SFX, SFX_FILES, thunderlockMuzzleLight, MUZZLE_OFFSET } from '../src/systems/thunderlock.js';
import { SFX_CANDIDATES } from '../src/tools/gunLab.js';   // FIELD-GUN15: the audition's own lists, whose HEAD is the pick
import { existsSync } from 'node:fs';
import { MUZZLE_CURVE, muzzleGlow } from '../src/combat/gunFeel.js';
import { muzzleLight } from '../src/tools/gunLab.js';
import { createGunRig, gunRigStep, gunWidgetSettings, gunMotion, gunFrameRect } from '../src/combat/gunViewmodel.js';
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
  assert.match(rig, /renderer\.drawScreenQuad\(tex, rect, undefined, lit \?\? undefined\)/, 'and puts it on the screen');   // FIELD-GUN13: `lit` is the tint with the muzzle's own lift on it

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


// ── FIELD-GUN13 (2026-09-19, Mac, three asks in one message) ────────
//
//   "1. The muzzle flash itself shouldn't be affected by the darkening
//    lighting. It should produce lighting
//    2. The sound for holstering is a sword
//    3. The weapon should come up from the bottom screen into frame
//    when unholstering, not pop in"
//
// ALL THREE ARE THE SAME FAULT AS FIELD-GUN1-12: a law written over
// DFU's own range, asked about this weapon, answering its default -
// and a default is not an error, so nothing went red. The draw sound
// fell through GetEquipSound's `default: None` onto FPSWeapon's
// declared blade; the sprite's tint was the room's flat light with
// nothing to say a muzzle flash is not a room surface; the sheathe was
// `shown()`, a boolean, because DFU's sprite has no draw animation to
// ease. The pins below are the three defaults, named.

test('FIELD-GUN13 #2 - the draw is the gun’s own clack, not a scabbard', () => {
  // THE DEPARTURE IS AN ARM AHEAD OF THE VERBATIM TABLE, not a row in
  // it: GetEquipSound's domain is SoundClips and this clip is a
  // registered string key, so `equipSoundFor` stays exactly what DFU
  // has - including the `default: None` that is the right answer for a
  // weapon Daggerfall does not have.
  assert.equal(equipSoundFor(createThunderlock()), null,
    'the 1:1 table still answers SoundClips.None for a weapon DFU has no row for');
  // and every classic weapon still gets its own, untouched
  assert.equal(equipSoundFor({ templateIndex: 120 }), SOUND.EquipLongBlade, 'the Longsword is untouched');
  assert.equal(equipSoundFor({ templateIndex: 129 }), SOUND.EquipBow, 'and so is the bow');

  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  const toggle = rig.slice(rig.indexOf('function rawToggleSheath()'), rig.indexOf('THE THUNDERLOCK’S VOICE'.replace('’', "'")));
  assert.ok(toggle.includes('if (thunderlockHeld()) {'), 'the departure is named in the toggle');
  assert.ok(toggle.indexOf('thunderlockHeld()') < toggle.indexOf('equipSoundFor('),
    'and it stands AHEAD of the verbatim call, which is what makes it a departure and not a patch');
  assert.ok(toggle.includes('TL_SFX.close'), 'the clip is the breech coming home');
  // the key it plays is one the weapon actually registers
  assert.equal(TL_SFX.close, 'thunderlock:close');
  assert.ok(SFX_FILES[TL_SFX.close], 'and it has a file behind it');
});

test('FIELD-GUN13 #1 - the muzzle curve is one home, and it throws light', () => {
  // the curve moved out of the lab; the lab's own signature still reads it
  assert.deepEqual([...MUZZLE_CURVE], [0, 1, 0.82, 0.3, 0.12, 0.04]);
  assert.equal(muzzleGlow(false, 1), 0, 'an idle weapon does not flash');
  assert.equal(muzzleGlow(true, 1), 1, 'the flash is brightest on the sheet’s frame 2');
  assert.equal(muzzleGlow(true, 99), 0, 'and off the end of the curve there is none');
  assert.equal(muzzleLight('Firing', 2), muzzleGlow(true, 2),
    'the lab asks the same question in its own machine’s words - two spellings, one home');

  // THE FLASH IS NOT DARKENED. The lift is a lerp toward white, so the
  // peak frame saturates in a BLACK room, which is the half of the ask
  // the prototype's multiply would drop (0.15 x 2.14 is still dark).
  const lift = (v, g) => v + (1 - v) * Math.min(1, g * GUN_FEEL.flashLight * GUN_FEEL.flashGain);
  assert.equal(lift(0.15, 1), 1, 'the peak frame is full brightness however dark the room is');
  assert.equal(lift(0.15, 0), 0.15, 'and an idle gun is lit by the room exactly as it always was');
  assert.ok(lift(0.15, 0.3) > 0.15 && lift(0.15, 0.3) < 1, 'the smoke falls away between the two');
  // the lab's own two numbers, not a second pair
  assert.equal(GUN_FEEL.flashLight, 0.6);
  assert.equal(GUN_FEEL.flashGain, 1.9);
  assert.match(readFileSync('gun-proto.html', 'utf8'), /state\.light \* 1\.9/,
    'which is still the expression the prototype composes its room with');

  // IT PRODUCES LIGHT, in the shape playerTorchLight already answers -
  // so `withPlayerLights` takes it with no host learning anything new.
  const entity = {};
  assert.equal(thunderlockMuzzleLight(entity, [10, 0, 10], 0), null, 'no shot, no light');
  entity._thunderlockFlash = 0;
  assert.equal(thunderlockMuzzleLight(entity, [10, 0, 10], 0), null, 'nor a zero one');
  entity._thunderlockFlash = 1;
  const L = thunderlockMuzzleLight(entity, [10, 0, 10], 0);
  assert.equal(L.range, GUN_FEEL.flashRange, 'the peak throws the flash’s whole reach');
  assert.equal(L.carried, true, 'and takes the carried-light exemption a torch in the hand takes');
  assert.ok(L.z > 10, 'the barrel is in FRONT of the player at yaw 0');
  assert.equal(L.y, 10 * 0 + MUZZLE_OFFSET.up, 'and at the hand’s height');
  // yaw only - a gun does not fire into the ceiling because you looked up
  const half = thunderlockMuzzleLight(entity, [10, 0, 10], Math.PI);
  assert.ok(half.z < 10, 'turn around and the barrel is behind you');
  entity._thunderlockFlash = 0.3;
  assert.ok(Math.abs(thunderlockMuzzleLight(entity, [0, 0, 0], 0).range - GUN_FEEL.flashRange * 0.3) < 1e-9,
    'and the reach falls with the curve');

  // EVERY HOST ADDS IT. Four files, five arrays - the FOUR HOSTS RULE,
  // plus worldModes' interior arm, which is the one a corridor shot is
  // most likely to happen in.
  let sites = 0;
  for (const [file, n] of [['src/scenes/world.js', 2], ['src/scenes/worldModes.js', 2],
    ['src/scenes/dungeon.js', 1], ['src/scenes/exterior.js', 1]]) {
    const src = readFileSync(file, 'utf8');
    const hits = src.split('thunderlockMuzzleLight(playerEntity, player.pos, cam.yaw)').length - 1;
    assert.equal(hits, n, `${file} composes the muzzle light into all ${n} of its light arrays`);
    // beside the torch, every time - the same frame's carried lights
    assert.equal(src.split('playerTorchLight(playerEntity, player.pos, cam.yaw)').length - 1, n,
      `${file}: the torch and the flash ride the same call sites`);
    sites += hits;
  }
  assert.equal(sites, 6, 'six light arrays in four hosts');
});

test('FIELD-GUN13 #3 - the weapon rides in, it does not pop', () => {
  // TWO DISTANCES, ONE EASING. The reload dip has to stay readable;
  // the holster has to leave.
  assert.deepEqual([...GUN_FEEL.hiddenTarget], [0, 0.55]);
  assert.deepEqual([...GUN_FEEL.sheathTarget], [0, 1]);
  assert.ok(GUN_FEEL.sheathTarget[1] > GUN_FEEL.hiddenTarget[1],
    'a weapon put away goes further than one being pumped');

  const anchor = { x: 0, y: 21, w: 585, h: 312 };
  const union = { x: 0, y: 0, w: 586, h: 333 };
  const rig = createGunRig();
  const s = gunWidgetSettings({});
  const step = (shown) => gunRigStep(rig, s, 1 / 60, {
    screenRect: { width: 1280, height: 800 }, motion: gunMotion({}),
    shown, hiddenTarget: shown ? GUN_FEEL.hiddenTarget : GUN_FEEL.sheathTarget, liveSpeed: 50,
  });
  const y = () => gunFrameRect({ canvasW: 1280, canvasH: 800, anchor, union, rig }).anchorRect.y;

  const drawnY = y();
  assert.ok(drawnY < 800, 'a drawn weapon is on the screen');
  // sheathe: it LEAVES, and it takes frames to do it
  const seen = [];
  for (let i = 0; i < 60; i++) { step(false); seen.push(y()); }
  assert.equal(y(), 800, 'and a sheathed one has its top on the bottom edge - fully out of frame');
  assert.ok(seen.slice(0, 6).every((v, i) => i === 0 || v >= seen[i - 1]),
    'it goes DOWN, monotonically - a slide, not a cut');
  assert.ok(seen[2] > drawnY && seen[2] < 800, 'and three frames in it is still partly on screen');

  // draw: back up the same way, in the mod's own time
  let n = 0;
  while (Math.abs(rig.offsetCurrent[1]) > 1e-3 && n < 600) { step(true); n++; }
  assert.ok(n > 6 && n < 30, `the draw eases over ${n} frames, not one`);
  // within a pixel rather than exactly: Bob is running underneath (it
  // is gated on the machine's Idle, not on the Offset module), so the
  // rest point breathes. The OFFSET channel is the one that has to be
  // home, and it is, which is what ends the loop above.
  assert.ok(Math.abs(y() - drawnY) < 1, 'and lands where a drawn weapon sits');

  // AND THE GATE LETS IT. `shown()` is false the whole way, so the
  // rig's own sheathe leg has to relax it - and relax ONLY it.
  const src = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(src, /function thunderlockSliding\(\) \{\n\s*if \(!playerWeapon\.sheathed\) return false;/,
    'the leg is said POSITIVELY, so a leg added to shown() later cannot be relaxed by accident');
  const gate = src.slice(src.indexOf('const gunSliding = '), src.indexOf('const gunSliding = ') + 400);
  for (const other of ['!spellArmed()', '!fpsSpellCasting.isPlayingAnim', 'equipCountdown', '!eotbHidesWeapon()', '!fpArm.active()']) {
    assert.ok(gate.includes(other), `AUDIT-FIELD F1: the gate must re-state ${other} - empty hands stay empty`);
  }
  assert.match(src, /if \(paralyzed \|\| \(!shown\(\) && !torchOnly && !sheetOnly && !shieldRect && !gunSliding\)\) return;/);
  assert.match(src, /if \(!shown\(\) && !gunSliding\) return;/);
  assert.match(src, /if \(gunSliding && !shown\(\)\) return;/,
    'and nothing below the gun’s own arm draws on a sliding frame');
  // the module is told, rather than a second curve being written
  assert.match(src, /shown: !reloading && !sheathed,/);
  assert.match(src, /hiddenTarget: sheathed \? GUN_FEEL\.sheathTarget : GUN_FEEL\.hiddenTarget,/);
});

// ── FIELD-GUN15 (2026-09-20, Mac, with the lab's panel open on his
// phone: "Use these sounds" over a screenshot of the three dropdowns)
test('FIELD-GUN15: the weapon plays the HEAD of each candidate list, which is what the lab opens on', () => {
  // THE CONVENTION WAS TRUE BY NOBODY'S DOING. `SFX_CANDIDATES`'s own
  // header has said since it was written that the dropdowns open on
  // the first entry "which is the pick" - and the pick was ALSO typed
  // into `SFX_FILES` in the weapon's home, by the same person, on the
  // same afternoon. Two places holding one decision, agreeing because
  // nothing had yet made them disagree. That is the drift class this
  // weapon has paid for at every round since FIELD-GUN6, so the
  // sentence is a pin now.
  const lab = readFileSync('src/tools/gunLab.js', 'utf8');
  const heads = Object.fromEntries(Object.entries(SFX_CANDIDATES).map(([slot, list]) => [slot, list[0][0]]));
  for (const [key, slot] of [[TL_SFX.fire, 'fire'], [TL_SFX.open, 'reload-open'], [TL_SFX.close, 'reload-close']]) {
    assert.equal(SFX_FILES[key], `${heads[slot]}.wav`,
      `${key}: the game plays ${SFX_FILES[key]} and the lab opens on ${heads[slot]}`);
  }
  // ...and the lab really does default to the head, rather than to a
  // name that happens to match one.
  assert.match(lab, /SFX_CANDIDATES/);
  const proto = readFileSync('gun-proto.html', 'utf8');
  assert.match(proto, /sfxFire: SFX_CANDIDATES\.fire\[0\]\[0\], sfxOpen: SFX_CANDIDATES\['reload-open'\]\[0\]\[0\], sfxClose: SFX_CANDIDATES\['reload-close'\]\[0\]\[0\],/,
    'the panel opens on the head of each list - which is what makes the head the pick');

  // MAC'S THREE, by name, so a reorder that changes what ships says so
  // out loud rather than passing on the pin above alone.
  assert.equal(SFX_FILES[TL_SFX.fire], 'fire-dry.wav', 'a flat crack with no room tail');
  assert.equal(SFX_FILES[TL_SFX.open], 'open-gunrack.wav', 'the dark rack');
  assert.equal(SFX_FILES[TL_SFX.close], 'close-shell.wav', 'a shell seating');
  // every one of them is a file that exists, baked to DAGGER.SND's own
  // parameters (gunLab.test.js holds that law for all sixteen)
  for (const f of Object.values(SFX_FILES)) {
    assert.ok(existsSync(`public/sfx/${f}`), `public/sfx/${f} is missing`);
  }

  // THE VOICE MOVED WITH THEM, and it had to: `fire-dry` carries no
  // room tail where `fire-shotgun` carried a real one, so a drier,
  // quieter sample wants the gain back and has nothing to hide a
  // repeat behind. The FIELD-GUN8 panel pin already holds these two
  // against the lab's own literals; this says what they now ARE.
  assert.equal(GUN_FEEL.sfxVolume, 1);
  assert.equal(GUN_FEEL.sfxVary, 0.19);
  assert.ok(GUN_FEEL.sfxVary > 0.06 * 2, 'three times the jitter, for a sample with no tail');

  // AND THE CLOSE'S LEAD IS THE LAB'S, not a clip length. The comment
  // in weaponRig.js used to claim it was "the clip's own length"; the
  // clip it was written for is 98ms and the lead is 420.
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /const TL_CLOSE_LEAD = 0\.42;/);
  assert.match(proto, /gun\.cooledMs >= Math\.max\(0, state\.cool - 420\)/, 'the prototype’s own 420ms');
  assert.doesNotMatch(rig, /The close lands this long before the weapon is ready - the clip's\n\s+\*\s+own length/,
    'and the sentence that said otherwise is gone');
});

// ── FIELD-GUN17 (2026-09-20, Mac: "On the thunderlock, the orb doesnt
// allign with the barrel when firing. Its above the barrel. Also can
// we can the color of the muzzle flash and the light emitted to the
// same color as the orb?")
//
// TWO HALVES, ONE FAULT CLASS, and it is this port's oldest one: a law
// written over DFU's own range, asked about THIS weapon, answering its
// DEFAULT - and a default is not an error, so nothing went red.
//
//   the orb's ORIGIN came from GetAimPosition, which is right about
//   the nock of a DRAWN BOW and says nothing about a gun barrel;
//
//   the flash's COLOUR came from the muzzle-glow arm's white, which is
//   right about a powder flash and says nothing about the orb.
test('FIELD-GUN17a: the shot leaves the BARREL, and the barrel is measured off the drawn frame', () => {
  // THE ART MEASURES ITS OWN MUZZLE. Not a baked number: the fired
  // frame is brighter than the idle one exactly where the flash is,
  // and the difference's own centroid IS the muzzle.
  const art = readFileSync('src/combat/thunderlockArt.js', 'utf8');
  assert.match(art, /export function muzzlePoint\(dark, lit\)/);
  assert.match(art, /export const MUZZLE_GAIN = \d+;/);
  assert.match(art, /muzzle,?\s*$|muzzle[,}]/m, 'and it rides the art record');

  // fractions of the UNION box, y from the TOP - the same axes
  // `gunFrameRect` hands the draw, so the point can be multiplied
  // straight onto the rect with no second convention to keep.
  assert.ok(typeof muzzlePoint === 'function');
  const W = 8, H = 8;
  const flat = (v) => { const data = new Uint8ClampedArray(W * H * 4); data.fill(v); for (let i = 3; i < data.length; i += 4) data[i] = 255; return { width: W, height: H, data }; };
  const dark = flat(10);
  const lit = flat(10);
  // one hot pixel, column 2 of 8, row 6 of 8 (from the top)
  const idx = ((6 * W) + 2) * 4;
  lit.data[idx] = lit.data[idx + 1] = lit.data[idx + 2] = 255;
  const p = muzzlePoint(dark, lit);
  assert.ok(p, 'a flash gives a point');
  assert.ok(Math.abs(p.x - 2 / W) < 1e-6, `x is the column in fractions of the width (got ${p.x})`);
  assert.ok(Math.abs(p.y - 6 / H) < 1e-6, `y counts DOWN from the top - crop answers PNG order (got ${p.y})`);
  // a rise no bigger than MUZZLE_GAIN is not a flash: the whole point
  // of the threshold is that the two frames differ a little EVERYWHERE
  const warm = flat(10);
  for (let i = 0; i < warm.data.length; i += 4) { warm.data[i] = warm.data[i + 1] = warm.data[i + 2] = 10 + MUZZLE_GAIN; }
  assert.equal(muzzlePoint(dark, warm), null);
  // and no rise at all is not a muzzle at (0,0) - it is no muzzle, and
  // the fire path falls back to the verbatim bow arm
  assert.equal(muzzlePoint(dark, flat(10)), null);
  // mismatched frames answer nothing rather than reading off the end
  // a LARGER second frame is the dangerous shape: every index the loop
  // builds is in range, so nothing throws and nothing comes back NaN -
  // it just reads the wrong pixels and answers with confidence.
  const big = { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4).fill(255) };
  assert.equal(muzzlePoint(dark, big), null);
  assert.equal(muzzlePoint(dark, { width: 4, height: 4, data: new Uint8ClampedArray(64) }), null);

  // THE LANE FORKS, it does not replace. Both missile systems prefer a
  // supplied muzzle and keep GetAimPosition for everything else -
  // which is every bow, at every host, unchanged.
  const spell = readFileSync('src/systems/spellcast.js', 'utf8');
  assert.match(spell, /export function playerMuzzleOrigin\(eye, lookDir, muzzle\)/);
  for (const f of ['src/combat/arrowFlight.js', 'src/scenes/dungeonContext.js']) {
    const src = readFileSync(f, 'utf8');
    assert.match(src, /muzzle\s*\?\s*playerMuzzleOrigin\([^)]*\)\s*:\s*playerArrowOrigin\(from, dir\)/,
      `${f}: a muzzle wins, nothing supplied keeps the verbatim arm`);
  }

  // ALL FOUR HOSTS hand it over - the FOUR HOSTS RULE, which this
  // weapon has paid for at every round it forgot one.
  const HOSTS = [
    ['src/scenes/world.js', /arrows\.fire\(cam\.pos, fwd, \{ fromPlayer: true, weapon: weaponRig\.playerWeapon\.weapon, muzzle: weaponRig\.thunderlockMuzzle\(fieldOfView\(\)\) \}\)/],
    ['src/scenes/exterior.js', /arrows\.fire\(eye, fwd, \{ fromPlayer: true, weapon: weaponRig\.playerWeapon\.weapon, muzzle: weaponRig\.thunderlockMuzzle\(fieldOfView\(\)\) \}\)/],
    ['src/scenes/worldModes.js', /interiorArrows\.fire\(player\.eye, eyeDir\(\), \{ fromPlayer: true, weapon: interiorWeapon\.playerWeapon\.weapon, muzzle: interiorWeapon\.thunderlockMuzzle\(fieldOfView\(\)\) \}\)/],
    ['src/scenes/dungeonContext.js', /fireArrow\(eye, lookDir, playerWeapon\.weapon, true, null, null, weaponRig\.thunderlockMuzzle\(fieldOfView\(\)\)\)/],
  ];
  for (const [f, re] of HOSTS) assert.match(readFileSync(f, 'utf8'), re, `${f} passes the muzzle`);

  // AND THE OFFSET IS A RAY, not a point: the muzzle's pixel is a
  // DIRECTION, so the orb sits on the barrel at whatever distance the
  // caller starts it from. Proved by projecting the world origin back
  // through the same camera and landing on the same pixel.
  const eye = [10, 3, -4];
  const look = [0.6, -0.2, 0.77];
  const fl = Math.hypot(...look);
  const f = look.map((v) => v / fl);
  let rx = f[2], rz = -f[0];
  const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  const ux = f[1] * rz, uy = f[2] * rx - f[0] * rz, uz = -f[1] * rx;
  const muzzle = { right: 0.27, up: -0.48, forward: 0.5 };
  const o = playerMuzzleOrigin(eye, look, muzzle);
  const d = [o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  assert.ok(Math.abs(dot(d, [rx, 0, rz]) - muzzle.right) < 1e-9, 'the right term survives the basis');
  assert.ok(Math.abs(dot(d, [ux, uy, uz]) - muzzle.up) < 1e-9, 'and so does the up term');
  assert.ok(Math.abs(dot(d, f) - muzzle.forward) < 1e-9, 'and the forward term');
  // no handedness flip HERE - the mirror is a fact about the drawn
  // rect and thunderlockMuzzle has already applied it, where
  // PLAYER_ARROW_SIDE is a bare number that has to be flipped.
  assert.doesNotMatch(spell.slice(spell.indexOf('export function playerMuzzleOrigin')), /flipHorizontal/);

  // the rig's door refuses for everything that is not this weapon, and
  // for a frame it has not drawn - a bow keeps GetAimPosition because
  // it gets NOTHING, not because the fork spells its name.
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /thunderlockMuzzle\(fovRad, forward = MUZZLE_FORWARD\) \{\s*\n\s*if \(!thunderlockHeld\(\)\) return null;/,
    'the weapon gate is the rig’s; the arithmetic is muzzleRay’s');

  // AND THE ARITHMETIC IS DRIVEN, not read. `muzzleRay` is the whole
  // of it, pulled out of the rig so a suite can hand it a rect and a
  // canvas with no renderer in the room.
  const DRAWN = { rect: { x: 640, y: 400, w: 320, h: 200 }, canvasW: 1280, canvasH: 800, muzzle: { x: 0.25, y: 0.75 }, flip: false };
  const FOV = 65 * Math.PI / 180;
  const ray = muzzleRay(DRAWN, FOV, 1);
  const tanY = Math.tan(FOV / 2), tanX = tanY * (1280 / 800);
  // the muzzle's pixel: 640 + 0.25*320 = 720 across, 400 + 0.75*200 = 550 down
  assert.ok(Math.abs(ray.right - ((720 / 1280) * 2 - 1) * tanX) < 1e-12);
  assert.ok(Math.abs(ray.up - (1 - (550 / 800) * 2) * tanY) < 1e-12);
  // THE SIGNS, said out loud, because they are the half of this that
  // can be silently wrong: the muzzle is LEFT of centre and BELOW it
  // on the screen, so the ray goes left and DOWN in camera space.
  assert.ok(ray.right > 0, 'right of centre (720 of 1280) is a positive right');
  assert.ok(ray.up < 0, 'below centre (550 of 800) is a NEGATIVE up - screen y counts down, camera up counts up');
  // and the other way about, so the sign is a law and not this
  // fixture's accident
  assert.ok(muzzleRay({ ...DRAWN, rect: { x: 100, y: 100, w: 320, h: 200 } }, FOV, 1).right < 0, 'left of centre is negative');
  assert.ok(muzzleRay({ ...DRAWN, rect: { x: 100, y: 100, w: 320, h: 200 } }, FOV, 1).up > 0, 'above centre is positive');
  // a taller pixel is a HIGHER ray, monotonically
  assert.ok(muzzleRay({ ...DRAWN, muzzle: { x: 0.25, y: 0.1 } }, FOV, 1).up > ray.up);
  // the mirror moves it to the other side of the rect's own centre
  assert.ok(Math.abs(muzzleRay({ ...DRAWN, flip: true }, FOV, 1).right
    - ((640 + 0.75 * 320) / 1280 * 2 - 1) * tanX) < 1e-12, 'the mirror goes with the rect');
  // the aspect is the CANVAS's: a wider canvas widens the sideways
  // term and leaves the vertical one alone
  const wide = muzzleRay({ ...DRAWN, canvasW: 2560, rect: { x: 1280, y: 400, w: 640, h: 200 } }, FOV, 1);
  assert.ok(Math.abs(wide.up - ray.up) < 1e-12, 'the vertical term does not move with the width');
  assert.ok(Math.abs(wide.right - ray.right * 2) < 1e-9, 'and the sideways one scales with the aspect');
  // and it really is a RAY: doubling the distance doubles all three
  const far = muzzleRay(DRAWN, FOV, 2);
  for (const k of ['right', 'up', 'forward']) assert.ok(Math.abs(far[k] - ray[k] * 2) < 1e-12, k);
  // nothing measured, nothing drawn on, nothing to answer
  assert.equal(muzzleRay(null, FOV, 1), null);
  assert.equal(muzzleRay({ ...DRAWN, muzzle: null }, FOV, 1), null);
  assert.equal(muzzleRay({ ...DRAWN, canvasH: 0 }, FOV, 1), null);
  assert.equal(muzzleRay(DRAWN, 0, 1), null);
});

test('FIELD-GUN17b: the flash and its light are the ORB’s colour, sampled off the orb', () => {
  // THE ORB TELLS US ITS COLOUR, once, the one moment its texture is
  // warm - rather than a hex typed twice and kept in step by hand.
  assert.equal(resetOrbColour(), undefined);
  assert.deepEqual(orbColour(), [1, 1, 1], 'white until something is sampled - a default, and it is the right one');

  // alpha-weighted mean, peak-normalised: a dim orb and a bright orb
  // of the same hue give the same colour, because this is a TINT.
  const c32 = (...px) => ({ colors: Uint8ClampedArray.from(px.flat()), width: px.length, height: 1 });
  const r3 = (c) => c.map((v) => Math.round(v * 1000) / 1000);
  const blue = c32([60, 90, 128, 255], [0, 0, 0, 0]);
  assert.deepEqual(r3(orbColourFrom(blue)), [0.469, 0.703, 1]);
  const dim = c32([30, 45, 64, 255], [0, 0, 0, 0]);
  assert.deepEqual(r3(orbColourFrom(dim)), r3(orbColourFrom(blue)),
    'half as bright, the same hue, the same tint');
  // the CLEAR half of the sprite is most of the sprite, and it must
  // not drag the mean towards black: alpha is the weight
  assert.deepEqual(r3(orbColourFrom(c32([60, 90, 128, 255], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]))), [0.469, 0.703, 1]);
  // fully transparent is no colour at all, not black
  assert.equal(orbColourFrom(c32([0, 0, 0, 0])), null);
  assert.equal(orbColourFrom({ colors: new Uint8ClampedArray(0) }), null);
  assert.equal(orbColourFrom(null), null);
  // and neither is a black sprite that IS opaque - there is no tint
  // that makes black, so the white default is the honest answer
  assert.equal(orbColourFrom(c32([0, 0, 0, 255])), null);

  // ONCE. A second archive does not get to repaint the gun.
  assert.equal(noteOrbColour(blue), true);
  assert.deepEqual(r3(orbColour()), [0.469, 0.703, 1]);
  assert.equal(noteOrbColour(c32([255, 0, 0, 255])), false, 'the second sample is refused');
  assert.deepEqual(r3(orbColour()), [0.469, 0.703, 1]);
  // a sample that answers nothing does not COUNT as the sample, or a
  // clear first frame would lock the gun to white for ever
  resetOrbColour();
  assert.equal(noteOrbColour(c32([0, 0, 0, 0])), false);
  assert.equal(noteOrbColour(blue), true, 'the real one still lands');

  // BOTH consumers read the one leaf - the sprite's own tint and the
  // light the shot throws on the world.
  const rig = readFileSync('src/combat/weaponRig.js', 'utf8');
  assert.match(rig, /const flash = orbColour\(\);/);
  assert.match(rig, /tint\.map\(\(v, i\) => v \+ \(flash\[i\] - v\) \*/, 'the frame LERPS to the orb, so an unlit room still darkens the gun');
  const gun = readFileSync('src/systems/thunderlock.js', 'utf8');
  assert.match(gun, /color: orbColour\(\)/, 'and the point light carries it too');

  // AND THE SAMPLE IS TAKEN AT BOTH MISSILE LANES, because the orb is
  // uploaded in two places and only one of them is the dungeon's.
  for (const f of ['src/combat/arrowFlight.js', 'src/scenes/dungeonContext.js']) {
    assert.match(readFileSync(f, 'utf8'), /noteOrbColour\(/, `${f} samples the orb it just uploaded`);
  }
  // the effects pool grew the door rather than the pool learning about
  // guns: `onTexture` is a callback about a TEXTURE, and a throw in it
  // does not cost the flat its flight.
  const fx = readFileSync('src/scenes/hitEffects.js', 'utf8');
  assert.match(fx, /if \(onTexture\) \{ try \{ onTexture\(t, archive, record\); \} catch/);

  resetOrbColour();
});
