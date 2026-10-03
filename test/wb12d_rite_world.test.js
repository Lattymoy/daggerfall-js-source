// WB12d (2026-10-01, Mac: "faithful and a Summoner"): THE FAITHFUL'S RITE IN THE WORLD - the circle and its smoke
// (scenes/riteHost.js, world/riteModel.js, render/riteSmoke.js), its faithful shared by the World of Daggerfall camps'
// law, the rite's word to its cell, the opening, the hub's broken word, the casket (systems/riteChest.js), the receipt's
// rite in the spoils and the claim, the omen's order, the session and the world host's seams -
// bible/11-Multiplayer/World-Bosses.md section 19 D. AUDIT WB12d (2026-10-02): every host finding pinned here by the
// host's own behaviour on a fake world; the camps' law end to end is test/wb12d_rite_host.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createRiteHost, RITE_TEXT, RITE_SPRING_M, RITE_SIGHT_M, RITE_ALERT_M, RITE_CHEST_SEED_M, RITE_SMOKE_IN_MS, RITE_SMOKE_OUT_MS,
  RITE_SAY_REACH_M, RITE_RESAY_MS, RITE_ORPHAN_MS, RITE_RESTAND_MS, RITE_TEND_M, RITE_LIGHT_REACH_M, RITE_GLOW_RANGE, RITE_BARE_R,
  RITE_BUCKET, RITE_GROUND_EVERY, RITE_SIGIL_DRAW_M, RITE_FLAME_SCALE, RITE_FLAME_PHASES,
} from '../src/scenes/riteHost.js';
import { riteLocalOf, riteFaithfulOf, RITE_REACH_M, RITE_WORD_MS, RITE_SUMMONER_CAREER, RITE_HELPERS_MAX } from '../src/net/gateRite.js';
import { gateTimes, gateSpotLocal, gateModsOf, gateBossOf, marksLine, GATE_COLLAPSE_MS } from '../src/net/gateLaw.js';
import { worldRoom, validRiteOut, RITE_COUNT_MAX, RITE_BY_MAX } from '../src/net/wire.js';
import { riteLayout, buildRiteModel, RITE_BRAZIERS, RITE_BRAZIER_R, RITE_BRAZIER_W, RITE_RING_R, RITE_TENT_R, RITE_SIGIL_LIFT, RITE_SIGIL_REACH, RITE_SIGIL_R, RITE_ALTAR } from '../src/world/riteModel.js';
import { GATE_PLINTH_RECORD, GATE_STONE_RECORD, RITE_SIGIL_RECORD, GATE_ARCHIVE } from '../src/world/gateModel.js';
import { riteSigilArt, RITE_SIGIL_ART_SIZE } from '../src/world/gateArt.js';
import { glslFunctions } from './glsl.mjs';
import {
  RiteSmokeRenderer, SMOKE_VS, SMOKE_FS, SMOKE_SEGMENTS, SMOKE_ROWS, SMOKE_MAX, SMOKE_FADE_MIN, SMOKE_FOOT_R, SMOKE_HEIGHT_M, SMOKE_COLOR, SMOKE_FOG_FLOOR,
  SMOKE_LIGHT_MIN, SMOKE_CLOCK_PERIOD, SMOKE_CLIMB_HEIGHTS, SMOKE_LEAN, SMOKE_TOP_R, SMOKE_SWELL, smokeBillowOf, smokeHeightOf, smokeVertices,
} from '../src/render/riteSmoke.js';
import { riteChestItems, riteChestOpened, markRiteChest, riteMemory, RITE_REAGENTS, RITE_HEART, RITE_BRAND_SET, RITE_CHEST_SAVE_VENDOR, RITE_DAY_SAVE_VENDOR } from '../src/systems/riteChest.js';
import { restoreModSaveRecords, modSaveRecords } from '../src/systems/modSaveData.js';
import { spoilsList, createSpoilsPool, SPOILS_TEXT } from '../src/scenes/spoilsPool.js';
import { gateClaimVerdict, GATE_CLAIM_TEXT, createGateClaims } from '../src/net/gateClaims.js';
import { mintReceipt, importReceiptKey } from '../src/net/gateReceipt.js';
import { createGateOmen, riteOmenLine } from '../src/systems/gateOmen.js';
import { ritePost, omenPost } from '../src/net/gateHerald.js';
import { isSigilStone } from '../src/systems/gateSpoils.js';
import { COURT_STRIKE_TEXT } from '../src/scenes/gateCourt.js';
import { properName } from '../src/systems/champions.js';
import { sayEnemyDied } from '../src/scenes/corpseMarker.js';
import { activateMobileEnemy } from '../src/player/mobileEnemyActivate.js';
import { isRiteSite, riteSiteId, WOD_SITE_RE } from '../src/world/wodShared.js';
import { groupCamps } from '../src/world/campShared.js';
import { OnlineSession } from '../src/net/online.js';
import { RELAY_VERSION, RITE_HZ_MAX } from '../src/net/wire.js';
import { fakeSocketClass } from './fakeSocket.mjs';
import { seededRng } from '../src/systems/wind.js';
import { sigilParty } from '../src/systems/sigil.js';
import { GLOBAL_SCALE } from '../src/player/activate.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAY = 700;
const T = gateTimes(DAY);
const PX = 300, PY = 200;
const SITE = { day: DAY, px: PX, py: PY, place: 'Copperham, Wrothgarian Mountains', near: 'Copperham' };
const SITE_ID = `${PX},${PY}:rite.${DAY}`;
const [E, N] = riteLocalOf(DAY);
const FACING = Math.atan2(gateSpotLocal(DAY)[0] - E, gateSpotLocal(DAY)[1] - N);
const FAITHFUL = riteFaithfulOf(DAY);
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
const fresh = () => restoreModSaveRecords({});
const BROKEN = (o = {}) => ({ k: 'br', d: DAY, px: PX, py: PY, at: 1, by: [], n: 0, ...o });

/** The host on a fake world: its foes a list, its words, lines, piles, meshes and buckets recorded - a new character
 *  (nothing seen, no chest opened) unless `keep`. */
function rig(over = {}, { keep = false } = {}) {
  if (!keep) fresh();
  let clock = T.omenAt + 60_000, feetAt = null;
  const r = {
    spawned: [], dropped: [], removed: [], reclaimed: [], words: [], said: [], near: [], sprung: [], unsprung: [], forgot: [], foes: [],
    peer: new Set(), heard: new Map(), struck: new Map(), piles: [], bare: [], meshes: [], destroyed: [], batches: [], unbatched: [], buckets: [], unbucketed: [], uploads: [], drawn: [],
  };
  let spawnOk = true;
  r.host = createRiteHost({
    now: () => clock, omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0],
    groundAt: () => 0, feet: () => feetAt, online: () => true,
    foes: {
      spawn: async (career, [x, z], o) => {
        r.spawned.push({ career, x, z, ...o });
        if (!spawnOk) return null;
        const f = { mobileType: career, site: o.site, transient: o.transient, ai: { feet: [x, 0, z], target: null }, entity: { maxHealth: 50, health: 50, name: 'Mage' }, dead: false, corpse: false };
        r.foes.push(f); return f;
      },
      list: () => r.foes,
      drop: (s) => { r.dropped.push(s); for (let i = r.foes.length - 1; i >= 0; i--) if (r.foes[i].site === s && !r.foes[i].puppet) r.foes.splice(i, 1); },
      remove: (f) => { r.removed.push(f); const i = r.foes.indexOf(f); if (i >= 0) r.foes.splice(i, 1); },
      reclaim: (s) => r.reclaimed.push(s),
      campId: () => 7,
    },
    peerSprang: (s) => r.peer.has(s), peerHeldAgo: (s) => (r.heard.has(s) ? clock - r.heard.get(s) : Infinity), forgetPeer: (s) => { r.forgot.push(s); r.peer.delete(s); },
    sprang: (s) => r.sprung.push(s), unsprang: (s) => r.unsprung.push(s), struckAt: (f) => r.struck.get(f) ?? null,
    send: (w, cell) => { r.words.push({ w, cell, t: clock }); return true; },
    say: (t) => r.said.push(t), sayNear: (t) => r.near.push(t), onBare: (...b) => r.bare.push(b),
    loot: { seed: (items, feet, key) => { const p = { id: r.piles.length + 1, items: [...items], feet, key, dead: false }; r.piles.push(p); return p; }, keyOf: (p) => `droppedLoot:${p.id}` },
    level: () => 10, rolls: seededRng(5), ...over,
  });
  r.set = (t) => { clock = t; };
  r.step = (ms) => { clock += ms; };
  r.now = () => clock;
  r.at = (m) => { feetAt = m == null ? null : [E + m, 0, N]; };   // m metres east of the circle's heart
  r.put = (x, z) => { feetAt = [x, 0, z]; };
  r.spawnOk = (v) => { spawnOk = v; };
  r.copy = (career, o = {}) => { const f = { puppet: 'peer-2', seq: r.foes.length + 100, mobileType: career, site: SITE_ID, entity: { name: 'x' }, ai: {}, dead: false, corpse: false, ...o }; r.foes.push(f); return f; };
  return r;
}
/** A renderer, a collider and the fire's art, recorded. */
function art(r, { frames = 1 } = {}) {
  let n = 0;
  return {
    renderer: {
      createMesh: (m) => { const mesh = { id: ++n, m }; r.meshes.push(mesh); return mesh; }, destroyMesh: (m) => r.destroyed.push(m), drawMesh: (m, mat) => r.drawn.push(m),
      uploadTexture: (ar, rec, img) => r.uploads.push([ar, rec, img.width]),
      createBillboardBatch: (a, rec, size, pos) => { const b = { pos, size }; r.batches.push(b); return b; }, destroyBillboardBatch: (b) => r.unbatched.push(b),
    },
    collider: () => ({ addMesh: (k, pos, idx, m) => r.buckets.push({ k, pos, idx, m }), removeBucket: (k) => r.unbucketed.push(k) }),
    getTexture: async () => ({ getFrameCount: () => frames, getSize: () => ({ width: 32, height: 40 }) }),
  };
}

test('WB12d the circle stands from the omen until its breach collapses - an early kill\'s collapse ending it (AUDIT WB12d R7) - its heart off the gate\'s spot, its site the day\'s; its smoke fades in over 8 s and thins over 30 s after the opening (mutants: the circle before the omen; the early kill unread; the smoke never rising; the smoke past the opening)', () => {
  const r = rig();
  r.set(T.omenAt - 1000);
  assert.equal(r.host.frame(), null, 'before the omen: nothing');
  assert.equal(r.host.smokes().length, 0);
  assert.deepEqual([RITE_SMOKE_IN_MS, RITE_SMOKE_OUT_MS], [8000, 30000], 'the bible\'s 8 s and 30 s');
  r.set(T.omenAt + 4000);
  r.host.frame();
  assert.deepEqual(r.host.state().heart, [E, 0, N]);
  assert.equal(r.host.state().site, SITE_ID);
  assert.equal(SITE_ID, riteSiteId(PX, PY, DAY));
  assert.ok(Math.abs(r.host.smokes()[0].fade - 0.5) < 1e-9, 'rising');
  r.set(T.omenAt + 8001); r.host.frame();
  assert.equal(r.host.smokes()[0].fade, 1);
  r.set(T.openAt + 15_000); r.host.frame();
  assert.ok(Math.abs(r.host.smokes()[0].fade - 0.5) < 1e-9, 'thinning after the opening');
  r.set(T.openAt + 30_001); r.host.frame();
  assert.equal(r.host.smokes().length, 0, 'gone - the circle still stands');
  assert.ok(r.host.state());
  r.set(T.wrathAt + GATE_COLLAPSE_MS);
  assert.equal(r.host.frame(), null, 'the breach collapsed: the circle goes');
  assert.ok(r.dropped.includes(SITE_ID) && r.unsprung.includes(SITE_ID), 'its faithful taken down, its site said by nobody');
  const [gx, gz] = gateSpotLocal(DAY);
  assert.ok(Math.hypot(E - gx, N - gz) >= 90 && Math.hypot(E - gx, N - gz) <= 180);
  const fell = T.openAt + 60_000;
  const k = rig({ fellAt: (d) => (d === DAY ? fell : null) });
  k.set(fell + GATE_COLLAPSE_MS - 1);
  assert.ok(k.host.frame(), 'collapsing');
  k.set(fell + GATE_COLLAPSE_MS);
  assert.equal(k.host.frame(), null, 'an early kill\'s collapse ends it');
});

