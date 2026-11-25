# 1.0.5 · 个人实验版

基于 Plover 的 [Dada Todo List 0.12.2](https://github.com/Plover-PY/obsidian-DadaTodoList) 开发的非官方独立扩展，由 Yuki-happyday 使用 Codex 辅助开发。感谢上游原作者，保留其 MIT 许可证和版权声明。

## 功能

- 独立桌面日程窗口、置顶和系统标题栏拖动。
- 左右吸附；支持部分拖出屏幕后松手吸回。
- 贴边后离开收起，鼠标靠近窄条展开。
- 沿用 Dada 设置和 Markdown 任务，日程界面按需加载。

## 安装

下载 `dada-desktop-window-1.0.5.zip`，将其中的 `dada-desktop-window` 文件夹放进仓库 `.obsidian/plugins/`，在 Obsidian 中启用。需要同时启用 Dada Todo List；Obsidian 最低 1.13.0。

更新保留自己的 `data.json`，完整替换所有程序资源，包含 `ui.cjs` 与 `ui.css`。1.0.5 首次加载时会一次性开启吸附和隐藏；之后手动修改的选择会保留。源码压缩包供查看和构建，无个人仓库或运行配置。

## 验证范围

逻辑测试 10 项通过，生产构建通过。开发阶段覆盖 405/900 宽度、左右越界和隐藏开关两种状态；收起/展开使用受控光标坐标验证。

仅在 Windows、Obsidian 1.15.1、Blue Topaz、单屏 175% 等隔离环境完成开发验证。真实多屏、其他系统和长期使用尚未验收；Electron remote 与宿主内部 API 仍有兼容性风险。当前发布用于分享与交流，欢迎反馈。
