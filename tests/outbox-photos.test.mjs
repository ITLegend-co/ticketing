import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8');
test('photo retries return the existing file even at the photo limit',()=>{
  let files=[],creates=0;
  const iterator=items=>{let i=0;return {hasNext:()=>i<items.length,next:()=>items[i++]}};
  const folder={getFiles:()=>iterator(files),getFilesByName:name=>iterator(files.filter(f=>f.getName()===name)),createFile:blob=>{
    creates++;const id=String(creates);const file={getId:()=>id,getName:()=>blob.name,getMimeType:()=>blob.mime,getSize:()=>blob.bytes.length,getDateCreated:()=>new Date(1)};files.push(file);return file;
  }};
  const context=vm.createContext({
    DriveApp:{getFolderById:()=>({getFoldersByName:()=>iterator([folder])})},
    Utilities:{base64Decode:()=>[137,80,78,71,13,10,26,10],newBlob:(bytes,mime,name)=>({bytes,mime,name})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}
  });
  vm.runInContext(source,context);
  const request={base64:'AAAA',mime:'image/png',name:'photo.png',uploadId:'12345678-1234-1234-1234-123456789abc'};
  const access={canUpload:true,ticketId:'ticket'};
  const first=context.upload_(request,access);
  for(let i=0;i<4;i++)context.upload_({...request,uploadId:undefined,name:`other${i}.png`},access);
  assert.equal(files.length,5);
  const retry=context.upload_(request,access);
  assert.equal(first.id,retry.id);assert.equal(creates,5);assert.equal(retry.name,'photo.png');
  assert.throws(()=>context.upload_({...request,uploadId:'invalid'},access),/Invalid upload ID/);
  assert.throws(()=>context.upload_(request,{...access,canUpload:false}),/cannot add/);
});