test('WB12d the faithful: stood for a player within 100 m while the rite holds, online on a relay that keeps it and on built ground - the Summoner behind the altar, the rest on the ring facing it, one camp, chanting, the Summoner thrice a caster\'s health and called by his name; in no save; never twice; never while a peer holds them (mutants: sprung from anywhere; sprung twice; sprung offline; sprung on coarse ground; sprung after the opening; a peer\'s sprung again; the Summoner a caster\'s; a camp of strangers; saved)', async () => {
  const r = rig();
  assert.equal(RITE_SPRING_M, 100, 'the bible\'s 100 m');
  r.at(101);
  r.host.frame();
  assert.equal(r.spawned.length, 0, 'far off');
  r.at(99);
  r.host.frame();
  await settle();
  assert.deepEqual(r.spawned.map((s) => s.career), FAITHFUL.map((m) => m.career));
  assert.equal(r.spawned[0].career, RITE_SUMMONER_CAREER);
  assert.ok(r.spawned.every((s) => s.site === SITE_ID && s.transient === true), 'tagged with the day\'s site, in no save');
  assert.deepEqual(r.sprung, [SITE_ID], 'my spring said to the peers');
  const L = riteLayout(FACING);
  const s0 = r.spawned[0];
  assert.ok(Math.abs(s0.x - (E + L.summoner[0])) < 1e-9 && Math.abs(s0.z - (N + L.summoner[1])) < 1e-9 && s0.yaw === FACING, 'the Summoner\'s place, facing the gate');
  assert.ok(Math.sin(FACING) * (s0.x - E) + Math.cos(FACING) * (s0.z - N) < -1, 'behind the altar - away from the gate');
  const ring = L.ring(FAITHFUL.length - 1);
  r.spawned.slice(1).forEach((s, i) => { assert.ok(Math.abs(s.x - (E + ring[i][0])) < 1e-9 && Math.abs(s.z - (N + ring[i][1])) < 1e-9); assert.equal(s.yaw, ring[i][2]); });
  for (const f of r.foes) {
    assert.deepEqual([f.campId, f.entity.campId, f.campAlertRadius, f.ai.sightRadius], [7, 7, RITE_ALERT_M, RITE_SIGHT_M]);
    assert.equal(f.riteRole, f.mobileType === RITE_SUMMONER_CAREER ? 'summoner' : 'faithful');
  }
  assert.deepEqual([r.foes[0].entity.maxHealth, r.foes[0].entity.health], [150, 150], 'the Summoner: thrice');
  assert.equal(r.foes[0].entity.properName, RITE_TEXT.summoner);
  assert.equal(r.foes[1].entity.maxHealth, 50);
  assert.equal(r.foes[1].entity.properName, undefined, 'the faithful keep their careers in the classic lines');
  r.host.frame(); await settle();
  r.step(RITE_RESTAND_MS); r.host.frame(); await settle();
  assert.equal(r.spawned.length, FAITHFUL.length, 'once');
  r.foes.length = 0;   // taken from me alive (a handover): their heir holds them
  r.step(RITE_RESTAND_MS); r.host.frame(); await settle();
  assert.equal(r.spawned.length, FAITHFUL.length, 'never stood again by me');
  const held = rig();
  held.peer.add(SITE_ID); held.heard.set(SITE_ID, held.now());
  held.at(10); held.host.frame(); await settle();
  assert.equal(held.spawned.length, 0, 'a peer holds them: theirs stand');
  for (const [why, over, at] of [['offline', { online: () => false }, null], ['on coarse ground', { groundAt: () => NaN, coarseGround: () => 5 }, null], ['the breach open', {}, T.openAt + 1000]]) {
    const x = rig(over);
    if (at) x.set(at);
    x.at(10); x.host.frame(); await settle();
    assert.equal(x.spawned.length, 0, why);
  }
});

test('AUDIT WB12d (R1): the hub\'s word that the rite is broken stops no stand - the survivors stand, never the Summoner; another circle\'s word stops nothing (mutants: nothing stood once broken; the Summoner stood once broken; another circle\'s word believed)', async () => {
  const b = rig();
  b.host.onBroken(BROKEN());
  b.at(10); b.host.frame(); await settle();
  assert.deepEqual(b.spawned.map((s) => s.career), FAITHFUL.slice(1).map((m) => m.career), 'the faithful, the Summoner fallen');
  const o = rig();
  o.host.onBroken(BROKEN({ px: PX + 1 }));
  o.at(10); o.host.frame(); await settle();
  assert.equal(o.spawned.length, FAITHFUL.length, 'a lie at another pixel');
  assert.equal(o.host.state().broken, false);
  assert.equal(o.host.isBroken(DAY, PX, PY), false);
  assert.equal(o.host.isBroken(DAY, PX + 1, PY), true);
});

test('AUDIT WB12d (C1, C2): what the character saw is the stand - the slain by their kind and the Summoner\'s fall (in the save), a copy counted once, one gone without a body no death; a peer\'s that went quiet is stood again, the peer\'s spring forgotten and the site taken back (mutants: every one stood again; a copy counted twice; the walked-away counted; never stood again; stood while the peer speaks)', async () => {
  fresh();
  const r = rig();
  r.peer.add(SITE_ID); r.heard.set(SITE_ID, r.now());
  r.at(20); r.host.frame(); await settle();
  const [mage] = FAITHFUL.slice(1);
  const a = r.copy(mage.career, { seq: 5 }), b = r.copy(RITE_SUMMONER_CAREER, { seq: 6 }), c = r.copy(FAITHFUL[2].career, { seq: 7 });
  r.host.frame();
  assert.equal(r.host.state().copies, 3);
  a.dead = true; a.corpse = true; c.dead = true;   // one slain, one gone without a body
  r.host.frame(); r.host.frame();
  r.foes.splice(r.foes.indexOf(a), 1); r.copy(mage.career, { seq: 5, dead: true, corpse: true });   // its copy stood again, dead
  r.host.frame();
  assert.deepEqual(riteMemory(DAY).slain, { [mage.career]: 1 }, 'one death, once');
  assert.equal(riteMemory(DAY).fell, 0);
  b.dead = true; b.corpse = true; r.host.frame();
  assert.equal(riteMemory(DAY).fell, 1, 'his fall seen on a copy');
  assert.equal(modSaveRecords()[RITE_DAY_SAVE_VENDOR].fell, 1, 'in the save');
  for (const f of [...r.foes]) if (f.puppet) r.foes.splice(r.foes.indexOf(f), 1);   // their owner gone, the copies with them
  r.step(RITE_ORPHAN_MS - 1); r.host.frame(); await settle();
  assert.equal(r.spawned.length, 0, 'the peer spoke less than RITE_ORPHAN_MS ago');
  r.step(1); r.host.frame(); await settle();
  assert.deepEqual(r.forgot, [SITE_ID]);
  assert.deepEqual(r.reclaimed, [SITE_ID]);
  const want = FAITHFUL.slice(1).map((m) => m.career);
  want.splice(want.indexOf(mage.career), 1);
  assert.deepEqual(r.spawned.map((s) => s.career), want, 'the survivors: never the Summoner, never the slain');
  fresh();
});

test('AUDIT WB12d: a stand that stood nothing claims nothing - said by nobody again, tried after RITE_RESTAND_MS; a stand landing after its circle went, or after the opening, is taken down alone (mutants: an empty claim kept; tried every frame; the late one kept; the late one taking its site down)', async () => {
  const r = rig();
  r.spawnOk(false);
  r.at(10); r.host.frame(); await settle();
  assert.deepEqual(r.sprung, [SITE_ID]);
  assert.deepEqual(r.unsprung, [SITE_ID], 'nothing landed: let go');
  r.host.frame(); await settle();
  assert.equal(r.spawned.length, FAITHFUL.length, 'not every frame');
  r.spawnOk(true);
  r.step(RITE_RESTAND_MS); r.host.frame(); await settle();
  assert.equal(r.host.state().own, 0); r.host.frame();
  assert.equal(r.host.state().own, FAITHFUL.length, 'tried again');
  let release;
  const gate = new Promise((res) => { release = res; });
  const late = rig({ foes: null });
  const lf = [];
  const host = createRiteHost({ now: () => late.now(), omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0], groundAt: () => 0, feet: () => [E + 10, 0, N], online: () => true,
    foes: { spawn: async (career, xz, o) => { await gate; const f = { mobileType: career, site: o.site, ai: {}, entity: {} }; lf.push(f); return f; }, list: () => lf, drop: (s) => late.dropped.push(s), remove: (f) => late.removed.push(f), campId: () => 1 } });
  host.frame();
  late.set(T.wrathAt + GATE_COLLAPSE_MS); host.frame();
  release(); await settle();
  assert.equal(late.removed.length, FAITHFUL.length, 'each one that landed late, taken down');
  assert.deepEqual(late.dropped, [SITE_ID], 'the site dropped once, at the circle\'s going - never by a late one');
  let open;
  const held = new Promise((res) => { open = res; });
  const o = rig({ foes: null });
  const of = [], gone = [];
  const oh = createRiteHost({ now: () => o.now(), omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0], groundAt: () => 0, feet: () => [E + 10, 0, N], online: () => true,
    foes: { spawn: async (career, xz, opt) => { await held; const f = { mobileType: career, site: opt.site, ai: {}, entity: {} }; of.push(f); return f; }, list: () => of, drop: () => {}, remove: (f) => gone.push(f), campId: () => 1 } });
  oh.frame();
  o.set(T.openAt + 10); oh.frame();
  open(); await settle();
  assert.equal(gone.length, FAITHFUL.length, 'landing after the breach opened: taken down, the circle still standing');
  assert.ok(oh.state());
  // AUDIT WB12d (T): a stand landing after its circle went - a teleport while the rite still holds
  let land;
  const away = new Promise((res) => { land = res; });
  const tp = rig({ foes: null });
  const tf = [], tgone = [];
  const th = createRiteHost({ now: () => tp.now(), omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0], groundAt: () => 0, feet: () => [E + 10, 0, N], online: () => true,
    foes: { spawn: async (career, xz, opt) => { await away; const f = { mobileType: career, site: opt.site, ai: {}, entity: {} }; tf.push(f); return f; }, list: () => tf, drop: () => {}, remove: (f) => tgone.push(f), campId: () => 1 } });
  th.frame();
  th.destroyAll();
  assert.ok(tp.now() < T.openAt, 'the rite still holds');
  land(); await settle();
  assert.equal(tgone.length, FAITHFUL.length, 'its circle gone: each one that landed, taken down');
});

test('WB12d every screen names the faithful - a copy too, the Summoner by his kind (his own name in the classic lines); a copy a Wabbajack changed keeps its kind\'s; a foe of another site is none of them; one woken wakes my own, a blow on one that never saw its striker too (mutants: the copies unnamed; another site\'s named; no wake; another site\'s woken)', async () => {
  const r = rig();
  r.at(10); r.host.frame(); await settle();
  const sum = r.copy(RITE_SUMMONER_CAREER, { entity: { name: 'Sorcerer' } }), bm = r.copy(130, { entity: { name: 'Battlemage' } }), rat = r.copy(0, { entity: { name: 'Rat' } });
  const bandit = { mobileType: 130, site: `${PX},${PY}:5`, entity: { name: 'Bandit' }, ai: { target: null } };
  r.foes.push(bandit); r.struck.set(bandit, 99);
  r.host.frame();
  assert.equal(r.foes[0].entity.name, RITE_TEXT.summoner);
  assert.ok(r.foes.slice(1, FAITHFUL.length).every((f) => f.entity.name === RITE_TEXT.faithful));
  assert.deepEqual([sum.entity.name, sum.entity.properName, bm.entity.name, bm.entity.properName, rat.entity.name], [RITE_TEXT.summoner, RITE_TEXT.summoner, RITE_TEXT.faithful, undefined, 'Rat']);
  assert.equal(bandit.entity.name, 'Bandit');
  r.foes[2].ai.target = 'the-player';
  r.step(1); r.host.frame();
  assert.ok(r.foes.filter((f) => !f.puppet && f.site === SITE_ID).every((f) => f.ai.target === 'the-player'), 'woken together');
  assert.ok([sum, bm].every((f) => f.ai.target === undefined), 'a copy is its owner\'s to wake');
  assert.equal(bandit.ai.target, null, 'a bandit is not woken');
  assert.equal(r.words.at(-1).w.s, 0, 'a blow on a bandit is no blow on the faithful');
  const far = rig();
  far.at(10); far.host.frame(); await settle();
  far.at(RITE_TEND_M + 10);
  const c = far.copy(RITE_SUMMONER_CAREER, { entity: { name: 'Sorcerer' } });
  far.host.frame();
  assert.equal(c.entity.name, 'Sorcerer', 'tended only within RITE_TEND_M (AUDIT WB12d C13)');
});

