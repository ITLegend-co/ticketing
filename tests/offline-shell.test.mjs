import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('offline shell serves navigation and assets but never handles API or photo requests',async()=>{
 const handlers={}, cached=new Map(),root='https://example.test/ticketing/';
 const cache={addAll:async urls=>urls.forEach(u=>cached.set(u,new Response(u.endsWith('.js')?'javascript':'app shell'))),match:async request=>cached.get(typeof request==='string'?request:request.url)?.clone()};
 const context=vm.createContext({URL,Response,SHELL_VERSION:'test',SHELL_FILES:['./','assets/app.js'],self:{registration:{scope:root},clients:{claim:async()=>{}},addEventListener:(name,handler)=>handlers[name]=handler},caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true},fetch:async()=>{throw new TypeError('offline');}});
 vm.runInContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 let work;handlers.install({waitUntil:p=>work=p});await work;
 handlers.fetch({request:{url:root+'?ticket=123',mode:'navigate',method:'GET'},respondWith:p=>work=p});
 assert.equal(await (await work).text(),'app shell');
 handlers.fetch({request:{url:root+'assets/app.js',mode:'cors',method:'GET'},respondWith:p=>work=p});
 assert.equal(await (await work).text(),'javascript');
 for(const url of ['https://firebase.example/tickets.json?auth=secret',root+'not-an-asset.json']){
  handlers.fetch({request:{url,method:'GET',mode:'cors'},respondWith:()=>assert.fail('private/API requests must not be intercepted')});
 }
});
