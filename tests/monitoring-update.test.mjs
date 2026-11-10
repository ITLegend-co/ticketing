import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {check}=createRequire(import.meta.url)('../desktop/monitoring-update.cjs');
const app={isPackaged:false};
test('current collector skips upgrade and older collector requests preserving upgrade',async()=>{
 let prompts=0, launched;
 const dialog={showMessageBox:async()=>{prompts++;return{response:0};}};
 await check({app,dialog,platform:'win32',execute:async()=>({stdout:'Version REG_SZ 2'}),launch:(...args)=>launched=args});
 assert.equal(prompts,0);
 await check({app,dialog,platform:'win32',execute:async()=>({stdout:'Version REG_SZ 1'}),launch:(...args)=>launched=args});
 assert.equal(prompts,1);assert.deepEqual(launched,[false,false,true]);
});
test('postponing monitoring upgrade does not launch or change enrollment',async()=>{
 let launches=0;
 await check({app,platform:'win32',dialog:{showMessageBox:async()=>({response:1})},execute:async()=>({stdout:'Version REG_SZ 1'}),launch:()=>launches++});
 assert.equal(launches,0);
});
