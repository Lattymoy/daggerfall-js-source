// ARENA4b (2026-10-03, Arena.md 2: "Purses in gold ... Online, renown too, within the renown law's own hourly cap"): A
// WON BOUT'S RENOWN - the account service over node:sqlite with every migration (test/accountDb.mjs), the relay's
// receipts signed with the relay's own key; the claim's carrier on the client (net/arenaClaims.js) and the host's
// wiring by source. server-account/src/arena.js arenaRenownXp / arenaRenownFor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from './accountDb.mjs';
import { mintArenaReceipt } from '../src/net/arenaReceipt.js';
import { verifyOrder } from '../src/net/identityToken.js';
import { renownXpFor, RENOWN_XP_HOUR_MAX, renownRaidXp, renownQuestXp } from '../src/net/renown.js';
import { arenaRenownXp, ARENA_RENOWN_TIER_LEVEL, ARENA_RENOWN_QUESTS, ARENA_RENOWN_REGION } from '../server-account/src/arena.js';
import { ARENA_REGION } from '../src/world/arenaCity.js';
import { createArenaClaims, ARENA_CLAIMS_KEY, arenaKeptReceipt } from '../src/net/arenaClaims.js';
import { accountArena, SESSION_KEY } from '../src/net/accountClient.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { ARENA_PAIR_DAY_MAX } from '../src/net/arenaLaw.js';

const { subtle } = globalThis.crypto;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
let _bout = 0;
const boutId = () => (0xb000 + ++_bout).toString(16).padStart(16, '0');
const ladder = (S, who, tier, step, won = 1, j = boutId()) => mintArenaReceipt({ a: 'l', j, s: who.id, q: tier, u: step, r: won, h: 'fall' }, S.gatePriv, { subtle, nowS: T0 });
const players = (S, a, b, r, j = boutId()) => mintArenaReceipt({ a: 'p', j, f: [a.id, b.id], r, h: 'fall' }, S.gatePriv, { subtle, nowS: T0 });
const claim = (S, who, receipt, extra = { character: who.character, name: who.handle }) => S.call('/v1/arena/claim', { receipt, ...extra }, who.secret);
const trackOf = (S, who) => S.env.DB._raw.prepare('SELECT xp FROM renown_tracks WHERE player = ? AND char_id = ?').get(who.id, who.character)?.xp ?? 0;

test('ARENA4b the scale: a bout pays as a quest at its tier\'s level - one, a champion two, the Grand Champion three, a rated players\' win one at the ladder\'s top - read no higher than three over the Renown; Daggerfall\'s region (mutants: the champion paid as a bout; the ceiling not read; the tier\'s level off by one)', () => {
  assert.deepEqual([0, 4, 9].map(ARENA_RENOWN_TIER_LEVEL), [3, 11, 21], 'the design table\'s top level of each tier');
  assert.deepEqual(ARENA_RENOWN_QUESTS, { bout: 1, champion: 2, grand: 3, pvp: 1 });
  assert.equal(ARENA_RENOWN_QUESTS.grand * renownQuestXp(30), renownRaidXp(), 'the Grand Champion is a raid\'s three quests');
  assert.equal(arenaRenownXp({ kind: 'ladder', tier: 0, step: 0 }, 30), 165);
  assert.equal(arenaRenownXp({ kind: 'ladder', tier: 9, step: 2 }, 30), 705);
  assert.equal(arenaRenownXp({ kind: 'ladder', tier: 4, step: 3 }, 30), 2 * 405, 'a tier\'s champion two quests');
  assert.equal(arenaRenownXp({ kind: 'ladder', tier: 9, step: 3 }, 30), 2115, 'the Grand Champion three');
  assert.equal(arenaRenownXp({ kind: 'pvp' }, 30), 975);
  assert.equal(arenaRenownXp({ kind: 'ladder', tier: 9, step: 2 }, 1), 195, 'Renown 1 reads every bout past the Pit at level 4');
  assert.equal(arenaRenownXp({ kind: 'ladder', tier: 9, step: 3 }, 1), 585);
  assert.equal(arenaRenownXp({ kind: 'pvp' }, 1), 195);
  assert.equal(ARENA_RENOWN_REGION, ARENA_REGION, 'every bout is fought in Daggerfall');
});

