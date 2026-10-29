// FIELD BUGS 2026-10-29b (Discord #bug-reports, "Family between married characters not appearing for both players"):
// "she has a child between our characters which is ready to play with the 'Enduring' feature, but that child doesn't
// appear on my family tree." UNION-CHILDREN (the owner: "Show on both trees"; bible/06-Systems/Legacy-Arc.md section 9a):
// a child of two players' union is of the house that bore them, and the other house sees them through the marriage - a
// person of kind 'union' under the couple, never played there. The account service reads them off the other's line
// (server-account/src/legacy.js listUnions, unionKinOf); the client records them (systems/legacy/unionKin.js).
//
// Fixtures from the producers: the real Worker over the real migrations, two real Legacy hosts founded online, their
// lines written through the real realm line (realmLine.js) and their characters born through /v1/realm/create, wed by
// both halves of /v1/realm/wed, children rolled by each host's own slow tick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService } from '../../accountDb.mjs';
import { listUnions, unionKinOf, endUnionsOf, UNION_KIN_AFTER_END_S, UNION_KIN_LINES_MAX } from '../../../server-account/src/legacy.js';
import { REALM_CHARACTERS_MAX } from '../../../server-account/src/realm.js';
import { createLegacyHost } from '../../../src/scenes/legacyHost.js';
import { createRealmLine } from '../../../src/systems/legacy/realmLine.js';
import { personOf, familyRng, MODELS, LEGACY_MOD, readFamily, successors, childrenOf, leanRecord } from '../../../src/systems/legacy/family.js';
import { samePerson, mergeFacts } from '../../../src/systems/legacy/store.js';
import { unionSpouse, childrenTogether, childStep, CHILDREN_MAX, CHILD_DAYS } from '../../../src/systems/legacy/marriage.js';
import { unionKinHeard, unionKinOf as kinOfHouse, kinBornLine, raisedWord } from '../../../src/systems/legacy/unionKin.js';
import { kinCard, readUnionKin, UNION_KIN_MAX } from '../../../src/systems/legacy/unionKinLaw.js';
import { homeOf } from '../../../src/systems/legacy/household.js';
import { facePose } from '../../../src/systems/legacy/facePose.js';
import { layoutTree } from '../../../src/systems/legacy/tree.js';
import '../../chargenDom.mjs';   // a minimal DOM: the Family tab's pages drawn headless
import { personChips, setFamilyProvider, resetFamilyPages, drawTreePage, drawHousePage, drawHallPage } from '../../../src/ui/familyPages.js';
import { _resetModSaveData } from '../../../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';

const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const ent = (cid, name, gender) => ({
  name, gender, race: 'Breton', faceIndex: 2, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 9, characterId: cid, chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)),
});

/** A player of an online house: an account, a Legacy host founded online, its line written to the realm, and the realm
 *  character born as its founder (world.js's founding: the line first, the character after, the id rebound). */
