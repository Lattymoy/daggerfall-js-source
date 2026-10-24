// REZ-BLOODLINE (FIELD BUGS 2026-10-16b, bible/01-Overview/bugs/Field-Bugs-2026-10-16b.md; bible/06-Systems/Legacy-Arc.md
// section 6): "I was testing with a friend, he dies and I cast resurrection. It works for a moment then he disappears and
// remains dead" - "You died without a descendant. ... The line ends here". A Bloodline death was written at the death
// door (AUDIT LEGACY A1/B3), so the party's Resurrect raised a body whose house had already buried it, and the slow step
// opened the Succession over the living. The slice HELD the death in the dying page's memory while a Resurrect could
// raise it - and its audit (AUDIT R1) found that a page killed under its death screen, or a join from another device,
// took a permadeath with it. Now THE REALM HOLDS THE DEATH: the door writes it as ever (the line's record, the device's
// store, the realm's copy, the tombstone stamped with its `hold`), and a Resurrect inside the window asks the realm
// (POST /v1/realm/raise), whose yes takes the death back on every copy (the REVIVE stamp, systems/legacy/revived.js).
// AUDIT R2: the online death screen counts the wall clock, as the window does.
//
// Real code throughout: the death door (characters/playerEntity.js hurtPlayer and its listener), Project Legacy's host
// (scenes/legacyHost.js), the realm session and the line's realm copy over the REAL account Worker on node:sqlite
// (systems/realmSaves.js, systems/legacy/realmLine.js, test/accountDb.mjs) and its minute's clock (worker.scheduled), the
// party wire (net/wire.js validPartyPose, validPartyFrame), the bodies the caster sees (net/remotePlayers.js), the
// caster's cast (scenes/hostMagic.js createPlayerMagic), the death screen (ui/deathScreen.js) - and world.js's own
// statements sliced out of bootWorld and mounted over them: the death screen's frame (the Resurrect heard, the rise asked
// of Project Legacy, the call the realm let go), resurrectInPlace and closeDeathScreen, the party pose's `dd`, `fg` and
// `rz`, the caster's pick and call, the host's line, tombstone and raise, and the page's going.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import worker from '../../../server-account/src/index.js';
import { REZ_SETTLE_MAX, settleHolds } from '../../../server-account/src/legacy.js';
import { MINUTE_JOBS, CRON_MINUTE } from '../../../server-account/src/cron.js';
import { standService } from '../../accountDb.mjs';
import { seatRealm, freshSave } from '../../realmSeat.mjs';
import { SESSION_KEY } from '../../../src/net/accountClient.js';
import { realmIo, createRealmSession, whenPageGoes } from '../../../src/systems/realmSaves.js';
import { createRealmLine } from '../../../src/systems/legacy/realmLine.js';
import { createLegacyHost, LEGACY_TEXT, REZ_HOLD_MS } from '../../../src/scenes/legacyHost.js';
import { madeRuleHere } from '../../../src/systems/madeLevel.js';   // the merge of PR #800: the frame asks the made level's law whether a Resurrect is taken here (EG-H2) - none made, so it is
import { personOf, familyRng, MODELS, LEGACY_MOD, isAlive } from '../../../src/systems/legacy/family.js';
import { loadFamily } from '../../../src/systems/legacy/store.js';
import { revivedOf, REZ_HOLD_S } from '../../../src/systems/legacy/revived.js';
import { tollYears, tollLine } from '../../../src/systems/legacy/age.js';
import { legacySettings } from '../../../src/systems/legacy/settings.js';
import { modSaveRecords, restoreModSaveRecords, newGameModSaveRecords, _resetModSaveData } from '../../../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../../../src/systems/modSettings.js';
import { hurtPlayer, setDeathListener } from '../../../src/characters/playerEntity.js';
import { reviveForPlay } from '../../../src/systems/deathRespawn.js';
import { stateDeathLoss, statedDeathLoss } from '../../../src/systems/deathPenalty.js';
import { DeathScreen, ONLINE_RESPAWN_SECONDS } from '../../../src/ui/deathScreen.js';
import { WILD_DEATH_HOLD_S, setWildDeath } from '../../../src/systems/wild/wildZone.js';
import { rezSnapshot, rezFor, resurrectionSpell, RESURRECT_TEXT, RESURRECT_HEALTH_PCT, RESURRECT_HOLD_MS, RESURRECT_TYPE, RESURRECT_SUBTYPE } from '../../../src/systems/resurrect.js';
import { buildCustomSpell } from '../../../src/systems/spell/spellMaker.js';
import { validPartyPose, validPartyFrame } from '../../../src/net/wire.js';
import { RemotePlayers } from '../../../src/net/remotePlayers.js';
import { createPlayerMagic } from '../../../src/scenes/hostMagic.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';

const rd = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 80; i++) await new Promise((r) => { setTimeout(r, 0); }); };
const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };

// ── one clock for the page and the realm: the wall, moved on by the pins (the service reads Date.now) ──────────────────
const realNow = Date.now;
let skew = 0;
Date.now = () => realNow() + skew;
test.after(() => { Date.now = realNow; });
const later = (ms) => { skew += ms; };

// ── world.js's own statements (test/systems/auditrealm2_client.test.js's harness) ─────────────────────────────────────────────
const S = rd('src/scenes/world.js');
const AST = acorn.parse(S, { ecmaVersion: 'latest', sourceType: 'module' });
const text = (n) => S.slice(n.start, n.end);
const all = (pred, from = AST) => {
  const hits = [];
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (pred(n)) hits.push(n);
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(from);
  return hits;
};
const one = (hits, what) => { assert.equal(hits.length, 1, `world.js: ${what} (${hits.length} found)`); return hits[0]; };
const fnOf = (name) => text(one(all((n) => n.type === 'FunctionDeclaration' && n.id?.name === name), `function ${name}`));
const declOf = (name) => text(one(all((n) => n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id?.name === name)), `the declaration of ${name}`));
const BOOT = one(all((n) => n.type === 'FunctionDeclaration' && n.id?.name === 'bootWorld'), 'bootWorld');
const topOf = (has) => text(one(BOOT.body.body.filter((st) => text(st).includes(has)), `bootWorld's statement holding ${has}`));
/** The death screen's frame (onlineFrame): the Resurrect heard while the dead lie - `if (!_respawning) { ... }`. */
const REZ_FRAME = text(one(all((n) => n.type === 'IfStatement' && text(n.test) === '!_respawning' && text(n).includes('rezFor(')), 'the frame\'s Resurrect'));
/** composePartyPose's spreads: my body (`dd`), fallen for good (`fg`), my Resurrect's call (`rz`). */
const POSE = one(all((n) => n.type === 'VariableDeclarator' && n.id?.name === 'composePartyPose'), 'composePartyPose');
const spreadOf = (has) => text(one(all((n) => n.type === 'SpreadElement' && text(n).includes(has), POSE), `composePartyPose's ${has}`));
const POSE_DEAD = `({ ${spreadOf('dd: _deadMark')}, ${spreadOf('fg: 1')} })`;
const POSE_CALL = `({ ${spreadOf('rz: {')} })`;
/** Project Legacy's realm deps, as world.js hands them to its host: the line's copy, the tombstone and the raise. */
const depOf = (key, has) => text(one(all((n) => n.type === 'Property' && n.key?.name === key && text(n.value).includes(has)), `the ${key} dep`).value);
const STORED = depOf('stored', 'legacyRealmLine');
const TOMBSTONE = depOf('tombstone', 'realmSession');
const RAISE = depOf('raiseDeath', 'realmSession');

