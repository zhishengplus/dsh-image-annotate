# 发布指南（现状 + 后续）

## 当前状态（2026-10-10）

| 渠道 | 作用 | 状态 |
|---|---|---|
| **GitHub 仓库** | 源码与文档 | ✅ https://github.com/zhishengplus/dsh-image-annotate（公开，MIT） |
| **Release** | 版本锚点 | ✅ `v0.1.0`、`v0.1.1`（Latest） |
| **CI** | 语法检查 + 两套 Playwright 测试 | ✅ 每次 push 全绿（英文/中文 locale 都验过） |
| **awesome-dsh-plugin** | 社区唯一精选注册表 → dsh-market（DSH 设置页里的插件市场）、dshmarket.com、dsh-launcher 市场都读它 | ✅ 已提 PR [#7061](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7061)，双门禁绿，等维护者审阅 |
| **dsh-plugins 组织** | 组织归属 + `@dsh-plugin` 包名 + dsh-plug.in | ✅ 已提 issue [#1](https://github.com/dsh-plugins/.github/issues/1)（「加入我们」模板），等审核 |
| **npm** | 让 `dsh plugin add <包名>` 更快 | ⏳ 未发布：需要本机 `npm login`（账号密码/2FA 只有本人能输） |

> 注意：**npm 不是必需项**。awesome 列表的条目指向 GitHub 仓库，用户现在就能装：
> `dsh plugin --profile <PROFILE> add github:zhishengplus/dsh-image-annotate`

---

## ① 发到 npm（只差这一步）

```powershell
# 1) 登录（本机 registry 指向 npmmirror 镜像，只能读，所以显式指定官方源）
npm login --registry=https://registry.npmjs.org

# 2) 如果还没拿到 @dsh-plugin scope（等组织收录），改成自己的 scope
node scripts/rename-scope.mjs @<你的npm用户名>      # 同步改三处：package.json / cordis.patch.yml / lib/client.js
npm run check

# 3) 打包 + 发布（脚本已固定官方源）
npm pack --pack-destination dist
npm run publish:npm
```

发布后把 README 顶部的 GitHub 徽章旁补一个版本徽章：

```md
[![npm](https://img.shields.io/npm/v/<包名>.svg)](https://www.npmjs.com/package/<包名>)
```

### 交给 CI 自动发（配一次，之后建 Release 就自动发）

1. npm → Access Tokens → 生成 **Automation** token（对该包名有 publish 权限）；
2. 仓库 Settings → Secrets and variables → Actions → 新建 `NPM_TOKEN`；
3. 以后：`npm version patch` → `git push --follow-tags` → `gh release create vX.Y.Z --generate-notes`，
   workflow 会自动 `npm publish --provenance --access public`。
   没有配置 token 时该步骤会**自动跳过并给出提示**，不会把 Actions 弄红。

---

## ② 社区列表（awesome-dsh-plugin）—— 已提交

它是整个生态的注册表：**dsh-market**（DSH 设置页内的插件市场）、**dshmarket.com**、**awesome-dsh-plugin.com**、**dsh-launcher 的插件市场**都从这一份列表取数据。dsh-market 的 README 明确说明：插件条目 PR 要提到这里，而不是提到市场仓库。

投稿方式：**在 `data/plugins/` 下加一个 YAML 文件**（一个文件就是全部投稿，README 由脚本生成，不要手改）：

```yaml
url: https://github.com/zhishengplus/dsh-image-annotate
name: zhishengplus/dsh-image-annotate
category: ui
description:
  en: ...
  zh: ...
```

本次提交：分支 `zhishengplus:add-zhishengplus-dsh-image-annotate`（本地 clone 在 `_work/annotate/publish/awesome-fork`），PR [#7061](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7061)。
若维护者提修改要求，只改 `data/plugins/` 下那一个 YAML 再推即可。

CI 会校验：`dsh.bundle` 清单、`cordis.patch.yml`、**仓库创建满 1 天**、`dsh-plugin` topic、描述是否属实。

---

## ③ 收进 dsh-plugins 组织 —— 已提交

组织用「**加入我们**」issue 模板审核收录（`.github` 仓库里）：<https://github.com/dsh-plugins/.github/issues/1>

审核通过后会收到组织邀请，之后的收尾动作：

```powershell
# 仓库转进组织（也可由对方接收）
#   GitHub → 仓库 Settings → Transfer ownership → dsh-plugins/dsh-image-annotate
git remote set-url origin git@github.com:dsh-plugins/dsh-image-annotate.git
# 包名本来就是 @dsh-plugin/dsh-image-annotate，拿到 npm scope 权限后直接发
npm run publish:npm
```

---

## ④ dsh-plugins 自己的小市场（dsh-plug.in）

进组织后再加条目：把本仓库 `market/dsh-plugins-dsh-image-annotate.json` 提交到 `dsh-plugins/dsh-plugin-market` 的 `plugins/`。
（外部直接提 PR 会被关掉——已实测过，所以先走 ③。）

---

## 改包名 / 换 scope

插件身份写在三处，必须一致，否则浏览器端加载不到 bundle：

1. `package.json` → `name`
2. `cordis.patch.yml` → `insert[].name`（loader 按包名解析）
3. `lib/client.js` → `window.__ModuleLoader__.load({ id })`（模块表按包名注册）

```powershell
node scripts/rename-scope.mjs --check          # 检查三处是否一致
node scripts/rename-scope.mjs @<scope>         # 一键改三处
```

---

## 发布前检查清单

- [ ] `npm run check` 通过
- [ ] `python test/test_annotate.py` 与 `python test/test_edit.py` 全绿（或看 CI）
- [ ] `npm pack --dry-run` 只含运行时文件（不应出现 `test/`、`docs/`、`market/`、`scripts/`）
- [ ] `package.json` 的 `repository` / `homepage` / `bugs` 指向真实仓库
- [ ] `LICENSE` 署名正确
- [ ] `market/*.json` 与 awesome 条目的 `id`/`url` 与实际仓库一致
- [ ] 演示素材不含任何真实工作区 / 会话 / 账号信息（`docs/*` 由 `test/record_demo.py` 在全新实例上生成）
