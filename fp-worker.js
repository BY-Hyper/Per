// fp-worker.js — lightweight worker for background tasks
self.onmessage = function(e){
  const {id,cmd,payload} = e.data || {};
  try{
    if(cmd==='heavyCompute'){
      // example heavy compute: sum of 1..N with progress
      const N = payload?.N || 100000000;
      let sum = 0;
      const step = Math.max(1, Math.floor(N/50));
      for(let i=1;i<=N;i++){
        sum += i;
        if(i % step === 0) self.postMessage({id,type:'progress',progress:Math.round(i/N*100)});
      }
      self.postMessage({id,type:'done',result:{sum}});
    } else {
      self.postMessage({id,type:'error',error:'unknown-cmd'});
    }
  }catch(err){self.postMessage({id,type:'error',error:String(err)});}  
};
