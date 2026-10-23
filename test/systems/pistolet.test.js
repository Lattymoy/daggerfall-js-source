// THE DWARVEN PISTOLET, pinned (PISTOLET, 2026-10-21; bible/05-Combat/Dwarven-Pistolet.md). The Thunderlock's suite is the
// model (test/systems/thunderlock.test.js); this one pins the second gun the way the game asks about it - the producer's
// own mint, the equip law, the machine, the rig's module, the art the loader actually cuts, the bakes re-run - and the
// owner's decisions as decisions: the name, the numbers, the rarity, the pair, the Sunken Sovereign.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PISTOLET_TEMPLATE, PISTOLET_ARCHIVE, PISTOLET_TEMPLATES, PISTOLET_DAMAGE, PISTOLET_SKILL, createPistolet, isPistolet,
  PISTOLET_ICON_FILES, PISTOLET_ART_RECORDS, PISTOLET_PAPERDOLL_OFFSET, pistoletImageRecord, installPistoletIcons, GUN_SHARE,
  PISTOLET_SFX, PISTOLET_SFX_FILES, installPistoletSounds,
} from '../../src/systems/pistolet.js';
import { THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE, createThunderlock, createPellets, FIND_MIN_TIER } from '../../src/systems/thunderlock.js';
import { isGunTemplate, ammoTemplateFor, orbArchiveFor, ORB_ARCHIVE, PISTOLET_SPAN } from '../../src/characters/thunderlockIds.js';
import { weaponMinDamage, weaponMaxDamage, weaponSkillUsed } from '../../src/characters/weapons.js';
import { SKILLS } from '../../src/systems/skills.js';
import { getItemHands, ITEM_HANDS, equipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { weaponTypeForItem, WEAPON_TYPES, isGunType, isPistoletType, plainWeaponType, getWeaponAnims, THUNDERLOCK_ANIMS } from '../../src/combat/fpsWeapon.js';
import { HANDS_MODE, DUAL_GUN_TYPES, handsModeOf, dualEligible, DUAL, GUARD } from '../../src/combat/twoHands/handsLaw.js';
import { PlayerWeapon, handDesc } from '../../src/combat/playerWeapon.js';
import { GUN_FEEL, PISTOLET_FEEL, PISTOLET_TICK_SECONDS, PISTOLET_COOLDOWN_SECONDS } from '../../src/combat/gun/gunFeel.js';
import { gunWidgetSettings, TUNED_FIELDS } from '../../src/combat/gun/gunViewmodel.js';
import { createPistolLane } from '../../src/combat/gun/pistolLane.js';   // PISTOL-PORT: the rig's pistols on the page's frame
import { loadPistoletArt, cutStrip, pistoletGildKeep, flashPoint, PISTOL_STRIP } from '../../src/combat/gun/pistoletArt.js';
import { PISTOL_OPENING } from '../../src/tools/pistolLab.js';
import { uniqueFinds } from '../../src/systems/loot/lootRarity.js';
import { stockShopShelf, SHOP_ITEM_GROUPS } from '../../src/systems/shopStock.js';
import { SUNKEN_SOVEREIGN, SOVEREIGN_SABER_ERA, mintGilded, gildedRecordOf } from '../../src/systems/gilded.js';
import { validLootItem } from '../../src/systems/loot/loot.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { techniqueFamily } from '../../src/combat/technique/techniqueRoster.js';
import { armsTop, siegeIsBow } from '../../src/net/siege/siegeRef.js';
import { templateGroups, itemFindings, ITEM_LAW_VERSION } from '../../src/systems/item/itemLaw.js';
import { thunderlockMuzzleLight } from '../../src/systems/thunderlock.js';
import { OWN_MW_MODELS, OWN_MW_GILDED, ownWeaponModelFor } from '../../src/characters/ownModels/ownWeaponModels.js';
import { MW_WEAPON_TYPE } from '../../src/formats/morrowind/mwFirstPerson.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { readPng } from '../../tools/pngIO.mjs';
import { pistoletArt, SOURCE as ART_SOURCE, OUT as ART_OUT, BAND, dollGrip, DOLL_ANGLE, HAND_POSE } from '../../tools/pistoletArt.mjs';
import { bakePistolet, OUT as MW_OUT } from '../../tools/bakePistolet.mjs';
import { TEX_SIZE, GRIP_RAKE } from '../../tools/modelPistolet.mjs';

const png = (f) => readPng(readFileSync(f));
const pixelsEqual = (a, b) => a.width === b.width && a.height === b.height && Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('the item: the owner’s name and numbers, one-handed, Archery, the Pellet, the Thunderlock’s laws one weapon along', () => {
  assert.equal(PISTOLET_TEMPLATE, 562);
  assert.equal(PISTOLET_ARCHIVE, 562);
  const [row] = PISTOLET_TEMPLATES;
  assert.deepEqual([row.name, row.baseWeight, row.basePrice, row.isOneHanded], ['Dwarven Pistolet', 2.5, 260, true]);
  const it = createPistolet();
  assert.deepEqual([it.templateIndex, it.group, it.material], [562, 'Weapons', 4], 'Dwarven by default, the producer’s own mint');
  assert.ok(isPistolet(it) && isGunTemplate(562) && isGunTemplate(THUNDERLOCK_TEMPLATE) && !isGunTemplate(120));
  // 4-15, once, on the leaf, and the damage law answers it
  assert.deepEqual({ ...PISTOLET_SPAN }, { min: 4, max: 15 });
  assert.equal(PISTOLET_DAMAGE, PISTOLET_SPAN);
  assert.deepEqual([weaponMinDamage(562), weaponMaxDamage(562)], [4, 15]);
  assert.equal(weaponSkillUsed(562), SKILLS.Archery);
  assert.equal(PISTOLET_SKILL, SKILLS.Archery);
  // the Thunderlock's Pellet, and its orb
  assert.equal(ammoTemplateFor(it), PELLET_TEMPLATE);
  assert.equal(ammoTemplateFor(createThunderlock()), PELLET_TEMPLATE, 'and the Thunderlock still eats it');
  assert.equal(orbArchiveFor(it), ORB_ARCHIVE);
  assert.equal(ammoTemplateFor({ templateIndex: 120 }), null);
  // Either hand - the pair's precondition
  assert.equal(getItemHands(it), ITEM_HANDS.Either);
  assert.equal(getItemHands(createThunderlock()), ITEM_HANDS.Both, 'the Thunderlock stays two-handed');
});

test('the rarity: ONE gun find, the Thunderlock’s at its old weight, minting either gun half the time from one draw - tier 4 up, arriving loaded, never on a shelf', () => {
  // the owner: "make the thunderlock in general more rare along with the new hand cannon" - each "Half as often". AUDIT
  // PISTOLET (A5, A8, C2, C3, D6): two finds at half weight were not half (each find's cap and Luck unscaled) and moved
  // every seeded draw; one find at the old weight, splitting its mint, is exactly half of each at every source
  assert.equal(GUN_SHARE, 0.5);
  const finds = uniqueFinds();
  const gun = finds.filter((f) => f.id === 'dwarven-thunderlock' || f.id === 'dwarven-pistolet');
  assert.deepEqual(gun.map((f) => f.id), ['dwarven-thunderlock'], 'one find for both guns - no second roll to move a seed');
  assert.equal(gun[0].weight, 1, 'the old weight: the chance, its cap and its Luck the Thunderlock’s own');
  assert.equal(gun[0].minTier, 4);
  // one draw picks the gun AND counts the Pellets - the mint draws exactly what it always drew
  const once = (v) => { let n = 0; return { rolls: () => { n++; return v; }, get n() { return n; } }; };
  for (const [v, pistol, pellets] of [[0, false, 6], [0.4999, false, 18], [0.5, true, 6], [0.9999, true, 18], [0.25, false, 12], [0.75, true, 12]]) {
    const d = once(v);
    const [weapon, ammo] = gun[0].mint(d.rolls);
    assert.equal(d.n, 1, `${v}: one draw`);
    assert.equal(isPistolet(weapon), pistol, `${v}: ${pistol ? 'the Pistolet' : 'the Thunderlock'}`);
    assert.equal(ammo.templateIndex, PELLET_TEMPLATE);
    assert.equal(ammo.stackCount, pellets, `${v}: ${pellets} Pellets - it arrives loaded`);
  }
  const shelf = readFileSync('src/systems/shopStock.js', 'utf8');
  assert.ok(!/createPistolet|PISTOLET_TEMPLATE|isPistolet/.test(shelf), 'the shop stock never names it');
  for (const buildingType of Object.keys(SHOP_ITEM_GROUPS).map(Number)) {
    const all = stockShopShelf({ buildingType, quality: 20 }, { level: 30 }, { rolls: () => 0 });
    assert.ok(!all.some(isPistolet), `building ${buildingType}: no Pistolet on the shelf`);
  }
});

test('the readers that are not about ONE gun answer for both: the technique family, the siege’s reach, the item law’s group', () => {
  assert.equal(techniqueFamily(createPistolet()), 'thunderlock', 'the guns’ family - Piercing Shot, never a volley');
  assert.equal(armsTop(562, 4), 15 + 2, 'its top plus its metal');
  assert.ok(siegeIsBow(562), 'its blow is a shot');
  assert.deepEqual(templateGroups(562), ['Weapons']);
});

test('the pictures: the owner’s sprite whole in a list, a fist-gapped layer on each hand of the doll, gold for the Sunken Sovereign - and the bake reproduces every file', () => {
  const src = png(ART_SOURCE);
  assert.deepEqual([src.width, src.height], [24, 17], 'Daggerfall’s own scale - one of its pixels one of the doll’s');
  for (let p = 3; p < src.data.length; p += 4) assert.ok(src.data[p] === 0 || src.data[p] === 255, '1-bit, the screen quad’s law');
  // the tool, re-run against what shipped - pixel for pixel
  const art = pistoletArt(src);
  for (const [k, file] of Object.entries(ART_OUT)) assert.ok(pixelsEqual(art[k], png(file)), `${file} is the tool’s own output`);
  assert.ok(art.cut >= 8 && art.cut <= 40, `the gap is a fist's, not a bite (${art.cut} px)`);
  // the gap severs the grip: the frame above it and the butt below it stay drawn
  const doll = png(ART_OUT.doll);
  const at = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];
  // A DOWNWARD ANGLE (the owner, 2026-10-22: "Still wrong. It should be at a downward angle in the right hand in the
  // picture. Not mirrored"): each hand's layer is the gapped sprite turned by RotSprite - no colour in it that the
  // sprite does not have - the left hand's as drawn, its barrel DOLL_ANGLE below level; the right hand's flipped, by
  // the owner's later pick (HAND_POSE, below)
  assert.equal(DOLL_ANGLE, 45);
  const left = png(ART_OUT.dollLeft);
  const colours = (img) => { const c = new Set(); for (let p = 0; p < img.data.length; p += 4) if (img.data[p + 3]) c.add(img.data.slice(p, p + 4).join()); return c; };
  const own = colours(src);
  for (const img of [doll, left]) for (const c of colours(img)) assert.ok(own.has(c), `no new colour (${c})`);
  const gripR = dollGrip('right'), gripL = dollGrip('left');
  // where a hand's barrel goes: the layer's pixels more than 10 px from the fist, by quarter
  const reach = (img, g) => {
    const q = { dl: 0, dr: 0, ul: 0, ur: 0 };
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const dx = x + 0.5 - g.x, dy = y + 0.5 - g.y;
      if (at(img, x, y) && Math.hypot(dx, dy) > 10) q[(dy > 0 ? 'd' : 'u') + (dx > 0 ? 'r' : 'l')]++;
    }
    return q;
  };
  for (const [img, g, hand] of [[doll, gripR, 'right'], [left, gripL, 'left']]) {
    assert.equal(at(img, Math.floor(g.x), Math.floor(g.y)), 0, `${hand}: the fist’s gap at the band’s centre`);
  }
  // the LEFT hand's (the picture's right) as drawn, its barrel down and to the picture's left; the RIGHT hand's (the
  // picture's left) FLIPPED, its barrel down and to the picture's right - toward the other gun (the owner's pick from
  // rendered options: "#4 is the closest but needs adjusting", "C but lower")
  const qL = reach(left, gripL), qR = reach(doll, gripR);
  assert.ok(qL.dl > 0.9 * (qL.dl + qL.dr + qL.ul + qL.ur), `the left hand’s barrel down and out (${JSON.stringify(qL)})`);
  assert.ok(qR.dr > 0.9 * (qR.dl + qR.dr + qR.ul + qR.ur), `the right hand’s barrel down and toward the other gun (${JSON.stringify(qR)})`);
  assert.deepEqual(HAND_POSE, { left: { flip: false, turn: 45 }, right: { flip: true, turn: -60 } }, 'the left hand’s as drawn at 45, the right hand’s flipped at 60');
  // by job and by hand
  const it = createPistolet();
  assert.equal(pistoletImageRecord(it, false), PISTOLET_ART_RECORDS.icon);
  assert.equal(pistoletImageRecord({ ...it, equipSlot: EQUIP_SLOTS.RightHand }, true), PISTOLET_ART_RECORDS.doll);
  assert.equal(pistoletImageRecord({ ...it, equipSlot: EQUIP_SLOTS.LeftHand }, true), PISTOLET_ART_RECORDS.dollLeft);
  const gold = { ...it, rarity: 'gilded' };
  assert.equal(pistoletImageRecord(gold, false), PISTOLET_ART_RECORDS.gildedIcon);
  assert.equal(pistoletImageRecord({ ...gold, equipSlot: EQUIP_SLOTS.LeftHand }, true), PISTOLET_ART_RECORDS.gildedDollLeft);
  // each hand its own layer: the left hand's records are the left layer's files
  const fileOf = (rec) => PISTOLET_ICON_FILES.find((r) => r.record === rec).file;
  assert.equal(`public/art/${fileOf(PISTOLET_ART_RECORDS.dollLeft)}`, ART_OUT.dollLeft);
  assert.equal(`public/art/${fileOf(PISTOLET_ART_RECORDS.gildedDollLeft)}`, ART_OUT.dollLeftGilded);
  assert.equal(`public/art/${fileOf(PISTOLET_ART_RECORDS.doll)}`, ART_OUT.doll);
  // every record a file that ships and is allow-listed; the doll's records carry their hand's offset
  const doctrine = readFileSync('test/tooling/doctrine.test.js', 'utf8');
  for (const r of PISTOLET_ICON_FILES) {
    assert.ok(readFileSync(`public/art/${r.file}`).length > 0);
    assert.ok(doctrine.includes(`'public/art/${r.file}'`), `${r.file} is on the doctrine’s allow-list`);
  }
  // THE HANDS WERE MEASURED (TEXTURE.234's one-handed doll records leave the fist's gap at panel (27, 96) right, (69, 95)
  // left). The left hand's band centre is on its gap; the right hand's 2 px below its own, (27, 98) - the owner's pick
  // ("C but lower", "Sorry I meant #2")
  const centreR = [PISTOLET_PAPERDOLL_OFFSET.right.x - 200 + gripR.x, PISTOLET_PAPERDOLL_OFFSET.right.y - 8 + gripR.y];
  const centreL = [PISTOLET_PAPERDOLL_OFFSET.left.x - 200 + gripL.x, PISTOLET_PAPERDOLL_OFFSET.left.y - 8 + gripL.y];
  assert.ok(Math.hypot(centreR[0] - 27, centreR[1] - 98) < 1, `the right hand’s grip where the owner put it (${centreR})`);
  assert.ok(Math.hypot(centreL[0] - 69, centreL[1] - 95) < 1.5, `the left hand’s gap on its fist (${centreL})`);
});

