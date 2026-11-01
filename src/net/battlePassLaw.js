// @ts-check
// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md) and PASS-PANELS (2026-10-30, the owner: "rework this to be more
// of a helldivers type system ... a free panel track and a premium panel track using our new currency to both unlock
// tracks and buy the items"): THE BATTLE PASS'S LAW. A season's two tracks of panels, each item bought with Aurum in any
// order, a panel opened by the Aurum its track has had spent on it, the premium track opened with Aurum; no track closes.
// The Aurum a deed finds (a day's bound), the stages' challenges and the season's calendar (the world's three stages) are
// here too. Read by the account service (server-account/src/battlePass.js) and the page. Every item is cosmetic (the
// Terms' section 9). A leaf. Not a DFU member: DFU has no seasons or accounts. Ledger A (STOREFRONT).

const DAY_MS = 86_400_000;
const stage = (/** @type {string} */ key, /** @type {number} */ fromMs) => Object.freeze({ key, fromMs, toMs: fromMs + 20 * DAY_MS });
const S1_FROM = Date.UTC(2026, 10, 10);
/** THE SEASONS, one a row: its id (a ledger ref's head), its first and end instant (UTC ms; the end is not inside), when
 *  its tracks start selling (`tracksFromMs`, never closing) and its three stages of twenty days - the world's
 *  (scenes/seasonHost.js) and the challenges'. Season One's tracks sell before its world begins (the owner). */
export const PASS_SEASONS = Object.freeze([
  Object.freeze({
    id: 's1', fromMs: S1_FROM, toMs: S1_FROM + 60 * DAY_MS, tracksFromMs: Date.UTC(2026, 10, 1),
    stages: Object.freeze([stage('tremor', S1_FROM), stage('halls', S1_FROM + 20 * DAY_MS), stage('heart', S1_FROM + 40 * DAY_MS)]),
  }),
]);
/** A season by its id, or null. */
export const passSeasonById = (/** @type {unknown} */ id) => PASS_SEASONS.find((s) => s.id === id) ?? null;
/** The season running at `nowMs` (inside its sixty days), or null. Pure. */
export const passSeasonAt = (/** @type {number} */ nowMs) => (Number.isFinite(nowMs) ? PASS_SEASONS.find((s) => nowMs >= s.fromMs && nowMs < s.toMs) ?? null : null);
/** The season running now or the next to come, else the last that ran - the one the window opens on. */
export const passSeasonShown = (/** @type {number} */ nowMs) => passSeasonAt(nowMs) ?? PASS_SEASONS.find((s) => s.fromMs > nowMs) ?? PASS_SEASONS[PASS_SEASONS.length - 1] ?? null;
/** The index of a season's stage at `nowMs`: -1 before it, the last stage's after it ends. */
export function passStageAt(/** @type {any} */ season, /** @type {number} */ nowMs) {
  if (!season || !Number.isFinite(nowMs) || nowMs < season.fromMs) return -1;
  let i = 0;
  while (i + 1 < season.stages.length && nowMs >= season.stages[i + 1].fromMs) i++;
  return i;
}
/** Whether a season runs at `nowMs` (inside its days): its challenges count and its world stands. */
export const passOpen = (/** @type {any} */ season, /** @type {number} */ nowMs) => !!season && Number.isFinite(nowMs) && nowMs >= season.fromMs && nowMs < season.toMs;
/** Whether a season's tracks sell at `nowMs`: from its `tracksFromMs`, for good (the owner: "Never expire"). */
export const passTracksOpen = (/** @type {any} */ season, /** @type {number} */ nowMs) => !!season && Number.isFinite(nowMs) && nowMs >= season.tracksFromMs;

// ═══ THE FINDS: AURUM A DEED EARNS ═══════════════════════════════════════════════════════════════════════════════════
/** The Aurum a deed finds, by its source - a foe by its kind (systems/pass/passClient.js passFoeSource), an act by its
 *  family (systems/questlines/qlActs.js ACT_KINDS), a quest done and a bounty paid. `construct` is the season's own foe. */
