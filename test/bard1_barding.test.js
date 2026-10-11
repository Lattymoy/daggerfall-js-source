// BARD1 (2026-10-11, the owner: "can you do sprite armor for the 2d sprites and 3d armor for the horse"; asked, "Look +
// light trade-off" and all four kinds): HORSE BARDING (bible/06-Systems/Horse-Barding.md) - the law (systems/
// horseBarding.js), the look's code that carries it to every picture and the wire (systems/horseCoats.js, net/wire.js),
// the sprite's paint (recolorHorse), the 3D horse's shells (world/horseModel.js bardingShells, world/horseRig.js), the
// four items and the Stable that sells and fits them, and what it does - the rider's armour astride, the horse's pace
// and its breath (systems/upkeepRuntime.js, systems/steedCare.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import {
  BARDING_KINDS, CAPARISON_COLOURS, BARDING_ARMOR, BARDING_LOAD, CAPARISON_LOAD, BREATH_BURDEN, horseBardingOf, bardingLoad, bardingPace,
  bardingBreath, riderArmor, describeBarding, bardingEffects, fitBarding, fitCaparison, bardingRows, bardingPixel, bardingTexels, caparisonTexels,
  BARDING_TEXELS, BARDING_KNEE, CAPARISON_BAND,
} from '../src/systems/horseBarding.js';
import {
  horseLookCode, horseLookOfCode, horseLookOf, horseHideCode, readHorseLook, HORSE_LOOK_CODE_MAX, HORSE_HIDE_CODES, describeHorseLook, recolorHorse, riddenHorseLook,
} from '../src/systems/horseCoats.js';
import { HORSE_LOOK_MAX, validPose, POSE_RIDE } from '../src/net/wire.js';
import { BARDING_ITEM, BARDING_ITEMS_ONLINE, bardingItemsAvailable, UPKEEP_ITEM_ROWS, isBardingItem } from '../src/systems/upkeepItemRows.js';
import { yardStock } from '../src/systems/merchantYards.js';
import { validItemField } from '../src/systems/itemFields.js';
import { itemFindings } from '../src/systems/itemLaw.js';
import { bardingShells, horseSkinStream } from '../src/world/horseModel.js';
import { createHorseRig } from '../src/world/horseRig.js';
import { createUpkeep, setAstride, astridePoints } from '../src/systems/upkeepRuntime.js';
import { stepBreath, freshBreath } from '../src/systems/steedCare.js';
import { entityArmorPoints, computeEntityMods } from '../src/systems/entityMods.js';
import { stableProviderFor } from '../src/ui/holdingsPages.js';
import { itemStatRows } from '../src/systems/itemInfo.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const BAKE = JSON.parse(rd('src/assets/horse/courser.json'));
const horse = (seed = 7, more = {}) => ({ group: 'Transportation', templateIndex: 94, horseSeed: seed, ...more });
const piece = (t, n = 1) => ({ group: 'UselessItems2', templateIndex: t, ...(n > 1 ? { stackCount: n } : {}) });

test('BARD1 the law: three bardings and eight cloths; the rider armoured by the barding alone; its weight the horse\'s pace on its Strength, and its breath at the gallop (mutants: the armour, the loads, the ease)', () => {
  assert.deepEqual([...BARDING_KINDS], ['none', 'leather', 'chain', 'plate']);
  assert.deepEqual([...CAPARISON_COLOURS], ['none', 'crimson', 'azure', 'forest', 'gold', 'sable', 'ivory', 'purple', 'orange']);
  assert.deepEqual({ ...BARDING_ARMOR }, { none: 0, leather: 2, chain: 4, plate: 6 });
  assert.deepEqual({ ...BARDING_LOAD }, { none: 0, leather: 0.03, chain: 0.06, plate: 0.1 });
  assert.equal(CAPARISON_LOAD, 0.01); assert.equal(BREATH_BURDEN, 3);
  assert.deepEqual([0, 1, 2, 3].map((b) => riderArmor({ barding: b, caparison: 4 })), [0, 2, 4, 6], 'the cloth arms no one');
  assert.equal(bardingPace({}), 1); assert.equal(bardingBreath({}), 1);
  const plate = { barding: 3 };
  assert.equal(Math.round(bardingPace(plate, 50) * 1000), 930, 'plate on Strength 50: 7% slower');
  assert.ok(bardingPace(plate, 90) > bardingPace(plate, 50) && bardingPace(plate, 50) > bardingPace(plate, 10), 'a strong horse carries it lighter');
  assert.equal(Math.round(bardingBreath({ barding: 3, caparison: 1 }) * 100), 133);
  assert.equal(bardingLoad({ barding: 9, caparison: 99 }), 0, 'what the law does not know weighs nothing');
  assert.deepEqual(horseBardingOf(horse(1, { horseBarding: 2, horseCaparison: 7 })), { barding: 2, caparison: 7 });
  assert.deepEqual(horseBardingOf({ group: 'Weapons', templateIndex: 113, horseBarding: 3 }), { barding: 0, caparison: 0 }, 'a horse\'s alone');
  assert.equal(describeBarding({ barding: 3, caparison: 2 }), 'plate barding under an azure caparison');
  assert.equal(describeBarding({ caparison: 1 }), 'a crimson caparison');
  assert.equal(describeBarding({}), '');
  assert.match(bardingEffects(plate).text, /Rider armour \+6 · Speed -7% · Gallop tires 30% faster/);
  assert.equal(bardingEffects({}).text, 'Unarmoured: no burden.');
});