const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
// eslint-disable-next-line no-new-func
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));

const BASE_POSE = { px: 10, py: 20, in: 0, loc: 'Gothway Garden', hm: 40, f: 0, fm: 10, m: 0, mm: 10, race: 'DarkElf', gender: 'female', face: 3 };
/** A party pose over the wire: projected as it leaves (OnlineSession.sendParty), at the relay's door (parseClient) and
 *  as the hub's frame lands (validPartyFrame) - the member the receiver's social keeps. */
const overTheWire = (acct, name, pose) => {
  const f = validPartyFrame(JSON.parse(JSON.stringify({ t: 'party', acct, p: validPartyPose(validPartyPose(pose)) })));
  assert.ok(f, 'the pose crosses the wire');
  return { acct: f.acct, name, p: f.p, online: true };
};

const ent = () => ({
  name: 'Ysolde Gothway', gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 9, characterId: 'r-ysolde', chargenDone: true, health: 40, maxHealth: 40, fatigue: 2000, items: [], wagonItems: [], activeEffects: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)),
});

/** The account service, stood once for the file. */
let _svc = null;
const service = async () => (_svc ??= await standService());

/**
 * ONE PARTY OF TWO: Ysolde (the fallen - Project Legacy's host, her line's realm copy, her realm character born as her
 * person of it, her session, her death screen's frame) and Bran (the caster - his pick, his call, his cast). `online:
 * false` - Ysolde alone, offline.
 */
