# Changelog

本文件记录 `dsh-plugin-thinking-brain` 的版本变化。格式参考 Keep a Changelog，版本号遵循 SemVer。

## [0.1.0] - 2026-11-25

首个公开版本。

### Added

- 输入框模型选择器左侧新增脑子按钮（`conversation.input.right` 席位，28px），点击打开锚定在输入框上方的思考强度卡片。
- 分段滑轨：停点来自当前模型目录里的 `reasoning.efforts`；声明默认档的模型用加高停点 + 「默认」标签标出默认档；未声明默认档的模型额外提供 `Default` 停点（提交时省略 `reasoningEffort`，与自带模型菜单一致）。
- 与原模型/思考强度选择器共用同一份 `ModelDirectory` 状态：任一侧改动都会让另一侧跟随；选择失败在卡片内显示 Host 错误信息。
- Canvas 动效：DeepSeek 蓝填充 → 像素马赛克微光 → 顶级粒子 + 星芒；大脑滑块随档位换色；静止后停止重绘，支持 `prefers-reduced-motion`。
- 浅色 / 深色主题：卡片复用原生菜单表面材质（`--dsw-menu-surface-fill` + backdrop 模糊 + `--dsw-elevation-prominent`），画布调色板跟随 `data-ds-dark-theme`。
- 键盘与可达性：`←` `→` `Home` `End` `Esc`，ARIA slider 语义，关闭时按来源决定是否归还焦点。
- 插件管理元数据：中文/英文标题与描述、36×36 脑子图标、MIT 许可、浅色/深色预览图。
