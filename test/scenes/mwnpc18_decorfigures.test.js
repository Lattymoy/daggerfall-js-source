// MWNPC18 (2026-10-11, a player's report via Mac: "Player decorations are not affected" - bible/04-Characters/
// Morrowind-NPCs.md section 26): A FIGURE A PLAYER PLACED STANDS IN A MORROWIND BODY. DECOR-FIGURE lets a home's owner
// set down one of Daggerfall's people (net/decorLaw.js decorIsFigure); every room's own people stood in bodies and the
// placed ones kept their pictures, because no census looked at a decor room. Now each is read for a look off its
// picture - its sex FLATS.CFG's, its role FLATS.CFG's caption's, its race the region's, its seed its piece's id
// (characters/peopleBodies.js figureLook) - and offered on its host's people lane (scenes/decor/decorRoom.js
// offerDecorFigures): the rooms' (worldModes.js) and the yards' (world.js, through homeYards.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { figureLook, figureRole, DAEDRA_PRINCES_ARCHIVE, FIGURE_ROLE_WORDS } from '../../src/characters/peopleBodies.js';
import { offerDecorFigures } from '../../src/scenes/decor/decorRoom.js';
import { wornByRole, WARDROBE_ROLES } from '../../src/characters/wardrobe.js';
import { decorIsFigure } from '../../src/net/decorLaw.js';
import { hostText, hostOf } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const ROOT = new URL('../../', import.meta.url).pathname;
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const walk = (dir) => readdirSync(join(ROOT, dir)).flatMap((n) => {
  const p = `${dir}/${n}`;
  return statSync(join(ROOT, p)).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
});
/** FLATS.CFG as formats/flatsFile.js answers it: archive.record -> { gender, caption } */
const flatsOf = (rows) => ({ getFlatData: (a, r) => rows[`${a}.${r}`] ?? null });
const FLATS = flatsOf({
  '182.11': { gender: '2', caption: 'comely maiden' },
  '182.3': { gender: '1', caption: 'old fisherman' },
  '183.4': { gender: '1', caption: 'nobleman' },
  '183.9': { gender: '?2', caption: 'elegantly dressed lady' },
  '181.2': { gender: '1', caption: 'priest of Arkay' },
  '180.6': { gender: '1', caption: 'knight in armor' },
  '177.1': { gender: '2', caption: 'female sorcerer' },
  '334.5': { gender: '0', caption: 'figure of no sex the column names' },
});
// the shape decorRoom.js put() mints: a batch with no origin (its base in its vertices), the room's origin `o` beside it
const fig = (id, a, r) => ({ piece: { id, flat: [a, r], pos: [0, 0, 0] }, o: [0, 0, 0], batch: { origin: null, castOnly: true } });

