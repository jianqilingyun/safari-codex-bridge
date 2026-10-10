import Cocoa
import SafariServices

class ViewController: NSViewController {
    private let status = NSTextField(wrappingLabelWithString: "本地连接正在启动…")
    private lazy var menuBarToggle = NSButton(checkboxWithTitle: "在菜单栏显示", target: self, action: #selector(toggleMenuBarItem))
    override func viewDidLoad() {
        super.viewDidLoad()
        preferredContentSize = NSSize(width: 580, height: 470)
        let title = NSTextField(labelWithString: "Safari ↔ Codex")
        title.font = NSFont.boldSystemFont(ofSize: 28)
        let intro = NSTextField(wrappingLabelWithString: "在 Safari 右侧询问网页、图片和图表，回答直接留在浏览器中。")
        intro.font = NSFont.systemFont(ofSize: 16)
        let settings = NSButton(title: "打开 Safari 扩展设置", target: self, action: #selector(openSettings))
        let save = NSButton(title: "保存 Codex 本地连接配置", target: self, action: #selector(exportConnection))
        let note = NSTextField(wrappingLabelWithString: "点击 Safari 工具栏的「Codex 网页问答」打开侧栏。关闭此窗口后连接继续运行。需要调整菜单栏显示时，从应用程序中重新打开 Safari-Codex-Bridge。")
        note.textColor = .secondaryLabelColor
        menuBarToggle.state = (NSApp.delegate as? AppDelegate)?.showsMenuBarItem == true ? .on : .off
        let stack = NSStackView(views: [title,intro,status,settings,save,menuBarToggle,note])
        stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 22
        stack.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:32),stack.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-32),stack.topAnchor.constraint(equalTo:view.topAnchor,constant:30)])
    }
    override func viewDidAppear() {
        super.viewDidAppear()
        if let app = NSApp.delegate as? AppDelegate {
            status.stringValue = app.setupError ?? "本地连接已启动。"
            menuBarToggle.state = app.showsMenuBarItem ? .on : .off
        }
    }
    @objc private func toggleMenuBarItem() {
        (NSApp.delegate as? AppDelegate)?.setShowsMenuBarItem(menuBarToggle.state == .on)
    }
    @objc private func openSettings() { SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in } }
    @objc private func exportConnection() {
        guard let app = NSApp.delegate as? AppDelegate, let value = app.connectionSettings else { status.stringValue = "连接未就绪"; return }
        let panel = NSSavePanel();panel.title = "保存 Codex 本地连接配置";panel.nameFieldStringValue = "Safari-Codex-connection.json"
        panel.directoryURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        panel.canCreateDirectories = true
        panel.beginSheetModal(for: view.window!) { result in
            guard result == .OK, let url = panel.url else { return }
            do { try writeJSON(value, to: url); self.status.stringValue = "连接配置已保存。回到 Codex 即可读取 Safari 网页。" }
            catch { self.status.stringValue = "保存失败：\(error.localizedDescription)" }
        }
    }
}
