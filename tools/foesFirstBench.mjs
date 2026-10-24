// FOES-FIRST (2026-10-21; bible/11-Multiplayer/Scale-Arc.md FOES-FIRST): WHICH FOES FRAMES A CROWDED ROOM LETS THROUGH,
// MEASURED ON THE REAL ROOM over the pins' fake object (test/fakeRoom.mjs) - every hello a signed token, every frame
// through the relay's own door (`webSocketMessage`), the room's own budget deciding. A scene is OWNERS sockets of
// SOCKETS in one cell's block, each streaming its foes as the client does (scenes/world.js foesStream): a frame every
// FOES_MS and the frame loop's sixteen milliseconds, FULL every FOES_FULL_MS at the owner's own phase (it came in when it
// came in). The frames are the wire's record shape (scenes/exteriorFoes.js foesFrame) at RECORDS records - a delta the
// moving share of them, a full frame every one with its look's seed, the grants (`gs`, about 150 bytes each before the
// signature) and a site sprung (`sp`). Per scene:
//
//   full / delta   the share of each kind any listener heard (a fan is whole or nothing)
//   gap p50/p99/max how long an owner's full frames were apart at its listeners - the sweep's, the grants' and the
//                   sites' latency (a grant unheard past GRANT_VERDICT_WAIT_MS, 6 s, is tallied `ungranted`)
//   stale          the share of owner-time its listeners heard nothing from it for past FOES_STALE_MS - its puppets
//                   pruned, the foes that "vanish" - and the longest any owner went unheard
//   out            the room's bytes out a second, against FOES_ROOM_BYTES_PER_S
//   heavy          (a scene with `heavy`) its first owner's full frames and deltas heard - one owner of `heavy`
//                   records among smaller ones, a star's stander (AUDIT FOES-FIRST: a claim)
//   handovers      (a scene with `hands`) the handover batches heard - two a second, each of four records naming
//                   an heir (world/foeHandover.js), from an owner leaving (AUDIT FOES-FIRST F1); (a scene with
//                   `leavers`) the batches of the sockets that hand their foes on and close in the same moment, as a
//                   door, a teleport or a death does (net/online.js join -> leave; AUDIT FOES-HOLD 3)
//
//   node tools/foesFirstBench.mjs [SECONDS=60] [SCENE=name]
//
// A model of nothing but the senders: the Room's code runs. Run on a checkout before FOES-FIRST, it measures the law
// that was (the record's "before" column was read so, off origin/main 4bba28c).
import { fakeRoom } from '../test/fakeRoom.mjs';
import { isMain } from './lib/isMain.mjs';
import { PIXEL_UNITS, FOES_ROOM_BYTES_PER_S, FOES_FULL_MS, FOES_STALE_MS } from '../src/net/wire.js';

const FOES_MS = 200;   // net/online.js FOES_MS (online.js is the page's, and imports what Node does not load)
const arg = (k, d) => process.argv.find((a) => a.startsWith(`${k}=`))?.split('=')[1] ?? d;
const SECONDS = Number(arg('SECONDS', 60)), ONLY = arg('SCENE', null);
/** FOES-HOLD: the senders stream on this long past the run, so a frame held when it ends has its turn (a frame sent
 *  after the run is not read: the run's frames are the ones it counts). */
const TAIL_MS = 15000;

