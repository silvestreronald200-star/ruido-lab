import {comparison,csvCell,fmt,leq,localNow,mapCsv,num,parseCsv,sessionKey,uid,validSession,ZONAS} from './core.js';
import {read,write} from './storage.js';
import {exportDocx,reportContent,templateCheck} from './report.js';
import * as V from './view.js';
const main=document.querySelector('#main'),status=document.querySelector('#toast'),net=document.querySelector('#net');
let state={projects:[],active:null},template=null,ui={},mode='',toastTimer,mic=null,offlineReady=false;
const active=()=>state.projects.find(x=>x.id===state.active);
const persist=()=>write('projects',state);
function notify(text,error=false){status.textContent=text;status.hidden=false;status.className='toast'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{status.hidden=true;},5300);}
const get=(f,key)=>String(new FormData(f).get(key)??'').trim();
function values(f){return Object.fromEntries([...new FormData(f)].filter(([,v])=>typeof v==='string').map(([k,v])=>[k,v.trim()]));}
const route=()=>['campo','resultados','articulo'].includes(location.hash.slice(1))?location.hash.slice(1):'inicio';
function render(){
  mode=route();const p=active();
  for(const a of document.querySelectorAll('nav a'))a.hash==='#'+mode?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current');
  if(mode==='campo')main.innerHTML=V.field(p,ui);
  else if(mode==='resultados')main.innerHTML=V.results(p,ui);
  else if(mode==='articulo')main.innerHTML=V.article(p,p&&reportContent(p,p.sessions),template,ui.preview);
  else main.innerHTML=V.home(state,p);
  if(mode==='campo')renderMic();
  if(location.hash==='#nuevo')document.querySelector('#nuevo')?.scrollIntoView();
}
function go(to){if(location.hash==='#'+to)render();else location.hash=to;}
const actButton=code=>main.querySelector('[data-action="'+code+'"]');
function download(data,name,type){const u=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}
const safeName=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'proyecto';
const imgOK=v=>typeof v==='string'&&/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(v);
async function imageData(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('Selecciona una foto JPG, PNG o WebP de hasta 12 MB.');
  const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const c=Object.assign(document.createElement('canvas'),{width:Math.round(bitmap.width*scale),height:Math.round(bitmap.height*scale)});
  c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();return c.toDataURL('image/jpeg',.83);
}
const newProject=q=>({id:uid(),points:[],sessions:[],imports:[],report:{titleEs:q.name},...q});
const idPattern=/^[a-zA-Z0-9-]{1,80}$/;
const txt=v=>typeof v==='string'?v:'';
function parseBackup(json){
  const b=JSON.parse(json);
  if(b?.format!=='ruidolab-1'||!Array.isArray(b.projects))throw Error('El archivo no es un respaldo válido de RuidoLab.');
  const ids=new Set();
  function assert(ok){if(!ok)throw Error('El respaldo contiene datos no válidos. No se modificaron tus proyectos.');}
  return b.projects.map(p=>{
    assert(p&&idPattern.test(p.id)&&!ids.has(p.id)&&txt(p.name).trim()&&Array.isArray(p.points)&&Array.isArray(p.sessions));ids.add(p.id);
    const points=p.points.map(x=>{
      assert(x&&idPattern.test(x.id)&&txt(x.code)&&txt(x.name));
      return {id:x.id,code:x.code,name:x.name,lat:Number.isFinite(x.lat)&&Math.abs(x.lat)<=90?x.lat:null,lon:Number.isFinite(x.lon)&&Math.abs(x.lon)<=180?x.lon:null,zone:Object.hasOwn(ZONAS,x.zone)?x.zone:'pendiente',zoneRef:txt(x.zoneRef)};
    });
    assert(new Set(points.map(x=>x.id)).size===points.length);
    const sessions=p.sessions.map(s=>{
      assert(s&&idPattern.test(s.id)&&points.some(x=>x.id===s.point)&&typeof s.start==='string'&&Number.isFinite(s.level)&&s.seconds>0&&s.seconds<=86400&&['mic','sonometer'].includes(s.source));
      const series=Array.isArray(s.series)?s.series.filter(x=>Number.isFinite(x?.level)&&Number.isFinite(x?.seconds)&&x.seconds>0).slice(0,15000):undefined;
      return {id:s.id,point:s.point,source:s.source,start:s.start,seconds:Number(s.seconds),level:s.level,origin:txt(s.origin),equipment:txt(s.equipment),calibration:txt(s.calibration),verified:s.verified===true,weather:txt(s.weather),noise:txt(s.noise),notes:txt(s.notes),photo:imgOK(s.photo)?s.photo:null,series};
    });
    assert(new Set(sessions.map(x=>x.id)).size===sessions.length);
    const imports=Array.isArray(p.imports)?p.imports.filter(i=>i&&idPattern.test(i.id)&&typeof i.name==='string'&&typeof i.text==='string').map(i=>({id:i.id,name:i.name,text:i.text})):[]; 
    const report=Object.fromEntries(Object.entries(p.report??{}).filter(([k,v])=>/^[a-zA-Z]+$/.test(k)&&['string','boolean'].includes(typeof v)));
    return {id:p.id,name:p.name,location:txt(p.location),institution:txt(p.institution),authors:txt(p.authors),submitted:txt(p.submitted),demo:p.demo===true,points,sessions,imports,report};
  });
}
function demo(){
  const p=newProject({name:'Evaluación del ruido vehicular en Tacna',location:'Tacna, Perú · recorrido de demostración',authors:'Equipo de demostración',submitted:'2026-11-18',demo:true});
  p.points=[{id:uid(),code:'P01',name:'Avenida Bolognesi · punto de ejemplo',lat:-18.0129,lon:-70.2508,zone:'comercial',zoneRef:'Zonificación simulada para el ejemplo'},{id:uid(),code:'P02',name:'Parque · punto de ejemplo',lat:-18.0084,lon:-70.2441,zone:'residencial',zoneRef:'Zonificación simulada para el ejemplo'}];
  p.sessions=[{point:p.points[0].id,level:69.4,start:'2026-11-12T09:00:00'},{point:p.points[1].id,level:56.7,start:'2026-11-12T10:00:00'},{point:p.points[0].id,level:71.8,start:'2026-11-12T17:00:00'}].map(s=>({...s,id:uid(),seconds:300,equipment:'Equipo simulado',calibration:'Registro simulado',verified:true,source:'sonometer',origin:'Demo'}));
  p.report={titleEs:p.name,titleEn:'Assessment of road traffic noise in Tacna',summary:'Se ensayó un flujo de monitoreo con tres sesiones simuladas. Se compararon los niveles por punto y se generó un documento de demostración. Los datos no permiten conclusiones reales sobre Tacna.',abstract:'A monitoring workflow was demonstrated with three simulated sessions. Levels were compared by sampling point. The data do not support conclusions about actual noise in Tacna.',keysEs:'ruido ambiental, tránsito vehicular',keysEn:'environmental noise, road traffic',intro:'Este proyecto de demostración ilustra un registro de ruido ambiental en un recorrido urbano.',objective:'Demostrar el flujo de registro y análisis de ruido.',objectives:'Registrar sesiones simuladas de monitoreo.\nMostrar diferencias entre puntos de demostración.',methods:'Se utilizaron tres sesiones sintéticas y dos ubicaciones ilustrativas. No se realizó una campaña de campo real.',discussion:'Las sesiones sintéticas muestran cómo visualizar diferencias entre puntos y reconocer excedencias solo en el periodo representado.',conclusions:'La demostración valida el flujo del software, no las condiciones acústicas de los lugares representados.'};
  return p;
}
async function saveArticle(p,f){if(!f)return;const q=values(f);q.includePhotos=f.elements.includePhotos.checked;p.report=q;await persist();}
async function submit(e){
  e.preventDefault();const f=e.target,q=values(f),p=active();
  if(f.id==='project'){
    if(!q.name)throw Error('Escribe un nombre para el proyecto.');
    stopMic();mic=null;
    const x=newProject(q);state.projects.push(x);state.active=x.id;ui={};await persist();go('inicio');notify('Proyecto creado. Ya puedes agregar puntos.');return;
  }
  if(!p)return;
  if(f.id==='edit-project'){
    if(!q.name)throw Error('Escribe un nombre para el proyecto.');
    Object.assign(p,q);await persist();render();notify('Datos del proyecto guardados.');
  }
  if(f.id==='point'){
    if(!q.code||!q.name)throw Error('Escribe el código y el nombre del punto.');
    if(p.points.some(x=>x.id!==q.id&&x.code.toLowerCase()===q.code.toLowerCase()))throw Error('Ese código ya existe en el proyecto.');
    const lat=num(q.lat),lon=num(q.lon);
    if((q.lat||q.lon)&&(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180))throw Error('Ingresa la latitud y la longitud válidas, o deja ambas vacías.');
    const x={...q,id:q.id||uid(),lat:Number.isFinite(lat)?lat:null,lon:Number.isFinite(lon)?lon:null};
    if(q.id)p.points=p.points.map(y=>y.id===q.id?x:y);else p.points.push(x);
    ui.point=null;await persist();render();notify('Punto guardado.');
  }
  if(f.id==='session'){
    const old=p.sessions.find(x=>x.id===q.id),s={...q,id:q.id||uid(),seconds:num(q.seconds),level:num(q.level),source:'sonometer',verified:f.elements.verified.checked,origin:old?.origin||'Ingreso manual',photo:old?.photo??null};
    delete s.removePhoto;
    if(!p.points.some(x=>x.id===s.point)||!validSession(s))throw Error('Verifica fecha, duración y nivel en dB(A).');
    if(p.sessions.some(x=>x.id!==s.id&&sessionKey(s)===sessionKey(x)))throw Error('Esta sesión ya está registrada.');
    if(f.elements.removePhoto?.checked)s.photo=null;
    if(f.elements.photo.files.length)s.photo=await imageData(f.elements.photo.files[0]);
    if(old)p.sessions=p.sessions.map(x=>x.id===s.id?s:x);else p.sessions.push(s);
    ui.session=null;await persist();render();notify('Sesión guardada.');
  }
  if(f.id==='import'){
    if(!ui.csv)return;
    if(q.level===''||q.seconds===''||(q.mode==='sessions'&&q.start===''))throw Error('Asigna las columnas obligatorias antes de importar.');
    const {rows,problems}=mapCsv(ui.csv,q,{mode:q.mode,point:q.fallback,points:p.points,start:q.startSeries,equipment:q.equipment,calibration:q.calibration,verified:f.elements.verified.checked,writeable:p.sessions});
    if(rows.length){
      const id=uid();p.sessions.push(...rows.map(x=>({...x,id:uid(),importId:id})));
      (p.imports??=[]).push({id,name:ui.csv.name,text:ui.csv.text});
      ui.csv=null;await persist();render();
    }
    const result=document.querySelector('#csv-result');result.textContent=rows.length+' sesión(es) importadas. '+(problems.length?problems.length+' incidencia(s).':'');
    if(problems.length){
      const ul=document.createElement('ul');for(const x of problems.slice(0,20)){const li=document.createElement('li');li.textContent=x;ul.append(li);}result.append(ul);
    }
    notify(rows.length?'Importación terminada.':'No se importaron sesiones. Revisa los avisos.',!rows.length);
  }
  if(f.id==='article'){await saveArticle(p,f);render();notify('Artículo guardado.');}
}
async function change(e){
  const x=e.target;
  if(x.closest('#filters')||x.id==='plot-session'){ui[x.name]=x.value;render();const target=main.querySelector('[name="'+x.name+'"]');target?.focus();return;}
  const file=x.files?.[0];if(!file)return;
  if(x.id==='csv'){
    if(file.size>5*1024*1024)throw Error('El archivo CSV supera 5 MB.');
    const text=await file.text();ui.csv={...parseCsv(text),name:file.name,text};render();
  }
  if(x.id==='template'){
    if(file.size>15*1024*1024)throw Error('La plantilla supera 15 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer());await templateCheck(bytes);
    template={name:file.name,bytes};await write('template',template);await saveArticle(active(),main.querySelector('#article'));render();notify('Plantilla institucional cargada.');
  }
  if(x.id==='restore'){
    if(file.size>60*1024*1024)throw Error('El respaldo supera 60 MB.');
    const incoming=parseBackup(await file.text());
    if(!confirm('¿Restaurar '+incoming.length+' proyecto(s)? Los proyectos con el mismo identificador se actualizarán.')){x.value='';return;}
    const list=new Map(state.projects.map(p=>[p.id,p]));for(const p of incoming)list.set(p.id,p);
    state.projects=[...list.values()];state.active=incoming[0]?.id??state.active;ui={};await persist();render();notify('Respaldo restaurado.');
  }
}
async function action(button){
  const key=button.dataset.action,id=button.dataset.id,p=active();
  if(key==='open'||key==='demo'){
    stopMic();mic=null;
    if(key==='open')state.active=id;
    else{const d=state.projects.find(p=>p.demo)||demo();if(!state.projects.includes(d))state.projects.push(d);state.active=d.id;}
    ui={};await persist();render();return;
  }
  if(key==='backup'){download(JSON.stringify({format:'ruidolab-1',projects:state.projects}),'RuidoLab-respaldo.json','application/json');return;}
  if(!p)return;
  if(key==='delete-project'&&confirm('¿Eliminar este proyecto y sus registros del navegador?')){stopMic();mic=null;state.projects=state.projects.filter(x=>x.id!==p.id);state.active=state.projects[0]?.id??null;ui={};await persist();render();}
  if(key==='gps'){
    if(!navigator.geolocation)throw Error('La ubicación no está disponible. Ingresa las coordenadas manualmente.');
    const coordinates=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(x=>resolve(x.coords),()=>reject(Error('No se obtuvo la ubicación. Revisa los permisos o ingrésala manualmente.')),{timeout:12000,maximumAge:30000}));
    const f=main.querySelector('#point');if(f){f.elements.lat.value=coordinates.latitude.toFixed(6);f.elements.lon.value=coordinates.longitude.toFixed(6);}
  }
  if(key==='edit-point'||key==='cancel-point'){ui.point=key==='edit-point'?id:null;render();main.querySelector('#point [name="code"]')?.focus();}
  if(key==='delete-point'){
    if(p.sessions.some(s=>s.point===id))throw Error('El punto tiene sesiones asociadas. Quita las sesiones antes de eliminarlo.');
    if(confirm('¿Quitar este punto?')){p.points=p.points.filter(x=>x.id!==id);ui.point=null;await persist();render();}
  }
  if(key==='edit-session'||key==='cancel-session'){ui.session=key==='edit-session'?id:null;go('campo');setTimeout(()=>main.querySelector('#session [name="start"]')?.focus(),50);}
  if(key==='delete-session'&&confirm('¿Quitar esta sesión y sus evidencias?')){p.sessions=p.sessions.filter(x=>x.id!==id);await persist();render();}
  if(key==='photo'){
    const photo=p.sessions.find(x=>x.id===id)?.photo,view=main.querySelector('#photo-view');if(imgOK(photo)&&view){const im=new Image();im.src=photo;im.alt='Fotografía de evidencia';im.className='preview-photo';view.replaceChildren(im);view.scrollIntoView({block:'nearest'});}
  }
  if(key==='original'){const f=p.imports?.find(x=>x.id===id);if(f)download(f.text,f.name,'text/csv;charset=utf-8');}
  if(key==='export-csv'){
    const out=[['Punto','Zona','Inicio local','Franja','Duración (s)','Indicador','Nivel','ECA dB(A)','Diferencia dB','Comparación','Fuente de datos','Tipo de proyecto']];
    for(const s of V.filtered(p,ui)){const x=p.points.find(y=>y.id===s.point),c=comparison(x,s);out.push([x?.code,ZONAS[x?.zone],s.start,c.period,s.seconds,s.source==='mic'?'dBFS':'LAeq,T (dB(A))',s.level,c.limit,c.delta,c.status??'No comparable: '+c.reason,s.origin,p.demo?'DATOS SIMULADOS':'Proyecto real']);}
    download('\uFEFF'+out.map(r=>r.map(csvCell).join(';')).join('\r\n'),safeName(p.name)+'-mediciones.csv','text/csv;charset=utf-8');
  }
  if(key==='preview'||key==='export-docx'){
    await saveArticle(p,main.querySelector('#article'));
    const doc=reportContent(p,p.sessions);
    if(key==='preview'){ui.preview=true;render();main.querySelector('.report-preview')?.scrollIntoView({block:'start'});return;}
    if(!template)throw Error('Carga primero la plantilla institucional.');
    button.disabled=true;button.textContent='Generando Word…';
    try{const content=await exportDocx(template.bytes,doc);download(content,safeName(p.name)+(doc.validation.draft?'-BORRADOR':'')+'.docx');notify('Word editable descargado.');}finally{render();}
  }
  if(key==='mic-start')await startMic();
  if(key==='mic-stop')stopMic();
  if(key==='mic-save'){
    const point=main.querySelector('#mic-point')?.value;
    if(!point||!mic?.series.length||mic.active)throw Error('Selecciona un punto y detén la lectura para guardarla.');
    const seconds=mic.series.reduce((t,s)=>t+s.seconds,0),level=leq(mic.series);
    p.sessions.push({id:uid(),point,start:mic.start,seconds:Math.round(seconds*100)/100,level,source:'mic',origin:'Relativo · micrófono',series:mic.series});mic=null;await persist();render();notify('Lectura relativa guardada por separado.');
  }
}
function renderMic(){
  if(mode!=='campo'||!actButton('mic-start'))return;
  actButton('mic-start').disabled=!!(mic?.active||mic?.pending);
  actButton('mic-stop').disabled=!mic?.active;
  actButton('mic-save').disabled=!!mic?.active||!mic?.series?.length||!main.querySelector('#mic-point');
  const v=mic?.series?.at(-1)?.level;
  main.querySelector('#mic-value').textContent=(Number.isFinite(v)?fmt(v):'—')+' dBFS';
  const tail=mic?.series?.slice(-100)??[];
  main.querySelector('#mic-plot').innerHTML=tail.length?V.plot(tail,{unit:'dBFS',label:'Lecturas recientes en orden',floor:-100}):'';
}
async function startMic(){
  if(mic?.active||mic?.pending)return;
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Para usar el micrófono, abre la app desde HTTPS o localhost.');
  const current=mic={pending:true,active:false,series:[]};renderMic();
  try{
    current.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,autoGainControl:false,noiseSuppression:false},video:false});
    if(mic!==current||route()!=='campo'||!current.pending){current.stream.getTracks().forEach(x=>x.stop());if(mic===current)mic=null;return;}
    current.ctx=new AudioContext();await current.ctx.resume();
    if(mic!==current||!current.pending||route()!=='campo'){current.stream.getTracks().forEach(x=>x.stop());await current.ctx.close().catch(()=>{});return;}
    const analyser=current.ctx.createAnalyser();analyser.fftSize=4096;current.ctx.createMediaStreamSource(current.stream).connect(analyser);
    const sample=new Float32Array(analyser.fftSize);current.start=localNow();current.pending=false;current.active=true;let last=performance.now();
    current.timer=setInterval(()=>{
      if(!current.active)return;
      const now=performance.now(),dt=(now-last)/1000;last=now;
      if(dt>1.5){stopMic();notify('La lectura se detuvo por una interrupción.');return;}
      analyser.getFloatTimeDomainData(sample);let sum=0;for(const x of sample)sum+=x*x;
      current.series.push({level:Math.max(-100,Math.min(0,10*Math.log10(sum/sample.length))),seconds:dt});
      renderMic();if(current.series.length>=3600){stopMic();notify('Se alcanzó el máximo de la sesión orientativa.');}
    },250);
  }catch{
    stopMic();mic=null;renderMic();throw Error('No se pudo acceder al micrófono. Revisa el permiso y el dispositivo, o usa el registro de sonómetro.');
  }finally{renderMic();}
}
function stopMic(){
  if(!mic)return;
  mic.active=false;mic.pending=false;clearInterval(mic.timer);
  mic.stream?.getTracks().forEach(x=>x.stop());mic.ctx?.close().catch(()=>{});
  renderMic();
}
const run=f=>Promise.resolve().then(f).catch(e=>notify(e.message||'La operación no se completó.',true));
main.addEventListener('submit',e=>{e.preventDefault();const b=e.submitter;if(b?.disabled)return;if(b)b.disabled=true;run(()=>submit(e)).finally(()=>{if(b)b.disabled=false;});});
main.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled)run(()=>action(b));});
main.addEventListener('change',e=>run(()=>change(e)));
window.addEventListener('hashchange',()=>{if(route()!=='campo')stopMic();render();if(location.hash!=='#nuevo')window.scrollTo(0,0);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMic();});
const netStatus=()=>{net.textContent=navigator.onLine?(offlineReady?'Disponible sin conexión':'Guardado local'):'Sin conexión';};
window.addEventListener('online',netStatus);window.addEventListener('offline',netStatus);netStatus();
try{
  [state,template]=await Promise.all([read('projects'),read('template')]);
  state??={projects:[],active:null};
  render();
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{offlineReady=true;netStatus();}).catch(()=>{});
  }
}catch(_){main.textContent='No se pudo abrir el almacenamiento local. Usa un navegador actualizado con el almacenamiento habilitado.';}
