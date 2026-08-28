// NT3 - the final AUDIT 26 NIT sweep: the beast-design label anchors
// (F004/F007), the paperdoll record law's one home (F006), the
// classic-font caps (F082 - pinned where the controls tests live,
// controlswindow.test.js), the wagon's two access arms (F161), the
// choose-one Remove bar (F162), and the bench gesture (F135).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BEAST_DESIGNS } from '../src/characters/beasts.js';
import { UNDEAD_DESIGNS } from '../src/characters/undeadBody.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { inventoryItemImage, templateByIndex } from '../src/systems/itemTemplates.js';
import { resolvePaperdollRecord } from '../src/characters/paperdollArt.js';
import { openState } from '../src/systems/inventorySession.js';
import { planStore } from '../src/systems/itemTransfer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

// ---------------------------------------------------------------
// 1. F004/F007 - the label anchors, ALL of them
// ---------------------------------------------------------------

test('NT3 (F004/F007): every design row with an id anchors its level and damage to ENEMY_BASICS', () => {
  // "anchored to ENEMY_BASICS, not invented" is the tables' own stated
  // law - the sweep holds EVERY row to it, so the five the audit
  // caught (bear, tiger, spider, scorpion, wraith) can never drift
  // back and no sixth can join them. The sweep also caught the
  // audit's own Spider anchor being off by one (id 6 is Level 4).
  let checked = 0;
  for (const d of [...BEAST_DESIGNS, ...UNDEAD_DESIGNS]) {
    const basics = ENEMY_BASICS[d.id];
    if (!basics || d.level == null || !d.damage) continue;
    checked++;
    assert.equal(d.level, basics.level, `${d.name} level`);
    assert.deepEqual(d.damage, [basics.minDamage, basics.maxDamage], `${d.name} damage`);
  }
  assert.ok(checked >= 10, `the sweep actually swept (${checked} rows)`);
});

// ---------------------------------------------------------------
// 2. F006 - one home for GetInventoryTextureRecord's variant law
// ---------------------------------------------------------------

test('NT3 (F006): the inventory image rides resolvePaperdollRecord - the second copy is gone', () => {
  // behavioral: a cloak's inventory record equals the ONE home's
  // answer (start + variant with the interior-first skip)
  const t = templateByIndex(154);
  const img = inventoryItemImage({ templateIndex: 154, group: 'MensClothing', variant: 2 });
  assert.equal(img.record, resolvePaperdollRecord(t, 2));
  assert.equal(img.record, t.playerTextureRecord + 1 + 2, 'the cloak skip rides through');
  const plain = templateByIndex(147) ?? t;   // any variant template without the cloak skip
  // and the source carries no private CLOAK_TEMPLATES twin any more
  const it = src('systems/itemTemplates.js');
  assert.equal(/const CLOAK_TEMPLATES = new Set/.test(it), false,
    'a correction to the home copy reaches the running path now');
  assert.ok(it.includes('record = resolvePaperdollRecord(t, v);'), 'the delegation is live');
  assert.ok(plain, 'template table intact');
});

// ---------------------------------------------------------------
// 3. F161 - the two wagon-access arms
// ---------------------------------------------------------------

test('NT3 (F161): mere proximity SHOWS the wagon but leaves the Equip default', () => {
  const cart = [{ group: 'Transportation', templateIndex: 93, name: 'Small Cart' }];
  const open = openState({
    items: () => cart,
    dungeon: { inside: true, nearExit: () => true },
  });
  assert.equal(open.allowDungeonWagonAccess, true);
  assert.equal(open.usingWagon, true, 'the wagon shows (ShowWagon, :1093-1094)');
  assert.equal(open.mode, 'equip',
    'but a plain F6 keeps OnPush\'s Equip default - only the exit-door PROMPT arm selects Remove (:1084-1088)');
});

test('NT3 (F161): a loot target still outranks the wagon show, in Remove as ever', () => {
  const cart = [{ group: 'Transportation', templateIndex: 93 }];
  const open = openState({
    items: () => cart, loot: { items: () => [] },
    dungeon: { inside: true, nearExit: () => true },
  });
  assert.equal(open.usingWagon, false, 'the corpse you opened is what you meant');
  assert.equal(open.mode, 'remove');
});

// ---------------------------------------------------------------
// 4. F162 - the choose-one bar has no wagon exemption
// ---------------------------------------------------------------

test('NT3 (F162): while a choose-one is up NOTHING leaves the pack - wagon or no wagon', () => {
  const item = { templateIndex: 102, group: 'Weapons', stackCount: 1 };
  const chooseOne = { items: [] };
  const bare = planStore(item, { chooseOne, usingWagon: false });
  assert.equal(bare.ok, false);
  assert.equal(bare.refusal.reason, 'chooseOnePile');
  const wagoned = planStore(item, { chooseOne, usingWagon: true });
  assert.equal(wagoned.ok, false,
    'DFU\'s arm is `remoteItems != null && !chooseOne` (:1994) - the wagon exemption was the port\'s own');
  // and with no choose-one the wagon path is open again
  assert.equal(planStore(item, { usingWagon: true }).ok, true);
});

// ---------------------------------------------------------------
// 5. F135 - the bench rides the game's gesture law (source pins;
//    the game's own machine is behaviorally pinned in its suite)
// ---------------------------------------------------------------

test('NT3 (F135): the paperdoll bench gates on the TRAVEL sum with a rolling trim', () => {
  const pv = src('tools/paperdollViewer.js');
  assert.ok(pv.includes('if (gest.travel / longest >= ATTACK_THRESHOLD) {'),
    'the gate is TravelDist / longestDim - the summed PATH, not the net displacement');
  assert.ok(pv.includes('gest.x -= p.dx; gest.y -= p.dy; gest.travel -= p.mag;'),
    'TrimOld subtracts expired points - a rolling window, not a hard reset');
  assert.equal(/Math\.hypot\(gest\.x, gest\.y\) \/ longest/.test(pv), false,
    'the collapsed net-displacement gate is gone');
  assert.ok(pv.includes('const ang = Math.atan2(-gest.y, gest.x)'),
    'the strike DIRECTION still reads the sum, as DFU\'s does');
});
