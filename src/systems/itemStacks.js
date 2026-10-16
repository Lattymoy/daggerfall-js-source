// Identical items share an inventory row, while retaining their individual records.
// Deliberate departure from DFU DaggerfallUnityItem.IsStackable / ItemCollection.FindExistingStack:
// gear and enchanted items can share a row too. Keeping the originals makes wear, repair, enchantment,
// quest references and save data independent; only transfers act on the whole displayed stack.
import { applyTransfer } from './itemTransfer.js';

// Realm IDs and pickup bookkeeping belong to each original, not to the row's gameplay identity.
// A HUD acquisition pass or checkpoint may stamp these while the window is open. Never erase them from items.
const ROW_TRACKING_FIELDS = new Set(['uid', 'acquired', 'untaken']);

// Compare every gameplay field, including mod fields and nested enchantments; ignore only root quantity/tracking.
// Unsupported live objects are kept separate. Sorting object keys makes property insertion order irrelevant.
function storedValue(value, seen, root = false) {
  if (value === null) return null;
  const type = typeof value;
  if (type === 'undefined') return ['undefined'];
  if (type === 'string' || type === 'boolean') return [type, value];
  if (type === 'number' && Number.isFinite(value)) return [type, Object.is(value, -0) ? '-0' : value];
  if (type !== 'object' || seen.has(value) || Object.getOwnPropertySymbols(value).length) throw new Error('live value');
  seen.add(value);
  let out;
  if (Array.isArray(value)) out = ['array', Array.from(value, (v) => storedValue(v, seen))];
  else {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Error('live object');
    const fields = Object.getOwnPropertyDescriptors(value);
    out = ['object', Object.keys(fields).filter((k) => fields[k].enumerable && !(root && (k === 'stackCount' || ROW_TRACKING_FIELDS.has(k)))).sort().map((k) => {
      if (!('value' in fields[k])) throw new Error('live field');
      return [k, storedValue(fields[k].value, seen)];
    })];
  }
  seen.delete(value);
  return out;
}

function stackKey(item) {
  if (!item || typeof item !== 'object' || item.equipSlot != null || item.questItem) return null;
  const count = item.stackCount ?? 1;
  if (!Number.isSafeInteger(count) || count < 1) return null;
  try { return JSON.stringify(storedValue(item, new Set(), true)); } catch { return null; }
}

/** A view over a real collection. Rows and members are ORIGINAL records, never item-shaped copies.
 *  `separate` keeps actively referenced items (the held light) on their own; reward trays disable grouping. */
export function itemStacks(list, { separate = [], enabled = true } = {}) {
  const singles = new Set(separate);
  const byKey = new Map(), byItem = new Map(), items = [];
  for (const item of list ?? []) {
    if (!item) continue;
    const key = enabled && !singles.has(item) ? stackKey(item) : null;
    let stack = key === null ? null : byKey.get(key);
    const count = item.stackCount ?? 1;
    if (!stack || !Number.isSafeInteger(stack.count + count)) {
      stack = { members: [], count: 0 };
      items.push(item);
      if (key !== null) byKey.set(key, stack);
    }
    stack.members.push(item);
    stack.count += count;
    byItem.set(item, stack);
  }
  return {
    items,
    count: (item) => byItem.get(item)?.count ?? (item?.stackCount ?? 1),
    members: (item) => byItem.get(item)?.members ?? [],
  };
}

/** A quantity for the existing capacity/quest ladder to PLAN with. Never put this copy into a collection. */
export function stackTransferItem(list, item, options) {
  const view = itemStacks(list, options);
  return view.count(item) === (item.stackCount ?? 1) ? item : { ...item, stackCount: view.count(item) };
}

/** Transfer a displayed quantity through the existing transfer door, retaining each original item's state.
 *  Resolve again at execution: a stale row or a deferred quantity popup cannot recreate a removed item. */
export function applyItemStackTransfer(item, plan, from, to, options = {}, viewOptions) {
  if (from === to || !from.includes(item) || !Number.isSafeInteger(plan.amount) || plan.amount < 1) return null;
  const members = itemStacks(from, viewOptions).members(item);
  let left = plan.amount, first = null;
  for (const member of members) {
    if (left <= 0) break;
    const amount = Math.min(left, member.stackCount ?? 1);
    const landed = applyTransfer(member, { ...plan, amount }, from, to, options);
    first ??= landed;
    left -= amount;
  }
  return first;
}