async function party({ model = MODELS.bloodline, online = true, ear = true } = {}) {
  _resetModSaveData();
  _resetModSettings();
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);   // a house of one - the reporter's "There is no one left"
  const r = { door: [], said: [], heard: [] };
  r.storage = mem();
  r.e = ent();
  const realm = { realmSession: null, legacyRealmLine: null };
  if (online) {
    const svc = await service();
    const g = await svc.guest();   // an account of her own, each party
    r.svc = svc; r.g = g; r.raw = svc.env.DB._raw;
    const store = mem();
    store.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    const fetch = async (url, init) => {
      const hold = init?.body && JSON.parse(init.body)?.hold === true;
      r.door.push(`${init?.method ?? 'GET'} ${new URL(url).pathname}${hold ? ' hold' : ''}${init?.keepalive ? ' keepalive' : ''}`);
      return worker.fetch(new Request(url, init), svc.env);
    };
    r.io = realmIo({ fetch, storage: store });
    realm.legacyRealmLine = createRealmLine({ io: () => r.io, storage: () => r.storage });
    r.call = async (path, body) => {
      const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${g.secret}` }, body: JSON.stringify(body) }), svc.env);
      return [res.status, (await res.json().catch(() => null))?.error ?? 'ok'];
    };
  }
  r.tombs = () => r.door.filter((l) => l.includes('/v1/realm/die'));
  r.raises = () => r.door.filter((l) => l.includes('/v1/realm/raise'));
  r.host = createLegacyHost({
    get entity() { return r.e; },
    storage: () => r.storage, tab: () => mem(), on: () => true, online: () => online, now: () => 100, own: () => 0,
    here: () => ({ pixel: { x: 10, y: 20 }, region: 'Daggerfall', mode: 'exterior', loc: 'Gothway Garden', locationType: LOCATION_TYPES.TownCity, mapId: 5001 }),
    town: (h) => ({ region: h.region, loc: h.loc, mapId: h.mapId }), nearestTown: () => ({ region: 'Daggerfall', loc: 'Gothway Garden' }),
    gold: () => 200, say: (l) => r.heard.push(l), boot: () => {}, search: () => '?online&realm=r-ysolde&load',
    loadCharacter: () => false, saveNow: () => true, hasSave: () => true, inFight: () => false, rng: familyRng(7),
    wall: () => Date.now(), ...(ear ? { whenGone: (fn) => { r.pageGoes = fn; } } : {}),
    stored: mount(`return ${STORED};`, realm), tombstone: mount(`return ${TOMBSTONE};`, realm), raiseDeath: mount(`return ${RAISE};`, realm),
  });
  r.host.found(model);
  if (online) {
    // LEGACY7: her realm character is born as her person of the line the realm keeps (realm.js createRealm's `lineage`)
    await settle();
    const fam = r.host.family;
    const made = await (await worker.fetch(new Request('https://accounts.invalid/v1/realm/create', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${r.g.secret}` }, body: JSON.stringify({ name: 'Ysolde Gothway', lineage: fam.id, person: fam.currentId }) }), r.svc.env)).json();
    assert.ok(made.id, `born of the line: ${JSON.stringify(made)}`);
    const put = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${made.id}/data`, { method: 'PUT', headers: { authorization: `Bearer ${r.g.secret}`, 'x-realm-lease': made.lease, 'x-realm-seq': '1' }, body: JSON.stringify(freshSave({ name: 'Ysolde Gothway' })) }), r.svc.env);
    assert.equal(put.status, 200, 'her first save');
    r.id = made.id; r.lease = made.lease;
    r.host.rebind(r.e.characterId, made.id);   // world.js realmBirth: the realm names her
    r.e.characterId = made.id;
    r.session = createRealmSession({ io: r.io, id: made.id, lease: made.lease, seq: 1, later: () => () => {}, watchHidden: () => {} });
    realm.realmSession = r.session;
    r.row = () => r.raw.prepare('SELECT dead_at, dead_why, lease, rez_lease FROM realm_characters WHERE id = ?').get(made.id);
    r.realmLine = () => JSON.parse(r.raw.prepare('SELECT record FROM lineages WHERE player = ? AND id = ?').get(r.g.id, fam.id).record);
    r.realmPerson = () => personOf(r.realmLine(), fam.currentId);
    // her union with another player's character - what a tombstone takes with it (legacy.js afterTomb ends it 'died')
    r.raw.prepare("INSERT INTO realm_unions (sid, a_player, a_char, b_player, b_char, a_card, b_card, wed_at) VALUES (?, ?, ?, 'p-other', 'r00000000000000000000', '{}', '{}', 1)").run(`wed${made.id.slice(1, 9)}`, r.g.id, made.id);
    r.unionEnded = () => r.raw.prepare('SELECT ended_why FROM realm_unions WHERE a_char = ?').get(made.id).ended_why;
    r.join = () => r.call('/v1/realm/join', { id: made.id });
    await settle();
  }
  setDeathListener('projectLegacy', () => r.host.onDeath());   // world.js's own registration (AUDIT LEGACY A1/B3)
  r.me = () => personOf(r.host.family, r.host.current().id);
  r.stored = () => personOf(loadFamily(r.storage, r.host.family.id), r.me().id);

  // ── Ysolde's world: her death screen, her frame, her pose ──
  r.townTalk = { overlay: null, closeOverlay(ov) { if (this.overlay === ov) this.overlay = null; }, say: (l) => r.said.push(l) };
  const v = {
    _respawning: false, _rezSeen: null, _deadMark: null, _partyComposedAt: 0, _deathWasOnline: true,
    social: { acct: 'acct-ysolde', others: () => r.ysoldeHears ?? [] }, modes: { sdRealmSlot: () => null, clearDeath() {} },
    legacyHost: r.host, madeRuleHere, rezSnapshot, rezFor, reviveForPlay, playerEntity: r.e, RESURRECT_HEALTH_PCT, RESURRECT_TEXT, DeathScreen,
    statedDeathLoss, stateDeathLoss, townTalk: r.townTalk, wildGhostEnd: () => {}, wildDeathKill: () => false, forgetLastSlew: () => {}, player: { stopAutorun() {} },
  };
  r.ysolde = v;
  const frame = mount(`${fnOf('resurrectInPlace')}\n${fnOf('closeDeathScreen')}\nreturn () => { ${REZ_FRAME} };`, v);
  /** One frame of the death screen's (onlineFrame's death arm): answers whether she rose. */
  r.frame = () => { frame(); return r.e.health > 0; };
  r.die = () => {
    assert.equal(hurtPlayer(r.e, 999, { bypassShield: true }), true, 'the blow kills at the door');
    r.townTalk.overlay = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, online: true, entity: r.e });   // the presenter's screen
    v._deadMark = { k: 'world:10,20', x: 0, y: 0, z: 2, at: 5 };   // PCORPSE1: where the body lies
    r.frame();   // the death screen's first frame: what the party's poses said at the death
  };
  r.ysoldePose = () => ({ ...BASE_POSE, h: r.e.health, ...mount(`return ${POSE_DEAD};`, v) });

  // ── Bran's world: the bodies he sees, his pick, his call, his cast ──
  const rp = new RemotePlayers({ renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, now: () => 0, deps: { audio: { playOneShot() {} } } });
  const c = {
    social: { acct: 'acct-bran', party: { members: [{ acct: 'acct-ysolde', name: 'Ysolde' }, { acct: 'acct-bran', name: 'Bran' }] }, others: () => r.branHears ?? [], accountOfPeer: () => 'acct-ysolde' },
    remotePlayers: rp, onlineToScene: (p) => [p.x, p.y, p.z], cam: { pos: [0, 0.9, 0] }, peerName: () => 'Ysolde',
    _rezOut: null, _partyComposedAt: 0, RESURRECT_HOLD_MS,
  };
  r.bran = c;
  const { fallenTargetPick, raiseFallenDoor } = mount(`${declOf('fallenTargetPick')}\n${declOf('raiseFallenDoor')}\nreturn { fallenTargetPick, raiseFallenDoor };`, c);
  r.branPose = () => ({ ...BASE_POSE, h: 40, race: 'Nord', gender: 'male', face: 1, ...mount(`return ${POSE_CALL};`, c) });
  r.caster = { health: 40, maxHealth: 40, maxMagicka: 500, magicka: 500, level: 9, isPlayer: true, skills: new Array(40).fill(50), skillUses: new Array(40).fill(0), stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [] };
  r.branSaid = [];
  r.anim = null;
  r.magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {}, collider: { raycast: () => Infinity }, playerEntity: r.caster,
    playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => r.branSaid.push(l) },
    say: (l) => r.branSaid.push(l), surfacePlayer() {}, foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99,
    startCastAnim: (sp, release) => { if (!r.slowHands) return false; r.anim = release; return true; },
    fallenTarget: fallenTargetPick, raiseFallen: raiseFallenDoor,
  });
  r.magic.firePending([0, 0.9, 0], [0, 0, 1]);   // where Bran stands and looks: at her body, two paces off
  /** The party's poses cross: Bran hears Ysolde's (and her body stands for him - PCORPSE3), Ysolde hears Bran's. */
  r.toBran = () => {
    const her = overTheWire('acct-ysolde', 'Ysolde', r.ysoldePose());
    r.branHears = [her];
    if (her.p.dd) rp.partyBody('acct-ysolde', 'peer-ysolde', null, her.p.dd, true);
    return her;
  };
  r.toYsolde = () => { r.ysoldeHears = [overTheWire('acct-bran', 'Bran', r.branPose())]; };
  /** Bran casts Resurrection at her body: answers the click's answer. */
  r.cast = (sp = resurrectionSpell()) => { r.magic.readySpell(sp); return r.magic.castInput([0, 0.9, 0], [0, 0, 1]); };
  /** Bran's Resurrect, cast and heard: answers her first frame on it. */
  r.resurrect = () => { r.toBran(); assert.equal(r.cast(), true, 'Bran\'s click casts'); r.toYsolde(); return r.frame(); };
  return r;
}
/** The minute's clock at a second (the Worker's scheduled handler - cron.js MINUTE_JOBS). */
const minute = async (r, atS) => { await worker.scheduled({ cron: CRON_MINUTE, scheduledTime: atS * 1000 }, r.svc.env, {}); };

test('REZ-BLOODLINE AUDIT R1 the realm holds the death, never the page: died at the real door online, the fall is WRITTEN at once - the device\'s record, the realm\'s line copy and its tombstone (dead, the lease that fell kept aside); nothing opens over the body, and a second device is refused; Bran\'s Resurrect inside the window asks the realm (POST /v1/realm/raise) and the body stays down until it answers - its yes takes the death back on every copy (the REVIVE stamp), hands her lease back with nothing a tombstone takes taken, and she rises on the call it let go; the next death is a death of its own, raised once again', async () => {
  const r = await party();
  const heard = { 'wed|Brannoc Gothway|5': 5 };
  const look = { o: 'robe', h: 2 };
  Object.assign(r.me(), { heard, look });   // the news she heard and what she wears - recordDeath takes both off the dead
  r.die();
  assert.equal(r.e.health, 0);
  await settle();
  // written at the door
  assert.equal(r.me().died?.cause, 'fell');
  const row0 = r.host.family.remains?.find((x) => x.of === r.me().id);
  assert.ok(row0 && row0.state === 'lying' && row0.place?.loc === 'Gothway Garden' && row0.items.some((it) => it.legacyRemains), 'her remains lie where she fell, her bones with them');
  assert.ok(!(r.host.family.news ?? []).some((n) => n.k === 'died'), 'the towns hear of it once it stands');
  assert.equal(r.stored().died?.cause, 'fell', 'on the device: a reload, a killed tab\'s next boot, reads her dead');
  assert.ok(loadFamily(r.storage, r.host.family.id).pending, 'the Succession waits on the device');
  assert.equal(r.realmPerson().died?.cause, 'fell', 'and the realm\'s copy of the line - every device\'s');
  const row = r.row();
  assert.ok(Number.isSafeInteger(row.dead_at), 'the tombstone stamped at the door');
  assert.deepEqual([row.dead_why, row.lease, row.rez_lease], ['fell', null, r.lease], 'dead, the lease that fell kept aside for a Resurrect');
  assert.deepEqual(r.tombs(), ['POST /v1/realm/die hold'], 'asked with its hold');
  assert.equal(r.unionEnded(), null, 'what a tombstone takes with it waits on the window');
  assert.deepEqual(await r.join(), [410, 'dead'], 'a second device (or tab) joining her is refused - nothing escapes by it');
  // nothing of the fall opens over the body while the window lasts
  assert.equal(r.host.raisable(), true);
  assert.equal(r.host.tick(), null, 'no Succession under the death screen');
  assert.equal(r.host.tick(), null);
  // late in the longest stand an online death screen makes (the open zone's two minutes)
  later(WILD_DEATH_HOLD_S * 1000 - 1000);
  assert.equal(r.toBran().p.fg, undefined, 'her pose says nothing of a death for good');
  assert.equal(r.resurrect(), false, 'the call reaches her frame: the realm is asked first - down until it answers');
  assert.ok(r.branSaid.includes(RESURRECT_TEXT.cast('Ysolde')), 'Bran calls her back');
  assert.ok(r.caster.magicka < 500, 'paid for');
  assert.equal(r.frame(), false, 'the next frames wait on the answer');
  assert.equal(r.toBran().p.fg, undefined, 'raisable while the realm answers');
  await settle();
  assert.deepEqual(r.raises(), ['POST /v1/realm/raise'], 'asked once, under the lease that fell');
  r.ysoldeHears = [];   // the caster's pose done carrying the call (RESURRECT_HOLD_MS) - she rises on the one the realm let go
  assert.equal(r.frame(), true, 'the realm\'s yes: she rises');
  assert.equal(r.e.health, Math.round(40 * RESURRECT_HEALTH_PCT / 100));
  assert.equal(r.townTalk.overlay, null, 'the death screen closed in place');
  assert.ok(r.said.includes(RESURRECT_TEXT.raised('Bran')), 'in Bran\'s name');
  assert.deepEqual([r.me().heard, r.me().look], [heard, look], 'what recordDeath took off her, given back');
  assert.ok(!(r.host.family.news ?? []).some((n) => n.k === 'died'), 'the towns never hear of a death taken back');
  await settle();
  // the realm: no tombstone, her lease hers again, nothing a tombstone takes taken
  assert.deepEqual(Object.values(r.row()), [null, null, r.lease, null], 'alive, under the lease that fell');
  assert.equal(r.unionEnded(), null, 'her union stands');
  // the death taken back on every copy: the page's, the device's, the realm's
  for (const [what, p] of [['the page', r.me()], ['the device', r.stored()], ['the realm', r.realmPerson()]]) {
    assert.equal(isAlive(p), true, `${what}: alive`);
    assert.deepEqual(revivedOf(p), [100], `${what}: the death's minute stamped taken back`);
  }
  for (const f of [r.host.family, r.realmLine()]) {
    assert.equal(f.pending ?? null, null, 'no Succession');
    assert.deepEqual(f.remains ?? [], [], 'no remains');
  }
  assert.equal(r.host.family.ended ?? null, null, 'the line goes on');
  // her session plays on: a checkpoint lands under the lease handed back
  assert.equal(r.session.lost, null);
  assert.equal((await r.session.checkpoint(JSON.stringify(freshSave({ name: 'Ysolde Gothway' })))).ok, true, 'checkpointed again');
  r.me().estate = 50;   // a letter of credit the house owes her
  for (let s = 0; s < 3; s++) { later(REZ_HOLD_MS); assert.equal(r.host.tick(), null, 'no Succession, at any slow step after'); }
  assert.ok(r.heard.includes(LEGACY_TEXT.estate(50)), 'risen, her days go on: the letter paid');
  assert.equal(r.toBran().p.fg, undefined);
  // the next death is a death of its own - in the same world minute, past the one taken back - held, and raised once more
  r.ysolde._rezSeen = null;
  r.die();
  await settle();
  assert.equal(r.me().died?.at, 101, 'its minute past the one taken back (revived.js knows a death by its minute)');
  assert.equal(r.row().rez_lease, r.lease, 'held at the realm again');
  r.bran._rezOut = null;
  r.caster.magicka = 500;
  later(RESURRECT_HOLD_MS);
  r.resurrect();
  await settle();
  r.ysoldeHears = [];
  assert.equal(r.frame(), true, 'raised again - once a death');
  await settle();
  assert.deepEqual(revivedOf(r.realmPerson()), [100, 101]);
  assert.equal(r.row().dead_at, null);
});