async function player(S, given, surname, gender, seed) {
  const g = await S.guest();
  const call = (p, b) => S.call(p, b, g.secret);
  _resetModSaveData();
  _resetModSettings();
  const storage = mem(), tab = mem();
  const entity = ent(`c-${given.toLowerCase()}`, `${given} ${surname}`, gender);
  const w = { g, call, entity, said: [], own: 0, realm: null, lease: null };
  w.line = createRealmLine({
    io: () => ({}), storage: () => storage,
    put: async (_io, id, record, base) => {
      const r = await call('/v1/realm/lineage', { id, record, base });
      return r.status === 200 ? { ok: true, data: r.body } : { ok: false, error: r.body?.error, data: r.body };
    },
  });
  w.host = createLegacyHost({
    entity, storage: () => storage, tab: () => tab, on: () => true, online: () => true, now: () => 1000 + w.own, own: () => w.own,
    here: () => null, town: () => null, nearestTown: () => null, gold: () => 0, say: (l) => w.said.push(l), boot: () => {}, search: () => '',
    loadCharacter: () => false, saveNow: () => true, hasSave: () => true, inFight: () => false, rng: familyRng(seed),
    templeOf: () => 77, realmId: () => w.realm, sky: () => 1000, stored: (f) => { w.line.push(f); }, tombstone: () => Promise.resolve(true),
  });
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);
  w.host.found(MODELS.enduring);
  _resetModSettings();
  assert.equal(await w.line.flush(), true, `${given}'s line is the realm's`);
  const made = (await call('/v1/realm/create', { name: `${given} ${surname}`, lineage: w.host.family.id, person: w.host.current().id })).body;
  assert.ok(made.id, `${given} is born in the realm`);
  w.realm = made.id;
  w.lease = made.lease;
  w.host.rebind(entity.characterId, made.id);
  entity.characterId = made.id;
  w.unions = async () => (await call('/v1/realm/unions', {})).body.unions;
  w.hear = async () => { const n = w.host.unionsHeard(await w.unions()); await w.line.flush(); return n; };
  return w;
}
/** Two players wed through both halves of the real route - hers first, then his. */
async function wed(her, him, sid = 'wedZinVow1') {
  await her.call('/v1/realm/wed', { id: her.realm, lease: her.lease, sid, partner: him.g.id, partnerChar: him.realm });
  const done = await him.call('/v1/realm/wed', { id: him.realm, lease: him.lease, sid, partner: her.g.id, partnerChar: her.realm });
  assert.equal(done.body.wed, true, 'the union stands');
  await her.hear();
  await him.hear();
}
/** Her slow tick on her own clock until her house has a child of the union (marriage.js childStep, 25% a month). */
async function childOf(w) {
  for (let d = 0; d < CHILD_DAYS * 200; d += CHILD_DAYS) {
    w.own = d * 1440;
    w.host.tick();
    const kid = w.host.family.people.find((p) => p.minor && p.kind === 'member');
    if (kid) { assert.equal(await w.line.flush(), true); return kid; }
  }
  throw new Error('no child in two hundred months');
}
const plates = (w) => layoutTree(w.host.family).nodes.map((n) => personOf(w.host.family, n.id).given);

test('UNION-CHILDREN the report: her house bears a child of the union, and his tree shows them under the couple, raised in her house - never played there, never his heir, never in his world (mutants: no read of the line, no record, no plate)', async () => {
  const S = await standService();
  const her = await player(S, 'Zinnia', 'Indoril', 'female', 7);
  const him = await player(S, 'Vowel', 'Dres', 'male', 11);
  await wed(her, him);
  const kid = await childOf(her);
  assert.deepEqual(plates(him), ['Vowel', 'Zinnia'], 'before the read: his tree has the couple alone');
  // the realm's read: her line's child, by her line's id - hers reads none of his (he has none)
  const [u] = await him.unions();
  assert.deepEqual(u.children, [{ key: kid.id, given: kid.given, surname: kid.surname, house: 'Indoril', gender: kid.gender, race: kid.race, face: kid.face, born: kid.born, died: null, minor: true }]);
  assert.deepEqual((await her.unions())[0].children, []);
  // his house hears it: one person of kind 'union', the couple's child, said once on his HUD
  assert.ok((await him.hear()) >= 1);
  const me = him.host.current();
  const wife = unionSpouse(him.host.family, 'wedZinVow1');
  const seen = kinOfHouse(him.host.family, 'wedZinVow1');
  assert.equal(seen.length, 1);
  const c = seen[0];
  assert.deepEqual([c.kind, c.given, c.surname, c.minor, c.characterId, c.gen, c.parents], ['union', kid.given, kid.surname, true, null, me.gen + 1, [me.id, wife.id]]);
  assert.deepEqual(c.union, { sid: 'wedZinVow1', key: kid.id, house: 'Indoril' });
  assert.deepEqual(childrenOf(him.host.family, me).map((x) => x.id), [c.id]);
  assert.deepEqual(him.said.filter((l) => l === kinBornLine(c, wife)), [`Word reaches you: ${kid.given} ${kid.surname} is born to you and Zinnia.`]);
  // the tree: under the couple, as hers is
  const t = layoutTree(him.host.family);
  assert.deepEqual(t.families, [{ parents: [me.id, wife.id], children: [c.id] }]);
  assert.deepEqual(plates(him), ['Vowel', 'Zinnia', kid.given]);
  assert.ok(personChips(him.host.family, c, 0).some((x) => x.text === 'Raised in the house of Indoril'));
  assert.ok(personChips(him.host.family, c, 0).some((x) => x.text === 'A child'));
  // never played here, never his heir, never standing in his world, never his house's own face
  assert.equal(him.host.switchRefusal(c.id), 'none');
  assert.ok(!successors(him.host.family).some((p) => p.id === c.id));
  assert.equal(homeOf(him.host.family, c), null);
  assert.equal(facePose(c, { currentId: me.id }).kin, undefined);
  // heard again: nothing new, nothing said again
  const said = him.said.length;
  assert.equal(await him.hear(), 0);
  assert.equal(him.said.length, said);
  assert.equal(kinOfHouse(him.host.family, 'wedZinVow1').length, 1);
  // his line, with her child in it, is the realm's - the family's law (INT18) takes it - and read back keeps its shape
  const stored = await S.env.DB.prepare('SELECT record FROM lineages WHERE player = ? AND id = ?').bind(him.g.id, him.host.family.id).first();
  const back = readFamily(JSON.parse(stored.record));
  assert.deepEqual(personOf(back, c.id).union, c.union);
  assert.equal(personOf(back, c.id).kind, 'union');
  // her house is unchanged: the child is of her blood, and her tree has no stranger
  assert.equal(personOf(her.host.family, kid.id).kind, 'member');
  assert.equal(kinOfHouse(her.host.family, 'wedZinVow1').length, 0);
});

