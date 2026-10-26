// FB1018D HOME-BENCH (the Discord, #bug-reports, Cruor: "Works fine on main character, but shared account homes don't let
// other characters access their craft benches. Pls fix. I wanna enchant thingies!"). An online home is one CHARACTER's
// (`own`), and its door lets every character of the owner's account in (`mine` - net/homeLaw.js homeMayEnter,
// systems/online/onlineHomes.js homeDoorAnswer's 'enter'). The stations inside asked `own` alone (scenes/worldModes.js
// decorOwnerHere), so the account's other character walked in and was told at the enchanting station "This belongs to
// <its own account's handle>", and the Stores page found no anvil, loom or bench there. The stations now ask the door's
// owner question (onlineHomes.js homeStationsServe, the host's stationOwnerHere); the home's storage stays the owning
// character's. Driven through the real account service over node:sqlite (a home claimed by character A, the town read
// as character B of the same account and as another account's player), the real client registry over the real route
// (net/accountClient.js accountHomes, onlineHomes.js createOnlineHomes), and the host's own gate functions lifted out
// of its source and run over those rows. tools/mutants/fb1018d_homebench.json.
// ACCOUNT-HOMES (at its merge of main, 2026-10-23; asked: "House ownership should be account bound, not character
// bound"): a home is its ACCOUNT's now - B owns A's home too, its door B's own and its cupboard B's own save's (PIN MOVED
// below); the stations' one owner question stands, and serves both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

import { standService, sessionStorageOf, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { accountHomes, SESSION_KEY } from '../../src/net/accountClient.js';
import { createOnlineHomes, homeDoorAnswer, homeBelongsLine, homeStationsServe } from '../../src/systems/online/onlineHomes.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { FORGE_FEE, WORKBENCH_FEE, LOOM_FEE, MASON_FEE, JEWEL_FEE, ALCHEMY_FEE, ENCHANT_FEE } from '../../src/net/professionLaw.js';
import { PROF_STATIONS, STORES_ACT_STATIONS, stationColdLine } from '../../src/ui/professions/profPages.js';
import { VENDOR_STATION } from '../../src/net/vendorLaw.js';
import { GUILD_GROUPS } from '../../src/formats/factionFile.js';
import { isCaravanRoom } from '../../src/systems/caravanRoom.js';
import { useDecorPiece } from '../../src/systems/decor/decorUse.js';
import { decorMayStorage, decorMayStation, decorIsShared, decorStationShut, noteDecorGrants, openOwnChest } from '../../src/systems/decor/decorGrants.js';

const MAP = 7;
const HOME = 300;   // Cruor's character A's home
const HALL = 301;   // a guild's hall, Cruor's character B a member
/** The seven stations a placed piece can be, by the accessor the Stores page asks (scenes/world.js craftStation). */
const STATIONS = { forge: 'forgeHere', workbench: 'workbenchHere', loom: 'loomHere', mason: 'masonHere', jeweller: 'jewellerHere', alchemy: 'alchemyHere', enchant: 'enchantHere' };

// ─── THE HOST'S GATE, AS IT SHIPS ──────────────────────────────────
const M = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
const AST = parse(M, { ecmaVersion: 'latest', sourceType: 'module' });
/** One of the host's functions by name - a declaration, an arrow's `const`, or a method of the object it returns. */
function lift(name) {
  const walk = (n) => {
    if (!n || typeof n !== 'object') return null;
    if (n.type === 'FunctionDeclaration' && n.id?.name === name) return M.slice(n.start, n.end);
    if (n.type === 'VariableDeclarator' && n.id?.name === name && n.init?.type === 'ArrowFunctionExpression') return M.slice(n.init.start, n.init.end);
    if (n.type === 'Property' && n.key?.name === name && n.method) return `function ${M.slice(n.value.start, n.value.end)}`;
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) { for (const c of v) { const f = walk(c); if (f) return f; } } else if (v && typeof v === 'object') { const f = walk(v); if (f) return f; }
    }
    return null;
  };
  const f = walk(AST);
  assert.ok(f, `worldModes.js has ${name}`);
  return f;
}
const GATE = ['decorOwnerHere', 'stationOwnerHere', 'hallMemberHere', 'caravanGuestHere', 'caravanGuestStation', 'useDecorStation', 'activateDecor'];
const BODY = `let interiorOverlay = null;
  ${GATE.map((n) => `const ${n} = ${lift(n)};`).join('\n')}
  return { ${Object.values(STATIONS).map((n) => `${n}: ${lift(n)}`).join(', ')}, press: useDecorStation, activate: activateDecor, get slot() { return interiorOverlay; } };`;