test('the pictures register through the stand-in door, all six', async () => {
  const added = [];
  const textures = await import('../../src/systems/textureReplacement.js');
  const before = textures.vendorTextureCount();
  await installPistoletIcons({ fetchBytes: async (f) => { added.push(f); return readFileSync(`public/art/${f}`); } });
  assert.ok(textures.vendorTextureCount() >= before, 'registered');
  assert.equal(PISTOLET_ICON_FILES.length, 6);
  assert.deepEqual(new Set(PISTOLET_ICON_FILES.map((r) => r.archive)), new Set([PISTOLET_ARCHIVE]));
});

test('its sounds are the owner’s three picks, read off the one row the lab opens on, in the classic format', async () => {
  assert.deepEqual(Object.values(PISTOLET_SFX_FILES), ['fire-shotgun.wav', 'open-shell.wav', 'close-ready.wav'],
    'the owner: "Must be these values/sounds exactly" - shotgun (clean crack), shell, ready (snaps shut)');
  assert.deepEqual([PISTOL_OPENING.sfxFire, PISTOL_OPENING.sfxOpen, PISTOL_OPENING.sfxClose], ['fire-shotgun', 'open-shell', 'close-ready'], 'and the lab’s dropdowns read the same row');
  for (const f of Object.values(PISTOLET_SFX_FILES)) {
    const b = readFileSync(`public/sfx/${f}`);
    assert.equal(new DataView(b.buffer, b.byteOffset).getUint32(24, true), 11025);
  }
  const keys = [];
  const n = await installPistoletSounds({ registerSound: (k) => { keys.push(k); return true; } }, { fetchBytes: async () => new Uint8Array([1]) });
  assert.equal(n, 3);
  assert.deepEqual(keys.sort(), [PISTOLET_SFX.close, PISTOLET_SFX.fire, PISTOLET_SFX.open].sort());
});

