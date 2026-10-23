import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const {releaseUpdate,createUpdater}=createRequire(import.meta.url)('../desktop/updates.cjs');
const release = version => ({tag_name:'desktop-v'+version,assets:[{name:'Mountain-Torq-IT-Helpdesk-Setup-'+version+'.exe',size:2000000}]});
test('Only newer stable releases with a complete Windows installer are offered',()=>{
  assert.equal(releaseUpdate(release('1.0.9'),'1.0.13'),null);
  assert.equal(releaseUpdate(release('1.0.13'),'1.0.13'),null);
  assert.equal(releaseUpdate(release('1.0.14'),'1.0.13').version,'1.0.14');
  assert.equal(releaseUpdate({...release('1.0.14'),prerelease:true},'1.0.13'),null);
  assert.equal(releaseUpdate({...release('1.0.14'),draft:true},'1.0.13'),null);
  assert.equal(releaseUpdate({...release('1.0.14'),assets:[]},'1.0.13'),null);
  assert.equal(releaseUpdate({...release('1.0.14'),tag_name:'desktop-v1.0.14/evil'},'1.0.13'),null);
  assert.equal(releaseUpdate({...release('1.0.14'),html_url:'https://evil.example'},'1.0.13').url,'https://github.com/ITLegend-co/ticketing/releases/tag/desktop-v1.0.14');
});
test('Automatic notifications are deduplicated, manual checks work, offline checks are quiet',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mt-update-test-'));
  let prompts=[],opened=[],at=100000000,offline=false;
  const opts={app:{getPath:()=>dir,getVersion:()=>'1.0.13'},dialog:{showMessageBox:async o=>{prompts.push(o);return {response:0};}},shell:{openExternal:async u=>opened.push(u)},now:()=>at,fetchLatest:async()=>{if(offline)throw Error('offline');return release('1.0.14');}};
  let updater=createUpdater(opts);
  try {
    await updater.check();await updater.check();
    assert.equal(prompts.length,1);assert.equal(opened.length,1);
    updater.stop();updater=createUpdater(opts);
    await updater.check();assert.equal(prompts.length,1);
    await updater.check(true);assert.equal(prompts.length,2);
    at+=86400001;await updater.check();assert.equal(prompts.length,3);
    offline=true;await updater.check();assert.equal(prompts.length,3);
    await updater.check(true);assert.equal(prompts.length,4);assert.equal(prompts[3].type,'warning');
  } finally {updater.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
