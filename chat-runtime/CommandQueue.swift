import Foundation

// The native extension overwrites expires_at for every request. Do not use
// directory enumeration order or a webpage-supplied sequence number.
func bridgeCommandPrecedes(_ lhs: (URL, [String: Any]), _ rhs: (URL, [String: Any])) -> Bool {
    let left = lhs.1["expires_at"] as? Double ?? 0
    let right = rhs.1["expires_at"] as? Double ?? 0
    return left == right ? lhs.0.lastPathComponent < rhs.0.lastPathComponent : left < right
}
