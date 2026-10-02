# Build and verify Paper Companion

Base: upstream v3.9.8 (`53b826511bb8510c55d5bbadb94465ca36637457`). Public enhancement: 3.9.8.9. Python 3.10+ and Node.js 22+ are recommended.

## 1. Local enhancement tests (no model requests)

```sh
node --test paper-companion/test-core.cjs paper-companion/test-adapter.cjs paper-companion/test-quota.cjs paper-companion/test-obsidian.cjs paper-companion/test-obsidian-ui.cjs
node --test paper-companion/test-models.cjs
```

The nested package.json declares CommonJS only for the small enhancement tests. The original root package remains an ES module package.

## 2. Reproduce the distributed review XPI

```sh
python paper-companion/build.py
node --check dist-paper-companion/patched-bundle.js
```

On first use the script downloads the pinned **public upstream XPI** from its official GitHub release; no papers or credentials are transmitted. It verifies SHA-256 before applying four unique patch sites:

`17fe311c52f9a0bc11e97d279a6cf7d665cfd6e52b3aca768a0ba0b8ea512bbe`

You can instead place that official file at `paper-companion/.cache/llm-for-zotero-3.9.8.xpi`. Output is `dist-paper-companion/llm-for-zotero-3.9.8.9-paper-companion-review.xpi`, plus `build-info.json` and the generated bundle. Archive entry order/timestamps are fixed. Installing and model inference are never part of this build command.

## 3. Build the upstream base from editable source

The complete corresponding upstream source is included at the repository root, not just a link to another project.

```sh
npm ci
npm run build
```

Find the upstream `.xpi` produced inside `.scaffold/build`, then run:

```sh
python paper-companion/build.py --base-xpi PATH_TO_THE_BUILT_XPI
```

`--base-xpi` deliberately accepts a source-built artifact rather than enforcing the official release's byte hash, but still requires the exact unique patch markers. Source builds can differ from official release bytes because of generated timestamps/build metadata. The builder records the actual base hash and mode. It will fail explicitly if the generated structure is incompatible; do not bypass those checks. Use `npm run typecheck` and relevant upstream tests when modifying upstream modules. Native Zotero workflow tests require a separately configured disposable Zotero profile and are not run against your personal library automatically.

## 4. Distribution

Distribute the XPI with free, equally accessible corresponding source for the same tag (GitHub's source ZIP/tarball includes the full tree), LICENSE, NOTICE and these build instructions. Preserve third-party notices. Do not distribute only the XPI or only a compiled JS bundle.

Do not publish `.env`, login files, tokens, test Zotero profiles, PDFs, extracted-text caches, notes or debug logs. Review both new files and staged changes. The original upstream Git history is publicly available; the companion publication introduces only the explicit reviewed additions.

## 5. Updates and verification limits

This fork intentionally keeps the upstream addon ID to support replacement. Use a separate test profile, and back up before switching builds. Its update URL points to this fork's empty update list, so future updates are manual until deliberately enabled by the maintainer. Do not change IDs without a migration plan.

Release notes must distinguish local unit tests, source-build checks, and real Zotero/model verification. Tests use synthetic fixture text and no real credentials. Public-build preparation does not establish that every PDF, OS, or model works, and does not reinstall the user's current plugin.
