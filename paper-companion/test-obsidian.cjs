const {test}=require('node:test');
const assert=require('node:assert/strict');
const c=require('./obsidian.js');
test('relative export folder rejects traversal, absolute paths, ADS and hidden settings',()=>{
  for(const s of ['../escape','a/../b','C:/vault','/vault','\\server\\share','.obsidian','a/.git','a:stream','CON','a/NUL.md','a./b'])assert.throws(()=>c.relative(s),s);
  assert.equal(c.relative('文献笔记\\分数阶'), '文献笔记/分数阶');assert.equal(c.relative(''),'');
});
test('paper override wins over collection mapping',()=>{
  const r=c.route({papers:{p:{vault:'v2',folder:'x'}},collections:{m:{vault:'v1'}}},'p',[{identity:'m',name:'Example collection'}],[{name:'Example vault',path:'v3'}]);
  assert.equal(r.vault,'v2');
});
test('ambiguous collection routes require explicit paper selection',()=>{
  assert(c.route({collections:{a:{vault:'one'},b:{vault:'two'}}},'p',[{identity:'a'},{identity:'b'}],[]).conflict);
});
test('public edition never guesses an export destination from collection or vault names',()=>{
  const v=[{name:'Example vault',path:'v'}];
  assert.equal(c.route({},'p',[{name:'Example collection'}],v).vault,undefined);
  assert.equal(c.route({},'p',[{name:'Other collection'}],v).vault,undefined);
  assert.equal(c.route({},'p',[{name:'Example collection'}],[...v,...v]).vault,undefined);
});
test('Markdown metadata escapes YAML injection and preserves formula source',()=>{
  const s=c.markdown({title:'a"\nnew: bad',identity:'1-ABCDEFGH',itemURI:'zotero://select/library/items/ABCDEFGH',pdfURI:'zotero://open-pdf/library/items/12345678'},'摘录','$x^2$\n\n$$x=y$$','today');
  assert(s.includes('title: "a\\"\\nnew: bad"'));assert(s.includes('$x^2$'));assert(s.includes('[打开 PDF]'));assert.throws(()=>c.markdown({},'摘录',' ','today'));
});
test('title cannot inject paths or illegal Windows characters',()=>{assert(!/[<>:"/\\|?*]/.test(c.filename('../a:b*')));assert(c.filename('a'.repeat(300)).length<=65);});