test('ARENA4b a ladder win pays the claiming character, once - a loss and a claim naming no character pay none; a level that rises comes with a signed renown order, as a writ\'s does; the answer\'s Renown is the report\'s own (mutants: a loss paid; paid on the receipt claimed again; the order unsigned)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const a = await S.registered('Aldric');
  const r = await claim(S, a, await ladder(S, a, 0, 0));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.recorded, true);
  assert.deepEqual([r.body.renown.character, r.body.renown.credited, r.body.renown.xp, r.body.renown.level, r.body.renown.rose], [a.character, 165, 165, 2, true]);
  const ord = await verifyOrder(r.body.order, S.identityPublic, { subtle, nowS: T0, kind: 'renown' });
  assert.ok(ord.ok, ord.why);
  assert.deepEqual([ord.claims.s, ord.claims.lv], [a.id, 2], 'the rise rides a signed order');
  assert.equal(trackOf(S, a), 165);
  const again = await claim(S, a, await ladder(S, a, 0, 1, 1, 'b'.repeat(16)));
  assert.deepEqual([again.body.renown.credited, again.body.renown.level], [165, 3]);
  const vet = await S.registered('Vera', { renown: 30 });
  const steady = await claim(S, vet, await ladder(S, vet, 0, 0));
  assert.deepEqual([steady.body.renown.credited, steady.body.renown.rose], [165, false]);
  assert.equal('order' in steady.body, false, 'no rise, no order - the writ\'s own answer');
  const twice = await claim(S, a, await ladder(S, a, 0, 1, 1, 'b'.repeat(16)));
  assert.deepEqual([twice.body.recorded, twice.body.why, twice.body.renown], [false, 'claimed', undefined], 'once a bout');
  const lost = await claim(S, a, await ladder(S, a, 0, 2, 0));
  assert.deepEqual([lost.body.recorded, lost.body.renown], [true, undefined], 'a loss is kept and pays none');
  const bare = await claim(S, a, await ladder(S, a, 0, 2), {});
  assert.deepEqual([bare.body.recorded, bare.body.renown], [true, undefined], 'an older build names no character: kept, unpaid');
  assert.equal(trackOf(S, a), 330);
  assert.equal(S.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM arena_renown WHERE player = ?').get(a.id).n, 2, 'one row a won bout');
});

test('ARENA4b a players\' bout: the winner is paid whoever claimed first - the loser, a draw and a bout kept unrated past the pair\'s day pay none (mutants: paid only on the recording claim; the loser paid; an unrated win paid; a draw paid)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const a = await S.registered('Aldric', { renown: 30 });
  const b = await S.registered('Bran', { renown: 30 });
  const rc = await players(S, a, b, 0);
  const first = await claim(S, b, rc);
  assert.deepEqual([first.body.recorded, first.body.result, first.body.renown], [true, 'lost', undefined], 'the loser claims first, unpaid');
  const second = await claim(S, a, rc);
  assert.deepEqual([second.body.recorded, second.body.why, second.body.result], [false, 'claimed', 'won']);
  assert.equal(second.body.renown.credited, 975, 'the winner is paid on the bout another carried first');
  assert.equal((await claim(S, a, rc)).body.renown, undefined, 'and once');
  const draw = await players(S, a, b, 2);
  assert.equal((await claim(S, a, draw)).body.renown, undefined, 'a draw pays none');
  for (let i = 0; i < ARENA_PAIR_DAY_MAX; i++) await claim(S, b, await players(S, a, b, 1));
  const unrated = await players(S, a, b, 0);
  const u = await claim(S, a, unrated);
  assert.deepEqual([u.body.rated, u.body.renown], [false, undefined], 'past the pair\'s day: kept, not rated, unpaid');
  assert.equal(trackOf(S, a) - renownXpFor(30), 975, 'Aldric: the one rated win');
  assert.equal(trackOf(S, b) - renownXpFor(30), 3 * 975, 'Bran: his three wins inside the pair\'s day, none past it');
});

test('ARENA4b within the renown law\'s own hour: a bout the account\'s hour has nearly spent is paid what is left, and still counted (mutants: the credit not the report\'s own)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const a = await S.registered('Aldric', { renown: 30 });
  S.env.DB._raw.prepare('UPDATE players SET renown_hour = ?, renown_hour_xp = ? WHERE id = ?').run(Math.floor(T0 / 3600), RENOWN_XP_HOUR_MAX - 50, a.id);
  const r = await claim(S, a, await ladder(S, a, 0, 0));
  assert.deepEqual([r.body.recorded, r.body.renown.credited], [true, 50], 'the hour\'s remainder, no more');
  const full = await claim(S, a, await ladder(S, a, 0, 1));
  assert.deepEqual([full.body.recorded, full.body.renown.credited], [true, 0], 'the hour spent: counted, paid nothing');
});

