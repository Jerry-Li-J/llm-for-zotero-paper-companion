/* SPDX-License-Identifier: AGPL-3.0-or-later.
 * Jerry-Li-J, 2026-10-02: dynamic runtime catalog, no inference or auth-file access. */
const QinModelCatalog = (() => {
  function create(fetchCatalog, now = Date.now) {
    const cache = new Map();
    return async function load(path, force = false) {
      const key = String(path || '');
      let state = cache.get(key);
      if (!state) { state = {}; cache.set(key, state); }
      if (state.inFlight) return state.inFlight;
      if (!force && state.error && now() - state.failedAt < 60000) throw state.error;
      if (!force && !state.error && state.value && now() - state.value.fetchedAt < 600000) return state.value;
      const task = Promise.resolve().then(() => fetchCatalog(key)).then(catalog => {
        const seen = new Set();
        const models = (catalog?.models || []).filter(m => {
          if (!m || typeof m.model !== 'string' || !m.model.trim() || m.hidden) return false;
          const id = m.model.toLowerCase();
          if (seen.has(id)) return false;
          seen.add(id); return true;
        });
        if (!models.length) throw new Error('Codex 未返回可显示的模型，请检查登录与运行程序版本。');
        state.error = null;
        state.value = { models, fetchedAt: now(), path: key };
        return state.value;
      }).catch(error => {
        state.error = error; state.failedAt = now(); throw error;
      }).finally(() => { if (state.inFlight === task) state.inFlight = null; });
      state.inFlight = task;
      return task;
    };
  }
  return { create };
})();

var qinLoadModelCatalog = QinModelCatalog.create(async codexPath => {
  // A short-lived, dedicated process sees runtime updates without interrupting chats.
  const processKey = 'qin-paper-companion-model-catalog';
  try {
    return await loadCodexAppServerModelCatalog({ codexPath, processKey });
  } finally {
    destroyCachedCodexAppServerProcess(processKey, undefined, { codexPath });
  }
});
if (typeof module !== 'undefined') module.exports = QinModelCatalog;