test('UNION-CHILDREN each house still rolls its own: his child of the union shows on hers, hers on his; neither takes the other\'s places (CHILDREN_MAX counts a house\'s own) (mutants: the count reads the other\'s, the key)', async () => {
  const S = await standService();
  const her = await player(S, 'Zinnia', 'Indoril', 'female', 7);
  const him = await player(S, 'Vowel', 'Dres', 'male', 11);
  await wed(her, him);
  const hers = await childOf(her);
  const his = await childOf(him);
  await her.hear();
  await him.hear();
  assert.deepEqual(kinOfHouse(her.host.family, 'wedZinVow1').map((p) => [p.given, p.union.key]), [[his.given, his.id]]);
  assert.deepEqual(kinOfHouse(him.host.family, 'wedZinVow1').map((p) => [p.given, p.union.key]), [[hers.given, hers.id]]);
  const me = him.host.current();
  const wife = unionSpouse(him.host.family, 'wedZinVow1');
  assert.equal(childrenTogether(him.host.family, me, wife), 1, 'his own, not hers');
  // a house of the union's own six still rolls while the other's six are seen
  const f = him.host.family;
  for (let k = 0; k < UNION_KIN_MAX; k++) unionKinHeard(f, wife, [{ key: 900 + k, given: `Kin${k}`, surname: 'Indoril', minor: true }]);
  assert.equal(childrenTogether(f, me, wife), 1);
  let more = null;
  for (let d = 0; d < CHILD_DAYS * 200 && !more; d += CHILD_DAYS) more = childStep(f, me, { day: 10_000 + d, rng: familyRng(d), at: 5 });
  assert.ok(more && more.kind === 'member', 'his clock rolls his own past her six');
  assert.equal(CHILDREN_MAX, UNION_KIN_MAX, 'the card\'s cap is the house\'s own');
});

