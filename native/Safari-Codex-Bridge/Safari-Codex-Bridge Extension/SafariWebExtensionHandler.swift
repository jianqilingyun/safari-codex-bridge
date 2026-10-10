import SafariServices
import Foundation

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private let groupID = Bundle.main.object(forInfoDictionaryKey: "BridgeAppGroup") as? String ?? ""
    func beginRequest(with context: NSExtensionContext) {
        var reply: [String: Any] = ["ok": false]
        do {
            guard let item = context.inputItems.first as? NSExtensionItem,
                  let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any],
                  let type = message["type"] as? String,
                  let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID) else {
                throw NSError(domain: "SafariCodexBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: "消息或共享目录不可用"])
            }
            let root = group.appendingPathComponent("context-bridge")
            switch type {
            case "chat_request":
                guard let request = message["request"] as? [String: Any],
                      let id = request["id"] as? String, UUID(uuidString: id) != nil,
                      let action = request["action"] as? String, ["catalog", "chat", "history", "stop", "reset", "dictate_start", "dictate_finish", "dictate_stop", "dictate_cancel"].contains(action),
                      let session = request["session"] as? String, UUID(uuidString: session) != nil else {
                    throw NSError(domain: "SafariCodexBridge", code: 6)
                }
                let host = (try? JSONSerialization.jsonObject(with: Data(contentsOf: root.appendingPathComponent("chat-host.json")))) as? [String: Any]
                guard Date().timeIntervalSince1970 - (host?["updated_at"] as? Double ?? 0) < 6 else {
                    throw NSError(domain: "SafariCodexBridge", code: 7, userInfo: [NSLocalizedDescriptionKey: "请先打开 Safari Codex Bridge 连接应用。"])
                }
                let queue = root.appendingPathComponent("chat-commands")
                try FileManager.default.createDirectory(at: queue, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
                var command = request; command["expires_at"] = Date().timeIntervalSince1970 + 30
                try save(command, to: queue.appendingPathComponent("\(id).json"))
                reply = ["ok": true, "id": id]
            case "chat_poll":
                guard let id = message["id"] as? String, UUID(uuidString: id) != nil else { throw NSError(domain: "SafariCodexBridge", code: 8) }
                let path = root.appendingPathComponent("chat-events/\(id).json")
                if let data = try? Data(contentsOf: path), var state = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
                    state.removeValue(forKey: "messages"); state.removeValue(forKey: "order")
                    reply = ["ok": true, "state": state]
                } else { reply = ["ok": true, "state": ["finished": false, "revision": 0]] }
            case "chat_open_desktop":
                guard let thread = message["thread_id"] as? String, UUID(uuidString: thread) != nil else { throw NSError(domain: "SafariCodexBridge", code: 9) }
                // The main app owns opening Codex; the extension remains sandboxed.
                try save(["thread_id": thread], to: root.appendingPathComponent("open-desktop.json"))
                reply = ["ok": true]
            case "status":
                let hostURL = root.appendingPathComponent("host.json")
                let host = (try? JSONSerialization.jsonObject(with: Data(contentsOf: hostURL))) as? [String: Any]
                let updated = host?["updated_at"] as? Double ?? 0
                reply = ["ok": true, "ready": Date().timeIntervalSince1970 - updated < 5]
            case "response":
                guard let id = message["id"] as? String, UUID(uuidString: id) != nil,
                      FileManager.default.fileExists(atPath: root.appendingPathComponent("commands/\(id).json").path) else {
                    throw NSError(domain: "SafariCodexBridge", code: 2, userInfo: [NSLocalizedDescriptionKey: "请求已过期或不存在"])
                }
                var value = message; value.removeValue(forKey: "type")
                try save(value, to: root.appendingPathComponent("responses/\(id).json")); reply = ["ok": true]
            case "share":
                guard let page = message["page"] as? [String: Any] else { throw NSError(domain: "SafariCodexBridge", code: 3) }
                // Explicit toolbar sharing works even while the companion is closed.
                try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
                try save(page, to: root.appendingPathComponent("shared-page.json")); reply = ["ok": true]
            default: throw NSError(domain: "SafariCodexBridge", code: 4)
            }
        } catch { reply = ["ok": false, "error": error.localizedDescription] }
        let response = NSExtensionItem(); response.userInfo = [SFExtensionMessageKey: reply]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    private func save(_ value: Any, to url: URL) throws {
        let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
        guard data.count <= 16000000 else { throw NSError(domain: "SafariCodexBridge", code: 5) }
        try data.write(to: url, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }
}
