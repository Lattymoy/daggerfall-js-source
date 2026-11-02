// STOREFRONT, AUDIT LANE 5 (2026-10-29): THE SEASON'S RIG - a client a test stands at a Brass Fissure: the real exterior
// foe pool (createExteriorFoes over a crafted MONSTER.BSA, AUDIT WB12d's), the world host's own WOD7 camp law sliced out
// of scenes/world.js, and the real season host (scenes/seasonHost.js) on the world's bindings by name. Clients tell each
// other their frames (foesFrame -> applyFoes); the service's Maul door is a stand-in with its day's law. Not a .test.js:
// the manifest counts suites, and this is a precondition of test/scenes/seasonaudit_world.test.js.
import '../modsOff.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { createSeasonHost } from '../../src/scenes/seasonHost.js';
import { wodSiteId, yieldsTo } from '../../src/world/worldOfDaggerfall/wodShared.js';
import { renownStruckAt } from '../../src/net/renownTracker.js';
import { stageFissures, seasonStageAt } from '../../src/systems/pass/seasonWorld.js';
import { passSeasonById } from '../../src/net/battlePassLaw.js';
import { installEnemyExpansion } from '../../src/systems/enemyExpansion/dexInstall.js';

installEnemyExpansion({ on: true, log: () => {} });   // the season's constructs are Daggerfall Enemy Expansion's (289, 270, 290)

const WORLD = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
export const S1 = passSeasonById('s1');
export const HEART_T = S1.stages[2].fromMs + 30 * 60_000;   // mid-hour in the third stage: no tremor
export const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

/** Two regions of 400 pixels each, every pixel its own town's (the season's test scan). */
function scanOf(regions = [17, 23]) {
  const byRegion = new Map(), townAt = new Int32Array(1000 * 500).fill(-1), towns = [];
  regions.forEach((region, i) => {
    const pixels = [];
    for (let y = 20 + i * 40; y < 40 + i * 40; y++) for (let x = 300; x < 320; x++) { const id = y * 1000 + x; pixels.push(id); townAt[id] = towns.length; towns.push({ name: `Town ${towns.length}`, px: x, py: y, region }); }
    byRegion.set(region, Int32Array.from(pixels));
  });
  return { byRegion, towns, townAt };
}
export const SCAN = scanOf();
export const heartOf = (t = HEART_T) => stageFissures(1, seasonStageAt(t).stage, SCAN).find((s) => s.heart);

