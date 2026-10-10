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

## Remaining limits

This source release has not been installed into a fresh third-party Mac, notarized, or tested on an actual Intel Safari session. The public build removes the private fallback runtime and uses each user’s installed official Codex runtime, which was checked separately. The installed personal 0.4.7 application was not replaced during this audit.

Real Safari behavior was exercised during earlier private iterations; current automated layout/transport checks are not an end-to-end Safari acceptance test. Official dictation requires a user-configured desktop shortcut, optional Accessibility permission and manual audio verification. Its actual recording state cannot be queried by this bridge. Future runtime or browser changes may require updates.
