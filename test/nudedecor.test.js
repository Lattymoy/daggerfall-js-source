// NUDE-DECOR and NUDE-HOSTS (2026-10-05, the owner: "Even with nudity turned off. Players can see and have access to
// nude vendors"). HOME-VENDOR (2026-10-03) made every person Daggerfall stands in a room a catalogue piece - Vendors -
// a week after NUDE-FLATS (2026-09-27) put Show Nudity over the world's people, and no seam of the decorator asked
// NUDE-FLATS' table: the catalogue OFFERED the nude figures, and one placed stood in the room, flew as the ghost and
// showed in the panel as itself. The Arena's tiers (ARENA2) seat two of the table's figures, unasked too. NUDE-FLATS
// pinned the five hosts of its day by source; the two made after it never learned the rule.
//
// Pinned here, each through its real producer: the offer (systems/decorCatalogue.js decorRoomEntries over the real
// catalogue), the room (scenes/decorRoom.js), the decorator's ghost and pictures (scenes/decorTool.js over the real
// panel), the crowd (scenes/arenaBouts.js buildCrowd over a fake stage) - and THE SWEEP: every file of src/ that batches a
// billboard is named below, a person host asks drawnFlat and any other says why it draws no person, so the next host
// fails here the day it lands instead of on a stream.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { NUDE_FLAT_STAND_INS, isNudeFlat } from '../src/characters/nudeFlats.js';
import { collectDecor, decorCatalogue, decorRoomEntries } from '../src/systems/decorCatalogue.js';
import { createDecorRoom } from '../src/scenes/decorRoom.js';
import { billboardSize } from '../src/world/rmbFlats.js';
import { setValue, resetToDefaults } from '../src/systems/settings.js';
import { createArenaBouts } from '../src/scenes/arenaBouts.js';
import { CROWD_PEOPLE } from '../src/systems/arenaCrowd.js';
import { newArenaLadder, nextLadderBout } from '../src/systems/arenaLadder.js';
import * as LG from '../src/systems/arenaLeague.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { settle, near, rmb, toolRig, placeFrom, all, one, rows } from './decorFakes.mjs';

const ROOT = new URL('../', import.meta.url);
const src = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const keys = (list) => list.map((e) => e.key).sort();
/** Show Nudity for the length of `body` - the setting ships False and goes back to it after. */
async function withNudity(on, body) {
  try {
    resetToDefaults();
    if (on) setValue('ChildGuard', 'PlayerNudity', true);
    return await body();
  } finally { resetToDefaults(); }
}
const unscaled = () => ({ width: 0, height: 0 });
/** A billboard's size for a record of `width` x `height`, as the room and the ghost size it (rmbFlats.js billboardSize). */
const sized = (width, height) => billboardSize({ getSize: () => ({ width, height }), getScale: unscaled }, 0);

test('NUDE-DECOR the offer: every person Daggerfall stands in a room is a Vendor; while Show Nudity is off no nude figure is offered - their stand-ins are, as themselves - and while it is on every one; the setting read unless told, in every room (mutants: NUDEDECOR-offer-ungated, NUDEDECOR-offer-setting-unread)', async () => {
  for (const k of Object.keys(NUDE_FLAT_STAND_INS)) assert.equal(isNudeFlat(...k.split('_').map(Number)), true, k);
  assert.deepEqual([isNudeFlat(184, 29), isNudeFlat(184, 8), isNudeFlat(210, 3)], [false, false, false], 'a stand-in, a dressed "?" figure, a candle');
  const cat = decorCatalogue(collectDecor([rmb([41000], [[209, 0]], [], [[184, 11], [184, 29], [182, 48], [182, 26], [175, 0]])]));
  assert.deepEqual(keys(cat.filter((e) => e.kind === 'people')), ['f175.0', 'f182.26', 'f182.48', 'f184.11', 'f184.29']);
  const nude = ['f175.0', 'f182.48', 'f184.11'];
  for (const room of [{ kind: 'house' }, { kind: 'ship' }, { kind: 'home' }, { kind: 'home', yard: true }, { kind: 'home', hall: true }]) {
    assert.deepEqual(keys(decorRoomEntries(cat, room, false)), keys(cat.filter((e) => !nude.includes(e.key))), `${JSON.stringify(room)}: off`);
    assert.deepEqual(keys(decorRoomEntries(cat, room, true)), keys(cat), `${JSON.stringify(room)}: on`);
  }
  await withNudity(false, () => assert.ok(!decorRoomEntries(cat, { kind: 'house' }).some((e) => nude.includes(e.key)), 'the setting read: it ships off'));
  await withNudity(true, () => assert.deepEqual(keys(decorRoomEntries(cat, { kind: 'house' })), keys(cat), 'turned on: offered'));
});

