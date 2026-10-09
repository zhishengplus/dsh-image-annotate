<div align="center">

# dsh-image-annotate

**圈出来、写上字，画完还能随手拖动调整 —— 一键把标注图塞进 DSH 的输入框。**

截图说不清的地方，圈一下就好了。

[![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4f7cff)](https://github.com/topics/dsh-plugin)
[![GitHub](https://img.shields.io/badge/github-zhishengplus%2Fdsh--image--annotate-181717?logo=github&logoColor=white)](https://github.com/zhishengplus/dsh-image-annotate)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-17%20%2B%2019%20%2B%2021%20passed-brightgreen)](./test)

**简体中文** | [English](README.en.md)

</div>

<p align="center">
  <img src="docs/demo.gif" alt="在 DSH 图片预览里圈选、打字、拖动，然后把标注图加入输入框" width="820">
</p>

<p align="center"><sub>点开图片 → 圈出问题 → 写一行说明 → 拖到合适位置 → 加入输入框 → 接着打字发送</sub></p>

---

## 你有没有过这种时刻

- 「这个按钮往左挪 8px」—— 对面回一句：哪个按钮？
- 「小屏下这里会挤在一起」—— 只好再截一张图，再画个箭头
- 把截图丢给 AI 说「这里有问题」—— 它开始认真猜「这里」到底是哪

问题不在表达能力，在于**「这里」需要用手指出来的**。
dsh-image-annotate 把这件事压缩成两秒：**点开图片 → 圈出来 → 打字 → 加入输入框 → 发送**。
模型收到的是带圈注的那张图，你说「这里」，它就知道「这里」在哪。

> 顺带一提：标注只发生在本机，原图一个字节都不会被改动。

## 30 秒上手

1. 在会话里**点开任意图片**（消息里的截图、输入框里的草稿图、工具返回的图都行）；
2. 预览右下角出现一个圆形 **标注** 按钮，点它；
3. 用 **圆圈 / 方框 / 箭头** 圈出问题，或者用 **文字** 在图上写一句话；
4. 觉得位置不对？**拖一下就挪走了**（见下一节）；
5. 点 **加入输入框** —— 标注图作为附件进到输入框，预览自动关闭，你接着打字发送。

| 快捷键 | 作用 |
|---|---|
| `V` | 选择 / 移动 |
| `1`–`7` | 依次切换：移动 · 画笔 · 箭头 · 方框 · 圆圈 · 文字 · 擦除 |
| `E` | 橡皮擦（点中哪笔擦哪笔） |
| `Ctrl/⌘ + Z` / `Ctrl/⌘ + Shift + Z` | 撤销 / 重做 |
| `Delete` | 删除选中 |
| 方向键（`Shift` 加速） | 1px / 10px 微调位置 |
| 文字工具 | 图上点一下 → 打字 → 回车（`Esc` 取消） |

## 画错了、想说清楚一点？画完照样能改

这是这个插件和"截图 + 画图工具"最大的不同：**每一笔都是可以再编辑的对象**，不是烧死的像素。

| 操作 | 怎么做 |
|---|---|
| 选中 | 切到 **移动**（`V`）点任意一笔；刚画完的那笔会自动选中 |
| 移动 | 直接拖；方向键微调 1px，`Shift + 方向键` 10px |
| 缩放 | 拖选中框四个角的手柄，等比放大缩小（文字会跟着改字号） |
| 改字 | **双击**任意文字直接改内容（改完还是同一笔，不会多出一层） |
| 删除 | `Delete`，或工具条上的垃圾桶（有选中时它就是"删除选中"） |
| 后悔 | 上面每一步都在撤销栈里，`Ctrl+Z` 一路退回 |

<p align="center">
  <img src="docs/demo-move-text.png" alt="圆圈被拖到了新位置，文字框也拖着走，虚线选中框和四角手柄是原生蓝" width="820">
</p>

<p align="center"><sub>圈和文字都换过位置了 —— 虚线选中框与四角手柄用的是 DSH 原生主色</sub></p>

## 它看起来就像 DSH 自己长出来的

整支工具栏都是 DSH 的设计 token 拼的，不引入自己的视觉语言：

| 部位 | 用的原生 token |
|---|---|
| 工具条容器 | `--dsw-menu-surface-fill` + `--dsw-menu-backdrop-filter` + `--dsw-elevation-panel` + `--dsw-radius-lg` |
| 工具按钮 | `--dsw-alias-button-tool-bar-fill` / `-hover`、`--dsw-alias-interactive-bg-hover` |
| 「加入输入框」 | `--dsw-alias-button-primary-fill` + `--dsw-alias-label-primary-foreground` |
| 右下角入口 | 和预览右上角关闭按钮**同款**的 36px 圆形（`--dsw-specific-input-major` + 0.5px 细边） |
| 提示条 | `--dsw-alias-toast-bg` / `-label` + `--dsw-shadow-lv3`（顶部居中，与原生 Toast 一致） |
| 选中态 | `--dsw-alias-state-business-primary`（虚线框 + 手柄 + 输入框描边） |
| 色板 | 原生 static 色：红 / 琥珀 / 黄 / 绿 / 蓝 / 品牌蓝 `deepseek-450` / 黑 / 白 |

主题切换、浅色深色、字号缩放都跟着走，不需要额外配置。

---

## 给开发者

### 三个"不"，让它在 DSH 升级时不容易坏

| | 做法 | 好处 |
|---|---|---|
| **不改宿主** | 不注册 slot、不动 React 树，只在预览 DOM 上叠一层自己的 canvas + 工具条，预览一关整层消失 | 不会和官方 UI 抢状态，也不会被重渲染打乱 |
| **不依赖内部包** | 不 `import` 任何 `@deepseek-ai/*`，不注入 dsh 服务，不需要 `dsh-loader` | 官方改内部 API / 改包名都不影响它 |
| **不需要构建** | 浏览器半区就是一个手写的 `window.__ModuleLoader__.load` 工厂（`lib/client.js`），没有 tsdown / rollup 产物 | 改完即生效，client-modules 按 mtime 做 HMR；npm 包里只有 4 个文件 |

### 它是怎么工作的

- **预览识别**：只认一个稳定特征 —— body 之下、`div[role="dialog"][aria-modal="true"]` 且**直接子元素里有 `<img>`** 的节点（就是 `dsh-client-ui-primitives` 的 `ImageLightbox`）。用 `MutationObserver` 节流扫描，预览出现即挂载，移除即销毁。
- **坐标系统**：所有笔迹以**原图像素**存储。叠加显示时按显示尺寸缩放，导出时按原图尺寸绘制 —— 所以 1909×1231 的截图在 1427×920 的预览里怎么画、怎么拖，导出的 PNG 就是 1909×1231 的同一位置。
- **编辑模型**：笔迹是普通对象（`{tool, color, points[], x, y, fontSize, textWidth…}`），选中/移动/缩放/改字都是对对象求值后整帧重绘；拖动时每帧从"按下瞬间的快照 + 位移"重算，不做累加，避免漂移。
- **投递到输入框**：把"原图 + 笔迹"合成为 PNG（`File`），再向 Lexical 输入框（`[data-composer-input]`）派发一个**带该文件的合成 `paste` 事件** —— 也就是用户自己粘贴截图时走的那条路。失败会依次退回：document 级 `drop` → 剪贴板（提示 `Ctrl+V`）→ 直接下载 PNG。
- **导出不怕污染**：先用 `fetch(src)` 把 `blob:` 原图取回再解码（`createImageBitmap`），避开跨域 `drawImage` 导致的 `toBlob` SecurityError。

> 有趣的坑之一：`position: fixed` + `left: 50%` 的浮层，宽度会按"left 右侧剩余空间"收缩，工具条会莫名换行 —— 补一个 `width: max-content` 才是正解（原生 Toast 的 CSS 注释里也记着这个坑）。

### 验证到什么程度

| 测试 | 覆盖 | 结果 |
|---|---|---|
| `test/test_annotate.py` | 画布贴合、笔迹像素、撤销、圆圈成形、导出尺寸、paste 投递、自动关闭 | **17 / 17** |
| `test/test_edit.py` | 选中、拖动、角手柄缩放、文字拖动与双击改字、方向键微调、删除与撤销 | **19 / 19** |
| `test/e2e_dsh.py` | **真实 dsh 实例**（隔离 profile + 独立端口）：打开预览 → 圈选 → 拖动 → 加字 → 投放 → 断言附件是原分辨率 1909×1231 | **21 / 21** |

前两套跑在自带的 fixture（`test/lightbox-fixture.html`，复刻 DSH 预览的真实 DOM 形状）上；第三套要用一个隔离实例，跑法见 [PUBLISHING.md](PUBLISHING.md) 或脚本头部注释。CI（`.github/workflows/ci.yml`）每次 push 都会跑语法检查 + 两套 fixture。

### 调试

```js
__dshImageAnnotate.annotators[0].state            // tool / strokes / selected / natural / rect …
localStorage.setItem('@dsh-plugin/dsh-image-annotate.debug', '1')   // 打开详细日志
```

## 安装

```sh
# 从 GitHub 直接装（现在就能用）
dsh plugin --profile <PROFILE> add github:zhishengplus/dsh-image-annotate

# 发布到 npm 之后也可以按包名装
dsh plugin --profile <PROFILE> add @<scope>/dsh-image-annotate

# 本地开发（link 一个 checkout）
dsh plugin --profile <PROFILE> add link:/path/to/dsh-image-annotate
```

装完确认它在该 profile 的 `package.json` 里：

```jsonc
"dsh": { "profile": { "bundles": [ /* …, */ "<上面用的包名>" ] } }
```

**首次需要重启一次 DSH**（profile 的 bundle 组合发生在启动时）；之后改 `lib/client.js` 会被 client-modules 的 HMR 按 mtime 感知，刷新页面即可。

卸载：删掉 profile `node_modules` 里的目录，并去掉 `dsh.profile.bundles` 里那一行。

## 兼容性

| | |
|---|---|
| 实测 dsh 版本 | `0.2.0-rc.2`（插件对外只依赖 preview 的 DOM 契约，理论上向后兼容性较好） |
| Node | ≥ 20（仅用于仓库脚本；插件本身运行在浏览器里） |
| 依赖 | **零**（无 `@deepseek-ai/*`、无 `dsh-loader`、无第三方运行时） |

## 已知限制与后续

- 目前只在**原图预览（lightbox）**里提供画笔；右侧栏「文件浏览」打开图片走的是另一套文档预览组件，还没有入口。
- 标注只存在于新合成的那张 PNG 里，不产生工程文件，也无法回改历史标注。
- 想要的话可以继续加：**高亮荧光笔 / 马赛克打码**、右侧栏图片入口、按序号生成"标注清单"一起发给模型。

## 协议

[MIT](LICENSE) · 与 DeepSeek 官方无关，未获 DeepSeek 许可或背书。

<div align="center">
<sub>如果它帮你省下过一次"我说的是这里"的解释，欢迎点个 Star ⭐</sub>
</div>
