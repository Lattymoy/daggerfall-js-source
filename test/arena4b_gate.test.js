// ARENA4b (2026-10-03): THE GATE AND THE CLIMB ONLINE, DRIVEN - the account is the law while the arena online is live:
// the recruiters read and write the ACCOUNT's banner (scenes/arenaGate.js recruiterChoiceOnline / recruiter, scenes/
// arenaOnline.js team - the service's own words when it refuses, the save's league untouched), the Herald's choice reads
// the account's climb and banner (arenaGate.heraldChoice, both hosts' Herald), Fight waits for the account's climb and a
// ladder purse is paid only for the bout the account was owed (arenaOnline.fightLadder / climb / owe, the claims'
// answers), the pause window's banner and the Keeper of the Hall read the account's and the realm's (arenaGate.joined /
// hall); offline all of it ARENA3's. Mac, 2026-10-02: "join a team (red and blue) and climb esclating tiers of opponents".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createArenaGate, recruiterChoiceOnline } from '../src/scenes/arenaGate.js';
import { createArenaOnline, CLIMB_WAIT_MS } from '../src/scenes/arenaOnline.js';
import { createArenaBouts } from '../src/scenes/arenaBouts.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { arenaLadderOf, ARENA_FLOOR_CENTRE } from '../src/net/arenaLaw.js';
import { mintArenaReceipt } from '../src/net/arenaReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import * as LG from '../src/systems/arenaLeague.js';
import { newArenaLadder, LADDER_TIERS } from '../src/systems/arenaLadder.js';
import { hallLinesOnline } from '../src/systems/arenaBoard.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const O = ARENA_TEXT.online, R = ARENA_TEXT.recruiter, T = ARENA_TEXT.teams, H = ARENA_TEXT.herald;
const gm = 523530 - (523530 % MINUTES_PER_DAY) + 40 * MINUTES_PER_DAY + 12 * 60;
const settle = () => new Promise((r) => setTimeout(r, 0));
const climbOf = (n) => arenaLadderOf(Array.from({ length: n }, (_, k) => ({ tier: Math.floor(k / 4), bout: k % 4 })));
const boardOf = (me = {}, extra = {}) => ({ season: 5, day: 9, team: { standings: { red: 12, blue: 30 }, laurel: 'blue', last: { season: 4, red: 1, blue: 9, winner: 'blue' } }, hall: [{ name: 'Ivo', at: 1_800_000_000 }], me: { ladder: climbOf(5), banner: null, left: null, leftSeason: null, points: 0, ...me }, ...extra });

/** The arena online over a fake session and a fake account service whose answers the test sets. */
function onlineOf({ board = boardOf(), guest = false, team = null } = {}) {
  const svc = { board, boardCalls: 0, teamCalls: [], claimAnswer: null, claims: [], boardHold: null, claimHold: null };
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  const said = [];
  const asked = [];
  let t = 0;
  const A = createArenaOnline({
    now: () => t, session: () => session, makeHall: () => null, say: (l) => said.push(l), guest: () => guest,
    bouts: { ask: (p) => asked.push(p), relayWord: () => true, dismiss() {}, holds: () => false, setRealm() {} },
    account: {
      board: async () => { svc.boardCalls++; if (svc.boardHold) await svc.boardHold; return svc.board ? { ok: true, data: svc.board } : { ok: false, error: 'offline' }; },
      claim: async (r) => { svc.claims.push(r); if (svc.claimHold) await svc.claimHold; return svc.claimAnswer; },
      team: async (b) => {
        svc.teamCalls.push(b);
        if (team) return team(b);
        const was = svc.board.me.banner;   // the service's own roll moves with it
        svc.board = { ...svc.board, me: { ...svc.board.me, banner: b, ...(b === null ? { left: was, leftSeason: svc.board.season } : {}) } };
        return { ok: true, data: { ok: true, banner: b } };
      },
      me: () => 'acct-alva',
    },
    enterFloor: () => true, level: () => 12, maxHealth: () => 140, inBout: () => false,
  });
  return { A, svc, session, said, asked, step: (ms) => { t += ms; } };
}

