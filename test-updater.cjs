// Dependency-free frontend updater smoke test with Tauri plugin mocks.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const code = fs.readFileSync(__dirname + '/src/updater.js', 'utf8').replace(/^import .*?;\s*$/gm,'');
const items = new Map();
function createElement(){ return { hidden:false, disabled:false, textContent:'',style:{width:''},listeners:{}, addEventListener(event,callback){this.listeners[event]=callback;} }; }
function el(name) {if(!items.has(name))items.set(name, createElement());return items.get(name);}
let available, checks=0,backupCalls=0,downloads=0,restarts=0,saveGood=true,failBackups=false;
const context={
  console,window:{setTimeout:()=>0,nteBeforeUpdate:async()=>saveGood},
  document:{getElementById:el},
  isTauri:()=>true,
  getVersion:async()=> '1.1.0',
  check:async()=>{checks++;return available;},
  invoke:async(cmd)=>{if(cmd!=='backup_before_update')throw new Error('unexpected '+cmd);if(failBackups)throw new Error('disk full');backupCalls++;},
  relaunch:async()=>{restarts++},
};
vm.createContext(context);
vm.runInContext(code,context);
const click=(id)=>el(id).listeners.click();
(async()=>{
  available={version:'1.2.0',body:'new features',downloadAndInstall:async(fn)=>{
    downloads++;
    fn({event:'Started',data:{contentLength:100}});
    fn({event:'Progress',data:{chunkLength:40}});
    fn({event:'Progress',data:{chunkLength:60}});
    fn({event:'Finished',data:{}});
  }};
  await click('update-check');
  assert.equal(checks,1);
  assert.equal(el('update-banner').hidden,false);
  assert.match(el('update-title').textContent,/1.2.0/);
  await click('update-install');
  assert.equal(backupCalls,1);
  assert.equal(downloads,1);
  assert.equal(restarts,1);
  assert.equal(el('update-progress').style.width,'100%');

  // Backup failure must block the install, not silently update.
  await click('update-check');failBackups=true;
  await click('update-install');
  assert.equal(downloads,1);
  assert.equal(restarts,1);
  assert.match(el('update-status').textContent,/disk full/);
  failBackups=false;

  // Failed pending SQLite writes must block even the backup.
  await click('update-check');saveGood=false;
  await click('update-install');
  assert.equal(backupCalls,1);
  assert.equal(downloads,1);
  saveGood=true;
  available=null;
  await click('update-check');
  assert.match(el('update-title').textContent,/Up to date/);
  assert.equal(el('update-install').hidden,true);
  console.log('PASS: found version; download progress; backup-before-update; restart; backup/save failure abort; no-update state');
})().catch(err=>{console.error(err); process.exitCode=1;});
