const db=new Promise((resolve,reject)=>{
  const path=new URL('../',import.meta.url).pathname;
  const request=indexedDB.open('ruidolab:'+path,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('data');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});
async function operation(mode,fn){
  const d=await db;
  return new Promise((resolve,reject)=>{
    const t=d.transaction('data',mode);
    const r=fn(t.objectStore('data'));
    t.oncomplete=()=>resolve(r.result);
    t.onabort=t.onerror=()=>reject(t.error??r.error);
  });
}
export const read=key=>operation('readonly',s=>s.get(key));
export const write=(key,val)=>operation('readwrite',s=>s.put(val,key));
export const remove=key=>operation('readwrite',s=>s.delete(key));
