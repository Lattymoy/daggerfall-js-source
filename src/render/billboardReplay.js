// Only requested character
// batches are recorded; lanterns must never supply another sprite's drawing basis.
const KEY=Symbol.for('keta.partyBillboardReplay.v1');
export function createBillboardReplay(renderer) {
  let state=renderer[KEY];
  if(!state){
    const original=renderer.drawBillboards, records=new WeakMap();
    state={original,records,users:0,active:0,tracked:false,replaying:0};
    state.wrapper=function(batches,right,up){
      if(state.active&&state.tracked&&!state.replaying){
        for(const batch of batches){
          const record=records.get(batch);if(!record)continue;
          record.valid=false;
          if(!right||!up||!this._view||!this._proj)continue;
          for(let i=0;i<3;i++){record.right[i]=right[i];record.up[i]=up[i];}
          for(let i=0;i<16;i++){record.view[i]=this._view[i];record.proj[i]=this._proj[i];}
          record.valid=true;
        }
      }
      return original.call(this,batches,right,up);
    };
    renderer.drawBillboards=state.wrapper;renderer[KEY]=state;
  }
  state.users++;let enabled=false,disposed=false;
  const setEnabled=value=>{value=!!value;if(disposed||value===enabled)return;enabled=value;state.active+=value?1:-1;};
  const track=batch=>{
    if(disposed||!batch)return null;
    let record=state.records.get(batch);
    if(!record){record={right:new Float32Array(3),up:new Float32Array(3),savedRight:new Float32Array(3),savedUp:new Float32Array(3),view:new Float64Array(16),proj:new Float64Array(16),valid:false,list:[batch]};state.records.set(batch,record);state.tracked=true;}
    return record;
  };
  return {
    setEnabled,track,
    basis(batch){
      if(disposed||!enabled)return null;
      const record=track(batch);if(!record?.valid||!renderer._view||!renderer._proj)return null;
      for(let i=0;i<16;i++)if(record.view[i]!==renderer._view[i]||record.proj[i]!==renderer._proj[i])return null;
      return record;
    },
    draw(batch){
      if(disposed||!enabled)return false;
      const record=track(batch);if(!record?.valid||!renderer._view||!renderer._proj)return false;
      // A newly seen/culled sprite waits for its real pass instead of guessing.
      for(let i=0;i<16;i++)if(record.view[i]!==renderer._view[i]||record.proj[i]!==renderer._proj[i])return false;
      const right=renderer._bbRight,up=renderer._bbUp;
      if(right)record.savedRight.set(right);if(up)record.savedUp.set(up);
      state.replaying++;
      try{renderer.drawBillboards(record.list,record.right,record.up);return true;}
      finally{state.replaying--;for(let i=0;i<3;i++){if(right)right[i]=record.savedRight[i];if(up)up[i]=record.savedUp[i];}}
    },
    dispose(){
      if(disposed)return;setEnabled(false);disposed=true;
      if(--state.users===0&&renderer.drawBillboards===state.wrapper){renderer.drawBillboards=state.original;delete renderer[KEY];}
    },
  };
}