/** The host's gate in a room - `home` the visit's latch (interiorHome), its placed pieces one of each station and a
 *  cupboard, the Stores page online. Answers the gate and what it said and opened. */
function room(home, { privateVisitRoom = null } = {}) {
  const log = { said: [], opened: [] };
  const pieces = [...Object.keys(STATIONS).map((station) => ({ id: station, station })), { id: 'cupboard', storage: true }];
  const scope = {
    mode: 'interior', interiorBuilding: { buildingType: BUILDING_TYPES.House1, buildingKey: home?.buildingKey ?? HOME, regionIndex: 17 },
    interiorHome: home, interiorCabin: null, interiorSeatHall: null, privateVisitRoom, privateVisitOwner: null, playerEntity: { houses: [] },
    interiorDecor: { list: () => pieces, pieceOf: (id) => pieces.find((p) => p.id === id) ?? null, itemsOf: () => [] },
    BUILDING_TYPES, FORGE_FEE, WORKBENCH_FEE, LOOM_FEE, MASON_FEE, JEWEL_FEE, ALCHEMY_FEE, ENCHANT_FEE, GUILD_GROUPS, VENDOR_STATION,
    PROF_STATIONS, STORES_ACT_STATIONS, stationColdLine, homeBelongsLine, homeStationsServe, isCaravanRoom,
    ownsShip: () => false, houseOwnedAt: () => false, guildGroupOfFaction: () => null, townTalk: null,
    say: (t) => log.said.push(t), forgeOffered: () => true,
    interiorKeyCtx: { togglePause: (o) => log.opened.push(['page', o.at]) },
    offerStationActs: (p) => log.opened.push(['chooser', p.station]), openStationMaker: (p) => log.opened.push(['maker', p.station]),
    openHomeVendor: () => log.opened.push(['vendor']), isHallBoard: () => false, openHallBoard: () => {}, openHallChest: () => log.opened.push(['hall chest']),
    CROWN_HALL_TEXT: { chestShut: () => 'shut' }, interiorInventory: () => ({ storage: true }),
    useDecorPiece, interiorCamps: { activate: () => log.opened.push(['fire']) }, getInteractionMode: () => 'steal', restFromInteriorBed: () => log.opened.push(['bed']),   // DECOR-USE: a placed bed's and fire's own press, ahead of the stations
    // DECOR-ACCESS: the service's grants, none heard - the gate's own law decides, as before the room's list arrives
    decorMayStorage, decorMayStation, decorIsShared, decorStationShut, openSharedChest: () => log.opened.push(['shared chest']),
    openOwnChest,
  };
  // HOME-SHARE-WAIT (FIELD BUGS 2026-10-25d): the owner's chest opens once the room's grants are heard - a room with no
  // grants door, which shares none of its chests
  noteDecorGrants({}, MAP, home?.buildingKey ?? HOME, null);
  const gate = Function(...Object.keys(scope), BODY)(...Object.values(scope));
  return { gate, log };
}

/** The town as the account service answers it: Cruor's character A holds HOME; Mara holds HALL, which is The Hand's hall
 *  with Cruor's character B a member. Each reader's registry over the real route, as the client reads it. */
