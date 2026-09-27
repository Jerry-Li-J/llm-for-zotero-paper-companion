/* Account-wide usage display. Read-only: never generates a turn or consumes resets. */
const QinQuota = (() => {
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  function windows(payload) {
    const map = payload?.rateLimitsByLimitId;
    const buckets = map && typeof map === 'object' && Object.keys(map).length
      ? Object.entries(map) : payload?.rateLimits ? [['codex',payload.rateLimits]] : [];
    return buckets.flatMap(([id,b]) => {
      if (!b || typeof b !== 'object') return [];
      return ['primary','secondary'].map((key,index) => {
        const w = b[key];
        const minutes = finite(w?.windowDurationMins) && w.windowDurationMins > 0 ? w.windowDurationMins : null;
        const period = minutes === null ? (index ? '次要窗口' : '主要窗口') : minutes % 1440 === 0 ? `${minutes/1440} 天窗口` : minutes % 60 === 0 ? `${minutes/60} 小时窗口` : `${minutes} 分钟窗口`;
        return { bucket: typeof b.limitName === 'string' && b.limitName ? b.limitName : id,
          period, remaining: finite(w?.usedPercent) ? Math.max(0,Math.min(100,100-w.usedPercent)) : null,
          resetsAt: finite(w?.resetsAt) && w.resetsAt > 0 && w.resetsAt*1000 <= 8640000000000000 ? w.resetsAt : null };
      });
    });
  }
  function resetText(seconds, now = Date.now()) {
    if (seconds === null) return '重置时间暂不可用';
    if (seconds*1000 <= now) return '上次返回的重置时间已到，请刷新';
    return '重置：' + new Date(seconds*1000).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
  }
  return { windows, resetText };
})();
if (typeof module !== 'undefined') module.exports = QinQuota;

var qinQuotaInFlight = null;
async function qinReadAccountQuota() {
  if (qinQuotaInFlight) return qinQuotaInFlight;
  const task = (async () => {
    const options = { codexPath: getConfiguredCodexAppServerBinaryPath() };
    const key = 'qin-paper-companion-account-limits';
    let proc;
    try {
      proc = await getOrCreateCodexAppServerProcess(key, options);
      return await proc.sendRequest('account/rateLimits/read', undefined, 15000);
    } finally {
      if (proc) destroyCachedCodexAppServerProcess(key, proc, options);
    }
  })();
  qinQuotaInFlight = task;
  try { return await task; } finally { if (qinQuotaInFlight === task) qinQuotaInFlight = null; }
}

function qinAttachQuota(parent, doc, deps) {
  const ns='http://www.w3.org/1999/xhtml';
  const box=doc.createElementNS(ns,'div'); box.style.cssText='padding:7px;margin:6px 0;border:1px solid #bbc4d1;border-radius:6px';
  box.setAttribute('aria-label','Codex 账户额度');
  const heading=doc.createElementNS(ns,'strong'); heading.textContent='账户额度 · 全账户共用';
  const hint=doc.createElementNS(ns,'div'); hint.textContent='尚未查询。此处不是单篇论文额度，也不是上下文窗口。';
  const rows=doc.createElementNS(ns,'div'); rows.setAttribute('aria-live','polite');
  const stamp=doc.createElementNS(ns,'div'); stamp.textContent='点击刷新读取账户数据，不生成回答。';
  const refresh=doc.createElementNS(ns,'button'); refresh.type='button'; refresh.textContent='刷新额度';
  const autoLabel=doc.createElementNS(ns,'label'), auto=doc.createElementNS(ns,'input'); auto.type='checkbox';
  const pref='extensions.zotero.llmforzotero.qinQuotaAfterAnswer';
  auto.checked=Zotero.Prefs.get(pref,true)!==false;
  auto.addEventListener('change',()=>Zotero.Prefs.set(pref,auto.checked,true));
  autoLabel.append(auto,doc.createTextNode('回答结束后刷新')); autoLabel.style.marginLeft='6px';
  box.append(heading,hint,rows,stamp,refresh,autoLabel); parent.append(box);
  let disposed=false, busy=false, lastSuccess=null, lastAttempt=0;
  async function update(manual=false) {
    if (disposed || busy || (!manual && Date.now()-lastAttempt<2000)) return;
    if (deps.system()!=='codex') { stamp.textContent='请先切换到 Codex 模式。'; return; }
    lastAttempt=Date.now(); busy=true; refresh.disabled=true; stamp.textContent='正在读取账户额度……';
    try {
      const payload=await deps.readQuota();
      if (disposed) return;
      const data=QinQuota.windows(payload); rows.textContent='';
      for (const w of data) {
        const row=doc.createElementNS(ns,'div'); row.style.marginTop='5px';
        const label=doc.createElementNS(ns,'div');
        label.textContent=`${w.bucket} · ${w.period}：${w.remaining===null?'暂不可用':`剩余 ${Math.round(w.remaining*10)/10}%`}`;
        row.append(label);
        if (w.remaining!==null) {
          const progress=doc.createElementNS(ns,'progress'); progress.max=100; progress.value=w.remaining;
          progress.setAttribute('aria-label',`${w.bucket} ${w.period}剩余额度`); progress.style.width='100%'; row.append(progress);
          if (w.remaining<=10) { const low=doc.createElementNS(ns,'div');low.textContent='剩余额度较低';low.style.color='#a65a00';row.append(low); }
        }
        const reset=doc.createElementNS(ns,'div'); reset.textContent=QinQuota.resetText(w.resetsAt); row.append(reset); rows.append(row);
      }
      lastSuccess=new Date().toLocaleTimeString('zh-CN',{hour12:false});
      hint.textContent=data.length?'来自当前 Codex 登录账户；与其他 Codex 使用共享。':'账户未返回可展示的额度，请检查登录或稍后刷新。';
      stamp.textContent=`查询于 ${lastSuccess} · 非实时；重置后请刷新`;
    } catch (_) {
      if (!disposed) stamp.textContent=`刷新失败，请检查网络、登录或 Codex 版本。${lastSuccess?'以下保留 '+lastSuccess+' 的旧数据，不代表当前额度。':'额度暂不可用。'}`;
    } finally { busy=false; if (!disposed) refresh.disabled=false; }
  }
  refresh.addEventListener('click',()=>update(true));
  return { afterAnswer:()=>auto.checked?update():Promise.resolve(), dispose:()=>{disposed=true;box.remove();} };
}