test('ARENA4b the recruiters online: the choice is the account\'s membership and the realm\'s season (join, yours, the other\'s, a season\'s wait, a guest, the roll not yet in); joining and quitting are the account\'s at the service - its own words when it refuses - and the save\'s league is never touched; the welcome and the Team page once the service took it (mutants: the save\'s league gating online; the save written online; the welcome before the service; a guest offered a banner)', async () => {
  // the pure choice
  const ch = (me, o = {}) => recruiterChoiceOnline({ banner: 'red', board: boardOf(me), ...o });
  const acts = (c) => c.options.filter((x) => x.label).map((x) => x.act);
  assert.deepEqual(acts(ch({})), ['join', 'window', 'leave']);
  assert.ok(ch({}).lines.includes(`${O.seasonLine(5, 9)}.`) && ch({}).lines.includes(T.standing(12, 30)), 'the realm\'s season and standing');
  assert.deepEqual(acts(ch({ banner: 'red', points: 4 })), ['quit', 'window', 'leave']);
  assert.ok(ch({ banner: 'red', points: 4 }).lines.includes(T.given(4)));
  assert.ok(ch({ banner: 'blue' }).lines.includes(R.theirs(T.the.blue)) && !acts(ch({ banner: 'blue' })).includes('join'));
  assert.ok(ch({ left: 'blue', leftSeason: 5 }).lines.includes(R.wait(T.the.blue)) && !acts(ch({ left: 'blue', leftSeason: 5 })).includes('join'), 'the other banner a season\'s wait');
  assert.ok(acts(ch({ left: 'blue', leftSeason: 4 })).includes('join'), 'a season on, the wait is over');
  assert.ok(acts(ch({ left: 'red', leftSeason: 5 })).includes('join'), 'the banner quit takes you back at once');
  assert.ok(ch({}, { guest: true }).lines.includes(O.guestBanner) && !acts(ch({}, { guest: true })).includes('join'));
  const blind = recruiterChoiceOnline({ banner: 'red', board: null });
  assert.ok(blind.lines.includes(O.rollWait) && !acts(blind).includes('join'));
  assert.ok(recruiterChoiceOnline({ banner: 'blue', board: boardOf({ banner: 'blue' }) }).lines.includes(T.laurelYou), 'the laurel worn');
  // the gate, online: a save whose league would refuse the Red (it quit it this year) - the account's law joins it
  const save = LG.quitBanner(LG.joinBanner(LG.newArenaLeague(), 'blue', gm).league, gm).league;
  const P = { name: 'Alva', arenaLeague: save };
  const before = JSON.stringify(P.arenaLeague);
  const N = onlineOf();
  N.A.model();
  await settle();
  const shown = [], said = [], opened = [];
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: (w) => shown.push(w), say: (l) => said.push(l), openWindow: (p) => opened.push(p), online: () => N.A });
  assert.equal(LG.joinRefusal(LG.rollLeague(save, gm), 'red', gm), 'season', 'the save\'s own law would refuse it');
  gate.recruiter('redRecruiter');
  assert.ok(shown.at(-1).options.some((o) => o.code === 'KeyJ'), 'online the account\'s membership is the law');
  let release;
  N.svc.boardHold = new Promise((r) => { release = r; });
  shown.at(-1).input('KeyJ');
  assert.deepEqual([said, opened], [[], []], 'nothing said before the service answers');
  await settle();
  assert.deepEqual(N.svc.teamCalls, ['red']);
  assert.deepEqual(said, [R.joined(T.the.red)]);
  assert.deepEqual(opened, ['team']);
  assert.equal(N.A.board().me.banner, 'red', 'the board shows it at once - before the service\'s next board');
  release(); N.svc.boardHold = null;
  await settle(); await settle();
  assert.equal(JSON.stringify(P.arenaLeague), before, 'the save\'s league untouched');
  assert.equal(gate.joined(), true, 'the pause window\'s door: the account\'s banner');
  // quit: asked twice, then the service
  gate.recruiter('redRecruiter');
  shown.at(-1).input('KeyQ');
  shown.at(-1).input('KeyY');
  await settle();
  assert.deepEqual(N.svc.teamCalls, ['red', null]);
  assert.equal(said.at(-1), R.quitDone(T.the.red));
  assert.deepEqual([N.A.board().me.banner, N.A.board().me.left, N.A.board().me.leftSeason], [null, 'red', 5]);
  assert.equal(JSON.stringify(P.arenaLeague), before);
  // a refusal: the service's own words, no welcome
  const N2 = onlineOf({ team: () => ({ ok: false, error: 'joined' }) });
  N2.A.model();
  await settle();
  const said2 = [];
  const g2 = createArenaGate({ playerEntity: { arenaLeague: null }, gameMinutes: () => gm, showOverlay: (w) => shown.push(w), say: (l) => said2.push(l), openWindow: () => {}, online: () => N2.A });
  g2.recruiter('blueRecruiter');
  shown.at(-1).input('KeyJ');
  await settle();
  assert.deepEqual(N2.said, [accountRefusalText('joined')], 'the service\'s words');
  assert.deepEqual(said2, [], 'no welcome');
  // a guest asks the service nothing
  const N3 = onlineOf({ guest: true });
  assert.deepEqual(await N3.A.team('red'), { ok: false, error: 'guest' });
  assert.deepEqual([N3.svc.teamCalls, N3.said], [[], [O.guestBanner]]);
  // offline: ARENA3's, the save's league written
  const P4 = { arenaLeague: null };
  const g4 = createArenaGate({ playerEntity: P4, gameMinutes: () => gm, showOverlay: (w) => shown.push(w), say: () => {}, openWindow: () => {} });
  g4.recruiter('redRecruiter');
  shown.at(-1).input('KeyJ');
  assert.equal(P4.arenaLeague.team, 'red');
  assert.equal(g4.joined(), true);
});

