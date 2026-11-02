// AUDIT WHERE-ROBES (2026-10-04, Mac: "Audit this"): the pins for what the audit of FIELD BUGS 2026-10-04c found -
// three readers (the surface law; the click, the name and the resync; the suite, the docs and the merges), each finding
// reproduced against the real modules before it was fixed (bible/01-Overview/bugs/Field-Bugs-2026-10-04c.md, "The audit").
// Every fixture from its producer: O0A0AL00 on the real QuestMachine, a real Collider, the enhanced pack mounted.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickActivatableHit } from '../../src/player/activate.js';
import { questStandItem, questResourceName } from '../../src/systems/worldTooltips.js';
import { ROOT, examination, noteCame, overPile, bedRoom, unit } from '../robesHarness.mjs';

const src = (f) => readFileSync(join(ROOT, f), 'utf8');

// ── P1: a castle's shelf is its Hall of Records, not a search ──────────────────────────────────────────────────────

test('AUDIT WHERE-ROBES P1: a castle\'s shelf is its Hall of Records while the seats are open - the search stands down for it (the two had raced as equal boxes; struck at its mesh, the search took or lost the press ray by ray) and stands again when the Hall does not claim it (mutants: the search offered over the Hall; the shelf not marked; the host\'s word not passed)', () => {
  const dc = src('src/scenes/dungeonContext.js'), wm = src('src/scenes/worldModes.js');
  // the searchable knows it is the castle shelf by the very test castleShelves is minted by
  const castle = /if \(b\.layout\.castleBlock && isShopShelfModel\(p\.modelIdNum\)\) castleShelves\.push\(\{ aabb \}\);/;
  assert.match(dc, castle, 'the Hall\'s shelves');
  assert.match(dc, /searchables\.push\(\{ kind: sk, aabb, key: `\$\{bi\}:\$\{p\.position\}`, lock: 0, items: \[\], records: !!\(b\.layout\.castleBlock && isShopShelfModel\(p\.modelIdNum\)\) \}\)/, 'and the searchable carries the same test');
  assert.match(dc, /const recordsHere = !!opts\.castleRecordsHere\?\.\(\);\n\s*searchables\.forEach\(\(sb, i\) => \{ if \(!\(sb\.records && recordsHere\)\) targets\.push\(\{ key: `search:\$\{i\}`/, 'offered unless the Hall claims it');
  assert.match(wm, /castleRecordsHere: \(\) => castleRecordsHere\(\),/, 'the host says when it does - the one predicate its `records:` targets read');
  assert.match(wm, /ctx\.addActivationTargets\(\(\) => \(castleRecordsHere\(\) \? ctx\.castleShelves\.map\(/, '...which is that predicate');
});

// ── P3: a decor piece is struck at its own surface ────────────────────────────────────────────────────────────────

test('AUDIT WHERE-ROBES P3: an owner\'s decor piece (its own collider bucket) is struck where the ray meets ITS surface - a candle on a decor dresser under its mirror wins the press, the dresser\'s front is still the dresser, and a piece with no bucket of its own is met at its box as before (mutant: the own-surface arm dropped)', async () => {
  const { box, add, c } = await bedRoom();
  // a decor dresser at x 8..9: its top at 1.0, a mirror up to 2.0 at its back (x 8.9..9) - its own bucket
  add('decor:1', box(8, 0, -0.5, 9, 1.0, 0.5));
  add('decor:1', box(8.9, 1.0, -0.5, 9, 2.0, 0.5));
  const dresser = { key: 'decor:1', aabb: { min: [8, 0, -0.5], max: [9, 2.0, 0.5] }, distance: 76.8, reach: 3.2, meshCollider: true };
  const candle = { key: 'decor:2', aabb: { min: [8.4, 1.0, -0.1], max: [8.6, 1.3, 0.1] }, distance: 76.8, reach: 3.2, noSurface: true };
  const eye = [7, 1.6, 0];
  const toCandle = unit([1.5, -0.45, 0]);
  for (const list of [[dresser, candle], [candle, dresser]]) assert.equal(pickActivatableHit(eye, toCandle, list, c)?.key, 'decor:2', 'the candle, in front of the mirror the ray meets after it');
  assert.equal(pickActivatableHit(eye, unit([1, -0.9, 0]), [dresser, candle], c)?.key, 'decor:1', 'the dresser\'s own front is the dresser');
  // no bucket of its own (a model with no geometry to collide): the box decides, as it did
  const bare = { ...dresser, key: 'decor:3', aabb: { min: [8, 0, 2], max: [9, 2, 3] } };
  const cup = { key: 'decor:4', aabb: { min: [8.4, 1.0, 2.4], max: [8.6, 1.3, 2.6] }, distance: 76.8, reach: 3.2, noSurface: true };
  assert.equal(pickActivatableHit([7, 1.6, 2.5], unit([1.5, -0.45, 0]), [bare, cup], c)?.key, 'decor:3', 'met at its box');
});

// ── the surface law's reach and skin ──────────────────────────────────────────────────────────────────────────────

test('AUDIT WHERE-ROBES: a surface target past its reach still WINS the ray and comes back out of reach, so the host says "You are too far away" (MC-2) rather than falling through - and a hit a hair outside the box (the 0.15 skin) is still its own (mutants: the cast cut at the reach; the skin taken away)', async () => {
  const { c, bed, box, add } = await bedRoom();
  // five metres back from the mattress: the bed's surface is the first the ray meets, past the bed's 3.2
  const far = pickActivatableHit([-3, 0.8, 0], unit([5, -0.5, 0]), [bed], c);
  assert.equal(far?.key, 'bed:0', 'the bed answers the ray');
  assert.ok(far.distance > far.reach, `out of reach (${far?.distance?.toFixed(2)} > ${far?.reach}) - the refusal's to speak`);
  // a chest whose mesh stands 0.1 proud of the box the host minted for it (worldAabb over float32 vertices, a turned
  // model's rounding): the ray meets its front at x 10, the box begins at 10.1
  add('interior', box(10, 0, -0.5, 11, 0.8, 0.5));
  const chest = { key: 'container:0', aabb: { min: [10.1, 0, -0.5], max: [11, 0.8, 0.5] }, distance: 76.8, reach: 3.2, surface: true };
  assert.equal(pickActivatableHit([8.5, 0.6, 0], unit([1, -0.1, 0]), [chest], c)?.key, 'container:0', 'its own surface, inside the skin');
});

// ── N1: a quest letter standing in the world is named as a letter ──────────────────────────────────────────────────

test('AUDIT WHERE-ROBES N1: a quest LETTER standing in the world reads "Letter: <signoff>" as the mod\'s ResolveItemLongName does (ItemHelper.cs:335-347) - the plaque hands the resolver the quest; without it the plain "Parchment" stands (mutant: the namer\'s resolver dropped)', () => {
  const e = examination();
  const note = e.q.getItem({ name: 'note' });   // `Item _note_ letter used 1019`
  const named = questResourceName(questStandItem(note), { archive: 204, record: 0, getQuest: e.getQuest });
  assert.match(named, /^Letter: /, `named "${named}"`);
  assert.equal(questResourceName(questStandItem(note), { archive: 204, record: 0 }), 'Parchment', 'no resolver, no quest to read');
  const wm = src('src/scenes/worldModes.js');
  assert.equal((wm.match(/questResourceName\(questStandItem\(res\), \{ archive: st\.archive \?\? -1, record: st\.record \?\? -1, getQuest: \(uid\) => questBridge\?\.machine\.getQuest\(uid\) \?\? null \}\)/g) ?? []).length, 2, 'both namers hand it the host\'s resolver');
});

// ── S1 and the share's pins ───────────────────────────────────────────────────────────────────────────────────────

/** A shared examination and a partner's envelope from before anything was touched. */
function shared() {
  const e = examination();
  e.m.markQuestShared('O0A0AL00');
  return { e, partner: () => JSON.parse(JSON.stringify(e.q.getSaveData())) };
}

test('AUDIT WHERE-ROBES S1: a resync keeps THIS world\'s click on a quest Person and a Foe too - O0A0AL00\'s hand-in is `_thiefmember_ clicked` - and a Person the partner\'s copy has muted refuses it, as SetPlayerClicked does (mutants: only an Item\'s click kept; the click set past the muted guard)', () => {
  const { e, partner } = shared();
  const env = partner();
  e.q.getPerson({ name: 'thiefmember' }).setPlayerClicked();
  e.q.getFoe({ name: 'F.00' }).setPlayerClicked();
  e.m.updateSharedQuest('O0A0AL00', env);
  assert.equal(e.q.getPerson({ name: 'thiefmember' }).hasPlayerClicked, true, 'the guild man\'s click stands');
  assert.equal(e.q.getFoe({ name: 'F.00' }).hasPlayerClicked, true, 'and the Mage\'s');
  // the partner's copy muted him meanwhile: the kept click is refused, not forced
  const s2 = shared();
  const env2 = s2.partner();
  const person = env2.resources.find((r) => r.symbol?.name === 'thiefmember' || r.symbol?.original === '_thiefmember_');
  assert.ok(person, 'the envelope carries him');
  person.resourceSpecific.isMuted = true;
  s2.e.q.getPerson({ name: 'thiefmember' }).setPlayerClicked();
  s2.e.m.updateSharedQuest('O0A0AL00', env2);
  assert.equal(s2.e.q.getPerson({ name: 'thiefmember' }).isMuted, true, 'muted, as the partner\'s copy says');
  assert.equal(s2.e.q.getPerson({ name: 'thiefmember' }).hasPlayerClicked, false, 'and a muted man takes no click');
});

test('AUDIT WHERE-ROBES: a partner\'s envelope from before the pickup, landing AFTER its tick (the click spent, the note in hand), leaves the robes picked up - the stand does not stand again over robes in the pack, and no second note comes (mutant: only a clicked Item kept)', async () => {
  const { QuestResourceBehaviour } = await import('../../src/systems/quest/resourceBehaviour.js');
  const { e, partner } = shared();
  const env = partner();
  const stand = new QuestResourceBehaviour(e.m);
  stand.assignResource(e.q.getItem({ name: 'clothing' }));
  stand.start();
  stand.doClick();
  e.step();
  assert.equal(noteCame(e), true, 'the note, on its tick');
  assert.equal(e.q.getItem({ name: 'clothing' }).hasPlayerClicked, false, 'the click spent by PostTick');
  e.m.updateSharedQuest('O0A0AL00', env);
  e.step(3);
  assert.equal(e.q.getItem({ name: 'clothing' }).isHidden, true, 'still picked up');
  assert.equal(e.given.filter((g) => g === e.note).length, 1, 'one note');
});

// ── the menu's click: its side and its place ──────────────────────────────────────────────────────────────────────

test('AUDIT WHERE-ROBES: the enhanced menu sends the quest click for a LOOT row the moment it opens - a menu closed unused has clicked, as a look counts - and never for a row of the player\'s own pack (LocalItemListScroller_OnItemClick sends none) (mutants: the click moved into the take; the side gate dropped)', async () => {
  const { hidePlusFloaters } = await import('../../src/ui/enhanced/enhancedInventory.js');
  const e = examination();
  const letter = e.q.getItem({ name: 'letter' });
  overPile(e, [e.robes], ({ host, rowOf }) => {
    // the player's own quest letter, on whichever page of the pack it files under (the pages are the pack's tabs)
    let mine = rowOf(letter.daggerfallUnityItem, 'pack');
    for (const tab of host.querySelectorAll('.packtab')) { if (mine) break; tab.onclick(); mine = rowOf(letter.daggerfallUnityItem, 'pack'); }
    // its menu clicks nothing
    assert.ok(mine, 'the letter in the pack');
    mine.oncontextmenu({ preventDefault() {}, clientX: 10, clientY: 10 });
    assert.equal(letter.hasPlayerClicked, false, 'my own pack is no loot row');
    hidePlusFloaters();
    // the robes on the pile: the menu opened and closed, nothing chosen - clicked
    rowOf(e.robes, 'loot').oncontextmenu({ preventDefault() {}, clientX: 10, clientY: 10 });
    hidePlusFloaters();
    assert.equal(e.q.getItem({ name: 'clothing' }).hasPlayerClicked, true, 'looked at, so clicked');
  }, { own: [letter.daggerfallUnityItem], storage: true });
  e.step();
  assert.equal(noteCame(e), true, 'and `_S.03_` heard the look, as DFU\'s does');
});
