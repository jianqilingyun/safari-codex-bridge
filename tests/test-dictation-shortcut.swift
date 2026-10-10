import Cocoa

@main struct ShortcutTests {
    static func main() {
        let valid = ["Ctrl+Option+D", "Cmd+Shift+D", "control+alt+space", "Cmd+Ctrl+Option+Shift+1"]
        for value in valid { precondition(DictationController.parseShortcut(value) != nil, value) }
        let invalid = ["", "D", "Ctrl+D", "fn", "Cmd+Cmd+D", "Cmd+Command+D", "Cmd+Shift+Enter", "Cmd+Shift+Delete", "Ctrl+Option+Escape", "Cmd+Shift+arbitrary", "Cmd+Shift+D+X"]
        for value in invalid { precondition(DictationController.parseShortcut(value) == nil, value) }
        let session = UUID().uuidString, id = UUID().uuidString
        var events: [[String: Any]] = []
        let controller = DictationController { events.append($0) }
        precondition(controller.handle(["id":id,"session":session,"action":"dictate_start","shortcut":""]))
        precondition(events.last?["event"] as? String == "error")
        let cancelled = UUID().uuidString
        precondition(controller.handle(["id":UUID().uuidString,"session":session,"action":"dictate_cancel","recording_id":cancelled]))
        precondition(controller.handle(["id":cancelled,"session":session,"action":"dictate_start","shortcut":"Ctrl+Option+D"]))
        precondition(events.last?["cancelled"] as? Bool == true)
        precondition(controller.handle(["id":UUID().uuidString,"session":session,"action":"dictate_finish","shortcut_mode":"double","shortcut":"Ctrl+Option+D"]))
        precondition(events.last?["event"] as? String == "error")
        let cancelledFinish = UUID().uuidString
        precondition(controller.handle(["id":UUID().uuidString,"session":session,"action":"dictate_cancel","recording_id":cancelledFinish]))
        precondition(controller.handle(["id":cancelledFinish,"session":session,"action":"dictate_finish","shortcut_mode":"single","shortcut":"Ctrl+Option+D"]))
        precondition(events.last?["cancelled"] as? Bool == true)
        print("19 checks passed: shortcut validation and cancelled dispatch. No real keys, microphone or Codex UI used.")
    }
}