test('the feel is the owner’s panel, one home: the game’s row, and the lab reads it back', () => {
  for (const [lab, game] of [['scale', 'scale'], ['raise', 'raise'], ['fps', 'fps'], ['reloadMs', 'reloadMs'], ['hitFrame', 'hitFrame'],
    ['kick', 'kick'], ['back', 'back'], ['stiff', 'stiff'], ['damp', 'damp'], ['shake', 'shake'], ['alphaCut', 'alphaCut']]) {
    assert.equal(PISTOL_OPENING[lab], PISTOLET_FEEL[game], `${lab}`);
  }
  assert.equal(PISTOL_OPENING.drop, PISTOLET_FEEL.hiddenTarget[1]);
  assert.equal(PISTOL_OPENING.widget, PISTOLET_FEEL.widget, 'the very object');
  assert.equal(PISTOLET_TICK_SECONDS, 1 / 12);
  assert.equal(PISTOLET_COOLDOWN_SECONDS, 1.4);
});

test('the owner’s Bob and Inertia reach the game OVER Diverse Weapons’ preset, and only the magnitudes - the player’s switches stay theirs', () => {
  _resetModSettings();
  setModSetting('diverse-weapons', 'Enabled', true);
  setModSetting('diverse-weapons', 'WeaponWidgetPreset', true);
  try {
    const own = gunWidgetSettings();
    const tuned = gunWidgetSettings(null, PISTOLET_FEEL.widget);
    assert.equal(own.bobLength, 1.42, 'the preset is on: its Bob.Length 142');
    assert.equal(tuned.bobLength, 1.46, 'and the Pistolet’s 146 over it');
    assert.equal(tuned.bobSizeYMod, 1.4);
    assert.deepEqual([tuned.inertiaScale, tuned.inertiaSpeed, tuned.inertiaForwardScale], [1000, 1000, 0]);
    for (const k of ['bob', 'offset', 'inertia', 'swing', 'recoil', 'stepTransforms']) assert.equal(tuned[k], own[k], `${k} - a switch, the player’s`);
    assert.ok(!TUNED_FIELDS.some((k) => typeof own[k] === 'boolean' && ['bob', 'offset', 'inertia'].includes(k)));
  } finally { _resetModSettings(); }
});

