// STAR7 (bible/11-Multiplayer/Starfall.md section 6): THE STAR RECEIPTS CARRIED - the device keeps each with the character
// that held the star until the account service has counted it; the service's answers settle it or keep it; the spoils are
// the service's word, given into the pack once and remembered across a crash; the Renown is the holding character's; the
// card says the stars held. Driven on a real signed receipt. tools/mutants/star7.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStarClaims, starClaimVerdict, starRecordText, STAR_CLAIM_TEXT, STAR_CLAIMS_KEY, STAR_SETTLED_KEY, STAR_CLAIMS_MAX, STAR_CLAIM_RETRY_MS, STAR_ACTS_KEY, STAR_ACTS_MAX, STAR_ME_POLL_MS } from '../../../src/net/starfall/starClaims.js';
import { mintStarReceipt } from '../../../src/net/starfall/starReceipt.js';
import { importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { createStarRewards } from '../../../src/scenes/starfall/starRewards.js';
import { STAR_SPOILS_KEYS } from '../../../src/systems/starfall/starSpoils.js';
import { starNightAt } from '../../../src/net/starfall/starfallLaw.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { characterIdOf } from '../../../src/systems/characterId.js';
import { setActSink } from '../../../src/systems/questlines/qlActs.js';
import { profileStarLine } from '../../../src/ui/profileWindow.js';
import { CLAIM_SOURCE, claimHauls } from '../../../src/ui/haulCards.js';
import { FESTIVALS } from '../../../src/net/festivalLaw.js';
import { witchesNight, heartStar, HEART_STAR } from '../../../src/systems/starfall/starfallNight.js';
import { bindFestival, _resetFestivalClientForTests } from '../../../src/systems/festival/festivalClient.js';
import { SESSION_KEY } from '../../../src/net/accountClient.js';
const FESTIVAL_FROM_MS = FESTIVALS[0].fromMs;   // the Witches' Festival's first day, the Starfall's own (net/festivalLaw.js)

const { subtle } = globalThis.crypto;
const T0S = 1_800_000_000, A = 'acct-aaaa', B = 'acct-bbbb', CH = 'char-0001';
const N = starNightAt(FESTIVAL_FROM_MS) + 30;
let PRIV = null;
async function receipt({ n = N, k = 1, s = A, c = 99, l = 12 } = {}, { signed = true, nowS = T0S } = {}) {
  if (!PRIV) {
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    PRIV = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  }
  return mintStarReceipt({ n, k, s, c, l }, signed ? PRIV : null, { subtle, nowS });
}
const memStore = () => { const mem = new Map(); return { get: (k) => mem.get(k), set: (k, v) => mem.set(k, structuredClone(v)), mem }; };
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

test('STAR7 THE VERDICTS: an answer that counted it, counted it before or found the day full lets it go; a guest\'s is kept; no character to pay lets it go; a receipt the relay never signed lets it go, one the service can mend is kept (mutants: the guest kept, a mendable refusal let go)', () => {
  assert.equal(starClaimVerdict({ ok: true, data: { recorded: true } }), 'done');
  assert.equal(starClaimVerdict({ ok: true, data: { recorded: false, why: 'claimed' } }), 'done');
  assert.equal(starClaimVerdict({ ok: true, data: { recorded: false, why: 'day-full' } }), 'done');
  assert.equal(starClaimVerdict({ ok: true, data: { recorded: false, why: 'guest' } }), 'keep');
  assert.equal(starClaimVerdict({ ok: false, error: 'renown-character' }), 'done');
  assert.equal(starClaimVerdict({ ok: false, error: 'receipt', why: 'unsigned' }), 'done');
  for (const why of ['signature', 'verify-threw', 'future', 'clock']) assert.equal(starClaimVerdict({ ok: false, error: 'receipt', why }), 'keep', why);
  assert.equal(starClaimVerdict({ ok: false, error: 'offline' }), 'keep');
  assert.equal(starClaimVerdict({ ok: false, error: 'no-session' }), 'keep');
});

test('STAR7 THE CARRIER: a signed receipt kept with the character that held it and offered at once; counted, it is let go and remembered, its line said and the questline\'s act noted once; the same star again is kept once; an unsigned or expired one never kept; another account\'s waits for its sign-in (mutants: the settled memory, the act, the account guard, the expiry)', async () => {
  const r = await receipt();
  const acts = [];
  setActSink((kind, n) => { acts.push([kind, n]); return n; });
  try {
    const store = memStore(), said = [], asked = [];
    let me = A;
    const c = createStarClaims({
      claim: async (rr, ch, nm, cid) => { asked.push({ rr, ch, nm, cid }); return { ok: true, data: { recorded: true, held: 3, spoils: false, renown: { credited: 70 } } }; },
      store, nowS: () => T0S, nowMs: () => 1_000_000, me: () => me, who: () => CH, say: (t) => said.push(t),
    });
    assert.equal(c.add(r, CH, 'Ann', 12), true);
    await settle();
    assert.equal(asked.length, 1);
    assert.deepEqual([asked[0].ch, asked[0].nm], [CH, 'Ann']);
    assert.match(asked[0].cid, /^[0-9a-f]{16}$/);
    assert.deepEqual(said, [STAR_CLAIM_TEXT.recorded(3, 70)]);
    assert.equal(said[0], 'Star recorded. Stars held: 3. +70 toward your Renown.');   // PIN MOVED (AUDIT STAR W5): the gate's claim's shape
    assert.deepEqual(acts, [['star-held', 1]], 'the act, once');
    assert.equal(c.kept().length, 0, 'let go');
    assert.deepEqual(store.get(STAR_SETTLED_KEY), [`${N}.1|${A}`], 'remembered');
    assert.equal(c.add(r, CH, 'Ann', 12), false, 'settled: never again');
    assert.equal(c.add(await receipt({}, { signed: false }), CH), false, 'unsigned: never kept');
    assert.equal(c.add(await receipt({ k: 2 }, { nowS: T0S - 8 * 86400 }), CH), false, 'expired by the relay\'s clock');
    assert.equal(c.add('j1.junk.x', CH), false);
    assert.equal(c.add(await receipt({ k: 2 }), ''), false, 'no character');
    me = B;
    const theirs = await receipt({ k: 2, s: A });
    assert.equal(c.add(theirs, CH), true, 'kept');
    await settle();
    assert.equal(asked.length, 1, 'another account\'s waits for its own sign-in');
    me = A;
    assert.equal(c.tick(), true, 'the sign-in: offered at once');
    await settle();
    assert.equal(asked.length, 2);
    const again = await receipt({ k: 0 });
    const c2 = createStarClaims({ claim: async () => ({ ok: false, error: 'offline' }), store: memStore(), nowS: () => T0S, nowMs: () => 0, me: () => A });
    c2.add(again, CH); c2.add(again, CH);
    await settle();
    assert.equal(c2.kept().length, 1, 'the same star kept once');
  } finally { setActSink(null); }
});

test('STAR7 THE ANSWERS\' WORDS: a guest\'s told once, the day\'s bound once; neither notes the act; the store bounded (mutants: said twice, a guest\'s act)', async () => {
  const acts = [];
  setActSink((kind, n) => { acts.push(kind); return n; });
  try {
    const said = [];
    const g = createStarClaims({ claim: async () => ({ ok: true, data: { recorded: false, why: 'guest', spoils: false } }), store: memStore(), nowS: () => T0S, nowMs: () => 0, me: () => A, say: (t) => said.push(t) });
    g.add(await receipt({ k: 0 }), CH);
    await settle();
    await g.flush();
    assert.deepEqual(said, [STAR_CLAIM_TEXT.guest()], 'once');
    assert.equal(g.kept().length, 1, 'kept for the week');
    const full = [];
    const d = createStarClaims({ claim: async () => ({ ok: true, data: { recorded: false, why: 'day-full', spoils: false } }), store: memStore(), nowS: () => T0S, nowMs: () => 0, me: () => A, say: (t) => full.push(t) });
    d.add(await receipt({ k: 0 }), CH); d.add(await receipt({ k: 1 }), CH);
    await settle();
    assert.deepEqual(full, [STAR_CLAIM_TEXT.dayFull()]);
    assert.deepEqual(acts, [], 'no act for a star not counted');
    const many = createStarClaims({ claim: async () => ({ ok: false, error: 'offline' }), store: memStore(), nowS: () => T0S, nowMs: () => 0, me: () => A });
    for (let i = 0; i < STAR_CLAIMS_MAX + 6; i++) many.add(await receipt({ n: N + Math.floor(i / 3), k: i % 3 }), CH);
    await settle();
    assert.equal(many.kept().length, STAR_CLAIMS_MAX, 'the oldest go first past the bound');
    assert.ok(STAR_CLAIM_RETRY_MS >= 60_000);
    assert.equal(STAR_CLAIMS_KEY, 'star7.claims');
  } finally { setActSink(null); }
});

test('STAR7 THE SPOILS ARE THE SERVICE\'S WORD: given only to the claim it answers `spoils: true`, awaited - a grant that fails keeps the receipt to ask again (mutants: the spoils ungated, the await)', async () => {
  const r = await receipt();
  let fail = true;
  const given = [];
  const c = createStarClaims({
    claim: async () => ({ ok: true, data: { recorded: true, held: 1, spoils: true } }), store: memStore(), nowS: () => T0S, nowMs: () => 0, me: () => A,
    onSpoils: async (e) => { if (fail) throw new Error('the pack'); given.push(e.r); },
  });
  c.add(r, CH);
  await settle();
  assert.equal(c.kept().length, 1, 'a failed grant keeps it');
  fail = false;
  await c.flush();
  assert.deepEqual(given, [r]);
  assert.equal(c.kept().length, 0);
  const none = [];
  const c2 = createStarClaims({ claim: async () => ({ ok: true, data: { recorded: true, held: 1, spoils: false } }), store: memStore(), nowS: () => T0S, nowMs: () => 0, me: () => A, onSpoils: (e) => none.push(e) });
  c2.add(r, CH);
  await settle();
  assert.deepEqual(none, [], 'another claim\'s spoils: none here');
});

test('STAR7 THE REWARDS ON THIS DEVICE: a receipt the relay hands is kept with the character standing here and claimed; the spoils into the pack through the world\'s door, once, at the level the hold admitted; the Renown adopted only by the character that held it; the silver\'s lines said; a crash\'s record handed back at the stand-up (mutants: the Renown\'s owner, the pack\'s door, the recovery)', async () => {
  const me = characterIdOf(playerEntity);
  playerEntity.level = 30;
  const r = await receipt({ c: 4242, l: 12 });
  const storage = (() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; })();
  const took = [], said = [], xp = [], levels = [];
  const answer = { ok: true, data: { recorded: true, held: 2, spoils: true, renown: { character: me, credited: 60, xp: 600, level: 3 }, marks: { struck: 30, balance: 130 } } };
  const host = {
    starAccount: { claim: async () => answer, me: () => A },
    rewardsStorage: storage,
    relayNowS: () => T0S,
    takeSpoil: (p) => took.push(p),
    chatNotice: (t) => said.push(t),
    marksBook: { claimLines: (data, kind) => [`${data.marks.struck} silver (${kind})`] },
    renownXpAdopt: (x) => xp.push(x), renownAdopt: (l) => levels.push(l), renownRose: () => {}, renownSaid: null,
    _sharedOffsetMs: 0,
  };
  const acts = [];
  setActSink((kind) => { acts.push(kind); return 1; });
  const rw = createStarRewards(host);
  assert.equal(rw.receipt(r), true);
  await settle();
  setActSink(null);
  assert.deepEqual(acts, ['star-held'], 'the act, the standing character\'s own (AUDIT STARFALL 7: the host hands `who`)');
  assert.ok(took.some((p) => p.kind === 'item' && p.item.templateIndex === 576), 'the Starglass into the pack');
  assert.ok(took.some((p) => p.kind === 'gold' && p.gold > 0), 'the gold');
  assert.ok(said.some((t) => t.startsWith('Star recorded.')));   // PIN MOVED (AUDIT STAR W5)
  assert.ok(said.includes('30 silver (star)'), 'the silver, the star\'s kind');
  assert.deepEqual(xp, [600], 'the Renown, the holding character\'s');
  const takenOnce = took.length;
  const rw2 = createStarRewards({ ...host, starAccount: { claim: async () => answer, me: () => A } });
  rw2.receipt(r);
  await settle();
  assert.equal(took.length, takenOnce, 'once a star: the pool remembers it spent');
  // another character's Renown is not adopted here
  const other = createStarRewards({ ...host, rewardsStorage: null, starAccount: { claim: async () => ({ ok: true, data: { ...answer.data, spoils: false, renown: { ...answer.data.renown, character: 'someone-else' } } }), me: () => A } });
  other.receipt(await receipt({ k: 2 }));
  await settle();
  assert.deepEqual(xp, [600], 'never another character\'s');
  // the crash's door: a record no save holds handed back at the stand-up
  const rec = JSON.parse(storage.getItem(STAR_SPOILS_KEYS.store));
  assert.ok(rec, 'the crash\'s record kept until a save holds it');
  const back = [];
  const rw3 = createStarRewards({ ...host, takeSpoil: (p) => back.push(p) });
  rw3.recover(me, null);
  assert.ok(back.length > 0, 'handed back');
  assert.ok(Array.isArray(rw.held(me)));
  rw.saved(me, rw.held(me));
});