test('ARENA4b the Herald\'s choice online: the account\'s climb - his line its next bout, Fight its; "the ladder done" the account\'s; its banner under the realm\'s laurel; before the realm\'s records are in no Fight and his line says why; the window\'s Fight waits the same; offline the save\'s (mutants: the save\'s ladder online; Fight offered on an unknown climb; the ladder done read from the save)', async () => {
  const P = { name: 'Alva', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), arenaLeague: LG.joinBanner(LG.newArenaLeague(), 'red', gm).league };
  const N = onlineOf({ board: boardOf({ ladder: climbOf(5), banner: 'blue' }, { team: { standings: { red: 1, blue: 2 }, laurel: 'red' } }) });
  const herald = [];
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: () => {}, heraldAct: (a) => herald.push(a), atGate: () => true, online: () => N.A });
  // the board not yet in: no Fight, the line says why, and the board is asked
  let ch = gate.heraldChoice({ cityBout: null });
  assert.ok(!ch.options.some((o) => o.act === 'fight'), 'no Fight on an unknown climb');
  assert.ok(ch.lines.includes(O.climbWait));
  assert.ok(!ch.lines.some((l) => l.startsWith('Your next bout')), 'never the empty climb\'s Pit');
  assert.deepEqual(gate.windowAct('fight'), { ok: false, text: O.climbWait }, 'the window\'s Fight waits too');
  assert.deepEqual(herald, []);
  await settle();
  assert.ok(N.svc.boardCalls >= 1, 'asked');
  // the account's climb: five bouts won - the Pit's champion beaten, Bloodied's second bout next
  ch = gate.heraldChoice({ cityBout: null });
  const t1 = LADDER_TIERS[1];
  assert.ok(ch.lines.includes(H.ladderNext(ARENA_TEXT.tiers[1], ARENA_TEXT.boutLabel(2))), ch.lines.join(' | '));
  assert.ok(ch.lines.includes(H.title(ARENA_TEXT.titles[0])), 'the account\'s title');
  assert.ok(ch.lines.includes(T.under(T.the.blue)) && !ch.lines.includes(T.under(T.the.red)), 'the account\'s banner, not the save\'s');
  assert.ok(ch.options.some((o) => o.act === 'fight'));
  assert.equal(ch.next.tier, 1);
  void t1;
  assert.deepEqual(gate.windowAct('fight'), { ok: true, text: '' });
  assert.deepEqual(herald, ['fight']);
  // the laurel the account's banner wears
  N.A.board().team.laurel = 'blue';
  assert.ok(gate.heraldChoice({}).lines.includes(T.laurelYou));
  // the account's ladder done
  N.A.board().me.ladder = climbOf(40);
  ch = gate.heraldChoice({});
  assert.ok(ch.lines.includes(H.ladderDone) && !ch.options.some((o) => o.act === 'fight'));
  assert.deepEqual(gate.windowAct('fight'), { ok: false, text: H.ladderDone });
  // offline: the save's (its fresh climb, its Red Banner)
  const off = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: () => {}, atGate: () => true });
  ch = off.heraldChoice({});
  assert.ok(ch.lines.includes(H.ladderNext(ARENA_TEXT.tiers[0], ARENA_TEXT.boutLabel(1))) && ch.lines.includes(T.under(T.the.red)));
  // the hosts hand the Herald to the gate
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const S = rd(f);
    assert.match(S, /const ch = arenaGate\.heraldChoice\(\{ cityBout: sand, healthShare: /, `${f}: the Herald's choice is the gate's`);
    assert.match(S, /arenaHall: \(\) => arenaGate\.hall\(\),/, `${f}: the Keeper's door`);
    assert.match(S, /arenaJoined: \(\) => arenaGate\.joined\(\),   \/\/ ARENA4b/, `${f}: the modes' banner`);
  }
  assert.match(rd('src/scenes/worldModes.js'), /if \(!info && pn\?\.arenaRole === 'hallKeeper' && host\.arenaHall\?\.\(\)\) return;/, 'the Keeper asks the host first');
});

