// @ts-check
// SEAT2a part four (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): WHAT THE
// CLIENT HOLDS OF A SIEGE - the room's words (net/wire.js validSiegeOut) folded into one state: the field (the banners,
// the Throne, the clock, who is in), the roll call (every fighter's vitality and side), the end and this fighter's own
// receipt; and the HUD's words for it (bible/11-Multiplayer/Seats-Arc.md 19, "The siege HUD" and "The result card").
//
// PURE: a state and a word in, the next state out (`foldSiege`); the words from a state and what the client knows of the
// battle (its seat, its two guilds, its kind and tier, this player's id and side). The session around it (scenes/
// world.js) keeps the state, moves the player on a `back` or a rise at its camp, and carries the receipt to the service
// (net/siege/siegeClaims.js).
//
// Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
import { SIEGE_THRONE, SIEGE_BANNER_NAMES, SIEGE_SPECTATORS_MAX, SIEGE_NPC_KINDS, siegeNextWave, siegeWaveMs, siegeNpcAt, isSiegeNpcId } from './siegeRef.js';
import { heraldryOf } from '../heraldryLaw.js';   // HERALDRY-SHOWN: each side's heraldry on the HUD
import { marksText } from '../marksLaw.js';   // GUILD3a (bible/11-Multiplayer/Guilds-Made-Plain.md): an amount of silver in its words
import { heraldryByTag } from '../heraldryIndex.js';   // HERALDRY-SHOWN: the dressed seat's guilds, by tag

/**
 * @typedef {{ hp: number, max: number, down: boolean, side: 'attack'|'defend'|null }} SiegeFighter
 * @typedef {{ banners: ReadonlyArray<ReadonlyArray<number>>, throne: number, startMs: number, endMs: number,
 *   counts: ReadonlyArray<number>, roll: Readonly<Record<string, SiegeFighter>>, end: { r: string, a: number }|null,
 *   receipt: string|null, no: string|null, heardAt: number, fellAt: Readonly<Record<string, number>>,
 *   gate: ReadonlyArray<number>|null, ram: ReadonlyArray<number>|null, walls: number,
 *   npcs: ReadonlyArray<SiegeNpc>, revolt: boolean }} SiegeState
 * @typedef {{ id: string, kind: string, hp: number, max: number, x: number, z: number, tx: number, tz: number, at: number,
 *   down: boolean, atk: number, hurtAt: number }} SiegeNpc
 * SEAT2b part two (b): `gate` the Gatehouse `[vitality, whole]` where one stands, `ram` the Ram `[vitality, whole, its
 * charge's seconds, Rams left in the camp]` while one stands or waits, `walls` the Walls' tier (the defenders' wave).
 * SEAT2b part two (c): `npcs` the relay's own fighters (the Barracks' guards, a revolt's Captain and rebels) - each where
 * the field's frame said it stood at `at` (this client's clock) and where it walks, its vitality, its blow's landing (the
 * relay's clock, 0 none), when a blow last met it; `revolt` the battle a revolt's.
 */
/** Nothing heard yet. @type {Readonly<SiegeState>} */
export const SIEGE_STATE_EMPTY = Object.freeze({
  banners: Object.freeze([]), throne: 0, startMs: 0, endMs: 0, counts: Object.freeze([0, 0, 0]), roll: Object.freeze({}),
  end: null, receipt: null, no: null, heardAt: 0, fellAt: Object.freeze({}), gate: null, ram: null, walls: 0,
  npcs: Object.freeze([]), revolt: false,
});
/** SEAT2b part two (c): one of the relay's own fighters stopped where it stands at `now` (a fall). */
const stopped = (n, now) => { const [x, z] = siegeNpcAt(n, now); return { x, z, tx: x, tz: z, at: now }; };
/** SEAT2b part two (c): one of the relay's own fighters' vitality or fall moved, by its id. */
const npcMoved = (s, id, f) => s.npcs.map((n) => (n.id === id ? { ...n, ...f(n) } : n));
/** SEAT2b part two (c): where one of the relay's own fighters stands at `now` (this client's clock), `[x, z]` room units -
 *  its walk carried on from the frame that said it (net/siege/siegeRef.js siegeNpcAt, the relay's own law). */