test('STAR7 THE CARDS: the account card\'s stars held - a count, "None yet", nothing for a service from before it; a stranger\'s card says them only once there are some; the strike\'s card names the star (mutants: none said, the zero said)', () => {
  assert.equal(starRecordText({ held: 4 }), '4');
  assert.equal(starRecordText({ held: 0 }), 'None yet');
  assert.equal(starRecordText(null), null);
  assert.equal(starRecordText({ held: -1 }), null);
  assert.equal(profileStarLine({ stars: { held: 5 } }), 'Stars held: 5');
  assert.equal(profileStarLine({ stars: { held: 0 } }), null);
  assert.equal(profileStarLine(null), null);
  assert.equal(CLAIM_SOURCE.star, 'Star held');
  assert.equal(claimHauls({ marks: { struck: 30, balance: 130 } }, 'star')[0]?.source, 'Star held');
});

/** A heart night: the first Witches' Night from the rig's night on (systems/starfall/starfallNight.js). */
const HEART_N = (() => { let n = N; while (!witchesNight(n) && n < N + 24 * 800) n++; return n; })();

test('AUDIT STARFALL 7: A STAR\'S ACT IS THE CHARACTER THAT HELD IT - another character standing when the receipt is counted, the act is owed on the device (never noted for the one standing, never dropped) and noted when the holder stands, one star a poll, once; a page loaded again keeps what is owed (mutants: STAR7-act-for-anyone; STAR7-owed-dropped; STAR7-owed-twice)', async () => {
  const acts = [];
  setActSink((kind) => { acts.push(kind); return 1; });
  try {
    const store = memStore();
    let standing = 'char-other', clock = 1_000_000;
    const deps = { claim: async () => ({ ok: true, data: { recorded: true, held: 1, spoils: false, renown: { character: CH, credited: 10 } } }), store, nowS: () => T0S, nowMs: () => clock, me: () => A, who: () => standing };
    const c = createStarClaims(deps);
    c.add(await receipt({ k: 0 }), CH);
    c.add(await receipt({ k: 1 }), CH);
    await settle();
    assert.deepEqual(acts, [], 'another character stands: nothing noted for it');
    assert.deepEqual(store.get(STAR_ACTS_KEY), [{ ch: CH, h: 0 }, { ch: CH, h: 0 }], 'owed the holder, on the device');
    clock += STAR_ME_POLL_MS; c.tick();
    assert.deepEqual(acts, [], 'still not the holder');
    standing = null;
    clock += STAR_ME_POLL_MS; c.tick();
    assert.deepEqual(acts, [], 'none standing');
    // a page loaded again, the holder standing: one star a poll, each its own turn
    standing = CH;
    const again = createStarClaims(deps);
    clock += STAR_ME_POLL_MS; again.tick();
    assert.deepEqual(acts, ['star-held'], 'the holder stands: the first');
    clock += STAR_ME_POLL_MS; again.tick();
    assert.deepEqual(acts, ['star-held', 'star-held'], 'the second, at the next poll');
    clock += STAR_ME_POLL_MS; again.tick();
    assert.equal(acts.length, 2, 'each once');
    assert.deepEqual(again.owed(), []);
    assert.ok(STAR_ACTS_MAX >= 27, 'more than a festival day\'s stars (nine) thrice');
  } finally { setActSink(null); }
});

