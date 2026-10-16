// MWNPC8b (2026-10-09, the MW-NPC arc's eighth slice - bible/04-Characters/Morrowind-NPCs.md section 13b): THE
// DUNGEON'S AND THE STREET'S STANDING PEOPLE IN THEIR BODIES. Both hosts batched their StaticNPC flats together (the
// dungeon with the level's flats, the street per sprite over a pixel's active NPCs), and one billboard in a shared
// batch cannot step aside for one body. Each person's flat now stands ALONE - its own batch - and each host offers its
// people (read as the building's are: their StaticNPC data, their faction's row) before its flats draw. Pinned by
// source, as the dungeon's foes are (a dungeon or a street needs the game's own files): the per-person batches, the
// offers and the draw before the flats, the look never before the faction table, the teardowns - and THE STANDING-PEOPLE
// HOSTS ENUMERATED: every scene that stands StaticNPC billboards named, wired or flagged with its slice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { ROW_CODECS } from '../../src/formats/worldData/worldDataPack.js';
import { blockFromJson } from '../../src/formats/worldData/worldDataReplacement.js';
import { collectBlockFlats } from '../../src/world/rmbFlats.js';
import { collectExteriorNpcs, exteriorNpcRecord } from '../../src/characters/exteriorNpcs.js';
import { staticNpcData } from '../../src/characters/staticNpc.js';
import { isNpcFlat } from '../../src/world/npcFlatArchives.js';
import { personLook, wardrobeOf } from '../../src/characters/peopleBodies.js';
import { SOCIAL_GROUPS, GUILD_GROUPS, FACTION_TYPES } from '../../src/formats/factionFile.js';
import { RACES } from '../../src/systems/races.js';
import { GENDERS } from '../../src/characters/nameHelper.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ordered = (s, needles, what) => {
  let at = -1;
  for (const n of needles) {
    const i = s.indexOf(n, at + 1);
    assert.ok(i > at, `${what}: "${n.slice(0, 70)}" ${i < 0 ? 'missing' : 'out of order'}`);
    at = i;
  }
};

test('MWNPC8b-a the dungeon: a person\'s flat out of the shared groups into a batch of its own; drawPeople offers the active people with a look before the host draws the level\'s billboards; the lane leaves with the context', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.ok(d.includes('        if (pn) pn._flatAt = at;\n        else { if (!flatGroups.has(key)) flatGroups.set(key, []); flatGroups.get(key).push(at); }'), 'a person is not grouped');
  ordered(d, ['for (const [key, centers] of flatGroups) {', "collider.cover.add('tact1:flats', coverItems);", 'for (const pn of people) {\n    const at = pn._flatAt;', 'const [archive, record] = drawnFlat(pn.textureArchive, pn.textureRecord);',
    'pn.standBatch = renderer.createBillboardBatch(archive, record, billboardSize(t, record), [Object.assign([at[0], at[1] - bornSize.h / 2, at[2]], { noCover: true })]);',
    'billboardBatches.push(pn.standBatch);'], 'the person\'s batch, base-centred off the born sprite, drawn as the clothed stand-in, after the groups and their cover (a person is none)');
  // PIN MOVED (MWNPC8c): drawPeople takes the host's `also` and the world's dungeon passes its quest stands - read by prefix
  ordered(d, ['drawPeople(canvas, proj, view, eye, dt', 'const read = opts.standingLook ?? null;', 'const on = !!read && _peopleLane.frame();',
    'const look = on && pn.active !== false ? read(pn) : null;', 'if (look) _peopleLane.offer(personActor(pn, look, pn._mwFeet ??= [pn.x, pn.y, pn.z], eye, dt), pn.standBatch);',
    'else pn.standBatch.castOnly = false;', '_peopleLane.draw(canvas, proj, view, eye, dt);'], 'drawPeople');
  assert.ok(d.includes('_peopleLane.destroy();   // MWNPC8b'), 'gone with the context');
  const m = rd('src/scenes/worldModes.js');
  assert.ok(m.includes('          standingLook,   // MWNPC8b'), 'the world\'s dungeon reads its people as its buildings do');
  ordered(m, ['dungeonCtx.drawPeople?.(canvas, proj, view, mwv.eye, dt', 'renderer.drawBillboards([...dungeonCtx.billboardBatches,'], 'before the level\'s billboards');
});

