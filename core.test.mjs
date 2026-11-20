import test from 'node:test';
import assert from 'node:assert/strict';
import {comparison,csvCell,leq,mapCsv,parseCsv,reportStatus,schedule,stamp} from '../src/core.js';
import {unzip,utf8,unutf8,zip} from '../src/zip.js';
const s={start:'2026-11-10T11:00:00',seconds:300,level:65,equipment:'Equipo',calibration:'Verificación',source:'sonometer',verified:true};
const p={id:'x',code:'P01',zone:'residencial',zoneRef:'Plano aprobado'};
test('el LAeq usa energía y pondera por duración',()=>{
  assert.ok(Math.abs(leq([{level:60,seconds:15},{level:70,seconds:15}])-67.4036)<.0001);
  assert.ok(Math.abs(leq([{level:60,seconds:45},{level:70,seconds:15}])-65.1188)<.0001);
  assert.equal(leq([{level:60,seconds:0}]),null);
});
test('franjas del ECA y sesiones que cruzan medianoche',()=>{
  assert.equal(schedule('2026-11-10T07:00',60),'Nocturno');
  assert.equal(schedule('2026-11-10T07:01',60),'Diurno');
  assert.equal(schedule('2026-11-10T22:00',60),'Diurno');
  assert.equal(schedule('2026-11-10T22:01',60),'Nocturno');
  assert.equal(schedule('2026-11-10T23:58',600),'Nocturno');
  assert.equal(schedule('2026-11-10T22:00',120),'Cruza franjas');
  assert.equal(schedule('2026-11-10T06:59',180),'Cruza franjas');
  assert.ok(Number.isNaN(stamp('2026-02-31T08:00')));
});
test('la comparación requiere fuente, equipo, revisión y franja aptos',()=>{
  assert.equal(comparison(p,s).delta,5);
  assert.equal(comparison(p,{...s,level:60}).status,'No supera');
  assert.equal(comparison(p,{...s,source:'mic'}).limit,undefined);
  assert.equal(comparison({...p,zoneRef:''},s).limit,undefined);
  assert.equal(comparison(p,{...s,verified:false}).limit,undefined);
  assert.equal(comparison(p,{...s,start:'2026-11-10T22:00:00'}).limit,undefined);
});
test('CSV con comillas, coma decimal, inválidos y duplicados',()=>{
  const csv=parseCsv('\uFEFFpunto;inicio;segundos;valor\r\n"P01";2026-11-10T10:00;60;60,5\r\n"P01";2026-11-10T10:00;60;60,5\r\nP01;2026-11-10T11:00;0;33\r\nP01;2026-11-10T11:00;60;66');
  const result=mapCsv(csv,{point:'0',start:'1',seconds:'2',level:'3'},{mode:'sessions',points:[p]});
  assert.deepEqual(result.rows.map(s=>s.level),[60.5,66]);
  assert.equal(result.problems.length,2);
  assert.equal(csvCell('=3+3'),'"\'=3+3"');
});
test('agregación por serie exige continuidad',()=>{
  const m={start:'0',seconds:'1',level:'2'};
  const options={mode:'series',point:p.id,points:[p],start:'2026-11-10T10:00'};
  const csv=parseCsv('inicio;segundos;nivel\n2026-11-10T10:00;60;60\n2026-11-10T10:01;60;70');
  assert.ok(Math.abs(mapCsv(csv,m,options).rows[0].level-67.4036)<.0001);
  csv.rows[1][0]='2026-11-10T10:02';
  assert.equal(mapCsv(csv,m,options).rows.length,0);
});
test('reporte incompleto queda como borrador',()=>{
  const x=reportStatus({report:{titleEs:'Titulo.'}},[{source:'mic'}]);
  assert.equal(x.draft,true);
  assert.ok(x.missing.includes('mediciones de sonómetro'));
  assert.ok(x.missing.some(x=>x.includes('ajustar títulos')));
});
test('ZIP conserva los bytes y rechaza archivos inválidos',async()=>{
  const a=zip(new Map([['word/document.xml',utf8('<x>Perú</x>')]]));
  assert.equal(unutf8((await unzip(await a.arrayBuffer())).get('word/document.xml')),'<x>Perú</x>');
  await assert.rejects(unzip(new Uint8Array([1,2,3])));
});