test('BARD1 the look: what a horse wears is its look\'s high digits - a bare horse\'s code and look COATS1\'s, a barded one every picture\'s and the wire\'s; the hide\'s code the 3D dye\'s (mutants: the digits, the hide\'s strip)', () => {
  assert.equal(HORSE_HIDE_CODES, 7 * 5 * 3 * 65536);
  assert.equal(HORSE_LOOK_CODE_MAX, HORSE_HIDE_CODES * 36 - 1);
  assert.equal(HORSE_LOOK_MAX, HORSE_LOOK_CODE_MAX, 'the relay keeps exactly the looks the law makes');
  const bare = { coat: 2, pattern: 1, legs: 1, seed: 500 };
  assert.deepEqual(readHorseLook(bare), bare, 'a bare look has no barding keys');
  const worn = { ...bare, barding: 2, caparison: 5 };
  const c = horseLookCode(worn);
  assert.equal(c, horseLookCode(bare) + HORSE_HIDE_CODES * (2 + 4 * 5));
  assert.deepEqual(horseLookOfCode(c), worn);
  assert.equal(horseHideCode(worn), horseLookCode(bare)); assert.equal(horseHideCode(c), horseLookCode(bare));
  const h = horse(500, { horseCoat: 2, horsePattern: 1, horseLegs: 1, horseBarding: 2, horseCaparison: 5 });
  assert.deepEqual(horseLookOf(h), worn);
  assert.equal(riddenHorseLook([h]), c, 'the ridden horse\'s look - the riding sprite\'s, the pose\'s `rc` - wears it');
  assert.equal(describeHorseLook(c), 'black pinto with socks, in chain barding under a sable caparison');
  const pose = validPose({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, rd: POSE_RIDE.Horse, rc: c });
  assert.equal(pose.rc, c, 'a barded look rides the pose');
});

/** A plain bay hide, rows top first: a block of the bay's red-brown, `h` tall. */
function hideImage(w = 24, h = 40) {
  const colors = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; colors[o] = 140; colors[o + 1] = 80; colors[o + 2] = 40; colors[o + 3] = 255; }
  return { width: w, height: h, colors };
}
const px = (img, x, y) => [...img.colors.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)];

test('BARD1 the sprite: the armour painted over the hide above the knees, the hide\'s own light its shading; the caparison a skirt over the barrel; leather the head bare; the riding sprite no skirt; a bare bay untouched (mutants: the knee, the skirt, the riding sprite\'s)', () => {
  const img = hideImage();
  assert.equal(recolorHorse(img, 0, { bottomFirst: false }), img, 'the bay as drawn, bare: no pass');
  const plate = recolorHorse(img, horseLookCode({ barding: 3 }), { bottomFirst: false });
  assert.notEqual(plate, img);
  const high = px(plate, 12, 5), low = px(plate, 12, 38);
  assert.ok(high[2] > high[0], `steel above the knees (${high})`);
  assert.deepEqual(low, [140, 80, 40], 'the legs\' hide below them, a bay\'s seed-nought hide undyed');
  const cap = recolorHorse(img, horseLookCode({ caparison: 1 }), { bottomFirst: false });
  const mid = px(cap, 12, 20);
  assert.ok(mid[0] > 100 && mid[1] < 50, `crimson over the barrel (${mid})`);
  assert.deepEqual(px(cap, 12, 1), [140, 80, 40], 'the head and the neck\'s top above the skirt');
  const leather = recolorHorse(img, horseLookCode({ barding: 1 }), { bottomFirst: false });
  assert.deepEqual(px(leather, 12, 0), [140, 80, 40], 'leather leaves the head bare');
  assert.notDeepEqual(px(leather, 12, 15), [140, 80, 40]);
  const riding = recolorHorse(img, horseLookCode({ barding: 2, caparison: 1 }), { bottomFirst: false, legs: false, tack: false });
  assert.ok(px(riding, 12, 38)[2] > px(riding, 12, 38)[0], 'the riding sprite: mail from its lower edge, no skirt');
  // the paint itself
  assert.equal(bardingPixel({ barding: 3 }, { shade: 1, fy: BARDING_KNEE - 0.01, px: 0, py: 0 }), null);
  assert.ok(bardingPixel({ barding: 3 }, { shade: 1, fy: BARDING_KNEE, px: 0, py: 3 }));
  assert.ok(bardingPixel({ caparison: 2 }, { shade: 1, fy: CAPARISON_BAND[0] + 0.1, px: 0, py: 0 }));
  assert.equal(bardingPixel({ caparison: 2 }, { shade: 1, fy: CAPARISON_BAND[0] + 0.1, px: 0, py: 0, legs: false }), null);
});