/** A seeded roll (mulberry32). */
function roll(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** One record in the wire's shape (exteriorFoes.js foesFrame's `r`), a full frame's with its look's seed. */
const record = (i, full, moving) => ({
  i, t: 7 + (i % 30), x: i % 2, f: [3456.78 + i, 12.34, -7890.12 - i], y: 1.234, h: 45, k: 60, d: 0, a: 17, b: '', m: moving ? 1 : 0, g: '.', l: 9,
  w: [110, 2], c: 0, s: 0, u: '', o: 0, gr: [42, i % 4], ...(full ? { ls: 1234567890 + i, ...(i % 2 ? { lw: 'a3.b7.c12.d4.e9.f2' } : {}) } : {}),
});
/** A signed grant's size (net/grantLaw.js: the claims and an Ed25519 signature, 86 characters). */
const grant = (g, o) => ({ g, o, q: 'world:13,13', a: 'acct-0123456789abcdef', k: 'enc', p: [13, 13], m: 9, l: 9, r: 7, n: 2, s: 5, e: 0, c: [-1, -1], h: -1, x: 1800000000000, sg: 'x'.repeat(86) });
function frameOf(owner, n, full, { records, moving, grants, handRecords = 4 }, hands = false) {
  const f = [];
  if (hands) for (let i = 0; i < handRecords; i++) f.push({ ...record(i, true, true), e: 'p-9999', it: [] });   // world/foeHandover.js: an heir and the items
  else for (let i = 0; i < records; i++) { const m = i < records * moving; if (full || m) f.push(record(i, full, m)); }
  const data = { n, k: 'world:13,13', full: full && !hands ? 1 : 0, f, ...(full && !hands ? { gs: Array.from({ length: grants }, (_, g) => grant(g, owner)), sp: [[`13,13:star.4.${n % 3}`, 3]] } : {}) };
  return JSON.stringify({ t: 'foes', data });
}

export const SCENES = [
  { name: 'quiet', what: '10 owners in a cell of 20 sockets, 12 records - inside the budget', owners: 10, sockets: 20, records: 12, moving: 0.75, grants: 3 },
  { name: 'crowded', what: '30 owners in a cell of 60 sockets, 12 records', owners: 30, sockets: 60, records: 12, moving: 0.75, grants: 3 },
  { name: 'star', what: 'a star\'s crowd: 30 owners of 60, 24 records (bodies ride)', owners: 30, sockets: 60, records: 24, moving: 0.5, grants: 6 },
  { name: 'star80', what: 'a bigger star: 40 owners of 80, 24 records', owners: 40, sockets: 80, records: 24, moving: 0.5, grants: 6 },
  { name: 'big', what: '20 owners of 120 at the frame\'s record cap (64)', owners: 20, sockets: 120, records: 64, moving: 0.3, grants: 16 },
  { name: 'flood', what: 'the crowded cell, and one socket saying full:1 on 16 KiB frames at FOES_HZ_MAX', owners: 30, sockets: 60, records: 12, moving: 0.75, grants: 3, flood: 16 * 1024 },
  { name: 'stander', what: 'a star\'s stander: 40 owners of 80, 24 records, the first owner 48 (the waves, the master, the circle)', owners: 40, sockets: 80, records: 24, moving: 0.5, grants: 6, heavy: 48 },
  { name: 'stander64', what: 'the same, the stander at the frame\'s record cap (64)', owners: 40, sockets: 80, records: 24, moving: 0.5, grants: 6, heavy: 64 },
  { name: 'hands', what: 'the crowded cell, and two handover batches a second', owners: 30, sockets: 60, records: 12, moving: 0.75, grants: 3, hands: true },
  { name: 'starHands', what: 'the star\'s crowd, and two handover batches a second', owners: 30, sockets: 60, records: 24, moving: 0.5, grants: 6, hands: true },
  { name: 'burst', what: 'the star\'s crowd, and an owner handing on three batches at once every second (FOES-HOLD)', owners: 30, sockets: 60, records: 24, moving: 0.5, grants: 6, hands: true, burst: 3 },
  { name: 'liar', what: 'the star\'s crowd, and one socket calling every 16 KiB frame a handover at FOES_HZ_MAX (FOES-HOLD)', owners: 30, sockets: 60, records: 24, moving: 0.5, grants: 6, flood: 16 * 1024, liar: true },
  { name: 'leavers', what: 'the bigger star, and 30 of its others each handing on 24 foes in two batches and closing at once (AUDIT FOES-HOLD 3)', owners: 40, sockets: 80, records: 24, moving: 0.5, grants: 6, leavers: 30, handRecords: 12 },
];

async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const quiet = { info: console.info, warn: console.warn, log: console.log };
  console.info = console.warn = console.log = () => {};
  try { return await fn({ now: () => clock, set: (t) => { clock = t; } }); } finally { Date.now = realNow; Object.assign(console, quiet); }
}

