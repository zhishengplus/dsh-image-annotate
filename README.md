<div align="center">
  <img src="docs/banner.png" alt="dsh-image-annotate（图片标注笔）—— 给 DeepSeek Harness 的图片预览加一支画笔" width="100%">

  <h3>在 DSH 的图片预览上圈出问题，画完还能随手拖动调整，<br>一键丢进输入框发给模型。</h3>

  [![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4f7cff)](https://github.com/topics/dsh-plugin)
  [![dsh](https://img.shields.io/badge/dsh-%E2%89%A5%200.2.0--rc.2-5b6cff)](#-兼容性)
  [![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](./package.json)
  [![tests](https://img.shields.io/badge/tests-17%20%2B%2019%20%2B%2021%20passed-brightgreen)](./test)
  [![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
  [![stars](https://img.shields.io/github/stars/zhishengplus/dsh-image-annotate?style=social)](https://github.com/zhishengplus/dsh-image-annotate)

  <b>简体中文</b> · <a href="README.en.md">English</a>
</div>

<p align="center">
  <img src="docs/demo.gif" alt="在 DSH 图片预览里圈选、打字、拖动，然后把标注图加入输入框" width="880">
</p>

<p align="center"><sub>点开图片 → 圈出问题 → 写一行说明 → 拖到合适位置 → 加入输入框 → 接着打字发送</sub></p>

---

<h3 align="center">🎯 它解决的是什么</h3>

> 「这个按钮往左挪 8px。」—— 对面问：哪个按钮？
>
> 「小屏下这里会挤在一起。」—— 只好再截一张图，再画个箭头。
>
> 把截图丢给 AI 说「这里有问题」—— 它开始认真猜「这里」到底是哪。

问题从来不是表达，而是 **「这里」需要用手指出来的**。
这个插件把这件事压缩成两秒：**点开图片 → 圈出来 → 打字 → 加入输入框 → 发送**。

<p align="center">
  <img src="docs/before-after.png" alt="左边是原始截图，右边是加入输入框后模型真正收到的那张 PNG" width="920">
</p>

<p align="center"><sub>左边是原图；右边是点「加入输入框」后 <b>模型真正收到的那张 PNG</b>（原分辨率，圈和字都在上面）</sub></p>

<h3 align="center">✨ 亮点一览</h3>

| | |
|---|---|
| 🖊 **七种工具** | 移动 · 画笔 · 箭头 · 方框 · 圆圈 · 文字 · 橡皮擦；圆圈和方框按整条轨迹的外接框成形，手绘一圈也成 |
| 🖐 **画完还能改** | 每一笔都是活对象：选中、拖动、拖角缩放、双击改字、删除、方向键微调，全部可撤销 |
| 🔤 **文字是对象** | 双击直接改内容（不会多出一层）；文字工具下也能直接拖走已确定的文字框 |
| 🎨 **原生外观** | 工具条、按钮、提示、选中框全部用 DSH 设计 token 拼，浅色深色自动跟随 |
| 📨 **一键进输入框** | 合成原分辨率的 PNG，走的是 composer 自己的粘贴通道；失败还有拖放 / 剪贴板 / 下载三级兜底 |
| 🪶 **零依赖 · 无构建** | 不 import 任何 `@deepseek-ai/*`，不需要 dsh-loader，也没有打包产物 —— npm 包里就 4 个文件 |
| 🖼 **支持多种来源** | 消息里的截图、输入框里的草稿图、工具返回的图片，都是同一个预览，同一个画笔 |

<h3 align="center">🚀 30 秒上手</h3>

1. 在会话里**点开任意图片**；
2. 预览右下角出现圆形 **标注** 按钮（和右上角关闭按钮同款），点它；
3. 用 **圆圈 / 方框 / 箭头** 圈出问题，或用 **文字** 在图上写一句；
4. 位置不满意？**直接拖**（见下一节）；
5. 点 **加入输入框** —— 标注图进到输入框，预览自动关闭，你接着打字发送。

| 快捷键 | 作用 |
| :-- | :-- |
| `V` | 选择 / 移动 |
| `1` – `7` | 移动 · 画笔 · 箭头 · 方框 · 圆圈 · 文字 · 擦除 |
| `E` | 橡皮擦（点中哪笔擦哪笔） |
| `Ctrl/⌘ + Z` · `Ctrl/⌘ + Shift + Z` | 撤销 · 重做 |
| `Delete` | 删除选中 |
| 方向键（`Shift` 加速） | 微调 1px / 10px |
| 文字工具 | 图上点一下 → 打字 → 回车（`Esc` 取消） |

<h3 align="center">🖐 画完还能改，这才是重点</h3>

截图工具画上去的线是烧死的像素，这里不是 —— **每一笔都可以再编辑**：

| 想做什么 | 怎么做 |
| :-- | :-- |
| **选中** | 切到「移动」(`V`) 点任意一笔；刚画完的那笔会自动选中 |
| **移动** | 直接拖；方向键微调 1px，`Shift + 方向键` 10px |
| **缩放** | 拖选中框四角的手柄等比缩放（文字会跟着改字号） |
| **改字** | **双击**任意文字直接改（改完还是同一笔） |
| **删除** | `Delete`，或工具条上的垃圾桶（有选中时它就变成"删除选中"） |
| **后悔** | 上面每一步都在撤销栈里，`Ctrl+Z` 一路退回 |

<p align="center">
  <img src="docs/demo-move-text.png" alt="圆圈被拖到新位置，文字框也被拖动，虚线选中框与四角手柄使用原生主色" width="880">
</p>

<p align="center"><sub>圈和文字都换过位置了 —— 虚线选中框与四角手柄用的是 DSH 原生主色</sub></p>

<h3 align="center">🎨 它看起来就像 DSH 自己长出来的</h3>

整支工具栏由 DSH 的设计 token 拼成，不引入第二套视觉语言：

| 部位 | 用到的原生 token |
| :-- | :-- |
| 工具条容器 | `--dsw-menu-surface-fill` + `--dsw-menu-backdrop-filter` + `--dsw-elevation-panel` + `--dsw-radius-lg` |
| 工具按钮 | `--dsw-alias-button-tool-bar-fill` / `-hover` · `--dsw-alias-interactive-bg-hover` |
| 主按钮 | `--dsw-alias-button-primary-fill` · `--dsw-alias-label-primary-foreground` |
| 右下角入口 | 与预览关闭按钮**同款** 36px 圆形（`--dsw-specific-input-major` + 0.5px 细边） |
| 提示条 | `--dsw-alias-toast-bg` / `-label` + `--dsw-shadow-lv3`（顶部居中，同原生 Toast） |
| 选中态 | `--dsw-alias-state-business-primary` |
| 色板 | 原生 static 色：红 · 琥珀 · 黄 · 绿 · 蓝 · 品牌蓝 `deepseek-450` · 黑 · 白 |

---

<h3 align="center">🛠 给开发者</h3>

<details>
<summary><b>三个「不」，让它在 DSH 升级时不容易坏</b></summary>

| | 做法 | 好处 |
| :-- | :-- | :-- |
| **不改宿主** | 不注册 slot、不动 React 树，只在预览 DOM 上叠一层自己的 canvas + 工具条，预览一关整层消失 | 不和官方 UI 抢状态，也不怕重渲染 |
| **不依赖内部包** | 不 `import` 任何 `@deepseek-ai/*`、不注入 dsh 服务、不需要 `dsh-loader` | 官方改内部 API / 改包名都影响不到它 |
| **不需要构建** | 浏览器半区就是一个手写的 `window.__ModuleLoader__.load` 工厂（`lib/client.js`），没有 tsdown / rollup 产物 | 改完即生效（client-modules 按 mtime 做 HMR），包里只有 4 个文件 |

</details>

<details>
<summary><b>它是怎么工作的</b></summary>

- **预览识别**：只认一个稳定特征 —— body 之下、`div[role="dialog"][aria-modal="true"]` 且**直接子元素里有 `<img>`** 的节点（即 `dsh-client-ui-primitives` 的 `ImageLightbox`）。用节流后的 `MutationObserver` 扫描：预览出现即挂载，移除即销毁。
- **坐标系统**：所有笔迹以**原图像素**存储。叠加显示时按显示尺寸缩放，导出时按原图尺寸绘制 —— 1909×1231 的截图在 1427×920 的预览里怎么画、怎么拖，导出的 PNG 就是 1909×1231 的同一位置。
- **编辑模型**：笔迹是普通对象（`{tool, color, points[], x, y, fontSize, textWidth…}`）。选中 / 移动 / 缩放 / 改字都是对对象求值后整帧重绘；拖动时每帧从「按下瞬间的快照 + 位移」重算而不是累加，避免漂移。
- **投递到输入框**：把「原图 + 笔迹」合成为 PNG（`File`），再向 Lexical 输入框（`[data-composer-input]`）派发一个**带该文件的合成 `paste` 事件** —— 也就是用户自己粘贴截图走的那条路。失败依次退回：document 级 `drop` → 剪贴板（提示 `Ctrl+V`）→ 下载 PNG。
- **导出不怕污染**：先用 `fetch(src)` 把 `blob:` 原图取回再解码（`createImageBitmap`），避开跨源 `drawImage` 导致的 `toBlob` SecurityError。

> 一个有意思的坑：`position: fixed` + `left: 50%` 的浮层，宽度按「left 右侧剩余空间」收缩，工具条会莫名换行 —— 补 `width: max-content` 才对（原生 Toast 的 CSS 注释里也记着同一个坑）。

</details>

<details>
<summary><b>验证到什么程度</b></summary>

| 测试 | 覆盖 | 结果 |
| :-- | :-- | :-- |
| [`test/test_annotate.py`](test/test_annotate.py) | 画布贴合、笔迹像素、撤销、圆圈成形、导出尺寸、paste 投递、自动关闭 | **17 / 17** |
| [`test/test_edit.py`](test/test_edit.py) | 选中、拖动、角手柄缩放、文字拖动与双击改字、方向键微调、删除与撤销 | **19 / 19** |
| [`test/e2e_dsh.py`](test/e2e_dsh.py) | **真实 dsh 实例**（隔离 profile + 独立端口）：打开预览 → 圈选 → 拖动 → 加字 → 投放 → 断言附件为原分辨率 1909×1231 | **21 / 21** |

前两套跑在自带 fixture（[`test/lightbox-fixture.html`](test/lightbox-fixture.html)，复刻 DSH 预览的真实 DOM 形状）上；第三套需要一个隔离实例，跑法见脚本头部注释与 [PUBLISHING.md](PUBLISHING.md)。CI（[`.github/workflows/ci.yml`](.github/workflows/ci.yml)）每次 push 都跑语法检查 + 两套 fixture。

</details>

<details>
<summary><b>调试</b></summary>

```js
__dshImageAnnotate.annotators[0].state   // tool / strokes / selected / natural / rect …
localStorage.setItem('@dsh-plugin/dsh-image-annotate.debug', '1')   // 打开详细日志
```

</details>

<h3 align="center">📦 安装 / 卸载</h3>

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

<h3 align="center">🧭 兼容性</h3>

| | |
| :-- | :-- |
| 实测 dsh 版本 | `0.2.0-rc.2`（插件只依赖预览的 DOM 契约，理论上对后续版本也较稳） |
| Node | ≥ 20（仅仓库脚本需要；插件本身跑在浏览器里） |
| 依赖 | **零**：无 `@deepseek-ai/*`、无 `dsh-loader`、无第三方运行时 |

<h3 align="center">🗺 路线图</h3>

- [x] 圈选 / 箭头 / 方框 / 文字 / 擦除，画完可选中、拖动、缩放、改字、删除
- [x] 原分辨率导出 + 一键进输入框 + 三级兜底
- [x] 全量原生 token 外观
- [ ] 高亮荧光笔 / 马赛克打码
- [ ] 右侧栏「文件浏览」打开图片也能标注
- [ ] 自动编号的「标注清单」随图一起发给模型

<h3 align="center">📄 协议</h3>

<div align="center">

[MIT](LICENSE) · 与 DeepSeek 官方无关，未获其许可或背书

<sub>如果它帮你省下过一次「我说的是这里」的解释，欢迎点个 ⭐</sub>

</div>