export const siegeNpcShown = (n, now) => siegeNpcAt(n, now);
/** @type {ReadonlyArray<'attack'|'defend'|null>} */
const SIDE = [null, 'attack', 'defend'];

/**
 * One word folded in: the roll call replaces every fighter's; one fighter's vitality, fall and rise move its own; the
 * field replaces the field; the end is said once, and a receipt once heard is kept. A `back` moves the player, not the
 * state. @param {Readonly<SiegeState>} s @param {any} g a validSiegeOut projection @param {number} now
 * @returns {Readonly<SiegeState>}
 */
export function foldSiege(s, g, now) {
  if (!g) return s;
  switch (g.k) {
    case 'st': {
      /** @type {Record<string, SiegeFighter>} */
      const roll = {};
      for (const [id, hp, max, down, side] of g.f) roll[id] = { hp, max, down: down === 1, side: SIDE[side ?? 0] ?? null };
      return { ...s, roll, heardAt: now };
    }
    case 'hp': {
      if (isSiegeNpcId(g.id)) return { ...s, npcs: npcMoved(s, g.id, (n) => ({ hp: g.h, max: g.m, down: g.h > 0 ? n.down : true, hurtAt: g.h < n.hp ? now : n.hurtAt })), heardAt: now };   // SEAT2b part two (c)
      const was = s.roll[g.id];
      return { ...s, roll: { ...s.roll, [g.id]: { hp: g.h, max: g.m, down: g.h > 0 ? false : (was?.down ?? false), side: was?.side ?? null } }, heardAt: now };
    }
    case 'fell': {
      if (isSiegeNpcId(g.id)) return { ...s, npcs: npcMoved(s, g.id, (n) => ({ ...stopped(n, now), hp: 0, down: true, atk: 0 })), heardAt: now };   // SEAT2b part two (c): it falls where it stood
      const was = s.roll[g.id];
      return { ...s, roll: { ...s.roll, [g.id]: { hp: 0, max: was?.max ?? 0, down: true, side: was?.side ?? null } }, fellAt: { ...s.fellAt, [g.id]: now }, heardAt: now };
    }
    case 'up': {
      const was = s.roll[g.id];
      return { ...s, roll: { ...s.roll, [g.id]: { hp: was?.max ?? 0, max: was?.max ?? 0, down: false, side: was?.side ?? null } }, heardAt: now };
    }
    case 'f': return { ...s, banners: g.b, throne: g.th, startMs: g.s, endMs: g.e, counts: g.n, gate: g.g ?? null, ram: g.r ?? null, walls: g.w ?? 0, heardAt: now,   // SEAT2b part two (b): the works
      npcs: (g.np ?? []).map(([id, code, hp, max, x, z, tx, tz, down, atk]) => {
        const was = s.npcs.find((n) => n.id === id) ?? null;
        // AUDIT SEATS-2 C2: one already down and still down keeps when it fell (and where) - every second's frame carries the
        // fallen too, and a fall begun again each second would replay it for as long as the body lies
        if (was?.down && down === 1) return { ...was, hp, max };
        return { id, kind: SIEGE_NPC_KINDS[code] ?? '', hp, max, x, z, tx, tz, at: now, down: down === 1, atk, hurtAt: was?.hurtAt ?? -Infinity };
      }),   // SEAT2b part two (c): the relay's own fighters
      revolt: g.v === 1 };
    case 'end': return { ...s, end: { r: g.r, a: g.a }, receipt: g.rc ?? s.receipt, heardAt: now };
    case 'no': return { ...s, no: g.m, heardAt: now };
    default: return s;
  }
}

// ─── THE HUD'S WORDS (Seats-Arc 19) ─────────────────────────────────

/** A guild in the HUD's words: its tag, or its name. */
const tagOf = (g) => (g?.tag ? g.tag : g?.name ?? '');
/** mm:ss, never negative. */
export const siegeClockText = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000)), ss = String(t % 60).padStart(2, '0');
  // SEAT2b part two (c): a revolt's two hours as h:mm:ss
  return t >= 3600 ? `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${ss}` : `${Math.floor(t / 60)}:${ss}`;
};
/** A banner's mark (19: "^ attackers, o defenders, ~ contested" - DECIDED here: `~` a banner being raised from the other
 *  side, its raise beside it). */