test('REZ-BLOODLINE AUDIT R1 a killed tab and a second device escape nothing (the audit\'s a_kill and b_twotabs): the page killed under its death screen - no pagehide, no reset, no slow step - leaves her dead on the device, on the realm\'s line and at its tombstone (a join refused 410), and the realm\'s minute closes the window it left (what a tombstone takes, taken; a Resurrect after refused); a join during the hold is refused, and the dying page going after closes it by keepalive; an Enduring member\'s toll is taken at the door', async () => {
  const r = await party();
  r.die();
  const c = await party();
  c.die();
  await settle();
  const deadAt = Math.min(r.row().dead_at, c.row().dead_at), lastAt = Math.max(r.row().dead_at, c.row().dead_at);
  // ── the page is killed here: nothing more of it runs ──
  assert.equal(loadFamily(r.storage, r.host.family.id).people.find((p) => p.characterId === r.id).died?.cause, 'fell', 'the device\'s next boot reads her dead');
  assert.ok(loadFamily(r.storage, r.host.family.id).pending, 'the Succession waiting for it');
  assert.equal(r.realmPerson().died?.cause, 'fell', 'every other device\'s, the realm\'s line');
  assert.deepEqual(await r.join(), [410, 'dead'], 'and no device plays her again');
  // the realm's minute: a second short of the window nothing moves; at it, the window is closed
  await minute(r, deadAt + REZ_HOLD_S - 1);
  assert.equal(r.row().rez_lease, r.lease, 'inside the window: held');
  assert.equal(r.unionEnded(), null);
  // the minute's share spent: one fall closed, the next left to the next minute
  assert.equal(c.row().rez_lease, c.lease);
  assert.equal(await settleHolds({ db: r.svc.env.DB, nowS: lastAt + REZ_HOLD_S, budget: () => false }), 1, 'one, then the share is spent');
  assert.equal([r.row().rez_lease, c.row().rez_lease].filter((x) => x == null).length, 1);
  await minute(r, lastAt + REZ_HOLD_S);
  assert.equal(r.row().rez_lease, null, 'closed by the minute\'s clock (legacy.js settleHolds)');
  assert.equal(c.row().rez_lease, null);
  assert.equal(r.unionEnded(), 'died', 'what a tombstone takes with it, taken');
  assert.ok(MINUTE_JOBS.some(([name]) => name === 'rez-holds'), 'a minute\'s job');
  assert.deepEqual(await r.call('/v1/realm/raise', { id: r.id, lease: r.lease, diedAt: 100 }), [409, 'raise-late'], 'a Resurrect after it: refused');
  assert.ok(r.row().dead_at != null, 'dead for good');
  // a second device joined DURING the hold - refused at once; the dying page going after closes the window
  const b = await party();
  b.die();
  await settle();
  assert.deepEqual(await b.join(), [410, 'dead'], 'the join during the hold is refused');
  const win = new EventTarget();
  mount(topOf('whenPageGoes('), { realmSession: b.session, legacyHost: b.host, whenPageGoes, globalThis: win });
  win.dispatchEvent(new Event('pagehide'));
  assert.equal(b.session.lost, 'dead', 'the session the dead\'s - the leave behind it finds it so');
  await settle();
  assert.deepEqual(b.door.filter((l) => /realm\/(die|leave)/.test(l)), ['POST /v1/realm/die hold', 'POST /v1/realm/die keepalive'], 'the window closed by keepalive - no leave');
  assert.equal(b.row().rez_lease, null, 'closed');
  assert.equal(b.unionEnded(), 'died');
  // the page going while the door's tombstone is still on its way: Project Legacy's close goes ahead of the realm's leave
  // (the session the dead's at once), so the leave never gives up the lease the tombstone is asked under
  const b2 = await party();
  const fetchB2 = b2.io.fetch;
  const gated = [];
  b2.io.fetch = async (url, init) => { if (String(url).endsWith('/v1/realm/die')) await new Promise((go) => { gated.push(go); }); return fetchB2(url, init); };
  b2.die();
  const win2 = new EventTarget();
  mount(topOf('whenPageGoes('), { realmSession: b2.session, legacyHost: b2.host, whenPageGoes, globalThis: win2 });
  win2.dispatchEvent(new Event('pagehide'));
  gated.splice(0).forEach((go) => go());
  await settle();
  gated.splice(0).forEach((go) => go());
  await settle();
  assert.deepEqual(b2.door.filter((l) => /realm\/leave/.test(l)), [], 'no leave');
  assert.ok(b2.row().dead_at != null, 'dead at the realm');
  // the host's own ear for the page going - the page's pagehide, by default
  const ears = [];
  globalThis.addEventListener = (type, fn) => { ears.push([type, fn]); };
  try { await party({ online: false, ear: false }); } finally { delete globalThis.addEventListener; }
  assert.deepEqual(ears.map(([type]) => type), ['pagehide'], 'the host hears the page go');
  // an Enduring member's toll: taken at the door - on the device and the realm's line
  const e = await party({ model: MODELS.enduring });
  const years = tollYears(e.me().race, legacySettings().tollShare);
  e.die();
  await settle();
  assert.equal(e.stored().toll, years, 'on the device');
  assert.equal(e.realmPerson().toll, years, 'at the realm');
  assert.deepEqual(e.tombs(), [], 'an Enduring rise is no tombstone');
  assert.deepEqual(await e.join(), [200, 'ok'], 'nor a death the realm holds');
});

