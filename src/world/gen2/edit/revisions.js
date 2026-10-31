// @ts-check
// WG2 PUBLISHING (bible/03-World/World-2-Canon.md, "Publishing"): a document's road to the world - draft (its author's
// alone), review (a reviewer and the validators read it), staging (a multiplayer-compatible world tries it) and
// published (a versioned world revision). Each step has its gate: a draft goes to review only clean; review to staging
// only approved by someone else; staging to published only when its staging checks passed and no protected property
// stands in its way (propertyGuard.js). Publication is atomic - every region's new print in one record - and a
// rollback is a new revision that publishes the one before. History is never rewritten.
import { canonicalJson } from '../../../formats/worldData/worldDataJson.js';
import { fnv1a } from '../../../formats/fnv1a.js';

export const REVISION_STATES = Object.freeze(['draft', 'review', 'staging', 'published', 'retired']);
const NEXT = Object.freeze({ draft: 'review', review: 'staging', staging: 'published' });

/** A document's print. @param {any} doc */
export const docPrint = (doc) => fnv1a(new TextEncoder().encode(canonicalJson(doc))).toString(16).padStart(8, '0');

/** A history: its revisions, newest last. @returns {{ revisions: any[] }} */
export const newHistory = () => ({ revisions: [] });

/** Save a draft: a new revision of the document. @param {{ revisions: any[] }} h @param {any} doc @param {{ author: string, note: string, at: string }} who */
export function saveDraft(h, doc, who) {
  const n = h.revisions.length + 1, parent = [...h.revisions].reverse().find((r) => r.state === 'published')?.n ?? 0;
  const rev = Object.freeze({ n, state: 'draft', doc, print: docPrint(doc), parent, author: who.author, note: who.note, at: who.at, log: Object.freeze([]) });
  return { revisions: [...h.revisions, rev] };
}

/**
 * Move a revision a step on, if its gate opens. `checks`: problems (validation's words), approver, staging (passed:
 * bool), property (propertyGuard's conflicts). Answers the new history or the reasons it may not move.
 * @param {{ revisions: any[] }} h @param {number} n @param {{ by: string, at: string, problems?: string[], staged?: boolean, conflicts?: any[] }} step
 */
export function advanceRevision(h, n, step) {
  const rev = h.revisions.find((r) => r.n === n);
  if (!rev) return { refused: ['no such revision'] };
  const to = NEXT[rev.state], why = [];
  if (!to) why.push(`a ${rev.state} revision goes no further`);
  if (rev.state === 'draft' && (step.problems ?? []).length) why.push(...(step.problems ?? []).map((p) => `invalid: ${p}`));
  if (rev.state === 'review' && step.by === rev.author) why.push('a revision is approved by someone other than its author');
  if (rev.state === 'staging' && !step.staged) why.push('its staging checks have not passed');
  if (rev.state === 'staging' && (step.conflicts ?? []).length) why.push(...(step.conflicts ?? []).map((c) => `protected: ${c.why}`));
  if (why.length) return { refused: why };
  const moved = Object.freeze({ ...rev, state: to, log: Object.freeze([...rev.log, { from: rev.state, to, by: step.by, at: step.at }]) });
  const revisions = h.revisions.map((r) => (r.n === n ? moved : to === 'published' && r.state === 'published' ? Object.freeze({ ...r, state: 'retired' }) : r));
  return { history: { revisions } };
}

/** The live published revision, or null. @param {{ revisions: any[] }} h */
export const published = (h) => h.revisions.find((r) => r.state === 'published') ?? null;

/** Roll back: a new revision publishing the document of the one published before the live one - straight to
 *  published, since it was published once. @param {{ revisions: any[] }} h @param {{ by: string, at: string }} who */
export function rollback(h, who) {
  const live = published(h);
  const before = live ? [...h.revisions].reverse().find((r) => r.state === 'retired' && r.n < live.n) : null;
  if (!live || !before) return { refused: ['nothing published before the live revision'] };
  const n = h.revisions.length + 1;
  const rev = Object.freeze({ n, state: 'published', doc: before.doc, print: before.print, parent: live.n, author: who.by, note: `rollback to ${before.n}`, at: who.at, log: Object.freeze([{ from: 'rollback', to: 'published', by: who.by, at: who.at }]) });
  return { history: { revisions: [...h.revisions.map((r) => (r.n === live.n ? Object.freeze({ ...r, state: 'retired' }) : r)), rev] } };
}

/** What changed between two documents: each layer's operations added and removed (by their content). @param {any} a @param {any} b */
export function docDiff(a, b) {
  const out = [];
  const names = new Set([...(a?.layers ?? []).map((l) => l.name), ...(b?.layers ?? []).map((l) => l.name)]);
  for (const name of names) {
    const la = a?.layers.find((l) => l.name === name), lb = b?.layers.find((l) => l.name === name);
    const ka = (la?.ops ?? []).map(canonicalJson), kb = (lb?.ops ?? []).map(canonicalJson);
    const added = kb.filter((k) => !ka.includes(k)).map((k) => JSON.parse(k)), removed = ka.filter((k) => !kb.includes(k)).map((k) => JSON.parse(k));
    if (added.length || removed.length || !la || !lb) out.push({ layer: name, added, removed, layerAdded: !la, layerRemoved: !lb });
  }
  return out;
}