test('ARENA4b the ladder online waits for the account\'s climb and pays only what the account was owed: Fight refused until the board is in (and asked), the account\'s next bout after; a win\'s purse held until the service keeps it - paid then, with the crowd\'s favour; a win out of the climb\'s order not paid, the realm\'s words said, the climb the service answered taken; an answer before the verdict pays too; a win still with the service holds the next Fight, a while at most; a forced ask while one is out asked again (mutants: the empty climb fought; the purse paid at the verdict; a refused win paid; the pending win ignored; the second ask dropped)', async () => {
  const kp = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(new Uint8Array(await globalThis.crypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle: globalThis.crypto.subtle });
  const receipt = (j, q, u) => mintArenaReceipt({ a: 'l', j, s: 'acct-alva', q, u, r: 0, h: 'fall' }, priv, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
  const N = onlineOf({ board: boardOf({ ladder: climbOf(1) }) });
  let release;
  N.svc.boardHold = new Promise((r) => { release = r; });
  assert.deepEqual(N.A.fightLadder(), { ok: false, text: O.climbWait }, 'refused until the account\'s climb is known');
  assert.equal(N.svc.boardCalls >= 0 && N.asked.length, 0, 'no bout on an empty climb');
  N.A.climb();   // a forced ask while one is out: asked again when it returns
  release(); N.svc.boardHold = null;
  await settle(); await settle(); await settle();
  assert.equal(N.svc.boardCalls, 2, 'the forced ask asked again');
  assert.deepEqual(N.A.fightLadder(), { ok: true, text: '' });
  const bout = N.A.bout();
  assert.deepEqual([bout.tier, bout.bout], [0, 1], 'the account\'s next - the Pit\'s second');
  const relay = N.asked.at(-1).relay;
  assert.equal(typeof relay.owe, 'function', 'the purse handed to the service\'s word');
  // the verdict: the driver holds the purse with the crowd's favour; nothing paid yet
  const P = { name: 'Alva', health: 80, maxHealth: 80, gold: 0 };
  const D = createArenaBouts({ now: () => 1000, playerEntity: P, pay: (g) => { P.gold += g; }, notice: () => {}, say: () => {} });
  D.setStage({ kind: 'floor', centre: () => [...ARENA_FLOOR_CENTRE], spawn: async () => null, remove() {}, heightAt: () => null });
  D.startRelay({ ...relay, names: () => ({ name: 'Rogue', home: 'Wayrest', epithet: '' }) });
  D.relayWord({ k: 'st', o: relay.o, kind: 'pve', ph: 'fight', pa: 5000, fa: 9000, lim: 180000, tier: 0, bout: 1, f: [['p0', 'Alva', 0, 90, 90, '', 0, -1, 0, '', ''], ['a0', '-', 1, 26, 26, '', 1, 136, 50, '', '']], me: 'p0', sp: 0 });
  D.crowd().favour.p0 = 1;
  D.relayWord({ k: 'ev', e: [{ k: 'fall', at: 20_000, a: 'a0' }, { k: 'end', at: 20_000, side: 0, how: 'fall' }, { k: 'verdict', at: 21_500, side: 0, how: 'fall' }] });
  assert.equal(P.gold, 0, 'held for the service\'s word');
  // its receipt to the service - the answer slow; the bout left meanwhile
  let answer;
  N.svc.claimHold = new Promise((r) => { answer = r; });
  N.svc.claimAnswer = { ok: true, data: { recorded: true, kind: 'ladder', won: true, tier: 0, bout: 1, how: 'fall', ladder: climbOf(2), points: 0, banner: null, grand: false } };
  N.session.room = `arena:b${relay.o}`;
  N.A.tick();
  N.A.word({ k: 'rc', r: await receipt(relay.o, 0, 1) }, `arena:b${relay.o}`);
  N.session.room = 'world:1,1';
  for (let i = 0; i < 4; i++) { N.step(2000); N.A.tick(); }
  assert.equal(N.A.bout(), null, 'the bout let go');
  assert.deepEqual(N.A.fightLadder(), { ok: false, text: O.climbWait }, 'my win still with the service holds the next Fight');
  assert.equal(N.asked.length, 1);
  // the service keeps it: paid - the purse with the crowd's love (half again)
  let boardBack;
  N.svc.boardHold = new Promise((r) => { boardBack = r; });   // the service's next board slow - the answer's climb is the board's first
  answer(); N.svc.claimHold = null;
  await settle(); await settle();
  assert.equal(P.gold, 75, 'paid once the realm kept it');
  assert.equal(N.A.board().me.ladder.won, 2, 'the climb the service answered, at once');
  N.svc.board = { ...N.svc.board, me: { ...N.svc.board.me, ladder: climbOf(2) } };
  boardBack(); N.svc.boardHold = null;
  await settle(); await settle();
  assert.deepEqual(N.A.fightLadder(), { ok: true, text: '' }, 'the next Fight once the climb moved');
  assert.equal(N.A.bout().bout, 2);
  // a win the service refuses (out of the climb's order): never paid, its words said, the climb taken
  const o2 = N.A.bout().o;
  let paid = 0;
  N.svc.claimAnswer = { ok: true, data: { recorded: false, why: 'order', ladder: climbOf(2) } };
  N.asked.at(-1).relay.owe(56, (g) => { paid += g; });
  N.A.word({ k: 'rc', r: await receipt(o2, 0, 2) }, `arena:b${o2}`);
  await settle(); await settle();
  assert.equal(paid, 0, 'a refused win pays nothing');
  assert.ok(N.said.includes(O.order), 'the realm\'s words');
  // a win the service never answers holds the next Fight a while at most
  const N2 = onlineOf({ board: boardOf({ ladder: climbOf(1) }) });
  N2.A.model();
  await settle();
  assert.deepEqual(N2.A.fightLadder(), { ok: true, text: '' });
  N2.asked.at(-1).relay.owe(50, () => {});
  N2.session.room = `arena:b${N2.A.bout().o}`;
  N2.A.tick();
  N2.session.room = 'world:1,1';
  for (let i = 0; i < 4; i++) { N2.step(2000); N2.A.tick(); }
  assert.equal(N2.A.bout(), null);
  assert.deepEqual(N2.A.fightLadder(), { ok: false, text: O.climbWait }, 'a win with no answer yet holds it');
  N2.step(CLIMB_WAIT_MS);
  assert.deepEqual(N2.A.fightLadder(), { ok: true, text: '' }, 'past the wait the board\'s climb stands');
});

test('ARENA4b a claim answered before the verdict still pays the owed purse at the verdict; a guest\'s win pays nothing; a receipt the service kept already pays by its own result - a won one, never a lost one (mutants: the early answer lost; a guest paid; a kept win unpaid; a kept loss paid)', async () => {
  const kp = await globalThis.crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(new Uint8Array(await globalThis.crypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle: globalThis.crypto.subtle });
  const receipt = (j, r = 0) => mintArenaReceipt({ a: 'l', j, s: 'acct-alva', q: 0, u: 1, r, h: 'fall' }, priv, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) });
  // ...and a receipt the service kept already (the first answer lost on the way): its own result says - a won one pays
  const kept = { ok: true, data: { recorded: false, why: 'claimed', ladder: climbOf(2) } };
  for (const [answer, want, r = 0] of [[{ ok: true, data: { recorded: true, kind: 'ladder', won: true, ladder: climbOf(2) } }, 50], [{ ok: true, data: { recorded: false, why: 'guest' } }, 0], [kept, 50, 1], [kept, 0, 0]]) {
    const N = onlineOf({ board: boardOf({ ladder: climbOf(1) }) });
    N.A.model();
    await settle();
    N.A.fightLadder();
    const relay = N.asked.at(-1).relay;
    N.session.room = `arena:b${relay.o}`;
    N.svc.claimAnswer = answer;
    N.A.word({ k: 'rc', r: await receipt(relay.o, r) }, `arena:b${relay.o}`);
    await settle(); await settle();
    let paid = 0;
    relay.owe(50, (g) => { paid += g; });
    assert.equal(paid, want, `${answer.data.why ?? 'recorded'} r ${r}`);
  }
  // a guest's win: no purse, and nothing held - the next Fight at once, the service will never move a guest's climb
  const G = onlineOf({ board: boardOf({ ladder: climbOf(1) }) });
  G.A.model();
  await settle();
  G.A.fightLadder();
  const relay = G.asked.at(-1).relay;
  let paid = 0;
  relay.owe(50, (g) => { paid += g; });
  G.session.room = `arena:b${relay.o}`;
  G.A.tick();
  G.svc.claimAnswer = { ok: true, data: { recorded: false, why: 'guest' } };
  G.A.word({ k: 'rc', r: await receipt(relay.o) }, `arena:b${relay.o}`);
  await settle(); await settle();
  G.session.room = 'world:1,1';
  for (let i = 0; i < 4; i++) { G.step(2000); G.A.tick(); }
  assert.equal(paid, 0);
  assert.deepEqual(G.A.fightLadder(), { ok: true, text: '' }, 'a guest\'s answered win holds nothing');
});

