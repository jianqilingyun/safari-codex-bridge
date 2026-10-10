# Build and install on your own Mac

[English README](../README.md) · [中文简介](../README.zh-CN.md)

Releases include source and an optional ad hoc signed test package. No Developer ID signed/notarized installer is available. See [test-package installation notes](AD-HOC-INSTALL.zh-CN.md) before installing the prebuilt package. Build output alone is not evidence that Safari will accept your signing setup.

## 1. Prepare the tools

Install full Xcode, select it with `xcode-select`, and complete its first-launch setup. Python 3.9+ must be available at `/usr/bin/python3` (Xcode provides the developer runtime), or set `SAFARI_CODEX_PYTHON` in the launch environment to your Python executable.

Install and sign in to the official Codex desktop app or CLI using [OpenAI’s setup documentation](https://learn.chatgpt.com/docs/cli). Verify `codex --version` and that your installed runtime supports `codex app-server --help`. Desktop users do not need to enter credentials in this bridge. The helper detects the installed desktop runtime or common CLI locations; nonstandard setups can set `SAFARI_CODEX_BINARY` in the helper’s launch environment.

## 2. Prepare your own Apple identity

In Xcode Settings → Accounts, sign in to your Apple account and create an **Apple Development** certificate for local development. Read any account agreements yourself. Locate your Team ID and identity using:

```sh
security find-identity -v -p codesigning
```

Use your own identity. A Personal Team can be used for local development where Apple supports the required configuration; this guide does not promise identical provisioning behavior or certificate lifetime for every account. If your team cannot provision the extension or app group, resolve it in Xcode first. Do not use someone else’s certificate or disable Gatekeeper as an installation shortcut.

## 3. Build

```sh
git clone https://github.com/jianqilingyun/safari-codex-bridge.git
cd safari-codex-bridge
BRIDGE_TEAM_ID=YOURTEAMID BRIDGE_SIGN_IDENTITY='Apple Development: Your Name (YOURTEAMID)' ./scripts/build.sh
```

Replace both example values. A certificate SHA-1 returned by `security find-identity` is also accepted. The build script derives the shared app group from the team and bundle prefix, compiles both architectures, signs the helper/extension/host in order, and verifies the resulting signatures. It does not install or launch the app. It does not embed an OpenAI runtime.

Options:

| Variable | Meaning |
| --- | --- |
| `BRIDGE_WORK` | Build directory, default `build.noindex/` |
| `BRIDGE_ARCHS` | `arm64 x86_64` by default; choose one for a faster local build |
| `BRIDGE_BUNDLE_PREFIX` | Default `local.codex.safari.context`; use a distinct reverse-domain prefix for a fork |
| `BRIDGE_TEAM_ID` | Your 10-character Apple Team ID |
| `BRIDGE_SIGN_IDENTITY` | Your signing certificate name or SHA-1 |

`./scripts/build.sh --ad-hoc` creates an ad hoc signed test ZIP without a certificate or notarization. Safari developer settings are required and fresh-Mac app-group behavior is not guaranteed; see [the Chinese test-package guide](AD-HOC-INSTALL.zh-CN.md). It does not install or launch the app.

`./scripts/build.sh --unsigned` performs compile checks only. It intentionally does not create a signed distribution ZIP.

## 4. Enable the extension

Copy `build.noindex/DerivedData/Build/Products/Release/Safari-Codex-Bridge.app` to Applications and open it. In Safari Settings → Extensions, enable Safari Codex Bridge and grant the sites you intend to use. You can grant all websites; a specific site’s Deny still overrides that general setting. Click the Safari toolbar button to open the sidebar.

The companion window offers a persistent Simplified Chinese / English language picker. It defaults to the system language and also changes the optional menu-bar menu. Sidebar language remains a separate preference.

Keep the companion running for chat and optional MCP access. Its window can close without stopping it. The menu-bar icon is hidden by default and can be enabled from the connection window. Pinning automatically opens the sidebar only on websites Safari already permits.

## 5. Search and Work

The **+** menu contains the Chat/Work selector and web-search toggle. Chat enables official search by default while keeping local file/code tools disabled. Work can start without folder setup. The native helper creates a separate folder for the chat on its first task; use **+ → Choose folder** only to work with existing local files. The **Files** link reveals the current folder in Finder, and the + menu shows its full path. The sidebar shows protected-operation approvals and expandable tool records.

Work uses workspace-write/on-request: ordinary sandboxed file and code operations can execute in the working folder without a separate approval; protected/outside-sandbox operations request permission. Decline cancels that requested operation; Stop interrupts the turn and pending approvals. The official sandbox permits reads outside the folder where macOS allows, so the folder is not a complete read-isolation boundary. No new Accessibility permission is required for Work. Review context and the task before sending.

Temporary chats cannot change mode, search or folder after their first turn; create a new temporary chat instead. Saved chats support these changes between turns.

## 6. Optional official dictation

In the official Codex desktop app, configure Settings → Voice → Dictation → Advanced → **Single tap shortcut**, for example `Ctrl+Option+D`. Enter exactly the same keybinding in the sidebar settings and select Single tap mode. Grant **Safari Chat Helper** Accessibility access in macOS Privacy & Security only if you want this feature.

Click the microphone, speak, then click it again to dispatch the finishing shortcut. Codex transcribes into the focused Safari composer; edit the text before sending. This local toggle cannot observe official recording state. If you stop via a different shortcut or close/navigate the sidebar, use the official Codex controls to finish or cancel recording. Some Codex versions or input methods may change insertion behavior.

## 7. Optional MCP in an existing Codex chat

This is separate from the webpage sidebar and is not required for sidebar chat. In the connection window choose **Save Codex local connection configuration**, saving the suggested file to `~/Documents/Safari-Codex-connection.json`. It contains a local pairing secret; never commit it.

From the cloned repository:

```sh
codex mcp add safari-context -- python3 "$PWD/codex-plugin/server/server.py"   --connection-file "$HOME/Documents/Safari-Codex-connection.json"
```

Restart/reconnect Codex’s MCP tools if needed. Ask for the current Safari page; avoid listing unrelated tabs. For plugin packaging, `codex-plugin/mcp.json` uses a package-relative working directory and the same default pairing location. The manual `codex mcp add` method is the documented setup path for this release.

## Distribution

A development signature is for local use, not a completed public release process. For normal distribution outside the Mac App Store, follow [Apple’s Developer ID signing and notarization requirements](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension). Never upload your certificate/private key, login state, or exported pairing file with the app.

The companion app hides its Dock icon by default. Reopen it from Applications to change settings; enable **Show in Dock** to keep the icon visible. Closing its window keeps the connection running. Build outputs use `build.noindex/` so Spotlight does not list development copies.