test('AUDIT STARFALL B3: AN ANSWER LOST - an attempt the service never answered marks its entry; a later `claimed` that is this device\'s own row finishes it once (the act, the line, the Renown heard); a spoils grant that fails keeps it and finishes nothing twice; a `claimed` heard with no lost attempt, or another device\'s, finishes nothing; a refusal the service made marks nothing (mutants: B3-lost-never-marked; B3-own-unread; B3-finished-twice; B3-a-refusal-marks)', async () => {
  const acts = [];
  setActSink((kind) => { acts.push(kind); return 1; });
  try {
    const own = { ok: true, data: { recorded: false, why: 'claimed', own: true, held: 4, spoils: true, renown: { character: CH, xp: 700, level: 3, credited: 70, rose: false } } };
    const answers = [{ ok: false, error: 'server', status: 503 }, own, own];
    const store = memStore(), said = [], heard = [];
    let failGrant = true;
    const c = createStarClaims({
      claim: async () => answers.shift() ?? own, store, nowS: () => T0S, nowMs: () => 0, me: () => A, who: () => CH,
      say: (t) => said.push(t), onRecorded: (d) => heard.push(d.renown.credited),
      onSpoils: async () => { if (failGrant) { failGrant = false; throw new Error('the pack'); } },
    });
    const r = await receipt({ k: 0 });
    c.add(r, CH);
    await settle();
    assert.equal(store.get(STAR_CLAIMS_KEY)[0].lost, true, 'a 503: the attempt may have landed');
    assert.deepEqual(acts, []);
    await c.flush();
    assert.deepEqual(acts, ['star-held'], 'the lost answer\'s act, once');
    assert.deepEqual(heard, [70], 'its Renown heard');
    assert.deepEqual(said, [STAR_CLAIM_TEXT.recorded(4, 70)]);
    assert.equal(c.kept().length, 1, 'the spoils grant failed: kept');
    assert.equal(c.kept()[0].lost, false, 'its mark cleared as it finished');
    await c.flush();
    assert.deepEqual([acts.length, heard.length, said.length], [1, 1, 1], 'never twice');
    assert.equal(c.kept().length, 0, 'settled');
    // a `claimed` heard with no attempt lost (a second browser, an answer that arrived): nothing to finish
    const quiet = [];
    const d = createStarClaims({ claim: async () => own, store: memStore(), nowS: () => T0S, nowMs: () => 0, me: () => A, who: () => CH, onRecorded: () => quiet.push(1) });
    d.add(await receipt({ k: 1 }), CH);
    await settle();
    assert.deepEqual([acts.length, quiet.length], [1, 0], 'no lost attempt: no act');
    // lost, then another device's row: nothing
    const theirs = [{ ok: false, error: 'offline' }, { ok: true, data: { recorded: false, why: 'claimed', held: 4, spoils: false } }];
    const e = createStarClaims({ claim: async () => theirs.shift(), store: memStore(), nowS: () => T0S, nowMs: () => 0, me: () => A, who: () => CH });
    e.add(await receipt({ k: 2 }), CH);
    await settle();
    assert.equal(e.kept()[0].lost, true, 'offline: marked');
    await e.flush();
    assert.deepEqual([acts.length, e.kept().length], [1, 0], 'another device\'s row: settled, nothing finished');
    // a refusal the service made (a 4xx) is no lost attempt
    const f = createStarClaims({ claim: async () => ({ ok: false, error: 'receipt', why: 'clock', status: 400 }), store: memStore(), nowS: () => T0S, nowMs: () => 0, me: () => A, who: () => CH });
    f.add(await receipt({ k: 0, n: N + 1 }), CH);
    await settle();
    assert.equal(f.kept()[0].lost, undefined, 'a refusal: unmarked');
  } finally { setActSink(null); }
});