test('MWNPC8b-b the street: one batch a person in standPixelNpcs (the away arm and the quest pass still first); the near rings\' people offered as the pixels are walked, at their scene feet; the bodies drawn before the flats; let go indoors, moved with the origin', () => {
  const w = hostText('src/scenes/world.js');
  const from = w.indexOf('async function standPixelNpcs(');
  const stand = w.slice(from, w.indexOf('function restrideTerrain(', from));
  ordered(stand, ['setupExteriorQuestStaticNpcs', 'for (const pn of entry.npcs) {', 'pn.standBatch = null;', 'if (!pn.active) continue;', 'const centers = [[pn.x, pn.y, pn.z]];',
    'const batch = renderer.createBillboardBatch(archive, record, size, centers);', 'pn.standBatch = batch;', 'entry.batches.push(batch);'], 'a person\'s own batch');
  assert.ok(!stand.includes('npcGroups'), 'no shared group left');
  assert.ok(w.includes('if (!dict) return null;   // never before the faction table: asked again'));
  ordered(w, ['const _peopleOn = streetPeople.frame();', 'for (const p of _pixelOrder) {', 'const ring = Math.max(Math.abs(p.px - state.current.x)',
    'if (p.npcs) for (const pn of p.npcs) {', 'const look = _peopleOn && ring <= 1 ? streetLook(pn) : null;', 'if (!look) { pn.standBatch.castOnly = false; continue; }',
    'f[0] = pn.x + t[0]; f[1] = pn.y + t[1]; f[2] = pn.z + t[2];', 'streetPeople.offer(personActor(pn, look, f, mwv.eye, dt), pn.standBatch);',
    'streetPeople.draw(canvas, proj, view, mwv.eye, townTalk.overlayActive ? 0 : dt);', 'renderer.drawBillboards(allBatches, camRight, bbUp);'], 'offered in the walk, drawn before the flats');
  assert.ok(w.includes('streetPeople.destroy();   // MWNPC8b'), 'let go indoors');
  assert.ok(w.includes('streetPeople.offsetAll(r.offset);'), 'moved with the origin');
});