export const PASS_SOURCES = Object.freeze({
  foe: 1, undead: 1, daedra: 1, elite: 4, construct: 2,
  gather: 1, make: 1, loot: 1, tavern: 3, sea: 3, world: 8, endgame: 20, quest: 10, bounty: 10,
});
export const isPassSource = (/** @type {unknown} */ s) => typeof s === 'string' && Object.hasOwn(PASS_SOURCES, s);
/** The Rourken's works, the season's constructs wherever they are met (Daggerfall Enemy Expansion's Centurion Sphere,
 *  Iron Golem and Steam Centurion - scenes/ketch/ketchFight.js KT_LOOKS): a `construct` find, and the Resonant Maul's
 *  quarry (systems/pass/resonantMaul.js). */
export const PASS_CONSTRUCT_MOBILES = Object.freeze([289, 270, 290]);
/** A UTC day's bounds an account: the asks heard, and the Aurum its finds may earn. */
export const PASS_DAY_ASKS = 2000;
export const PASS_DAY_AURUM = 100;
/** When finds start paying (ms): Season One's first instant. They never stop - Aurum is the account's, not a season's. */
export const PASS_FINDS_FROM_MS = S1_FROM;
/** A find's Aurum: the source's under what is left of the day's bound (`dayAurum` found already today). Pure. */
export function passFindAurum(/** @type {string} */ source, /** @type {number} */ dayAurum) {
  if (!isPassSource(source)) return 0;
  const left = Math.max(0, PASS_DAY_AURUM - Math.max(0, Number(dayAurum) || 0));
  return Math.min(PASS_SOURCES[/** @type {keyof typeof PASS_SOURCES} */ (source)], left);
}

// ═══ THE CHALLENGES ══════════════════════════════════════════════════════════════════════════════════════════════════
const challenge = (/** @type {number} */ st, /** @type {string} */ key, /** @type {string[]} */ sources, /** @type {number} */ n, /** @type {number} */ aurum) => Object.freeze({ stage: st, key, sources: Object.freeze(sources), n, aurum });
/** A STAGE'S CHALLENGES: each counts its sources' deeds while its stage runs and pays its Aurum once, on the deed that
 *  completes it, beside the day's bound (never under it). */
export const PASS_CHALLENGES = Object.freeze([
  challenge(0, 'tremor-foes', ['foe', 'undead', 'daedra', 'elite', 'construct'], 100, 100),
  challenge(0, 'tremor-constructs', ['construct'], 25, 150),
  challenge(0, 'tremor-gather', ['gather'], 60, 60),
  challenge(0, 'tremor-tavern', ['tavern'], 3, 60),
  challenge(0, 'tremor-endgame', ['endgame'], 1, 100),
  challenge(1, 'halls-constructs', ['construct'], 60, 150),
  challenge(1, 'halls-elites', ['elite'], 10, 100),
  challenge(1, 'halls-make', ['make', 'loot'], 30, 60),
  challenge(1, 'halls-world', ['world', 'quest', 'bounty'], 6, 100),
  challenge(1, 'halls-endgame', ['endgame'], 3, 150),
  challenge(2, 'heart-constructs', ['construct'], 100, 200),
  challenge(2, 'heart-foes', ['foe', 'undead', 'daedra', 'elite', 'construct'], 300, 150),
  challenge(2, 'heart-sea', ['sea', 'gather'], 40, 60),
  challenge(2, 'heart-world', ['world', 'quest', 'bounty'], 8, 100),
  challenge(2, 'heart-endgame', ['endgame'], 5, 200),
]);
export const passChallengeOf = (/** @type {unknown} */ key) => PASS_CHALLENGES.find((c) => c.key === key) ?? null;

// ═══ THE TRACKS AND THEIR PANELS ═════════════════════════════════════════════════════════════════════════════════════
/** A panel's item: its grant (`<kind>:<key>` - a title, a glyph, a profile icon, an aura or an effect, net/effectLaw.js
 *  `kill`, `portal`, `mount`) and its price in Aurum. A panel opens once its track has had `open` Aurum spent on it. */