test('MWNPC18a figureLook: a placed figure\'s sex FLATS.CFG\'s, its role its caption\'s, its race the region\'s, its seed its piece\'s id; a child, the Daedra Princes and a figure no row sexes keep their pictures; FLATS.CFG not read yet is asked again (mutants: the sex off the record; the seed off the picture; the cache of a miss)', () => {
  const maiden = figureLook(fig('a1', 182, 11), { flats: FLATS, race: 'Redguard' });
  assert.equal(maiden.gender, 'female');
  assert.equal(maiden.race, 'Redguard', 'the region\'s, by name');
  assert.ok(wornByRole(maiden, 'commoner'), 'a comely maiden is the street\'s');
  assert.ok(maiden.npc && Number.isInteger(maiden.npc.seed), 'her own picks, head and hair');
  assert.equal(figureLook(fig('a2', 183, 4), { flats: FLATS, race: 3 }).race, 'Nord', 'the region\'s, by its RACES id');
  assert.equal(figureLook(fig('a3', 183, 4), { flats: FLATS, race: 'Imperial' }).race, 'Breton', 'a race no body has: the Bay\'s Breton');
  assert.ok(wornByRole(figureLook(fig('b1', 183, 4), { flats: FLATS }), 'noble'));
  const lady = figureLook(fig('b2', 183, 9), { flats: FLATS });
  assert.equal(lady.gender, 'female', 'a "?2" is a woman (FLATS.CFG\'s censor mark read through)');
  assert.ok(wornByRole(lady, 'noble'));
  assert.ok(wornByRole(figureLook(fig('c1', 181, 2), { flats: FLATS }), 'priest'));
  assert.ok(wornByRole(figureLook(fig('c2', 180, 6), { flats: FLATS }), 'knight'));
  assert.ok(wornByRole(figureLook(fig('c3', 177, 1), { flats: FLATS }), 'mage'));
  // one picture, two pieces: two people; the same piece, the same person on every client
  const one = figureLook(fig('p1', 182, 3), { flats: FLATS }), two = figureLook(fig('p2', 182, 3), { flats: FLATS });
  assert.notDeepEqual(one, two, 'a second copy of a picture is a second person');
  assert.deepEqual(figureLook(fig('p1', 182, 3), { flats: FLATS }), one, 'the same piece, the same person');
  // keep their pictures
  assert.equal(figureLook(fig('k1', 182, 4), { flats: flatsOf({ '182.4': { gender: '1', caption: 'boy' } }) }), null, 'a child (StaticNPC\'s own child pairs)');
  assert.equal(figureLook(fig('k2', DAEDRA_PRINCES_ARCHIVE, 0), { flats: flatsOf({ '175.0': { gender: '2', caption: 'beautiful maiden' } }) }), null, 'Azura is no person in clothes');
  assert.equal(figureLook(fig('k3', 334, 5), { flats: FLATS }), null, 'no sex the column names');
  assert.equal(figureLook(fig('k4', 182, 99), { flats: FLATS }), null, 'no row at all');
  // not read yet: asked again, never cached as a picture
  const early = fig('e1', 182, 11);
  assert.equal(figureLook(early, { flats: null }), null);
  assert.equal(early._mwLook, undefined, 'a miss of the file is no verdict');
  assert.equal(figureLook(early, { flats: FLATS }).gender, 'female', 'read once it is in hand');
  assert.equal(figureLook(early, null), early._mwLook, 'kept on the piece - one build while it stands');
});

test('MWNPC18b figureRole: the caption\'s words to a role, the first that matches - a knight before a noble, the street\'s for words it does not know; each word from its start and a short one whole (AUDIT MWNPC16-18 D3: "good-looking" and "walking" held a king, "country" a count, "overseer" a seer, "image" a mage, "relaxed" an axe, "monkey" a monk); every role it names a wardrobe role (mutants: the order turned; a word read inside another)', () => {
  assert.equal(figureRole('noble knight'), 'knight');
  assert.equal(figureRole('Priestess of Mara'), 'priest');
  assert.equal(figureRole('witch'), 'mage');
  assert.equal(figureRole('barbarian with axe'), 'fighter');
  assert.equal(figureRole('Countess'), 'noble');
  assert.equal(figureRole('shopkeeper'), 'merchant');
  assert.equal(figureRole('hooded thief'), 'rogue');
  assert.equal(figureRole('old scholar'), 'scholar');
  assert.equal(figureRole('drunk'), 'commoner');
  assert.equal(figureRole(null), 'commoner');
  for (const c of ['good-looking whore', 'walking man', 'country girl', 'overseer', 'image of a man', 'relaxed woman', 'monkey trainer', 'message boy', 'landlord']) assert.equal(figureRole(c), 'commoner', `"${c}": no word of a role in it`);
  for (const [c, role] of [['bodyguard', 'knight'], ['blacksmith', 'merchant'], ['axeman', 'fighter'], ['King of Worms', 'noble'], ['count', 'noble'], ['monks', 'priest'], ['sage', 'scholar'], ['seer', 'mage'], ['mages', 'mage'], ['lords', 'noble']]) assert.equal(figureRole(c), role, `"${c}"`);
  for (const [role] of FIGURE_ROLE_WORDS) assert.ok(WARDROBE_ROLES[role], role);
  // AUDIT MWNPC16-18 R2: THE ORDER, EVERY NEIGHBOUR - a caption naming two roles is the higher one's (only a knight before
  // a noble was pinned: any other two rows turned survived); and every row in any case (only two were asked in capitals)
  for (const [c, role] of [['mage priest', 'priest'], ['knight mage', 'mage'], ['warrior knight', 'knight'], ['noble warrior', 'fighter'], ['thief lord', 'noble'], ['merchant thief', 'rogue'], ['scholar merchant', 'merchant']]) assert.equal(figureRole(c), role, `"${c}": the higher row's`);
  for (const [c, role] of [['PRIEST', 'priest'], ['WIZARD', 'mage'], ['KNIGHT', 'knight'], ['WARRIOR', 'fighter'], ['NOBLE', 'noble'], ['THIEF', 'rogue'], ['MERCHANT', 'merchant'], ['SCHOLAR', 'scholar'], ['BODYGUARD', 'knight'], ['BLACKSMITH', 'merchant']]) assert.equal(figureRole(c), role, `"${c}" in capitals`);
});

