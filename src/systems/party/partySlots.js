// The relay's seat order is shared by every party member; includes self and offline seats.
export const PARTY_SLOT_COLORS=Object.freeze(['#9ce66b','#ffad55','#6ea8ff','#f38ad4','#61e3e6','#ffe47a','#ff7373','#bba0ff']);
export function partySlotStyle(party,acct){
  const index=Array.isArray(party?.members)?party.members.findIndex(m=>m.acct===acct):-1;
  return index>=0&&index<8?{slot:index+1,color:PARTY_SLOT_COLORS[index]}:null;
}

// Keep up to eight compact edge indicators separate without changing their bearing.
export function layoutPartyEdgeMarkers(rows,rect){
  const result=rows.map(r=>r.edge?{...r}:r),groups=new Map();
  for(const row of result){
    if(!row.edge)continue;
    const dx=(row.x-rect.left-rect.width/2)/rect.width,dy=(row.y-rect.top-rect.height/2)/rect.height;
    const side=Math.abs(dx)>=Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'top':'bottom');
    if(!groups.has(side))groups.set(side,[]);
      groups.get(side).push(row);
  }
  for(const [side,group]of groups){
    const axis=side==='left'||side==='right'?'y':'x',start=axis==='y'?rect.top:rect.left,size=axis==='y'?rect.height:rect.width;
    const pad=Math.min(40,size/4),lo=start+pad,hi=start+size-pad,gap=Math.min(32,(hi-lo)/Math.max(1,group.length-1));
    group.sort((a,b)=>a[axis]-b[axis]||(a.slot??9)-(b.slot??9));
    for(let i=0;i<group.length;i++)group[i][axis]=Math.max(lo,Math.min(hi,group[i][axis]),i?group[i-1][axis]+gap:lo);
    for(let i=group.length-1;i>=0;i--)group[i][axis]=Math.min(group[i][axis],i===group.length-1?hi:group[i+1][axis]-gap);
  }
  return result;
}
