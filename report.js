import {comparison,fmt,keywords,lines,reportStatus} from './core.js';
import {unzip,zip,unutf8,utf8} from './zip.js';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const P='http://schemas.openxmlformats.org/package/2006/relationships';
const S={titleEs:'JIAM01Tituloenespaol',titleEn:'JIAM02Tituloeningles',author:'JIAM03NombreAutores',smallHead:'JIAM04TituloResumenAbstract',abstract:'JIAM05ParrafoResumenAbstract',text:'JIAM09Parrafo1ernivel',heading:'Ttulo1',bullet:'JIAM11Bullets',number:'JIAM12Correlativotablafigura',caption:'JIAM13Titulotablafigura',cell:'JIAM14Cuerpodetabla',note:'JIAM15Notadetablafigura',refs:'JIAM16Referencias'};
const stringify=x=>String(x??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'');
const esc=x=>stringify(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const parse=(file,path)=>{
  if(!file.has(path))throw Error('No se encontró '+path+' en el archivo Word.');
  const xml=unutf8(file.get(path));if(/<!DOCTYPE/i.test(xml))throw Error('Plantilla XML no admitida.');
  const d=new DOMParser().parseFromString(xml,'application/xml');
  if(d.querySelector('parsererror'))throw Error('No se pudo leer '+path);
  return d;
};
const ser=(m,k,d)=>m.set(k,utf8(new XMLSerializer().serializeToString(d)));
const date=s=>s?.split('-').reverse().join('/')||'';
const h=(text,kind='heading')=>({text,kind});
export function reportContent(project,sessions){
  const r=project.report??{}, validation=reportStatus(project,sessions), list=[];
  const set=(k,v)=>list.push(h(v,k));
  const paragraphs=(x,kind='text')=>lines(x).forEach(t=>set(kind,t));
  const heading=(title,text)=>{set('heading',title);paragraphs(text);};
  const ss=sessions.filter(x=>x.source==='sonometer').sort((a,b)=>a.start.localeCompare(b.start));
  if(project.demo)set('mark','DATOS SIMULADOS — Solo demostración');
  if(validation.draft)set('mark','BORRADOR — Revisar los campos pendientes');
  set('titleEs',r.titleEs||'[Título en español pendiente]');
  set('titleEn',r.titleEn||'[Title in English pending]');
  paragraphs(project.authors,'author');
  set('date','Fecha de envío: '+(date(project.submitted)||'[pendiente]'));
  for(const [label,value,kl,ks,locale] of [['RESUMEN',r.summary,'Palabras clave: ',r.keysEs,'es'],['ABSTRACT',r.abstract,'Keywords: ',r.keysEn,'en']]){
    set('smallHead',label);set('abstract',String(value||'[Pendiente]').replace(/\s+/g,' ').trim());
    list.push({kind:'keys',text:kl,italic:keywords(ks,locale).join(', ')});
  }
  heading('INTRODUCCIÓN',r.intro||'[Pendiente]');
  if(r.objective?.trim())set('text','Objetivo general. '+r.objective.trim());
  paragraphs(r.objectives,'bullet');
  heading('Metodología',r.methods||'[Pendiente]');
  heading('RESULTADOS Y DISCUSIÓN');
  if(ss.length){
    set('text','La Tabla 1 reúne los niveles equivalentes de '+ss.length+' sesiones de sonómetro. La comparación con los ECA para Ruido se presenta únicamente para las sesiones con condiciones verificadas y se limita al periodo medido.');
    set('number','Tabla 1');
    set('caption','Niveles de ruido ambiental por sesión de monitoreo');
    list.push({kind:'table',head:['Punto','Inicio local','Duración (s)','LAeq,T dB(A)','ECA dB(A)','Diferencia (dB)','Comparación'],rows:ss.map(s=>{
      const p=project.points.find(x=>x.id===s.point), c=comparison(p,s);
      return [p?.code??'—',s.start.replace('T',' ').slice(0,16),s.seconds,fmt(s.level),fmt(c.limit),fmt(c.delta),c.status||'No comparable'];
    })});
    set('note','Nota. El valor de referencia corresponde a la zona y franja verificadas. Fuente normativa: D. S. N.° 085-2003-PCM.');
    set('text','La Figura 1 muestra el nivel equivalente registrado por sesión.');
    set('number','Figura 1');
    set('caption','Nivel equivalente de ruido por sesión de sonómetro');
    list.push({kind:'chart',sessions:ss,alt:'Nivel equivalente de ruido ambiental por sesión de sonómetro'});
    let figure=1;
    if(r.includePhotos)for(const s of ss.filter(x=>x.photo).slice(0,4)){
      const p=project.points.find(x=>x.id===s.point);
      set('text','La Figura '+(++figure)+' documenta una sesión de campo.');
      set('number','Figura '+figure);set('caption','Evidencia de campo del punto '+(p?.code||'sin código'));
      list.push({kind:'photo',photo:s.photo,alt:'Evidencia de campo de '+(p?.code||'la sesión')});
      set('note','Nota. Registro de la sesión: '+s.start.replace('T',' ') +(p?.lat!=null?' · '+p.lat+', '+p.lon:'')+'.');
    }
  }else set('text','[No hay mediciones de sonómetro para reportar.]');
  paragraphs(r.discussion||'[Interpretación y discusión pendientes.]');
  heading('CONCLUSIONES');paragraphs(r.conclusions||'[Pendiente]','bullet');
  if(r.recommendations?.trim())heading('RECOMENDACIONES',r.recommendations);
  if(r.thanks?.trim())heading('AGRADECIMIENTOS',r.thanks);
  heading('REFERENCIAS BIBLIOGRÁFICAS');
  const refs=lines(r.refs).sort((a,b)=>a.localeCompare(b,'es'));
  if(!refs.length)set('text','[Referencias pendientes.]');
  for(const ref of refs)set('refs',ref);
  return {list,validation};
}
export async function templateCheck(bytes){
  const files=await unzip(bytes),doc=parse(files,'word/document.xml'),styles=parse(files,'word/styles.xml');
  const ids=new Set([...styles.getElementsByTagNameNS(W,'style')].map(x=>x.getAttributeNS(W,'styleId')));
  if(Object.values(S).some(x=>!ids.has(x))||!doc.getElementsByTagNameNS(W,'sectPr').length)throw Error('Adjunta la plantilla de la Jornada para las categorías I y II. No se reconocieron sus estilos.');
  return files;
}
const run=(text,attrs='')=>'<w:r>'+(attrs?'<w:rPr>'+attrs+'</w:rPr>':'')+'<w:t xml:space="preserve">'+esc(text)+'</w:t></w:r>';
const para=(kind,runs,more='')=>'<w:p><w:pPr>'+(S[kind]?'<w:pStyle w:val="'+S[kind]+'"/>':'')+more+'</w:pPr>'+runs+'</w:p>';
const tableXml=o=>{
  const widths=[900,1730,1240,1250,1150,1320,2030];
  const row=(cols,head)=>'<w:tr><w:trPr><w:cantSplit/>'+(head?'<w:tblHeader/>':'')+'</w:trPr>'+cols.map((v,i)=>'<w:tc><w:tcPr><w:tcW w:w="'+widths[i]+'" w:type="dxa"/>'+(head?'<w:tcBorders><w:bottom w:val="single" w:sz="4" w:color="4F605B"/></w:tcBorders>':'')+'</w:tcPr>'+para('cell',run(v,head?'<w:b/>':''),'<w:jc w:val="left"/>')+'</w:tc>').join('')+'</w:tr>';
  return '<w:tbl><w:tblPr><w:tblW w:w="9620" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="4F605B"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="4" w:color="4F605B"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>'+widths.map(v=>'<w:gridCol w:w="'+v+'"/>').join('')+'</w:tblGrid>'+row(o.head,true)+o.rows.map(r=>row(r,false)).join('')+'</w:tbl>';
};
function figureXml(id,width,height,alt){
  const cx=Math.round(Math.min(5760000,width*9525,4600000*width/height)), cy=Math.round(cx*height/width);
  return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+id+'" name="Figura '+id+'" descr="'+esc(alt)+'"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+id+'" name="Figura '+id+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdRuidoLab'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}
function chart(sessions){
  const canvas=Object.assign(document.createElement('canvas'),{width:1000,height:395}),c=canvas.getContext('2d');
  const lo=Math.max(0,Math.floor((Math.min(...sessions.map(x=>x.level))-5)/10)*10),hi=Math.max(lo+10,Math.ceil((Math.max(...sessions.map(x=>x.level))+5)/10)*10);
  const x=i=>105+i*855/Math.max(1,sessions.length-1),y=v=>314-250*(v-lo)/(hi-lo);
  c.fillStyle='#fff';c.fillRect(0,0,1000,395);c.font='22px Arial';c.fillStyle='#17332d';c.fillText('LAeq,T (dB(A))',25,33);
  for(let i=0;i<=5;i++){const v=lo+(hi-lo)*i/5,yy=y(v);c.strokeStyle='#dbe7e3';c.beginPath();c.moveTo(105,yy);c.lineTo(963,yy);c.stroke();c.fillStyle='#405a51';c.fillText(String(Math.round(v)),35,yy+7);}
  c.strokeStyle='#107153';c.lineWidth=3;c.beginPath();sessions.forEach((s,i)=>i?c.lineTo(x(i),y(s.level)):c.moveTo(x(i),y(s.level)));c.stroke();
  if(sessions.length<=120)sessions.forEach((s,i)=>{c.fillStyle='#107153';c.beginPath();c.arc(x(i),y(s.level),4,0,Math.PI*2);c.fill();});
  c.fillStyle='#405a51';c.fillText('Sesión 1',100,355);if(sessions.length>1)c.fillText('Sesión '+sessions.length,840,355);
  return canvas;
}
async function imageOf(item){
  if(item.kind==='chart'){
    const c=chart(item.sessions),blob=await new Promise(r=>c.toBlob(r,'image/png'));
    return {bytes:new Uint8Array(await blob.arrayBuffer()),width:c.width,height:c.height};
  }
  const im=new Image();im.src=item.photo;await im.decode();
  const scale=Math.min(1,1500/Math.max(im.naturalWidth,im.naturalHeight));
  const canvas=Object.assign(document.createElement('canvas'),{width:Math.round(im.naturalWidth*scale),height:Math.round(im.naturalHeight*scale)});
  canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
  return {bytes:new Uint8Array(await blob.arrayBuffer()),width:canvas.width,height:canvas.height};
}
export async function exportDocx(bytes,article){
  const files=await templateCheck(bytes),key='word/document.xml',relKey='word/_rels/document.xml.rels',d=parse(files,key),rels=parse(files,relKey);
  const body=d.getElementsByTagNameNS(W,'body')[0],section=[...body.children].find(x=>x.localName==='sectPr');
  if(!section)throw Error('La plantilla no tiene una sección de página válida.');
  for(const rel of [...rels.documentElement.children]){
    const kind=rel.getAttribute('Type').split('/').at(-1);
    if(['image','hyperlink','hdphoto'].includes(kind))rel.remove();
  }
  for(const [name] of files)if(name.startsWith('word/media/')&&/^word\/media\/(?:image1\.png|image2\.png|image3\.jpeg|image10\.png|hdphoto1\.wdp)$/.test(name)){
    const filename=name.split('/').at(-1);
    const referenced=[...files].some(([path,b])=>path.endsWith('.rels')&&path!==relKey&&unutf8(b).includes('media/'+filename+'"'));
    if(!referenced)files.delete(name);
  }
  let content='',id=0;
  for(const o of article.list){
    if(o.kind==='table'){content+=tableXml(o);continue;}
    if(o.kind==='chart'||o.kind==='photo'){
      const im=await imageOf(o),i=++id,name='ruidolab-'+i+'.png',rel=rels.createElementNS(P,'Relationship');
      rel.setAttribute('Id','rIdRuidoLab'+i);rel.setAttribute('Type',R+'/image');rel.setAttribute('Target','media/'+name);
      rels.documentElement.append(rel);files.set('word/media/'+name,im.bytes);content+=figureXml(i,im.width,im.height,o.alt);continue;
    }
    if(o.kind==='keys'){content+=para('abstract',run(o.text)+run(o.italic,'<w:i/>'));continue;}
    const formatted=o.kind==='refs'?o.text.split('*').map((x,i)=>run(x,i%2?'<w:i/>':'')).join(''):run(o.kind==='bullet'?o.text.replace(/^[–—-]\s*/,''):o.text,o.kind==='mark'?'<w:b/><w:color w:val="9C3E16"/>':'');
    content+=para(o.kind,formatted,o.kind==='refs'?'<w:ind w:left="720" w:hanging="720"/>':['heading','smallHead','number','caption'].includes(o.kind)?'<w:keepNext/>':'');
  }
  const wrapper=new DOMParser().parseFromString('<root xmlns:w="'+W+'" xmlns:r="'+R+'" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'+content+'</root>','application/xml');
  if(wrapper.querySelector('parsererror'))throw Error('No se pudo componer el contenido de Word.');
  body.replaceChildren(...Array.from(wrapper.documentElement.childNodes,x=>d.importNode(x,true)),section);
  ser(files,key,d);ser(files,relKey,rels);
  const props='docProps/core.xml';
  if(files.has(props)){
    const meta=parse(files,props);
    for(const x of [...meta.documentElement.children])if(['title','subject','creator','keywords','description','lastModifiedBy','category'].includes(x.localName))x.remove();
    ser(files,props,meta);
  }
  return zip(files);
}
