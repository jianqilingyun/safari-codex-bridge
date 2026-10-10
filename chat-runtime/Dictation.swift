import Cocoa
import ApplicationServices

// Invoke only the user-configured official desktop global dictation shortcut.
// This component never records audio, reads tokens or calls private endpoints.
final class DictationController {
    private var pending: [String: String] = [:]
    private var cancelledStarts = Set<String>()
    private let emit: ([String: Any]) -> Void
    init(emit: @escaping ([String: Any]) -> Void) { self.emit = emit }
    func handle(_ command: [String: Any]) -> Bool {
        guard let action = command["action"] as? String, action.hasPrefix("dictate_"),
              let id = command["id"] as? String, let session = command["session"] as? String else { return false }
        if action != "dictate_start" && action != "dictate_finish" {
            if let recordingID = command["recording_id"] as? String, UUID(uuidString: recordingID) != nil {
                cancelledStarts.insert(recordingID)
                if pending.removeValue(forKey: recordingID) != nil { emit(["id": recordingID, "event": "stopped", "cancelled": true]) }
                if cancelledStarts.count > 100 { cancelledStarts.removeAll(); cancelledStarts.insert(recordingID) }
            }
            emit(["id": id, "event": "ack"]); return true
        }
        if action == "dictate_finish" && command["shortcut_mode"] as? String != "single" {
            emit(["id": id, "event": "error", "error": "侧栏结束按钮需要 Codex 的 Single tap 听写快捷键。"]); return true
        }
        if cancelledStarts.remove(id) != nil { emit(["id": id, "event": "stopped", "cancelled": true]); return true }
        guard let shortcut = command["shortcut"] as? String, let chord = Self.parseShortcut(shortcut) else {
            emit(["id": id, "event": "error", "error": "请先在更多菜单设置与 Codex 一致的听写快捷键。"]); return true
        }
        guard NSRunningApplication.runningApplications(withBundleIdentifier: "com.openai.codex").contains(where: { !$0.isTerminated }) else {
            emit(["id": id, "event": "error", "error": "请先运行 Codex，并在 Settings → Voice 开启全局听写。"]); return true
        }
        guard AXIsProcessTrusted() else {
            emit(["id": id, "event": "error", "error": "一键调用需要在系统设置 → 隐私与安全性 → 辅助功能中允许 Safari Chat Helper；也可直接按 Codex 听写快捷键。"]); return true
        }
        pending[id] = session
        // Keep Safari foreground and leave the editable composer focused.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            guard let self = self, self.pending.removeValue(forKey: id) != nil else { return }
            guard NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.apple.Safari" else {
                self.emit(["id": id, "event": "error", "error": "请回到 Safari 输入框后再点击 Dictate。"]); return
            }
            Self.tap(chord)
            if command["shortcut_mode"] as? String == "double" {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
                    guard NSWorkspace.shared.frontmostApplication?.bundleIdentifier == "com.apple.Safari" else { return }
                    Self.tap(chord)
                }
            }
            self.emit(["id": id, "event": "ack", "handed_off": true])
        }
        return true
    }
    struct Chord { let key: CGKeyCode; let flags: CGEventFlags }
    static func parseShortcut(_ value: String) -> Chord? {
        let parts = value.lowercased().split(separator: "+").map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count >= 3, parts.count <= 5, let keyName = parts.last else { return nil }
        let keys: [String: CGKeyCode] = ["a":0,"s":1,"d":2,"f":3,"h":4,"g":5,"z":6,"x":7,"c":8,"v":9,"b":11,"q":12,"w":13,"e":14,"r":15,"y":16,"t":17,"1":18,"2":19,"3":20,"4":21,"6":22,"5":23,"9":25,"7":26,"8":28,"0":29,"o":31,"u":32,"i":34,"p":35,"l":37,"j":38,"k":40,"n":45,"m":46,"space":49]
        guard let key = keys[keyName] else { return nil }
        var flags = CGEventFlags(), seen = Set<String>()
        for part in parts.dropLast() {
            let canonical: String, flag: CGEventFlags
            switch part {
            case "cmd", "command": canonical = "cmd"; flag = .maskCommand
            case "ctrl", "control": canonical = "ctrl"; flag = .maskControl
            case "option", "alt": canonical = "option"; flag = .maskAlternate
            case "shift": canonical = "shift"; flag = .maskShift
            default: return nil
            }
            guard seen.insert(canonical).inserted else { return nil }
            flags.insert(flag)
        }
        // A deliberate multi-modifier chord is required, not ordinary typing.
        guard seen.count >= 2 else { return nil }
        return Chord(key: key, flags: flags)
    }
    private static func tap(_ chord: Chord) {
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: chord.key, keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: chord.key, keyDown: false) else { return }
        down.flags = chord.flags; up.flags = chord.flags
        down.post(tap: .cghidEventTap); up.post(tap: .cghidEventTap)
    }
    func cancel(session: String? = nil) {
        for (id, owner) in pending where session == nil || session == owner {
            pending.removeValue(forKey: id); emit(["id": id, "event": "stopped", "cancelled": true])
        }
    }
}
