import Cocoa
import SafariServices
import Network
import Security

// The companion window has its own preference; sidebar language remains independent.
enum HostLanguage {
    static let changed = Notification.Name("BridgeHostLanguageChanged")
    static var code: String {
        let saved = UserDefaults.standard.string(forKey: "hostInterfaceLanguage")
        if saved == "zh" || saved == "en" { return saved! }
        return Locale.preferredLanguages.first?.hasPrefix("zh") == true ? "zh" : "en"
    }
    static func text(_ chinese: String, _ english: String) -> String {
        code == "zh" ? chinese : english
    }
    static func select(_ code: String) {
        guard code == "zh" || code == "en" else { return }
        UserDefaults.standard.set(code, forKey: "hostInterfaceLanguage")
        NotificationCenter.default.post(name: changed, object: nil)
    }
}

let bridgeGroup = Bundle.main.object(forInfoDictionaryKey: "BridgeAppGroup") as? String ?? ""
let extensionBundleIdentifier = Bundle.main.object(forInfoDictionaryKey: "BridgeExtensionIdentifier") as? String ?? ""

func bridgeDirectory() throws -> URL {
    guard let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: bridgeGroup) else {
        throw NSError(domain: "SafariCodexBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: HostLanguage.text("无法打开本地共享目录", "Unable to open the local shared folder")])
    }
    let root = group.appendingPathComponent("context-bridge", isDirectory: true)
    for name in ["", "commands", "responses"] {
        let dir = name.isEmpty ? root : root.appendingPathComponent(name, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    }
    return root
}
func writeJSON(_ value: Any, to url: URL) throws {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    try data.write(to: url, options: .atomic)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
}

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    private var timer: Timer?
    private var sent = Set<String>()
    private var root: URL?
    private var lastHeartbeat: TimeInterval = 0
    private var lastHelperCheck: TimeInterval = 0
    private var statusItem: NSStatusItem?
    var showsMenuBarItem: Bool {
        UserDefaults.standard.bool(forKey: "showsMenuBarItem")
    }
    func setShowsMenuBarItem(_ visible: Bool) {
        UserDefaults.standard.set(visible, forKey: "showsMenuBarItem")
        updateMenuBarItem()
    }
    private func updateMenuBarItem() {
        guard showsMenuBarItem else {
            if let item = statusItem { NSStatusBar.system.removeStatusItem(item) }
            statusItem = nil
            return
        }
        if statusItem == nil { statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength) }
        statusItem?.button?.title = "Safari ↔ Codex"
        let menu = NSMenu()
        menu.addItem(withTitle: HostLanguage.text("显示连接窗口", "Show Connection Window"), action: #selector(showWindow), keyEquivalent: "")
        menu.addItem(withTitle: HostLanguage.text("Safari 扩展设置", "Safari Extension Settings"), action: #selector(openPreferences), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: HostLanguage.text("退出连接", "Quit Bridge"), action: #selector(quit), keyEquivalent: "q")
        menu.items.forEach { $0.target = self }
        statusItem?.menu = menu
    }
    var setupError: String?
    private var localServer: LocalBridgeServer?
    var connectionSettings: [String: Any]?
    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            root = try bridgeDirectory()
            let saved = root!.appendingPathComponent("connection.json")
            if let data = try? Data(contentsOf: saved), let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
               let token = value["token"] as? String,
               token.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil,
               value["url"] as? String == "http://127.0.0.1:53728" {
                connectionSettings = value
            } else {
                var bytes = [UInt8](repeating: 0, count: 32)
                guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw NSError(domain: "Bridge", code: 10) }
                let token = bytes.map { String(format: "%02x", $0) }.joined()
                connectionSettings = ["url": "http://127.0.0.1:53728", "token": token]
                try writeJSON(connectionSettings!, to: saved)
            }
            localServer = try LocalBridgeServer(root: root!, token: connectionSettings!["token"] as! String)
            localServer?.start()
        } catch { setupError = error.localizedDescription }
        NotificationCenter.default.addObserver(self, selector: #selector(refreshLanguage), name: HostLanguage.changed, object: nil)
        updateMenuBarItem()
        timer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { [weak self] _ in self?.poll() }
        poll()
    }
    @objc private func refreshLanguage() { updateMenuBarItem() }
    @objc func showWindow() { NSApp.activate(ignoringOtherApps: true); NSApp.windows.first?.makeKeyAndOrderFront(nil) }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { showWindow(); return true }
    @objc func openPreferences() { SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in } }
    @objc func quit() { NSApp.terminate(nil) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationWillTerminate(_ notification: Notification) {
        if let root = root { try? FileManager.default.removeItem(at: root.appendingPathComponent("host.json")) }
    }
    private func poll() {
        guard let root = root else { return }
        let now = Date().timeIntervalSince1970
        let desktopRequest = root.appendingPathComponent("open-desktop.json")
        if let data = try? Data(contentsOf: desktopRequest),
           let request = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
           let thread = request["thread_id"] as? String, UUID(uuidString: thread) != nil {
            try? FileManager.default.removeItem(at: desktopRequest)
            if let url = URL(string: "codex://threads/\(thread)?hostId=local") {
                let opened = NSWorkspace.shared.open(url)
                try? writeJSON(["thread_id": thread, "accepted": opened, "updated_at": now], to: root.appendingPathComponent("desktop-open-result.json"))
            }
        }
        if now - lastHeartbeat > 1 {
            try? writeJSON(["version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown", "updated_at": now, "pid": ProcessInfo.processInfo.processIdentifier], to: root.appendingPathComponent("host.json"))
            lastHeartbeat = now
        }
        if now - lastHelperCheck > 5 {
            lastHelperCheck = now
            let helperState = root.appendingPathComponent("chat-host.json")
            let value = (try? Data(contentsOf: helperState)).flatMap { (try? JSONSerialization.jsonObject(with: $0)) as? [String: Any] }
            if now - (value?["updated_at"] as? Double ?? 0) > 5 {
                let helper = Bundle.main.bundleURL.appendingPathComponent("Contents/Library/LoginItems/SafariChatHelper.app")
                let options = NSWorkspace.OpenConfiguration(); options.activates = false
                NSWorkspace.shared.openApplication(at: helper, configuration: options) { _, _ in }
            }
        }
        let commands = root.appendingPathComponent("commands")
        let responses = root.appendingPathComponent("responses")
        let files = (try? FileManager.default.contentsOfDirectory(at: commands, includingPropertiesForKeys: nil)) ?? []
        for file in files where file.pathExtension == "json" {
            guard let data = try? Data(contentsOf: file), data.count < 10000,
                  let command = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                  let id = command["id"] as? String, UUID(uuidString: id) != nil,
                  file.lastPathComponent == "\(id).json", let expires = command["expires_at"] as? Double else { continue }
            let response = responses.appendingPathComponent("\(id).json")
            if FileManager.default.fileExists(atPath: response.path) { try? FileManager.default.removeItem(at: file); sent.remove(id); continue }
            if expires < now {
                try? writeJSON(["id": id, "error": "Safari 未及时响应。请确认 Safari 和此应用正在运行、扩展已启用且网站权限已授予。"], to: response)
                try? FileManager.default.removeItem(at: file); sent.remove(id); continue
            }
            if sent.contains(id) { continue }
            sent.insert(id)
            SFSafariApplication.dispatchMessage(withName: "codex-context-request", toExtensionWithIdentifier: extensionBundleIdentifier, userInfo: command) { [weak self] error in
                if let error = error {
                    try? writeJSON(["id": id, "error": "无法连接 Safari 扩展：\(error.localizedDescription)"], to: response)
                    try? FileManager.default.removeItem(at: file)
                    DispatchQueue.main.async { self?.sent.remove(id) }
                }
            }
        }
        // Responses contain transient webpage data, not a browsing-history archive.
        for file in (try? FileManager.default.contentsOfDirectory(at: responses, includingPropertiesForKeys: [.contentModificationDateKey])) ?? [] {
            if let date = try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate, now - date.timeIntervalSince1970 > 90 {
                try? FileManager.default.removeItem(at: file)
            }
        }
        let share = root.appendingPathComponent("shared-page.json")
        if let date = try? share.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate, now - date.timeIntervalSince1970 > 1800 {
            try? FileManager.default.removeItem(at: share)
        }
    }
}


