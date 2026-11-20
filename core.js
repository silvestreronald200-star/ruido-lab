export const ECA_URL='https://www.gob.pe/institucion/pcm/normas-legales/3115975-085-2003-pcm';
export const ECA={especial:[50,40],residencial:[60,50],comercial:[70,60],industrial:[80,70]};
export const ZONAS={especial:'Protección especial',residencial:'Residencial',comercial:'Comercial',industrial:'Industrial',pendiente:'Por verificar'};
export const uid=()=>crypto.randomUUID();
export const fmt=n=>Number.isFinite(n)?n.toLocaleString('es-PE',{minimumFractionDigits:1,maximumFractionDigits:1}):'—';
export function num(x){if(typeof x==='string' && x.trim()!=='') return /^[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(x.trim())?Number(x.trim().replace(',','.')):NaN;return typeof x==='number'?x:NaN;}
export function leq(rows){
  if(!rows.length||rows.some(r=>!Number.isFinite(r.level)||!Number.isFinite(r.seconds)||r.seconds<=0))return null;
  const peak=Math.max(...rows.map(r=>r.level)), total=rows.reduce((s,r)=>s+r.seconds,0);
  return peak+10*Math.log10(rows.reduce((s,r)=>s+r.seconds*10**((r.level-peak)/10),0)/total);
}
const DAY=86400000;
export function stamp(local){
  const s=String(local??'');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s))return NaN;
  const canonical=s.length===16?s+':00':s, t=Date.parse(canonical+'Z');
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,19)===canonical?t:NaN;
}
export const localText=t=>new Date(t).toISOString().slice(0,19);
export const localNow=()=>localText(Date.now()-5*3600000);
export function schedule(start,duration){
  const t=stamp(start);if(!Number.isFinite(t)||!Number.isFinite(duration)||duration<=0)return null;
  const base=Math.floor(t/DAY)*DAY, day=base+421*60000, night=base+1321*60000;
  const [type,boundary]=t<day?['Nocturno',day]:t<night?['Diurno',night]:['Nocturno',day+DAY];
  return t+duration*1000<=boundary?type:'Cruza franjas';
}
export function comparison(p,s){
  const period=schedule(s.start,s.seconds);
  if(s.source==='mic')return {period,reason:'Lectura relativa del micrófono'};
  if(!p||!Object.hasOwn(ECA,p.zone)||!p.zoneRef?.trim())return {period,reason:'Zonificación sin verificar'};
  if(!s.verified||!s.equipment?.trim()||!s.calibration?.trim())return {period,reason:'Idoneidad no confirmada'};
  if(!Number.isFinite(s.level))return {period,reason:'Indicador no disponible'};
  if(!period||period==='Cruza franjas')return {period,reason:'Sesión no separada por franja'};
  const limit=ECA[p.zone][period==='Diurno'?0:1],delta=s.level-limit;
  return {period,limit,delta,status:delta>0?'Supera':'No supera'};
}
export function parseCsv(text){
  text=String(text).replace(/^\uFEFF/,'');
  const line=text.split(/\r?\n/,1)[0];const sep=line.includes(';')?';':line.includes('\t')?'\t':',';
  const result=[];let row=[],cell='',quote=false;
  for(let i=0;i<=text.length;i++){
    const c=text[i];
    if(quote){if(c===undefined)throw Error('Hay comillas sin cerrar en el CSV.');if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quote=false;else cell+=c;}
    else if(c==='"'&&cell==='')quote=true;
    else if(c===sep){row.push(cell.trim());cell='';}
    else if(c==='\n'||c==='\r'||c===undefined){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))result.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(result.length<2)throw Error('El CSV necesita encabezados y al menos una fila.');
  if(result.length>15001)throw Error('Importa hasta 15 000 filas por archivo.');
  return {headers:result.shift(),rows:result};
}
export function csvCell(x){
  let s=String(x??'');
  if(typeof x==='string'&&/^[\s]*[=+\-@]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
export function sessionKey(s){return [s.point,stamp(s.start),s.seconds,s.level,s.source].join('|');}
export function validSession(s){return Number.isFinite(stamp(s.start))&&s.seconds>0&&s.seconds<=86400&&Number.isFinite(s.level)&&s.level>=0&&s.level<=180;}
export function mapCsv(csv,m,{mode,point,points,start,equipment,calibration,verified,writeable=[]}){
  const at=(r,k)=>m[k]===''||m[k]==null?'':r[Number(m[k])]??'';
  const problems=[], rows=[], seen=new Set(writeable.map(sessionKey)), series=[];
  let groupStart=stamp(start),lastEnd=groupStart;
  csv.rows.forEach((r,i)=>{
    const level=num(at(r,'level')),seconds=num(at(r,'seconds'));
    if(r.length!==csv.headers.length||!Number.isFinite(level)||level<0||level>180||!Number.isFinite(seconds)||seconds<=0||seconds>86400){problems.push('Fila '+(i+2)+': nivel, duración o columnas inválidos');return;}
    if(mode==='series'){
      const date=at(r,'start'),t=date?stamp(date.replace(' ','T')):lastEnd;
      if(!Number.isFinite(t)||t!==lastEnd){problems.push('Fila '+(i+2)+': secuencia no continua o fecha incorrecta');return;}
      series.push({level,seconds});lastEnd=t+seconds*1000;return;
    }
    const rawPoint=at(r,'point'),p=rawPoint?points.find(x=>x.code.toLowerCase()===rawPoint.toLowerCase())?.id:point;
    const s={point:p,start:at(r,'start').replace(' ','T'),seconds,level,source:'sonometer',origin:'CSV',equipment,calibration,verified};
    if(!p||!validSession(s)){problems.push('Fila '+(i+2)+': punto o fecha incorrectos');return;}
    const k=sessionKey(s);if(seen.has(k)){problems.push('Fila '+(i+2)+': duplicada');return;}seen.add(k);rows.push(s);
  });
  if(mode==='series'&&!problems.length&&series.length){
    const s={point,start,seconds:series.reduce((a,x)=>a+x.seconds,0),level:leq(series),source:'sonometer',origin:'Calculado (CSV)',equipment,calibration,verified,series};
    if(!point||!validSession(s))problems.push('Indica un punto, una fecha local válida y una duración total de hasta 24 horas.');
    else if(seen.has(sessionKey(s)))problems.push('La sesión calculada ya existe.');
    else rows.push(s);
  }
  return {rows,problems};
}
export const words=s=>String(s??'').trim().split(/\s+/).filter(Boolean).length;
export const lines=s=>String(s??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
export function keywords(s,locale){return [...new Set(String(s??'').split(',').map(s=>s.trim().toLocaleLowerCase(locale)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,locale));}
export function reportStatus(p,ss){
  const r=p.report??{}, references=lines(r.refs);
  const missing=[];
  for(const [k,label] of Object.entries({titleEs:'título en español',titleEn:'título en inglés',summary:'resumen',abstract:'abstract',keysEs:'palabras clave',keysEn:'keywords',intro:'introducción',objective:'objetivo general',methods:'metodología',discussion:'discusión',conclusions:'conclusiones',refs:'referencias'}))if(!String(r[k]??'').trim())missing.push(label);
  if(!lines(p.authors).length)missing.push('autores');if(!p.submitted)missing.push('fecha de envío');
  if(!ss.some(s=>s.source==='sonometer'))missing.push('mediciones de sonómetro');
  if(lines(r.objectives).length<2||lines(r.objectives).length>3)missing.push('entre 2 y 3 objetivos específicos');
  if(words(r.titleEs)>25||words(r.titleEn)>25||/[.!?]$/.test(r.titleEs?.trim()||'')||/[.!?]$/.test(r.titleEn?.trim()||''))missing.push('ajustar títulos a 25 palabras sin punto final');
  if(words(r.summary)>250||words(r.abstract)>250)missing.push('ajustar resumen y abstract a 250 palabras');
  if(keywords(r.keysEs,'es').length>5||keywords(r.keysEn,'en').length>5)missing.push('hasta 5 palabras clave por idioma');
  const journal=num(r.journalCount);if(!(journal>=10&&journal<=references.length&&Number.isInteger(journal)))missing.push('confirmar 10 artículos científicos en las referencias');
  const year=Number(p.submitted?.slice(0,4))||new Date().getFullYear();
  const recent=references.filter(x=>{const y=Number(x.match(/\((\d{4})[a-z]?\)/i)?.[1]);return y>=year-5&&y<=year;}).length;
  return {missing,recent,references:references.length,draft:!!missing.length};
}
