const {test}=require('node:test');const assert=require('node:assert/strict');const quota=require('./quota.js');
test('used percentage becomes remaining percentage with real duration',()=>{
  const rows=quota.windows({rateLimits:{primary:{usedPercent:34,windowDurationMins:300,resetsAt:2000000000},secondary:{usedPercent:89,windowDurationMins:10080}}});
  assert.equal(rows[0].remaining,66);assert.equal(rows[0].period,'5 小时窗口');assert.equal(rows[1].remaining,11);assert.equal(rows[1].period,'7 天窗口');
});
test('authoritative multi-bucket view takes precedence and preserves each bucket',()=>{
  const rows=quota.windows({rateLimits:{primary:{usedPercent:0}},rateLimitsByLimitId:{a:{limitName:'Shared',primary:{usedPercent:70}},b:{primary:{usedPercent:80}}}});
  assert.equal(rows.length,4);assert.equal(rows[0].remaining,30);assert.equal(rows[2].remaining,20);assert.equal(rows[0].bucket,'Shared');
});
test('missing, null, NaN and textual percentages are unavailable, never full quota',()=>{
  for(const value of [undefined,null,NaN,'0']){
    const r=quota.windows({rateLimits:{primary:{usedPercent:value},secondary:null}});assert.equal(r[0].remaining,null);assert.equal(r[1].remaining,null);
  }
  assert.deepEqual(quota.windows(null),[]);
});
test('percentages are bounded and unknown durations never become five hours by guess',()=>{
  const r=quota.windows({rateLimits:{primary:{usedPercent:120},secondary:{usedPercent:-1,windowDurationMins:15}}});
  assert.equal(r[0].remaining,0);assert.equal(r[1].remaining,100);assert.equal(r[0].period,'主要窗口');assert.equal(r[1].period,'15 分钟窗口');
});
test('elapsed reset time prompts refresh instead of granting quota locally',()=>{
  assert(quota.resetText(10,20000).includes('请刷新'));assert(quota.resetText(null).includes('暂不可用'));
  assert.equal(quota.windows({rateLimits:{primary:{resetsAt:Infinity}}})[0].resetsAt,null);
});