test('WB12d the word: to the circle\'s cell every 5 s while the rite holds, at once when it changes and once more a second after (AUDIT WB12d L4); said from inside 55 m alone, never once the breach opens; a Summoner who walked away is no fall, a faithful slain no fall; a word not sent is said again at once (mutants: said from anywhere; said from 60 m; never at once; never again; said after the opening; a fall without a body; any faithful breaks it; stamped unsent)', async () => {
  assert.equal(RITE_SAY_REACH_M, RITE_REACH_M - 5);
  const r = rig();
  r.at(10); r.host.frame(); await settle();
  assert.deepEqual(r.words.map((x) => x.w), [{ d: DAY, px: PX, py: PY, s: 0, f: 0, c: 0 }]);
  assert.equal(r.words[0].cell, worldRoom(PX, PY));
  r.host.frame();
  assert.equal(r.words.length, 1, 'not every frame');
  r.step(4999); r.host.frame();
  assert.equal(r.words.length, 1, 'not before 5 s');
  r.step(1); r.host.frame();
  assert.equal(r.words.length, 2, 'every 5 s (the bible\'s)');
  assert.equal(RITE_WORD_MS, 5000);
  r.struck.set(r.foes[3], 123);
  r.step(1); r.host.frame();
  assert.deepEqual(r.words.at(-1).w, { d: DAY, px: PX, py: PY, s: 1, f: 0, c: 0 }, 'struck: at once');
  r.step(RITE_RESAY_MS - 2); r.host.frame();
  assert.equal(r.words.length, 3);
  r.step(2); r.host.frame();
  assert.equal(r.words.length, 4, 'and once more a second after');
  r.step(RITE_RESAY_MS); r.host.frame();
  assert.equal(r.words.length, 4, 'once');
  const one = r.foes.find((f) => f.mobileType !== RITE_SUMMONER_CAREER && !f.dead);
  one.dead = true; one.corpse = true;
  r.step(1); r.host.frame();
  assert.equal(r.words.at(-1).w.f, 0, 'one of the faithful slain is no fall');
  r.foes[0].dead = true;
  r.step(1); r.host.frame();
  assert.equal(r.words.at(-1).w.f, 0, 'gone without a body: walked away, no fall');
  r.foes[0].corpse = true;
  r.host.frame();
  assert.deepEqual(r.words.at(-1).w, { d: DAY, px: PX, py: PY, s: 1, f: 1, c: 0 }, 'the Summoner fallen: at once');
  // BROKER-CAGE: every one of them fallen - `c`, at once
  for (const f of r.foes.filter((x) => !x.dead).slice(1)) { f.dead = true; f.corpse = true; }
  r.step(1); r.host.frame();
  assert.equal(r.words.at(-1).w.c, 0, 'one of the faithful still standing: not all');
  for (const f of r.foes) { f.dead = true; f.corpse = true; }
  r.step(1); r.host.frame();
  assert.deepEqual(r.words.at(-1).w, { d: DAY, px: PX, py: PY, s: 1, f: 1, c: 1 }, 'every one of them fallen: at once');
  const n = r.words.length;
  r.at(RITE_SAY_REACH_M + 1); r.step(RITE_WORD_MS); r.host.frame();
  assert.equal(r.words.length, n, 'past 55 m');
  r.at(RITE_SAY_REACH_M - 1); r.host.frame();
  assert.equal(r.words.length, n + 1, 'inside');
  r.at(5); r.set(T.openAt); r.host.frame();
  assert.equal(r.words.length, n + 1, 'the breach open: the rite is over');
  let ok = false;
  const sent = [];
  const u = rig({ send: (w) => { sent.push(w); return ok; } });
  u.at(10); u.host.frame();
  ok = true; u.step(1); u.host.frame();
  assert.equal(sent.length, 2, 'unsent: said again at once');
});

test('WB12d the opening: the faithful still standing pass into the breach - mine taken down, the site kept - said once, broken or not (AUDIT WB12d D6), to a player within 100 m; nothing standing, nothing said (mutants: they stay; the line over a broken rite unsaid; said to everyone; said every frame; the dead pass)', async () => {
  const r = rig();
  r.at(10); r.host.frame(); await settle();
  r.copy(130);
  r.set(T.openAt + 100); r.host.frame(); r.host.frame();
  assert.deepEqual(r.dropped, [SITE_ID]);
  assert.equal(r.foes.filter((f) => !f.puppet).length, 0);
  assert.deepEqual(r.near, [RITE_TEXT.pass]);
  r.host.destroyAll(); r.host.frame();   // a teleport and back, a peer's copy still standing
  assert.deepEqual(r.near, [RITE_TEXT.pass], 'once for the character');
  assert.equal(RITE_TEXT.pass, 'The faithful pass into the breach.');
  fresh();
  const b = rig();
  b.at(10); b.host.frame(); await settle();
  b.host.onBroken(BROKEN());
  b.set(T.openAt + 100); b.host.frame();
  assert.deepEqual(b.near, [RITE_TEXT.pass], 'broken: the survivors pass too');
  fresh();
  const far = rig();
  far.at(10); far.host.frame(); await settle();
  far.at(RITE_SPRING_M + 50); far.set(T.openAt + 100); far.host.frame();
  assert.deepEqual(far.near, []);
  assert.deepEqual(far.dropped, [SITE_ID], 'taken down wherever I stand');
  fresh();
  const dead = rig();
  dead.at(10); dead.host.frame(); await settle();
  for (const f of dead.foes) { f.dead = true; f.corpse = true; }
  dead.set(T.openAt + 100); dead.host.frame();
  assert.deepEqual(dead.near, []);
  fresh();
});

test('WB12d the hub\'s word: this circle\'s alone (AUDIT WB12d R1), said once while the rite holds and its place is known - a word heard before the omen said when the circle stands (AUDIT WB12d D1), never after the opening, never twice for the character (in the save) - with the first names and how many more (AUDIT WB12d D4) (mutants: another circle\'s said; said at every hello; said before the place; said after the opening; the names unsaid; the count unsaid)', () => {
  fresh();
  const r = rig({ omen: () => null });
  r.host.onBroken(BROKEN({ by: ['Ann', 'Bo', 'Cy', 'Di'], n: 6 }));
  r.host.onBroken(BROKEN({ px: PX + 1, by: ['Liar'] }));
  r.host.frame();
  assert.deepEqual(r.said, [], 'no circle yet: kept');
  const h = rig();
  h.host.onBroken(BROKEN({ px: PX + 1, by: ['Liar'] }));
  h.host.frame();
  assert.deepEqual(h.said, [], 'another circle\'s');
  h.host.onBroken(BROKEN({ by: ['Ann', 'Bo', 'Cy', 'Di'], n: 6 }));
  h.host.onBroken(BROKEN({ by: ['Ann', 'Bo', 'Cy', 'Di'], n: 6 }));
  h.host.frame(); h.host.frame();
  assert.deepEqual(h.said, ['The faithful\'s rite is broken near Copperham, by Ann, Bo, Cy and 3 others.']);
  assert.equal(riteMemory(DAY).saidBroken, 1);
  const again = rig({}, { keep: true });
  again.host.onBroken(BROKEN({ by: ['Ann'] }));
  again.host.frame();
  assert.deepEqual(again.said, [], 'said for this character already');
  fresh();
  let site = { ...SITE, near: null };
  const late = rig({ omen: () => ({ site }) });
  late.host.onBroken(BROKEN({ by: ['Ann'], n: 2 }));
  late.host.frame();
  assert.deepEqual(late.said, [], 'not before its place');
  site = SITE; late.host.frame();
  assert.deepEqual(late.said, ['The faithful\'s rite is broken near Copperham, by Ann and 1 other.']);
  fresh();
  const open = rig();
  open.set(T.openAt + 1000);
  open.host.onBroken(BROKEN({ by: ['Ann'] }));
  open.host.frame();
  assert.deepEqual(open.said, [], 'old news after the opening');
  assert.equal(RITE_TEXT.broken({ near: 'X', by: [], n: 4 }), 'The faithful\'s rite is broken near X.');
  assert.equal(RITE_TEXT.broken({ near: 'X', by: ['A', 'B'], n: 2 }), 'The faithful\'s rite is broken near X, by A and B.');
  fresh();
});

test('WB12d the casket: sealed, named and said so until the rite is broken; then a pile within 40 m for the opener\'s level, dying with its pixel, wearing the chest\'s name - AUDIT WB12d (C4, C9, D8): opened is anything changed in it (a stack split, a piece swapped), the day the character\'s at once; its own target gone while the pile holds anything; emptied, it says Opened; gone untouched, seeded again (mutants: open before the word; seeded from afar; a stack split unseen; a swap unseen; the target back over the pile; the name lost; never seeded again)', () => {
  fresh();
  const r = rig();
  r.at(5); r.host.frame();
  const tg = r.host.targets();
  assert.equal(tg.length, 1);
  assert.equal(tg[0].key, `rite:${DAY}`);
  assert.deepEqual(r.host.hoverName(tg[0].key), { title: 'The Faithful\'s Chest', subs: ['Sealed'] });
  assert.equal(r.host.activate(tg[0].key), true);
  assert.deepEqual(r.near, [RITE_TEXT.sealed]);
  assert.equal(r.host.activate(`gate:${DAY}`), false);
  assert.equal(r.host.hoverName(`gate:${DAY}`), null);
  assert.equal(r.piles.length, 0);
  r.host.onBroken(BROKEN());
  assert.deepEqual(r.host.hoverName(tg[0].key).subs, [], 'broken: not sealed');
  r.host.activate(tg[0].key);
  assert.deepEqual(r.near, [RITE_TEXT.sealed], 'a press on a broken rite\'s casket says nothing');
  r.host.frame();
  assert.equal(r.piles.length, 1);
  assert.equal(r.piles[0].key, `${PX},${PY}`, 'it dies with its pixel');
  assert.equal(r.piles[0].items[0].group, 'Currency');
  assert.ok(r.piles[0].items[0].stackCount >= 200 && r.piles[0].items[0].stackCount <= 400, 'gold for level 10');
  assert.equal(r.host.targets().length, 0, 'the pile is the thing to press');
  assert.deepEqual(r.host.hoverName('droppedLoot:1'), { title: RITE_TEXT.chest });
  assert.equal(r.host.hoverName('droppedLoot:9'), null, 'another pile is not it');
  r.host.frame();
  assert.equal(riteChestOpened(DAY), false, 'looked at, untouched');
  r.piles[0].items[0] = { ...r.piles[0].items[0] }; r.piles[0].items.reverse(); r.piles[0].items.reverse();
  r.host.frame();
  assert.equal(riteChestOpened(DAY), true, 'a piece swapped');
  assert.deepEqual(modSaveRecords()[RITE_CHEST_SAVE_VENDOR], { day: DAY });
  assert.equal(r.host.targets().length, 0, 'still the pile\'s place');
  assert.deepEqual(r.host.hoverName('droppedLoot:1'), { title: RITE_TEXT.chest }, 'and its name');
  r.piles[0].items.length = 0;
  r.host.frame();
  assert.equal(r.host.targets().length, 1, 'emptied: the casket again');
  assert.deepEqual(r.host.hoverName(`rite:${DAY}`).subs, [RITE_TEXT.openedSub]);
  r.host.frame(); r.host.frame();
  assert.equal(r.piles.length, 1, 'never again that day');
  fresh();
  const s = rig();
  s.host.onBroken(BROKEN());
  s.at(RITE_CHEST_SEED_M + 5); s.host.frame();
  assert.equal(s.piles.length, 0, 'not from afar');
  s.at(RITE_CHEST_SEED_M - 5); s.host.frame();
  assert.equal(s.piles.length, 1);
  const gold = s.piles[0].items[0];
  gold.stackCount -= 1;
  s.host.frame();
  assert.equal(riteChestOpened(DAY), true, 'a stack split');
  fresh();
  const d = rig();
  d.host.onBroken(BROKEN());
  d.at(5); d.host.frame();
  d.piles[0].dead = true;
  d.host.frame(); d.host.frame();
  assert.equal(d.piles.length, 2, 'gone with its pixel untouched: seeded again');
  assert.equal(riteChestOpened(DAY), false);
  const lv = rig({ level: () => 30 });
  lv.host.onBroken(BROKEN()); lv.at(5); lv.host.frame();
  assert.ok(lv.piles[0].items[0].stackCount >= 600, `${lv.piles[0].items[0].stackCount}`);
  // AUDIT WB12d (lens T F18): never on ground not yet built - seeded once its pixel is
  fresh();
  let built = false;
  const g = rig({ groundAt: () => (built ? 0 : NaN) });
  g.host.onBroken(BROKEN()); g.at(5); g.host.frame();
  assert.equal(g.piles.length, 0, 'its pixel unbuilt: no pile');
  built = true; g.host.frame();
  assert.equal(g.piles.length, 1, 'built: seeded');
  fresh();
});

