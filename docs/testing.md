# 测试说明

## 可直接运行的检查

```sh
npm ci
npm test
npm run build
```

`npm test` 仅执行 `tests/*.test.mjs`，共 10 项逻辑测试，不需要打开 Obsidian。
CI 使用 Node.js 24，在 Ubuntu 上验证这些测试和构建；这不代表 Linux 桌面窗口已通过验收。

## 桌面回归脚本

这些脚本来自开发阶段的隔离验证，需要自行准备专用环境，不会随仓库提供个人仓库、配置或笔记。

1. 创建名称以 `desktop-test-vault` 结尾的独立仓库。
2. 安装并启用 Dada Todo List 与此扩展；需要主页兼容检查时准备 Homepage、Dataview、编辑工具栏和测试日历笔记。
3. 使用独立 Obsidian profile，并仅在本机开启 `--remote-debugging-port=9335 --remote-debugging-address=127.0.0.1`。
4. 在仓库根目录运行目标 Node 或 PowerShell 脚本。执行前阅读脚本对测试文件和测试视图的具体要求。

不要把调试脚本用于个人日常仓库。脚本会创建或修改测试任务、调整窗口、切换插件或退出调试实例。`cdp.mjs` 对可识别的非测试仓库拒绝执行表达式。

| 脚本 | 场景 |
| --- | --- |
| `edge-overshoot.mjs` | 实际 BrowserWindow 移动事件触发左右越界吸附，覆盖两种宽度及隐藏开关 |
| `edge-hide.mjs` | 使用受控光标坐标，检查真实内容窗口和窄条的收起/展开 |
| `homepage-compat.mjs` | 主页启动、再次打开与直接替换请求保持在主窗口 |
| `lifecycle.mjs` | 配置恢复与两个原生窗口卸载清理 |
| `stability.mjs` | 挂载次数、焦点变化、样式作用域和主窗口最小化 |
| `drag-toolbar.ps1`、`drag-past-edge.ps1` | 使用系统鼠标输入；会短暂移动光标，需避免同时操作电脑 |
| `benchmark-startup.ps1` | 三次隔离启动采样，需显式传入 Obsidian 可执行文件路径 |

部分历史脚本依赖固定测试笔记名及仓库旁的输出目录。启动基准还需要 `desktop-test-vault`、`obsidian-test-profile` 与 `benchmark-workspace.json`，按脚本中相对路径准备；这些是测试夹具，不包含在公开仓库中。

## 已有结果的边界

开发阶段逻辑测试 10 项通过；405/900 宽度、左右越界 90px、自动隐藏开/关共 8 个原生窗口事件用例通过。左右收起与展开使用受控光标通过。物理鼠标跨边界尝试未稳定完成目标移动，没有计入通过结果。

开发环境为 Windows / Obsidian 1.15.1 / Blue Topaz / 单屏 175%。缺少真实多显示器、混合 DPI 和长期使用验收。公开 CI 不会复跑桌面环境，也不把上述手工开发结果当作每次提交的新结果。