test('the weapon type: Pistolet 19 and its enchanted 20, the guns’ table and predicates', () => {
  const it = createPistolet();
  assert.equal(weaponTypeForItem(it), WEAPON_TYPES.Pistolet);
  assert.deepEqual([WEAPON_TYPES.Pistolet, WEAPON_TYPES.Pistolet_Magic], [19, 20]);
  assert.equal(plainWeaponType(WEAPON_TYPES.Pistolet_Magic), WEAPON_TYPES.Pistolet);
  assert.equal(getWeaponAnims(WEAPON_TYPES.Pistolet), THUNDERLOCK_ANIMS);
  assert.ok(isGunType(19) && isGunType(20) && isGunType(17) && isGunType(18) && !isGunType(14));
  assert.ok(isPistoletType(19) && isPistoletType(20) && !isPistoletType(17));
});

test('the pair’s law: two Pistolets are a pair, a Pistolet and a sword are not (two of a kind), the Thunderlock never', () => {
  assert.deepEqual([...DUAL_GUN_TYPES], [WEAPON_TYPES.Pistolet, WEAPON_TYPES.Pistolet_Magic], 'pinned to the enum');
  const p = handDesc(createPistolet()), sword = { item: true, type: WEAPON_TYPES.LongBlade, hands: ITEM_HANDS.Either };
  assert.ok(dualEligible(p));
  assert.equal(handsModeOf({ right: p, left: handDesc(createPistolet()) }), HANDS_MODE.Dual);
  assert.equal(handsModeOf({ right: p, left: sword }), HANDS_MODE.Single, 'never one of each');
  assert.equal(handsModeOf({ right: sword, left: p }), HANDS_MODE.Single);
  assert.equal(dualEligible(handDesc(createThunderlock())), false, 'two-handed');
});