test('WB12d what a frame pays for (AUDIT WB C7, AUDIT WB12d C13, G7): no circle, the one frozen empty list; the casket\'s target and the matrices made once a heart; the lights the same two - the braziers\' glow at the heart and the camp\'s fire - wherever the player walks in their reach; the flames one frozen list (mutants: a new list a frame; the target made every frame; the matrices every draw; the nearest of seven lights)', () => {
  let t0 = [0, 0, 0];
  const drawn = [];
  const r = rig({ pixelTranslation: () => t0, renderer: { createMesh: () => ({}), drawMesh: (m, mat) => drawn.push(mat) } });
  r.set(T.omenAt - 1000); r.host.frame();
  const none = r.host.lights();
  assert.ok(Object.isFrozen(none) && none.length === 0);
  for (const l of [r.host.targets(), r.host.batches(), r.host.smokes()]) assert.equal(l, none);
  assert.equal(r.host.smoking(), false);
  r.set(T.omenAt + 60_000); r.at(5); r.host.frame();
  const tg = r.host.targets(), lit = r.host.lights();
  assert.equal(lit.length, 2);
  assert.deepEqual(lit.map((l) => l.range), [RITE_GLOW_RANGE, 12]);
  assert.deepEqual([lit[0].x, lit[0].z], [E, N], 'the glow at the heart');
  const L = riteLayout(FACING);
  assert.ok(Math.abs(lit[1].x - (E + L.fire[0])) < 1e-9 && Math.abs(lit[1].z - (N + L.fire[1])) < 1e-9, 'the fire\'s at the fire');
  for (let a = 0; a < 2 * Math.PI; a += Math.PI / 6) {   // a lap round the braziers, 30 m out: the same two, the same list
    r.put(E + Math.cos(a) * 30, N + Math.sin(a) * 30); r.host.frame();
    assert.equal(r.host.lights(), lit);
  }
  r.at(RITE_LIGHT_REACH_M + 1); assert.equal(r.host.lights().length, 0, 'out of reach');
  r.at(5);
  r.host.frame(); r.host.draw(); r.host.frame(); r.host.draw();
  assert.equal(r.host.targets(), tg, 'one target while the heart stands still');
  assert.equal(drawn.length, 4, 'the stone and the sigil, twice');
  assert.ok(drawn.every((m) => m === drawn[0]), 'one matrix');
  t0 = [512, 0, 0]; r.host.frame(); r.host.draw();
  assert.notEqual(r.host.targets(), tg, 'moved: made again');
  assert.ok(Math.abs(drawn[4][12] - drawn[3][12] - 512) < 1e-3, 'with the heart');
  r.put(E + 512 + 5, N);
  assert.equal(r.host.lights()[0].x, E + 512, 'the lights with it');
});

test('AUDIT WB12d (G1, G4, G18, C10): the stone is made again when its ground moves - a coarse ring\'s ground built finer - its old mesh freed, its flames and collider stood again; a recentre moves them without a new mesh; the collider takes the stone alone; a build that throws is tried again only on new ground; the circle\'s going frees them all (mutants: keyed on the day; the old mesh leaked; the collider never stood; the sigil in the collider; retried every frame; nothing freed)', async () => {
  let lift = 0, t0 = [0, 0, 0];
  const r = rig({ pixelTranslation: () => t0 });
  const a = art(r);
  const h = createRiteHost({ ...a, now: () => r.now(), omen: () => ({ site: SITE }), pixelTranslation: () => t0, feet: () => [E + t0[0] + 5, 0, N], groundAt: (x, z) => (Math.hypot(x - E - t0[0], z - N - t0[2]) > 7 ? lift : 0) });   // the land rides the scene's frame
  h.frame(); await settle(); h.frame();
  assert.equal(r.meshes.length, 2, 'the stone and the sigil');
  assert.ok(r.meshes[0].m.subMeshes.every((s) => s.textureRecord === GATE_STONE_RECORD), 'the stone');
  assert.ok(r.meshes[1].m.subMeshes.every((s) => s.textureRecord === RITE_SIGIL_RECORD), 'the sigil, apart');
  const up = r.uploads.filter(([ar]) => ar === GATE_ARCHIVE);
  assert.deepEqual(up.map(([, rec, w]) => [rec, w]), [[GATE_STONE_RECORD, 64], [GATE_PLINTH_RECORD, 64], [RITE_SIGIL_RECORD, RITE_SIGIL_ART_SIZE]], 'its art up once, the sigil\'s own with it');
  assert.equal(new Set(up.map(([, rec]) => rec)).size, up.length, 'each art its own record - the gate\'s plinth never wears the sigil');
  assert.equal(r.batches.length, RITE_FLAME_PHASES, 'the flames, in their batches');
  const [even, odd, camp] = r.batches, L = riteLayout(FACING);
  assert.equal(even.pos.length + odd.pos.length + camp.pos.length, RITE_BRAZIERS + 2, 'a flame on each brazier, on the altar - the smoke\'s own fire - and the camp\'s');
  assert.equal(odd.pos.length, RITE_BRAZIERS / 2, 'AUDIT WB12d (G19): every other brazier its own batch');
  assert.deepEqual(even.pos.at(-1).map((v) => +v.toFixed(6)), [+E.toFixed(6), +RITE_ALTAR.h.toFixed(6), +N.toFixed(6)], 'the altar\'s on its top, under the smoke');
  assert.ok(Math.abs(camp.pos[0][0] - (E + L.fire[0])) < 1e-9, 'the camp\'s at its fire');
  assert.ok(camp.size.w === 32 * GLOBAL_SCALE && Math.abs(even.size.w - camp.size.w * RITE_FLAME_SCALE) < 1e-9 && odd.size.w === even.size.w && even.size.w < camp.size.w, 'the camp\'s fire a camp fire\'s size (scenes/camps.js), the braziers\' smaller');
  assert.equal(r.buckets.length, 1);
  const bk = r.buckets[0];
  assert.equal(bk.k, RITE_BUCKET);
  assert.equal(bk.idx.length, buildRiteModel(FACING, () => 0, { sigil: false }).indices.length, 'the stone alone - the sigil is the ground\'s');
  assert.ok(Math.abs(bk.m[12] - E) < 1e-3, 'at the heart');
  for (let i = 0; i < RITE_GROUND_EVERY * 2; i++) h.frame();
  assert.equal(r.meshes.length, 2, 'still ground: one make');
  lift = 0.5;
  for (let i = 0; i < RITE_GROUND_EVERY; i++) h.frame();
  assert.equal(r.meshes.length, 4, 'new ground: made again');
  assert.deepEqual(r.destroyed, [r.meshes[0], r.meshes[1]], 'the old ones freed');
  assert.ok(r.meshes[2].m.positions.some((v, i) => i % 3 === 1 && v > 0.4), 'on the new ground');
  assert.equal(r.batches.length, RITE_FLAME_PHASES * 2, 'the flames stood again');
  assert.deepEqual(r.unbatched, r.batches.slice(0, RITE_FLAME_PHASES));
  assert.equal(r.buckets.length, 2, 'the collider stood again');
  t0 = [256, 0, 0]; h.frame();
  assert.equal(r.meshes.length, 4, 'a recentre: no new mesh');
  assert.ok(Math.abs(r.buckets.at(-1).m[12] - (E + 256)) < 1e-3, 'the collider with the heart');
  assert.equal(r.batches.length, RITE_FLAME_PHASES * 3);
  // a throw: not again until the ground moves
  let throws = 0;
  const bad = createRiteHost({ ...a, renderer: { ...a.renderer, createMesh: () => { throws++; throw new Error('no'); } }, now: () => r.now(), omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0], groundAt: () => lift });
  const warn = console.warn; console.warn = () => {};
  try { for (let i = 0; i < 5; i++) bad.frame(); } finally { console.warn = warn; }
  assert.equal(throws, 1, 'once');
  // the going
  const removedBefore = r.unbucketed.length;
  r.set(T.wrathAt + GATE_COLLAPSE_MS); h.frame();
  assert.deepEqual(r.unbucketed.slice(removedBefore), [RITE_BUCKET], 'its collider taken down');
  assert.ok(r.destroyed.includes(r.meshes[2]) && r.destroyed.includes(r.meshes[3]), 'the meshes freed');
  assert.ok(r.batches.slice(-RITE_FLAME_PHASES).every((b) => r.unbatched.includes(b)), 'the flames');
  // AUDIT WB12d (G19): the batches a third of their cycle apart, whatever the clock
  const q = rig();
  const qa = art(q, { frames: 6 });
  const qh = createRiteHost({ ...qa, now: () => q.now(), omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0], groundAt: () => 0 });
  qh.frame(); await settle(); qh.frame();
  for (const dt of [0.01, 0.2, 0.37, 1.1]) {
    qh.tick(dt);
    const f = q.batches.map((b) => b.frame);
    assert.deepEqual(f.map((x) => (x - f[0] + 6) % 6), [0, 2, 4], `out of step (${f})`);
  }
});

test('AUDIT WB12d (G14): the smoke\'s pass is built by the frame - before the renderer\'s own - and shows only above the one threshold the pass draws by; a pass asked to draw always draws (mutants: built in the draw; two thresholds; drawn with no pass)', () => {
  const r = rig();
  const { gl, calls } = fakeGl();
  const h = createRiteHost({ now: () => r.now(), omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0], groundAt: () => 0, gl });
  r.set(T.omenAt + RITE_SMOKE_IN_MS * SMOKE_FADE_MIN * 0.5); h.frame();
  assert.equal(h.smoking(), false, 'at the threshold: no smoke');
  assert.equal(calls.filter((c) => c[0] === 'createVertexArray').length, 0, 'and no pass');
  r.set(T.omenAt + 1000); h.frame();
  assert.equal(calls.filter((c) => c[0] === 'createVertexArray').length, 1, 'built in the frame');
  assert.equal(h.smoking(), true);
  assert.equal(h.drawSmoke(I, I, [0, 0, 0], 5), 1, 'asked, it draws');
  assert.equal(createRiteHost({ now: () => r.now(), omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0] }).drawSmoke(I, I, [0, 0, 0], 5), 0);
  assert.match(read('src/render/riteSmoke.js'), /s\.fade > SMOKE_FADE_MIN\)\.slice\(0, SMOKE_MAX\)/);
});

test('AUDIT WB12d (G2): the burned earth - the circle says where no grass grows (its heart, past its braziers) and asks the grass placed there to be placed again when it stands and when it goes (mutants: no clearing; never placed again; placed again where it is no longer)', () => {
  let t0 = [0, 0, 0];
  const r = rig({ pixelTranslation: () => t0, groundAt: () => NaN });
  r.host.frame();
  assert.equal(r.bare.length, 0, 'not on unbuilt ground');
  const r2 = rig({ pixelTranslation: () => t0 });
  r2.host.frame(); r2.host.frame();
  const box = [E - RITE_BARE_R, N - RITE_BARE_R, E + RITE_BARE_R, N + RITE_BARE_R];
  assert.deepEqual(r2.bare, [box], 'once, when it stands');
  assert.ok(RITE_BARE_R > RITE_BRAZIER_R && RITE_BARE_R > RITE_SIGIL_R);
  const c = r2.host.clearing();
  assert.deepEqual([c.x, c.z, c.r, c.key], [E, N, RITE_BARE_R, `${DAY}:${PX},${PY}`]);
  t0 = [100, 0, 0];
  r2.set(T.wrathAt + GATE_COLLAPSE_MS); r2.host.frame();
  assert.deepEqual(r2.bare.at(-1), [E + 100 - RITE_BARE_R, N - RITE_BARE_R, E + 100 + RITE_BARE_R, N + RITE_BARE_R], 'gone: placed again where the scene has it now');
  assert.equal(r2.host.clearing(), null);
  const w = read('src/scenes/world.js');
  assert.match(w, /const _bare = riteHost\?\.clearing\(\) \?\? null;/);
  assert.match(w, /if \(_bare && \(x - _bare\.x\) \* \(x - _bare\.x\) \+ \(z - _bare\.z\) \* \(z - _bare\.z\) <= _bare\.r \* _bare\.r\) return null;/);
  assert.match(w, /onBare: \(x0, z0, x1, z1\) => labGrassField\?\.invalidate\(x0, z0, x1, z1\),/);
});

