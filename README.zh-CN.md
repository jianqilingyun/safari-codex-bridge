# Safari Codex Bridge

在 Safari 网页旁直接提问，结合正文、划选文字、图片和图表，通过你自己的 Codex 账号获取回答。

[English](README.md) · [构建与安装](docs/INSTALL.md) · [隐私说明](PRIVACY.md)

**社区独立项目，并非 OpenAI、Apple 或 Google 官方扩展。首次公开发布提供源码；需要在自己的 Mac 上构建并签名，暂不提供经过公证的一键安装包。**

## 已有功能

- 网页侧栏连续问答、流式回答和历史恢复，支持在 Codex 中继续聊。
- 划选文字自动加入待发送引用，可预览或移除；还可附上整页正文、可见截图和最多三个其他已授权标签页。
- 从官方 Codex app-server 动态获取模型与推理程度，不把模型写死，也不静默替换不可用模型。
- 默认保存聊天，临时聊天可选；固定侧栏、窄栏适配、中英文界面、主题和字号选择。
- 麦克风按钮调用官方 Codex 全局听写快捷键；录音与转写由 Codex 处理。
- 可选 MCP 模式，让已有的 Codex 聊天按你的要求读取 Safari 网页和图片。

## 界面预览

<p><img src="docs/images/narrow-light.png" width="224" alt="浅色窄栏"> <img src="docs/images/narrow-dark.png" width="272" alt="深色窄栏"></p>

预览使用合成网页与模拟回答，仅展示版式。

## 安装与使用

需要 macOS 13+、Safari、完整 Xcode、Python 3.9+，以及支持 app-server 的官方 Codex 桌面应用或 CLI。先在官方客户端完成自己的账号登录。账号可用模型、额度与服务条款仍由 OpenAI 决定。

```sh
git clone https://github.com/jianqilingyun/safari-codex-bridge.git
cd safari-codex-bridge
./scripts/build.sh --unsigned
```

以上命令只检查编译。实际使用需要你自己的 Apple 签名身份，详细步骤见[安装说明](docs/INSTALL.md)。公开分发常规安装包还需要单独完成 Developer ID 签名与 Apple 公证；仓库不包含维护者的证书、私钥或个人签名应用。

打开连接应用，在 Safari 设置中启用扩展并选择网站权限，点击工具栏打开侧栏。发送前可以选择是否附上网页或截图。固定选项会在已经授权的网站自动打开侧栏。

## 数据与边界

网页仅在发送问题或明确调用读取工具时传给 Codex。自动划选的待发送引用留在当前标签页内存中。截图会包含当前可见内容，需要你自行检查。

默认聊天保存于 Codex，并在 Safari 扩展存储中保留显示用副本；临时聊天不加入这些持久历史，但会经过 OpenAI 服务，本地传输文件短暂存在。临时聊天不等于云端零保留。详见[隐私说明](PRIVACY.md)。

插件不提供付费文章访问权限，不读取未加载内容，也不覆盖 Safari 的网站授权。侧栏是网页内的隔离组件，特殊网页布局仍可能影响显示。Codex 后续接口更新可能要求更新插件。

听写需要 Codex 桌面应用、对应的 Single tap 快捷键及 Helper 辅助功能权限。插件无法读取 Codex 的真实录音状态；在其他地方结束录音后，侧栏指示可能需要重新同步。关闭侧栏不会自动关闭已经交给官方 Codex 的录音。

## 开发与许可

```sh
npm ci
npx playwright install chromium
npm run test:python
npm test
```

自动测试使用合成网页和模拟传输；不能替代真实 Safari 授权、模型或麦克风验收。Apple Silicon 与 Intel 均做编译检查，真实浏览器验收目前限于 Apple Silicon。

项目原创代码采用 [MIT](LICENSE)；Readability 保留 [Apache-2.0](THIRD_PARTY_NOTICES.md) 许可。