test('REZ-BLOODLINE AUDIT R1 the realm\'s door takes a Resurrect only inside the window, only under the lease that fell, once, of the character\'s own line - and a refused one keeps her body down: her client says so and closes the window, her pose tells Bran before a point is spent; the window over on the page asks the realm nothing', async () => {
  const r = await party();
  r.die();
  await settle();
  const at = r.me().died.at;
  for (const [body, want] of [
    [{ id: r.id, lease: r.lease }, [400, 'body']], [{ id: r.id, lease: r.lease, diedAt: -1 }, [400, 'body']], [{ id: r.id, lease: r.lease, diedAt: '100' }, [400, 'body']],
    [{ id: r.id, lease: 'f'.repeat(32), diedAt: at }, [409, 'lease']],
  ]) assert.deepEqual(await r.call('/v1/realm/raise', body), want, JSON.stringify(body));
  // another of the account's characters taken up since: one in play at a time (ONE-SEAT)
  const other = await seatRealm(r.svc.env, r.g.secret, 'Other');
  assert.deepEqual(await r.call('/v1/realm/raise', { id: r.id, lease: r.lease, diedAt: at }), [409, 'lease'], 'refused while another is in play');
  assert.deepEqual(await r.call('/v1/realm/leave', { id: other.id, lease: other.lease }), [200, 'ok']);
  // past the window: refused, nothing moved
  later(REZ_HOLD_S * 1000);
  assert.deepEqual(await r.call('/v1/realm/raise', { id: r.id, lease: r.lease, diedAt: at }), [409, 'raise-late']);
  assert.equal(r.row().rez_lease, r.lease, 'held still - the minute closes it');
  // once: a second asking of a death taken back is refused
  const o = await party();
  o.die();
  await settle();
  const oat = o.me().died.at;
  assert.deepEqual(await o.call('/v1/realm/raise', { id: o.id, lease: o.lease, diedAt: oat }), [200, 'ok']);
  assert.deepEqual(await o.call('/v1/realm/raise', { id: o.id, lease: o.lease, diedAt: oat }), [409, 'not-dead'], 'twice: refused');
  assert.deepEqual(revivedOf(o.realmPerson()), [oat]);
  // a character of no line has no Resurrect the realm holds for it
  const plain = await seatRealm(o.svc.env, o.g.secret, 'Plain');
  assert.deepEqual(await o.call('/v1/realm/die', { id: plain.id, lease: plain.lease, hold: true }), [200, 'ok']);
  assert.deepEqual(await o.call('/v1/realm/raise', { id: plain.id, lease: plain.lease, diedAt: 1 }), [409, 'raise-no-line']);
  assert.deepEqual(await o.call('/v1/realm/die', { id: plain.id, lease: plain.lease, hold: 'yes' }), [400, 'body'], 'a hold of no shape');
  // the realm stamps its own copy: a page whose line never reaches it again (killed as it rose) leaves no death there
  const k = await party();
  k.die();
  await settle();
  const fetchK = k.io.fetch;
  k.io.fetch = async (url, init) => { if (String(url).endsWith('/v1/realm/lineage')) throw new TypeError('Failed to fetch'); return fetchK(url, init); };
  const revK = k.raw.prepare('SELECT rev FROM lineages WHERE id = ?').get(k.host.family.id).rev;
  k.resurrect();
  await settle();
  assert.equal(isAlive(k.realmPerson()), true, 'taken back at the realm by its own hand');
  assert.deepEqual(revivedOf(k.realmPerson()), [k.me().died?.at ?? 100]);
  assert.ok(k.raw.prepare('SELECT rev FROM lineages WHERE id = ?').get(k.host.family.id).rev > revK, 'past the rev it was read at');
  // her tombstone never heard (the door's word lost) and her line's not yet landed: the tab that plays her takes the
  // death back on the line, once, so the copy carrying it - landing late - entombs no one
  const u = await party();
  const fam = u.host.family;
  assert.deepEqual(await u.call('/v1/realm/raise', { id: u.id, lease: u.lease, diedAt: 100 }), [200, 'ok']);
  assert.deepEqual(await u.call('/v1/realm/raise', { id: u.id, lease: u.lease, diedAt: 100 }), [409, 'not-dead'], 'once');
  assert.deepEqual(await u.call('/v1/realm/raise', { id: u.id, lease: 'e'.repeat(32), diedAt: 101 }), [409, 'not-dead'], 'only under the lease that plays her');
  const late = JSON.parse(JSON.stringify(fam));
  late.people.find((p) => p.id === fam.currentId).died = { at: 100, cause: 'fell', place: null, by: null };
  late.rev += 5;
  const base = u.raw.prepare('SELECT rev FROM lineages WHERE id = ?').get(fam.id).rev;
  assert.deepEqual(await u.call('/v1/realm/lineage', { id: fam.id, record: late, base }), [200, 'ok'], 'the late copy lands');
  assert.equal(isAlive(u.realmPerson()), true, 'its death dropped (putLineage takes the stamp in)');
  assert.equal(u.row().dead_at, null, 'and nobody entombed');
  u.raw.prepare('DELETE FROM lineages WHERE id = ?').run(fam.id);
  assert.deepEqual(await u.call('/v1/realm/raise', { id: u.id, lease: u.lease, diedAt: 102 }), [409, 'not-dead'], 'no line to say it on');

  // her client, refused by the realm (another of the account's characters in play): down, said, the window closed
  const d = await party();
  d.die();
  await settle();
  await seatRealm(d.svc.env, d.g.secret, 'Other');
  assert.equal(d.resurrect(), false);
  await settle();
  assert.equal(d.frame(), false, 'refused: she stays down');
  assert.equal(d.e.health, 0);
  assert.ok(d.heard.includes(LEGACY_TEXT.raiseRefused()), 'and is told why');
  assert.equal(d.host.raisable(), false);
  assert.deepEqual(d.tombs(), ['POST /v1/realm/die hold', 'POST /v1/realm/die'], 'the window closed at the realm');
  assert.equal(d.unionEnded(), 'died');
  assert.ok(d.townTalk.overlay instanceof DeathScreen, 'her death screen stands, for the Succession after it');
  // ...and her pose tells Bran: refused before a point is spent, said in her name
  assert.equal(d.toBran().p.fg, 1, 'fallen for good, over the wire');
  const before = d.caster.magicka;
  d.branSaid.length = 0;
  assert.equal(d.cast(), false, 'the click refused');
  assert.equal(d.caster.magicka, before, 'nothing spent');
  assert.equal(d.branSaid.at(-1), RESURRECT_TEXT.forGood('Ysolde'), 'said in her name');
  assert.ok(!d.branSaid.includes(RESURRECT_TEXT.cast('Ysolde')) && !d.branSaid.includes(RESURRECT_TEXT.noBody));
  assert.match(RESURRECT_TEXT.forGood('Ysolde'), /^Ysolde has fallen for good\./);
  d.branSaid.length = 0;
  d.magic.readySpell(buildCustomSpell({ slots: [{ type: RESURRECT_TYPE, subType: RESURRECT_SUBTYPE, settings: {} }], rangeType: 0, element: 4, name: 'Raise', icon: 10, index: -45002 }));
  assert.deepEqual(d.branSaid, [RESURRECT_TEXT.forGood('Ysolde')], 'a caster-only Resurrect readied at her: her name, never "Press button to fire spell."');
  const out = d.host.deathOutcome();
  assert.deepEqual([out.kind, out.fallen.id, out.choices.length, out.newborn], ['fall', d.me().id, 0, false], `the reset presents it: ${LEGACY_TEXT.noHeir}`);
  // the window over on the page: a call then asks the realm nothing - the body stays down, the window closed
  const w = await party();
  w.die();
  await settle();
  w.toBran();
  assert.equal(w.cast(), true, 'Bran casts inside the window');
  later(REZ_HOLD_MS);   // ...and the call reaches her after it
  w.toYsolde();
  assert.equal(w.frame(), false, 'refused: she stays down');
  await settle();
  assert.deepEqual(w.raises(), [], 'the realm asked nothing');
  assert.deepEqual(w.tombs(), ['POST /v1/realm/die hold', 'POST /v1/realm/die'], 'its window closed');
  assert.equal(w.host.raisable(), false);
  // a call cast before the window closed, landing on a body gone for good while the hands moved, goes nowhere
  const h = await party();
  h.die();
  await settle();
  h.toBran();
  h.slowHands = true;
  assert.equal(h.cast(), true, 'the click casts; the hands move');
  later(REZ_HOLD_MS);
  h.host.tick();
  h.toBran();
  h.branSaid.length = 0;
  h.anim();
  assert.equal(h.bran._rezOut, null, 'no call sent at her');
  assert.deepEqual(h.branSaid, [RESURRECT_TEXT.forGood('Ysolde')]);
});

