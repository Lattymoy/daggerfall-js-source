// MWNPC7 (2026-10-09, the MW-NPC arc's seventh slice - bible/04-Characters/Morrowind-NPCs.md section 12): THE STREET'S
// WALKERS IN MORROWIND BODIES. A walker carries what Daggerfall rolled at their spawn (systems/townPopulation.js
// RandomiseNPC): the climate's race, a gender, one of four outfits (the sprite archive), a face, a name - or the
// guard's arm. characters/folkBodies.js reads that roll for a body; characters/npcBodies.js createPopulationLane is the
// foe pools' lane shape for a host that walks its population inline; world.js's streets and exterior.js's location
// offer every walker and draw the bodies before the person billboards. Pinned: the look per roll (race, gender, the
// outfit per variant, the guard's plate, the dyes, the face), a re-roll a new person, the actor, the lane helper's
// whole cycle on a recording lane, and the population hosts by source - every host that walks a population named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { readFileSync, readdirSync } from 'node:fs';
import { folkLook, folkActor, folkVariant, FOLK_OUTFITS, FOLK_DYES } from '../src/characters/folkBodies.js';
import { createPopulationLane } from '../src/characters/npcBodies.js';
import { PERSON_TEXTURES, GUARD_TEXTURE } from '../src/characters/mobilePerson.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const walker = (archive, gender, extra = {}) => ({ archive, gender, guard: archive === GUARD_TEXTURE, personFaceRecordId: 3, nameNPC: 'Aldo Hent', state: 'move', dir: 2, get facingYaw() { return [0, Math.PI, Math.PI / 2, -Math.PI / 2][this.dir]; }, ...extra });

test('MWNPC7a a walker\'s look is their roll - the race and gender, the outfit their sprite is, dyed off their spawn, a face; the street\'s guard in the watch\'s steel', () => {
  for (const race of ['Breton', 'Redguard', 'Nord']) {
    for (const [g, gender] of [[GENDERS.Male, 'male'], [GENDERS.Female, 'female']]) {
      PERSON_TEXTURES[race][gender].forEach((archive, v) => {
        assert.equal(folkVariant(archive, race), v);
        const l = folkLook(walker(archive, g, { nameNPC: `${race}${gender}${v}` }), race);
        assert.equal(l.race, race);
        assert.equal(l.gender, gender);
        assert.ok(l.faceIndex >= 0 && l.faceIndex <= 9);
        const outfit = FOLK_OUTFITS[gender][v];
        assert.deepEqual(l.items.map((it) => it.templateIndex), outfit.filter((t) => t != null), `${race} ${gender} variant ${v}: its outfit`);
        assert.ok(l.items.every((it) => it.group === (gender === 'female' ? 'WomensClothing' : 'MensClothing') && FOLK_DYES.includes(it.dye)), 'dyed in the street\'s colours');
        assert.deepEqual(l.items.map((it) => it.equipSlot), outfit[1] == null ? [EQUIP_SLOTS.ChestClothes, EQUIP_SLOTS.Feet] : [EQUIP_SLOTS.ChestClothes, EQUIP_SLOTS.LegsClothes, EQUIP_SLOTS.Feet]);
      });
    }
  }
  const dyes = new Set();
  for (let i = 0; i < 40; i++) dyes.add(folkLook(walker(PERSON_TEXTURES.Breton.male[0], GENDERS.Male, { nameNPC: `n${i}` }), 'Breton').items[0].dye);
  assert.ok(dyes.size >= 5, `a street is not one colour (${[...dyes]})`);
  const guard = folkLook(walker(GUARD_TEXTURE, GENDERS.Male), 'Breton');
  assert.equal(guard.gender, 'male');
  const plate = guard.items.filter((it) => it.group === 'Armor');
  assert.deepEqual(plate.map((it) => it.templateIndex).sort((a, b) => a - b), [ARMOR_ENUM.Cuirass, ARMOR_ENUM.Gauntlets, ARMOR_ENUM.Greaves, ARMOR_ENUM.Left_Pauldron, ARMOR_ENUM.Right_Pauldron, ARMOR_ENUM.Helm, ARMOR_ENUM.Boots].sort((a, b) => a - b), 'the watch\'s whole plate');
  // PIN MOVED (MWNPC12, Morrowind-NPCs.md section 17): steel is ARMOR_MATERIAL.Steel - the 1 this pinned named no material
  assert.ok(plate.every((it) => it.material === ARMOR_MATERIAL.Steel), 'steel');
});