test('UNION-CHILDREN as they live on: a name, a coming of age and a death reach the other house; a death is never taken back, nor a child dropped (the realm keeps both - legacyLaw.js) (mutants: a death undone, a card ignored)', async () => {
  const S = await standService();
  const her = await player(S, 'Zinnia', 'Indoril', 'female', 7);
  const him = await player(S, 'Vowel', 'Dres', 'male', 11);
  await wed(her, him);
  const kid = await childOf(her);
  await him.hear();
  const c = kinOfHouse(him.host.family, 'wedZinVow1')[0];
  // her house: the child of age and renamed (a played member's save writes their name), then fallen
  kid.minor = false;
  kid.given = 'Shurain';
  her.line.push(her.host.family);
  assert.equal(await her.line.flush(), true);
  assert.ok((await him.hear()) >= 1);
  assert.deepEqual([c.given, c.minor], ['Shurain', false]);
  kid.died = { at: 4242, cause: 'slain', place: null, by: null };
  her.line.push(JSON.parse(JSON.stringify(her.host.family)));
  assert.equal(await her.line.flush(), true);
  await him.hear();
  assert.deepEqual(c.died, { at: 4242, cause: 'slain', place: null, by: null });
  assert.ok(personChips(him.host.family, c, 0).some((x) => x.text === 'Fallen'));
  // a card that says alive, or none at all: what was heard stands
  const wife = unionSpouse(him.host.family, 'wedZinVow1');
  unionKinHeard(him.host.family, wife, [{ ...kinCard({ key: c.union.key, given: 'Shurain', surname: c.surname }), died: null }]);
  assert.ok(c.died, 'a death heard is never undone');
  unionKinHeard(him.host.family, wife, []);
  assert.equal(kinOfHouse(him.host.family, 'wedZinVow1').length, 1, 'a child is never dropped');
  // one first heard of already dead is recorded and never announced as born
  const said = him.said.length;
  const [u] = await him.unions();
  assert.ok(him.host.unionsHeard([{ ...u, children: [...u.children, kinCard({ key: 777, given: 'Ilsa', surname: 'Indoril', died: { at: 5, cause: 'years' } })] }]) >= 1);
  assert.ok(kinOfHouse(him.host.family, 'wedZinVow1').some((p) => p.given === 'Ilsa' && p.died));
  assert.equal(him.said.length, said);
  him.line.push(him.host.family);
  assert.equal(await him.line.flush(), true, 'and the realm takes his line');
});