test('MWNPC18c offerDecorFigures, through a real decor room: each figure with a look offered on the lane at its piece\'s base - the room\'s origin and its place in it, never its batch\'s origin (a room\'s batch is minted with none; a restand() writes only its step there) - after a recentre where it stands now, and made again over a lane that moved it; turned to the eye; one without draws its picture (its cast-only cleared); the lane off offers none (AUDIT MWNPC16-18 D1: the batch\'s origin was read - a TypeError every frame a placed figure stood with bodies on, or a body a whole room off after a recentre. Mutants: the offer skipped; the castOnly left; the place in the room dropped; the base made once)', async () => {
  const { createDecorRoom } = await import('../../src/scenes/decor/decorRoom.js');
  const settle = () => new Promise((res) => setImmediate(res));
  const o = [10, 0, 10];
  const made = [];
  const room = createDecorRoom({
    meshes: {}, collider: () => null, origin: () => o, uploadRecord() {},
    renderer: { createBillboardBatch: (a, rec, size, centers) => { const bb = { a, rec, centers, origin: null }; made.push(bb); return bb; }, destroyBillboardBatch() {} },
    getTexture: async () => ({ recordCount: 64, getSize: () => ({ width: 16, height: 32 }), getScale: () => ({ width: 0, height: 0 }) }),
  });
  const piece = (id, a, r, pos) => ({ id, model: null, flat: [a, r], pos, rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 10 });
  room.put(piece('o1', 182, 11, [1, 0, 2]));
  room.put(piece('o2', 182, 4, [3, 0, 0]));   // no FLATS.CFG row: no look
  room.put(piece('o3', 183, 4, [0, 0, 5]));
  await settle(); await settle();
  const figs = room.figures();
  assert.deepEqual(figs.map((e) => e.piece.id), ['o1', 'o2', 'o3']);
  assert.ok(made.every((b) => b.origin === null), 'the shape the room mints: no origin on the batch');
  const offered = [];
  const lane = { offer: (a, b) => offered.push({ a, b, feet: [...a.feet] }) };
  for (const f of figs) f.batch.castOnly = true;
  assert.equal(offerDecorFigures(figs, lane, true, { flats: FLATS, race: 'Breton' }, [11, 0, 22], 1 / 60), 2);
  assert.deepEqual(offered.map((x) => x.b), [figs[0].batch, figs[2].batch], 'the people, with the batches that draw them');
  assert.deepEqual(offered.map((x) => x.feet), [[11, 0, 12], [10, 0, 15]], 'standing where each picture stands');
  assert.ok(Math.abs(offered[0].a.yaw) < 1e-9, 'facing the eye (+z of it)');
  assert.equal(figs[1].batch.castOnly, false, 'the one with no look: its picture drawn');
  // the world recentres: the room stands again where its origin is now - and so do its people
  o[0] -= 819.2;
  room.restand();
  assert.ok(Math.abs(made[0].origin[0] + 819.2) < 1e-9, 'the batch carries the recentre\'s step, not a base');
  offered.length = 0;
  offerDecorFigures(figs, lane, true, { flats: FLATS }, [11 - 819.2, 0, 22], 1 / 60);
  assert.ok(Math.abs(offered[0].feet[0] - (11 - 819.2)) < 1e-9 && offered[0].feet[2] === 12, 'where it stands now');
  // the lane moved the feet it holds (its offsetAll aliases them): made again from the room, never drifted
  offered[0].a.feet[0] += 5;
  offered.length = 0;
  offerDecorFigures(figs, lane, true, { flats: FLATS }, [11 - 819.2, 0, 22], 1 / 60);
  assert.ok(Math.abs(offered[0].feet[0] - (11 - 819.2)) < 1e-9, 'made again every frame');
  // AUDIT MWNPC16-18 D4: the figures the room keeps - a piece that is no person never in, one taken down gone at once
  room.put({ ...piece('chair', 182, 11, [0, 0, 0]), model: 41000 });   // a model: no person
  room.put(piece('lamp', 254, 3, [2, 0, 2]));   // a flat that is no person (a lamp's picture), its batch stood as theirs are
  await settle(); await settle();
  assert.ok(made.some((b) => b.a === 254), 'the lamp stands its picture');
  const kept = room.figures();
  assert.equal(kept, room.figures(), 'one list, the room\'s');
  assert.deepEqual(kept.map((e) => e.piece.id), ['o1', 'o2', 'o3']);
  room.remove('o2');
  assert.deepEqual(room.figures().map((e) => e.piece.id), ['o1', 'o3'], 'taken down: gone');
  room.put(piece('o1', 183, 4, [1, 0, 2]));   // put again (a turn, a station): the new entry, never the old
  await settle(); await settle();
  assert.equal(room.figures().filter((e) => e.piece.id === 'o1').length, 1);
  room.put(piece('o2', 182, 4, [3, 0, 0]));
  await settle(); await settle();
  // the lane off: every picture drawn, none offered
  offered.length = 0;
  for (const f of figs) f.batch.castOnly = true;
  assert.equal(offerDecorFigures(figs, lane, false, { flats: FLATS }, [0, 0, 0], 0), 0);
  assert.deepEqual(offered, []);
  assert.ok(figs.every((f) => f.batch.castOnly === false), 'the lane off: every picture drawn');
});

