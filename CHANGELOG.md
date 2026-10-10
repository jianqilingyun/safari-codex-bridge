# Changelog

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
