# Attribution and modification notice

Upstream: **llm-for-zotero**, by **Yile Wang and contributors**.
Project: https://github.com/yilewang/llm-for-zotero
Base release: **v3.9.8**, commit **53b826511bb8510c55d5bbadb94465ca36637457**.
License: **GNU Affero General Public License, version 3 or any later version (AGPL-3.0-or-later)**, as specified in upstream package.json. The original LICENSE is retained verbatim.

This is an independent modified distribution maintained by **Jerry-Li-J**. It is not an official upstream release and does not imply upstream endorsement.

## Modifications

Enhancement work: 2026-09-17 through 2026-09-19. Public distribution preparation: **2026-09-27**.

Added the files under `paper-companion/`: explicit paper reading/background/terminology workflows, per-task model controls, account usage display, contextual translation/explanation, reviewed note export and routing, page-coverage extraction fallback, regression tests, and reproducible patch tooling. Modified the root README and added BUILD/NOTICE documentation and a companion-only test workflow. Original upstream README is retained as README.upstream.md.

Public version 3.9.8.8 corrects an early erroneous “MIT” comment in the enhancement core, removes a personal vault-name routing fallback, changes the built manifest name/homepage/update URL to this fork, and embeds source-location and modification notices. All added enhancement files are distributed under AGPL-3.0-or-later. Original and third-party notices remain applicable to their respective material.

The root upstream source and dependency lockfile remain at the pinned base version. The public build script modifies the upstream release bundle at four explicitly checked insertion sites; it refuses missing or ambiguous patch sites. The addon ID and preference namespace remain unchanged for migration, so this build replaces rather than coexists with the upstream plugin.

Corresponding source (including original upstream source, modification source, tests and build instructions):
https://github.com/Jerry-Li-J/llm-for-zotero-paper-companion/tree/v3.9.8.8-paper-companion

Third-party assets include their existing notices, including the Mermaid and provider-icon licenses in `addon/content/`. Dependency licenses remain in the respective packages; the build does not remove them.

No personal papers, account authentication, library databases, chat transcripts, or personal machine configuration are part of this release. No warranty is provided; see LICENSE. If operating a modified network service, supply remote users the prominent source-code offer required by AGPL section 13.
