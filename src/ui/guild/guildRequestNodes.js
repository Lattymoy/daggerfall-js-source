// @ts-check
// GUILD-REQUESTS (2026-10-30, the owner: "Player guild join requests"; bible/11-Multiplayer/Guild-Shop.md section 14):
// A CHARACTER IN NO GUILD ASKS ONE TO TAKE IT IN, by the guild's tag; a rank that may invite answers on the Members page.
// The service holds every rule (server-account/src/guilds.js requestToJoin, answerJoinRequest). Drawn through the
// window's own kit (ui/socialPanel.js).
import { GUILD_REQUESTS_MAX, guildMay, guildTagOf } from '../../net/guild/guildLaw.js';
import { t } from '../../systems/textManager.js';

/** How long ago a request was sent: "today", "1 day ago", "3 days ago". */
export const guildAskedText = (/** @type {number} */ atS, /** @type {number} */ nowMs) => {
  const days = Math.max(0, Math.floor((nowMs / 1000 - Number(atS)) / 86_400));
  return days === 0 ? t('guild.requests.today', 'sent today') : t('guild.requests.days', 'sent {n, plural, one {# day} other {# days}} ago', { n: days });
};

/**
 * THE JOIN BODY'S PART: the account's requests standing, each with Withdraw, and the form that sends one. `k` the
 * window's kit (`el`, `btn`, `live`, `field`, `act`, `row`, `rowActs`, `draft`, `now`).
 * @param {any} k @param {any} g the guild book
 */
export function guildAskNodes(k, g) {
  const { el, btn } = k;
  const out = [el('div', 'dfsocial-sec', t('guild.requests.ask', 'Ask to join'))];
  // AUDIT GUILD-RANKS C2: the account's every request - the cap is the account's - this character's first
  const me = g.character?.() ?? null;
  const all = [...(g.requests ?? [])].sort((a, b) => Number(b?.character === me) - Number(a?.character === me));
  for (const q of all) {
    const asked = guildAskedText(q.at, k.now());
    const r = k.row({ name: `${q.name} [${q.tag}]`, sub: q.character === me ? asked : `${asked} - ${t('guild.requests.other', 'another character')}` });
    k.rowActs(r).append(btn(t('guild.requests.withdraw', 'Withdraw'), { enabled: !g.busy, why: 'a moment', run: () => k.act(g.withdrawRequest(q.guild, q.character), t('guild.requests.withdrawn', 'Request withdrawn.')) }));
    out.push(r);
  }
  out.push(el('div', 'dfsocial-note', t('guild.requests.about', 'Type a guild\'s tag. Its officers see your request and answer it.')));
  const d = k.draft;
  const form = el('div', 'dfsocial-form');
  k.field(form, t('guild.requests.tag', 'Guild tag'), d.askTag ?? '', 4, (/** @type {string} */ x) => { d.askTag = x; });
  out.push(form);
  const acts = el('div', 'dfsocial-acts');
  acts.append(k.live(t('guild.requests.send', 'Send request'), () => {
    const why = g.busy ? 'a moment' : !guildTagOf(d.askTag ?? '') ? t('guild.requests.why.tag', 'a tag of 2 to 4 letters or digits')
      : all.length >= GUILD_REQUESTS_MAX ? t('guild.requests.why.max', '{max} requests at most', { max: GUILD_REQUESTS_MAX }) : null;
    return { enabled: !why, why };
  }, { run: () => { const tag = guildTagOf(d.askTag ?? ''); k.act(g.requestJoin(tag), t('guild.requests.sent', 'Request sent to [{tag}].', { tag }), () => { d.askTag = ''; }); } }));   // AUDIT GUILD-RANKS C6: kept on a refusal
  out.push(acts);
  return out;
}

/**
 * THE MEMBERS PAGE'S PART: the requests to join, to a rank that may invite - each with Accept and Decline. Nothing for a
 * rank that may not.
 * @param {any} k @param {any} g the guild book @param {any} v the guild's view @param {number} me the reader's rank
 */
export function guildRequestsNodes(k, g, v, me) {
  if (!guildMay(me, 'invite', v.powers) || !Array.isArray(v.requests)) return [];
  const { el, btn } = k;
  const out = [el('div', 'dfsocial-sec', t('guild.requests.title', 'Requests to join ({n})', { n: v.requests.length }))];
  if (!v.requests.length) { out.push(el('div', 'dfsocial-empty', t('guild.requests.none', 'No requests.'))); return out; }
  const lowest = Array.isArray(v.ranks) ? v.ranks[v.ranks.length - 1] : null;
  for (const q of v.requests) {
    const r = k.row({ name: q.name, sub: guildAskedText(q.at, k.now()) });
    k.rowActs(r).append(
      btn(t('guild.requests.accept', 'Accept'), { enabled: !g.busy, why: 'a moment', run: () => k.act(g.answerRequest(q.id, true), t('guild.requests.accepted', '{name} joined as {rank}.', { name: q.name, rank: lowest ?? '' })) }),
      btn(t('guild.requests.decline', 'Decline'), { enabled: !g.busy, why: 'a moment', run: () => k.act(g.answerRequest(q.id, false), t('guild.requests.declined', 'Request declined.')) }));
    out.push(r);
  }
  return out;
}