// MCP talks to an authenticated loopback endpoint. The app group never becomes
// exposed to webpage JavaScript; other software running as the same user must
// still be trusted. Safari responses stay in the app group.
class LocalBridgeServer {
    private let listener: NWListener
    private let queue = DispatchQueue(label: "SafariCodexBridge.local", attributes: .concurrent)
    private let root: URL
    private let token: String
    private let permits = DispatchSemaphore(value: 4)
    init(root: URL, token: String) throws {
        self.root = root; self.token = token
        let params = NWParameters.tcp
        params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: 53728)
        listener = try NWListener(using: params)
    }
    func start() {
        listener.newConnectionHandler = { [weak self] connection in
            guard let self = self else { connection.cancel(); return }
            connection.start(queue: self.queue)
            self.receive(connection, buffer: Data())
        }
        listener.start(queue: queue)
    }
    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 20000) { [weak self] data, _, complete, error in
            guard let self = self, error == nil else { connection.cancel(); return }
            var bytes = buffer; if let data = data { bytes.append(data) }
            guard bytes.count <= 20000 else { self.send(connection, status: 413, value: ["error": "Request too large"]); return }
            guard let marker = bytes.range(of: Data("\r\n\r\n".utf8)) else {
                if complete { connection.cancel() } else { self.receive(connection, buffer: bytes) }; return
            }
            guard let header = String(data: bytes[..<marker.lowerBound], encoding: .utf8) else { connection.cancel(); return }
            let lines = header.components(separatedBy: "\r\n")
            var headers = [String: String]()
            for line in lines.dropFirst() {
                let pair = line.split(separator: ":", maxSplits: 1).map(String.init)
                if pair.count == 2 { headers[pair[0].lowercased()] = pair[1].trimmingCharacters(in: .whitespaces) }
            }
            guard lines.first == "POST /rpc HTTP/1.1", headers["host"] == "127.0.0.1:53728", headers["origin"] == nil,
                  headers["authorization"] == "Bearer \(self.token)", let size = Int(headers["content-length"] ?? ""), size > 0, size < 12000 else {
                self.send(connection, status: 403, value: ["error": "Unauthorized local connection"]); return
            }
            let body = Data(bytes[marker.upperBound...])
            if body.count < size {
                if complete { connection.cancel() } else { self.receive(connection, buffer: bytes) }; return
            }
            guard body.count == size, let request = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any] else {
                self.send(connection, status: 400, value: ["error": "Invalid request"]); return
            }
            guard self.permits.wait(timeout: .now()) == .success else {
                self.send(connection, status: 429, value: ["error": "Too many local requests"]); return
            }
            self.queue.async {
                defer { self.permits.signal() }
                self.send(connection, status: 200, value: self.process(request))
            }
        }
    }
    private func process(_ request: [String: Any]) -> [String: Any] {
        guard let action = request["action"] as? String else { return ["error": "Missing action"] }
        if action == "host_status" {
            var result: [String: Any] = ["version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown", "running": true]
            if let data = try? Data(contentsOf: root.appendingPathComponent("chat-host.json")), let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
                result["chat_helper"] = ["version": value["version"] ?? "unknown", "heartbeat_age_seconds": Date().timeIntervalSince1970 - (value["updated_at"] as? Double ?? 0), "folder_chooser_open": value["folder_chooser_open"] ?? false, "workspace_count": value["workspace_count"] ?? 0]
            }
            let eventFiles = (try? FileManager.default.contentsOfDirectory(at: root.appendingPathComponent("chat-events"), includingPropertiesForKeys: nil)) ?? []
            let eventStates = eventFiles.prefix(200).compactMap { url -> [String: Any]? in
                guard let data = try? Data(contentsOf: url) else { return nil }
                return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            }
            result["chat_events"] = ["pending": eventStates.filter { $0["finished"] as? Bool != true }.count, "completed_folder_selections": eventStates.filter { $0["event"] as? String == "workspace" && $0["finished"] as? Bool == true }.count]
            if let data = try? Data(contentsOf: root.appendingPathComponent("desktop-open-result.json")), let value = try? JSONSerialization.jsonObject(with: data) { result["last_desktop_open"] = value }
            return ["result": result]
        }
        if action == "get_shared_page" {
            let path = root.appendingPathComponent("shared-page.json")
            guard let attributes = try? FileManager.default.attributesOfItem(atPath: path.path),
                  let date = attributes[.modificationDate] as? Date, Date().timeIntervalSince(date) < 1800,
                  let data = try? Data(contentsOf: path), var page = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
                return ["error": "暂无有效的已分享网页，请在 Safari 工具栏重新分享。"]
            }
            page["snapshot"] = true; page["snapshot_note"] = "工具栏分享时的副本，不代表 Safari 当前网页。"
            return ["result": page]
        }
        guard ["status", "list_tabs", "read_page", "capture_visible_page", "read_image", "compare_tabs"].contains(action),
              let args = request["args"] as? [String: Any] else { return ["error": "Unsupported read-only command"] }
        let id = UUID().uuidString.lowercased()
        let command = root.appendingPathComponent("commands/\(id).json")
        let response = root.appendingPathComponent("responses/\(id).json")
        defer { try? FileManager.default.removeItem(at: command); try? FileManager.default.removeItem(at: response) }
        do {
            try writeJSON(["id": id, "action": action, "args": args, "expires_at": Date().timeIntervalSince1970 + 22], to: command)
            let deadline = Date().addingTimeInterval(24)
            while Date() < deadline {
                if let data = try? Data(contentsOf: response), let result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] { return result }
                Thread.sleep(forTimeInterval: 0.05)
            }
            return ["error": "Safari 连接超时，请确认扩展已启用及网页权限已授予。"]
        } catch { return ["error": "本地连接文件处理失败。"] }
    }
    private func send(_ connection: NWConnection, status: Int, value: [String: Any]) {
        guard let body = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) else { connection.cancel(); return }
        let header = "HTTP/1.1 \(status) Response\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: \(body.count)\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n"
        connection.send(content: Data(header.utf8) + body, completion: .contentProcessed { _ in connection.cancel() })
    }
}