test('ARENA4b the carrier: a receipt kept with the fighter standing here as it came in, offered with that character and its name, an answer\'s Renown told whether it counted now or before; a receipt from before ARENA4b offered bare (mutants: the playing character offered instead of the fighter; the Renown untold on a bout claimed before)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  const nowS = Math.floor(Date.now() / 1000);
  const r1 = await mintArenaReceipt({ a: 'p', j: 'c'.repeat(16), f: ['acct-a', 'acct-b'], r: 0, h: 'fall' }, priv, { subtle, nowS });
  const r0 = await mintArenaReceipt({ a: 'l', j: 'd'.repeat(16), s: 'acct-a', q: 0, u: 0, r: 1, h: 'fall' }, priv, { subtle, nowS });
  const store = new Map([[ARENA_CLAIMS_KEY, [r0]]]);   // a build before ARENA4b kept it bare
  const asked = [], renown = [];
  let playing = 'r-fighter';
  const C = createArenaClaims({
    claim: async (r, c, n) => { asked.push([r, c, n]); return { ok: true, data: { recorded: false, why: 'claimed', kind: 'pvp', result: 'won', renown: { character: c, credited: 975 } } }; },
    store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, me: () => 'acct-a',
    character: () => playing, name: () => 'Aldric', onRenown: (d) => renown.push(d),
  });
  const kept = new Promise((res) => setTimeout(res, 0));
  C.add(r1);
  playing = 'r-another';   // the player changed character before the offer landed
  await kept; await C.flush();
  assert.deepEqual(asked.find((x) => x[0] === r1), [r1, 'r-fighter', 'Aldric'], 'the fighter, kept with it');
  assert.deepEqual(asked.find((x) => x[0] === r0), [r0, null, null], 'a bare receipt offered as before');
  assert.equal(renown.length >= 2, true, 'each answer\'s Renown told - a bout claimed before still pays its winner');
  assert.equal(renown[0].renown.credited, 975);
  assert.deepEqual(store.get(ARENA_CLAIMS_KEY), [], 'settled');
  assert.equal(arenaKeptReceipt({ r: r1, c: 'x' }), r1);
  // the door posts the fighter
  const bodies = [];
  const door = accountArena({ fetch: async (u, i) => { bodies.push(JSON.parse(i.body)); return new Response('{"recorded":true}', { status: 200 }); }, storage: { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 's', id: 'acct-a' }) : null) } });
  await door.claim('a1.x.y', 'r-fighter', 'Aldric');
  await door.claim('a1.x.y');
  assert.deepEqual(bodies, [{ receipt: 'a1.x.y', character: 'r-fighter', name: 'Aldric' }, { receipt: 'a1.x.y' }]);
});

test('ARENA4b the host: arenaOnline hands its claims the fighter and the Renown hook; world.js adopts a won bout\'s Renown by the one plan, only for the fighting character, and the service credits a pledged war-guild in Daggerfall\'s region (mutants: the character check dropped; the order not carried; the influence unasked)', () => {
  const o = read('src/scenes/arenaOnline.js');
  assert.ok(o.includes('claim: async (r, c, n) => { const a = await deps.account.claim(r, c, n); answered(r, a); return a; }'), 'the fighter rides the claim (PIN MOVED at the merge of the client stream: the claim\'s answer also settles the held purse, arenaOnline.js answered)');
  assert.ok(o.includes('character: () => deps.character?.() ?? null, name: () => deps.characterName?.() ?? null, onRenown: (d) => deps.onRenown?.(d)'));
  const w = read('src/scenes/world.js');
  const glue = w.slice(w.indexOf('inBout: () => arenaBouts.holds(),'), w.indexOf('inBout: () => arenaBouts.holds(),') + 1400);
  assert.ok(glue.includes('character: () => characterIdOf(playerEntity)'));
  assert.ok(glue.includes('if (d?.renown?.character !== characterIdOf(playerEntity)) return;'), 'RENOWN-CHAR: the fighting character\'s track');
  assert.ok(glue.includes('renownAnswer({ ...d.renown, order: d.order ?? null }, d.renown.credited ?? 0, renownSaid)'), 'the one plan');
  assert.ok(glue.includes('if (a.order) online?.sendRenownOrder?.(a.order, a.level);'), 'the order carried to the rooms');
  const svc = read('server-account/src/index.js');
  const route = svc.slice(svc.indexOf("if (path === '/v1/arena/claim'"), svc.indexOf("if (path === '/v1/arena/board'"));
  assert.ok(route.includes('creditRenown(ctx, who.player, env, { character: body.character, region: ARENA_RENOWN_REGION, xp: r.renown.credited })'));
  assert.ok(route.includes('const order = key ? await mintRenownOrder({ s: who.player.id, lv: r.renown.level }'));
});
