# Source audit — 0.5.0

Checked on 2026-10-10. This is a development review and regression pass, not a formal security certification.

## New repairs and capabilities

| Finding or capability | Evidence |
| --- | --- |
| Send-time white flash | Captures no longer hide the sidebar; rasterization crops at the exact current panel boundary. Real canvas tests exclude all synthetic chat pixels, including boundaries below 10% of viewport width, and reject geometry changes. |
| Search was explicitly disabled and instructions restricted answers to attachments | Per-thread official live web search is enabled by default; search lifecycle is surfaced. A real gpt-6-luna test emitted search events and returned a primary-source link. A new ephemeral search-off thread emitted no search events. |
| Local file/code tasks unavailable | Separate Work profile, independent automatic folders, optional native folder selection and explicit per-turn workspaceWrite policy. A real prewritten synthetic task requested approval, generated report.csv/report.html after acceptance and returned the expected total 70. An earlier decline produced no files. |
| Work required advance folder configuration | Mode changes no longer open the picker. The first task allocates a native session folder; invalid session IDs and symlink paths are rejected. Request-order and native chooser regressions retain event processing. |
| Approval replies could become unsafe or stale | Active thread/request binding, no persistent accept or frontend-supplied permission expansion, duplicate/wrong-session rejection, queued approval handling, stop cancellation and response acknowledgement. Unit and transport regressions. |
| Ephemeral threads cannot resume configuration | UI and worker require a new temporary chat for changes to mode, search or workspace. Saved-thread search reconfiguration is covered by a protocol fixture. |
| Work history and output visibility | Bounded command/file records restore from official history; native Files entry reveals the selected folder without executing artifacts. |

## Current validation

- **270 automated checks**: 203 JavaScript checks, 38 Python checks and 29 Swift checks covering shortcuts, request order and managed folders. Browser checks use synthetic pages and mocked transport; pixel-crop checks use real image/canvas operations.
- Work approvals were checked after actual sidebar dragging to 280/340/460 px; completed operation records were visually inspected. Existing 280–520 px and theme/language/text-size coverage remains.
- Signed universal host, extension and helper compiled for arm64/x86_64; deep/strict signature and ZIP integrity verification passed. Signing data and built applications are excluded from Git.
- Official runtime checks used codex-cli 0.162.0-alpha.17.2 and gpt-6-luna. Live search and scoped file generation consume the local tester account and are opt-in, excluded from CI.
- The personal installation was upgraded to 0.5.0 (24) with a verified 0.4.7 rollback archive. Real Safari on a public Wikipedia page completed official search, automatic-folder file generation and optional existing-folder selection. A protected synthetic command was approved in the sidebar at 280 px and generated CSV/HTML with the expected total 70. Operation output and exit status were visible in the sidebar. A second operation was declined and its output marker was absent; Files revealed the correct folder in Finder. These checks supplement the fixture suite; third-party installation remains unverified.
- No OpenAI executable, account state, pairing file, signing identity, real webpage screenshot or live test output is part of the source release.

## Limits

Work uses official workspace-write/on-request behavior: normal sandboxed tasks may run without a prompt, and readable files outside the selected folder can be accessible where macOS permits. This is not a strict read-isolation product. Inherited MCP, apps/connectors/plugins and optional agent/computer/browser/image-generation tools remain disabled. The bridge does not claim all ChatGPT web features. Third-party Mac installation, notarization and live Intel Safari remain unverified.

---

# Source audit — 0.4.8

Checked on 2026-10-10. This is a publication-focused code review and regression pass, not a formal security certification.

## Repairs

| Finding | Repair and evidence |
| --- | --- |
| Selected-reference JSON could reappear as user text after history restore | Both reference labels are recognized; quote kind and excerpt restore separately. Python regression. |
| Concurrent requests could create duplicate sessions or replace a runtime while it was in use | Session reservation, active-thread checks, bounded pending requests and per-request runtime references. Concurrent-session regression and runtime fixtures. |
| A stop issued before turn/start returned could be lost | Store pending cancellation and dispatch it once the turn ID is known. Regression. |
| An optional thread title timeout could abort an already-started answer | Presentation metadata failures are isolated from inference. Timeout regression. |
| Model-list cursor repetition could loop indefinitely | Pagination limit and repeated-cursor detection. Regression. |
| New/history actions could race a preparing send | Reject switching during preparation/history load; clear superseded history jobs. Browser transport fixtures. |
| Hidden containers could leak image/link/heading metadata | Check rendered rectangles and transparent ancestors. Controlled collector/browser tests. |
| Local MCP HTTP redirects could forward the pairing bearer token | Redirects rejected, loopback address/size restrictions retained. Regression. |
| Build/configuration depended on a private path and signing identity | Parameterized team, bundle prefix, app group, architecture and identity; package-relative optional MCP configuration. Signed universal build check. |

## Validation

- **216 automated checks**: 173 JavaScript transport/collector/layout/appearance checks, 24 Python assertions/tests, and 19 Swift shortcut/cancellation checks.
- Controlled UI combinations include 280/340/460 px, light/dark, Chinese/English and five text sizes; broader sidebar checks include 320/380/520 px and hover/focus geometry. Preview images were visually inspected.
- Compiled and signed the host, native extension and helper for **arm64 and x86_64** using a local development identity. `codesign --verify --deep --strict` passed. That identity and signed output are excluded from the repository.
- Official app-server compatibility was checked against `codex-cli 0.162.0-alpha.17.2`. Model discovery returned seven entries. Inherited MCP servers and shell/edit/image-view feature flags were disabled.
- Real ephemeral inference with **gpt-6-luna** on a synthetic chart returned 40 and 4×, then 50 on a follow-up. No active inherited MCP tools were reported. No private webpage was used.
- Git publication includes a staged-file privacy/credential audit. Pairing files, account state, personal signing data, local chat results and real browser screenshots are excluded. Public preview images are synthetic fixtures with mocked replies.

GitHub’s first macOS build exposed an Xcode 27 project-format dependency; the project was adjusted to the conventional Xcode 14 format for older supported build hosts.

## Remaining limits

This source release has not been installed into a fresh third-party Mac, notarized, or tested on an actual Intel Safari session. The public build removes the private fallback runtime and uses each user’s installed official Codex runtime, which was checked separately. The installed personal 0.4.7 application was not replaced during this audit.

Real Safari behavior was exercised during earlier private iterations; current automated layout/transport checks are not an end-to-end Safari acceptance test. Official dictation requires a user-configured desktop shortcut, optional Accessibility permission and manual audio verification. Its actual recording state cannot be queried by this bridge. Future runtime or browser changes may require updates.
