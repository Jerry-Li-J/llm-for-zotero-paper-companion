const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('./core.js');
const extract=pages=>core.normalizeExtraction({text:pages.join(''),pageChars:pages.map(p=>p.length),totalPages:pages.length,extractedPages:pages.length});
test('all 27 pages, including last page, reach the model unchanged',()=>{
  const pages=Array.from({length:27},(_,i)=>`第${i+1}页: evidence-${i+1}\n`);
  const record={...extract(pages),title:'Test paper',dossier:'术语：kernel = 核函数'};
  const prompt=core.prompt(record,'解释最后一页');
  pages.forEach(p=>assert(prompt.includes(p)));
  assert(prompt.includes('kernel = 核函数'));
  assert(prompt.includes('[PDF 第 27 页]'));
});
test('initial reading has completion contract and honest image limitation',()=>{
  const p=core.prompt({...extract(['body']),title:'X'},core.INIT,true);
  assert(p.includes(core.END)); assert(p.includes('不能把抽取文本称为完成图像审阅'));
});
test('partial page count rejected',()=>assert.throws(()=>core.normalizeExtraction({text:'abc',pageChars:[3],totalPages:27}),/提取页数/));
test('mismatched offsets rejected without truncation',()=>assert.throws(()=>core.normalizeExtraction({text:'abcdef',pageChars:[2,2]}),/统计/));
test('scan or empty page cannot become fully read',()=>assert.throws(()=>extract(['body','  ']),/第 2 页/));
test('missing page map rejected',()=>assert.throws(()=>core.normalizeExtraction({text:'body'}),/逐页/));
test('explicit form-feed boundaries are accepted when Zotero omits pageChars',()=>{
  const result=core.normalizeExtraction({text:'page one\fpage two\fpage three',totalPages:3,extractedPages:3});
  assert.deepEqual(result.pages.map(p=>p.text),['page one','page two','page three']);
  assert.equal(result.characters,'page onepage twopage three'.length);
});
test('form-feed extraction still rejects a missing page or page count mismatch',()=>{
  assert.throws(()=>core.normalizeExtraction({text:'page one\f   \fpage three'}),/第 2 页/);
  assert.throws(()=>core.normalizeExtraction({text:'page one\fpage two',totalPages:3}),/提取页数/);
});
test('oversized paper fails explicitly',()=>assert.throws(()=>extract(['汉'.repeat(46000)]),/容量/));
test('cancelled or unfinished model output never persisted as complete',()=>{
  for(const msg of [{role:'assistant',text:'partial'},{role:'assistant',text:core.END,streaming:true},{role:'assistant',text:core.END,error:true},{role:'assistant',text:core.END,interrupted:true}]) assert.throws(()=>core.complete({},msg));
});
test('completed dossier can be restored only for same library, attachment and PDF',()=>{
  const r=core.complete({...extract(['paper']),identity:core.key(1,'ABCD1234'),fingerprint:'10:20'}, {role:'assistant',text:'术语表\n'+core.END});
  assert(core.validRecord(JSON.parse(JSON.stringify(r)),'1-ABCD1234','10:20'));
  assert(!core.validRecord(r,'2-ABCD1234','10:20'));
  assert(!core.validRecord(r,'1-ABCD1234','11:20'));
  assert(!core.validRecord({...r,pages:[]},'1-ABCD1234','10:20'));
});
test('unsafe attachment identifier rejected',()=>assert.throws(()=>core.key(1,'../../..')));
test('notes escape model HTML and preserve symbols',()=>{
  const html=core.noteHTML('论文 <1>','<script>alert(1)</script> x < y & α');
  assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('α'));
});