/** A rig-less player weapon holding `right` and `left`, its machine stepped at 60fps. */
function pairWeapon(right, left) {
  const pw = new PlayerWeapon();
  pw.currentRightHandWeapon = right; pw.currentLeftHandWeapon = left; pw.usingRightHand = true;
  pw.applyWeapon();
  return pw;
}
const runFor = (pw, s, each = null) => { for (let t = 0; t < s; t += 1 / 60) { each?.(); pw.update(1 / 60); } };

test('the pair fires hand by hand: the lead opens, the other answers as the off hand, each hand reloads on its own - and a pull falls to the loaded pistol', () => {
  const pw = pairWeapon(createPistolet(), createPistolet());
  assert.equal(pw.handsMode, HANDS_MODE.Dual);
  assert.ok(pw.gunPair);
  const shots = [];
  runFor(pw, 4.2, () => { if (pw.machine.state === 'Idle' && pw._attack('StrikeDown')) shots.push([+pw.machine.now.toFixed(2), pw.strike.hand, pw.strike.off, pw.strike.flurry, pw.machine.frame]); });
  assert.deepEqual(shots.slice(0, 3).map((s) => s[1]), ['R', 'L', 'R'], 'right, left, right');
  assert.equal(shots[0][2], false, 'the lead’s is never the off hand’s');
  assert.equal(shots[1][2], true, 'the left’s is, and carries DUAL’s terms');
  assert.equal(shots[1][3], true, 'the left’s answer is the law’s flurry');
  assert.equal(shots[1][4], 0, 'and a gun’s flurry still plays its six frames from the first - never DUAL.FLURRY_FROM_FRAME');
  // the left fires the moment the right's frames end - it is LOADED; the right waits out its own reload
  const frames = 6 * PISTOLET_TICK_SECONDS;
  assert.ok(Math.abs(shots[1][0] - frames) < 0.05, `the left answers at ${shots[1][0]}s, the right’s frames’ end`);
  assert.ok(shots[2][0] >= frames + PISTOLET_COOLDOWN_SECONDS - 0.05, `the right is back after its own reload (${shots[2][0]}s)`);
});

test('the pistol lab\'s one departure from the flurry, in the game: past the window the law names the lead - and the lead still reloading, the pull falls to the loaded left', () => {
  const pw = pairWeapon(createPistolet(), createPistolet());
  assert.ok(pw._attack('StrikeDown'));   // the right fires
  assert.equal(pw.strike.hand, 'R');
  runFor(pw, 6 * PISTOLET_TICK_SECONDS + 0.9);   // its frames end, then past FLURRY_WINDOW - the right still reloading (1.4 s)
  assert.ok(!pw.handLoaded('R') && pw.handLoaded('L'));
  assert.ok(pw._attack('StrikeDown'), 'the pull is not a click on nothing');
  assert.equal(pw.strike.hand, 'L', 'the loaded left fires');
  assert.equal(pw.strike.off, true);
  // and every gun shot plays its six frames from the first - never the flurry's frame skip
  assert.equal(pw.machine.frame, 0);
});

