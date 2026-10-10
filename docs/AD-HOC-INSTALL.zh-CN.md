# Safari Codex Bridge 0.5.2 临时签名测试版安装说明

这是独立社区项目，不是 OpenAI 或 Apple 官方软件。此安装包采用 ad hoc（临时）签名，没有 Developer ID 证书，也没有 Apple 公证。无需购买 Apple 开发者会员即可下载测试；不等于普通用户双击即可完成的正式发行版。

## 安装前准备

- macOS 13 或更新版本，Safari。包含 Apple Silicon（arm64）和 Intel（x86_64）程序。
- 已安装并登录官方 Codex 桌面 App，或支持 `app-server` 的官方 Codex CLI。模型和用量取决于自己的账号；本包不包含 Codex 程序、订阅、登录凭证或 API 密钥。
- Python 3.9+。辅助程序默认使用 `/usr/bin/python3`，系统可能要求安装 Xcode Command Line Tools；终端运行 `/usr/bin/python3 --version` 可检查。无需为使用安装包编译整个项目。

## 1. 放入“应用程序”并打开

解压，把 `Safari-Codex-Bridge.app` 拖到 `/Applications`。若已有版本，请先退出其主程序和 Safari Chat Helper，备份旧 App，再替换。不要同时启用两个版本的扩展。

打开 App。因没有公证，macOS 可能拦截。确认下载来源、校验和后，可到“系统设置 → 隐私与安全性”查找这次被拦截的 App，选择“仍要打开”，按系统提示确认。界面名称随系统版本变化；若没有该选项，或提示恶意软件、签名损坏，请停止并反馈错误，不要关闭 Gatekeeper、SIP 或运行批量删除隔离属性的命令。

Apple 官方说明：https://support.apple.com/en-us/102445

## 2. 允许测试扩展

Safari → 设置 → 高级，启用“显示网页开发者功能”（旧版可能叫“在菜单栏中显示开发菜单”）。

Safari 17 或更新版：设置 → 开发者 → 勾选“允许未签名的扩展”。旧版：开发菜单 → 允许未签名的扩展。系统如要求 Mac 密码，由你在系统窗口输入。

**该选项作用于 Safari 中的未签名扩展，退出 Safari 后会重置，需要下次重新开启。**此包的 ad hoc 签名不能代替 Safari 要求的正式开发者签名。

再到 Safari → 设置 → 扩展，启用 Safari Codex Bridge，按需允许网站访问。选择“所有网站允许”可减少逐站授权；单独网站的“拒绝”仍可能覆盖该设置。

点击 Safari 工具栏中的 Codex 网页问答按钮，在公开网页测试。主程序能打开，不代表扩展和共享容器已经通过验证。

Apple 官方说明：https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension

## 3. 连接和功能

主程序窗口的“界面语言 / Language”可切换简体中文和 English，立即生效并在重启后保留。首次启动跟随系统语言（中文系统使用中文，其他语言使用英文）。主程序菜单栏菜单也跟随此选择。网页侧栏已有独立语言设置；两处可以分别选择。

保持配套程序运行；关闭连接窗口不会停止后台连接。默认隐藏顶部菜单栏和 Dock 图标。连接窗口可分别开启“在菜单栏显示”和“在 Dock 显示”；从“应用程序”重新打开即可调整，关闭窗口不会退出连接。

网页问答默认启用联网搜索。Work 首次任务会创建独立成果目录；处理已有文件时再通过“＋ → 选择文件夹”选择。普通沙箱内操作可执行，受保护操作在侧栏审批；文件读取范围遵循 Codex 沙箱及 macOS 权限。

Dictate 是可选功能：在官方 Codex 的 Voice 设置中设置 Single tap shortcut，在侧栏配置相同快捷键。若需要此功能，在“隐私与安全性 → 辅助功能”中允许本包内的 Safari Chat Helper。第一次点击麦克风开始，第二次点击结束并转写；录音、转写由官方 Codex 处理。替换签名后，旧辅助功能授权可能需要重新添加。

## 4. 临时签名版的具体限制

- 本次验证包括双架构构建、三个组件的临时签名和压缩包解压后签名校验；**未在全新 Mac 上完成端到端安装、Safari 启用或共享 App Group 连接验证**。
- App Group 使用测试标识 `ADHOCTEST0.local.codex.safari.context`，与维护者个人签名版的数据容器分开。不要假设旧版配对、设置和历史会自动迁移；官方 Codex 历史仍由官方程序管理。
- 不同 macOS / Safari 版本对扩展与沙箱共享容器的检查可能不同。若扩展看不见、辅助程序退出或侧栏无法连接，即使已允许未签名扩展，也可能需要在本机用自己的 Apple Development 身份构建。临时包不保证所有机器均可用。
- 若用于长期稳定使用，优先本机开发签名，或以后发布的 Developer ID 签名及公证版。

## 校验与卸载

安装目录附 `SHA256SUMS.txt`，终端进入该目录执行 `shasum -a 256 -c SHA256SUMS.txt`。校验和用于检查文件是否一致，不代表 Apple 验证了开发者身份。

卸载：在 Safari 中关闭扩展，退出配套程序，移除 App；不再需要 Dictate 时移除对应辅助功能授权。不要直接删除官方 Codex 的数据或账号配置。手动恢复备份 App 后，如有签名变化，重新检查扩展和辅助功能授权。

源码及完整文档：https://github.com/jianqilingyun/safari-codex-bridge
许可证：MIT；第三方组件许可证见源码仓库。
