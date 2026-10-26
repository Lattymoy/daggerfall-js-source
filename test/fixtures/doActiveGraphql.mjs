// COST-0: a Cloudflare GraphQL endpoint for test/server/doactive.test.js - a schema in the shape the real one's
// introspection answers (types wrapped in LIST and NON_NULL, the dataset's group, its parts, its filter and its orders),
// the account's settings, and a day of objects: the hub's bus and a shard awake all day, a cell two hours, a gate an
// hour - more than a page of `maxPageSize` holds, so the page is cut. Every question it is asked is kept (`asked`).

const obj = (name) => ({ kind: 'OBJECT', name, ofType: null });
const list = (t) => ({ kind: 'LIST', name: null, ofType: { kind: 'NON_NULL', name: null, ofType: t } });
const field = (name, type, args = []) => ({ name, type, args });
const fields = (...ns) => ns.map((n) => field(n, { kind: 'SCALAR', name: 'uint64', ofType: null }));

export const NS_ROOM = 'a1'.repeat(16);
export const NS_GATE = 'b2'.repeat(16);
const HOUR = 3_600;

/** A fake fetch, and the questions it was asked. `unit` the seconds of one activeTime unit; `drop` a part's field the
 *  schema leaves out (`sum.activeTime`, say); `pageSize` the settings' maxPageSize. */
export function fakeCloudflare({ unit = 1e-6, drop = null, pageSize = 3, maxDuration = 259_200, notOlderThan = 2_678_400, refuse = 0, errors = null } = {}) {
  const keep = (part, names) => names.filter((n) => `${part}.${n}` !== drop);
  const types = {
    Query: { name: 'Query', kind: 'OBJECT', fields: [field('viewer', obj('viewer'))] },
    viewer: { name: 'viewer', kind: 'OBJECT', fields: [field('accounts', list(obj('account')), [{ name: 'filter', type: obj('AccountFilter_InputObject') }])] },
    account: { name: 'account', kind: 'OBJECT', fields: [
      field('durableObjectsPeriodicGroups', list(obj('AccountDurableObjectsPeriodicGroups')), [
        { name: 'filter', type: { kind: 'NON_NULL', name: null, ofType: { kind: 'INPUT_OBJECT', name: 'AccountDurableObjectsPeriodicGroupsFilter_InputObject' } } },
        { name: 'orderBy', type: list({ kind: 'ENUM', name: 'AccountDurableObjectsPeriodicGroupsOrderBy' }) },
        { name: 'limit', type: { kind: 'NON_NULL', name: null, ofType: { kind: 'SCALAR', name: 'uint64' } } },
      ]),
      field('settings', obj('AccountSettings')),
    ] },
    AccountDurableObjectsPeriodicGroups: { name: 'AccountDurableObjectsPeriodicGroups', kind: 'OBJECT', fields: [
      field('count', { kind: 'NON_NULL', name: null, ofType: { kind: 'SCALAR', name: 'uint64' } }),
      field('dimensions', obj('AccountDurableObjectsPeriodicGroupsDimensions')),
      field('sum', obj('AccountDurableObjectsPeriodicGroupsSum')),
      field('max', obj('AccountDurableObjectsPeriodicGroupsMax')),
    ] },
    AccountDurableObjectsPeriodicGroupsDimensions: { kind: 'OBJECT', fields: fields(...keep('dimensions', ['date', 'datetimeHour', 'namespaceId', 'objectId'])) },
    AccountDurableObjectsPeriodicGroupsSum: { kind: 'OBJECT', fields: fields(...keep('sum', ['activeTime', 'cpuTime', 'inboundWebsocketMsgCount'])) },
    AccountDurableObjectsPeriodicGroupsMax: { kind: 'OBJECT', fields: fields('activeWebsocketConnections') },
    AccountDurableObjectsPeriodicGroupsFilter_InputObject: { kind: 'INPUT_OBJECT', inputFields: ['date', 'date_geq', 'date_leq', 'datetime_geq', 'datetime_lt', 'namespaceId', 'objectId'].map((name) => ({ name })) },
    AccountDurableObjectsPeriodicGroupsOrderBy: { kind: 'ENUM', enumValues: ['date_ASC', 'sum_activeTime_ASC', 'sum_activeTime_DESC'].map((name) => ({ name })) },
    AccountSettings: { kind: 'OBJECT', fields: [field('durableObjectsPeriodicGroups', obj('SettingsNode'))] },
    SettingsNode: { kind: 'OBJECT', fields: fields('enabled', 'maxDuration', 'maxNumberOfFields', 'maxPageSize', 'notOlderThan', 'availableFields') },
  };
  const t = (s) => Math.round(s / unit);
  // a day: the hub's bus and a region bus all day, a cell two hours, a gate's door an hour - the page cut at pageSize
  const objects = [
    { dimensions: { objectId: 'bus'.padEnd(64, '0'), namespaceId: NS_ROOM }, sum: { activeTime: t(23.9 * HOUR) } },
    { dimensions: { objectId: 'shard'.padEnd(64, '0'), namespaceId: NS_ROOM }, sum: { activeTime: t(23 * HOUR) } },
    { dimensions: { objectId: 'cell'.padEnd(64, '0'), namespaceId: NS_ROOM }, sum: { activeTime: t(2 * HOUR) } },
    { dimensions: { objectId: 'gate'.padEnd(64, '0'), namespaceId: NS_GATE }, sum: { activeTime: t(1 * HOUR) } },
  ];
  // the day's totals carry the objects past the page too: Room 72 hours (3 object-days), AdmitGate 1
  const totals = [{ dimensions: { namespaceId: NS_ROOM }, sum: { activeTime: t(72 * HOUR) } }, { dimensions: { namespaceId: NS_GATE }, sum: { activeTime: t(1 * HOUR) } }];
  const asked = [];
  const answer = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const fetch = async (url, init = {}) => {
    if (String(url).includes('/workers/durable_objects/namespaces')) {
      asked.push(`REST ${url}`);
      return answer(200, { success: true, result: [{ id: NS_ROOM, name: 'daggerfall-relay_Room', class: 'Room', script: 'daggerfall-relay' }, { id: NS_GATE, class: 'AdmitGate', script: 'daggerfall-relay' }] });
    }
    if (url !== 'https://api.cloudflare.com/client/v4/graphql' || init.method !== 'POST') throw new Error(`not the GraphQL endpoint: ${init.method} ${url}`);
    if (!/^Bearer \S+$/.test(init.headers?.authorization ?? '')) throw new Error('no token');
    const { query } = JSON.parse(init.body);
    asked.push(query);
    if (refuse) return answer(refuse, { errors: [{ message: 'Authentication error' }] });
    if (errors && errors.test(query)) return answer(200, { data: null, errors: [{ message: 'unknown field' }] });
    if (query.includes('__schema')) return answer(200, { data: { __schema: { queryType: { name: 'Query' } } } });
    const ty = /__type\(name: "([^"]+)"\)/.exec(query);
    if (ty) return answer(200, { data: { __type: types[ty[1]] ? { name: ty[1], ...types[ty[1]] } : null } });
    if (query.includes('settings')) return answer(200, { data: { viewer: { accounts: [{ settings: { durableObjectsPeriodicGroups: { enabled: true, maxDuration, maxNumberOfFields: 30, maxPageSize: pageSize, notOlderThan } } }] } } });
    const limit = Number(/limit: (\d+)/.exec(query)?.[1] ?? 0);
    const rows = query.includes('objectId') ? objects.slice(0, limit) : totals;
    return answer(200, { data: { viewer: { accounts: [{ g: rows }] } } });
  };
  return { fetch, asked };
}
