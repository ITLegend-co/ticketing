import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const {createUpdater}=createRequire(import.meta.url)('../desktop/updates.cjs');
function setup(){
  const engine=new EventEmitter();let installs=0,checks=0;const prompts=[];
  engine.quitAndInstall=(silent,restart)=>{assert.equal(silent,true);assert.equal(restart,true);installs++;};
  engine.checkForUpdates=async()=>{checks++;return {};};
  const updater=createUpdater({app:{},engine,dialog:{showMessageBox:async p=>{prompts.push(p);return {response:1};}}});
  return {engine,updater,prompts,get installs(){return installs;},get checks(){return checks;}};
}
test('updates download automatically, install on quit, and never downgrade',()=>{
  const x=setup();try{assert.equal(x.engine.autoDownload,true);assert.equal(x.engine.autoInstallOnAppQuit,true);assert.equal(x.engine.allowDowngrade,false);assert.equal(x.engine.disableWebInstaller,true);}finally{x.updater.stop();}
});
test('restart requires a completed verified download; Later never restarts',async()=>{
  const x=setup();try{x.updater.install();assert.equal(x.installs,0);x.engine.emit('update-available',{version:'1.0.20'});x.updater.install();assert.equal(x.installs,0);x.engine.emit('update-downloaded',{version:'1.0.20'});await Promise.resolve();assert.equal(x.updater.ready,true);assert.equal(x.installs,0);x.updater.install();assert.equal(x.installs,1);}finally{x.updater.stop();}
});
test('manual checks report network failures and automatic failures stay quiet',async()=>{
  const x=setup();try{x.engine.checkForUpdates=async()=>{throw Error('offline')};await x.updater.check();assert.equal(x.prompts.length,0);await x.updater.check(true);assert.equal(x.prompts[0].type,'warning');}finally{x.updater.stop();}
});
test('in-progress downloads are not duplicated and rejected download promises are handled',async()=>{
  const x=setup();try{x.engine.checkForUpdates=async()=>{x.engine.emit('update-available',{version:'1.0.20'});return {downloadPromise:Promise.reject(Error('connection lost'))};};await x.updater.check();await x.updater.check(true);assert.match(x.prompts[0].message,/downloading/);x.engine.emit('error',Error('checksum mismatch'));assert.equal(x.updater.ready,false);}finally{x.updater.stop();}
});