/** A room over a fake renderer whose records are sized apart - 184.11 20 x 40, its stand-in 184.29 30 x 70. */
function roomRig() {
  const made = [];
  const size = { '184_11': [20, 40], '184_29': [30, 70] };
  const room = createDecorRoom({
    meshes: null, collider: () => null, origin: () => [10, 0, 10],
    renderer: { createBillboardBatch: (a, r, s, centers) => { const b = { a, r, size: s, centers }; made.push(b); return b; }, destroyBillboardBatch() {} },
    getTexture: async (a) => ({ recordCount: 64, getSize: (r) => { const [width, height] = size[`${a}_${r}`] ?? [16, 32]; return { width, height }; }, getScale: unscaled, getFrameCount: () => 1 }),
    uploadRecord() {},
  });
  return { room, made };
}
const figure = (id) => ({ id, model: null, flat: [184, 11], pos: [1, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 40, station: 'vendor' });

test('NUDE-DECOR the room: a placed figure stands as its clothed stand-in while Show Nudity is off - the stand-in\'s picture at its own size on the piece\'s own base, the eye\'s box the picture\'s, the piece still the figure it was placed as - and as itself when on (mutant: NUDEDECOR-room-born)', async () => {
  await withNudity(false, async () => {
    const { room, made } = roomRig();
    room.put(figure('v1'));
    await settle(); await settle();
    assert.equal(made.length, 1);
    assert.deepEqual([made[0].a, made[0].r], [184, 29], 'the stand-in');
    const want = sized(30, 70);
    assert.deepEqual(made[0].size, want, 'at its own size');
    assert.deepEqual(made[0].centers, [[11, 0, 12]], 'on the piece\'s base');
    const [t] = room.targets();
    assert.ok(near(t.aabb.max[1] - t.aabb.min[1], want.h) && near(t.aabb.max[0] - t.aabb.min[0], want.w), 'the eye\'s box is the picture drawn');
    assert.deepEqual(room.pieceOf('v1').flat, [184, 11], 'the piece is the figure it was placed as - a trader still');
  });
  await withNudity(true, async () => {
    const { room, made } = roomRig();
    room.put(figure('v1'));
    await settle(); await settle();
    assert.deepEqual([made[0].a, made[0].r, made[0].size], [184, 11, sized(20, 40)], 'on: the figure as Daggerfall drew it');
  });
});

const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');
const btn = (root, label) => all(root, 'dfdecor-btn').find((b) => b.textContent === label);
const tab = (root, re) => all(one(root, 'dfdecor-tabs'), 'dfdecor-chip').find((c) => re.test(c.textContent));
const rowPicture = (root, key) => all(rows(root).find((r) => r.dataset.key === key) ?? { children: [] }, 'dfdecor-thumb')[0]?.children[0]?.getAttribute('src') ?? null;

test('NUDE-DECOR the decorator: a figure placed while Show Nudity was on shows in "In this room" as itself; turned off, the open panel asks the stand-in\'s picture anew, the catalogue offers it no more, and moved it flies as the stand-in it stands as (mutants: NUDEDECOR-thumb-born, NUDEDECOR-thumb-key-entry, NUDEDECOR-panel-key-unread, NUDEDECOR-ghost-born)', async () => {
  try {
    resetToDefaults();
    setValue('ChildGuard', 'PlayerNudity', true);
    const asked = [];
    const rig = toolRig({
      gold: 5000, extraPeople: [[184, 11], [184, 29]],
      iconUrl: async (a, r) => { asked.push(`${a}.${r}`); return `url:${a}.${r}`; },
      recordSize: (a, r) => (a === 184 && r === 29 ? { width: 30, height: 70 } : { width: 16, height: 32 }),
    });
    await placeFrom(rig, 'f184.11');
    rig.frame();
    assert.equal(await rig.tool.commit(), true, 'placed while it is on, as an owner whose setting is on places it');
    rig.tool.back();
    const id = rig.standing.at(-1).id;
    assert.deepEqual(rig.standing.at(-1).flat, [184, 11]);
    const root = panelOf(rig);
    tab(root, /^In this room/).fire('click');
    await settle();
    assert.equal(rowPicture(root, id), 'url:184.11', 'on: its own picture');
    // the setting turned off while the panel stands: the next frame's view offers it no more, and the list is drawn anew
    setValue('ChildGuard', 'PlayerNudity', false);
    rig.frame({ overlayUp: true });
    await settle();
    assert.equal(rowPicture(root, id), 'url:184.29', 'the stand-in\'s picture, asked anew - never the one kept from before');
    assert.ok(asked.includes('184.29'));
    tab(root, /^Catalogue/).fire('click');
    assert.equal(rows(root).some((r) => r.dataset.key === 'f184.11'), false, 'the catalogue offers the figure no more');
    assert.equal(rows(root).some((r) => r.dataset.key === 'f184.29'), true, 'its stand-in, as itself');
    // moved: the ghost is what the room stands it as
    tab(root, /^In this room/).fire('click');
    rows(root).find((r) => r.dataset.key === id).fire('click');
    btn(root, 'Move').fire('click');
    rig.frame(); await settle(); rig.frame();
    const [ghost] = rig.tool.batches();
    assert.deepEqual([ghost?.archive, ghost?.record, ghost?.size], [184, 29, sized(30, 70)], 'the ghost: the stand-in at its own size');
  } finally { resetToDefaults(); }
});

const arenaAt = (day, hour = 12) => (405 * 360 + day) * MINUTES_PER_DAY + hour * 60;
/** The bout's crowd as the driver batches it (scenes/arenaBouts.js buildCrowd), over a stage whose tiers stand 8 m up. */
async function crowdPictures() {
  const made = [];
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: LG.newArenaLeague() };
  const stage = {
    kind: 'floor', centre: () => [0, 0, 0], heightAt: () => 8, remove: () => {},
    spawn: async (mobile, feet, o) => ({ mobile, o, entity: { health: 40, maxHealth: 40, bout: o.bout, items: [] }, ai: { feet: [...feet], target: null } }),
  };
  const renderer = { createBillboardBatch: (archive, record) => { const b = { archive, record }; made.push(b); return b; }, destroyBillboardBatch: () => {} };
  const getTexture = async () => ({ getSize: () => ({ width: 40, height: 70 }), getScale: unscaled, getFrameCount: () => 1 });
  const A = createArenaBouts({ now: () => 1000, rng: () => 0.99, playerEntity: P, gameMinutes: () => arenaAt(40), renderer, getTexture, drawHud: () => {}, pay: () => {}, heal: () => {} });
  A.setStage(stage);
  A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(P.arenaLadder) });
  for (let i = 0; i < 8; i++) await settle();
  return new Set(made.map((b) => `${b.archive}_${b.record}`));
}

