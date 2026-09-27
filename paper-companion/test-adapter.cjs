const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function fixture({cached=false,models=['gpt-5.6-sol','gpt-5.6-luna','gpt-5.5','gpt-6-astra'],formFeedCache=''}={}){
  const nodes=[],timers=[],sent=[],writes=[],prefs=new Map();let hasSelection=true,pending=false;
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.events={};this.textContent='';this.value='';this.isConnected=true;nodes.push(this);}
    append(...x){this.children.push(...x);} prepend(...x){this.children.unshift(...x);}
    setAttribute(k,v){this[k]=v;} addEventListener(k,v){this.events[k]=v;} remove(){this.isConnected=false;}
    get options(){return this.children;} getClientRects(){return [1];}
  }
  const root=new Element('root');root.dataset.conversationKind='paper';
  const input=new Element('input'),section=new Element('section');
  const doc={createElementNS:(_,tag)=>new Element(tag),createTextNode:text=>({textContent:text}),defaultView:{setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}}};
  const body={ownerDocument:doc,querySelector:q=>({'#llm-main':root,'#llm-input':input,'.llm-input-section':section}[q]||null)};
  const attachment={id:42,key:'ABCD1234',libraryID:1,parentID:1,isAttachment:()=>true,attachmentContentType:'application/pdf',getFilePathAsync:async()=>'/paper.pdf'};
  const parent={getField:()=> 'A paper'};let active=attachment;
  const history=new Map([[99,[]]]);
  let cache=cached?{schema:1,identity:'1-ABCD1234',fingerprint:'20:30',status:'ready',pages:[{page:1,text:'page one'},{page:2,text:'page two'}],characters:16,dossier:'glossary\n【全文建档完成】'}:null;
  const ctx=vm.createContext({Map,Set,Promise,Date,console,getIOUtils:()=>({stat:async()=>({size:20,lastModified:30}),readJSON:async()=>{if(cache)return cache;throw Object.assign(new Error('missing'),{name:'NotFoundError'});},readUTF8:async()=>formFeedCache,exists:async()=>Boolean(formFeedCache),makeDirectory:async()=>{},writeJSON:async(p,r)=>{cache=JSON.parse(JSON.stringify(r));writes.push(cache);}}),
    Zotero:{isWin:false,DataDirectory:{dir:'/data'},Prefs:{get:k=>prefs.get(k),set:(k,v)=>prefs.set(k,v)},Items:{get:id=>id===42?attachment:parent},PDFWorker:{getFullText:async()=>formFeedCache?({text:'flattened worker text',totalPages:2,extractedPages:2}):({text:'page onepage two',pageChars:[8,8],totalPages:2})}},
    ztoolkit:{log:()=>{}},getConversationKey:()=>99,isRequestPending:()=>pending,chatHistory:history,buildCodexAppServerReasoningConfig:mode=>({mode})});
  vm.runInContext(['core.js','quota.js','adapter.js'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n'),ctx);
  let obsidian;
  ctx.qinAttachObsidian=(_bar,_body,deps)=>{obsidian=deps;return {refresh(){},dispose(){}};};
  const deps={item:()=>({id:99}),raw:()=>active,system:()=> 'codex',currentModel:()=> 'gpt-6-astra',loadModels:async()=>{},catalogModels:()=>models.map(model=>({model})),entries:()=>models.map(model=>({model,entryId:'codex_app_server::'+model,advanced:{}})),hasSelection:()=>hasSelection,stop:()=>{pending=false;},send:async question=>{
    const opts=ctx.qinWrapQuestion({body,item:{id:99},question,model:'gpt-6-astra'});sent.push(opts);
    history.get(99).push({role:'assistant',text:question.includes('建立论文背景')?'dossier\n【全文建档完成】':'translation',streaming:false});
  }};
  ctx.qinAttach(body,deps);
  return {sent,writes,ctx,body,input,prefs,nodes,history,deps,obsidian,setPending:value=>{pending=value;},isPending:()=>pending,tick:()=>timers.shift()(),click:prefix=>{const n=nodes.find(n=>n.tag==='button'&&n.textContent.startsWith(prefix));assert(n,prefix);return n.events.click();},select:(role,value)=>{const n=nodes.find(n=>n.tag==='select'&&n['aria-label']===role);n.value=value;n.events.change();},noSelection:()=>{hasSelection=false;},switchPaper:()=>{active={...attachment,id:43,key:'EFGH5678'};}};
}

test('Obsidian organizing without dossier uses Luna and stop works without a dossier',async()=>{
  const f=fixture();await f.tick();assert.equal(await f.obsidian.organize('a selected definition'),'translation');
  assert.equal(f.sent[0].model,'gpt-5.6-luna');assert.equal(f.writes.length,0);
  f.setPending(true);await f.click('停止当前回答');assert.equal(f.isPending(),false);
});

test('interrupted organizing cannot replace the preview or be exported as a completed answer',async()=>{
  const f=fixture();await f.tick();
  f.history.get(99).push({role:'assistant',text:'complete previous answer'});
  f.deps.send=async()=>{f.history.get(99).push({role:'assistant',text:'partial answer',interrupted:true});};
  await assert.rejects(f.obsidian.organize('extract'),/未完整结束/);
  assert.equal(f.obsidian.latest(),'complete previous answer');
  assert(!f.obsidian.discussion().includes('partial answer'));
  assert.equal(f.ctx.qinModelOverrides.size,0);
});
test('opening unstudied PDF never sends a model request, even with old auto preference',async()=>{
  const f=fixture();f.prefs.set('extensions.zotero.llmforzotero.qinAutoRead',true);await f.tick();await f.tick();assert.equal(f.sent.length,0);assert.equal(f.writes.length,0);
});
test('restoring cached dossier and changing models are local-only',async()=>{
  const f=fixture({cached:true});await f.tick();f.select('翻译模型','gpt-5.5');await f.click('刷新可用模型');assert.equal(f.sent.length,0);
});
test('manual read uses Sol and later translation uses Luna with same complete dossier',async()=>{
  const f=fixture();await f.tick();await f.click('开始通读');assert.equal(f.sent.length,1);assert.equal(f.sent[0].model,'gpt-5.6-sol');assert.equal(f.writes.length,1);
  await f.click('翻译选区');assert.equal(f.sent[1].model,'gpt-5.6-luna');assert(f.sent[1].question.includes('page two'));assert(f.sent[1].question.includes('dossier'));assert.equal(f.writes.length,1);
});
test('worker output without page maps falls back to Zotero form-feed cache and keeps page coverage',async()=>{
  const f=fixture({formFeedCache:'page one\fpage two'});await f.tick();await f.click('开始通读');
  assert.equal(f.sent.length,1);assert(f.sent[0].question.includes('[PDF 第 2 页]\npage two'));assert.equal(f.writes[0].pages.length,2);
});
test('explanation can follow chat model or use an explicitly selected model',async()=>{
  const f=fixture({cached:true});await f.tick();await f.click('解释选区');assert.equal(f.sent[0].model,'gpt-6-astra');f.select('解释模型','gpt-5.5');await f.click('解释选区');assert.equal(f.sent[1].model,'gpt-5.5');
  assert.equal(f.ctx.qinModelOverrides.size,0);
});
test('unavailable model never falls back to Astra or another model',async()=>{
  const f=fixture({cached:true,models:['gpt-6-astra']});await f.tick();await f.click('翻译选区');assert.equal(f.sent.length,0);assert(f.nodes.some(n=>n.textContent.includes('不会自动改用其他模型')));
});
test('missing selection or missing completed dossier blocks translation without inference',async()=>{
  const f=fixture({cached:true});await f.tick();f.noSelection();await f.click('翻译选区');assert.equal(f.sent.length,0);
  const g=fixture();await g.tick();await g.click('翻译选区');assert.equal(g.sent.length,0);
});
test('switching paper while loading model list prevents dispatch',async()=>{
  const f=fixture({cached:true});await f.tick();f.deps.loadModels=async()=>f.switchPaper();await f.click('翻译选区');assert.equal(f.sent.length,0);
});
test('failed model generation leaves no active override',async()=>{
  const f=fixture({cached:true});await f.tick();f.deps.send=async()=>{throw new Error('network failure');};await f.click('翻译选区');assert.equal(f.ctx.qinModelOverrides.size,0);
});
test('manual quota refresh shows account values without sending an inference',async()=>{
  const f=fixture();let count=0;
  f.deps.readQuota=async()=>{count++;return {rateLimits:{primary:{usedPercent:40,windowDurationMins:300,resetsAt:2000000000},secondary:null}};};
  await f.tick();assert.equal(count,0);await f.click('刷新额度');assert.equal(count,1);assert.equal(f.sent.length,0);
  assert(f.nodes.some(n=>n.textContent.includes('剩余 60%')));assert(f.nodes.some(n=>n.textContent.includes('次要窗口：暂不可用')));
});
test('quota failure retains values with explicit stale-data label',async()=>{
  const f=fixture();f.deps.readQuota=async()=>({rateLimits:{primary:{usedPercent:99}}});await f.click('刷新额度');
  f.deps.readQuota=async()=>{throw new Error('network');};await f.click('刷新额度');assert(f.nodes.some(n=>n.textContent.includes('不代表当前额度')));assert.equal(f.sent.length,0);
});
test('quota read requests coalesce and cannot generate turns or redeem credits',async()=>{
  const f=fixture();const methods=[];let finish;let closed=0;
  f.ctx.getConfiguredCodexAppServerBinaryPath=()=>'/codex';
  f.ctx.getOrCreateCodexAppServerProcess=async()=>({sendRequest:async method=>{methods.push(method);return new Promise(r=>{finish=r;});}});
  f.ctx.destroyCachedCodexAppServerProcess=()=>{closed++;};
  const a=f.ctx.qinReadAccountQuota(),b=f.ctx.qinReadAccountQuota();await new Promise(r=>setImmediate(r));finish({rateLimits:null});await Promise.all([a,b]);
  assert.deepEqual(methods,['account/rateLimits/read']);assert.equal(closed,1);assert.equal(f.sent.length,0);
});
