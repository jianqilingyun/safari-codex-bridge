# Privacy and data flow

This is a local client of the official Codex runtime. There is no project-operated relay or analytics backend. The official runtime and OpenAI services apply their own account settings and data policies.

## What is read

With Safari website access, the extension can inspect ordinary HTTP/HTTPS pages. The collector excludes editable fields, password/input/textarea elements, hidden DOM content and this sidebar. It does not deliberately collect form values or private tabs. Rendered private information in normal page text remains page content; these filters are not a guarantee that a page contains no sensitive data.

Selected-text previews and unsent drafts stay in the current tab’s RAM. Pinning the sidebar or selecting text does not send a model request. When you send, opted-in page text (up to 30,000 characters), the quote, source URLs/titles, image metadata and optionally the visible screenshot are attached. Up to three added tabs are read only when you send. MCP tools read the requested pages when called.

Sidebar screenshots are cropped to exclude the chat panel without hiding it. Screenshots capture visible pixels and **may include form values or other personal information** that DOM filtering excludes. Image-download MCP calls make anonymous HTTP requests to the selected image URL, without cookies or referrer; the image host can see that request.

## What is stored

- **Saved chats (default):** official Codex thread history contains the question, page references, optional images and answers. Safari extension local storage holds a display/history copy, settings and the last saved conversation. Continuing in Codex opens that same saved thread.
- **Temporary chats:** use the official app-server ephemeral mode and skip the bridge’s persistent Safari history. Tab memory is discarded on close; native request/event files can remain briefly before cleanup. This is not a promise of zero cloud retention.
- **Work:** managed or selected saved-chat folder paths are stored locally in `workspaces.json` with 0600 permissions and in Safari history metadata; temporary folder bindings remain in helper memory. Automatically created saved and temporary task folders are separate; generated files remain on disk for the user to manage even for temporary chats. Work questions, file contents used by tools, command outputs, file diffs and generated results can enter official Codex context/history. The sidebar retains bounded tool records for display; they may contain private file data. Choosing Work does not send files immediately; the task determines what tools read and transmit. Official search sends queries to the OpenAI search service and relevant sources may be accessed.
- **Native mailbox files:** app-group directories are created with owner permissions; files use 0600. Responses expire after about 90 seconds, shared-page snapshots after 30 minutes, and finished chat events after 10 minutes while the apps run. Unexpected termination can postpone cleanup until the next launch. No disk encryption is implemented by this app.
- **Pairing file:** the optional MCP configuration contains a secret authorizing local page reads. Keep it private; do not upload it. It is not an OpenAI login token. To invalidate exported copies, quit the companion, remove its app-group `connection.json`, and reopen/re-export. Do not delete unrelated app-group data.

The project does not read, copy or export OpenAI token files. The official runtime manages its own authentication, history and normal local state. Only that runtime communicates with the model service. Dictation uses the official desktop app’s shortcut; the bridge does not record or upload audio.

## Permissions and control

Website access can be granted per site or for all websites in Safari. A per-site denial takes precedence. Accessibility is optional and only used to dispatch the user-configured Codex dictation shortcut while Safari is foreground.

Removing this application does not automatically remove Codex’s saved thread history, exported pairing files, or every macOS app-group file. Manage stored conversations and extension data separately in the corresponding applications. The bridge provides Markdown export but does not implement secure erasure or its own cloud deletion API.

See [SECURITY.md](SECURITY.md) for the trust boundary.