export function bannerMark(b, att, def) {
  const [held, raise, by] = b;
  if (by && by !== held && raise > 0) return `~ ${raise}/20`;
  return held === 1 ? `^ ${tagOf(att)}` : held === 2 ? `o ${tagOf(def)}` : '-';
}
/**
 * THE BAR: `[title line, banner line]` - the seat in capitals, the holder against the challenger, the clock (to the
 * start, then to the end); each banner by name and mark, and the Throne (a siege's) - its share of the hold and the rule
 * that opens it. `battle` `{ seat, kind, tier, attacker, defender }` (the guilds `{ name, tag }`).
 */
export function siegeBarLines(s, battle, now) {
  const revolt = battle.kind === 'revolt' || s.revolt;   // SEAT2b part two (c): the town against its holder
  const head = `${String(battle.seat ?? '').toUpperCase()}   ${battle.defender?.name ?? ''} <${tagOf(battle.defender)}>   vs   ${revolt ? 'THE RISING' : `${battle.attacker?.name ?? ''} <${tagOf(battle.attacker)}>`}`;
  const clock = !s.startMs ? '' : now < s.startMs ? `joined in ${siegeClockText(s.startMs - now)}` : siegeClockText(s.endMs - now);
  if (revolt) return [`${head}   ${clock}`.trimEnd(), siegeRisingLine(s)];
  const names = SIEGE_BANNER_NAMES.slice(0, s.banners.length);
  const marks = s.banners.map((b, i) => `${names[i].toUpperCase()} [${bannerMark(b, battle.attacker, battle.defender)}]`).join('    ');
  let throne = '';
  if (battle.kind === 'siege') {
    const rule = SIEGE_THRONE[battle.tier] ?? SIEGE_THRONE.palace;
    const held = s.banners.filter((b) => b[0] === 1).length;
    const pct = Math.min(100, Math.floor((100 * s.throne) / rule.holdS));
    // SEAT2b part two (b) (6.2): where a Gatehouse stands, the Throne opens on the banners AND its breach
    const barred = !!s.gate && s.gate[0] > 0;
    throne = `THRONE ${held >= rule.banners && !barred ? 'OPEN ' : ''}${pct}% (${rule.banners} of ${s.banners.length}${s.gate ? ' + the Gatehouse' : ''})`;
  }
  return [`${head}   ${clock}`.trimEnd(), `${marks}${throne ? `    ${throne}` : ''}`];
}
/** SEAT2b part two (c) (7.7): A REVOLT'S LINE - the Rebel Captain's vitality (or his fall) and the rebels still standing. */
export function siegeRisingLine(s) {
  const cap = s.npcs.find((n) => n.kind === 'captain');
  const rebels = s.npcs.filter((n) => n.kind === 'rebel');
  const capText = !cap ? 'THE CAPTAIN' : cap.down ? 'THE CAPTAIN HAS FALLEN' : `THE CAPTAIN ${cap.hp} / ${cap.max}`;
  return `${capText}    REBELS ${rebels.filter((n) => !n.down).length} of ${rebels.length} stand`;
}
/** SEAT2b part two (c) (7.5): the Barracks' guards standing - '' where the battle has none. */
export function siegeGuardsText(s) {
  const guards = s.npcs.filter((n) => n.kind === 'guard');
  return guards.length ? `GUARDS ${guards.filter((n) => !n.down).length} of ${guards.length} stand` : '';
}
/** SEAT2b part two (b): THE WORKS' LINE (6.2) - the Gatehouse's vitality or its breach, the Ram's (crewed time toward
 *  its next stroke, the camp's Rams behind it), the Walls' tier - or '' where the battle has none. */
