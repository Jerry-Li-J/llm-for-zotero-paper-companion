/* Local Markdown export. No credentials, cloud requests, or automatic model calls. */
const QinObsidianCore = (() => {
  function relative(s) {
    const parts = String(s || '').replace(/\\/g, '/').split('/');
    if (/^(?:[a-z]:|\/)/i.test(String(s || '').replace(/\\/g, '/')) || parts.some(p => p === '..' || p.startsWith('.') || /[<>:"|?*\x00-\x1f]/.test(p) || /[ .]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new Error('请选择仓库内部的普通文件夹，不能使用隐藏目录、绝对路径或 ..。');
    return parts.filter(Boolean).join('/');
  }
  function filename(s) { return String(s || '论文笔记').replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 65).replace(/[ .]+$/, '') || '论文笔记'; }
  function route(config, paper, collections, vaults) {
    if (config.papers?.[paper]) return { ...config.papers[paper], source: '本篇论文设置' };
    const matches = collections.map(c => config.collections?.[c.identity]).filter(Boolean);
    const unique = [...new Map(matches.map(r => [JSON.stringify(r),r])).values()];
    if (unique.length > 1) return { conflict: true, source: '多个分类映射冲突，请为本篇论文选择目标' };
    if (unique.length) return { ...unique[0], source: '分类默认设置' };
    // Public edition requires an explicit paper or collection mapping.
    return { source: '尚未设置，请选择仓库和文件夹' };
  }
  function markdown(meta, kind, content, now) {
    if (!String(content || '').trim()) throw new Error('没有可保存的内容。');
    return `---\ntitle: ${JSON.stringify(meta.title)}\nzotero_item: ${JSON.stringify(meta.identity)}\nzotero_attachment: ${JSON.stringify(meta.attachmentKey || '')}\nnote_kind: ${JSON.stringify(kind)}\ncreated: ${JSON.stringify(now)}\n---\n\n# ${meta.title.replace(/[\r\n]/g, ' ')}\n\n来源：[Zotero 文献](${meta.itemURI})${meta.pdfURI ? ` · [打开 PDF](${meta.pdfURI})` : ''}\n\n## ${kind}\n\n${content.trim()}\n`;
  }
  return { relative, filename, route, markdown };
})();
if (typeof module !== 'undefined') module.exports = QinObsidianCore;

function qinAttachObsidian(parent, body, deps) {
  const doc = body.ownerDocument, ns = 'http://www.w3.org/1999/xhtml', io = getIOUtils();
  const join = (...p) => p.join(Zotero.isWin ? '\\' : '/');
  const pref = 'extensions.zotero.llmforzotero.qinObsidianRoutes';
  let vaults = [], disposed = false, busy = false, selected = null, targetPaper = '', draftPaper = '', draftKind = '摘录';
  const el = (tag, text, host = parent) => { const e=doc.createElementNS(ns,tag);if(text)e.textContent=text;host.append(e);return e; };
  const box=el('div');box.style.cssText='border-top:1px solid #bbc4d1;margin-top:8px;padding-top:8px';
  el('strong','Obsidian 笔记',box);
  const status=el('div','正在读取本机仓库列表……',box);status.setAttribute('role','status');
  const line=(label)=>{const d=el('label',label,box);d.style.cssText='display:block;margin:5px 0';return d;};
  const vault=el('select',null,line('目标仓库：'));vault.setAttribute('aria-label','Obsidian 目标仓库');vault.style.maxWidth='100%';
  const folder=el('input',null,line('仓库内文件夹：'));folder.placeholder='例如 文献笔记/分数阶方程';folder.style.width='95%';folder.setAttribute('aria-label','Obsidian 仓库内文件夹');
  const collection=el('select',null,line('分类映射：'));collection.setAttribute('aria-label','Zotero 分类映射');collection.style.maxWidth='100%';
  const controls=el('div',null,box);controls.style.cssText='display:flex;flex-wrap:wrap;gap:4px';
  const draftLabel=el('div','预览：可修改，保存按钮只保存这里的内容。',box);
  const draft=el('textarea',null,box);draft.rows=7;draft.style.cssText='width:100%;box-sizing:border-box;min-height:110px;user-select:text;';draft.setAttribute('aria-label','Obsidian 笔记预览');
  const actions=el('div',null,box);actions.style.cssText='display:flex;flex-wrap:wrap;gap:4px';
  const message=t=>{if(!disposed)status.textContent=t;};
  const button=(label,fn,host=controls)=>{const b=el('button',label,host);b.type='button';b.style.cssText='font:inherit;padding:4px;cursor:pointer';b.addEventListener('click',()=>Promise.resolve().then(fn).catch(e=>message(e.message)));return b;};
  const option=(s,value,label)=>{const o=el('option',label,s);o.value=value;};
  function config(){try{return JSON.parse(Zotero.Prefs.get(pref,true)||'{}');}catch(_){throw new Error('目标映射配置无法读取，请先修复配置。');}}
  function metadata(){
    const raw=deps.raw(); if(!raw)throw new Error('请先选中论文条目或打开 PDF。');
    const attachment=raw.isAttachment?.()?raw:null;
    const item=attachment?.parentID?Zotero.Items.get(attachment.parentID):raw;
    if(item.isNote?.())throw new Error('请先选择笔记所属的论文条目。');
    const pdf=attachment || (item.getAttachments?.()||[]).map(id=>Zotero.Items.get(id)).find(i=>i.attachmentContentType==='application/pdf');
    const library=Zotero.Libraries.get(item.libraryID), group=library.libraryType==='group'?Zotero.Groups.getGroupIDFromLibraryID(item.libraryID):null;
    const prefix=group?`groups/${group}`:'library';
    const collections=[],seen=new Set();
    for(const id of item.getCollections?.()||[]){let c=Zotero.Collections.get(id);while(c&&!seen.has(c.id)){seen.add(c.id);collections.push({identity:`${c.libraryID}-${c.key}`,name:c.name});c=c.parentID?Zotero.Collections.get(c.parentID):null;}}
    return {identity:`${item.libraryID}-${item.key}`,title:item.getField('title')||'论文笔记',attachmentKey:pdf?.key||'',collections,itemURI:`zotero://select/${prefix}/items/${item.key}`,pdfURI:pdf?`zotero://open-pdf/${prefix}/items/${pdf.key}`:''};
  }
  function populate(meta){
    const r=QinObsidianCore.route(config(),meta.identity,meta.collections,vaults);
    vault.textContent='';option(vault,'','请选择仓库');for(const v of vaults)option(vault,v.path,v.name);
    vault.value=vaults.some(v=>v.path===r.vault)?r.vault:'';folder.value=r.folder||'';
    collection.textContent='';option(collection,'','请选择要绑定的分类');for(const c of meta.collections)option(collection,c.identity,c.name);
    targetPaper=meta.identity;message(r.source+(r.vault&&!vault.value?'；仓库路径已失效，请重新选择':''));
  }
  function checkPaper(){const meta=metadata();if(meta.identity!==targetPaper){populate(meta);throw new Error('论文已切换，已加载新论文目标；请重新确认操作。');}return meta;}
  function routeValue(){if(!vault.value)throw new Error('请先选择 Obsidian 仓库。');return {vault:vault.value,folder:QinObsidianCore.relative(folder.value)};}
  async function loadVaults(){
    const services=globalThis.Services||ChromeUtils.importESModule('resource://gre/modules/Services.sys.mjs').Services;
    const base=services.dirsvc.get('AppData',Components.interfaces.nsIFile).path;
    const data=await io.readJSON(join(base,'obsidian','obsidian.json'));
    vaults=Object.values(data.vaults||{}).map(v=>({path:v.path,name:v.path.replace(/[\\/]+$/,'').split(/[\\/]/).pop()}));
    try{populate(metadata());}catch(e){message(e.message);}
  }
  async function pickDirectory(title){const C=getZoteroFilePickerConstructor();if(!C)throw new Error('文件夹选择器暂不可用。');const p=new C();p.init(doc.defaultView,title,p.modeGetFolder);const result=await p.show();return result===p.returnOK?(typeof p.file==='string'?p.file:p.file?.path):null;}
  button('刷新仓库列表',loadVaults);
  button('选择仓库文件夹',async()=>{checkPaper();const path=await pickDirectory('选择已有 Obsidian 仓库根目录');if(!path)return;if(!await io.exists(join(path,'.obsidian')))throw new Error('请选择已有 Obsidian 仓库的根目录。');if(!vaults.some(v=>v.path===path)){vaults.push({path,name:path.split(/[\\/]/).pop()});option(vault,path,vaults[vaults.length-1].name);}vault.value=path;folder.value='';message('已选择仓库，请保存本篇或分类映射。');});
  button('选择子文件夹',async()=>{checkPaper();const r=routeValue(),path=await pickDirectory('选择当前仓库内的文件夹');if(!path)return;const a=r.vault.replace(/\\/g,'/').replace(/\/$/,''),b=path.replace(/\\/g,'/');if(b.toLowerCase()!==a.toLowerCase()&&!b.toLowerCase().startsWith(a.toLowerCase()+'/'))throw new Error('所选文件夹不在当前仓库内。');folder.value=QinObsidianCore.relative(b.slice(a.length).replace(/^\//,''));});
  button('记住本篇目标',()=>{const m=checkPaper(),c=config();c.papers={...c.papers,[m.identity]:routeValue()};Zotero.Prefs.set(pref,JSON.stringify(c),true);message('已记住本篇论文的保存目标。');});
  button('绑定所选分类',()=>{checkPaper();if(!collection.value)throw new Error('请选择分类。');const c=config();c.collections={...c.collections,[collection.value]:routeValue()};Zotero.Prefs.set(pref,JSON.stringify(c),true);message('已绑定分类；本篇单独设置优先于分类设置。');});
  button('本篇恢复分类默认',()=>{const m=checkPaper(),c=config();if(c.papers)delete c.papers[m.identity];Zotero.Prefs.set(pref,JSON.stringify(c),true);populate(m);});
  function preview(text,kind){const m=checkPaper();if(!text?.trim())throw new Error('没有可预览的内容。');draft.value=text;draftPaper=m.identity;draftKind=kind;draftLabel.textContent=`预览：${kind} · ${m.title}`;message('已载入预览，可编辑后保存；尚未写入仓库。');}
  function capture(){try{const s=doc.defaultView.getSelection();const node=s?.anchorNode?.parentElement;if(s&&!s.isCollapsed&&node?.closest('.llm-messages')&&body.contains(node)){selected={text:s.toString(),paper:metadata().identity};message(`已捕获 AI 对话选区：${selected.text.length} 字；可点“预览 AI 对话选区”。`);}}catch(_){}}
  doc.addEventListener('mouseup',capture,true);doc.addEventListener('keyup',capture,true);
  button('预览背景笔记',()=>preview(deps.background(),'全文背景与术语表'));
  button('预览讨论笔记',()=>preview(deps.discussion(),'讨论记录'));
  button('预览 AI 对话选区',()=>{const m=checkPaper();if(selected?.paper!==m.identity)throw new Error('请先在当前论文的 AI 对话中拖选文字。');preview(selected.text,'AI 对话摘录');});
  button('预览 PDF 已添加文本',()=>preview(deps.selectionTexts?.().join('\n\n'),'PDF 摘录'));
  button('载入最新 AI 答复',()=>preview(deps.latest(),'AI 答复'));
  const organize=button('AI 整理预览（使用翻译模型）',async()=>{
    const m=checkPaper();if(busy)throw new Error('正在处理，请稍后。');if(draftPaper!==m.identity||!draft.value.trim())throw new Error('请先载入或输入预览内容。');
    busy=true;organize.disabled=true;const input=draft.value;
    try{message('正在整理，使用翻译模型并消耗账户额度；完成后仍需手动保存。');const text=await deps.organize(input);if(disposed)return;if(metadata().identity!==m.identity)throw new Error('论文已切换，整理结果保留在原对话，未写入仓库。');if(draft.value!==input)throw new Error('预览已被编辑，未覆盖；整理结果可从对话载入。');preview(text,'整理摘录');}finally{busy=false;organize.disabled=false;}
  },actions);
  draft.addEventListener('input',()=>{draftPaper=metadata().identity;});
  let lastSaved='';
  button('保存预览到 Obsidian',async()=>{
    const m=checkPaper(),r=routeValue();if(busy)throw new Error('正在整理或保存，请稍后。');if(draftPaper!==m.identity)throw new Error('预览属于另一篇论文，请重新载入。');
    const content=draft.value.trim();if(!content)throw new Error('预览为空。');const key=JSON.stringify([m.identity,r,content]);if(key===lastSaved)throw new Error('这份内容已保存；修改后可另存新笔记。');
    busy=true;try{
      if(!await io.exists(join(r.vault,'.obsidian')))throw new Error('仓库不在本机或尚未下载。');
      const rootFile=Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsIFile);rootFile.initWithPath(r.vault);rootFile.normalize();
      const dirFile=rootFile.clone();for(const part of r.folder.split('/').filter(Boolean)){dirFile.append(part);if(dirFile.exists()&&dirFile.isSymlink())throw new Error('目标包含链接文件夹，请选择仓库内的普通目录。');}
      dirFile.normalize();if(dirFile.path!==rootFile.path&&!rootFile.contains(dirFile))throw new Error('目标超出了仓库范围。');
      await io.makeDirectory(dirFile.path,{ignoreExisting:true,createAncestors:true});
      const now=new Date(),stamp=now.toISOString().replace(/[:.]/g,'-');
      const name=`${QinObsidianCore.filename(m.title)}--${m.identity}--${draftKind}--${stamp}--${Math.random().toString(36).slice(2,7)}.md`;
      const path=join(dirFile.path,name);await io.writeUTF8(path,QinObsidianCore.markdown(m,draftKind,content,now.toISOString()),{mode:'create'});
      lastSaved=key;message(`已保存：${r.folder?r.folder+'/':''}${name}。坚果云同步状态请在客户端查看。`);
      draftLabel.textContent=`已保存到 ${vaults.find(v=>v.path===r.vault)?.name||r.vault}；再次修改可另存。`;
    }finally{busy=false;}
  },actions);
  button('在 Obsidian 打开目标文件夹',()=>{checkPaper();const r=routeValue(),v=vaults.find(v=>v.path===r.vault);if(!v)throw new Error('请先在 Obsidian 中打开该仓库。');Zotero.launchURL(`obsidian://open?vault=${encodeURIComponent(v.name)}&file=${encodeURIComponent(r.folder)}`);},actions);
  void loadVaults().catch(e=>message(e.message));
  return { preview, refresh(){if(disposed||busy)return;try{const m=metadata();if(m.identity!==targetPaper){selected=null;populate(m);}}catch(_){}},dispose(){disposed=true;doc.removeEventListener('mouseup',capture,true);doc.removeEventListener('keyup',capture,true);box.remove();} };
}
