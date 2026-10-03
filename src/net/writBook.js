// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF6 (2026-09-29, Mac: "continue") - THE WRITS' BOOK: every act of the
// Work tab beside the Court's writs, and of the Guild tab's Stores
// (server-account/src/writs.js, bible/06-Systems/Professions-Arc.md 28).
// The Work tab's read is the professions' book's (`/v1/writs/list`,
// net/profBook.js), which the service answers with the guild writs and
// commissions beside the Court's.
//
// THE MARKET'S SHAPE (net/marketBook.js): every act one at a time, given
// up after the door's fifteen seconds and tried again on the words that
// mean "not yet", kept through the ones that mean "not now"; an act that
// moves Marks keeps its id for a press asked again (the lost answer's
// re-ask); and what moves a piece out of the save is KEPT before it is
// asked - a commission filled takes the piece out of the pack first, puts
// it back on a refusal, and a fill whose answer was lost is asked again
// with the same id when the tab next settles (ASYNC NEVER DROPS).
// ═══════════════════════════════════════════════════════════════════

import { WRIT_RID_RE } from './writLaw.js';
import { PIECE_GONE, PIECE_KEPT_ERROR } from './marketBook.js';
import { ASK_AGAIN_NOW, jittered } from './backoff.js';   // SCALE1: asks again spread out, and never at once into a minute's refusal

export const WRIT_KEPT_KEY = 'prof6.kept';
export const WRIT_TRIES = 3;
export const WRIT_RETRY_MS = Object.freeze([400, 1500]);
/** How long an act's id is kept for a press asked again. */
export const WRIT_ID_MS = 10 * 60_000;
/** The answers an act is asked again after: the network, the service's own fault, the account gate's minute spent. */
const RETRY = Object.freeze(['offline', 'server', 'rate']);
/** The answers that say nothing about the act's row - kept, and asked again once there is a session. */
const WAIT = Object.freeze(['no-session', 'auth']);
/** The answers that say the board a press was made from has moved - the Work tab reads it again. */
export const WRIT_MOVED = Object.freeze(['writ-gone', 'writ-short', 'writ-moved', 'no-writ']);
/** AUDIT 31 B5: the acts that move this account's Marks - the market's reads begun before one are overtaken by it. */
const MOVES_MARKS = Object.freeze(['supply', 'commission', 'cancel', 'decline', 'fulfil']);
/** What the Work tab says while a kept fill waits for its answer. */
export const WRIT_KEPT_TEXT = 'The counting-house has your piece and will settle the commission when it answers.';

const wait = (ms) => new Promise((res) => setTimeout(res, ms));
/** A request id: `w` and fifteen of [a-z0-9] (WRIT_RID_RE's shape). */
export function mintWritRid() {
  const b = new Uint8Array(15);
  globalThis.crypto.getRandomValues(b);
  let s = 'w';
  for (const x of b) s += (x % 36).toString(36);
  return s;
}

/**
 * @param {{ door: any, storage?: Storage|null, character: () => (string|null), now?: () => number,
 *   marks?: { set?: (n: number) => void } | null, stores?: { apply?: (s: any) => void } | null,
 *   market?: { told?: (n: number) => void, forget?: () => void } | null, holds?: ((provenance: string) => boolean) | null,
 *   sleep?: (ms: number) => Promise<void> }} o `marks` - the Marks book, told every balance an answer carries; `stores` -
 *   the professions' book, told every Stores count (a delivery's, a guild Stores move's); `market` - AUDIT 31 B5: the
 *   market's book, told the balance too and its reads let go (one begun before a writ act painted the older balance);
 *   `holds` - AUDIT 31 H1: whether another book keeps an act on a piece (the market's kept listing)
 */
