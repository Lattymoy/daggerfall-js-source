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
import { personLook, wardrobeOf } from '../src/characters/peopleBodies.js';
import { SOCIAL_GROUPS, GUILD_GROUPS, FACTION_TYPES } from '../src/formats/factionFile.js';
import { RACES } from '../src/systems/races.js';
import { GENDERS } from '../src/characters/nameHelper.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
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
  ordered(d, ['drawPeople(canvas, proj, view, eye, dt) {', 'const read = opts.standingLook ?? null;', 'const on = !!read && _peopleLane.frame();',
    'const look = on && pn.active !== false ? read(pn) : null;', 'if (look) _peopleLane.offer(personActor(pn, look, pn._mwFeet ??= [pn.x, pn.y, pn.z], eye, dt), pn.standBatch);',
    'else pn.standBatch.castOnly = false;', '_peopleLane.draw(canvas, proj, view, eye, dt);'], 'drawPeople');
  assert.ok(d.includes('_peopleLane.destroy();   // MWNPC8b'), 'gone with the context');
  const m = rd('src/scenes/worldModes.js');
  assert.ok(m.includes('          standingLook,   // MWNPC8b'), 'the world\'s dungeon reads its people as its buildings do');
  ordered(m, ['dungeonCtx.drawPeople?.(canvas, proj, view, mwv.eye, dt);', 'renderer.drawBillboards([...dungeonCtx.billboardBatches,'], 'before the level\'s billboards');
});

test('MWNPC8b-b the street: one batch a person in standPixelNpcs (the away arm and the quest pass still first); the near rings\' people offered as the pixels are walked, at their scene feet; the bodies drawn before the flats; let go indoors, moved with the origin', () => {
  const w = rd('src/scenes/world.js');
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
    'src/scenes/world.js': 'wired',            // the street's people (8b)
    'src/scenes/interiorContext.js': 'wired',  // the buildings' (8a), through worldModes.js
    'src/scenes/dungeonContext.js': 'wired',   // the dungeons' (8b), through worldModes.js
    'src/scenes/exterior.js': 'MWNPC8c',       // the standalone location: its people still batch with its scenery
  };
  const found = readdirSync(new URL('../src/scenes', import.meta.url)).filter((f) => f.endsWith('.js'))
    .map((f) => `src/scenes/${f}`).filter((p) => /collectExteriorNpcs\(|collectInteriorPeople\(|context: NPC_CONTEXT\.Dungeon/.test(rd(p)));
  assert.deepEqual(found.sort(), Object.keys(HOSTS).sort(), 'a new standing-people host is named here');
  const wiredBy = {
    'src/scenes/world.js': () => rd('src/scenes/world.js').includes('streetPeople.offer(personActor('),
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
  assert.equal(wardrobeOf(fac({ type: FACTION_TYPES.WitchesCoven })), 'common', 'a coven\'s witch is mortal');
});
