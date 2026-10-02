"""Paper Companion public review build. SPDX-License-Identifier: AGPL-3.0-or-later.

Modified by Jerry-Li-J on 2026-10-02. See ../NOTICE.md.
Preserves upstream code and third-party notices. Does not install or call models.
"""
from pathlib import Path
import argparse, zipfile, json, hashlib, urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-xpi', type=Path, help='XPI built from the upstream source in this repository; exact patch markers are checked.')
parser.add_argument('--output', type=Path, default=ROOT/'dist-paper-companion')
args = parser.parse_args()
OUT = args.output.resolve()
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = args.base_xpi or HERE/'.cache'/'llm-for-zotero-3.9.8.xpi'
LICENSE = ROOT/'LICENSE'
if not SOURCE.exists() and not args.base_xpi:
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request('https://github.com/yilewang/llm-for-zotero/releases/download/v3.9.8/llm-for-zotero.xpi', headers={'User-Agent':'Paper-Companion-Build'})
    with urllib.request.urlopen(request, timeout=120) as response:
        SOURCE.write_bytes(response.read())
if not args.base_xpi and hashlib.sha256(SOURCE.read_bytes()).hexdigest() != '17fe311c52f9a0bc11e97d279a6cf7d665cfd6e52b3aca768a0ba0b8ea512bbe':
    raise RuntimeError('Original XPI checksum mismatch; refusing to patch.')
core = (HERE/'core.js').read_text(encoding='utf-8')
adapter = (HERE/'adapter.js').read_text(encoding='utf-8')
models = (HERE/'models.js').read_text(encoding='utf-8')
quota = (HERE/'quota.js').read_text(encoding='utf-8')
obsidian = (HERE/'obsidian.js').read_text(encoding='utf-8')
with zipfile.ZipFile(SOURCE) as z:
    files = {n:z.read(n) for n in z.namelist() if not n.endswith('/')}
script_path = 'content/scripts/llmforzotero.js'
script = files[script_path].decode('utf-8')
patches = [
    ('  // src/modules/contextPanel/setupHandlers.ts', core + '\n' + quota + '\n' + obsidian + '\n' + models + '\n' + adapter + '\n  // src/modules/contextPanel/setupHandlers.ts'),
    ('  async function sendQuestion(opts) {', '  async function sendQuestion(opts) {\n    opts = qinWrapQuestion(opts);'),
    ('    doSend = sendFlowController.doSend;', '''    doSend = sendFlowController.doSend;
    panelLifecycle.add(qinAttach(body, {
      item: () => item,
      raw: resolveLiveRawPanelItem,
      system: getConversationSystem,
      currentModel: () => getCodexRuntimeModelPref(),
      loadModels: async (refresh = false) => {
        const codexPath = getConfiguredCodexAppServerBinaryPath();
        const catalog = await qinLoadModelCatalog(codexPath, refresh);
        codexModelCatalogModels = catalog.models;
        codexModelCatalogPath = codexPath;
        codexModelCatalogStatus = "ready";
        codexModelCatalogError = "";
        refreshOpenCodexModelMenu();
        return catalog;
      },
      catalogModels: () => codexModelCatalogModels,
      entries: getCodexRuntimeModelEntries,
      selectionTexts: () => getSelectedTextContextEntries(getTextContextConversationKey()).map(e => e.text),
      hasSelection: () => getSelectedTextContextEntries(getTextContextConversationKey()).length > 0,
      stop: () => cancelActiveAgentAction(),
      readQuota: qinReadAccountQuota,
      send: (text) => doSend({ overrideText: text, preserveInputDraft: true, restoreQueuedInput: () => {} })
    }));'''),
    ('      getSelectedProfile,\n      getCurrentModelName: () => getSelectedModelInfo().currentModel,',
     '      getSelectedProfile: () => qinModelOverrides.get(body)?.profile || getSelectedProfile(),\n      getCurrentModelName: () => qinModelOverrides.get(body)?.profile.model || getSelectedModelInfo().currentModel,'),
]
for old,new in patches:
    if script.count(old) != 1:
        raise RuntimeError('Upstream changed; refusing an ambiguous patch: ' + old)
    script = script.replace(old,new)
files[script_path] = script.encode('utf-8')
manifest = json.loads(files['manifest.json'])
manifest['name'] = 'llm-for-zotero · 论文伴读增强（社区审核版）'
manifest['version'] = '3.9.8.9'
manifest['description'] = '本地审核版：手动通读、独立背景术语表、按任务选择模型，打开论文不触发模型请求。'
# Retain addon ID and preferences for in-place migration; no side-by-side support.
# Keep this fork's update metadata separate from upstream. Empty metadata means
# no automatic updates until a later reviewed release explicitly publishes one.
manifest['applications']['zotero']['update_url'] = 'https://raw.githubusercontent.com/Jerry-Li-J/llm-for-zotero-paper-companion/paper-companion/paper-companion/update.json'
manifest['homepage_url'] = 'https://github.com/Jerry-Li-J/llm-for-zotero-paper-companion'
files['manifest.json'] = json.dumps(manifest, ensure_ascii=False, indent=2).encode('utf-8')
files['LICENSE'] = LICENSE.read_bytes()
files['LOCAL-MODIFICATIONS.txt'] = (ROOT/'NOTICE.md').read_bytes()
files['SOURCE-CODE.txt'] = b'Corresponding source: https://github.com/Jerry-Li-J/llm-for-zotero-paper-companion/tree/v3.9.8.9-paper-companion\nLicense: AGPL-3.0-or-later. Full upstream source, enhancements, tests and build instructions are included.\n'
target = OUT/'llm-for-zotero-3.9.8.9-paper-companion-review.xpi'
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in sorted(files):
        info = zipfile.ZipInfo(name, date_time=(2026,9,17,0,0,0)); info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info, files[name])
(OUT/'patched-bundle.js').write_text(script,encoding='utf-8')
report={'upstream':'https://github.com/yilewang/llm-for-zotero/tree/v3.9.8','upstream_commit':'53b826511bb8510c55d5bbadb94465ca36637457','base_kind':'source-built' if args.base_xpi else 'pinned-release','original_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'review_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'patch_sites':len(patches),'version':'3.9.8.9','installation_status':'Build only. No local installation or live model request.'}
(OUT/'build-info.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