test('WB12d the circle\'s stone: the sigil faces up and rides the land - over the ground everywhere, a fold of it too; the altar, the casket and the braziers sunk at their lowest corner on a slope; six braziers ring it, the faithful\'s ring leaves its gap toward the gate and their camp stands behind (mutants: the sigil under the land; standing on air)', () => {
  const facing = 0.9;
  const sigilOf = (m) => m.subMeshes.find((s) => s.textureRecord === RITE_SIGIL_RECORD);
  const tris = (m, sm) => Array.from({ length: sm.primitiveCount }, (_, t) => [0, 1, 2].map((k) => { const i = (sm.startIndex + t * 3 + k) * 3; return [m.positions[i], m.positions[i + 1], m.positions[i + 2]]; }));
  const slope = (x, z) => 0.1 * x - 0.05 * z;
  const m = buildRiteModel(facing, slope);
  const sig = sigilOf(m);
  for (const [t, tri] of tris(m, sig).entries()) {
    for (const [x, y, z] of tri) assert.ok(y >= slope(x, z) + RITE_SIGIL_LIFT - 1e-5 && y <= slope(x, z) + RITE_SIGIL_LIFT + RITE_SIGIL_REACH * Math.hypot(0.1, 0.05) + 1e-5, 'on the ground');
    assert.ok(m.normals[(sig.startIndex + t * 3) * 3 + 1] > 0, 'facing up');
  }
  const fold = (x, z) => 2 - 0.45 * Math.abs(0.6 * x + 0.8 * z - 0.37);
  const fm = buildRiteModel(facing, fold);
  let worst = Infinity;
  for (const [a, b, c] of tris(fm, sigilOf(fm))) {
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8 - i; j++) {
      const u = i / 8, v = j / 8, w = 1 - u - v;
      const x = a[0] * w + b[0] * u + c[0] * v, y = a[1] * w + b[1] * u + c[1] * v, z = a[2] * w + b[2] * u + c[2] * v;
      worst = Math.min(worst, y - fold(x, z));
    }
  }
  assert.ok(worst > 0, `the land shows through the sigil by ${-worst} m`);
  let span = 0;
  for (const t of tris(m, sig)) for (let k = 0; k < 3; k++) span = Math.max(span, Math.hypot(t[k][0] - t[(k + 1) % 3][0], t[k][2] - t[(k + 1) % 3][2]));
  assert.ok(span <= 2 * RITE_SIGIL_REACH, `no two of its points further apart than twice its reach (${span})`);
  // AUDIT WB12d (G19): each of a brazier's six faces its own strip of the stone
  const flat = buildRiteModel(facing, () => 0, { sigil: false }), st = flat.subMeshes[0];
  for (const [bx, bz] of riteLayout(facing).braziers) {
    const strips = new Set();
    for (const [t, tri] of tris(flat, st).entries()) {
      if (!tri.every(([x, , z]) => Math.hypot(x - bx, z - bz) <= RITE_BRAZIER_W + 1e-5) || Math.abs(flat.normals[(st.startIndex + t * 3) * 3 + 1]) > 1e-6) continue;
      strips.add(Math.min(...[0, 1, 2].map((k) => flat.uvs[(st.startIndex + t * 3 + k) * 2])).toFixed(4));
    }
    assert.equal(strips.size, 6, `a brazier's faces each their own strip (${[...strips]})`);
    const cap = [];
    for (const [t, tri] of tris(flat, st).entries()) {
      if (!tri.every(([x, , z]) => Math.hypot(x - bx, z - bz) <= RITE_BRAZIER_W + 1e-5) || flat.normals[(st.startIndex + t * 3) * 3 + 1] < 0.99) continue;
      for (let k = 0; k < 3; k++) cap.push(flat.uvs[(st.startIndex + t * 3 + k) * 2]);
    }
    assert.ok(cap.length === 18 && Math.max(...cap) - Math.min(...cap) >= 0.5, `its cap a patch of the stone as wide as its faces (${Math.max(...cap) - Math.min(...cap)})`);
  }
  const steep = (x, z) => 0.8 * x + 0.5 * z;
  const sm = buildRiteModel(facing, steep);
  const L = riteLayout(facing);
  const parts = [[L.altar.x, L.altar.z, 1.1], [L.casket.x, L.casket.z, 0.6], ...L.braziers.map(([x, z]) => [x, z, 0.4])];
  const footed = (model, ground, list) => {
    const st = model.subMeshes.find((s) => s.textureRecord !== RITE_SIGIL_RECORD);
    for (const [px, pz, rr] of list) {
      const vs = tris(model, st).flat().filter(([x, , z]) => Math.hypot(x - px, z - pz) <= rr);
      const low = Math.min(...vs.map(([, y]) => y));
      for (const [x, y, z] of vs) if (y === low) assert.ok(y < ground(x, z), `standing on air at ${x.toFixed(2)},${z.toFixed(2)}`);
    }
  };
  footed(sm, steep, parts);
  const cliff = (x, z) => 1.3 * x - 0.4 * z;
  footed(buildRiteModel(facing, cliff), cliff, parts.slice(2));
  assert.equal(L.braziers.length, RITE_BRAZIERS);
  assert.ok(L.braziers.every(([x, z]) => Math.abs(Math.hypot(x, z) - RITE_BRAZIER_R) < 1e-9));
  const off = (x, z) => Math.abs(((Math.atan2(x, z) - facing) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  assert.ok(L.braziers.every(([x, z]) => off(x, z) >= Math.PI / 12), 'no brazier in the gap');
  assert.ok(Math.abs(off(L.casket.x, L.casket.z) - Math.PI / 2) < 1e-9, 'the casket beside the altar');
  for (const n of [6, 7, 8]) for (const [x, z] of L.ring(n)) { assert.ok(Math.abs(Math.hypot(x, z) - RITE_RING_R) < 1e-9); assert.ok(off(x, z) >= Math.PI / 9, 'the gap toward the gate'); }
  for (const t of L.tents) { assert.ok(Math.abs(Math.hypot(t.x, t.z) - RITE_TENT_R) < 1e-9); assert.ok(off(t.x, t.z) > Math.PI / 2, 'behind the circle'); }
  assert.ok(Math.sin(facing) * L.fire[0] + Math.cos(facing) * L.fire[1] < 0, 'the camp\'s fire behind too');
});

test('AUDIT WB12d (G5, G6, G11): the sigil - its own art, burned earth ragged at its rim (the land shows past it), the star\'s first point and every cut smouldering; turned with the altar, that point toward the gate; laid close over a slope; built apart from the stone and drawn for an eye within 250 m alone (mutants: the plinth\'s flags; a square tile; the art unturned; the old drape; the sigil from anywhere)', () => {
  const { albedo, emission } = riteSigilArt(), S = RITE_SIGIL_ART_SIZE, c = (S - 1) / 2;
  const px = (x, y) => { const i = (Math.round(y) * S + Math.round(x)) * 4; return { a: albedo.colors[i + 3], glow: emission.colors[i] }; };
  assert.equal(px(0, 0).a, 0, 'no square tile: its corners clear');
  assert.equal(px(c, c * 0.02).a, 0, 'past its ragged rim, the land');
  assert.equal(px(c + c * 0.5, c).a, 255, 'burned earth within');
  let rimR = [];
  for (let k = 0; k < 64; k++) { const a = (k / 64) * 2 * Math.PI; let r = 0; while (r < c && px(c + Math.cos(a) * r, c + Math.sin(a) * r).a) r += 0.5; rimR.push(r / c); }
  assert.ok(Math.max(...rimR) - Math.min(...rimR) > 0.05, `its rim ragged (${Math.min(...rimR).toFixed(2)}-${Math.max(...rimR).toFixed(2)})`);
  assert.ok(px(c, c + 0.64 * c).glow > 100 && px(c, c - 0.64 * c).glow < 50, 'the star\'s first point at +v, smouldering - and none opposite it');
  const lit = [...Array(S * S).keys()].filter((i) => emission.colors[i * 4] > 100).length;
  assert.ok(lit > S * S * 0.05 && lit < S * S * 0.2, `its cuts (${lit})`);
  // turned with the altar: the art's +v runs toward the gate, so its star's first point is the one nearest the gate
  const facing = 0.9, m = buildRiteModel(facing, () => 0, { stone: false });
  assert.ok(m.subMeshes.length === 1 && m.subMeshes[0].textureRecord === RITE_SIGIL_RECORD, 'the sigil alone');
  assert.ok(buildRiteModel(facing, () => 0, { sigil: false }).subMeshes.every((sm) => sm.textureRecord === GATE_STONE_RECORD), 'the stone alone');
  const g = [Math.sin(facing), Math.cos(facing)], side = [g[1], -g[0]];
  let worst = 0;
  for (let v = 0; v < m.positions.length / 3; v++) {
    const x = m.positions[v * 3], z = m.positions[v * 3 + 2];
    worst = Math.max(worst, Math.abs(m.uvs[v * 2 + 1] - 0.5 - (x * g[0] + z * g[1]) / (2 * RITE_SIGIL_R)), Math.abs(m.uvs[v * 2] - 0.5 - (x * side[0] + z * side[1]) / (2 * RITE_SIGIL_R)));
  }
  assert.ok(worst < 1e-5, `every point of it wears the art turned toward the gate (off by ${worst})`);
  // laid close: on a 0.3 slope no point of it a hand over the ground
  const slope = (x, z) => 0.3 * x, sm = buildRiteModel(facing, slope, { stone: false });
  let high = 0;
  for (let v = 0; v < sm.positions.length / 3; v++) high = Math.max(high, sm.positions[v * 3 + 1] - slope(sm.positions[v * 3], sm.positions[v * 3 + 2]));
  assert.ok(high <= RITE_SIGIL_REACH * 0.3 + RITE_SIGIL_LIFT + 1e-6 && high < 0.2, `${high} m over a 0.3 slope (0.285 was a plank)`);
  // drawn for an eye near it alone
  const drawn = [];
  const h = createRiteHost({ now: () => T.omenAt + 60_000, omen: () => ({ site: SITE }), pixelTranslation: () => [0, 0, 0], groundAt: () => 0, renderer: { createMesh: (mm) => ({ mm }), drawMesh: (mesh) => drawn.push(mesh.mm.subMeshes[0].textureRecord) } });
  h.frame();
  h.draw(undefined, null, [E + 200, 30, N]);
  assert.deepEqual(drawn.splice(0), [GATE_STONE_RECORD, RITE_SIGIL_RECORD], 'near: the stone and the sigil');
  h.draw(undefined, null, [E + 260, 30, N]);
  assert.deepEqual(drawn.splice(0), [GATE_STONE_RECORD], 'far: the stone alone - the smoke marks it from there');
  h.draw();
  assert.deepEqual(drawn.splice(0), [GATE_STONE_RECORD, RITE_SIGIL_RECORD], 'no eye said: drawn');
  assert.equal(RITE_SIGIL_DRAW_M, 250);
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, ONE_MINUS_SRC_ALPHA: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('WB12d the smoke\'s pass: a plume of rows, blended premultiplied, without writing depth; at most two drawn, the faded and the placeless skipped; AUDIT WB12d (G8) the frame\'s light handed over (mutants: a cone of two rows; drawn faded; depth written; the light unhanded)', () => {
  assert.equal(smokeVertices().length, SMOKE_SEGMENTS * SMOKE_ROWS * 12);
  assert.ok(SMOKE_ROWS >= 16, 'a swell needs rows');
  const lightOf = (fog) => { const g = fakeGl(); new RiteSmokeRenderer(g.gl).draw([{ origin: [0, 0, 0], fade: 1 }], I, I, [0, 0, 0], 5, fog); return g.calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uLight').map((c) => c[2]); };
  assert.deepEqual([lightOf({ light: 0.3 }), lightOf({ light: 5 }), lightOf({ light: NaN }), lightOf(null)], [[0.3], [1], [1], [1]]);
  const { gl, calls } = fakeGl();
  const pass = new RiteSmokeRenderer(gl);
  pass.draw([{ origin: [NaN, 0, 0], fade: 1 }, { origin: [0, 0, 0], fade: 1 }, { origin: [1, 0, 0], fade: SMOKE_FADE_MIN }, { origin: [2, 0, 0], fade: 0.5 }, { origin: [3, 0, 0], fade: 1 }], I, I, [0, 0, 0], 1000);
  assert.equal(pass.drawn, SMOKE_MAX);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uOrigin').map((c) => c[2]), [0, 2], 'the faded and the placeless skipped');
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uTime').map((c) => c[2]), [1000 % SMOKE_CLOCK_PERIOD], 'its clock handed wrapped (AUDIT WB12d T)');
  assert.ok(calls.some((c) => c[0] === 'blendFunc' && c[1] === 10 && c[2] === 12), 'premultiplied');
  const draw = calls.findIndex((c) => c[0] === 'drawArrays');
  assert.deepEqual(calls.slice(0, draw).filter((c) => c[0] === 'depthMask').at(-1), ['depthMask', false]);
});

test('AUDIT WB12d (G3, G8, G9, G17): the smoke as its shaders draw it - its foot the altar\'s flame\'s width and slow to swell (no funnel round the braziers); its outline bulging with its biggest billows and rising with them, thin wherever its own surface turns from the eye (no hard ring at a bulge); its billows growing as they climb; fading in over its first metre, the fire\'s glow light added over its first few and gone above, faded and fogged with it; lit as the frame is, never to nothing; a clear day\'s distance leaves it a line, weather\'s fog takes it whole; each octave its own whole columns a period - the wrap never shows, and no one sheet slides; each octave at a thick mean once too fine to see (mutants: the wide foot; the fast swell; a smooth cone; lumps of their own; the axis\'s line for its normal; billows one size; the fade over metres; the glow everywhere, through the fog, past the fade; unlit; a hole in the night; the floor in all fog; one climb; a wrap mid-cell; shimmer far off; a thin far plume)', () => {
  const H = SMOKE_HEIGHT_M, P = SMOKE_CLOCK_PERIOD;
  const vs = glslFunctions(SMOKE_VS, { aUV: [0, 0], uVP: Array.from(I), uOrigin: [0, 0, 0], uEye: [0, 0, 0], uTime: 0 });
  const axisAt = (h) => [SMOKE_LEAN[0] * h * h, h * H, SMOKE_LEAN[1] * h * h];
  const base = (h) => SMOKE_FOOT_R + (SMOKE_TOP_R - SMOKE_FOOT_R) * h ** SMOKE_SWELL;
  /** the column's place at u round it and y up its billows' height, at time t: its height, its radius, its normal */
  const col = (u, y, t = 0) => {
    Object.assign(vs.globals, { aUV: [u, y], uTime: t });
    vs.main();
    const h = vs.globals.vUV[1], w = [...vs.globals.vWorld], a = axisAt(h);
    return { h, w, r: Math.hypot(w[0] - a[0], w[2] - a[2]), n: [...vs.globals.vNormal] };
  };
  const round = (h, t = 0) => Array.from({ length: 48 }, (_, k) => col(k / 48, smokeBillowOf(h), t).r);
  const mean = (v) => v.reduce((n, x) => n + x, 0) / v.length;
  assert.ok(SMOKE_FOOT_R <= 1.5 && Math.abs(mean(round(0)) / SMOKE_FOOT_R - 1) < 0.15, `the flame's width (${mean(round(0))})`);
  assert.ok(mean(round(7 / H)) < 4, `at the braziers' height inside their ring (${mean(round(7 / H))} m; 9.4 m was a funnel round them)`);
  assert.ok(col(0, 1 / SMOKE_ROWS).h * H < 2 && (1 - col(0, 1 - 1 / SMOKE_ROWS).h) * H > 20, 'its rows close at the fire, far apart at the top');
  for (const h of [0.05, 0.3, 0.7]) { const r = round(h); assert.ok(Math.max(...r) / Math.min(...r) > 1.15, `bulging at ${h} (${Math.min(...r)}-${Math.max(...r)})`); }
  const lift = (SMOKE_CLIMB_HEIGHTS[0] * 6) / P;
  for (const u of [0.1, 0.4, 0.75]) for (const y of [0.2, 0.5, 0.8]) {
    const was = col(u, y, 0), now = col(u, y + lift, 6);
    assert.ok(Math.abs(now.r / base(now.h) - was.r / base(was.h)) < 1e-6, `its bulges rise with its billows (${u}, ${y})`);
  }
  // its normal is its own surface's: the steepest flanks of its bulges
  const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const flanks = [];
  for (let u = 0; u < 1; u += 1 / 24) for (let y = 0.1; y < 0.9; y += 0.04) {
    const e = 1e-4, n = cross(sub(col(u, y + e).w, col(u, y - e).w), sub(col(u + e, y).w, col(u - e, y).w));
    flanks.push({ u, y, n, tilt: Math.abs(n[1]) / Math.hypot(...n) });
  }
  flanks.sort((a, b) => b.tilt - a.tilt);
  assert.ok(flanks[0].tilt > 0.3, `bulges with flanks (${flanks[0].tilt})`);
  for (const f of flanks.slice(0, 12)) { const m = col(f.u, f.y).n; assert.ok(Math.abs(dot(m, f.n)) / Math.hypot(...m) / Math.hypot(...f.n) > 0.98, `its normal on a flank at ${f.u.toFixed(2)}, ${f.y.toFixed(2)}`); }
  const BASE = { vUV: [0, 0], vWorld: [0, 0, 0], vNormal: [1, 0, 0], vRad: 1, uTime: 7, uFade: 1, uLight: 1, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0], o: [0, 0, 0, 0] };
  const fs = glslFunctions(SMOKE_FS, BASE);
  /** what it draws at u round it, m metres up, the eye `far` metres out on its own outward line */
  const look = (u, m, o = {}, far = 40) => {
    const a = u * 2 * Math.PI, c = [Math.cos(a), Math.sin(a)];
    Object.assign(fs.globals, BASE, { vUV: [u, m / H], vWorld: [c[0] * 2, m, c[1] * 2], vNormal: [c[0], 0, c[1]], vRad: base(m / H), uCamPos: [c[0] * far, m, c[1] * far] }, o);
    fs.main();
    return [...fs.globals.o];
  };
  /** the thickest of the plume's round m metres up */
  const at = (m, o = {}) => { let best = [0, 0, 0, 0]; for (let u = 0; u < 1; u += 1 / 48) { const p = look(u, m, o); if (p[3] > best[3]) best = p; } return best; };
  /** the most of each of its four, round the plume m metres up */
  const peak = (m, o = {}) => { const best = [0, 0, 0, 0]; for (let u = 0; u < 1; u += 1 / 48) look(u, m, o).forEach((v, k) => { best[k] = Math.max(best[k], Math.abs(v)); }); return best; };
  assert.ok(look(0.3, 20, { vNormal: [0, 1, 0] })[3] < 1e-9 && look(0.3, 20)[3] > 0, 'thin where its surface turns edge on to the eye');
  // its outline swells where its smoke is thick: the bulges are its own first octave
  const swell = [], thick = [];
  for (let u = 0; u < 1; u += 1 / 24) for (let y = 0.3; y < 0.75; y += 0.02) { const c = col(u, y, BASE.uTime); swell.push(c.r / base(c.h)); thick.push(look(u, c.h * H)[3]); }
  const ms = mean(swell), mt = mean(thick);
  const corr = swell.reduce((n, v, i) => n + (v - ms) * (thick[i] - mt), 0) / Math.sqrt(swell.reduce((n, v) => n + (v - ms) ** 2, 0) * thick.reduce((n, v) => n + (v - mt) ** 2, 0));
  assert.ok(corr > 0.4, `its bulges where it is thick (${corr})`);
  // near, billows and holes: it hides about half the sky behind it
  const near = []; for (const m of [5, 20, 40, 60, 100]) for (let u = 0; u < 1; u += 1 / 48) near.push(look(u, m)[3]);
  assert.ok(Math.min(...near) < 0.1 && Math.max(...near) > 0.9 && mean(near) > 0.3 && mean(near) < 0.65, `billows and holes (${Math.min(...near)}-${Math.max(...near)}, ${mean(near)})`);
  // its billows grow as they climb: as often thick and thin in a metre at its foot as in several high up
  const flips = (from, to, step) => {
    const v = []; for (let m = from; m <= to; m += step) v.push(look(0.3, m)[3]);
    const mid = [...v].sort((a, b) => a - b)[v.length >> 1];
    let n = 0; for (let i = 1; i < v.length; i++) if ((v[i] > mid) !== (v[i - 1] > mid)) n++;
    return n / (to - from);
  };
  assert.ok(flips(2, 40, 0.25) > 3 * flips(150, 300, 1), `billows growing as they climb (${flips(2, 40, 0.25).toFixed(3)} a metre at its foot, ${flips(150, 300, 1).toFixed(3)} high up)`);
  const glowOf = (p) => p[0] - SMOKE_COLOR[0] * p[3];   // the light the fire adds over the smoke's own
  assert.ok(at(0.15)[3] < 0.5 * at(2)[3], `fading in over its first metre (${at(0.15)[3]} against ${at(2)[3]})`);
  assert.ok(at(2)[3] > 0.5, 'thick from the second metre');
  assert.ok(glowOf(at(1)) > 0.15, `the fire's glow in its foot (${glowOf(at(1))})`);
  assert.ok(Math.abs(glowOf(at(30))) < 1e-4, `none above (${glowOf(at(30))})`);
  assert.ok(peak(1)[0] > 0.15, 'its fire');
  assert.ok(Math.max(...peak(1, { uFade: 0 })) < 1e-9, 'faded, its fire with it');
  assert.ok(Math.max(...peak(1, { uFogMode: 2, uFogDensity: 1 })) < 1e-9, 'in weather\'s fog, its fire with it');
  const day = at(40), dusk = at(40, { uLight: 0.25 }), night = at(40, { uLight: 0 });
  assert.ok(Math.abs(dusk[0] - day[0] * 0.25) < 1e-6 && dusk[3] === day[3], 'lit as the frame is, as thick');
  assert.ok(Math.abs(night[0] - SMOKE_COLOR[0] * SMOKE_LIGHT_MIN * night[3]) < 1e-6 && night[0] > 0, 'never a hole in the night');
  const clear = at(40, { uFogMode: 1, uFogRange: [0, 10] }), whiteout = at(40, { uFogMode: 2, uFogDensity: 1 });
  assert.ok(SMOKE_FOG_FLOOR >= 0.5 && Math.abs(clear[3] - SMOKE_FOG_FLOOR * day[3]) < 1e-9, 'a clear day\'s distance leaves it a line that reads (0.35 left a pale one a kilometre and a half off: tools/riteProbe.mjs)');
  assert.ok(whiteout[3] < 1e-9, 'weather\'s fog takes it whole');
  assert.deepEqual(SMOKE_CLIMB_HEIGHTS.map(Number.isInteger), [true, true, true]);
  assert.equal(new Set(SMOKE_CLIMB_HEIGHTS).size, 3, 'each its own');
  const sample = (t, y) => look(0.3, smokeHeightOf(y) * H, { uTime: t })[3];
  let wrapped = 0, rigid = 0;
  for (let y = 0.2; y < 0.8; y += 0.01) {
    wrapped = Math.max(wrapped, Math.abs(sample(0, y) - sample(P, y)), Math.abs(col(0.3, y, 0).r - col(0.3, y, P).r));
    if (y - SMOKE_CLIMB_HEIGHTS[0] / 8 > 0.1) rigid = Math.max(rigid, Math.abs(sample(P / 8, y) - sample(0, y - SMOKE_CLIMB_HEIGHTS[0] / 8)));
  }
  assert.ok(wrapped < 1e-6, `the wrap never shows (${wrapped})`);
  assert.ok(rigid > 0.05, `no one sheet slides up it (${rigid})`);
  // far off, each octave at its thick mean: no shimmer, and a plume that reads
  const spread = (far) => { const v = Array.from({ length: 48 }, (_, k) => look(k / 48, 5, {}, far)[3]); return [Math.max(...v) - Math.min(...v), mean(v)]; };
  assert.ok(spread(40)[0] > 0.2, `near, its billows (${spread(40)[0]})`);
  assert.ok(spread(3000)[0] < 0.02 && spread(3000)[1] > 0.7, `three kilometres off, even and thick (${spread(3000)})`);
});

test('WB12d the chest: gold for the opener\'s level, two to four of the rite\'s reagents - a Daedra\'s Heart rarely - and one chest in twenty a piece of Dagon\'s Brand, Magic, known on sight and bearing the set\'s sigil at Faint; the day the character\'s own, and the rite\'s memory beside it (mutants: no gold; the brand never; a heart every time; the day forgotten; the memory unsaved)', () => {
  let brands = 0, hearts = 0, draws = 0;
  const counts = new Set(), kinds = new Set();
  for (let s = 1; s <= 6000; s++) {
    const it = riteChestItems(10, seededRng(s));
    assert.equal(it[0].group, 'Currency');
    assert.ok(it[0].stackCount >= 200 && it[0].stackCount <= 400, `${it[0].stackCount}`);
    const reagents = it.filter((x) => [...RITE_REAGENTS, RITE_HEART].some((g) => g.templateIndex === x.templateIndex));
    assert.ok(reagents.length >= 2 && reagents.length <= 4);
    counts.add(reagents.length); draws += reagents.length;
    for (const x of reagents) kinds.add(x.templateIndex);
    hearts += reagents.filter((x) => x.templateIndex === RITE_HEART.templateIndex).length;
    const brand = it.find((x) => x.sigil);
    if (brand) { brands++; assert.equal(brand.sigil.set, RITE_BRAND_SET); assert.equal(brand.sigil.xp, 0); assert.deepEqual(brand.sigil.party, sigilParty(1), 'at Faint'); assert.equal(brand.rarity, 'magic'); assert.equal(brand.group, 'Armor'); assert.equal(brand.isIdentified, true); }
  }
  // AUDIT WB12d (T): the bible's own numbers - two to four, every reagent and the heart among them, a heart 8% of
  // draws, one chest in twenty a Brand
  assert.deepEqual([...counts].sort(), [2, 3, 4], 'two, three and four');
  assert.equal(kinds.size, RITE_REAGENTS.length + 1, 'every reagent of the rite, and the heart');
  assert.ok(Math.abs(hearts / draws - 0.08) < 0.01, `a heart in ${(100 * hearts / draws).toFixed(1)}% of draws`);
  assert.ok(Math.abs(brands / 6000 - 0.05) < 0.01, `${brands} brands in 6000`);
  fresh();
  assert.equal(riteChestOpened(DAY), false);
  markRiteChest(DAY);
  assert.equal(riteChestOpened(DAY), true);
  assert.equal(riteChestOpened(DAY + 1), false, 'a new day, a new chest');
  restoreModSaveRecords({ [RITE_CHEST_SAVE_VENDOR]: { day: DAY } });
  assert.equal(riteChestOpened(DAY), true, 'loaded opened');
  const mem = riteMemory(DAY);
  mem.slain[130] = 2; mem.fell = 1; mem.passed = 1;
  const kept = modSaveRecords()[RITE_DAY_SAVE_VENDOR];
  assert.deepEqual(kept, { d: DAY, slain: { 130: 2 }, fell: 1, struck: 0, passed: 1, saidBroken: 0 });
  fresh();
  assert.deepEqual(riteMemory(DAY).slain, {}, 'a new game: nothing seen');
  restoreModSaveRecords({ [RITE_DAY_SAVE_VENDOR]: { ...kept, slain: { 130: 2, x: 4, 131: -1, 9999: 99 }, fell: 7 } });
  assert.deepEqual(riteMemory(DAY).slain, { 130: 2, 9999: 9 }, 'a save\'s junk refused, a count bounded');
  assert.equal(riteMemory(DAY).fell, 0);
  assert.deepEqual(riteMemory(DAY + 1).slain, {}, 'a new day starts blank');
  fresh();
});

test('WB12d the spoils: a receipt of the rite alone pays its ember and nothing else; a fighter\'s `r` an ember more after the first, the gold still last; a receipt with neither is what it was, piece for piece; the court\'s burst and the grant outside it pay them, each said by its own line (AUDIT WB12d D20) (mutants: the rite paying the spoils; the ember dropped; the court\'s line for the rite\'s)', () => {
  const sig = (l) => l.map((p) => (p.kind === 'gold' ? `gold:${p.gold}:${p.record}` : `${p.item.name}:${p.tier}:${p.record}`));
  const plain = spoilsList(4242, 20), dealt = spoilsList(4242, 20, { x: 'dealt' });
  assert.deepEqual(sig(dealt), sig(plain));
  const helped = spoilsList(4242, 20, { x: 'stood', r: 1 });
  assert.equal(helped.length, plain.length + 1);
  const embers = helped.map((p, i) => (p.kind === 'item' && isSigilStone(p.item) ? i : -1)).filter((i) => i >= 0);
  assert.equal(embers.length, 2);
  assert.equal(embers[1], embers[0] + 1, 'together');
  assert.equal(helped.at(-1).kind, 'gold');
  assert.deepEqual(sig(helped.filter((_, i) => i !== embers[1])), sig(plain), 'the rest as it was, each in its dress');
  const rite = spoilsList(4242, 20, { x: 'rite' });
  assert.equal(rite.length, 1);
  assert.ok(isSigilStone(rite[0].item));
  assert.equal(rite[0].tier, helped[embers[0]].tier, 'its ember glows as a fight\'s');
  assert.equal(SPOILS_TEXT.rite, 'An ember from the broken rite is in your pack.');
  const mem = new Map(), took = [], said = [];
  const pool = createSpoilsPool({ ray: () => null, now: () => 0, take: (p) => took.push(p), say: (t) => said.push(t), store: { get: (k) => mem.get(k), set: (k, v) => mem.set(k, v) }, who: () => 'c' });
  assert.equal(pool.grant({ day: DAY, seed: 4242, level: 20, acct: 'a', claims: { x: 'rite' }, text: SPOILS_TEXT.rite }), true);
  assert.equal(took.length, 1, 'granted: the ember alone');
  assert.deepEqual(said, [SPOILS_TEXT.rite]);
  assert.equal(pool.spew({ day: DAY + 1, seed: 4242, level: 20, acct: 'a', at: [0, 0, 0], bearing: 0, claims: { x: 'stood', r: 1 } }), true);
  assert.equal(pool.state().pieces.length, plain.length + 1, 'spewed: an ember more');
  assert.equal(COURT_STRIKE_TEXT.spilledRite(), 'Your ember from the broken rite falls to the floor.');
  const court = read('src/scenes/gateCourt.js');
  assert.match(court, /spoils\.spew\(\{ day: s\.day, seed: claims\.c, level: spoilsLevel\(player\(\)\?\.level \?\? 1, claims\.l\), at, bearing, acct: claims\.s, keep, claims \}\)/);
  assert.match(court, /say\(claims\.x === 'rite' \? COURT_STRIKE_TEXT\.spilledRite\(\) : COURT_STRIKE_TEXT\.spilled\(\)\);/);
  assert.match(read('src/scenes/world.js'), /spoilsPool\.grant\(\{ day: c\.d, seed: c\.c, level: spoilsLevel\(playerEntity\.level \?\? 1, c\.l\), acct: c\.s, claims: c, text: c\.x === 'rite' \? SPOILS_TEXT\.rite : SPOILS_TEXT\.granted \}\)/);
});

test('WB12d the claim: a rite\'s own receipt is "Rite recorded." and closes no breach; refused its claims by a service from before acct62, it is kept for its week - for that refusal alone (mutants: let go; said a breach; kept on any refusal; the verdict blind to the receipt)', async () => {
  assert.equal(GATE_CLAIM_TEXT.rite, 'Rite recorded.');
  assert.equal(gateClaimVerdict({ ok: false, error: 'receipt', why: 'claims' }, { x: 'rite' }), 'keep');
  assert.equal(gateClaimVerdict({ ok: false, error: 'receipt', why: 'expired' }, { x: 'rite' }), 'done');
  assert.equal(gateClaimVerdict({ ok: false, error: 'receipt', why: 'claims' }, { x: 'dealt' }), 'done', 'a fighter\'s bad claims are bad');
  assert.equal(gateClaimVerdict({ ok: true, data: { recorded: true, rite: true, stones: 1 } }, { x: 'rite' }), 'done');
  // AUDIT WB12d (lens T): driven as the device's queue runs it (test/wb5b_gate_claim.test.js's harness), where these
  // were two lines of its source
  const { subtle } = globalThis.crypto;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  const nowS = Math.floor(Date.now() / 1000);
  const run = async (x, answer) => {
    const mem = new Map(), said = [];
    const store = { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)) };
    const q = createGateClaims({ claim: async () => answer, store, nowS: () => nowS, nowMs: () => nowS * 1000, say: (t) => said.push(t), me: () => 'acct-me' });
    const r = await mintReceipt({ d: DAY, b: 'ruhn', s: 'acct-me', c: 4242, x }, priv, { subtle, nowS });
    q.add(r); await settle();
    return { said, kept: q.kept().length };
  };
  assert.deepEqual(await run('rite', { ok: true, data: { recorded: true, rite: true, stones: 1, closed: 3 } }), { said: [GATE_CLAIM_TEXT.rite], kept: 0 }, 'its own line, no breach closed, let go');
  assert.deepEqual(await run('dealt', { ok: true, data: { recorded: true, stones: 1, closed: 3 } }), { said: [GATE_CLAIM_TEXT.recorded(3)], kept: 0 });
  assert.deepEqual((await run('rite', { ok: false, error: 'receipt', why: 'claims' })).kept, 1, 'a service from before acct62: kept');
  assert.deepEqual((await run('dealt', { ok: false, error: 'receipt', why: 'claims' })).kept, 0, 'a fighter\'s refused for good');
});

test('WB12d the omen\'s order: right after the omen\'s line, before tonight\'s marks, once a day - AUDIT WB12d (D3): the Discord post\'s own sentence; (C8, L5) never once the hub says this breach\'s rite broken, nor on a relay that cannot keep it (mutants: the line unsaid; said after the marks; said over a broken rite; said to an old relay)', () => {
  assert.equal(riteOmenLine(), 'The faithful work their rite nearby. Kill their Summoner before the breach opens.');
  const post = omenPost({ day: DAY, place: 'Copperham' }).content;
  assert.ok(post.includes(`seals it at <t:${Math.floor(T.sealAt / 1000)}:t>. ${riteOmenLine()} ${gateBossOf(DAY).name} comes`), `Discord says it so, after the times and before the marks: ${post}`);
  const site = { ...SITE, ring: { cx: PX, cy: PY, r: 3 }, spot: [400, 400] };
  const run = (deps = {}) => {
    const said = [], seen = [];
    const o = createGateOmen({ now: () => T.omenAt + 2000, site: () => site, say: (t) => said.push(t), riteBroken: (d, s) => { seen.push([d, s.px, s.py]); return deps.broken ?? false; }, riteReady: () => deps.ready ?? true });
    o.frame(); o.frame();
    return { said, seen };
  };
  const marks = marksLine({ boss: gateBossOf(DAY).name, md: gateModsOf(DAY) });
  const ok = run();
  assert.equal(ok.said.length, 3);
  assert.ok(ok.said[0].startsWith('The sky burns near Copperham, Wrothgarian Mountains.'), ok.said[0]);
  assert.deepEqual(ok.said.slice(1), [riteOmenLine(), marks]);
  assert.deepEqual(ok.seen, [[DAY, PX, PY]], 'asked of this breach\'s circle, once');
  assert.deepEqual(run({ broken: true }).said.slice(1), [marks]);
  assert.deepEqual(run({ ready: false }).said.slice(1), [marks]);
  const w = read('src/scenes/world.js');
  assert.match(w, /riteBroken: \(day, s\) => !!riteHost\?\.isBroken\(day, s\?\.px, s\?\.py\),/);
  assert.match(w, /riteReady: \(\) => !!online\?\.riteOk,/);
});

test('AUDIT WB12d (D2): the Summoner by his own name in the classic lines - "You see the Summoner.", "The Summoner just died." and "The Summoner (dead)"; the faithful by their careers (mutants: each line by his kind)', () => {
  assert.equal(properName({ properName: 'the Summoner' }), 'The Summoner');
  assert.equal(properName({ name: 'Mage' }), null);
  const said = [];
  assert.equal(sayEnemyDied((t) => said.push(t), RITE_SUMMONER_CAREER, { properName: RITE_TEXT.summoner }), 'The Summoner just died.');
  const hud = [];
  activateMobileEnemy({ mobileType: RITE_SUMMONER_CAREER, entity: { properName: RITE_TEXT.summoner } }, 2, 'info', null, { hud: (t) => hud.push(t) });
  activateMobileEnemy({ mobileType: 128, entity: {} }, 2, 'info', null, { hud: (t) => hud.push(t) });
  assert.deepEqual(hud, ['You see the Summoner.', 'You see a Mage.']);
  assert.match(read('src/scenes/exteriorFoes.js'), /title: corpseName\(properName\(e\.entity\) \?\? championName\(e\.entity, corpseEntityName\(e\.mobileType\)\)\)/);
});

test('AUDIT WB12d (C15): the faithful on the Overworld are the rite\'s - "Dagon\'s Faithful, 7", attacked as "Dagon\'s Faithful (7)" - mine or a peer\'s, and the attack spares them all (mutants: a "Mage pack"; the attack\'s question by the pack\'s regex; the attacked rite still holding the clock)', () => {
  assert.equal(RITE_TEXT.mark(7), 'Dagon\'s Faithful, 7');
  assert.equal(RITE_TEXT.mark(1), 'Dagon\'s Faithful');
  assert.equal(RITE_TEXT.markAsk(7), 'Dagon\'s Faithful (7)');
  const w = read('src/scenes/world.js');
  const m = /\n {2}function travelViewCamps\(\) \{\n[\s\S]*?\n {2}\}\n/.exec(w);
  const pool = { foes: [
    { site: SITE_ID, campId: 7, mobileType: 131, ai: { feet: [0, 0, 0] } }, { site: SITE_ID, puppet: 'peer-2', _pupCamp: { id: 3, kind: 'pack' }, mobileType: 128, ai: { feet: [2, 0, 0] } },
    { site: SITE_ID, campId: 7, dead: true, mobileType: 130, ai: { feet: [1, 0, 0] } }, { campId: 9, campKind: 'pack', mobileType: 128, ai: { feet: [90, 0, 0] } },
  ] };
  const lift = (rite) => new Function('exteriorFoes', 'groupCamps', 'enemyDisplayName', 'riteHost', 'RITE_TEXT', `${m[0]} return travelViewCamps;`)(pool, groupCamps, () => 'Mage', rite, RITE_TEXT)();
  assert.deepEqual(lift({ siteNow: () => SITE_ID }).map((c) => [c.key, c.kind, c.n, c.label]), [[`rite:${SITE_ID}`, 'rite', 2, 'Dagon\'s Faithful, 2'], ['me:9', 'pack', 1, 'Mage']], 'mine and the peer\'s copies one mark, the living alone');
  assert.deepEqual(lift(null).map((c) => c.label), ['Mage', 'Mage', 'Mage'], 'no circle standing: as ever');
  assert.match(w, /const label = c\.kind === 'rite' \? RITE_TEXT\.markAsk\(c\.n\) :/);
  assert.match(w, /const foeCampKey = \(f\) => \(f\?\.site && f\.site === riteHost\?\.siteNow\(\) \? `rite:\$\{f\.site\}` :/);
});

test('AUDIT WB12d (C14, C5, R1, D4): a day\'s faithful are a site of their own - the camps\' law carries `px,py:rite.<day>`, a save\'s faithful from before the day joined it are known as the rite\'s; the hub\'s word carries how many broke it, never fewer than it names nor more than a rite counts (mutants: the day-less site; the count trusted)', () => {
  assert.match(SITE_ID, WOD_SITE_RE);
  assert.doesNotMatch(`${PX},${PY}:rite`, WOD_SITE_RE, 'the day-less id of before rides no frame');
  assert.ok(isRiteSite(SITE_ID) && isRiteSite(`${PX},${PY}:rite`) && !isRiteSite(`${PX},${PY}:7`) && !isRiteSite(null));
  assert.equal(RITE_COUNT_MAX, RITE_HELPERS_MAX);
  const w = { k: 'br', d: DAY, px: PX, py: PY, at: 5, by: ['A', 'B'] };
  assert.equal(validRiteOut({ ...w, n: 9 }).n, 9);
  assert.equal(validRiteOut({ ...w, n: 1 }).n, 2, 'never fewer than it names');
  assert.equal(validRiteOut({ ...w, n: RITE_COUNT_MAX + 1 }).n, 2, 'nor more than a rite counts');
  assert.equal(validRiteOut(w).n, 2);
  assert.equal(validRiteOut({ ...w, by: [...Array(12)].map((_, i) => `N${i}`), n: 12 }).by.length, RITE_BY_MAX);
  // the channel's post, the kill's own sentence (net/gateHerald.js fellPost): the event, the place, the first three and how many more
  assert.equal(ritePost({ place: 'Copperham', by: ['Ann', 'Bo', 'Cy', 'Di'], n: 9 }).content, '**The faithful\'s rite is broken** near Copperham, by Ann, Bo, Cy and 6 others.');
  assert.equal(ritePost({ by: ['Ann'], n: 2 }).content, '**The faithful\'s rite is broken** in the wilds, by Ann and 1 other.');
  assert.equal(ritePost({ place: 'Copperham', by: [] }).content, '**The faithful\'s rite is broken** near Copperham.');
  assert.deepEqual(ritePost({ by: ['<@&1> x'] }).allowed_mentions, { parse: [] }, 'pings nobody');
  assert.match(read('server/src/index.js'), /ritePost\(\{ day: st\.riteOwe\.d, place: site\?\.pl \?\? null, by: riteNames\(c\), n: Object\.keys\(c\.h\)\.length \}\)/);
});

test('WB12d the session: a word down the circle\'s cell socket only to a relay that keeps the rite - a halo\'s by its own welcome, and (AUDIT WB12d C6) each socket keeping its own word across a seam\'s promotion; RITE_HZ_MAX a second (mutants: the halo never keeps it; the promotion forgets it; any room; unmetered)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const log = console.info; console.info = () => {};
  try {
    const here = worldRoom(PX, PY), there = worldRoom(PX + 16, PY);
    s.join(here, null);
    sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: RELAY_VERSION });
    assert.equal(s.riteOk, true);
    s.setHalo([there]);
    sockets[1].open();
    sockets[1].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], n: 1, v: 'world140' });
    const w = { d: DAY, px: PX, py: PY, s: 1, f: 0 }, w2 = { ...w, px: PX + 16 };
    assert.equal(s.sendRite(w2, there), false, 'the halo on an older relay is said none');
    assert.equal(s.sendRite(w, here), true);
    // the seam: the halo promoted - its word with it; the old primary stepped down with its own
    s.join(there, null);
    assert.equal(s.room, there);
    assert.equal(s.riteOk, false, 'the promoted socket\'s word');
    t += 1000;
    assert.equal(s.sendRite(w2, there), false);
    assert.equal(s.sendRite(w, here), true, 'the stepped-down socket\'s own word');
    assert.equal(sockets[0].sent.filter((x) => JSON.parse(x).t === 'rite').length, 2, 'down its own socket');
    assert.equal(s.sendRite(w, 'dungeon:m1'), false);
    t += 1000;
    for (let i = 0; i < RITE_HZ_MAX; i++) assert.equal(s.sendRite(w, here), true);
    assert.equal(s.sendRite(w, here), false, 'RITE_HZ_MAX a second');
  } finally { console.info = log; }
  // AUDIT WB12d (T): a halo on a relay that keeps it says it for itself; a primary that is no cell is said none
  const k = fakeSocketClass();
  const h2 = new OnlineSession({ url: 'wss://relay.test', name: 'b', id: 'bbbb-0001', secret: 'secret-of-bbbb-0001', WebSocketImpl: k.FakeWS, now: () => t });
  console.info = () => {};
  try {
    const here = worldRoom(PX, PY), there = worldRoom(PX + 16, PY);
    h2.join(here, null);
    k.sockets[0].open();
    k.sockets[0].receive({ t: 'welcome', id: 'bbbb-0001', peers: [], host: 'bbbb-0001', world: null, v: RELAY_VERSION });
    h2.setHalo([there]);
    k.sockets[1].open();
    k.sockets[1].receive({ t: 'welcome', id: 'bbbb-0001', peers: [], n: 1, v: RELAY_VERSION });
    assert.equal(h2.sendRite({ d: DAY, px: PX + 16, py: PY, s: 1, f: 0 }, there), true, 'the halo\'s own welcome');
    assert.equal(k.sockets[1].sent.filter((x) => JSON.parse(x).t === 'rite').length, 1, 'down the halo\'s socket');
    const d = fakeSocketClass();
    const dn = new OnlineSession({ url: 'wss://relay.test', name: 'c', id: 'cccc-0001', secret: 'secret-of-cccc-0001', WebSocketImpl: d.FakeWS, now: () => t });
    dn.join('dungeon:m1', null);
    d.sockets[0].open();
    d.sockets[0].receive({ t: 'welcome', id: 'cccc-0001', peers: [], host: 'cccc-0001', world: null, v: RELAY_VERSION });
    assert.equal(dn.sendRite({ d: DAY, px: PX, py: PY, s: 1, f: 0 }, 'dungeon:m1'), false, 'no cell: never a word the relay would strike as junk');
    assert.equal(d.sockets[0].sent.filter((x) => JSON.parse(x).t === 'rite').length, 0);
  } finally { console.info = log; }
});

