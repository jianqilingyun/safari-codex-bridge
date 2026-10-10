import Cocoa

// This signed, background-only companion owns the same app group. Only the
// official Codex executable manages authentication; no token files are read here.
@main
class ChatHelper: NSObject, NSApplicationDelegate {
    static func main() {
        let app = NSApplication.shared
        let delegate = ChatHelper()
        app.delegate = delegate
        app.run()
    }
    private var root: URL!
    private var timer: Timer?
    private var process: Process?
    private var input: FileHandle?
    private var buffer = Data()
    private var states: [String: [String: Any]] = [:]
    private var parentPID: pid_t = 0
    private let appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
    private var lastActivity = Date()
    private lazy var dictation = DictationController { [weak self] value in self?.event(value) }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.prohibited)
        guard let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Bundle.main.object(forInfoDictionaryKey: "BridgeAppGroup") as? String ?? "") else { NSApp.terminate(nil); return }
        root = group.appendingPathComponent("context-bridge")
        for name in ["chat-commands", "chat-events"] {
            try? FileManager.default.createDirectory(at: root.appendingPathComponent(name), withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        }
        if let host = load(root.appendingPathComponent("host.json")), let pid = host["pid"] as? Int { parentPID = pid_t(pid) }
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in self?.poll() }
    }
    private func startWorker() throws {
        if process?.isRunning == true { return }
        let p = Process(); p.executableURL = URL(fileURLWithPath: ProcessInfo.processInfo.environment["SAFARI_CODEX_PYTHON"] ?? "/usr/bin/python3")
        guard let resource = Bundle.main.resourceURL else { throw NSError(domain: "Sidebar", code: 1) }
        p.arguments = ["-u", resource.appendingPathComponent("worker.py").path]
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        if let desktop = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.openai.codex") { env["SAFARI_CODEX_DESKTOP_PATH"] = desktop.path }
        let workspace = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Documents/Codex/Safari网页问答")
        try FileManager.default.createDirectory(at: workspace, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        env["SAFARI_CODEX_WORKSPACE"] = workspace.path
        env["SAFARI_CODEX_FALLBACK"] = resource.appendingPathComponent("runtime/codex").path
        p.environment = env
        let stdin = Pipe(), stdout = Pipe(); p.standardInput = stdin; p.standardOutput = stdout
        p.standardError = FileHandle.nullDevice
        stdout.fileHandleForReading.readabilityHandler = { [weak self] file in
            let data = file.availableData
            if data.isEmpty { file.readabilityHandler = nil; return }
            DispatchQueue.main.async { self?.receive(data) }
        }
        p.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self else { return }
                for (id, value) in self.states where value["finished"] as? Bool != true {
                    self.event(["id": id, "event": "error", "error": "问答后台已关闭，请重试。"])
                }
            }
        }
        try p.run(); process = p; input = stdin.fileHandleForWriting
    }
    private func receive(_ data: Data) {
        buffer.append(data)
        while let end = buffer.firstIndex(of: 10) {
            let line = buffer[..<end]; buffer.removeSubrange(...end)
            if let value = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any] { event(value) }
        }
        if buffer.count > 16_000_000 { buffer.removeAll() }
    }
    private func event(_ value: [String: Any]) {
        guard let id = value["id"] as? String, UUID(uuidString: id) != nil, var state = states[id] else { return }
        state["updated_at"] = Date().timeIntervalSince1970
        state["revision"] = (state["revision"] as? Int ?? 0) + 1
        let kind = value["event"] as? String ?? "error"
        state["event"] = kind
        for key in ["cancelled", "handed_off"] { if let v = value[key] { state[key] = v } }
        if let thread = value["thread_id"] as? String { state["thread_id"] = thread }
        if kind == "delta" || kind == "message" {
            var messages = state["messages"] as? [String: String] ?? [:]
            var order = state["order"] as? [String] ?? []
            let item = value["item_id"] as? String ?? "answer"
            if messages[item] == nil { order.append(item) }
            messages[item] = kind == "delta" ? (messages[item] ?? "") + (value["delta"] as? String ?? "") : value["text"] as? String ?? ""
            state["messages"] = messages; state["order"] = order
            state["text"] = order.compactMap { messages[$0] }.joined(separator: "\n\n")
        }
        if ["done", "stopped", "error", "catalog", "history", "ack"].contains(kind) {
            state["finished"] = true
            for key in ["text", "error", "authenticated", "auth_type", "plan", "models", "runtime", "history", "title"] {
                if let v = value[key], !(v is NSNull) { state[key] = v }
            }
        }
        states[id] = state
        save(state, root.appendingPathComponent("chat-events/\(id).json"))
    }
    private func poll() {
        let now = Date().timeIntervalSince1970
        if let host = load(root.appendingPathComponent("host.json")), let version = host["version"] as? String, version != appVersion { NSApp.terminate(nil); return }
        save(["updated_at": now, "version": appVersion], root.appendingPathComponent("chat-host.json"))
        if parentPID > 0 && kill(parentPID, 0) != 0 { NSApp.terminate(nil); return }
        let directory = root.appendingPathComponent("chat-commands")
        for file in (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? [] where file.pathExtension == "json" {
            guard let request = load(file), let id = request["id"] as? String, UUID(uuidString: id) != nil,
                  file.lastPathComponent == "\(id).json", let expires = request["expires_at"] as? Double else { continue }
            try? FileManager.default.removeItem(at: file)
            if request["action"] as? String == "reset", let session = request["session"] as? String {
                dictation.cancel(session: session)
                for (oldID, value) in states where value["session"] as? String == session {
                    states.removeValue(forKey: oldID)
                    try? FileManager.default.removeItem(at: root.appendingPathComponent("chat-events/\(oldID).json"))
                }
            }
            states[id] = ["id": id, "session": request["session"] ?? "", "revision": 0, "finished": false, "updated_at": now]
            if expires < now { event(["id": id, "event": "error", "error": "网页请求已过期，请重试。"]); continue }
            if dictation.handle(request) { lastActivity = Date(); continue }
            do {
                try startWorker()
                var data = try JSONSerialization.data(withJSONObject: request); data.append(10)
                try input?.write(contentsOf: data); lastActivity = Date()
            } catch { event(["id": id, "event": "error", "error": "问答后台启动失败：\(error.localizedDescription)"]) }
        }
        for (id, value) in states where value["finished"] as? Bool == true && now - (value["updated_at"] as? Double ?? now) > 600 {
            states.removeValue(forKey: id); try? FileManager.default.removeItem(at: root.appendingPathComponent("chat-events/\(id).json"))
        }
        // Clean transient results left by a previous helper process, too.
        for file in (try? FileManager.default.contentsOfDirectory(at: root.appendingPathComponent("chat-events"), includingPropertiesForKeys: [.contentModificationDateKey])) ?? [] {
            if let date = try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate, now - date.timeIntervalSince1970 > 600 {
                try? FileManager.default.removeItem(at: file)
            }
        }
    }
    private func load(_ url: URL) -> [String: Any]? {
        guard let data = try? Data(contentsOf: url), data.count < 16_000_000 else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }
    private func save(_ value: Any, _ url: URL) {
        guard let data = try? JSONSerialization.data(withJSONObject: value) else { return }
        try? data.write(to: url, options: .atomic)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }
    func applicationWillTerminate(_ notification: Notification) {
        dictation.cancel()
        try? input?.close(); process?.terminate()
        try? FileManager.default.removeItem(at: root.appendingPathComponent("chat-host.json"))
    }
}