test('MWNPC7b a re-roll is a new person - a new id and a new look; the same roll the same object; the actor is the walker\'s stride, never armed, hit nor dead', () => {
  const w = walker(PERSON_TEXTURES.Nord.female[1], GENDERS.Female);
  const a1 = folkActor(w, [1, 2, 3], 'Nord');
  const id1 = a1.id, look1 = a1.look;
  assert.equal(folkActor(w, [1, 2, 3], 'Nord'), a1, 'one object a walker');
  assert.equal(a1.id, id1);
  assert.equal(a1.look, look1, 'the same roll, the same look - one build');
  assert.deepEqual(a1.feet, [1, 2, 3], 'their feet as the host places their billboard');
  assert.equal(a1.yaw, Math.PI / 2, 'their wheel\'s facing (dir 2: +x)');
  assert.equal(a1.moving, true);
  assert.deepEqual([a1.running, a1.drawn, a1.swings, a1.casts, a1.hits, a1.dead], [false, false, 0, 0, 0, 0]);
  w.state = 'idle';
  assert.equal(folkActor(w, [1, 2, 3], 'Nord').moving, false);
  w.yaw = 0.25;
  assert.equal(folkActor(w, [1, 2, 3], 'Nord').yaw, 0.25, 'a resident\'s own yaw where it keeps one');
  // the pool's shell spawns again as someone else
  w.archive = PERSON_TEXTURES.Nord.male[3]; w.gender = GENDERS.Male; w.nameNPC = 'Brand Ulf';
  const a2 = folkActor(w, [1, 2, 3], 'Nord');
  assert.notEqual(a2.id, id1, 'a new person: a new id - a body built for them, not the last one re-dressed');
  assert.notEqual(a2.look, look1);
  assert.equal(a2.look.gender, 'male');
  assert.notEqual(folkActor(walker(PERSON_TEXTURES.Nord.female[1], GENDERS.Female), [0, 0, 0], 'Nord').id, a2.id, 'another walker, another id');
});

function recordingLane() {
  const L = { calls: [], offered: [], standing: new Set(), destroyed: 0, offsets: [] };
  Object.assign(L, {
    begin() { L.offered.length = 0; L.calls.push('begin'); },
    stand(lane, actor, conceal, flash, fx) { L.offered.push({ lane, id: actor.id, conceal, flash, fx }); },
    end(dt, eye) { L.calls.push(['end', dt, eye]); },
    has(lane, id) { return L.standing.has(`${lane}:${id}`); },
    draw(_c, o) { L.calls.push(['draw', o.eye]); },
    drawVeiled() { L.calls.push('veiled'); },
    destroy() { L.destroyed++; },
    offsetAll(o) { L.offsets.push(o); },
  });
  return L;
}