test('BARD1 the 3D horse: four shells off the body\'s own triangles, pushed out and skinned as the hide under them; each horse shows the one it wears, in its picture, the hide dyed by its hide\'s code (mutants: the pieces, the push, the shown)', async () => {
  const shells = bardingShells(BAKE);
  assert.deepEqual(shells.map((s) => s.part), ['barding:leather', 'barding:chain', 'barding:plate', 'barding:caparison']);
  const tris = Object.fromEntries(shells.map((s) => [s.kind, s.corners.length / 16 / 3]));
  assert.ok(tris.plate > tris.chain && tris.chain > tris.leather && tris.leather > 200, JSON.stringify(tris));
  const body = BAKE.meshes.find((m) => m.part === 'body');
  // every shell corner is a body vertex pushed out along its normal, its four bones and weights the vertex's
  const plate = shells[2].corners;
  let ok = 0;
  for (let k = 0; k < plate.length; k += 16 * 7) {
    const n = body.positions.length / 3;
    for (let v = 0; v < n; v++) {
      const d = [0, 1, 2].map((a) => plate[k + a] - body.positions[v * 3 + a]);
      if (Math.abs(Math.hypot(...d) - 0.032) < 1e-4 && d.every((x, a) => Math.abs(x - body.normals[v * 3 + a] * 0.032) < 1e-4)) {
        assert.deepEqual([...plate.slice(k + 8, k + 12)], body.joints.slice(v * 4, v * 4 + 4));
        ok++; break;
      }
    }
  }
  assert.ok(ok > 10, `${ok} corners traced to their vertex`);
  const s = horseSkinStream(BAKE);
  assert.deepEqual(s.ranges.slice(2).map((r) => [r.part, r.texture]), shells.map((x) => [x.part, 'barding']));
  // the rig
  const made = [];
  const r = {
    createSkinnedCharacterMesh: (stream, o) => ({ vao: {}, vbo: {}, count: stream.length / o.floats, floats: o.floats, skin: { tex: {} } }),
    createSkinPalette: () => ({ tex: {} }), releaseCharacterSkin: () => {}, updateSkinPalette: () => {}, releaseCharacterTexture: () => {},
    createCharacterTexture: (mips, o) => { made.push(o ?? null); return { id: made.length }; },
  };
  const rig = createHorseRig({ renderer: r, fetchJson: async () => BAKE, fetchBytes: async (u) => new Uint8Array(readFileSync(new URL(u))),
    decode: async (b) => { const p = PNG.sync.read(Buffer.from(b)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; } });
  await rig.load();
  const h = rig.horse(1);
  const shown = () => h.mesh.ranges.filter((x) => !x.hidden).map((x) => x.part);
  rig.step(h, { feet: [0, 0, 0], yaw: 0, look: 0 });
  assert.deepEqual(shown(), ['body', 'hair']);
  const bare = horseLookCode({ coat: 1, seed: 9 }), worn = horseLookCode({ coat: 1, seed: 9, barding: 3, caparison: 2 });
  rig.step(h, { feet: [0, 0, 0], yaw: 0, look: worn });
  assert.deepEqual(shown(), ['body', 'hair', 'barding:plate', 'barding:caparison']);
  assert.equal(h.look, worn);
  rig.step(h, { feet: [0, 0, 0], yaw: 0, look: bare });
  assert.equal(h.mesh.ranges[0].tex, rig.lookTex(bare), 'one hide picture for the bare and the barded');
  rig.step(h, { feet: [0, 0, 0], yaw: 0, look: horseLookCode({ barding: 1 }) });
  assert.deepEqual(shown(), ['body', 'hair', 'barding:leather']);
  assert.ok(made.some((o) => o?.wrapS === 0x2901), 'the barding\'s pictures tile');
  // the pictures
  assert.equal(bardingTexels('plate').length, BARDING_TEXELS * BARDING_TEXELS * 4);
  const cap = caparisonTexels(1), last = (BARDING_TEXELS * BARDING_TEXELS - 1) * 4;
  assert.ok(cap[0] > cap[2] && cap[last] > 150 && cap[last + 1] > 120, 'crimson cloth, a gold hem');
  assert.ok(caparisonTexels(4)[last] < 80, 'a gold cloth\'s hem sable');
});

test('BARD1 the items: four rows the law knows, rarity 20, sold at the Stable offline - online once their own switch is on (REST6); the horse\'s two fields on DFU\'s Horse alone, carried to its next owner (mutants: the switch, the stock, the fields)', () => {
  assert.deepEqual({ ...BARDING_ITEM }, { Leather: 1712, Chain: 1713, Plate: 1714, Caparison: 1715 });
  assert.deepEqual(UPKEEP_ITEM_ROWS.slice(2).map((r) => [r.index, r.name, r.baseWeight, r.basePrice, r.rarity]),
    [[1712, 'Leather Barding', 15, 400, 20], [1713, 'Chain Barding', 40, 1200, 20], [1714, 'Plate Barding', 60, 3000, 20], [1715, 'Caparison', 6, 250, 20]]);
  assert.equal(BARDING_ITEMS_ONLINE, false, 'REST6: the release that ships the templates sells none online');
  assert.deepEqual([bardingItemsAvailable(false), bardingItemsAvailable(true)], [true, false]);
  assert.deepEqual(yardStock('stable').filter(isBardingItem).map((it) => it.templateIndex), [1712, 1713, 1714, 1715]);
  assert.deepEqual(yardStock('stable', { online: true }).filter(isBardingItem), []);
  assert.deepEqual(yardStock('transport').filter(isBardingItem), [], 'the Stable\'s, not the wagon yard\'s');
  assert.equal(validItemField('horseBarding', 3), 3); assert.equal(validItemField('horseBarding', 4), undefined); assert.equal(validItemField('horseBarding', 0), undefined);
  assert.equal(validItemField('horseCaparison', 8), 8); assert.equal(validItemField('horseCaparison', 9), undefined);
  assert.deepEqual(itemFindings({ ...horse(3, { horseBarding: 3, horseCaparison: 1 }), value: 1000 }), []);
  assert.deepEqual(itemFindings({ group: 'Weapons', templateIndex: 113, horseBarding: 1 }), ['horse']);
  assert.match(itemStatRows({ ...piece(1714), name: 'Plate Barding' }).map((r) => r.text).join(' '), /rider \+6 armour astride/);
});

test('BARD1 the fitting: a kind out of the pack onto the ridden horse, the old one back into it; none carried, none fitted; a caparison fitted dyed again free; the Stable\'s rows open what the pack can fit (mutants: the swap, the take, the free dye)', () => {
  const items = [horse(4), piece(1712), piece(1714, 2)];
  assert.equal(fitBarding(items, 2).ok, false, 'no chain in the pack');
  let r = fitBarding(items, 3);
  assert.ok(r.ok); assert.match(r.text, /Plate Barding/);
  assert.equal(items[0].horseBarding, 3);
  assert.equal(items.find((it) => it.templateIndex === 1714).stackCount, 1, 'one of the two taken');
  r = fitBarding(items, 1);
  assert.ok(r.ok); assert.equal(items[0].horseBarding, 1);
  assert.equal(items.filter((it) => it.templateIndex === 1714).reduce((n, it) => n + (it.stackCount ?? 1), 0), 2, 'the plate back in the pack');
  assert.equal(items.some((it) => it.templateIndex === 1712), false, 'the leather on the horse');
  r = fitBarding(items, 0);
  assert.ok(r.ok); assert.equal('horseBarding' in items[0], false); assert.ok(items.some((it) => it.templateIndex === 1712 && it.name === 'Leather Barding'));
  assert.equal(fitBarding(items, 0).ok, false, 'none to take off');
  assert.equal(fitBarding([], 1).ok, false);
  // the caparison
  const pack = [horse(5), piece(1715)];
  assert.ok(fitCaparison(pack, 3).ok); assert.equal(pack[0].horseCaparison, 3); assert.equal(pack.length, 1);
  assert.ok(fitCaparison(pack, 6).ok, 'dyed again, free'); assert.equal(pack[0].horseCaparison, 6); assert.equal(pack.length, 1);
  assert.ok(fitCaparison(pack, 0).ok); assert.equal(pack.length, 2); assert.equal('horseCaparison' in pack[0], false);
  // the rows
  const rows = bardingRows([horse(6, { horseBarding: 1 }), piece(1714)]);
  assert.deepEqual(rows.rows[0].open, [true, true, false, true]);
  assert.deepEqual(rows.rows[1].open, [true, false, false, false, false, false, false, false, false]);
  assert.equal(rows.desc, 'leather barding');
  assert.equal(bardingRows([piece(1714)]), null);
});

test('BARD1 what it does: astride, the rider\'s every part armoured by the barding, re-summed as they mount and dismount; the ride\'s pace and the gallop\'s breath carry its weight (mutants: the fold, the mode, the pace, the burden)', () => {
  const me = { items: [horse(8, { horseBarding: 3 })] };
  let mode = 'Foot';
  const up = createUpkeep({ items: () => me.items, now: () => 1000, rider: () => me });
  up.tick(0.016, { mode });
  assert.equal(astridePoints(me), 0); assert.equal(entityArmorPoints(me, 0), 0);
  mode = 'Horse';
  up.tick(0.016, { mode });
  assert.equal(astridePoints(me), 6);
  for (let p = 0; p < 7; p++) assert.equal(entityArmorPoints(me, p), 6, `part ${p}`);
  me.items[0] = horse(8, { horseBarding: 1 });
  up.tick(0.016, { mode });
  assert.equal(entityArmorPoints(me, 2), 2, 'a fitting astride re-sums');
  up.tick(0.016, { mode: 'Foot' });
  assert.equal(entityArmorPoints(me, 2), 0, 'afoot, none');
  setAstride(me, 0); computeEntityMods(me);
  // the pace: horse care off, Strength 50's; on, the horse's own with its Speed
  me.items[0] = horse(8, { horseBarding: 3 });
  assert.equal(Math.round(up.rideScale('Horse') * 1000), 930);
  me.items[0] = horse(8);
  assert.equal(up.rideScale('Horse'), 1);
  const cared = createUpkeep({ items: () => [horse(8, { horseBarding: 3 })], now: () => 1000, horseCare: () => true });
  const bareCared = createUpkeep({ items: () => [horse(8)], now: () => 1000, horseCare: () => true });
  assert.ok(cared.rideScale('Horse') < bareCared.rideScale('Horse'));
  // the breath
  const stats = { speed: 50, stamina: 50, endurance: 50, strength: 50 };
  const a = stepBreath(freshBreath(), { stats, galloping: true, dt: 1 }), b = stepBreath(freshBreath(), { stats, galloping: true, dt: 1, burden: 1.3 });
  assert.equal(Math.round((b.spent / a.spent) * 100), 130);
});

test('BARD1 the Stable page and the hosts: the provider\'s rows and its two verbs; both hosts hand the upkeep its rider; the rig and the paint wired (mutants: the verbs, the rider)', () => {
  const items = [horse(9), piece(1713)];
  let painted = 0;
  const p = stableProviderFor({ runtime: { stableView: () => null }, on: () => false, hasHorse: () => true, hasCart: () => false, items: () => items, onPainted: () => { painted++; } });
  const m = p.stable();
  assert.deepEqual(m.barding.rows.map((r) => r.part), ['barding', 'caparison']);
  assert.ok(p.stableAct('barding', 2).ok); assert.equal(items[0].horseBarding, 2); assert.equal(painted, 1);
  assert.equal(p.stableAct('caparison', 1).ok, false, 'no cloth in the pack');
  assert.match(p.stable().look.desc, /in chain barding/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(f), /say: \(l\) => townTalk\.say\(l\),\n {4}rider: \(\) => playerEntity,/, f);
  assert.match(rd('src/systems/upkeepRuntime.js'), /setAstride\(rider\(\), mode === 'Horse' \? riderArmor\(horseBardingOf\(activeHorseItem\(its\)\)\) : 0\);/);
  assert.match(rd('src/world/horseRig.js'), /h\.mesh\.ranges\[0\]\.tex = lookTex\(horseHideCode\(l\)\);/);
  assert.match(rd('src/systems/horseCoats.js'), /if \(dyes\) dyeInto\(out, src, i \* 4, dye, hueJ, valJ, white, dark\);\n\s*if \(worn\) \{/);
});
