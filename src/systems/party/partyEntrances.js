// Resolve destinations from the party feed against real, loaded exterior doors.
// Multiple doors into one destination are all valid entrances; never guess from a town centre.
export function partyEntranceMembers({ others = [], doors = [], hidden = () => false } = {}) {
  const marks = new Map();
  for (const member of others) {
    const p = member.p;
    if (!member.acct || member.online === false || !p || ![1, 2].includes(p.in) || member.peers?.some(hidden)) continue;
    for (const d of doors) {
      if (d.px !== p.px || d.py !== p.py || d.inside !== p.in) continue;
      if (p.in === 2 ? !Number.isInteger(p.bk) || d.buildingKey !== p.bk : !p.loc || d.location !== p.loc) continue;
      if (!d.at?.every(Number.isFinite) || d.at.length !== 3) continue;
      let mark = marks.get(d.key);
      if (!mark) {
        mark = { acct: `entrance:${d.key}`, at: [...d.at], rise: Number.isFinite(d.rise) ? d.rise : 1.6, exact: true, entrance: true, names: [],memberAccts:[],
          place: d.inside === 1 ? `Dungeon entrance · ${d.location}` : `Entrance${p.loc ? ` · ${p.loc}` : ''}` };
        marks.set(d.key, mark);
      }
      mark.names.push(member.name || 'Party member');
      mark.memberAccts.push(member.acct);
    }
  }
  return [...marks.values()].map(({ names, ...m }) => ({ ...m, playerName: names.join(', '), name: `${names.join(', ')} · Entrance` }));
}