test('MWNPC8b-c THE STANDING-PEOPLE HOSTS, enumerated: every scene that stands StaticNPC billboards is named - wired, or flagged with the slice that wires it', () => {
  const HOSTS = {
    'src/scenes/pixelBuild.js': 'wired',       // the street's people (8b) - stood by the world's pixel build (HOST-SPLIT 2), offered by world.js
    'src/scenes/interiorContext.js': 'wired',  // the buildings' (8a), through worldModes.js
    'src/scenes/dungeonContext.js': 'wired',   // the dungeons' (8b), through worldModes.js
    // PIN MOVED (MWNPC8c, section 13c): the standalone location's people stand alone and in their bodies now
    'src/scenes/exterior.js': 'wired',         // the standalone location's (8c)
  };
  const found = readdirSync(new URL('../../src/scenes', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js'))
    .map((f) => `src/scenes/${f}`).filter((p) => /collectExteriorNpcs\(|collectInteriorPeople\(|context: NPC_CONTEXT\.Dungeon/.test(rd(p)));
  assert.deepEqual(found.sort(), Object.keys(HOSTS).sort(), 'a new standing-people host is named here');
  const wiredBy = {
    'src/scenes/pixelBuild.js': () => hostText('src/scenes/world.js').includes('streetPeople.offer(personActor('),
    'src/scenes/interiorContext.js': () => rd('src/scenes/worldModes.js').includes('peopleBodies.offer(personActor('),
    'src/scenes/dungeonContext.js': () => rd('src/scenes/dungeonContext.js').includes('_peopleLane.offer(personActor('),
    'src/scenes/exterior.js': () => /\.offer\(personActor\(/.test(rd('src/scenes/exterior.js')),
  };
  for (const [p, state] of Object.entries(HOSTS)) assert.equal(wiredBy[p](), state === 'wired', `${p}: ${state}`);
});

test('MWNPC8b-d a flat with a faction is not always a person drawn: an editor marker (archive 199, never rendered) stands no body, whatever its faction; nor does anyone not mortal - a Daedra, a god, Oblivion\'s or the Fey\'s', () => {
  const data = (o) => ({ race: RACES.Breton, gender: GENDERS.Male, nameSeed: 9, hash: 3, factionID: 0, billboardArchiveIndex: 182, billboardRecordIndex: 1, ...o });
  assert.ok(personLook({}, data({}), null), 'a person drawn: a body');
  assert.equal(personLook({}, data({ billboardArchiveIndex: 199, billboardRecordIndex: 11 }), null), null, 'a marker: none');
  const fac = (o) => ({ type: FACTION_TYPES.Generic, sgroup: SOCIAL_GROUPS.Commoners, ggroup: GUILD_GROUPS.None, ...o });
  for (const [o, what] of [[{ type: FACTION_TYPES.Daedra }, 'a Daedra'], [{ type: FACTION_TYPES.God }, 'a god'], [{ ggroup: GUILD_GROUPS.Oblivion }, 'Oblivion\'s'], [{ ggroup: GUILD_GROUPS.TheFey }, 'the Fey\'s']]) {
    assert.equal(wardrobeOf(fac({ sgroup: SOCIAL_GROUPS.Nobility, ...o })), 'none', `${what} keeps their sprite, whatever else`);
    assert.equal(personLook({}, data({}), fac(o)), null, what);
  }
  assert.equal(wardrobeOf(fac({ type: FACTION_TYPES.WitchesCoven })), 'mage', 'a coven\'s witch is mortal');   // PIN MOVED (MWNPC17, section 25): and in a mage's robes, not the street's
});

test('STALL-FLATS (FIELD BUGS 2026-10-15c, "every animal and food stand item turned into freaks"; "The NPC\'s are clustered into groups and all have their heads down"): Beautiful Villages\' TVRNAS02 market, read off the vendored pack the town mods serve - RMBLayout\'s StaticNPC rule kept (113, every factioned flat), and a body stands only for a person\'s picture (RDBLayout.NPCFlatArchives), never for the stall\'s food, goods and animals (101 before); a quest\'s person keeps theirs whatever FLATS.CFG pictures them with (mutants: the archive law dropped; the quest\'s word unread)', () => {
  const pack = JSON.parse(gunzipSync(readFileSync(new URL('../../vendor/beautiful-villages/WorldDataPack/beautiful-villages.pack.json.gz', import.meta.url))).toString());
  const op = JSON.parse(pack.files['TVRNAS02.RMB.json'])[2].find((o) => JSON.stringify(o[1]) === '["RmbBlock","MiscFlatObjectRecords"]');
  const block = blockFromJson({ Name: 'TVRNAS02.RMB', RmbBlock: { FldHeader: {}, SubRecords: [], Misc3dObjectRecords: [], MiscFlatObjectRecords: op[2].$f.map(ROW_CODECS.$f) } }, 0);
  const npcs = collectExteriorNpcs(collectBlockFlats(block, 0));
  assert.equal(npcs.length, 113, 'DFU\'s StaticNPC rule kept - the click and the quest pass read them all');
  assert.ok(npcs.filter((f) => !isNpcFlat(f.archive)).length >= 100, 'the market\'s factioned scenery stands in the list');
  const bodied = npcs.filter((f) => { const pn = exteriorNpcRecord(f, null); return personLook(pn, staticNpcData(pn, { getFaction: () => null, raceOfCurrentRegion: () => 1 }), null); });
  assert.deepEqual(bodied.filter((f) => !isNpcFlat(f.archive)).map((f) => f.archive), [], 'no food, goods or animal bodied');
  assert.equal(bodied.length, 11, 'the block\'s twelve people less its child');
  // a quest's person, pictured off a FLATS.CFG archive outside the people's
  const look = (questPerson) => personLook({}, { race: 1, gender: GENDERS.Male, nameSeed: 7, hash: 9, billboardArchiveIndex: 186, billboardRecordIndex: 0, questPerson }, null);
  assert.equal(look(undefined), null);
  assert.notEqual(look(true), null, 'the quest\'s word stands them');
});
