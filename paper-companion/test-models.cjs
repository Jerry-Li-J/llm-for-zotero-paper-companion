const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {create}=require('./models.js');

test('catalog cache expires and discovers arbitrary future model IDs without a code update',async()=>{
  let time=1,calls=0,models=[{model:'future-model-a'}];
  const load=create(async()=>{calls++;return {models};},()=>time);
  assert.equal((await load('runtime')).models[0].model,'future-model-a');
  models=[{model:'future-model-b'}];time=600000;
  assert.equal((await load('runtime')).models[0].model,'future-model-a');assert.equal(calls,1);
  time=600001;assert.equal((await load('runtime')).models[0].model,'future-model-b');assert.equal(calls,2);
});
test('manual refresh bypasses cache, path changes invalidate it, and concurrent panels coalesce',async()=>{
  let calls=0,finish;
  const load=create(()=>{calls++;return new Promise(r=>{finish=r;});});
  const a=load('one'),b=load('one',true);await Promise.resolve();assert.equal(calls,1);
  finish({models:[{model:'future-model'}]});await Promise.all([a,b]);
  const c=load('one',true);await Promise.resolve();assert.equal(calls,2);finish({models:[{model:'new-model'}]});await c;
  const d=load('two');await Promise.resolve();assert.equal(calls,3);finish({models:[{model:'other-runtime'}]});await d;
});
test('failure cannot masquerade as successful cached refresh and retries are throttled',async()=>{
  let calls=0,fail=false,time=1;
  const load=create(async()=>{calls++;if(fail)throw new Error('offline');return {models:[{model:'old'}]};},()=>time);
  await load('runtime');fail=true;
  await assert.rejects(load('runtime',true),/offline/);
  await assert.rejects(load('runtime'),/offline/);assert.equal(calls,2);
  fail=false;await load('runtime',true);assert.equal(calls,3);
});
test('empty catalogs fail; hidden and duplicate entries are excluded',async()=>{
  const load=create(async()=>({models:[{model:'a'},{model:'A'},{model:'hidden',hidden:true},{model:''}]}));
  assert.deepEqual((await load('runtime')).models.map(x=>x.model),['a']);
  await assert.rejects(create(async()=>({models:[]}))('runtime'),/未返回/);
});
test('fresh catalog uses its own process, supports upstream pagination, and always disposes it',async()=>{
  const calls=[],closed=[];
  const ctx=vm.createContext({Map,Set,Date,Promise,
    loadCodexAppServerModelCatalog:async p=>{calls.push(p);return {models:[{model:'future-model'}]};},
    destroyCachedCodexAppServerProcess:(...p)=>closed.push(p)});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'models.js'),'utf8'),ctx);
  await ctx.qinLoadModelCatalog('/codex');
  assert.equal(calls[0].processKey,'qin-paper-companion-model-catalog');
  assert.equal(closed[0][0],calls[0].processKey);assert.equal(closed[0][2].codexPath,'/codex');
  ctx.loadCodexAppServerModelCatalog=async()=>{throw new Error('offline');};
  await assert.rejects(ctx.qinLoadModelCatalog('/codex',true),/offline/);assert.equal(closed.length,2);
});
