import Foundation

// The native helper supplies base; browser messages may supply only a UUID.
func bridgeManagedWorkspace(base: URL, session: String, temporary: Bool) throws -> URL {
    guard let uuid = UUID(uuidString: session) else {
        throw NSError(domain: "BridgeWorkspace", code: 1)
    }
    let directory = base.appendingPathComponent(temporary ? "temporary" : "saved")
        .appendingPathComponent(uuid.uuidString.lowercased()).standardizedFileURL
    // Refuse an existing symlink before creating directories or writing files.
    guard directory.resolvingSymlinksInPath().path == directory.path else {
        throw NSError(domain: "BridgeWorkspace", code: 2)
    }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    guard try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]).isDirectory == true else {
        throw NSError(domain: "BridgeWorkspace", code: 3)
    }
    return directory
}