async function town(t) {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const cruor = await svc.registered('Cruor');
  const mara = await svc.registered('Mara');
  const a = await svc.seatHome(cruor, { mapId: MAP, buildingKey: HOME, region: 17, price: 5000 });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  const B = await seatRealm(svc.env, cruor.secret, 'Cruor Two');   // the account's other character
  const m = await svc.seatHome(mara, { mapId: MAP, buildingKey: HALL, region: 17, price: 5000 });
  assert.equal(m.status, 200, JSON.stringify(m.body));
  const raw = svc.env.DB._raw;
  raw.prepare('INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES (?, ?, ?, ?, ?, ?)').run('g1', 'The Hand', 'the hand', 'HND', '[]', T0);
  raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(cruor.id, B.id, 'g1', 3, 'Cruor Two', T0);
  raw.prepare('UPDATE homes SET guild_id = ? WHERE map_id = ? AND building_key = ?').run('g1', MAP, HALL);
  const reader = async (who, character) => {
    const homes = createOnlineHomes({ api: accountHomes({ fetch: svc.fetch, storage: sessionStorageOf(SESSION_KEY, who) }), character: () => character });
    assert.equal(await homes.ensure(MAP), true, 'the town answered');
    return homes;
  };
  return { svc, cruor, mara, A: a.character, B: B.id, Mara: m.character, reader };
}

test('FB1018D HOME-BENCH THE DOOR AND THE STATION ASK ONE OWNER: through the real service and the real registry - Cruor\'s character A\'s home, read as A, is A\'s own; read as B, Cruor\'s other character, it is B\'s own too (ACCOUNT-HOMES: a home is its account\'s), and its stations serve B as they serve A (homeStationsServe); read as Mara, another account, its door is shut until Cruor opens it to anyone, and its stations never serve her; a guild\'s hall is nobody\'s `mine`, whoever reads it (mutants: the station asks `own` alone; the law turned round)', async (t) => {
  const { svc, cruor, A, B, Mara, mara, reader } = await town(t);
  const asA = (await reader(cruor, A)).homeAt(MAP, HOME);
  const asB = (await reader(cruor, B)).homeAt(MAP, HOME);
  assert.deepEqual([asA.own, asA.mine, homeDoorAnswer(asA), homeStationsServe(asA)], [true, true, 'own', true], 'the owning character');
  // PIN MOVED (ACCOUNT-HOMES): the account's other character owns the home as well - its door is its own
  assert.deepEqual([asB.own, asB.mine, asB.owner, homeDoorAnswer(asB)], [true, true, 'Cruor', 'own'], 'the account\'s other character: its own home too (ACCOUNT-HOMES)');
  assert.equal(homeStationsServe(asB), true, 'THE REPORT: the door lets B in as the owner\'s, and the station serves B as the owner\'s');
  const shut = (await reader(mara, Mara)).homeAt(MAP, HOME);
  assert.deepEqual([shut.own, shut.mine, homeDoorAnswer(shut), homeStationsServe(shut)], [false, false, 'locked', false], 'another account: shut, and no station of hers');
  assert.equal((await svc.call('/v1/homes/entry', { mapId: MAP, buildingKey: HOME, entry: 'public' }, cruor.secret)).status, 200);
  const open = (await reader(mara, Mara)).homeAt(MAP, HOME);
  assert.deepEqual([homeDoorAnswer(open), homeStationsServe(open)], ['enter', false], 'opened to anyone: a visitor walks in, and the stations stay the owner\'s account\'s');
  for (const [who, char] of [[cruor, A], [cruor, B], [mara, Mara]]) {
    const hall = (await reader(who, char)).homeAt(MAP, HALL);
    assert.ok(hall.hall, 'the hall');
    assert.equal(homeStationsServe(hall), false, `a hall is nobody's mine - its members' stations are hallMemberHere's (${char})`);
  }
  assert.equal(homeStationsServe(null), false, 'no online home: Daggerfall\'s own house law (decorOwnerHere)');
});

