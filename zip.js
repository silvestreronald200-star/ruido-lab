const enc=new TextEncoder(),dec=new TextDecoder();
export const utf8=s=>enc.encode(s);
export const unutf8=b=>dec.decode(b);
const MAX=40*1024*1024, zipSig=0x06054b50;
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);return n>>>0;});
export function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
async function inflate(bytes,expected){
  if(typeof DecompressionStream==='undefined')throw Error('Usa una versión actual de Chrome, Edge o Firefox para leer la plantilla.');
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const out=new Uint8Array(expected);let p=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;if(p+value.length>expected){await reader.cancel();throw Error('Tamaño ZIP incorrecto.');}out.set(value,p);p+=value.length;}}finally{reader.releaseLock();}
  if(p!==expected)throw Error('Tamaño ZIP incorrecto.');return out;
}
export async function unzip(input){
  const b=input instanceof Uint8Array?input:new Uint8Array(input), v=new DataView(b.buffer,b.byteOffset,b.byteLength);
  if(b.length<22||b.length>MAX)throw Error('Archivo DOCX inválido o demasiado grande.');
  let end=b.length-22;while(end>=Math.max(0,b.length-65557)&&(v.getUint32(end,true)!==zipSig||end+22+v.getUint16(end+20,true)!==b.length))end--;
  if(end<Math.max(0,b.length-65557))throw Error('No se encontró el índice ZIP.');
  if(v.getUint16(end+4,true)||v.getUint16(end+6,true))throw Error('No se admiten ZIP divididos.');
  let at=v.getUint32(end+16,true),total=0;const count=v.getUint16(end+10,true), files=new Map();
  if(count>1000)throw Error('La plantilla contiene demasiadas entradas.');
  for(let i=0;i<count;i++){
    if(at+46>end||v.getUint32(at,true)!==0x02014b50)throw Error('Índice ZIP inválido.');
    const flags=v.getUint16(at+8,true), method=v.getUint16(at+10,true), crc=v.getUint32(at+16,true),cl=v.getUint32(at+20,true),ul=v.getUint32(at+24,true),nl=v.getUint16(at+28,true),xl=v.getUint16(at+30,true),ml=v.getUint16(at+32,true),local=v.getUint32(at+42,true);
    if(flags&1||at+46+nl+xl+ml>end||local+30>b.length||v.getUint32(local,true)!==0x04034b50||![0,8].includes(method)||(total+=ul)>MAX)throw Error('Entrada ZIP inválida.');
    const name=unutf8(b.subarray(at+46,at+46+nl));at+=46+nl+xl+ml;
    if(!name||name.includes('\\')||name.startsWith('/')||name.split('/').includes('..')||files.has(name))throw Error('Ruta ZIP inválida.');
    const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);
    if(start+cl>b.length)throw Error('ZIP truncado.');
    const bytes=method===0?b.slice(start,start+cl):await inflate(b.subarray(start,start+cl),ul);
    if(bytes.length!==ul||crc32(bytes)!==crc)throw Error('La plantilla está dañada.');
    files.set(name,bytes);
  }
  return files;
}
export function zip(files){
  const local=[], central=[];let offset=0,size=0;
  for(const [name,data] of files){
    const n=utf8(name),crc=crc32(data),a=new Uint8Array(30+n.length),c=new Uint8Array(46+n.length),x=new DataView(a.buffer),y=new DataView(c.buffer);
    const x16=(p,v)=>x.setUint16(p,v,true),x32=(p,v)=>x.setUint32(p,v,true),y16=(p,v)=>y.setUint16(p,v,true),y32=(p,v)=>y.setUint32(p,v,true);
    x32(0,0x04034b50);x16(4,20);x16(6,0x800);x16(12,33);x32(14,crc);x32(18,data.length);x32(22,data.length);x16(26,n.length);a.set(n,30);
    y32(0,0x02014b50);y16(4,20);y16(6,20);y16(8,0x800);y16(14,33);y32(16,crc);y32(20,data.length);y32(24,data.length);y16(28,n.length);y32(42,offset);c.set(n,46);
    local.push(a,data);central.push(c);offset+=a.length+data.length;size+=c.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,zipSig,true);e.setUint16(8,files.size,true);e.setUint16(10,files.size,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