test('MWNPC18e EVERY HOST THAT DRAWS DAGGERFALL\'S PEOPLE stands them in bodies (it offers them to a people lane) or keeps their pictures, and says why - a new host of people fails here until it does one or the other (AUDIT MWNPC16-18 D5: Come Sail Away\'s crews were neither, under section 26\'s "blind spot, closed")', () => {
  // a host draws a person through nudeFlats.js drawnFlat (NUDE-FLATS: every person's picture asks it); Come Sail Away's
  // crews are its prefabs' BillboardHelper people (nudedecor.test.js holds them to the table)
  const hosts = walk('src').filter((p) => p !== 'src/characters/nudeFlats.js' && /\bdrawnFlat\(/.test(rd(p).replace(/^\s*\/\/.*$/gm, ''))).concat('src/scenes/comeSailAway/comeSailAwayPool.js').sort();
  const BODIES = {
    'src/scenes/decor/decorRoom.js': 'offerDecorFigures(',   // the placed figures, for its hosts (section 26)
    'src/scenes/dungeonContext.js': '_peopleLane.offer(personActor(',
    'src/scenes/exterior.js': 'standPeople.offer(personActor(',
    'src/scenes/pixelBuild.js': 'streetPeople.offer(personActor(',   // HOST-SPLIT 2: the world's pixel build draws the street's people; its host (world.js) offers them
    'src/scenes/worldModes.js': 'peopleBodies.offer(personActor(',
  };
  const PICTURES = {
    'src/scenes/arena/arenaBouts.js': 'the arena\'s seated crowd - up to 420 flats (section 4)',
    'src/scenes/decor/decorTool.js': 'the decorator\'s ghost - a picture being placed, not a person standing',
    'src/scenes/interiorContext.js': 'a building\'s people, stood as flats here and offered by its host (worldModes.js)',
    'src/scenes/comeSailAway/comeSailAwayPool.js': 'a ship\'s crew (the prefabs\' BillboardHelper people) - NOT HERE, section 27',
  };
  assert.deepEqual(hosts, [...Object.keys(BODIES), ...Object.keys(PICTURES)].sort(), 'every host that draws a person, named once');
  for (const [f, call] of Object.entries(BODIES)) assert.ok((hostOf(f) ? hostText(hostOf(f)) : rd(f)).includes(call), `${f} offers its people`);
  assert.match(rd('bible/04-Characters/Morrowind-NPCs.md'), /Come Sail Away's crews/, 'the crews\' pictures declared');
});

test('MWNPC18d EVERY DECOR ROOM\'S FIGURES ARE OFFERED - the rooms\' on the interior host\'s people lane, the yards\' on the street\'s, before the bodies draw; a new host of decor rooms fails here until it does the same (the census never saw a decor room: its people are flats, not mobiles)', () => {
  const hosts = walk('src').filter((p) => /[=(,]\s*createDecorRoom\(/.test(rd(p))).sort();   // a call, not its definition
  assert.deepEqual(hosts, ['src/scenes/homeYards.js', 'src/scenes/worldModes.js'], 'the hosts that stand decor rooms');
  assert.match(rd('src/scenes/decor/decorRoom.js'), /const figures = \(\) => \{ figOut\.length = 0; for \(const e of figs\) if \(e\.batch\) figOut\.push\(e\); return figOut; \};/);
  const modes = rd('src/scenes/worldModes.js'), world = hostText('src/scenes/world.js');
  const o = modes.indexOf('offerDecorFigures(interiorDecor.figures(), peopleBodies, _peopleOn, figureCtx, mwv.eye, dt);');
  assert.ok(o > 0 && o < modes.indexOf('    peopleBodies.draw(canvas, proj, view, mwv.eye, dt);'), 'a room\'s, before its people draw');
  assert.match(rd('src/scenes/homeYards.js'), /figures: \(\) => \{\n      yardFigs\.length = 0;\n      const eye = deps\.eye\?\.\(\) \?\? null;\n      for \(const y of yards\.values\(\)\) if \(nearEye\(y, eye\)\) for \(const e of y\.pool\.figures\(\)\) yardFigs\.push\(e\);\n      return yardFigs;\n    \},/, 'one list kept; only a yard within its reach, as its flats are (YARD-RANGE)');   // PIN MOVED (main's YARD-RANGE merged: a yard's flats are drawn only within its reach, and its figures stand only there)
  // AUDIT MWNPC16-18 D2: a room's figure is of the race its building's region names (the yards' read) - the quest scene's
  // context names none, and every room's figure stood a Breton
  assert.match(modes, /get race\(\) \{ const i = interiorBuilding\?\.regionIndex \?\? host\.currentRegionIndex\?\.\(\) \?\? -1; return REGION_RACES\[i\] != null \? REGION_RACES\[i\] \+ 1 : null; \},/);
  assert.match(world, /get race\(\) \{ return REGION_RACES\[_questRegionIndex\(\)\] \+ 1; \} \};/);
  // AUDIT MWNPC16-18 R2: and each reads FLATS.CFG off the pipeline - a context whose file is null keeps every figure its
  // picture for good, and nothing failed (figureLook's own pins hand it a file)
  assert.match(modes, /const figureCtx = \{\n    get flats\(\) \{ return pipeline\?\.flatsFile\?\.\(\) \?\? null; \},/);
  assert.match(world, /const yardFigureCtx = \{ get flats\(\) \{ return pipeline\.flatsFile\?\.\(\) \?\? null; \},/);
  const y = world.indexOf("    if (yards && _mode() === 'exterior') offerDecorFigures(yards.figures(), streetPeople, _peopleOn, yardFigureCtx, mwv.eye,");
  assert.ok(y > 0 && y < world.indexOf('    streetPeople.draw(canvas, proj, view, mwv.eye,'), 'a yard\'s, before the street\'s people draw');
  assert.equal(decorIsFigure({ model: null, flat: [182, 11] }), true, 'a person\'s flat is a figure');
});
