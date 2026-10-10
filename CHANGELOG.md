# Changelog

## 0.5.1 — companion language and test packaging

- Add a persistent Simplified Chinese / English picker to the companion window, with localized buttons, connection/save messages and the optional menu-bar menu. Default to the system language; keep sidebar language independent.
- Add `scripts/build.sh --ad-hoc` for a universal test package without a personal signing certificate; use a separate test app group.
- Document Gatekeeper handling, Safari developer settings and restart limitations, dependencies, optional dictation and unverified fresh-Mac shared-container behavior.
- Verify language switching, English layout and restart persistence in the personally signed installed app. Verify both architectures and extracted ad hoc signatures; fresh-Mac end-to-end installation remains unverified.

## 0.5.0 — search and Work

- Fix send-time white flashes: crop sidebar pixels out of screenshots without hiding or repainting the live panel; reject changed capture geometry.
- Enable official live web search by default, show search progress and cite external sources; provide an off switch and handle ephemeral configuration limits explicitly.
- Add a separate Work profile, native folder picker, workspace-write core file/code tools, protected-operation approvals, cancellation, bounded tool records and a Finder folder entry.
- Start new Work tasks in an automatically created independent folder; selecting a folder is optional and intended for existing files. Keep the native chooser responsive while the helper processes events.
- Bind approvals to active runtime requests; reject stale/wrong-session/persistent permission replies; override inherited writable roots for every Work turn.
- Keep Chat local tools isolated and disable inherited optional MCP/apps/plugins/agents in both profiles.
- Add pixel-crop, Work transport and approval regressions, plus opt-in real search and file-generation checks.

## 0.4.8 — first public source release

- Restore selected-text references separately from user questions in saved history.
- Reserve in-flight chat sessions, preserve early stop requests, bound pending jobs, and defer runtime replacement while requests are in progress.
- Prevent optional title-setting timeouts from aborting an answer; detect repeated model-directory pagination cursors.
- Guard chat switching while a send or history operation is being prepared.
- Exclude images inside non-rendered containers and prevent local MCP credential redirects.
- Make signing parameters and app-group configuration portable; compile arm64 and x86_64; use the user’s installed official Codex runtime.
- Add independent test dependencies, publication regression tests, CI, bilingual documentation, privacy/security notes and MIT licensing.

## Earlier private development (0.4.0–0.4.7)

Introduced per-tab chat/context, dynamic models, saved/temporary conversations, a compact responsive sidebar, pinning, official dictation shortcut handoff, selected-text quoting, stable copy actions, optional menu-bar display, and language/appearance/text-size settings.