test('the pair’s cadence against one Pistolet and the Thunderlock: more shots, twice the Pellets - measured through the machine', () => {
  const count = (pw, seconds) => { let n = 0; runFor(pw, seconds, () => { if (pw.machine.state === 'Idle' && pw._attack('StrikeDown')) n++; }); return n; };
  const one = count(pairWeapon(createPistolet(), null), 60);
  const pair = count(pairWeapon(createPistolet(), createPistolet()), 60);
  const rifle = count(pairWeapon(createThunderlock(), null), 60);
  // one Pistolet: 6/12 s of frames + 1.4 s = 1.9 s a shot; a pair: two shots every ~2 s
  assert.ok(Math.abs(one - 60 / 1.9) <= 1.5, `one Pistolet: ${one} shots a minute`);
  assert.ok(pair >= one * 1.8 && pair <= one * 2.05, `a pair about doubles the shots (${pair} against ${one})`);
  // damage a second, at the off hand's 0.8 for half the pair's shots: the pair a shade over the Thunderlock, for twice
  // its Pellets a minute (bible/05-Combat/Dwarven-Pistolet.md, "The balance")
  const mean = (s) => (s.min + s.max) / 2;
  const pairDps = (pair / 2) * mean(PISTOLET_SPAN) * (1 + DUAL.OFF_DAMAGE) / 60, rifleDps = rifle * 16.5 / 60;
  assert.ok(pairDps > rifleDps && pairDps < rifleDps * 1.25, `the pair ${pairDps.toFixed(2)}/s against the Thunderlock’s ${rifleDps.toFixed(2)}/s`);
  assert.ok(pair > rifle * 1.9, `and spends ${pair} Pellets a minute to its ${rifle}`);
});

test('a single Pistolet runs its OWN cadence, not the Thunderlock’s', () => {
  // PIN MOVED (PISTOL-PORT): a Pistolet fires on the pistol lab's own machine, its clock the feel's row - never the
  // classic machine's, which is the Thunderlock's alone
  const pw = pairWeapon(createPistolet(), null);
  pw._attack('StrikeDown'); pw.update(1 / 60);
  assert.deepEqual([pw.pistols.R.fps, pw.pistols.R.cooldownMs, pw.pistols.R.hitFrame], [PISTOLET_FEEL.fps, PISTOLET_FEEL.reloadMs, PISTOLET_FEEL.hitFrame]);
  assert.equal(1 / pw.pistols.R.fps, PISTOLET_TICK_SECONDS); assert.equal(pw.pistols.R.cooldownMs / 1000, PISTOLET_COOLDOWN_SECONDS);
  const tl = pairWeapon(createThunderlock(), null);
  tl._attack('StrikeDown'); tl.update(1 / 60);
  assert.equal(tl.machine.cooldown, GUN_FEEL.reloadMs / 1000, 'and the Thunderlock keeps its own');
});

test('the rig’s pistols on the page’s frame: each hand its spring, the resting hand guards, the left one flipped, the hand that fired last drawn over (PIN MOVED: PISTOL-PORT - combat/gun/pistolLane.js on the page’s own pair and frame, where combat/gun/gunPair.js composed a pair of its own)', () => {
  const lane = createPistolLane();
  const pw = pairWeapon(createPistolet(), createPistolet());
  pw._attack('StrikeDown');
  assert.deepEqual(lane.fired(pw.pistols, PISTOLET_FEEL), ['R'], 'the right fired - its own machine’s shot');
  for (let i = 0; i < 6; i++) { pw.update(1 / 60); lane.step(1 / 60, pw.pistols, { feel: PISTOLET_FEEL }); }
  assert.ok(lane.hands.R.recoil.y !== 0 && lane.hands.L.recoil.y === 0, 'the right’s spring kicked, the left’s did not');
  assert.ok(lane.hands.L.guard > 0.5 && lane.hands.R.guard === 0, 'the resting left lowers into its guard');
  assert.deepEqual(lane.order(pw.pistols), ['L', 'R'], 'the right, fired last, drawn over');
  assert.equal(lane.flipOf(pw.pistols, 'L'), true); assert.equal(lane.flipOf(pw.pistols, 'R'), false);
  assert.equal(lane.flipOf(pw.pistols, 'R', true), true, 'a left-handed player’s pair is the mirror');
  // the picture each shows: the firing hand its own machine’s, the other its rest
  assert.ok(lane.hands.R.firing);
  assert.deepEqual([lane.hands.L.firing, lane.hands.L.frame], [false, 0]);
});