test('FB1018D HOME-BENCH THE HOST\'S GATE: the host\'s own functions over the service\'s rows - in Cruor\'s character A\'s home, every station (the forge, the workbench, the loom, the mason\'s and the jeweller\'s benches, the alchemy and the enchanting stations) serves Cruor\'s other character B at no fee, and B\'s press opens it saying nothing, as A\'s does; the cupboard is each one\'s own (ACCOUNT-HOMES: its things in each one\'s own save); Mara, let in by an open door, is told whose home it is and served no station; a private visit is served none; a hall\'s stations serve its member B and not Cruor\'s A (mutants: the station asks decorOwnerHere; each accessor asks decorOwnerHere; the private visit unread; the press asks decorOwnerHere; the account\'s clause anded)', async (t) => {
  const { svc, cruor, A, B, Mara, mara, reader } = await town(t);
  assert.equal((await svc.call('/v1/homes/entry', { mapId: MAP, buildingKey: HOME, entry: 'public' }, cruor.secret)).status, 200);
  const rows = { A: (await reader(cruor, A)).homeAt(MAP, HOME), B: (await reader(cruor, B)).homeAt(MAP, HOME), Mara: (await reader(mara, Mara)).homeAt(MAP, HOME) };
  for (const who of ['A', 'B']) {
    const { gate, log } = room(rows[who]);
    for (const [station, here] of Object.entries(STATIONS)) assert.deepEqual(gate[here](), { kind: 'home', fee: 0 }, `${who} at the home's ${station}`);
    gate.press({ station: 'enchant' });
    gate.press({ station: 'forge' });
    assert.deepEqual(log.said, [], `${who} is told nothing`);
    assert.deepEqual(log.opened, [['chooser', 'enchant'], ['page', 'stores']], `${who}: the enchanting station's chooser (the item maker, Disenchant), the forge's Stores page`);
    gate.activate('cupboard');
    // PIN MOVED (ACCOUNT-HOMES): every character of the account owns the home, so the cupboard is each one's own storage -
    // its things in that character's own save (HOME1's scene, kept per save)
    assert.deepEqual([gate.slot, log.said], [{ storage: true }, []], `the cupboard is ${who}'s own storage`);
  }
  const visitor = room(rows.Mara);
  for (const [station, here] of Object.entries(STATIONS)) assert.equal(visitor.gate[here](), null, `a visitor at the ${station}`);
  visitor.gate.press({ station: 'enchant' });
  assert.deepEqual([visitor.log.said, visitor.log.opened], [['This belongs to Cruor.'], []], 'a visitor is told whose home it is, and nothing opens');
  const privately = room(rows.B, { privateVisitRoom: 'owned:x' });
  for (const here of Object.values(STATIONS)) assert.equal(privately.gate[here](), null, 'a private visit is served no station');
  // the hall: its member's stations by hallMemberHere, and the owner's account's clause takes nothing of it
  const hallB = room((await reader(cruor, B)).homeAt(MAP, HALL));
  assert.deepEqual(hallB.gate.enchantHere(), { kind: 'home', fee: 0 }, 'a hall\'s member');
  const hallA = room((await reader(cruor, A)).homeAt(MAP, HALL));
  assert.equal(hallA.gate.enchantHere(), null, 'not a member of the hall');
  hallA.gate.press({ station: 'enchant' });
  assert.deepEqual([hallA.log.said, hallA.log.opened], [['This belongs to The Hand.'], []]);
});

