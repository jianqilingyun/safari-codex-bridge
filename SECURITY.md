# Security

Please use GitHub’s private vulnerability reporting on this repository for credential exposure or cross-page access issues. If that feature is unavailable, open an issue requesting a private contact without publishing secrets or an exploit against a live account.

## Boundaries

- Safari content scripts use a closed Shadow DOM. Responses are rendered using text nodes and a small Markdown renderer; reference links are restricted to HTTP/HTTPS. Page scripts receive no OpenAI credentials or native pairing token.
- Page material is labeled as untrusted reference data. Chat disables local shell/edit/image-view tools and refuses client-tool approvals. Work uses a separate runtime profile with core local tools, a native-owned working folder, an explicit per-turn workspace-write policy (network restricted), and on-request manual approvals. Ordinary sandboxed operations do not always prompt. The official sandbox may read outside the working folder where macOS permits; this is not a strict read boundary.
- Work folder paths are owned by the native helper: a UUID-isolated managed folder is created lazily for new tasks, or the user selects an existing folder with NSOpenPanel. Managed paths reject symlinks and invalid session IDs; paths are never accepted from webpage messages. Approval responses bind an opaque token to the original active thread/turn and exact runtime request. Persistent accept/full-access options are not exposed. Expired, wrong-session or duplicate replies fail closed; stopping cancels pending approvals. Commands are shown as text, never executed by the renderer. Files reveals the chosen folder in Finder without running generated programs.
- Both profiles explicitly disable inherited MCP servers, apps/connectors/plugins, agents, hooks and computer/browser tools. Runtime capabilities and model lists are discovered through documented interfaces; a future protocol change can require a bridge update.
- Native chat requests require UUID identifiers and allowlisted actions. Private tabs and browser-internal pages are excluded by the browser layer. Permission grants remain controlled by Safari.
- Optional MCP uses a 127.0.0.1:53728 HTTP listener with a random 256-bit bearer pairing token, fixed Host and endpoint, no Origin requests, no proxy and no redirects. Only read-only page operations are exposed. This is not TLS or isolation from malicious software already running as your macOS user.
- The background helper is intentionally outside the App Sandbox to run the official Codex CLI and optional global shortcut. It inherits the privileges of the logged-in user. The containing app and Safari native extension are sandboxed.
- Do not publish signing credentials, `connection.json`, chat output, browser screenshots containing personal data, or OpenAI authentication files. CI has read-only repository permissions and performs no cloud inference.

## Supported releases

The latest source release receives fixes. This is an experimental local integration, not a formally audited security product. Compile/test results and their actual scope are recorded in [the audit report](docs/AUDIT.md).