test('the first-person art the loader cuts: native size, 1-bit, the muzzle on the flash, and gold on the pistol only', async () => {
  const strip = png(`public/art/${PISTOL_STRIP.file}`);
  const { frames, boxes } = cutStrip(strip);
  assert.equal(frames.length, 6);
  for (const f of frames) for (let p = 3; p < f.data.length; p += 4) assert.ok(f.data[p] === 0 || f.data[p] === 255);
  assert.deepEqual(boxes[0], { x: 6, y: 12, w: 82, h: 101 }, 'the rest frame’s box - the anchor');
  const art = await loadPistoletArt({ uploadTexture: (_k, name, t) => ({ name, t }) }, {
    fetch: async (f) => readFileSync(`public/${f}`), decode: async (b) => readPng(b),
  });
  assert.equal(art.weaponType, WEAPON_TYPES.Pistolet);
  assert.ok(Math.abs(art.pose.widthPct - 82 * 1.05 / 320) < 1e-12, 'one art pixel a design pixel, times the owner’s 1.05');
  assert.equal(art.pose.raise, -1);
  assert.equal(art.records[1].frames.length, 6);
  // the muzzle: up and left of the union box, where the flame leaves the barrel - not the moved arm's centroid
  assert.ok(art.muzzle.x < 0.25 && art.muzzle.y < 0.25, `on the flame (${art.muzzle.x.toFixed(2)}, ${art.muzzle.y.toFixed(2)})`);
  assert.equal(flashPoint(frames[0]), null, 'the rest frame has no flash');
  // the gold keeps the hand: the bracer's leather and the sleeve's grey are never gilded, the brass and the grip are
  const rest = frames[0], keep = pistoletGildKeep(rest);
  const kept = (x, y) => keep[y * rest.width + x];
  assert.equal(kept(60, 70), 0, 'the bracer');
  assert.equal(kept(85, 110), 0, 'the sleeve at the corner');
  assert.equal(kept(40, 80), 1, 'the teal grip');
  const brass = boxes[0];
  let gilt = 0;
  for (let y = brass.y; y < brass.y + 30; y++) for (let x = brass.x; x < brass.x + 40; x++) gilt += kept(x, y);
  assert.ok(gilt > 400, `the pistol’s barrel and brass are gilded (${gilt} px)`);
});

test('the flash’s light: the gun’s own reach, from the hand that fired', () => {
  const feet = [0, 0, 0];
  const right = thunderlockMuzzleLight({ _thunderlockFlash: 1, _thunderlockFlashSide: 1, _thunderlockFlashRange: PISTOLET_FEEL.flashRange }, feet, 0);
  const left = thunderlockMuzzleLight({ _thunderlockFlash: 1, _thunderlockFlashSide: -1, _thunderlockFlashRange: PISTOLET_FEEL.flashRange }, feet, 0);
  assert.equal(right.range, PISTOLET_FEEL.flashRange);
  assert.ok(right.x > 0 && left.x < 0 && Math.abs(right.x + left.x) < 1e-12, 'the left pistol’s flash on the left');
  assert.equal(thunderlockMuzzleLight({ _thunderlockFlash: 1 }, feet, 0).range, GUN_FEEL.flashRange, 'the Thunderlock’s own, unparked');
});

test('the Sunken Sovereign is a gilded Pistolet: the owner’s "replace the serpent boss gilded weapon with this new weapon"', () => {
  assert.equal(SUNKEN_SOVEREIGN.templateIndex, PISTOLET_TEMPLATE);
  const it = mintGilded(SUNKEN_SOVEREIGN);
  assert.ok(isPistolet(it));
  assert.equal(it.rarity, 'gilded');
  assert.equal(it.gilded, 'the-sunken-sovereign', 'the same record id - every hoard and save that holds one reads it');
  assert.ok(it.affixes.some((a) => a.id === 'skill' && a.param === SKILLS.Archery));
  assert.equal(pistoletImageRecord(it, false), PISTOLET_ART_RECORDS.gildedIcon);
  assert.equal(ownWeaponModelFor(it)?.model, 'pistolet_gilded.nif');
});