const item = (/** @type {string} */ grant, /** @type {number} */ aurum) => Object.freeze({ grant, aurum });
const panel = (/** @type {number} */ open, /** @type {ReadonlyArray<any>} */ items) => Object.freeze({ open, items: Object.freeze([...items]) });
export const PASS_TRACKS = Object.freeze(['free', 'premium']);
/** SEASON ONE'S TRACKS: the free track every registered account may buy from, and the premium track PASS_PREMIUM_AURUM
 *  opens. Each item once, in any order its open panels allow; the owner's "No overbundence of titles and profile icons"
 *  holds - one title free, two premium. The Brass Crown came with the retired Seasonal Collector; it is the track's now. */
export const PASS_PANELS = Object.freeze({
  s1: Object.freeze({
    free: Object.freeze([
      panel(0, [item('glyph:cog', 200), item('icon:aetherium', 300)]),
      panel(300, [item('title:tremorborn', 400), item('portal:brass', 700)]),
      panel(1000, [item('kill:tonal', 700)]),
    ]),
    premium: Object.freeze([
      panel(0, [item('glyph:tonalfork', 200), item('icon:lexicon', 300), item('aura:aetherium', 1000)]),
      panel(600, [item('icon:gearheart', 400), item('glyph:gearcrown', 300), item('title:heartwaker', 600), item('aura:gildedcoil', 1200)]),
      panel(2000, [item('title:numidiumecho', 800), item('mount:automaton', 1600)]),
      // THE CAPSTONE (2026-10-30, the owner: "for the final tiers we implement the developer wing aura has a light blue
      // style"; asked, a page of its own at 2,000): it opens at what every item before it costs, so only once all are bought
      panel(6400, [item('aura:aetherwings', 2000)]),
    ]),
  }),
});
/** The Aurum that opens a season's premium track, once. */
export const PASS_PREMIUM_AURUM = Object.freeze({ s1: 1000 });
/** A track's panels, or none. */
export const passPanelsOf = (/** @type {unknown} */ season, /** @type {unknown} */ track) =>
  /** @type {ReadonlyArray<{ open: number, items: ReadonlyArray<{ grant: string, aurum: number }> }>} */ (/** @type {any} */ (PASS_PANELS)[/** @type {string} */ (season)]?.[/** @type {string} */ (track)] ?? []);
/** Where an item stands - `{ season, track, panel, open, aurum }` - or null for one no track sells. Pure. */
export function passItemOf(/** @type {unknown} */ season, /** @type {unknown} */ grant) {
  for (const track of PASS_TRACKS) {
    const panels = passPanelsOf(season, track);
    for (let p = 0; p < panels.length; p++) {
      const it = panels[p].items.find((x) => x.grant === grant);
      if (it) return { season: /** @type {string} */ (season), track, panel: p, open: panels[p].open, aurum: it.aurum };
    }
  }
  return null;
}
/** The Aurum an account has spent on a track: the prices of its items among `bought` (grants). Pure. */
export const passSpentOn = (/** @type {unknown} */ season, /** @type {unknown} */ track, /** @type {ReadonlyArray<string>} */ bought) =>
  passPanelsOf(season, track).reduce((a, p) => a + p.items.reduce((b, it) => b + (bought.includes(it.grant) ? it.aurum : 0), 0), 0);
/** Whether a track's panel `p` is open to an account that bought `bought`. Pure. */
export const passPanelOpen = (/** @type {unknown} */ season, /** @type {unknown} */ track, /** @type {number} */ p, /** @type {ReadonlyArray<string>} */ bought) => {
  const panels = passPanelsOf(season, track);
  return p >= 0 && p < panels.length && passSpentOn(season, track, bought) >= panels[p].open;
};
/** WHY AN ITEM CANNOT BE BOUGHT, or null when it can: `item` (no track sells it), `soon` (its season's tracks not open
 *  yet), `held`, `track` (the premium track not opened), `panel` (its panel not open). The balance is the service's to
 *  read. `premium` whether the account opened the premium track. Pure. */
