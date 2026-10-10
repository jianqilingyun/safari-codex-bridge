import Foundation

@main struct WorkspaceTests {
    static func main() throws {
        let fm = FileManager.default
        let base = fm.temporaryDirectory.resolvingSymlinksInPath().appendingPathComponent("bridge-work-test-" + UUID().uuidString)
        defer { try? fm.removeItem(at: base) }
        let session = UUID().uuidString
        let saved = try bridgeManagedWorkspace(base: base, session: session, temporary: false)
        precondition(fm.fileExists(atPath: saved.path))
        let reused = try bridgeManagedWorkspace(base: base, session: session, temporary: false)
        precondition(saved.path == reused.path)
        let another = try bridgeManagedWorkspace(base: base, session: UUID().uuidString, temporary: false)
        precondition(saved.path != another.path)
        let temporary = try bridgeManagedWorkspace(base: base, session: session, temporary: true)
        precondition(saved.path != temporary.path)
        do { _ = try bridgeManagedWorkspace(base: base, session: "../../elsewhere", temporary: false); fatalError("accepted invalid session") } catch {}
        let linkedSession = UUID().uuidString
        let link = base.appendingPathComponent("saved/" + linkedSession.lowercased())
        try fm.createSymbolicLink(at: link, withDestinationURL: another)
        do { _ = try bridgeManagedWorkspace(base: base, session: linkedSession, temporary: false); fatalError("accepted symlink") } catch {}
        print("6 checks passed: managed workspace reuse, per-chat isolation, temporary separation and path rejection.")
    }
}