test('NUDE-HOSTS the Arena: the tiers seat two of the table\'s figures - 182.48 among the entertainers, 184.6 among the commoners - which sit as their clothed stand-ins while Show Nudity is off and as themselves when on (mutant: NUDEHOSTS-arena-born)', async () => {
  const seated = Object.values(CROWD_PEOPLE).flat().map(([a, r]) => `${a}_${r}`).filter((k) => k in NUDE_FLAT_STAND_INS);
  assert.deepEqual(seated.sort(), ['182_48', '184_6'], 'the crowd\'s own table holds these two');
  const on = await withNudity(true, crowdPictures);
  assert.ok(seated.some((k) => on.has(k)), `on: the bout's crowd seats one of them (${[...on].join(' ')})`);
  const off = await withNudity(false, crowdPictures);
  for (const k of seated) assert.equal(off.has(k), false, `off: ${k} never drawn`);
  for (const k of seated) if (on.has(k)) assert.ok(off.has(NUDE_FLAT_STAND_INS[k].join('_')), `off: ${k} sits as ${NUDE_FLAT_STAND_INS[k].join('_')}`);
});

/** Every .js under src/. */
function walk(dir, out = []) {
  for (const e of readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
    if (e.isDirectory()) walk(`${dir}${e.name}/`, out);
    else if (e.name.endsWith('.js')) out.push(`${dir}${e.name}`);
  }
  return out;
}
/** THE HOSTS THAT DRAW PEOPLE: each asks drawnFlat for the picture it draws. */
const PERSON_HOSTS = Object.freeze([
  'src/scenes/arenaBouts.js',       // the tiers' seated crowd (NUDE-HOSTS)
  'src/scenes/decorRoom.js',        // a room's or a yard's placed pieces - Vendors among them (NUDE-DECOR)
  'src/scenes/decorTool.js',        // the decorator's ghost and its pictures (NUDE-DECOR)
  'src/scenes/dungeonContext.js',   // NUDE-FLATS: an RDB figure
  'src/scenes/exterior.js',         // NUDE-FLATS: the one-location host's flats and street people
  'src/scenes/interiorContext.js',  // NUDE-FLATS: a building's people
  'src/scenes/world.js',            // NUDE-FLATS: every flat a streamed pixel batches, its street people
  'src/scenes/worldModes.js',       // NUDE-FLATS: a quest's person
]);
/** EVERY OTHER HOST, and why it draws no person - a claim, so it says what it draws instead. */
const NO_PERSON = Object.freeze({
  'src/combat/bloodMarks.js': 'blood marks and gibs',
  'src/net/peerRiders.js': 'a peer\'s horse or cart under them',
  'src/net/remotePlayers.js': 'peers as their class\'s mobile sprites, their dolls and their corpses',
  'src/player/eotbBody.js': 'the player\'s own body as mobile sprites',
  'src/player/eotbLantern.js': 'the body\'s lantern',
  'src/render/renderer.js': 'the method itself',
  'src/scenes/camps.js': 'a camp\'s fire',
  'src/scenes/cityGuards.js': 'the watch as mobile units',
  'src/scenes/comeSailAwayPool.js': 'the vendored prefabs\' billboards - its people none of the table\'s (pinned below)',
  'src/scenes/corpseMarker.js': 'a foe\'s corpse',
  'src/scenes/droppedLoot.js': 'loot piles',
  'src/scenes/droppedTorches.js': 'torches',
  'src/scenes/exteriorFoes.js': 'foes as mobile units',
  'src/scenes/gateCourt.js': 'the gate boss as a mobile unit, and his corpse',
  'src/scenes/gateHost.js': 'the boss\'s host as mobile units',
  'src/scenes/gatherHost.js': 'gathering nodes',
  'src/scenes/hitEffects.js': 'hit splashes',
  'src/scenes/horseCartPool.js': 'the cart\'s horse',
  'src/scenes/hostMagic.js': 'spell missiles',
  'src/scenes/magicCandle.js': 'the Light effect\'s candle',
  'src/scenes/navalCrew.js': 'crews as mobile units',
  'src/scenes/navalFlames.js': 'a ship\'s flames',
  'src/scenes/portalFx.js': 'a portal',
  'src/scenes/riteHost.js': 'a rite\'s fire',
  'src/scenes/siegeNpcs.js': 'a siege\'s fighters as mobile units',
  'src/scenes/sigilBrokerPool.js': 'the Sigil broker as a mobile unit',
  'src/scenes/spoilsPool.js': 'a boss\'s spoils',
  'src/scenes/treeHost.js': 'felled trees',
  'src/scenes/yardNature.js': 'a yard\'s trees and plants',
  'src/ui/automapWindow.js': 'the automap\'s markers',
});

