import Cocoa
import SafariServices

class ViewController: NSViewController {
    private let status = NSTextField(wrappingLabelWithString: "")
    private let intro = NSTextField(wrappingLabelWithString: "")
    private let note = NSTextField(wrappingLabelWithString: "")
    private let languageLabel = NSTextField(labelWithString: "")
    private let languagePicker = NSPopUpButton()
    private lazy var settings = NSButton(title: "", target: self, action: #selector(openSettings))
    private lazy var save = NSButton(title: "", target: self, action: #selector(exportConnection))
    private lazy var menuBarToggle = NSButton(checkboxWithTitle: "", target: self, action: #selector(toggleMenuBarItem))
    private enum Status { case connection, notReady, saved, failed(String) }
    private var currentStatus: Status = .connection
    override func viewDidLoad() {
        super.viewDidLoad()
        preferredContentSize = NSSize(width: 620, height: 510)
        let title = NSTextField(labelWithString: "Safari ↔ Codex")
        title.font = NSFont.boldSystemFont(ofSize: 28)
        intro.font = NSFont.systemFont(ofSize: 16)
        note.textColor = .secondaryLabelColor
        languagePicker.addItems(withTitles: ["简体中文", "English"])
        languagePicker.target = self
        languagePicker.action = #selector(changeLanguage)
        let languageRow = NSStackView(views: [languageLabel, languagePicker])
        languageRow.orientation = .horizontal
        languageRow.spacing = 12
        let stack = NSStackView(views: [title, languageRow, intro, status, settings, save, menuBarToggle, note])
        stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo:view.leadingAnchor,constant:32),stack.trailingAnchor.constraint(equalTo:view.trailingAnchor,constant:-32),stack.topAnchor.constraint(equalTo:view.topAnchor,constant:30), stack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -24)])
        NotificationCenter.default.addObserver(self, selector: #selector(refreshLanguage), name: HostLanguage.changed, object: nil)
        refreshLanguage()
    }
    deinit { NotificationCenter.default.removeObserver(self) }
    override func viewDidAppear() {
        super.viewDidAppear()
        refreshLanguage()
    }
    @objc private func changeLanguage() {
        HostLanguage.select(languagePicker.indexOfSelectedItem == 0 ? "zh" : "en")
    }
    @objc private func refreshLanguage() {
        languagePicker.selectItem(at: HostLanguage.code == "zh" ? 0 : 1)
        languageLabel.stringValue = HostLanguage.text("界面语言", "Language")
        intro.stringValue = HostLanguage.text("在 Safari 侧栏询问网页、图片和图表，回答直接显示在浏览器中。", "Ask about webpages, images, and charts in the Safari sidebar.")
        settings.title = HostLanguage.text("打开 Safari 扩展设置", "Open Safari Extension Settings")
        save.title = HostLanguage.text("保存 Codex 本地连接配置", "Save Codex Connection Configuration")
        menuBarToggle.title = HostLanguage.text("在菜单栏显示", "Show in Menu Bar")
        note.stringValue = HostLanguage.text("点击 Safari 工具栏中的扩展按钮打开侧栏。关闭此窗口后连接继续运行。重新打开应用可调整设置。侧栏语言可在侧栏设置中单独选择。", "Click the extension button in the Safari toolbar to open the sidebar. The connection stays active when you close this window. Reopen the app to change settings. Choose the sidebar language separately in its settings.")
        menuBarToggle.state = (NSApp.delegate as? AppDelegate)?.showsMenuBarItem == true ? .on : .off
        switch currentStatus {
        case .connection:
            if let error = (NSApp.delegate as? AppDelegate)?.setupError {
                status.stringValue = HostLanguage.text("本地连接启动失败：", "Unable to start the local connection: ") + error
            } else {
                status.stringValue = HostLanguage.text("本地连接已启动。", "Local connection started.")
            }
        case .notReady: status.stringValue = HostLanguage.text("连接未就绪。", "Connection is not ready.")
        case .saved: status.stringValue = HostLanguage.text("连接配置已保存，可用于 Codex 的 Safari MCP 连接。", "Configuration saved for the Safari MCP connection in Codex.")
        case .failed(let error): status.stringValue = HostLanguage.text("保存失败：", "Could not save: ") + error
        }
    }
    @objc private func toggleMenuBarItem() {
        (NSApp.delegate as? AppDelegate)?.setShowsMenuBarItem(menuBarToggle.state == .on)
    }
    @objc private func openSettings() { SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in } }
    @objc private func exportConnection() {
        guard let app = NSApp.delegate as? AppDelegate, let value = app.connectionSettings else { currentStatus = .notReady; refreshLanguage(); return }
        let panel = NSSavePanel()
        panel.title = HostLanguage.text("保存 Codex 本地连接配置", "Save Codex Connection Configuration")
        panel.nameFieldStringValue = "Safari-Codex-connection.json"
        panel.directoryURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        panel.canCreateDirectories = true
        guard let window = view.window else { return }
        panel.beginSheetModal(for: window) { result in
            guard result == .OK, let url = panel.url else { return }
            do { try writeJSON(value, to: url); self.currentStatus = .saved }
            catch { self.currentStatus = .failed(error.localizedDescription) }
            self.refreshLanguage()
        }
    }
}