test('REZ-BLOODLINE the window closes at the first of the reset, its end, a body up by no Resurrect, a load, a new game - each tells the realm (what a tombstone takes, taken) and the towns; the player going on while the realm answers rises by the host\'s own respawn and the yes still takes the death back; a call the realm never heard leaves the next to ask; an Enduring member\'s toll is given back by a Resurrect; offline the death is decided at the door, as ever', async () => {
  // the reset (world.js legacyDeathReset's ask): the fall it presents, the realm and the towns told
  const b = await party();
  b.die();
  await settle();
  const out = b.host.deathOutcome();
  assert.equal(out.kind, 'fall');
  await settle();
  assert.deepEqual(b.tombs(), ['POST /v1/realm/die hold', 'POST /v1/realm/die'], 'the window closed at the realm');
  assert.equal(b.row().rez_lease, null);
  assert.equal(b.unionEnded(), 'died', 'what a tombstone takes, taken now');
  assert.ok((b.host.family.news ?? []).some((n) => n.k === 'died'), 'the towns hear of the death once it stands');
  assert.equal(b.host.raisable(), false);
  // the slow step closes a window that ran out
  const q = await party();
  q.die();
  await settle();
  later(REZ_HOLD_MS - 5000);
  assert.equal(q.host.tick(), null, 'inside the window');
  later(5000);
  assert.ok(q.host.tick()?.fall, 'over: the Succession, which the world host opens once her death screen goes (legacyStep)');
  await settle();
  assert.equal(q.row().rez_lease, null);
  // a body brought up by no Resurrect (a respawn that never asked the reset)
  const p = await party();
  p.die();
  await settle();
  p.e.health = 20;
  assert.ok(p.host.tick()?.fall, 'the Succession, as the door had it');
  // a load over a held death: the save written before she fell, restored as every load door restores it
  const l = await party();
  const before = modSaveRecords();
  l.die();
  await settle();
  restoreModSaveRecords(before);
  assert.ok(l.host.past, 'the loaded save of her is the past - the death was written at the door');
  assert.ok(l.host.tick()?.fall, 'and the Succession offered over it');
  await settle();
  assert.deepEqual(l.tombs(), ['POST /v1/realm/die hold', 'POST /v1/realm/die']);
  // a new game over a held death
  const n = await party();
  n.die();
  await settle();
  newGameModSaveRecords();
  await settle();
  assert.equal(n.row().rez_lease, null, 'closed before the new game plays anyone');
  // the player goes on while the realm answers a Resurrect: the host's own respawn; the yes takes the death back
  const g = await party();
  g.die();
  await settle();
  assert.equal(g.resurrect(), false, 'asked');
  assert.deepEqual(g.host.deathOutcome(), { kind: 'none' }, 'the reset: the host\'s own rise, never the Succession');
  g.e.health = 20;   // D-ONLINE1's respawn
  assert.equal(g.host.tick(), null);
  await settle();
  assert.equal(isAlive(g.me()), true, 'the yes took it back');
  assert.equal(g.row().dead_at, null);
  g.me().estate = 50;
  assert.equal(g.host.tick(), null, 'no Succession over the risen body');
  assert.equal(g.host.family.pending, null);
  assert.ok(g.heard.includes(LEGACY_TEXT.estate(50)), 'and her days go on');
  // ...and the realm's no then: said, the window closed, the Succession over the risen body - the realm has it so
  const k = await party();
  k.die();
  await settle();
  await seatRealm(k.svc.env, k.g.secret, 'Other');
  k.resurrect();
  assert.deepEqual(k.host.deathOutcome(), { kind: 'none' });
  k.e.health = 20;
  k.host.tick();
  await settle();
  assert.ok(k.heard.includes(LEGACY_TEXT.raiseRefused()), 'said');
  assert.deepEqual(k.tombs(), ['POST /v1/realm/die hold', 'POST /v1/realm/die'], 'the window closed at the realm');
  assert.ok(k.host.tick()?.fall, 'the Succession');
  // the realm's yes in hand and the body not yet up when the player goes on: the host's own rise, the line untouched
  const y = await party();
  y.die();
  await settle();
  y.resurrect();
  await settle();
  assert.deepEqual(y.host.deathOutcome(), { kind: 'none' }, 'never the Succession the door wrote');
  assert.equal(isAlive(y.me()), true);
  // ...and the page going with the yes in hand closes nothing: the realm raised her
  const y2 = await party();
  y2.die();
  await settle();
  y2.resurrect();
  await settle();
  y2.pageGoes();
  await settle();
  assert.deepEqual(y2.tombs(), ['POST /v1/realm/die hold'], 'no close');
  assert.equal(y2.row().dead_at, null, 'alive at the realm');
  // a call asked at the page's last second: the realm's window, from its tombstone's landing, is the later - and the page
  // waits on its answer past its own
  const st = await party();
  const fetchSt = st.io.fetch;
  const held = { die: [], raise: [] };
  const gate = { die: () => held.die.splice(0).forEach((go) => go()), raise: () => held.raise.splice(0).forEach((go) => go()) };
  st.io.fetch = async (url, init) => {
    const k = /\/v1\/realm\/(die|lineage)$/.test(String(url)) ? 'die' : String(url).endsWith('/v1/realm/raise') ? 'raise' : null;
    if (k) await new Promise((go) => { held[k].push(go); });
    return fetchSt(url, init);
  };
  st.die();
  await settle();
  later(2500);   // the tombstone (and the line beside it) lands late
  gate.die();
  await settle();
  later(REZ_HOLD_MS - 2500 - 1000);
  st.resurrect();
  await settle();
  later(2000);   // past the page's window, inside the realm's
  assert.equal(st.host.raisable(), true, 'raisable while the realm answers, past the page\'s window');
  gate.raise();
  await settle();
  assert.equal(st.host.raisable(), true, 'and once it let her go');
  st.host.tick();
  st.ysoldeHears = [];
  assert.equal(st.frame(), true, 'she rises on it');
  await settle();
  assert.equal(st.row().dead_at, null, 'nothing closed under it');
  // a load while the realm answers: the yes is the death's - the save loaded plays her on
  const ld = await party();
  const saved = modSaveRecords();
  ld.die();
  await settle();
  ld.resurrect();
  restoreModSaveRecords(saved);
  assert.ok(ld.host.past, 'the load reads her dead - for now');
  await settle();
  assert.equal(ld.host.past, null, 'the realm\'s yes: she plays on');
  assert.equal(isAlive(ld.me()), true);
  assert.deepEqual(ld.tombs(), ['POST /v1/realm/die hold'], 'the load closed nothing the realm was answering');
  assert.equal(ld.row().dead_at, null);
  // ...and a load under the realm's no: the past is played back, and nothing is said over it of a window it closed
  const lr = await party();
  const savedLr = modSaveRecords();
  lr.die();
  await settle();
  await seatRealm(lr.svc.env, lr.g.secret, 'Other');
  lr.resurrect();
  restoreModSaveRecords(savedLr);
  await settle();
  assert.ok(lr.host.past, 'the past');
  assert.ok(!lr.heard.includes(LEGACY_TEXT.raiseRefused()), 'nothing said over it');
  // the door's tombstone slow (its line lands first - held, entombLineDead) and a Resurrect at once: the realm asked
  // only once the tombstone has answered - never a raise ahead of the death it raises
  const i = await party();
  const fetchI = i.io.fetch;
  let release = null;
  i.io.fetch = async (url, init) => {
    if (String(url).endsWith('/v1/realm/die')) await new Promise((go) => { release = go; });
    return fetchI(url, init);
  };
  i.die();
  i.resurrect();
  await settle();
  assert.equal(i.row().rez_lease, i.lease, 'the line landed first: held as the tombstone would hold it');
  assert.deepEqual(i.raises(), [], 'the realm not asked yet');
  release();
  await settle();
  i.ysoldeHears = [];
  assert.equal(i.frame(), true, 'raised once the tombstone answered');
  await settle();
  assert.deepEqual([i.row().dead_at, i.row().lease], [null, i.lease]);
  // a call the realm never heard: said, and the next call asks again
  const x = await party();
  x.die();
  await settle();
  const fetchOf = x.io.fetch;
  x.io.fetch = async (url, init) => { if (String(url).endsWith('/v1/realm/raise')) throw new TypeError('Failed to fetch'); return fetchOf(url, init); };
  assert.equal(x.resurrect(), false);
  await settle();
  assert.ok(x.heard.includes(LEGACY_TEXT.raiseUnheard()), 'said');
  assert.equal(x.frame(), false, 'the same call asks no more');
  await settle();
  assert.equal(x.heard.filter((l) => l === LEGACY_TEXT.raiseUnheard()).length, 1, 'asked once');
  assert.equal(x.host.raisable(), true, 'the window stands');
  x.io.fetch = fetchOf;
  later(RESURRECT_HOLD_MS);
  x.bran._rezOut = null;
  x.caster.magicka = 500;
  assert.equal(x.resurrect(), false, 'the next call asks again');
  await settle();
  x.ysoldeHears = [];
  assert.equal(x.frame(), true, 'and rises on its yes');
  // Enduring: the toll taken at the door, given back by a Resurrect (on the device and the realm)
  const e = await party({ model: MODELS.enduring });
  e.die();
  const years = tollYears(e.me().race, legacySettings().tollShare);
  assert.equal(e.me().toll, years, 'taken at the door');
  assert.equal(e.host.willRise(), true, 'the rise the reset would make is known');
  assert.equal(e.resurrect(), true, 'raised by Bran at once - no tombstone stands for an Enduring rise');
  assert.equal(e.host.tick(), null);
  await settle();
  assert.equal(e.me().toll | 0, 0, 'and Arkay takes nothing');
  assert.equal(e.stored().toll | 0, 0);
  assert.equal(e.realmPerson().toll | 0, 0);
  assert.deepEqual(e.raises(), [], 'the realm asked nothing');
  // a copy that took another's toll in meanwhile keeps the toll - the two cannot be told apart
  const e2 = await party({ model: MODELS.enduring });
  e2.die();
  e2.me().toll += 1;
  assert.equal(e2.resurrect(), true);
  assert.equal(e2.me().toll, years + 1, 'the toll stands');
  // ...the next death's reset presents the door's years
  e.ysolde._rezSeen = null;
  e.die();
  const rise = e.host.deathOutcome();
  assert.equal(rise.kind, 'rise');
  assert.equal(e.me().toll, years);
  assert.equal(rise.line, tollLine(e.me().given, { years, age: rise.line.match(/is (\d+)/)[1] | 0, spent: false }));
  await settle();
  assert.deepEqual(e.tombs(), [], 'an Enduring rise is no tombstone');
  // offline: no party can raise her - decided at the door (AUDIT LEGACY A1/B3)
  const o = await party({ online: false });
  o.die();
  assert.equal(o.stored().died?.cause, 'fell', 'written at the door');
  assert.ok(o.host.family.pending);
  assert.ok((o.host.family.news ?? []).some((nw) => nw.k === 'died'), 'told at once');
  assert.equal(o.host.raisable(), false);
  assert.equal(o.host.raise(), false);
});