test('WB12d the world host by source: the host made beside the gate on the camps\' law and stood at every seam (mutants: each seam removed)', () => {
  const on = read('src/net/online.js');
  assert.match(on, /if \(r && isSocialRoom\(room\)\) this\._deliver\('rite', \(\) => this\.onRite\?\.\(r, room\)\);/);
  const w = read('src/scenes/world.js');
  const at = w.indexOf('const riteHost = gateOmen ? createRiteHost(');
  const deps = w.slice(at, w.indexOf('}) : null;', at));
  assert.match(deps, /omen: \(\) => gateOmen\.current\(\),/);
  assert.match(deps, /fellAt: \(day\) => gateLink\?\.fellAt\(day\) \?\? null,/);
  assert.match(deps, /online: \(\) => !!online\?\.riteOk,/);
  assert.match(deps, /return exteriorFoes\.spawnFoe\(career, \[x, y, z\], \{ yaw, placed: true, groundAlign: \{ hitDist: hitDistance\(hit\) \}, site, transient \}\);/);
  assert.match(deps, /drop: \(site\) => exteriorFoes\.dropSiteFoes\(site\),/);
  assert.match(deps, /remove: \(f\) => exteriorFoes\.removeFoe\(f\),/);
  assert.match(deps, /reclaim: \(site\) => exteriorFoes\.reclaimSite\(site\),/);
  assert.match(deps, /peerSprang: \(site\) => _wodPeerSprung\.has\(site\),/);
  assert.match(deps, /peerHeldAgo: \(site\) => wodPeerHeldAgo\(site\),/);
  assert.match(deps, /forgetPeer: \(site\) => wodForgetPeer\(site\),/);
  assert.match(deps, /sprang: \(site\) => wodSprang\(site\),/);
  assert.match(deps, /unsprang: \(site\) => wodUnsprang\(site\),/);
  assert.match(deps, /struckAt: \(f\) => renownStruckAt\(f\),/);
  assert.match(deps, /collider: \(\) => collider,/);
  assert.match(deps, /pixelTranslation: \(px, py, out\) => state\.pixelTranslation\(px, py, out\),/);
  assert.match(deps, /send: \(w, cell\) => !!online\?\.sendRite\?\.\(w, cell\),/);
  assert.match(deps, /droppedLoot\.seedPile\(items, feet, \{ archive: RANDOM_TREASURE_ARCHIVE, record: 0 \}, null, pixelKey, \{ unsaved: true, drawn: false \}\), keyOf: \(p\) => `droppedLoot:\$\{p\.id\}` \},[^\n]*\n\s*level: \(\) => playerEntity\.level \?\? 1,/);
  assert.match(w, /try \{ riteHost\?\.frame\(\); \}/);
  assert.equal(w.split('...(riteHost?.lights() ?? [])').length - 1, 2, 'both light lists');
  assert.match(w, /riteHost\?\.draw\(renderer, null, mwv\.eye\);/, 'AUDIT WB12d (G6): the eye, for the sigil');
  assert.match(w, /riteHost\.tick\(dt\); livePersonBatches\.push\(\.\.\.riteHost\.batches\(\)\);/);
  assert.match(w, /if \(riteHost\?\.smoking\(\) && riteHost\.drawSmoke\(proj, view, new Float32Array\(mwv\.eye\), now \/ 1000,[^\n]*\n[^\n]*camPos: renderer\._camPos, focus: renderer\._focus, light: \(renderer\._ambient\[0\] \+ renderer\._ambient\[1\] \+ renderer\._ambient\[2\]\) \/ 3 \+ 0\.6 \* renderer\._sunScale \}\)\) renderer\.markForeignPass\(\);/, 'the smoke handed the travel view\'s focus and (AUDIT WB12d G8) the frame\'s light, its foreign pass marked');
  assert.ok(w.indexOf('try { riteHost?.frame(); }') < w.indexOf('renderer.beginFrame(proj, view, sunDirection(minute), WORLD_FRAME);'), 'AUDIT WB12d (G14): its frame - the smoke\'s pass built there - before the renderer\'s');
  assert.match(w, /\(key\) => sigilBroker\?\.hoverName\(key\) \?\? null,[^\n]*\n\s*\(key\) => riteHost\?\.hoverName\(key\) \?\? null,/, 'named after the gate and the Broker');
  assert.ok(w.indexOf('(key) => riteHost?.hoverName(key) ?? null,') < w.indexOf("(key) => (typeof key === 'string' && key.startsWith('droppedLoot:')"), 'its pile named before the piles\' word');
  assert.equal(w.split('[...gatePool.targets(), ...(riteHost?.targets() ?? [])]').length - 1, 2, 'the press and the hover');
  assert.match(w, /else if \(!riteHost\?\.activate\(_gatePick\.key\)\) gatePool\.activate\(_gatePick\.key\);/);
  assert.match(w, /online\.onRite = \(w\) => riteHost\?\.onBroken\(w\);/);
  assert.match(w, /link\.onRite = \(w\) => riteHost\?\.onBroken\(w\);/);
  assert.match(w, /riteHost\?\.destroyAll\(\);/);
  assert.match(w, /\n {4}handOverSiteFoes\(\);\n {4}exteriorFoes\.clearLive\(\);\n {4}wodCarry\.clear\(\);/, 'AUDIT WB12d (C2): the teleport hands them over first');
  assert.match(w, /globalThis\.addEventListener\?\.\('pagehide', \(\) => handOverSiteFoes\(\)\);[^\n]*\n\s*globalThis\.addEventListener\?\.\('pagehide', \(\) => \{\n\s*try \{ worldPublish/, 'and the page\'s going, before its farewell');
});