export function passBuyBlock(/** @type {unknown} */ season, /** @type {unknown} */ grant, /** @type {{ premium: boolean, bought: ReadonlyArray<string>, nowMs: number }} */ a) {
  const at = passItemOf(season, grant), s = passSeasonById(season);
  if (!at || !s) return 'item';
  if (!passTracksOpen(s, a.nowMs)) return 'soon';
  if (a.bought.includes(/** @type {string} */ (grant))) return 'held';
  if (at.track === 'premium' && !a.premium) return 'track';
  if (!passPanelOpen(season, at.track, at.panel, a.bought)) return 'panel';
  return null;
}
/** Every grant a track sells, in any season - the keys a vocabulary must hold (pinned). */
export const PASS_ALL_GRANTS = Object.freeze([...new Set(Object.values(PASS_PANELS).flatMap((s) => PASS_TRACKS.flatMap((t) => (/** @type {any} */ (s)[t] ?? []).flatMap((/** @type {any} */ p) => p.items.map((/** @type {any} */ it) => it.grant)))))]);
/** The grants an account holds of the pass (its `pass_items`, space-separated grants bought). Pure. */
export const passItemsOf = (/** @type {unknown} */ v) => [...new Set(String(v ?? '').split(' ').filter((g) => PASS_ALL_GRANTS.includes(g)))];
/** The keys of one kind (`title`, `glyph`, `icon`, `aura`, `kill`, `portal`, `mount`) among the grants held. Pure. */
export function passKeysOf(/** @type {ReadonlyArray<string>} */ items, /** @type {string} */ kind) {
  const out = [];
  for (const g of items) { const i = g.indexOf(':'); if (g.slice(0, i) === kind && !out.includes(g.slice(i + 1))) out.push(g.slice(i + 1)); }
  return out;
}

/**
 * THE PASS'S CARD as the account read carries it (`/v1/account`'s `pass`, server-account/src/battlePass.js passOf),
 * checked on the way in: the season shown, whether finds are asked, the stage, the tracks it opened, the items it bought
 * (a track's), the Aurum its finds earned today and the day's bound, and each challenge's count. Null for anything else.
 * Pure.
 * @param {any} c
 */
export function passCardOf(c) {
  const season = c && typeof c === 'object' ? passSeasonById(c.season) : null;
  if (!season) return null;
  const whole = (/** @type {unknown} */ v, /** @type {number} */ max) => (Number.isSafeInteger(v) && /** @type {number} */ (v) >= 0 && /** @type {number} */ (v) <= max ? /** @type {number} */ (v) : 0);
  const rows = Array.isArray(c.challenges) ? c.challenges : [];
  return {
    season: season.id, open: c.open === true,
    stage: Number.isInteger(c.stage) && c.stage >= -1 && c.stage < season.stages.length ? c.stage : -1,
    tracks: { free: true, premium: c.tracks?.premium === true },
    bought: (Array.isArray(c.bought) ? c.bought : []).filter((/** @type {unknown} */ g, /** @type {number} */ i, /** @type {unknown[]} */ a) => !!passItemOf(season.id, g) && a.indexOf(g) === i),
    today: whole(c.today, PASS_DAY_AURUM), dayMax: PASS_DAY_AURUM,
    // AUDIT-STOREFRONT III C13: each folio's Aurum spent, the service's ledger's word - none from an older service
    spent: c.spent && typeof c.spent === 'object' ? { free: whole(c.spent.free, 1e9), premium: whole(c.spent.premium, 1e9) } : null,
    challenges: PASS_CHALLENGES.map((k) => { const g = rows.find((/** @type {any} */ x) => x?.key === k.key); return { key: k.key, n: Math.min(whole(g?.n, 1e6), k.n), paid: g?.paid === true }; }),
  };
}