function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  const attrs = [40, 50, 50, 85, 50, 50, 90, 55];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const playerEntity = () => ({ isPlayer: true, level: 10, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 } });
const pool = (px, py) => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (p, d) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]], surfaceHit: () => null },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; if (/^CLASS\d\d\.CFG$/.test(n)) return craftCfg(); throw new Error(`no ${n} in this rig`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => `${px},${py}`, inLocation: () => false,   // the wilds: the street's elite rolls stand
  playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
});
const netFor = (id) => ({ room: () => 'world:18,12', inRoom: () => true, selfId: () => id, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: (h, fate) => { fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });

/** The world host's WOD7 law, sliced (scenes/world.js), on this rig's clock. */
function wodLaw(id, foes, clock) {
  const i = WORLD.indexOf('  const _wodSprung = new Map();');
  const j = WORLD.indexOf('  /** WOD6: SaveLoadManager.OnLoad', i);
  assert.ok(i > 0 && j > i, 'the law sliced');
  return new Function('online', 'performance', 'exteriorFoes', 'wodSiteId', 'yieldsTo',
    `${WORLD.slice(i, j)}\nreturn { wodSprang, wodPeerSites, wodSprungList, sprung: _wodSprung, peer: _wodPeerSprung, heldAgo: wodPeerHeldAgo, forgetPeer: wodForgetPeer, unsprang: wodUnsprang };`)(
    { id }, { now: clock }, foes, wodSiteId, yieldsTo);
}

const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

/**
 * A client at the Heart Fissure: `id` its socket, `clock.t` the shared clock, `storage` its device store (a reload hands
 * the same one to a new client), `service` the Maul door's stand-in (one for every client of an account: `{ days }`).
 * `who` the quiet's `<account>|<character>` (null: the host's own, off the stored session).
 */
export function client(id, { clock = { t: HEART_T }, storage = memStorage(), service = { days: new Set(), asks: [], down: false }, who = `${id}|char`, heard = true, entity = { items: [] }, realSaves = false } = {}) {
  const f = heartOf(clock.t);
  let feetAt = null;
  const p = pool(f.px, f.py);
  p.setNet(netFor(id));
  const wod = wodLaw(id, p, () => clock.t);
  p.setOnSites((from, sites) => wod.wodPeerSites(from, sites), wod.wodSprungList);
  const c = { id, f, pool: p, wod, clock, storage, service, said: [], bursts: [], taken: [], heard, entity, asked: 0 };
  // AUDIT-STOREFRONT II (lane D 2): this page's saves - a realm checkpoint handed (`realmPut()`, answering its answer's
  // door) or handed and answered (`realmSave(answer)`), a slot written and a slot loaded - told to its season host alone
  // (`realSaves`: the modules' own, scenes/shared.js and saveSlots.js)
  const saves = { realm: new Set(), slot: new Set(), loaded: new Set() };
  c.realmPut = () => { const thens = [...saves.realm].map((fn) => fn({})).filter((then) => typeof then === 'function'); return (answer) => { for (const then of thens) then(answer); }; };
  c.realmSave = (answer) => c.realmPut()(answer);
  c.slotSave = (ch) => { for (const fn of saves.slot) fn(ch); };
  c.slotLoad = (ch) => { for (const fn of saves.loaded) fn(ch); };
  const saveDoors = realSaves ? {} : { hearRealmSaves: (fn) => saves.realm.add(fn), onSlotSaved: (fn) => saves.slot.add(fn), onSlotLoaded: (fn) => saves.loaded.add(fn) };
  // AUDIT-STOREFRONT II (lane D 2): an ask's id the stand-in kept is answered with its day, as seasonClaim.js answers it
  const maulApi = {
    claim: async (rid) => {
      service.asks.push(rid);
      if (service.down) return { ok: false, error: 'offline' };
      service.rids ??= new Map();
      if (service.rids.has(rid)) return { ok: true, data: { day: service.rids.get(rid) } };
      const day = Math.floor(clock.t / 86_400_000);
      if (service.days.has(day)) return { ok: false, error: 'taken', status: 409 };
      service.days.add(day); service.rids.set(rid, day);
      return { ok: true, data: { day } };
    },
  };
  c.host = createSeasonHost({
    state: { pixelTranslation: (px, py, out) => { out[0] = (px - f.px) * 1000; out[1] = 0; out[2] = (py - f.py) * 1000; return out; } },
    exteriorFoes: p, gateScanOf: () => SCAN, warmGateScan: () => {}, surfaceAt: () => 0,
    player: { feetAt: () => feetAt }, walkMode: true, playerSpawned: true, get online() { return {}; }, collider: null, _sharedOffsetMs: 0,
    relayNowS: () => (c.heard ? Math.floor(clock.t / 1000) : null),
    _wodPeerSprung: wod.peer, wodPeerHeldAgo: (s) => wod.heldAgo(s), wodForgetPeer: (s) => wod.forgetPeer(s), wodSprang: (s) => wod.wodSprang(s), wodUnsprang: (s) => wod.unsprang(s),
    chatNotice: () => {}, say: (s) => c.said.push(s), shake: () => {}, burst: (r) => { c.bursts.push(r); return true; },
    struckAt: (fo) => renownStruckAt(fo), take: (item) => { c.taken.push(item); entity.items.push(item); }, ...(who ? { who: () => who } : {}), storage, bindPass: false,
    maulApi, wait: async () => {}, roads: null, entity, ...saveDoors, askCheckpoint: () => { c.asked += 1; },
    audio: { buffers: new Map(), play3d: () => {} }, labGrassField: { invalidate() {} }, gamePaused: () => false, townTalk: { hudHidden: false },
  });
  const heart = () => { const s = f.spot; return [s[0], 0, s[1]]; };
  c.at = (m) => { feetAt = m == null ? null : [heart()[0] + m, 0, heart()[2]]; };
  c.mine = () => p.foes.filter((x) => x.site === f.site || x.site === f.hSite);
  c.live = () => c.mine().filter((x) => !x.dead);
  c.own = () => c.live().filter((x) => !x.puppet);
  c.copies = () => c.live().filter((x) => x.puppet);
  c.colossus = () => c.live().find((x) => x.site === f.hSite) ?? null;
  c.beat = async () => { c.host.frame(); await settle(); c.host.frame(); };
  c.kill = (x) => p.damageFoe(x, 9_999_999, heart());
  c.strike = (x) => p.damageFoe(x, 1, heart());   // a blow that lands and kills nothing (a ward takes it)
  /** my full frame heard by `o` */
  c.tell = async (o) => { o.pool.applyFoes(c.id, c.pool.foesFrame(true)); await settle(); };
  c.state = () => c.host.state().find((s) => s.key === f.key) ?? null;
  return c;
}
export { memStorage };
