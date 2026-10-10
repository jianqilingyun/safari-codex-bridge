# Security

Please use GitHub’s private vulnerability reporting on this repository for credential exposure or cross-page access issues. If that feature is unavailable, open an issue requesting a private contact without publishing secrets or an exploit against a live account.

## Boundaries

- Safari content scripts use a closed Shadow DOM. Responses are rendered using text nodes and a small Markdown renderer; reference links are restricted to HTTP/HTTPS. Page scripts receive no OpenAI credentials or native pairing token.
- The sidebar labels page material as untrusted references. Instructions alone are not a security boundary: the runtime also disables inherited MCP servers, shell/edit/image-view/agent feature flags, uses read-only sandboxing, and refuses incoming client-tool and approval requests. Future runtime changes require renewed verification; do not use the bridge as a general coding agent.
- Native chat requests require UUID identifiers and allowlisted actions. Private tabs and browser-internal pages are excluded by the browser layer. Permission grants remain controlled by Safari.
- Optional MCP uses a 127.0.0.1:53728 HTTP listener with a random 256-bit bearer pairing token, fixed Host and endpoint, no Origin requests, no proxy and no redirects. Only read-only page operations are exposed. This is not TLS or isolation from malicious software already running as your macOS user.
- The background helper is intentionally outside the App Sandbox to run the official Codex CLI and optional global shortcut. It inherits the privileges of the logged-in user. The containing app and Safari native extension are sandboxed.
- Do not publish signing credentials, `connection.json`, chat output, browser screenshots containing personal data, or OpenAI authentication files. CI has read-only repository permissions and performs no cloud inference.

## Supported releases

The latest source release receives fixes. This is an experimental local integration, not a formally audited security product. Compile/test results and their actual scope are recorded in [the audit report](docs/AUDIT.md).
