# Contributing

Use a branch and a pull request. Describe the observed behavior, your change, and the checks run. Do not include personal webpages, credentials, live chat history or signed app bundles in a patch.

## Local checks

```sh
npm ci
npx playwright install chromium
npm run test:python
npm test
./scripts/build.sh --unsigned
```

The Python suite uses standard-library fixtures; JavaScript transport tests use mocks; browser layout tests use Chromium and synthetic pages. They exercise privacy boundaries, per-tab sessions, pin/dictation handoff, language, text size and hover geometry. They are not Safari end-to-end tests. `npm run test:webkit` is optional and requires `npx playwright install webkit`; WebKit builds have crashed on some local macOS configurations.

On macOS, check shortcut parsing without pressing keys or recording:

```sh
swiftc -parse-as-library -framework Cocoa -framework ApplicationServices   chat-runtime/Dictation.swift tests/test-dictation-shortcut.swift -o /tmp/bridge-shortcut-tests
/tmp/bridge-shortcut-tests
```

Live checks are **opt-in**: `tests/test-chat-live.py` sends a synthetic page/image through your signed-in account and consumes model usage. Run the UI suite first to generate `tests/fixture-viewport.png`. `tests/test-persistence-live.py` creates a saved test thread; manage it afterward in Codex. `tests/test_live.py` reads the currently visible Safari webpage and needs the exported pairing file. Do not run them against private material or in public CI. Set `SAFARI_CODEX_CONNECTION_FILE` when the pairing file is outside Documents.

## Architecture

`extension/` owns collection and isolated UI; `native/` owns the sandboxed host and native Safari handler; `chat-runtime/` owns official app-server transport and optional dictation shortcut dispatch; `codex-plugin/` contains the optional read-only MCP server. `scripts/build.sh` packages them without installing or starting the application.

Use documented app-server messages, discover model/effort values dynamically, keep tools disabled, treat webpage data as references, and test compatibility with the runtime you used. Keep generated artifacts ignored.