test('the Morrowind model is built and painted (PISTOLET-MODEL) - the bake reproduces the shipped bytes, and the row borrows the one-handed ranged act', () => {
  const r = bakePistolet();
  assert.equal(Buffer.compare(r.nif, readFileSync(MW_OUT.mesh)), 0, 'pistolet.nif is the bake’s');
  assert.equal(Buffer.compare(r.dds, readFileSync(MW_OUT.texture)), 0);
  assert.equal(Buffer.compare(r.gildedNif, readFileSync(MW_OUT.gildedMesh)), 0);
  assert.equal(Buffer.compare(r.gildedDds, readFileSync(MW_OUT.gildedTexture)), 0);
  const b = r.mesh.bounds;
  assert.ok(Math.abs((b.max[1] - b.min[1]) / 69.99125109 - 0.29) < 0.02, '29 cm long - a stout horse pistol');
  assert.ok(b.max[1] > 15 && b.min[1] < 0, 'the barrel forward of the grip, the butt behind it');
  // THE OWNER: "can you make an actual 3d model and texture it" - a modelled gun, not the sprite a block deep: its parts
  // are their own islands, it is as wide as a gun is (the old extrusion was 2.1 units thin, flat), and its texture is a
  // painted atlas at the Thunderlock's size with every material in it
  const names = new Set(r.model.islands.map((i) => i.name.split(':')[0]));
  for (const part of ['barrel', 'muzzle', 'lock', 'hammer', 'frizzen', 'pan', 'guard', 'trigger', 'grip', 'butt', 'ramrod', 'medallionR', 'medallionL']) assert.ok(names.has(part), `the ${part} is modelled`);
  assert.ok(r.mesh.indices.length / 3 > 1500 && r.mesh.indices.length / 3 < 4000, 'a Morrowind weapon’s budget');
  assert.ok(b.max[0] - b.min[0] > 2.2, 'round, not a slab');
  assert.equal(r.atlas.width, TEX_SIZE); assert.equal(TEX_SIZE, 256);
  const mats = new Set(r.model.islands.map((i) => i.mat));
  for (const m of ['brass', 'steel', 'teal', 'bore', 'flint']) assert.ok(mats.has(m), `${m} is painted`);
  // the grip through the fist: the arm's attitude is the model's own rake, and the grip's middle is the origin
  assert.equal(GRIP_RAKE, 12, 'ownWeaponModels.js PISTOL_GRIP_RAKE - the turn the fist gives it');
  const grip = r.model.islands.find((i) => i.name === 'grip');
  assert.ok(grip, 'the grip island');
  // every UV inside the atlas and every island apart
  for (const v of r.mesh.uvs) assert.ok(v >= 0 && v <= 1);
  const rects = r.model.islands;
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], c = rects[j];
    assert.ok(a.x + a.w <= c.x || c.x + c.w <= a.x || a.y + a.h <= c.y || c.y + c.h <= a.y, `${a.name} and ${c.name} do not overlap`);
  }
  // the gilded paint is the same model in gold - its teal is gone
  const teal = (img) => { let n = 0; for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 2] > img.data[i] + 30 && img.data[i + 1] > img.data[i] + 30) n++; return n; };
  assert.ok(teal(r.atlas) > 2000 && teal(r.gildedAtlas) === 0, 'the Sovereign’s enamel is gold');
  const row = OWN_MW_MODELS[PISTOLET_TEMPLATE];
  assert.equal(row.animateAs, MW_WEAPON_TYPE.MarksmanThrown, 'the one-handed ranged act Morrowind has');
  assert.equal(row.borrowsAmmo, false);
  assert.equal(row.holdAs, 'pistol', 'its own stance, not the long gun\'s');   // PIN MOVED (PISTOL-STANCE): it held the clip's, a throw - test/combat/pistolstance.test.js pins the stance
  assert.equal(OWN_MW_GILDED[PISTOLET_TEMPLATE].model, 'pistolet_gilded.nif');
});

test('AUDIT PISTOLET A7 C1 D8: a Sunken Sovereign minted before PISTOLET - an Ebony Saber with a Long Blade line - stays lawful and reads its own lore; the pistol is lawful; a hybrid is a forgery (mutants: the era dropped; the era\'s template; the era read by every saber)', () => {
  // the shape GILDED2 minted: the same mint, the record as it stood at the base
  const saber = mintGilded(SOVEREIGN_SABER_ERA);
  assert.equal(saber.templateIndex, WEAPONS.Saber);
  assert.ok(saber.affixes.some((a) => a.id === 'skill' && a.param === SKILLS.LongBlade));
  assert.deepEqual(itemFindings(saber), [], 'the law finds nothing - no trade hold, no market refusal');
  assert.ok(validLootItem(saber), 'and the wire keeps it - a trade, a pile, a body');
  assert.equal(gildedRecordOf(saber), SOVEREIGN_SABER_ERA, 'it reads its own record');
  assert.match(gildedRecordOf(saber).lore, /saber/);
  const pistol = mintGilded(SUNKEN_SOVEREIGN);
  assert.deepEqual(itemFindings(pistol), []);
  assert.ok(validLootItem(pistol));
  assert.equal(gildedRecordOf(pistol), SUNKEN_SOVEREIGN);
  // the two shapes do not mix: a saber with the pistol's line, a pistol with the saber's, are forgeries
  const hybrid = { ...saber, affixes: pistol.affixes.map((a) => ({ ...a })) };
  assert.deepEqual(itemFindings(hybrid), ['gilded'], 'a saber with the Archery line');
  const hybrid2 = { ...pistol, affixes: saber.affixes.map((a) => ({ ...a })) };
  assert.deepEqual(itemFindings(hybrid2), ['gilded'], 'a pistol with the Long Blade line');
  assert.equal(ITEM_LAW_VERSION, 11, 'the law that knows both - a finding a law of 9 made is asked again');   // PIN MOVED (SEA-SET, at the merge into SEA VENTURES): law 11 - PISTOLET's 10 and the Eltheric Tidemail's nine records
});

test('the pair is equipped through the equip law - one in each hand - and the player weapon reads it as a gun pair', () => {
  const e = { isPlayer: true, items: [], stats: { strength: 50, agility: 50 } };
  const a = createPistolet(), b = createPistolet();
  e.items.push(a, b, createPellets(10));
  equipItem(e, a); equipItem(e, b);
  const worn = Object.values(e.equip?.slots ?? {}).filter((v) => v && isPistolet(v));
  assert.equal(worn.length, 2, 'both worn');
  assert.ok(new Set(worn.map((v) => v.equipSlot)).size === 2, 'in two different hands');
});