test('UNION-CHILDREN the read: open unions and those ended within UNION_KIN_AFTER_END_S read the other\'s line, the open first and at most UNION_KIN_LINES_MAX; a deleted character\'s line is not found, and the house keeps what it heard; names through the filter (mutants: the window, the cap, the order, the filter, another spouse\'s children)', async () => {
  const S = await standService();
  const db = S.env.DB;
  const her = await player(S, 'Zinnia', 'Indoril', 'female', 7);
  const him = await player(S, 'Vowel', 'Dres', 'male', 11);
  await wed(her, him);
  const kid = await childOf(her);
  assert.equal(UNION_KIN_LINES_MAX, REALM_CHARACTERS_MAX, 'one open union a living character');
  // ended: read for UNION_KIN_AFTER_END_S, then not
  const now = Math.floor(Date.now() / 1000);
  await endUnionsOf(db, her.realm, now, 'died').run();
  const at = async (t) => (await listUnions({ db, nowS: t }, him.g.id))[0];
  assert.deepEqual((await at(now + UNION_KIN_AFTER_END_S)).children.map((x) => x.key), [kid.id]);
  const late = await at(now + UNION_KIN_AFTER_END_S + 1);
  assert.equal('children' in late, false, 'ended long since: not read');
  assert.equal(late.sid, 'wedZinVow1', 'and the union still said');
  // the cap and the order: the union's row copied as seven more ended a minute apart, and one open
  const row = await db.prepare('SELECT * FROM realm_unions WHERE sid = ?').bind('wedZinVow1').first();
  const put = (sid, ended) => db.prepare('INSERT INTO realm_unions (sid, a_player, a_char, b_player, b_char, a_card, b_card, wed_at, ended_at, ended_why, ended_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(sid, row.a_player, row.a_char, row.b_player, row.b_char, row.a_card, row.b_card, row.wed_at - (ended == null ? 86400 : 100), ended, ended == null ? null : 'died', ended == null ? null : row.a_char).run();
  for (let k = 0; k < 7; k++) await put(`wedEnded${k}`, now - 60 * (k + 1));
  await put('wedOpen001', null);
  const list = await listUnions({ db, nowS: now }, him.g.id);
  const read = list.filter((x) => 'children' in x).map((x) => x.sid);
  assert.equal(read.length, UNION_KIN_LINES_MAX);
  assert.equal(read.includes('wedOpen001'), true, 'the open union first, though wed a day before the rest ended');
  assert.deepEqual(read.filter((s) => s !== 'wedOpen001'), ['wedZinVow1', 'wedEnded0', 'wedEnded1', 'wedEnded2', 'wedEnded3'], 'then the newest ended');
  // her character deleted: no row names her line, so nothing is read; his house keeps the child it heard
  await db.prepare('DELETE FROM realm_unions WHERE sid != ?').bind('wedZinVow1').run();
  await db.prepare('UPDATE realm_unions SET ended_at = NULL, ended_why = NULL, ended_by = NULL').run();
  await him.hear();
  assert.equal(kinOfHouse(him.host.family, 'wedZinVow1').length, 1);
  assert.equal((await her.call('/v1/realm/delete', { id: her.realm })).status, 200);
  const gone = (await him.unions())[0];
  assert.equal('children' in gone, false);
  await him.hear();
  assert.equal(kinOfHouse(him.host.family, 'wedZinVow1').length, 1, 'kept');
  // the line's own law: only this union's children, names through the filter, at most UNION_KIN_MAX
  const line = JSON.parse(JSON.stringify(her.host.family));
  const me = line.people.find((p) => p.kind === 'player');
  const zin = line.people.find((p) => p.id === kid.parents.find((id) => id !== me.id));
  const other = { ...me, id: 500, realm: { ...me.realm, sid: 'wedOther01' } };
  line.people.push(other, { ...kid, id: 501, parents: [zin.id, other.id] }, { ...kid, id: 502, parents: [] }, { ...kid, id: 503, given: 'Admin' });
  for (let k = 0; k < 8; k++) line.people.push({ ...kid, id: 600 + k });
  const cards = unionKinOf(JSON.stringify(line), zin.id, 'wedZinVow1');
  assert.equal(cards.length, UNION_KIN_MAX);
  assert.deepEqual(cards.map((x) => x.key), [kid.id, 503, 600, 601, 602, 603]);
  assert.equal(cards[1].given, '', 'a name the filter refuses goes as none');
  assert.deepEqual(unionKinOf('not json', zin.id, 'wedZinVow1'), []);
  assert.deepEqual(unionKinOf(JSON.stringify(line), 'x', 'wedZinVow1'), []);
});

test('UNION-CHILDREN the record\'s law: a union child is one person across two copies only by its union and key; never a character of this house; the dead\'s standing is let go though one lives; the card and the link held to shape (mutants: samePerson, readFamily, leanRecord)', async () => {
  const S = await standService();
  const her = await player(S, 'Zinnia', 'Indoril', 'female', 7);
  const him = await player(S, 'Vowel', 'Dres', 'male', 11);
  await wed(her, him);
  await childOf(her);
  await him.hear();
  const f = him.host.family;
  const c = kinOfHouse(f, 'wedZinVow1')[0];
  const twin = { ...JSON.parse(JSON.stringify(c)), union: { ...c.union, key: c.union.key + 1 } };
  assert.equal(samePerson(c, JSON.parse(JSON.stringify(c))), true);
  assert.equal(samePerson(c, twin), false, 'another child of the union');
  assert.equal(samePerson(c, { ...twin, union: { ...c.union, sid: 'wedOther01' } }), false, 'another union');
  // two copies that each heard the child under one id are one person; a copy holding another under that id moves it
  const a = readFamily(JSON.parse(JSON.stringify(f)));
  const b = readFamily(JSON.parse(JSON.stringify(f)));
  personOf(b, c.id).union.key += 1;
  mergeFacts(a, b);
  assert.equal(a.people.filter((p) => p.kind === 'union').length, 2);
  // a record that names a character on a union child keeps none; a link out of shape is none
  const raw = JSON.parse(JSON.stringify(f));
  raw.people.find((p) => p.id === c.id).characterId = 'r-stolen';
  assert.equal(personOf(readFamily(raw), c.id).characterId, null);
  raw.people.find((p) => p.id === c.id).union = { sid: 'x', key: 1 };
  assert.equal(personOf(readFamily(raw), c.id).union, null);
  assert.equal(readUnionKin({ sid: 'wedZinVow1', key: -1 }), null);
  assert.deepEqual(readUnionKin({ sid: 'wedZinVow1', key: 3, house: 'Bad<' }), { sid: 'wedZinVow1', key: 3, house: null });
  // the dead's standing goes once every child of theirs of the blood is played or dead - a union child is not one
  const me = him.host.current();
  me.died = { at: 1, cause: 'fell', place: null, by: null };
  me.standing = { law: {}, factions: {}, regard: {} };
  assert.equal(leanRecord(f), true);
  assert.equal(me.standing, null);
  // the card's shape
  assert.deepEqual(kinCard({ key: 4, given: 'A'.repeat(41), surname: 'Dres', house: 'Dres', gender: 'x', race: 'Dark Elf<', face: 5000, born: -3, died: { at: 9, cause: 'eaten' }, minor: 1 }),
    { key: 4, given: '', surname: 'Dres', house: 'Dres', gender: 'male', race: null, face: 0, born: 0, died: { at: 9, cause: 'unknown' }, minor: false });
  assert.equal(kinCard({ key: 1.5 }), null);
  // at most UNION_KIN_MAX a union from one read, as the service sends
  const many = Array.from({ length: UNION_KIN_MAX + 2 }, (_, k) => ({ key: 300 + k, given: `K${k}`, surname: 'Indoril' }));
  assert.equal(unionKinHeard(f, unionSpouse(f, 'wedZinVow1'), many).added.length, UNION_KIN_MAX);
  assert.equal(raisedWord({ union: { house: null } }), 'Raised in another house');
  assert.equal(raisedWord({ union: { house: 'of Sentinel' } }), 'Raised in the house of Sentinel');
});

test('UNION-CHILDREN mixed builds: a new client and an older service (no `children`) records nothing new and keeps what it has; the new answer adds `children` beside the union\'s own fields, which an older client reads as before (mutants: an absent read taken as none)', async () => {
  const S = await standService();
  const her = await player(S, 'Zinnia', 'Indoril', 'female', 7);
  const him = await player(S, 'Vowel', 'Dres', 'male', 11);
  await wed(her, him);
  await childOf(her);
  const [u] = await him.unions();
  assert.deepEqual(Object.keys(u).sort(), ['at', 'children', 'endedAt', 'endedBy', 'endedWhy', 'mine', 'partner', 'sid']);
  assert.deepEqual(Object.keys(u.partner).sort(), ['char', 'face', 'gender', 'house', 'name', 'player', 'race']);
  const { children, ...older } = u;
  assert.ok(children.length === 1);
  assert.equal(him.host.unionsHeard([older]), 0, 'an older service: nothing to hear');
  assert.equal(kinOfHouse(him.host.family, 'wedZinVow1').length, 0);
  assert.ok(him.host.unionsHeard([u]) >= 1);
  assert.equal(him.host.unionsHeard([older]), 0, 'and what was heard stays');
  assert.equal(kinOfHouse(him.host.family, 'wedZinVow1').length, 1);
});

test('UNION-CHILDREN the pages: his card of her child names the house that raises them and offers no Play as; his House page and the Hall count the blood\'s generations (mutants: the chip, the two counts)', async () => {
  const S = await standService();
  const her = await player(S, 'Zinnia', 'Indoril', 'female', 7);
  const him = await player(S, 'Vowel', 'Dres', 'male', 11);
  await wed(her, him);
  await childOf(her);
  await him.hear();
  const f = him.host.family;
  const c = kinOfHouse(f, 'wedZinVow1')[0];
  const el = (tag, cls, text) => { const n = globalThis.document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
  const divider = (t) => el('h2', null, t);
  resetFamilyPages();
  setFamilyProvider({ on: () => true, family: () => f, lived: () => 0, hall: () => [f], date: (t) => `day ${t}`, inWorld: () => true, livingWorld: () => true, switchRefusal: (id) => him.host.switchRefusal(id) });
  let d = null;
  const draw = () => { d = el('div'); drawTreePage(d, draw, { el, divider }); };
  draw();
  d.querySelectorAll('div').find((n) => n.attrs?.['data-focus'] === `fam-node-${c.id}`).onclick({ stopPropagation() {} });
  const card = d.querySelector('.fam-card');
  assert.match(card.textContent, /Raised in the house of Indoril/);
  assert.equal(/Play as/.test(card.textContent), false);
  const h = el('div');
  drawHousePage(h, () => {}, { el, divider });
  const g = h.querySelector('.fam-grid');
  const fact = (k) => g.children[g.children.findIndex((x) => x.textContent === k) + 1]?.textContent;
  assert.deepEqual([fact('Generations'), fact('Living')], ['1', '1'], 'his house is one generation of one');
  const hall = el('div');
  drawHallPage(hall, () => {}, { el, divider });
  assert.match(hall.textContent, /Enduring - 1 generation, 3 remembered, 0 fallen/, 'the Hall too: the blood\'s generations; everyone on the tree remembered');
});