export function createWritBook({ door, storage = null, character, now = () => Date.now(), marks = null, stores = null, market = null, holds = null, sleep = wait }) {
  const state = {
    /** the guild Stores as last read (the Guild tab's), or null */
    guildStores: /** @type {any} */ (null),
    /** the Officers' writ budget this seat week as last heard - `{ budget, spent, left }` - or null */
    writBudget: /** @type {any} */ (null),
    /** AUDIT 31 U12: the Work tab's forms' drafts (ui/workTab.js) - kept for the session, whatever closed the window */
    workDrafts: /** @type {any} */ (null),
  };
  const account = () => { try { return door.account?.() ?? null; } catch { return null; } };
  const slot = () => `${account() ?? ''}|${character() ?? ''}`;

  // ─── THE KEPT FILLS ────────────────────────────────────────────────
  let _memory = null;
  const table = () => {
    if (_memory) return _memory;
    try {
      const v = JSON.parse(storage?.getItem?.(WRIT_KEPT_KEY) ?? 'null');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch { return {}; }
  };
  const writeTable = (t) => { try { storage?.setItem?.(WRIT_KEPT_KEY, JSON.stringify(t)); _memory = null; } catch { _memory = t; } };
  const keptOf = (key = slot()) => { const k = table()[key]; return Array.isArray(k?.fulfils) ? k.fulfils : []; };
  const writeKept = (list, key = slot()) => {
    const t = { ...table() };
    if (list.length) t[key] = { fulfils: list }; else delete t[key];
    writeTable(t);
  };
  /** AUDIT 31 B2: a kept fill's slot is the one it was pressed in, read once at the press. */
  const keep = (entry, key = slot()) => writeKept([...keptOf(key).filter((x) => x.rid !== entry.rid), entry], key);
  const letGo = (rid, key = slot()) => { const had = keptOf(key).some((x) => x.rid === rid); writeKept(keptOf(key).filter((x) => x.rid !== rid), key); return had; };
  /** AUDIT 31 H1: the pieces this book keeps a fill of, this slot's. */
  const keptPieces = () => new Set(keptOf().map((f) => f.body?.provenance).filter(Boolean));

  /** One ask, up to WRIT_TRIES times with a wait between; the service's no is final at once. */
  async function ask(fn) {
    let r = null;
    for (let i = 0; i < WRIT_TRIES; i++) {
      if (i > 0) await sleep(jittered(WRIT_RETRY_MS[Math.min(i - 1, WRIT_RETRY_MS.length - 1)]));
      try { r = await fn(); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || !ASK_AGAIN_NOW.includes(r?.error)) return r;   // SCALE1: `rate` goes back kept, to the pump
    }
    return r;
  }
  /** What an answer carries: the balance (the Marks book told), the Stores count it moved (the professions' book told),
   *  and the guild Stores (kept for the Guild tab). */
  function heard(r) {
    const d = r?.ok ? r.data : null;
    if (!d) return r;
    if (Number.isSafeInteger(d.balance)) {
      try { marks?.set?.(d.balance); } catch { /* the Marks book's own */ }
      try { market?.told?.(d.balance); } catch { /* the market book's own */ }
    }
    if (d.store && typeof d.store.material === 'string') { try { stores?.apply?.(d.store); } catch { /* the professions' book's own */ } }
    if (Array.isArray(d.rows)) state.guildStores = { rows: d.rows, moves: d.moves ?? [], mayWithdraw: !!d.mayWithdraw };
    // the Officers' writ budget this week - a guild Stores read's, a budget set's
    const b = d.writBudget ?? (d.guild && Number.isSafeInteger(d.guild.budget) ? d.guild : null);
    if (b && Number.isSafeInteger(b.budget)) state.writBudget = { budget: b.budget, spent: b.spent | 0, left: b.left | 0 };
    return r;
  }
  const kept = (r) => RETRY.includes(r?.error) || WAIT.includes(r?.error);

  // ─── THE ACTS ──────────────────────────────────────────────────────
  let _busy = null, _busyKey = null;
  /** One act at a time: a press of the act under way is that act; any other is refused `writ-busy`. */
  const once = (key, fn) => {
    if (_busy) return _busyKey === key ? _busy : Promise.resolve({ ok: false, error: 'writ-busy' });
    _busyKey = key;
    return (_busy = (async () => { try { return await fn(); } finally { _busy = null; _busyKey = null; } })());
  };
  const ids = new Map();
  /** AUDIT 31 B4: an id is its slot's - another character's press of the same act is never answered as this one's. */
  const idFor = (key) => {
    let v = ids.get(key);
    if (v && now() - v.at > WRIT_ID_MS) v = null;
    if (!v) ids.set(key, v = { id: mintWritRid(), at: now() });
    return v.id;
  };
  /** An act with its id kept for a press asked again - let go on an answer, kept on silence. AUDIT 31 B5: an act that
   *  moves Marks lets the market's reads go, so none begun before it paints the older balance. */
  const idAct = (key, send) => once(key, async () => {
    const k = `${slot()}|${key}`;
    const r = heard(await ask(() => send(idFor(k))));
    if (!kept(r)) ids.delete(k);
    if (r?.ok && MOVES_MARKS.includes(key.split('|')[0])) { try { market?.forget?.(); } catch { /* the market book's own */ } }
    return r;
  });

  const book = {
    state,
    get busy() { return !!_busy; },
    /** Kept fills waiting for an answer. */
    get pending() { return keptOf().length; },

    /** A GUILD WRIT posted - `req` `{ region, material, units, pay }`. */
    post: (req) => idAct(`post|${JSON.stringify(req)}`, (rid) => door.post({ character: character(), ...req, rid })),
    /** A DELIVERY to a guild writ - `req` `{ region, writ, units }`. */
    supply: (req) => idAct(`supply|${JSON.stringify(req)}`, (rid) => door.supply({ character: character(), ...req, rid })),
    /** A guild writ WITHDRAWN (its Guildmaster's, or the Officer's who posted it). */
    withdraw: (writ) => idAct(`withdraw|${writ}`, (rid) => door.withdraw({ character: character(), writ, rid })),
    /** SILVER-WAYS: A GUILD CONTRACT posted - `req` `{ region, kind, pay, deeds }` - and one withdrawn. */
    contract: (req) => idAct(`contract|${JSON.stringify(req)}`, (rid) => door.contract({ character: character(), ...req, rid })),
    withdrawContract: (contract) => idAct(`cwithdraw|${contract}`, (rid) => door.withdrawContract({ character: character(), contract, rid })),
    /** The Officers' writ BUDGET, the Guildmaster's to set. */
    budget: (marks) => once(`budget|${marks}`, async () => heard(await ask(() => door.budget({ character: character(), marks })))),
    /** A COMMISSION posted - `req` `{ region, crafter, recipe, quality, pay }`. */
    commission: (req) => idAct(`commission|${JSON.stringify(req)}`, (rid) => door.commission({ character: character(), ...req, rid })),
    /** A commission CANCELLED by its poster, or DECLINED by its crafter. */
    cancel: (id) => idAct(`cancel|${id}`, (rid) => door.cancel(id, rid)),
    decline: (id) => idAct(`decline|${id}`, (rid) => door.decline(id, rid)),
    /**
     * A commission FULFILLED - `req` `{ region, commission, provenance, wear }`: the piece taken out of the save first
     * (`take`), kept with the request, put back (`putBack`) on a refusal, kept on silence.
     * @param {any} req @param {{ item: any, where: string, take: () => boolean, putBack: (item: any, where: string) => void }|null} piece
     */
    fulfil(req, piece) {
      return once(`fulfil|${JSON.stringify(req)}`, async () => {
        // AUDIT 31 B1: never taken with no account to keep it under; H1: never a piece another kept act holds
        if (!account()) return { ok: false, error: 'no-session' };
        if (req?.provenance && (keptPieces().has(req.provenance) || holds?.(req.provenance))) return { ok: false, error: PIECE_KEPT_ERROR };
        if (!piece?.take?.()) return { ok: false, error: 'piece-held' };   // AUDIT 31 H8: the save would not give it up - never "only a crafted piece lists"
        const key = slot();
        const body = { character: character(), ...req, rid: mintWritRid() };
        keep({ rid: body.rid, body, item: piece.item, where: piece.where }, key);
        const r = heard(await ask(() => door.fulfil(body)));
        if (r?.ok) { letGo(body.rid, key); try { market?.forget?.(); } catch { /* the market book's own */ } return r; }
        // AUDIT 31 B2: a refusal heard in another character's save waits for this one's settle - never put back there
        if (kept(r) || slot() !== key) return { ok: false, kept: true, error: r?.error, text: WRIT_KEPT_TEXT };
        const had = letGo(body.rid, key);
        // AUDIT 31 H1: a piece the service says is elsewhere was a copy in the save - never put back
        if (had && !PIECE_GONE.includes(r?.error)) { try { piece.putBack(piece.item, piece.where); } catch (e) { console.warn('[writs] put back', e); } }
        return r ?? { ok: false, error: 'server' };
      });
    },
    /** THE GUILD STORES read (the Guild tab's). */
    guildStores: () => once('guild-stores', async () => heard(await ask(() => door.stores(character())))),
    /** A DEPOSIT to the guild Stores, or a WITHDRAWAL from them (an Officer's or the Guildmaster's). */
    deposit: (material, units) => idAct(`deposit|${material}|${units}`, (rid) => door.deposit({ character: character(), material, units, rid })),
    withdrawStores: (material, units) => idAct(`gwithdraw|${material}|${units}`, (rid) => door.withdrawStores({ character: character(), material, units, rid })),

    /**
     * SETTLE: every kept fill asked again with its own id - let go on the answer (the piece out of the save, `drop`, in
     * case the save was not kept since it was taken), put back on a refusal.
     * @param {(item: any, where: string) => void} putBack @param {((item: any, where: string) => void)|null} [drop]
     */
    settle(putBack, drop = null) {
      const go = () => once('settle', async () => {
        const key = slot();   // AUDIT 31 B2: the slot it began in - a quick-load mid-settle stops it
        let settled = 0;
        for (const f of keptOf(key)) {
          const r = heard(await ask(() => door.fulfil(f.body)));
          if (slot() !== key) break;
          if (r?.ok) { letGo(f.rid, key); try { drop?.(f.item, f.where); } catch (e) { console.warn('[writs] drop', e); } settled++; }
          else if (!kept(r)) {
            letGo(f.rid, key);
            if (PIECE_GONE.includes(r?.error)) { try { drop?.(f.item, f.where); } catch (e) { console.warn('[writs] drop', e); } }   // AUDIT 31 H1
            else { try { putBack(f.item, f.where); } catch (e) { console.warn('[writs] put back', e); } }
            settled++;
          }
        }
        if (settled) { try { market?.forget?.(); } catch { /* the market book's own */ } }
        return { ok: true, settled };
      });
      // AUDIT 31 B10: asked while another act is under way, it waits for it - the tab's one settle is never refused
      return _busy && _busyKey !== 'settle' ? _busy.then(go, go) : go();
    },
    /** AUDIT 31 H1: whether this book keeps a fill of a piece (the market's book asks, and the host's pickers). */
    holdsPiece: (provenance) => keptPieces().has(provenance),
    /** The kept fills of this slot (a test's). */
    _kept: () => keptOf(),
    /** The rid shape, for a test. */
    ridOk: (r) => WRIT_RID_RE.test(r),
  };
  return book;
}
