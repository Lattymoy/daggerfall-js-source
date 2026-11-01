import { getPref } from '../systems/uiPrefs.js';
import { partyEntranceMembers } from '../systems/party/partyEntrances.js';
import { buildingDataForDoor } from '../systems/talk/talkTopics.js';
import { DOOR_TYPE } from '../world/meshReader.js';

export function createPartyEntranceHost(host) {
  let generation = -1, entries = [];
  function rows(account = null) {
    if (!getPref('partyVisibility') || host.mode() !== 'exterior' || host.online?.status !== 'open' || !host.social?.party) return [];
    const others = host.social.others().filter((m) => !account || m.acct === account);
    if (!others.some((m) => m.online !== false && m.p?.in)) return [];
    if (generation !== host.generation()) {
      generation = host.generation();
      entries = host.doors.flatMap((e, i) => {
        const type = e.door?.doorType;
        if (type !== DOOR_TYPE.BUILDING && type !== DOOR_TYPE.DUNGEON_ENTRANCE) return [];
        const [px, py] = e.pixelKey.split(',').map(Number);
        const loc = host.locations.get(e.pixelKey), b = host.built.get(e.pixelKey);
        let buildingKey = null;
        if (type === DOOR_TYPE.BUILDING) {
          if (!loc || !b?.locBlocks || !b.locOrigin) return [];
          const m = e.door.matrix;
          buildingKey = buildingDataForDoor(loc.exterior.buildings, b.locBlocks, {
            dfBlock: e.dfBlock, recordIndex: e.recordIndex,
            position: [m[12] - b.locOrigin[0], m[13] - b.locOrigin[1], m[14] - b.locOrigin[2]],
          }, { locationIndex: loc.locationIndex ?? 0 })?.buildingKey ?? null;
        }
        const target = type === DOOR_TYPE.DUNGEON_ENTRANCE ? host.dungeonTarget(e).dfLocation : loc;
        return [{ entry: e, key: `${e.pixelKey}:${i}`, px, py, inside: type === DOOR_TYPE.BUILDING ? 2 : 1, buildingKey, location: target?.name }];
      });
    }
    // Shift each read: floating-origin rebases must move door and marker together.
    const doors = entries.map(({ entry, ...d }) => {
      const { matrix: m, centre: c, size } = host.shift(entry);
      const rise = size ? (Math.abs(m[1] * size.x) + Math.abs(m[5] * size.y) + Math.abs(m[9] * size.z)) / 2 + 0.5 : 1.6;
      return { ...d, rise, at: [m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12],
        m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13],
        m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14]] };
    });
    return partyEntranceMembers({ others, doors, hidden: (id) => host.hidden.has(id) });
  }
  return {
    forMember: (account) => account ? rows(account) : [],
    world: () => getPref('ketaPartyEntrances')!==false ? rows() : [],
    map: () => getPref('ketaPartyEntranceMap')!==false
      ? rows().map((m) => ({ ...m, feet: m.at, yaw: 0 })) : [],
  };
}
