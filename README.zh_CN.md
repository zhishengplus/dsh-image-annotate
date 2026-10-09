<div align="center">

# dsh-image-annotate — 给 DSH 的图片预览加一支画笔

**圈出来、写上字，画完还能再拖动调整 —— 一键把标注图塞进输入框发给模型。**

[![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4f7cff)](https://github.com/topics/dsh-plugin)
[![GitHub](https://img.shields.io/badge/github-zhishengplus%2Fdsh--image--annotate-181717?logo=github&logoColor=white)](https://github.com/zhishengplus/dsh-image-annotate)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[English](README.md) | 简体中文

</div>

在 DeepSeek Harness（DSH）Web 界面里，点开任意图片会弹出原图预览（lightbox）。
这个插件在预览右下角加一个 **标注** 圆形按钮（和原生关闭按钮同款）：点开后就能在图片上
圈画、打箭头、写字，**并且画完的每一笔都能再选回来拖动、缩放、改字、删除**；
最后把标注后的 PNG 放进当前会话的输入框——你接着打字，模型看到的就是带圈注的那张图。

![演示：在 DSH 图片预览里圈画、打字、拖动，然后加入输入框](docs/demo.gif)

```
点击图片 → 右下角「标注」→ 圈/箭头/方框/文字 → （随时选中调整位置）→「加入输入框」→ 打字发送
```

![画完之后：圈和文字都拖到了新位置，底部是原生工具条](docs/demo-move-text.png)

## 界面与操作

| 元素 | 说明 |
|---|---|
| 右下角圆形「标注」 | 进入标注模式（不点它时预览保持原样，不会误画）；hover 有 tooltip |
| 移动 / 画笔 / 箭头 / 方框 / 圆圈 / 文字 / 擦除 | 七种工具；「方框」「圆圈」按**整条轨迹的外接框**成形，手绘一圈或对角拖拽都符合直觉 |
| 8 个色块 + 3 档粗细 | 色板直接取 DSH 原生色 token（含品牌蓝 deepseek-450），随主题走 |
| 撤销 / 重做 / 清空 | 垃圾桶按钮是上下文按钮：有选中就「删除选中」，否则「清空全部」 |
| 「加入输入框」 | 合成原图 + 全部笔迹 → 作为附件放进 composer，随后自动关闭预览 |
| ⤓ / ✕ | 下载 `annotated-<时间戳>.png` / 退出标注模式 |

### 画完之后还能调（这一版的重点）

- **选中**：切到「移动」工具（快捷键 `V`）点任意一笔即可选中；刚画完的一笔也会自动选中。
  选中框是原生蓝的虚线框 + 四角手柄，悬停时光标会变成 `move` / 缩放箭头。
- **移动**：拖动选中项即可；方向键微调 1px，`Shift+方向键` 10px。
- **缩放**：拖四角手柄等比放大/缩小（文字同时缩字号）。
- **改字**：双击任意文字直接改内容（改完仍是同一笔，不会新增）；文字工具下也可以直接拖动已确定的文字框。
- **删除**：`Delete` / `Backspace`，或垃圾桶按钮；一切操作都在撤销栈里。

### 快捷键（标注模式内）

`V` 移动 · `1`~`7` 依次切换七个工具 · `E` 擦除 · `Ctrl/⌘+Z` 撤销 · `Ctrl/⌘+Shift+Z` 重做 ·
`Delete` 删除选中 · 方向键微调。文字工具：点图 → 打字 → 回车（Esc 取消）。

## 原生风格

整套 UI 都走 DSH 设计 token（theme 包的 `--dsw-*`），拿不到时退回同色近似值：

| 部位 | 用到的原生 token |
|---|---|
| 工具条容器 | `--dsw-menu-surface-fill`、`--dsw-menu-backdrop-filter`、`--dsw-elevation-panel`、`--dsw-radius-lg` |
| 工具按钮 | `--dsw-alias-label-secondary`、`--dsw-alias-interactive-bg-hover`、`--dsw-alias-button-tool-bar-fill`、`--dsw-radius-md` |
| 主按钮 | `--dsw-alias-button-primary-fill` / `-hover`、`--dsw-alias-label-primary-foreground` |
| 弹出按钮 | `--dsw-specific-input-major`、`--dsw-alias-border-l2-darkmode-thin`（与预览关闭按钮同款 36px 圆形） |
| 提示条 | `--dsw-alias-toast-bg` / `-label`、`--dsw-shadow-lv3`（顶部居中，与原生 Toast 一致） |
| 选中态 / 输入框 | `--dsw-alias-state-business-primary`、`--dsw-focus-ring-*`、`--dsw-alias-bg-layer-1` |
| 色板 | `--dsw-static-red/amber/green/blue/deepseek/neutral-*` |

## 关键设计

- **笔迹以「原图像素」为坐标存储**：叠加显示按显示尺寸缩放，导出按原图尺寸绘制。
  1909×1231 的截图在 1427×920 的预览里怎么画、怎么拖，导出的 PNG 就是 1909×1231 的同一位置。
- **不依赖任何 dsh 内部包**：整个浏览器半区就是一个手写的 `window.__ModuleLoader__.load` 工厂
  （`lib/client.js`），无构建步骤；只认 lightbox 的
  `body > div[role="dialog"][aria-modal="true"] > img` 结构，dsh 升级不易坏。
- **只叠加、不改宿主**：不注册 slot、不改 React 树，预览关闭时整层随之消失。
- **投递走 composer 既有入口**：合成一个带 PNG 的 `paste` 事件派发给 Lexical 输入框
  （`[data-composer-input]`），即用户粘贴截图走的那条路；失败依次退回拖放 → 剪贴板 → 下载。
- **导出不受画布污染**：先 `fetch(src)` 取回 `blob:` 原图再解码，避开跨源 `drawImage` 的
  `toBlob` SecurityError。

## 安装 / 卸载

```powershell
# 1) 从 GitHub 直接装（现在就能用）
dsh plugin --profile <PROFILE> add github:zhishengplus/dsh-image-annotate

# 2) 发布到 npm 之后也可以按包名装
dsh plugin --profile <PROFILE> add @<scope>/dsh-image-annotate

# 3) 本地开发（link 一个 checkout）
dsh plugin --profile <PROFILE> add link:/path/to/dsh-image-annotate
```

然后确认它在该 profile 的 `package.json` 里：

```jsonc
"dsh": { "profile": { "bundles": [ /* …, */ "<上面用到的包名>" ] } }
```

首次需要重启 DSH（bundle 组合发生在启动时）；此后改 `lib/client.js` 会被 client-modules
的 HMR 按 mtime 感知，刷新页面即可生效。

卸载：删掉 profile `node_modules` 里的目录 + 去掉 `dsh.profile.bundles` 里那一行。

## 调试

```js
__dshImageAnnotate.annotators[0].state   // tool / strokes / selected / natural / rect ...
localStorage.setItem('@dsh-plugin/dsh-image-annotate.debug', '1')  // 打开日志
```

## 测试

```powershell
python test\test_annotate.py   # 绘制/导出/投递：17 项
python test\test_edit.py       # 选中/拖动/缩放/改字/删除/微调：19 项
# 真实应用端到端（隔离实例，不动线上）：
#   dsh.cmd --profile <copy-of-desktop> --port 19410 --no-open   → 日志末尾拿带 token 的 URL
python test\e2e_dsh.py "http://127.0.0.1:19410/?token=..."
```

`test/shots/` 里是端到端截图（画圈、拖动、文字改字、附件进入输入框）。

## 已知限制

- 只在**原图预览（lightbox）**里提供画笔；右侧栏「文件浏览」打开图片用的是另一套文档预览组件。
- 首次安装需重启 DSH。
- 标注只存在于新合成的那张 PNG 里；原文件不会被修改。