test('REZ-BLOODLINE AUDIT R2 the online death screen counts the wall clock, as the window does: at seven frames a second (each frame\'s dt clamped to a tenth) the open zone\'s two minutes end at two minutes on the wall - inside the window, a Resurrect raisable to the last - where they ran on to 172 seconds and said "RISING IN 15" under a window already closed; the window is the longest screen and half a minute, one number at both doors', async () => {
  for (const fps of [7, 60]) {
    const r = await party();
    r.die();
    await settle();
    setWildDeath({ killer: 'a wolf', dropped: 0 });
    try {
      let reset = false;
      const screen = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, online: true, entity: r.e, onReset: () => { reset = true; } });
      const start = Date.now();
      let legacyT = 0;
      let said = null;
      for (let f = 0; !reset && f < 100_000; f++) {
        later(1000 / fps);
        const dt = Math.min(0.1, 1 / fps);   // world.js's frame: the clamped dt
        screen.tick(dt);
        legacyT -= dt;
        if (legacyT <= 0) { legacyT = 1; r.host.tick(); }   // legacyStep: once a second of the same dt
        assert.equal(r.host.raisable(), true, `${fps} fps: raisable while the screen stands (${((Date.now() - start) / 1000).toFixed(1)} s, "RISING IN ${screen.respawnIn}")`);
        if (f === Math.round(fps * 60)) said = screen.respawnIn;
      }
      const wall = (Date.now() - start) / 1000;
      assert.ok(reset && wall <= WILD_DEATH_HOLD_S + 1, `${fps} fps: the screen goes at ${wall.toFixed(1)} s on the wall`);
      assert.ok(wall * 1000 < REZ_HOLD_MS, 'inside the window');
      assert.equal(said, WILD_DEATH_HOLD_S - 60, 'a minute in, it says a minute left');
    } finally {
      setWildDeath(null);
    }
  }
  // a frame's own count still leads where its dt outruns the wall (a host stepping the screen by hand)
  const s = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, online: true, entity: ent(), wall: () => 0 });
  s.tick(ONLINE_RESPAWN_SECONDS / 2);
  assert.equal(s.respawnIn, ONLINE_RESPAWN_SECONDS / 2);
  // one window at both doors: the longest online death screen and half a minute
  assert.equal(REZ_HOLD_S, Math.max(ONLINE_RESPAWN_SECONDS, WILD_DEATH_HOLD_S) + 30);
  assert.equal(REZ_HOLD_MS, REZ_HOLD_S * 1000);
  assert.ok(REZ_SETTLE_MAX >= 1);
  assert.match(rd('server-account/migrations/0122_rez_hold.sql'), /ALTER TABLE realm_characters ADD COLUMN rez_lease TEXT;\nCREATE INDEX IF NOT EXISTS realm_characters_rez_hold ON realm_characters \(dead_at\) WHERE rez_lease IS NOT NULL;/);
});
