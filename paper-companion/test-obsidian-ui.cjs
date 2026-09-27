const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function fixture(){
  const nodes=[],events={};let paper='PAPER001',selection='AI selection',finish;
  class Element{
    constructor(tag){this.tag=tag;this.style={};this.children=[];this.events={};this.value='';this.textContent='';nodes.push(this);}
    append(e){this.children.push(e);}setAttribute(k,v){this[k]=v;}addEventListener(k,v){this.events[k]=v;}remove(){}
  }
  const selectionNode={closest:()=>true};
  const doc={createElementNS:(_,tag)=>new Element(tag),addEventListener:(k,fn)=>{events[k]=fn;},removeEventListener:()=>{},defaultView:{getSelection:()=>({anchorNode:{parentElement:selectionNode},isCollapsed:false,toString:()=>selection})}};
  const body={ownerDocument:doc,contains:()=>true},root=new Element('div');
  const item={get key(){return paper;},libraryID:1,getField:()=> 'Paper',getCollections:()=>[],getAttachments:()=>[]};
  const ctx=vm.createContext({console,Map,Set,Promise,Date,Zotero:{isWin:true,Prefs:{get:()=>null},Libraries:{get:()=>({libraryType:'user'})}},
    Services:{dirsvc:{get:()=>({path:'C:\\AppData'})}},Components:{interfaces:{nsIFile:{}}},getIOUtils:()=>({readJSON:async()=>({vaults:{v:{path:'C:\\Vault'}}})})});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'obsidian.js'),'utf8'),ctx);
  const api=ctx.qinAttachObsidian(root,body,{raw:()=>item,selectionTexts:()=>['PDF selection'],latest:()=> 'draft',organize:()=>new Promise(r=>{finish=r;})});
  return {api,events,nodes,capture:()=>events.mouseup(),switchPaper:()=>{paper='PAPER002';api.refresh();},
    click:label=>{const b=nodes.find(n=>n.tag==='button'&&n.textContent===label);assert(b,label);return b.events.click();},
    draft:()=>nodes.find(n=>n.tag==='textarea'),finish:value=>finish(value)};
}
test('explicit PDF and AI preview buttons cannot silently use the other source',async()=>{
  const f=fixture();await new Promise(r=>setImmediate(r));f.capture();
  await f.click('预览 PDF 已添加文本');assert.equal(f.draft().value,'PDF selection');
  await f.click('预览 AI 对话选区');assert.equal(f.draft().value,'AI selection');
});
test('AI selection from a different paper cannot replace the preview',async()=>{
  const f=fixture();await new Promise(r=>setImmediate(r));f.capture();f.switchPaper();
  await f.click('预览 AI 对话选区');assert.equal(f.draft().value,'');
  assert(f.nodes.some(n=>n.textContent.includes('请先在当前论文')));
});
test('editing the preview while AI is running preserves the user edit',async()=>{
  const f=fixture();await new Promise(r=>setImmediate(r));await f.click('载入最新 AI 答复');
  const running=f.click('AI 整理预览（使用翻译模型）');await new Promise(r=>setImmediate(r));
  f.draft().value='my manual edit';f.finish('AI result');await running;
  assert.equal(f.draft().value,'my manual edit');assert(f.nodes.some(n=>n.textContent.includes('预览已被编辑')));
});
