import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {parseCsv,mapCsv} from '../src/core.js';
import {reportContent} from '../src/report.js';
import {field,results,article} from '../src/view.js';

test('flujo CSV → resultados → artículo con registros separados',async()=>{
  const csv=parseCsv(await readFile(new URL('../ejemplos/sonometro.csv',import.meta.url),'utf8'));
  const project={name:'Muestreo de ruido',demo:true,points:[
    {id:'p1',code:'P01',name:'Vía principal',zone:'residencial',zoneRef:'Zona de ejemplo',lat:-18.01,lon:-70.25},
    {id:'p2',code:'P02',name:'Parque',zone:'residencial',zoneRef:'Zona de ejemplo',lat:-18.03,lon:-70.24}
  ],report:{titleEs:'Muestreo de ruido',titleEn:'Noise sampling'}};
  const r=mapCsv(csv,{point:'0',start:'1',seconds:'2',level:'3'},{mode:'sessions',points:project.points,equipment:'Equipo de prueba',calibration:'Verificación',verified:true});
  assert.equal(r.problems.length,0);
  project.sessions=[...r.rows,{point:'p1',start:'2026-11-18T11:00:00',seconds:10,level:-24.5,source:'mic'}];
  assert.match(field(project,{}),/Mapa esquemático/);
  assert.match(results(project,{}),/Supera/);
  assert.doesNotMatch(results(project,{}),/Lectura relativa del micrófono/);
  assert.match(results(project,{filterSource:'mic'}),/Lectura relativa del micrófono/);
  const doc=reportContent(project,project.sessions);
  assert.ok(doc.validation.draft);
  assert.equal(doc.list.find(x=>x.kind==='table').rows.length,3);
  assert.match(article(project,doc,null,true),/DATOS SIMULADOS/);
  assert.match(article(project,doc,null,true),/BORRADOR/);
});

test('el service worker registra recursos existentes y devuelve el HTML sin red',async()=>{
  const origin='https://ejemplo.test/ruidolab/';
  const entries=new Map(),handlers={};
  const cache={
    async addAll(paths){for(const p of paths){const file=p==='./'?'./index.html':p;await readFile(new URL('../'+file,import.meta.url));entries.set(new URL(p,origin).href,p);}},
    async match(x){return entries.get(new URL(typeof x==='string'?x:x.url,origin).href);}
  };
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  runInNewContext(sw,{
    self:{registration:{scope:origin},addEventListener(k,v){handlers[k]=v;}},
    caches:{async open(){return cache;}},
    fetch:()=>Promise.reject(new Error('fuera de línea')),
    URL
  });
  await new Promise(resolve=>handlers.install({waitUntil:resolve}));
  assert.ok(entries.has(origin+'src/report.js'));
  const response=await new Promise(resolve=>handlers.fetch({request:{method:'GET',mode:'navigate',url:origin+'?inicio=1'},respondWith:resolve}));
  assert.equal(response,'./index.html');
});