export function siegeWorksLine(s) {
  const out = [];
  if (s.gate) out.push(s.gate[0] > 0 ? `GATEHOUSE ${s.gate[0].toLocaleString('en-US')} / ${s.gate[1].toLocaleString('en-US')}` : 'GATEHOUSE BREACHED');
  if (s.gate && s.gate[0] > 0 && s.ram) {
    const [hp, max, charge, left] = s.ram;
    const behind = left > 0 ? ` - ${left} more in the camp` : '';
    out.push(max > 0 ? `RAM ${hp.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}  ${charge}/10 s${behind}` : `RAM coming at the next wave${behind}`);
  }
  if (s.walls > 0) out.push(`WALLS ${s.walls}`);
  const guards = siegeGuardsText(s);   // SEAT2b part two (c)
  if (guards) out.push(guards);
  return out.join('    ');
}
/** Each side's fighters up and down, off the roll call: `SH  8 up / 2 down`. */
export function siegeSidesLine(s, battle) {
  const n = { attack: [0, 0], defend: [0, 0] };
  for (const f of Object.values(s.roll)) if (f.side) n[f.side][f.down ? 1 : 0]++;
  if (battle.kind === 'revolt' || s.revolt) return `${tagOf(battle.defender)}  ${n.defend[0]} up / ${n.defend[1]} down`;   // SEAT2b part two (c): one side
  return `${tagOf(battle.defender)}  ${n.defend[0]} up / ${n.defend[1]} down      ${tagOf(battle.attacker)}  ${n.attack[0]} up / ${n.attack[1]} down`;
}
/** This fighter's own lines - its vitality, and when it has fallen, its wave (`waveMs` the tier's - SEAT2b part two (b): a
 *  defender's the Walls' quicker, net/siege/siegeRef.js siegeWaveMs) - or the spectator's. */
export function siegeSelfLines(s, me, now, { tier = 'palace', watching = false } = {}) {
  if (watching) return [`Spectating - ${s.counts[2] ?? 0} of ${SIEGE_SPECTATORS_MAX}`];
  const f = s.roll[me];
  if (!f) return [];
  const bars = f.max > 0 ? Math.round((10 * f.hp) / f.max) : 0;
  const out = [`vitality  ${'|'.repeat(bars)}${'.'.repeat(10 - bars)}  ${f.hp} / ${f.max}`];
  if (f.down) out.push(`next wave in ${Math.max(0, Math.ceil((siegeNextWave(s.fellAt[me] ?? now, siegeWaveMs({ tier, works: { walls: s.walls } }, f.side)) - now) / 1000))} s`);
  return out;
}
/** THE RESULT CARD's title (19), in capitals: who holds or takes the Throne, the forfeit, the absence, a Tourney's
 *  winner, a dead heat. */
export function siegeResultTitle(end, battle) {
  const seat = String(battle.seat ?? '').toUpperCase();
  const D = String(battle.defender?.name ?? '').toUpperCase(), A = String(battle.attacker?.name ?? '').toUpperCase();
  if (battle.kind === 'tourney') {
    if (end.r === 'attack') return `${A} WINS THE TOURNEY FOR ${seat}`;
    if (end.r === 'defend') return `${D} WINS THE TOURNEY FOR ${seat}`;
    return `A DEAD HEAT AT ${seat} - THE GREATER INFLUENCE TAKES IT`;
  }
  if (battle.kind === 'revolt') return end.r === 'defend' ? `${D} PUTS DOWN THE REVOLT AT ${seat}` : `THE REVOLT STANDS - ${seat} IS LOST TO ${D}`;   // SEAT2b part two (c)
  if (end.r === 'attack') return `${A} TAKES THE THRONE OF ${seat}`;
  if (end.r === 'forfeit') return `${A} NEVER CAME - ${D} HOLDS ${seat}`;
  if (end.r === 'absent') return `NEITHER SIDE CAME - ${D} KEEPS ${seat}`;
  return `${D} HOLDS THE THRONE OF ${seat}`;
}
/** The card's second line: how long it ran, and each banner's mark at the end. */
export function siegeResultLine(s) {
  const t = Math.max(0, Math.round(((s.heardAt || s.startMs) - s.startMs) / 1000));
  const names = SIEGE_BANNER_NAMES.slice(0, s.banners.length);
  const marks = s.banners.map((b, i) => `${names[i]} ${b[0] === 1 ? '^' : b[0] === 2 ? 'o' : '-'}`).join('  ');
  return `${Math.floor(t / 60)} minutes ${t % 60} seconds.  ${marks}`.trimEnd();
}
/** AUDIT-SEATS C7: THE CARD'S WORDS FOR A CLAIM REFUSED FOR GOOD (net/siege/siegeClaims.js siegeClaimSettles) - claimed before,
 *  the battle void or gone, a receipt that is not the relay's (the account service's words for those - accountRefusalText
 *  - speak of a gate's receipt and of signing a roster, not of this battle's Honours). */
