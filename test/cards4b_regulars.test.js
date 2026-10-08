// CARDS4b (2026-10-08, bible/11-Multiplayer/Tavern-Cards.md section 18): THE REGULARS AT THE TABLE. Driven: a
// regular's look minted from the seed that names him (world/cardRegulars.js) - his region's people, a face, a tavern-goer's
// clothes from Daggerfall's templates in the slots they are worn in, the same every evening, a look the peer layers read;
// the regulars stood in the chairs the cloth gives them, seated through the pose's own byte, none who left; what each
// says for his play; the line's layers taking a seat (world/familyBodies.js); and by source, the hosts: the interior
// host hands world.js its regulars every frame (none outside a building), world.js stands them on layers of their own,
// draws them with the room's people and their bodies with the peers', and puts their lines on the crew's one layer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { regularLook, regularsToStand, regularBark, REGULAR_CLOTHES, REGULAR_FACES, BARK_MS, REGULAR_HEAD_M } from '../src/world/cardRegulars.js';
import { BANK_TYPES } from '../src/characters/nameHelper.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { seatTopByte } from '../src/player/seatPose.js';
import { validLook } from '../src/net/wire.js';
import { peerStubEntity } from '../src/net/remotePlayers.js';
import { familyShown, createFamilyBodies } from '../src/world/familyBodies.js';
import { CardTableSession } from '../src/systems/cardTableSession.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('CARDS4b a regular\'s look: his region\'s people, a face, a tavern-goer\'s clothes in their slots - the same every evening, a look the peers\' layers read', () => {
  assert.deepEqual(regularLook(77, BANK_TYPES.Nord, 0), regularLook(77, BANK_TYPES.Nord, 0), 'the same seed dresses him alike');
  assert.notDeepEqual(regularLook(77, BANK_TYPES.Nord, 0), regularLook(78, BANK_TYPES.Nord, 0));
  assert.equal(regularLook(1, BANK_TYPES.Redguard, 0).race, 'Redguard');
  assert.equal(regularLook(1, BANK_TYPES.DarkElf, 1).race, 'DarkElf');
  assert.equal(regularLook(1, BANK_TYPES.Imperial, 0).race, 'Breton', 'the Imperial bank\'s people drawn as the bay\'s');
  let gowns = 0;
  for (let seed = 0; seed < 400; seed++) {
    const gender = seed % 2;
    const look = regularLook(seed, BANK_TYPES.Breton, gender);
    const kit = gender ? REGULAR_CLOTHES.female : REGULAR_CLOTHES.male;
    assert.equal(look.gender, gender ? 'female' : 'male');
    assert.ok(look.faceIndex >= 0 && look.faceIndex < REGULAR_FACES);
    const bySlot = new Map(look.items.map((it) => [it.equipSlot, it]));
    assert.ok(kit.feet.includes(bySlot.get(EQUIP_SLOTS.Feet)?.templateIndex), 'shod');
    const chest = bySlot.get(EQUIP_SLOTS.ChestClothes)?.templateIndex;
    if (gender && REGULAR_CLOTHES.female.gown.includes(chest)) { gowns++; assert.ok(!bySlot.has(EQUIP_SLOTS.LegsClothes), 'a gown is worn alone'); }
    else { assert.ok(kit.chest.includes(chest)); assert.ok(kit.legs.includes(bySlot.get(EQUIP_SLOTS.LegsClothes)?.templateIndex)); }
    for (const it of look.items) assert.equal(it.group, gender ? 'WomensClothing' : 'MensClothing');
    // the peers' own reading of a look keeps every piece
    assert.ok(validLook(look), 'the wire\'s look law');
    assert.equal(peerStubEntity(look).items.length, look.items.length, 'every piece worn');
  }
  assert.ok(gowns > 20, 'some regulars wear a gown');
});