test('MWNPC7c the population lane: made when wanted, each actor offered with its billboard (reset to drawn), synced and marked before the draw, nothing synced twice, let go when unwanted', () => {
  let want = true, lane = null, made = 0;
  const flushes = [];
  const pl = createPopulationLane({ laneName: 'folk', renderer: { beginCharacterSpriteBatch: () => flushes.push('open'), flushCharacterSpriteBatch: () => flushes.push('flush') }, want: () => want, make: () => { made++; return (lane = recordingLane()); } });
  assert.equal(pl.frame(), true);
  const b1 = { castOnly: true }, b2 = {};
  pl.offer({ id: 'a' }, b1, null, 0.4, { glint: null });
  pl.offer({ id: 'b' }, b2);
  assert.equal(b1.castOnly, false, 'reset at the offer');
  assert.deepEqual(lane.offered.map((o) => [o.lane, o.id, o.flash]), [['folk', 'a', 0.4], ['folk', 'b', 0]]);
  lane.standing.add('folk:a');
  pl.draw({}, 'P', 'V', [1, 2, 3], 0.016);
  assert.deepEqual(lane.calls, ['begin', ['end', 0.016, [1, 2, 3]], ['draw', [1, 2, 3]]]);
  assert.deepEqual([b1.castOnly, b2.castOnly], [true, false], 'cast-only where the body stands');
  assert.deepEqual(flushes, ['open', 'flush'], 'one bind');
  assert.equal(pl.has('a'), true);
  pl.draw({}, 'P', 'V', [1, 2, 3], 0.016);
  assert.equal(lane.calls.length, 3, 'nothing offered since: nothing synced');
  pl.drawVeiled(); pl.offsetAll([5, 0, 5]);
  assert.equal(lane.calls.at(-1), 'veiled');
  assert.deepEqual(lane.offsets, [[5, 0, 5]]);
  want = false;
  assert.equal(pl.frame(), false, 'unwanted');
  assert.equal(lane.destroyed, 1, 'and let go');
  const b3 = { castOnly: true };
  pl.offer({ id: 'c' }, b3);
  assert.equal(b3.castOnly, false, 'an offer with no lane still leaves the billboard drawn');
  want = true;
  pl.frame();
  assert.equal(made, 2);
  pl.destroy();
  assert.equal(lane.destroyed, 1);
  assert.equal(pl.has('a'), false);
});

test('MWNPC7d THE POPULATION HOSTS, enumerated and by source: every host that walks a town population offers its walkers and draws their bodies before its person billboards, and draws the veiled', () => {
  const hosts = [];
  for (const f of readdirSync(new URL('../src/scenes', import.meta.url))) if (f.endsWith('.js') && /population\.update\(/.test(rd(`src/scenes/${f}`))) hosts.push(`src/scenes/${f}`);
  assert.deepEqual(hosts.sort(), ['src/scenes/exterior.js', 'src/scenes/world.js'], 'a new host walking a population is named here');
  const sites = {
    // PIN MOVED (AUDIT MW-NPC C4): world.js's walker dressed as a living resident stands as that resident (rosterBodies.js
    // residentWalkerActor); exterior.js walks no living town
    'src/scenes/world.js': ['const _folkOn = folkStreet.frame();', 'if (_folkOn) folkStreet.offer(person.living?.res ? residentWalkerActor(person, batch.origin) : folkActor(person, batch.origin, p.population.race), batch);', 'folkStreet.draw(canvas, proj, view, mwv.eye, townTalk.overlayActive ? 0 : dt);', 'if (livePersonBatches.length) renderer.drawBillboards(livePersonBatches, camRight, bbUp);', 'folkStreet.drawVeiled();'],
    'src/scenes/exterior.js': ['const _folkOn = !!population && folkStreet.frame();', 'if (_folkOn) folkStreet.offer(folkActor(person, batch.origin, population.race), batch);', 'folkStreet.draw(canvas, proj, view, eye, popDt);', 'if (personBatches.length) renderer.drawBillboards(personBatches, camRight, UP_Y);', 'folkStreet.drawVeiled();'],
  };
  for (const [file, [frame, offer, draw, flats, veiled]] of Object.entries(sites)) {
    const s = rd(file);
    const a = s.indexOf(frame), b = s.indexOf(offer, a), c = s.indexOf(draw, b), d = s.indexOf(flats, c);
    assert.ok(a > 0 && b > a && c > b && d > c, `${file}: the frame, the offer, the draw, then the billboards`);
    assert.ok(s.includes(veiled), `${file}: the veiled`);
    assert.ok(s.includes('else batch.castOnly = false;'), `${file}: a billboard drawn whenever the lane is not`);
  }
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes('folkStreet.destroy();   // MWNPC7: indoors'), 'world.js lets the walkers go indoors');
  assert.ok(w.includes('folkStreet.offsetAll(r.offset);'), 'and moves them with the origin');
});