export const SIEGE_CLAIM_REFUSED = Object.freeze({
  'honours-twice': 'Your Honors from this battle are claimed already.',
  'battle-none': 'No Honors this battle: the battle was void.',
  receipt: 'No Honors this battle: your receipt from it could not be read.',
});
/** AUDIT-SEATS C7: a settling refusal (`{ ok: false, error }`) in the card's words. */
export const siegeClaimRefusal = (a) => SIEGE_CLAIM_REFUSED[a?.error] ?? SIEGE_CLAIM_REFUSED.receipt;
/** The card's Honours line, once the service answered the claim (`honours` its answer, null for none earned; AUDIT-SEATS
 *  C7: a refusal's own words, siegeClaimRefusal). */
export function siegeHonourLine(honours) {
  if (typeof honours === 'string') return honours;
  if (!honours) return 'No Honors this battle: they are earned by standing half the battle or felling a foe.';
  if (honours.spent) return 'Your Honor: these two guilds\' Honors were earned already this Season.';
  return `Your Honor: ${marksText(Number(honours.marks))}, ${Number(honours.xp).toLocaleString('en-US')} Renown, one Spoils of War roll`;   // GUILD3a: silver, as every sentence says it
}

/** SEAT2b part two (c): the card's word on Honours after a revolt. */
export const SIEGE_REVOLT_HONOUR = 'A revolt earns no Honors. Putting it down is its own reward.';
/**
 * WHAT THE HUD SAYS: `{ bar: [title, banners], works, sides, self: [...], card: { title, line, honour, claim } | null }`
 * (SEAT2b part two (b): `works` the Gatehouse's, the Ram's and the Walls' line, '' for none).
 * `battle` `{ seat, kind, tier, attacker, defender }`; `me` this player's peer id; `watching` a spectator; `honours` the
 * service's answer to the claim (undefined: not yet asked), `claimable` a receipt is kept to claim.
 */
export function siegeHudModel(s, battle, me, now, { watching = false, honours = undefined, claimable = false } = {}) {
  const card = s.end ? {
    title: siegeResultTitle(s.end, battle),
    line: siegeResultLine(s),
    // SEAT2b part two (c): a revolt earns no Honours (net/siege/siegeRef.js honoured) - its claim settles the result alone
    honour: watching ? '' : battle.kind === 'revolt' ? SIEGE_REVOLT_HONOUR : honours === undefined ? (claimable ? 'Your receipt is saved. Claim it for your Honors.' : '') : siegeHonourLine(honours),
    claim: !watching && honours === undefined && claimable,
  } : null;
  return {
    bar: siegeBarLines(s, battle, now),
    works: siegeWorksLine(s),   // SEAT2b part two (b)
    sides: siegeSidesLine(s, battle),
    self: siegeSelfLines(s, me, now, { tier: battle.tier, watching }),
    card,
    // HERALDRY-SHOWN (Seats-Arc 8.1: "drawn on ... the siege HUD"): each side's heraldry where its guild carries one - a
    // revolt's rising town has none
    arms: { defend: heraldryOf(battle.defender?.heraldry), attack: battle.kind === 'revolt' || s.revolt ? null : heraldryOf(battle.attacker?.heraldry) },
  };
}

/**
 * HERALDRY-SHOWN: THE SEAT TAB'S FIGHT, ITS TWO GUILDS DRESSED IN THEIR HERALDRY - the fight's answer names each guild's
 * name and tag alone (server-account/src/seatBattles.js fightOf), and the seat the tab was opened on is dressed in the
 * seats' list's word of it (net/townSeatBook.js dressed: its holder's guild, its battle's two, each with its heraldry);
 * a guild already dressed, or one the seat's dress does not know, is left as it came.
 */
export function fightArmed(fight, seat) {
  if (!fight) return fight;
  const arms = heraldryByTag(seat);
  const dress = (g) => (g && !heraldryOf(g.heraldry) && arms.has(g.tag) ? { ...g, heraldry: arms.get(g.tag) } : g);
  return { ...fight, attackerGuild: dress(fight.attackerGuild), defenderGuild: dress(fight.defenderGuild) };
}