test('T-A THE HEART-STAR\'S ACT: a counted Heart-Star notes `heart-star-held` beside `star-held` in the same turn, any other star `star-held` alone; the festival\'s finds hear the two as ONE DEED - one endgame find, not two (mutants: T-A-the-heart-unsaid; T-A-the-heart-for-every-star; T-A-two-turns)', async () => {
  assert.ok(witchesNight(HEART_N) && heartStar(HEART_N, HEART_STAR), 'the rig\'s heart night');
  const acts = [];
  setActSink((kind) => { acts.push(kind); return 1; });
  const mem = new Map([[SESSION_KEY, JSON.stringify({ secret: 'sekrit', id: A, name: 'Ann', kind: 'linked' })]]);
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const finds = [];
  bindFestival({
    online: () => true, entity: () => ({ items: [] }), say: () => {}, saved: () => {}, nowMs: () => FESTIVAL_FROM_MS + 3_600_000,
    api: { mine: async () => ({ ok: true, data: { cakes: 0, open: true } }), find: async (src) => { finds.push(src); return { ok: true, data: { found: 4, cakes: 4 } }; }, me: () => A },
  });
  try {
    await settle();
    const c = createStarClaims({ claim: async () => ({ ok: true, data: { recorded: true, held: 1, spoils: false } }), store: memStore(), nowS: () => T0S, nowMs: () => 0, me: () => A, who: () => CH });
    c.add(await receipt({ n: HEART_N, k: HEART_STAR }), CH);
    await settle();
    assert.deepEqual(acts, ['star-held', 'heart-star-held'], 'the Heart-Star: both');
    assert.deepEqual(finds, ['endgame'], 'one deed, one find');
    c.add(await receipt({ n: HEART_N, k: 0 }), CH);
    await settle();
    assert.deepEqual(acts, ['star-held', 'heart-star-held', 'star-held'], 'the night\'s first star: no Heart-Star');
    assert.deepEqual(finds, ['endgame', 'endgame'], 'its own deed, its own find');
  } finally { setActSink(null); _resetFestivalClientForTests(); delete globalThis.localStorage; }
});