test('NUDE-HOSTS by source: every file of src/ that batches a billboard is named - a person host asks drawnFlat, any other says what it draws instead; Come Sail Away\'s prefabs stand none of the table\'s figures (a new host fails here the day it lands)', () => {
  const hosts = walk('src/').filter((f) => /createBillboardBatch\(/.test(src(f))).sort();
  const named = [...PERSON_HOSTS, ...Object.keys(NO_PERSON)].sort();
  assert.deepEqual(hosts.filter((f) => !named.includes(f)), [], 'a new billboard host: name it here - does it draw a person?');
  assert.deepEqual(named.filter((f) => !hosts.includes(f)), [], 'a named host batches no billboard any more: take it off');
  for (const f of PERSON_HOSTS) {
    assert.match(src(f), /from '\.\.\/characters\/nudeFlats\.js'/, `${f} imports the table's door`);
    assert.match(src(f).replace(/^\s*\/\/.*$/gm, ''), /\bdrawnFlat\(/, `${f} draws people: it asks drawnFlat`);
  }
  // Come Sail Away draws its prefabs' people (systems/comeSailAwayBoat.js setupBillboardHelper: `BillboardHelper-AAA_RRR`)
  // exactly as the mod lays them - held here to the table, so a figure of it arriving in the vendored data is caught
  const helpers = [...src('vendor/come-sail-away/Models/prefabs.json').matchAll(/BillboardHelper-(\d{3})_(\d{3})/g)].map((m) => `${Number(m[1])}_${Number(m[2])}`);
  assert.ok(helpers.filter((k) => k.startsWith('182_')).length >= 20, `the prefabs' people are read (${helpers.length} helpers)`);
  assert.deepEqual(helpers.filter((k) => k in NUDE_FLAT_STAND_INS), [], 'none of the table\'s figures');
});