test('ARENA4b the Keeper of the Hall and the pause window\'s banner online: the realm\'s wall from the board the window fetched, or asked and read when it comes; the banner the account\'s; offline the host\'s own (false) and the save\'s (mutants: the save\'s wall online; the wall shown before the board; the save\'s banner online)', async () => {
  const shown = [];
  const P = { name: 'Alva', arenaLadder: newArenaLadder(), arenaLeague: LG.joinBanner(LG.newArenaLeague(), 'red', gm).league };
  const N = onlineOf({ board: boardOf({ banner: null }) });
  const gate = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: (w) => shown.push(w), online: () => N.A });
  assert.equal(gate.joined(), false, 'online before the board: not the save\'s Red');
  assert.equal(gate.hall(), true, 'online the gate answers the Keeper');
  assert.equal(shown.length, 0, 'not before the board');
  await settle(); await settle();
  assert.equal(shown.length, 1);
  assert.deepEqual(shown[0].lines, hallLinesOnline(N.A.board(), 'Alva'), 'the realm\'s wall, read when the board came');
  assert.ok(shown[0].lines.includes(O.hallTheirs) && shown[0].lines.at(-1).includes('Ivo'));
  assert.equal(gate.joined(), false, 'the account under no banner - the save\'s Red is not it');
  N.A.board().me.banner = 'blue';
  assert.equal(gate.joined(), true);
  gate.hall();
  assert.equal(shown.length, 2, 'the board in hand: read at once');
  const off = createArenaGate({ playerEntity: P, gameMinutes: () => gm, showOverlay: (w) => shown.push(w) });
  assert.equal(off.hall(), false, 'offline the host reads this save\'s wall');
  assert.equal(off.joined(), true, 'offline the save\'s banner');
});