export async function scene(s, seconds = SECONDS) {
  return onClock(async ({ now, set }) => {
    const BX = 13 * 16 + 8, BY = 13 * 16 + 8;
    const R = fakeRoom(`world:${Math.floor(BX / 16)},${Math.floor(BY / 16)}`, { now });
    const rnd = roll(11);
    const socks = [];
    const t0 = now();
    for (let i = 0; i < s.sockets; i++) {
      const ws = R.connect(); set(t0 + i * 120);
      await R.hello(ws, `p-${String(i).padStart(4, '0')}`, { x: (BX + rnd() * 0.5) * PIXEL_UNITS, y: 0, z: (499 - BY + rnd() * 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
      socks.push(ws);
    }
    // heard: a frame is whole or nothing, so one listener's ear is every listener's - a fan is one string to every
    // listener, read once by its number (FOES-HOLD: a held frame goes out while another sender's frame is being taken,
    // so a send is the frame it carries, not the frame that came in); an empty frame of no number is a held sender's
    // beat (it says the owner is heard, and carries nothing)
    let out = 0, last = null;
    const delivered = [];
    for (const ws of socks) ws.send = (str) => { if (now() <= end) out += str.length; if (str !== last && str.startsWith('{"t":"foes"')) { last = str; delivered.push(str); } };
    const start = now() + 5000, end = start + seconds * 1000;
    const events = [];
    for (let o = 0; o < s.owners; o++) {
      let t = start + rnd() * FOES_MS, lastFull = start - rnd() * FOES_FULL_MS;
      while (t < start + seconds * 1000 + TAIL_MS) { const full = t - lastFull >= FOES_FULL_MS; if (full) lastFull = t; events.push({ t: Math.round(t), o, full }); t += FOES_MS + Math.floor(rnd() * 17); }
    }
    const flooder = s.flood ? s.owners : -1;
    if (s.flood) for (let t = start; t < start + seconds * 1000 + TAIL_MS; t += Math.ceil(1000 / 12)) events.push({ t, o: flooder, full: true });
    // a leaver: one of the others, once, from 10 s on - its two batches at one moment and its socket closed in it
    if (s.leavers) for (let k = 0; k < s.leavers; k++) { const t = start + 10_000 + k * Math.floor((seconds * 1000 - 12_000) / s.leavers) + Math.floor(rnd() * 200); events.push({ t, o: s.owners + k, hands: true }, { t, o: s.owners + k, hands: true }, { t, o: s.owners + k, leave: true }); }
    if (s.hands) for (let t = start + 250, k = 0; t < start + seconds * 1000 + TAIL_MS; t += s.burst ? 1000 : 500, k++) for (let b = 0; b < (s.burst ?? 1); b++) events.push({ t, o: (k * 7) % s.owners, full: false, hands: true });   // each from an owner leaving, a different one each time (a burst: its batches at one moment, world/foeHandover.js)
    events.sort((x, y) => x.t - y.t);
    const pad = s.flood ? JSON.stringify({ t: 'foes', data: { n: 0, full: s.liar ? 0 : 1, f: s.liar ? [{ i: 0, e: 'p-0001', it: [] }] : [], pad: 'p'.repeat(s.flood) } }) : '';   // a liar's every record names an heir
    const st = { full: [0, 0], delta: [0, 0], flood: [0, 0], hfull: [0, 0], hdelta: [0, 0], hands: [0, 0] };
    const lastHeard = new Map(), lastFull = new Map(), gaps = [], byN = new Map(), waits = [];
    let stale = 0, n = 0, silent = 0, beats = 0;
    const heardAt = (o, t) => {
      const lh = lastHeard.get(o) ?? start;
      if (t - lh > FOES_STALE_MS) stale += t - lh - FOES_STALE_MS;
      silent = Math.max(silent, t - lh);
      lastHeard.set(o, t);
    };
    const take = (t) => {
      for (const str of delivered.splice(0)) {
        const id = /"id":"p-(\d+)"/.exec(str), num = /"data":\{"n":(\d+)/.exec(str);
        if (!id) continue;
        const o = Number(id[1]);
        if (!num) { if (o < s.owners && t <= end) { beats++; heardAt(o, t); } continue; }   // a beat: the owner heard, nothing carried (the flooder and the leavers are no owners)
        const e = byN.get(Number(num[1]));
        if (!e || e.heard || e.tail) continue;
        e.heard = true;
        const k = e.o === flooder ? 'flood' : e.hands ? 'hands' : e.full ? 'full' : 'delta';
        st[k][0]++;
        if (s.heavy && e.o === 0 && !e.hands) st[e.full ? 'hfull' : 'hdelta'][0]++;
        waits.push(t - e.t);
        if (e.o >= s.owners || t > end) continue;   // the tail: a frame of the run heard, and its owner's silences read to the run's end alone
        heardAt(e.o, t);   // a handover too: its readers hear the owner in it
        if (e.hands) continue;
        if (e.full) { gaps.push(t - (lastFull.get(e.o) ?? start)); lastFull.set(e.o, t); }
      }
    };
    const left = new Set();
    for (const e of events) {
      set(e.t);
      if (left.has(e.o)) continue;
      if (e.leave) { left.add(e.o); await R.drop(socks[e.o]); take(e.t); continue; }
      const owner = socks[e.o];
      const shape = s.heavy && e.o === 0 ? { ...s, records: s.heavy, moving: 0.75 } : s;
      e.n = ++n;
      e.tail = e.t >= end;
      byN.set(e.n, e);
      const text = e.o === flooder ? pad.replace('"n":0', `"n":${e.n}`) : frameOf(`p-${String(e.o).padStart(4, '0')}`, e.n, e.full, shape, e.hands);
      await R.raw(owner, text);
      take(e.t);
      if (e.tail) continue;
      const k = e.o === flooder ? 'flood' : e.hands ? 'hands' : e.full ? 'full' : 'delta';
      st[k][1]++;
      if (s.heavy && e.o === 0 && !e.hands) st[e.full ? 'hfull' : 'hdelta'][1]++;
    }
    for (let o = 0; o < s.owners; o++) {
      const lh = lastHeard.get(o) ?? start;
      if (end - lh > FOES_STALE_MS) stale += end - lh - FOES_STALE_MS;
      silent = Math.max(silent, end - lh);
      gaps.push(end - (lastFull.get(o) ?? start));
    }
    gaps.sort((x, y) => x - y);
    const q = (p) => gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))] / 1000;
    const pct = ([p, all]) => (all ? Math.round((1000 * p) / all) / 10 : null);
    return {
      scene: s.name, full: pct(st.full), delta: pct(st.delta), ...(s.flood ? { flood: pct(st.flood) } : {}),
      ...(s.heavy ? { heavyFull: pct(st.hfull), heavyDelta: pct(st.hdelta) } : {}), ...(s.hands || s.leavers ? { hands: pct(st.hands) } : {}),
      gapP50: q(0.5), gapP99: q(0.99), gapMax: gaps.at(-1) / 1000,
      stale: Math.round((10000 * stale) / (s.owners * seconds * 1000)) / 100, unheardMax: silent / 1000, outMiBs: Math.round((100 * out) / seconds / FOES_ROOM_BYTES_PER_S * 4) / 100,
      waitP99: (waits.sort((x, y) => x - y)[Math.min(waits.length - 1, Math.floor(0.99 * waits.length))] ?? 0) / 1000, beats,
    };
  });
}

if (isMain(import.meta.url)) {
  const rows = [];
  for (const s of SCENES) if (!ONLY || s.name === ONLY) {
    const r = await scene(s);
    rows.push(r);
    process.stdout.write(`${s.name.padEnd(8)} ${s.what}\n  full ${r.full}%  delta ${r.delta}%${r.flood != null ? `  flood ${r.flood}%` : ''}${r.heavyFull != null ? `  heavy full ${r.heavyFull}% delta ${r.heavyDelta}%` : ''}${r.hands != null ? `  handovers ${r.hands}%` : ''}  full frames apart p50 ${r.gapP50} s, p99 ${r.gapP99} s, max ${r.gapMax} s  stale ${r.stale}% (unheard ${r.unheardMax} s at most)  waited p99 ${r.waitP99} s  beats ${r.beats}  out ${r.outMiBs} MiB/s\n`);
  }
}