test('FB1018D HOME-BENCH + ACCOUNT-HOMES A KNIGHT\'S DEED: the one home the account\'s other character does not own - in character A\'s house the realm gave (`deed`), B walks in as the owner\'s (`mine`), every station serves B as the door\'s owner and B\'s press opens it, and the cupboard is not B\'s ("This belongs to Cruor."): the deed is its knight\'s alone (mutants: the station asks `own`, or the decorator\'s owner, or both; the storage shared)', async (t) => {
  const { svc, cruor, B, reader } = await town(t);
  svc.env.DB._raw.prepare('UPDATE homes SET deed = 1 WHERE map_id = ? AND building_key = ?').run(MAP, HOME);
  const asB = (await reader(cruor, B)).homeAt(MAP, HOME);
  assert.deepEqual([asB.own, asB.mine, asB.deed, homeDoorAnswer(asB), homeStationsServe(asB)], [false, true, true, 'enter', true], 'the knight\'s house: the account\'s, not B\'s own');
  const { gate, log } = room(asB);
  for (const [station, here] of Object.entries(STATIONS)) assert.deepEqual(gate[here](), { kind: 'home', fee: 0 }, `B at the deed house's ${station}`);
  gate.press({ station: 'enchant' });
  assert.deepEqual([log.said, log.opened], [[], [['chooser', 'enchant']]], 'B is told nothing, and the chooser opens');
  gate.activate('cupboard');
  assert.deepEqual([gate.slot, log.said], [null, ['This belongs to Cruor.']], 'the cupboard is the knight\'s - its things in the knight\'s save');
});

test('FB1018D HOME-BENCH THE DOOR\'S OTHER VISITORS (AUDIT FB1018D L1-3): Cruor opens A\'s home to its guild, and Mara\'s character, in that guild, is let in as a guildmate; Mara\'s character renting a room there is let in as a tenant - and neither is the owner\'s account, so neither is served a station: homeStationsServe false, every accessor null, the press told whose home it is (mutants: a guildmate served; a tenant served)', async (t) => {
  const { svc, cruor, A, Mara, mara, reader } = await town(t);
  const raw = svc.env.DB._raw;
  raw.prepare('INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES (?, ?, ?, ?, ?, ?)').run('g2', 'The Hearth', 'the hearth', 'HTH', '[]', T0);
  for (const [who, char, name] of [[cruor, A, 'Cruor'], [mara, Mara, 'Mara']]) {
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(who.id, char, 'g2', 3, name, T0);
  }
  assert.equal((await svc.call('/v1/homes/entry', { mapId: MAP, buildingKey: HOME, entry: 'guild' }, cruor.secret)).status, 200);
  const mate = (await reader(mara, Mara)).homeAt(MAP, HOME);
  assert.deepEqual([mate.mine, mate.guildmate, homeDoorAnswer(mate), homeStationsServe(mate)], [false, true, 'enter', false], 'a guildmate: let in, and no station of hers');
  assert.equal((await svc.call('/v1/homes/entry', { mapId: MAP, buildingKey: HOME, entry: 'private' }, cruor.secret)).status, 200);
  raw.prepare("INSERT INTO home_rooms (map_id, building_key, room, anchor, price, listed, tenant, tenant_char, until) VALUES (?, ?, 1, 'a', 10, 1, ?, ?, ?)").run(MAP, HOME, mara.id, Mara, T0 + 86_400);
  const tenant = (await reader(mara, Mara)).homeAt(MAP, HOME);
  assert.deepEqual([tenant.mine, tenant.tenant > 0, homeDoorAnswer(tenant), homeStationsServe(tenant)], [false, true, 'enter', false], 'a tenant: let in, and no station of hers');
  for (const [who, row] of [['the guildmate', mate], ['the tenant', tenant]]) {
    const { gate, log } = room(row);
    for (const [station, here] of Object.entries(STATIONS)) assert.equal(gate[here](), null, `${who} at the ${station}`);
    gate.press({ station: 'forge' });
    assert.deepEqual([log.said, log.opened], [['This belongs to Cruor.'], []], `${who} is told whose home it is, and nothing opens`);
  }
});