test('CARDS4b the regulars stood in their chairs, seated through the pose\'s byte; a regular who left, and the player, not', () => {
  const session = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: [{ id: 'patron:0', name: 'Ana', temper: 'tight', stack: 400 }, { id: 'patron:1', name: 'Bors', temper: 'loose', stack: 400 }], stakes: { sb: 5, bb: 10 }, rand32: () => 1, now: 0 });
  const seats = [0, 1, 2].map((k) => ({ feet: [k, 0, 0], yaw: k * 0.5, top: 0.8 }));
  const regulars = new Map([['Ana', { seed: 11, bank: 0, gender: 1 }], ['Bors', { seed: 12, bank: 0, gender: 0 }]]);
  const list = regularsToStand({ session, seats, seatOf: [1, 2, 0], regulars, key: 'k' });
  assert.deepEqual(list.map((r) => [r.key, r.res.name, r.feet, r.yaw, r.st]), [['card:k:1', 'Ana', [2, 0, 0], 1, seatTopByte(0.8)], ['card:k:2', 'Bors', [0, 0, 0], 0, seatTopByte(0.8)]]);
  assert.deepEqual(list[0].res.look, regularLook(11, 0, 1), 'dressed by the seed that named her');
  session.seats[1].gone = true;
  assert.deepEqual(regularsToStand({ session, seats, seatOf: [1, 2, 0], regulars, key: 'k' }).map((r) => r.res.name), ['Bors'], 'a regular gone home is not drawn');
  assert.deepEqual(regularsToStand({ session: null, seats, seatOf: [], regulars, key: 'k' }), []);
  // the line's layers take a seat: the pose's byte on the shown, none standing
  assert.equal(familyShown([1, 2, 3], 0.5, false, 16).st, 16);
  assert.equal('st' in familyShown([1, 2, 3], 0.5, false), false);
  const synced = [];
  const fam = createFamilyBodies({ dolls: { sync: (peers) => synced.push(...peers), batches: () => [] } });
  fam.begin();
  assert.equal(fam.stand({ id: 'card:k:1', look: list[0].res.look }, [2, 0, 0], 1, false, 16), true);
  fam.end(0, null);
  assert.equal(synced[0].shown.st, 16, 'seated on the peers\' layers');
});

test('CARDS4b what a regular says: his play, his win, his leaving', () => {
  assert.equal(regularBark({ t: 'act', type: 'call' }, 0), 'I\'ll see that.');
  assert.equal(regularBark({ t: 'act', type: 'raise', to: 40 }, 0), 'Raise. 40.');
  assert.equal(regularBark({ t: 'act', type: 'raise', to: 20, bet: true }, 0), '20.');
  assert.equal(regularBark({ t: 'act', type: 'raise', to: 400, allIn: true }, 0.99), 'I\'m all in.');
  assert.equal(regularBark({ t: 'act', type: 'fold' }, 0.5), 'I\'m out.');
  assert.equal(regularBark({ t: 'won' }, 0), 'Mine, I think.');
  assert.ok(regularBark({ t: 'leave' }, 0));
  assert.equal(regularBark({ t: 'street' }, 0), null, 'a street is nobody\'s line');
  assert.ok(BARK_MS > 1000 && REGULAR_HEAD_M > 1 && REGULAR_HEAD_M < 1.6);
});

test('CARDS4b the hosts: the interior hands its regulars over every frame (none outside a building); world.js stands, draws and voices them', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /host\.cardRegulars\?\.\(mode === 'interior' \? cardRegularsNow\(performance\.now\(\)\) : \[\], dt, cam\.pos\);/);
  assert.match(wm, /if \(!g\?\.session \|\| g\.remote \|\| !cardSeat\) return \[\];/, 'none at a relay\'s table, nor before the deal');
  assert.match(wm, /cardSeat\.free\[i - 1\]/, 'in the chairs the cloth gives them');
  assert.match(wm, /cardBark\(g, e, now\); \}/, 'their play said as it happens');
  const w = read('src/scenes/world.js');
  assert.match(w, /livingBillboards: \(\) => \[\.\.\.\(livingIndoors\?\.batches\(\) \?\? \[\]\), \.\.\.\(cardRegularBodies\?\.batches\(\) \?\? \[\]\)\],/);
  assert.match(w, /if \(_mode\(\) === 'interior'\) cardRegularBodies\?\.draw\(canvas, \{ proj, view, eye \}\);/);
  assert.match(w, /if \(!list\?\.length\) \{ if \(cardRegularBodies\) \{ cardRegularBodies\.clear\(\); cardRegularBodies = null; \} _cardBarks = \[\]; return; \}/, 'freed the moment none sit');
  assert.match(w, /for \(const m of list\) cardRegularBodies\.stand\(m\.res, m\.feet, m\.yaw, false, m\.st\);/, 'seated');
  assert.match(w, /for \(const b of _cardBarks\) \{\n\s+const over = \[b\.feet\[0\], b\.feet\[1\] \+ CARD_REGULAR_HEAD_M, b\.feet\[2\]\];/, 'their lines over their heads, on the crew\'s layer');
  assert.match(w, /if \(\(!livingIndoors && !_cardBarks\.length\) \|\| typeof document === 'undefined'\) return;/, 'with the living world off too');
});
