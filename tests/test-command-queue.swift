import Foundation

@main struct QueueTests {
    static func main() {
        let reset = (URL(fileURLWithPath: "/fixture/z.json"), ["expires_at": 100.0, "action": "reset"] as [String: Any])
        let choose = (URL(fileURLWithPath: "/fixture/a.json"), ["expires_at": 100.1, "action": "choose_workspace"] as [String: Any])
        precondition([choose, reset].sorted(by: bridgeCommandPrecedes).first?.1["action"] as? String == "reset")
        precondition(!bridgeCommandPrecedes(choose, reset))
        let tie = (URL(fileURLWithPath: "/fixture/a.json"), reset.1)
        precondition(bridgeCommandPrecedes(tie, reset))
        precondition(!bridgeCommandPrecedes(reset, reset))
        print("4 checks passed: native queue chronology and stable ordering.")
    }
}
